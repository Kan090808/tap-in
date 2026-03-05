const DEFAULT_CONFIG = {
  SPREADSHEET_ID: "REPLACE_WITH_SPREADSHEET_ID",
  LOG_SHEET_NAME: "AttendanceLogs",
  BINDING_SHEET_NAME: "DeviceBindings",
  EMPLOYEE_SHEET_NAME: "Employees",
  AUDIT_SHEET_NAME: "AuditLogs",
  OFFICE_STATIC_IP: "203.0.113.10",
  MAX_GPS_ACCURACY_METERS: 120,
  ADMIN_SESSION_HOURS: 12,
  ADMIN_LOGIN_MAX_FAILURES: 5,
  ADMIN_LOGIN_LOCK_MINUTES: 15,
  REQUEST_FRESHNESS_WINDOW_MS: 5 * 60 * 1000
};

const PROPERTY_KEYS = {
  SPREADSHEET_ID: "TAPIN_SPREADSHEET_ID",
  LOG_SHEET_NAME: "TAPIN_LOG_SHEET_NAME",
  BINDING_SHEET_NAME: "TAPIN_BINDING_SHEET_NAME",
  EMPLOYEE_SHEET_NAME: "TAPIN_EMPLOYEE_SHEET_NAME",
  AUDIT_SHEET_NAME: "TAPIN_AUDIT_SHEET_NAME",
  OFFICE_STATIC_IP: "TAPIN_OFFICE_STATIC_IP",
  MAX_GPS_ACCURACY_METERS: "TAPIN_MAX_GPS_ACCURACY_METERS",
  ADMIN_USERNAME: "TAPIN_ADMIN_USERNAME",
  ADMIN_PASSWORD_HASH: "TAPIN_ADMIN_PASSWORD_HASH",
  ADMIN_PASSWORD_SALT: "TAPIN_ADMIN_PASSWORD_SALT",
  ADMIN_SESSIONS_JSON: "TAPIN_ADMIN_SESSIONS_JSON",
  ADMIN_LOGIN_GUARD_JSON: "TAPIN_ADMIN_LOGIN_GUARD_JSON",
  REQUEST_NONCES_JSON: "TAPIN_REQUEST_NONCES_JSON"
};

function doPost(e) {
  try {
    const request = parseRequest_(e);
    const action = normalizeText_(request.action) || "punch";
    const runtimeConfig = getRuntimeConfig_();

    if (action === "adminLogin") {
      return handleAdminLogin_(request, runtimeConfig);
    }

    if (action === "adminLogout") {
      return handleAdminLogout_(request, runtimeConfig);
    }

    if (action === "adminGetConfig") {
      return handleAdminGetConfig_(request, runtimeConfig);
    }

    if (action === "adminUpdateConfig") {
      return handleAdminUpdateConfig_(request, runtimeConfig);
    }

    if (action === "adminGetLogs") {
      return handleAdminGetLogs_(request, runtimeConfig);
    }

    if (action === "punch") {
      return handlePunch_(request, runtimeConfig);
    }

    if (action === "registerDevice") {
      return handleRegisterDevice_(request, runtimeConfig);
    }

    return jsonResponse_(false, "Unsupported action");
  } catch (error) {
    return jsonResponse_(false, error.message || "Unknown server error");
  }
}

function doGet(e) {
  try {
    const action = normalizeText_(e && e.parameter ? e.parameter.action : "");
    if (action === "publicConfig") {
      const runtimeConfig = getRuntimeConfig_();
      return jsonResponse_(true, "Public config", {
        config: {
          officeStaticIp: runtimeConfig.officeStaticIp,
          maxGpsAccuracyMeters: runtimeConfig.maxGpsAccuracyMeters
        }
      });
    }
    return jsonResponse_(true, "TapIn GAS is running");
  } catch (error) {
    return jsonResponse_(false, error.message || "Unknown server error");
  }
}

