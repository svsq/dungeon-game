// live/data.js — game content as data: biomes, enemies, items, affixes, abilities, meta upgrades, UI layout.
// Shared by sim.js (rules) and scene.js / hud.js (drawing). Pure data + pure helpers, no state. The content lives in the
// data_*.js files by domain (ARCHITECTURE.md §4.2, modules.js lists them): the page loads them before this file, Node
// requires them from here. This file checks that DATA holds every name the sim, the scene and the tools read.
(function (root) {
  if (typeof module !== 'undefined') for (const f of require('./modules.js').parts.data) require('./' + f);
  const D = root.DATA, KEYS = [
    'ROOM_SHAPES', 'FOLK', 'FOLK_SAY', 'KEEPER', 'folkClock', 'folkInit', 'placeName', 'colossusStepAt', 'colossusContact', 'TILE', 'ZOOM',
    'ZOOMS', 'zoomFix', 'SETTINGS', 'BIOMES', 'ARCH', 'HAZ', 'hazCycle', 'hazClock', 'hazIn', 'hazAxes', 'RUNS', 'runOf', 'wayFloor', 'wanderAt', 'stageOf', 'rosterAt', 'CAVE_PACKS',
    'MAGMA_PACKS', 'DIFF', 'DIFF_ORDER', 'floorName', 'ENEMIES', 'BOSSES', 'bossPhase', 'bossMove', 'BAL', 'dmgAt', 'hpAt', 'ELITE',
    'eliteK', 'GEN_VERSION', 'windOf', 'under', 'ELITE_MODS', 'eliteMods', 'modPool', 'TIPS', 'eliteName', 'ELITE_GROUP', 'ELITE_NAMES', 'SLOTS', 'SLOT_NAME', 'BASES',
    'ITEM_BAL', 'STASH', 'CRAFT', 'CAPTIVES', 'NOTES', 'STORY', 'QUESTS', 'questReward', 'QUEST_GIVE', 'QUEST_SAY', 'turnFill', 'NAMED', 'storyChain', 'plural', 'reqLvl',
    'CONSUMABLES', 'RARITY', 'AFFIXES', 'AFFIX_W', 'LOOT_OVER', 'LEGEND_NAMES', 'BRINK', 'surgeLevel', 'MAGMA_HALLS', 'CLASSES', 'clsOf', 'classesReady', 'uiAt', 'CLASS_LOOT', 'wears', 'clsNames', 'ABILITIES', 'CRIT', 'AB_MAX', 'abRank', 'MASTERY', 'ranksFull', 'masteryK', 'masteryTake', 'SHIELD_T',
    'shieldHp', 'fireDmg', 'FROST', 'frostDmg', 'BOLT', 'SHOTS', 'VOLLEY', 'TRAP', 'LEAP', 'RAGE', 'CHARGE', 'CRY', 'STATS', 'META', 'BAG', 'bagLen', 'metaLine', 'GIFTS', 'POWERS', 'FORKS', 'FORK_RANKS', 'STAT_POWER', 'THRESHOLD', 'forkKey', 'forkPending', 'CODEX_TABS', 'CODEX_PAGE', 'codexList', 'ACHIEVE', 'UNLOCKS', 'isOpen', 'KITS', 'kitsOf', 'kitOf', 'giftPool', 'evosReady', 'hasPower', 'giftBlocked', 'RELIC_MAX', 'relicsOf', 'giftCost', 'rerollCost', 'xpNeed', 'SHOP', 'itemPrice', 'sellPrice', 'UI', 'TEST_RUNS',
    'startPath', 'hitUI', 'VERSION', 'CHANGES', 'newsRows', 'campaignLen', 'CHEST_TRAP', 'STATUE_SECRET', 'SHELF_SECRET', 'MIMIC', 'WRECK', 'COFFIN', 'PROP_MAT', 'PROP_W', 'PROP_H', 'ROOM_PLANS', 'AMB_T' ];
  const lost = KEYS.filter((k) => !(k in D));
  if (lost.length) throw new Error('data.js: DATA lacks ' + lost.join(', '));
  if (typeof module !== 'undefined') module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
