const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { createGas } = require('../tests/helpers/gas');

const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'web');
const bodyLimit = 8 * 1024 * 1024;

function lanAddresses() {
  return Array.from(new Set(Object.values(os.networkInterfaces()).flat().filter(item => !item.internal && item.family === 'IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address)).map(item => item.address)));
}

function createLocalServer({ dataFile = path.join(root, '.local/tapin.json'), allowLan = false } = {}) {
  const saved = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : null;
  const gas = createGas(saved?.sheets || {});
  if (saved?.properties) Object.assign(gas.properties, saved.properties);
  gas.properties.TAPIN_SPREADSHEET_ID = 'local-testing';
  const proofs = saved?.proofs || {};
  const blob = (bytes, contentType, name) => ({
    getBytes: () => Array.from(bytes), getContentType: () => contentType, getName: () => name,
  });
  gas.context.Utilities.newBlob = blob;
  gas.context.DriveApp = {
    createFile(value) {
      const id = crypto.randomUUID();
      proofs[id] = { content: Buffer.from(value.getBytes()).toString('base64'), contentType: value.getContentType(), name: value.getName() };
      return { getUrl: () => '/local-drive/d/' + id + '/view' };
    },
    getFileById(id) {
      const proof = proofs[id];
      if (!proof) throw new Error('Local proof file not found');
      return { getName: () => proof.name, getBlob: () => blob(Buffer.from(proof.content, 'base64'), proof.contentType, proof.name) };
    },
  };

  function persist() {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true, mode: 0o700 });
    const temporary = dataFile + '.tmp';
    const data = { sheets: Object.fromEntries(Array.from(gas.sheets, ([name, sheet]) => [name, sheet.data])), properties: gas.properties, proofs };
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, dataFile);
  }

  if (!saved) {
    const initialized = gas.admin({ action: 'adminApplyMigration', mappings: [] });
    if (!initialized.ok) throw new Error(initialized.message);
    persist();
  }

  function json(response, status, body) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(body));
  }

  function readBody(request) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      request.on('data', chunk => {
        size += chunk.length;
        if (size > bodyLimit) {
          reject(Object.assign(new Error('Request must be at most 8 MB'), { status: 413 }));
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => { if (size <= bodyLimit) resolve(Buffer.concat(chunks).toString('utf8')); });
      request.on('error', reject);
    });
  }

  const server = http.createServer(async (request, response) => {
    try {
      const allowedHosts = ['localhost:' + request.socket.localPort, '127.0.0.1:' + request.socket.localPort];
      if (allowLan) allowedHosts.push(...lanAddresses().map(address => address + ':' + request.socket.localPort));
      if (!allowedHosts.includes(request.headers.host)) return json(response, 403, { ok: false, message: 'This test server accepts only its enabled local addresses' });
      const origin = 'http://' + request.headers.host;
      if (request.headers.origin && request.headers.origin !== origin) return json(response, 403, { ok: false, message: 'Cross-origin access to local test data is not allowed' });
      const url = new URL(request.url, origin);
      if (url.pathname === '/api') {
        if (request.method === 'GET') {
          const output = gas.context.doGet({ parameter: Object.fromEntries(url.searchParams) });
          return json(response, 200, { ...JSON.parse(output.getContent()), environment: 'local', googleServices: false });
        }
        if (request.method !== 'POST') return json(response, 405, { ok: false, message: 'Use GET or POST' });
        let payload;
        try { payload = JSON.parse(await readBody(request)); }
        catch (error) { return json(response, error.status || 400, { ok: false, message: error.status ? error.message : 'Body must be valid JSON' }); }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json(response, 400, { ok: false, message: 'Body must be a JSON object' });
        const result = gas.post(payload);
        // Persist even a failed request: audit, login guards, or partial writes may have changed state.
        persist();
        return json(response, 200, result);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { ok: false, message: 'Use GET for website files' });
      if (url.pathname === '/config.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        return response.end('window.TAPIN_CONFIG = ' + JSON.stringify({ GAS_WEB_APP_URL: origin + '/api', DEFAULT_OFFICE_STATIC_IP: '203.0.113.10', MAX_GPS_ACCURACY_METERS: 120 }) + ';\n');
      }
      const file = path.resolve(webRoot, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(webRoot + path.sep)) return json(response, 404, { ok: false, message: 'File not found' });
      let data;
      try { data = fs.readFileSync(file); } catch (error) { if (error.code === 'ENOENT' || error.code === 'EISDIR') return json(response, 404, { ok: false, message: 'File not found' }); throw error; }
      if (path.basename(file) === 'index.html') data = Buffer.from(data.toString().replace('<main ', '<details class="local-notice"><summary>Local test mode</summary><p>Data stays on this computer. Google services are simulated.</p><p>Admin: admin / test-password</p></details>\n    <main '));
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
      response.writeHead(200, { 'Content-Type': (mime[path.extname(file)] || 'application/octet-stream') + (['.html', '.js', '.css'].includes(path.extname(file)) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      console.error('Local test server:', error.message);
      if (!response.headersSent) json(response, 500, { ok: false, message: 'The local test server could not complete the request. Check its terminal output.' });
      else response.end();
    }
  });
  server.requestTimeout = 30000;
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  const allowLan = process.argv.includes('--lan');
  const server = createLocalServer({ dataFile: process.env.TAPIN_LOCAL_DATA_FILE || undefined, allowLan });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, allowLan ? '0.0.0.0' : '127.0.0.1', () => {
    console.log('TapIn local test: http://localhost:' + port + '/?role=admin');
    if (allowLan) lanAddresses().forEach(address => console.log('TapIn LAN test: http://' + address + ':' + port + '/?role=admin'));
    console.log('Admin: admin / test-password. Google services are simulated; no production data is used.');
  });
}

module.exports = { createLocalServer };
