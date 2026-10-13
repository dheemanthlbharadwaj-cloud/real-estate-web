// MyBTO pure logic: row layout, input checks and the analytics maths.
// Single source of truth. It runs in BOTH places:
//   - Google Apps Script: paste it as a file called Analytics.gs (all files share one global scope)
//   - Node: tests and dev.js use require('./apps-script/Analytics.js')
// No Apps Script or Node APIs are used in here.

const FACTOR_KEYS = ['clearance', 'corner', 'roof', 'chute', 'mrt', 'mscp', 'wind_facing', 'wind_open'];
const LIST_FIELDS = ['sun', 'design', 'block', 'facility']; // weight groups stored as readable "name: value" lists
const FULL_RANKING_COLUMNS = 4; // full_ranking, full_ranking_2 ... (a Sheets cell holds at most 50,000 characters)
const CELL_LIMIT = 49000;
const MAX_BODY_BYTES = 200 * 1024;
const MAX_UNITS = 5000;
const PROJECT_RE = /^[a-z0-9][a-z0-9_-]{1,60}$/;
// The only projects the site has (keys of public/data/units/index.json). Anything else is rejected before any sheet is touched.
const PROJECT_KEYS = ['kebun-baru_breeze-5', 'kebun-baru_ridge-1', 'berlayar-rise-7', 'lakeview-cascadia-2', 'sembawang-brook-6', 'sembawang-portico-4', 'woodgrove-acres-3'];
const MIN_ANALYTICS_USERS = 5; // below this the Analytics page would show one person's choices, so it gets nothing
const USER_RE = /^[A-Za-z][A-Za-z0-9_-]{7,63}$/; // starts with a letter so Sheets never turns it into a number
const UNIT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/; // starts with an alphanumeric, like the PROJECT and USER checks
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 '\/&().-]{0,59}$/; // block, direction, design and facility names
const FLOOR_PREFS = ['none', 'higher', 'lower'];

const RANKING_COLUMNS = ['received_at', 'user', 'project', 'project_type', 'housing_type', 'blocks', 'min_storey', 'max_storey', 'floor_pref']
  .concat(FACTOR_KEYS.map(k => `weight_${k}`))
  .concat(['sun_weights', 'design_weights', 'block_weights', 'facility_weights', 'consent', 'consented_at', 'units_ranked', 'top50'])
  .concat(Array.from({ length: FULL_RANKING_COLUMNS }, (_, i) => (i ? `full_ranking_${i + 1}` : 'full_ranking')));
const SHORTLIST_COLUMNS = ['user', 'project', 'updated_at', 'unit_ids'];
// Analytics reads only these Rankings columns (everything up to "consent"), never top50 / full_ranking.
const ANALYTICS_COLUMNS = RANKING_COLUMNS.slice(0, RANKING_COLUMNS.indexOf('consent') + 1);

// ---------------------------------------------------------------- input checks
// A cell that starts with = + - @ could be read as a formula, so such text gets a leading apostrophe.
function safeText(s) { s = String(s == null ? '' : s); return /^[=+\-@]/.test(s) ? `'${s}` : s; }
function fail(msg) { return { ok: false, error: msg }; }
function intIn(v, lo, hi) { return Number.isInteger(v) && v >= lo && v <= hi ? v : null; }
// Largest value of a list (never spreads the list into arguments, which breaks on very large arrays). Empty list gives `floor`.
function maxOf(xs, floor = 0) { return xs.reduce((m, x) => (x > m ? x : m), floor); }
// Size of a string once encoded as UTF-8 (what actually crosses the wire), without Buffer or Utilities.
function utf8Bytes(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) { n += 4; i++; }
    else n += 3;
  }
  return n;
}
// Checks shared by rankings and shortlists. Returns {user, project} (both real strings) or {error}.
function userAndProject(b) {
  if (typeof b.project !== 'string' || !PROJECT_KEYS.includes(b.project)) return { error: 'bad project' };
  if (typeof b.user !== 'string' || !USER_RE.test(b.user)) return { error: 'bad user' };
  return { user: b.user, project: b.project };
}

