// Grid inputs of the game rules: hero, enemy, item and event objects are built with only the fields the rule reads,
// over every class, enemy type, base and the game's floor and level ranges.
const { product, span } = require('./grid_ranges.cjs');

const ELITE_FACTORS = ['hp', 'dmg', 'spd', 'wind', 'cd', 'bolt'];
const ENEMY_STATES = ['idle', 'walk', 'deep', 'stir', 'dive', 'emerge'];
const REWARDS = ['gold', 'scroll', 'xp', 'shards', 'other'];
const FORK_TEST_RANKS = [0, 2, 3, 5, 6, 15];
const COLOSSUS_MOTION = [{ vx: 0, vy: 0, face: 1 }, { vx: 30, vy: 0, face: 1 }, { vx: -20, vy: 15, face: -1 }, { vx: 0, vy: -40, face: 1 }];

const PRICED_GEAR_BASE = 'sword';

const ranksOf = (D, cls, rank) => Object.fromEntries(D.CLASSES[cls].abilities.map((id) => [id, rank]));
const heroOf = (D, cls, powers = {}) => ({ cls, ab: ranksOf(D, cls, 1), powers });
const heldAll = (gifts) => Object.fromEntries(gifts.map((gift) => gift.id).map((id) => [id, 1]));
const openMeta = (D) => ({ open: Object.fromEntries(D.UNLOCKS.map((unlock) => [unlock.id, 1])) });

function heldPowerSets(D) {
  const powers = D.GIFTS.filter((gift) => gift.power && !gift.relic && !gift.needs);
  const evoNeeds = [...new Set(D.GIFTS.flatMap((gift) => gift.needs || []))];
  return [{}, heldAll(powers.slice(0, 1)), heldAll(D.GIFTS.filter((gift) => gift.relic)), Object.fromEntries(evoNeeds.map((id) => [id, 1]))];
}

function pricedItems(D, R) {
  const gear = product(span(0, D.RARITY.length - 1), R.someLevels).map(([rar, lvl]) => ({ b: PRICED_GEAR_BASE, rar, lvl }));
  return [...gear, ...Object.keys(D.CONSUMABLES).map((b) => ({ b, rar: 0, lvl: 1 }))];
}

function heroStateRules(D, R) {
  const heroes = product(R.classes, heldPowerSets(D)).map(([cls, powers]) => heroOf(D, cls, powers));
  return {
    giftPool: product(R.classes, span(1, 4), [undefined, {}, openMeta(D)]).map(([cls, tier, meta]) => [heroOf(D, cls), tier, meta]),
    evosReady: heroes.map((hero) => [hero]),
    giftBlocked: product(heroes, D.GIFTS),
    hasPower: product(heroes, ['bless', 'whirl_pull', 'unknown']),
    relicsOf: heroes.map((hero) => [hero]),
    forkPending: product(R.classes, FORK_TEST_RANKS).map(([cls, rank]) => [{ cls, ab: ranksOf(D, cls, rank), forks: {} }]),
    masteryTake: product(R.classes, [0, 3], [1, D.AB_MAX], [undefined, 2]).map(([cls, sp, rank, mast]) => [{ cls, sp, mast, ab: ranksOf(D, cls, rank) }]),
    heroDmgK: [[{}], [{ bless: 1 }]],
    liveFor: R.classes.flatMap((cls) => [[{ cls }, 'gifts', D.GIFTS], [{ cls }, 'meta', D.META], [{ cls }, 'mods', D.AFFIXES, (affix) => affix.k]]),
  };
}

