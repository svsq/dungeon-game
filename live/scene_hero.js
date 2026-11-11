// live/scene_hero.js — the hero: cut-out rig with planted foot paths, IK knees, swinging arms, a held weapon; swingPose.
// One of the scene's files (ARCHITECTURE.md §4.2): names from earlier files come from SCX at load, calls into later ones go through SCX.
(function (root) {
  const SCX = root.SCX;
  const {
    D, L, M, SC, SS } = SCX;
  // ---------------- the hero: cut-out rig (partrig.py) with planted foot paths, IK knees, swinging arms, a held weapon ----------------
  const WEAPON = { sword: ['it_sword', 46], longsword: ['it_longsword', 53], axe: ['it_axe', 48], hammer: ['it_hammer', 51], staff: ['it_staff', 58], wand: ['it_wand', 40], shortbow: ['it_bow_s', 48], longbow: ['it_bow_l', 36], crossbow: ['it_crossbow', 46], fist: null };
  const NOCKS = { it_bow_s: [[0.894, 0.174], [0.255, 0.863]], it_bow_l: [[0.937, 0.072], [0.096, 0.941]] };
  const HERO_H = 84, STEP = SIM.K.STEP || 22;
  // what the hero wears (TASKS 155): each slot picks the rig parts painted for its base (tools/gear.py), '' = the hero as first drawn
  // (plate armour, leather gloves, iron boots); a helmet is a whole head, drawn over a body without its own; the shield rides the far forearm
  const GEAR = { armor: { '': 'cl', leather_armor: 'le', plate_armor: '', cloak: 'hd', robe: 'hd' }, gloves: { '': 'cl', leather_gloves: '', gauntlets: 'pl' },
    boots: { '': 'cl', boots: 'le', iron_boots: '' }, helm: { leather_helm: 'le', knight_helm: 'kn' } };
  // a class drawn on its own parts has its own table (TASKS 1114): the mage's robe is his parts as drawn, a cloak his hooded set
  const GEARS = { hero: GEAR, mage: { armor: { robe: '', leather_armor: 'le', cloak: 'hd' }, gloves: {}, boots: {}, helm: { circlet: 'ci' } },
    // (the archer starts in leather: it is his jacket as drawn, so his own look is the first seen, TASKS 1124 critic)
    archer: { armor: { leather_armor: '', cloak: 'hd' }, gloves: {}, boots: {}, helm: { leather_helm: 'le' } } };
  const SHIELD = { shield: ['it_shield', 30], buckler: ['it_buckler', 22], tower_shield: ['it_shield_t', 44], orb: ['it_orb', 26] };
  const SLOT_OF = { uarm: 'armor', thigh: 'armor', farm: 'gloves', shin: 'boots', foot: 'boots' };
  function gearOf(h) {
    const pn = D.clsOf(h).look.rig + '__', eq = h.eq || {}, b = (k) => (eq[k] ? eq[k].b : ''), tex = (n, sfx) => (sfx && window.ASSETS[pn + n + '_' + sfx] ? pn + n + '_' + sfx : pn + n);
    const GE = GEARS[D.clsOf(h).look.rig] || GEAR, sfx = { armor: GE.armor[b('armor')] ?? '', gloves: GE.gloves[b('gloves')] ?? '', boots: GE.boots[b('boots')] ?? '' };
    const helm = window.ASSETS[pn + 'head_' + GE.helm[b('helm')]] ? GE.helm[b('helm')] : undefined;
    // a better piece is tinted toward its rarity: uncommon green .. legendary gold, just enough to tell at a glance
    const rar = (k) => { const it = eq[k]; return it && it.rar > 0 ? [...D.RARITY[it.rar].col, 0.12 + 0.06 * it.rar] : null; };
    const part = (n) => { const slot = SLOT_OF[n.slice(0, -1)]; return { tex: tex(n, sfx[slot]), tint: rar(slot) }; };
    const nh = helm ? '_nh' : '', body = (v) => (window.ASSETS[pn + v + (sfx.armor ? '_' + sfx.armor : '') + nh] ? pn + v + (sfx.armor ? '_' + sfx.armor : '') + nh : pn + v);
    const sh = SHIELD[b('offhand')];
    return { part, body: body('body'), back: body('body_back'), helm: helm || null, helmTint: rar('helm'), shield: sh, shieldTint: rar('offhand') };
  }
  SC.gearOf = gearOf;
  function heroPose(h, GT, st) {
    const RG = RIGS[D.clsOf(h).look.rig], s = HERO_H / RG.h, sp = Math.hypot(h.vx, h.vy), run = SS(10, 150, sp) * (h.deadT >= 0 ? 1 - SS(0, 0.15, GT - h.deadT) : 1);
    const dirx = sp > 1 ? h.vx / sp : 0, diry = sp > 1 ? h.vy / sp : 0;
    // (dead, the sim stops his stride's phase in a frame: the render runs it on at his speed, eased out over the run's own fade, or a
    // hero killed mid-run stopped his legs and cape dead, TASKS 1803)
    const sl = SIM.Q.stepLen(Math.abs(dirx)), dT = h.deadT >= 0 ? GT - h.deadT : 0, p = (h.gp || 0) + (dT > 0 ? sp / sl * Math.PI * 0.08 * (1 - Math.exp(-dT / 0.08)) : 0), u0 = ((p / (2 * Math.PI)) % 1 + 1) % 1;
    return { RG, s, run, dirx: dirx * h.face, diry, p, u0, sl };
  }
  // the melee swing in rig angles: a short pull back, an ease-in strike that crosses the aim on the sim's damage frame (K.HIT),
  // a follow-through that bleeds the speed off, then a recovery that turns the blade flat toward the camera before it travels
  // back to guard, so its way home never reads as a second sweep in any direction. It starts from the end of the arc nearer the
  // rest pose (an aim straight up is an uppercut), which keeps the wind-up short in every direction.
  const SWING = { pull: 0.09, follow: 0.09, end: 0.5, back: 0.35, over: 0.5 }, TAU = Math.PI * 2;
  const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
  function swingPose(T, saRaw, arc, rest, from) {
    const sa = Math.PI / 2 + wrapPi(saRaw - Math.PI / 2), lo = sa - arc / 2, hi = sa + arc / 2;
    const dir = Math.abs(wrapPi(lo - rest)) <= Math.abs(wrapPi(hi - rest)) ? 1 : -1, start = dir > 0 ? lo : hi, end = dir > 0 ? hi : lo;
    const a0 = start - dir * SWING.back, th = arc + SWING.back, Ta = SWING.pull;
    const Ts = Ta + (SIM.K.HIT - Ta) / Math.pow((arc / 2 + SWING.back) / th, 1 / 1.5), vEnd = 1.5 * th / (Ts - Ta), Tf = Ts + SWING.follow;
    const follow = (x) => end + dir * SWING.over * (1 - Math.exp(-x * vEnd / SWING.over));   // leaves the strike at its speed, settles SWING.over past the arc
    let blade, k = 1, bend, fs = 1;
    if (T < Ta) { const q = SS(0, Ta, T), b0 = from ? from.blade : rest, k0 = from ? from.k : 0; k = k0 + (1 - k0) * q; blade = b0 + wrapPi(a0 - b0) * q; bend = 1.1; }
    else if (T < Ts) { const e = Math.pow((T - Ta) / (Ts - Ta), 1.5); blade = a0 + dir * th * e; bend = 1.1 - 0.95 * e; }
    else if (T < Tf) { blade = follow(T - Ts); bend = 0.15 + 0.15 * SS(Ts, Tf, T); }
    else { const bf = follow(Tf - Ts), u = (T - Tf) / (SWING.end - Tf), q = SS(0, 1, u), d0 = wrapPi(rest - bf), d1 = d0 - Math.sign(d0) * TAU;
      const via = (d, x) => { let t = wrapPi(x - bf); if (d < 0 && t > 0) t -= TAU; if (d > 0 && t < 0) t += TAU; return Math.abs(t) <= Math.abs(d); };   // the blade lowers past the hip
      blade = bf + (via(d0, Math.PI / 2) || Math.abs(d1) > 1.25 * Math.PI ? d0 : d1) * SS(0.15, 0.75, u); k = 1 - q; bend = 0.3; fs = 1 - 0.6 * SS(0, 0.2, u) * (1 - SS(0.6, 0.95, u)); }
    return { blade, k, bend, fs, dir, start, end, Ts, Tf, arm: T < Tf ? blade : follow(Tf - Ts) };   // arm: the arm follows the blade until the recovery, then lowers from the end pose
  }
  const DEPTH_K = 0.65;   // the 3/4 camera's squeeze of floor depth
  // the slash crescent's half-span about the aim, and where its brightness centroid sits along it (the ARC shader's taper and tail fade)
  const ARC_HALF = 1.35, ARC_MID = 0.52;
  // the whirl's turn (0..1) over WHIRL_T s: speeds up and slows down over 0.1 s, so the blade neither starts nor stops dead
  const WHIRL_T = 0.4, whirlP = (t) => { const a = 0.1, v = 1 / (WHIRL_T - a); t = Math.max(0, Math.min(WHIRL_T, t));
    return t < a ? v * t * t / (2 * a) : t < WHIRL_T - a ? v * (t - a / 2) : 1 - v * (WHIRL_T - t) ** 2 / (2 * a); };
  SC.swingPose = swingPose; SC.SWING = SWING; SC.hide = {};   // hide: QA-only switches (weapon, hero) for render-twice checks
  // the hero's paint under the light: his own lantern lights him wherever he stands, so his paint is taken down, not lifted (at 1.3 he
  // read as a pink-white blot, TASKS 197), a little less by a fire; HSAT keeps his steel from taking the fire's orange.
  // k: how lit the hero already is (0 dark .. 1 by a fire), which takes his key light back off
  const HERO = { lift: 0.85, k: 0 }, HSAT = 0.8;
  // through a hoard's thin crust (TASKS 484): he goes down into the lava to the chest where he stood, then comes up over the bank's lip
  // on the firm ground he climbs out onto, both cut at the surface
  // (TASKS 1043: he went in to the chest and was moved half under; now wholly under before he is moved, arms flung up, and up over
  // the bank's lip with them first)
  const sinkOf = (h, GT, Y) => { const e2 = (v) => Math.round(v / 2) * 2; if (h.sunk) { const a = GT - h.sunk.t; return { dy: e2(120 * SS(0, 0.45, a) ** 1.5), cut: [Y + 4, 3, 1], arms: SS(0, 0.12, a) }; }
    // (from below his whole height and his raised blade, TASKS 1049, 1058: half of him popped in in a frame, then his sword and shield;
    // the raised hands come over the lip first)
    if (h.climbT !== undefined && GT - h.climbT < 0.55) { const a = GT - h.climbT; return { dy: e2(130 * (1 - SS(0, 0.55, a))), cut: [Y + 2, 2, 1], arms: 1 - SS(0.3, 0.55, a) }; } return { dy: 0 }; };
  function drawHero(h, hx, hy, GT, st, o = {}) {
    const pn = D.clsOf(h).look.rig + '__', P = heroPose(h, GT, st), { RG, s, run } = P, gx = RG.gap, gy = RG.footL[1];
    const atkT = GT - h.atkT, swinging = atkT >= 0 && atkT < SWING.end, castT = GT - h.castT, casting = castT < 0.5 && !['whirl', 'charge', 'cry'].includes(h.castK);
    // whirl: the hand and blade sweep a ground ellipse at waist height around the body from the aim, behind it while pointing away;
    // eased in from the current pose and out of a crouch
    const wt = GT - h.whirlT, whirlE = wt >= 0 ? SS(0, 0.14, wt) * (1 - SS(WHIRL_T, WHIRL_T + 0.14, wt)) : 0, wa0 = h.whirlA ?? h.aim;
    const wTh0 = Math.atan2(Math.sin(wa0) / DEPTH_K, Math.cos(wa0)), whirlTh = wTh0 + Math.PI * 2 * whirlP(wt);
    // a turn mirrors the rig in one frame: narrowing it through a sliver read as a flat cut-out card spinning; the cape swings out instead
    const fX = h.face, face = h.face;
    // the charge crouches through its 0.06 s before the rush, the cry draws breath before the shout (TASKS 1183); the leap is a hop, not a slide (TASKS 1160)
    const crouch = h.castK === 'charge' ? SS(0, 0.05, castT) * (1 - SS(0.05, 0.12, castT)) : 0, cryPrep = h.castK === 'cry' ? SS(0, 0.08, castT) * (1 - SS(0.1, 0.18, castT)) : 0;
    // (the hop leaves and meets the floor at rest, a little after the dash: a sine left and landed at full speed, the whole body
    // jumped 9 % of the height in a frame at both ends, TASKS 1702)
    const HOP_T = 1.4 * SIM.K.DASH_T, leapQ = h.leapV && h.leapV[0] === h.dashT ? Math.max(0, Math.min(1, (GT - h.dashT) / HOP_T)) : 1, hop = Math.sin(Math.PI * leapQ) ** 2, landT = h.leapV && h.leapV[0] === h.dashT ? GT - h.dashT - HOP_T : -1, landC = landT >= 0 && landT < 0.12 ? Math.sin(Math.PI * landT / 0.12) : 0;
    const pdx = P.dirx * face * h.face;
    const hurt = GT - h.hurtT < 0.12, alpha = o.alpha === undefined ? 1 : o.alpha;
    // body: hip rides the stance leg (low at double support), slow breath at rest
    const dbl = 0.5 + 0.5 * Math.cos(4 * Math.PI * P.u0), breath = (1 - run) * Math.sin(GT * 2.1) * 0.9;
    const bodyDy = run * (2.6 - 0.9 * Math.abs(pdx)) * dbl;
    // dash and hurt lean the upper body about the hip (the feet stay planted): eased in and out, never a one-frame switch
    const dA = GT - h.dashT, dashE = SS(0, (h.castK === 'charge' && GT - h.castT < 0.5) || leapQ < 1 ? 0.15 : 0.09, dA) * (1 - SS(0.14, 0.3, dA)), dashF = h.dashX * face >= -0.2 ? 1 : -1;
    const hA = GT - h.hurtT, hurtE = h.deadT >= 0 ? 0 : SS(0, 0.07, hA) * (1 - SS(0.12, 0.3, hA));
    // standing, the upper body sways slowly about the hip (two slow waves, so it never reads as a metronome)
    // (a blow follows the last one's weight: a new one 0.47 s after the last dropped it to the idle pose for a frame, TASKS 1125)
    const swOf = (T) => (T >= 0 && T < SWING.end ? SS(0, 0.06, T) * (1 - SS(SWING.end - 0.1, SWING.end, T)) : 0), swE = Math.max(swOf(atkT), h.patkT < h.atkT ? swOf(GT - h.patkT) : 0);
    const idle = (1 - run) * (1 - dashE) * (1 - hurtE) * (1 - swE) * (h.deadT >= 0 ? 1 - SS(0, 0.15, GT - h.deadT) : 1), sway = idle * (0.022 * Math.sin(GT * 0.83) + 0.01 * Math.sin(GT * 1.37 + 1));
    // every 4–5 s the weight moves onto the other leg: the hip slides toward it and the free heel lifts
    const wsh = 2 * SS(-0.35, 0.35, Math.sin(GT * 1.43) + 0.3 * Math.sin(GT * 0.61)) - 1, hipDx = 10 * wsh * idle;
    const heel = { L: 0.06 * idle * SS(0.3, 1, wsh), R: 0.06 * idle * SS(0.3, 1, -wsh) };
    // (eased in and out, and slow enough that one frame's shudder is not a break in the pose, TASKS 1702)
    const cryShake = h.castK === 'cry' ? 0.04 * Math.sin(GT * 40) * SS(0.14, 0.26, castT) * (1 - SS(0.48, 0.6, castT)) : 0;
    const W = WEAPON[st.wtype];
    // a class that shoots from this weapon (the mage's staff, TASKS 1115) does not swing it: the arm brings the staff up toward the aim,
    // crystal first, over the bolt's frame (raised in the 0.13 s to it, the hand jumped 7 % of the height a frame), holds it a moment and lowers it; at rest it stands more upright than a blade
    // a shot follows the last one's envelope (the wand fires every 0.36 s: the new shot's raise starting at 0 dropped the staff in a frame)
    const shooter = (D.clsOf(h).shoots || []).includes(st.wtype), BT = D.SHOTS[(D.BASES[st.wtype] || {}).shot || 'bolt'].t, rise0 = (T) => { const x = Math.max(0, Math.min(1, T / BT)); return 0.5 * x * (2 - x) + 0.5 * x * x * (3 - 2 * x); }, shotEnv = (T) => (T >= 0 && T < SWING.end ? rise0(T) * (1 - SS(BT + 0.06, SWING.end - 0.02, T)) : 0);
    // a crossbow is not drawn: it is shouldered, its stock along the shot, the far hand under the fore-stock (TASKS 1711)
    const xbow = shooter && st.wtype === 'crossbow' && !!window.ASSETS[W[0] + '_h'];
    const bowArm = shooter && !!(D.BASES[st.wtype] || {}).dex, drawE = bowArm && !xbow && swinging ? SS(0.02, BT, atkT) * (1 - SS(BT, BT + 0.08, atkT)) : 0;
    const shootE = shooter && swinging ? Math.max(shotEnv(atkT), h.patkT < h.atkT ? shotEnv(GT - h.patkT) : 0, atkT < BT ? Math.min(1, shotEnv(GT - h.patkT) + shotEnv(atkT)) : 0) : 0;
    // (a bow raised for the volley in 0.07 s jumped the hands 13 % of the height a frame, though its arrows leave at once, TASKS 1702)
    const castE = casting ? SS(0, h.castK === 'leap' ? 0.2 : bowArm ? 0.13 : h.castK === 'frost' ? 0.17 : 0.24, castT) * (1 - SS(0.3, 0.5, castT)) : 0;
    // (TASKS 1800) a shot or a cast is done with the body, not the arm alone: the torso leans back on the draw or the raise by `b`, is
    // thrown forward by `f` on the loose, the far foot steps back; each class its own sizes (rel: the loose, s after the action begins)
    const rangedOf = (T, rel, b, f) => { if (!(T >= 0) || T > rel + 0.45) return 0; const out = SS(rel - 0.02, rel + 0.07, T);
      return (-b * SS(0, Math.max(0.06, rel), T) * (1 - out) + f * out) * (1 - SS(rel + 0.12, rel + 0.42, T)); };
    const stepOf = (T, rel) => (T >= 0 && T < rel + 0.45 ? SS(0, 0.09, T) * (1 - SS(rel + 0.2, rel + 0.45, T)) : 0);
    const RB = !shooter ? [0.08, 0.14] : xbow ? [-0.05, -0.1] : bowArm ? [0.12, 0.1] : [0.07, 0.13];
    const CK = { frost: [0.08, 0.16, 0.07], fireball: [shooter ? 0.14 : 0.18, 0.1, 0.14], volley: [0.12, 0.12, 0.08] }[h.castK];
    const pShot = shooter && h.patkT < h.atkT ? GT - h.patkT : -1, shotLean = shooter && swinging ? rangedOf(atkT, BT, RB[0], RB[1]) + rangedOf(pShot, BT, RB[0], RB[1]) * (1 - SS(0, 0.08, atkT)) : 0;
    const castLean = casting && CK ? rangedOf(castT, CK[0], CK[1], CK[2]) : 0;
    const rangedLean = (shotLean + castLean) * face, rangedStep = Math.max(shooter && swinging ? Math.max(stepOf(atkT, BT), stepOf(pShot, BT)) : 0, casting && CK ? stepOf(castT, CK[0]) : 0) * (1 - run);
    // the whirl turns the torso with the blade: it leans after it round the turn (its back view is shown while the blade is behind)
    const whirlLean = whirlE > 0 ? 0.15 * whirlE * Math.cos(whirlTh) : 0;
    const bodyR = 0.25 * dashE * (Math.abs(h.dashX) > 0.3 ? Math.sign(h.dashX) : 0) + 0.15 * hurtE * (h.hurtX || 0) + sway * face - 0.14 * cryPrep * face + cryShake - 0.16 * hop * face + rangedLean + whirlLean;
    // death keeps the rig: the knees buckle (the hip drops, IK folds them), the arms fling, then the whole body falls back about the feet,
    // accelerating but slowed just before the floor so it lands with a small bounce instead of a board's slap
    // (TASKS 1803) killed on the run (over half his running speed) he pitches forward the way he ran and skids 0.3 of his height; the
    // mage sinks to his knees before he goes over; the archer twists a quarter round, his back to us, and falls forward onto his face
    const du = h.deadT >= 0 ? GT - h.deadT : -1, cls = D.clsOf(h).look.rig, dsp = Math.hypot(h.vx, h.vy), ran = du >= 0 && dsp > 0.5 * SIM.K.RUN;
    const twist = cls === 'archer' && !ran, fDir = ran ? (Math.abs(h.vx) > 0.3 * dsp ? Math.sign(h.vx) * face : 1) : twist ? 1 : -1, kneel = cls === 'mage' && !ran ? 0.22 : 0, late = kneel + (twist ? 0.14 : 0);
    const buckle = du >= 0 ? SS(0, 0.15 + kneel, du) : 0, fq = Math.min(1, Math.max(0, (du - 0.12 - late) / 0.35));
    const fallR = du < 0 ? 0 : fDir * face * (0.1 * buckle + 1.32 * (2.4 * fq * fq - 1.4 * fq * fq * fq) - (du > 0.47 + late ? 0.03 * Math.sin(Math.PI * Math.min(1, (du - 0.47 - late) / 0.16)) : 0));
    const fc = Math.cos(fallR), fs = Math.sin(fallR), skid = ran ? fDir * face * 0.3 * HERO_H * SS(0, 0.45, du) : 0;
    const root = [hx + skid, hy - 24 * hop], R2S = (px, py, dy = 0) => { const x = fX * (px - gx) * s, y = (py - gy) * s + dy; return [root[0] + x * fc - y * fs, root[1] + x * fs + y * fc]; };
    const dk = du >= 0 ? 1 - 0.25 * SS(0.4, 1.2, du) : 1, ft = [1, 1, 1, 0], LK = D.clsOf(h).look, lt0 = LK.cold && HERO.lightAt ? HERO.lightAt(h.x, h.y) : null, cold = lt0 && !(SC.state && SC.state.run && SC.state.run.town) ? SS(1.2, 1, lt0.all[0] / Math.max(0.02, lt0.all[1])) : 0, U = { alpha, tint: cold && ft[3] ? [ft[0] * (1 - LK.cold.red * cold), ft[1], ft[2], ft[3]] : ft, grade: hurt ? [0.4, 2.4, 0, 1] : [(LK.sat || HSAT) * (1 - (1 - (LK.cold?.sat ?? 1)) * cold) * dk, HERO.lift * (1 - (1 - (LK.cold?.lift ?? 1)) * cold) * dk, 0, 1] }, Ufar = { alpha, tint: ft, grade: hurt ? [0.4, 2.4, 0, 1] : [0.85 * HSAT * dk, 0.72 * HERO.lift * dk, 0, 1] };
    if (o.cut) U.cut = Ufar.cut = o.cut;
    const GR = gearOf(h), tinted = (u, t) => (t ? Object.assign({}, u, { tint: [0, 1, 2].map((i) => (u.tint ? 1 + (u.tint[i] - 1) * u.tint[3] : 1) * (1 + (t[i] - 1) * t[3])).concat(1) }) : u);   // a piece's rarity over the fire's tint
    const part = (n, pivotRig, at, rot, u = U, k = 1, up = 0) => { const g = GR.part(n); return L.sprite(g.tex, 0, 0, { u: tinted(u, g.tint), m: M.of(M.t(at[0], at[1]), M.r(fallR + up), M.s(fX, 1), M.r(rot), M.s(1, k)), w: RG.w * s, h: RG.h * s, pivot: [pivotRig[0] * s, pivotRig[1] * s] }); };
    const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
    const dist2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const id = o.id || 'hero';
    // ---- legs: foot targets in rig px: rest ankle + travel × sweep in stance, eased forward with a lift in the swing ----
    const legs = {}, tg = {};
    for (const side of ['L', 'R']) {
      const A0 = RG['ankle' + side], u = ((P.u0 + (side === 'L' ? 0 : 0.5)) % 1), A = P.sl / 2 / s * run;   // half a step in rig px: stance slides back at body speed
      // (TASKS 1802: the longer step tilts the leg in depth by 0.88 of its travel; at 1 the knee folded 29° a frame walking down)
      let off, lift = 0;
      if (u < 0.5) off = A * (1 - 4 * u); else { const w = (u - 0.5) * 2, e = SS(0.12, 0.95, w); off = -A + 2 * A * e; lift = Math.pow(Math.sin(Math.PI * w), 0.6) * (13 + 2 * Math.abs(pdx)) * run; }
      tg[side] = { tx: A0[0] + off * pdx + (side === 'L' ? -9 : 9) * (1 - run * 0.6), ty: A0[1] - lift, lift, dz: 0.88 * (off * P.diry - 0.5 * A * Math.abs(P.diry)) };
    }
    // the dash pose: the near leg reaches toward the dash, the far one trails with its knee bent (the gait does not run while dashing)
    if (dashE > 0) { tg.R.tx += 12 * dashE * dashF; tg.L.tx -= 16 * dashE * dashF; tg.L.ty -= 12 * dashE; tg.L.lift = Math.max(tg.L.lift, 12 * dashE); }
    if (dashE > 0 && h.castK === 'charge' && castT < 0.5) { const v = Math.sin(dA * 42); tg.R.tx += 14 * v * dashE * dashF; tg.L.tx -= 14 * v * dashE * dashF; tg.R.ty -= 8 * Math.max(0, -v) * dashE; tg.L.ty -= 8 * Math.max(0, v) * dashE; }
    if (hop > 0) { tg.L.ty -= 12 * hop; tg.R.ty -= 12 * hop; }
    if (rangedStep > 0) { const up = 16 * Math.sin(Math.PI * rangedStep); tg.L.tx -= 0.06 * HERO_H / s * rangedStep; tg.L.ty -= up; tg.L.lift = Math.max(tg.L.lift, up); }
    // the hip rides the legs: it drops as far as the farther-reaching foot needs to stay on its target
    let drop = 0;
    for (const side of ['L', 'R']) { const H0 = RG['hip' + side], K0 = RG['knee' + side], A0 = RG['ankle' + side], Lm = 0.955 * (dist2(H0, K0) + dist2(K0, A0)), dx = tg[side].tx - H0[0];
      drop = Math.max(drop, tg[side].ty - H0[1] - Math.sqrt(Math.max(0, Lm * Lm - dx * dx))); }
    const hipDy = Math.max(bodyDy / s, drop) + breath * 1.4 / s + (48 + 70 * kneel) * buckle + 10 * dashE + 8 * hurtE + 7 * whirlE + 22 * crouch + 18 * cryPrep + 12 * landC;
    const Hc = [(RG.hipL[0] + RG.hipR[0]) / 2, RG.hipL[1]], hipS = R2S(Hc[0] + hipDx, Hc[1], hipDy * s), bc = Math.cos(bodyR), bs = Math.sin(bodyR);
    // the face is painted on the world's art grid (one texture cell, RIGS.hero.h / 42 px, is one world pixel): the cell of the near
    // eye is kept on a world pixel through the torso's lean, or the one-cell eye lands across two pixels and drops out of the snap.
    // Arms ride on hipS and move with it
    if (du < 0) { const C = RG.h / 42, EY = D.clsOf(h).look.eye || [13.5, 6.5], ex = fX * ((EY[0] * C) - Hc[0]) * s, ey = (EY[1] * C - Hc[1]) * s, r = fallR + bodyR;
      const qx = hipS[0] + ex * Math.cos(r) - ey * Math.sin(r), qy = hipS[1] + ex * Math.sin(r) + ey * Math.cos(r);
      hipS[0] += 2 * Math.round((qx - 1) / 2) + 1 - qx; hipS[1] += 2 * Math.round((qy - 1) / 2) + 1 - qy; }
    const R2U = (px, py, dy = 0) => { const p = R2S(px + hipDx, py, dy), x = p[0] - hipS[0], y = p[1] - hipS[1]; return [hipS[0] + x * bc - y * bs, hipS[1] + x * bs + y * bc]; };
    for (const side of ['L', 'R']) {
      const H0 = RG['hip' + side], K0 = RG['knee' + side], A0 = RG['ankle' + side], { tx, ty, lift } = tg[side];
      const Hp = [H0[0] + hipDx, H0[1] + hipDy];
      const l1 = dist2(H0, K0), l2 = dist2(K0, A0); let dx = tx - Hp[0], dy = ty - Hp[1], d = Math.hypot(dx, dy);
      const dm = Math.min(d, l1 + l2 - 0.5); const base = Math.atan2(dy, dx), cosA = (l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm);
      // seen from the front or back, most of the knee's fold points at the camera: a smaller sideways bend, a foreshortened shin
      const fold = 1, alphaK = Math.acos(Math.max(-1, Math.min(1, cosA))), ka = base - alphaK * fold;
      const K1 = [Hp[0] + Math.cos(ka) * l1, Hp[1] + Math.sin(ka) * l1], T1 = [K1[0] + Math.cos(Math.atan2(ty - K1[1], tx - K1[0])) * l2, K1[1] + Math.sin(Math.atan2(ty - K1[1], tx - K1[0])) * l2];
      // a step toward or away from the camera tilts the leg in depth: it projects longer or shorter, the stance foot stays planted
      // in world space. The range is biased back (−1.5..+0.5 half-steps) since a leg projects at most ~1.12× its standing length.
      const f = (T1[1] - Hp[1] + tg[side].dz) / (T1[1] - Hp[1]), Y = (p) => [p[0], Hp[1] + (p[1] - Hp[1]) * f], K = Y(K1), T = Y(T1);
      legs[side] = { H0, K0, A0, Hp, K, T, r1: ang(K, Hp) - ang(K0, H0), r2: ang(T, K) - ang(A0, K0), k1: dist2(Hp, K) / l1, k2: dist2(K, T) / l2, lift };
    }
    // ---- arms: swing against the legs; the near (R) arm carries the weapon through the strike ----
    const aimL = face > 0 ? h.aim : Math.PI - h.aim;                       // aim in rig space (mirrored for left)
    let bladeA = null, armR = null;
    let swingK = 0, bend = 0, bladeFs = 1, armA = 0;
    // the swing aims along shoulder → target (chest height at 0.8 reach), not along the raw aim from the feet, so the blade crosses
    // the body it hits even when the arm is raised for an uppercut
    const swAim = (a) => { const sh = R2U(RG.shR[0], RG.shR[1] + hipDy), tx = hx + Math.cos(a) * st.reach * 0.8, ty = hy + Math.sin(a) * st.reach * 0.8 - 34, g = Math.atan2(ty - sh[1], tx - sh[0]);
      return face > 0 ? g : Math.PI - g; };
    // (the thrust rises over 0.2 s: thrown out in 0.1 s the hand jumped 7–11 % of the height a frame, TASKS 1702)
    const chargeE = h.castK === 'charge' ? SS(0.02, 0.22, castT) * (1 - SS(0.3, 0.55, castT)) : 0, cryE = h.castK === 'cry' ? SS(0.08, 0.28, castT) * (1 - SS(0.45, 0.75, castT)) : 0;
    if (whirlE === 0 && swinging && !shooter) { const arcR = st.arc * Math.PI / 180, pT = GT - (h.patkT === undefined ? -9 : h.patkT);
      const prev = pT < SWING.end && h.patkT < h.atkT ? swingPose(pT, swAim(h.patkA), arcR, -0.95) : null;
      const sw = swingPose(atkT, swAim(h.atkA), arcR, -0.95, prev);
      bladeA = sw.blade; armA = sw.arm; swingK = sw.k; bend = sw.bend; bladeFs = sw.fs; }
    const shoulderDy = hipDy - 0.6 * breath / s;   // the chest lifts on the breath a little more than the hip
    const armPose = (side, swingA) => {
      const S0 = RG['sh' + side], E0 = RG['elbow' + side], Hd0 = RG['hand' + side];
      const Sp = [S0[0], S0[1] + shoulderDy];
      let r1 = swingA, r2 = swingA * 0.6 + 0.18;
      return { S0, E0, Hd0, Sp, r1, r2 };
    };
    // a positive turn moves the hand (−dy, dx): the sign that carries it along the travel against its own leg
    const legSwing = Math.cos(P.p) * 0.42 * run, sg = (side) => ((RG['hand' + side][0] - RG['sh' + side][0]) * P.diry - (RG['hand' + side][1] - RG['sh' + side][1]) * P.dirx >= 0 ? 1 : -1);
    const arms = { L: armPose('L', -sg('L') * legSwing * 0.8 + breath * 0.06 - sway * 1.5), R: armPose('R', sg('R') * legSwing * 0.8 - breath * 0.05 - sway * 1.5) };
    const pose = (A, dr1, bend, k) => { A.r1 += dr1 * k; A.r2 += (A.r1 + bend - A.r2) * k; };   // blended by the effect's strength: no elbow snap at its start
    if (swingK > 0) {
      armR = arms.R; const w = wrapPi(armA - Math.PI / 2), r1 = w - 0.15 * Math.sin(w);   // ≈0.85·w near rest, yet periodic: no spin at ±π
      armR.r2 = armR.r2 + wrapPi(r1 + bend - armR.r2) * swingK; armR.r1 = armR.r1 + wrapPi(r1 - armR.r1) * swingK;
    }
    // two-bone reach of an arm to a rig-space target (relative to its shoulder), the elbow bending down: blended by k
    const reach = (A, tx, ty, k) => { const l1 = dist2(A.S0, A.E0), l2 = dist2(A.E0, A.Hd0), d = Math.min(Math.hypot(tx, ty), l1 + l2 - 0.5), b = Math.atan2(ty, tx);
      const a1 = b + Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))), E = [Math.cos(a1) * l1, Math.sin(a1) * l1];
      // (the elbow's bend is blended, not the forearm's own turn: an arm raised overhead is half a turn from its rest, and the
      // forearm's shortest way there flipped sides between frames, TASKS 1702)
      const r1 = a1 - ang(A.S0, A.E0), bend = wrapPi(Math.atan2(ty - E[1], tx - E[0]) - ang(A.E0, A.Hd0) - r1), bend0 = A.r2 - A.r1;
      A.r1 += wrapPi(r1 - A.r1) * k; A.r2 = A.r1 + bend0 + wrapPi(bend - bend0) * k; };
    const armLen = (A) => dist2(A.S0, A.E0) + dist2(A.E0, A.Hd0);
    // a shot's weapon follows the aim the shot was loosed on, not the live pointer (TASKS 1153: a mouse turned in the wind-up parted staff and bolt); the kick belongs to what is being done
    const aimS = shooter && swinging && shootE >= castE ? (face > 0 ? h.atkA : Math.PI - h.atkA) : aimL, kickT = castE > shootE ? castT : atkT;
    // (TASKS 1800) the mage's three are three gestures: the shot a thrust down the aim, the frost the staff raised overhead and swept
    // down onto it, the fireball the staff kept low and the free hand drawn in to the chest, then thrown at the aim
    const mageG = shooter && !bowArm && castE > shootE ? h.castK : null, frostUp = mageG === 'frost' ? SS(0, 0.26, castT) * (1 - SS(0.28, 0.54, castT)) : 0, aimG = aimS - 1.1 * frostUp, fbOpen = mageG === 'fireball' ? SS(0.14, 0.28, castT) : 1;
    if (whirlE > 0 && swingK === 0) {   // the ellipse is centred behind the shoulder, toward the body's axis, inside the arm's reach
      const l = armLen(arms.R), wx = Math.cos(whirlTh) * face, tx = -0.3 * l + 0.4 * l * wx, ty = 0.6 * l + 0.25 * l * Math.sin(whirlTh);
      armR = arms.R; reach(arms.R, tx, ty, whirlE);
      pose(arms.L, 0.8, -0.5, whirlE);
    } else if (chargeE > 0 || cryE > 0 || cryPrep > 0) {
      // the warrior's charge (TASKS 1134): the blade thrust out down the aim, the free arm flung back; the war cry: blade and fist
      // thrown up over the head
      const l = armLen(arms.R);
      // (the breath and the shout are one reach whose target slides from the chest up over the head: two reaches in a row flipped
      // the elbow where the first let go, the hand jumped 38 % of the height in a frame, TASKS 1702)
      if (cryPrep > 0 || cryE > 0) { const w = SS(0.08, 0.28, castT), k = SS(0, 0.08, castT) * (1 - SS(0.45, 0.75, castT));
        const arc = (A, x0, y0, x1, y1) => { const a0 = Math.atan2(y0, x0), a = a0 + (Math.atan2(y1, x1) - a0) * w, r = (Math.hypot(x0, y0) + (Math.hypot(x1, y1) - Math.hypot(x0, y0)) * w) * l; reach(A, r * Math.cos(a), r * Math.sin(a), k); };
        arc(arms.R, 0.3, 0.35, 0.25, -0.9); arc(arms.L, 0.1, 0.35, -0.15, -0.85); }
      if (chargeE > 0) { reach(arms.R, 0.2 * l + Math.cos(aimL) * 0.8 * l, Math.sin(aimL) * 0.8 * l - 0.05 * l, chargeE * (1 - swingK)); pose(arms.L, 0.6, 0.3, chargeE); }
    } else if (shootE > 0 || (shooter && castE > 0)) {   // (a mage casts through his staff too: no free-hand push, no lowered blade)
      const l = armLen(arms.R), pe = Math.max(shootE, castE), kick = 0.1 * l * SS(BT - 0.01, BT + 0.05, kickT) * (1 - SS(BT + 0.05, BT + 0.25, kickT));
      // (aimed high the shouldered hand reaches as far as a bow's: tucked closer the elbow flipped over on the lowering)
      const rl = xbow ? 0.52 + 0.2 * Math.max(0, -Math.sin(aimS)) : mageG === 'fireball' ? 0.42 : 0.72, tx = 0.15 * l + Math.cos(aimG) * (rl * l - kick), ty = Math.sin(aimG) * (rl * l - kick) - 0.12 * l;
      reach(arms.R, tx, ty, mageG === 'fireball' ? 0.35 * pe : pe);
      // a bow is drawn (TASKS 1125 critic): the far hand takes the string at the stave and pulls it back along the aim through the
      // wind-up, lets it snap home on the loose
      if (xbow) { const dl = 14 / s / Math.hypot(Math.cos(aimS), Math.sin(aimS) / DEPTH_K); reach(arms.L, RG.shR[0] - RG.shL[0] + tx + Math.cos(aimS) * dl, RG.shR[1] - RG.shL[1] + ty + Math.sin(aimS) * dl, pe); }
      else if (bowArm) { const dl = 0.55 * l * drawE; reach(arms.L, RG.shR[0] - RG.shL[0] + tx - Math.cos(aimS) * dl, RG.shR[1] - RG.shL[1] + ty - Math.sin(aimS) * dl, pe); }
      else if (mageG === 'fireball') { const o = fbOpen, lL = armLen(arms.L); reach(arms.L, 0.3 * lL + (Math.cos(aimS) * 0.7 * lL - 0.1 * lL) * o, 0.3 * lL + (Math.sin(aimS) * 0.7 * lL - 0.35 * lL) * o, pe); }
      else pose(arms.L, -0.15 - 0.5 * (mageG === 'frost' ? frostUp : 0), 0.3, pe);
    } else if (castE > 0) {             // the free hand pushes the spell toward the aim; the sword arm lowers its blade
      const l = armLen(arms.L); reach(arms.L, 0.25 * l + Math.cos(aimL) * 0.6 * l, Math.sin(aimL) * 0.6 * l, castE);
      pose(arms.R, -0.25, 0.35, castE);
    }
    // reading a scroll (TASKS 1032): the free hand holds it out before the chest, the sword arm lowered
    const readE = h.read && swingK === 0 && whirlE === 0 && castE === 0 ? SS(0, 0.3, GT - h.read.t0) : 0;
    if (readE > 0) { const l = armLen(arms.L); reach(arms.L, 0.6 * l, 0.12 * l, readE); pose(arms.R, -0.2, 0.3, readE); }
    if (dashE > 0 && Math.max(shootE, shooter ? castE : 0) < 0.05) { pose(arms.L, 0.55 * dashF, 0.45, dashE); pose(arms.R, 0.55 * dashF, 0.45, dashE); }   // (a leap's shot keeps its bow arm, TASKS 1125, and so does the leap's own raised bow: both at once jerked the hands, TASKS 1702)
    if (hurtE > 0 && swingK === 0) { pose(arms.L, -0.45, 0.5, hurtE); pose(arms.R, -0.3, 0.45, hurtE); }
    if (o.victory) { reach(arms.R, armLen(arms.R) * 0.32, -armLen(arms.R) * 0.88, 1); pose(arms.L, -0.25, 0.2, 1); bladeA = -Math.PI / 2 + 0.08; }
    if (o.armsUp > 0) { reach(arms.R, armLen(arms.R) * 0.2, -armLen(arms.R) * 0.9, o.armsUp); reach(arms.L, -armLen(arms.L) * 0.1, -armLen(arms.L) * 0.9, o.armsUp); }
    // the arms fling as the knees go, then come down with the body and lie along the floor by its sides (TASKS 1803: the near hand stayed
    // raised 0.59 of the height over the corpse, the sword in it)
    if (buckle > 0) { const f = SS(0, 0.2, du), lie = SS(0.25 + late, 0.6 + late, du), down = ((fDir > 0 ? 1.15 : 0.65) * fDir * face * Math.PI / 2 - fallR) * face;
      const bL = arms.L.r2 - arms.L.r1, bR = arms.R.r2 - arms.R.r1;
      arms.L.r1 -= 0.9 * f; arms.R.r1 -= 1.1 * f; arms.L.r1 += (down + (fDir > 0 ? -0.2 : -0.45) - arms.L.r1) * lie; arms.R.r1 += (down - arms.R.r1) * lie;
      arms.L.r2 = arms.L.r1 + bL + (0.35 - 0.2 * lie - bL) * f; arms.R.r2 = arms.R.r1 + bR + (0.3 - 0.2 * lie - bR) * f; }   // (the elbow's bend eased from the run's: set at once it snapped)
    // cape and hair are painted into the body, so they bend in the shader (soft bones, art/softbones.json). The render has no
    // springs: every event (swing, turn, hurt) rings out as a damped wave from its timestamp, the run trails them back
    const ring = (x, f, k) => x > 0 ? Math.exp(-k * x) * Math.sin(TAU * f * x) : 0, fwd = Math.abs(P.dirx);
    const wave = (1 - run) * (0.06 * Math.sin(GT * 1.1 + 0.4) + 0.035 * Math.sin(GT * 1.9));
    const capeA = Math.max(-0.04, wave + run * (0.12 + 0.12 * fwd + 0.08 * Math.sin(2 * P.p)) + 0.35 * dashE * (dashF > 0 ? 1 : 0) + 0.12 * (ring(atkT - 0.08, 2.2, 5) + (shooter ? ring(GT - h.patkT - 0.08, 2.2, 5) : 0))
      + 0.25 * ring(GT - (h.faceT ?? -9), 1.6, 4) + 0.15 * hurtE + 0.25 * buckle);
    const capeB = wave + run * (0.1 * P.dirx + 0.05 * Math.sin(P.p)) + 0.08 * (ring(atkT - 0.08, 2.2, 5) + (shooter ? ring(GT - h.patkT - 0.08, 2.2, 5) : 0)) + 0.1 * ring(GT - (h.backT ?? -9) - 0.05, 1.6, 4);
    // (a shooter fires again inside the ring: the last shot's ring rings on, or the hair snapped back, TASKS 1125)
    const hairA = 1.5 * wave - run * (0.1 + 0.08 * fwd - 0.08 * Math.sin(2 * P.p + 0.8)) - 0.2 * dashE + 0.15 * (ring(atkT - 0.05, 3, 6) + (shooter ? ring(GT - h.patkT - 0.05, 3, 6) : 0)) + 0.12 * hurtE;
    const soft = (n, ...a) => window.ASSETS[n + '_w'] ? Object.assign({ wtex: G.tex(n + '_w'), wsz: [RG.w, RG.h] }, ...a.map((v, b) => ({ ['bone' + b]: [RIGS[n].bones[b][0] / RG.w, RIGS[n].bones[b][1] / RG.h, v, 1] }))) : {};
    // positions of the near arm's joints in rig px (for the weapon and the trace)
    const rotP = (p, c, a) => { const dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; };
    const armJ = (A) => { const E = rotP([A.E0[0], A.E0[1] + shoulderDy], A.Sp, A.r1), Hd = rotP(rotP([A.Hd0[0], A.Hd0[1] + shoulderDy], A.Sp, A.r1), E, A.r2 - A.r1); return { E, Hd }; };
    const jL = armJ(arms.L), jR = armJ(arms.R);
    // ---- draw: far arm → far leg → near leg → body → near arm + weapon (weapon behind the body when it points away) ----
    const drawLeg = (side, u) => { const g = legs[side];
      part('thigh' + side, g.H0, R2S(g.Hp[0], g.Hp[1]), g.r1, u, g.k1); part('shin' + side, g.K0, R2S(g.K[0], g.K[1]), g.r2, u, g.k2); part('foot' + side, g.A0, R2S(g.T[0], g.T[1]), -g.lift * 0.02 + heel[side], u); };
    const drawArm = (side, u) => { const A = arms[side], J = side === 'L' ? jL : jR;
      part('uarm' + side, A.S0, R2U(A.Sp[0], A.Sp[1]), A.r1, u, 1, bodyR); part('farm' + side, A.E0, R2U(J.E[0], J.E[1]), A.r2, u, 1, bodyR); };
    // the shield is strapped across the far forearm, its face to the camera; from behind its plain back shows (darker)
    const shield = (u) => { if (!GR.shield) return; const [tex, hh] = GR.shield, A = arms.L, E = R2U(jL.E[0], jL.E[1]), Hd = R2U(jL.Hd[0], jL.Hd[1]), ww = hh * G.tex(tex).w / G.tex(tex).h;
      const c = [E[0] + 0.55 * (Hd[0] - E[0]) - fX * 4, E[1] + 0.55 * (Hd[1] - E[1])], back = backK > 0.5;
      L.sprite(tex, 0, 0, { m: M.of(M.t(c[0], c[1]), M.r(fallR + bodyR + 0.25 * (A.r2 - 0.18)), M.s(fX, 1)), w: ww, h: hh, pivot: [ww / 2, hh / 2], u: back ? Object.assign({}, u, { grade: [0.35, 0.45, 0, 1] }) : tinted(u, GR.shieldTint) }); };
    const scroll = () => { const Hd = R2U(jL.Hd[0], jL.Hd[1]), w = 22, hh = w * 177 / 228;
      L.sprite('it_scroll', 0, 0, { m: M.of(M.t(Hd[0], Hd[1]), M.r(fallR + bodyR - 0.35 * fX), M.s(fX, 1)), w, h: hh, pivot: [w * 0.45, hh * 0.55], u: Object.assign({}, U, { alpha: alpha * SS(0.3, 0.5, readE) }) }); };
    const weapon = () => { if (!W || SC.hide.weapon) return; const [tex0, len] = W, bowH = window.ASSETS[tex0 + '_h'], tex = shooter && bowH ? tex0 + '_h' : tex0, Hd = R2U(jR.Hd[0], jR.Hd[1]), b0 = (xbow ? 0.5 : shooter ? (W && D.BASES[st.wtype] && D.BASES[st.wtype].dex ? -1.0 : -1.18) : -0.95) + arms.R.r1 * 0.5, ba0 = bladeA !== null ? bladeA : b0 + (0.9 - b0) * (shooter ? 0 : castE),
        pk0 = Math.max(shootE, shooter ? castE : 0), pk = atkT > BT ? pk0 * pk0 * (3 - 2 * pk0) : pk0, rise = shooter ? 0.15 * SS(BT - 0.01, BT + 0.05, kickT) * (1 - SS(BT + 0.05, BT + 0.25, kickT)) : 0,
        bow = shooter && !xbow && !!(D.BASES[st.wtype] || {}).dex, ba1 = pk > 0 ? ba0 + wrapPi(aimG - (bow ? Math.PI / 2 : 0) - rise - ba0) * pk : ba0, ba2 = chargeE > 0 ? ba1 + wrapPi(aimL - ba1) * chargeE * (1 - swingK) : ba1, ba = cryE > 0 ? ba2 + wrapPi(-1.45 - ba2) * cryE : ba2;
      let sa = Math.atan2(Math.sin(ba), fX * Math.cos(ba)) + fallR + bodyR;           // screen angle of the blade, squeezed with the rig
      // a slash sweeps flat around the body: on the floor plane the camera squeezes depth to DEPTH_K, so a blade pointing up or down
      // the screen points away from or at the camera and projects shorter (by the screen angle of a flat blade)
      let fsD = bladeFs * (1 + (DEPTH_K / Math.hypot(DEPTH_K * Math.cos(sa), Math.sin(sa)) - 1) * swingK) * Math.hypot(fX * Math.cos(ba), Math.sin(ba));
      if (whirlE > 0) { const c = Math.cos(whirlTh), d = Math.sin(whirlTh) * DEPTH_K; sa += wrapPi(Math.atan2(d, c) - sa) * whirlE; fsD += (Math.hypot(c, d) - fsD) * whirlE; }
      // the weapon answers a blow (TASKS 1153, 1160) and a bow's stave kicks at the loose; dead, a shooter's weapon falls and lies beside him
      if (shooter) sa += 0.2 * ring(GT - h.hurtT, 3.2, 9) + (bow ? 0.05 * ring(atkT - BT, 7, 12) : 0);
      const drop = du >= 0 ? SS(0.12, 0.42, du) : 0;   // (any weapon falls: the warrior's sword stood up out of his dead hand, TASKS 1803)
      if (shooter) { if (!bow) Hd[0] += fX * 3 * (1 - pk0) * (1 - drop); else Hd[1] -= 2 * (1 - pk0) * (1 - drop); }
      // (it arcs off the hand and bounces once; a bow lies clear of the legs and at an angle, along them it read as a third leg, critic r3)
      if (drop > 0) { sa += wrapPi((bow ? 0.45 : 0.1) - sa) * drop; fsD += (1 - fsD) * drop; Hd[0] += (root[0] + fX * (bow ? 60 : shooter ? 30 : fDir > 0 ? 70 : 34) - Hd[0]) * drop; Hd[1] += (hy - 3 - Hd[1]) * drop; Hd[1] -= 28 * drop * (1 - drop) + 6 * Math.sin(Math.PI * Math.max(0, Math.min(1, (du - 0.42) / 0.18))); }
      const tw = len, th = len * G.tex(tex).h / G.tex(tex).w;
      // the crossbow is painted from above: laid on the floor plane along its screen angle, it shortens aiming at or away from the
      // camera and shows its prod across the shot from every side; a bolt lies on it but for a moment after the loose
      if (xbow) { const th0 = Math.atan2(Math.sin(sa) / DEPTH_K, Math.cos(sa)), at = (fx) => { const lx = (fx - 0.3) * tw; return [Hd[0] + Math.cos(th0) * lx, Hd[1] + DEPTH_K * Math.sin(th0) * lx]; };
        L.sprite(tex, 0, 0, { m: M.of(M.t(Hd[0], Hd[1]), M.s(1, DEPTH_K), M.r(th0)), w: tw, h: th, pivot: [tw * 0.3, th * 0.5], u: U });
        if (drop === 0 && !(swinging && atkT >= BT && atkT < BT + 0.3)) { const [a0, a1] = [at(0.33), at(0.86)], bl = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), ba3 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
          L.solid(a0[0], a0[1], bl, 2.5, [0.16, 0.1, 0.06], ba3, 0, 1.25, alpha); L.solid(a0[0], a0[1], bl, 1.2, [0.92, 0.8, 0.58], ba3, 0, 0.6, alpha); L.solid(a1[0], a1[1], 4, 3, [0.8, 0.82, 0.86], ba3, 0, 1.5, alpha); }
        const tip = at(0.9); L.joint(id, 'grip', Hd); L.joint(id, 'tip', tip); if (id === 'hero') SC.heroTip = { x: tip[0], y: tip[1], t: GT }; return; }
      // a bow is held by the middle of its stave and turned across the shot (TASKS 1125); until the loose an arrow lies on it along the aim
      // (mirrored across its stave facing right, so its string faces the archer, not the target; turned over on the raise it went
      // edge-on twice and vanished for a frame, TASKS 1125 critic r2)
      L.sprite(tex, 0, 0, { m: M.of(M.t(Hd[0], Hd[1]), M.r(sa), M.s(fsD, bow && fX > 0 ? -1 : 1), M.r(Math.PI / 4)), w: tw, h: th, pivot: bow ? [tw * 0.5, th * 0.5] : [tw * 0.22, th * 0.78], u: U });
      if (!bow && drop === 0 && backK < 0.5) L.solid(Hd[0] - 3, Hd[1] - 1, 6, 2, [0.85, 0.62, 0.48], 0, 0, 0, alpha);
      if (bow && drop === 0 && (bowH || drawE > 0.05)) { const Hs = R2U(jL.Hd[0], jL.Hd[1]), flip = fX > 0 ? -1 : 1, nock = ([fx, fy]) => { const lx = (fx - 0.5) * tw, ly = (fy - 0.5) * th * 1, c = Math.SQRT1_2, ux = (lx - ly) * c * fsD, uy = (lx + ly) * c * flip; return [Hd[0] + ux * Math.cos(sa) - uy * Math.sin(sa), Hd[1] + ux * Math.sin(sa) + uy * Math.cos(sa)]; }, [n1, n2] = NOCKS[tex0] || [[0.9, 0.15], [0.2, 0.87]], e1 = nock(n1), e2 = nock(n2);
        // the string is always drawn (TASKS 1160): straight at rest, a wedge to the hand on the draw, a shiver for three frames at the loose
        const quiver = atkT > BT && atkT < BT + 0.05 ? 2 * Math.sin(atkT * 190) : 0, Mid = drawE > 0.05 && atkT <= BT ? Hs : [(e1[0] + e2[0]) / 2 - Math.sin(sa) * quiver, (e1[1] + e2[1]) / 2 + Math.cos(sa) * quiver];
        for (const E of [e1, e2]) L.solid(E[0], E[1], Math.hypot(Mid[0] - E[0], Mid[1] - E[1]), 2, [0.66, 0.6, 0.5], Math.atan2(Mid[1] - E[1], Mid[0] - E[0]), 0, 1, alpha);
        if (drawE > 0.05 && atkT < BT) {
        // the nocked arrow drawn in code, light on the dark bow and brick: a pale shaft from the string hand along the aim, a steel head,
        // cream fletching at the nock (the painted arrow sprite was lost against them)
        const as = Math.atan2(Math.sin(aimS), fX * Math.cos(aimS)) + fallR + bodyR, ca = Math.cos(as), sa2 = Math.sin(as), AL = 36;
        L.solid(Hs[0], Hs[1], AL, 3, [0.16, 0.1, 0.06], as, 0, 1.5, alpha); L.solid(Hs[0], Hs[1], AL, 1.5, [0.92, 0.8, 0.58], as, 0, 0.75, alpha);
        L.solid(Hs[0] + ca * AL, Hs[1] + sa2 * AL, 6, 4, [0.8, 0.82, 0.86], as, 0, 2, alpha); L.solid(Hs[0], Hs[1], 7, 4, [0.95, 0.9, 0.78], as, 0, 2, alpha); } }
      const tip = bow ? [Hd[0] + Math.cos(sa + Math.PI / 2 * fX) * 12, Hd[1] + Math.sin(sa + Math.PI / 2 * fX) * 12] : [Hd[0] + Math.cos(sa) * len * 0.78 * fsD, Hd[1] + Math.sin(sa) * len * 0.78 * fsD];
      L.joint(id, 'grip', Hd); L.joint(id, 'tip', tip); if (id === 'hero') SC.heroTip = { x: tip[0], y: tip[1], t: GT }; };
    // from behind the resting blade points away from the camera, so it sits behind the body unless it swings down
    const backK0 = h.back ? SS(0, 0.08, GT - (h.backT ?? -9)) : 1 - SS(0, 0.08, GT - (h.backT ?? -9)), backK = Math.max(backK0, whirlE * SS(0.2, 0.75, -Math.sin(whirlTh)), twist && du >= 0 ? SS(0.04, 0.3, du) : 0);
    const behind = whirlE > 0.5 ? Math.sin(whirlTh) < -0.1 : bladeA !== null ? Math.sin(face > 0 ? bladeA : Math.PI - bladeA) < -0.35 : backK > 0.5;
    L.joint(id + '_view', 'back', [backK, 0]);
    L.joint(id + '_view', 'face', [face, 0]);
    const all = () => {
      const castFront = (castE > 0.3 && (!shooter || mageG === 'fireball')) || readE > 0.3;   // the casting (or reading) hand reaches forward across the chest, in front of the body
      const bodyAt = { m: M.of(M.t(...hipS), M.r(fallR + bodyR), M.s(fX, 1)), w: RG.w * s, h: RG.h * s, pivot: [Hc[0] * s, Hc[1] * s] };
      if (!castFront) drawArm('L', Ufar);
      // seen from the front the cape's flap hangs over the far arm, as painted, but behind both legs
      if (backK < 1 && window.ASSETS[pn + 'cape']) L.sprite(pn + 'cape', 0, 0, Object.assign({ u: Object.assign({}, U, soft(pn + 'cape', capeA)) }, bodyAt));
      if (!castFront) shield(Ufar);
      drawLeg('L', Ufar); drawLeg('R', U);
      if (behind) { weapon(); drawArm('R', U); }
      if (backK < 1) L.sprite(GR.body, 0, 0, Object.assign({ u: Object.assign({}, U, { snap: 2 * L.SNAP }, soft(pn + 'body', GR.helm ? 0 : hairA)) }, bodyAt));
      if (backK < 1 && GR.helm) L.sprite(pn + 'head_' + GR.helm, 0, 0, Object.assign({ u: Object.assign(tinted(U, GR.helmTint), { snap: 2 * L.SNAP }) }, bodyAt));
      if (backK > 0 && window.ASSETS[pn + 'body_back']) L.sprite(GR.back, 0, 0, Object.assign({ u: Object.assign({}, U, { alpha: alpha * backK, snap: 2 * L.SNAP }, soft(pn + 'body_back', capeB, GR.helm ? 0 : hairA)) }, bodyAt));
      if (backK > 0 && GR.helm) L.sprite(pn + 'head_back_' + GR.helm, 0, 0, Object.assign({ u: Object.assign({}, tinted(U, GR.helmTint), { alpha: alpha * backK }) }, bodyAt));
      if (castFront) { drawArm('L', backK > 0.5 ? Ufar : U); shield(backK > 0.5 ? Ufar : U); if (readE > 0.3) scroll(); }
      if (!behind) { drawArm('R', U); weapon(); }
    };
    all();
    // joint trace (animation.md §14)
    const J = (n, p) => L.joint(id, n, p);
    if (h.qaTgt) { const tx = hx + h.qaTgt[0] - h.x, ty = hy + h.qaTgt[1] - h.y; J('target', [tx, ty - 34]); J('targetLo', [tx, ty]); J('targetHi', [tx, ty - 68]); }
    // the bent cape hem and hair tip: rig px turned about their roots as the shader turns them, then placed like the body
    const tipJ = (n, b, a) => { const r = RIGS[n].bones[b], q = rotP(RIGS[n].tips[b], r, a), x = fX * (q[0] - Hc[0]) * s, y = (q[1] - Hc[1]) * s, c = Math.cos(fallR + bodyR), sn = Math.sin(fallR + bodyR);
      return [hipS[0] + x * c - y * sn, hipS[1] + x * sn + y * c]; };
    // one point per view while that view is drawn: the two views cross-fade, their hems are far apart and never travel between them
    if (backK < 1 && RIGS[pn + 'cape']) { J('cape', tipJ(pn + 'cape', 0, capeA)); J('hairTip', tipJ(pn + 'body', 0, hairA)); }
    if (backK > 0 && RIGS[pn + 'body_back']) { J('capeBack', tipJ(pn + 'body_back', 0, capeB)); J('hairTipBack', tipJ(pn + 'body_back', 1, hairA)); }
    J('ground', [hx, hy]); J('head', R2U(RG.head[0], RG.head[1], hipDy * s)); J('top', R2U(RG.top[0], RG.top[1], hipDy * s)); J('hip', R2S((RG.hipL[0] + RG.hipR[0]) / 2 + hipDx, RG.hipL[1], hipDy * s));
    for (const side of ['L', 'R']) { const g = legs[side]; J('hip' + side, R2S(g.Hp[0], g.Hp[1])); J('knee' + side, R2S(g.K[0], g.K[1])); J('ankle' + side, R2S(g.T[0], g.T[1]));
      const dT = [g.T[0] - g.A0[0], g.T[1] - g.A0[1]]; J('heel' + side, R2S(RG['heel' + side][0] + dT[0], RG['heel' + side][1] + dT[1])); J('toe' + side, R2S(RG['toe' + side][0] + dT[0], RG['toe' + side][1] + dT[1])); J('ground' + side, [hx, hy + tg[side].dz * s]);
      const A = arms[side], j2 = side === 'L' ? jL : jR; J('sh' + side, R2U(A.Sp[0], A.Sp[1])); J('elbow' + side, R2U(j2.E[0], j2.E[1])); J('hand' + side, R2U(j2.Hd[0], j2.Hd[1])); }
  }
  SC.drawHero = drawHero;

  Object.assign(SCX, {
    HERO_H, SWING, TAU, wrapPi, swingPose, DEPTH_K, ARC_HALF, ARC_MID, whirlP, HERO, sinkOf, drawHero });
})(typeof window !== 'undefined' ? window : globalThis);
