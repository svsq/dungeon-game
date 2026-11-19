// node tools/measure/chars_assets/layers_r4.cjs <out.png> <cls> <menu 0|1> <x0,y0,x1,y1 world px or "shL" / "handL"> [pose-json] [kit-json] [Z]
// Composites the sprites drawHero lays down (node sandbox) over a window on the CPU, at the textures' own density (Z texels per world px).
// Writes <out>.png (colour), <out>_layers.png (each pixel tinted by the sprite on top: cape red, body grey, uarmL green, sock copy cyan,
// farmL yellow, cup magenta, held orange, empty black) and prints per sprite how many window pixels it owns on top, and the dark pixels
// (L* < 22) per owner.
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const [out, cls, menu, win, pose = '{}', kit = '{}', Zs = '4.2857'] = process.argv.slice(2), Z = +Zs;
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
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R;
for (const [k, b] of Object.entries(JSON.parse(kit))) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 } : undefined;
const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
const ps = JSON.parse(pose), GT = ps.GT ?? 10; delete ps.GT;
for (const k of ['atkT', 'patkT', 'castT', 'whirlT', 'hurtT', 'dashT', 'faceT']) if (typeof ps[k] === 'string') ps[k] = GT - +ps[k];
drawHero(Object.assign({}, R.hero, base, ps), 300, 300, GT, SIMX.heroSt(S), menu === '1' ? { menu: 1 } : {});
let w = win.split(',').map(Number); if (w.length === 1) { const j = J[win]; w = [j[0] - 10, j[1] - 6, j[0] + 10, j[1] + 18]; }
const x0 = Math.floor(w[0] * Z), y0 = Math.floor(w[1] * Z), W = Math.ceil(w[2] * Z) - x0, H = Math.ceil(w[3] * Z) - y0;
const col = new Uint8Array(W * H * 4), lay = new Uint8Array(W * H * 4), own = new Int16Array(W * H).fill(-1);
const names = spr.map((q, i) => q.n + (spr.findIndex((r) => r.n === q.n) !== i ? '#2' : ''));
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
spr.forEach((q, si) => {
  const o = q.o; if (ONLY && !ONLY.test(names[si])) return; if (!o || !o.m || (o.u && o.u.alpha !== undefined && o.u.alpha < 0.5)) return;
  let t; try { t = png(q.n); } catch (e) { return; }
  const [a, b, c, d, e, f] = o.m, det = a * d - b * c; if (!det) return;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const X = (x0 + px + 0.5) / Z - e, Y = (y0 + py + 0.5) / Z - f, lx = (d * X - c * Y) / det + o.pivot[0], ly = (-b * X + a * Y) / det + o.pivot[1];
    const u = Math.floor(lx / o.w * t.W), v = Math.floor(ly / o.h * t.H); if (u < 0 || v < 0 || u >= t.W || v >= t.H) continue;
    const k = (v * t.W + u) * 4; if (t.P[k + 3] < 128) continue; const i = py * W + px; own[i] = si;
    for (let ch = 0; ch < 3; ch++) col[i * 4 + ch] = t.P[k + ch]; col[i * 4 + 3] = 255; }
});
const TINT = [[/cape|quiver/, [200, 30, 30]], [/__body/, [140, 140, 140]], [/uarmL.*#2/, [40, 200, 60]], [/uarmL/, [40, 200, 220]], [/farmL|cupL|cuffL/, [230, 220, 40]], [/^(orb|it_)/, [240, 140, 20]], [/uarmR|farmR|fistR|cuffR/, [90, 90, 230]], [/thigh|shin|foot|hem/, [120, 80, 40]]];
const lum = (i) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; const Y = 0.2126 * f(col[i * 4]) + 0.7152 * f(col[i * 4 + 1]) + 0.0722 * f(col[i * 4 + 2]); return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
const cnt = {}, dark = {};
for (let i = 0; i < W * H; i++) { const nm = own[i] < 0 ? '(empty)' : names[own[i]]; cnt[nm] = (cnt[nm] || 0) + 1;
  if (own[i] >= 0 && lum(i) < 22) dark[nm] = (dark[nm] || 0) + 1;
  const t = own[i] < 0 ? [0, 0, 0] : (TINT.find(([re]) => re.test(names[own[i]])) || [0, [255, 255, 255]])[1], L_ = own[i] < 0 ? 0 : lum(i) / 100;
  for (let ch = 0; ch < 3; ch++) lay[i * 4 + ch] = Math.round(t[ch] * (0.35 + 0.65 * L_)); lay[i * 4 + 3] = 255; }
writePng(out, W, H, col); if (process.env.DUMP) fs.writeFileSync(out.replace(/\.png$/, '.json'), JSON.stringify({ W, H, Z, x0, y0, names, own: Array.from(own), J })); writePng(out.replace(/\.png$/, '_layers.png'), W, H, lay);
console.log(`window world [${w.map((v) => v.toFixed(1))}] ×${Z} = ${W}×${H}`);
for (const [k, v] of Object.entries(cnt).sort((a, b) => b[1] - a[1])) console.log(k.padEnd(28), String(v).padStart(6), 'dark', dark[k] || 0);
console.log('joints shL', J.shL && J.shL.map((v) => v.toFixed(1)), 'elbowL', J.elbowL && J.elbowL.map((v) => v.toFixed(1)), 'handL', J.handL && J.handL.map((v) => v.toFixed(1)), 'orb', J.orb && J.orb.map((v) => v.toFixed(1)));
