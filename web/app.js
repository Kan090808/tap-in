const BASE_CONFIG = window.TAPIN_CONFIG || {};

const CONFIG = {
  GAS_WEB_APP_URL: BASE_CONFIG.GAS_WEB_APP_URL || "",
  DEFAULT_OFFICE_STATIC_IP: BASE_CONFIG.DEFAULT_OFFICE_STATIC_IP || "203.0.113.10",
  MAX_GPS_ACCURACY_METERS: Number(BASE_CONFIG.MAX_GPS_ACCURACY_METERS || 120),
  REQUEST_TIMEOUT_MS: 15000,
  STORAGE_KEYS: {
    deviceUUID: "tapin_device_uuid"
  }
};

const state = {
  officeStaticIp: CONFIG.DEFAULT_OFFICE_STATIC_IP,
  maxGpsAccuracyMeters: CONFIG.MAX_GPS_ACCURACY_METERS,
  deferredInstallPrompt: null
};

const ui = {
  nameText: document.getElementById("name-text"),
  deviceText: document.getElementById("device-text"),
  statusText: document.getElementById("status-text"),
  resultText: document.getElementById("result-text"),
  punchBtn: document.getElementById("punch-btn"),
  registerArea: document.getElementById("register-area"),
  registerNameInput: document.getElementById("register-name-input"),
  registerBtn: document.getElementById("register-btn"),
  modePunchLink: document.getElementById("mode-punch-link"),
  modeRegisterLink: document.getElementById("mode-register-link"),
  modeLeaveLink: document.getElementById("mode-leave-link"),
  leaveArea: document.getElementById("leave-area"),
  leaveTypeSelect: document.getElementById("leave-type"),
  leaveStartInput: document.getElementById("leave-start"),
  leaveEndInput: document.getElementById("leave-end"),
  leaveReasonTextarea: document.getElementById("leave-reason"),
  leaveBtn: document.getElementById("leave-btn"),
  installBtn: document.getElementById("install-btn"),
  installHint: document.getElementById("install-hint")
};

function getPageMode() {
  const mode = (new URL(window.location.href).searchParams.get("mode") || "").trim().toLowerCase();
  if (mode === "register") return "register";
  if (mode === "leave") return "leave";
  return "punch";
}

function isRegisterMode() {
  return getPageMode() === "register";
}

function setModeSwitchActive(mode) {
  if (ui.modePunchLink) {
    ui.modePunchLink.classList.toggle("active", mode === "punch");
    ui.modePunchLink.setAttribute("aria-current", mode === "punch" ? "page" : "false");
  }
  if (ui.modeRegisterLink) {
    ui.modeRegisterLink.classList.toggle("active", mode === "register");
    ui.modeRegisterLink.setAttribute("aria-current", mode === "register" ? "page" : "false");
  }
  if (ui.modeLeaveLink) {
    ui.modeLeaveLink.classList.toggle("active", mode === "leave");
    ui.modeLeaveLink.setAttribute("aria-current", mode === "leave" ? "page" : "false");
  }
}

function generateUUID() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateDeviceUUID() {
  const key = CONFIG.STORAGE_KEYS.deviceUUID;
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const uuid = generateUUID();
  localStorage.setItem(key, uuid);
  return uuid;
}

function setStatus(text) {
  ui.statusText.textContent = text;
}

function setResult(text, isError = false) {
  ui.resultText.textContent = text;
  ui.resultText.classList.remove("error", "success");
  if (text) {
    ui.resultText.classList.add(isError ? "error" : "success");
  }
}

function setBusy(isBusy) {
  if (ui.punchBtn) {
    ui.punchBtn.disabled = isBusy;
    ui.punchBtn.textContent = isBusy ? "處理中..." : "一鍵打卡";
  }
  if (ui.registerBtn) {
    ui.registerBtn.disabled = isBusy;
    ui.registerBtn.textContent = isBusy ? "處理中..." : "註冊裝置";
  }
  if (ui.leaveBtn) {
    ui.leaveBtn.disabled = isBusy;
    ui.leaveBtn.textContent = isBusy ? "處理中..." : "送出請假申請";
  }
}

