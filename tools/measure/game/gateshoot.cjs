// node tools/measure/game/gateshoot.cjs [N] — TASKS 1920: gate sets on the town run's magma floors 13–15 with a shooter (imp,
// skel_archer, cultist, fire_priest) posted within 8 cells of any of the set's vents (the r14 `gateShoot` of the lost scan.cjs)
const { SIM, D, T } = require('./lib.cjs'), { mkT } = require('./survey.cjs'); const N = +(process.argv[2] || 30), SHY = D.HAZ.vent.gate.shy;
let sets = 0, shot = 0; const out = [];
for (let sd = 1; sd <= N; sd++) for (const f of [13, 14, 15]) { const S = mkT(sd, f), R = S.run, m = R.map; if (m.biome !== 'magma') continue; const g = {}; m.hazards.filter((z) => z.gate).forEach((z) => (g[z.ph] = g[z.ph] || []).push(z));
  for (const zs of Object.values(g)) { sets++; const near = R.en.filter((e) => e.deadT < 0 && SHY.includes(e.type) && zs.some((z) => Math.hypot(e.x - z.x, e.y - z.y) < 8 * T)); if (near.length) { shot++; out.push(`s${sd} f${f}: ${near.map((e) => e.type + ' ' + (Math.min(...zs.map((z) => Math.hypot(e.x - z.x, e.y - z.y))) / T).toFixed(1)).join(', ')}`); } } }
out.forEach((l) => console.log(l)); console.log(`gate sets ${sets}, with a shooter within 8 cells ${shot}`);
