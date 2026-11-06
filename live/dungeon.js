// live/dungeon.js — procedural floor generator: genFloor(seed, floor, { mode }) → plain JSON map data. Pure function of its inputs.
// Rooms placed at random without overlap → MST + extra loop edges → 2-wide L corridors → start room at a leaf,
// exit room farthest by graph distance (floor 8: the boss lair) → room roles → contents (enemies, chests, pots, traps,
// lava, torches, decor) → validation (everything reachable from the start, spawns on open floor).
(function (root) {
  const D = root.DATA || require('./data.js');
  const { TILE, ENEMIES } = D;
  // how far each light source reaches, in tiles (matches the glow radii of the scene's light map)
  const LIGHT_R = { wall: 6.5, brazier: 6.5, fire: 8.5, candles: 3, candlestick: 3.5, candelabra: 4.5, torch_stand: 6.5, crystal: 6.5, shrine: 6, lava: 3.5, shroom: 5, shroom_a: 5, shroom_b: 5, crystal_cv: 6.5, vent_mg: 5, obsidian_mg: 6.5 };
  // cells: 0 rock, 1 floor, 3 lava (blocks walking, not projectiles), 4 a secret room's fake wall (solid until broken), 5 a shut door
  // (set by the sim), 6 deep water (blocks walking and knockback, not projectiles or sight)
  const mul32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // a room's shape (TASKS 374): its box (x, y, w, h) is its core, where everything set against a wall or in rows stands, and
  // `wings`, boxes of floor joined to it (a cross's arms, an L's foot, a round hall's caps), are its floor as well
  const inRm = (r, x, y, p = 0) => (x >= r.x - p && x < r.x + r.w + p && y >= r.y - p && y < r.y + r.h + p) || (!!r.wings && r.wings.some(([a, b, c, d]) => x >= a - p && x < a + c + p && y >= b - p && y < b + d + p));
  const rectsOf = (r) => [[r.x, r.y, r.w, r.h], ...(r.wings || [])];

  function genFloor(seed, floor, opts = {}) {
    // a floor without a secret room is rerolled a few times before one is accepted, unless it meant to have none
    for (let attempt = 0; attempt < 20; attempt++) { const m = tryGen((seed + attempt * 7919) >>> 0, floor, opts, attempt < 16, attempt < 16); if (m && (m.secrets.length || !m.secretsWanted || attempt >= 12)) return m; }
    // (a floor no try above lays, which a magma floor's walk to the stairs left 1 seed in 300: a crash on entering it, never a
    // floor; reached only past them, so every floor they lay stays as it is)
    for (let attempt = 20; attempt < 40; attempt++) { const m = tryGen((seed + attempt * 7919) >>> 0, floor, opts, false, false); if (m) return m; }
    throw new Error('dungeon generation failed');
  }

  // the rooms a walk from cell a to cell b crosses (TASKS 433): those whose box holds three cells on a walk at most two steps longer
  // than the shortest (a secret room is no way's); go: the cells a body walks
  function wayRooms(cells, W, H, rooms, a, b, go = (c) => c === 1) {
    const from = (k0) => { const d = new Int32Array(W * H).fill(-1), q = [k0]; d[k0] = 0;
      for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && go(cells[n])) { d[n] = d[q[i]] + 1; q.push(n); } } return d; };
    const da = from(a), db = from(b), L = da[b], out = new Set();
    for (const r of rooms) { if (r.type === 'secret') continue; let n = 0;
      for (let y = r.y; y < r.y + r.h && n < 3; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * W + x; if (da[k] >= 0 && db[k] >= 0 && da[k] + db[k] <= L + 2 && ++n >= 3) break; }
      if (n >= 3) out.add(r.id); }
    return out; }

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

  // a smooth value noise of `grain` cells from its own random stream, 0..1
  const noise2 = (rng, grain) => { const z0 = rng() * 1e4, hsh = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + z0) * 43758.5453; return s - Math.floor(s); };
    return (x, y) => { const gx = x / grain, gy = y / grain, i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, s = (a) => a * a * (3 - 2 * a);
      return (hsh(i, j) * (1 - s(u)) + hsh(i + 1, j) * s(u)) * (1 - s(v)) + (hsh(i, j + 1) * (1 - s(u)) + hsh(i + 1, j + 1) * s(u)) * s(v); }; };
  // the floor cells a body two cells wide covers walking from the 2×2 of floor (cell 1) over cell `from`, stepping straight or
  // diagonally (a staircase two cells wide in every row and column passes): which of the cells `to` it never reaches (a plateaus'
  // ridge never narrows to one cell, TASKS 400)
  function narrowTo(cells, W, H, from, to) {
    const fat = (k) => k % W < W - 1 && cells[k] === 1 && cells[k + 1] === 1 && cells[k + W] === 1 && cells[k + W + 1] === 1, seen = new Uint8Array(W * H), cov = new Uint8Array(W * H), q = [];
    for (const k of [from, from - 1, from - W, from - W - 1]) if (k >= 0 && fat(k)) { seen[k] = 1; q.push(k); }
    for (let i = 0; i < q.length; i++) { const k = q[i]; cov[k] = cov[k + 1] = cov[k + W] = cov[k + W + 1] = 1;
      for (const d of [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) { const n = k + d; if (n >= 0 && n < W * (H - 1) && Math.abs((n % W) - (k % W)) <= 1 && !seen[n] && fat(n)) { seen[n] = 1; q.push(n); } } }
    return to.filter((k) => !cov[k]);
  }

  // where a body no one walks (a cave's deep water, TASKS 302; the magma caves' lava, 401) cuts the floor, a crossing two cells wide
  // is laid along the shortest line over it from the floor reached from `from` to the nearest floor cut off, until nothing is: its
  // kind by the cells it spans (kindOf), demoted to `low` when a bridge's line bends or can't land both its rows; a `short` one is
  // laid as found, the rest run straight on to where both rows meet the shore. take(k, kind) makes each cell walkable; false when
  // something stays cut off
  function crossCuts(W, H, cells, from, walk, over, take, kindOf, low, short, out) {
    const D4 = [1, -1, W, -W];
    for (let pass = 0; pass < 16; pass++) {
      const seen = new Uint8Array(W * H), st = [from]; seen[from] = 1;
      while (st.length) { const k = st.pop(); for (const d of D4) { const n = k + d; if (!seen[n] && walk(n)) { seen[n] = 1; st.push(n); } } }
      let lost = false; for (let k = 0; k < W * H && !lost; k++) if (walk(k) && !seen[k]) lost = true;
      if (!lost) return true;
      if (pass === 15) return false;
      const prev = new Int32Array(W * H).fill(-2), q = []; for (let k = 0; k < W * H; k++) if (seen[k]) { prev[k] = -1; q.push(k); }
      let end = -1;
      for (let i = 0; i < q.length && end < 0; i++) for (const d of D4) { const n = q[i] + d; if (prev[n] !== -2) continue;
        if (walk(n)) { prev[n] = q[i]; end = n; break; } if (over(n)) { prev[n] = q[i]; q.push(n); } }
      if (end < 0) return false;
      const path = []; for (let k = prev[end]; k >= 0 && over(k); k = prev[k]) path.push(k);
      const a = path[path.length - 1], b = path[0], hor = Math.abs(a % W - b % W) >= Math.abs(Math.floor(a / W) - Math.floor(b / W)), s = hor ? W : 1;
      // two cells wide: the second row on the side where the body goes on
      const side = path.filter((k) => over(k + s)).length >= path.filter((k) => over(k - s)).length ? s : -s;
      let cs = path.concat(path.filter((k) => over(k + side)).map((k) => k + side));
      let kind = kindOf(path.length);
      // a bridge runs straight (TASKS 306): a way over that bends is crossed low instead
      const straight = new Set(path.map((k) => (hor ? Math.floor(k / W) : k % W))).size === 1;
      if (kind === 'bridge' && !straight) kind = low;
      // a straight crossing reaches the shore with both its rows (TASKS 306): the second row goes on the side whose ends meet the
      // shore soonest, and the body still under either row past the way's ends goes under the crossing too; a deck that stopped with
      // one row over the body read as broken off in its middle
      let clean = false;
      if (kind !== short && straight) { const step = hor ? 1 : W, lo = path.reduce((a, k) => Math.min(a, k)), hi = path.reduce((a, k) => Math.max(a, k));
        const reach = (sd, from, dir) => { for (let e = 0; e <= 4; e++) { const k = from + dir * step * e; if (!cells[k] || !cells[k + sd]) return -1; if (!over(k) && !over(k + sd)) return e; } return -1; };
        let best = null;
        for (const sd of [side, -side]) { if (path.some((k) => !cells[k + sd])) continue; const a = reach(sd, lo - step, -1), b = reach(sd, hi + step, 1);
          if (a >= 0 && b >= 0 && (!best || a + b < best[1] + best[2])) best = [sd, a, b]; }
        if (best) { const [sd, a, b] = best; cs = []; clean = true;
          for (let k = lo - a * step; k <= hi + b * step; k += step) for (const c of [k, k + sd]) if (over(c)) cs.push(c); } }
      if (kind === 'bridge' && !clean) kind = low;
      for (const k of cs) take(k, kind);
      out.push({ kind, cells: cs, axis: hor ? 'x' : 'y', clean: clean ? 1 : 0 }); }
    return false;
  }
  function tryGen(seed, runFloor, opts, strict, mixed) {
    const R = mul32(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = (arr) => arr[Math.floor(R() * arr.length)];
    // depth: the campaign floor this one is worth in monsters, elites, traps and ambushes; runFloor: its place in the run; floor: its
    // place among the floors its description lays out (data.js stageOf: the campaign's 9th is the caves' 1st); last: its chapter's
    // end, fin: the run's last floor (past any other boss an altar and the stairs wait)
    // (opts.stage: a staged view's own size and room count over its stage's, the QA match, TASKS 373)
    const ST = Object.assign({}, D.stageOf(opts.mode, runFloor, opts.runSeed), opts.stage), N = ST.N, floor = ST.lf, depth = ST.depth, last = ST.last, fin = ST.fin;
    const biome = ST.biome, bossType = ST.boss, boss = !!bossType;
    // the cave archetype (R-18, TASKS 301): the same rooms and links, but a room is a blob of floor inside its box round a core
    // where the start's fire or the stairs stand, a link is a winding tunnel 2–4 cells wide, and small dead-end pockets hang off
    // the rooms for a chest or an ambush; the map grows floor by floor and has no straight stretch of wall longer than four cells
    // the plateau archetype (TASKS 400, data.js ARCH) is laid out by the cave's code from its roles on: it differs in the blobs'
    // spacing, its links (long narrow ridges with dead-end ledges) and what lies off the floor (lava, the chasm, a wall at the top only)
    const arch = ST.arch || N.arch, AR = D.ARCH[arch], plat = arch === 'plateau', cave = arch === 'cave' || plat;
    const [W, H] = ST.size || (cave ? N.size[floor - 1] : [72, 54]), cells = new Array(W * H).fill(0), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : cells[y * W + x]);
    // (moat: a fortress's rock between its ring and its court, TASKS 380, no corridor is dug through once the gates are)
    let moat = null;
    const set = (x, y, v) => { if (x > 1 && y > 2 && x < W - 2 && y < H - 2 && !(moat && v === 1 && moat(x, y))) cells[y * W + x] = v; };
    // ---- rooms ----
    // a cave's rooms stand six cells apart and more: the rock between them holds its water and its long tunnels
    // a small map (the endless descent's first floors, TASKS 349) takes smaller rooms, or eight of them never fit
    const small = !cave && W < 64;
    // a rooms floor's layout (TASKS 379, data.js ARCH: rooms, maze, hall, catacomb): its knobs on the rooms, links and contents below
    const LY = cave ? null : D.ARCH[ST.lay || 'rooms'];
    const rooms = [];
    // (a plateau boss's arena keeps AR.arenaGap round it, TASKS 422: its rim stays dark rock, never a channel the hero wades over)
    const apart = (x, y, w, h, g0 = pl ? TY.gap : cave ? [6, 6] : LY.gap) => !rooms.some((r) => { const g = pl && boss && r.id === 0 ? [Math.max(g0[0], AR.arenaGap), Math.max(g0[1], AR.arenaGap)] : g0;
      const G = r.court ? LY.court.moat + LY.court.ring + 2 : 0;
      return (G ? [[r.x - G, r.y - G, r.w + 2 * G, r.h + 2 * G]] : rectsOf(r)).some(([rx, ry, rw, rh]) => x < rx + rw + g[0] && x + w + g[0] > rx && y < ry + rh + g[1] && y + h + g[1] > ry); });
    // a room's shape (TASKS 374, data.js ROOM_SHAPES): its outer box, its core (a box inside it, x0 y0 w h from its corner) and the
    // mask of its floor; the floor past the core is laid as the room's wings, a box per row's run, runs alike stacked into one
    const shapeRoom = () => { const S = LY.shapes ? Object.fromEntries(Object.entries(LY.shapes).map(([k, p]) => [k, { p }])) : D.ROOM_SHAPES, ks = Object.keys(S).filter((k) => (!S[k].from || W >= S[k].from) && (k !== 'closet' || rooms.filter((r) => r.shape === 'closet').length < (LY.shapes ? 4 : 2))); let t = R() * ks.reduce((a, k) => a + S[k].p, 0), k = ks[0];
      for (const q of ks) { t -= S[q].p; if (t < 0) { k = q; break; } }
      const box = (w, h, kk = k) => ({ k: kk, w, h, core: [0, 0, w, h], mask: () => true });
      if (LY.big && rooms.length < LY.big[0]) return box(ri(...LY.big[1]), ri(...LY.big[2]), 'rect');
      if (k === 'rect') return LY.rect ? box(ri(...LY.rect[0]), ri(...LY.rect[1])) : box(small ? ri(6, 11) : ri(7, 14), small ? ri(5, 8) : ri(6, 10));
      if (k === 'closet') return box(ri(4, 5), ri(4, 5));
      if (k === 'gallery') return R() < 0.5 ? box(ri(14, small ? 16 : 20), ri(4, 5)) : box(ri(4, 5), ri(11, small ? 13 : 15));
      if (k === 'hall') return box(ri(16, 20), ri(12, 16));
      if (k === 'colonnade') return box(small ? ri(11, 13) : ri(12, 16), small ? ri(7, 8) : ri(8, 10));
      if (k === 'pit') return box(ri(10, 14), ri(8, 11));
      if (k === 'L') { const w = ri(10, 14), h = ri(9, 13);
        if (R() < 0.5) { const d = Math.min(ri(3, 5), h - 5), ww = ri(Math.ceil(w * 0.35), Math.floor(w * 0.55)), left = R() < 0.5;
          return { k, w, h, core: [0, 0, w, h - d], mask: (i, j) => j < h - d || (left ? i < ww : i >= w - ww) }; }
        const d = Math.min(ri(3, 5), w - 6), hh = ri(Math.ceil(h * 0.4), Math.floor(h * 0.6)), top = R() < 0.5, right = R() < 0.5;
        return { k, w, h, core: [right ? 0 : d, 0, w - d, h], mask: (i, j) => (right ? i < w - d : i >= d) || (top ? j < hh : j >= h - hh) }; }
      if (k === 'T' || k === 'cross') { const w = ri(11, 15), h = k === 'T' ? ri(9, 12) : ri(10, 13), hb = ri(5, 6), ws = ri(4, 6), sx = (w - ws) >> 1, up = k === 'T' && R() < 0.4;
        const by = k === 'cross' ? (h - hb) >> 1 : up ? h - hb : 0;
        return { k, w, h, core: [0, by, w, hb], mask: (i, j) => (j >= by && j < by + hb) || (i >= sx && i < sx + ws) }; }
      const w = ri(10, 14), h = w - ri(0, 2), a = Math.round(w / 2 * 0.72), b = Math.round(h / 2 * 0.72);
      return { k, w, h, core: [(w >> 1) - a, (h >> 1) - b, 2 * a, 2 * b], mask: (i, j) => ((i + 0.5 - w / 2) / (w / 2)) ** 2 + ((j + 0.5 - h / 2) / (h / 2)) ** 2 < 1.04 }; };
    const shaped = (x, y, sh) => { const [cx0, cy0, cw, ch] = sh.core, wings = [], prev = new Map();
      for (let j = 0; j < sh.h; j++) { const runs = []; for (let i = 0; i < sh.w; i++) { if (!sh.mask(i, j) || (i >= cx0 && i < cx0 + cw && j >= cy0 && j < cy0 + ch)) continue;
          if (runs.length && runs[runs.length - 1][0] + runs[runs.length - 1][1] === i) runs[runs.length - 1][1]++; else runs.push([i, 1]); }
        const next = new Map(); for (const [i, n] of runs) { const o = prev.get(i + ':' + n); if (o) { o[3]++; next.set(i + ':' + n, o); } else { const q = [x + i, y + j, n, 1]; wings.push(q); next.set(i + ':' + n, q); } }
        prev.clear(); for (const [kk, v] of next) prev.set(kk, v); }
      return { x: x + cx0, y: y + cy0, w: cw, h: ch, cx: x + cx0 + (cw >> 1), cy: y + cy0 + (ch >> 1), shape: sh.k, ...(wings.length ? { wings } : {}) }; };
    // the floor's type (TASKS 426), by the run's seed so a retry keeps it: never the last floor's (its own pick, so the
    // whole run's chain is the same however it is reached), the plain plateaus on a boss's floor, AR.first on the run's first
    // (a check may ask for a type: opts.ftype)
    let ftype2 = null;
    const ftype = !plat ? null : opts.ftype && !boss ? (ftype2 = opts.ftype2 || null, opts.ftype) : (() => { const T = AR.types, rs = (opts.runSeed ?? seed) >>> 0; let prev = null, t = 'plain', pm = false;
      for (let f = 1; f <= floor; f++) { const Q = mul32((rs ^ 0x426f) + f * 7907); Q(); const c = T.filter((x) => x !== prev); t = f === 1 && AR.first ? AR.first : c[Math.floor(Q() * c.length)]; prev = t;
        const m = AR.blend.over.includes(t) && !pm && mul32((rs ^ 0x4260) + f * 6007)() < AR.blend.p; pm = m; ftype2 = m ? AR.blend.with : null; }
      return boss ? (ftype2 = null, 'plain') : t; })();
    // the mix of two floor types (TASKS 426): a figure floor (the lake, the river, the terraces) over the chasm: the plateaus stand
    // apart over the dark with bridges between, and the figure alone keeps the lava; its sizes and walk over the chasm's, the floor's share of lava its own
    const MIX = plat && ftype2 ? AR[ftype2] : null;
    // a lake floor's lake (TASKS 427): the floor's figure, a ragged blob in the middle of the map no plateau stands on or grows into,
    // with a chain of islands across it along its longer axis, zigzagging: one big (the hoard's), then the smaller sizes in turn, in
    // a random order along the chain; the lava pours into its rock once the floor is laid (platLava). The plateaus on its shore are
    // smaller than the plain floor's and ring it
    // a floor type's own sizes and spacing over the plain floor's (data.js ARCH.plateau[type])
    const TY = Object.assign({}, AR, MIX ? Object.assign({}, MIX, { lakes: 0, gap: AR.blend.gap }) : {}, plat && ftype && AR[ftype] ? AR[ftype] : {}), shareOf = !plat ? null : MIX ? [Math.min(MIX.share[0], AR[ftype].share[0]), Math.max(MIX.share[1], AR[ftype].share[1])] : (AR[ftype] && AR[ftype].share) || AR.lava.share;
    // a cave floor of the magma caves (TASKS 431) is laid out as the water caves' are, halls in the rock and winding tunnels, its
    // water lava; pl: the plateaus' layout (everything else of the magma caves holds for both)
    const lc = plat && ftype === 'cave', pl = plat && !lc;
    const want = pl ? Math.round(W * H / AR.cells) : cave ? Math.round(W * H / 420) : Math.max(LY.min || 0, Math.round((Array.isArray(ST.rooms) ? ri(...ST.rooms) : ST.rooms || 13 + Math.min(4, depth >> 1)) * LY.room));
    const fig = ftype === 'lake' || ftype === 'river' || ftype === 'terrace' ? new Uint8Array(W * H) : null, figAt = [];
    if (ftype === 'lake') { const L = AR.lake, F = mul32(seed ^ 0x427a), fr = (a) => a[0] + F() * (a[1] - a[0]), cx = W * fr(L.at[0]), cy = H * fr(L.at[1]), rx = W * fr(L.fig[0]), ry = H * fr(L.fig[1]), nzF = noise2(F, 6);
      for (let y = 6; y < H - 4; y++) for (let x = 4; x < W - 4; x++) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (Math.hypot(u, v) < 1 + 0.35 * (nzF(x, y) - 0.5)) fig[y * W + x] = 1; }
      figAt.push(cx, cy, rx, ry);
      const n = L.isles[0] + Math.floor(F() * (L.isles[1] - L.isles[0] + 1)), hor = rx >= ry * 1.2, inFig = (x, y, w, h) => { for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) if (!fig[(y + j) * W + x + i]) return false; return true; };
      // (the big one takes a middle slot, where the lake is widest, and is laid first; the others' sizes alternate in a random order)
      const mid = (n - 1 + Math.floor(F() * 2)) >> 1, kinds = Array.from({ length: n }, (_, i) => (i === mid ? 0 : 1 + ((i + Math.floor(F() * 2)) % 2))), zig = F() < 0.5 ? -1 : 1;
      const order = [mid, ...Array.from({ length: n }, (_, i) => i).filter((i) => i !== mid)];
      for (let o = 0, tries = 0; o < n && tries < 400; tries++) { const i = order[o], sz = L.isle[kinds[i]], t = -0.74 + 1.48 * (i + 0.5) / n + (F() - 0.5) * 0.08, s = zig * (i % 2 ? 1 : -1) * (i === mid ? 0.1 * F() : 0.12 + 0.2 * F()), w = sz[0][0] + Math.floor(F() * (sz[0][1] - sz[0][0] + 1)), h = sz[1][0] + Math.floor(F() * (sz[1][1] - sz[1][0] + 1));
        const px = cx + (hor ? t * rx : s * rx), py = cy + (hor ? s * ry : t * ry), x = Math.round(px - w / 2), y = Math.round(py - h / 2);
        if (x < 4 || y < 6 || x + w > W - 4 || y + h > H - 4 || !inFig(x, y, w, h) || rooms.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) { if (tries % 80 === 79) o++; continue; }
        rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, isle: kinds[i] ? 1 : 2 }); o++; } }
    // a river floor's river (TASKS 428): a band of lava across the map from edge to edge, winding, a cell or so wider or narrower
    // as it goes, and wide round an island in its middle reach; the plateaus stand on its two banks
    const riverY = [], riverB = [];
    if (ftype === 'river') { const L = AR.river, F = mul32(seed ^ 0x428a), fr = (a) => a[0] + F() * (a[1] - a[0]), y0 = H * fr(L.at), amp = H * fr(L.amp), wv = fr(L.waves), ph = F() * 6.283, wd = fr(L.w), nzF = noise2(F, 9);
      const iw = L.isle[0][0] + Math.floor(F() * (L.isle[0][1] - L.isle[0][0] + 1)), ih = L.isle[1][0] + Math.floor(F() * (L.isle[1][1] - L.isle[1][0] + 1)), ix = Math.round(W * fr(L.isleAt));
      for (let x = 0; x < W; x++) { const yc = y0 + amp * Math.sin(6.283 * wv * x / W + ph), bump = Math.max(0, 1 - Math.abs(x + 0.5 - ix) / (iw / 2 + 5)), half = (wd + 2 * (nzF(x, 0) - 0.5)) / 2 + bump * bump * (3 - 2 * bump) * (ih / 2 + 2.5);
        riverY.push(yc); riverB.push([yc - half, yc + half]); for (let y = Math.max(6, Math.floor(yc - half)); y <= Math.min(H - 5, Math.ceil(yc + half)); y++) if (Math.abs(y + 0.5 - yc) < half) fig[y * W + x] = 1; }
      const x = ix - (iw >> 1), y = Math.round(riverY[ix] - ih / 2); figAt.push(ix, riverY[ix], W / 2, wd / 2);
      rooms.push({ x, y, w: iw, h: ih, cx: x + (iw >> 1), cy: y + (ih >> 1), type: 'combat', id: rooms.length, isle: 2 }); }
    // a terrace floor (TASKS 430): the lavafall's river down one side, and the terraces laid row by row on the other, from the top
    // (under the caches' stretches of wall) down; their joins are set with the floor's tree (below)
    const terr = ftype === 'terrace' ? { rows: [], branch: [], fx: 0, fw: 0 } : null;
    if (terr) { const L = AR.terrace, F = mul32(seed ^ 0x430a), fr = (a) => a[0] + F() * (a[1] - a[0]), fi = (a) => a[0] + Math.floor(F() * (a[1] - a[0] + 1)), left = F() < 0.5;
      const fx = Math.round(left ? W * fr(L.fallAt) : W * (1 - fr(L.fallAt))), wd = fi(L.w), ph = F() * 6.283; terr.fx = fx; terr.fw = wd; terr.left = left;
      for (let y = 3; y < H - 3; y++) { const xc = fx + 1.5 * Math.sin(y / 9 + ph) * Math.min(1, (y - 3) / 8); for (let x = Math.floor(xc - wd / 2); x < xc + wd / 2; x++) if (x > 1 && x < W - 2) fig[y * W + x] = 1; }
      figAt.push(fx, H / 2, wd / 2, H / 2);
      const x0 = left ? fx + Math.ceil(wd / 2) + 2 + L.margin + 1 : 3, x1 = left ? W - 3 : fx - Math.ceil(wd / 2) - 2 - L.margin - 1;
      // (each row comes up to the river by the fall; its end away from it stops short by a share `short` of the width, so the rows
      // stagger like switchbacks, not a stack of bars)
      for (let y = 3 + AR.cacheRows + AR.gap[1]; ; ) { const rk = mixed ? F() : 0.5, RK = rk < L.ridgeRow.p && terr.rows.length && y + L.ridgeRow.h[1] + L.step[1] + Math.max(L.rowH[1], L.broadRow.h[1]) <= H - 6 ? 'ridge' : rk > 1 - L.broadRow.p && !terr.broad ? (terr.broad = 'arena') : null, RL = RK === 'ridge' ? L.ridgeRow : RK ? L.broadRow : null;
        const h = fi(RL ? RL.h : L.rowH); if (y + h > H - 6) break; const k = fi(RL ? RL.per : L.per), gap = 3, cutW = Math.round((x1 - x0) * fr(L.short));
        const ra = left ? x0 : x0 + cutW, rb = left ? x1 - cutW : x1, span = rb - ra - gap * (k - 1);
        const cut = Array.from({ length: k }, () => 0.7 + 0.6 * F()), tot = cut.reduce((a, b) => a + b, 0), row = []; let x = ra;
        for (let i = 0; i < k; i++) { const w = i === k - 1 ? rb - x : Math.round(span * cut[i] / tot), dy = fi([-1, 1]), hh = h - (F() < 0.4 && RK !== 'ridge' ? 1 : 0);
          rooms.push(Object.assign({ x, y: y + dy, w, h: hh, cx: x + (w >> 1), cy: y + dy + (hh >> 1), type: 'combat', id: rooms.length, row: terr.rows.length }, RK ? { kind: RK } : {})); row.push(rooms.length - 1); x += w + gap; }
        terr.rows.push(row); y += h + fi(L.step); }
      const nb = fi(L.branch), bx0 = left ? 3 : fx + Math.ceil(wd / 2) + 2 + L.margin + 1, bx1 = left ? fx - Math.ceil(wd / 2) - 2 - L.margin - 1 : W - 3;
      for (let i = 0, tries = 0; i < nb && tries < 60 && bx1 - bx0 >= 7; tries++) { const w = Math.min(bx1 - bx0, fi([7, 10])), h = fi([6, 8]), x = bx0 + Math.floor(F() * (bx1 - bx0 - w + 1)), y = 12 + Math.floor(F() * (H - 16 - h));
        if (rooms.some((r) => x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h + 4 && y + h + 4 > r.y)) continue; rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, branch: 1 }); terr.branch.push(rooms.length - 1); i++; } }
    // the secret caches are dug up into the top wall (TASKS 425): a block of rock standing alone in the lava was the only dark on a
    // floor this full and gave them away. A few stretches of the wall's foot are held clear of the plateaus (AR.caches: how many,
    // AR.cacheSize wide, AR.cacheRows deep from row 3), so the wall stands deep enough there for a cache behind it
    const holds = [];
    if (pl) { const Q = mul32(seed ^ 0x422c), n = AR.caches[0] + Math.floor(Q() * (AR.caches[1] - AR.caches[0] + 1)), c = AR.cacheSize;
      for (let i = 0; i < 300 && holds.length < n; i++) { const x = 4 + Math.floor(Q() * (W - c - 8)); if (!holds.some((q) => x < q.x + q.w + 6 && x + c + 6 > q.x)) holds.push({ x, y: 3, w: c, h: AR.cacheRows }); } }
    const holdHit = (x, y, w, h) => holds.some((q) => x < q.x + q.w + AR.gap[0] && x + w + AR.gap[0] > q.x && y < q.y + q.h + AR.gap[1] && y + h + AR.gap[1] > q.y);
    const figHit = (x, y, w, h) => { if (!fig) return false; const m = TY.margin; for (let j = y - m; j < y + h + m; j++) for (let i = x - m; i < x + w + m; i++) if (i >= 0 && j >= 0 && i < W && j < H && fig[j * W + i]) return true; return false; };
    // the plateaus' kinds (TASKS 432, ARCH.plateau.mix): the arenas and ridges are laid first, while the floor is open, the ledges
    // last, over the floor's count, in the gaps left (in place of plateaus, they left the floor to the lava), or in the last tries
    // where the floor's count is never reached (a lava cave's halls stand far apart); a kind that finds no place in 200 tries is let go. The later tries lay the plain sizes: a seed whose
    // kinds leave no walk long enough (an arena cuts the way short) still gets a floor
    const MX = plat && mixed && TY.mix, kq = [];
    let nLedge = 0, kt = 0, pend = null, pendT = 0;
    if (MX) { const Q = mul32(seed ^ 0x432a), qi = (a) => a[0] + Math.floor(Q() * (a[1] - a[0] + 1));
      if (MX.arena && !boss) for (let k = qi(MX.arena.n); k > 0; k--) kq.push('arena');
      if (MX.ridge) for (let k = qi(MX.ridge.n); k > 0; k--) kq.push('ridge');
      nLedge = MX.ledge ? qi(MX.ledge.n) : 0; }
    // a terrace floor's ledges (TASKS 433) stand past its rows' short ends and over the river on its narrow side, where the rows
    // leave room: dead ends off the serpentine
    if (terr && MX && MX.ledge) { const Q = mul32(seed ^ 0x433e), qi = (a) => a[0] + Math.floor(Q() * (a[1] - a[0] + 1)), K = MX.ledge;
      for (let n = qi(AR.terrace.ledges), i = 0; n > 0 && i < 400; i++) { const w = qi(K.box[0]), h = qi(K.box[1]), x = 3 + Math.floor(Q() * (W - w - 6)), y = 4 + AR.cacheRows + Math.floor(Q() * (H - h - 7 - AR.cacheRows));
        if (!apart(x, y, w, h) || figHit(x, y, w, h) || holdHit(x, y, w, h)) continue;
        rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, kind: 'ledge', g: K.grow }); n--; } }
    // a catacomb (TASKS 379): its chambers all one size on a grid, a patch of it grown from one cell to the floor's count
    if (LY && LY.grid && !boss) { const [cw, chh] = LY.grid.cell, [sx, sy] = LY.grid.step, cols = Math.floor((W - 6 - cw) / sx) + 1, rows = Math.floor((H - 7 - chh) / sy) + 1;
      const ox = 3 + Math.floor((W - 6 - (cols - 1) * sx - cw) / 2), oy = 4 + Math.floor((H - 7 - (rows - 1) * sy - chh) / 2), got = new Set([ri(0, cols * rows - 1)]);
      while (got.size < Math.min(want, cols * rows)) { const c = []; for (const k of got) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = k % cols + dx, y = Math.floor(k / cols) + dy, n = y * cols + x;
          if (x >= 0 && y >= 0 && x < cols && y < rows && !got.has(n) && !c.includes(n)) c.push(n); }
        if (!c.length) break; got.add(c[Math.floor(R() * c.length)]); }
      for (const k of [...got].sort((a, b) => a - b)) { const x = ox + (k % cols) * sx, y = oy + Math.floor(k / cols) * sy; rooms.push({ x, y, w: cw, h: chh, cx: x + (cw >> 1), cy: y + (chh >> 1), type: 'combat', id: rooms.length, shape: 'rect' }); } }
    // a fortress's courtyard (TASKS 380): first, in the middle of the map; the ring round it is kept clear by `apart`
    if (LY && LY.court && !boss) { const C = LY.court, w = ri(...C.w), h = ri(...C.h), x = ((W - w) >> 1) + ri(-2, 2), y = ((H - h) >> 1) + ri(-1, 1);
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: 0, shape: 'rect', court: 1 }); }
    for (let i = 0; i < (terr || (LY && LY.grid && !boss) ? 0 : 900) && rooms.length < want + nLedge; i++) {
      const big = rooms.length === 0 && boss;
      const kind = !MX || big ? null : kq.length ? kq[0] : rooms.length >= want || (i >= 600 && nLedge) ? 'ledge' : null, K = kind && MX[kind];
      if (K && kind !== 'ledge' && ++kt > 200) { kq.shift(); kt = 0; continue; }
      const sz = pl && !big && !K && (i < AR.bigTries ? TY.plat : TY.small), up = kind === 'ridge' && R() < K.tall;
      let w = big ? (plat ? AR.arena.w : 18) : K ? ri(...K.box[0]) : sz ? ri(...sz[0]) : cave ? ri(9, 15) : small ? ri(6, 11) : ri(7, 14), h = big ? (plat ? AR.arena.h : 14) : K ? ri(...K.box[1]) : sz ? ri(...sz[1]) : cave ? ri(8, 12) : small ? ri(5, 8) : ri(6, 10);
      if (up) [w, h] = [h, w];
      // (a shape drawn keeps its 40 tries at a place: drawn anew each try, the small ones that fit anywhere crowded out the big)
      const sh = !cave && !big ? (pend && pendT++ < 40 ? pend : (pendT = 0, pend = shapeRoom())) : null; if (sh) { w = sh.w; h = sh.h; }
      const x = ri(3, W - w - 3), y = ri(4, H - h - 3);
      if (sh ? (x + w > W - 3 || y + h > H - 3) : (!apart(x, y, w, h) || figHit(x, y, w, h) || holdHit(x, y, w, h))) continue;
      const r = sh ? shaped(x, y, sh) : { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length };
      if (sh) { if (!rectsOf(r).every(([a, b, c, d]) => apart(a, b, c, d))) continue; Object.assign(r, { type: 'combat', id: rooms.length }); pend = null; }
      if (K) { r.kind = kind; r.g = K.grow && (up ? [K.grow[1], K.grow[0]] : K.grow); if (kind === kq[0]) { kq.shift(); kt = 0; } }
      rooms.push(r);
    }
    if (rooms.length < (cave ? 6 : LY.min || 8)) return null;
    // the plateaus stand close (TASKS 422): each box but a boss's arena grows a side at a time into the free rock, up to AR.grow,
    // so the floor is mostly plateau with narrow lava between, as the reference has it, not tables far apart over the dark
    if (pl && !terr) for (let more = true; more;) { more = false;
      for (const r of rooms) { if ((boss && r.id === 0) || r.isle) continue;
        for (const [dx, dy, dw, dh] of [[-1, 0, 1, 0], [0, 0, 1, 0], [0, -1, 0, 1], [0, 0, 0, 1]]) { const x = r.x + dx, y = r.y + dy, w = r.w + dw, h = r.h + dh;
          if (w > (r.g || TY.grow)[0] || h > (r.g || TY.grow)[1] || x < 3 || y < 4 || x + w > W - 3 || y + h > H - 3) continue;
          const o = rooms.indexOf(r); rooms.splice(o, 1); const ok = apart(x, y, w, h) && !figHit(x, y, w, h) && !holdHit(x, y, w, h); rooms.splice(o, 0, r);
          if (ok) { Object.assign(r, { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) }); more = true; } } } }
    const side = (r) => (!riverY.length ? 0 : r.isle ? 2 : r.cy + 0.5 < riverY[Math.min(W - 1, Math.max(0, r.cx))] ? -1 : 1);
    // a river's plateaus (TASKS 428) grow on to its bank, past AR.grow the river's way only, so their edges are its banks and no strip
    // of rock between turns to a field of lava round it
    if (riverY.length) for (let more = true; more;) { more = false;
      for (const r of rooms) { if (r.isle) continue; const dn = side(r) < 0, x = r.x, y = dn ? r.y : r.y - 1, w = r.w, h = r.h + 1;
        if (h > TY.grow[1] + 10 || y < 4 || y + h > H - 3) continue;
        const o = rooms.indexOf(r); rooms.splice(o, 1); const ok = apart(x, y, w, h) && !figHit(x, y, w, h) && !holdHit(x, y, w, h); rooms.splice(o, 0, r);
        if (ok) { Object.assign(r, { y, h, cy: y + (h >> 1) }); more = true; } } }
    const main = rooms.length;
    if (cave && !pl) for (let i = 0, n = ri(2, 3); i < 400 && rooms.length < main + n; i++) { const w = ri(5, 6), h = ri(5, 6), x = ri(3, W - w - 3), y = ri(4, H - h - 3);
      if (apart(x, y, w, h, [3, 3])) rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, pocket: 1 }); }
    const keep = new Set();
    if (!cave) for (const r of rooms) for (const [bx, by, bw, bh] of rectsOf(r)) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) set(x, y, 1);
    const edgeNz = pl ? noise2(mul32(seed ^ 0x422e), 4) : null;
    const blob = (r) => { const KB = r.kind ? MX[r.kind] : {}, EB = KB.edge || TY.edge, ph = [0, 1, 2, 3].map(() => R() * 6.283), am = [0, 1, 2, 3].map((k) => (0.04 + 0.1 * R()) / (1 + 0.5 * k) * (pl ? (boss && r.id === 0 ? AR.arena.rag : TY.rag * (KB.rag || 1)) : 1)), hw = r.w / 2, hh = r.h / 2;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const u = (x + 0.5 - r.x - hw) / hw, v = (y + 0.5 - r.y - hh) / hh, a = Math.atan2(v, u);
        let lim = 1.1; for (let k = 0; k < 4; k++) lim -= am[k] * (1 + Math.cos((k + 2) * a + ph[k]));
        // a plateau (TASKS 422) fills its box as a rounded square, its edge pushed in and out by a noise of a few cells' grain, so
        // the close-set plateaus leave narrow channels between them, not the dark corners of ellipses, and their edges stay ragged
        const sq = pl && !r.pocket && !r.isle && !(boss && r.id === 0);
        if (sq ? Math.pow(Math.abs(u) ** AR.round + Math.abs(v) ** AR.round, 1 / AR.round) < lim + (edgeNz(x, y) - 0.5) * 2 * EB[1] / Math.min(hw, hh) + EB[0] / Math.min(hw, hh) : Math.hypot(u, v) < lim) set(x, y, 1); }
      const [x0, x1, y0, y1] = r.pocket ? [r.cx - 1, r.cx, r.cy - 1, r.cy] : r.id === 0 && boss ? [r.cx - 4, r.cx + 3, r.cy - 4, r.cy + 5] : [r.cx - 1, r.cx + 2, r.cy - 1, r.cy + 3];
      // (a ridge keeps a band three cells wide along its length: its ragged edge pinched it to a cell a big body could not pass)
      if (r.kind === 'ridge') { const long = r.w >= r.h; for (let t = long ? r.x + 1 : r.y + 1; t < (long ? r.x + r.w - 1 : r.y + r.h - 1); t++) for (let o = -1; o <= 1; o++) { const x = long ? t : r.cx + o, y = long ? r.cy + o : t; set(x, y, 1); keep.add(y * W + x); } }
      // (a narrow plateau's core stays inside its box: past it, it reached across the channel to the next)
      for (let y = r.kind ? Math.max(y0, r.y) : y0; y <= (r.kind ? Math.min(y1, r.y + r.h - 1) : y1); y++) for (let x = r.kind ? Math.max(x0, r.x) : x0; x <= (r.kind ? Math.min(x1, r.x + r.w - 1) : x1); x++) { set(x, y, 1); keep.add(y * W + x); } };
    if (cave) for (const r of rooms) blob(r);
    // a river's plateau runs its floor on to the bank along the river's bends (TASKS 428), TY.margin cells off it, between its box's
    // corners, where no other plateau's box comes near
    if (riverY.length) for (const r of rooms) { if (r.isle || r.pocket) continue; const dn = side(r) < 0;
      for (let x = r.x + 2; x < r.x + r.w - 2; x++) { const b = dn ? Math.floor(riverB[x][0]) - TY.margin : Math.ceil(riverB[x][1]) + TY.margin;
        for (let y = dn ? r.y + r.h : r.y - 1; dn ? y < b : y > b; y += dn ? 1 : -1) { if (rooms.some((q) => q !== r && x >= q.x - AR.gap[0] && x < q.x + q.w + AR.gap[0] && y >= q.y - AR.gap[1] && y < q.y + q.h + AR.gap[1]) || holdHit(x, y, 1, 1)) break; set(x, y, 1); } } }
    // ---- connections: Prim MST on centre distance + extra short edges for loops ----
    // (a catacomb's chambers stand evenly on their grid: a jitter per pair, so its tree is no comb of equal links taken in order)
    const dist = LY && LY.grid ? (a, b) => Math.hypot(a.cx - b.cx, (a.cy - b.cy) * 1.2) + 2 * (((a.id * 7919 + b.id * 104729 + seed) >>> 0) % 997) / 997 : (a, b) => Math.hypot(a.cx - b.cx, (a.cy - b.cy) * 1.2);
    // the plateaus' tree (TASKS 400) holds each plateau to two ridges, three only when no other way joins the next one: a long chain
    // with a few forks, so the walk from the start to the stairs crosses most of the floor
    // a ledge (TASKS 433) is a dead end off the tree, not a link in its chain: hung off its nearest plateau below, a side way the walk
    // to the stairs never needs, with the floor's rewards at its end
    const dead = (i) => rooms[i].kind === 'ledge', top0 = Math.max(0, rooms.findIndex((r, i) => i < main && !dead(i)));
    const inT = new Set([top0, ...rooms.map((r, i) => i).filter((i) => i < main && dead(i))]), edges = [], deg = rooms.map(() => 0);
    // (a terrace floor's tree is its serpentine: each row's plateaus in a line, a row joined to the next at its one end and that to
    // the next at its other, the branches to the nearest terrace)
    if (terr) { const link = (a, b) => { edges.push([a, b, dist(rooms[a], rooms[b])]); deg[a]++; deg[b]++; };
      terr.rows.forEach((row, i) => { for (let j = 1; j < row.length; j++) link(row[j - 1], row[j]); if (i) { const end = ((i - 1) % 2 === 0) === terr.left ? (r) => r[r.length - 1] : (r) => r[0]; link(end(terr.rows[i - 1]), end(row)); } });
      for (const b of terr.branch) { let best = null; for (const row of terr.rows) for (const a of row) { const d = dist(rooms[a], rooms[b]); if (!best || d < best[1]) best = [a, d]; } if (best) link(best[0], b); }
      for (let k = 0; k < main; k++) inT.add(k); }
    while (inT.size < main) { let best = null;
      for (const cap of pl ? [AR.deg, AR.deg + 1, 99] : [99]) { for (const a of inT) if (deg[a] < cap && !dead(a)) for (let b = 0; b < main; b++) if (!inT.has(b)) { const d = dist(rooms[a], rooms[b]); if (!best || d < best[2]) best = [a, b, d]; } if (best) break; }
      edges.push(best); inT.add(best[1]); deg[best[0]]++; deg[best[1]]++; }
    for (let l = 0; l < main; l++) if (dead(l)) { let best = null; for (let b = 0; b < main; b++) if (!dead(b) && !rooms[b].isle && side(rooms[b]) === side(rooms[l])) { const d = dist(rooms[b], rooms[l]); if (!best || d < best[2]) best = [b, l, d]; }
      if (best) { edges.push(best); deg[best[0]]++; deg[best[1]]++; } }
    // a river's banks (TASKS 428) are joined across it in TY.cross places, the island's ways counting, spread along it: the tree
    // crosses once or twice, the nearest pairs of plateaus on the two banks well off those places add the rest
    // (the island's two ways, one to each bank, are one place)
    if (riverY.length) { const over = (e) => side(rooms[e[0]]) !== side(rooms[e[1]]), midX = (e) => (rooms[e[0]].cx + rooms[e[1]].cx) / 2, want = ri(...TY.cross);
      const places = () => { const ss = edges.filter((e) => over(e) && (rooms[e[0]].isle || rooms[e[1]].isle)).map((e) => side(rooms[e[0]]) + side(rooms[e[1]]) - 2);
        return edges.filter((e) => over(e) && !rooms[e[0]].isle && !rooms[e[1]].isle).length + (ss.includes(-1) && ss.includes(1) ? 1 : ss.length ? 0.5 : 0); };
      const cand = []; for (let a = 0; a < main; a++) for (let b = a + 1; b < main; b++) if (side(rooms[a]) * side(rooms[b]) === -1 && !dead(a) && !dead(b)) cand.push([a, b, dist(rooms[a], rooms[b])]);
      cand.sort((p, q) => p[2] - q[2]);
      // the island is a way over: joined to both banks, its nearest plateau on the bank it lacks
      const isl = rooms.findIndex((r) => r.isle), got = edges.filter((e) => e.includes(isl)).map((e) => side(rooms[e[0] === isl ? e[1] : e[0]]));
      for (const sd of [-1, 1]) if (isl >= 0 && !got.includes(sd)) { let best = null; for (let b = 0; b < main; b++) if (side(rooms[b]) === sd) { const d = dist(rooms[isl], rooms[b]); if (!best || d < best[2]) best = [isl, b, d]; }
        if (best) { edges.push(best); deg[best[0]]++; deg[best[1]]++; } }
      // (a second pass reaches farther when the first left one place: an arena on a bank, TASKS 432, leaves its pairs far apart)
      for (const lim of [48, 64]) for (const e of cand) { if (places() >= (lim > 48 ? 2 : want)) break; if (e[2] > lim || edges.filter(over).some((f) => Math.abs(midX(f) - midX(e)) < W / 6)) continue; edges.push(e); deg[e[0]]++; deg[e[1]]++; } }
    // a pocket hangs off its nearest room and leads nowhere else
    for (let p = main; p < rooms.length; p++) { let best = null; for (let b = 0; b < main; b++) if (!dead(b)) { const d = dist(rooms[p], rooms[b]); if (!best || d < best[2]) best = [b, p, d]; } edges.push(best); }
    if (!pl) for (let a = 0; a < main; a++) for (let b = a + 1; b < main; b++) { if (dead(a) || dead(b)) continue;
      if (edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) continue;
      const d = dist(rooms[a], rooms[b]); if (d < (LY ? LY.loops[0] : 26) && R() < (LY ? LY.loops[1] : 0.28)) edges.push([a, b, d]); }
    // the plateaus' loops join only plateaus far apart on the tree and not too far on the map: a short loop would cut the way short
    else { const tree = edges.slice(), hopT = (a) => { const h = rooms.map(() => 99), q = [a]; h[a] = 0;
        for (let i = 0; i < q.length; i++) for (const [p, o] of tree) for (const [u, v] of [[p, o], [o, p]]) if (u === q[i] && h[v] > h[u] + 1) { h[v] = h[u] + 1; q.push(v); } return h; };
      const cand = []; if (!terr) for (let a = 0; a < main; a++) { const h = hopT(a); for (let b = a + 1; b < main; b++) { const d = dist(rooms[a], rooms[b]); if (!dead(a) && !dead(b) && h[b] >= AR.loopHops && d < 44 && side(rooms[a]) === side(rooms[b])) cand.push([a, b, d]); } }
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
      var loopCand = cand, loopWant = ri(...AR.loops); }
    // (a two-cell corridor runs on the line and the cell past it, as it always has; a three-cell one is centred on it)
    const carveH = (x0, x1, y, wd = 2) => { const o = wd === 3 ? -1 : 0; for (let x = Math.min(x0, x1) + o; x <= Math.max(x0, x1) + o + wd - 1 - (wd === 2 ? 1 : 0); x++) for (let j = 0; j < wd; j++) if (!at(x, y + o + j)) set(x, y + o + j, 1); };
    const carveV = (y0, y1, x, wd = 2) => { const o = wd === 3 ? -1 : 0; for (let y = Math.min(y0, y1) + o; y <= Math.max(y0, y1) + o + wd - 1 - (wd === 2 ? 1 : 0); y++) for (let i = 0; i < wd; i++) if (!at(x + o + i, y)) set(x + o + i, y, 1); };
    // a rooms floor's corridor (TASKS 376): from core to core, past 16 cells through one or two bends set two to four cells off the
    // straight line (the rooms stand close: farther out, the bends ate the rock the caches are dug into), each leg an L of straight
    // runs; a quarter of them three cells wide
    const winding = (A, B) => { const wd = R() < LY.wide ? 3 : 2, L = Math.hypot(B.cx - A.cx, B.cy - A.cy) || 1, k = L < LY.bends[0] ? 0 : L < LY.bends[1] ? 1 : 1 + (R() < 0.5 ? 1 : 0), nx = -(B.cy - A.cy) / L, ny = (B.cx - A.cx) / L, pts = [[A.cx, A.cy]];
      for (let i = 1; i <= k; i++) { const t = i / (k + 1) + (R() - 0.5) * 0.15, o = (R() < 0.5 ? -1 : 1) * (LY.off[0] + R() * (LY.off[1] - LY.off[0]));
        pts.push([Math.max(4, Math.min(W - 7, Math.round(A.cx + (B.cx - A.cx) * t + nx * o))), Math.max(5, Math.min(H - 7, Math.round(A.cy + (B.cy - A.cy) * t + ny * o)))]); }
      pts.push([B.cx, B.cy]);
      for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; if (R() < 0.5) { carveH(ax, bx, ay, wd); carveV(ay, by, bx, wd); } else { carveV(ay, by, ax, wd); carveH(ax, bx, by, wd); } } };
    // a tunnel bends off the straight line between the two cores and comes back to it, 2–4 cells wide; its middle line is kept
    // open through the smoothing so it never closes
    const tunnel = (A, B) => { const x0 = A.cx + 0.5, y0 = A.cy + 0.5, x1 = B.cx + 0.5, y1 = B.cy + 0.5, L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const amp = Math.min(4, L / 6) * (0.4 + 0.6 * R()) * (R() < 0.5 ? -1 : 1), turns = 1 + Math.floor(R() * 2), wd = 2 + Math.floor(R() * 2), wide = R() * 6.283;
      for (let s = 0; s <= L; s += 0.5) { const t = s / L, o = amp * Math.sin(Math.PI * t * turns) * Math.sin(Math.PI * t), px = x0 + (x1 - x0) * t + nx * o, py = y0 + (y1 - y0) * t + ny * o;
        const b = wd + (Math.sin(t * 9 + wide) > 0.7 ? 1 : 0), bx = Math.round(px - b / 2), by = Math.round(py - b / 2);
        for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) set(bx + i, by + j, 1); keep.add(Math.floor(py) * W + Math.floor(px)); } };
    // a plateaus' ridge runs from core to core through one to three bends set off the straight line by turns either side, a square
    // brush of 2–3 cells along it (so every cell of it lies in a 2×2 of floor and it never narrows to one); all of it is kept through
    // the smoothing. Its middle line is kept for the ledges
    const lines = [];
    const ridge = (A, B, side) => { const x0 = A.cx + 0.5, y0 = A.cy + 0.5, x1 = B.cx + 0.5, y1 = B.cy + 0.5, L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const k = side ? 1 : 1 + (R() < 0.5 ? 1 : 0) + (L > 34 ? 1 : 0), s0 = side || (R() < 0.5 ? -1 : 1), cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), pts = [[x0, y0]];
      for (let i = 1; i <= k; i++) { const t = (i - 0.3 + 0.6 * R()) / (k + 1), o = s0 * (i % 2 ? 1 : -1) * (TY.ridge.bend[0] + R() * (TY.ridge.bend[1] - TY.ridge.bend[0])) * Math.min(1, L / 24);
        pts.push([cl(x0 + (x1 - x0) * t + nx * o, 5, W - 6), cl(y0 + (y1 - y0) * t + ny * o, 6, H - 6)]); }
      pts.push([x1, y1]);
      let wd = ri(...TY.ridge.w); const line = [];
      for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay);
        for (let s = 0; s <= l; s += 0.5) { const px = ax + (bx - ax) * s / l, py = ay + (by - ay) * s / l;
          if (R() < 0.04) wd = wd === 2 ? 3 : 2;
          const b = wd, qx = Math.round(px - b / 2), qy = Math.round(py - b / 2); for (let j = 0; j < b; j++) for (let ii = 0; ii < b; ii++) { set(qx + ii, qy + j, 1); keep.add((qy + j) * W + qx + ii); }
          line.push([px, py]); } }
      lines.push({ a: A.id, b: B.id, line, s0 }); };
    // a ridge's length, plateau edge to plateau edge: its middle line's run off every plateau's floor, in cells
    const ridgeLen = (q) => q.line.filter(([x, y]) => !rooms.some((r) => !r.pocket && Math.hypot((x - r.cx - 0.5) / (r.w / 2), (y - r.cy - 0.5) / (r.h / 2)) < 0.9)).length / 2;
    // a fortress's ring and gates (TASKS 380): the ring a corridor round the court `moat` cells off it, the gates straight from the
    // court's middle out to it on two opposite sides; a link to the court runs to the ring's nearest cell instead
    const court = LY && LY.court ? rooms.find((r) => r.court) : null, ringC = [];
    if (court) { const C = LY.court, G = C.moat + C.ring, x0 = court.x - G, y0 = court.y - G, x1 = court.x + court.w + G - 1, y1 = court.y + court.h + G - 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x < x0 + C.ring || x > x1 - C.ring || y < y0 + C.ring || y > y1 - C.ring) { set(x, y, 1); ringC.push([x, y]); }
      const hor = R() < 0.5, sides = (hor ? ['l', 'r'] : ['u', 'd']).slice(0, C.gates);
      for (const sd of sides) { if (sd === 'u') carveV(court.y, y0, court.cx - 1); if (sd === 'd') carveV(court.y + court.h - 1, y1, court.cx - 1); if (sd === 'l') carveH(court.x, x0, court.cy - 1); if (sd === 'r') carveH(court.x + court.w - 1, x1, court.cy - 1); }
      court.ring = [x0, y0, x1, y1]; court.gates = sides;
      moat = (x, y) => x >= x0 + C.ring && x <= x1 - C.ring && y >= y0 + C.ring && y <= y1 - C.ring && !inRm(court, x, y) && cells[y * W + x] !== 1; }
    const toRing = (O) => { let b = null, bd = 1e9; for (const [x, y] of ringC) { const d = Math.hypot(x - O.cx, y - O.cy); if (d < bd) { bd = d; b = [x, y]; } } return { cx: b[0], cy: b[1] }; };
    for (const [a, b] of edges) { const A = rooms[a], B = rooms[b];
      if (pl) ridge(A, B);
      else if (cave) tunnel(A, B);
      else if (A.court || B.court) { const O = A.court ? B : A; winding(O, toRing(O)); }
      else winding(A, B); }
    // a rooms floor's dead ends (TASKS 376): a nook of 4–5 cells in the rock the corridors left whole (two cells of it all round),
    // ten cells and more from the nearest room, at the end of a way of its own from that room: a chest's place or an ambush's
    if (!cave) for (let i = 0, n = ri(...LY.nooks) + (W * H >= 3500 && LY.nooks[1] ? 1 : 0), m0 = rooms.length; i < 600 && rooms.length < m0 + n; i++) { const w = ri(4, 5), h = ri(4, 5), x = ri(4, W - w - 4), y = ri(5, H - h - 4);
      let solid = true; for (let yy = y - 2; yy < y + h + 2 && solid; yy++) for (let xx = x - 2; xx < x + w + 2; xx++) if (at(xx, yy)) { solid = false; break; }
      const cx = x + (w >> 1), cy = y + (h >> 1); let b = -1, bd = 1e9; for (let k = 0; k < main; k++) { const d = Math.hypot(rooms[k].cx - cx, (rooms[k].cy - cy) * 1.2); if (d < bd) { bd = d; b = k; } }
      if (!solid || bd < 10 || bd > 26 || !apart(x, y, w, h, [3, 3])) continue;
      const P = { x, y, w, h, cx, cy, type: 'combat', id: rooms.length, pocket: 1 }; rooms.push(P); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, 1);
      edges.push([b, P.id, bd]); winding(rooms[b], P); }
    // a plateaus' loop is laid one at a time and kept only if the longest walk between two plateaus stays within AR.loopKeep of
    // what it was: a loop gives another way round, not a short cut past half the floor
    const longest = () => { let top = 0; for (let a = 0; a < main; a++) { const d = new Int32Array(W * H).fill(-1), q = [rooms[a].cy * W + rooms[a].cx]; d[q[0]] = 0;
      for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && cells[n]) { d[n] = d[q[i]] + 1; q.push(n); } }
      for (let b = a + 1; b < main; b++) top = Math.max(top, d[rooms[b].cy * W + rooms[b].cx]); } return top; };
    if (pl) { const top = longest(); let got = 0;
      for (const e of loopCand) { if (loopWant <= 0) break; const c0 = cells.slice(), k0 = new Set(keep), n0 = lines.length; ridge(rooms[e[0]], rooms[e[1]]);
        if (longest() >= top * AR.loopKeep) { edges.push(e); loopWant--; got++; continue; }
        for (let k = 0; k < W * H; k++) cells[k] = c0[k]; keep.clear(); for (const k of k0) keep.add(k); lines.length = n0; }
      // short of loops, a ridge of the tree gets a second one bowed the other way: a fork round an island of lava or dark that meets
      // again at the next plateau (no short cut: both ways are about as long); the floor's first loop may cost the walk down to
      // AR.loopLast, so every floor has one
      const twin = terr ? [] : lines.slice(0, main - 1).filter((q) => !dead(q.a) && !dead(q.b) && Math.hypot(rooms[q.a].cx - rooms[q.b].cx, rooms[q.a].cy - rooms[q.b].cy) >= 22 && side(rooms[q.a]) === side(rooms[q.b]));
      for (let i = twin.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [twin[i], twin[j]] = [twin[j], twin[i]]; }
      for (const q of twin) { if (loopWant <= 0) break; const c0 = cells.slice(), k0 = new Set(keep), n0 = lines.length; ridge(rooms[q.a], rooms[q.b], -q.s0);
        if (longest() >= top * (got ? AR.loopKeep : AR.loopLast)) { loopWant--; got++; continue; }
        for (let k = 0; k < W * H; k++) cells[k] = c0[k]; keep.clear(); for (const k of k0) keep.add(k); lines.length = n0; } }
    // a ledge: a spur two cells wide off the middle of a ridge, out to a small pad over the lava or the chasm, a dead end for a chest,
    // an ambush or a cache (a pocket, as in the cave)
    if (pl) { const isFloor = (x, y) => at(x, y) !== 0;
      const pool = lines.filter((q) => q.line.length >= 40); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      for (let n = ri(...AR.ledges), i = 0; n > 0 && i < pool.length * 3; i++) { const q = pool[i % pool.length], m = q.line.length, at0 = Math.floor(m * (0.3 + 0.4 * R())), [px, py] = q.line[at0];
        const [qx, qy] = q.line[Math.min(m - 1, at0 + 4)], [ox, oy] = q.line[Math.max(0, at0 - 4)], tl = Math.hypot(qx - ox, qy - oy) || 1, sd = R() < 0.5 ? -1 : 1, nx = -(qy - oy) / tl * sd, ny = (qx - ox) / tl * sd;
        const d = 6 + 2 * R(), w = ri(5, 6), h = ri(5, 6), cx = Math.round(px + nx * d), cy = Math.round(py + ny * d), x = cx - (w >> 1), y = cy - (h >> 1);
        if (x < 3 || y < 4 || x + w > W - 3 || y + h > H - 3 || !apart(x, y, w, h, [3, 3]) || figHit(x, y, w, h) || holdHit(x, y, w, h)) continue;
        let clear = true; for (let yy = y - 1; yy < y + h + 1 && clear; yy++) for (let xx = x - 1; xx < x + w + 1; xx++) if (isFloor(xx, yy)) { clear = false; break; }
        if (!clear) continue;
        const r = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length, pocket: 1 }; rooms.push(r); blob(r);
        for (let s = 0; s <= d; s += 0.5) { const sx = Math.round(px + nx * s - 1), sy = Math.round(py + ny * s - 1); for (let j = 0; j < 2; j++) for (let ii = 0; ii < 2; ii++) { set(sx + ii, sy + j, 1); keep.add((sy + j) * W + sx + ii); } }
        const near = Math.hypot(rooms[q.a].cx - px, rooms[q.a].cy - py) < Math.hypot(rooms[q.b].cx - px, rooms[q.b].cy - py) ? q.a : q.b; edges.push([near, r.id, dist(rooms[near], r)]); n--; } }
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
    // in the floor (only where two cells of floor stay open past it; never in a plateaus' ridge, where two knobs a cell apart on its
    // two edges pinched it to one)
    const breakRuns = (skip) => { for (let pass = 0; pass < 8; pass++) { const runs = straightRuns(cells, W, H, skip); if (!runs.length) break;
      for (const { x, y, dx, dy, nx, ny, n } of runs) { const mx = x + dx * (n >> 1), my = y + dy * (n >> 1);
        // (a plateau's top edge takes a knob, not a niche: the rock above stays whole for the merchant's back wall, TASKS 422)
        if ((R() < 0.5 || (pl && ny < 0)) && at(mx - nx, my - ny) && at(mx - 2 * nx, my - 2 * ny) && !(pl && keep.has(my * W + mx))) set(mx, my, 0); else set(mx + nx, my + ny, 1); }
      tidy(); const seen = reach(); for (let k = 0; k < W * H; k++) if (cells[k] && !seen[k]) cells[k] = 0; } };
    if (cave) breakRuns(() => false);
    if (pl && narrowTo(cells, W, H, rooms[0].cy * W + rooms[0].cx, rooms.map((r) => r.cy * W + r.cx)).length) return null;
    const adj = rooms.map(() => []); for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
    // ---- roles: start at a leaf on the rim, exit farthest by hops then distance ----
    const hops = (from) => { const h = rooms.map(() => 99), q = [from.id]; h[from.id] = 0;
      while (q.length) { const a = q.shift(); for (const b of adj[a]) if (h[b] > h[a] + 1) { h[b] = h[a] + 1; q.push(b); } } return h; };
    // (a ledge or a ridge, TASKS 432, is no start nor stairs: too small for the stairs' guard and its pack, too narrow for the camp,
    // whose hero came down past a ridge's edge into the lava)
    const narrow = (r) => r.kind === 'ledge' || r.kind === 'ridge' || r.shape === 'closet';
    let leaves = rooms.filter((r) => adj[r.id].length === 1 && !(boss && r.id === 0) && !r.pocket && !r.isle && !narrow(r) && !r.court);
    // the boss hall is fixed (the biggest room), so the start is among the rooms farthest from it on foot (rim leaves first), or the
    // boss was a room away; the walk is counted on the carved cells, not by room hops: corridors cut through rooms and merge
    if (boss) { const d = new Array(W * H).fill(-1), q = [rooms[0].cy * W + rooms[0].cx], at0 = (r) => d[r.cy * W + r.cx]; d[q[0]] = 0;
      for (let i = 0; i < q.length; i++) { const c = q[i]; for (const n of [c - 1, c + 1, c - W, c + W]) if (cells[n] && d[n] < 0) { d[n] = d[c] + 1; q.push(n); } }
      const farAll = Math.max(...rooms.map(at0)); if (!leaves.some((r) => at0(r) >= farAll * 0.6)) leaves = rooms.slice(1, main).filter((r) => !narrow(r));
      const far = Math.max(...leaves.map(at0)); leaves = leaves.filter((r) => at0(r) >= far * 0.8); }
    // the plateaus (TASKS 400) put their start and stairs as far apart on foot as the floor has them: a pair of plateaus, the start a
    // leaf, drawn from those within a tenth of the longest walk
    // (a terrace floor's start and stairs are the serpentine's two ends: its first row's free end and its last row's)
    if (terr) { const free = (row, next) => { const tied = edges.find((e) => next && ((row.includes(e[0]) && next.includes(e[1])) || (row.includes(e[1]) && next.includes(e[0])))), t = tied ? (row.includes(tied[0]) ? tied[0] : tied[1]) : -1;
        return rooms[t === row[0] ? row[row.length - 1] : row[0]]; };
      leaves = [free(terr.rows[0], terr.rows[1]), free(terr.rows[terr.rows.length - 1], terr.rows[terr.rows.length - 2])]; }
    const far = pl && !boss ? (() => { const main = terr ? leaves.slice() : rooms.filter((r) => !r.pocket && !r.isle && !narrow(r)), walk = (r) => { const d = new Int32Array(W * H).fill(-1), q = [r.cy * W + r.cx]; d[q[0]] = 0;
        for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && cells[n]) { d[n] = d[q[i]] + 1; q.push(n); } } return d; };
      const pairs = []; for (const a of leaves.length ? leaves : main) { const d = walk(a); for (const b of main) if (b !== a) pairs.push([a, b, d[b.cy * W + b.cx]]); }
      const top = Math.max(...pairs.map((p) => p[2])), good = pairs.filter((p) => p[2] >= top * 0.9); return pick(good); })() : null;
    // (the last few tries take nine tenths of it: the close-set plateaus, TASKS 422, leave a rare seed no floor that walks the whole)
    const pathMin = pl ? TY.path[floor - 1] * (MIX ? AR.blend.pathKeep : 1) * (strict ? 1 : 0.9) : 0;
    if (far && far[2] < pathMin) return null;
    // (a rooms floor's last room may be a nook, TASKS 376: no start; a cave keeps its pocket start, TASKS 335)
    const start = far ? far[0] : (leaves.length ? pick(leaves) : rooms[cave ? rooms.length - 1 : main - 1]);
    const hop = hops(start);
    const exitR = far ? far[1] : boss ? rooms[0] : rooms.filter((r) => r !== start && !r.pocket && !narrow(r) && !r.court).sort((p, q2) => (hop[q2.id] - hop[p.id]) || (dist(q2, start) - dist(p, start)))[0];
    start.type = 'start'; exitR.type = boss ? 'boss' : 'exit';
    // the magma caves' way (TASKS 433): the plateaus and halls the walk from the start to the stairs crosses. The rewards go off it, to
    // the dead ends first (a ledge, a pocket, a leaf of the tree), so no more than a third of a floor's lies on the way
    let way = plat ? wayRooms(cells, W, H, rooms, start.cy * W + start.cx, exitR.cy * W + exitR.cx) : new Set(), deadEnd = (r) => (adj[r.id] || []).length === 1;
    // a Fisher–Yates shuffle: a random sort comparator gives each JS engine its own order, so node checks would see other maps than the browser
    const others = rooms.filter((r) => r.type === 'combat'); for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    const nTreasure = 1 + (R() < 0.5 ? 1 : 0);
    if (!cave) others.sort((a, b) => (a.shape === 'closet') - (b.shape === 'closet'));
    // (a rooms floor's nooks, TASKS 376, stay out of the hoards: a hoard's chests and dressing want a room; a nook gets its own chest)
    if (cave) others.sort((a, b) => (b.pocket || 0) - (a.pocket || 0)); else others.sort((a, b) => (a.pocket || 0) + (a.court || 0) - (b.pocket || 0) - (b.court || 0));
    // the hoards go to the ledges first (TASKS 432): a small pad off the way with a chest on it
    if (MX) others.sort((a, b) => (b.kind === 'ledge') - (a.kind === 'ledge'));
    if (plat) { const rank = (r) => (way.has(r.id) ? 2 : 0) + (deadEnd(r) ? 0 : 1); others.sort((a, b) => rank(a) - rank(b)); }
    // a lake's hoard is on one of its islands (TASKS 427): the short way over the lake pays
    { const i = others.findIndex((r) => r.isle === 2) >= 0 ? others.findIndex((r) => r.isle === 2) : others.findIndex((r) => r.isle); if (i > 0) others.unshift(others.splice(i, 1)[0]); }
    others.slice(0, nTreasure).forEach((r) => (r.type = 'treasure'));
    // an altar on every second floor (TASKS 137), the last one on the floor before the boss's: past him a gift buys nothing
    // (TASKS 183); the roll stays so the rest of the floor is laid out as before
    // (a plateau floor's altar comes after its merchant: a plateau with room for his corner is rare enough without the altar taking it)
    R(); const altar = () => { if (!boss && (ST.altar ?? (floor % 2 === 0 || floor === ST.n - 1))) ((cave ? others.find((r) => r.type === 'combat' && !r.pocket) : others.slice(nTreasure).find((r) => !r.pocket)) || others[0] || rooms.find((r) => r.type === 'treasure') || {}).type = 'shrine'; };
    if (!pl) altar();
    // the court's (TASKS 380): the floor's altar, moved there, or a pack round an elite
    if (court) { if (R() < LY.court.altar) { const o = rooms.find((r) => r.type === 'shrine'); if (o) o.type = 'combat'; court.type = 'shrine'; } else court.courtElite = 1; }
    // the merchant's room, on every floor: the counter and his back wall need a solid top wall and no corridor mouth near them
    const isDoor = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const nx = x + i, ny = y + j;
      if (at(nx, ny) === 1 && !rooms.some((q) => nx >= q.x && nx < q.x + q.w && ny >= q.y && ny < q.y + q.h)) return true; } return false; };
    const shopFits = (r) => { if (r.w < 8 || r.h < 6 || (r.shape && r.shape !== 'rect') || r.court) return false;
      for (let x = r.cx - 3; x <= r.cx + 3; x++) { if (Math.abs(x - r.cx) <= 2 && at(x, r.y - 1) !== 0) return false; for (let y = r.y; y <= r.y + 3; y++) if (isDoor(x, y)) return false; }
      return true; };
    // in a cave the merchant's corner is squared off under a straight back wall, two cells of rock thick (the only straight wall
    // the cave keeps); the rest of his room stays a blob
    const caveShopAt = (r, cx) => !r.pocket && r.w >= 9 && r.y >= 6 && [-1, -2].every((d) => Array.from({ length: 9 }, (_, i) => cx - 4 + i).every((x) => at(x, r.y + d) === 0))
      && Array.from({ length: 9 }, (_, i) => cx - 4 + i).every((x) => [0, 1, 2, 3].every((j) => !isDoor(x, r.y + j)));
    // a plateau's ridges come in anywhere along its top edge now the plateaus stand close (TASKS 422): the corner slides along the
    // edge to where the rock above is whole, the room's middle moved under it
    const caveShop = (r) => { if (!pl) return caveShopAt(r, r.cx);
      for (let s = 0; s <= (r.w >> 1) - 5; s++) for (const cx of s ? [r.cx - s, r.cx + s] : [r.cx]) if (caveShopAt(r, cx)) { r.cx = cx; r.cy = r.y + 2; return true; } return false; };   // its middle on the corner's floor, which no lava takes
    // (the merchant keeps to the way: the rooms off it are the rewards')
    const shopR = (plat ? [...others.filter((r) => way.has(r.id)), ...others.filter((r) => !way.has(r.id))] : others).find((r) => r.type === 'combat' && !r.isle && (cave ? caveShop(r) : shopFits(r)));
    if (!shopR) return null;
    shopR.type = 'shop'; if (pl) altar();
    const shopCorner = (x, y) => Math.abs(x - shopR.cx) <= 5 && y >= shopR.y - 2 && y <= shopR.y + 5;
    if (cave) { for (let y = shopR.y; y <= shopR.y + 4; y++) for (let x = shopR.cx - 4; x <= shopR.cx + 4; x++) set(x, y, 1); tidy(); breakRuns(shopCorner); }
    // a biome with no spiders has no webs, so plates make up for them: the traps grow towards the end, not thin out
    const webless = !D.BIOMES[biome].roster.includes('spider');
    for (const r of others) if (r.type === 'combat' && R() < (webless ? 0.55 : 0.35) && r.w >= 8) r.trap = 1;
    // accent zones: one or two rooms per floor in another biome's look (the reference shows a green crypt and a blue hall
    // beside the torch-lit dungeon in one view)
    const zones = ['crypt', 'arcane', 'dungeon'].filter((z) => z !== biome);
    if (!cave) others.filter((r) => r.type === 'combat' || r.type === 'treasure').slice(0, (R() < 0.6 && LY.room >= 1 ? 2 : 1)).forEach((r, i) => (r.zone = zones[(i + Math.floor(R() * 2)) % zones.length]));
    // a pit room's chasm (TASKS 374): the middle of a fight's room, two cells of floor round it (the top three, where the back wall's
    // props stand), deep water's cell (no walking, sight and blows pass over); any other role keeps its floor whole
    const pits = [];
    if (!cave) for (const r of rooms) if (r.shape === 'pit') { if (r.type !== 'combat' || r.zone) { r.shape = 'rect'; continue; }
      for (let y = r.y + 3; y < r.y + r.h - 2; y++) for (let x = r.x + 2; x < r.x + r.w - 2; x++) { set(x, y, 6); pits.push(y * W + x); } r.pit = 1; }
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
    // (a hall floor's few rooms, TASKS 379, leave a fight's room or two: the hoards take rivers too)
    const lavaRoom = (r) => (r.type === 'combat' || (r.type === 'treasure' && LY.room < 1)) && !r.zone && !r.pit && !r.court && !streams.some((q) => q.room === r.id);
    // a river is a channel walked from a spring under the rock, across a room (and any corridor or room on its way) to a dead end,
    // 2–4 cells wide and wandering: through rock it is a trench between masonry banks, as in the concept; a corridor it crosses stays
    // floor (a causeway over it), a room it crosses gets a two-cell causeway where its ways in need one
    // scraps the causeways, paths and corridor mouths cut off (fewer than four cells) are dropped: a lone cell of lava reads as a
    // blot. Next to floor a scrap becomes floor, else rock (floor too where rock would hang one cell thick)
    const scraps = (cut) => { const comp = new Set(); for (const [x0, y0] of cut) { if (at(x0, y0) !== 3 || comp.has(y0 * W + x0)) continue; const part = [[x0, y0]]; comp.add(y0 * W + x0);
        for (let i = 0; i < part.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = part[i][0] + dx, y = part[i][1] + dy; if (at(x, y) === 3 && !comp.has(y * W + x)) { comp.add(y * W + x); part.push([x, y]); } }
        if (part.length < 4) for (const [x, y] of part) { const nf = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 1);
          set(x, y, nf || (at(x, y - 1) && at(x, y + 1)) ? 1 : 0); } } };
    const CROSS = ['combat', 'treasure'], roomOf = (x, y) => rooms.find((q) => inRm(q, x, y));
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
          if (v === 1 || v === 6) { if (!q) continue; if (!CROSS.includes(q.type) || q.zone || q.pit) { if (i < back) return undo(); break walk; } if (isDoor(x, y)) continue; crossed.add(q); was.push([x, y, 1]); }
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
    if (D.BIOMES[biome].lava && !(last && boss)) {
      // the first river a room or two from the start, so the floor reads as the fire depths from its first fight
      const near = rooms.filter((r) => lavaRoom(r) && hop[r.id] >= 1 && hop[r.id] <= 2), rest = rooms.filter((r) => lavaRoom(r) && !near.includes(r));
      for (let i = near.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [near[i], near[j]] = [near[j], near[i]]; }
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const tryRiver = (r) => { const dirs = [1, 3, 0, 2].filter((d) => (d % 2 ? r.w : r.h) >= 8); for (let k = 0; k < 3 && dirs.length; k++) if (river(r, dirs[Math.floor(R() * dirs.length)])) return true; return false; };
      for (const r of near) if (tryRiver(r)) break;
      const wantR = 2 + (R() < 0.5 ? 1 : 0), big = rest.filter((r) => r.w >= 10 && r.h >= 8);
      // (a hall floor's few rooms, TASKS 379, go to the rivers first: its halls are lava enough)
      if (big.length && R() < 0.75 && LY.room >= 1) for (const r of big) if (lavaRoom(r) && hall(r, Math.floor(R() * 4))) break;
      for (const r of rest) { if (streams.filter((q) => q.kind === 'river').length >= wantR) break; if (lavaRoom(r)) tryRiver(r); } }
    // (a fire floor of few rooms or small ones, TASKS 379's halls and maze, may find no room for its second river: laid anew)
    if (D.BIOMES[biome].lava && !(last && boss) && strict && LY && LY !== D.ARCH.rooms && streams.filter((q) => q.kind === 'river' && q.n >= 8).length < 2) return null;
    // a fire floor without a river, and the boss's hall, get pools: a second pass that skips the roll
    if ((D.BIOMES[biome].lava && !lava.length) || bossType === 'boss') for (let pass = 0; pass < 2 && !lava.length; pass++) for (const r of rooms) {
      if (r.type !== 'start' && r.type !== 'shop' && r.type !== 'boss' && !r.pit && r.w >= 8 && r.h >= 6 && (pass || R() < (boss ? 1 : 0.75))) pool(r); }
    function connected() { const seen = new Uint8Array(W * H), st = [[start.cx, start.cy]]; seen[start.cy * W + start.cx] = 1;
      while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
        if ((at(nx, ny) === 1 || at(nx, ny) === 4) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; st.push([nx, ny]); } } }
      for (let i = 0; i < W * H; i++) if (cells[i] === 1 && !seen[i]) return false; return true; }
    if (!connected()) return null;
    // ---- the plateaus' lava and wall (TASKS 400), laid once the secrets are dug (below), so the wall comes down over their caches. The
    // rock wall stands along the map's top only: in each column, down to the first open cell if that is within AR.cliff rows (a
    // plateau backs onto the wall), else 3–4 rows (cliff: the wall's rows per column). Below it the rock is the chasm, and the rock by
    // the floor turns to lava: a ragged band 0–3 cells wide along every edge (by a noise of a few cells' grain, so a ridge runs between
    // lava here and over the dark there) and every gap narrower than AR.channel cells between two floors, a lava bed, with rock left
    // standing in it as islands. Kept off the wall, the merchant's back wall and two cells round a secret (lava hugging it would give
    // it away); the start's core keeps it two cells off the fire. Rock one cell thick between lava and anything open, or meeting it at
    // a cell's corner, goes to lava too, or (rock kept) the lava by it goes back to rock. Its own random stream, so the rest of the floor is laid out as without it ----
    const cliff = plat ? new Array(W).fill(0) : null, crust = [], lavaUnder = [], chasmUnder = new Set(), lavaFeatures = [], lavaBodies = [];
    // ---- the plateaus' lava as the reference has it (TASKS 401): it comes from a source — a fall down the top wall, a breach at its
    // foot, a vent in the open — runs in rivers 2–4 cells wide between the plateaus and gathers in lakes with basalt islands; a river
    // that cuts a ridge is crossed where it does (a stone arch, basalt slabs, a chain bridge: crossCuts, shared with the cave's water).
    // Cooled crust lies along the banks: walkable, but it breaks under whoever stands on it (sim.js). Lakes and rivers keep to the rock
    // (only a ridge may be cut, never a plateau) and run near the plateaus, where the camera sees them, rather than out in the dark
    const platLava = () => {
      // a lava cave (TASKS 431) has its lava laid with its water (above): its rock is all wall, no chasm under it
      if (lc) { cliff.fill(H); for (let k = 0; k < W * H; k++) if (cells[k] === 3) lava.push([k % W, Math.floor(k / W)]); return true; }
      const Q = mul32(seed ^ 0x400a7a), nz = noise2(Q, 3.5), nzI = noise2(Q, 2), D8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1], D4 = [1, -1, W, -W];
      const P = mul32(seed ^ 0x401a7a), pi = (a, b) => a + Math.floor(P() * (b - a + 1)), nzR = noise2(P, 2.5), nzC = noise2(P, 5), LV = AR.lava;
      const hidden = new Set(); for (const q of secrets) { const r = rooms[q.room]; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) hidden.add(y * W + x); for (const k of q.hide) hidden.add(k); }
      const ring = new Set(); for (const k of hidden) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) ring.add(k + j * W + i);
      const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && cells[y * W + x] !== 0 && !hidden.has(y * W + x);
      for (let x = 0; x < W; x++) { let f = 0; while (f < H && !open(x, f)) f++; cliff[x] = f <= AR.cliff ? f : 3 + Math.floor(2 * nz(x, -7)); }
      // the wall stands high where a terrace floor's lavafall pours down it (TASKS 430)
      if (terr) for (let x = terr.fx - Math.ceil(terr.fw / 2) - 2; x <= terr.fx + Math.ceil(terr.fw / 2) + 2; x++) if (x >= 0 && x < W) cliff[x] = Math.max(cliff[x], AR.terrace.wall);
      // over a cache the wall comes down to the plateau it is dug from, two columns past it each side (TASKS 425)
      for (const q of secrets) { const r = rooms[q.room], hy = Math.max(...q.wall.map(([, y]) => y)) + 1, x0 = Math.min(r.x, ...q.wall.map(([x]) => x)) - 2, x1 = Math.max(r.x + r.w - 1, ...q.wall.map(([x]) => x)) + 2;
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) { let f = 0; while (f < H && !open(x, f)) f++; cliff[x] = Math.max(cliff[x], Math.min(f, hy)); } }
      // a cut one to three columns wide down the wall's face between two deeper stretches is filled: a black slot in the wall read as a
      // way in (the rock under it stays rock: the neighbours' depth is within AR.cliff, where nothing is open)
      for (const n of [1, 2, 3]) for (let x = 1; x + n < W; x++) { const lo = Math.min(cliff[x - 1], cliff[x + n]); let deep = true; for (let i = 0; i < n; i++) if (cliff[x + i] + 2 >= lo) deep = false;
        if (deep) for (let i = 0; i < n; i++) { let f = 0; while (f < H && !open(x + i, f)) f++; cliff[x + i] = Math.min(lo, f); } }
      const d = new Int8Array(W * H).fill(99), q = []; for (let k = 0; k < W * H; k++) if (open(k % W, Math.floor(k / W))) { d[k] = 0; q.push(k); }
      for (let i = 0; i < q.length; i++) { const k = q[i]; if (d[k] >= 30) continue; for (const o of D8) { const n = k + o; if (n >= 0 && n < W * H && Math.abs((n % W) - (k % W)) <= 1 && d[n] > d[k] + 1) { d[n] = d[k] + 1; q.push(n); } } }
      const held = (x, y) => y < cliff[x] + 1 || x < 2 || y < 3 || x > W - 3 || y > H - 3 || ring.has(y * W + x) || (Math.abs(x - shopR.cx) <= 5 && y >= shopR.y - 3 && y < shopR.y);
      const gap = (x, y) => [[1, 0], [0, 1]].some(([dx, dy]) => [1, -1].every((s) => { for (let i = 1; i < AR.channel; i++) if (at(x + dx * s * i, y + dy * s * i) === 1 && open(x + dx * s * i, y + dy * s * i)) return true; return false; }));
      const band = (x, y) => { const v = nz(x, y), t = AR.band; return v < t[0] ? 0 : v < t[1] ? 1 : v < t[2] ? 2 : 3; };
      // a plateau's floor (inside a room's box) is never lava; a ridge's or a ledge's spur may be, and is then crossed
      const boxed = new Uint8Array(W * H); for (const r of rooms) for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) boxed[y * W + x] = 1;
      // a boss's hall keeps the rock round it as the plateau archetype laid it: its doors and the trigger of its fight stand on that shape
      const arena = new Uint8Array(W * H); for (const r of rooms) if (r.type === 'boss') for (let y = r.y - 3; y <= r.y + r.h + 2; y++) for (let x = r.x - 3; x <= r.x + r.w + 2; x++) if (x >= 0 && y >= 0 && x < W && y < H) arena[y * W + x] = 1;
      const rock = (k) => cells[k] === 0 && !arena[k] && !held(k % W, Math.floor(k / W));
      const ridgeCell = (k) => cells[k] === 1 && !boxed[k] && !held(k % W, Math.floor(k / W)) && !hidden.has(k);
      // lakes: ragged blobs in the rock a few cells off the plateaus, spaced apart, basalt left standing in their middles
      const chasmF = ftype === 'chasm' || !!MIX, lakes = [], nLake = chasmF ? TY.lakes : Math.round(W * H / LV.lakeCells);
      if (fig) { const got = []; for (let k = 0; k < W * H; k++) if (fig[k] && rock(k)) { cells[k] = 3; got.push(k); } lakes.push({ cx: figAt[0], cy: figAt[1], cells: got, big: 1 });
        // the river runs along its length (the island splits it, a crossing spans it)
        if (riverY.length) for (const k of got) { const x = k % W, dy = riverY[Math.min(W - 1, x + 1)] - riverY[Math.max(0, x - 1)]; flow[k] = Math.abs(dy) > 2.2 ? (dy > 0 ? 1 : 3) : 0; }
        // a terrace floor's river runs down from its fall at the wall's foot
        if (terr) { for (const k of got) flow[k] = 1; const x = terr.fx - (terr.fw >> 1), y = cliff[terr.fx] + 1;
          if (cells[y * W + x] === 3) lavaFeatures.push({ kind: 'fall', cell: y * W + x, x: (x + 0.5) * TILE, y: y * TILE, w: terr.fw, wallY: y - 1 }); } }
      if (arenaLake.size) { const cols = [...arenaLake].filter((k) => !arenaSlabs.includes(k) && [-3, -2, 3, 4].includes(k % W - rooms[0].cx) && [0, 1].includes(Math.floor(k / W) - rooms[0].cy));
        for (const k of arenaLake) cells[k] = cols.includes(k) ? 0 : 3; for (const k of arenaSlabs) { cells[k] = 1; flow[k] = 0; }
        crossings.push({ kind: 'slabs', cells: arenaSlabs.slice(), axis: 'y', clean: 1 }); lavaBodies.push({ kind: 'lake', n: arenaLake.size }); }
      const lakeAt = (cx, cy) => { const rx = LV.lake[0][0] + P() * (LV.lake[0][1] - LV.lake[0][0]), ry = LV.lake[1][0] + P() * (LV.lake[1][1] - LV.lake[1][0]), ph = [0, 1, 2, 3].map(() => P() * 6.283), am = [0, 1, 2, 3].map((k) => (0.05 + 0.12 * P()) / (1 + 0.5 * k));
        const got = []; for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) { const k = y * W + x; if (x < 0 || y < 0 || x >= W || y >= H || !rock(k)) continue;
          const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, an = Math.atan2(v, u); let lim = 1.05; for (let i = 0; i < 4; i++) lim -= am[i] * (1 + Math.cos((i + 2) * an + ph[i])); if (Math.hypot(u, v) < lim) got.push(k); }
        return got; };
      const lakeSpots = []; for (let k = 0; k < W * H; k++) { const x = k % W, y = Math.floor(k / W); if (rock(k) && d[k] >= LV.lakeOff[0] && d[k] <= LV.lakeOff[1] && x > 6 && x < W - 7 && y > cliff[x] + 5 && y < H - 6) lakeSpots.push(k); }
      for (let i = 0; i < 60 && lakes.length < nLake && lakeSpots.length; i++) { const c = lakeSpots[Math.floor(P() * lakeSpots.length)], cx = c % W + 0.5, cy = Math.floor(c / W) + 0.5;
        if (lakes.some((L) => Math.hypot(L.cx - cx, L.cy - cy) < LV.lakeApart)) continue;
        const got = lakeAt(cx, cy); if (got.length < LV.lakeMin) continue;
        for (const k of got) cells[k] = 3; lakes.push({ cx, cy, cells: got }); }
      // a river walks the cheapest way from its source to a lake (or, with none to reach, out into the dark): rock near the plateaus
      // costs least, the far dark more, a ridge a lot (it will need a crossing), a plateau and the held rock can't be crossed
      const cost = (k) => { if (cells[k] === 3) return 0.4; if (ridgeCell(k)) return LV.ridgeCost; if (!rock(k)) return Infinity;
        return 1 + Math.max(0, d[k] - LV.near) * 0.35 + 4 * nzR(k % W, Math.floor(k / W)); };
      const route = (from, goal) => { const dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), heap = [[0, from]]; dist[from] = 0;
        const push = (e) => { heap.push(e); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
        const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
        while (heap.length) { const [c, k] = pop(); if (c > dist[k]) continue; if (k !== from && goal(k)) { const path = []; for (let j = k; j >= 0; j = prev[j]) path.push(j); return path.reverse(); }
          for (const o of D4) { const n = k + o; if (n < 0 || n >= W * H || Math.abs((n % W) - (k % W)) > 1) continue; const w = cost(n); if (w === Infinity || c + w >= dist[n]) continue; dist[n] = c + w; prev[n] = k; push([c + w, n]); } }
        return null; };
      // its bed: a square brush 2–4 cells wide wandering along the way; the lava runs the way it walks
      const DIR = { 1: 0, [W]: 1, [-1]: 2, [-W]: 3 }, cut = new Set();
      const river = (path, kind) => { let wd = pi(...LV.river), n = 0; const got = new Set();
        for (let i = 0; i < path.length; i++) { if (P() < 0.12) wd = Math.max(LV.river[0], Math.min(LV.river[1], wd + (P() < 0.5 ? -1 : 1)));
          const k = path[i], dir = DIR[(path[Math.min(i + 1, path.length - 1)] - path[Math.max(0, i - 1)]) / (i && i < path.length - 1 ? 2 : 1)] ?? DIR[path[i + 1] - k], x0 = k % W - (wd >> 1), y0 = Math.floor(k / W) - (wd >> 1);
          for (let j = 0; j < wd; j++) for (let ii = 0; ii < wd; ii++) { const c = (y0 + j) * W + x0 + ii; if (x0 + ii < 0 || x0 + ii >= W || y0 + j < 0 || y0 + j >= H) continue;
            if (ridgeCell(c)) { cut.add(c); if (dir !== undefined) flow[c] = dir; continue; }
            if (cells[c] !== 3 && !rock(c)) continue; if (cells[c] !== 3) n++; cells[c] = 3; got.add(c); if (dir !== undefined && !lakes.some((L) => L.set.has(c))) flow[c] = dir; } }
        lavaBodies.push({ kind, n }); return got; };
      for (const L of lakes) L.set = new Set(L.cells);
      const inLake = (k) => cells[k] === 3 && lakes.some((L) => L.set.has(k)), dark = (k) => rock(k) && d[k] >= LV.dark;
      // falls and breaches down the top wall, over rock clear of the plateaus a few rows down, spaced apart
      const tops = []; for (let x = 4; x < W - 6; x++) { const w0 = cliff[x], ok = [0, 1, 2].every((i) => cliff[x + i] === w0 && [1, 2, 3].every((j) => rock((w0 + j) * W + x + i) && d[(w0 + j) * W + x + i] >= 2)); if (ok) tops.push(x); }
      for (let i = tops.length - 1; i > 0; i--) { const j = Math.floor(P() * (i + 1)); [tops[i], tops[j]] = [tops[j], tops[i]]; }
      const nFall = pi(...LV.falls), heads = [];
      for (const x of tops) { if (heads.length >= nFall) break; if (heads.some((h) => Math.abs(h.x - x) < LV.fallApart)) continue;
        const w = pi(2, 3), kind = cliff[x] >= 4 && P() < 0.7 ? 'fall' : 'breach';
        // a fall's wall stands LV.fallDeep rows deeper, two columns past it each side where the rock allows (TASKS 452): the
        // reference's fall drops ≈ 178 px from a pool on the rock's top, and the plain wall left room for half of that
        if (kind === 'fall') { const w0 = cliff[x]; for (let i = x - 2; i <= x + w + 1; i++) if (i > 0 && i < W - 1 && cliff[i] <= w0 && Array.from({ length: LV.fallDeep }, (_, j) => w0 + 1 + j).every((y) => rock(y * W + i))) cliff[i] = w0 + LV.fallDeep; }
        heads.push({ x, y: cliff[x] + 1, w, kind }); }
      // a vent: a hot mouth in the open rock a few cells off a plateau, at the head of a river of its own
      const vents = lakeSpots.filter((k) => rock(k) && d[k] >= 3 && d[k] <= 5);
      for (let n = pi(...LV.vents), i = 0; n > 0 && i < 40 && vents.length; i++) { const k = vents[Math.floor(P() * vents.length)], x = k % W, y = Math.floor(k / W);
        if (heads.some((h) => Math.hypot(h.x - x, h.y - y) < 14) || lakes.some((L) => Math.hypot(L.cx - x, L.cy - y) < 10)) continue; heads.push({ x, y, w: 2, kind: 'vent' }); n--; }
      for (const h of heads) { const from = h.y * W + h.x; if (!rock(from)) continue;
        const path = route(from, lakes.length ? inLake : dark) || route(from, dark); if (!path || path.length < 6) continue;
        const got = river(path, 'river'); if (got.size < 8) continue;
        lavaFeatures.push({ kind: h.kind, cell: from, x: (h.x + 0.5) * TILE, y: h.kind === 'vent' ? (h.y + 0.5) * TILE : h.y * TILE, w: h.w, wallY: h.kind === 'vent' ? undefined : h.y - 1 });
        if (h.kind !== 'vent') for (let i = 1; i < h.w; i++) if (rock(from + i)) { cells[from + i] = 3; flow[from + i] = 1; } }
      // lakes join one another down rivers, each to its nearest that is not yet joined to it; a lake no river feeds wells from a vent
      if (lakes.length > 1) { const inT = new Set([0]); while (inT.size < lakes.length) { let best = null;
          for (const a of inT) for (let b = 0; b < lakes.length; b++) if (!inT.has(b)) { const dd = Math.hypot(lakes[a].cx - lakes[b].cx, lakes[a].cy - lakes[b].cy); if (!best || dd < best[2]) best = [a, b, dd]; }
          inT.add(best[1]); if (best[2] > LV.joinMax || P() > LV.join) continue;
          const A = lakes[best[0]], B = lakes[best[1]], path = route(A.cells[Math.floor(A.cells.length / 2)], (k) => B.set.has(k)); if (path) river(path, 'join'); } }
      for (const L of lakes) { const fed = lavaFeatures.some((f) => f.kind !== 'vent' && L.set.has(f.cell)) || [...L.set].some((k) => flow[k] !== undefined && D4.some((o) => flow[k + o] !== undefined && !L.set.has(k + o)));
        let c = null, best = -1; for (const k of L.cells) { const v = D8.filter((o) => L.set.has(k + o)).length + P(); if (v > best) { best = v; c = k; } }
        lavaBodies.push({ kind: 'lake', n: L.cells.length }); if (!fed && c !== null) lavaFeatures.push({ kind: 'vent', cell: c, x: (c % W + 0.5) * TILE, y: (Math.floor(c / W) + 0.5) * TILE, w: 2, lake: 1 }); }
      // basalt islands stand in the lakes' middles, two cells off their shore
      const isles = []; for (const L of lakes) for (const k of L.cells) { const x = k % W, y = Math.floor(k / W); let inner = true;
        for (let j = -2; j <= 2 && inner; j++) for (let i = -2; i <= 2; i++) if (cells[k + j * W + i] !== 3 || flow[k + j * W + i] !== undefined) { inner = false; break; }
        if (inner && nzI(x, y) > (fig && fig[k] ? AR.lake.islet : LV.isle) && !lavaFeatures.some((f) => Math.abs(f.cell % W - x) + Math.abs(Math.floor(f.cell / W) - y) < 3)) isles.push(k); }
      for (const k of isles) for (const o of [0, 1, W, W + 1]) if (cells[k + o] === 3 && flow[k + o] === undefined) cells[k + o] = 0;
      // (a boss's arena keeps two cells of dark round its box, TASKS 422: the hero may walk his tongues of lava, and from lava by its
      // edge he waded over to the next plateau, out of the sealed fight; past the first cell only a one-cell wall goes to lava)
      const bossR = rooms.find((r) => r.type === 'boss'), rim = (x, y, n) => !!bossR && x >= bossR.x - n && x < bossR.x + bossR.w + n && y >= bossR.y - n && y < bossR.y + bossR.h + n;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x; if (cells[k] || held(x, y) || rim(x, y, 2)) continue;
        if (!chasmF && (d[k] <= band(x, y) || gap(x, y)) && !(d[k] >= 2 && nzI(x, y) > AR.isle)) cells[k] = 3; }
      for (let pass = 0, n = 1; n && pass < 6; pass++) { n = 0;
        for (let y = 3; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { if (at(x, y) !== 0 || held(x, y) || rim(x, y, 1)) continue; const up = at(x, y - 1), dn = at(x, y + 1), lf = at(x - 1, y), rt = at(x + 1, y);
          if ((up && dn && (up === 3 || dn === 3)) || (lf && rt && (lf === 3 || rt === 3))) { cells[y * W + x] = 3; n++; continue; }
          for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const a = at(x + ox, y + oy), b = at(x + ox + 1, y + oy), c2 = at(x + ox, y + oy + 1), e = at(x + ox + 1, y + oy + 1);
            if (!a === !e && !b === !c2 && !a !== !b && [a, b, c2, e].includes(3)) { cells[y * W + x] = 3; n++; break; } } } }
      // where the rock kept is one cell thick over or under lava, that lava goes back to rock: the wall is two cells thick
      for (let y = 3; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (at(x, y) === 0 && held(x, y) && at(x, y - 1) && at(x, y + 1)) for (const yy of [y - 1, y + 1]) if (at(x, yy) === 3) cells[yy * W + x] = 0;
      // where a river cut a ridge, the shortest way over it is crossed: up to two cells a stone arch, to five basalt slabs or a chain
      // bridge, longer a bridge; a bridge that can't run straight onto both banks becomes slabs. The lava runs on under it
      // a ridge a river runs across stays as it was, a crossing over the river: its cells there, as many along the ridge as the river is
      // wide (the ridge's shape kept, so a body two cells wide still walks it)
      // the plateaus stand close (TASKS 422): a ridge's run over the lava channel between two of them (lava on both its flanks) is a crossing too, as the
      // reference has them (a bare strip of ground two cells long over the channel read as one plateau with a crack in it). The
      // lava under it runs along the channel
      const inBox = (k) => rooms.some((r) => k % W >= r.x && k % W < r.x + r.w && Math.floor(k / W) >= r.y && Math.floor(k / W) < r.y + r.h);
      const span = new Map();
      for (const k of keep) { if (cells[k] !== 1 || cut.has(k) || inBox(k) || hidden.has(k) || held(k % W, Math.floor(k / W))) continue;
        const past = (o) => { for (let i = 1, n = k + o; i <= 3; i++, n += o) if (cells[n] !== 1) return cells[n]; return 1; };
        const across = past(W) === 3 && past(-W) === 3, along = past(1) === 3 && past(-1) === 3; if (across || along) span.set(k, across ? 1 : 0); }
      // (a run that meets the lava only past a plateau's edge cells is no crossing)
      for (const k0 of span.keys()) { if (cut.has(k0)) continue; const cs = [k0], got = new Set(cs);
        for (let i = 0; i < cs.length; i++) for (const o of [1, -1, W, -W]) { const n = cs[i] + o; if (span.has(n) && !got.has(n)) { got.add(n); cs.push(n); } }
        if (cs.some((k) => [1, -1, W, -W].some((o) => cells[k + o] === 3))) for (const k of cs) { cut.add(k); if (flow[k] === undefined) flow[k] = span.get(k); } }
      const under = new Set([...cut, ...arenaSlabs]), seenC = new Set(), decked = new Set();
      for (const k0 of cut) { if (seenC.has(k0)) continue; let cs = [k0]; seenC.add(k0);
        for (let i = 0; i < cs.length; i++) for (const o of D4) { const n = cs[i] + o; if (cut.has(n) && !seenC.has(n)) { seenC.add(n); cs.push(n); } }
        // (a bridge laid before may have run its deck over this cut: those cells are its)
        cs = cs.filter((k) => !decked.has(k)); if (!cs.length) continue;
        const f = cs.map((k) => flow[k]).filter((v) => v !== undefined), hor = f.filter((v) => v % 2 === 1).length >= f.length / 2;
        const us = cs.map((k) => (hor ? k % W : Math.floor(k / W))), vs = cs.map((k) => (hor ? Math.floor(k / W) : k % W)), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs), len = u1 - u0 + 1;
        const at2 = (u, v) => (hor ? v * W + u : u * W + v);
        // a chain bridge (TASKS 401) is a straight deck two cells wide landing on floor at both ends: the two rows of the cut that
        // land soonest, the deck run on over the river to the floor; what the cut had off those rows goes back to lava. Kept only if
        // a body two cells wide still walks the floor
        let kind = len <= 2 ? (P() < 0.4 ? 'slabs' : 'arch') : 'slabs', deck = null;
        if (len >= 3 && P() < LV.bridge) for (let v = v0; v < v1 && !deck; v++) { let a = u0, b = u1;
          while (a > u0 - 4 && !(cells[at2(a - 1, v)] === 1 && cells[at2(a - 1, v + 1)] === 1 && !cut.has(at2(a - 1, v)) && !cut.has(at2(a - 1, v + 1)))) a--;
          while (b < u1 + 4 && !(cells[at2(b + 1, v)] === 1 && cells[at2(b + 1, v + 1)] === 1 && !cut.has(at2(b + 1, v)) && !cut.has(at2(b + 1, v + 1)))) b++;
          if (a <= u0 - 4 || b >= u1 + 4) continue; const ks = [];
          for (let u = a; u <= b; u++) for (const vv of [v, v + 1]) { const k = at2(u, vv); if (cells[k] === 1 && !cut.has(k)) continue; if (cells[k] !== 3 && !cut.has(k)) { ks.length = 0; break; } ks.push(k); }
          if (ks.length) deck = ks; }
        if (deck) { const c0 = cells.slice(), keepD = new Set(deck); for (const k of cs) if (!keepD.has(k)) cells[k] = 3; for (const k of deck) cells[k] = 1;
          if (narrowTo(cells, W, H, start.cy * W + start.cx, rooms.filter((r) => r.type !== 'secret').map((r) => r.cy * W + r.cx)).length) { for (let k = 0; k < W * H; k++) cells[k] = c0[k]; deck = null; }
          else { for (const k of cs) if (!keepD.has(k)) under.delete(k); for (const k of deck) { under.add(k); decked.add(k); } kind = 'bridge'; } }
        crossings.push({ kind, cells: deck || cs, axis: hor ? 'x' : 'y', clean: deck ? 1 : 0 }); }
      if (!crossCuts(W, H, cells, start.cy * W + start.cx, (k) => cells[k] === 1 || cells[k] === 4, (k) => cells[k] === 3, (k) => { cells[k] = 1; under.add(k); },
        (n) => (n <= 2 ? 'arch' : n <= 5 && P() < 0.5 ? 'slabs' : 'bridge'), 'slabs', 'arch', crossings)) return false;
      // the crossings laid last may take all the lava round an earlier one: it joins the crossing beside it (a bridge keeps its deck,
      // so by a bridge it is plain ridge again); a vent a crossing was laid over moves to the lava next to it, or goes
      for (let i = crossings.length - 1; i >= 0; i--) { const c = crossings[i]; if (c.cells.some((k) => D4.some((o) => cells[k + o] === 3))) continue;
        const own = new Set(c.cells), to = crossings.find((e) => e !== c && e.kind !== 'bridge' && e.cells.some((k) => D4.some((o) => own.has(k + o))));
        if (to) to.cells.push(...c.cells); else for (const k of c.cells) if (!crossings.some((e) => e !== c && e.cells.includes(k))) under.delete(k); crossings.splice(i, 1); }
      if (riverY.length) for (const c of crossings) if (c.cells.some((k) => fig[k])) c.river = 1;
      // (two to four places to cross the river, as selfCheck counts them: the ways laid over it may merge into one, 1 river floor in 13)
      if (riverY.length) { const xs = crossings.filter((c) => c.river).map((c) => c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length).sort((a, b) => a - b); let n = 0, last = -99;
        for (const x of xs) { if (x - last > 8) n++; last = x; } if (n < 2 || n > 4) return false; }
      for (let i = lavaFeatures.length - 1; i >= 0; i--) { const f = lavaFeatures[i]; if (cells[f.cell] === 3) continue;
        const k = (f.kind === 'vent' ? [1, -1, W, -W, 2, -2, 2 * W, -2 * W] : [1, -1, 2, -2]).map((o) => f.cell + o).find((n) => cells[n] === 3 && !under.has(n));
        if (k === undefined) { lavaFeatures.splice(i, 1); continue; } Object.assign(f, { cell: k, x: (k % W + 0.5) * TILE }); if (f.kind === 'vent') f.y = (Math.floor(k / W) + 0.5) * TILE; }
      // over the chasm (TASKS 429) a ridge is a narrow neck of rock with the dark on both sides; where a run of it four cells and more
      // is straight enough for a deck two cells wide landing on floor at both ends, it is a chain bridge instead, the rock under it gone
      // to the chasm (chasmUnder: walked, drawn as the dark under the planks); kept only if a body two cells wide still walks the floor
      if (chasmF) { const lowC = (k) => cells[k] === 0 && Math.floor(k / W) >= cliff[k % W] && !held(k % W, Math.floor(k / W)) && !hidden.has(k);
        // (a ridge here is all the floor off the plateaus' boxes, its ragged brush included)
        const sp = new Map(); for (let k = 0; k < W * H; k++) { if (cells[k] !== 1 || inBox(k) || under.has(k) || hidden.has(k) || held(k % W, Math.floor(k / W))) continue;
          sp.set(k, lowC(k - W) || lowC(k + W) ? 1 : 0); }
        const seen = new Set();
        for (const k0 of sp.keys()) { if (seen.has(k0)) continue; const cs = [k0]; seen.add(k0);
          for (let i = 0; i < cs.length; i++) for (const o of D4) { const n = cs[i] + o; if (sp.has(n) && !seen.has(n)) { seen.add(n); cs.push(n); } }
          const grp = new Set(cs), bx = cs.map((k) => k % W), by = cs.map((k) => Math.floor(k / W)), hor = Math.max(...bx) - Math.min(...bx) >= Math.max(...by) - Math.min(...by), at2 = (u, v) => (hor ? v * W + u : u * W + v);
          const us = cs.map((k) => (hor ? k % W : Math.floor(k / W))), vs = cs.map((k) => (hor ? Math.floor(k / W) : k % W)), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
          if (u1 - u0 + 1 < 4) continue; let deck = null;
          for (let v = v0; v < v1 && !deck; v++) { let a = u0, b = u1; const land = (u) => cells[at2(u, v)] === 1 && cells[at2(u, v + 1)] === 1 && !grp.has(at2(u, v)) && !grp.has(at2(u, v + 1));
            while (a > u0 - 4 && !land(a - 1)) a--; while (b < u1 + 4 && !land(b + 1)) b++; if (a <= u0 - 4 || b >= u1 + 4) continue; const ks = [];
            // (over its span only the dark or the ridge, and two cells of it either side, or a strip of rock a cell thick is left by it)
            const dark = (k) => lowC(k) || grp.has(k); let ok = true;
            for (let u = u0; u <= u1 && ok; u++) for (const vv of [v - 2, v - 1, v, v + 1, v + 2, v + 3]) if (!dark(at2(u, vv)) && !(vv >= v && vv <= v + 1 && cells[at2(u, vv)] === 1)) { ok = false; break; }
            // (nor, by its landings, a strip of rock a cell thick between it and a plateau's edge)
            for (let u = a; u <= b && ok; u++) for (const [s1, s2] of [[v - 1, v - 2], [v + 2, v + 3]]) if (dark(at2(u, s1)) && cells[at2(u, s2)] === 1 && !grp.has(at2(u, s2))) { ok = false; break; }
            if (!ok) continue;
            for (let u = a; u <= b; u++) for (const vv of [v, v + 1]) { const k = at2(u, vv); if (cells[k] === 1 && !grp.has(k)) continue; ks.push(k); }
            if (ks.length >= 8) deck = ks; }
          if (!deck || P() < TY.neck) continue; const c0 = cells.slice(), keepD = new Set(deck); for (const k of cs) if (!keepD.has(k)) cells[k] = 0; for (const k of deck) cells[k] = 1;
          if (narrowTo(cells, W, H, start.cy * W + start.cx, rooms.filter((r) => r.type !== 'secret').map((r) => r.cy * W + r.cx)).length) { for (let k = 0; k < W * H; k++) cells[k] = c0[k]; continue; }
          for (const k of deck) chasmUnder.add(k); crossings.push({ kind: 'bridge', cells: deck, axis: hor ? 'x' : 'y', clean: 1, chasm: 1 }); }
        if (crossings.filter((c) => c.chasm).length < (MIX && ftype === 'river' ? AR.blend.riverBridges : 2)) return false;
        // what a bridge left of its ridge off the way goes to the dark
        const sv = new Uint8Array(W * H), st = [start.cy * W + start.cx]; sv[st[0]] = 1;
        while (st.length) { const k = st.pop(); for (const o of D4) { const n = k + o; if (!sv[n] && (cells[n] === 1 || cells[n] === 4)) { sv[n] = 1; st.push(n); } } }
        for (let k = 0; k < W * H; k++) if (cells[k] === 1 && !sv[k] && !hidden.has(k)) cells[k] = 0;
        // and a cell of it left between the lava over and under it goes to lava (no strip of rock a cell thick)
        for (let k = W; k < W * (H - 1); k++) if (cells[k] === 0 && !held(k % W, Math.floor(k / W)) && cells[k - W] && cells[k + W] && (cells[k - W] === 3 || cells[k + W] === 3)) cells[k] = 3; }
      // a bridge's deck spans its cells along the way and stands on a post at each corner (TASKS 306's layout), some with a fire
      // a crossing laid where no ridge was cut would be a short cut: the walk to the stairs keeps its least (AR.path)
      { const dd = new Int32Array(W * H).fill(-1), qq = [start.cy * W + start.cx]; dd[qq[0]] = 0;
        for (let i = 0; i < qq.length; i++) for (const o of D4) { const n = qq[i] + o; if (dd[n] < 0 && (cells[n] === 1 || cells[n] === 4)) { dd[n] = dd[qq[i]] + 1; qq.push(n); } }
        if (far && dd[exitR.cy * W + exitR.cx] < pathMin) return false; }
      for (const c of crossings) { if (!c.chasm) c.lava = 1; if (c.kind !== 'bridge') continue; const hor = c.axis === 'x', us = c.cells.map((k) => (hor ? k % W : Math.floor(k / W))), vs = c.cells.map((k) => (hor ? Math.floor(k / W) : k % W));
        const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), lit = P() < 0.5 ? [] : [P() < 0.5 ? 0 : 1]; c.span = [u0, u1, v0]; c.posts = [];
        for (const e of [0, 1]) for (const side of [0, 1]) { const a = e ? (u1 + 1) * TILE - 6 : u0 * TILE + 6, b = side ? (v0 + 2) * TILE + 2 : v0 * TILE + 4;
          c.posts.push({ x: hor ? a : side ? (v0 + 2) * TILE + 4 : v0 * TILE - 4, y: hor ? b : a + (e ? 8 : 2), fire: lit.includes(e) ? 1 : 0, near: side }); } }
      lavaUnder.push(...under);
      // crust: a cell of lava on a bank, with floor on one side only and lava two cells deep behind it, where the noise lays a stretch
      // of it; never by a crossing or a source. It can't join two floors, so no way ever needs it
      const src = new Set(lavaFeatures.flatMap((f) => [f.cell, f.cell + 1, f.cell - 1, f.cell + W, f.cell - W]));
      for (let k = 0; k < W * H; k++) { if (cells[k] !== 3 || src.has(k) || nzC(k % W, Math.floor(k / W)) < LV.crust) continue; const x = k % W, y = Math.floor(k / W);
        const fl = D4.filter((o) => cells[k + o] === 1); if (!fl.length || fl.length > 2) continue; const o = fl[0], ox = o === 1 ? 1 : o === -1 ? -1 : 0, oy = o === W ? 1 : o === -W ? -1 : 0;
        // (and no floor for five cells behind it, nor by a boss's arena: the hero it breaks under wades out through the lava, and over
        // a narrow channel between the close-set plateaus, TASKS 422, he came out on the next one, out of a sealed arena too)
        const deep = (d) => [3, 4, 5].every((i) => cells[k - i * d] !== 1);
        if (cells[k - o] !== 3 || cells[k - 2 * o] !== 3 || held(x, y) || arena[k] || !deep(o)) continue;
        const o2 = fl[1], ox2 = o2 === 1 ? 1 : o2 === -1 ? -1 : 0, oy2 = o2 === W ? 1 : o2 === -W ? -1 : 0;
        if (o2 !== undefined && (o2 === -o || cells[k - o2] !== 3 || cells[k - 2 * o2] !== 3 || cells[k + o + o2] !== 1 || !deep(o2))) continue;
        let ok = true; for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1; i++) { const n = k + j * W + i; if (under.has(n) || (cells[n] === 1 && !((ox && i === ox) || (oy && j === oy) || (ox2 && i === ox2) || (oy2 && j === oy2)))) { ok = false; break; } }
        if (ok) crust.push(k); }
      // a straight edge left along rock laid after the walls were broken (a cache's block, an arena's rim; TASKS 422) gets a notch of
      // lava in its middle, where the rock behind it stays two cells thick (the merchant's corner and the caches keep theirs)
      const plain = (x, y) => (Math.abs(x - shopR.cx) <= 5 && y >= shopR.y - 2 && y <= shopR.y + 5) || hidden.has(y * W + x) || rim(x, y, 2) || held(x, y) || chasmUnder.has(y * W + x);
      for (let pass = 0; pass < 4; pass++) { const runs = straightRuns(cells, W, H, plain); if (!runs.length) break;
        for (const { x, y, dx, dy, nx, ny, n } of runs) { const mx = x + dx * (n >> 1) + nx, my = y + dy * (n >> 1) + ny;
          if (at(mx, my) !== 0 || (plain(mx, my) && !chasmF)) continue; const b1 = at(mx + nx, my + ny), b2 = at(mx + 2 * nx, my + 2 * ny);
          // (a strip of rock two cells thick with lava behind it is cut through, an inlet; one cell thick, its middle goes)
          // (over the chasm, TASKS 429, a knob of the plateau out into the dark instead: lava has no place there)
          if (chasmF) { const fx = mx - nx, fy = my - ny;
            if (b1 === 0 && b2 === 0 && !plain(mx, my) && !D4.some((o) => chasmUnder.has(my * W + mx + o))) cells[my * W + mx] = 1;
            else if (at(fx - nx, fy - ny) === 1 && at(fx - 2 * nx, fy - 2 * ny) === 1 && !keep.has(fy * W + fx) && !chasmUnder.has(fy * W + fx)) { const k = fy * W + fx; cells[k] = 0;
              // (never leaving a cell of floor by it on fewer than two others)
              if (D4.some((o) => cells[k + o] === 1 && D4.filter((p) => cells[k + o + p] === 1).length < 2)) cells[k] = 1; }
            // (and a gap too narrow for a knob, floor past it, takes a cell of lava as the plain floor's channels do)
            else if (!plain(mx, my) && b1 !== 1 && at(mx, my) === 0) cells[my * W + mx] = 3; }
          else if ((b1 === 0 && b2 === 0) || b1 === 3) cells[my * W + mx] = 3;
          else if (b1 === 0 && b2 === 3 && !plain(mx + nx, my + ny)) { cells[my * W + mx] = 3; cells[(my + ny) * W + mx + nx] = 3; } } }
      // on a lake floor (TASKS 427) rock the lava closes round (once every pass above has laid its lava) is a hole into the dark in the lake, not an island: it fills with lava
      if (fig) { const comp = new Int32Array(W * H).fill(-1);
        for (let k0 = 0; k0 < W * H; k0++) { if (cells[k0] !== 0 || comp[k0] >= 0 || held(k0 % W, Math.floor(k0 / W))) continue;
          const cs = [k0]; let shut = true; comp[k0] = k0;
          for (let i = 0; i < cs.length; i++) for (const o of D4) { const n = cs[i] + o, x = n % W, y = Math.floor(n / W);
            if (cells[n] === 3) continue; if (cells[n] !== 0 || held(x, y) || rim(x, y, 2)) { shut = false; continue; } if (comp[n] < 0) { comp[n] = k0; cs.push(n); } }
          if (shut) for (const k of cs) cells[k] = 3; } }
      for (let k = 0; k < W * H; k++) if (cells[k] === 3) lava.push([k % W, Math.floor(k / W)]);
      return true; };
    const water = [], waterFlow = {}, waterFeatures = [], waterBridges = [], wet = new Set(), crossings = [];
    const waterRng = mul32(seed ^ 0x211a73), wi = (a, b) => a + Math.floor(waterRng() * (b - a + 1));
    const addWater = (k, dir) => { if (!wet.has(k)) { wet.add(k); water.push(k); } if (dir >= 0) waterFlow[k] = dir; };
    // ---- the cave's water (TASKS 302). It comes from a source (a fall down a top wall, a breach in a side wall, a spring from under
    // the rock) and spreads in a ragged patch over part of a hall; lakes lie in the rock on the way from one hall to the next, and
    // streams join a hall's water to a lake. Water with no dry floor among its eight neighbours is deep (cell 6): no one walks or is
    // knocked into it, bolts fly over it, and shallows ring it wherever it meets the floor. Where deep water cuts a way, a crossing
    // is laid along the shortest line over it: an isthmus of shallows, a ford of stones or a plank bridge. Its own random stream, so
    // the rest of the floor is laid out as without it ----
    if (cave && !pl) {
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
        for (let k = 0; k < W * H; k++) deep[k] = wt[k] && (lc || !D8.some((d) => cells[k + d] === 1 && !wt[k + d])) ? 1 : 0;
        // up to two cells an isthmus of shallows, to five a ford or a plank bridge; with no way to land both rows, stepping stones
        // (in a lava cave, TASKS 431, all of it is lava: a stone arch over two cells, basalt slabs or a chain bridge over more)
        if (!crossCuts(W, H, cells, start.cy * W + start.cx, walk, (k) => deep[k], (k, kind) => { deep[k] = 0; if (kind !== 'neck') cross[k] = 1; },
          lc ? (n) => (n <= 2 ? 'arch' : n <= 5 && Q() < 0.6 ? 'slabs' : 'bridge') : (n) => (n <= 2 ? 'neck' : n <= 5 && Q() < 0.6 ? 'ford' : 'bridge'), lc ? 'slabs' : 'ford', lc ? 'arch' : 'neck', crossings)) return false;
        // every deep pool has a shore of shallows
        const seen = new Uint8Array(W * H);
        if (!lc) for (let k0 = 0; k0 < W * H; k0++) { if (!deep[k0] || seen[k0]) continue; const st = [k0]; seen[k0] = 1; let shore = false;
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
      const goal = lc ? TY.goal[0] + (TY.goal[1] - TY.goal[0]) * Q() : 0.2 + 0.1 * Q(), least = lc ? TY.goal[0] * 0.6 : 0.15, more = lc ? TY.goal[0] : 0.17;
      let nLake = 2 + (W * H > 4800 ? 1 : 0) + (Q() < 0.5 ? 1 : 0);
      for (const e of shuffle(edges.slice())) { if (nLake <= 0 || share() >= goal * 0.7) break; if (tryBody(() => lake(e))) nLake--; }
      let nPool = 0;
      for (const r of shuffle(rooms.filter((q) => !q.pocket && ['combat', 'exit', 'treasure', 'shrine'].includes(q.type)))) { if (nPool >= (lc ? TY.pools : 6) || share() >= goal) break; if (tryBody(() => pool(r))) nPool++; }
      let nStream = 0; for (const P of bodies.filter((q) => q.kind === 'pool')) { if (nStream >= (lc ? 3 : 2)) break; if (tryBody(() => stream(P))) nStream++; }
      for (const P of bodies.filter((q) => q.kind === 'lake')) { if (nStream >= 1) break; if (tryBody(() => stream(P))) nStream++; }
      // a floor still short of water gets more lakes, then more pools, a second one in a hall too
      for (let round = 0; round < 2; round++) { for (const e of shuffle(edges.slice())) { if (share() >= more) break; tryBody(() => lake(e)); }
        for (const r of shuffle(rooms.filter((q) => !q.pocket && ['combat', 'exit', 'treasure', 'shrine'].includes(q.type)))) { if (share() >= more) break; tryBody(() => pool(r, lc ? 0 : 0.2)); } }
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
      if (!settle() || share() < least) return null;
      // a lava cave's water is lava, running where its streams ran; its crossings stand over the lava, its sources pour or well
      // lava (a fall down a top wall, a vent for a breach or a spring); its bodies are the lakes and rivers of the plateaus' lava
      if (lc) { for (let k = 0; k < W * H; k++) if (wt[k]) { if (cross[k]) { lavaUnder.push(k); if (flowW[k] >= 0) flow[k] = flowW[k]; }
          else { cells[k] = 3; if (flowW[k] >= 0) flow[k] = flowW[k]; } }
        for (const c of crossings) c.lava = 1;
        // (a crossing that took all the lava by it joins the one beside it, or is plain floor)
        for (let i = crossings.length - 1; i >= 0; i--) { const c = crossings[i]; if (c.cells.some((k) => D4.some((o) => cells[k + o] === 3))) continue;
          const own = new Set(c.cells), to = crossings.find((e) => e !== c && e.kind !== 'bridge' && e.cells.some((k) => D4.some((o) => own.has(k + o))));
          if (to) to.cells.push(...c.cells); else for (const k of c.cells) { const j = lavaUnder.indexOf(k); if (j >= 0 && !crossings.some((e) => e !== c && e.cells.includes(k))) lavaUnder.splice(j, 1); } crossings.splice(i, 1); }
        for (const q of waterFeatures) { const y = Math.floor(q.cell / W), x = q.cell % W; if (cells[q.cell] !== 3) continue;
          lavaFeatures.push(q.kind === 'waterfall' ? { kind: 'fall', cell: q.cell, x: (x + 0.5) * TILE, y: y * TILE, w: 1, wallY: y - 1 } : { kind: 'vent', cell: q.cell, x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, w: 2 }); }
        waterFeatures.length = 0; for (const b of bodies) lavaBodies.push({ kind: b.kind === 'stream' ? 'river' : 'lake', n: b.cells.length }); }
      else for (let k = 0; k < W * H; k++) if (wt[k]) { if (deep[k]) { cells[k] = 6; if (flowW[k] >= 0) waterFlow[k] = flowW[k]; } else if (!cross[k]) addWater(k, flowW[k]); }
      if (!lc) for (const c of crossings) if (c.kind === 'ford') waterBridges.push(...c.cells);
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
    const serpentPools = [], floodCells = [];
    if (bossType === 'boss_serpent') {
      for (const [dx, dy] of [[0, -3], [-5, 2], [4, 2]]) {
        const cx = exitR.cx + dx, cy = exitR.cy + dy, body = [];
        for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) {
          if (Math.hypot((x - cx) / 3, (y - cy) / 2.3) > 1) continue;
          const k = y * W + x; set(x, y, 1); body.push(k); addWater(k);
        }
        const pool = new Set(body), deep = body.filter((k) => [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].every((d) => pool.has(k + d)));
        if (deep.length < 2) return null;
        for (const k of deep) { cells[k] = 6; wet.delete(k); water.splice(water.indexOf(k), 1); }
        serpentPools.push(deep);
      }
      for (let y = exitR.y + 1; y < exitR.y + exitR.h - 1; y++) for (let x = exitR.x + 1; x < exitR.x + exitR.w - 1; x++) {
        const k = y * W + x;
        if (at(x, y) === 1 && !wet.has(k) && Math.hypot(x - exitR.cx, y - exitR.cy - 4) > 2 && [1, -1, W, -W].some((d) => wet.has(k + d))) floodCells.push(k);
      }
      tidy();
      for (let pass = 0; pass < 8; pass++) { const runs = straightRuns(cells, W, H, shopCorner); if (!runs.length) break;
        for (const q of runs) { const x = q.x + q.dx * (q.n >> 1) + q.nx, y = q.y + q.dy * (q.n >> 1) + q.ny; set(x, y, 1); }
        tidy();
      }
      if (!connected()) return null;
    }
    // ---- secret rooms: anywhere off a straight stretch of wall (a room's or a corridor's, any side but the shop's), a small room
    // behind a two-cell-thick fake wall (cell 4: solid, drawn as rock, breaks under blows) and a short passage. How many is
    // left to chance (1–10, fewer when the rock has no room for them; none at all only on the boss's floor, and rarely), so the
    // player never knows when a floor is cleaned out ----
    const secrets = [], onWater = new Set([...wet, ...crossings.flatMap((c) => c.cells)]);
    // the rock a fall pours down or a spring comes out of is no secret's
    const srcRock = new Set(waterFeatures.filter((q) => q.dir).flatMap((q) => { const b = { u: -W, d: W, l: -1, r: 1 }[q.dir]; return [q.cell + b, q.cell + 2 * b, q.cell + b - 1, q.cell + b + 1, q.cell + b - W, q.cell + b + W]; }));
    const secretsWanted = boss && R() < 0.06 ? 0 : Math.min(10, Math.max(1, Math.round((1 + Math.floor(Math.pow(R(), 1.8) * 10)) * (ST.secretK || 1))));
    { const want = secretsWanted, DIRS = [[0, -1, 'u'], [0, 1, 'd'], [-1, 0, 'l'], [1, 0, 'r']];
      const shopRoom = rooms.find((q) => q.type === 'shop');
      const inShop = (x, y) => x >= shopRoom.x - 1 && x <= shopRoom.x + shopRoom.w && y >= shopRoom.y - 1 && y <= shopRoom.y + shopRoom.h;
      const rockAt = (x, y) => x >= 2 && y >= (pl ? 0 : 3) && x <= W - 3 && y <= H - 3 && at(x, y) === 0 && !srcRock.has(y * W + x);
      for (let k = 0; k < 8000 && secrets.length < want; k++) {
        // (a plateau's caches are sought only along the wall's foot, the rows a host floor under it can stand on)
        const hx = ri(2, W - 3), hy = pl ? ri(AR.cacheRows + 5, AR.cliff) : ri(3, H - 3), [dx, dy, dir] = DIRS[pl ? 0 : Math.floor(R() * 4)], px = dy ? 1 : 0, py = dx ? 1 : 0;
        // (depth, lateral) → cell: depth runs from the host floor (0) into the rock, lateral 0–1 is the two-cell-wide opening
        const C = (d, l) => [hx + dx * d + px * l, hy + dy * d + py * l];
        const all = (d0, d1, l0, l1, f) => { for (let d = d0; d <= d1; d++) for (let l = l0; l <= l1; l++) if (!f(...C(d, l))) return false; return true; };
        // a straight stretch of wall with open floor in front of it, clear of the shop; a side passage keeps two cells of rock above and
        // below its fake wall, or, broken, it leaves a one-cell strip of wall hanging over the next floor (TASKS 178)
        // (a cave's walls bend every few cells: there the floor has to be open only before the two-cell opening itself)
        if (!all(-1, 0, cave ? 0 : -1, cave ? 1 : 2, (x, y) => at(x, y) === 1 && !inShop(x, y) && !onWater.has(y * W + x) && !(cave && rooms.some((q) => q.type === 'secret' && x >= q.x - 1 && x <= q.x + q.w && y >= q.y - 1 && y <= q.y + q.h)) && !(boss && x >= exitR.x && x < exitR.x + exitR.w && y >= exitR.y && y < exitR.y + exitR.h)) || !all(-1, 0, -1, 2, (x, y) => !inShop(x, y)) || !all(1, 2, dx ? -2 : -1, dx ? 3 : 2, rockAt)) continue;   // the whole front (below) off the shop: a cave checks only the opening's floor
        const plen = ri(0, 2), D = ri(3, 5), S = ri(3, 6), l0 = -ri(0, S - 2), d0 = 3 + plen, d1 = d0 + D - 1;
        if (plen && !all(3, 2 + plen, -2, 3, rockAt)) continue;
        const [ax, ay] = C(d0, l0), [bx, by] = C(d1, l0 + S - 1), rx = Math.min(ax, bx), ry = Math.min(ay, by), rw = Math.abs(bx - ax) + 1, rh = Math.abs(by - ay) + 1;
        let ok = true; for (let y = ry - 3; y <= ry + rh + 1 && ok; y++) for (let x = rx - 2; x <= rx + rw + 1; x++) if (!rockAt(x, y)) { ok = false; break; }
        // a plateau arena's box is mostly rock round its blob: a cache dug beside it would read as a way into it and take a door
        if (plat && boss && rx - 2 <= exitR.x + exitR.w && rx + rw + 2 >= exitR.x && ry - 2 <= exitR.y + exitR.h && ry + rh + 2 >= exitR.y) ok = false;
        // nor in a lake's rock (TASKS 427): it all goes to lava, and a block of dark left standing in it gave the cache away
        if (figHit(rx - 2, ry - 2, rw + 4, rh + 4)) ok = false;
        // (never off another cache: its tell's cells took the one cell its chest stands on)
        if ((roomOf(hx, hy) || {}).type === 'secret') ok = false;
        // a plateau's cache is dug up into the top wall (TASKS 425): solid rock over it up to the map's edge, the wall coming down
        // to the plateau there (within AR.cliff rows), so the wall it hides in is the wall the floor has anyway
        // (and the plateau under every column of it and one past each side, or the wall would hang down to it as a block of its own)
        if (pl && ok) { const x0 = Math.min(rx, hx) - 2, x1 = Math.max(rx + rw, hx + 2) + 1; if (hy > AR.cliff) ok = false;
          for (let y = 0; y < hy && ok; y++) for (let x = x0; x <= x1; x++) if (!rockAt(x, y)) { ok = false; break; }
          for (let x = x0 - 1; x <= x1 + 1 && ok; x++) { let y = 1; while (y <= AR.cliff && at(x, y) === 0) y++; if (y > AR.cliff) ok = false; } }
        // (the magma caves' caches are rewards off the way, TASKS 433: the first half of the tries look off it only, and past them one
        // is dug from a plateau the walk crosses, a second only with four off it)
        if (plat && way.has((roomOf(hx, hy) || {}).id)) { const on = secrets.filter((q) => way.has(q.host)).length; if (k < 4000 || (on && 3 * (on + 1) > secrets.length + 1)) ok = false; }
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
        secrets.push({ room: sr.id, dir, dx, dy, x: ex, y: ey, wall, hide, front, hp: 2, open: 0, kind, host: (roomOf(hx, hy) || {}).id }); } }
    // the arena's lake (TASKS 413), dug once the floor's shape and roles are set: an ellipse of rock in the ring's middle that the
    // lava fills (platLava), a few basalt columns left standing in it and a row of slabs over it the short way
    const arenaLake = new Set(), arenaSlabs = [];
    if (plat && boss) { const r = rooms[0], L = AR.arena, cx = r.cx + 0.5, cy = r.cy + 0.5;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (Math.hypot((x + 0.5 - cx) / L.lake[0], (y + 0.5 - cy) / L.lake[1]) < 1) { const k = y * W + x; cells[k] = 0; keep.delete(k); arenaLake.add(k); }
      for (let y = r.y; y < r.y + r.h; y++) for (const x of [r.cx, r.cx + 1]) { const k = y * W + x; if (arenaLake.has(k)) arenaSlabs.push(k); } }
    if (plat && !platLava()) return null;
    // (the way again over the lava's crossings: a lake's slabs and a river's fords bring its islands on to it)
    if (plat) way = wayRooms(cells, W, H, rooms, start.cy * W + start.cx, exitR.cy * W + exitR.cx);
    const secretFront = new Set(secrets.flatMap((q) => q.front.concat(q.wall).map(([x, y]) => y * W + x)));
    if (!D.BIOMES[biome].lava && !(last && boss) && !cave) {
      // (a stream runs down from a room's top wall the length of its box: a shaped room's wings and pit leave it neither, TASKS 374)
      const plain = (r) => !r.pit && !r.wings, candidates = rooms.filter((r) => r.type === 'combat' && plain(r) && !r.trap && !secrets.some((q) => q.front.some(([x, y]) => roomOf(x, y) === r)));
      for (let i = candidates.length - 1; i > 0; i--) { const j = wi(0, i); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
      let n = 0;
      for (const r of candidates.concat(rooms.filter((q) => q.type === 'combat' && plain(q) && !candidates.includes(q) && !secrets.some((s) => s.front.some(([x, y]) => roomOf(x, y) === q))))) {
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
    if (!cave) { const inAny = (x, y) => rooms.some((q) => inRm(q, x, y));
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
      // (a shaped room, TASKS 374, has ways in on its wings as well as its core: no doors, so no lock it leaks past)
      const cand = rooms.filter((r) => ['combat', 'treasure', 'shrine', 'exit'].includes(r.type) && !r.wings).map((r) => [r, doorsOf(r)]).filter(([, ds]) => ds);
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
    if (boss) {
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
      // a way into the arena wider than one door (a broad corridor, a room flush with it) takes a row of leaves side by side, read as
      // one doubled door (TASKS 355): such a floor is rolled again, as one with two plain doors that close (above); not in a cave, whose
      // arena edge is ragged rock (its leaves are a task of their own)
      const ad = doors.filter((d) => d.arena);
      if (strict && !cave && ad.some((d, i) => ad.some((o, j) => j > i && o.dir === d.dir && Math.abs(o.x - d.x) + Math.abs(o.y - d.y) < 4 * TILE))) return null;
    }
    // ---- contents ----
    // a cell next to a corridor mouth: any neighbour outside every room that is open floor
    const inRoom = (x, y) => rooms.some((q) => inRm(q, x, y));
    const doorway = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (at(x + i, y + j) === 1 && !inRoom(x + i, y + j)) return true; return false; };
    const used = new Set(), key = (x, y) => x + ',' + y;
    // the close-set plateaus' boxes reach over the rock between them (TASKS 422), so a cache may be dug inside one: its cells are
    // the cache's own, kept from whatever the plateau round it places (secOpen while the cache itself is furnished); its passage
    // too, or a hall's chest stood in it behind the fake wall (magma seed 4242 f3, TASKS 410)
    const secOwn = new Set(plat ? secrets.flatMap((q) => { const r = rooms[q.room], ks = q.hide.map((k) => key(k % W, Math.floor(k / W))); for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) ks.push(key(x, y)); return ks; }) : []);
    let secOpen = false;
    const free = (x, y, pad = 0) => { for (let j = -pad; j <= pad; j++) for (let i = -pad; i <= pad; i++) if (at(x + i, y + j) !== 1 || used.has(key(x + i, y + j)) || (!secOpen && secOwn.has(key(x + i, y + j)))) return false; return true; };
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
    const sx = exitR.cx, sy = exitR.cy + (boss ? (plat ? Math.ceil(AR.arena.lake[1]) + 2 : 4) : 0); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 2; i++) used.add(key(sx + i, sy + j));
    const exit = { x: sx * TILE + TILE, y: sy * TILE + TILE / 2, tx: sx, ty: sy };
    // the campaign's last floor (TASKS 354): beside the portal out, the stairs on down into the endless descent, shut till the
    // serpent falls; on open floor to the portal's right, else the spot of its room nearest the portal that has room (the altar
    // stands on its left)
    let down = null;
    if (fin && D.RUNS.campaign.then && D.runOf(opts.mode) === D.RUNS.campaign) for (const [dx, dy] of [[4, 0], [4, 1], [4, -1]].concat((() => { const c = [];
      for (let y = exitR.y; y < exitR.y + exitR.h; y++) for (let x = exitR.x; x < exitR.x + exitR.w; x++) { const d = Math.hypot(x - sx, y - sy); if (d >= 3.5) c.push([x - sx, y - sy, d]); }
      return c.sort((a, b) => a[2] - b[2]).map(([a, b]) => [a, b]); })())) {
      const x = sx + dx, y = sy + dy; let ok = true; for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1 && ok; i++) if (at(x + i, y + j) !== 1 || used.has(key(x + i, y + j)) || wet.has((y + j) * W + x + i)) ok = false;
      if (ok) { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) used.add(key(x + i, y + j)); down = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, tx: x, ty: y }; break; } }
    // the stairs back up (R-19, TASKS 1027), only in a run through the town for now: in the start room, best just above the bonfire,
    // on three by three clear dry cells (the steps on the upper two, the hero steps off them onto the lowest)
    let up = null;
    for (let j = -1; j <= 3; j++) for (let i = -1; i <= 1; i++) used.add(key(start.cx + i, start.cy + j));   // reserved before the steps so that their 3x3 footprint cannot cover them
    // (a small start room may have no such spot: then the nearest one round it, a few cells out)
    if (opts.town) { const cand = []; for (let y = start.y - 6; y < start.y + start.h + 6; y++) for (let x = start.x - 6; x < start.x + start.w + 6; x++) { const dx = x - start.cx, dy = y - start.cy;
        const inside = x >= start.x && x < start.x + start.w && y >= start.y && y < start.y + start.h;
        cand.push([x, y, (inside ? 0 : 20) + (dy < 0 ? 0 : 4) + Math.hypot(dx, dy + 2.5)]); }
      for (const [x, y] of cand.sort((a, b) => a[2] - b[2])) { let ok = true; for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1 && ok; i++) if (at(x + i, y + j) !== 1 || used.has(key(x + i, y + j)) || wet.has((y + j) * W + x + i)) ok = false;
        // (and no chest a step off them: E by the steps opened it, not the way up, TASKS 373's small start rooms put them out among the rooms)
        if (ok) { for (let j = -2; j <= 3; j++) for (let i = -2; i <= 2; i++) used.add(key(x + i, y + j)); up = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, tx: x, ty: y }; break; } } }
    const kf = Math.min(ST.n, floor + ST.early), roster = D.rosterAt(biome, kf), lvl = depth;
    const bridged = new Set(crossings.flatMap((c) => c.cells));
    const shallowIn = (r) => { const c = water.filter((k) => { const x = k % W, y = Math.floor(k / W); return at(x, y) === 1 && !bridged.has(k) && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
        && !enemies.some((e) => Math.hypot(e.x - wx(x), e.y - wy(y)) < 2 * TILE); });
      if (!c.length) return null; const k = c[Math.floor(R() * c.length)]; return [k % W, Math.floor(k / W)]; };
    // an eel's post (TASKS 310): a cell of the room's deep water with shallows or floor within two cells, so it can come up by a shore,
    // in a body of deep water of at least EEL_MIN cells, so it has somewhere else to come up
    const EEL_MIN = 12, deepN = new Map(), deepSize = (k0) => { if (deepN.has(k0)) return deepN.get(k0); const seen = [k0], q = [k0], got = new Set(q);
      while (q.length) { const k = q.pop(); for (const d of [1, -1, W, -W]) if (cells[k + d] === 6 && !got.has(k + d)) { got.add(k + d); seen.push(k + d); q.push(k + d); } }
      for (const k of seen) deepN.set(k, seen.length); return seen.length; };
    const deepIn = (r) => { const c = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (at(x, y) === 6 && deepSize(y * W + x) >= EEL_MIN && !enemies.some((e) => Math.hypot(e.x - wx(x), e.y - wy(y)) < 3 * TILE)) {
        let shore = false; for (let j = -2; j <= 2 && !shore; j++) for (let i = -2; i <= 2; i++) if (at(x + i, y + j) === 1) { shore = true; break; }
        if (shore) c.push([x, y]); }
      return c.length ? c[Math.floor(R() * c.length)] : null; };
    const addEnemy = (type, x, y, room, elite = 0) => enemies.push({ type, x: wx(x), y: wy(y), room, elite });
    // the caves' packs by role (data.js CAVE_PACKS, TASKS 312). The way the hero comes into a hall is its cell nearest the start
    // (on foot, round the deep water); a crab stands two to four steps on from it, the shooters the farthest on that the hall goes
    const CP = D.CAVE_PACKS, has = (t) => roster.includes(t);
    const fromStart = cave ? (() => { const dist = new Int32Array(W * H).fill(-1), q = [start.cy * W + start.cx]; dist[q[0]] = 0;
      for (let i = 0; i < q.length; i++) for (const d of [1, -1, W, -W]) { const n = q[i] + d; if (dist[n] < 0 && cells[n] === 1) { dist[n] = dist[q[i]] + 1; q.push(n); } }
      return dist; })() : null;
    const cavePack = (r, n, guard) => {
      const inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, open = [];
      for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (free(x, y) && !doorway(x, y) && fromStart[y * W + x] >= 0) open.push([x, y]);
      let way = null; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * W + x; if (fromStart[k] >= 0 && (!way || fromStart[k] < fromStart[way])) way = k; }
      const take = (c) => { const i = Math.floor(R() * c.length), p = c[i]; if (!p) return null; used.add(key(p[0], p[1])); open.splice(open.indexOf(p), 1); return p; };
      const fs = (p) => fromStart[p[1] * W + p[0]] - fromStart[way], fresh = () => open.filter(([x, y]) => free(x, y));
      const near = () => { const c = fresh(); return take(c.filter((p) => fs(p) >= 2 && fs(p) <= 4)) || take(c.sort((a, b) => fs(a) - fs(b)).slice(0, 1)); };
      const back = () => { const c = fresh().sort((a, b) => fs(b) - fs(a)); return take(c.slice(0, Math.max(1, Math.ceil(c.length * 0.3)))); };
      const anywhere = () => take(fresh()), shore = shallowIn(r), old = (D.BIOMES[biome].old || CP.old).filter(has);
      const kinds = [['line', has('crab') && has('skel_archer') && way !== null ? CP.line : 0], ['shore', has('drowned') && shore ? CP.shore : 0], ['hall', has('slime') && r.w * r.h >= CP.hallArea ? CP.hall : 0], ['bones', CP.bones]];
      let roll = R() * kinds.reduce((a, k) => a + k[1], 0), kind = 'bones'; for (const [k, w] of kinds) { if (w && (roll -= w) < 0) { kind = k; break; } }
      const plan = [], oldOne = () => pick(old);
      if (kind === 'line') { const nc = n >= 5 ? 2 : 1, ns = Math.min(n - nc, n >= 4 ? 2 : 1); for (let i = 0; i < nc; i++) plan.push(['crab', near]);
        for (let i = 0; i < ns; i++) plan.push([i === 1 && has('skel_mage') && R() < 0.5 ? 'skel_mage' : 'skel_archer', back]); }
      else if (kind === 'shore') { for (let i = 0, k = Math.min(n, ri(1, 2)); i < k; i++) plan.push(['drowned', null]); }
      else if (kind === 'hall') { for (let i = 0, k = Math.min(n, ri(2, 3)); i < k; i++) plan.push(['slime', anywhere]); }
      if (has('skel_mage') && plan.length < n && kind !== 'line' && R() < 0.4) plan.push(['skel_mage', back]);
      else if (has('skel_archer') && plan.length < n && kind === 'bones' && R() < 0.3) plan.push(['skel_archer', back]);
      // the magma caves' packs (TASKS 412) take the place of the caves' roles and the old kinds' filling
      const MP = D.BIOMES[biome].packs && D[D.BIOMES[biome].packs];
      if (MP) { const opts = Object.values(MP).filter((P) => P.plan[0][0].some(has)); let roll = R() * opts.reduce((a, P) => a + P.w, 0), P = opts[opts.length - 1];
        for (const o of opts) if ((roll -= o.w) < 0) { P = o; break; }
        // bank (TASKS 407): a cell of the hall with lava within three but none beside it, the far side from the way in first; lava (408): a cell of open lava
        // (no crust, no bridge over it) at the hall's edge with its floor within two cells, the salamander's post
        const crustK = new Set(crust), lavaBy = (x, y) => { let by = false; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (at(x + i, y + j) === 3) { if (Math.abs(i) <= 1 && Math.abs(j) <= 1) return false; by = true; } return by; };
        const bank = () => { const c = fresh().filter(([x, y]) => lavaBy(x, y)).sort((a, b) => fs(b) - fs(a)); return take(c.slice(0, Math.max(1, Math.ceil(c.length * 0.5)))) || back(); };
        const lavaPost = () => { const c = [];
          for (let y = r.y - 2; y < r.y + r.h + 2; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++) { const k = y * W + x;
            if (at(x, y) !== 3 || crustK.has(k) || bridged.has(k) || enemies.some((e) => Math.hypot(e.x - wx(x), e.y - wy(y)) < 3 * TILE)) continue;
            let shore = false; for (let j = -2; j <= 2 && !shore; j++) for (let i = -2; i <= 2; i++) if (at(x + i, y + j) === 1 && inR(x + i, y + j)) { shore = true; break; }
            if (shore) c.push([x, y]); }
          return c.length ? c[Math.floor(R() * c.length)] : null; };
        const W2 ={ near, back, any: anywhere, bank, lava: lavaPost }; plan.length = 0;
        for (const [kinds, [lo, hi], where] of P.plan) { const ks = kinds.filter(has); if (!ks.length) continue; for (let i = 0, k = lo + Math.floor(R() * (hi - lo + 1)); i < k; i++) plan.push([pick(ks), W2[where]]); }
        const own = P.plan[0][1][0], last = P.plan[P.plan.length - 1], lk = last[0].filter(has);
        while (plan.length < n && lk.length) plan.push([pick(lk), W2[last[2]]]);
        if (plan.length > n) plan.length = Math.max(n, r.kind === 'ledge' ? 0 : own); }   // (a ledge, TASKS 432, may hold a lone one)
      const main = oldOne(); while (plan.length < n) plan.push([R() < 0.6 ? main : oldOne(), anywhere]);
      let first = true;
      for (const [type0, where] of plan) { let type = type0, p = null;
        if (ENEMIES[type].lurk) { p = shallowIn(r); if (!p) type = oldOne(); }
        // a salamander with no lava by the hall gives its place to another
        if (ENEMIES[type].kind === 'salamander') { p = (where || anywhere)(); if (!p) type = oldOne(); }
        if (!p) p = (where || anywhere)() || anywhere(); if (!p) break; if (ENEMIES[type].lurk) used.add(key(p[0], p[1]));
        addEnemy(type, p[0], p[1], r.id, (r.type === 'exit' && first && !(guard && depth <= 2)) || (depth >= 3 && R() < ST.elite) ? 1 : 0);
        if (r.type === 'exit' && first) enemies[enemies.length - 1].exit = 1; first = false; }
      // an eel in the hall's deep water, out of the count
      if (has('eel') && R() < CP.eel[kf - 1]) { const q = deepIn(r); if (q) addEnemy('eel', q[0], q[1], r.id); } };
    if (boss && !fin) claim(exitR.cx - 3, sy, 'altar');
    for (const r of rooms) if (r.type === 'shrine') claim(r.cx, r.cy, 'altar');   // the altar's cell first: props are placed around it
    // no corner of a room is left in the dark: while some floor cell lies outside every light's reach, light the cell
    // nearest to it, preferring a sconce on the top wall, then on a side wall, then a brazier, then candles
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const lightRoom = (r, extra, wallOnly) => {
      const inR = (o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= (r.y - 1) * TILE && o.y < (r.y + r.h) * TILE;
      const lights = torches.filter((t) => t.r === r.id).map((t) => [t.x, t.y, LIGHT_R[t.kind]])
        .concat(decor.filter((d) => LIGHT_R[d.n] && inR(d)).map((d) => [d.x, d.y, LIGHT_R[d.n]]), shrines.filter(inR).map((s) => [s.x, s.y, LIGHT_R.shrine]), extra);
      // (the fire stands 2 px lower than a cell's spot: a plateau's halls are wide enough for a cell to sit on that edge of its reach)
      if (r.id === start.id) lights.push([wx(start.cx), plat ? start.cy * TILE + TILE / 2 + 8 : wy(start.cy), LIGHT_R.fire]);
      // lava glows: every cell of it lights the floor around (the scene gives each one a light of its own)
      for (const [x, y] of lava) if (at(x, y) === 3 && x >= r.x - 4 && x < r.x + r.w + 4 && y >= r.y - 4 && y < r.y + r.h + 4) lights.push([wx(x), wy(y), LIGHT_R.lava]);
      // each floor cell's nearest light (as a share of its reach), kept up as lights are added: a plateau's lava is hundreds of them
      const open = []; for (const [bx, by, bw, bh] of rectsOf(r)) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (at(x, y) === 1) open.push([x, y]);
      const ox = open.map(([x]) => wx(x)), oy = open.map(([, y]) => wy(y));
      const near = new Float64Array(open.length).fill(Infinity), shine = ([lx, ly, lr]) => { const s = lr * TILE;
        // (a plateau's halls take hundreds of lava lights each: the square root is the cheaper sum there, TASKS 422)
        if (plat) for (let i = 0; i < open.length; i++) { const a = lx - ox[i], b = (ly - oy[i]) / 0.8, q = Math.sqrt(a * a + b * b) / s; if (q !== q || q < near[i]) near[i] = q; }
        else for (let i = 0; i < open.length; i++) { const q = Math.hypot(lx - ox[i], (ly - oy[i]) / 0.8) / s; if (q !== q || q < near[i]) near[i] = q; } };
      for (const l of lights) shine(l);
      // (a plateau is a hall up to four times the cave's, TASKS 422: four times the lights it may take)
      // (a plateau's cell no light can be set near, a corner by a crossing, is passed over for the next: the rest of the hall is
      // still lit, and the posts' torches or the next pass may reach it; it counts against the hall only if still dark at the end)
      const gave = new Set();
      for (let k = 0; k < (plat ? 48 : 12); k++) { let dark = null;
        for (let i = 0; i < open.length; i++) { const v = lights.length ? near[i] : 9; if (v > 1 && !gave.has(i) && (!dark || v > dark[2])) dark = [open[i][0], open[i][1], v, i]; }
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
        // a cave's walls run anywhere through its box: every wall its floor meets can carry a sconce. On the plateaus the lava is the
        // light and fire is people's: a sconce only by an altar (TASKS 404); the camp's fire and the merchant's lamps are their own
        const sconce = !plat || r.type === 'shrine';
        // (a shaped room's wings, TASKS 374, are lit as its core: a sconce on a wing's top wall, a brazier or candles on its floor)
        if (sconce) for (const [ty, sx0, sx1] of cave ? Array.from({ length: r.h }, (_, i) => [r.y + i, r.x, r.x + r.w]) : rectsOf(r).map(([a, b, c]) => [b, a, a + c])) for (let x = sx0; x < sx1; x++) if (!at(x, ty - 1) && at(x, ty) === 1 && !doorway(x, ty) && !tallAt(wx(x), ty, HANG.wall) && !doorTop(wx(x), ty, HANG.wall) && !torches.some((t) => t.kind === 'wall' && Math.abs(t.x - wx(x)) < 2 * TILE && Math.abs(t.y - ty * TILE) < TILE) && !decor.some((d) => d.n === 'banner' && Math.abs(d.x - wx(x)) < 1.5 * TILE && Math.abs(d.y - ty * TILE) < TILE))
          cand.push([x, ty, cave ? 4 : 0, { x: wx(x), y: ty * TILE - 26, kind: 'wall', r: r.id }]);
        const sides = cave ? Array.from({ length: r.w }, (_, i) => [[r.x + i, -1], [r.x + i, 1]]).flat() : [[r.x, -1], [r.x + r.w - 1, 1]];
        if (sconce) for (let y = r.y + 1; y < r.y + r.h; y++) for (const [x, s] of sides) if (!at(x + s, y) && (free(x, y) || shore.has(key(x, y)) || wet.has(y * W + x)) && !doorway(x, y))   // a sconce hangs on the wall: a lava shore or water under it is no matter
          cand.push([x, y, cave ? 4.5 : 0.5, { x: s < 0 ? x * TILE + 14 : (x + 1) * TILE - 14, y: y * TILE + 4, kind: 'wall', side: s, r: r.id, cell: [x, y] }]);
        if (!cave) for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (!wallOnly && free(x, y) && !doorway(x, y)) {
          if (r.type !== 'start' && roomy(x, y, 'brazier')) cand.push([x, y, 1.5, { x: wx(x), y: wy(y), kind: 'brazier', r: r.id, cell: [x, y], big: 1 }]);
          cand.push([x, y, 3, { x: wx(x), y: wy(y), n: 'candles', cell: [x, y] }]); }
        if (!cave && !wallOnly) for (const [bx, by, bw, bh] of r.wings || []) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (free(x, y) && !doorway(x, y) && N4.every(([dx, dy]) => at(x + dx, y + dy) !== 6)) {
          if (r.type !== 'start' && roomy(x, y, 'brazier')) cand.push([x, y, 1.5, { x: wx(x), y: wy(y), kind: 'brazier', r: r.id, cell: [x, y], big: 1 }]);
          cand.push([x, y, 3, { x: wx(x), y: wy(y), n: 'candles', cell: [x, y] }]); }
        const viable = cand.filter((c) => Math.hypot(c[3].x - wx(dark[0]), (c[3].y - wy(dark[1])) / 0.8) <= LIGHT_R[c[3].n || c[3].kind] * TILE);
        if (!viable.length) { if (!plat) return false; gave.add(dark[3]); k--; continue; }
        const best = viable.reduce((a, b) => (Math.hypot(b[0] - dark[0], b[1] - dark[1]) + b[2] < Math.hypot(a[0] - dark[0], a[1] - dark[1]) + a[2] ? b : a))[3];
        if (best.cell) { used.add(key(...best.cell)); if (best.big) claim(...best.cell, best.n || 'brazier'); }
        delete best.cell; delete best.big; if (best.n === 'shroom') best.n = R() < 0.55 ? 'shroom_a' : 'shroom_b';
        // the plateaus' ground glows from hot fissures where a cave's mushrooms grow, and its glass is obsidian (TASKS 405)
        if (plat && /^shroom_/.test(best.n)) best.n = 'vent_mg'; if (plat && best.n === 'crystal_cv') best.n = 'obsidian_mg';
        if (best.n) decor.push(best); else torches.push(best);
        lights.push([best.x, best.y, LIGHT_R[best.n || best.kind]]); shine(lights[lights.length - 1]); } return ![...gave].some((i) => near[i] > 1); };
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
      const kinds = r.type === 'boss' ? ['arena'] : r.type === 'start' ? ['store'] : r.type === 'boss' || r.type === 'shrine' ? ['hall', 'gallery', 'crypt', 'sanctum'] : Object.keys(D.ROOM_PLANS).filter((k) => k !== 'arena' && k !== 'colonnade');
      let fit = kinds.filter((k) => { const P = D.ROOM_PLANS[k]; return !P.magma && (!P.need.length || has(P.need).length); });   // the magma caves' halls are dressed by the cave's own pass
      if (r.zone === 'crypt' && fit.includes('crypt')) fit = ['crypt']; if (r.zone === 'arcane' && fit.includes('sanctum')) fit = ['sanctum'];
      if (r.shape === 'colonnade' && !['boss', 'shrine', 'start'].includes(r.type) && has(D.ROOM_PLANS.colonnade.need).length) fit = ['colonnade'];
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
      const fn = P.floor && (!busy || r.type === 'boss') && (P.floor.mode === 'colonnade' ? has(P.floor.n)[0] : has(P.floor.n)[R() < 0.5 ? 0 : has(P.floor.n).length - 1]);
      // (a colonnade, TASKS 374: two rows of pillars down its length, a pillar every third cell, the aisle and the walls' lanes open)
      if (fn && P.floor.mode === 'colonnade') { const hor = r.w >= r.h, L1 = hor ? r.x + r.w : r.y + r.h, lanes = hor ? [r.y + 2, r.y + r.h - 3] : [r.x + 2, r.x + r.w - 3];
        for (let t = (hor ? r.x : r.y) + 2; t < L1 - 2; t += 3) { const ps = lanes.map((l) => (hor ? [t, l] : [l, t]));
          if (ps.every(([x, y]) => free(x, y) && !doorway(x, y) && roomy(x, y, fn)) && keeps(ps)) for (const [x, y] of ps) putFloor(x, y, fn); } }
      else if (fn && r.w >= 7 && r.h >= 6) { const a0 = Math.max(2, Math.ceil((D.PROP_W[fn] + 4) / (2 * TILE))), x = Math.floor((c2 - 2 * a0) / 2), xm = c2 - x;
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
    for (const r of rooms) { if (r.type === 'shop') continue; secOpen = r.type === 'secret';
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
        // (a plateau's kind sets its share, TASKS 432: an arena holds more, a ledge with a hoard on it may hold none)
        const kp = r.kind && MX ? MX[r.kind].pop || 1 : 1;
        n = Math.max(r.kind === 'ledge' ? 0 : 1, Math.round(n * D.BAL.pop * ST.pop * (plat ? TY.pop : 1) * (LY ? LY.pop : 1) * kp));
        const pack = pick(roster), guard = r.type === 'exit' && !!ST.guard;
        if (cave) { if (n > 0) cavePack(r, n, guard); }
        else for (let i = 0; i < n; i++) { const p = spot(r, 1); if (!p) break;
          let type = R() < 0.6 ? pack : pick(roster); if (type === 'brute' && R() < 0.6) type = pack === 'brute' ? 'skeleton' : pack;
          // a drowned lies in the room's shallows (TASKS 307); a room with none takes another of the roster
          if (ENEMIES[type].lurk) { const q = shallowIn(r); if (q) { p[0] = q[0]; p[1] = q[1]; } else type = roster.find((o) => !ENEMIES[o].lurk && !ENEMIES[o].deep); }
          // an eel in its deep water; a room with none takes another
          if (ENEMIES[type].deep) { const q = deepIn(r); if (q) { p[0] = q[0]; p[1] = q[1]; } else type = roster.find((o) => !ENEMIES[o].lurk && !ENEMIES[o].deep); }
          // on floors 1–2 the guard is the exit's only elite: two at once killed before a potion could help
          addEnemy(type, p[0], p[1], r.id, (r.type === 'exit' && i === 0 && !(guard && depth <= 2)) || (r.courtElite && i === 0) || (depth >= 3 && R() < ST.elite) ? 1 : 0);
          if (r.type === 'exit' && i === 0) enemies[enemies.length - 1].exit = 1; }
        // a small exit room (the endless descent's first floors) may have no free cell two in from its walls: there (only there for now:
        // the campaign's 7th loses its guard the same way on ~4 seeds in 25, its balance measured so) one in, then any free cell, then any floor
        // but the stairs' (a crowded 7×5 exit room; the sim shoves a monster off a prop it grazes)
        if (guard) { const p = spot(r, 2) || (D.runOf(opts.mode).endless && (spot(r, 1) || (() => { for (const ok of [(x, y) => free(x, y) && !doorway(x, y), (x, y) => free(x, y), (x, y) => at(x, y) === 1 && !(x === exit.tx && y === exit.ty)])
          for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (ok(x, y)) { used.add(key(x, y)); return [x, y]; } return null; })())); if (p) { addEnemy('brute', p[0], p[1], r.id, 1); enemies[enemies.length - 1].guard = 1; } }
      }
      if (r.type === 'boss') { if (bossType === 'boss_serpent') { const k = serpentPools[0][0]; enemies.push({ type: bossType, x: wx(k % W), y: wy(Math.floor(k / W)), room: r.id, elite: 1 }); }
        // the colossus lies in its lake (TASKS 413), off the slab crossing on a side of its own, between the basalt columns and the shore
        else if (plat && D.ENEMIES[bossType].lake) enemies.push({ type: bossType, x: (r.cx + 1 + (R() < 0.5 ? -1 : 1) * 5.5) * TILE, y: (r.cy + 1) * TILE, room: r.id, elite: 1, lake: 1 });
        else addEnemy(bossType, r.cx, plat ? r.cy - Math.ceil(AR.arena.lake[1]) - 2 : r.cy - 3, r.id, 1);
        // the arena's cover (TASKS 413): basalt slabs round the ring's middle, clear of the lake, the ways in and the altar
        if (plat) { const L = AR.arena, a0 = R() * 6.283; let n = 0;
          for (let i = 0; i < 24 && n < L.cover; i++) { const a = a0 + i * 6.283 / L.cover + (i >= L.cover ? 0.3 : 0), rr = 0.62, x = Math.round(r.cx + 0.5 + Math.cos(a) * (L.lake[0] + (r.w / 2 - L.lake[0]) * rr) - 0.5), y = Math.round(r.cy + 0.5 + Math.sin(a) * (L.lake[1] + (r.h / 2 - L.lake[1]) * rr) - 0.5);
            if (!free(x, y, 1) || doorway(x, y) || Math.abs(x - sx) <= 2 && Math.abs(y - sy) <= 2) continue; claim(x, y, 'basalt_a'); decor.push({ x: wx(x), y: wy(y), n: n % 2 ? 'basalt_b' : 'basalt_a', solid: 1, r: r.id, cover: 1 }); n++; } } for (let i = 0; i < (bossType === 'boss' || bossType === 'boss_necro' ? Math.round(4 * D.BAL.pop) : 0); i++) { const p = spot(r, 2); if (p) addEnemy(bossType === 'boss_necro' ? 'skeleton' : pick(roster.filter((t) => t !== 'brute' && !ENEMIES[t].lurk && !ENEMIES[t].deep)), p[0], p[1], r.id); } }
      // chests
      // a locked room pays for its key: one chest of the secret rooms' tier and another of the hoards', often a heap of gold
      const nc = Math.min(1 + Math.floor(r.w * r.h / 30), r.locked ? 2 : r.type === 'treasure' ? 1 + (r.w * r.h >= 70 && R() < 0.4 ? 1 : 0) : r.type === 'secret' ? 1 : r.type === 'boss' ? 0 : r.type === 'start' ? (runFloor === 1 ? 1 : 0) : r.pocket && !cave ? (R() < 0.55 ? 1 : 0) : R() < 0.2 && !way.has(r.id) ? 1 : 0);
      for (let i = 0; i < nc; i++) { const p = i === 0 && first ? first : (r.type === 'secret' ? spot(r, 1, 0, true) : null) || wallSpot(r, 'chest') || spot(r, 1, 0, true); if (p) chests.push({ x: wx(p[0]), y: wy(p[1]), tier: r.type === 'secret' || (r.locked && i === 0) ? 3 : r.type === 'treasure' || r.locked || (r.pocket && !cave) ? 2 : 1, open: 0 }); }
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
    secOpen = false;
    // a river's ways over (TASKS 428) and the chasm's bridges (429) are where packs wait: on the bank past each one, two to seven steps on from its end, two of the
    // floor's kinds stand where none of the plateau's own pack does yet
    if (riverY.length || ftype === 'chasm' || MIX) { const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], dry = (x, y) => !N8.some(([i, j]) => at(x + i, y + j) === 3);
      const kinds = roster.filter((t) => !ENEMIES[t].lurk && !ENEMIES[t].deep && !D.BOSSES[t] && ENEMIES[t].kind !== 'salamander');
      for (const c of crossings) { if (!(c.river || c.chasm) || !kinds.length) continue; const own = new Set(c.cells);
        const ends = c.cells.flatMap((k) => [1, -1, W, -W].map((o) => k + o)).filter((k) => cells[k] === 1 && !own.has(k) && fromStart[k] >= 0);
        if (!ends.length) continue; const end = ends.reduce((a, b) => (fromStart[b] > fromStart[a] ? b : a)), ex = end % W, ey = Math.floor(end / W);
        if (enemies.some((e) => Math.hypot(e.x / TILE - ex, e.y / TILE - ey) < 5)) continue;
        const spots = []; for (let y = ey - 7; y <= ey + 7; y++) for (let x = ex - 7; x <= ex + 7; x++) { const k = y * W + x, d = fromStart[k] - fromStart[end];
          if (d >= 2 && d <= 7 && !own.has(k) && free(x, y) && dry(x, y) && !crossings.some((q) => q.cells.includes(k)) && !rooms.some((q) => (q.type === 'start' || q.type === 'shop') && x >= q.x - 1 && x <= q.x + q.w && y >= q.y - 1 && y <= q.y + q.h) && Math.hypot(x - start.cx, y - start.cy) > 12) spots.push([x, y]); }
        for (let i = 0; i < 2 && spots.length; i++) { const [x, y] = spots.splice(Math.floor(R() * spots.length), 1)[0]; used.add(key(x, y)); addEnemy(pick(kinds), x, y, (roomOf(x, y) || rooms.filter((q) => !['secret', 'start', 'shop'].includes(q.type)).reduce((a, q) => (Math.hypot(q.cx - x, q.cy - y) < Math.hypot(a.cx - x, a.cy - y) ? q : a))).id); enemies[enemies.length - 1].ford = 1; } } }
    if (boss && !fin) shrines.push({ x: wx(exitR.cx - 3), y: wy(sy), used: 0, boss: bossType });
    // the magma caves' elites and spoils (TASKS 433): an elite is a reward of the ways off the walk to the stairs, never met on it (the
    // stairs' own aside). As many as the floor's chance drew go to the dead ends with a pack and nothing else to win, one each, then
    // to the other rooms off the way; a dead end left with nothing gets a chest
    if (plat) { const hosts = new Set(secrets.map((q) => (roomOf(...q.front[0]) || {}).id)), inRm = (o, r) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= r.y * TILE && o.y < (r.y + r.h) * TILE;
      const drawn = enemies.filter((e) => e.elite && !e.exit && !e.guard && !D.BOSSES[e.type]); let n = drawn.length; for (const e of drawn) e.elite = 0;
      const paid = (r) => r.type !== 'combat' || hosts.has(r.id) || chests.some((c) => inRm(c, r)) || enemies.some((e) => e.elite && e.room === r.id);
      const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const ends = shuffle(rooms.filter((r) => deadEnd(r) && !way.has(r.id) && r.type === 'combat')), offWay = shuffle(rooms.filter((r) => !way.has(r.id) && r.type === 'combat' && !deadEnd(r)));
      for (const r of [...ends, ...offWay]) { if (n <= 0) break; const own = enemies.filter((e) => e.room === r.id && !e.ford); if (own.length && !(deadEnd(r) && paid(r))) { pick(own).elite = 1; n--; } }
      for (const r of [...ends, ...offWay]) { if (n <= 0) break; const own = enemies.filter((e) => e.room === r.id && !e.ford && !e.elite); if (own.length) { pick(own).elite = 1; n--; } }
      for (const r of ends) if (!paid(r)) { const p = wallSpot(r, 'chest') || spot(r, 1, 0, true); if (p) chests.push({ x: wx(p[0]), y: wy(p[1]), tier: 1, open: 0 }); } }
    // an eel in a lake between the halls (TASKS 312): one body of deep water out of every hall's box, by the floor's chance
    if (cave && roster.includes('eel')) { const inBox = (x, y) => rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h), lake = new Set();
      for (let k = 0; k < W * H; k++) { if (cells[k] !== 6 || lake.has(k) || inBox(k % W, Math.floor(k / W)) || deepSize(k) < EEL_MIN) continue;
        const body = [k], got = new Set(body); for (let i = 0; i < body.length; i++) for (const d of [1, -1, W, -W]) if (cells[body[i] + d] === 6 && !got.has(body[i] + d)) { got.add(body[i] + d); body.push(body[i] + d); }
        for (const q of body) lake.add(q); if (body.some((q) => inBox(q % W, Math.floor(q / W))) || R() >= D.CAVE_PACKS.lake[kf - 1]) continue;
        const c = body.filter((q) => { const x = q % W, y = Math.floor(q / W); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (at(x + i, y + j) === 1) return !enemies.some((e) => Math.hypot(e.x - wx(x), e.y - wy(y)) < 3 * TILE); return false; });
        if (c.length) { const q = c[Math.floor(R() * c.length)]; addEnemy('eel', q % W, Math.floor(q / W), -1); } } }
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
      const canStand = (x, y, n) => dry(x, y) && free(x, y) && !doorway(x, y) && roomyBy(x, y, n) && keepsWay(x, y) && !(at(x, y - 1) === 0 && hungAt(wx(x), y, half(n))) && !(plat && N8.some(([dx, dy]) => at(x + dx, y + dy) === 3));
      const stand = (x, y, n, r) => { claim(x, y, n); hardC.add(key(x, y)); decor.push({ x: wx(x), y: wy(y), n, solid: 1, r }); };
      const shuffled = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Dr() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const cellsOf = (r, f) => { const out = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (f(x, y)) out.push([x, y]); return shuffled(out); };
      // a pile of barrels and crates against the rock, read as one (they overlap on purpose)
      // on a plateau any edge but the lava's will do (nothing stands a cell from the lava: 186)
      const edgeN = (x, y) => (plat ? (N8.some(([dx, dy]) => at(x + dx, y + dy) !== 1) && !N8.some(([dx, dy]) => at(x + dx, y + dy) === 3) ? 1 : 0) : rockN(x, y));
      const stack = (r, near) => { const c0 = cellsOf(r, (x, y) => edgeN(x, y) >= 1 && dry(x, y) && free(x, y) && !doorway(x, y) && roomyCell(x, y) && keepsWay(x, y)).sort((a, b) => (near ? Math.hypot(a[0] - near[0], a[1] - near[1]) - Math.hypot(b[0] - near[0], b[1] - near[1]) : 0));
        for (const [x, y] of c0.slice(0, 12)) { const cs = [[x, y], ...N4.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => edgeN(a, b) >= 1 && dry(a, b) && free(a, b) && !doorway(a, b) && roomyCell(a, b))].slice(0, dri(2, 3));
          if (cs.length < 2 || cs.some(([a, b]) => wide.some(([ex, ey, eh]) => Math.abs(ey - b) <= 1 && Math.abs(ex - wx(a)) < eh + 28))) continue;
          const ok = []; for (const [a, b] of cs) { if (!keepsWay(a, b)) break; hardC.add(key(a, b)); ok.push([a, b]); } if (ok.length < 2) { for (const [a, b] of ok) hardC.delete(key(a, b)); continue; }
          stackN++; for (const [a, b] of ok) { used.add(key(a, b)); bulk.add(key(a, b)); pots.push({ x: wx(a), y: wy(b), kind: Dr() < 0.5 ? 'barrel' : 'crate', hp: 1, stack: stackN }); wide.push([wx(a), b, 24]); } return true; } return false; };
      const lie = (r, n, k, by) => { for (const [x, y] of cellsOf(r, (x, y) => dry(x, y) && free(x, y) && !doorway(x, y) && rockN(x, y) >= 1 && (!by || Math.hypot(x - by[0], y - by[1]) < 5)).slice(0, k)) {
        used.add(key(x, y)); decor.push({ x: wx(x) + dri(-6, 6), y: wy(y), n, f: Dr() < 0.5 ? 1 : 0, r: r.id }); } };
      // on the plateaus: basalt stumps and boulders, obsidian anywhere by the edge rather than by water (TASKS 405)
      const GEM = plat ? 'obsidian_mg' : 'crystal_cv';
      // a plateau's hall has its stumps out in the open too, the edge's first (TASKS 420)
      const rocks = (r, k, glass) => { let n = 0; const edge = cellsOf(r, (x, y) => rockN(x, y) >= 1 || N8.filter(([dx, dy]) => at(x + dx, y + dy) === 0).length >= 3);
        for (const [x, y] of plat ? [...edge, ...cellsOf(r, () => true)] : edge) { if (n >= k) break;
        const by = shoreAt(x, y), nm = glass && (plat || by) && Dr() < (plat ? 0.15 : 0.25) && !decor.some((d) => d.n === GEM && Math.hypot(d.x - wx(x), d.y - wy(y)) < 9 * TILE) ? GEM : pick4(); if (canStand(x, y, nm)) { stand(x, y, nm, r.id); n++; } } };
      const ROCKS = plat ? ['basalt_a', 'basalt_b', 'boulder_mg_a', 'boulder_mg_b', 'basalt_a', 'boulder_mg_b'] : ['stalag_a', 'stalag_b', 'boulder_a', 'boulder_b', 'stalag_a', 'boulder_b'], pick4 = () => ROCKS[Math.floor(Dr() * ROCKS.length)];
      const PK = plat ? 'magma' : 'cave', SKEL = plat ? 'skel_mg' : 'skel_cv', PB = D.BIOMES[plat ? 'magma' : 'cave'];
      const plans = Object.entries(D.ROOM_PLANS).filter(([, P]) => P[PK] && P.need.every((n) => PB.props.includes(n)));
      // a prop standing anywhere in the hall it can, the rock's edge first
      const standIn = (r, n, k) => { for (let i = 0; i < k; i++) { const c = [...cellsOf(r, (x, y) => rockN(x, y) >= 1), ...cellsOf(r, () => true)].find(([x, y]) => canStand(x, y, n)); if (c) stand(...c, n, r.id); } };
      for (const r of rooms) {
        if (r.type === 'shop' || r.type === 'secret' || r.type === 'boss') continue;
        if (r === start && plat) {
          // the cult's camp round the fire: its banners on their posts a few steps off, a pile of its barrels and crates, a cage,
          // the bones of whoever it burnt (TASKS 405)
          const fire = [start.cx, start.cy], ring = (n) => cellsOf(r, (x, y) => Math.hypot(x - fire[0], y - fire[1]) >= 2.5 && Math.hypot(x - fire[0], y - fire[1]) <= 5.5).find(([x, y]) => canStand(x, y, n));
          for (let i = 0; i < 2; i++) { const c = ring('banner_mg'); if (c) stand(...c, 'banner_mg', r.id); }
          stack(r, fire); if (Dr() < 0.5) { const c = ring('cage'); if (c) stand(...c, 'cage', r.id); } lie(r, 'skel_mg', Dr() < 0.5 ? 1 : 0, fire); lie(r, 'bones', dri(1, 2)); r.camp = 1;
          continue; }
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
        const want = plans.filter(([, P]) => !P[PK].wreck || cellsOf(r, (x, y) => shoreAt(x, y) && deepBy(x, y)).length);
        let roll = Dr() * want.reduce((a, [, P]) => a + P.w, 0), plan = want[0]; for (const q of want) { roll -= q[1].w; if (roll < 0) { plan = q; break; } }
        if (!plan) continue; const P = plan[1][PK], nOf = (v) => (Array.isArray(v) ? dri(v[0], v[1]) : v || 0), area = r.w * r.h; r.plan = plan[0];
        if (P.wreck) { const c = cellsOf(r, (x, y) => shoreAt(x, y) && deepBy(x, y)).find(([x, y]) => canStand(x, y, 'wreck_cv')); if (c) stand(...c, 'wreck_cv', r.id); }
        if (P.tent) { const c = cellsOf(r, (x, y) => at(x, y - 1) === 0).find(([x, y]) => canStand(x, y, 'tent_cv')); if (c) stand(...c, 'tent_cv', r.id); }
        if (P.banners) standIn(r, 'banner_mg', nOf(P.banners)); if (P.cages) standIn(r, 'cage', nOf(P.cages));
        rocks(r, Math.round(nOf(P.rocks) * Math.min(plat ? 2 : 1.5, area / 90)), true);
        for (let i = nOf(P.stacks); i > 0; i--) stack(r);
        lie(r, SKEL, nOf(P.skel)); lie(r, 'bones', nOf(P.bones));
        // the ref's plateaus are strewn with the dead: bones out on the open ground as well, never a cell from the lava (186)
        if (plat) for (const [x, y] of cellsOf(r, (x, y) => dry(x, y) && free(x, y) && !doorway(x, y) && !N8.some(([dx, dy]) => at(x + dx, y + dy) === 3)).slice(0, Math.round(area / 45))) {
          used.add(key(x, y)); decor.push({ x: wx(x) + dri(-8, 8), y: wy(y) + dri(-4, 4), n: Dr() < 0.2 ? SKEL : 'bones', f: Dr() < 0.5 ? 1 : 0, r: r.id }); } }
      if (plat) {
        // the altar of the cult: candles round it, a skull at its foot (the scene draws its circle on the floor)
        for (const s of shrines) for (const [dx, dy] of [[-44, 10], [44, 10], [-26, 34], [26, 34]]) if (Dr() < 0.8) { const x = Math.floor((s.x + dx) / TILE), y = Math.floor((s.y + dy) / TILE);
          if (at(x, y) === 1 && !doorway(x, y) && !N8.some(([ox, oy]) => at(x + ox, y + oy) === 3)) decor.push({ x: s.x + dx, y: s.y + dy, n: 'candles' }); }
        for (const s of shrines) { const x = s.x + dri(-30, 30), y = s.y + 40, tx = Math.floor(x / TILE), ty = Math.floor((y - 1) / TILE);
          if (![[0, 0], ...N8].some(([ox, oy]) => at(tx + ox, ty + oy) === 3)) decor.push({ x, y, n: 'bones', f: Dr() < 0.5 ? 1 : 0 }); }
        // torches on posts all over the plateaus, as the ref has them (TASKS 423, the player's call over 404's "fire only by people"):
        // by the drops first, then out in the hall, at least 4 cells apart and from any other fire; one to every 75 cells of a
        // plateau's floor (TASKS 422: its box's area put a grid of thirty in the plateaus grown to fill the frame, as many as 423's per cell)
        const fires = () => [...decor.filter((d) => d.n === 'torch_stand'), ...torches, ...shrines, { x: wx(start.cx), y: wy(start.cy) }];
        for (const r of rooms) { if (r.type === 'shop' || r.type === 'secret' || r.type === 'boss') continue; let k = Math.max(1, Math.round(cellsOf(r, (x, y) => at(x, y) === 1).length / 75));
          const drop = (x, y) => [[0, 2], [0, 1], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) !== 1);
          for (const [x, y] of [...cellsOf(r, drop), ...cellsOf(r, () => true)]) { if (k <= 0) break;
            if (!canStand(x, y, 'torch_stand') || fires().some((f) => Math.hypot(f.x - wx(x), f.y - wy(y)) < 4 * TILE)) continue; stand(x, y, 'torch_stand', r.id); k--; } }
        // chain fences on iron posts along some of the plateaus' front edges, over the lava or the chasm, 3 to 6 cells: a railing on the
        // very edge, so not held a cell off the lava as the props are (186); it is not solid and hides nothing
        for (const r of rooms) { if (r.type === 'shop' || r.type === 'secret' || r.type === 'boss' || Dr() > 0.55) continue;
          const runs = []; for (let y = r.y; y < r.y + r.h; y++) { let x0 = -1; for (let x = r.x; x <= r.x + r.w; x++) { const ok = x < r.x + r.w && at(x, y) === 1 && (at(x, y + 1) === 0 || at(x, y + 1) === 3) && at(x, y + 2) !== 1 && !over.has((y + 1) * W + x) && !hardC.has(key(x, y));
            if (ok && x0 < 0) x0 = x; if (!ok && x0 >= 0) { if (x - x0 >= 3) runs.push([x0, x, y]); x0 = -1; } } }
          if (!runs.length) continue; const [x0, x1, y] = runs[Math.floor(Dr() * runs.length)], n = Math.min(x1 - x0, dri(3, 6)), a = x0 + Math.floor(Dr() * (x1 - x0 - n + 1));
          decor.push({ x: a * TILE + 6, y: (y + 1) * TILE - 6, n: 'fence_mg', len: n * TILE - 12, r: r.id }); } }
      // more glowing mushrooms than the light needs, in clumps of two or three along the water's edge (the concept's banks glow)
      for (const r of rooms) { if (plat || r.type === 'shop' || r.type === 'secret') continue; let n = Math.round(r.w * r.h / 110);
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
        if (!plat && at(x, y) === 0 && (at(x, y + 1) === 1 || at(x, y + 1) === 6) && Dr() < 0.13 && !torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.x - wx(x)) < TILE && Math.abs(t.y + 26 - (y + 1) * TILE) < TILE)
          && !waterFeatures.some((q) => q.kind === 'waterfall' && Math.abs(q.x - wx(x)) < 2 * TILE && Math.abs(q.y - (y + 1) * TILE) < 2 * TILE))
          for (let i = dri(2, 4), x0 = wx(x) + dri(-4, 4); i > 0; i--) flora.push({ n: 'moss', x: x0 + dri(-9, 9), y: (y + 1) * TILE, f: Dr() < 0.5 ? 1 : 0, s: +(0.55 + 0.6 * Dr()).toFixed(2) }); } }
    // a cave's tunnels have a mushroom by the rock now and then, so a long way between halls is not one black stretch
    if (cave) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 1 && !inRoom(x, y) && free(x, y) && N4.some(([dx, dy]) => at(x + dx, y + dy) === 0) && R() < 0.035) {
      used.add(key(x, y)); const nm = R() < 0.55 ? 'shroom_a' : 'shroom_b'; decor.push({ x: wx(x), y: wy(y), n: plat ? 'vent_mg' : nm }); }
    // where the cave's roof drips (TASKS 305): a drop falls every p seconds from phase ph onto the floor or into the water; the
    // scene draws it and the sound plays its landing from the same schedule
    const drips = [];
    if (cave && !plat) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = at(x, y); if ((c !== 1 && c !== 6) || rooms.some((q) => q.type === 'secret' && x >= q.x - 1 && x <= q.x + q.w && y >= q.y - 1 && y <= q.y + q.h) || R() > 0.02) continue;
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
      const roomOf = (o) => rooms.find((q) => inRm(q, Math.floor(o.x / TILE), Math.floor(o.y / TILE)));
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
    { const inAny = (x, y, pad) => rooms.some((q) => inRm(q, x, y, pad));
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
    // or fire tears them. Ambushes no longer come from floor plates (TASKS 320): a chest in a treasure or secret room may spring one
    // (sim.js openChest), so `ambush` stays empty
    const webs = [], ambush = [];
    const trapCell = (x, y) => traps.some((t) => x >= t.x / TILE - 1 && x < t.x / TILE + 1 && y >= t.y / TILE - 1 && y < t.y / TILE + 1);
    const floorSpot = (r) => { for (let k = 0; k < 40; k++) { const x = ri(r.x + 1, r.x + r.w - 2), y = ri(r.y + 1, r.y + r.h - 2);
      if (free(x, y) && !solid.has(key(x, y)) && !doorway(x, y) && !trapCell(x, y)) { used.add(key(x, y)); return [x, y]; } } return null; };
    for (const r of rooms) { const sp = enemies.filter((e) => e.room === r.id && e.type === 'spider').length; if (!sp) continue;
      for (let i = 0, n = sp >= 2 ? ri(2, 3) : R() < 0.5 ? 1 : 0; i < n; i++) { const p = floorSpot(r); if (p) webs.push({ x: wx(p[0]), y: p[1] * TILE + TILE / 2, v: ri(0, 1), s: 0.9 + 0.3 * R(), f: R() < 0.5 ? 1 : 0, torn: 0 }); } }
    if (cave) {
      const mushrooms = decor.filter((d) => /^shroom_[ab]$/.test(d.n)), removed = new Set();
      for (const r of plat ? [] : rooms.filter((r) => r.type === 'combat' && r.id % 2 === 0 && r.w * r.h >= 56)) {
        const cand = [];
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          if (at(x, y) !== 1 || at(x, y - 1) !== 0 || doorway(x, y) || tallAt(wx(x), y, HANG.wall) || doorTop(wx(x), y, HANG.wall)) continue;
          const px = wx(x), py = y * TILE - 26;
          if (torches.some((t) => Math.hypot(t.x - px, t.y - py) < 4 * TILE)) continue;
          cand.push({ x: px, y: py, kind: 'wall', r: r.id });
        }
        cand.sort((a, b) => Math.hypot(a.x - wx(r.cx), a.y - wy(r.cy)) - Math.hypot(b.x - wx(r.cx), b.y - wy(r.cy)));
        if (cand.length) torches.push(cand[0]);
      }
      const floor = rooms.flatMap((r) => {
        const out = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (at(x, y) === 1) out.push([wx(x), wy(y)]); return out;
      });
      const fixed = torches.map((t) => [t.x, t.y, LIGHT_R[t.kind]]).concat(decor.filter((d) => LIGHT_R[d.n] && !mushrooms.includes(d)).map((d) => [d.x, d.y, LIGHT_R[d.n]]), shrines.map((q) => [q.x, q.y, LIGHT_R.shrine]));
      for (const d of mushrooms) {
        const near = floor.filter(([x, y]) => Math.hypot(x - d.x, (y - d.y) / 0.8) <= LIGHT_R[d.n] * TILE);
        const lights = fixed.concat(mushrooms.filter((q) => q !== d && !removed.has(q)).map((q) => [q.x, q.y, LIGHT_R[q.n]]));
        if (near.every(([x, y]) => lights.some(([lx, ly, r]) => Math.hypot(x - lx, (y - ly) / 0.8) <= r * TILE))) removed.add(d);
      }
      for (let i = decor.length - 1; i >= 0; i--) if (removed.has(decor[i])) decor.splice(i, 1);
    }
    if (cave) for (const d of decor) if (/^shroom_[ab]$/.test(d.n)) {
      const v = (Math.imul(Math.round(d.x), 73856093) ^ Math.imul(Math.round(d.y), 19349663)) >>> 0;
      d.s = [0.6, 0.8, 1][v % 3]; d.glow = 0.85 + (v % 5) * 0.05;
    }
    // start room: a sanctuary bonfire in the centre
    const sanct = { x: start.cx * TILE + TILE / 2, y: start.cy * TILE + TILE / 2 + 8 };
    torches.push({ x: sanct.x, y: sanct.y, kind: 'fire' });
    // the hero arrives below and beside the fire, not under it: straight below, its bowl sat on his head in the first frame of a floor
    const spawnOk = (dx, dy) => { const x = (start.cx + 0.5 + dx) * TILE, y = (start.cy + 0.5 + dy) * TILE;
      return [[x - 10, y], [x + 10, y], [x, y - 8]].every(([px, py]) => at(Math.floor(px / TILE), Math.floor(py / TILE)) === 1 && !solid.has(key(Math.floor(px / TILE), Math.floor(py / TILE)))) ? { x, y } : null; };
    // a small cave pocket may have none of those spots clear: then beside the fire, then the nearest open cell of the room. The old
    // last resort, straight below the fire, was a notch of rock in a 5×5 pocket and the hero arrived inside the wall (TASKS 335)
    const nearest = () => { let best = null; for (let y = start.y; y < start.y + start.h; y++) for (let x = start.x; x < start.x + start.w; x++) {
      const dx = x - start.cx, dy = y - start.cy, d = dx * dx + dy * dy; if (!d || (best && d >= best[0])) continue; const p = spawnOk(dx, dy); if (p) best = [d, p]; }
      return best && best[1]; };
    const spawn = [[1, 3], [-1, 3], [2, 2], [-2, 2], [1, 2], [-1, 2], [0, 2], [0, 1], [1, 1], [-1, 1], [2, 1], [-2, 1], [1, 0], [-1, 0], [2, 0], [-2, 0]].reduce((a, [dx, dy]) => a || spawnOk(dx, dy), null)
      || nearest() || { x: start.cx * TILE + TILE / 2, y: (start.cy + 1) * TILE + TILE / 2 };
    // flat floor decals (baked into the floor map): wear everywhere, a biome flavour per room, gore and coins where fights happen
    const DEC = { dungeon: ['dc_crack', 'dc_grime', 'dc_rubble', 'dc_slab', 'dc_straw', 'dc_shards', 'dc_leaves'], crypt: ['dc_moss', 'dc_bones', 'dc_crack', 'dc_grime', 'dc_puddle'],
      lava: ['dc_soot', 'dc_rubble', 'dc_crack', 'dc_slab', 'dc_soot'], arcane: ['dc_puddle', 'dc_crack', 'dc_grime', 'dc_slab'], cave: ['dc_moss', 'dc_pebbles', 'dc_rubble', 'dc_moss', 'dc_silt', 'dc_pebbles', 'dc_crack'],
      magma: ['dc_soot', 'dc_ash_mg', 'dc_crack', 'dc_splash_mg', 'dc_soot', 'dc_ash_mg', 'dc_rubble', 'dc_splash_mg'] };
    // a decal is drawn up to 40·s px across (scene.js bake, over the walls already painted): it shrinks until that square lies on
    // open floor, so no stone, rubbish or stain climbs a wall or spills onto the rock; one that would have to shrink past half is left out
    const decals = [], onFloor = (px, py, h) => { for (let y = Math.floor((py - h) / TILE); y <= Math.floor((py + h - 0.01) / TILE); y++) for (let x = Math.floor((px - h) / TILE); x <= Math.floor((px + h - 0.01) / TILE); x++) if (at(x, y) !== 1) return false; return true; };
    const fitDecal = (d) => { for (let s = d.s; s >= 0.5; s -= 0.05) if (onFloor(d.x, d.y, 20 * s)) { d.s = s; decals.push(d); return; } };
    for (const r of rooms) { const zb = r.zone || biome, n = Math.round(r.w * r.h / (plat ? 4 : 6));
      for (let i = 0; i < n; i++) { const x = r.x + R() * r.w, y = r.y + 0.5 + R() * (r.h - 0.5); if (at(Math.floor(x), Math.floor(y)) !== 1) continue;
        const fight = r.type === 'combat' || r.type === 'exit' || r.type === 'boss';
        const pool = (fight || r.type === 'treasure' || r.type === 'secret') && R() < 0.35 ? ['dc_blood', 'dc_blood2', 'dc_coins', 'dc_bones', 'dc_sword'] : DEC[zb];
        if (wet.has(Math.floor(y) * W + Math.floor(x))) continue; fitDecal({ x: x * TILE, y: y * TILE, n: pool[Math.floor(R() * pool.length)], f: R() < 0.5 ? 1 : 0, s: 0.8 + 0.5 * R() }); } }
    // the water leaves its silt, pebbles and puddles on the cave's banks (TASKS 306)
    if (cave) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 1 && !wet.has(y * W + x) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => wet.has((y + dy) * W + x + dx)) && R() < 0.3)
      fitDecal({ x: (x + 0.2 + 0.6 * R()) * TILE, y: (y + 0.2 + 0.6 * R()) * TILE, n: ['dc_silt', 'dc_pebbles', 'dc_silt', 'dc_puddle'][Math.floor(R() * 4)], f: R() < 0.5 ? 1 : 0, s: 0.7 + 0.4 * R() });
    // the plateaus' edges crumble (TASKS 420): rubble, ash and soot along every drop, so the ground thickens toward its columns as
    // the ref's does
    const underS = new Set(lavaUnder);
    if (plat) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 1 && !underS.has(y * W + x) && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x + dx, y + dy) === 0 || at(x + dx, y + dy) === 3)) && R() < 0.35)
      fitDecal({ x: (x + 0.2 + 0.6 * R()) * TILE, y: (y + 0.2 + 0.6 * R()) * TILE, n: ['dc_rubble', 'dc_ash_mg', 'dc_pebbles', 'dc_soot'][Math.floor(R() * 4)], f: R() < 0.5 ? 1 : 0, s: 0.6 + 0.4 * R() });
    // cobwebs: the sprite is spun across a top-left corner, so a web only ever hangs in a room's top corner where the back wall
    // meets a side wall (mirrored for the right one), more of them in the crypt and the halls than in the fire depths
    const WEB = { crypt: 0.6, arcane: 0.6, dungeon: 0.35, cave: 0.35, lava: 0.15 };
    for (const r of rooms) { const p = WEB[r.zone || biome] || 0.3;
      for (const [x, s, f] of [[r.x, -1, 0], [r.x + r.w - 1, 1, 1]]) { if (at(x, r.y) !== 1 || at(x + s, r.y) !== 0 || at(x, r.y - 1) !== 0 || R() > p) continue;
        const k = 0.95 + 0.35 * R(), w = 40 * k; decals.push({ x: f ? (x + 1) * TILE - w / 2 : x * TILE + w / 2, y: r.y * TILE + w / 2, n: 'dc_web', f, s: k }); } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 1 && !rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) && R() < 0.06)
      fitDecal({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, n: DEC[biome][Math.floor(R() * DEC[biome].length)], f: R() < 0.5 ? 1 : 0, s: 0.7 + 0.3 * R() });
    // (a plateau's merchant has a whole plateau, TASKS 422: lit again with the rest, his lamps and fire counted)
    const shopLights = () => shop.lanterns.map((q) => [q.x, q.y, LIGHT_R.wall]).concat([[shop.x, shop.y, LIGHT_R.fire]]);
    // (a campaign shop is lit by its lamps; a wide one, TASKS 374's larger rooms, takes a sconce where they fall short)
    for (const r of rooms) if (!lightRoom(r, r.type === 'shop' ? shopLights() : [], r.type === 'shop' && !plat || undefined)) return null;
    // the magma caves' hazards (TASKS 406, data.js HAZ): vents out on a plateau's open floor (a fissure's mouth, 3×3 of free floor
    // round it, never by a way in), falling rocks on the passes between the plateaus and under the top wall; each kind kept apart,
    // and both HAZ.clear cells off the start's fire, the spawn, the chests, the monsters' posts, the altar, the merchant's corner and
    // the stairs. Their own random stream, so the rest of the floor is laid out as without them
    const hazards = [];
    if (plat) { const Z = mul32(seed ^ 0x406a), HZ = D.HAZ, keepOff = [[wx(start.cx), wy(start.cy)], [spawn.x, spawn.y], [exit.x, exit.y], ...chests.map((c) => [c.x, c.y]), ...enemies.map((e) => [e.x, e.y]), ...shrines.map((q) => [q.x, q.y])];
      const clear = (x, y) => keepOff.every(([px, py]) => Math.hypot(px - wx(x), py - wy(y)) >= (HZ.clear + 0.5) * TILE) && !(Math.abs(x - shopR.cx) <= 6 && y >= shopR.y - 2 && y <= shopR.y + 7);
      const under = new Set(lavaUnder), inBox = (x, y) => rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      const shuf = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Z() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const lay = (k, cand, ordered) => { const H = HZ[k]; let n = H.n[Math.min(floor, H.n.length) - 1] - hazards.filter((z) => z.k === k).length;
        for (const [x, y] of ordered ? cand : shuf(cand)) { if (n <= 0) break; if (!clear(x, y) || hazards.some((z) => z.k === k && Math.hypot(z.x - wx(x), z.y - wy(y)) < H.apart * TILE)) continue;
          const z = { k, x: wx(x), y: wy(y), per: H.per[0] + Z() * (H.per[1] - H.per[0]), ph: Z() }; hazards.push(z); n--;
          if (k === 'vent') { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) used.add(key(x + i, y + j)); decor.push({ x: z.x, y: z.y, n: 'vent_mg', r: roomOf(x, y), haz: hazards.length - 1 }); } } };
      const roomOf = (x, y) => { const q = rooms.find((r) => r.type !== 'secret' && inRm(r, x, y)); return q ? q.id : -1; };
      // (TASKS 461) laid at random they stood on the walk to the stairs 1.5 rings a floor, a third of floors none: HZ.fall.aim rocks
      // go first on its narrows, a ridge between the lava or a crossing's landing, and the vents by the chests off it, where a
      // reward is worth the risk; the rest at random as before
      const way = (() => { const s0 = Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE), e = exit.ty * W + exit.tx, from = new Int32Array(W * H).fill(-2), q = [s0]; from[s0] = -1;
        for (let i = 0; i < q.length && from[e] === -2; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (from[n] === -2 && cells[n] === 1) { from[n] = q[i]; q.push(n); } }
        const out = []; if (from[e] !== -2) for (let k = e; k >= 0; k = from[k]) out.push(k); return out; })(), onWay = new Set(way);
      const wide = (x, y) => { let n = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (at(x + i, y + j) === 1 && !under.has((y + j) * W + x + i)) n++;
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (under.has((y + j) * W + x + i)) return n - 8; return n; };
      const narrows = way.map((k) => [k % W, Math.floor(k / W)]).filter(([x, y]) => !under.has(y * W + x) && !used.has(key(x, y))).map(([x, y], i) => [x, y, wide(x, y), i]).sort((a, b) => a[2] - b[2] || a[3] - b[3]);
      for (const [x, y] of narrows) { if (hazards.filter((z) => z.k === 'fall').length >= Math.min(HZ.fall.aim, HZ.fall.n[Math.min(floor, HZ.fall.n.length) - 1])) break;
        if (!clear(x, y) || hazards.some((z) => Math.hypot(z.x - wx(x), z.y - wy(y)) < HZ.fall.apart * TILE)) continue;
        hazards.push({ k: 'fall', x: wx(x), y: wy(y), per: HZ.fall.per[0] + Z() * (HZ.fall.per[1] - HZ.fall.per[0]), ph: Z(), aim: 1 }); }
      const halls = rooms.filter((r) => !r.pocket && ['combat', 'exit', 'treasure'].includes(r.type)), vents = [];
      for (const r of halls) for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (free(x, y, 1) && !doorway(x, y) && !shore.has(key(x, y))) vents.push([x, y]);
      const byChest = (x, y) => !onWay.has(y * W + x) && chests.some((c) => Math.hypot(c.x - wx(x), c.y - wy(y)) < 6.5 * TILE);
      lay('vent', shuf(vents).map((v) => [v, byChest(...v) ? 0 : 1]).sort((a, b) => a[1] - b[1]).map(([v]) => v), true);
      // a pass: floor off every room's box, not a crossing's deck; the wall's foot: a plateau's top row under the rock wall
      const falls = []; for (let y = 3; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { if (at(x, y) !== 1 || under.has(y * W + x) || used.has(key(x, y)) || shore.has(key(x, y))) continue;
        if (!inBox(x, y) || (y <= cliff[x] + 1 && at(x, y - 1) === 0 && roomOf(x, y) >= 0 && rooms[roomOf(x, y)].type !== 'shop')) falls.push([x, y]); }
      lay('fall', falls); }
    // the walk from where the hero arrives to the stairs (TASKS 400: a plateau floor's is held to AR.path)
    const walk = (() => { const s0 = Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE), e = exit.ty * W + exit.tx, d = new Int32Array(W * H).fill(-1), q = [s0]; d[s0] = 0;
      for (let i = 0; i < q.length && d[e] < 0; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && cells[n] === 1) { d[n] = d[q[i]] + 1; q.push(n); } } return d[e]; })();
    if (plat && walk < pathMin) return null;
    const secAt = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      return secrets.findIndex((sc) => { const r = rooms[sc.room]; return (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) || sc.hide.includes(ty * W + tx); }); };
    for (const list of [chests, pots, torches, decor, decals]) for (const o of list) { const i = secAt(o.x, o.y + (o.wall ? TILE : 0)); if (i >= 0) o.sec = i; }
    for (const t of torches) { const i = secrets.findIndex((sc) => sc.room === t.r); if (i >= 0) t.sec = i; }
    // cells taken by solid props: the flow fields route around them
    const block = []; const bl = (x, y) => block.push(Math.floor(y / TILE) * W + Math.floor(x / TILE));
    for (const c of chests) bl(c.x, c.y); for (const t of torches) if (t.kind !== 'wall') bl(t.x, t.y); for (const d of decor) if (d.solid) bl(d.x, d.y); for (const s of shrines) bl(s.x, s.y); for (const [x, y] of shop.solid) bl(x, y);
    // a fountain's basin stands on the floor, three cells wide; a stream's culvert is in the wall (TASKS 230)
    for (const q of waterFeatures) if (q.kind === 'fountain') for (const dx of [-TILE, 0, TILE]) bl(q.x + dx, q.y);
    // (a floor type's invariants selfCheck holds it to, kept by a retry, TASKS 432: the plateaus' sizes vary, and a rare floor
    // came out with its lava past its type's share or a lava cave with one way over its streams)
    if (plat) { const fl = cells.filter((c) => c === 1).length, sh = shareOf, share = lava.length / (fl + lava.length);
      if (share < sh[0] || share > sh[1] || (lc && crossings.filter((c) => c.lava).length < 2)) return null; }
    const map = { seed, floor: runFloor, biome, arch: arch || 'rooms', cliff, ridges: plat ? lines.map((q) => Math.round(ridgeLen(q))) : undefined, W, H, cells, rooms, block, decals, edges: edges.map((e) => [e[0], e[1]]), start: start.id, exitRoom: exitR.id, exit, spawn, sanct,
      ftype, ftype2, shareOf, bossType, walk, down, up, pits, lay: LY ? ST.lay || 'rooms' : undefined, enemies, chests, pots, traps, torches, decor, shrines, rugs, shop, secrets, secretsWanted, ...(plat ? { hazards } : {}), lava: lava.length, lavaFlow: flow, crust, lavaUnder, chasmUnder: [...chasmUnder], lavaFeatures, lavaBodies, streams, water, waterFlow, waterFeatures, waterBridges, deep: cells.filter((c) => c === 6).length, crossings, doors, locks, webs, ambush, drips, flora, serpentPools, floodCells };
    // (a magma floor keeps two thirds of its rewards and more off the way and a reward at the end of every dead end off it, TASKS 433;
    // the rare floor that misses is laid again)
    if (plat && !boss && strict) { const q = rewardsOf(map); if (q.onWay * 3 > q.list.length || q.bare.length) return null; }
    return map;
  }

  // a magma floor's rewards (TASKS 433): its chests (a cache's own counted as the cache, on the plateau it is dug from), altars and
  // elites (not the stairs' own), each with its room; the rooms on the way from the start to the stairs, the dead ends off it, and
  // those of them holding no reward
  function rewardsOf(m) {
    const W = m.W, s = m.rooms[m.start], way = wayRooms(m.cells, W, m.H, m.rooms, s.cy * W + s.cx, m.exit.ty * W + m.exit.tx, (c) => c === 1 || c === 5);
    const sec = new Set(m.secrets.map((q) => q.room)), list = [];
    for (const c of m.chests) { const r = roomAt(m, c.x, c.y); if (!sec.has(r)) list.push({ kind: 'chest', room: r }); }
    for (const q of m.secrets) list.push({ kind: 'cache', room: q.host ?? -1 });
    for (const a of m.shrines) if (!a.boss) list.push({ kind: 'altar', room: roomAt(m, a.x, a.y) });
    for (const e of m.enemies) if (e.elite && !e.exit && !e.guard && !D.BOSSES[e.type]) list.push({ kind: 'elite', room: e.room });
    const deg = m.rooms.map(() => 0); for (const [a, b] of m.edges) { deg[a]++; deg[b]++; }
    const ends = m.rooms.filter((r) => deg[r.id] === 1 && !way.has(r.id) && ['combat', 'treasure', 'shrine'].includes(r.type));
    return { way, list, onWay: list.filter((q) => way.has(q.room)).length, ends, bare: ends.filter((r) => !list.some((q) => q.room === r.id)) };
  }

  // the start town (R-17, TASKS 1003): floor 0 of a run, the courtyard of a ruined fortress over the crypt, laid to a fixed plan
  // after the accepted reference (study/refs/ref_town.png, a tile ≈ 31 px of it; study/refs/README.md): the stairs down in the
  // gate at the top, the campfire and its tree in the middle of the square, the merchant top left, the forge and the enchanter
  // (one workshop, TASKS 1013) top right, the Altar of Souls and the storage chest right of the square, the notice board and the
  // portal's ring of stones below left, the mine on the right with its rails along the bottom wall only to the unloading yard
  // (an ore bin) at the left; the seed moves only the small things: decor, ruin stubs, ground decals, where the townsfolk stand
  const TOWN = { W: 56, H: 37,
    floor: [[4, 4, 48, 28]],
    // the outer ruins' ragged edge, the gate round the stairs, the services' back walls, the mine's rock and the wall over the rails
    rock: [[4, 4, 48, 3], [4, 7, 2, 2], [50, 7, 2, 3], [4, 29, 3, 3], [4, 13, 1, 3], [51, 26, 1, 6],
      [23, 4, 9, 4], [36, 11, 7, 2], [42, 11, 1, 5], [33, 19, 9, 2],
      [44, 18, 8, 4], [4, 10, 4, 2], [4, 16, 4, 2], [4, 22, 4, 2], [12, 26, 12, 2], [31, 26, 10, 2]],
    // the cobbled square round the fire and the paths off it to the stairs, the merchant, the forge, the altar, the board and the south gate
    pave: [[21, 14, 13, 8], [25, 8, 5, 6], [14, 10, 8, 3], [30, 9, 8, 3], [33, 21, 7, 2], [24, 22, 7, 8], [17, 21, 5, 2]],
    stairs: [27, 8], fire: [27, 17], spawn: [24, 19], shop: [17, 8], anvil: [36, 8], forge: [38, 7], lectern: [39, 14], shelf: [37, 13],
    altar: [36, 21], chest: [39, 21], board: [22, 21], portal: [16, 22], tree: [31, 15], adit: [47, 22], bin: [15, 29], herbs: [44, 25],
    // the portal's ring is open toward the square (no stone east of it); where a body stands to use each service (the checks walk a two-cell-wide body there from the spawn)
    use: { stairs: [27, 8], shop: [17, 10], altar: [36, 22], stash: [39, 22], anvil: [36, 9], lectern: [39, 15], board: [22, 22], portal: [16, 22], fire: [27, 19], adit: [47, 23], bin: [16, 29] },
    braziers: [[25, 8], [29, 8]],
    benches: [[25, 16], [29, 19], [25, 19]],
    // the town's own lights (TASKS 1005): lanterns in the workshop niches, at the canvas stall, the well, the merchant, the portal and the rails' yard, the forge's coals, the
    // enchanter's runes, the Altar of Souls, the crypt's glow from below; the campfire and the gate's braziers are its torches
    lights: [['lamp', 8, 13], ['lamp', 8, 19], ['lamp', 9, 25], ['lamp', 48, 9], ['lamp', 11, 20], ['lamp', 21, 7], ['lamp', 19, 24], ['lamp', 14, 28], ['lamp', 31, 31], ['lamp', 39, 28], ['forge', 38, 7], ['runes', 39, 15], ['candle', 40, 14], ['altar', 36, 21], ['crypt', 27, 8], ['adit', 47, 22]],
    // trees in the courtyard's corners against the ruins, as round the reference's edge (beyond the walls the void swallows anything)
    edge: [[6, 8], [50, 8], [51, 14], [5, 14], [5, 27], [50, 30], [8, 30]],
    // the yard's own props after the reference: the log pile, the canvas stall, the well, the mine's pick rack and cart, the yard's stone and ore;
    // the workshop niches on the left with a work table, sacks, a crate and burning candles
    props: [['logs_tw', 43, 8], ['stall_tw', 46, 10], ['well_tw', 9, 19], ['picks_tw', 45, 23], ['cart_tw', 49, 24], ['blocks_tw', 19, 29], ['ore_tw', 13, 30],
      ['table_candles', 6, 14], ['shop_sacks', 5, 21], ['shop_crate', 7, 24], ['candles', 5, 24]],
    rails: [[47, 23], [47, 24], [46, 25], [45, 26], [44, 27], [43, 28], [42, 29], ...Array.from({ length: 25 }, (_, i) => [41 - i, 30])],
    // the townsfolk's places (TASKS 1014–1015 put them there): each at its work, facing it; the cast is the player's (6 Nov 2026): no miner, mason or gardener
    // the rounds of those who walk (TASKS 1015): stops in cells, 'take' / 'drop' where the porter lifts and sets down his crate (from the
    // canvas stall to the merchant), the others pause at each stop to sweep or to scatter grain; the round loops back to the start
    routes: { porter: [[45, 10, 'take'], [34, 10], [22, 12], [22, 10, 'drop'], [22, 12], [34, 10]], sweeper: [[30, 21], [24, 23], [32, 24]], child: [[13, 18], [17, 18], [11, 16]] },
    npcs: [['smith', 35, 8], ['enchanter', 40, 14], ['keeper', 29, 16], ['guard', 30, 10], ['porter', 32, 11], ['sweeper', 30, 21], ['child', 13, 18], ['hen', 12, 20], ['hen', 14, 20], ['hen', 12, 17]],
    // ruin stubs the seed picks some of, and spots for the small decor
    stubs: [[9, 6], [44, 7], [10, 27], [45, 29], [5, 26], [49, 13], [12, 14]],
    small: [['barrel', 13, 8], ['crate', 21, 8], ['barrel', 20, 11], ['crate', 33, 8], ['barrel', 41, 8], ['rack', 5, 12], ['table', 5, 18], ['crate', 6, 20], ['barrel', 6, 25],
      ['crate', 49, 9], ['barrel', 12, 30], ['barrel', 9, 9], ['crate', 35, 25], ['barrel', 47, 27]] };
  function genTown(seed) {
    const T = TOWN, W = T.W, H = T.H, cells = new Array(W * H).fill(0), R = mul32(seed >>> 0), wx = (x) => x * TILE + TILE / 2, wy = (y) => y * TILE + TILE / 2;
    const fill = ([x0, y0, w, h], v) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cells[y * W + x] = v; };
    for (const r of T.floor) fill(r, 1); for (const r of T.rock) fill(r, 0);
    const stubs = T.stubs.filter(() => R() < 0.5); for (const [x, y] of stubs) fill([x, y, 1 + (R() < 0.5 ? 1 : 0), 1], 0);
    const room = { x: 4, y: 4, w: 48, h: 28, type: 'town', id: 0 }; room.cx = 27; room.cy = 17;
    const at = ([x, y]) => ({ x: wx(x), y: wy(y) }), sanct = at(T.fire), exit = Object.assign(at(T.stairs), { tx: T.stairs[0], ty: T.stairs[1] });
    const spawn = { x: wx(T.spawn[0]) + Math.round((R() - 0.5) * 12), y: wy(T.spawn[1]) + Math.round((R() - 0.5) * 8) };
    // the forge's glow is the town's light (TASKS 1005), not a brazier's
    const torches = [{ x: sanct.x, y: sanct.y, kind: 'fire' }, ...T.braziers.map((p) => Object.assign(at(p), { kind: 'brazier' }))];
    const [sx, sy] = T.shop, cy = wy(sy + 1), shop = { room: 0, x: wx(sx), y: cy - 16, counter: { x: wx(sx), y: cy }, front: { x: wx(sx), y: cy + 30 },
      solid: [-1, 0, 1].map((i) => [wx(sx + i), cy]), lanterns: [] };
    // role: what each prop is to the town (services, townsfolk's work); the Altar of Souls and the storage chest are the game's own
    const decor = [
      { ...at(T.altar), n: 'altar', role: 'altar', solid: 1 }, { ...at(T.chest), n: 'chest', role: 'stash', solid: 1 }, { ...at(T.anvil), n: 'anvil_tw', role: 'anvil', solid: 1 },
      { ...at(T.forge), n: 'forge_tw', role: 'forge', solid: 1 }, { ...at(T.lectern), n: 'lectern_tw', role: 'lectern', solid: 1 }, { ...at(T.shelf), n: 'flasks_tw', role: 'shelf', solid: 1 },
      { ...at(T.board), n: 'board_tw', role: 'board', solid: 1 }, { ...at(T.tree), n: 'tree_tw', role: 'tree', solid: 1 }, { ...at(T.bin), n: 'orebin_tw', role: 'ore_bin', solid: 1 },
      { ...at(T.herbs), n: 'herbs_tw', role: 'herbs', solid: 1 }, { x: wx(T.adit[0]), y: wy(T.adit[1]) + 6, n: 'adit_tw', role: 'adit', solid: 1 },
      { x: wx(sx), y: wy(sy - 1) + 12, n: 'awning_tw', role: 'stall' },
      ...T.benches.map((p) => ({ ...at(p), n: 'bench_tw', role: 'bench' })),
      ...T.props.map(([n, x, y]) => ({ ...at([x, y]), n, solid: 1 })),
      ...[1, 2, 3, 4, 5].map((i) => { const a = i * Math.PI / 3; return { x: wx(T.portal[0]) + Math.cos(a) * 2.4 * TILE, y: wy(T.portal[1]) + Math.sin(a) * 1.9 * TILE, n: i % 2 ? 'stone_tw_a' : 'stone_tw_b', role: 'portal_stone', solid: 1 }; }),
      ...T.lights.filter(([k]) => k === 'lamp').map(([, x, y]) => ({ ...at([x, y]), n: 'shop_lantern', role: 'lamp', solid: 1 })),
      ...T.edge.map(([x, y], i) => ({ ...at([x, y]), n: 'tree_tw', role: 'edge', solid: 1, s: 0.85 + 0.1 * (i % 3), f: i % 2 })),
      ...T.small.filter(() => R() < 0.7).map(([n, x, y]) => ({ x: wx(x) + Math.round((R() - 0.5) * 10), y: wy(y) + Math.round((R() - 0.5) * 6), n, solid: 1 }))];
    const rails = T.rails.map(([x, y]) => y * W + x);
    const pave = []; for (const [x0, y0, w, h] of T.pave) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (cells[y * W + x] === 1 && !pave.includes(y * W + x)) pave.push(y * W + x);
    const npcs = T.npcs.map(([role, x, y]) => Object.assign({ role, x: wx(x) + Math.round((R() - 0.5) * 10), y: wy(y) + Math.round((R() - 0.5) * 6) },
      T.routes[role] ? { route: T.routes[role].map(([x, y, act]) => Object.assign({ x: wx(x), y: wy(y) }, act ? { act } : {})) } : {}));
    const near = (x, y, r) => decor.some((d) => Math.hypot(d.x - x, d.y - y) < r) || Math.hypot(sanct.x - x, sanct.y - y) < 3 * TILE || rails.includes(Math.floor(y / TILE) * W + Math.floor(x / TILE));
    const decals = [];
    for (let i = 0; i < 70; i++) { const x = (4 + R() * 48) * TILE, y = (4 + R() * 28) * TILE; if (cells[Math.floor(y / TILE) * W + Math.floor(x / TILE)] !== 1 || near(x, y, 30)) continue;
      decals.push({ x, y, n: ['dc_grass_tw', 'dc_flowers_tw', 'dc_leaves_tw', 'dc_grass_tw', 'dc_moss', 'dc_pebbles'][Math.floor(R() * 6)], f: R() < 0.5 ? 1 : -1, s: 0.8 + R() * 0.5 }); }
    const svc = { stairs: exit, fire: sanct, shop: shop.front, altar: at(T.altar), stash: at(T.chest), anvil: at(T.anvil), lectern: at(T.lectern), board: at(T.board), portal: at(T.portal), adit: at(T.adit), bin: at(T.bin) };
    return { seed, floor: 0, town: { svc, use: T.use, rails, pave, npcs, lights: T.lights.map(([kind, x, y]) => ({ kind, ...at([x, y]) })) }, biome: 'town', arch: 'town', cliff: null, W, H, cells, rooms: [room], block: [], decals, edges: [], start: 0, exitRoom: 0, exit, spawn, sanct,
      ftype: null, ftype2: null, shareOf: null, bossType: undefined, walk: cells.filter((c) => c === 1).length, down: null, enemies: [], chests: [], pots: [], traps: [], torches,
      decor, shrines: [], rugs: [], shop, secrets: [], secretsWanted: 0, pits: [], lava: 0, lavaFlow: {}, crust: [], lavaUnder: [], chasmUnder: [], lavaFeatures: [], lavaBodies: [], streams: [],
      water: [], waterFlow: {}, waterFeatures: [], waterBridges: [], deep: 0, crossings: [], doors: [], locks: [], webs: [], ambush: [], drips: [], flora: [], serpentPools: [], floodCells: [] };
  }
  // where a body can stand in the town (TASKS 1003): open floor clear of its solid props (Node checks walk to every service over it)
  function townWalk(m) { const ok = m.cells.map((c) => c === 1), off = (x, y) => { const k = Math.floor(y / TILE) * m.W + Math.floor(x / TILE); ok[k] = false; };
    for (const d of m.decor) if (d.solid) off(d.x, d.y); for (const t of m.torches) if (t.kind !== 'wall') off(t.x, t.y); if (m.shop) for (const [x, y] of m.shop.solid) off(x, y);
    return ok; }

  // room index of a world point (or -1 in a corridor); a secret room first: a plateau's box may hold one (TASKS 422)
  const roomAt = (map, x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), inR = (r) => inRm(r, tx, ty);
    for (const r of map.rooms) if (r.type === 'secret' && inR(r)) return r.id;
    for (const r of map.rooms) if (inR(r)) return r.id; return -1; };

  root.DUNGEON = { genFloor, genTown, townWalk, TOWN, roomAt, inRm, rectsOf, mul32, LIGHT_R, straightRuns, narrowTo, wayRooms, rewardsOf };
  if (typeof module !== 'undefined') module.exports = root.DUNGEON;
})(typeof window !== 'undefined' ? window : globalThis);
