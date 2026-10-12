// GET /api/analysis?group=all|flat_type|project|project_type&value=...
// Requires a Firebase ID token (Authorization: Bearer <token>); anonymous users are fine.
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

// All saved rankings. A ranking counts once its owner has agreed to the research consent note.
async function loadAll() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  const subSnap = await db().collection('submissions').get();
  const real = subSnap.docs.map(d => d.data()).map(s => ({
    user_id: s.uid, surveyed: !!(s.survey && s.survey.consent), survey: s.survey || null, is_sample: false, project: s.project, project_type: s.project_type,
    flat_types: s.flat_types || [], blocks: s.blocks || [],
    min_storey: s.min_storey ?? null, max_storey: s.max_storey ?? null, floor_pref: s.floor_pref || 'none',
    weights: s.weights || {},
  }));
  cache = { at: Date.now(), data: { subs: [...real, ...sampleData().submissions] } };
  return cache.data;
}

// deps are injectable so the local dev server can run without a Firebase project.
const makeHandler = ({ verifyToken, load }) => async (req, res) => {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ error: 'Please sign in' });
  let user;
  try { user = await verifyToken(token); } catch { return res.status(401).json({ error: 'Session expired, please sign in again' }); }
  const group = GROUPS.includes(req.query.group) ? req.query.group : 'all';
  try {
    const { subs } = await load();
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json(analyse(subs, projectMeta(), group, req.query.value || null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not compute analysis' });
  }
};

// With a service account: real saved lists from Firestore plus the sample. Without one: tokens are
// still verified (against Google's public certificates) and the sample data is shown on its own.
const HAS_ADMIN = !!process.env.FIREBASE_SERVICE_ACCOUNT;
const sampleOnly = async () => ({ subs: sampleData().submissions });
module.exports = makeHandler({
  verifyToken: t => (HAS_ADMIN ? auth().verifyIdToken(t) : verifyIdToken(t, process.env.FIREBASE_PROJECT_ID)),
  load: HAS_ADMIN ? loadAll : sampleOnly,
});
module.exports.makeHandler = makeHandler;
module.exports.sampleData = sampleData;
