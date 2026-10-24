const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app() {
  const elements = new Map();
  function element() {
    const item={value:'', textContent:'', innerHTML:'', disabled:false, hidden:false, dataset:{},children:[],classList:{toggle(){},add(){},remove(){}},listeners:{},
      replaceChildren(...items){this.children=items;},append(...items){this.children.push(...items);},appendChild(child){this.children.push(child);return child;},
      insertRow(){return this.appendChild(element());},insertCell(){return this.appendChild(element());},createTBody(){return this.appendChild(element());},
      addEventListener(name,fn){this.listeners[name]=fn;},focus(){},reset(){}};
    return item;
  }
  const storage = new Map();
  const context = vm.createContext({console, URL, Date, Number, JSON, Math, setTimeout,clearTimeout, AbortController,
    window:{location:new URL('https://tapin.test/'),TAPIN_CONFIG:{GAS_WEB_APP_URL:'https://gas.test/'},crypto:{randomUUID:()=> 'uuid'},},
    document:{body:{dataset:{}},createElement:element,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}, sessionStorage:{getItem:k=>storage.get(k)},navigator:{userAgent:'test'}});
  vm.runInContext(fs.readFileSync('web/app.js','utf8').replace(/^bootstrap\(\);$/m,''),context);
  vm.runInContext('state.backendApiVersion=2',context);
  return {context,elements,run:code=>vm.runInContext(code,context)};
}

test('notification failure preserves confirmed punch success', async()=>{
  const a=app();
  a.run('postToBackend=async()=>({ok:true,employeeName:"Alice",locationStatus:"Office"});maybeNotifyArrival=async()=>{throw new Error("denied")};');
  await a.run('submitPunch({punchType:"in"},true)');
  assert.equal(a.elements.get('quick-status').textContent,'Punch complete');
  assert.match(a.elements.get('quick-result').textContent,/successful/);
});

test('one punch disables all controls and ignores concurrent clicks',async()=>{
  const a=app();
  a.run('var finishLocation;var calls=0;getPublicIP=()=>{calls++;return new Promise(resolve=>{finishLocation=resolve})};getCurrentPosition=async()=>({coords:{latitude:1,longitude:1,accuracy:1}});fetchNetworkTimestamp=async()=>1;postToBackend=async()=>({ok:true});');
  const pending=a.run('handlePunch("in",true)');
  for(const id of ['quick-in-btn','quick-out-btn','punch-btn','punch-out-btn']) assert.equal(a.elements.get(id).disabled,true,id);
  await a.run('handlePunch("out",false)');
  assert.equal(a.run('calls'),1);
  a.run('finishLocation("1.2.3.4")');await pending;
  for(const id of ['quick-in-btn','quick-out-btn','punch-btn','punch-out-btn']) assert.equal(a.elements.get(id).disabled,false,id);
});

test('lost punch response is unconfirmed and explicit rejection remains failed',async()=>{
  for(const rejected of [false,true]) {
    const a=app();a.run('getPublicIP=async()=>"1";getCurrentPosition=async()=>({coords:{latitude:1,longitude:1,accuracy:1}});fetchNetworkTimestamp=async()=>1;');
    a.context.fetch=async()=>{if(!rejected)throw new Error('network');return {ok:true,text:async()=>JSON.stringify({ok:false,message:'Already clocked in'})};};
    await a.run('handlePunch("in",true)');
    assert.equal(a.elements.get('quick-status').textContent,rejected?'Punch failed':'Punch result unconfirmed');
  }
});

test('public IP timeout uses dual-stack fallback before submitting one punch',async()=>{
  const a=app();const lookups=[];const delays=[];const punches=[];
  a.context.setTimeout=(callback,delay)=>{delays.push(delay);return setTimeout(callback,0);};
  a.context.navigator.geolocation={getCurrentPosition(resolve){resolve({coords:{latitude:1,longitude:1,accuracy:1}});}};
  a.context.fetch=async(url,options)=>{
    lookups.push(url);
    if(url==='https://api.ipify.org?format=json') return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('fetch is aborted'),{name:'AbortError'}))));
    if(url==='https://api64.ipify.org?format=json') return {ok:true,json:async()=>({ip:'2001:db8::1'})};
    if(options&&options.method==='POST') {punches.push(JSON.parse(options.body));return {ok:true,text:async()=>JSON.stringify({ok:true})};}
    return {ok:true,text:async()=>JSON.stringify({ok:true,serverTimestampMs:Date.now()})};
  };
  await a.run('handlePunch("in",true)');
  assert.equal(a.elements.get('quick-status').textContent,'Punch complete');
  assert.deepEqual(lookups.slice(0,2),['https://api.ipify.org?format=json','https://api64.ipify.org?format=json']);
  assert.equal(punches.length,1);
  assert.equal(punches[0].ipAddress,'2001:db8::1');
  assert.equal(delays.reduce((sum,value)=>sum+value,0),15000);
});

