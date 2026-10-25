const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { buildDemo } = require('../scripts/build-demo.cjs');

let bundle;
test.before(async () => { bundle = await buildDemo({ write: false }); });
function storage() {
  const data = new Map();
  return { data, blocked: false, getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (this.blocked) throw new Error('QuotaExceededError'); data.set(key, String(value)); },
    removeItem(key) { if (this.blocked) throw new Error('Storage disabled'); data.delete(key); } };
}
function browser(localStorage = storage()) {
  const context = vm.createContext({ localStorage, crypto: webcrypto, console, TextEncoder, TextDecoder,
    btoa: value => Buffer.from(value, 'binary').toString('base64'), atob: value => Buffer.from(value, 'base64').toString('binary'),
    fetch() { throw new Error('Demo attempted network access'); }, XMLHttpRequest() { throw new Error('Demo attempted network access'); } });
  context.window = context;
  vm.runInContext(bundle, context);
  const api = context.TAPIN_DEMO;
  const call = async payload => { const result = await api.request(payload); assert.equal(result.ok, true, result.message); return result; };
  return { api, call, localStorage };
}
async function login(b) { return (await b.call({ action: 'adminLogin', username: 'admin', password: 'demo-password' })).token; }
async function fixture(b) {
  await b.call({ action: 'publicConfig' });
  const deviceUUID = b.localStorage.getItem('tapin_device_uuid');
  const token = await login(b);
  const employees = (await b.call({ action: 'adminGetEmployees', token })).employees;
  const employee = employees.find(e => e.deviceUUID === deviceUUID);
  const date = (await b.call({ action: 'serverTime' })).serverTime;
  const monthDate = new Date(new Date(date).getTime() + 8 * 3600000);
  return { token, employee, deviceUUID, year: monthDate.getUTCFullYear(), month: monthDate.getUTCMonth() + 1 };
}

test('browser persists admin sessions, employees and device identity across refresh and tabs without network', async () => {
  const b = browser(); const f = await fixture(b);
  assert.equal((await b.call({ action: 'employeeResolveSession', deviceUUID: f.deviceUUID })).employeeName, f.employee.name);
  const other = browser(b.localStorage);
  await other.call({ action: 'adminSaveEmployee', token: f.token, employeeId: f.employee.employeeId, name: 'Updated Demo Employee', phone: '0123456789' });
  const employees = (await b.call({ action: 'adminGetEmployees', token: f.token })).employees;
  assert.equal(employees.find(e => e.employeeId === f.employee.employeeId).name, 'Updated Demo Employee');
  await other.call({ action: 'adminLogout', token: f.token });
  assert.equal((await b.api.request({ action: 'adminGetEmployees', token: f.token })).ok, false);
});

test('employee punch pairs advance the demo clock without ambiguous minute events', async () => {
  const b = browser(); const f = await fixture(b);
  const punch = async punchType => {
    const time = await b.call({ action: 'serverTime' });
    return b.call({ action: 'punch', deviceUUID: f.deviceUUID, punchType, ipAddress: '203.0.113.10', latitude: 3.139, longitude: 101.6869,
      accuracyMeters: 5, originProtocol: 'https:', originHost: 'demo.example', requestTimestamp: time.serverTimestampMs, requestId: crypto.randomUUID() });
  };
  const inside = await punch('in'); const outside = await punch('out');
  assert.notEqual(inside.serverTime.slice(0, 16), outside.serverTime.slice(0, 16));
  const calendar = await b.call({ action: 'employeeGetCalendar', deviceUUID: f.deviceUUID, year: f.year, month: f.month });
  const punchDate = new Date(new Date(inside.serverTime).getTime() + 8 * 3600000).toISOString().slice(0, 10);
  assert.deepEqual(Array.from(calendar.punchesByDate[punchDate], punch => punch.punchType), ['in', 'out']);
  assert.equal(calendar.warnings.some(warning => warning.startsWith(punchDate)), false);
  const duplicate = await b.api.request({ action: 'punch', deviceUUID: f.deviceUUID, punchType: 'out', ipAddress: '203.0.113.10', latitude: 3, longitude: 101, accuracyMeters: 5,
    originProtocol: 'https:', originHost: 'demo.example', requestTimestamp: (await b.call({ action: 'serverTime' })).serverTimestampMs, requestId: crypto.randomUUID() });
  assert.equal(duplicate.ok, false);
});

