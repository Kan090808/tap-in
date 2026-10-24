function exactDate_(value) {
  const date = normalizeText_(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T12:00:00Z').getTime()) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
  return date;
}

function integrityLock_(operation) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return operation(); } finally { lock.releaseLock(); }
}

function leaveSegments_(leave) {
  const part = normalizeText_(leave.dayPart);
  if (['full', 'am', 'pm'].indexOf(part) === -1) throw new Error('Invalid leave duration');
  return part === 'full' ? ['am', 'pm'] : [part];
}

function dailyLeaveCoverage_(leaves, scheduledHours) {
  const occupied = {};
  const result = { leaveHours: 0, paidLeaveHours: 0, unpaidLeaveHours: 0, leaveSegments: [] };
  leaves.forEach(function (leave) {
    if (['personal', 'annual', 'sick'].indexOf(leave.leaveType) < 0) throw new Error('Unknown leave type requires administrator review before calculating payroll');
    const segments = leaveSegments_(leave);
    segments.forEach(function (segment) {
      if (occupied[segment]) throw new Error('Approved leave overlap in ' + segment + ': ' + occupied[segment] + ' and ' + leave.requestId);
      occupied[segment] = leave.requestId || 'request';
    });
    const hours = leave.dayPart === 'full' ? Math.max(0, scheduledHours) : Math.min(4, Math.max(0, scheduledHours));
    result.leaveSegments.push({ requestId: leave.requestId, leaveType: leave.leaveType, dayPart: leave.dayPart, hours: hours });
  });
  const total = result.leaveSegments.reduce(function (sum, item) { return sum + item.hours; }, 0);
  if (total > scheduledHours) throw new Error('Approved leave exceeds scheduled hours. Review and cancel the extra request; leave hours cannot be allocated automatically.');
  result.leaveSegments.forEach(function (item) {
    result.leaveHours += item.hours;
    result[item.leaveType === 'personal' ? 'unpaidLeaveHours' : 'paidLeaveHours'] += item.hours;
  });
  return result;
}

