const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function createGas(initial = {}) {
  const sheets = new Map();
  let writes = 0;
  let failureAt = Infinity;
  let held = false;
  function mutate() { writes += 1; if (writes === failureAt) throw new Error('Simulated interrupted write'); }
  function sheet(name, rows) {
    const data = rows.map(row => row.slice());
    const result = {
      data, getName: () => name, getLastRow: () => data.length,
      getMaxColumns: () => Math.max(26, ...data.map(row => row.length)),
      getLastColumn: () => Math.max(0, ...data.map(row => row.length)),
      insertColumnsAfter() { mutate(); },
      appendRow(row) { mutate(); data.push(Array.from(row)); return result; },
      deleteRow(row) { mutate(); data.splice(row - 1, 1); },
      insertRowBefore(row) { mutate(); data.splice(row - 1, 0, []); },
      getRange(row, col, height = 1, width = 1) {
        if (row < 1 || col < 1 || height < 1 || width < 1) throw new Error('Invalid range');
        return {
          getValues: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => data[row + y - 1]?.[col + x - 1] ?? '')),
          getValue: () => data[row - 1]?.[col - 1] ?? '',
          setValues(values) {
            if (values.length !== height || values.some(v => v.length !== width)) throw new Error('Range shape mismatch');
            mutate();
            values.forEach((valuesRow, y) => {
              while (data.length < row + y) data.push([]);
              valuesRow.forEach((value, x) => { data[row + y - 1][col + x - 1] = value; });
            });
            return this;
          },
          setValue(value) { return this.setValues([[value]]); },
          clearContent() { return this.setValues(Array.from({ length: height }, () => Array(width).fill(''))); },
        };
      },
    };
    sheets.set(name, result);
    return result;
  }
  Object.entries(initial).forEach(([name, rows]) => sheet(name, rows));
  const properties = {};
  const spreadsheet = { getSheetByName: name => sheets.get(name) || null, insertSheet: name => { mutate(); return sheet(name, []); } };
  const context = vm.createContext({
    console, Date,
    SpreadsheetApp: { openById: () => spreadsheet, flush() {} },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties[key] ?? null,
      getProperties: () => ({ ...properties }),
      setProperty(key, value) {
        if (Buffer.byteLength(String(value)) > 9 * 1024) throw new Error('Script Property value exceeds 9 KiB');
        properties[key] = String(value);
      },
      setProperties(values) { for (const [key, value] of Object.entries(values)) this.setProperty(key, value); },
      deleteProperty(key) { delete properties[key]; },
    }) },
    LockService: { getScriptLock: () => ({ waitLock() { if (held) throw new Error('Nested lock'); held = true; }, releaseLock() { held = false; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate(date, zone, pattern) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]));
        if (pattern === 'yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`;
        if (pattern === 'yyyy-MM') return `${parts.year}-${parts.month}`;
        if (pattern === 'HH:mm:ss') return `${parts.hour}:${parts.minute}:${parts.second}`;
        if (pattern === 'HH:mm') return `${parts.hour}:${parts.minute}`;
        throw new Error(`Unsupported date format: ${pattern}`);
      },
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(value).digest()),
      base64Encode: bytes => Buffer.from(bytes).toString('base64'),
      base64Decode: value => Array.from(Buffer.from(value, 'base64')),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType() { return this; }, getContent: () => text }) },
  });
  const directory = path.join(__dirname, '../../gas');
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith('.gs')).sort()) vm.runInContext(fs.readFileSync(path.join(directory, file), 'utf8'), context, { filename: file });
  function post(request) { return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(request) } }).getContent()); }
  context.setAdminCredential('admin', 'test-password');
  const login = post({ action: 'adminLogin', username: 'admin', password: 'test-password' });
  function employee(request) {
    let session;
    try {
      const person = context.requireEmployeeByDevice_(context.getRuntimeConfig_(), request.deviceUUID);
      session = context.createEmployeeSession_(person, request.deviceUUID);
    } catch (_error) {}
    return post({ ...request, employeeToken: session?.token });
  }
  return {
    context, sheets, sheet, post, employee,
    admin: request => post({ token: login.token, ...request }),
    properties,
    get writes() { return writes; },
    failAfter(count) { failureAt = writes + count; },
    resume() { failureAt = Infinity; },
  };
}

module.exports = { createGas };
