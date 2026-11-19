// node tools/measure/shoulders2188/sweep.cjs [--png <dir> [--show <tag regex>]] [--cls warrior,archer,mage] : the near (cape-side, L) shoulder of each class in
// every pose the arch and the world draw, composited on the CPU from the sprites drawHero lays down in the node sandbox (live/sandbox.cjs):
// arch and world at rest, the run in four directions (12 frames each), the blow / shot / cast, the turn, hurt, dash; each outfit and offhand.
// In a window round the shoulder joint (from above it down UPPER of the upper arm), a gap is a pixel no figure part covers (the cape, the
// quiver and weapons are behind it or not of it) with figure pixels within REACH to its left, its right and above it: the cut-out between
// pauldron, sleeve and torso the author circled (frame 25, TASKS 2188). Prints the gap's area per pose in world px² (arch: the arch's own
// texture at the same scale); with --png writes the worst frames' composites ×Z with the gap in magenta.
const path = require('path'), fs = require('fs'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')); const SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = opt('png', ''), SHOW = new RegExp(opt('show', 'arch rest$|rest face 1 at \\+0$')), CLS = opt('cls', 'warrior,archer,mage').split(','), Z = 4;
const { poses, shoulderGap } = SIMX.shoulder;
const zlib = require('zlib');
function writePng(file, W, H, rgba) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const worst = {};
let total = 0;
for (const p of CLS.flatMap((c) => poses(c))) {
  const r = shoulderGap(drawHero, L, p, Z, !!OUT);
  total += r.gap;
  console.log(`${p.tag.padEnd(48)} gap ${r.gap.toFixed(2).padStart(6)} world px²  (${r.n} px at ×${r.z})  arm out ${r.turn.toFixed(2)} rad`);
  const k = p.cls + (p.o.menu ? ' arch' : ' world');
  if (OUT && r.img && (!worst[k] || r.gap > worst[k].gap)) worst[k] = r;
  if (OUT && r.img && SHOW.test(p.tag)) writePng(path.join(OUT, p.tag.replace(/[^\w]+/g, '_') + '.png'), r.img.W, r.img.H, r.img.rgba);
}
if (OUT) for (const [k, r] of Object.entries(worst)) writePng(path.join(OUT, 'worst_' + k.replace(/ /g, '_') + '.png'), r.img.W, r.img.H, r.img.rgba);
console.log(`total gap ${total.toFixed(1)} world px²`);
