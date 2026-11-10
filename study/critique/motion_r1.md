# Motion critique, round 1 (hero rig, attacks, states, monsters)

Bar: a clip of a shipped top-down pixel ARPG at 60 fps, frame by frame.
Evidence (all under `study/critique/`):
- `motion_qa/report.json` (my own `qa.mjs --only motion,rig,anim` run). Note: `frames/qa/report.json` currently has **no `rig` key** (cycles `{}`); a later UI-only run overwrote it. Re-run with `rig` before the next critic round.
- `motion_frames/swing_side_x5.png`: demo t=8.90–9.28 at 60 fps, a left-facing swing (aim 175°).
- `motion_frames/swing_down_x5.png`: demo t=10.13–10.42, a left-facing swing aimed straight down.
- `motion_frames/hero_{dash,dash_x6,death,hurt,whirl,idle,cast}.png`: staged states.
- `motion_frames/goblins.png`, `enemy_deaths.png`: monsters walking, striking and dying.
- `motion_frames/cycle_{right,down,up}_x4.png`: walk cycles.
- `motion_frames/probe/`: the probe scripts, the demo event timeline (`tl.txt`), and `probe.json` (the joint trace for 16 attack directions sampled at 1/240 s, plus dash, death, hurt, whirl, idle and cast).

Frame indices are given as "sheet#n" (the label in each tile) or as frames after the attack press (f0 = press, 1/60 s each).

## Scores

| axis | score | reason |
|---|---|---|
| Walk, side views | 7 | Measured: slide 0, limp 0.012, bob 0.051 H, knee max 29°, arms in antiphase (0.06). The feet really plant. |
| Walk, up/down | 3 | Slide is 3.4–3.6 px per frame. The legs only march in place (`move` 0.116 vs 0.321 for side views). Walking up still shows the face, because `hero_back` is in the assets but never drawn and `h.back` is ignored. |
| Limb attachment and layering | 5 | Near and far limbs layer correctly. During the dash the body sprite tilts 0.18 rad but the arms and joint trace do not, so the shoulders sit about 8.5 px off the arms. At impact the blade is hidden behind the target in 2 of 2 demo swings. |
| Weapon swing reading | 3 | The blade points at the target at impact for all 16 directions (error 0°, ≤22 px from the target), which is good. But the swing has no anticipation, linear spacing, no hold and a reverse "second swing" on recovery, and the slash trail sweeps the opposite way for every left-facing swing. |
| Arcs and spacing | 3 | The strike is a constant 13.3°/frame. The arm stays rigid (shoulder–hand distance 23.5 px in every frame, so the elbow never folds). The blade turns in the picture plane at full length even when it points toward or away from the camera. |
| Pops between states | 2 | Hand jumps of 41 px in one frame at the end of every swing, and up to 46 px at the start (0.65 H). The dash lean switches on and off in one frame (head moves 11 px). Death swaps to the whole drawing and the sword disappears. |
| Holds, idle, hurt | 2 | Idle: the head moves 0.00 px and the hands 0.66 px over 3 s. Hurt is a 0.12 s tint with no flinch. Cast holds the sword straight up like a candle. |
| Secondary motion | 1 | None. The cape is painted into `hero__body` and moves rigidly with the torso. Hair is static. |
| Death | 2 | The hero falls like a stiff board about the feet (rotates 83°, no knee buckle, no bounce) with `SS` easing instead of gravity, and the sword vanishes on frame 1. Monsters tip over like cardboard and fade out in 0.9 s. |
| Monsters | 1 | Every type is a whole-sprite transform: a fail on sight per critics.md §4. The legs glide (goblin 1.7 px/frame, skeleton 1.1 px/frame), the strike is a 0.2 rad lean that pops in one frame, and the weapons never move. |
| **Overall** | **3** | The side-view walk is close to shipped quality. Everything that makes combat read (swing, hit, death, monsters) is not. |

## Top fixes, ranked by impact

### 1. Rebuild the swing envelope: anticipation, then strike, then hold, then recover, with no pops

**WHAT:** `live/scene.js` `drawHero`, the `swinging` block (`bladeA`, `back`) and the `armR.r1 = (want - rest) * 0.85 * k` line.

