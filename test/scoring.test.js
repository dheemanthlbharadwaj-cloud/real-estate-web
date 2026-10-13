const test = require('node:test');
const assert = require('node:assert');
const S = require('../public/js/scoring.js');
const A = require('../apps-script/Analytics.js');
const { storeyDistribution, binomPmf, selectPopulation, analyse } = A;

const U = (o) => ({ id: o.id, block: 'A', storey: 5, unit: '101', flat_type: '4-Room', unit_design: null, facing: 'NE', position: 'Corridor',
  lift_m: 10, chute_m: 10, gt30m: false, roof_access: false, mrt_near: false, fac_has_count: 0, fac_near_count: 0, ...o });

test('filters by type, block and storey range', () => {
  const units = [U({ id: 'a' }), U({ id: 'b', block: 'B' }), U({ id: 'c', storey: 20 }), U({ id: 'd', flat_type: '3-Room' })];
  const r = S.filterUnits(units, { flatTypes: ['4-Room'], blocks: ['A'], minStorey: 2, maxStorey: 10 });
  assert.deepStrictEqual(r.map(u => u.id), ['a']);
});

test('weights move units in the expected direction', () => {
  const units = [U({ id: 'near', chute_m: 5 }), U({ id: 'far', chute_m: 40 }), U({ id: 'corner', position: 'Corner', chute_m: 8 })];
  assert.strictEqual(S.rank(units, {}, { chute: 5 }, 'none')[0].id, 'far');
  assert.strictEqual(S.rank(units, {}, { chute: -5 }, 'none').at(-1).id, 'far');
  assert.strictEqual(S.rank(units, {}, { corner: 5 }, 'none')[0].id, 'corner');
  assert.strictEqual(S.rank(units, {}, { sun: { SW: 5 } }, 'none')[0].score, 0);
});

test('floor preference uses the block height', () => {
  const units = [U({ id: 'lo', storey: 2 }), U({ id: 'mid', storey: 10 }), U({ id: 'hi', storey: 18 })];
  assert.strictEqual(S.rank(units, {}, {}, 'higher')[0].id, 'hi');
  assert.strictEqual(S.rank(units, {}, {}, 'lower')[0].id, 'lo');
  assert.ok(!S.FLOOR_PREFS.includes('middle'));
});

test('equal scores share a rank and the next score gets the next number', () => {
  const r = S.rank([U({ id: 'x' }), U({ id: 'y' }), U({ id: 'z', storey: 9 })], {}, {}, 'none');
  assert.deepStrictEqual(r.map(u => u.rank), [1, 1, 1]);
  const r2 = S.rank([U({ id: 'a', position: 'Corner' }), U({ id: 'b' }), U({ id: 'c' }), U({ id: 'd', position: 'Corner', storey: 2 })], {}, { corner: 3 }, 'none');
  assert.deepStrictEqual(r2.map(u => [u.id, u.rank]), [['a', 1], ['d', 1], ['b', 2], ['c', 2]]);
});

test('one meter per facility type: has counts fully, near counts half', () => {
  const units = [U({ id: 'has', facilities_has: ['Shops'], facilities_near: [] }), U({ id: 'near', facilities_has: [], facilities_near: ['Shops', 'Hardcourt'] }), U({ id: 'none', facilities_has: [], facilities_near: [] })];
  assert.deepStrictEqual(S.availability(units).facilities, ['Hardcourt', 'Shops']);
  const r = S.rank(units, {}, { facility: { Shops: 4, Hardcourt: -2 } }, 'none');
  assert.deepStrictEqual(r.map(u => [u.id, u.score]), [['has', 4], ['none', 0], ['near', 1]].sort((a, b) => b[1] - a[1]));
});

test('2-Room Flexi Type 1 and 2 form one housing type', () => {
  assert.strictEqual(S.housingOf('2-Room Flexi (Type 1)'), '2-Room Flexi');
  assert.strictEqual(S.housingOf('2-Room Flexi (Type 2)'), '2-Room Flexi');
  assert.strictEqual(S.housingOf('4-Room'), '4-Room');
});

