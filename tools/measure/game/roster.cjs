// node tools/measure/game/roster.cjs [N] — town run (campaign seed sd*7, town: true), seeds 1..N, floors 13–16 as generated:
// enemy roster by floor, packs near the arrival, special halls, chests (on bends, dry rounds, secrets), hazards, gate sets, bends.
// Rebuilt for r15 (the r14 roster.cjs was lost on 12.11.2026, MAGMA_LIMITS): numbers are a new base, compare r14 by trend only.
const { SIM, D, T, cellOf } = require('./lib.cjs'); const N = +(process.argv[2] || 30);
const MAGMA = new Set(['imp', 'salamander', 'skel_ember', 'golem', 'fire_priest', 'cultist', 'brute', 'boss_colossus', 'bomber', 'caller']);
const SHOOT = new Set(['imp', 'skel_archer', 'cultist', 'fire_priest']);
const F = {}; const add = (o, k, n = 1) => (o[k] = (o[k] || 0) + n);
for (let sd = 1; sd <= N; sd++) { const S = SIM.create(); S.demo = 0; S.meta = S.meta || {}; S.run = SIM.newRun(S, 'campaign', sd * 7, { town: true }); S.screen = 'play';
  for (let g = 1; g <= 16; g++) { SIM.enterFloor(S, S.run, g); if (g < 13) continue; const R = S.run, m = R.map, h = R.hero, W = m.W; if (m.biome !== 'magma') continue;
    const A = (F[g] = F[g] || { floors: 0, types: {}, en: 0, near6: 0, near10: 0, halls: {}, hallsN: 0, chests: 0, chestBend: 0, chestRound: 0, secrets: 0, gateSets: 0, vents: 0, falls: 0, surges: 0, rocks: 0, bends: 0, bendFloors: 0, ftypes: {}, shoot: 0 });
    A.floors++; add(A.ftypes, m.ftype + (m.ftype2 ? '+' + m.ftype2 : ''));
    for (const e of R.en) if (e.deadT < 0) { A.en++; add(A.types, e.type); if (SHOOT.has(e.type)) A.shoot++; const d = Math.hypot(e.x - h.x, e.y - h.y) / T; if (d < 6) A.near6++; if (d < 10) A.near10++; }
    for (const r of m.rooms || []) if (r.hall) { A.hallsN++; add(A.halls, r.hall); }
    const bendCells = new Set((m.crossings || []).filter((c) => c.bend).flatMap((c) => c.cells)); const nb = (m.crossings || []).filter((c) => c.bend).length; A.bends += nb; if (nb) A.bendFloors++;
    for (const c of R.chests || []) { A.chests++; if (c.round) A.chestRound++; const k = cellOf(m, c.x, c.y); if ([0, 1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1, 2, -2, 2 * W, -2 * W].some((o) => bendCells.has(k + o))) A.chestBend++; }
    A.secrets += (m.secrets || []).length;
    const hz = m.hazards || []; A.gateSets += new Set(hz.filter((z) => z.gate).map((z) => z.ph)).size; A.vents += hz.filter((z) => z.k === 'vent' && !z.gate).length; A.falls += hz.filter((z) => z.k === 'fall' || z.k === 'rock').length; A.surges += hz.filter((z) => z.k === 'surge').length; } }
const pc = (a, b) => (b ? (100 * a / b).toFixed(0) + '%' : '-');
for (const g of Object.keys(F)) { const A = F[g]; const tt = Object.entries(A.types).sort((a, b) => b[1] - a[1]); const mg = tt.filter(([t]) => MAGMA.has(t)).reduce((s, [, n]) => s + n, 0);
  console.log(`floor ${g}: ${A.floors} floors, types ${JSON.stringify(A.ftypes)}`);
  console.log(`  enemies/floor ${(A.en / A.floors).toFixed(1)}, magma kinds ${pc(mg, A.en)}, shooters ${pc(A.shoot, A.en)}, within 6 cells of arrival ${A.near6}, within 10 ${A.near10}`);
  console.log('  roster ' + tt.map(([t, n]) => `${t} ${pc(n, A.en)}`).join(', '));
  console.log(`  halls ${A.hallsN} ${JSON.stringify(A.halls)}; chests/floor ${(A.chests / A.floors).toFixed(1)} (round ${A.chestRound}, by a bend ${A.chestBend}); secrets/floor ${(A.secrets / A.floors).toFixed(2)}`);
  console.log(`  gate sets ${A.gateSets}, free vents ${A.vents}, rock/fall ${A.falls}, surges ${A.surges}; bends ${A.bends} on ${A.bendFloors} floors`); }
