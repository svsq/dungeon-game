// node tools/measure/chars_motion/arm2204.cjs [outdir] : author remark 11 / TASKS 2204, the mage's weapon arm (screen-right, the far arm R)
// at rest, arch (menu, sampled at 360/84 per world px) and world (×4), each outfit × helm × staff/wand, CPU composite of the node sandbox
// (SIMX.heroLayers.compose, no shader). Per pose: mean Lab of the sleeve's top (pixels whose top sprite is mage__uarmR*, the upper half
// of the upper arm) against the torso next to the shoulder (mage__body* pixels lighter than L* 20, in the robe only its blue, b* < -5, within 0.07 H of shR, toward the body's centre), ΔE76;
// the outline at the joint: dark px (L* < 20) whose top sprite is uarmR or body, in a 0.035 H band round the arm's top edge, as world px²
// and as px per world px of the band's length; <outdir>/arm_<kit>_<armor>_<helm>_<arch|world>.png the shoulder ×2 of the sample.
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { compose } = SIMX.heroLayers;
const OUT = process.argv[2] || path.join(ROOT, 'frames/critic_chars_r5_motion/arm'); fs.mkdirSync(OUT, { recursive: true });
const lab = ([r, g, b]) => { const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }, R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
function crc32(b) { let c; const t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function writePng(file, W, H, rgb) { const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
const f1 = (v) => v.toFixed(1), rows = [];
for (const weapon of ['staff', 'wand']) for (const armor of ['robe', 'leather_armor', 'cloak']) for (const helm of ['', 'circlet', 'leather_helm']) for (const menu of [1, 0]) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; const it = (b) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 });
  R.hero.eq.weapon = it(weapon); R.hero.eq.armor = it(armor); if (helm) R.hero.eq.helm = it(helm); else delete R.hero.eq.helm; if (weapon === 'wand') R.hero.eq.offhand = it('orb');
  const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), 300, 300, 10, SIMX.heroSt(S), menu ? { menu: 1 } : {});
  const H = J.ground[1] - J.top[1], sh = J.shR, el = J.elbowR || [sh[0], sh[1] + 0.15 * H], Z = menu ? 360 / 84 : 4;
  const x0 = sh[0] - 0.24 * H, y0 = sh[1] - 0.2 * H, c = compose(spr, [x0, y0, sh[0] + 0.2 * H, el[1] + 0.12 * H], Z);
  const nm = (i) => (c.top[i] >= 0 ? spr[c.top[i]].n : ''), P = (i) => [c.rgb[i * 3], c.rgb[i * 3 + 1], c.rgb[i * 3 + 2]];
  const sx = (sh[0] - x0) * Z, sy = (sh[1] - y0) * Z, ey = (el[1] - y0) * Z, mid = (sy + ey) / 2;
  const acc = () => ({ n: 0, s: [0, 0, 0] }), arm = acc(), tor = acc(); let dark = 0;
  const armTop = new Int32Array(c.W).fill(-1);
  for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) { const i = y * c.W + x, n = nm(i); if (/__uarmR/.test(n) && armTop[x] < 0) armTop[x] = y; }
  for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) { const i = y * c.W + x, n = nm(i); if (!n) continue; const q = lab(P(i));
    if (/__uarmR/.test(n) && y < mid && q[0] >= 20) { arm.n++; for (let j = 0; j < 3; j++) arm.s[j] += q[j]; }
    if (/__body/.test(n) && x < sx && x > sx - 0.07 * H * Z && Math.abs(y - sy) < 0.07 * H * Z && q[0] >= 20 && (armor !== 'robe' || q[2] < -5)) { tor.n++; for (let j = 0; j < 3; j++) tor.s[j] += q[j]; }
    if ((/__uarmR/.test(n) || /__body/.test(n)) && q[0] < 20 && armTop[x] >= 0 && Math.abs(y - armTop[x]) < 0.035 * H * Z && y < mid) dark++; }
  const band = armTop.filter((v) => v >= 0).length / Z, A = arm.s.map((v) => v / Math.max(arm.n, 1)), T = tor.s.map((v) => v / Math.max(tor.n, 1)), dE = Math.hypot(...A.map((v, j) => v - T[j]));
  const tag = `${weapon} ${armor} ${helm || 'nohelm'} ${menu ? 'arch' : 'world'}`;
  rows.push(`${tag.padEnd(36)} sleeve top Lab ${A.map(f1).join(' ')}  torso Lab ${T.map(f1).join(' ')}  ΔE76 ${f1(dE)}  joint outline ${f1(dark / Z / Z)} world px² over ${f1(band)} px (${(dark / Z / Z / Math.max(band, 1)).toFixed(2)} px deep)`);
  const K = 2, W = c.W * K, Hh = c.H * K, rgb = new Uint8Array(W * Hh * 3);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = Math.floor(y / K) * c.W + Math.floor(x / K), o = (y * W + x) * 3; for (let j = 0; j < 3; j++) rgb[o + j] = c.top[i] >= 0 ? c.rgb[i * 3 + j] : [24, 40, 24][j]; }
  writePng(path.join(OUT, `arm_${tag.replace(/ /g, '_')}.png`), W, Hh, rgb);
}
console.log(rows.join('\n'));
