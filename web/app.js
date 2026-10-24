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

const EMPLOYEE_MODES = ["punch", "leave", "calendar", "correction"];
const ADMIN_VIEWS = ["employees", "config", "logs", "leaves", "calendar", "schedules", "corrections", "payroll"];

const state = {
  officeStaticIp: CONFIG.DEFAULT_OFFICE_STATIC_IP,
  maxGpsAccuracyMeters: CONFIG.MAX_GPS_ACCURACY_METERS,
  deferredInstallPrompt: null,
  activeRoleTab: getRequestedRole(),
  sessionRole: "",
  employeeBinding: null,
  visibleFunctionTabs: [],
  employeeMode: getEmployeeMode(),
  adminView: getAdminView(),
  punchBusy: false,
  leaveRows: [],
  leaveCursor: "",
  leaveQuery: 0,
  backendApiVersion: 0
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
  employeeShell: document.getElementById("employee-shell"),
  modePunchLink: document.getElementById("mode-punch-link"),
  modeLeaveLink: document.getElementById("mode-leave-link"),
  modeCalendarLink: document.getElementById("mode-calendar-link"),
  modeCorrectionLink: document.getElementById("mode-correction-link"),
  nameText: document.getElementById("name-text"),
  deviceText: document.getElementById("device-text"),
  punchBtn: document.getElementById("punch-btn"),
  punchOutBtn: document.getElementById("punch-out-btn"),
  quickPunch: document.getElementById("quick-punch"),
  quickInBtn: document.getElementById("quick-in-btn"),
  quickOutBtn: document.getElementById("quick-out-btn"),
  quickStatus: document.getElementById("quick-status"),
  quickResult: document.getElementById("quick-result"),
  leaveArea: document.getElementById("leave-area"),
  leaveTypeSelect: document.getElementById("leave-type"),
  leaveStartInput: document.getElementById("leave-start"),
  leaveEndInput: document.getElementById("leave-end"),
  leaveReasonTextarea: document.getElementById("leave-reason"),
  leaveBtn: document.getElementById("leave-btn"),
  leaveDuration: document.getElementById("leave-duration"),
  leaveProof: document.getElementById("leave-proof"),
  employeeLeaveHistory: document.getElementById("employee-leave-history"),
  correctionArea: document.getElementById("correction-area"),
  correctionForm: document.getElementById("correction-form"),
  employeeCorrectionHistory: document.getElementById("employee-correction-history"),
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
  employeeScheduleInput: document.getElementById("employee-schedule-input"),
  employeeSalaryInput: document.getElementById("employee-salary-input"),
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
Object.assign(ui, {
  adminViewSchedulesLink: document.getElementById("admin-view-schedules-link"),
  adminViewCorrectionsLink: document.getElementById("admin-view-corrections-link"),
  adminViewPayrollLink: document.getElementById("admin-view-payroll-link"),
  adminSchedulesPanel: document.getElementById("admin-schedules-panel"),
  adminCorrectionsPanel: document.getElementById("admin-corrections-panel"),
  adminPayrollPanel: document.getElementById("admin-payroll-panel")
});

let empCalYear = new Date().getFullYear();
let empCalMonth = new Date().getMonth() + 1;
let adminCalYear = new Date().getFullYear();
let adminCalMonth = new Date().getMonth() + 1;
let employees = [];
let scheduleGroups = [];

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
  const view = (new URL(window.location.href).searchParams.get("view") || "leaves").trim().toLowerCase();
  return ADMIN_VIEWS.indexOf(view) >= 0 ? view : "leaves";
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
    ui.punchBtn.disabled = isBusy || state.punchBusy;
    ui.punchBtn.textContent = isBusy ? "Working..." : "Clock in";
  }
  if (ui.leaveBtn) {
    ui.leaveBtn.disabled = isBusy;
    ui.leaveBtn.textContent = isBusy ? "Working..." : "Submit leave request";
  }
}

function setAdminLoginBusy(isBusy) {
  if (!ui.loginBtn) {
    return;
  }
  ui.loginBtn.disabled = isBusy;
  ui.loginBtn.textContent = isBusy ? "Signing in..." : "Sign in as admin";
}

function ensureBackendConfigured() {
  if (!CONFIG.GAS_WEB_APP_URL) {
    throw new Error("Set GAS_WEB_APP_URL in web/config.js first");
  }
}

async function postToBackend(payload) {
  ensureBackendConfigured();
  if (state.backendApiVersion < 2) {
    const error = new Error("Backend update required. Ask your administrator to deploy and verify API version 2 before using this app.");
    error.preSubmission = true;
    throw error;
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
    throw new Error("Invalid server response");
  }
  if (!response.ok || !data.ok) {
    const error = new Error(data.message || "Request failed");
    error.backendRejected = data.ok === false;
    throw error;
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
    throw new Error("Invalid server response");
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Server request failed");
  }
  return data;
}

async function fetchPublicConfig() {
  if (!CONFIG.GAS_WEB_APP_URL) {
    return;
  }
  const data = await getFromBackend("publicConfig");
  state.backendApiVersion = Number(data.apiVersion || (data.config && data.config.apiVersion) || 0);
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
    throw new Error("Could not get server time");
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
  if (ui.modeCorrectionLink) {
    ui.modeCorrectionLink.classList.toggle("active", mode === "correction");
    ui.modeCorrectionLink.setAttribute("aria-current", mode === "correction" ? "page" : "false");
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
  [[ui.adminViewSchedulesLink, "schedules"], [ui.adminViewCorrectionsLink, "corrections"], [ui.adminViewPayrollLink, "payroll"]].forEach(function (entry) {
    if (!entry[0]) return;
    entry[0].classList.toggle("active", view === entry[1]);
    entry[0].setAttribute("aria-current", view === entry[1] ? "page" : "false");
  });
}

function updateTopbar() {
  const isAuthenticated = Boolean(state.sessionRole);
  if (ui.roleBadge) {
    ui.roleBadge.hidden = !isAuthenticated;
    ui.roleBadge.textContent = state.sessionRole === "admin" ? "Admin" : "Employee";
  }
  if (ui.logoutBtn) {
    ui.logoutBtn.hidden = !isAuthenticated;
  }
  if (ui.portalApp) {
    ui.portalApp.classList.toggle("is-admin", state.sessionRole === "admin");
  }
  if (ui.quickPunch) ui.quickPunch.hidden = state.sessionRole === "admin";
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
  setPortalStatus(settings.status || (nextRole === "admin" ? "Sign in as an admin" : "Sign in with a registered device"));
  setPortalResult(settings.result || "", Boolean(settings.isError));
  updateTopbar();
}

function renderEmployeeShell() {
  const mode = EMPLOYEE_MODES.indexOf(state.employeeMode) >= 0 ? state.employeeMode : "punch";
  setEmployeeModeActive(mode);

  if (ui.punchBtn) {
    ui.punchBtn.hidden = mode !== "punch";
  }
  if (ui.punchOutBtn) ui.punchOutBtn.hidden = mode !== "punch";
  if (ui.leaveArea) {
    ui.leaveArea.hidden = mode !== "leave";
  }
  if (ui.calendarArea) {
    ui.calendarArea.hidden = mode !== "calendar";
  }
  if (ui.correctionArea) ui.correctionArea.hidden = mode !== "correction";

  if (mode === "punch") {
    setEmployeeStatus("Ready");
  } else if (mode === "leave") {
    setEmployeeStatus("Complete the leave form to submit a request");
  } else if (mode === "calendar") {
    setEmployeeStatus("Loading your calendar...");
    loadEmployeeCalendar();
  } else if (mode === "correction") {
    setEmployeeStatus("Request a missed punch");
    void loadEmployeeCorrections();
  }
  if (mode === "leave") void loadEmployeeLeaves();
}

function renderAdminShell() {
  const view = ADMIN_VIEWS.indexOf(state.adminView) >= 0 ? state.adminView : "leaves";
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
  if (ui.adminSchedulesPanel) ui.adminSchedulesPanel.hidden = view !== "schedules";
  if (ui.adminCorrectionsPanel) ui.adminCorrectionsPanel.hidden = view !== "corrections";
  if (ui.adminPayrollPanel) ui.adminPayrollPanel.hidden = view !== "payroll";
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
    ui.nameText.textContent = binding.employeeName || "Identified automatically";
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

  const loading = document.getElementById("portal-loading");
  if (loading) loading.hidden = true;
  updateUrlForAdminView(state.adminView);
  return loadAdminView(state.adminView);
}

async function loadAdminView(view) {
  const loaders = {
    employees: loadEmployees,
    config: loadConfig,
    logs: loadLogs,
    leaves: loadLeaveRequests,
    calendar: function () { return loadAdminCalendar(true); }
    ,schedules: loadSchedules,
    corrections: loadAdminCorrections,
    payroll: loadPayroll
  };
  const token = getAdminToken();
  setAdminStatus("Loading " + view + "...");
  setAdminResult("", false);
  try {
    await loaders[view]();
    if (state.sessionRole === "admin" && state.adminView === view && getAdminToken() === token) {
    setAdminStatus("Up to date");
      setAdminResult("", false);
    }
    return true;
  } catch (error) {
    // Ignore responses from a session that has since been replaced or signed out.
    if (state.sessionRole !== "admin" || getAdminToken() !== token) return false;
    const message = error.message || "Unknown error";
    if (message === "Admin session expired" || message === "Admin token is required") {
      setAdminToken("");
      setStoredPortalRole("");
      showPortalLogin("admin", {
        status: "Admin session expired", result: message, isError: true
      });
      return false;
    }
    if (state.adminView === view) {
      setAdminStatus("Could not load " + view);
      setAdminResult(message, true);
    }
    return true;
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
    setInstallHint("On iOS, tap Share, then Add to Home Screen");
    ui.installBtn.addEventListener("click", function () {
      setInstallHint("In Safari, tap Share, then Add to Home Screen");
    });
    return;
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    ui.installBtn.hidden = false;
    ui.installBtn.disabled = false;
    setInstallHint("Add TapIn to your Home Screen for quick access");
  });

  window.addEventListener("appinstalled", function () {
    state.deferredInstallPrompt = null;
    hideInstallEntry();
    if (state.sessionRole === "admin") {
      setAdminStatus("Added to Home Screen");
      return;
    }
    if (state.sessionRole === "employee") {
      setEmployeeStatus("Added to Home Screen");
    }
  });

  ui.installBtn.addEventListener("click", async function () {
    if (!state.deferredInstallPrompt) {
      setInstallHint("This browser did not offer an install prompt. Try Chrome or Edge.");
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
    setInstallHint("Installation canceled. You can try again.");
  });
}

async function getPublicIP() {
  const endpoints = ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json"];
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, CONFIG.REQUEST_TIMEOUT_MS / endpoints.length);
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) throw new Error("IP service returned an error");
      const data = await response.json();
      if (!data || typeof data.ip !== "string" || !data.ip.trim()) throw new Error("Could not read your IP address");
      return data.ip.trim();
    } catch (_error) {
      // Retry only the read-only IP lookup, never the punch submission.
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Could not get your public IP address. No punch was submitted. Check your connection or switch networks, then try again.");
}

