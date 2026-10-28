import { sha256 } from '@noble/hashes/sha256';
import { createGas } from 'tapin:gas';

const STATE_KEY = 'tapin_demo_state_v1';
const DEVICE_KEY = 'tapin_device_uuid';
const PROOF_LIMIT = 512 * 1024;
const TOTAL_PROOF_LIMIT = 1536 * 1024;
const NativeDate = globalThis.Date;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const dictionary = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const damaged = () => new Error('Demo data is damaged or incompatible. Export your browser storage if needed, then use Reset demo to start again.');

function validateState(state) {
  if (!dictionary(state) || state.version !== 1 || state.initialized !== true || !Number.isFinite(state.clockMs) ||
      !dictionary(state.properties) || !dictionary(state.spreadsheets) || !dictionary(state.files)) throw damaged();
  if (!Object.values(state.properties).every(value => typeof value === 'string')) throw damaged();
  for (const key of ['TAPIN_ADMIN_SESSIONS_JSON', 'TAPIN_ADMIN_LOGIN_GUARD_JSON', 'TAPIN_REQUEST_NONCES_JSON', ...Object.keys(state.properties).filter(key => key.startsWith('TAPIN_EMPLOYEE_SESSION_') || key.startsWith('TAPIN_EMPLOYEE_LOGIN_GUARD_'))]) {
    if (own(state.properties, key) && !dictionary(JSON.parse(state.properties[key]))) throw damaged();
  }
  if (!state.properties.TAPIN_ADMIN_USERNAME || !state.properties.TAPIN_ADMIN_PASSWORD_HASH || !state.properties.TAPIN_ADMIN_PASSWORD_SALT) throw damaged();
  for (const sheets of Object.values(state.spreadsheets)) {
    if (!dictionary(sheets)) throw damaged();
    for (const rows of Object.values(sheets)) {
      if (!Array.isArray(rows) || !rows.every(row => Array.isArray(row) && row.every(cell => cell === null || ['string', 'number', 'boolean'].includes(typeof cell)))) throw damaged();
    }
  }
  for (const file of Object.values(state.files)) {
    if (!dictionary(file) || typeof file.name !== 'string' || typeof file.type !== 'string' || typeof file.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)) throw damaged();
  }
  return state;
}

function base64Encode(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.slice(offset, offset + 8192).map(value => value & 255));
  return btoa(binary);
}
function base64Decode(value) { return Array.from(atob(value), character => character.charCodeAt(0)); }
function formatDate(date, zone, pattern) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]));
  const formats = { 'yyyy-MM-dd': `${parts.year}-${parts.month}-${parts.day}`, 'yyyy-MM': `${parts.year}-${parts.month}`, 'HH:mm': `${parts.hour}:${parts.minute}`, 'HH:mm:ss': `${parts.hour}:${parts.minute}:${parts.second}` };
  if (!own(formats, pattern)) throw new Error(`Unsupported date format: ${pattern}`);
  return formats[pattern];
}
function blob(bytes, type, name) {
  return { getBytes: () => bytes.slice(), getContentType: () => type, getName: () => name };
}

