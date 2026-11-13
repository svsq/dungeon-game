// node tools/measure/game/arrive.cjs [N] — town run, magma floors 13–15, seeds 1..N: the hero stands still where he arrives for
// 6 s; first hit time and who, enemies that start a chase or a wind-up within 3 s, and the nearest posted enemy (cells, centres).
// Rebuilt for r15 (r14 arrive2.cjs lost 12.11.2026): new base, compare with r14 by trend only.
const { SIM, T, evNow } = require('./lib.cjs'), { mkT } = require('./survey.cjs'); const N = +(process.argv[2] || 30);
const rows = [];
for (let sd = 1; sd <= N; sd++) for (const f of [13, 14, 15]) { const S = mkT(sd, f), R = S.run, h = R.hero; if (R.map.biome !== 'magma') continue; h.hp = 1e5;
  const near = Math.min(...R.en.filter((e) => e.deadT < 0).map((e) => Math.hypot(e.x - h.x, e.y - h.y) / T)); let first = null, woke3 = 0; const t0 = S.t;
  for (let i = 0; i < Math.round(6 / SIM.DT); i++) { SIM.step(S, { keys: [] }); for (const e of evNow(S)) if (e.k === 'hurt' && !first) first = { t: +(S.t - t0).toFixed(2), src: e.src };
    if (Math.abs(S.t - t0 - 3) < SIM.DT / 2) woke3 = R.en.filter((e) => e.deadT < 0 && e.st && e.st !== 'idle' && e.st !== 'post' && e.st !== 'amble' && e.st !== 'calm').length; }
  rows.push({ sd, f, ft: R.map.ftype, near: +near.toFixed(1), first, woke3 }); }
for (const r of rows.filter((r) => r.first || r.near < 9)) console.log(`s${r.sd} f${r.f} ${r.ft}: nearest ${r.near} cells, first hit ${r.first ? r.first.t + ' s ' + r.first.src : 'none'}, awake at 3 s ${r.woke3}`);
console.log(`floors ${rows.length}; hit within 3 s ${rows.filter((r) => r.first && r.first.t <= 3).length}, within 6 s ${rows.filter((r) => r.first).length}; nearest enemy < 9 cells ${rows.filter((r) => r.near < 9).length}, min ${Math.min(...rows.map((r) => r.near))}`);