function getCurrentPosition() {
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      function () {
        reject(new Error("Could not get your location. Check location permissions."));
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
    throw new Error("Location accuracy is too low. Try again outdoors.");
  }
  if (accuracy > state.maxGpsAccuracyMeters) {
    throw new Error("Location accuracy is too low (" + Math.round(accuracy) + "m). Please try again.");
  }
}

function toFixedNumber(value) {
  return Number(Number(value).toFixed(7));
}

function formatNetworkTime(value) {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) {
    return String(value || "Unknown");
  }
  return time.toLocaleString("en-GB", { hour12: false });
}

function resolvePunchMessage(result) {
  const baseMessage = result.punchMessage
    ? result.punchMessage
    : result.employeeName
      ? result.employeeName + (result.punchType === "out" ? " clock-out successful" : " clock-in successful")
      : (result.punchType === "out" ? "Clock-out successful" : "Clock-in successful");
  if (result.serverTime) {
    return baseMessage + " (server time: " + formatNetworkTime(result.serverTime) + ")";
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
      body: "Clock-in completed",
      tag: "tapin-arrival"
    });
  }
}

async function handleEmployeeLogin() {
  setBusy(true);
  setPortalResult("", false);
  setPortalStatus("Checking device registration...");
  try {
    const binding = await resolveEmployeeSession();
    if (!binding.isRegistered) {
      clearEmployeeSession();
      setStoredPortalRole("");
      showPortalLogin("employee", {
        status: "This device is not registered",
        result: "Copy the device ID above and send it to your admin to create your account.",
        isError: true
      });
      return;
    }
    enterEmployeePortal(binding);
    setEmployeeResult("", false);
    setEmployeeStatus("Signed in");
    updateUrlForEmployeeMode(state.employeeMode);
  } catch (error) {
    showPortalLogin("employee", {
      status: "Employee sign-in failed",
      result: error.message || "Unknown error",
      isError: true
    });
  } finally {
    setBusy(false);
  }
}

async function submitPunch(payload, quick) {
  if (quick) ui.quickStatus.textContent = "Submitting punch...";
  else setEmployeeStatus("Submitting punch...");
  let result;
  try { result = await postToBackend(payload); }
  catch (error) { error.punchUnconfirmed = !error.backendRejected && !error.preSubmission; throw error; }
  if (quick) ui.quickStatus.textContent = "Punch complete";
  else setEmployeeStatus("Punch complete");
  if (ui.nameText) {
    ui.nameText.textContent = result.employeeName || "Identified automatically";
  }
  if (quick) setFeedback(ui.quickResult, resolvePunchMessage(result), false);
  else setEmployeeResult(resolvePunchMessage(result), false);
  if (state.employeeBinding) state.employeeBinding.lastPunchType = payload.punchType;
  if (payload.punchType === "in") {
    try { await maybeNotifyArrival(result.locationStatus); } catch (_error) { /* Optional notification cannot change a confirmed punch. */ }
  }
}

function setPunchBusy(busy) {
  state.punchBusy = busy;
  [ui.quickInBtn, ui.quickOutBtn, ui.punchBtn, ui.punchOutBtn].forEach(function (button) {
    if (button) button.disabled = busy;
  });
}

async function handlePunch(punchType, quick) {
  if (state.punchBusy || state.sessionRole === "admin") return;
  setPunchBusy(true);
  punchType = punchType === "out" ? "out" : "in";
  quick = quick === true;
  if (quick) {
    ui.quickInBtn.disabled = ui.quickOutBtn.disabled = true;
    setFeedback(ui.quickResult, "", false);
  } else { setBusy(true); setEmployeeResult("", false); }

  try {
    const deviceUUID = getOrCreateDeviceUUID();
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      throw new Error("Use HTTPS to clock in securely");
    }

    if (quick) ui.quickStatus.textContent = "Getting IP address and location...";
    else setEmployeeStatus("Getting IP address and location...");
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
      punchType: punchType,
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
    }, quick);
  } catch (error) {
    const status = error.punchUnconfirmed ? "Punch result unconfirmed" : "Punch failed";
    const message = error.punchUnconfirmed ? "The server response was lost. Check your calendar or ask your admin before trying again." : error.message || "An unknown error occurred";
    if (quick) { ui.quickStatus.textContent = status; setFeedback(ui.quickResult, message, true); }
    else { setEmployeeStatus(status); setEmployeeResult(message, true); }
  } finally {
    if (quick) ui.quickInBtn.disabled = ui.quickOutBtn.disabled = false;
    else setBusy(false);
    setPunchBusy(false);
  }
}

