# Game critic: round 1

Subject: "Глубины Крипты", the browser roguelite dungeon crawler (live/).
Evidence:
- livecheck session `frames/livecheck/c1/*` (1920 view: start, move, attack, locked fireball, whirl, dash, hero screen)
- attract stills `study/critique/game_frames/t{2,6.6,6.8,6.9,8,8.2,8.3,8.4,8.7,9.6,14,20}.png`
- QA screens `frames/qa/*`
- 5 bot playtests (`tools/playtest.cjs 1 2 3 7 42`)
- Node probes against sim.js and dungeon.js: save/reload, 1600 generated floors, a caster against the sanctuary

## 1. Scores

| Axis | Score | Reason |
|---|---|---|
| Readability | 4 | The world is drawn at 1x on a 1920x1080 view. The hero is about 65 px tall (6% of screen height) and a 13x9 start room fills about 20% of the frame. The rest is black fog. A 16 px dark stripe crosses the floor every 5.5 tiles (bug B2). |
| Game-feel | 5 | The verbs are right: hold-to-attack, dash with i-frames, 3 abilities, potions. Hit-stop (0.035/0.06/0.07 s), trauma shake and knockback are in. But there is **no sound at all** (audio.js is a stub). Hurt, death, spikes, enemy projectile impact, teleport and floor arrival have no world FX. The whirl FX is a flat white streak. |
| Aliveness | 4 | Torches flicker and idle monsters flip their facing. There are no critters, ambient motes or dust, and no prop reacts to the hero. 8 of the 13 decor kinds are inert (see the audit). |
| Depth / camera | 5 | Spring camera with 12% cursor look-ahead and trauma shake. It is flat top-down with no foreground layer. Because of the zoom, the camera mostly frames black fog. |
| Lighting | 6 | Warm torch, brazier and bonfire pools, plus per-biome ambient and torch colours. Fireball, whirl and level-up add light. Dark seam stripes and 96 px brightness blocks on the floor make the light look tiled. |
| Style consistency | 6 | The HD-pixel props and the rigged hero match. Tables are smaller than chests (crop c1_strip). Wall-row props (statue, rack) stand on the wall top. The HUD uses a clean sans that reads well but is generic. |
| Motion | 6 | The hero rig articulates (legs plant, the sword arm follows the aim). Enemies are mostly translate plus flip. Wind-ups are readable (`wind` 0.3–0.8 s). |
| Progression / loot | 4 | A dumb bot with **zero meta upgrades wins 4 of 5 seeds** in 15–18 min, with min HP 19–26%. About 6,000 gold piles up with no sink. All 3 abilities unlock by level 4 and reach max rank around level 13 (floor 5), so floors 6–8 add nothing new. |
| UX / UI clarity | 6 | Clean HUD, context prompts ("E или удар — открыть сундук"), tooltips, locked-skill toast. Problems: the pause screen's floor toast overlaps "Пауза", a worst-case toast renders as an empty bar (qa/play_worst), and the blessing has no buff icon. "New campaign" silently overwrites the saved run. |
| **Overall** | **5** | A screenshot of a lit room passes as an indie WIP. A clip does not: tiny actors in a black frame, silence, floor stripes, and props that ignore the sword. |

## 2. Top fixes, ranked by player impact

### F1 (critical bug): loading a save leaves the hero unable to attack for minutes
- **WHAT:** `sim.js: spawn()` builds a fresh state with `S.t = 0`. The saved run stores absolute sim times: `hero.cd.*`, `ifr`, `atkT`, `deadT`, `shieldUntil`, `e.cdT`, `drop.t0`, `R.saveT`, `msg.t`.
- **WHY (measured):** I played 200 s, reloaded (beforeunload persist, then Continue) and held LMB for 5 s: **0 swings**. `cd.atk = 200.2` against `t = 5`.
  - Whirl, fireball and shield stay locked the same way.
  - Drops that were on the ground can't be picked up (`R.t - p.t0 < 0.45`).
  - Autosave stops (`t - R.saveT > 30`).
  - If the tab closes during the 1.6 s death animation, the reloaded hero lies dead until `t` catches up with the old `deadT`.
- **CHANGE:** in `spawn()`, after `S.saved = persist.run`, add `S.t = Math.max(S.t, persist.run.t || 0) + DT;`. The sim clock then resumes where the run left off, and every stored absolute time stays valid. Pair it with a test in `selfCheck`/tune: play, persist, spawn, Continue, then assert that `hero.atkN` increases within 1 s.

