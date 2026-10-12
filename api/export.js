// POST /api/export  { password, format: 'summary' | 'xlsx' }
// Data dashboard behind ONE shared password (env var ADMIN_PASSWORD). Reads every saved ranking and shortlist
// with the Admin SDK (needs FIREBASE_SERVICE_ACCOUNT) and returns a summary or an Excel workbook.
// Users are shown only by a short anonymous id (first 10 hex characters of sha256(uid)); no emails or raw uids.
const crypto = require('node:crypto');
const ExcelJS = require('exceljs');

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const anonId = uid => sha(uid).toString('hex').slice(0, 10);
const housingOf = t => (String(t).startsWith('2-Room Flexi') ? '2-Room Flexi' : t);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FACTOR_ORDER = ['clearance', 'corner', 'roof', 'chute', 'mrt'];
const CELL_MAX = 30000; // Excel allows 32,767 characters in a cell
const pairs = o => Object.entries(o || {}).map(([k, v]) => `${k}: ${v}`).join('; ');
const when = d => (d ? new Date(d) : null);

// Rows from Firestore (Admin SDK), with timestamps turned into Dates.
async function loadFromFirestore() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    const e = new Error('The dashboard cannot read the database yet: FIREBASE_SERVICE_ACCOUNT is not set on the server.');
    e.status = 503;
    throw e;
  }
  const { db } = require('../lib/firebase');
  const [subSnap, flagSnap] = await Promise.all([db().collection('submissions').get(), db().collection('flags').get()]);
  return {
    submissions: subSnap.docs.map(d => { const s = d.data(); return { ...s, updated_at: s.updated_at?.toDate ? s.updated_at.toDate() : when(s.updated_at) }; }),
    flags: flagSnap.docs.map(d => d.data()),
  };
}

function summarise(submissions) {
  const by = {};
  for (const s of submissions) {
    const p = (by[s.project] = by[s.project] || { project: s.project, rankings: 0, consented: 0, latest: null });
    p.rankings += 1;
    if (s.survey && s.survey.consent) p.consented += 1;
    if (s.updated_at && (!p.latest || s.updated_at > p.latest)) p.latest = s.updated_at;
  }
  const projects = Object.values(by).sort((a, b) => a.project.localeCompare(b.project)).map(p => ({ ...p, latest: p.latest ? p.latest.toISOString() : null }));
  const latest = projects.map(p => p.latest).filter(Boolean).sort().pop() || null;
  return { total: submissions.length, latest_update: latest, projects };
}

// Splits a long id list over several cells so none passes Excel's limit.
function chunkIds(ids) {
  const out = [];
  let cur = '';
  for (const id of ids) {
    if (cur && cur.length + id.length + 2 > CELL_MAX) { out.push(cur); cur = ''; }
    cur += (cur ? ', ' : '') + id;
  }
  out.push(cur);
  return out;
}