async function handleLeaveSubmit() {
  const deviceUUID = getOrCreateDeviceUUID();
  const leaveType = ui.leaveTypeSelect ? ui.leaveTypeSelect.value : "";
  const startDate = ui.leaveStartInput ? ui.leaveStartInput.value : "";
  const endDate = ui.leaveEndInput ? ui.leaveEndInput.value : "";
  const reason = ui.leaveReasonTextarea ? ui.leaveReasonTextarea.value.trim() : "";

  if (!leaveType) {
    setEmployeeResult("Select a leave type", true);
    return;
  }
  if (!startDate) {
    setEmployeeResult("Select a start date", true);
    return;
  }
  if (!endDate) {
    setEmployeeResult("Select an end date", true);
    return;
  }
  if (endDate < startDate) {
    setEmployeeResult("End date cannot be before start date", true);
    return;
  }
  if (!reason) {
    setEmployeeResult("Enter a reason for leave", true);
    return;
  }
  if (leaveType === "sick" && !(ui.leaveProof && ui.leaveProof.files.length)) {
    setEmployeeResult("Attach an image or PDF as sick leave proof", true);
    return;
  }

  setBusy(true);
  setEmployeeResult("", false);

  try {
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      throw new Error("Use HTTPS to submit a leave request securely");
    }
    const requestTimestamp = await fetchNetworkTimestamp();
    const proof = ui.leaveProof && ui.leaveProof.files[0];
    if (proof && !(["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(proof.type))) throw new Error("Proof must be a PNG, JPEG, WebP, or PDF");
    if (proof && proof.size > 5 * 1024 * 1024) throw new Error("Proof must be 5 MB or smaller");
    const evidenceDataUrl = proof ? await readFileDataUrl(proof) : "";
    const result = await postToBackend({
      action: "submitLeave",
      requestId: generateUUID(),
      requestTimestamp: requestTimestamp,
      deviceUUID: deviceUUID,
      leaveType: leaveType,
      dayPart: ui.leaveDuration ? ui.leaveDuration.value : "full",
      evidenceDataUrl: evidenceDataUrl,
      startDate: startDate,
      endDate: endDate,
      reason: reason
    });

    setEmployeeStatus("Submitted");
    setEmployeeResult((result.employeeName ? result.employeeName + " " : "") + "Leave request submitted for review", false);
    if (ui.leaveTypeSelect) ui.leaveTypeSelect.value = "";
    if (ui.leaveStartInput) ui.leaveStartInput.value = "";
    if (ui.leaveEndInput) ui.leaveEndInput.value = "";
    if (ui.leaveReasonTextarea) ui.leaveReasonTextarea.value = "";
    if (ui.leaveProof) ui.leaveProof.value = "";
    await loadEmployeeLeaves();
  } catch (error) {
    setEmployeeStatus("Submission failed");
    setEmployeeResult(error.message || "An unknown error occurred", true);
  } finally {
    setBusy(false);
  }
}
function readFileDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(String(reader.result || "")); };
    reader.onerror = function () { reject(new Error("Could not read proof file")); };
    reader.readAsDataURL(file);
  });
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
    opt.textContent = String(y);
    if (y === year) {
      opt.selected = true;
    }
    yearEl.appendChild(opt);
  }
  monthEl.innerHTML = "";
  for (let m = 1; m <= 12; m += 1) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2000, m - 1, 1));
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
  const headers = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    setEmployeeStatus("Loading calendar...");
    const data = await postToBackend({
      action: "employeeGetCalendar",
      deviceUUID: getOrCreateDeviceUUID(),
      year: empCalYear,
      month: empCalMonth
    });
    const punchesByDate = data.punchesByDate || {};
    const leavesByDate = data.leavesByDate || {};
    const locationLabel = { Office: "Office", office: "Office" };

    ui.empCalWrap.innerHTML = buildCalendarHtml(empCalYear, empCalMonth, function (dateStr) {
      let content = "";
      const punches = punchesByDate[dateStr] || [];
      punches.forEach(function (punch) {
        const label = locationLabel[punch.locationStatus] || "Remote";
        content += '<span class="cal-punch-item">' + escapeHtml(punch.time) + " " + escapeHtml(punch.punchType === "out" ? "Out" : "In") + " · " + (punch.corrected ? "Corrected" : label) + "</span>";
      });
      const leave = leavesByDate[dateStr];
      if (leave) {
        content += '<span class="cal-leave-badge">' + escapeHtml(getLeaveTypeLabel(leave.leaveType)) + "</span>";
      }
      return content;
    });
    setEmployeeStatus("Calendar updated");
    setEmployeeResult("", false);
  } catch (error) {
    setEmployeeStatus("Could not load calendar");
    setEmployeeResult(error.message || "Unknown error", true);
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

function parseSpreadsheetId(value) {
  const input = String(value || "").trim();
  if (/^[A-Za-z0-9_-]+$/.test(input)) return input;

  let url;
  try {
    url = new URL(/^docs\.google\.com\//i.test(input) ? "https://" + input : input);
  } catch (_error) {
    throw new Error("Enter a valid Google Sheets link or ID");
  }
  const match = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !match) {
    throw new Error("Enter a valid Google Sheets link or ID");
  }
  return match[1];
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
  ui.saveEmployeeBtn.textContent = "Add employee";
  ui.cancelEmployeeBtn.hidden = true;
  if (ui.employeeScheduleInput) ui.employeeScheduleInput.value = "";
  initializeTermsDates();
  const history = document.getElementById("employment-terms-history");
  if (history) history.replaceChildren();
  const correction = document.getElementById("historical-terms-form");
  if (correction) correction.hidden = true;
  const editor = document.getElementById("employee-editor");
  if (editor) editor.open = false;
  document.getElementById("employee-editor-title").textContent="Add employee";
  const historical = document.getElementById("historical-correction");
  if (historical) historical.hidden = true;
}

function openAdminEditor(id) {
  const editor = document.getElementById(id);
  if (!editor) return;
  editor.open = true;
  if (typeof editor.scrollIntoView === "function") editor.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function adminCell(row, label, value, className) {
  const cell = row.insertCell();
  cell.dataset.label = label;
  if (className) cell.className = className;
  if (value !== undefined) cell.textContent = value == null || value === "" ? "—" : String(value);
  return cell;
}

function statusBadge(status) {
  const labels = { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled", revoked: "Revoked", active: "Active", archived: "Archived" };
  const key = String(status || "").toLowerCase();
  return '<span class="status-badge status-' + (labels[key] ? key : "unknown") + '">' + escapeHtml(labels[key] || status || "Unknown") + '</span>';
}

function detailList(entries) {
  return '<dl class="record-meta">' + entries.map(function (entry) {
    return '<div><dt>' + escapeHtml(entry[0]) + '</dt><dd>' + escapeHtml(auditValue(entry[1])) + '</dd></div>';
  }).join("") + '</dl>';
}

function recordDetails(entries, actions) {
  return '<details class="record-details"><summary>Details</summary>' + detailList(entries) + (actions ? '<div class="record-actions">'+actions+'</div>' : '') + '</details>';
}

function adminDate(value, includeTime) {
  if (!value) return "—";
  const instant = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00Z" : value);
  if (isNaN(instant.getTime())) return String(value);
  const options = { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Taipei" };
  if (includeTime) Object.assign(options, { hour: "2-digit", minute: "2-digit" });
  return new Intl.DateTimeFormat("en-GB", options).format(instant);
}

function localToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const value = function (type) { return parts.find(function (part) { return part.type === type; }).value; };
  return value("year") + "-" + value("month") + "-" + value("day");
}

function initializeTermsDates() {
  const today = localToday();
  const nextMonth = new Date(today.slice(0,7) + "-01T12:00:00Z"); nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const salaryMonth = ui.employeeIdInput && ui.employeeIdInput.value ? nextMonth.toISOString().slice(0,7) : today.slice(0,7);
  [["employee-salary-effective", salaryMonth], ["employee-schedule-effective", today], ["schedule-effective", today]].forEach(function (entry) {
    const input = document.getElementById(entry[0]);
    if (input && !input.value) input.value = entry[1];
  });
}

function termsChangeFields(salaryChanged, scheduleChanged, group) {
  initializeTermsDates();
  const today = localToday();
  const reason = document.getElementById(group ? "schedule-terms-reason" : "employee-terms-reason").value.trim();
  const salaryEffectiveDate = document.getElementById("employee-salary-effective").value + "-01";
  const scheduleEffectiveDate = document.getElementById(group ? "schedule-effective" : "employee-schedule-effective").value;
  if ((salaryChanged || scheduleChanged) && !reason) throw new Error("Enter a reason for the salary or schedule change");
  const initialCurrentMonth = !ui.employeeIdInput.value && salaryEffectiveDate.slice(0, 7) === today.slice(0, 7);
  const backdated = (salaryChanged && !initialCurrentMonth && salaryEffectiveDate < today) || (scheduleChanged && scheduleEffectiveDate < today);
  if (backdated && !window.confirm("This backdated correction will recalculate historical reports. Continue?")) throw new Error("Backdated change cancelled");
  return {salaryEffectiveDate:salaryEffectiveDate,scheduleEffectiveDate:scheduleEffectiveDate,effectiveDate:scheduleEffectiveDate,reason:reason,termsReason:reason,allowBackdate:backdated};
}

function renderEmployees() {
  if (!ui.employeesBody) return;
  ui.employeesBody.replaceChildren();
  if (!employees.length) {
    const row = ui.employeesBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 4;
    cell.textContent = "No employees yet";
    return;
  }
  employees.forEach(function (employee) {
    const row = ui.employeesBody.insertRow();
    const main = adminCell(row, "Name", undefined, "record-main");
    main.innerHTML = '<strong class="record-name">' + escapeHtml(employee.name) + '</strong>' + recordDetails([
      ["Device ID", employee.deviceUUID], ["Employee ID", employee.employeeId],
      ["Archived", employee.archivedAt ? adminDate(employee.archivedAt, true) : "—"], ["Archived by", employee.archivedBy]
    ]);
    adminCell(row, "Contact", [employee.phone, employee.email].filter(Boolean).join(" · "));
    adminCell(row, "Status").innerHTML = statusBadge(employee.status || "active");
    const actions = adminCell(row, "Actions", undefined, "record-actions");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "ghost-btn";
    edit.textContent = "Edit";
    edit.addEventListener("click", function () {
      ui.employeeIdInput.value = employee.employeeId;
      ui.employeeNameInput.value = employee.name || "";
      ui.employeePhoneInput.value = employee.phone || "";
      ui.employeeEmailInput.value = employee.email || "";
      ui.employeeDeviceInput.value = employee.deviceUUID || "";
      if (ui.employeeScheduleInput) ui.employeeScheduleInput.value = employee.scheduleGroupId || "";
      if (ui.employeeSalaryInput) ui.employeeSalaryInput.value = employee.monthlySalary || "";
      ui.saveEmployeeBtn.textContent = "Save changes";
      ui.cancelEmployeeBtn.hidden = false;
      openAdminEditor("employee-editor");
      document.getElementById("employee-editor-title").textContent="Edit employee";
      ui.employeeNameInput.focus();
      document.getElementById("employee-salary-effective").value = "";
      document.getElementById("employee-schedule-effective").value = "";
      document.getElementById("employee-terms-reason").value = "";
      initializeTermsDates();
      void loadEmploymentTerms(employee.employeeId);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost-btn";
    remove.textContent = "Archive";
    remove.addEventListener("click", async function () {
      if (!window.confirm('Archive "' + employee.name + '"? Employee access will stop. Historical reports remain available.')) return;
      try {
        setAdminStatus("Archiving employee...");
        await postToBackend({ action: "adminDeleteEmployee", token: getAdminToken(), employeeId: employee.employeeId });
        if (ui.employeeIdInput.value === employee.employeeId) resetEmployeeForm();
        await loadEmployees();
        setAdminStatus("Employee archived");
        setAdminResult("Employee archived; historical reports remain available", false);
      } catch (error) {
        setAdminStatus("Could not archive employee");
        setAdminResult(error.message || "Unknown error", true);
      }
    });
    if (employee.status === "archived") {
      const history = document.createElement("button"); history.className = "ghost-btn"; history.textContent = "History";
      history.onclick = function () { void loadEmploymentTerms(employee.employeeId); };
      actions.append(history);
    } else actions.append(edit, remove);
  });
}

async function loadEmployees() {
  if (!scheduleGroups.length) await loadSchedules();
  const filter = document.getElementById("employee-status-filter");
  const data = await postToBackend({ action: "adminGetEmployees", token: getAdminToken(), status:filter ? filter.value || "active" : "active" });
  employees = data.employees || [];
  renderEmployees();
}

async function saveEmployee() {
  const current = employees.find(function (employee) { return employee.employeeId === ui.employeeIdInput.value; });
  const salaryChanged = !current || Number(current.monthlySalary) !== Number(ui.employeeSalaryInput.value);
  const scheduleChanged = !current || current.scheduleGroupId !== ui.employeeScheduleInput.value;
  const terms = termsChangeFields(salaryChanged, scheduleChanged, false);
  const data = await postToBackend(Object.assign({
    action: "adminSaveEmployee",
    token: getAdminToken(),
    employeeId: ui.employeeIdInput.value,
    name: ui.employeeNameInput.value.trim(),
    phone: ui.employeePhoneInput.value.trim(),
    email: ui.employeeEmailInput.value.trim(),
    deviceUUID: ui.employeeDeviceInput.value.trim()
    ,scheduleGroupId: ui.employeeScheduleInput ? ui.employeeScheduleInput.value : ""
    ,monthlySalary: ui.employeeSalaryInput ? Number(ui.employeeSalaryInput.value) : 0
  }, terms));
  resetEmployeeForm();
  await loadEmployees();
  return data;
}

async function saveConfig() {
  const spreadsheetId = parseSpreadsheetId(ui.spreadsheetIdInput ? ui.spreadsheetIdInput.value : "");
  if (ui.spreadsheetIdInput) ui.spreadsheetIdInput.value = spreadsheetId;
  const data = await postToBackend({
    action: "adminUpdateConfig",
    token: getAdminToken(),
    spreadsheetId: spreadsheetId,
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
    ui.logsBody.innerHTML = '<tr><td colspan="4">No attendance yet</td></tr>';
    return;
  }
  ui.logsBody.innerHTML = logs
    .map(function (item) {
      return '<tr>' +
        '<td class="record-main" data-label="Employee"><strong class="record-name">' + escapeHtml(item.employeeName) + '</strong><span class="record-subtitle">' + escapeHtml(item.punchType === "in" ? "Clock in" : item.punchType === "out" ? "Clock out" : "Punch") + '</span></td>' +
        '<td data-label="Time">' + escapeHtml(adminDate(item.timestamp, true)) + '</td>' +
        '<td data-label="Location"><div>' + escapeHtml(item.locationStatus) + '<span class="record-subtitle">' + mapLink(item.latitude, item.longitude) + '</span></div></td>' +
        '<td data-label="Details">' + recordDetails([["Device ID", item.deviceUUID], ["IP address", item.ipAddress], ["Recorded at", item.timestamp]]) + '</td>' +
      "</tr>";
    })
    .join("");
}
function mapLink(latitude, longitude) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || latitude === "" || longitude === "") return "—";
  return '<a href="https://www.google.com/maps?q=' + encodeURIComponent(lat + "," + lon) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(lat + ", " + lon) + "</a>";
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
    ui.leaveBody.innerHTML = '<tr><td colspan="4">No requests</td></tr>';
    return;
  }
  ui.leaveBody.innerHTML = leaves
    .map(function (item) {
      const actionCell =
        (item.status === "pending"
          ? (['full','am','pm'].includes(item.dayPart) ? '<button class="primary-btn" data-leave-action="approved" data-request-id="' + escapeHtml(item.requestId) + '">Approve</button>' : '') +
            '<button class="ghost-btn" data-leave-action="rejected" data-request-id="' + escapeHtml(item.requestId) + '">Reject</button>'
          : "") +
        (item.leaveType === "sick" ? '<button class="ghost-btn" data-leave-action="proof" data-request-id="' + escapeHtml(item.requestId) + '">Proof</button>' : "");
      const cancelAction=(item.status === "pending" || item.status === "approved") ? '<button class="ghost-btn" data-leave-action="cancelled" data-request-id="'+escapeHtml(item.requestId)+'">Cancel request</button>' : '';
      return '<tr>' +
        '<td class="record-main" data-label="Employee"><strong class="record-name">' + escapeHtml(item.employeeName) + '</strong><span class="record-subtitle">' + escapeHtml(getLeaveTypeLabel(item.leaveType)) + '</span>' + recordDetails([["Reason", item.reason], ["Submitted", adminDate(item.submittedAt, true)], ["Reviewed by", item.reviewedBy], ["Review note", item.reviewNote], ["Cancelled by", item.cancelledBy], ["Cancelled", adminDate(item.cancelledAt, true)], ["Request ID", item.requestId]],cancelAction) + '</td>' +
        '<td data-label="Dates"><div>' + escapeHtml(adminDate(item.startDate)) + (item.endDate !== item.startDate ? ' – ' + escapeHtml(adminDate(item.endDate)) : '') + '<span class="record-subtitle">' + escapeHtml({full:"Full day",am:"Morning",pm:"Afternoon"}[item.dayPart] || "Unknown duration — verify before approval") + '</span></div></td>' +
        '<td data-label="Status">' + statusBadge(item.status) + '</td>' +
        '<td class="record-actions" data-label="Actions">' + actionCell + '</td>' +
      "</tr>";
    })
    .join("");
}

function getLeaveTypeLabel(value) {
  const labels = {
    sick: "Sick leave",
    personal: "Personal leave",
    annual: "Annual leave",
    other: "Other"
  };
  return labels[value] || value || "Unknown";
}

async function loadLeaveRequests(append) {
  const query = ++state.leaveQuery;
  const filter = ui.leaveStatusSelect ? ui.leaveStatusSelect.value : "pending";
  if (append !== true) { state.leaveRows = []; state.leaveCursor = ""; }
  const more = document.getElementById("leave-load-more");
  if (more) more.disabled = true;
  try {
  const data = await postToBackend({
    action: "adminGetLeaveRequests",
    token: getAdminToken(),
    status: filter,
    limit: 100,
    cursor: state.leaveCursor
  });
  if (query !== state.leaveQuery) return;
  const merged = new Map(state.leaveRows.map(function (row) { return [row.requestId, row]; }));
  (data.leaves || []).forEach(function (row) { merged.set(row.requestId, row); });
  state.leaveRows = Array.from(merged.values());
  state.leaveCursor = data.nextCursor || "";
  renderLeaveTable(state.leaveRows);
  if (more) more.hidden = !state.leaveCursor;
  } finally { if (more && query === state.leaveQuery) more.disabled = false; }
}

async function handleLeaveAction(requestId, status) {
  try {
    setAdminStatus(status === "approved" ? "Approving..." : status === "cancelled" ? "Cancelling..." : "Rejecting...");
    await postToBackend({
      action: "adminUpdateLeaveStatus",
      token: getAdminToken(),
      requestId: requestId,
      status: status
    });
    setAdminStatus(status === "approved" ? "Approved" : status === "cancelled" ? "Cancelled" : "Rejected");
    setAdminResult("", false);
    await loadLeaveRequests();
  } catch (error) {
    setAdminStatus("Action failed");
    setAdminResult(error.message || "Unknown error", true);
  }
}

async function handleLeaveEvidence(requestId) {
  try {
    const data = await postToBackend({action:"adminGetLeaveEvidence",token:getAdminToken(),requestId:requestId});
    if (!data.dataUrl) throw new Error("Proof is unavailable");
    const link = document.createElement("a");
    link.href = data.dataUrl;
    link.download = data.fileName || "leave-proof";
    document.body.appendChild(link);
    link.click(); link.remove();
  } catch (error) { setAdminResult(error.message || "Could not open proof", true); }
}

async function loadAdminCalendar(propagateError) {
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
    setAdminStatus("Calendar updated");
    setAdminResult("", false);
  } catch (error) {
    if (propagateError) throw error;
    setAdminStatus("Could not load calendar");
    setAdminResult(error.message || "Unknown error", true);
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
    showPortalLogin("admin", { status: "Signed out" });
    return;
  }
  updateUrlForLogin("employee");
  showPortalLogin("employee", { status: "Signed out" });
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
      setAdminStatus("Service Worker registration failed");
      return;
    }
    setPortalStatus("Service Worker registration failed");
  }
}