async function getPublicIP() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error("IP 服務回應異常");
    }
    const data = await response.json();
    if (!data || !data.ip) {
      throw new Error("無法解析 IP");
    }
    return data.ip;
  } finally {
    clearTimeout(timer);
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("目前瀏覽器不支援定位"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      () => reject(new Error("無法取得定位，請確認定位權限")),
      {
        enableHighAccuracy: true,
        timeout: CONFIG.REQUEST_TIMEOUT_MS,
        maximumAge: 0
      }
    );
  });
}

function validateAccuracy(accuracy) {
  if (!Number.isFinite(accuracy)) {
    throw new Error("定位精度不足，請到戶外後重試");
  }
  if (accuracy > state.maxGpsAccuracyMeters) {
    throw new Error(`定位精度過低（${Math.round(accuracy)}m），請重試`);
  }
}

async function postToBackend(payload) {
  if (!CONFIG.GAS_WEB_APP_URL) {
    throw new Error("尚未設定 GAS_WEB_APP_URL");
  }
  const response = await fetch(CONFIG.GAS_WEB_APP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_error) {
    throw new Error("後端回傳格式錯誤");
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "打卡失敗");
  }
  return data;
}

async function getFromBackend(action) {
  if (!CONFIG.GAS_WEB_APP_URL) {
    throw new Error("尚未設定 GAS_WEB_APP_URL");
  }
  const url = new URL(CONFIG.GAS_WEB_APP_URL);
  url.searchParams.set("action", action);
  const response = await fetch(url.toString(), { cache: "no-store" });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_error) {
    throw new Error("後端回傳格式錯誤");
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "後端請求失敗");
  }
  return data;
}

async function fetchPublicConfig() {
  if (!CONFIG.GAS_WEB_APP_URL) {
    return;
  }
  const data = await getFromBackend("publicConfig");
  if (!data.config) {
    throw new Error("無法載入公開設定");
  }
  if (data.config.officeStaticIp) {
    state.officeStaticIp = data.config.officeStaticIp;
  }
  if (Number.isFinite(Number(data.config.maxGpsAccuracyMeters))) {
    state.maxGpsAccuracyMeters = Number(data.config.maxGpsAccuracyMeters);
  }
}

async function fetchNetworkTimestamp() {
  const data = await getFromBackend("serverTime");
  const timestamp = Number(data.serverTimestampMs);
  if (!Number.isFinite(timestamp)) {
    throw new Error("無法取得網路時間");
  }
  return Math.round(timestamp);
}

function toFixedNumber(value) {
  return Number(Number(value).toFixed(7));
}

async function maybeNotifyArrival(locationStatus) {
  if (!("Notification" in window)) {
    return;
  }
  if (locationStatus !== "Office") {
    return;
  }
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification("TapIn", {
      body: "已完成到站打卡",
      tag: "tapin-arrival"
    });
  }
}

function refreshHintStatus() {
  setStatus(`IP 邊界參考值：${state.officeStaticIp}`);
}

function formatNetworkTime(value) {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) {
    return String(value || "未知");
  }
  return time.toLocaleString("zh-TW", { hour12: false });
}

function resolvePunchMessage(result) {
  const baseMessage = result.punchMessage
    ? result.punchMessage
    : result.employeeName
      ? `${result.employeeName} 打卡成功`
      : "打卡成功";
  if (result.serverTime) {
    return `${baseMessage}（網路時間：${formatNetworkTime(result.serverTime)}）`;
  }
  return baseMessage;
}

function isStandaloneMode() {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  return window.navigator.standalone === true;
}

function isIosSafari() {
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|opios/.test(ua);
  return isIos && isSafari;
}

function setInstallHint(text) {
  if (!ui.installHint) {
    return;
  }
  const value = String(text || "").trim();
  ui.installHint.textContent = value;
  ui.installHint.hidden = value.length === 0;
}

function hideInstallEntry() {
  if (ui.installBtn) {
    ui.installBtn.hidden = true;
    ui.installBtn.disabled = false;
  }
  setInstallHint("");
}