function handlePunch_(request, runtimeConfig) {
  validatePunchRequest_(request, runtimeConfig);
  requireFreshRequest_(request, "punch", DEFAULT_CONFIG.REQUEST_FRESHNESS_WINDOW_MS);

  const binding = findBindingByDeviceUUID_(runtimeConfig, request.deviceUUID);
  if (!binding.employeeName) {
    throw new Error("此裝置尚未註冊，請先掃描 QR Code 註冊");
  }
  const employeeName = binding.employeeName;

  const locationStatus = request.ipAddress === runtimeConfig.officeStaticIp ? "Office" : "Remote/Field";
  const serverTime = new Date();

  appendAttendanceLog_(runtimeConfig, {
    timestamp: serverTime.toISOString(),
    name: employeeName,
    deviceUUID: request.deviceUUID,
    ipAddress: request.ipAddress,
    locationStatus: locationStatus,
    latitude: request.latitude,
    longitude: request.longitude
  });

  return jsonResponse_(true, "Punch success", {
    serverTime: serverTime.toISOString(),
    locationStatus: locationStatus,
    isRegistered: true,
    employeeName: employeeName,
    punchMessage: employeeName + " 打卡成功"
  });
}

function handleRegisterDevice_(request, runtimeConfig) {
  validateRegisterRequest_(request);
  requireFreshRequest_(request, "registerDevice", DEFAULT_CONFIG.REQUEST_FRESHNESS_WINDOW_MS);

  assertEmployeeExistsInRoster_(runtimeConfig, request.name);

  const deviceBinding = findBindingByDeviceUUID_(runtimeConfig, request.deviceUUID);
  if (deviceBinding.employeeName) {
    throw new Error("此裝置已綁定姓名，請聯絡管理員移除後再註冊");
  }

  const nameBinding = findBindingByEmployeeName_(runtimeConfig, request.name);
  if (nameBinding.deviceUUID) {
    throw new Error("此姓名已綁定裝置，請聯絡管理員移除後再註冊");
  }

  const sheet = getOrCreateSheet_(runtimeConfig, runtimeConfig.bindingSheetName, [
    "Employee Name",
    "Device UUID",
    "Bound At"
  ]);
  sheet.appendRow([request.name, request.deviceUUID, new Date().toISOString()]);

  return jsonResponse_(true, "Register success", {
    employeeName: request.name,
    registerMessage: request.name + " 註冊成功"
  });
}

function handleAdminLogin_(request, runtimeConfig) {
  const username = normalizeText_(request.username);
  const password = String(request.password == null ? "" : request.password);
  if (!username || !password) {
    return jsonResponse_(false, "Username and password are required");
  }

  checkAdminLoginAllowed_(username);

  const properties = PropertiesService.getScriptProperties();
  const configuredUsername = normalizeText_(properties.getProperty(PROPERTY_KEYS.ADMIN_USERNAME));
  const passwordHash = normalizeText_(properties.getProperty(PROPERTY_KEYS.ADMIN_PASSWORD_HASH));
  const passwordSalt = normalizeText_(properties.getProperty(PROPERTY_KEYS.ADMIN_PASSWORD_SALT));

  if (!configuredUsername || !passwordHash || !passwordSalt) {
    return jsonResponse_(false, "Admin credential is not initialized");
  }

  const computedHash = sha256Hex_(passwordSalt + password);
  if (configuredUsername !== username || computedHash !== passwordHash) {
    recordAdminLoginFailure_(username);
    appendAuditLogSafe_(runtimeConfig, {
      eventType: "ADMIN_LOGIN_FAILED",
      username: username,
      detail: "Invalid credential"
    });
    return jsonResponse_(false, "Invalid admin credential");
  }

  recordAdminLoginSuccess_(username);
  const session = createAdminSession_(username);
  appendAuditLogSafe_(runtimeConfig, {
    eventType: "ADMIN_LOGIN_SUCCESS",
    username: username,
    detail: "Login success"
  });
  return jsonResponse_(true, "Login success", {
    token: session.token,
    expiresAt: session.expiresAt
  });
}

function handleAdminLogout_(request, runtimeConfig) {
  const token = normalizeText_(request.token);
  if (!token) {
    return jsonResponse_(true, "Logged out");
  }
  const sessions = getAdminSessions_();
  const item = sessions[token];
  deleteAdminSession_(token);
  appendAuditLogSafe_(runtimeConfig, {
    eventType: "ADMIN_LOGOUT",
    username: item ? item.username : "",
    detail: "Logout"
  });
  return jsonResponse_(true, "Logged out");
}

