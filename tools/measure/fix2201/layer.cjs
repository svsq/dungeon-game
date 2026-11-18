// node tools/measure/fix2201/layer.cjs [out.json] [--seq whirl|cry|blow] : the warrior's weapon arm (uarmR, farmR, cuffR, fistR and the
// weapon: group R) through the whirl (aimed right and left), the war cry and the blow (right, down, up, left, up-left), 60 fps in the
// node sandbox, the sprites composited on the CPU from the textures' own pixels (SIMX.heroLayers.compose). Per frame: where group R is
// drawn (u under the body, o over it, u+o both: the cross-fade), the over copy's alpha, and `lap`, the px of group R that the sprites
// between the two layers (the body, the helm, the back view, the near arm) also cover: what flips on a switch of the layer that frame,
// and what shows as a ghost (the over copy at its share) while both copies are drawn. Per sequence: the frames drawn twice, the ghost
// px·alpha summed, each switch with its frame and its lap.
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { compose } = SIMX.heroLayers;
const args = process.argv.slice(2), pngDir = args.includes('--png') ? args[args.indexOf('--png') + 1] : null, only = args.includes('--seq') ? args[args.indexOf('--seq') + 1] : null, out = args.find((a) => a.endsWith('.json'));
const FPS = 60, T0 = 10, PN = 'hero__', RGRP = /^(hero__(uarmR|farmR|cuffR|fistR)|it_)/;
const base = { vx: 0, vy: 0, gp: 40, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
function frame(hx, t, wb) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'warrior' }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
  const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, hx), 300, 300, T0 + t, SIMX.heroSt(S), {});
  return { J, spr };
}
function png(n) {
  const buf = fs.readFileSync(path.join(ROOT, 'live/assets', n + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20), idat = [];
  for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o); if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = W * 4, px = Buffer.alloc(H * st);
  for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = y * (st + 1) + 1, o = y * st;
    for (let x = 0; x < st; x++) { const a = x >= 4 ? px[o + x - 4] : 0, b = y ? px[o - st + x] : 0, c = x >= 4 && y ? px[o - st + x - 4] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[o + x] = (raw[r + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
  return { W, H, P: px };
}
// the frame as drawn, each sprite at its alpha (compose counts a sprite under half its alpha as absent): the ghost shows here
const TX = {}, BG = [52, 44, 40];
function paint(spr, box, Z) {
  const [x0, y0, x1, y1] = box, W = Math.ceil((x1 - x0) * Z), H = Math.ceil((y1 - y0) * Z), rgb = new Float32Array(W * H * 3);
  for (let k = 0; k < W * H; k++) rgb.set(BG, k * 3);
  for (const q of spr) { const o = q.o; if (!o || !o.m) continue; const t = TX[q.n] || (TX[q.n] = png(q.n)), [a, b, c, dd, e, f] = o.m, det = a * dd - b * c, al = alphaOf(q); if (!det || al <= 0) continue;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const X = x0 + (px + 0.5) / Z - e, Y = y0 + (py + 0.5) / Z - f;
      const u = Math.floor(((dd * X - c * Y) / det + o.pivot[0]) / o.w * t.W), v = Math.floor(((-b * X + a * Y) / det + o.pivot[1]) / o.h * t.H);
      if (u < 0 || v < 0 || u >= t.W || v >= t.H) continue; const i = (v * t.W + u) * 4, A = al * t.P[i + 3] / 255; if (A <= 0) continue;
      for (let ch = 0; ch < 3; ch++) rgb[(py * W + px) * 3 + ch] += (t.P[i + ch] - rgb[(py * W + px) * 3 + ch]) * A; } }
  return { W, H, rgb };
}
function crc32(b) { let c; const t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function writePng(file, W, H, rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) for (let x = 0; x < W * 3; x++) raw[y * (W * 3 + 1) + 1 + x] = Math.round(rgb[y * W * 3 + x]);
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const alphaOf = (q) => (q.o.u && q.o.u.alpha !== undefined ? q.o.u.alpha : 1);
function measure(f) {
  const { spr, J } = f, body = spr.findIndex((q) => q.n.startsWith(PN + 'body')), rIdx = spr.map((q, i) => (RGRP.test(q.n) ? i : -1)).filter((i) => i >= 0);
  const under = rIdx.filter((i) => i < body), over = rIdx.filter((i) => i > body), oa = over.length ? Math.min(...over.map((i) => alphaOf(spr[i]))) : 0;
  const end = over.length ? over[0] : spr.length, occ = spr.filter((q, i) => i >= body && i < end && !RGRP.test(q.n));
  const box = [J.ground[0] - 60, J.ground[1] - 110, J.ground[0] + 60, J.ground[1] + 6];
  const rs = rIdx.map((i) => ({ n: spr[i].n, o: Object.assign({}, spr[i].o, { u: Object.assign({}, spr[i].o.u, { alpha: 1 }) }) }));
  const cr = compose(rs, box, 1), co = compose(occ, box, 1), lapOf = (re) => { let n = 0; for (let k = 0; k < cr.top.length; k++) if (cr.top[k] >= 0 && co.top[k] >= 0 && re.test(rs[cr.top[k]].n)) n++; return n; };
  const lap = lapOf(/./), armLap = lapOf(/__(uarmR|farmR|cuffR)/), wpnLap = lapOf(/^it_|__fistR/);
  const wpn = rIdx.filter((i) => /^it_|__fistR/.test(spr[i].n)), lay = (ix) => ix.length ? (ix.some((i) => i < body) ? 'u' : '') + (ix.some((i) => i > body) ? 'o' : '') : '-';
  return { arm: lay(rIdx.filter((i) => !/^it_|__fistR/.test(spr[i].n))), wpn: lay(wpn), oa: +oa.toFixed(2), lap, armLap, wpnLap, twice: under.length > 0 && over.length > 0 && oa > 0 && oa < 1 };
}
const SEQS = [];
for (const face of [1, -1]) SEQS.push([`whirl ${face > 0 ? 'right' : 'left'}`, 'whirl', { whirlT: T0, face, aim: face > 0 ? 0 : Math.PI, whirlA: face > 0 ? 0 : Math.PI }, 0.62]);
SEQS.push(['cry', 'cry', { castT: T0, castK: 'cry' }, 0.8]);
for (const [an, aim] of [['right', 0], ['down', Math.PI / 2], ['up', -Math.PI / 2], ['left', Math.PI], ['up-left', -2.3]])
  SEQS.push([`blow ${an}`, 'blow', { atkT: T0, aim, atkA: aim, face: Math.cos(aim) < -0.1 ? -1 : 1 }, 0.7]);
const res = {};
for (const [name, kind, hx, dur] of SEQS) {
  if (only && kind !== only) continue;
  const rows = [], strip = [], Z = 3; for (let k = 0; k <= Math.round(dur * FPS); k++) { const f = frame(hx, k / FPS, 'sword'); rows.push(measure(f));
    if (pngDir && k % 1 === 0 && k <= 40) strip.push(paint(f.spr, [f.J.ground[0] - 40, f.J.ground[1] - 100, f.J.ground[0] + 40, f.J.ground[1] + 4], Z)); }
  if (pngDir) { const fw = strip[0].W, fh = strip[0].H, per = 14, nr = Math.ceil(strip.length / per), W = fw * per, H = fh * nr, rgb = new Float32Array(W * H * 3);
    strip.forEach((s0, i) => { const ox = (i % per) * fw, oy = Math.floor(i / per) * fh; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) for (let ch = 0; ch < 3; ch++) rgb[((oy + y) * W + ox + x) * 3 + ch] = s0.rgb[(y * fw + x) * 3 + ch]; });
    fs.mkdirSync(pngDir, { recursive: true }); writePng(path.join(pngDir, name.replace(/ /g, '_') + '.png'), W, H, rgb); }
  const twice = rows.map((r, k) => (r.twice ? k : -1)).filter((k) => k >= 0), ghost = rows.reduce((a, r) => a + (r.twice ? r.lap * r.oa : 0), 0);
  const sw = []; for (let k = 1; k < rows.length; k++) for (const g of ['arm', 'wpn']) if (rows[k][g] !== rows[k - 1][g]) sw.push(`${g} ${rows[k - 1][g]}→${rows[k][g]}@f${k} lap ${rows[k][g === 'arm' ? 'armLap' : 'wpnLap']}`);
  res[name] = rows;
  console.log(`${name.padEnd(13)} drawn twice ${twice.length} frames${twice.length ? ` (f${twice.join(' f')})` : ''}, ghost ${ghost.toFixed(0)} px·α; switches: ${sw.join(', ') || 'none'}`);
  if (args.includes('-v')) console.log('  ' + rows.map((r, k) => `f${k}:${r.arm}/${r.wpn}${r.twice ? '*' + r.oa : ''}:${r.armLap}+${r.wpnLap}`).join(' '));
}
if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res)); }
