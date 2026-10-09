const DEFAULT_CONFIG = {
  SPREADSHEET_ID: "12UH7PjOv9qbhh2yhJwdC5KvFeFHvpaNdWRHVptaliVo",
  LOG_SHEET_NAME: "AttendanceLogs",
  BINDING_SHEET_NAME: "DeviceBindings",
  EMPLOYEE_SHEET_NAME: "Employees",
  AUDIT_SHEET_NAME: "AuditLogs",
  OFFICE_STATIC_IP: "203.0.113.10",
  MAX_GPS_ACCURACY_METERS: 120,
  LEAVE_SHEET_NAME: "LeaveRequests",
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
  REQUEST_NONCES_JSON: "TAPIN_REQUEST_NONCES_JSON",
  LEAVE_SHEET_NAME: "TAPIN_LEAVE_SHEET_NAME"
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

    if (action === "adminGetEmployees") {
      return handleAdminGetEmployees_(request, runtimeConfig);
    }

    if (action === "adminSaveEmployee") {
      return handleAdminSaveEmployee_(request, runtimeConfig);
    }

    if (action === "adminDeleteEmployee") {
      return handleAdminDeleteEmployee_(request, runtimeConfig);
    }

    if (action === "punch") {
      return handlePunch_(request, runtimeConfig);
    }

    if (action === "submitLeave") {
      return handleSubmitLeave_(request, runtimeConfig);
    }

    if (action === "adminGetLeaveRequests") {
      return handleAdminGetLeaveRequests_(request, runtimeConfig);
    }

    if (action === "adminUpdateLeaveStatus") {
      return handleAdminUpdateLeaveStatus_(request, runtimeConfig);
    }

    if (action === "adminGetCalendar") {
      return handleAdminGetCalendar_(request, runtimeConfig);
    }

    if (action === "employeeGetCalendar") {
      return handleEmployeeGetCalendar_(request, runtimeConfig);
    }

    if (action === "employeeResolveSession") {
      return handleEmployeeResolveSession_(request, runtimeConfig);
    }

    return jsonResponse_(false, "Unsupported action");
  } catch (error) {
    return jsonResponse_(false, error.message || "Unknown server error");
  }
}

function doGet(e) {
  try {
    const action = normalizeText_(e && e.parameter ? e.parameter.action : "");
    if (action === "serverTime") {
      const now = new Date();
      return jsonResponse_(true, "Server time", {
        serverTime: now.toISOString(),
        serverTimestampMs: now.getTime()
      });
    }
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
    throw new Error("This device is not registered. Please send your Device ID to an administrator.");
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
    punchMessage: employeeName + " punched in successfully"
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
      leaveSheetName: runtimeConfig.leaveSheetName,
      maxGpsAccuracyMeters: runtimeConfig.maxGpsAccuracyMeters
    }
  });
}

