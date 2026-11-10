# Asset critique, round 1 of 3

Scope: every final asset in `art/gen/` (not `*_sheet` or `*_raw`), checked against `ref.png`, `art/style_bible.txt`, `live/sizes.js` and `frames/qa/*`.

Evidence (all under `study/critique/`):
- Contact sheets at display size, at 1x and 3x nearest, on mid-grey and on dark floor: `sheets/{chars,props,items}_{grey,floor}_{1x,3x}.png` (3x is split into `_0/_1/_2`).
- Rig parts on grey: `sheets/hero_parts_grey.png`.
- Textures tiled 2x2 at play size (200 px): `sheets/tex_2x2_play.png`.
- Reference crops at 3x: `sheets/ref_chars_x3.png`, `ref_chars_gamescale_3x.png` (scaled ×1.055 to game scale), `ref_props_x3.png`, `ref_inv_x3.png`. In-game crop: `sheets/game_play_room_3x.png`.
- Scripts and raw numbers: `measure/grid.py` → `grid.json` (art-pixel cell size, texel density), `measure/metrics.py` → `metrics.json` (alpha, outline, lit side, OKLab), `measure/seams.py` (tiling seams), `measure/sheets.py`.

Reference baseline (measured on `ref.png`): about 2 ref px per art pixel, which is about 2.1 view px per art pixel at the game's 1080p scale. Same-scale heights relative to the hero (hero = 73 ref px): brute 98 (1.34), goblin 63 (0.87), skeleton 63 (0.87), table 45 (0.62), barrel 48 (0.66), small chest 37 (0.51), red chest 43 (0.59), spider about 40 (0.57). Ref sprites have a dark 1-art-px outline about 2 view px wide and clustered, chunky detail.

---

## 1. Scores

| Axis | Score | Reason |
|---|---|---|
| Style match (medium, line, palette, shading) | **7** | Palette is close: median OKLab ΔE to the reference class crops is 0.005–0.03 for every sprite, and median L is 0.31–0.37 against 0.31 in the ref character crop. Shading uses flat, hue-shifted steps. Detail density is the problem: world sprites are about 3× finer than the ref, and the hero and portrait have an anime face and spiky hair the ref doesn't have. |
| Light side | **7** | The highlight centroid sits in the top half (lit-y < 0) on about 85% of assets, which is correct. Hero body and limbs have their brightest pixels on the camera-right side (lit-x +0.12 to +0.22) instead of top-left. No baked glow, rays or lit flames. |
| Alpha quality | **7** | No light halos on grey or on the floor; every edge pixel is outline-dark. Each sprite has 25–37 detached specks of 1–2 src px (invisible at play size), and `hero_back` has 134 specks (397 px). Semi-alpha is 20–32% on spider, ghost, goblin, skeleton and amulet; this is fine with the linear filter. |
| View / scale consistency | **4** | Texel density varies widely. World sprites are 0.33–0.85 view px per art px, item icons 1.3–2.3, floor and wall textures 1.0–1.8, `walltop_d` 3.9 and `lava` 2.4. The ref is about 2.1. Several relative sizes are off too: goblin 0.70 vs 0.87, brute 1.52 vs 1.34, barrel 0.55 vs 0.66, table 0.48 vs 0.62. |
| Rig part completeness | **4** | Every right limb part is a pixel-exact copy of the left part shifted sideways (max diff 0). The far limbs are not darker. The body has a hollow-tube pauldron on the far shoulder. Both fists are the same drawing. |
| Hallucinated detail | **8** | No text, runes or glyphs. The one melted form is the hollow pauldron socket on `hero__body` (shows in `hero.png`). The altar banner and grave cross are acceptable. |
| Silhouette at play size | **8** | All characters and items read clearly at 1x. Weak: `spikes` at 30 px reads as a grey smudge, `torch_sconce` with no flame reads as a stick, and `bones` and `candles` lose shape at 24–26 px. |
| Tiling (`*_tex`) | **6** | `floor_a_tex` has a real seam: the wrap-edge difference is 7.7× the interior on X and 4.95× on Y, because the mortar line is missing on the wrap column. `floor_c` Y is 1.76× and `lava` X is 1.6×. `walltop_d` shows an obvious 2×2 repeat. Floor textures look softer under the linear filter than the crisp sprites on top of them. |

