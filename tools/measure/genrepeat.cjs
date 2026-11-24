// node tools/measure/genrepeat.cjs [iterations] ["magma 4/3"]: the event check's floors laid again and again in one process; prints the
// floors whose map hash varied between iterations and those where marking the probe event moved anything else on the floor
require('../../live/sim.js'); const { D, DG } = globalThis.SIMX;
const crypto = require('node:crypto'), hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const MODES = [['campaign', {}], ['campaign', { town: 1 }], ['cave', {}], ['magma', {}]];
const bare = (f) => { const P = D.EVENTS.pool, w = Object.fromEntries(Object.entries(P).map(([k, E]) => [k, E.w])); for (const E of Object.values(P)) E.w = 0;
  try { return f(); } finally { for (const [k, v] of Object.entries(w)) P[k].w = v; } };
const iterations = +process.argv[2] || 5, only = process.argv[3], seen = {}, moved = [];
for (let it = 0; it < iterations; it++) for (const [mode, o] of MODES) for (let sd = 1; sd <= 6; sd++) for (let f = 1; f <= Math.min(5, D.RUNS[mode].floors); f++) {
  const seed = (sd * 31 + f * 1013) >>> 0, op = Object.assign({ mode, runSeed: sd }, o), tag = `${mode}${o.town ? ' (town)' : ''} ${sd}/${f}`;
  if (only && tag !== only) continue;
  const plain = bare(() => DG.genFloor(seed, f, op)), marked = bare(() => DG.genFloor(seed, f, Object.assign({ events: ['probe'] }, op)));
  const evR = new Set((marked.events || []).map((e) => e.room)), strip = (q) => JSON.stringify(Object.assign({}, q, { rooms: q.rooms.map((r) => { const c = Object.assign({}, r); delete c.event; return c; }), enemies: q.enemies.filter((e) => !evR.has(e.room)), webs: q.webs.filter((w) => !evR.has(DG.roomAt(q, w.x, w.y))), events: undefined }));
  (seen[tag] = seen[tag] || new Set()).add(hash(JSON.stringify(plain)) + '/' + hash(JSON.stringify(marked)));
  if (strip(marked) !== strip(plain)) moved.push(`${it} ${tag}`);
}
const varied = Object.entries(seen).filter(([, s]) => s.size > 1).map(([k, s]) => k + ' ' + [...s].join(' '));
console.log(JSON.stringify({ iterations, only: only || 'all', hashes: only ? [...(seen[only] || [])] : undefined, varied, moved: moved.slice(0, 20), movedCount: moved.length }));
