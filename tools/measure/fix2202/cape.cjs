// node tools/measure/fix2202/cape.cjs [class] [outfit,helm;…] : TASKS 2202, the cape from behind against the front one, as heroCapeBackCheck
// counts it (live/sim_checks_grip.js capeBack, capeStats): per outfit the front's hem and graded Lab per pace, then per case drawn from
// behind (rest, the 8 ways walking and running, the turn, the whirl) the hem's range in shares of the height, the worst hem offset and
// ΔE76 against the front, and the cape tip's travel over a stride walking up against walking right. ROOT=<copy> measures another tree.
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX;
const cls = process.argv[2] || 'warrior', outfits = (process.argv[3] || 'leather_armor,;,;plate_armor,;cloak,;leather_armor,knight_helm').split(';').map((s) => s.split(','));
const rows = SIMX.capeBack(cls, outfits), { ref, out, swing } = SIMX.capeStats(rows), f = (v, d = 3) => (v === null || v === undefined ? '  -  ' : v.toFixed(d));
for (const [k, r] of Object.entries(ref)) console.log(`front ${k.padEnd(28)} hem ${f(r.hem)} H over the soles, ${f(r.drop)} H under the hip  Lab ${r.lab.map((v) => v.toFixed(1)).join(' ')}`);
const groups = {};
for (const q of out) { const k = `${q.r.outfit} | ${q.r.act}${q.r.way ? ' ' + q.r.way : ''} ${q.r.pace}`; (groups[k] = groups[k] || []).push(q); }
for (const [k, qs] of Object.entries(groups)) {
  const hems = qs.map((q) => q.r.hem).filter((v) => v !== null), dh = qs.reduce((a, q) => (Math.abs(q.dHem) > Math.abs(a) ? q.dHem : a), 0), de = Math.max(...qs.map((q) => q.dE));
  console.log(`back  ${k.padEnd(48)} frames ${String(qs.length).padStart(2)}  hem ${f(Math.min(...hems))}..${f(Math.max(...hems))} H  worst Δhem (under the hip) ${f(dh)}  worst ΔE76 ${f(de, 1)}`);
}
for (const [k, v] of Object.entries(swing)) console.log(`swing ${k.padEnd(30)} tip travel up ${f(v.back, 1)} px, right ${f(v.front, 1)} px`);
