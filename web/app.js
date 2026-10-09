const BASE_CONFIG = window.TAPIN_CONFIG || {};

const CONFIG = {
  GAS_WEB_APP_URL: BASE_CONFIG.GAS_WEB_APP_URL || "",
  DEFAULT_OFFICE_STATIC_IP: BASE_CONFIG.DEFAULT_OFFICE_STATIC_IP || "203.0.113.10",
  MAX_GPS_ACCURACY_METERS: Number(BASE_CONFIG.MAX_GPS_ACCURACY_METERS || 120),
  REQUEST_TIMEOUT_MS: 15000,
  STORAGE_KEYS: {
    deviceUUID: "tapin_device_uuid",
    adminToken: "tapin_admin_token",
    employeeSession: "tapin_employee_session",
    portalRole: "tapin_portal_role"
  }
};

const EMPLOYEE_MODES = ["punch", "leave", "calendar"];
const ADMIN_VIEWS = ["employees", "config", "logs", "leaves", "calendar"];

const state = {
  officeStaticIp: CONFIG.DEFAULT_OFFICE_STATIC_IP,
  maxGpsAccuracyMeters: CONFIG.MAX_GPS_ACCURACY_METERS,
  deferredInstallPrompt: null,
  activeRoleTab: getRequestedRole(),
  sessionRole: "",
  employeeBinding: null,
  visibleFunctionTabs: [],
  employeeMode: getEmployeeMode(),
  adminView: getAdminView()
};

const ui = {
  portalApp: document.getElementById("portal-app"),
  roleBadge: document.getElementById("role-badge"),
  logoutBtn: document.getElementById("portal-logout-btn"),
  installBtn: document.getElementById("install-btn"),
  installHint: document.getElementById("install-hint"),
  deviceIdValue: document.getElementById("device-id-value"),
  copyDeviceIdBtn: document.getElementById("copy-device-id-btn"),
  deviceIdCopyStatus: document.getElementById("device-id-copy-status"),
  portalLogin: document.getElementById("portal-login"),
  portalStatus: document.getElementById("portal-status"),
  portalResult: document.getElementById("portal-result"),
  employeeRoleTab: document.getElementById("employee-role-tab"),
  adminRoleTab: document.getElementById("admin-role-tab"),
  employeeLoginPanel: document.getElementById("employee-login-panel"),
  adminLoginPanel: document.getElementById("admin-login-panel"),
  employeeLoginBtn: document.getElementById("employee-login-btn"),
  loginForm: document.getElementById("login-form"),
  loginBtn: document.getElementById("login-btn"),
  usernameInput: document.getElementById("username-input"),
  passwordInput: document.getElementById("password-input"),
  temporaryAdminResetForm: document.getElementById("temporary-admin-reset-form"),
  temporaryAdminResetUsername: document.getElementById("temporary-admin-reset-username"),
  temporaryAdminResetPassword: document.getElementById("temporary-admin-reset-password"),
  temporaryAdminResetConfirm: document.getElementById("temporary-admin-reset-confirm"),
  temporaryAdminResetBtn: document.getElementById("temporary-admin-reset-btn"),
  employeeShell: document.getElementById("employee-shell"),
  modePunchLink: document.getElementById("mode-punch-link"),
  modeLeaveLink: document.getElementById("mode-leave-link"),
  modeCalendarLink: document.getElementById("mode-calendar-link"),
  nameText: document.getElementById("name-text"),
  deviceText: document.getElementById("device-text"),
  punchBtn: document.getElementById("punch-btn"),
  leaveArea: document.getElementById("leave-area"),
  leaveTypeSelect: document.getElementById("leave-type"),
  leaveStartInput: document.getElementById("leave-start"),
  leaveEndInput: document.getElementById("leave-end"),
  leaveReasonTextarea: document.getElementById("leave-reason"),
  leaveBtn: document.getElementById("leave-btn"),
  calendarArea: document.getElementById("calendar-area"),
  empCalPrev: document.getElementById("emp-cal-prev"),
  empCalNext: document.getElementById("emp-cal-next"),
  empCalYearSel: document.getElementById("emp-cal-year"),
  empCalMonthSel: document.getElementById("emp-cal-month"),
  empCalWrap: document.getElementById("emp-cal-wrap"),
  employeeStatus: document.getElementById("status-text"),
  employeeResult: document.getElementById("result-text"),
  adminShell: document.getElementById("admin-shell"),
  adminViewConfigLink: document.getElementById("admin-view-config-link"),
  adminViewEmployeesLink: document.getElementById("admin-view-employees-link"),
  adminViewLogsLink: document.getElementById("admin-view-logs-link"),
  adminViewLeavesLink: document.getElementById("admin-view-leaves-link"),
  adminViewCalendarLink: document.getElementById("admin-view-calendar-link"),
  adminConfigPanel: document.getElementById("admin-config-panel"),
  adminEmployeesPanel: document.getElementById("admin-employees-panel"),
  employeeForm: document.getElementById("employee-form"),
  employeeIdInput: document.getElementById("employee-id-input"),
  employeeNameInput: document.getElementById("employee-name-input"),
  employeePhoneInput: document.getElementById("employee-phone-input"),
  employeeEmailInput: document.getElementById("employee-email-input"),
  employeeDeviceInput: document.getElementById("employee-device-input"),
  saveEmployeeBtn: document.getElementById("save-employee-btn"),
  cancelEmployeeBtn: document.getElementById("cancel-employee-btn"),
  reloadEmployeesBtn: document.getElementById("reload-employees-btn"),
  employeesBody: document.getElementById("employees-body"),
  adminLogsPanel: document.getElementById("admin-logs-panel"),
  adminLeavesPanel: document.getElementById("admin-leaves-panel"),
  adminCalendarPanel: document.getElementById("admin-calendar-panel"),
  configForm: document.getElementById("config-form"),
  spreadsheetIdInput: document.getElementById("spreadsheet-id-input"),
  officeIpInput: document.getElementById("office-ip-input"),
  logSheetNameInput: document.getElementById("log-sheet-name-input"),
  bindingSheetNameInput: document.getElementById("binding-sheet-name-input"),
  maxGpsInput: document.getElementById("max-gps-input"),
  leaveSheetNameInput: document.getElementById("leave-sheet-name-input"),
  reloadLogsBtn: document.getElementById("reload-logs-btn"),
  limitSelect: document.getElementById("limit-select"),
  logsBody: document.getElementById("logs-body"),
  leaveStatusSelect: document.getElementById("leave-status-select"),
  reloadLeaveBtn: document.getElementById("reload-leave-btn"),
  leaveBody: document.getElementById("leave-body"),
  adminCalPrev: document.getElementById("admin-cal-prev"),
  adminCalNext: document.getElementById("admin-cal-next"),
  adminCalYearSel: document.getElementById("admin-cal-year"),
  adminCalMonthSel: document.getElementById("admin-cal-month"),
  adminCalWrap: document.getElementById("admin-cal-wrap"),
  adminStatus: document.getElementById("admin-status"),
  adminResult: document.getElementById("admin-result")
};

