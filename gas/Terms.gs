const TERM_SHEETS_ = {
  salaries: { name: 'SalaryHistory', headers: ['VersionID', 'EmployeeID', 'EffectiveDate', 'Amount', 'Reason', 'Actor', 'CreatedAt', 'Provenance'] },
  schedules: { name: 'ScheduleVersions', headers: ['VersionID', 'GroupID', 'EffectiveDate', 'DaysJSON', 'Reason', 'Actor', 'CreatedAt', 'Provenance'] },
  assignments: { name: 'ScheduleAssignments', headers: ['VersionID', 'EmployeeID', 'EffectiveDate', 'ScheduleVersionID', 'GroupID', 'Reason', 'Actor', 'CreatedAt', 'Provenance'] }
};

function termsToday_() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
}

function termRows_(cfg, kind) {
  const definition = TERM_SHEETS_[kind];
  const sheet = getSheetIfExists_(cfg, definition.name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, definition.headers.length).getValues().map(function (row, index) {
    const common = { versionId: normalizeText_(row[0]), effectiveDate: termDateText_(row[2]), sequence: index };
    if (kind === 'salaries') return Object.assign(common, { employeeId: normalizeText_(row[1]), amount: Number(row[3]), reason: normalizeText_(row[4]), actor: normalizeText_(row[5]), createdAt: termTimestamp_(row[6]), provenance: normalizeText_(row[7]) });
    if (kind === 'assignments') return Object.assign(common, { employeeId: normalizeText_(row[1]), scheduleVersionId: normalizeText_(row[3]), groupId: normalizeText_(row[4]), reason: normalizeText_(row[5]), actor: normalizeText_(row[6]), createdAt: termTimestamp_(row[7]), provenance: normalizeText_(row[8]) });
    let days;
    try { days = JSON.parse(row[3]); } catch (_error) { throw new Error('Invalid stored schedule version: ' + common.versionId); }
    if (!Array.isArray(days)) throw new Error('Invalid stored schedule version: ' + common.versionId);
    return Object.assign(common, { groupId: normalizeText_(row[1]), days: days, reason: normalizeText_(row[4]), actor: normalizeText_(row[5]), createdAt: termTimestamp_(row[6]), provenance: normalizeText_(row[7]) });
  });
}

function termDateText_(value) {
  return value instanceof Date ? Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd') : normalizeText_(value);
}

function termTimestamp_(value) {
  return value instanceof Date ? value.toISOString() : normalizeText_(value);
}

function appendTerm_(cfg, kind, row) {
  const definition = TERM_SHEETS_[kind];
  getOrCreateSheet_(cfg, definition.name, definition.headers).appendRow(row);
}

function latestTerm_(items, date) {
  return items.filter(function (item) { return item.effectiveDate <= date; }).sort(function (a, b) {
    return a.effectiveDate.localeCompare(b.effectiveDate) || a.sequence - b.sequence;
  }).pop() || null;
}

function validateTermDate_(value, salary, request) {
  let date = normalizeText_(value);
  if (salary && /^\d{4}-\d{2}$/.test(date)) date += '-01';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01' || date > '9999-12-31' || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) throw new Error('A valid effective date is required');
  if (salary && date.slice(8) !== '01') throw new Error("Salary changes require a month's first day");
  if (date < termsToday_() && request.allowBackdate !== true) throw new Error('Backdated terms require explicit confirmation. Affected historical reports will recalculate.');
  return date;
}

function termReason_(request) {
  const reason = normalizeText_(request.reason || request.termsReason);
  if (!reason || reason.charAt(0) === '=') throw new Error('A reason is required for employment term changes');
  return reason;
}

function defaultSalaryDate_() {
  const today = termsToday_();
  const month = Number(today.slice(5, 7));
  return String(Number(today.slice(0, 4)) + (month === 12 ? 1 : 0)) + '-' + String(month === 12 ? 1 : month + 1).padStart(2, '0') + '-01';
}

