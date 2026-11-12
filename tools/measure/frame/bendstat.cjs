// bendstat.cjs (r15): terrace bends (TASKS 1939) on the town run, floors 13-16, seeds 7..7n: per bend its straight legs (one crossing per leg),
// the longest leg in cells, how many 90-degree turns; prints per-floor rows and totals. node tools/measure/frame/bendstat.cjs [seeds=40]
const ROOT = require('path').resolve(process.env.ROOT || require('path').join(__dirname, '../../..'));
const SIM = require(ROOT + '/live/sim.js');
const N = +process.argv[2] || 40, rows = []; let floors = 0, terr = 0, withB = 0;
for (let i = 1; i <= N; i++) { const sd = i * 7; const S = SIM.create(); S.demo = 0; S.meta = S.meta || {}; S.meta.shards = 9999; S.run = SIM.newRun(S, 'campaign', sd, { town: true }); S.screen = 'play';
  for (const f of [13, 14, 15, 16]) { SIM.enterFloor(S, S.run, f); const m = S.run.map; if (m.biome !== 'magma') continue; floors++; if (m.ftype !== 'terrace') continue; terr++;
    const legs = (m.crossings || []).filter((c) => c.bend); if (!legs.length) continue; withB++;
    // legs of one bend follow each other in the list and share `of`; a new bend starts where `of` changes or the previous leg's axis repeats
    const bends = []; let cur = null; for (const c of legs) { if (!cur || cur.of !== c.of || cur.legs[cur.legs.length - 1].axis === c.axis) { cur = { of: c.of, legs: [] }; bends.push(cur); } cur.legs.push(c); }
    for (const b of bends) { const L = b.legs.map((c) => c.span[1] - c.span[0] + 1); rows.push({ sd, f, legs: L.length, turns: L.length - 1, lens: L, long: Math.max(...L) }); } } }
const t = rows.map((r) => r.turns), lg = rows.map((r) => r.long), allLegs = rows.flatMap((r) => r.lens), q = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
for (const r of rows) console.log(r.sd, r.f, 'legs', r.lens.join(','));
console.log(JSON.stringify({ floors, terrace: terr, withBends: withB, bends: rows.length, turns_p50: q(t, 0.5), turns_max: Math.max(...t), longLeg_p50: q(lg, 0.5), longLeg_max: Math.max(...lg),
  legs: allLegs.length, legs_ge6: allLegs.filter((x) => x >= 6).length, legs_le2: allLegs.filter((x) => x <= 2).length }));
