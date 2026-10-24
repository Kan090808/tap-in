const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { once } = require('node:events');
const { createLocalServer } = require('../scripts/local-server.cjs');

async function launch(dataFile, allowLan = false) {
  const server = createLocalServer({ dataFile, allowLan });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    async post(body) {
      const response = await fetch(base + '/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 200);
      return response.json();
    },
    async close() {
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
    }
  };
}

async function environment(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tapin-local-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return path.join(directory, 'tapin.json');
}

test('local website points exclusively to its API v2 backend', async t => {
  const local = await launch(await environment(t));
  t.after(() => local.close());
  const configResponse = await fetch(local.base + '/config.js');
  assert.equal(configResponse.status, 200);
  const sandbox = { window: {} };
  vm.runInNewContext(await configResponse.text(), sandbox);
  assert.equal(sandbox.window.TAPIN_CONFIG.GAS_WEB_APP_URL, local.base + '/api');
  const config = await (await fetch(local.base + '/api?action=publicConfig')).json();
  assert.equal(config.ok, true, config.message);
  assert.equal(config.apiVersion, 2);
  const page = await fetch(local.base + '/?role=admin');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /local/i);
  assert.equal((await fetch(local.base + '/admin.html')).status, 200);
});

function requestAs(base, host, pathname, origin) {
  return new Promise((resolve, reject) => {
    const request = http.get(base + pathname, { headers: { Host: host, ...(origin ? { Origin: origin } : {}) } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
  });
}

test('LAN mode accepts this computer private address and keeps API on the accessed origin', async t => {
  const address = Object.values(os.networkInterfaces()).flat().find(item => !item.internal && item.family === 'IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))?.address;
  if (!address) return t.skip('No private network interface available');
  const local = await launch(await environment(t), true);
  t.after(() => local.close());
  const host = address + ':' + new URL(local.base).port;
  const origin = 'http://' + host;
  const config = await requestAs(local.base, host, '/config.js', origin);
  assert.equal(config.status, 200);
  const sandbox = { window: {} };
  vm.runInNewContext(config.body, sandbox);
  assert.equal(sandbox.window.TAPIN_CONFIG.GAS_WEB_APP_URL, origin + '/api');
  const api = await requestAs(local.base, host, '/api?action=publicConfig', origin);
  assert.equal(api.status, 200);
  assert.equal(JSON.parse(api.body).apiVersion, 2);
  assert.equal((await requestAs(local.base, host, '/api?action=publicConfig', 'https://example.com')).status, 403);
  assert.equal((await requestAs(local.base, 'unrelated.example:' + new URL(local.base).port, '/')).status, 403);
});

test('default local mode continues rejecting non-loopback host headers', async t => {
  const local = await launch(await environment(t));
  t.after(() => local.close());
  const result = await requestAs(local.base, '192.168.50.10:' + new URL(local.base).port, '/');
  assert.equal(result.status, 403);
});

test('real employee workflow and admin credentials survive local server restart', async t => {
  const dataFile = await environment(t);
  let local = await launch(dataFile);
  t.after(() => local.close());
  const session = await local.post({ action: 'employeeResolveSession', deviceUUID: 'local-test-device' });
  assert.equal(session.isRegistered, false);
  const login = await local.post({ action: 'adminLogin', username: 'admin', password: 'test-password' });
  assert.equal(login.ok, true, login.message);
  assert.ok(login.token);
  const saved = await local.post({ action: 'adminSaveEmployee', token: login.token, name: 'Local worker', deviceUUID: 'local-test-device', monthlySalary: 5200, scheduleGroupId: 'mon-sat', reason: 'Initial local acceptance test' });
  assert.equal(saved.ok, true, saved.message);
  assert.ok(saved.employee.employeeId);
  const proof = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\nLocal test proof').toString('base64');
  const leave = await local.post({ action: 'submitLeave', deviceUUID: 'local-test-device', requestId: 'local-sick-proof', requestTimestamp: Date.now(), leaveType: 'sick', startDate: '2099-11-02', endDate: '2099-11-02', dayPart: 'am', reason: 'Local proof upload test', evidenceDataUrl: proof });
  assert.equal(leave.ok, true, leave.message);
  await local.close();
  local = await launch(dataFile);
  const resolved = await local.post({ action: 'employeeResolveSession', deviceUUID: 'local-test-device' });
  assert.equal(resolved.ok, true, resolved.message);
  assert.equal(resolved.isRegistered, true);
  assert.equal(resolved.employeeName, 'Local worker');
  const again = await local.post({ action: 'adminLogin', username: 'admin', password: 'test-password' });
  assert.equal(again.ok, true, again.message);
  const employees = await local.post({ action: 'adminGetEmployees', token: again.token });
  assert.equal(employees.ok, true, employees.message);
  assert.ok(employees.employees.some(employee => employee.employeeId === saved.employee.employeeId));
  const evidence = await local.post({ action: 'adminGetLeaveEvidence', token: again.token, requestId: 'local-sick-proof' });
  assert.equal(evidence.ok, true, evidence.message);
  assert.equal(evidence.dataUrl, proof);
});

test('local backend rejects malformed requests and external origins without exposing local data', async t => {
  const local = await launch(await environment(t));
  t.after(() => local.close());
  const malformed = await fetch(local.base + '/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  const external = await fetch(local.base + '/api', { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'adminLogin', username: 'admin', password: 'test-password' }) });
  assert.equal(external.status, 403);
  const oversized = await fetch(local.base + '/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: 'a'.repeat(8 * 1024 * 1024) }) });
  assert.equal(oversized.status, 413);
  assert.equal((await fetch(local.base + '/missing-file')).status, 404);
  assert.equal((await fetch(local.base + '/.local/tapin.json')).status, 404);
});
