// Shared scoring logic (browser + Node). A unit's score is the sum over factors of
// importance (-5..5) x feature value (0..1). Higher score = better match.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Scoring = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SUN_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const UNIT_DESIGNS = ['Type 1', 'Type 2'];
  const FLOOR_PREFS = ['none', 'higher', 'lower'];
  // Housing types are applied for one at a time; 2-Room Flexi covers both Type 1 and Type 2.
  const HOUSING_TYPES = ['2-Room Flexi', '3-Room', '4-Room', '5-Room', '3Gen'];
  const housingOf = flatType => (String(flatType).startsWith('2-Room Flexi') ? '2-Room Flexi' : flatType);
  const FLOOR_PREF_WEIGHT = 5;

  // Single-meter factors: key -> [label, feature(unit, ctx) in 0..1]. Facilities get one meter
  // per facility type (weights.facility), scored separately in facilityScore.
  const FACTORS = {
    clearance: ['More than 30 m from neighbouring blocks', u => (u.gt30m ? 1 : 0)],
    corner: ['Corner unit', u => (u.position === 'Corner' ? 1 : 0)],
    roof: ['Access to roof', u => (u.roof_access ? 1 : 0)],
    chute: ['Distance from rubbish chute (further)', (u, c) => norm(u.chute_m, c.chuteMin, c.chuteMax)],
    mrt: ['Near MRT', u => (u.mrt_near ? 1 : 0)],
  };

  function norm(v, lo, hi) {
    if (v == null || hi == null || lo == null) return 0;
    if (hi === lo) return 0;
    return (v - lo) / (hi - lo);
  }
  // Per facility type: "has" (inside the unit's own block) = 1, "near" (within 50 m) = 0.5.
  function facilityFeature(u, name) {
    if ((u.facilities_has || []).includes(name)) return 1;
    if ((u.facilities_near || []).includes(name)) return 0.5;
    return 0;
  }
  function facilityScore(u, w) {
    let s = 0;
    for (const [name, v] of Object.entries(w || {})) if (v) s += v * facilityFeature(u, name);
    return s;
  }

  function context(units) {
    const ctx = { chuteMin: null, chuteMax: null, storeyMin: {}, storeyMax: {} };
    for (const u of units) {
      if (u.chute_m != null) { ctx.chuteMin = ctx.chuteMin == null ? u.chute_m : Math.min(ctx.chuteMin, u.chute_m); ctx.chuteMax = ctx.chuteMax == null ? u.chute_m : Math.max(ctx.chuteMax, u.chute_m); }
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
    return 0;
  }

  function filterUnits(units, f) {
    return units.filter(u =>
      (!f.flatTypes || !f.flatTypes.length || f.flatTypes.includes(u.flat_type)) &&
      (!f.blocks || !f.blocks.length || f.blocks.includes(u.block)) &&
      (f.minStorey == null || u.storey >= f.minStorey) &&
      (f.maxStorey == null || u.storey <= f.maxStorey));
  }

  // weights: { block: {200A: n}, sun: {N: n}, design: {'Type 1': n}, facility: {Shops: n}, clearance: n, ... }
  function scoreUnit(u, w, pref, ctx) {
    let s = 0;
    const parts = {};
    const add = (k, v) => { if (v) { parts[k] = v; s += v; } };
    add('block', (w.block && w.block[u.block]) || 0);
    add('sun', (w.sun && w.sun[u.facing]) || 0);
    add('design', (w.design && u.unit_design && w.design[u.unit_design]) || 0);
    for (const [k, [, fn]] of Object.entries(FACTORS)) add(k, (w[k] || 0) * fn(u, ctx));
    add('facility', facilityScore(u, w.facility));
    add('floor', FLOOR_PREF_WEIGHT * floorFeature(u, pref, ctx));
    return { score: Math.round(s * 1000) / 1000, parts };
  }

  // Returns filtered units sorted best-first with score + rank. Equal scores share a rank
  // (1, 1, 3, ...); within a tie the list shows higher storeys first, then by id.
  function rank(units, filters, weights, pref) {
    const ctx = context(units);
    const out = filterUnits(units, filters || {}).map(u => ({ ...u, ...scoreUnit(u, weights || {}, pref, ctx) }));
    out.sort((a, b) => b.score - a.score || b.storey - a.storey || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    out.forEach((u, i) => { u.rank = i > 0 && u.score === out[i - 1].score ? out[i - 1].rank : i + 1; });
    return out;
  }

  // Units on the highest, middlemost and lowest storeys of a ranked list. With an even number of
  // distinct storeys the middle two storeys are both returned.
  function floorGroups(ranked) {
    const storeys = [...new Set(ranked.map(u => u.storey))].sort((a, b) => a - b);
    if (!storeys.length) return { highest: [], middle: [], lowest: [], storeys: { highest: [], middle: [], lowest: [] } };
    const n = storeys.length;
    const mid = n % 2 ? [storeys[(n - 1) / 2]] : [storeys[n / 2 - 1], storeys[n / 2]];
    const pick = ss => ranked.filter(u => ss.includes(u.storey));
    const hi = [storeys[n - 1]], lo = [storeys[0]];
    return { highest: pick(hi), middle: pick(mid), lowest: pick(lo), storeys: { highest: hi, middle: mid, lowest: lo } };
  }

  // Which importance meters apply to a set of units: a factor is shown only when at least one
  // of the units has it (distances: when measured), sun directions / designs only when present.
  function availability(units) {
    const has = fn => units.some(fn);
    return {
      sun: SUN_DIRECTIONS.filter(d => has(u => u.facing === d)),
      design: UNIT_DESIGNS.filter(d => has(u => u.unit_design === d)),
      clearance: has(u => u.gt30m),
      corner: has(u => u.position === 'Corner'),
      roof: has(u => u.roof_access),
      chute: has(u => u.chute_m != null),
      mrt: has(u => u.mrt_near),
      facilities: [...new Set(units.flatMap(u => [...(u.facilities_has || []), ...(u.facilities_near || [])]))].sort(),
    };
  }

  return { availability, SUN_DIRECTIONS, UNIT_DESIGNS, FLOOR_PREFS, HOUSING_TYPES, housingOf, FACTORS, FLOOR_PREF_WEIGHT, context, floorFeature,
    facilityFeature, filterUnits, scoreUnit, rank, floorGroups };
});
