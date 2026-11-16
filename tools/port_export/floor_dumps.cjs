// The whole set of floor dumps as { relative path → text }: a file per run and run seed (`<run>/<seed>.json`, every
// floor of that run with its tries, stage checkpoints and summary, and its map for the first run seeds), `index.json`
// (where the dumps come from, which runs, seeds and floors, which plan fields the generator's code fills in) and
// `biomes.json` (the colours, RGB or RGBA lists, of each biome a floor names).
const { execFileSync } = require('child_process');
const path = require('path');
const { GeneratorProbe } = require('./generator_probe.cjs');
const { floorRecord } = require('./floor_record.cjs');
const { documentText } = require('./canonical_json.cjs');
const { planFallbacksOf } = require('./plan_fallbacks.cjs');
const { runsOf, runSeeds, floorSeedOf, keepsFullMap, optionsOf, RUN_SEEDS, FULL_MAP_SEEDS, FLOOR_SEED } = require('./floor_runs.cjs');

const REPOSITORY = path.join(__dirname, '..', '..');
const SOURCE_BRANCH = 'dev';
const SHORT_COMMIT = 8;
const COLOUR_CHANNELS = { fewest: 3, most: 4 };
const isColour = (value) => Array.isArray(value) && value.length >= COLOUR_CHANNELS.fewest && value.length <= COLOUR_CHANNELS.most && value.every((channel) => typeof channel === 'number');
const SEED_DIGITS = String(RUN_SEEDS.last).length;

const fileOf = (run, runSeed) => `${run.name}/${String(runSeed).padStart(SEED_DIGITS, '0')}.json`;

function sourceCommit() {
  const commit = execFileSync('git', ['merge-base', 'HEAD', SOURCE_BRANCH], { cwd: REPOSITORY, encoding: 'utf8' }).trim();
  return commit.slice(0, SHORT_COMMIT);
}

class FloorDumps {
  constructor(progress = () => {}) {
    this.probe = new GeneratorProbe();
    this.D = this.probe.data;
    this.progress = progress;
    this.biomes = new Set();
  }

  build() {
    const files = new Map(), runs = runsOf(this.D);
    for (const run of runs) for (const runSeed of runSeeds()) {
      files.set(fileOf(run, runSeed), documentText(this.runFile(run, runSeed)));
      this.progress(fileOf(run, runSeed));
    }
    files.set('biomes.json', documentText(this.biomeColours()));
    files.set('index.json', documentText(this.index(runs, files.size)));
    return files;
  }

  runFile(run, runSeed) {
    const floors = run.floors.map((floor) => {
      const floorSeed = floorSeedOf(runSeed, floor), options = optionsOf(run, runSeed), place = `${run.name} seed ${runSeed} floor ${floor}`;
      const probe = this.probe.generate(floorSeed, floor, { ...options });
      this.biomes.add(probe.map.biome);
      return floorRecord({ floor, floorSeed, options, probe, keepMap: keepsFullMap(runSeed), place });
    });
    return { run: run.name, runSeed, fullMaps: keepsFullMap(runSeed), floors };
  }

  biomeColours() {
    return Object.fromEntries([...this.biomes].sort().map((biome) => {
      const colours = Object.entries(this.D.BIOMES[biome]).filter(([, value]) => isColour(value));
      if (!colours.length) throw new Error(`floor_dumps: biome ${biome} has no colour`);
      return [biome, Object.fromEntries(colours)];
    }));
  }

  index(runs, fileCount) {
    return {
      source: { commit: sourceCommit(), branch: SOURCE_BRANCH, generatorVersion: this.D.GEN_VERSION },
      floorSeed: `(runSeed * ${FLOOR_SEED.perRunSeed} + floor * ${FLOOR_SEED.perFloor}) >>> 0`,
      runSeeds: [RUN_SEEDS.first, RUN_SEEDS.last],
      fullMapSeeds: [RUN_SEEDS.first, FULL_MAP_SEEDS],
      runs: runs.map((run) => ({ name: run.name, mode: run.mode, from: run.from, town: run.town, floors: [run.floors[0], run.floors[run.floors.length - 1]] })),
      floorCount: runs.reduce((sum, run) => sum + run.floors.length, 0) * runSeeds().length,
      files: fileCount + 1,
      planFallbacks: planFallbacksOf(this.D, runs),
    };
  }
}

module.exports = { FloorDumps };
