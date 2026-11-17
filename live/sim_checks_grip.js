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
  // the draw the string's two halves meet at the near fist. Frames with the weapon behind the body (under it) are skipped
  function archerFistCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), AXIS = 2, OVER = 4, PAST = 1, NOCK = 3, MID = 0.25, STRING_COL = '0.66,0.6,0.5', d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const seen = new Set(); let counted = 0;
    for (const wb of ['shortbow', 'longbow', 'crossbow']) {
      const BT = D.SHOTS[D.BASES[wb].shot || 'bolt'].t, POSES = [['rest', 0, 10, -9], ['rest', 0, 11.3, -9], ['run', 150, 10, -9], ['run', 150, 10.4, -9], ['draw', 0, 10 + 0.6 * BT, 10], ['draw', 0, 10 + 0.95 * BT, 10], ['loose', 0, 10 + BT + 0.06, 10]];
      for (const face of [1, -1]) for (const menu of [0, 1]) for (const [act, vx, GT, atkT] of POSES) {
        if (menu && act !== 'rest') continue;
        const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'archer' }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
        const h = Object.assign({}, R.hero, { vx, vy: 0, gp: GT * 4, face, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT, patkT: -9, castT: -9, whirlT: -9 });
        const J = {}, spr = [], sol = [], tag = `archer ${wb} ${act} face ${face}${menu ? ' in the arch' : ''} at ${GT.toFixed(2)}`;
        const say = (m) => { const k = wb + act + m.replace(/[\d.]+/g, ''); if (!seen.has(k)) { seen.add(k); out.push(`archer fist: ${tag}: ${m}`); } };
        L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; };
        L.solid = (x, y, w, hh, col, a) => sol.push({ p: [x, y], q: [x + w * Math.cos(a), y + w * Math.sin(a)], col: String(col) });
        drawHero(h, 300, 300, GT, heroSt(S), menu ? { menu: 1 } : {});
        const side = d(J.grip, J.handL) < d(J.grip, J.handR) ? 'L' : 'R', wi = spr.findIndex((q) => /^it_(bow_[sl]|crossbow)/.test(q.n)), body = spr.findIndex((q) => /^archer__body/.test(q.n));
        const fi = spr.findIndex((q) => q.n.startsWith('archer__fist' + side));
        if (wi < 0) { say('the weapon is not drawn'); continue; }
        if (wi < body) continue;
        if (fi < 0) { say(`no ${side} fist is drawn over the weapon`); continue; }
        if (fi < wi) say('the weapon is drawn over the fist');
        counted++;
        const strs = sol.filter((q) => q.col === STRING_COL), g = J.grip, xb = wb === 'crossbow';
        if (!xb && strs.length !== 2) { say(`the string is drawn in ${strs.length} pieces`); continue; }
        const ax = xb ? [J.tip[0] - g[0], J.tip[1] - g[1]] : [strs[1].p[0] - strs[0].p[0], strs[1].p[1] - strs[0].p[1]], len = Math.hypot(...ax), u = [ax[0] / len, ax[1] / len];
        const fist = texelsOf(L, spr[fi]), wpn = texelsOf(L, spr[wi]), cell = (p) => Math.floor(p[0]) + ',' + Math.floor(p[1]), fc = new Set(fist.map(cell));
        const c = fist.reduce((a, p) => [a[0] + p[0] / fist.length, a[1] + p[1] / fist.length], [0, 0]), off = Math.abs((c[0] - g[0]) * u[1] - (c[1] - g[1]) * u[0]);
        if (off > AXIS) say(`the ${wb}'s axis passes ${off.toFixed(1)} px from the fist's centre`);
        const over = new Set(wpn.map(cell).filter((k) => fc.has(k))).size;
        if (over < OVER) say(`the fist lies over ${over} px of the ${wb}`);
        const along = (p) => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1], fa = fist.map(along), lo = Math.min(...fa), hi = Math.max(...fa), wa = wpn.filter((p) => !fc.has(cell(p))).map(along);
        if (!wa.some((a) => a > hi + PAST) || !wa.some((a) => a < lo - PAST)) say(`the ${wb} does not show on both sides of the fist (fist ${lo.toFixed(1)}..${hi.toFixed(1)} px along it)`);
        if (!xb) { const n1 = d(c, strs[0].p), n2 = d(c, strs[1].p), mid = Math.abs(n1 - n2) / (n1 + n2);
          if (mid > MID) say(`the fist holds the stave ${n1.toFixed(0)} and ${n2.toFixed(0)} px from its tips, off the grip in its middle`); }
        if (act === 'draw' && !xb) { const fr = spr.find((q) => q.n.startsWith('archer__fistR')), cr = fr && texelsOf(L, fr).reduce((a, p, i, all) => [a[0] + p[0] / all.length, a[1] + p[1] / all.length], [0, 0]);
          if (!fr || spr.indexOf(fr) < wi) say('the string hand\'s fist is not drawn over the string');
          else for (const q of strs) if (d(q.q, cr) > NOCK) say(`the string ends ${d(q.q, cr).toFixed(1)} px from the string hand's fist`); }
      }
    }
    if (counted < 48) out.push(`archer fist: only ${counted} frames hold the weapon in front of the body`);
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
  const SB0 = require('./sandbox.cjs');
  SIMX.checks.add('heroTexCheck', heroTexCheck);
  SIMX.checks.add('heroArmCheck', heroArmCheck);
  SIMX.checks.add('warriorFistCheck', warriorFistCheck);
  SIMX.checks.add('archerFistCheck', archerFistCheck);
})(typeof window !== 'undefined' ? window : globalThis);
