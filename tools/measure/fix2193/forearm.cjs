// node tools/measure/fix2193/forearm.cjs [--ref <git rev>] : (TASKS 2193, chars_menu_r4.md 4) the slot between the near forearm and the hip
// in the arch at rest: composited on the CPU at the texture's density from the sprites drawHero lays, per texel row from the elbow down
// to the hand, the cape, the quiver or nothing on top with the near forearm (farmL, its cuff or fist) within REACH texels on the arm's
// side and the torso within REACH on the other. Prints world px² per class and outfit over 10 moments of the rest (max and mean).
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const TEX = {}, png = (n) => TEX[n] || (TEX[n] = (() => {
  const buf = fs.readFileSync(path.join(ROOT, 'live/assets', n + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
  const idat = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o); if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = W * 4, px = Buffer.alloc(H * st);
  for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = y * (st + 1) + 1, o = y * st;
    for (let x = 0; x < st; x++) { const a = x >= 4 ? px[o + x - 4] : 0, b = y ? px[o - st + x] : 0, c = x >= 4 && y ? px[o - st + x - 4] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[o + x] = (raw[r + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
  return { W, H, P: px }; })());
const covers = (q, X, Y) => { const t = png(q.n), o = q.o, [a, b, c, d, e, f] = o.m, det = a * d - b * c; X -= e; Y -= f;
  const u = Math.floor(((d * X - c * Y) / det + o.pivot[0]) / o.w * t.W), v = Math.floor(((-b * X + a * Y) / det + o.pivot[1]) / o.h * t.H);
  return u >= 0 && v >= 0 && u < t.W && v < t.H && t.P[(v * t.W + u) * 4 + 3] >= 128; };
const Z = 360 / 84, REACH = 14, KITS = { warrior: [{ weapon: 'sword' }, { weapon: 'sword', armor: 'plate_armor' }, { weapon: 'sword', armor: 'cloak' }],
  archer: [{ weapon: 'shortbow' }, { weapon: 'longbow', armor: 'cloak' }] };
const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
for (const [cls, kits] of Object.entries(KITS)) for (const kit of kits) { const v = [];
  for (let i = 0; i < 10; i++) {
    const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R;
    for (const [k, b] of Object.entries(kit)) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot: k } : undefined;
    const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
    drawHero(Object.assign({}, R.hero, base), 300, 300, 10 + i * 0.76, SIMX.heroSt(S), { menu: 1 });
    const rig = D.CLASSES[cls].look.rig + '__', vis = spr.filter((q) => q.o && q.o.m && !(q.o.u && q.o.u.alpha < 0.5)), el = J.elbowL, hd = J.handL, H = J.ground[1] - J.top[1];
    const x0 = Math.floor((el[0] - 0.12 * H) * Z), x1 = Math.ceil((el[0] + 0.12 * H) * Z), y0 = Math.floor(el[1] * Z), y1 = Math.ceil(hd[1] * Z), W = x1 - x0, Hh = y1 - y0, kind = new Uint8Array(W * Hh);
    for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) for (const q of vis) { let c; try { c = covers(q, (x0 + px + 0.5) / Z, (y0 + py + 0.5) / Z); } catch (e) { continue; } if (!c) continue;
      kind[py * W + px] = /__(cape|quiver)/.test(q.n) || !q.n.startsWith(rig) ? 0 : /__(farm|cuff|fist)L/.test(q.n) && !q.n.includes('_sock') ? 2 : q.n.startsWith(rig + 'body') ? 3 : 1; }
    let n = 0; for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { if (kind[y * W + x]) continue; let a = 0, b = 0;
      for (let s = 1; s <= REACH; s++) { if (x - s >= 0 && kind[y * W + x - s] === 2) a = 1; if (x + s < W && kind[y * W + x + s] === 3) b = 1; } if (a && b) n++; }
    v.push(n / Z / Z); }
  console.log(`${cls} ${Object.values(kit).join(' ').padEnd(18)} slot forearm–hip in the arch: max ${Math.max(...v).toFixed(2)} mean ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)} world px²`); }
