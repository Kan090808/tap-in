const test = require('node:test');
const assert = require('node:assert/strict');
const { createGas } = require('./helpers/gas');

const employeeHeader = ['Employee Name', 'Phone', 'Email', 'Device UUID', 'Employee ID', 'Schedule Group ID', 'Monthly Salary MYR', 'Status', 'Archived At', 'Archived By'];
const logHeader = ['Timestamp', 'Employee Name', 'Device UUID', 'IP Address', 'Location Status', 'Latitude', 'Longitude', 'Punch Type', 'Employee ID'];
const leaveHeader = ['RequestID', 'EmployeeName', 'DeviceUUID', 'LeaveType', 'StartDate', 'EndDate', 'Reason', 'Status', 'SubmittedAt', 'ReviewedAt', 'ReviewedBy', 'ReviewNote', 'DayPart', 'EvidenceURL', 'CancelledAt', 'CancelledBy', 'EmployeeID'];
function fixture() {
  return createGas({
    Employees: [employeeHeader, ['Renamed', '', '', 'new-device', 'e1', 'mon-fri', 5200, 'active'], ['Other', '', '', 'old-device', 'e2', 'mon-fri', 5200, 'active']],
    DeviceBindings: [['Employee Name', 'Device UUID', 'Bound At', 'Employee ID', 'Ended At'], ['Renamed', 'new-device', '2026-10-01T00:00:00Z', 'e1', ''], ['Other', 'old-device', '2026-10-02T00:00:00Z', 'e2', '']],
    AttendanceLogs: [logHeader, ['2026-10-01T01:00:00Z', 'Old Name', 'old-device', '', 'Office', 3, 101, 'in', 'e1'], ['2026-10-01T10:00:00Z', 'Old Name', 'old-device', '', 'Office', 3, 101, 'out', 'e1']],
    LeaveRequests: [leaveHeader, ['l1', 'Old Name', 'old-device', 'annual', '2026-10-02', '2026-10-02', 'Leave', 'approved', '2026-09-01T00:00:00Z', '', '', '', 'full', '', '', '', 'e1']],
  });
}

test('employee calendar retains renamed history and does not expose it to a reused device', () => {
  const gas = fixture();
  const own = gas.post({ action: 'employeeGetCalendar', deviceUUID: 'new-device', year: 2026, month: 10 });
  assert.equal(own.ok, true, own.message);
  assert.equal(own.punchesByDate['2026-10-01'].length, 2);
  assert.ok(own.leavesByDate['2026-10-02']);
  const other = gas.post({ action: 'employeeGetCalendar', deviceUUID: 'old-device', year: 2026, month: 10 });
  assert.equal(other.ok, true, other.message);
  assert.equal(other.punchesByDate['2026-10-01'], undefined);
  assert.equal(other.leavesByDate['2026-10-02'], undefined);
  assert.equal(gas.post({ action: 'employeeCancelLeave', deviceUUID: 'old-device', requestId: 'l1' }).ok, false);
});

test('archiving preserves master data and prevents all device employee access', () => {
  const gas = fixture();
  const archived = gas.admin({ action: 'adminDeleteEmployee', employeeId: 'e1' });
  assert.equal(archived.ok, true, archived.message);
  assert.equal(gas.sheets.get('Employees').getLastRow(), 3);
  const result = gas.admin({ action: 'adminGetEmployees', status: 'archived' });
  assert.equal(result.employees[0].employeeId, 'e1');
  assert.equal(result.employees[0].status, 'archived');
  assert.equal(gas.post({ action: 'employeeResolveSession', deviceUUID: 'new-device' }).isRegistered, false);
  assert.equal(gas.post({ action: 'employeeGetLeaveRequests', deviceUUID: 'new-device' }).ok, false);
  assert.equal(gas.post({ action: 'employeeGetCorrections', deviceUUID: 'new-device' }).ok, false);
});

test('pending review reaches older requests and cursor pages are stable on timestamp ties', () => {
  const gas = fixture();
  const rows = gas.sheets.get('LeaveRequests');
  for (let index = 0; index < 105; index += 1) rows.appendRow(['new-' + index, 'Other', 'old-device', 'annual', '2026-10-03', '2026-10-03', 'Leave', 'approved', '2026-10-02T00:00:00Z', '', '', '', 'full', '', '', '', 'e2']);
  rows.appendRow(['pending-a', 'Renamed', 'new-device', 'personal', '2026-10-04', '2026-10-04', 'Leave', 'pending', '2026-09-01T00:00:00Z', '', '', '', 'am', '', '', '', 'e1']);
  rows.appendRow(['pending-b', 'Renamed', 'new-device', 'personal', '2026-10-05', '2026-10-05', 'Leave', 'pending', '2026-09-01T00:00:00Z', '', '', '', 'am', '', '', '', 'e1']);
  const first = gas.admin({ action: 'adminGetLeaveRequests', status: 'pending', limit: 1 });
  assert.equal(first.leaves.length, 1);
  assert.ok(first.nextCursor);
  const second = gas.admin({ action: 'adminGetLeaveRequests', status: 'pending', limit: 1, cursor: first.nextCursor });
  assert.equal(second.leaves.length, 1);
  assert.notEqual(first.leaves[0].requestId, second.leaves[0].requestId);
  const old = rows.getRange(2, 8); old.setValue('pending');
  const allPending = gas.admin({ action: 'adminGetLeaveRequests', status: 'pending' });
  assert.ok(allPending.leaves.some(leave => leave.requestId === 'l1'));
});

