const test = require('node:test');
const assert = require('node:assert/strict');
const { createGas } = require('./helpers/gas');

function fixture() {
  const gas = createGas();
  const saved = gas.admin({ action: 'adminSaveEmployee', name: 'Worker', deviceUUID: 'device-a', scheduleGroupId: 'mon-fri', monthlySalary: 5000, reason: 'Initial terms' });
  assert.equal(saved.ok, true, saved.message);
  return gas;
}
const setup = gas => gas.post({ action: 'employeeSetupPassword', deviceUUID: 'device-a', password: ' password ', confirmPassword: ' password ' });
const login = (gas, password = ' password ') => gas.post({ action: 'employeeLogin', deviceUUID: 'device-a', password });

test('employee must set a password then sign in separately, preserving password whitespace', () => {
  const gas = fixture();
  let state = gas.post({ action: 'employeeResolveSession', deviceUUID: 'device-a' });
  assert.equal(state.requiresPasswordSetup, true);
  assert.equal(state.isAuthenticated, false);
  assert.equal(setup(gas).ok, true);
  state = gas.post({ action: 'employeeResolveSession', deviceUUID: 'device-a' });
  assert.equal(state.requiresPasswordSetup, false);
  assert.equal(state.isAuthenticated, false);
  assert.equal(setup(gas).ok, false);
  assert.equal(login(gas, 'password').ok, false);
  const session = login(gas);
  assert.equal(session.ok, true, session.message);
  assert.ok(session.token);
  assert.equal(gas.post({ action: 'employeeResolveSession', deviceUUID: 'device-a', employeeToken: session.token }).isAuthenticated, true);
  assert.equal(gas.post({ action: 'employeeLogout', deviceUUID: 'device-a', employeeToken: session.token }).ok, true);
  assert.equal(gas.post({ action: 'employeeGetLeaveRequests', deviceUUID: 'device-a', employeeToken: session.token }).ok, false);
  assert.ok(!JSON.stringify(gas.properties).includes(' password '));
});

test('all employee operations including punch reject device-only access', () => {
  const gas = fixture();
  for (const action of ['punch', 'submitLeave', 'employeeGetCalendar', 'employeeGetLeaveRequests', 'employeeCancelLeave', 'employeeSubmitCorrection', 'employeeGetCorrections']) {
    const result = gas.post({ action, deviceUUID: 'device-a' });
    assert.equal(result.ok, false, action);
    assert.match(result.message, /session|sign in/i, action);
  }
});

test('password validation, login throttling, expiry and current device ownership are enforced', () => {
  const gas = fixture();
  for (const password of ['short', 'x'.repeat(129)]) assert.equal(gas.post({ action: 'employeeSetupPassword', deviceUUID: 'device-a', password, confirmPassword: password }).ok, false);
  assert.equal(gas.post({ action: 'employeeSetupPassword', deviceUUID: 'device-a', password: 'long-password', confirmPassword: 'different' }).ok, false);
  assert.equal(setup(gas).ok, true);
  const session = login(gas);
  const sessionKey = Object.keys(gas.properties).find(key => key.startsWith('TAPIN_EMPLOYEE_SESSION_'));
  const storedSession = JSON.parse(gas.properties[sessionKey]);
  storedSession.expiresAt = 1;
  gas.properties[sessionKey] = JSON.stringify(storedSession);
  assert.equal(gas.post({ action: 'employeeGetLeaveRequests', deviceUUID: 'device-a', employeeToken: session.token }).ok, false);
  const active = login(gas);
  gas.sheets.get('Employees').getRange(2, 4).setValue('device-b');
  assert.equal(gas.post({ action: 'employeeGetLeaveRequests', deviceUUID: 'device-a', employeeToken: active.token }).ok, false);
  gas.sheets.get('Employees').getRange(2, 4).setValue('device-a');
  for (let i = 0; i < 5; i++) assert.equal(login(gas, 'wrong-password').ok, false);
  assert.match(login(gas).message, /Too many failed attempts/);
});

test('sixty employee sessions stay below the GAS per-property storage limit', () => {
  const rows = Array.from({ length: 60 }, (_, index) => ['Worker ' + index, '', '', 'device-' + index, 'employee-' + index, 'mon-fri', 5000, 'active']);
  const gas = createGas({
    Employees: [['Employee Name', 'Phone', 'Email', 'Device UUID', 'Employee ID', 'Schedule Group ID', 'Monthly Salary MYR', 'Status'], ...rows],
    DeviceBindings: [['Employee Name', 'Device UUID', 'Bound At', 'Employee ID', 'Ended At'], ...rows.map(row => [row[0], row[3], '2026-01-01T00:00:00Z', row[4], ''])],
  });
  const cfg = gas.context.getRuntimeConfig_();
  const sessions = rows.map(row => {
    const employee = gas.context.requireEmployeeByDevice_(cfg, row[3]);
    return { deviceUUID: row[3], employeeToken: gas.context.createEmployeeSession_(employee, row[3]).token };
  });
  const entries = Object.entries(gas.properties).filter(([key]) => key.startsWith('TAPIN_EMPLOYEE_SESSION_'));
  assert.equal(entries.length, 60);
  for (const [, value] of entries) assert.ok(Buffer.byteLength(value) < 9 * 1024);
  for (const session of sessions) assert.equal(gas.post({ action: 'employeeGetLeaveRequests', ...session }).ok, true);
});

test('employee login guards stay separate across a large workforce and from admin guards', () => {
  const gas = fixture();
  const before = gas.properties.TAPIN_ADMIN_LOGIN_GUARD_JSON;
  for (let index = 0; index < 120; index++) {
    for (let attempt = 0; attempt < 5; attempt++) gas.context.recordEmployeeLoginFailure_('employee-' + index);
  }
  const entries = Object.entries(gas.properties).filter(([key]) => key.startsWith('TAPIN_EMPLOYEE_LOGIN_GUARD_'));
  assert.equal(entries.length, 120);
  for (const [, value] of entries) assert.ok(Buffer.byteLength(value) < 9 * 1024);
  assert.throws(() => gas.context.checkEmployeeLoginAllowed_('employee-0'), /Too many failed attempts/);
  assert.doesNotThrow(() => gas.context.checkEmployeeLoginAllowed_('other-employee'));
  assert.equal(gas.properties.TAPIN_ADMIN_LOGIN_GUARD_JSON, before);
});
