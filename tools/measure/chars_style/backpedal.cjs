// r5 style (author remark 7, TASKS 2202): the warrior walking against his facing, drawn as tools/measure/views2198/sheet.cjs draws\n// node tools/measure/chars_style/backpedal.cjs [OUT] [PREFIX]\n// node tools/measure/views2198/sheet.cjs <out dir> [prefix] [classes] : the hero of each class in motion, drawn in the node sandbox and
// composited on the CPU from the textures' own pixels (SIMX.heroLayers.compose, no shader: no grade, no soft bones), TASKS 2196–2198.
// The view comes from the sim: the hero first walks up for 0.5 s (the last way he went sticks to his view), then the way of the sheet for
// 0.4 s, then 12 frames of one stride are drawn walking (half speed) and running. One sheet per class and way, <prefix>_<class>_<way>.png
// (×3), and <prefix>_<class>_all.png with the 8 ways' running frame 0 and 6 side by side, plus the arch at rest for the mage
// (<prefix>_mage_arch.png; DROP=name,name previews the sheets without those textures, sampled at the arch's ×3.2 from its _menu textures).
const path = require('path'), fs = require('fs'), zlib = require('zlib'), ROOT = path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), A0 = SB.assets(), { drawHero, L } = SB.heroBox(D, SIM, A0), { compose } = SIMX.heroLayers;
const OUT = process.argv[2] || path.join(ROOT, 'frames/critic_chars_r5_style/views'), PRE = process.argv[3] || 'r5bp', CLS = ['warrior'];
const WAYS = { down: [0, 1], 'down-right': [1, 1], right: [1, 0], 'up-right': [1, -1], up: [0, -1], 'up-left': [-1, -1], left: [-1, 0], 'down-left': [-1, 1] };
const KIT = { warrior: { weapon: 'sword' }, mage: { weapon: 'staff' }, archer: { weapon: 'shortbow' } };
const BG = [52, 44, 40], BOX = [-44, -104, 44, 6];
function crc32(b) { let c, t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function writePng(file, W, H, rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) rgb.copy ? rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3) : raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), y * (W * 3 + 1) + 1);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
function stageOf(cls, eq) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 91, { cls }); S.run = R; S.screen = 'play'; S.t = R.t = 10; R.en = [];
  const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 12; x <= cx + 12; x++) m.cells[y * m.W + x] = 1; h.x = cx * SIMX.TILE + 16; h.y = cy * SIMX.TILE + 18;
  for (const [k, b] of Object.entries(eq)) h.eq[k] = { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 };
  return { S, R, h };
}
const go = (S, [dx, dy], n) => { const inp = { px: 480, py: 270 }; if (dx > 0) inp.right = 1; if (dx < 0) inp.left = 1; if (dy > 0) inp.down = 1; if (dy < 0) inp.up = 1; for (let i = 0; i < n; i++) SIM.step(S, inp); };
function frame(S, h, over, o = {}, K = 1) {
  const spr = [], J = {}; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; if (id === 'hero_view') J['v_' + n] = p; }; L.sprite = (n, x, y, q) => { spr.push({ n, o: q }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, h, over), 300, 300, S.t, SIMX.heroSt(S), o);
  const c = compose(spr, [300 + BOX[0], 300 + BOX[1], 300 + BOX[2], 300 + BOX[3]], K), rgb = Buffer.alloc(c.W * c.H * 3);
  for (let i = 0; i < c.W * c.H; i++) for (let ch = 0; ch < 3; ch++) rgb[i * 3 + ch] = c.top[i] >= 0 ? c.rgb[i * 3 + ch] : BG[ch];
  return { W: c.W, H: c.H, rgb, back: J.v_back ? J.v_back[0] : -1, face: J.v_face ? J.v_face[0] : 0, spr };
}
function sheet(file, rows, Z) {
  const fw = rows[0][0].W, fh = rows[0][0].H, n = Math.max(...rows.map((r) => r.length)), W = n * (fw + 2) * Z, H = rows.length * (fh + 2) * Z, rgb = Buffer.alloc(W * H * 3, 20);
  rows.forEach((r, j) => r.forEach((f, i) => { for (let y = 0; y < fh * Z; y++) for (let x = 0; x < fw * Z; x++) { const s = (Math.floor(y / Z) * fw + Math.floor(x / Z)) * 3, X = i * (fw + 2) * Z + x, Y = j * (fh + 2) * Z + y;
    for (let ch = 0; ch < 3; ch++) rgb[(Y * W + X) * 3 + ch] = f.rgb[s + ch]; }
    if (f.back > 0.5) for (let y = 0; y < 3 * Z; y++) for (let x = 0; x < 3 * Z; x++) { const X = i * (fw + 2) * Z + x, Y = j * (fh + 2) * Z + y; rgb[(Y * W + X) * 3] = 255; rgb[(Y * W + X) * 3 + 1] = 0; rgb[(Y * W + X) * 3 + 2] = 255; } }));
  writePng(file, W, H, rgb);
}
fs.mkdirSync(OUT, { recursive: true });
// the warrior walking one way while facing the other (an attack held against the way: sim_hero.js busy -> face from the aim)
for (const [nm, dv, face] of [['left_face_right', [-1, 0], 1], ['right_face_left', [1, 0], -1], ['downleft_face_right', [-1, 1], 1], ['left_face_left', [-1, 0], -1], ['right_face_right', [1, 0], 1]]) {
  const { S, h } = stageOf('warrior', KIT.warrior); go(S, dv, 48); const rows = [];
  for (const k of [0.5, 1]) rows.push(Array.from({ length: 12 }, (_, i) => frame(S, h, { vx: h.vx * k, vy: h.vy * k, gp: i * 2 * Math.PI / 12, face }))) ;
  sheet(path.join(OUT, `${PRE}_warrior_${nm}.png`), rows, 3);
}