async function buildWorkbook({ submissions, flags }) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const subs = [...submissions].sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  const num = new Set(), legacy = new Set();
  for (const s of subs) {
    for (const [k, v] of Object.entries(s.weights || {})) if (typeof v === 'number') num.add(k);
    for (const k of Object.keys(s.survey || {})) if (!['consent', 'consented_at'].includes(k)) legacy.add(k);
  }
  const factors = [...FACTOR_ORDER.filter(k => num.has(k)), ...[...num].filter(k => !FACTOR_ORDER.includes(k)).sort()];
  const legacyKeys = [...legacy].sort();
  const rankChunks = subs.map(s => chunkIds(s.ranking || []));
  const parts = Math.max(1, ...rankChunks.map(c => c.length));

  const ws = wb.addWorksheet('Rankings', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'updated_at', key: 'updated_at', width: 18 }, { header: 'project', key: 'project', width: 24 },
    { header: 'project_type', key: 'project_type', width: 12 }, { header: 'anonymous_user', key: 'user', width: 14 },
    { header: 'housing_types', key: 'housing', width: 18 }, { header: 'blocks', key: 'blocks', width: 22 },
    { header: 'min_storey', key: 'min', width: 11 }, { header: 'max_storey', key: 'max', width: 11 }, { header: 'floor_pref', key: 'pref', width: 11 },
    ...factors.map(k => ({ header: `weight_${k}`, key: `f_${k}`, width: 12 })),
    { header: 'sun_weights', key: 'sun', width: 30 }, { header: 'design_weights', key: 'design', width: 26 },
    { header: 'block_weights', key: 'block', width: 34 }, { header: 'facility_weights', key: 'facility', width: 50 },
    { header: 'consent', key: 'consent', width: 9 }, { header: 'consented_at', key: 'consented_at', width: 18 },
    ...legacyKeys.map(k => ({ header: `survey_${k}`, key: `sv_${k}`, width: 16 })),
    { header: 'units_ranked', key: 'n', width: 12 }, { header: 'top_50_units', key: 'top', width: 40 },
    ...Array.from({ length: parts }, (_, i) => ({ header: parts > 1 ? `full_ranking_part_${i + 1}` : 'full_ranking', key: `rk${i}`, width: 40 })),
  ];
  subs.forEach((s, i) => {
    const w = s.weights || {}, sv = s.survey || {};
    const row = {
      updated_at: s.updated_at || null, project: s.project, project_type: s.project_type, user: anonId(s.uid || s.user_id),
      housing: [...new Set((s.flat_types || []).map(housingOf))].join(', '), blocks: (s.blocks || []).join(', '),
      min: s.min_storey ?? null, max: s.max_storey ?? null, pref: s.floor_pref || 'none',
      sun: pairs(w.sun), design: pairs(w.design), block: pairs(w.block), facility: pairs(w.facility),
      consent: sv.consent ? 'yes' : 'no', consented_at: when(sv.consented_at),
      n: (s.ranking || []).length, top: (s.ranking || []).slice(0, 50).join(', '),
    };
    for (const k of factors) row[`f_${k}`] = typeof w[k] === 'number' ? w[k] : null;
    for (const k of legacyKeys) row[`sv_${k}`] = [].concat(sv[k] ?? []).join(', ');
    rankChunks[i].forEach((c, j) => { row[`rk${j}`] = c; });
    ws.addRow(row);
  });
  ws.getRow(1).font = { bold: true };
  ws.getColumn('updated_at').numFmt = 'yyyy-mm-dd hh:mm';
  ws.getColumn('consented_at').numFmt = 'yyyy-mm-dd hh:mm';

  const sl = wb.addWorksheet('Shortlists', { views: [{ state: 'frozen', ySplit: 1 }] });
  sl.columns = [{ header: 'anonymous_user', key: 'u', width: 14 }, { header: 'project', key: 'p', width: 24 }, { header: 'position', key: 'pos', width: 10 }, { header: 'unit_id', key: 'id', width: 22 }];
  for (const f of flags) (f.unit_ids || []).forEach((id, i) => sl.addRow({ u: anonId(f.uid || f.user_id), p: f.project, pos: i + 1, id }));
  sl.getRow(1).font = { bold: true };

  const rm = wb.addWorksheet('Read me');
  rm.columns = [{ header: 'Column or sheet', key: 'c', width: 28 }, { header: 'Meaning', key: 'm', width: 100 }];
  const notes = [
    ['Rankings', 'One row per saved ranking (one per person per project; a new ranking replaces the old one).'],
    ['updated_at', 'When the ranking was last saved (UTC).'],
    ['project, project_type', 'The BTO project and its type (Prime, Plus or Standard).'],
    ['anonymous_user', 'First 10 characters of a one-way hash of the browser user id. The same person has the same code in every sheet. It cannot be turned back into an identity.'],
    ['housing_types', 'The housing type searched. 2-Room Flexi covers Type 1 and Type 2.'],
    ['blocks', 'Blocks included in the search.'],
    ['min_storey, max_storey', 'Lowest and highest storey included in the search.'],
    ['floor_pref', 'Floor priority: higher, lower or none.'],
    ['weight_<factor>', 'Importance of that factor, from -5 (avoid) to +5 (must have). Empty if the factor was not shown for that search.'],
    ['sun_weights, design_weights, block_weights, facility_weights', 'Importance per item, written as "name: value" and separated by semicolons.'],
    ['consent, consented_at', 'Whether the person agreed to the research notice before the ranking was shown, and when.'],
    ['survey_<question>', 'Answers to the earlier 10 question survey. Only present for rankings saved before the survey was removed.'],
    ['units_ranked', 'How many units matched the filters (the full ranking).'],
    ['top_50_units', 'Unit ids of the 50 best ranked units, best first.'],
    ['full_ranking', 'Every matching unit id in ranked order, best first. Long lists continue in the next full_ranking_part column.'],
    ['Shortlists', 'One row per starred unit: anonymous_user, project, position in the shortlist (1 is the first pick) and unit id.'],
  ];
  notes.forEach(([c, m]) => rm.addRow({ c, m }));
  rm.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
}

// deps are injectable so the local dev server can run without Firebase.
const makeHandler = ({ getPassword, load }) => async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const expected = getPassword();
  if (!expected) return res.status(503).json({ error: 'Dashboard not set up' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const ok = typeof body.password === 'string' && crypto.timingSafeEqual(sha(body.password), sha(expected));
  if (!ok) { await sleep(1000); return res.status(401).json({ error: 'Wrong password' }); }
  try {
    const data = await load();
    if (body.format === 'xlsx') {
      const buf = Buffer.from(await buildWorkbook(data));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="mybto-rankings-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      return res.status(200).send(buf);
    }
    return res.status(200).json(summarise(data.submissions));
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Could not read the data' });
  }
};

module.exports = makeHandler({ getPassword: () => process.env.ADMIN_PASSWORD, load: loadFromFirestore });
module.exports.makeHandler = makeHandler;
