// TASKS 2164/2165: the held weapon at ease in the world, in shares of the height H over the soles: a bow's nocks and grip, the staff's
// foot, crystal head and grip, the wand's length; the near hand's height for scale (the other numbers move with it)
//   node tools/measure/chars_menu/heldrest.cjs
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js'));
const SB = require(path.join(ROOT, 'live/sandbox.cjs'));
const { D, heroSt } = globalThis.SIMX;
const { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), H = 84, Y = 300, ap = (A, p) => [A[0] * p[0] + A[2] * p[1] + A[4], A[1] * p[0] + A[3] * p[1] + A[5]];
const POLE = { foot: [0.074, 0.973], head: [0.96, 0.054] }, up = (y) => ((Y - y) / H).toFixed(2);
for (const [cls, wb] of [['archer', 'shortbow'], ['archer', 'longbow'], ['mage', 'staff'], ['mage', 'wand'], ['warrior', 'sword']]) for (const menu of [0, 1]) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
  const h = Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face: 1, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 });
  const J = {}, spr = [], sol = [];
  L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = (x, y, w, hh, col) => sol.push({ p: [x, y], col: String(col) });
  drawHero(h, 300, Y, 10, heroSt(S), menu ? { menu: 1 } : {});
  const wpn = spr.find((q) => /^it_/.test(q.n)), at = (f) => ap(wpn.o.m, [f[0] * wpn.o.w - wpn.o.pivot[0], f[1] * wpn.o.h - wpn.o.pivot[1]]);
  let s = `${(cls + ' ' + wb).padEnd(16)} ${menu ? 'arch ' : 'world'} ${wpn.n.padEnd(22)} hand ${up(J.handR[1])} grip ${up(J.grip[1])}`;
  if (wb.endsWith('bow')) { const e = sol.filter((q) => q.col === '0.66,0.6,0.5').map((q) => q.p[1]); s += ` nocks ${up(Math.min(...e))} .. ${up(Math.max(...e))}`; }
  else { const c = [[0, 0], [1, 0], [0, 1], [1, 1]].map(at).map((p) => p[1]); s += ` canvas top ${up(Math.min(...c))} bottom ${up(Math.max(...c))}`; }
  if (wb === 'staff') s += ` foot ${up(at(POLE.foot)[1])} head ${up(at(POLE.head)[1])}`;
  if (wb === 'wand' || wb === 'sword') { const tip = J.tip; s += ` tip ${up(tip[1])} len ${(Math.hypot(tip[0] - J.grip[0], tip[1] - J.grip[1]) / H).toFixed(2)}`; }
  console.log(s);
}
