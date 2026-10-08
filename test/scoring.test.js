const test = require('node:test');
const assert = require('node:assert');
const S = require('../public/js/scoring.js');
const { storeyDistribution, binomPmf, selectPopulation, analyse } = require('../server/analysis.js');

const U = (o) => ({ id: o.id, block: 'A', storey: 5, unit: '101', flat_type: '4-Room', unit_design: null, facing: 'N', position: 'Corridor',
  lift_m: 10, chute_m: 10, gt30m: false, roof_access: false, mrt_near: false, fac_has_count: 0, fac_near_count: 0, ...o });

test('filters by type, block and storey range', () => {
  const units = [U({ id: 'a' }), U({ id: 'b', block: 'B' }), U({ id: 'c', storey: 20 }), U({ id: 'd', flat_type: '3-Room' })];
  const r = S.filterUnits(units, { flatTypes: ['4-Room'], blocks: ['A'], minStorey: 2, maxStorey: 10 });
  assert.deepStrictEqual(r.map(u => u.id), ['a']);
});

test('weights move units in the expected direction', () => {
  const units = [U({ id: 'near', lift_m: 5 }), U({ id: 'far', lift_m: 40 }), U({ id: 'corner', position: 'Corner', lift_m: 20 })];
  assert.strictEqual(S.rank(units, {}, { lift: 5 }, 'none')[0].id, 'far');
  assert.strictEqual(S.rank(units, {}, { lift: -5 }, 'none')[0].id, 'near');
  assert.strictEqual(S.rank(units, {}, { corner: 5 }, 'none')[0].id, 'corner');
  assert.strictEqual(S.rank(units, {}, { sun: { S: 5 } }, 'none')[0].score, 0);
});

test('floor preference uses the block height', () => {
  const units = [U({ id: 'lo', storey: 2 }), U({ id: 'mid', storey: 10 }), U({ id: 'hi', storey: 18 })];
  assert.strictEqual(S.rank(units, {}, {}, 'higher')[0].id, 'hi');
  assert.strictEqual(S.rank(units, {}, {}, 'lower')[0].id, 'lo');
  assert.strictEqual(S.rank(units, {}, {}, 'middle')[0].id, 'mid');
});

test('ranks are 1..n and stable', () => {
  const r = S.rank([U({ id: 'x' }), U({ id: 'y' })], {}, {}, 'none');
  assert.deepStrictEqual(r.map(u => u.rank), [1, 2]);
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
  const a = analyse([sub({ sun: { N: 5, S: -2 }, corner: 4, lift: 1 }), sub({ sun: { N: 3, S: 0 }, corner: 2, lift: 3 })], { p: { maxStorey: 20 } }, [], 'all');
  assert.deepStrictEqual(a.sun_directions.map(r => r.key), ['N', 'S']);
  assert.strictEqual(a.factors[0].key, 'corner');
});
