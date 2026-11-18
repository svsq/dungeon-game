// node tools/measure/fix2205/rungap.cjs [grep] : TASKS 2205, heroShoulderCheck's near-shoulder gap (world px²) in the run frames of the
// mage with the orb, per frame, and the largest; ROOT=<tree> measures another copy of the code
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { restPoses, shoulderGap } = SIMX.shoulder;
const RE = new RegExp(process.argv[2] || 'offhand:orb run'), worst = [0, ''];
for (const p of restPoses('mage')) { if (!RE.test(p.tag)) continue; const r = shoulderGap(drawHero, L, p, 4); if (r.back) continue;
  if (r.gap > worst[0]) worst.splice(0, 2, r.gap, p.tag); console.log(p.tag.padEnd(44), r.gap.toFixed(2)); }
console.log('largest', worst[0].toFixed(2), worst[1]);