let empCalYear = new Date().getFullYear();
let empCalMonth = new Date().getMonth() + 1;
let adminCalYear = new Date().getFullYear();
let adminCalMonth = new Date().getMonth() + 1;
let employees = [];

function getRequestedRole() {
  const url = new URL(window.location.href);
  const role = (url.searchParams.get("role") || document.body.dataset.entryRole || "employee").trim().toLowerCase();
  return role === "admin" ? "admin" : "employee";
}

function getEmployeeMode() {
  const mode = (new URL(window.location.href).searchParams.get("mode") || "punch").trim().toLowerCase();
  return EMPLOYEE_MODES.indexOf(mode) >= 0 ? mode : "punch";
}

function getAdminView() {
  const view = (new URL(window.location.href).searchParams.get("view") || "config").trim().toLowerCase();
  return ADMIN_VIEWS.indexOf(view) >= 0 ? view : "config";
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

function generateUUID() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getAdminToken() {
  return sessionStorage.getItem(CONFIG.STORAGE_KEYS.adminToken) || "";
}

function setAdminToken(token) {
  if (!token) {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.adminToken);
    return;
  }
  sessionStorage.setItem(CONFIG.STORAGE_KEYS.adminToken, token);
}

function getStoredPortalRole() {
  const role = (sessionStorage.getItem(CONFIG.STORAGE_KEYS.portalRole) || "").trim().toLowerCase();
  return role === "admin" || role === "employee" ? role : "";
}

function setStoredPortalRole(role) {
  if (!role) {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.portalRole);
    return;
  }
  sessionStorage.setItem(CONFIG.STORAGE_KEYS.portalRole, role);
}

function getEmployeeSession() {
  try {
    const raw = sessionStorage.getItem(CONFIG.STORAGE_KEYS.employeeSession);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw);
    if (!data || !data.deviceUUID) {
      return null;
    }
    return data;
  } catch (_error) {
    return null;
  }
}

function setEmployeeSession(binding) {
  if (!binding || !binding.deviceUUID) {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.employeeSession);
    return;
  }
  sessionStorage.setItem(
    CONFIG.STORAGE_KEYS.employeeSession,
    JSON.stringify({
      employeeName: binding.employeeName || "",
      deviceUUID: binding.deviceUUID
    })
  );
}

function clearEmployeeSession() {
  sessionStorage.removeItem(CONFIG.STORAGE_KEYS.employeeSession);
}

function setPortalStatus(text) {
  if (ui.portalStatus) {
    ui.portalStatus.textContent = text;
  }
}

function setPortalResult(text, isError) {
  setFeedback(ui.portalResult, text, isError);
}

function setEmployeeStatus(text) {
  if (ui.employeeStatus) {
    ui.employeeStatus.textContent = text;
  }
}

function setEmployeeResult(text, isError) {
  setFeedback(ui.employeeResult, text, isError);
}

function setAdminStatus(text) {
  if (ui.adminStatus) {
    ui.adminStatus.textContent = text;
  }
}

function setAdminResult(text, isError) {
  setFeedback(ui.adminResult, text, isError);
}

function setFeedback(element, text, isError) {
  if (!element) {
    return;
  }
  element.textContent = String(text || "");
  element.classList.remove("error", "success");
  if (text) {
    element.classList.add(isError ? "error" : "success");
  }
}

function setBusy(isBusy) {
  if (ui.employeeLoginBtn) {
    ui.employeeLoginBtn.disabled = isBusy;
  }
  if (ui.punchBtn) {
    ui.punchBtn.disabled = isBusy;
    ui.punchBtn.textContent = isBusy ? "處理中..." : "一鍵打卡";
  }
  if (ui.leaveBtn) {
    ui.leaveBtn.disabled = isBusy;
    ui.leaveBtn.textContent = isBusy ? "處理中..." : "送出請假申請";
  }
}

function setAdminLoginBusy(isBusy) {
  if (!ui.loginBtn) {
    return;
  }
  ui.loginBtn.disabled = isBusy;
  ui.loginBtn.textContent = isBusy ? "登入中..." : "登入管理後台";
}

function ensureBackendConfigured() {
  if (!CONFIG.GAS_WEB_APP_URL) {
    throw new Error("請先在 web/config.js 設定 GAS_WEB_APP_URL");
  }
}

async function postToBackend(payload) {
  ensureBackendConfigured();
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
    throw new Error(data.message || "請求失敗");
  }
  return data;
}

