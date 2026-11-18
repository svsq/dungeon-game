// live/sim_checks_shoulder.js — selfCheck's part for the near shoulder (TASKS 2188, 2191), composited on the CPU from the sprites drawHero
// lays down in the node sandbox and the textures' own pixels. Node only, like sim_checks.js.
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
  const lstar = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, Y = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
  const lab = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, R = f(r), G = f(g), B = f(b);
    const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116), X = h((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = h(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = h((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
  // (TASKS 2203) the cape's cloth: the mean Lab of its texture's lit px (L* over CLOTH_L: not its outline and fold shade)
  const CLOTH_L = 15, CLOTH = {}, cloth = (n) => CLOTH[n] || (CLOTH[n] = (() => { const t = png(n), s = [0, 0, 0]; let k = 0;
    for (let i = 0; i < t.W * t.H; i++) { if (t.P[i * 4 + 3] < 128) continue; const q = lab(t.P[i * 4], t.P[i * 4 + 1], t.P[i * 4 + 2]); if (q[0] < CLOTH_L) continue; for (let j = 0; j < 3; j++) s[j] += q[j]; k++; }
    return s.map((v) => v / Math.max(k, 1)); })());
  // the poses the near arm takes, per class: the arch and the world at rest (both facings, BREATHS moments of the breath and the sway), the
  // run in four directions over a stride, the class's actions through their envelope, a turn, a hurt, a dash; in each outfit and offhand
  const KITS = { warrior: [{ weapon: 'sword' }, { weapon: 'sword', offhand: 'shield' }, { weapon: 'sword', armor: 'plate_armor' }, { weapon: 'sword', armor: 'cloak' }, { weapon: 'sword', armor: '' }],
    archer: [{ weapon: 'shortbow' }, { weapon: 'longbow' }, { weapon: 'crossbow' }, { weapon: 'shortbow', armor: 'cloak' }],
    mage: [{ weapon: 'staff' }, { weapon: 'staff', offhand: 'orb' }, { weapon: 'wand', offhand: 'orb' }, { weapon: 'staff', armor: 'leather_armor' }, { weapon: 'staff', armor: 'cloak' }] };
  const ACTS = { warrior: [['blow', { atkT: 0 }], ['whirl', { whirlT: 0 }], ['charge', { castT: 0, castK: 'charge' }], ['cry', { castT: 0, castK: 'cry' }]],
    archer: [['shot', { atkT: 0, patkT: 0 }], ['volley', { castT: 0, castK: 'volley' }]],
    mage: [['shot', { atkT: 0, patkT: 0 }], ['frost', { castT: 0, castK: 'frost' }], ['fireball', { castT: 0, castK: 'fireball' }]] };
  // (TASKS 2191) BREATHS moments of the rest spread over the sway's 7.6 s: two moments let the wedge breathe past unseen (the author's frame
  // 25 is one of its widest)
  const T0 = 10, RUN_N = 12, BREATHS = 10, ACT_TS = [0.04, 0.1, 0.18, 0.3, 0.42], TURN_TS = [0.02, 0.05, 0.09, 0.12];
  function poses(cls, full = true) {
    const out = [], base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
    const kits = full ? KITS[cls] : KITS[cls].slice(0, 1);
    for (const kit of kits) { const kn = Object.entries(kit).map(([k, v]) => (k === 'weapon' ? v : `${k}:${v || 'none'}`)).join(' '), add = (p, GT, h, o = {}) => out.push({ cls, kit, tag: `${cls} ${kn} ${p}`, GT, h: Object.assign({}, base, h), o });
      for (let i = 0; i < BREATHS; i++) add(i ? `arch rest at +${(i * 0.76).toFixed(2)}` : 'arch rest', T0 + i * 0.76, {}, { menu: 1 });
      for (const face of [1, -1]) for (let i = 0; i < BREATHS; i++) add(`rest face ${face} at +${(i * 0.76).toFixed(2)}`, T0 + i * 0.76, { face });
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
  const BEHIND = /__(cape|quiver)/, HELD = /^(orb_held|it_shield|it_buckler)/, ARM = /__(uarm|farm|cuff|fist|cup)L/;
  // a gap: a pixel by the upper arm (within NEAR of the height of the line shoulder → elbow, from ABOVE of the height over the shoulder down
  // UPPER of the upper arm, past the elbow to the forearm where 2191 found the wedge at 0.96–1.38) no figure sprite covers, with figure
  // pixels within REACH (shares of the height) to its left and its right and above and below it: a slot enclosed by the figure, not the
  // open armpit of an arm flung out wider than REACH
  // dark: a pixel of the torso, on top, darker than INK (L*), within SEAM world px of the near arm or its 2188 copy on the arm's side and
  // joined to it by dark torso only (a rivet or a fold line with lit cloth or steel between it and the sleeve is not the seam), from
  // the shoulder down to the elbow, its dark run going on into the torso no more than LINE world px: the outline and armpit shade painted
  // into the torso along the sleeve, opaque, so no alpha test sees it (the 2191 seam), not a belt's or a plate's rim running across
  // sock: a pixel where the 2188 copy of the upper arm is on top at rest, its own skin and outline read as a second sleeve
  // (TASKS 2203) the first GAP world px of dark from the sleeve are not the seam: the sheets draw a dark gap there (0.013 H, ~1 world px,
  // L* ~12, outlined) and 2203 paints its visible half; the 2191 seam was 4-6 texels (1-1.4 world px) and still counts past it. The
  // world's torso is painted in cells of two world px (gridify_2155's grid of 42 rows), so there the gap is half a cell: GAP_WORLD
  const REACH = [0.08, 0.2], NEAR = 0.07, ABOVE = 0, UPPER = 1.4, SIDE = NEAR + 0.04, LOW = 0.2, INK = 20, SEAM = 2.5, LINE = 3, GAP = 0.5, GAP_WORLD = 1;
  function shoulderGap(drawHero, L, p, Z = 4, img = false, upper = UPPER) {
    const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: p.cls }); S.run = R;
    const item = (b, slot) => (b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot } : undefined);
    for (const [k, b] of Object.entries(p.kit)) R.hero.eq[k] = item(b, k);
    const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
    drawHero(Object.assign({}, R.hero, p.h), 300, 300, p.GT, heroSt(S), p.o);
    const rig = D.CLASSES[p.cls].look.rig + '__', H = J.ground[1] - J.top[1], sh = J.shL, el = J.elbowL, up = Math.hypot(el[0] - sh[0], el[1] - sh[1]);
    const x0 = Math.floor((sh[0] - SIDE * H) * Z), x1 = Math.ceil((sh[0] + SIDE * H) * Z), y0 = Math.floor((sh[1] - ABOVE * H) * Z), y1 = Math.ceil((sh[1] + upper * up + LOW * H) * Z);
    const W = x1 - x0, Hh = y1 - y0, fig = new Uint8Array(W * Hh), fig0 = new Uint8Array(W * Hh), kind = new Uint8Array(W * Hh), dk = new Uint8Array(W * Hh), rgba = img ? new Uint8Array(W * Hh * 4) : null, col = new Uint8Array(W * Hh * 3);
    if (rgba) for (let i = 0; i < W * Hh; i++) { rgba[i * 4] = 24; rgba[i * 4 + 1] = 40; rgba[i * 4 + 2] = 24; rgba[i * 4 + 3] = 255; }
    const uarms = spr.filter((q) => q.n.startsWith(rig + 'uarmL')), sockQ = uarms.length > 1 ? uarms[0] : null;
    for (const q of spr) {
      const o = q.o; if (!o || !o.m || (o.u && o.u.alpha !== undefined && o.u.alpha < 0.5)) continue;
      let t; try { t = png(q.n); } catch (e) { continue; }
      const [a, b, c, d, e, f] = o.m, det = a * d - b * c; if (!det) continue;
      const own = (q.n.startsWith(rig) && !BEHIND.test(q.n)) || HELD.test(q.n);
      const k0 = !own ? 1 : q === sockQ || q.n.includes('_sock') ? 4 : q.n.startsWith(rig + 'body') && !q.n.includes('back') ? 2 : ARM.test(q.n) ? 3 : 5;
      for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
        const X = (x0 + px + 0.5) / Z - e, Y = (y0 + py + 0.5) / Z - f, lx = (d * X - c * Y) / det + o.pivot[0], ly = (-b * X + a * Y) / det + o.pivot[1];
        const u = Math.floor(lx / o.w * t.W), v = Math.floor(ly / o.h * t.H); if (u < 0 || v < 0 || u >= t.W || v >= t.H) continue;
        const k = (v * t.W + u) * 4; if (t.P[k + 3] < 128) continue;
        const i = py * W + px; if (own) fig[i] = 1; if (own && k0 !== 4) fig0[i] = 1;
        kind[i] = k0; dk[i] = lstar(t.P[k], t.P[k + 1], t.P[k + 2]) < INK ? 1 : 0; for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = t.P[k + ch];
        if (rgba) for (let ch = 0; ch < 3; ch++) rgba[i * 4 + ch] = t.P[k + ch]; }
    }
    const rx = Math.round(REACH[0] * H * Z), ry = Math.round(REACH[1] * H * Z), has = (x, y) => fig[y * W + x], ax = (el[0] - sh[0]) / up, ay = (el[1] - sh[1]) / up;
    const RG = RIGS()[D.CLASSES[p.cls].look.rig], bq = spr.find((q) => q.n.startsWith(rig + 'body')), m = bq.o.m, fX = Math.sign(m[0] * m[3] - m[1] * m[2]);
    const shut = (F, x, y) => { let l = 0, rr = 0, u = 0, dn = 0; for (let k = 1; k <= rx && !(l && rr); k++) { l = l || (x - k >= 0 && F[y * W + x - k]); rr = rr || (x + k < W && F[y * W + x + k]); }
      for (let k = 1; k <= ry && !(u && dn); k++) { u = u || (y - k >= 0 && F[(y - k) * W + x]); dn = dn || (y + k < Hh && F[(y + k) * W + x]); } return l && rr && u && dn; };
    let n = 0, nd = 0, ns = 0, no = 0; const pts = [], sx = Math.round(SEAM * Z), rl = Math.round(LINE * Z), gw = Math.round((p.o.menu ? GAP : GAP_WORLD) * Z);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x;
      const qx = (x0 + x + 0.5) / Z - sh[0], qy = (y0 + y + 0.5) / Z - sh[1], along = qx * ax + qy * ay, off = Math.abs(qx * ay - qy * ax);
      if (along < -ABOVE * H || along > upper * up || off > NEAR * H) continue;
      if (kind[i] === 4) { ns++; const out = !shut(fig0, x, y); if (out) no++; if (rgba) { rgba[i * 4] = 255; rgba[i * 4 + 1] = out ? 120 : 230; rgba[i * 4 + 2] = 0; } }
      if (kind[i] === 2 && dk[i] && along <= up) { let arm = 0, run = 0; for (let k = 1; k <= sx; k++) { const xx = x - fX * k; if (xx < 0 || xx >= W) break; const kk = kind[i - fX * k];
          if (kk === 3 || kk === 4) { arm = k; break; } if (kk !== 2 || !dk[i - fX * k]) break; }
        for (let xx = x; xx >= 0 && xx < W && kind[y * W + xx] === 2 && dk[y * W + xx] && run <= rl; xx += fX) run++;
        if (arm > gw && run <= rl) { nd++; if (rgba) { rgba[i * 4] = 0; rgba[i * 4 + 1] = 255; rgba[i * 4 + 2] = 255; } } }
      if (fig[i]) continue;
      let l = 0, rr = 0; for (let k = 1; k <= rx && !(l && rr); k++) { l = l || (x - k >= 0 && has(x - k, y)); rr = rr || (x + k < W && has(x + k, y)); }
      if (!(l && rr)) continue;
      let u = 0, dn = 0; for (let k = 1; k <= ry && !(u && dn); k++) { u = u || (y - k >= 0 && has(x, y - k)); dn = dn || (y + k < Hh && has(x, y + k)); }
      if (u && dn) { n++; pts.push([(x0 + x + 0.5) / Z, (y0 + y + 0.5) / Z]); if (rgba) { rgba[i * 4] = 255; rgba[i * 4 + 1] = 0; rgba[i * 4 + 2] = 255; } } }
    const rot = Math.atan2(-m[2], m[3]), ra = Math.atan2(RG.elbowL[1] - RG.shL[1], fX * (RG.elbowL[0] - RG.shL[0])) + rot, va = Math.atan2(el[1] - sh[1], el[0] - sh[0]);
    const turn = fX * (((va - ra) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    const bi = (q) => { const [a, b, c, d, e, f] = m, det = a * d - b * c, X = q[0] - e, Y = q[1] - f; return [(d * X - c * Y) / det + bq.o.pivot[0], (-b * X + a * Y) / det + bq.o.pivot[1]].map((v, k) => v / (k ? bq.o.h : bq.o.w) * (k ? RG.h : RG.w)); };
    const back = spr.some((q) => q.n.startsWith(rig + 'body_back') && !(q.o.u && q.o.u.alpha < 0.5));
    const fc = SIMX.heroLayers.compose(spr, [J.ground[0] - 60, J.ground[1] - 1.3 * H, J.ground[0] + 60, J.ground[1] + 6], WZ); let nw = 0;
    for (const t of fc.top) if (t >= 0 && spr[t].n.includes('_sock')) nw++;
    const side = sideFill(spr, J, H, fX, x0, y0, W, Hh, Z, kind, col, rgba, !!p.o.menu);
    return { gap: n / Z / Z, dark: nd / Z / Z, capeFill: side.cape, flat: side.flat, sock: ns / Z / Z, sockOut: no / Z / Z, sockAll: nw / WZ / WZ, n, z: Z, turn, back, rigPts: pts.map(bi), img: rgba ? { W, H: Hh, rgba } : null };
  }
  // (TASKS 2203) the side strip 2191 painted in the cape's tone (the warrior's red, the archer's olive) read in the arch as the cape seen
  // through a cut in the torso, and a flat fill as no cloth at all. In the band from the near arm (upper arm, forearm or their copy) BAND
  // of the height into the torso: cape, from CAPE_TOP of the upper arm under the shoulder (above it the archer's mantle and the warrior's
  // scarf hang by the sheets) to the elbow, the torso px (on top: the cape really showing behind the arm is the cape's own sprite, not
  // counted) within ΔE76 CAPE_DE of the class's cape cloth (the warrior's red, the archer's olive; the gambeson under the belt and the
  // archer's brown cloak outfit are that cloth by the sheets) with at least CLUMP of its 8 neighbours so too: a fill, not rust specks;
  // flat, in the arch (the world's torso is painted in flat cells of two world px), from the shoulder to the hip, the torso px of L* over
  // FLAT_L whose 3×3 neighbourhood is all torso of the one colour (the sheets draw cloth, plate and leather there, a flat fill only in the
  // 1-px dark gap)
  const BAND = 0.045, CAPE_DE = 10, FLAT_L = 20, CAPE_TOP = 0.4, CLUMP = 5;
  function sideFill(spr, J, H, fX, x0, y0, W, Hh, Z, kind, col, rgba, arch) {
    const cq = spr.find((q) => /__cape/.test(q.n) && !(q.o.u && q.o.u.alpha !== undefined && q.o.u.alpha < 0.5)), bw = Math.round(BAND * H * Z);
    const ya = Math.max(0, Math.floor(J.shL[1] * Z) - y0), yb = Math.min(Hh, Math.ceil(J.hip[1] * Z) - y0), c = cq ? cloth(cq.n.replace(/__cape.*$/, '__cape')) : null;
    const ca = Math.floor((J.shL[1] + CAPE_TOP * (J.elbowL[1] - J.shL[1])) * Z) - y0, cb = Math.ceil(J.elbowL[1] * Z) - y0;
    let nc = 0, nf = 0; const isc = new Uint8Array(W * Hh);
    if (c) for (let i = 0; i < W * Hh; i++) { if (kind[i] !== 2) continue; const q = lab(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]); isc[i] = Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]) < CAPE_DE ? 1 : 0; }
    for (let y = ya; y < yb; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (kind[i] !== 2) continue;
      let arm = false; for (let k = 1; k <= bw && !arm; k++) { const xx = x - fX * k; if (xx < 0 || xx >= W) break; arm = kind[y * W + xx] === 3 || kind[y * W + xx] === 4; }
      if (!arm) continue;
      const q = lab(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
      if (isc[i] && y >= ca && y < cb && y > 0 && y < Hh - 1) { let k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) k += isc[i + dy * W + dx];
        if (k - 1 >= CLUMP) { nc++; if (rgba) rgba.set([255, 255, 0], i * 4); } }
      if (!arch || q[0] <= FLAT_L || y < 1 || y >= Hh - 1) continue;
      let same = true; for (let dy = -1; dy <= 1 && same; dy++) for (let dx = -1; dx <= 1 && same; dx++) { const j = i + dy * W + dx;
        same = kind[j] === 2 && col[j * 3] === col[i * 3] && col[j * 3 + 1] === col[i * 3 + 1] && col[j * 3 + 2] === col[i * 3 + 2]; }
      if (same) { nf++; if (rgba) rgba.set([0, 128, 255], i * 4); } }
    return { cape: nc / Z / Z, flat: nf / Z / Z };
  }
  // (TASKS 2191) the torso textures' near side under the arm: per row from the armpit (ARMPIT of the upper arm under the shoulder) to the
  // hip, the transparent px between the near arm where it lies in every moment of the rest (arch and world, both facings: the rightmost px
  // it covers, upper arm or forearm) and the torso's first px. The sheets draw the torso's side there; cut out, it left the cape or the quiver
  // in the wedge at the elbow whenever the arm turned out
  const ARMPIT = 0.25, HOLE = 150;
  function torsoHoles(drawHero, L) {
    const out = [];
    for (const cls of Object.keys(KITS)) for (const kit of KITS[cls].filter((k) => !k.offhand)) {
      const reach = {}, rigN = D.CLASSES[cls].look.rig, RG = RIGS()[rigN];
      for (const p of poses(cls, false).map((p) => Object.assign({}, p, { kit }))) {
        const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R;
        for (const [k, b] of Object.entries(kit)) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot: k } : undefined;
        const spr = []; L.joint = () => {}; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
        drawHero(Object.assign({}, R.hero, p.h), 300, 300, p.GT, heroSt(S), p.o);
        const body = spr.find((q) => q.n.startsWith(rigN + '__body') && !q.n.includes('back')), arms = spr.filter((q) => ARM.test(q.n) && !q.n.includes('_sock') && q.n.startsWith(rigN));
        const t = png(body.n), [a, b, c, d, e, f] = body.o.m, r = reach[body.n] || (reach[body.n] = { t, x: new Int16Array(t.H).fill(9999) }), seen = new Int16Array(t.H).fill(-1);
        for (const q of arms) { const tq = png(q.n), [qa, qb, qc, qd, qe, qf] = q.o.m, qdet = qa * qd - qb * qc;
          for (let v = 0; v < t.H; v++) for (let u = 0; u < t.W; u++) {
            const lx = (u + 0.5) / t.W * body.o.w - body.o.pivot[0], ly = (v + 0.5) / t.H * body.o.h - body.o.pivot[1], X = a * lx + c * ly + e - qe, Y = b * lx + d * ly + f - qf;
            const uu = Math.floor(((qd * X - qc * Y) / qdet + q.o.pivot[0]) / q.o.w * tq.W), vv = Math.floor(((-qb * X + qa * Y) / qdet + q.o.pivot[1]) / q.o.h * tq.H);
            if (uu >= 0 && vv >= 0 && uu < tq.W && vv < tq.H && tq.P[(vv * tq.W + uu) * 4 + 3] >= 128) seen[v] = Math.max(seen[v], u); } }
        for (let v = 0; v < t.H; v++) r.x[v] = seen[v] < 0 ? -1 : r.x[v] < 0 ? -1 : Math.min(r.x[v], seen[v]); }
      for (const [n, { t, x }] of Object.entries(reach)) { const k = t.W / RG.w, v0 = Math.round((RG.shL[1] + ARMPIT * (RG.elbowL[1] - RG.shL[1])) * k), v1 = Math.round(RG.hipL[1] * k); let hole = 0;
        for (let v = v0; v < v1; v++) { if (x[v] < 0) continue; let e = 0; while (e < t.W && t.P[(v * t.W + e) * 4 + 3] < 128) e++; hole += Math.max(0, e - x[v] - 1); }
        if (hole / k / k > HOLE) out.push(`hero shoulder: ${n}: the torso's near side under the arm is cut out, ${(hole / k / k).toFixed(0)} rig px² the resting arm leaves open (at most ${HOLE})`); }
    }
    return out;
  }
  // (TASKS 2188, 2191) the near shoulder holds together in every pose: between pauldron, sleeve and torso no gap shows the cape or the floor
  // through (the author's frame 25: a wedge of 6–12 world px² at the elbow, and a dark seam painted into the torso beside the sleeve).
  // Every pose of poses() for every class seen from the front: the gap at most MAX world px² in the world (a corner where an arm folded to
  // the chest meets it) and ARCH in the arch, measured at the arch's own density (a texel, Z per world px: its ×3.2 shows a wedge of 0.3
  // world px² as 3 px²); at rest no more than DARK world px² of dark torso by the arm (a clean one-px outline is 1.3) and SOCK of the
  // 2188 copy showing, every class (TASKS 2194: the mage too). The back view's frames of a turn or a whirl are counted by
  // tools/measure/shoulders2188/sweep.cjs, not here
  // (TASKS 2201) and in every other pose the copy, upper arm and forearm, shows over at most SOCK_ACT world px² of the whole figure
  // (sampled WZ per px): in a dash, a charge, the whirl and the cry the forearm's copy hung from the trailing elbow under the arm flung
  // out, 100–130 px², and the upper arm's filled the open armpit, 35–40; the charge's first frames need ~20 of it to close a slot of 8
  // (TASKS 2203) CAPE, FLAT: world px² of the side strip in the cape's colour and flat (sideFill) at rest, every outfit and, with the
  // HELMS, the bodies drawn without a head, for the classes with a cape (SIDE_CLS; the mage's side under the bell sleeve is the robe's
  // own blue by 2194). FLAT: the warrior's hood (cloak outfit) has up to 1.0 of its own flat shade in the band
  const MAX = 2, ARCH = 0.3, ZA = 360 / 84, DARK = 1.5, SOCK = 1, SOCK_ACT = 25, WZ = 1, CAPE = 0.3, FLAT = 1.5, SIDE_CLS = ['warrior', 'archer'];
  const HELMS = { warrior: [{ weapon: 'sword', helm: 'knight_helm' }, { weapon: 'sword', armor: 'cloak', helm: 'leather_helm' }], archer: [{ weapon: 'shortbow', helm: 'leather_helm' }, { weapon: 'shortbow', armor: 'cloak', helm: 'leather_helm' }], mage: [] };
  const restPoses = (cls) => poses(cls).concat(...HELMS[cls].map((kit) => poses(cls, false).map((p) => Object.assign({}, p, { kit, tag: p.tag.replace(/^(\S+) \S+/, `$1 ${kit.weapon} ${kit.armor ? 'armor:' + kit.armor + ' ' : ''}helm:${kit.helm}`) }))));
  function heroShoulderCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), seen = new Set();
    const say = (p, s) => { const k = p.tag.replace(/[\d./+-]+/g, '') + s.replace(/[\d.]+/g, ''); if (!seen.has(k)) { seen.add(k); out.push(`hero shoulder: ${p.tag}: ${s}`); } };
    for (const cls of Object.keys(KITS)) for (const p of restPoses(cls)) { const arch = !!p.o.menu;
      const r = shoulderGap(drawHero, L, p, arch ? ZA : 4), lim = arch ? ARCH : MAX;
      if (r.back) continue;
      if (r.gap > lim) say(p, `a gap of ${r.gap.toFixed(2)} world px² at the near shoulder (at most ${lim})`);
      if (!/rest/.test(p.tag)) { if (r.sockAll > SOCK_ACT) say(p, `the copy of the near arm shows over ${r.sockAll.toFixed(1)} world px² of the figure (at most ${SOCK_ACT})`); continue; }
      if (r.dark > DARK) say(p, `${r.dark.toFixed(2)} world px² of dark torso beside the near sleeve (at most ${DARK})`);
      if (SIDE_CLS.includes(cls) && r.capeFill > CAPE) say(p, `${r.capeFill.toFixed(2)} world px² of the torso's side under the near arm in the cape's colour (at most ${CAPE})`);
      if (SIDE_CLS.includes(cls) && r.flat > FLAT) say(p, `${r.flat.toFixed(2)} world px² of flat fill on the torso's side under the near arm (at most ${FLAT})`);
      if (r.sock > SOCK) say(p, `the copy of the upper arm shows over ${r.sock.toFixed(2)} world px² (at most ${SOCK})`); }
    out.push(...torsoHoles(drawHero, L));
  }
  SIMX.shoulder = { poses, restPoses, shoulderGap, KITS };
  SIMX.checks.add('heroShoulderCheck', heroShoulderCheck);
})(typeof window !== 'undefined' ? window : globalThis);