function handleAdminUpdateConfig_(request, runtimeConfig) {
  const adminUsername = requireAdminSession_(request);

  const requestedSpreadsheet = normalizeText_(request.spreadsheetId);
  const nextSpreadsheetId = requestedSpreadsheet ? parseSpreadsheetId_(requestedSpreadsheet) : runtimeConfig.spreadsheetId;
  const nextOfficeStaticIp = normalizeText_(request.officeStaticIp) || runtimeConfig.officeStaticIp;
  const nextLogSheetName = normalizeText_(request.logSheetName) || runtimeConfig.logSheetName;
  const nextBindingSheetName = normalizeText_(request.bindingSheetName) || runtimeConfig.bindingSheetName;
  const nextLeaveSheetName = normalizeText_(request.leaveSheetName) || runtimeConfig.leaveSheetName;
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
  if (!nextLeaveSheetName) {
    return jsonResponse_(false, "Leave sheet name is required");
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
    TAPIN_LEAVE_SHEET_NAME: nextLeaveSheetName,
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
      leaveSheetName: updatedConfig.leaveSheetName,
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

function handleAdminGetEmployees_(request, runtimeConfig) {
  requireAdminSession_(request);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return jsonResponse_(true, "Employees loaded", {
      employees: readEmployees_(getEmployeeSheet_(runtimeConfig), runtimeConfig).map(publicEmployee_)
    });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminSaveEmployee_(request, runtimeConfig) {
  const adminUsername = requireAdminSession_(request);
  const employeeId = normalizeText_(request.employeeId);
  const name = normalizeText_(request.name);
  const phone = normalizeText_(request.phone);
  const email = normalizeText_(request.email);
  const deviceUUID = normalizeText_(request.deviceUUID);
  if (!name) throw new Error("Employee name is required");
  if ([name, phone, email, deviceUUID].some(function (value) { return value.charAt(0) === "="; })) {
    throw new Error("Invalid employee field");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email address");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getEmployeeSheet_(runtimeConfig);
    const employees = readEmployees_(sheet, runtimeConfig);
    const existing = employees.filter(function (item) { return item.employeeId === employeeId; })[0];
    if (employeeId && !existing) throw new Error("Employee not found. Refresh the list and try again.");
    for (let i = 0; i < employees.length; i += 1) {
      const item = employees[i];
      if (existing && item.employeeId === existing.employeeId) continue;
      if (item.name === name) throw new Error("An employee with this name already exists");
      if (deviceUUID && item.deviceUUID === deviceUUID) throw new Error("This Device ID is already assigned to another employee");
    }

    const bindingSheet = getOrCreateSheet_(runtimeConfig, runtimeConfig.bindingSheetName, [
      "Employee Name", "Device UUID", "Bound At"
    ]);
    const bindingRows = bindingSheet.getLastRow() > 1
      ? bindingSheet.getRange(2, 1, bindingSheet.getLastRow() - 1, 2).getValues() : [];
    for (let i = 0; i < bindingRows.length; i += 1) {
      const boundName = normalizeText_(bindingRows[i][0]);
      const boundDevice = normalizeText_(bindingRows[i][1]);
      if (deviceUUID && boundDevice === deviceUUID && (!existing || boundName !== existing.name)) {
        throw new Error("This Device ID is already assigned to another employee");
      }
    }

    const saved = {
      employeeId: existing ? existing.employeeId : Utilities.getUuid(),
      name: name,
      phone: phone,
      email: email,
      deviceUUID: deviceUUID
    };
    const rowValues = [saved.name, saved.phone, saved.email, saved.deviceUUID, saved.employeeId];
    if (existing) {
      sheet.getRange(existing.rowNumber, 1, 1, 5).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    removeEmployeeBindings_(bindingSheet, existing ? existing.name : "", existing ? existing.deviceUUID : "");
    if (deviceUUID) bindingSheet.appendRow([name, deviceUUID, new Date().toISOString()]);
    appendAuditLogSafe_(runtimeConfig, {
      eventType: existing ? "EMPLOYEE_UPDATED" : "EMPLOYEE_CREATED",
      username: adminUsername,
      detail: "EmployeeID=" + saved.employeeId + " Name=" + name
    });
    return jsonResponse_(true, "Employee saved", { employee: saved });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminDeleteEmployee_(request, runtimeConfig) {
  const adminUsername = requireAdminSession_(request);
  const employeeId = normalizeText_(request.employeeId);
  if (!employeeId) throw new Error("Employee ID is required");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getEmployeeSheet_(runtimeConfig);
    const employee = readEmployees_(sheet, runtimeConfig).filter(function (item) {
      return item.employeeId === employeeId;
    })[0];
    if (!employee) throw new Error("Employee not found. Refresh the list and try again.");
    const bindingSheet = getSheetIfExists_(runtimeConfig, runtimeConfig.bindingSheetName);
    if (bindingSheet) removeEmployeeBindings_(bindingSheet, employee.name, employee.deviceUUID);
    sheet.deleteRow(employee.rowNumber);
    appendAuditLogSafe_(runtimeConfig, {
      eventType: "EMPLOYEE_DELETED",
      username: adminUsername,
      detail: "EmployeeID=" + employeeId + " Name=" + employee.name
    });
    return jsonResponse_(true, "Employee deleted", { employeeId: employeeId });
  } finally {
    lock.releaseLock();
  }
}

function getEmployeeSheet_(runtimeConfig) {
  const headers = ["Employee Name", "Phone", "Email", "Device UUID", "Employee ID"];
  const sheet = getOrCreateSheet_(runtimeConfig, runtimeConfig.employeeSheetName, headers);
  const firstCell = normalizeText_(sheet.getRange(1, 1).getValue());
  if (firstCell !== "Employee Name" && firstCell !== "Name") sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, 5).setValues([headers]);
  return sheet;
}

function readEmployees_(sheet, runtimeConfig) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const bindingSheet = getSheetIfExists_(runtimeConfig, runtimeConfig.bindingSheetName);
  const bindingValues = bindingSheet && bindingSheet.getLastRow() > 1
    ? bindingSheet.getRange(2, 1, bindingSheet.getLastRow() - 1, 2).getValues() : [];
  const bindingsByName = {};
  for (let i = 0; i < bindingValues.length; i += 1) {
    const name = normalizeText_(bindingValues[i][0]);
    const deviceUUID = normalizeText_(bindingValues[i][1]);
    if (name && deviceUUID) bindingsByName[name] = deviceUUID;
  }
  const employees = [];
  for (let i = 0; i < values.length; i += 1) {
    const name = normalizeText_(values[i][0]);
    if (!name) continue;
    const rowNumber = i + 2;
    let deviceUUID = normalizeText_(values[i][3]);
    let employeeId = normalizeText_(values[i][4]);
    if (!deviceUUID && bindingsByName[name]) {
      deviceUUID = bindingsByName[name];
      sheet.getRange(rowNumber, 4).setValue(deviceUUID);
    }
    if (!employeeId) {
      employeeId = Utilities.getUuid();
      sheet.getRange(rowNumber, 5).setValue(employeeId);
    }
    employees.push({
      employeeId: employeeId,
      name: name,
      phone: normalizeText_(values[i][1]),
      email: normalizeText_(values[i][2]),
      deviceUUID: deviceUUID,
      rowNumber: rowNumber
    });
  }
  return employees;
}

function publicEmployee_(employee) {
  return {
    employeeId: employee.employeeId,
    name: employee.name,
    phone: employee.phone,
    email: employee.email,
    deviceUUID: employee.deviceUUID
  };
}

function removeEmployeeBindings_(sheet, employeeName, deviceUUID) {
  if (sheet.getLastRow() < 2) return;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const name = normalizeText_(values[i][0]);
    const uuid = normalizeText_(values[i][1]);
    if ((employeeName && name === employeeName) || (deviceUUID && uuid === deviceUUID)) {
      sheet.deleteRow(i + 2);
    }
  }
}

function handleSubmitLeave_(request, runtimeConfig) {
  validateLeaveRequest_(request);
  requireFreshRequest_(request, "submitLeave", DEFAULT_CONFIG.REQUEST_FRESHNESS_WINDOW_MS);

  const binding = findBindingByDeviceUUID_(runtimeConfig, request.deviceUUID);
  if (!binding.employeeName) {
    throw new Error("This device is not registered. Please send your Device ID to an administrator.");
  }

  const leaveSheet = getOrCreateSheet_(runtimeConfig, runtimeConfig.leaveSheetName, [
    "RequestID", "EmployeeName", "DeviceUUID", "LeaveType",
    "StartDate", "EndDate", "Reason", "Status",
    "SubmittedAt", "ReviewedAt", "ReviewedBy", "ReviewNote"
  ]);
  leaveSheet.appendRow([
    request.requestId,
    binding.employeeName,
    request.deviceUUID,
    request.leaveType,
    request.startDate,
    request.endDate,
    request.reason,
    "pending",
    new Date().toISOString(),
    "", "", ""
  ]);

  return jsonResponse_(true, "Leave request submitted", {
    employeeName: binding.employeeName,
    requestId: request.requestId
  });
}

function validateLeaveRequest_(request) {
  const deviceUUID = normalizeText_(request.deviceUUID);
  const leaveType = normalizeText_(request.leaveType);
  const startDate = normalizeText_(request.startDate);
  const endDate = normalizeText_(request.endDate);
  const reason = normalizeText_(request.reason);
  const requestTimestamp = Number(request.requestTimestamp);
  const requestId = normalizeText_(request.requestId);

  if (!deviceUUID) {
    throw new Error("Missing device UUID");
  }
  if (!requestId) {
    throw new Error("Missing request id");
  }
  if (!Number.isFinite(requestTimestamp)) {
    throw new Error("Missing request timestamp");
  }

  const normalizedLeaveType = normalizeLeaveType_(leaveType);
  const validLeaveTypes = ["sick", "personal", "annual", "other"];
  if (validLeaveTypes.indexOf(normalizedLeaveType) === -1) {
    throw new Error("Invalid leave type");
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate) || isNaN(new Date(startDate).getTime())) {
    throw new Error("Invalid start date");
  }
  if (!datePattern.test(endDate) || isNaN(new Date(endDate).getTime())) {
    throw new Error("Invalid end date");
  }
  if (endDate < startDate) {
    throw new Error("End date cannot be before start date");
  }
  if (!reason) {
    throw new Error("Leave reason is required");
  }

  request.deviceUUID = deviceUUID;
  request.leaveType = normalizedLeaveType;
  request.startDate = startDate;
  request.endDate = endDate;
  request.reason = reason;
  request.requestTimestamp = Math.round(requestTimestamp);
  request.requestId = requestId;
}

function handleAdminGetLeaveRequests_(request, runtimeConfig) {
  requireAdminSession_(request);
  const statusFilter = normalizeText_(request.status) || "pending";
  const limitRaw = Number(request.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.round(limitRaw)), 200) : 50;

  const sheet = getSheetIfExists_(runtimeConfig, runtimeConfig.leaveSheetName);
  if (!sheet) {
    return jsonResponse_(true, "No leave requests", { leaves: [] });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse_(true, "No leave requests", { leaves: [] });
  }

  const rowsToRead = Math.min(limit, lastRow - 1);
  const startRow = lastRow - rowsToRead + 1;
  const values = sheet.getRange(startRow, 1, rowsToRead, 12).getValues();
  values.reverse();

  let leaves = values.map(function (row) {
    return {
      requestId: normalizeText_(row[0]),
      employeeName: normalizeText_(row[1]),
      deviceUUID: normalizeText_(row[2]),
      leaveType: normalizeLeaveType_(row[3]),
      startDate: normalizeText_(row[4]),
      endDate: normalizeText_(row[5]),
      reason: normalizeText_(row[6]),
      status: normalizeText_(row[7]),
      submittedAt: normalizeText_(row[8]),
      reviewedAt: normalizeText_(row[9]) || null,
      reviewedBy: normalizeText_(row[10]) || null,
      reviewNote: normalizeText_(row[11]) || null
    };
  });

  if (statusFilter !== "all") {
    leaves = leaves.filter(function (item) {
      return item.status === statusFilter;
    });
  }

  return jsonResponse_(true, "Leave requests loaded", { leaves: leaves });
}

