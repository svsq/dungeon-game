// node tools/hazwalk.cjs N K [nogate|gate] [out.json]: magma floors 1–3 of seeds 1–N, the walk to the stairs with no monsters, K blind walks at random
// phases; the sum of the hero's hurt per walk (all sources: rocks, vents, gates, surges, lava, burns), floors with gates and without
// apart. nogate: HAZ.vent.gate switched off before the floors are built, the base the gates are held to (TASKS 1689)
const ROOT = require('path').join(__dirname, '..');
const SIM = require(ROOT + '/live/sim.js'), D = require(ROOT + '/live/data.js'), DG = require(ROOT + '/live/dungeon.js');
const T = 32, N4 = (W) => [1, -1, W, -W];

const mk = (sd, f) => {
  const S = SIM.create(); S.demo = 0; S.meta = S.meta || {}; S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; if (f > 1) SIM.enterFloor(S, S.run, f);
  S.run.en = []; return S;
};
const cellOf = (m, x, y) => Math.floor(y / T) * m.W + Math.floor(x / T);
const bfs = (m, s, e, ok, ban) => {
  const W = m.W, blk = new Set(m.block || []), from = new Int32Array(W * m.H).fill(-2), q = [s]; from[s] = -1;
  for (let i = 0; i < q.length && from[e] === -2; i++) for (const o of N4(W)) { const n = q[i] + o; if (from[n] === -2 && ok(n) && !blk.has(n) && !(ban && ban.has(n))) { from[n] = q[i]; q.push(n); } }
  if (from[e] === -2) return null; const out = []; for (let k = e; k >= 0; k = from[k]) out.push(k); return out.reverse();
};
const solidCells = (R) => { const m = R.map, out = new Set(); const add = (x, y) => out.add(cellOf(m, x, y));
  for (const p of R.pots || []) if (p.hp > 0) add(p.x, p.y); for (const c of R.chests || []) add(c.x, c.y); for (const t of m.torches || []) add(t.x, t.y);
  for (const d of m.decor || []) if (d.solid && !d.broken) add(d.x, d.y); return out; };
const way = (S) => { const R = S.run, m = R.map, b = solidCells(R), e = m.exit.ty * m.W + m.exit.tx; b.delete(e);
  return bfs(m, cellOf(m, R.hero.x, R.hero.y), e, (k) => m.cells[k] === 1, b); };
const evNow = (S) => S.ev.filter((e) => e.t === S.t);
const follow = (S, path, lim = 200) => {
  const R = S.run, m = R.map, h = R.hero, W = m.W, t0 = S.t, hits = []; let i = 0, last = [h.x, h.y], still = 0;
  while (S.t - t0 < lim) {
    const here = cellOf(m, h.x, h.y); const j = path.indexOf(here, Math.max(0, i - 3)); if (j >= i) i = j;
    if (i >= path.length - 1 && Math.hypot((path[path.length - 1] % W + 0.5) * T - h.x, (Math.floor(path[path.length - 1] / W) + 0.5) * T + 2 - h.y) < 14) return { ok: true, t: S.t - t0, hits };
    const g = path[Math.min(path.length - 1, i + 1)], gx = (g % W + 0.5) * T, gy = (Math.floor(g / W) + 0.5) * T + 2, dx = gx - h.x, dy = gy - h.y;
    const inp = { left: dx < -4, right: dx > 4, up: dy < -4, down: dy > 4, px: 960, py: 540, keys: [] };
    SIM.step(S, inp);
    for (const e of evNow(S)) { if (e.k === 'hurt') hits.push({ src: e.src, n: Math.round(e.n), t: +(S.t - t0).toFixed(2) }); }
    if (Math.hypot(h.x - last[0], h.y - last[1]) < 0.3 && !h.sunk) still++; else still = 0; last = [h.x, h.y]; if (still > 240) return { ok: false, t: S.t - t0, hits, at: [Math.round(h.x), Math.round(h.y)] };
  }
  return { ok: false, t: lim, hits, timeout: 1 };
};
const idle = (S, sec) => { for (let i = 0; i < Math.round(sec / SIM.DT); i++) SIM.step(S, { keys: [] }); };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

const N = +(process.argv[2] || 30), K = +(process.argv[3] || 3), off = process.argv[4] === 'nogate';
if (off) D.HAZ.vent.gate = undefined;
let rnd = 12345; const rand = () => ((rnd = (rnd * 1103515245 + 12345) >>> 0) / 4294967296);
const by = { gate: [], plain: [] }, src = {}, floors = { gate: 0, plain: 0 }; let all = []; const per = {}, gated = [];
for (let sd = 1; sd <= N; sd++) for (let f = 1; f <= 3; f++) {
  const S0 = mk(sd, f), m0 = S0.run.map, path = way(S0); if (!path) continue; const k0 = m0.hazards.some((z) => z.gate) ? 'gate' : 'plain'; floors[k0]++; if (k0 === 'gate') gated.push(sd + ':' + f);
  for (let k = 0; k < K; k++) { const S = mk(sd, f); S.run.hero.hp = 1e9; idle(S, rand() * 7); const r = follow(S, path, 240);
    const n = r.hits.reduce((a, q) => a + q.n, 0); by[k0].push(n); all.push(n); per[sd + ':' + f] = (per[sd + ':' + f] || 0) + n / K; for (const q of r.hits) src[q.src] = (src[q.src] || 0) + q.n; } }
console.log(`${off ? 'no gates' : 'gates'}: floors ${floors.gate} with gates, ${floors.plain} without; hurt per walk: all ${mean(all).toFixed(2)}, gate floors ${mean(by.gate).toFixed(2)}, others ${mean(by.plain).toFixed(2)}; by src ${JSON.stringify(Object.fromEntries(Object.entries(src).map(([k, v]) => [k, +(v / all.length).toFixed(2)])))}`);
if (process.argv[5]) require('fs').writeFileSync(process.argv[5], JSON.stringify({ per, gate: gated }));
