// live/data.js — game content as data: biomes, enemies, items, affixes, abilities, meta upgrades, UI layout.
// Shared by sim.js (rules) and scene.js / hud.js (drawing). Pure data + pure helpers, no state. The content lives in the
// data_*.js files by domain (ARCHITECTURE.md §4.2, modules.js lists them): the page loads them before this file, Node
// requires them from here. This file checks that DATA holds every name the sim, the scene and the tools read.
(function (root) {
  if (typeof module !== 'undefined') for (const f of require('./modules.js').parts.data) require('./' + f);
  const D = root.DATA, KEYS = [
    'ROOM_SHAPES', 'FOLK', 'FOLK_SAY', 'KEEPER', 'folkClock', 'folkInit', 'placeName', 'colossusStepAt', 'colossusContact', 'TILE', 'ZOOM',
    'ZOOMS', 'BIOMES', 'ARCH', 'HAZ', 'hazClock', 'hazIn', 'RUNS', 'runOf', 'wayFloor', 'wanderAt', 'stageOf', 'rosterAt', 'CAVE_PACKS',
    'MAGMA_PACKS', 'DIFF', 'DIFF_ORDER', 'floorName', 'ENEMIES', 'BOSSES', 'bossPhase', 'bossMove', 'BAL', 'dmgAt', 'hpAt', 'ELITE',
    'eliteK', 'GEN_VERSION', 'windOf', 'under', 'ELITE_MODS', 'eliteMods', 'modPool', 'TIPS', 'eliteName', 'SLOTS', 'SLOT_NAME', 'BASES',
    'ITEM_BAL', 'STASH', 'CRAFT', 'QUESTS', 'questReward', 'QUEST_GIVE', 'QUEST_SAY', 'NAMED', 'storyChain', 'plural', 'reqLvl',
    'CONSUMABLES', 'RARITY', 'AFFIXES', 'LEGEND_NAMES', 'BRINK', 'surgeLevel', 'MAGMA_HALLS', 'CLASSES', 'clsOf', 'classesReady', 'uiAt', 'CLASS_LOOT', 'wears', 'clsNames', 'ABILITIES', 'AB_MAX', 'abRank', 'SHIELD_T',
    'shieldHp', 'fireDmg', 'FROST', 'frostDmg', 'BOLT', 'STATS', 'META', 'metaLine', 'GIFTS', 'giftCost', 'xpNeed', 'SHOP', 'itemPrice', 'sellPrice', 'UI', 'TEST_RUNS',
    'startPath', 'hitUI', 'PROP_MAT', 'PROP_W', 'PROP_H', 'ROOM_PLANS' ];
  const lost = KEYS.filter((k) => !(k in D));
  if (lost.length) throw new Error('data.js: DATA lacks ' + lost.join(', '));
  if (typeof module !== 'undefined') module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
