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
    throw new Error("Set GAS_WEB_APP_URL in web/config.js first");
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
    throw new Error("Invalid response from server");
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Request failed");
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
  if (ui.leaveSheetNameInput) {
    ui.leaveSheetNameInput.value = config.leaveSheetName || "";
  }
}

function renderLogs(logs) {
  if (!logs.length) {
    ui.logsBody.innerHTML = '<tr><td colspan="7">No records found</td></tr>';
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
  setStatus("Signing in...");
  const data = await postApi({
    action: "adminLogin",
    username: username,
    password: password
  });
  setToken(data.token);
  setStatus("Signed in");
  setResult(`Session expires: ${data.expiresAt}`);
}

async function logout() {
  const token = getToken();
  if (token) {
    await postApi({ action: "adminLogout", token: token });
  }
  setToken("");
  showDashboard(false);
  ui.loginForm.reset();
  setStatus("Signed out");
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
    maxGpsAccuracyMeters: Number(ui.maxGpsInput.value),
    leaveSheetName: ui.leaveSheetNameInput ? ui.leaveSheetNameInput.value.trim() : ""
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

async function loadLeaveRequests() {
  const token = getToken();
  const status = ui.leaveStatusSelect ? ui.leaveStatusSelect.value : "pending";
  const data = await postApi({ action: "adminGetLeaveRequests", token: token, status: status, limit: 100 });
  renderLeaveTable(data.leaves || []);
}

function renderLeaveTable(leaves) {
  if (!ui.leaveBody) return;
  if (!leaves.length) {
    ui.leaveBody.innerHTML = '<tr><td colspan="9">No records found</td></tr>';
    return;
  }
  const statusLabels = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
  ui.leaveBody.innerHTML = leaves
    .map((item) => {
      const statusLabel = statusLabels[item.status] || escapeHtml(item.status);
      const actionCell =
        item.status === "pending"
          ? `<button class="ghost-btn" onclick="handleLeaveAction('${escapeHtml(item.requestId)}','approved')">Approve</button>
             <button class="ghost-btn" onclick="handleLeaveAction('${escapeHtml(item.requestId)}','rejected')">Reject</button>`
          : statusLabel;
      const shortId = escapeHtml(item.requestId).slice(0, 8) + "…";
      return `<tr>
        <td title="${escapeHtml(item.requestId)}">${shortId}</td>
        <td>${escapeHtml(item.employeeName)}</td>
        <td>${escapeHtml(item.leaveType)}</td>
        <td>${escapeHtml(item.startDate)}</td>
        <td>${escapeHtml(item.endDate)}</td>
        <td>${escapeHtml(item.reason)}</td>
        <td>${statusLabel}</td>
        <td>${escapeHtml(item.submittedAt)}</td>
        <td>${actionCell}</td>
      </tr>`;
    })
    .join("");
}

let adminCalYear = new Date().getFullYear();
let adminCalMonth = new Date().getMonth() + 1;

function initCalSelects(yearEl, monthEl, year, month) {
  if (!yearEl || !monthEl) return;
  const curYear = new Date().getFullYear();
  yearEl.innerHTML = "";
  for (let y = curYear - 5; y <= curYear + 5; y += 1) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = String(y);
    if (y === year) opt.selected = true;
    yearEl.appendChild(opt);
  }
  monthEl.innerHTML = "";
  for (let m = 1; m <= 12; m += 1) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2000, m - 1, 1));
    if (m === month) opt.selected = true;
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

  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const startOffset = (firstDow + 6) % 7; // Mon=0 … Sun=6
  const daysInMonth = new Date(year, month, 0).getDate();

  const HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let html = '<div class="cal-grid">';
  HEADERS.forEach(function (h) {
    html += '<div class="cal-header-cell">' + h + "</div>";
  });
  for (let i = 0; i < startOffset; i += 1) {
    html += '<div class="cal-day empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateStr =
      year +
      "-" +
      String(month).padStart(2, "0") +
      "-" +
      String(d).padStart(2, "0");
    const isToday = dateStr === todayStr;
    html += '<div class="cal-day' + (isToday ? " today" : "") + '">';
    html += '<div class="cal-day-num">' + d + "</div>";
    html += dayContentFn(dateStr);
    html += "</div>";
  }
  html += "</div>";
  return html;
}

async function loadAdminCalendar() {
  if (!ui.adminCalWrap) return;
  try {
    setStatus("Loading calendar...");
    const token = getToken();
    const data = await postApi({
      action: "adminGetCalendar",
      token: token,
      year: adminCalYear,
      month: adminCalMonth
    });
    const leavesByDate = data.leavesByDate || {};
    ui.adminCalWrap.innerHTML = buildCalendarHtml(
      adminCalYear,
      adminCalMonth,
      function (dateStr) {
        const names = leavesByDate[dateStr] || [];
        return names
          .map(function (n) {
            return '<span class="cal-leave-badge">' + escapeHtml(n) + "</span>";
          })
          .join("");
      }
    );
    setStatus("Calendar updated");
    setResult("");
  } catch (error) {
    setStatus("Could not load calendar");
    setResult(error.message || "Unknown error", true);
  }
}

