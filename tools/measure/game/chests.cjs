// node tools/measure/game/chests.cjs [N] — town-run magma floors 13–15, seeds 1–N: chests the hero can't walk up to from where he
// arrives (floor and crust walkable, solid props and blocked cells in the way); stands in for the lost scan.cjs check (MAGMA_LIMITS)
const { mkT } = require('./survey.cjs'), { cellOf } = require('./lib.cjs'); const N = +(process.argv[2] || 30);
let floors = 0, chests = 0, bad = 0;
for (let sd = 1; sd <= N; sd++) for (const f of [13, 14, 15]) { const S = mkT(sd, f), R = S.run, m = R.map, W = m.W; if (m.biome !== 'magma') continue; floors++;
  const cr = new Set(m.crust || []), blk = new Set(m.block || []), solid = new Set(); for (const p of R.pots || []) if (p.hp > 0) solid.add(cellOf(m, p.x, p.y));
  for (const c of R.chests || []) solid.add(cellOf(m, c.x, c.y)); for (const d of m.decor || []) if (d.solid) solid.add(cellOf(m, d.x, d.y));
  const d = new Uint8Array(W * m.H), s = cellOf(m, R.hero.x, R.hero.y), q = [s]; d[s] = 1;
  for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (!d[n] && (m.cells[n] === 1 || cr.has(n)) && !blk.has(n) && !solid.has(n)) { d[n] = 1; q.push(n); } }
  for (const c of R.chests || []) { chests++; const k = cellOf(m, c.x, c.y); if (![1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].some((o) => d[k + o])) { bad++; console.log(`s${sd} f${f} ${m.ftype}: chest at ${Math.round(c.x)},${Math.round(c.y)} out of reach`); } } }
console.log(`floors ${floors}, chests ${chests}, out of reach ${bad}`);