function handleAdminGetConfig_(request, runtimeConfig) {
  requireAdminSession_(request);
  return jsonResponse_(true, "Config loaded", {
    config: {
      spreadsheetId: runtimeConfig.spreadsheetId,
      officeStaticIp: runtimeConfig.officeStaticIp,
      logSheetName: runtimeConfig.logSheetName,
      bindingSheetName: runtimeConfig.bindingSheetName,
      auditSheetName: runtimeConfig.auditSheetName,
      maxGpsAccuracyMeters: runtimeConfig.maxGpsAccuracyMeters
    }
  });
}

function handleAdminUpdateConfig_(request, runtimeConfig) {
  const adminUsername = requireAdminSession_(request);

  const nextSpreadsheetId = normalizeText_(request.spreadsheetId) || runtimeConfig.spreadsheetId;
  const nextOfficeStaticIp = normalizeText_(request.officeStaticIp) || runtimeConfig.officeStaticIp;
  const nextLogSheetName = normalizeText_(request.logSheetName) || runtimeConfig.logSheetName;
  const nextBindingSheetName = normalizeText_(request.bindingSheetName) || runtimeConfig.bindingSheetName;
  const nextMaxAccuracyRaw = request.maxGpsAccuracyMeters;
  const nextMaxAccuracy = Number(
    nextMaxAccuracyRaw == null || nextMaxAccuracyRaw === "" ? runtimeConfig.maxGpsAccuracyMeters : nextMaxAccuracyRaw
  );

  if (!nextSpreadsheetId) {
    return jsonResponse_(false, "Spreadsheet ID is required");
  }
  if (!nextOfficeStaticIp) {
    return jsonResponse_(false, "Office static IP is required");
  }
  if (!nextLogSheetName) {
    return jsonResponse_(false, "Log sheet name is required");
  }
  if (!nextBindingSheetName) {
    return jsonResponse_(false, "Binding sheet name is required");
  }
  if (!Number.isFinite(nextMaxAccuracy) || nextMaxAccuracy <= 0) {
    return jsonResponse_(false, "Max GPS accuracy must be a positive number");
  }

  const properties = PropertiesService.getScriptProperties();
  properties.setProperties({
    TAPIN_SPREADSHEET_ID: nextSpreadsheetId,
    TAPIN_OFFICE_STATIC_IP: nextOfficeStaticIp,
    TAPIN_LOG_SHEET_NAME: nextLogSheetName,
    TAPIN_BINDING_SHEET_NAME: nextBindingSheetName,
    TAPIN_MAX_GPS_ACCURACY_METERS: String(Math.round(nextMaxAccuracy))
  }, true);

  const updatedConfig = getRuntimeConfig_();
  appendAuditLogSafe_(updatedConfig, {
    eventType: "ADMIN_CONFIG_UPDATED",
    username: adminUsername,
    detail: "Config updated"
  });
  return jsonResponse_(true, "Config updated", {
    config: {
      spreadsheetId: updatedConfig.spreadsheetId,
      officeStaticIp: updatedConfig.officeStaticIp,
      logSheetName: updatedConfig.logSheetName,
      bindingSheetName: updatedConfig.bindingSheetName,
      auditSheetName: updatedConfig.auditSheetName,
      maxGpsAccuracyMeters: updatedConfig.maxGpsAccuracyMeters
    }
  });
}

function handleAdminGetLogs_(request, runtimeConfig) {
  requireAdminSession_(request);
  const limit = sanitizeLimit_(request.limit);
  const sheet = getSheetIfExists_(runtimeConfig, runtimeConfig.logSheetName);
  if (!sheet) {
    return jsonResponse_(true, "No logs", { logs: [] });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse_(true, "No logs", { logs: [] });
  }

  const rowsToRead = Math.min(limit, lastRow - 1);
  const startRow = lastRow - rowsToRead + 1;
  const values = sheet.getRange(startRow, 1, rowsToRead, 7).getValues();
  values.reverse();

  const logs = values.map(function (row) {
    return {
      timestamp: normalizeText_(row[0]),
      employeeName: normalizeText_(row[1]),
      deviceUUID: normalizeText_(row[2]),
      ipAddress: normalizeText_(row[3]),
      locationStatus: normalizeText_(row[4]),
      latitude: normalizeText_(row[5]),
      longitude: normalizeText_(row[6])
    };
  });

  return jsonResponse_(true, "Logs loaded", { logs: logs });
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (_error) {
    throw new Error("Body must be valid JSON");
  }
}

