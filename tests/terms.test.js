const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const sheets = {};
  const employee = { employeeId: 'e1', monthlySalary: 5200, scheduleGroupId: 'g1' };
  let counter = 0;
  const group = { groupId: 'g1', name: 'Workweek', days: [{ weekday: 6, start: '09:00', end: '13:00' }] };
  const groups = [group];
  function sheet(name, headers) {
    if (!sheets[name]) sheets[name] = {
      rows: [headers], getLastRow() { return this.rows.length; },
      appendRow(row) { this.rows.push(row); },
      getRange(start, column, count, width) { return { getValues: () => sheets[name].rows.slice(start - 1, start - 1 + count).map(row => row.slice(column - 1, column - 1 + width)) }; },
    };
    return sheets[name];
  }
  const context = vm.createContext({
    Utilities: { getUuid: () => 'v' + ++counter, formatDate: () => '2026-10-23' },
    normalizeText_: value => String(value == null ? '' : value).trim(),
    getSheetIfExists_: (_cfg, name) => sheets[name] || null,
    getOrCreateSheet_: (_cfg, name, headers) => sheet(name, headers),
    getScheduleGroups_: () => groups, readEmployees_: () => [employee], getEmployeeSheet_: () => ({}),
  });
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../gas/Terms.gs'), 'utf8'), context);
  return { context, employee, group, groups, sheets };
}

test('migration is repeatable and baseline reports disclose unknown historical terms', () => {
  const { context: c, employee, sheets } = setup();
  c.seedEmploymentTerms_({}, [employee], 'admin');
  const counts = Object.values(sheets).map(s => s.rows.length);
  c.seedEmploymentTerms_({}, [employee], 'admin');
  assert.deepEqual(Object.values(sheets).map(s => s.rows.length), counts);
  const report = c.reportTerms_({}, employee, 2025, 9);
  assert.equal(report.monthlySalary, 5200);
  assert.ok(report.warnings.some(message => /unverified/i.test(message)));
  assert.equal(report.scheduleForDate('2025-09-06').days.length, 1);
});

test('future salary and immutable schedule versions preserve previous months', () => {
  const { context: c, employee, group } = setup();
  c.seedEmploymentTerms_({}, [employee], 'admin');
  const saved = { ...employee, monthlySalary: 5600 };
  const req = { salaryEffectiveMonth: '2026-11-01', reason: 'Annual raise' };
  c.validateEmployeeTerms_(req, employee, saved, {});
  c.saveEmployeeTerms_(req, employee, saved, {}, 'admin');
  c.saveScheduleTerms_({ effectiveDate: '2026-11-01', reason: 'New workweek' }, { ...group, days: [] }, {}, 'admin');
  assert.equal(c.reportTerms_({}, saved, 2026, 10).monthlySalary, 5200);
  assert.equal(c.reportTerms_({}, saved, 2026, 11).monthlySalary, 5600);
  assert.equal(c.reportTerms_({}, saved, 2026, 10).scheduleForDate('2026-10-31').days.length, 1);
  assert.equal(c.reportTerms_({}, saved, 2026, 11).scheduleForDate('2026-11-07').days.length, 0);
});

test('term validation rejects midmonth salary, invalid calendar dates and unaudited backdates without writing', () => {
  const { context: c, employee, sheets } = setup();
  const saved = { ...employee, monthlySalary: 5600 };
  assert.throws(() => c.validateEmployeeTerms_({ salaryEffectiveMonth: '2026-11-15', reason: 'Raise' }, employee, saved, {}), /first day/);
  assert.throws(() => c.validateEmployeeTerms_({ salaryEffectiveMonth: '2026-02-01', reason: 'Correction' }, employee, saved, {}), /backdat/i);
  assert.throws(() => c.validateEmployeeTerms_({ salaryEffectiveMonth: '2026-10-01', reason: 'Correction', allowBackdate: false }, employee, saved, {}), /backdat/i);
  assert.throws(() => c.validateScheduleTerms_({ effectiveDate: '2026-02-30', reason: 'Correction', allowBackdate: true }, {}, {}), /date/i);
  assert.equal(Object.keys(sheets).length, 0);
});

