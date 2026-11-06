// in-game sprite sizes in view px: { name: [w, h] } (engine.md §7 "Display size vs texture size"), from one height per name
(function () {
  const HEIGHT = {
    town_smith: 84, town_guard: 82, town_keeper: 82, town_enchanter: 82, town_porter: 79, town_sweeper: 75, town_child: 55, town_hen_white: 25, town_hen_red: 25, town_hen_grey: 25,
    town_tool_hammer: 26, town_tool_tongs: 30, town_tool_broom: 62, town_tool_sack: 34, town_tool_crate: 32, town_tool_spear: 90, town_tool_staff: 84, town_tool_grain: 16,
    serpent__body: 154, serpent__tail: 70, hero: 84, hero_back: 84, en_skeleton: 76, en_goblin: 72, en_spider: 53, en_cultist: 84, en_ghost: 74, en_brute: 112, en_imp: 58, en_golem: 128, en_colossus: 230, en_salamander: 92, en_drowned: 82, en_slime: 44, en_crab: 62, en_eel: 100, en_skel_archer: 78, en_skel_mage: 78,
    barrel: 56, crate: 51, pot: 36, chest: 43, chest_open: 52, chest_open_gold: 57, bones: 30, candles: 33, torch_sconce: 46, banner: 64, table: 52,
    stairs: 64, stairs_up: 76, waystone: 100, waystone_runes: 100, brazier: 51, coffin: 51, statue: 117, pillar: 89, crystal: 81, altar: 56, cage: 81, rack: 71,
    bookshelf: 107, grave: 51, treasure: 52, door: 64, portrait: 140, padlock: 28, table_candles: 58,
    merchant: 78, shop_counter: 52, shop_scales: 40, shop_shelf: 104, shop_weapons: 58, shop_armor: 80, shop_sacks: 44, shop_gold: 32,
    shop_barrel: 66, shop_sign: 38, shop_lantern: 64, shop_crate: 34, shop_gems: 24,
    vase_a: 60, vase_b: 48, vase_c: 60, candlestick: 60, candelabra: 66, torch_stand: 76,
    queen_crown: 47, spider_eggs: 40, water_basin: 40, water_spout: 42, water_grate: 36, water_drain: 34, water_stone_a: 18, water_stone_b: 18,
    shroom_a: 40, shroom_b: 56, crystal_cv: 84,
    stalag_a: 54, stalag_b: 74, boulder_a: 44, boulder_b: 32, lily_cv: 24, weed_cv: 40, wreck_cv: 50, skel_cv: 44, tent_cv: 80,
    campfire_cv: 36, bridge_post: 54, bridge_torch: 74, ford_a: 20, ford_b: 17,
    // the start town (R-17, TASKS 1004): one or two tiles tall at most, by the style bible's town rule; the tree and the adit 70
    anvil_tw: 40, forge_tw: 64, lectern_tw: 54, flasks_tw: 68, board_tw: 62, orebin_tw: 44, bench_tw: 28, logs_tw: 40, herbs_tw: 32, cart_tw: 40, picks_tw: 50,
    blocks_tw: 36, campfire_tw: 42, ore_tw: 22, tree_tw: 70, awning_tw: 84, stall_tw: 64, well_tw: 62, adit_tw: 70, stone_tw_a: 54, stone_tw_b: 40,
    dc_grass_tw: 20, dc_flowers_tw: 20, dc_leaves_tw: 16, disc_tw: 96, runes_tw: 72,
    basalt_a: 72, basalt_b: 44, slab_mg_a: 32, slab_mg_b: 32, slab_mg_c: 28, bridge_post_mg: 54, arch_mg: 140, boulder_mg_a: 44, boulder_mg_b: 32, obsidian_mg: 84, skel_mg: 44, banner_mg: 96, vent_mg: 22,
  };
  const S = (window.SIZES = window.SIZES || {}), A = window.ASSETS || {};
  for (const n in HEIGHT) if (A[n]) S[n] = [Math.round(HEIGHT[n] * A[n].w / A[n].h), HEIGHT[n]];
  // a small slime is the slime's painting drawn smaller: its own name, so everything sized by 'en_' + type finds it
  const ALIAS = { en_slime_s: ['en_slime', 28] };
  for (const n in ALIAS) { const [src, h] = ALIAS[n]; if (A[src]) S[n] = [Math.round(h * A[src].w / A[src].h), h]; }
  for (const n in A) if (n.startsWith('it_') || n.startsWith('ab_') || n.startsWith('qi_')) S[n] = [Math.round(56 * A[n].w / Math.max(A[n].w, A[n].h)), Math.round(56 * A[n].h / Math.max(A[n].w, A[n].h))];
})();