function requireLeaveCapacity_(runtimeConfig, employeeId, leaves, firstDay, lastDay) {
  const employee = employeeRows_(runtimeConfig).filter(function (item) { return item.employeeId === employeeId; })[0];
  if (!employee) throw new Error('Employee not found');
  const terms = {};
  for (let date = firstDay; date <= lastDay; date = new Date(new Date(date + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)) {
    const month = date.slice(0, 7);
    if (!terms[month]) terms[month] = reportTerms_(runtimeConfig, employee, Number(date.slice(0, 4)), Number(date.slice(5, 7)));
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay() || 7;
    const schedule = terms[month].scheduleForDate(date).days.filter(function (item) { return Number(item.weekday) === weekday; })[0];
    const hours = schedule ? (minutes_(schedule.end) - minutes_(schedule.start) - lunchMinutes_(minutes_(schedule.start), minutes_(schedule.end), weekday)) / 60 : 0;
    try { dailyLeaveCoverage_(leaves.filter(function (item) { return item.status === 'approved' && item.startDate <= date && item.endDate >= date; }), hours); }
    catch (error) { throw new Error(date + ': ' + error.message); }
  }
}

function approvedLeaveConflicts_(leaves) {
  const conflicts = [];
  const occupied = {};
  leaves.filter(function (leave) { return leave.status === 'approved'; }).forEach(function (leave) {
    exactDate_(leave.startDate); exactDate_(leave.endDate);
    for (let date = leave.startDate; date <= leave.endDate; date = new Date(new Date(date + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)) {
      leaveSegments_(leave).forEach(function (segment) {
        const key = leave.employeeId + '/' + date + '/' + segment;
        if (occupied[key]) conflicts.push({ employeeId: leave.employeeId, date: date, segment: segment, requestIds: [occupied[key], leave.requestId] });
        occupied[key] = leave.requestId;
      });
    }
  });
  return conflicts;
}

function requireNoLeaveConflicts_(leaves) {
  const conflict = approvedLeaveConflicts_(leaves)[0];
  if (conflict) throw new Error('Approved leave overlap on ' + conflict.date + ' ' + conflict.segment + ' (' + conflict.requestIds.join(', ') + '). Cancel the conflicting request before calculating payroll.');
}

function effectivePunches_(runtimeConfig, employeeId, date) {
  const punches = attendanceRows_(runtimeConfig).filter(function (item) { return item.employeeId === employeeId && (!date || item.date === date); }).map(function (item) { return Object.assign({}, item, { source: 'device' }); });
  correctionRows_(runtimeConfig).forEach(function (item) {
    if (item.employeeId !== employeeId || item.status !== 'approved' || (date && item.date !== date)) return;
    punches.push({ date: item.date, time: item.time, punchType: item.punchType, sourceId: item.requestId, source: item.origin || 'correction', locationStatus: 'Correction', latitude: '', longitude: '', corrected: true });
  });
  return punches.sort(function (a, b) { return (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time); });
}

function punchWarnings_(punches) {
  const sorted = punches.slice().sort(function (a,b) { return a.time.localeCompare(b.time); });
  const explicit = sorted.filter(function (p) { return p.punchType === 'in' || p.punchType === 'out'; });
  const warnings = [];
  if (explicit.length && explicit.length !== sorted.length) warnings.push('Mixed typed and legacy punches require review');
  if (!explicit.length) return warnings;
  for (let i=1; i<sorted.length; i+=1) {
    if (sorted[i].time === sorted[i-1].time) warnings.push('Punch conflict at the same time: ' + sorted[i].time);
    if (sorted[i].punchType === sorted[i-1].punchType) warnings.push('Punch conflict: consecutive ' + sorted[i].punchType + ' events');
  }
  if (explicit[0].punchType === 'out' || explicit[explicit.length-1].punchType === 'in') warnings.push('Incomplete punch pair requires review');
  return warnings;
}

function requireValidPunches_(punches) {
  const conflict = punchWarnings_(punches).filter(function (warning) { return warning.indexOf('Incomplete') !== 0; })[0];
  if (conflict) throw new Error(conflict);
}

function validatedCorrection_(request) {
  const result = validateCorrection_(request);
  exactDate_(result.date);
  return result;
}

function validateEffectiveCorrection_(runtimeConfig, employeeId, correction) {
  if (!employeeId) throw new Error('Resolve correction employee ownership before approval');
  requireCompleteOwnership_(runtimeConfig, employeeId, correction.date, correction.date);
  requireValidPunches_(effectivePunches_(runtimeConfig, employeeId, correction.date).concat([correction]));
}

function correctionHeaders_() {
  return ['RequestID','EmployeeID','EmployeeName','DeviceUUID','Date','PunchType','Time','Reason','Status','SubmittedAt','ReviewedBy','ReviewNote','ReviewedAt','Origin','SubmissionID','RevokedAt','RevokedBy','RevocationReason','RevocationSubmissionID','ReplacesRequestID'];
}

function correctionSubmissionId_(request) {
  const id = normalizeText_(request.submissionId);
  if (!id || id.length > 128 || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('A valid submission ID is required');
  return id;
}

function writeCorrection_(runtimeConfig, employee, correction, admin, submissionId, replacesRequestId) {
  const now = new Date().toISOString();
  const id = Utilities.getUuid();
  if (replacesRequestId) {
    const replaced = correctionRows_(runtimeConfig).filter(function (item) { return item.requestId === replacesRequestId && item.employeeId === employee.employeeId && item.status === 'revoked'; })[0];
    if (!replaced) throw new Error('Replacement must reference a revoked correction for this employee');
  }
  correctionSheet_(runtimeConfig).appendRow([id,employee.employeeId,employee.name,employee.deviceUUID,correction.date,correction.punchType,correction.time,correction.reason,admin ? 'approved' : 'pending',now,admin || '',admin ? 'Admin entry' : '',admin ? now : '',admin ? 'admin' : 'employee',submissionId || '','','','','',replacesRequestId || '']);
  return id;
}

function handleAdminRevokeCorrection_(request, runtimeConfig) {
  const admin = requireAdminSession_(request);
  const reason = normalizeText_(request.reason);
  if (!reason || reason.charAt(0) === '=') throw new Error('Revocation reason is required');
  const submissionId = correctionSubmissionId_(request);
  return integrityLock_(function () {
    const history = correctionRows_(runtimeConfig);
    if (history.some(function (item) { return item.revocationSubmissionId === submissionId && item.requestId !== normalizeText_(request.requestId); })) throw new Error('Submission ID already used for another revocation');
    const correction = history.filter(function (item) { return item.requestId === normalizeText_(request.requestId); })[0];
    if (!correction) throw new Error('Correction not found');
    if (correction.status === 'revoked' && correction.revocationSubmissionId === submissionId && correction.revocationReason === reason && correction.revokedBy === admin) return jsonResponse_(true,'Correction revoked',{requestId:correction.requestId,status:'revoked'});
    if (correction.status !== 'approved') throw new Error('Only approved corrections can be revoked');
    const sheet = correctionSheet_(runtimeConfig);
    sheet.getRange(correction.rowNumber,16,1,4).setValues([[new Date().toISOString(),admin,reason,submissionId]]);
    sheet.getRange(correction.rowNumber,9).setValue('revoked');
    appendAuditLogSafe_(runtimeConfig,{eventType:'CORRECTION_REVOKED',username:admin,detail:'RequestID=' + correction.requestId + ' Reason=' + reason});
    return jsonResponse_(true,'Correction revoked',{requestId:correction.requestId,status:'revoked',warnings:punchWarnings_(effectivePunches_(runtimeConfig,correction.employeeId,correction.date))});
  });
}