### F2: floor texture stripes on every floor
- **WHAT:** `scene.js: bake()` uses `TS = 176` and `TSW = 224` world px per texture period, with `SC.REPEAT = []` (clamp-to-edge). 176 is not a multiple of TILE (32). Every tile with `(x*32) % 176 = 160` samples u from 0.91 to 1.09, so its last 16 px smear the texture's edge row.
- **WHY:** In `c1/play_2.30.png` rows 466–484 drop from luminance ~130 to 22–60 across the whole room (a 60% drop). The same stripe runs vertically at x≈795 in the crop. It repeats every 5.5 tiles in both axes on every biome and reads as a broken tileset.
- **CHANGE:** set `SC.REPEAT = ['floor_d_tex','floor_c_tex','floor_l_tex','floor_a_tex','wall_d_tex','walltop_d_tex','lava_tex']`, or set `TS = 192` and `TSW = 256` (multiples of 32). Also soften the 3x3-tile block darkening (`-0.1*SS(..., rnd(floor(x/3), ...))`) to 0.05 with a smooth falloff, so the light stops looking tiled.

### F3: zoom the world in about 1.75x
- **WHAT:** `TILE = 32` view px at 1920x1080 (`data.js`), and `scene.js` draws world px 1:1.
- **WHY:** The hero is 65 px (6% of frame height); shipped top-down crawlers sit around 10–14%. 70–80% of every gameplay frame is black fog (c1 2.3 s, attract t8). Swing arcs (a 128 px quad), hit sparks and enemies are too small to read at a glance.
- **CHANGE:** add `ZOOM = 1.75` to the sim.
  - `camera()`/`clampCam()` use `VIEW.W/ZOOM` and `VIEW.H/ZOOM`.
  - The aim becomes `mx = R.cam[0] + inp.px/ZOOM`.
  - In `scene.js: render()`, scale `sx`/`sy` by ZOOM, give the map sprite src the world rect `W/ZOOM × H/ZOOM`, and multiply the sizes passed to `drawProp`, `drawHero` and `drawEnemy` by ZOOM. One alternative: render the comp/light targets at `W/ZOOM` and upscale in `L.finish`, which is cheaper and keeps the pixel look.
  - HUD world overlays (`V.sx`/`V.sy` in hud.js) go through the same transform.

### F4: interaction audit. Make every touchable object answer
- **WHAT:** `dungeon.js` decor and props, `sim.js: breakPots/hitChests/solids`. See the table in section 3.
- **WHY:** About 6.4 tables per floor (10,307 in 1,600 floors) can be walked through. Coffins, graves, crystals, racks, cages, bookshelves, statues and pillars are solid but ignore swords, whirl and fireballs. Lava-biome "altar" decor uses **the same sprite as the shrine** and looks like a used shrine. Spikes hurt only the hero. Lava is only a wall.
- **CHANGE:**
  1. `dungeon.js`: emit `table` as a pot-like breakable (`pots.push({kind:'table', hp:2})`). Move crate/barrel-like props (rack, cage, bookshelf) into `R.pots` with `hp` 2–3. In `breakPots`, handle `hp > 1` with a `shake` event (sprite x-jitter 3 px for 0.15 s, plus dust and splinters).
  2. For non-breakable solids (statue, pillar, grave, coffin, crystal, brazier), add `hitProps(S,R,x,y,rad,ax,arc)` after `breakPots` in the melee, whirl and boom paths. It emits `{k:'clang', x, y}`: sparks, a 2 px sprite shove that springs back, and a crystal light pulse. Then nothing reads as fake-breakable.
  3. Remove `'altar'` from `BIOMES.lava.props` (or give it a distinct sprite).
  4. In `stepMonsters`, run the spike test for each enemy (same phase test as the hero, `hitEnemy(..., 'spike')`) so luring is a tactic.
  5. Make lava a hazard: let knockback push enemies onto cells of type 3 and burn them (`e.burn`), or give the hero a 1-tile burn when dashing across.

### F5: the "safe room" isn't safe
- **WHAT:** `sim.js: stepMonsters` casters fire whenever `d < 360 && los`. Only melee is gated by `!inSanct`. `stepProjectiles` doesn't care about the sanctuary either.
- **WHY (measured):** a cultist one tile outside the start room fired 4 hexes in 10 s and **hit the hero 3 times inside the sanctuary**. The 8%/s sanctuary regen masks the damage, but the numbers and hurt flash still show, which breaks the promise "spawns in a safe room".
- **CHANGE:** in the caster branch, use `if (d < 360 && los && t >= e.cdT && !inSanct)` (else `want = 1` to circle). In `stepProjectiles`, add `if (p.own === 'en' && inStart(m, floor(p.x/TILE), floor((p.y+20)/TILE))) { p.dead = 1; ev(S, {k:'pop', ...}); }` so the bonfire visibly "burns" incoming shots.

