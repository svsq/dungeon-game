const ROOT = require('path').resolve(process.env.ROOT || require('path').join(__dirname, '../../..'));
const SIM = require(ROOT + '/live/sim.js'), D = require(ROOT + '/live/data.js'), DG = require(ROOT + '/live/dungeon.js');
const T = 32, N4 = (W) => [1, -1, W, -W];

const mk = (sd, f, keepEnemies) => {
  const S = SIM.create(); S.demo = 0; S.meta = S.meta || {}; S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; if (f > 1) SIM.enterFloor(S, S.run, f);
  const R = S.run; if (!keepEnemies) R.en = []; return S;
};
const cellOf = (m, x, y) => Math.floor(y / T) * m.W + Math.floor(x / T);
const walkable = (m) => (k) => m.cells[k] === 1;
const bfs = (m, s, e, ok, ban) => {
  const W = m.W, blk = new Set(m.block || []), from = new Int32Array(W * m.H).fill(-2), q = [s]; from[s] = -1;
  for (let i = 0; i < q.length && from[e] === -2; i++) for (const o of N4(W)) { const n = q[i] + o; if (from[n] === -2 && ok(n) && !blk.has(n) && !(ban && ban.has(n))) { from[n] = q[i]; q.push(n); } }
  if (from[e] === -2) return null; const out = []; for (let k = e; k >= 0; k = from[k]) out.push(k); return out.reverse();
};
const solidCells = (R) => { const m = R.map, out = new Set(); const add = (x, y) => out.add(cellOf(m, x, y));
  for (const p of R.pots || []) if (p.hp > 0) add(p.x, p.y); for (const c of R.chests || []) add(c.x, c.y); for (const t of m.torches || []) add(t.x, t.y);
  for (const d of m.decor || []) if (d.solid && !d.broken) add(d.x, d.y); return out; };
const way = (S, ban, to, ok) => { const R = S.run, m = R.map, b = solidCells(R); if (ban) for (const k of ban) b.add(k); const e = to ?? (m.exit.ty * m.W + m.exit.tx); b.delete(e);
  return bfs(m, cellOf(m, R.hero.x, R.hero.y), e, ok || ((k) => m.cells[k] === 1), b); };
const evNow = (S) => S.ev.filter((e) => e.t === S.t);
// follow a list of cells with real SIM.step input; returns { ok, t, hits:[{src,n,t}], ev }
const follow = (S, path, lim = 200, onStep) => {
  const R = S.run, m = R.map, h = R.hero, W = m.W, t0 = S.t, hits = [], evs = []; let i = 0, last = [h.x, h.y], still = 0;
  while (S.t - t0 < lim) {
    const here = cellOf(m, h.x, h.y); const j = path.indexOf(here, Math.max(0, i - 3)); if (j >= i) i = j;
    if (i >= path.length - 1 && Math.hypot((path[path.length - 1] % W + 0.5) * T - h.x, (Math.floor(path[path.length - 1] / W) + 0.5) * T + 2 - h.y) < 14) return { ok: true, t: S.t - t0, hits, evs };
    const g = path[Math.min(path.length - 1, i + 1)], gx = (g % W + 0.5) * T, gy = (Math.floor(g / W) + 0.5) * T + 2, dx = gx - h.x, dy = gy - h.y;
    const inp = { left: dx < -4, right: dx > 4, up: dy < -4, down: dy > 4, px: 960, py: 540, keys: [] };
    if (onStep) onStep(S, inp, i);
    SIM.step(S, inp);
    for (const e of evNow(S)) { evs.push(e); if (e.k === 'hurt') hits.push({ src: e.src, n: Math.round(e.n), t: +(S.t - t0).toFixed(2) }); }
    if (Math.hypot(h.x - last[0], h.y - last[1]) < 0.3 && !h.sunk) still++; else still = 0; last = [h.x, h.y]; if (still > 240) return { ok: false, t: S.t - t0, hits, evs, at: [Math.round(h.x), Math.round(h.y)] };
  }
  return { ok: false, t: lim, hits, evs, timeout: 1 };
};
const idle = (S, sec) => { for (let i = 0; i < Math.round(sec / SIM.DT); i++) SIM.step(S, { keys: [] }); };
const ringCells = (m, z) => { const out = []; if (z.k === 'surge') return z.cells.slice(); const H = D.HAZ[z.k];
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const k = cellOf(m, z.x, z.y) + j * m.W + i; if (D.hazIn(z, (k % m.W + 0.5) * T, (Math.floor(k / m.W) + 0.5) * T)) out.push(k); } return out; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
module.exports = { solidCells, way, ROOT, SIM, D, DG, T, mk, cellOf, walkable, bfs, follow, idle, ringCells, mean, evNow };
