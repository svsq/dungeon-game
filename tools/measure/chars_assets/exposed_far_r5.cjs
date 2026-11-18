// r5 far-side variant (author remark 10): the same measure for the FAR arm (uarmR, shR..elbowR, screen-right of the torso), searched mirrored.
// node tools/measure/chars_assets/exposed_far_r5.cjs [--cls warrior,archer,mage] [--png dir] [--all] : the near (cape-side) shoulder's slot
// in every pose of SIMX.shoulder.poses (the poses heroShoulderCheck walks), composited at the textures' density. Per texel row from the
// shoulder joint down to the elbow, beside the near sleeve (uarmL as posed, "arm"; its 2188 copy under the body, "sock"):
//  dark: torso texels on top, L* < 22, within REACH world px right of an arm or sock texel of that row (the torso's own outline and
//        armpit shade: opaque, so neither the sock nor heroShoulderCheck's alpha test sees them);
//  hole: cape or empty texels with an arm/sock texel left and a torso texel right within REACH (what heroShoulderCheck counts);
//  sock: texels where the 2188 copy itself is on top (its own outline and skin show as a second sleeve).
// Prints world px² per pose; with --png writes the worst arch and world pose ×1 at texel density (dark magenta, hole cyan, sock yellow).
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const CLS = opt('cls', 'warrior,archer,mage').split(','), OUT = opt('png', ''), ALL = args.includes('--all'), Z = 4.2857;
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
const sample = (q, m, X, Y) => { const t = png(q.n), o = q.o, [a, b, c, d, e, f] = m, det = a * d - b * c; X -= e; Y -= f;
  const lx = (d * X - c * Y) / det + o.pivot[0], ly = (-b * X + a * Y) / det + o.pivot[1], u = Math.floor(lx / o.w * t.W), v = Math.floor(ly / o.h * t.H);
  if (u < 0 || v < 0 || u >= t.W || v >= t.H) return null; const k = (v * t.W + u) * 4; return t.P[k + 3] < 128 ? null : [t.P[k], t.P[k + 1], t.P[k + 2]]; };
const Ls = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, Y = 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
const { poses } = SIMX.shoulder, worst = {}, sum = {}, REACH = 2.5;
for (const p of CLS.flatMap((c) => poses(c))) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: p.cls }); S.run = R;
  for (const [k, b] of Object.entries(p.kit)) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot: k } : undefined;
  const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, p.h), 300, 300, p.GT, SIMX.heroSt(S), p.o);
  const rig = D.CLASSES[p.cls].look.rig + '__', vis = spr.filter((q) => q.o && q.o.m && !(q.o.u && q.o.u.alpha !== undefined && q.o.u.alpha < 0.5));
  const arms = vis.filter((q) => q.n.startsWith(rig + 'uarmR')), body = vis.find((q) => q.n.startsWith(rig + 'body'));
  if (!arms.length || !body || /body_back/.test(body.n)) continue;
  const armQ = arms[arms.length - 1], sockQ = null, sh = J.shR, el = J.elbowR, H = J.ground[1] - J.top[1];
  const x0 = Math.floor((sh[0] - 0.14 * H) * Z), x1 = Math.ceil((sh[0] + 0.14 * H) * Z), ya = Math.min(sh[1], el[1]), yb = Math.max(sh[1], el[1]);
  const y0 = Math.floor(ya * Z), y1 = Math.ceil(yb * Z), W = x1 - x0, Hh = Math.max(1, y1 - y0);
  const kind = new Uint8Array(W * Hh), dk = new Uint8Array(W * Hh), img = OUT ? new Uint8Array(W * Hh * 4) : null;   // 0 empty 1 cape 2 body 3 arm 4 sock 5 other
  for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
    const X = (x0 + px + 0.5) / Z, Y = (y0 + py + 0.5) / Z; let top = null, col = null;
    for (const q of vis) { let c; try { c = sample(q, q.o.m, X, Y); } catch (e) { continue; } if (c) { top = q; col = c; } }
    const i = py * W + px;
    kind[i] = !top ? 0 : /__(cape|quiver)/.test(top.n) ? 1 : top === body ? 2 : top === armQ ? 3 : top === sockQ ? 4 : 5;
    dk[i] = col && Ls(col) < 22 ? 1 : 0;
    if (img) { const k = i * 4; if (col) { img[k] = col[0]; img[k + 1] = col[1]; img[k + 2] = col[2]; } else { img[k] = 20; img[k + 1] = 60; img[k + 2] = 20; } img[k + 3] = 255; }
  }
  const rch = Math.round(REACH * Z); let nd = 0, nh = 0, ns = 0;
  for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) { const i = py * W + px, k = kind[i];
    if (k === 4) { ns++; if (img) { img[i * 4] = 255; img[i * 4 + 1] = 230; img[i * 4 + 2] = 0; } continue; }
    let armL = false; for (let d = 1; d <= rch && px + d < W; d++) { const kk = kind[i + d]; if (kk === 3 || kk === 4) { armL = true; break; } }
    if (!armL) continue;
    if (k === 2 && dk[i]) { nd++; if (img) { img[i * 4] = 255; img[i * 4 + 1] = 0; img[i * 4 + 2] = 255; } }
    if (k <= 1) { let bR = false; for (let d = 1; d <= rch && px - d >= 0; d++) if (kind[i - d] === 2) { bR = true; break; } if (bR) { nh++; if (img) { img[i * 4] = 0; img[i * 4 + 1] = 255; img[i * 4 + 2] = 255; } } }
  }
  const z2 = Z * Z, r = { dk: nd / z2, h: nh / z2, s: ns / z2 }, v = r.dk + r.h;
  const k = p.cls + (p.o.menu ? ' arch' : ' world'); sum[k] = sum[k] || { n: 0, dk: 0, h: 0, s: 0, max: 0, min: 1e9, over: 0 }; const s = sum[k];
  s.n++; s.dk += r.dk; s.h += r.h; s.s += r.s; s.max = Math.max(s.max, v); s.min = Math.min(s.min, v); if (v > 2) s.over++;
  if (ALL || /arch rest$|rest face 1 at \+0$/.test(p.tag)) console.log(`${p.tag.padEnd(50)} dark ${r.dk.toFixed(2).padStart(5)}  hole ${r.h.toFixed(2).padStart(5)}  sock shows ${r.s.toFixed(2).padStart(5)} world px²`);
  if (img && (!worst[k] || v > worst[k].v)) worst[k] = { v, tag: p.tag, W, Hh, img };
  if (img && /arch rest$/.test(p.tag) && Object.keys(p.kit).length === 1) writePng(path.join(OUT, `${p.cls}_arch_rest.png`), W, Hh, img);
  if (img && /rest face 1 at \+0$/.test(p.tag) && Object.keys(p.kit).length === 1) writePng(path.join(OUT, `${p.cls}_world_rest.png`), W, Hh, img);
}
if (OUT) for (const [k, w] of Object.entries(worst)) { writePng(path.join(OUT, 'worst_' + k.replace(' ', '_') + '.png'), w.W, w.Hh, w.img); console.log('worst', k, w.tag, w.v.toFixed(2)); }
for (const [k, s] of Object.entries(sum)) console.log(`${k.padEnd(14)} poses ${s.n}  dark+hole min ${s.min.toFixed(2)} mean ${((s.dk + s.h) / s.n).toFixed(2)} max ${s.max.toFixed(2)}  (dark mean ${(s.dk / s.n).toFixed(2)}, hole mean ${(s.h / s.n).toFixed(2)}, sock shows mean ${(s.s / s.n).toFixed(2)}) world px²; poses over 2 px²: ${s.over}`);