test('proof, leave review, employee cancellation and correction review/revoke/replacement persist', async () => {
  const b = browser(); const f = await fixture(b);
  const date = `${f.year}-${String(f.month).padStart(2, '0')}-28`;
  const proof = 'data:application/pdf;base64,JVBERi0xLjQK';
  const time = await b.call({ action: 'serverTime' });
  const requestId = crypto.randomUUID();
  await b.call({ action: 'submitLeave', deviceUUID: f.deviceUUID, requestId, requestTimestamp: time.serverTimestampMs,
    leaveType: 'sick', dayPart: 'full', startDate: date, endDate: date, reason: 'Medical appointment', evidenceDataUrl: proof });
  const refreshed = browser(b.localStorage);
  assert.equal((await refreshed.call({ action: 'adminGetLeaveEvidence', token: f.token, requestId })).dataUrl, proof);
  await b.call({ action: 'adminUpdateLeaveStatus', token: f.token, requestId, status: 'approved', reviewNote: 'Verified' });
  assert.equal((await b.call({ action: 'employeeGetLeaveRequests', deviceUUID: f.deviceUUID })).leaves.find(l => l.requestId === requestId).status, 'approved');
  await b.call({ action: 'employeeCancelLeave', deviceUUID: f.deviceUUID, requestId });
  const correction = await b.call({ action: 'employeeSubmitCorrection', deviceUUID: f.deviceUUID, date, time: '09:00', punchType: 'in', reason: 'Forgot device', submissionId: crypto.randomUUID() });
  await b.call({ action: 'adminUpdateCorrection', token: f.token, requestId: correction.requestId, status: 'approved' });
  await b.call({ action: 'adminRevokeCorrection', token: f.token, requestId: correction.requestId, reason: 'Corrected time', submissionId: crypto.randomUUID() });
  const replacement = await b.call({ action: 'adminAddCorrection', token: f.token, employeeId: f.employee.employeeId, date, time: '09:15', punchType: 'in', reason: 'Verified arrival', replacesRequestId: correction.requestId, submissionId: crypto.randomUUID() });
  const history = (await refreshed.call({ action: 'employeeGetCorrections', deviceUUID: f.deviceUUID })).corrections;
  assert.equal(history.find(c => c.requestId === correction.requestId).status, 'revoked');
  assert.equal(history.find(c => c.requestId === replacement.requestId).replacesRequestId, correction.requestId);
});

test('admin configuration, schedules, historical terms, payroll CSV and archival use real rules', async () => {
  const b = browser(); const f = await fixture(b);
  await b.call({ action: 'adminUpdateConfig', token: f.token, officeStaticIp: '198.51.100.9', maxGpsAccuracyMeters: 90 });
  assert.equal((await b.call({ action: 'publicConfig' })).config.officeStaticIp, '198.51.100.9');
  const group = (await b.call({ action: 'adminSaveScheduleGroup', token: f.token, name: 'Demo Flex', days: [{ weekday: 1, start: '09:00', end: '18:00' }], reason: 'Demo schedule' })).group;
  await b.call({ action: 'adminDeleteScheduleGroup', token: f.token, groupId: group.groupId });
  const effectiveMonth = `${f.year}-${String(f.month).padStart(2, '0')}`;
  await b.call({ action: 'adminSaveEmploymentTerms', token: f.token, employeeId: f.employee.employeeId, monthlySalary: 6200, salaryEffectiveMonth: effectiveMonth, reason: 'Verified salary', allowBackdate: true });
  await b.call({ action: 'adminSaveMonthlyAdjustment', token: f.token, employeeId: f.employee.employeeId, year: f.year, month: f.month, payAmount: 125, reason: 'Demo bonus' });
  const report = (await b.call({ action: 'adminGetMonthlyReport', token: f.token, employeeId: f.employee.employeeId, year: f.year, month: f.month })).report;
  assert.equal(report.summary.baseSalary, 6200);
  assert.ok(report.summary.payAdjustment >= 125);
  assert.match((await b.call({ action: 'adminExportMonthlyCsv', token: f.token, employeeId: f.employee.employeeId, year: f.year, month: f.month })).csv, /SALARY VERSION/);
  const temp = (await b.call({ action: 'adminSaveEmployee', token: f.token, name: 'Temporary Employee', monthlySalary: 1000, reason: 'Demo hire' })).employee;
  await b.call({ action: 'adminDeleteEmployee', token: f.token, employeeId: temp.employeeId });
  assert.equal((await b.call({ action: 'adminGetEmployees', token: f.token, status: 'archived' })).employees.find(e => e.employeeId === temp.employeeId).status, 'archived');
  await b.call({ action: 'adminPreviewMigration', token: f.token });
  await b.call({ action: 'adminApplyMigration', token: f.token });
});

