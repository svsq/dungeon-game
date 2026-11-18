// node tools/measure/mage_2187/probe.cjs : the mage's two hands in the node sandbox (live/sandbox.cjs), world and arch, rest and run:
// the orb hand's elbow, hand, the orb's centre and the sprites drawn round it in order; the staff fist's place on the staff's axis
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
function draw(extra, GT, o) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; R.hero.eq.weapon = { id: 0, b: 'staff', rar: 0, lvl: 1, mods: {}, atk: 6 };
  R.hero.eq.offhand = { id: 0, b: 'orb', rar: 0, lvl: 1, mods: {}, def: 2 };
  const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, q) => { spr.push({ n, q }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, extra), 300, 300, GT, SIMX.heroSt(S), o); return { J, spr };
}
const p = (v) => v ? `[${v.map((x) => x.toFixed(1)).join(', ')}]` : '-';
for (const [tag, extra, o] of [['world rest', {}, {}], ['arch rest', {}, { menu: 1 }], ['world rest left', { face: -1 }, {}], ['world run', { vx: 150, gp: 40 }, {}]]) {
  const { J, spr } = draw(extra, 10, o);
  console.log(tag, 'shL', p(J.shL), 'elbowL', p(J.elbowL), 'handL', p(J.handL), 'orb', p(J.orb), 'grip', p(J.grip), 'tip', p(J.tip), 'handR', p(J.handR), 'H', (J.ground[1] - J.top[1]).toFixed(1));
  console.log('  ', spr.filter((q) => /mage__(farm|cuff|fist|cup)|orb_held|it_staff/.test(q.n)).map((q) => `${q.n}@${p([q.q.m[4], q.q.m[5]])} w${q.q.w.toFixed(1)}`).join(' '));
}
// the staff's own pixels just above and below the fist, across the staff's axis from the fist's centre (screen px, + = forward)
const fs = require('fs'), zlib = require('zlib');
const alpha = (n) => { const buf = fs.readFileSync(path.join(ROOT, 'live/assets', n + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20), bpp = { 6: 4, 2: 3, 4: 2, 0: 1 }[buf[25]];
  const idat = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8); if (type === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(W * H * bpp), st = W * bpp;
  for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)), o = y * st;
    for (let x = 0; x < st; x++) { const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - st + x] : 0, c = x >= bpp && y ? px[o - st + x - bpp] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[o + x] = (r[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
  const A = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) A[i] = bpp === 4 ? px[i * 4 + 3] : 255; return { W, H, A }; };
const texels = (q) => { const t = alpha(q.n), o = q.q, pts = []; for (let y = 0; y < t.H; y++) for (let x = 0; x < t.W; x++) if (t.A[y * t.W + x] > 127) pts.push(L.M.ap(o.m, [(x + 0.5) / t.W * o.w - o.pivot[0], (y + 0.5) / t.H * o.h - o.pivot[1]])); return pts; };
for (const [tag, o] of [['world', {}], ['arch', { menu: 1 }]]) {
  const { J, spr } = draw({}, 10, o), F = spr.find((q) => /mage__fistR/.test(q.n)), Wp = spr.find((q) => /it_staff/.test(q.n)), C = spr.find((q) => /mage__cuffR/.test(q.n));
  const fist = texels(F), c = fist.reduce((a, p) => [a[0] + p[0] / fist.length, a[1] + p[1] / fist.length], [0, 0]), u0 = [J.tip[0] - J.grip[0], J.tip[1] - J.grip[1]], ul = Math.hypot(...u0), u = [u0[0] / ul, u0[1] / ul], n = [-u[1], u[0]];
  const al = (p) => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1], ac = (p) => -((p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1]), fa = fist.map(al), lo = Math.min(...fa), hi = Math.max(...fa), fx = fist.map(ac);
  const band = (a0, a1) => { const s = texels(Wp).filter((p) => al(p) > a0 && al(p) < a1).map(ac); return s.length ? `${Math.min(...s).toFixed(1)}..${Math.max(...s).toFixed(1)} mid ${((Math.min(...s) + Math.max(...s)) / 2).toFixed(2)}` : '-'; };
  const cuff = C ? texels(C).filter((p) => al(p) < lo).map(ac) : [];
  console.log(tag, `fist across ${Math.min(...fx).toFixed(1)}..${Math.max(...fx).toFixed(1)} along ${lo.toFixed(1)}..${hi.toFixed(1)}; staff above ${band(hi, hi + 4)}; below ${band(lo - 4, lo)}; cuff below the fist across ${cuff.length ? Math.min(...cuff).toFixed(1) + '..' + Math.max(...cuff).toFixed(1) : '-'}`);
}
