// node tools/measure/fix2204/sleeve.cjs [live dir] : heroSleeveCheck's numbers per pose (live/sim_checks_sleeve.js), and what fails;
// a live dir with the pre-fix textures in its assets gives the numbers before
const path = require('path'), LIVE = path.resolve(process.argv[2] || path.join(__dirname, '../../../live'));
require(path.join(LIVE, 'sim.js')); const out = [], rep = []; globalThis.SIMX.heroSleeve(out, rep);
console.log(rep.join('\n')); console.log('--- failures', out.length); for (const f of out) console.log('FAIL', f);