function servicesFor(state, clock) {
  let held = false;
  class DemoDate extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  function sheet(name, rows) {
    const result = {
      getName: () => name,
      getLastRow: () => rows.length,
      getLastColumn: () => rows.reduce((max, row) => Math.max(max, row.length), 0),
      getMaxColumns: () => Math.max(26, result.getLastColumn()),
      insertColumnsAfter() { return result; },
      appendRow(values) { rows.push(Array.from(values)); return result; },
      deleteRow(row) { rows.splice(row - 1, 1); },
      insertRowBefore(row) { rows.splice(row - 1, 0, []); },
      getRange(row, col, height = 1, width = 1) {
        if (![row, col, height, width].every(value => Number.isInteger(value) && value > 0)) throw new Error('Invalid sheet range');
        return {
          getValues: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => rows[row + y - 1]?.[col + x - 1] ?? '')),
          getValue: () => rows[row - 1]?.[col - 1] ?? '',
          setValues(values) {
            if (values.length !== height || values.some(valuesRow => valuesRow.length !== width)) throw new Error('Sheet range shape mismatch');
            values.forEach((valuesRow, y) => {
              while (rows.length < row + y) rows.push([]);
              while (rows[row + y - 1].length < col + width - 1) rows[row + y - 1].push('');
              valuesRow.forEach((value, x) => { rows[row + y - 1][col + x - 1] = value; });
            });
            return this;
          },
          setValue(value) { return this.setValues([[value]]); },
          clearContent() { return this.setValues(Array.from({ length: height }, () => Array(width).fill(''))); },
        };
      },
    };
    return result;
  }
  const properties = {
    getProperty: key => own(state.properties, key) ? state.properties[key] : null,
    getProperties: () => ({ ...state.properties }),
    setProperty(key, value) { state.properties[key] = String(value); return this; },
    // Match the repository's GAS host: configuration updates preserve credentials and sessions.
    setProperties(values) { for (const [key, value] of Object.entries(values)) this.setProperty(key, value); return this; },
    deleteProperty(key) { delete state.properties[key]; return this; },
  };
  function file(id) {
    const value = state.files[id];
    if (!value) throw new Error('Demo proof file not found');
    return { getId: () => id, getName: () => value.name, getUrl: () => `https://drive.google.com/file/d/${id}/view`, getBlob: () => blob(base64Decode(value.base64), value.type, value.name) };
  }
  return {
    Date: DemoDate,
    SpreadsheetApp: {
      openById(id) {
        if (!own(state.spreadsheets, id)) state.spreadsheets[id] = {};
        const sheets = state.spreadsheets[id];
        return { getSheetByName: name => own(sheets, name) ? sheet(name, sheets[name]) : null,
          insertSheet(name) { if (own(sheets, name)) throw new Error('Sheet already exists'); sheets[name] = []; return sheet(name, sheets[name]); } };
      },
      flush() {},
    },
    PropertiesService: { getScriptProperties: () => properties },
    LockService: { getScriptLock: () => ({ waitLock() { if (held) throw new Error('Nested demo lock'); held = true; }, releaseLock() { held = false; } }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ setMimeType() { return this; }, getContent: () => text }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(), formatDate,
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      computeDigest(algorithm, value) {
        if (algorithm !== 'SHA_256') throw new Error('Unsupported digest algorithm');
        return Array.from(sha256(typeof value === 'string' ? new TextEncoder().encode(value) : Uint8Array.from(value)));
      },
      base64Encode, base64Decode, newBlob: blob,
    },
    DriveApp: {
      createFile(value) {
        const bytes = value.getBytes();
        if (bytes.length > PROOF_LIMIT) throw new Error('Demo proof must be at most 512 KiB. Choose a smaller image or PDF.');
        const encoded = base64Encode(bytes);
        const total = Object.values(state.files).reduce((sum, item) => sum + base64Decode(item.base64).length, 0);
        if (total + bytes.length > TOTAL_PROOF_LIMIT) throw new Error('Demo proof storage is limited to 1.5 MiB total. Reset demo or choose a smaller file.');
        const id = crypto.randomUUID();
        state.files[id] = { name: value.getName(), type: value.getContentType(), base64: encoded };
        return file(id);
      },
      getFileById: file,
    },
  };
}