function handleAdminUpdateLeaveStatus_(request, runtimeConfig) {
  const adminUsername = requireAdminSession_(request);
  const requestId = normalizeText_(request.requestId);
  const newStatus = normalizeText_(request.status);
  const reviewNote = normalizeText_(request.reviewNote);

  if (!requestId) {
    throw new Error("Missing requestId");
  }
  if (newStatus !== "approved" && newStatus !== "rejected") {
    throw new Error("Status must be approved or rejected");
  }

  const sheet = getSheetIfExists_(runtimeConfig, runtimeConfig.leaveSheetName);
  if (!sheet) {
    throw new Error("LeaveRequests sheet not found");
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error("No leave requests found");
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let targetRow = -1;
  for (let i = 0; i < ids.length; i += 1) {
    if (normalizeText_(ids[i][0]) === requestId) {
      targetRow = i + 2;
      break;
    }
  }
  if (targetRow === -1) {
    throw new Error("Leave request not found");
  }

  const now = new Date().toISOString();
  sheet.getRange(targetRow, 8).setValue(newStatus);
  sheet.getRange(targetRow, 10).setValue(now);
  sheet.getRange(targetRow, 11).setValue(adminUsername);
  sheet.getRange(targetRow, 12).setValue(reviewNote);

  appendAuditLogSafe_(runtimeConfig, {
    eventType: "LEAVE_STATUS_UPDATED",
    username: adminUsername,
    detail: "RequestID=" + requestId + " Status=" + newStatus
  });

  return jsonResponse_(true, "Updated", { requestId: requestId, status: newStatus });
}

function pad2_(n) {
  return n < 10 ? "0" + String(n) : String(n);
}

function handleAdminGetCalendar_(request, runtimeConfig) {
  requireAdminSession_(request);
  const year = Math.round(Number(request.year));
  const month = Math.round(Number(request.month));
  if (!Number.isFinite(year) || year < 2000 || year > 2099) {
    throw new Error("Invalid year");
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error("Invalid month");
  }

  const firstDay = year + "-" + pad2_(month) + "-01";
  const lastDay = year + "-" + pad2_(month) + "-" + pad2_(new Date(year, month, 0).getDate());

  const leavesByDate = {};
  const sheet = getSheetIfExists_(runtimeConfig, runtimeConfig.leaveSheetName);
  if (sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      for (let i = 0; i < values.length; i += 1) {
        const status = normalizeText_(values[i][7]);
        if (status !== "approved") continue;
        const name = normalizeText_(values[i][1]);
        const start = normalizeText_(values[i][4]);
        const end = normalizeText_(values[i][5]);
        if (!start || !end || end < firstDay || start > lastDay) continue;
        const rangeStart = start < firstDay ? firstDay : start;
        const rangeEnd = end > lastDay ? lastDay : end;
        let d = new Date(rangeStart + "T12:00:00Z");
        const endD = new Date(rangeEnd + "T12:00:00Z");
        while (d <= endD) {
          const dateStr = d.toISOString().slice(0, 10);
          if (!leavesByDate[dateStr]) leavesByDate[dateStr] = [];
          if (leavesByDate[dateStr].indexOf(name) === -1) leavesByDate[dateStr].push(name);
          d = new Date(d.getTime() + 86400000);
        }
      }
    }
  }

  return jsonResponse_(true, "Calendar loaded", {
    year: year,
    month: month,
    leavesByDate: leavesByDate
  });
}