function bindAdminViewNavigation() {
  const links = [
    [ui.adminViewConfigLink, "config"],
    [ui.adminViewEmployeesLink, "employees"],
    [ui.adminViewLogsLink, "logs"],
    [ui.adminViewLeavesLink, "leaves"],
    [ui.adminViewCalendarLink, "calendar"],
    [ui.adminViewSchedulesLink, "schedules"],
    [ui.adminViewCorrectionsLink, "corrections"],
    [ui.adminViewPayrollLink, "payroll"]
  ];
  for (const [link, view] of links) {
    if (!link) continue;
    link.addEventListener("click", function (event) {
      if (state.sessionRole !== "admin" || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      state.adminView = view;
      renderAdminShell();
      updateUrlForAdminView(view);
      void loadAdminView(view);
    });
  }
}

function bindEvents() {
  const adjustmentForm = document.getElementById("payroll-adjustment-form");
  if (adjustmentForm) adjustmentForm.addEventListener("submit", function (event) { event.preventDefault(); void savePayrollAdjustment(); });
  const adjustmentCancel = document.getElementById("payroll-adjustment-cancel");
  if (adjustmentCancel) adjustmentCancel.addEventListener("click", closePayrollAdjustment);
  initializeTermsDates();
  const historicalTerms = document.getElementById("historical-terms-form");
  if (historicalTerms) historicalTerms.addEventListener("submit", function(event) { event.preventDefault(); void saveHistoricalTerms(); });
  const moreLeaves = document.getElementById("leave-load-more");
  if (moreLeaves) moreLeaves.onclick = function () { void loadLeaveRequests(true).catch(function (error) { setAdminResult(error.message, true); }); };
  const employeeFilter = document.getElementById("employee-status-filter");
  if (employeeFilter) employeeFilter.onchange = function () { resetEmployeeForm(); void loadEmployees().catch(function (error) { setAdminResult(error.message, true); }); };
  ["correction-status-filter", "correction-refresh"].forEach(function (id) {
    const element = document.getElementById(id);
    if (element) element[id === "correction-refresh" ? "onclick" : "onchange"] = function () { void loadAdminCorrections().catch(function (error) { setAdminResult(error.message, true); }); };
  });
  bindAdminViewNavigation();
  if (ui.leaveBody) ui.leaveBody.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-leave-action][data-request-id]");
    if (!button || !ui.leaveBody.contains(button)) return;
    const action = button.dataset.leaveAction;
    const requestId = button.dataset.requestId;
    if (action === "proof") void handleLeaveEvidence(requestId);
    else if (["approved", "rejected", "cancelled"].includes(action)) void handleLeaveAction(requestId, action);
  });
  if (ui.modeCorrectionLink) ui.modeCorrectionLink.addEventListener("click", function (event) {
    if (state.sessionRole !== "employee" || event.button !== 0 || event.metaKey || event.ctrlKey) return;
    event.preventDefault(); state.employeeMode="correction"; renderEmployeeShell(); updateUrlForEmployeeMode("correction");
  });
  if (ui.correctionForm) ui.correctionForm.addEventListener("submit", async function(event) {
    event.preventDefault();const value=document.getElementById("correction-time").value;
    try { await postToBackend({action:"employeeSubmitCorrection",deviceUUID:getOrCreateDeviceUUID(),date:value.slice(0,10),time:value.slice(11,16),punchType:document.getElementById("correction-direction").value,reason:document.getElementById("correction-reason").value.trim()});ui.correctionForm.reset();setEmployeeResult("Missed punch request submitted",false);await loadEmployeeCorrections(); }
    catch(error){setEmployeeResult(error.message||"Could not submit request",true);}
  });
  const scheduleForm=document.getElementById("schedule-form");
  if(scheduleForm)scheduleForm.addEventListener("submit",async function(event){event.preventDefault();const days=Array.from(document.querySelectorAll("#schedule-days .schedule-day")).filter(function(row){return row.querySelector("[data-weekday]").checked;}).map(function(row){return {weekday:Number(row.querySelector("[data-weekday]").dataset.weekday),start:row.querySelector("[data-start]").value,end:row.querySelector("[data-end]").value};});try{const terms=termsChangeFields(false,true,true);await postToBackend(Object.assign({action:"adminSaveScheduleGroup",token:getAdminToken(),groupId:document.getElementById("schedule-id").value,name:document.getElementById("schedule-name").value.trim(),days:days},terms));scheduleForm.reset();document.getElementById("schedule-id").value="";initializeTermsDates();await loadSchedules();setAdminResult("Schedule group saved",false);}catch(error){setAdminResult(error.message||"Could not save group",true);}});
  const scheduleCancel=document.getElementById("schedule-cancel");if(scheduleCancel)scheduleCancel.onclick=function(){scheduleForm.reset();document.getElementById("schedule-id").value="";initializeTermsDates();document.getElementById("schedule-editor").open=false;document.getElementById("schedule-editor-title").textContent="Add schedule";};
  const adminCorrectionForm=document.getElementById("admin-correction-form");
  if(adminCorrectionForm) adminCorrectionForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    if (adminCorrectionForm.dataset.busy) return;
    adminCorrectionForm.dataset.busy = "true";
    const value = document.getElementById("admin-correction-time").value;
    const payload = {action:"adminAddCorrection",token:getAdminToken(),employeeId:document.getElementById("admin-correction-employee").value,date:value.slice(0,10),time:value.slice(11,16),punchType:document.getElementById("admin-correction-direction").value,reason:document.getElementById("admin-correction-reason").value.trim(),replacesRequestId:document.getElementById("admin-correction-replaces").value.trim()};
    try {
      await postToBackend(Object.assign(payload, {submissionId:stableSubmissionId(adminCorrectionForm.dataset, payload)}));
      adminCorrectionForm.reset(); delete adminCorrectionForm.dataset.submissionId; delete adminCorrectionForm.dataset.operation;
      document.getElementById("correction-editor").open=false;
      await loadAdminCorrections(); setAdminResult("Punch added",false);
    } catch(error) { setAdminResult(error.message || "Could not add punch",true); }
    finally { delete adminCorrectionForm.dataset.busy; }
  });
  const payrollLoad=document.getElementById("payroll-load");if(payrollLoad)payrollLoad.onclick=function(){void loadPayroll().catch(function(e){setAdminResult(e.message,true);});};
  const payrollExport=document.getElementById("payroll-export");if(payrollExport)payrollExport.onclick=async function(){const employeeId=document.getElementById("payroll-employee").value;const parts=document.getElementById("payroll-month").value.split("-").map(Number);if(!employeeId||parts.length!==2)return;try{const data=await postToBackend({action:"adminExportMonthlyCsv",token:getAdminToken(),employeeId:employeeId,year:parts[0],month:parts[1]});const blob=new Blob([data.csv||""],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=data.fileName||"attendance.csv";a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}catch(e){setAdminResult(e.message,true);}};
  if (ui.copyDeviceIdBtn) {
    ui.copyDeviceIdBtn.addEventListener("click", async function () {
      const deviceId = getOrCreateDeviceUUID();
      try {
        await navigator.clipboard.writeText(deviceId);
        ui.deviceIdCopyStatus.textContent = "Device ID copied. Send it to your admin.";
      } catch (_error) {
        ui.deviceIdCopyStatus.textContent = "Could not copy automatically. Press and hold the device ID above to copy it.";
      }
    });
  }

  if (ui.employeeRoleTab) {
    ui.employeeRoleTab.addEventListener("click", function () {
      updateUrlForLogin("employee");
      showPortalLogin("employee", {
        status: "Sign in with a registered device"
      });
    });
  }

  if (ui.adminRoleTab) {
    ui.adminRoleTab.addEventListener("click", function () {
      updateUrlForLogin("admin");
      showPortalLogin("admin", {
        status: "Sign in as an admin"
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
        setAdminStatus("Saving employee...");
        await saveEmployee();
        setAdminStatus("Employee accounts updated");
        setAdminResult("Employee account saved", false);
      } catch (error) {
        setAdminStatus("Could not save");
        setAdminResult(error.message || "Unknown error", true);
      }
    });
  }
  if (ui.cancelEmployeeBtn) ui.cancelEmployeeBtn.addEventListener("click", resetEmployeeForm);
  if (ui.reloadEmployeesBtn) ui.reloadEmployeesBtn.addEventListener("click", async function () {
    try {
      setAdminStatus("Loading employee accounts...");
      await loadEmployees();
      setAdminStatus("Employee accounts updated");
      setAdminResult("", false);
    } catch (error) {
      setAdminStatus("Could not load");
      setAdminResult(error.message || "Unknown error", true);
    }
  });

  if (ui.loginForm) {
    ui.loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setAdminLoginBusy(true);
      setPortalStatus("Signing in as admin...");
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
        setAdminResult("", false);
      } catch (error) {
        showPortalLogin("admin", {
          status: "Sign-in failed",
          result: error.message || "Unknown error",
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

  if (ui.punchBtn) ui.punchBtn.addEventListener("click", function () { void handlePunch("in", false); });
  if (ui.punchOutBtn) ui.punchOutBtn.addEventListener("click", function () { void handlePunch("out", false); });
  if (ui.quickInBtn) ui.quickInBtn.addEventListener("click", function () { void handlePunch("in", true); });
  if (ui.quickOutBtn) ui.quickOutBtn.addEventListener("click", function () { void handlePunch("out", true); });

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
    if (ui.spreadsheetIdInput) {
      ui.spreadsheetIdInput.addEventListener("paste", function (event) {
        const pastedText = event.clipboardData ? event.clipboardData.getData("text") : "";
        if (!pastedText) return;
        try {
          const spreadsheetId = parseSpreadsheetId(pastedText);
          event.preventDefault();
          ui.spreadsheetIdInput.value = spreadsheetId;
        } catch (_error) {
          // Keep the pasted text so the user can correct it; validate on save.
        }
      });
    }
    ui.configForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        setAdminStatus("Saving settings...");
        await saveConfig();
        setAdminStatus("Settings updated");
        setAdminResult("Settings saved", false);
      } catch (error) {
        setAdminStatus("Could not save");
        setAdminResult(error.message || "Unknown error", true);
      }
    });
  }

  if (ui.reloadLogsBtn) {
    ui.reloadLogsBtn.addEventListener("click", async function () {
      try {
        setAdminStatus("Loading attendance logs...");
        await loadLogs();
        setAdminStatus("Attendance logs updated");
        setAdminResult("", false);
      } catch (error) {
        setAdminStatus("Could not load");
        setAdminResult(error.message || "Unknown error", true);
      }
    });
  }

  if (ui.limitSelect) {
    ui.limitSelect.addEventListener("change", async function () {
      try {
        setAdminStatus("Loading attendance logs...");
        await loadLogs();
        setAdminStatus("Attendance logs updated");
        setAdminResult("", false);
      } catch (error) {
        setAdminStatus("Could not load");
        setAdminResult(error.message || "Unknown error", true);
      }
    });
  }

  if (ui.reloadLeaveBtn) {
    ui.reloadLeaveBtn.addEventListener("click", async function () {
      try {
        setAdminStatus("Loading leave requests...");
        await loadLeaveRequests();
        setAdminStatus("Leave requests updated");
        setAdminResult("", false);
      } catch (error) {
        setAdminStatus("Could not load");
        setAdminResult(error.message || "Unknown error", true);
      }
    });
  }

  if (ui.leaveStatusSelect) {
    ui.leaveStatusSelect.addEventListener("change", async function () {
      try {
        setAdminStatus("Loading leave requests...");
        await loadLeaveRequests();
        setAdminStatus("Leave requests updated");
        setAdminResult("", false);
      } catch (error) {
        setAdminStatus("Could not load");
        setAdminResult(error.message || "Unknown error", true);
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
      // enterAdminPortal already displays the reason if the session is invalid.
      return entered;
    }
    showPortalLogin("admin", {
      status: "Sign in as an admin"
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
    status: "Sign in with a registered device",
  });
  return false;
}

async function bootstrap() {
  if (ui.deviceIdValue) ui.deviceIdValue.textContent = getOrCreateDeviceUUID();
  if (!CONFIG.GAS_WEB_APP_URL) {
    setPortalResult("Set GAS_WEB_APP_URL in web/config.js first", true);
  }

  bindEvents();
  initInstallEntry();
  initEmpCalSelects(empCalYear, empCalMonth);
  void initServiceWorker();

  try {
    if (CONFIG.GAS_WEB_APP_URL) {
      await fetchPublicConfig();
      if (state.backendApiVersion < 2) throw new Error("Backend update required. Ask your administrator to deploy API version 2.");
    }
    await restoreSessionFromStorage();
  } catch (error) {
    showPortalLogin(getRequestedRole(), {
      status: "Could not restore your session",
      result: error.message || "Please try again",
      isError: true
    });
  } finally {
    const loading = document.getElementById("portal-loading");
    if (loading) loading.hidden = true;
  }
}

bootstrap();

async function loadEmployeeLeaves() {
  if (state.sessionRole !== "employee" || !ui.employeeLeaveHistory) return;
  try {
    const data = await postToBackend({action:"employeeGetLeaveRequests",deviceUUID:getOrCreateDeviceUUID()});
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Type</th><th>Dates</th><th>Duration</th><th>Status</th><th>Cancellation</th><th>Action</th></tr></thead>";
    const body = table.createTBody();
    (data.leaves || []).forEach(function (leave) {
      const row = body.insertRow();
      [getLeaveTypeLabel(leave.leaveType), (leave.startDate || "") + " – " + (leave.endDate || ""), leave.dayPart || "full", leave.status || "", leave.status === "cancelled" ? [leave.cancelledBy, leave.cancelledAt].filter(Boolean).join(" · ") : "—"].forEach(function (v) { row.insertCell().textContent = v; });
      const cell = row.insertCell();
      if (leave.status !== "cancelled" && leave.status !== "rejected") {
        const button = document.createElement("button"); button.className = "ghost-btn"; button.textContent = "Cancel";
        button.onclick = async function () {
          if (!window.confirm("Cancel this leave request?")) return;
          try { await postToBackend({action:"employeeCancelLeave",deviceUUID:getOrCreateDeviceUUID(),requestId:leave.requestId}); await loadEmployeeLeaves(); await loadEmployeeCalendar(); }
          catch (error) { setEmployeeResult(error.message || "Could not cancel leave", true); }
        };
        cell.appendChild(button);
      }
    });
    ui.employeeLeaveHistory.replaceChildren(table);
  } catch (error) { setEmployeeResult(error.message || "Could not load leave requests", true); }
}

async function loadEmployeeCorrections() {
  if (state.sessionRole !== "employee" || !ui.employeeCorrectionHistory) return;
  try {
    const data = await postToBackend({action:"employeeGetCorrections",deviceUUID:getOrCreateDeviceUUID()});
    ui.employeeCorrectionHistory.innerHTML = '<table><thead><tr><th>Date</th><th>Time</th><th>Direction</th><th>Status</th></tr></thead><tbody>' +
      (data.corrections || []).map(function (c) { return '<tr><td>'+escapeHtml(c.date)+'</td><td>'+escapeHtml(c.time)+'</td><td>'+escapeHtml(c.punchType)+'</td><td>'+escapeHtml(c.status)+'</td></tr>'; }).join("") + '</tbody></table>';
  } catch (error) { setEmployeeResult(error.message || "Could not load requests", true); }
}

async function loadSchedules() {
  const data = await postToBackend({action:"adminGetScheduleGroups",token:getAdminToken()});
  scheduleGroups = data.groups || [];
  const employeeSelect = ui.employeeScheduleInput;
  if (employeeSelect) {
    const current = employeeSelect.value;
    employeeSelect.innerHTML = '<option value="">Select a group</option>' + scheduleGroups.map(function (g) { return '<option value="'+escapeHtml(g.groupId)+'">'+escapeHtml(g.name)+'</option>'; }).join("");
    employeeSelect.value = current;
  }
  const days = document.getElementById("schedule-days");
  if (days && !days.children.length) {
    ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].forEach(function (name, index) {
      const div = document.createElement("div"); div.className = "schedule-day";
      div.innerHTML = '<label><input type="checkbox" data-weekday="'+(index+1)+'" '+(index<6?'checked':'')+' />'+name+'</label><input type="time" data-start="'+(index+1)+'" value="09:00" /><input type="time" data-end="'+(index+1)+'" value="'+(index===5?'13:00':'18:00')+'" />';
      days.appendChild(div);
    });
  }
  const list = document.getElementById("schedule-list"); if (!list) return;
  list.replaceChildren();
  scheduleGroups.forEach(function (group) {
    const div = document.createElement("div"); div.className = "schedule-row";
    const label = document.createElement("span"); label.textContent = group.name + " · " + (group.days || []).map(function (day) {return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][day.weekday-1] + " " + day.start + "–" + day.end;}).join(", ");
    const edit = document.createElement("button"); edit.className="ghost-btn"; edit.textContent="Edit";
    edit.onclick = function () { openAdminEditor("schedule-editor"); document.getElementById("schedule-editor-title").textContent="Edit schedule"; document.getElementById("schedule-id").value=group.groupId; document.getElementById("schedule-name").value=group.name; days.querySelectorAll(".schedule-day").forEach(function (row) {const wd=Number(row.querySelector("[data-weekday]").dataset.weekday); const d=(group.days||[]).find(function(x){return x.weekday===wd;}); row.querySelector("[data-weekday]").checked=!!d; if(d){row.querySelector("[data-start]").value=d.start;row.querySelector("[data-end]").value=d.end;}});};
    const remove=document.createElement("button"); remove.className="ghost-btn"; remove.textContent="Delete";
    remove.onclick=async function(){if(!window.confirm("Delete this schedule group?"))return;try{await postToBackend({action:"adminDeleteScheduleGroup",token:getAdminToken(),groupId:group.groupId});await loadSchedules();}catch(e){setAdminResult(e.message,true);}};
    div.append(label,edit,remove); list.appendChild(div);
  });
}

async function loadAdminCorrections() {
  const filter = document.getElementById("correction-status-filter");
  const data = await postToBackend({action:"adminGetCorrections",token:getAdminToken(),status:filter ? filter.value || "pending" : "pending"});
  const wrap=document.getElementById("correction-review"); if(!wrap)return; wrap.replaceChildren();
  const table=document.createElement("table"); table.innerHTML="<thead><tr><th>Employee</th><th>Punch</th><th>Status</th><th>Actions</th></tr></thead>"; const body=table.createTBody();
  if (!(data.corrections || []).length) { const empty = body.insertRow().insertCell(); empty.colSpan = 4; empty.textContent = "No requests"; }
  (data.corrections||[]).forEach(function(c) {
    const row = body.insertRow();
    adminCell(row,"Employee",undefined,"record-main").innerHTML='<strong class="record-name">'+escapeHtml(c.employeeName)+'</strong>'+recordDetails([["Reason",c.reason],["Source",c.origin],["Submitted",adminDate(c.submittedAt,true)],["Reviewed by",c.reviewedBy],["Reviewed",adminDate(c.reviewedAt,true)],["Review note",c.reviewNote],["Revoked by",c.revokedBy],["Revoked",adminDate(c.revokedAt,true)],["Revocation reason",c.revocationReason || c.revokeReason],["Request ID",c.requestId],["Replaces",c.replacesRequestId]]);
    adminCell(row,"Punch").innerHTML='<div>'+escapeHtml(adminDate(c.date))+' · '+escapeHtml(c.time || "—")+'<span class="record-subtitle">'+escapeHtml(c.punchType === "out" ? "Clock out" : "Clock in")+'</span></div>';
    adminCell(row,"Status").innerHTML=statusBadge(c.status);
    const cell=adminCell(row,"Actions",undefined,"record-actions");
    if(c.status==="pending") ["approved","rejected"].forEach(function(status) {
      const btn=document.createElement("button");btn.className=status==="approved"?"primary-btn":"ghost-btn";btn.textContent=status==="approved"?"Approve":"Reject";
      btn.onclick=async function() {btn.disabled=true;try{await postToBackend({action:"adminUpdateCorrection",token:getAdminToken(),requestId:c.requestId,status:status,reviewNote:""});await loadAdminCorrections();}catch(e){setAdminResult(e.message,true);}finally{btn.disabled=false;}}; cell.appendChild(btn);
    });
    if(c.status==="approved") {
      const btn=document.createElement("button");btn.className="ghost-btn";btn.textContent="Revoke";
      btn.onclick=async function() {
        const reason=window.prompt("Reason for revoking this correction. Historical reports will recalculate.");
        if (!reason || !reason.trim()) return;
        const payload={action:"adminRevokeCorrection",token:getAdminToken(),requestId:c.requestId,reason:reason.trim()};
        btn.disabled=true;
        try {await postToBackend(Object.assign(payload,{submissionId:stableSubmissionId(btn.dataset,payload)}));await loadAdminCorrections();setAdminResult("Correction revoked. Review any newly missing punches.",false);}
        catch(e){setAdminResult(e.message,true);}finally{btn.disabled=false;}
      };cell.appendChild(btn);
    }
    if(c.status==="revoked") {
      const replace=document.createElement("button");replace.className="ghost-btn";replace.textContent="Replace";
      replace.onclick=function() {
        openAdminEditor("correction-editor");
        document.getElementById("admin-correction-employee").value=c.employeeId;
        document.getElementById("admin-correction-time").value=c.date+"T"+c.time;
        document.getElementById("admin-correction-direction").value=c.punchType;
        document.getElementById("admin-correction-replaces").value=c.requestId;
        document.getElementById("admin-correction-reason").value="";
        document.getElementById("admin-correction-reason").focus();
      };cell.appendChild(replace);
    }
  });wrap.appendChild(table);
  const employeeData = await postToBackend({action:"adminGetEmployees",token:getAdminToken(),status:"all"});
  const select=document.getElementById("admin-correction-employee");
  const current=select.value;select.innerHTML=employeeOptions(employeeData.employees || []);select.value=current;
}

function stableSubmissionId(storage, payload) {
  const operation=JSON.stringify(payload);
  if (storage.operation !== operation) { storage.operation=operation;storage.submissionId=generateUUID(); }
  return storage.submissionId;
}

function employeeOptions(list) {
  return '<option value="">Select employee</option>'+list.map(function(e) {return '<option value="'+escapeHtml(e.employeeId)+'">'+escapeHtml(e.name)+(e.status==="archived"?' (Archived)':'')+'</option>';}).join("");
}

function auditValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function auditTable(headings, rows) {
  return '<table><thead><tr>'+headings.map(function(h){return '<th>'+escapeHtml(h)+'</th>';}).join("")+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(v,index){return '<td data-label="'+escapeHtml(headings[index])+'">'+escapeHtml(auditValue(v))+'</td>';}).join("")+'</tr>';}).join("")+'</tbody></table>';
}