const decode = output => JSON.parse(output.getContent());
function sampleProof() {
  const content = 'BT /F1 16 Tf 40 150 Td (TapIn Demo - Medical Certificate) Tj 0 -30 Td /F1 11 Tf (Sample proof only. No real medical or personal information.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 220] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return `data:application/pdf;base64,${base64Encode(Array.from(new TextEncoder().encode(pdf)))}`;
}
function seed(state, gas, clock, deviceUUID) {
  gas.setAdminCredential('admin', 'demo-password');
  const post = request => {
    const result = decode(gas.doPost({ postData: { contents: JSON.stringify(request) } }));
    if (!result.ok) throw new Error(`Could not initialize demo: ${result.message}`);
    return result;
  };
  const token = post({ action: 'adminLogin', username: 'admin', password: 'demo-password' }).token;
  const today = formatDate(new NativeDate(clock.now), 'Asia/Taipei', 'yyyy-MM-dd');
  const firstDay = today.slice(0, 7) + '-01';
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  const people = [
    { name: 'Alex Morgan', deviceUUID, monthlySalary: 5200, scheduleGroupId: 'mon-fri', email: 'alex@example.com', phone: '+60 12 345 6789' },
    { name: 'Jamie Chen', deviceUUID: 'demo-jamie-device', monthlySalary: 6200, scheduleGroupId: 'mon-sat', email: 'jamie@example.com', phone: '+60 12 555 0199' },
    { name: 'Taylor Singh', deviceUUID: 'demo-taylor-device', monthlySalary: 4800, scheduleGroupId: 'mon-fri', email: 'taylor@example.com', phone: '+60 12 555 0134' },
  ].map(person => post({ action: 'adminSaveEmployee', token, ...person, reason: 'Demo employee opening terms', scheduleEffectiveDate: firstDay, salaryEffectiveDate: firstDay, allowBackdate: true }).employee);
  // Seed genuine punch records via doPost at historical demo instants. Never seed today's
  // device stream, so the customer can immediately try clocking in and out.
  const originalClock = clock.now;
  for (const [index, person] of people.entries()) {
    const worked = [];
    for (let day = 1; day < Number(today.slice(8)); day++) {
      const date = `${today.slice(0, 7)}-${String(day).padStart(2, '0')}`;
      const weekday = new NativeDate(`${date}T12:00:00Z`).getUTCDay();
      if (weekday === 0 || (weekday === 6 && person.scheduleGroupId === 'mon-fri')) continue;
      worked.push(date);
    }
    for (const [dayIndex, date] of worked.entries()) {
      if ((index === 0 && date.endsWith('-28')) || (index === 1 && date.endsWith('-27'))) continue;
      if (dayIndex === 1 && index === 0) {
        for (const [punchType, time] of [['in', '09:00'], ['out', '18:00']]) {
          post({ action: 'adminAddCorrection', token, employeeId: person.employeeId, date, time, punchType,
            reason: 'Demo missed device punches verified by manager', submissionId: crypto.randomUUID() });
        }
        continue;
      }
      for (const [punchType, time] of [['in', index === 1 && dayIndex === 2 ? '09:20' : '09:00'], ['out', new NativeDate(`${date}T12:00:00Z`).getUTCDay() === 6 ? '13:00' : index === 2 && dayIndex === 2 ? '20:00' : '18:00']]) {
        clock.now = NativeDate.parse(`${date}T${time}:00+08:00`);
        post({ action: 'punch', deviceUUID: person.deviceUUID, employeeToken: gas.createEmployeeSession_(person, person.deviceUUID).token, punchType, ipAddress: '203.0.113.10', latitude: 3.139, longitude: 101.6869, accuracyMeters: 5,
          originProtocol: 'https', originHost: 'demo.local', requestTimestamp: clock.now, requestId: crypto.randomUUID() });
      }
    }
  }
  clock.now = originalClock;
  const pendingDate = `${today.slice(0, 7)}-28`;
  const approvedDate = `${today.slice(0, 7)}-27`;
  function leave(person, date, leaveType, reason, evidenceDataUrl) {
    const requestId = crypto.randomUUID();
    post({ action: 'submitLeave', deviceUUID: person.deviceUUID, employeeToken: gas.createEmployeeSession_(person, person.deviceUUID).token, requestId, requestTimestamp: clock.now, leaveType, startDate: date, endDate: date, dayPart: 'full', reason, evidenceDataUrl });
    return requestId;
  }
  leave(people[0], pendingDate, 'personal', 'Family appointment — pending review');
  const approved = leave(people[1], approvedDate, 'sick', 'Medical appointment', sampleProof());
  post({ action: 'adminUpdateLeaveStatus', token, requestId: approved, status: 'approved', reviewNote: 'Demo medical proof reviewed' });
  post({ action: 'employeeSubmitCorrection', deviceUUID: people[0].deviceUUID, employeeToken: gas.createEmployeeSession_(people[0], people[0].deviceUUID).token, date: pendingDate, time: '09:00', punchType: 'in', reason: 'Forgot to clock in — pending review', submissionId: crypto.randomUUID() });
  for (const person of people) post({ action: 'adminSaveMonthlyAdjustment', token, employeeId: person.employeeId, year, month, payAmount: 150, reason: 'Demo performance bonus' });
  post({ action: 'adminLogout', token });
  for (const key of Object.keys(state.properties)) {
    if (key.startsWith('TAPIN_EMPLOYEE_SESSION_')) delete state.properties[key];
  }
  state.clockMs = clock.now;
  state.initialized = true;
}

