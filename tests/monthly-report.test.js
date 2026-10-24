const test = require('node:test');
const assert = require('node:assert/strict');
const { createGas } = require('./helpers/gas');

test('monthly report combines paired punches with approved half-day leave', () => {
  const gas = createGas({
    Employees: [['Employee Name', 'Phone', 'Email', 'Device UUID', 'Employee ID', 'Schedule Group ID', 'Monthly Salary MYR'], ['Alex', '', '', 'd1', 'e1', 'mon-fri', 5200]],
    DeviceBindings: [['Employee Name', 'Device UUID', 'Bound At', 'Employee ID', 'Ended At'], ['Alex', 'd1', '2026-01-01', 'e1', '']],
    AttendanceLogs: [['Timestamp', 'Employee Name', 'Device UUID', 'IP', 'Location', 'Lat', 'Lng', 'Punch Type', 'Employee ID'], ['2026-10-01T01:00:00Z', 'Alex', 'd1', '', 'Office', 3.1, 101.6, 'in', 'e1'], ['2026-10-01T08:00:00Z', 'Alex', 'd1', '', 'Office', 3.1, 101.6, 'out', 'e1']],
    LeaveRequests: [['RequestID', 'EmployeeName', 'DeviceUUID', 'LeaveType', 'StartDate', 'EndDate', 'Reason', 'Status', 'SubmittedAt', 'ReviewedAt', 'ReviewedBy', 'ReviewNote', 'DayPart', 'EvidenceURL', 'CancelledAt', 'CancelledBy', 'EmployeeID'], ['leave1', 'Alex', 'd1', 'annual', '2026-10-01', '2026-10-01', 'Annual leave', 'approved', '2026-09-01', '', '', '', 'pm', '', '', '', 'e1']],
  });
  assert.equal(gas.admin({ action: 'adminApplyMigration' }).ok, true);
  const monthly = () => gas.admin({ action: 'adminGetMonthlyReport', employeeId: 'e1', year: 2026, month: 10 });
  const response = monthly();
  assert.equal(response.ok, true, response.message);
  const day = response.report.days.find((item) => item.date === '2026-10-01');
  assert.equal(day.workedHours, 6);
  assert.equal(day.leaveHours, 4);
  assert.equal(day.overtimeHours, 2);
  assert.equal(day.absenceDays, 0);
  assert.equal(day.overtimePay, 75);

  assert.equal(gas.post({ action: 'employeeCancelLeave', deviceUUID: 'd1', requestId: 'leave1' }).ok, true);
  const afterCancellation = monthly().report.days.find((item) => item.date === '2026-10-01');
  assert.equal(afterCancellation.leaveHours, 0);
  assert.equal(afterCancellation.overtimeHours, 0);
  assert.equal(afterCancellation.absenceDays, 0.5);
});
