// node tools/measure/shoulders2191/arch.cjs OUT_DIR [--z 4.2857] : the near shoulder, arm and side of the torso of the warrior and the
// archer (and the mage) composited on the CPU at the textures' density (Z per world px), shoulder to hand, in the arch at rest (three moments of the
// breath), the world at rest and a run frame. Writes <cls>_<kit>_<pose>.png; the background is a flat green, so a hole reads as green.
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const args = process.argv.slice(2), OUT = args[0], opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const Z = +opt('z', 4.2857); fs.mkdirSync(OUT, { recursive: true });
const TEX = {}, png = (n) => TEX[n] || (TEX[n] = (() => {
  const buf = fs.readFileSync(path.join(ROOT, 'live/assets', n + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
  const idat = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o); if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = W * 4, px = Buffer.alloc(H * st);
  for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = y * (st + 1) + 1, o = y * st;
    for (let x = 0; x < st; x++) { const a = x >= 4 ? px[o + x - 4] : 0, b = y ? px[o - st + x] : 0, c = x >= 4 && y ? px[o - st + x - 4] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[o + x] = (raw[r + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
  return { W, H, P: px }; })());
function writePng(file, W, H, rgba) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const sample = (q, X, Y) => { const t = png(q.n), o = q.o, [a, b, c, d, e, f] = o.m, det = a * d - b * c; X -= e; Y -= f;
  const u = Math.floor(((d * X - c * Y) / det + o.pivot[0]) / o.w * t.W), v = Math.floor(((-b * X + a * Y) / det + o.pivot[1]) / o.h * t.H);
  if (u < 0 || v < 0 || u >= t.W || v >= t.H) return null; const k = (v * t.W + u) * 4; return t.P[k + 3] < 128 ? null : [t.P[k], t.P[k + 1], t.P[k + 2]]; };
const CLS = (opt('cls', 'warrior,archer,mage')).split(','), KITS0 = { warrior: [['look', { weapon: 'sword' }], ['plate', { weapon: 'sword', armor: 'plate_armor' }], ['cloak', { weapon: 'sword', armor: 'cloak' }], ['shirt', { weapon: 'sword', armor: '' }]],
  archer: [['look', { weapon: 'shortbow' }], ['cloak', { weapon: 'shortbow', armor: 'cloak' }]],
  mage: [['look', { weapon: 'staff' }], ['leather', { weapon: 'staff', armor: 'leather_armor' }]] };
const KITS = Object.fromEntries(Object.entries(KITS0).filter(([c]) => CLS.includes(c)));
const base = { vx: 0, vy: 0, gp: 0, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9, face: 1 };
const POSES = [['arch0', 10, {}, 1], ['arch1', 10.6, {}, 1], ['arch2', 11.3, {}, 1], ['world', 10, {}, 0], ['run', 10, { vx: SIM.K.RUN, gp: 1 + Math.PI }, 0]];
for (const [cls, kits] of Object.entries(KITS)) for (const [kn, kit] of kits) for (const [pn, GT, h, menu] of POSES) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R;
  for (const [k, b] of Object.entries(kit)) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot: k } : undefined;
  const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, h), 300, 300, GT, SIMX.heroSt(S), menu ? { menu: 1 } : {});
  const vis = spr.filter((q) => q.o && q.o.m && !(q.o.u && q.o.u.alpha !== undefined && q.o.u.alpha < 0.5)), H = J.ground[1] - J.top[1], sh = J.shL;
  const x0 = Math.floor((sh[0] - 0.1 * H) * Z), x1 = Math.ceil((sh[0] + 0.16 * H) * Z), y0 = Math.floor((sh[1] - 0.06 * H) * Z), y1 = Math.ceil((sh[1] + 0.36 * H) * Z), W = x1 - x0, Hh = y1 - y0, img = new Uint8Array(W * Hh * 4);
  for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) { let col = [40, 170, 60];
    for (const q of vis) { let c; try { c = sample(q, (x0 + px + 0.5) / Z, (y0 + py + 0.5) / Z); } catch (e) { continue; } if (c) col = c; }
    const k = (py * W + px) * 4; img[k] = col[0]; img[k + 1] = col[1]; img[k + 2] = col[2]; img[k + 3] = 255; }
  writePng(path.join(OUT, `${cls}_${kn}_${pn}.png`), W, Hh, img);
}