function initInstallEntry() {
  if (!ui.installBtn) {
    return;
  }
  if (isStandaloneMode()) {
    hideInstallEntry();
    return;
  }

  ui.installBtn.hidden = true;
  ui.installBtn.disabled = true;
  setInstallHint("");

  if (isIosSafari()) {
    ui.installBtn.hidden = false;
    ui.installBtn.disabled = false;
    setInstallHint("iOS 請點分享，再選「加入主畫面」");
    ui.installBtn.addEventListener("click", () => {
      setInstallHint("請在 Safari 點「分享」->「加入主畫面」");
    });
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    ui.installBtn.hidden = false;
    ui.installBtn.disabled = false;
    setInstallHint("可將 TapIn 新增到桌面，像 App 一樣啟動");
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    hideInstallEntry();
    setStatus("已新增至桌面");
  });

  ui.installBtn.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) {
      setInstallHint("目前瀏覽器未提供安裝提示，請使用 Chrome 或 Edge。");
      return;
    }
    const promptEvent = state.deferredInstallPrompt;
    state.deferredInstallPrompt = null;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice && choice.outcome === "accepted") {
      hideInstallEntry();
      setStatus("已新增至桌面");
      return;
    }
    ui.installBtn.hidden = false;
    ui.installBtn.disabled = false;
    setInstallHint("你已取消新增至桌面，可再次點擊重試。");
  });
}

async function submitPunch(payload) {
  setStatus("送出打卡中...");
  const result = await postToBackend(payload);
  await maybeNotifyArrival(result.locationStatus);
  setStatus("打卡完成");
  ui.nameText.textContent = result.employeeName || "由系統自動識別";
  setResult(resolvePunchMessage(result));
}

async function handleLeaveSubmit() {
  const deviceUUID = getOrCreateDeviceUUID();
  const leaveType = ui.leaveTypeSelect ? ui.leaveTypeSelect.value : "";
  const startDate = ui.leaveStartInput ? ui.leaveStartInput.value : "";
  const endDate = ui.leaveEndInput ? ui.leaveEndInput.value : "";
  const reason = ui.leaveReasonTextarea ? ui.leaveReasonTextarea.value.trim() : "";

  if (!leaveType) {
    setResult("請選擇假別", true);
    return;
  }
  if (!startDate) {
    setResult("請選擇開始日期", true);
    return;
  }
  if (!endDate) {
    setResult("請選擇結束日期", true);
    return;
  }
  if (endDate < startDate) {
    setResult("結束日期不能早於開始日期", true);
    return;
  }
  if (!reason) {
    setResult("請填寫請假原因", true);
    return;
  }

  setBusy(true);
  setResult("");

  try {
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      throw new Error("請使用 HTTPS 才能安全送出請假申請");
    }
    const requestTimestamp = await fetchNetworkTimestamp();

    const payload = {
      action: "submitLeave",
      requestId: generateUUID(),
      requestTimestamp: requestTimestamp,
      deviceUUID: deviceUUID,
      leaveType: leaveType,
      startDate: startDate,
      endDate: endDate,
      reason: reason
    };

    setStatus("送出請假申請中...");
    const result = await postToBackend(payload);
    const employeeName = result.employeeName || "";
    setStatus("送出完成");
    setResult((employeeName ? employeeName + " " : "") + "請假申請已送出，等待主管審核");
    if (ui.leaveTypeSelect) ui.leaveTypeSelect.value = "";
    if (ui.leaveStartInput) ui.leaveStartInput.value = "";
    if (ui.leaveEndInput) ui.leaveEndInput.value = "";
    if (ui.leaveReasonTextarea) ui.leaveReasonTextarea.value = "";
  } catch (error) {
    setStatus("送出失敗");
    setResult(error.message || "發生未知錯誤", true);
  } finally {
    setBusy(false);
  }
}

async function handleRegister() {
  const deviceUUID = getOrCreateDeviceUUID();
  const name = String(ui.registerNameInput.value || "").trim();
  if (!name) {
    setResult("請輸入姓名", true);
    return;
  }

  setBusy(true);
  setResult("");

  try {
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      throw new Error("請使用 HTTPS 才能安全註冊");
    }
    const requestTimestamp = await fetchNetworkTimestamp();

    const payload = {
      action: "registerDevice",
      requestId: generateUUID(),
      requestTimestamp: requestTimestamp,
      name: name,
      deviceUUID: deviceUUID,
      originProtocol: window.location.protocol.replace(":", ""),
      originHost: window.location.hostname,
      userAgent: navigator.userAgent,
      appVersion: "1.2.0"
    };

    setStatus("送出註冊中...");
    const result = await postToBackend(payload);
    const employeeName = result.employeeName || name;
    ui.nameText.textContent = employeeName;
    setStatus("註冊完成");
    setResult(result.registerMessage || `${employeeName} 註冊成功`);
  } catch (error) {
    setStatus("註冊失敗");
    setResult(error.message || "發生未知錯誤", true);
  } finally {
    setBusy(false);
  }
}

