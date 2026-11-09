// live/scene_folk.js — the townsfolk: their cut-out rigs, poses at work and on their rounds, their dust.
// One of the scene's files (ARCHITECTURE.md §4.2): names from earlier files come from SCX at load, calls into later ones go through SCX.
(function (root) {
  const SCX = root.SCX;
  const {
    D, L, M, SS, SZ, TOWN_FACE, rnd } = SCX;
  const FOLK0 = (m) => D.folkInit(m.town.npcs);
  const lerp1 = (a, b, k) => a + (b - a) * k, lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], E01 = (q) => { q = Math.max(0, Math.min(1, q)); return q * q * (3 - 2 * q); };
  const bump01 = (u, a, b) => (u <= a || u >= b ? 0 : Math.sin(Math.PI * (u - a) / (b - a)) ** 2);
  const TOOL = (tex, grip, o) => Object.assign({ tex, len: SZ(tex)[1], grip }, o);
  // one townsperson (TASKS 1015): a work loop on its own clock (DATA.folkClock, shared with the sim's events), the walk of a round,
  // and the talk: turned to the hero, head up, the free hand gesturing, eased in and out of the work pose. Hands are placed by IK on
  // screen points; the tool rides the hand. The loop's moments (the blow, the poke, the throw) leave their effects in RIM.folk
  function drawFolk(f, n, m, R, GT, Y, sx, sy) {
    const i = f.i, FD = D.FOLK[f.role], X = sx(f.x), Yg = sy(f.y), id = 'npc' + i;
    if (f.role === 'hen') { const nm = ['town_hen_white', 'town_hen_red', 'town_hen_grey'][i % 3], RG = RIGS[nm]; if (!RG || !window.ASSETS[nm + '_w']) return;
      // (TASKS 1032) a hen walks with a bob and a rock, its neck out; at the grain it pecks quicker; startled, the tail flicks up
      const run = SS(2, 24, Math.hypot(f.vx, f.vy)), fed = R.grain && GT - R.grain.t < 7 && Math.hypot(f.x - R.grain.x, f.y - R.grain.y) < 26;
      const face = f.face || (TOWN_FACE(m, n) >= n.x ? 1 : -1), [w, hh] = SZ(nm), ph = GT * (fed ? 3.4 : 1.3) + i * 2.1, peck = (1 - run) * Math.max(0, Math.sin(ph)) ** (fed ? 3 : 6);
      const st = f.dist / 5, hop = run * 1.6 * Math.abs(Math.sin(st)), rock = run * 0.09 * Math.sin(st), scare = GT - (f.scareT ?? -9);
      const neck = 0.9 * peck + 0.06 * Math.sin(GT * 3.1 + i) - 0.22 * run, tail = 0.08 * Math.sin(GT * 2.3 + i * 1.7) - (scare >= 0 ? 0.5 * SS(0, 0.08, scare) * (1 - SS(0.3, 0.9, scare)) : 0);
      const fT = f.turnT === undefined ? 1 : SS(0, 0.12, GT - f.turnT), fs = face * (fT < 1 ? Math.sign(fT * 2 - 1 || 1) * Math.max(0.4, Math.abs(fT * 2 - 1)) : 1), LEG = 3.5;
      Y.push([f.y, () => { L.shadow(X, Yg + 1, 9, 3, 0.4);
        for (const q of [0, 1]) { const a = st + q * Math.PI, hx = X + (q ? 2.5 : -2.5), hy = Yg - hop - LEG - 1, fx = hx + face * run * 3.2 * Math.sin(a), fy = Yg - run * 2 * Math.max(0, Math.cos(a)); L.solid(hx, hy, Math.hypot(fx - hx, fy - hy), 1.6, [0.82, 0.58, 0.2], Math.atan2(fy - hy, fx - hx), 0, 0.8, 1); }
        L.inked(() => L.sprite(nm, 0, 0, { m: M.of(M.t(X, Yg - hop - LEG), M.r(rock), M.s(fs, 1)), w, h: hh, pivot: [w / 2, hh], u: { wtex: G.tex(nm + '_w'), wsz: [RG.w, RG.h], bone0: [RG.bones[0][0] / RG.w, RG.bones[0][1] / RG.h, neck, 1], bone1: [RG.bones[1][0] / RG.w, RG.bones[1][1] / RG.h, tail, 1] } }), { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 }); }]);
      return; }
    const nm = 'town_' + f.role; if (!RIGS[nm] || !window.ASSETS[nm + '__body']) return;
    const H = SZ(nm)[1], c = D.folkClock(f.role, i, GT), u = c.u, T = m.town.svc, route = n.route;
    // the talk's weight: in over 0.35 s from the first line, out over 0.45 s when the pair is said or the hero walks off
    const e0 = Math.min(f.sayT + D.FOLK_SAY, f.byeT > f.sayT ? f.byeT : 1e9); let tw = SS(f.sayT, f.sayT + 0.35, GT) * (1 - SS(e0, e0 + 0.45, GT));
    const talkNow = GT >= f.sayT && GT < e0 + 0.2, wf = TOWN_FACE(m, n) >= n.x ? 1 : -1;
    // the child, stopped, turns to the nearest hen to throw it grain
    const hen = f.role === 'child' && route && !f.go && !talkNow ? (R.folk || []).filter((q) => q.role === 'hen').sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0] : null;
    // a talk with the hero on the far side of the work (TASKS 1032): the work eases into a rest pose (hands in to the body, the tool
    // upright), the rig turns there, and only then does the talk pose come in; the same way back after. Turned straight from the
    // work pose the whole rig flipped with the tool in it: the smith's hammer jumped 54 px in a frame. rk: the rest's weight
    const TURN = 0.3, fIn = f.sayT + TURN, fOut = Math.max(e0, fIn + TURN) + TURN, back = !route && FD.lines && f.face && f.face !== wf && GT >= f.sayT && GT < fOut + TURN;
    let rk = 0;
    if (back) { rk = GT < fIn ? SS(f.sayT, fIn, GT) : GT < fOut - TURN ? 1 - SS(fIn, fIn + TURN, GT) : GT < fOut ? SS(fOut - TURN, fOut, GT) : 1 - SS(fOut, fOut + TURN, GT);
      tw = SS(fIn, fIn + TURN, GT) * (1 - SS(fOut - TURN, fOut, GT)); }
    const face = hen ? (hen.x >= f.x ? 1 : -1) : back ? (GT >= fIn && GT < fOut ? f.face : wf) : (route || talkNow) && f.face ? f.face : wf;
    const RG = RIGS[nm], s = H / RG.h, gy = RG.foot ?? RG.footL[1], handAt = (sd, k = 1, dy = 0) => [X + face * k * (RG['hand' + sd][0] - RG.gap) * s, Yg + (RG['hand' + sd][1] + dy - gy) * s];
    const P = (dx, dy) => [X + face * dx * H, Yg + dy * H], mir = (q) => [X + (q[0] - X) * face * wf, q[1]];
    const talkR = P(0.27, -0.52 + 0.025 * Math.sin(GT * 5.3 + i)), talkL = P(0.08, -0.36);
    const atStop = route && !f.go, pu = GT - f.t0, stop = route && f.way >= 0 ? route[f.way] : null, moving = Math.hypot(f.vx, f.vy) > 2;
    let tg = {}, hold = null, lean = 0, headR = 0, headF = 1, crouch = 0, front = null, robe = null, fx = null;
    let turnAbout = X, freeK = 1;
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
      const Fp = [sx(T.fire.x), sy(T.fire.y)], poke = bump01(u, 0.12, 0.42) * (1 - tw), dz = SS(0.5, 0.9, u) * (1 - SS(0.93, 0.97, u));
      const lean0 = 0.2 + 0.05 * Math.sin(GT * 0.9 + i), stand = P(0.32, -0.47), out = [X + (Fp[0] - X) * 0.5, Yg - 0.3 * H], hand = lerp2(stand, mir(out), poke);
      const ember = [Fp[0], Fp[1] - 6], dn = Math.atan2(ember[1] - hand[1], ember[0] - hand[0]), aim0 = face > 0 ? dn + Math.PI : -dn, aim = -Math.PI / 2 + lean0 + SCX.wrapPi(aim0 + Math.PI / 2 - lean0);
      tg = { R: lerp2(hand, talkR, tw * 0.6) };
      hold = { R: TOOL('town_tool_staff', lerp1(0.5, 0.62, poke), { abs: lerp1(-Math.PI / 2 + lean0, aim, poke) }) };
      headR = (0.32 * dz + 0.1 * poke) * (1 - tw) - 0.05 * tw; lean = face * (0.04 * dz + 0.16 * poke) * (1 - tw); crouch = 14 * poke;
      if (u > 0.27 && u < 0.27 + 1.2 / c.per && tw < 0.5) fx = { k: 'embers', x: Fp[0], y: Fp[1] - 14, a: (u - 0.27) * c.per, seed: c.n * 5 + i };
    } else if (f.role === 'guard') {
      // shifts his weight, now and then looks back over the yard, the spear upright in his hand
      // the look back is the head's alone (TASKS 1032): mirroring the whole guard swung his arm 39 px and the spear across
      const look = (1 - SS(0, 0.5, tw)) * SS(0.52, 0.57, u) * (1 - SS(0.65, 0.7, u));
      // (and once a round lifts the spear and grounds it again, TASKS 1159 note: his arm stood stock still, a figure, not a man on watch)
      const hitch = bump01(u, 0.08, 0.4) * (1 - tw);
      const ground = (1 - tw) * bump01(u, 0.12, 0.34);
      tg = { R: lerp2(P(0.24, -0.42 - 0.01 * Math.sin(GT * 0.7 + i) - 0.14 * ground), talkR, tw * 0.5), L: lerp2(P(-0.2 + 0.05 * Math.sin(2 * Math.PI * u), -0.4 - 0.1 * Math.sin(2 * Math.PI * u + 0.8) ** 2), P(0.1, -0.5), hitch) };
      hold = { R: TOOL('town_tool_spear', 0.58, { abs: -Math.PI / 2 - 0.05 }) };
      lean = 0.025 * Math.sin(2 * Math.PI * u) * face; headR = -0.03 + 0.05 * Math.sin(4 * Math.PI * u) * (1 - look) - 0.06 * look; { const hc = Math.cos(Math.PI * look); headF = (hc < 0 ? -1 : 1) * Math.max(0.55, Math.abs(hc)); }
    } else if (f.role === 'porter' || f.role === 'mason') {
      // the crate: in both hands in front of the chest while he carries it; at a stop he bends, lifts it off the floor or sets it down,
      // only what the sim says he did there (f.lift): a crate is never drawn into or out of hands that did not hold it
      const mason = f.role === 'mason', load = mason ? 'town_tool_stone' : 'town_tool_crate', cw = 0.3 * H, kt = SS(0, 0.22, GT - (f.turnT ?? -9)), chest = [X + face * (2 * kt - 1) * 0.2 * H, Yg - 0.46 * H], act = atStop && f.lift, floor = mason ? (act === 'drop' ? [sx(T.bin.x), sy(T.bin.y) - 30] : P(0.5, -0.5)) : P(0.33, -0.14);
      let k = f.load ? 1 : 0, bend = 0;
      const hang = (sd) => (sd === 'L' ? P(-0.07, -0.5) : P(0.2, -0.43));
      if (act === 'take') { k = SS(0.3, 1.15, pu); bend = bump01(Math.min(pu, 1.6), 0, 1.6); } else if (act === 'drop') { k = 1 - SS(0.35, mason ? 0.95 : 1.2, pu); bend = bump01(Math.min(pu, 1.6), 0, 1.6); }
      const hasCrate = f.load || (act === 'drop' && (!mason || pu < 0.95)), cp = lerp2(floor, chest, k);
      if (hasCrate) { cp[1] -= moving ? 1.2 * Math.abs(Math.sin(f.dist / 14)) : 0; tg = { L: [cp[0] - face * cw * 0.42, cp[1] + 2], R: [cp[0] + face * cw * 0.42, cp[1] + 2] };
        front = () => L.sprite(load, cp[0] - cw / 2, cp[1] - cw / 2, { w: cw, h: cw }); }
      else if (act === 'take') { tg = { L: [cp[0] - face * cw * 0.42, cp[1] + 2], R: [cp[0] + face * cw * 0.42, cp[1] + 2] }; front = () => L.sprite(load, cp[0] - cw / 2, cp[1] - cw / 2, Object.assign({ w: cw, h: cw }, mason ? { u: { alpha: SS(0, 0.25, pu) } } : {})); }
      // hands on a load turn about the load, which crosses the body on its own (TASKS 1636)
      if (hasCrate || act === 'take') turnAbout = cp[0];
      if (act === 'take') { const rw = SS(0, 0.25, pu); if (mason) tg = { L: lerp2(hang('L'), tg.L, rw), R: lerp2(hang('R'), tg.R, rw) }; else freeK = rw; }
      if (tw > 0 && !hasCrate) tg = { R: lerp2(P(0.1, -0.38), talkR, tw) };
      // the stone gone into the bin, his hands come back from it over half a second (TASKS 1418)
      if (mason && act === 'drop' && pu >= 0.95 && pu < 1.6) { const rk = SS(0.95, 1.6, pu); tg = { L: lerp2([floor[0] - face * cw * 0.42, floor[1] + 2], hang('L'), rk), R: lerp2([floor[0] + face * cw * 0.42, floor[1] + 2], hang('R'), rk) }; }
      // the mason's arms are always on IK: released at the first steps from the block, the elbow flipped to the rig's free pose in a frame (TASKS 1616)
      if (mason && (!tg.L || !tg.R)) { const dd = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]), st = 0.8 * (dd(RG.hipL, RG.kneeL) + dd(RG.kneeL, RG.ankleL)) * s, from = route[(f.way + route.length - 1) % route.length], sw = 12 * (f.go ? SS(2, 18, Math.hypot(f.x - from.x, f.y - from.y)) * SS(0, 14, Math.hypot(f.x - stop.x, f.y - stop.y)) : 0) * Math.cos(2 * Math.PI * f.dist / st), free = (sd, q) => [hang(sd)[0] + face * q, hang(sd)[1] - Math.abs(q) * 0.3];
        tg = { L: tg.L || free('L', -sw), R: tg.R || free('R', sw) }; }
      if (mason && act === 'drop' && pu > 0.9 && pu < 1.45) fx = { k: 'dust', x: floor[0], y: floor[1] - 8, amt: 1 - (pu - 0.9) / 0.55, seed: c.n * 2 + i, col: [0.88, 0.82, 0.7], a: 0.8 };
      crouch = (mason ? 14 : 34) * bend; lean = face * 0.3 * bend; headR = 0.15 * bend;
      // between carts he dresses a block with the hammer
      if (mason && atStop && act !== 'take' && !f.load && pu >= 1.7 && tw < 0.99) { const Cr = R.cart || {}, ready = Cr.st === 'at' && Cr.load > 0, w = Math.min(ready ? 1 - SS(Cr.atT ?? -9, (Cr.atT ?? -9) + 0.5, GT) : 1, Math.max(0, Math.min(1, (pu - 1.7) / 0.4))), spare = c.n % 4 === 3, sk = spare ? Math.sin(Math.PI * u) ** 2 : 0, up = (spare ? 0 : 1) * (u < 0.55 ? E01(u / 0.55) : 1 - E01(Math.min(1, (u - 0.55) / (FD.hit - 0.55))));
        tg = { R: lerp2(lerp2(hang('R'), lerp2(P(0.31 + 0.11 * up, -0.46 - 0.32 * up), P(0.1, -0.42), sk), w), talkR, tw), L: lerp2(hang('L'), lerp2(P(0.26, -0.34), P(0.14, -0.72), sk), w) };
        if (w > 0.02) hold = { R: TOOL('town_tool_hammer', 0.84, { abs: lerp1(0.9, lerp1(0.2 - 1.5 * up, 1.3, sk), w), len: SZ('town_tool_hammer')[1] * SS(0, 0.3, w) }) }; lean = face * (0.06 + 0.1 * (1 - up)) * w * (1 - sk); crouch += 5 * (1 - up) * w * (1 - sk); headR += 0.1 * (1 - up) * w;
        const strike = FD.hit; if (!spare && w > 0.5 && u >= strike && (u - strike) * c.per < 0.4 && tw < 0.5) fx = { k: 'spark', x: P(0.52, -0.45)[0], y: P(0.52, -0.45)[1], a: (u - strike) * c.per, seed: c.n * 7 + i }; }
    } else if (f.role === 'child') {
      // at each stop he scatters grain to the hens: a hand into the bag, a throw out in front, the grain falling ahead of him
      const bag = P(0.3, -0.42), throwing = atStop && route && tw < 0.5, dip = P(0.22, -0.44), out = P(0.45, -0.66), rest = P(0.08, -0.33);
      let hr = rest;
      if (throwing) hr = u < 0.3 ? lerp2(rest, dip, E01(u / 0.3)) : u < 0.47 ? lerp2(dip, out, E01((u - 0.3) / 0.17)) : lerp2(out, rest, E01((u - 0.47) / 0.4));
      const away = !stop || !f.go ? 0 : Math.min(SS(0, 30, Math.hypot(f.x - route[(f.way + route.length - 1) % route.length].x, f.y - route[(f.way + route.length - 1) % route.length].y)), SS(0, 30, Math.hypot(f.x - stop.x, f.y - stop.y)));
      tg = { L: bag, R: tw > 0 ? lerp2(hr, talkR, tw) : throwing || away < 1 ? lerp2(hr, handAt('R'), away) : null };
      hold = { L: TOOL('town_tool_grain', 0.45, { abs: -Math.PI / 2 }) };
      if (throwing && u > 0.47 && (u - 0.47) * c.per < 1.4) fx = { k: 'grain', x: out[0], y: out[1], g: Yg, face, a: (u - 0.47) * c.per, seed: c.n * 3 + i };
    } else if (f.role === 'sweeper') {
      // sweeps at each stop: the near hand drives the broom to and fro, the far hand higher up the handle, the bristles on the floor
      const sweeping = !moving && tw < 0.99, ph = 2 * Math.PI * u, L0 = SZ('town_tool_broom')[1], grip = 0.3;
      // the broom eases out of the sweep near the stops, or the hands jumped between the two poses on arriving and setting off (TASKS 1433)
      const away = !route || !f.go ? 0 : Math.min(SS(0, 30, Math.hypot(f.x - route[(f.way + route.length - 1) % route.length].x, f.y - route[(f.way + route.length - 1) % route.length].y)), SS(0, 30, Math.hypot(f.x - stop.x, f.y - stop.y))), carry = Math.max(away, SS(0.6, 0.99, tw));
      const hr = lerp2(P(0.2 + 0.09 * Math.sin(ph), -0.42 + 0.015 * Math.cos(ph)), P(0.2, -0.45), carry);
      const down = Math.min(0.98, (Yg + 1 - hr[1]) / ((1 - grip) * L0)), th = lerp1(Math.asin(down), 0.8 + 0.09 * Math.sin(f.dist / 9), carry);
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
      robe = { lift: 1, headR: lerp1(0.18 * (1 - flask) - 0.12 * flask, -0.05, tw) };
      const burn = bump01(u, 0.5, 0.78) * (1 - tw); if (burn > 0.02) fx = { k: 'flame', hand: 'L', amt: burn, seed: c.n + i, up: 0.1 * H };
      if (page > 0.02 && tw < 0.5) { const q = Math.cos(Math.PI * page), pw = 9 * Math.abs(q), px = book[0] + (q * wf >= 0 ? 0 : -pw), py = book[1] - 3 - 3 * Math.sin(Math.PI * page); Y.push([Lc.y + 1, () => L.solid(Math.round(px), Math.round(py), Math.max(1, pw), 5, [0.84, 0.78, 0.62])]); }
    }
    if (rk > 0) { for (const sd of ['L', 'R']) tg[sd] = lerp2(tg[sd] || handAt(sd), handAt(sd, 0.35), rk);
      if (hold) hold = Object.fromEntries(Object.entries(hold).map(([sd, q]) => [sd, q.abs === undefined ? q : Object.assign({}, q, { abs: lerp1(q.abs, -Math.PI / 2, rk) })]));
      lean *= 1 - rk; crouch *= 1 - rk; headR = lerp1(headR, -0.08, rk); if (robe) robe.headR = lerp1(robe.headR, -0.08, rk); if (rk > 0.3) fx = null; }
    if (tw > 0 && !robe) headR = lerp1(headR, -0.06 + 0.04 * Math.sin(GT * 4.1 + i), tw);
    // struck by the hero's blow (TASKS 1033): a flinch back from it, knees giving, the head ducked, over half a second
    { const a = GT - (f.hitT ?? -9), fl = a >= 0 && a < 0.5 ? Math.sin(Math.PI * a / 0.5) * (1 - a) : 0;
      if (fl > 0) { lean -= face * 0.14 * fl; crouch += 8 * fl; headR += 0.12 * fl; if (robe) robe = Object.assign({}, robe, { headR: robe.headR + 0.12 * fl, lift: (robe.lift || 0) - 3 * fl }); } }
    // a walker turns like a paper figure, over 0.14 s: mirrored in one tick the whole rig jumped by its own width (TASKS 1409)
    const tT = route ? f.turnT : back && GT >= fIn ? (GT >= fOut ? fOut : fIn) : undefined, turnK = tT !== undefined ? SS(0, 0.14, GT - tT) : 1, rigFace = turnK < 1 ? face * Math.sign(turnK * 2 - 1 || 1) * Math.max(0.4, Math.abs(turnK * 2 - 1)) : face;
    drawFolkRig(f, n, nm, X, Yg, H, rigFace, GT, Y, { hold, handTarget: (sd, free) => { const q = tg[sd]; if (!q) return null; const q1 = free && freeK < 1 ? lerp2(free, q, freeK) : q; return [turnAbout + (q1[0] - turnAbout) * rigFace / face, q1[1]]; }, lean, headR, headF, crouch, front, robe, fx });
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
    let d = C.s, x = pts[pts.length - 1][0], y = pts[pts.length - 1][1];
    for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay); if (d <= l) { x = ax + (bx - ax) * d / l; y = ay + (by - ay) * d / l; break; } d -= l; }
    const justTook = ms && !ms.go && ms.lift === 'take' && GT - ms.t0 < 0.45, shown = C.load + (justTook ? 1 : 0), nm = shown >= 3 ? 'cart_tw' : shown === 2 ? 'cart_tw_half' : 'cart_tw_empty', [w, h] = SZ(nm), rolling = C.st === 'down' || C.st === 'up', bob = rolling ? 0.8 * Math.sin(C.s / 6) : 0, k = SS(0, 44, C.s), X = sx(x), Yg = sy(y) + 8;
    const rope = [];
    { let left = C.s; for (let i = 1; i < pts.length && left > 0; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay); for (let q = 0; q < Math.min(l, left); q += 4) rope.push([ax + (bx - ax) * q / l, ay + (by - ay) * q / l]); left -= l; } }
    Y.push([y - 40, () => { for (const [px, py] of rope) L.solid(Math.round(sx(px)), Math.round(sy(py) - 8), 2, 2, [0.6, 0.46, 0.3], 0, 0, 0, 1); }]);
    const tilt = (() => { let d0 = C.s; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay); if (d0 <= l || i === pts.length - 1) { const a = Math.atan2(by - ay, bx - ax), s = Math.abs(Math.cos(a)) * Math.sin(a) * Math.sign(Math.cos(a) || 1); return Math.max(-0.2, Math.min(0.2, s * 0.4)); } d0 -= l; } return 0; })();
    const pulse = (a, dur) => (a >= 0 && a < dur ? Math.sin(Math.PI * a / dur) * (1 - a / dur) : 0), sag = pulse(GT - (C.takeT ?? -9) - 0.45, 0.4), stopK = C.st === 'at' ? pulse(GT - (C.atT ?? -9), 0.4) : 0, end = pts[pts.length - 1], pre = pts[pts.length - 2], back = end[0] >= pre[0] ? -1 : 1;
    const Xc = X + back * 3 * stopK, Yc = Yg + bob + 2.5 * sag + 1.2 * stopK, tilt1 = tilt + 0.05 * sag - back * 0.03 * stopK;
    // the sprites' own wheels cannot turn: two studs on each hub circle it by the distance rolled (town_motion_r6 5)
    const hubs = [[nm === 'cart_tw' ? 0.54 : 0.532, nm === 'cart_tw' ? 0.825 : 0.815], [nm === 'cart_tw' ? 0.83 : 0.815, nm === 'cart_tw' ? 0.714 : 0.69]], wr = 0.11 * w, spin = C.s / wr;
    Y.push([y + 8, () => { L.shadow(Xc, Yg, 0.42 * w, 5, 0.45); L.inked(() => L.sprite(nm, 0, 0, { m: L.M.of(L.M.t(Xc, Yc), L.M.r(tilt1)), pivot: [w / 2, h], w, h, u: { tint: [k * 0.82, k * 0.82, k * 0.82, 1] } }), { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 });
      for (const [hu, hv] of hubs) for (const q of [0, 1]) { const a = spin + q * Math.PI; L.solid(Math.round(Xc + (hu - 0.5) * w + Math.cos(a) * 0.5 * wr * 0.85) - 1, Math.round(Yc + (hv - 1) * h + Math.sin(a) * 0.5 * wr) - 1, 2, 2, [0.72 * k, 0.62 * k, 0.5 * k]); }
      if (shown === 1) L.sprite('town_tool_stone', Xc + 0.04 * w - 7, Yc - 0.71 * h - 7, { w: 14, h: 14, u: { tint: [k * 0.82, k * 0.82, k * 0.82, 1] } }); }]);
  }
  function drawFolkRig(f, n, nm, X, Yg, H, face, GT, Y, o) {
    const id = 'npc' + f.i, seed = f.i * 1.7, fx = o.fx;
    Y.push([f.y, () => { L.shadow(X, Yg + 2, 0.24 * H, 6, 0.45); L.joint(id + '_view', 'face', [face, 0]);
      let hand = null;
      L.inked(() => { const r = RIGS[nm].neck ? MONSTERS.robed({ id, n: nm, x: X, y: Yg, H, t: GT, face, seed, dist: f.dist, vx: f.vx, vy: f.vy, U: {}, hold: o.hold, handTarget: o.handTarget, lift: o.robe && o.robe.lift, headR: o.robe && o.robe.headR })
        : MONSTERS.biped({ id, n: nm, x: X, y: Yg, H, face, t: GT, seed, dist: f.dist, vx: f.vx, vy: f.vy, U: {}, Ufar: {}, hold: o.hold, handTarget: o.handTarget, lean: o.lean, headR: o.headR, headF: o.headF, crouch: o.crouch, front: o.front });
        if (r && fx && fx.hand) hand = r.hand ? r.hand(fx.hand) : r.R2U(r.arms[fx.hand].Hd[0], r.arms[fx.hand].Hd[1]); }, { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 });
      if (fx) SCX.RIM.folk.push(Object.assign({}, fx, hand ? { x: hand[0], y: hand[1] - (fx.up || 0) } : {}));
      if (fx && (fx.k === 'grain' || fx.k === 'dust')) folkDust(fx, GT); }]);
  }
  // the grain the child throws (it arcs out and falls ahead of him, lies a moment and is gone) and the sweeper's dust: drawn in the band
  function folkDust(q, GT) {
    if (q.k === 'dust') { L.puff(q.x, q.y - 3, 11 + 8 * q.amt, q.col || [0.62, 0.55, 0.45], (q.a || 0.42) * q.amt, q.seed % 7); return; }
    for (let j = 0; j < 9; j++) { const vx = q.face * (40 + 60 * rnd(q.seed, j)), vy = -30 - 40 * rnd(q.seed, j + 9), gy = q.g - 2 + 8 * rnd(q.seed, j + 19);
      const T = (vy + Math.sqrt(vy * vy + 2 * 360 * (gy - q.y))) / 360, a = Math.min(q.a, T), x = q.x + vx * a, y = q.y + vy * a + 180 * a * a, k = 1 - SS(T + 0.4, T + 0.9, q.a);
      if (k > 0) L.solid(Math.round(x), Math.round(y), 2, 2, [0.86, 0.74, 0.42], 0, 0, 0, k); } }

  Object.assign(SCX, {
    FOLK0, drawFolk, drawCart });
})(typeof window !== 'undefined' ? window : globalThis);