**WHY (measured):**
- **No anticipation, and a pop at the start.** `h.atkT` is set on the press (`sim.js` stepPlay), so `atkU < 0` never happens in play and the `SS(-0.2, 0, atkU)` wind-up is dead code. At f0 the blade jumps from rest (−0.95 rad) straight to `sa − arc/2`, and the hand moves 17–19 px for aims straight up or down. For aims in the upper-left quadrant (−180° to −112°) it moves **44–47 px**: `sa = π − h.atkA` is not wrapped, so `sa` exceeds π, the angle interpolation runs the long way, and `r1` (which is not periodic, because of the ×0.85) leaves the arm in a different pose. This is the "end-angle wrap" lesson from animation.md §11. On screen: swing_side_x5 #1→#2 and swing_down_x5 #1→#2.
- **Linear strike.** The blade turns 13.3° every frame through 120°, with no ease or smear.
- **Reverse second swing.** From `atkU` 1 to 1.9, `bladeA*back + (−0.95)(1−back)` sweeps the blade back through the target at almost strike speed (114° in 0.135 s). It reads as a second attack (swing_side_x5 #16–#19, swing_down_x5 #12–#17: the blade passes back over the head).
- **End pop.** At `atkU` = 1.9 `swinging` turns false, so `armR.r1` falls from about −2.1 rad (arm raised) to the walk swing. **The hand jumps 41.4 px and the tip 41.4 px in one frame, for every aim** (probe f17→f18; swing_side_x5 #19→#20).

**CHANGE:**
- In `sim.js` stepPlay, give the attack a real anticipation: either delay the damage (wind-up 0.06 s, damage at 0.06 + 0.05 s), or keep the damage frame where it is and start the visual from the press with a fast pull-back:

  | phase | time after press | blade and arm |
  |---|---|---|
  | anticipation | 0–0.05 s | blade pulled back 25–35° behind `sa − arc/2`, elbow up and back, torso turned away by a small `bodyRot` |
  | strike | 0.05–0.11 s | ease-in (`u²` or cubic-in) through the arc, the impact at about 70% of it |
  | hold | 0.11–0.17 s | blade at `sa + arc/2`, with a 1–2 px overshoot and settle |
  | recover | 0.17–0.40 s | ease-out back to rest **along the shortest way that does not go back through the arc** (continue forward past the follow-through, or lower the blade downward). Blend the arm from the end pose back to the live swing pose (`k` falls 1→0 with `SS`), never through a boolean |

- Wrap every angle: `sa = wrapNear(π − h.atkA, rest)`, and interpolate with `wrap(b − a)`.
- Bend the elbow: the strike leads with the elbow (`r2 = r1 + bend`, with `bend` going 1.2 → 0.2 → 0.4 rad across the phases).
- Interrupting an attack (a new swing while one is recovering) must start from the current blade angle (store `h.bladeA` from the last draw, or compute the previous phase pose and blend from it), not from rest.

### 2. Make the impact visible: blade layering and slash direction

**WHAT:** `live/scene.js`. The Y-sorted band (hero and enemies sorted by y), the event FX for `e.k === 'swing'` (the `L.P.arc` draw), and `weapon()`.

**WHY:**
- **The blade hides behind the target at impact.** The target is at equal or larger y, so it is drawn after the hero. In swing_side_x5 #3–#9 (strike and impact) and swing_down_x5 #6 (impact) the blade cannot be seen. The most important frame of the attack is the one frame you can't see.
- **The trail runs backwards for left-facing swings.** The FX sweeps `e0 = e.a − arc/2 → e0 + arc` in screen angle (counter-clockwise), but for `face = −1` the blade's screen angle is `π − bladeA`, which sweeps clockwise. In swing_side_x5 #4–#5 the trail starts at the feet (bottom-left) while the blade comes down from above. In swing_down_x5 #2–#5 the trail starts on the right while the blade is on the left. Every left-facing swing in the demo has this (8 of the 14 demo swings face left, per `probe/tl.txt`).
- The trail is centred on the chest (`ey − 30`), not on the shoulder or hand that the blade turns about, so its radius doesn't follow the blade tip.

**CHANGE:**
- Draw the hero's weapon and the slash trail in a pass **after** the Y-sorted band while `atkU` is in [0, 1.2] (or give the hero's band key `+1000` during the strike). Keep the near arm with it so the hand stays on the grip.
- Drive the trail from the blade itself. Emit it from `weapon()` each frame (a ribbon of the last 4–6 tip positions), or pass `face` into the arc and use `e0 = face > 0 ? a − arc/2 : a + arc/2` with the sign of the sweep flipped. Centre it on `R2S(shoulderR)`.

### 3. Directional hero: back view up, real foot paths down and up

**WHAT:** `drawHero`, the foot targets: `ty: A0[1] + off * P.diry * 0.25 - lift`. Also `h.back` (set in sim.js but never read) and the unused `art/gen/hero_back.png`.

**WHY:**
- **The slide is not a 3/4-view limitation; it is the 0.25 factor.** The camera maps world y to screen y 1:1 (`sy = y − cy`), so a planted foot must move up the screen at the full body speed. With 0.25 it covers a quarter of that and slides the other 75%: measured 3.56 px (down) and 3.38 px (up) per frame, against a 1.5 px tolerance.
- Walking up shows the face and chest (cycle_up_x4, all 12 frames).
- The legs sweep only in the side plane, so up and down travel is a march in place (`move` 0.116).

**CHANGE:**
- **Foot path.** Use `ty = A0[1] + off * P.diry − lift` (full screen y). Let the leg stretch on screen when the foot is closer to the camera and shorten the shin (`k2 < 1`) when it is farther, instead of dropping the hip. That is §15.1, "the extra a leg leaning toward the camera really shows". Cap the hip drop at the walk-bob value.
- **Views.** Cut `hero_back` into the same 11 parts (`rigcut.py`, the same pivots) and pick the view from `h.back`, keeping the front view for down and the side views. Snap the view when it changes, with a 2-frame squash. When the back view is shown, draw the weapon before the body (§15.3).
- In the front and back views the legs lift in turn (raise and shorten the swing leg), as §12 asks.

### 4. Rig the monsters (currently whole-sprite transforms in `drawEnemy`)

**WHAT:** `live/scene.js` `drawEnemy`, which draws every type with `sx`/`sy` squash and a lean.

**WHY (measured):**
- **Foot slide = full walk speed:** goblin 104 px/s (1.7 px/frame), spider 1.5, skeleton 1.1.
- **The idle is a 3% sine squash.**
- **The strike pops.** The lean goes from −0.08 at the end of the wind-up to +0.12 on the strike frame. That moves the top of the sprite 12 px in one frame for a skeleton (H = 60) and 23 px for an elite brute, then it snaps back at the end of the strike.
- **Weapons never move.** The skeleton's sword and the goblin's dagger are painted in, so the enemy wind-up is unreadable and only the red `eswing` arc says "attack".
- **Deaths.** The sprite rotates 1.3 rad about the feet and fades out by 0.9 s (enemy_deaths #14–#22).

**CHANGE.** Parts to generate or cut, in priority order (most on screen first):

| priority | enemy | parts | motion |
|---|---|---|---|
| 1 | skeleton | body; head (separate, for the death); near and far upper arm and forearm; sword (separate item); shield (on the far arm); thigh/shin/foot ×2 | Reuse the hero leg code: foot paths and IK. Wind-up: the sword arm lifts and the elbow goes back (0.42 s, a slow pull with a 2-frame hold). Strike: overhead chop with an ease-in. Death: **collapse**, where the head drops and bounces, the limbs scatter 4–10 px, the pieces stay as a bone pile for 6 s, then fade. |
| 2 | goblin | body; head and ears (the ears on a spring); dagger arm in 2 bones; free arm; legs ×2 (crouched hips) | A fast, low, hunched run. Wind-up: a crouch (squash on the hip pivot plus the arm cocked back). Strike: a stab lunge. |
| 3 | spider | body (abdomen and cephalothorax); 8 legs in 2 segments each | Tripod gait (§5) with the stance sweeping **backward**. Before the lunge it rears up, front legs raised. The lunge is the body thrust with the legs trailing. Death: legs curl in and it flips onto its back. |
| 4 | brute / boss | Same skeleton layout as the hero (big arms in 2 bones); a separate jaw | A slam: arms up and a hold of 0.25 s, then the slam with a body squash and the `slam` event on the impact pose. A heavy walk with a body roll. |
| 5 | cultist | Robe body (soft-bone skirt sway, §15.6); staff arm; free arm | Cast: the staff rises, and the free hand pushes toward the aim on the shot frame (the projectile spawns at the hand). Walk: the robe sways, feet just visible. |
| 6 | ghost | One sprite is acceptable **if** it is soft-boned (§15.6): the tail drifts on a travelling wave, and the arms reach on the wind-up | Bob on a spring, not a sine. Death: dissolves upward. |

- Report each enemy's joints with `L.joint`, add every type to `SCENE.QA().actors`, and give each a walk cycle and an idle loop.
- Until the rigs exist, at least remove the one-frame lean switch: `lean` should be a damped spring toward its target.

### 5. Death and hurt: no swap pops, real weight

**WHAT:** `drawHero`: the `if (P.dead > 0)` branch that swaps to the whole `hero` sprite, and `hurt` (tint only). `drawEnemy`: the death branch.

**WHY:**
- **Death swap.** Frame 1 of the death drops the rig for the whole drawing. The sword vanishes and the limbs snap to the painted pose (hero_death #0→#1). After that the whole sprite rotates 1.45 rad about the foot pivot with smoothstep easing: a stiff board, no knees, no impact.
- **Hurt.** The hurt state is 0.12 s of white with the pose unchanged (hero_hurt #0–#6; the demo frames at t=10.00 show the arm still raised in the reverse swing during the hurt).

**CHANGE:**
- **Hero death, keeping the rig:**

  | phase | time | pose |
  |---|---|---|
  | buckle | 0–0.12 s | knees fold to 60–70° (raise the IK targets), the torso pitches back, the arm flings |
  | fall | 0.12–0.40 s | gravity, `t²` |
  | land and bounce | about 0.40 s | one bounce of 3 px, settling over 0.15 s |

  The sword is released: it becomes a sim drop that keeps falling, spinning, and lands beside the hero.
- **Hero hurt (0.18 s):** the body tilts away from the hit (`bodyRot` 0.15 rad, damped), the head rides back 2 px, the arms flinch out, and a 1-frame squash. Interrupt and ease out of the swing pose instead of holding it.
- **Enemies:** see the death column in fix 4. Corpses (or bones) stay for several seconds before fading. A shipped ARPG never lets a body fade out in under a second.

### 6. Dash: the tilt detaches the arms, the legs freeze, and the lean pops

**WHAT:** `drawHero`: `dashLean` is applied to `hero__body` only (`M.r(dashLean)`). In `sim.js`, `h.gp` does not advance while `dashing`.

**WHY:**
- Arms, legs, weapon and the joint trace are all drawn without the rotation. The shoulders end up about 47 px × sin(0.18) ≈ 8.5 px from where the arms are attached, and the head about 11 px.
- The lean is binary: 0.18 rad for 0.18 s, then 0 in one frame (hero_dash_x6 #5→#6).
- The legs hold one frame of the walk while the hero covers about 100 px.
- The joint trace reports the unrotated head and shoulders (`probe.json` dash: `shR` is constant), so qa.mjs cannot see the problem.

**CHANGE:**
- Rotate the whole rig. Wrap `R2S` in the lean, about the hip so the feet stay on the ground: `R2S' = rotate(R2S(...), hip, lean)`.
- Ease the lean: `lean = 0.25 · SS(0, 0.04, a) · (1 − SS(0.12, 0.26, a))`.
- Pose the dash: the front leg reaches, the back leg trails with the knee bent, both arms swing back. Or freeze the gait and use a dedicated pose table.

### 7. Secondary motion and idle life

**WHAT:** `hero__body` (cape and hair painted in). The idle `breath` is `0.45 px` and is clamped away by `max(bodyDy / s, drop)`.

**WHY:** The idle is completely still (head 0.00 px over 3 s). There is no cape or hair lag in any state, which is the first thing a viewer notices in a shipped ARPG with a caped hero.

**CHANGE:**
- **Cape.** Cut the cape from `hero__body` into `hero__cape`, with its pivot at the shoulders. Drive it with a damped spring in the sim (`k` about 60, damping about 0.75) whose target comes from −velocity, the dash, the attack's body turn and the hurt. Add a sway-3 travelling wave whose amplitude scales with speed. Draw it before the body in the front view and after it in the back view.
- **Hair.** A 2–3 px spring on a `hero__hair` tuft.
- **Idle.** Breathing at 1.5 px with shoulder lift, applied after the drop clamp (not through `max`). A weight shift every 3–5 s (§15.4). An occasional blade turn, or tip tap on the floor.

### 8. Whirlwind is a windmill in the picture plane

**WHAT:** `whirlU`: `bladeA = aimL + whirlU · 2π`, with the arm rotating about the shoulder in 2D (hero_whirl #2–#21).

**WHY:**
- The arm goes straight over the head (#15–#19) and across the chest (#9–#11) while the body stays in the side view.
- It pops in from rest at #1→#2 and back to rest at #20→#21.

**CHANGE:**
- Spin the body: cycle the views side → back → side mirrored → front over 0.32 s (or flip `face` at 25% and 75%).
- Hold the blade horizontally at waist height and sweep its tip on a ground ellipse: `x = cos θ · R`, `y = sin θ · R · 0.5`. Draw it in front of the body when `sin θ > 0` and behind when `< 0`.
- Ease in over 0.05 s from the current pose and ease out into a follow-through crouch.

## New automatic checks (defects the numbers missed)

1. **Attack transitions as pops.** Add `transitions.attack_<dir>` for 16 directions: frames 1/60 s apart from 2 frames before the press to 3 frames after the recovery ends. The existing `pop` check would have caught the 41 px end pop and the 46 px start pop. Today `SCENE.QA()` has no `attacks` and no `transitions`, so the aim and pop checks never run on the swing.
2. **Trail direction.** Per attack, the sign of the blade's angular velocity (grip→tip) must equal the sign of the slash FX's angular velocity. The FX should report `L.joint(id, 'trail', p)` at its leading end. Fail on a mismatch.
3. **Impact visibility.** At the impact frame, render the scene twice, with and without the hero's weapon. At least 50% of the blade's pixels must differ in the final composite (or: the weapon's draw index is greater than the target's). Fails today for any target at equal or greater y.
4. **Trace honesty.** Each joint must be computed from the same matrix that draws its part. Check: the body sprite's transformed shoulder anchor (`hero__body` matrix × rig `shR`) is within 1.5 px of the traced `shR`. Fails during the dash (8.5 px).
5. **View check.** For each cycle, the view drawn (`front`/`back`/`side`, reported via `L.joint(id, 'view:back', …)` or a trace field) must match the travel direction. `hero_up` must draw the back view.
6. **Idle loop.** Add `loops.hero_idle` (3 s). The existing "nothing moves" check would fail it today (head 0.00 px). Require head motion of at least 0.015 H and a hand motion.
7. **Coverage.** `actors` must list every enemy type (skeleton, goblin, spider, cultist, ghost, brute, boss), so a missing cycle or loop fails `coverage`, and the `rigid` check runs on them. Today `actors: ['hero']` hides all of them.
8. **State-swap continuity.** In `transitions.hero_death` and `enemy_<type>_death`, a joint that exists on frame k must exist on frame k+1 (the sword `tip` disappears) and must not jump more than the pop limit.
9. **Weapon depth foreshortening.** In attacks aimed toward or away from the camera (aim ±90°), the on-screen blade length should shrink to about 0.6–0.8× the side length. Report |tip − grip| per frame and fail when it is constant across all aims.
10. **Cycle sheet centring.** `qa.mjs` cycle sheets drift because the cycle states move the hero without moving `R.cam` (cycle_up_x4: the hero leaves the tile). Have `cyc()` set `R.cam` to follow, or crop the sheet on the `ground` joint.

## Rules broken

- **critics.md §4, fail on sight:** every monster is animated only by whole-sprite transforms.
- **animation.md §11:**
  - the end-angle wrap (`sa = π − atkA` is unwrapped for aims in the upper-left quadrant);
  - "only the player was animated";
  - "popping deaths".
- **§12:**
  - "Blend pose switches … a one-frame snap reads as a glitch" (attack end, dash lean, death swap);
  - "Swaps between different drawings need a transition" (the death swap);
  - front/back views: "legs lift in turn".
- **§13:** every actor (enemies) needs idle, walk, attack, hit and death rigs; the player's hit and death are missing.
- **§9:** views. A back anchor exists but is unused.
- **§6:** no secondary motion (cape, hair, body follow-through).
- **§15.2, §15.3:**
  - the arms rotate in 2D (an arm over the head and across the chest in the whirl);
  - the elbow never bends (shoulder–hand distance constant at 23.5 px);
  - the blade is not projected (full length toward the camera);
  - facing away, the weapon does not go behind the body.
- **§15.1:** the up/down feet use a 0.25 screen-y factor, so they skate.
- **§14:** `SCENE.QA()` lacks `attacks`, `transitions`, `loops`, and `actors` beyond the hero; `rest` is not drawn `neutral`. The trace does not follow the dash lean.

## Minor

- The cast pose (hero_cast #4–#10) holds the sword straight up beside the head (`ba = −0.95 + r1·0.5`, with the arm forward). Point the blade along the forearm or lower it, and add an off-hand cast gesture.
- Facing flips mirror the whole rig in one frame, so the cape jumps sides (swing_down_x5 #1→#2). Add a 2-frame squash, or a 1-frame turn pose.
- `drawEnemy` walk bob `|sin(dist/20·π)|` gives a 5.2 Hz bounce for goblins, too fast for a 46 px creature. That goes away with the rig.
- The enemy hit flash (0.1 s white) has no recoil pose. Add a 2-frame lean away from the hit (spring) once rigged.
- The hero's arm-swing amplitude while walking (0.34 rad) is the same with the sword in hand. §15.2: the weapon arm swings less.
- The leftover `deadM` is dead code. The `atkU < 0` branch is unreachable in play (see fix 1).