test('audited historical salary correction retains baseline and deterministic last correction wins', () => {
  const { context: c, employee } = setup();
  c.seedEmploymentTerms_({}, [employee], 'admin');
  const request = { salaryEffectiveMonth: '2026-01-01', reason: 'Verified signed agreement', allowBackdate: true };
  c.saveEmployeeTerms_(request, employee, { ...employee, monthlySalary: 5000 }, {}, 'auditor');
  c.saveEmployeeTerms_(request, { ...employee, monthlySalary: 5000 }, { ...employee, monthlySalary: 5100 }, {}, 'auditor');
  const report = c.reportTerms_({}, employee, 2026, 1);
  assert.equal(report.monthlySalary, 5100);
  const history = c.employeeHistory_({}, employee);
  assert.equal(history.salaries.length, 3);
  assert.equal(history.salaries[2].actor, 'auditor');
  assert.ok(history.salaries[2].reason);
});

test('future employee assignments pick up previously planned schedule content changes', () => {
  const { context: c, employee, groups } = setup();
  const second = { groupId: 'g2', name: 'Second group', days: [{ weekday: 1, start: '09:00', end: '18:00' }] };
  groups.push(second);
  c.seedEmploymentTerms_({}, [employee], 'admin');
  c.saveScheduleTerms_({ effectiveDate: '2026-11-15', reason: 'Change second group' }, { ...second, days: [] }, {}, 'admin');
  c.saveEmployeeTerms_({ scheduleEffectiveDate: '2026-11-01', reason: 'Transfer' }, employee, { ...employee, scheduleGroupId: 'g2' }, {}, 'admin');
  const terms = c.reportTerms_({}, employee, 2026, 11);
  assert.equal(terms.scheduleForDate('2026-11-02').days.length, 1);
  assert.equal(terms.scheduleForDate('2026-11-16').days.length, 0);
});

test('schedule edits update an already planned assignment without rewriting its prior group', () => {
  const { context: c, employee, group, groups } = setup();
  groups.push({ groupId: 'g2', name: 'Second', days: [] });
  c.seedEmploymentTerms_({}, [employee], 'admin');
  c.saveEmployeeTerms_({ scheduleEffectiveDate: '2026-11-01', reason: 'Transfer' }, employee, { ...employee, scheduleGroupId: 'g2' }, {}, 'admin');
  c.saveEmployeeTerms_({ scheduleEffectiveDate: '2026-12-01', reason: 'Return' }, { ...employee, scheduleGroupId: 'g2' }, employee, {}, 'admin');
  c.saveScheduleTerms_({ effectiveDate: '2026-11-15', reason: 'New hours' }, { ...group, days: [] }, {}, 'admin');
  const terms = c.reportTerms_({}, employee, 2026, 12);
  assert.equal(terms.scheduleForDate('2026-10-31').days.length, 1);
  assert.equal(terms.scheduleForDate('2026-11-16').groupId, 'g2');
  assert.equal(terms.scheduleForDate('2026-12-05').days.length, 0);
});

