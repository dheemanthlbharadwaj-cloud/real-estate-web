// Aggregate analysis over saved rankings. Only rankings whose owner agreed to the research consent note
// (survey.consent) are counted. No unit ids are ever returned.

const FACTOR_KEYS = ['clearance', 'corner', 'roof', 'chute', 'mrt', 'mscp', 'wind_facing', 'wind_open'];
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
  const p = m / n;
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

function selectPopulation(subs) {
  const chosen = subs.filter(s => s.surveyed);
  const basis = {};
  for (const s of chosen) basis[s.project] = (basis[s.project] || 0) + 1;
  return { chosen, basis };
}

// subs: rows with parsed JSON fields + surveyed flag. meta: {project -> {type, maxStorey}}
// group: 'all' | 'flat_type' | 'project' | 'project_type'; value selects within the group.
function analyse(subs, meta, group = 'all', value = null) {
  let scoped = subs;
  if (group === 'project') scoped = subs.filter(s => s.project === value);
  else if (group === 'project_type') scoped = subs.filter(s => s.project_type === value);
  else if (group === 'flat_type') scoped = subs.filter(s => !s.flat_types.length || housingOfList(s).includes(value));
  const { chosen, basis } = selectPopulation(scoped);
  const n = Math.max(0, ...chosen.map(s => (meta[s.project] && meta[s.project].maxStorey) || 0));

  const minVals = chosen.map(s => s.min_storey).filter(v => v != null);
  const maxVals = chosen.map(s => s.max_storey).filter(v => v != null);
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
    floor_preference: floorPref,
    flat_types: flatTypeCounts,
  };
}

module.exports = { analyse, storeyDistribution, binomPmf, rankAverages, selectPopulation };
