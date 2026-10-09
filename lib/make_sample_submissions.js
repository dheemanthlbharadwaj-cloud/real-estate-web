// Generates SAMPLE saved lists + flags (lib/sample_submissions.json) so the Analysis page has
// something to show before real users arrive. They are never written to Firestore; the analysis
// function mixes them in unless SAMPLE_ANALYSIS=0 is set in Vercel.
const fs = require('node:fs');
const path = require('node:path');
const Scoring = require('../public/js/scoring.js');

const UNITS_DIR = path.join(__dirname, '..', 'public', 'data', 'units');
const SAMPLE_USERS = 420;

// Small deterministic PRNG so the sample is identical on every machine.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate() {
  const rnd = mulberry32(20260609);
  const pick = xs => xs[Math.floor(rnd() * xs.length)];
  const clamp = v => Math.max(-5, Math.min(5, Math.round(v)));
  const normal = (mu, sd) => mu + sd * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const { projects } = JSON.parse(fs.readFileSync(path.join(UNITS_DIR, 'index.json'), 'utf8'));
  const units = Object.fromEntries(projects.map(p => [p.key, JSON.parse(fs.readFileSync(path.join(UNITS_DIR, `${p.key}.json`), 'utf8'))]));
  // Popularity skews the sample towards Prime / Plus projects.
  const projectPool = projects.flatMap(p => Array(p.project_type === 'Standard' ? 2 : 3).fill(p));
  // Typical Singapore preferences: north/south facing preferred, west (afternoon sun) avoided.
  const sunBias = { N: 2.5, NE: 1.5, E: 0.5, SE: 1, S: 2, SW: -1, W: -3, NW: -0.5 };
  const submissions = [], flags = [];
  for (let i = 0; i < SAMPLE_USERS; i++) {
    const uid = `sample-${String(i + 1).padStart(3, '0')}`;
    const verified = rnd() < 0.4;
    const p = pick(projectPool);
    const types = p.flat_types.filter(() => rnd() < 0.45);
    const flatTypes = types.length ? types : [pick(p.flat_types)];
    const blocks = p.blocks.filter(() => rnd() < 0.75);
    const chosenBlocks = blocks.length ? blocks : [pick(p.blocks)];
    const top = p.max_storey;
    let minS = Math.max(2, Math.round(normal(top * 0.3, top * 0.15)));
    let maxS = Math.min(top, Math.round(normal(top * 0.8, top * 0.15)));
    if (minS > maxS) [minS, maxS] = [maxS, minS];
    const weights = {
      block: Object.fromEntries(chosenBlocks.map(b => [b, clamp(normal(0, 2.5))])),
      sun: Object.fromEntries(Scoring.SUN_DIRECTIONS.map(d => [d, clamp(normal(sunBias[d], 1.8))])),
      design: Object.fromEntries(Scoring.UNIT_DESIGNS.map(d => [d, clamp(normal(d === 'Type 2' ? 1 : 0, 2))])),
      lift: clamp(normal(1, 2)), clearance: clamp(normal(3, 1.5)), corner: clamp(normal(2.5, 1.8)), roof: clamp(normal(-0.5, 2.5)),
      chute: clamp(normal(3.5, 1.2)), mrt: clamp(normal(3, 1.6)), facilities: clamp(normal(1.5, 1.8)),
    };
    const floorPref = pick(['higher', 'higher', 'higher', 'middle', 'middle', 'none', 'lower']);
    const oppositeGt30 = rnd() < 0.35;
    const ranked = Scoring.rank(units[p.key], { flatTypes, blocks: chosenBlocks, minStorey: minS, maxStorey: maxS, oppositeGt30 }, weights, floorPref);
    submissions.push({ user_id: uid, verified, is_sample: true, project: p.key, project_type: p.project_type,
      queue_number: String(Math.floor(1 + rnd() * 3000)), flat_types: flatTypes, blocks: chosenBlocks, min_storey: minS, max_storey: maxS,
      floor_pref: floorPref, opposite_gt30: oppositeGt30, weights });
    ranked.slice(0, 1 + Math.floor(rnd() * 6)).forEach(u => flags.push({ user_id: uid, project: p.key, unit_id: u.id }));
  }
  return { submissions, flags };
}

if (require.main === module) {
  const out = path.join(__dirname, 'sample_submissions.json');
  const data = generate();
  fs.writeFileSync(out, JSON.stringify(data));
  console.log(`wrote ${data.submissions.length} sample submissions, ${data.flags.length} flags -> ${out}`);
}

module.exports = { generate };