test('highest, middlemost and lowest storeys', () => {
  const mk = ss => S.rank(ss.map((s, i) => U({ id: `u${i}`, storey: s })), {}, {}, 'none');
  const odd = S.floorGroups(mk([2, 3, 3, 7]));
  assert.deepStrictEqual(odd.storeys, { highest: [7], middle: [3], lowest: [2] });
  assert.strictEqual(odd.middle.length, 2);
  const even = S.floorGroups(mk([2, 3, 4, 7]));
  assert.deepStrictEqual(even.storeys.middle, [3, 4]);
  assert.strictEqual(even.middle.length, 2);
  assert.deepStrictEqual(S.floorGroups([]).highest, []);
});

test('binomial pmf sums to 1 and fit matches mean', () => {
  let s = 0; for (let k = 0; k <= 30; k++) s += binomPmf(30, 0.3, k);
  assert.ok(Math.abs(s - 1) < 1e-9);
  const d = storeyDistribution([5, 10, 15], 30);
  assert.strictEqual(d.mean, 10);
  assert.ok(Math.abs(d.p - 1 / 3) < 1e-12);
  assert.ok(Math.abs(d.binomial_expected.reduce((a, b) => a + b, 0) - 3) < 1e-9);
});

test('population counts only rankings with consent', () => {
  const mk = (n, surveyed, project = 'p') => Array.from({ length: n }, (_, i) => ({ user_id: `${surveyed}${i}`, project, surveyed }));
  const { chosen, basis } = selectPopulation([...mk(30, true), ...mk(50, false), ...mk(5, true, 'q')]);
  assert.strictEqual(chosen.length, 35);
  assert.deepStrictEqual(basis, { p: 30, q: 5 });
});

test('analysis ranks averages', () => {
  const sub = (w, extra = {}) => ({ user_id: Math.random(), project: 'p', project_type: 'Prime', surveyed: true, survey: { consent: true }, flat_types: [], min_storey: 3, max_storey: 9, floor_pref: 'none', weights: w, ...extra });
  const a = analyse([sub({ sun: { NE: 5, SW: -2 }, corner: 4, mrt: 1, facility: { Shops: 2 } }), sub({ sun: { NE: 3, SW: 0 }, corner: 2, mrt: 3, facility: { Shops: 4 } })], { p: { maxStorey: 20 } }, 'all');
  assert.deepStrictEqual(a.sun_directions.map(r => r.key), ['NE', 'SW']);
  assert.strictEqual(a.factors[0].key, 'corner');
  assert.deepStrictEqual(a.facilities.map(r => [r.key, r.mean]), [['Shops', 3]]);
  assert.ok(!('demographics' in a) && !('most_flagged' in a), 'no demographics or unit ids in the result');
});

test('wind and car park features', () => {
  const units = [
    U({ id: 'ne', facing: 'NE' }), U({ id: 'se', facing: 'SE' }), U({ id: 'sw', facing: 'SW' }), U({ id: 'nw', facing: 'NW' }),
    U({ id: 'open', facing: 'SW', wind_open: true }), U({ id: 'shut', facing: 'SW', wind_open: false }),
    U({ id: 'near', facing: 'SW', mscp_near: true, mscp_m: 60 }), U({ id: 'far', facing: 'SW', mscp_near: false, mscp_m: 140 }),
  ];
  const scoreOf = (w) => Object.fromEntries(S.rank(units, {}, w, 'none').map(u => [u.id, u.score]));
  // NE and SE windows both catch wind from the east side; SW and NW do not.
  const wf = scoreOf({ wind_facing: 4 });
  assert.deepStrictEqual(['ne', 'se', 'sw', 'nw'].map(id => wf[id]), [4, 4, 0, 0]);
  assert.deepStrictEqual(S.WIND_FACINGS, ['NE', 'SE']);
  const wo = scoreOf({ wind_open: 3 });
  assert.strictEqual(wo.open, 3);
  assert.strictEqual(wo.shut, 0);
  assert.strictEqual(wo.ne, 0, 'a unit with no wind_open field counts as blocked');
  const mp = scoreOf({ mscp: -2 });
  assert.strictEqual(mp.near, -2);
  assert.strictEqual(mp.far, 0);
  assert.strictEqual(S.MSCP_NEAR_M, 100);
  assert.strictEqual(S.FACTORS.wind_facing[0], 'Faces the prevailing wind (SE to E)');
  assert.strictEqual(S.FACTORS.wind_open[0], 'Not blocked from the wind');
  assert.strictEqual(S.FACTORS.mscp[0], 'Within 100 m from a multi-storey car park');
  const av = S.availability(units);
  assert.ok(av.wind_facing && av.wind_open && av.mscp);
  const none = S.availability([U({ id: 'x', facing: 'SW' })]);
  assert.ok(!none.wind_facing && !none.wind_open && !none.mscp);
});

