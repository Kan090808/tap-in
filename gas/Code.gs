const DEFAULT_CONFIG = {
  SPREADSHEET_ID: "12UH7PjOv9qbhh2yhJwdC5KvFeFHvpaNdWRHVptaliVo",
  LOG_SHEET_NAME: "AttendanceLogs",
  BINDING_SHEET_NAME: "DeviceBindings",
  EMPLOYEE_SHEET_NAME: "Employees",
  AUDIT_SHEET_NAME: "AuditLogs",
  OFFICE_STATIC_IP: "203.0.113.10",
  MAX_GPS_ACCURACY_METERS: 120,
  LEAVE_SHEET_NAME: "LeaveRequests",
  SCHEDULE_SHEET_NAME: "ScheduleGroups",
  CORRECTION_SHEET_NAME: "CorrectionRequests",
  ADJUSTMENT_SHEET_NAME: "MonthlyAdjustments",
  ADMIN_SESSION_HOURS: 12,
  ADMIN_LOGIN_MAX_FAILURES: 5,
  ADMIN_LOGIN_LOCK_MINUTES: 15,
  REQUEST_FRESHNESS_WINDOW_MS: 5 * 60 * 1000
};

const LUNCH_WINDOW = { start: "13:00", end: "14:00" };

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

    const additionalActions = {
      adminGetScheduleGroups: handleAdminGetScheduleGroups_,
      adminSaveScheduleGroup: handleAdminSaveScheduleGroup_,
      adminDeleteScheduleGroup: handleAdminDeleteScheduleGroup_,
      employeeGetLeaveRequests: handleEmployeeGetLeaveRequests_,
      employeeCancelLeave: handleEmployeeCancelLeave_,
      adminGetLeaveEvidence: handleAdminGetLeaveEvidence_,
      employeeSubmitCorrection: handleEmployeeSubmitCorrection_,
      employeeGetCorrections: handleEmployeeGetCorrections_,
      adminGetCorrections: handleAdminGetCorrections_,
      adminUpdateCorrection: handleAdminUpdateCorrection_,
      adminAddCorrection: handleAdminAddCorrection_,
      adminRevokeCorrection: handleAdminRevokeCorrection_,
      adminGetEmploymentTerms: handleAdminGetEmploymentTerms_,
      adminSaveEmploymentTerms: handleAdminSaveEmploymentTerms_,
      adminPreviewMigration: handleAdminPreviewMigration_,
      adminApplyMigration: handleAdminApplyMigration_,
      adminGetMonthlyReport: handleAdminGetMonthlyReport_,
      adminSaveMonthlyAdjustment: handleAdminSaveMonthlyAdjustment_,
      adminExportMonthlyCsv: handleAdminExportMonthlyCsv_
    };
    if (additionalActions[action]) return additionalActions[action](request, runtimeConfig);

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
        apiVersion: 2,
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

  const locationStatus = request.ipAddress === runtimeConfig.officeStaticIp ? "Office" : "Remote/Field";
  const serverTime = new Date();
  let employeeName;
  const punchType = normalizeText_(request.punchType).toLowerCase();
  if (punchType !== "in" && punchType !== "out") throw new Error("Punch type must be in or out");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const employee = requireEmployeeByDevice_(runtimeConfig, request.deviceUUID);
    employeeName = employee.name;
    validatePunchSequence_(runtimeConfig, employeeName, request.deviceUUID, punchType, serverTime);
    appendAttendanceLog_(runtimeConfig, {
      timestamp: serverTime.toISOString(),
      employeeId: employee.employeeId,
      name: employeeName,
      deviceUUID: request.deviceUUID,
      ipAddress: request.ipAddress,
      locationStatus: locationStatus,
      latitude: request.latitude,
      longitude: request.longitude,
      punchType: punchType
    });
  } finally {
    lock.releaseLock();
  }

  return jsonResponse_(true, "Punch success", {
    serverTime: serverTime.toISOString(),
    locationStatus: locationStatus,
    isRegistered: true,
    employeeName: employeeName,
    punchType: punchType,
    punchMessage: employeeName + (punchType === "out" ? " punched out successfully" : " punched in successfully")
  });
}