test('all public IP timeouts send no punch and restore controls with actionable feedback',async()=>{
  for(const quick of [true,false]) {
    const a=app();let lookups=0;
    a.context.setTimeout=callback=>setTimeout(callback,0);
    a.context.navigator.geolocation={getCurrentPosition(resolve){resolve({coords:{latitude:1,longitude:1,accuracy:1}});}};
    a.context.fetch=async(url,options)=>{
      assert.match(url,/^https:\/\/api(?:64)?\.ipify\.org/);
      lookups++;
      return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('fetch is aborted'),{name:'AbortError'}))));
    };
    await a.run('handlePunch("in",'+quick+')');
    assert.equal(lookups,2);
    const result=a.elements.get(quick?'quick-result':'result-text').textContent;
    assert.match(result,/Could not get your public IP address/);
    assert.match(result,/No punch was submitted/);
    assert.doesNotMatch(result,/fetch is aborted/);
    for(const id of ['quick-in-btn','quick-out-btn','punch-btn','punch-out-btn']) assert.equal(a.elements.get(id).disabled,false,id);
  }
});

test('leave pages append then refresh resets and unknown duration cannot approve',async()=>{
  const a=app(); a.elements.get('leave-status-select').value='pending';
  a.run('var requests=[];postToBackend=async p=>{requests.push(p);return {leaves:[{requestId:String(requests.length),status:"pending",dayPart:requests.length===1?"am":"unknown"}],nextCursor:requests.length===1?"next":""}}');
  await a.run('loadLeaveRequests()'); assert.match(a.elements.get('leave-body').innerHTML,/Morning/);
  await a.run('loadLeaveRequests(true)');
  assert.equal(a.run('requests[1].cursor'),'next');
  assert.match(a.elements.get('leave-body').innerHTML,/Unknown duration/);
  assert.equal((a.elements.get('leave-body').innerHTML.match(/data-leave-action="approved"/g)||[]).length,1);
  await a.run('loadLeaveRequests()');assert.equal(a.run('requests[2].cursor'),'');
  assert.doesNotMatch(a.elements.get('leave-body').innerHTML,/Morning/);
});

test('payroll audit shows adjustment values, provenance and warnings safely',()=>{
  const a=app();
  a.run('renderPayrollAudit({adjustments:[{adjustmentId:"adj",date:"2026-10-01",workHours:7,reason:"<review>",admin:"Boss",createdAt:"2026-10-02"}],terms:{salaryVersion:{versionId:"salary-1",effectiveMonth:"2026-10-01",provenance:"baseline"},warnings:["Unverified baseline"]},warnings:["Missing clock out"]})');
  const html=a.elements.get('payroll-audit').innerHTML;
 for(const text of ['adj','Worked hours: 7','&lt;review&gt;','Boss','salary-1','Unverified baseline','Missing clock out']) assert.ok(html.includes(text),text);
});

test('historical payroll dropdown includes archived employees regardless of active list',async()=>{
  const a=app();
  a.elements.set('payroll-employee',{value:'old',innerHTML:''});
  a.run('employees=[{employeeId:"active",name:"Active"}];var calls=[];postToBackend=async p=>{calls.push(p);return p.action==="adminGetEmployees"?{employees:[{employeeId:"old",name:"Former",status:"archived"}]}:{report:{summary:{},days:[],adjustments:[]}}}');
  await a.run('loadPayroll()');
  assert.equal(a.run('calls[0].status'),'all');
  assert.equal(a.run('calls[1].employeeId'),'old');
  assert.match(a.elements.get('payroll-employee').innerHTML,/Former \(Archived\)/);
});