function handleEmployeeGetCalendar_(request, runtimeConfig) {
  const deviceUUID = normalizeText_(request.deviceUUID);
  if (!deviceUUID) {
    throw new Error("Missing device UUID");
  }
  const binding = findBindingByDeviceUUID_(runtimeConfig, deviceUUID);
  if (!binding.employeeName) {
    throw new Error("This device is not registered. Please send your Device ID to an administrator.");
  }
  const employeeName = binding.employeeName;

  const year = Math.round(Number(request.year));
  const month = Math.round(Number(request.month));
  if (!Number.isFinite(year) || year < 2000 || year > 2099) {
    throw new Error("Invalid year");
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error("Invalid month");
  }

  const firstDay = year + "-" + pad2_(month) + "-01";
  const lastDay = year + "-" + pad2_(month) + "-" + pad2_(new Date(year, month, 0).getDate());

  const punchesByDate = {};
  const logSheet = getSheetIfExists_(runtimeConfig, runtimeConfig.logSheetName);
  if (logSheet) {
    const lastRow = logSheet.getLastRow();
    if (lastRow >= 2) {
      const values = logSheet.getRange(2, 1, lastRow - 1, 5).getValues();
      for (let i = 0; i < values.length; i += 1) {
        const empName = normalizeText_(values[i][1]);
        if (empName !== employeeName) continue;
        const ts = normalizeText_(values[i][0]);
        if (!ts) continue;
        const d = new Date(ts);
        if (isNaN(d.getTime())) continue;
        const dateStr = Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
        if (dateStr < firstDay || dateStr > lastDay) continue;
        const timeStr = Utilities.formatDate(d, "Asia/Taipei", "HH:mm");
        const locationStatus = normalizeText_(values[i][4]);
        if (!punchesByDate[dateStr]) punchesByDate[dateStr] = [];
        punchesByDate[dateStr].push({ time: timeStr, locationStatus: locationStatus });
      }
    }
  }

  const leavesByDate = {};
  const leaveSheet = getSheetIfExists_(runtimeConfig, runtimeConfig.leaveSheetName);
  if (leaveSheet) {
    const lastRow = leaveSheet.getLastRow();
    if (lastRow >= 2) {
      const values = leaveSheet.getRange(2, 1, lastRow - 1, 8).getValues();
      for (let i = 0; i < values.length; i += 1) {
        const empName = normalizeText_(values[i][1]);
        const status = normalizeText_(values[i][7]);
        if (empName !== employeeName || status !== "approved") continue;
        const leaveType = normalizeLeaveType_(values[i][3]);
        const start = normalizeText_(values[i][4]);
        const end = normalizeText_(values[i][5]);
        if (!start || !end || end < firstDay || start > lastDay) continue;
        const rangeStart = start < firstDay ? firstDay : start;
        const rangeEnd = end > lastDay ? lastDay : end;
        let d = new Date(rangeStart + "T12:00:00Z");
        const endD = new Date(rangeEnd + "T12:00:00Z");
        while (d <= endD) {
          const dateStr = d.toISOString().slice(0, 10);
          leavesByDate[dateStr] = { leaveType: leaveType };
          d = new Date(d.getTime() + 86400000);
        }
      }
    }
  }

  return jsonResponse_(true, "Calendar loaded", {
    year: year,
    month: month,
    employeeName: employeeName,
    punchesByDate: punchesByDate,
    leavesByDate: leavesByDate
  });
}