---

## 2. Verdict per asset or family

### Characters

- **hero.png (rest pose)**: **FIX IN POST**, after rig item 2 below. Remove the hollow socket on the camera-left pauldron at `hero.png` x≈45–70, y≈95–125 by filling it with the pauldron's mid tone (#6b5c56-ish steel) and a 1-px rim. Then apply the texel-density pass (top fix 1). The face style is a soft regenerate candidate (see portrait).
- **hero__\* rig parts**: **FIX IN POST**.
  - Every `*R` part is an exact copy of `*L` (`thigh`, `shin`, `foot`, `farm` and `uarm` all diff 0).
  - The hero faces right, so the camera-left limbs (`*L`, x < 90) are the far side. Darken them in OKLab L by 12–15% and drop chroma by 10%. That gives far-limb separation without a regenerate.
  - Mirror `farmR`'s fist horizontally inside its bbox so the near hand's knuckles face the travel direction.
  - Remove the hollow-tube end on `uarm` (the dark ellipse at the right end of the pauldron).
  - Parts are otherwise complete and the joints are readable.
- **hero_back**: **FIX IN POST**. Remove the 134 islands under 20 px. Its opaque height is 58.6 view px against 65.8 for `hero` (−11%). Trim it or scale it to match the front so turning around doesn't pop.
- **en_skeleton**: **ACCEPT**. Size 0.91 against the ref's 0.87. Outline coverage 0.60 is thin; it gets the post outline pass.
- **en_goblin**: **ACCEPT** the art, but change the size. Display 46 gives a ratio of 0.70; the ref is 0.87. Raise it to about 57 px in `sizes.js`.
- **en_brute**: **ACCEPT** the art, but change the size. Display 100 gives 1.52; the ref is 1.34. Lower it to about 88 px.
- **en_spider**, **en_cultist**: **ACCEPT**. Remove specks.
- **en_ghost**: **ACCEPT**. It has no outline (0.32 coverage), which matches the ref's glowing ghost.
- **portrait**: **REGENERATE**, low priority. Prompt change: add "grounded western dark-fantasy face, small eyes, short tousled brown hair, no anime styling, no big glossy eyes, no spiky manga hair; same hero, same red cape and steel pauldrons". Today it reads as anime, while the ref portrait is a plain, grounded face.

### Props

- **barrel**: **ACCEPT** the art, but change the size. Display 36 gives 0.55; the ref is 0.66. Change it to 44.
- **crate**: **ACCEPT**. Change the size to 40, to sit with the barrel.
- **chest**, **chest_open**: **ACCEPT**. 0.52 against the ref's 0.51–0.59.
- **table**: **ACCEPT**, but change the size. 32 gives 0.48; the ref is 0.62. Change it to 41. Its art is plain (low detail); acceptable.
- **pot**: **ACCEPT**.
- **bookshelf**, **cage**, **door**, **pillar**, **statue**, **altar**, **coffin**, **grave**, **rack**, **stairs**, **crystal**, **banner**, **brazier**, **treasure**: **ACCEPT** after the density pass. Measured halos on `rack` (326 px), `treasure` (112), `altar` (91) and `spikes` (85) are bright metal tips and coins on the edge, not fringe. Checked on grey.
- **spikes**: **REGENERATE** with a simpler design. 87 art px tall shown at 30 px is 0.33 view px per art px, the densest in the set, and it reads as a smudge. Prompt change: "a single 16x16-pixel floor tile with 3x3 short steel spikes, chunky 2-pixel spike tips, dark iron base plate, top-down 3/4 view, 1-pixel #231010 outline". The ref's spike trap is one floor tile of bold, separated spikes.
- **torch_sconce**: **ACCEPT**, on the condition that the game always draws a code flame on it. Unlit, it reads as a stick, which is correct per the bible but must never show bare.
- **candles**, **bones**: **ACCEPT**. Candles have the highest median L in the set (0.66, bright cream wax). That is fine for wax, but tone the top step to #eed68a, not near-white.

