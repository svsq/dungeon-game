// node tools/measure/chars_motion/cape2202.cjs : author remark 7 / TASKS 2202, the warrior's cloak in all 8 ways (walking and running,
// 12 frames of a stride, after walking up first as views2198/sheet.cjs does) against the rest pose, CPU composite of the node sandbox
// (SIMX.heroLayers.compose, no shader grade). Cloak pixels: top sprite hero__cape*, or hero__body_back* below the shoulders with a* > 12
// (the back view draws the cloak inside the back texture). Per way: cloak bottom above the ground and cloak height in shares of the
// figure's height H, cloak area px², mean Lab and ΔE76 against the rest cloak; the view drawn (front/back).
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { compose } = SIMX.heroLayers;
const WAYS = { down: [0, 1], 'down-right': [1, 1], right: [1, 0], 'up-right': [1, -1], up: [0, -1], 'up-left': [-1, -1], left: [-1, 0], 'down-left': [-1, 1] };
const lab = ([r, g, b]) => { const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }, R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
function stage() { const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 91, { cls: 'warrior' }); S.run = R; S.screen = 'play'; S.t = R.t = 10; R.en = [];
  const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 12; x <= cx + 12; x++) m.cells[y * m.W + x] = 1;
  h.x = cx * SIMX.TILE + 16; h.y = cy * SIMX.TILE + 18; h.eq.weapon = { id: 0, b: 'sword', rar: 0, lvl: 1, mods: {}, atk: 6 }; return { S, h }; }
const go = (S, [dx, dy], n) => { const inp = { px: 480, py: 270 }; if (dx > 0) inp.right = 1; if (dx < 0) inp.left = 1; if (dy > 0) inp.down = 1; if (dy < 0) inp.up = 1; for (let i = 0; i < n; i++) SIM.step(S, inp); };
function cloak(S, h, over) {
  const spr = [], J = {}; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; if (id === 'hero_view') J['v_' + n] = p; }; L.sprite = (n, x, y, q) => { spr.push({ n, o: q }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, h, over), 300, 300, S.t, SIMX.heroSt(S), {});
  const c = compose(spr, [244, 190, 356, 306], 1); let top = 1e9, gnd = J.ground ? J.ground[1] - 190 : 110;
  for (let i = 0; i < c.W * c.H; i++) if (c.top[i] >= 0) top = Math.min(top, Math.floor(i / c.W));
  const H = gnd - top, sh = gnd - 0.72 * H; let n = 0, lo = -1, hi = 1e9; const sum = [0, 0, 0];
  for (let i = 0; i < c.W * c.H; i++) { const k = c.top[i]; if (k < 0) continue; const nm = spr[k].n, y = Math.floor(i / c.W), p = [c.rgb[i * 3], c.rgb[i * 3 + 1], c.rgb[i * 3 + 2]], q = lab(p);
    const isCape = /^hero__cape/.test(nm) || (/^hero__body_back/.test(nm) && y > sh && q[1] > 12);
    if (!isCape) continue; n++; lo = Math.max(lo, y); hi = Math.min(hi, y); for (let j = 0; j < 3; j++) sum[j] += q[j]; }
  return { n, bottom: (gnd - lo) / H, height: (lo - hi) / H, lab: sum.map((v) => v / Math.max(n, 1)), back: J.v_back ? J.v_back[0] : 0, H };
}
const avg = (rs) => ({ n: rs.reduce((a, r) => a + r.n, 0) / rs.length, bottom: rs.reduce((a, r) => a + r.bottom, 0) / rs.length, height: rs.reduce((a, r) => a + r.height, 0) / rs.length,
  lab: [0, 1, 2].map((j) => rs.reduce((a, r) => a + r.lab[j], 0) / rs.length), back: rs[0].back, minH: Math.min(...rs.map((r) => r.height)) });
const { S: S0, h: h0 } = stage(); const rest = cloak(S0, h0, { vx: 0, vy: 0, back: 0, gp: 0 });
const f = (r) => `area ${r.n.toFixed(0).padStart(4)} px²  bottom ${r.bottom.toFixed(3)} H  height ${r.height.toFixed(3)} H  Lab ${r.lab.map((v) => v.toFixed(1)).join(' ')}`;
console.log(`rest front         ${f(rest)}  (H ${rest.H} px)`);
for (const [way, dv] of Object.entries(WAYS)) for (const [pn, k] of [['walk', 0.5], ['run', 1]]) {
  const { S, h } = stage(); go(S, [0, -1], 60); go(S, dv, 48);
  const r = avg(Array.from({ length: 12 }, (_, i) => cloak(S, h, { vx: h.vx * k, vy: h.vy * k, gp: i * 2 * Math.PI / 12 })));
  const dE = Math.hypot(...r.lab.map((v, j) => v - rest.lab[j]));
  console.log(`${way.padEnd(10)} ${pn.padEnd(4)} ${r.back > 0.5 ? 'back ' : 'front'} ${f(r)}  min height ${r.minH.toFixed(3)} H  ΔE76 ${dE.toFixed(1)}  height/rest ${(r.height / rest.height).toFixed(2)}`);
}
