// node tools/measure/fix2201/sock.cjs [out.json] [--png dir] : the 2188/2191/2194 copy of the near upper arm (<rig>__uarmL*_sock) where it
// is on top, in world px² (SIMX.shoulder.shoulderGap, the heroShoulderCheck pose list: rest, run, each class's actions, turn, hurt,
// dash, every kit) per class and pose kind, the worst pose of each; --png writes the worst ones ×4 (green ground, the copy's own pixels
// as drawn; magenta a gap, cyan the dark seam)
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { poses, shoulderGap } = SIMX.shoulder, { compose } = SIMX.heroLayers;
// the copy (upper arm and forearm) on top anywhere in the figure, world px² sampled at 4 per px: the window of shoulderGap ends at the elbow
function whole(p) { const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: p.cls }); S.run = R;
  for (const [k, b] of Object.entries(p.kit)) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot: k } : undefined;
  const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, p.h), 300, 300, p.GT, SIMX.heroSt(S), p.o);
  const z = p.o.menu ? 1 : 4, k = p.o.menu ? 3.2 : 1, c = compose(spr, [J.ground[0] - 60 * k, J.ground[1] - 110 * k, J.ground[0] + 60 * k, J.ground[1] + 6 * k], z); let n = 0;
  for (const t of c.top) if (t >= 0 && /_sock/.test(spr[t].n)) n++; return n / z / z / (k * k); }
const args = process.argv.slice(2), out = args.find((a) => a.endsWith('.json')), pngDir = args.includes('--png') ? args[args.indexOf('--png') + 1] : null;
function crc32(b) { let c; const t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function writePng(file, W, H, rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const res = {}, worst = {};
for (const cls of ['warrior', 'archer', 'mage']) for (const p of poses(cls)) {
  const r = shoulderGap(drawHero, L, p, p.o.menu ? 360 / 84 : 4); if (r.back) continue;
  const kind = p.tag.split(' ').slice(1).join(' ').replace(/ (aim|at|face|\+|\d).*$/, '').replace(/^\S+ /, (w) => (/:/.test(w) ? w : '')).trim();
  const key = `${cls} ${p.tag.match(/ (rest|arch rest|run \w+|blow|whirl|charge|cry|shot|volley|frost|fireball|turn|hurt|dash)\b/)?.[1] || kind}`;
  const wh = whole(p); res[p.tag] = [+r.sock.toFixed(2), +r.sockOut.toFixed(2), +wh.toFixed(2)];
  const kw = key + ' whole'; if (!worst[kw] || wh > worst[kw].v) worst[kw] = { v: wh, tag: p.tag, p };
  if (!worst[key] || r.sock > worst[key].v) worst[key] = { v: r.sock, tag: p.tag, p };
  const ko = key + ' out'; if (!worst[ko] || r.sockOut > worst[ko].v) worst[ko] = { v: r.sockOut, tag: p.tag, p };
}
for (const [k, w] of Object.entries(worst)) console.log(`${k.padEnd(24)} copy on top max ${w.v.toFixed(2)} world px²  (${w.tag}; upper arm turned ${shoulderGap(drawHero, L, w.p).turn.toFixed(2)} rad)`);
if (pngDir) { fs.mkdirSync(pngDir, { recursive: true });
  for (const [k, w] of Object.entries(worst)) if (w.v > 0.5) { const r = shoulderGap(drawHero, L, w.p, 8, true); writePng(path.join(pngDir, k.replace(/[ :]/g, '_') + '.png'), r.img.W, r.img.H, r.img.rgba); } }
if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res)); }
