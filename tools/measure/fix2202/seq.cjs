// node tools/measure/fix2202/seq.cjs <out dir> [prefix] : TASKS 2202, the warrior's cape through the moves that show his back, drawn in the
// node sandbox and composited on the CPU with each sprite's grade applied to its texels (saturation and lift as the shader takes them;
// no soft bones): rows are the turn from rest, the turn on the run, the whirl (every other frame at 60 fps), and 12 frames of a stride
// running up; a magenta corner marks a frame drawn from behind. <prefix>_seq.png at ×3. ROOT=<copy> draws another tree.
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { compose } = SIMX.heroLayers;
const OUT = process.argv[2] || path.join(ROOT, 'frames/fix_2202'), PRE = process.argv[3] || 'after', Z = 3, BOX = [-40, -96, 40, 6], BG = [46, 40, 38], T0 = 10, FPS = 60, RUN = SIM.K.RUN;
function crc32(b) { let c, t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function writePng(file, W, H, rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const graded = (p, u) => { const g = (u && u.grade) || [1, 1, 0, 1], l = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]; return p.map((v) => Math.min(255, Math.max(0, Math.round(((l + (v - l) * g[0]) * g[1] - 127.5) * g[3] + 127.5)))); };
const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'warrior' }); S.run = R; R.hero.eq.weapon = { id: 0, b: 'sword', rar: 0, lvl: 1, mods: {}, atk: 6 };
const st = SIMX.heroSt(S), base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
function frame(over, t) {
  const spr = [], V = {}; L.joint = (id, n, p) => { if (id === 'hero_view') V[n] = p; }; L.sprite = (n, x, y, q) => { spr.push({ n, o: q }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, over), 300, 300, t, st, {});
  const c = compose(spr, [300 + BOX[0], 300 + BOX[1], 300 + BOX[2], 300 + BOX[3]], 1), rgb = Buffer.alloc(c.W * c.H * 3);
  for (let i = 0; i < c.W * c.H; i++) { const k = c.top[i], p = k >= 0 ? graded([c.rgb[i * 3], c.rgb[i * 3 + 1], c.rgb[i * 3 + 2]], spr[k].o.u) : BG; for (let ch = 0; ch < 3; ch++) rgb[i * 3 + ch] = p[ch]; }
  return { W: c.W, H: c.H, rgb, back: V.back ? V.back[0] : 0 };
}
const rows = [
  Array.from({ length: 13 }, (_, f) => frame({ face: -1, faceT: T0, aim: Math.PI }, T0 + f / FPS)),
  Array.from({ length: 13 }, (_, f) => frame({ vx: -RUN, face: -1, faceT: T0, aim: Math.PI, gp: f }, T0 + f / FPS)),
  Array.from({ length: 17 }, (_, f) => frame({ whirlT: T0, whirlA: 0, castK: 'whirl', castT: T0 }, T0 + 2 * f / FPS)),
  Array.from({ length: 12 }, (_, f) => frame({ vy: -RUN, aim: -Math.PI / 2, back: 1, gp: f * Math.PI / 6 }, T0 + f / FPS))];
const fw = rows[0][0].W, fh = rows[0][0].H, n = Math.max(...rows.map((r) => r.length)), W = n * (fw + 2) * Z, H = rows.length * (fh + 2) * Z, rgb = Buffer.alloc(W * H * 3, 20);
rows.forEach((r, j) => r.forEach((f, i) => { for (let y = 0; y < fh * Z; y++) for (let x = 0; x < fw * Z; x++) { const s = (Math.floor(y / Z) * fw + Math.floor(x / Z)) * 3, X = i * (fw + 2) * Z + x, Y = j * (fh + 2) * Z + y;
  for (let ch = 0; ch < 3; ch++) rgb[(Y * W + X) * 3 + ch] = f.rgb[s + ch]; }
  if (f.back > 0.5) for (let y = 0; y < 3 * Z; y++) for (let x = 0; x < 3 * Z; x++) { const X = i * (fw + 2) * Z + x, Y = j * (fh + 2) * Z + y; rgb[(Y * W + X) * 3] = 255; rgb[(Y * W + X) * 3 + 1] = 0; rgb[(Y * W + X) * 3 + 2] = 255; } }));
fs.mkdirSync(OUT, { recursive: true }); writePng(path.join(OUT, PRE + '_seq.png'), W, H, rgb); console.log(path.join(OUT, PRE + '_seq.png'));