test('generated unit data carries the wind and car park fields', () => {
  const fs = require('node:fs'), path = require('node:path');
  const dir = path.join(__dirname, '..', 'public', 'data', 'units');
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  for (const p of idx.projects) {
    const units = JSON.parse(fs.readFileSync(path.join(dir, `${p.key}.json`), 'utf8'));
    assert.ok(units.every(u => typeof u.wind_open === 'boolean'), `${p.key}: wind_open on every unit`);
    assert.ok(units.every(u => typeof u.mscp_near === 'boolean' && (u.mscp_m === null || typeof u.mscp_m === 'number')), `${p.key}: mscp fields`);
    assert.ok(units.every(u => u.mscp_near === (u.mscp_m !== null && u.mscp_m <= S.MSCP_NEAR_M)), `${p.key}: mscp_near matches mscp_m <= 100`);
    assert.ok(units.every(u => u.sample_fields.includes('wind_open')), `${p.key}: wind_open marked as sample`);
  }
});

const body = (o = {}) => ({ type: 'ranking', user: 'u0123456789ab', project: 'berlayar-rise-7', project_type: 'Prime', housing_type: '4-Room', blocks: ['200A', '200B'],
  min_storey: 3, max_storey: 20, floor_pref: 'higher', consent: true, consented_at: '2026-10-12T01:00:00.000Z', ranking: ['BR-1', 'BR-2', 'BR-3'],
  weights: { block: { '200A': 2 }, sun: { NE: 3, SW: -1 }, design: {}, facility: { "Children's playground": 1, Shops: 4 }, clearance: 1, corner: 2, roof: 0, chute: 3, mrt: 1, mscp: 0, wind_facing: 2, wind_open: -1 }, ...o });

test('analytics factor keys match the scoring factors', () => {
  assert.deepStrictEqual([...A.FACTOR_KEYS].sort(), Object.keys(S.FACTORS).sort());
  assert.ok(A.RANKING_COLUMNS.includes('weight_wind_facing') && A.RANKING_COLUMNS.includes('weight_wind_open') && A.RANKING_COLUMNS.includes('weight_mscp'));
});

test('a ranking becomes one row and reads back the same', () => {
  const r = A.parseSubmission(JSON.stringify(body()), '2026-10-12T02:00:00.000Z');
  assert.ok(r.ok && r.kind === 'ranking');
  assert.strictEqual(r.row.units_ranked, 3);
  assert.strictEqual(r.row.top50, 'BR-1, BR-2, BR-3');
  assert.strictEqual(r.row.sun_weights, 'NE: 3; SW: -1');
  assert.ok(!('queue_position' in r.row));
  const sub = A.rowToSub(r.row);
  assert.deepStrictEqual(sub.weights.sun, { NE: 3, SW: -1 });
  assert.deepStrictEqual(sub.weights.facility, { "Children's playground": 1, Shops: 4 });
  assert.strictEqual(sub.weights.wind_open, -1);
  assert.strictEqual(sub.surveyed, true);
});

test('a long full ranking is split over extra columns', () => {
  const ids = Array.from({ length: 4000 }, (_, i) => `BR-${String(i).padStart(4, '0')}-0000000000-000000`);
  const r = A.parseSubmission(JSON.stringify(body({ ranking: ids })), 'now');
  assert.ok(r.ok);
  assert.ok(r.row.full_ranking.length <= 49000 && r.row.full_ranking_2.length > 0);
  assert.strictEqual([r.row.full_ranking, r.row.full_ranking_2, r.row.full_ranking_3, r.row.full_ranking_4].join(''), ids.join(', '));
});

