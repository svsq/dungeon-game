// a rock landing in the middle of a chain bridge's deck (magma_bridge, a fall hazard placed there; the fog lifted): render-time
// strip from 0.9 s before to 1.0 s after the landing, crop on the rock; per moment the boards' y and count near it and the hero's deck dy
const Q = SCENE.QA(); const S0 = structuredClone(Q.states.find((q) => q[0] === 'magma_bridge')[1]), R = S0.run, m = R.map, T = DATA.TILE;
const c = (m.crossings || []).filter((q) => q.kind === 'bridge').sort((a, b) => Math.hypot(a.cells[0] % m.W * T - R.hero.x, Math.floor(a.cells[0] / m.W) * T - R.hero.y) - Math.hypot(b.cells[0] % m.W * T - R.hero.x, Math.floor(b.cells[0] / m.W) * T - R.hero.y))[0];
const k = c.cells[Math.floor(c.cells.length / 2)], zx = (k % m.W + 0.5) * T, zy = (Math.floor(k / m.W) + 0.5) * T, H = DATA.HAZ.fall;
const z = { k: 'fall', x: zx, y: zy, per: 5, ph: 0, aim: 1 }; m.hazards = [z]; R.en = []; R.seen.fill(1);
const kh = c.cells[Math.max(0, Math.floor(c.cells.length / 2) - 2)]; R.hero.x = (kh % m.W + 0.5) * T; R.hero.y = (Math.floor(kh / m.W) + 0.5) * T; if (c.axis === 'x') R.hero.x -= 0; R.hero.vx = R.hero.vy = 0;
R.cam = [R.hero.x - 960, R.hero.y - 540];
const ts = [-0.9, -0.8, -0.6, -0.45, -0.3, -0.15, -0.05, 0, 0.03, 0.07, 0.1, 0.2, 0.3, 0.45, 0.6, 0.65, 0.8, 1.0], B = 220, Z = 2, cols = 6;
const g = document.createElement('canvas'); g.width = cols * B * Z; g.height = Math.ceil(ts.length / cols) * B * Z; const gx = g.getContext('2d'); gx.imageSmoothingEnabled = false;
const orig = LIB.sprite; let rec = []; LIB.sprite = function (n, x, y, o) { if (n === 'plank_a' || n === 'plank_b') rec.push([x, y, o && o.w]); return orig.apply(this, arguments); };
const out = []; const t0 = 20 * z.per;
ts.forEach((dt, i) => { const S = structuredClone(S0); S.t = S.run.t = t0 + dt; S.ev = dt >= 0 ? [{ k: 'rockfall', t: t0, x: zx, y: zy, i: 0 }] : []; rec = []; LIB.TRACE = {};
  SCENE.state = S; SCENE.render(S.t + 0.01); const cam = S.run.cam, near = rec.filter((p) => Math.hypot(p[0] + (p[2] || 0) / 2 + cam[0] - zx, p[1] + cam[1] - zy) < 50);
  const j = LIB.TRACE.hero || {}; out.push({ dt, clk: +DATA.hazClock(z, S.t).toFixed(3), n: near.length, ys: near.map((p) => +(p[1] + cam[1]).toFixed(0)), heroFoot: j.ground ? +(j.ground[1] - (S.run.hero.y - cam[1])).toFixed(2) : null });
  const X = zx - cam[0], Y = zy - cam[1]; gx.drawImage(document.getElementById('c'), X - B / 2, Y - B * 0.7, B, B, (i % cols) * B * Z, Math.floor(i / cols) * B * Z, B * Z, B * Z); gx.fillStyle = '#ff0'; gx.font = '16px monospace'; gx.fillText(dt.toFixed(2) + 's', (i % cols) * B * Z + 4, Math.floor(i / cols) * B * Z + 18); });
LIB.sprite = orig; return { axis: c.axis, cells: c.cells.length, z: [zx, zy], warn: H.warn, out, png: { bridge_mid: g.toDataURL('image/png') } };
