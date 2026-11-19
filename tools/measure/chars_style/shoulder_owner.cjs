// node tools/measure/chars_style/shoulder_owner.cjs [cls] [arch|world] [outPng] : composites the near (L) shoulder of a class at rest from the
// sprites drawHero lays down in the node sandbox (as heroShoulderCheck does) and records which sprite owns each pixel; prints the owners of
// the cape-red / dark slot pixels between the sleeve and the torso, and writes the composite ×Z with each sprite's pixels in its own colour.
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')); const SIMX = globalThis.SIMX, D = SIMX.D, { spawn, newRun, heroSt } = SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const [cls = 'warrior', where = 'arch', out = ''] = process.argv.slice(2), Z = 4;
const TEX = {}, png = (n) => TEX[n] || (TEX[n] = (() => {
  const buf = fs.readFileSync(path.join(ROOT, 'live/assets', n + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
  const idat = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o); if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = W * 4, px = Buffer.alloc(H * st);
  for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = y * (st + 1) + 1, o = y * st;
    for (let x = 0; x < st; x++) { const a = x >= 4 ? px[o + x - 4] : 0, b = y ? px[o - st + x] : 0, c = x >= 4 && y ? px[o - st + x - 4] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[o + x] = (raw[r + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
  return { W, H, P: px }; })());
const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R;
const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
const h = Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 });
drawHero(h, 300, 300, 10, heroSt(S), where === 'arch' ? { menu: 1 } : {});
const H = J.ground[1] - J.top[1], sh = J.shL, x0 = Math.floor((sh[0] - 0.12 * H) * Z), x1 = Math.ceil((sh[0] + 0.12 * H) * Z), y0 = Math.floor((sh[1] - 0.04 * H) * Z), y1 = Math.ceil((sh[1] + (+process.env.DOWN || 0.22) * H) * Z);
const W = x1 - x0, Hh = y1 - y0, own = new Array(W * Hh).fill(''), col = new Array(W * Hh).fill(null);
for (const q of spr) {
  const o = q.o; if (!o || !o.m || (o.u && o.u.alpha !== undefined && o.u.alpha < 0.5)) continue;
  let t; try { t = png(q.n); } catch (e) { continue; }
  const [a, b, c, d, e, f] = o.m, det = a * d - b * c; if (!det) continue;
  for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
    const X = (x0 + px + 0.5) / Z - e, Y = (y0 + py + 0.5) / Z - f, lx = (d * X - c * Y) / det + o.pivot[0], ly = (-b * X + a * Y) / det + o.pivot[1];
    const u = Math.floor(lx / o.w * t.W), v = Math.floor(ly / o.h * t.H); if (u < 0 || v < 0 || u >= t.W || v >= t.H) continue;
    const k = (v * t.W + u) * 4; if (t.P[k + 3] < 128) continue;
    own[py * W + px] = q.n; col[py * W + px] = [t.P[k], t.P[k + 1], t.P[k + 2]]; }
}
console.log('order:', spr.map((q) => q.n).filter((n) => /__/.test(n)).join(' '));
const red = {}, cnt = {};
for (let i = 0; i < W * Hh; i++) { if (!own[i]) continue; cnt[own[i]] = (cnt[own[i]] || 0) + 1; const [r, g, b] = col[i];
  if (r > g + 25 && r > b + 25 && g < 70 && r < 140) red[own[i]] = (red[own[i]] || 0) + 1; }
console.log('pixels per owner in the window:', JSON.stringify(cnt));
console.log('dark cape-red pixels per owner:', JSON.stringify(red));
if (out) {
  const pal = {}, hues = [[255, 0, 255], [0, 200, 255], [255, 200, 0], [0, 255, 0], [255, 80, 80], [120, 120, 255], [255, 255, 255], [0, 128, 128], [180, 90, 0]];
  const rgba = Buffer.alloc(W * 2 * Hh * 4);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x, a = (y * W * 2 + x) * 4, b2 = a + W * 4, n = own[i];
    const c0 = col[i] || [24, 40, 24]; rgba[a] = c0[0]; rgba[a + 1] = c0[1]; rgba[a + 2] = c0[2]; rgba[a + 3] = 255;
    if (n && !(n in pal)) pal[n] = hues[Object.keys(pal).length % hues.length];
    const c1 = n ? pal[n] : [0, 0, 0]; rgba[b2] = c1[0]; rgba[b2 + 1] = c1[1]; rgba[b2 + 2] = c1[2]; rgba[b2 + 3] = 255; }
  const crc = (bb) => { let c = ~0; for (const x of bb) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, dd) => { const l = Buffer.alloc(4); l.writeUInt32BE(dd.length); const td = Buffer.concat([Buffer.from(t), dd]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const WW = W * 2, raw = Buffer.alloc((WW * 4 + 1) * Hh); for (let y = 0; y < Hh; y++) rgba.copy(raw, y * (WW * 4 + 1) + 1, y * WW * 4, (y + 1) * WW * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(WW); ih.writeUInt32BE(Hh, 4); ih[8] = 8; ih[9] = 6;
  fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, out), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log('legend:', JSON.stringify(pal));
}
