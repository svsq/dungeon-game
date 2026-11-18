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
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), AXIS = 2, OVER = 4, PAST = 1, NOCK = 3, MID = 0.25, STRING_COL = '0.5,0.48,0.45', d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const ARCH_COL = '0.66,0.6,0.5', ARCH = [3.2, 0, 0, 3.2, -2.2 * 300, -2.2 * 300], GAP = 0.1, runs = [];
    const seen = new Set(); let counted = 0;
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
  function heroArmCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), STACKS = 3, LINE = 4, seen = new Set();
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
        let lo = 255; for (let i = 0; i < t.W * t.H; i++) if (t.A[i] > 127) lo = Math.min(lo, lum(i));
        const ys = [];
        for (let y = 1; y < t.H - 2; y++) { let k = 0;
          for (let x = 0; x < t.W; x++) { const i = y * t.W + x, v = lum(i); if (v >= 0 && v <= lo + 24 && lum(i - t.W) > lo + 24 && Math.max(lum(i + t.W), lum(i + 2 * t.W)) > lo + 24) k++; }
          if (k >= LINE) ys.push(y); }
        const n0 = ys.filter((y, i) => !i || y > ys[i - 1] + 1).length;
        if (n0 < STACKS) out.push(`hero arm: ${n}: ${n0} lines between finger stacks, not a closed fist`); } }
    heroArmMotion(out, SB, drawHero, L);
  }
  // (TASKS 2180) the weapon arm through an action, frame by frame at 60 fps: the warrior's blow carries his fist at least PATH of the height
  // in its first 0.35 s in every direction (the hold at ease, posed after the blow, kept the fist at the hip and the blade turned round it),
  // keeps one layer and a fist on the hilt from wind-up to guard (the blade's own angle took it under the torso with an open hand for
  // the frames it pointed away); in every action the arm's copy over the body gains at most STEP of its alpha a frame; the body's lean
  // comes back to rest by the action's end (END s, a swing's and a cast's), not cut off there (the top of the head jumps at most JUMP px a frame round its end)
  function heroArmMotion(out, SB, drawHero, L) {
    const PATH = 0.3, STEP = 0.5, JUMP = 1, FPS = 60, T0 = 10, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), END = 0.5;
    const ACTS = [['warrior', 'sword', 'blow', { atkT: T0 }], ['archer', 'shortbow', 'shot', { atkT: T0, patkT: T0 }], ['mage', 'staff', 'shot', { atkT: T0, patkT: T0 }],
      ['mage', 'staff', 'fireball', { castT: T0, castK: 'fireball' }], ['mage', 'staff', 'frost', { castT: T0, castK: 'frost' }], ['archer', 'shortbow', 'volley', { castT: T0, castK: 'volley' }]];
    const AIMS = [['right', 0], ['down', Math.PI / 2], ['up', -Math.PI / 2], ['left', Math.PI], ['up-left', -2.3]];
    for (const [cls, wb, act, at] of ACTS) for (const [an, aim] of act === 'blow' ? AIMS : AIMS.slice(0, 1)) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      const st = heroSt(S), pn = D.CLASSES[cls].look.rig + '__', tag = `${cls} ${act} aimed ${an}`, rows = [];
      for (let k = 0; k <= 0.7 * FPS; k++) { const J = {}, spr = [];
        L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, a: o && o.u && o.u.alpha !== undefined ? o.u.alpha : 1 }); return { w: 10, h: 10 }; }; L.solid = () => {};
        drawHero(Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 40, face: Math.cos(aim) < -0.1 ? -1 : 1, aim, atkA: aim, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }, at), 300, 300, T0 + k / FPS, st, {});
        const idx = (re) => spr.map((q, i) => (q.n.startsWith(pn) && re.test(q.n.slice(pn.length)) ? i : -1)).filter((i) => i >= 0), body = idx(/^body/)[0] ?? -1, ua = idx(/^uarmR/).filter((i) => i > body);
        rows.push({ J, t: k / FPS, over: ua.length ? spr[ua[0]].a : 0, wpn: spr.findIndex((q) => /^it_/.test(q.n)) > body, farm: idx(/^farmR/).length > 0, fist: idx(/^fistR/).length > 0, back: body < 0 }); }
      const H = rows[0].J.ground[1] - rows[0].J.top[1];
      if (act === 'blow') { const path = rows.filter((r) => r.t > 0 && r.t <= 0.35 + 1e-9).reduce((a, r, i, all) => a + d(r.J.handR, (i ? all[i - 1] : rows[0]).J.handR), 0) / H;
        if (path < PATH) out.push(`hero arm: ${tag}: the fist travels ${path.toFixed(2)} of the height in the blow's first 0.35 s (at least ${PATH})`);
        const blow = rows.filter((r) => r.t < END && !r.back), lay = new Set(blow.map((r) => r.wpn));
        if (lay.size > 1) out.push(`hero arm: ${tag}: the sword goes under the torso and over it within the blow`);
        if (blow.some((r) => r.farm || !r.fist)) out.push(`hero arm: ${tag}: the fist on the hilt opens into a hand in ${blow.filter((r) => r.farm || !r.fist).length} frames of the blow`); }
      const steps = rows.slice(1).map((r, i) => r.over - rows[i].over), up = Math.max(...steps);
      if (up > STEP) out.push(`hero arm: ${tag}: the arm comes over the body by ${up.toFixed(2)} of its alpha in one frame (at most ${STEP})`);
      const e = Math.round(END * FPS), jump = Math.max(...rows.slice(e - 4, e + 5).map((r, i) => d(r.J.top, rows[e - 5 + i].J.top)));
      if (jump > JUMP) out.push(`hero arm: ${tag}: the body jumps ${jump.toFixed(1)} px in a frame as the action ends`);
    }
  }
  // (TASKS 2157) a hero texture no outfit, pose, view or the arch asks for still loads at start: every class in every combination of
  // the bases of each slot, with each weapon and offhand, in a few poses, front and back, world and arch; a texture neither drawn nor
  // looked up (an existence test decides a pose: cuffR, head_<helm>, _w maps) is a dead file
  function heroTexCheck(out) {
    const HERO = /^(hero|mage|archer)__/, raw = SB0.assets(), used = new Set(), sizes = new Proxy(raw, { get: (t, k) => { if (typeof k === 'string') used.add(k); return t[k]; } });
    const { drawHero, L } = SB0.heroBox(D, root.SIM, sizes), slot = (s) => [''].concat(Object.keys(D.BASES).filter((k) => D.BASES[k].slot === s));
    L.sprite = (n) => { used.add(n); return { w: 10, h: 10 }; }; L.solid = () => {}; L.joint = () => {};
    const item = (b) => (b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 } : undefined), T = 10;
    const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
    const ACTS = [{}, { vx: 150 }, { back: 1 }, { atkT: T - 0.15 }, { atkT: T - 0.15, aim: Math.PI, face: -1 }, { patkT: T - 0.1 }, { castT: T - 0.1 }];
    const draw = (cls, eq, acts) => { const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R;
      for (const k of ['armor', 'helm', 'gloves', 'boots', 'weapon', 'offhand']) R.hero.eq[k] = item(eq[k]);
      const st = heroSt(S); for (const a of acts) for (const o of [{}, { menu: 1 }]) if (!(o.menu && a.vx)) drawHero(Object.assign({}, R.hero, base, a), 300, 300, T, st, o); };
    for (const cls of Object.keys(D.CLASSES)) {
      for (const armor of slot('armor')) for (const helm of slot('helm')) for (const gloves of slot('gloves')) for (const boots of slot('boots')) draw(cls, { armor, helm, gloves, boots, weapon: 'sword' }, ACTS.slice(0, 3));
      for (const weapon of slot('weapon')) for (const offhand of slot('offhand')) for (const gloves of slot('gloves')) draw(cls, { weapon, offhand, gloves }, ACTS);
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
  }
  // (TASKS 2184) the hooded outfit's face in the world is the plain outfit's head (the small ref's cells: eye, brow, nose, the mage's grey
  // beard), laid into the hood's opening: of the pixels of each face block, at least SAME share equal the plain body's (the hood's own
  // drawn face voted into a brown blot with no eye); and the mage's world robe is darker and duller than the small ref's tone read
  // as too bright (mean luminance of its blue texels below the head at most BLUE_L and their spread of channels at most BLUE_S; it was 61 and 65)
  function heroHoodCheck(out) {
    const SAME = 0.9, BLUE_L = 52, BLUE_S = 60, FACE = { mage: [[2, 7, 9, 14], [8, 10, 10, 14]], archer: [[3, 8, 11, 15]], hero: [[3, 8, 10, 14]] };
    for (const [rig, rects] of Object.entries(FACE)) { const hd = png(rig + '__body_hd'), body = png(rig + '__body'), cell = hd.H / 42; let n = 0, eq = 0;
      for (const [r0, r1, c0, c1] of rects) for (let y = Math.round(r0 * cell); y < Math.round((r1 + 1) * cell); y++) for (let x = Math.round(c0 * cell); x < Math.round((c1 + 1) * cell); x++) {
        const i = y * hd.W + x; if (hd.A[i] < 128 && body.A[i] < 128) continue; n++;
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
  SIMX.checks.add('heroHoodCheck', heroHoodCheck);
  SIMX.checks.add('warriorFistCheck', warriorFistCheck);
  SIMX.checks.add('archerFistCheck', archerFistCheck);
})(typeof window !== 'undefined' ? window : globalThis);
