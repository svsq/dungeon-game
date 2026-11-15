// node tools/measure/frame/archcells.cjs (TASKS 1962): the magma_arch state's stone arch over the lava as scene_qa.js picks it, and its cells
// around it: A an arch cell the map counts as over lava (lavaUnder), a an arch cell over none, u another crossing's cell over lava, digits m.cells
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '..', '..', '..'), SIM = require(path.join(ROOT, 'live', 'sim.js')), DG = globalThis.DUNGEON;
const at = (S, sd) => { S.run = SIM.newRun(S, 'magma', sd); for (let f = 1; f <= 3; f++) { SIM.enterFloor(S, S.run, f); const m = S.run.map, c = m.crossings.find((q) => q.lava && q.kind === 'arch' && DG.archLegs(m, q)); if (c) return c; } return null; };
let S, c; for (let sd = 3; sd < 24 && !c; sd++) { S = SIM.spawn(0, {}); c = at(S, sd); if (c) console.log('seed', sd, 'floor', S.run.floor); }
const m = S.run.map, W = m.W, xs = c.cells.map((k) => k % W), ys = c.cells.map((k) => Math.floor(k / W)), un = new Set(m.lavaUnder), cs = new Set(c.cells);
console.log('axis', c.axis, 'x', Math.min(...xs), Math.max(...xs), 'y', Math.min(...ys), Math.max(...ys), 'cells', c.cells.length);
for (let y = Math.min(...ys) - 2; y <= Math.max(...ys) + 6; y++) { let s = String(y).padStart(3) + ' ';
  for (let x = Math.min(...xs) - 4; x <= Math.max(...xs) + 4; x++) { const k = y * W + x; s += cs.has(k) ? (un.has(k) ? 'A' : 'a') : un.has(k) ? 'u' : m.cells[k]; } console.log(s); }
console.log('legs', JSON.stringify(DG.archLegs(m, c)));