function validatePunchSequence_(runtimeConfig, employeeName, deviceUUID, punchType, now) {
  const employee = requireEmployeeByDevice_(runtimeConfig, deviceUUID);
  const date = Utilities.formatDate(now, "Asia/Taipei", "yyyy-MM-dd");
  const time = Utilities.formatDate(now, "Asia/Taipei", "HH:mm");
  const stream = effectivePunches_(runtimeConfig, employee.employeeId, date);
  requireCompleteOwnership_(runtimeConfig, employee.employeeId, date, date);
  requireValidPunches_(stream.concat([{time:time,punchType:punchType}]));
  const earlier = stream.filter(function (punch) { return punch.time <= time; });
  if (punchType === "out" && (!earlier.length || earlier[earlier.length-1].punchType !== "in")) throw new Error("Clock in before clocking out");
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
  const values = sheet.getRange(startRow, 1, rowsToRead, 8).getValues();
  values.reverse();

  const logs = values.map(function (row) {
    return {
      timestamp: normalizeText_(row[0]),
      employeeName: normalizeText_(row[1]),
      deviceUUID: normalizeText_(row[2]),
      ipAddress: normalizeText_(row[3]),
      locationStatus: normalizeText_(row[4]),
      latitude: normalizeText_(row[5]),
      longitude: normalizeText_(row[6]),
      punchType: normalizeText_(row[7])
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
      employees: readEmployees_(getEmployeeSheet_(runtimeConfig), runtimeConfig).filter(function (employee) {
        return request.status === "all" || employee.status === (request.status === "archived" ? "archived" : "active");
      }).map(publicEmployee_)
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
  const requestedScheduleGroupId = normalizeText_(request.scheduleGroupId);
  const requestedMonthlySalary = request.monthlySalary;
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
    if (existing && existing.status === "archived") throw new Error("Archived employee accounts cannot be edited");
    const scheduleGroupId = requestedScheduleGroupId || (existing && existing.scheduleGroupId) || "mon-sat";
    const monthlySalary = Number(requestedMonthlySalary == null || requestedMonthlySalary === "" ? (existing ? existing.monthlySalary : 0) : requestedMonthlySalary);
    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) throw new Error("Monthly salary must be a nonnegative number");
    if (employeeId && !existing) throw new Error("Employee not found. Refresh the list and try again.");
    for (let i = 0; i < employees.length; i += 1) {
      const item = employees[i];
      if (existing && item.employeeId === existing.employeeId) continue;
      if (item.name === name) throw new Error("An employee with this name already exists");
      if (deviceUUID && item.status !== "archived" && item.deviceUUID === deviceUUID) throw new Error("This Device ID is already assigned to another employee");
    }

    const bindingSheet = getOrCreateSheet_(runtimeConfig, runtimeConfig.bindingSheetName, [
      "Employee Name", "Device UUID", "Bound At", "Employee ID", "Ended At"
    ]);
    const bindingRows = bindingSheet.getLastRow() > 1
      ? bindingSheet.getRange(2, 1, bindingSheet.getLastRow() - 1, 5).getValues() : [];
    for (let i = 0; i < bindingRows.length; i += 1) {
      const boundName = normalizeText_(bindingRows[i][0]);
      const boundDevice = normalizeText_(bindingRows[i][1]);
      if (deviceUUID && !bindingRows[i][4] && boundDevice === deviceUUID && (!existing || normalizeText_(bindingRows[i][3]) !== existing.employeeId)) {
        throw new Error("This Device ID is already assigned to another employee");
      }
    }

    const saved = {
      employeeId: existing ? existing.employeeId : Utilities.getUuid(),
      name: name,
      phone: phone,
      email: email,
      deviceUUID: deviceUUID,
      scheduleGroupId: scheduleGroupId,
      monthlySalary: monthlySalary,
      status: "active"
    };
    if (!getScheduleGroups_(runtimeConfig).some(function (group) { return group.groupId === scheduleGroupId; })) {
      throw new Error("Schedule group not found");
    }
    validateEmployeeTerms_(request, existing, saved, runtimeConfig);
    saveEmployeeTerms_(request, existing, saved, runtimeConfig, adminUsername);
    const rowValues = [saved.name, saved.phone, saved.email, saved.deviceUUID, saved.employeeId, saved.scheduleGroupId, saved.monthlySalary, "active", "", ""];
    if (existing) {
      sheet.getRange(existing.rowNumber, 1, 1, 10).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    if (existing) closeEmployeeBindings_(bindingSheet, existing.employeeId);
    if (deviceUUID) bindingSheet.appendRow([name, deviceUUID, new Date().toISOString(), saved.employeeId, ""]);
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
    if (employee.status === "archived") {
      if (bindingSheet) closeEmployeeBindings_(bindingSheet, employeeId);
      return jsonResponse_(true, "Employee already archived", { employeeId: employeeId });
    }
    sheet.getRange(employee.rowNumber, 8, 1, 3).setValues([["archived", new Date().toISOString(), adminUsername]]);
    if (bindingSheet) closeEmployeeBindings_(bindingSheet, employeeId);
    appendAuditLogSafe_(runtimeConfig, {
      eventType: "EMPLOYEE_ARCHIVED",
      username: adminUsername,
      detail: "EmployeeID=" + employeeId + " Name=" + employee.name
    });
    return jsonResponse_(true, "Employee archived", { employeeId: employeeId });
  } finally {
    lock.releaseLock();
  }
}

function getEmployeeSheet_(runtimeConfig) {
  const headers = ["Employee Name", "Phone", "Email", "Device UUID", "Employee ID", "Schedule Group ID", "Monthly Salary MYR", "Status", "Archived At", "Archived By"];
  const sheet = getOrCreateSheet_(runtimeConfig, runtimeConfig.employeeSheetName, headers);
  const firstCell = normalizeText_(sheet.getRange(1, 1).getValue());
  if (firstCell !== "Employee Name" && firstCell !== "Name") sheet.insertRowBefore(1);
  ensureColumns_(sheet, headers.length);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function readEmployees_(sheet, runtimeConfig) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const employees = [];
  for (let i = 0; i < values.length; i += 1) {
    const name = normalizeText_(values[i][0]);
    if (!name) continue;
    const rowNumber = i + 2;
    const deviceUUID = normalizeText_(values[i][3]);
    const employeeId = normalizeText_(values[i][4]);
    employees.push({
      employeeId: employeeId,
      name: name,
      phone: normalizeText_(values[i][1]),
      email: normalizeText_(values[i][2]),
      deviceUUID: deviceUUID,
      scheduleGroupId: normalizeText_(values[i][5]) || "mon-sat",
      monthlySalary: Number(values[i][6]) || 0,
      status: normalizeText_(values[i][7]) || "active",
      archivedAt: normalizeText_(values[i][8]),
      archivedBy: normalizeText_(values[i][9]),
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
    deviceUUID: employee.deviceUUID,
    scheduleGroupId: employee.scheduleGroupId,
    monthlySalary: employee.monthlySalary,
    status: employee.status,
    archivedAt: employee.archivedAt,
    archivedBy: employee.archivedBy
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

  requireEmployeeByDevice_(runtimeConfig, request.deviceUUID);
  const evidenceUrl = request.evidenceDataUrl ? saveLeaveEvidence_(request.evidenceDataUrl, request.requestId) : "";
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
  const employee = requireEmployeeByDevice_(runtimeConfig, request.deviceUUID);
  const leaveSheet = getOrCreateSheet_(runtimeConfig, runtimeConfig.leaveSheetName, [
    "RequestID", "EmployeeName", "DeviceUUID", "LeaveType",
    "StartDate", "EndDate", "Reason", "Status",
    "SubmittedAt", "ReviewedAt", "ReviewedBy", "ReviewNote", "DayPart", "EvidenceURL", "CancelledAt", "CancelledBy", "EmployeeID"
  ]);
  ensureLeaveColumns_(leaveSheet);
  leaveSheet.appendRow([
    request.requestId,
    employee.name,
    request.deviceUUID,
    request.leaveType,
    request.startDate,
    request.endDate,
    request.reason,
    "pending",
    new Date().toISOString(),
    "", "", "", request.dayPart, evidenceUrl, "", "", employee.employeeId
  ]);

  return jsonResponse_(true, "Leave request submitted", {
    employeeName: employee.name,
    requestId: request.requestId
  });
  } finally { lock.releaseLock(); }
}

function validateLeaveRequest_(request) {
  const deviceUUID = normalizeText_(request.deviceUUID);
  const leaveType = normalizeText_(request.leaveType);
  const startDate = normalizeText_(request.startDate);
  const endDate = normalizeText_(request.endDate);
  const reason = normalizeText_(request.reason);
  const requestTimestamp = Number(request.requestTimestamp);
  const requestId = normalizeText_(request.requestId);
  const dayPart = normalizeText_(request.dayPart || "full").toLowerCase();

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
  const validLeaveTypes = ["sick", "personal", "annual"];
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
  if (["full", "am", "pm"].indexOf(dayPart) === -1) throw new Error("Invalid leave duration");
  if (dayPart !== "full" && startDate !== endDate) throw new Error("Half-day leave must use one date");
  if (normalizedLeaveType === "annual") {
    const today = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
    const earliest = new Date(today + "T12:00:00Z");
    earliest.setUTCDate(earliest.getUTCDate() + 3);
    if (startDate < earliest.toISOString().slice(0, 10)) throw new Error("Annual leave requires three calendar days of notice");
  }
  if (normalizedLeaveType === "sick" && !normalizeText_(request.evidenceDataUrl)) {
    throw new Error("Sick leave proof is required");
  }

  request.deviceUUID = deviceUUID;
  request.leaveType = normalizedLeaveType;
  request.startDate = startDate;
  request.endDate = endDate;
  request.reason = reason;
  request.requestTimestamp = Math.round(requestTimestamp);
  request.requestId = requestId;
  request.dayPart = dayPart;
}

function handleAdminGetLeaveRequests_(request, runtimeConfig) {
  requireAdminSession_(request);
  const status = normalizeText_(request.status) || "pending";
  if (["all", "pending", "approved", "rejected", "cancelled"].indexOf(status) < 0) throw new Error("Invalid leave status filter");
  const limit = Math.min(sanitizeLimit_(request.limit), 200);
  const compare = function (a, b) { return b.submittedAt.localeCompare(a.submittedAt) || b.requestId.localeCompare(a.requestId); };
  let leaves = leaveRows_(runtimeConfig).filter(function (item) { return status === "all" || item.status === status; }).sort(compare);
  if (request.cursor) {
    let cursor;
    try { cursor = JSON.parse(request.cursor); } catch (_error) { throw new Error("Invalid leave page cursor"); }
    if (cursor.status !== status || typeof cursor.submittedAt !== "string" || typeof cursor.requestId !== "string") throw new Error("Invalid leave page cursor");
    leaves = leaves.filter(function (item) { return compare(item, cursor) > 0; });
  }
  const page = leaves.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor = leaves.length > limit && last ? JSON.stringify({ status: status, submittedAt: last.submittedAt, requestId: last.requestId }) : "";
  return jsonResponse_(true, "Leave requests loaded", { leaves: page, nextCursor: nextCursor });
}

function handleAdminUpdateLeaveStatus_(request, runtimeConfig) {
  const admin = requireAdminSession_(request);
  const status = normalizeText_(request.status);
  if (['approved','rejected','cancelled'].indexOf(status) === -1) throw new Error('Invalid leave status');
  return integrityLock_(function () {
    const leaves=leaveRows_(runtimeConfig);
    const leave=leaves.filter(function (item) { return item.requestId === normalizeText_(request.requestId); })[0];
    if (!leave) throw new Error('Leave request not found');
    if (leave.status === status && (status === 'cancelled' ? leave.cancelledBy === admin : leave.reviewedBy === admin && leave.reviewNote === normalizeText_(request.reviewNote))) return jsonResponse_(true,'Updated',{requestId:leave.requestId,status:status});
    if (status === 'cancelled' ? (leave.status !== 'pending' && leave.status !== 'approved') : leave.status !== 'pending') throw new Error('Leave status cannot be changed from ' + leave.status);
    if (!leave.employeeId) throw new Error('Resolve leave employee ownership before review');
    if (status === 'approved') {
      requireCompleteOwnership_(runtimeConfig,leave.employeeId,leave.startDate,leave.endDate);
      requireNoLeaveConflicts_(leaves.filter(function (item) { return item.employeeId === leave.employeeId && item.requestId !== leave.requestId; }).concat([Object.assign({},leave,{status:'approved'})]));
      requireLeaveCapacity_(runtimeConfig,leave.employeeId,leaves.filter(function (item) { return item.employeeId === leave.employeeId && item.requestId !== leave.requestId; }).concat([Object.assign({},leave,{status:'approved'})]),leave.startDate,leave.endDate);
    }
    const sheet=getSheetIfExists_(runtimeConfig,runtimeConfig.leaveSheetName);
    ensureLeaveColumns_(sheet);
    const now=new Date().toISOString();
    if (status === 'cancelled') sheet.getRange(leave.rowNumber,15,1,2).setValues([[now,admin]]);
    else sheet.getRange(leave.rowNumber,10,1,3).setValues([[now,admin,normalizeText_(request.reviewNote)]]);
    sheet.getRange(leave.rowNumber,8).setValue(status);
    appendAuditLogSafe_(runtimeConfig,{eventType:'LEAVE_STATUS_UPDATED',username:admin,detail:'RequestID=' + leave.requestId + ' Status=' + status});
    return jsonResponse_(true,'Updated',{requestId:leave.requestId,status:status});
  });
}

function pad2_(n) {
  return n < 10 ? "0" + String(n) : String(n);
}

function calculateDailyPayroll_(input) {
  const workedHours = Math.max(0, Number(input.workedHours) || 0);
  const leaveHours = Math.max(0, Number(input.leaveHours) || 0);
  const unpaidLeaveHours = Math.min(leaveHours, Math.max(0, Number(input.unpaidLeaveHours == null ? (input.leaveType === "personal" ? leaveHours : 0) : input.unpaidLeaveHours) || 0));
  const paidLeaveHours = leaveHours - unpaidLeaveHours;
  const scheduledHours = Math.max(0, Number(input.scheduledHours) || 0);
  const weekday = Number(input.weekday);
  const hourlyRate = (Number(input.monthlySalary) || 0) / 26 / 8;
  const dayRate = (Number(input.monthlySalary) || 0) / 26;
  const actualPlusLeave = workedHours + leaveHours;
  let creditedHours = actualPlusLeave;
  let absenceDays = 0;
  if (scheduledHours >= 8 && weekday >= 1 && weekday <= 5) {
    if (actualPlusLeave < 4) absenceDays = 1;
    else if (actualPlusLeave < 7.5) absenceDays = 0.5;
    else creditedHours = Math.max(8, actualPlusLeave);
  } else if (scheduledHours > 0 && actualPlusLeave < scheduledHours) {
    absenceDays = actualPlusLeave >= scheduledHours / 2 ? 0.5 : 1;
  }
  const overtimeHours = Math.max(0, actualPlusLeave - 8);
  const overtimePay = overtimeHours * hourlyRate * (weekday === 7 ? 2 : 1.5);
  const personalDeduction = unpaidLeaveHours * hourlyRate;
  const absenceDeduction = absenceDays * dayRate + personalDeduction;
  return {
    workedHours: workedHours,
    leaveHours: leaveHours,
    paidLeaveHours: paidLeaveHours,
    unpaidLeaveHours: unpaidLeaveHours,
    creditedHours: creditedHours,
    overtimeHours: overtimeHours,
    absenceDays: absenceDays,
    overtimePay: overtimePay,
    absenceDeduction: absenceDeduction,
    dayPay: dayRate - absenceDeduction + overtimePay
  };
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
        const start = sheetDate_(values[i][4]);
        const end = sheetDate_(values[i][5]);
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
  const employee = requireEmployeeByDevice_(runtimeConfig, deviceUUID);

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
  requireCompleteOwnership_(runtimeConfig, employee.employeeId, firstDay, lastDay);
  effectivePunches_(runtimeConfig, employee.employeeId).forEach(function (punch) {
    if (punch.date < firstDay || punch.date > lastDay) return;
    if (!punchesByDate[punch.date]) punchesByDate[punch.date] = [];
    punchesByDate[punch.date].push(punch);
  });

  const leavesByDate = {};
  const leaveSheet = getSheetIfExists_(runtimeConfig, runtimeConfig.leaveSheetName);
  if (leaveSheet) {
    const lastRow = leaveSheet.getLastRow();
    if (lastRow >= 2) {
      const values = leaveSheet.getRange(2, 1, lastRow - 1, 17).getValues();
      for (let i = 0; i < values.length; i += 1) {
        const status = normalizeText_(values[i][7]);
        if (normalizeText_(values[i][16]) !== employee.employeeId || status !== "approved") continue;
        const leaveType = normalizeLeaveType_(values[i][3]);
        const start = sheetDate_(values[i][4]);
        const end = sheetDate_(values[i][5]);
        if (!start || !end || end < firstDay || start > lastDay) continue;
        const rangeStart = start < firstDay ? firstDay : start;
        const rangeEnd = end > lastDay ? lastDay : end;
        let d = new Date(rangeStart + "T12:00:00Z");
        const endD = new Date(rangeEnd + "T12:00:00Z");
        while (d <= endD) {
          const dateStr = d.toISOString().slice(0, 10);
          const segment = { leaveType: leaveType, dayPart: normalizeText_(values[i][12]) };
          if (!leavesByDate[dateStr]) leavesByDate[dateStr] = { leaveType: leaveType, dayPart: segment.dayPart, segments: [] };
          leavesByDate[dateStr].segments.push(segment);
          d = new Date(d.getTime() + 86400000);
        }
      }
    }
  }

  return jsonResponse_(true, "Calendar loaded", {
    year: year,
    month: month,
    employeeName: employeeName,
    employeeId: employee.employeeId,
    warnings: Object.keys(punchesByDate).reduce(function (warnings, date) { return warnings.concat(punchWarnings_(punchesByDate[date]).map(function (warning) { return date + ": " + warning; })); }, []),
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
  if (normalizeText_(request.latitude) === "" || normalizeText_(request.longitude) === "") {
    throw new Error("Location coordinates are required");
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Invalid geolocation coordinates");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Invalid geolocation coordinates");
  }
  if (normalizeText_(request.accuracyMeters) === "" || !Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
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
    "Longitude",
    "Punch Type", "Employee ID"
  ]);

  ensureColumns_(sheet, 9);
  sheet.getRange(1, 9).setValue("Employee ID");
  sheet.appendRow([
    log.timestamp,
    log.name,
    log.deviceUUID,
    log.ipAddress,
    log.locationStatus,
    log.latitude,
    log.longitude,
    log.punchType || "", log.employeeId
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
  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const employees = employeeRows_(runtimeConfig);
  for (let i = 0; i < data.length; i += 1) {
    const rowName = normalizeText_(data[i][0]);
    const rowUUID = normalizeText_(data[i][1]);
    const employeeId = normalizeText_(data[i][3]);
    const employee = employees.find(function (item) { return item.employeeId && item.employeeId === employeeId; });
    if (rowUUID === deviceUUID && !data[i][4] && employee && employee.status === "active" && employee.deviceUUID === deviceUUID) {
      return { employeeName: employee.name, deviceUUID: rowUUID, employeeId: employeeId };
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

function getScheduleGroups_(runtimeConfig) {
  const defaults = [
    { groupId: "mon-sat", name: "Monday–Saturday", days: [1, 2, 3, 4, 5].map(function (weekday) { return { weekday: weekday, start: "09:00", end: "18:00" }; }).concat([{ weekday: 6, start: "09:00", end: "13:00" }]) },
    { groupId: "mon-fri", name: "Monday–Friday", days: [1, 2, 3, 4, 5].map(function (weekday) { return { weekday: weekday, start: "09:00", end: "18:00" }; }) }
  ];
  const sheet = getOrCreateSheet_(runtimeConfig, DEFAULT_CONFIG.SCHEDULE_SHEET_NAME, ["GroupID", "Name", "DaysJSON"]);
  const existingIds = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(function (row) { return normalizeText_(row[0]); }) : [];
  defaults.forEach(function (group) {
    if (existingIds.indexOf(group.groupId) < 0) sheet.appendRow([group.groupId, group.name, JSON.stringify(group.days)]);
  });
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues().map(function (row) {
    let days = [];
    try { days = JSON.parse(normalizeText_(row[2])); } catch (_error) {}
    return { groupId: normalizeText_(row[0]), name: normalizeText_(row[1]), days: days };
  });
}

function handleAdminGetScheduleGroups_(request, runtimeConfig) {
  requireAdminSession_(request);
  return jsonResponse_(true, "Schedule groups loaded", { groups: getScheduleGroups_(runtimeConfig) });
}

function validateScheduleDays_(days) {
  if (!Array.isArray(days)) throw new Error("Schedule days must be an array");
  const seen = {};
  return days.map(function (day) {
    const weekday = Number(day.weekday);
    const start = normalizeText_(day.start);
    const end = normalizeText_(day.end);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || seen[weekday]) throw new Error("Invalid schedule weekday");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start) throw new Error("Invalid schedule hours");
    seen[weekday] = true;
    return { weekday: weekday, start: start, end: end };
  });
}

function handleAdminSaveScheduleGroup_(request, runtimeConfig) {
  const admin = requireAdminSession_(request);
  const name = normalizeText_(request.name);
  if (!name || name.charAt(0) === "=") throw new Error("Invalid schedule group name");
  const days = validateScheduleDays_(request.days);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
  const sheet = getOrCreateSheet_(runtimeConfig, DEFAULT_CONFIG.SCHEDULE_SHEET_NAME, ["GroupID", "Name", "DaysJSON"]);
  const groupId = normalizeText_(request.groupId) || Utilities.getUuid();
  const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues() : [];
  const index = ids.findIndex(function (row) { return normalizeText_(row[0]) === groupId; });
  if (request.groupId && index < 0) throw new Error("Schedule group not found");
  const group = { groupId: groupId, name: name, days: days };
  validateScheduleTerms_(request, group, runtimeConfig);
  saveScheduleTerms_(request, group, runtimeConfig, admin);
  if (index >= 0) sheet.getRange(index + 2, 1, 1, 3).setValues([[groupId, name, JSON.stringify(days)]]);
  else sheet.appendRow([groupId, name, JSON.stringify(days)]);
  appendAuditLogSafe_(runtimeConfig, { eventType: "SCHEDULE_SAVED", username: admin, detail: "GroupID=" + groupId });
  return jsonResponse_(true, "Schedule saved", { group: { groupId: groupId, name: name, days: days } });
  } finally { lock.releaseLock(); }
}

function handleAdminDeleteScheduleGroup_(request, runtimeConfig) {
  const admin = requireAdminSession_(request);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
  const groupId = normalizeText_(request.groupId);
  if (groupId === "mon-sat" || groupId === "mon-fri") throw new Error("Default schedule groups cannot be deleted");
  const employeeSheet = getEmployeeSheet_(runtimeConfig);
  if (readEmployees_(employeeSheet, runtimeConfig).some(function (employee) { return employee.scheduleGroupId === groupId; })) throw new Error("Schedule group is assigned to an employee");
  const sheet = getSheetIfExists_(runtimeConfig, DEFAULT_CONFIG.SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error("Schedule group not found");
  if (sheet.getLastRow() < 2) throw new Error("Schedule group not found");
  const ids = sheet.getRange(2, 1, Math.max(0, sheet.getLastRow() - 1), 1).getValues();
  const index = ids.findIndex(function (row) { return normalizeText_(row[0]) === groupId; });
  if (index < 0) throw new Error("Schedule group not found");
  sheet.deleteRow(index + 2);
  appendAuditLogSafe_(runtimeConfig, { eventType: "SCHEDULE_DELETED", username: admin, detail: "GroupID=" + groupId });
  return jsonResponse_(true, "Schedule deleted", { groupId: groupId });
  } finally { lock.releaseLock(); }
}

function saveLeaveEvidence_(dataUrl, requestId) {
  const match = String(dataUrl).match(/^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Proof must be a PNG, JPEG, WebP, or PDF file");
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 5 * 1024 * 1024) throw new Error("Proof file must be at most 5 MB");
  const extension = match[1] === "application/pdf" ? "pdf" : match[1].split("/")[1];
  const blob = Utilities.newBlob(bytes, match[1], "leave-proof-" + requestId + "." + extension);
  return DriveApp.createFile(blob).getUrl();
}

function requireEmployeeByDevice_(runtimeConfig, deviceUUID) {
  const binding = findBindingByDeviceUUID_(runtimeConfig, normalizeText_(deviceUUID));
  if (!binding.employeeName) throw new Error("This device is not registered");
  const employee = employeeRows_(runtimeConfig).find(function (item) { return item.employeeId === binding.employeeId && item.status === "active" && item.deviceUUID === normalizeText_(deviceUUID); });
  if (!employee) throw new Error("This device is not registered to an active employee");
  return employee;
}

function leaveRows_(runtimeConfig) {
  const sheet = getSheetIfExists_(runtimeConfig, runtimeConfig.leaveSheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).getValues().map(function (row, index) {
    return { rowNumber: index + 2, requestId: normalizeText_(row[0]), employeeId: normalizeText_(row[16]), employeeName: normalizeText_(row[1]), deviceUUID: normalizeText_(row[2]), leaveType: normalizeLeaveType_(row[3]), startDate: sheetDate_(row[4]), endDate: sheetDate_(row[5]), reason: normalizeText_(row[6]), status: normalizeText_(row[7]), submittedAt: sheetTimestamp_(row[8]), reviewedAt: sheetTimestamp_(row[9]), reviewedBy: normalizeText_(row[10]), reviewNote: normalizeText_(row[11]), dayPart: normalizeText_(row[12]), evidenceUrl: normalizeText_(row[13]), cancelledAt: sheetTimestamp_(row[14]), cancelledBy: normalizeText_(row[15]) };
  });
}

function ensureLeaveColumns_(sheet) {
  ensureColumns_(sheet, 17);
  sheet.getRange(1, 13, 1, 5).setValues([["DayPart", "EvidenceURL", "CancelledAt", "CancelledBy", "EmployeeID"]]);
}

function handleEmployeeGetLeaveRequests_(request, runtimeConfig) {
  const employee = requireEmployeeByDevice_(runtimeConfig, request.deviceUUID);
  return jsonResponse_(true, "Leave requests loaded", { leaves: leaveRows_(runtimeConfig).filter(function (leave) {
    return leave.employeeId === employee.employeeId;
  }) });
}

function handleEmployeeCancelLeave_(request, runtimeConfig) {
  return integrityLock_(function () {
    const employee = requireEmployeeByDevice_(runtimeConfig,request.deviceUUID);
    const leave = leaveRows_(runtimeConfig).filter(function (item) { return item.requestId === normalizeText_(request.requestId) && item.employeeId === employee.employeeId; })[0];
    if (!leave) throw new Error('Leave request not found');
    if (leave.status === 'cancelled' && leave.cancelledBy === employee.employeeId) return jsonResponse_(true,'Leave cancelled',{requestId:leave.requestId,status:'cancelled'});
    if (leave.status !== 'pending' && leave.status !== 'approved') throw new Error('Leave cannot be cancelled');
    const sheet=getSheetIfExists_(runtimeConfig,runtimeConfig.leaveSheetName);
    ensureLeaveColumns_(sheet);
    sheet.getRange(leave.rowNumber,15,1,2).setValues([[new Date().toISOString(),employee.employeeId]]);
    sheet.getRange(leave.rowNumber,8).setValue('cancelled');
    appendAuditLogSafe_(runtimeConfig,{eventType:'LEAVE_CANCELLED',username:employee.name,detail:'RequestID=' + leave.requestId + ' PreviousStatus=' + leave.status});
    return jsonResponse_(true,'Leave cancelled',{requestId:leave.requestId,status:'cancelled'});
  });
}

function handleAdminGetLeaveEvidence_(request, runtimeConfig) {
  requireAdminSession_(request);
  const leave = leaveRows_(runtimeConfig).filter(function (item) { return item.requestId === normalizeText_(request.requestId); })[0];
  if (!leave || !leave.evidenceUrl) throw new Error("Leave proof not found");
  const match = leave.evidenceUrl.match(/(?:\/d\/|[?&]id=)([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("Invalid proof reference");
  const file = DriveApp.getFileById(match[1]);
  const blob = file.getBlob();
  return jsonResponse_(true, "Leave proof loaded", { dataUrl: "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes()), fileName: file.getName() });
}

function correctionRows_(runtimeConfig) {
  const sheet = getSheetIfExists_(runtimeConfig, DEFAULT_CONFIG.CORRECTION_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const keys = ['requestId','employeeId','employeeName','deviceUUID','date','punchType','time','reason','status','submittedAt','reviewedBy','reviewNote','reviewedAt','origin','submissionId','revokedAt','revokedBy','revocationReason','revocationSubmissionId','replacesRequestId'];
  return sheet.getRange(2,1,sheet.getLastRow()-1,Math.min(20,sheet.getLastColumn())).getValues().map(function (row,index) {
    const item = {rowNumber:index+2};
    keys.forEach(function (key,i) { item[key] = normalizeText_(row[i]); });
    item.date = sheetDate_(row[4]);
    item.time = row[6] instanceof Date ? Utilities.formatDate(row[6], 'Asia/Taipei', 'HH:mm') : normalizeText_(row[6]);
    item.submittedAt = sheetTimestamp_(row[9]);
    item.reviewedAt = sheetTimestamp_(row[12]);
    item.revokedAt = sheetTimestamp_(row[15]);
    item.origin = item.origin || (item.reviewNote === 'Admin entry' ? 'admin' : 'employee');
    return item;
  });
}

function correctionSheet_(runtimeConfig) {
  const sheet = getOrCreateSheet_(runtimeConfig, DEFAULT_CONFIG.CORRECTION_SHEET_NAME, correctionHeaders_());
  ensureColumns_(sheet, 20);
  sheet.getRange(1,1,1,20).setValues([correctionHeaders_()]);
  return sheet;
}

function validateCorrection_(request) {
  const date = normalizeText_(request.date);
  const time = normalizeText_(request.time);
  const punchType = normalizeText_(request.punchType).toLowerCase();
  const reason = normalizeText_(request.reason);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + "T12:00:00Z").getTime())) throw new Error("Invalid correction date");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Invalid correction time");
  if (punchType !== "in" && punchType !== "out") throw new Error("Invalid punch type");
  if (!reason || reason.charAt(0) === "=") throw new Error("Correction reason is required");
  return { date: date, time: time, punchType: punchType, reason: reason };
}

function handleEmployeeSubmitCorrection_(request, runtimeConfig) {
  const correction = validatedCorrection_(request);
  return integrityLock_(function () {
    const employee = requireEmployeeByDevice_(runtimeConfig, request.deviceUUID);
    const submissionId = normalizeText_(request.submissionId);
    const existing = submissionId && correctionRows_(runtimeConfig).filter(function (item) { return item.employeeId === employee.employeeId && item.submissionId === submissionId; })[0];
    if (existing) {
      if (existing.date !== correction.date || existing.time !== correction.time || existing.punchType !== correction.punchType || existing.reason !== correction.reason) throw new Error('Submission ID already used for another correction');
      return jsonResponse_(true,'Correction submitted',{requestId:existing.requestId});
    }
    const requestId = writeCorrection_(runtimeConfig,employee,correction,'',submissionId,'');
    return jsonResponse_(true,'Correction submitted',{requestId:requestId});
  });
}

function handleEmployeeGetCorrections_(request, runtimeConfig) {
  const employee = requireEmployeeByDevice_(runtimeConfig,request.deviceUUID);
  return jsonResponse_(true,'Corrections loaded',{corrections:correctionRows_(runtimeConfig).filter(function (item) { return item.employeeId === employee.employeeId; })});
}

function handleAdminGetCorrections_(request, runtimeConfig) {
  requireAdminSession_(request);
  const status = normalizeText_(request.status) || 'pending';
  if (['pending','approved','rejected','revoked','all'].indexOf(status) === -1) throw new Error('Invalid correction filter');
  return jsonResponse_(true,'Corrections loaded',{corrections:correctionRows_(runtimeConfig).filter(function (item) { return (status === 'all' || item.status === status) && (!request.employeeId || item.employeeId === normalizeText_(request.employeeId)); }).sort(function (a,b) { return (b.submittedAt + b.requestId).localeCompare(a.submittedAt + a.requestId); })});
}

function handleAdminUpdateCorrection_(request, runtimeConfig) {
  const admin = requireAdminSession_(request);
  const status = normalizeText_(request.status);
  const note = normalizeText_(request.reviewNote);
  if (status !== 'approved' && status !== 'rejected') throw new Error('Invalid correction status');
  return integrityLock_(function () {
    const correction = correctionRows_(runtimeConfig).filter(function (item) { return item.requestId === normalizeText_(request.requestId); })[0];
    if (!correction) throw new Error('Correction not found');
    if (correction.status === status && correction.reviewedBy === admin && correction.reviewNote === note) return jsonResponse_(true,'Correction reviewed',{requestId:correction.requestId,status:status});
    if (correction.status !== 'pending') throw new Error('Correction has already been reviewed');
    if (status === 'approved') validateEffectiveCorrection_(runtimeConfig,correction.employeeId,validatedCorrection_(correction));
    const sheet = correctionSheet_(runtimeConfig);
    sheet.getRange(correction.rowNumber,11,1,3).setValues([[admin,note,new Date().toISOString()]]);
    sheet.getRange(correction.rowNumber,9).setValue(status);
    appendAuditLogSafe_(runtimeConfig,{eventType:'CORRECTION_REVIEWED',username:admin,detail:'RequestID=' + correction.requestId + ' Status=' + status});
    return jsonResponse_(true,'Correction reviewed',{requestId:correction.requestId,status:status});
  });
}

function handleAdminAddCorrection_(request, runtimeConfig) {
  const admin = requireAdminSession_(request);
  const correction = validatedCorrection_(request);
  const submissionId = correctionSubmissionId_(request);
  return integrityLock_(function () {
    const employee = readEmployees_(getEmployeeSheet_(runtimeConfig),runtimeConfig).filter(function (item) { return item.employeeId === normalizeText_(request.employeeId); })[0];
    if (!employee) throw new Error('Employee not found');
    const existing = correctionRows_(runtimeConfig).filter(function (item) { return item.submissionId === submissionId; })[0];
    if (existing) {
      if (existing.employeeId !== employee.employeeId || existing.date !== correction.date || existing.time !== correction.time || existing.punchType !== correction.punchType || existing.reason !== correction.reason || existing.reviewedBy !== admin || existing.replacesRequestId !== normalizeText_(request.replacesRequestId)) throw new Error('Submission ID already used for another correction');
      return jsonResponse_(true,'Correction already recorded',{requestId:existing.requestId,status:existing.status});
    }
    validateEffectiveCorrection_(runtimeConfig,employee.employeeId,correction);
    const id = writeCorrection_(runtimeConfig,employee,correction,admin,submissionId,normalizeText_(request.replacesRequestId));
    appendAuditLogSafe_(runtimeConfig,{eventType:'ADMIN_CORRECTION_ADDED',username:admin,detail:'RequestID=' + id + ' EmployeeID=' + employee.employeeId + ' Reason=' + correction.reason});
    return jsonResponse_(true,'Correction added',{requestId:id,status:'approved'});
  });
}

function monthContext_(request, runtimeConfig) {
  const employee = readEmployees_(getEmployeeSheet_(runtimeConfig), runtimeConfig).filter(function (item) { return item.employeeId === normalizeText_(request.employeeId); })[0];
  if (!employee) throw new Error("Employee not found");
  const year = Number(request.year);
  const month = Number(request.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2099 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("Invalid report month");
  return { employee: employee, year: year, month: month, firstDay: year + "-" + pad2_(month) + "-01", lastDay: year + "-" + pad2_(month) + "-" + pad2_(new Date(year, month, 0).getDate()) };
}

function adjustmentSheet_(runtimeConfig) {
  return getOrCreateSheet_(runtimeConfig, DEFAULT_CONFIG.ADJUSTMENT_SHEET_NAME, ["AdjustmentID", "EmployeeID", "Year", "Month", "Date", "WorkHours", "AbsenceDays", "PayAmount", "Reason", "Admin", "CreatedAt"]);
}

function adjustmentRows_(runtimeConfig, context) {
  const sheet = getSheetIfExists_(runtimeConfig, DEFAULT_CONFIG.ADJUSTMENT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues().filter(function (row) {
    return normalizeText_(row[1]) === context.employee.employeeId && Number(row[2]) === context.year && Number(row[3]) === context.month;
  }).map(function (row) { return { adjustmentId: normalizeText_(row[0]), date: sheetDate_(row[4]), workHours: row[5] === "" ? null : Number(row[5]), absenceDays: row[6] === "" ? null : Number(row[6]), payAmount: row[7] === "" ? null : Number(row[7]), reason: normalizeText_(row[8]), admin: normalizeText_(row[9]), createdAt: sheetTimestamp_(row[10]) }; });
}

function sumPayAdjustments_(adjustments) {
  return adjustments.reduce(function (sum, item) { return sum + (Number(item.payAmount) || 0); }, 0);
}

function handleAdminSaveMonthlyAdjustment_(request, runtimeConfig) {
  const admin = requireAdminSession_(request);
  const context = monthContext_(request, runtimeConfig);
  const date = normalizeText_(request.date);
  if (date && (exactDate_(date) < context.firstDay || date > context.lastDay)) throw new Error("Adjustment date must be in the report month");
  const reason = normalizeText_(request.reason);
  if (!reason || reason.charAt(0) === "=") throw new Error("Adjustment reason is required");
  const parseOptional = function (value) { return value === "" || value == null ? "" : Number(value); };
  const workHours = parseOptional(request.workHours);
  const absenceDays = parseOptional(request.absenceDays);
  const payAmount = parseOptional(request.payAmount);
  if ([workHours, absenceDays, payAmount].every(function (value) { return value === ""; })) throw new Error("Enter an adjustment value");
  if ([workHours, absenceDays, payAmount].some(function (value) { return value !== "" && !Number.isFinite(value); })) throw new Error("Invalid adjustment value");
  if (workHours !== "" && (workHours < 0 || workHours > 24)) throw new Error("Invalid work hours");
  if (absenceDays !== "" && (absenceDays < 0 || absenceDays > 1)) throw new Error("Invalid absence days");
  if (!date && (workHours !== "" || absenceDays !== "")) throw new Error("Work hours and absence adjustments require a date");
  const adjustmentId = Utilities.getUuid();
  adjustmentSheet_(runtimeConfig).appendRow([adjustmentId, context.employee.employeeId, context.year, context.month, date, workHours, absenceDays, payAmount, reason, admin, new Date().toISOString()]);
  appendAuditLogSafe_(runtimeConfig, { eventType: "MONTHLY_ADJUSTMENT", username: admin, detail: "AdjustmentID=" + adjustmentId + " EmployeeID=" + context.employee.employeeId + " Reason=" + reason });
  return jsonResponse_(true, "Adjustment saved", { adjustmentId: adjustmentId });
}

function minutes_(time) {
  const parts = time.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function lunchMinutes_(from, to, weekday) {
  if (weekday > 5) return 0;
  return Math.max(0, Math.min(to, minutes_(LUNCH_WINDOW.end)) - Math.max(from, minutes_(LUNCH_WINDOW.start)));
}

function pairedWorkHours_(punches, weekday) {
  requireValidPunches_(punches);
  const sorted = punches.slice().sort(function (a,b) { return a.time.localeCompare(b.time); });
  if (!sorted.length) return 0;
  if (!sorted.some(function (punch) { return punch.punchType === 'in' || punch.punchType === 'out'; })) {
    if (sorted.length < 2) return 0;
    const from = minutes_(sorted[0].time), to = minutes_(sorted[sorted.length-1].time);
    return Math.max(0,to-from-lunchMinutes_(from,to,weekday))/60;
  }
  let start = null, total = 0;
  sorted.forEach(function (punch) {
    if (punch.punchType === 'in') start = minutes_(punch.time);
    else if (start !== null) { const end=minutes_(punch.time); total += Math.max(0,end-start-lunchMinutes_(start,end,weekday)); start=null; }
  });
  return total/60;
}

function buildMonthlyReport_(request, runtimeConfig) {
  const context=monthContext_(request,runtimeConfig), employee=context.employee;
  requireCompleteOwnership_(runtimeConfig,employee.employeeId,context.firstDay,context.lastDay);
  const terms=reportTerms_(runtimeConfig,employee,context.year,context.month);
  const leaves=leaveRows_(runtimeConfig).filter(function (item) { return item.status === 'approved' && item.employeeId === employee.employeeId && item.startDate <= context.lastDay && item.endDate >= context.firstDay; });
  requireNoLeaveConflicts_(leaves);
  const punches={};
  effectivePunches_(runtimeConfig,employee.employeeId).forEach(function (punch) { if (punch.date >= context.firstDay && punch.date <= context.lastDay) { if (!punches[punch.date]) punches[punch.date]=[]; punches[punch.date].push(punch); } });
  const adjustments=adjustmentRows_(runtimeConfig,context).sort(function (a,b) { return (a.createdAt + a.adjustmentId).localeCompare(b.createdAt + b.adjustmentId); });
  const today=Utilities.formatDate(new Date(),'Asia/Taipei','yyyy-MM-dd');
  const days=[], warnings=(terms.warnings || []).slice();
  const summary={workedHours:0,leaveHours:0,paidLeaveHours:0,unpaidLeaveHours:0,creditedHours:0,overtimeHours:0,absenceDays:0,overtimePay:0,absenceDeduction:0,payAdjustment:0,baseSalary:terms.monthlySalary,netPay:0};
  for (let day=1;day<=new Date(context.year,context.month,0).getDate();day+=1) {
    const date=context.year+'-'+pad2_(context.month)+'-'+pad2_(day);
    const weekday=new Date(date+'T12:00:00Z').getUTCDay() || 7;
    const dailyTerms=terms.scheduleForDate(date);
    const schedule=dailyTerms.days.filter(function (item) { return Number(item.weekday) === weekday; })[0];
    const scheduledHours=schedule ? (minutes_(schedule.end)-minutes_(schedule.start)-lunchMinutes_(minutes_(schedule.start),minutes_(schedule.end),weekday))/60 : 0;
    const dayPunches=punches[date] || [], dayWarnings=punchWarnings_(dayPunches);
    let workedHours=pairedWorkHours_(dayPunches,weekday);
    dayWarnings.forEach(function (warning) { warnings.push(date+': '+warning); });
    const dayLeaves=leaves.filter(function (item) { return item.startDate<=date && item.endDate>=date; });
    let coverage;
    try { coverage=dailyLeaveCoverage_(dayLeaves,scheduledHours); }
    catch (error) { throw new Error(date + ': ' + error.message); }
    const dayAdjustments=adjustments.filter(function (item) { return item.date === date; });
    dayAdjustments.forEach(function (item) { if (item.workHours !== null) workedHours=item.workHours; });
    const payroll=calculateDailyPayroll_(Object.assign({weekday:weekday,workedHours:workedHours,monthlySalary:terms.monthlySalary,scheduledHours:date>today ? 0 : scheduledHours},coverage));
    dayAdjustments.forEach(function (item) { if (item.absenceDays !== null) { payroll.absenceDeduction+=(item.absenceDays-payroll.absenceDays)*terms.monthlySalary/26; payroll.absenceDays=item.absenceDays; } });
    const payAdjustment=sumPayAdjustments_(dayAdjustments);
    delete payroll.dayPay;
    days.push(Object.assign({date:date,weekday:weekday,scheduledHours:scheduledHours,punches:dayPunches,leaveType:coverage.leaveSegments.map(function (item) { return item.leaveType; }).join(' + '),leaveDayPart:coverage.leaveSegments.map(function (item) { return item.dayPart; }).join(' + '),leaveSegments:coverage.leaveSegments,payAdjustment:payAdjustment,scheduleVersionId:dailyTerms.versionId,scheduleGroupId:dailyTerms.groupId,warnings:dayWarnings},payroll));
    ['workedHours','leaveHours','paidLeaveHours','unpaidLeaveHours','creditedHours','overtimeHours','absenceDays','overtimePay','absenceDeduction'].forEach(function (key) { summary[key]+=payroll[key]; });
    summary.payAdjustment+=payAdjustment;
  }
  summary.payAdjustment+=sumPayAdjustments_(adjustments.filter(function (item) { return !item.date; }));
  summary.netPay=summary.baseSalary+summary.overtimePay-summary.absenceDeduction+summary.payAdjustment;
  (terms.warnings || []).forEach(function (warning) { if (warnings.indexOf(warning) === -1) warnings.push(warning); });
  return {employeeId:employee.employeeId,employeeName:employee.name,scheduleGroupId:employee.scheduleGroupId,monthlySalary:terms.monthlySalary,year:context.year,month:context.month,days:days,summary:summary,adjustments:adjustments,salaryVersion:terms.salaryVersion,termVersions:terms.versions,terms:{salaryVersion:terms.salaryVersion,versions:terms.versions,warnings:terms.warnings},warnings:warnings};
}

function handleAdminGetMonthlyReport_(request, runtimeConfig) {
  requireAdminSession_(request);
  return jsonResponse_(true, "Monthly report loaded", { report: buildMonthlyReport_(request, runtimeConfig) });
}

function csvCell_(value) {
  let text = String(value == null ? "" : value);
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function handleAdminExportMonthlyCsv_(request, runtimeConfig) {
  requireAdminSession_(request);
  const report = buildMonthlyReport_(request, runtimeConfig);
  const rows = [["Date", "Employee", "Punches", "Coordinates", "Scheduled Hours", "Worked Hours", "Leave Hours", "Leave Type", "Leave Duration", "Credited Hours", "Overtime Hours", "Absence Days", "Overtime Pay MYR", "Absence Deduction MYR", "Pay Adjustment MYR", "Paid Leave Hours", "Unpaid Leave Hours", "Schedule Version", "Warnings"]];
  report.days.forEach(function (day) {
    const punches = day.punches.map(function (punch) { return punch.time + " " + (punch.punchType || "punch") + (punch.corrected ? " (correction)" : ""); }).join(" | ");
    const coordinates = day.punches.filter(function (punch) { return punch.latitude !== "" && punch.longitude !== ""; }).map(function (punch) { return punch.time + " " + punch.latitude + "," + punch.longitude; }).join(" | ");
    rows.push([day.date, report.employeeName, punches, coordinates, day.scheduledHours, day.workedHours, day.leaveHours, day.leaveType, day.leaveDayPart, day.creditedHours, day.overtimeHours, day.absenceDays, day.overtimePay, day.absenceDeduction, day.payAdjustment, day.paidLeaveHours, day.unpaidLeaveHours, day.scheduleVersionId, day.warnings.join(" | ")]);
  });
  rows.push(["TOTAL", report.employeeName, "", "", "", report.summary.workedHours, report.summary.leaveHours, "", "", report.summary.creditedHours, report.summary.overtimeHours, report.summary.absenceDays, report.summary.overtimePay, report.summary.absenceDeduction, report.summary.payAdjustment, report.summary.paidLeaveHours, report.summary.unpaidLeaveHours, "", ""]);
  rows.push(["BASE SALARY MYR", report.summary.baseSalary]);
  rows.push(["NET PAY MYR", report.summary.netPay]);
  rows.push(["SALARY VERSION", JSON.stringify(report.salaryVersion)]);
  rows.push(["TERMS HISTORY", JSON.stringify(report.termVersions)]);
  rows.push(["REPORT WARNINGS", report.warnings.join(" | ")]);
  rows.push(["ADJUSTMENT ID", "Date / Month Scope", "Work Hours", "Absence Days", "Pay Amount MYR", "Reason", "Administrator", "Created At"]);
  report.adjustments.forEach(function (item) { rows.push([item.adjustmentId, item.date || "Whole month", item.workHours, item.absenceDays, item.payAmount, item.reason, item.admin, item.createdAt]); });
  return jsonResponse_(true, "CSV ready", { fileName: "attendance-" + report.employeeId + "-" + report.year + "-" + pad2_(report.month) + ".csv", csv: "\uFEFF" + rows.map(function (row) { return row.map(csvCell_).join(","); }).join("\r\n") });
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
