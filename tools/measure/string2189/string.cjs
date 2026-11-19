// node tools/measure/string2189/string.cjs : the archer's bowstring along its line in every pose archerFistCheck draws (short and long bow;
// rest, run, draw, loose; both facings; world and arch under its ×3.2), as that check counts it (live/sim_checks_grip.js, stringRun): the
// length of the line outside the drawn pieces (gap), under a sprite drawn after it that is not a fist (cut), and the runs left in sight
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js'));
const fails = SIM.selfCheck(['archerFistCheck']);
for (const r of globalThis.SIMX.stringRuns) console.log(`${r.tag.padEnd(48)} gap ${r.gap.toFixed(2).padStart(6)} px  cut ${r.cut.toFixed(2).padStart(5)} px  pieces in sight ${r.pieces}${r.by ? '  by ' + r.by : ''}`);
const W = globalThis.SIMX.stringRuns, sum = (k, f) => W.filter(f).reduce((a, r) => a + r[k], 0);
for (const [n, f] of [['world', (r) => !/in the arch/.test(r.tag)], ['arch', (r) => /in the arch/.test(r.tag)]]) console.log(`${n}: gap ${sum('gap', f).toFixed(1)} px, cut ${sum('cut', f).toFixed(1)} px, max pieces ${Math.max(...W.filter(f).map((r) => r.pieces))}`);
console.log(fails.length ? fails.join('\n') : 'archerFistCheck ok');
