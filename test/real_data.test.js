const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

test('build_real_data.py publishes the site schema from a 2-stack fixture', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mybto-real-'));
  const r = spawnSync('python3', [path.join(ROOT, 'pipeline', 'build_real_data.py'),
    '--in', path.join(__dirname, 'fixtures', 'real'), '--out', out, '--publish'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(out, 'review', 'mybto-units-review.xlsx')), 'xlsx written');
  assert.ok(fs.existsSync(path.join(out, 'review', 'mybto-units-review.csv')), 'csv written');
  const units = JSON.parse(fs.readFileSync(path.join(out, 'public', 'data', 'units', 'sembawang-brook-6.json'), 'utf8'));
  assert.strictEqual(units.length, 5);
  const u = units.find(x => x.id === 'SB-437A-03-101');
  assert.ok(u, 'unit id');
  assert.strictEqual(u.address, 'Blk 437A #03-101');
  assert.strictEqual(u.facing, 'NE');
  assert.strictEqual(u.gt30m, false);
  assert.strictEqual(u.opposite_gt30m, false);
  assert.strictEqual(u.chute_near, true);
  assert.strictEqual(u.roof_access, true);
  assert.strictEqual(units.find(x => x.id === 'SB-437A-02-101').roof_access, false);
  assert.strictEqual(u.mscp_near, true);
  assert.strictEqual(u.lift_m, null);
  assert.strictEqual(u.mrt_near, false);
  assert.deepStrictEqual(u.facilities_near, ['Hardcourt']);
  assert.strictEqual(u.fac_near_count, 1);
  assert.deepStrictEqual(u.sample_fields, []);
  const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'units', 'berlayar-rise-7.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(u).sort(), Object.keys(sample[0]).sort(), 'same fields as the site data');
  const idx = JSON.parse(fs.readFileSync(path.join(out, 'public', 'data', 'units', 'index.json'), 'utf8'));
  const p = idx.projects.find(x => x.key === 'sembawang-brook-6');
  assert.strictEqual(p.units, 5);
  assert.deepStrictEqual(p.housing_types, ['3-Room', '4-Room']);
});
