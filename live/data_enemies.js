// live/data_enemies.js — monsters, bosses, elites and their powers, named elites, the colossus's step geometry.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  // enemies: hp, dmg, spd (native px/s), r (body radius), reach (attack range from body edge), wind (telegraph s), cd, xp, kind
  const BOSSES = {
    boss_serpent: { hp: 2200, dmg: 60, scale: 1, phases: [
      { at: 1, moves: ['wave', 'fan', 'bite', 'tail'], rest: 1.35, speed: 0 },
      { at: 0.55, moves: ['fan', 'bite', 'wave', 'tail'], rest: 1.1, speed: 0 }
    ], swim: 1.1, warn: 1, rise: 0.65, dive: 0.6, moves: {
      wave: { wind: 0.85, dmg: 1.1, speed: 300, r: 24, reach: 650, duration: 0.4 },
      fan: { wind: 1, dmg: 0.8, speed: 240, n: 5, spread: 0.8, reach: 620, duration: 0.5 },
      bite: { wind: 0.75, dmg: 1.15, r: 125, arc: 0.7, duration: 0.4 },
      tail: { wind: 1.05, dmg: 1, r: 155, duration: 0.55 }
    } },
    // the queen at 410, not 390: a fireball build burned her in 14 s (TASKS 245)
    boss_spider: { floor: 2, hp: 410, dmg: 21, rig: 'spider', scale: 2.2, phases: [
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
    boss_forge: { floor: 6, hp: 600, dmg: 20, rig: 'brute', scale: 1.7, phases: [
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
    boss_colossus: { hp: 1650, dmg: 33, scale: 1, rise: 2.2, wade: 70, step: 29.80632555187274, phases: [
      { at: 1, moves: ['crack', 'fists', 'boulder', 'charge', 'fists'], rest: 0.9, speed: 1, finishMove: 1 },
      { at: 0.6, moves: ['boulder', 'crack', 'fists', 'charge', 'imps', 'fists'], enter: 'shatter', rest: 0.75, speed: 1.3, finishMove: 1 },
      { at: 0.25, moves: ['rain', 'fists', 'crack', 'boulder', 'fists', 'charge'], enter: 'erupt', rest: 0.75, speed: 1.3 }
    ], moves: {
      crack: { wind: 0.9, dmg: 1.1, len: 480, w: 30, speed: 900, linger: 0.5, duration: 0.65 },
      boulder: { wind: 0.85, dmg: 1.15, r: 56, fly: 0.95, cap: 2, lakeGap: 24, wayGap: 3, apart: 40, pool: { r: 46, ry: 0.6, t: 4.5, dmg: 0.22, per: 0.5 }, duration: 0.45 },
      fists: { wind: 1.0, dmg: 1.3, r: 150, stuck: 1.2, open: 1.4, duration: 0.35 },
      charge: { wind: 0.8, dmg: 1.1, speed: 420, time: 0.7, stop: 50, r: 62, duration: 0.7 },
      shatter: { wind: 1.0, dmg: 0, edge: 1, warn: 1.6, summon: 'imps', duration: 0.5 },
      // (TASKS 466: in the 2nd phase the imps' sparks hit the hero more often than the colossus did, 14 to 10: two at a time and their sparks weaker)
      imps: { wind: 0.7, dmg: 0.65, n: 2, cap: 2, r: 130, hp: 1, type: 'imp', delay: 0.8, duration: 0.4 },
      erupt: { wind: 1.0, dmg: 0, next: 'rain', rest: 0.2, duration: 0.5 },
      rain: { wind: 0.6, dmg: 0.9, n: 24, aimed: 5, time: 3.2, warn: 1.0, r: 42, shelter: 64, duration: 3.4 }
    } },
    // the finale: 20+ s that cost about two healths and two potions; kills 10–20 % of the average players who reach it (TASKS 215,
    // 219, 227): its danger is in the moves and the phases, its health (800-900, 219) only keeps the fight long enough to show all three
    // phases; at 900 the fight ran under 20 s, so the 2nd and 3rd phases rest longer and the 3rd raises a barrier. Its blows are big
    // (most reach the boss's cap), so each mistake costs up to half the health and two in a row kill: 28 killed 8.5 %, 31 killed 15 %
    // at 2.1 potions (the player let the finale cost up to 2.5, TASKS 227); 28 again once the fireball no longer burned it down and
    // the bot read its gear: 31 killed 18.5 % (TASKS 245, 246)
    boss: { hp: 1000, dmg: 35, phases: [
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
    boss_serpent: { name: TXT('ENEMIES.boss_serpent.name'), hp: BOSSES.boss_serpent.hp, dmg: BOSSES.boss_serpent.dmg, spd: 0, r: 28, reach: 60, wind: 0.85, cd: 1.35, xp: 300, kind: 'serpent', h: 154, deep: 1, blood: 'water', rim: [0.45, 0.85, 0.9] },
    boss_colossus: { name: TXT('ENEMIES.boss_colossus.name'), hp: BOSSES.boss_colossus.hp, dmg: BOSSES.boss_colossus.dmg, spd: 44, r: 38, reach: 70, wind: 0.9, cd: 1.6, xp: 400, kind: 'boss', h: 230, val: 1.1, tint: [1.1, 1.04, 0.88, 1], lava: 1, lake: 1, heavy: 1, rim: [1, 0.42, 0.12] },
    boss_forge: { name: TXT('ENEMIES.boss_forge.name'), hp: BOSSES.boss_forge.hp, dmg: BOSSES.boss_forge.dmg, spd: 48, r: 35, reach: 60, wind: 0.8, cd: 1.6, xp: 130, kind: 'boss', h: 190, tint: [0.75, 0.6, 0.6, 0.7], val: 0.6, rim: [1, 0.4, 0.12] },
    boss_necro: { name: TXT('ENEMIES.boss_necro.name'), hp: BOSSES.boss_necro.hp, dmg: BOSSES.boss_necro.dmg, spd: 48, r: 22, reach: 80, wind: 0.7, cd: 1.6, xp: 95, kind: 'boss', h: 139, rim: [0.3, 1, 0.7], tint: [0.3, 1.15, 0.85, 1] },
    boss_spider: { name: TXT('ENEMIES.boss_spider.name'), hp: BOSSES.boss_spider.hp, dmg: BOSSES.boss_spider.dmg, spd: 50, r: 32, reach: 65, wind: 0.7, cd: 1.6, xp: 55, kind: 'boss', h: 117, webImmune: 1, blood: 'ichor', tint: [0.6, 0.6, 1.4, 0.8] },
    skeleton: { name: TXT('ENEMIES.skeleton.name'), hp: 30, dmg: 8, spd: 68, r: 13, reach: 36, wind: 0.52, cd: 1.2, xp: 8, kind: 'melee', h: 76, blood: 'bone' },
    goblin: { name: TXT('ENEMIES.goblin.name'), hp: 20, dmg: 6, spd: 104, r: 10, reach: 28, wind: 0.30, cd: 0.9, xp: 6, kind: 'melee', h: 72, tint: [0.55, 1.2, 0.6, 0.95] },
    spider: { name: TXT('ENEMIES.spider.name'), hp: 18, dmg: 5, spd: 92, r: 15, reach: 76, wind: 0.36, cd: 1.6, xp: 7, kind: 'lunge', h: 53, webImmune: 1, poison: 1, blood: 'ichor', rim: [0.45, 0.65, 1], tint: [0.45, 0.6, 1.35, 0.8] },
    cultist: { name: TXT('ENEMIES.cultist.name'), hp: 26, dmg: 9, spd: 56, r: 13, reach: 305, wind: 0.55, cd: 2.0, xp: 10, kind: 'caster', h: 84, rim: [0.3, 1, 0.62], val: 0.55, tint: [0.3, 1.15, 0.85, 1] },
    ghost: { name: TXT('ENEMIES.ghost.name'), hp: 28, dmg: 7, spd: 60, r: 13, reach: 30, wind: 0.45, cd: 1.3, xp: 9, kind: 'melee', h: 74, ghost: 1, blood: 'ecto' },
    // the drowned (TASKS 307) lies under the shallows (lurk) until the hero comes within `sense`, then rises and wades in: slow, a heavy
    // blow on a long wind-up, and a grab that pulls the hero `grab.pull` px toward it from out of its reach, so the blow can follow
    drowned: { name: TXT('ENEMIES.drowned.name'), hp: 52, dmg: 13, spd: 44, r: 14, reach: 38, wind: 0.8, cd: 1.9, xp: 14, kind: 'melee', h: 82, lurk: 1, sense: 84, rise: 0.9, blood: 'water', rim: [0.5, 0.85, 0.8],
      grab: { reach: 118, wind: 0.55, strike: 0.6, pull: 40, t: 0.22, cd: 5, arc: 0.45 } },
    // the slime (TASKS 308) hops at the hero: a squash on the wind-up, `jump.t` s in the air to where the hero stood, the blow on
    // landing; it splits in two small ones on death (they never split again) and leaves a puddle that slows everyone but slimes.
    // The small ones are raised like a summoner's skeletons (summ): a little XP, no loot, no part in the floor's count
    slime: { name: TXT('ENEMIES.slime.name'), hp: 30, dmg: 8, spd: 40, r: 15, reach: 105, wind: 0.5, cd: 1.5, xp: 9, kind: 'hop', h: 44, blood: 'slime', split: 'slime_s', jump: { t: 0.46, h: 46, land: 0.4 }, puddle: { r: 34, t: 10 } },
    slime_s: { name: TXT('ENEMIES.slime_s.name'), hp: 10, dmg: 4, spd: 52, r: 10, reach: 80, wind: 0.4, cd: 1.3, xp: 2, kind: 'hop', h: 28, blood: 'slime', jump: { t: 0.38, h: 32, land: 0.34 }, puddle: { r: 20, t: 6 } },
    // the armoured crab (TASKS 309) faces its way (fa, rad), turning toward the hero at only `turn` rad/s: a blow, bolt or blast from within
    // `armor.arc` of its front does `armor.k` of its damage. It pinches only what stands in front of it; a hero out to its side at
    // `rush.near`..`rush.reach` px is run down sideways, the shell still facing where it faced
    crab: { name: TXT('ENEMIES.crab.name'), hp: 58, dmg: 11, spd: 46, r: 17, reach: 32, wind: 0.6, cd: 1.6, xp: 15, kind: 'crab', h: 46, blood: 'shell', rim: [0.95, 0.6, 0.45],
      turn: 1.5, armor: { arc: 1.05, k: 0.2, elite: 0.5 }, rush: { near: 24, reach: 150, wind: 0.5, t: 0.42, spd: 380, dmg: 0.8, cd: 4.5 } },
    // the eel from the deep (TASKS 310) lives in a hall's deep water (cell 6) and never leaves it. Under it ('deep') it can't be hurt;
    // with the hero within `sense` px of its water it shows where it will come up (bubbles and a shadow, 'stir', `warn` s), surfaces
    // there by the shore close to him ('rise'), bites (reach) or spits a jet (`spit`) at most `bites` times within `stay` s, and dives
    // ('dive') to come up `swim` s later at least `apart` cells from the last spot. It is no part of a hall's or a floor's count:
    // waiting for it would hold the hero up
    eel: { name: TXT('ENEMIES.eel.name'), hp: 40, dmg: 12, spd: 0, r: 16, reach: 46, wind: 0.5, cd: 0.9, xp: 14, kind: 'eel', h: 100, deep: 1, blood: 'water', rim: [0.45, 0.85, 0.9],
      sense: 290, warn: 0.85, rise: 0.4, stay: 2.6, bites: 2, dive: 0.45, swim: [1.3, 2.3], apart: 3, spit: { reach: 270, wind: 0.6, spd: 330, dmg: 0.8 } },
    // the skeleton archer (TASKS 311) keeps `keep` px off the hero, backing away from one who closes in; it draws for `wind` s (no aim
    // line is drawn, TASKS 338: the draw pose reads the threat), follows the hero until `arrow.lock` s before the loose, and the arrow flies straight at `arrow.spd`
    skel_archer: { name: TXT('ENEMIES.skel_archer.name'), hp: 24, dmg: 9, spd: 74, r: 13, reach: 340, wind: 0.8, cd: 1.9, xp: 10, kind: 'archer', h: 76, blood: 'bone', rim: [0.6, 0.85, 0.45],
      keep: [190, 290], arrow: { spd: 560, lock: 0.28, r: 4 } },
    // the skeleton water mage (TASKS 311) keeps behind another monster from the hero (`behind` px past it) and throws a slow ball of
    // water that slows the hero by `orb.slow` for `orb.t` s
    skel_mage: { name: TXT('ENEMIES.skel_mage.name'), hp: 26, dmg: 8, spd: 58, r: 13, reach: 330, wind: 0.75, cd: 2.6, xp: 11, kind: 'caster', h: 76, blood: 'bone', rim: [0.45, 0.9, 0.95],
      behind: 80, orb: { spd: 150, life: 2.6, r: 10, slow: 0.6, t: 2.5 } },
    // the smouldering skeleton (TASKS 411) runs at the hero alight; within `reach` it lights its fuse (the wind-up) and stands
    // hissing for `wind` s, then bursts. Killed first, its bones burst all the same once the fuse is out (a fuse already lit runs on).
    // The blast hurts the hero within boom.r for dmg × boom.dmg and every monster in it for boom.mon of its own health: a pack the
    // hero draws it into pays for it, and one that catches another sets it off
    skel_ember: { name: TXT('ENEMIES.skel_ember.name'), hp: 18, dmg: 14, spd: 102, r: 13, reach: 24, wind: 0.8, cd: 9, xp: 9, kind: 'bomber', h: 76, blood: 'bone', tex: 'en_skeleton', rim: [1, 0.5, 0.15], tint: [0.85, 0.55, 0.4, 0.8], val: 0.9,
      boom: { r: 92, dmg: 1, mon: 0.35, fuse: 0.8 } },
    // the fire priest (TASKS 410), the summoner of R-22 in the reference's crimson hood at the altar: keeps behind another monster from
    // the hero (`behind`, as the skeleton mage) and works two ways. A ring of fire under the hero (`pyre`): the ring glows `warn` s
    // where he stood when it was cast, then a pillar of fire stands there `burst` s, hurting him once and setting him alight. Every
    // `kindle.every` s (the first `kindle.first` s into the fight) it sets alight the weapons of up to `n` allies within `r` for `t` s:
    // their blows ×`dmg` and set the hero burning
    fire_priest: { name: TXT('ENEMIES.fire_priest.name'), hp: 36, dmg: 12, spd: 54, r: 13, reach: 380, wind: 0.6, cd: 3.4, xp: 16, kind: 'caster', h: 84, tex: 'en_cultist', rim: [1, 0.45, 0.15], val: 1, behind: 90,
      pyre: { r: 54, ry: 0.62, warn: 1.0, burst: 0.45, dmg: 1.1 }, kindle: { every: 8, first: 2.5, r: 280, n: 3, t: 6, dmg: 1.3, wind: 0.7, kinds: ['melee', 'slam', 'lunge', 'crab'] } },
    // the imp (TASKS 407), small and quick, in a pack: the only one the lava never stops. It keeps `keep` px off the hero and throws
    // a spark (`spark`) from where he can't walk to it, leaps (`leap`) over lava and crust to a spot across from him (a cell whose way
    // round on foot is long or none), and leaps away from one who comes within `flee`; cornered with its leap not ready, it claws
    imp: { name: TXT('ENEMIES.imp.name'), hp: 14, dmg: 7, spd: 112, r: 9, reach: 18, wind: 0.32, cd: 1.6, xp: 7, kind: 'imp', h: 54, lava: 1, rim: [1, 0.5, 0.15], tint: [1.05, 0.85, 0.8, 0.5],
      keep: [150, 250], flee: 100, leap: { near: 56, far: 200, spd: 380, h: 0.32, crouch: 0.14, land: 0.2, cd: 1.4, look: 3 },
      spark: { reach: 300, wind: 0.5, lock: 0.12, spd: 290, r: 5, dmg: 0.8 } },
    // the lava salamander (TASKS 408) lives in the lava and hunts on land too, no farther than `tether` cells from it: it swims
    // (×`swim`, only its back and the ripples show), crawls out, bites one close and breathes fire in a cone at one farther off
    // (`breath`: the mouth glows through the wind-up), leaving a burning trail on land (`trail`); under `heal.at` of its health it
    // goes back into the lava and heals there (`heal.rate` of its health a second, not while hit) up to `heal.to`, unless killed first
    salamander: { name: TXT('ENEMIES.salamander.name'), hp: 64, dmg: 12, spd: 60, r: 16, reach: 24, wind: 0.45, cd: 1.4, xp: 16, kind: 'salamander', h: 30, lava: 1, rim: [1, 0.5, 0.2],
      turn: 5, swim: 1.35, tether: 6, breath: { near: 34, reach: 150, arc: 0.42, wind: 0.8, t: 0.7, cd: 4.5, dmg: 0.9 },
      trail: { every: 30, t: 2.4, r: 15, ry: 0.6, dmg: 0.35, per: 1 }, heal: { at: 0.5, to: 0.9, rate: 0.12, calm: 1, cd: 14, most: 7 } },
    // the magma golem (TASKS 409), big and slow in a stone crust: each of its first `crust.n` blows only takes a plate off (×`crust.k`,
    // sparks and a clang); a plate grows back every `crust.regrow` s once no blow has landed for `crust.calm` s and the hero is over
    // `crust.far` px off. It slams both fists on the floor `slam.at` px before it (`slam.r` round); dead, it falls apart into a pool of
    // lava (`pool`) that burns whoever stands in it, once it has spread for `arm` s (TASKS 463: it burnt the one who killed it at once)
    golem: { name: TXT('ENEMIES.golem.name'), hp: 140, dmg: 20, spd: 36, r: 24, reach: 48, wind: 1.0, cd: 2.4, xp: 34, kind: 'golem', h: 124, heavy: 1, rim: [1, 0.45, 0.15],
      crust: { n: 4, k: 0.25, regrow: 1.4, calm: 3, far: 150 }, slam: { r: 82, at: 46 }, pool: { r: 52, ry: 0.6, t: 3.5, dmg: 0.3, per: 0.5, arm: 0.5 } },
    brute: { name: TXT('ENEMIES.brute.name'), hp: 120, dmg: 18, spd: 52, r: 23, reach: 46, wind: 0.7, cd: 2.0, xp: 30, kind: 'slam', h: 112, tint: [1.0, 0.68, 0.72, 0.9] },
    boss: { name: TXT('ENEMIES.boss.name'), hp: BOSSES.boss.hp, dmg: BOSSES.boss.dmg, spd: 48, r: 36, reach: 56, wind: BOSSES.boss.moves.slam.wind, cd: 1.6, xp: 300, kind: 'boss', h: 180 },
  };

  // elites over a regular monster of their kind, brought up to the floor-2 exit guard (the elite demon, kept as it was): hard to
  // kill, quicker on its feet, swings sooner and more often, hits harder and is never knocked back (a knockback per blow kept
  // plain elites from ever swinging). Fewer of them than before: each is a fight of its own. share: chance of a monster from floor 3
  // bolt: an elite caster's bolt,
  // else it took 34–36 % of the health (TASKS 201)
  // crab: the armoured crab's own (TASKS 512): with the full ×8 and ×2.2 behind its shell an elite one cost the player 9 potions on
  // the 10th and outlasted the serpent; its shell lets elite: 0.5 of a blow through, not 0.2, and it never drinks blood
  const ELITE = { hp: 8, dmg: 2.2, spd: 1.3, wind: 0.75, minWind: 0.38, cd: 0.6, bolt: 0.8, share: 0.04, brute: { hp: 2.4, dmg: 1.25, spd: 1.1, wind: 0.85, cd: 1 }, crab: { hp: 4, dmg: 1.6, spd: 1.15, wind: 0.85, cd: 0.8 }, guards: [7], guard: { 7: { hp: 2.2, dmg: 1 } }, deepFrom: 12,
    // exit: the exit room's elite by floor (the 1st's is TASKS 180: the first floors were too easy); on the 1st, at hero level 2, the full elite took 13 % of all runs after 3-5 potions (TASKS 241)
    exit: { 1: { hp: 0.85, dmg: 0.85 } } };
  // the boss is an elite too but keeps its own pace. minWind: an elite's wind-up never ends sooner than this nor sooner than its
  // plain kin's, so every elite blow can be seen and dodged: the elite ghost's 0.34 s took half the deaths of the 3rd floor, the
  // elite skeleton's 0.39 s a fifth (TASKS 246)
  const eliteK = (e, k) => !e.elite ? 1 : BOSSES[e.type] ? ({ spd: 1.1, wind: 0.85 }[k] || 1) : e.type === 'brute' || e.type === 'golem' ? ELITE.brute[k] : e.type === 'crab' ? ELITE.crab[k]
    : k === 'wind' ? Math.max(ELITE.wind, Math.min(1, ELITE.minWind / ENEMIES[e.type].wind)) : ELITE[k];
  // a deep-water monster under the surface (TASKS 310): out of sight and out of reach
  const under = (e) => (!!ENEMIES[e.type].deep && (e.st === 'deep' || e.st === 'stir' || e.st === 'dive' || (e.type === 'boss_serpent' && e.st === 'idle'))) || (!!ENEMIES[e.type].lake && (e.st === 'idle' || e.st === 'emerge'));
  const windOf = (e, w) => w * eliteK(e, 'wind');
  // an elite's powers: one up to floor 3, then one or two, two from floor 6; each is seen in its aura's colour and its name
  const ELITE_MODS = [
    { id: 'fiery', name: TXT('ELITE_MODS.fiery.name'), col: [1.0, 0.42, 0.08], burn: 3 },
    { id: 'vampire', name: TXT('ELITE_MODS.vampire.name'), col: [0.92, 0.08, 0.2], heal: 0.12, not: ['crab'] },
    { id: 'summoner', name: TXT('ELITE_MODS.summoner.name'), col: [0.72, 0.4, 1.0], every: 8, n: 2, cap: 3 },
    { id: 'explosive', name: TXT('ELITE_MODS.explosive.name'), col: [1.0, 0.86, 0.35], fuse: 1.0, r: 110, dmg: 1.0 },
    // deep: only in the endless descent past ELITE.deepFrom (TASKS 387, R-22): something new to meet below the campaign's depth.
    // reflect: a share of each of the hero's blows (not its fire's ticks) comes back to him, never the last of his health;
    // blink: every `every` s, `min`–`max` px off with a clear line, it steps to `gap` px before him and holds its blow `calm` s (melee only);
    // ward: a shield of `share` of its health takes the blows from before it, one from behind breaks it; curse: its blow cuts the hero's for `t` s
    { id: 'reflect', name: TXT('ELITE_MODS.reflect.name'), col: [0.88, 0.92, 1.0], k: 0.1, deep: 1 },
    { id: 'blink', name: TXT('ELITE_MODS.blink.name'), col: [0.2, 0.95, 0.85], every: 6, min: 150, max: 450, gap: 70, calm: 0.7, deep: 1, melee: 1 },
    { id: 'ward', name: TXT('ELITE_MODS.ward.name'), col: [0.3, 0.42, 1.0], share: 0.25, deep: 1 },
    { id: 'curse', name: TXT('ELITE_MODS.curse.name'), col: [0.5, 0.85, 0.2], k: 0.7, t: 3, deep: 1 },
    // frost: its blow slows the hero to `slow` for `t` s (TASKS 477); tug: every `every` s, `min`–`max` px off with a clear line, it
    // warns `warn` s and then draws the hero `n` px toward it over `T` s, short of its own reach; a dash under way slips it (melee only)
    { id: 'frost', name: TXT('ELITE_MODS.frost.name'), col: [0.55, 0.85, 1.0], slow: 0.7, t: 2, deep: 1 },
    { id: 'tug', name: TXT('ELITE_MODS.tug.name'), col: [1.0, 0.5, 0.8], every: 7, min: 130, max: 320, warn: 0.6, n: 120, T: 0.35, deep: 1, melee: 1 },
  ];
  const eliteMods = (f) => (f >= 6 ? [2, 2] : f >= 4 ? [1, 2] : [1, 1]);
  const modPool = (mode, f, kind) => ELITE_MODS.filter((m) => (!m.deep || (D.RUNS[mode] && D.RUNS[mode].endless && f > ELITE.deepFrom)) && !(m.melee && (kind === 'caster' || kind === 'archer')) && !(m.not && m.not.includes(kind))).map((m) => m.id);
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
  // arch: the floor archetype (dungeon.js; the campaign's rooms and corridors by default); size: each floor's map in cells, growing with the run (the campaign's own floors too, TASKS 373: 56×42 on the 1st two to 84×64 on the 8th, with rooms, the room count's range on each; its secret caches grow with the map's area over 72×54's). Its kit matches what the average bot wears entering the 8th: all eight slots, mostly epic
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

  const FEM = new Set(['salamander', 'boss_spider']), femAdj = (w) => TXT.fem(w);
  const eliteName = (e) => e.title || [...(e.mods || []).map((id) => ELITE_MODS.find((m) => m.id === id).name).map((w) => (FEM.has(e.type) ? femAdj(w) : w)), ENEMIES[e.type].name]
    .map((w, i) => (i ? w.toLowerCase() : w)).join(' ');

  const NAMED = { hp: 1.3, titles: [TXT('NAMED.titles'), TXT('NAMED.titles.2'), TXT('NAMED.titles.3'), TXT('NAMED.titles.4'), TXT('NAMED.titles.5'), TXT('NAMED.titles.6'), TXT('NAMED.titles.7'), TXT('NAMED.titles.8')] };

  const colossusContact = (e, side = 'R') => ({ x: e.x + e.face * ENEMIES[e.type].h * (side === 'L' ? 0.02 : 0.45), y: e.y });

  const colossusStepAt = (e, i) => {
    const side = i % 2, s = ENEMIES[e.type].h / 320, speed = Math.hypot(e.vx, e.vy) || 1, off = BOSSES[e.type].step * 0.64;
    const ankle = side ? 172.5 : 74.5, foot = side ? 175.18155197657393 : 70.64176829268293, narrow = (123.5 - ankle) * 0.15;
    return { x: e.x + e.face * (foot - 118.5 + narrow) * s + off * e.vx / speed, y: e.y + off * (0.6 * e.vy / speed - 0.3 * Math.abs(e.vy / speed)) };
  };

  Object.assign(D, { BOSSES, bossPhase, bossMove, ENEMIES, ELITE, eliteK, under, windOf, ELITE_MODS, eliteMods, modPool, eliteName, NAMED, colossusContact, colossusStepAt });
})(typeof window !== 'undefined' ? window : globalThis);