// Returns {ok:true, row:{column: value}} or {ok:false, error}. `now` is an ISO string chosen by the server.
function rankingToRow(b, now) {
  if (!b || typeof b !== 'object') return fail('bad body');
  const up = userAndProject(b);
  if (up.error) return fail(up.error);
  if (b.consent !== true) return fail('consent required');
  const type = String(b.project_type || '');
  if (!['Prime', 'Plus', 'Standard'].includes(type)) return fail('bad project_type');
  const housing = String(b.housing_type || '');
  if (!NAME_RE.test(housing)) return fail('bad housing_type');
  const blocks = Array.isArray(b.blocks) ? b.blocks : null;
  if (!blocks || blocks.length > 60 || !blocks.every(x => NAME_RE.test(String(x)))) return fail('bad blocks');
  const minS = intIn(b.min_storey, 0, 100), maxS = intIn(b.max_storey, 0, 100);
  if (minS == null || maxS == null) return fail('bad storey');
  if (!FLOOR_PREFS.includes(b.floor_pref)) return fail('bad floor_pref');
  const w = b.weights;
  if (!w || typeof w !== 'object') return fail('bad weights');
  const ids = Array.isArray(b.ranking) ? b.ranking : null;
  if (!ids || ids.length > MAX_UNITS || !ids.every(x => UNIT_RE.test(String(x)))) return fail('bad ranking');
  const consentedAt = Date.parse(b.consented_at);

  const row = { received_at: now, user: up.user, project: up.project, project_type: type, housing_type: safeText(housing), blocks: blocks.map(safeText).join(', '),
    min_storey: minS, max_storey: maxS, floor_pref: b.floor_pref };
  for (const k of FACTOR_KEYS) {
    const v = w[k] == null ? '' : intIn(w[k], -5, 5);
    if (v == null) return fail(`bad weight ${k}`);
    row[`weight_${k}`] = v;
  }
  for (const g of LIST_FIELDS) {
    const obj = w[g] == null ? {} : w[g];
    if (typeof obj !== 'object' || Array.isArray(obj)) return fail(`bad ${g} weights`);
    const entries = Object.entries(obj);
    if (entries.length > 80) return fail(`too many ${g} weights`);
    const parts = [];
    for (const [name, v] of entries) {
      if (!NAME_RE.test(name) || intIn(v, -5, 5) == null) return fail(`bad ${g} weight`);
      parts.push(`${name}: ${v}`);
    }
    row[`${g}_weights`] = parts.join('; ');
  }
  row.consent = true;
  row.consented_at = Number.isNaN(consentedAt) ? '' : new Date(consentedAt).toISOString();
  row.units_ranked = ids.length;
  row.top50 = ids.slice(0, 50).join(', ');
  const full = ids.join(', ');
  for (let i = 0; i < FULL_RANKING_COLUMNS; i++) row[i ? `full_ranking_${i + 1}` : 'full_ranking'] = full.slice(i * CELL_LIMIT, (i + 1) * CELL_LIMIT);
  return { ok: true, row };
}

function shortlistToRow(b, now) {
  if (!b || typeof b !== 'object') return fail('bad body');
  const up = userAndProject(b);
  if (up.error) return fail(up.error);
  const ids = Array.isArray(b.unit_ids) ? b.unit_ids : null;
  if (!ids || ids.length > 500 || !ids.every(x => UNIT_RE.test(String(x)))) return fail('bad unit_ids');
  return { ok: true, row: { user: up.user, project: up.project, updated_at: now, unit_ids: ids.join(', ') } };
}

// Parses a raw request body string. Returns {ok:true, kind:'ranking'|'shortlist', row} or {ok:false, error}.
function parseSubmission(text, now) {
  if (typeof text !== 'string' || !text.length) return fail('empty body');
  if (text.length > MAX_BODY_BYTES || utf8Bytes(text) > MAX_BODY_BYTES) return fail('body too large');
  let b;
  try { b = JSON.parse(text); } catch (e) { return fail('bad json'); }
  if (!b || typeof b !== 'object') return fail('bad body');
  if (b.type === 'ranking') { const r = rankingToRow(b, now); return r.ok ? { ok: true, kind: 'ranking', row: r.row } : r; }
  if (b.type === 'shortlist') { const r = shortlistToRow(b, now); return r.ok ? { ok: true, kind: 'shortlist', row: r.row } : r; }
  return fail('unknown type');
}

