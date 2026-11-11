// live/data_world.js — biomes, floor archetypes, hazards, cave and magma packs, room shapes and plans, props' sizes and materials.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { TILE } = D;
  // rock, vein: the rock past the dungeon and under the fog of war (scene.js LIT) and the faint veins glowing in it [r, g, b, strength];
  // water: the colour of its shallow pools (scene.js WATER); seam: how much the wall tops' joints smoulder in the vein colour;
  // fill: the light an accent room of this biome is flooded with; dim: how much darker its pale floor stone is laid as an accent zone, so its light reads as pools
  const BIOMES = {
    dungeon: { name: TXT('BIOMES.dungeon.name'), rock: [0.008, 0.005, 0.008], water: [0.07, 0.1, 0.12], vein: [1.0, 0.4, 0.12, 0], amb: [0.11, 0.09, 0.10], torch: [1.0, 0.62, 0.26], floor: 'floor_d_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [1, 1, 1], roster: ['skeleton', 'goblin', 'spider'], props: ['rack', 'bookshelf', 'cage', 'statue', 'rack'] },
    crypt: { name: TXT('BIOMES.crypt.name'), rock: [0.008, 0.005, 0.008], water: [0.06, 0.11, 0.08], vein: [0.4, 1.0, 0.5, 0], amb: [0.07, 0.11, 0.09], torch: [0.35, 1.0, 0.4], fill: 0.08, floor: 'floor_c_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [0.86, 0.98, 0.9], roster: ['skeleton', 'cultist', 'ghost', 'spider'], props: ['coffin', 'grave', 'statue', 'pillar', 'grave'] },
    lava: { name: TXT('BIOMES.lava.name'), rock: [0.008, 0.005, 0.008], vein: [1.0, 0.38, 0.08, 0.02], seam: 1.4, amb: [0.14, 0.07, 0.05], torch: [1.0, 0.45, 0.16], floor: 'floor_l_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [1.04, 0.9, 0.84], roster: ['goblin', 'skeleton', 'cultist', 'brute'], lava: true, props: ['pillar', 'cage', 'rack', 'statue'] },
    arcane: { name: TXT('BIOMES.arcane.name'), rock: [0.008, 0.005, 0.008], water: [0.06, 0.09, 0.18], vein: [0.35, 0.6, 1.0, 0], amb: [0.07, 0.08, 0.14], torch: [0.16, 0.38, 1.0], fill: 0.06, dim: 0.75, floor: 'floor_a_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [0.68, 0.78, 1.12], roster: ['ghost', 'skeleton', 'cultist', 'brute'], props: ['crystal', 'statue', 'bookshelf', 'crystal', 'pillar'] },
    // cave: natural rock instead of masonry (scene.js caveBake, TASKS 303), lit cold (305): its own light is the mushrooms' (shroom)
    // and the crystals' (gem) glow, fire only by the camp and the merchant; ambK: how much of the dark's colour is the biome's
    // ambient rather than the common cool one; its props (TASKS 306) dress its halls to the ROOM_PLANS that have `cave`; its monsters
    // are the dungeon's with the drowned, the slime, the crab, the eel and the skeleton archer and mage (TASKS 307-311); from: the run's
    // first floor of a kind (TASKS 312), so each floor brings its own: the drowned and the slimes, then the crabs before the archers,
    // then the eels in the lakes and the mages
    cave: { name: TXT('BIOMES.cave.name'), rock: [0.006, 0.006, 0.009], water: [0.06, 0.1, 0.12], vein: [0.3, 0.7, 0.8, 0], amb: [0.098, 0.095, 0.1], ambK: 0.9, torch: [1.0, 0.62, 0.26],
      shroom: [0.28, 0.72, 0.76], gem: [0.32, 0.62, 1.0], floor: 'floor_cv_tex', wall: 'wall_cv_tex', top: 'walltop_cv_tex', shore: 'shore_cv_tex',
      cave: true, tint: [1, 1, 1], roster: ['skeleton', 'goblin', 'spider', 'drowned', 'slime', 'crab', 'eel', 'skel_archer', 'skel_mage'],
      from: { crab: 2, skel_archer: 2, eel: 3, skel_mage: 3 }, props: ['stalag_a', 'stalag_b', 'boulder_a', 'boulder_b', 'skel_cv', 'wreck_cv', 'tent_cv'] },
    // the magma caves (R-36, TASKS 399): a run of their own after the campaign's 12th, laid out as plateaus over lava and a chasm (400).
    // Their ash, basalt and crust are baked by scene.js MAGMA (TASKS 402); old: the kinds a cave pack fills its halls with
    // low and floorK lift the ground halfway to the concept's (TASKS 435, the player's choice): all the way, a priest's ring and
    // the other red telegraphs on the floor stop reading
    magma: { name: TXT('BIOMES.magma.name'), rock: [0.008, 0.005, 0.005], water: [0.06, 0.1, 0.12], vein: [1.0, 0.38, 0.08, 0.02], amb: [0.14, 0.07, 0.05], ambK: 0.9, ambLvl: 0.48, torchR: 0.72, low: [1.05, 0.8, 0.74], floorK: 1.14, torch: [1.0, 0.45, 0.16],
      shroom: [1.0, 0.45, 0.16], gem: [1.0, 0.38, 0.1], floor: 'floor_mg_tex', wall: 'wall_mg_tex', top: 'walltop_mg_tex', shore: 'shore_mg_tex',
      cave: true, tint: [1.04, 0.9, 0.84], roster: ['skeleton', 'goblin', 'brute', 'cultist', 'skel_archer', 'skel_ember', 'fire_priest', 'imp', 'salamander', 'golem'], old: ['skeleton', 'goblin', 'brute', 'cultist'], packs: 'MAGMA_PACKS',
      from: { cultist: 2, skel_ember: 2, imp: 2, brute: 3, fire_priest: 3, salamander: 1, golem: 3 }, props: ['basalt_a', 'basalt_b', 'boulder_mg_a', 'boulder_mg_b', 'skel_mg', 'obsidian_mg', 'banner_mg', 'cage'] },
    // the start town (R-17, TASKS 1002, 1004, 1005): a safe courtyard over the crypt, floor 0 of a run; earth with grass, cobbles on the square
    // and its paths; ambLvl: the open yard is half lit between its fires (the concept's median L ≈ 19, the dungeon's dark is ≈ 11), its fire the
    // concept's yellow-orange, not the dungeon's red; neutral between the pools, so the pools stand out of it; fireK: its fires' strength
    town: { name: TXT('BIOMES.town.name'), rock: [0.008, 0.005, 0.008], water: [0.07, 0.1, 0.12], vein: [1.0, 0.4, 0.12, 0], amb: [0.17, 0.157, 0.17], ambK: 0.65, ambLvl: 1.0, fireK: 1.1, bigK: 0.76, torch: [1.0, 0.62, 0.3], torchR: 0.55, spill: [1.1, 0.35], topLift: 1.3, floorG: 1.3, wallG: [0.9, 0.9, 0, 1.05], floor: 'floor_tw_tex', pave: 'pave_tw_tex', wall: 'wall_tw_tex', top: 'walltop_tw_tex',
      tint: [1, 1, 1], roster: [], props: [], town: true },
  };

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
      // the lake's choice (TASKS 472): the islands chain across its short axis (`axis`: across its long one the way round was as
      // short), the start and the stairs past its two ends, the shore's plateaus a ring round it; save: the share of the walk round
      // the islands save ([least, most], the critic's 30–40 %), loose: the band once the strict tries are spent; path: the walk over
      // the islands, the floor's least
      // arena (TASKS 413): the magma caves' last hall, a broad ring of plateau round a lake of lava, w × h cells; the lake's half-axes
      // (lake) leave the ring wide enough for the colossus; a row of basalt slabs crosses the lake the short way (the hero may cut over,
      // the colossus is too broad for it); cover: basalt slabs standing on the ring, solid, stopping bolts
      arena: { w: 28, h: 20, lake: [7, 4.3], rag: 0.25, cover: 5 },
      // river (428): a wide winding river of lava across the map from edge to edge, `w` cells wide, its middle at `at` of the
      // height, swinging `amp` of it over `waves` bends; it widens round an island (`isle` cells, the hoard's) at `isleAt` of the
      // width; `cross`: the ways over it the plateaus on its banks keep (the island's included), spread along it; path: the least
      // walk to the stairs, 0.85 of the plain floor's (the ways over cut it short)
      river: { pop: 0.52, choice: 1.3, loose: 1.45, w: [5, 7], at: [0.44, 0.58], amp: [0.07, 0.12], waves: [1.1, 2], isle: [[9, 12], [6, 8]], isleAt: [0.3, 0.7], margin: 2, cross: [2, 3], path: [0, 90, 95, 0], share: [0.3, 0.6] },
      // chasm (429): the plateaus stand `gap` cells apart over the black chasm, no lava along their edges or in the gaps between (a
      // lake of it deep down, `lakes`), joined by narrow ridges bent less than the plain floor's (`ridge`), their straight runs chain
      // bridges over the dark but a share `neck` of them left a neck of rock
      chasm: { pop: 0.58, gap: [6, 5], plat: [[13, 20], [10, 14]], small: [[8, 11], [7, 9]], grow: [22, 16], ridge: { w: [2, 3], bend: [0, 0.6] }, neck: 0.25, lakes: 1, share: [0.02, 0.3],
        // alt (TASKS 1054): the second way over a bridge the walk can't go round: a deck `len` cells long, `off` cells and more off it
        alt: { off: 7, len: [3, 32], max: 3 } },
      // terrace (430): a lavafall down the top wall near one side of the map (`fallAt` of the width from it, the wall `wall` rows high
      // there) runs down to the bottom as a river `w` cells wide; on the wide side terraces step down, rows `rowH` high with `step`
      // rows of lava between, each `per` plateaus side by side, a row joined to the next at its one end and that to the next at
      // its other (a serpentine), its other end a share `short` of the width short; `branch` plateaus on the narrow side over the
      // river hang off the nearest terrace; rag, edge: their edges more ragged than the plain floor's
      // ledges (TASKS 433): small pads past the rows' short ends and over the river, dead ends off the serpentine
      // stepKeep (TASKS 475): the share of the longest stretch two rows run over together kept rock, a step down rather than lava
      // (TASKS 432) a row may be a narrow ridge (`ridgeRow`: its chance, height, plateaus in it) or a broad field (`broadRow`, one
      // a floor at most: two left too few rows for the walk to the stairs); never one plateau a row, which cut the walk short
      terrace: { pop: 0.49, stepKeep: 0.6, fallAt: [0.18, 0.26], wall: 7, w: [4, 5], rowH: [8, 11], step: [3, 5], per: [2, 4], ridgeRow: { p: 0.3, h: [4, 5], per: [2, 3] }, broadRow: { p: 0.15, h: [11, 12], per: [2, 3] }, short: [0.12, 0.3], branch: [1, 2], ledges: [2, 3], margin: 2, rag: 1.8, edge: [1, 4], path: [148, 168, 211, 0], share: [0.25, 0.68] },
      // cave (431): halls in the rock and long winding tunnels, as the water caves' are, the water lava: lakes in the rock on the
      // way between halls, a pool in a hall or two (`pools` at most) and streams across the tunnels; its share of the floor `goal`;
      // pop: its halls are more than a floor's plateaus, each with its pack: as many monsters a floor as the plateaus'
      // loop (TASKS 1726): `n` tunnels more between halls `hops` and more apart on the tree and under `d` cells apart, each kept if no two
      // halls' walk falls under `keep` of what it was
      cave: { goal: [0.1, 0.16], pools: 3, pop: 0.415, path: [0, 0, 0, 0], share: [0.06, 0.3], loop: { n: [2, 3], hops: 3, d: 40, keep: 0.85 },
        mix: { arena: { n: [1, 2], box: [[16, 20], [12, 15]], pop: 1.5 }, ledge: { n: [3, 4], box: [[6, 8], [5, 7]], pop: 0.6 } } },
      // first: the type of a run's first floor (the player's call 04.11.2026: the caves first, a lake's archers over the lava were too
      // much for the first floor)
      types: ['plain', 'lake', 'river', 'chasm', 'terrace', 'cave'], first: 'cave',
      // guard (TASKS 1729): a lava cave's only spike plates, `n` at most, each on the way in to a reward `far` cells off it
      guard: { n: 2, far: [3, 8] },
      // stub (TASKS 1730): the wall raised behind the stairs up on a floor with no top wall near the start, `w` cells either side of
      // them and `deep` rows of rock, within `far` cells of the start room
      stub: { w: [2, 1], deep: 4, far: 10 },
      // a floor's title by its type (TASKS 471), so the player knows which question the floor asks; the boss's floor keeps its run's
      names: { plain: TXT('ARCH.plateau.names.plain'), lake: TXT('ARCH.plateau.names.lake'), river: TXT('ARCH.plateau.names.river'), chasm: TXT('ARCH.plateau.names.chasm'), terrace: TXT('ARCH.plateau.names.terrace'), cave: TXT('ARCH.plateau.names.cave') },
      // mix (TASKS 426): a floor of one of the figure types `over` takes the type `with` too, with the chance p, never on two floors running; riverBridges: the bridges over the chasm a river floor keeps at the least (its plateaus lie in two strips, the river on one side of each, so fewer face each other over the dark); gap: the plateaus' spacing then (the chasm's own left the ledges no room); pathKeep: the share of the figure's walk to the stairs kept (the bridges cut it)
      blend: { p: 0.35, over: ['lake', 'river', 'terrace'], with: 'chasm', gap: [4, 4], pathKeep: 0.75, riverBridges: 1 }, lake: { pop: 0.47, save: [0.3, 0.4], loose: [0.2, 0.5], path: [0, 60, 68, 0], axis: 'short', fig: [[0.3, 0.35], [0.26, 0.31]], at: [[0.46, 0.54], [0.52, 0.56]], isles: [2, 3],
        isle: [[[12, 15], [9, 11]], [[8, 10], [6, 8]], [[5, 7], [5, 6]]], margin: 2, plat: [[11, 16], [8, 11]], small: [[7, 10], [6, 8]], grow: [18, 13],
        islet: 1, share: [0.4, 0.66],
        mix: { arena: { n: [1, 1], box: [[16, 20], [10, 13]], grow: [22, 15], pop: 1.4 }, ridge: { n: [2, 3], box: [[14, 20], [4, 5]], grow: [22, 6], tall: 0.3, edge: [0, 1.5], rag: 0.7, pop: 0.8 },
          ledge: { n: [3, 5], box: [[6, 7], [5, 6]], grow: [8, 7], edge: [0, 1.2], rag: 0.6, pop: 0.5 } } },
      lava: { lakeCells: 1400, lake: [[5, 10], [4, 7]], lakeOff: [3, 8], lakeApart: 16, lakeMin: 20, river: [3, 5], bridge: 0.7, ridgeCost: 30, near: 4, dark: 9, falls: [1, 2], fallApart: 18, fallDeep: 3, vents: [0, 1], join: 0.8, joinMax: 40, isle: 0.62, crust: 0.3, share: [0.2, 0.4],
        // a hoard's islet (TASKS 476): a pad of floor (`pad` cells) out in the open lava, `ring` cells of it all round, its only way a
        // strip of thin crust two cells wide `len` cells long to the nearest plateau; `n` a floor
        islet: { pad: [3, 3], ring: 1, len: [4, 9], n: 1 },
        // alt (TASKS 1722): on a cave or terrace floor the second way over a lava crossing the walk can't go round: slabs two cells
        // wide over `len` cells of lava, `off` cells and more off it (`wide` and more if the walk allows), `max` a floor; the walk keeps
        // `keep` of its length
        alt: { off: 3, wide: 6, len: [1, 9], max: 2, keep: 0.8,
          // dry (TASKS 1726): on a cave floor a tunnel round a crossing, its mouths `off` cells from it, `len` cells at most, `max` a floor, the
          // way round `more` cells longer than the way over at the least
          dry: { off: [3, 10], len: 48, max: 3, more: 6 } } } },
    // the rooms-and-corridors floors' layouts (TASKS 379), each a set of knobs on the one generator (dungeon.js): room, the room count
    // of the floor's range taken (min: fewest a floor is laid with); rect, a plain room's size (cells, else by the map); shapes, the
    // shapes' weights over ROOM_SHAPES; gap, the rock kept between rooms; bends, the corridor length (cells) past which it takes one
    // bend and two; off, a bend's distance off the straight line; wide, the share of corridors three cells wide; loops, extra links
    // between rooms nearer than [0] cells, each with the chance [1]; nooks, dead-end nooks; pop, the monsters a room holds; grid, a
    // catacomb's chambers, all one size (cell) on a grid (step), joined to their neighbours only; minW, the narrowest map it is laid on; big, the first [0] rooms laid as plain
    // rooms of [1]×[2] (the merchant's and the stairs' room want one)
    rooms: { name: TXT('ARCH.rooms.name'), room: 1, gap: [2, 3], bends: [16, 30], off: [2, 4], wide: 0.25, loops: [26, 0.28], nooks: [1, 2], pop: 1 },
    maze: { name: TXT('ARCH.maze.name'), room: 1.3, rect: [[5, 8], [4, 6]], big: [2, [9, 11], [7, 8]], shapes: { rect: 50, L: 14, T: 10, cross: 6, closet: 14, gallery: 6 }, gap: [3, 4], bends: [8, 18], off: [2, 5], wide: 0, loops: [30, 0.45], nooks: [3, 5], pop: 0.8 },
    hall: { name: TXT('ARCH.hall.name'), room: 0.45, min: 6, minW: 64, rect: [[12, 16], [9, 12]], shapes: { rect: 20, hall: 30, round: 16, colonnade: 16, pit: 12, cross: 6 }, gap: [3, 4], bends: [24, 40], off: [2, 3], wide: 0.7, loops: [34, 0.2], nooks: [0, 1], pop: 1.7 },
    catacomb: { name: TXT('ARCH.catacomb.name'), room: 1.4, grid: { cell: [8, 6], step: [11, 9] }, gap: [2, 2], bends: [99, 99], off: [0, 0], wide: 0, loops: [12, 0.35], nooks: [1, 2], pop: 0.7 },
    // a fortress (TASKS 380): a courtyard (court: w × h) in the middle of the map behind `moat` cells of rock and a ring of corridor
    // `ring` cells wide, `gates` ways from the ring into it; the other rooms stand outside the ring and join it, not the court; the
    // court holds the floor's altar (chance `altar`) or a pack round an elite; the start and the stairs lie outside
    fortress: { name: TXT('ARCH.fortress.name'), room: 0.85, min: 6, minW: 72, court: { w: [14, 18], h: [10, 12], moat: 3, ring: 2, gates: 2, altar: 0.4 }, gap: [2, 3], bends: [16, 30], off: [2, 4], wide: 0.25, loops: [26, 0.2], nooks: [1, 2], pop: 1 },
    // a tomb (TASKS 378): no corridors at all, the rooms wall to wall as in a crypt: the map cut in two again and again (bsp: a
    // room's size between min and max, walls of two cells between), a patch of the pieces kept, each joined to its neighbours only,
    // by a way two cells wide through the wall between them (the doors of 77 stand in them)
    tomb: { name: TXT('ARCH.tomb.name'), room: 1.15, minW: 56, bsp: { min: [6, 5], max: [12, 10] }, gap: [2, 2], bends: [99, 99], off: [0, 0], wide: 0, loops: [99, 0.3], nooks: [0, 0], pop: 0.9 },
    // which layout a floor takes (TASKS 379): by its biome's weights, from its own floor on (`from`), never the one of the floor before;
    // a run's 1st floor and a boss's floor keep the plain rooms
    lay: { dungeon: { rooms: 3, maze: 2 }, crypt: { rooms: 2, catacomb: 3, hall: 1, maze: 1, fortress: 1, tomb: 3 }, lava: { rooms: 2, hall: 2, maze: 2, fortress: 1 }, arcane: { rooms: 2, hall: 2, catacomb: 1, maze: 1, fortress: 2, tomb: 1 } },
    layFrom: { maze: 2, hall: 3, catacomb: 3, fortress: 3, tomb: 3 },
  };
  // a floor's modifier (R-18, TASKS 381), drawn with `chance` from the `from`th floor on a rooms floor that is no boss's, shown on
  // the banner and the minimap. water: the streams' cap over the plain two (≈×2 laid: a stream wants a plain fighting room); torch:
  // the share of a room's own wall torches kept, none hung for a dark corner (≈40 % of a plain floor's); light: the hero's lamp; dim, lit: the share of a plain floor's ambient light and of its fixed fires' and glows' light (TASKS 1364);
  // elites: plain monsters made elite, the first one's room with a chest of tier `chest`; gauntlet: a plate row down every straight
  // two-cell stretch of corridor this long (a winding way has few long ones: ≈2 rows a floor, not 0.5); gold: gold picked up; pop:
  // monsters a room; ambush: a hoard chest's ambush chance; not: biomes it skips (the fire floors have no streams);
  // notLay: layouts it skips (a tomb has no corridors to curse, a hall's are short). A floor laid with no room for its modifier is
  // laid again, and past the strict tries goes without it (dungeon.js MOD_HELD). The vows (TASKS 370) are to draw from this pool too
  const FLOOR_MOD = { from: 3, chance: 0.5 };
  const FLOOR_MODS = {
    flood: { name: TXT('FLOOR_MODS.flood'), w: 1, water: 3, not: ['lava'] },
    dark: { name: TXT('FLOOR_MODS.dark'), w: 1, torch: 0.7, light: 1.4, dim: 0.3, lit: 0.35, flame: 0.3, glint: 0.35 },
    lair: { name: TXT('FLOOR_MODS.lair'), w: 1, elites: 2, chest: 3 },
    cursed: { name: TXT('FLOOR_MODS.cursed'), w: 1, gauntlet: 5, gold: 1.5, notLay: ['tomb', 'hall'] },
    quiet: { name: TXT('FLOOR_MODS.quiet'), w: 1, pop: 0.7, ambush: 2 },
  };
  // the magma caves' hazards (TASKS 406), the first of what makes them harder than the water caves: a vent throws lava round it
  // every `per` seconds (drawn from the range, each its own phase), a hot ring on the floor, bubbles and a rising glow `warn` s
  // before; a rock drops from above on a pass between the plateaus or at the foot of the top wall, its shadow growing `warn` s
  // before. Both hurt whoever stands within `r` px (the ring's half-width; its height is ry of it, the floor seen at 3/4) for `burst`
  // s: the hero `hp` of his health past armour (a dash leaps it, as spikes), a vent setting him alight for `burn` s, a monster `mon`
  // grown with depth, and knock him away. n: how many a floor of the magma caves, 1st to 4th (more each floor to the 3rd, the boss's
  // fewer); apart: cells between two of a kind; aim: falling rocks laid first on the narrows of the walk to the stairs (TASKS 461);
  // clear: cells kept from the start's fire, the spawn, chests, monsters' posts and the
  // stairs (selfCheck)
  const HAZ = { vent: { per: [5, 7], warn: 1.2, burst: 0.35, r: 72, ry: 0.62, hp: 0.13, burn: 3, mon: 16, kb: 1.4, n: [3, 5, 8, 3], apart: 8, gate: { per: 4.6, hp: 0.2, tails: 2, pitch: 0.72, minCells: 3, off: 0.2, from: 0.1, to: 0.9, kb: 160, stun: 1, see: 14, deep: 3.5, deepMax: 3, calm: 8, shy: ['imp', 'skel_archer', 'cultist', 'fire_priest'] } },
    // (run, gap: an aimed rock is a run of 2·run + 1 down the walk, falling gap s one after another, TASKS 485)
    fall: { per: [4, 6.5], warn: 0.8, burst: 0.12, r: 34, ry: 0.62, hp: 0.11, burn: 0, mon: 14, kb: 0.8, n: [2, 4, 7, 2], apart: 6, aim: 2, run: 2, gap: 0.2 },
    // a terrace floor's lavafall surges (TASKS 475): every `per` s its river rises over its banks, `band` cells of floor either side
    // (the serpentine turns by it every other row): over the warning it creeps up to `creep` of the band, for `burst` s it floods
    // the whole of it and hurts as a vent does, then it ebbs back over `ebb` s. Nothing is laid in its reach
    surge: { per: [8, 10], warn: 1.6, burst: 0.7, ebb: 0.6, creep: 0.35, band: 2, hp: 0.12, burn: 2, mon: 14, kb: 0 }, clear: 3 };
  // the brink (TASKS 476): the hero is never pushed off an edge (the player's call 02.11.2026), so the edge's price is the monsters':
  // a blow that drives one at the lava or the chasm within `reach` px of it drives it `kb` times as far, and one within `near` px of
  // such an edge shows it (scene.js) so that pushing it off is a move to aim for, not luck
  const BRINK = { kb: 1.8, reach: [20, 36, 52], near: 34 };
  // where a hazard stands in its cycle at time t: 0 at the burst, the warning from per − warn to per
  // (lag: the seconds the floor stood still on a load, TASKS 1812, kept apart from ph, which also names a gate's row)
  const hazCycle = (z, t) => (t - (z.lag || 0)) / z.per + z.ph, hazClock = (z, t) => (hazCycle(z, t) % 1 + 1) % 1 * z.per;
  const ZONE = new WeakMap(), zoneOf = (z) => { let q = ZONE.get(z); if (!q) ZONE.set(z, q = new Set(z.cells)); return q; };
  // a ring's half-widths; a gate's reaches `d` times further along the walk (TASKS 1895), its width across the passage kept
  const hazAxes = (z) => { const H = HAZ[z.k], r = H.r * (z.s || 1), d = z.d || 1; return [z.ax ? r * d : r, H.ry * r * (z.ay ? d : 1)]; };
  const hazIn = (z, x, y) => { if (z.k === 'surge') return zoneOf(z).has(Math.floor(y / TILE) * z.W + Math.floor(x / TILE)); const [rx, ry] = hazAxes(z); return Math.hypot((x - z.x) / rx, (y - z.y) / ry) < 1; };
  // how far a surge has risen over its band at time t, 0..1 (TASKS 475)
  const surgeLevel = (z, t) => { const H = HAZ.surge, c = hazClock(z, t); if (c < H.burst) return 1; if (c < H.burst + H.ebb) return 1 - (c - H.burst) / H.ebb;
    const w = c - (z.per - H.warn); return w >= 0 ? H.creep * w / H.warn : 0; };

  // the caves' packs by role (TASKS 312), a hall's weight for each when it can hold it: line, a crab or two just inside the way the
  // hero comes in with the archers (and from the 3rd floor a mage) at the far end behind them; shore, drowned in the hall's shallows;
  // hall, slimes in a big hall (area in cells); bones, the old dungeon's kinds, now and then with an archer or a mage at the back.
  // eel: the chance of an eel in a hall's deep water and in each lake between halls, by floor
  const CAVE_PACKS = { line: 3, shore: 3, hall: 2, bones: 2, hallArea: 110, eel: [0, 0, 0.6, 0.7], lake: [0, 0, 0.5, 0.7], old: ['skeleton', 'goblin', 'spider'] };
  // the magma caves' packs by role (TASKS 412), each a hall's pick by weight once its kinds have come (BIOMES.magma.from: the 1st
  // floor skeletons, goblins and archers, the 2nd smouldering skeletons and cultists, the 3rd fire priests and demons). plan: in
  // order, [kinds (a kind twice is drawn twice as often), how many, where]: near, a few steps in from the way the hero comes; back, the far end; any. The first entry is
  // the pack's own: a smaller hall cuts the rest first, a bigger one adds more of the last
  // the magma caves' halls (TASKS 434): one or two of a floor's big plateaus off the way to the stairs are a hall of the cult's, each
  // its own pack (MAGMA_PACKS, `extra` more of it), props and reward. need: the roster's kind it wants (the hall waits for its
  // floor); w: its weight; area: a hall's least box, in cells; n: halls a floor [least, most], two with the chance `two`
  //   sanctum: the fire priests' circle as on ref_cave_lava, candles round it, braziers either side, the hoard on the circle
  //   forge: the cult's forge and anvil against the rock, a weapon rack, the hoard by the anvil and a heap of gold
  //   nest: the smouldering dead's nest strewn with the charred and their bones, heaps of gold and a chest
  //   prison: the cult's cages with its prisoners' things piled by them, a chest
  // pay (TASKS 1054: every hall paid one chest of the 2nd tier, as the lake's way round does): the hall's chest tier, and what it holds
  // over that: the sanctum's circle blesses the hero once its priests are dead (GIFTS.bless for the floor), the forge's chest
  // `forge` arms of `min` rarity and up, the nest the most gold (`gold` heaps) for the deadliest hall, the prison the prisoners' stash
  // (`stash`: potions and a scroll with the one item)
  const MAGMA_HALLS = { area: 80, n: [1, 1], two: 0.5, blessOff: 14,
    kinds: { sanctum: { need: 'fire_priest', pack: 'pyre', extra: 1, w: 3, pay: { tier: 1, bless: 1 } },
      forge: { need: 'golem', pack: 'rock', extra: 1, w: 3, early: 1, pay: { tier: 2, gold: 1, forge: { n: 2, min: 2, slots: ['weapon', 'armor', 'offhand'] } } },
      // (the nest its own pack alone, TASKS 1041: with 2 extra it held 5–7, their blasts a chain; the prison less often: 54 halls of 134)
      nest: { need: 'skel_ember', pack: 'nest', extra: 0, w: 2, pay: { tier: 3, gold: 3 } },
      prison: { need: 'skeleton', pack: 'rush', extra: 1, w: 1, pay: { tier: 2, gold: 1, stash: { hp_potion: 3, mp_potion: 1, scroll: 1 } } } } };
  const MAGMA_PACKS = {
    // (w: a weight, or one a floor: TASKS 465, the 1st floor's packs were 70 % shooters, so the archers' line comes a third as often there)
    line: { w: [1, 3], plan: [[['skel_archer'], [1, 2], 'back'], [['skeleton', 'skeleton', 'goblin'], [2, 3], 'near']] },
    // (nest: the smouldering dead's own hall, them alone; with the ember pack's archer it was half archers, TASKS 488; never drawn at random)
    nest: { w: 0, plan: [[['skel_ember'], [3, 4], 'any']] },
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

  // what a blow on a big prop sounds and looks like: wood rocks and sheds splinters, stone shudders and chips, metal rings and
  // sparks, crystal chimes and flashes, sacks slump
  // how wide each floor prop draws, in view px (its display height in sizes.js times its sprite's aspect); the generator keeps
  // these apart so no two overlap on screen. A gold heap draws as the `treasure` sprite, a small pile as `shop_gold`
  // how a room is furnished (dungeon.js: furnish): tall props in a row or in mirrored pairs against the back wall, coffins or
  // crystals in mirrored rows on the floor with an aisle between, stacks of barrels and crates in corners, a table with candles by
  // a side wall, pots in a line along one, bones by the walls; the middle and the ways in stay open. `need`: the plan suits a room
  // whose biome (or zone) has any of these props; `w`: its weight among the plans that suit
  // the shapes of the rooms-and-corridors floors' rooms (dungeon.js, TASKS 374), each a weight p of a room's draw: rect, a box; L
  // and T, a box with a foot or a stem; cross; round, an oval hall; colonnade, a long hall with two rows of pillars; pit, a hall
  // round a chasm in its middle (a combat room's: no fire, stairs or altar stands by it); gallery, long and narrow; closet, a small
  // room off the way (never the start, the stairs, the merchant or the altar); hall, a big one (maps from `from` cells wide); tier,
  // a fight's hall on two levels (TASKS 375): a gallery at the back behind a railing over a drop, steps down to the floor below
  const ROOM_SHAPES = { rect: { p: 34 }, L: { p: 12 }, T: { p: 10 }, cross: { p: 9 }, round: { p: 8 }, colonnade: { p: 8 }, pit: { p: 7 }, gallery: { p: 5 }, closet: { p: 4 }, hall: { p: 3, from: 72 }, tier: { p: 5, from: 64 } };
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
    // a colonnade room's (TASKS 374): never drawn for another room
    colonnade: { need: ['pillar', 'statue'], w: 0, floor: { n: ['pillar', 'statue'], mode: 'colonnade' }, stacks: 1, bones: 1 },
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
    anvil_tw: 37, forge_tw: 83, forge_mg: 83, basalt_a: 66, basalt_b: 62, boulder_mg_a: 62, boulder_mg_b: 63, obsidian_mg: 68, skel_mg: 51, banner_mg: 70, vent_mg: 53 };
  // and how tall (sizes.js heights): with the width, the sprite's box an item lying behind the prop disappears in
  const PROP_H = { chest: 52, coffin: 51, grave: 51, statue: 117, pillar: 89, crystal: 81, cage: 81, rack: 71, bookshelf: 107, table: 52, brazier: 51,
    altar: 56, gold: 52, goldpile: 32, barrel: 56, crate: 51, pot: 36, vase_a: 60, vase_b: 48, vase_c: 60, candlestick: 60, candelabra: 66, torch_stand: 76, crystal_cv: 84,
    stalag_a: 54, stalag_b: 74, boulder_a: 44, boulder_b: 32, wreck_cv: 50, tent_cv: 80, shroom_a: 40, shroom_b: 56, skel_cv: 44,
    anvil_tw: 40, forge_tw: 64, forge_mg: 64, basalt_a: 72, basalt_b: 44, boulder_mg_a: 44, boulder_mg_b: 32, obsidian_mg: 84, skel_mg: 44, banner_mg: 96, vent_mg: 22 };
  const PROP_MAT = { table: 'wood', rack: 'wood', bookshelf: 'wood', coffin: 'wood', shop_shelf: 'wood', shop_barrel: 'wood', shop_crate: 'wood',
    statue: 'stone', pillar: 'stone', grave: 'stone', cage: 'metal', brazier: 'metal', candlestick: 'metal', candelabra: 'metal', torch_stand: 'metal', shop_lantern: 'metal', shop_armor: 'metal', shop_weapons: 'metal',
    crystal: 'crystal', crystal_cv: 'crystal', shop_sacks: 'cloth', shop_gold: 'cloth', fire: 'fire', bones: 'bone',
    stalag_a: 'stone', stalag_b: 'stone', boulder_a: 'stone', boulder_b: 'stone', wreck_cv: 'wood', tent_cv: 'cloth', skel_cv: 'bone',
    skel_mg: 'bone', fence_mg: 'chain', vent_mg: 'ember', anvil_tw: 'metal', forge_tw: 'stone', forge_mg: 'stone',
    basalt_a: 'stone', basalt_b: 'stone', boulder_mg_a: 'stone', boulder_mg_b: 'stone', obsidian_mg: 'crystal', skel_mg: 'bone', banner_mg: 'cloth' };

  // a trapped chest (TASKS 1357): from: first floor it appears on; p: chance per chest, max per floor; fuse: seconds from the click to
  // the blast, time to step or dash away; r: the blast's reach; hp: share of max health, never the killing blow
  const CHEST_TRAP = { from: 2, p: 0.1, max: 2, fuse: 0.55, r: 96, hp: 0.2 };
  const MIMIC = { from: 3, p: 0.08 };
  // a statue that slides aside off a secret (TASKS 1354): p: chance a top-wall secret takes this cover where the statue fits
  // planned: the same chance in a room dressed to a matching plan, plans: those rooms (TASKS 1355); hostP: chance a room hosting a secret takes one of the plans
  // slide: seconds the stone takes to grind aside; the cell it leaves stays blocked until it is gone
  const STATUE_SECRET = { p: 0.35, planned: 0.85, plans: ['gallery', 'hall', 'crypt', 'sanctum', 'library'], hostP: 0.6, slide: 1.2 };
  // a struck coffin may let out what lies in it (TASKS 1353): rolled once per coffin, one per room at most; rise: seconds it takes to climb out
  const COFFIN = { p: (f) => Math.min(0.35, 0.12 + 0.03 * f), rise: 1 };
  // a boat's wreck on a shore (TASKS 1361): `hp` blows break it; then `loot` is the chance of something found in it, else `ghosts` of its crew
  const SHELF_SECRET = { hp: 3 };
  const WRECK = { hp: 3, loot: 0.55, q: 1, ghosts: [3, 4], lo: 1, hi: 2, lag: 2 };
  Object.assign(D, { STATUE_SECRET, SHELF_SECRET, COFFIN, WRECK, MIMIC, CHEST_TRAP, BIOMES, ARCH, HAZ, BRINK, hazCycle, hazClock, hazIn, hazAxes, surgeLevel, CAVE_PACKS, MAGMA_HALLS, MAGMA_PACKS, ROOM_SHAPES, ROOM_PLANS, PROP_W, PROP_H, PROP_MAT, FLOOR_MOD, FLOOR_MODS });
})(typeof window !== 'undefined' ? window : globalThis);