async function handleLeaveAction(requestId, status) {
  try {
    setStatus(status === "approved" ? "Approving..." : "Rejecting...");
    const token = getToken();
    await postApi({ action: "adminUpdateLeaveStatus", token: token, requestId: requestId, status: status });
    setStatus(status === "approved" ? "Approved" : "Rejected");
    setResult("");
    await loadLeaveRequests();
  } catch (error) {
    setStatus("Action failed");
    setResult(error.message || "Unknown error", true);
  }
}

async function enterDashboard() {
  try {
    showDashboard(true);
    initCalSelects(ui.adminCalYearSel, ui.adminCalMonthSel, adminCalYear, adminCalMonth);
    setStatus("Loading settings...");
    await loadConfig();
    setStatus("Loading attendance records...");
    await loadLogs();
    setStatus("Loading leave requests...");
    await loadLeaveRequests();
    setStatus("Loading calendar...");
    await loadAdminCalendar();
    setStatus("Admin dashboard ready");
    setResult("");
  } catch (error) {
    setToken("");
    showDashboard(false);
    setStatus("Sign-in failed");
    setResult(error.message || "Unknown error", true);
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
      setStatus("Sign-in failed");
      setResult(error.message || "Unknown error", true);
    }
  });

  ui.logoutBtn.addEventListener("click", async () => {
    try {
      await logout();
    } catch (error) {
      setStatus("Sign-out failed");
      setResult(error.message || "Unknown error", true);
    }
  });

  ui.configForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      setStatus("Saving settings...");
      await saveConfig();
      setStatus("Settings updated");
      setResult("Settings saved");
    } catch (error) {
      setStatus("Could not save settings");
      setResult(error.message || "Unknown error", true);
    }
  });

  ui.reloadLogsBtn.addEventListener("click", async () => {
    try {
      setStatus("Loading attendance records...");
      await loadLogs();
      setStatus("Attendance records updated");
      setResult("");
    } catch (error) {
      setStatus("Could not load data");
      setResult(error.message || "Unknown error", true);
    }
  });

  ui.limitSelect.addEventListener("change", async () => {
    try {
      setStatus("Loading attendance records...");
      await loadLogs();
      setStatus("Attendance records updated");
      setResult("");
    } catch (error) {
      setStatus("Could not load data");
      setResult(error.message || "Unknown error", true);
    }
  });

  if (ui.reloadLeaveBtn) {
    ui.reloadLeaveBtn.addEventListener("click", async () => {
      try {
        setStatus("Loading leave requests...");
        await loadLeaveRequests();
        setStatus("Leave requests updated");
        setResult("");
      } catch (error) {
        setStatus("Could not load data");
        setResult(error.message || "Unknown error", true);
      }
    });
  }

  if (ui.leaveStatusSelect) {
    ui.leaveStatusSelect.addEventListener("change", async () => {
      try {
        setStatus("Loading leave requests...");
        await loadLeaveRequests();
        setStatus("Leave requests updated");
        setResult("");
      } catch (error) {
        setStatus("Could not load data");
        setResult(error.message || "Unknown error", true);
      }
    });
  }

  if (ui.adminCalPrev) {
    ui.adminCalPrev.addEventListener("click", async () => {
      adminCalMonth -= 1;
      if (adminCalMonth < 1) { adminCalMonth = 12; adminCalYear -= 1; }
      if (ui.adminCalYearSel) ui.adminCalYearSel.value = adminCalYear;
      if (ui.adminCalMonthSel) ui.adminCalMonthSel.value = adminCalMonth;
      await loadAdminCalendar();
    });
  }

  if (ui.adminCalNext) {
    ui.adminCalNext.addEventListener("click", async () => {
      adminCalMonth += 1;
      if (adminCalMonth > 12) { adminCalMonth = 1; adminCalYear += 1; }
      if (ui.adminCalYearSel) ui.adminCalYearSel.value = adminCalYear;
      if (ui.adminCalMonthSel) ui.adminCalMonthSel.value = adminCalMonth;
      await loadAdminCalendar();
    });
  }

  if (ui.adminCalYearSel) {
    ui.adminCalYearSel.addEventListener("change", async () => {
      adminCalYear = Number(ui.adminCalYearSel.value);
      await loadAdminCalendar();
    });
  }

  if (ui.adminCalMonthSel) {
    ui.adminCalMonthSel.addEventListener("change", async () => {
      adminCalMonth = Number(ui.adminCalMonthSel.value);
      await loadAdminCalendar();
    });
  }
}

async function bootstrap() {
  bindEvents();
  const token = getToken();
  if (token) {
    await enterDashboard();
    return;
  }
  showDashboard(false);
  setStatus("Sign in as an administrator");
}

bootstrap();