test('creating an employee leaves a blank legacy id untouched and accepts this month without backdate confirmation', () => {
  const { createGas } = require('./helpers/gas');
  const gas = createGas({ Employees: [
    ['Employee Name', 'Phone', 'Email', 'Device UUID', 'Employee ID', 'Schedule Group ID', 'Monthly Salary MYR', 'Status', 'Archived At', 'Archived By'],
    ['Legacy', '555', 'legacy@example.com', 'legacy-device', '', 'mon-sat', 4000, 'active', '', ''],
  ] });
  vm.runInContext('termsToday_=()=>"2026-10-24"', gas.context);
  const saved = gas.admin({
    action: 'adminSaveEmployee', name: 'New hire', monthlySalary: 5200, scheduleGroupId: 'mon-sat',
    salaryEffectiveDate: '2026-10-01', scheduleEffectiveDate: '2026-10-24', reason: 'Initial terms', allowBackdate: false
  });
  assert.equal(saved.ok, true, saved.message);
  const rows = gas.sheets.get('Employees').data;
  assert.equal(rows[1][0], 'Legacy');
  assert.equal(rows[1][4], '');
  assert.equal(Number(rows[1][6]), 4000);
  assert.equal(rows[2][0], 'New hire');
  assert.ok(rows[2][4]);
  const history = gas.admin({ action: 'adminGetEmploymentTerms', employeeId: saved.employee.employeeId });
  assert.equal(history.ok, true, history.message);
  assert.equal(history.salaries.at(-1).effectiveDate, '2026-10-01');
  assert.equal(history.salaries.at(-1).provenance, 'employee-creation');
});

test('new employees have verified creation terms rather than an invented historical salary baseline', () => {
  const { context: c, employee } = setup();
  c.saveEmployeeTerms_({ reason: 'New starter' }, null, employee, {}, 'admin');
  const history = c.employeeHistory_({}, employee);
  assert.equal(history.salaries.length, 1);
  assert.equal(history.salaries[0].provenance, 'employee-creation');
  assert.equal(history.salaries[0].effectiveDate, '2026-10-01');
  assert.equal(c.reportTerms_({}, employee, 2026, 10).scheduleForDate('2026-10-01').days.length, 0);
  assert.equal(c.reportTerms_({}, employee, 2026, 10).scheduleForDate('2026-10-23').days.length, 1);
  assert.throws(() => c.reportTerms_({}, employee, 2026, 9), /incomplete/);
});

test('public admin API preserves prior salary and returns audited corrections and terms', () => {
  const { createGas } = require('./helpers/gas');
  const gas = createGas({ Employees: [
    ['Employee Name', 'Phone', 'Email', 'Device UUID', 'Employee ID', 'Schedule Group ID', 'Monthly Salary MYR', 'Status', 'Archived At', 'Archived By'],
    ['Worker', '', '', '', 'e1', 'mon-sat', 5200, 'active', '', ''],
  ] });
  const cfg = gas.context.getRuntimeConfig_();
  gas.context.seedEmploymentTerms_(cfg, gas.context.readEmployees_(gas.context.getEmployeeSheet_(cfg), cfg), 'admin');
  const saved = gas.admin({ action: 'adminSaveEmployee', employeeId: 'e1', name: 'Worker', monthlySalary: 5600, scheduleGroupId: 'mon-sat', salaryEffectiveDate: '2099-11-01', reason: 'Planned raise' });
  assert.equal(saved.ok, true, saved.message);
  const history = gas.admin({ action: 'adminGetEmploymentTerms', employeeId: 'e1' });
  assert.equal(history.ok, true, history.message);
  assert.equal(history.salaries.length, 2);
  assert.equal(history.salaries[1].amount, 5600);
  const corrected = gas.admin({ action: 'adminSaveEmploymentTerms', employeeId: 'e1', monthlySalary: 5100, salaryEffectiveDate: '2025-01-01', reason: 'Verified agreement', allowBackdate: true });
  assert.equal(corrected.ok, true, corrected.message);
  assert.equal(corrected.salaries.length, 3);
  assert.equal(gas.sheets.get('Employees').getRange(2, 7).getValue(), 5600);
  const employee = gas.context.readEmployees_(gas.context.getEmployeeSheet_(cfg), cfg)[0];
  assert.equal(gas.context.reportTerms_(cfg, employee, 2025, 1).monthlySalary, 5100);
  assert.equal(gas.context.reportTerms_(cfg, employee, 2099, 11).monthlySalary, 5600);
});