// A sample user (public/data/sample_submissions.json) in the same row layout as a real ranking.
function sampleToRow(s, now) {
  const w = s.weights || {};
  const body = { project: s.project, user: s.user_id, project_type: s.project_type, housing_type: (s.flat_types || [])[0] ? housingOf(s.flat_types[0]) : 'Any',
    blocks: s.blocks || [], min_storey: s.min_storey, max_storey: s.max_storey, floor_pref: s.floor_pref, weights: w, consent: true, consented_at: now, ranking: [] };
  // sample user ids look like "sample-001": pad so they pass the same id check as real ones
  body.user = String(body.user).padEnd(8, '_');
  return rankingToRow(body, now);
}

// ---------------------------------------------------------------- reading rows back
function parseList(text) {
  const out = {};
  for (const part of String(text || '').split(';')) {
    const i = part.lastIndexOf(': ');
    if (i < 1) continue;
    const v = Number(part.slice(i + 2));
    if (Number.isFinite(v)) out[part.slice(0, i).trim()] = v;
  }
  return out;
}

// obj: one sheet row as {column: value}. Returns the shape analyse() works on.
function rowToSub(obj) {
  const weights = {};
  for (const k of FACTOR_KEYS) { const v = obj[`weight_${k}`]; if (v !== '' && v != null && Number.isFinite(Number(v))) weights[k] = Number(v); }
  for (const g of LIST_FIELDS) weights[g] = parseList(obj[`${g}_weights`]);
  const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const housing = String(obj.housing_type || '');
  return { user_id: String(obj.user), project: String(obj.project), project_type: String(obj.project_type || ''),
    flat_types: housing && housing !== 'Any' ? [housing] : [], blocks: String(obj.blocks || '').split(',').map(x => x.trim()).filter(Boolean),
    min_storey: num(obj.min_storey), max_storey: num(obj.max_storey), floor_pref: String(obj.floor_pref || 'none'), weights,
    surveyed: obj.consent === true || String(obj.consent).toUpperCase() === 'TRUE' };
}

// Keeps the last row of each user+project (rows are in the order they were added).
function latestPerUser(subs) {
  const m = new Map();
  for (const s of subs) m.set(`${s.user_id}|${s.project}`, s);
  return [...m.values()];
}