function termsHistoryHtml(terms) {
  const versions = terms.versions || [].concat(terms.salaries || [],terms.assignments || [],terms.scheduleVersions || []);
  const unique = new Map();
  [terms.salaryVersion].concat(versions).filter(Boolean).forEach(function(version) { unique.set(version.versionId || JSON.stringify(version),version); });
  return '<details class="admin-editor"><summary>Salary & schedule history</summary>' + auditTable(["Version","Effective date","Salary / schedule","Reason","Administrator","Recorded at","Provenance"], Array.from(unique.values()).map(function(v) {
    return [v.versionId,v.effectiveDate || v.effectiveMonth,v.amount != null ? "MYR "+v.amount : [v.scheduleVersionId,v.groupId,v.days ? auditValue(v.days) : ""].filter(Boolean).join(" · "),v.reason,v.actor,v.createdAt,v.provenance];
  })) + '</details>';
}

function warningsHtml(warnings) {
  return warnings.length ? '<h3>Review required</h3><ul>'+Array.from(new Set(warnings)).map(function(w) {return '<li>'+escapeHtml(auditValue(w))+'</li>';}).join("")+'</ul>' : "";
}

async function loadEmploymentTerms(employeeId) {
  const wrap=document.getElementById("employment-terms-history");if (!wrap) return;
  wrap.dataset.employeeId=employeeId;
  wrap.textContent="Loading terms history...";
  try {
    const data=await postToBackend({action:"adminGetEmploymentTerms",token:getAdminToken(),employeeId:employeeId});
    if (wrap.dataset.employeeId !== employeeId) return;
    const terms=data.terms || data;
    wrap.innerHTML=warningsHtml(terms.warnings || [])+termsHistoryHtml(terms);
    const form=document.getElementById("historical-terms-form");
    form.reset(); form.hidden=false;form.dataset.employeeId=employeeId;
    const advanced=document.getElementById("historical-correction");if(advanced){advanced.hidden=false;advanced.open=false;}
    const employee=employees.find(function(item){return item.employeeId===employeeId;});
    document.getElementById("historical-terms-employee").textContent=employee ? employee.name : "Past terms";
    document.getElementById("historical-terms-schedule").innerHTML='<option value="">Keep schedule unchanged</option>'+scheduleGroups.map(function(g){return '<option value="'+escapeHtml(g.groupId)+'">'+escapeHtml(g.name)+'</option>';}).join("");
  } catch(error) {if (wrap.dataset.employeeId === employeeId) wrap.textContent=error.message || "Could not load terms history";}
}

