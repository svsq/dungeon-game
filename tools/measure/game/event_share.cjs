// how often each event of the pool is laid on the campaign's floors (TASKS 365): 20 seeds × 8 floors, the generator only
const SIM = require(require('path').join(process.env.ROOT || require('path').join(__dirname, '../../..'), 'live/sim.js')), D = globalThis.DATA, DG = globalThis.DUNGEON;
const mode = process.argv[2] || 'campaign', n = {}; let floors = 0;
for (let sd = 1; sd <= 20; sd++) for (let f = 1; f <= Math.min(8, D.RUNS[mode].floors); f++) { floors++;
  for (const E of DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode, runSeed: sd, from: 1 }).events || []) n[E.id] = (n[E.id] || 0) + 1; }
console.log(mode, floors, 'floors', JSON.stringify(n));
