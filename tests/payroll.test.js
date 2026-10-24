const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const gasDirectory = path.join(__dirname, '../gas');
const source = fs.readdirSync(gasDirectory).filter(file => file.endsWith('.gs')).sort().map(file => fs.readFileSync(path.join(gasDirectory, file), 'utf8')).join('\n');
const context = vm.createContext({});
vm.runInContext(source, context, { filename: 'Code.gs' });

function daily(overrides = {}) {
  return vm.runInContext('calculateDailyPayroll_', context)({
    weekday: 1,
    workedHours: 0,
    leaveHours: 0,
    leaveType: '',
    monthlySalary: 5200,
    scheduledHours: 8,
    ...overrides,
  });
}

test('weekday absence uses the four and seven-and-a-half hour thresholds', () => {
  assert.equal(daily({ workedHours: 3.99 }).absenceDays, 1);
  assert.equal(daily({ workedHours: 4 }).absenceDays, 0.5);
  assert.equal(daily({ workedHours: 7.49 }).absenceDays, 0.5);
  assert.equal(daily({ workedHours: 7.5 }).absenceDays, 0);
  assert.equal(daily({ workedHours: 7.5 }).creditedHours, 8);
});

test('overtime uses actual work plus approved leave, not full-day credit', () => {
  assert.equal(daily({ workedHours: 6, leaveHours: 4, leaveType: 'annual' }).overtimeHours, 2);
  assert.equal(daily({ workedHours: 7.5, leaveHours: 4, leaveType: 'annual' }).overtimeHours, 3.5);
  assert.equal(daily({ workedHours: 7.5 }).overtimeHours, 0);
});

test('Saturday is complete after four hours but overtime starts above eight', () => {
  assert.equal(daily({ weekday: 6, scheduledHours: 4, workedHours: 4 }).absenceDays, 0);
  assert.equal(daily({ weekday: 6, scheduledHours: 4, workedHours: 8 }).overtimeHours, 0);
  assert.equal(daily({ weekday: 6, scheduledHours: 4, workedHours: 9 }).overtimeHours, 1);
});

test('Sunday overtime above eight hours pays double the base hourly rate', () => {
  const result = daily({ weekday: 7, scheduledHours: 0, workedHours: 9 });
  assert.equal(result.overtimeHours, 1);
  assert.equal(result.overtimePay, 50);
});

test('unpaid personal leave deducts pay while annual and sick leave do not', () => {
  const personal = daily({ workedHours: 4, leaveHours: 4, leaveType: 'personal' });
  const annual = daily({ workedHours: 4, leaveHours: 4, leaveType: 'annual' });
  const sick = daily({ workedHours: 4, leaveHours: 4, leaveType: 'sick' });
  assert.equal(personal.absenceDeduction, 100);
  assert.equal(annual.absenceDeduction, 0);
  assert.equal(sick.absenceDeduction, 0);
});

test('paired punches deduct only the 13:00–14:00 lunch overlap on weekdays', () => {
  const pairedWorkHours = vm.runInContext('pairedWorkHours_', context);
  const pair = (start, end) => [
    { time: start, punchType: 'in' },
    { time: end, punchType: 'out' },
  ];
  assert.equal(pairedWorkHours(pair('09:00', '18:00'), 1), 8);
  assert.equal(pairedWorkHours(pair('09:00', '13:00'), 1), 4);
  assert.equal(pairedWorkHours(pair('09:00', '13:00'), 6), 4);
  assert.equal(pairedWorkHours(pair('13:00', '18:00'), 1), 4);
});

test('punch validation rejects missing coordinates and GPS accuracy', () => {
  const validate = vm.runInContext('validatePunchRequest_', context);
  const request = {
    deviceUUID: 'device-1', ipAddress: '203.0.113.10', latitude: 3.14,
    longitude: 101.69, accuracyMeters: 25, requestTimestamp: Date.now(),
    requestId: 'request-1', originProtocol: 'https', originHost: 'example.com',
  };
  const config = { maxGpsAccuracyMeters: 120 };
  assert.throws(() => validate({ ...request, latitude: '' }, config), /Location coordinates are required/);
  assert.throws(() => validate({ ...request, longitude: '' }, config), /Location coordinates are required/);
  assert.throws(() => validate({ ...request, accuracyMeters: '' }, config), /Missing GPS accuracy/);
  assert.doesNotThrow(() => validate({ ...request, latitude: 0, longitude: 0 }, config));
});
