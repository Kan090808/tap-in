function ensureColumns_(sheet, count) {
  const existing = sheet.getMaxColumns();
  if (existing < count) sheet.insertColumnsAfter(existing, count - existing);
}

function sheetTimestamp_(value) {
  return value instanceof Date ? value.toISOString() : normalizeText_(value);
}

function sheetDate_(value) {
  return value instanceof Date ? Utilities.formatDate(value, "Asia/Taipei", "yyyy-MM-dd") : normalizeText_(value);
}

function employeeRows_(config) {
  const sheet = getSheetIfExists_(config, config.employeeSheetName);
  return sheet ? readEmployees_(sheet, config) : [];
}

function attendanceRows_(config) {
  const sheet = getSheetIfExists_(config, config.logSheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues().map(function (row, index) {
    const timestamp = sheetTimestamp_(row[0]);
    const instant = new Date(timestamp);
    const valid = !isNaN(instant.getTime());
    return {
      rowNumber: index + 2, sourceId: "device:" + (index + 2), timestamp: timestamp,
      employeeName: normalizeText_(row[1]), deviceUUID: normalizeText_(row[2]),
      employeeId: normalizeText_(row[8]), locationStatus: normalizeText_(row[4]),
      latitude: row[5] == null ? "" : row[5], longitude: row[6] == null ? "" : row[6], punchType: normalizeText_(row[7]),
      date: valid ? Utilities.formatDate(instant, "Asia/Taipei", "yyyy-MM-dd") : "",
      time: valid ? Utilities.formatDate(instant, "Asia/Taipei", "HH:mm") : ""
    };
  });
}

function requireCompleteOwnership_(config, employeeId, firstDay, lastDay) {
  const ids = employeeRows_(config).map(function (employee) { return employee.employeeId; });
  const invalid = attendanceRows_(config).some(function (row) {
    return (row.employeeId === employeeId && !row.date) || ((!row.employeeId || ids.indexOf(row.employeeId) < 0) && (!row.date || (row.date >= firstDay && row.date <= lastDay)));
  }) || leaveRows_(config).some(function (row) {
    return (!row.employeeId || ids.indexOf(row.employeeId) < 0) && (!row.startDate || !row.endDate || (row.startDate <= lastDay && row.endDate >= firstDay));
  });
  if (invalid) throw new Error("Historical ownership is incomplete for this period. Ask an administrator to preview and resolve the migration before using this report.");
}

function closeEmployeeBindings_(sheet, employeeId) {
  ensureColumns_(sheet, 5);
  sheet.getRange(1, 1, 1, 5).setValues([["Employee Name", "Device UUID", "Bound At", "Employee ID", "Ended At"]]);
  if (sheet.getLastRow() < 2) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  rows.forEach(function (row, index) {
    if (normalizeText_(row[3]) === employeeId && !row[4]) sheet.getRange(index + 2, 5).setValue(new Date().toISOString());
  });
}

function migrationSources_(config) {
  return [
    { name: config.logSheetName, width: 9, idColumn: 9, nameColumn: 2, deviceColumn: 3 },
    { name: config.leaveSheetName, width: 17, idColumn: 17, nameColumn: 2, deviceColumn: 3 },
    { name: config.bindingSheetName, width: 5, idColumn: 4, nameColumn: 1, deviceColumn: 2 },
    { name: DEFAULT_CONFIG.CORRECTION_SHEET_NAME, width: 20, idColumn: 2, nameColumn: 3, deviceColumn: 4 }
  ];
}

function migrationFingerprint_(row) {
  return sha256Hex_(JSON.stringify(row.map(function (value) { return value instanceof Date ? value.toISOString() : value; })));
}

function previewIdentityMigration_(config) {
  const employees = employeeRows_(config);
  const unresolved = [];
  const durations = [];
  migrationSources_(config).forEach(function (source) {
    const sheet = getSheetIfExists_(config, source.name);
    if (!sheet || sheet.getLastRow() < 2) return;
    sheet.getRange(2, 1, sheet.getLastRow() - 1, source.width).getValues().forEach(function (row, index) {
      const employeeId = normalizeText_(row[source.idColumn - 1]);
      const name = normalizeText_(row[source.nameColumn - 1]);
      const device = normalizeText_(row[source.deviceColumn - 1]);
      const candidates = employees.filter(function (employee) { return employee.name === name || (device && employee.deviceUUID === device); });
      if (!employeeId || !employees.some(function (employee) { return employee.employeeId === employeeId; })) {
        unresolved.push({ sheet: source.name, rowNumber: index + 2, fingerprint: migrationFingerprint_(row), employeeId: employeeId, name: name, deviceUUID: device, candidateEmployeeIds: candidates.map(function (employee) { return employee.employeeId; }), reason: employeeId ? "Employee master record missing; recover it before mapping" : "Confirm historical owner from evidence; current name/device is not proof" });
      }
      if (source.name === config.leaveSheetName && ["full", "am", "pm"].indexOf(normalizeText_(row[12])) < 0) {
        durations.push({ sheet: source.name, rowNumber: index + 2, fingerprint: migrationFingerprint_(row), requestId: normalizeText_(row[0]), reason: "Verify legacy leave duration" });
      }
    });
  });
  const malformedPunches = [];
  const byDay = {};
  attendanceRows_(config).forEach(function (punch) {
    if (!punch.date) malformedPunches.push({ rowNumber: punch.rowNumber, reason: "Invalid attendance timestamp" });
    if (punch.employeeId && punch.date) {
      const key = punch.employeeId + ":" + punch.date;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(punch);
    }
  });
  if (typeof punchWarnings_ === "function") Object.keys(byDay).forEach(function (key) {
    const warnings = punchWarnings_(byDay[key]);
    if (warnings.length) malformedPunches.push({ employeeDate: key, warnings: warnings });
  });
  const approved = leaveRows_(config).filter(function (leave) { return leave.status === "approved"; });
  const validApproved = approved.filter(function (leave) { return leave.employeeId && ["full", "am", "pm"].indexOf(leave.dayPart) >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(leave.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(leave.endDate); });
  let overlaps = [];
  try { overlaps = approvedLeaveConflicts_(validApproved); } catch (error) { overlaps = [{ reason: error.message }]; }
  return { schemaVersion: 2, unresolved: unresolved, unknownDurations: durations, unknownLeaveTypes: approved.filter(function (leave) { return ["personal", "annual", "sick"].indexOf(leave.leaveType) < 0; }).map(function (leave) { return { requestId: leave.requestId, rowNumber: leave.rowNumber, leaveType: leave.leaveType }; }), malformedPunches: malformedPunches, approvedLeaveOverlaps: overlaps, employeesMissingIds: employees.filter(function (employee) { return !employee.employeeId; }).map(function (employee) { return { rowNumber: employee.rowNumber, name: employee.name }; }), baselineWarning: "Only current known salary and schedule settings can be captured. Verify historical terms before relying on prior payroll." };
}

function handleAdminPreviewMigration_(request, config) {
  requireAdminSession_(request);
  return jsonResponse_(true, "Migration preview loaded; no data changed", { migration: previewIdentityMigration_(config) });
}

function handleAdminApplyMigration_(request, config) {
  const admin = requireAdminSession_(request);
  const mappings = Array.isArray(request.mappings) ? request.mappings : [];
  const targets = {};
  mappings.forEach(function (mapping) {
    const target = mapping.sheet + ":" + mapping.rowNumber;
    if (targets[target]) throw new Error("Duplicate migration mappings for the same row are not allowed");
    targets[target] = true;
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const employeeSheet = getEmployeeSheet_(config);
    let employees = readEmployees_(employeeSheet, config);
    employees.forEach(function (employee) {
      if (!employee.employeeId) employeeSheet.getRange(employee.rowNumber, 5).setValue(Utilities.getUuid());
      if (!employeeSheet.getRange(employee.rowNumber, 8).getValue()) employeeSheet.getRange(employee.rowNumber, 8).setValue("active");
    });
    employees = readEmployees_(employeeSheet, config);
    const sources = migrationSources_(config);
    const plans = mappings.map(function (mapping) {
      const source = sources.find(function (item) { return item.name === mapping.sheet; });
      if (!source || !Number.isInteger(mapping.rowNumber) || mapping.rowNumber < 2) throw new Error("Invalid migration row");
      const sheet = getSheetIfExists_(config, source.name);
      if (!sheet || mapping.rowNumber > sheet.getLastRow()) throw new Error("Migration row not found");
      ensureColumns_(sheet, source.width);
      const row = sheet.getRange(mapping.rowNumber, 1, 1, source.width).getValues()[0];
      const currentId = normalizeText_(row[source.idColumn - 1]);
      const employeeId = normalizeText_(mapping.employeeId) || currentId;
      if (!employeeId || !employees.some(function (employee) { return employee.employeeId === employeeId; })) throw new Error("Recover the employee master record before mapping historical rows");
      if (currentId && currentId !== employeeId) throw new Error("A confirmed employee ID cannot be overwritten by migration");
      const alreadyApplied = currentId === employeeId && (!mapping.dayPart || normalizeText_(row[12]) === mapping.dayPart);
      if (!alreadyApplied && (!mapping.fingerprint || migrationFingerprint_(row) !== mapping.fingerprint)) throw new Error("Migration row changed. Refresh the preview before confirming its ownership");
      const evidence = normalizeText_(mapping.evidence);
      if (!evidence || evidence.charAt(0) === "=") throw new Error("Migration evidence is required");
      if (mapping.dayPart && (source.name !== config.leaveSheetName || ["full", "am", "pm"].indexOf(mapping.dayPart) < 0)) throw new Error("Invalid legacy leave duration");
      return { mapping: mapping, source: source, sheet: sheet, employeeId: employeeId, row: row, skip: alreadyApplied };
    });
    const audit = getOrCreateSheet_(config, "MigrationMappings", ["Sheet", "Row", "Fingerprint", "EmployeeID", "DayPart", "Evidence", "Admin", "ConfirmedAt"]);
    const confirmations = audit.getLastRow() > 1 ? audit.getRange(2, 1, audit.getLastRow() - 1, 8).getValues() : [];
    plans.forEach(function (plan) {
      if (plan.skip) return;
      const mapping = plan.mapping;
      // Persist confirmation first so an interrupted ID write can be retried from recorded evidence.
      const confirmed = confirmations.some(function (row) { return row[0] === plan.source.name && Number(row[1]) === mapping.rowNumber && row[2] === mapping.fingerprint && row[3] === plan.employeeId && row[4] === (mapping.dayPart || ""); });
      if (!confirmed) audit.appendRow([plan.source.name, mapping.rowNumber, mapping.fingerprint, plan.employeeId, mapping.dayPart || "", mapping.evidence, admin, new Date().toISOString()]);
      if (mapping.dayPart) {
        const values = plan.row.slice(12, 17);
        values[0] = mapping.dayPart;
        values[4] = plan.employeeId;
        plan.sheet.getRange(mapping.rowNumber, 13, 1, 5).setValues([values]);
      } else plan.sheet.getRange(mapping.rowNumber, plan.source.idColumn).setValue(plan.employeeId);
    });
    seedEmploymentTerms_(config, employees, admin);
    const migration = previewIdentityMigration_(config);
    PropertiesService.getScriptProperties().setProperty("TAPIN_SCHEMA_VERSION", "2");
    return jsonResponse_(true, "Migration checkpoint saved; review remaining unresolved records", { migration: migration });
  } finally { lock.releaseLock(); }
}