function validatePunchRequest_(request, runtimeConfig) {
  const deviceUUID = normalizeText_(request.deviceUUID);
  const ipAddress = normalizeText_(request.ipAddress);
  const latitude = Number(request.latitude);
  const longitude = Number(request.longitude);
  const accuracyMeters = Number(request.accuracyMeters);
  const requestTimestamp = Number(request.requestTimestamp);
  const requestId = normalizeText_(request.requestId);
  const originProtocol = normalizeText_(request.originProtocol).toLowerCase();
  const originHost = normalizeText_(request.originHost).toLowerCase();

  if (!deviceUUID) {
    throw new Error("Missing device UUID");
  }
  if (!ipAddress) {
    throw new Error("Missing public IP");
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Invalid geolocation coordinates");
  }
  if (!Number.isFinite(accuracyMeters)) {
    throw new Error("Missing GPS accuracy");
  }
  if (!Number.isFinite(requestTimestamp)) {
    throw new Error("Missing request timestamp");
  }
  if (!requestId) {
    throw new Error("Missing request id");
  }
  if (accuracyMeters > runtimeConfig.maxGpsAccuracyMeters) {
    throw new Error("GPS accuracy too low");
  }
  if (!originProtocol) {
    throw new Error("Missing protocol metadata");
  }

  request.deviceUUID = deviceUUID;
  request.ipAddress = ipAddress;
  request.latitude = Number(latitude.toFixed(7));
  request.longitude = Number(longitude.toFixed(7));
  request.requestTimestamp = Math.round(requestTimestamp);
  request.requestId = requestId;
  request.originProtocol = originProtocol;
  request.originHost = originHost;
}

function validateRegisterRequest_(request) {
  const name = normalizeText_(request.name);
  const deviceUUID = normalizeText_(request.deviceUUID);
  const requestTimestamp = Number(request.requestTimestamp);
  const requestId = normalizeText_(request.requestId);
  const originProtocol = normalizeText_(request.originProtocol).toLowerCase();

  if (!name) {
    throw new Error("Missing employee name");
  }
  if (!deviceUUID) {
    throw new Error("Missing device UUID");
  }
  if (!Number.isFinite(requestTimestamp)) {
    throw new Error("Missing request timestamp");
  }
  if (!requestId) {
    throw new Error("Missing request id");
  }
  if (!originProtocol) {
    throw new Error("Missing protocol metadata");
  }

  request.name = name;
  request.deviceUUID = deviceUUID;
  request.requestTimestamp = Math.round(requestTimestamp);
  request.requestId = requestId;
  request.originProtocol = originProtocol;
}

function appendAttendanceLog_(runtimeConfig, log) {
  const sheet = getOrCreateSheet_(runtimeConfig, runtimeConfig.logSheetName, [
    "Timestamp",
    "Employee Name",
    "Device UUID",
    "IP Address",
    "Location Status",
    "Latitude",
    "Longitude"
  ]);

  sheet.appendRow([
    log.timestamp,
    log.name,
    log.deviceUUID,
    log.ipAddress,
    log.locationStatus,
    log.latitude,
    log.longitude
  ]);
}

function findBindingByDeviceUUID_(runtimeConfig, deviceUUID) {
  const sheet = getSheetIfExists_(runtimeConfig, runtimeConfig.bindingSheetName);
  if (!sheet) {
    return { employeeName: "", deviceUUID: "" };
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { employeeName: "", deviceUUID: "" };
  }
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (let i = 0; i < data.length; i += 1) {
    const rowName = normalizeText_(data[i][0]);
    const rowUUID = normalizeText_(data[i][1]);
    if (rowUUID === deviceUUID) {
      return { employeeName: rowName, deviceUUID: rowUUID };
    }
  }
  return { employeeName: "", deviceUUID: "" };
}

