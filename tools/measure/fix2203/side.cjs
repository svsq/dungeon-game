// node tools/measure/fix2203/side.cjs [cls,…] : TASKS 2203, the near side of the torso under the arm at rest (heroShoulderCheck's
// sideFill, gap and dark seam), per class, kit and view (the arch, the world facing right, facing left): max and mean over the breath's
// moments, world px²
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { restPoses, shoulderGap } = SIMX.shoulder;
const ONLY = process.argv[2] ? process.argv[2].split(',') : ['warrior', 'archer', 'mage'], ZA = 360 / 84, rows = {};
for (const cls of ONLY) for (const p of restPoses(cls)) { if (!/rest/.test(p.tag)) continue;
  const arch = !!p.o.menu, r = shoulderGap(drawHero, L, p, arch ? ZA : 4); if (r.back) continue;
  const k = p.tag.replace(/ (arch rest|rest face (-?1)).*$/, (m, a, f) => (a === 'arch rest' ? ' | arch' : ` | world ${f}`));
  (rows[k] = rows[k] || []).push(r); }
const f = (rs, n) => { const v = rs.map((r) => r[n]); return `${Math.max(...v).toFixed(2)}/${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)}`; };
console.log('pose | view : cape-colour px² max/mean, flat px², dark seam px², gap px²');
for (const [k, rs] of Object.entries(rows)) console.log(`${k.padEnd(58)} cape ${f(rs, 'capeFill').padEnd(11)} flat ${f(rs, 'flat').padEnd(11)} dark ${f(rs, 'dark').padEnd(10)} gap ${f(rs, 'gap')}`);
