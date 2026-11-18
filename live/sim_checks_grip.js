// live/sim_checks_grip.js — selfCheck's part for the warrior's grip on his weapons (TASKS 2170), counted on the textures' own pixels. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, heroSt, newRun, spawn } = SIMX, fs = require('fs'), zlib = require('zlib'), path = require('path');
  function png(n) {
    const buf = fs.readFileSync(path.join(__dirname, 'assets', n + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
    if (buf[24] !== 8 || buf[25] !== 6) throw new Error(n + ': only 8-bit RGBA PNGs are read');
    const idat = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o); if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
    const raw = zlib.inflateSync(Buffer.concat(idat)), st = W * 4, px = Buffer.alloc(H * st);
    for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = y * (st + 1) + 1, o = y * st;
      for (let x = 0; x < st; x++) { const a = x >= 4 ? px[o + x - 4] : 0, b = y ? px[o - st + x] : 0, c = x >= 4 && y ? px[o - st + x - 4] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        px[o + x] = (raw[r + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
    const A = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) A[i] = px[i * 4 + 3]; return { W, H, A, P: px };
  }
  // a drawn sprite's opaque texels on the screen: (u w − pivot) through its matrix, one point per texel
  const TEX = {}, texelsOf = (L, q) => { const t = TEX[q.n] || (TEX[q.n] = png(q.n)), o = q.o, pts = [];
    for (let y = 0; y < t.H; y++) for (let x = 0; x < t.W; x++) if (t.A[y * t.W + x] > 127) pts.push(L.M.ap(o.m, [(x + 0.5) / t.W * o.w - o.pivot[0], (y + 0.5) / t.H * o.h - o.pivot[1]]));
    return pts; };
  // (TASKS 2192) which sprite shows at each pixel of a screen box (Z samples a px): the index of the last one drawn with an opaque texel
  // there, −1 for none; one drawn at under half its alpha does not count
  function compose(spr, box, Z = 1) {
    const [x0, y0, x1, y1] = box, W = Math.ceil((x1 - x0) * Z), H = Math.ceil((y1 - y0) * Z), top = new Int32Array(W * H).fill(-1), rgb = new Uint8Array(W * H * 3);
    spr.forEach((q, i) => { const o = q.o; if (!o || !o.m || (o.u && o.u.alpha !== undefined && o.u.alpha < 0.5)) return;
      const t = TEX[q.n] || (TEX[q.n] = png(q.n)), [a, b, c, dd, e, f] = o.m, det = a * dd - b * c; if (!det) return;
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const X = x0 + (px + 0.5) / Z - e, Y = y0 + (py + 0.5) / Z - f;
        const u = Math.floor(((dd * X - c * Y) / det + o.pivot[0]) / o.w * t.W), v = Math.floor(((-b * X + a * Y) / det + o.pivot[1]) / o.h * t.H);
        if (u >= 0 && v >= 0 && u < t.W && v < t.H && t.A[v * t.W + u] > 127) { const k = py * W + px; top[k] = i; for (let ch = 0; ch < 3; ch++) rgb[k * 3 + ch] = t.P[(v * t.W + u) * 4 + ch]; } } });
    return { top, W, H, rgb };
  }
  // (TASKS 2192) px² of the mage's face (FACE_ROWS of body texture cells about look.eye, 3 cells either side: brow to mouth, or the beard
  // under it) shown by a sprite drawn after the body whose name matches `by`, sampled at Z per px
  const FACE_ROWS = { face: [-2.5, 2.5], beard: [2.5, 4.5] };
  function faceCover(spr, L, rig, eye, rows, by, Z = 2) {
    const RG = SB0.rigs()[rig], C = RG.h / 42, bi = spr.findIndex((q) => q.n.startsWith(rig + '__body') && !/back/.test(q.n)), b = spr[bi];
    if (!b) return 0;
    const at = (cx, cy) => L.M.ap(b.o.m, [cx * C / RG.w * b.o.w - b.o.pivot[0], cy * C / RG.h * b.o.h - b.o.pivot[1]]);
    const pts = [-3, 3].flatMap((dx) => rows.map((dy) => at(eye[0] + dx, eye[1] + dy))), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const c = compose(spr, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], Z); let n = 0;
    for (const k of c.top) if (k > bi && by.test(spr[k].n)) n++;
    return n / Z / Z;
  }
  // (TASKS 2200) a weapon fist drawn in the world, against its own cells (the world grid's, h / 42 rig px of its texture): drawn square on
  // the grid (turned by quarter turns, its middle on a world px or between two as its cells across are odd or even: turned with the
  // weapon or half a px off, its one-cell rows fell between two px and the vote lost them), at least one column where a lit cell, one
  // darker by PART (OKLab L × 100) and a lit one follow along the weapon (two rows of fingers parted), and an empty corner beside the
  // thumb (the notch: 2177's world fist was a full 3 × 4 block of one or two tones). Returns what fails; the parting count for the record
  const PART = 12, okL = (p) => { const f = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; }, [r, g, b] = [p[0], p[1], p[2]].map(f);
    return 100 * (0.2104542553 * Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) + 0.793617785 * Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) - 0.0040720468 * Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)); };
  function worldFist(q, rig) {
    const t = TEX[q.n] || (TEX[q.n] = png(q.n)), Cc = SB0.rigs()[rig].h / 42, nx = Math.round(t.W / Cc), ny = Math.round(t.H / Cc), o = q.o, bad = [];
    const turn = Math.atan2(o.m[1], o.m[0]) / (Math.PI / 2), qt = Math.round(turn), wpx = Math.round(o.w / 2), hpx = Math.round(o.h / 2);
    const grid = (v, n) => Math.abs(v - (n % 2 ? 2 * Math.round((v - 1) / 2) + 1 : 2 * Math.round(v / 2))) < 1e-6;
    if (Math.abs(turn - qt) > 1e-6) bad.push(`turned ${(turn * 90).toFixed(0)}° off the grid`);
    else if (!grid(o.m[4], qt % 2 ? hpx : wpx) || !grid(o.m[5], qt % 2 ? wpx : hpx)) bad.push(`its middle ${o.m[4].toFixed(2)}, ${o.m[5].toFixed(2)} off the grid`);
    const cell = (i, j) => { const x = Math.min(t.W - 1, Math.floor((i + 0.5) * Cc)), y = Math.min(t.H - 1, Math.floor((j + 0.5) * Cc)), k = (y * t.W + x) * 4; return t.P[k + 3] > 127 ? okL([t.P[k], t.P[k + 1], t.P[k + 2]]) : null; };
    let parts = 0, notch = false;
    for (let i = 0; i < nx; i++) for (let j = 1; j + 1 < ny; j++) { const a = cell(i, j - 1), b = cell(i, j), c = cell(i, j + 1); if (a !== null && b !== null && c !== null && a - b >= PART && c - b >= PART) parts++; }
    for (const j of [0, ny - 1]) for (const i of [0, nx - 1]) if (cell(i, j) === null && Array.from({ length: nx }, (_, k) => cell(k, j)).some((v) => v !== null)) notch = true;
    if (!parts) bad.push(`no row of fingers parted from the next by a darker one (by ${PART} L)`);
    if (!notch) bad.push('no notch beside the thumb (a full block)');
    return { bad, parts };
  }
  // each weapon of a class at rest and on the run, either way round, drawn in the world as the game does (L.SNAP on): worldFist on its fist
  function fistsOnGrid(out, cls, weapons, label) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), rig = D.CLASSES[cls].look.rig, seen = new Set();
    for (const wb of weapons) for (const face of [1, -1]) for (const [act, vx, GT] of [['rest', 0, 10], ['rest', 0, 11.3], ['run', 150, 10], ['run', 150, 10.4]]) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      const h = Object.assign({}, R.hero, { vx, vy: 0, gp: GT * 4, face, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 });
      const spr = []; L.joint = () => {}; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
      L.SNAP = 1; try { drawHero(h, 301.3, 300.7, GT, heroSt(S), {}); } finally { L.SNAP = 0; }
      const f = spr.find((q) => q.n === rig + '__fistR' || q.n.startsWith(rig + '__fistR_')); if (!f) continue;
      for (const m of worldFist(f, rig).bad) { const k = wb + m.replace(/[\d.-]+/g, ''); if (!seen.has(k)) { seen.add(k); out.push(`${label}: ${cls} ${wb} ${act} face ${face} in the world: the fist ${m}`); } }
    }
  }
  SIMX.heroLayers = { compose, faceCover, FACE_ROWS, worldFist, fistsOnGrid };
  // the warrior's fist closes round the hilt or the haft (TASKS 2170): at rest, on the run and through a blow, either way round, in the world
  // and in the arch, with each of his four weapons, the near fist (hero__fistR, drawn after the weapon) lies over the weapon's own pixels, the
  // weapon's axis (grip → tip) runs within AXIS screen px of the fist's centre, and the weapon shows past the fist on both sides of it.
  // A blow that takes the weapon behind his back draws it under the body: those frames are skipped, as long as enough are counted; a blade
  // turned toward the camera (drawn under FACING of its length) points its pommel at the camera, hidden in the fist, and only the axis counts
  function warriorFistCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), AXIS = 2, OVER = 4, PAST = 1, TIP = 0.78, FACING = 0.6, SHIELD_GRIP = 0.3, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const seen = new Set(), texels = (q) => texelsOf(L, q);
    const POSES = [['rest', 0, 10, -9], ['rest', 0, 11.3, -9], ['run', 150, 10, -9], ['run', 150, 10.4, -9], ['blow', 0, 10.06, 10], ['blow', 0, 10.15, 10], ['blow', 0, 10.3, 10], ['blow', 0, 10.6, 10]];
    let counted = 0;
    for (const wb of ['sword', 'longsword', 'axe', 'hammer']) for (const face of [1, -1]) for (const menu of [0, 1]) for (const [act, vx, GT, atkT] of POSES) {
      if (menu && act !== 'rest') continue;
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'warrior' }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      const h = Object.assign({}, R.hero, { vx, vy: 0, gp: GT * 4, face, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT, patkT: -9, castT: -9, whirlT: -9 });
      const J = {}, spr = [], tag = `warrior ${wb} ${act} face ${face}${menu ? ' in the arch' : ''} at ${GT}`;
      const say = (m) => { const k = wb + act + m.replace(/[\d.]+/g, ''); if (!seen.has(k)) { seen.add(k); out.push(`warrior fist: ${tag}: ${m}`); } };
      L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
      drawHero(h, 300, 300, GT, heroSt(S), menu ? { menu: 1 } : {});
      const wi = spr.findIndex((q) => /^it_\w+_held/.test(q.n)), fi = spr.findIndex((q) => /^hero__fistR/.test(q.n)), body = spr.findIndex((q) => /^hero__body/.test(q.n));
      if (wi < 0) { say('the weapon is not drawn'); continue; }
      if (wi < body) continue;
      if (fi < 0) { say('no fist is drawn over the weapon'); continue; }
      if (fi < wi) say('the weapon is drawn over the fist');
      counted++;
      const fist = texels(spr[fi]), wpn = texels(spr[wi]), cell = (p) => Math.floor(p[0]) + ',' + Math.floor(p[1]), fc = new Set(fist.map(cell));
      const c = fist.reduce((a, p) => [a[0] + p[0] / fist.length, a[1] + p[1] / fist.length], [0, 0]), g = J.grip, t = J.tip, len = d(g, t), u = [(t[0] - g[0]) / len, (t[1] - g[1]) / len];
      const off = Math.abs((c[0] - g[0]) * u[1] - (c[1] - g[1]) * u[0]);
      if (off > AXIS) say(`the ${wb}'s axis passes ${off.toFixed(1)} px from the fist's centre`);
      const over = new Set(wpn.map(cell).filter((k) => fc.has(k))).size;
      if (over < OVER) say(`the fist lies over ${over} px of the ${wb}`);
      const along = (p) => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1], fa = fist.map(along), lo = Math.min(...fa), hi = Math.max(...fa), wa = wpn.filter((p) => !fc.has(cell(p))).map(along);
      const fs = len / (TIP * spr[wi].o.w);
      if (fs >= FACING && (!wa.some((a) => a > hi + PAST) || !wa.some((a) => a < lo - PAST))) say(`the ${wb} does not show on both sides of the fist (fist ${lo.toFixed(1)}..${hi.toFixed(1)} px along it, drawn ${fs.toFixed(2)} of its length)`);
    }
    // the shield on the far forearm: the hand that holds its grip lies behind it, near its middle, and the shield is drawn over that hand
    for (const ob of ['shield', 'buckler', 'tower_shield']) for (const face of [1, -1]) for (const menu of [0, 1]) for (const [act, vx, GT] of POSES.filter((p) => p[0] !== 'blow')) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'warrior' }); S.run = R; R.hero.eq.weapon = { id: 0, b: 'sword', rar: 0, lvl: 1, mods: {}, atk: 6 };
      R.hero.eq.offhand = { id: 0, b: ob, rar: 0, lvl: 1, mods: {}, def: 2 };
      const h = Object.assign({}, R.hero, { vx, vy: 0, gp: GT * 4, face, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 });
      const J = {}, spr = [], tag = `warrior ${ob} ${act} face ${face}${menu ? ' in the arch' : ''} at ${GT}`;
      L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
      drawHero(h, 300, 300, GT, heroSt(S), menu ? { menu: 1 } : {});
      const si = spr.findIndex((q) => /^it_(shield|buckler)/.test(q.n)), ai = spr.findIndex((q) => /^hero__farmL/.test(q.n));
      if (si < 0 || ai < 0) { out.push(`warrior fist: ${tag}: the shield or the far forearm is not drawn`); continue; }
      const r = d(J.shield, J.handL) / spr[si].o.h;
      if (si < ai || r > SHIELD_GRIP) out.push(`warrior fist: ${tag}: the far hand is ${r.toFixed(2)} of the shield's height from its middle${si < ai ? ', drawn over it' : ''}`);
    }
    if (counted < 64) out.push(`warrior fist: only ${counted} frames hold the weapon in front of the body`);
    fistsOnGrid(out, 'warrior', ['sword', 'longsword', 'axe', 'hammer'], 'warrior fist');
  }
  // the archer's fists close round the short bow's and the long bow's wrapped grip and the crossbow's stock (TASKS 2170): at rest, on the run,
  // on the draw and after the loose, either way round, in the world and in the arch, the fist of the hand that holds the weapon
  // (archer__fist{L,R}, drawn after it) lies over the weapon's own pixels, the weapon's axis (a bow's stave, parallel to its string, through
  // the grip; the crossbow's stock, grip → tip) runs within AXIS screen px of the fist's centre, and the weapon shows past the fist on both
  // sides, a bow's grip in the middle of its stave (MID: the tips' distances from the fist differ by at most this share of their sum); on
  // the draw the string's two halves meet at the near fist. Frames with the weapon behind the body (under it) are skipped. (TASKS 2189) The
  // string is whole along its line, in the arch under its ×3.2 too: no length of it outside its drawn pieces past GAP px, and none
  // covered by anything drawn after it but a fist
  function archerFistCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), AXIS = 2, OVER = 4, PAST = 1, NOCK = 3, MID = 0.25, STRING_COL = '0.36,0.34,0.31', d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const ARCH_COL = '0.66,0.6,0.5', ARCH = [3.2, 0, 0, 3.2, -2.2 * 300, -2.2 * 300], GAP = 0.1, runs = [];
    const seen = new Set(); let counted = 0;
    // (TASKS 2199) under a torch the hero is lit about ×1.8: the world string's luminance at most STRING_Y keeps it under his face's
    // (it was 0.48, L 83 on screen over the face's 80); in the occluders' mask it goes in the actor's ink, lit as the figure is
    const STRING_Y = 0.4, INK = [1, 0.5, 0], sy = STRING_COL.split(',').map(Number).reduce((a, v, i) => a + v * [0.3, 0.59, 0.11][i], 0);
    if (sy > STRING_Y) out.push(`archer fist: the world string's luminance ${sy.toFixed(2)} (at most ${STRING_Y})`);
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'archer' }); S.run = R; R.hero.eq.weapon = { id: 0, b: 'shortbow', rar: 0, lvl: 1, mods: {}, atk: 6 };
      const h = Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 40, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), cols = [];
      L.joint = () => {}; L.sprite = () => ({ w: 10, h: 10 }); L.solid = (x, y, w, hh, col) => { cols.push(String(col)); }; L.sp = { dx: 0, dy: 0, a: 1, lod: 0, ink: INK };
      try { drawHero(h, 300, 300, 10, heroSt(S), { id: 'occ' }); } finally { L.sp = null; }
      if (!cols.includes(String(INK)) || cols.includes(STRING_COL)) out.push(`archer fist: in the occluders' mask the string is drawn in ${cols.join(' | ')}, not the actor's ink`); }
    for (const wb of ['shortbow', 'longbow', 'crossbow']) {
      const BT = D.SHOTS[D.BASES[wb].shot || 'bolt'].t, POSES = [['rest', 0, 10, -9], ['rest', 0, 11.3, -9], ['run', 150, 10, -9], ['run', 150, 10.4, -9], ['draw', 0, 10 + 0.6 * BT, 10], ['draw', 0, 10 + 0.95 * BT, 10], ['loose', 0, 10 + BT + 0.06, 10]];
      for (const face of [1, -1]) for (const menu of [0, 1]) for (const [act, vx, GT, atkT] of POSES) {
        if (menu && act !== 'rest') continue;
        const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'archer' }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
        const h = Object.assign({}, R.hero, { vx, vy: 0, gp: GT * 4, face, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT, patkT: -9, castT: -9, whirlT: -9 });
        const J = {}, spr = [], sol = [], seq = [], tag = `archer ${wb} ${act} face ${face}${menu ? ' in the arch' : ''} at ${GT.toFixed(2)}`;
        const say = (m) => { const k = wb + act + m.replace(/[\d.]+/g, ''); if (!seen.has(k)) { seen.add(k); out.push(`archer fist: ${tag}: ${m}`); } };
        L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); seq.push({ n, o }); return { w: 10, h: 10 }; };
        L.solid = (x, y, w, hh, col, a = 0, px = 0, py = 0) => { const q = { x, y, w, hh, a, px, py, col: String(col) }; sol.push(q); seq.push({ solid: q }); };
        L.pre = menu ? ARCH : null;
        try { drawHero(h, 300, 300, GT, heroSt(S), menu ? { menu: 1 } : {}); } finally { L.pre = null; }
        const side = d(J.grip, J.handL) < d(J.grip, J.handR) ? 'L' : 'R', wi = spr.findIndex((q) => /^it_(bow_[sl]|crossbow)/.test(q.n)), body = spr.findIndex((q) => /^archer__body/.test(q.n));
        const fi = spr.findIndex((q) => q.n.startsWith('archer__fist' + side));
        if (wi < 0) { say('the weapon is not drawn'); continue; }
        if (wi < body) continue;
        if (fi < 0) { say(`no ${side} fist is drawn over the weapon`); continue; }
        if (fi < wi) say('the weapon is drawn over the fist');
        counted++;
        const g = J.grip, xb = wb === 'crossbow', nocks = [J.nockA, J.nockB];
        if (!xb && !(J.nockA && J.nockB)) { say('the string\'s nocks are not traced'); continue; }
        if (!xb) { const r = Object.assign(stringRun(L, seq, nocks, J.stringMid, menu ? ARCH_COL : STRING_COL), { tag }); runs.push(r);
          if (r.gap > GAP) say(`the string breaks: ${r.gap.toFixed(2)} px of its line nock → ${act === 'draw' ? 'hand' : 'nock'} → nock outside its drawn pieces`);
          if (r.cut > GAP) say(`the string is cut ${r.cut.toFixed(2)} px by ${r.by} drawn over it`); }
        const ax = xb ? [J.tip[0] - g[0], J.tip[1] - g[1]] : [nocks[1][0] - nocks[0][0], nocks[1][1] - nocks[0][1]], len = Math.hypot(...ax), u = [ax[0] / len, ax[1] / len];
        const fist = texelsOf(L, spr[fi]), wpn = texelsOf(L, spr[wi]), cell = (p) => Math.floor(p[0]) + ',' + Math.floor(p[1]), fc = new Set(fist.map(cell));
        const c = fist.reduce((a, p) => [a[0] + p[0] / fist.length, a[1] + p[1] / fist.length], [0, 0]), off = Math.abs((c[0] - g[0]) * u[1] - (c[1] - g[1]) * u[0]);
        if (off > AXIS) say(`the ${wb}'s axis passes ${off.toFixed(1)} px from the fist's centre`);
        const over = new Set(wpn.map(cell).filter((k) => fc.has(k))).size;
        if (over < OVER) say(`the fist lies over ${over} px of the ${wb}`);
        const along = (p) => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1], fa = fist.map(along), lo = Math.min(...fa), hi = Math.max(...fa), wa = wpn.filter((p) => !fc.has(cell(p))).map(along);
        if (!wa.some((a) => a > hi + PAST) || !wa.some((a) => a < lo - PAST)) say(`the ${wb} does not show on both sides of the fist (fist ${lo.toFixed(1)}..${hi.toFixed(1)} px along it)`);
        if (!xb) { const n1 = d(c, nocks[0]), n2 = d(c, nocks[1]), mid = Math.abs(n1 - n2) / (n1 + n2);
          if (mid > MID) say(`the fist holds the stave ${n1.toFixed(0)} and ${n2.toFixed(0)} px from its tips, off the grip in its middle`); }
        if (act === 'draw' && !xb) { const fr = spr.find((q) => q.n.startsWith('archer__fistR')), cr = fr && texelsOf(L, fr).reduce((a, p, i, all) => [a[0] + p[0] / all.length, a[1] + p[1] / all.length], [0, 0]);
          if (!fr || spr.indexOf(fr) < wi) say('the string hand\'s fist is not drawn over the string');
          else if (d(J.stringMid, cr) > NOCK) say(`the string ends ${d(J.stringMid, cr).toFixed(1)} px from the string hand's fist`); }
      }
    }
    if (counted < 48) out.push(`archer fist: only ${counted} frames hold the weapon in front of the body`);
    fistsOnGrid(out, 'archer', ['shortbow', 'longbow', 'crossbow'], 'archer fist');
    SIMX.stringRuns = runs;
  }
  // (TASKS 2189) the bow's string along its ideal line (nock → nock at rest, nock → string hand → nock on the draw), sampled every STEP
  // px: gap, the length of it no string piece of the colour covers (a piece's quad turns about its pivot, placed at (x + px, y + py));
  // cut, the length a sprite drawn after the string other than a fist covers with its opaque texels; pieces, the runs of it left in sight
  const STEP = 0.05;
  function stringRun(L, seq, nocks, mid, col) {
    const path = [nocks[0], mid, nocks[1]], i0 = seq.findIndex((q) => q.solid && q.solid.col === col), later = seq.slice(i0 + 1).filter((q) => q.n && q.o && q.o.m && !(q.o.u && q.o.u.alpha < 0.5));
    const inQuad = (p, q) => { const c = Math.cos(q.a), s = Math.sin(q.a), X = p[0] - q.x - q.px, Y = p[1] - q.y - q.py, lx = c * X + s * Y + q.px, ly = -s * X + c * Y + q.py;
      return lx >= -1e-6 && lx <= q.w + 1e-6 && ly >= -1e-6 && ly <= q.hh + 1e-6; };
    const opaque = (p, q) => { const t = TEX[q.n] || (TEX[q.n] = png(q.n)), [a, b, c, dd, e, f] = q.o.m, det = a * dd - b * c, X = p[0] - e, Y = p[1] - f;
      const u = Math.floor(((dd * X - c * Y) / det + q.o.pivot[0]) / q.o.w * t.W), v = Math.floor(((-b * X + a * Y) / det + q.o.pivot[1]) / q.o.h * t.H);
      return u >= 0 && v >= 0 && u < t.W && v < t.H && t.A[v * t.W + u] > 127; };
    const pieces = seq.filter((q) => q.solid && q.solid.col === col).map((q) => q.solid);
    let gap = 0, cut = 0, n = 0, seen = false, by = '';
    for (let k = 0; k < 2; k++) { const A = path[k], B = path[k + 1], l = Math.hypot(B[0] - A[0], B[1] - A[1]), m = Math.max(1, Math.ceil(l / STEP));
      for (let i = 0; i <= m; i++) { const p = [A[0] + (B[0] - A[0]) * i / m, A[1] + (B[1] - A[1]) * i / m], ds = l / m;
        if (!pieces.some((q) => inQuad(p, q))) { gap += ds; seen = false; continue; }
        const over = later.find((q) => opaque(p, q));
        if (over && !/__fist/.test(over.n)) { cut += ds; by = over.n; }
        if (!over) { if (!seen) n++; seen = true; } else seen = false; } }
    return { gap, cut, by, pieces: n };
  }
  // (TASKS 2177) the weapon arm is the far arm of the 3/4 view: at ease and on the run each class draws its upper arm before the body
  // (under the torso), its forearm cut short of the hand (cuffR) and its own fist (fistR) after the weapon; while a blow, a shot or a
  // cast raises it the arm is drawn after the body. Each fist texture (every outfit, the arch's and the world's) is a fist and not a
  // hand: in the arch's the dark lines between the finger stacks cross its middle in at least STACKS rows (four fingers, three lines)
  // (TASKS 2190) a line is a row at least STEP darker than the finger rolled under it, not only the outline's darkest: the mage's fist
  // parts its fingers with the skin's shade, as mage_a_v4 does, where the black lines read as a square mitten
  function heroArmCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), STACKS = 3, LINE = 4, STEP = 24, seen = new Set();
    const KITS = [['warrior', 'sword', 0.15], ['mage', 'staff', 0.15], ['archer', 'shortbow', 0.15]];
    for (const [cls, wb, act] of KITS) for (const face of [1, -1]) for (const menu of [0, 1]) for (const [pose, vx, atkT] of [['rest', 0, -9], ['run', 150, -9], ['act', 0, 10 - act]]) {
      if (menu && pose !== 'rest') continue;
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      const h = Object.assign({}, R.hero, { vx, vy: 0, gp: 40, face, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT, patkT: -9, castT: -9, whirlT: -9 });
      const spr = [], pn = D.CLASSES[cls].look.rig + '__', tag = `${cls} ${pose} face ${face}${menu ? ' in the arch' : ''}`, say = (m) => { if (!seen.has(cls + pose + m)) { seen.add(cls + pose + m); out.push(`hero arm: ${tag}: ${m}`); } };
      L.joint = () => {}; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
      drawHero(h, 300, 300, 10, heroSt(S), menu ? { menu: 1 } : {});
      const at = (re) => spr.findIndex((q) => q.n.startsWith(pn) && re.test(q.n.slice(pn.length))), body = at(/^body/), ua = spr.map((q, i) => (q.n.startsWith(pn + 'uarmR') ? i : -1)).filter((i) => i >= 0);
      const fist = at(/^fistR/), wpn = spr.findIndex((q) => /^it_/.test(q.n));
      if (!ua.length || body < 0) { say('the weapon arm or the body is not drawn'); continue; }
      if (pose === 'act') { if (Math.max(...ua) < body) say('the arm raised in the action stays under the body'); continue; }
      if (ua.some((i) => i > body)) say('the upper arm is drawn over the torso at ease');
      if (at(/^cuffR/) < 0 || at(/^farmR/) >= 0) say('the forearm is not cut short of its hand');
      if (fist < 0 || fist < wpn) say('the fist is not drawn over the weapon');
    }
    for (const cls of ['warrior', 'mage', 'archer']) { const pn = D.CLASSES[cls].look.rig + '__';
      for (const n of Object.keys(SB.assets()).filter((a) => a.startsWith(pn + 'fistR') && a.endsWith('_menu'))) {
        const t = png(n), lum = (i) => (t.A[i] > 127 ? t.P[i * 4] * 0.3 + t.P[i * 4 + 1] * 0.59 + t.P[i * 4 + 2] * 0.11 : -1);
        const ys = [];
        for (let y = 1; y < t.H - 2; y++) { let k = 0;
          for (let x = 0; x < t.W; x++) { const i = y * t.W + x, v = lum(i); if (v >= 0 && lum(i - t.W) >= v && Math.max(lum(i + t.W), lum(i + 2 * t.W)) >= v + STEP) k++; }
          if (k >= LINE) ys.push(y); }
        const n0 = ys.filter((y, i) => !i || y > ys[i - 1] + 1).length;
        if (n0 < STACKS) out.push(`hero arm: ${n}: ${n0} lines between finger stacks, not a closed fist`); } }
    heroArmMotion(out, SB, drawHero, L);
  }
  // (TASKS 2180) the weapon arm through an action, frame by frame at 60 fps: the warrior's blow carries his fist at least PATH of the height
  // in its first 0.35 s in every direction (the hold at ease, posed after the blow, kept the fist at the hip and the blade turned round it),
  // keeps one layer and a fist on the hilt from wind-up to guard (the blade's own angle took it under the torso with an open hand for
  // the frames it pointed away); in every action the arm's copy over the body gains or loses at most STEP of its alpha a frame; the body's lean
  // comes back to rest by the action's end (END s, a swing's and a cast's), not cut off there (the top of the head jumps at most JUMP px a frame round its end)
  // (TASKS 2192) the whirl and the war cry hold the hilt in a fist in every frame (from behind the whirl drew the open hand farmR for 6
  // frames), the whirl takes its arm and blade behind him cross-faded (they went under the torso and back in one frame, a step of 1.0);
  // in no action does the arm under the body show for a single frame (the cry's two envelopes dipped under ARM_FRONT where they met);
  // (TASKS 2201) the warrior's blow, whirl and cry draw the arm and the weapon once a frame (cross-faded, the arm showed through the
  // chest at its share for 5–14 frames), and a switch of layer outside a change of view flips at most LAP px of them against the torso;
  // a shooter's arm keeps its fade, at most STEP of its alpha a frame;
  // the mage's fireball with the orb in his free hand keeps his face open (FACE px² of brow to mouth under the orb or its cup; it passed
  // over the mouth for 13 frames); a blow taken (HURT s) moves no grip more than HURT_STEP px a frame (the mage's straightened elbow, 7.6)
  function heroArmMotion(out, SB, drawHero, L) {
    const PATH = 0.3, STEP = 0.5, LAP = 140, RG = /^(\w+__(uarmR|farmR|cuffR|fistR)|it_)/, JUMP = 1, FPS = 60, T0 = 10, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), END = 0.5, FACE = 0, HURT = 0.4, HURT_STEP = 3;
    const ACTS = [['warrior', 'sword', 'blow', { atkT: T0 }], ['archer', 'shortbow', 'shot', { atkT: T0, patkT: T0 }], ['mage', 'staff', 'shot', { atkT: T0, patkT: T0 }],
      ['mage', 'staff', 'fireball', { castT: T0, castK: 'fireball' }], ['mage', 'staff', 'frost', { castT: T0, castK: 'frost' }], ['archer', 'shortbow', 'volley', { castT: T0, castK: 'volley' }],
      ['warrior', 'sword', 'whirl', { whirlT: T0 }], ['warrior', 'sword', 'cry', { castT: T0, castK: 'cry' }]];
    const AIMS = [['right', 0], ['down', Math.PI / 2], ['up', -Math.PI / 2], ['left', Math.PI], ['up-left', -2.3]], FIST = new Set(['blow', 'whirl', 'cry']);
    for (const [cls, wb, act, at] of ACTS) for (const [an, aim] of act === 'blow' ? AIMS : act === 'whirl' ? [AIMS[0], AIMS[3]] : AIMS.slice(0, 1)) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      const st = heroSt(S), pn = D.CLASSES[cls].look.rig + '__', tag = `${cls} ${act} aimed ${an}`, rows = [];
      for (let k = 0; k <= 0.7 * FPS; k++) { const J = {}, spr = [];
        L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o, a: o && o.u && o.u.alpha !== undefined ? o.u.alpha : 1 }); return { w: 10, h: 10 }; }; L.solid = () => {};
        drawHero(Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 40, face: Math.cos(aim) < -0.1 ? -1 : 1, aim, atkA: aim, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9, whirlA: aim }, at), 300, 300, T0 + k / FPS, st, {});
        const idx = (re) => spr.map((q, i) => (q.n.startsWith(pn) && re.test(q.n.slice(pn.length)) ? i : -1)).filter((i) => i >= 0), body = idx(/^body/)[0] ?? -1, ua = idx(/^uarmR/).filter((i) => i > body);
        const lay = (re) => { const ix = spr.map((q, i) => (re.test(q.n) ? i : -1)).filter((i) => i >= 0); return (ix.some((i) => i < body) ? 'u' : '') + (ix.some((i) => i > body) ? 'o' : ''); };
        const armL = lay(new RegExp(`^${pn}(uarmR|farmR|cuffR)`)), wpnL = lay(new RegExp(`^(it_|${pn}fistR)`)), part = (q) => (q.o && q.o.u ? Object.assign({}, q, { o: Object.assign({}, q.o, { u: Object.assign({}, q.o.u, { alpha: 1 }) }) }) : q);
        const fo = spr.findIndex((q, i) => i > body && RG.test(q.n)), occ = spr.filter((q, i) => i >= body && i < (fo < 0 ? spr.length : fo) && !RG.test(q.n) && q.o);
        const box = [J.ground[0] - 60, J.ground[1] - 110, J.ground[0] + 60, J.ground[1] + 6], rs = spr.filter((q) => RG.test(q.n) && q.o).map(part), cr = compose(rs, box), co = compose(occ, box), laps = { arm: 0, wpn: 0 };
        for (let i = 0; i < cr.top.length; i++) if (cr.top[i] >= 0 && co.top[i] >= 0) laps[/^it_|__fistR/.test(rs[cr.top[i]].n) ? 'wpn' : 'arm']++;
        rows.push({ armL, wpnL, laps, view: spr.some((q) => q.n.startsWith(pn + 'body_back')) + ':' + spr.some((q) => q.n.startsWith(pn + 'body') && !/back/.test(q.n)), twice: ua.length > 0 && spr[ua[0]].a > 0 && spr[ua[0]].a < 1 && idx(/^uarmR/).some((i) => i < body) });
        Object.assign(rows[rows.length - 1], { J, t: k / FPS, over: ua.length ? spr[ua[0]].a : 0, under: idx(/^uarmR/).some((i) => i < body), wpn: spr.findIndex((q) => /^it_/.test(q.n)) > body, farm: idx(/^farmR/).length > 0, fist: idx(/^fistR/).length > 0, back: body < 0 }); }
      const H = rows[0].J.ground[1] - rows[0].J.top[1];
      if (act === 'blow') { const path = rows.filter((r) => r.t > 0 && r.t <= 0.35 + 1e-9).reduce((a, r, i, all) => a + d(r.J.handR, (i ? all[i - 1] : rows[0]).J.handR), 0) / H;
        if (path < PATH) out.push(`hero arm: ${tag}: the fist travels ${path.toFixed(2)} of the height in the blow's first 0.35 s (at least ${PATH})`);
        const blow = rows.filter((r) => r.t < END && !r.back), lay = new Set(blow.map((r) => r.wpn));
        if (lay.size > 1) out.push(`hero arm: ${tag}: the sword goes under the torso and over it within the blow`);
      }
      const open = rows.filter((r) => (act === 'blow' ? r.t < END && !r.back : FIST.has(act)) && (r.farm || !r.fist)).length;
      if (open) out.push(`hero arm: ${tag}: the fist on the hilt opens into a hand in ${open} frames of the ${act}`);
      if (FIST.has(act)) { const twice = rows.filter((r) => r.twice || r.armL.length > 1 && r.over > 0 && r.over < 1).length;
        if (twice) out.push(`hero arm: ${tag}: the arm is drawn under the body and over it at a share in ${twice} frames`);
        for (let i = 1; i < rows.length; i++) for (const g of ['arm', 'wpn']) { const r = rows[i], p = rows[i - 1];
          if (r[g + 'L'] !== p[g + 'L'] && r.view === p.view && r.laps[g] > LAP) out.push(`hero arm: ${tag}: the ${g === 'arm' ? 'arm' : 'weapon'} switches layer at frame ${i} across ${r.laps[g]} px of the torso (at most ${LAP})`); } }
      const steps = rows.slice(1).map((r, i) => Math.abs(r.over - rows[i].over)), up = Math.max(...steps);
      if (!FIST.has(act) && up > STEP) out.push(`hero arm: ${tag}: the arm comes over the body or leaves it by ${up.toFixed(2)} of its alpha in one frame (at most ${STEP})`);
      const blink = rows.filter((r, i) => i > 0 && i < rows.length - 1 && r.under && !rows[i - 1].under && !rows[i + 1].under).length;
      if (blink) out.push(`hero arm: ${tag}: the arm under the body shows for a single frame ${blink} times`);
      if (act === 'whirl' || act === 'cry') continue;
      const e = Math.round(END * FPS), jump = Math.max(...rows.slice(e - 4, e + 5).map((r, i) => d(r.J.top, rows[e - 5 + i].J.top)));
      if (jump > JUMP) out.push(`hero arm: ${tag}: the body jumps ${jump.toFixed(1)} px in a frame as the action ends`);
    }
    for (const [an, aim] of [AIMS[0], AIMS[1], AIMS[4]]) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; R.hero.eq.weapon = { id: 0, b: 'staff', rar: 0, lvl: 1, mods: {}, atk: 6 };
      R.hero.eq.offhand = { id: 0, b: 'orb', rar: 0, lvl: 1, mods: {}, def: 2 };
      const st = heroSt(S); let worst = [0, 0];
      for (let k = 0; k <= 0.6 * FPS; k++) { const spr = []; L.joint = () => {}; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
        drawHero(Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 40, face: Math.cos(aim) < -0.1 ? -1 : 1, aim, atkA: aim, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: T0, castK: 'fireball', whirlT: -9 }), 300, 300, T0 + k / FPS, st, {});
        const v = faceCover(spr, L, 'mage', D.CLASSES.mage.look.eye, FACE_ROWS.face, /^(orb_held|mage__cupL)/); if (v > worst[0]) worst = [v, k]; }
      if (worst[0] > FACE) out.push(`hero arm: mage fireball with the orb aimed ${an}: the orb covers ${worst[0].toFixed(1)} px² of his face at frame ${worst[1]} (at most ${FACE})`);
    }
    for (const [cls, eq] of [['warrior', { weapon: 'sword' }], ['archer', { weapon: 'shortbow' }], ['mage', { weapon: 'staff' }], ['mage', { weapon: 'wand', offhand: 'orb' }]]) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; for (const [k, b] of Object.entries(eq)) R.hero.eq[k] = { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 };
      const st = heroSt(S), g = [];
      for (let k = 0; k <= HURT * FPS; k++) { const J = {}; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = () => ({ w: 10, h: 10 }); L.solid = () => {};
        drawHero(Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 40, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: T0, hurtX: 1, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), 300, 300, T0 + k / FPS, st, {}); g.push(J.handR); }
      const m = Math.max(...g.slice(1).map((p, i) => d(p, g[i])));
      if (m > HURT_STEP) out.push(`hero arm: ${cls} ${Object.values(eq).join(' and ')} hurt: the grip jumps ${m.toFixed(1)} px in a frame (at most ${HURT_STEP})`);
    }
  }
  // (TASKS 2157) a hero texture no outfit, pose, view or the arch asks for still loads at start: every class in every combination of
  // the bases of each slot, with each weapon and offhand, in a few poses, front and back, world and arch; a texture neither drawn nor
  // looked up (an existence test decides a pose: cuffR, head_<helm>, _w maps) is a dead file
  function heroTexCheck(out) {
    const RIGN = [...new Set(Object.values(D.LOOKS).flatMap((q) => Object.values(q).map((LK) => LK.rig)))], HERO = new RegExp(`^(${RIGN.join('|')})__`), raw = SB0.assets(), used = new Set(), sizes = new Proxy(raw, { get: (t, k) => { if (typeof k === 'string') used.add(k); return t[k]; } });
    const { drawHero, L } = SB0.heroBox(D, root.SIM, sizes), slot = (s) => [''].concat(Object.keys(D.BASES).filter((k) => D.BASES[k].slot === s));
    L.sprite = (n) => { used.add(n); return { w: 10, h: 10 }; }; L.solid = () => {}; L.joint = () => {};
    const item = (b) => (b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 } : undefined), T = 10;
    const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
    const ACTS = [{}, { vx: 150 }, { back: 1 }, { atkT: T - 0.15 }, { atkT: T - 0.15, aim: Math.PI, face: -1 }, { patkT: T - 0.1 }, { castT: T - 0.1 }];
    const draw = (cls, eq, acts, look) => { const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls, look }); S.run = R;
      for (const k of ['armor', 'helm', 'gloves', 'boots', 'weapon', 'offhand']) R.hero.eq[k] = item(eq[k]);
      const st = heroSt(S); for (const a of acts) for (const o of [{}, { menu: 1 }]) if (!(o.menu && a.vx)) drawHero(Object.assign({}, R.hero, base, a), 300, 300, T, st, o); };
    // (TASKS 2148) each look with art of its own; one drawing another's art draws nothing new
    for (const cls of Object.keys(D.CLASSES)) for (const look of D.LOOK_IDS.filter((l) => D.LOOKS[cls][l].art === l)) {
      for (const armor of slot('armor')) for (const helm of slot('helm')) for (const gloves of slot('gloves')) for (const boots of slot('boots')) draw(cls, { armor, helm, gloves, boots, weapon: 'sword' }, ACTS.slice(0, 3), look);
      for (const weapon of slot('weapon')) for (const offhand of slot('offhand')) for (const gloves of slot('gloves')) draw(cls, { weapon, offhand, gloves }, ACTS, look);
      // (TASKS 2194) an outfit's sleeve can hang on what the offhand holds (the mage's bell over the orb in the arch)
      for (const armor of slot('armor')) for (const offhand of slot('offhand')) draw(cls, { armor, offhand, weapon: 'staff' }, ACTS.slice(0, 1));
    }
    for (const k of Object.keys(raw)) if (HERO.test(k) && !used.has(k)) out.push(`hero texture ${k}: no outfit, pose, view or the arch asks for it (a dead file loaded at start)`);
  }
  // (TASKS 2182) the warrior's cape shows on both sides of his legs, as on the sheet: the cape's texels no body part covers, at rest in
  // the rig, in the bands 0.25-0.35 and 0.15-0.25 of the height above the soles, per side of the hips' middle, in ×1000 of the height squared.
  // The far side (right of the middle) at least FAR_MIN in each band (it was 3.8 and 1.8, the sheet's 6.9 and 3.2 less the weapon and arm
  // that hide part of it in the scene), and the cape side no more than RATIO times it (it was 4.4 and 3.8)
  function heroCapeCheck(out) {
    const FAR_MIN = [6, 4], RATIO = 2, BANDS = [[0.65, 0.75], [0.75, 0.85]], RG = SB0.rigs().hero, cape = png('hero__cape'), mid = (RG.hipL[0] + RG.hipR[0]) / 2;
    const cover = ['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR', 'body'].map((n) => png('hero__' + n));
    BANDS.forEach(([f0, f1], b) => { let l = 0, r = 0;
      for (let y = Math.round(f0 * cape.H); y < Math.round(f1 * cape.H); y++) for (let x = 0; x < cape.W; x++) {
        if (cape.A[y * cape.W + x] < 128 || cover.some((c) => c.A[y * c.W + x] > 127)) continue;
        if (x < mid) l++; else r++; }
      const k = 1000 / cape.H / cape.H; l *= k; r *= k;
      if (r < FAR_MIN[b]) out.push(`hero cape: ${r.toFixed(1)} on the far side of the legs in band ${b + 1} (at least ${FAR_MIN[b]})`);
      if (l > RATIO * r) out.push(`hero cape: the cape side ${l.toFixed(1)} against ${r.toFixed(1)} on the far side in band ${b + 1} (at most ${RATIO} times)`); });
  }
  // (TASKS 2202) the cape from behind is the cape from the front: the hero in each outfit and helm, at rest and walking and running 12
  // frames of a stride in the 8 ways (the back view for the three ways up, as the sim sets it), through a turn and a whirl at 60 fps.
  // Cape px: the front cape's sprite, or the back view's below the shoulders in the cloth's colour (cloth, CIELab of the graded texel).
  // Per frame drawn from behind: the hem (lowest cape row) under the hip joint in shares of the height (ground to the head's top joint:
  // the hip's bob and the whirl's crouch move both capes alike) against the front's at the same pace (a turn's or a whirl's against its
  // own frames drawn from the front), and ΔE76 of the cape's mean graded colour against the front's; per pace, the cape-tip joint's
  // travel over a stride walking up against the front's walking right. rows: one per frame, for the check and tools/measure/fix2202/cape.cjs
  const CAPE_CLOTH = { hero: (q) => q[1] > 12, archer: (q) => q[1] < -1 && q[2] > 6 };
  const LAB76 = (r, g, b) => { const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }, R = f(r), G = f(g), B = f(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
  const GRADED = (p, u) => { const g = (u && u.grade) || [1, 1, 0, 1], l = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]; return p.map((v) => Math.min(255, Math.max(0, ((l + (v - l) * g[0]) * g[1] - 127.5) * g[3] + 127.5))); };
  function capeBack(cls, outfits) {
    const T0 = 10, FPS = 60, RUN = root.SIM.K.RUN, SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), rig = D.CLASSES[cls].look.rig, cloth = CAPE_CLOTH[rig];
    const front = new RegExp(`^${rig}__cape`), back = new RegExp(`^${rig}__body_back`), rows = [], it = (b, slot) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, [slot === 'weapon' ? 'atk' : 'def']: 3 });
    const WAYS = { down: [0, 1], 'down-right': [1, 1], right: [1, 0], 'up-right': [1, -1], up: [0, -1], 'up-left': [-1, -1], left: [-1, 0], 'down-left': [-1, 1] };
    const base = { back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
    for (const [armor, helm] of outfits) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; const kit = { warrior: 'sword', archer: 'shortbow', mage: 'staff' }[cls];
      Object.assign(R.hero.eq, { weapon: it(kit, 'weapon') }); if (armor) R.hero.eq.armor = it(armor, 'armor'); else delete R.hero.eq.armor; if (helm) R.hero.eq.helm = it(helm, 'helm'); else delete R.hero.eq.helm;
      const st = heroSt(S), tag0 = `${armor || 'no armour'}${helm ? ' and ' + helm : ''}`;
      const shot = (over, t, more) => { const J = {}, V = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; if (id === 'hero_view') V[n] = p; };
        L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
        drawHero(Object.assign({}, R.hero, base, over), 300, 300, t, st, {});
        const c = compose(spr, [J.ground[0] - 50, J.ground[1] - 100, J.ground[0] + 50, J.ground[1] + 4]), y0 = J.ground[1] - 100, sh = Math.max(J.shL[1], J.shR[1]) - y0, H = J.ground[1] - J.top[1];
        let n = 0, lo = -1; const m = [0, 0, 0];
        for (let i = 0; i < c.W * c.H; i++) { const k = c.top[i]; if (k < 0) continue; const q = spr[k], y = Math.floor(i / c.W), isF = front.test(q.n), isB = back.test(q.n); if (!isF && !isB) continue;
          const lab = LAB76(...GRADED([c.rgb[i * 3], c.rgb[i * 3 + 1], c.rgb[i * 3 + 2]], q.o.u)); if (isB && (y < sh || !cloth(lab))) continue;
          n++; lo = Math.max(lo, y); for (let j = 0; j < 3; j++) m[j] += lab[j]; }
        const view = V.back ? V.back[0] : 0, tip = view >= 0.5 ? J.capeBack : J.cape;
        rows.push(Object.assign({ outfit: tag0, view: view >= 0.5 ? 'back' : 'front', n, hem: n ? (J.ground[1] - (lo + y0 + 1)) / H : null, drop: n ? (lo + y0 + 1 - J.hip[1]) / H : null, lab: m.map((v) => v / Math.max(1, n)), tip }, more)); };
      shot({ vx: 0, vy: 0, gp: 0, face: 1, aim: 0 }, T0, { act: 'rest', pace: 'rest' });
      shot({ vx: 0, vy: 0, gp: 0, face: 1, aim: -Math.PI / 2, back: 1 }, T0, { act: 'rest', pace: 'rest', way: 'up' });
      for (const [way, [dx, dy]] of Object.entries(WAYS)) for (const [pace, k] of [['walk', 0.5], ['run', 1]]) {
        const sp = RUN * k / Math.hypot(dx, dy), face = dx ? Math.sign(dx) : 1, bk = dy < 0 ? 1 : 0;
        for (let f = 0; f < 12; f++) shot({ vx: dx * sp, vy: dy * sp, gp: f * 2 * Math.PI / 12, face, aim: Math.atan2(dy, dx), back: bk }, T0 + f / FPS, { act: 'move', pace, way, frame: f }); }
      for (const [pace, vx] of [['rest', 0], ['run', -RUN]]) for (let f = 0; f <= 0.2 * FPS; f++)
        shot({ vx, vy: 0, gp: f, face: -1, faceT: T0, aim: Math.PI }, T0 + f / FPS, { act: 'turn', pace, frame: f });
      for (let f = 0; f <= 0.55 * FPS; f++) shot({ vx: 0, vy: 0, gp: 0, face: 1, aim: 0, whirlT: T0, whirlA: 0, castK: 'whirl', castT: T0 }, T0 + f / FPS, { act: 'whirl', pace: 'rest', frame: f });
    }
    return rows;
  }
  SIMX.capeBack = capeBack;
  function capeStats(rows) {
    const ref = {}, mean = (rs, f) => rs.reduce((a, r) => a + f(r), 0) / Math.max(1, rs.length), out = [];
    for (const o of new Set(rows.map((r) => r.outfit))) for (const pace of ['rest', 'walk', 'run']) { const fr = rows.filter((r) => r.outfit === o && r.pace === pace && r.view === 'front' && r.act !== 'turn' && r.act !== 'whirl' && r.n);
      ref[o + pace] = { hem: mean(fr, (r) => r.hem), drop: mean(fr, (r) => r.drop), lab: [0, 1, 2].map((j) => mean(fr, (r) => r.lab[j])) };
      for (const act of ['turn', 'whirl']) { const fa = rows.filter((r) => r.outfit === o && r.pace === pace && r.act === act && r.view === 'front' && r.n);
        if (fa.length) ref[o + act + pace] = { hem: mean(fa, (r) => r.hem), drop: mean(fa, (r) => r.drop), lab: [0, 1, 2].map((j) => mean(fa, (r) => r.lab[j])) }; } }
    const travel = (rs) => { const p = rs.map((r) => r.tip).filter(Boolean); if (p.length < 2) return 0; const c = [mean(p, (q) => q[0]), mean(p, (q) => q[1])]; return 2 * Math.max(...p.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1]))); };
    for (const r of rows) { if (r.view !== 'back') continue; const R = ref[r.outfit + r.act + r.pace] || ref[r.outfit + r.pace];
      out.push({ r, dHem: r.n ? R.drop - r.drop : 1, dE: r.n ? Math.hypot(...r.lab.map((v, j) => v - R.lab[j])) : 99 }); }
    const swing = {};
    for (const o of new Set(rows.map((r) => r.outfit))) for (const pace of ['walk', 'run']) {
      swing[o + ' ' + pace] = { back: travel(rows.filter((r) => r.outfit === o && r.pace === pace && r.act === 'move' && r.way === 'up')), front: travel(rows.filter((r) => r.outfit === o && r.pace === pace && r.act === 'move' && r.way === 'right')) }; }
    return { ref, out, swing };
  }
  SIMX.capeStats = capeStats;
  // the warrior's cape from behind ends within HEM of the height where the front's does (it ended 0.19-0.2 H higher, at the knee), within
  // ΔE76 DE of its colour (the back view's bodySat dulled it to ΔE 4-7), and its tip travels at least SWING of the front's over a stride
  function heroCapeBackCheck(out) {
    const HEM = 0.02, DE = 4, SWING = 0.5, outfits = [['leather_armor', ''], ['', ''], ['plate_armor', ''], ['cloak', ''], ['leather_armor', 'knight_helm'], ['plate_armor', 'knight_helm'], ['cloak', 'leather_helm']];
    const { out: rs, swing } = capeStats(capeBack('warrior', outfits)), worst = (f) => rs.reduce((a, q) => (f(q) > f(a) ? q : a), rs[0]), tag = (q) => `${q.r.outfit}, ${q.r.act}${q.r.way ? ' ' + q.r.way : ''} ${q.r.pace}${q.r.frame !== undefined ? ' frame ' + q.r.frame : ''}`;
    if (!rs.length) { out.push('hero cape back: no frame drawn from behind'); return; }
    const h = worst((q) => Math.abs(q.dHem)), e = worst((q) => q.dE);
    if (Math.abs(h.dHem) > HEM) out.push(`hero cape back: the hem from behind is ${h.dHem.toFixed(3)} H off the front's, ${tag(h)} (at most ${HEM})`);
    if (e.dE > DE) out.push(`hero cape back: the cape from behind is ΔE76 ${e.dE.toFixed(1)} off the front's, ${tag(e)} (at most ${DE})`);
    for (const [k, v] of Object.entries(swing)) if (!(v.back >= SWING * v.front && v.back > 0)) out.push(`hero cape back: ${k} up, the cape's tip travels ${v.back.toFixed(1)} px a stride against ${v.front.toFixed(1)} from the front (at least ${SWING} of it)`);
  }
  // (TASKS 2183) the warrior's back view under a helm is the cape of its pair without one (the _nh copies were left out of a recolour:
  // mean RGB of the opaque texels below the shoulders differed by 8-10), and the mage's grey hair is cool, never mauve: of the low-chroma
  // light texels in the head rows of the back heads and the arch's drawn head, the mean of red minus blue is at most 0 (it was +34)
  function heroBackCheck(out) {
    const SAME = 3, ROWS = [120, 340], HAIR = { mage__head_back_ci: 45, mage__body_back: 45, mage__head_ci_menu: 50 }, mean = (t, y0, y1) => { const m = [0, 0, 0]; let k = 0;
      for (let i = y0 * t.W; i < y1 * t.W; i++) if (t.A[i] >= 128) { k++; for (let c = 0; c < 3; c++) m[c] += t.P[i * 4 + c]; }
      return m.map((v) => v / Math.max(1, k)); };
    for (const s of ['', '_cl', '_pw', '_hd']) { const a = mean(png('hero__body_back' + s), ...ROWS), b = mean(png('hero__body_back' + s + '_nh'), ...ROWS), d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (d > SAME) out.push(`hero back: hero__body_back${s}_nh differs from its pair without a helm by ${d.toFixed(1)} RGB (at most ${SAME})`); }
    for (const [n, rows] of Object.entries(HAIR)) { const t = png(n); let k = 0, rb = 0;
      for (let i = 0; i < rows * t.W; i++) { if (t.A[i] < 128) continue; const r = t.P[i * 4], g = t.P[i * 4 + 1], b = t.P[i * 4 + 2], lum = 0.3 * r + 0.59 * g + 0.11 * b;
        if (lum > 60 && Math.max(r, g, b) - Math.min(r, g, b) < 45) { k++; rb += r - b; } }
      if (k && rb / k > 0) out.push(`mage hair: ${n} reads warm (red minus blue ${(rb / k).toFixed(1)}, at most 0)`); }
    // (TASKS 2199) the hair under the circlet from behind is the bare head's grey: the light hair px (OKLab L over 0.52) of the top 40 rows,
    // off the circlet's band (chroma 0.075 and over) and a px round it, differ from the bare back's in mean OKLab a, b by at most HAIR_AB ×0.01
    // (measured with the band's gold counted it read ΔE 8.9; by the hair alone 0.7 in a, b, now 0.3)
    const HAIR_AB = 1, hairAB = (t) => { const C = (i) => { const o = OKL(t.P[i * 4], t.P[i * 4 + 1], t.P[i * 4 + 2]); return [o, Math.hypot(o[1], o[2])]; }, m = [0, 0]; let k = 0;
      for (let y = 0; y < 40; y++) for (let x = 1; x < t.W - 1; x++) { const i = y * t.W + x; if (t.A[i] < 128) continue; const [o, c] = C(i); if (o[0] <= 0.52 || c >= 0.075) continue;
        if ([i - 1, i + 1, i - t.W, i + t.W].some((j) => j >= 0 && t.A[j] >= 128 && C(j)[1] >= 0.075)) continue; k++; m[0] += o[1]; m[1] += o[2]; }
      return m.map((v) => v / Math.max(1, k)); };
    { const a = hairAB(png('mage__head_back_ci')), b = hairAB(png('mage__body_back')), d = 100 * Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d > HAIR_AB) out.push(`mage hair: under the circlet from behind ${d.toFixed(2)} off the bare head's grey in OKLab a, b ×0.01 (at most ${HAIR_AB})`); }
    mageBackRobe(out);
  }
  // (TASKS 2195) the mage from behind wears one robe, at rest and running up, in every outfit and helm: the front skirt (his thighs) shows
  // under the back's hem by at most SKIRT world px in any column (a short cloak ended at the belt over a long robe of another tone: 9.5);
  // the robe's blue in the LOW world px over its hem is the cloth's above the hip (OKLab ΔE×100 of the shown, graded blue at most DE); and below the hip there is one trim
  // band, at the hem (within HEM world px of the cloth's bottom), across at least TRIM of the cloth's width (it had the cloak's and the skirt's; ΔE was 6.0, now 2.6)
  const OKL = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }, R = f(r), G = f(g), B = f(b);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
  function mageBackRobe(out) {
    const SKIRT = 2, DE = 4, LOW = 4, HEM = 1.5, TRIM = 0.75, T0 = 10, FPS = 60, RUN = root.SIM.K.RUN, SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets());
    const it = (b, slot) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, [slot === 'weapon' ? 'atk' : 'def']: 3 }), cloth = /^mage__(body_back|thigh)/;
    const blue = (r, g, b) => b > r + 20 && b > g + 10, orange = (r, g, b) => r > b + 40 && r > g + 15, worst = { skirt: [0], de: [0], bands: [1], hem: [0], trim: [1] };
    const graded = (p, u) => { const g = (u && u.grade) || [1, 1, 0, 1], l = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]; return p.map((v) => Math.min(255, Math.max(0, ((l + (v - l) * g[0]) * g[1] - 127.5) * g[3] + 127.5))); };
    const bad = (k, v, tag, more) => { if (more ? v > worst[k][0] : v < worst[k][0]) worst[k] = [v, tag]; };
    for (const armor of ['robe', 'leather_armor', 'cloak']) for (const helm of ['', 'circlet', 'leather_helm']) for (const run of [0, 1]) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; Object.assign(R.hero.eq, { weapon: it('staff', 'weapon'), armor: it(armor, 'armor') });
      if (helm) R.hero.eq.helm = it(helm, 'helm'); else delete R.hero.eq.helm;
      const h = Object.assign({}, R.hero, { vx: 0, vy: -RUN * run, face: 1, aim: -Math.PI / 2, back: 1, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), st = heroSt(S);
      const rate = RUN / root.SIM.Q.stepLen(0) * Math.PI;
      for (let k = 0; k < (run ? 12 : 1); k++) {
        const J = {}, spr = [], tag = `${armor}${helm ? ' and ' + helm : ''}${run ? ' running up, frame ' + k : ' at rest'}`; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; };
        L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
        h.gp = 1 + rate * k / 2 / FPS; drawHero(h, 300, 300, T0 + k / 2 / FPS, st, {});
        const bk = spr.find((q) => /^mage__body_back/.test(q.n)); if (!bk) { out.push(`mage back: ${tag}: no back view drawn`); continue; }
        const cell = bk.o.h / 42, x0 = J.ground[0] - 40, y0 = J.ground[1] - 100, c = compose(spr, [x0, y0, J.ground[0] + 40, J.ground[1] + 4]), at = (i) => [c.rgb[i * 3], c.rgb[i * 3 + 1], c.rgb[i * 3 + 2]];
        const hipY = Math.round(J.hip[1] - y0), shY = Math.round((J.shL[1] + J.shR[1]) / 2 - y0);
        let skirt = 0;
        for (let x = 0; x < c.W; x++) { let n = 0; for (let y = 0; y < c.H; y++) { const i = c.top[y * c.W + x]; if (i >= 0 && /^mage__thigh/.test(spr[i].n)) n++; } skirt = Math.max(skirt, n / cell); }
        bad('skirt', skirt, tag, 1);
        const lab = [], rows = []; let bottom = -1;
        for (let y = shY; y < c.H; y++) { let n = 0, nb = 0, no = 0;
          for (let x = 0; x < c.W; x++) { const k = y * c.W + x, i = c.top[k]; if (i < 0 || !cloth.test(spr[i].n)) continue; n++; const p = at(k);
            if (blue(...p)) { nb++; lab.push([y, OKL(...graded(p, spr[i].o.u))]); }
            if (orange(...p)) no++; }
          if (n) bottom = y; if (y >= hipY) rows.push({ y, n, nb, no }); }
        const band = [[0, 0, 0, 0], [0, 0, 0, 0]];
        for (const [y, q] of lab) { const B = y < hipY ? band[0] : y > bottom - LOW * cell ? band[1] : null; if (B) { B[0] += q[0]; B[1] += q[1]; B[2] += q[2]; B[3]++; } }
        if (band[0][3] > 20 && band[1][3] > 20) { const m = band.map((B) => B.slice(0, 3).map((v) => v / B[3])); bad('de', 100 * Math.hypot(m[0][0] - m[1][0], m[0][1] - m[1][1], m[0][2] - m[1][2]), tag, 1); }
        const from = rows.findIndex((r) => r.n && r.nb >= 0.5 * r.n), bands = [];
        for (const r of rows.slice(Math.max(0, from))) { if (!(r.n && r.no >= 0.5 * r.n)) continue; const B = bands[bands.length - 1];
          if (B && r.y - B.y1 <= cell) { B.y1 = r.y; B.share = Math.max(B.share, r.no / r.n); } else bands.push({ y0: r.y, y1: r.y, share: r.no / r.n }); }
        bad('bands', bands.length === 1 ? 1 : 99 + bands.length, tag, 1);
        if (bands.length) { const B = bands[bands.length - 1]; bad('hem', (bottom - B.y1) / cell, tag, 1); bad('trim', B.share, tag, 0); }
      } }
    if (worst.skirt[0] > SKIRT) out.push(`mage back: the front skirt shows ${worst.skirt[0].toFixed(1)} world px under the back's hem, ${worst.skirt[1]} (at most ${SKIRT})`);
    if (worst.de[0] > DE) out.push(`mage back: the robe's blue below the hip by the hem is ΔE ${worst.de[0].toFixed(1)} from the cloth above the hip, ${worst.de[1]} (at most ${DE})`);
    if (worst.bands[0] !== 1) out.push(`mage back: ${worst.bands[0] - 99} trim bands below the hip, ${worst.bands[1]} (one, at the hem)`);
    if (worst.hem[0] > HEM) out.push(`mage back: the trim ends ${worst.hem[0].toFixed(1)} world px above the cloth's bottom, ${worst.hem[1]} (at most ${HEM})`);
    if (worst.trim[0] < TRIM) out.push(`mage back: the hem's trim covers ${(100 * worst.trim[0]).toFixed(0)} % of the cloth's width, ${worst.trim[1]} (at least ${TRIM * 100})`);
  }
  // (TASKS 2201) px² of shin and boot standing out past the robe above its hem: in a column with no cloth, higher than the lowest cloth
  // row of the nearest column that has some (the trailing boot of a sideways stride kicked up past the skirt's back edge)
  function robeKick(spr, J) {
    const rig = D.CLASSES.mage.look.rig, cloth = new RegExp(`^${rig}__(body|thigh)`), boot = new RegExp(`^${rig}__(shin|foot)`);
    const c = compose(spr, [J.ground[0] - 44, Math.round(J.hip[1]), J.ground[0] + 44, J.ground[1] + 4], 1), low = new Int32Array(c.W).fill(-1), on = (i, re) => c.top[i] >= 0 && re.test(spr[c.top[i]].n);
    for (let x = 0; x < c.W; x++) for (let y = c.H - 1; y >= 0; y--) if (on(y * c.W + x, cloth)) { low[x] = y; break; }
    let n = 0;
    for (let x = 0; x < c.W; x++) { if (low[x] >= 0) continue; let near = -1; for (let d = 1; d < c.W && near < 0; d++) near = x - d >= 0 && low[x - d] >= 0 ? x - d : x + d < c.W && low[x + d] >= 0 ? x + d : -1;
      if (near < 0) continue; for (let y = 0; y < low[near]; y++) if (on(y * c.W + x, boot)) n++; }
    return n;
  }
  SIMX.robeKick = robeKick;
  // (TASKS 2196, 2197) the mage from the front wears one robe, in the arch and the world, at rest and in every frame of the walk and the run
  // down (toward the camera) and sideways, in every outfit and helm: below the hip no cloak shows (the author: the cloak is not drawn with
  // the robe; mage__cape hung to the knee with its own zigzag hem: CLOAK px²); one trim band crosses the cloth below the hip, at the hem
  // (the cloak's and the robe's: 2); the front trim is one line, at most TRIM px wide in any row above the hem (the slit's two trims and the
  // near half's edge in the arch, a two-cell brown band like a leg in the world); no shin shows over the cloth (the near shin over the far
  // half of the skirt, its navy top a knee block torn off under the robe: LEG px²; sideways the shin's own kick past the skirt's back edge is KICK, TASKS 2201) and no navy of a shin's top shows at all (KNEE px²).
  // (TASKS 2201) the world's front trim at most TRIM.world: a half cell, the whole one read 3 px where the skirt's swing took it off the grid
  // Sizes in screen px of the sandbox's world scale, the arch counted at its texel density (ARCH_Z)
  function mageFrontRobe(out) {
    const CLOAK = 0, SHARE = 0.5, GAP = 2, UPPER = 0.75, TRIM = { world: 2, arch: 3 }, KICK = 3, LEG = 2, KNEE = 1, ARCH_Z = 3.2, T0 = 10, FPS = 60, RUN = root.SIM.K.RUN, SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets());
    const it = (b, slot) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, [slot === 'weapon' ? 'atk' : 'def']: 3 }), rig = D.CLASSES.mage.look.rig, nm = (re) => new RegExp(`^${rig}__(${re})`);
    const cloth = nm('body|thigh|cape'), hems = nm('thigh|cape'), skirt = nm('thigh'), shin = nm('shin|foot'), cloak = nm('cape'), orange = (p) => p[0] > 90 && p[0] > p[2] + 30, navy = (p) => p[2] > p[0] + 8 && p[2] > p[1] + 5;
    const worst = { cloak: [0], bands: [1], trim: [0], trimA: [0], leg: [0], knee: [0], kick: [0] }, bad = (k, v, tag) => { if (v > worst[k][0]) worst[k] = [v, tag]; };
    for (const armor of ['robe', 'leather_armor', 'cloak']) for (const helm of ['', 'circlet', 'leather_helm']) for (const [way, dx, dy, pace, n] of [['arch', 0, 0, 0, 1], ['rest', 0, 0, 0, 1], ['down', 0, 1, 0.5, 12], ['down', 0, 1, 1, 12], ['right', 1, 0, 1, 12]]) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; Object.assign(R.hero.eq, { weapon: it('staff', 'weapon'), armor: it(armor, 'armor') });
      if (helm) R.hero.eq.helm = it(helm, 'helm'); else delete R.hero.eq.helm;
      const h = Object.assign({}, R.hero, { vx: dx * RUN * pace, vy: dy * RUN * pace, face: 1, aim: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), st = heroSt(S);
      const Z = way === 'arch' ? ARCH_Z : 1, Z2 = Z * Z;
      for (let k = 0; k < n; k++) {
        const J = {}, spr = [], tag = `${armor}${helm ? ' and ' + helm : ''}, ${way === 'arch' || way === 'rest' ? way : (pace < 1 ? 'walking ' : 'running ') + way + ', frame ' + k}`;
        L.joint = (id, q, p) => { if (id === 'hero') J[q] = p; }; L.sprite = (q, x, y, o) => { spr.push({ n: q, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
        h.gp = k * 2 * Math.PI / n; drawHero(h, 300, 300, T0 + k / FPS, st, way === 'arch' ? { menu: 1 } : {});
        const x0 = J.ground[0] - 44, y0 = Math.round(J.hip[1]), c = compose(spr, [x0, y0, J.ground[0] + 44, J.ground[1] + 4], Z), at = (i) => [c.rgb[i * 3], c.rgb[i * 3 + 1], c.rgb[i * 3 + 2]];
        const is = (i, re) => i >= 0 && re.test(spr[i].n);
        let cl = 0, knee = 0, leg = 0;
        for (let i = 0; i < c.W * c.H; i++) { const s = c.top[i]; if (is(s, cloak)) cl++; if (is(s, shin) && navy(at(i))) knee++; }
        for (let x = 0; x < c.W; x++) { let low = -1, high = c.H; for (let y = c.H - 1; y >= 0; y--) if (is(c.top[y * c.W + x], cloth)) { low = y; break; }
          for (let y = 0; y < c.H; y++) if (is(c.top[y * c.W + x], cloth)) { high = y; break; }
          for (let y = high; y < low; y++) if (is(c.top[y * c.W + x], shin)) leg++; }
        bad('cloak', cl / Z2, tag); bad('knee', knee / Z2, tag); if (!dx) bad('leg', leg / Z2, tag); else bad('kick', robeKick(spr, J), tag);
        const rows = []; for (let y = 0; y < c.H; y++) { let m = 0, o = 0; for (let x = 0; x < c.W; x++) { const i = y * c.W + x; if (!is(c.top[i], cloth)) continue; m++; if (orange(at(i))) o++; } rows.push({ m, o }); }
        const bands = []; for (let y = 0; y < c.H; y++) { let m = 0, o = 0; for (let x = 0; x < c.W; x++) { const q = y * c.W + x; if (!is(c.top[q], hems)) continue; m++; if (orange(at(q))) o++; }
          if (!(m && o >= SHARE * m)) continue; const B = bands[bands.length - 1]; if (B && y - B[1] <= GAP * Z) B[1] = y; else bands.push([y, y]); }
        bad('bands', bands.length, tag);
        const hem = rows.findIndex((r) => r.m && r.o >= 0.5 * r.m), top = Math.round((hem < 0 ? c.H : hem) * UPPER); let tw = 0; for (let y = 0; y < top; y++) { let o = 0; for (let x = 0; x < c.W; x++) { const i = y * c.W + x; if (is(c.top[i], skirt) && orange(at(i))) o++; } tw = Math.max(tw, o / Z); }
        bad(way === 'arch' ? 'trimA' : 'trim', tw, tag);
      } }
    if (worst.cloak[0] > CLOAK) out.push(`mage front: a cloak shows ${worst.cloak[0].toFixed(1)} px² below the hip, ${worst.cloak[1]} (the robe alone)`);
    if (worst.bands[0] > 1) out.push(`mage front: ${worst.bands[0]} trim bands below the hip, ${worst.bands[1]} (one, at the hem)`);
    for (const [k, lim] of [['trim', TRIM.world], ['trimA', TRIM.arch]]) if (worst[k][0] > lim) out.push(`mage front: the skirt's front trim is ${worst[k][0].toFixed(1)} px wide, ${worst[k][1]} (one line, at most ${lim})`);
    if (worst.leg[0] > LEG) out.push(`mage front: a shin shows over the robe by ${worst.leg[0].toFixed(1)} px², ${worst.leg[1]} (at most ${LEG})`);
    if (worst.kick[0] > KICK) out.push(`mage front: the trailing boot stands ${worst.kick[0].toFixed(1)} px² out of the robe above its hem, ${worst.kick[1]} (at most ${KICK})`);
    if (worst.knee[0] > KNEE) out.push(`mage front: a shin's navy top shows ${worst.knee[0].toFixed(1)} px², ${worst.knee[1]} (at most ${KNEE})`);
  }
  // (TASKS 2184) the hooded outfit's face in the world is the plain outfit's head (the small ref's cells: eye, brow, nose, the mage's grey
  // beard), laid into the hood's opening: of the pixels of each face block, at least SAME share equal the plain body's (the hood's own
  // drawn face voted into a brown blot with no eye); and the mage's world robe is darker and duller than the small ref's tone read
  // as too bright (mean luminance of its blue texels below the head at most BLUE_L and their spread of channels at most BLUE_S; it was 61 and 65)
  // (TASKS 2199) the mage's hood face read at 36 px: SHADE's cells (row, first and last column) are his own, not the plain head's: the hair
  // under the rim in the hood's shadow (mean luminance at most RIM_Y) and a grey brow over the near eye (between BROW_Y, neither skin
  // nor an outline's black)
  function heroHoodCheck(out) {
    const SAME = 0.9, BLUE_L = 52, BLUE_S = 60, FACE = { mage: [[2, 7, 9, 14], [8, 10, 10, 14]], archer: [[3, 8, 11, 15]], hero: [[3, 8, 10, 14]] };
    const SHADE = { mage: { rim: [2, 9, 13], brow: [5, 12, 13] } }, RIM_Y = 45, BROW_Y = [45, 80];
    const luma = (t, i) => 0.3 * t.P[i * 4] + 0.59 * t.P[i * 4 + 1] + 0.11 * t.P[i * 4 + 2];
    for (const [rig, rects] of Object.entries(FACE)) { const hd = png(rig + '__body_hd'), body = png(rig + '__body'), cell = hd.H / 42; let n = 0, eq = 0;
      const own = Object.values(SHADE[rig] || {}), mine = (x, y) => own.some(([r, c0, c1]) => Math.floor(y / cell) === r && Math.floor(x / cell) >= c0 && Math.floor(x / cell) <= c1);
      for (const [k, [r, c0, c1]] of Object.entries(SHADE[rig] || {})) { let m = 0, l = 0;
        for (let y = Math.ceil(r * cell); y < Math.ceil((r + 1) * cell); y++) for (let x = Math.ceil(c0 * cell); x < Math.ceil((c1 + 1) * cell); x++) { const i = y * hd.W + x; if (hd.A[i] >= 128) { m++; l += luma(hd, i); } }
        const v = m ? l / m : 0;
        if (k === 'rim' && !(m && v <= RIM_Y)) out.push(`hood face: ${rig}__body_hd hair under the rim luminance ${v.toFixed(0)} (the hood's shadow, at most ${RIM_Y})`);
        if (k === 'brow' && !(m && v >= BROW_Y[0] && v <= BROW_Y[1])) out.push(`hood face: ${rig}__body_hd brow luminance ${v.toFixed(0)} (${BROW_Y.join('..')})`); }
      for (const [r0, r1, c0, c1] of rects) for (let y = Math.round(r0 * cell); y < Math.round((r1 + 1) * cell); y++) for (let x = Math.round(c0 * cell); x < Math.round((c1 + 1) * cell); x++) {
        const i = y * hd.W + x; if (hd.A[i] < 128 && body.A[i] < 128 || mine(x, y)) continue; n++;
        if (hd.A[i] >= 128 === body.A[i] >= 128 && hd.P[i * 4] === body.P[i * 4] && hd.P[i * 4 + 1] === body.P[i * 4 + 1] && hd.P[i * 4 + 2] === body.P[i * 4 + 2]) eq++; }
      if (eq < SAME * n) out.push(`hood face: ${rig}__body_hd shares ${(100 * eq / n).toFixed(0)} % of its face block with ${rig}__body (at least ${SAME * 100})`); }
    const t = png('mage__body'); let k = 0, lum = 0, sat = 0;
    for (let i = 100 * t.W; i < t.W * t.H; i++) { if (t.A[i] < 128) continue; const r = t.P[i * 4], g = t.P[i * 4 + 1], b = t.P[i * 4 + 2];
      if (b > r + 30 && b > g + 10) { k++; lum += 0.3 * r + 0.59 * g + 0.11 * b; sat += Math.max(r, g, b) - Math.min(r, g, b); } }
    if (k && lum / k > BLUE_L) out.push(`mage robe: world blue luminance ${(lum / k).toFixed(1)} (at most ${BLUE_L})`);
    if (k && sat / k > BLUE_S) out.push(`mage robe: world blue channel spread ${(sat / k).toFixed(1)} (at most ${BLUE_S})`);
  }
  const SB0 = require('./sandbox.cjs');
  SIMX.checks.add('heroTexCheck', heroTexCheck);
  SIMX.checks.add('heroArmCheck', heroArmCheck);
  SIMX.checks.add('heroCapeCheck', heroCapeCheck);
  SIMX.checks.add('heroBackCheck', heroBackCheck);
  SIMX.checks.add('heroCapeBackCheck', heroCapeBackCheck);
  SIMX.checks.add('heroHoodCheck', heroHoodCheck);
  SIMX.checks.add('heroRobeCheck', mageFrontRobe);
  SIMX.checks.add('warriorFistCheck', warriorFistCheck);
  SIMX.checks.add('archerFistCheck', archerFistCheck);
})(typeof window !== 'undefined' ? window : globalThis);
