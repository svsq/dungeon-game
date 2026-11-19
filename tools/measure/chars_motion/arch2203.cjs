// node tools/measure/chars_motion/arch2203.cjs [outdir] : author remarks 8 and 9 / TASKS 2203, the warrior's and the archer's arch
// at rest (menu, ×3.2 from the _menu textures, CPU composite SIMX.heroLayers.compose, no shader), 10 breath moments. Per class:
//  - the side of the torso under the near arm (screen-left), sampled at the arch's 360/84 per world px: rows from the near shoulder joint to the hip, columns from the near arm's
//    outer edge to the shoulder joint + 0.06 H; px of the body texture there that are red-brown (a* > 12, L* < 40; the archer: olive, a* < -4, L* < 50), their mean Lab and
//    flatness (share whose 3×3 L* spread < 4: no quilting, no plate edge); the sheet's gambeson (warrior_a_v2.png 345..430 × 495..600)
//    measured the same way for comparison;
//  - the cut-out: SIMX.shoulder.shoulderGap gap and dark seam (arch px²) per breath moment;
//  - <outdir>/arch_<class>.png, the near shoulder and torso side ×2 of the arch (≈ ×8.6 world).
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { compose } = SIMX.heroLayers, { poses, shoulderGap } = SIMX.shoulder;
const OUT = process.argv[2] || path.join(ROOT, 'frames/critic_chars_r5_motion/arch'); fs.mkdirSync(OUT, { recursive: true });
const lab = ([r, g, b]) => { const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }, R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
function crc32(b) { let c; const t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function writePng(file, W, H, rgb) { const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
function stats(get, x0, y0, x1, y1, isBody, want = (q) => q[1] > 12 && q[0] < 40) { let n = 0, flat = 0; const s = [0, 0, 0];
  for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) { if (isBody && !isBody(x, y)) continue; const q = lab(get(x, y)); if (!want(q)) continue;
    n++; for (let j = 0; j < 3; j++) s[j] += q[j]; let mn = 999, mx = -1; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = lab(get(x + dx, y + dy))[0]; mn = Math.min(mn, v); mx = Math.max(mx, v); } if (mx - mn < 4) flat++; }
  return { n, lab: s.map((v) => v / Math.max(n, 1)), flat: flat / Math.max(n, 1) }; }
// the sheet's gambeson
const { execFileSync } = require('child_process');
const sheetRaw = JSON.parse(execFileSync('python3', ['-c', 'import json,sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB").crop((345,495,430,600));print(json.dumps([im.size,list(im.getdata())]))', path.join(ROOT, 'art/char_refs/warrior_a_v2.png')]).toString());
const [[sw, sh], sp] = sheetRaw, gs = stats((x, y) => sp[y * sw + x], 0, 0, sw, sh);
console.log(`sheet gambeson     ${gs.n} px  Lab ${gs.lab.map((v) => v.toFixed(1)).join(' ')}  flat ${(gs.flat * 100).toFixed(0)}%`);
for (const cls of ['warrior', 'archer']) {
  const ps = poses(cls, false).filter((p) => /arch rest/.test(p.tag)); const gaps = [];
  for (const p of ps) { const r = shoulderGap(drawHero, L, p, 360 / 84); gaps.push(`${r.gap.toFixed(1)}/${(r.seam ?? r.dark ?? 0).toFixed ? (r.seam ?? r.dark ?? 0).toFixed(1) : '-'}`); }
  const p = ps[0], S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R;
  for (const [k, b] of Object.entries(p.kit)) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot: k } : undefined;
  const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, p.h), 300, 300, p.GT, SIMX.heroSt(S), p.o);
  const H = J.ground[1] - J.top[1], bx0 = Math.floor(J.shL[0] - 0.16 * H), by0 = Math.floor(J.shL[1] - 0.08 * H), bx1 = Math.ceil(J.shL[0] + 0.14 * H), by1 = Math.ceil(J.hip[1] + 0.04 * H);
  const ZA = 360 / 84, c = compose(spr, [bx0, by0, bx1, by1], ZA), get = (x, y) => [c.rgb[(y * c.W + x) * 3], c.rgb[(y * c.W + x) * 3 + 1], c.rgb[(y * c.W + x) * 3 + 2]];
  const isBody = (x, y) => { const k = c.top[y * c.W + x]; return k >= 0 && /__body/.test(spr[k].n); };
  const sx0 = 0, sx1 = Math.round((J.shL[0] + 0.06 * H - bx0) * ZA), sy0 = Math.round((J.shL[1] - by0) * ZA), sy1 = Math.round((J.hip[1] - by0) * ZA);
  const st = stats(get, sx0, sy0, sx1, sy1, isBody, cls === 'archer' ? (q) => q[1] < -4 && q[0] < 50 : undefined), dE = Math.hypot(...st.lab.map((v, j) => v - gs.lab[j]));
  console.log(`${cls.padEnd(8)} arch H ${H.toFixed(0)} px  torso side red-brown body px ${st.n} (${(st.n / ZA / ZA).toFixed(0)} world px²)  Lab ${st.lab.map((v) => v.toFixed(1)).join(' ')}  flat ${(st.flat * 100).toFixed(0)}%  ΔE76 to the sheet's gambeson ${dE.toFixed(1)}`);
  console.log(`${cls.padEnd(8)} cut-out gap/seam per breath (arch px²): ${gaps.join(' ')}`);
  const Z = 2, W = c.W * Z, Hh = c.H * Z, rgb = new Uint8Array(W * Hh * 3);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = Math.floor(y / Z) * c.W + Math.floor(x / Z), o = (y * W + x) * 3; for (let j = 0; j < 3; j++) rgb[o + j] = c.top[i] >= 0 ? c.rgb[i * 3 + j] : [24, 40, 24][j]; }
  writePng(path.join(OUT, `arch_${cls}.png`), W, Hh, rgb);
}
