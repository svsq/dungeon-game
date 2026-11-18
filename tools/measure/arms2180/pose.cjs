// node tools/measure/arms2180/pose.cjs : the arms of the three classes in shares of the height H (soles → top joint), in the node
// sandbox (live/sandbox.cjs, the drawHero the checks use), as tools/measure/chars_ref/reach.py counts them on the page: at rest in the
// world and in the arch, the worst frame of a run cycle, and the warrior's blow (the weapon hand's path over the swing, the grip's
// p95 step a frame). L = the cape side (screen left), R = the weapon arm (screen right); dx = the hand out from its own shoulder.
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), T0 = 10, FPS = 60;
const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
function draw(cls, wb, ob, extra, GT, o = {}) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
  if (ob) R.hero.eq.offhand = { id: 0, b: ob, rar: 0, lvl: 1, mods: {}, def: 2 };
  const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, q) => { spr.push({ n, q }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, extra), 300, 300, GT, SIMX.heroSt(S), o); return { J, spr };
}
function arms(J) { const H = J.ground[1] - J.top[1], o = {};
  for (const [s, sg] of [['L', -1], ['R', 1]]) { const sh = J['sh' + s], el = J['elbow' + s], hd = J['hand' + s];
    o[s] = { reach: d(sh, hd) / H, bones: (d(sh, el) + d(el, hd)) / H, h: (J.ground[1] - hd[1]) / H, dx: sg * (hd[0] - sh[0]) / H,
      fore: Math.abs(Math.atan2(hd[0] - el[0], hd[1] - el[1]) * 180 / Math.PI), bend: Math.abs(((Math.atan2(hd[1] - el[1], hd[0] - el[0]) - Math.atan2(el[1] - sh[1], el[0] - sh[0])) * 180 / Math.PI + 540) % 360 - 180) }; }
  return o; }
const f3 = (v) => v.toFixed(3).padStart(6), row = (n, a) => console.log(n.padEnd(26), ['L', 'R'].map((s) => `${s} reach ${f3(a[s].reach)} h ${f3(a[s].h)} dx ${f3(a[s].dx)} fore ${a[s].fore.toFixed(0).padStart(3)}° bend ${a[s].bend.toFixed(0).padStart(3)}°`).join(' | '));
const KITS = [['warrior', 'sword', ''], ['warrior', 'sword', 'shield'], ['archer', 'shortbow', ''], ['mage', 'staff', ''], ['mage', 'staff', 'orb']];
for (const [cls, wb, ob] of KITS) {
  const tag = cls + (ob ? '+' + ob : '');
  row(tag + ' arch', arms(draw(cls, wb, ob, {}, T0, { menu: 1 }).J));
  row(tag + ' world', arms(draw(cls, wb, ob, {}, T0).J));
  const rate = SIM.K.RUN / SIM.Q.stepLen(1) * Math.PI, run = [];
  for (let k = 0; k < 40; k++) run.push(arms(draw(cls, wb, ob, { vx: SIM.K.RUN, gp: 1 + rate * k / FPS }, T0 + k / FPS).J));
  console.log((tag + ' run').padEnd(26), ['L', 'R'].map((s) => `${s} max reach ${f3(Math.max(...run.map((a) => a[s].reach)))} min h ${f3(Math.min(...run.map((a) => a[s].h)))} min bend ${Math.min(...run.map((a) => a[s].bend)).toFixed(0)}°`).join(' | '));
}
for (const [n, aim] of [['r', 0], ['d', Math.PI / 2], ['u', -Math.PI / 2], ['l', Math.PI], ['ul', -2.3]]) {
  const fr = []; for (let k = 0; k <= 30; k++) fr.push(draw('warrior', 'sword', '', { atkT: T0, aim, atkA: aim, face: Math.cos(aim) < -0.1 ? -1 : 1 }, T0 + k / FPS).J);
  const H = fr[0].ground[1] - fr[0].top[1], upto = Math.round(0.35 * FPS), path0 = fr.slice(1, upto + 1).reduce((a, J, i) => a + d(J.handR, fr[i].handR), 0) / H;
  const gs = fr.slice(1).map((J, i) => d(J.grip, fr[i].grip)).sort((a, b) => a - b), p95 = gs[Math.floor(0.95 * (gs.length - 1))];
  console.log(`warrior blow ${n.padEnd(3)} hand path 0..0.35 s ${path0.toFixed(3)} H, grip p95 ${p95.toFixed(1)} px a frame, max ${gs[gs.length - 1].toFixed(1)}`);
}
