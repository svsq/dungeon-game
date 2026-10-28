// in-game sprite sizes in view px: { name: [w, h] } (engine.md §7 "Display size vs texture size"), from one height per name
(function () {
  const HEIGHT = {
    hero: 84, hero_back: 84, en_skeleton: 76, en_goblin: 72, en_spider: 53, en_cultist: 84, en_ghost: 74, en_brute: 112, en_drowned: 82, en_slime: 44, en_crab: 52, en_eel: 100,
    barrel: 56, crate: 51, pot: 36, chest: 43, chest_open: 52, chest_open_gold: 57, bones: 30, candles: 33, torch_sconce: 46, banner: 64, table: 52,
    stairs: 64, brazier: 51, coffin: 51, statue: 117, pillar: 89, crystal: 81, altar: 56, cage: 81, rack: 71,
    bookshelf: 107, grave: 51, treasure: 52, door: 64, portrait: 140, padlock: 28, table_candles: 58,
    merchant: 78, shop_counter: 52, shop_scales: 40, shop_shelf: 104, shop_weapons: 58, shop_armor: 80, shop_sacks: 44, shop_gold: 32,
    shop_barrel: 66, shop_sign: 38, shop_lantern: 64, shop_crate: 34, shop_gems: 24,
    vase_a: 60, vase_b: 48, vase_c: 60, candlestick: 60, candelabra: 66, torch_stand: 76,
    queen_crown: 47, spider_eggs: 40, water_basin: 40, water_spout: 42, water_grate: 36, water_drain: 34, water_stone_a: 18, water_stone_b: 16,
    shroom_a: 40, shroom_b: 56, crystal_cv: 84,
    stalag_a: 54, stalag_b: 74, boulder_a: 44, boulder_b: 32, lily_cv: 24, weed_cv: 40, wreck_cv: 50, skel_cv: 44, tent_cv: 80,
    campfire_cv: 36, bridge_post: 54, bridge_torch: 74, ford_a: 20, ford_b: 17,
  };
  const S = (window.SIZES = window.SIZES || {}), A = window.ASSETS || {};
  for (const n in HEIGHT) if (A[n]) S[n] = [Math.round(HEIGHT[n] * A[n].w / A[n].h), HEIGHT[n]];
  // a small slime is the slime's painting drawn smaller: its own name, so everything sized by 'en_' + type finds it
  const ALIAS = { en_slime_s: ['en_slime', 28] };
  for (const n in ALIAS) { const [src, h] = ALIAS[n]; if (A[src]) S[n] = [Math.round(h * A[src].w / A[src].h), h]; }
  for (const n in A) if (n.startsWith('it_') || n.startsWith('ab_')) S[n] = [Math.round(56 * A[n].w / Math.max(A[n].w, A[n].h)), Math.round(56 * A[n].h / Math.max(A[n].w, A[n].h))];
})();