test('terms changes require reason and explicit backdate confirmation',()=>{
  const a=app();a.run('localToday=()=>"2026-10-23"');
  a.elements.get('employee-id-input').value='emp';
  a.run('initializeTermsDates()');
  assert.equal(a.elements.get('employee-salary-effective').value,'2026-11');
  assert.throws(()=>a.run('termsChangeFields(true,false,false)'),/reason/);
  a.elements.get('employee-terms-reason').value='Documented correction';
  a.elements.get('employee-salary-effective').value='2026-10';
  a.context.window.confirm=()=>false;
  assert.throws(()=>a.run('termsChangeFields(true,false,false)'),/cancelled/);
  a.context.window.confirm=()=>true;
  assert.equal(a.run('termsChangeFields(true,false,false).allowBackdate'),true);
});

test('new employee historical salary uses confirmed frontend payload accepted by GAS',async()=>{
  const {createGas}=require('./helpers/gas');
  const gas=createGas();
  vm.runInContext('termsToday_=()=>"2026-10-24"',gas.context);
  const a=app();
  a.run('localToday=()=>"2026-10-24";loadEmployees=async()=>{}');
  a.elements.get('employee-name-input').value='Historical hire';
  a.elements.get('employee-salary-input').value='5200';
  a.elements.get('employee-schedule-input').value='mon-sat';
  a.context.document.getElementById('employee-salary-effective').value='2026-09';
  a.context.document.getElementById('employee-schedule-effective').value='2026-10-24';
  a.context.document.getElementById('employee-terms-reason').value='Verified hire terms';
  let confirmations=0;
  a.context.window.confirm=()=>{confirmations++;return true;};
  a.context.postToBackend=async payload=>{
    const {token,...request}=payload;
    const result=gas.admin(request);
    if(!result.ok) throw new Error(result.message);
    return result;
  };
  await a.run('saveEmployee()');
  assert.equal(confirmations,1);
  assert.equal(gas.sheets.get('SalaryHistory').data.at(-1)[2],'2026-09-01');
});

test('Taipei effective dates are ISO even when locale date formatting uses slashes',()=>{
  const a=app();
  a.context.Intl={DateTimeFormat:class {
    constructor(locale,options){assert.equal(options.timeZone,'Asia/Taipei');}
    format(){return '10/24/2026';}
    formatToParts(){return [{type:'month',value:'10'},{type:'literal',value:'/'},{type:'day',value:'24'},{type:'literal',value:'/'},{type:'year',value:'2026'}];}
  }};
  assert.equal(a.run('localToday()'),'2026-10-24');
  a.run('initializeTermsDates()');
  assert.equal(a.elements.get('employee-salary-effective').value,'2026-10');
  assert.equal(a.elements.get('employee-schedule-effective').value,'2026-10-24');
});

test('new employee current-month salary does not require historical confirmation',()=>{
  const a=app();a.run('localToday=()=>"2026-10-24"');
  a.context.document.getElementById('employee-terms-reason').value='Initial terms';
  let confirmations=0;a.context.window.confirm=()=>{confirmations++;return true;};
  const fields=a.run('termsChangeFields(true,true,false)');
  assert.equal(fields.allowBackdate,false);
  assert.equal(confirmations,0);
});

test('correction history exposes audit metadata and reasoned revocation',async()=>{
  const a=app();a.context.window.prompt=()=> 'Wrong time';
  a.run('var calls=[];postToBackend=async p=>{calls.push(p);if(p.action==="adminGetCorrections")return {corrections:[{requestId:"c",status:"approved",employeeName:"Former",reviewedBy:"Boss",reviewedAt:"2026-10-23",origin:"admin",revocationReason:"",replacesRequestId:"previous"}]};return {employees:[]}}');
  await a.run('loadAdminCorrections()');
  const table=a.elements.get('correction-review').children[0];
  const row=table.children[0].children[0];
  assert.match(row.children[0].innerHTML,/<dt>Reviewed by<\/dt><dd>Boss<\/dd>/);
  assert.match(row.children[0].innerHTML,/23 Oct 2026/);
  const revoke=row.children.at(-1).children[0];
  await revoke.onclick();
  const payload=a.run('calls.find(p=>p.action==="adminRevokeCorrection")');
  assert.equal(payload.reason,'Wrong time');assert.equal(payload.submissionId,'uuid');
});

test('retry IDs remain stable for one operation and change with input',()=>{
  const a=app();a.run('var serial=0;generateUUID=()=>String(++serial);var store={};');
  const first=a.run('stableSubmissionId(store,{time:"09:00"})');
  assert.equal(a.run('stableSubmissionId(store,{time:"09:00"})'),first);
  assert.notEqual(a.run('stableSubmissionId(store,{time:"09:01"})'),first);
});

