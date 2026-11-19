// node tools/measure/mage_2190/hand.cjs : the mage's orb hand as heroFistCheck (TASKS 2190) counts it, in numbers, world and arch at rest
// and in a frost cast: the cup's skin on the orb's face (inside 0.85 r) and its highest texel under the orb's centre (in r of the orb's
// rim, in the cup's own frame), skin texels round the lower outer rim, the wrist's rise from the under-sleeve to the palm, the cup's and
// the forearm's turn in the cast off rest, the orb's centre and size over the soles in shares of the height; ROOT=<copy> for another tree
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const png = (n) => { const buf = fs.readFileSync(path.join(ROOT, 'live/assets', n + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20), bpp = { 6: 4, 2: 3, 4: 2, 0: 1 }[buf[25]];
  const idat = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8); if (type === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(W * H * bpp), st = W * bpp;
  for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)), o = y * st;
    for (let x = 0; x < st; x++) { const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - st + x] : 0, c = x >= bpp && y ? px[o - st + x - bpp] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[o + x] = (r[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
  return { W, H, px, bpp }; };
const texels = (q, keep) => { const t = png(q.n), o = q.o, pts = [];
  for (let y = 0; y < t.H; y++) for (let x = 0; x < t.W; x++) { const i = (y * t.W + x) * t.bpp, c = [t.px[i], t.px[i + 1], t.px[i + 2]]; if (t.px[i + 3] > 127 && keep(c)) pts.push(L.M.ap(o.m, [(x + 0.5) / t.W * o.w - o.pivot[0], (y + 0.5) / t.H * o.h - o.pivot[1]])); }
  return pts; };
const skin = ([r, g, b]) => r > g && g > b && r - b > 40, cream = ([r, g, b]) => r > 110 && b >= r - 10 && Math.abs(r - g) < 40;
const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), f2 = (x) => x.toFixed(2);
function draw(extra, o) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; R.hero.eq.weapon = { id: 0, b: 'staff', rar: 0, lvl: 1, mods: {}, atk: 6 };
  R.hero.eq.offhand = { id: 0, b: 'orb', rar: 0, lvl: 1, mods: {}, def: 2 };
  const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, q) => { spr.push({ n, o: q }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, extra), 300, 300, extra.castT === 10 ? 10.3 : 10, SIMX.heroSt(S), o); return { J, spr };
}
for (const [tag, o] of [['world', {}], ['arch', { menu: 1 }]]) {
  const res = {};
  for (const [act, extra] of [['rest', {}], ['cast', { castT: 10, castK: 'frost' }]]) {
    const { J, spr } = draw(extra, o), orb = spr.find((q) => /^orb_held/.test(q.n)), cup = spr.find((q) => /^mage__cupL/.test(q.n)), oc = [orb.o.m[4], orb.o.m[5]], H = J.ground[1] - J.top[1];
    const u0 = L.M.ap(cup.o.m, [0, -1]), c0 = L.M.ap(cup.o.m, [0, 0]), ul = d(u0, c0), up = [(u0[0] - c0[0]) / ul, (u0[1] - c0[1]) / ul], ox = [up[1], -up[0]];
    const r = orb.o.h / 2 * 0.85, loc = (p) => { const v = [p[0] - oc[0], p[1] - oc[1]]; return [v[0] * ox[0] + v[1] * ox[1], -(v[0] * up[0] + v[1] * up[1])]; };
    const sk = texels(cup, skin).map(loc), cr = texels(cup, cream).map(loc), hy = (q) => Math.hypot(q[0], q[1]);
    const mean = (a) => a.reduce((m, q) => [m[0] + q[0] / a.length, m[1] + q[1] / a.length], [0, 0]), a = mean(cr), b = mean(sk.filter((q) => q[1] > 0.9 * r));
    res[act] = { ang: Math.atan2(up[1], up[0]), fore: Math.atan2(J.handL[1] - J.elbowL[1], J.handL[0] - J.elbowL[0]) };
    if (act === 'rest') console.log(`${tag}: orb centre ${f2((J.ground[1] - oc[1]) / H)} H, diameter ${f2(orb.o.h)} px (${f2(orb.o.h / H)} H); skin on the face ${sk.filter((q) => hy(q) < 0.85 * r).length} of ${sk.length} texels; highest skin ${f2(Math.min(...sk.map((q) => q[1])) / r)} r under the centre; rim skin ${sk.filter((q) => hy(q) >= 0.85 * r && hy(q) < 1.35 * r && q[0] < 0 && q[1] > 0).length + sk.filter((q) => hy(q) >= 0.85 * r && hy(q) < 1.35 * r && q[0] > 0 && q[1] > 0).length}; wrist ${cr.length ? (Math.atan2(a[1] - b[1], Math.abs(b[0] - a[0])) * 180 / Math.PI).toFixed(0) + '°' : '-'}; handL ${f2((J.ground[1] - J.handL[1]) / H)} H`);
  }
  const wr = (x) => x - 2 * Math.PI * Math.floor((x + Math.PI) / (2 * Math.PI));
  console.log(`${tag} cast: forearm turns ${f2(wr(res.cast.fore - res.rest.fore))} rad, the cup ${f2(wr(res.cast.ang - res.rest.ang))} rad`);
}
