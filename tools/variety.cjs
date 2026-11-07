// node tools/variety.cjs [--seeds 30] [--mode campaign|cave|magma|endless] [--floors N] [--json]
// how varied a run's floors come out (TASKS 382, R-18): each seed's floors laid as the game lays them (newRun / enterFloor seeds),
// one row per floor number. Fails (exit code 2) when the runs are too alike: fewer than BAND.seqs different sequences of biome and
// layout; two floors running alike (layout and map size both, neither a boss's, nor an endless cave pair: its two floors are the caves' 3rd and 4th by design, TASKS 506); a floor number whose room count barely moves over
// the seeds or whose rooms come in too few shapes; too few dead ends; too many floors whose way from the start to the stairs is short.
// Part of the acceptance of each of 373–380: run it after a change to the generator or to a run's floors.
const path = require('path'), L = path.join(__dirname, '..', 'live');
const D = require(path.join(L, 'data.js')); global.DATA = D; const G = require(path.join(L, 'dungeon.js'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const mode = arg('mode', 'campaign'), RUN = D.runOf(mode), N = +arg('seeds', 30), F = +arg('floors', Number.isFinite(RUN.floors) ? RUN.chapter || RUN.floors : 16), json = process.argv.includes('--json');
// the bands: seqs, different sequences at least; spread, a floor number's room count over the seeds moves this much at least (max − min);
// shapes, a rooms floor's rooms come in this many shapes on average; dead, the share of rooms with one way in, at least; short, the
// share of floors whose walk from the start to the stairs is under shortK of the map's width plus height, at most
// (a boss's floor is held to the same band since TASKS 506 set its hall against a side of the map)
const BAND = { seqs: 3, spread: 2, shapes: 2.5, dead: 0.15, short: 0.25, shortK: 0.5 };
const kind = (st) => st.lay || st.arch || 'rooms', rectsOf = G.rectsOf || ((r) => [[r.x, r.y, r.w, r.h]]), inRm = G.inRm || ((r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
// a room's ways in: the floor cells just outside it that lead off it, in groups touching each other (8 ways round)
const ways = (m, r) => { const out = []; for (const [bx, by, bw, bh] of rectsOf(r)) for (let y = by - 1; y <= by + bh; y++) for (let x = bx - 1; x <= bx + bw; x++) {
    if (inRm(r, x, y) || m.cells[y * m.W + x] !== 1 || out.some(([u, v]) => u === x && v === y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inRm(r, x + dx, y + dy))) out.push([x, y]); }
  const seen = new Set(); let n = 0;
  for (const p of out) { if (seen.has(p.join())) continue; n++; const st = [p]; seen.add(p.join());
    while (st.length) { const [x, y] = st.pop(); for (const q of out) if (!seen.has(q.join()) && Math.abs(q[0] - x) <= 1 && Math.abs(q[1] - y) <= 1) { seen.add(q.join()); st.push(q); } } }
  return n; };
const rows = Array.from({ length: F }, () => ({ rooms: [], shapes: [], dead: 0, all: 0, short: 0, n: 0, walk: [], kinds: {}, size: {}, boss: 0 }));
const seqs = new Map(); let alike = 0, pairs = 0; const alikeAt = [];
for (let s = 1; s <= N; s++) { let prev = null; const seq = [];
  for (let f = 1; f <= F; f++) { const st = D.stageOf(mode, f, s), m = G.genFloor((s * 31 + f * 1013) >>> 0, f, { mode, runSeed: s }), q = rows[f - 1], k = kind(st);
    const real = m.rooms.filter((r) => r.type !== 'secret' && !r.isle); q.n++; q.rooms.push(real.filter((r) => !r.pocket).length);
    q.shapes.push(new Set(real.map((r) => r.shape || (r.pocket ? 'nook' : 'rect'))).size); if (!(D.ARCH[k] && (D.ARCH[k].grid || D.ARCH[k].bsp))) (q.mixed = q.mixed || []).push(q.shapes[q.shapes.length - 1]);
    for (const r of real) { q.all++; if (ways(m, r) === 1) q.dead++; }
    q.walk.push(m.walk); if (m.walk >= 0 && m.walk < BAND.shortK * (m.W + m.H)) q.short++;
    q.kinds[k] = (q.kinds[k] || 0) + 1; if (st.boss) q.boss++; q.size[m.W + '×' + m.H] = 1; seq.push(st.biome + ':' + k);
    const cur = { k, size: m.W + '×' + m.H, boss: !!st.boss };
    if (prev) { pairs++; if (prev.k === cur.k && prev.size === cur.size && !prev.boss && !cur.boss && !(RUN.endless && cur.k === 'cave' && f % 2 === 0)) { alike++; alikeAt.push(`seed ${s} f${f - 1}–${f}`); } }
    prev = cur; }
  seqs.set(seq.join(' '), (seqs.get(seq.join(' ')) || 0) + 1); }
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), fails = [];
const table = rows.map((q, i) => ({ floor: i + 1 + (q.boss * 2 > q.n ? ' (boss)' : ''), kinds: Object.entries(q.kinds).map(([k, v]) => `${k} ${v}`).join(', '), size: Object.keys(q.size).join(' '),
  rooms: `${Math.min(...q.rooms)}–${Math.max(...q.rooms)} (${avg(q.rooms).toFixed(1)})`, spread: Math.max(...q.rooms) - Math.min(...q.rooms), shapes: +avg(q.shapes).toFixed(1), shapesMixed: q.mixed ? +avg(q.mixed).toFixed(1) : null,
  dead: +(q.dead / (q.all || 1)).toFixed(2), walk: `${Math.min(...q.walk)}–${Math.max(...q.walk)} (${avg(q.walk).toFixed(0)})`, short: +(q.short / q.n).toFixed(2), rooms0: q }));
if (seqs.size < BAND.seqs) fails.push(`${seqs.size} different sequences of biome and layout over ${N} seeds (band ≥ ${BAND.seqs})`);
if (alike) fails.push(`${alike} of ${pairs} floors running alike, layout and size both (${alikeAt.slice(0, 4).join(', ')}${alike > 4 ? ', …' : ''})`);
for (const t of table) { const caves = Object.keys(t.rooms0.kinds).every((k) => k === 'cave' || k === 'plateau');
  if (t.spread < BAND.spread) fails.push(`floor ${t.floor}: its room count moves ${t.spread} over the seeds (band ≥ ${BAND.spread})`);
  // (a catacomb's and a tomb's rooms are all plain boxes by design: the shapes band holds for the floors of other layouts)
  if (!caves && t.shapesMixed !== null && t.shapesMixed < BAND.shapes) fails.push(`floor ${t.floor}: ${t.shapesMixed} room shapes a floor of mixed layouts (band ≥ ${BAND.shapes})`);
  if (t.dead < BAND.dead) fails.push(`floor ${t.floor}: ${t.dead} of its rooms are dead ends (band ≥ ${BAND.dead})`);
  const sb = BAND.short;
  if (t.short > sb) fails.push(`floor ${t.floor}: ${t.short} of its floors walk to the ${t.rooms0.boss * 2 > t.rooms0.n ? 'boss' : 'stairs'} in under ${BAND.shortK} of the map's width and height (band ≤ ${sb})`); }
if (json) console.log(JSON.stringify({ mode, seeds: N, seqs: seqs.size, alike, pairs, table: table.map(({ rooms0, ...t }) => t), fails }));
else {
  console.log(`${mode}, ${N} seeds × ${F} floors: ${seqs.size} different sequences of biome and layout, ${alike} of ${pairs} floors running alike`);
  const H = ['floor', 'layouts', 'map', 'rooms', 'shapes', 'dead ends', 'walk to stairs', 'short'];
  console.log(H.join(' | ')); console.log(H.map(() => '---').join(' | '));
  for (const t of table) console.log([t.floor, t.kinds, t.size, t.rooms, t.shapes, t.dead, t.walk, t.short].join(' | '));
  const top = [...seqs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [k, v] of top) console.log(`  ${v}× ${k.split(' ').map((x) => x.split(':')[1]).join(' ')}`);
  for (const f of fails) console.log('FAIL ' + f);
  console.log(fails.length ? `variety: ${fails.length} failure(s)` : 'variety ok'); }
process.exitCode = fails.length ? 2 : 0;
