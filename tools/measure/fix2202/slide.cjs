// node tools/measure/fix2202/slide.cjs : TASKS 2202 (cosmetic of chars_motion_r5 № 6), the mage going sideways in the node sandbox: 60 fps,
// the body carried along at its speed and the stride's phase run as the sim runs it; per foot point (heel, toe) the frames it is planted
// (within 1 px of its lowest, as qa.mjs counts it) and how far it moves between two planted frames: p95 and max in world px, and the
// swing's highest lift. Classes and paces as arguments: node slide.cjs mage,warrior
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), T0 = 10, FPS = 60, N = 60, RUN = SIM.K.RUN;
const KIT = { warrior: ['sword'], mage: ['staff', 'robe'], archer: ['shortbow'] };
for (const cls of (process.argv[2] || 'mage').split(',')) for (const [pace, k] of [['walk', 0.5], ['run', 1]]) for (const dir of [1, -1]) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R; const [w, a] = KIT[cls]; R.hero.eq.weapon = { id: 0, b: w, rar: 0, lvl: 1, mods: {}, atk: 6 };
  if (a) R.hero.eq.armor = { id: 0, b: a, rar: 0, lvl: 1, mods: {}, def: 3 }; const st = SIMX.heroSt(S), vx = dir * RUN * k, rate = Math.abs(vx) / SIM.Q.stepLen(1) * Math.PI, fr = [];
  for (let f = 0; f < N; f++) { const J = {}; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = () => ({ w: 10, h: 10 }); L.solid = () => {};
    const t = f / FPS; drawHero(Object.assign({}, R.hero, { vx, vy: 0, gp: rate * t, face: dir, aim: dir > 0 ? 0 : Math.PI, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), 300 + vx * t, 300, T0 + t, st, {}); fr.push(J); }
  const slides = []; let lift = 0;
  for (const s of ['L', 'R']) for (const pt of ['heel', 'toe']) { const key = pt + s, hg = fr.map((J) => J['ground' + s][1] - J[key][1]), lo = Math.min(...hg), on = hg.map((v) => v <= lo + 1);
    lift = Math.max(lift, Math.max(...hg) - lo);
    for (let i = 1; i < N; i++) if (on[i] && on[i - 1]) slides.push(Math.hypot(fr[i][key][0] - fr[i - 1][key][0], fr[i][key][1] - fr[i - 1][key][1])); }
  const sl = slides.sort((x, y) => x - y), p95 = sl[Math.min(sl.length - 1, Math.floor(0.95 * sl.length))];
  console.log(`${cls.padEnd(8)} ${pace} ${dir > 0 ? 'right' : 'left '}  planted-foot slide p95 ${p95.toFixed(2)} px, max ${sl[sl.length - 1].toFixed(2)} px a frame  swing lift ${lift.toFixed(1)} px`);
}