### F6: sound plus FX for the silent events
- **WHAT:** `audio.js` is a stub. These events are emitted with no world response:
  - scene.js handles none of `hurt`, `die`, `spike`, `pop`, `roar`, `teleport`, `floor`, `equip`, `stairs`;
  - hud.js handles only `hurt` (a number), `alert`, `absorb`, `unlock`, `nope`.
- **WHY:** gamefeel §4: every event needs instant/short/long layers. Hurt today is a 0.12 s tint. Death is a fall with no beat. Enemy shots vanish without an impact.
- **CHANGE:**
  - **Audio:** a WebAudio sample bank keyed by `e.k` (swing, hit, crit, kill, hurt, dash, cast, boom, chest, gold, pickup, lvl, spike, stairs, die), each with ±8% pitch jitter, plus a low biome ambience loop.
  - **scene.js:**
    - `hurt`: red screen-edge vignette 0.25 s, plus a blood puff on the floor.
    - `die`: 0.4 s time-scale 0.3 (sim: `R.freeze`-like slow), desaturate the lit composite, a soul burst rising.
    - `spike`: sparks plus dust at the plate.
    - `pop`: a coloured burst and a light flash at the impact.
    - `teleport` and `floor`: a column of light and a camera fade-in.
    - `roar`: a shock ring plus `trauma 0.6`.
  - **hud.js:** a buff icon with a timer for `h.bless` and the shield.

### F7: balance and progression (numbers vs the playtest)
- **WHAT:** `data.js` (ENEMIES, META, ABILITIES) and `sim.js` (`enterFloor` scaling, sanctuary regen, `gainXp` full heal, gold).
- **WHY (measured, 5 seeds, no meta):**

  | seed | result | time | final level | min HP | gold |
  |---|---|---|---|---|---|
  | 1 | win | 1013 s | 18 | 19% | 6604 |
  | 2 | win | 1061 s | 18 | 25% | 6140 |
  | 3 | win | 907 s | 18 | 25% | 6475 |
  | 7 | win | 997 s | 18 | 26% | 5736 |
  | 42 | dead, floor 3 | 221 s | 6 | n/a | n/a |

  - Floors take 60–215 s and about 60 kills each.
  - A win pays about 230 shards against 855 for every meta rank, so the first win buys a quarter of the meta tree, and meta isn't needed to win.
  - Gold has no use except `goldTot/80` shards at the end.
  - A full heal on every level-up (17 times per run) plus 8%/s sanctuary regen makes potions nearly irrelevant.
- **CHANGE:**
  - `enterFloor`: set `dc = 1.35*(1+0.38*(f-1))` and `sc = 1+0.6*(f-1)`, and the boss `hp` to 700.
  - `gainXp`: heal 35% instead of to full.
  - Sanctuary regen: `0.08` to `0.03`, and only while no enemy is in `chase`.
  - Gold sink: a merchant room type in `dungeon.js` (like the shrine, `type:'shop'`) selling potions and rerolls. Or let the shrine take gold for a blessing tier.
  - Spread the verbs: add a 4th and 5th ability (e.g. `unlock: 6` and `unlock: 9`), or cap ability rank at `1 + floor(floor/2)`.
  - Re-run playtest.cjs: target a 30–50% bot win rate with no meta and 70%+ with half the meta bought.

### F8: whirl and swing FX read as primitives
- **WHAT:** `scene.js` event FX for `whirl` (c1/play_3.10: a flat white streak at foot level with a hard rectangular end, bleeding into the wall) and `swing` (a 128 px quad, 0.18 s).
- **WHY:** polish checklist item 11 (no primitive-shape effects), and the attack is the verb the player uses most.
- **CHANGE:**
  - Draw the whirl as two `L.P.arc` passes at waist height (`ey - 30`): `u_arc = [a0, a0 + 2π·SS(0, 0.25, age)]`, radius 92 (the sim radius), a 0.22 → 0.06 thickness taper, warm-white core plus a tinted outer layer. Add a floor dust ring (`L.puff` ×8 around the circle) and hide it behind walls with the same `known()` test.
  - Scale the swing quad with weapon `reach` (`2*(reach+20)`), add a 2-frame afterimage of the blade tip, and add impact sparks at the enemy's contact point on `hit`.

## 3. Interaction audit (gamefeel §7)