test('migration preview is read-only and confirmed mappings survive reruns', () => {
  const gas = fixture();
  gas.sheets.get('AttendanceLogs').getRange(2, 9).setValue('');
  const before = gas.writes;
  const preview = gas.admin({ action: 'adminPreviewMigration' });
  assert.equal(preview.ok, true, preview.message);
  assert.equal(gas.writes, before);
  assert.ok(preview.migration.unresolved.some(row => row.sheet === 'AttendanceLogs' && row.rowNumber === 2));
  const source = preview.migration.unresolved.find(row => row.sheet === 'AttendanceLogs' && row.rowNumber === 2);
  const mapping = { sheet: 'AttendanceLogs', rowNumber: 2, fingerprint: source.fingerprint, employeeId: 'e1', evidence: 'Verified original payroll export' };
  const applied = gas.admin({ action: 'adminApplyMigration', mappings: [mapping] });
  assert.equal(applied.ok, true, applied.message);
  assert.equal(gas.sheets.get('AttendanceLogs').getRange(2, 9).getValue(), 'e1');
  const again = gas.admin({ action: 'adminApplyMigration', mappings: [] });
  assert.equal(again.ok, true, again.message);
  assert.equal(gas.sheets.get('AttendanceLogs').getRange(2, 9).getValue(), 'e1');
});

test('migration rejects contradictory duplicate mappings without changing ownership', () => {
  const gas = fixture();
  gas.sheets.get('AttendanceLogs').getRange(2, 9).setValue('');
  const source = gas.admin({ action: 'adminPreviewMigration' }).migration.unresolved.find(row => row.sheet === 'AttendanceLogs');
  const common = { ...source, evidence: 'Verified payroll export' };
  const result = gas.admin({ action: 'adminApplyMigration', mappings: [{ ...common, employeeId: 'e1' }, { ...common, employeeId: 'e2' }] });
  assert.equal(result.ok, false);
  assert.match(result.message, /duplicate|same row/i);
  assert.equal(gas.sheets.get('AttendanceLogs').getRange(2, 9).getValue(), '');
});

test('migration resumes safely at each interrupted write and retains one mapping audit', () => {
  for (let failure = 1; failure <= 14; failure += 1) {
    const gas = fixture();
    gas.sheets.get('LeaveRequests').getRange(2, 13).setValue('');
    gas.sheets.get('LeaveRequests').getRange(2, 17).setValue('');
    const preview = gas.admin({ action: 'adminPreviewMigration' });
    const source = preview.migration.unresolved.find(row => row.sheet === 'LeaveRequests');
    const mapping = { ...source, employeeId: 'e1', dayPart: 'am', evidence: 'Verified original request' };
    gas.failAfter(failure);
    gas.admin({ action: 'adminApplyMigration', mappings: [mapping] });
    gas.resume();
    const retry = gas.admin({ action: 'adminApplyMigration', mappings: [mapping] });
    assert.equal(retry.ok, true, `write ${failure}: ${retry.message}`);
    assert.equal(gas.sheets.get('LeaveRequests').getRange(2, 17).getValue(), 'e1');
    assert.equal(gas.sheets.get('LeaveRequests').getRange(2, 13).getValue(), 'am');
    assert.equal(gas.sheets.get('MigrationMappings').getLastRow(), 2);
    const salaryCount = gas.sheets.get('SalaryHistory').getLastRow();
    assert.equal(gas.admin({ action: 'adminApplyMigration', mappings: [] }).ok, true);
    assert.equal(gas.sheets.get('SalaryHistory').getLastRow(), salaryCount);
  }
});

test('archive retry finishes binding revocation after an interrupted write', () => {
  const gas = fixture();
  gas.failAfter(3);
  assert.equal(gas.admin({ action: 'adminDeleteEmployee', employeeId: 'e1' }).ok, false);
  gas.resume();
  assert.equal(gas.admin({ action: 'adminDeleteEmployee', employeeId: 'e1' }).ok, true);
  assert.ok(gas.sheets.get('DeviceBindings').getRange(2, 5).getValue());
});

