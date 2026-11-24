// live/scene_folk.js — the townsfolk: their cut-out rigs, poses at work and on their rounds, their dust.
// One of the scene's files (ARCHITECTURE.md §4.2): names from earlier files come from SCX at load, calls into later ones go through SCX.
(function (root) {
  const SCX = root.SCX;
  const {
    D, L, M, SS, SZ, TOWN_FACE, rnd } = SCX;
  const FOLK0 = (m) => D.folkInit(m.town.npcs);
  const lerp1 = (a, b, k) => a + (b - a) * k, lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], E01 = (q) => { q = Math.max(0, Math.min(1, q)); return q * q * (3 - 2 * q); };
  const bump01 = (u, a, b) => (u <= a || u >= b ? 0 : Math.sin(Math.PI * (u - a) / (b - a)) ** 2);
  const JOINT_W = 0.02;
  // a walker turns like a paper figure: the width of the parts (floored at FOLK_TURN.minW, so none goes edge-on) and of the joints (floored
  // only off the IK's zero divide) for the way he faces and how far his turn has come (0 just flipped, 1 done)
  const turnWidths = (face, turnK) => { const turnW = turnK < 1 ? face * (turnK * 2 - 1) : face, floorW = (w) => (Math.abs(turnW) < w ? face * Math.sign(turnW * face || 1) * w : turnW);
    return { rigFace: floorW(D.FOLK_TURN.minW), jointW: floorW(JOINT_W) }; };
  // a hen's pecking: one peck a cycle at rate rad/s (sharp: how short the dip is), quicker at the grain; between pecks the neck looks
  // about (glance, rad of neck at glanceRate rad/s), so it is never still for long
  const HEN_PECK = { rate: 2.6, sharp: 5, fed: { rate: 3.4, sharp: 3 }, glance: 0.14, glanceRate: 1.9 }, HEN_PECK_PERIOD = 2 * Math.PI / HEN_PECK.rate;
  // the guard's weight shift in his work loop: the body's sway (rad) and the knees' give (px) twice a loop; the enchanter bent over the
  // book: the head forward (lean), down (dip) and after the turned page (page), the shoulders hunched (hunch), all rig px. The head
  // already sinks with the hunch (0.8 of the lift's 5 px); dip only brings it a px below the shoulders, so it bows, not sinks in
  const GUARD_WORK = { lean: 0.06, knee: 2 }, ENCHANTER_WORK = { lean: 10, dip: 2, page: 5, hunch: 4 };
  // a walker's hands and tools blend from their work pose at a stop into the walk over this far from the stop behind and the one ahead (world px)
  const FOLK_AWAY_CLEAR = 30;
  const awayFromStops = (f, route, stop) => { if (!stop || !f.go) return 0; const prev = route[(f.way + route.length - 1) % route.length];
    return Math.min(SS(0, FOLK_AWAY_CLEAR, Math.hypot(f.x - prev.x, f.y - prev.y)), SS(0, FOLK_AWAY_CLEAR, Math.hypot(f.x - stop.x, f.y - stop.y))); };
  // the guard's look over the yard: its window in the work loop (from, span; it eases in and out over ramp), the head's sweep and the body's shift (rad)
  const GUARD_LOOK = { from: 0.52, span: 0.18, ramp: 0.05, head: 0.4, body: 0.07 };
  // a hen's wings, two short strokes off its back (view px), raised by `lift` rad at most and beating at `rate` rad/s; `rest` the share
  // of the lift they keep at the bottom of a beat; `fast` the speed range over which a running hen comes to beat them
  const HEN_FLAP = { scare: 0.4, hop: 3, fast: [45, 70], rate: 30, lift: 1.1, rest: 0.35, min: 0.02, w: 7, h: 3, rootY: 0.5, nearRoot: 2, farRoot: -1, farPhase: 1.3 };
  // the legs step along the gait's eased heading (the sim's f.hx, f.hy, TASKS 2136) at the walker's speed
  const gaitV = (f) => { const v = Math.hypot(f.vx, f.vy); return f.hx === undefined || !v ? { vx: f.vx, vy: f.vy } : { vx: f.hx * v, vy: f.hy * v }; };
  // the stone the mason takes leaves the cart's box at its near rim, where the cart stands (TASKS 2141: it rose from a point off his own
  // body, behind the cart he stood in)
  const cartRim = (m, R, sx, sy) => { const c = D.cartAt(SCX.railPts(m), (R.cart || {}).s ?? 1e9); return [sx(c.x), sy(c.y) - D.CART.rim.cart_tw * SZ('cart_tw')[1]]; };
  const TOOL = (tex, grip, o) => Object.assign({ tex, len: SZ(tex)[1], grip }, o);
  // one townsperson (TASKS 1015): a work loop on its own clock (DATA.folkClock, shared with the sim's events), the walk of a round,
  // and the talk: turned to the hero, head up, the free hand gesturing, eased in and out of the work pose. Hands are placed by IK on
  // screen points; the tool rides the hand. The loop's moments (the blow, the poke, the throw) leave their effects in RIM.folk
  function drawFolk(f, n, m, R, GT, Y, sx, sy) {
    const i = f.i, FD = D.FOLK[f.role], X = sx(f.x), Yg = sy(f.y), id = 'npc' + i;
    if (f.role === 'hen') { const nm = D.folkSprite(f), RG = RIGS[nm]; if (!RG || !window.ASSETS[nm + '_w']) return;
      // (TASKS 1032) a hen walks with a bob and a rock, its neck out; at the grain it pecks quicker; startled, the tail flicks up
      const run = SS(2, 24, Math.hypot(f.vx, f.vy)), fed = R.grain && GT - R.grain.t < 7 && Math.hypot(f.x - R.grain.x, f.y - R.grain.y) < 26;
      const face = f.face || (TOWN_FACE(m, n) >= n.x ? 1 : -1), [w, hh] = SZ(nm), pk = fed ? HEN_PECK.fed : HEN_PECK, ph = GT * pk.rate + i * 2.1, peck = (1 - run) * Math.max(0, Math.sin(ph)) ** pk.sharp;
      const spd = Math.hypot(f.vx, f.vy), st = f.dist / 5, hop = run * (1.6 + 0.02 * Math.max(0, spd - 24)) * Math.abs(Math.sin(st)), rock = run * 0.09 * Math.sin(st), scare = GT - (f.scareT ?? -9);
      const neck = 0.9 * peck + (1 - peck) * (1 - run) * HEN_PECK.glance * Math.sin(GT * HEN_PECK.glanceRate + i) + 0.06 * Math.sin(GT * 3.1 + i) - 0.22 * run, tail = 0.08 * Math.sin(GT * 2.3 + i * 1.7) - (scare >= 0 ? 0.5 * SS(0, 0.08, scare) * (1 - SS(0.3, 0.9, scare)) : 0);
      // startled (f.scareT) it hops up and beats its wings for HF.scare s; running fast it beats them too
      const HF = HEN_FLAP, scareK = scare >= 0 && scare < HF.scare ? Math.sin(Math.PI * scare / HF.scare) : 0, flap = Math.max(scareK, SS(HF.fast[0], HF.fast[1], spd)), up = hop + HF.hop * scareK;
      const fT = f.turnT === undefined ? 1 : SS(0, 0.12, GT - f.turnT), fs = face * (fT < 1 ? Math.sign(fT * 2 - 1 || 1) * Math.max(0.1, Math.abs(fT * 2 - 1)) : 1), LEG = 3.5;
      Y.push([f.y, () => { L.shadow(X, Yg + 1, 9, 3, 0.4); L.joint(id, 'ground', [X, Yg]); L.joint(id, 'body', [X, Yg - up - LEG]); L.joint(id, 'head', [X + fs * 7, Yg - up - LEG - 12 + 7 * peck]); L.joint(id, 'tail', [X - fs * 7, Yg - up - LEG - 8 + 6 * tail]);
        for (const q of [0, 1]) { const a = st + q * Math.PI, hx = X + (q ? 2.5 : -2.5), hy = Yg - up - LEG - 1, fx = hx + face * run * 3.2 * Math.sin(a), fy = Yg - (up - hop) - run * 2 * Math.max(0, Math.cos(a)); L.solid(hx, hy, Math.hypot(fx - hx, fy - hy), 1.6, [0.82, 0.58, 0.2], Math.atan2(fy - hy, fx - hx), 0, 0.8, 1); }
        L.inked(() => L.sprite(nm, 0, 0, { m: M.of(M.t(X, Yg - up - LEG), M.r(rock), M.s(fs, 1)), w, h: hh, pivot: [w / 2, hh], u: { wtex: G.tex(nm + '_w'), wsz: [RG.w, RG.h], bone0: [RG.bones[0][0] / RG.w, RG.bones[0][1] / RG.h, neck, 1], bone1: [RG.bones[1][0] / RG.w, RG.bones[1][1] / RG.h, tail, 1] } }), { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 });
        if (flap > HF.min) for (const [q, ph0] of [[HF.farRoot, HF.farPhase], [HF.nearRoot, 0]]) { const th = flap * HF.lift * (HF.rest + (1 - HF.rest) * (0.5 + 0.5 * Math.sin(GT * HF.rate + i + ph0))), wx = X - fs * q, wy = Yg - up - LEG - HF.rootY * hh;
          L.solid(wx, wy, HF.w, HF.h, D.henLook(f).wing, fs > 0 ? Math.PI + th : -th, 0, HF.h / 2); } }]);
      return; }
    const nm = D.folkSprite(f); if (!RIGS[nm] || !window.ASSETS[nm + '__body']) return;
    const H = SZ(nm)[1], c = D.folkClock(f.role, i, GT), u = c.u, T = m.town.svc, route = n.route;
    // the talk's weight: in over 0.35 s from the first line, out over 0.45 s when the pair is said or the hero walks off
    const e0 = Math.min(f.sayT + D.FOLK_SAY, f.byeT > f.sayT ? f.byeT : 1e9); let tw = SS(f.sayT, f.sayT + 0.35, GT) * (1 - SS(e0, e0 + 0.45, GT));
    const talkNow = GT >= f.sayT && GT < e0 + 0.2, wf = TOWN_FACE(m, n) >= n.x ? 1 : -1;
    // a talk with the hero on the far side of the work (TASKS 1032): the work eases into a rest pose (hands in to the body, the tool
    // upright), the rig turns there, and only then does the talk pose come in; the same way back after. Turned straight from the
    // work pose the whole rig flipped with the tool in it: the smith's hammer jumped 54 px in a frame. rk: the rest's weight
    // the Keeper's walk to the hero and back (TASKS 1849): he faces the way he goes and turns like a walker; gw eases his work out and in
    const gA = f.walkA ?? 1e9, gB = f.walkB ?? 1e9, gOn = GT >= gA && GT < gB + 0.3, gw = gOn ? SS(gA, gA + 0.3, GT) * (1 - SS(gB, gB + 0.3, GT)) : 0;
    const TURN = 0.3, fIn = f.sayT + TURN, fOut = Math.max(e0, fIn + TURN) + TURN, back = !route && !gOn && FD.lines && f.face && f.face !== wf && GT >= f.sayT && GT < fOut + TURN;
    let rk = 0;
    if (back) { rk = GT < fIn ? SS(f.sayT, fIn, GT) : GT < fOut - TURN ? 1 - SS(fIn, fIn + TURN, GT) : GT < fOut ? SS(fOut - TURN, fOut, GT) : 1 - SS(fOut, fOut + TURN, GT);
      tw = SS(fIn, fIn + TURN, GT) * (1 - SS(fOut - TURN, fOut, GT)); }
    const face = gOn && f.face ? f.face : back ? (GT >= fIn && GT < fOut ? f.face : wf) : (route || talkNow) && f.face ? f.face : wf;
    // a walker turns like a paper figure: mirrored in one tick the whole rig jumped by its own width (TASKS 1409); the parts' width keeps
    // a minimum, but the joints and the hand targets ride the width through zero (jointW, floored only off the IK's zero divide): through
    // the clamp's sign flip the hands jumped 0.2 of their reach (TASKS 2101), the shoulders, elbows and feet 0.56 (town_motion_r10 2),
    // and a hand's target pulled in toward the axis dipped the child's hand 3.6 px for a frame (town_motion_r10 3)
    const FT = D.FOLK_TURN, tT = route || gOn ? f.turnT : back && GT >= fIn ? (GT >= fOut ? fOut : fIn) : undefined, turnK = tT !== undefined ? SS(0, f.load ? FT.load : FT.t, GT - tT) : 1, { rigFace, jointW } = turnWidths(face, turnK);
    const RG = RIGS[nm], s = H / RG.h, gy = RG.foot ?? RG.footL[1], handAt = (sd, k = 1, dy = 0) => [X + face * k * (RG['hand' + sd][0] - RG.gap) * s, Yg + (RG['hand' + sd][1] + dy - gy) * s];
    const P = (dx, dy) => [X + face * dx * H, Yg + dy * H], mir = (q) => [X + (q[0] - X) * face * wf, q[1]];
    // a free hand on IK walking: along the travel against its own leg, FD.swing of the height each way, k its weight (biped's own stride and phase)
    const stride = MONSTERS.rigStride(nm, H, FD.stride), swingAt = (k) => (stride ? (FD.swing || 0) * H * k * Math.cos(2 * Math.PI * (f.pace ?? f.dist) / stride) : 0);
    const talkR = P(0.27, -0.52 + 0.025 * Math.sin(GT * 5.3 + i)), talkL = P(0.08, -0.36);
    const atStop = route && !f.go, pu = GT - f.t0, stop = route && f.way >= 0 ? route[f.way] : null, moving = Math.hypot(f.vx, f.vy) > 2;
    let tg = {}, hold = null, lean = 0, headR = 0, headF = 1, crouch = 0, front = null, robe = null, fx = null;
    let turnAbout = X;
    if (f.role === 'smith') {
      // a blow every loop, every 4th a breather (the hammer down, the piece turned in the tongs): up over the head, down faster and
      // faster onto the anvil, a small rebound, back up to the start
      const A = T.anvil, top = [sx(A.x) - wf * 4, sy(A.y) - 0.82 * SZ('anvil_tw')[1]], brk = c.n % FD.rest === FD.rest - 1, hit = FD.hit;
      const imp = [top[0] - wf * 21, top[1] - 5], Sh = [X + wf * 0.2 * H, Yg - 0.655 * H], cock = [X + wf * 0.02 * H, Yg - 0.87 * H];
      // the hand travels round the shoulder, over and out in front: a straight line from the top to the anvil runs through the shoulder itself, folding the arm shut (town_motion_r6 3)
      const polar = (p) => [Math.atan2(p[1] - Sh[1], (p[0] - Sh[0]) * wf), Math.hypot(p[0] - Sh[0], p[1] - Sh[1])], [aI, rI] = polar(imp), [aC, rC] = polar(cock), arc = (k) => { const a = lerp1(aI, aC, k), r = lerp1(rI, rC, k) + Math.sin(Math.PI * k); return [Sh[0] + wf * Math.cos(a) * r, Sh[1] + Math.sin(a) * r]; };
      // the hammer's angle (as if facing right) rides the same path: its handle back over the shoulder at the top, level on the blow.
      // Off the rebound it goes straight back up, over the loop's turn to the top (TASKS 1032: it lay on the anvil 0.55 s)
      const UPA = -2.6, IMPA = 0.12, RESTA = 0.9, R0 = hit + 0.1, span = 1 - R0 + 0.42, x0 = (1 - R0) / span;
      const raise = (x) => { const k = E01(x); return [arc(k), lerp1(IMPA, UPA, k), k]; };
      let hr, ha, hk, brkK = 0;
      if (brk) { const k = Math.sin(Math.PI * u) ** 2, [p0, a0, h0] = raise(x0); hr = lerp2(p0, [X + wf * 0.22 * H, Yg - 0.42 * H], k); ha = lerp1(a0, RESTA, k); hk = h0 * (1 - k); brkK = k; }
      else if (u < 0.42 || u >= R0) [hr, ha, hk] = raise(((u - R0 + 1) % 1) / span);
      // down faster and faster, meeting the anvil at a little over its mean speed (a squared ease met it at twice that: the hand broke
      // 6 px in a frame), then a rebound that starts from rest
      else if (u < hit) { const x = (u - 0.42) / (hit - 0.42), q = 0.4 * (1.9 * x * x - 0.9 * x * x * x) + 0.6 * E01(x); hr = arc(1 - q); ha = lerp1(UPA, IMPA, q); hk = 1 - q; }
      else { const b = Math.sin(Math.PI * (u - hit) / 0.1) ** 2; hr = [imp[0], imp[1] - 5 * b]; ha = IMPA - 0.15 * b; hk = 0; }
      const hl = [X, Yg - 0.5 * H - (brk ? 7 * Math.sin(Math.PI * u) ** 2 : 0)], tongA = Math.atan2(top[1] - 6 - hl[1], (top[0] - wf * 8 - hl[0]) * wf);
      tg = { R: lerp2(mir(hr), talkR, tw), L: lerp2(mir(hl), talkL, tw) };
      hold = { R: TOOL('town_tool_hammer', 0.84, { abs: lerp1(ha, RESTA, tw) }), L: TOOL('town_tool_tongs', 0.7, { abs: lerp1(tongA, 0.3, tw) }) };
      // he leans into the blow and his knees give on it, eased: the lean switched on in a frame
      lean = face * (0.12 - 0.2 * hk - 0.07 * brkK) * (1 - tw); crouch = (6 + 20 * (1 - hk) ** 2 * (1 - brkK)) * (1 - tw); headR = 0.14 * (1 - tw) - 0.05 * tw;
      if (!brk && u >= hit && (u - hit) * c.per < 0.45 && tw < 0.5) fx = { k: 'spark', x: top[0], y: top[1], a: (u - hit) * c.per, seed: c.n * 7 + i };
    } else if (f.role === 'keeper') {
      // leans on his staff and dozes off (the head sinks, jerks up), now and then pokes the fire: embers fly up on the poke
      // the staff stands out in front of him, its crook leaning off his face (TASKS 1032: it covered it); the poke is the arm's: the hand
      // goes out and down by IK, he crouches and leans in, and the staff turns its foot to the embers
      const Fp = [sx(T.fire.x), sy(T.fire.y)], poke = bump01(u, 0.12, 0.42) * (1 - tw) * (1 - gw), dz = SS(0.5, 0.9, u) * (1 - SS(0.93, 0.97, u)) * (1 - gw);
      const lean0 = 0.2 + 0.05 * Math.sin(GT * 0.9 + i), stand = P(0.32, -0.47), out = [X + (Fp[0] - X) * 0.5, Yg - 0.3 * H], hand = lerp2(stand, mir(out), poke);
      const ember = [Fp[0], Fp[1] - 6], dn = Math.atan2(ember[1] - hand[1], ember[0] - hand[0]), aim0 = face > 0 ? dn + Math.PI : -dn, aim = -Math.PI / 2 + lean0 + SCX.wrapPi(aim0 + Math.PI / 2 - lean0);
      tg = { R: lerp2(hand, talkR, tw * 0.6) };
      hold = { R: TOOL('town_tool_staff', lerp1(0.5, 0.62, poke), { abs: lerp1(-Math.PI / 2 + lean0, aim, poke) }) };
      headR = (0.32 * dz + 0.1 * poke) * (1 - tw) - 0.05 * tw; lean = face * (0.04 * dz + 0.16 * poke) * (1 - tw); crouch = 14 * poke;
      if (u > 0.27 && u < 0.27 + 1.2 / c.per && tw < 0.5 && gw < 0.5) fx = { k: 'embers', x: Fp[0], y: Fp[1] - 14, a: (u - 0.27) * c.per, seed: c.n * 5 + i };
    } else if (f.role === 'guard') {
      // shifts his weight, now and then looks back over the yard, the spear upright in his hand
      // the look back is the head's alone (TASKS 1032): mirroring the whole guard swung his arm 39 px and the spear across
      const GLK = GUARD_LOOK, lookEnd = GLK.from + GLK.span, look = (1 - SS(0, 0.5, tw)) * SS(GLK.from, GLK.from + GLK.ramp, u) * (1 - SS(lookEnd - GLK.ramp, lookEnd, u));
      // (and once a round lifts the spear and grounds it again, TASKS 1159 note: his arm stood stock still, a figure, not a man on watch)
      const hitch = bump01(u, 0.08, 0.4) * (1 - tw);
      const ground = (1 - tw) * bump01(u, 0.12, 0.34);
      tg = { R: lerp2(P(0.24, -0.42 - 0.01 * Math.sin(GT * 0.7 + i) - 0.14 * ground), talkR, tw * 0.5), L: lerp2(P(-0.2 + 0.05 * Math.sin(2 * Math.PI * u), -0.4 - 0.1 * Math.sin(2 * Math.PI * u + 0.8) ** 2), P(0.1, -0.5), hitch) };
      hold = { R: TOOL('town_tool_spear', 0.58, { abs: -Math.PI / 2 - 0.05 }) };
      // over the look the head sweeps the yard (up to GUARD_LOOK.head rad each way, 6–7 px at the crown) and the body shifts onto it
      const sweep = look * GLK.head * Math.sin(2 * Math.PI * Math.max(0, Math.min(1, (u - GLK.from) / GLK.span)));
      lean = (GUARD_WORK.lean * Math.sin(2 * Math.PI * u) + GLK.body * look) * face; crouch = GUARD_WORK.knee * Math.sin(2 * Math.PI * u) ** 2 * (1 - tw); headR = -0.03 + 0.05 * Math.sin(4 * Math.PI * u) * (1 - look) - 0.06 * look + sweep; { const hc = Math.cos(Math.PI * look); headF = (hc < 0 ? -1 : 1) * Math.max(0.55, Math.abs(hc)); }
    } else if (f.role === 'porter' || f.role === 'mason') {
      // the crate: in both hands in front of the chest while he carries it; at a stop he bends, lifts it off the floor or sets it down,
      // only what the sim says he did there (f.lift): a crate is never drawn into or out of hands that did not hold it
      const mason = f.role === 'mason', load = mason ? 'town_tool_stone' : 'town_tool_crate', cw = 0.3 * H, chest = [X + jointW * 0.2 * H, Yg - 0.46 * H], act = atStop && f.lift, floor = mason ? (act === 'drop' ? [sx(T.bin.x), sy(T.bin.y) - 30] : act === 'take' ? cartRim(m, R, sx, sy) : P(0.5, -0.5)) : P(0.33, -0.14);
      let k = f.load ? 1 : 0, bend = 0;
      const hang = (sd) => (sd === 'L' ? P(-0.2, -0.45) : P(0.2, -0.43));
      if (act === 'take') { k = mason ? SS(0.3, 1.15, pu) : SS(0.8, 1.4, pu); bend = bump01(Math.min(pu, 1.6), 0, 1.6); } else if (act === 'drop') { k = 1 - SS(0.35, mason ? 0.95 : 1.2, pu); bend = bump01(Math.min(pu, 1.6), 0, 1.6); }
      const hasCrate = f.load || (act === 'drop' && (!mason || pu < 0.95)), cp = lerp2(floor, chest, k);
      if (hasCrate) { cp[1] -= moving ? 1.2 * Math.abs(Math.sin(f.dist / 14)) : 0; tg = { L: [cp[0] - face * cw * 0.42, cp[1] + 2], R: [cp[0] + face * cw * 0.42, cp[1] + 2] };
        front = () => L.sprite(load, cp[0] - cw / 2, cp[1] - cw / 2, { w: cw, h: cw }); }
      else if (act === 'take') { tg = { L: [cp[0] - face * cw * 0.42, cp[1] + 2], R: [cp[0] + face * cw * 0.42, cp[1] + 2] }; front = () => L.sprite(load, cp[0] - cw / 2, cp[1] - cw / 2, Object.assign({ w: cw, h: cw }, mason ? { u: { alpha: SS(0, 0.25, pu) } } : {})); }
      // hands on a load turn about the load, and the load crosses the body on the rig's own width: on a clock of its own (0.22 s) it lay
      // off the axis while the rig stood at its clamped width, the target fell behind the body and the hand jumped to reach it (TASKS 2116)
      if (hasCrate || act === 'take') turnAbout = cp[0];
      if (act === 'take') { const rw = mason ? SS(0, 0.25, pu) : SS(0.2, 0.8, pu); tg = { L: lerp2(hang('L'), tg.L, rw), R: lerp2(hang('R'), tg.R, rw) }; }
      if (!mason && act === 'drop' && pu >= 1.2) { const rk = SS(1.2, 1.75, pu); tg = { L: lerp2(tg.L, hang('L'), rk), R: lerp2(tg.R, hang('R'), rk) }; }
      if (tw > 0 && !hasCrate) tg = { R: lerp2(P(0.1, -0.38), talkR, tw) };
      // the stone gone into the bin, his hands come back from it over half a second (TASKS 1418)
      if (mason && act === 'drop' && pu >= 0.95 && pu < 1.6) { const rk = SS(0.95, 1.6, pu); tg = { L: lerp2([floor[0] - face * cw * 0.42, floor[1] + 2], hang('L'), rk), R: lerp2([floor[0] + face * cw * 0.42, floor[1] + 2], hang('R'), rk) }; }
      // the mason's arms are always on IK: released at the first steps from the block, the elbow flipped to the rig's free pose in a frame (TASKS 1616)
      // walking, the free hands swing about the shoulders, FD.swing of the height each way: about the rest pose's hands, out at 0.2 H,
      // they reached 0.34 H, the arm 60° off the vertical (town_motion_r9 5)
      if (!tg.L || !tg.R) { const from = route[(f.way + route.length - 1) % route.length], g = f.go ? SS(2, 18, Math.hypot(f.x - from.x, f.y - from.y)) * SS(0, 14, Math.hypot(f.x - stop.x, f.y - stop.y)) : 0, sw = swingAt(g), free = (sd, q) => [lerp1(hang(sd)[0], X + face * (RG['sh' + sd][0] - RG.gap) * s, g) + face * q, hang(sd)[1] - Math.abs(q) * 0.3];
        tg = { L: tg.L || free('L', -sw), R: tg.R || free('R', sw) }; }
      if (mason && act === 'drop' && pu > 0.9 && pu < 1.45) fx = { k: 'dust', x: floor[0], y: floor[1] - 8, amt: 1 - (pu - 0.9) / 0.55, seed: c.n * 2 + i, col: [0.88, 0.82, 0.7], a: 0.8 };
      crouch = (mason ? 14 : 34) * bend; lean = face * 0.3 * bend; headR = 0.15 * bend;
      // between carts he dresses a block with the hammer
      if (mason && atStop && act !== 'take' && !f.load && pu >= 1.7 && tw < 0.99) { const Cr = R.cart || {}, ready = Cr.st === 'at' && Cr.load > 0, w = Math.min(ready ? 1 - SS(Cr.atT ?? -9, (Cr.atT ?? -9) + 0.5, GT) : 1, Math.max(0, Math.min(1, (pu - 1.7) / 0.4))), spare = c.n % 4 === 3, sk = spare ? Math.sin(Math.PI * u) ** 2 : 0, up = (spare ? 0 : 1) * (u < 0.55 ? E01(u / 0.55) : 1 - E01(Math.min(1, (u - 0.55) / (FD.hit - 0.55))));
        tg = { R: lerp2(lerp2(hang('R'), lerp2(P(0.3 + 0.07 * up, -0.46 - 0.25 * up), P(0.1, -0.42), sk), w), talkR, tw), L: lerp2(hang('L'), lerp2(P(0.26, -0.34), P(0.14, -0.72), sk), w) };
        if (w > 0.02) hold = { R: TOOL('town_tool_hammer', 0.84, { abs: lerp1(0.9, lerp1(0.2 - 1.5 * up, 1.3, sk), w), len: SZ('town_tool_hammer')[1] * SS(0, 0.3, w) }) }; lean = face * (0.06 + 0.1 * (1 - up)) * w * (1 - sk); crouch += 5 * (1 - up) * w * (1 - sk); headR += 0.1 * (1 - up) * w;
        const strike = FD.hit; if (!spare && w > 0.5 && u >= strike && (u - strike) * c.per < 0.4 && tw < 0.5) fx = { k: 'spark', x: P(0.52, -0.45)[0], y: P(0.52, -0.45)[1], a: (u - strike) * c.per, seed: c.n * 7 + i }; }
    } else if (f.role === 'child') {
      // at each stop he scatters grain to the hens: a hand into the bag, a throw out in front, the grain falling ahead of him
      const bag = P(0.3, -0.42), throwing = atStop && route && tw < 0.5, dip = P(0.22, -0.44), out = P(0.45, -0.66), rest = P(0.08, -0.33);
      // the throw eases in over FD.ease from the stop and out from the start (TASKS 2124): switched on by the stop, the hand jumped 18 px
      const throwK = !route || tw >= 0.5 ? 0 : atStop ? SS(0, FD.ease, pu) : 1 - SS(0, FD.ease, GT - (f.goT ?? -9));
      const hr = throwK > 0 ? lerp2(rest, u < 0.3 ? lerp2(rest, dip, E01(u / 0.3)) : u < 0.47 ? lerp2(dip, out, E01((u - 0.3) / 0.17)) : lerp2(out, rest, E01((u - 0.47) / 0.4)), throwK) : rest;
      const away = awayFromStops(f, route, stop);
      // walking, the hand stays on IK: let go to the rig's free swing at the end of the blend, the elbow jumped 4.7 px (TASKS 2124)
      const walkR = handAt('R'), sw = swingAt(1);
      tg = { L: bag, R: tw > 0 ? lerp2(hr, talkR, tw) : route ? lerp2(hr, [walkR[0] + face * sw, walkR[1] - Math.abs(sw) * 0.3], away) : null };
      hold = { L: TOOL('town_tool_grain', 0.45, { abs: -Math.PI / 2 }) };
      if (throwing && u > 0.47 && (u - 0.47) * c.per < 1.4) fx = { k: 'grain', x: out[0], y: out[1], g: Yg, face, a: (u - 0.47) * c.per, seed: c.n * 3 + i };
    } else if (f.role === 'sweeper') {
      // sweeps at each stop: the near hand drives the broom to and fro, the far hand higher up the handle, the bristles on the floor
      const sweeping = !moving && tw < 0.99, ph = 2 * Math.PI * u, L0 = SZ('town_tool_broom')[1], grip = 0.3;
      // the broom eases out of the sweep near the stops, or the hands jumped between the two poses on arriving and setting off (TASKS 1433)
      const away = awayFromStops(f, route, stop), carry = Math.max(away, SS(0.6, 0.99, tw));
      // walking, the broom brushes ahead once a step, on the robe's own step phase, so it keeps time with the shoes
      const WS = FD.walkSweep, stepSweep = MONSTERS.robeStride(nm, H) ? D.walkSweepAt(MONSTERS.robePhase(nm, H, f.dist)) : 0;
      const hr = lerp2(P(0.2 + 0.09 * Math.sin(ph), -0.42 + 0.015 * Math.cos(ph)), P(0.2 + WS.reach * stepSweep, -0.45), carry);
      const down = Math.min(0.98, (Yg + 1 - hr[1]) / ((1 - grip) * L0)), th = lerp1(Math.asin(down), WS.rest + WS.tilt * stepSweep, carry);
      const dir = [-face * Math.cos(th), -Math.sin(th)];   // up the handle, away from the bristles
      const abs = Math.atan2(dir[1], dir[0] * face);
      tg = { R: hr, L: [hr[0] + dir[0] * 0.24 * L0, hr[1] + dir[1] * 0.24 * L0] };
      hold = { R: TOOL('town_tool_broom', grip, { abs }) };
      robe = { lift: 4 * (1 - carry), headR: lerp1(0.05, 0.16 + 0.05 * Math.sin(2 * ph), 1 - carry) };
      if (tw > 0) { tg.L = lerp2(tg.L, talkR, tw); robe.headR = lerp1(robe.headR, -0.05, tw); }
      if (sweeping) { const q = Math.sin(ph); if (Math.abs(q) > 0.7) fx = { k: 'dust', x: hr[0] - dir[0] * (1 - grip) * L0, y: hr[1] - dir[1] * (1 - grip) * L0, amt: (Math.abs(q) - 0.7) / 0.3, seed: c.n * 2 + (q > 0 ? 1 : 0) + i }; }
    } else if (f.role === 'enchanter') {
      // reads at the lectern, turns a page, then lifts a flask and burns it: a cold blue flame in the hand
      const Lc = T.lectern, book = [sx(Lc.x) - wf * 2, sy(Lc.y) - 0.72 * SZ('lectern_tw')[1]], page = bump01(u, 0.1, 0.32), flask = bump01(u, 0.4, 0.85);
      const hr = [book[0] - wf * (10 - 16 * page), book[1] - 4 * page];
      // the flask hand always has a target, from where it hangs at rest: let go to the rig's own rest it clicked 18 px (TASKS 1032)
      const lf = 1 + 2.5 * Math.sin(GT * 1.7 + i * 1.7);
      tg = { R: lerp2(mir(hr), talkR, tw), L: lerp2(handAt('L', 1, lf), P(0.24, -0.8), flask * (1 - tw)) };
      hold = { L: TOOL('it_mp', 0.3, { abs: -Math.PI / 2 + 0.25 * flask * (1 - tw), len: 0.15 * H }) };
      // over the book the head goes forward and down and the shoulders hunch, the head follows the turned page; up from it for the flask
      const EW = ENCHANTER_WORK, bent = (1 - flask) * (1 - tw);
      robe = { lift: 1 + EW.hunch * bent, headR: lerp1(0.18 * (1 - flask) - 0.12 * flask, -0.05, tw), headD: [EW.lean * bent + EW.page * page * (1 - tw), EW.dip * bent] };
      const burn = bump01(u, 0.5, 0.78) * (1 - tw); if (burn > 0.02) fx = { k: 'flame', hand: 'L', amt: burn, seed: c.n + i, up: 0.1 * H };
      if (page > 0.02 && tw < 0.5) { const q = Math.cos(Math.PI * page), pw = 9 * Math.abs(q), px = book[0] + (q * wf >= 0 ? 0 : -pw), py = book[1] - 3 - 3 * Math.sin(Math.PI * page); Y.push([Lc.y + 1, () => L.solid(Math.round(px), Math.round(py), Math.max(1, pw), 5, [0.84, 0.78, 0.62])]); }
    }
    if (rk > 0) { for (const sd of ['L', 'R']) tg[sd] = lerp2(tg[sd] || handAt(sd), handAt(sd, 0.35), rk);
      if (hold) hold = Object.fromEntries(Object.entries(hold).map(([sd, q]) => [sd, q.abs === undefined ? q : Object.assign({}, q, { abs: lerp1(q.abs, -Math.PI / 2, rk) })]));
      lean *= 1 - rk; crouch *= 1 - rk; headR = lerp1(headR, -0.08, rk); if (robe) robe.headR = lerp1(robe.headR, -0.08, rk); if (rk > 0.3) fx = null; }
    if (tw > 0 && !robe) headR = lerp1(headR, -0.06 + 0.04 * Math.sin(GT * 4.1 + i), tw);
    // struck by the hero's blow (TASKS 1033): a flinch back from it, knees giving, the head ducked, over half a second
    { const fl = D.folkFlinchAt(GT - (f.hitT ?? -9));
      if (fl.k > 0) { lean -= face * fl.lean; crouch += fl.crouch; headR += fl.headR; if (robe) robe = D.robeFlinched(robe, fl); } }
    drawFolkRig(f, n, nm, X, Yg, H, rigFace, GT, Y, { stride: FD.stride, faceW: jointW, hold, handTarget: (sd) => { const q = tg[sd]; if (!q) return null; return [turnAbout + (q[0] - turnAbout) * jointW / face, q[1]]; }, lean, headR, headF, crouch, front, robe, fx, arms: f.role === 'smith' || f.role === 'mason' || f.role === 'porter' });
    // the crate the porter set down by the merchant waits there until he brings the next
    if (f.role === 'porter' && !f.load && route) { const dp = route.find((q) => q.act === 'drop'), atDrop = atStop && f.lift === 'drop';
      if (dp && !atDrop) { const cw = 0.3 * H, x = sx(dp.x) - 0.33 * H, y = sy(dp.y) - 0.14 * H; Y.push([dp.y - 1, () => L.inked(() => L.sprite('town_tool_crate', x - cw / 2, y - cw / 2, { w: cw, h: cw }), { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 })]); }
      // and the next one stands at the dock from the moment he has set his down, not from the moment he stoops for it (town_motion_r6 4)
      const ti = route.findIndex((q) => q.act === 'take'), tk = route[ti];
      if (tk && !(atStop && f.lift === 'take')) { const pv = route[(ti + route.length - 1) % route.length], dir = tk.x >= pv.x ? 1 : -1, cw = 0.3 * H, x = sx(tk.x) + dir * 0.33 * H, y = sy(tk.y) - 0.14 * H; Y.push([tk.y - 1, () => L.inked(() => L.sprite('town_tool_crate', x - cw / 2, y - cw / 2, { w: cw, h: cw }), { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 })]); } }
  }
  // the mine's cart on its rope (the sim's R.cart): full, part-emptied or empty by what the mason has left in it; it goes dark as it enters the adit
  function drawCart(R, m, GT, Y, sx, sy) {
    const T = m.town, pts = SCX.railPts(m), C = R.cart || { s: 1e9, st: 'at', load: 3 };
    const ms = (R.folk || []).find((q) => q.role === 'mason');
    { const n = Math.min(3, Math.max(0, (C.bin || 0) - (ms && ms.lift === 'drop' && !ms.go && GT - ms.t0 < 0.95 ? 1 : 0))), cw = 14, bx = sx(T.svc.bin.x), by = sy(T.svc.bin.y), used = GT - (C.binT ?? -9);
      if (n || used < 0.5) Y.push([T.svc.bin.y + 1, () => { for (let q = 0; q < n; q++) L.sprite('town_tool_stone', bx - 15 + q * 11 - cw / 2, by - 34 - (q % 2) * 4, { w: cw, h: cw }); if (used < 0.5) L.puff(bx - 4, by - 36, 12, [0.8, 0.74, 0.62], 0.6 * (1 - used / 0.5), 3); }]); }
    if (C.st === 'in') return;
    // the cart's ground is the rails' middle itself (it stood 8 px below it, on the grass), and its painting's `seat` is what rides there
    const { x, y, ds, s: run } = D.cartAt(pts, C.s);
    const justTook = ms && !ms.go && ms.lift === 'take' && GT - ms.t0 < 0.45, shown = C.load + (justTook ? 1 : 0), li = shown >= 3 ? 0 : shown === 2 ? 1 : 2, nmS = ["cart_tw", "cart_tw_half", "cart_tw_empty"][li], nmF = ["cart_tw_f", "cart_tw_f_half", "cart_tw_f_empty"][li],
      FD = D.cartFade(pts, ds), rolling = C.st === 'down' || C.st === 'up', bob = rolling ? 0.8 * Math.sin(C.s / 6) : 0, k = SS(...D.CART.dusk, C.s), X = sx(x), Yg = sy(y);
    const pulse = (a, dur) => (a >= 0 && a < dur ? Math.sin(Math.PI * a / dur) * (1 - a / dur) : 0), sag = pulse(GT - (C.takeT ?? -9) - 0.45, 0.4), stopK = C.st === 'at' ? pulse(GT - (C.atT ?? -9), 0.4) : 0, end = pts[pts.length - 1], pre = pts[pts.length - 2], back = end[0] >= pre[0] ? -1 : 1;
    const wob = 0.05 * sag, Xc = X + back * 3 * stopK, Yc = Yg + bob + 2.5 * sag + 1.2 * stopK, tint = [k * 0.82, k * 0.82, k * 0.82, 1];
    // both paintings ride the rails' middle by their own seat, so through the cross-fade their wheels stay on the rails while the box turns
    // the 3/4 painting comes in under the front one, which stays opaque, then the front one fades out over it: their sum never lets the
    // ground or the ink through where they overlap (plain complementary alphas left a quarter of each, and the eight ink copies at the new
    // view's alpha stacked into a dark ghost of it, 44 % at an alpha of 0.07). Each is inked on its own, the narrow front on top: drawn
    // in one silhouette the 3/4 fill covered the front's outline and the box's darkest 5 % paled 14 → 24 (town_motion_r10 5)
    // the 3/4 painting grows through the fade from the front one's size to its own about its near wheels' feet, which stay on the near rail (TASKS 2140)
    const grow = D.cartGrow(nmS, nmF, SZ, FD.a);
    const views = [[FD.S, nmS, Math.min(1, 2 * FD.a), FD.a], [FD.F, nmF, Math.min(1, 2 - 2 * FD.a), 1 - FD.a]].filter((q) => q[2] > 0).map(([V, nm, a, k2]) => { const [w, h] = SZ(nm), fm = V.side ? D.cartFoot(nm, w, h, V) : [0, 0], g = V.side ? grow : 1,
      Mc = M.of(M.t(Xc, Yc), M.r(V.rot * L.D2R + wob), M.t(fm[0], fm[1]), M.s(g, g), M.t(-fm[0], -fm[1])),
      seat = V.side ? D.cartSeat(nm, w, h, V) : D.cartSeatF(nm, w, h), rotAt = (dx, dy) => M.ap(Mc, [dx - seat[0], dy - seat[1]]);
      return { V, nm, a, k2, w, h, Mc, seat, rotAt, lugs: V.side ? D.CART.hubs[nm].map((_, q) => rotAt(...D.cartLug(nm, q, w, h, run, V.run))) : [], u: { tint, alpha: a } }; });
    const mix = (f) => views.reduce((o, q) => { const p = f(q); return [o[0] + p[0] * q.k2, o[1] + p[1] * q.k2]; }, [0, 0]);
    const LG = D.CART.lug, RP = D.CART.rope, wn = D.cartWinch(pts), wide = views.reduce((o, q) => o + q.w * q.k2, 0),
      rope = D.cartRope([sx(wn[0]), sy(wn[1])], mix((q) => q.rotAt(...D.cartHook(q.V.side, nmS, q.w, q.h))), Math.sign(pts[pts.length - 1][0] - pts[0][0]) || 1);
    Y.push([y - 40, () => { let px, py; for (const [qx, qy] of rope) { const ix = Math.round(qx), iy = Math.round(qy); if (ix !== px || iy !== py) L.solid(ix, iy, 1, 1, RP.col, 0, 0, 0, 1); px = ix; py = iy; } }]);
    Y.push([y + 8, () => { L.shadow(Xc, Yg, 0.42 * wide, 5, 0.45); L.joint('cart', 'ground', [Xc, Yg]); L.joint('cart', 'top', mix((q) => q.rotAt(0, -q.h))); L.joint('cart', 'body', [Xc, Yc]);
      const INK = 8;
      for (const q of views) { L.inked(() => { L.sprite(q.nm, 0, 0, { m: q.Mc, pivot: [q.w / 2 + q.seat[0], q.h + q.seat[1]], w: q.w, h: q.h, u: L.sp ? Object.assign({}, q.u, { alpha: 1 - (1 - q.a) ** (1 / INK) }) : q.u }); }, { r: 2, n: INK, col: [0.09, 0.04, 0.04], dy: 0 });
        if (q.V.side) q.lugs.forEach((p, i) => L.joint('cart', 'stud' + i, p));
        for (const [lx, ly] of q.lugs) L.solid(Math.round(lx - LG.w / 2), Math.round(ly - LG.h / 2), LG.w, LG.h, LG.col.map((c) => c * k), 0, 0, 0, q.a);
        if (shown === 1) { const [sx1, sy1] = q.rotAt(0.04 * q.w, -0.71 * q.h); L.sprite('town_tool_stone', sx1 - 7, sy1 - 7, { w: 14, h: 14, u: { tint, alpha: q.a } }); } } }]);
  }
  function drawFolkRig(f, n, nm, X, Yg, H, face, GT, Y, o) {
    const id = 'npc' + f.i, seed = f.i * 1.7, fx = o.fx;
    Y.push([f.y, () => { L.shadow(X, Yg + 2, 0.24 * H, 6, 0.45); L.joint(id + '_view', 'face', [face, 0]);
      let hand = null;
      L.inked(() => { const r = RIGS[nm].neck ? MONSTERS.robed({ id, n: nm, x: X, y: Yg, H, t: GT, face, faceW: o.faceW, seed, dist: f.dist, vx: f.vx, vy: f.vy, U: {}, hold: o.hold, handTarget: o.handTarget, lift: o.robe && o.robe.lift, headR: o.robe && o.robe.headR, headD: o.robe && o.robe.headD, strideK: o.stride, lean: o.robe && o.robe.lean })
        : MONSTERS.biped({ id, n: nm, x: X, y: Yg, H, face, faceW: o.faceW, t: GT, seed, dist: f.dist, pace: f.pace, ...gaitV(f), U: {}, Ufar: {}, strideK: o.stride, ...(f.go || f.spd0 === undefined ? {} : { spd0: f.spd0, vxn0: f.vxn0, vyn0: f.vyn0, t0: f.t0 }), hold: o.hold, handTarget: o.handTarget, lean: o.lean, headR: o.headR, headF: o.headF, crouch: o.crouch, front: o.front, bend: o.arms ? { R: 1 } : undefined, farOver: o.arms });
        if (r && fx && fx.hand) hand = r.hand ? r.hand(fx.hand) : r.R2U(r.arms[fx.hand].Hd[0], r.arms[fx.hand].Hd[1]); }, { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 });
      if (fx) SCX.RIM.folk.push(Object.assign({}, fx, hand ? { x: hand[0], y: hand[1] - (fx.up || 0) } : {}));
      if (fx && (fx.k === 'grain' || fx.k === 'dust')) folkDust(fx, GT); }]);
  }
  // a freed captive is drawn as the townsfolk are: the merchant by his own rig, the others by their town rig; his joints' id is his own
  const CAPTIVE_FOLK_ID_BASE = 90;
  const captiveRig = (who) => (who === 'merchant' ? 'merchant' : 'town_' + who);
  const captiveFolkId = (who) => CAPTIVE_FOLK_ID_BASE + Object.keys(D.CAPTIVES).indexOf(who);
  // the grain the child throws (it arcs out and falls ahead of him, lies a moment and is gone) and the sweeper's dust: drawn in the band
  function folkDust(q, GT) {
    if (q.k === 'dust') { L.puff(q.x, q.y - 3, 11 + 8 * q.amt, q.col || [0.62, 0.55, 0.45], (q.a || 0.42) * q.amt, q.seed % 7); return; }
    for (let j = 0; j < 9; j++) { const vx = q.face * (40 + 60 * rnd(q.seed, j)), vy = -30 - 40 * rnd(q.seed, j + 9), gy = q.g - 2 + 8 * rnd(q.seed, j + 19);
      const T = (vy + Math.sqrt(vy * vy + 2 * 360 * (gy - q.y))) / 360, a = Math.min(q.a, T), x = q.x + vx * a, y = q.y + vy * a + 180 * a * a, k = 1 - SS(T + 0.4, T + 0.9, q.a);
      if (k > 0) L.solid(Math.round(x), Math.round(y), 2, 2, [0.86, 0.74, 0.42], 0, 0, 0, k); } }

  Object.assign(SCX, {
    FOLK0, HEN_PECK_PERIOD, FOLK_AWAY_CLEAR, turnWidths, captiveRig, captiveFolkId, drawFolk, drawFolkRig, drawCart });
})(typeof window !== 'undefined' ? window : globalThis);