async function handlePunch() {
  const deviceUUID = getOrCreateDeviceUUID();
  setBusy(true);
  setResult("");

  try {
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      throw new Error("請使用 HTTPS 才能安全打卡");
    }

    setStatus("取得 IP 與定位中...");
    const [ip, position] = await Promise.all([getPublicIP(), getCurrentPosition()]);
    const { latitude, longitude, accuracy } = position.coords;
    validateAccuracy(accuracy);
    const requestTimestamp = await fetchNetworkTimestamp();

    const payload = {
      action: "punch",
      requestId: generateUUID(),
      requestTimestamp: requestTimestamp,
      deviceUUID: deviceUUID,
      ipAddress: ip,
      latitude: toFixedNumber(latitude),
      longitude: toFixedNumber(longitude),
      accuracyMeters: Math.round(accuracy),
      originProtocol: window.location.protocol.replace(":", ""),
      originHost: window.location.hostname,
      userAgent: navigator.userAgent,
      appVersion: "1.1.0"
    };

    await submitPunch(payload);
  } catch (error) {
    setStatus("打卡失敗");
    setResult(error.message || "發生未知錯誤", true);
  } finally {
    setBusy(false);
  }
}

async function initServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (_error) {
    setStatus("Service Worker 註冊失敗");
  }
}

function initUI() {
  const deviceUUID = getOrCreateDeviceUUID();
  const mode = getPageMode();
  setModeSwitchActive(mode);

  const modeLabels = { punch: "由系統自動識別", register: "註冊模式", leave: "請假模式" };
  ui.nameText.textContent = modeLabels[mode] || "由系統自動識別";
  ui.deviceText.textContent = `Device UUID: ${deviceUUID}`;

  if (!CONFIG.GAS_WEB_APP_URL) {
    setResult("請先設定 web/config.js 的 GAS_WEB_APP_URL", true);
  }

  if (ui.registerArea) {
    ui.registerArea.hidden = mode !== "register";
  }
  if (ui.leaveArea) {
    ui.leaveArea.hidden = mode !== "leave";
  }
  if (ui.punchBtn) {
    ui.punchBtn.hidden = mode !== "punch";
  }

  refreshHintStatus();
  initInstallEntry();

  if (mode === "register") {
    if (!ui.registerBtn || !ui.registerNameInput) {
      setStatus("註冊模式初始化失敗");
      setResult("請重新整理頁面後再試", true);
      return;
    }
    setStatus("請輸入姓名註冊此裝置");
    ui.registerBtn.addEventListener("click", handleRegister);
    ui.registerNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleRegister();
      }
    });
    return;
  }

  if (mode === "leave") {
    if (!ui.leaveBtn) {
      setStatus("請假模式初始化失敗");
      setResult("請重新整理頁面後再試", true);
      return;
    }
    setStatus("請填寫請假資訊後送出");
    ui.leaveBtn.addEventListener("click", handleLeaveSubmit);
    return;
  }

  ui.punchBtn.addEventListener("click", handlePunch);
}

async function bootstrap() {
  const mode = getPageMode();
  initUI();
  initServiceWorker();
  if (CONFIG.GAS_WEB_APP_URL) {
    try {
      await fetchPublicConfig();
      if (mode === "register") {
        setStatus("請輸入姓名註冊此裝置");
      } else if (mode === "leave") {
        setStatus("請填寫請假資訊後送出");
      } else {
        refreshHintStatus();
      }
    } catch (_error) {
      if (mode === "register") {
        setStatus("請輸入姓名註冊此裝置");
      } else if (mode === "leave") {
        setStatus("請填寫請假資訊後送出");
      } else {
        refreshHintStatus();
      }
    }
  }
}

bootstrap();