function enemyRules(D, R) {
  const eliteFlags = [0, 1];
  return {
    eliteK: product(R.enemyTypes, eliteFlags, ELITE_FACTORS).map(([type, elite, k]) => [{ type, elite }, k]),
    windOf: product(R.enemyTypes, eliteFlags, [undefined, 0.6]).map(([type, elite, cold]) => [{ type, elite, cold }, D.ENEMIES[type].wind]),
    under: product(R.enemyTypes, ENEMY_STATES).map(([type, st]) => [{ type, st }]),
    bossPhase: R.bossTypes.flatMap((type) => span(0, D.BOSSES[type].phases.length).map((phase) => [{ type, phase }])),
    bossMove: R.bossTypes.flatMap((type) => product(span(0, D.BOSSES[type].phases.length - 1), Object.keys(D.BOSSES[type].moves)).map(([phase, mv]) => [{ type, phase, mv }])),
    colossusStepAt: product(COLOSSUS_MOTION, span(0, 3)).map(([motion, i]) => [{ type: 'boss_colossus', x: 100, y: 200, ...motion }, i]),
    colossusContact: product([1, -1], ['L', 'R']).map(([face, side]) => [{ type: 'boss_colossus', x: 100, y: 200, face }, side]),
    modPool: product(R.modes, R.someFloors, R.enemyKinds),
    'ACHIEVE.0.test': achievementEvents(D, R),
    'ACHIEVE.1.test': achievementEvents(D, R),
    'ACHIEVE.2.test': achievementEvents(D, R),
  };
}

function achievementEvents(D, R) {
  return product(R.enemyTypes, [0, 1]).map(([type, elite]) => [{ type, elite, boss: D.BOSSES[type] ? 1 : 0 }]);
}

function itemAndClassRules(D, R) {
  return {
    itemPrice: product(pricedItems(D, R), R.someFloors),
    sellPrice: product(pricedItems(D, R), R.someFloors),
    reqLvl: [[undefined], ...product([PRICED_GEAR_BASE, ...Object.keys(D.CONSUMABLES)], R.levels).map(([b, lvl]) => [{ b, lvl }])],
    questReward: product(rewardLists(D), R.someFloors, [undefined, ...R.someLevels]),
    wears: product([...R.classes, 'unknown'], [...R.bases, 'unknown']),
    clsOf: [[undefined], [{}], ...[...R.classes, 'unknown'].map((cls) => [{ cls }])],
    metaFor: R.classes.map((cls) => [cls]),
    kitsOf: product(R.classes, [undefined, {}, openMeta(D)]),
    kitOf: product([undefined, {}, openMeta(D)], R.classes),
    epicPool: R.classes.map((cls) => [cls]),
    floorUnique: product(R.bases, R.classes),
    bossUniques: product(R.bossTypes, R.classes),
    classesReady: [[]],
    pastThreshold: R.classes.flatMap((cls) => thresholdStats(D, cls).map((stats) => [stats, cls])),
    forkKey: product(R.abilities, D.FORK_RANKS),
    storyChain: R.modes.map((mode) => [mode]),
    codexList: D.CODEX_TABS.map((tab) => [tab]),
    hazIn: hazardPoints(D),
    'NOTES.chainOf': D.NOTES.list.filter((note) => note.chain).map((note) => [note]),
  };
}

function rewardLists(D) {
  const lists = new Map(Object.values(D.QUESTS).map((quest) => [JSON.stringify(quest.rw), quest.rw]));
  return [...lists.values(), REWARDS];
}

function thresholdStats(D, cls) {
  const threshold = D.THRESHOLD[cls];
  return [-1, 0, 1].map((step) => ({ [threshold.stat]: threshold.v + step }));
}

function hazardPoints(D) {
  const round = Object.keys(D.HAZ).filter((kind) => typeof D.HAZ[kind].r === 'number').map((k) => ({ k, x: 320, y: 320 }));
  const surge = { k: 'surge', W: 20, cells: [210, 211, 230, 231] };
  const points = product([300, 320, 350, 400], [300, 320, 350, 400]);
  return [...product(round, points).map(([zone, [x, y]]) => [zone, x, y]), ...points.map(([x, y]) => [surge, x, y])];
}

function ruleGrid(D, R) {
  return { ...heroStateRules(D, R), ...enemyRules(D, R), ...itemAndClassRules(D, R) };
}

module.exports = { ruleGrid };