test('quota failures roll back all mutations and oversized proofs leave no records', async () => {
  const b = browser(); const f = await fixture(b);
  const before = b.localStorage.getItem('tapin_demo_state_v1');
  b.localStorage.blocked = true;
  const failed = await b.api.request({ action: 'adminSaveEmployee', token: f.token, employeeId: f.employee.employeeId, name: 'Must Not Persist' });
  assert.equal(failed.ok, false); assert.match(failed.message, /storage|space|quota/i);
  assert.equal(b.localStorage.getItem('tapin_demo_state_v1'), before);
  const proofFailure = await b.api.request({ action: 'submitLeave', deviceUUID: f.deviceUUID, requestId: crypto.randomUUID(),
    requestTimestamp: (await b.call({ action: 'serverTime' })).serverTimestampMs, leaveType: 'sick',
    startDate: `${f.year}-01-01`, endDate: `${f.year}-01-01`, reason: 'Atomic proof write', evidenceDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK' });
  assert.equal(proofFailure.ok, false); assert.match(proofFailure.message, /storage/i);
  assert.equal(b.localStorage.getItem('tapin_demo_state_v1'), before);
  b.localStorage.blocked = false;
  assert.equal((await b.call({ action: 'adminGetEmployees', token: f.token })).employees.find(e => e.employeeId === f.employee.employeeId).name, f.employee.name);
  const after = b.localStorage.getItem('tapin_demo_state_v1');
  const huge = await b.api.request({ action: 'submitLeave', deviceUUID: f.deviceUUID, requestId: crypto.randomUUID(), requestTimestamp: (await b.call({ action: 'serverTime' })).serverTimestampMs,
    leaveType: 'sick', startDate: `${f.year}-01-01`, endDate: `${f.year}-01-01`, reason: 'Too large', evidenceDataUrl: `data:application/pdf;base64,${Buffer.alloc(512 * 1024 + 1).toString('base64')}` });
  assert.equal(huge.ok, false); assert.match(huge.message, /512 KiB/);
  assert.equal(b.localStorage.getItem('tapin_demo_state_v1'), after);
});

test('damaged persisted state reports an error without wiping; explicit reset reseeds only demo data', async () => {
  const b = browser(); const f = await fixture(b);
  b.localStorage.setItem('unrelated', 'keep'); b.localStorage.setItem('tapin_demo_state_v1', '{broken');
  const bad = await b.api.request({ action: 'publicConfig' });
  assert.equal(bad.ok, false); assert.match(bad.message, /damaged|corrupt/i);
  assert.equal(b.localStorage.getItem('tapin_demo_state_v1'), '{broken');
  await b.api.reset();
  assert.equal(b.localStorage.getItem('tapin_device_uuid'), f.deviceUUID);
  assert.equal(b.localStorage.getItem('unrelated'), 'keep');
  const next = await fixture(b); assert.notEqual(next.employee.employeeId, f.employee.employeeId);
  assert.equal((await b.api.request({ action: 'adminGetEmployees', token: f.token })).ok, false);
});