function findBindingByEmployeeName_(runtimeConfig, employeeName) {
  const sheet = getSheetIfExists_(runtimeConfig, runtimeConfig.bindingSheetName);
  if (!sheet) {
    return { employeeName: "", deviceUUID: "" };
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { employeeName: "", deviceUUID: "" };
  }
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (let i = 0; i < data.length; i += 1) {
    const rowName = normalizeText_(data[i][0]);
    const rowUUID = normalizeText_(data[i][1]);
    if (rowName === employeeName) {
      return { employeeName: rowName, deviceUUID: rowUUID };
    }
  }
  return { employeeName: "", deviceUUID: "" };
}

function assertEmployeeExistsInRoster_(runtimeConfig, employeeName) {
  const sheet = getSheetIfExists_(runtimeConfig, runtimeConfig.employeeSheetName);
  if (!sheet) {
    throw new Error("員工名單表不存在，請先建立 Employees 表");
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    throw new Error("員工名單表沒有資料，請先建立員工名單");
  }
  const values = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = 0; i < values.length; i += 1) {
    const rowName = normalizeText_(values[i][0]);
    if (rowName === employeeName) {
      return;
    }
  }
  throw new Error("姓名不在員工名單內，無法註冊");
}

function getRuntimeConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId =
    normalizeText_(properties.getProperty(PROPERTY_KEYS.SPREADSHEET_ID)) || DEFAULT_CONFIG.SPREADSHEET_ID;
  const officeStaticIp =
    normalizeText_(properties.getProperty(PROPERTY_KEYS.OFFICE_STATIC_IP)) || DEFAULT_CONFIG.OFFICE_STATIC_IP;
  const logSheetName =
    normalizeText_(properties.getProperty(PROPERTY_KEYS.LOG_SHEET_NAME)) || DEFAULT_CONFIG.LOG_SHEET_NAME;
  const bindingSheetName =
    normalizeText_(properties.getProperty(PROPERTY_KEYS.BINDING_SHEET_NAME)) || DEFAULT_CONFIG.BINDING_SHEET_NAME;
  const employeeSheetName =
    normalizeText_(properties.getProperty(PROPERTY_KEYS.EMPLOYEE_SHEET_NAME)) || DEFAULT_CONFIG.EMPLOYEE_SHEET_NAME;
  const auditSheetName =
    normalizeText_(properties.getProperty(PROPERTY_KEYS.AUDIT_SHEET_NAME)) || DEFAULT_CONFIG.AUDIT_SHEET_NAME;
  const maxGpsAccuracyRaw =
    normalizeText_(properties.getProperty(PROPERTY_KEYS.MAX_GPS_ACCURACY_METERS)) ||
    String(DEFAULT_CONFIG.MAX_GPS_ACCURACY_METERS);
  const maxGpsAccuracyMeters = Number(maxGpsAccuracyRaw);

  if (!spreadsheetId || spreadsheetId === "REPLACE_WITH_SPREADSHEET_ID") {
    throw new Error("Spreadsheet ID is not configured");
  }
  if (!Number.isFinite(maxGpsAccuracyMeters) || maxGpsAccuracyMeters <= 0) {
    throw new Error("Invalid MAX_GPS_ACCURACY_METERS");
  }

  return {
    spreadsheetId: spreadsheetId,
    officeStaticIp: officeStaticIp,
    logSheetName: logSheetName,
    bindingSheetName: bindingSheetName,
    employeeSheetName: employeeSheetName,
    auditSheetName: auditSheetName,
    maxGpsAccuracyMeters: Math.round(maxGpsAccuracyMeters)
  };
}

function getSpreadsheet_(runtimeConfig) {
  return SpreadsheetApp.openById(runtimeConfig.spreadsheetId);
}

function getSheetIfExists_(runtimeConfig, sheetName) {
  const ss = getSpreadsheet_(runtimeConfig);
  return ss.getSheetByName(sheetName);
}

function getOrCreateSheet_(runtimeConfig, sheetName, headers) {
  const ss = getSpreadsheet_(runtimeConfig);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function sanitizeLimit_(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit)) {
    return 50;
  }
  if (limit < 1) {
    return 1;
  }
  if (limit > 500) {
    return 500;
  }
  return Math.round(limit);
}

function requireAdminSession_(request) {
  const token = normalizeText_(request.token);
  if (!token) {
    throw new Error("Admin token is required");
  }
  const sessions = getAdminSessions_();
  const item = sessions[token];
  if (!item) {
    throw new Error("Admin session expired");
  }
  const now = Date.now();
  if (item.expiresAt <= now) {
    delete sessions[token];
    setAdminSessions_(sessions);
    throw new Error("Admin session expired");
  }
  return item.username;
}