async function saveHistoricalTerms() {
  const form=document.getElementById("historical-terms-form");
  if(form.dataset.busy)return;
  form.dataset.busy="true";
  try {
    const amount=document.getElementById("historical-terms-salary").value;
    const groupId=document.getElementById("historical-terms-schedule").value;
    const reason=document.getElementById("historical-terms-reason").value.trim();
    if(!reason)throw new Error("Enter a reason for the historical correction");
    if(amount===""&&!groupId)throw new Error("Enter a salary or select a schedule to correct");
    const salaryMonth=document.getElementById("historical-terms-month").value;
    const scheduleDate=document.getElementById("historical-terms-date").value;
    if(amount!==""&&!salaryMonth)throw new Error("Select the salary effective month");
    if(groupId&&!scheduleDate)throw new Error("Select the schedule effective date");
    const today=localToday();
    const backdated=(amount!==""&&salaryMonth+"-01"<today)||(groupId&&scheduleDate<today);
    if(backdated&&!window.confirm("This historical correction will recalculate affected payroll reports. Continue?"))return;
    const payload={action:"adminSaveEmploymentTerms",token:getAdminToken(),employeeId:form.dataset.employeeId,reason:reason,allowBackdate:!!backdated};
    if(amount!==""){payload.monthlySalary=Number(amount);payload.salaryEffectiveDate=salaryMonth+"-01";}
    if(groupId){payload.scheduleGroupId=groupId;payload.scheduleEffectiveDate=scheduleDate;}
    await postToBackend(payload);await loadEmploymentTerms(payload.employeeId);setAdminResult("Historical correction recorded. Affected reports will recalculate.",false);
  }catch(error){setAdminResult(error.message || "Could not save historical correction",true);}
  finally{delete form.dataset.busy;}
}