test('bad submissions are rejected', () => {
  const bad = o => A.parseSubmission(JSON.stringify(body(o)), 'now').ok;
  assert.ok(!bad({ type: 'nope' }) && !bad({ project: 'Bad Project!' }) && !bad({ user: 'x' }) && !bad({ consent: false }) && !bad({ floor_pref: 'middle' }));
  assert.ok(!bad({ ranking: ['a b'] }) && !bad({ min_storey: 'x' }) && !bad({ project_type: 'Other' }));
  assert.ok(!bad({ weights: { ...body().weights, corner: 9 } }) && !bad({ weights: { ...body().weights, sun: { 'NE; x': 1 } } }));
  assert.ok(!A.parseSubmission('x'.repeat(A.MAX_BODY_BYTES + 1), 'now').ok && !A.parseSubmission('{not json', 'now').ok && !A.parseSubmission('', 'now').ok);
  assert.ok(!A.parseSubmission(JSON.stringify({ type: 'shortlist', user: 'u0123456789ab', project: 'p-1', unit_ids: Array(501).fill('a') }), 'now').ok);
  const sl = A.parseSubmission(JSON.stringify({ type: 'shortlist', user: 'u0123456789ab', project: 'berlayar-rise-7', unit_ids: ['BR-1', 'BR-2'] }), 'now');
  assert.ok(sl.ok && sl.kind === 'shortlist' && sl.row.unit_ids === 'BR-1, BR-2');
  assert.strictEqual(A.safeText('=SUM(A1)'), "'=SUM(A1)");
});

test('analytics uses the latest ranking per user and returns no unit ids', () => {
  const row = (user, corner, at) => A.rankingToRow(body({ user, weights: { ...body().weights, corner } }), at).row;
  const rows = [row('uaaaaaaaa1', -5, 't1'), row('uaaaaaaaa1', 4, 't2'), row('ubbbbbbbb2', 2, 't3')];
  const a = A.analyseProject(rows, [], 'berlayar-rise-7');
  assert.strictEqual(a.users, 2);
  assert.strictEqual(a.factors.find(f => f.key === 'corner').mean, 3);
  assert.ok(!/BR-\d/.test(JSON.stringify(a)));
  assert.strictEqual(A.analyseProject(rows, [], 'other-project-1').users, 0);
});

test('sample users fit the row layout and count in analytics', () => {
  const fs = require('node:fs'), path = require('node:path');
  const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'sample_submissions.json'), 'utf8')).submissions;
  const rows = sample.map(s => A.sampleToRow(s, 'now'));
  assert.ok(rows.every(r => r.ok), 'every sample user passes the same checks as a real ranking');
  const first = sample[0];
  const a = A.analyseProject([], rows.map(r => r.row), first.project);
  assert.ok(a.users > 10 && a.sample_users === a.users);
  assert.ok(a.min_storey.histogram.length > 0 && a.sun_directions.length === 4);
});

test('analyse() gives factor_shares, facility_shares and sun_shares', () => {
  const A = require('../apps-script/Analytics.js');
  const mk = (w, extra = {}) => ({ user_id: Math.random(), project: 'p', project_type: 'Prime', surveyed: true, flat_types: [], min_storey: 3, max_storey: 9, floor_pref: 'none', is_sample: false, weights: w, ...extra });
  const subs = [
    mk({ chute: 3, corner: -2, sun: { NE: 1, SE: 0 }, facility: { Shops: 4 } }),
    mk({ chute: 0, corner: 0, sun: { NE: 2, SE: 5 }, facility: { Shops: 0, Preschool: 2 } }),
    mk({ chute: 5, sun: { NE: -1 }, facility: {} }),
    mk({ chute: 1, corner: 4, sun: { NE: 0 } }),
  ];
  const a = A.analyse(subs, {}, 'project', 'p');
  assert.deepStrictEqual(a.factor_shares.chute, { want: 3, neutral: 1, avoid: 0, n: 4 });
  assert.deepStrictEqual(a.factor_shares.corner, { want: 1, neutral: 1, avoid: 1, n: 3 });
  assert.deepStrictEqual(a.factor_shares.mrt, { want: 0, neutral: 0, avoid: 0, n: 0 });
  assert.deepStrictEqual(Object.keys(a.factor_shares).sort(), [...A.FACTOR_KEYS].sort());
  assert.deepStrictEqual(a.facility_shares.Shops, { want: 1, neutral: 1, avoid: 0, n: 2 });
  assert.deepStrictEqual(a.sun_shares.NE, { want: 2, neutral: 1, avoid: 1, n: 4 });
  assert.deepStrictEqual(a.sun_shares.NW, { want: 0, neutral: 0, avoid: 0, n: 0 });
  assert.ok(a.factors && a.facilities && a.floor_preference, 'existing output kept');
});
