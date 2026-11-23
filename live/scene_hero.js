// live/scene_hero.js — the hero: cut-out rig with planted foot paths, IK knees, swinging arms, a held weapon; swingPose.
// One of the scene's files (ARCHITECTURE.md §4.2): names from earlier files come from SCX at load, calls into later ones go through SCX.
(function (root) {
  const SCX = root.SCX;
  const {
    D, L, M, SC, SS } = SCX;
  // ---------------- the hero: cut-out rig (partrig.py) with planted foot paths, IK knees, swinging arms, a held weapon ----------------
  // (TASKS 2146) the bows at the new archer's scale: the short bow shoulder to knee as on his reference, it stood head to foot at 48
  const WEAPON = { sword: ['it_sword', 42], longsword: ['it_longsword', 46], axe: ['it_axe', 44], hammer: ['it_hammer', 44], staff: ['it_staff', 56], wand: ['it_wand', 26], shortbow: ['it_bow_s', 34], longbow: ['it_bow_l', 28], crossbow: ['it_crossbow', 46], fist: null };
  // (TASKS 2165) the wand a short rod about half his height, the staff taller than him; the arch draws <held>_menu (fine), on its own finer cell
  // (TASKS 2153) the hand holds its own picture of a weapon, <icon>_held (a bow's _h), in the new look on the body's cell; the bag keeps the
  // icon. HELD_HULL: the held art's outline cut to eight corners, in canvas fractions (tools/weapons_2153.py hull), for the rest below
  const HELD_HULL = { it_sword_held: [[0.028, 0.873], [0.165, 0.602], [0.208, 0.557], [0.925, 0.027], [0.958, 0.113], [0.448, 0.787], [0.132, 0.973], [0.028, 0.923]],
    it_longsword_held: [[0.012, 0.883], [0.218, 0.5], [0.905, 0.0], [0.967, 0.012], [1.0, 0.078], [0.539, 0.77], [0.136, 0.988], [0.086, 0.988]],
    it_axe_held: [[0.016, 0.874], [0.356, 0.207], [0.443, 0.096], [0.696, 0.027], [0.957, 0.31], [0.957, 0.429], [0.83, 0.613], [0.13, 0.973]],
    it_hammer_held: [[0.028, 0.856], [0.442, 0.156], [0.614, 0.0], [0.787, 0.088], [1.0, 0.332], [0.984, 0.444], [0.827, 0.6], [0.145, 0.984]] };
  // at ease a blade or a head hangs along the leg, but no lower than this above the soles (TASKS 2153: in the arch the long sword reached 38 px under them)
  // (TASKS 2201) going sideways the skirt's half over the trailing leg follows its thigh by ROBE_SWING (not look.robe), and the swing's lift
  // leaves the trailing foot by ROBE_KICK while it is still behind: the shin stood out past the skirt's back edge to the knee, 20 px² of
  // boot above the hem
  // (TASKS 2202) but never lower than SOLE_CLEAR world px while it swings: held to the floor the trailing foot slid along it (p95 3.9 px a frame)
  const SOLE_CLEAR = 2, BLADE_BACK = 0.3, ROBE_BACK = 0.09, ROBE_FOLD = 0.7, ROBE_SWING = 0.8, ROBE_KICK = 0.8;
  const NOCKS = { it_bow_s: [[0.894, 0.174], [0.255, 0.863]], it_bow_l: [[0.937, 0.072], [0.096, 0.941]] };
  const STRING_WORLD = [0.36, 0.34, 0.31];
  // the wrapped grip on the stave, where the fist holds it (TASKS 2145: held by the middle of its picture the fist closed on air by the string)
  const BOW_GRIP = { it_bow_s: [0.32, 0.48], it_bow_l: [0.37, 0.51] };
  // (TASKS 2142) a staff is a walking staff at rest: upright by the near leg, its foot by the floor, gripped a third of the way up;
  // raised to shoot it slides to its old low grip, so the crystal reaches out as before. foot and head: the shaft's ends in texture
  // fractions; drawn along its own painted axis, so it leans the same way facing either side
  // (TASKS 2146) 42 px: at 50 its crystal stood bigger than the head in the arch; gripped lower on the shorter shaft so its foot still
  // reaches the floor, and held near plumb (it leaned 20° forward with the arm's turn)
  // (TASKS 2164) 56 px with a small head: the crystal stands over the head as on the mage's ref; gripped a third up, its foot stays on the floor
  // (TASKS 2164) the mage's hand hangs 0.14 H higher on the shorter arm: gripped nearer the middle, the foot stays on the floor
  // (TASKS 2177) 60 px gripped at its middle: the fist at the belt stood its foot 0.08 H off the floor at 56, crystal over the head as before
  // (TASKS 2187) across: the crooked shaft's middle off the foot → head line where the fist closes, in axis lengths (+ toward the texture's
  // lower right); the fist closes there: on the line it sat on the shaft's edge and read as a staff tied to the wrist
  const POLE = { it_staff: { foot: [0.074, 0.973], head: [0.96, 0.054], grip: [0.65, 0.25], rest: -1.53, lean: 0.1, across: 0.0226 } };
  // (TASKS 2145) a bow at rest is held out a little from the hip and stands near upright, its lower tip by the near foot: at the hip's
  // height and canted 33° the lower limb crossed both legs to the floor
  const BOW_REST = { ba: -1.8 }, BOW_MEET = 0.4;
  // (TASKS 2177) the weapon arm at ease under the torso (look.arm.behind) comes over it as an action raises it, cross-faded over this
  // much of the action's envelope: switched in one frame the arm popped over the chest
  const ARM_FRONT = 0.35, FRONT_IN = 0.1, FRONT_OFF = { on: 0.5, blow: 0.01, cast: 0.99 };
  // the staff's arm barely swings on the run (TASKS 2156)
  const POLE_SWING = 0.15;
  // (TASKS 2165, 2170) the orb rests on the far palm whatever the other hand holds, as on mage_a_v4: the forearm bent forward at the
  // waist, palm up; hand: its reach from the shoulder in arm lengths, swing: how much of the run's arm swing it keeps
  // (TASKS 2181) held out beside the body at the chest, as on the sheet: the elbow hangs by the side (elbow: the upper arm's turn in from
  // plumb, rad), the forearm comes out toward the camera, shortened to reach the hand; drawn forward across the waist the orb lay on the
  // chest, 0.12 H inside the shoulder at 0.54 H against the sheet's 0.09 H outside at 0.63 H
  // (TASKS 2190) menu: the arch's own hold, the hand a little lower and further out, the elbow nearer plumb: the orb overlapped the
  // shoulder's edge there (the sheet's orb clears the sleeve)
  // (TASKS 2205) swing: the share of the run's arm swing the held arm turns by at the shoulder, whole: blending the hold's joints with the
  // swing's (0.15) unfolded the elbow and lengthened the forearm, a 1 px slot opened between the orb and the sleeve (2.13 world px², 54 of
  // 72 run frames over 1.5); 0.25 keeps the orb's span of about 1 px
  const ORB_HOLD = { hand: [-0.24, 0.5], elbow: 0.15, menu: { hand: [-0.3, 0.56], elbow: 0.08 }, swing: 0.25 };
  // (TASKS 2187) the hand under the orb is its own sprite (<rig>__cupL, tools/cup_2187.py), palm up with the fingers curled round the
  // orb's rim, held upright at the sleeve's end; the forearm turned the drawn hand with it, its fingers pointing down beside the orb
  // (TASKS 2190) the cup carries the sleeve's bell, the under-sleeve, the wrist and the hand pixelled after mage_a_v4 (tools/cup_2190.py);
  // cut: where along the forearm (elbow to hand) its orange rim starts and the cup takes over, cuffL keeping the blue above it (cut at the
  // sleeve's end, the forearm turned toward the camera showed its under-sleeve end-on as an upright grey block beside the orb). turn: the
  // most the cup turns with the forearm off its hold (r2h; held upright, the hand stood on end while the sleeve went down on a shot).
  // back: the back view's share past which the forearm is drawn whole with its own hand. world / menu: fractions of each texture where
  // the orb's centre sits and where the forearm meets the cup; menuK: the arch orb's share of SHIELD.orb (at 14 it stood 1.2 times the
  // sheet's beside the arch's hand)
  const ORB_CUP = { cut: 0.13, turn: 0.44, back: 0.5, menuK: 0.84, world: { orb: [0.4161, -0.1681], arm: [0.7074, 0.4202] }, menu: { orb: [0.4459, -0.2683], arm: [0.8176, 0.3354] } };
  // (TASKS 2156) the fireball's staff held overhead: its rig angle (up, a little forward) and the hand's reach along it in arm lengths
  // (TASKS 2192) orbLow: the free hand carrying the orb thrown that many orb heights lower, so the orb, which sits over the cup, goes out at
  // the chest; orbUp: aimed up, it rises no more than that sine of the aim. At the empty hand's height the orb passed over the beard and
  // mouth for 13 frames, aimed up and back for 15
  const FB_RAISE = { a: -1.35, reach: 0.62, orbLow: 1.5, orbUp: 0.3 };
  const HERO_H = 84, STEP = SIM.K.STEP || 22;
  // what the hero wears (TASKS 155): each slot picks the rig parts painted for its base (tools/gear.py), '' = the hero as first drawn
  // (plate armour, leather gloves, iron boots); a helmet is a whole head, drawn over a body without its own; the shield rides the far forearm
  // (the plate, gauntlets and iron boots in browned steel, TASKS 1791: the cold blue-grey made a grey knight of the late hero, lost on the magma's ash)
  const GEAR = { armor: { '': 'cl', leather_armor: 'le', plate_armor: 'pw', cloak: 'hd', robe: 'hd' }, gloves: { '': 'cl', leather_gloves: '', gauntlets: 'pw' },
    boots: { '': 'cl', boots: 'le', iron_boots: 'pw' }, helm: { leather_helm: 'le', knight_helm: 'kn' } };
  // a class drawn on its own parts has its own table (TASKS 1114): the mage's robe is his parts as drawn, a cloak his hooded set
  // (TASKS 2146) the warrior's new look: leather armour is his look as drawn (as the archer's); outfits repainted over the new parts
  // (docs/CHAR_REGEN_2146.md, step 6); an outfit not yet repainted draws the look, as the old ones were cut for the old body
  const GEARS = { hero: { armor: { '': 'cl', plate_armor: 'pw', cloak: 'hd', robe: 'hd' }, gloves: { gauntlets: 'pw' }, boots: { iron_boots: 'pw' }, helm: { leather_helm: 'le', knight_helm: 'kn' } }, mage: { armor: { robe: '', leather_armor: 'le', cloak: 'hd' }, gloves: {}, boots: {}, helm: { circlet: 'ci', leather_helm: 'le' } },
    // (the archer starts in leather: it is his jacket as drawn, so his own look is the first seen, TASKS 1124 critic)
    archer: { armor: { leather_armor: '', cloak: 'hd' }, gloves: {}, boots: {}, helm: { leather_helm: 'le' } } };
  // (TASKS 2146) the orb in the world is the mage's approved small orb (art/char_refs/mage_orb_small_r4.png), not the bag icon on its stand
  // (TASKS 2170) 18 → 14 px: about the head's width, as on the refs; on the palm at 18 it covered the chest
  const SHIELD = { shield: ['it_shield', 30], buckler: ['it_buckler', 22], tower_shield: ['it_shield_t', 44], orb: ['orb_held', 14] }, SHIELD_AT = 0.8;
  const SLOT_OF = { uarm: 'armor', thigh: 'armor', farm: 'gloves', fist: 'gloves', cuff: 'gloves', shin: 'boots', foot: 'boots' };
  function gearOf(h) {
    const LK = D.lookOf(h), pn = LK.rig + '__', eq = h.eq || {}, b = (k) => (eq[k] ? eq[k].b : ''), tex = (n, sfx) => (sfx && window.ASSETS[pn + n + '_' + sfx] ? pn + n + '_' + sfx : pn + n);
    const GE = GEARS[LK.gear] || GEAR, sfx = { armor: GE.armor[b('armor')] ?? '', gloves: GE.gloves[b('gloves')] ?? '', boots: GE.boots[b('boots')] ?? '' };
    const helm = window.ASSETS[pn + 'head_' + GE.helm[b('helm')]] ? GE.helm[b('helm')] : undefined;
    // a better piece is tinted toward its rarity: uncommon green .. legendary gold, just enough to tell at a glance
    const rar = (k) => { const it = eq[k]; return it && it.rar > 0 ? [...D.RARITY[it.rar].col, 0.12 + 0.06 * it.rar] : null; };
    const part = (n) => { const slot = SLOT_OF[n.slice(0, -1)]; return { tex: tex(n, sfx[slot]), tint: rar(slot) }; };
    const nh = helm ? '_nh' : '', body = (v) => (window.ASSETS[pn + v + (sfx.armor ? '_' + sfx.armor : '') + nh] ? pn + v + (sfx.armor ? '_' + sfx.armor : '') + nh : pn + v);
    const sh = SHIELD[b('offhand')];
    // (TASKS 2166) an outfit may bring its own hanging cape: under the archer's brown hooded cloak the olive one showed at the legs
    return { part, body: body('body'), back: body('body_back'), cape: tex('cape', sfx.armor), helm: helm || null, helmTint: rar('helm'), shield: sh, shieldTint: rar('offhand') };
  }
  SC.gearOf = gearOf;
  function heroPose(h, GT, st) {
    // dead, the gait reads his own speed as he fell, not the killing blow's shove, which put the feet into a stride in one frame (TASKS 2059)
    const dv = h.deadT >= 0 && h.deadRun ? h.deadRun : [h.vx, h.vy];
    const RG = RIGS[D.lookOf(h).rig], s = HERO_H / RG.h, sp = Math.hypot(dv[0], dv[1]), run = SS(10, 150, sp) * (h.deadT >= 0 ? 1 - SS(0, 0.15, GT - h.deadT) : 1);
    const dirx = sp > 1 ? dv[0] / sp : 0, diry = sp > 1 ? dv[1] / sp : 0;
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
  function swingPose(T, saRaw, arc, rest, from, hit = SIM.K.HIT, recoveryEnd = SWING.end) {
    const sa = Math.PI / 2 + wrapPi(saRaw - Math.PI / 2), lo = sa - arc / 2, hi = sa + arc / 2;
    const dir = Math.abs(wrapPi(lo - rest)) <= Math.abs(wrapPi(hi - rest)) ? 1 : -1, start = dir > 0 ? lo : hi, end = dir > 0 ? hi : lo;
    const a0 = start - dir * SWING.back, th = arc + SWING.back, Ta = SWING.pull;
    const Ts = Ta + (hit - Ta) / Math.pow((arc / 2 + SWING.back) / th, 1 / 1.5), vEnd = 1.5 * th / (Ts - Ta), Tf = Ts + SWING.follow;
    const follow = (x) => end + dir * SWING.over * (1 - Math.exp(-x * vEnd / SWING.over));   // leaves the strike at its speed, settles SWING.over past the arc
    let blade, k = 1, bend, fs = 1;
    if (T < Ta) { const q = SS(0, Ta, T), b0 = from ? from.blade : rest, k0 = from ? from.k : 0; k = k0 + (1 - k0) * q; blade = b0 + wrapPi(a0 - b0) * q; bend = 1.1; }
    else if (T < Ts) { const e = Math.pow((T - Ta) / (Ts - Ta), 1.5); blade = a0 + dir * th * e; bend = 1.1 - 0.95 * e; }
    else if (T < Tf) { blade = follow(T - Ts); bend = 0.15 + 0.15 * SS(Ts, Tf, T); }
    else { const bf = follow(Tf - Ts), u = (T - Tf) / (recoveryEnd - Tf), q = SS(0, 1, u), d0 = wrapPi(rest - bf), d1 = d0 - Math.sign(d0) * TAU;
      const via = (d, x) => { let t = wrapPi(x - bf); if (d < 0 && t > 0) t -= TAU; if (d > 0 && t < 0) t += TAU; return Math.abs(t) <= Math.abs(d); };   // the blade lowers past the hip
      blade = bf + (via(d0, Math.PI / 2) || Math.abs(d1) > 1.25 * Math.PI ? d0 : d1) * SS(0.15, 0.75, u); k = 1 - q; bend = 0.3; fs = 1 - 0.6 * SS(0, 0.2, u) * (1 - SS(0.6, 0.95, u)); }
    return { blade, k, bend, fs, dir, start, end, Ts, Tf, arm: T < Tf ? blade : follow(Tf - Ts) };   // arm: the arm follows the blade until the recovery, then lowers from the end pose
  }
  const DEPTH_K = 0.65;   // the 3/4 camera's squeeze of floor depth
  // seen from behind (TASKS 2011): the resting blade is held up and away, so it stands steeper and foreshortened behind the body
  // instead of the front view's flat cut-out poking out of the cape; the arms hang in the cape's shade (the shirt's white cuffs were
  // the brightest thing on him); the feet point away, heels to the camera, so they narrow about the ankle; the cape's broad red
  // loses its saturation, not its light (TASKS 2092): the pauldrons and the belt stay readable; the head behind is not shaded and not lifted:
  // its repainted hair (TASKS 2134) lifted read as a bald peach dome
  // (TASKS 2146) at ease the blade hangs point down and forward by the near leg, as on the warrior's reference: held up across the chest it hid the
  // near forearm in the arch. A blow raises it to the old guard, where it stays while he fights and sinks back GUARD.down s after the last
  // action; the swing's arcs are still laid out from the guard, so every blow sweeps as before
  const GUARD = { up: 0.2, hold: 1, down: 1.8, low: 1.25, lowFs: 0.8, backLow: 1.45 }, guardOf = (t) => (t >= 0 ? SS(0, GUARD.up, t) * (1 - SS(GUARD.hold, GUARD.down, t)) : 0);
  // a turn passes through the back view (TASKS 2146): mirrored in one frame the cape, blade and shield jumped across the body; from behind
  // the lowered blade hangs plumb, so the mirror at the turn's middle barely moves it
  // (TASKS 2156) a turn the aim makes in a shot or a cast goes through the back view too; there the hands leave the body's axis over
  // TUCK_REL after the mirror, so the aimed arm is out again by the loose (released as fast as they came in, they jumped 13–20 px a frame)
  // TUCK_HOLD: the hands stay on the axis this long either side of the mirror, so the frames on both sides of it find them there
  const TURN_T = 0.14, TUCK_REL = 0.1, TUCK_HOLD = 0.012, TURN_LOW = 0.9;
  // (TASKS 2160) a hanging arm's elbow gives a little toward the front: the old +0.18 bent the cape-side arm's elbow backwards
  // (the hand 12 rig px behind the elbow), the arm turned the wrong way. STANCE: the feet a fifth of the height apart as on the class
  // refs, the cape-side foot at ease turned toward the camera (its length foreshortened): two feet in profile toe to heel read as one line.
  // The torso is drawn 3/4 from the front, so at ease the other foot stands a little further back (depth: higher) and the legs stand
  // near straight (the refs 0–8°): the breath's hip bob of 1.4 world px and the weight's 10 rig px slide over one foot folded the knees
  // 28–40° at their low, the hip level over a slanted and an upright leg (shift, rig px; breath, world px); reach: the hip's drop as a
  // share of the leg, the run's 0.955 eased toward straight at a stop
  // (TASKS 2164) the near foot is in 3/4 at ease too (nearFoot; full length it stood in profile, 0.155–0.175 H heel to toe against the
  // refs' 0.12–0.13); the warrior stands narrower, as on his sheet (halfBy; 0.187 H between the ankles against 0.145); at ease the
  // cape-side knee gives outward and the near one stands straight, as on the refs (fold: a share of the run's forward sideways bend; bent
  // forward like a stride's, the cape-side shin leaned 14–17° toward the cape against the refs' 2–4°)
  // (TASKS 2181) NEAR_OUT: the near (cape-side) arm's upper arm turned out from the body at ease, so its hand hangs outside the hip as on
  // the sheets (it hung right under the shoulder, over the belt pouch); RUN_BEND: the elbows' forward bend the run adds, or at the bottom of
  // the swing the arm hung straight, 0.337 H shoulder to hand against the rest's 0.318
  // (TASKS 2188) SOCK: the near upper arm turned out (NEAR_OUT, the run's back swing, a dash) opens a wedge between its sleeve and the
  // torso, which only the shoulder cap of 2167 closed, and only at rest without NEAR_OUT: a copy of the upper arm stays under the body and
  // the arm, no further out than span rad behind the arm (the arm's own width covers that much) and turned in by in rad (2167 left the
  // torso's edge up to 2 rig px off the arm below the armpit)
  // (TASKS 2191) the copy is the arm's _sock: no outline and darker, the shade in the gap rather than a second sleeve beside the arm; the
  // forearm comes with it where the near arm is over the body (a charge flung the forearm out past the torso's side: 4.4 world px²)
  // (TASKS 2201) flung out past SOCK.wide (a dash, a charge, the whirl, the cry) the upper arm's copy trails by SOCK.far of span, and the
  // forearm's comes only up to SOCK.fore: a full span left the copy in the open armpit (35–40 world px²) and its forearm hanging from the
  // trailing elbow under the arm (100–130), a second arm, where the slot they close is 2–8 px²
  const NEAR_OUT = 0.2, RUN_BEND = 0.4, HOLD_RUN = 0.1, SOCK = { span: 0.35, in: 0.04, wide: [0.4, 0.7], far: 0.4, fore: 0.5 };
  const ARM_BEND = -0.06, STANCE = { half: 14, halfBy: { warrior: 8.5 }, frontFoot: 0.62, nearFoot: 0.78, fold: { L: -0.4, R: 0 }, depth: 9, reach: 1, sink: 0, breath: 0.2, shift: 4 };
  const BLADE_REST = -0.95, BACK_VIEW = { blade: -1.25, bladeFs: 0.8, armShade: 0.55, footFs: 0.6, bodySat: 0.8, bodyLift: 1, headLift: 1 };
  // the slash crescent's half-span about the aim, and where its brightness centroid sits along it (the ARC shader's taper and tail fade)
  const ARC_HALF = 1.35, ARC_MID = 0.52;
  // the whirl's turn (0..1) over WHIRL_T s: speeds up and slows down over 0.1 s, so the blade neither starts nor stops dead
  // (TASKS 2201) WHIRL_BACK: the sweep's sine (negated) past which the whirl shows his back, the arm and blade under it; WHIRL_SIDE: the
  // cosine toward his facing past which the arm hangs under the torso as at ease (at 0 it switched over the chest across 185 px, at 0.8 130)
  const WHIRL_T = 0.4, WHIRL_BACK = 0.475, WHIRL_SIDE = 0.8, whirlP = (t) => { const a = 0.1, v = 1 / (WHIRL_T - a); t = Math.max(0, Math.min(WHIRL_T, t));
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
    const LK = D.lookOf(h), pn = LK.rig + '__', P = heroPose(h, GT, st), { RG, s, run } = P, gx = RG.gap, gy = RG.footL[1];
    const clubBase = D.BASES[st.wtype], club = clubBase?.club;
    const clubEvent = club && o.events?.find((e) => e.k === 'swing' && e.kind === 'staffClub' && e.t === h.atkT);
    const clubT = clubEvent ? GT - clubEvent.t : -1, clubSwing = clubT >= 0 && clubT < club.cooldown;
    const atkT = GT - h.atkT, swinging = atkT >= 0 && atkT < SWING.end, castT = GT - h.castT, casting = castT < 0.5 && !['whirl', 'charge', 'cry'].includes(h.castK);
    // whirl: the hand and blade sweep a ground ellipse at waist height around the body from the aim, behind it while pointing away;
    // eased in from the current pose and out of a crouch
    const wt = GT - h.whirlT, whirlE = wt >= 0 ? SS(0, 0.14, wt) * (1 - SS(WHIRL_T, WHIRL_T + 0.14, wt)) : 0, wa0 = h.whirlA ?? h.aim;
    const wTh0 = Math.atan2(Math.sin(wa0) / DEPTH_K, Math.cos(wa0)), whirlTh = wTh0 + Math.PI * 2 * whirlP(wt);
    // a turn mirrors the rig in one frame: narrowing it through a sliver read as a flat cut-out card spinning; the cape swings out instead
    // (the render's clock may trail the turn's stamp by a step: there it is the old facing, not the new one for a frame)
    // (TASKS 2156) only a melee swing still turns in one frame: its arcs are laid out for the facing it strikes in
    const melee = clubSwing || swinging && !(D.clsOf(h).shoots || []).includes(st.wtype), fT = h.faceT ?? -9, inAct = [h.atkT, h.castT].some((t0) => fT - t0 > -0.05 && fT - t0 < SWING.end);
    const turnT = GT - fT, turnD = TURN_T, turning = !o.menu && h.deadT < 0 && !melee && turnT >= -0.05 && turnT < turnD, turnK = turning ? SS(0, 0.04, turnT) * (1 - SS(turnD - 0.04, turnD, turnT)) : 0;
    const face = clubSwing ? clubEvent.f : turning && turnT < turnD / 2 ? -h.face : h.face, fX = face;
    const tIn = turnD / 2 - TUCK_HOLD, tOut = turnD / 2 + TUCK_HOLD, tRel = inAct || whirlE > 0 ? TUCK_REL : tIn, tuckL = !o.menu && h.deadT < 0 && !melee && turnT >= 0 && turnT < tOut + tRel
      ? (turnT < tIn ? 1 - Math.cos(Math.PI / 2 * turnT / tIn) : turnT < tOut ? 1 : 1 - Math.sin(Math.PI / 2 * (turnT - tOut) / tRel)) : 0;
    // (TASKS 2162) in a whirl the free hand and the shield come in as in any turn (posed in rig space they mirrored across the body, the
    // hand 31 px a frame); the blade's hand keeps its sweep as far as the whirl has eased in, its ellipse centred on the axis at the mirror
    const tuck = tuckL * (1 - whirlE);
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
    // (TASKS 2180) it sways on through a blow: held still for the blow, its return at the blow's end moved the whole still body a pixel in
    // one frame of the recovery
    const idle = (1 - run) * (1 - dashE) * (1 - hurtE) * (h.deadT >= 0 ? 1 - SS(0, 0.15, GT - h.deadT) : 1), sway = idle * (0.022 * Math.sin(GT * 0.83) + 0.01 * Math.sin(GT * 1.37 + 1));
    // every 4–5 s the weight moves onto the other leg: the hip slides toward it and the free heel lifts
    const wsh = 2 * SS(-0.35, 0.35, Math.sin(GT * 1.43) + 0.3 * Math.sin(GT * 0.61)) - 1, hipDx = STANCE.shift * wsh * idle;
    const heel = { L: 0.06 * idle * SS(0.3, 1, wsh), R: 0.06 * idle * SS(0.3, 1, -wsh) };
    // (eased in and out, and slow enough that one frame's shudder is not a break in the pose, TASKS 1702)
    const cryShake = h.castK === 'cry' ? 0.04 * Math.sin(GT * 40) * SS(0.14, 0.26, castT) * (1 - SS(0.48, 0.6, castT)) : 0;
    const W = WEAPON[st.wtype];
    // For a shot, the arm brings the weapon up toward the aim,
    // crystal first, over the bolt's frame (raised in the 0.13 s to it, the hand jumped 7 % of the height a frame), holds it a moment and lowers it; at rest it stands more upright than a blade
    // a shot follows the last one's envelope (the wand fires every 0.36 s: the new shot's raise starting at 0 dropped the staff in a frame)
    const shooter = (D.clsOf(h).shoots || []).includes(st.wtype), BT = D.SHOTS[(D.BASES[st.wtype] || {}).shot || 'bolt'].t, rise0 = (T) => { const x = Math.max(0, Math.min(1, T / BT)); return 0.5 * x * (2 - x) + 0.5 * x * x * (3 - 2 * x); }, shotEnv = (T) => (T >= 0 && T < SWING.end ? rise0(T) * (1 - SS(BT + 0.06, SWING.end - 0.02, T)) : 0);
    // a crossbow is not drawn: it is shouldered, its stock along the shot, the far hand under the fore-stock (TASKS 1711)
    const xbow = shooter && st.wtype === 'crossbow' && !!window.ASSETS[W[0] + '_h'], pole = shooter && !xbow && W ? POLE[W[0]] : null;
    const bowArm = shooter && !!(D.BASES[st.wtype] || {}).dex, drawE = bowArm && !xbow && swinging ? SS(0.02, BT, atkT) * (1 - SS(BT, BT + 0.08, atkT)) : 0;
    const shooting = shooter && swinging && !clubEvent;
    const shootE = shooting ? Math.max(shotEnv(atkT), h.patkT < h.atkT ? shotEnv(GT - h.patkT) : 0, atkT < BT ? Math.min(1, shotEnv(GT - h.patkT) + shotEnv(atkT)) : 0) : 0;
    // (a bow raised for the volley in 0.07 s jumped the hands 13 % of the height a frame, though its arrows leave at once, TASKS 1702)
    const castE = casting ? SS(0, h.castK === 'leap' ? 0.2 : bowArm ? 0.13 : h.castK === 'frost' ? 0.17 : 0.24, castT) * (1 - SS(0.3, 0.5, castT)) : 0;
    // (TASKS 1800) a shot or a cast is done with the body, not the arm alone: the torso leans back on the draw or the raise by `b`, is
    // thrown forward by `f` on the loose, the far foot steps back; each class its own sizes (rel: the loose, s after the action begins)
    // (TASKS 2180) both back at rest by the action's end (SWING.end, a cast's 0.5 s): cut off there mid-return, the torso and the foot
    // jumped back in one frame
    const backBy = (rel, t1) => Math.min(rel + t1, SWING.end - 0.02);
    const rangedOf = (T, rel, b, f) => { if (!(T >= 0) || T > rel + 0.45) return 0; const out = SS(rel - 0.02, rel + 0.07, T), e1 = backBy(rel, 0.42);
      return (-b * SS(0, Math.max(0.06, rel), T) * (1 - out) + f * out) * (1 - SS(Math.min(rel + 0.12, e1 - 0.15), e1, T)); };
    const stepOf = (T, rel) => { const e1 = backBy(rel, 0.45); return T >= 0 && T < e1 ? SS(0, 0.09, T) * (1 - SS(Math.min(rel + 0.2, e1 - 0.2), e1, T)) : 0; };
    const RB = !shooter ? [0.08, 0.14] : xbow ? [-0.05, -0.1] : bowArm ? [0.12, 0.1] : [0.07, 0.13];
    const CK = { frost: [0.08, 0.16, 0.07], fireball: [shooter ? 0.14 : 0.18, 0.1, 0.14], volley: [D.VOLLEY.loose, 0.12, 0.08] }[h.castK];
    const pShot = shooter && h.patkT < h.atkT ? GT - h.patkT : -1, shotLean = shooting ? rangedOf(atkT, BT, RB[0], RB[1]) + rangedOf(pShot, BT, RB[0], RB[1]) * (1 - SS(0, 0.08, atkT)) : 0;
    const castLean = casting && CK ? rangedOf(castT, CK[0], CK[1], CK[2]) : 0;
    const rangedLean = (shotLean + castLean) * h.face, rangedStep = Math.max(shooting ? Math.max(stepOf(atkT, BT), stepOf(pShot, BT)) : 0, casting && CK ? stepOf(castT, CK[0]) : 0) * (1 - run);
    // the whirl turns the torso with the blade: it leans after it round the turn (its back view is shown while the blade is behind)
    const whirlLean = whirlE > 0 ? 0.15 * whirlE * Math.cos(whirlTh) : 0;
    const bodyR = 0.25 * dashE * (Math.abs(h.dashX) > 0.3 ? Math.sign(h.dashX) : 0) + 0.15 * hurtE * (h.hurtX || 0) + sway * face - 0.14 * cryPrep * face + cryShake - 0.16 * hop * face + rangedLean + whirlLean;
    // death keeps the rig: the knees buckle (the hip drops, IK folds them), the arms fling, then the whole body falls back about the feet,
    // accelerating but slowed just before the floor so it lands with a small bounce instead of a board's slap
    // (TASKS 1803) killed on the run (over half his running speed) he pitches forward the way he ran; the
    // mage sinks to his knees before he goes over; the archer twists a quarter round, his back to us, and falls forward onto his face
    const du = h.deadT >= 0 ? GT - h.deadT : -1, cls = D.clsOf(h).id, dv = h.deadRun || [h.vx, h.vy], dsp = Math.hypot(dv[0], dv[1]), ran = du >= 0 && dsp > 0.5 * SIM.K.RUN;
    const twist = cls === 'archer' && !ran, fDir = ran ? (Math.abs(dv[0]) > 0.3 * dsp ? Math.sign(dv[0]) * face : 1) : twist ? 1 : -1, kneel = cls === 'mage' && !ran ? 0.22 : 0, late = kneel + (twist ? 0.14 : 0);
    const buckle = du >= 0 ? SS(0, 0.15 + kneel, du) : 0, fq = Math.min(1, Math.max(0, (du - 0.12 - late) / 0.35));
    const fallR = du < 0 ? 0 : fDir * face * (0.1 * buckle + 1.32 * (2.4 * fq * fq - 1.4 * fq * fq * fq) - (du > 0.47 + late ? 0.03 * Math.sin(Math.PI * Math.min(1, (du - 0.47 - late) / 0.16)) : 0));
    const fc = Math.cos(fallR), fs = Math.sin(fallR);
    const root = [hx, hy - 24 * hop], R2S = (px, py, dy = 0) => { const x = fX * (px - gx) * s, y = (py - gy) * s + dy; return [root[0] + x * fc - y * fs, root[1] + x * fs + y * fc]; };
    const dk = du >= 0 ? 1 - 0.25 * SS(0.4, 1.2, du) : 1, ft = [1, 1, 1, 0], lt0 = LK.cold && HERO.lightAt ? HERO.lightAt(h.x, h.y) : null, cold = lt0 && !(SC.state && SC.state.run && SC.state.run.town) ? SS(1.2, 1, lt0.all[0] / Math.max(0.02, lt0.all[1])) : 0, U = { alpha, tint: ft, grade: hurt ? [0.4, 2.4, 0, 1] : [(LK.sat || HSAT) * (1 - (1 - (LK.cold?.sat ?? 1)) * cold) * dk, HERO.lift * (1 - (1 - (LK.cold?.lift ?? 1)) * cold) * dk, 0, 1] };
    // (TASKS 2160) the limbs on the cape's side are lit like the rest: graded darker as far ones they read as another colour, not as depth
    const Ufar = Object.assign({}, U);
    if (o.cut) U.cut = Ufar.cut = o.cut;
    const GR = gearOf(h), tinted = (u, t) => (t ? Object.assign({}, u, { tint: [0, 1, 2].map((i) => (u.tint ? 1 + (u.tint[i] - 1) * u.tint[3] : 1) * (1 + (t[i] - 1) * t[3])).concat(1) }) : u);   // a piece's rarity over the fire's tint
    // (TASKS 2155) the world parts are painted in cells of the world grid; the arch's ×3.2 shows them nearly 1:1, so it has the parts as drawn
    const fine = (t) => (o.menu && window.ASSETS[t + '_menu'] ? t + '_menu' : t);
    const part = (n, pivotRig, at, rot, u = U, k = 1, up = 0, kx = 1, alt = '') => { const g = GR.part(n), ga = g.tex + alt; return L.sprite(fine(window.ASSETS[ga] || (o.menu && window.ASSETS[ga + '_menu']) ? ga : g.tex), 0, 0, { u: tinted(u, g.tint), m: M.of(M.t(at[0], at[1]), M.r(fallR + up), M.s(fX * kx, 1), M.r(rot), M.s(1, k)), w: RG.w * s, h: RG.h * s, pivot: [pivotRig[0] * s, pivotRig[1] * s] }); };
    const shade = (u, sat, lift) => (hurt || !(backV > 0) ? u : Object.assign({}, u, { grade: [u.grade[0] * (1 - (1 - sat) * backV), u.grade[1] * (1 - (1 - lift) * backV), u.grade[2], u.grade[3]] }));
    const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
    const dist2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const id = o.id || 'hero';
    const backF = h.back ? SS(0, 0.08, GT - (h.backT ?? -9)) : 1 - SS(0, 0.08, GT - (h.backT ?? -9)), backK0 = Math.max(turnK, backF), backV = backK0 * (1 - whirlE);
    // ---- legs: foot targets in rig px: rest ankle + travel × sweep in stance, eased forward with a lift in the swing ----
    const legs = {}, tg = {};
    for (const side of ['L', 'R']) {
      const A0 = RG['ankle' + side], u = ((P.u0 + (side === 'L' ? 0 : 0.5)) % 1), A = P.sl / 2 / s * run;   // half a step in rig px: stance slides back at body speed
      // (TASKS 1802: the longer step tilts the leg in depth by 0.88 of its travel; at 1 the knee folded 29° a frame walking down)
      let off, lift = 0;
      if (u < 0.5) off = A * (1 - 4 * u); else { const w = (u - 0.5) * 2, e = SS(0.12, 0.95, w); off = -A + 2 * A * e; const full = Math.pow(Math.sin(Math.PI * w), 0.6) * (13 + 2 * Math.abs(pdx)) * run; lift = Math.max(full * (1 - ROBE_KICK * (LK.robe ? 1 : 0) * Math.abs(pdx) * (1 - e)), Math.min(full, SOLE_CLEAR / s)); }
      tg[side] = { tx: A0[0] + off * pdx + (side === 'L' ? -1 : 1) * (STANCE.halfBy[cls] ?? STANCE.half) * (1 - run * 0.6), ty: A0[1] - lift, lift, dz: 0.88 * (off * P.diry - 0.5 * A * Math.abs(P.diry)) };
    }
    // the dash pose: the near leg reaches toward the dash, the far one trails with its knee bent (the gait does not run while dashing)
    if (dashE > 0) { tg.R.tx += 12 * dashE * dashF; tg.L.tx -= 16 * dashE * dashF; tg.L.ty -= 12 * dashE; tg.L.lift = Math.max(tg.L.lift, 12 * dashE); }
    if (dashE > 0 && h.castK === 'charge' && castT < 0.5) { const v = Math.sin(dA * 42); tg.R.tx += 14 * v * dashE * dashF; tg.L.tx -= 14 * v * dashE * dashF; tg.R.ty -= 8 * Math.max(0, -v) * dashE; tg.L.ty -= 8 * Math.max(0, v) * dashE; }
    if (hop > 0) { tg.L.ty -= 12 * hop; tg.R.ty -= 12 * hop; }
    if (rangedStep > 0) { const up = 16 * Math.sin(Math.PI * rangedStep); tg.L.tx -= 0.06 * HERO_H / s * rangedStep; tg.L.ty -= up; tg.L.lift = Math.max(tg.L.lift, up); }
    // the hip rides the legs: it drops as far as the farther-reaching foot needs to stay on its target
    let drop = 0;
    for (const side of ['L', 'R']) { const H0 = RG['hip' + side], K0 = RG['knee' + side], A0 = RG['ankle' + side], Lm = (0.955 + (STANCE.reach - 0.955) * (1 - run)) * (dist2(H0, K0) + dist2(K0, A0)), dx = tg[side].tx - H0[0];
      drop = Math.max(drop, tg[side].ty - H0[1] - Math.sqrt(Math.max(0, Lm * Lm - dx * dx))); }
    const hipDy = Math.max(bodyDy / s, drop) + (STANCE.sink * (1 - run) + breath * STANCE.breath) / s + (48 + 70 * kneel) * buckle + 10 * dashE + 8 * hurtE + 7 * whirlE + 22 * crouch + 18 * cryPrep + 12 * landC;
    const Hc = [(RG.hipL[0] + RG.hipR[0]) / 2, RG.hipL[1]], hipS = R2S(Hc[0] + hipDx, Hc[1], hipDy * s), bc = Math.cos(bodyR), bs = Math.sin(bodyR);
    // the face is painted on the world's art grid (one texture cell, RIGS.hero.h / 42 px, is one world pixel): the cell of the near
    // eye is kept on a world pixel through the torso's lean, or the one-cell eye lands across two pixels and drops out of the snap.
    // Arms ride on hipS and move with it. Under a pre-transform (L.pre: the menu's arch, scaled ×3 on the smooth HUD, TASKS 1874; the
    // victory screen's hero, ×1.5, TASKS 1896) there is no world grid to snap to, and the snap only jerked the body off the legs
    if (du < 0 && !L.pre) { const C = RG.h / 42, EY = LK.eye || [13.5, 6.5], ex = fX * ((EY[0] * C) - Hc[0]) * s, ey = (EY[1] * C - Hc[1]) * s, r = fallR + bodyR;
      const qx = hipS[0] + ex * Math.cos(r) - ey * Math.sin(r), qy = hipS[1] + ex * Math.sin(r) + ey * Math.cos(r);
      hipS[0] += 2 * Math.round((qx - 1) / 2) + 1 - qx; hipS[1] += 2 * Math.round((qy - 1) / 2) + 1 - qy; }
    const R2U = (px, py, dy = 0) => { const p = R2S(px + hipDx, py, dy), x = p[0] - hipS[0], y = p[1] - hipS[1]; return [hipS[0] + x * bc - y * bs, hipS[1] + x * bs + y * bc]; };
    for (const side of ['L', 'R']) {
      const H0 = RG['hip' + side], K0 = RG['knee' + side], A0 = RG['ankle' + side], { tx, ty, lift } = tg[side];
      const Hp = [H0[0] + hipDx, H0[1] + hipDy];
      const l1 = dist2(H0, K0), l2 = dist2(K0, A0); let dx = tx - Hp[0], dy = ty - Hp[1], d = Math.hypot(dx, dy);
      const dm = Math.min(d, l1 + l2 - 0.5); const base = Math.atan2(dy, dx), cosA = (l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm);
      // seen from the front or back, most of the knee's fold points at the camera: a smaller sideways bend, a foreshortened shin
      // (TASKS 2164) the stance's fold only while the knee is near straight: a crouch, a fall or a kneel keeps the full forward bend
      // (TASKS 2197) under a robe, walking toward or away from the camera, the lifted knee comes at the camera: bent sideways the far boot
      // swung out beside the skirt at the knee's height and hung there apart from the hem
      const alphaK = Math.acos(Math.max(-1, Math.min(1, cosA))), fold = (1 + (STANCE.fold[side] - 1) * (1 - run) * (1 - SS(0.15, 0.35, alphaK))) * (1 - ROBE_FOLD * (LK.robe ? 1 : 0) * run * (1 - Math.abs(pdx))), ka = base - alphaK * fold;
      const K1 = [Hp[0] + Math.cos(ka) * l1, Hp[1] + Math.sin(ka) * l1], sA = Math.atan2(ty - K1[1], tx - K1[0]), sL = Math.min(l2, Math.hypot(tx - K1[0], ty - K1[1])), T1 = [K1[0] + Math.cos(sA) * sL, K1[1] + Math.sin(sA) * sL];
      // a step toward or away from the camera tilts the leg in depth: it projects longer or shorter, the stance foot stays planted
      // in world space. The range is biased back (−1.5..+0.5 half-steps) since a leg projects at most ~1.12× its standing length.
      const f = (T1[1] - Hp[1] + tg[side].dz) / (T1[1] - Hp[1]), Y = (p) => [p[0], Hp[1] + (p[1] - Hp[1]) * f], K = Y(K1), T = Y(T1);
      // (TASKS 2160) the other leg stands a little further back at ease: the whole leg moves up the screen, its hip under the body
      const dep = side === 'R' ? STANCE.depth * (1 - run) * (1 - backV) : 0; Hp[1] -= dep; K[1] -= dep; T[1] -= dep;
      legs[side] = { H0, K0, A0, Hp, K, T, r1: ang(K, Hp) - ang(K0, H0), r2: ang(T, K) - ang(A0, K0), k1: dist2(Hp, K) / l1, k2: dist2(K, T) / l2, lift };
    }
    // ---- arms: swing against the legs; the near (R) arm carries the weapon through the strike ----
    // (TASKS 2156) laid out for the facing he turns to: in the turn's first half, drawn the old way round, an arm aimed for the old
    // facing crossed the body to the target behind it and swung back across at the mirror
    const aimL = h.face > 0 ? h.aim : Math.PI - h.aim;                     // aim in rig space (mirrored for left)
    let bladeA = null, armR = null, bowHand = 0;
    let swingK = 0, bend = 0, bladeFs = 1, armA = 0, blowA = null;
    // the swing aims along shoulder → target (chest height at 0.8 reach), not along the raw aim from the feet, so the blade crosses
    // the body it hits even when the arm is raised for an uppercut
    const swAim = (a, reach = st.reach) => { const sh = R2U(RG.shR[0], RG.shR[1] + hipDy), tx = hx + Math.cos(a) * reach * 0.8, ty = hy + Math.sin(a) * reach * 0.8 - 34, g = Math.atan2(ty - sh[1], tx - sh[0]);
      return face > 0 ? g : Math.PI - g; };
    // (the thrust rises over 0.2 s: thrown out in 0.1 s the hand jumped 7–11 % of the height a frame, TASKS 1702)
    const chargeE = h.castK === 'charge' ? SS(0.02, 0.22, castT) * (1 - SS(0.3, 0.55, castT)) : 0, cryE = h.castK === 'cry' ? SS(0.08, 0.28, castT) * (1 - SS(0.45, 0.75, castT)) : 0;
    // (TASKS 2192) the breath and the shout as one envelope: the arm's layer follows it, on the larger of the two it dipped under ARM_FRONT
    // where one hands over to the other and the arm under the body showed for a frame
    const cryK = h.castK === 'cry' ? SS(0, 0.08, castT) * (1 - SS(0.45, 0.75, castT)) : 0;
    // from behind the resting blade points away from the camera, so it sits behind the body unless it swings down
    // (TASKS 2156) the lowered blade hangs plumb from behind as the hands come in: at the back view's own pace it swung 18 px in a frame
    const guardA = BLADE_REST + (BACK_VIEW.blade - BLADE_REST) * backV, lowA = GUARD.low + (GUARD.backLow - GUARD.low) * Math.max(tuck, backF) * (1 - whirlE);
    const actT = Math.max(h.atkT ?? -9, h.whirlT ?? -9, h.castT ?? -9), guard = Math.max(guardOf(GT - actT), guardOf(GT - (h.patkT ?? -9))), restA = lowA + (guardA - lowA) * guard;
    if (clubSwing && pole) {
      blowA = swAim(clubEvent.a, clubBase.reach);
      const sw = swingPose(clubT, blowA, clubBase.arc * Math.PI / 180, pole.rest, null, club.windup, club.cooldown);
      bladeA = sw.blade; armA = sw.arm; swingK = sw.k; bend = sw.bend; bladeFs = sw.fs;
    } else if (whirlE === 0 && swinging && !shooter) { const arcR = st.arc * Math.PI / 180, pT = GT - (h.patkT === undefined ? -9 : h.patkT);
      const prev = pT < SWING.end && h.patkT < h.atkT ? swingPose(pT, swAim(h.patkA), arcR, guardA) : null;
      const sw = swingPose(atkT, swAim(h.atkA), arcR, guardA, prev || { blade: restA, k: 0 });
      bladeA = sw.blade; armA = sw.arm; swingK = sw.k; bend = sw.bend; bladeFs = sw.fs; blowA = swAim(h.atkA); }
    const shoulderDy = hipDy - 0.6 * breath / s;   // the chest lifts on the breath a little more than the hip
    const armPose = (side, swingA) => {
      const S0 = RG['sh' + side], E0 = RG['elbow' + side], Hd0 = RG['hand' + side];
      const Sp = [S0[0], S0[1] + shoulderDy];
      let r1 = swingA + (side === 'L' ? NEAR_OUT * (1 - run) : 0), r2 = swingA * 0.6 + ARM_BEND - RUN_BEND * run;
      return { S0, E0, Hd0, Sp, r1, r2, k2: 1 };
    };
    // a positive turn moves the hand (−dy, dx): the sign that carries it along the travel against its own leg
    const legSwing = Math.cos(P.p) * 0.42 * run, sg = (side) => ((RG['hand' + side][0] - RG['sh' + side][0]) * P.diry - (RG['hand' + side][1] - RG['sh' + side][1]) * P.dirx >= 0 ? 1 : -1);
    const arms = { L: armPose('L', -sg('L') * legSwing * 0.8 + breath * 0.06 - sway * 1.5), R: armPose('R', sg('R') * legSwing * 0.8 - breath * 0.05 - sway * 1.5) };
    const pose = (A, dr1, bend, k) => { A.r1 += dr1 * k; A.r2 += (A.r1 + bend - A.r2) * k; A.k2 += (1 - A.k2) * k; };   // blended by the effect's strength: no elbow snap at its start
    // two-bone reach of an arm to a rig-space target (relative to its shoulder), the elbow bending down: blended by k
    const reach = (A, tx, ty, k) => { const l1 = dist2(A.S0, A.E0), l2 = dist2(A.E0, A.Hd0), d = Math.min(Math.hypot(tx, ty), l1 + l2 - 0.5), b = Math.atan2(ty, tx);
      const a1 = b + Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))), E = [Math.cos(a1) * l1, Math.sin(a1) * l1];
      // (the elbow's bend is blended, not the forearm's own turn: an arm raised overhead is half a turn from its rest, and the
      // forearm's shortest way there flipped sides between frames, TASKS 1702)
      const r1 = a1 - ang(A.S0, A.E0), bend = wrapPi(Math.atan2(ty - E[1], tx - E[0]) - ang(A.E0, A.Hd0) - r1), bend0 = A.r2 - A.r1;
      A.r1 += wrapPi(r1 - A.r1) * k; A.r2 = A.r1 + bend0 + wrapPi(bend - bend0) * k; A.k2 += (1 - A.k2) * k; };
    const armLen = (A) => dist2(A.S0, A.E0) + dist2(A.E0, A.Hd0);
    // (the hand held out before him comes in as he turns: mirrored out there on a whirl's turn it jumped 12 px)
    const hold = (LK.arm || {}).hold;
    // (TASKS 2180) held before the blow is posed, so the blow lifts the fist out of it: after it, at full strength, it held the fist at the hip
    // through every blow and the blade turned round it
    // (TASKS 2156) the staff is heavy: its arm barely swings on the run, or on the back swing the upper arm covered the crystal in 4 of 12 frames
    // (TASKS 2181) and drawn up by HOLD_RUN of the arm on the run: from the near plumb hold the swing dropped the fist under 0.46 H
    if (hold && W) reach(arms.R, hold[0] * (1 - tuckL) * armLen(arms.R), (hold[1] - HOLD_RUN * run) * armLen(arms.R), 1 - (pole ? POLE_SWING : 0.5) * run);
    const swingArm = () => {
      armR = arms.R; const w = wrapPi(armA - Math.PI / 2), r1 = w - 0.15 * Math.sin(w);   // ≈0.85·w near rest, yet periodic: no spin at ±π
      armR.r2 = armR.r2 + wrapPi(r1 + bend - armR.r2) * swingK; armR.r1 = armR.r1 + wrapPi(r1 - armR.r1) * swingK;
    };
    if (swingK > 0 && !clubSwing) swingArm();
    // a shot's weapon follows the aim the shot was loosed on, not the live pointer (TASKS 1153: a mouse turned in the wind-up parted staff and bolt); the kick belongs to what is being done
    const aimS = shooting && shootE >= castE ? (h.face > 0 ? h.atkA : Math.PI - h.atkA) : aimL, kickT = castE > shootE ? castT : atkT;
    // (TASKS 1800) the mage's three are three gestures: the shot a thrust down the aim, the frost the staff raised overhead and swept
    // down onto it, the fireball the free hand drawn in to the chest, then thrown at the aim
    // (TASKS 2156) and the staff raised high over it the while, crystal up: kept low it read as the plain shot's forward thrust
    const mageG = shooter && !bowArm && castE > shootE ? h.castK : null, frostUp = mageG === 'frost' ? SS(0, 0.26, castT) * (1 - SS(0.28, 0.54, castT)) : 0, aimG = mageG === 'fireball' && pole ? FB_RAISE.a : aimS - 1.1 * frostUp, fbOpen = mageG === 'fireball' ? SS(0.14, 0.28, castT) : 1;
    const orbInPalm = !!(GR.shield && GR.shield[0] === SHIELD.orb[0]);
    const orbCup = orbInPalm && !!window.ASSETS[pn + 'cupL'];
    // the upper arm set by its turn, the forearm turned at the hand and shortened to it (k2), blended by k
    const palm = (A, tx, ty, ea, k) => { const l1 = dist2(A.S0, A.E0), l2 = dist2(A.E0, A.Hd0), E = [Math.sin(ea) * l1, Math.cos(ea) * l1];
      const r1 = Math.atan2(E[1], E[0]) - ang(A.S0, A.E0), r2 = Math.atan2(ty - E[1], tx - E[0]) - ang(A.E0, A.Hd0), k2 = Math.min(1, Math.hypot(tx - E[0], ty - E[1]) / l2), bend0 = A.r2 - A.r1;
      A.r1 += wrapPi(r1 - A.r1) * k; A.r2 = A.r1 + bend0 + wrapPi(r2 - r1 - bend0) * k; A.k2 += (k2 - A.k2) * k; A.r2h = r2; };
    const oh = o.menu ? ORB_HOLD.menu : ORB_HOLD;
    // (TASKS 2202) the orb's hand comes in to the body's axis through a turn inside its own hold, the elbow and the shortened forearm kept:
    // the turn's reach blended the hold's joint angles with its own and lifted the orb 13 px toward the shoulder for a frame at each end
    const palmX = (k) => oh.hand[0] * armLen(arms.L) + (gx - hipDx - arms.L.Sp[0] - oh.hand[0] * armLen(arms.L)) * k;
    if (orbInPalm) { const r10 = arms.L.r1; palm(arms.L, palmX(tuckL), oh.hand[1] * armLen(arms.L), oh.elbow, 1); const d = wrapPi(r10 - arms.L.r1) * ORB_HOLD.swing * run; arms.L.r1 += d; arms.L.r2 += d; }
    const palmed = orbInPalm ? [arms.L.r1, arms.L.r2, arms.L.k2] : null;
    if (whirlE > 0 && swingK === 0) {   // the ellipse is centred behind the shoulder, toward the body's axis, inside the arm's reach
      const l = armLen(arms.R), wx = Math.cos(whirlTh) * face, c0 = -0.3 * l, cx = c0 + (gx - hipDx - arms.R.Sp[0] - c0) * tuckL, tx = cx + 0.4 * l * wx, ty = 0.6 * l + 0.25 * l * Math.sin(whirlTh);
      armR = arms.R; reach(arms.R, tx, ty, whirlE);
      pose(arms.L, 0.8, -0.5, whirlE);
    } else if (chargeE > 0 || cryE > 0 || cryPrep > 0) {
      // the warrior's charge (TASKS 1134): the blade thrust out down the aim, the free arm flung back; the war cry: blade and fist
      // thrown up over the head
      const l = armLen(arms.R);
      // (the breath and the shout are one reach whose target slides from the chest up over the head: two reaches in a row flipped
      // the elbow where the first let go, the hand jumped 38 % of the height in a frame, TASKS 1702)
      if (cryPrep > 0 || cryE > 0) { const w = SS(0.08, 0.28, castT);
        const arc = (A, x0, y0, x1, y1) => { const a0 = Math.atan2(y0, x0), a = a0 + (Math.atan2(y1, x1) - a0) * w, r = (Math.hypot(x0, y0) + (Math.hypot(x1, y1) - Math.hypot(x0, y0)) * w) * l; reach(A, r * Math.cos(a), r * Math.sin(a), cryK); };
        arc(arms.R, 0.3, 0.35, 0.25, -0.9); arc(arms.L, 0.1, 0.35, -0.15, -0.85); }
      if (chargeE > 0) { reach(arms.R, 0.2 * l + Math.cos(aimL) * 0.8 * l, Math.sin(aimL) * 0.8 * l - 0.05 * l, chargeE * (1 - swingK)); pose(arms.L, 0.6, 0.3, chargeE); }
    } else if (shootE > 0 || (shooter && castE > 0)) {   // (a mage casts through his staff too: no free-hand push, no lowered blade)
      const l = armLen(arms.R), pe = Math.max(shootE, castE), kick = 0.1 * l * SS(BT - 0.01, BT + 0.05, kickT) * (1 - SS(BT + 0.05, BT + 0.25, kickT));
      // (aimed high the shouldered hand reaches as far as a bow's: tucked closer the elbow flipped over on the lowering)
      const rl = xbow ? 0.52 + 0.2 * Math.max(0, -Math.sin(aimS)) : mageG === 'fireball' ? (pole ? FB_RAISE.reach : 0.42) : 0.72, tx = 0.15 * l + Math.cos(aimG) * (rl * l - kick), ty = Math.sin(aimG) * (rl * l - kick) - 0.12 * l;
      // (TASKS 2146) casting with the orb in the free palm, the orb hand is raised high toward the aim and the wand arm braced low before him
      const orbCast = mageG && orbInPalm && !pole;
      if (orbCast) reach(arms.R, 0.15 * l + Math.cos(aimS) * 0.45 * l, Math.sin(aimS) * 0.45 * l + 0.2 * l, pe); else reach(arms.R, tx, ty, mageG === 'fireball' && !pole ? 0.35 * pe : pe);
      // a bow is drawn (TASKS 1125 critic): the far hand takes the string at the stave and pulls it back along the aim through the
      // wind-up, lets it snap home on the loose
      if (xbow) { const dl = 14 / s / Math.hypot(Math.cos(aimS), Math.sin(aimS) / DEPTH_K); reach(arms.L, RG.shR[0] - RG.shL[0] + tx + Math.cos(aimS) * dl, RG.shR[1] - RG.shL[1] + ty + Math.sin(aimS) * dl, pe); }
      // (TASKS 2146) the far arm takes the bow out to the aim and the near hand draws the string to the cheek, as a right-handed archer
      // seen from his right does; both hands meet at the grip on the raise, where the bow passes from one to the other
      else if (bowArm) { const dl = 0.72 * l * drawE; reach(arms.L, RG.shR[0] - RG.shL[0] + tx, RG.shR[1] - RG.shL[1] + ty, pe); reach(arms.R, tx - Math.cos(aimS) * dl, ty - Math.sin(aimS) * dl, pe); bowHand = SS(0, 0.9, pe); }
      else if (orbCast) { const lL = armLen(arms.L); reach(arms.L, RG.shR[0] - RG.shL[0] + 0.2 * lL + Math.cos(aimS) * 0.3 * lL, -0.85 * lL + Math.sin(aimS) * 0.2 * lL, pe); }
      else if (mageG === 'fireball') { const o = fbOpen, lL = armLen(arms.L), low = orbInPalm ? FB_RAISE.orbLow * SHIELD.orb[1] / s : 0, up = orbInPalm ? Math.max(-FB_RAISE.orbUp, Math.sin(aimS)) : Math.sin(aimS);
        reach(arms.L, 0.3 * lL + (Math.cos(aimS) * 0.7 * lL - 0.1 * lL) * o, 0.3 * lL + low + (up * 0.7 * lL - 0.35 * lL) * o, pe); }
      else pose(arms.L, -0.15 - 0.5 * (mageG === 'frost' ? frostUp : 0), 0.3, pe);
    } else if (castE > 0) {             // the free hand pushes the spell toward the aim; the sword arm lowers its blade
      const l = armLen(arms.L); reach(arms.L, 0.25 * l + Math.cos(aimL) * 0.6 * l, Math.sin(aimL) * 0.6 * l, castE);
      pose(arms.R, -0.25, 0.35, castE);
    }
    if (clubSwing && swingK > 0) swingArm();
    // reading a scroll (TASKS 1032): the free hand holds it out before the chest, the sword arm lowered
    const readE = h.read && swingK === 0 && whirlE === 0 && castE === 0 ? SS(0, 0.3, GT - h.read.t0) : 0;
    if (readE > 0) { const l = armLen(arms.L); reach(arms.L, 0.6 * l, 0.12 * l, readE); pose(arms.R, -0.2, 0.3, readE); }
    if (dashE > 0 && Math.max(shootE, shooter ? castE : 0) < 0.05) { pose(arms.L, 0.55 * dashF, 0.45, dashE); pose(arms.R, 0.55 * dashF, 0.45, dashE); }   // (a leap's shot keeps its bow arm, TASKS 1125, and so does the leap's own raised bow: both at once jerked the hands, TASKS 1702)
    // (TASKS 2192) the mage's staff or wand arm keeps its elbow's bend as the blow throws it back: unbent from the fist at the chest (2181)
    // the grip swung 7.6 px a frame, five times the warrior's
    if (hurtE > 0 && swingK === 0) { pose(arms.L, -0.45, 0.5, hurtE); pose(arms.R, -0.3, shooter && !bowArm ? arms.R.r2 - arms.R.r1 : 0.45, hurtE); }
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
    // (TASKS 2162) a robe's back is one painted piece: on the run its hem swings with the stride, look.robe of ROBE_BACK rad more than
    // a cape's (the cape's 0.05 rad, about 2 px at the hem, read as a still back with the legs walking under it)
    // (TASKS 2195) 0.12 → 0.09 as the back grew to the ankles (its bone 183 → 246 px): the hem travels as far as it did
    const robeSw = (LK.robe || 0) * ROBE_BACK * run * Math.sin(P.p);
    // (TASKS 2202) a cape to the calves from behind flaps with each step as the front cape does (look.back.swing on sin 2p, the front's 0.08):
    // on the stride's 0.05 alone its tip travelled 2 px a stride against the front cape's 5 and read as a board over the walking legs
    const capeB = wave + run * (0.1 * P.dirx + 0.05 * Math.sin(P.p) + (LK.back?.swing || 0) * Math.sin(2 * P.p)) + robeSw + 0.08 * (ring(atkT - 0.08, 2.2, 5) + (shooter ? ring(GT - h.patkT - 0.08, 2.2, 5) : 0)) + 0.1 * ring(GT - (h.backT ?? -9) - 0.05, 1.6, 4);
    // (a shooter fires again inside the ring: the last shot's ring rings on, or the hair snapped back, TASKS 1125)
    const hairA = 1.5 * wave - run * (0.1 + 0.08 * fwd - 0.08 * Math.sin(2 * P.p + 0.8)) - 0.2 * dashE + 0.15 * (ring(atkT - 0.05, 3, 6) + (shooter ? ring(GT - h.patkT - 0.05, 3, 6) : 0)) + 0.12 * hurtE;
    const soft = (n, ...a) => window.ASSETS[n + '_w'] ? Object.assign({ wtex: G.tex(n + '_w'), wsz: [RG.w, RG.h] }, ...a.map((v, b) => ({ ['bone' + b]: [RIGS[n].bones[b][0] / RG.w, RIGS[n].bones[b][1] / RG.h, v, 1] }))) : {};
    // positions of the near arm's joints in rig px (for the weapon and the trace)
    const rotP = (p, c, a) => { const dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; };
    const armJ = (A) => { const E = rotP([A.E0[0], A.E0[1] + shoulderDy], A.Sp, A.r1), H0 = rotP(rotP([A.Hd0[0], A.Hd0[1] + shoulderDy], A.Sp, A.r1), E, A.r2 - A.r1), Hd = [E[0] + (H0[0] - E[0]) * A.k2, E[1] + (H0[1] - E[1]) * A.k2]; return { E, Hd }; };
    // (TASKS 2156) through a turn both hands come in to the body's axis as a turning body's would, nearest it at the mirror, under the
    // back view: mirrored where they were, the weapon, bow, shield and orb crossed the body in one frame
    // (TASKS 2156) the bow passes from hand to hand where the hands meet: as they near each other they close on the point between them,
    // one on the other halfway, and the bow is in the near hand before and the far one after (lerped between them it hung 7–14 px from both)
    if (bowArm && !xbow && bowHand > 0 && bowHand < 1) { const PR = armJ(arms.R).Hd, PL = armJ(arms.L).Hd, m = SS(0, BOW_MEET, bowHand) * (1 - SS(1 - BOW_MEET, 1, bowHand));
      const G0 = [PR[0] + (PL[0] - PR[0]) * bowHand, PR[1] + (PL[1] - PR[1]) * bowHand], SL = arms.L.Sp, gL = Math.min(1, 0.97 * armLen(arms.L) / dist2(G0, SL)), G = [SL[0] + (G0[0] - SL[0]) * gL, SL[1] + (G0[1] - SL[1]) * gL];   // within the far arm's reach
      for (const A of [arms.L, arms.R]) { const P = armJ(A).Hd; reach(A, P[0] + (G[0] - P[0]) * m - A.Sp[0], P[1] + (G[1] - P[1]) * m - A.Sp[1], SS(0, 0.3, m)); } }
    const heldTucked = palmed && arms.L.r1 === palmed[0] && arms.L.r2 === palmed[1] && arms.L.k2 === palmed[2];
    for (const [A, k] of [[arms.L, heldTucked ? 0 : tuckL], [arms.R, tuck]]) if (k > 0) { const Hd = armJ(A).Hd; reach(A, Hd[0] + (gx - hipDx - Hd[0]) * k - A.Sp[0], Hd[1] - A.Sp[1], SS(0, 0.3, k)); }
    const jL = armJ(arms.L), jR = armJ(arms.R);
    // (TASKS 2180) each action's share of the arm over the body is eased in over FRONT_IN s from its start as well: a shot's or a blow's
    // envelope rises in 2–3 frames, and on its share alone the arm came over the chest in one or two; a blow or a shot that follows the
    // last inside its envelope starts where the first one did, so the arm stays over between them
    const atk0 = h.patkT < h.atkT && h.atkT - h.patkT < SWING.end ? h.patkT : h.atkT, since = (t0) => (t0 === undefined ? 1 : SS(0, FRONT_IN, GT - t0));
    // (TASKS 2201) the whirl's arm and blade are drawn once a frame, in one of three layers by where the blade points: out on the arm's
    // own side (past the far shoulder) the arm under the torso and the blade and fist over it, as at ease; swept across the front to the
    // other side all of it over the torso; behind him (past WHIRL_BACK) all of it under the back view, which now comes in that same frame,
    // so the arm leaves the chest as the torso turns; side ↔ front falls where the blade points at the camera. Cross-faded over WHIRL_FADE
    // the arm showed through the chest for 4–14 frames and the face through the back
    const whirlLay = whirlE > 0 ? (Math.sin(whirlTh) < -WHIRL_BACK ? 'back' : Math.cos(whirlTh) * fX > WHIRL_SIDE ? 'side' : 'front') : null;
    // (TASKS 2201) the warrior's blow and cry switch the arm over the body in one frame where it covers the least of the torso, instead of
    // the cross-fade: in at half its share, out where FRONT_OFF of it is left (a blow's arm is then nearly at rest, the cry's still raised
    // clear of the chest); a shooter's arm still fades
    const layK = (e, t0, off) => { const k = SS(0, ARM_FRONT, e) * since(t0); return shooter ? k : k >= (GT - t0 < FRONT_IN ? FRONT_OFF.on : off) ? 1 : 0; };
    const front = (LK.arm || {}).behind ? Math.max(...[[Math.max(swingK, shooter ? shootE : 0), atk0, FRONT_OFF.blow], [whirlLay === 'front' ? 1 : 0], [Math.max(chargeE, cryK, shooter ? castE : 0), h.castT, FRONT_OFF.cast],
      [readE, h.read && h.read.t0], [buckle, h.deadT], [o.victory ? 1 : 0], [o.armsUp || 0]].map(([e, t0, off = FRONT_OFF.blow]) => layK(e, t0, off))) : 1;
    // ---- draw: far arm → far leg → near leg → body → near arm + weapon (weapon behind the body when it points away) ----
    // (TASKS 2146) a robe to the ankles (look.robe): its thighs are the skirt's two halves, swung after the legs by that share of the
    // thigh's turn and drawn over the shins, so the boots step out under a hem that parts at the front instead of a sack sliding on
    // (TASKS 2195) from behind the back view is the whole robe to that hem: the skirt under it showed as a second, longer robe
    const robe = LK.robe || 0;
    const footK = (side) => (1 - (1 - BACK_VIEW.footFs) * backV) * (1 - (1 - (side === 'L' ? STANCE.frontFoot : STANCE.nearFoot)) * (1 - run) * (1 - backV));
    // (TASKS 2196) the skirt's halves go over both legs: after its own leg only, the near shin with its dark top lay over the far half and
    // read as a leg torn off under the robe
    const thigh = (side, u) => { const g = legs[side]; part('thigh' + side, g.H0, R2S(g.Hp[0], g.Hp[1]), robe ? (robe + (ROBE_SWING - robe) * Math.abs(pdx) * (g.r1 > 0 ? 1 : 0)) * g.r1 : g.r1, u, robe ? 1 : g.k1); };
    const drawLeg = (side, u) => { const g = legs[side];
      if (!robe) thigh(side, u);
      part('shin' + side, g.K0, R2S(g.K[0], g.K[1]), g.r2, u, g.k2); part('foot' + side, g.A0, R2S(g.T[0], g.T[1]), -g.lift * 0.02 + heel[side], u, 1, 0, footK(side)); };
    // bits: u the upper arm, f the forearm
    const drawArm = (side, u0, bits = 'uf', alt = '') => { const A = arms[side], J = side === 'L' ? jL : jR, u = shade(u0, 1, BACK_VIEW.armShade);
      if (bits.includes('u')) part('uarm' + side, A.S0, R2U(A.Sp[0], A.Sp[1]), A.r1, u, 1, bodyR, 1, alt);
      if (bits.includes('f')) part(((side === 'R' && gripFist && gripSeen) || (side === 'L' && orbCup && backV < ORB_CUP.back) ? 'cuff' : 'farm') + side, A.E0, R2U(J.E[0], J.E[1]), A.r2, u, A.k2, bodyR); };
    // (TASKS 2170) the archer's fists close over his bow and crossbow as the warrior's over his hilt: the near one at rest and on the
    // string, the far one round the stave once the bow has passed to it on a shot
    // (TASKS 2177) a rig with a cuff (the forearm cut short of its hand) closes a fist of its own over the weapon, turned with the weapon's
    // axis (gripAt, set as the weapon is drawn): the fingers lie across the shaft in every pose, where the forearm's hand turned with the
    // forearm and showed its back over the hilt
    const fistOver = !!W && !!window.ASSETS[pn + 'fistR'], gripFist = fistOver && !!window.ASSETS[pn + 'cuffR'];
    let gripAt = null;
    const fistOne = (side, u0) => { const A = arms[side], J = side === 'L' ? jL : jR, u = shade(u0, 1, BACK_VIEW.armShade); if (!window.ASSETS[pn + 'fist' + side]) return;
      if (side !== 'R' || !gripFist) { part('fist' + side, A.E0, R2U(J.E[0], J.E[1]), A.r2, u, 1, bodyR); return; }
      const g = GR.part('fistR'), tx = fine(g.tex), T = G.tex(tx), w = T.w * s, hh = T.h * s, E = R2U(J.E[0], J.E[1]), Hd = R2U(J.Hd[0], J.Hd[1]);
      const at0 = gripAt && bowHand < 0.5 ? gripAt.p : Hd, a0 = (gripAt ? gripAt.a : Math.atan2(Hd[1] - E[1], Hd[0] - E[0])) + Math.PI / 2;
      // (TASKS 2200) in the world the fist (3 × 4 cells of the grid) stands square on it, turned by quarter turns only: turned with the
      // weapon or off the grid by half a world px, its one-cell rows of fingers fell between two pixels and lost the vote to the skin
      const world = L.SNAP && !L.pre && !o.menu, q = world ? Math.round(a0 / (Math.PI / 2)) : 0, a = world ? q * Math.PI / 2 : a0;
      const grid = (v, n) => (n % 2 ? 2 * Math.round((v - 1) / 2) + 1 : 2 * Math.round(v / 2)), nw = Math.round(w / 2), nh = Math.round(hh / 2);
      const at = world ? [grid(at0[0], q % 2 ? nh : nw), grid(at0[1], q % 2 ? nw : nh)] : at0;
      L.sprite(tx, 0, 0, { m: M.of(M.t(at[0], at[1]), M.r(a), M.s(fX, 1)), w, h: hh, pivot: [w / 2, hh / 2], u: tinted(u, g.tint) }); };
    const drawFist = (u0) => { fistOne('R', u0); if (bowArm && !xbow && bowHand >= 0.5) fistOne('L', u0); };
    // the shield is strapped across the far forearm, its face to the camera; from behind its plain back shows (darker)
    // (TASKS 2153) in the arch's x3.2 the small world orb blurred into a blob: there it is the orb of the mage's reference
    const orbTex = (t) => (o.menu && window.ASSETS[t + '_menu'] ? t + '_menu' : t);
    const shield = (u) => { if (!GR.shield) return; const [tex, hh] = GR.shield, A = arms.L, E = R2U(jL.E[0], jL.E[1]), Hd = R2U(jL.Hd[0], jL.Hd[1]), ww = hh * G.tex(tex).w / G.tex(tex).h;
      // (TASKS 2146) the orb is not strapped on: it rests in the open far palm, as on the mage's reference
      if (tex === SHIELD.orb[0]) { const cup = fine(pn + 'cupL'), T = orbCup && G.tex(cup), cw = orbCup ? T.w * s : 0, ch = orbCup ? T.h * s : 0, Wr = [E[0] + (ORB_CUP.cut + (1 - ORB_CUP.cut) * backV) * (Hd[0] - E[0]), E[1] + (ORB_CUP.cut + (1 - ORB_CUP.cut) * backV) * (Hd[1] - E[1])];
        const C = o.menu ? ORB_CUP.menu : ORB_CUP.world, ok = orbCup && o.menu ? ORB_CUP.menuK : 1, turn = A.r2h === undefined ? 0 : Math.max(-ORB_CUP.turn, Math.min(ORB_CUP.turn, wrapPi(A.r2 - A.r2h)));
        // the cup's orb sits beside the hand toward the facing: from behind it comes onto the hand, or it jumped across the body on the turn's flip
        // (TASKS 2190) the cup narrows to its forearm and slides along it to the hand as the body turns away instead, and past ORB_CUP.back of
        // the back view the forearm is drawn whole with its own hand: the cup alone left the forearm's end bare beside the torso (8 world
        // px² open at the shoulder through the turn)
        const palm = [Hd[0] + fX * 2, Hd[1] - 0.42 * hh], m0 = M.of(M.t(Wr[0], Wr[1]), M.r(fallR + bodyR), M.s(fX * (1 - backV), 1), M.r(turn)), o0 = orbCup ? M.ap(m0, [(C.orb[0] - C.arm[0]) * cw, (C.orb[1] - C.arm[1]) * ch]) : palm;
        const oc = orbCup ? o0 : [palm[0] + (o0[0] - palm[0]) * (1 - backV), palm[1] + (o0[1] - palm[1]) * (1 - backV)], cm = m0;
        L.sprite(orbTex(tex), 0, 0, { m: M.of(M.t(oc[0], oc[1]), M.r(fallR + bodyR)), w: ww * ok, h: hh * ok, pivot: [ww * ok / 2, hh * ok / 2], u: tinted(Object.assign({}, U, { alpha: u.alpha }), GR.shieldTint) }); L.joint(id, 'orb', oc);
        if (orbCup && backV < ORB_CUP.back) L.sprite(cup, 0, 0, { m: cm, w: cw, h: ch, pivot: [C.arm[0] * cw, C.arm[1] * ch], u: tinted(shade(u, 1, BACK_VIEW.armShade), GR.part('cupL').tint) }); return; }
      // (TASKS 2170) its middle near the fist that holds its grip: on the forearm's middle the buckler left the fist at its rim
      const sk = SHIELD_AT + (1 - SHIELD_AT) * tuckL, c = [E[0] + sk * (Hd[0] - E[0]) - fX * 4 * (1 - tuckL), E[1] + sk * (Hd[1] - E[1])], back = backK > 0.5; L.joint(id, 'shield', c);
      L.sprite(tex, 0, 0, { m: M.of(M.t(c[0], c[1]), M.r(fallR + bodyR + 0.25 * (A.r2 - 0.18)), M.s(fX, 1)), w: ww, h: hh, pivot: [ww / 2, hh / 2], u: back ? Object.assign({}, u, { grade: [0.35, 0.45, 0, 1] }) : tinted(u, GR.shieldTint) }); };
    const scroll = () => { const Hd = R2U(jL.Hd[0], jL.Hd[1]), w = 22, hh = w * 177 / 228;
      L.sprite('it_scroll', 0, 0, { m: M.of(M.t(Hd[0], Hd[1]), M.r(fallR + bodyR - 0.35 * fX), M.s(fX, 1)), w, h: hh, pivot: [w * 0.45, hh * 0.55], u: Object.assign({}, U, { alpha: alpha * SS(0.3, 0.5, readE) }) }); };
    const weapon = (uw = U) => { if (!W || SC.hide.weapon) return; const [tex0, len] = W, bowH = window.ASSETS[tex0 + '_h'], tex = shooter && bowH ? tex0 + '_h' : window.ASSETS[tex0 + '_held'] ? tex0 + '_held' : tex0, HdR = R2U(jR.Hd[0], jR.Hd[1]), HdL = R2U(jL.Hd[0], jL.Hd[1]), Hd = [...(bowHand < 0.5 ? HdR : HdL)], b0 = xbow ? 0.5 + arms.R.r1 * 0.5 : bowArm ? BOW_REST.ba + arms.R.r1 * 0.3 : pole ? pole.rest + arms.R.r1 * pole.lean : (shooter ? -1.18 : restA) + arms.R.r1 * 0.5, ba0 = bladeA !== null && !clubSwing ? bladeA : b0 + (0.9 - b0) * (shooter ? 0 : castE),
        pk0 = Math.max(shootE, shooter ? castE : 0), pk = atkT > BT ? pk0 * pk0 * (3 - 2 * pk0) : pk0, rise = shooter ? 0.15 * SS(BT - 0.01, BT + 0.05, kickT) * (1 - SS(BT + 0.05, BT + 0.25, kickT)) : 0,
        bow = shooter && !xbow && !!(D.BASES[st.wtype] || {}).dex, ba1 = pk > 0 ? ba0 + wrapPi(aimG - (bow ? Math.PI / 2 : 0) - rise - ba0) * pk : ba0, ba2 = chargeE > 0 ? ba1 + wrapPi(aimL - ba1) * chargeE * (1 - swingK) : ba1, ba = clubSwing && pole ? bladeA + wrapPi(ba2 - pole.rest) * (1 - swingK) : cryE > 0 ? ba2 + wrapPi(-1.45 - ba2) * cryE : ba2;
      // (TASKS 2156) in a turn a raised weapon stands plumb at the mirror, so mirroring it does not swing its tip across
      // (TASKS 2192) and a lowered one hangs plumb under the hand, shortened to TURN_LOW so it clears the soles and the floor never tips
      // it to one side: pointed away from the camera it was cut to a tenth and hidden under the back view, gone for 3–4 frames
      const up = Math.sin(b0) < 0, bt = tuck > 0 ? ba + wrapPi((up ? -1 : 1) * Math.PI / 2 - ba) * tuck : ba;
      let sa = Math.atan2(Math.sin(bt), fX * Math.cos(bt)) + fallR + bodyR;         // screen angle of the blade, squeezed with the rig
      // a slash sweeps flat around the body: on the floor plane the camera squeezes depth to DEPTH_K, so a blade pointing up or down
      // the screen points away from or at the camera and projects shorter (by the screen angle of a flat blade)
      let fsD = bladeFs * (1 + (DEPTH_K / Math.hypot(DEPTH_K * Math.cos(sa), Math.sin(sa)) - 1) * swingK) * Math.hypot(fX * Math.cos(ba), Math.sin(ba)) * (shooter ? 1 : 1 - (1 - BACK_VIEW.bladeFs) * backV * (1 - swingK));
      if (tuck > 0 && !up) fsD *= 1 - (1 - TURN_LOW) * tuck;
      if (whirlE > 0) { const c = Math.cos(whirlTh), d = Math.sin(whirlTh) * DEPTH_K; sa += wrapPi(Math.atan2(d, c) - sa) * whirlE; fsD += (Math.hypot(c, d) - fsD) * whirlE; }
      // the weapon answers a blow (TASKS 1153, 1160) and a bow's stave kicks at the loose; dead, a shooter's weapon falls and lies beside him
      if (shooter) sa += 0.2 * ring(GT - h.hurtT, 3.2, 9) + (bow ? 0.05 * ring(atkT - BT, 7, 12) : 0);
      const drop = du >= 0 ? SS(0.12, 0.42, du) : 0;   // (any weapon falls: the warrior's sword stood up out of his dead hand, TASKS 1803)
      if (shooter) { if (!bow) Hd[0] += pole || W[0] === 'it_wand' ? 0 : fX * 3 * (1 - pk0) * (1 - drop) * (1 - tuck); else Hd[1] -= 2 * (1 - pk0) * (1 - drop); }
      // (it arcs off the hand and bounces once; a bow lies clear of the legs and at an angle, along them it read as a third leg, critic r3)
      if (drop > 0) { sa += wrapPi((bow ? 0.45 : 0.1) - sa) * drop; fsD += (1 - fsD) * drop; Hd[0] += (root[0] + fX * (bow ? 60 : shooter ? 30 : fDir > 0 ? 70 : 34) - Hd[0]) * drop; Hd[1] += (hy - 3 - Hd[1]) * drop; Hd[1] -= 28 * drop * (1 - drop) + 6 * Math.sin(Math.PI * Math.max(0, Math.min(1, (du - 0.42) / 0.18))); }
      // (TASKS 2160) at ease the blade hangs near plumb along the leg, as on the warrior's ref; its point leans toward the camera, so it
      // shortens: at full length the floor held it at 44°, pointing forward off the body
      if (!shooter && bladeA === null && whirlE === 0 && drop === 0) fsD *= 1 - (1 - GUARD.lowFs) * (1 - guard) * (1 - backV);
      const tw = len, th = len * G.tex(tex).h / G.tex(tex).w, hull = HELD_HULL[tex];
      if (hull && !shooter && bladeA === null && whirlE === 0 && drop === 0) {
        const low = (a) => { const c = Math.cos(a), sn = Math.sin(a); let y = -1e9;
          for (const [fx, fy] of hull) { const x0 = (fx - 0.22) * tw, y0 = (fy - 0.78) * th, u = (x0 - y0) * Math.SQRT1_2 * fsD, v = (x0 + y0) * Math.SQRT1_2; y = Math.max(y, Hd[1] + sn * u + c * v); }
          return y; };
        // (TASKS 2162) it tips toward the facing unless it clearly points back: by the sign of cos(sa) the near-plumb blade from behind
        // crossed over on the run's arm swing and flipped sides twice a stride, 30 px a frame
        if (low(sa) > hy - SOLE_CLEAR) { const away = Math.cos(sa) * fX < -BLADE_BACK, to = wrapPi(((fX > 0) !== away ? 0 : Math.PI) - sa); let f0 = 0, f1 = 1;
          for (let i = 0; i < 10; i++) { const f = (f0 + f1) / 2; if (low(sa + to * f) > hy - SOLE_CLEAR) f0 = f; else f1 = f; }
          sa += to * f1; } }
      // the crossbow is painted from above: laid on the floor plane along its screen angle, it shortens aiming at or away from the
      // camera and shows its prod across the shot from every side; a bolt lies on it but for a moment after the loose
      if (xbow) { const th0 = Math.atan2(Math.sin(sa) / DEPTH_K, Math.cos(sa)), at = (fx) => { const lx = (fx - 0.3) * tw; return [Hd[0] + Math.cos(th0) * lx, Hd[1] + DEPTH_K * Math.sin(th0) * lx]; };
        L.sprite(fine(tex), 0, 0, { m: M.of(M.t(Hd[0], Hd[1]), M.s(1, DEPTH_K), M.r(th0)), w: tw, h: th, pivot: [tw * 0.3, th * 0.5], u: U });
        if (drop === 0 && !(swinging && atkT >= BT && atkT < BT + 0.3)) { const [a0, a1] = [at(0.33), at(0.86)], bl = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), ba3 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), ink = (c) => (o.id === 'occ' && L.sp && L.sp.ink ? L.sp.ink : c);
          L.solid(a0[0], a0[1], bl, 2.5, ink([0.16, 0.1, 0.06]), ba3, 0, 1.25, alpha); L.solid(a0[0], a0[1], bl, 1.2, ink([0.92, 0.8, 0.58]), ba3, 0, 0.6, alpha); L.solid(a1[0], a1[1], 4, 3, ink([0.8, 0.82, 0.86]), ba3, 0, 1.5, alpha); }
        gripAt = drop === 0 ? { p: [...Hd], a: Math.atan2(DEPTH_K * Math.sin(th0), Math.cos(th0)) - fX * Math.PI / 2 } : null;
        const tip = at(0.9); L.joint(id, 'grip', Hd); L.joint(id, 'tip', tip); if (id === 'hero') SC.heroTip = { x: tip[0], y: tip[1], t: GT }; return; }
      // a bow is held by the middle of its stave and turned across the shot (TASKS 1125); until the loose an arrow lies on it along the aim
      // (mirrored across its stave facing right, so its string faces the archer, not the target; turned over on the raise it went
      // edge-on twice and vanished for a frame, TASKS 1125 critic r2)
      const gq = pole ? pole.grip[0] + (pole.grip[1] - pole.grip[0]) * Math.max(pk, drop) : 0, along = (q) => pole ? [(pole.foot[q] + (pole.head[q] - pole.foot[q]) * gq) * (q ? th : tw)] : [],
        axis = pole ? Math.atan2((pole.head[1] - pole.foot[1]) * th, (pole.head[0] - pole.foot[0]) * tw) + Math.PI / 4 : 0;
      // (TASKS 2180) a staff stands on the world's pixel grid and is sampled from its full-size texture: at a sub-pixel place its 2–3 px
      // crystal lost bright cells from one frame of the run to the next (a third of them running down)
      const onGrid = (v) => (pole && L.SNAP && !L.pre ? 2 * Math.round((v - 1) / 2) + 1 : v), wm = M.of(M.t(onGrid(Hd[0]), onGrid(Hd[1])), M.r(sa), M.s(fsD, bow && fX > 0 ? -1 : 1), M.r(Math.PI / 4 - axis)), bg = bow ? BOW_GRIP[tex0] || [0.5, 0.5] : null, wpiv = bow ? [tw * bg[0], th * bg[1]] : pole ? [...along(0), ...along(1)] : [tw * 0.22, th * 0.78];
      L.sprite(fine(tex), 0, 0, { m: wm, w: tw, h: th, pivot: wpiv, u: pole ? Object.assign({}, uw, { snap: 2 * L.SNAP }) : uw });
      const tAt = (f) => M.ap(wm, [f[0] * tw - wpiv[0], f[1] * th - wpiv[1]]), ends = bow ? (NOCKS[tex0] || [[0.9, 0.15], [0.2, 0.87]]).map(tAt) : pole ? [pole.head, pole.foot].map(tAt) : null;
      const shaft = pole ? tAt([along(0)[0] / tw - (pole.head[1] - pole.foot[1]) * th / tw * (pole.across || 0), along(1)[0] / th + (pole.head[0] - pole.foot[0]) * tw / th * (pole.across || 0)]) : Hd;
      gripAt = drop === 0 ? { p: [...shaft], a: ends ? Math.atan2(ends[0][1] - ends[1][1], ends[0][0] - ends[1][0]) : sa } : null;
      const onAxis = (q) => M.ap(wm, [(pole.foot[0] + (pole.head[0] - pole.foot[0]) * q) * tw - wpiv[0], (pole.foot[1] + (pole.head[1] - pole.foot[1]) * q) * th - wpiv[1]]), head = pole ? onAxis(1) : null;
      if (!bow && !pole && drop === 0 && backK < 0.5 && guard >= 0.5 && !fistOver) L.solid(Hd[0] - 3, Hd[1] - 1, 6, 2, LK.fist || [0.85, 0.62, 0.48], 0, 0, 0, alpha);
      if (bow && drop === 0 && (bowH || drawE > 0.05)) { const Hs = bowHand < 0.5 ? HdL : HdR, flip = fX > 0 ? -1 : 1, nock = ([fx, fy]) => { const lx = (fx - bg[0]) * tw, ly = (fy - bg[1]) * th, c = Math.SQRT1_2, ux = (lx - ly) * c * fsD, uy = (lx + ly) * c * flip; return [Hd[0] + ux * Math.cos(sa) - uy * Math.sin(sa), Hd[1] + ux * Math.sin(sa) + uy * Math.cos(sa)]; }, [n1, n2] = NOCKS[tex0] || [[0.9, 0.15], [0.2, 0.87]], e1 = nock(n1), e2 = nock(n2);
        // the string is always drawn (TASKS 1160): straight at rest, a wedge to the hand on the draw, a shiver for three frames at the loose
        const quiver = atkT > BT && atkT < BT + 0.05 ? 2 * Math.sin(atkT * 190) : 0, Mid = drawE > 0.05 && atkT <= BT ? Hs : [(e1[0] + e2[0]) / 2 - Math.sin(sa) * quiver, (e1[1] + e2[1]) / 2 + Math.cos(sa) * quiver];
        // (TASKS 2146) under the arch's ×3.2 a 2 px string grew into a 6 px grey band: there it is drawn about 1.5 screen px thick
        const preK = L.pre ? Math.hypot(L.pre[0], L.pre[1]) : 1, sw = preK > 1 ? Math.max(0.5, 1.5 / preK) : 2;
        // (TASKS 2189) each piece centred on its line (the quad turns about its pivot, which lands at (x + px, y + py)): turned about a
        // corner 1 px off the line, the arch's 0.5 px string stood 0.75 px to one side above the grip and to the other below it, a
        // 5 screen px jog at the middle and both ends off the nocks. Straight, it is one piece nock to nock; a wedge, each half runs half
        // its width past the hand so the corner closes
        // (TASKS 2199) in the occluders' mask the string goes in the actor's ink, lit as the figure is; and darker than 2184's grey:
        // a torch lights the hero about ×1.8, so 0.5 came out L 83 on screen, the brightest line of the figure over his face (L 80)
        const scol = o.id === 'occ' && L.sp && L.sp.ink ? L.sp.ink : preK > 1 ? [0.66, 0.6, 0.5] : STRING_WORLD, line = (a, b, over = 0) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          L.solid(a[0], a[1] - sw / 2, l + over, sw, scol, Math.atan2(b[1] - a[1], b[0] - a[0]), 0, sw / 2, alpha); };
        if (Mid === Hs || quiver) for (const E of [e1, e2]) line(E, Mid, sw / 2); else line(e1, e2);
        L.joint(id, 'nockA', e1); L.joint(id, 'nockB', e2); L.joint(id, 'stringMid', Mid);
        if (drawE > 0.05 && atkT < BT) {
        // the nocked arrow drawn in code, light on the dark bow and brick: a pale shaft from the string hand along the aim, a steel head,
        // cream fletching at the nock (the painted arrow sprite was lost against them)
        // (TASKS 2201) in the occluders' mask in the actor's ink, as the string (2199): in its own pale colours it lit up like the floor
        const as = Math.atan2(Math.sin(aimS), h.face * Math.cos(aimS)) + fallR + bodyR, ca = Math.cos(as), sa2 = Math.sin(as), AL = 36, ink = (c) => (o.id === 'occ' && L.sp && L.sp.ink ? L.sp.ink : c);
        L.solid(Hs[0], Hs[1], AL, 3, ink([0.16, 0.1, 0.06]), as, 0, 1.5, alpha); L.solid(Hs[0], Hs[1], AL, 1.5, ink([0.92, 0.8, 0.58]), as, 0, 0.75, alpha);
        L.solid(Hs[0] + ca * AL, Hs[1] + sa2 * AL, 6, 4, ink([0.8, 0.82, 0.86]), as, 0, 2, alpha); L.solid(Hs[0], Hs[1], 7, 4, ink([0.95, 0.9, 0.78]), as, 0, 2, alpha); } }
      const tip = bow ? [Hd[0] + Math.cos(sa + Math.PI / 2 * fX) * 12, Hd[1] + Math.sin(sa + Math.PI / 2 * fX) * 12] : head || [Hd[0] + Math.cos(sa) * len * 0.78 * fsD, Hd[1] + Math.sin(sa) * len * 0.78 * fsD];
      L.joint(id, 'grip', Hd); L.joint(id, 'tip', tip); if (id === 'hero') SC.heroTip = { x: tip[0], y: tip[1], t: GT }; };
    // (TASKS 2162) the turn swaps the drawn views in one frame while the pose eases on turnK: cross-faded over 4 frames the front face
    // showed through the back of the head, a double face at ×3
    const backK = Math.max(turnK >= 0.5 ? 1 : 0, backF, whirlLay === 'back' ? 1 : 0, twist && du >= 0 ? SS(0.04, 0.3, du) : 0);
    // (TASKS 2180) a blow keeps one layer from wind-up to guard, by where it strikes: laid by the blade's own angle the wind-up and the
    // recovery took the sword under the torso and back over it in one frame twice a blow
    const behind = whirlLay ? whirlLay === 'back' : blowA !== null ? Math.sin(blowA) < -0.35 : backK > 0.5, over = behind ? 0 : 1;
    // (TASKS 2192) the whirl's back view keeps the fist round the hilt: the open hand farmR showed for the 7 frames it lasts
    const gripSeen = backK <= 0.5 || whirlE > 0;
    L.joint(id + '_view', 'back', [backK, 0]);
    L.joint(id + '_view', 'face', [face, 0]);
    const all = () => {
      const castFront = (castE > 0.3 && (!shooter || mageG === 'fireball')) || readE > 0.3;   // the casting (or reading) hand reaches forward across the chest, in front of the body
      const bodyAt = { m: M.of(M.t(...hipS), M.r(fallR + bodyR), M.s(fX, 1)), w: RG.w * s, h: RG.h * s, pivot: [Hc[0] * s, Hc[1] * s] };
      // the cape hangs from the shoulders behind the body and both arms (TASKS 2142, 2144, 2145: laid over the far arm it hid that arm
      // whole, and the shield or orb on it, the warrior seemed one-armed)
      const cape = () => { if (backK < 1 && window.ASSETS[pn + 'cape']) L.sprite(fine(GR.cape), 0, 0, Object.assign({ u: Object.assign({}, U, soft(pn + 'cape', capeA)) }, bodyAt)); };
      cape();
      // (TASKS 2146) the archer's quiver is its own rigid layer over the cape and under the far arm: painted into the body or the
      // cape it bent with their soft bones; from behind it is painted on the back view
      if (backK < 1 && window.ASSETS[pn + 'quiver']) L.sprite(fine(pn + 'quiver'), 0, 0, Object.assign({ u: U }, bodyAt));
      // (TASKS 2146) the orb in the far palm is drawn after the body: under it the far arm's swing took it behind the torso on every stride
      const orbLate = orbInPalm && backK < 0.5;
      // (TASKS 2170) the forearm holding the orb comes forward across the waist: over the body, under the orb
      // (TASKS 2181) the near arm's forearm and hand come over the body in the front view: under the body the hand lay behind the belt
      // pouch, half of the forearm hidden. A shield on it keeps its old place under the torso, as the author's sides left it: over the
      // body it would cover the chest
      // (TASKS 2191) and so does its upper arm, with a shield too, over the torso's side strip drawn under it: under the torso the torso's
      // own edge, painted where the arm hung on the sheet, lay over the sleeve as a dark seam, and the arm turned out by NEAR_OUT and the
      // breath slid out from under a cut-out
      // (TASKS 2194) the orb's upper arm too: under the torso the robe's edge stood over the bell sleeve as the same seam; its forearm and
      // the cup stay last, over the orb's layer. In the arch its bell is the _drape, wider at the foot: the arch's ×3.2 showed the slot
      // between the bell, the orb's rim and the cup
      const orbUp = orbLate && !behind && !castFront, nearArm = !castFront && !orbLate && backK <= 0.5, nearOver = nearArm && !GR.shield;
      if (backK <= 0.5 && arms.L.r1 > 0) { const A = arms.L, sr = Math.max(0, A.r1 - SOCK.span * (1 - SS(SOCK.wide[0], SOCK.wide[1], A.r1) * (1 - SOCK.far))) - SOCK.in, us = shade(Ufar, 1, BACK_VIEW.armShade), E = rotP([A.E0[0], A.E0[1] + shoulderDy], A.Sp, sr);
        part('uarmL', A.S0, R2U(A.Sp[0], A.Sp[1]), sr, us, 1, bodyR, 1, '_sock');
        if (nearOver && A.r1 <= SOCK.fore && window.ASSETS[GR.part('farmL').tex + '_sock']) part('farmL', A.E0, R2U(E[0], E[1]), sr + A.r2 - A.r1, us, A.k2, bodyR, 1, '_sock'); }
      if (!castFront && !nearArm && !orbUp) { drawArm('L', Ufar, 'uf'); if (!orbLate) shield(Ufar); }
      if (nearArm && !nearOver) { drawArm('L', Ufar, 'f'); shield(Ufar); }
      // (TASKS 2160) the cape hangs behind both legs, in the arch too: over the cape-side leg it cut that leg off at the knee
      drawLeg('L', Ufar);
      drawLeg('R', U);
      if (robe && backK < 1) { thigh('L', Ufar); thigh('R', U); }
      // a staff or a bow is gripped: the fist is drawn over its shaft, not the shaft across the fist
      // (TASKS 2146) and so is the lowered sword at ease: the hilt laid over the fist hid the hand that held it
      const grasp = (shooter && !xbow) || (swingK === 0 && whirlE === 0 && chargeE === 0 && cryE === 0 && guard < 0.5);
      // (TASKS 2180) under the body too the hand stays a fist round the hilt while the front is drawn: the open hand farmR swapped in for
      // the frames the blade pointed away
      if (behind) { weapon(); drawArm('R', U); if (fistOver && gripSeen) drawFist(U); } else if (front < 1) drawArm('R', U);
      // the arch's ×3.2 shows the texture nearly 1:1, where the face painted in world cells read as a mask (TASKS 2144, 2146): there
      // the same body with its head as drawn
      const bodyTex = fine(GR.body);
      if (backK < 1) L.sprite(bodyTex, 0, 0, Object.assign({ u: Object.assign({}, U, { snap: 2 * L.SNAP }, soft(pn + 'body', GR.helm ? 0 : hairA)) }, bodyAt));
      // (the mage's helms in the world are his grid head with the helm in grid cells; the arch has the drawn head wearing it, TASKS 2146, 2151)
      const helmTex = fine(pn + 'head_' + GR.helm);
      if (backK < 1 && GR.helm) L.sprite(helmTex, 0, 0, Object.assign({ u: Object.assign(tinted(U, GR.helmTint), { snap: 2 * L.SNAP }) }, bodyAt));
      if (backK > 0 && window.ASSETS[pn + 'body_back']) L.sprite(GR.back, 0, 0, Object.assign({ u: Object.assign({}, shade(U, LK.back?.sat ?? BACK_VIEW.bodySat, BACK_VIEW.bodyLift), { alpha: alpha * backK, snap: 2 * L.SNAP }, soft(pn + 'body_back', capeB, GR.helm ? 0 : hairA)) }, bodyAt));
      if (backK > 0 && GR.helm) L.sprite(pn + 'head_back_' + GR.helm, 0, 0, Object.assign({ u: Object.assign({}, shade(tinted(U, GR.helmTint), 1, BACK_VIEW.headLift), { alpha: alpha * backK }) }, bodyAt));
      if (nearArm || orbUp) drawArm('L', Ufar, nearOver ? 'uf' : 'u', orbUp ? '_drape' : '');
      if (castFront) { drawArm('L', backK > 0.5 ? Ufar : U); if (!orbLate) shield(backK > 0.5 ? Ufar : U); if (readE > 0.3) scroll(); }
      if (orbLate && behind) shield(castFront ? U : Ufar);
      // (TASKS 2170) a rig with its near fist cut out (fistR) draws it again over the held weapon: the hilt or haft passes under the
      // fingers and shows above and below the fist in every pose, where the whole arm over the weapon hid the pommel under the wrist
      const Uo = over < 1 ? Object.assign({}, U, { alpha: U.alpha * over }) : U, armOver = () => { if (front > 0) drawArm('R', front < 1 ? Object.assign({}, Uo, { alpha: Uo.alpha * front }) : Uo); };
      if (over > 0) { if (fistOver) { armOver(); weapon(Uo); drawFist(Uo); } else if (grasp) { weapon(Uo); armOver(); } else { armOver(); weapon(Uo); } }
      // (TASKS 2156) and after the near arm: on the run its forward swing passed over the orb for 3 frames of 12
      if (orbLate && !behind) { if (!castFront) drawArm('L', Ufar, 'f'); shield(castFront ? U : Ufar); }
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
      const dT = [g.T[0] - g.A0[0], g.T[1] - g.A0[1]], fk = footK(side); J('heel' + side, R2S(g.A0[0] + (RG['heel' + side][0] - g.A0[0]) * fk + dT[0], RG['heel' + side][1] + dT[1])); J('toe' + side, R2S(g.A0[0] + (RG['toe' + side][0] - g.A0[0]) * fk + dT[0], RG['toe' + side][1] + dT[1])); J('ground' + side, [hx, hy + tg[side].dz * s]);
      const A = arms[side], j2 = side === 'L' ? jL : jR; J('sh' + side, R2U(A.Sp[0], A.Sp[1])); J('elbow' + side, R2U(j2.E[0], j2.E[1])); J('hand' + side, R2U(j2.Hd[0], j2.Hd[1])); }
  }
  SC.drawHero = drawHero;

  Object.assign(SCX, {
    HERO_H, SWING, TAU, wrapPi, swingPose, DEPTH_K, ARC_HALF, ARC_MID, whirlP, HERO, sinkOf, drawHero });
})(typeof window !== 'undefined' ? window : globalThis);
