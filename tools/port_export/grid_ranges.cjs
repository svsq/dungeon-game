// Input ranges the balance grid walks. They cover what the game passes and one step past each end: floor 0 is the
// town, the deep curve ends at BAL.deep.end, the endless descent stops growing at RUNS.endless.cap.
const PAST_END = 5;

function span(from, to, step = 1) {
  const out = [];
  for (let value = from; value <= to; value += step) out.push(value);
  return out;
}

function product(...lists) {
  return lists.reduce((rows, list) => rows.flatMap((row) => list.map((value) => [...row, value])), [[]]);
}

function gridRanges(D) {
  const lastFloor = Math.max(D.RUNS.endless.cap, D.BAL.deep.end) + PAST_END;
  return {
    floors: span(0, lastFloor),
    someFloors: [0, 1, 2, 3, 4, 5, 6, 8, 9, 12, 13, 16, 17, 20, 24, 30, 40, 45, lastFloor],
    levels: span(1, 60),
    someLevels: [1, 2, 5, 10, 15, 20, 30, 45, 60],
    ranks: span(0, D.AB_MAX + 1),
    tiers: span(0, 4),
    seeds: span(1, 40),
    fewSeeds: span(1, 5),
    classes: Object.keys(D.CLASSES),
    modes: [...Object.keys(D.RUNS), 'town'],
    enemyTypes: Object.keys(D.ENEMIES),
    bossTypes: Object.keys(D.BOSSES),
    bases: Object.keys(D.BASES),
    biomes: Object.keys(D.BIOMES),
    abilities: D.ABILITIES.map((ability) => ability.id),
    enemyKinds: [...new Set(Object.values(D.ENEMIES).map((enemy) => enemy.kind))],
    lastFloor,
  };
}

module.exports = { gridRanges, product, span };