function handleEmployeeResolveSession_(request, runtimeConfig) {
  const deviceUUID = normalizeText_(request.deviceUUID);
  if (!deviceUUID) {
    throw new Error("Missing device UUID");
  }
  const binding = findBindingByDeviceUUID_(runtimeConfig, deviceUUID);
  return jsonResponse_(true, "Employee session resolved", {
    isRegistered: Boolean(binding.employeeName),
    employeeName: binding.employeeName || "",
    deviceUUID: deviceUUID
  });
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
  const leaveSheetName =
    normalizeText_(properties.getProperty(PROPERTY_KEYS.LEAVE_SHEET_NAME)) || DEFAULT_CONFIG.LEAVE_SHEET_NAME;
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
    leaveSheetName: leaveSheetName,
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

function parseSpreadsheetId_(value) {
  const input = normalizeText_(value);
  if (/^[A-Za-z0-9_-]+$/.test(input)) return input;
  const match = input.match(/^(?:https:\/\/)?docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:[/?#]|$)/i);
  if (match) return match[1];
  throw new Error("Enter a valid Google Sheets link or ID");
}

function normalizeLeaveType_(value) {
  const leaveType = normalizeText_(value);
  const legacyTypes = { "病假": "sick", "事假": "personal", "特休": "annual", "其他": "other" };
  return legacyTypes[leaveType] || leaveType;
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
    false
  );
}
