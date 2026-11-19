// node tools/measure/fix2204/owners.cjs out.png [weapon armor helm menu vx GT face] : the mage's far (weapon) arm at rest, composited by the
// node sandbox (SIMX.heroLayers.compose); the colour beside each pixel's texel tells its sprite: left the picture ×6, right the owners
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { compose } = SIMX.heroLayers;
const [out, weapon = 'staff', armor = 'robe', helm = '', menu = '1', vx = '0', GT = '10', face = '1'] = process.argv.slice(2);
const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; const it = (b) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 });
R.hero.eq.weapon = it(weapon); R.hero.eq.armor = it(armor); if (helm && helm !== '-') R.hero.eq.helm = it(helm); else delete R.hero.eq.helm;
const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
drawHero(Object.assign({}, R.hero, { vx: +vx * +face, vy: 0, gp: +GT * 4, face: +face, aim: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), 300, 300, +GT, SIMX.heroSt(S), menu === '1' ? { menu: 1 } : {});
const H = J.ground[1] - J.top[1], sh = J.shR, f = +face, Z = menu === '1' ? 360 / 84 : 4, box = [sh[0] - (f > 0 ? 0.15 : 0.15) * H, sh[1] - 0.08 * H, sh[0] + 0.15 * H, sh[1] + 0.35 * H], c = compose(spr, box, Z);
const pal = { body: [90, 90, 90], uarmR: [0, 200, 255], farmR: [255, 255, 0], cuffR: [255, 0, 255], fistR: [255, 128, 0], it_: [0, 255, 0] };
const K = 6, W = c.W * K * 2 + 8, Hh = c.H * K, rgb = new Uint8Array(W * Hh * 3);
for (let y = 0; y < Hh; y++) for (let x = 0; x < c.W * K; x++) { const i = Math.floor(y / K) * c.W + Math.floor(x / K), n = c.top[i] >= 0 ? spr[c.top[i]].n : '';
  const k = Object.keys(pal).find((p) => n.includes(p)), o1 = (y * W + x) * 3, o2 = (y * W + x + c.W * K + 8) * 3;
  for (let j = 0; j < 3; j++) { rgb[o1 + j] = n ? c.rgb[i * 3 + j] : 24; rgb[o2 + j] = n ? (k ? pal[k][j] : 160) * 0.5 + c.rgb[i * 3 + j] * 0.5 : 0; } }
function crc32(b) { let c; const t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const raw = Buffer.alloc((W * 3 + 1) * Hh); for (let y = 0; y < Hh; y++) Buffer.from(rgb.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cc = Buffer.alloc(4); cc.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, cc]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(Hh, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(spr.map((q) => q.n).filter((n) => /mage__|it_/.test(n)).join(' '));
