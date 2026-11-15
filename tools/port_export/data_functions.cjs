// Every function DATA holds, by kind. Kinds: `formula` numbers from numbers, `rule` a game rule over hero, enemy or item
// objects, `plan` the seeded run and floor plan, `hash` seeded hashing and random streams, `text` builds shown text,
// `view` serves drawing only, `load` runs once while the data loads, `ui` belongs to the screen layout (not exported).
// A function inside a table either becomes data (`sample`: by floor, by rank, or a constant) or stays a named marker
// `{ "function": "<place>" }` in the exported JSON, so it is never dropped silently.

const TOP_LEVEL = {
  formula: [
    'xpNeed', 'giftCost', 'rerollCost', 'dmgAt', 'hpAt', 'deepEnd', 'deepAxis', 'shieldHp', 'fireDmg', 'frostDmg', 'abRank',
    'eliteMods', 'bagLen', 'masteryK', 'stepDz', 'hazCycle', 'hazClock', 'hazAxes', 'surgeLevel', 'folkClock', 'zoomFix',
  ],
  rule: [
    'itemPrice', 'sellPrice', 'reqLvl', 'questReward', 'eliteK', 'windOf', 'under', 'bossPhase', 'bossMove', 'wears', 'clsOf',
    'liveFor', 'metaFor', 'kitsOf', 'kitOf', 'epicPool', 'modPool', 'giftPool', 'evosReady', 'giftBlocked', 'hasPower',
    'relicsOf', 'pastThreshold', 'forkPending', 'forkKey', 'masteryTake', 'heroDmgK', 'floorUnique', 'bossUniques',
    'classesReady', 'colossusStepAt', 'colossusContact', 'hazIn', 'storyChain', 'codexList',
  ],
  plan: ['stageOf', 'rosterAt', 'wanderAt', 'runOf'],
  hash: ['mix32', 'mulOut', 'mul32', 'shuffleBy'],
  text: ['placeName', 'floorName', 'eliteName', 'heroName', 'heroNames', 'giftDesc', 'metaLine', 'zoomName', 'statFull', 'clsNames', 'turnFill'],
  view: ['cartView', 'railPts', 'folkInit'],
  load: ['bakePowerDescs'],
  ui: [
    'hitUI', 'uiAt', 'uiDy', 'feedOf', 'bagTabs', 'bagTabOf', 'newsRows', 'dateOf', 'relNotes', 'verNewer', 'updMark',
    'updShown', 'startPath', 'campaignLen',
  ],
};

const SAMPLE_BY_FLOOR = 'byFloor', SAMPLE_BY_RANK = 'byRank', SAMPLE_CONSTANT = 'constant';

const FIELD_RULES = [
  { place: /^RUNS\.\w+\.(biome|boss)$/, kind: 'plan', sample: SAMPLE_BY_FLOOR },
  { place: /^META\.\d+\.(v|cost)$/, kind: 'formula', sample: SAMPLE_BY_RANK },
  { place: /^QUESTS\.\w+\.need$/, kind: 'formula', sample: SAMPLE_CONSTANT },
  { place: /^(SHOP\.\w+|COFFIN\.p|EPIC_POWER\.p)$/, kind: 'formula' },
  { place: /^(META\.\d+\.unit|QUESTS\.\w+\.(text|count)|KEEPER\.\w+|SETTINGS\.\d+\.(name|fmt|ends))$/, kind: 'text' },
  { place: /^ACHIEVE\.\d+\.test$/, kind: 'rule' },
  { place: /^NOTES\.chainOf$/, kind: 'rule' },
];

function topLevelKinds() {
  const kinds = {};
  for (const [kind, names] of Object.entries(TOP_LEVEL)) {
    for (const name of names) {
      if (kinds[name]) throw new Error(`data_functions: ${name} is listed as ${kinds[name]} and as ${kind}`);
      kinds[name] = kind;
    }
  }
  return kinds;
}

function fieldRuleOf(place) {
  return FIELD_RULES.find((rule) => rule.place.test(place));
}

function parametersOf(fn) {
  const source = fn.toString();
  const listed = /^\s*(?:async\s*)?(?:function\s*[\w$]*\s*)?\(([^)]*)\)/.exec(source);
  if (listed) return listed[1].split(',').map((p) => p.trim()).filter(Boolean);
  const single = /^\s*(?:async\s*)?([\w$]+)\s*=>/.exec(source);
  return single ? [single[1]] : [];
}

module.exports = { topLevelKinds, fieldRuleOf, parametersOf, SAMPLE_BY_FLOOR, SAMPLE_BY_RANK, SAMPLE_CONSTANT };
