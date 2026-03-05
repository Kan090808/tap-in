const BASE_CONFIG = window.TAPIN_CONFIG || {};

const CONFIG = {
  GAS_WEB_APP_URL: BASE_CONFIG.GAS_WEB_APP_URL || ""
};

const STORAGE_KEYS = {
  adminToken: "tapin_admin_token"
};

const ui = {
  loginPanel: document.getElementById("login-panel"),
  dashboardPanel: document.getElementById("dashboard-panel"),
  loginForm: document.getElementById("login-form"),
  usernameInput: document.getElementById("username-input"),
  passwordInput: document.getElementById("password-input"),
  logoutBtn: document.getElementById("logout-btn"),
  configForm: document.getElementById("config-form"),
  spreadsheetIdInput: document.getElementById("spreadsheet-id-input"),
  officeIpInput: document.getElementById("office-ip-input"),
  logSheetNameInput: document.getElementById("log-sheet-name-input"),
  bindingSheetNameInput: document.getElementById("binding-sheet-name-input"),
  maxGpsInput: document.getElementById("max-gps-input"),
  reloadLogsBtn: document.getElementById("reload-logs-btn"),
  limitSelect: document.getElementById("limit-select"),
  logsBody: document.getElementById("logs-body"),
  statusText: document.getElementById("admin-status"),
  resultText: document.getElementById("admin-result")
};

function getToken() {
  return sessionStorage.getItem(STORAGE_KEYS.adminToken) || "";
}

function setToken(token) {
  if (!token) {
    sessionStorage.removeItem(STORAGE_KEYS.adminToken);
    return;
  }
  sessionStorage.setItem(STORAGE_KEYS.adminToken, token);
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

function ensureBackendConfigured() {
  if (!CONFIG.GAS_WEB_APP_URL) {
    throw new Error("請先在 web/config.js 設定 GAS_WEB_APP_URL");
  }
}

async function postApi(payload) {
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

function showDashboard(isLoggedIn) {
  ui.loginPanel.hidden = isLoggedIn;
  ui.dashboardPanel.hidden = !isLoggedIn;
}

function fillConfig(config) {
  ui.spreadsheetIdInput.value = config.spreadsheetId || "";
  ui.officeIpInput.value = config.officeStaticIp || "";
  ui.logSheetNameInput.value = config.logSheetName || "";
  ui.bindingSheetNameInput.value = config.bindingSheetName || "";
  ui.maxGpsInput.value = config.maxGpsAccuracyMeters || "";
}

function renderLogs(logs) {
  if (!logs.length) {
    ui.logsBody.innerHTML = '<tr><td colspan="7">目前沒有資料</td></tr>';
    return;
  }
  ui.logsBody.innerHTML = logs
    .map((item) => {
      return `<tr>
        <td>${escapeHtml(item.timestamp)}</td>
        <td>${escapeHtml(item.employeeName)}</td>
        <td>${escapeHtml(item.deviceUUID)}</td>
        <td>${escapeHtml(item.ipAddress)}</td>
        <td>${escapeHtml(item.locationStatus)}</td>
        <td>${escapeHtml(item.latitude)}</td>
        <td>${escapeHtml(item.longitude)}</td>
      </tr>`;
    })
    .join("");
}

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function login(username, password) {
  setStatus("登入中...");
  const data = await postApi({
    action: "adminLogin",
    username: username,
    password: password
  });
  setToken(data.token);
  setStatus("登入成功");
  setResult(`Session 到期：${data.expiresAt}`);
}

async function logout() {
  const token = getToken();
  if (token) {
    await postApi({ action: "adminLogout", token: token });
  }
  setToken("");
  showDashboard(false);
  ui.loginForm.reset();
  setStatus("已登出");
  setResult("");
}

async function loadConfig() {
  const token = getToken();
  const data = await postApi({ action: "adminGetConfig", token: token });
  fillConfig(data.config);
}

async function saveConfig() {
  const token = getToken();
  const payload = {
    action: "adminUpdateConfig",
    token: token,
    spreadsheetId: ui.spreadsheetIdInput.value.trim(),
    officeStaticIp: ui.officeIpInput.value.trim(),
    logSheetName: ui.logSheetNameInput.value.trim(),
    bindingSheetName: ui.bindingSheetNameInput.value.trim(),
    maxGpsAccuracyMeters: Number(ui.maxGpsInput.value)
  };
  const data = await postApi(payload);
  fillConfig(data.config);
}

async function loadLogs() {
  const token = getToken();
  const limit = Number(ui.limitSelect.value || "50");
  const data = await postApi({ action: "adminGetLogs", token: token, limit: limit });
  renderLogs(data.logs || []);
}

async function enterDashboard() {
  try {
    showDashboard(true);
    setStatus("讀取設定中...");
    await loadConfig();
    setStatus("讀取打卡紀錄中...");
    await loadLogs();
    setStatus("管理頁已就緒");
    setResult("");
  } catch (error) {
    setToken("");
    showDashboard(false);
    setStatus("登入失敗");
    setResult(error.message || "未知錯誤", true);
  }
}

function bindEvents() {
  ui.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await login(ui.usernameInput.value.trim(), ui.passwordInput.value);
      ui.passwordInput.value = "";
      await enterDashboard();
    } catch (error) {
      setStatus("登入失敗");
      setResult(error.message || "未知錯誤", true);
    }
  });

  ui.logoutBtn.addEventListener("click", async () => {
    try {
      await logout();
    } catch (error) {
      setStatus("登出失敗");
      setResult(error.message || "未知錯誤", true);
    }
  });

  ui.configForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      setStatus("儲存設定中...");
      await saveConfig();
      setStatus("設定已更新");
      setResult("設定更新成功");
    } catch (error) {
      setStatus("儲存失敗");
      setResult(error.message || "未知錯誤", true);
    }
  });

  ui.reloadLogsBtn.addEventListener("click", async () => {
    try {
      setStatus("載入打卡紀錄中...");
      await loadLogs();
      setStatus("打卡紀錄已更新");
      setResult("");
    } catch (error) {
      setStatus("載入失敗");
      setResult(error.message || "未知錯誤", true);
    }
  });

  ui.limitSelect.addEventListener("change", async () => {
    try {
      setStatus("載入打卡紀錄中...");
      await loadLogs();
      setStatus("打卡紀錄已更新");
      setResult("");
    } catch (error) {
      setStatus("載入失敗");
      setResult(error.message || "未知錯誤", true);
    }
  });
}

async function bootstrap() {
  bindEvents();
  const token = getToken();
  if (token) {
    await enterDashboard();
    return;
  }
  showDashboard(false);
  setStatus("請先登入管理者帳號");
}

bootstrap();