async function getFromBackend(action) {
  ensureBackendConfigured();
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
  if (data.config && data.config.officeStaticIp) {
    state.officeStaticIp = data.config.officeStaticIp;
  }
  if (data.config && Number.isFinite(Number(data.config.maxGpsAccuracyMeters))) {
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

async function resolveEmployeeSession() {
  const deviceUUID = getOrCreateDeviceUUID();
  const data = await postToBackend({
    action: "employeeResolveSession",
    deviceUUID: deviceUUID
  });
  if (!data.isRegistered) {
    return {
      isRegistered: false,
      employeeName: "",
      deviceUUID: deviceUUID
    };
  }
  return {
    isRegistered: true,
    employeeName: data.employeeName || "",
    deviceUUID: data.deviceUUID || deviceUUID
  };
}

function setRoleTabActive(role) {
  state.activeRoleTab = role === "admin" ? "admin" : "employee";
  const isEmployee = state.activeRoleTab === "employee";

  if (ui.employeeRoleTab) {
    ui.employeeRoleTab.classList.toggle("active", isEmployee);
    ui.employeeRoleTab.setAttribute("aria-pressed", isEmployee ? "true" : "false");
  }
  if (ui.adminRoleTab) {
    ui.adminRoleTab.classList.toggle("active", !isEmployee);
    ui.adminRoleTab.setAttribute("aria-pressed", !isEmployee ? "true" : "false");
  }
  if (ui.employeeLoginPanel) {
    ui.employeeLoginPanel.hidden = !isEmployee;
  }
  if (ui.adminLoginPanel) {
    ui.adminLoginPanel.hidden = isEmployee;
  }
}

function setEmployeeModeActive(mode) {
  if (ui.modePunchLink) {
    ui.modePunchLink.classList.toggle("active", mode === "punch");
    ui.modePunchLink.setAttribute("aria-current", mode === "punch" ? "page" : "false");
  }
  if (ui.modeLeaveLink) {
    ui.modeLeaveLink.classList.toggle("active", mode === "leave");
    ui.modeLeaveLink.setAttribute("aria-current", mode === "leave" ? "page" : "false");
  }
  if (ui.modeCalendarLink) {
    ui.modeCalendarLink.classList.toggle("active", mode === "calendar");
    ui.modeCalendarLink.setAttribute("aria-current", mode === "calendar" ? "page" : "false");
  }
}

function setAdminViewActive(view) {
  if (ui.adminViewEmployeesLink) {
    ui.adminViewEmployeesLink.classList.toggle("active", view === "employees");
    ui.adminViewEmployeesLink.setAttribute("aria-current", view === "employees" ? "page" : "false");
  }
  if (ui.adminViewConfigLink) {
    ui.adminViewConfigLink.classList.toggle("active", view === "config");
    ui.adminViewConfigLink.setAttribute("aria-current", view === "config" ? "page" : "false");
  }
  if (ui.adminViewLogsLink) {
    ui.adminViewLogsLink.classList.toggle("active", view === "logs");
    ui.adminViewLogsLink.setAttribute("aria-current", view === "logs" ? "page" : "false");
  }
  if (ui.adminViewLeavesLink) {
    ui.adminViewLeavesLink.classList.toggle("active", view === "leaves");
    ui.adminViewLeavesLink.setAttribute("aria-current", view === "leaves" ? "page" : "false");
  }
  if (ui.adminViewCalendarLink) {
    ui.adminViewCalendarLink.classList.toggle("active", view === "calendar");
    ui.adminViewCalendarLink.setAttribute("aria-current", view === "calendar" ? "page" : "false");
  }
}

function updateTopbar() {
  const isAuthenticated = Boolean(state.sessionRole);
  if (ui.roleBadge) {
    ui.roleBadge.hidden = !isAuthenticated;
    ui.roleBadge.textContent = state.sessionRole === "admin" ? "管理員" : "員工";
  }
  if (ui.logoutBtn) {
    ui.logoutBtn.hidden = !isAuthenticated;
  }
  if (ui.portalApp) {
    ui.portalApp.classList.toggle("is-admin", state.sessionRole === "admin");
  }
}

function updateVisibleTabs(role) {
  if (role === "admin") {
    state.visibleFunctionTabs = ADMIN_VIEWS.slice();
    return;
  }
  if (role === "employee") {
    state.visibleFunctionTabs = EMPLOYEE_MODES.slice();
    return;
  }
  state.visibleFunctionTabs = [];
}

function showPortalLogin(role, options) {
  const nextRole = role === "admin" ? "admin" : "employee";
  const settings = options || {};

  state.sessionRole = "";
  state.employeeBinding = null;
  updateVisibleTabs("");

  if (ui.portalLogin) {
    ui.portalLogin.hidden = false;
  }
  if (ui.employeeShell) {
    ui.employeeShell.hidden = true;
  }
  if (ui.adminShell) {
    ui.adminShell.hidden = true;
  }

  setRoleTabActive(nextRole);
  setPortalStatus(settings.status || (nextRole === "admin" ? "請先登入管理者帳號" : "請先以已綁定裝置登入"));
  setPortalResult(settings.result || "", Boolean(settings.isError));
  updateTopbar();
}

function renderEmployeeShell() {
  const mode = EMPLOYEE_MODES.indexOf(state.employeeMode) >= 0 ? state.employeeMode : "punch";
  setEmployeeModeActive(mode);

  if (ui.punchBtn) {
    ui.punchBtn.hidden = mode !== "punch";
  }
  if (ui.leaveArea) {
    ui.leaveArea.hidden = mode !== "leave";
  }
  if (ui.calendarArea) {
    ui.calendarArea.hidden = mode !== "calendar";
  }

  if (mode === "punch") {
    setEmployeeStatus("準備完成");
  } else if (mode === "leave") {
    setEmployeeStatus("請填寫請假資訊後送出");
  } else if (mode === "calendar") {
    setEmployeeStatus("載入個人日曆中...");
    loadEmployeeCalendar();
  }
}

function renderAdminShell() {
  const view = ADMIN_VIEWS.indexOf(state.adminView) >= 0 ? state.adminView : "config";
  setAdminViewActive(view);
  if (ui.adminEmployeesPanel) {
    ui.adminEmployeesPanel.hidden = view !== "employees";
  }
  if (ui.adminConfigPanel) {
    ui.adminConfigPanel.hidden = view !== "config";
  }
  if (ui.adminLogsPanel) {
    ui.adminLogsPanel.hidden = view !== "logs";
  }
  if (ui.adminLeavesPanel) {
    ui.adminLeavesPanel.hidden = view !== "leaves";
  }
  if (ui.adminCalendarPanel) {
    ui.adminCalendarPanel.hidden = view !== "calendar";
  }
}

function updateUrlForEmployeeMode(mode) {
  const url = new URL(window.location.href);
  url.searchParams.delete("role");
  url.searchParams.delete("view");
  url.searchParams.set("mode", mode);
  window.history.replaceState({}, "", url.toString());
}

function updateUrlForAdminView(view) {
  const url = new URL(window.location.href);
  url.searchParams.delete("mode");
  url.searchParams.set("role", "admin");
  url.searchParams.set("view", view);
  window.history.replaceState({}, "", url.toString());
}

function updateUrlForLogin(role) {
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  if (role === "admin") {
    url.searchParams.delete("mode");
    url.searchParams.set("role", "admin");
  } else {
    url.searchParams.delete("role");
  }
  window.history.replaceState({}, "", url.toString());
}

function enterEmployeePortal(binding) {
  state.sessionRole = "employee";
  state.employeeBinding = binding;
  updateVisibleTabs("employee");
  setEmployeeSession(binding);
  setStoredPortalRole("employee");

  if (ui.portalLogin) {
    ui.portalLogin.hidden = true;
  }
  if (ui.employeeShell) {
    ui.employeeShell.hidden = false;
  }
  if (ui.adminShell) {
    ui.adminShell.hidden = true;
  }

  if (ui.nameText) {
    ui.nameText.textContent = binding.employeeName || "由系統自動識別";
  }
  if (ui.deviceText) {
    ui.deviceText.textContent = "Device UUID: " + (binding.deviceUUID || getOrCreateDeviceUUID());
  }

  if (state.employeeMode === "calendar") {
    initEmpCalSelects(empCalYear, empCalMonth);
  }
  if (EMPLOYEE_MODES.indexOf(state.employeeMode) === -1) {
    state.employeeMode = "punch";
  }
  renderEmployeeShell();
  updateTopbar();
}

async function enterAdminPortal() {
  state.sessionRole = "admin";
  updateVisibleTabs("admin");
  setStoredPortalRole("admin");

  if (ui.portalLogin) {
    ui.portalLogin.hidden = true;
  }
  if (ui.employeeShell) {
    ui.employeeShell.hidden = true;
  }
  if (ui.adminShell) {
    ui.adminShell.hidden = false;
  }

  updateTopbar();
  renderAdminShell();
  initCalSelects(ui.adminCalYearSel, ui.adminCalMonthSel, adminCalYear, adminCalMonth);

  try {
    setAdminStatus("讀取員工帳號中...");
    await loadEmployees();
    setAdminStatus("讀取設定中...");
    await loadConfig();
    setAdminStatus("讀取打卡紀錄中...");
    await loadLogs();
    setAdminStatus("讀取請假申請中...");
    await loadLeaveRequests();
    setAdminStatus("讀取日曆中...");
    await loadAdminCalendar();
    setAdminStatus("管理頁已就緒");
    setAdminResult("", false);
    updateUrlForAdminView(state.adminView);
    return true;
  } catch (error) {
    setAdminToken("");
    setStoredPortalRole("");
    state.sessionRole = "";
    updateVisibleTabs("");
    showPortalLogin("admin", {
      status: "管理員登入已失效",
      result: error.message || "未知錯誤",
      isError: true
    });
    return false;
  }
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
    ui.installBtn.addEventListener("click", function () {
      setInstallHint("請在 Safari 點「分享」->「加入主畫面」");
    });
    return;
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    ui.installBtn.hidden = false;
    ui.installBtn.disabled = false;
    setInstallHint("可將 TapIn 新增到桌面，像 App 一樣啟動");
  });

  window.addEventListener("appinstalled", function () {
    state.deferredInstallPrompt = null;
    hideInstallEntry();
    if (state.sessionRole === "admin") {
      setAdminStatus("已新增至桌面");
      return;
    }
    if (state.sessionRole === "employee") {
      setEmployeeStatus("已新增至桌面");
    }
  });

  ui.installBtn.addEventListener("click", async function () {
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
      return;
    }
    ui.installBtn.hidden = false;
    ui.installBtn.disabled = false;
    setInstallHint("你已取消新增至桌面，可再次點擊重試。");
  });
}