function employeeTermPlan_(request, existing, saved, cfg) {
  const salaryChanged = !existing || Number(existing.monthlySalary) !== Number(saved.monthlySalary) || request.correctSalary === true;
  const scheduleChanged = !existing || existing.scheduleGroupId !== saved.scheduleGroupId || request.correctSchedule === true;
  if (!salaryChanged && !scheduleChanged) return null;
  if (!Number.isFinite(Number(saved.monthlySalary)) || Number(saved.monthlySalary) < 0) throw new Error('Monthly salary must be a nonnegative number');
  const reason = termReason_(request);
  const requestedSalaryDate = request.salaryEffectiveDate || request.salaryEffectiveMonth || request.effectiveMonth || (!existing ? termsToday_().slice(0, 7) + '-01' : defaultSalaryDate_());
  const initialCurrentMonth = !existing && normalizeText_(requestedSalaryDate).slice(0, 7) === termsToday_().slice(0, 7);
  const salaryDate = salaryChanged ? validateTermDate_(requestedSalaryDate, true, initialCurrentMonth ? Object.assign({}, request, { allowBackdate: true }) : request) : '';
  const scheduleDate = scheduleChanged ? validateTermDate_(request.scheduleEffectiveDate || request.effectiveDate || termsToday_(), false, request) : '';
  if (!getScheduleGroups_(cfg).some(function (group) { return group.groupId === saved.scheduleGroupId; })) throw new Error('Schedule group not found');
  const versions = termRows_(cfg, 'schedules').filter(function (item) { return item.groupId === saved.scheduleGroupId; });
  if (scheduleChanged && versions.length && !latestTerm_(versions, scheduleDate)) throw new Error('No schedule version exists for the effective date');
  return { salaryChanged: salaryChanged, scheduleChanged: scheduleChanged, reason: reason, salaryDate: salaryDate, scheduleDate: scheduleDate };
}

function validateEmployeeTerms_(request, existing, saved, cfg) {
  employeeTermPlan_(request, existing, saved, cfg);
}

function seedEmploymentTerms_(cfg, employees, admin) {
  const salaries = termRows_(cfg, 'salaries');
  const assignments = termRows_(cfg, 'assignments');
  const versions = termRows_(cfg, 'schedules');
  const groups = getScheduleGroups_(cfg);
  employees.forEach(function (employee) {
    if (!employee.employeeId) throw new Error('Run the employee identity migration before changing employment terms');
    if (!groups.some(function (group) { return group.groupId === employee.scheduleGroupId; }) && !assignments.some(function (item) { return item.employeeId === employee.employeeId; })) throw new Error('Schedule group not found for employee ' + employee.employeeId);
  });
  const now = new Date().toISOString();
  const reason = 'Current known settings captured during migration; historical values are unverified';
  groups.forEach(function (group) {
    if (!versions.some(function (item) { return item.groupId === group.groupId; })) {
      const version = { versionId: Utilities.getUuid(), groupId: group.groupId, effectiveDate: '0001-01-01', sequence: versions.length, days: group.days };
      appendTerm_(cfg, 'schedules', [version.versionId, group.groupId, version.effectiveDate, JSON.stringify(group.days), reason, admin, now, 'current-known-baseline']);
      versions.push(version);
    }
  });
  employees.forEach(function (employee) {
    if (!salaries.some(function (item) { return item.employeeId === employee.employeeId; })) appendTerm_(cfg, 'salaries', [Utilities.getUuid(), employee.employeeId, '0001-01-01', Number(employee.monthlySalary) || 0, reason, admin, now, 'current-known-baseline']);
    if (!assignments.some(function (item) { return item.employeeId === employee.employeeId; })) {
      const version = latestTerm_(versions.filter(function (item) { return item.groupId === employee.scheduleGroupId; }), termsToday_());
      if (!version) throw new Error('Schedule group not found for employee ' + employee.employeeId);
      appendTerm_(cfg, 'assignments', [Utilities.getUuid(), employee.employeeId, '0001-01-01', version.versionId, employee.scheduleGroupId, reason, admin, now, 'current-known-baseline']);
    }
  });
}

