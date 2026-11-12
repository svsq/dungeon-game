// node tools/measure/game/hallpay.cjs [N] — town run, magma floors 13–15, seeds 1..N: each special hall (MAGMA_HALLS): its leader
// (`need`) inside, enemies inside, chests inside and their tier, distance from the walk to the stairs (cells: off the way = optional).
// Rebuilt for r15 (r14 hallpay.cjs was lost 12.11.2026): new base, compare with r14 by trend only.
const { SIM, D, T, cellOf, way, mean } = require('./lib.cjs'); const N = +(process.argv[2] || 30); const HL = D.MAGMA_HALLS.kinds;
const rows = [];
for (let sd = 1; sd <= N; sd++) { const S = SIM.create(); S.demo = 0; S.meta = S.meta || {}; S.run = SIM.newRun(S, 'campaign', sd * 7, { town: true }); S.screen = 'play';
  for (let g = 1; g <= 15; g++) { SIM.enterFloor(S, S.run, g); if (g < 13) continue; const R = S.run, m = R.map, W = m.W; if (m.biome !== 'magma') continue;
    const en = R.en; R.en = []; const w = way(S) || []; R.en = en; const on = w.map((k) => [k % W, Math.floor(k / W)]);
    for (const r of m.rooms || []) { if (!r.hall) continue; const inR = (x, y) => { const cx = Math.floor(x / T), cy = Math.floor(y / T); return cx >= r.x - 1 && cx < r.x + r.w + 1 && cy >= r.y - 1 && cy < r.y + r.h + 1; };
      const E = en.filter((e) => e.deadT < 0 && inR(e.x, e.y)), C = (R.chests || []).filter((c) => inR(c.x, c.y));
      const dWay = on.length ? Math.min(...on.map(([x, y]) => Math.max(0, r.x - x, x - (r.x + r.w - 1)) + Math.max(0, r.y - y, y - (r.y + r.h - 1)))) : -1;
      rows.push({ sd, f: g, hall: r.hall, lead: E.some((e) => e.type === HL[r.hall].need), n: E.length, elite: E.filter((e) => e.elite || (e.mods && e.mods.length)).length, chests: C.length, tier: C.map((c) => c.tier ?? c.t ?? '?').join('/'), dWay }); } } }
for (const k of Object.keys(HL)) { const A = rows.filter((r) => r.hall === k); if (!A.length) continue;
  console.log(`${k}: ${A.length} halls (floors ${JSON.stringify(A.reduce((o, r) => ((o[r.f] = (o[r.f] || 0) + 1), o), {}))}), leader missing ${A.filter((r) => !r.lead).length}, enemies ${mean(A.map((r) => r.n)).toFixed(1)}, elites ${mean(A.map((r) => r.elite)).toFixed(2)}, chests ${mean(A.map((r) => r.chests)).toFixed(2)} tiers ${JSON.stringify(A.reduce((o, r) => ((o[r.tier] = (o[r.tier] || 0) + 1), o), {}))}, on the way ${A.filter((r) => r.dWay === 0).length}, off it p50 ${A.map((r) => r.dWay).sort((a, b) => a - b)[A.length >> 1]} cells`); }
for (const r of rows.filter((r) => !r.lead)) console.log(`  no leader: s${r.sd} f${r.f} ${r.hall} (${r.n} enemies)`);
