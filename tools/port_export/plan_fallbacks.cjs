// The fields of a floor's plan (DATA.stageOf) the generator reads with a value of its own when the plan has none: the
// map size, the room count, whether an altar stands and the secret rooms' factor. For each dumped run it lists the
// floors whose plan lacks them, so the values the generator's code supplies are known by where they are used.
const { runSeeds } = require('./floor_runs.cjs');

const FIELDS_WITH_CODE_DEFAULTS = ['altar', 'rooms', 'secretK', 'size'];

function planFallbacksOf(D, runs) {
  const out = {};
  for (const run of runs) {
    const lacking = Object.fromEntries(FIELDS_WITH_CODE_DEFAULTS.map((field) => [field, { floors: new Set(), plans: 0 }]));
    for (const runSeed of runSeeds()) for (const floor of run.floors) {
      const plan = D.stageOf(run.mode, floor, runSeed, run.from);
      for (const field of FIELDS_WITH_CODE_DEFAULTS) if (plan[field] === undefined) { lacking[field].floors.add(floor); lacking[field].plans++; }
    }
    out[run.name] = Object.fromEntries(Object.entries(lacking).filter(([, found]) => found.plans).map(([field, found]) => [field, { floors: [...found.floors].sort((a, b) => a - b), plans: found.plans }]));
  }
  return out;
}

module.exports = { planFallbacksOf, FIELDS_WITH_CODE_DEFAULTS };
