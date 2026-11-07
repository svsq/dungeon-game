// live/monsters.js — monster rigs: cut-out parts from part sheets (partrig.py), posed from the sim's clocks (pure function of state).
// A biped (skeleton, goblin, demon) plants its feet on paths driven by distance, solves its knees by two-bone IK, lets the hip ride
// the legs, and swings its arms from pose curves keyed to the attack's own clock; the spider walks eight legs in two alternating sets.
(function () {
  const MON = (window.MONSTERS = {}), L = LIB, M = L.M, SS = L.SS, TAU = Math.PI * 2;
  const RIG = { skeleton: 'skeleton', goblin: 'goblin', brute: 'brute', boss: 'brute', cultist: 'cultist', spider: 'spider', drowned: 'drowned', crab: 'crab', skel_archer: 'skel_archer', skel_mage: 'skel_mage', skel_ember: 'skeleton', fire_priest: 'cultist', imp: 'imp', golem: 'golem', salamander: 'salamander', boss_colossus: 'colossus' };   // the ghost bends its one sprite (softbones)
  const SKULL_K = { skeleton: 1.3 };
  MON.wpn = {};
  MON.rigOf = (type) => { const n = RIG[type] || (DATA.BOSSES[type] || {}).rig; return n && window.RIGS && RIGS[n] && window.ASSETS[n + '__body'] ? n : null; };
  const d2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]), ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const rotP = (p, c, a) => { const dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; };
  const lerp = (a, b, k) => a + (b - a) * k;
  // a townsperson's tool in its hand (TASKS 1015): T = { tex, len: view px, grip: from the top, rel: turn off the forearm or abs: an
  // angle, both as if facing right }; drawn upright the tool's head is at the top. Reports grip and tip (the head)
  MON.tool = (id, T, E, Hd, face, u) => { if (!T || !window.ASSETS[T.tex]) return;
    const sa = T.abs !== undefined ? (face > 0 ? T.abs : Math.PI - T.abs) : ang(E, Hd) + face * (T.rel || 0), th = T.len, tw = th * G.tex(T.tex).w / G.tex(T.tex).h;
    L.sprite(T.tex, 0, 0, { m: M.of(M.t(Hd[0], Hd[1]), M.r(sa + Math.PI / 2), M.s(face, 1)), w: tw, h: th, pivot: [tw / 2, th * T.grip], u });
    const P = (p) => (L.pre ? M.ap(L.pre, p) : p);
    L.joint(id, 'grip', P(Hd)); L.joint(id, 'tip', P([Hd[0] + Math.cos(sa) * th * T.grip, Hd[1] + Math.sin(sa) * th * T.grip])); };

  // ---------------- the biped ----------------
  // o: { id, n, x, y, face, H, dist, vx, vy, lean, crouch, arm(side, base) → [r1, r2], item, shield, wSide, U, Ufar, fallR, lift }
  function biped(o) {
    const RG = RIGS[o.n], s = o.H / RG.h, face = o.face, gx = RG.gap, gy = RG.footL[1], fallR = o.fallR || 0, lean = o.lean || 0;
    // a boss move begins by cutting the walk (spd0 + its direction, sim.js): speed and direction ease down together, so neither
    // the stride amplitude nor the swing's side snaps
    const k0 = o.spd0 != null ? SS(0, 0.14, Math.max(0, o.t - o.t0)) : 1;
    const vxE = k0 < 1 ? lerp(o.vxn0 * o.spd0, o.vx, k0) : o.vx, vyE = k0 < 1 ? lerp(o.vyn0 * o.spd0, o.vy, k0) : o.vy;
    const sp = Math.hypot(vxE, vyE), run = SS(4, 30, sp) * (o.gaitK ?? 1);
    const dirx = sp > 1 ? vxE / sp * face : 0, diry = sp > 1 ? vyE / sp : 0;
    const legL = d2(RG.hipL, RG.kneeL) + d2(RG.kneeL, RG.ankleL), sl = 0.4 * legL * s * (o.strideK || 1), u0 = ((o.dist / (2 * sl)) % 1 + 1) % 1, ph = u0 * TAU;
    const fc = Math.cos(fallR), fs = Math.sin(fallR), root = [o.x, o.y];
    const R2S = (px, py, dy = 0) => { const x = face * (px - gx) * s, y = (py - gy) * s + dy; return [root[0] + x * fc - y * fs, root[1] + x * fs + y * fc]; };
    // legs: the stance foot slides back at body speed, the swing foot eases forward on a lift arc (phase from distance)
    const tg = {};
    for (const side of ['L', 'R']) {
      const A0 = RG['ankle' + side], u = (u0 + (side === 'L' ? 0 : 0.5)) % 1, A = sl * (o.stanceTime || 0.5) / s * run;
      let off, lift = 0;
      const stance = o.stanceTime || 0.5;
      if (u < stance) off = A * (1 - 2 * u / stance); else { const w = (u - stance) / (1 - stance); off = -A + 2 * A * SS(0.12, 0.95, w); lift = Math.pow(Math.sin(Math.PI * w), 0.6) * RG.h * (o.lift || 0.038) * (0.75 + 0.25 * Math.abs(dirx)) * run; }
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
    const stepPhase = (u0 * 2) % 1, settle = (o.settle || 0) / s * run * SS(0, 0.1, stepPhase) * (1 - SS(0.1, 0.45, stepPhase));
    const hipDy = Math.max((run * (o.bob || 2.2) * dbl) / s + (breath + 1) * Math.max(0.8 / s, 0.0075 * RG.h), drop) + crouch0 + (o.crouch || 0) + settle;
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
    const legSwing = Math.cos(ph) * 0.4 * run * (o.swingK ?? 1), arms = {};   // swingK: how far the arms swing (an imp runs with its claws held out)
    // arms swing against the same-side leg along the travel: the sign comes from where the drawn hand sits relative to its shoulder
    const vxn = sp > 1 ? vxE / sp : 1, vyn = sp > 1 ? vyE / sp : 0;
    for (const side of ['L', 'R']) { const S0 = RG['sh' + side], Hd0 = RG['hand' + side], Jt = (Hd0[0] - S0[0]) * vyn - face * (Hd0[1] - S0[1]) * vxn, sg = Jt > 0 ? 1 : -1;
      const rs = (o.rest && o.rest[side]) || [0, 0.18], base = rs[0] + sg * (side === 'L' ? -1 : 1) * legSwing * 0.8 + breath * 0.04 * (side === 'L' ? 1 : -1);
      let r = o.arm ? o.arm(side, base) : [base, base + rs[1] - rs[0] + (base - rs[0]) * -0.4];
      if (o.handTarget) {
        const E0 = RG['elbow' + side], E = rotP(E0, S0, r[0]), Hd = rotP(rotP(Hd0, S0, r[0]), E, r[1] - r[0]);
        const rest = R2U(Hd[0], Hd[1] + hipDy), T = o.handTarget(side, rest);
        if (T) {
          const origin = R2U(0, hipDy), ax = R2U(1, hipDy), ay = R2U(0, hipDy + 1), dx = T[0] - origin[0], dy = T[1] - origin[1];
          const a = ax[0] - origin[0], b = ax[1] - origin[1], c = ay[0] - origin[0], d = ay[1] - origin[1], det = a * d - b * c;
          const ik = reach(RG, side, [(d * dx - c * dy) / det, (a * dy - b * dx) / det], side === 'L' ? 1 : -1);
          // a third value blends the joints' angles to the reach by it, not the hand's target: the reach may bend the elbow the other
          // way than the pose it takes over from, and a target slid in from that pose flipped the elbow in a frame (the golem's slam)
          const wrap = (v) => v - TAU * Math.round(v / TAU);
          r = T.length > 2 ? [r[0] + wrap(ik[0] - r[0]) * T[2], r[1] + wrap(ik[1] - r[1]) * T[2]] : ik;
        }
      }
      const E0 = RG['elbow' + side], Sp = [S0[0], S0[1] + hipDy];
      const E = rotP([E0[0], E0[1] + hipDy], Sp, r[0]), Hd = rotP(rotP([Hd0[0], Hd0[1] + hipDy], Sp, r[0]), E, r[1] - r[0]);
      arms[side] = { S0, E0, Sp, E, Hd, r1: r[0], r2: r[1] }; }
    // a crumbling body lets every piece go (o.crumble: { t: seconds since death, kind, dir: the killing blow's screen angle }):
    //   pile   — each piece drops on its own under gravity from where it was, slowed just before the floor, bounces once and lies
    //            scattered, more of it away from the blow than toward it; the skull lands and rolls away from the blow
    //   burst  — the pieces fly off away from the blow on arcs, land softly and skid to a stop, spinning
    //   topple — the scene's fall (fallR) first; on landing the pieces come apart where they lie and the skull rolls on
    // Identity at its start: no pop on death
    const CR = {}, hsh = (key, k) => { let h = Math.imul((o.seed || 0) + 7919 * k, 2654435761); for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 2246822519); return ((h >>> 0) % 10007) / 10007; };
    const CK = o.crumble || null, TOP = 0.32;
    const crOf = (key, at, c = at) => { if (cr < 0) return null; if (CR[key]) return CR[key];   // c: the point it spins about
      const H = o.H, g = 8 * H, kind = CK.kind || 'pile', skull = key === 'skull', ribs = key === 'body' || (o.n === 'colossus' && key.startsWith('mantle'));
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
      const away = Math.cos(CK.dir ?? (face > 0 ? Math.PI : 0)), rollD = skull ? (away >= 0 ? 1 : -1) * (0.35 + 0.25 * hsh(key, 6)) * H : 0, roll = v > 0 ? rollD * (1 - Math.exp(-v / 0.28)) * SS(0, 0.12, v) : 0;
      const dx = (hsh(key, 3) - 0.5 + (top ? 0 : 0.3 * away)) * 0.6 * H * sc * SS(0, tl + 0.1, tt) + roll, dy = dyM * (2.6 * q * q - 1.6 * q * q * q) - hop;   // gravity, slowed just before the floor
      const spin = (o.n === 'colossus' && ribs ? ((Math.cos(CK.dir ?? 0) >= 0 ? 1 : -1) * 1.35 - lean) * SS(0.12, 0.9, cr) : (ribs ? (hsh(key, 4) - 0.5) * (top ? 0.5 : 1) : (hsh(key, 4) - 0.5) * 3 * sc) * SS(0, tl + 0.12, tt)) + roll / (0.1 * H);
      return (CR[key] = M.of(M.t(c[0] + dx, c[1] + dy), M.r(spin), M.t(-c[0], -c[1]))); };
    const piece = (key, at, f, c) => { const m = crOf(key, at, c), pre = L.pre; if (m) L.pre = pre ? M.mul(pre, m) : m; try { f(); } finally { L.pre = pre; } };
    const tx = o.tex || o.n, part = (nm, pv, at, rot, u, k = 1, up = 0, fx = 1) => piece(nm, at, () => L.sprite(tx + '__' + nm, 0, 0, { m: M.of(M.t(at[0], at[1]), M.r(fallR + up), M.s(face * fx, 1), M.r(rot), M.s(1, k)), w: RG.w * s, h: RG.h * s, pivot: [pv[0] * s, pv[1] * s], u }));
    const drawLeg = (side, u) => { const g = legs[side];
      part('thigh' + side, g.H0, R2S(g.Hp[0], g.Hp[1]), g.r1, u, g.k1); part('shin' + side, g.K0, R2S(g.K[0], g.K[1]), g.r2, u, g.k2); part('foot' + side, g.A0, R2S(g.T[0], g.T[1]), -g.lift * 0.02, u); };
    const drawArm = (side, u) => { const A = arms[side]; part('uarm' + side, A.S0, R2U(A.Sp[0], A.Sp[1]), A.r1, u, 1, lean); part('farm' + side, A.E0, R2U(A.E[0], A.E[1]), A.r2, u, 1, lean); };
    // (traced where drawn: through a turn's squash too, or a wide-armed rig's hands jumped mirror-wide in the trace as it turned)
    const items = {}, J = (nm, p, key) => { const m = key && CR[key], q = m ? [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]] : p; L.joint(o.id, nm, L.pre ? M.ap(L.pre, q) : q); };
    const held = (side, u) => { const A = arms[side], Hd = R2U(A.Hd[0], A.Hd[1]); if (o.hold && o.hold[side]) MON.tool(o.id, o.hold[side], R2U(A.E[0], A.E[1]), Hd, face, u); piece('item' + side, Hd, () => {
      if (side === (o.wSide || 'R') && window.ASSETS[o.n + '_weapon']) {
        const ba0 = A.r2 + Math.PI / 2 - (o.item.off ?? 0.8), ba = o.item.ang !== undefined ? ba0 + (((o.item.ang - ba0 + Math.PI) % TAU + TAU) % TAU - Math.PI) * (o.item.angK ?? 1) : ba0, sa = (face > 0 ? ba : Math.PI - ba) + fallR + lean;
        const tex = o.n + '_weapon', th = RG.weaponLen * s, tw = th * G.tex(tex).w / G.tex(tex).h, gr = RG.weaponGrip;
        const im = M.of(M.t(Hd[0], Hd[1]), M.r(sa - Math.PI / 2), M.s(o.item.mirror ? face : 1, 1)); items[side] = { m: im, tw, th, gr, sa };
        L.sprite(tex, 0, 0, { m: im, w: tw, h: th, pivot: [tw / 2, th * gr], u });
        J('grip', Hd, 'item' + side); J('tip', [Hd[0] + Math.cos(sa) * th * (1 - gr), Hd[1] + Math.sin(sa) * th * (1 - gr)], 'item' + side); }
      if (o.shield && side !== (o.wSide || 'R') && window.ASSETS[o.n + '_shield']) {
        const [w0, h0] = [G.tex(o.n + '_shield').w, G.tex(o.n + '_shield').h], sw = RG.shieldW * s, sh = sw * h0 / w0;
        L.sprite(o.n + '_shield', 0, 0, { m: M.of(M.t(Hd[0] + face * 4 * s, Hd[1] - 6 * s), M.r(fallR + lean * 0.5), M.s(face * 0.8, 1)), w: sw, h: sh, pivot: [sw / 2, sh / 2], u }); } }); };
    // far arm (+ its item) → far leg → near leg → body → near arm (+ its item)
    drawArm('L', o.Ufar); held('L', o.Ufar); drawLeg('L', o.Ufar); drawLeg('R', o.U);
    const glowPass = tx !== o.n, crust = RG.plates && o.plates;
    piece('body', hipS, () => L.sprite(tx + (crust && !glowPass ? '__core' : '__body'), 0, 0, { m: M.of(M.t(...hipS), M.r(fallR + lean), M.s(face, 1)), w: RG.w * s, h: RG.h * s, pivot: [Hc[0] * s, Hc[1] * s], u: o.U }));
    // the golem's crust (TASKS 458): its plates over the bare core, as many as it has left; one knocked off is thrown away from the
    // blow and tumbles to the floor, one growing back fades in white-hot at its edges; the bare core glows in the emissive pass
    if (crust) { const P = o.plates, al = (o.U && o.U.alpha) ?? 1, bodyM = M.of(M.t(...hipS), M.r(fallR + lean), M.s(face, 1)), opt = (u) => ({ m: bodyM, w: RG.w * s, h: RG.h * s, pivot: [Hc[0] * s, Hc[1] * s], u });
      RG.plates.forEach((C, j) => { const i = j + 1, on = i <= P.n, lost = (P.T || {})[i], grew = (P.G || {})[i];
        if (glowPass) { const k = on ? (grew !== undefined ? 1 - SS(0, 0.35, P.GT - grew) : 0) : (lost !== undefined ? SS(0, 0.15, P.GT - lost) : 1);
          if (k > 0.01) piece('plate' + i, hipS, () => L.sprite(o.n + 'E__corelit' + i, 0, 0, opt(Object.assign({}, o.U, { alpha: al * k })))); return; }
        if (on) { const a = grew !== undefined ? P.GT - grew : 9, k = SS(0, 0.35, a);
          piece('plate' + i, hipS, () => { L.sprite(o.n + '__plate' + i, 0, 0, opt(Object.assign({}, o.U, { alpha: al * k })));
            if (k < 1) L.sprite(o.n + '__plate' + i, 0, 0, opt(Object.assign({}, o.U, { alpha: al * 0.8 * (1 - k) * SS(0, 0.08, a), grade: [1, 2.6, 0, 1] }))); }); return; }
        const a = lost === undefined ? 9 : P.GT - lost, q = a / 1.0; if (q >= 1) return;
        // (thrown clear of the body, up first and down on the floor, a little hop, then it fades: kept over the body it was lost on it)
        const c = R2U(C[0], C[1] + hipDy), an = (P.A || {})[i] ?? 0, fl = Math.min(1, q / 0.6), dx = Math.cos(an) * 0.95 * o.H * (1 - (1 - fl) ** 2) + Math.cos(an) * 0.08 * o.H * SS(0.6, 0.8, q),
          dy = o.H * (0.48 * fl * fl - 0.42 * fl) - 0.05 * o.H * Math.sin(Math.PI * SS(0.6, 0.8, q)), spin = (Math.cos(an) >= 0 ? 1 : -1) * 3 * fl;
        const mm = M.of(M.t(c[0] + dx, c[1] + dy), M.r(spin), M.t(-c[0], -c[1])), pre = L.pre; L.pre = pre ? M.mul(pre, mm) : mm;
        try { L.sprite(o.n + '__plate' + i, 0, 0, opt(Object.assign({}, o.U, { alpha: al * (1 - SS(0.82, 1, q)) }))); } finally { L.pre = pre; } }); }
    // the skull is drawn larger about the neck: at 38 px a skull of the painted size reads as a bead (TASKS 127)
    const skK = RG.skull ? SKULL_K[o.n] || 1 : 1, skP = (P) => RG.skull ? [RG.skull[0] + (P[0] - RG.skull[0]) * skK, RG.skull[1] + (P[1] - RG.skull[1]) * skK] : P;
    if (RG.skull) { const at = R2U(RG.skull[0], RG.skull[1] + hipDy);   // a loose skull turns about its own middle, not the neck
      piece('skull', at, () => L.sprite(o.n + '__skull', 0, 0, { m: M.of(M.t(at[0], at[1]), M.r(fallR + lean), M.s(face * skK, skK)), w: RG.w * s, h: RG.h * s, pivot: [RG.skull[0] * s, RG.skull[1] * s], u: o.U }), R2U(RG.skull[0], RG.skull[1] + (RG.top[1] - RG.skull[1]) * skK / 2 + hipDy)); }
    // ears hang on a spring from their roots: they lag the head's bob twice a stride, plus whatever the caller kicks (o.ear, tips down)
    if (RG.earL) { const flop = 0.11 * run * Math.sin(2 * ph - 1.1) + 0.03 * breath + (o.ear || 0);
      for (const [sd, sg] of [['L', -1], ['R', 1]]) { const P = RG['ear' + sd], r = sg * flop * (sd === 'L' ? 1 : 0.85), Pd = [P[0], P[1] + hipDy];
        part('ear' + sd, P, R2U(...Pd), r, o.U, 1, lean); L.joint(o.id, 'ear' + sd, R2U(...rotP([RG['ear' + sd + 'Tip'][0], RG['ear' + sd + 'Tip'][1] + hipDy], Pd, r))); } }
    // townsfolk carry a head and a hip sword cut from the body: the head turns about the neck (o.headR) and looks the other way
    // over the shoulder (o.headF, 1 → −1: the head alone is mirrored, narrowed on the way), the sword hangs from the belt
    for (const nm of ['sword', 'head']) if (RG[nm] && RG.parts && RG.parts.includes(nm)) part(nm, RG[nm], R2U(RG[nm][0], RG[nm][1] + hipDy), nm === 'head' ? o.headR || 0 : -lean * 0.6 + 0.02 * breath, o.U, 1, lean, nm === 'head' ? o.headF ?? 1 : 1);
    // what the near arm holds in front of the body (the porter's crate)
    if (o.front) o.front((sd) => R2U(arms[sd].Hd[0], arms[sd].Hd[1]));
    drawArm('R', o.U); held('R', o.U);
    if (RG.mantleL) for (const side of ['L', 'R']) part('mantle' + side, Hc, hipS, 0, o.U, 1, lean);
    // the far foot stands higher in 3/4: each foot has its own ground
    J('ground', root); J('head', R2U(...skP(RG.head), hipDy * s), RG.skull ? 'skull' : 'body'); J('top', R2U(...skP(RG.top), hipDy * s), RG.skull ? 'skull' : 'body'); J('hip', hipS, 'body');
    if (cr >= 0) J('mid', R2U(Hc[0], (Hc[1] + RG.top[1]) / 2, hipDy * s), 'body');
    for (const side of ['L', 'R']) { const g = legs[side], A = arms[side], dT = [g.T[0] - g.A0[0], g.T[1] - g.A0[1]];
      J('hip' + side, R2S(g.Hp[0], g.Hp[1]), 'thigh' + side); J('knee' + side, R2S(g.K[0], g.K[1]), 'shin' + side); J('ankle' + side, R2S(g.T[0], g.T[1]), 'foot' + side);
      J('heel' + side, R2S(RG['heel' + side][0] + dT[0], RG['heel' + side][1] + dT[1]), 'foot' + side); J('toe' + side, R2S(RG['toe' + side][0] + dT[0], RG['toe' + side][1] + dT[1]), 'foot' + side);
      J('ground' + side, R2S(gx, RG['foot' + side][1] + tg[side].dz)); J('sh' + side, R2U(A.Sp[0], A.Sp[1]), 'uarm' + side); J('elbow' + side, R2U(A.E[0], A.E[1]), 'farm' + side); J('hand' + side, R2U(A.Hd[0], A.Hd[1]), 'farm' + side); }
    // where its weapon is (the hand that holds it to the blade's tip, or the fists), for the fire a priest lights on it (TASKS 410)
    { const sd = o.wSide || 'R', A = arms[sd], hd = R2U(A.Hd[0], A.Hd[1]), it = items[sd], P = (p) => (L.pre ? M.ap(L.pre, p) : p);
      const ba = RG['blade' + sd] !== undefined ? RG['blade' + sd] + A.r2 : null, bl = 0.3 * RG.h;
      const tip = it ? [hd[0] + Math.cos(it.sa) * it.th * (1 - it.gr), hd[1] + Math.sin(it.sa) * it.th * (1 - it.gr)] : ba !== null ? R2U(A.Hd[0] + Math.cos(ba) * bl, A.Hd[1] + Math.sin(ba) * bl) : null;
      MON.wpn[o.id] = tip ? [P(hd), P(tip), 1] : [P(hd), P(R2U(arms[sd === 'L' ? 'R' : 'L'].Hd[0], arms[sd === 'L' ? 'R' : 'L'].Hd[1])), 0]; }
    return { R2U, arms, s, items, head: R2U(...skP(RG.head), hipDy * s), chest: R2U(Hc[0], (Hc[1] + RG.top[1]) / 2, hipDy * s), hip: hipS };
  }
  MON.biped = biped;
  // an item's point at (fx, fy) of its texture, on screen
  const itemAt = (it, fx, fy) => { const p = M.ap(it.m, [(fx - 0.5) * it.tw, (fy - it.gr) * it.th]); return L.pre ? M.ap(L.pre, p) : p; };
  // two-bone IK for a drawn arm in rig px: the [upper, fore] turns that bring its hand to T, the elbow bent to the side of sg
  function reach(RG, side, T, sg) { const S0 = RG['sh' + side], E0 = RG['elbow' + side], H0 = RG['hand' + side], l1 = d2(S0, E0), l2 = d2(E0, H0);
    const d = Math.max(Math.abs(l1 - l2) + 1, Math.min(d2(S0, T), (l1 + l2) * 0.985)), th = ang(S0, T), a1 = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const E = [S0[0] + Math.cos(th + sg * a1) * l1, S0[1] + Math.sin(th + sg * a1) * l1], Tc = [S0[0] + Math.cos(th) * d, S0[1] + Math.sin(th) * d];
    return [ang(S0, E) - ang(S0, E0), ang(E, Tc) - ang(E0, H0)]; }
  // one stride (two steps) in view px for a rig drawn H tall: what the sim's distance must cover per gait cycle
  MON.stride = (type, H) => { const RG = RIGS[MON.rigOf(type)], s = H / RG.h; return MON.rigOf(type) === 'crab' ? 2 * CRAB.sl * MON.crabLeg() * H * CRAB.w / RG.w : MON.rigOf(type) === 'spider' ? 0.64 * H : RG.hipL ? 2 * 0.4 * (d2(RG.hipL, RG.kneeL) + d2(RG.kneeL, RG.ankleL)) * s : 0.28 * RG.h * s; };

  // ---------------- the robed caster: no legs to plant, the robe sways from the hem ----------------
  // o: biped's fields + staff (rig rad, the far arm), push (0..1, the free hand toward aimR), aimR (rig angle of the aim)
  const STAFF_HEAD = [31, 37];
  function robed(o) {
    const RG = RIGS[o.n], s = o.H / RG.h, face = o.face, gx = RG.gap, gy = RG.foot, fallR = o.fallR || 0, root = [o.x, o.y];
    const sp = Math.hypot(o.vx, o.vy), run = SS(4, 30, sp), ph = o.dist / (0.28 * RG.h * s) * TAU;
    const breath = (1 - run) * Math.sin(o.t * 1.7 + (o.seed || 0)), sway = run * 0.045 * Math.sin(ph) + 0.015 * breath, bob = run * 1.6 * Math.abs(Math.sin(ph)) + 1.4 * breath;
    const lean = (o.lean || 0) + sway, rot = fallR + lean, rc = Math.cos(rot), rs = Math.sin(rot), ky = 1 - (o.sink || 0);
    // the robe pivots at the hem's centre: everything above leans with it
    const R2U = (px, py) => { const x = face * (px - gx) * s, y = ((py - gy) * s - bob) * ky; return [root[0] + x * rc - y * rs, root[1] + x * rs + y * rc]; };
    const tx = o.tex || o.n, part = (nm, pv, at, r, u) => L.sprite(tx + '__' + nm, 0, 0, { m: M.of(M.t(at[0], at[1]), M.r(rot), M.s(face, ky), M.r(r)), w: RG.w * s, h: RG.h * s, pivot: [pv[0] * s, pv[1] * s], u });
    const swing = run * 0.12 * Math.sin(ph + 1), staffR = (o.staff || 0) + swing * 0.5 + 0.04 * breath;
    const push = o.push || 0, r1 = -swing - 0.06 * breath + lerp(0, (o.aimR ?? 0) - 0.4, push), r2 = r1 - 0.05 * breath + lerp(0, -0.1, push);
    const E = rotP(RG.elbowR, RG.shR, r1), Hd = rotP(rotP(RG.handR, RG.shR, r1), E, r2 - r1), HdL = rotP(RG.handL, RG.shL, staffR);
    part('farmL', RG.shL, R2U(...RG.shL), staffR, o.Ufar);
    L.sprite(tx + '__body', 0, 0, { m: M.of(M.t(...R2U(gx, gy)), M.r(rot), M.s(face, ky)), w: RG.w * s, h: RG.h * s, pivot: [gx * s, gy * s], u: o.U });
    part('uarmR', RG.shR, R2U(...RG.shR), r1, o.U); part('farmR', RG.elbowR, R2U(...E), r2, o.U);
    const J = (nm, p) => L.joint(o.id, nm, p);
    J('ground', root); J('top', R2U(...RG.top)); J('head', R2U(RG.top[0], RG.top[1] + 0.12 * RG.h)); J('hip', R2U(gx, gy - 0.45 * RG.h));
    J('shL', R2U(...RG.shL)); J('handL', R2U(...HdL)); J('shR', R2U(...RG.shR)); J('elbowR', R2U(...E)); J('handR', R2U(...Hd));
    // the ring in the staff's forked head (drawing px of the cultist's staff), where the fire priest's flame burns
    const head = R2U(...rotP(STAFF_HEAD, RG.shL, staffR)); J('staffHead', head);
    return { handR: R2U(...Hd), staffHead: head };
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
    const fl = (o.crouch || 0) / 6, lift = (0.07 + 0.16 * rear) * o.H * (1 - curl) + run * Math.max(0.6, 0.012 * o.H) * Math.abs(Math.sin(u0 * TAU * 2)) + 1.3 * breath - 0.06 * o.H * fl;
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
    if (o.crown && window.ASSETS.queen_crown) { const p = S2(RG.w / 2, RG.h * 0.23, lift), w = o.H * 0.65, h = o.H * 0.4;
      L.sprite('queen_crown', 0, 0, { m: M.of(M.t(...p), M.r(o.lean || 0), M.s(1, fk)), w, h, pivot: [w / 2, h * 0.85], u: Object.assign({}, Ub, { tint: [1, 1, 1, 0], pale: 0.35 }) }); }
    // the trace turns with the body (o.lean about its foot), or a lean the eye sees never reaches the checks
    const Pb = S2(RG.w / 2, RG.h, lift), BT = (q) => rotP(q, Pb, o.lean || 0);
    const J = (nm, p) => L.joint(o.id, nm, p); J('ground', root); J('top', BT(S2(RG.w / 2, 0, lift))); J('head', BT(S2(RG.w / 2, RG.h * 0.75, lift)));
    legs.forEach((g, i) => J('foot' + i, g.T));
  }

  // ---------------- the crab (TASKS 309): drawn from straight above, laid out on the floor round its facing ----------------
  // crab space: px of the shell's drawing (its front up); a point of it stands on the floor at (u forward, v to its right) view px,
  // turned to o.fa and squeezed CRAB.qy in depth, and its height z lifts it straight up the screen. The legs are two-bone IK in the
  // upright plane through socket and foot (knees up); the gait is a tripod (L0 R1 L2 | R0 L1 R2) driven by the distance walked in
  // the crab's own frame, so it walks sideways as readily as ahead
  // leg, claw: each part's scale against the shell's (the claws are the shield wall of the design, the legs a crab's, not a spider's)
  const CRAB = { turn: 0.5, w: 0.95, z: 0.2, qy: 0.82, reach: 0.68, sl: 0.36, leg: 0.8, arm: 0.85, claw: 1.05, spread: [0.6, 0.05, -0.55], set: [0, 1, 0] };
  function crab(o) {
    const RG = RIGS.crab, s = o.H * CRAB.w / RG.w, fa = o.fa, cf = Math.cos(fa), sf = Math.sin(fa), root = [o.x, o.y], c = RG.c, qy = CRAB.qy;
    const S2 = (u, v, z) => [root[0] + u * cf - v * sf, root[1] + (u * sf + v * cf) * qy - z];   // floor (u, v, z) → screen
    const UV = (px, py, side = 1) => [-(py - c[1]) * s, side * (px - c[0]) * s];                    // crab space → floor (u, v); side −1 mirrors to the right
    const len = (P, k = 1) => d2(P.root, P.end) * s * k, l1 = len(RG.legA, CRAB.leg), l2 = len(RG.legB, CRAB.leg), a1 = len(RG.armA, CRAB.arm), a2 = len(RG.armB, CRAB.arm);
    const sp = Math.hypot(o.vx, o.vy), run = SS(4, 30, sp), vu = sp > 1 ? (o.vx * cf + o.vy * sf) / sp : 1, vv = sp > 1 ? (-o.vx * sf + o.vy * cf) / sp : 0;
    const curl = o.curl || 0, breath = (1 - run) * Math.sin(o.t * 2.1 + (o.seed || 0)) * (1 - curl);
    const zB = o.H * CRAB.z * (1 - 0.35 * (o.low || 0)) * (1 - 0.8 * curl) + 0.6 * breath + run * 0.5 * Math.abs(Math.sin(o.dist / (CRAB.sl * (l1 + l2)) * TAU));
    const sl = CRAB.sl * (l1 + l2), u0 = ((o.dist / (2 * sl)) % 1 + 1) % 1, bx = o.bx || 0, by = o.by || 0;   // bx, by: the shell knocked about (floor px)
    // a segment drawn from one screen point to another: its drawing turned onto the line and stretched along it (foreshortened)
    const seg = (tex, P, from, to, flip, u, ks) => { const want = Math.atan2(to[1] - from[1], to[0] - from[0]), k = Math.max(0.3, Math.hypot(to[0] - from[0], to[1] - from[1]) / len(P, ks));
      L.sprite(tex, 0, 0, { m: M.of(M.t(from[0], from[1]), M.r(want), M.s(k, flip ? -1 : 1), M.r(-ang(P.root, P.end))), w: P.w * s * ks, h: P.h * s * ks, pivot: [P.root[0] * s * ks, P.root[1] * s * ks], u }); };
    const legs = [];
    for (const side of [1, -1]) RG.legs.forEach((so, j) => {
      const [us, vs] = UV(so[0], so[1], -side), Sk = [us + bx, vs + by, zB * 0.85], out = side;   // side 1: the right, −1: the drawn left
      const ra = CRAB.spread[j], D = CRAB.reach * (l1 + l2) * (1 + 0.15 * (o.low || 0)) * (1 - 0.55 * curl), A = sl / 2 * run;
      const ph = (u0 + (CRAB.set[j] ^ (side < 0 ? 1 : 0) ? 0.5 : 0)) % 1; let off, up = 0;
      if (ph < 0.5) off = A * (1 - 4 * ph); else { const w = (ph - 0.5) * 2; off = -A + 2 * A * (-w + 6 * w * w - 4 * w * w * w); up = Math.sin(Math.PI * w) ** 2 * 0.12 * o.H * run; }
      // the rest foot out from its socket, turned forward for the front legs and back for the hind ones; dying they fold in under it
      const dirU = Math.sin(ra), dirV = out * Math.cos(ra), twitch = curl > 0 ? Math.sin(o.t * 21 + j * 2 + side) * 0.06 * D * SS(0.1, 0.35, o.dead || 0) * (1 - SS(0.6, 1.4, o.dead || 0)) : 0;
      // standing, the crab turns on the spot by steps: each foot keeps the heading it was set down at and swings round to the next in the
      // last quarter of a step, the tripod's two sets half a step apart (TASKS 328)
      const stand = (1 - run) * (1 - curl) * (o.calm || 0) * (1 - SS(0, 0.6, o.dead || 0)), xs = o.fa / CRAB.turn + (CRAB.set[j] ^ (side < 0 ? 1 : 0) ? 0.5 : 0), fl0 = Math.floor(xs), fr0 = xs - fl0, sw = SS(0.7, 1, fr0);
      const e = (o.fa - (fl0 + sw - (xs - o.fa / CRAB.turn)) * CRAB.turn) * stand, ce = Math.cos(e), se = Math.sin(e); up += Math.sin(Math.PI * sw) * 0.14 * o.H * stand * (fr0 > 0.7 ? 1 : 0);
      const F0 = [us + dirU * (D + twitch) + vu * off, vs + dirV * (D + twitch) + vv * off], F = [F0[0] * ce + F0[1] * se, -F0[0] * se + F0[1] * ce, up + curl * 0.35 * zB];
      if (run > 0.8 && !curl && o.trail && o.trail.length > 1) {
        const plant = o.dist - ph * 2 * sl, trail = o.trail;
        const i = trail.findIndex((p) => p.dist >= plant);
        if (i > 0) {
          const p = trail[i - 1], q = trail[i], k = (plant - p.dist) / Math.max(0.0001, q.dist - p.dist), mix = (a, b) => a + (b - a) * k;
          const angle = p.fa + Math.atan2(Math.sin(q.fa - p.fa), Math.cos(q.fa - p.fa)) * k, c0 = Math.cos(angle), s0 = Math.sin(angle), vx = mix(p.vx, q.vx), vy = mix(p.vy, q.vy), speed = Math.hypot(vx, vy) || 1;
          const pu = us + dirU * D + (vx * c0 + vy * s0) / speed * sl / 2, pv = vs + dirV * D + (-vx * s0 + vy * c0) / speed * sl / 2;
          const last = trail[trail.length - 1], dx = mix(p.x, q.x) - last.x + pu * c0 - pv * s0, dy = (mix(p.y, q.y) - last.y) / qy + pu * s0 + pv * c0;
          const transfer = Math.max(0, 2 * ph - 1), hold = 1 - transfer ** 3 * (transfer * (6 * transfer - 15) + 10);
          F[0] += (dx * cf + dy * sf - F[0]) * hold; F[1] += (-dx * sf + dy * cf - F[1]) * hold;
        }
      }
      const hx = F[0] - Sk[0], hy = F[1] - Sk[1], hd = Math.hypot(hx, hy) || 1, dz = F[2] - Sk[2], raw = Math.hypot(hd, dz), limit = (l1 + l2) * 0.98, d = raw < 0.95 * limit ? raw : limit - 0.05 * limit * Math.exp(-(raw - 0.95 * limit) / (0.05 * limit)), base = Math.atan2(dz, hd);
      const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))), ka = base + a;
      const K = [Sk[0] + hx / hd * Math.cos(ka) * l1, Sk[1] + hy / hd * Math.cos(ka) * l1, Sk[2] + Math.sin(ka) * l1];
      const ta = Math.atan2(F[2] - K[2], Math.hypot(F[0] - K[0], F[1] - K[1]) * Math.sign((F[0] - K[0]) * hx + (F[1] - K[1]) * hy || 1));
      const T = [K[0] + hx / hd * Math.cos(ta) * l2, K[1] + hy / hd * Math.cos(ta) * l2, K[2] + Math.sin(ta) * l2];
      legs.push({ side, j, Sk: S2(...Sk), K: S2(...K), T: S2(...T), depth: (Sk[0] * sf + Sk[1] * cf) });
    });
    // the claws: shoulder at the shell's front corner, the wrist set by the pose (floor u, v, z), the elbow out to the side; the pincer
    // points ahead and a little in; its movable finger opens on o.open
    const claw = (side, P) => { const [us, vs] = UV(RG.claw[0], RG.claw[1], -side), out = side, Sh = [us + bx, vs + by], W = [Sh[0] + 0.5 * (a1 + a2) * Math.cos(0.45) + P.u, Sh[1] + out * (0.5 * (a1 + a2) * Math.sin(0.45) + P.v)], dx0 = W[0] - Sh[0], dy0 = W[1] - Sh[1];
      // the reach eased into its limit, never met: an arm pulled straight sweeps its elbow across in a frame (the IK's singularity)
      const lim = (a1 + a2) * 0.86, d0 = Math.hypot(dx0, dy0) || 1, dd = d0 < 0.6 * lim ? d0 : lim - 0.4 * lim * Math.exp(-(d0 - 0.6 * lim) / (0.4 * lim)), dx = dx0, dy = dy0, b0 = Math.atan2(dy, dx);
      const a = Math.acos(Math.max(-1, Math.min(1, (a1 * a1 + dd * dd - a2 * a2) / (2 * a1 * dd)))), ea = b0 + out * a, E = [Sh[0] + Math.cos(ea) * a1, Sh[1] + Math.sin(ea) * a1];
      const Wr = [E[0] + Math.cos(Math.atan2(W[1] - E[1], W[0] - E[0])) * a2, E[1] + Math.sin(Math.atan2(W[1] - E[1], W[0] - E[0])) * a2], ha = -out * (P.in ?? 0.2), hl = len(RG.hand, CRAB.claw);
      const End = [Wr[0] + Math.cos(ha) * hl, Wr[1] + Math.sin(ha) * hl], z0 = zB * 0.8, zw = P.z;
      return { side, out, Sh: S2(Sh[0], Sh[1], z0), E: S2(E[0], E[1], (z0 + zw) / 2), W: S2(Wr[0], Wr[1], zw), End: S2(End[0], End[1], zw + (P.tip || 0)), open: P.open || 0, depth: Wr[0] * sf + Wr[1] * cf }; };
    const CL = o.claws || ((side) => ({ u: 0, v: 0 }));
    const claws = [1, -1].map((side) => { const p = CL(side); return claw(side, { u: p.u || 0, v: p.v || 0, z: zB * 0.75 + (p.z || 0), open: p.open, in: p.in ?? 0.55, tip: p.tip }); });
    const drawClaw = (g) => { const U = g.depth < 0 ? o.Ufar : o.U, fl = g.side < 0; seg('crab__armA', RG.armA, g.Sh, g.E, !fl, U, CRAB.arm); seg('crab__armB', RG.armB, g.E, g.W, !fl, U, CRAB.arm);
      const H0 = RG.hand, F0 = RG.finger, sc = s * CRAB.claw, want = Math.atan2(g.End[1] - g.W[1], g.End[0] - g.W[0]), k = Math.max(0.3, Math.hypot(g.End[0] - g.W[0], g.End[1] - g.W[1]) / len(H0, CRAB.claw)), a0 = ang(H0.root, H0.end);
      const hm = [M.t(g.W[0], g.W[1]), M.r(want), M.s(k, fl ? 1 : -1), M.r(-a0)];
      L.sprite('crab__hand', 0, 0, { m: M.of(...hm), w: H0.w * sc, h: H0.h * sc, pivot: [H0.root[0] * sc, H0.root[1] * sc], u: U });
      const th = ang(H0.hinge, H0.end) - 0.75 * g.open;
      L.sprite('crab__finger', 0, 0, { m: M.of(...hm, M.t((H0.hinge[0] - H0.root[0]) * sc, (H0.hinge[1] - H0.root[1]) * sc), M.r(th), M.s(0.88, 1), M.r(-ang(F0.root, F0.end))), w: F0.w * sc, h: F0.h * sc, pivot: [F0.root[0] * sc, F0.root[1] * sc], u: U }); };
    for (const g of [...legs].sort((p, q) => p.depth - q.depth)) { const U = g.depth < 0 ? o.Ufar : o.U, fl = g.side < 0; seg('crab__legA', RG.legA, g.Sk, g.K, fl, U, CRAB.leg); seg('crab__legB', RG.legB, g.K, g.T, fl, U, CRAB.leg); }
    for (const g of claws) if (g.depth < 0) drawClaw(g);
    const B = S2(bx, by, zB);
    L.sprite('crab__body', 0, 0, { m: M.of(M.t(B[0], B[1]), M.s(1, qy), M.r(fa + Math.PI / 2)), w: RG.w * s, h: RG.h * s, pivot: [c[0] * s, c[1] * s], u: o.U });
    for (const g of claws) if (g.depth >= 0) drawClaw(g);
    const J = (nm, p) => L.joint(o.id, nm, p), fr = UV(RG.front[0], RG.front[1]);
    const sa = (c[1] - RG.front[1]) * s, sb = (RG.w / 2) * s * 0.85, ext = Math.hypot(sa * sf, sb * cf) * qy;   // the shell's far edge on screen: its top
    J('ground', root); J('top', [B[0], B[1] - ext]); J('head', S2(fr[0] + bx, by, zB)); J('hip', B);
    legs.forEach((g, i) => { J('foot' + i, g.T); J('knee' + i, g.K); });
    for (const g of claws) { const n = g.side > 0 ? 'L' : 'R'; J('hand' + n, g.W); J('claw' + n, g.End); J('elbow' + n, g.E); }
    return { s };
  }
  MON.crabLeg = () => { const RG = RIGS.crab; return RG ? (d2(RG.legA.root, RG.legA.end) + d2(RG.legB.root, RG.legB.end)) * CRAB.leg : 0; };

  // ---------------- the lava salamander (TASKS 408): drawn from straight above, laid out on the floor round its facing ----------------
  // the head, body and tail are one drawing bent on soft bones (the tail from the hips, its tip riding on it, the neck): it swings
  // its body in an S as it walks, the head against the tail. Four legs, one drawing split at the knee, walk in diagonal pairs
  // (front left with hind right), the front elbows bent back and the hind knees forward, IK in the floor's plane with the knee raised
  // o: { id, x, y, H (its length on the floor), fa, dist, vx, vy, t, seed, U, swim (0 on land .. 1 under), lunge, open, curl, glow,
  // inhale (0..1: drawing its breath), exhale (0..1 through the breath, < 0 none) }
  // (TASKS 460) its fire is its body's: drawing breath the head goes back and the tail curls in; breathing out the head pushes ahead
  // in kicks of recoil and sweeps slowly across the cone; coming out of the lava (and going in) the body heaves up off it
  const LZ = { qy: 0.8, sl: 0.13, reach: 0.82, set: [0, 1, 1, 0], out: [0.95, 0.85], fwd: [0.12, -0.18] };
  function lizard(o) {
    const RG = RIGS.salamander, s = o.H / RG.h, fa = o.fa, cf = Math.cos(fa), sf = Math.sin(fa), qy = LZ.qy, c = RG.c, A = RG.legA, B = RG.legB;
    const sp = Math.hypot(o.vx, o.vy), run = SS(4, 30, sp) * (1 - (o.swim || 0)), sw = o.swim || 0, curl = o.curl || 0, lunge = o.lunge || 0, fl = o.flinch || 0;
    const sl = LZ.sl * o.H, u0 = ((o.dist / (2 * sl)) % 1 + 1) % 1, ph = u0 * TAU, breath = Math.sin(o.t * 1.6 + (o.seed || 0));
    const inh = o.inhale || 0, ex = o.exhale ?? -1, kick = ex >= 0 ? 0.03 * Math.sin(ex * TAU * 3) * (1 - ex) * SS(0, 0.15, ex) : 0, heave = sw > 0 && sw < 1 ? Math.sin(Math.PI * sw) : 0;
    const back = lunge * 0.08 - fl * 0.07 - inh * 0.12 - kick;
    const root = [o.x + cf * back * o.H, o.y + sf * back * o.H * qy];
    // the body's S: the tail swings against the head over each stride, idles in a slow sway, curls as it dies
    const tail = (0.32 * run * Math.sin(ph) + 0.1 * (1 - run) * Math.sin(o.t * 1.3 + (o.seed || 0)) + 0.08 * sw * Math.sin(o.t * 2.2)) * (1 - curl) + 0.9 * curl + 0.25 * fl + 0.35 * inh;
    const tip = (0.4 * run * Math.sin(ph - 1.1) + 0.14 * (1 - run) * Math.sin(o.t * 1.9 + 1 + (o.seed || 0))) * (1 - curl) + 0.7 * curl, neck = (-0.16 * run * Math.sin(ph) + 0.05 * breath * (1 - run)) * (1 - Math.max(0, lunge)) * (1 - curl) - 0.3 * curl - 0.2 * fl - 0.18 * inh + (ex >= 0 ? 0.14 * Math.sin(ex * TAU) : 0);
    // body px → floor (u ahead, v to its right) about its middle, with the soft bones turned as the shader turns them; floor → screen
    const bend = (px, py) => { let p = [px, py]; const [b0, b1, b2] = RG.bones;
      if (py > b2[1]) p = rotP(p, b2, tip); if (py > b0[1]) p = rotP(p, b0, tail); if (py < b1[1]) p = rotP(p, b1, neck); return p; };
    const UV = (px, py) => { const p = bend(px, py); return [-(p[1] - c[1]) * s, (p[0] - c[0]) * s]; };
    const S2 = (u, v, z = 0) => [root[0] + u * cf - v * sf, root[1] + (u * sf + v * cf) * qy - z];
    const lift = (0.025 + 0.019 * Math.sin(2 * ph) ** 2 * run) * o.H * (1 - sw) + 0.01 * o.H * breath * (1 - run) + 0.04 * o.H * heave + 0.025 * o.H * inh;
    // legs: rest foot out from its socket and a little ahead (front) or behind (hind); the stance foot slides back at body speed,
    // the swing foot comes forward on a lift arc
    const l1 = d2(A.root, A.end) * s * LZ.reach, l2 = d2(B.root, B.end) * s * LZ.reach, legs = [];
    for (let i = 0; i < 4; i++) { const side = i < 2 ? -1 : 1, j = i % 2, so = RG.legs[j], px = side < 0 ? so[0] : 2 * c[0] - so[0], Sk = UV(px, so[1]);
      const u = (u0 + (LZ.set[i] ? 0.5 : 0)) % 1, Am = sl / 2 * run; let off, up = 0;
      if (u < 0.5) off = Am * (1 - 4 * u); else { const w = (u - 0.5) * 2; off = -Am + 2 * Am * SS(0.1, 0.9, w); up = Math.sin(Math.PI * w) * 0.05 * o.H * run; }
      let F = [Sk[0] + LZ.fwd[j] * (l1 + l2) + off, Sk[1] + side * LZ.out[j] * (l1 + l2) * 0.82];
      const tuck = Math.max(sw, curl); if (tuck > 0) F = [lerp(F[0], Sk[0] + (j ? -0.3 : 0.3) * l1, tuck), lerp(F[1], Sk[1] + side * 0.35 * l1, tuck)];
      // in the floor's plane: the elbow (front) bends back, the knee (hind) forward; then the joint rises off the floor a little
      const dx = F[0] - Sk[0], dy = F[1] - Sk[1], dm = Math.min(Math.hypot(dx, dy), (l1 + l2) * 0.98), base = Math.atan2(dy, dx);
      const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm)))), ka = base + a * side * (j ? 1 : -1);
      const K = [Sk[0] + Math.cos(ka) * l1, Sk[1] + Math.sin(ka) * l1], T = [K[0] + Math.cos(Math.atan2(F[1] - K[1], F[0] - K[0])) * l2, K[1] + Math.sin(Math.atan2(F[1] - K[1], F[0] - K[0])) * l2];
      legs.push({ side, j, S: S2(Sk[0], Sk[1], lift), K: S2(K[0], K[1], lift * 0.6 + 0.04 * o.H), T: S2(T[0], T[1], up) }); }
    const seg = (tex, P, from, to, side, u) => { const a0 = Math.atan2(P.end[1] - P.root[1], P.end[0] - P.root[0]), want = Math.atan2(to[1] - from[1], to[0] - from[0]), k = d2(from, to) / (d2(P.root, P.end) * s);
      L.sprite(tex, 0, 0, { m: M.of(M.t(from[0], from[1]), M.r(want - a0), M.s(k, side)), w: P.w * s, h: P.h * s, pivot: [P.root[0] * s, P.root[1] * s], u }); };
    const tx = o.tex || 'salamander', show = 1 - SS(0.3, 0.7, sw);
    if (show > 0.02) for (const g of [...legs].sort((p, q) => p.S[1] - q.S[1])) { const u = Object.assign({}, g.S[1] < root[1] ? o.Ufar : o.U); if (show < 1) u.alpha = (u.alpha ?? 1) * show;
      seg(tx + '__legA', A, g.S, g.K, g.side, u); seg(tx + '__legB', B, g.K, g.T, g.side, u); }
    const P0 = S2(0, 0, lift), bones = window.ASSETS.salamander__body_w ? { wtex: G.tex('salamander__body_w'), wsz: [RG.w, RG.h], bone0: [RG.bones[0][0] / RG.w, RG.bones[0][1] / RG.h, tail, 1], bone1: [RG.bones[1][0] / RG.w, RG.bones[1][1] / RG.h, neck, 1], bone2: [RG.bones[2][0] / RG.w, RG.bones[2][1] / RG.h, tip, 1] } : {};
    L.sprite(tx + '__body', 0, 0, { m: M.of(M.t(P0[0], P0[1]), M.s(1, qy), M.r(fa + Math.PI / 2)), w: RG.w * s, h: RG.h * s, pivot: [c[0] * s, c[1] * s], u: Object.assign({}, o.U, bones) });
    const J = (nm, p) => L.joint(o.id, nm, p), at = (px, py, z = lift) => { const q = UV(px, py); return S2(q[0], q[1], z); };
    // top: a fixed third of its length over its middle (seen from above, its back's far edge swings with the facing; the checks
    // measure every motion against it); snout, not head: a lizard's head swings sideways, it does not bob like a walker's
    J('ground', [o.x, o.y]); J('top', [root[0], root[1] - 0.35 * o.H - lift]); J('snout', at(RG.nose[0], RG.nose[1] + 30, lift + 0.08 * o.H)); J('tail', at(RG.tail[0], RG.tail[1]));
    legs.forEach((g, i) => J('foot' + i, g.T));
    return { mouth: at(RG.mouth[0], RG.mouth[1]), nose: at(RG.nose[0], RG.nose[1]), fa: fa + neck * 0.6 };
  }
  MON.lizard = lizard;

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
    const breath = Math.sin(t * 1.8 + (o.seed || 0)), lift = breath * 4 - 10 * nod - 22 * recoil;
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

  // a robed townsfolk rig (body to the hem, two-bone arms, a head on the neck): o.arms(side) → [r1, r2] poses the arms, o.lift
  // raises the torso's parts (rig px), o.headR / o.headD turn and shift the head; at rest it only breathes.
  // Walking (o.dist, o.vx, o.vy, TASKS 1031): the shoes below the hem are cut from the body and step in turn, phased by the distance
  // walked so a planted shoe holds the floor; the body rides up over each passing step, rocks a little and the hem swings after the
  // stepping leg. hem: the cut's row (a few rows of skirt go with the shoes, so a rising body leaves no gap); split: the column between
  // the shoes; step: a shoe's travel either side of the hem (rig px), one stride = 4 steps' travel
  const ROBE = { town_sweeper: { hem: 286, split: 76, step: 20 }, town_enchanter: { hem: 298, split: 83, step: 18 } };
  MON.robeStride = (n, H) => { const q = ROBE[n]; return q && RIGS[n] ? 4 * q.step * H / RIGS[n].h : 0; };
  MON.robed = (o) => {
    const RG = RIGS[o.n]; if (!RG || !window.ASSETS[o.n + '__body']) return false;
    const s = o.H / RG.h, t = o.t, gx = RG.gap, gy = RG.foot, root = [o.x, o.y], f = o.face || 1, Q = ROBE[o.n];
    const run = Q ? SS(2, 12, Math.hypot(o.vx || 0, o.vy || 0)) : 0, ph = Q ? (o.dist || 0) / MON.robeStride(o.n, o.H) * TAU : 0;
    const bob = run * 1.5 * Math.sin(ph) ** 2, rot = f * run * 0.022 * Math.sin(ph), rc = Math.cos(rot), rs = Math.sin(rot);
    const S2 = (px, py) => { const x = f * (px - gx) * s, y = (py - gy) * s - bob; return [root[0] + x * rc - y * rs, root[1] + x * rs + y * rc]; };
    const breath = Math.sin(t * 1.7 + (o.seed || 0)), lift = breath * 2.5 + (o.lift || 0);
    // o.handTarget(side) → a screen point the hand reaches for (two-bone IK), or null to keep o.arms' angles
    const arm = (side) => { let r = o.arms ? o.arms(side, breath) : [(side === 'L' ? 1 : -1) * 0.03 * breath, 0.05 * breath], S0 = RG['sh' + side], E0 = RG['elbow' + side], Hd0 = RG['hand' + side], Sp = [S0[0], S0[1] + lift];
      const T = o.handTarget && o.handTarget(side); if (T) { const d = [T[0] - root[0], T[1] - root[1]], u = [d[0] * rc + d[1] * rs, -d[0] * rs + d[1] * rc]; r = reach(RG, side, [gx + u[0] / (f * s), gy + (u[1] + bob) / s - lift], side === 'L' ? 1 : -1); }
      const E = rotP([E0[0], E0[1] + lift], Sp, r[0]), Hd = rotP(rotP([Hd0[0], Hd0[1] + lift], Sp, r[0]), E, r[1] - r[0]); return { S0, E0, Sp, E, Hd, r }; };
    const A = { L: arm('L'), R: arm('R') };
    const part = (nm, pv, at, r) => L.sprite(o.n + '__' + nm, 0, 0, { m: M.of(M.t(...S2(...at)), M.r(rot), M.s(f, 1), M.r(r)), w: RG.w * s, h: RG.h * s, pivot: [pv[0] * s, pv[1] * s], u: o.U });
    // the drawing's own layering: mirrored, the near arm stays near
    const far = 'L', near = 'R', drawArm = (sd) => { const a = A[sd]; part('uarm' + sd, a.S0, a.Sp, a.r[0]); part('farm' + sd, a.E0, a.E, a.r[1]);
      if (o.hold && o.hold[sd]) MON.tool(o.id, o.hold[sd], S2(...a.E), S2(...a.Hd), f, o.U); };
    drawArm(far);
    if (Q) {
      // a shoe's place off the hem over its phase: planted from +step back to -step, then lifted and swung forward again
      const shoe = (x0, x1, k) => { const q = ((ph + k * Math.PI) % TAU + TAU) % TAU, st = q < Math.PI, x = st ? Q.step * (1 - 2 * q / Math.PI) : -Q.step * Math.cos(q - Math.PI),
          up = st ? 0 : 7 * Math.sin(q - Math.PI), w = (x1 - x0) * s, h = (RG.h - Q.hem) * s;
        L.sprite(o.n + '__body', 0, 0, { m: M.of(M.t(root[0] + f * (x0 - gx + run * x) * s, root[1] + (Q.hem - gy - run * up) * s), M.s(f, 1)), w, h, src: [x0 / RG.w, Q.hem / RG.h, x1 / RG.w, 1], u: o.U }); };
      // the far shoe (the drawing's right one, standing higher) first
      shoe(Q.split, RG.w, 1); shoe(0, Q.split, 0);
      L.sprite(o.n + '__body', 0, 0, { m: M.of(M.t(...S2(gx, gy)), M.r(rot), M.s(f, 1)), w: RG.w * s, h: (Q.hem + 8) * s, src: [0, 0, 1, (Q.hem + 8) / RG.h], pivot: [gx * s, gy * s], pad: 0.04,
        u: Object.assign({}, o.U, { lean: [-0.03 * run * Math.cos(ph), 1] }) }); }
    else L.sprite(o.n + '__body', 0, 0, { m: M.of(M.t(...root), M.s(f, 1)), w: RG.w * s, h: RG.h * s, pivot: [gx * s, gy * s], u: o.U });
    const hd = o.headD || [0, 0], hy = lift * 0.8 + hd[1];
    part('head', RG.neck, [RG.neck[0] + hd[0], RG.neck[1] + hy], o.headR || 0);
    drawArm(near);
    const J = (nm, p) => L.joint(o.id, nm, S2(...p));
    L.joint(o.id, 'ground', root); J('top', [RG.top[0] + hd[0], RG.top[1] + hy]); J('head', [RG.neck[0] + hd[0], RG.neck[1] + hy]);
    for (const sd of ['L', 'R']) { const a = A[sd]; J('sh' + sd, a.Sp); J('elbow' + sd, a.E); J('hand' + sd, a.Hd); }
    return { hand: (sd) => S2(...A[sd].Hd) };
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
    const ew = DATA.windOf(e, E.wind), u = Math.max(0, GT - e.t0), T = o.chopT, P = 1.3, bh = o.bendHit ?? 0.15, i0 = aimRig(e, face, H) - (o.blade ?? Math.PI / 2 - 0.8) - bh;   // blade = its angle in the drawing
    const imp = o.raise + (((i0 - o.raise + Math.PI) % TAU + TAU) % TAU - Math.PI), RAISE = Math.min(o.raise, imp - 0.6), vEnd = P * (imp - RAISE) / T;
    if (e.st === 'wind' || e.st === 'bwind') { const w = e.st === 'bwind' ? o.bossW : ew, tc = w - T;
      // the raise starts with no jerk either: a smoothstep's second derivative at 0 kicks the hand out of the walk's own swing;
      // it holds at 1 from h on (the top wait), so x clamps
      if (u < tc) { const h = Math.max(0.05, tc - (o.top || 0)), x = Math.min(1, u / h), k = x * x * x * (10 + x * (-15 + 6 * x)); return { r1: lerp(base, RAISE, k), bend: lerp(o.bend0 ?? 0.18, o.bendUp ?? 0.9, k), k }; }
      // from rest at the top to vEnd at the impact: a cubic with no jerk at its start
      if (u < w) { const x = (u - tc) / T, q = (3 - P) * x * x + (P - 2) * x * x * x; return { r1: lerp(RAISE, imp, q), bend: lerp(o.bendUp ?? 0.9, bh, q), k: 1 }; }
      return after(imp, u - w, base, o, vEnd); }
    if (e.st === 'strike') return after(imp, u, base, o, vEnd);
    return null;
  }
  // the follow-through leaves the impact at the chop's own speed and bleeds it off over `over` rad: no one-frame stop;
  // a heavy blow rests on the floor for o.hold s before the arms come back. The arm comes home on along the blow: back over the
  // top it reads as a second swing
  function after(imp, v, base, o, vEnd) {
    // a very fast swing (a compressed arc, vEnd > 11 rad/s) would stop within a frame: bleed it off over ~2 frames, overshoot
    // deeper to keep the arrival speed, and give the come-back the same extra time
    const over = o.over || 2.2, dec = vEnd > 11 ? 0.024 : over / vEnd, A = vEnd * dec;
    // the come-back must still finish inside the blow's own length (o.dur) with a beat to spare, or the state change snaps the arms
    const fol = imp + A * (1 - Math.exp(-v / dec)), rest = above(base, imp + over - 1.2);
    const k = SS(0.12 + (o.hold || 0), Math.min(o.recover + Math.max(0, A - over) * 0.6, (o.dur || 1) - 0.08), v);
    return { r1: lerp(fol, rest, k), bend: lerp(o.bendHit ?? 0.15, o.bend0 ?? 0.18, k), k: 1 - k }; }
  // a stab: the arm cocks back with the elbow folded, then thrusts straight along the aim, the blade in line with the forearm; the
  // thrust starts with no jerk and meets the aim at speed, then runs on a little and bleeds off: eased to a stop on the aim it popped
  function stab(e, E, GT, face, H, base, bend0, BACK = 1.3) {
    const ew = DATA.windOf(e, E.wind), u = GT - e.t0, aim = aimRig(e, face, H), imp = aim - Math.PI / 2, T = 0.15, P = 1.0, OVER = 0.5;
    const impN = BACK - (((BACK - imp) % TAU) + TAU) % TAU, vEnd = P * (BACK - impN) / T;
    if (e.st === 'wind') { const tc = ew - T;
      if (u < tc) { const k = SS(0, tc, u); return { r1: lerp(base, BACK, k), bend: lerp(bend0, 1.6, k), k, crouch: k, ang: null }; }
      const x = Math.min(1, (u - tc) / T), q = (3 - P) * x * x + (P - 2) * x * x * x; return { r1: lerp(BACK, impN, q), bend: lerp(1.6, 0.05, q), k: 1, crouch: 1 - q, ang: aim, angK: q }; }
    if (e.st === 'strike') { const fol = impN - OVER * (1 - Math.exp(-u * vEnd / OVER)), k = SS(0.08, 0.3, u); return { r1: lerp(fol, base, k), bend: lerp(0.05, bend0, k), k: 1 - k, crouch: 0, ang: aim, angK: 1 - k }; }
    return null;
  }

  // a spring's answer to a kick at time t0: the render can't integrate, so each event the sim timestamps adds its impulse response
  const hitFl = (u) => (u >= 0 ? SS(0, 0.12, u) * (1 - SS(0.16, 0.45, u)) : 0);
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

  // the smouldering skeleton (TASKS 411) runs bent forward, its arms swinging wide against its legs; with its
  // fuse lit it stands and throws them up and wide, shaking harder as the fuse burns down. Struck down, it keeps the pose it died
  // in (the run eases out with its speed): the bones fall or fly from there
  function emberPose(e, E, GT, face, base) {
    const live = e.deadT < 0, u = GT - e.t0, w = DATA.windOf(e, E.wind), lit = e.st === 'wind' ? SS(0, 0.22, u) : 0, q = e.st === 'wind' ? Math.min(1, u / w) : 0;
    const run = SS(10, 60, Math.hypot(base.vx, base.vy)) * (1 - lit), still = live ? 1 : 1 - SS(0, 0.1, GT - e.deadT);
    // (TASKS 460: the fuse burning down shakes it whole, arms and body, three times as hard at the end, and it ducks just before)
    const end = 1 - SS(w - 0.06, w, u), tremble = still * lit * (0.01 + 0.025 * q * q) * end * Math.sin(GT * (22 + 10 * q) + 0.6);
    base.lean = (base.lean || 0) + face * 0.16 * run + tremble; base.crouch += 5 * run + 4 * lit + 7 * (e.st === 'wind' ? lit * SS(w - 0.15, w, u) : e.st === 'strike' || !live ? 1 : 0);
    base.arm = (side, b) => { const sg = side === 'L' ? 1 : -1, shake = still * lit * (0.05 + 0.12 * q * q) * end * Math.sin(GT * (18 + 12 * q) + (side === 'L' ? 0 : 1.7));
      const r1 = lerp(lerp(b, 1.5 * b - 0.3, run), -2.55 + 0.25 * sg, lit) + shake; return [r1, r1 + lerp(lerp(0.18, 0.1 - 0.4 * b, run), 0.5, lit) + shake * 0.6]; };
  }

  // the imp (TASKS 407): a leap crouches, springs up with the legs tucked and the arms flung up and back, leaning into the flight,
  // and lands in a crouch; the spark is thrown overhand with the near arm, the claw rakes with it on a short swing
  const IMP_THROW = { raise: -2.7, chopT: 0.14, recover: 0.24, over: 0.6, top: 0.1, bendUp: 1.4, bendHit: 0.1, bend0: 0.18, dur: 0.32 };
  const IMP_CLAW = { raise: -1.5, chopT: 0.12, recover: 0.2, over: 0.5, top: 0.04, bendUp: 1.0, bendHit: 0.1, bend0: 0.18, dur: 0.32 };
  MON.impArc = (e, E, GT) => { if (e.st !== 'leap') return 0; const L0 = E.leap, fl = Math.max(0, Math.min(1, (GT - e.t0 - L0.crouch) / e.ld)), d = Math.hypot(e.ltx - e.lx, e.lty - e.ly);
    const q = fl * fl * (3 - 2 * fl); return 4 * (18 + L0.h * d) * q * (1 - q); };
  function impPose(e, E, GT, face, H, base) {
    const RG = RIGS.imp, u = GT - e.t0;
    // (the crouch eases out over the take-off and back in before the landing: dropped in a frame, the whole body popped)
    if (e.st === 'leap') { const L0 = E.leap, fl = Math.max(0, Math.min(1, (u - L0.crouch) / e.ld)), cr = u < L0.crouch ? SS(0, L0.crouch, u) : fl < 1 ? Math.max(1 - SS(0, 0.25, fl), SS(0.6, 1, fl)) : 1 - SS(0, L0.land, u - L0.crouch - e.ld);
      const air = fl > 0 && fl < 1 ? SS(0, 0.25, fl) * (1 - SS(0.6, 1, fl)) : 0, tuck = 0.16 * RG.h * air * (1 - 0.45 * SS(0.5, 0.9, fl)), z = MON.impArc(e, E, GT);
      base.y -= z + tuck * H / RG.h; base.crouch += tuck + 0.14 * RG.h * cr; base.lean = (base.lean || 0) + face * (0.35 * air * (1 - 1.5 * SS(0.2, 0.85, fl)) * (Math.cos(e.aimA) * face >= 0 ? 1 : -0.6) - 0.12 * cr);   // (a spring back leans back)
      base.arm = (side, b) => { const r = lerp(lerp(b, b + 0.4, cr), -1.6 + (side === 'L' ? 0.3 : 0) + 1.5 * SS(0.35, 0.9, fl) + 0.25 * Math.sin(fl * 9 + (side === 'L' ? 0 : 2)), air), k = Math.max(cr, air); return [r, r + lerp(0.18 - 0.4 * b, 0.3 + 0.4 * air, k)]; }; return; }
    if (e.st === 'wind' || e.st === 'strike') { const E2 = e.claw ? E : { wind: E.spark.wind }, CO = e.claw ? IMP_CLAW : IMP_THROW, pose = (b) => chop(e, E2, GT, face, H, b, CO), p0 = pose(0);
      if (p0) { base.crouch += 12 * p0.k; base.arm = (side, b) => { if (side === 'R') { const p = pose(b); return [p.r1, p.r1 + p.bend]; } return [b + 0.5 * p0.k, b + 0.2 + 0.3 * p0.k]; }; } }
  }
  // the magma golem (TASKS 409) heaves both fists over its head through the long wind-up and brings them down on the floor in
  // front of it, rests on them a beat; dead, it comes apart where it stands, stone by stone into its pool
  const GOLEM_SLAM = { raise: -2.6, chopT: 0.28, recover: 0.42, over: 0.15, hold: 0.24, top: 0.16, bendUp: 0.9, bendHit: 0.15, bend0: 0.18, dur: 0.55 };
  const COL_CALL = ['shatter', 'erupt', 'rain', 'imps'];
  function colossusPose(e, E, GT, face, H, base) {
    if (e.deadT >= 0) return null;
    const u = GT - e.t0, M = DATA.bossMove(e), w = M.wind;
    const target = (side, p, rest, k) => [lerp(rest[0], base.x + face * p[0] * H, k) + face * (side === 'L' ? -0.22 : 0.22) * H * Math.sin(Math.PI * k), lerp(rest[1], base.y + p[1] * H, k)];
    if (e.st === 'emerge' || e.st === 'wade') {
      const k = e.st === 'emerge' ? SS(0, 0.55, u) : 1 - SS(0, 0.8, u);
      base.lean = (base.lean || 0) - face * 0.3 * k;
      base.handTarget = (side, rest) => target(side, [side === 'L' ? -0.18 : 0.55, -1.02], rest, k);
      return null;
    }
    const stuck = e.mv === 'fists' && e.openUntil !== undefined && GT < e.openUntil + 0.4;
    const crackBack = e.mv === 'crack' && u < w + M.duration + 0.4;
    if ((e.st === 'bwind' || stuck || crackBack) && (e.mv === 'fists' || e.mv === 'crack')) {
      const fists = e.mv === 'fists', end = fists ? (e.openUntil || e.t0 + w + M.duration + M.stuck) : e.t0 + w + M.duration;
      const back = SS(end, end + 0.4, GT), raise = SS(0, w * 0.6, u), hit = SS(w - 0.28, w, u), k = raise * (1 - back);
      const tug = fists && GT > e.t0 + w + M.duration ? Math.pow(Math.sin((GT - e.t0 - w - M.duration) * Math.PI / 0.4), 8) : 0;
      base.crouch += (85 * hit - 3 * tug) * (1 - back);
      base.lean = face * lerp(-0.16 * raise, 0.6 - 0.035 * tug, hit) * (1 - back);
      base.handTarget = (side, rest) => {
        if (!fists && side === 'L') return target(side, [-0.2, -0.35], rest, k);
        const p = DATA.colossusContact(e, side), floor = [(p.x - e.x) / (face * E.h), (p.y - e.y) / E.h - 0.11];
        return target(side, [lerp(side === 'L' ? -0.12 : 0.22, floor[0], hit) + (side === 'L' ? -0.3 : 0.2) * Math.sin(Math.PI * hit), lerp(-0.92, floor[1], hit)], rest, k);
      };
      return null;
    }
    if (e.st !== 'bwind') {
      if (e.mv === 'charge' && u < w + M.duration + 0.14) base.gaitK = SS(w + M.duration, w + M.duration + 0.14, u);
      return null;
    }
    if (e.mv === 'boulder') {
      const dig = 1 - SS(w * 0.34, w * 0.78, u), grab = SS(0, w * 0.34, u), toss = SS(w * 0.78, w, u), back = SS(w, w + M.duration, u);
      base.crouch += 85 * dig * grab;
      base.lean = face * (0.6 * dig * grab - 0.12 * (1 - dig) * (1 - toss) + 0.3 * toss) * (1 - back);
      base.rock = !e.fired; base.rockBuried = (1 - grab) * 0.35 * H;
      const px = lerp(-0.05, 0.3, toss), py = lerp(-0.82, -0.9, toss);
      base.rockAt = [lerp(0.2, px, 1 - dig), lerp(-0.16, py, 1 - dig)];
      base.handTarget = (side, rest) => target(side, [base.rockAt[0] + (side === 'L' ? lerp(0.02, -0.18, SS(0.55, 0.98, 1 - dig)) : 0.075), base.rockAt[1] + 0.05], rest, grab * (1 - back));
      return null;
    }
    if (e.mv === 'charge') {
      const end = w + Math.max(M.time, M.duration), k = SS(0, Math.min(0.3, w), u) * (1 - SS(end - 0.25, end, u));
      base.lean = (base.lean || 0) + face * 0.22 * k; base.crouch += 14 * k;
      base.strideK = 1.45; base.lift = 0.065;
      base.gaitK = SS(w, w + 0.12, u) * (1 - SS(end - 0.12, end, u));
      return (side, b) => [lerp(b, 0.7, k * 0.65), lerp(b + 0.18, 1.1, k * 0.65)];
    }
    if (COL_CALL.includes(e.mv)) {
      const end = w + M.duration, k = SS(0, Math.min(0.45, w * 0.6), u) * (1 - SS(end - 0.25, end, u)), pulse = Math.sin(u * 9) * k;
      base.lean = (base.lean || 0) - face * (0.14 * k + 0.025 * pulse); base.crouch += 3 * pulse;
      base.handTarget = (side, rest) => target(side, [side === 'L' ? -0.25 : 0.35, -0.83 - 0.04 * Math.sin(u * 9 + (side === 'L' ? 0 : 1))], rest, k);
    }
    return null;
  }

  // ---------------- per type ----------------
  // o: { id, H, face, lean, crouch, fallR, U, Ufar, t }
  MON.draw = (e, E, x, y, GT, o) => {
    const n = MON.rigOf(e.type); if (!n) return false; const face = o.face, H = o.H, live = e.deadT < 0;
    const base = { item: {}, id: o.id, seed: e.id, n, tex: o.tex, x, y, face, H, dist: e.dist, vx: e.vx * (live ? 1 : 1 - SS(0, 0.15, GT - e.deadT)), vy: e.vy * (live ? 1 : 1 - SS(0, 0.15, GT - e.deadT)), lean: o.lean, crouch: o.crouch || 0, fallR: o.fallR, U: o.U, Ufar: o.Ufar, t: o.t, spd0: e.spd0, vxn0: e.vxn0, vyn0: e.vyn0, t0: e.t0 };
    // the knees give as it dies: on the spot first for the variants that sink before they fall, as the fall starts for the rest
    if (!live && n !== 'colossus' && o.death && o.death.buckle && RIGS[n].hipL) { const D0 = o.death, dd = GT - e.deadT; base.crouch += D0.buckle * 0.22 * RIGS[n].h * SS(0, Math.max(0.15, D0.dl), dd); }
    if (n === 'skeleton' || n === 'goblin') {
      // cut from the approved drawing: its pose is the rest pose, the weapon and shield are part of the forearms
      const RG = RIGS[n], bomb = e.type === 'skel_ember'; base.wSide = 'L';
      // the skeleton chops overhead, the goblin coils and stabs along the aim
      const pose = (b) => !live || bomb ? null : n === 'skeleton' ? chop(e, E, GT, face, H, b, Object.assign({ blade: RG.bladeL }, CHOP.skeleton))
        : stab(e, E, GT, face, H, b, 0, 0.7);
      const p0 = pose(0);
      if (p0) { if (n === 'goblin') base.crouch += 22 * p0.crouch;
        base.arm = (side, b) => { if (side === 'L') { const p = pose(b); return [p.r1, p.r1 + p.bend]; } const g = -0.3 * p0.k; return [b + g, b * 0.6 + g * 0.5]; }; }
      if (n === 'goblin') base.ear = earKick(e, GT, p0, live);
      // a skeleton dies one of three ways, picked by its id: a heap, bones flung off by the blow, or a fall that breaks apart
      if (bomb) emberPose(e, E, GT, face, base);
      // a smouldering skeleton that went off flings its bones every way
      if (n === 'skeleton' && !live) { const kind = e.blown ? 'burst' : ['pile', 'burst', 'topple'][e.id % 3]; base.crumble = { t: GT - e.deadT, kind, dir: e.dieA }; if (kind !== 'topple') base.fallR = 0; }
      const r = biped(base); if (!bomb || !live) return true;
      // where its fire burns (TASKS 411): the skull, the ribs, the pelvis and both hands, for the scene's flames
      const P = (p) => (L.pre ? M.ap(L.pre, p) : p); r.fire = [r.head, r.chest, r.hip, r.R2U(r.arms.L.Hd[0], r.arms.L.Hd[1]), r.R2U(r.arms.R.Hd[0], r.arms.R.Hd[1])].map(P); return r; }
    if (n === 'skel_archer') {
      // the bow arm (R, near) swings up to point along the aim and holds the bow across it; the string hand (L) reaches the string
      // at the grip and draws it back to the jaw through the wind-up, the arrow nocked on it; on the loose the string snaps home,
      // the hand flies back a little and the arms come down. At rest the bow hangs from the hand along the forearm
      const RG = RIGS[n], u = GT - e.t0, ew = DATA.windOf(e, E.wind), a = e.aimA || 0, aimR = face > 0 ? a : Math.PI - a;
      const k = !live ? 0 : e.st === 'wind' ? SS(0, Math.min(0.3, ew * 0.4), u) : e.st === 'strike' ? 1 - SS(0.1, 0.3, u) : 0;
      const pull = live && e.st === 'wind' ? SS(Math.min(0.3, ew * 0.4) * 0.6, ew - 0.06, u) : 0, snap = live && e.st === 'strike' ? 1 - SS(0, 0.05, u) : 0, fly = live && e.st === 'strike' ? Math.sin(Math.PI * SS(0, 0.22, u)) : 0;
      const dR = ang(RG.shR, RG.handR), rB = aimR - dR, dir = [Math.cos(aimR), Math.sin(aimR)], BH = rotP(RG.handR, RG.shR, rB), drawL = 0.36 * RG.h;
      const T = [BH[0] - dir[0] * (10 + drawL * Math.max(pull, snap) + 18 * fly), BH[1] - dir[1] * (10 + drawL * Math.max(pull, snap) + 18 * fly) + 6];
      const ik = k > 0 ? reach(RG, 'L', T, -1) : null;
      base.wSide = 'R'; base.item = { ang: aimR + Math.PI / 2, angK: k, off: 1.15, mirror: 1 };
      if (k > 0) base.arm = (side, b) => side === 'R' ? [lerp(b, rB, k), lerp(b + 0.18, rB, k)] : [lerp(b, ik[0], k), lerp(b + 0.18, ik[1], k)];
      if (!live) { const kind = ['pile', 'burst', 'topple'][e.id % 3]; base.crumble = { t: GT - e.deadT, kind, dir: e.dieA }; if (kind !== 'topple') base.fallR = 0; }
      const r = biped(base), bow = r.items.R;
      if (!bow || !live) return true;
      const top = itemAt(bow, 0.12, 0.02), bot = itemAt(bow, 0.09, 0.98), hd = r.R2U(r.arms.L.Hd[0], r.arms.L.Hd[1]), hand = L.pre ? M.ap(L.pre, hd) : hd;
      // the arrow lies on the string from the nock forward while it is drawn
      if (e.st === 'wind' && k > 0.5) { const sa = Math.atan2(Math.sin(aimR), Math.cos(aimR) * face), aw = 0.42 * H * G.tex('skel_arrow').w / G.tex('skel_arrow').h;
        L.sprite('skel_arrow', 0, 0, { m: M.of(M.t(hd[0], hd[1]), M.r(sa + Math.PI / 2)), w: aw, h: 0.42 * H, pivot: [aw / 2, 0.42 * H * 0.96], u: o.U }); }
      // the string: two straight runs to the hand while it holds it, else one from nock to nock
      if (!L.sp) { const held = e.st === 'wind' && k > 0.5, col = [0.62, 0.58, 0.5], seg = (p, q) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]), a = Math.atan2(q[1] - p[1], q[0] - p[0]); L.solid(p[0], p[1], d, 3, [0.025, 0.02, 0.02], a, 0, 1.5, o.U.alpha ?? 1); L.solid(p[0], p[1], d, 1.6, col, a, 0, 0.8, (o.U.alpha ?? 1) * 0.95); };
        if (held) { seg(top, hand); seg(hand, bot); } else seg(top, bot); }
      L.joint(o.id, 'nockT', top); L.joint(o.id, 'nockB', bot); return true; }
    if (n === 'skel_mage') {
      // the staff (L, far hand) stands upright at rest and is raised and tipped toward the aim through the cast; the free hand (R)
      // draws back, gathers the water and thrusts it at the aim on the strike's first frame
      const RG = RIGS[n], u = GT - e.t0, ew = DATA.windOf(e, E.wind), a = e.aimA || 0, aimR = face > 0 ? a : Math.PI - a;
      const k = !live ? 0 : e.st === 'wind' ? SS(0, ew * 0.6, u) : e.st === 'strike' ? 1 - SS(0.1, 0.3, u) : 0;
      const push = !live ? 0 : e.st === 'wind' ? SS(ew - 0.16, ew, u) : e.st === 'strike' ? 1 - SS(0.05, 0.3, u) : 0, back = e.st === 'wind' ? SS(0, ew * 0.7, u) * (1 - push) : 0;
      const sway = 0.04 * Math.sin(GT * 1.3 + e.id);
      base.wSide = 'L'; base.item = { ang: Math.PI / 2 + sway - 0.35 * k, angK: 1, mirror: 1 };
      const dR = ang(RG.shR, RG.handR), rPush = aimR - dR;
      base.arm = (side, b) => side === 'L' ? [b - 0.55 * k, b - 0.55 * k + lerp(0.18, -0.6, k)] : [lerp(b + 0.7 * back, rPush, push), lerp(b + 0.18 + 1.3 * back, rPush, push)];
      if (!live) { const kind = ['pile', 'burst', 'topple'][e.id % 3]; base.crumble = { t: GT - e.deadT, kind, dir: e.dieA }; if (kind !== 'topple') base.fallR = 0; }
      const r = biped(base), st = r.items.L, hd = r.R2U(r.arms.R.Hd[0], r.arms.R.Hd[1]);
      if (st) { const pearl = itemAt(st, 0.6, 0.06); L.joint(o.id, 'pearl', pearl); r.pearl = pearl; }
      L.joint(o.id, 'palm', L.pre ? M.ap(L.pre, hd) : hd);
      return Object.assign(r, { palm: L.pre ? M.ap(L.pre, hd) : hd, gather: live && e.st === 'wind' ? SS(0, ew, u) : 0 }); }
    if (n === 'drowned') {
      // a shamble: hunched forward, short dragging steps; it climbs out of the water arms first (o.rise 0..1)
      base.lean += 0.12 * face; base.lift = 0.042;
      const u = GT - e.t0, G0 = E.grab;
      if (live && e.grab && (e.st === 'wind' || e.st === 'strike')) {
        // the grab: the near arm cocks back with the elbow folded, shoots out along the aim, holds, then hauls back clenched if it
        // caught the hero (the sim's gotT on this strike) or drops back empty
        const gw = DATA.windOf(e, G0.wind), aimN = aimRig(e, face, H) - Math.PI / 2, got = e.st === 'strike' && Math.abs((e.gotT ?? -9) - e.t0) < 0.02;
        // the thrust spans the wind-up's end: the hand closes as the sim's grab lands (the strike's first frame) and reaches on 0.15 s
        const T = e.st === 'wind' ? u : gw + u, k = SS(0, gw - 0.15, T), x = SS(gw - 0.15, gw + 0.15, T), y = e.st === 'strike' ? SS(0.14, got ? 0.4 : G0.strike, u) : 0;
        const z = got && e.st === 'strike' ? SS(0.38, G0.strike, u) : 0, back = 0.45, thrust = (b) => lerp(b + back * k, aimN, x);   // z: the haul eased back to rest by the strike's end
        base.lean += (-0.1 * k + 0.16 * x - (got ? 0.22 : 0.05) * y) * (1 - z) * face;
        base.arm = (side, b) => { if (side === 'L') return [b - 0.35 * k * (1 - y), b - 0.35 * k * (1 - y) + 0.18];
          const r1 = lerp(thrust(b), got ? b + 0.35 : b, y), r2 = r1 + lerp(lerp(0.18, 1.4, k), 0.05, x) + (got ? 1.3 : 0.13) * y; return [lerp(r1, b, z), lerp(r2, b + 0.18, z)]; };
      } else if (live && (e.st === 'wind' || e.st === 'strike')) {
        // the blow: both fists raised overhead together, brought down on the hero, the body dropping with them
        const CO = { raise: -2.5, chopT: 0.2, recover: 0.31, over: 0.25, hold: 0.1, top: 0.14, bendUp: 0.7, bendHit: 0.3, bend0: 0.18 };
        const p = chop(e, E, GT, face, H, 0, CO);
        if (p) { const hit = e.st === 'strike' ? u : -1; base.crouch += 18 * (hit >= 0 ? SS(0, 0.06, hit) * (1 - SS(0.2, 0.32, hit)) : 0); base.lean += 0.18 * p.k * (e.st === 'strike' ? 1 : SS(0.6, 1, u / Math.max(0.05, E.wind))) * face;
          base.arm = (side, b) => { const q = chop(e, E, GT, face, H, b, CO), d = side === 'L' ? -0.14 * q.k : 0; return [q.r1 + d, q.r1 + q.bend + d]; }; }
      } else if (live && (e.st === 'rise' || e.st === 'lurk')) {
        const k = o.rise ?? 1;   // arms up out of the water first, lowered as it stands
        base.lean += 0.18 * (1 - k) * face;
        base.arm = (side, b) => { const r = lerp(-2.3 + (side === 'L' ? 0.25 : 0), b, SS(0.45, 1, k)); return [r, r + lerp(0.5, 0.18, SS(0.45, 1, k))]; };
      }
      biped(base); return true; }
    if (n === 'crab') {
      const u = GT - e.t0, R0 = E.rush, ew = DATA.windOf(e, e.rush ? R0.wind : E.wind), Hh = H;
      const c = Object.assign(base, { fa: e.fa ?? (face > 0 ? 0 : Math.PI), trail: e.crabTrail });
      // a blow off the armour drives the claws back (they took it); one past it rocks the shell back
      const hA = GT - (e.armT ?? -9), ra = hA >= 0 ? SS(0, 0.1, hA) * (1 - SS(0.16, 0.45, hA)) : 0, rb = Math.abs((e.hitT ?? -9) - (e.armT ?? -9)) > 1e-6 ? ring(GT, e.hitT, 1, 4, 0.22) : 0;
      c.bx = -0.08 * Hh * rb; let P = () => ({});
      // at rest the claws now and then click: the finger opens a little and snaps back
      const ck = (GT + e.id * 1.7) % (3.4 + (e.id % 3)), click = ck < 0.36 ? Math.sin(Math.PI * ck / 0.36) ** 2 : 0;
      if (!live) { const dd = GT - e.deadT, q = SS(0, 0.5, dd); c.curl = q; c.dead = dd; P = () => ({ u: -0.08 * Hh * q, v: 0.12 * Hh * q, z: -0.12 * Hh * q, open: 0.7 * q, in: 0.55 - 0.7 * q }); }
      else if (e.rush && (e.st === 'wind' || e.st === 'strike')) {
        // the rush: it drops low on spread legs, claws drawn in tight before its face, and scuttles sideways; it rises as it stops
        const k = e.st === 'wind' ? SS(0, ew, u) : 1 - SS(R0.t, R0.t + 0.2, u); c.low = k;
        if (e.st === 'strike') { const g = SS(R0.t, R0.t + 0.2, u); c.vx *= g; c.vy *= g; }   // it skates on spread legs, no steps, until it stops
        P = () => ({ u: -0.06 * Hh * k, v: -0.08 * Hh * k, z: -0.04 * Hh * k, open: 0, in: 0.55 + 0.2 * k }); }
      else if (e.st === 'wind' || e.st === 'strike') {
        // the pinch: both claws rise and spread open through the wind-up; the one on the hero's side shoots out and snaps shut on
        // the strike's first frame, the other jabs half as far, then they settle back
        const rel = Number.isFinite(e.tx) ? Math.atan2(e.ty - e.y, e.tx - e.x) - c.fa : 0, near = Math.sin(rel) >= 0 ? 1 : -1;
        const k = e.st === 'wind' ? SS(0, ew, u) : 1, wl = ew + SIM.DT, T = e.st === 'wind' ? u - wl : u, x = SS(-0.1, 0.1, T), back = e.st === 'strike' ? SS(0.14, 0.32, u) : 0;   // the thrust spans the wind-up's end
        P = (side) => { const m = side === near ? 1 : 0.5, j = x * (1 - back) * m, r = k * (1 - back);
          return { u: -0.04 * Hh * r * (1 - x) + 0.2 * Hh * j - 0.06 * Hh * ra, v: 0.07 * Hh * r * (1 - x) - 0.06 * Hh * j, z: 0.2 * Hh * r * (1 - x) + 0.05 * Hh * j, open: r * (1 - x), in: 0.55 - 0.6 * r * (1 - x) - 0.1 * j }; }; }
      else P = (side) => ({ u: -0.06 * Hh * ra + 0.012 * Hh * Math.sin(GT * 1.6 + side + e.id), z: 0.01 * Hh * Math.sin(GT * 1.3 + side * 2 + e.id), open: 0.35 * click * (side > 0 ? 1 : 0.6) });
      c.calm = !live || e.st === 'idle' || e.st === 'home' ? 1 : 0; c.claws = P; crab(c); return true; }
    if (n === 'spider') {
      base.crown = e.type === 'boss_spider';
      const ew = DATA.BOSSES[e.type] ? DATA.bossMove(e).wind : DATA.windOf(e, E.wind), u = GT - e.t0;
      // it rears up through the wind-up (front legs raised at the hero), stays up through the lunge, settles after it
      base.rear = !live ? 0 : e.st === 'bwind' ? (e.mv === 'weave' ? SS(0, Math.min(0.3, ew), u) * (0.6 + 0.15 * Math.sin(u * 12)) * (1 - SS(ew + DATA.bossMove(e).duration - 0.3, ew + DATA.bossMove(e).duration, u)) : SS(0, ew, u) * (1 - SS(ew, ew + 0.4, u))) : e.st === 'wind' ? SS(0, ew, u) : e.st === 'strike' ? 1 - SS(0.24, 0.45, u) : 0;
      // it dies one of two ways, picked by its id: the legs draw in under it where it stands, or they fold and it turns onto its back
      const back = e.id % 2 === 0, dd = GT - e.deadT;
      base.curl = live ? 0 : SS(0, back ? 0.15 : 0.4, dd); base.aimX = Math.cos(e.aimA) * face;
      if (!live && back) { base.dead = dd; base.flip = SS(0.1, 0.5, dd); }   // the legs fold in first, then it turns over with them
      if (live && e.st === 'strike') { const g = SS(0.3, 0.45, u); base.vx *= g; base.vy *= g; }   // the lunge is a body thrust, legs trailing: no gait until it lands
      spider(base); return true; }
    if (n === 'cultist') {
      const ew = DATA.BOSSES[e.type] ? DATA.bossMove(e).wind : DATA.windOf(e, E.wind), u = GT - e.t0, wind = live && (e.st === 'wind' || e.st === 'bwind'), str = live && e.st === 'strike';
      // the staff tips forward through the wind-up; the free hand thrusts at the aim, fully out on the shot frame (the strike's first)
      const settle = DATA.BOSSES[e.type] && e.st === 'bwind' ? 1 - SS(ew, ew + DATA.bossMove(e).duration, u) : 1;
      base.staff = wind ? -0.35 * SS(0, ew * 0.8, u) * settle : str ? -0.35 * (1 - SS(0.1, 0.32, u)) : 0;
      base.push = wind ? SS(ew - 0.14, ew, u) * settle : str ? 1 - SS(0.08, 0.32, u) : 0; base.aimR = aimRig(e, face, H) - 0.1;
      // the fire priest (TASKS 410) wears its own crimson; lighting its allies' weapons it raises the staff and its open hand high
      if (e.type === 'fire_priest') { base.tex = 'priest'; const kw = DATA.windOf(e, E.kindle.wind), kin = live && e.kin && e.st === 'wind' ? SS(0, kw * 0.7, u) : live && e.st === 'strike' && e.kinS ? 1 - SS(0.1, 0.32, u) : 0;
        if (kin > 0) { base.staff = lerp(base.staff, -0.55, kin); base.push = Math.max(base.push, kin); base.aimR = lerp(base.aimR, -Math.PI / 2 - 0.3, kin); } }
      // the robe sinks onto the hem first (dl s), then the body lies down, half filling out again
      if (!live && o.death && o.death.sink) { const dd = GT - e.deadT, D0 = o.death; base.sink = 0.55 * SS(0, D0.dl, dd) * (1 - 0.5 * SS(D0.dl, D0.dl + D0.dur, dd)); }
      const r = robed(base); if (e.type === 'fire_priest' && live) r.priest = 1; return r; }
    if (n === 'brute') {
      const boss = !!DATA.BOSSES[e.type], move = boss ? DATA.bossMove(e) : null, w = move ? move.wind : 0;
      const linked = boss && e.mv === 'charge' && move.next === 'slam';
      const ready = live && linked && (e.st === 'bwind' || e.nextMove === 'slam');
      // fists on the floor and the body down for a beat on the slam, a beat at the top of the raise; a cast (not a slam or a
      // charge) raises through its whole wind instead: its raise is long, a hold at the top would make it hurry
      const cast = boss && e.mv !== 'slam' && e.mv !== 'charge';
      const CO = { raise: -2.6, chopT: boss ? Math.min(0.26, w) : 0.26, recover: 0.32, over: 0.15, hold: 0.14, top: cast ? 0 : 0.12, bossW: w, dur: boss ? move.duration : 0.4 };
      const CO2 = Object.assign({}, CO, { hold: 0.02 });   // the chained slam springs back at once: its follow-through overshoots deeper, and the recovery needs that room
      const top = (b) => chop(Object.assign({}, e, { st: 'bwind' }), E, e.t0 + w - CO.chopT, face, H, b, CO);   // the frozen pose at the top of the raise
      const pose = (b) => { if (!live) return null;
        if (ready) { const q = top(b), k = SS(0, w, GT - e.t0); return { r1: lerp(b, q.r1, k), bend: lerp(0.18, q.bend, k), k }; }
        // the raised ready pose has two exits and neither may snap: a landed charge hands the arms to the walk (their bend target
        // 0.18 - 0.4b is exactly the pose biped draws by itself); a chained slam hands over to the slam's own swing, which starts
        // from the same raised pose and accelerates from rest, so chop's arc alone carries it
        if (linked && e.st === 'chase') { const out = SS(0, 0.3, GT - (e.cdT - (DATA.bossPhase(e).rest || 0))), q = top(b);
          if (q && out < 1) return { r1: lerp(q.r1, b, out), bend: lerp(q.bend, 0.18 - 0.4 * b, out), k: 1 - out };
          return null; }
        return chop(e, E, GT, face, H, b, boss && e.chain && e.mv === 'slam' ? CO2 : CO);
      };
      const p = pose(0);
      if (p) { const u = GT - e.t0, hit = ready ? -1 : e.st === 'strike' ? u : e.st === 'bwind' ? u - w : -1; base.crouch += 22 * (hit >= 0 ? SS(0, 0.07, hit) * (1 - SS(0.2, 0.32, hit)) : 0);
        base.arm = (side, b) => { const q = pose(b), d = side === 'L' ? 0.12 * q.k : 0; return [q.r1 + d, q.r1 + q.bend + d]; }; }
      biped(base); return true; }
    if (n === 'imp') { if (live) impPose(e, E, GT, face, H, base); base.lift = 0.06; base.swingK = 0.5; return biped(base); }
    if (n === 'golem') { const pose = (b) => live ? chop(e, E, GT, face, H, b, GOLEM_SLAM) : null, p = pose(0);
      if (p) { const u = GT - e.t0, hit = e.st === 'strike' ? u : -1; base.crouch += 26 * (hit >= 0 ? SS(0, 0.07, hit) * (1 - SS(0.3, 0.5, hit)) : 0.25 * p.k);
        // the fists come down on the floor where the slam lands, side by side, rest there and come home to the walk's own hang (TASKS 458):
        // swung by the chop's angle alone the far one went on past the body and lay behind the golem
        const w = DATA.windOf(e, E.wind), O = GOLEM_SLAM, k = e.st === 'strike' ? 1 - SS(O.hold, O.dur, u) : SS(w - O.chopT, w, u);
        base.arm = (side, b) => { if (e.st === 'strike') return [b, b + 0.18 - 0.4 * b]; const q = pose(b), d = side === 'L' ? 0.1 * q.k : 0; return [q.r1 + d, q.r1 + q.bend + d]; };
        if (k > 0) base.handTarget = (side) => { const at = E.slam.at; return [base.x + Math.cos(e.aimA) * at / E.h * H + (side === 'L' ? -0.1 : 0.1) * H, base.y + (Math.sin(e.aimA) * at * 0.8 / E.h - 0.05) * H, k]; }; }
      base.plates = { n: e.crust ?? E.crust.n, T: e.plateT, A: e.plateA, G: e.plateG, GT };
      if (!live) { base.crumble = { t: GT - e.deadT, kind: 'pile', dir: e.dieA }; base.fallR = 0; }
      base.lift = 0.04; base.narrow = 0.2; return biped(base); }
    if (n === 'colossus') {
      const pose = !live && e.deathPose ? e.deathPose : e, clock = live ? GT : e.deadT;
      if (!live) { base.t = o.t - (GT - e.deadT); base.vx = pose.vx; base.vy = pose.vy;
        base.spd0 = pose.spd0; base.vxn0 = pose.vxn0; base.vyn0 = pose.vyn0; base.t0 = pose.t0;
        const w = DATA.bossMove(pose).wind, u = clock - pose.t0, ha = clock - pose.hitT, fl = ha >= 0 ? SS(0, 0.08, ha) * (1 - SS(0.12, 0.32, ha)) : 0;
        base.lean = -face * (0.08 * (pose.st === 'bwind' ? SS(0, w, u) * (1 - SS(w, w + 0.15, u)) : 0) + 0.14 * fl);
        base.crouch = 6 * fl + 24 * SS(0, 0.65, GT - e.deadT); }
      const arm = colossusPose(pose, E, clock, face, H, base); if (arm) base.arm = arm;
      if (!live) { base.crumble = { t: Math.max(0, GT - e.deadT - 0.55) / 2.4, kind: 'pile', dir: e.dieA }; base.fallR = 0; }
      // (a body of 230 px sinks at each step by more than the walkers' 2.2 px, or its stride reads as a glide)
      base.lift = base.lift || 0.04; base.narrow = 0.15; base.bob = 5; base.stanceTime = base.strideK ? 0.5 : 0.64; base.settle = base.strideK ? 0 : 4; const r = biped(base);
      // the boulder in both hands over the head while it is lifted, gone from them on the throw (sim R.rocks takes it on)
      if (base.rock && r) {
        const at = [x + face * base.rockAt[0] * H, y + base.rockAt[1] * H + base.rockBuried], bw = 0.42 * H, bh = bw * G.tex('boulder_mg_a').h / G.tex('boulder_mg_a').w;
        if (!live) at[1] = Math.min(y - bh * 0.4, at[1] + 450 * (GT - e.deadT) ** 2);
        L.joint(o.id, 'rock', L.pre ? M.ap(L.pre, at) : at);
        const visible = Math.max(0, Math.min(1, (y - at[1] + bh * 0.6) / bh));
        if (visible > 0 && !o.tex) L.inked(() => L.sprite('boulder_mg_a', 0, 0, { m: M.t(...at), w: bw, h: bh * visible, src: [0, 0, 1, visible], pivot: [bw / 2, bh * 0.6], u: o.U }), { r: 2, n: 8, col: [0.024, 0.02, 0.024], dy: 0 });
      }
      return r; }
    if (n === 'salamander') { const u = GT - e.t0, B = E.breath, bw = DATA.windOf(e, e.br ? B.wind : E.wind), w = live && e.st === 'wind' ? SS(0, bw, u) : 0, str = live && e.st === 'strike';
      const sw = !live ? 0 : o.swim || 0, dd = live ? -1 : GT - e.deadT;
      return lizard({ id: o.id, x, y, H, fa: e.fa ?? (face > 0 ? 0 : Math.PI), dist: e.dist, vx: base.vx, vy: base.vy, t: o.t, seed: e.id, U: o.U, Ufar: o.Ufar, tex: o.tex, swim: sw,
        lunge: e.br ? (str ? 0.35 * SS(0, 0.08, u) * (1 - SS(B.t - 0.15, B.t, u)) : 0) : -0.4 * w + (str ? -0.4 * (1 - SS(0, 0.08, u)) + 1.2 * SS(0, 0.1, u) * (1 - SS(0.15, 0.32, u)) : 0), curl: dd >= 0 ? SS(0, 0.5, dd) : 0, flinch: live ? hitFl(GT - (e.hitT ?? -9)) : 0,
        inhale: e.br ? (str ? 1 - SS(0, 0.25, u) : w) : 0, exhale: e.br && str ? Math.min(1, u / B.t) : -1 }); }   // (the breath let go over 0.25 s, not in a frame)
    return false;
  };
})();