function saveEmployeeTerms_(request, existing, saved, cfg, admin) {
  const plan = employeeTermPlan_(request, existing, saved, cfg);
  if (!plan) return;
  if (existing) seedEmploymentTerms_(cfg, [existing], admin);
  else seedEmploymentTerms_(cfg, [], admin);
  const now = new Date().toISOString();
  if (plan.salaryChanged) appendTerm_(cfg, 'salaries', [Utilities.getUuid(), saved.employeeId, plan.salaryDate, Number(saved.monthlySalary), plan.reason, admin, now, existing ? 'admin-verified' : 'employee-creation']);
  if (plan.scheduleChanged) {
    const version = latestTerm_(termRows_(cfg, 'schedules').filter(function (item) { return item.groupId === saved.scheduleGroupId; }), plan.scheduleDate);
    if (!version) throw new Error('No schedule version exists for the effective date');
    appendTerm_(cfg, 'assignments', [Utilities.getUuid(), saved.employeeId, plan.scheduleDate, version.versionId, saved.scheduleGroupId, plan.reason, admin, now, existing ? 'admin-verified' : 'employee-creation']);
    const futureAssignment = termRows_(cfg, 'assignments').filter(function (item) { return item.employeeId === saved.employeeId && item.effectiveDate > plan.scheduleDate; }).sort(function (a, b) { return a.effectiveDate.localeCompare(b.effectiveDate); })[0];
    const futureVersions = termRows_(cfg, 'schedules').filter(function (item) { return item.groupId === saved.scheduleGroupId && item.effectiveDate > plan.scheduleDate && (!futureAssignment || item.effectiveDate < futureAssignment.effectiveDate); });
    const futureDates = {};
    futureVersions.forEach(function (item) { futureDates[item.effectiveDate] = true; });
    Object.keys(futureDates).sort().forEach(function (date) {
      const futureVersion = latestTerm_(futureVersions, date);
      appendTerm_(cfg, 'assignments', [Utilities.getUuid(), saved.employeeId, date, futureVersion.versionId, saved.scheduleGroupId, plan.reason, admin, now, 'admin-verified']);
    });
  }
}

function validateScheduleTerms_(request, group, cfg) {
  termReason_(request);
  validateTermDate_(request.scheduleEffectiveDate || request.effectiveDate || termsToday_(), false, request);
}

function saveScheduleTerms_(request, group, cfg, admin) {
  validateScheduleTerms_(request, group, cfg);
  const date = validateTermDate_(request.scheduleEffectiveDate || request.effectiveDate || termsToday_(), false, request);
  const reason = termReason_(request);
  const employees = readEmployees_(getEmployeeSheet_(cfg), cfg);
  seedEmploymentTerms_(cfg, employees, admin);
  const assignments = termRows_(cfg, 'assignments');
  const now = new Date().toISOString();
  const versionId = Utilities.getUuid();
  appendTerm_(cfg, 'schedules', [versionId, group.groupId, date, JSON.stringify(group.days), reason, admin, now, 'admin-verified']);
  employees.forEach(function (employee) {
    const effective = latestTerm_(assignments.filter(function (item) { return item.employeeId === employee.employeeId; }), date);
    if (effective && effective.groupId === group.groupId) appendTerm_(cfg, 'assignments', [Utilities.getUuid(), employee.employeeId, date, versionId, group.groupId, reason, admin, now, 'admin-verified']);
    const futureDates = {};
    assignments.filter(function (item) { return item.employeeId === employee.employeeId && item.effectiveDate > date; }).forEach(function (item) { futureDates[item.effectiveDate] = true; });
    Object.keys(futureDates).sort().forEach(function (futureDate) {
      const future = latestTerm_(assignments.filter(function (item) { return item.employeeId === employee.employeeId; }), futureDate);
      if (future.groupId !== group.groupId) return;
      const applicable = latestTerm_(termRows_(cfg, 'schedules').filter(function (item) { return item.groupId === group.groupId; }), futureDate);
      if (applicable && applicable.versionId !== future.scheduleVersionId) appendTerm_(cfg, 'assignments', [Utilities.getUuid(), employee.employeeId, futureDate, applicable.versionId, group.groupId, reason, admin, now, 'admin-verified']);
    });
  });
}

