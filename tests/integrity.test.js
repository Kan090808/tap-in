const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load() {
  const c = vm.createContext({});
  for (const f of fs.readdirSync(path.join(__dirname, '../gas')).filter(f => f.endsWith('.gs'))) vm.runInContext(fs.readFileSync(path.join(__dirname, '../gas', f), 'utf8'), c);
  return c;
}
test('mixed paid and unpaid segments are independent of record order and cancellation', () => {
  const c = load();
  const personal = {requestId:'a', dayPart:'am',leaveType:'personal'};
  const annual = {requestId:'b', dayPart:'pm',leaveType:'annual'};
  const sick = {requestId:'s', dayPart:'pm',leaveType:'sick'};
  for (const leaves of [[personal, annual], [annual, personal], [personal, sick], [sick, personal]]) {
    const coverage = c.dailyLeaveCoverage_(leaves, 8);
    const day = c.calculateDailyPayroll_({weekday:4,workedHours:0,scheduledHours:8,monthlySalary:5200,...coverage});
    assert.equal(day.unpaidLeaveHours,4); assert.equal(day.paidLeaveHours,4); assert.equal(day.absenceDeduction,100); assert.equal(day.absenceDays,0);
  }
  const after = c.calculateDailyPayroll_({weekday:4,workedHours:0,scheduledHours:8,monthlySalary:5200,...c.dailyLeaveCoverage_([annual],8)});
  assert.equal(after.absenceDays,0.5); assert.equal(after.unpaidLeaveHours,0);
});
test('leave capacity respects Saturday and nonworking days, overlap is explicit', () => {
  const c=load();
  assert.equal(c.dailyLeaveCoverage_([{requestId:'a',dayPart:'am',leaveType:'personal'}],4).leaveHours,4);
  assert.equal(c.dailyLeaveCoverage_([{dayPart:'full',leaveType:'annual'}],0).leaveHours,0);
  assert.throws(()=>c.dailyLeaveCoverage_([{requestId:'a',dayPart:'am',leaveType:'annual'}, {requestId:'b',dayPart:'full',leaveType:'annual'}],8),/overlap/i);
  assert.throws(()=>c.dailyLeaveCoverage_([{requestId:'a',dayPart:'am',leaveType:'personal'}, {requestId:'b',dayPart:'pm',leaveType:'annual'}],4),/exceeds scheduled/i);
  assert.equal(c.dailyLeaveCoverage_([{requestId:'full',dayPart:'full',leaveType:'annual'}],9).leaveHours,9);
});
test('combined timeline rejects duplicate/consecutive/ambiguous events and supports incomplete pairs', () => {
 const c=load();
 for(const events of [[{time:'09:00',punchType:'in'},{time:'10:00',punchType:'in'},{time:'18:00',punchType:'out'}],[{time:'09:00',punchType:'in'},{time:'09:00',punchType:'out'}]]) assert.throws(()=>c.requireValidPunches_(events),/conflict|same time/i);
 assert.equal(c.pairedWorkHours_([{time:'18:00',punchType:'out'}],4),0);
 assert.equal(c.pairedWorkHours_([{time:'18:00',punchType:'out'},{time:'09:00',punchType:'in'}],4),8);
 assert.equal(c.punchWarnings_([{time:'09:00',punchType:'in'}]).length,1);
 assert.throws(()=>c.pairedWorkHours_([{time:'09:00',punchType:'in'},{time:'10:00',punchType:'in'},{time:'18:00',punchType:'out'}],4),/conflict/i);
});
test('strict date rejects normalized impossible dates',()=>{
 const c=load(); assert.throws(()=>c.exactDate_('2026-02-30'),/date/i); assert.equal(c.exactDate_('2026-02-28'),'2026-02-28');
});
test('unknown leave duration blocks authoritative payroll instead of guessing a full day',()=>{
 const c=load();
 assert.throws(()=>c.dailyLeaveCoverage_([{requestId:'legacy',leaveType:'annual'}],8),/duration/i);
  assert.throws(()=>c.dailyLeaveCoverage_([{requestId:'unknown-type',dayPart:'full',leaveType:'other'}],8),/leave type/i);
 assert.throws(()=>c.approvedLeaveConflicts_([{requestId:'legacy',employeeId:'e1',status:'approved',startDate:'2026-10-01',endDate:'2026-10-01',dayPart:''}]),/duration/i);
});