async function getPublicIP() {
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, CONFIG.REQUEST_TIMEOUT_MS);
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
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) {
      reject(new Error("目前瀏覽器不支援定位"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      function () {
        reject(new Error("無法取得定位，請確認定位權限"));
      },
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
    throw new Error("定位精度過低（" + Math.round(accuracy) + "m），請重試");
  }
}

function toFixedNumber(value) {
  return Number(Number(value).toFixed(7));
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
      ? result.employeeName + " 打卡成功"
      : "打卡成功";
  if (result.serverTime) {
    return baseMessage + "（網路時間：" + formatNetworkTime(result.serverTime) + "）";
  }
  return baseMessage;
}

async function maybeNotifyArrival(locationStatus) {
  if (!("Notification" in window) || locationStatus !== "Office") {
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

async function handleEmployeeLogin() {
  setBusy(true);
  setPortalResult("", false);
  setPortalStatus("驗證裝置綁定中...");
  try {
    const binding = await resolveEmployeeSession();
    if (!binding.isRegistered) {
      clearEmployeeSession();
      setStoredPortalRole("");
      showPortalLogin("employee", {
        status: "此裝置尚未綁定員工身份",
        result: "請複製上方 Device ID 傳給管理員，由管理員建立帳號。",
        isError: true
      });
      return;
    }
    enterEmployeePortal(binding);
    setEmployeeResult("", false);
    setEmployeeStatus("登入成功");
    updateUrlForEmployeeMode(state.employeeMode);
  } catch (error) {
    showPortalLogin("employee", {
      status: "員工登入失敗",
      result: error.message || "未知錯誤",
      isError: true
    });
  } finally {
    setBusy(false);
  }
}

async function submitPunch(payload) {
  setEmployeeStatus("送出打卡中...");
  const result = await postToBackend(payload);
  await maybeNotifyArrival(result.locationStatus);
  setEmployeeStatus("打卡完成");
  if (ui.nameText) {
    ui.nameText.textContent = result.employeeName || "由系統自動識別";
  }
  setEmployeeResult(resolvePunchMessage(result), false);
}

async function handlePunch() {
  const deviceUUID = getOrCreateDeviceUUID();
  setBusy(true);
  setEmployeeResult("", false);

  try {
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      throw new Error("請使用 HTTPS 才能安全打卡");
    }

    setEmployeeStatus("取得 IP 與定位中...");
    const values = await Promise.all([getPublicIP(), getCurrentPosition()]);
    const ip = values[0];
    const position = values[1];
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    validateAccuracy(accuracy);
    const requestTimestamp = await fetchNetworkTimestamp();

    await submitPunch({
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
      appVersion: "1.3.0"
    });
  } catch (error) {
    setEmployeeStatus("打卡失敗");
    setEmployeeResult(error.message || "發生未知錯誤", true);
  } finally {
    setBusy(false);
  }
}

async function handleLeaveSubmit() {
  const deviceUUID = getOrCreateDeviceUUID();
  const leaveType = ui.leaveTypeSelect ? ui.leaveTypeSelect.value : "";
  const startDate = ui.leaveStartInput ? ui.leaveStartInput.value : "";
  const endDate = ui.leaveEndInput ? ui.leaveEndInput.value : "";
  const reason = ui.leaveReasonTextarea ? ui.leaveReasonTextarea.value.trim() : "";

  if (!leaveType) {
    setEmployeeResult("請選擇假別", true);
    return;
  }
  if (!startDate) {
    setEmployeeResult("請選擇開始日期", true);
    return;
  }
  if (!endDate) {
    setEmployeeResult("請選擇結束日期", true);
    return;
  }
  if (endDate < startDate) {
    setEmployeeResult("結束日期不能早於開始日期", true);
    return;
  }
  if (!reason) {
    setEmployeeResult("請填寫請假原因", true);
    return;
  }

  setBusy(true);
  setEmployeeResult("", false);

  try {
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      throw new Error("請使用 HTTPS 才能安全送出請假申請");
    }
    const requestTimestamp = await fetchNetworkTimestamp();
    const result = await postToBackend({
      action: "submitLeave",
      requestId: generateUUID(),
      requestTimestamp: requestTimestamp,
      deviceUUID: deviceUUID,
      leaveType: leaveType,
      startDate: startDate,
      endDate: endDate,
      reason: reason
    });

    setEmployeeStatus("送出完成");
    setEmployeeResult((result.employeeName ? result.employeeName + " " : "") + "請假申請已送出，等待主管審核", false);
    if (ui.leaveTypeSelect) ui.leaveTypeSelect.value = "";
    if (ui.leaveStartInput) ui.leaveStartInput.value = "";
    if (ui.leaveEndInput) ui.leaveEndInput.value = "";
    if (ui.leaveReasonTextarea) ui.leaveReasonTextarea.value = "";
  } catch (error) {
    setEmployeeStatus("送出失敗");
    setEmployeeResult(error.message || "發生未知錯誤", true);
  } finally {
    setBusy(false);
  }
}

function initEmpCalSelects(year, month) {
  initCalSelects(ui.empCalYearSel, ui.empCalMonthSel, year, month);
}

function initCalSelects(yearEl, monthEl, year, month) {
  if (!yearEl || !monthEl) {
    return;
  }
  const curYear = new Date().getFullYear();
  yearEl.innerHTML = "";
  for (let y = curYear - 5; y <= curYear + 5; y += 1) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y + " 年";
    if (y === year) {
      opt.selected = true;
    }
    yearEl.appendChild(opt);
  }
  monthEl.innerHTML = "";
  for (let m = 1; m <= 12; m += 1) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m + " 月";
    if (m === month) {
      opt.selected = true;
    }
    monthEl.appendChild(opt);
  }
}

