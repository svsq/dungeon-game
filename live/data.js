// live/data.js — game content as data: biomes, enemies, items, affixes, abilities, meta upgrades, UI layout.
// Shared by sim.js (rules) and scene.js / hud.js (drawing). Pure data + pure helpers, no state.
(function (root) {
  const TILE = 32;                         // world units are view px; HD-pixel art drawn at display size (styles.md §1)
  // the camera's zoom: the world fills the 1920×1080 screen from a 1920/ZOOM × 1080/ZOOM window. Only whole art-pixel steps keep
  // the pixel grid whole: 1 (one art pixel = 2 screen px, the reference's scale), 1.5 (3 px) or 2 (4 px); the player picks one in
  // the menu or the pause (S.meta.zoom), ZOOM is the default. The HUD stays in screen px
  const ZOOM = 1, ZOOMS = [1, 1.5, 2];
  const zoomName = (z) => '×' + String(z || ZOOM).replace('.', ',');

  // rock, vein: the rock past the dungeon and under the fog of war (scene.js LIT) and the faint veins glowing in it [r, g, b, strength];
  // water: the colour of its shallow pools (scene.js WATER); seam: how much the wall tops' joints smoulder in the vein colour;
  // fill: the light an accent room of this biome is flooded with; dim: how much darker its pale floor stone is laid as an accent zone, so its light reads as pools
  const BIOMES = {
    dungeon: { name: 'Подземелье', rock: [0.008, 0.005, 0.008], water: [0.07, 0.1, 0.12], vein: [1.0, 0.4, 0.12, 0], amb: [0.11, 0.09, 0.10], torch: [1.0, 0.62, 0.26], floor: 'floor_d_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [1, 1, 1], roster: ['skeleton', 'goblin', 'spider'], props: ['rack', 'bookshelf', 'cage', 'statue', 'rack'] },
    crypt: { name: 'Крипты', rock: [0.008, 0.005, 0.008], water: [0.06, 0.11, 0.08], vein: [0.4, 1.0, 0.5, 0], amb: [0.07, 0.11, 0.09], torch: [0.35, 1.0, 0.4], fill: 0.08, floor: 'floor_c_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [0.86, 0.98, 0.9], roster: ['skeleton', 'cultist', 'ghost', 'spider'], props: ['coffin', 'grave', 'statue', 'pillar', 'grave'] },
    lava: { name: 'Огненные глубины', rock: [0.008, 0.005, 0.008], vein: [1.0, 0.38, 0.08, 0.02], seam: 1.4, amb: [0.14, 0.07, 0.05], torch: [1.0, 0.45, 0.16], floor: 'floor_l_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [1.04, 0.9, 0.84], roster: ['goblin', 'skeleton', 'cultist', 'brute'], lava: true, props: ['pillar', 'cage', 'rack', 'statue'] },
    arcane: { name: 'Чертоги', rock: [0.008, 0.005, 0.008], water: [0.06, 0.09, 0.18], vein: [0.35, 0.6, 1.0, 0], amb: [0.07, 0.08, 0.14], torch: [0.16, 0.38, 1.0], fill: 0.06, dim: 0.75, floor: 'floor_a_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [0.68, 0.78, 1.12], roster: ['ghost', 'skeleton', 'cultist', 'brute'], props: ['crystal', 'statue', 'bookshelf', 'crystal', 'pillar'] },
    // cave: natural rock instead of masonry (scene.js caveBake, TASKS 303), lit cold (305): its own light is the mushrooms' (shroom)
    // and the crystals' (gem) glow, fire only by the camp and the merchant; ambK: how much of the dark's colour is the biome's
    // ambient rather than the common cool one; its props (TASKS 306) dress its halls to the ROOM_PLANS that have `cave`; its monsters
    // are the dungeon's with the drowned, the slime, the crab, the eel and the skeleton archer and mage (TASKS 307-311); from: the run's
    // first floor of a kind (TASKS 312), so each floor brings its own: the drowned and the slimes, then the crabs before the archers,
    // then the eels in the lakes and the mages
    cave: { name: 'Затопленные пещеры', rock: [0.006, 0.006, 0.009], water: [0.06, 0.1, 0.12], vein: [0.3, 0.7, 0.8, 0], amb: [0.098, 0.095, 0.1], ambK: 0.9, torch: [1.0, 0.62, 0.26],
      shroom: [0.28, 0.72, 0.76], gem: [0.32, 0.62, 1.0], floor: 'floor_cv_tex', wall: 'wall_cv_tex', top: 'walltop_cv_tex', shore: 'shore_cv_tex',
      cave: true, tint: [1, 1, 1], roster: ['skeleton', 'goblin', 'spider', 'drowned', 'slime', 'crab', 'eel', 'skel_archer', 'skel_mage'],
      from: { crab: 2, skel_archer: 2, eel: 3, skel_mage: 3 }, props: ['stalag_a', 'stalag_b', 'boulder_a', 'boulder_b', 'skel_cv', 'wreck_cv', 'tent_cv'] },
    // the magma caves (R-36, TASKS 399): a run of their own after the campaign's 12th, laid out as plateaus over lava and a chasm (400).
    // Their ash, basalt and crust are baked by scene.js MAGMA (TASKS 402); old: the kinds a cave pack fills its halls with
    // low and floorK lift the ground halfway to the concept's (TASKS 435, the player's choice): all the way, a priest's ring and
    // the other red telegraphs on the floor stop reading
    magma: { name: 'Магмовые пещеры', rock: [0.008, 0.005, 0.005], water: [0.06, 0.1, 0.12], vein: [1.0, 0.38, 0.08, 0.02], amb: [0.14, 0.07, 0.05], ambK: 0.9, low: [1.05, 0.8, 0.74], floorK: 1.45, torch: [1.0, 0.45, 0.16],
      shroom: [1.0, 0.45, 0.16], gem: [1.0, 0.38, 0.1], floor: 'floor_mg_tex', wall: 'wall_mg_tex', top: 'walltop_mg_tex', shore: 'shore_mg_tex',
      cave: true, tint: [1.04, 0.9, 0.84], roster: ['skeleton', 'goblin', 'brute', 'cultist', 'skel_archer', 'skel_ember', 'fire_priest', 'imp', 'salamander', 'golem'], old: ['skeleton', 'goblin', 'brute', 'cultist'], packs: 'MAGMA_PACKS',
      from: { cultist: 2, skel_ember: 2, imp: 2, brute: 3, fire_priest: 3, salamander: 2, golem: 3 }, props: ['basalt_a', 'basalt_b', 'boulder_mg_a', 'boulder_mg_b', 'skel_mg', 'obsidian_mg', 'banner_mg', 'cage'] },
  };

  // enemies: hp, dmg, spd (native px/s), r (body radius), reach (attack range from body edge), wind (telegraph s), cd, xp, kind
  const BOSSES = {
    boss_serpent: { hp: 2000, dmg: 55, scale: 1, phases: [
      { at: 1, moves: ['wave', 'fan', 'bite', 'tail'], rest: 1.35, speed: 0 },
      { at: 0.55, moves: ['fan', 'bite', 'wave', 'tail'], rest: 1.1, speed: 0 }
    ], swim: 1.1, warn: 1, rise: 0.65, dive: 0.6, moves: {
      wave: { wind: 0.85, dmg: 1.1, speed: 300, r: 24, reach: 650, duration: 0.4 },
      fan: { wind: 1, dmg: 0.8, speed: 240, n: 5, spread: 0.8, reach: 620, duration: 0.5 },
      bite: { wind: 0.75, dmg: 1.15, r: 125, arc: 0.7, duration: 0.4 },
      tail: { wind: 1.05, dmg: 1, r: 155, duration: 0.55 }
    } },
    // the queen at 410, not 390: a fireball build burned her in 14 s (TASKS 245)
    boss_spider: { floor: 2, hp: 410, dmg: 18, rig: 'spider', scale: 2.2, phases: [
      { at: 1, moves: ['weave', 'eggs', 'slam'], rest: 0.85, speed: 1 }
    ], moves: {
      weave: { wind: 0.65, dmg: 0, n: 5, cap: 16, r: 150, size: 1.2, spacing: 45, vulnerable: 1.6, duration: 1.6 },
      eggs: { wind: 0.7, dmg: 1.6, n: 2, cap: 4, r: 110, hp: 1.8, type: 'spider', delay: 0.8, hatch: 3, eggHp: 1, duration: 0.5 },
      slam: { wind: 0.7, dmg: 1.2, r: 100, duration: 0.4 }
    } },
    boss_necro: { floor: 4, hp: 410, dmg: 14, rig: 'cultist', scale: 1.65, phases: [
      { at: 1, moves: ['volley', 'raise', 'slam'], rest: 0.9, speed: 1 },
      { at: 0.55, moves: ['volley', 'raise', 'slam'], enter: 'barrier', rest: 0.6, speed: 1.1 }
    ], moves: {
      slam: { wind: 0.7, dmg: 1.2, r: 115, duration: 0.4 },
      volley: { wind: 0.7, dmg: 0.7, n: 8, rings: 2, gap: 0.35, offset: 0.5, speed: 210, life: 2.8, r: 9, origin: 64, target: 38, duration: 0.75, kind: 'arcane' },
      raise: { wind: 0.85, dmg: 2.6, n: 2, cap: 4, r: 140, hp: 3, type: 'skeleton', delay: 0.8, duration: 0.5 },
      barrier: { wind: 0.65, dmg: 0, hp: 0.18, time: 5, duration: 0.4 }
    } },
    // the forge lord at 21, not 20: the 6th has to cost more than the 5th (TASKS 222, 227)
    boss_forge: { floor: 6, hp: 600, dmg: 21, rig: 'brute', scale: 1.7, phases: [
      { at: 1, moves: ['lava', 'slam', 'charge'], rest: 0.85, speed: 1.1 },
      { at: 0.5, moves: ['lava', 'charge', 'slam'], rest: 0.6, speed: 1.3 }
    ], moves: {
      slam: { wind: 0.8, dmg: 1.25, r: 135, duration: 0.4 },
      charge: { wind: 0.75, dmg: 1.15, speed: 430, time: 0.6, stop: 46, r: 54, duration: 0.7 },
      lava: { wind: 0.9, dmg: 0, n: 32, cover: 0.45, warn: 1.1, duration: 0.5 }
    } },
    // the magma caves' lord (TASKS 413). It rises out of its arena's lake and wades ashore (`rise` s up, `wade` px/s), then fights
    // on land only. crack: a line of lava runs out at the hero (`len` px, `w` wide), side-stepped, not outrun; boulder: a rock thrown
    // at him lands `fly` s later and leaves a pool of lava, held so pools never cut the ring (`cap` at once, none within `lakeGap` px
    // of the lake nor `wayGap` cells of a way in or the slab crossing; the point moves off them); fists: both fists round about
    // it, then it stands stuck `stuck` s, open to blows (×`open`); shatter (2nd phase): its crust cracks, the ring's outer edge falls
    // into lava (`edge` cells deep, `warn` s warned) and imps come; erupt / rain (3rd): rocks fall over the ring for `time` s, but
    // never within `shelter` px of a basalt slab of cover
    boss_colossus: { hp: 1650, dmg: 24, scale: 1, rise: 2.2, wade: 70, step: 29.80632555187274, phases: [
      { at: 1, moves: ['crack', 'fists', 'boulder', 'charge', 'fists'], rest: 0.9, speed: 1, finishMove: 1 },
      { at: 0.6, moves: ['boulder', 'crack', 'fists', 'charge', 'imps', 'fists'], enter: 'shatter', rest: 0.75, speed: 1.3, finishMove: 1 },
      { at: 0.25, moves: ['rain', 'fists', 'crack', 'boulder', 'fists', 'charge'], enter: 'erupt', rest: 0.75, speed: 1.3 }
    ], moves: {
      crack: { wind: 0.9, dmg: 1.1, len: 480, w: 30, speed: 900, linger: 0.5, duration: 0.65 },
      boulder: { wind: 0.85, dmg: 1.15, r: 56, fly: 0.95, cap: 2, lakeGap: 24, wayGap: 3, apart: 40, pool: { r: 46, ry: 0.6, t: 4.5, dmg: 0.22, per: 0.5 }, duration: 0.45 },
      fists: { wind: 1.0, dmg: 1.3, r: 150, stuck: 1.2, open: 1.4, duration: 0.35 },
      charge: { wind: 0.8, dmg: 1.1, speed: 420, time: 0.7, stop: 50, r: 62, duration: 0.7 },
      shatter: { wind: 1.0, dmg: 0, edge: 1, warn: 1.6, summon: 'imps', duration: 0.5 },
      imps: { wind: 0.7, dmg: 1, n: 2, cap: 3, r: 130, hp: 1, type: 'imp', delay: 0.8, duration: 0.4 },
      erupt: { wind: 1.0, dmg: 0, next: 'rain', rest: 0.2, duration: 0.5 },
      rain: { wind: 0.6, dmg: 0.9, n: 24, aimed: 5, time: 3.2, warn: 1.0, r: 42, shelter: 64, duration: 3.4 }
    } },
    // the finale: 20+ s that cost about two healths and two potions; kills 10–20 % of the average players who reach it (TASKS 215,
    // 219, 227): its danger is in the moves and the phases, its health (800-900, 219) only keeps the fight long enough to show all three
    // phases; at 900 the fight ran under 20 s, so the 2nd and 3rd phases rest longer and the 3rd raises a barrier. Its blows are big
    // (most reach the boss's cap), so each mistake costs up to half the health and two in a row kill: 28 killed 8.5 %, 31 killed 15 %
    // at 2.1 potions (the player let the finale cost up to 2.5, TASKS 227); 28 again once the fireball no longer burned it down and
    // the bot read its gear: 31 killed 18.5 % (TASKS 245, 246)
    boss: { hp: 900, dmg: 28, phases: [
      { at: 1, moves: ['slam', 'volley', 'charge'], rest: 1.2, speed: 1, finishMove: 1 },
      { at: 0.5, moves: ['volley', 'charge'], enter: 'roar', rest: 0.45, speed: 1.3, finishMove: 1,
        changes: { charge: { wind: 0.55, dmg: 1.1, next: 'slam', rest: 0.025 }, slam: { wind: 0.25, dmg: 1.15, r: 110 }, volley: { wind: 0.55, dmg: 1.3, n: 14, rings: 2, gap: 0.22, offset: 0.4 } } }
    ], moves: {
      slam: { wind: 0.8, dmg: 1.15, r: 145, duration: 0.4 },
      volley: { wind: 0.8, dmg: 0.35, n: 10, rings: 1, gap: 0.32, offset: 0.5, speed: 230, life: 2.6, r: 9, origin: 60, target: 38, duration: 0.7 },
      charge: { wind: 0.8, dmg: 0.95, speed: 520, time: 0.6, stop: 46, r: 54, duration: 0.7 },
      roar: { wind: 0.65, dmg: 0, r: 220, push: 150, summon: 'summon', rest: 0.25, duration: 0.45 },
      summon: { wind: 0.8, dmg: 2, n: 2, cap: 4, r: 90, hp: 4, type: 'skeleton', delay: 1, duration: 0.4 }
    } }
  };
  Object.assign(BOSSES.boss.moves, {
    // the queen's weaving window stays hers: the finale weaves without opening up (TASKS 238)
    weave: Object.assign({}, BOSSES.boss_spider.moves.weave, { wind: 0.6, n: 7, duration: 0.65, vulnerable: 1 }),
    raise: Object.assign({}, BOSSES.boss_necro.moves.raise, { wind: 0.6, dmg: 4, hp: 4 }),
    lava: Object.assign({}, BOSSES.boss_forge.moves.lava, { wind: 0.7, n: 26, cover: 0.35 }),
    barrier: Object.assign({}, BOSSES.boss_necro.moves.barrier, { hp: 0.12, time: 4 })
  });
  BOSSES.boss.moves.convergence = { wind: 0.7, dmg: 0, effects: ['weave', 'raise', 'lava', 'barrier'], duration: 0.5 };
  // the 3rd phase strikes with the 2nd's numbers: its own were left from before the 2nd was retuned (TASKS 227)
  BOSSES.boss.phases.push({ at: 0.25, moves: ['volley', 'charge', 'raise', 'lava', 'weave'], enter: 'convergence', rest: 0.6, speed: 1.3,
    changes: BOSSES.boss.phases[1].changes });
  const bossPhase = (e) => BOSSES[e.type].phases[e.phase || 0] || BOSSES[e.type].phases[0];
  const bossMove = (e) => Object.assign({}, BOSSES[e.type].moves[e.mv || 'slam'], (bossPhase(e).changes || {})[e.mv]);
  const ENEMIES = {
    boss_serpent: { name: 'Глубинный змей', hp: BOSSES.boss_serpent.hp, dmg: BOSSES.boss_serpent.dmg, spd: 0, r: 28, reach: 60, wind: 0.85, cd: 1.35, xp: 300, kind: 'serpent', h: 154, deep: 1, blood: 'water', rim: [0.45, 0.85, 0.9] },
    boss_colossus: { name: 'Магмовый колосс', hp: BOSSES.boss_colossus.hp, dmg: BOSSES.boss_colossus.dmg, spd: 44, r: 38, reach: 70, wind: 0.9, cd: 1.6, xp: 400, kind: 'boss', h: 230, val: 1.1, tint: [1.1, 1.04, 0.88, 1], lava: 1, lake: 1, heavy: 1, rim: [1, 0.42, 0.12] },
    boss_forge: { name: 'Владыка горна', hp: BOSSES.boss_forge.hp, dmg: BOSSES.boss_forge.dmg, spd: 48, r: 35, reach: 60, wind: 0.8, cd: 1.6, xp: 130, kind: 'boss', h: 190, tint: [0.75, 0.6, 0.6, 0.7], val: 0.6, rim: [1, 0.4, 0.12] },
    boss_necro: { name: 'Верховный некромант', hp: BOSSES.boss_necro.hp, dmg: BOSSES.boss_necro.dmg, spd: 48, r: 22, reach: 80, wind: 0.7, cd: 1.6, xp: 95, kind: 'boss', h: 139, rim: [0.3, 1, 0.7], tint: [0.3, 1.15, 0.85, 1] },
    boss_spider: { name: 'Королева пауков', hp: BOSSES.boss_spider.hp, dmg: BOSSES.boss_spider.dmg, spd: 50, r: 32, reach: 65, wind: 0.7, cd: 1.6, xp: 55, kind: 'boss', h: 117, webImmune: 1, blood: 'ichor', tint: [0.6, 0.6, 1.4, 0.8] },
    skeleton: { name: 'Скелет', hp: 30, dmg: 8, spd: 68, r: 13, reach: 36, wind: 0.52, cd: 1.2, xp: 8, kind: 'melee', h: 76, blood: 'bone' },
    goblin: { name: 'Гоблин', hp: 20, dmg: 6, spd: 104, r: 10, reach: 28, wind: 0.30, cd: 0.9, xp: 6, kind: 'melee', h: 72, tint: [0.55, 1.2, 0.6, 0.95] },
    spider: { name: 'Паук', hp: 18, dmg: 5, spd: 92, r: 15, reach: 76, wind: 0.36, cd: 1.6, xp: 7, kind: 'lunge', h: 53, webImmune: 1, poison: 1, blood: 'ichor', rim: [0.45, 0.65, 1], tint: [0.45, 0.6, 1.35, 0.8] },
    cultist: { name: 'Культист', hp: 26, dmg: 9, spd: 56, r: 13, reach: 305, wind: 0.55, cd: 2.0, xp: 10, kind: 'caster', h: 84, rim: [0.3, 1, 0.62], val: 0.55, tint: [0.3, 1.15, 0.85, 1] },
    ghost: { name: 'Призрак', hp: 28, dmg: 7, spd: 60, r: 13, reach: 30, wind: 0.45, cd: 1.3, xp: 9, kind: 'melee', h: 74, ghost: 1, blood: 'ecto' },
    // the drowned (TASKS 307) lies under the shallows (lurk) until the hero comes within `sense`, then rises and wades in: slow, a heavy
    // blow on a long wind-up, and a grab that pulls the hero `grab.pull` px toward it from out of its reach, so the blow can follow
    drowned: { name: 'Утопленник', hp: 52, dmg: 13, spd: 44, r: 14, reach: 38, wind: 0.8, cd: 1.9, xp: 14, kind: 'melee', h: 82, lurk: 1, sense: 84, rise: 0.9, blood: 'water', rim: [0.5, 0.85, 0.8],
      grab: { reach: 118, wind: 0.55, strike: 0.6, pull: 40, t: 0.22, cd: 5, arc: 0.45 } },
    // the slime (TASKS 308) hops at the hero: a squash on the wind-up, `jump.t` s in the air to where the hero stood, the blow on
    // landing; it splits in two small ones on death (they never split again) and leaves a puddle that slows everyone but slimes.
    // The small ones are raised like a summoner's skeletons (summ): a little XP, no loot, no part in the floor's count
    slime: { name: 'Слизень', hp: 30, dmg: 8, spd: 40, r: 15, reach: 105, wind: 0.5, cd: 1.5, xp: 9, kind: 'hop', h: 44, blood: 'slime', split: 'slime_s', jump: { t: 0.46, h: 46, land: 0.4 }, puddle: { r: 34, t: 10 } },
    slime_s: { name: 'Малый слизень', hp: 10, dmg: 4, spd: 52, r: 10, reach: 80, wind: 0.4, cd: 1.3, xp: 2, kind: 'hop', h: 28, blood: 'slime', jump: { t: 0.38, h: 32, land: 0.34 }, puddle: { r: 20, t: 6 } },
    // the armoured crab (TASKS 309) faces its way (fa, rad), turning toward the hero at only `turn` rad/s: a blow, bolt or blast from within
    // `armor.arc` of its front does `armor.k` of its damage. It pinches only what stands in front of it; a hero out to its side at
    // `rush.near`..`rush.reach` px is run down sideways, the shell still facing where it faced
    crab: { name: 'Панцирный краб', hp: 58, dmg: 11, spd: 46, r: 17, reach: 32, wind: 0.6, cd: 1.6, xp: 15, kind: 'crab', h: 46, blood: 'shell', rim: [0.95, 0.6, 0.45],
      turn: 1.5, armor: { arc: 1.05, k: 0.2 }, rush: { near: 24, reach: 150, wind: 0.5, t: 0.42, spd: 380, dmg: 0.8, cd: 4.5 } },
    // the eel from the deep (TASKS 310) lives in a hall's deep water (cell 6) and never leaves it. Under it ('deep') it can't be hurt;
    // with the hero within `sense` px of its water it shows where it will come up (bubbles and a shadow, 'stir', `warn` s), surfaces
    // there by the shore close to him ('rise'), bites (reach) or spits a jet (`spit`) at most `bites` times within `stay` s, and dives
    // ('dive') to come up `swim` s later at least `apart` cells from the last spot. It is no part of a hall's or a floor's count:
    // waiting for it would hold the hero up
    eel: { name: 'Угорь из глубины', hp: 40, dmg: 12, spd: 0, r: 16, reach: 46, wind: 0.5, cd: 0.9, xp: 14, kind: 'eel', h: 100, deep: 1, blood: 'water', rim: [0.45, 0.85, 0.9],
      sense: 290, warn: 0.85, rise: 0.4, stay: 2.6, bites: 2, dive: 0.45, swim: [1.3, 2.3], apart: 3, spit: { reach: 270, wind: 0.6, spd: 330, dmg: 0.8 } },
    // the skeleton archer (TASKS 311) keeps `keep` px off the hero, backing away from one who closes in; it draws for `wind` s (no aim
    // line is drawn, TASKS 338: the draw pose reads the threat), follows the hero until `arrow.lock` s before the loose, and the arrow flies straight at `arrow.spd`
    skel_archer: { name: 'Скелет-лучник', hp: 24, dmg: 9, spd: 74, r: 13, reach: 340, wind: 0.8, cd: 1.9, xp: 10, kind: 'archer', h: 76, blood: 'bone', rim: [0.6, 0.85, 0.45],
      keep: [190, 290], arrow: { spd: 560, lock: 0.28, r: 4 } },
    // the skeleton water mage (TASKS 311) keeps behind another monster from the hero (`behind` px past it) and throws a slow ball of
    // water that slows the hero by `orb.slow` for `orb.t` s
    skel_mage: { name: 'Скелет-маг', hp: 26, dmg: 8, spd: 58, r: 13, reach: 330, wind: 0.75, cd: 2.6, xp: 11, kind: 'caster', h: 76, blood: 'bone', rim: [0.45, 0.9, 0.95],
      behind: 80, orb: { spd: 150, life: 2.6, r: 10, slow: 0.6, t: 2.5 } },
    // the smouldering skeleton (TASKS 411) runs at the hero alight; within `reach` it lights its fuse (the wind-up) and stands
    // hissing for `wind` s, then bursts. Killed first, its bones burst all the same once the fuse is out (a fuse already lit runs on).
    // The blast hurts the hero within boom.r for dmg × boom.dmg and every monster in it for boom.mon of its own health: a pack the
    // hero draws it into pays for it, and one that catches another sets it off
    skel_ember: { name: 'Тлеющий скелет', hp: 18, dmg: 14, spd: 102, r: 13, reach: 24, wind: 0.8, cd: 9, xp: 9, kind: 'bomber', h: 76, blood: 'bone', tex: 'en_skeleton', rim: [1, 0.5, 0.15], tint: [0.85, 0.55, 0.4, 0.8], val: 0.9,
      boom: { r: 92, dmg: 1, mon: 0.35, fuse: 0.8 } },
    // the fire priest (TASKS 410), the summoner of R-22 in the reference's crimson hood at the altar: keeps behind another monster from
    // the hero (`behind`, as the skeleton mage) and works two ways. A ring of fire under the hero (`pyre`): the ring glows `warn` s
    // where he stood when it was cast, then a pillar of fire stands there `burst` s, hurting him once and setting him alight. Every
    // `kindle.every` s (the first `kindle.first` s into the fight) it sets alight the weapons of up to `n` allies within `r` for `t` s:
    // their blows ×`dmg` and set the hero burning
    fire_priest: { name: 'Жрец пламени', hp: 36, dmg: 12, spd: 54, r: 13, reach: 380, wind: 0.6, cd: 3.4, xp: 16, kind: 'caster', h: 84, tex: 'en_cultist', rim: [1, 0.45, 0.15], val: 1, behind: 90,
      pyre: { r: 54, ry: 0.62, warn: 1.0, burst: 0.45, dmg: 1.1 }, kindle: { every: 8, first: 2.5, r: 280, n: 3, t: 6, dmg: 1.3, wind: 0.7, kinds: ['melee', 'slam', 'lunge', 'crab'] } },
    // the imp (TASKS 407), small and quick, in a pack: the only one the lava never stops. It keeps `keep` px off the hero and throws
    // a spark (`spark`) from where he can't walk to it, leaps (`leap`) over lava and crust to a spot across from him (a cell whose way
    // round on foot is long or none), and leaps away from one who comes within `flee`; cornered with its leap not ready, it claws
    imp: { name: 'Имп', hp: 14, dmg: 7, spd: 112, r: 9, reach: 18, wind: 0.32, cd: 1.6, xp: 7, kind: 'imp', h: 54, lava: 1, rim: [1, 0.5, 0.15], tint: [1.05, 0.85, 0.8, 0.5],
      keep: [150, 250], flee: 100, leap: { near: 56, far: 200, spd: 380, h: 0.32, crouch: 0.14, land: 0.2, cd: 1.4, look: 3 },
      spark: { reach: 300, wind: 0.5, lock: 0.12, spd: 290, r: 5, dmg: 0.8 } },
    // the lava salamander (TASKS 408) lives in the lava and hunts on land too, no farther than `tether` cells from it: it swims
    // (×`swim`, only its back and the ripples show), crawls out, bites one close and breathes fire in a cone at one farther off
    // (`breath`: the mouth glows through the wind-up), leaving a burning trail on land (`trail`); under `heal.at` of its health it
    // goes back into the lava and heals there (`heal.rate` of its health a second, not while hit) up to `heal.to`, unless killed first
    salamander: { name: 'Лавовая саламандра', hp: 64, dmg: 12, spd: 60, r: 16, reach: 24, wind: 0.45, cd: 1.4, xp: 16, kind: 'salamander', h: 30, lava: 1, rim: [1, 0.5, 0.2],
      turn: 5, swim: 1.35, tether: 6, breath: { near: 34, reach: 150, arc: 0.42, wind: 0.8, t: 0.7, cd: 4.5, dmg: 0.9 },
      trail: { every: 30, t: 2.4, r: 15, ry: 0.6, dmg: 0.35, per: 1 }, heal: { at: 0.5, to: 0.9, rate: 0.12, calm: 1, cd: 14, most: 7 } },
    // the magma golem (TASKS 409), big and slow in a stone crust: each of its first `crust.n` blows only takes a plate off (×`crust.k`,
    // sparks and a clang); a plate grows back every `crust.regrow` s once no blow has landed for `crust.calm` s and the hero is over
    // `crust.far` px off. It slams both fists on the floor `slam.at` px before it (`slam.r` round); dead, it falls apart into a pool of
    // lava (`pool`) that burns whoever stands in it
    golem: { name: 'Магмовый голем', hp: 140, dmg: 20, spd: 36, r: 24, reach: 48, wind: 1.0, cd: 2.4, xp: 34, kind: 'golem', h: 124, heavy: 1, rim: [1, 0.45, 0.15],
      crust: { n: 4, k: 0.25, regrow: 1.4, calm: 3, far: 150 }, slam: { r: 82, at: 46 }, pool: { r: 52, ry: 0.6, t: 3.5, dmg: 0.3, per: 0.5 } },
    brute: { name: 'Демон', hp: 120, dmg: 18, spd: 52, r: 23, reach: 46, wind: 0.7, cd: 2.0, xp: 30, kind: 'slam', h: 112, tint: [1.0, 0.68, 0.72, 0.9] },
    boss: { name: 'Повелитель Демонов', hp: BOSSES.boss.hp, dmg: BOSSES.boss.dmg, spd: 48, r: 36, reach: 56, wind: BOSSES.boss.moves.slam.wind, cd: 1.6, xp: 300, kind: 'boss', h: 180 },
  };

  // half the monsters, each 2.5× as dangerous (hp × dmg ≈ 2.56: a straight 2.5 on both walled every bot run at floor 2); dmg 2.15,
  // not 1.85, once the hit-stop stopped dropping the hero's dashes and swings: the average bot won 69–71 % (TASKS 227);
  // a kill pays double so XP and loot per floor stay where they were
  // spike: share of max HP per stab, through armour; dmgUp: monsters' damage grows by this per floor (0.3 let the hero's HP and
  // armour outgrow it: a player's minimum HP on floors 5–8 sat at 55–76 % on hard, TASKS 154); earlyCd: the elites' attack
  // cooldown factor on floors 1–3, where they alone took a player down to 11 %
  // dodge: % chance to take no harm from a monster's blow, bolt or blast, per point of agility, its cap, and what a dash adds while it lasts
  // (a dash used to make the hero immune: an expert bot that dashed through blows won 98 % of runs; it adds nothing now: with +10
  // the expert, who dashes twice as often, still won 89–93 %, TASKS 227)
  // dmgLate: more growth per floor past the 5th, where gear bought from the merchant let a player's minimum HP sit at 44–76 %;
  // one curve for every floor, no per-floor patches (TASKS 227): from the 4th, the 5th (the plain demon's first floor) cost more
  // than the forge lord's 6th and a plain blow on the 7th took over 10 % of the health
  // startHpPot: the hero starts with three healing potions: with two, the early deaths came with an empty bag (TASKS 222)
  // cap: the most of the health one monster blow can take (the boss's more), so no stack of elite multipliers kills through a potion
  const BAL = { pop: 0.5, hp: 1.6, dmg: 2.15, reward: 2, startHpPot: 3, spike: 0.12, dmgUp: 0.4, dmgLate: 0.27, earlyCd: 0.85, early: 3, dodge: { agi: 0.25, cap: 40, dash: 0, t: 0.22 }, cap: { blow: 0.33, boss: 0.5 }, deep: { from: 12, hp: 1.1, dmg: 1.06 } };
  // past the campaign's last floor (the endless descent, TASKS 351) monsters grow on with no ceiling: health ×deep.hp and blows
  // ×deep.dmg a floor on top of the campaign's lines (R-05); a blow is still held to BAL.cap of the hero's health
  const deepK = (f, k) => Math.pow(BAL.deep[k], Math.max(0, f - BAL.deep.from));
  const dmgAt = (f, boss) => (1 + BAL.dmgUp * (f - 1) + (boss ? 0 : BAL.dmgLate * Math.max(0, f - 5))) * deepK(f, 'dmg');
  // a monster's health at depth f over its own (× BAL.hp and the difficulty's)
  const hpAt = (f) => (1 + 0.5 * (f - 1)) * deepK(f, 'hp');
  // difficulty presets, picked in the main menu for a new campaign: damage to the hero (monsters and traps), monster HP, experience
  // the balance is tuned on normal; easy and hard only scale the monsters' blows and health by one factor each (TASKS 154)
  const DIFF = { easy: { name: 'Лёгкая', dmg: 0.75, hp: 0.75, xp: 1 }, normal: { name: 'Нормальная', dmg: 1, hp: 1, xp: 1 }, hard: { name: 'Тяжёлая', dmg: 1.3, hp: 1.25, xp: 1 } };
  const DIFF_ORDER = ['easy', 'normal', 'hard'];
  // elites over a regular monster of their kind, brought up to the floor-2 exit guard (the elite demon, kept as it was): hard to
  // kill, quicker on its feet, swings sooner and more often, hits harder and is never knocked back (a knockback per blow kept
  // plain elites from ever swinging). Fewer of them than before: each is a fight of its own. share: chance of a monster from floor 3
  // bolt: an elite caster's bolt,
  // else it took 34–36 % of the health (TASKS 201)
  const ELITE = { hp: 8, dmg: 2.2, spd: 1.3, wind: 0.75, minWind: 0.38, cd: 0.6, bolt: 0.8, share: 0.04, brute: { hp: 2.4, dmg: 1.25, spd: 1.1, wind: 0.85, cd: 1 }, guards: [7], guard: { 7: { hp: 2.2, dmg: 1 } },
    // exit: the exit room's elite by floor (the 1st's is TASKS 180: the first floors were too easy); on the 1st, at hero level 2, the full elite took 13 % of all runs after 3-5 potions (TASKS 241)
    exit: { 1: { hp: 0.85, dmg: 0.85 } } };
  // the boss is an elite too but keeps its own pace. minWind: an elite's wind-up never ends sooner than this nor sooner than its
  // plain kin's, so every elite blow can be seen and dodged: the elite ghost's 0.34 s took half the deaths of the 3rd floor, the
  // elite skeleton's 0.39 s a fifth (TASKS 246)
  const eliteK = (e, k) => !e.elite ? 1 : BOSSES[e.type] ? ({ spd: 1.1, wind: 0.85 }[k] || 1) : e.type === 'brute' || e.type === 'golem' ? ELITE.brute[k]
    : k === 'wind' ? Math.max(ELITE.wind, Math.min(1, ELITE.minWind / ENEMIES[e.type].wind)) : ELITE[k];
  // a deep-water monster under the surface (TASKS 310): out of sight and out of reach
  const under = (e) => (!!ENEMIES[e.type].deep && (e.st === 'deep' || e.st === 'stir' || e.st === 'dive' || (e.type === 'boss_serpent' && e.st === 'idle'))) || (!!ENEMIES[e.type].lake && (e.st === 'idle' || e.st === 'emerge'));
  const windOf = (e, w) => w * eliteK(e, 'wind');
  // an elite's powers: one up to floor 3, then one or two, two from floor 6; each is seen in its aura's colour and its name
  const ELITE_MODS = [
    { id: 'fiery', name: 'Огненный', col: [1.0, 0.42, 0.08], burn: 3 },
    { id: 'vampire', name: 'Кровожадный', col: [0.92, 0.08, 0.2], heal: 0.12 },
    { id: 'summoner', name: 'Призывающий', col: [0.72, 0.4, 1.0], every: 8, n: 2, cap: 3 },
    { id: 'explosive', name: 'Взрывной', col: [1.0, 0.86, 0.35], fuse: 1.0, r: 110, dmg: 1.0 },
  ];
  const eliteMods = (f) => (f >= 6 ? [2, 2] : f >= 4 ? [1, 2] : [1, 1]);
  // a run (R.mode): its floors, each floor's biome and boss, its exit guards and the title of its last floor. depth: how many
  // campaign floors lie above its 1st, so a floor of the run is as strong as campaign floor f + depth in everything that grows
  // as floors climb (monsters, loot, gold, prices, traps); lvl and kit: the hero it starts with.
  // guard: the floors with an elite brute guarding the exit, with its health and blows; in the campaign only the 7th, the chapter
  // bosses hold 2/4/6 (TASKS 220-222), else the last floor before the boss went unguarded (TASKS 214); tankier than an elite brute,
  // at 0.82 the 7th floor was easier than the 6th, 2.05/1 cost more than the 8th, 2.05/0.9 less than the 6th once the late growth
  // began at the 6th (TASKS 227). exit: the exit room's elite by floor (the 1st's is TASKS 180: the first floors were too easy);
  // on the 1st, at hero level 2, the full elite took 13 % of all runs after 3-5 potions (TASKS 241).
  // The water caves are the campaign's 9th–12th floors (TASKS 339) and also a run of their own, kept as a test button in the menu
  // (R-27): four floors and their boss for a hero of level 10, who in the campaign enters the 8th (TASKS 300).
  // loot: levels added to the items it finds, buys and is given over what its depth gives, so they start at the hero's level (the
  // caves: depth 6 made the 1st floor's items level 7 for a hero of level 10);
  // arch: the floor archetype (dungeon.js; the campaign's rooms and corridors by default); size: each floor's map in cells, growing with the run. Its kit matches what the average bot wears entering the 8th: all eight slots, mostly epic
  // chapters: the run's later floors laid out by another run's description (TASKS 339): from the 9th the campaign goes on into the
  // water caves, its 9th–12th are the caves' 1st–4th (their maps, packs, guard and the serpent on the last) at the campaign's own
  // depth (shift: floors added to it; none: 9–12). The hero who comes down from the demon lord is not the caves' own hero of level
  // 10 with a kit: on the caves' first two floors, as they were, the average bot past the 8th lost no run and drank 0.2–0.3 potions
  // a floor (minimum health 58 %), and gained 0.4–0.6 of a level. early: the caves' kinds come a floor sooner (crabs and archers on
  // the 9th, mages and eels on the 10th); pop: more monsters a hall on each of its floors, so the 9th and 10th hold about 40, as many
  // as the 7th and 8th (27 and 32 before). Then, 19 runs from the 9th: minimum health 47/48/41/25 %, potions 0.6/0.7/1.1/1.7, the
  // serpent takes 174 % of the health. pop[0] 1.5 and 1.8 measured apart on 160 seeds (TASKS 339): the 9th stays a breather —
  // minimum health 52–54 % (band 25–45), 0.4–0.6 potions (0.8–2), 0–1 deaths; denser halls are no lever for the band, so 1.5
  // stays and the 9th's pressure comes from elites (TASKS 341): elite, the share of monsters that come as elites on 9–12 (0.04
  // elsewhere), set so pressure climbs floor by floor; mob, the chapter's plain blows (TASKS 340: 10.5–11.6 % of the health at the
  // depth's, band 6–10).
  // chapter: how many floors its own description lays out (biome, boss, guard, exit and altars count in those); names: a floor's own title over its biome's
  // floor archetypes as data (TASKS 400; the campaign's rooms and the water caves move in with 379). plateau: the magma caves' tables
  // of ash and basalt over lava and a dark chasm (the reference's plan is no cave: no halls in solid rock). The plateaus stand close,
  // most of what the camera sees, with lava between them in narrow channels and the chasm only in rare pits (TASKS 422: plateau 50 %
  // of the frame and more, lava 20–30 %, chasm 15 % and less), joined by short ridges over the channels. cells: map cells per
  // plateau; gap: rock kept between two plateaus' boxes (the channel); plat and small: a plateau's box [w, h] ranges, the big ones
  // tried first (bigTries) and the small ones fill the gaps (a boss floor's first is its arena), then every box but the arena grows
  // into the free rock up to grow; round: the blob's squareness (2 an ellipse); edge: [out, ragged] cells its edge is pushed out
  // and in by a noise; caches, cacheSize, cacheRows: stretches of the top wall's foot held clear of the plateaus for the secret caches
  // (how many, their width, their rows from row 3; TASKS 425); arenaGap:
  // the rock kept between a boss's arena and the plateaus round it (its rim stays dark: no lava the hero could wade out over); pop:
  // a plateau's monsters against a room's (the plateaus grown to fill the floor are more and bigger: as many a floor as before); rag: how
  // ragged a blob's edge is;
  // ridge: its width and how far each bend strays off the straight line; deg: the ridges a plateau has on the tree (one more only
  // where nothing else joins); loops: ridges over the tree, only between plateaus at least loopHops apart on it and each kept only if
  // the floor's longest walk keeps loopKeep of its length (loopLast for its first, so every floor has one), so no loop cuts the way short; ledges: dead-end spurs off the ridges ending in a small pad (a
  // chest, an ambush, a cache); band: rock cells along the floor's edge turn to lava as far as the noise allows (0 below the first
  // threshold, 1–3 cells past each next one); channel: a gap of rock narrower than this between two floors is a lava bed; isle: the
  // noise over which rock stays standing in the lava; cliff: rows from the top within which a plateau backs onto the rock wall
  // (the only wall the plateaus have); path: the least walk from the start to the stairs per floor, in cells (1.4 × the water
  // caves' mean on the same floor, 30 seeds). lava (TASKS 401): a lake per lakeCells map cells, its blob's radii [x, y], laid lakeOff
  // cells off the floor and lakeApart apart, kept from lakeMin cells; rivers river cells wide, a ridge cell costing them ridgeCost
  // (they cross one only where they must), the rock past `near` cells off the floor dearer, `dark` cells off it a river's last way out;
  // falls down the top wall, fallApart apart, the wall over one fallDeep rows deeper, and vents; a lake joined down a river to its nearest with the chance join, if within
  // joinMax; isle: the noise over which basalt stands in a lake; bridge: the chance a crossing of three cells and more is tried as a
  // chain bridge; crust: the noise over which a bank's lava is crust; share: the band of lava in floor and lava (selfCheck)
  // mix (TASKS 432): the plateaus are of kinds, not one size grown to one cap: `arena` one or two broad fields (n, their box
  // [w, h] ranges, grown up to `grow`; none on a boss's floor, its own arena is the field there), `ridge` long narrow ones (the long
  // side first, `tall` of them upright), `ledge` small pads laid last in the gaps, which hold the hoards; the rest as `plat`/`small`,
  // grown up to `grow`. edge and rag: a kind's ragged edge (a ridge's noise of a cell would cut it through); pop: its monsters
  // against a plateau's
  const ARCH = {
    plateau: { cells: 600, gap: [2, 2], plat: [[15, 24], [11, 16]], small: [[8, 11], [7, 9]], bigTries: 500, grow: [30, 22], round: 3, edge: [1, 3], caches: [2, 3], cacheSize: 8, cacheRows: 3, arenaGap: 6, pop: 0.48, rag: 1, ridge: { w: [2, 3], bend: [1, 2] },
      mix: { arena: { n: [1, 2], box: [[24, 30], [15, 19]], grow: [36, 26], pop: 1.2 }, ridge: { n: [2, 3], box: [[18, 26], [4, 5]], grow: [30, 6], tall: 0.3, edge: [0, 1.5], rag: 0.7, pop: 0.5 },
        ledge: { n: [4, 6], box: [[6, 8], [5, 6]], grow: [9, 7], edge: [0, 1.2], rag: 0.6, pop: 0.3 } },
      deg: 2, loops: [1, 2], loopHops: 3, loopKeep: 0.85, loopLast: 0.7, ledges: [2, 4], band: [0.15, 0.45, 0.7], channel: 7, isle: 0.74, cliff: 10, path: [148, 168, 211, 0],
      // floor types (TASKS 426): each lays its own figure before the plateaus, which stand round it; the floors of a run never take
      // the same type twice running (the boss's keeps the plain plateaus for its arena). lake (427): the floor's figure, a lake of
      // lava in the middle of the map, its half-axes `fig` of the map's width and height, its middle at `at`; a chain of `isles`
      // islands across it, one big (the hoard's), the rest of the `isle` sizes after it in turn [w, h ranges]; `margin` cells of lava
      // between it and the plateaus on its shore, which are smaller there (plat, small, grow as the plain floor's), so they ring the
      // lake rather than fill the floor; islet: the noise over which basalt stands in it (1: none, a cell of rock in it read as a hole
      // into the dark; the lava shader's column clusters stand in it instead); share: its band of lava (selfCheck)
      // arena (TASKS 413): the magma caves' last hall, a broad ring of plateau round a lake of lava, w × h cells; the lake's half-axes
      // (lake) leave the ring wide enough for the colossus; a row of basalt slabs crosses the lake the short way (the hero may cut over,
      // the colossus is too broad for it); cover: basalt slabs standing on the ring, solid, stopping bolts
      arena: { w: 28, h: 20, lake: [7, 4.3], rag: 0.25, cover: 5 },
      // river (428): a wide winding river of lava across the map from edge to edge, `w` cells wide, its middle at `at` of the
      // height, swinging `amp` of it over `waves` bends; it widens round an island (`isle` cells, the hoard's) at `isleAt` of the
      // width; `cross`: the ways over it the plateaus on its banks keep (the island's included), spread along it; path: the least
      // walk to the stairs, 0.85 of the plain floor's (the ways over cut it short)
      river: { pop: 0.52, w: [5, 7], at: [0.44, 0.58], amp: [0.07, 0.12], waves: [1.1, 2], isle: [[9, 12], [6, 8]], isleAt: [0.3, 0.7], margin: 2, cross: [2, 3], path: [126, 143, 179, 0], share: [0.3, 0.6] },
      // chasm (429): the plateaus stand `gap` cells apart over the black chasm, no lava along their edges or in the gaps between (a
      // lake of it deep down, `lakes`), joined by narrow ridges bent less than the plain floor's (`ridge`), their straight runs chain
      // bridges over the dark but a share `neck` of them left a neck of rock
      chasm: { pop: 0.58, gap: [6, 5], plat: [[13, 20], [10, 14]], small: [[8, 11], [7, 9]], grow: [22, 16], ridge: { w: [2, 3], bend: [0, 0.6] }, neck: 0.25, lakes: 1, share: [0.02, 0.3] },
      // terrace (430): a lavafall down the top wall near one side of the map (`fallAt` of the width from it, the wall `wall` rows high
      // there) runs down to the bottom as a river `w` cells wide; on the wide side terraces step down, rows `rowH` high with `step`
      // rows of lava between, each `per` plateaus side by side, a row joined to the next at its one end and that to the next at
      // its other (a serpentine), its other end a share `short` of the width short; `branch` plateaus on the narrow side over the
      // river hang off the nearest terrace; rag, edge: their edges more ragged than the plain floor's
      // ledges (TASKS 433): small pads past the rows' short ends and over the river, dead ends off the serpentine
      // (TASKS 432) a row may be a narrow ridge (`ridgeRow`: its chance, height, plateaus in it) or a broad field (`broadRow`, one
      // a floor at most: two left too few rows for the walk to the stairs); never one plateau a row, which cut the walk short
      terrace: { pop: 0.49, fallAt: [0.18, 0.26], wall: 7, w: [4, 5], rowH: [8, 11], step: [3, 5], per: [2, 4], ridgeRow: { p: 0.3, h: [4, 5], per: [2, 3] }, broadRow: { p: 0.15, h: [11, 12], per: [2, 3] }, short: [0.12, 0.3], branch: [1, 2], ledges: [2, 3], margin: 2, rag: 1.8, edge: [1, 4], path: [148, 168, 211, 0], share: [0.25, 0.68] },
      // cave (431): halls in the rock and long winding tunnels, as the water caves' are, the water lava: lakes in the rock on the
      // way between halls, a pool in a hall or two (`pools` at most) and streams across the tunnels; its share of the floor `goal`;
      // pop: its halls are more than a floor's plateaus, each with its pack: as many monsters a floor as the plateaus'
      cave: { goal: [0.1, 0.16], pools: 3, pop: 0.415, path: [0, 0, 0, 0], share: [0.06, 0.3],
        mix: { arena: { n: [1, 2], box: [[16, 20], [12, 15]], pop: 1.5 }, ledge: { n: [3, 4], box: [[6, 8], [5, 7]], pop: 0.6 } } },
      // first: the type of a run's first floor (the player's call 04.11.2026: the caves first, a lake's archers over the lava were too
      // much for the first floor)
      types: ['plain', 'lake', 'river', 'chasm', 'terrace', 'cave'], first: 'cave',
      // mix (TASKS 426): a floor of one of the figure types `over` takes the type `with` too, with the chance p, never on two floors running; riverBridges: the bridges over the chasm a river floor keeps at the least (its plateaus lie in two strips, the river on one side of each, so fewer face each other over the dark); gap: the plateaus' spacing then (the chasm's own left the ledges no room); pathKeep: the share of the figure's walk to the stairs kept (the bridges cut it)
      blend: { p: 0.35, over: ['lake', 'river', 'terrace'], with: 'chasm', gap: [4, 4], pathKeep: 0.75, riverBridges: 1 }, lake: { pop: 0.47, fig: [[0.3, 0.35], [0.26, 0.31]], at: [[0.46, 0.54], [0.52, 0.56]], isles: [3, 5],
        isle: [[[12, 15], [9, 11]], [[8, 10], [6, 8]], [[5, 7], [5, 6]]], margin: 2, plat: [[11, 16], [8, 11]], small: [[7, 10], [6, 8]], grow: [18, 13],
        islet: 1, share: [0.4, 0.66],
        mix: { arena: { n: [1, 1], box: [[16, 20], [10, 13]], grow: [22, 15], pop: 1.4 }, ridge: { n: [2, 3], box: [[14, 20], [4, 5]], grow: [22, 6], tall: 0.3, edge: [0, 1.5], rag: 0.7, pop: 0.8 },
          ledge: { n: [3, 5], box: [[6, 7], [5, 6]], grow: [8, 7], edge: [0, 1.2], rag: 0.6, pop: 0.5 } } },
      lava: { lakeCells: 1400, lake: [[5, 10], [4, 7]], lakeOff: [3, 8], lakeApart: 16, lakeMin: 20, river: [3, 5], bridge: 0.7, ridgeCost: 30, near: 4, dark: 9, falls: [1, 2], fallApart: 18, fallDeep: 3, vents: [0, 1], join: 0.8, joinMax: 40, isle: 0.62, crust: 0.3, share: [0.2, 0.4] } },
  };
  // the magma caves' hazards (TASKS 406), the first of what makes them harder than the water caves: a vent throws lava round it
  // every `per` seconds (drawn from the range, each its own phase), a hot ring on the floor, bubbles and a rising glow `warn` s
  // before; a rock drops from above on a pass between the plateaus or at the foot of the top wall, its shadow growing `warn` s
  // before. Both hurt whoever stands within `r` px (the ring's half-width; its height is ry of it, the floor seen at 3/4) for `burst`
  // s: the hero `hp` of his health past armour (a dash leaps it, as spikes), a vent setting him alight for `burn` s, a monster `mon`
  // grown with depth, and knock him away. n: how many a floor of the magma caves, 1st to 4th (more each floor to the 3rd, the boss's
  // fewer); apart: cells between two of a kind; clear: cells kept from the start's fire, the spawn, chests, monsters' posts and the
  // stairs (selfCheck)
  const HAZ = { vent: { per: [5, 7], warn: 1.2, burst: 0.35, r: 72, ry: 0.62, hp: 0.13, burn: 3, mon: 16, kb: 1.4, n: [3, 5, 8, 3], apart: 8 },
    fall: { per: [4, 6.5], warn: 0.8, burst: 0.12, r: 34, ry: 0.62, hp: 0.11, burn: 0, mon: 14, kb: 0.8, n: [2, 4, 7, 2], apart: 6 }, clear: 3 };
  // where a hazard stands in its cycle at time t: 0 at the burst, the warning from per − warn to per
  const hazClock = (z, t) => ((t / z.per + z.ph) % 1 + 1) % 1 * z.per;
  const hazIn = (z, x, y) => { const H = HAZ[z.k]; return Math.hypot(x - z.x, (y - z.y) / H.ry) < H.r; };
  const RUNS = {
    campaign: { name: 'Кампания', floors: 12, chapter: 8, depth: 0, lvl: 1, biome: (f) => (f <= 2 ? 'dungeon' : f <= 4 ? 'crypt' : f <= 6 ? 'lava' : 'arcane'),
      boss: (f) => (f === 8 ? 'boss' : Object.keys(BOSSES).find((k) => BOSSES[k].floor === f)), guard: { 7: { hp: 2.2, dmg: 1 } }, exit: { 1: { hp: 0.85, dmg: 0.85 } },
      chapters: [{ from: 9, run: 'cave', pop: [1.5, 1.4, 1.3, 1.2], elite: [0.12, 0.16, 0.20, 0.22], mob: 0.87, early: 1 }], names: { 8: 'Трон Демона' }, seal: 'Сначала одолейте Глубинного змея', then: 'endless' },
    cave: { name: 'Затопленные пещеры', floors: 4, depth: 6, lvl: 10, arch: 'cave', size: [[72, 54], [80, 60], [88, 66], [88, 66]], biome: () => 'cave', boss: (f) => (f === 4 ? 'boss_serpent' : undefined), guard: { 3: { hp: 2.2, dmg: 1 } }, exit: {}, title: 'Затопленные пещеры', loot: 3, pop: [1.25, 1.4, 1.3, 1.2], elite: [0.07, 0.13, 0.18, 0.22], mob: 0.87,
      kit: { lvl: 6, gear: [['longsword', 3], ['shield', 3], ['knight_helm', 3], ['plate_armor', 3], ['gauntlets', 3], ['iron_boots', 2], ['ring', 2], ['amulet', 3]], hp: 5, mp: 2, gold: 400 }, seal: 'Сначала одолейте хозяина пещер' },
    // the magma caves (R-36, TASKS 399): after the campaign's 12th, so worth its 13th–16th in depth and loot, the hero at the level and
    // with the gold and potions the average bot leaves the 12th with (40 seeds: level 15, 14–16; gold 8900–10200; 9 potions); laid out as plateaus
    // (TASKS 400) on maps a size up from the caves', the 4th a plateau floor of the 3rd caves' size with the forge lord until his arena (413)
    // loot: +2 over the depth (13–16) puts its items at the hero's level, as the caves' +3 does (TASKS 424: +12 made them level 25–28,
    // a legendary of 25 on the 1st floor, and the run a walk)
    magma: { name: 'Магмовые пещеры', floors: 4, depth: 12, lvl: 15, arch: 'plateau', size: [[88, 66], [96, 72], [104, 78], [88, 66]], biome: () => 'magma', boss: (f) => (f === 4 ? 'boss_colossus' : undefined), guard: { 3: { hp: 2.2, dmg: 1 } }, exit: {}, title: 'Магмовые пещеры', loot: 2, pop: [1.15, 1.25, 1.35, 1], elite: [0.06, 0.08, 0.1, 0.06],
      kit: { lvl: 12, gear: [['longsword', 3], ['shield', 3], ['knight_helm', 3], ['plate_armor', 3], ['gauntlets', 3], ['iron_boots', 3], ['ring', 3], ['amulet', 3]], hp: 8, mp: 3, gold: 9000 }, seal: 'Сначала одолейте хозяина магмы' },
  };
  // the endless descent (R-05, TASKS 348–349; a test button in the menu for now, after the serpent later, TASKS 354): no last floor.
  // Floors come in pairs, each pair one biome drawn from the run's seed (repeats allowed, the caves among them); the second floor of
  // a pair ends it, by turns with an elite brute guarding the exit (pairs 1, 3, …) and with the biome's boss (pairs 2, 4, …). A floor
  // is worth its own number in depth (monsters, loot, prices) and its map grows from `size.from` to `size.to` over `size.floors`
  // floors, then stays; rooms: one to `size.cells` cells of the map (13–17 on the campaign's 72×54). The hero starts as in the campaign
  RUNS.endless = { name: 'Бесконечный спуск', floors: Infinity, depth: 0, lvl: 1, endless: 1, biome: () => 'dungeon', boss: () => undefined, guard: {}, exit: {},
    pool: ['dungeon', 'crypt', 'lava', 'arcane', 'cave'], bosses: { dungeon: 'boss_spider', crypt: 'boss_necro', lava: 'boss_forge', arcane: 'boss', cave: 'boss_serpent' },
    pairGuard: { hp: 2.2, dmg: 1 }, big: ['boss', 'boss_serpent'], bigFrom: 8, guardFrom: 6,
    // a boss past the campaign's last floor (the descent after the serpent): its health and blows over the depth's, so its fight holds
    // the campaign's boss bands (20–90 s, 150–250 % of the hero's health; TASKS 354: at ×1 the 16th's and 20th's took 14–21 s, 60–100 %; at ×1.6 the average's
    // took 22 and 31 s, 149 and 211 %, the expert's 24 s, 123–136 %, 40 seeds)
    deepBoss: { hp: 1.6, dmg: 1.6 }, size: { from: [48, 36], to: [88, 66], cave: [64, 48], floors: 16, cells: 270, rooms: 9 }, seal: '' };
  const runOf = (mode) => RUNS[mode] || RUNS.campaign;
  const mix32 = (a) => { a = Math.imul(a ^ (a >>> 16), 2246822519) >>> 0; a = Math.imul(a ^ (a >>> 13), 3266489917) >>> 0; return (a ^ (a >>> 16)) >>> 0; };
  // a shuffled bag per block of pool-length pairs: a plain draw left run 104062 without caves for 7 pairs (floors 13-25), one chance in five a pair
  const pairBiome = (seed, p) => { const P = RUNS.endless.pool.slice(), n = P.length, b = Math.floor(p / n); let a = mix32((mix32(seed >>> 0) + Math.imul(b + 1, 0x9e3779b9)) >>> 0);
    for (let i = n - 1; i > 0; i--) { a = mix32(a + 0x9e3779b9); const j = a % (i + 1); [P[i], P[j]] = [P[j], P[i]]; } return P[p % n]; };
  // floor f of the endless descent: lf is its place in its pair (a cave pair is laid out as the caves' 3rd and 4th, with all their
  // kinds, lakes and eels); size: its map in cells, growing with f to the cap; altar: on a guard pair's second floor and before a boss
  // big: the chapters' end bosses (the demon lord, the serpent) come no sooner than `bigFrom` (the player's call 02.11.2026): an arcane
  // or cave boss pair before it ends as a guard pair. The exit's guard (the campaign 7th's brute, 2.2 times an elite's health) stands
  // from `guardFrom`: on the 2nd it killed a hero of level 3 on five seeds in eight; before it a pair ends with the exit room's elite
  const endlessStage = (f, seed) => { const M = RUNS.endless, p = Math.floor((f - 1) / 2), pos = (f - 1) % 2, biome = pairBiome(seed, p), cave = biome === 'cave', end = pos === 1;
    const bossPair = p % 2 === 1 && !(M.big.includes(M.bosses[biome]) && 2 * p + 2 < M.bigFrom);
    const Z = M.size, k = Math.min(1, (f - 1) / (Z.floors - 1)), from = cave ? Z.cave : Z.from, size = [0, 1].map((i) => 2 * Math.round((from[i] + (Z.to[i] - from[i]) * k) / 2));
    return { N: cave ? RUNS.cave : M, lf: cave ? 3 + pos : 1 + pos, n: cave ? 4 : 2, depth: f, last: end, fin: false, biome, boss: bossPair && end ? M.bosses[biome] : undefined, arch: cave ? 'cave' : undefined,
      guard: !bossPair && end && f >= M.guardFrom ? M.pairGuard : undefined, exit: f === 1 ? RUNS.campaign.exit[1] : undefined, pop: 1, early: 0, elite: ELITE.share, mob: 1, size, rooms: cave ? undefined : Math.max(Z.rooms, Math.round(size[0] * size[1] / Z.cells)), altar: bossPair ? !end : end, pair: p, bossK: f > BAL.deep.from ? M.deepBoss : undefined }; };
  // floor f of a run: N, the description that lays it out (the run's own or its chapter's), lf, its place among N's floors, n, how
  // many floors N lays out, depth, the campaign floor it is worth; last: the end of its chapter (layout: no river, no altar before
  // the boss), fin: the run's own last floor (the way out, the victory); biome and boss: its biome and its boss, if any; pop and
  // early: its chapter's monsters a hall and how many floors sooner its kinds come (RUNS chapters); elite: the share of its
  // monsters (from the campaign's 3rd floor) that come as elites, ELITE.share unless its chapter sets one for the floor; mob: its plain
  // monsters' blows over the depth's (a boss's and an elite's keep theirs)
  const stageOf = (mode, f, seed = 0) => { if (runOf(mode).endless) return endlessStage(f, seed); const M = runOf(mode), c = (M.chapters || []).filter((q) => f >= q.from).pop(), N = c ? RUNS[c.run] : M, lf = c ? f - c.from + 1 : f,
    n = c ? N.floors : M.chapter || M.floors;
    return { N, lf, n, depth: f + M.depth + ((c && c.shift) || 0), last: lf === n, fin: f === M.floors, biome: N.biome(lf), boss: N.boss(lf), arch: N.arch, guard: N.guard[lf], exit: N.exit[lf], pop: (c && c.pop && c.pop[lf - 1]) || (!c && M.pop && M.pop[lf - 1]) || 1, early: (c && c.early) || 0,
      elite: (c && c.elite && c.elite[lf - 1]) ?? (!c && M.elite && M.elite[lf - 1]) ?? ELITE.share, mob: (c && c.mob) || (!c && M.mob) || 1 }; };
  const rosterAt = (biome, f) => BIOMES[biome].roster.filter((t) => ((BIOMES[biome].from || {})[t] || 1) <= f);
  // the caves' packs by role (TASKS 312), a hall's weight for each when it can hold it: line, a crab or two just inside the way the
  // hero comes in with the archers (and from the 3rd floor a mage) at the far end behind them; shore, drowned in the hall's shallows;
  // hall, slimes in a big hall (area in cells); bones, the old dungeon's kinds, now and then with an archer or a mage at the back.
  // eel: the chance of an eel in a hall's deep water and in each lake between halls, by floor
  const CAVE_PACKS = { line: 3, shore: 3, hall: 2, bones: 2, hallArea: 110, eel: [0, 0, 0.6, 0.7], lake: [0, 0, 0.5, 0.7], old: ['skeleton', 'goblin', 'spider'] };
  // the magma caves' packs by role (TASKS 412), each a hall's pick by weight once its kinds have come (BIOMES.magma.from: the 1st
  // floor skeletons, goblins and archers, the 2nd smouldering skeletons and cultists, the 3rd fire priests and demons). plan: in
  // order, [kinds (a kind twice is drawn twice as often), how many, where]: near, a few steps in from the way the hero comes; back, the far end; any. The first entry is
  // the pack's own: a smaller hall cuts the rest first, a bigger one adds more of the last
  const MAGMA_PACKS = {
    line: { w: 3, plan: [[['skel_archer'], [1, 2], 'back'], [['skeleton', 'skeleton', 'goblin'], [2, 3], 'near']] },
    rush: { w: 1, plan: [[['goblin'], [2, 3], 'near'], [['skeleton'], [1, 1], 'any']] },
    ember: { w: 3, plan: [[['skel_ember'], [2, 3], 'any'], [['skel_archer'], [0, 1], 'back']] },
    cult: { w: 2, plan: [[['cultist'], [2, 2], 'back'], [['skeleton', 'skeleton', 'goblin'], [1, 2], 'near']] },
    pyre: { w: 3, plan: [[['fire_priest'], [1, 1], 'back'], [['skeleton', 'goblin', 'brute'], [2, 3], 'near']] },
    brute: { w: 2, plan: [[['brute'], [1, 1], 'near'], [['goblin'], [2, 3], 'any']] },
    // imps across a river from the way in (TASKS 407), salamanders in the lava by the hall (408), golems on the ridge in front of the
    // priests (409): bank, a cell of the hall by its lava, the far half first; lava, a cell of lava at the hall's edge
    imps: { w: 2, plan: [[['imp'], [3, 4], 'bank'], [['skeleton', 'goblin'], [0, 1], 'near']] },
    lava: { w: 2, plan: [[['salamander'], [1, 2], 'lava'], [['skeleton', 'skel_archer', 'goblin'], [1, 2], 'any']] },
    rock: { w: 2, plan: [[['golem'], [1, 1], 'near'], [['fire_priest', 'cultist'], [1, 1], 'back'], [['imp'], [0, 2], 'bank']] },
  };
  const floorName = (f, mode, seed) => { const M = runOf(mode), st = stageOf(mode, f, seed); return (M.names || {})[f] || st.N.title || BIOMES[st.biome].name; };
  const eliteName = (e) => [...(e.mods || []).map((id) => ELITE_MODS.find((m) => m.id === id).name), ENEMIES[e.type].name]
    .map((w, i) => (i ? w.toLowerCase() : w)).join(' ');

  // equipment slots and bases. lvl scales with the floor where the item drops.
  const SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
  const SLOT_NAME = { weapon: 'Оружие', offhand: 'Щит', helm: 'Шлем', armor: 'Доспех', gloves: 'Перчатки', boots: 'Сапоги', ring: 'Кольцо', amulet: 'Амулет' };
  const BASES = {
    sword: { slot: 'weapon', name: 'Короткий меч', icon: 'it_sword', atk: 6, spd: 0.42, arc: 120, reach: 56 },
    longsword: { slot: 'weapon', name: 'Длинный меч', icon: 'it_longsword', atk: 6.5, spd: 0.44, arc: 130, reach: 66 },
    axe: { slot: 'weapon', name: 'Боевой топор', icon: 'it_axe', atk: 7, spd: 0.46, arc: 140, reach: 61 },
    hammer: { slot: 'weapon', name: 'Боевой молот', icon: 'it_hammer', atk: 7.5, spd: 0.48, arc: 150, reach: 61, kb: 2 },
    staff: { slot: 'weapon', name: 'Посох мага', icon: 'it_staff', atk: 6, spd: 0.45, arc: 110, reach: 61, spell: 0.35 },
    shield: { slot: 'offhand', name: 'Круглый щит', icon: 'it_shield', def: 4, w: 1 / 3 },
    buckler: { slot: 'offhand', name: 'Баклер', icon: 'it_buckler', def: 4, typed: { aspd: 0.6 }, w: 1 / 3 },
    tower_shield: { slot: 'offhand', name: 'Ростовой щит', icon: 'it_shield_t', def: 4, typed: { hp: 0.5 }, minF: 3, w: 1 / 3 },
    leather_helm: { slot: 'helm', name: 'Кожаный шлем', icon: 'it_helm_l', def: 2, typed: { aspd: 0.6 } },
    knight_helm: { slot: 'helm', name: 'Рыцарский шлем', icon: 'it_helm_k', def: 2, typed: { hp: 0.5 }, minF: 3 },
    leather_armor: { slot: 'armor', name: 'Кожаная броня', icon: 'it_armor_l', def: 3, typed: { mspd: 0.8 } },
    plate_armor: { slot: 'armor', name: 'Латный доспех', icon: 'it_armor_p', def: 3, typed: { hp: 1 }, minF: 3 },
    gauntlets: { slot: 'gloves', name: 'Латные перчатки', icon: 'it_gloves', def: 1, typed: { hp: 0.5 }, w: 1 / 2 },
    leather_gloves: { slot: 'gloves', name: 'Кожаные перчатки', icon: 'it_gloves_l', def: 1, typed: { aspd: 0.6 }, w: 1 / 2 },
    boots: { slot: 'boots', name: 'Кожаные сапоги', icon: 'it_boots', def: 1, typed: { mspd: 0.8 }, w: 1 / 2 },
    iron_boots: { slot: 'boots', name: 'Латные сапоги', icon: 'it_boots_i', def: 1, typed: { hp: 0.5 }, minF: 3, w: 1 / 2 },
    ring: { slot: 'ring', name: 'Кольцо', icon: 'it_ring' },
    amulet: { slot: 'amulet', name: 'Амулет', icon: 'it_amulet' },
    cloak: { slot: 'armor', name: 'Плащ странника', icon: 'it_cloak', def: 3, typed: { mp: 1.4 } },
  };
  // BASES w: a base's share of the drops (default 1); the kinds of one slot split its share, so adding a kind does not make the slot drop more
  // BASES typed: the base's own bonus as a share of an average affix roll of that stat, so it grows with level and rarity like one
  const ITEM_BAL = { version: 2, atkLevel: 0.3, defLevel: 0.25, rarity: [1, 1.3, 1.7, 2.2, 2.9] };
  const CONSUMABLES = {
    hp_potion: { name: 'Зелье здоровья', icon: 'it_hp', heal: 0.4, stack: 9 },
    mp_potion: { name: 'Зелье маны', icon: 'it_mp', mana: 0.5, stack: 9 },
    scroll: { name: 'Свиток телепорта', icon: 'it_scroll', stack: 5 },
  };
  const RARITY = [
    { id: 'common', name: 'Обычный', col: [0.78, 0.76, 0.72], affixes: 0 },
    { id: 'uncommon', name: 'Необычный', col: [0.42, 0.86, 0.32], affixes: 1 },
    { id: 'rare', name: 'Редкий', col: [0.36, 0.62, 1.0], affixes: 2 },
    { id: 'epic', name: 'Эпический', col: [0.74, 0.38, 0.98], affixes: 3 },
    { id: 'legendary', name: 'Легендарный', col: [1.0, 0.6, 0.14], affixes: 4 },
  ];
  // affix: stat key, label (with {v}), per-level value range
  const AFFIXES = [
    { k: 'str', label: '+{v} к силе', a: 1, b: 0.5 }, { k: 'agi', label: '+{v} к ловкости', a: 1, b: 0.5 },
    { k: 'int', label: '+{v} к интеллекту', a: 1, b: 0.5 }, { k: 'vit', label: '+{v} к живучести', a: 1, b: 0.5 },
    { k: 'atk', label: '+{v} к атаке', a: 2, b: 1.0 }, { k: 'def', label: '+{v} к защите', a: 1, b: 0.6 },
    { k: 'crit', label: '+{v}% крит. шанса', a: 2, b: 0.4 }, { k: 'hp', label: '+{v} к здоровью', a: 8, b: 4 },
    { k: 'mp', label: '+{v} к мане', a: 5, b: 2 }, { k: 'aspd', label: '+{v}% скорости атаки', a: 4, b: 0.8 },
    { k: 'mspd', label: '+{v}% скорости бега', a: 3, b: 0.5 }, { k: 'leech', label: '+{v}% вампиризма', a: 1, b: 0.3 },
    { k: 'fire', label: '+{v}% урона огнём', a: 6, b: 2 }, { k: 'dodge', label: '+{v}% уклонения', a: 1, b: 0.25 },
    { k: 'regen', label: '+{v} здоровья в секунду', a: 0.5, b: 0.15 }, { k: 'onhit', label: '+{v} здоровья за удар', a: 0.5, b: 0.2 },
  ];
  // by base first: a legendary staff or axe must not be called a blade
  const LEGEND_NAMES = { sword: 'Пламенный клинок', longsword: 'Меч Рассвета', axe: 'Секира Палача', hammer: 'Молот Грома', staff: 'Посох Вечного Пламени',
    cloak: 'Плащ Ночи', weapon: 'Пламенный клинок', offhand: 'Эгида Зари', helm: 'Венец Короля', armor: 'Доспех Феникса', gloves: 'Длани Титана',
    boots: 'Поступь Тени', ring: 'Кольцо Бездны', amulet: 'Сердце Дракона' };

  // the fireball every 2.5 s, not 0.5: thrown at every recharge it adds about a third to a fight's damage; at 0.5–1.2 s a fire
  // build felled the bosses in 8–14 s (TASKS 245)
  const ABILITIES = [
    { id: 'whirl', name: 'Вихрь клинка', icon: 'ab_whirl', key: '1', unlock: 1, mp: 0, cd: 6, desc: 'Круговой удар: {d}% атаки всем рядом' },
    { id: 'fireball', name: 'Огненный шар', icon: 'ab_fire', key: '2', unlock: 2, mp: 12, cd: 2.5, desc: 'Огненный взрыв: {d} урона' },
    { id: 'shield', name: 'Магический щит', icon: 'ab_shield', key: '3', unlock: 4, mp: 30, cd: 16, desc: 'Барьер на 10 с: {d} урона' },
  ];
  // ten ranks at half the old per-rank gain: rank 10 lands a little past the old rank-5 cap instead of 1.7× it
  const AB_MAX = 10;
  const abRank = (id, r) => { const n = Math.max(0, r - 1);
    return id === 'whirl' ? { k: 1.6 + 0.125 * n, cd: 1 - 0.04 * n, r: 118 + 6 * n } : id === 'fireball' ? { k: 1 + 0.125 * n, cd: 1 } : { k: 1 + 0.15 * n, cd: 1 }; };
  // about one elite's blow anywhere (TASKS 179), but slower to grow than the blows: INT, rank and floor all multiplied in made it
  // a second life bar, 688 on floor 8 against the hero's 588 (TASKS 199)
  const SHIELD_T = 10, shieldHp = (int, r, f) => Math.round((24 + int * 2) * abRank('shield', r).k * (1 + 0.2 * (f - 1)));
  // a swing with INT for STR: the weapon in hand plus 1.6 per INT (stats: spellBase), so it grows with the gear as a swing does
  // and a strength build keeps casting deep down (TASKS 203); its bonuses add up into one sum (stats: spell). INT counted twice,
  // fire %, rank and floor all multiplied in made one fireball take 1800 on the 8th on hard, seven swings (TASKS 245)
  const FIRE_K = 1.5;
  const fireDmg = (base, k, spell) => Math.round(base * k * spell * FIRE_K);
  const STATS = [
    { k: 'str', name: 'СИЛ', full: 'Сила: урон в ближнем бою' },
    { k: 'agi', name: 'ЛОВ', full: 'Ловкость: скорость атаки, крит' },
    { k: 'int', name: 'ИНТ', full: 'Интеллект: мана, сила заклинаний' },
    { k: 'vit', name: 'ЖИВ', full: 'Живучесть: здоровье' },
  ];
  const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);
  const metaLine = (M, r) => { const f = (k) => (M.neg ? '−' : '+') + M.v(k) + (M.pct ? '%' : ''), n = r && r < M.max ? r + 1 : Math.max(1, r);
    return (r && r < M.max ? f(r) + '  →  ' : '') + f(n) + ' ' + M.unit(M.v(n)); };
  // first ranks twice the old price, each step after three quarters of it: at 10–25 shards a won run bought five first ranks and
  // the next run was won before the rest of the ~1400 mattered (TASKS 202)
  const META = [
    // v(r): the total bonus at rank r, so the altar shows what is owned and what the next rank brings; unit(n) agrees with n
    { id: 'hp', name: 'Крепость предков', v: (r) => 12 * r, unit: () => 'к здоровью', max: 5, cost: (r) => 30 + r * 11 },
    { id: 'dmg', name: 'Ярость', v: (r) => 6 * r, pct: 1, unit: () => 'урона', max: 5, cost: (r) => 40 + r * 15 },
    { id: 'potion', name: 'Запас зелий', v: (r) => r, unit: (n) => plural(n, 'зелье', 'зелья', 'зелий') + ' здоровья на старте', max: 3, cost: (r) => 30 + r * 15 },
    { id: 'gold', name: 'Жадность', v: (r) => 15 * r, pct: 1, unit: () => 'золота', max: 3, cost: (r) => 20 + r * 10 },
    { id: 'stat', name: 'Наследие', v: (r) => 2 * r, unit: (n) => plural(n, 'очко', 'очка', 'очков') + ' характеристик на старте', max: 3, cost: (r) => 50 + r * 19 },
    { id: 'mana', name: 'Глубокий колодец', v: (r) => 10 * r, unit: () => 'к мане', max: 3, cost: (r) => 30 + r * 11 },
    { id: 'regen', name: 'Второе дыхание', v: (r) => 0.5 * r, unit: () => 'здоровья в секунду', max: 3, cost: (r) => 40 + r * 15 },
    { id: 'gear', name: 'Фамильное снаряжение', v: (r) => r, unit: () => 'к редкости стартового меча и брони', max: 2, cost: (r) => 80 + r * 30 },
    { id: 'skill', name: 'Наставник', v: (r) => r, unit: (n) => plural(n, 'очко', 'очка', 'очков') + ' навыков на старте', max: 2, cost: (r) => 60 + r * 22 },
    { id: 'resist', name: 'Закалка', v: (r) => 15 * r, pct: 1, neg: 1, unit: () => 'урона от яда, огня и лавы', max: 3, cost: (r) => 40 + r * 15 },
  ];

  // a dungeon altar's gifts: it offers one of each tier, takes shards from the meta bank and gives one gift for the rest of the
  // run (the blessing only for the floor), then goes dark. v is the bonus per gift taken
  // tag: the HUD chip's text when the desc does not start with the number ({v} the total value, {n} how many taken)
  const GIFTS = [
    { id: 'bless', tier: 1, name: 'Благословение', icon: 'bf_bless', v: 20, desc: '+20% урона' },
    { id: 'vigor', tier: 1, name: 'Крепкая плоть', icon: 'it_armor_p', v: 20, desc: '+20 к здоровью' },
    { id: 'wisdom', tier: 1, name: 'Ясный разум', icon: 'it_mp', v: 20, desc: '+20 к мане' },
    { id: 'alert', tier: 1, name: 'Острый взгляд', icon: 'it_ring', v: 5, desc: '+5% уклонения' },
    { id: 'reach', tier: 1, name: 'Длинная рука', icon: 'it_longsword', v: 12, desc: '+12% дальности удара' },
    { id: 'thrift', tier: 1, name: 'Крепкий настой', icon: 'it_hp', v: 30, desc: 'Зелья сильнее на 30%', tag: '+{v}%' },
    { id: 'swift', tier: 2, name: 'Лёгкие ноги', icon: 'it_boots', v: 10, desc: '+10% скорости бега' },
    { id: 'haste', tier: 2, name: 'Быстрая рука', icon: 'it_gloves', v: 12, desc: '+12% скорости атаки' },
    { id: 'ward', tier: 2, name: 'Каменная кожа', icon: 'it_shield', v: 6, desc: '+6 к защите' },
    { id: 'crit', tier: 2, name: 'Глаз хищника', icon: 'it_ring', v: 8, desc: '+8% крит. шанса' },
    { id: 'cleave', tier: 2, name: 'Широкий замах', icon: 'ab_whirl', v: 25, desc: '+25° к ширине замаха' },
    { id: 'feast', tier: 2, name: 'Пир', icon: 'it_axe', v: 3, desc: 'Убийство лечит 3% здоровья', tag: '{v}%' },
    { id: 'thorns', tier: 2, name: 'Шипы', icon: 'it_buckler', v: 30, desc: '30% урона вблизи — обратно врагу' },
    { id: 'fury', tier: 3, name: 'Ярость крови', icon: 'it_sword', v: 15, desc: '+15% урона' },
    { id: 'leech', tier: 3, name: 'Жажда', icon: 'it_amulet', v: 4, desc: '+4% вампиризма' },
    { id: 'arcane', tier: 3, name: 'Пламя души', icon: 'ab_fire', v: 25, desc: '+25% силы заклинаний' },
    { id: 'life', tier: 3, name: 'Живая кровь', icon: 'crystal', v: 1.5, desc: '+1.5 здоровья в секунду' },
    { id: 'phoenix', tier: 3, name: 'Второй шанс', icon: 'bf_burn', v: 50, desc: 'Раз за забег: смерть → 50% здоровья', tag: '×{n}' },
    { id: 'execute', tier: 3, name: 'Добивание', icon: 'it_hammer', v: 60, desc: '+60% урона по врагам при HP < 25%' },
  ];
  // an altar stands on every second floor, so it is paid from two floors' takings: a bot reaches the floor-2 altar with ~12 shards,
  // so the middle gift is within reach at every altar (TASKS 183), the dear one takes three floors or more
  const giftCost = (tier, f) => Math.round([0, 4, 9, 16][tier] * (1 + 0.15 * (f - 1)));

  const xpNeed = (lvl) => Math.round(66 * Math.pow(lvl, 1.7));

  // the merchant: one per floor. A bot arrives at the 8th floor with ~6000 gold, so the showpiece (a rarity or two above what
  // drops there) costs most of a run's takings; loot sells back for an eighth, or selling alone would fund the shelf
  const SHOP = {
    gear: (f) => 4 + (f >= 4 ? 1 : 0),
    // the first piece on the shelf is the showpiece: at least this rarity
    best: (f) => Math.min(4, 2 + Math.floor(f / 3)),
    q: (f) => 1.4 + 0.15 * f,
    cons: (f) => [['hp_potion', 1 + Math.floor(f / 3)], ['mp_potion', 2 + Math.floor(f / 3)], ['scroll', 1 + (f >= 5 ? 1 : 0)]],
    // a legendary showpiece at 12× was bought on the 6th floor by every average run, and the 7th became the calmest floor (TASKS 216)
    rarK: [1, 2, 4, 7, 20],
    // selling keeps the old legendary 12×: a dearer showpiece must not make every legendary found worth more gold (209)
    sellK: [1, 2, 4, 7, 12],
    sell: 0.12, buyback: 4,
    lines: ['Заходи, путник! Золото не пахнет.', 'Всё с прошлых героев. Почти не ношеное.', 'Торгуюсь честно. Почти всегда.',
      'Глубже — дороже. Такова жизнь.', 'Продашь хлам? Возьму, не глядя.'],
    hitLines: ['Эй! Я тут торгую, а не дерусь.', 'Осторожнее! Товар хрупкий.', 'Мечом скидку не выбьешь.'],
  };
  const CONS_PRICE = { hp_potion: (f) => 60 + 15 * f, mp_potion: (f) => 50 + 12 * f, scroll: (f) => 100 + 20 * f };
  const price = (it, f, rk) => (CONSUMABLES[it.b] ? CONS_PRICE[it.b](f) : Math.round((50 + 30 * it.lvl) * rk[it.rar] / 5) * 5);
  const itemPrice = (it, f) => price(it, f, SHOP.rarK);
  const sellPrice = (it, f) => Math.max(1, Math.floor(price(it, f, SHOP.sellK) * SHOP.sell));

  // ---------------- UI layout (view px) — the sim hit-tests these, the HUD draws them ----------------
  const TEST_RUNS = [['cave', 'Затопленные пещеры', 'Пещеры заново (сброс)'], ['magma', 'Магмовые пещеры', 'Магма заново (сброс)'], ['endless', 'Бесконечный спуск', 'Спуск заново (сброс)']];
  // the buttons that start a run from the main menu, in the order pressed: a test run is behind «Тесты» (bots and checks press these)
  const startPath = (mode) => (mode === 'campaign' ? [['menu', 'campaign']] : [['menu', 'tests'], ['tests', mode]]);
  const UI = {
    // arm: the run whose button was pressed once over a saved run (a second press drops the save)
    menu: (hasRun, diff, arm, zoom) => [['continue', 'Продолжить забег', hasRun], ['campaign', !hasRun ? 'Кампания — 12 этажей' : arm === 'campaign' ? 'Точно сбросить забег?' : 'Новая кампания (сброс)', true],
      ['tests', 'Тесты', true], ['diff', 'Сложность: ' + DIFF[diff || 'normal'].name, true], ['zoom', 'Масштаб: ' + zoomName(zoom), true], ['meta', 'Алтарь душ', true]]
      .map(([id, label, on], i) => ({ id, label, on, x: 720, y: 440 + i * 86, w: 480, h: 72 })),
    // the test runs (TASKS 417): a screen of their own behind the main menu's «Тесты», in the campaign's order (the caves, then the
    // magma caves, then the endless descent past them), «Назад» last
    tests: (hasRun, arm) => TEST_RUNS.map(([id, fresh, again], i) => ({ id, label: !hasRun ? fresh : arm === id ? 'Точно сбросить забег?' : again, on: true, x: 720, y: 440 + i * 86, w: 480, h: 72 }))
      .concat([{ id: 'back', label: 'Назад', on: true, x: 810, y: 440 + TEST_RUNS.length * 86 + 40, w: 300, h: 70 }]),
    // debug panel (` in play): open every secret of the floor (pressed again, seal the ones it opened); show every item of loot
    debug: (R, S) => [{ id: 'dbg_secrets', label: R.dbgOpen ? 'Скрыть секреты' : 'Открыть все секреты', on: true, x: 520, y: 16, w: 430, h: 60 },
      { id: 'dbg_loot', label: S && S.dbgLoot ? 'Убрать подсветку лута' : 'Подсветить лут', on: true, x: 970, y: 16, w: 430, h: 60 }],
    pause: (zoom) => [['resume', 'Продолжить'], ['zoom', 'Масштаб: ' + zoomName(zoom)], ['save', 'Сохранить и выйти в меню'], ['abandon', 'Сдаться (конец забега)']]
      .map(([id, label], i) => ({ id, label, on: true, x: 720, y: 430 + i * 92, w: 480, h: 72 })),
    end: (hasLog) => [['menu', 'В главное меню', true], ['again', 'Новый забег', true], ['log', 'Сохранить журнал', !!hasLog]].map(([id, label, on], i) => ({ id, label, on, x: 410 + i * 380, y: 920, w: 340, h: 72 })),
    meta: () => META.map((m, i) => ({ id: m.id, x: 180 + Math.floor(i / 5) * 800, y: 270 + (i % 5) * 112, w: 760, h: 96 })).concat([{ id: 'back', label: 'Назад', on: true, x: 810, y: 870, w: 300, h: 70 }]),
    // a dungeon altar: its three gifts side by side, cheapest first
    altar: () => { const P = { x: 360, y: 150, w: 1200, h: 780 };
      return { P, r: [0, 1, 2].map((i) => ({ id: 'gift:' + i, i, x: P.x + 40 + i * 380, y: P.y + 150, w: 340, h: 390 }))
        .concat([{ id: 'leave', label: 'Уйти', on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 86, w: 300, h: 60 },
          { id: 'donate', label: '1000 золота → 1 осколок', on: true, x: P.x + 40, y: P.y + 578, w: 560, h: 64 }]) }; },
    // hero screen: equipment column, bag grid, stats and abilities
    inv: () => {
      const P = { x: 250, y: 170, w: 1420, h: 740 }, r = [];
      const eq = [['helm', 0, 0], ['amulet', 1, 0], ['weapon', 0, 1], ['armor', 1, 1], ['offhand', 2, 1], ['gloves', 0, 2], ['ring', 1, 2], ['boots', 2, 2]];
      for (const [s, cx, cy] of eq) r.push({ id: 'eq:' + s, slot: s, x: P.x + 310 + cx * 96, y: P.y + 110 + cy * 96, w: 84, h: 84 });
      for (let i = 0; i < 24; i++) r.push({ id: 'bag:' + i, i, x: P.x + 640 + (i % 8) * 92, y: P.y + 110 + Math.floor(i / 8) * 92, w: 82, h: 82 });
      STATS.forEach((s, i) => r.push({ id: 'stat:' + s.k, k: s.k, x: P.x + 40 + 196, y: P.y + 452 + i * 52, w: 40, h: 40 }));
      ABILITIES.forEach((a, i) => r.push({ id: 'ab:' + a.id, ab: a.id, x: P.x + 640 + i * 258, y: P.y + 470, w: 250, h: 150 }));
      r.push({ id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 });
      return { P, r };
    },
    // the merchant's screen: his shelf (gear, then consumables) and the buy-back row on the left, the hero's bag on the
    // right; every slot has its price line under it
    shop: (nGoods) => {
      const P = { x: 190, y: 110, w: 1540, h: 860 }, r = [];
      for (let i = 0; i < nGoods; i++) r.push({ id: 'buy:' + i, i, x: P.x + 40 + (i % 4) * 116, y: P.y + 130 + Math.floor(i / 4) * 140, w: 92, h: 92 });
      for (let i = 0; i < SHOP.buyback; i++) r.push({ id: 'back:' + i, i, x: P.x + 40 + i * 116, y: P.y + 580, w: 92, h: 92 });
      for (let i = 0; i < 24; i++) r.push({ id: 'sell:' + i, i, x: P.x + 620 + (i % 8) * 108, y: P.y + 130 + Math.floor(i / 8) * 140, w: 92, h: 92 });
      r.push({ id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 });
      return { P, r };
    },
  };
  // what a blow on a big prop sounds and looks like: wood rocks and sheds splinters, stone shudders and chips, metal rings and
  // sparks, crystal chimes and flashes, sacks slump
  // how wide each floor prop draws, in view px (its display height in sizes.js times its sprite's aspect); the generator keeps
  // these apart so no two overlap on screen. A gold heap draws as the `treasure` sprite, a small pile as `shop_gold`
  // how a room is furnished (dungeon.js: furnish): tall props in a row or in mirrored pairs against the back wall, coffins or
  // crystals in mirrored rows on the floor with an aisle between, stacks of barrels and crates in corners, a table with candles by
  // a side wall, pots in a line along one, bones by the walls; the middle and the ways in stay open. `need`: the plan suits a room
  // whose biome (or zone) has any of these props; `w`: its weight among the plans that suit
  const ROOM_PLANS = {
    arena: { need: [], w: 0, bones: 0 },
    armory: { need: ['rack'], w: 3, back: { n: ['rack'], mode: 'row', max: 3 }, stacks: 1, table: 0.4, bones: 1 },
    library: { need: ['bookshelf'], w: 2, back: { n: ['bookshelf'], mode: 'pairs', max: 1 }, table: 0.9 },
    prison: { need: ['cage'], w: 2, back: { n: ['cage'], mode: 'row', max: 3 }, bones: 3 },
    hall: { need: ['pillar'], w: 2, back: { n: ['pillar'], mode: 'pairs', max: 2, center: 'statue' }, bones: 1 },
    gallery: { need: ['statue'], w: 2, back: { n: ['statue'], mode: 'pairs', max: 2 }, stacks: 1, bones: 1 },
    crypt: { need: ['coffin', 'grave'], w: 3, back: { n: ['statue', 'pillar'], mode: 'pairs', max: 1 }, floor: { n: ['coffin', 'grave'], mode: 'rows' }, bones: 2 },
    sanctum: { need: ['crystal'], w: 3, back: { n: ['bookshelf', 'statue'], mode: 'pairs', max: 1 }, floor: { n: ['crystal'], mode: 'pair' } },
    store: { need: [], w: 2, stacks: 2, table: 0.3, bones: 1, side: 'pot' },
    // a cave hall's dressing (dungeon.js, TASKS 306), [min, max] of each: `rocks` stalagmites and boulders against the rock (a
    // crystal now and then by the water), more in a big hall; `skel` dead explorers sat against it, `bones` by it; `stacks` of
    // barrels and crates; `wreck` a boat's wreck on the shore of deep water; `tent` an abandoned camp. They need the cave's own
    // props, so no campaign room takes them
    grotto: { need: ['stalag_a'], w: 3, cave: { rocks: [3, 6], bones: [0, 1] } },
    ossuary: { need: ['skel_cv'], w: 2, cave: { rocks: [1, 3], skel: [1, 2], bones: [2, 4] } },
    wreck: { need: ['wreck_cv'], w: 2, cave: { wreck: 1, rocks: [1, 3], skel: [0, 1], stacks: [0, 1] } },
    camp: { need: ['tent_cv'], w: 1, cave: { tent: 1, stacks: [1, 1], skel: [0, 1], rocks: [0, 2] } },
    // the magma caves' halls (TASKS 405), the same way: `rocks` basalt stumps and boulders by the edge (obsidian now and then),
    // `skel` the charred dead, `banners` the cult's on their posts, `cages` of its prisoners, `stacks` of its barrels and crates
    cinder: { need: ['basalt_a'], w: 3, magma: { rocks: [7, 11], bones: [1, 3], skel: [0, 1], stacks: [0, 1] } },
    pyre: { need: ['skel_mg'], w: 2, magma: { rocks: [4, 7], skel: [1, 3], bones: [3, 5], stacks: [0, 1] } },
    cultden: { need: ['banner_mg'], w: 2, magma: { banners: [1, 3], cages: [0, 1], rocks: [3, 5], bones: [2, 3], skel: [0, 1], stacks: [1, 2] } },
    holding: { need: ['cage'], w: 1, magma: { cages: [1, 3], stacks: [1, 2], rocks: [3, 5], bones: [1, 3], skel: [0, 1] } },
  };
  const PROP_W = { chest: 53, coffin: 81, grave: 50, statue: 61, pillar: 81, crystal: 49, cage: 51, rack: 69, bookshelf: 103, table: 59, brazier: 57,
    altar: 67, gold: 96, goldpile: 46, barrel: 45, crate: 48, pot: 32, vase_a: 30, vase_b: 43, vase_c: 30, candlestick: 22, candelabra: 46, torch_stand: 26, crystal_cv: 68,
    stalag_a: 55, stalag_b: 44, boulder_a: 62, boulder_b: 63, wreck_cv: 107, tent_cv: 115, shroom_a: 42, shroom_b: 47, skel_cv: 51,
    basalt_a: 56, basalt_b: 62, boulder_mg_a: 62, boulder_mg_b: 63, obsidian_mg: 68, skel_mg: 51, banner_mg: 70, vent_mg: 53 };
  // and how tall (sizes.js heights): with the width, the sprite's box an item lying behind the prop disappears in
  const PROP_H = { chest: 52, coffin: 51, grave: 51, statue: 117, pillar: 89, crystal: 81, cage: 81, rack: 71, bookshelf: 107, table: 52, brazier: 51,
    altar: 56, gold: 52, goldpile: 32, barrel: 56, crate: 51, pot: 36, vase_a: 60, vase_b: 48, vase_c: 60, candlestick: 60, candelabra: 66, torch_stand: 76, crystal_cv: 84,
    stalag_a: 54, stalag_b: 74, boulder_a: 44, boulder_b: 32, wreck_cv: 50, tent_cv: 80, shroom_a: 40, shroom_b: 56, skel_cv: 44,
    basalt_a: 60, basalt_b: 44, boulder_mg_a: 44, boulder_mg_b: 32, obsidian_mg: 84, skel_mg: 44, banner_mg: 96, vent_mg: 22 };
  const PROP_MAT = { table: 'wood', rack: 'wood', bookshelf: 'wood', coffin: 'wood', shop_shelf: 'wood', shop_barrel: 'wood', shop_crate: 'wood',
    statue: 'stone', pillar: 'stone', grave: 'stone', cage: 'metal', brazier: 'metal', candlestick: 'metal', candelabra: 'metal', torch_stand: 'metal', shop_lantern: 'metal', shop_armor: 'metal', shop_weapons: 'metal',
    crystal: 'crystal', crystal_cv: 'crystal', shop_sacks: 'cloth', shop_gold: 'cloth', fire: 'fire', bones: 'bone',
    stalag_a: 'stone', stalag_b: 'stone', boulder_a: 'stone', boulder_b: 'stone', wreck_cv: 'wood', tent_cv: 'cloth', skel_cv: 'bone',
    basalt_a: 'stone', basalt_b: 'stone', boulder_mg_a: 'stone', boulder_mg_b: 'stone', obsidian_mg: 'crystal', skel_mg: 'bone', banner_mg: 'cloth' };
  const hitUI = (rects, x, y) => rects.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);

  const colossusContact = (e, side = 'R') => ({ x: e.x + e.face * ENEMIES[e.type].h * (side === 'L' ? 0.02 : 0.45), y: e.y });

  const colossusStepAt = (e, i) => {
    const side = i % 2, s = ENEMIES[e.type].h / 320, speed = Math.hypot(e.vx, e.vy) || 1, off = BOSSES[e.type].step * 0.64;
    const ankle = side ? 172.5 : 74.5, foot = side ? 175.18155197657393 : 70.64176829268293, narrow = (123.5 - ankle) * 0.15;
    return { x: e.x + e.face * (foot - 118.5 + narrow) * s + off * e.vx / speed, y: e.y + off * (0.6 * e.vy / speed - 0.3 * Math.abs(e.vy / speed)) };
  };
  root.DATA = { colossusStepAt, colossusContact, TILE, ZOOM, ZOOMS, BIOMES, ARCH, HAZ, hazClock, hazIn, RUNS, runOf, stageOf, rosterAt, CAVE_PACKS, MAGMA_PACKS, DIFF, DIFF_ORDER, floorName, ENEMIES, BOSSES, bossPhase, bossMove, BAL, dmgAt, hpAt, ELITE, eliteK, windOf, under, ELITE_MODS, eliteMods, eliteName, SLOTS, SLOT_NAME, BASES, ITEM_BAL, CONSUMABLES, RARITY, AFFIXES, LEGEND_NAMES,
    ABILITIES, AB_MAX, abRank, SHIELD_T, shieldHp, fireDmg, STATS, META, metaLine, GIFTS, giftCost, xpNeed, SHOP, itemPrice, sellPrice, UI, TEST_RUNS, startPath, hitUI, PROP_MAT, PROP_W, PROP_H, ROOM_PLANS };
  if (typeof module !== 'undefined') module.exports = root.DATA;
})(typeof window !== 'undefined' ? window : globalThis);
