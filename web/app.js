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
    throw new Error(data.message || "Request failed");
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
    ui.roleBadge.textContent = state.sessionRole === "admin" ? "Admin" : "Employee";
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
  if (ui.leaveArea) {
    ui.leaveArea.hidden = mode !== "leave";
  }
  if (ui.calendarArea) {
    ui.calendarArea.hidden = mode !== "calendar";
  }

  if (mode === "punch") {
    setEmployeeStatus("Ready");
  } else if (mode === "leave") {
    setEmployeeStatus("Complete the leave form to submit a request");
  } else if (mode === "calendar") {
    setEmployeeStatus("Loading your calendar...");
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
  };
  const token = getAdminToken();
  setAdminStatus("Loading " + view + "...");
  setAdminResult("", false);
  try {
    await loaders[view]();
    if (state.sessionRole === "admin" && state.adminView === view && getAdminToken() === token) {
      setAdminStatus("Admin dashboard ready");
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
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error("IP service returned an error");
    }
    const data = await response.json();
    if (!data || !data.ip) {
      throw new Error("Could not read your IP address");
    }
    return data.ip;
  } finally {
    clearTimeout(timer);
  }
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
      ? result.employeeName + " Clock-in successful"
      : "Clock-in successful";
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

async function submitPunch(payload) {
  setEmployeeStatus("Submitting clock-in...");
  const result = await postToBackend(payload);
  await maybeNotifyArrival(result.locationStatus);
  setEmployeeStatus("Clock-in complete");
  if (ui.nameText) {
    ui.nameText.textContent = result.employeeName || "Identified automatically";
  }
  setEmployeeResult(resolvePunchMessage(result), false);
}

async function handlePunch() {
  const deviceUUID = getOrCreateDeviceUUID();
  setBusy(true);
  setEmployeeResult("", false);

  try {
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      throw new Error("Use HTTPS to clock in securely");
    }

    setEmployeeStatus("Getting IP address and location...");
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
    setEmployeeStatus("Clock-in failed");
    setEmployeeResult(error.message || "An unknown error occurred", true);
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

  setBusy(true);
  setEmployeeResult("", false);

  try {
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      throw new Error("Use HTTPS to submit a leave request securely");
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

    setEmployeeStatus("Submitted");
    setEmployeeResult((result.employeeName ? result.employeeName + " " : "") + "Leave request submitted for review", false);
    if (ui.leaveTypeSelect) ui.leaveTypeSelect.value = "";
    if (ui.leaveStartInput) ui.leaveStartInput.value = "";
    if (ui.leaveEndInput) ui.leaveEndInput.value = "";
    if (ui.leaveReasonTextarea) ui.leaveReasonTextarea.value = "";
  } catch (error) {
    setEmployeeStatus("Submission failed");
    setEmployeeResult(error.message || "An unknown error occurred", true);
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
        content += '<span class="cal-punch-item">' + escapeHtml(punch.time) + " " + label + "</span>";
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
}

function renderEmployees() {
  if (!ui.employeesBody) return;
  ui.employeesBody.replaceChildren();
  if (!employees.length) {
    const row = ui.employeesBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.textContent = "No employee accounts yet";
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
    edit.textContent = "Edit";
    edit.addEventListener("click", function () {
      ui.employeeIdInput.value = employee.employeeId;
      ui.employeeNameInput.value = employee.name || "";
      ui.employeePhoneInput.value = employee.phone || "";
      ui.employeeEmailInput.value = employee.email || "";
      ui.employeeDeviceInput.value = employee.deviceUUID || "";
      ui.saveEmployeeBtn.textContent = "Save changes";
      ui.cancelEmployeeBtn.hidden = false;
      ui.employeeNameInput.focus();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost-btn";
    remove.textContent = "Delete";
    remove.addEventListener("click", async function () {
      if (!window.confirm('Delete the employee account for "' + employee.name + '"? This device will no longer be able to sign in.')) return;
      try {
        setAdminStatus("Deleting employee...");
        await postToBackend({ action: "adminDeleteEmployee", token: getAdminToken(), employeeId: employee.employeeId });
        if (ui.employeeIdInput.value === employee.employeeId) resetEmployeeForm();
        await loadEmployees();
        setAdminStatus("Employee deleted");
        setAdminResult("Employee account deleted", false);
      } catch (error) {
        setAdminStatus("Could not delete employee");
        setAdminResult(error.message || "Unknown error", true);
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
    ui.logsBody.innerHTML = '<tr><td colspan="7">No records yet</td></tr>';
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
    ui.leaveBody.innerHTML = '<tr><td colspan="9">No records yet</td></tr>';
    return;
  }
  const statusLabels = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected"
  };
  ui.leaveBody.innerHTML = leaves
    .map(function (item) {
      const statusLabel = statusLabels[item.status] || escapeHtml(item.status);
      const actionCell =
        item.status === "pending"
          ? '<button class="ghost-btn" onclick="handleLeaveAction(\'' + escapeHtml(item.requestId) + '\',\'approved\')">Approve</button>' +
            '<button class="ghost-btn" onclick="handleLeaveAction(\'' + escapeHtml(item.requestId) + '\',\'rejected\')">Reject</button>'
          : statusLabel;
      const escapedId = escapeHtml(item.requestId);
      const shortId = escapedId.length > 8 ? escapedId.slice(0, 8) + "…" : escapedId;
      return '<tr>' +
        '<td title="' + escapedId + '">' + shortId + "</td>" +
        "<td>" + escapeHtml(item.employeeName) + "</td>" +
        "<td>" + escapeHtml(getLeaveTypeLabel(item.leaveType)) + "</td>" +
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

function getLeaveTypeLabel(value) {
  const labels = {
    sick: "Sick leave",
    personal: "Personal leave",
    annual: "Annual leave",
    other: "Other"
  };
  return labels[value] || value || "Unknown";
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
    setAdminStatus(status === "approved" ? "Approving..." : "Rejecting...");
    await postToBackend({
      action: "adminUpdateLeaveStatus",
      token: getAdminToken(),
      requestId: requestId,
      status: status
    });
    setAdminStatus(status === "approved" ? "Approved" : "Rejected");
    setAdminResult("", false);
    await loadLeaveRequests();
  } catch (error) {
    setAdminStatus("Action failed");
    setAdminResult(error.message || "Unknown error", true);
  }
}

window.handleLeaveAction = handleLeaveAction;

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
    [ui.adminViewCalendarLink, "calendar"]
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
  bindAdminViewNavigation();
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
        setAdminResult("Session expires: " + (data.expiresAt || "Unknown"), false);
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

  if (CONFIG.GAS_WEB_APP_URL) {
    // Public settings are independent of restoring the administrator session.
    void fetchPublicConfig().catch(function () {
      // Retain configured defaults; do not overwrite session or dashboard feedback.
    });
  }

  try {
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
