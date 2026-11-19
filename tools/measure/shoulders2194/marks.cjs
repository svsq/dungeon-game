// node tools/measure/shoulders2194/marks.cjs OUT_DIR [--cls mage] [--grep REGEX] [--k 6] : heroShoulderCheck's own composite of the near
// shoulder (shoulderGap with its image) for every pose of the class matching REGEX, scaled K times: magenta a gap, cyan the dark torso
// counted beside the sleeve, green the floor. Prints gap, dark and sock per pose
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const args = process.argv.slice(2), OUT = args[0], opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const CLS = opt('cls', 'mage'), RE = new RegExp(opt('grep', 'rest|dash')), K = +opt('k', 6); fs.mkdirSync(OUT, { recursive: true });
function writePng(file, W, H, rgba) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const { poses, shoulderGap } = SIMX.shoulder;
for (const p of poses(CLS).filter((p) => RE.test(p.tag))) {
  const r = shoulderGap(drawHero, L, p, p.o.menu ? 360 / 84 : 4, true);
  console.log(`${p.tag}: gap ${r.gap.toFixed(2)} dark ${r.dark.toFixed(2)} sock ${r.sock.toFixed(2)}${r.back ? ' (back)' : ''}`);
  const { W, H, rgba } = r.img, big = new Uint8Array(W * K * H * K * 4);
  for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) for (let c = 0; c < 4; c++) big[(y * W * K + x) * 4 + c] = rgba[(((y / K) | 0) * W + ((x / K) | 0)) * 4 + c];
  writePng(path.join(OUT, p.tag.replace(/[^\w.+-]+/g, '_') + '.png'), W * K, H * K, big);
}
