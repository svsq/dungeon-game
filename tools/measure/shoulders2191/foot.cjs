// node tools/measure/shoulders2191/foot.cjs OUT_DIR : where the near arm (uarmL, farmL or its cuff) lies over each warrior, archer and mage
// torso texture in the poses where the torso's near side shows (the arch and the world at rest, both facings, 20 moments over the sway's 7.6 s), as
// texel masks of the body texture: PNG per body texture (<name>_o.png: the kits with an offhand, the mage's orb), R = the upper arm in every pose, G = the upper arm in any pose, B = the forearm
// in any pose; <name>_f.png: R = the forearm in every pose. The arch's _menu textures and the world's are kept apart. tools/fix_2191.py reads them to lay the torso's side strip under the sleeve.
// node tools/measure/shoulders2191/foot.cjs OUT_DIR hero_b,mage_c : those looks only (TASKS 2148), each drawn with its own rig even while live/data_hero.js still aliases its art to «a»
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const lookRig = (cls, id) => D.CLASSES[cls].look.rig + (id === 'a' ? '' : '_' + id);
const looksOf = (cls) => (ONLY ? Object.values(D.LOOKS[cls]).filter((l) => ONLY.includes(lookRig(cls, l.id))).map((l) => Object.assign(l, { art: l.id, rig: lookRig(cls, l.id) })) : [null]);
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
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const covers = (q, X, Y) => { const t = png(q.n), o = q.o, [a, b, c, d, e, f] = o.m, det = a * d - b * c; X -= e; Y -= f;
  const u = Math.floor(((d * X - c * Y) / det + o.pivot[0]) / o.w * t.W), v = Math.floor(((-b * X + a * Y) / det + o.pivot[1]) / o.h * t.H);
  return u >= 0 && v >= 0 && u < t.W && v < t.H && t.P[(v * t.W + u) * 4 + 3] >= 128; };
const KITS = { warrior: [{ weapon: 'sword' }, { weapon: 'sword', armor: 'plate_armor' }, { weapon: 'sword', armor: 'cloak' }, { weapon: 'sword', armor: '' }],
  archer: [{ weapon: 'shortbow' }, { weapon: 'shortbow', armor: 'cloak' }],
  mage: [{ weapon: 'staff' }, { weapon: 'staff', offhand: 'orb' }, { weapon: 'staff', armor: 'leather_armor' }, { weapon: 'staff', armor: 'cloak' }] };
const base = { vx: 0, vy: 0, gp: 0, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
const acc = {};
for (const [cls, kits] of Object.entries(KITS)) for (const lk of looksOf(cls)) for (const kit of kits) for (const menu of [1, 0]) for (const face of menu ? [1] : [1, -1]) for (let i = 0; i < 20; i++) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, lk ? { cls, look: lk.id } : { cls }); S.run = R;
  for (const [k, b] of Object.entries(kit)) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot: k } : undefined;
  const spr = []; L.joint = () => {}; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, { face }), 300, 300, 10 + i * 0.38, SIMX.heroSt(S), menu ? { menu: 1 } : {});
  const rig = (lk ? lk.rig : D.CLASSES[cls].look.rig) + '__', body = spr.find((q) => q.n.startsWith(rig + 'body') && !q.n.includes('back'));
  const arm = spr.filter((q) => q.n.startsWith(rig) && !q.n.includes('_sock')), up = arm.find((q) => q.n.startsWith(rig + 'uarmL')), fore = arm.find((q) => /__(farm|cuff)L/.test(q.n));
  const key = body.n + (kit.offhand ? '_o' : ''), t = png(body.n), o = body.o, [a, b, c, d, e, f] = o.m;
  const A = acc[key] || (acc[key] = { W: t.W, H: t.H, all: new Uint8Array(t.W * t.H).fill(1), any: new Uint8Array(t.W * t.H), fore: new Uint8Array(t.W * t.H), fall: new Uint8Array(t.W * t.H).fill(1), n: 0 });
  A.n++;
  for (let v = 0; v < t.H; v++) for (let u = 0; u < t.W; u++) {
    const lx = (u + 0.5) / t.W * o.w - o.pivot[0], ly = (v + 0.5) / t.H * o.h - o.pivot[1], X = a * lx + c * ly + e, Y = b * lx + d * ly + f, i2 = v * t.W + u;
    const cu = covers(up, X, Y); if (!cu) A.all[i2] = 0; if (cu) A.any[i2] = 1; const cf = fore && covers(fore, X, Y); if (cf) A.fore[i2] = 1; else A.fall[i2] = 0; }
}
for (const [k, A] of Object.entries(acc)) { const im = new Uint8Array(A.W * A.H * 4);
  for (let i = 0; i < A.W * A.H; i++) { im[i * 4] = A.all[i] * 255; im[i * 4 + 1] = A.any[i] * 255; im[i * 4 + 2] = A.fore[i] * 255; im[i * 4 + 3] = 255; }
  writePng(path.join(OUT, k + '.png'), A.W, A.H, im);
  const fm = new Uint8Array(A.W * A.H * 4); for (let i = 0; i < A.W * A.H; i++) { fm[i * 4] = A.fall[i] * 255; fm[i * 4 + 3] = 255; }
  writePng(path.join(OUT, k + '_f.png'), A.W, A.H, fm); console.log(k, A.n, 'poses'); }
