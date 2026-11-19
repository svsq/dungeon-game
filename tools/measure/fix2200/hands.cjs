// node tools/measure/fix2200/hands.cjs [out.png] : the weapon fists and the orb cup as the world grid shows them (TASKS 2200). Each hero
// at rest and on the run (world, 84 px tall) is drawn in the sandbox and its sprites composed round the hand as snapTex draws
// them (each sprite voted on its own: kept where its texel at the world px's centre is opaque, painted the mean of the largest group of its
// 4×4 samples within 0.13 of one another; then drawn in order; no lighting); per hand: the fist's world px, its
// skin/glove tones (darkest..lightest L), whether a dark px parts two lit rows along the weapon (the fingers), and how many weapon px show
// above and below it on its axis. With out.png the crops ×8 side by side; ROOT=<copy> for another tree
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const PX = 2, R0 = 15, TX = {};
const tex = (nm) => TX[nm] || (TX[nm] = (() => { const buf = fs.readFileSync(path.join(ROOT, 'live/assets', nm + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20), bpp = { 6: 4, 2: 3, 4: 2, 0: 1 }[buf[25]];
  const idat = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o); if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(W * H * bpp), st = W * bpp;
  for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)), o = y * st;
    for (let x = 0; x < st; x++) { const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - st + x] : 0, c = x >= bpp && y ? px[o - st + x - bpp] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[o + x] = (r[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
  return { W, H, px, bpp }; })());
const lum = (c) => { const f = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; }; const [r, g, b] = c.map(f);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 100 * (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s); };
const KITS = [['warrior', 'sword', null, /^hero__fistR/], ['warrior', 'axe', null, /^hero__fistR/], ['archer', 'shortbow', null, /^archer__fistR/], ['archer', 'crossbow', null, /^archer__fistR/],
  ['mage', 'staff', null, /^mage__fistR/], ['mage', 'staff', 'orb', /^mage__cupL/]];