function renderPayrollAudit(report) {
  const wrap=document.getElementById("payroll-audit");if (!wrap) return;
  const terms=report.terms || {};
  const adjustments=(report.adjustments || []).slice().sort(function(a,b) {return String(a.createdAt).localeCompare(String(b.createdAt));});
  wrap.innerHTML=warningsHtml([].concat(report.warnings || [],terms.warnings || []))+termsHistoryHtml(terms)+'<details class="admin-editor"><summary>Adjustment history'+(adjustments.length?' · '+adjustments.length:'')+'</summary>'+auditTable(["Adjustment ID","Period","Changed values","Reason","Administrator","Recorded at"],adjustments.map(function(a) {
    const labels={workHours:"Worked hours",absenceDays:"Absence days",payAmount:"Pay adjustment (MYR)"};
    const values=Object.keys(labels).filter(function(key){return a[key] !== undefined && a[key] !== null && a[key] !== "";}).map(function(key){return labels[key]+": "+a[key];}).join(" · ");
    return [a.adjustmentId,a.date || "Whole month",values,a.reason,a.admin || a.actor || a.createdBy,a.createdAt];
  }))+'</details>';
}

function closePayrollAdjustment() {
  const dialog=document.getElementById("payroll-adjustment-dialog");
  if(typeof dialog.close==="function")dialog.close();else dialog.open=false;
}

