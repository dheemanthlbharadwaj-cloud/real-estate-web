// Local dev server: serves public/ like Firebase Hosting does (clean URLs and the redirects in firebase.json).
//   node dev.js                      -> static site only; js/config.js is used as it is (SHEETS_URL empty = not connected)
//   DEV_FAKE_SHEETS=1 node dev.js    -> also a fake Google Apps Script endpoint at /fake-sheets, and js/config.js
//                                       points SHEETS_URL at it (used by the browser tests). Data lives in memory.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const A = require('./apps-script/Analytics.js');

const ROOT = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const FAKE = process.env.DEV_FAKE_SHEETS === '1';
const hosting = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase.json'), 'utf8')).hosting;

// In-memory stand-in for the Google Sheet: same row layout, same checks, same maths (apps-script/Analytics.js).
const sheet = { rankings: [], shortlists: [], sample: [] };
if (FAKE) {
  const now = new Date().toISOString();
  const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sample_submissions.json'), 'utf8')).submissions;
  sheet.sample = sample.map(s => A.sampleToRow(s, now)).filter(r => r.ok).map(r => r.row);
}
function fakeSheets(req, res, url, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'POST') {
    const p = A.parseSubmission(body, new Date().toISOString());
    if (!p.ok) return res.end(JSON.stringify({ ok: false, error: p.error }));
    if (p.kind === 'ranking') sheet.rankings.push(p.row);
    else {
      const i = sheet.shortlists.findIndex(r => r.user === p.row.user && r.project === p.row.project);
      if (i >= 0) sheet.shortlists[i] = p.row; else sheet.shortlists.push(p.row);
    }
    return res.end(JSON.stringify({ ok: true }));
  }
  if (url.searchParams.get('action') === 'dump') return res.end(JSON.stringify(sheet)); // tests only
  if (url.searchParams.get('action') !== 'analytics' || !A.PROJECT_KEYS.includes(url.searchParams.get('project') || '')) return res.end(JSON.stringify({ ok: false, error: 'unknown action' }));
  res.end(JSON.stringify(A.analyseProject(sheet.rankings, sheet.sample, url.searchParams.get('project'))));
}

function redirectFor(pathname) {
  const r = (hosting.redirects || []).find(x => x.source === pathname);
  return r || null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (FAKE && url.pathname === '/fake-sheets') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    return fakeSheets(req, res, url, Buffer.concat(chunks).toString());
  }
  const redirect = redirectFor(url.pathname);
  if (redirect) { res.statusCode = redirect.type || 302; res.setHeader('Location', redirect.destination); return res.end(); }
  if (FAKE && url.pathname === '/js/config.js') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end("window.MYBTO_CONFIG = { SHEETS_URL: '/fake-sheets' };\n");
  }
  let file = path.normalize(path.join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!path.extname(file) && fs.existsSync(`${file}.html`)) file += '.html'; // clean URLs, as on Firebase Hosting
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log(`dev server on http://localhost:${process.env.PORT || 3000}${FAKE ? ' (fake Google Sheet at /fake-sheets)' : ''}`));
