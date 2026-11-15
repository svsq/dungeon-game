// Grid inputs of the seeded run plan and of the hashes and random streams under it. A stream is recorded as its first
// outputs from a seed, a shuffle as the order it gives a fixed list.
const { product, span } = require('./grid_ranges.cjs');

const HASH_INPUTS = [...span(0, 64), 255, 256, 65535, 65536, 123456789, 2147483647, 2147483648, 4294967295, -1, -123456789];
const STREAM_OUTPUTS = 16;
const SHUFFLED = span(0, 9);
const ENDLESS_LATE_START = 9;
const LARGE_SEEDS = [0, 2147483647, 4294967295];
const STAGE_SEEDS = span(1, 20), ENDLESS_SEEDS = span(1, 10);

function stageCases(D, R) {
  const cases = [];
  for (const mode of Object.keys(D.RUNS)) {
    const run = D.RUNS[mode];
    if (run.endless) continue;
    for (const [f, seed] of product(span(0, run.floors + 1), STAGE_SEEDS)) cases.push([mode, f, seed]);
  }
  const endless = Object.keys(D.RUNS).find((mode) => D.RUNS[mode].endless);
  for (const [f, seed] of product(span(1, R.lastFloor), ENDLESS_SEEDS)) cases.push([endless, f, seed, 1]);
  for (const [f, seed] of product(span(1, 20), R.fewSeeds)) cases.push([endless, f, seed, ENDLESS_LATE_START]);
  for (const [f, seed] of product(span(0, D.RUNS.campaign.floors + 1), R.fewSeeds)) cases.push(['town', f, seed]);
  return cases;
}

function planGrid(D, R) {
  return {
    stageOf: stageCases(D, R),
    rosterAt: product(R.biomes, R.floors),
    wanderAt: product([...R.seeds, ...LARGE_SEEDS], R.floors),
    runOf: R.modes.map((mode) => [mode]),
    mix32: HASH_INPUTS.map((value) => [value]),
    mulOut: HASH_INPUTS.map((value) => [value]),
    mul32: {
      inputs: ['seed'],
      cases: HASH_INPUTS.map((value) => [value]),
      call: (mul32, seed) => { const next = mul32(seed); return span(1, STREAM_OUTPUTS).map(() => next()); },
    },
    shuffleBy: {
      inputs: ['seed'],
      cases: HASH_INPUTS.map((value) => [value]),
      call: (shuffleBy, seed) => shuffleBy([...SHUFFLED], D.mul32(seed)),
    },
  };
}

module.exports = { planGrid };