function openPayrollAdjustment(day,employeeId,year,month) {
  const dialog=document.getElementById("payroll-adjustment-dialog");
  Object.assign(dialog.dataset,{employeeId:employeeId,year:String(year),month:String(month),date:day.date});
  ["hours","absence","pay","reason"].forEach(function(field){document.getElementById("payroll-adjustment-"+field).value="";});
  document.getElementById("payroll-adjustment-hours").placeholder="Current: "+String(day.workedHours ?? "—");
  document.getElementById("payroll-adjustment-date").textContent=adminDate(day.date);
  document.getElementById("payroll-adjustment-error").textContent="";
  if(typeof dialog.showModal==="function")dialog.showModal();else dialog.open=true;
}

async function savePayrollAdjustment() {
  const dialog=document.getElementById("payroll-adjustment-dialog");
  const save=document.getElementById("payroll-adjustment-save");
  if(save.disabled)return;
  const reason=document.getElementById("payroll-adjustment-reason").value.trim();
  const values={workHours:document.getElementById("payroll-adjustment-hours").value,absenceDays:document.getElementById("payroll-adjustment-absence").value,payAmount:document.getElementById("payroll-adjustment-pay").value};
  const error=document.getElementById("payroll-adjustment-error");
  if(!reason){error.textContent="Add a reason";return;}
  if(Object.values(values).every(function(value){return value==="";})){error.textContent="Enter an adjustment";return;}
  const payload={action:"adminSaveMonthlyAdjustment",token:getAdminToken(),employeeId:dialog.dataset.employeeId,year:Number(dialog.dataset.year),month:Number(dialog.dataset.month),date:dialog.dataset.date,reason:reason};
  Object.keys(values).forEach(function(key){if(values[key]!=="")payload[key]=Number(values[key]);});
  save.disabled=true;error.textContent="";
  try{await postToBackend(payload);closePayrollAdjustment();await loadPayroll();setAdminResult("Adjustment saved",false);}
  catch(failure){error.textContent=failure.message || "Could not save adjustment";}
  finally{save.disabled=false;}
}

async function loadPayroll() {
  const employeeData = await postToBackend({action:"adminGetEmployees",token:getAdminToken(),status:"all"});
  const select=document.getElementById("payroll-employee");
  const current=select.value; select.innerHTML=employeeOptions(employeeData.employees || []);select.value=current;
  const month=document.getElementById("payroll-month");if(!month.value)month.value=new Date().toISOString().slice(0,7);
  if(!select.value){document.getElementById("payroll-summary").textContent="Select an employee";document.getElementById("payroll-records").replaceChildren();document.getElementById("payroll-audit").replaceChildren();return;}
  const parts=month.value.split("-").map(Number);
  document.getElementById("payroll-summary").textContent="Loading monthly records...";
  document.getElementById("payroll-records").replaceChildren();document.getElementById("payroll-audit").replaceChildren();
  const data=await postToBackend({action:"adminGetMonthlyReport",token:getAdminToken(),employeeId:select.value,year:parts[0],month:parts[1]}).catch(function(error) {
    document.getElementById("payroll-summary").textContent="Report unavailable. "+(error.message || "Could not load monthly records");
    throw error;
  });
  renderPayrollAudit(data.report || {});
  const report=data.report||{};const summary=report.summary||{};
  const money=function(value){return "MYR "+Number(value||0).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2});};
  const hours=function(value){return Number(value||0).toFixed(1)+" h";};
  document.getElementById("payroll-summary").innerHTML='<div class="payroll-metrics">'+[
    ["Net pay",money(summary.netPay),true],["Worked",hours(summary.workedHours)],["Overtime",hours(summary.overtimeHours)]
  ].map(function(metric){return '<div class="payroll-metric'+(metric[2]?' primary':'')+'"><span class="metric-label">'+escapeHtml(metric[0])+'</span><strong class="metric-value">'+escapeHtml(metric[1])+'</strong></div>';}).join("")+'</div><details class="record-details"><summary>Pay breakdown</summary>'+detailList([["Base salary",money(summary.baseSalary)],["Leave",hours(summary.leaveHours)],["Attendance credit",hours(summary.creditedHours)],["Overtime pay",money(summary.overtimePay)],["Absence",Number(summary.absenceDays||0)+" days"],["Deductions",money(summary.absenceDeduction)],["Adjustments",money(summary.payAdjustment)]])+'</details>';
  const wrap=document.getElementById("payroll-records");wrap.replaceChildren();
  const table=document.createElement("table");table.innerHTML="<thead><tr><th>Date</th><th>Hours</th><th>Leave</th><th>Actions</th></tr></thead>";
  const body=table.createTBody();
  (report.days||[]).forEach(function(day) {
    const row=body.insertRow();
    adminCell(row,"Date",undefined,"record-main").innerHTML='<strong class="record-name">'+escapeHtml(adminDate(day.date))+'</strong>'+recordDetails([["Overtime",hours(day.overtimeHours)],["Absence",Number(day.absenceDays||0)+" days"],["Overtime pay",money(day.overtimePay)],["Deduction",money(day.absenceDeduction)],["Pay adjustment",money(day.payAdjustment)],["Paid leave",hours(day.paidLeaveHours)],["Unpaid leave",hours(day.unpaidLeaveHours)],["Review",(day.warnings||[]).join(" · ")]]);
    adminCell(row,"Hours",hours(day.workedHours));
    adminCell(row,"Leave",hours(day.leaveHours));
    const btn=document.createElement("button");btn.className="ghost-btn";btn.textContent="Adjust";
    btn.onclick=function(){openPayrollAdjustment(day,select.value,parts[0],parts[1]);};
    adminCell(row,"Actions",undefined,"record-actions").appendChild(btn);
  });
  const daily=document.createElement("details");daily.className="admin-editor";
  const caption=document.createElement("summary");caption.textContent="Daily records · "+(report.days||[]).length;
  daily.append(caption,table);wrap.appendChild(daily);
}
