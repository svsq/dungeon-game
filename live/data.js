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
    // are the dungeon's with the drowned, the slime, the crab and the eel (TASKS 307-310); the rest and the packs by floor are TASKS 311-312
    cave: { name: 'Затопленные пещеры', rock: [0.006, 0.006, 0.009], water: [0.06, 0.1, 0.12], vein: [0.3, 0.7, 0.8, 0], amb: [0.06, 0.075, 0.11], ambK: 0.6, torch: [1.0, 0.62, 0.26],
      shroom: [0.2, 0.85, 0.78], gem: [0.32, 0.62, 1.0], floor: 'floor_cv_tex', wall: 'wall_cv_tex', top: 'walltop_cv_tex', shore: 'shore_cv_tex',
      cave: true, tint: [1, 1, 1], roster: ['skeleton', 'goblin', 'spider', 'drowned', 'slime', 'crab', 'eel'], props: ['stalag_a', 'stalag_b', 'boulder_a', 'boulder_b', 'skel_cv', 'wreck_cv', 'tent_cv'] },
  };

  // enemies: hp, dmg, spd (native px/s), r (body radius), reach (attack range from body edge), wind (telegraph s), cd, xp, kind
  const BOSSES = {
    boss_spider: { floor: 2, hp: 390, dmg: 18, rig: 'spider', scale: 2.2, phases: [
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
    // the finale: 20+ s that cost about two healths and two potions; kills 10–20 % of the average players who reach it (TASKS 215,
    // 219, 227): its danger is in the moves and the phases, its health (800-900, 219) only keeps the fight long enough to show all three
    // phases; at 900 the fight ran under 20 s, so the 2nd and 3rd phases rest longer and the 3rd raises a barrier. Its blows are big
    // (most reach the boss's cap), so each mistake costs up to half the health and two in a row kill: 28 killed 8.5 %, 31 kills 15 %
    // at 2.1 potions (the player let the finale cost up to 2.5, TASKS 227)
    boss: { hp: 900, dmg: 31, phases: [
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
  const BAL = { pop: 0.5, hp: 1.6, dmg: 2.15, reward: 2, startHpPot: 3, spike: 0.12, dmgUp: 0.4, dmgLate: 0.27, earlyCd: 0.85, early: 3, dodge: { agi: 0.25, cap: 40, dash: 0, t: 0.22 }, cap: { blow: 0.33, boss: 0.5 } };
  const dmgAt = (f, boss) => 1 + BAL.dmgUp * (f - 1) + (boss ? 0 : BAL.dmgLate * Math.max(0, f - 5));
  // difficulty presets, picked in the main menu for a new campaign: damage to the hero (monsters and traps), monster HP, experience
  // the balance is tuned on normal; easy and hard only scale the monsters' blows and health by one factor each (TASKS 154)
  const DIFF = { easy: { name: 'Лёгкая', dmg: 0.75, hp: 0.75, xp: 1 }, normal: { name: 'Нормальная', dmg: 1, hp: 1, xp: 1 }, hard: { name: 'Тяжёлая', dmg: 1.3, hp: 1.25, xp: 1 } };
  const DIFF_ORDER = ['easy', 'normal', 'hard'];
  // elites over a regular monster of their kind, brought up to the floor-2 exit guard (the elite demon, kept as it was): hard to
  // kill, quicker on its feet, swings sooner and more often, hits harder and is never knocked back (a knockback per blow kept
  // plain elites from ever swinging). Fewer of them than before: each is a fight of its own. share: chance of a monster from floor 3
  // bolt: an elite caster's bolt,
  // else it took 34–36 % of the health (TASKS 201)
  const ELITE = { hp: 8, dmg: 2.2, spd: 1.3, wind: 0.75, cd: 0.6, bolt: 0.8, share: 0.04, brute: { hp: 2.4, dmg: 1.25, spd: 1.1, wind: 0.85, cd: 1 },
  };
  // the boss is an elite too but keeps its own pace
  // a deep-water monster under the surface (TASKS 310): out of sight and out of reach
  const under = (e) => !!ENEMIES[e.type].deep && (e.st === 'deep' || e.st === 'stir' || e.st === 'dive');
  const eliteK = (e, k) => !e.elite ? 1 : BOSSES[e.type] ? ({ spd: 1.1, wind: 0.85 }[k] || 1) : e.type === 'brute' ? ELITE.brute[k] : ELITE[k];
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
  // The water caves are a run of their own until the story joins them to the campaign (R-27): four floors and their boss for a
  // hero of level 10, who in the campaign enters the 8th (TASKS 300); until its serpent exists the forge lord holds the 4th.
  // arch: the floor archetype (dungeon.js; the campaign's rooms and corridors by default); size: each floor's map in cells, growing with the run. Its kit matches what the average bot wears entering the 8th: all eight slots, mostly epic
  const RUNS = {
    campaign: { name: 'Кампания', floors: 8, depth: 0, lvl: 1, biome: (f) => (f <= 2 ? 'dungeon' : f <= 4 ? 'crypt' : f <= 6 ? 'lava' : 'arcane'),
      boss: (f) => (f === 8 ? 'boss' : Object.keys(BOSSES).find((k) => BOSSES[k].floor === f)), guard: { 7: { hp: 2.2, dmg: 1 } }, exit: { 1: { hp: 0.85, dmg: 0.85 } },
      last: 'Трон Демона', seal: 'Сначала одолейте Повелителя Демонов' },
    cave: { name: 'Затопленные пещеры', floors: 4, depth: 6, lvl: 10, arch: 'cave', size: [[72, 54], [80, 60], [88, 66], [88, 66]], biome: () => 'cave', boss: (f) => (f === 4 ? 'boss_forge' : undefined), guard: { 3: { hp: 2.2, dmg: 1 } }, exit: {}, title: 'Затопленные пещеры',
      kit: { lvl: 6, gear: [['longsword', 3], ['shield', 3], ['knight_helm', 3], ['plate_armor', 3], ['gauntlets', 3], ['iron_boots', 2], ['ring', 2], ['amulet', 3]], hp: 5, mp: 2, gold: 400 }, seal: 'Сначала одолейте хозяина пещер' },
  };
  const runOf = (mode) => RUNS[mode] || RUNS.campaign;
  const floorName = (f, mode) => { const N = runOf(mode); return N.last && f === N.floors ? N.last : N.title || BIOMES[N.biome(f)].name; };
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

  const ABILITIES = [
    { id: 'whirl', name: 'Вихрь клинка', icon: 'ab_whirl', key: '1', unlock: 1, mp: 0, cd: 6, desc: 'Круговой удар: {d}% атаки всем рядом' },
    { id: 'fireball', name: 'Огненный шар', icon: 'ab_fire', key: '2', unlock: 2, mp: 12, cd: 0.5, desc: 'Огненный взрыв: {d} урона' },
    { id: 'shield', name: 'Магический щит', icon: 'ab_shield', key: '3', unlock: 4, mp: 30, cd: 16, desc: 'Барьер на 10 с: {d} урона' },
  ];
  // ten ranks at half the old per-rank gain: rank 10 lands a little past the old rank-5 cap instead of 1.7× it
  const AB_MAX = 10;
  const abRank = (id, r) => { const n = Math.max(0, r - 1);
    return id === 'whirl' ? { k: 1.6 + 0.125 * n, cd: 1 - 0.04 * n, r: 118 + 6 * n } : id === 'fireball' ? { k: 1 + 0.125 * n, cd: 1 } : { k: 1 + 0.15 * n, cd: 1 }; };
  // about one elite's blow anywhere (TASKS 179), but slower to grow than the blows: INT, rank and floor all multiplied in made it
  // a second life bar, 688 on floor 8 against the hero's 588 (TASKS 199)
  const SHIELD_T = 10, shieldHp = (int, r, f) => Math.round((24 + int * 2) * abRank('shield', r).k * (1 + 0.2 * (f - 1)));
  // half the monsters' health growth per floor: without it a strength build stopped casting by mid-dungeon (TASKS 203)
  const fireDmg = (int, k, spell, f) => Math.round((14 + int * 2.6) * k * spell * (1 + 0.25 * (f - 1)));
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
  const UI = {
    menu: (hasRun, diff, arm, zoom) => {
      // arm: the run whose button was pressed once over a saved run (a second press drops the save)
      const run = (id, fresh, again) => [id, !hasRun ? fresh : arm === id ? 'Точно сбросить забег?' : again, true];
      const items = [['continue', 'Продолжить забег', hasRun], run('campaign', 'Кампания — 8 этажей', 'Новая кампания (сброс)'), run('cave', 'Затопленные пещеры — 4 этажа', 'Пещеры заново (сброс)'), ['diff', 'Сложность: ' + DIFF[diff || 'normal'].name, true],
        ['zoom', 'Масштаб: ' + zoomName(zoom), true], ['meta', 'Алтарь душ', true]];
      return items.map(([id, label, on], i) => ({ id, label, on, x: 720, y: 440 + i * 86, w: 480, h: 72 }));
    },
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
  };
  const PROP_W = { chest: 53, coffin: 81, grave: 50, statue: 61, pillar: 81, crystal: 49, cage: 51, rack: 69, bookshelf: 103, table: 59, brazier: 57,
    altar: 67, gold: 96, goldpile: 46, barrel: 45, crate: 48, pot: 32, vase_a: 30, vase_b: 43, vase_c: 30, candlestick: 22, candelabra: 46, torch_stand: 26, crystal_cv: 68,
    stalag_a: 55, stalag_b: 44, boulder_a: 62, boulder_b: 63, wreck_cv: 107, tent_cv: 115 };
  // and how tall (sizes.js heights): with the width, the sprite's box an item lying behind the prop disappears in
  const PROP_H = { chest: 52, coffin: 51, grave: 51, statue: 117, pillar: 89, crystal: 81, cage: 81, rack: 71, bookshelf: 107, table: 52, brazier: 51,
    altar: 56, gold: 52, goldpile: 32, barrel: 56, crate: 51, pot: 36, vase_a: 60, vase_b: 48, vase_c: 60, candlestick: 60, candelabra: 66, torch_stand: 76, crystal_cv: 84,
    stalag_a: 54, stalag_b: 74, boulder_a: 44, boulder_b: 32, wreck_cv: 50, tent_cv: 80 };
  const PROP_MAT = { table: 'wood', rack: 'wood', bookshelf: 'wood', coffin: 'wood', shop_shelf: 'wood', shop_barrel: 'wood', shop_crate: 'wood',
    statue: 'stone', pillar: 'stone', grave: 'stone', cage: 'metal', brazier: 'metal', candlestick: 'metal', candelabra: 'metal', torch_stand: 'metal', shop_lantern: 'metal', shop_armor: 'metal', shop_weapons: 'metal',
    crystal: 'crystal', crystal_cv: 'crystal', shop_sacks: 'cloth', shop_gold: 'cloth', fire: 'fire', bones: 'bone',
    stalag_a: 'stone', stalag_b: 'stone', boulder_a: 'stone', boulder_b: 'stone', wreck_cv: 'wood', tent_cv: 'cloth', skel_cv: 'bone' };
  const hitUI = (rects, x, y) => rects.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);

  root.DATA = { TILE, ZOOM, ZOOMS, BIOMES, RUNS, runOf, DIFF, DIFF_ORDER, floorName, ENEMIES, BOSSES, bossPhase, bossMove, BAL, dmgAt, ELITE, eliteK, under, ELITE_MODS, eliteMods, eliteName, SLOTS, SLOT_NAME, BASES, ITEM_BAL, CONSUMABLES, RARITY, AFFIXES, LEGEND_NAMES,
    ABILITIES, AB_MAX, abRank, SHIELD_T, shieldHp, fireDmg, STATS, META, metaLine, GIFTS, giftCost, xpNeed, SHOP, itemPrice, sellPrice, UI, hitUI, PROP_MAT, PROP_W, PROP_H, ROOM_PLANS };
  if (typeof module !== 'undefined') module.exports = root.DATA;
})(typeof window !== 'undefined' ? window : globalThis);
