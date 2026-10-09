// Shared scoring logic (browser + Node). A unit's score is the sum over factors of
// importance (-5..5) x feature value (0..1). Higher score = better match.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Scoring = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SUN_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const UNIT_DESIGNS = ['Type 1', 'Type 2'];
  const FLOOR_PREFS = ['none', 'higher', 'lower', 'middle'];
  const FLOOR_PREF_WEIGHT = 5;

  // Single-meter factors: key -> [label, feature(unit, ctx) in 0..1]
  const FACTORS = {
    lift: ['Distance from lift (further)', (u, c) => norm(u.lift_m, c.liftMin, c.liftMax)],
    clearance: ['More than 30 m from neighbouring blocks', u => (u.gt30m ? 1 : 0)],
    corner: ['Corner unit', u => (u.position === 'Corner' ? 1 : 0)],
    roof: ['Access to roof', u => (u.roof_access ? 1 : 0)],
    chute: ['Distance from rubbish chute (further)', (u, c) => norm(u.chute_m, c.chuteMin, c.chuteMax)],
    mrt: ['Near MRT', u => (u.mrt_near ? 1 : 0)],
    facilities: ['Facilities nearby', (u, c) => (c.facMax > 0 ? facilityPoints(u) / c.facMax : 0)],
  };

  function norm(v, lo, hi) {
    if (v == null || hi == null || lo == null) return 0;
    if (hi === lo) return 0;
    return (v - lo) / (hi - lo);
  }
  // "has" (inside the unit's own block) counts double a "near" facility.
  function facilityPoints(u) {
    return (u.fac_has_count || 0) * 1 + (u.fac_near_count || 0) * 0.5;
  }

  function context(units) {
    const ctx = { liftMin: null, liftMax: null, chuteMin: null, chuteMax: null, facMax: 0, storeyMin: {}, storeyMax: {} };
    for (const u of units) {
      if (u.lift_m != null) { ctx.liftMin = ctx.liftMin == null ? u.lift_m : Math.min(ctx.liftMin, u.lift_m); ctx.liftMax = ctx.liftMax == null ? u.lift_m : Math.max(ctx.liftMax, u.lift_m); }
      if (u.chute_m != null) { ctx.chuteMin = ctx.chuteMin == null ? u.chute_m : Math.min(ctx.chuteMin, u.chute_m); ctx.chuteMax = ctx.chuteMax == null ? u.chute_m : Math.max(ctx.chuteMax, u.chute_m); }
      ctx.facMax = Math.max(ctx.facMax, facilityPoints(u));
      ctx.storeyMin[u.block] = Math.min(ctx.storeyMin[u.block] ?? Infinity, u.storey);
      ctx.storeyMax[u.block] = Math.max(ctx.storeyMax[u.block] ?? -Infinity, u.storey);
    }
    return ctx;
  }

  // Floor preference feature, relative to the unit's own block height.
  function floorFeature(u, pref, ctx) {
    if (!pref || pref === 'none') return 0;
    const t = norm(u.storey, ctx.storeyMin[u.block], ctx.storeyMax[u.block]);
    if (pref === 'higher') return t;
    if (pref === 'lower') return 1 - t;
    if (pref === 'middle') return 1 - Math.abs(2 * t - 1);
    return 0;
  }

  function filterUnits(units, f) {
    return units.filter(u =>
      (!f.flatTypes || !f.flatTypes.length || f.flatTypes.includes(u.flat_type)) &&
      (!f.blocks || !f.blocks.length || f.blocks.includes(u.block)) &&
      (f.minStorey == null || u.storey >= f.minStorey) &&
      (f.maxStorey == null || u.storey <= f.maxStorey) &&
      (!f.oppositeGt30 || u.opposite_gt30m));
  }

  // weights: { block: {200A: n}, sun: {N: n}, design: {'Type 1': n}, lift: n, clearance: n, ... }
  function scoreUnit(u, w, pref, ctx) {
    let s = 0;
    const parts = {};
    const add = (k, v) => { if (v) { parts[k] = v; s += v; } };
    add('block', (w.block && w.block[u.block]) || 0);
    add('sun', (w.sun && w.sun[u.facing]) || 0);
    add('design', (w.design && u.unit_design && w.design[u.unit_design]) || 0);
    for (const [k, [, fn]] of Object.entries(FACTORS)) add(k, (w[k] || 0) * fn(u, ctx));
    add('floor', FLOOR_PREF_WEIGHT * floorFeature(u, pref, ctx));
    return { score: Math.round(s * 1000) / 1000, parts };
  }

  // Returns filtered units sorted best-first with score + rank. Ties: higher storey, then id.
  function rank(units, filters, weights, pref) {
    const ctx = context(units);
    const out = filterUnits(units, filters || {}).map(u => ({ ...u, ...scoreUnit(u, weights || {}, pref, ctx) }));
    out.sort((a, b) => b.score - a.score || b.storey - a.storey || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    out.forEach((u, i) => { u.rank = i + 1; });
    return out;
  }

  // Which importance meters apply to a set of units: a factor is shown only when at least one
  // of the units has it (distances: when measured), sun directions / designs only when present.
  function availability(units) {
    const has = fn => units.some(fn);
    return {
      sun: SUN_DIRECTIONS.filter(d => has(u => u.facing === d)),
      design: UNIT_DESIGNS.filter(d => has(u => u.unit_design === d)),
      lift: has(u => u.lift_m != null),
      clearance: has(u => u.gt30m),
      corner: has(u => u.position === 'Corner'),
      roof: has(u => u.roof_access),
      chute: has(u => u.chute_m != null),
      mrt: has(u => u.mrt_near),
      facilities: has(u => facilityPoints(u) > 0),
    };
  }

  return { availability, SUN_DIRECTIONS, UNIT_DESIGNS, FLOOR_PREFS, FACTORS, FLOOR_PREF_WEIGHT, context, floorFeature, filterUnits, scoreUnit, rank };
});
