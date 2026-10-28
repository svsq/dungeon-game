// live/dungeon.js — procedural floor generator: genFloor(seed, floor, { mode }) → plain JSON map data. Pure function of its inputs.
// Rooms placed at random without overlap → MST + extra loop edges → 2-wide L corridors → start room at a leaf,
// exit room farthest by graph distance (floor 8: the boss lair) → room roles → contents (enemies, chests, pots, traps,
// lava, torches, decor) → validation (everything reachable from the start, spawns on open floor).
(function (root) {
  const D = root.DATA || require('./data.js');
  const { TILE, ENEMIES } = D;
  // how far each light source reaches, in tiles (matches the glow radii of the scene's light map)
  const LIGHT_R = { wall: 6.5, brazier: 6.5, fire: 8.5, candles: 3, candlestick: 3.5, candelabra: 4.5, torch_stand: 6.5, crystal: 6.5, shrine: 6, lava: 3.5, shroom: 5, shroom_a: 5, shroom_b: 5, crystal_cv: 6.5 };
  // cells: 0 rock, 1 floor, 3 lava (blocks walking, not projectiles), 4 a secret room's fake wall (solid until broken), 5 a shut door
  // (set by the sim), 6 deep water (blocks walking and knockback, not projectiles or sight)
  const mul32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  function genFloor(seed, floor, opts = {}) {
    // a floor without a secret room is rerolled a few times before one is accepted, unless it meant to have none
    for (let attempt = 0; attempt < 20; attempt++) { const m = tryGen((seed + attempt * 7919) >>> 0, floor, opts); if (m && (m.secrets.length || !m.secretsWanted || attempt >= 12)) return m; }
    throw new Error('dungeon generation failed');
  }

  // runs of floor cells longer than four along one straight wall (rock or a fake wall beyond each), in each of the four
  // directions: { x, y } its first cell, (dx, dy) along it, (nx, ny) towards the rock, n its length; skip(x, y) leaves cells out
  function straightRuns(cells, W, H, skip) {
    const rock = (x, y) => x < 0 || y < 0 || x >= W || y >= H || cells[y * W + x] === 0 || cells[y * W + x] === 4, out = [];
    for (const [nx, ny] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const dx = ny ? 1 : 0, dy = nx ? 1 : 0, A = ny ? H : W, B = ny ? W : H;
      for (let a = 0; a < A; a++) { let n = 0;
        for (let b = 0; b <= B; b++) { const x = ny ? b : a, y = ny ? a : b, on = b < B && cells[y * W + x] === 1 && rock(x + nx, y + ny) && !skip(x, y);
          if (on) n++; else { if (n > 4) out.push({ x: x - dx * n, y: y - dy * n, dx, dy, nx, ny, n }); n = 0; } } } }
    return out;
  }

  function tryGen(seed, floor, opts) {
    const R = mul32(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = (arr) => arr[Math.floor(R() * arr.length)];
    // depth: the campaign floor this one is worth in monsters, elites, traps and ambushes; floor: its place in its own run
    const N = D.runOf(opts.mode), depth = floor + N.depth, last = floor === N.floors;
    const biome = N.biome(floor), bossType = !opts.endless && N.boss(floor), boss = !!bossType;
    // the cave archetype (R-18, TASKS 301): the same rooms and links, but a room is a blob of floor inside its box round a core
    // where the start's fire or the stairs stand, a link is a winding tunnel 2–4 cells wide, and small dead-end pockets hang off
    // the rooms for a chest or an ambush; the map grows floor by floor and has no straight stretch of wall longer than four cells
    const cave = N.arch === 'cave';
    const [W, H] = cave ? N.size[floor - 1] : [72, 54], cells = new Array(W * H).fill(0), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : cells[y * W + x]);
    const set = (x, y, v) => { if (x > 1 && y > 2 && x < W - 2 && y < H - 2) cells[y * W + x] = v; };
    // ---- rooms ----
    // a cave's rooms stand six cells apart and more: the rock between them holds its water and its long tunnels
    const rooms = [], want = cave ? Math.round(W * H / 420) : 13 + Math.min(4, depth >> 1);
    const apart = (x, y, w, h, g = cave ? [6, 6] : [2, 3]) => !rooms.some((r) => x < r.x + r.w + g[0] && x + w + g[0] > r.x && y < r.y + r.h + g[1] && y + h + g[1] > r.y);
    for (let i = 0; i < 900 && rooms.length < want; i++) {
      const big = rooms.length === 0 && boss;
      const w = big ? 18 : cave ? ri(9, 15) : ri(7, 14), h = big ? 14 : cave ? ri(8, 12) : ri(6, 10), x = ri(3, W - w - 3), y = ri(4, H - h - 3);
      if (!apart(x, y, w, h)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length });
    }
    if (rooms.length < (cave ? 6 : 8)) return null;
    const main = rooms.length;
    if (cave) for (let i = 0, n = ri(2, 3); i < 400 && rooms.length < main + n; i++) { const w = ri(5, 6), h = ri(5, 6), x = ri(3, W - w - 3), y = ri(4, H - h - 3);
      if (apart(x, y, w, h, [3, 3])) rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, pocket: 1 }); }
    const keep = new Set();
    if (!cave) for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, 1);
    else for (const r of rooms) { const ph = [0, 1, 2, 3].map(() => R() * 6.283), am = [0, 1, 2, 3].map((k) => (0.04 + 0.1 * R()) / (1 + 0.5 * k)), hw = r.w / 2, hh = r.h / 2;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const u = (x + 0.5 - r.x - hw) / hw, v = (y + 0.5 - r.y - hh) / hh, a = Math.atan2(v, u);
        let lim = 1.1; for (let k = 0; k < 4; k++) lim -= am[k] * (1 + Math.cos((k + 2) * a + ph[k])); if (Math.hypot(u, v) < lim) set(x, y, 1); }
      const [x0, x1, y0, y1] = r.pocket ? [r.cx - 1, r.cx, r.cy - 1, r.cy] : r.id === 0 && boss ? [r.cx - 4, r.cx + 3, r.cy - 4, r.cy + 5] : [r.cx - 1, r.cx + 2, r.cy - 1, r.cy + 3];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { set(x, y, 1); keep.add(y * W + x); } }
    // ---- connections: Prim MST on centre distance + extra short edges for loops ----
    const dist = (a, b) => Math.hypot(a.cx - b.cx, (a.cy - b.cy) * 1.2);
    const inT = new Set([0]), edges = [];
    while (inT.size < main) { let best = null;
      for (const a of inT) for (let b = 0; b < main; b++) if (!inT.has(b)) { const d = dist(rooms[a], rooms[b]); if (!best || d < best[2]) best = [a, b, d]; }
      edges.push(best); inT.add(best[1]); }
    // a pocket hangs off its nearest room and leads nowhere else
    for (let p = main; p < rooms.length; p++) { let best = null; for (let b = 0; b < main; b++) { const d = dist(rooms[p], rooms[b]); if (!best || d < best[2]) best = [b, p, d]; } edges.push(best); }
    for (let a = 0; a < main; a++) for (let b = a + 1; b < main; b++) {
      if (edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) continue;
      const d = dist(rooms[a], rooms[b]); if (d < 26 && R() < 0.28) edges.push([a, b, d]); }
    const carveH = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { if (!at(x, y)) set(x, y, 1); if (!at(x, y + 1)) set(x, y + 1, 1); } };
    const carveV = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { if (!at(x, y)) set(x, y, 1); if (!at(x + 1, y)) set(x + 1, y, 1); } };
    // a tunnel bends off the straight line between the two cores and comes back to it, 2–4 cells wide; its middle line is kept
    // open through the smoothing so it never closes
    const tunnel = (A, B) => { const x0 = A.cx + 0.5, y0 = A.cy + 0.5, x1 = B.cx + 0.5, y1 = B.cy + 0.5, L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const amp = Math.min(4, L / 6) * (0.4 + 0.6 * R()) * (R() < 0.5 ? -1 : 1), turns = 1 + Math.floor(R() * 2), wd = 2 + Math.floor(R() * 2), wide = R() * 6.283;
      for (let s = 0; s <= L; s += 0.5) { const t = s / L, o = amp * Math.sin(Math.PI * t * turns) * Math.sin(Math.PI * t), px = x0 + (x1 - x0) * t + nx * o, py = y0 + (y1 - y0) * t + ny * o;
        const b = wd + (Math.sin(t * 9 + wide) > 0.7 ? 1 : 0), bx = Math.round(px - b / 2), by = Math.round(py - b / 2);
        for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) set(bx + i, by + j, 1); keep.add(Math.floor(py) * W + Math.floor(px)); } };
    for (const [a, b] of edges) { const A = rooms[a], B = rooms[b];
      if (cave) tunnel(A, B);
      else if (R() < 0.5) { carveH(A.cx, B.cx, A.cy); carveV(A.cy, B.cy, B.cx); } else { carveV(A.cy, B.cy, A.cx); carveH(A.cx, B.cx, B.cy); } }
    // the cave's walls are smoothed (spurs into rock filled, lone rock knobs in the floor dug out), and floor the smoothing cut off
    // from the rooms goes back to rock
    const reach = () => { const seen = new Uint8Array(W * H), st = [rooms[0].cy * W + rooms[0].cx]; seen[st[0]] = 1;
      while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (cells[n] && !seen[n]) { seen[n] = 1; st.push(n); } } } return seen; };
    if (cave) { for (let pass = 0; pass < 2; pass++) { const nb = cells.slice();
        for (let y = 3; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && !at(x + i, y + j)) n++;
          const k = y * W + x; if (cells[k] && n >= 6 && !keep.has(k)) nb[k] = 0; else if (!cells[k] && n <= 2) nb[k] = 1; }
        for (let k = 0; k < W * H; k++) cells[k] = nb[k]; }
      const seen = reach(); for (let k = 0; k < W * H; k++) if (cells[k] && !seen[k]) cells[k] = 0; }
    // two floors meeting only at a cell's corner (a 2×2 of floor and rock on the diagonals) can't be walked but let blows and bolts
    // through the corner: open the square into a two-cell way, like the corridors (TASKS 174)
    // rock one cell thick between floor above and below has room for a wall face but not its top, so it hangs in the floor as a
    // strip of masonry: it is dug out and the two floors merge (TASKS 178); a two-cell wall keeps its top and face
    const tidy = () => { for (let pass = 0, n = 1; n && pass < 6; pass++) { n = 0;
      for (let y = 2; y < H - 3; y++) for (let x = 1; x < W - 3; x++) { const a = !at(x, y), b = !at(x + 1, y), c = !at(x, y + 1), d = !at(x + 1, y + 1);
        if (a === d && b === c && a !== b) { n++; set(x, y, 1); set(x + 1, y, 1); set(x, y + 1, 1); set(x + 1, y + 1, 1); } }
      for (let y = 3; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (!at(x, y) && at(x, y - 1) && at(x, y + 1)) { n++; set(x, y, 1); } } };
    tidy();
    // a straight stretch of cave wall over four cells is broken in its middle, by a niche dug into the rock or a knob of rock left
    // in the floor (only where two cells of floor stay open past it)
    const breakRuns = (skip) => { for (let pass = 0; pass < 8; pass++) { const runs = straightRuns(cells, W, H, skip); if (!runs.length) break;
      for (const { x, y, dx, dy, nx, ny, n } of runs) { const mx = x + dx * (n >> 1), my = y + dy * (n >> 1);
        if (R() < 0.5 && at(mx - nx, my - ny) && at(mx - 2 * nx, my - 2 * ny)) set(mx, my, 0); else set(mx + nx, my + ny, 1); }
      tidy(); const seen = reach(); for (let k = 0; k < W * H; k++) if (cells[k] && !seen[k]) cells[k] = 0; } };
    if (cave) breakRuns(() => false);
    const adj = rooms.map(() => []); for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
    // ---- roles: start at a leaf on the rim, exit farthest by hops then distance ----
    const hops = (from) => { const h = rooms.map(() => 99), q = [from.id]; h[from.id] = 0;
      while (q.length) { const a = q.shift(); for (const b of adj[a]) if (h[b] > h[a] + 1) { h[b] = h[a] + 1; q.push(b); } } return h; };
    let leaves = rooms.filter((r) => adj[r.id].length === 1 && !(boss && r.id === 0) && !r.pocket);
    // the boss hall is fixed (the biggest room), so the start is among the rooms farthest from it on foot (rim leaves first), or the
    // boss was a room away; the walk is counted on the carved cells, not by room hops: corridors cut through rooms and merge
    if (boss) { const d = new Array(W * H).fill(-1), q = [rooms[0].cy * W + rooms[0].cx], at0 = (r) => d[r.cy * W + r.cx]; d[q[0]] = 0;
      for (let i = 0; i < q.length; i++) { const c = q[i]; for (const n of [c - 1, c + 1, c - W, c + W]) if (cells[n] && d[n] < 0) { d[n] = d[c] + 1; q.push(n); } }
      const farAll = Math.max(...rooms.map(at0)); if (!leaves.some((r) => at0(r) >= farAll * 0.6)) leaves = rooms.slice(1, main);
      const far = Math.max(...leaves.map(at0)); leaves = leaves.filter((r) => at0(r) >= far * 0.8); }
    const start = (leaves.length ? pick(leaves) : rooms[rooms.length - 1]);
    const hop = hops(start);
    const exitR = boss ? rooms[0] : rooms.filter((r) => r !== start && !r.pocket).sort((p, q2) => (hop[q2.id] - hop[p.id]) || (dist(q2, start) - dist(p, start)))[0];
    start.type = 'start'; exitR.type = boss ? 'boss' : 'exit';
    // a Fisher–Yates shuffle: a random sort comparator gives each JS engine its own order, so node checks would see other maps than the browser
    const others = rooms.filter((r) => r.type === 'combat'); for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    const nTreasure = 1 + (R() < 0.5 ? 1 : 0);
    if (cave) others.sort((a, b) => (b.pocket || 0) - (a.pocket || 0));
    others.slice(0, nTreasure).forEach((r) => (r.type = 'treasure'));
    // an altar on every second floor (TASKS 137), the last one on the floor before the boss's: past him a gift buys nothing
    // (TASKS 183); the roll stays so the rest of the floor is laid out as before
    R(); if (!boss && (floor % 2 === 0 || floor === N.floors - 1)) ((cave ? others.find((r) => r.type === 'combat' && !r.pocket) : others[nTreasure]) || others[0] || rooms.find((r) => r.type === 'treasure') || {}).type = 'shrine';
    // the merchant's room, on every floor: the counter and his back wall need a solid top wall and no corridor mouth near them
    const isDoor = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const nx = x + i, ny = y + j;
      if (at(nx, ny) === 1 && !rooms.some((q) => nx >= q.x && nx < q.x + q.w && ny >= q.y && ny < q.y + q.h)) return true; } return false; };
    const shopFits = (r) => { if (r.w < 8 || r.h < 6) return false;
      for (let x = r.cx - 3; x <= r.cx + 3; x++) { if (Math.abs(x - r.cx) <= 2 && at(x, r.y - 1) !== 0) return false; for (let y = r.y; y <= r.y + 3; y++) if (isDoor(x, y)) return false; }
      return true; };
    // in a cave the merchant's corner is squared off under a straight back wall, two cells of rock thick (the only straight wall
    // the cave keeps); the rest of his room stays a blob
    const caveShop = (r) => !r.pocket && r.w >= 9 && r.y >= 6 && [-1, -2].every((d) => Array.from({ length: 9 }, (_, i) => r.cx - 4 + i).every((x) => at(x, r.y + d) === 0))
      && Array.from({ length: 9 }, (_, i) => r.cx - 4 + i).every((x) => [0, 1, 2, 3].every((j) => !isDoor(x, r.y + j)));
    const shopR = others.find((r) => r.type === 'combat' && (cave ? caveShop(r) : shopFits(r)));
    if (!shopR) return null;
    shopR.type = 'shop';
    const shopCorner = (x, y) => Math.abs(x - shopR.cx) <= 5 && y >= shopR.y - 2 && y <= shopR.y + 5;
    if (cave) { for (let y = shopR.y; y <= shopR.y + 4; y++) for (let x = shopR.cx - 4; x <= shopR.cx + 4; x++) set(x, y, 1); tidy(); breakRuns(shopCorner); }
    // a biome with no spiders has no webs, so plates and ambushes make up for them: the traps grow towards the end, not thin out
    const webless = !D.BIOMES[biome].roster.includes('spider');
    for (const r of others) if (r.type === 'combat' && R() < (webless ? 0.55 : 0.35) && r.w >= 8) r.trap = 1;
    // accent zones: one or two rooms per floor in another biome's look (the reference shows a green crypt and a blue hall
    // beside the torch-lit dungeon in one view)
    const zones = ['crypt', 'arcane', 'dungeon'].filter((z) => z !== biome);
    if (!cave) others.filter((r) => r.type === 'combat' || r.type === 'treasure').slice(0, 1 + (R() < 0.6 ? 1 : 0)).forEach((r, i) => (r.zone = zones[(i + Math.floor(R() * 2)) % zones.length]));
    // a staged view (the QA match) sets its zones after the draw above, so the layout stays the seed's
    if (opts.zones) for (const r of rooms) if (r.id in opts.zones) { if (opts.zones[r.id]) r.zone = opts.zones[r.id]; else delete r.zone; }
    // ---- lava pools (lava biome / arcane boss): blobs in a room's side bays, off the 2-wide corridor lanes through its centre
    // and clear of every corridor mouth; a pool is kept only if every floor cell stays reachable ----
    const lava = [];
    const lane = (r, x, y) => (x >= r.cx - 1 && x <= r.cx + 2) || (y >= r.cy - 1 && y <= r.cy + 2);
    const pool = (r) => { for (let k = 0; k < 6; k++) { const pw = ri(2, Math.min(5, r.w - 5)), ph = ri(2, Math.min(4, r.h - 4)), px = ri(r.x + 1, r.x + r.w - 1 - pw), py = ri(r.y + 1, r.y + r.h - 1 - ph);
        const saved = []; for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) {
          if ((x === px || x === px + pw - 1) && (y === py || y === py + ph - 1) && pw > 2 && ph > 2 && R() < 0.6) continue;
          if (at(x, y) === 1 && !lane(r, x, y) && !isDoor(x, y) && !isDoor(x - 1, y) && !isDoor(x + 1, y) && !isDoor(x, y - 1) && !isDoor(x, y + 1)) { saved.push([x, y]); set(x, y, 3); } }
        if (saved.length < 3 || !connected()) { for (const [x, y] of saved) set(x, y, 1); continue; }
        lava.push(...saved); return; } };
    // ---- the fire depths (TASKS 186): blobs in side bays never read as a lava floor. Rivers 2–5 cells wide run across rooms from
    // under one wall to under the other, a lava hall is mostly lava with stone paths from its ways in to an island, and every
    // river is crossed by a two-cell stone causeway where the corridors' lanes run through the room. A river or hall that would
    // cut any floor off is undone. flow: lava cell → the way its crust drifts (0 right, 1 down, 2 left, 3 up); pools lie still ----
    const flow = {}, streams = [];
    const lavaRoom = (r) => r.type === 'combat' && !r.zone && !streams.some((q) => q.room === r.id);
    // a river is a channel walked from a spring under the rock, across a room (and any corridor or room on its way) to a dead end,
    // 2–4 cells wide and wandering: through rock it is a trench between masonry banks, as in the concept; a corridor it crosses stays
    // floor (a causeway over it), a room it crosses gets a two-cell causeway where its ways in need one
    // scraps the causeways, paths and corridor mouths cut off (fewer than four cells) are dropped: a lone cell of lava reads as a
    // blot. Next to floor a scrap becomes floor, else rock (floor too where rock would hang one cell thick)
    const scraps = (cut) => { const comp = new Set(); for (const [x0, y0] of cut) { if (at(x0, y0) !== 3 || comp.has(y0 * W + x0)) continue; const part = [[x0, y0]]; comp.add(y0 * W + x0);
        for (let i = 0; i < part.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = part[i][0] + dx, y = part[i][1] + dy; if (at(x, y) === 3 && !comp.has(y * W + x)) { comp.add(y * W + x); part.push([x, y]); } }
        if (part.length < 4) for (const [x, y] of part) { const nf = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 1);
          set(x, y, nf || (at(x, y - 1) && at(x, y + 1)) ? 1 : 0); } } };
    const CROSS = ['combat', 'treasure'], roomOf = (x, y) => rooms.find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
    const river = (r, dir) => { const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir], vert = dir % 2 === 1, px = vert ? 1 : 0, py = vert ? 0 : 1;
      if ((vert ? r.w : r.h) < 8) return false;
      // the spring lies 4–9 cells before the room's near wall, level with a spot inside it
      const lat = vert ? ri(r.x + 2, r.x + r.w - 5) : ri(r.y + 2, r.y + r.h - 5), back = ri(4, 9);
      const sx = vert ? lat : dx > 0 ? r.x - back : r.x + r.w - 1 + back, sy = vert ? (dy > 0 ? r.y - back : r.y + r.h - 1 + back) : lat;
      const len = back + (vert ? r.h : r.w) + ri(4, 12); let c = 0, wd = ri(2, 3); const cut = [], crossed = new Set();
      const undo = () => { for (const [x, y] of cut) set(x, y, at(x, y) === 3 ? 0 : at(x, y)); for (const [x, y, v] of was) set(x, y, v); return false; }, was = [];
      walk: for (let i = 0; i < len; i++) {
        if (i && R() < 0.3) c += R() < 0.5 ? -1 : 1;
        if (i && R() < 0.25) wd = Math.max(2, Math.min(4, wd + (R() < 0.5 ? -1 : 1)));
        for (let k = 0; k < wd; k++) { const x = sx + dx * i + px * (c + k), y = sy + dy * i + py * (c + k);
          if (x < 3 || y < 4 || x > W - 4 || y > H - 4) break walk;
          const v = at(x, y), q = roomOf(x, y);
          if (v === 4) return undo();
          if (v === 3) continue;
          if (v === 1) { if (!q) continue; if (!CROSS.includes(q.type) || q.zone) { if (i < back) return undo(); break walk; } if (isDoor(x, y)) continue; crossed.add(q); was.push([x, y, 1]); }
          set(x, y, 3); cut.push([x, y]); } }
      if (!crossed.has(r)) return undo();
      // rock one cell thick between the stream and a floor would hang as a strip of masonry, and a floor and the stream meeting at a
      // cell's corner would pass blows: both become stream
      for (let pass = 0, n = 1; n && pass < 4; pass++) { n = 0;
        for (const [x0, y0] of cut.slice()) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = x0 + i, y = y0 + j;
          if (x < 2 || y < 3 || x > W - 3 || y > H - 3 || at(x, y) !== 0) continue;
          const up = at(x, y - 1), dn = at(x, y + 1);
          if (up && dn && (up === 3 || dn === 3) && up !== 4 && dn !== 4) { set(x, y, 3); cut.push([x, y]); n++; continue; }
          // a 2×2 of open and rock on the diagonals, either way round
          for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const a = at(x + ox, y + oy), b = at(x + ox + 1, y + oy), c2 = at(x + ox, y + oy + 1), d = at(x + ox + 1, y + oy + 1);
            if (!a === !d && !b === !c2 && !a !== !b && [a, b, c2, d].includes(3) && ![a, b, c2, d].includes(4)) { set(x, y, 3); cut.push([x, y]); n++; break; } } } }
      // the crossings: in every room the stream cuts, a two-cell causeway along its middle lanes until nothing is cut off
      const along = ([x, y]) => (vert ? y : x);
      for (const q of crossed) { if (connected()) break; const mid = vert ? q.cy : q.cx;
        for (const m0 of [mid, mid - 2, mid + 2, mid - 3, mid + 3]) { const ford = cut.filter(([x, y]) => roomOf(x, y) === q && at(x, y) === 3 && (along([x, y]) === m0 || along([x, y]) === m0 + 1));
          for (const [x, y] of ford) set(x, y, 1); if (connected()) break; for (const [x, y] of ford) set(x, y, 3); } }
      scraps(cut);
      const live = cut.filter(([x, y]) => at(x, y) === 3);
      if (live.length < 12 || !connected()) return undo();
      for (const [x, y] of live) { lava.push([x, y]); flow[y * W + x] = dir; }
      streams.push({ room: r.id, kind: 'river', n: live.length }); return true; };
    const hall = (r, dir) => { if (r.w < 10 || r.h < 8) return false;
      const inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, keep = new Set(), k2 = (x, y) => y * W + x;
      for (let y = r.cy - 1; y <= r.cy + 1; y++) for (let x = r.cx - 1; x <= r.cx + 1; x++) keep.add(k2(x, y));
      const mouths = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (at(x, y) === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = at(x + dx, y + dy); return (c === 1 || c === 4) && !inR(x + dx, y + dy); })) mouths.push([x, y]);
      // a two-cell path from each way in to the island, the shortest through the room
      for (const [mx, my] of mouths) { const prev = new Map([[k2(mx, my), -1]]), q = [[mx, my]]; let end = null;
        for (let i = 0; i < q.length && !end; i++) { const [x, y] = q[i]; if (keep.has(k2(x, y))) { end = [x, y]; break; }
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (inR(nx, ny) && at(nx, ny) === 1 && !prev.has(k2(nx, ny))) { prev.set(k2(nx, ny), k2(x, y)); q.push([nx, ny]); } } }
        for (let k = end ? k2(...end) : -1, last = null; k >= 0; last = k, k = prev.get(k)) { keep.add(k);
          if (last !== null) { const sx = Math.abs(last - k) === 1 ? 0 : 1, x = k % W + sx, y = Math.floor(k / W) + (1 - sx); if (inR(x, y)) keep.add(k2(x, y)); } } }
      const cut = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (at(x, y) === 1 && !keep.has(k2(x, y)) && !isDoor(x, y)) { cut.push([x, y]); set(x, y, 3); }
      scraps(cut);
      if (cut.length * 2 < r.w * r.h || !connected()) { for (const [x, y] of cut) set(x, y, 1); return false; }
      for (const [x, y] of cut) if (at(x, y) === 3) { lava.push([x, y]); flow[y * W + x] = dir; } streams.push({ room: r.id, kind: 'hall', n: cut.length }); return true; };
    if (D.BIOMES[biome].lava && !last) {
      // the first river a room or two from the start, so the floor reads as the fire depths from its first fight
      const near = rooms.filter((r) => lavaRoom(r) && hop[r.id] >= 1 && hop[r.id] <= 2), rest = rooms.filter((r) => lavaRoom(r) && !near.includes(r));
      for (let i = near.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [near[i], near[j]] = [near[j], near[i]]; }
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const tryRiver = (r) => { const dirs = [1, 3, 0, 2].filter((d) => (d % 2 ? r.w : r.h) >= 8); for (let k = 0; k < 3 && dirs.length; k++) if (river(r, dirs[Math.floor(R() * dirs.length)])) return true; return false; };
      for (const r of near) if (tryRiver(r)) break;
      const wantR = 2 + (R() < 0.5 ? 1 : 0), big = rest.filter((r) => r.w >= 10 && r.h >= 8);
      if (big.length && R() < 0.75) for (const r of big) if (lavaRoom(r) && hall(r, Math.floor(R() * 4))) break;
      for (const r of rest) { if (streams.filter((q) => q.kind === 'river').length >= wantR) break; if (lavaRoom(r)) tryRiver(r); } }
    // a fire floor without a river, and the boss's hall, get pools: a second pass that skips the roll
    if ((D.BIOMES[biome].lava && !lava.length) || bossType === 'boss') for (let pass = 0; pass < 2 && !lava.length; pass++) for (const r of rooms) {
      if (r.type !== 'start' && r.type !== 'shop' && r.type !== 'boss' && r.w >= 8 && r.h >= 6 && (pass || R() < (boss ? 1 : 0.75))) pool(r); }
    function connected() { const seen = new Uint8Array(W * H), st = [[start.cx, start.cy]]; seen[start.cy * W + start.cx] = 1;
      while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
        if ((at(nx, ny) === 1 || at(nx, ny) === 4) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; st.push([nx, ny]); } } }
      for (let i = 0; i < W * H; i++) if (cells[i] === 1 && !seen[i]) return false; return true; }
    if (!connected()) return null;
    const water = [], waterFlow = {}, waterFeatures = [], waterBridges = [], wet = new Set(), crossings = [];
    const waterRng = mul32(seed ^ 0x211a73), wi = (a, b) => a + Math.floor(waterRng() * (b - a + 1));
    const addWater = (k, dir) => { if (!wet.has(k)) { wet.add(k); water.push(k); } if (dir >= 0) waterFlow[k] = dir; };
    // ---- the cave's water (TASKS 302). It comes from a source (a fall down a top wall, a breach in a side wall, a spring from under
    // the rock) and spreads in a ragged patch over part of a hall; lakes lie in the rock on the way from one hall to the next, and
    // streams join a hall's water to a lake. Water with no dry floor among its eight neighbours is deep (cell 6): no one walks or is
    // knocked into it, bolts fly over it, and shallows ring it wherever it meets the floor. Where deep water cuts a way, a crossing
    // is laid along the shortest line over it: an isthmus of shallows, a ford of stones or a plank bridge. Its own random stream, so
    // the rest of the floor is laid out as without it ----
    if (cave) {
      const Q = mul32(seed ^ 0x302c0de), shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Q() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const wt = new Uint8Array(W * H), cross = new Uint8Array(W * H), deep = new Uint8Array(W * H), flowW = new Int8Array(W * H).fill(-1), D4 = [1, -1, W, -W], D8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1];
      const inBox = (r, x, y, p) => x >= r.x - p && x < r.x + r.w + p && y >= r.y - p && y < r.y + r.h + p;
      // kept dry: the start, the merchant and the boss's hall with their rock round them (the shop's back wall stays two cells thick),
      // the pockets with their chests, every room's core (the fire, the stairs, the altar) and the map's rim
      const shut = rooms.filter((r) => r.type === 'start' || r.type === 'shop' || r.type === 'boss' || r.pocket);
      const cores = rooms.map((r) => (r.pocket ? [r.cx - 1, r.cx, r.cy - 1, r.cy] : r.id === 0 && boss ? [r.cx - 4, r.cx + 3, r.cy - 4, r.cy + 5] : [r.cx - 1, r.cx + 2, r.cy - 1, r.cy + 3]));
      const dryAt = (x, y) => x < 3 || y < 4 || x > W - 4 || y > H - 4 || shopCorner(x, y) || shut.some((r) => inBox(r, x, y, r.type === 'shop' ? 3 : 2))
        || cores.some(([x0, x1, y0, y1]) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1);
      // a smooth noise of a few cells' grain: the water's edge wanders by it
      const nz0 = Q() * 1e4, hsh = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + nz0) * 43758.5453; return s - Math.floor(s); };
      const nz = (x, y) => { const gx = x / 3, gy = y / 3, i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, s = (a) => a * a * (3 - 2 * a);
        return (hsh(i, j) * (1 - s(u)) + hsh(i + 1, j) * s(u)) * (1 - s(v)) + (hsh(i, j + 1) * (1 - s(u)) + hsh(i + 1, j + 1) * s(u)) * s(v); };
      // while the water is laid it is floor in cells; settle() tells deep from shallow and lays the crossings, and fails when a deep
      // pool has no shallows at all or a part of the floor can't be reached
      const walk = (k) => cells[k] === 1 && !deep[k];
      const settle = () => { cross.fill(0); crossings.length = 0;
        for (let k = 0; k < W * H; k++) deep[k] = wt[k] && !D8.some((d) => cells[k + d] === 1 && !wt[k + d]) ? 1 : 0;
        for (let pass = 0; pass < 16; pass++) {
          const seen = new Uint8Array(W * H), st = [start.cy * W + start.cx]; seen[st[0]] = 1;
          while (st.length) { const k = st.pop(); for (const d of D4) { const n = k + d; if (!seen[n] && walk(n)) { seen[n] = 1; st.push(n); } } }
          let lost = false; for (let k = 0; k < W * H && !lost; k++) if (walk(k) && !seen[k]) lost = true;
          if (!lost) break;
          if (pass === 15) return false;
          // breadth-first from the floor reached, over deep water only, to the nearest floor cut off
          const prev = new Int32Array(W * H).fill(-2), q = []; for (let k = 0; k < W * H; k++) if (seen[k]) { prev[k] = -1; q.push(k); }
          let end = -1;
          for (let i = 0; i < q.length && end < 0; i++) for (const d of D4) { const n = q[i] + d; if (prev[n] !== -2) continue;
            if (walk(n)) { prev[n] = q[i]; end = n; break; } if (deep[n]) { prev[n] = q[i]; q.push(n); } }
          if (end < 0) return false;
          const path = []; for (let k = prev[end]; k >= 0 && deep[k]; k = prev[k]) path.push(k);
          const a = path[path.length - 1], b = path[0], hor = Math.abs(a % W - b % W) >= Math.abs(Math.floor(a / W) - Math.floor(b / W)), s = hor ? W : 1;
          // two cells wide: the second row on the side where the deep water goes on
          const side = path.filter((k) => deep[k + s]).length >= path.filter((k) => deep[k - s]).length ? s : -s;
          let cs = path.concat(path.filter((k) => deep[k + side]).map((k) => k + side));
          let kind = path.length <= 2 ? 'neck' : path.length <= 5 && Q() < 0.6 ? 'ford' : 'bridge';
          // a plank bridge runs straight (TASKS 306): a path over the deep water that bends is crossed on stepping stones instead
          const straight = new Set(path.map((k) => (hor ? Math.floor(k / W) : k % W))).size === 1;
          if (kind === 'bridge' && !straight) kind = 'ford';
          // a straight crossing reaches the shore with both its rows (TASKS 306): the second row goes on the side whose ends meet the
          // shallows soonest, and the deep water still under either row past the way's ends goes under the crossing too; a deck that
          // stopped with one row over deep water read as broken off in the middle of the lake
          let clean = false;
          if (kind !== 'neck' && straight) { const step = hor ? 1 : W, lo = path.reduce((a, k) => Math.min(a, k)), hi = path.reduce((a, k) => Math.max(a, k));
            const reach = (sd, from, dir) => { for (let e = 0; e <= 4; e++) { const k = from + dir * step * e; if (!cells[k] || !cells[k + sd]) return -1; if (!deep[k] && !deep[k + sd]) return e; } return -1; };
            let best = null;
            for (const sd of [side, -side]) { if (path.some((k) => !cells[k + sd])) continue; const a = reach(sd, lo - step, -1), b = reach(sd, hi + step, 1);
              if (a >= 0 && b >= 0 && (!best || a + b < best[1] + best[2])) best = [sd, a, b]; }
            if (best) { const [sd, a, b] = best; cs = []; clean = true;
              for (let k = lo - a * step; k <= hi + b * step; k += step) for (const c of [k, k + sd]) if (deep[c]) cs.push(c); } }
          // with no way to land both rows, no planks: stepping stones follow the cells whatever their shape
          if (kind === 'bridge' && !clean) kind = 'ford';
          for (const k of cs) { deep[k] = 0; if (kind !== 'neck') cross[k] = 1; }
          crossings.push({ kind, cells: cs, axis: hor ? 'x' : 'y', clean: clean ? 1 : 0 }); }
        // every deep pool has a shore of shallows
        const seen = new Uint8Array(W * H);
        for (let k0 = 0; k0 < W * H; k0++) { if (!deep[k0] || seen[k0]) continue; const st = [k0]; seen[k0] = 1; let shore = false;
          while (st.length) { const k = st.pop(); for (const d of D8) { const n = k + d; if (deep[n] && !seen[n]) { seen[n] = 1; st.push(n); } else if (wt[n] && !deep[n] && !cross[n]) shore = true; } }
          if (!shore) return false; }
        return true; };
      const share = () => { let w = 0, o = 0; for (let k = 0; k < W * H; k++) if (cells[k] === 1) { o++; if (wt[k]) w++; } return w / Math.max(1, o); };
      const bodies = [];
      // one body of water at a time: undone whole if it leaves the floor in pieces no crossing can join
      const tryBody = (carve) => { const c0 = cells.slice(), w0 = wt.slice(), f0 = flowW.slice(), n0 = waterFeatures.length, b0 = bodies.length;
        if (carve() !== false) { tidy(); if (settle()) return true; }
        for (let k = 0; k < W * H; k++) cells[k] = c0[k]; wt.set(w0); flowW.set(f0); waterFeatures.length = n0; bodies.length = b0; settle(); return false; };
      const mark = (ks, kind) => { for (const k of ks) { cells[k] = 1; wt[k] = 1; } bodies.push({ kind, cells: ks }); };
      // a source on the wall over a water cell (x, y): a fall needs the top wall three cells wide, a breach a side wall two thick
      const sourceAt = (x, y, room, kinds) => { const opts = [];
        if (!at(x, y - 1) && !at(x, y - 2) && !at(x - 1, y - 1) && !at(x + 1, y - 1)) opts.push(['waterfall', 0, -1, 3]);
        for (const dx of [-1, 1]) if (!at(x + dx, y) && !at(x + 2 * dx, y)) opts.push(['breach', dx, 0, 1.5], ['spring', dx, 0, 1]);
        if (!at(x, y + 1) && !at(x, y + 2)) opts.push(['spring', 0, 1, 1.5]);
        const ok = opts.filter((o) => kinds.includes(o[0])); if (!ok.length) return null;
        let roll = Q() * ok.reduce((a, o) => a + o[3], 0), o = ok[0]; for (const c of ok) { roll -= c[3]; if (roll < 0) { o = c; break; } }
        const [kind, dx, dy] = o;
        return { kind, room, cell: y * W + x, dir: dy < 0 ? 'u' : dy > 0 ? 'd' : dx < 0 ? 'l' : 'r', x: (x + 0.5 + dx / 2) * TILE, y: dy < 0 ? y * TILE : dy > 0 ? (y + 1) * TILE : (y + 0.5) * TILE, wallY: dy < 0 ? y : undefined }; };
      // a hall's water: from a source on its wall it spreads over 30–50 % of the hall's floor, the cheapest cells first (nearer, and
      // where the noise is low), so the patch is ragged by cells and never the whole hall
      const pool = (r, wide = 0) => { const srcs = [];
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * W + x; if (cells[k] !== 1 || wt[k] || dryAt(x, y)) continue;
          const s = sourceAt(x, y, r.id, ['waterfall', 'breach', 'spring']); if (s) srcs.push([x, y]); }
        if (!srcs.length) return false;
        const [sx, sy] = srcs[Math.floor(Q() * srcs.length)], src = sourceAt(sx, sy, r.id, ['waterfall', 'breach', 'spring']);
        const can = (x, y) => inBox(r, x, y, 0) && cells[y * W + x] === 1 && !wt[y * W + x] && !dryAt(x, y);
        let n = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (can(x, y)) n++;
        const want = Math.round(n * (0.3 + 0.2 * Q() + wide)), got = new Set([sy * W + sx]), cand = new Map();
        const cost = (k) => Math.hypot(k % W - sx, (Math.floor(k / W) - sy) * 1.2) + 5 * nz(k % W, Math.floor(k / W));
        const grow = (k) => { for (const d of D4) { const m = k + d; if (!got.has(m) && !cand.has(m) && can(m % W, Math.floor(m / W))) cand.set(m, cost(m)); } };
        grow(sy * W + sx);
        while (got.size < want && cand.size) { let best = -1, bc = 1e9; for (const [k, c] of cand) if (c < bc) { bc = c; best = k; } cand.delete(best); got.add(best); grow(best); }
        // spurs a cell wide go back to floor, and a dry cell held on three sides fills
        for (let pass = 0; pass < 2; pass++) { for (const k of [...got]) if (k !== sy * W + sx && D4.filter((d) => got.has(k + d)).length < 2) got.delete(k);
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * W + x; if (!got.has(k) && can(x, y) && D4.filter((d) => got.has(k + d)).length >= 3) got.add(k); } }
        if (got.size < 8) return false;
        mark([...got], 'pool'); waterFeatures.push(Object.assign(src, { n: got.size, body: bodies.length - 1 })); };
      // a lake in the rock on the way between two halls: a ragged blob round a point near the middle of their link, mostly rock it
      // floods (or it is just a hall's pool); the way through it is then crossed where it ran
      const lake = ([a, b]) => { const A = rooms[a], B = rooms[b]; if (A.pocket || B.pocket) return false;
        const L = Math.hypot(B.cx - A.cx, B.cy - A.cy); if (L < 14) return false;
        const t = 0.35 + 0.3 * Q(), off = (Q() * 2 - 1) * 2, cx = A.cx + (B.cx - A.cx) * t - (B.cy - A.cy) / L * off + 0.5, cy = A.cy + (B.cy - A.cy) * t + (B.cx - A.cx) / L * off + 0.5;
        const rx = 4 + 4 * Q(), ry = 3 + 2.5 * Q(), ph = [0, 1, 2, 3].map(() => Q() * 6.283), am = [0, 1, 2, 3].map((k) => (0.04 + 0.1 * Q()) / (1 + 0.5 * k));
        const got = []; let rock = 0;
        for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, an = Math.atan2(v, u);
          let lim = 1.05; for (let k = 0; k < 4; k++) lim -= am[k] * (1 + Math.cos((k + 2) * an + ph[k]));
          if (Math.hypot(u, v) >= lim || dryAt(x, y) || wt[y * W + x] || at(x, y) > 1) continue; if (!at(x, y)) rock++; got.push(y * W + x); }
        if (got.length < 14 || rock < got.length * 0.5) return false;
        mark(got, 'lake');
        // fed by a fall down the rock over it, or else a spring from under it
        const srcs = shuffle(got.slice()).map((k) => sourceAt(k % W, Math.floor(k / W), -1, ['waterfall'])).filter(Boolean);
        const src = srcs[0] || shuffle(got.slice()).map((k) => sourceAt(k % W, Math.floor(k / W), -1, ['spring'])).find(Boolean); if (!src) return false;
        waterFeatures.push(Object.assign(src, { n: got.length, body: bodies.length - 1 })); };
      // a stream from a hall's water (or a lake) to the nearest lake: a channel two cells wide wandering through the rock, its water running
      // towards the lake; crossing a way, it is shallows (or a crossing, if it runs deep there)
      const stream = (P) => { let best = null;
        for (const B of bodies) if (B.kind === 'lake' && B !== P) for (const k of B.cells) for (const j of P.cells) { const d = Math.hypot(k % W - j % W, Math.floor(k / W) - Math.floor(j / W)); if (!best || d < best[0]) best = [d, j, k]; }
        if (!best || best[0] > 22 || best[0] < 3) return false;
        const [, j, k] = best, x0 = j % W + 0.5, y0 = Math.floor(j / W) + 0.5, x1 = k % W + 0.5, y1 = Math.floor(k / W) + 0.5, L = best[0], nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
        const dir = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? (x1 > x0 ? 0 : 2) : (y1 > y0 ? 1 : 3), amp = Math.min(3, L / 5) * (Q() * 2 - 1), got = new Set();
        for (let s = 0; s <= L; s += 0.5) { const u = s / L, o = amp * Math.sin(Math.PI * u), px = x0 + (x1 - x0) * u + nx * o, py = y0 + (y1 - y0) * u + ny * o;
          for (let jy = 0; jy < 2; jy++) for (let ix = 0; ix < 2; ix++) { const x = Math.round(px - 1) + ix, y = Math.round(py - 1) + jy;
            if (dryAt(x, y) || at(x, y) > 1) return false; if (!wt[y * W + x]) got.add(y * W + x); } }
        mark([...got], 'stream'); for (const c of got) flowW[c] = dir; };
      const goal = 0.2 + 0.1 * Q();
      let nLake = 2 + (W * H > 4800 ? 1 : 0) + (Q() < 0.5 ? 1 : 0);
      for (const e of shuffle(edges.slice())) { if (nLake <= 0 || share() >= goal * 0.7) break; if (tryBody(() => lake(e))) nLake--; }
      let nPool = 0;
      for (const r of shuffle(rooms.filter((q) => !q.pocket && ['combat', 'exit', 'treasure', 'shrine'].includes(q.type)))) { if (nPool >= 6 || share() >= goal) break; if (tryBody(() => pool(r))) nPool++; }
      let nStream = 0; for (const P of bodies.filter((q) => q.kind === 'pool')) { if (nStream >= 2) break; if (tryBody(() => stream(P))) nStream++; }
      for (const P of bodies.filter((q) => q.kind === 'lake')) { if (nStream >= 1) break; if (tryBody(() => stream(P))) nStream++; }
      // a floor still short of water gets more lakes, then more pools, a second one in a hall too
      for (let round = 0; round < 2; round++) { for (const e of shuffle(edges.slice())) { if (share() >= 0.17) break; tryBody(() => lake(e)); }
        for (const r of shuffle(rooms.filter((q) => !q.pocket && ['combat', 'exit', 'treasure', 'shrine'].includes(q.type)))) { if (share() >= 0.17) break; tryBody(() => pool(r, 0.2)); } }
      // the lakes' and pools' shores along the rock are broken like the cave's walls: a knob of rock left in the water or a niche
      // of water dug into the rock
      for (let pass = 0; pass < 8; pass++) { const runs = straightRuns(cells, W, H, shopCorner); if (!runs.length) break;
        for (const { x, y, dx, dy, nx, ny, n } of runs) { const mx = x + dx * (n >> 1), my = y + dy * (n >> 1), k = my * W + mx;
          if (Q() < 0.5 && at(mx - nx, my - ny) && at(mx - 2 * nx, my - 2 * ny) && !cores.some(([x0, x1, y0, y1]) => mx >= x0 && mx <= x1 && my >= y0 && my <= y1)) { set(mx, my, 0); wt[k] = 0; }
          else { set(mx + nx, my + ny, 1); wt[(my + ny) * W + mx + nx] = wt[k]; } }
        tidy(); }
      // a later lake, stream or the tidying may have dug out the rock behind a source: its body gets a source again where it can
      for (let i = waterFeatures.length - 1; i >= 0; i--) { const q = waterFeatures[i], back = { u: -W, d: W, l: -1, r: 1 }[q.dir];
        if (wt[q.cell] && !cells[q.cell + back] && (q.kind !== 'waterfall' || (!cells[q.cell - 2 * W] && !cells[q.cell - W - 1] && !cells[q.cell - W + 1]))) continue;
        const B = bodies[q.body], o = B && shuffle(B.cells.filter((k) => wt[k])).map((k) => sourceAt(k % W, Math.floor(k / W), q.room, [q.kind, 'spring'])).find(Boolean);
        if (o) waterFeatures[i] = Object.assign(o, { n: q.n, body: q.body }); else waterFeatures.splice(i, 1); }
      // a floor with too little water for a flooded cave (a few small halls, no room for lakes) is laid out anew
      if (!settle() || share() < 0.15) return null;
      for (let k = 0; k < W * H; k++) if (wt[k]) { if (deep[k]) { cells[k] = 6; if (flowW[k] >= 0) waterFlow[k] = flowW[k]; } else if (!cross[k]) addWater(k, flowW[k]); }
      for (const c of crossings) if (c.kind === 'ford') waterBridges.push(...c.cells);
      // how each crossing is built (TASKS 306), from a stream of its own: a straight ford two cells wide is now and then a low plank
      // walk instead of stepping stones; a bridge's deck runs on over the shallows at either end to the dry floor, and stands on a
      // thick post at each corner, a fire on the posts of one end or both of most bridges. u along the way, v across it, in cells
      const Dq = mul32(seed ^ 0x306b41d);
      for (const c of crossings) { if (c.kind === 'neck') continue; const hor = c.axis === 'x', U = (k) => (hor ? k % W : Math.floor(k / W)), V = (k) => (hor ? Math.floor(k / W) : k % W);
        const us = c.cells.map(U), vs = c.cells.map(V), v0 = Math.min(...vs), straight = Math.max(...vs) - v0 === 1, cellAt = (u, v) => (hor ? v * W + u : u * W + v);
        let u0 = Math.min(...us), u1 = Math.max(...us);
        if (c.kind === 'ford') { c.look = straight && c.clean && Dq() < 0.45 ? 'walk' : 'stones'; if (c.look === 'stones') continue; }
        const shallow = (u) => [v0, v0 + 1].every((v) => wet.has(cellAt(u, v)));
        for (let n = 0; n < 3 && shallow(u0 - 1); n++) u0--; for (let n = 0; n < 3 && shallow(u1 + 1); n++) u1++;
        c.span = [u0, u1, v0];
        if (c.kind !== 'bridge') continue;
        const fire = Dq(), lit = fire < 0.35 ? [] : fire < 0.75 ? [Dq() < 0.5 ? 0 : 1] : [0, 1];
        c.posts = [];
        for (const e of [0, 1]) for (const side of [0, 1]) { const a = e ? (u1 + 1) * TILE - 6 : u0 * TILE + 6, b = side ? (v0 + 2) * TILE + 2 : v0 * TILE + 4;
          c.posts.push({ x: hor ? a : side ? (v0 + 2) * TILE + 4 : v0 * TILE - 4, y: hor ? b : a + (e ? 8 : 2), fire: lit.includes(e) ? 1 : 0, near: side }); } } }
    // ---- secret rooms: anywhere off a straight stretch of wall (a room's or a corridor's, any side but the shop's), a small room
    // behind a two-cell-thick fake wall (cell 4: solid, drawn as rock, breaks under blows) and a short passage. How many is
    // left to chance (1–10, fewer when the rock has no room for them; none at all only on the boss's floor, and rarely), so the
    // player never knows when a floor is cleaned out ----
    const secrets = [], onWater = new Set([...wet, ...crossings.flatMap((c) => c.cells)]);
    // the rock a fall pours down or a spring comes out of is no secret's
    const srcRock = new Set(waterFeatures.filter((q) => q.dir).flatMap((q) => { const b = { u: -W, d: W, l: -1, r: 1 }[q.dir]; return [q.cell + b, q.cell + 2 * b, q.cell + b - 1, q.cell + b + 1, q.cell + b - W, q.cell + b + W]; }));
    const secretsWanted = boss && R() < 0.06 ? 0 : 1 + Math.floor(Math.pow(R(), 1.8) * 10);
    { const want = secretsWanted, DIRS = [[0, -1, 'u'], [0, 1, 'd'], [-1, 0, 'l'], [1, 0, 'r']];
      const shopRoom = rooms.find((q) => q.type === 'shop');
      const inShop = (x, y) => x >= shopRoom.x - 1 && x <= shopRoom.x + shopRoom.w && y >= shopRoom.y - 1 && y <= shopRoom.y + shopRoom.h;
      const rockAt = (x, y) => x >= 2 && y >= 3 && x <= W - 3 && y <= H - 3 && at(x, y) === 0 && !srcRock.has(y * W + x);
      for (let k = 0; k < 8000 && secrets.length < want; k++) {
        const hx = ri(2, W - 3), hy = ri(3, H - 3), [dx, dy, dir] = DIRS[Math.floor(R() * 4)], px = dy ? 1 : 0, py = dx ? 1 : 0;
        // (depth, lateral) → cell: depth runs from the host floor (0) into the rock, lateral 0–1 is the two-cell-wide opening
        const C = (d, l) => [hx + dx * d + px * l, hy + dy * d + py * l];
        const all = (d0, d1, l0, l1, f) => { for (let d = d0; d <= d1; d++) for (let l = l0; l <= l1; l++) if (!f(...C(d, l))) return false; return true; };
        // a straight stretch of wall with open floor in front of it, clear of the shop; a side passage keeps two cells of rock above and
        // below its fake wall, or, broken, it leaves a one-cell strip of wall hanging over the next floor (TASKS 178)
        // (a cave's walls bend every few cells: there the floor has to be open only before the two-cell opening itself)
        if (!all(-1, 0, cave ? 0 : -1, cave ? 1 : 2, (x, y) => at(x, y) === 1 && !inShop(x, y) && !onWater.has(y * W + x) && !(cave && rooms.some((q) => q.type === 'secret' && x >= q.x - 1 && x <= q.x + q.w && y >= q.y - 1 && y <= q.y + q.h)) && !(boss && x >= exitR.x && x < exitR.x + exitR.w && y >= exitR.y && y < exitR.y + exitR.h)) || !all(1, 2, dx ? -2 : -1, dx ? 3 : 2, rockAt)) continue;
        const plen = ri(0, 2), D = ri(3, 5), S = ri(3, 6), l0 = -ri(0, S - 2), d0 = 3 + plen, d1 = d0 + D - 1;
        if (plen && !all(3, 2 + plen, -2, 3, rockAt)) continue;
        const [ax, ay] = C(d0, l0), [bx, by] = C(d1, l0 + S - 1), rx = Math.min(ax, bx), ry = Math.min(ay, by), rw = Math.abs(bx - ax) + 1, rh = Math.abs(by - ay) + 1;
        let ok = true; for (let y = ry - 3; y <= ry + rh + 1 && ok; y++) for (let x = rx - 2; x <= rx + rw + 1; x++) if (!rockAt(x, y)) { ok = false; break; }
        if (!ok) continue;
        const sr = { x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1), type: 'secret', id: rooms.length };
        rooms.push(sr); for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) set(x, y, 1);
        const wall = [], hide = [], front = [];
        for (let d = 1; d <= 2 + plen; d++) for (let l = 0; l <= 1; l++) { const [x, y] = C(d, l); set(x, y, d <= 2 ? 4 : 1); if (d <= 2) wall.push([x, y]); hide.push(y * W + x); }
        for (let d = -1; d <= 0; d++) for (let l = -1; l <= 2; l++) front.push(C(d, l));
        // the contact point: the middle of the opening's edge on the host side, where blows land and the draught comes out
        const ex = dy ? (hx + 1) * TILE : (dx < 0 ? hx : hx + 1) * TILE, ey = dx ? (hy + 1) * TILE : (dy < 0 ? hy : hy + 1) * TILE;
        // how it is hidden: a plain stretch of wall that breaks, a banner or a bookshelf in front of it (top walls only, the
        // ones the camera faces), or a mechanism somewhere near (a loose flagstone, a sconce that pulls down) that sinks it
        const kind = pick(dir === 'u' && !cave ? ['crack', 'banner', 'banner', 'shelf', 'shelf', 'lever', 'lever'] : ['crack', 'crack', 'lever', 'lever', 'lever']);
        secrets.push({ room: sr.id, dir, dx, dy, x: ex, y: ey, wall, hide, front, hp: 2, open: 0, kind }); } }
    const secretFront = new Set(secrets.flatMap((q) => q.front.concat(q.wall).map(([x, y]) => y * W + x)));
    if (!D.BIOMES[biome].lava && !last && !cave) {
      const candidates = rooms.filter((r) => r.type === 'combat' && !r.trap && !secrets.some((q) => q.front.some(([x, y]) => roomOf(x, y) === r)));
      for (let i = candidates.length - 1; i > 0; i--) { const j = wi(0, i); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
      let n = 0;
      for (const r of candidates.concat(rooms.filter((q) => q.type === 'combat' && !candidates.includes(q) && !secrets.some((s) => s.front.some(([x, y]) => roomOf(x, y) === q))))) {
        if (n >= 2) continue;
        const w = wi(1, 3), xs = [];
        for (let x = r.x + 2; x + w <= r.x + r.w - 2; x++) if (Array.from({ length: w + 2 }, (_, i) => x + i - 1).every((cx) => at(cx, r.y - 1) === 0 && !isDoor(cx, r.y) && !secretFront.has(r.y * W + cx))) xs.push(x);
        if (!xs.length) continue;
        const startX = xs[wi(0, xs.length - 1)], path = [], bridge = [], fordY = r.y + Math.floor(r.h / 2); let x = startX;
        for (let y = r.y; y < r.y + r.h; y++) {
          if (w > 1 && y > r.y + 1 && y < r.y + r.h - 2 && waterRng() < 0.35) x = Math.max(r.x + 1, Math.min(r.x + r.w - w - 1, x + wi(-1, 1)));
          for (let i = 0; i < w; i++) { const k = y * W + x + i; if (at(x + i, y) !== 1 || secretFront.has(k)) continue;
            path.push(k); if (y === fordY || y === fordY + 1) bridge.push(k); else addWater(k, 1); }
        }
        if (path.length < r.h) continue;
        for (const k of bridge) waterBridges.push(k);
        const source = { x: (startX + w / 2) * TILE, y: r.y * TILE + 20 }, last = path[path.length - 1 - Math.floor(w / 2)];
        waterFeatures.push({ kind: n === 0 ? 'fountain' : 'stream', room: r.id, x: source.x, y: source.y, width: w, cells: path,
          source: path[0], drain: last, bridge }); n++;
      }
    }
    // ---- doors (TASKS 77, 78): a room whose every way in is a clean two-cell mouth in a straight wall may get a door in each, on
    // the first corridor cells past its edge, so the room stays unseen until one opens. One such room a floor may be locked, but
    // only one the floor can do without: shutting it cuts nothing else off, and its key or lever lies on this side (placed below,
    // once the rooms are furnished) ----
    const doors = [], locks = [];
    if (!cave) { const inAny = (x, y) => rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      const busy = new Set(water); for (const sc of secrets) for (const [x, y] of sc.front.concat(sc.wall)) busy.add(y * W + x);
      const doorsOf = (r) => { const ms = [], left = new Set(), out = [];
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) for (const [dx, dy, dir] of [[0, -1, 'u'], [0, 1, 'd'], [-1, 0, 'l'], [1, 0, 'r']]) {
          const ox = x + dx, oy = y + dy; if (at(ox, oy) === 1 && !inAny(ox, oy)) { ms.push([ox, oy, dir, dx, dy]); left.add(oy * W + ox); } }
        // cells come in wall order, so each pair is met at its first cell: two side by side, rock either side, the corridor going on
        // straight past them, and rock beside its first cell past the door where the open leaf rests
        for (const [x, y, dir, dx, dy] of ms) { if (!left.has(y * W + x)) continue; const ax = dy ? 1 : 0, ay = dx ? 1 : 0, x2 = x + ax, y2 = y + ay;
          if (!left.has(y2 * W + x2) || at(x - ax, y - ay) !== 0 || at(x + 2 * ax, y + 2 * ay) !== 0 || at(x - ax + dx, y - ay + dy) !== 0) return null;
          for (const [px, py] of [[x, y], [x2, y2]]) if (at(px + dx, py + dy) !== 1 || inAny(px + dx, py + dy) || busy.has(py * W + px) || busy.has((py + dy) * W + px + dx)) return null;
          left.delete(y * W + x); left.delete(y2 * W + x2);
          out.push({ room: r.id, dir, cells: [[x, y], [x2, y2]], x: dy ? x2 * TILE : (dx < 0 ? r.x : r.x + r.w) * TILE, y: dx ? y2 * TILE : (dy < 0 ? r.y : r.y + r.h) * TILE, lock: -1, open: 0 }); }
        // two doors in one wall stand far enough apart for their arches
        if (out.some((d, i) => out.some((o, j) => j > i && o.dir === d.dir && Math.abs(o.x - d.x) + Math.abs(o.y - d.y) < 4 * TILE))) return null;
        return out.length ? out : null; };
      // no two doors share a corridor: back to back they would read as one wall of planks
      const clash = (ds) => ds.some((d) => d.cells.some(([x, y]) => doors.some((o) => o.cells.some(([ox, oy]) => Math.abs(ox - x) <= 2 && Math.abs(oy - y) <= 2))));
      const cand = rooms.filter((r) => ['combat', 'treasure', 'shrine', 'exit'].includes(r.type)).map((r) => [r, doorsOf(r)]).filter(([, ds]) => ds);
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
      const flood = (shut) => { const seen = new Uint8Array(W * H), st = [start.cy * W + start.cx]; seen[st[0]] = 1;
        while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && cells[n] === 1 && !shut.has(n)) { seen[n] = 1; st.push(n); } } } return seen; };
      const all = flood(new Set());
      const spare = (r, ds) => { const shut = new Set(ds.flatMap((d) => d.cells.map(([x, y]) => y * W + x))), got = flood(shut);
        for (let k = 0; k < W * H; k++) { const x = k % W, y = Math.floor(k / W); if (all[k] && !got[k] && !shut.has(k) && !(x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) return false; } return true; };
      if (R() < (depth === 1 ? 0.5 : 0.8)) { const lk = cand.filter(([r, ds]) => r.type !== 'exit' && spare(r, ds)).sort(([a], [b]) => (b.type === 'treasure') - (a.type === 'treasure'))[0];
        if (lk) { for (const d of lk[1]) { d.lock = 0; doors.push(d); } locks.push({ room: lk[0].id, kind: '', open: 0 }); lk[0].locked = lk[0].doors = 1; if (lk[0].w >= 8 && R() < 0.35) lk[0].trap = 1; } }
      let n = 0; const want = ri(1, 3) + (depth >= 4 ? 1 : 0);
      for (const [r, ds] of cand) { if (n >= want) break; if (r.locked || clash(ds)) continue; r.doors = 1; doors.push(...ds); n++; } }
    // the cave's boss hall is not sealed by doors yet (its arena is TASKS 313)
    if (boss && !cave) {
      const key = (x, y) => y * W + x;
      const inR = (x, y) => x >= exitR.x && x < exitR.x + exitR.w && y >= exitR.y && y < exitR.y + exitR.h;
      const mouths = new Map();
      for (let y = exitR.y; y < exitR.y + exitR.h; y++) for (let x = exitR.x; x < exitR.x + exitR.w; x++) for (const [dx, dy, dir] of [[0, -1, 'u'], [0, 1, 'd'], [-1, 0, 'l'], [1, 0, 'r']]) {
        const ox = x + dx, oy = y + dy; if (!inR(ox, oy) && at(ox, oy) === 1) mouths.set(key(ox, oy), { x: ox, y: oy, dir });
      }
      for (const p of mouths.values()) {
        const side = p.dir === 'l' || p.dir === 'r', mate = mouths.get(key(p.x + (side ? 0 : 1), p.y + (side ? 1 : 0)));
        if (p.used) continue; p.used = 1; const cs = [[p.x, p.y]];
        if (mate && !mate.used && mate.dir === p.dir) { mate.used = 1; cs.push([mate.x, mate.y]); }
        doors.push({ room: exitR.id, arena: 1, dir: p.dir, cells: cs, x: side ? (p.dir === 'l' ? exitR.x : exitR.x + exitR.w) * TILE : (p.x + cs.length / 2) * TILE,
          y: side ? (p.y + cs.length / 2) * TILE : (p.dir === 'u' ? exitR.y : exitR.y + exitR.h) * TILE, lock: -1, open: 1 });
      }
      exitR.doors = 1;
    }
    // ---- contents ----
    // a cell next to a corridor mouth: any neighbour outside every room that is open floor
    const inRoom = (x, y) => rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
    const doorway = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (at(x + i, y + j) === 1 && !inRoom(x + i, y + j)) return true; return false; };
    const used = new Set(), key = (x, y) => x + ',' + y;
    const free = (x, y, pad = 0) => { for (let j = -pad; j <= pad; j++) for (let i = -pad; i <= pad; i++) if (at(x + i, y + j) !== 1 || used.has(key(x + i, y + j))) return false; return true; };
    // bulky props draw wider than their cell: in the shop (one built piece) no two share an edge or a corner; everywhere else
    // each keeps its drawn width (PROP_W) clear of every other one in its own row and the rows in front and behind
    const bulk = new Set(), roomyCell = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (bulk.has(key(x + i, y + j))) return false; return true; };
    const wide = [], half = (n) => (D.PROP_W[n] || D.PROP_W.chest) / 2;
    const roomy = (x, y, n = 'chest', px = wx(x)) => roomyCell(x, y) && !wide.some(([ex, ey, eh]) => Math.abs(ey - y) <= 1 && Math.abs(ex - px) < eh + half(n) + 4);
    const claim = (x, y, n = 'chest', px = wx(x)) => { used.add(key(x, y)); bulk.add(key(x, y)); wide.push([px, y, half(n)]); };
    const spot = (r, inset = 1, pad = 0, big = false) => { for (let k = 0; k < 40; k++) { const x = ri(r.x + inset, r.x + r.w - 1 - inset), y = ri(r.y + inset, r.y + r.h - 1 - inset);
      if (free(x, y, pad) && !doorway(x, y) && (!big || roomy(x, y, big === true ? 'chest' : big))) { used.add(key(x, y)); if (big) claim(x, y, big === true ? 'chest' : big); return [x, y]; } } return null; };
    for (const sc of secrets) for (const [x, y] of sc.front) used.add(key(x, y));
    // a stream through a campaign room keeps bulky props a cell off its banks; a cave's water is everywhere, so only off the water
    for (const k of water) {
      const x = k % W, y = Math.floor(k / W), p = cave ? 0 : 1; used.add(key(x, y));
      for (let j = -p; j <= p; j++) for (let i = -p; i <= p; i++) bulk.add(key(x + i, y + j));
    }
    for (const c of crossings) for (const k of c.cells) { used.add(key(k % W, Math.floor(k / W))); bulk.add(key(k % W, Math.floor(k / W))); }
    if (!cave) for (const q of waterFeatures) {
      for (const k of q.bridge) used.add(key(k % W, Math.floor(k / W)));
      for (let y = rooms[q.room].y; y <= rooms[q.room].y + 1; y++) for (let x = Math.floor((q.x - 34) / TILE); x <= Math.floor((q.x + 34) / TILE); x++) used.add(key(x, y));
    }
    // nothing stands in lava or a cell from its shore: no spawn, chest, pot or prop (a chest stood half in a pool, TASKS 186)
    const shore = new Set(); for (const [x, y] of lava) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!used.has(key(x + i, y + j))) { used.add(key(x + i, y + j)); shore.add(key(x + i, y + j)); }
    const wx = (x) => x * TILE + TILE / 2, wy = (y) => y * TILE + TILE / 2 + 6;
    const enemies = [], chests = [], pots = [], traps = [], torches = [], decor = [], shrines = [], rugs = [];
    // the top wall: what hangs on it (torches, sconces, banners, the shop sign) and the tall props standing against it (columns,
    // statues, racks, shelves) must not overlap across their drawn widths, whichever came first: a prop would hide a sconce that
    // works a secret, or a torch would stick out of a statue's head
    const HANG = { wall: 14, banner: 18, shop_sign: 22 };
    const hungAt = (px, ry, hw) => torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.y - (ry * TILE - 26)) < TILE && Math.abs(t.x - px) < hw + HANG.wall)
      || decor.some((d) => HANG[d.n] && Math.abs(d.y - ry * TILE) < 2 * TILE && Math.abs(d.x - px) < hw + HANG[d.n]) || doorTop(px, ry, hw)
      || waterFeatures.some((q) => wallRow(q) === ry && Math.abs(q.x - px) < hw + 34);
    // a door in a top wall stands in a stone arch wider than its corridor
    const doorTop = (px, ry, hw) => doors.some((d) => d.dir === 'u' && d.y === ry * TILE && Math.abs(d.x - px) < hw + 58);
    const tallAt = (px, ry, hw) => decor.some((d) => d.solid && Math.abs(d.y - (ry * TILE + 22)) < 4 && Math.abs(d.x - px) < hw + half(d.n))
      || waterFeatures.some((q) => wallRow(q) === ry && Math.abs(q.x - px) < hw + 34);
    // the top wall a source is on: a campaign room's, or the row under a cave's fall (a breach or a spring hangs nothing)
    const wallRow = (q) => (cave ? (q.wallY ?? -99) : rooms[q.room].y);
    // stairs / boss altar
    const sx = exitR.cx, sy = exitR.cy + (boss ? 4 : 0); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 2; i++) used.add(key(sx + i, sy + j));
    const exit = { x: sx * TILE + TILE, y: sy * TILE + TILE / 2, tx: sx, ty: sy };
    for (let j = -1; j <= 3; j++) for (let i = -1; i <= 1; i++) used.add(key(start.cx + i, start.cy + j));   // the bonfire and the spawn tiles
    const roster = D.BIOMES[biome].roster, lvl = depth;
    const bridged = new Set(crossings.flatMap((c) => c.cells));
    const shallowIn = (r) => { const c = water.filter((k) => { const x = k % W, y = Math.floor(k / W); return at(x, y) === 1 && !bridged.has(k) && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
        && !enemies.some((e) => Math.hypot(e.x - wx(x), e.y - wy(y)) < 2 * TILE); });
      if (!c.length) return null; const k = c[Math.floor(R() * c.length)]; return [k % W, Math.floor(k / W)]; };
    const addEnemy = (type, x, y, room, elite = 0) => enemies.push({ type, x: wx(x), y: wy(y), room, elite });
    if (boss && !last) claim(exitR.cx - 3, sy, 'altar');
    for (const r of rooms) if (r.type === 'shrine') claim(r.cx, r.cy, 'altar');   // the altar's cell first: props are placed around it
    // no corner of a room is left in the dark: while some floor cell lies outside every light's reach, light the cell
    // nearest to it, preferring a sconce on the top wall, then on a side wall, then a brazier, then candles
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const lightRoom = (r, extra, wallOnly) => {
      const inR = (o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= (r.y - 1) * TILE && o.y < (r.y + r.h) * TILE;
      const lights = torches.filter((t) => t.r === r.id).map((t) => [t.x, t.y, LIGHT_R[t.kind]])
        .concat(decor.filter((d) => LIGHT_R[d.n] && inR(d)).map((d) => [d.x, d.y, LIGHT_R[d.n]]), shrines.filter(inR).map((s) => [s.x, s.y, LIGHT_R.shrine]), extra);
      if (r.id === start.id) lights.push([wx(start.cx), wy(start.cy), LIGHT_R.fire]);
      // lava glows: every cell of it lights the floor around (the scene gives each one a light of its own)
      for (const [x, y] of lava) if (at(x, y) === 3 && x >= r.x - 4 && x < r.x + r.w + 4 && y >= r.y - 4 && y < r.y + r.h + 4) lights.push([wx(x), wy(y), LIGHT_R.lava]);
      const reach = (x, y) => Math.min(...lights.map(([lx, ly, lr]) => Math.hypot(lx - wx(x), (ly - wy(y)) / 0.8) / (lr * TILE)));
      for (let k = 0; k < 12; k++) { let dark = null;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (at(x, y) === 1) { const v = lights.length ? reach(x, y) : 9; if (v > 1 && (!dark || v > dark[2])) dark = [x, y, v]; }
        if (!dark) break;
        const cand = [];
        // a cave is lit by its glowing mushrooms and crystals (TASKS 305): mushrooms grow by the rock and the water and, failing
        // that, out on the floor; a crystal stands against a straight bit of wall with open floor round it, so it never closes a
        // way; every other light leans to crystals. A sconce is the last resort: the cave's few torches are the people's
        const glass = cave && R() < 0.4 ? -0.8 : 2;
        if (cave) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { if (!free(x, y) || doorway(x, y)) continue;
          const rock = N4.filter(([dx, dy]) => at(x + dx, y + dy) === 0), shoreBy = N4.some(([dx, dy]) => wet.has((y + dy) * W + x + dx));
          cand.push([x, y, rock.length || shoreBy ? 0 : 1.5, { x: wx(x), y: wy(y), n: 'shroom', r: r.id, cell: [x, y] }]);
          if (rock.length !== 1) continue; const [dx, dy] = rock[0], open = [-1, 0, 1].every((s) => [1, 2].every((d) => at(x - dx * d + dy * s, y - dy * d + dx * s) === 1 && !used.has(key(x - dx * d + dy * s, y - dy * d + dx * s))));
          if (open && at(x + dy, y + dx) === 1 && at(x - dy, y - dx) === 1 && roomy(x, y, 'crystal_cv')) cand.push([x, y, glass, { x: wx(x), y: wy(y), n: 'crystal_cv', solid: 1, r: r.id, cell: [x, y], big: 1 }]); }
        // a cave's walls run anywhere through its box: every wall its floor meets can carry a sconce
        for (const ty of cave ? Array.from({ length: r.h }, (_, i) => r.y + i) : [r.y]) for (let x = r.x; x < r.x + r.w; x++) if (!at(x, ty - 1) && at(x, ty) === 1 && !doorway(x, ty) && !tallAt(wx(x), ty, HANG.wall) && !doorTop(wx(x), ty, HANG.wall) && !torches.some((t) => t.kind === 'wall' && Math.abs(t.x - wx(x)) < 2 * TILE && Math.abs(t.y - ty * TILE) < TILE) && !decor.some((d) => d.n === 'banner' && Math.abs(d.x - wx(x)) < 1.5 * TILE && Math.abs(d.y - ty * TILE) < TILE))
          cand.push([x, ty, cave ? 4 : 0, { x: wx(x), y: ty * TILE - 26, kind: 'wall', r: r.id }]);
        const sides = cave ? Array.from({ length: r.w }, (_, i) => [[r.x + i, -1], [r.x + i, 1]]).flat() : [[r.x, -1], [r.x + r.w - 1, 1]];
        for (let y = r.y + 1; y < r.y + r.h; y++) for (const [x, s] of sides) if (!at(x + s, y) && (free(x, y) || shore.has(key(x, y)) || wet.has(y * W + x)) && !doorway(x, y))   // a sconce hangs on the wall: a lava shore or water under it is no matter
          cand.push([x, y, cave ? 4.5 : 0.5, { x: s < 0 ? x * TILE + 14 : (x + 1) * TILE - 14, y: y * TILE + 4, kind: 'wall', side: s, r: r.id, cell: [x, y] }]);
        if (!cave) for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (!wallOnly && free(x, y) && !doorway(x, y)) {
          if (r.type !== 'start' && roomy(x, y, 'brazier')) cand.push([x, y, 1.5, { x: wx(x), y: wy(y), kind: 'brazier', r: r.id, cell: [x, y], big: 1 }]);
          cand.push([x, y, 3, { x: wx(x), y: wy(y), n: 'candles', cell: [x, y] }]); }
        const viable = cand.filter((c) => Math.hypot(c[3].x - wx(dark[0]), (c[3].y - wy(dark[1])) / 0.8) <= LIGHT_R[c[3].n || c[3].kind] * TILE);
        if (!viable.length) return false;
        const best = viable.reduce((a, b) => (Math.hypot(b[0] - dark[0], b[1] - dark[1]) + b[2] < Math.hypot(a[0] - dark[0], a[1] - dark[1]) + a[2] ? b : a))[3];
        if (best.cell) { used.add(key(...best.cell)); if (best.big) claim(...best.cell, best.n || 'brazier'); }
        delete best.cell; delete best.big; if (best.n === 'shroom') best.n = R() < 0.55 ? 'shroom_a' : 'shroom_b';
        if (best.n) decor.push(best); else torches.push(best);
        lights.push([best.x, best.y, LIGHT_R[best.n || best.kind]]); } return true; };
    // the shop: shelves on the back wall, the merchant behind a three-cell counter with the scales on it, sacks and a barrel
    // closing the space behind it, the armour and weapon stands at the sides, a sign over the counter, a lantern by every way in
    let shop = null;
    for (const r of rooms) { if (r.type !== 'shop') continue; const cx = r.cx, y0 = r.y, take = (x, y) => { used.add(key(x, y)); bulk.add(key(x, y)); };
      const inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
      const mouths = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { if (x !== r.x && x !== r.x + r.w - 1 && y !== r.y && y !== r.y + r.h - 1) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ox = x + dx, oy = y + dy; if (at(ox, oy) === 1 && !inR(ox, oy)) mouths.push([x, y, dx, dy]); } }
      const nearMouth = (x, y) => mouths.some((q) => Math.max(Math.abs(q[0] - x), Math.abs(q[1] - y)) <= 2);
      for (let y = y0; y <= y0 + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) take(x, y);
      // the customer's spot in front of the counter stays open
      for (let y = y0 + 3; y <= y0 + 4; y++) for (let x = cx - 3; x <= cx + 3; x++) used.add(key(x, y));
      // a prop may take a cell only if every other open cell of the room stays reachable from the counter
      const open = (x, y) => inR(x, y) && at(x, y) === 1 && !bulk.has(key(x, y));
      const keepsWay = (px, py) => { const seen = new Set([key(px, py)]), st = [[cx, y0 + 3]]; seen.add(key(cx, y0 + 3)); let n = 1, total = 0;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (open(x, y) && !(x === px && y === py)) total++;
        while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (open(nx, ny) && !seen.has(k)) { seen.add(k); st.push([nx, ny]); n++; } } }
        return n === total; };
      // big props go against the walls, corners first, never by a way in or out of the room
      const edgeSpot = () => { const cand = [];
        for (let y = y0 + 3; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          const side = (x === r.x && at(x - 1, y) === 0) || (x === r.x + r.w - 1 && at(x + 1, y) === 0) || (y === r.y + r.h - 1 && at(x, y + 1) === 0);
          if (side && free(x, y) && roomyCell(x, y) && !nearMouth(x, y)) cand.push([x, y, Math.min(x - r.x, r.x + r.w - 1 - x) + Math.min(y - r.y, r.y + r.h - 1 - y) <= 1 ? 0 : 1]); }
        for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
        cand.sort((p, q) => p[2] - q[2]);
        for (const [x, y] of cand) if (keepsWay(x, y)) { take(x, y); return [x, y]; } return null; };
      const along = (n) => { const p = edgeSpot(); if (p) decor.push({ x: wx(p[0]), y: wy(p[1]), n, solid: 1, r: r.id }); };
      // the stands go against the back wall clear of the wide shelves, or else along another wall
      const wall = (dir, n) => { for (let x = cx + dir * 4; x >= r.x && x < r.x + r.w; x += dir)
          if (at(x, y0 - 1) === 0 && free(x, y0) && roomyCell(x, y0) && !nearMouth(x, y0) && keepsWay(x, y0)) { take(x, y0); decor.push({ x: wx(x), y: y0 * TILE + 22, n, solid: 1, r: r.id }); return; }
        along(n); };
      decor.push({ x: wx(cx - 2), y: y0 * TILE + 22, n: 'shop_shelf', solid: 1, r: r.id }, { x: wx(cx + 2), y: y0 * TILE + 22, n: 'shop_shelf', solid: 1, r: r.id });
      decor.push({ x: wx(cx - 2), y: wy(y0 + 1), n: 'shop_sacks', solid: 1, r: r.id }, { x: wx(cx + 2), y: wy(y0 + 1), n: 'shop_barrel', solid: 1, r: r.id });
      decor.push({ x: wx(cx), y: y0 * TILE - 34, n: 'shop_sign', wall: 1 });
      const cy = wy(y0 + 2);
      shop = { room: r.id, x: wx(cx), y: cy - 16, counter: { x: wx(cx), y: cy }, front: { x: wx(cx), y: cy + 30 },
        solid: [-1, 0, 1].map((i) => [wx(cx + i), cy]), lanterns: [] };
      // a lantern beside each corridor mouth, on the room's side of it and out of the way
      const lit = new Set();
      for (const [x, y, dx, dy] of mouths) { if (lit.has(key(x, y))) continue; const ax = dy ? 1 : 0, ay = dx ? 1 : 0;
        let a = 0; while (mouths.some((q) => q[0] === x + ax * (a + 1) && q[1] === y + ay * (a + 1) && q[2] === dx && q[3] === dy)) a++;
        for (let k = 0; k <= a; k++) lit.add(key(x + ax * k, y + ay * k));
        for (const [lx, ly] of [[x + ax * (a + 1), y + ay * (a + 1)], [x - ax, y - ay]]) if (inR(lx, ly) && free(lx, ly) && roomyCell(lx, ly) && keepsWay(lx, ly)) {
          take(lx, ly); shop.lanterns.push({ x: wx(lx), y: wy(ly) }); break; } }
      for (const L0 of shop.lanterns) decor.push({ x: L0.x, y: L0.y, n: 'shop_lantern', solid: 1, r: r.id });
      wall(-1, 'shop_armor'); wall(1, 'shop_weapons');
      for (const x of [r.x + 1, r.x + r.w - 2]) if (!at(x, r.y - 1) && Math.abs(x - cx) > 3 && !tallAt(wx(x), r.y, HANG.wall)) torches.push({ x: x * TILE + TILE / 2, y: r.y * TILE - 26, kind: 'wall', r: r.id });
      along('shop_gold'); along('shop_crate'); lightRoom(r, shop.lanterns.map((q) => [q.x, q.y, LIGHT_R.wall]).concat([[shop.x, shop.y, LIGHT_R.fire]]), !cave); }   // a cave's merchant room reaches past his walls
    if (!shop) return null;
    // a room furnished to a plan (data.js ROOM_PLANS): every solid piece keeps all of the room's open floor reachable from its ways in
    let stackN = 0;
    const furnish = (r, zb) => {
      const inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, cellOf = (o) => key(Math.floor(o.x / TILE), Math.floor((o.y - 1) / TILE));
      const hard = new Set([...chests, ...pots, ...torches.filter((t) => t.kind !== 'wall'), ...decor.filter((d) => d.solid && !d.wall)].map(cellOf));
      if (r.type === 'shrine') hard.add(key(r.cx, r.cy));
      const mouths = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = at(x + dx, y + dy); return (c === 1 || c === 4) && !inR(x + dx, y + dy); })) mouths.push([x, y]);
      const open = (x, y) => inR(x, y) && at(x, y) === 1 && !hard.has(key(x, y));
      const keeps = (cells) => { for (const [x, y] of cells) hard.add(key(x, y)); let total = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (open(x, y)) total++;
        const st = mouths.filter(([x, y]) => open(x, y)), seen = new Set(st.map(([x, y]) => key(x, y)));
        while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (open(nx, ny) && !seen.has(k)) { seen.add(k); st.push([nx, ny]); } } }
        const ok = !mouths.length || (seen.size === total && mouths.every(([x, y]) => open(x, y))); if (!ok) for (const [x, y] of cells) hard.delete(key(x, y)); return ok; };
      const pool = new Set([...D.BIOMES[zb].props, ...(r.zone === 'crypt' ? ['coffin', 'grave'] : []), ...(r.zone === 'arcane' ? ['crystal'] : [])]), has = (ns) => ns.filter((n) => pool.has(n));
      const kinds = r.type === 'boss' ? ['arena'] : r.type === 'start' ? ['store'] : r.type === 'boss' || r.type === 'shrine' ? ['hall', 'gallery', 'crypt', 'sanctum'] : Object.keys(D.ROOM_PLANS).filter((k) => k !== 'arena');
      let fit = kinds.filter((k) => { const P = D.ROOM_PLANS[k]; return !P.need.length || has(P.need).length; });
      if (r.zone === 'crypt' && fit.includes('crypt')) fit = ['crypt']; if (r.zone === 'arcane' && fit.includes('sanctum')) fit = ['sanctum'];
      if (!fit.length) return;
      let roll = R() * fit.reduce((a, k) => a + D.ROOM_PLANS[k].w, 0), plan = fit[0]; for (const k of fit) { roll -= D.ROOM_PLANS[k].w; if (roll < 0) { plan = k; break; } }
      const P = r.type === 'boss' && bossType === 'boss_necro' ? Object.assign({}, D.ROOM_PLANS[plan], { floor: { n: ['pillar'], mode: 'pair' } }) : D.ROOM_PLANS[plan], busy = r.type === 'boss' || r.type === 'shrine' || r.type === 'start', c2 = 2 * r.x + r.w - 1;
      r.plan = plan;
      // the back wall: one kind of tall prop, evenly spaced or mirrored about the room's axis
      const backOK = (x, n) => x > r.x && x < r.x + r.w - 1 && at(x, r.y - 1) === 0 && free(x, r.y) && free(x, r.y + 1) && roomy(x, r.y, n) && roomyCell(x, r.y + 1) && !doorway(x, r.y) && !hungAt(wx(x), r.y, half(n)) && keeps([[x, r.y]]) && (hard.delete(key(x, r.y)), true);
      const putBack = (x, n) => { claim(x, r.y, n); used.add(key(x, r.y + 1)); bulk.add(key(x, r.y + 1)); hard.add(key(x, r.y)); decor.push({ x: wx(x), y: r.y * TILE + 22, n, solid: 1, r: r.id }); };
      const bn = P.back && has(P.back.n)[0];
      if (bn) { const step = Math.ceil((D.PROP_W[bn] + 8) / TILE);
        if (P.back.mode === 'row') { let k = Math.min(P.back.max, 1 + Math.floor((r.w - 3) / step)); const x0 = Math.round(c2 / 2 - (k - 1) * step / 2);
          for (let q = 0; q < k; q++) for (const d of [0, 1, -1]) { const x = x0 + q * step + d; if (backOK(x, bn)) { putBack(x, bn); break; } } }
        else { let placed = 0; const cn = P.back.center && pool.has(P.back.center) ? P.back.center : null;
          if (cn && c2 % 2 === 0 && backOK(c2 / 2, cn)) putBack(c2 / 2, cn);
          for (let x = Math.floor((c2 - 1) / 2); x > r.x && placed < P.back.max; x--) { const xm = c2 - x;
            if (xm <= x || Math.abs(wx(xm) - wx(x)) < D.PROP_W[bn] + 4 || !backOK(x, bn) || !backOK(xm, bn)) continue;
            putBack(x, bn); putBack(xm, bn); placed++; x -= step - 1; } } }
      // the floor: coffins or crystals in mirrored rows with an aisle down the middle, the front row and the walls' lanes kept open
      const floorOK = (x, y, n) => x > r.x && x < r.x + r.w - 1 && free(x, y) && !doorway(x, y) && roomy(x, y, n);
      const putFloor = (x, y, n) => { claim(x, y, n); hard.add(key(x, y)); decor.push({ x: wx(x), y: wy(y), n, solid: 1, r: r.id, cover: r.type === 'boss' && n === 'pillar' ? 1 : 0 }); };
      const fn = P.floor && (!busy || r.type === 'boss') && has(P.floor.n)[R() < 0.5 ? 0 : has(P.floor.n).length - 1];
      if (fn && r.w >= 7 && r.h >= 6) { const a0 = Math.max(2, Math.ceil((D.PROP_W[fn] + 4) / (2 * TILE))), x = Math.floor((c2 - 2 * a0) / 2), xm = c2 - x;
        const rows = P.floor.mode === 'pair' ? [r.y + Math.floor(r.h / 2)] : []; if (P.floor.mode === 'rows') for (let y = r.y + 3; y <= r.y + r.h - 2; y += 2) rows.push(y);
        for (const y of rows) if (xm - x >= 2 && floorOK(x, y, fn) && floorOK(xm, y, fn) && Math.abs(wx(xm) - wx(x)) >= D.PROP_W[fn] + 4 && keeps([[x, y], [xm, y]])) { putFloor(x, y, fn); putFloor(xm, y, fn); } }
      // stacks of barrels and crates in corners, read as one pile (they overlap on purpose)
      const corners = [[r.x, r.y + r.h - 1, 1, -1], [r.x + r.w - 1, r.y + r.h - 1, -1, -1], [r.x, r.y, 1, 1], [r.x + r.w - 1, r.y, -1, 1]];
      for (let q = corners.length - 1; q > 0; q--) { const z = Math.floor(R() * (q + 1)); [corners[q], corners[z]] = [corners[z], corners[q]]; }
      let stacks = r.type === 'start' ? Math.min(1, P.stacks || 0) : P.stacks || 0;
      for (const [x0, y0, ix, iy] of corners) { if (stacks <= 0) break; if (at(x0 - ix, y0) !== 0 || at(x0, y0 - iy) !== 0) continue;
        const cells = [[x0, y0], [x0 + ix, y0], [x0, y0 + iy]].slice(0, 2 + (R() < 0.6 ? 1 : 0)).filter(([x, y]) => inR(x, y) && free(x, y) && !doorway(x, y) && roomyCell(x, y) && !wide.some(([ex, ey, eh]) => Math.abs(ey - y) <= 1 && Math.abs(ex - wx(x)) < eh + 28));
        if (cells.length < 2 || !keeps(cells)) continue; stacks--; stackN++;
        for (const [x, y] of cells) { const kind = R() < 0.5 ? 'barrel' : 'crate'; used.add(key(x, y)); bulk.add(key(x, y)); pots.push({ x: wx(x), y: wy(y), kind, hp: 1, stack: stackN }); }
        for (const [x, y] of cells) wide.push([wx(x), y, 24]); }
      // a table by a side wall with candles burning on it
      if (P.table && !busy && R() < P.table) { const side = R() < 0.5 ? -1 : 1, x = side < 0 ? r.x + 1 : r.x + r.w - 2, mid = r.y + Math.floor(r.h / 2);
        for (const y of [mid, mid + 1, mid - 1, mid + 2]) if (y > r.y + 1 && y < r.y + r.h - 1 && floorOK(x, y, 'table') && keeps([[x, y]])) { putFloor(x, y, 'table'); decor.push({ x: wx(x) + ri(-5, 5), y: wy(y) + 1, n: 'candles', lift: 22 }); break; } }
      // pots in a line along one side wall
      if (P.side && !busy) { const x = R() < 0.5 ? r.x : r.x + r.w - 1, s = x === r.x ? -1 : 1; let n = 0;
        for (let y = r.y + 2; y < r.y + r.h - 1 && n < 3; y += 2) if (at(x + s, y) === 0 && free(x, y) && !doorway(x, y) && roomy(x, y, P.side) && keeps([[x, y]])) { claim(x, y, P.side); pots.push({ x: wx(x), y: wy(y), kind: P.side, hp: 1 }); n++; } }
      // bones by the walls, never strewn across the floor
      for (let q = 0, n = ri(0, P.bones || 0); q < n; q++) for (let k = 0; k < 20; k++) { const side = ri(0, 2), x = side === 0 ? r.x : side === 1 ? r.x + r.w - 1 : ri(r.x, r.x + r.w - 1), y = side === 2 ? r.y + r.h - 1 : ri(r.y + 1, r.y + r.h - 1);
        if (free(x, y) && !doorway(x, y)) { used.add(key(x, y)); decor.push({ x: wx(x), y: wy(y), n: 'bones' }); break; } } };
    // a chest stands against a side or the front wall, out of the ways in
    const wallSpot = (r, n) => { const c = []; for (let y = r.y + (cave ? 0 : 2); y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        if (cave ? at(x - 1, y) !== 0 && at(x + 1, y) !== 0 && at(x, y + 1) !== 0 : !(x === r.x && at(x - 1, y) === 0) && !(x === r.x + r.w - 1 && at(x + 1, y) === 0) && !(y === r.y + r.h - 1 && at(x, y + 1) === 0)) continue;
        if (free(x, y) && !doorway(x, y) && roomy(x, y, n)) c.push([x, y]); }
      if (!c.length) return null; const p = c[Math.floor(R() * c.length)]; used.add(key(...p)); claim(...p, n); return p; };
    for (const r of rooms) { if (r.type === 'shop') continue;
      const area = r.w * r.h, zb = r.zone || biome;
      // an accent zone is lit by hearths of its colour in the corners (and mid-sides of a long room), the arcane one round a crystal
      // obelisk: the concept's blue hall is pools of cold fire in the dark, not a room washed blue (TASKS 188). A hearth stands a
      // cell in from the walls and a cell clear of a way in, so it never stands in a doorway
      if (r.zone && r.zone !== 'dungeon' && r.type !== 'boss' && r.type !== 'shrine') {
        const clear = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (doorway(x + i, y + j)) return false; return free(x, y); };
        const spots = [[r.x + 1, r.y + 1], [r.x + r.w - 2, r.y + 1], [r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]].concat(r.w >= 11 ? [[r.cx, r.y + 1], [r.cx, r.y + r.h - 2]] : []);
        for (const [x, y] of spots) { const sx = Math.sign(r.cx - x), sy = Math.sign(r.cy - y), p = [[x, y], [x + sx, y], [x, y + sy], [x + sx, y + sy]].find(([a, b]) => clear(a, b) && roomy(a, b, 'brazier'));
          if (p) { claim(p[0], p[1], 'brazier'); torches.push({ x: wx(p[0]), y: wy(p[1]), kind: 'brazier', r: r.id }); } }
        if (r.zone === 'arcane' && r.type !== 'treasure' && clear(r.cx, r.cy) && roomy(r.cx, r.cy, 'crystal')) { claim(r.cx, r.cy, 'crystal'); decor.push({ x: wx(r.cx), y: wy(r.cy), n: 'crystal', solid: 1, r: r.id }); } }
      // the hoard's centrepiece, as in the reference: a rug running from the top wall with the best chest on it
      let first = null;
      if (r.type === 'treasure' && r.w >= 7 && r.h >= 6 && !cave) { const y0 = r.y + 1; rugs.push({ cx: wx(r.cx), y: y0 * TILE - 6, h: Math.min(r.h - 2, 4.4) * TILE });
        if (free(r.cx, y0 + 1) && roomy(r.cx, y0 + 1)) { claim(r.cx, y0 + 1); first = [r.cx, y0 + 1]; } }
      if (r.type !== 'treasure' && r.type !== 'secret' && !cave) furnish(r, zb);   // a secret room is a small cache: its chest and gold need the space
      if (r.type === 'combat' || r.type === 'exit' || r.type === 'treasure') {
        let n = Math.min(Math.floor(area / 9), 2 + Math.floor(depth / 2) + ri(0, 3) + (r.type === 'exit' ? 2 : 0) - (r.type === 'treasure' ? 1 : 0));
        n = Math.max(1, Math.round(n * D.BAL.pop));
        const pack = pick(roster), guard = r.type === 'exit' && !!N.guard[floor];
        for (let i = 0; i < n; i++) { const p = spot(r, 1); if (!p) break;
          let type = R() < 0.6 ? pack : pick(roster); if (type === 'brute' && R() < 0.6) type = pack === 'brute' ? 'skeleton' : pack;
          // a drowned lies in the room's shallows (TASKS 307); a room with none takes another of the roster
          if (ENEMIES[type].lurk) { const q = shallowIn(r); if (q) { p[0] = q[0]; p[1] = q[1]; } else type = roster.find((o) => !ENEMIES[o].lurk); }
          // on floors 1–2 the guard is the exit's only elite: two at once killed before a potion could help
          addEnemy(type, p[0], p[1], r.id, (r.type === 'exit' && i === 0 && !(guard && depth <= 2)) || (depth >= 3 && R() < D.ELITE.share) ? 1 : 0);
          if (r.type === 'exit' && i === 0) enemies[enemies.length - 1].exit = 1; }
        if (guard) { const p = spot(r, 2); if (p) { addEnemy('brute', p[0], p[1], r.id, 1); enemies[enemies.length - 1].guard = 1; } }
      }
      if (r.type === 'boss') { addEnemy(bossType, r.cx, r.cy - 3, r.id, 1); for (let i = 0; i < (bossType === 'boss' || bossType === 'boss_necro' ? Math.round(4 * D.BAL.pop) : 0); i++) { const p = spot(r, 2); if (p) addEnemy(bossType === 'boss_necro' ? 'skeleton' : pick(roster.filter((t) => t !== 'brute')), p[0], p[1], r.id); } }
      // chests
      // a locked room pays for its key: one chest of the secret rooms' tier and another of the hoards', often a heap of gold
      const nc = Math.min(1 + Math.floor(r.w * r.h / 30), r.locked ? 2 : r.type === 'treasure' ? 1 + (r.w * r.h >= 70 && R() < 0.4 ? 1 : 0) : r.type === 'secret' ? 1 : r.type === 'boss' ? 0 : r.type === 'start' ? (floor === 1 ? 1 : 0) : R() < 0.2 ? 1 : 0);
      for (let i = 0; i < nc; i++) { const p = i === 0 && first ? first : (r.type === 'secret' ? spot(r, 1, 0, true) : null) || wallSpot(r, 'chest') || spot(r, 1, 0, true); if (p) chests.push({ x: wx(p[0]), y: wy(p[1]), tier: r.type === 'secret' || (r.locked && i === 0) ? 3 : r.type === 'treasure' || r.locked ? 2 : 1, open: 0 }); }
      // the hoard's dressing: a statue each side of the rug against the back wall, vases along the walls, now and then a small
      // pile of gold
      if (r.type === 'treasure') {
        if (!cave) for (const side of [-1, 1]) for (const d of [3, 4, 2]) { const x = r.cx + side * d; if (x <= r.x || x >= r.x + r.w - 1 || at(x, r.y - 1) !== 0 || !free(x, r.y) || !free(x, r.y + 1) || !roomy(x, r.y, 'statue') || doorway(x, r.y) || hungAt(wx(x), r.y, half('statue'))) continue;
          claim(x, r.y, 'statue'); used.add(key(x, r.y + 1)); decor.push({ x: wx(x), y: r.y * TILE + 22, n: 'statue', solid: 1, r: r.id }); break; }
        for (let i = 0, n = ri(2, 4); i < n; i++) { const kind = pick(['vase_a', 'vase_b', 'vase_c']), p = wallSpot(r, kind); if (p) pots.push({ x: wx(p[0]), y: wy(p[1]), kind, hp: 1 }); }
        if (R() < 0.25) { const p = wallSpot(r, 'goldpile'); if (p) pots.push({ x: wx(p[0]), y: wy(p[1]), kind: 'goldpile', hp: 1 }); } }
      // a heap of gold is a secret or a locked room's reward only (a rich one), never left lying in the open
      if (r.type === 'secret' || (r.locked && R() < 0.6)) { const p = spot(r, 1, 0, 'gold'); if (p) pots.push({ x: wx(p[0]), y: wy(p[1]), kind: 'gold', hp: 1, rich: 1 }); }
      // torches on the top wall face (cells above the room's first row that are rock), every 4–5 tiles, between the tall props
      if (!cave) for (let x = r.x + 1 + ri(0, 1); x < r.x + r.w - 1; x += ri(3, 5)) if (!at(x, r.y - 1) && at(x, r.y) && !tallAt(wx(x), r.y, HANG.wall) && !doorTop(wx(x), r.y, HANG.wall)) torches.push({ x: x * TILE + TILE / 2, y: r.y * TILE - 26, kind: 'wall', r: r.id });
      if (!cave) for (let x = r.x + 2; x < r.x + r.w - 2; x += ri(5, 8)) if (!at(x, r.y - 1) && R() < 0.5 && !tallAt(wx(x), r.y, HANG.banner) && !doorTop(wx(x), r.y, HANG.banner) && !torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.x - wx(x)) < 1.5 * TILE && Math.abs(t.y - r.y * TILE) < TILE)) decor.push({ x: x * TILE + TILE / 2, y: r.y * TILE - 2, n: 'banner', wall: 1 });
      // standing lights, as the concept has them (TASKS 194): candlesticks at the foot of the top wall between its sconces, candelabra
      // either side of a hoard's chest or a shrine's altar, a pair of torch posts flanking a way in through a side or the bottom wall
      if (r.type !== 'secret' && r.type !== 'boss' && !cave) {
        // a stand must leave every open cell of the room reachable from its ways in: lava, chests, pots and solid props already
        // there count as walls (a candlestick once sealed a nook between a rack and a lava pool)
        const inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, cellOf = (o) => key(Math.floor(o.x / TILE), Math.floor((o.y - 1) / TILE));
        const nookFree = (px, py, also) => { const hard = new Set([...chests, ...pots, ...torches.filter((t) => t.kind !== 'wall'), ...decor.filter((d) => d.solid && !d.wall)].map(cellOf));
          hard.add(key(px, py)); if (also) hard.add(key(...also)); if (r.type === 'shrine') hard.add(key(r.cx, r.cy));
          const open = (x, y) => inR(x, y) && at(x, y) === 1 && !hard.has(key(x, y)), seen = new Set(), st = [];
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (open(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 1 && !inR(x + dx, y + dy))) { seen.add(key(x, y)); st.push([x, y]); }
          if (!st.length) return true;
          while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (open(nx, ny) && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); st.push([nx, ny]); } } }
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (open(x, y) && !seen.has(key(x, y))) return false;
          return true; };
        const fits = (x, y, n, also) => free(x, y) && !doorway(x, y) && roomy(x, y, n) && nookFree(x, y, also);
        const stand = (x, y, n, py = wy(y)) => { claim(x, y, n); decor.push({ x: wx(x), y: py, n, solid: 1, r: r.id }); };
        const sticks = [];
        for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (at(x, r.y - 1) === 0 && !tallAt(wx(x), r.y, half('candlestick')) && !hungAt(wx(x), r.y, half('candlestick'))) sticks.push([x, r.y, r.y * TILE + 22]);
        for (let y = r.y + 2; y < r.y + r.h - 1; y++) for (const x of [r.x, r.x + r.w - 1]) if (at(x + (x === r.x ? -1 : 1), y) === 0 && !torches.some((t) => t.side && Math.abs(t.y - y * TILE) < 1.5 * TILE && Math.abs(t.x - wx(x)) < TILE)) sticks.push([x, y, wy(y)]);
        for (let i = 0, n = 1 + (r.w * r.h >= 80) + (r.w * r.h >= 120); i < n && sticks.length; i++) { const [x, y, py] = sticks.splice(Math.floor(R() * sticks.length), 1)[0];
          if (fits(x, y, 'candlestick')) stand(x, y, 'candlestick', py); }
        const pair = (a, b, n) => { if (fits(...a, n) && fits(...b, n, a) && (a[1] !== b[1] || Math.abs(a[0] - b[0]) * TILE > half(n) * 2 + 4)) { stand(...a, n); stand(...b, n); } };
        if (r.type === 'treasure' && r.h >= 6) pair([r.cx - 2, r.y + 2], [r.cx + 2, r.y + 2], 'candelabra');
        if (r.type === 'shrine') pair([r.cx - 2, r.cy - 1], [r.cx + 2, r.cy - 1], 'candelabra');
        if (r.type !== 'shrine' && r.w >= 8 && R() < 0.8) {
          const ways = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) if (at(x + dx, y + dy) === 1 && !inRoom(x + dx, y + dy)) {
            const g = ways.find((w) => w.dx === dx && w.dy === dy && (dx ? w.a === x && y - w.hi === 1 : w.a === y && x - w.hi === 1));
            if (g) g.hi++; else ways.push({ dx, dy, a: dx ? x : y, lo: dx ? y : x, hi: dx ? y : x }); }
          const w = ways.length ? ways[Math.floor(R() * ways.length)] : null;
          if (w) pair(w.dx ? [w.a, w.lo - 2] : [w.lo - 2, w.a], w.dx ? [w.a, w.hi + 2] : [w.hi + 2, w.a], 'torch_stand'); } }
      // one group at most, and never at the foot of a statue, a rack or a sconce: candles piled on a pedestal read as clutter
      if (!cave) for (let i = 0, n = R() < 0.6 ? 1 : 0; i < n; i++) { const x = ri(r.x + 1, r.x + r.w - 2); if (!free(x, r.y) || at(x, r.y - 1) !== 0 || doorway(x, r.y) || !roomy(x, r.y, 'candles') || tallAt(wx(x), r.y, 14) || hungAt(wx(x), r.y, 6)) continue; used.add(key(x, r.y)); decor.push({ x: wx(x) + ri(-6, 6), y: r.y * TILE + 20, n: 'candles' }); }
      if (r.type === 'shrine') shrines.push({ x: wx(r.cx), y: wy(r.cy), used: 0 });
      lightRoom(r, []);
    }
    if (boss && !last) shrines.push({ x: wx(exitR.cx - 3), y: wy(sy), used: 0, boss: bossType });
    // ---- the cave's dressing (TASKS 306), from a stream of its own so the halls' monsters and chests stay where they were. Solid props
    // (stalagmites, boulders, a wreck, a tent) stand on dry floor against the rock, never on a cell whose blocking could cut a way: its
    // open neighbours must still meet round it. Each hall is dressed to a plan of data.js ROOM_PLANS (the ones with `cave`); the start
    // hall is an explorer's camp round the fire. Water plants and lilies float on calm water and moss hangs from the rock faces: they
    // stand in nobody's way, so they are a list of their own (flora), not props ----
    const flora = [];
    if (cave) {
      const Dr = mul32(seed ^ 0x306d1e5), dri = (a, b) => a + Math.floor(Dr() * (b - a + 1)), N8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
      // a crossing's planks run on over the shallows to the dry floor (span): nothing grows under them
      const over = new Set(crossings.flatMap((c) => c.cells)); for (const c of crossings) if (c.span) { const [u0, u1, v0] = c.span;
        for (let u = u0 - 1; u <= u1 + 1; u++) for (let v = v0 - 1; v <= v0 + 2; v++) over.add(c.axis === 'x' ? v * W + u : u * W + v); }
      const wetAt = (x, y) => wet.has(y * W + x) || at(x, y) === 6 || over.has(y * W + x);
      const dry = (x, y) => at(x, y) === 1 && !wetAt(x, y), rockN = (x, y) => N4.filter(([dx, dy]) => at(x + dx, y + dy) === 0).length;
      const shoreAt = (x, y) => dry(x, y) && N8.some(([dx, dy]) => wetAt(x + dx, y + dy));
      const hardC = new Set(); const hard = (px, py) => hardC.add(key(Math.floor(px / TILE), Math.floor(py / TILE)));
      for (const o of [...chests, ...pots, ...shrines, ...torches.filter((t) => t.kind !== 'wall'), ...decor.filter((d) => d.solid && !d.wall)]) hard(o.x, o.y); for (const [x, y] of shop.solid) hard(x, y);
      const go = (x, y) => at(x, y) === 1 && !hardC.has(key(x, y));
      // blocking (x, y) keeps every way: its open side neighbours are joined round the ring of its eight
      const keepsWay = (x, y) => { const ring = N8.map(([dx, dy]) => go(x + dx, y + dy)), comp = new Array(8).fill(-1); let n = 0;
        for (let i = 0; i < 8; i++) { if (!ring[i] || comp[i] >= 0) continue; for (let j = i; ring[j % 8] && comp[j % 8] < 0; j++) comp[j % 8] = n; for (let j = i - 1; ring[(j + 8) % 8] && comp[(j + 8) % 8] < 0; j--) comp[(j + 8) % 8] = n; n++; }
        const sides = [1, 3, 5, 7].filter((i) => ring[i]).map((i) => comp[i]); return sides.every((c) => c === sides[0]); };
      // the water's own cells count as bulky (so nothing stands in it): by the water, only the props round count
      const roomyBy = (x, y, n) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (bulk.has(key(x + i, y + j)) && !wetAt(x + i, y + j)) return false;
        return !wide.some(([ex, ey, eh]) => Math.abs(ey - y) <= 1 && Math.abs(ex - wx(x)) < eh + half(n) + 4); };
      const canStand = (x, y, n) => dry(x, y) && free(x, y) && !doorway(x, y) && roomyBy(x, y, n) && keepsWay(x, y) && !(at(x, y - 1) === 0 && hungAt(wx(x), y, half(n)));
      const stand = (x, y, n, r) => { claim(x, y, n); hardC.add(key(x, y)); decor.push({ x: wx(x), y: wy(y), n, solid: 1, r }); };
      const shuffled = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Dr() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const cellsOf = (r, f) => { const out = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (f(x, y)) out.push([x, y]); return shuffled(out); };
      // a pile of barrels and crates against the rock, read as one (they overlap on purpose)
      const stack = (r, near) => { const c0 = cellsOf(r, (x, y) => rockN(x, y) >= 1 && dry(x, y) && free(x, y) && !doorway(x, y) && roomyCell(x, y) && keepsWay(x, y)).sort((a, b) => (near ? Math.hypot(a[0] - near[0], a[1] - near[1]) - Math.hypot(b[0] - near[0], b[1] - near[1]) : 0));
        for (const [x, y] of c0.slice(0, 12)) { const cs = [[x, y], ...N4.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => rockN(a, b) >= 1 && dry(a, b) && free(a, b) && !doorway(a, b) && roomyCell(a, b))].slice(0, dri(2, 3));
          if (cs.length < 2 || cs.some(([a, b]) => wide.some(([ex, ey, eh]) => Math.abs(ey - b) <= 1 && Math.abs(ex - wx(a)) < eh + 28))) continue;
          const ok = []; for (const [a, b] of cs) { if (!keepsWay(a, b)) break; hardC.add(key(a, b)); ok.push([a, b]); } if (ok.length < 2) { for (const [a, b] of ok) hardC.delete(key(a, b)); continue; }
          stackN++; for (const [a, b] of ok) { used.add(key(a, b)); bulk.add(key(a, b)); pots.push({ x: wx(a), y: wy(b), kind: Dr() < 0.5 ? 'barrel' : 'crate', hp: 1, stack: stackN }); wide.push([wx(a), b, 24]); } return true; } return false; };
      const lie = (r, n, k, by) => { for (const [x, y] of cellsOf(r, (x, y) => dry(x, y) && free(x, y) && !doorway(x, y) && rockN(x, y) >= 1 && (!by || Math.hypot(x - by[0], y - by[1]) < 5)).slice(0, k)) {
        used.add(key(x, y)); decor.push({ x: wx(x) + dri(-6, 6), y: wy(y), n, f: Dr() < 0.5 ? 1 : 0, r: r.id }); } };
      const rocks = (r, k, glass) => { let n = 0; for (const [x, y] of cellsOf(r, (x, y) => rockN(x, y) >= 1 || N8.filter(([dx, dy]) => at(x + dx, y + dy) === 0).length >= 3)) { if (n >= k) break;
        const by = shoreAt(x, y), nm = glass && by && Dr() < 0.25 && !decor.some((d) => d.n === 'crystal_cv' && Math.hypot(d.x - wx(x), d.y - wy(y)) < 9 * TILE) ? 'crystal_cv' : pick4(); if (canStand(x, y, nm)) { stand(x, y, nm, r.id); n++; } } };
      const ROCKS = ['stalag_a', 'stalag_b', 'boulder_a', 'boulder_b', 'stalag_a', 'boulder_b'], pick4 = () => ROCKS[Math.floor(Dr() * ROCKS.length)];
      const plans = Object.entries(D.ROOM_PLANS).filter(([, P]) => P.cave && P.need.every((n) => D.BIOMES.cave.props.includes(n)));
      for (const r of rooms) {
        if (r.type === 'shop' || r.type === 'secret' || r.type === 'boss') continue;
        if (r === start) {
          // the explorer's camp: the tent backed against the rock a few steps from the fire, a pile of his barrels and crates, now and
          // then what is left of him
          const fire = [start.cx, start.cy], tent = cellsOf(r, (x, y) => at(x, y - 1) === 0 && Math.hypot(x - fire[0], y - fire[1]) >= 2.5 && Math.hypot(x - fire[0], y - fire[1]) <= 5.5)
            .sort((a, b) => Math.hypot(a[0] - fire[0], a[1] - fire[1]) - Math.hypot(b[0] - fire[0], b[1] - fire[1])).find(([x, y]) => canStand(x, y, 'tent_cv'));
          if (tent) { stand(...tent, 'tent_cv', r.id); r.camp = 1; }
          stack(r, tent || fire); if (Dr() < 0.45) lie(r, 'skel_cv', 1, fire); lie(r, 'bones', dri(0, 1));
          continue; }
        // a wreck wants a shore with deep water by it, or across a cell of shallows
        const deepBy = (x, y) => N4.some(([dx, dy]) => at(x + dx, y + dy) === 6 || (wet.has((y + dy) * W + x + dx) && N8.some(([ex, ey]) => at(x + dx + ex, y + dy + ey) === 6)));
        const want = plans.filter(([, P]) => !P.cave.wreck || cellsOf(r, (x, y) => shoreAt(x, y) && deepBy(x, y)).length);
        let roll = Dr() * want.reduce((a, [, P]) => a + P.w, 0), plan = want[0]; for (const q of want) { roll -= q[1].w; if (roll < 0) { plan = q; break; } }
        if (!plan) continue; const P = plan[1].cave, nOf = (v) => (Array.isArray(v) ? dri(v[0], v[1]) : v || 0), area = r.w * r.h; r.plan = plan[0];
        if (P.wreck) { const c = cellsOf(r, (x, y) => shoreAt(x, y) && deepBy(x, y)).find(([x, y]) => canStand(x, y, 'wreck_cv')); if (c) stand(...c, 'wreck_cv', r.id); }
        if (P.tent) { const c = cellsOf(r, (x, y) => at(x, y - 1) === 0).find(([x, y]) => canStand(x, y, 'tent_cv')); if (c) stand(...c, 'tent_cv', r.id); }
        rocks(r, Math.round(nOf(P.rocks) * Math.min(1.5, area / 90)), true);
        for (let i = nOf(P.stacks); i > 0; i--) stack(r);
        lie(r, 'skel_cv', nOf(P.skel)); lie(r, 'bones', nOf(P.bones)); }
      // more glowing mushrooms than the light needs, in clumps of two or three along the water's edge (the concept's banks glow)
      for (const r of rooms) { if (r.type === 'shop' || r.type === 'secret') continue; let n = Math.round(r.w * r.h / 110);
        for (const [x, y] of cellsOf(r, (x, y) => shoreAt(x, y) && free(x, y) && !doorway(x, y))) { if (n <= 0) break; if (decor.some((d) => /^shroom/.test(d.n) && Math.abs(d.x - wx(x)) < 5 * TILE && Math.abs(d.y - wy(y)) < 4 * TILE)) continue;
          const clear = (a, b) => !wide.some(([ex, ey, eh]) => Math.abs(ey - b) <= 1 && Math.abs(ex - wx(a)) < eh + 14); if (!clear(x, y)) continue;
          const clump = [[x, y], ...N8.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => shoreAt(a, b) && free(a, b) && !doorway(a, b) && clear(a, b))].slice(0, dri(2, 3));
          for (const [a, b] of clump) { used.add(key(a, b)); decor.push({ x: wx(a) + dri(-8, 8), y: wy(b) + dri(-4, 3), n: Dr() < 0.55 ? 'shroom_a' : 'shroom_b' }); } n--; } }
      // calm water (no stream's current, away from a fall) carries lilies in loose groups; weed stands up out of the water by its edge;
      // moss hangs from the low faces of the rock over floor or water
      const src = waterFeatures.map((q) => q.cell), calm = (x, y) => wetAt(x, y) && !over.has(y * W + x) && waterFlow[y * W + x] === undefined && !src.some((k) => Math.abs(k % W - x) + Math.abs(Math.floor(k / W) - y) < 4);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (calm(x, y) && Dr() < 0.05) for (const [dx, dy] of [[0, 0], ...N8].filter(() => Dr() < 0.4).slice(0, 3)) if (calm(x + dx, y + dy) && !flora.some((o) => o.n === 'lily_cv' && Math.abs(o.x - wx(x + dx)) < 20 && Math.abs(o.y - wy(y + dy)) < 16))
          flora.push({ n: 'lily_cv', x: wx(x + dx) + dri(-8, 8), y: (y + dy) * TILE + dri(10, 22), f: Dr() < 0.5 ? 1 : 0, s: +(0.75 + 0.4 * Dr()).toFixed(2) });
        if (wetAt(x, y) && !over.has(y * W + x) && N8.some(([dx, dy]) => dry(x + dx, y + dy) || at(x + dx, y + dy) === 0) && Dr() < 0.07)
          flora.push({ n: 'weed_cv', x: wx(x) + dri(-8, 8), y: y * TILE + dri(14, 26), f: Dr() < 0.5 ? 1 : 0, s: +(0.7 + 0.45 * Dr()).toFixed(2) });
        if (at(x, y) === 0 && (at(x, y + 1) === 1 || at(x, y + 1) === 6) && Dr() < 0.13 && !torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.x - wx(x)) < TILE && Math.abs(t.y + 26 - (y + 1) * TILE) < TILE)
          && !waterFeatures.some((q) => q.kind === 'waterfall' && Math.abs(q.x - wx(x)) < 2 * TILE && Math.abs(q.y - (y + 1) * TILE) < 2 * TILE))
          for (let i = dri(2, 4), x0 = wx(x) + dri(-4, 4); i > 0; i--) flora.push({ n: 'moss', x: x0 + dri(-9, 9), y: (y + 1) * TILE, f: Dr() < 0.5 ? 1 : 0, s: +(0.55 + 0.6 * Dr()).toFixed(2) }); } }
    // a cave's tunnels have a mushroom by the rock now and then, so a long way between halls is not one black stretch
    if (cave) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 1 && !inRoom(x, y) && free(x, y) && N4.some(([dx, dy]) => at(x + dx, y + dy) === 0) && R() < 0.035) {
      used.add(key(x, y)); decor.push({ x: wx(x), y: wy(y), n: R() < 0.55 ? 'shroom_a' : 'shroom_b' }); }
    // where the cave's roof drips (TASKS 305): a drop falls every p seconds from phase ph onto the floor or into the water; the
    // scene draws it and the sound plays its landing from the same schedule
    const drips = [];
    if (cave) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = at(x, y); if ((c !== 1 && c !== 6) || rooms.some((q) => q.type === 'secret' && x >= q.x - 1 && x <= q.x + q.w && y >= q.y - 1 && y <= q.y + q.h) || R() > 0.02) continue;
      drips.push({ x: Math.round((x + 0.2 + 0.6 * R()) * TILE), y: Math.round((y + 0.2 + 0.6 * R()) * TILE), p: +(2.5 + 5 * R()).toFixed(2), ph: +(9 * R()).toFixed(2), wet: wet.has(y * W + x) || c === 6 ? 1 : 0 }); }
    // each secret's cover or mechanism, once the rooms are furnished. A cover is one of many like it (banners and shelves hang
    // and stand everywhere); a mechanism is a flagstone a few steps from the wall or a sconce near it. With no place for its
    // mechanism, a secret falls back to a plain breakable wall
    const secCells = new Set(); for (const sc of secrets) { const r = rooms[sc.room]; for (const k of sc.hide) secCells.add(k); for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) secCells.add(y * W + x); }
    secrets.forEach((q, i) => { const [fx, fy] = q.front[5], sh = rooms.find((o) => o.type === 'shop'), inR = (o, x, y) => x >= o.x - 1 && x <= o.x + o.w && y >= o.y - 1 && y <= o.y + o.h;
      const torchNear = torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.x - q.x) < 2 * TILE && Math.abs(t.y - fy * TILE) < TILE);
      if (q.kind === 'banner' && torchNear) q.kind = 'shelf';
      if (q.kind === 'shelf' && (!roomy(fx, fy, 'bookshelf', q.x) || hungAt(q.x, fy, half('bookshelf')))) q.kind = torchNear ? 'crack' : 'banner';
      if (q.kind === 'banner' && (tallAt(q.x, fy, HANG.banner) || doorTop(q.x, fy, HANG.banner))) q.kind = 'crack';
      if (q.kind === 'banner') { for (let k = decor.length - 1; k >= 0; k--) if (decor[k].n === 'banner' && Math.abs(decor[k].x - q.x) < 3 * TILE && Math.abs(decor[k].y - (fy * TILE - 2)) < TILE) decor.splice(k, 1);
        decor.push({ x: q.x, y: fy * TILE - 2, n: 'banner', wall: 1, secret: i }); }
      if (q.kind === 'shelf') { claim(fx, fy, 'bookshelf', q.x); decor.push({ x: q.x, y: fy * TILE + 22, n: 'bookshelf', solid: 1, secret: i }); }
      if (q.kind !== 'lever') return;
      const near = torches.map((t, k) => [t, k]).filter(([t]) => t.kind === 'wall' && !t.side && t.lever === undefined && !secrets.some((sc) => sc.room === t.r) && !decor.some((d) => d.n === 'banner' && Math.abs(d.x - t.x) < 2 * TILE && Math.abs(d.y - t.y) < 2 * TILE) && Math.hypot(t.x - q.x, t.y - q.y) < 8 * TILE && Math.hypot(t.x - q.x, t.y - q.y) > TILE);
      const seen = new Map([[key(fx, fy), 0]]), st = secCells.has(fy * W + fx) ? [] : [[fx, fy]], plates = [];
      while (st.length) { const [x, y] = st.shift(), d0 = seen.get(key(x, y)); if (d0 >= 3 && free(x, y) && !doorway(x, y) && !inR(start, x, y) && !inR(sh, x, y)) plates.push([x, y]); if (d0 >= 8) continue;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (at(nx, ny) === 1 && !secCells.has(ny * W + nx) && !seen.has(key(nx, ny))) { seen.set(key(nx, ny), d0 + 1); st.push([nx, ny]); } } }
      if (near.length && (!plates.length || R() < 0.5)) { const [t, k] = pick(near); t.lever = i; q.trig = { k: 'sconce', t: k }; }
      else if (plates.length) { const [x, y] = pick(plates); used.add(key(x, y)); q.trig = { k: 'plate', x: wx(x), y: y * TILE + TILE / 2, cx: x, cy: y }; }
      else q.kind = 'crack'; });
    // a locked room's key lies on this side of its doors, in a chest or on an elite, or a lever on a top wall works them; with
    // none of these to be had, its doors are left unlocked
    locks.forEach((L, li) => { const lr = rooms[L.room], shut = new Set(doors.filter((d) => d.lock === li).flatMap((d) => d.cells.map(([x, y]) => y * W + x)));
      const seen = new Uint8Array(W * H), st = [start.cy * W + start.cx]; seen[st[0]] = 1;
      while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && cells[n] === 1 && !shut.has(n)) { seen[n] = 1; st.push(n); } } }
      const roomOf = (o) => rooms.find((q) => o.x >= q.x * TILE && o.x < (q.x + q.w) * TILE && o.y >= q.y * TILE && o.y < (q.y + q.h) * TILE);
      const here = (o) => { const q = roomOf(o); return !!q && q !== lr && q.type !== 'start' && q.type !== 'secret' && seen[Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE)]; };
      const elites = enemies.filter((e) => e.elite && !D.BOSSES[e.type] && here(e)), boxes = chests.filter((c) => c.tier < 3 && here(c));
      const walls = []; for (const q of rooms) { if (q === lr || q.type === 'secret' || q.type === 'shop' || q.type === 'start' || !seen[q.cy * W + q.cx]) continue;
        for (let x = q.x + 1; x < q.x + q.w - 1; x++) if (!at(x, q.y - 1) && at(x, q.y) === 1 && seen[q.y * W + x] && !doorway(x, q.y) && !tallAt(wx(x), q.y, 14) && !hungAt(wx(x), q.y, 14) && Math.hypot(x - lr.cx, q.y - lr.cy) > 8) walls.push([x, q]); }
      const roll = R(); L.kind = roll < 0.6 && (elites.length || boxes.length) ? 'key' : walls.length ? 'lever' : elites.length || boxes.length ? 'key' : '';
      if (L.kind === 'key') { if (elites.length && (!boxes.length || R() < 0.5)) pick(elites).key = li; else pick(boxes).key = li; }
      else if (L.kind === 'lever') { const [x, q] = pick(walls); L.lever = { x: wx(x), y: q.y * TILE - 24, r: q.id }; }
      else { for (const d of doors) if (d.lock === li) d.lock = -1; lr.locked = 0; } });
    // spike plates (2×2 cells) in trap rooms, laid out in one of a few patterns; a plate never touches a doorway and is
    // dropped if it would wall off any open cell, so there is always a way round
    const solid = new Set(); const sol = (x, y) => solid.add(key(Math.floor(x / TILE), Math.floor(y / TILE)));
    for (const c of chests) sol(c.x, c.y); for (const p of pots) sol(p.x, p.y); for (const t of torches) if (t.kind !== 'wall') sol(t.x, t.y);
    for (const d of decor) if (d.solid) sol(d.x, d.y); for (const s of shrines) sol(s.x, s.y); for (const [x, y] of shop.solid) sol(x, y);
    const nearDoor = (x, y) => { for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) if (doorway(x + i, y + j)) return true; return false; };
    const cutOff = () => { const seen = new Uint8Array(W * H), go = (x, y) => at(x, y) === 1 && !solid.has(key(x, y)), st = [[start.cx, start.cy + 2]]; seen[(start.cy + 2) * W + start.cx] = 1;
      while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
        if (go(nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; st.push([nx, ny]); } } }
      let cut = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (go(x, y) && !seen[y * W + x]) cut++; return cut; };
    const cut0 = cutOff();
    // a monster's post doesn't keep a plate out (the monster is moved off it below); anything else keeps its cell
    const foes = new Set(enemies.map((e) => key(Math.floor(e.x / TILE), Math.floor(e.y / TILE))));
    const ok = (x, y) => at(x, y) === 1 && !solid.has(key(x, y)) && (!used.has(key(x, y)) || foes.has(key(x, y)));
    // a bulky prop beside a plate hides its holes and reads as standing on it (TASKS 128): a free cell all round
    const bigC = new Set(chests.concat(torches.filter((t) => t.kind === 'brazier'), shrines, decor.filter((d) => (d.solid || d.n === 'table') && !d.wall)).map((p) => key(Math.floor(p.x / TILE), Math.floor(p.y / TILE))));
    const crowded = (x, y) => { for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) if (bigC.has(key(x + i, y + j))) return true; return false; };
    const plate = (r, x, y, ph) => { if (x < r.x || y < r.y + 1 || x + 1 >= r.x + r.w || y + 1 >= r.y + r.h || nearDoor(x, y) || crowded(x, y)) return false;
      if (traps.some((t) => Math.abs(t.x / TILE - (x + 1)) < 3 && Math.abs(t.y / TILE - (y + 1)) < 3)) return false;   // plates never touch: no strips
      const cs = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]; if (cs.some(([cx, cy]) => !ok(cx, cy))) return false;
      for (const [cx, cy] of cs) solid.add(key(cx, cy));
      if (cutOff() > cut0) { for (const [cx, cy] of cs) solid.delete(key(cx, cy)); return false; }
      for (const [cx, cy] of cs) used.add(key(cx, cy)); traps.push({ x: (x + 1) * TILE, y: (y + 1) * TILE, ph }); return true; };
    // a pattern slot that lands on a doorway or a prop slides a cell over rather than leaving a hole in the pattern
    const near = (r, x, y, ph) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => plate(r, x + i, y + j, ph));
    for (const r of rooms) { if (!r.trap) continue; const kind = pick(['scatter', 'checker', 'diagonal']), ph = R(), n0 = traps.length;
      // a grid with two-cell lanes between plates; neighbours alternate, so the player times the crossing
      if (kind === 'checker') { const ox = r.x + 1 + ri(0, 1), oy = r.y + 1 + ri(0, 1);
        for (let j = 0, y = oy; y + 1 < r.y + r.h - 1; y += 4, j++) for (let i = 0, x = ox; x + 1 < r.x + r.w - 1; x += 4, i++) near(r, x, y, ph + ((i + j) & 1) * 0.5); }
      // a staircase of plates across the room that fire one after another
      if (kind === 'diagonal') { const dir = R() < 0.5 ? 1 : -1, n = Math.min(4, Math.floor((r.w - 2) / 3));
        for (let k = 0; k < n; k++) near(r, dir > 0 ? r.x + 1 + k * 3 : r.x + r.w - 3 - k * 3, r.y + 1 + Math.round(k * (r.h - 4) / Math.max(1, n - 1)), ph + k * 0.12); }
      if (kind === 'scatter' || traps.length - n0 < 2) for (let i = traps.length - n0, n = ri(2, 4), k = 0; i < n && k < 40; k++) { if (plate(r, ri(r.x + 1, r.x + r.w - 3), ri(r.y + 1, r.y + r.h - 3), R())) i++; } }
    // spike plates in corridors (TASKS 76) from the 2nd floor: on a straight two-cell stretch with rock both sides, well clear of
    // every room and door. A plate fills the corridor's width, so the way past is in time with its spikes; a corridor plate is
    // the only kind that may close a way (selfCheck exempts it)
    { const inAny = (x, y, pad) => rooms.some((q) => x >= q.x - pad && x < q.x + q.w + pad && y >= q.y - pad && y < q.y + q.h + pad);
      const near = (x, y, pad) => inAny(x, y, pad) || doors.some((d) => d.cells.some(([dx, dy]) => Math.abs(dx - x) <= pad && Math.abs(dy - y) <= pad))
        || secrets.some((sc) => sc.front.some(([fx, fy]) => Math.abs(fx - x) <= 2 && Math.abs(fy - y) <= 2)) || water.includes(y * W + x);
      const cand = [];
      for (let y = 3; y < H - 3; y++) for (let x = 2; x < W - 3; x++) { const cs = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
        if (cs.some(([cx, cy]) => at(cx, cy) !== 1 || near(cx, cy, 3) || used.has(key(cx, cy)))) continue;
        // a stretch running across x (rock above and below) or down y (rock left and right), open two cells on at both ends
        const runX = [-1, 0, 1, 2].every((i) => at(x + i, y - 1) === 0 && at(x + i, y + 2) === 0) && [-1, 2].every((i) => at(x + i, y) === 1 && at(x + i, y + 1) === 1);
        const runY = [-1, 0, 1, 2].every((j) => at(x - 1, y + j) === 0 && at(x + 2, y + j) === 0) && [-1, 2].every((j) => at(x, y + j) === 1 && at(x + 1, y + j) === 1);
        if (runX || runY) cand.push([x, y]); }
      for (let n = depth < 2 ? 0 : ri(0, 2) + (depth >= 5 ? 1 : 0), k = 0; n > 0 && k < 60 && cand.length; k++) { const [x, y] = cand[Math.floor(R() * cand.length)];
        if (traps.some((t) => Math.abs(t.x / TILE - (x + 1)) < 7 && Math.abs(t.y / TILE - (y + 1)) < 7)) continue;
        for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) used.add(key(cx, cy));
        traps.push({ x: (x + 1) * TILE, y: (y + 1) * TILE, ph: R(), cor: 1 }); n--; } }
    // a monster whose post ended up on a plate steps off it to the nearest free cell of its room, or it would bleed on its post
    for (const e of enemies) { const ex = Math.floor(e.x / TILE), ey = Math.floor(e.y / TILE); if (!traps.some((t) => ex >= t.x / TILE - 1 && ex < t.x / TILE + 1 && ey >= t.y / TILE - 1 && ey < t.y / TILE + 1)) continue;
      const r = rooms[e.room]; let best = null;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (free(x, y) && !solid.has(key(x, y)) && !doorway(x, y)) { const d = Math.hypot(x - ex, y - ey); if (!best || d < best[0]) best = [d, x, y]; }
      if (best) { used.add(key(best[1], best[2])); e.x = wx(best[1]); e.y = wy(best[2]); } }
    // traps (TASKS 71). Webs on the floor of a room spiders keep: they hold whoever wades in (a spider runs over them) until a blow
    // or fire tears them. An ambush: a loose flagstone like a secret's own mechanism (the player can't tell them apart) that calls
    // monsters out of the dark round whoever steps on it, in a fighting room or a locked one
    const webs = [], ambush = [];
    const trapCell = (x, y) => traps.some((t) => x >= t.x / TILE - 1 && x < t.x / TILE + 1 && y >= t.y / TILE - 1 && y < t.y / TILE + 1);
    const floorSpot = (r) => { for (let k = 0; k < 40; k++) { const x = ri(r.x + 1, r.x + r.w - 2), y = ri(r.y + 1, r.y + r.h - 2);
      if (free(x, y) && !solid.has(key(x, y)) && !doorway(x, y) && !trapCell(x, y)) { used.add(key(x, y)); return [x, y]; } } return null; };
    for (const r of rooms) { const sp = enemies.filter((e) => e.room === r.id && e.type === 'spider').length; if (!sp) continue;
      for (let i = 0, n = sp >= 2 ? ri(2, 3) : R() < 0.5 ? 1 : 0; i < n; i++) { const p = floorSpot(r); if (p) webs.push({ x: wx(p[0]), y: p[1] * TILE + TILE / 2, v: ri(0, 1), s: 0.9 + 0.3 * R(), f: R() < 0.5 ? 1 : 0, torn: 0 }); } }
    { const pool = rooms.filter((r) => r.type === 'combat' || r.type === 'exit' || r.locked); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      pool.sort((a, b) => (b.locked || 0) - (a.locked || 0));
      for (const r of pool.slice(0, depth === 1 ? (R() < 0.3 ? 1 : 0) : webless ? ri(2, 3) : ri(1, 2))) { const p = floorSpot(r); if (p) ambush.push({ x: wx(p[0]), y: p[1] * TILE + TILE / 2, cx: p[0], cy: p[1], room: r.id, n: 2 + Math.floor(depth / 3) + (r.locked ? 1 : 0) }); } }
    // start room: a sanctuary bonfire in the centre
    const sanct = { x: start.cx * TILE + TILE / 2, y: start.cy * TILE + TILE / 2 + 8 };
    torches.push({ x: sanct.x, y: sanct.y, kind: 'fire' });
    // the hero arrives below and beside the fire, not under it: straight below, its bowl sat on his head in the first frame of a floor
    const spawnOk = (dx, dy) => { const x = (start.cx + 0.5 + dx) * TILE, y = (start.cy + 0.5 + dy) * TILE;
      return [[x - 10, y], [x + 10, y], [x, y - 8]].every(([px, py]) => at(Math.floor(px / TILE), Math.floor(py / TILE)) === 1 && !solid.has(key(Math.floor(px / TILE), Math.floor(py / TILE)))) ? { x, y } : null; };
    const spawn = [[1, 3], [-1, 3], [2, 2], [-2, 2], [1, 2], [-1, 2], [0, 2], [0, 1]].reduce((a, [dx, dy]) => a || spawnOk(dx, dy), null)
      || { x: start.cx * TILE + TILE / 2, y: (start.cy + 1) * TILE + TILE / 2 };
    // flat floor decals (baked into the floor map): wear everywhere, a biome flavour per room, gore and coins where fights happen
    const DEC = { dungeon: ['dc_crack', 'dc_grime', 'dc_rubble', 'dc_slab', 'dc_straw', 'dc_shards', 'dc_leaves'], crypt: ['dc_moss', 'dc_bones', 'dc_crack', 'dc_grime', 'dc_puddle'],
      lava: ['dc_soot', 'dc_rubble', 'dc_crack', 'dc_slab', 'dc_soot'], arcane: ['dc_puddle', 'dc_crack', 'dc_grime', 'dc_slab'], cave: ['dc_moss', 'dc_pebbles', 'dc_rubble', 'dc_moss', 'dc_silt', 'dc_pebbles', 'dc_crack'] };
    // a decal is drawn up to 40·s px across (scene.js bake, over the walls already painted): it shrinks until that square lies on
    // open floor, so no stone, rubbish or stain climbs a wall or spills onto the rock; one that would have to shrink past half is left out
    const decals = [], onFloor = (px, py, h) => { for (let y = Math.floor((py - h) / TILE); y <= Math.floor((py + h - 0.01) / TILE); y++) for (let x = Math.floor((px - h) / TILE); x <= Math.floor((px + h - 0.01) / TILE); x++) if (at(x, y) !== 1) return false; return true; };
    const fitDecal = (d) => { for (let s = d.s; s >= 0.5; s -= 0.05) if (onFloor(d.x, d.y, 20 * s)) { d.s = s; decals.push(d); return; } };
    for (const r of rooms) { const zb = r.zone || biome, n = Math.round(r.w * r.h / 6);
      for (let i = 0; i < n; i++) { const x = r.x + R() * r.w, y = r.y + 0.5 + R() * (r.h - 0.5); if (at(Math.floor(x), Math.floor(y)) !== 1) continue;
        const fight = r.type === 'combat' || r.type === 'exit' || r.type === 'boss';
        const pool = (fight || r.type === 'treasure' || r.type === 'secret') && R() < 0.35 ? ['dc_blood', 'dc_blood2', 'dc_coins', 'dc_bones', 'dc_sword'] : DEC[zb];
        if (wet.has(Math.floor(y) * W + Math.floor(x))) continue; fitDecal({ x: x * TILE, y: y * TILE, n: pool[Math.floor(R() * pool.length)], f: R() < 0.5 ? 1 : 0, s: 0.8 + 0.5 * R() }); } }
    // the water leaves its silt, pebbles and puddles on the cave's banks (TASKS 306)
    if (cave) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 1 && !wet.has(y * W + x) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => wet.has((y + dy) * W + x + dx)) && R() < 0.3)
      fitDecal({ x: (x + 0.2 + 0.6 * R()) * TILE, y: (y + 0.2 + 0.6 * R()) * TILE, n: ['dc_silt', 'dc_pebbles', 'dc_silt', 'dc_puddle'][Math.floor(R() * 4)], f: R() < 0.5 ? 1 : 0, s: 0.7 + 0.4 * R() });
    // cobwebs: the sprite is spun across a top-left corner, so a web only ever hangs in a room's top corner where the back wall
    // meets a side wall (mirrored for the right one), more of them in the crypt and the halls than in the fire depths
    const WEB = { crypt: 0.6, arcane: 0.6, dungeon: 0.35, cave: 0.35, lava: 0.15 };
    for (const r of rooms) { const p = WEB[r.zone || biome] || 0.3;
      for (const [x, s, f] of [[r.x, -1, 0], [r.x + r.w - 1, 1, 1]]) { if (at(x, r.y) !== 1 || at(x + s, r.y) !== 0 || at(x, r.y - 1) !== 0 || R() > p) continue;
        const k = 0.95 + 0.35 * R(), w = 40 * k; decals.push({ x: f ? (x + 1) * TILE - w / 2 : x * TILE + w / 2, y: r.y * TILE + w / 2, n: 'dc_web', f, s: k }); } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 1 && !rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) && R() < 0.06)
      fitDecal({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, n: DEC[biome][Math.floor(R() * DEC[biome].length)], f: R() < 0.5 ? 1 : 0, s: 0.7 + 0.3 * R() });
    for (const r of rooms) if (r.type !== 'shop' && !lightRoom(r, [])) return null;
    const secAt = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      return secrets.findIndex((sc) => { const r = rooms[sc.room]; return (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) || sc.hide.includes(ty * W + tx); }); };
    for (const list of [chests, pots, torches, decor, decals]) for (const o of list) { const i = secAt(o.x, o.y + (o.wall ? TILE : 0)); if (i >= 0) o.sec = i; }
    for (const t of torches) { const i = secrets.findIndex((sc) => sc.room === t.r); if (i >= 0) t.sec = i; }
    // cells taken by solid props: the flow fields route around them
    const block = []; const bl = (x, y) => block.push(Math.floor(y / TILE) * W + Math.floor(x / TILE));
    for (const c of chests) bl(c.x, c.y); for (const t of torches) if (t.kind !== 'wall') bl(t.x, t.y); for (const d of decor) if (d.solid) bl(d.x, d.y); for (const s of shrines) bl(s.x, s.y); for (const [x, y] of shop.solid) bl(x, y);
    // a fountain's basin stands on the floor, three cells wide; a stream's culvert is in the wall (TASKS 230)
    for (const q of waterFeatures) if (q.kind === 'fountain') for (const dx of [-TILE, 0, TILE]) bl(q.x + dx, q.y);
    return { seed, floor, biome, W, H, cells, rooms, block, decals, edges: edges.map((e) => [e[0], e[1]]), start: start.id, exitRoom: exitR.id, exit, spawn, sanct,
      bossType, enemies, chests, pots, traps, torches, decor, shrines, rugs, shop, secrets, secretsWanted, lava: lava.length, lavaFlow: flow, streams, water, waterFlow, waterFeatures, waterBridges, deep: cells.filter((c) => c === 6).length, crossings, doors, locks, webs, ambush, drips, flora };
  }

  // room index of a world point (or -1 in a corridor)
  const roomAt = (map, x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (const r of map.rooms) if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r.id; return -1; };

  root.DUNGEON = { genFloor, roomAt, mul32, LIGHT_R, straightRuns };
  if (typeof module !== 'undefined') module.exports = root.DUNGEON;
})(typeof window !== 'undefined' ? window : globalThis);