function createAdminSession_(username) {
  const now = Date.now();
  const expiresAt = now + DEFAULT_CONFIG.ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const sessions = getAdminSessions_();
  const keys = Object.keys(sessions);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (sessions[key] && sessions[key].username === username) {
      delete sessions[key];
    }
  }
  sessions[token] = {
    username: username,
    expiresAt: expiresAt
  };
  setAdminSessions_(sessions);
  return {
    token: token,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

function deleteAdminSession_(token) {
  const sessions = getAdminSessions_();
  if (sessions[token]) {
    delete sessions[token];
    setAdminSessions_(sessions);
  }
}

function getAdminSessions_() {
  const properties = PropertiesService.getScriptProperties();
  const raw = normalizeText_(properties.getProperty(PROPERTY_KEYS.ADMIN_SESSIONS_JSON));
  if (!raw) {
    return {};
  }
  try {
    const sessions = JSON.parse(raw);
    if (typeof sessions !== "object" || sessions == null || Array.isArray(sessions)) {
      return {};
    }
    const now = Date.now();
    const cleaned = {};
    let changed = false;
    const keys = Object.keys(sessions);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const value = sessions[key];
      if (!value || typeof value !== "object") {
        changed = true;
        continue;
      }
      const username = normalizeText_(value.username);
      const expiresAt = Number(value.expiresAt);
      if (!username || !Number.isFinite(expiresAt) || expiresAt <= now) {
        changed = true;
        continue;
      }
      cleaned[key] = {
        username: username,
        expiresAt: expiresAt
      };
    }
    if (changed || Object.keys(cleaned).length !== Object.keys(sessions).length) {
      setAdminSessions_(cleaned);
    }
    return cleaned;
  } catch (_error) {
    return {};
  }
}

function checkAdminLoginAllowed_(username) {
  const guards = getAdminLoginGuards_();
  const item = guards[username];
  if (!item) {
    return;
  }
  const now = Date.now();
  const lockedUntil = Number(item.lockedUntil || 0);
  if (Number.isFinite(lockedUntil) && lockedUntil > now) {
    throw new Error("Too many failed attempts. Please try again later");
  }
}

function recordAdminLoginFailure_(username) {
  const guards = getAdminLoginGuards_();
  const now = Date.now();
  const lockMs = DEFAULT_CONFIG.ADMIN_LOGIN_LOCK_MINUTES * 60 * 1000;
  const windowStart = now - lockMs;
  const current = guards[username] || { count: 0, firstFailedAt: now, lockedUntil: 0 };
  const firstFailedAt = Number(current.firstFailedAt || now);
  const count = firstFailedAt < windowStart ? 1 : Number(current.count || 0) + 1;
  const next = {
    count: count,
    firstFailedAt: firstFailedAt < windowStart ? now : firstFailedAt,
    lockedUntil: count >= DEFAULT_CONFIG.ADMIN_LOGIN_MAX_FAILURES ? now + lockMs : 0
  };
  guards[username] = next;
  setAdminLoginGuards_(guards);
}

function recordAdminLoginSuccess_(username) {
  const guards = getAdminLoginGuards_();
  if (guards[username]) {
    delete guards[username];
    setAdminLoginGuards_(guards);
  }
}

function getAdminLoginGuards_() {
  const properties = PropertiesService.getScriptProperties();
  const raw = normalizeText_(properties.getProperty(PROPERTY_KEYS.ADMIN_LOGIN_GUARD_JSON));
  if (!raw) {
    return {};
  }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }
    const now = Date.now();
    const cleaned = {};
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i += 1) {
      const key = normalizeText_(keys[i]);
      const value = data[keys[i]];
      if (!key || !value || typeof value !== "object") {
        continue;
      }
      const count = Number(value.count || 0);
      const firstFailedAt = Number(value.firstFailedAt || 0);
      const lockedUntil = Number(value.lockedUntil || 0);
      if (!Number.isFinite(count) || !Number.isFinite(firstFailedAt) || !Number.isFinite(lockedUntil)) {
        continue;
      }
      if (lockedUntil > 0 && lockedUntil <= now && firstFailedAt < now - DEFAULT_CONFIG.ADMIN_LOGIN_LOCK_MINUTES * 60 * 1000) {
        continue;
      }
      cleaned[key] = {
        count: Math.max(0, Math.round(count)),
        firstFailedAt: firstFailedAt,
        lockedUntil: Math.max(0, Math.round(lockedUntil))
      };
    }
    return cleaned;
  } catch (_error) {
    return {};
  }
}

