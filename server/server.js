const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { open } = require('./db');
const { analyse } = require('./analysis');

const ROOT = path.join(__dirname, '..');
const UNITS_DIR = path.join(ROOT, 'data', 'units');
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
// Without a mail service, verification links are returned in the API response in dev mode
// and always written to the server log.
const DEV = process.env.NODE_ENV !== 'production';

function loadProjects() {
  const index = JSON.parse(fs.readFileSync(path.join(UNITS_DIR, 'index.json'), 'utf8'));
  const meta = {};
  for (const p of index.projects) meta[p.key] = { type: p.project_type, maxStorey: p.max_storey, name: p.name };
  return { index, meta };
}

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}

function createApp(db = open()) {
  const { index, meta } = loadProjects();
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // --- auth helpers ---
  function currentUser(req) {
    const m = /(?:^|;\s*)sid=([a-f0-9]{64})/.exec(req.headers.cookie || '');
    if (!m) return null;
    return db.prepare('SELECT u.id, u.email, u.verified, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(m[1]) || null;
  }
  function requireUser(req, res, next) {
    const u = currentUser(req);
    if (!u) return res.status(401).json({ error: 'Please log in' });
    req.user = u;
    next();
  }
  function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`);
  }
  const knownProject = key => Object.prototype.hasOwnProperty.call(meta, key);

  // --- accounts ---
  app.post('/api/register', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email already registered' });
    const { salt, hash } = hashPassword(password);
    const token = crypto.randomBytes(24).toString('hex');
    const r = db.prepare('INSERT INTO users (email, pw_hash, pw_salt, verify_token, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(email, hash, salt, token, ADMIN_EMAILS.includes(email) ? 1 : 0);
    const link = `/api/verify?token=${token}`;
    console.log(`[verify] ${email}: ${link}`);
    startSession(res, Number(r.lastInsertRowid));
    res.json({ ok: true, ...(DEV ? { verify_link: link } : {}) });
  });

  app.get('/api/verify', (req, res) => {
    const r = db.prepare('UPDATE users SET verified = 1, verify_token = NULL WHERE verify_token = ?').run(String(req.query.token || ''));
    res.redirect(r.changes ? '/#account?verified=1' : '/#account?verified=0');
  });

  app.post('/api/login', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const u = db.prepare('SELECT id, pw_hash, pw_salt FROM users WHERE email = ?').get(email);
    const ok = u && crypto.timingSafeEqual(Buffer.from(hashPassword(String(req.body.password || ''), u.pw_salt).hash, 'hex'), Buffer.from(u.pw_hash, 'hex'));
    if (!ok) return res.status(401).json({ error: 'Wrong email or password' });
    startSession(res, u.id);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    const m = /(?:^|;\s*)sid=([a-f0-9]{64})/.exec(req.headers.cookie || '');
    if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m[1]);
    res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => res.json({ user: currentUser(req) }));

  app.post('/api/admin/verify', requireUser, (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admins only' });
    const r = db.prepare('UPDATE users SET verified = ? WHERE email = ?').run(req.body.verified === false ? 0 : 1, String(req.body.email || '').toLowerCase());
    res.json({ ok: r.changes === 1 });
  });

  // --- data ---
  app.get('/api/projects', (req, res) => res.json(index));
  app.get('/api/units/:project', (req, res) => {
    if (!knownProject(req.params.project)) return res.status(404).json({ error: 'Unknown project' });
    res.sendFile(path.join(UNITS_DIR, `${req.params.project}.json`));
  });

  // --- saved list (one per user per project) ---
  app.get('/api/lists/:project', requireUser, (req, res) => {
    const row = db.prepare('SELECT * FROM submissions WHERE user_id = ? AND project = ?').get(req.user.id, req.params.project);
    res.json({ list: row ? parseSub(row) : null });
  });

  app.put('/api/lists/:project', requireUser, (req, res) => {
    const project = req.params.project;
    if (!knownProject(project)) return res.status(404).json({ error: 'Unknown project' });
    const b = req.body || {};
    const intOrNull = v => (v === null || v === undefined || v === '' ? null : Number.isInteger(+v) ? +v : NaN);
    const minS = intOrNull(b.min_storey), maxS = intOrNull(b.max_storey);
    if (Number.isNaN(minS) || Number.isNaN(maxS)) return res.status(400).json({ error: 'Storeys must be whole numbers' });
    if (!['none', 'higher', 'lower', 'middle'].includes(b.floor_pref)) return res.status(400).json({ error: 'Invalid floor preference' });
    const arr = v => (Array.isArray(v) ? v.map(String) : []);
    db.prepare(`INSERT INTO submissions (user_id, project, project_type, queue_number, flat_types, blocks, min_storey, max_storey, floor_pref, opposite_gt30, weights, ranked_ids, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT (user_id, project) DO UPDATE SET project_type = excluded.project_type, queue_number = excluded.queue_number,
        flat_types = excluded.flat_types, blocks = excluded.blocks, min_storey = excluded.min_storey, max_storey = excluded.max_storey,
        floor_pref = excluded.floor_pref, opposite_gt30 = excluded.opposite_gt30, weights = excluded.weights, ranked_ids = excluded.ranked_ids, updated_at = excluded.updated_at`)
      .run(req.user.id, project, meta[project].type, b.queue_number ? String(b.queue_number).slice(0, 40) : null,
        JSON.stringify(arr(b.flat_types)), JSON.stringify(arr(b.blocks)), minS, maxS, b.floor_pref, b.opposite_gt30 ? 1 : 0,
        JSON.stringify(sanitiseWeights(b.weights)), JSON.stringify(arr(b.ranked_ids).slice(0, 2000)));
    res.json({ ok: true });
  });

  // --- flagged units (ordered) ---
  app.get('/api/flags/:project', requireUser, (req, res) => {
    const rows = db.prepare('SELECT unit_id FROM flags WHERE user_id = ? AND project = ? ORDER BY position').all(req.user.id, req.params.project);
    res.json({ unit_ids: rows.map(r => r.unit_id) });
  });

  app.put('/api/flags/:project', requireUser, (req, res) => {
    if (!knownProject(req.params.project)) return res.status(404).json({ error: 'Unknown project' });
    const ids = [...new Set((Array.isArray(req.body.unit_ids) ? req.body.unit_ids : []).map(String))].slice(0, 500);
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM flags WHERE user_id = ? AND project = ?').run(req.user.id, req.params.project);
      const ins = db.prepare('INSERT INTO flags (user_id, project, unit_id, position) VALUES (?, ?, ?, ?)');
      ids.forEach((id, i) => ins.run(req.user.id, req.params.project, id, i));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    res.json({ ok: true });
  });

  // --- analysis ---
  // Analysis is for verified users only.
  app.get('/api/analysis', requireUser, (req, res) => {
    if (!req.user.verified) return res.status(403).json({ error: 'Verify your email to unlock Analysis', code: 'unverified' });
    const group = ['all', 'flat_type', 'project', 'project_type'].includes(req.query.group) ? req.query.group : 'all';
    const subs = db.prepare('SELECT s.*, u.verified, u.is_sample FROM submissions s JOIN users u ON u.id = s.user_id').all().map(parseSub);
    const flags = db.prepare('SELECT user_id, project, unit_id FROM flags').all();
    res.json(analyse(subs, meta, flags, group, req.query.value || null));
  });

  app.use('/vendor/chart.js', express.static(path.join(ROOT, 'node_modules', 'chart.js', 'dist')));
  app.use('/data', express.static(path.join(ROOT, 'data', 'public')));
  app.use(express.static(path.join(ROOT, 'public')));
  return app;
}

function parseSub(r) {
  return { ...r, verified: !!r.verified, opposite_gt30: !!r.opposite_gt30, flat_types: JSON.parse(r.flat_types), blocks: JSON.parse(r.blocks), weights: JSON.parse(r.weights), ranked_ids: JSON.parse(r.ranked_ids) };
}

// Keep only numeric importances clamped to -5..5.
function sanitiseWeights(w) {
  const clamp = v => Math.max(-5, Math.min(5, Math.round(Number(v))));
  const out = {};
  for (const [k, v] of Object.entries(w || {})) {
    if (v && typeof v === 'object') {
      if (!['block', 'sun', 'design'].includes(k)) continue;
      out[k] = {};
      for (const [k2, v2] of Object.entries(v)) if (Number.isFinite(Number(v2))) out[k][String(k2).slice(0, 40)] = clamp(v2);
    } else if (['lift', 'clearance', 'corner', 'roof', 'chute', 'mrt', 'facilities'].includes(k) && Number.isFinite(Number(v))) {
      out[k] = clamp(v);
    }
  }
  return out;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const db = open();
  // Sample analysis data until real users arrive; set SEED_SAMPLE=0 to disable.
  if (process.env.SEED_SAMPLE !== '0') {
    const n = require('./seed_sample').seed(db);
    if (n) console.log(`seeded ${n} sample users`);
  }
  createApp(db).listen(port, () => console.log(`BTO unit ranker on http://localhost:${port}`));
}

module.exports = { createApp, sanitiseWeights };