function employeeHistory_(cfg, employee) {
  const salaries = termRows_(cfg, 'salaries').filter(function (item) { return item.employeeId === employee.employeeId; });
  const assignments = termRows_(cfg, 'assignments').filter(function (item) { return item.employeeId === employee.employeeId; });
  const versions = termRows_(cfg, 'schedules').filter(function (version) { return assignments.some(function (assignment) { return assignment.scheduleVersionId === version.versionId; }); });
  return { employeeId: employee.employeeId, salaries: salaries, assignments: assignments, scheduleVersions: versions, warnings: salaries.concat(assignments).some(function (item) { return item.provenance === 'current-known-baseline'; }) ? ['Migration baselines contain current known settings; historical terms are unverified.'] : [] };
}

function reportTerms_(cfg, employee, year, month) {
  const history = employeeHistory_(cfg, employee);
  const date = String(year) + '-' + String(month).padStart(2, '0') + '-01';
  const salary = latestTerm_(history.salaries, date);
  if (!salary) throw new Error('Employment terms are incomplete. Run the migration or add verified salary history for employee ' + employee.employeeId);
  const used = {};
  const warnings = [];
  function record(item) {
    used[item.versionId] = item;
    if (item.provenance === 'current-known-baseline' && warnings.indexOf('Historical employment terms are unverified: current known migration baseline used.') < 0) warnings.push('Historical employment terms are unverified: current known migration baseline used.');
  }
  record(salary);
  const result = { monthlySalary: salary.amount, salaryVersion: salary, warnings: warnings, versions: [salary], scheduleForDate: function (day) {
    const assignment = latestTerm_(history.assignments, day);
    if (!assignment) {
      const first = history.assignments.slice().sort(function (a, b) { return a.effectiveDate.localeCompare(b.effectiveDate) || a.sequence - b.sequence; })[0];
      if (first && first.provenance === 'employee-creation' && day < first.effectiveDate) return { days: [], versionId: '', assignmentId: '', groupId: '' };
      throw new Error('No schedule assignment exists for ' + day);
    }
    const version = history.scheduleVersions.filter(function (item) { return item.versionId === assignment.scheduleVersionId; })[0];
    if (!version) throw new Error('Missing schedule version for ' + day);
    record(assignment);
    record(version);
    result.versions = Object.keys(used).map(function (id) { return used[id]; });
    return { days: version.days, versionId: version.versionId, assignmentId: assignment.versionId, groupId: assignment.groupId };
  } };
  return result;
}

function handleAdminGetEmploymentTerms_(request, cfg) {
  requireAdminSession_(request);
  const employee = readEmployees_(getEmployeeSheet_(cfg), cfg).filter(function (item) { return item.employeeId === normalizeText_(request.employeeId); })[0];
  if (!employee) throw new Error('Employee not found');
  return jsonResponse_(true, 'Employment terms loaded', employeeHistory_(cfg, employee));
}

function handleAdminSaveEmploymentTerms_(request, cfg) {
  const admin = requireAdminSession_(request);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const employee = readEmployees_(getEmployeeSheet_(cfg), cfg).filter(function (item) { return item.employeeId === normalizeText_(request.employeeId); })[0];
    if (!employee) throw new Error('Employee not found');
    if (request.monthlySalary == null && !request.scheduleGroupId) throw new Error('A salary or schedule correction is required');
    const saved = Object.assign({}, employee, {
      monthlySalary: request.monthlySalary == null ? employee.monthlySalary : Number(request.monthlySalary),
      scheduleGroupId: normalizeText_(request.scheduleGroupId) || employee.scheduleGroupId
    });
    const correction = Object.assign({}, request, { correctSalary: request.monthlySalary != null, correctSchedule: !!request.scheduleGroupId });
    validateEmployeeTerms_(correction, employee, saved, cfg);
    saveEmployeeTerms_(correction, employee, saved, cfg, admin);
    return jsonResponse_(true, 'Employment terms saved. Affected reports will recalculate.', employeeHistory_(cfg, employee));
  } finally {
    lock.releaseLock();
  }
}
