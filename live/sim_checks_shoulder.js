// live/sim_checks_shoulder.js — selfCheck's part for the near shoulder (TASKS 2188), composited on the CPU from the sprites drawHero lays
// down in the node sandbox and the textures' own pixels. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, heroSt, newRun, spawn } = SIMX, fs = require('fs'), zlib = require('zlib'), path = require('path');
  const TEX = {}, png = (n) => TEX[n] || (TEX[n] = (() => {
    const buf = fs.readFileSync(path.join(__dirname, 'assets', n + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
    if (buf[24] !== 8 || buf[25] !== 6) throw new Error(n + ': only 8-bit RGBA PNGs are read');
    const idat = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o); if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
    const raw = zlib.inflateSync(Buffer.concat(idat)), st = W * 4, px = Buffer.alloc(H * st);
    for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = y * (st + 1) + 1, o = y * st;
      for (let x = 0; x < st; x++) { const a = x >= 4 ? px[o + x - 4] : 0, b = y ? px[o - st + x] : 0, c = x >= 4 && y ? px[o - st + x - 4] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        px[o + x] = (raw[r + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
    return { W, H, P: px }; })());
  // the poses the near arm takes, per class: the arch at rest, the world at rest (both facings, a few moments of the idle sway), the run
  // in four directions over a stride, the class's actions through their envelope, a turn, a hurt, a dash; in each outfit and offhand
  const KITS = { warrior: [{ weapon: 'sword' }, { weapon: 'sword', offhand: 'shield' }, { weapon: 'sword', armor: 'plate_armor' }, { weapon: 'sword', armor: 'cloak' }, { weapon: 'sword', armor: '' }],
    archer: [{ weapon: 'shortbow' }, { weapon: 'longbow' }, { weapon: 'crossbow' }, { weapon: 'shortbow', armor: 'cloak' }],
    mage: [{ weapon: 'staff' }, { weapon: 'staff', offhand: 'orb' }, { weapon: 'wand', offhand: 'orb' }, { weapon: 'staff', armor: 'leather_armor' }, { weapon: 'staff', armor: 'cloak' }] };
  const ACTS = { warrior: [['blow', { atkT: 0 }], ['whirl', { whirlT: 0 }], ['charge', { castT: 0, castK: 'charge' }], ['cry', { castT: 0, castK: 'cry' }]],
    archer: [['shot', { atkT: 0, patkT: 0 }], ['volley', { castT: 0, castK: 'volley' }]],
    mage: [['shot', { atkT: 0, patkT: 0 }], ['frost', { castT: 0, castK: 'frost' }], ['fireball', { castT: 0, castK: 'fireball' }]] };
  const T0 = 10, RUN_N = 12, ACT_TS = [0.04, 0.1, 0.18, 0.3, 0.42], TURN_TS = [0.02, 0.05, 0.09, 0.12];
  function poses(cls, full = true) {
    const out = [], base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
    const kits = full ? KITS[cls] : KITS[cls].slice(0, 1);
    for (const kit of kits) { const kn = Object.entries(kit).map(([k, v]) => (k === 'weapon' ? v : `${k}:${v || 'none'}`)).join(' '), add = (p, GT, h, o = {}) => out.push({ cls, kit, tag: `${cls} ${kn} ${p}`, GT, h: Object.assign({}, base, h), o });
      add('arch rest', T0, {}, { menu: 1 });
      add('arch rest later', T0 + 1.3, {}, { menu: 1 });
      for (const face of [1, -1]) for (const t of [0, 1.3, 2.9]) add(`rest face ${face} at +${t}`, T0 + t, { face });
      if (!full) continue;
      const K = SIM.K.RUN;
      for (const [dn, vx, vy, face, back] of [['right', K, 0, 1, 0], ['left', -K, 0, -1, 0], ['down', 0, K, 1, 0], ['up', 0, -K, 1, 1]])
        for (let i = 0; i < RUN_N; i++) add(`run ${dn} ${i}/${RUN_N}`, T0, { vx, vy, face, back, gp: 1 + 2 * Math.PI * i / RUN_N, backT: back ? T0 - 1 : -9 });
      for (const [an, at] of ACTS[cls]) for (const [aim, face] of [[0, 1], [Math.PI / 2, 1], [-2.3, -1]]) for (const t of ACT_TS)
        add(`${an} aim ${aim.toFixed(1)} +${t}`, T0, Object.assign({ face, aim, atkA: aim, whirlA: aim }, Object.fromEntries(Object.entries(at).map(([k, v]) => [k, typeof v === 'number' ? T0 - t + v : v]))));
      for (const t of TURN_TS) add(`turn +${t}`, T0, { face: -1, faceT: T0 - t });
      add('hurt', T0, { hurtT: T0 - 0.06, hurtX: 1 });
      add('dash', T0, { dashT: T0 - 0.1, dashX: 1 }); }
    return out;
  }
  const SIM = root.SIM; let RG0 = null; const RIGS = () => RG0 || (RG0 = require('./sandbox.cjs').rigs());
  // the figure is the rig's own parts but the cape and the quiver hung behind it, and what the far arm carries with it (the orb in its
  // palm, a shield on its forearm); not a weapon: laid over a gap in one frame, the next swing shows it. A sprite drawn at under half its
  // alpha is not counted
  const BEHIND = /__(cape|quiver)/, HELD = /^(orb_held|it_shield|it_buckler)/;
  // a gap: a pixel by the upper arm (within NEAR of the height of the line shoulder → elbow, from ABOVE of the height over the shoulder down
  // UPPER of the upper arm) no figure sprite covers, with figure pixels within REACH (shares of the height) to its left and its right and
  // above and below it: a slot enclosed by the figure, not the open armpit of an arm flung out wider than REACH
  const REACH = [0.08, 0.2], NEAR = 0.07, ABOVE = 0, UPPER = 0.85, SIDE = NEAR + 0.04, LOW = 0.2;
  function shoulderGap(drawHero, L, p, Z = 4, img = false) {
    const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: p.cls }); S.run = R;
    const item = (b, slot) => (b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot } : undefined);
    for (const [k, b] of Object.entries(p.kit)) R.hero.eq[k] = item(b, k);
    const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
    drawHero(Object.assign({}, R.hero, p.h), 300, 300, p.GT, heroSt(S), p.o);
    const rig = D.CLASSES[p.cls].look.rig + '__', H = J.ground[1] - J.top[1], sh = J.shL, el = J.elbowL, up = Math.hypot(el[0] - sh[0], el[1] - sh[1]);
    const x0 = Math.floor((sh[0] - SIDE * H) * Z), x1 = Math.ceil((sh[0] + SIDE * H) * Z), y0 = Math.floor((sh[1] - ABOVE * H) * Z), y1 = Math.ceil((sh[1] + UPPER * up + LOW * H) * Z);
    const W = x1 - x0, Hh = y1 - y0, fig = new Uint8Array(W * Hh), rgba = img ? new Uint8Array(W * Hh * 4) : null;
    if (rgba) for (let i = 0; i < W * Hh; i++) { rgba[i * 4] = 24; rgba[i * 4 + 1] = 40; rgba[i * 4 + 2] = 24; rgba[i * 4 + 3] = 255; }
    for (const q of spr) {
      const o = q.o; if (!o || !o.m || (o.u && o.u.alpha !== undefined && o.u.alpha < 0.5)) continue;
      let t; try { t = png(q.n); } catch (e) { continue; }
      const [a, b, c, d, e, f] = o.m, det = a * d - b * c; if (!det) continue;
      const own = (q.n.startsWith(rig) && !BEHIND.test(q.n)) || HELD.test(q.n);
      for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
        const X = (x0 + px + 0.5) / Z - e, Y = (y0 + py + 0.5) / Z - f, lx = (d * X - c * Y) / det + o.pivot[0], ly = (-b * X + a * Y) / det + o.pivot[1];
        const u = Math.floor(lx / o.w * t.W), v = Math.floor(ly / o.h * t.H); if (u < 0 || v < 0 || u >= t.W || v >= t.H) continue;
        const k = (v * t.W + u) * 4; if (t.P[k + 3] < 128) continue;
        const i = py * W + px; if (own) fig[i] = 1;
        if (rgba) for (let ch = 0; ch < 3; ch++) rgba[i * 4 + ch] = t.P[k + ch]; }
    }
    const rx = Math.round(REACH[0] * H * Z), ry = Math.round(REACH[1] * H * Z), has = (x, y) => fig[y * W + x], ax = (el[0] - sh[0]) / up, ay = (el[1] - sh[1]) / up;
    let n = 0; const pts = [];
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { if (fig[y * W + x]) continue;
      const qx = (x0 + x + 0.5) / Z - sh[0], qy = (y0 + y + 0.5) / Z - sh[1], along = qx * ax + qy * ay, off = Math.abs(qx * ay - qy * ax);
      if (along < -ABOVE * H || along > UPPER * up || off > NEAR * H) continue;
      let l = 0, rr = 0; for (let k = 1; k <= rx && !(l && rr); k++) { l = l || (x - k >= 0 && has(x - k, y)); rr = rr || (x + k < W && has(x + k, y)); }
      if (!(l && rr)) continue;
      let u = 0, dn = 0; for (let k = 1; k <= ry && !(u && dn); k++) { u = u || (y - k >= 0 && has(x, y - k)); dn = dn || (y + k < Hh && has(x, y + k)); }
      if (u && dn) { n++; pts.push([(x0 + x + 0.5) / Z, (y0 + y + 0.5) / Z]); if (rgba) { const i = (y * W + x) * 4; rgba[i] = 255; rgba[i + 1] = 0; rgba[i + 2] = 255; } } }
    const RG = RIGS()[D.CLASSES[p.cls].look.rig], bq = spr.find((q) => q.n.startsWith(D.CLASSES[p.cls].look.rig + '__body')), m = bq.o.m, fX = Math.sign(m[0] * m[3] - m[1] * m[2]);
    const rot = Math.atan2(-m[2], m[3]), ra = Math.atan2(RG.elbowL[1] - RG.shL[1], fX * (RG.elbowL[0] - RG.shL[0])) + rot, va = Math.atan2(el[1] - sh[1], el[0] - sh[0]);
    const turn = fX * (((va - ra) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    const bi = (q) => { const [a, b, c, d, e, f] = m, det = a * d - b * c, X = q[0] - e, Y = q[1] - f; return [(d * X - c * Y) / det + bq.o.pivot[0], (-b * X + a * Y) / det + bq.o.pivot[1]].map((v, k) => v / (k ? bq.o.h : bq.o.w) * (k ? RG.h : RG.w)); };
    const back = spr.some((q) => q.n.startsWith(rig + 'body_back') && !(q.o.u && q.o.u.alpha < 0.5));
    return { gap: n / Z / Z, n, z: Z, turn, back, rigPts: pts.map(bi), img: rgba ? { W, H: Hh, rgba } : null };
  }
  // (TASKS 2188) the near shoulder holds together in every pose: between pauldron, sleeve and torso no gap shows the cape or the floor
  // through (the author's frame 25: the upper arm turned out by NEAR_OUT under the torso's shoulder cap left a wedge of 6–12 world px²).
  // Every pose of poses() for every class seen from the front: the gap at most MAX world px² (a corner where an arm folded to the chest
  // meets it); the back view's frames of a turn or a whirl are counted by tools/measure/shoulders2188/sweep.cjs, not here
  function heroShoulderCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), MAX = 2, seen = new Set();
    for (const cls of Object.keys(KITS)) for (const p of poses(cls)) { const r = shoulderGap(drawHero, L, p, 4);
      const k = p.tag.replace(/[\d./+-]+/g, ''); if (!r.back && r.gap > MAX && !seen.has(k)) { seen.add(k); out.push(`hero shoulder: ${p.tag}: a gap of ${r.gap.toFixed(1)} world px² at the near shoulder (at most ${MAX})`); } }
  }
  SIMX.shoulder = { poses, shoulderGap, KITS };
  SIMX.checks.add('heroShoulderCheck', heroShoulderCheck);
})(typeof window !== 'undefined' ? window : globalThis);
