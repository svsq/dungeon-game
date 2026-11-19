// node tools/measure/fix2205/orbswing.cjs : TASKS 2205, how far the orb swings in the run: the orb's centre against the near shoulder over
// the stride (12 moments, four directions), its span x and y in world px and its largest step from one moment to the next
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { restPoses } = SIMX.shoulder;
const rows = {};
for (const p of restPoses('mage')) { const m = /^mage staff offhand:orb run (\w+) /.exec(p.tag); if (!m) continue;
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R;
  for (const [k, b] of Object.entries(p.kit)) R.hero.eq[k] = { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot: k };
  const J = {}; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = () => ({ w: 10, h: 10 }); L.solid = () => {};
  drawHero(Object.assign({}, R.hero, p.h), 300, 300, p.GT, SIMX.heroSt(S), p.o);
  (rows[m[1]] = rows[m[1]] || []).push([J.orb[0] - J.shL[0], J.orb[1] - J.shL[1]]); }
for (const [dn, v] of Object.entries(rows)) { const xs = v.map((q) => q[0]), ys = v.map((q) => q[1]); let st = 0;
  for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; st = Math.max(st, Math.hypot(b[0] - a[0], b[1] - a[1])); }
  console.log(`${dn.padEnd(6)} span x ${(Math.max(...xs) - Math.min(...xs)).toFixed(1)} y ${(Math.max(...ys) - Math.min(...ys)).toFixed(1)}  step ${st.toFixed(1)}`); }