test('new UI blocks writes until API version 2 handshake completes',async()=>{
  const a=app();a.run('state.backendApiVersion=0');
  let calls=0;a.context.fetch=async()=>{calls++;return {ok:true,text:async()=>JSON.stringify({ok:true,apiVersion:2,config:{}})};};
  await assert.rejects(a.run('postToBackend({action:"punch"})'),/Backend update required/);
  assert.equal(calls,0);
  await a.run('fetchPublicConfig()');await a.run('postToBackend({action:"punch"})');
  assert.equal(calls,2);
});

test('same-value historical salary correction explicitly uses terms endpoint only',async()=>{
  const a=app();a.run('localToday=()=>"2026-10-23";var calls=[];postToBackend=async p=>{calls.push(p);return {}};loadEmploymentTerms=async()=>{}');
  a.context.window.confirm=()=>true;
  a.context.document.getElementById('historical-terms-form').dataset.employeeId='archived';
  a.context.document.getElementById('historical-terms-salary').value='5200';
  a.context.document.getElementById('historical-terms-month').value='2026-01';
  a.context.document.getElementById('historical-terms-reason').value='Verified old payslip';
  await a.run('saveHistoricalTerms()');
  const payload=a.run('calls[0]');
  assert.equal(payload.action,'adminSaveEmploymentTerms');assert.equal(payload.monthlySalary,5200);
  assert.equal(payload.salaryEffectiveDate,'2026-01-01');assert.equal(payload.allowBackdate,true);
  assert.equal(payload.reason,'Verified old payslip');assert.equal(payload.scheduleGroupId,undefined);
});

test('editing an employee opens the collapsed editor with their current values',()=>{
  const a=app();
  a.run('employees=[{employeeId:"e1",name:"Alex",phone:"123",deviceUUID:"d1",scheduleGroupId:"mon-fri",monthlySalary:5200,status:"active"}];loadEmploymentTerms=async()=>{};renderEmployees()');
  const row=a.elements.get('employees-body').children[0];
  const edit=row.children.at(-1).children[0];
  edit.listeners.click();
  assert.equal(a.elements.get('employee-editor').open,true);
  assert.equal(a.elements.get('employee-name-input').value,'Alex');
  assert.equal(a.elements.get('employee-salary-input').value,5200);
});

test('replacing a revoked correction opens the direct-entry form and preserves the source link',async()=>{
  const a=app();
  a.run('postToBackend=async p=>p.action==="adminGetCorrections"?{corrections:[{requestId:"old",employeeId:"e1",status:"revoked",date:"2026-10-01",time:"09:00",punchType:"in"}]}:{employees:[{employeeId:"e1",name:"Alex"}]}');
  await a.run('loadAdminCorrections()');
  const row=a.elements.get('correction-review').children[0].children[0].children[0];
  row.children.at(-1).children[0].onclick();
  assert.equal(a.elements.get('correction-editor').open,true);
  assert.equal(a.elements.get('admin-correction-replaces').value,'old');
  assert.equal(a.elements.get('admin-correction-time').value,'2026-10-01T09:00');
});

test('one payroll adjustment form saves only supplied fields and keeps a reason',async()=>{
  const a=app();
  a.run('var calls=[];postToBackend=async p=>{calls.push(p);return {ok:true}};loadPayroll=async()=>{};openPayrollAdjustment({date:"2026-10-01",workedHours:8,absenceDays:0},"e1",2026,10)');
  assert.equal(a.elements.get('payroll-adjustment-dialog').open,true);
  a.elements.get('payroll-adjustment-pay').value='50';
  a.elements.get('payroll-adjustment-reason').value='Reviewed allowance';
  await a.run('savePayrollAdjustment()');
  const payload=a.run('calls[0]');
  assert.equal(payload.action,'adminSaveMonthlyAdjustment');
  assert.equal(payload.employeeId,'e1');
  assert.equal(payload.date,'2026-10-01');
  assert.equal(payload.payAmount,50);
  assert.equal(payload.reason,'Reviewed allowance');
  assert.equal(payload.workHours,undefined);
  assert.equal(payload.absenceDays,undefined);
  assert.equal(a.elements.get('payroll-adjustment-dialog').open,false);
});
