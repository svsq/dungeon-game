// node tools/measure/game/bends.cjs [N] — TASKS 1939: terrace bend detours (crossings with `bend`) on the town run's magma floors,
// seeds 1..N: bends per floor, their slab cells, how much longer the way round is than the way over the crossing it pairs
// (`of`), whether the hero can walk it end to end in the sim (enemies off), hits on the bend vs on the crossing (blind walk,
// hazards on), and a chest/secret anywhere near it. Prints the campaign seed and a cell of each bend for the frame set.
const { SIM, D, T, cellOf, bfs, follow, mean, solidCells } = require('./lib.cjs'), { mkT } = require('./survey.cjs'); const N = +(process.argv[2] || 30);
const rows = [];
for (let sd = 1; sd <= N; sd++) for (const f of [14, 15]) { const S = mkT(sd, f), R = S.run, m = R.map, h = R.hero, W = m.W; if (m.biome !== 'magma' || m.ftype !== 'terrace') continue; R.en = [];
  const X = m.crossings || [], groups = {}; X.filter((c) => c.bend).forEach((c) => (groups[c.of] = groups[c.of] || []).push(c));
  const deck = new Set(X.flatMap((c) => c.cells)), cr = new Set(m.crust || []), solid = solidCells(R), ok = (k) => (m.cells[k] === 1 || deck.has(k) || cr.has(k)) && !solid.has(k);
  const home = [h.x, h.y];
  for (const [of, bs] of Object.entries(groups)) { const B = X.find((c) => !c.bend && c.cells.includes(+of)); if (!B) { rows.push({ sd, f, of, noB: 1 }); continue; }
    const bcells = new Set(bs.flatMap((c) => c.cells)), Bc = new Set(B.cells);
    // ends of the crossing: floor cells next to its first and last cells
    const ends = [B.cells[0], B.cells[B.cells.length - 1]].map((k) => [1, -1, W, -W].map((o) => k + o).find((n) => m.cells[n] === 1 && !Bc.has(n)) ?? k);
    const over = bfs(m, ends[0], ends[1], ok), round = bfs(m, ends[0], ends[1], ok, Bc);
    const usesBend = round ? round.filter((k) => bcells.has(k)).length : 0;
    let walk = null; if (round) { h.x = (ends[0] % W + 0.5) * T; h.y = (Math.floor(ends[0] / W) + 0.5) * T + 2; h.hp = 1e5; h.stag = null; h.burn = 0; const r = follow(S, round, 120); walk = { ok: r.ok, t: +r.t.toFixed(1), hits: r.hits.filter((x) => x.src !== 'burn').length, lava: r.evs.some((e) => e.k === 'sink' || e.k === 'lava') }; }
    let walkB = null; if (over) { h.x = (ends[0] % W + 0.5) * T; h.y = (Math.floor(ends[0] / W) + 0.5) * T + 2; h.hp = 1e5; h.stag = null; h.burn = 0; const r = follow(S, over, 120); walkB = { ok: r.ok, t: +r.t.toFixed(1), hits: r.hits.filter((x) => x.src !== 'burn').length }; }
    const near = (R.chests || []).filter((c) => [...bcells].some((k) => Math.hypot((k % W + 0.5) * T - c.x, (Math.floor(k / W) + 0.5) * T - c.y) < 3 * T)).length;
    const hazOnB = (m.hazards || []).filter((z) => B.cells.some((k) => D.hazIn(z, (k % W + 0.5) * T, (Math.floor(k / W) + 0.5) * T))).map((z) => z.k + (z.gate ? 'G' : ''));
    const hazOnBend = (m.hazards || []).filter((z) => [...bcells].some((k) => D.hazIn(z, (k % W + 0.5) * T, (Math.floor(k / W) + 0.5) * T))).map((z) => z.k);
    const mid = [...bcells][bcells.size >> 1];
    rows.push({ sd, camp: sd * 7, f, of: +of, rows: bs.length, slabs: bcells.size, B: B.kind + ':' + B.cells.length, over: over && over.length, round: round && round.length, usesBend, walk, walkB, chestNear: near, hazOnB, hazOnBend, at: [mid % W, Math.floor(mid / W)] }); }
  h.x = home[0]; h.y = home[1]; }
for (const r of rows) console.log(JSON.stringify(r));
const A = rows.filter((r) => !r.noB), fl = new Set(A.map((r) => r.sd + '/' + r.f));
console.log(`\nterrace floors with bends ${fl.size}, bends ${A.length} (${(A.length / fl.size).toFixed(1)}/floor), slab cells mean ${mean(A.map((r) => r.slabs)).toFixed(0)}`);
console.log(`way round minus way over: p50 ${A.filter((r) => r.round).map((r) => r.round - r.over).sort((a, b) => a - b)[A.length >> 1]}, the round uses the bend ${A.filter((r) => r.usesBend).length}/${A.length}`);
console.log(`walkable end to end ${A.filter((r) => r.walk && r.walk.ok).length}/${A.length}; time round ${mean(A.filter((r) => r.walk && r.walk.ok).map((r) => r.walk.t)).toFixed(1)} s vs over ${mean(A.filter((r) => r.walkB && r.walkB.ok).map((r) => r.walkB.t)).toFixed(1)} s`);
console.log(`hazards over the crossing it pairs: ${A.filter((r) => r.hazOnB.length).length}/${A.length}; over the bend ${A.filter((r) => r.hazOnBend.length).length}/${A.length}; hits blind round ${A.reduce((s, r) => s + (r.walk ? r.walk.hits : 0), 0)} vs over ${A.reduce((s, r) => s + (r.walkB ? r.walkB.hits : 0), 0)}; chest within 3 cells ${A.filter((r) => r.chestNear).length}`);
