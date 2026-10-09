// GET /api/analysis?group=all|flat_type|project|project_type&value=...
// Requires a Firebase ID token (Authorization: Bearer <token>) from a user whose email is verified.
const fs = require('node:fs');
const path = require('node:path');
const { auth, db } = require('../lib/firebase');
const { analyse } = require('../lib/analysis');
const { verifyIdToken } = require('../lib/verify-token');

const GROUPS = ['all', 'flat_type', 'project', 'project_type'];
const CACHE_MS = 60 * 1000;
let cache = { at: 0, data: null };

function projectMeta() {
  const { projects } = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'data', 'units', 'index.json'), 'utf8'));
  return Object.fromEntries(projects.map(p => [p.key, { type: p.project_type, maxStorey: p.max_storey, name: p.name }]));
}

function sampleData() {
  if (process.env.SAMPLE_ANALYSIS === '0') return { submissions: [], flags: [] };
  return require('../lib/sample_submissions.json');
}

// All saved lists + flags, with each submitter's current email-verification status.
async function loadAll() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  const [subSnap, flagSnap] = await Promise.all([db().collection('submissions').get(), db().collection('flags').get()]);
  const subs = subSnap.docs.map(d => d.data());
  const uids = [...new Set(subs.map(s => s.uid))];
  const verified = new Set();
  for (let i = 0; i < uids.length; i += 100) {
    const r = await auth().getUsers(uids.slice(i, i + 100).map(uid => ({ uid })));
    r.users.forEach(u => { if (u.emailVerified) verified.add(u.uid); });
  }
  const real = subs.map(s => ({
    user_id: s.uid, verified: verified.has(s.uid), is_sample: false, project: s.project, project_type: s.project_type,
    queue_number: s.queue_number || null, flat_types: s.flat_types || [], blocks: s.blocks || [],
    min_storey: s.min_storey ?? null, max_storey: s.max_storey ?? null, floor_pref: s.floor_pref || 'none',
    opposite_gt30: !!s.opposite_gt30, weights: s.weights || {},
  }));
  const realFlags = flagSnap.docs.flatMap(d => {
    const f = d.data();
    return (f.unit_ids || []).map(unit_id => ({ user_id: f.uid, project: f.project, unit_id }));
  });
  const sample = sampleData();
  cache = { at: Date.now(), data: { subs: [...real, ...sample.submissions], flags: [...realFlags, ...sample.flags] } };
  return cache.data;
}

// deps are injectable so the local dev server can run without a Firebase project.
const makeHandler = ({ verifyToken, load }) => async (req, res) => {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ error: 'Please sign in' });
  let user;
  try { user = await verifyToken(token); } catch { return res.status(401).json({ error: 'Session expired, please sign in again' }); }
  if (!user.email_verified) return res.status(403).json({ error: 'Verify your email to unlock Analysis', code: 'unverified' });
  const group = GROUPS.includes(req.query.group) ? req.query.group : 'all';
  try {
    const { subs, flags } = await load();
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json(analyse(subs, projectMeta(), flags, group, req.query.value || null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not compute analysis' });
  }
};

// With a service account: real saved lists from Firestore plus the sample. Without one: tokens are
// still verified (against Google's public certificates) and the sample data is shown on its own.
const HAS_ADMIN = !!process.env.FIREBASE_SERVICE_ACCOUNT;
const sampleOnly = async () => { const s = sampleData(); return { subs: s.submissions, flags: s.flags }; };
module.exports = makeHandler({
  verifyToken: t => (HAS_ADMIN ? auth().verifyIdToken(t) : verifyIdToken(t, process.env.FIREBASE_PROJECT_ID)),
  load: HAS_ADMIN ? loadAll : sampleOnly,
});
module.exports.makeHandler = makeHandler;
module.exports.sampleData = sampleData;
