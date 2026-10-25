// live/monsters.js — monster rigs: cut-out parts from part sheets (partrig.py), posed from the sim's clocks (pure function of state).
// A biped (skeleton, goblin, demon) plants its feet on paths driven by distance, solves its knees by two-bone IK, lets the hip ride
// the legs, and swings its arms from pose curves keyed to the attack's own clock; the spider walks eight legs in two alternating sets.
(function () {
  const MON = (window.MONSTERS = {}), L = LIB, M = L.M, SS = L.SS, TAU = Math.PI * 2;
  const RIG = { skeleton: 'skeleton', goblin: 'goblin', brute: 'brute', boss: 'brute', cultist: 'cultist', spider: 'spider' };   // the ghost bends its one sprite (softbones)
  const SKULL_K = { skeleton: 1.3 };
  MON.rigOf = (type) => { const n = RIG[type]; return n && window.RIGS && RIGS[n] && window.ASSETS[n + '__body'] ? n : null; };
  const d2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]), ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const rotP = (p, c, a) => { const dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; };
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------------- the biped ----------------
  // o: { id, n, x, y, face, H, dist, vx, vy, lean, crouch, arm(side, base) → [r1, r2], item, shield, wSide, U, Ufar, fallR, lift }
  function biped(o) {
    const RG = RIGS[o.n], s = o.H / RG.h, face = o.face, gx = RG.gap, gy = RG.footL[1], fallR = o.fallR || 0, lean = o.lean || 0;
    const sp = Math.hypot(o.vx, o.vy), run = SS(4, 30, sp), dirx = sp > 1 ? o.vx / sp * face : 0, diry = sp > 1 ? o.vy / sp : 0;
    const legL = d2(RG.hipL, RG.kneeL) + d2(RG.kneeL, RG.ankleL), sl = 0.4 * legL * s, u0 = ((o.dist / (2 * sl)) % 1 + 1) % 1, ph = u0 * TAU;
    const fc = Math.cos(fallR), fs = Math.sin(fallR), root = [o.x, o.y];
    const R2S = (px, py, dy = 0) => { const x = face * (px - gx) * s, y = (py - gy) * s + dy; return [root[0] + x * fc - y * fs, root[1] + x * fs + y * fc]; };
    // legs: the stance foot slides back at body speed, the swing foot eases forward on a lift arc (phase from distance)
    const tg = {};
    for (const side of ['L', 'R']) {
      const A0 = RG['ankle' + side], u = (u0 + (side === 'L' ? 0 : 0.5)) % 1, A = sl / 2 / s * run;
      let off, lift = 0;
      if (u < 0.5) off = A * (1 - 4 * u); else { const w = (u - 0.5) * 2; off = -A + 2 * A * SS(0.12, 0.95, w); lift = Math.pow(Math.sin(Math.PI * w), 0.6) * RG.h * (o.lift || 0.038) * (0.75 + 0.25 * Math.abs(dirx)) * run; }
      // walking draws the feet in toward the centre line (a wide drawn stance would spread the stride); depth steps project shorter (a 3/4 leg can't stretch)
      const cx = (RG.ankleL[0] + RG.ankleR[0]) / 2, st = (o.stance || 0) * (side === 'L' ? -1 : 1) * (1 - 0.5 * run) + (cx - A0[0]) * (o.narrow ?? 0.45) * run;
      tg[side] = { off, tx: A0[0] + st + off * dirx, ty: A0[1] - lift, lift, dz: 0.6 * off * diry - 0.3 * A * Math.abs(diry) };
    }
    const cr = o.crumble ? o.crumble.t : -1, dbl = 0.5 + 0.5 * Math.cos(2 * ph), breath = (1 - run) * (cr >= 0 ? 1 - SS(0, 0.2, cr) : 1) * Math.sin(o.t * 2.1 + (o.seed || 0));
    // the hip rides the stance leg: one formula for both legs (≈ step² / 2L on the average leg), so legs drawn at different
    // lengths or angles in 3/4 can't make the gait limp; the rest crouch below leaves the reach for it
    const Lavg = (d2(RG.hipL, RG.kneeL) + d2(RG.kneeL, RG.ankleL) + d2(RG.hipR, RG.kneeR) + d2(RG.kneeR, RG.ankleR)) / 2;
    const drop = Math.max(...['L', 'R'].map((sd) => tg[sd].off * tg[sd].off / (2 * Lavg)));
    // drawn legs are nearly straight, where IK is unstable: settle the hip until both rest legs bend to 95 % of their length
    let crouch0 = 0; for (const side of ['L', 'R']) { const H0 = RG['hip' + side], A0 = RG['ankle' + side], Lm = 0.95 * (d2(H0, RG['knee' + side]) + d2(RG['knee' + side], A0)), dx0 = A0[0] - H0[0];
      crouch0 = Math.max(crouch0, A0[1] - H0[1] - Math.sqrt(Math.max(0, Lm * Lm - dx0 * dx0))); }
    // the breath at least 0.75 % of the height: a fixed 0.8 view px was lost on the boss
    const hipDy = Math.max((run * 2.2 * dbl) / s + (breath + 1) * Math.max(0.8 / s, 0.0075 * RG.h), drop) + crouch0 + (o.crouch || 0);
    const legs = {};
    for (const side of ['L', 'R']) {
      const H0 = RG['hip' + side], K0 = RG['knee' + side], A0 = RG['ankle' + side], { tx, ty } = tg[side], Hp = [H0[0], H0[1] + hipDy];
      const l1 = d2(H0, K0), l2 = d2(K0, A0), dx = tx - Hp[0], dy = ty - Hp[1], d = Math.hypot(dx, dy), dm = Math.min(d, (l1 + l2) * 0.985);
      const ka = Math.atan2(dy, dx) - Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm))));
      const K1 = [Hp[0] + Math.cos(ka) * l1, Hp[1] + Math.sin(ka) * l1], aT = Math.atan2(ty - K1[1], tx - K1[0]), T1 = [K1[0] + Math.cos(aT) * l2, K1[1] + Math.sin(aT) * l2];
      const f = (T1[1] - Hp[1] + tg[side].dz) / (T1[1] - Hp[1]), Y = (p) => [p[0], Hp[1] + (p[1] - Hp[1]) * f], K = Y(K1), T = Y(T1);
      legs[side] = { H0, K0, A0, Hp, K, T, r1: ang(K, Hp) - ang(K0, H0), r2: ang(T, K) - ang(A0, K0), k1: d2(Hp, K) / l1, k2: d2(K, T) / l2, lift: tg[side].lift };
    }
    // the upper body leans about the hip; arms ride it
    const Hc = [(RG.hipL[0] + RG.hipR[0]) / 2, RG.hipL[1]], hipS = R2S(Hc[0], Hc[1], hipDy * s), bc = Math.cos(lean), bs = Math.sin(lean);
    const R2U = (px, py, dy = 0) => { const p = R2S(px, py, dy), x = p[0] - hipS[0], y = p[1] - hipS[1]; return [hipS[0] + x * bc - y * bs, hipS[1] + x * bs + y * bc]; };
    const legSwing = Math.cos(ph) * 0.4 * run, arms = {};
    // arms swing against the same-side leg along the travel: the sign comes from where the drawn hand sits relative to its shoulder
    const vxn = sp > 1 ? o.vx / sp : 1, vyn = sp > 1 ? o.vy / sp : 0;
    for (const side of ['L', 'R']) { const S0 = RG['sh' + side], Hd0 = RG['hand' + side], Jt = (Hd0[0] - S0[0]) * vyn - face * (Hd0[1] - S0[1]) * vxn, sg = Jt > 0 ? 1 : -1;
      const rs = (o.rest && o.rest[side]) || [0, 0.18], base = rs[0] + sg * (side === 'L' ? -1 : 1) * legSwing * 0.8 + breath * 0.04 * (side === 'L' ? 1 : -1);
      const r = o.arm ? o.arm(side, base) : [base, base + rs[1] - rs[0] + (base - rs[0]) * -0.4];
      const E0 = RG['elbow' + side], Sp = [S0[0], S0[1] + hipDy];
      const E = rotP([E0[0], E0[1] + hipDy], Sp, r[0]), Hd = rotP(rotP([Hd0[0], Hd0[1] + hipDy], Sp, r[0]), E, r[1] - r[0]);
      arms[side] = { S0, E0, Sp, E, Hd, r1: r[0], r2: r[1] }; }
    // a crumbling body lets every piece go (o.crumble: { t: seconds since death, kind, dir: the killing blow's screen angle }):
    //   pile   — each piece drops on its own under gravity from where it was, slowed just before the floor, bounces once and lies
    //            scattered; the skull lands and rolls away
    //   burst  — the pieces fly off away from the blow on arcs, land softly and skid to a stop, spinning
    //   topple — the scene's fall (fallR) first; on landing the pieces come apart where they lie and the skull rolls on
    // Identity at its start: no pop on death
    const CR = {}, hsh = (key, k) => { let h = Math.imul((o.seed || 0) + 7919 * k, 2654435761); for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 2246822519); return ((h >>> 0) % 10007) / 10007; };
    const CK = o.crumble || null, TOP = 0.32;
    const crOf = (key, at, c = at) => { if (cr < 0) return null; if (CR[key]) return CR[key];   // c: the point it spins about
      const H = o.H, g = 8 * H, kind = CK.kind || 'pile', skull = key === 'skull', ribs = key === 'body';
      if (kind === 'burst') {
        const tt = cr, h0 = root[1] - at[1], hR = 0.03 * H, k = 0.025 * H, wt = ribs ? 0.45 : skull ? 1.3 : 1;
        const a = (CK.dir ?? (face > 0 ? Math.PI : 0)) + (hsh(key, 0) - 0.5) * 1.4, sp = H * (0.4 + 0.5 * hsh(key, 1)) * wt, vup = H * (1 + hsh(key, 2)) * (ribs ? 0.5 : 1);   // they land within about a tile: the render can't see walls to stop them
        const tl = (vup + Math.sqrt(vup * vup + 2 * g * Math.max(0, h0 - hR))) / g, tau = tt < tl ? tt : tl + 0.12 * (1 - Math.exp(-(tt - tl) / 0.12));
        const upRaw = h0 + vup * tt - 0.5 * g * tt * tt, up = hR + k * Math.log1p(Math.exp((upRaw - hR) / k)) - k * Math.log1p(Math.exp(-(h0 - hR) / k)) * Math.exp(-tt / 0.1);
        const dx = Math.cos(a) * sp * tau, dy = Math.sin(a) * sp * tau * 0.6 + h0 - up, spin = (hsh(key, 3) - 0.5) * (skull ? 14 : 16) * tau;
        return (CR[key] = M.of(M.t(c[0] + dx, c[1] + dy), M.r(spin), M.t(-c[0], -c[1]))); }
      const top = kind === 'topple', sc = top ? 0.5 : 1, tt = Math.max(0, cr - (top ? TOP : 0) - 0.06 * hsh(key, 0));
      const restY = root[1] - 0.03 * H + (hsh(key, 1) - 0.5) * 0.14 * H * sc, dyM = Math.max(0, restY - at[1]);
      const tl = 1.15 * Math.sqrt(2 * Math.max(1, dyM) / g), q = Math.min(1, tt / tl), v = tt - tl;
      const hop = v > 0 && v < 0.16 ? 0.05 * H * (0.5 + hsh(key, 2)) * Math.max(top ? 0.4 : 0, Math.min(1, dyM / (0.4 * H))) * Math.sin(Math.PI * v / 0.16) : 0;
      const rollD = skull ? (top ? (Math.cos(CK.dir ?? (face > 0 ? Math.PI : 0)) >= 0 ? 1 : -1) : hsh(key, 5) < 0.5 ? -1 : 1) * (0.35 + 0.25 * hsh(key, 6)) * H : 0, roll = v > 0 ? rollD * (1 - Math.exp(-v / 0.28)) * SS(0, 0.12, v) : 0;
      const dx = (hsh(key, 3) - 0.5) * 0.6 * H * sc * SS(0, tl + 0.1, tt) + roll, dy = dyM * (2.6 * q * q - 1.6 * q * q * q) - hop;   // gravity, slowed just before the floor
      const spin = (ribs ? (hsh(key, 4) - 0.5) * (top ? 0.5 : 1) : (hsh(key, 4) - 0.5) * 3 * sc) * SS(0, tl + 0.12, tt) + roll / (0.1 * H);
      return (CR[key] = M.of(M.t(c[0] + dx, c[1] + dy), M.r(spin), M.t(-c[0], -c[1]))); };
    const piece = (key, at, f, c) => { const m = crOf(key, at, c), pre = L.pre; if (m) L.pre = pre ? M.mul(pre, m) : m; try { f(); } finally { L.pre = pre; } };
    const part = (nm, pv, at, rot, u, k = 1, up = 0) => piece(nm, at, () => L.sprite(o.n + '__' + nm, 0, 0, { m: M.of(M.t(at[0], at[1]), M.r(fallR + up), M.s(face, 1), M.r(rot), M.s(1, k)), w: RG.w * s, h: RG.h * s, pivot: [pv[0] * s, pv[1] * s], u }));
    const drawLeg = (side, u) => { const g = legs[side];
      part('thigh' + side, g.H0, R2S(g.Hp[0], g.Hp[1]), g.r1, u, g.k1); part('shin' + side, g.K0, R2S(g.K[0], g.K[1]), g.r2, u, g.k2); part('foot' + side, g.A0, R2S(g.T[0], g.T[1]), -g.lift * 0.02, u); };
    const drawArm = (side, u) => { const A = arms[side]; part('uarm' + side, A.S0, R2U(A.Sp[0], A.Sp[1]), A.r1, u, 1, lean); part('farm' + side, A.E0, R2U(A.E[0], A.E[1]), A.r2, u, 1, lean); };
    const J = (nm, p, key) => { const m = key && CR[key]; L.joint(o.id, nm, m ? [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]] : p); };
    const held = (side, u) => { const A = arms[side], Hd = R2U(A.Hd[0], A.Hd[1]); piece('item' + side, Hd, () => {
      if (side === (o.wSide || 'R') && window.ASSETS[o.n + '_weapon']) {
        const ba0 = A.r2 + Math.PI / 2 - 0.8, ba = o.item.ang !== undefined ? ba0 + (((o.item.ang - ba0 + Math.PI) % TAU + TAU) % TAU - Math.PI) * (o.item.angK ?? 1) : ba0, sa = (face > 0 ? ba : Math.PI - ba) + fallR + lean;
        const tex = o.n + '_weapon', th = RG.weaponLen * s, tw = th * G.tex(tex).w / G.tex(tex).h, gr = RG.weaponGrip;
        L.sprite(tex, 0, 0, { m: M.of(M.t(Hd[0], Hd[1]), M.r(sa - Math.PI / 2)), w: tw, h: th, pivot: [tw / 2, th * gr], u });
        J('grip', Hd, 'item' + side); J('tip', [Hd[0] + Math.cos(sa) * th * (1 - gr), Hd[1] + Math.sin(sa) * th * (1 - gr)], 'item' + side); }
      if (o.shield && side !== (o.wSide || 'R') && window.ASSETS[o.n + '_shield']) {
        const [w0, h0] = [G.tex(o.n + '_shield').w, G.tex(o.n + '_shield').h], sw = RG.shieldW * s, sh = sw * h0 / w0;
        L.sprite(o.n + '_shield', 0, 0, { m: M.of(M.t(Hd[0] + face * 4 * s, Hd[1] - 6 * s), M.r(fallR + lean * 0.5), M.s(face * 0.8, 1)), w: sw, h: sh, pivot: [sw / 2, sh / 2], u }); } }); };
    // far arm (+ its item) → far leg → near leg → body → near arm (+ its item)
    drawArm('L', o.Ufar); held('L', o.Ufar); drawLeg('L', o.Ufar); drawLeg('R', o.U);
    piece('body', hipS, () => L.sprite(o.n + '__body', 0, 0, { m: M.of(M.t(...hipS), M.r(fallR + lean), M.s(face, 1)), w: RG.w * s, h: RG.h * s, pivot: [Hc[0] * s, Hc[1] * s], u: o.U }));
    // the skull is drawn larger about the neck: at 38 px a skull of the painted size reads as a bead (TASKS 127)
    const skK = RG.skull ? SKULL_K[o.n] || 1 : 1, skP = (P) => RG.skull ? [RG.skull[0] + (P[0] - RG.skull[0]) * skK, RG.skull[1] + (P[1] - RG.skull[1]) * skK] : P;
    if (RG.skull) { const at = R2U(RG.skull[0], RG.skull[1] + hipDy);   // a loose skull turns about its own middle, not the neck
      piece('skull', at, () => L.sprite(o.n + '__skull', 0, 0, { m: M.of(M.t(at[0], at[1]), M.r(fallR + lean), M.s(face * skK, skK)), w: RG.w * s, h: RG.h * s, pivot: [RG.skull[0] * s, RG.skull[1] * s], u: o.U }), R2U(RG.skull[0], RG.skull[1] + (RG.top[1] - RG.skull[1]) * skK / 2 + hipDy)); }
    // ears hang on a spring from their roots: they lag the head's bob twice a stride, plus whatever the caller kicks (o.ear, tips down)
    if (RG.earL) { const flop = 0.11 * run * Math.sin(2 * ph - 1.1) + 0.03 * breath + (o.ear || 0);
      for (const [sd, sg] of [['L', -1], ['R', 1]]) { const P = RG['ear' + sd], r = sg * flop * (sd === 'L' ? 1 : 0.85), Pd = [P[0], P[1] + hipDy];
        part('ear' + sd, P, R2U(...Pd), r, o.U, 1, lean); L.joint(o.id, 'ear' + sd, R2U(...rotP([RG['ear' + sd + 'Tip'][0], RG['ear' + sd + 'Tip'][1] + hipDy], Pd, r))); } }
    drawArm('R', o.U); held('R', o.U);
    // the far foot stands higher in 3/4: each foot has its own ground
    J('ground', root); J('head', R2U(...skP(RG.head), hipDy * s), RG.skull ? 'skull' : 'body'); J('top', R2U(...skP(RG.top), hipDy * s), RG.skull ? 'skull' : 'body'); J('hip', hipS, 'body');
    if (cr >= 0) J('mid', R2U(Hc[0], (Hc[1] + RG.top[1]) / 2, hipDy * s), 'body');
    for (const side of ['L', 'R']) { const g = legs[side], A = arms[side], dT = [g.T[0] - g.A0[0], g.T[1] - g.A0[1]];
      J('hip' + side, R2S(g.Hp[0], g.Hp[1]), 'thigh' + side); J('knee' + side, R2S(g.K[0], g.K[1]), 'shin' + side); J('ankle' + side, R2S(g.T[0], g.T[1]), 'foot' + side);
      J('heel' + side, R2S(RG['heel' + side][0] + dT[0], RG['heel' + side][1] + dT[1]), 'foot' + side); J('toe' + side, R2S(RG['toe' + side][0] + dT[0], RG['toe' + side][1] + dT[1]), 'foot' + side);
      J('ground' + side, R2S(gx, RG['foot' + side][1] + tg[side].dz)); J('sh' + side, R2U(A.Sp[0], A.Sp[1]), 'uarm' + side); J('elbow' + side, R2U(A.E[0], A.E[1]), 'farm' + side); J('hand' + side, R2U(A.Hd[0], A.Hd[1]), 'farm' + side); }
    return { R2U, arms, s };
  }
  MON.biped = biped;
  // one stride (two steps) in view px for a rig drawn H tall: what the sim's distance must cover per gait cycle
  MON.stride = (type, H) => { const RG = RIGS[RIG[type]], s = H / RG.h; return type === 'spider' ? 0.64 * H : RG.hipL ? 2 * 0.4 * (d2(RG.hipL, RG.kneeL) + d2(RG.kneeL, RG.ankleL)) * s : 0.28 * RG.h * s; };

  // ---------------- the robed caster: no legs to plant, the robe sways from the hem ----------------
  // o: biped's fields + staff (rig rad, the far arm), push (0..1, the free hand toward aimR), aimR (rig angle of the aim)
  function robed(o) {
    const RG = RIGS[o.n], s = o.H / RG.h, face = o.face, gx = RG.gap, gy = RG.foot, fallR = o.fallR || 0, root = [o.x, o.y];
    const sp = Math.hypot(o.vx, o.vy), run = SS(4, 30, sp), ph = o.dist / (0.28 * RG.h * s) * TAU;
    const breath = (1 - run) * Math.sin(o.t * 1.7 + (o.seed || 0)), sway = run * 0.045 * Math.sin(ph) + 0.015 * breath, bob = run * 1.6 * Math.abs(Math.sin(ph)) + 1.4 * breath;
    const lean = (o.lean || 0) + sway, rot = fallR + lean, rc = Math.cos(rot), rs = Math.sin(rot), ky = 1 - (o.sink || 0);
    // the robe pivots at the hem's centre: everything above leans with it
    const R2U = (px, py) => { const x = face * (px - gx) * s, y = ((py - gy) * s - bob) * ky; return [root[0] + x * rc - y * rs, root[1] + x * rs + y * rc]; };
    const part = (nm, pv, at, r, u) => L.sprite(o.n + '__' + nm, 0, 0, { m: M.of(M.t(at[0], at[1]), M.r(rot), M.s(face, ky), M.r(r)), w: RG.w * s, h: RG.h * s, pivot: [pv[0] * s, pv[1] * s], u });
    const swing = run * 0.12 * Math.sin(ph + 1), staffR = (o.staff || 0) + swing * 0.5 + 0.04 * breath;
    const push = o.push || 0, r1 = -swing - 0.06 * breath + lerp(0, (o.aimR ?? 0) - 0.4, push), r2 = r1 - 0.05 * breath + lerp(0, -0.1, push);
    const E = rotP(RG.elbowR, RG.shR, r1), Hd = rotP(rotP(RG.handR, RG.shR, r1), E, r2 - r1), HdL = rotP(RG.handL, RG.shL, staffR);
    part('farmL', RG.shL, R2U(...RG.shL), staffR, o.Ufar);
    L.sprite(o.n + '__body', 0, 0, { m: M.of(M.t(...R2U(gx, gy)), M.r(rot), M.s(face, ky)), w: RG.w * s, h: RG.h * s, pivot: [gx * s, gy * s], u: o.U });
    part('uarmR', RG.shR, R2U(...RG.shR), r1, o.U); part('farmR', RG.elbowR, R2U(...E), r2, o.U);
    const J = (nm, p) => L.joint(o.id, nm, p);
    J('ground', root); J('top', R2U(...RG.top)); J('head', R2U(RG.top[0], RG.top[1] + 0.12 * RG.h)); J('hip', R2U(gx, gy - 0.45 * RG.h));
    J('shL', R2U(...RG.shL)); J('handL', R2U(...HdL)); J('shR', R2U(...RG.shR)); J('elbowR', R2U(...E)); J('handR', R2U(...Hd));
    return { handR: R2U(...Hd) };
  }

  // ---------------- the spider: eight legs in two alternating sets, knees arched up, seen from the front ----------------
  // the drawing faces the camera, so it never mirrors; sockets 0–3 are the left side from the rear (top) to the front (bottom)
  const SP_FOOT = [[-330, -150], [-385, 15], [-365, 175], [-255, 300]];          // rest feet from their sockets (sheet px, left side)
  const SP_SET = [0, 1, 0, 1, 1, 0, 1, 0];                                      // L0 L2 R1 R3 | L1 L3 R0 R2
  function spider(o) {
    const RG = RIGS.spider, s = 0.8 * o.H / RG.h, root = [o.x, o.y], A = RG.legA, B = RG.legB;
    const l1 = d2(A.root, A.end) * s, l2 = d2(B.root, B.end) * s, angA = ang(A.root, A.end), angB = ang(B.root, B.end);
    const sp = Math.hypot(o.vx, o.vy), run = SS(4, 30, sp), dv = sp > 1 ? [o.vx / sp, o.vy / sp] : [1, 0], sl = 0.32 * o.H, u0 = ((o.dist / (2 * sl)) % 1 + 1) % 1;
    const rear = o.rear || 0, curl = o.curl || 0, breath = (1 - run) * Math.sin(o.t * 2.4 + (o.seed || 0));
    // a blow (o.crouch, up to 6) drops the body onto spread legs
    const fl = (o.crouch || 0) / 6, lift = (0.07 + 0.16 * rear) * o.H * (1 - curl) + run * 0.6 * Math.abs(Math.sin(u0 * TAU * 2)) + 1.3 * breath - 0.06 * o.H * fl;
    // dying, it flips onto its back (o.flip 0..1): the body turns about its middle with a hop, the underside darker, the legs fold up
    // out to the sides with their knees up, hooked like a dead beetle's, and twitch out (o.dead: seconds since death); on its back it shows a shallow belly
    const flip = o.flip || 0, fk = Math.cos(Math.PI * flip) * (1 - 0.4 * flip), hop = Math.sin(Math.PI * flip) * 0.3 * o.H;
    const S2f = (px, py, up) => [root[0] + (px - RG.w / 2) * s, root[1] + (py - RG.h) * s - up], Cy = S2f(RG.w / 2, RG.h / 2, lift)[1] - hop;
    const S2 = (px, py, up) => { const p = S2f(px, py, up); return [p[0], Cy + (p[1] - hop - Cy) * fk]; };   // body image px → screen
    const legs = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1, j = i % 4, so = RG.sockets[i], Sk = S2(so[0], so[1], lift), S0 = S2(so[0], so[1], 0.07 * o.H);
      const u = (u0 + (SP_SET[i] ? 0.5 : 0)) % 1, Aa = sl / 2 * run; let off, up = 0;
      if (u < 0.5) off = Aa * (1 - 4 * u); else { const w = (u - 0.5) * 2; off = -Aa + 2 * Aa * SS(0.1, 0.9, w); up = Math.sin(Math.PI * w) * 0.1 * o.H * run; }
      let F = [S0[0] + side * (Math.abs(SP_FOOT[j][0]) * s + 4 * fl) + dv[0] * off, S0[1] + SP_FOOT[j][1] * s + dv[1] * off * 0.6 - up];
      if (j >= 2 && rear > 0) { const k = rear * (j === 3 ? 1 : 0.45); F = [lerp(F[0], Sk[0] + side * 0.45 * (l1 + l2) * 0.5 + (o.aimX || 0) * 0.3 * o.H, k), lerp(F[1], Sk[1] - 0.35 * o.H, k)]; }
      if (curl > 0) F = [lerp(F[0], Sk[0] + side * 0.25 * l1, curl), lerp(F[1], Sk[1] + 0.15 * l1 * fk, curl)];   // folded under the body, turning over with it
      if (flip > 0) { const dd = o.dead || 0, tw = SS(0.4, 0.6, dd) * Math.exp(-Math.max(0, dd - 0.6) / 0.7) * Math.sin(dd * 23 + i * 1.9) * 0.08 * (l1 + l2);
        F = [lerp(F[0], Sk[0] + side * (0.3 + 0.04 * j) * (l1 + l2), flip), lerp(F[1], Sk[1] + (0.12 - 0.05 * j) * (l1 + l2) + tw, flip)]; }
      // two-bone IK, the knee bent the same way for each side (up while the feet stand out to the side), so it never flips sides mid-move
      const dx = F[0] - Sk[0], dy = F[1] - Sk[1], d = Math.min(Math.hypot(dx, dy), (l1 + l2) * 0.98), base = Math.atan2(dy, dx);
      const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
      const ka = base - a * side;
      const K = [Sk[0] + Math.cos(ka) * l1, Sk[1] + Math.sin(ka) * l1], T = [K[0] + Math.cos(Math.atan2(F[1] - K[1], F[0] - K[0])) * l2, K[1] + Math.sin(Math.atan2(F[1] - K[1], F[0] - K[0])) * l2];
      legs.push({ side, j, Sk, K, T });
    }
    // a segment drawn root → end, mirrored for the left side (the drawing points right)
    const seg = (tex, P, r0, a0, from, to, side, u) => { const want = Math.atan2(to[1] - from[1], to[0] - from[0]);
      L.sprite(tex, 0, 0, { m: M.of(M.t(from[0], from[1]), M.r(side < 0 ? want - Math.PI + a0 : want - a0), M.s(side < 0 ? -1 : 1, 1)), w: P.w * s, h: P.h * s, pivot: [r0[0] * s, r0[1] * s], u }); };
    const drawLegs = () => { for (const g of [...legs].sort((p, q) => p.Sk[1] - q.Sk[1])) { const u = g.j < 2 ? o.Ufar : o.U;
      seg('spider__legA', A, A.root, angA, g.Sk, g.K, g.side, u); seg('spider__legB', B, B.root, angB, g.K, g.T, g.side, u); } };
    drawLegs();
    const Ub = flip > 0 && o.U.grade ? Object.assign({}, o.U, { grade: [o.U.grade[0] * (1 - 0.35 * SS(0.5, 1, flip)), ...o.U.grade.slice(1)] }) : o.U;
    L.sprite('spider__body', 0, 0, { m: M.of(M.t(...S2(RG.w / 2, RG.h, lift)), M.r(o.lean || 0), M.s(1, fk)), w: RG.w * s, h: RG.h * s, pivot: [RG.w / 2 * s, RG.h * s], u: Ub });
    // the trace turns with the body (o.lean about its foot), or a lean the eye sees never reaches the checks
    const Pb = S2(RG.w / 2, RG.h, lift), BT = (q) => rotP(q, Pb, o.lean || 0);
    const J = (nm, p) => L.joint(o.id, nm, p); J('ground', root); J('top', BT(S2(RG.w / 2, 0, lift))); J('head', BT(S2(RG.w / 2, RG.h * 0.75, lift)));
    legs.forEach((g, i) => J('foot' + i, g.T));
  }

  // ---------------- the merchant: behind his counter, facing the camera; the counter hides his legs ----------------
  // o: { id, x, y, H, t, look (−1..1, where the hero stands), near (0..1), greetT, tradeT, U }
  // L is the screen-left arm (it works the scales on the counter's left), R strokes the beard and waves
  MON.merchant = (o) => {
    const RG = RIGS.merchant; if (!RG || !window.ASSETS.merchant__body) return false;
    const s = o.H / RG.h, t = o.t, gx = RG.gap, gy = RG.foot, root = [o.x, o.y];
    const S2 = (px, py) => [root[0] + (px - gx) * s, root[1] + (py - gy) * s];
    const bump = (u, a, b) => (u <= a || u >= b ? 0 : Math.pow(Math.sin(Math.PI * (u - a) / (b - a)), 2));
    const greet = o.greetT !== undefined ? t - o.greetT : 9, trade = o.tradeT !== undefined ? t - o.tradeT : 9;
    const hit = t - (o.hitT ?? -9), recoil = hit >= 0 && hit < 0.65 ? Math.sin(Math.PI * SS(0, 0.65, hit)) * Math.exp(-3 * hit) : 0;
    const wave = greet >= 0 && greet < 1.5 ? SS(0, 0.25, greet) * (1 - SS(1.2, 1.5, greet)) : 0, nod = trade >= 0 && trade < 0.7 ? bump(trade, 0, 0.7) : 0;
    // a 6 s work loop, eased off while the hero stands close: a coin onto the scales, a look, a stroke of the beard
    const work = 1 - 0.7 * (o.near || 0), u = (t + (o.seed || 0)) % 6;
    const coin = bump(u, 0.2, 1.8) * work, peek = bump(u, 0.6, 1.6) * work, beard = bump(u, 2.6, 5.0) * work * (1 - wave), rub = beard * Math.sin(t * 9) * 0.12;
    const breath = Math.sin(t * 1.8 + (o.seed || 0)), lift = breath * 4 - 10 * nod - 18 * recoil;
    const rL = [-0.18 * coin - 0.1 * nod + 0.65 * recoil, -0.18 * coin - 0.75 * coin - 0.1 * nod + 0.02 * breath - 1.3 * recoil];
    const rR = [lerp(0.32 * beard + 0.12 * nod, -1.9, wave) - 0.65 * recoil, lerp(0.32 * beard + 2.45 * beard + rub + 0.12 * nod, -2.6 + 0.4 * Math.sin(greet * 13), wave) - 1.4 * recoil];
    const arm = (side, r) => { const S0 = RG['sh' + side], E0 = RG['elbow' + side], Hd0 = RG['hand' + side], Sp = [S0[0], S0[1] + lift];
      const E = rotP([E0[0], E0[1] + lift], Sp, r[0]), Hd = rotP(rotP([Hd0[0], Hd0[1] + lift], Sp, r[0]), E, r[1] - r[0]); return { S0, E0, Sp, E, Hd, r }; };
    const A = { L: arm('L', rL), R: arm('R', rR) };
    const part = (nm, pv, at, rot) => L.sprite('merchant__' + nm, 0, 0, { m: M.of(M.t(...S2(...at)), M.r(rot)), w: RG.w * s, h: RG.h * s, pivot: [pv[0] * s, pv[1] * s], u: o.U });
    L.sprite('merchant__body', 0, 0, { m: M.of(M.t(...root)), w: RG.w * s, h: RG.h * s, pivot: [gx * s, gy * s], u: o.U });
    const look = (o.look || 0) * (o.near || 0), hr = 0.09 * look - 0.07 * peek - 0.18 * recoil, hx = 5 * look - 4 * peek, hy = lift + 8 * peek + 6 * nod - 14 * recoil;
    part('head', RG.neck, [RG.neck[0] + hx, RG.neck[1] + hy], hr);
    for (const sd of ['L', 'R']) { const a = A[sd]; part('uarm' + sd, a.S0, a.Sp, a.r[0]); part('farm' + sd, a.E0, a.E, a.r[1]); }
    const J = (nm, p) => L.joint(o.id, nm, S2(...p));
    L.joint(o.id, 'ground', root); J('top', [RG.top[0] + hx, RG.top[1] + hy]); J('head', [RG.neck[0] + hx, RG.neck[1] + hy]);
    for (const sd of ['L', 'R']) { const a = A[sd]; J('sh' + sd, a.Sp); J('elbow' + sd, a.E); J('hand' + sd, a.Hd); }
    return true;
  };

  // ---------------- attacks: arm curves keyed to the attack clock ----------------
  // rig angles: 0 hangs straight down, positive turns clockwise when facing right (back, then up over the head, then forward)
  const aimRig = (e, face, H) => { const a = Number.isFinite(e.tx) ? Math.atan2(e.ty - 34 - e.y + 0.75 * H, e.tx - e.x) : e.aimA; return face > 0 ? a : Math.PI - a; };   // casters keep only aimA
  const above = (a, lo) => lo + ((a - lo) % TAU + TAU) % TAU;                   // a, turned whole turns to lie in (lo, lo + 2π]
  // an overhead chop: raise the arm (o.raise) over the wind-up and wait there (o.top s), accelerate over the top so the blade crosses
  // the aim on the damage frame (the strike's first frame), follow through, then keep turning the same way down to the hanging rest:
  // no swing back. A raise in front of the body (negative) keeps the whole path under a turn and a half: one raised behind it drove
  // the arm a full turn round the shoulder, a windmill
  function chop(e, E, GT, face, H, base, o) {
    // the impact is taken within half a turn of the raise, and the raise goes on past it far enough to swing: wrapped a turn ahead of
    // a raise that stopped just short of it, the blow wound the arm round the shoulder
    // o.bendHit: the elbow's bend on the blow; a blade drawn cocked over the shoulder reaches the aim on a whipped forearm, not an arm thrown up
    const ew = E.wind * DATA.eliteK(e, 'wind'), u = GT - e.t0, T = o.chopT, P = 1.3, bh = o.bendHit ?? 0.15, i0 = aimRig(e, face, H) - (o.blade ?? Math.PI / 2 - 0.8) - bh;   // blade = its angle in the drawing
    const imp = o.raise + (((i0 - o.raise + Math.PI) % TAU + TAU) % TAU - Math.PI), RAISE = Math.min(o.raise, imp - 0.6), vEnd = P * (imp - RAISE) / T;
    if (e.st === 'wind' || e.st === 'bwind') { const w = e.st === 'bwind' ? o.bossW : ew, tc = w - T;
      if (u < tc) { const k = SS(0, Math.max(0.05, tc - (o.top || 0)), u); return { r1: lerp(base, RAISE, k), bend: lerp(o.bend0 ?? 0.18, o.bendUp ?? 0.9, k), k }; }
      // from rest at the top to vEnd at the impact: a cubic with no jerk at its start
      if (u < w) { const x = (u - tc) / T, q = (3 - P) * x * x + (P - 2) * x * x * x; return { r1: lerp(RAISE, imp, q), bend: lerp(o.bendUp ?? 0.9, bh, q), k: 1 }; }
      return after(imp, u - w, base, o, vEnd); }
    if (e.st === 'strike') return after(imp, u, base, o, vEnd);
    return null;
  }
  // the follow-through leaves the impact at the chop's own speed and bleeds it off over `over` rad: no one-frame stop;
  // a heavy blow rests on the floor for o.hold s before the arms come back. The arm comes home on along the blow: back over the
  // top it reads as a second swing
  function after(imp, v, base, o, vEnd) { const over = o.over || 2.2, fol = imp + over * (1 - Math.exp(-v * vEnd / over)), rest = above(base, imp + over - 1.2), k = SS(0.12 + (o.hold || 0), o.recover, v);
    return { r1: lerp(fol, rest, k), bend: lerp(o.bendHit ?? 0.15, o.bend0 ?? 0.18, k), k: 1 - k }; }
  // a stab: the arm cocks back with the elbow folded, then thrusts straight along the aim, the blade in line with the forearm; the
  // thrust starts with no jerk and meets the aim at speed, then runs on a little and bleeds off: eased to a stop on the aim it popped
  function stab(e, E, GT, face, H, base, bend0, BACK = 1.3) {
    const ew = E.wind * DATA.eliteK(e, 'wind'), u = GT - e.t0, aim = aimRig(e, face, H), imp = aim - Math.PI / 2, T = 0.15, P = 1.0, OVER = 0.5;
    const impN = BACK - (((BACK - imp) % TAU) + TAU) % TAU, vEnd = P * (BACK - impN) / T;
    if (e.st === 'wind') { const tc = ew - T;
      if (u < tc) { const k = SS(0, tc, u); return { r1: lerp(base, BACK, k), bend: lerp(bend0, 1.6, k), k, crouch: k, ang: null }; }
      const x = Math.min(1, (u - tc) / T), q = (3 - P) * x * x + (P - 2) * x * x * x; return { r1: lerp(BACK, impN, q), bend: lerp(1.6, 0.05, q), k: 1, crouch: 1 - q, ang: aim, angK: q }; }
    if (e.st === 'strike') { const fol = impN - OVER * (1 - Math.exp(-u * vEnd / OVER)), k = SS(0.08, 0.3, u); return { r1: lerp(fol, base, k), bend: lerp(0.05, bend0, k), k: 1 - k, crouch: 0, ang: aim, angK: 1 - k }; }
    return null;
  }

  // a spring's answer to a kick at time t0: the render can't integrate, so each event the sim timestamps adds its impulse response
  const ring = (t, t0, A, hz = 4.2, tau = 0.22) => { const u = t - t0; return u >= 0 && u < 6 * tau ? A * SS(0, 0.06, u) * Math.exp(-u / tau) * Math.sin(TAU * hz * u) : 0; };   // eased in: a kick, not a teleport
  // the goblin's ears (tips down > 0): pinned up while it coils, flung on the spring, a flinch on a hit and a turn,
  // a twitch now and then at rest, and they droop once it dies
  function earKick(e, GT, p0, live) {
    if (!live) return 0.45 * SS(0, 0.3, GT - e.deadT) + ring(GT, e.deadT + 0.3, 0.3, 3) + ring(GT, e.hitT, 0.42);
    const tw = 3.1 + 1.3 * ((e.id * 0.618) % 1), tu = GT % tw;
    return (e.st === 'wind' && p0 ? -0.22 * p0.k : 0) + (e.st === 'strike' ? -0.22 * (1 - SS(0, 0.08, GT - e.t0)) + ring(GT, e.t0, 0.38) : 0)
      + ring(GT, e.hitT, 0.42) + ring(GT, e.ft ?? -9, 0.24, 3.4) + ring(tu, 0, -0.12, 6, 0.12);
  }

  const CHOP = (MON.CHOP = { skeleton: { raise: -1.2, bendUp: 1.0, bendHit: 2.4, bend0: 0, chopT: 0.26, recover: 0.28, over: 0.3, top: 0.08 } });

  // ---------------- per type ----------------
  // o: { id, H, face, lean, crouch, fallR, U, Ufar, t }
  MON.draw = (e, E, x, y, GT, o) => {
    const n = MON.rigOf(e.type); if (!n) return false; const face = o.face, H = o.H, live = e.deadT < 0;
    const base = { item: {}, id: o.id, seed: e.id, n, x, y, face, H, dist: e.dist, vx: e.vx * (live ? 1 : 1 - SS(0, 0.15, GT - e.deadT)), vy: e.vy * (live ? 1 : 1 - SS(0, 0.15, GT - e.deadT)), lean: o.lean, crouch: o.crouch || 0, fallR: o.fallR, U: o.U, Ufar: o.Ufar, t: o.t };
    // the knees give as it dies: on the spot first for the variants that sink before they fall, as the fall starts for the rest
    if (!live && o.death && o.death.buckle && RIGS[n].hipL) { const D0 = o.death, dd = GT - e.deadT; base.crouch += D0.buckle * 0.22 * RIGS[n].h * SS(0, Math.max(0.15, D0.dl), dd); }
    if (n === 'skeleton' || n === 'goblin') {
      // cut from the approved drawing: its pose is the rest pose, the weapon and shield are part of the forearms
      const RG = RIGS[n]; base.wSide = 'L';
      // the skeleton chops overhead, the goblin coils and stabs along the aim
      const pose = (b) => !live ? null : n === 'skeleton' ? chop(e, E, GT, face, H, b, Object.assign({ blade: RG.bladeL }, CHOP.skeleton))
        : stab(e, E, GT, face, H, b, 0, 0.7);
      const p0 = pose(0);
      if (p0) { if (n === 'goblin') base.crouch += 22 * p0.crouch;
        base.arm = (side, b) => { if (side === 'L') { const p = pose(b); return [p.r1, p.r1 + p.bend]; } const g = -0.3 * p0.k; return [b + g, b * 0.6 + g * 0.5]; }; }
      if (n === 'goblin') base.ear = earKick(e, GT, p0, live);
      // a skeleton dies one of three ways, picked by its id: a heap, bones flung off by the blow, or a fall that breaks apart
      if (n === 'skeleton' && !live) { const kind = ['pile', 'burst', 'topple'][e.id % 3]; base.crumble = { t: GT - e.deadT, kind, dir: e.dieA }; if (kind !== 'topple') base.fallR = 0; }
      biped(base); return true; }
    if (n === 'spider') {
      const ew = E.wind * DATA.eliteK(e, 'wind'), u = GT - e.t0;
      // it rears up through the wind-up (front legs raised at the hero), stays up through the lunge, settles after it
      base.rear = !live ? 0 : e.st === 'wind' ? SS(0, ew, u) : e.st === 'strike' ? 1 - SS(0.24, 0.45, u) : 0;
      // it dies one of two ways, picked by its id: the legs draw in under it where it stands, or they fold and it turns onto its back
      const back = e.id % 2 === 0, dd = GT - e.deadT;
      base.curl = live ? 0 : SS(0, back ? 0.15 : 0.4, dd); base.aimX = Math.cos(e.aimA) * face;
      if (!live && back) { base.dead = dd; base.flip = SS(0.1, 0.5, dd); }   // the legs fold in first, then it turns over with them
      if (live && e.st === 'strike') { const g = SS(0.3, 0.45, u); base.vx *= g; base.vy *= g; }   // the lunge is a body thrust, legs trailing: no gait until it lands
      spider(base); return true; }
    if (n === 'cultist') {
      const ew = E.wind * DATA.eliteK(e, 'wind'), u = GT - e.t0, wind = live && e.st === 'wind', str = live && e.st === 'strike';
      // the staff tips forward through the wind-up; the free hand thrusts at the aim, fully out on the shot frame (the strike's first)
      base.staff = wind ? -0.35 * SS(0, ew * 0.8, u) : str ? -0.35 * (1 - SS(0.1, 0.32, u)) : 0;
      base.push = wind ? SS(ew - 0.14, ew, u) : str ? 1 - SS(0.08, 0.32, u) : 0; base.aimR = aimRig(e, face, H) - 0.1;
      // the robe sinks onto the hem first (dl s), then the body lies down, half filling out again
      if (!live && o.death && o.death.sink) { const dd = GT - e.deadT, D0 = o.death; base.sink = 0.55 * SS(0, D0.dl, dd) * (1 - 0.5 * SS(D0.dl, D0.dl + D0.dur, dd)); }
      return robed(base); }
    if (n === 'brute') {
      const boss = e.type === 'boss', w = boss ? (e.hp < e.max * 0.5 ? 0.55 : 0.8) : 0;
      // fists on the floor and the body down for a beat on the slam, a beat at the top of the raise
      const CO = { raise: -2.6, chopT: 0.26, recover: 0.32, over: 0.15, hold: 0.14, top: 0.12, bossW: w }, p = live ? chop(e, E, GT, face, H, 0, CO) : null;   // the clock only; arms re-pose from their walk swing
      if (p) { const u = GT - e.t0, hit = e.st === 'strike' ? u : e.st === 'bwind' ? u - w : -1; base.crouch += 22 * (hit >= 0 ? SS(0, 0.05, hit) * (1 - SS(0.2, 0.32, hit)) : 0);
        base.arm = (side, b) => { const q = chop(e, E, GT, face, H, b, CO), d = side === 'L' ? 0.12 : 0; return [q.r1 + d, q.r1 + q.bend + d]; }; }
      biped(base); return true; }
    return false;
  };
})();
