// live/scene_actors.js — monsters (the eel, the serpent, the magma kinds, slimes, halos) and props.
// One of the scene's files (ARCHITECTURE.md §4.2): names from earlier files come from SCX at load, calls into later ones go through SCX.
(function (root) {
  const SCX = root.SCX;
  const {
    D, HERO, L, M, SC, SS, SZ, TAU, drawHero, rnd } = SCX;
  // ---------------- monsters (whole sprites for now; rigs land in the next pass) ----------------
  const ELITE = [1.0, 0.32, 0.12], SLIME_FOOT = 184 / 188;
  // an elite glows in its powers' colours: a two-power elite alternates them ring by ring and ember by ember
  const modCol = (e, j = 0) => e.mods && e.mods.length ? D.ELITE_MODS.find((m) => m.id === e.mods[j % e.mods.length]).col : ELITE;
  const EN_TEX = { boss_serpent: 'serpent__body', boss_spider: 'en_spider', boss_necro: 'en_cultist', boss_forge: 'en_brute', boss_colossus: 'en_colossus', skeleton: 'en_skeleton', goblin: 'en_goblin', spider: 'en_spider', cultist: 'en_cultist', ghost: 'en_ghost', brute: 'en_brute', boss: 'en_brute', drowned: 'en_drowned', slime: 'en_slime', slime_s: 'en_slime', crab: 'en_crab', eel: 'en_eel', skel_archer: 'en_skel_archer', skel_mage: 'en_skel_mage', skel_ember: 'en_skeleton', fire_priest: 'en_cultist', imp: 'en_imp', golem: 'en_golem', salamander: 'en_salamander', mimic: 'chest' };
  // per frame: the rim colour of the floor's fire, and the cultists' free hands (view px) for their glow
  const ARROW_H = 32;
  // and the skeleton mages' pearls and gathering hands (TASKS 311): [pearl, palm, gather 0..1]
  // and the smouldering skeletons' fires (TASKS 411): skull, ribs, pelvis, hands
  // the fire priests' staff heads and hands, and the weapons a priest set alight (TASKS 410): [hand, tip or the other fist, blade]
  // and the imps' throwing hands with a spark in them (TASKS 407), the salamanders' mouths and headings (408)
  const RIM = { col: [1, 0.75, 0.4], hands: {}, heads: {}, mages: {}, embers: {}, priests: {}, kindled: {}, imps: {}, salams: {}, folk: [] };
  // how a body goes down, picked by its id: dl s on its feet first (the knees giving, a robe sinking), then dur s to the floor,
  // and a bounce on landing; a heavy body falls slower and the boss slowest
  function deathOf(e) { const v = e.id % 2, ty = e.type;
    if (ty === 'goblin') return v ? { v, dl: 0.25, dur: 0.38, bounce: 0.02, buckle: 1 } : { v, dl: 0, dur: 0.32, bounce: 0.03, buckle: 0.6 };
    if (ty === 'brute' || ty === 'boss') { const k = ty === 'boss' ? 1.35 : 1; return v ? { v, dl: 0, dur: 0.4 * k, bounce: 0.06, buckle: 0.5 } : { v, dl: 0.3 * k, dur: 0.42 * k, bounce: 0.025, buckle: 1 }; }
    if (ty === 'drowned') return v ? { v, dl: 0.3, dur: 0.45, bounce: 0.03, buckle: 1 } : { v, dl: 0.05, dur: 0.42, bounce: 0.035, buckle: 0.6 };
    if (ty === 'cultist' || ty === 'fire_priest') return v ? { v, dl: 0, dur: 0.38, bounce: 0.025, sink: 0 } : { v, dl: 0.32, dur: 0.36, bounce: 0.02, sink: 1 };
    return { v, dl: 0, dur: 0.35, bounce: 0.025, buckle: 0 }; }
  // a drowned under the shallows (TASKS 307): 1 lying under, 0 standing; it sinks back over 0.9 s when it comes home
  // a monster knocked off a plateau (TASKS 401) goes under the same way: down into the lava as it burns, or dropping into the chasm
  const submerged = (e, E, GT) => e.coffinT !== undefined && e.deadT < 0 && GT - e.coffinT < D.COFFIN.rise ? 1 - SS(0, D.COFFIN.rise, GT - e.coffinT) : E.lake && e.deadT < 0 ? (e.st === 'idle' ? 1 : e.st === 'emerge' ? 1 - 0.22 * SS(0.7, 1.2, GT - e.t0) - 0.5 * SS(1.4, D.BOSSES[e.type].rise, GT - e.t0) : e.st === 'wade' ? 0.28 * SS(0, 40, Math.hypot(e.tx - e.x, e.ty - e.y)) : 0) : e.sinkT !== undefined ? SS(0, SIM.DOOM.sink, GT - e.sinkT) : e.fallT !== undefined ? Math.min(1, (GT - e.fallT) / SIM.DOOM.fall) ** 2 : e.deadT >= 0 || !E.lurk ? 0 : e.st === 'lurk' ? SS(0, 0.9, GT - e.t0) : e.st === 'rise' ? 1 - SS(0.05, E.rise * 0.9, GT - e.t0) : 0;
  // what shows of it then: a dark shape swaying under the surface and bubbles that rise and pop in small rings
  function lurkFx(e, x, y, t, sub, col = [0.42, 0.62, 0.66]) { const k = SS(0.3, 0.9, sub);
    L.shadow(x + 3 * Math.sin(t * 0.7 + e.id), y - 3, 25, 8, 0.4 * k);
    for (let j = 0; j < 3; j++) { const per = 1.7 + 0.5 * j, ph = ((t + e.id * 0.37 + j * 0.61) % per) / per, bx = x + (rnd(e.id, j) - 0.5) * 24, by = y - 5 + (rnd(e.id, j + 3) - 0.5) * 8;
      if (ph < 0.22) { const q = ph / 0.22; L.ring(bx, by, 1.5 + 2.5 * q, 1 + 1.6 * q, col, 0.75 * k, 0.45); }
      else if (ph < 0.42) { const q = (ph - 0.22) / 0.2; L.ring(bx, by, 4 + 12 * q, 2 + 5 * q, col, 0.55 * (1 - q) * k, 0.1); } } }
  // ---------------- the eel from the deep (TASKS 310) ----------------
  // one painting of its neck and head (eel__body) bent on three soft bones in the shader: the base at the water (G), the mid-neck
  // (R) and the head (B, riding on the mid-neck), with the lower jaw (eel__jaw) hung at the mouth's hinge where the bones carry it.
  // Everything under the waterline (y) is cut away. Poses are angles in its facing's frame: + leans forward over the snout
  const EEL = { k: 1.12, col: [0.42, 0.62, 0.66], reach: 26 };
  const rotAbout = (p, c, a) => { const dx = p[0] - c[0], dy = p[1] - c[1], cs = Math.cos(a), sn = Math.sin(a); return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs]; };
  function eelPose(e, E, GT, t, h) {
    const u = GT - e.t0, P = { base: 0.05 * Math.sin(t * 1.3 + e.id), mid: 0.08 * Math.sin(t * 1.3 - 0.8 + e.id), head: 0.1 * Math.sin(t * 1.3 - 1.6 + e.id), jaw: 0.06 + 0.05 * Math.sin(t * 2.1 + e.id), sub: 0, dx: 0, dy: 0 };
    const dead = e.deadT >= 0 ? GT - e.deadT : -1, lerp = (a, b, q) => a + (b - a) * q;
    if (dead >= 0) { const q = SS(0, 0.5, dead); return { base: lerp(P.base, 0.45, q), mid: lerp(P.mid, 0.55, q), head: lerp(P.head, 0.6, q), jaw: lerp(P.jaw, 0.8, SS(0, 0.25, dead)) - 0.3 * SS(0.6, 1.2, dead), sub: SS(0.35, 1.5, dead), dx: 0, dy: 0 }; }
    if (e.st === 'deep' || e.st === 'stir') return Object.assign(P, { sub: 1 });
    // it breaks the surface head first, tipped back, and settles upright
    if (e.st === 'rise') { const q = SS(0, E.rise, u); return Object.assign(P, { sub: 1 - SS(0, E.rise * 0.85, u), base: P.base - 0.25 * (1 - q), mid: P.mid - 0.2 * (1 - q), head: P.head - 0.35 * (1 - q), jaw: 0.3 * (1 - q) + P.jaw * q }); }
    // it goes back under in an arc, nose first
    if (e.st === 'dive') { const q = SS(0, E.dive, u); return Object.assign(P, { sub: SS(0.08, E.dive, u), base: P.base + 0.45 * q, mid: P.mid + 0.35 * q, head: P.head + 0.4 * q, jaw: P.jaw * (1 - q) }); }
    const ew = D.windOf(e, e.spit ? E.spit.wind : E.wind), ax = Math.cos(e.aimA || 0), ay = Math.sin(e.aimA || 0);
    // the bite: it coils back into an S with its jaw agape, then the neck snaps out over the shore toward the aim, the head held level
    // as a striking snake's, shuts on the strike's first frames and draws back
    if (!e.spit && (e.st === 'wind' || e.st === 'strike')) {
      const k = e.st === 'wind' ? SS(0, ew, u) : 1, wl = ew + SIM.DT, T = e.st === 'wind' ? u - wl : u, x = SS(-0.08, 0.09, T), back = e.st === 'strike' ? SS(0.16, 0.4, u) : 0, f = x * (1 - back), c = k * (1 - x), r = 1 - k * (1 - back);
      const shut = e.st === 'strike' ? SS(0.02, 0.07, u) * (1 - SS(0.22, 0.4, u)) : 0;
      return Object.assign(P, { base: P.base * r - 0.18 * c + 0.28 * f, mid: P.mid * r - 0.28 * c + 0.3 * f, head: P.head * r + 0.22 * c - 0.38 * f,
        jaw: lerp(P.jaw, 0.75, k) * (1 - shut) * (1 - back) + P.jaw * back, dx: (-8 * c + EEL.reach * f) * ax, dy: (-8 * c + EEL.reach * f) * ay * 0.7 }); }
    // the jet: it rears back, head up and the mouth opening, then whips its head forward and spits; the mouth closes as it settles
    if (e.st === 'wind' || e.st === 'strike') {
      const k = e.st === 'wind' ? SS(0, ew, u) : 1, wl = ew + SIM.DT, T = e.st === 'wind' ? u - wl : u, x = SS(-0.08, 0.06, T), back = e.st === 'strike' ? SS(0.12, 0.4, u) : 0, f = x * (1 - back), c = k * (1 - x), r = 1 - k * (1 - back);
      return Object.assign(P, { base: P.base * r - 0.12 * c + 0.1 * f, mid: P.mid * r - 0.25 * c + 0.15 * f, head: P.head * r - 0.2 * c + 0.08 * f,
        jaw: lerp(P.jaw, 0.3, c) * (1 - x) + (0.3 + 0.5 * f) * x * (1 - back) + P.jaw * back * x, dx: 6 * f * ax, dy: 6 * f * ay * 0.7 }); }
    return P; }
  function drawEel(e, E, x, y, GT, t, o) {
    const RG = RIGS.eel, RB = RIGS.eel__body, dead = e.deadT >= 0 ? GT - e.deadT : -1, k = e.elite ? 1.3 : 1;
    const hA = GT - e.hitT, fl = hA >= 0 && dead < 0 ? SS(0, 0.06, hA) * (1 - SS(0.12, 0.35, hA)) : 0;
    const P = eelPose(e, E, GT, t), s = EEL.k * SZ('en_eel')[1] * k / RG.h, f = e.face || 1, yw = y + 2 + P.dy;
    if (dead > 1.6) return;
    P.mid -= 0.18 * fl; P.head -= 0.25 * fl;
    // under the surface: bubbles now and then where it lies; before it comes up its shadow gathers and the water boils there
    const stir = e.st === 'stir' ? SS(0, 0.5, GT - e.t0) : 0;
    if (dead < 0 && (e.st === 'deep' || e.st === 'stir')) { const kk = e.st === 'deep' ? 0.35 : 0.5 + 0.5 * stir;
      // the shadow: a long dark body coiling just under the surface, drawn twice over so it reads on dark water
      if (stir > 0) { const sw = Math.sin(t * 5 + e.id) * 4; for (let j = 0; j < 2; j++) { L.shadow(x + (6 + sw) * f, y - 2, 22 + 22 * stir, 7 + 6 * stir, 0.7 * stir); L.shadow(x - (16 - sw) * f, y + 1, 12 + 14 * stir, 5 + 3 * stir, 0.55 * stir); }
        L.ring(x, y, 20 + 24 * stir, 7 + 8 * stir, EEL.col, 0.3 * stir, 0.06); }
      for (let j = 0; j < (stir > 0 ? 8 : 2); j++) { const per = (stir > 0 ? 0.45 : 2.6) + 0.25 * j, ph = ((t + e.id * 0.37 + j * 0.61) % per) / per, bx = x + (rnd(e.id, j) - 0.5) * (stir > 0 ? 50 : 24), by = y - 3 + (rnd(e.id, j + 3) - 0.5) * 12;
        if (ph < 0.22) { const q = ph / 0.22; L.ring(bx, by, 1.5 + 3 * q, 1 + 1.8 * q, EEL.col, 0.9 * kk, 0.45); if (stir > 0) L.solid(bx - 1.5, by - 2 - 3 * q, 3, 3, [0.75, 0.9, 0.95], 0, 0, 0, 0.8 * kk); }
        else if (ph < 0.45) { const q = (ph - 0.22) / 0.23; L.ring(bx, by, 4 + 14 * q, 2 + 6 * q, EEL.col, 0.6 * (1 - q) * kk, 0.1); } }
      L.joint('en' + e.id, 'ground', [x, y]); return; }
    // the bones (prepped px of eel__body): base G, mid-neck R, head B
    const [cMid, cBase, cHead] = RB.bones, W = RB.w, H = RB.h;
    const fwd = (p) => rotAbout(rotAbout(rotAbout(p, cHead, P.head), cMid, P.mid), cBase, P.base);
    const sink = P.sub * (RG.base[1] - Math.min(RG.chin[1], RG.snout[1]) + 40) * s, bx = x + P.dx, by = yw + sink, cut = { cut: [yw, 4, 1] };
    const Mb = M.of(M.t(bx, by), M.s(f, 1)), at = (p) => M.ap(Mb, [(p[0] - RG.base[0]) * s, (p[1] - RG.base[1]) * s]);
    const bones = { wtex: G.tex('eel__body_w'), wsz: [W, H], bone0: [cMid[0] / W, cMid[1] / H, P.mid, 1], bone1: [cBase[0] / W, cBase[1] / H, P.base, 1], bone2: [cHead[0] / W, cHead[1] / H, P.head, 1] };
    const alpha = o.alpha, U0 = Object.assign({ alpha, grade: dead >= 0 ? [0.8, 0.75, 0, 1] : o.grade }, dead < 0 ? o.rim : {}, cut), U = Object.assign({}, U0, bones);
    // the jaw: its hinge where the bones carry the mouth's corner, turned with the head and opened about it
    const J = RG.jaw, kj = Math.hypot(RG.chin[0] - RG.hinge[0], RG.chin[1] - RG.hinge[1]) / Math.hypot(J.tip[0] - J.hinge[0], J.tip[1] - J.hinge[1]);
    const a0 = Math.atan2(RG.chin[1] - RG.hinge[1], RG.chin[0] - RG.hinge[0]) - Math.atan2(J.tip[1] - J.hinge[1], J.tip[0] - J.hinge[0]), Hj = fwd(RG.hinge), rot = P.base + P.mid + P.head + a0 + 0.6 * P.jaw;
    const jaw = () => L.sprite('eel__jaw', 0, 0, { m: M.of(Mb, M.t((Hj[0] - RG.base[0]) * s, (Hj[1] - RG.base[1]) * s), M.r(rot), M.s(kj, kj)), w: J.w * s, h: J.h * s, pivot: [J.hinge[0] * s, J.hinge[1] * s], u: Object.assign({}, U0, { alpha: alpha * SS(0.1, 0.32, P.jaw) }) });
    const body = () => { L.sprite('eel__body', 0, 0, { m: Mb, w: W * s, h: H * s, pivot: [RG.base[0] * s, RG.base[1] * s], pad: 0.3, u: U }); jaw(); };
    // the water rings round the neck where it stands in it
    const up = 1 - P.sub; if (up > 0.05) { const nx = at(fwd([RG.base[0], RG.base[1] - 40]))[0];
      for (let j = 0; j < 3; j++) { const q = ((t * 0.7 + j / 3 + e.id * 0.13) % 1); L.ring(nx, yw + 1, 16 + 30 * q, 5 + 10 * q, EEL.col, 0.45 * up * (1 - q) * alpha, 0.08); }
      L.shadow(nx, yw + 2, 26 * up, 7 * up, 0.35 * up * alpha); }
    if (dead < 0) { o.halo(body); if (o.edge) o.rimFlash(body); }
    L.inked(body, { r: 2, n: 8, col: o.INK, dy: 0, emit: true, rim: dead < 0 ? o.edgeOf() : null });
    const JT = (n, p) => L.joint('en' + e.id, n, at(p));
    const jt = M.ap(M.of(M.r(rot), M.s(kj, kj)), [J.tip[0] - J.hinge[0], J.tip[1] - J.hinge[1]]);
    L.joint('en' + e.id, 'ground', [x, y]); JT('top', fwd([RG.hinge[0] - 60, 40])); JT('head', fwd(RG.snout)); JT('jaw', [Hj[0] + jt[0], Hj[1] + jt[1]]);
  }
  function drawSerpent(e, E, x, y, GT, t, o) {
    if (e.st === 'idle') return;
    const RG = RIGS.serpent, RB = RIGS.serpent__body, RT = RIGS.serpent__tail, B = D.BOSSES[e.type], dead = e.deadT >= 0 ? GT - e.deadT : -1, poseT = dead >= 0 ? e.deadT : GT, u = poseT - e.t0;
    if (dead >= 0) t = e.deadT;
    if (dead > 1.6) return;
    const f = e.face || 1, s = 168 / RG.h, col = [0.45, 0.72, 0.76];
    if (dead < 0 && (e.st === 'deep' || e.st === 'stir')) {
      if (e.st === 'stir') { const q = SS(0, B.warn, u);
        for (let j = 0; j < 6; j++) L.shadow(x + Math.cos(j * 0.8 + t) * (20 + 18 * q), y + Math.sin(j * 0.8 + t) * 12, 25, 9, 0.4 + 0.3 * q);
        L.shadow(x, y + 6, 20 + 46 * q, 8 + 18 * q, 0.35 + 0.5 * q);
        const scale = 0.52 + q * 0.12; L.sprite('serpent__body', 0, 0, { m: M.of(M.t(x, y + 4), M.s(f * scale, 0.22 + q * 0.04)), w: RG.w * s, h: RG.h * s, pivot: RG.base.map((v) => v * s), u: { alpha: 0.5 + q * 0.3, grade: [0.15, 0.35, 0, 1], tint: [0.3, 0.7, 0.8, 1] } });
        for (let j = 0; j < 4; j++) { const q2 = (u * 1.4 + j / 4) % 1; L.ring(x, y + 4, 12 + 70 * (1 - q2), (12 + 70 * (1 - q2)) * 0.42, [0.62, 0.9, 0.95], (0.25 + 0.6 * q) * Math.sin(Math.PI * q2), 0.14); }
        for (let j = 0; j < 15; j++) { const q1 = (u * 2 + j / 15) % 1, a = j * 2.4, r = 12 + 38 * rnd(e.id, j);
          L.ring(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.4, 1 + 5 * q1, 1 + 3 * q1, col, 0.8 * (1 - q1), 0.35); }
      }
      L.joint('en' + e.id, 'ground', [x, y]); return;
    }
    const sub = e.endPortrait ? 0 : dead >= 0 ? SS(0, 1.4, dead) : e.st === 'rise' ? 1 - SS(0, B.rise, u) : e.st === 'dive' ? SS(0, B.dive, u) : 0;
    const Mv = D.bossMove(e), attacking = e.st === 'bwind', w = Mv.wind || 1, attackCoil = attacking ? SS(0, w, u) * (1 - SS(w, w + 0.3, u)) : 0;
    const floodCoil = e.floodAt > poseT ? SS(0, 0.35, 1.2 - (e.floodAt - poseT)) * (0.85 + 0.15 * Math.sin(t * 22)) : e.floodT !== undefined && poseT - e.floodT < 0.6 ? (1 - SS(0, 0.6, poseT - e.floodT)) * (0.85 + 0.15 * Math.sin(t * 22)) : 0, coil = Math.max(attackCoil, floodCoil);
    const snap = attacking ? SS(w - 0.1, w + 0.09, u) * (1 - SS(w + 0.15, w + Mv.duration, u)) : 0;
    const hit = dead < 0 ? 0.12 * SS(0, 0.06, GT - e.hitT) * (1 - SS(0.12, 0.35, GT - e.hitT)) : 0;
    let base = 0.045 * Math.sin(t * (Math.PI * 2 / 4.5)) - 0.28 * coil + 0.2 * snap + sub * 0.3;
    let mid = 0.075 * Math.sin(t * (Math.PI * 2 / 4.5) - 0.9) - 0.36 * coil + 0.25 * snap - hit;
    let head = 0.08 * Math.sin(t * (Math.PI * 2 / 4.5) - 1.8) + 0.34 * coil - 0.2 * snap - hit;
    const bite = attacking && e.mv === 'bite' ? SS(w - 0.4, w, u) * (1 - SS(w + 0.08, w + Mv.duration, u)) : 0;
    const [cMid, cBase] = RB.bones, cHead = bite > 0 ? RG.head : RB.bones[2];
    if (bite > 0) {
      const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, Mv.r / d), a = Math.max(-1.55, Math.min(1.55, Math.atan2(dy * 0.7, Math.abs(dx) + 1)));
      const l1 = Math.hypot(cMid[0] - cBase[0], cMid[1] - cBase[1]), l2 = Math.hypot(cHead[0] - cMid[0], cHead[1] - cMid[1]), l3 = Math.hypot(RG.snout[0] - cHead[0], RG.snout[1] - cHead[1]);
      const tx = dx * f * k / s - Math.cos(a) * l3, ty = (dy * k - 40) / s - Math.sin(a) * l3, len = Math.max(1, Math.min(l1 + l2 - 0.01, Math.hypot(tx, ty)));
      const a1 = Math.atan2(ty, tx) - Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + len * len - l2 * l2) / (2 * l1 * len))));
      const a2 = Math.atan2(ty - Math.sin(a1) * l1, tx - Math.cos(a1) * l1);
      const b0 = a1 - Math.atan2(cMid[1] - cBase[1], cMid[0] - cBase[0]), b1 = a2 - Math.atan2(cHead[1] - cMid[1], cHead[0] - cMid[0]) - b0;
      const b2 = a - Math.atan2(RG.snout[1] - cHead[1], RG.snout[0] - cHead[0]) - b0 - b1;
      const mix = (a, b) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * bite;
      base = mix(base, b0); mid = mix(mid, b1); head = mix(head, b2);
    }
    if (dead >= 0 && !e.endPortrait) { const fall = SS(0, 0.5, dead); base += 0.18 * fall; mid += 0.25 * fall; head -= 0.2 * fall; }
    if (e.endPortrait) { base += 0.9; mid += 0.6; head -= 0.5; }
    const forward = (p) => rotAbout(rotAbout(rotAbout(p, cHead, head), cMid, mid), cBase, base);
    const mouth = forward(RG.snout), pin = attacking && e.mv === 'fan' ? SS(w - 0.2, w, u) * (1 - SS(w + 0.08, w + Mv.duration, u)) : 0;
    const bx = x + pin * (50 * f - (mouth[0] - RG.base[0]) * s * f), by = y + 2 + sub * 145 + pin * (-92 - (mouth[1] - RG.base[1]) * s);
    const mat = M.of(M.t(bx, by), M.s(f, 1)), at = (p) => M.ap(mat, [(p[0] - RG.base[0]) * s, (p[1] - RG.base[1]) * s]);
    const cut = { cut: [y + (e.endPortrait ? 300 : 3) + bite * Math.max(0, (e.ty ?? e.y) - e.y), 4, 1] }, U = Object.assign({ alpha: o.alpha, grade: dead >= 0 ? [0.5, 0.65, 0, 1] : o.grade }, o.rim, cut);
    const tailU = e.st === 'recover' ? w + Mv.duration + u : u, tailActive = e.mv === 'tail' && (attacking || (e.st === 'recover' && u < 0.3));
    const tailK = tailActive ? SS(0, 0.4, tailU) * (1 - SS(w + Mv.duration, w + Mv.duration + 0.3, tailU)) : 0;
    const tailSweep = tailActive ? SS(w - 0.08, w + 0.48, tailU) * Math.PI * 2 : 0;
    const body = () => {
      const tails = (pass) => { for (let j = 1; j >= 0; j--) { const a = Math.PI + j * 0.8, tx = x + Math.cos(a) * (60 + j * 32) * f, ty = y + Math.sin(a) * 20 + j * 12 + sub * 145;
        const b = RT.bones[0], k = 0.14 + 0.12 * Math.sin(t * (Math.PI * 2 / 4.5) - j) + 0.3 * snap;
        const sweeping = tailK > 0, angle = e.aimA - Math.PI + tailSweep, r0 = Math.atan2(RG.tail.tip[1] - RG.tail.base[1], RG.tail.tip[0] - RG.tail.base[0]);
        const mt = sweeping && !j ? M.of(M.t(tx + (x + Math.cos(angle) * 25 - tx) * tailK, ty + (y + Math.sin(angle) * 25 - ty) * tailK), M.s(f * (1 + 0.1 * tailK), 1 + 0.1 * tailK), M.r(Math.atan2(Math.sin(Math.atan2(Math.sin(angle), Math.cos(angle) * f) - r0), Math.cos(Math.atan2(Math.sin(angle), Math.cos(angle) * f) - r0)) * tailK)) : M.of(M.t(tx, ty), M.s(f * (j ? -0.75 : 1), j ? 0.75 : 1));
        if ((sweeping && !j && Math.sin(angle) > 0.15 ? 1 : 0) !== pass) continue;
        L.sprite('serpent__tail', 0, 0, { m: mt, w: RG.tail.w * s, h: RG.tail.h * s, pivot: RG.tail.base.map((v) => v * s), pad: 0.3,
          u: Object.assign({}, U, sweeping ? { alpha: o.alpha * (j ? 1 - tailK : 1), cut: [y + 3 + 200 * tailK, 4, 1] } : {}, { wtex: G.tex('serpent__tail_w'), wsz: [RT.w, RT.h], bone0: [b[0] / RT.w, b[1] / RT.h, k, 1] }) });
      } };
      tails(0);
      const xf = e.endPortrait ? 1 : Math.max(SS(0, 0.4, bite), SS(0.02, 0.15, coil), dead >= 0 ? SS(0, 0.15, dead) : 0), soft = () => L.sprite('serpent__body', 0, 0, { m: mat, w: RG.w * s, h: RG.h * s, pivot: RG.base.map((v) => v * s), pad: 0.3,
        u: Object.assign({}, U, { alpha: U.alpha * (1 - xf), wtex: G.tex('serpent__body_w'), wsz: [RB.w, RB.h], bone0: [cMid[0] / RB.w, cMid[1] / RB.h, mid, 1], bone1: [cBase[0] / RB.w, cBase[1] / RB.h, base, 1], bone2: [cHead[0] / RB.w, cHead[1] / RB.h, head, 1] }) });
      if (xf > 0) {
        if (xf < 1) soft();
        const piece = (name, root, pos, a) => L.sprite('serpent__' + name, 0, 0, { m: M.of(mat, M.t((pos[0] - RG.base[0]) * s, (pos[1] - RG.base[1]) * s), M.r(a)),
          w: RG.w * s, h: RG.h * s, pivot: root.map((v) => v * s), pad: 0.3, u: Object.assign({}, U, { alpha: U.alpha * xf }) });
        piece('neckL', cBase, cBase, base);
        piece('neckU', cMid, rotAbout(cMid, cBase, base), base + mid);
        piece('head', cHead, rotAbout(rotAbout(cHead, cMid, mid), cBase, base), base + mid + head);
      } else soft();
      tails(1);
    };
    L.shadow(x, y + 2, 52 * (1 - sub), 14, 0.55 * (1 - sub));
    if (pin > 0.02) { L.shadow(bx, by + 4, 46, 13, 0.5 * pin); for (let j = 0; j < 2; j++) { const q = (t * 1.2 + j / 2) % 1; L.ring(bx, by + 2, 26 + 26 * q, (26 + 26 * q) * 0.36, [0.7, 0.9, 0.92], 0.6 * pin * (1 - q), 0.12); } }
    L.inked(body, { r: 2, n: 8, col: o.INK, dy: 0, emit: true, rim: dead < 0 ? o.edgeOf() : null });
    for (let j = 0; j < 3; j++) { const q = (t * 0.65 + j / 3) % 1; L.ring(x, y + 2, 28 + 45 * q, 10 + 15 * q, col, 0.6 * (1 - q) * (1 - sub), 0.06); }
    if (e.openUntil > GT) for (let j = 0; j < 3; j++) L.star(x + (j - 1) * 17, y - 160 - 4 * Math.sin(t * 6 + j), 6, [0.85, 0.82, 0.5], 0.8);
    L.joint('en' + e.id, 'ground', [x, y]); L.joint('en' + e.id, 'head', at(mouth)); L.joint('en' + e.id, 'top', at(forward(RG.top)));
    if (bite > 0.999 && Math.abs(u - w) < 0.06) { const d = Math.hypot(e.tx - e.x, e.ty - e.y) || 1, k = Math.min(1, Mv.r / d); L.anchor('serpent_bite', [x + (e.tx - e.x) * k, y + (e.ty - e.y) * k - 38], at(mouth), 4); }
    if (pin > 0.999 && Math.abs(u - w) < 0.06) { const [mx, my] = SIM.Q.serpentMouth(e); L.anchor('serpent_mouth', [x + mx - e.x, y + my - e.y], at(mouth), 4); }
    if (attacking && e.mv === 'wave' && Math.abs(u - w) < 0.06) L.anchor('serpent_wave', [x, y - 38], [x, y - 38], 2);
  }
  // the smouldering skeleton's fire (TASKS 411): tongues of flame on its skull, ribs, pelvis and hands, trailing its run, taller
  // and quicker as its fuse burns down
  const EMBER_FIRE = [[10, 17], [13, 19], [8, 12], [6, 10], [6, 10]];
  function emberFire(e, E, pts, GT, t) {
    const q = e.st === 'wind' ? Math.min(1, (GT - e.t0) / D.windOf(e, E.wind)) : 0, trail = -0.12 * e.vx;
    G.blend('emit'); pts.forEach((p, i) => { const fk = (1 + 0.9 * q) * (0.9 + 0.1 * Math.sin(t * (9 + 12 * q) + i * 2 + e.id)), w = EMBER_FIRE[i][0] * fk, hh = EMBER_FIRE[i][1] * fk;
      const ln = trail * (0.6 + 0.2 * i) + 2 * Math.sin(t * 3 + i), y0 = p[1] + hh * 0.3;
      G.draw(L.P.flame, { u_t: t * (1 + q), u_seed: e.id * 7 + i, u_amt: 1, u_col: [1, 0.5 + 0.2 * q, 0.15 + 0.2 * q] }, [w, 0, 0, -ln, hh, 0, p[0] - w / 2 + ln, y0 - hh, 1]); }); G.blend(); }
  const PILLAR_T = D.ENEMIES.fire_priest.pyre.burst + 0.3;
  const flameAt = (x, y, w, hh, col, seed, lean, t) => G.draw(L.P.flame, { u_t: t, u_seed: seed, u_amt: 1, u_col: col }, [w, 0, 0, -lean, hh, 0, x - w / 2 + lean, y - hh, 1]);
  // the fire priest's staff burns in its forked head (TASKS 410)
  function priestFire(e, [head], t) { G.blend('emit'); flameAt(head[0], head[1] + 9, 14, 26, [1, 0.5, 0.16], e.id * 5, -0.06 * e.vx + 2 * Math.sin(t * 2.7 + e.id), t); G.blend(); }
  // a weapon a fire priest set alight: tongues of flame along the blade from the hand to the tip, or on both fists; they die down
  // over the last second
  function weaponFire(e, [p0, p1, blade], GT, t) { const k = Math.min(1, (e.fireT - GT) / 1), ln = -0.08 * e.vx;
    G.blend('emit'); const pts = blade ? [0.35, 0.6, 0.85, 1].map((q) => [p0[0] + (p1[0] - p0[0]) * q, p0[1] + (p1[1] - p0[1]) * q, 1 - 0.3 * q]) : [[...p0, 1], [...p1, 1]];
    pts.forEach(([x, y, s], i) => { const f = (0.6 + 0.4 * k) * s * (0.9 + 0.1 * Math.sin(t * 11 + i * 1.7)); flameAt(x, y + 6 * f, 12 * f, 23 * f, [1, 0.45, 0.12], e.id * 3 + i, ln, t); }); G.blend(); }
  // ---------------- the magma caves' new kinds (TASKS 407–409) ----------------
  // their glowing bits (tools/emitmask.py): drawn again in the pose over the body in the emissive mode
  const GLOWTEX = { imp: 'impE', golem: 'golemE', salamander: 'salamanderE', boss_colossus: 'colossusE' };
  // the salamander swimming (1) or walking (0), eased from when it went into the lava (0.35 s: any slower and it sinks over the bank) or came out of it (0.45 s, TASKS 1177)
  const swimOf = (e, GT) => e.type !== 'salamander' ? 0 : e.lv ? SS(0, 0.35, GT - (e.lvT ?? -9)) : 1 - SS(0, 0.45, GT - (e.lvT ?? -9));
  // how bright: a golem's cracks blaze as its crust comes off and swell through its wind-up, then cool as it lies in its pool; an
  // imp's eyes; a salamander's spots, hotter as it draws breath
  function monGlow(e, E, GT, t) { const dead = e.deadT >= 0 ? GT - e.deadT : -1, u = GT - e.t0;
    if (e.type === 'golem') { const C = E.crust, n = e.crust ?? C.n, w = e.st === 'wind' && dead < 0 ? SS(0, D.windOf(e, E.wind), u) : 0, k = (0.3 + 0.7 * (1 - n / C.n)) * (0.85 + 0.15 * Math.sin(t * 2.3 + e.id)) + 0.4 * w;
      return dead < 0 ? k : 0.9 * (1 - SS(0.3, E.pool.t, dead)); }
    if (e.type === 'imp') return dead < 0 ? 0.9 : 0.9 * (1 - SS(0, 0.6, dead));
    // the colossus's core (TASKS 413) burns hotter each phase, swells through a wind-up and blazes as it comes up out of the lava
    if (e.type === 'boss_colossus') { if (dead >= 0) return 0.9 * (1 - SS(0.5, 3, dead)); const ph = e.phase || 0, w = e.st === 'bwind' ? SS(0, D.bossMove(e).wind, u) : 0;
      return (0.35 + 0.3 * ph) * (0.85 + 0.15 * Math.sin(t * 2.1 + e.id)) + 0.35 * w + (e.st === 'emerge' ? 0.6 * (1 - SS(0, 2.5, u)) : 0); }
    const br = dead >= 0 || !e.br ? 0 : e.st === 'wind' ? SS(0, D.windOf(e, E.breath.wind), u) : e.st === 'strike' ? 1 : 0; return dead < 0 ? 0.4 + 0.5 * br : 0.4 * (1 - SS(0, 1, dead)); }
  // the spark in an imp's hand through the throw's wind-up
  function impSpark(e, E, hand, GT, t) { const q = SS(0, D.windOf(e, E.spark.wind), GT - e.t0);
    L.glow(hand[0], hand[1], 8 + 12 * q, [1, 0.5, 0.12], 0.4 + 0.7 * q, 2.4); L.star(hand[0], hand[1], 5 + 7 * q * (0.8 + 0.2 * Math.sin(t * 40 + e.id)), [1, 0.85, 0.5], 0.5 + 0.5 * q); }
  // a salamander drawing breath: its mouth glows brighter and drips sparks; breathing, a cone of fire rolls out along its aim,
  // tongues running from yellow at the mouth to red at the end, the cone's reach growing over the first tenth of a second
  function breathFx(e, E, [mouth], GT, t) { const B = E.breath, u = GT - e.t0;
    if (e.st === 'wind') { const q = SS(0, D.windOf(e, B.wind), u); L.glow(mouth[0], mouth[1], 10 + 18 * q, [1, 0.45, 0.1], 0.3 + 0.9 * q, 2.2);
      for (let j = 0; j < 4; j++) { const b = (t * 2.2 + rnd(e.id, j)) % 1; L.star(mouth[0] + (rnd(e.id, j + 4) - 0.5) * 12, mouth[1] + 10 * b, 3 + 3 * q * (1 - b), [1, 0.6, 0.2], q * (1 - b)); } }
    else if (e.st === 'strike' && u < B.t) { const grow = SS(0, 0.12, u), fade = 1 - SS(B.t - 0.2, B.t, u), ca = Math.cos(e.aimA), sa = Math.sin(e.aimA) * 0.8;
      L.glow(mouth[0], mouth[1], 22, [1, 0.8, 0.4], 1.1 * fade, 2.4);
      for (let j = 0; j < 18; j++) { const q = ((t * 3.2 + rnd(e.id, j)) % 1) * grow, d = 8 + q * B.reach, sp = (rnd(e.id, j + 30) - 0.5) * 2 * B.arc * q, X = mouth[0] + Math.cos(e.aimA + sp) * d, Y0 = mouth[1] + Math.sin(e.aimA + sp) * d * 0.8 - 8 * q;
        L.glow(X, Y0, 8 + 22 * q, [1, 0.75 - 0.45 * q, 0.25 - 0.18 * q], 0.85 * fade * (1 - 0.6 * q), 2.2); if (j % 3 === 0) L.star(X, Y0, 4 + 4 * (1 - q), [1, 0.9, 0.6], 0.8 * fade * (1 - q)); }
      void ca; void sa; } }
  // ripples round a salamander in the lava: rings of brighter lava spreading from its body, a wake behind it as it swims
  // (bank: how far the floor is, TASKS 490: the rings ran on over the bank; they fade out before it)
  function swimFx(e, E, x, y, sw, GT, t, bank = 1e9) { const fa = e.fa ?? 0, sp = Math.hypot(e.vx, e.vy), L0 = SZ('en_salamander')[1];
    for (let j = 0; j < 3; j++) { const ph = ((t * 0.8 + j / 3 + rnd(e.id, j)) % 1), r = 0.25 * L0 + 0.35 * L0 * ph; if (r > bank) continue; L.ring(x, y, r, r * 0.55, [1, 0.6, 0.2], 0.45 * sw * (1 - ph) * (1 - SS(bank * 0.7, bank, r)), 0.12); }
    if (sp > 8) for (let j = 0; j < 6; j++) { const q = ((t * 1.6 + j / 6) % 1), side = j % 2 ? 1 : -1, d = 0.3 * L0 + 0.5 * L0 * q, w = 0.12 * L0 + 0.3 * L0 * q;
      L.star(x - Math.cos(fa) * d - Math.sin(fa) * side * w, y + (-Math.sin(fa) * d + Math.cos(fa) * side * w) * 0.8, 4 + 3 * (1 - q), [1, 0.65, 0.25], 0.6 * sw * (1 - q) * SS(8, 40, sp)); } }
  // the frame's lava mask and the map's box in target px, for a sunk salamander's clip (TASKS 460)
  let LAVA_CLIP = null;
  // (the mask's edge grows over the bank as it climbs out, TASKS 1171: fading the clip off dropped the whole body on the bank in a frame)
  const swimClip = (sw) => Object.assign({ clipk: SS(0, 0.03, sw), clipr: 96 * Math.max(0, 1 - 2 * (0.5 - Math.sin(Math.asin(1 - 2 * sw) / 3))) }, LAVA_CLIP);
  function drawEnemy(e, x, y, GT, t) {
    const E = D.ENEMIES[e.type], tex = EN_TEX[e.type], [w0, h0] = SZ(window.SIZES['en_' + e.type] ? 'en_' + e.type : tex), k = D.BOSSES[e.type] ? (D.BOSSES[e.type].scale || 1.6) : e.elite ? 1.3 : 1, w = w0 * k, h = h0 * k;
    const dead = e.deadT >= 0 ? GT - e.deadT : -1, hA0 = GT - e.hitT, rapid = e.elite || e.hitT - (e.hitP ?? -9) < 0.3, hit = hA0 >= 0 && hA0 < 0.06 && !rapid, edge = hA0 >= 0 && hA0 < 0.08 && rapid, ew = D.BOSSES[e.type] ? D.bossMove(e).wind : D.windOf(e, E.wind), wind = e.st === 'wind' ? SS(0, ew, GT - e.t0) : e.st === 'bwind' ? SS(0, ew, GT - e.t0) * (1 - SS(ew, ew + 0.15, GT - e.t0)) : 0;
    const sp = Math.hypot(e.vx, e.vy), ph = e.dist / 20 * Math.PI, step = SS(5, 40, sp) * Math.abs(Math.sin(ph));
    const flt = E.ghost ? 6 + 3 * Math.sin(t * 2.3 + e.id) : 0;
    let sx = 1, sy = 1, lean = 0;
    if (dead < 0) { sy = 1 - 0.05 * step + 0.03 * Math.sin(t * 2 + e.id); sx = 1 / Math.sqrt(sy); 
      // lean back through the wind-up, swing forward over 0.1 s on the strike, settle back to upright before the strike ends: no one-frame pops
      // melee bodies swing forward through the impact (centred on it), others on the strike's first frames
      const sd = E.kind === 'lunge' ? 0.45 : 0.32, u = GT - e.t0, mel = E.kind === 'melee', c = mel ? 0.1 : 0, still = E.kind === 'bomber';   // a lit fuse holds the body upright: it bursts from that pose
      lean = (e.st === 'strike' ? (-0.08 + 0.2 * SS(-c, 0.1, u)) * (1 - SS(sd - 0.15, sd, u)) : e.st === 'wind' ? (still ? 0 : -0.08 * wind) + (mel ? 0.2 * SS(ew - 0.1, ew + 0.1, u) : 0) : still ? 0 : -0.08 * wind) * e.face; }
    const alpha = dead < 0 ? (E.ghost ? 0.82 : 1) : E.ghost ? 0.82 * (1 - SS(0.1, 0.9, dead)) : 1 - SS(4.5, 6, dead);
    // a live monster is a dark body with a rim of the fire's colour on its upper-left edge, as in the reference: it reads anywhere
    // in the room, not only inside a pool; bone loses its warm cast
    // in a fire's pool the body is darkened as the hero's is, so the light on it reads as a rim, not a lit figure (TASKS 165); the rim
    // takes the monster's own colour where it has one (a spider's cold blue, a cultist's green), else the biome's fire
    // the fire's colour falls on a monster half bleached, and without the lit pass's 1.6 saturation: the concept's demon stays red, its
    // spider blue and its cultist green in the torchlight (TASKS 185). The tint takes the boosted light to the bleached one
    const sat = e.type === 'skeleton' ? 0.4 : e.type === 'skel_archer' || e.type === 'skel_mage' || e.type === 'skel_ember' ? 0.7 : 0.95, val = (E.val || 1) * (1 - 0.3 * (HERO.kAt ? HERO.kAt(e.x, e.y) : 0));
    const grade = hit ? [0.3, 2.6, 0, 1] : e.burn > GT ? [1.1, 1.15, 0, 1] : wind > 0.5 && Math.sin(GT * 40) > 0 ? [1, 1.5, 0, 1] : [sat, val, 0, 1.05];
    const lt = HERO.lightAt ? HERO.lightAt(e.x, e.y) : null, et = E.tint || [1, 1, 1, 0], own = et.slice(0, 3).map((v) => 1 + (v - 1) * et[3]);
    // (in the magma caves a monster keeps its own colour, TASKS 1046: the caves' and crypt's take-back turned a priest's skull lilac
    // and a golem's torso blue-grey away from the lava; the lit pass holds the light on it)
    const tint = lt && !(SC.state && SC.state.run && SC.state.run.map && SC.state.run.map.cliff) ? HERO.fireTint(e.x, e.y, own) : own;   // (no run on the title screen: TASKS 1046 left it black)
    // bone, horn and eyes stay pale under the fire: a demon's horns lit salmon read as orange, the concept's are tan (TASKS 185)
    const rim = dead < 0 && !hit ? { tint: [...tint, 1], pale: 1 } : {};
    // the lit edge: one art pixel on the side of the whole silhouette that faces the nearest fire, in its colour; in the dark, none
    const edgeOf = () => { const lv = HERO.lavaAt ? HERO.lavaAt(e.x, e.y) : null, L0 = lv && lv.k > (lt ? lt.k : 0) ? lv : lt;
      if (dead >= 0 || hit || !L0 || L0.k < 0.15) return null; const n = Math.hypot(L0.dx, L0.dy * 1.25) || 1, a = 0.4 * SS(0.15, 0.8, L0.k);
      const dir = { dx: Math.round(2 * L0.dx / n), dy: Math.round(2 * L0.dy * 1.25 / n) };
      // (a salamander lies low in the lava: its lit side brighter, TASKS 490: 1.15 of its dark side against 1.3 wanted)
      // (an imp over the lava takes the hero's one-pixel outline pass, TASKS 1717: the silhouette stamped 2 px off broke into dashes along its thin limbs)
      if (L0 === lv) return { ...dir, col: [1, 0.6, 0.22].map((v) => v * (e.type === 'salamander' ? 1.05 : 0.75) * SS(0.15, 0.8, lv.k)), box: e.type === 'imp' ? [2 * Math.round((x - 70) / 2), 2 * Math.round((y - 150) / 2), 140, 170] : undefined };
      const c = E.rim || L0.col, g = 0.3 * c[0] + 0.5 * c[1] + 0.2 * c[2];
      return { ...dir, col: c.map((v) => (g + 0.5 * (v - g)) * a) }; };
    const INK = [0.024, 0.02, 0.024];
    if (E.kind === 'serpent') return drawSerpent(e, E, x, y, GT, t, { alpha, grade, rim, INK, edgeOf });
    if (E.kind === 'eel') return drawEel(e, E, x, y, GT, t, { alpha, grade, rim, edge, hit, INK, edgeOf, halo, rimFlash });
    const sub = submerged(e, E, GT), cut = sub > 0 ? { cut: [y + 3, 5, 1] } : {};
    if (sub > 0 && E.lurk) lurkFx(e, x, y, t, sub);
    if (sub > 0 && E.lake) lurkFx(e, x, y, t, sub, [1, 0.55, 0.18]);
    if (sub > 0.995) { L.joint('en' + e.id, 'ground', [x, y]); return; }
    // (none under a salamander sunk in the lava, TASKS 1054: over the bank by it the shadow read as its body, grey and see-through)
    L.shadow(x, y + 2, w * 0.32 * (1 - sub), 7, 0.45 * alpha * (1 - sub) * (1 - swimOf(e, GT)));
    // a body topples (accelerating, slowed just before the floor), bounces once and lies for seconds before it fades; a ghost dissolves upward
    if (dead >= 0) { if (E.ghost) { const gy = y - flt - 40 * SS(0, 0.9, dead); L.joint('en' + e.id, 'ground', [x, y]); L.joint('en' + e.id, 'top', [x, gy - h * (1 + 0.3 * dead)]);
        if (dead < 0.9) L.sprite(tex, 0, 0, { m: M.of(M.t(x, y - flt - 40 * SS(0, 0.9, dead)), M.s(e.face * (1 - 0.2 * dead), 1 + 0.3 * dead)), w, h, pivot: [w / 2, h], u: { alpha, grade: [1.3, 1.3, 0, 1] } }); return; }
      if (E.blood === 'slime') { const q = SS(0, 0.3, dead); L.joint('en' + e.id, 'ground', [x, y]); L.joint('en' + e.id, 'top', [x, y - h * SLIME_FOOT * (1 - 0.85 * q)]); if (dead > 0.5) return;
        L.sprite(tex, 0, 0, { m: M.of(M.t(x, y)), w, h, pivot: [w / 2, h * SLIME_FOOT], pad: 0.6, u: { alpha: 1 - SS(0.2, 0.5, dead), grade: [1, 0.8, 0, 1], jelly: [0.5, SLIME_FOOT, 1 - 0.85 * q, 1] } }); return; }
      if (dead > 6) return; const DV = deathOf(e), d0 = dead - DV.dl, q = Math.max(0, Math.min(1, d0 / DV.dur)), land = DV.dl + DV.dur, dk = 0.7 + 0.3 * (1 - SS(0.2, 1, dead));
      const fall = 2.6 * q * q - 1.6 * q * q * q - (dead > land ? DV.bounce * Math.sin(Math.PI * Math.min(1, (dead - land) / 0.16)) : 0);
      // away from the killing blow: a body that fell the way it faced landed on the hero who killed it
      const away = Math.cos(e.dieA ?? (e.face > 0 ? Math.PI : 0)) >= 0 ? 1 : -1; x += away * 10 * SS(0, 0.15, dead);
      const ca = fall * 1.3 * away, cs = 1 - 0.3 * SS(DV.dl, land, dead), CJ = (n, d) => L.joint('en' + e.id, n, [x + Math.sin(ca) * d * cs, y - Math.cos(ca) * d * cs]);
      L.joint('en' + e.id, 'ground', [x, y]); CJ('mid', h / 2); CJ('top', h);
      const corpse = () => L.sprite(tex, 0, 0, { m: M.of(M.t(x, y), M.r(ca), M.s(e.face, cs)), w, h, pivot: [w / 2, h], u: { alpha, grade: [dk, dk * 0.9, 0, 1] } });
      if (MONSTERS.rigOf(e.type)) { const dk2 = [dk, dk * 0.9, 0, 1];
        L.inked(() => MONSTERS.draw(e, E, x, y, GT, { id: 'en' + e.id, H: h, face: e.face, lean: 0, fallR: ca, death: DV, U: { alpha, grade: dk2 }, Ufar: { alpha, grade: [dk * 0.85, dk * 0.72, 0, 1] }, t }), { r: 2, n: 8, col: INK, dy: 0, emit: true });
        if (GLOWTEX[e.type]) { const k = monGlow(e, E, GT, t); if (k > 0.01) { G.blend('emit'); MONSTERS.draw(e, E, x, y, GT, { id: 'en' + e.id, H: h, face: e.face, lean: 0, fallR: ca, death: DV, U: { alpha: k * alpha }, Ufar: { alpha: k * alpha }, t, tex: GLOWTEX[e.type] }); G.blend(); } }
        return; }
      L.inked(corpse, { r: 2, n: 8, col: INK, dy: 0, emit: true }); return; }
    // turning about narrows the body to a sliver and opens it the other way over 0.16 s instead of mirroring in one frame
    const tA = GT - (e.ft ?? -9), tc = tA < 0.16 ? -Math.cos(Math.PI * SS(0, 0.16, tA)) : 1, tw = Math.sign(tc || 1) * Math.max(0.12, Math.abs(tc));
    if (tw < 1 && E.kind !== 'crab' && E.kind !== 'salamander') L.pre = M.of(M.t(x, y), M.s(tw, 1), M.t(-x, -y));   // the crab turns on the floor (monsters.js)
    try { drawLive(); } finally { L.pre = null; }
    // an elite's aura: its own silhouette, blurred and glowing, breathing and flickering behind the body
    function halo(draw) { if (!e.elite || D.BOSSES[e.type]) return; const pu = 0.5 + 0.5 * Math.sin(t * 2.6 + e.id);
      const sps = []; for (const [ri, [R0, n, a0]] of [[11, 12, 0.1], [7, 10, 0.16], [3.5, 8, 0.28]].entries()) for (let i = 0; i < n; i++) { const an = i * 2 * Math.PI / n + t * 0.8, r = R0 * (1 + 0.35 * pu) + 1.2 * Math.sin(t * 7 + i * 2.1);
        sps.push({ dx: Math.cos(an) * r, dy: Math.sin(an) * r * 1.2 - 2 - 2 * pu, a: a0 * (0.75 + 0.25 * pu), lod: 0.8, ink: modCol(e, ri) }); }
      L.stamp(draw, sps); }
    // a blow landing within 0.3 s of the last one only lights the silhouette's edge: a body flashed solid white the whole time a
    // hero keeps hacking hides its own wind-up
    function rimFlash(draw) { const sps = []; for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; sps.push({ dx: Math.cos(an) * 3.5, dy: Math.sin(an) * 3.5, a: 0.85 * (1 - hA0 / 0.08), lod: 0, ink: [1, 0.95, 0.85] }); } L.stamp(draw, sps); }
    function drawLive() {
    if (E.mimic) return drawMimic();
    if (E.blood === 'slime') return drawSlime();
    if (MONSTERS.rigOf(e.type)) { const hA = GT - e.hitT, fl = hA >= 0 ? SS(0, 0.08, hA) * (1 - SS(0.12, 0.32, hA)) : 0;   // a hit flinches the upper body away from the hero
      const Ur = Object.assign({ alpha, grade }, rim, cut), Uf = Object.assign({ alpha, grade: hit ? grade : [grade[0] * 0.85, grade[1] * 0.72, 0, 1] }, cut), dy = sub * h * 1.02;
      const sw = swimOf(e, GT); if (sw > 0) { Ur.grade = [Ur.grade[0], Ur.grade[1] * (1 - 0.3 * sw), 0, Ur.grade[3]]; if (e.st === 'soak' && e.soaked) Ur.alpha = alpha * (1 - 0.5 * SS(0, 0.5, GT - e.soakT) * SS(0.5, 0.9, sw)); }   // (solid again as it heaves out, TASKS 1054: it rose as a see-through pale fill)
      // (a salamander sunk in the lava shows only over the open lava, TASKS 460: not over a slab or the bank by it)
      // (the clip on or off within a few frames, TASKS 1054: eased over the whole swim, half way the body lay over the bank as a grey
      // see-through shape; and its glow is clipped as its body is, else it lit the bank in a flat pale fill)
      let clip = null; if (sw > 0 && e.type === 'salamander' && LAVA_CLIP) { clip = swimClip(sw); Object.assign(Ur, clip); Object.assign(Uf, clip); }
      const P = (p) => (L.pre ? M.ap(L.pre, p) : p);
      const rig = () => { const r = MONSTERS.draw(e, E, x, y + dy, GT, { id: 'en' + e.id, H: h, face: e.face, lean: lean - 0.14 * fl * e.face, crouch: 6 * fl, fallR: 0, U: Ur, Ufar: Uf, t, rise: 1 - sub, swim: sw });
        if (r && r.head && E.lake) RIM.heads[e.id] = P(r.head);
        if (r && r.arms && e.type === 'imp' && e.st === 'wind' && !e.claw) RIM.imps[e.id] = P(r.R2U(r.arms.R.Hd[0], r.arms.R.Hd[1])); if (r && r.mouth) RIM.salams[e.id] = [r.mouth, r.fa]; if (r && r.priest) RIM.priests[e.id] = [r.staffHead, r.handR]; else if (r && r.handR) RIM.hands[e.id] = r.handR; if (e.fireT > GT && MONSTERS.wpn['en' + e.id]) RIM.kindled[e.id] = MONSTERS.wpn['en' + e.id]; if (r && r.palm) RIM.mages[e.id] = [r.pearl, r.palm, r.gather]; if (r && r.fire) RIM.embers[e.id] = r.fire; };
      halo(rig); if (edge && !(sw > 0)) rimFlash(rig); L.inked(rig, { r: 2, n: 8, col: INK, dy: 0, emit: true, rim: sw > 0 ? null : edgeOf() }); if (RIM.embers[e.id]) emberFire(e, E, RIM.embers[e.id], GT, t); if (RIM.priests[e.id]) priestFire(e, RIM.priests[e.id], t); if (RIM.kindled[e.id]) weaponFire(e, RIM.kindled[e.id], GT, t);
      if (GLOWTEX[e.type]) { const k = monGlow(e, E, GT, t); if (k > 0.01) { G.blend('emit'); MONSTERS.draw(e, E, x, y + dy, GT, { id: 'en' + e.id, H: h, face: e.face, lean: lean - 0.14 * fl * e.face, crouch: 6 * fl, fallR: 0, U: Object.assign({ alpha: k * alpha }, clip), Ufar: Object.assign({ alpha: k * alpha }, clip), t, tex: GLOWTEX[e.type], swim: sw }); G.blend(); } }
      return; }
    // the mimic (TASKS 367): the chest cut at its lid line (its own parts once generated) on a hinge at the back, a body, a jaw, teeth and
    // a tongue. It squats and gapes through the wind-up, flies with its mouth open and bites shut as it lands
    function drawMimic() {
      const J = E.jump, u = GT - e.t0, ewM = D.windOf(e, E.wind), lerp = (a, b, q) => a + (b - a) * q, crawl = SS(4, 30, sp), LID = 0.46;
      const own = window.ASSETS.mimic__lid && window.ASSETS.mimic__base, lidT = own ? 'mimic__lid' : tex, baseT = own ? 'mimic__base' : tex;
      let a = 0.14 + 0.05 * Math.sin(t * 3.1 + e.id), z = 0, sq = 1 + 0.02 * Math.sin(t * 2.3 + e.id), tilt = 0.06 * crawl * Math.sin(e.dist / 7);
      if (e.st === 'rise') { const q = SS(0, E.rise, u); a = lerp(0, 0.95, SS(0.1, 0.55, q)) * (1 - SS(0.7, 1, q)) + 0.14 * SS(0.7, 1, q); z = 14 * Math.sin(Math.PI * SS(0.2, 0.9, q)); sq = lerp(0.85, 1, q); tilt = 0.1 * Math.sin(u * 38) * (1 - q); }
      else if (e.st === 'wind') { const q = SS(0, ewM, u); a = lerp(a, 1, q); sq = lerp(sq, 0.78, q); tilt = lerp(tilt, -0.14, q); }
      else if (e.st === 'strike' && u < J.t) { const q = u / J.t; z = q < 0.5 ? J.h * Math.sin(Math.PI * q) ** 2 : J.h * Math.sin(Math.PI * q); a = lerp(1, 1.15, SS(0, 0.5, q)) * (1 - SS(0.72, 0.98, q)); sq = 0.78 + 0.4 * SS(0, 0.6, q) - 0.12 * SS(0.6, 1, q); tilt = lerp(-0.14, 0.2, q); }
      else if (e.st === 'strike') { const v = u - J.t; a = 0.14 * SS(0, J.land, v); sq = 1 - 0.18 * Math.exp(-v / 0.07) * Math.cos(30 * v); tilt = 0.2 * (1 - SS(0, 0.16, v)); }
      const hA = GT - e.hitT; if (hA >= 0 && hA < 0.3) { tilt -= 0.1 * (1 - hA / 0.3); a += 0.2 * (1 - hA / 0.3); }
      const sy2 = sq, sx2 = 1 / Math.sqrt(sq), B = M.of(M.t(x, y - z), M.s(e.face * sx2, sy2), M.r(tilt)), bh = h * (1 - LID), lh = h * LID, hx = -w / 2 + 3, hy = -bh + 1, Lm = M.of(B, M.t(hx, hy), M.r(-a));
      const Hs = M.ap(B, [hx, hy]), tipL = M.ap(Lm, [w - 4, 0]), Bm = M.ap(B, [w / 2 - 3, hy]), A = Math.atan2(tipL[1] - Hs[1] + Bm[1] - Hs[1], tipL[0] - Hs[0] + Bm[0] - Hs[0]), th = Math.max(2, Math.hypot(tipL[0] - Bm[0], tipL[1] - Bm[1]));
      if (a > 0.06) { L.solid(Hs[0], Hs[1] - th / 2, w * 0.94, th, [0.16, 0.03, 0.04], A, 0, th / 2);
        const wag = Math.sin(t * 7 + e.id) * 0.25, tl = w * 0.48 * SS(0.1, 0.7, a); L.solid(Hs[0], Hs[1] - 3, tl, 6, [0.62, 0.14, 0.16], A + 0.1 * e.face + wag * e.face, 0, 3); L.joint('en' + e.id, 'tongue', [Hs[0] + Math.cos(A + 0.1 * e.face + wag * e.face) * tl, Hs[1] + Math.sin(A + 0.1 * e.face + wag * e.face) * tl]); }
      const parts = () => { L.sprite(baseT, 0, 0, { m: B, w, h: bh, pivot: [w / 2, bh], src: own ? undefined : [0, LID, 1, 1], u: Object.assign({ alpha, grade }, rim) }); L.sprite(lidT, 0, 0, { m: Lm, w, h: lh, pivot: [3, lh - 1], src: own ? undefined : [0, 0, 1, LID], u: Object.assign({ alpha, grade }, rim) }); };
      halo(parts); if (edge) rimFlash(parts); L.inked(parts, { r: 2, n: 8, col: INK, dy: 0, emit: true, rim: edgeOf() });
      if (a > 0.08) for (let i = 0; i < 5; i++) { const f = (i + 0.7) / 5.4, lo = M.ap(B, [hx + f * (w - 6), hy]), up = M.ap(Lm, [f * (w - 6), -1]), c = [0.86, 0.8, 0.62]; L.solid(lo[0] - 1.5, lo[1] - 5, 3, 5, c); L.solid(up[0] - 1.5, up[1], 3, 5, c); }
      if (a > 0.3 && !L.sp) { G.blend('add'); for (const sd of [0.3, 0.55]) { const p = M.ap(Lm, [w * sd, lh * 0.5]); L.glow(p[0], p[1], 7, [1, 0.8, 0.25], 0.7); } G.blend(); }
      const J2 = (n, p) => L.joint('en' + e.id, n, p); J2('ground', [x, y]); J2('top', M.ap(B, [0, -h])); J2('head', M.ap(Lm, [w * 0.55, lh * 0.5])); J2('hip', M.ap(B, [0, -bh * 0.5])); J2('jaw', Hs); J2('lidTip', tipL); J2('baseTip', Bm);
    }
    // the slime (TASKS 308) is one painting on a soft bone (art/softbones.json) squashed and stretched about its foot in the shader
    // (u_jelly): it breathes and ripples as it creeps, squats through the wind-up, shoots up stretched and leans along the hop,
    // lands squashed and wobbles out; a blow dents it
    function drawSlime() {
      const lerp = (a, b, q) => a + (b - a) * q, ring = (t0, A, hz, tau) => { const v = GT - t0; return v >= 0 && v < 6 * tau ? A * SS(0, 0.06, v) * Math.exp(-v / tau) * Math.sin(TAU * hz * v) : 0; };
      const J = E.jump, u = GT - e.t0, ew = D.windOf(e, E.wind), sp = Math.hypot(e.vx, e.vy), crawl = e.st === 'strike' ? 0 : SS(4, 30, sp), dir = Math.cos(e.aimA) >= 0 ? 1 : -1;
      let k = 1 + 0.03 * Math.sin(t * 2.4 + e.id) * (1 - crawl) + 0.08 * crawl * Math.sin(e.dist / 8), bend = 0.1 * crawl * Math.sign(e.vx) + 0.04 * Math.sin(t * 1.7 + e.id), z = 0;
      if (e.st === 'wind') { const q = SS(0, ew, u); k = lerp(k, 0.68, q) + 0.025 * q * (1 - SS(ew - 0.12, ew, u)) * Math.sin(u * 50); bend = lerp(bend, -0.12 * dir, q); }
      // the arc eases up out of the squat (sin²) and falls on at speed (sin); the squash takes the fall on at the same speed in the
      // top and brings it to rest, then a damped spring sets it level: no jolt at take-off or landing
      else if (e.st === 'strike' && u < J.t) { const q = u / J.t; z = q < 0.5 ? J.h * Math.sin(Math.PI * q) ** 2 : J.h * Math.sin(Math.PI * q); k = 0.68 + 0.52 * SS(0, 0.7, q) - 0.08 * SS(0.7, 0.88, q) + 0.04 * SS(0.88, 1, q);
        bend = lerp(-0.12 * dir, 0.15 * dir * (1 - 2 * q), SS(0, 0.3, q)) * SS(0, 0.3, 1 - q); }
      else if (e.st === 'strike') { const v = u - J.t, km = 0.66, k0 = 1.16, tq = 2 * (k0 - km) * h * SLIME_FOOT * J.t / (Math.PI * J.h), w = TAU * 1.8, tau = 0.09;
        k = v < tq ? km + (k0 - km) * (1 - v / tq) ** 2 : 1 - (1 - km) * Math.exp(-(v - tq) / tau) * (Math.cos(w * (v - tq)) + Math.sin(w * (v - tq)) / (w * tau)); bend = 0; }
      k += ring(e.hitT, -0.09, 3.5, 0.14); bend += ring(e.hitT, 0.07 * (e.face || 1), 3, 0.16);
      const [tw, th] = [G.tex('en_slime_w').w, G.tex('en_slime_w').h], bones = window.ASSETS.en_slime_w ? { wtex: G.tex('en_slime_w'), wsz: [tw, th], bone0: [0.5, SLIME_FOOT, bend, 1] } : {};
      L.joint('en' + e.id, 'ground', [x, y]); L.joint('en' + e.id, 'top', [x + Math.sin(bend) * h * k, y - z - h * k * SLIME_FOOT]);
      const body = () => L.sprite(tex, 0, 0, { m: M.of(M.t(x, y - z)), w, h, pivot: [w / 2, h * SLIME_FOOT], pad: 0.35, u: Object.assign({ alpha, grade, jelly: [0.5, SLIME_FOOT, k, 1] }, rim, bones) });
      halo(body); if (edge) rimFlash(body); L.inked(body, { r: 2, n: 8, col: INK, dy: 0, emit: true, rim: edgeOf() });
    }
    // an unrigged body (the ghost) is knocked back off the blow on a spring and leans away from it; the tail lashes
    const kA = GT - e.hitT, kick = kA >= 0 && kA < 0.6 ? SS(0, 0.08, kA) * Math.exp(-kA / 0.14) * Math.cos(TAU * 3 * kA) : 0;
    x -= e.face * 6 * kick; lean -= 0.2 * kick * e.face;
    const J = (n, d) => L.joint('en' + e.id, n, [x + Math.sin(lean) * d * sy, y - flt - Math.cos(lean) * d * sy]);
    L.joint('en' + e.id, 'ground', [x, y]); J('mid', h / 2); J('top', h);
    // the ghost bends its one painting (soft bones): the tail trails its motion on a slow wave, the near claw reaches through the wind-up
    let bones = {};
    if (E.ghost && window.ASSETS.en_ghost_w) { const sp = Math.hypot(e.vx, e.vy), [tw, th] = [G.tex('en_ghost_w').w, G.tex('en_ghost_w').h];
      const tail = 0.12 * Math.sin(t * 2.2 + e.id) + 0.05 * Math.sin(t * 3.7 + e.id * 2) + 0.3 * SS(0, 60, sp) + 0.25 * kick, reach = -0.7 * wind + 0.06 * Math.sin(t * 1.9 + e.id);
      bones = { wtex: G.tex('en_ghost_w'), wsz: [tw, th], bone0: [190 / 361, 198 / 409, tail, 1], bone1: [266 / 361, 148 / 409, reach, 1] };
      // the bent tips for the trace: texture px turned about their roots as the shader turns them, then placed like the sprite
      const tp = (q, c, a) => { const dx = q[0] - c[0], dy = q[1] - c[1], u = c[0] + dx * Math.cos(a) - dy * Math.sin(a), v = c[1] + dx * Math.sin(a) + dy * Math.cos(a);
        const X = (u / 361 - 0.5) * w * sx * e.face, Y = (v / 409 - 1) * h * sy; return [x + X * Math.cos(lean) - Y * Math.sin(lean), y - flt + X * Math.sin(lean) + Y * Math.cos(lean)]; };
      L.joint('en' + e.id, 'tail', tp([205, 395], [190, 198], tail)); L.joint('en' + e.id, 'claw', tp([330, 250], [266, 148], reach)); }
    const body = () => L.sprite(tex, 0, 0, { m: M.of(M.t(x, y - flt), M.r(lean), M.s(sx * e.face, sy)), w, h, pivot: [w / 2, h], u: Object.assign({ alpha, grade }, rim, bones) });
    halo(body); if (edge) rimFlash(body); if (E.ghost) body(); else L.inked(body, { r: 2, n: 8, col: INK, dy: 0, emit: true, rim: edgeOf() });
    }
  }

  // ---------------- props ----------------
  // gold is an emitter (TASKS 192): drawn again over itself in the 'emit' mode at alpha GOLD_EM, the colour stays and the lit pass
  // mixes it GOLD_EM of the way from lit to self-lit, so a torch's orange no longer turns the coins copper; the stamp leans yellow
  const GOLD_EM = 1, GOLD_TINT = [1, 1.14, 0.6, 1], emitted = (draw) => { G.blend('emit'); draw(GOLD_EM); G.blend(); };
  SC.endActors = (r, win, t, x, y) => {
    HERO.fireTint = HERO.lightAt = HERO.kAt = null; HERO.k = 0; HERO.lift = 1;
    const enemy = (actor, px, py, dead) => {
      const gt = t + 100, e = Object.assign({ id: 990, x: 0, y: 0, vx: 0, vy: 0, dist: 0, face: -1, st: 'idle', t0: -9, hitT: -9, hitP: -9, burn: 0, deadT: dead ? gt - (actor.type === 'boss_serpent' ? 0.6 : actor.type === 'boss_colossus' ? 0.35 : 2) : -1, dieA: 0 }, actor);
      const k = dead ? 0.85 : 160 / (SZ(EN_TEX[e.type])[1] * (D.BOSSES[e.type] ? (D.BOSSES[e.type].scale || 1.6) : e.elite ? 1.3 : 1));
      L.pre = M.of(M.t(px, py), M.s(k, k), M.t(-px, -py));
      try { drawEnemy(e, px, py, gt, t); } finally { L.pre = null; }
    };
    if (win) {
      // the fallen lord behind and aside, the hero large and lit in front of him: the two never merge into one dark shape (TASKS 235)
      // the run's last boss: the serpent ends the campaign too (TASKS 339), the magma caves' lord theirs (399)
      const lb = D.stageOf(r.mode, D.runOf(r.mode).floors).boss, sea = lb === 'boss_serpent';
      enemy({ type: sea || D.BOSSES[lb] ? lb : 'boss', elite: sea ? 0 : 1, st: 'chase', mv: 'wave', endPortrait: sea }, x - 90, y - 5, true);
      if (r.hero) {
        const h = Object.assign({}, r.hero, { vx: 0, vy: 0, gp: 0, face: 1, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 });
        const hx = x + 35, hy = y + 70;
        G.blend('add'); L.glow(hx, hy - 70, 120, [0.95, 0.7, 0.35], 0.28); G.blend(); L.shadow(hx, hy + 2, 46, 9, 0.6);
        L.pre = M.of(M.t(hx, hy), M.s(1.5, 1.5), M.t(-hx, -hy));
        try { drawHero(h, hx, hy, t, r.heroStats, { id: 'victor', victory: true }); } finally { L.pre = null; }
      }
    } else {
      const last = (r.damage || []).slice(-1)[0]; if (last && last.actor) enemy(last.actor, x, y, false);
    }
  };
  // a chest's rank at a glance (TASKS 1356): its own painting once generated, until then the plain chest recoloured
  const CHEST_LOOK = { 1: { k: 1, u: { grade: [0.8, 0.88, 0, 1] } }, 2: { tex: 'chest_iron', k: 1.15, u: { grade: [0.45, 1.02, 0, 1.15], tint: [0.8, 0.92, 1.2, 0.55] } }, 3: { tex: 'chest_gold', k: 1.2, u: { grade: [1.35, 1.2, 0, 1.12], tint: [1.3, 1.02, 0.45, 0.6] } } };
  // a mimic that is still a chest shivers now and then: a careful eye can tell it from the real thing
  const mimicTwitch = (c, t) => { const ph = (t + c.x * 0.011 + c.y * 0.017) % 6.1; return ph < 0.5 ? { rot: 0.035 * Math.sin(ph * 42) * (1 - ph / 0.5), dx: 0, sy: 1, fl: 0 } : undefined; };
  const CHEST_BOSS = { tex: 'chest_boss', k: 1.35, u: { grade: [1, 0.85, 0, 1.25], tint: [1, 0.32, 0.3, 0.7] } };
  const chestLook = (c) => (c.boss ? CHEST_BOSS : CHEST_LOOK[Math.min(3, c.tier)] || CHEST_LOOK[1]);
  // what is left of a broken thing (TASKS 1352): crates and barrels go to planks, pots and vases to cuts of their own painting; each piece
  // flies its arc off the blow's moment and then lies where it fell, for as long as the floor lasts. Pure in (x, y, age)
  const DEBRIS_T = 0.42;
  function debris(x, y, seed, a, wood, tex, n, sp = 1) { for (let i = 0; i < n; i++) { const an = rnd(seed, i) * TAU, far = (wood ? 14 + 26 * rnd(seed, i + 40) : 8 + 22 * rnd(seed, i + 40)) * sp, lx = x + Math.cos(an) * far, ly = y + 3 + Math.sin(an) * far * 0.62;
      const q = Math.min(1, Math.max(0, a) / DEBRIS_T), arc = 4 * q * (1 - q) * (26 + 22 * rnd(seed, i + 7)), px = x + (lx - x) * q, py = y - 10 * (1 - q) + (ly - y) * q - arc, rest = (rnd(seed, i + 13) - 0.5) * (wood ? 1.1 : 3.1), rot = rest + (1 - q) * (rnd(seed, i + 19) - 0.5) * 16, tone = 0.72 + 0.22 * rnd(seed, i + 23);
      if (wood) { const small = i >= 5, w = (small ? 8 + 5 * rnd(seed, i + 3) : 20 + 12 * rnd(seed, i + 3)), h = w * 210 / 952 * (small ? 1.5 : 1.15); L.sprite(i % 2 ? 'plank_b' : 'plank_a', 0, 0, { m: M.of(M.t(px, py), M.r(rot)), w, h, pivot: [w / 2, h / 2], u: { grade: [0.9, tone, 0, 1] } }); }
      else { const c = 4, u0 = i % c / c, v0 = Math.floor(rnd(seed, i + 5) * c) / c, S0 = 12 + 7 * rnd(seed, i + 9); L.sprite(tex, 0, 0, { m: M.of(M.t(px, py), M.r(rot)), w: S0, h: S0, pivot: [S0 / 2, S0 / 2], src: [u0, v0, u0 + 1 / c, v0 + 1 / c], u: { grade: [0.95, tone, 0, 1] } }); } } }
  const PROP_H = { pot: 'pot', barrel: 'barrel', crate: 'crate', gold: 'treasure', goldpile: 'shop_gold', vase_a: 'vase_a', vase_b: 'vase_b', vase_c: 'vase_c' };
  // standing props share the actors' one dark contour; flat floor clutter and wall fittings lie on stone that already frames them
  const NO_INK = new Set(['bones', 'torch_sconce']);
  // the basalt props drawn this frame (TASKS 1036): they take the basalt's cold light in the lit pass as the crossings do
  // (and the boulders, and an iron rail's links and stakes as solids, TASKS 1052: brown and orange beside the grey basalt)
  const BAS_PROPS = new Set(['basalt_a', 'basalt_b', 'forge_mg', 'boulder_mg_a', 'boulder_mg_b']), PROP_BAS = [], OCC_SOLIDS = [];
  // how far the deck the hero walks sags under him this frame (TASKS 1042: his feet kept the ground's line while it bent 9 px)
  const DECK = { dy: 0 }; SC.deckDy = () => DECK.dy; SC.deckTgt = () => DECK.tgt;   // (read by tools/motioncheck.mjs bridgeStep)
  function drawProp(n, x, y, o = {}) { const [w, h] = SZ(n), k = o.k || 1, j = o.j;
    if (BAS_PROPS.has(n) && !j) PROP_BAS.push([n, x - w * k / 2, y - h * k + (o.dy || 0), w * k, h * k, !!o.flip]);
    const draw = () => { if (!j) { L.sprite(n, x - w * k / 2, y - h * k + (o.dy || 0), { w: w * k, h: h * k, flip: o.flip, u: o.u }); return; }
      const W = w * k, H = h * k * j.sy, u = j.fl > 0 ? Object.assign({}, o.u, { tint: [2.2, 2, 1.8, j.fl] }) : o.u;
      L.sprite(n, 0, 0, { m: M.of(M.t(x + j.dx, y + (o.dy || 0)), M.r(j.rot)), w: W, h: H, pivot: [W / 2, H], flip: o.flip, u }); };
    if (NO_INK.has(n)) draw(); else L.inked(draw, { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 }); }
  // a knocked prop's recoil about its foot, away from the blow (s): wood rocks, metal rattles, stone shudders, crystal rings, sacks slump
  const KNOCK = {
    fungus: (a, s) => ({ rot: s * 0.13 * Math.exp(-5 * a) * Math.sin(16 * a), dx: 0, sy: 1 - 0.06 * Math.exp(-7 * a) }),
    wood: (a, s) => ({ rot: s * 0.1 * Math.exp(-5 * a) * Math.sin(20 * a), dx: 0, sy: 1 - 0.03 * Math.exp(-8 * a) * Math.sin(20 * a) }),
    metal: (a, s) => ({ rot: s * 0.05 * Math.exp(-3.5 * a) * Math.sin(34 * a), dx: s * 1.5 * Math.exp(-10 * a) * Math.sin(60 * a), sy: 1 }),
    stone: (a, s) => ({ rot: s * 0.015 * Math.exp(-8 * a) * Math.sin(40 * a), dx: s * 2.5 * Math.exp(-12 * a) * Math.sin(70 * a), sy: 1 }),
    crystal: (a, s) => ({ rot: s * 0.03 * Math.exp(-4 * a) * Math.sin(26 * a), dx: 0, sy: 1 + 0.04 * Math.exp(-6 * a) * Math.sin(30 * a) }),
    cloth: (a, s) => ({ rot: s * 0.04 * Math.exp(-6 * a) * Math.sin(16 * a), dx: 0, sy: 1 - 0.1 * Math.exp(-6 * a) * Math.sin(16 * a) }) };
  const BLOOD = (type) => (D.ENEMIES[type] || {}).blood;
  const knockOf = (e, T) => { const a = T - e.t; if (a < 0 || a >= 1.5 || !KNOCK[e.mat]) return null; const j = KNOCK[e.mat](a, e.s); j.fl = 0.6 * (1 - SS(0.03, 0.12, a)); return j; };

  Object.assign(SCX, {
    modCol, EN_TEX, ARROW_H, RIM, deathOf, submerged, PILLAR_T, flameAt, swimOf, swimClip, impSpark, breathFx, swimFx, drawEnemy, GOLD_TINT, emitted,
    chestLook, mimicTwitch, debris, DEBRIS_T, PROP_H, PROP_BAS, OCC_SOLIDS, DECK, drawProp, BLOOD, knockOf });
  Object.defineProperties(SCX, { LAVA_CLIP: { get: () => LAVA_CLIP, set: (v) => { LAVA_CLIP = v; } } });
})(typeof window !== 'undefined' ? window : globalThis);
