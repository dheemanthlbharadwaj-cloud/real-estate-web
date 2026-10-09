// Local dev server: serves public/ and the /api functions (same handlers Vercel runs).
//   node dev.js                 -> uses the real Firebase project from your env vars (.env.local)
//   DEV_FAKE_FIREBASE=1 node dev.js -> no Firebase needed: /api/analysis accepts the token "fake-verified"
//                                      and uses only the sample data (used by the browser tests).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const FAKE = process.env.DEV_FAKE_FIREBASE === '1';

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^'(.*)'$/, '$1');
  }
}

const analysis = require('./api/analysis');
const handlers = {
  '/api/config': FAKE ? (req, res) => res.status(200).json({ apiKey: 'fake', authDomain: 'fake', projectId: 'fake', appId: 'fake' }) : require('./api/config'),
  '/api/analysis': FAKE
    ? analysis.makeHandler({
      verifyToken: async t => { if (!t.startsWith('fake-')) throw new Error('bad token'); return { email_verified: t === 'fake-verified' }; },
      load: async () => { const s = analysis.sampleData(); return { subs: s.submissions, flags: s.flags }; },
    })
    : analysis,
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (handlers[url.pathname]) {
    req.query = Object.fromEntries(url.searchParams);
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    return handlers[url.pathname](req, res);
  }
  const file = path.normalize(path.join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log(`dev server on http://localhost:${process.env.PORT || 3000}${FAKE ? ' (fake Firebase)' : ''}`));
