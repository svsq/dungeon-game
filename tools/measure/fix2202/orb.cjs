// node tools/measure/fix2202/orb.cjs : TASKS 2202 (cosmetic of chars_motion_r5 № 5), the mage with staff and orb turning at rest, frame by
// frame at 60 fps in the node sandbox: the view (back share), the orb's centre and the far hand (joints), and the orb's step in a frame.
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), T0 = 10, FPS = 60;
const it = (b) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 3 }), S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R;
Object.assign(R.hero.eq, { weapon: it(process.argv[2] || 'staff'), armor: it('robe'), offhand: it('orb') }); const st = SIMX.heroSt(S);
const base = { vx: 0, vy: 0, gp: 0, aim: 0, back: 0, backT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
let prev = null, worst = [0, -1];
for (let f = 0; f <= 16; f++) { const J = {}, V = {}; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; if (id === 'hero_view') V[n] = p; }; L.sprite = () => ({ w: 10, h: 10 }); L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, { face: -1, faceT: T0 }), 300, 300, T0 + f / FPS, st, {});
  const step = prev ? Math.hypot(J.orb[0] - prev[0], J.orb[1] - prev[1]) : 0; if (step > worst[0]) worst = [step, f]; prev = J.orb;
  console.log(`f${String(f).padStart(2)} back ${V.back[0].toFixed(2)} orb ${J.orb.map((v) => v.toFixed(1)).join(' ')}  handL ${J.handL.map((v) => v.toFixed(1)).join(' ')}  step ${step.toFixed(1)}`); }
console.log(`orb's largest step ${worst[0].toFixed(1)} px at frame ${worst[1]}`);