// ---------------------------------------------------------------- maths
const housingOf = t => (String(t).startsWith('2-Room Flexi') ? '2-Room Flexi' : t);
const housingOfList = s => [...new Set((s.flat_types || []).map(housingOf))];

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
function std(xs) {
  if (xs.length < 2) return xs.length ? 0 : null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
function logChoose(n, k) {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}
function binomPmf(n, p, k) {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

// Empirical histogram of storeys plus a binomial fit B(n, p) with n = highest storey
// in scope and p = mean / n (method of moments on the mean).
function storeyDistribution(values, n) {
  const m = mean(values);
  const out = { count: values.length, mean: m, std: std(values), n, p: null, binomial_std: null, histogram: [], binomial_expected: [] };
  if (!values.length || !n) return out;
  const p = Math.min(1, m / n);
  out.p = p;
  out.binomial_std = Math.sqrt(n * p * (1 - p));
  for (let k = 0; k <= n; k++) {
    out.histogram.push(values.filter(v => v === k).length);
    out.binomial_expected.push(values.length * binomPmf(n, p, k));
  }
  return out;
}

function rankAverages(objs) {
  const acc = {};
  for (const o of objs) for (const [k, v] of Object.entries(o || {})) {
    if (typeof v !== 'number') continue;
    (acc[k] = acc[k] || []).push(v);
  }
  return Object.entries(acc)
    .map(([key, xs]) => ({ key, mean: mean(xs), std: std(xs), n: xs.length }))
    .sort((a, b) => b.mean - a.mean || (a.key < b.key ? -1 : 1));
}

// Share of users who want (weight > 0), are neutral (0) or avoid (< 0) each item. n counts users who set that item.
function weightShares(objs, keys) {
  const out = {};
  const names = keys || [...new Set(objs.flatMap(o => Object.keys(o || {})))];
  for (const k of names) {
    const sh = { want: 0, neutral: 0, avoid: 0, n: 0 };
    for (const o of objs) {
      const v = o && o[k];
      if (typeof v !== 'number') continue;
      sh.n++;
      if (v > 0) sh.want++; else if (v < 0) sh.avoid++; else sh.neutral++;
    }
    if (sh.n || keys) out[k] = sh;
  }
  return out;
}

function selectPopulation(subs) {
  const chosen = subs.filter(s => s.surveyed);
  const basis = {};
  for (const s of chosen) basis[s.project] = (basis[s.project] || 0) + 1;
  return { chosen, basis };
}

// subs: parsed rows (see rowToSub) with a surveyed flag. meta: {project -> {maxStorey}}; a project without meta
// uses the highest max_storey that anyone chose. group: 'all' | 'flat_type' | 'project' | 'project_type'.
function analyse(subs, meta, group = 'all', value = null) {
  let scoped = subs;
  if (group === 'project') scoped = subs.filter(s => s.project === value);
  else if (group === 'project_type') scoped = subs.filter(s => s.project_type === value);
  else if (group === 'flat_type') scoped = subs.filter(s => !s.flat_types.length || housingOfList(s).includes(value));
  const { chosen, basis } = selectPopulation(scoped);
  const maxVals = chosen.map(s => s.max_storey).filter(v => v != null);
  const fromMeta = maxOf(chosen.map(s => (meta && meta[s.project] && meta[s.project].maxStorey) || 0));
  const n = fromMeta || maxOf(maxVals);

  const minVals = chosen.map(s => s.min_storey).filter(v => v != null);
  const floorPref = {};
  for (const s of chosen) floorPref[s.floor_pref] = (floorPref[s.floor_pref] || 0) + 1;
  const flatTypeCounts = {};
  for (const s of chosen) for (const t of (s.flat_types.length ? housingOfList(s) : ['(any)'])) flatTypeCounts[t] = (flatTypeCounts[t] || 0) + 1;

  return {
    group, value, users: chosen.length, sample_users: chosen.filter(s => s.is_sample).length, basis,
    min_storey: storeyDistribution(minVals, n),
    max_storey: storeyDistribution(maxVals, n),
    sun_directions: rankAverages(chosen.map(s => s.weights.sun)),
    blocks: rankAverages(chosen.map(s => s.weights.block)),
    unit_designs: rankAverages(chosen.map(s => s.weights.design)),
    factors: rankAverages(chosen.map(s => Object.fromEntries(FACTOR_KEYS.map(k => [k, s.weights[k]]).filter(([, v]) => typeof v === 'number')))),
    facilities: rankAverages(chosen.map(s => s.weights.facility)),
    factor_shares: weightShares(chosen.map(s => s.weights), FACTOR_KEYS),
    facility_shares: weightShares(chosen.map(s => s.weights.facility)),
    sun_shares: weightShares(chosen.map(s => s.weights.sun), ['NE', 'SE', 'SW', 'NW']),
    floor_preference: floorPref,
    flat_types: flatTypeCounts,
  };
}

// What the Analytics page gets for one project: rows are the real rankings, sampleRows the optional sample users.
function analyseProject(rows, sampleRows, project) {
  if (!PROJECT_KEYS.includes(project)) return fail('bad project');
  const real = latestPerUser(rows.map(rowToSub).filter(s => s.project === project));
  const sample = (sampleRows || []).map(rowToSub).filter(s => s.project === project).map(s => ({ ...s, is_sample: true }));
  if (real.length + sample.length < MIN_ANALYTICS_USERS) return fail('not enough data yet');
  const a = analyse(real.concat(sample), {}, 'project', project);
  return { ok: true, ...a };
}

if (typeof module !== 'undefined') {
  module.exports = { FACTOR_KEYS, LIST_FIELDS, RANKING_COLUMNS, SHORTLIST_COLUMNS, FULL_RANKING_COLUMNS, MAX_BODY_BYTES, PROJECT_RE, PROJECT_KEYS, MIN_ANALYTICS_USERS, UNIT_RE, ANALYTICS_COLUMNS, maxOf, utf8Bytes, safeText,
    rankingToRow, shortlistToRow, parseSubmission, sampleToRow, parseList, rowToSub, latestPerUser,
    analyse, analyseProject, storeyDistribution, binomPmf, rankAverages, selectPopulation };
}