const shots = [];
for (const [cls, wb, ob, fre] of KITS) for (const [act, vx, GT] of [['rest', 0, 10], ['run', 150, 10.2]]) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
  if (ob) R.hero.eq.offhand = { id: 0, b: ob, rar: 0, lvl: 1, mods: {}, def: 2 };
  const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  L.SNAP = 1; drawHero(Object.assign({}, R.hero, { vx, vy: 0, gp: GT * 4, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), 300, 300, GT, SIMX.heroSt(S), {}); L.SNAP = 0;
  const fi = spr.findIndex((q) => fre.test(q.n)); if (fi < 0) { console.log(`${cls} ${wb} ${act}: no ${fre}`); continue; }
  const F = spr[fi], c = [F.o.m[4], F.o.m[5]], x0 = PX * Math.floor((c[0] - R0) / PX), y0 = PX * Math.floor((c[1] - R0) / PX), box = [x0, y0, x0 + 2 * R0 + PX, y0 + 2 * R0 + PX];
  const n = (box[2] - box[0]) / PX, m = (box[3] - box[1]) / PX, cells = new Array(n * m).fill(null);
  spr.forEach((q, si) => { const o = q.o; if (!o || !o.m || (o.u && o.u.alpha !== undefined && o.u.alpha < 0.5)) return;
    const t = tex(q.n), [a, b, cc, dd, e, f] = o.m, det = a * dd - b * cc; if (!det) return;
    const uv = (X, Y) => { X -= e; Y -= f; return [Math.floor(((dd * X - cc * Y) / det + o.pivot[0]) / o.w * t.W), Math.floor(((-b * X + a * Y) / det + o.pivot[1]) / o.h * t.H)]; };
    const texel = (X, Y) => { const [u, v] = uv(X, Y); if (u < 0 || v < 0 || u >= t.W || v >= t.H) return null; const i = (v * t.W + u) * t.bpp; return t.bpp === 4 && t.px[i + 3] < 128 ? null : [t.px[i], t.px[i + 1], t.px[i + 2]]; };
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const X = box[0] + (i + 0.5) * PX, Y = box[1] + (j + 0.5) * PX; if (!texel(X, Y)) continue;
      const tp = []; for (let k = 0; k < 16; k++) { const s = texel(X + ((k % 4) + 0.5) / 4 * PX - PX / 2, Y + (Math.floor(k / 4) + 0.5) / 4 * PX - PX / 2); if (s) tp.push(s); }
      let bk = 0, bn = -1; for (const p of tp) { const nn = tp.filter((r) => Math.hypot(p[0] - r[0], p[1] - r[1], p[2] - r[2]) <= 33).length; if (nn > bn) { bn = nn; bk = p; } }
      const near = tp.filter((r) => Math.hypot(bk[0] - r[0], bk[1] - r[1], bk[2] - r[2]) <= 33);
      cells[j * n + i] = { rgb: [0, 1, 2].map((ch) => Math.round(near.reduce((s, r) => s + r[ch], 0) / near.length)), t: si }; } });
  const at = (i, j) => cells[j * n + i], isF = (q) => q && q.t === fi, isW = (q) => q && /^it_/.test(spr[q.t].n);
  const fist = []; for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) if (isF(at(i, j))) fist.push([i, j, lum(at(i, j).rgb)]);
  const Ls = fist.map((f) => f[2]).sort((a, b) => a - b), ax = J.tip && J.grip ? [J.tip[0] - J.grip[0], J.tip[1] - J.grip[1]] : [0, -1], al = Math.hypot(...ax), u = [ax[0] / al, ax[1] / al];
  const along = (i, j) => ((x0 + (i + 0.5) * PX - c[0]) * u[0] + (y0 + (j + 0.5) * PX - c[1]) * u[1]) / PX;
  const fa = fist.map(([i, j]) => along(i, j)), lo = Math.min(...fa), hi = Math.max(...fa); let above = 0, below = 0;
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) if (isW(at(i, j))) { const a = along(i, j), acr = Math.abs((x0 + (i + 0.5) * PX - c[0]) * u[1] - (y0 + (j + 0.5) * PX - c[1]) * u[0]) / PX; if (acr < 2) { if (a > hi) above++; else if (a < lo) below++; } }
  // a finger parting: along the weapon's axis, a lit fist px, then a darker one (by ≥ 12 L), then a lit one again, all in the fist
  let parts = 0; for (const [i, j, l] of fist) for (const [di, dj] of [[0, 1], [1, 0]]) { const b = at(i + di, j + dj), e = at(i + 2 * di, j + 2 * dj);
    if (isF(b) && isF(e) && lum(b.rgb) < l - 12 && lum(b.rgb) < lum(e.rgb) - 12) parts++; }
  if (process.env.MAP) for (let j = 0; j < m; j++) { let r = ''; for (let i = 0; i < n; i++) { const q = at(i, j); r += !q ? ' ' : isF(q) ? String.fromCharCode(97 + Math.min(25, Math.floor(lum(q.rgb) / 4))) : isW(q) ? '|' : '.'; } if (/[a-z]/.test(r)) console.log('   ' + r); }
  shots.push({ tag: `${cls} ${wb}${ob ? '+' + ob : ''} ${act}`, n, m, cells, fi, spr });
  console.log(`${cls} ${wb}${ob ? '+' + ob : ''} ${act}: fist ${fist.length} px, L ${Ls.length ? Ls[0].toFixed(0) + '..' + Ls[Ls.length - 1].toFixed(0) : '-'}, tones ${new Set(fist.map(([i, j]) => at(i, j).rgb.join())).size}, finger partings ${parts}, weapon above ${above} below ${below} px, axis ${(Math.atan2(u[0], -u[1]) * 180 / Math.PI).toFixed(0)}°`);
}
const out = process.argv[2];
if (out) { const K = 12, COLS = 4, cw = Math.max(...shots.map((q) => q.n)) * K + 8, ch = Math.max(...shots.map((q) => q.m)) * K + 8, W = COLS * cw, H = Math.ceil(shots.length / COLS) * ch, img = Buffer.alloc(W * H * 3, 10);
  shots.forEach((q, si) => { const ox = (si % COLS) * cw, oy = Math.floor(si / COLS) * ch;
    for (let j = 0; j < q.m; j++) for (let i = 0; i < q.n; i++) { const cc = q.cells[j * q.n + i], col = cc ? cc.rgb : [36, 32, 40];
      for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) { const p = ((oy + j * K + y) * W + ox + i * K + x) * 3; img[p] = col[0]; img[p + 1] = col[1]; img[p + 2] = col[2]; } } });
  const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); let c = ~0; for (const x of b.subarray(4, 8 + d.length)) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } b.writeInt32BE(~c, 8 + d.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); console.log('→', out, shots.map((q) => q.tag).join(' | ')); }
