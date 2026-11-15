// Grid inputs of the number formulas, top-level and inside tables: each entry lists the argument lists to call with.
const { product, span } = require('./grid_ranges.cjs');

const DAMAGE_BASES = [0, 1, 7.5, 10, 57.3, 100, 1000];
const DAMAGE_FACTORS = [0.5, 1, 1.5, 2.375];
const INTELLECT = [0, 1, 5, 10, 20, 30, 40, 60, 100];
const BOOLEANS = [false, true];
const CLOCK_TIMES = [0, 0.1, 0.5, 1, 2.5, 3.3, 7, 10, 100];
const HAZARD_CLOCKS = [{ per: 1, ph: 0 }, { per: 4.6, ph: 0.25 }, { per: 7, ph: 0.9, lag: 0.5 }];
const ZOOM_ASKS = [undefined, 0, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 2];

function hazardShapes(D) {
  const kinds = Object.keys(D.HAZ).filter((kind) => typeof D.HAZ[kind].r === 'number');
  const scales = [{}, { s: 1.5 }, { d: 2, ax: 1 }, { d: 2, ay: 1 }, { s: 0.5, d: 3, ax: 1, ay: 1 }];
  return product(kinds, scales).map(([k, scale]) => [{ k, ...scale }]);
}

function formulaGrid(D, R) {
  const floorsOnly = R.floors.map((f) => [f]);
  return {
    xpNeed: R.levels.map((lvl) => [lvl]),
    giftCost: product(R.tiers, R.floors),
    rerollCost: product(span(0, 10), R.floors),
    dmgAt: product(R.floors, BOOLEANS),
    hpAt: floorsOnly,
    deepEnd: floorsOnly,
    deepAxis: product(R.floors, ['elite', 'pop', 'cd', 'blow']),
    shieldHp: product(INTELLECT, R.ranks, R.someFloors),
    fireDmg: product(DAMAGE_BASES, DAMAGE_FACTORS, DAMAGE_FACTORS),
    frostDmg: product(DAMAGE_BASES, DAMAGE_FACTORS, DAMAGE_FACTORS),
    abRank: product([...R.abilities, 'unknown'], R.ranks),
    eliteMods: floorsOnly,
    bagLen: [[undefined], [{}], ...span(0, D.BAG.max + 1).map((pouch) => [{ pouch }])],
    masteryK: [0, 1, 5, 10, 50].map((mast) => [{ mast }]).concat([[{}]]),
    stepDz: product([0, 10, D.BOSSES.boss_colossus.step], [0, 5, 10], [-1, -0.5, 0, 0.5, 1]),
    hazCycle: product(HAZARD_CLOCKS, CLOCK_TIMES),
    hazClock: product(HAZARD_CLOCKS, CLOCK_TIMES),
    hazAxes: hazardShapes(D),
    surgeLevel: product(HAZARD_CLOCKS, CLOCK_TIMES),
    folkClock: product(Object.keys(D.FOLK), span(0, 5), [0, 1, 10, 100]),
    zoomFix: ZOOM_ASKS.map((zoom) => [zoom]),
    'COFFIN.p': floorsOnly,
    'EPIC_POWER.p': floorsOnly,
    'SHOP.gear': floorsOnly,
    'SHOP.best': floorsOnly,
    'SHOP.q': floorsOnly,
    'SHOP.cons': floorsOnly,
    'SHOP.townCons': floorsOnly,
    'QUESTS.cull.need': floorsOnly,
    'QUESTS.elites.need': floorsOnly,
    'QUESTS.sweep.need': floorsOnly,
  };
}

module.exports = { formulaGrid };
