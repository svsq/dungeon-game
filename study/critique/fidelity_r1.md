# Fidelity + frame critique, round 1: `ref.png` vs `frames/qa/match.png`

Evidence is in `study/critique/fidelity_r1/`: `side_full.png`, `lowfreq_full.png`, `report.json`, `fight_room.png`, `fight_close.png`, `pair_*.png` (same-scale pairs), `ours_fight_3x.png`, `ours_slash_4x.png`, `edge_floor_2x.png`, `asset_sheet.png` and `stats.json`.
The scripts are in `study/critique/measure/`: `pair.py` (same-scale pair), `stats.py` (CIELAB percentiles and named colours) and `radial.py` (light falloff).

**Scale used:** k = 1.25 ours px per ref px, which is the width match (1536 to 1920).
- Ref floor slabs are 27 ref px, so 34 ours px. Ours TILE is 32, so the world grid agrees at this k.
- The ref play area is y 0–750. The presentation sheet below it is excluded. HUD, minimap, floor banner and key hint are masked out of the frame statistics on both sides.

**Correction to the brief:**
- **Ref hero height.** Measured hair top to boot sole on `ref_hero_6x.png` and `pair_hero.png`, it is **72 ref px** (y 398.6 → 470.8), not 55. That is **90 ours px at k = 1.25** and 76 px if the frame is matched on height (k = 1.055). Ours is 66 px.
- **Ref hero in tiles:** 2.67 slabs. Ours: 2.06 TILE.

**Tolerances used:**

| Measure | Tolerance |
|---|---|
| L* percentiles | ±4 L |
| Low-frequency ratio | ±0.3 stop |
| Sizes and positions | ±10% / ±3% of frame |
| Hue | ±10° |
| Chroma | ±25% |
| Counts | ±25% |

---

## 1. Scores (10 = indistinguishable at a glance)

