// node tools/measure/genrepeat.cjs [iterations] ["magma 4/3"]: the event check's floors laid again and again in one process; prints the
// floors whose map hash varied between iterations and those where marking the probe event moved anything else on the floor
require('../../live/sim.js');
const { eventFloors, layPlain, layProbed, eventStripped } = globalThis.SIMX.checks.kit;
const crypto = require('node:crypto'), hash = (m) => crypto.createHash('sha1').update(JSON.stringify(m)).digest('hex').slice(0, 10);
const iterations = +process.argv[2] || 5, only = process.argv[3], seen = {}, moved = [];
for (let it = 0; it < iterations; it++) for (const q of eventFloors()) {
  if (only && q.tag !== only) continue;
  const plain = layPlain(q), marked = layProbed(q), [strippedMarked, strippedPlain] = eventStripped(marked, plain);
  (seen[q.tag] = seen[q.tag] || new Set()).add(hash(plain) + '/' + hash(marked));
  if (strippedMarked !== strippedPlain) moved.push(`${it} ${q.tag}`);
}
const varied = Object.entries(seen).filter(([, s]) => s.size > 1).map(([k, s]) => k + ' ' + [...s].join(' '));
console.log(JSON.stringify({ iterations, only: only || 'all', hashes: only ? [...(seen[only] || [])] : undefined, varied, moved: moved.slice(0, 20), movedCount: moved.length }));