| Object | Touch / walk into | Sword / whirl / fireball | Verdict |
|---|---|---|---|
| Chest | Solid, E opens | Opens | OK |
| Pot / barrel / crate | Solid | Breaks, drops gold or potions | OK. Not breakable with E or by walking into it (fine) |
| Table (~6 per floor) | **Walk straight through it** | Nothing | Inconsistent: furniture with no body. Make it a breakable |
| Bones, candles | Walk over | Nothing | OK as decoration (candles emit light) |
| Banner | Wall decor | Nothing | OK. Could sway on whirl or fireball |
| Rack, cage, bookshelf | Solid | **Nothing** | Look breakable, aren't |
| Statue, pillar | Solid | Nothing, no feedback | Needs a clang/spark reaction |
| Coffin, grave | Solid | Nothing | A crypt staple: should crack or open (loot or a skeleton ambush) |
| Crystal | Solid, emits light | Nothing | Should ring and pulse its light |
| Altar (lava decor) | Solid | Nothing | **Same sprite as the shrine.** Looks like a used shrine |
| Shrine | E: full heal, +20% dmg | n/a | OK. Needs a HUD buff icon |
| Brazier / bonfire | Solid | Nothing | Should flare, throw sparks, wobble |
| Wall torch | n/a | Nothing | OK |
| Stairs | E descends, +floor shards | n/a | OK. No transition FX |
| Spike trap | Hurts hero 9×(1+0.2(f−1)) with 0.7 s lockout | **Monsters immune** | No `spike` FX. Should hurt enemies |
| Lava | Blocks like a wall | Fireballs fly over | Hazard with no hazard |
| Monsters vs props | Walk through chests, props, braziers and shrines when chasing in a straight line (`move()` checks the grid only) | n/a | Clipping |

Checklist:
- [x] The camera travels.
- [~] Juice is layered for swing, hit and kill only; no sound.
- [ ] Touched things answer physically.
- [~] Monsters notice the hero ("!" alert, room aggro) but never settle back.
- [n/a] Shared force.
- [x] No visible exact loops.
- [~] Goals read: the minimap marks treasure and exit, but loot has no trail.
- [~] Attract demo: the first 7 s are an empty corridor walk, and the fireball at 6.52 s hits a wall before any enemy is seen.

## 4. Bugs with repro

- **B1, timers after reload (critical):** see F1. Repro: `scratchpad/reload.cjs` logic. In the browser: play about 3 min, reload the tab, click "Продолжить забег", hold LMB. Nothing happens for about 3 min.
- **B2, floor stripes:** see F2. Visible in every floor screenshot (`c1/play_2.30.png` y 466–484).
- **B3, sanctuary breached by casters:** see F5.
- **B4, hero spawns overlapping a solid:** 26 of 1,600 generated floors (1.6%). `dungeon.js` reserves only the 3x3 cells around `start.cx/cy`, but the spawn is at `cy+2` (c1/play_1.50 shows the hero inside the chest sprite). Fix: `used.add(key(start.cx, start.cy+2))` plus its neighbours before placing contents.
- **B5, monsters clip through solid props:** enemy `move()` ignores `solids()`. Push enemies out of `solids(R)` in `stepMonsters` the way the hero is pushed.
- **B6, pause screen:** the floor-name toast (`R.msg`) is still drawn over "Пауза" (qa/pause.png). Hide `R.msg` when `S.screen !== 'play'`. The world behind the pause dim renders almost black.
- **B7, worst-case toast:** `qa/play_worst.png` shows an empty 540 px toast bar. Text that exceeds the width is dropped instead of being shrunk or wrapped (`hud.js` msg box, lines 112–113).
- **B8, new campaign overwrites the save:** `startCampaign` sets `S.saved = null` with no confirmation when a saved run exists.
- **B9:** Enter on the menu continues a run without setting `R.msg` (the click path does). Cosmetic.

## 5. Minor issues

- The hero screen hides the world under full black. A 0.6 dim of the frozen frame would keep context.
- The hero screen layout leaves a large empty block under the equipment column (x 560–840, y 520–900).
- The equipment slots show text labels ("Шлем", "Кольцо") rather than silhouettes.
- Tables are drawn smaller than chests and about 40% of the hero's height (scale mismatch).
- Wall-row props (statue at attract t14 top-left) sit on top of the wall cap instead of in front of the wall face.
- The floor banner stays up 3.5 s over the play area on arrival. Shorten it to 2.2 s and move it higher.
- Idle monsters only flip their facing on `sin` thresholds. Give them a breathing bob, a look-around, and a return-to-post after losing the hero (no "settle back").
- The sanctuary has no ground marker (rune circle or rug), so the safe zone boundary (room plus 1 tile) isn't readable.
- Gold count is the HUD's 5th stat row, but gold has no use (see F7).
- Lava `ENEMIES.cultist` shots become `fire` projectiles but deal the same damage as hex, with no burn.
- The endless-mode button is shown disabled with "(WIP)": acceptable per the brief.
