// node tools/measure/fix2203/marks.cjs OUT_DIR [grep] : TASKS 2203, heroShoulderCheck's window of the rest poses as PNG ×4, the figure's
// own colours, yellow the torso's side in the cape's colour, blue its flat fill (sideFill), magenta a gap, cyan the dark seam
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { restPoses, shoulderGap } = SIMX.shoulder;
const OUT = process.argv[2], RE = new RegExp(process.argv[3] || '(arch rest|rest face 1)$'), K = 4; fs.mkdirSync(OUT, { recursive: true });
function crc32(b) { let c; const t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function writePng(file, W, H, rgba) { const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
for (const cls of ['warrior', 'archer', 'mage']) for (const p of restPoses(cls)) { if (!RE.test(p.tag)) continue;
  const r = shoulderGap(drawHero, L, p, p.o.menu ? 360 / 84 : 4, true), { W, H, rgba } = r.img, big = new Uint8Array(W * K * H * K * 4);
  for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) big.set(rgba.subarray(((y / K | 0) * W + (x / K | 0)) * 4, ((y / K | 0) * W + (x / K | 0)) * 4 + 4), (y * W * K + x) * 4);
  writePng(path.join(OUT, p.tag.replace(/[^a-z0-9]+/gi, '_') + '.png'), W * K, H * K, big);
  console.log(p.tag, 'cape', r.capeFill.toFixed(2), 'flat', r.flat.toFixed(2), 'dark', r.dark.toFixed(2)); }