function buildCalendarHtml(year, month, dayContentFn) {
  const today = new Date();
  const todayStr =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0");
  const firstDow = new Date(year, month - 1, 1).getDay();
  const startOffset = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const headers = ["一", "二", "三", "四", "五", "六", "日"];

  let html = '<div class="cal-grid">';
  headers.forEach(function (header) {
    html += '<div class="cal-header-cell">' + header + "</div>";
  });
  for (let i = 0; i < startOffset; i += 1) {
    html += '<div class="cal-day empty"></div>';
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr =
      year +
      "-" +
      String(month).padStart(2, "0") +
      "-" +
      String(day).padStart(2, "0");
    html += '<div class="cal-day' + (dateStr === todayStr ? " today" : "") + '">';
    html += '<div class="cal-day-num">' + day + "</div>";
    html += dayContentFn(dateStr);
    html += "</div>";
  }
  html += "</div>";
  return html;
}

async function loadEmployeeCalendar() {
  if (!ui.empCalWrap || state.sessionRole !== "employee") {
    return;
  }
  try {
    setEmployeeStatus("載入日曆中...");
    const data = await postToBackend({
      action: "employeeGetCalendar",
      deviceUUID: getOrCreateDeviceUUID(),
      year: empCalYear,
      month: empCalMonth
    });
    const punchesByDate = data.punchesByDate || {};
    const leavesByDate = data.leavesByDate || {};
    const locationLabel = { Office: "辦公室", office: "辦公室" };

    ui.empCalWrap.innerHTML = buildCalendarHtml(empCalYear, empCalMonth, function (dateStr) {
      let content = "";
      const punches = punchesByDate[dateStr] || [];
      punches.forEach(function (punch) {
        const label = locationLabel[punch.locationStatus] || "遠端";
        content += '<span class="cal-punch-item">' + escapeHtml(punch.time) + " " + label + "</span>";
      });
      const leave = leavesByDate[dateStr];
      if (leave) {
        content += '<span class="cal-leave-badge">' + escapeHtml(leave.leaveType) + "</span>";
      }
      return content;
    });
    setEmployeeStatus("日曆已更新");
    setEmployeeResult("", false);
  } catch (error) {
    setEmployeeStatus("日曆載入失敗");
    setEmployeeResult(error.message || "未知錯誤", true);
  }
}

function fillConfig(config) {
  if (ui.spreadsheetIdInput) ui.spreadsheetIdInput.value = config.spreadsheetId || "";
  if (ui.officeIpInput) ui.officeIpInput.value = config.officeStaticIp || "";
  if (ui.logSheetNameInput) ui.logSheetNameInput.value = config.logSheetName || "";
  if (ui.bindingSheetNameInput) ui.bindingSheetNameInput.value = config.bindingSheetName || "";
  if (ui.maxGpsInput) ui.maxGpsInput.value = config.maxGpsAccuracyMeters || "";
  if (ui.leaveSheetNameInput) ui.leaveSheetNameInput.value = config.leaveSheetName || "";
}

async function loadConfig() {
  const data = await postToBackend({
    action: "adminGetConfig",
    token: getAdminToken()
  });
  fillConfig(data.config || {});
}

function resetEmployeeForm() {
  if (!ui.employeeForm) return;
  ui.employeeForm.reset();
  ui.employeeIdInput.value = "";
  ui.saveEmployeeBtn.textContent = "新增員工";
  ui.cancelEmployeeBtn.hidden = true;
}