test('admin and employee calendars accept native spreadsheet dates', () => {
  const gas = fixture();
  const leaves = gas.sheets.get('LeaveRequests');
  leaves.getRange(2, 5, 1, 2).setValues([[new Date('2026-10-02T00:00:00+08:00'), new Date('2026-10-02T00:00:00+08:00')]]);
  const admin = gas.admin({ action: 'adminGetCalendar', year: 2026, month: 10 });
  assert.equal(admin.ok, true, admin.message);
  assert.ok(admin.leavesByDate['2026-10-02']);
  const own = gas.post({ action: 'employeeGetCalendar', deviceUUID: 'new-device', year: 2026, month: 10 });
  assert.ok(own.leavesByDate['2026-10-02']);
});

test('archived employees remain available to monthly reports and CSV', () => {
  const gas = fixture();
  assert.equal(gas.admin({ action: 'adminApplyMigration' }).ok, true);
  const request = { employeeId: 'e1', year: 2026, month: 10 };
  const before = gas.admin({ action: 'adminGetMonthlyReport', ...request });
  assert.equal(before.ok, true, before.message);
  assert.equal(gas.admin({ action: 'adminDeleteEmployee', employeeId: 'e1' }).ok, true);
  const after = gas.admin({ action: 'adminGetMonthlyReport', ...request });
  assert.deepEqual(after.report.summary, before.report.summary);
  assert.equal(gas.admin({ action: 'adminExportMonthlyCsv', ...request }).ok, true);
});

test('sensitive history and evidence APIs require a valid unexpired administrator session', () => {
  const gas = fixture();
  const actions = ['adminGetEmploymentTerms', 'adminGetMonthlyReport', 'adminGetLeaveEvidence', 'adminPreviewMigration', 'adminApplyMigration', 'adminGetCorrections'];
  for (const action of actions) assert.equal(gas.post({ action, employeeId: 'e1', requestId: 'l1', year: 2026, month: 10 }).ok, false, action);
  gas.properties.TAPIN_ADMIN_SESSIONS_JSON = '{}';
  for (const action of actions) assert.equal(gas.admin({ action, employeeId: 'e1', requestId: 'l1', year: 2026, month: 10 }).ok, false, action);
});

test('an archived device cannot write attendance and new punches record immutable ownership', () => {
  const gas = fixture();
  const request = { action: 'punch', punchType: 'in', deviceUUID: 'new-device', ipAddress: '203.0.113.10', latitude: 3, longitude: 101, accuracyMeters: 20, originProtocol: 'https', originHost: 'example.test', requestTimestamp: Date.now(), requestId: 'punch-before-archive' };
  const result = gas.post(request);
  assert.equal(result.ok, true, result.message);
  assert.equal(gas.sheets.get('AttendanceLogs').data.at(-1)[8], 'e1');
  gas.admin({ action: 'adminDeleteEmployee', employeeId: 'e1' });
  const count = gas.sheets.get('AttendanceLogs').getLastRow();
  assert.equal(gas.post({ ...request, requestId: 'punch-after-archive' }).ok, false);
  assert.equal(gas.sheets.get('AttendanceLogs').getLastRow(), count);
});

test('legacy ownership gaps block affected payroll until mapped instead of silently undercounting', () => {
  const gas = fixture();
  gas.admin({ action: 'adminApplyMigration' });
  gas.sheets.get('AttendanceLogs').getRange(2, 9).setValue('');
  const response = gas.admin({ action: 'adminGetMonthlyReport', employeeId: 'e1', year: 2026, month: 10 });
  assert.equal(response.ok, false);
  assert.match(response.message, /ownership is incomplete/i);
});

test('leave cursor remains usable when a preceding pending request leaves the queue', () => {
  const gas = fixture();
  const leaves = gas.sheets.get('LeaveRequests');
  leaves.getRange(2, 8).setValue('pending');
  for (let index = 0; index < 1000; index += 1) leaves.appendRow(['request-' + String(index).padStart(4, '0'), 'Renamed', 'new-device', 'personal', '2026-10-03', '2026-10-03', 'Leave', 'pending', '2026-09-02T00:00:00Z', '', '', '', 'am', '', '', '', 'e1']);
  const first = gas.admin({ action: 'adminGetLeaveRequests', status: 'pending', limit: 50 });
  const reviewedId = first.leaves[0].requestId;
  const row = leaves.data.findIndex(values => values[0] === reviewedId) + 1;
  leaves.getRange(row, 8).setValue('rejected');
  const ids = first.leaves.map(leave => leave.requestId);
  let cursor = first.nextCursor;
  while (cursor) {
    const next = gas.admin({ action: 'adminGetLeaveRequests', status: 'pending', limit: 50, cursor });
    assert.equal(next.ok, true, next.message);
    ids.push(...next.leaves.map(leave => leave.requestId));
    cursor = next.nextCursor;
  }
  assert.equal(ids.length, 1001);
  assert.equal(new Set(ids).size, 1001);
  assert.ok(ids.includes('l1'));
});
