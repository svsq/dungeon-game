// The cave's mushrooms after the pruning of dungeon_fill.js, checked as data: what the floors hold now against the counts taken
//   node tools/cavedensitycheck.cjs --save      take the counts of the current generator (tests/golden/cavedensity.json)
//   node tools/cavedensitycheck.cjs             sizes and glow of every mushroom, and the counts against the saved ones; fails without them
const assert = require('node:assert/strict'), fs = require('node:fs');
const DG = require('../live/dungeon.js');
const FILE = 'tests/golden/cavedensity.json', SEEDS = [1, 3, 7, 26837], FLOORS = [1, 2, 3, 4], SIZES = [0.6, 0.8, 1], FULL = 1, GLOW = [0.85, 1.05], SHROOM = /^shroom_[ab]$/, EPS = 1e-9;
const counts = {}, sizes = new Set();
for (const seed of SEEDS) for (const f of FLOORS) {
  const shrooms = DG.genFloor((seed * 31 + f * 1013) >>> 0, f, { mode: 'cave' }).decor.filter((d) => SHROOM.test(d.n));
  for (const d of shrooms) {
    const size = d.s || FULL;
    assert.ok(SIZES.includes(size), `seed ${seed} floor ${f}: a mushroom of size ${size}`);
    assert.ok(d.glow === undefined || (d.glow >= GLOW[0] - EPS && d.glow <= GLOW[1] + EPS), `seed ${seed} floor ${f}: a mushroom's glow ${d.glow}`);
    sizes.add(size);
  }
  counts[`${seed}/${f}`] = shrooms.length;
}
assert.deepEqual([...sizes].sort(), SIZES, 'the sizes the mushrooms take');
if (process.argv.includes('--save')) { fs.writeFileSync(FILE, JSON.stringify(counts, null, 1) + '\n'); console.log('cavedensitycheck: counts saved to ' + FILE); }
else if (fs.existsSync(FILE)) { assert.deepEqual(counts, JSON.parse(fs.readFileSync(FILE, 'utf8')), 'the mushrooms of a floor differ from the saved counts'); console.log('cavedensitycheck: ok, counts as saved'); }
else { console.log(`cavedensitycheck: no golden ${FILE}, the counts are not checked (--save takes them)`); process.exitCode = 1; }