function renderEmployees() {
  if (!ui.employeesBody) return;
  ui.employeesBody.replaceChildren();
  if (!employees.length) {
    const row = ui.employeesBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.textContent = "目前沒有員工帳號";
    return;
  }
  employees.forEach(function (employee) {
    const row = ui.employeesBody.insertRow();
    [employee.name, employee.phone, employee.email, employee.deviceUUID].forEach(function (value) {
      row.insertCell().textContent = value || "—";
    });
    const actions = row.insertCell();
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "ghost-btn";
    edit.textContent = "編輯";
    edit.addEventListener("click", function () {
      ui.employeeIdInput.value = employee.employeeId;
      ui.employeeNameInput.value = employee.name || "";
      ui.employeePhoneInput.value = employee.phone || "";
      ui.employeeEmailInput.value = employee.email || "";
      ui.employeeDeviceInput.value = employee.deviceUUID || "";
      ui.saveEmployeeBtn.textContent = "儲存變更";
      ui.cancelEmployeeBtn.hidden = false;
      ui.employeeNameInput.focus();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost-btn";
    remove.textContent = "刪除";
    remove.addEventListener("click", async function () {
      if (!window.confirm("確定刪除「" + employee.name + "」的員工帳號？該裝置將無法登入。")) return;
      try {
        setAdminStatus("刪除員工中...");
        await postToBackend({ action: "adminDeleteEmployee", token: getAdminToken(), employeeId: employee.employeeId });
        if (ui.employeeIdInput.value === employee.employeeId) resetEmployeeForm();
        await loadEmployees();
        setAdminStatus("員工已刪除");
        setAdminResult("員工帳號已刪除", false);
      } catch (error) {
        setAdminStatus("刪除失敗");
        setAdminResult(error.message || "未知錯誤", true);
      }
    });
    actions.append(edit, remove);
  });
}

async function loadEmployees() {
  const data = await postToBackend({ action: "adminGetEmployees", token: getAdminToken() });
  employees = data.employees || [];
  renderEmployees();
}

async function saveEmployee() {
  const data = await postToBackend({
    action: "adminSaveEmployee",
    token: getAdminToken(),
    employeeId: ui.employeeIdInput.value,
    name: ui.employeeNameInput.value.trim(),
    phone: ui.employeePhoneInput.value.trim(),
    email: ui.employeeEmailInput.value.trim(),
    deviceUUID: ui.employeeDeviceInput.value.trim()
  });
  resetEmployeeForm();
  await loadEmployees();
  return data;
}

async function saveConfig() {
  const data = await postToBackend({
    action: "adminUpdateConfig",
    token: getAdminToken(),
    spreadsheetId: ui.spreadsheetIdInput ? ui.spreadsheetIdInput.value.trim() : "",
    officeStaticIp: ui.officeIpInput ? ui.officeIpInput.value.trim() : "",
    logSheetName: ui.logSheetNameInput ? ui.logSheetNameInput.value.trim() : "",
    bindingSheetName: ui.bindingSheetNameInput ? ui.bindingSheetNameInput.value.trim() : "",
    maxGpsAccuracyMeters: ui.maxGpsInput ? Number(ui.maxGpsInput.value) : "",
    leaveSheetName: ui.leaveSheetNameInput ? ui.leaveSheetNameInput.value.trim() : ""
  });
  fillConfig(data.config || {});
}

function renderLogs(logs) {
  if (!ui.logsBody) {
    return;
  }
  if (!logs.length) {
    ui.logsBody.innerHTML = '<tr><td colspan="7">目前沒有資料</td></tr>';
    return;
  }
  ui.logsBody.innerHTML = logs
    .map(function (item) {
      return '<tr>' +
        "<td>" + escapeHtml(item.timestamp) + "</td>" +
        "<td>" + escapeHtml(item.employeeName) + "</td>" +
        "<td>" + escapeHtml(item.deviceUUID) + "</td>" +
        "<td>" + escapeHtml(item.ipAddress) + "</td>" +
        "<td>" + escapeHtml(item.locationStatus) + "</td>" +
        "<td>" + escapeHtml(item.latitude) + "</td>" +
        "<td>" + escapeHtml(item.longitude) + "</td>" +
      "</tr>";
    })
    .join("");
}

async function loadLogs() {
  const data = await postToBackend({
    action: "adminGetLogs",
    token: getAdminToken(),
    limit: Number(ui.limitSelect ? ui.limitSelect.value || "50" : "50")
  });
  renderLogs(data.logs || []);
}

function renderLeaveTable(leaves) {
  if (!ui.leaveBody) {
    return;
  }
  if (!leaves.length) {
    ui.leaveBody.innerHTML = '<tr><td colspan="9">目前沒有資料</td></tr>';
    return;
  }
  const statusLabels = {
    pending: "待審核",
    approved: "已批准",
    rejected: "已拒絕"
  };
  ui.leaveBody.innerHTML = leaves
    .map(function (item) {
      const statusLabel = statusLabels[item.status] || escapeHtml(item.status);
      const actionCell =
        item.status === "pending"
          ? '<button class="ghost-btn" onclick="handleLeaveAction(\'' + escapeHtml(item.requestId) + '\',\'approved\')">批准</button>' +
            '<button class="ghost-btn" onclick="handleLeaveAction(\'' + escapeHtml(item.requestId) + '\',\'rejected\')">拒絕</button>'
          : statusLabel;
      const escapedId = escapeHtml(item.requestId);
      const shortId = escapedId.length > 8 ? escapedId.slice(0, 8) + "…" : escapedId;
      return '<tr>' +
        '<td title="' + escapedId + '">' + shortId + "</td>" +
        "<td>" + escapeHtml(item.employeeName) + "</td>" +
        "<td>" + escapeHtml(item.leaveType) + "</td>" +
        "<td>" + escapeHtml(item.startDate) + "</td>" +
        "<td>" + escapeHtml(item.endDate) + "</td>" +
        "<td>" + escapeHtml(item.reason) + "</td>" +
        "<td>" + statusLabel + "</td>" +
        "<td>" + escapeHtml(item.submittedAt) + "</td>" +
        "<td>" + actionCell + "</td>" +
      "</tr>";
    })
    .join("");
}

async function loadLeaveRequests() {
  const data = await postToBackend({
    action: "adminGetLeaveRequests",
    token: getAdminToken(),
    status: ui.leaveStatusSelect ? ui.leaveStatusSelect.value : "pending",
    limit: 100
  });
  renderLeaveTable(data.leaves || []);
}

async function handleLeaveAction(requestId, status) {
  try {
    setAdminStatus(status === "approved" ? "批准中..." : "拒絕中...");
    await postToBackend({
      action: "adminUpdateLeaveStatus",
      token: getAdminToken(),
      requestId: requestId,
      status: status
    });
    setAdminStatus(status === "approved" ? "已批准" : "已拒絕");
    setAdminResult("", false);
    await loadLeaveRequests();
  } catch (error) {
    setAdminStatus("操作失敗");
    setAdminResult(error.message || "未知錯誤", true);
  }
}

window.handleLeaveAction = handleLeaveAction;

async function loadAdminCalendar() {
  if (!ui.adminCalWrap || state.sessionRole !== "admin") {
    return;
  }
  try {
    const data = await postToBackend({
      action: "adminGetCalendar",
      token: getAdminToken(),
      year: adminCalYear,
      month: adminCalMonth
    });
    const leavesByDate = data.leavesByDate || {};
    ui.adminCalWrap.innerHTML = buildCalendarHtml(adminCalYear, adminCalMonth, function (dateStr) {
      const names = leavesByDate[dateStr] || [];
      return names
        .map(function (name) {
          return '<span class="cal-leave-badge">' + escapeHtml(name) + "</span>";
        })
        .join("");
    });
    setAdminStatus("日曆已更新");
    setAdminResult("", false);
  } catch (error) {
    setAdminStatus("日曆載入失敗");
    setAdminResult(error.message || "未知錯誤", true);
  }
}

async function loginAdmin(username, password) {
  const data = await postToBackend({
    action: "adminLogin",
    username: username,
    password: password
  });
  setAdminToken(data.token || "");
  return data;
}

// TEMPORARY: Remove this public password reset flow after the administrator completes the reset.
async function resetAdminPasswordTemporarily(username, password) {
  return postToBackend({
    action: "temporaryAdminPasswordReset",
    username: username,
    password: password
  });
}

async function logoutCurrentSession() {
  if (state.sessionRole === "admin") {
    try {
      const token = getAdminToken();
      if (token) {
        await postToBackend({
          action: "adminLogout",
          token: token
        });
      }
    } catch (_error) {
      // Best-effort logout; local state is cleared regardless.
    }
    setAdminToken("");
  }
  clearEmployeeSession();
  setStoredPortalRole("");
  state.sessionRole = "";
  state.employeeBinding = null;
  updateVisibleTabs("");
  updateTopbar();
  if (ui.loginForm) {
    ui.loginForm.reset();
  }
  if (state.activeRoleTab === "admin") {
    updateUrlForLogin("admin");
    showPortalLogin("admin", { status: "已登出" });
    return;
  }
  updateUrlForLogin("employee");
  showPortalLogin("employee", { status: "已登出" });
}

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function initServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (_error) {
    if (state.sessionRole === "admin") {
      setAdminStatus("Service Worker 註冊失敗");
      return;
    }
    setPortalStatus("Service Worker 註冊失敗");
  }
}

function bindEvents() {
  if (ui.copyDeviceIdBtn) {
    ui.copyDeviceIdBtn.addEventListener("click", async function () {
      const deviceId = getOrCreateDeviceUUID();
      try {
        await navigator.clipboard.writeText(deviceId);
        ui.deviceIdCopyStatus.textContent = "Device ID 已複製，可傳給管理員。";
      } catch (_error) {
        ui.deviceIdCopyStatus.textContent = "無法自動複製，請長按上方 Device ID 手動複製。";
      }
    });
  }

  if (ui.temporaryAdminResetForm) {
    ui.temporaryAdminResetForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const username = ui.temporaryAdminResetUsername.value.trim();
      const password = ui.temporaryAdminResetPassword.value;
      const confirmation = ui.temporaryAdminResetConfirm.value;
      if (!username) {
        setPortalResult("請輸入新的管理員帳號。", true);
        return;
      }
      if (password.length < 12) {
        setPortalResult("新密碼至少需要 12 個字元。", true);
        return;
      }
      if (password !== confirmation) {
        setPortalResult("兩次輸入的密碼不一致。", true);
        return;
      }

      ui.temporaryAdminResetBtn.disabled = true;
      setPortalStatus("正在重設管理員密碼...");
      setPortalResult("", false);
      try {
        await resetAdminPasswordTemporarily(username, password);
        ui.temporaryAdminResetForm.reset();
        if (ui.usernameInput) ui.usernameInput.value = username;
        setPortalStatus("管理員密碼已重設");
        setPortalResult("請使用新帳號和新密碼登入。", false);
      } catch (error) {
        setPortalStatus("重設失敗");
        setPortalResult(error.message || "未知錯誤", true);
      } finally {
        ui.temporaryAdminResetBtn.disabled = false;
      }
    });
  }

  if (ui.employeeRoleTab) {
    ui.employeeRoleTab.addEventListener("click", function () {
      updateUrlForLogin("employee");
      showPortalLogin("employee", {
        status: "請先以已綁定裝置登入"
      });
    });
  }

  if (ui.adminRoleTab) {
    ui.adminRoleTab.addEventListener("click", function () {
      updateUrlForLogin("admin");
      showPortalLogin("admin", {
        status: "請先登入管理者帳號"
      });
    });
  }

  if (ui.employeeLoginBtn) {
    ui.employeeLoginBtn.addEventListener("click", handleEmployeeLogin);
  }

  if (ui.employeeForm) {
    ui.employeeForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        setAdminStatus("儲存員工中...");
        await saveEmployee();
        setAdminStatus("員工帳號已更新");
        setAdminResult("員工帳號已儲存", false);
      } catch (error) {
        setAdminStatus("儲存失敗");
        setAdminResult(error.message || "未知錯誤", true);
      }
    });
  }
  if (ui.cancelEmployeeBtn) ui.cancelEmployeeBtn.addEventListener("click", resetEmployeeForm);
  if (ui.reloadEmployeesBtn) ui.reloadEmployeesBtn.addEventListener("click", async function () {
    try {
      setAdminStatus("讀取員工帳號中...");
      await loadEmployees();
      setAdminStatus("員工帳號已更新");
      setAdminResult("", false);
    } catch (error) {
      setAdminStatus("讀取失敗");
      setAdminResult(error.message || "未知錯誤", true);
    }
  });

  if (ui.loginForm) {
    ui.loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setAdminLoginBusy(true);
      setPortalStatus("登入管理後台中...");
      setPortalResult("", false);
      try {
        const data = await loginAdmin(
          ui.usernameInput ? ui.usernameInput.value.trim() : "",
          ui.passwordInput ? ui.passwordInput.value : ""
        );
        if (ui.passwordInput) {
          ui.passwordInput.value = "";
        }
        state.adminView = getAdminView();
        await enterAdminPortal();
        setAdminResult("Session 到期：" + (data.expiresAt || "未知"), false);
      } catch (error) {
        showPortalLogin("admin", {
          status: "登入失敗",
          result: error.message || "未知錯誤",
          isError: true
        });
      } finally {
        setAdminLoginBusy(false);
      }
    });
  }

  if (ui.logoutBtn) {
    ui.logoutBtn.addEventListener("click", function () {
      logoutCurrentSession();
    });
  }

  if (ui.punchBtn) {
    ui.punchBtn.addEventListener("click", handlePunch);
  }

  if (ui.leaveBtn) {
    ui.leaveBtn.addEventListener("click", handleLeaveSubmit);
  }

  if (ui.empCalPrev) {
    ui.empCalPrev.addEventListener("click", function () {
      empCalMonth -= 1;
      if (empCalMonth < 1) {
        empCalMonth = 12;
        empCalYear -= 1;
      }
      if (ui.empCalYearSel) ui.empCalYearSel.value = empCalYear;
      if (ui.empCalMonthSel) ui.empCalMonthSel.value = empCalMonth;
      loadEmployeeCalendar();
    });
  }

  if (ui.empCalNext) {
    ui.empCalNext.addEventListener("click", function () {
      empCalMonth += 1;
      if (empCalMonth > 12) {
        empCalMonth = 1;
        empCalYear += 1;
      }
      if (ui.empCalYearSel) ui.empCalYearSel.value = empCalYear;
      if (ui.empCalMonthSel) ui.empCalMonthSel.value = empCalMonth;
      loadEmployeeCalendar();
    });
  }

  if (ui.empCalYearSel) {
    ui.empCalYearSel.addEventListener("change", function () {
      empCalYear = Number(ui.empCalYearSel.value);
      loadEmployeeCalendar();
    });
  }

  if (ui.empCalMonthSel) {
    ui.empCalMonthSel.addEventListener("change", function () {
      empCalMonth = Number(ui.empCalMonthSel.value);
      loadEmployeeCalendar();
    });
  }

  if (ui.configForm) {
    ui.configForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        setAdminStatus("儲存設定中...");
        await saveConfig();
        setAdminStatus("設定已更新");
        setAdminResult("設定更新成功", false);
      } catch (error) {
        setAdminStatus("儲存失敗");
        setAdminResult(error.message || "未知錯誤", true);
      }
    });
  }

  if (ui.reloadLogsBtn) {
    ui.reloadLogsBtn.addEventListener("click", async function () {
      try {
        setAdminStatus("載入打卡紀錄中...");
        await loadLogs();
        setAdminStatus("打卡紀錄已更新");
        setAdminResult("", false);
      } catch (error) {
        setAdminStatus("載入失敗");
        setAdminResult(error.message || "未知錯誤", true);
      }
    });
  }

  if (ui.limitSelect) {
    ui.limitSelect.addEventListener("change", async function () {
      try {
        setAdminStatus("載入打卡紀錄中...");
        await loadLogs();
        setAdminStatus("打卡紀錄已更新");
        setAdminResult("", false);
      } catch (error) {
        setAdminStatus("載入失敗");
        setAdminResult(error.message || "未知錯誤", true);
      }
    });
  }

  if (ui.reloadLeaveBtn) {
    ui.reloadLeaveBtn.addEventListener("click", async function () {
      try {
        setAdminStatus("載入請假申請中...");
        await loadLeaveRequests();
        setAdminStatus("請假申請已更新");
        setAdminResult("", false);
      } catch (error) {
        setAdminStatus("載入失敗");
        setAdminResult(error.message || "未知錯誤", true);
      }
    });
  }

  if (ui.leaveStatusSelect) {
    ui.leaveStatusSelect.addEventListener("change", async function () {
      try {
        setAdminStatus("載入請假申請中...");
        await loadLeaveRequests();
        setAdminStatus("請假申請已更新");
        setAdminResult("", false);
      } catch (error) {
        setAdminStatus("載入失敗");
        setAdminResult(error.message || "未知錯誤", true);
      }
    });
  }

  if (ui.adminCalPrev) {
    ui.adminCalPrev.addEventListener("click", async function () {
      adminCalMonth -= 1;
      if (adminCalMonth < 1) {
        adminCalMonth = 12;
        adminCalYear -= 1;
      }
      if (ui.adminCalYearSel) ui.adminCalYearSel.value = adminCalYear;
      if (ui.adminCalMonthSel) ui.adminCalMonthSel.value = adminCalMonth;
      await loadAdminCalendar();
    });
  }

  if (ui.adminCalNext) {
    ui.adminCalNext.addEventListener("click", async function () {
      adminCalMonth += 1;
      if (adminCalMonth > 12) {
        adminCalMonth = 1;
        adminCalYear += 1;
      }
      if (ui.adminCalYearSel) ui.adminCalYearSel.value = adminCalYear;
      if (ui.adminCalMonthSel) ui.adminCalMonthSel.value = adminCalMonth;
      await loadAdminCalendar();
    });
  }

  if (ui.adminCalYearSel) {
    ui.adminCalYearSel.addEventListener("change", async function () {
      adminCalYear = Number(ui.adminCalYearSel.value);
      await loadAdminCalendar();
    });
  }

  if (ui.adminCalMonthSel) {
    ui.adminCalMonthSel.addEventListener("change", async function () {
      adminCalMonth = Number(ui.adminCalMonthSel.value);
      await loadAdminCalendar();
    });
  }
}

