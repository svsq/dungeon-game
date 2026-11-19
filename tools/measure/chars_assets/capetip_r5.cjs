// node tools/measure/chars_assets/capetip_r5.cjs: author remark 7 (r5, task 2202). The warrior cape's hem joint ('cape', the bent tip that
// scene_hero.js traces) relative to the ground, world px, in the node sandbox: rest, walking and running E/W, a backpedal (facing right
// moving left), and a run left with the facing just flipped (faceT: a shot or swing turns him to the aim while he walks the other way).
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'warrior' }); S.run = R; const RUN = (SIM.K && SIM.K.RUN) || 150, GT = 10.3;
const tip = (p) => { const J = {}; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = () => ({ w: 10, h: 10 }); L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, p), 300, 300, GT, SIMX.heroSt(S), {}); return J.cape ? [J.cape[0] - 300, J.cape[1] - J.ground[1]] : null; };
const row = (name, p) => { const r = [0, 0.5, 1, 1.5].map((k) => tip(Object.assign({ gp: k * Math.PI }, p)));
  console.log(name.padEnd(36), r.map((t) => t ? `(${t[0].toFixed(1)}, ${t[1].toFixed(1)})` : '-').join(' ')); };
row('rest', {}); row('rest face left', { face: -1 });
for (const k of [0.4, 1]) { row(`E ${k < 1 ? 'walk' : 'run'}`, { vx: k * RUN }); row(`W ${k < 1 ? 'walk' : 'run'}`, { vx: -k * RUN, face: -1 }); row(`W ${k < 1 ? 'walk' : 'run'} backpedal`, { vx: -k * RUN, face: 1 }); }
for (const dt of [0.02, 0.06, 0.1, 0.16, 0.25]) row(`W run, face flipped ${dt}s ago`, { vx: -RUN, face: 1, faceT: GT - dt });
