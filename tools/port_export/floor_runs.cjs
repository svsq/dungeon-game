// Which floors are dumped: each run as the game starts it (sim_ui.js startRun, sim_floor.js buildFloor), run seeds
// 1 to 40, every floor to the run's end. The campaign goes through the town, as every campaign does; caves and magma
// start from the menu without it; the endless descent is the campaign's sequel through the town (it starts past the
// campaign's last floor) and is dumped to one floor past the floor where it stops growing (RUNS.endless.cap).
// A floor's seed is the one buildFloor gives it.
const RUN_SEEDS = { first: 1, last: 40 };
const FULL_MAP_SEEDS = 10;
const FLOOR_SEED = { perRunSeed: 31, perFloor: 1013 };
const FLOORS_PAST_GROWTH = 1;

const floorSeedOf = (runSeed, floor) => (runSeed * FLOOR_SEED.perRunSeed + floor * FLOOR_SEED.perFloor) >>> 0;
const floorsFrom = (first, last) => Array.from({ length: last - first + 1 }, (_, index) => first + index);

function runsOf(D) {
  const { campaign, cave, magma, endless } = D.RUNS, sequelStart = campaign.floors + 1;
  return [
    { name: 'campaign', mode: 'campaign', from: 1, town: 1, floors: floorsFrom(1, campaign.floors) },
    { name: 'cave', mode: 'cave', from: 1, town: 0, floors: floorsFrom(1, cave.floors) },
    { name: 'magma', mode: 'magma', from: 1, town: 0, floors: floorsFrom(1, magma.floors) },
    { name: 'endless', mode: 'endless', from: sequelStart, town: 1, floors: floorsFrom(sequelStart, endless.cap + FLOORS_PAST_GROWTH) },
  ];
}

function runSeeds() {
  return floorsFrom(RUN_SEEDS.first, RUN_SEEDS.last);
}

const keepsFullMap = (runSeed) => runSeed <= FULL_MAP_SEEDS;
const optionsOf = (run, runSeed) => ({ mode: run.mode, runSeed, from: run.from, town: run.town });

module.exports = { runsOf, runSeeds, floorSeedOf, keepsFullMap, optionsOf, RUN_SEEDS, FULL_MAP_SEEDS, FLOOR_SEED };
