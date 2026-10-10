const test = require('node:test');
const assert = require('node:assert');
const S = require('../public/js/scoring.js');
const { storeyDistribution, binomPmf, selectPopulation, analyse } = require('../lib/analysis.js');

const U = (o) => ({ id: o.id, block: 'A', storey: 5, unit: '101', flat_type: '4-Room', unit_design: null, facing: 'N', position: 'Corridor',
  lift_m: 10, chute_m: 10, gt30m: false, roof_access: false, mrt_near: false, fac_has_count: 0, fac_near_count: 0, ...o });

test('filters by type, block and storey range', () => {
  const units = [U({ id: 'a' }), U({ id: 'b', block: 'B' }), U({ id: 'c', storey: 20 }), U({ id: 'd', flat_type: '3-Room' })];
  const r = S.filterUnits(units, { flatTypes: ['4-Room'], blocks: ['A'], minStorey: 2, maxStorey: 10 });
  assert.deepStrictEqual(r.map(u => u.id), ['a']);
});

test('weights move units in the expected direction', () => {
  const units = [U({ id: 'near', chute_m: 5 }), U({ id: 'far', chute_m: 40 }), U({ id: 'corner', position: 'Corner', chute_m: 20 })];
  assert.strictEqual(S.rank(units, {}, { chute: 5 }, 'none')[0].id, 'far');
  assert.strictEqual(S.rank(units, {}, { chute: -5 }, 'none')[0].id, 'near');
  assert.strictEqual(S.rank(units, {}, { corner: 5 }, 'none')[0].id, 'corner');
  assert.strictEqual(S.rank(units, {}, { sun: { S: 5 } }, 'none')[0].score, 0);
});

test('floor preference uses the block height', () => {
  const units = [U({ id: 'lo', storey: 2 }), U({ id: 'mid', storey: 10 }), U({ id: 'hi', storey: 18 })];
  assert.strictEqual(S.rank(units, {}, {}, 'higher')[0].id, 'hi');
  assert.strictEqual(S.rank(units, {}, {}, 'lower')[0].id, 'lo');
  assert.ok(!S.FLOOR_PREFS.includes('middle'));
});

test('equal scores share a rank', () => {
  const r = S.rank([U({ id: 'x' }), U({ id: 'y' }), U({ id: 'z', storey: 9 })], {}, {}, 'none');
  assert.deepStrictEqual(r.map(u => u.rank), [1, 1, 1]);
  const r2 = S.rank([U({ id: 'a', position: 'Corner' }), U({ id: 'b' }), U({ id: 'c' }), U({ id: 'd', position: 'Corner', storey: 2 })], {}, { corner: 3 }, 'none');
  assert.deepStrictEqual(r2.map(u => [u.id, u.rank]), [['a', 1], ['d', 1], ['b', 3], ['c', 3]]);
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

test('population uses verified users only once a project has 100 of them', () => {
  const mk = (n, verified, project = 'p') => Array.from({ length: n }, (_, i) => ({ user_id: `${verified}${i}`, project, verified }));
  assert.strictEqual(selectPopulation([...mk(99, true), ...mk(50, false)]).chosen.length, 149);
  assert.strictEqual(selectPopulation([...mk(100, true), ...mk(50, false)]).chosen.length, 100);
});

test('analysis ranks averages', () => {
  const sub = (w, extra = {}) => ({ user_id: Math.random(), project: 'p', project_type: 'Prime', verified: false, flat_types: [], min_storey: 3, max_storey: 9, floor_pref: 'none', weights: w, ...extra });
  const a = analyse([sub({ sun: { N: 5, S: -2 }, corner: 4, mrt: 1, facility: { Shops: 2 } }), sub({ sun: { N: 3, S: 0 }, corner: 2, mrt: 3, facility: { Shops: 4 } })], { p: { maxStorey: 20 } }, [], 'all');
  assert.deepStrictEqual(a.sun_directions.map(r => r.key), ['N', 'S']);
  assert.strictEqual(a.factors[0].key, 'corner');
  assert.deepStrictEqual(a.facilities.map(r => [r.key, r.mean]), [['Shops', 3]]);
});