const { createGas } = require('./helpers/gas');
function fixture(extra={}) {
 const g=createGas({Employees:[['Employee Name','Phone','Email','Device UUID','Employee ID','Schedule Group ID','Monthly Salary MYR','Status'],['Alex','','','d1','e1','mon-fri',5200,'active']],...extra});
 const cfg=g.context.getRuntimeConfig_();
 g.context.seedEmploymentTerms_(cfg,g.context.readEmployees_(g.context.getEmployeeSheet_(cfg),cfg),'admin');
 return g;
}
function leaveRow(id,part,type='annual',status='pending') { return [id,'Alex','d1',type,'2026-10-01','2026-10-01','reason',status,'2026-09-20T00:00:00Z','','','',part,'','','','e1']; }
test('real leave review rejects overlap atomically, accepts complementary halves, retains cancellation audit',()=>{
 const g=fixture({LeaveRequests:[['RequestID'],leaveRow('a','am','personal','approved'),leaveRow('b','am'),leaveRow('c','pm')]});
 const conflict=g.admin({action:'adminUpdateLeaveStatus',requestId:'b',status:'approved'});
 assert.equal(conflict.ok,false); assert.match(conflict.message,/overlap.*2026-10-01.*am/i); assert.equal(g.sheets.get('LeaveRequests').data[2][7],'pending');
 assert.equal(g.admin({action:'adminUpdateLeaveStatus',requestId:'c',status:'approved'}).ok,true);
 assert.equal(g.admin({action:'adminUpdateLeaveStatus',requestId:'c',status:'approved'}).ok,true);
 assert.equal(g.admin({action:'adminUpdateLeaveStatus',requestId:'a',status:'cancelled'}).ok,true);
 const a=g.sheets.get('LeaveRequests').data[1]; assert.equal(a[7],'cancelled'); assert.equal(a[15],'admin'); assert.match(a[14],/^\d{4}-/);
});
test('real correction direct entries, approvals, retries and revocation share effective stream',()=>{
 const g=fixture();
 const out={action:'adminAddCorrection',employeeId:'e1',date:'2026-10-01',time:'18:00',punchType:'out',reason:'Missed punch',submissionId:'out-1'};
 const first=g.admin(out); assert.equal(first.ok,true,first.message);
 assert.equal(g.admin(out).requestId,first.requestId);
 const inside=g.admin({...out,time:'09:00',punchType:'in',submissionId:'in-1'}); assert.equal(inside.ok,true,inside.message);
 assert.equal(g.admin({...out,time:'10:00',punchType:'in',submissionId:'bad-1'}).ok,false);
 assert.equal(g.context.pairedWorkHours_(g.context.effectivePunches_({},'e1','2026-10-01'),4),8);
 const duplicate=g.sheet('CorrectionRequests',g.sheets.get('CorrectionRequests').data.concat([['pending','e1','Alex','d1','2026-10-01','in','09:00','missed','pending','2026-10-01T00:00:00Z','','']]));
 assert.equal(g.admin({action:'adminUpdateCorrection',requestId:'pending',status:'approved'}).ok,false);
 assert.equal(duplicate.data[3][8],'pending');
 assert.equal(g.admin({action:'adminRevokeCorrection',requestId:first.requestId,reason:'',submissionId:'revoke-1'}).ok,false);
 const revoke={action:'adminRevokeCorrection',requestId:first.requestId,reason:'Wrong date',submissionId:'revoke-1'};
 assert.equal(g.admin(revoke).ok,true); assert.equal(g.admin(revoke).ok,true);
 assert.equal(g.context.pairedWorkHours_(g.context.effectivePunches_({},'e1','2026-10-01'),4),0);
 const all=g.admin({action:'adminGetCorrections',status:'all'}).corrections;
 const revoked=all.find(row=>row.requestId===first.requestId);
 assert.equal(revoked.status,'revoked'); assert.equal(revoked.reviewedBy,'admin'); assert.ok(revoked.reviewedAt); assert.equal(revoked.revocationReason,'Wrong date'); assert.equal(revoked.origin,'admin');
});
test('real payroll adjustments require valid daily scope for hours and retain month money',()=>{
 const g=fixture();
 const request={action:'adminSaveMonthlyAdjustment',employeeId:'e1',year:2026,month:10,reason:'Reviewed'};
 assert.equal(g.admin({...request,workHours:8}).ok,false);
 assert.equal(g.admin({...request,absenceDays:0}).ok,false);
 assert.equal(g.admin({...request,date:'2026-10-32',workHours:8}).ok,false);
 assert.equal(g.admin({...request,payAmount:-20}).ok,true);
 assert.equal(g.admin({...request,date:'2026-10-01',workHours:8}).ok,true);
});
test('monthly report and CSV use separated leave, block legacy overlaps, and explain terms',()=>{
 const g=fixture({LeaveRequests:[['RequestID'],leaveRow('a','am','personal','approved'),leaveRow('b','pm','annual','approved')]});
 const cfg=g.context.getRuntimeConfig_();
 g.context.seedEmploymentTerms_(cfg,g.context.readEmployees_(g.context.getEmployeeSheet_(cfg),cfg),'admin');
 const req={employeeId:'e1',year:2026,month:10};
 const report=g.admin({action:'adminGetMonthlyReport',...req}); assert.equal(report.ok,true,report.message);
 const day=report.report.days.find(day=>day.date==='2026-10-01');
 assert.equal(day.unpaidLeaveHours,4); assert.equal(day.paidLeaveHours,4); assert.equal(day.absenceDeduction,100);
 assert.ok(report.report.terms.salaryVersion.versionId); assert.ok(report.report.warnings.some(warning=>/unverified/i.test(warning)));
 const csv=g.admin({action:'adminExportMonthlyCsv',...req}); assert.equal(csv.ok,true,csv.message); assert.match(csv.csv,/Unpaid Leave Hours/); assert.match(csv.csv,/SALARY VERSION/); assert.match(csv.csv,/current-known-baseline/);
 g.sheets.get('LeaveRequests').appendRow(leaveRow('conflict','full','annual','approved'));
 const blocked=g.admin({action:'adminGetMonthlyReport',...req}); assert.equal(blocked.ok,false); assert.match(blocked.message,/overlap/i);
 assert.equal(g.admin({action:'adminExportMonthlyCsv',...req}).ok,false);
});
test('queued approvals validate against previously committed decision and keep original submission time',()=>{
 const row=(id)=>[id,'e1','Alex','d1','2026-10-01','out','18:00','missed','pending','2026-10-02T00:00:00Z','',''];
 const g=fixture({CorrectionRequests:[['RequestID'],row('a'),row('b')]});
 const first=g.admin({action:'adminUpdateCorrection',requestId:'a',status:'approved'}); assert.equal(first.ok,true,first.message);
 const second=g.admin({action:'adminUpdateCorrection',requestId:'b',status:'approved'}); assert.equal(second.ok,false); assert.match(second.message,/same time|conflict/i);
 const history=g.admin({action:'adminGetCorrections',status:'all'}).corrections;
 assert.equal(history.find(item=>item.requestId==='a').submittedAt,'2026-10-02T00:00:00Z');
 assert.ok(history.find(item=>item.requestId==='a').reviewedAt);
 assert.equal(history.find(item=>item.requestId==='b').status,'pending');
});
test('correction rejects changed retry payloads and impossible dates without writing',()=>{
 const g=fixture();
 const request={action:'adminAddCorrection',employeeId:'e1',date:'2026-10-01',time:'09:00',punchType:'in',reason:'missed',submissionId:'stable'};
 assert.equal(g.admin({...request,date:'2026-02-30'}).ok,false);
 assert.equal(g.admin(request).ok,true);
 assert.equal(g.admin({...request,time:'10:00'}).ok,false);
 assert.equal(g.admin({action:'adminGetCorrections',status:'all'}).corrections.length,1);
});
test('native Sheets Date cells retain correction attendance time and review timestamps',()=>{
 const g=fixture({CorrectionRequests:[['RequestID'],['native','e1','Alex','d1','2026-10-01','in','09:00','missed','approved','2026-10-02T00:00:00Z','admin','reviewed','2026-10-02T01:00:00Z']]});
 const row=g.sheets.get('CorrectionRequests').data[1];
 row[4]=vm.runInContext("new Date('2026-09-30T16:00:00Z')",g.context);
 row[6]=vm.runInContext("new Date('1899-12-30T01:00:00Z')",g.context);
 row[9]=vm.runInContext("new Date('2026-10-02T00:00:00Z')",g.context);
 row[12]=vm.runInContext("new Date('2026-10-02T01:00:00Z')",g.context);
 const history=g.admin({action:'adminGetCorrections',status:'all'}).corrections[0];
 assert.equal(history.date,'2026-10-01'); assert.equal(history.time,'09:00');
 assert.equal(history.submittedAt,'2026-10-02T00:00:00.000Z'); assert.equal(history.reviewedAt,'2026-10-02T01:00:00.000Z');
});
test('Saturday complementary half requests cannot exceed the four-hour shift at approval or report time',()=>{
 const a=leaveRow('a','am','personal','approved'), b=leaveRow('b','pm');
 a[4]=a[5]=b[4]=b[5]='2026-10-03';
 const g=fixture({Employees:[['Employee Name'],['Alex','','','d1','e1','mon-sat',5200,'active']],LeaveRequests:[['RequestID'],a,b]});
 const approval=g.admin({action:'adminUpdateLeaveStatus',requestId:'b',status:'approved'});
 assert.equal(approval.ok,false); assert.match(approval.message,/2026-10-03.*exceeds scheduled/i);
 assert.equal(g.sheets.get('LeaveRequests').data[2][7],'pending');
 g.sheets.get('LeaveRequests').data[2][7]='approved';
 const report=g.admin({action:'adminGetMonthlyReport',employeeId:'e1',year:2026,month:10}); assert.equal(report.ok,false); assert.match(report.message,/exceeds scheduled/i);
});