async function restoreSessionFromStorage() {
  const requestedRole = getRequestedRole();
  const storedRole = getStoredPortalRole();

  if (requestedRole === "admin" || (storedRole === "admin" && getAdminToken())) {
    state.adminView = getAdminView();
    if (getAdminToken()) {
      const entered = await enterAdminPortal();
      if (entered) {
        return true;
      }
    }
    showPortalLogin("admin", {
      status: "請先登入管理者帳號"
    });
    return false;
  }

  const employeeSession = getEmployeeSession();
  if (storedRole === "employee" && employeeSession) {
    try {
      const binding = await resolveEmployeeSession();
      if (binding.isRegistered) {
        enterEmployeePortal(binding);
        return true;
      }
    } catch (_error) {
      // Fall through to login portal and clear stale session.
    }
    clearEmployeeSession();
    setStoredPortalRole("");
  }

  showPortalLogin("employee", {
    status: "請先以已綁定裝置登入",
  });
  return false;
}

async function bootstrap() {
  if (ui.deviceIdValue) ui.deviceIdValue.textContent = getOrCreateDeviceUUID();
  if (!CONFIG.GAS_WEB_APP_URL) {
    setPortalResult("請先設定 web/config.js 的 GAS_WEB_APP_URL", true);
  }

  bindEvents();
  initInstallEntry();
  initEmpCalSelects(empCalYear, empCalMonth);
  await initServiceWorker();

  if (CONFIG.GAS_WEB_APP_URL) {
    try {
      await fetchPublicConfig();
    } catch (error) {
      setPortalStatus("公開設定載入失敗");
      setPortalResult(error.message || "未知錯誤", true);
    }
  }

  await restoreSessionFromStorage();
}

bootstrap();