function setAdminLoginGuards_(guards) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(PROPERTY_KEYS.ADMIN_LOGIN_GUARD_JSON, JSON.stringify(guards || {}));
}

function requireFreshRequest_(request, action, maxAgeMs) {
  const now = Date.now();
  const requestTimestamp = Number(request.requestTimestamp);
  const requestId = normalizeText_(request.requestId);
  if (!Number.isFinite(requestTimestamp) || !requestId) {
    throw new Error("Invalid request metadata");
  }
  if (Math.abs(now - requestTimestamp) > maxAgeMs) {
    throw new Error("Request expired");
  }

  const nonces = getRequestNonces_();
  const key = normalizeText_(action) + ":" + requestId;
  const existingExpiresAt = Number(nonces[key] || 0);
  if (existingExpiresAt > now) {
    throw new Error("Duplicated request");
  }

  nonces[key] = now + maxAgeMs;
  setRequestNonces_(nonces);
}

function getRequestNonces_() {
  const properties = PropertiesService.getScriptProperties();
  const raw = normalizeText_(properties.getProperty(PROPERTY_KEYS.REQUEST_NONCES_JSON));
  if (!raw) {
    return {};
  }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }
    const now = Date.now();
    const cleaned = {};
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i += 1) {
      const key = normalizeText_(keys[i]);
      const expiresAt = Number(data[keys[i]]);
      if (!key || !Number.isFinite(expiresAt) || expiresAt <= now) {
        continue;
      }
      cleaned[key] = Math.round(expiresAt);
    }
    return cleaned;
  } catch (_error) {
    return {};
  }
}

function setRequestNonces_(nonces) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(PROPERTY_KEYS.REQUEST_NONCES_JSON, JSON.stringify(nonces || {}));
}

function appendAuditLogSafe_(runtimeConfig, event) {
  try {
    appendAuditLog_(runtimeConfig, event);
  } catch (_error) {
  }
}

function appendAuditLog_(runtimeConfig, event) {
  const sheet = getOrCreateSheet_(runtimeConfig, runtimeConfig.auditSheetName, [
    "Timestamp",
    "Event Type",
    "Username",
    "Detail"
  ]);

  sheet.appendRow([
    new Date().toISOString(),
    normalizeText_(event.eventType),
    normalizeText_(event.username),
    normalizeText_(event.detail)
  ]);
}

function setAdminSessions_(sessions) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(PROPERTY_KEYS.ADMIN_SESSIONS_JSON, JSON.stringify(sessions || {}));
}

function normalizeText_(value) {
  return String(value == null ? "" : value).trim();
}

function sha256Hex_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  let hex = "";
  for (let i = 0; i < digest.length; i += 1) {
    let part = (digest[i] + 256).toString(16);
    if (part.length > 2) {
      part = part.slice(part.length - 2);
    }
    if (part.length < 2) {
      part = "0" + part;
    }
    hex += part;
  }
  return hex;
}

function jsonResponse_(ok, message, extra) {
  const body = Object.assign(
    {
      ok: ok,
      message: message
    },
    extra || {}
  );
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function setAdminCredential(username, password) {
  const cleanUsername = normalizeText_(username);
  const textPassword = String(password == null ? "" : password);
  if (!cleanUsername || !textPassword) {
    throw new Error("username and password are required");
  }

  const salt = Utilities.getUuid().replace(/-/g, "");
  const hash = sha256Hex_(salt + textPassword);
  const properties = PropertiesService.getScriptProperties();
  properties.setProperties(
    {
      TAPIN_ADMIN_USERNAME: cleanUsername,
      TAPIN_ADMIN_PASSWORD_SALT: salt,
      TAPIN_ADMIN_PASSWORD_HASH: hash
    },
    true
  );
}