| Axis | Score | One-line reason (ours vs ref) |
|---|---|---|
| Camera and scale | 5 | The grid matches: slab 34 vs TILE 32. Actors are 27% small: hero 66 vs 90 px, goblin 46 vs 76, skeleton 60 vs ~85, brute 100 vs ~125. |
| Layout | 4 | Hero, HUD and minimap sit where the ref has them. **76% of the play frame is black vs 30%**. No neighbouring rooms or biome zones around the fight. A floor banner sits over the top centre. |
| Values | 2 | Frame L* p50 **0.3 vs 13.3**, p75 **4.3 vs 28.3**. The fight room p50 is **54 vs 21**. Outside the pool ours is black. Inside, everything clips to one flat L 55–70 plateau. |
| Palette | 3 | 93.5% of our pixels are within dE10 of the ref palette, but only because they are black. Blue ramp **0.2% vs 13.2%**, green and cyan **0% vs 4.7%**. Stone is warm orange (hue 54, C 29) instead of cool slate (#252534, hue 293, C 11). |
| Light | 2 | One overdriven pool with a cliff edge instead of many small warm pools over visible cool ambient. The hero sits at a ~13× linear multiplier vs ~3× in the ref. |
| Line and rendering | 4 | Away from the pool (`edge.png`) it is the ref's family: HD pixel, 1-px dark outlines. In the pool, outlines are erased. Pixels with L < 15 in the hero box: **0% vs 28%** (raw sprite: 38%). Wall faces are 1 tile tall vs ~1.5–2 slabs. |
| Designs | 6 | The raw sprites (`asset_sheet.png`) are close to the ref's: caped armoured hero, horned red demon, green goblin, hooded cultist, purple spider, skeleton with a round shield. In the frame they all read as one orange wash. Floor texture is irregular masonry vs a regular square slab grid. |
| Density and life | 3 | Visual count, ref play area vs ours (frame or fight room): enemies ~22 vs 7; flame sources ~30 warm + ~8 blue + ~4 green vs ~9 warm; chests 7 vs 2; gold piles and blood pools many vs 0. |
| HUD | 5 | Structure and corners are right. Scale is **1.5–1.8× too big**: HP bar 364×40 vs 207×28, skills 72 vs 46, portrait 122×136 vs 88×105, block area 2.1×. The stats column has a panel the ref lacks. Minimap 305×324 vs 250×455, no compass, legend in 2 columns. |
| FX | 2 | The slash crescent is invisible: the frame shows only the washed sword blade as a flat bar. Ref: a bright crescent, ~56 px radius, ~15 px thick at the head. Match has no damage numbers vs 3 in the ref ("12"), and HP bars on 1 of 7 enemies vs 5 of ~6 in the ref. |

---

## 2. Measured gaps (ours vs ref)

### Values (CIELAB L*, `stats.json`)

| Region | L p5 / 25 / 50 / 75 / 95 ref | ours | Black (L<5) ref / ours | Chroma p50 ref / ours |
|---|---|---|---|---|
| Play frame | 0 / 3.1 / **13.3** / **28.3** / 59.6 | 0 / 0 / **0.3** / **4.3** / 51.2 | **30% / 76%** | 12.1 / 0.8 |
| Fight-room pool | 1.1 / 8.9 / **21.2** / 36.8 / 64.1 | 10.0 / 35.3 / **54.2** / 64.3 / 70.2 | 17% / 1.3% | **16 / 53** |
| Ring around the pool | 0 / 2.9 / **12.6** / 22.8 / 53.2 | 0 / 0.3 / **1.1** / 5.9 / 26.1 | 31% / 73% | 10.2 / 0.8 |
| Hero box | 0.7 / 12.7 / **35.9** / 50.5 / 70 | 54.4 / 62.9 / **69.0** / 70.2 / 72.3 | dark<15: **28% / 0%** | 31 / 64 |
| Brute box | 0.4 / 3.1 / **9.2** / 19.2 / 50.6 | 25.4 / 46.6 / **56.0** / 62.5 / 67.6 | dark<15: **66% / 1%** | 9 / 69 |

- **Pool vs surround** (median L ratio): ref 1.7×, ours **49×**.
- **Low-frequency map:** mean −2.23 stops. Ours is darker by more than 0.3 stop on 80% of cells and brighter on 15%: the pools are +1 stop, the rest −3 to −4 stops.
- **Squint test:**
  - The ref has three planes everywhere: void (30%), visible cool stone at L 10–30 (~45%), and many small warm hot spots plus actors.
  - Ours has two: a black field and one flat orange blob.
  - The actors do not separate from the floor. Hero p50 69 vs lit floor 70.8 gives zero contrast. In the ref the hero is darker than the floor (35.9 vs 44.5) and carries a dark rim.

### Light (`radial.py`, 60th-percentile L* per 16 px ring, ours px)

| Source | 0 | 16 | 32 | 48 | 64 | 96 | 128 | 160 | 192 | 224 |
|---|---|---|---|---|---|---|---|---|---|---|
| Ref wall torch (649,400) | 57 | 29 | 19 | 24 | 27 | 24 | 29 | 17 | 18 | 18 |
| Ours wall torch (833,452) | 63 | 40 | 38 | 30 | 24 | 17 | 21 | 15 | 15 | 12 |
| Ref around hero (780,430) | 38 | 43 | 49 | 42 | 30 | 23 | 20 | 16 | 15 | 16 |
| Ours around hero (965,540) | **70** | **70** | **70** | **69** | **67** | **62** | **54** | **39** | **12** | **5** |

- **Ref light structure:** a tight hot core (≤ 32 px), then a long plateau at L 16–28 over cool ambient. There are many small pools and no dark cliff.
- **Ours:** the hero aura plus braziers plus torches sum into a 160-px plateau at L 70, with a cliff to L 5 within 50 px.
- **Linear factor on the hero vs its raw sprite:** raw p50 L 20.5 to frame p50 L 69 is about **13×** in Y. The ref gets about 3× (L 35.9).
- **Cause, in `live/scene.js` light map section:**
  - The pool is fed by these lights:
    - hero aura `lt(h.x, h.y-30, 280, …, 0.45)`;
    - wall torches `330 px × 1.25` plus a `110 px × 0.5` core;
    - fire brazier `460 px × 1.7`.
  - They overlap with no cap.
  - `LIT` multiplies `c * l` with no tone curve.
  - `BRIGHT` (threshold 0.90–1.08) then sends the whole room into bloom. That fills the 1-px outlines.
  - `FINAL` rolls everything above 0.8 into 0.8–0.99, which gives the flat plateau.
  - Ambient is about 0.24 neutral, so unlit stone (raw wall L 20.5) lands at L ≈ 3–6 instead of the ref's 10–22.
- **Light colour:** halo next to a torch: ref L 46 C 65 hue 55; ours L 57 C 41 hue 59. The hue is right. Chroma is −37% because the pool is clipped toward white.

### Palette and named colours

| Named colour | Ref L / C / hue | Ours L / C / hue | Gap |
|---|---|---|---|
| Lit floor near hero | 44.5 / 32 / 61 | **70.8 / 64 / 59** | +26 L, 2× chroma |
| Dim floor | 11.4 / 11 / 34 | 19.6 / 21 / 50 | +8 L, +16° |
| Wall stone (palette #252534 / #3e3234) | 15–22 / 6–11 / **293 (cool)** | wall face 29.9 / 29 / **54 (warm)**; lit wall 60.6 / 50 / 59 | hue off ~120°, chroma 3–5× |
| Unlit rock | 8.2 / 13 / 33 | 3.2 / 0.8 / 338 | −5 L, no colour |
| Contact shadow under hero | **13.9** / 10 / 37 | **70.7** / 67 / 62 | the shadow is gone |

- **Ramp coverage** (`compare.py report`):

  | Ramp | Ref | Ours |
  |---|---|---|
  | Neutral | 51.2% | 79.3% |
  | Orange | 29.9% | 16.4% |
  | Blue | 13.2% | **0.2%** |
  | Cyan | 2.5% | 0% |
  | Green | 2.2% | 0% |
  | Yellow | 1.0% | 0.1% |

- **Unused ref colours (≥ 1% of ref):** #1d1e2d 8.2% (cool slate), #3a0e0b, #5a170d (deep red shade), #142d2a, #f33704 (lava), #1a1e4a, #234591 (arcane blue).
- **Note:** the raw wall textures are already the ref's cool slate. `wall_d_tex` is L 20.5 hue 313 and `walltop_d_tex` is L 13.8 hue 293. Only the light turns them orange.

### Scale (same-scale pairs, k = 1.25)

| Element | Ref (ours px) | Ours | Gap |
|---|---|---|---|
| Hero | 90 | 66 | −27% (−13% on a height match) |
| Skeleton | ~85 | 60 | −29% |
| Goblin | ~76 | 46 | −40% |
| Brute / demon | ~125 | 100 | −20% |
| Barrel | ~50 | 36 | −28% |
| Floor slab | 34, regular square grid | irregular bricks 25–60 × 20–30 | layout differs |
| Wall face height | ~1.5–2 slabs (50–65) | 32 (one TILE) | about −50% |

### Layout and HUD

- **Hero position:** ref (50.8%, 57%) of the play area; ours (50.3%, 50%). OK.
- **Minimap position:** ref x 86.5–99.5%, y 1–36%; ours x 83–99%, y 1–31%. OK. Size: ours 305×324, ref 250×455 at k. Ref has a compass and a 5-row single-column legend (You / Room / Treasure / Boss / Exit) with icons; ours has 4 dots in 2 columns. Ref rooms are drawn as textured stone tiles; ours are flat grey blocks.
- **Top-left HUD block:**

  | Element | Ref (at k) | Ours | Ratio |
  |---|---|---|---|
  | Portrait | 88×105 | 122×136 | 1.39× / 1.30× |
  | HP bar | 207×28 | 364×40 | 1.76× / 1.43× |
  | MP bar | 207×22 | 364×30 | 1.76× |
  | Skill icons | 46 | 72 | 1.57× |
  | Stats rows | 5 rows, no panel, icon 22, text ~18 | panel, icon 30, text 24 | — |
  | Whole block | 319×306 | 512×404 | 2.1× area |

  Ours also has an empty XP strip and 2 potion slots that the ref does not show. These are acceptable game additions but add to the bulk.
- **Floor banner** "Этаж 1 — Подземелье" (507×75 at top centre) is in the match frame. The ref has nothing there.

---

## 3. Polish checklist (critics.md §0)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | One rendering family | **Pass** | Ref is HD pixel ("not pixel art", finest detail 1.3 px); ours is the full-res HD-pixel pipeline. `edge_floor_2x.png` reads as the same family. The match pool's flat clip is a light bug, not a pipeline mismatch. |
| 2 | One texel density | **Pass** | Hero 360 src → 66 px (0.18), floor 1024 src per 176 px (0.17), wall 0.22. No mixels found. |
| 3 | One outline weight / light direction | **Fail** | Outlines erased in lit pools: dark < 15 share is 0% (hero), 1% (brute) vs 28% / 66% in the ref (`pair_hero.png`, `pair_brute.png`). |
| 4 | HUD like a shipped game | **Pass** (fidelity gap: scale) | Consistent 14–16 px margins, one type family, text inside panels, good contrast. Too big vs ref (above). |
| 5 | Effects start at the emitter | **Pass** (weak) | Swing and arc are centred on the hero. The hero is lit by its own swing light and aura; minor. |
| 6 | Characters articulate | **Pass** | `cycle_hero_right.png`: legs alternate and plant, cape and arm move. Motion critic owns the detail. |
| 7 | Grounding and sorting | **Fail** in lit pools | Contact shadow under the hero: L 70.7 vs ref 13.9. The 0.5-alpha `L.shadow` is erased by the light overdrive. Sorting is OK. |
| 8 | No generator artifacts | **Pass, minor** | Per-3×3-tile floor brightness patches (`bake()`: `-0.1*SS(…rnd(floor(x/3)…))`) show as soft rectangles in `edge.png`. No garbled glyphs. |
| 9 | No placeholder tells | **Fail, minor** | Flat solid rim lines in `bake()`: `L.solid(X, Y, TILE, 2, [0.42,0.37,0.36])` on wall faces, and the 3 px `[0.33,0.29,0.29]` side rims, read as programmer lines along every wall top. Also the empty XP bar and the flat-grey minimap rooms. |
| 10 | States read at a glance | **Fail** (match) | Enemy bars only show when `hp < max || elite`, so 6 of 7 engaged enemies show nothing. The ref shows bars on all engaged enemies plus damage numbers. |
| 11 | No primitive-shape effects | **Fail** | `ours_slash_4x.png`: the only visible "slash" is a flat bright bar (the washed sword). The ARC crescent (`u_arc` thickness 0.22, quad 128 px, white over a room already at 0.9) is invisible. The ref crescent is the frame's second brightest focal element. |

**Frame-critic notes:**
- **One light:** all warm, one direction. OK. But the ref's cool ambient is missing, so there is no warm/cool separation.
- **Focal hierarchy:** the ref reads hero, then slash and demon, then torch hot spots, then the side zones. Ours reads orange room and floor banner, then nothing; the hero does not pop.
- **HUD integration:** the panels' dark translucency matches the ref. Size does not.

---

## 4. Top fixes, ranked by visible gap

### 1. Stop the light overdrive and give the ambient the ref's cool slate

Gap: pool p50 54 vs 21, hero 13× vs 3×, outlines 0% vs 28%, stone hue 54 vs 293, ambient L ~3 vs 12.

WHERE:
- `live/scene.js` `SC.render`, the `// ===== light map =====` block;
- the `LIT` shader;
- the `L.finish` call;
- `live/data.js` `BIOMES.*.amb`.

CHANGE:
- **Ambient.** Clear the light target to a cool ambient around `[0.40, 0.44, 0.58]` for dungeon. Make it per biome, but keep blue ≥ red. The current `0.24` neutral leaves raw stone at L ~6; the target is L 12–18.
- **Light amounts:**

  | Light | Now | Target |
  |---|---|---|
  | Wall torch | `330, ×1.25, k 2.6` | `200, ×0.6, k 3` |
  | Torch core | `110 × 0.5` | `60 × 0.6` |
  | Fire brazier | `460 × 1.7` | `260 × 0.9` |
  | Hero aura | `280 × 0.45` | `170 × 0.18` |

  The hero aura could also be dropped; the ref hero has no aura.
- **Soft cap in `LIT`**, so overlapping pools cannot clip:
  `float m = max(l.r, max(l.g, l.b)); l *= (m > 1.0) ? (1.0 + (1.0 - exp(-(m - 1.0)))*1.6) / m : 1.0;`
  This caps at about 2.6×. The target is lit floor at L ≈ 44, i.e. about 2.7× on raw floor L 27.7.
- **Grade.** `L.finish(t, { bloom: [0.32, 0.26] → [0.18, 0.14], warm: 0.6 → 0.2, … })`. With the cap, only flames, slash and loot pass the BRIGHT threshold.
- **Acceptance (re-measure with `stats.py`):**
  - pool p50 within 21 ± 4;
  - hero dark < 15 share ≥ 20%;
  - wall-face hue 270–330;
  - frame p50 ≥ 9 (needs fix 2 too);
  - contact shadow L ≤ 20.

### 2. Fill the void: wall masses and denser rooms

Gap: play-frame black 76% vs 30%, p75 L 4.3 vs 28.3.

WHERE: `live/scene.js` `bake()`, the `near(x, y, 2)` wall-top rule; `live/dungeon.js` `tryGen` room spacing.

CHANGE:
- **`bake()`:** draw `B.top` for every rock cell within 5 cells of floor, not 2. Make it progressively darker with distance (×0.85 per ring) instead of `dark(…, 0.45)` and black. The ref's "black" is mostly between wall masses, not around every room.
- **`dungeon.js`:** change the overlap test margins `+4 / +5` to `+1 / +2`, so rooms share thick walls. Raise `want` to 14–18 and the corridor width to 3 in places.
- **Match staging:** pick a combat room that has ≥ 2 rooms within 25 cells, so the frame shows neighbours as the ref does.
- **Fog of war:** for normal play, keep the cells next to explored ones at 25% (draw walls dim) instead of 0. The ref has no pure-black fog.

### 3. Actor and prop scale +27%

Gap: hero 66 vs 90, goblin 46 vs 76, skeleton 60 vs 85, brute 100 vs 125, barrel 36 vs 50.

WHERE: `live/sizes.js` `HEIGHT`; `HERO_H` in `live/scene.js`; body radii and reach in `live/data.js` `ENEMIES` and the hero's in `sim.js`.

CHANGE (cannot be closed by moving the camera, because the tile grid already matches):

| Sprite | Height now → target |
|---|---|
| hero, hero_back, `HERO_H` | 66 → 84 |
| en_skeleton | 60 → 78 |
| en_goblin | 46 → 66 |
| en_spider | 42 → 54 |
| en_cultist | 66 → 82 |
| en_ghost | 58 → 72 |
| en_brute | 100 → 124 |
| barrel | 36 → 48 |
| crate | 36 → 46 |
| chest | 34 → 42 |
| torch_sconce | 36 → 44 |
| brazier | 40 → 50 |
| statue | 92 → 110 |

Scale `ENEMIES.*.r` and `reach` by about 1.25, and the weapon lengths in `WEAPON`, so hits still line up.

### 4. Biome zones in one view: blue and green light pools

Gap: blue ramp 0.2% vs 13.2%, green and cyan 0% vs 4.7%, blue flames 0 vs ~8, green glows 0 vs ~4.

WHERE: `live/dungeon.js` (room roles) and `live/scene.js` (light map, emissive flames, `bake()` floor tint).

CHANGE:
- Give each room a `biome`: on every floor, 1–2 rooms are crypt (green) or arcane (blue) wings, chosen by distance from start.
- Store `tc.col` per torch from its room's biome and use it in `lt(...)` and in `flame(...)` instead of the floor-wide `B.torch`.
- Tint floor tiles per room in `bake()` with that biome's `tint` and floor texture (`floor_c_tex` / `floor_a_tex` exist).
- Arcane rooms get `crystal` / blue brazier lights at about `[0.35, 0.6, 1.0]`. Crypt rooms get green braziers and a green hex glow.
- The ref's lava strip (left) could come from the same mechanism: a lava room on early floors.

### 5. Restage `match` and fix the world-space combat readouts

Gap: enemy bars 1/7 vs ~5/6, damage numbers 0 vs 3, floor banner present vs absent, slash invisible.

WHERE: `live/scene.js` `SC.QA` `match` state; `live/hud.js` `world()`; the `ARC` shader and its `swing` draw in `scene.js`.

CHANGE:
- **Match state:**
  - `R.msg = null`;
  - `e.hp = Math.round(E.hp * 0.55)` for 5 of 7 enemies;
  - push 3 `{k:'hit', n:12, …}` events at `S.t - 0.15` on the brute and two skeletons;
  - set the swing age to 0.10 s so the crescent is near full.
- **`world()`:** show the bar when `e.st !== 'idle'` and the enemy is within 260 px of the hero, not only when damaged.
- **Bar style, matched to `pair_hero.png`:**
  - a 60×12 capsule;
  - a 1.5 px light-grey rim (#c9c4c0);
  - a dark interior;
  - a red fill, dark at the bottom (#e01a10 to #8a0a08);
  - a round red "heart" cap on the left.
- **Damage numbers:** red #e5281c with a 2 px dark outline, ~20 px tall. They are currently `L.text` glyphs in cream/orange.
- **ARC crescent:**
  - quad 128 → 150 px, so radius ≈ 60;
  - thickness `u_arc.z` 0.22 → 0.32;
  - head colour near white (L 95) fading to warm cream at the tail, as now;
  - `u_amt` floor 0.7 until a = 0.12 s.
  - It becomes visible once fix 1 lands; check it on an age strip.

### 6. HUD to the ref's size and the minimap's structure

Gap: HUD block 2.1× area, bars 1.76× wide, icons 1.57×.

WHERE: `live/hud.js` `hud()` and `minimap()`.

CHANGE:
- `panel('portrait', 14, 12, 90, 106)`.
- HP bar `bar('hpbar', 112, 14, 210, 26)`; MP bar `(112, 44, 210, 22)`. Text size 24 → 18.
- Drop the XP bar to a 4 px line under MP, or move it into the portrait panel.
- Skills: 48 px slots at `x = 114 + i * 56, y = 74`. Potions follow at the same size.
- Stats: no panel, icons 24, text 20, rows 32 px apart starting at y 140.
- Minimap panel 250 × ~455:
  - title row;
  - rooms rendered with a stone fill (#7d746c) and a 2 px light rim, instead of flat grey;
  - a single-column 5-row legend with icons (You, Room, Treasure, Boss, Exit);
  - a compass rose bottom-right.

### Next fixes after the top 6

- **7. Floor material.** Ref: regular square flagstones (34 ours px) with dark mortar and grime speckle. Ours: irregular masonry, which reads like the wall texture. Regenerate `floor_d_tex` with the reference crop `study/critique/fidelity_r1/fight_close.png` (left half) attached. Prompt: "seamless top-down dungeon floor, regular grid of square worn flagstones each 1/30 of the image, thin dark mortar lines, dirt speckle and small cracks, muted warm grey-brown #6b5c56 / #552f25, flat-lit, no lighting, HD pixel art". Then set TS so one slab = 34 px.
- **8. Wall faces and rims.** Make wall faces 2 TILE tall: a face texture over 2 cells and a blocky top lip with a 1-tile bevel. Replace the flat `L.solid` rim lines in `bake()` with a sampled rim strip from `walltop_d_tex` lit from the top-left.
- **9. Density props.** Gold piles, blood pools and weapon racks near fights. Ref: 7 chests, many gold heaps. Ours: 2 chests, no gold heaps. Raise the `decor` count per combat room in `dungeon.js` and add a `gold_pile` decal asset.

---

## 5. What the current approach cannot match, and what would close it

| Gap | Why it cannot be matched now | What closes it |
|---|---|---|
| Four biomes in one screen (ref: dungeon + green crypt + blue arcane + lava) | Biome is per floor (`biomeOf(f)`) | Room-level biome (fix 4). It is a design change, but it is what the ref shows. |
| Tall 3/4 wall masses with crenellated block tops, iron gates and alcoves | The wall is a 1-cell face plus flat top textures | New assets: a 2-cell wall-face strip, a wall-top autotile set (inner/outer corners, ends), and gate/portcullis and alcove props. |
| Lava channels crossing the dungeon with chains and bridges | Lava exists only as blobs inside rooms on lava floors | Lava corridor cells in `dungeon.js` plus a bridge/chain prop. |
| Regular square-slab floor | Current texture is masonry | Regenerate `floor_d_tex` (fix 7). |
| The ref's whole-level overview density (~22 enemies in view) | A real game cannot fill every room at once without hurting play | Accept as a known difference. Stage `match` with 2–3 populated neighbour rooms. |
| Pixel-style damage numbers and bar caps | Engine glyphs are smooth (that is right for HD pixel) but cream-coloured | Colour and outline change only (fix 5). No new font is needed. |