export function createDemoRuntime(storage) {
  function load() {
    storage ??= globalThis.localStorage;
    const raw = storage.getItem(STATE_KEY);
    if (raw === null) return null;
    try { return validateState(JSON.parse(raw)); } catch { throw damaged(); }
  }
  function execute(payload) {
    try {
      if (!dictionary(payload)) throw new Error('Demo request must be an object');
      const persisted = load();
      const original = persisted ? JSON.stringify(persisted) : null;
      const state = persisted || { version: 1, initialized: false, clockMs: 0, properties: {}, spreadsheets: {}, files: {} };
      let deviceUUID = storage.getItem(DEVICE_KEY);
      if (!deviceUUID) { deviceUUID = crypto.randomUUID(); storage.setItem(DEVICE_KEY, deviceUUID); }
      const realNow = NativeDate.now();
      const clock = { now: Math.max(realNow, state.clockMs) };
      const gas = createGas(servicesFor(state, clock));
      if (!persisted) seed(state, gas, clock, deviceUUID);
      const beforeRequest = JSON.stringify(state);
      const request = { ...payload };
      if (request.action === 'punch') {
        // The actual business rules forbid equal-minute punches. Advance only the
        // simulated clock, not the GAS sequence validator, and persist that clock.
        try {
          const cfg = gas.getRuntimeConfig_();
          const person = gas.requireEmployeeByDevice_(cfg, request.deviceUUID);
          const date = formatDate(new NativeDate(clock.now), 'Asia/Taipei', 'yyyy-MM-dd');
          const latest = gas.effectivePunches_(cfg, person.employeeId, date).at(-1);
          if (latest) clock.now = Math.max(clock.now, NativeDate.parse(`${date}T${latest.time}:00+08:00`) + 60000);
        } catch { /* doPost returns the authoritative identity or ownership error. */ }
      }
      // Metadata uses the serverTime response. Shift it by exactly this punch's
      // clock advancement while retaining freshness/replay validation in GAS.
      const priorNow = Math.max(realNow, state.clockMs);
      if (Number.isFinite(Number(request.requestTimestamp))) request.requestTimestamp = Number(request.requestTimestamp) + (clock.now - priorNow);
      const output = ['publicConfig', 'serverTime'].includes(request.action)
        ? gas.doGet({ parameter: request })
        : gas.doPost({ postData: { contents: JSON.stringify(request) } });
      const response = decode(output);
      // Auth failures intentionally retain the real GAS login guard/session cleanup.
      // All other rejected operations roll back nonces, partial rows and proof files.
      if (!response.ok && !['adminLogin', 'adminLogout', 'employeeLogin', 'employeeLogout'].includes(request.action)) {
        if (!persisted) storage.setItem(STATE_KEY, beforeRequest);
        return response;
      }
      if (response.ok && request.action === 'punch') state.clockMs = clock.now;
      const serialized = JSON.stringify(state);
      if (serialized !== original) storage.setItem(STATE_KEY, serialized);
      return response;
    } catch (error) {
      const message = error?.message || 'Unknown demo error';
      if (/quota|storage|space|access|security/i.test(message) && !/damaged|proof/i.test(message)) {
        return { ok: false, message: 'Demo changes were not saved: browser storage is full or unavailable. Free space or enable local storage, then try again.', backendRejected: true };
      }
      return { ok: false, message, backendRejected: true };
    }
  }
  // Each operation is synchronous inside its Promise boundary: load, GAS execution,
  // and one atomic localStorage commit cannot interleave within this page. Web Locks
  // serialize cooperating tabs; every operation reloads storage, even without it.
  function exclusive(operation) {
    return globalThis.navigator?.locks?.request
      ? navigator.locks.request('tapin-demo-state-v1', operation)
      : Promise.resolve().then(operation);
  }
  return {
    request: payload => exclusive(() => execute(payload)),
    reset: () => exclusive(() => {
      try { (storage ?? globalThis.localStorage).removeItem(STATE_KEY); }
      catch { throw new Error('Demo could not be reset because browser storage is unavailable.'); }
    }),
  };
}

window.TAPIN_DEMO = createDemoRuntime();
