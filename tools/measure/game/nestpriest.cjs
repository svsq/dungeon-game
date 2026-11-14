// node tools/measure/game/nestpriest.cjs [N] — magma run, seeds 1..N, floors 1–3 (the selfCheck's seeds): nest halls without their
// fire priest (TASKS 1647), and every hall without its leader `need` (TASKS 1943), on the generator alone. ROOT=… for another copy.
const ROOT = require('path').resolve(process.env.ROOT || require('path').join(__dirname, '../../..'));
const D = require(ROOT + '/live/data.js'), DG = require(ROOT + '/live/dungeon.js'), HL = D.MAGMA_HALLS.kinds;
const N = +(process.argv[2] || 40);
let nests = 0, bare = 0; const noPriest = [], noLead = [];
for (let sd = 1; sd <= N; sd++) for (let f = 1; f <= 3; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd });
  for (const r of m.rooms.filter((q) => q.hall)) { const E = m.enemies.filter((e) => e.room === r.id);
    if (!(f === 1 && HL[r.hall].early) && !E.some((e) => e.type === HL[r.hall].need)) noLead.push(`${sd}/${f} ${r.hall}`);
    if (r.hall !== 'nest') continue; nests++;
    if (!E.some((e) => e.type === 'fire_priest')) { bare++; noPriest.push(`${sd}/${f}:${E.length}`); } } }
console.log(`nests without a priest: ${bare} of ${nests}`);
console.log(`  ${noPriest.join(' ')}`);
console.log(`halls without their leader: ${noLead.length}${noLead.length ? ' — ' + noLead.join(', ') : ''}`);