### Items and abilities

- **it_\* (19 icons)**: **ACCEPT**. They are the best match in the pack. Texel density is 1.3–2.3 view px per art px (ref icons are about 2), outline coverage is 0.93–1.00, and there are no halos. The inventory frame `inv.png` reads like the ref.
- **ab_fire**, **ab_shield**, **ab_whirl**: **ACCEPT**. Opaque square backgrounds are correct for skill slots.

### Textures

- **floor_d_tex**, **wall_d_tex**: **ACCEPT**. 1.76 view px per art px is close to the ref's 2.1. Seams 0.46–0.86 (seamless).
- **floor_a_tex**: **FIX IN POST**. Seam X is 7.7 and Y is 4.95. The rightmost 12 src px have no mortar line on the lower half, so two stones fuse across the wrap. Repaint the mortar column at x≈1012–1024, or rerun the wrap fix (offset by half, inpaint the cross, offset back).
- **floor_c_tex**: **FIX IN POST**. Seam Y is 1.76; same offset-and-inpaint fix on the top/bottom wrap.
- **floor_l_tex**: **FIX IN POST**. 0.98 view px per art px is half the ref's density. Draw it at about 420 view px per 1024 src, or pixel-snap it with `--grid 10`.
- **lava_tex**: **ACCEPT**. Seam X is 1.6, which is borderline; the animated distortion hides it.
- **walltop_d_tex**: **REGENERATE** or redraw it smaller. At 3.9 view px per art px it is about 2× chunkier than everything else, and the 2×2 repeat is obvious. Either draw it at about 105 view px per 1024 src, or regenerate with "irregular wall-top stones, 4-6 stone sizes, no repeating rows, 1024 px seamless, 16x16-pixel tile scale".

---

## 3. Top fixes, ranked by impact

1. **Texel density (mixels) between world sprites, icons and floors**
   - WHAT: every world sprite in `art/gen/` (hero, enemies, props). Crop example: `sheets/game_play_room_3x.png`, where the hero and chest are drawn at sub-pixel detail on a soft, chunky floor.
   - WHY: world sprites have an art-pixel cell of about 3–4 src px. `hero.png` has a 3 px cell, so it is about 120 art px tall shown at 66 view px, or 0.55 view px per art px. The reference hero is about 36 art px tall at about 2.1 view px per art px, and our item icons are at 1.3–2.3. So the world sprites are about 3–4× finer than both the reference and our own icons. Under linear mipmapping they read as a downscaled illustration rather than pixel art.
   - CHANGE (post, no regenerate): run `gen.py pixel IN OUT --grid G --colors 24` per world sprite. Choose G = src_h / (display_h / 2), so the art is about display_h/2 art px tall (hero G≈11 → 33 art px; skeleton 363/(60/2) ≈ 12; barrel 294/(44/2) ≈ 13). Use dominant colour per cell and binarise alpha. Then re-upscale nearest to the original canvas so the rig joints in `rigs.js` keep their coordinates.
   - Test on `hero` and `en_skeleton` first and compare the 3x crop against `ref_chars_gamescale_3x.png`. If faces go to mush at 33 art px, use display_h/1.6 instead (hero about 41 art px, 1.6 view px per art px), which is still within one step of the ref.
2. **Hero rig: right limbs are copies of left limbs, and far limbs are not darker**
   - WHAT: `hero__{uarm,farm,thigh,shin,foot}R.png` are byte-identical to the `L` parts shifted by +40/+92 px.
   - WHY: the diff is 0 for all five pairs. Motion checklist item 6 says far limbs sit behind and are darker; here they have the same values and the same fist drawing.
   - CHANGE: darken the far set (`*L`, the camera-left side, since the face is "right") by OKLab L −0.05 and chroma ×0.9, and flip the `farmR` fist inside its bbox. Better: regenerate the parts sheet with "near arm and far arm drawn separately, far arm slightly darker, near hand shows knuckles toward the viewer".
3. **Hollow pauldron socket (melted form)**
   - WHAT: `hero__body.png` camera-left shoulder, around x 45–70, y 95–125 (also the right end of `hero__uarm*`). It is visible in `hero.png` and in-game.
   - WHY: the opening is a dark ellipse with an outline-dark core of about 8×10 src px. At play size it reads as a hole in the shoulder. The ref hero's pauldron is solid.
   - CHANGE: fill it with the steel ramp (#6b5c56 mid, #eed68a 1-px top rim) in post.
4. **Relative scale against the 66 px hero**
   - WHAT: `live/sizes.js` HEIGHT.
   - WHY: the measured ratio to the hero vs the same-scale ref is goblin 0.70/0.87, brute 1.52/1.34, barrel 0.55/0.66, table 0.48/0.62, crate 0.55 (with the barrel at 0.66).
   - CHANGE: `en_goblin: 57, en_brute: 88, barrel: 44, crate: 40, table: 41`. Skeleton 60, chest 34 and spider 42 are already within ±5% and stay as they are.
5. **Texture seams and density**
   - WHAT: `floor_a_tex` (seam ×7.7 / ×4.95), `floor_c_tex` (Y ×1.76), `walltop_d_tex` (3.9 view px per art px, visible 2×2 repeat), `floor_l_tex` (0.98 view px per art px).
   - WHY: a seamless wrap measures 0.3–1.0 (`floor_d` is 0.46/0.86). The ref grid density is about 2.1.
   - CHANGE: offset-inpaint the wraps on a and c. Draw `walltop_d` at about 105 view px per 1024 src, or regenerate it. Draw `floor_l` at about 420 view px per 1024 src.

---

## 4. Rules broken

- `critics.md` §0 polish item 2 (one texel density): see top fix 1.
- §0 item 3 (one outline weight): enemies have 0.58–0.72 outline coverage against 0.95 for the hero and 0.98 for icons.
- §0 item 6 (far limbs darker): see top fix 2.
- §0 item 8 (melted forms, visible tile repeat): the pauldron socket; `floor_a` and `walltop_d`.
- `art.md` §9 (Parts: complete and nothing fused; No hallucinated detail): the pauldron socket.
- `styles.md` §1 (binarise alpha, one outline width, remove orphan pixels): specks and semi-alpha are not cleaned.

---

## 5. Minor issues

- **Alpha specks**: under 20 px each. Counts: 25–37 per enemy, 34 on `hero`, 134 on `hero_back`. Remove islands smaller than 20 src px. They are invisible at play size but trivial to fix.
- **Enemy outline coverage**: skeleton 0.60, goblin 0.58, spider 0.65, cultist 0.71, brute 0.72, against 0.90 or more for hero, props and icons. A 1-art-px #231010 outline pass after the grid snap evens this out. Skip the ghost.
- **Hero light**: highlights sit right of centre (+0.12 to +0.22) against the bible's top-left. With dynamic lights in-game this is low impact; if the parts are regenerated, restate "light from top-left, lit rim on the left edges".
- **Brazier code flame**: in `play.png` it is a tall smooth cone, in a different family from the pixel sprites. This belongs to the effects/frame critic and is noted here only.
- **`candles`**: the top highlight is near-white (L90 0.84). Clamp it to #eed68a.
- **`hero_back`**: the canvas is 1024², with the opaque bbox at x 278–755, y 54–963. Its opaque height is 11% shorter than `hero` (see the hero_back verdict).
- **Hero proportions**: the head is about 1/3.3 of body height, against about 1/4.5 in the ref (chibi/anime drift). Not worth a regenerate on its own; bundle it with the portrait regenerate if the rig parts are redone.
