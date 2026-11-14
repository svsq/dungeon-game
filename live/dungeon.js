// live/dungeon.js — procedural floor generator: genFloor(seed, floor, { mode }) → plain JSON map data. Pure function of its inputs.
// Rooms placed at random without overlap → MST + extra loop edges → 2-wide L corridors → start room at a leaf,
// exit room farthest by graph distance (floor 8: the boss lair) → room roles → contents (enemies, chests, pots, traps,
// lava, torches, decor) → validation (everything reachable from the start, spawns on open floor).
(function (root) {
  const D = root.DATA || require('./data.js');
  const { TILE, ENEMIES, mul32, shuffleBy } = D, DGX = (root.DGX = {});
  // how far each light source reaches, in tiles (matches the glow radii of the scene's light map)
  const LIGHT_R = { wall: 6.5, brazier: 6.5, fire: 8.5, candles: 3, candlestick: 3.5, candelabra: 4.5, torch_stand: 6.5, crystal: 6.5, shrine: 6, lava: 3.5, shroom: 5, shroom_a: 5, shroom_b: 5, crystal_cv: 6.5, vent_mg: 5, obsidian_mg: 6.5 };
  // the share of the longest walk a start may be from the stairs or the boss (TASKS 506)
  const WALK_FAR = 0.85;
  // cells: 0 rock, 1 floor, 3 lava (blocks walking, not projectiles), 4 a secret room's fake wall (solid until broken), 5 a shut door
  // (set by the sim), 6 deep water (blocks walking and knockback, not projectiles or sight)

  // a room's shape (TASKS 374): its box (x, y, w, h) is its core, where everything set against a wall or in rows stands, and
  // `wings`, boxes of floor joined to it (a cross's arms, an L's foot, a round hall's caps), are its floor as well
  const inRm = (r, x, y, p = 0) => (x >= r.x - p && x < r.x + r.w + p && y >= r.y - p && y < r.y + r.h + p) || (!!r.wings && r.wings.some(([a, b, c, d]) => x >= a - p && x < a + c + p && y >= b - p && y < b + d + p));
  const rectsOf = (r) => [[r.x, r.y, r.w, r.h], ...(r.wings || [])];

  function genFloor(seed, floor, opts = {}) {
    // a floor without a secret room is rerolled a few times before one is accepted, unless it meant to have none
    // deprecated: kept for the map hash (GEN_PRINT, mapPrint); not ported to Godot (m.loose)
    for (let attempt = 0; attempt < 20; attempt++) { const m = tryGen((seed + attempt * 7919) >>> 0, floor, opts, attempt < 16, false, attempt < 14); if (m && (m.secrets.length || !m.secretsWanted || attempt >= 12)) { if (attempt >= 14) m.loose = 1; return m; } }
    // (a floor no try above lays, which a magma floor's walk to the stairs left 1 seed in 300: a crash on entering it, never a
    // floor; reached only past them, so every floor they lay stays as it is; loose: their walk to the stairs may be nine tenths)
    for (let attempt = 20; attempt < 40; attempt++) { const m = tryGen((seed + attempt * 7919) >>> 0, floor, opts, false, attempt >= 36); if (m) { m.loose = 1; return m; } }
    // (a layout of TASKS 379–380 no try lays, its rooms finding no room on the map: the plain rooms and corridors, not a crash)
    for (let attempt = 40; attempt < 60; attempt++) { const m = tryGen((seed + attempt * 7919) >>> 0, floor, Object.assign({}, opts, { stage: Object.assign({}, opts.stage, { lay: 'rooms' }) }), false, attempt >= 56); if (m) return m; }
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
  const NO_SHOP = Object.freeze({ x: -99, y: -99, w: 0, h: 0, cx: -99, cy: -99 });
  // a lake floor's two ways (TASKS 472): the walk to the stairs over the islands and the walk round the shore, and whether the
  // islands save the share AR.lake.save of the walk round
  // (a floor past the strict tries takes the looser band AR.lake.loose, and only the last few tries any)
  const lakeOk = (q, strict, last) => { const L = D.ARCH.plateau.lake, b = strict ? L.save : L.loose, sv = q.round > 0 ? 1 - q.isle / q.round : -1; return last || (sv >= b[0] && sv <= b[1]); };
  // (the way round shuts the islands' chain: the floor reached from the islands' middles without leaving the lake, so a crossing
  // over a corner of the lake off the chain stays a way round)
  function lakeWays(cells, W, H, fig, a, b, isles, go) {
    const chain = new Uint8Array(W * H), q = isles.map((r) => r.cy * W + r.cx).filter((k) => go(cells[k])); for (const k of q) chain[k] = 1;
    for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (!chain[n] && fig[n] && go(cells[n])) { chain[n] = 1; q.push(n); } }
    const walk = (ok) => { const d = new Int32Array(W * H).fill(-1), qq = [a]; d[a] = 0;
      for (let i = 0; i < qq.length; i++) for (const o of [1, -1, W, -W]) { const n = qq[i] + o; if (d[n] < 0 && go(cells[n]) && ok(n)) { d[n] = d[qq[i]] + 1; qq.push(n); } } return d[b]; };
    return { isle: walk(() => true), round: walk((n) => !chain[n]) };
  }
  // a river floor's places to cross (TASKS 473): the floor over the river's figure in pieces, each one way over (an island and its two
  // crossings one piece); the walk from a over each piece alone, the others shut
  function riverWays(cells, W, H, fig, a, go) {
    const lab = new Int32Array(W * H).fill(-1); let n = 0;
    for (let k0 = 0; k0 < W * H; k0++) { if (lab[k0] >= 0 || !fig[k0] || !go(cells[k0])) continue; const q = [k0]; lab[k0] = n;
      for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const k = q[i] + o; if (lab[k] < 0 && fig[k] && go(cells[k])) { lab[k] = n; q.push(k); } } n++; }
    const via = []; for (let p = -1; p < n; p++) { const d = new Int32Array(W * H).fill(-1), q = [a]; d[a] = 0;
      for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const k = q[i] + o; if (d[k] < 0 && go(cells[k]) && (lab[k] < 0 || lab[k] === p)) { d[k] = d[q[i]] + 1; q.push(k); } } via.push(d); }
    return { lab, n, dry: via.shift(), via };
  }
  // the ways to b over the places, shortest first: [walk, place]; a choice: two within `choice` of each other and the way round
  // the river's end (dry), if any, no shorter than `choice` of the best
  const riverAt = (R, b) => R.via.map((d, p) => [d[b], p]).filter((q) => q[0] > 0).sort((x, y) => x[0] - y[0]);
  const riverOk = (R, b, choice) => { const ws = riverAt(R, b), dry = R.dry[b]; return ws.length >= 2 && ws[1][0] <= ws[0][0] * choice && (dry < 0 || dry >= ws[0][0] * choice); };
  function tryGen(seed, runFloor, opts, strict, lastTry, altTry) {
    const GF = {};
    const R = mul32(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = (arr) => arr[Math.floor(R() * arr.length)];
    // depth: the campaign floor this one is worth in monsters, elites, traps and ambushes; runFloor: its place in the run; floor: its
    // place among the floors its description lays out (data.js stageOf: the campaign's 9th is the caves' 1st); last: its chapter's
    // end, fin: the run's last floor (past any other boss an altar and the stairs wait)
    // (opts.stage: a staged view's own size and room count over its stage's, the QA match, TASKS 373)
    const ST = Object.assign({}, D.stageOf(opts.mode, runFloor, opts.runSeed, opts.from), opts.stage), N = ST.N, floor = ST.lf, depth = ST.depth, last = ST.last, fin = ST.fin;
    const biome = ST.biome, bossType = ST.boss, boss = !!bossType, FM = (ST.mod && D.FLOOR_MODS[ST.mod]) || {};
    // the cave archetype (R-18, TASKS 301): the same rooms and links, but a room is a blob of floor inside its box round a core
    // where the start's fire or the stairs stand, a link is a winding tunnel 2–4 cells wide, and small dead-end pockets hang off
    // the rooms for a chest or an ambush; the map grows floor by floor and has no straight stretch of wall longer than four cells
    // the plateau archetype (TASKS 400, data.js ARCH) is laid out by the cave's code from its roles on: it differs in the blobs'
    // spacing, its links (long narrow ridges with dead-end ledges) and what lies off the floor (lava, the chasm, a wall at the top only)
    const arch = ST.arch || N.arch, AR = D.ARCH[arch], plat = arch === 'plateau', cave = arch === 'cave' || plat;
    const [W, H] = ST.size || (cave ? N.size[floor - 1] : [72, 54]), cells = new Array(W * H).fill(0), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : cells[y * W + x]);
    // (moat: a fortress's rock between its ring and its court, TASKS 380, no corridor is dug through once the gates are)
    GF.moat = null;
    const set = (x, y, v) => { if (x > 1 && y > 2 && x < W - 2 && y < H - 2 && !(GF.moat && v === 1 && GF.moat(x, y))) cells[y * W + x] = v; };
    Object.assign(GF, {
      AR, FM, H, R, ST, W, altTry, arch, at, biome, boss, bossType, cave, cells, depth, fin, floor, last, lastTry, opts, pick, plat, ri,
      runFloor, seed, set, strict });
    if (DGX.rooms(GF) === null) return null;
    if (DGX.links(GF) === null) return null;
    if (DGX.terrain(GF) === null) return null;
    const m = DGX.fill(GF);
    // a modifier only raises a cap or a chance, so a floor may have no room for it; the banner must never name one the floor lacks
    if (m && m.mod && MOD_HELD[m.mod] && !MOD_HELD[m.mod](m)) { if (strict) return null; m.mod = null; }
    if (m) markEvents(m, ST, opts, seed);
    return m;
  }

  // the event rooms (TASKS 361, data.js EVENTS): marked once the floor is laid and checked, so they never move a wall or a way.
  // EVENT_PLACE[id](m, r, rnd) → [x, y, more?] (world px; more joins the event's record) or null puts an event's own things in its room; with none, its spot is the open
  // cell nearest the room's middle
  const EVENT_PLACE = {
    // the skull door's grates (TASKS 362): one in each run of open cells just past the room's box, the way the boss's arena takes its
    // doors, so they shut every way in whatever its width (a cave's mouths are seldom two cells). Not a room a secret opens into,
    // nor one whose ways in are another room's floor or a door's
    trial: (m, r) => { if (r.wings) return null;
      const W = m.W, inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, mouth = new Map();
      if ((m.secrets || []).some((q) => q.host === r.id || q.wall.concat(q.front || []).some(([x, y]) => inRm(r, x, y, 1)))) return null;
      const doorC = new Set((m.doors || []).flatMap((d) => d.cells.map(([x, y]) => y * W + x)));
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) for (const [dx, dy, dir] of [[0, -1, 'u'], [0, 1, 'd'], [-1, 0, 'l'], [1, 0, 'r']]) {
        const ox = x + dx, oy = y + dy, k = oy * W + ox; if (inR(ox, oy) || m.cells[k] !== 1) continue;
        if (doorC.has(k) || m.rooms.some((q) => q !== r && inRm(q, ox, oy))) return null; mouth.set(k, { x: ox, y: oy, dir }); }
      const gates = [], took = new Set();
      for (const [k0, p] of mouth) { if (took.has(k0)) continue; const side = p.dir === 'l' || p.dir === 'r', st = side ? W : 1, run = [];
        let k = k0; while (mouth.has(k - st) && mouth.get(k - st).dir === p.dir) k -= st;
        for (; mouth.has(k) && mouth.get(k).dir === p.dir && !took.has(k); k += st) { took.add(k); run.push([k % W, Math.floor(k / W)]); }
        const a = run[0], n = run.length, ex = p.dir === 'l' ? r.x : p.dir === 'r' ? r.x + r.w : 0, ey = p.dir === 'u' ? r.y : p.dir === 'd' ? r.y + r.h : 0;
        gates.push({ dir: p.dir, cells: run, x: side ? ex * TILE : (a[0] + n / 2) * TILE, y: side ? (a[1] + n / 2) * TILE : ey * TILE }); }
      const at = gates.length && eventSpot(m, r); return at ? [at[0], at[1], { gates }] : null; },
    // the dark room (TASKS 365): a room with a pack to fight in the dark. Its wall torches and loose candles are put out (`dark`: the
    // render neither draws nor lights them; the lists keep their order, as a lever's sconce is found by its index); a room with a fire
    // on its floor (a brazier, a crystal, a forge), a secret's sconce or candles, or a zone's own light is not one
    dark: (m, r) => { const inside = (o) => inRm(r, Math.floor(o.x / TILE), Math.floor(o.y / TILE), 1), mine = (t) => t.r === r.id || inside(t);
      if (r.zone || m.enemies.filter((e) => e.room === r.id).length < D.EVENTS.pool.dark.pack) return null;
      const lamp = (d) => /^candle/.test(d.n) && !d.solid && d.pz === undefined && d.secret === undefined && inside(d);
      if (m.torches.some((t) => mine(t) && (t.kind !== 'wall' || t.lever !== undefined || t.sec !== undefined)) || m.decor.some((d) => /candle|crystal|brazier|forge/.test(d.n) && inside(d) && !lamp(d))) return null;
      const at = eventSpot(m, r); if (at) { for (const t of m.torches) if (mine(t)) t.dark = 1; for (const d of m.decor) if (lamp(d)) d.dark = 1; } return at; },
    // the captive's cage (TASKS 366): the room's elite keeps its key, or else its first plain monster that walks the floor (a key
    // with a lake's, a ford's or a deep one's never comes to hand); a room with no such keeper is not one. The cage is three cells
    // wide: none within three cells of a way into the room or four of a door, where it would crowd the doorway
    captive: (m, r) => { const pack = m.enemies.filter((e) => e.room === r.id && e.key === undefined && !e.guard && !e.exit && !e.lake && !e.ford && !D.ENEMIES[e.type].deep && !D.BOSSES[e.type]);
      const keeper = pack.find((e) => e.elite) || pack[0], at = keeper && eventSpot(m, r); if (!at) return null;
      const tx = Math.floor(at[0] / TILE), ty = Math.floor(at[1] / TILE); if ((m.doors || []).some((d) => d.cells.some(([x, y]) => Math.abs(x - tx) <= 4 && Math.abs(y - ty) <= 4))) return null;
      for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) if (!inRm(r, x, y) && m.cells[y * m.W + x] !== 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inRm(r, x + a, y + b))) return null;
      keeper.key = 'cage'; return at; },
    // the library (TASKS 368): its lectern on the spot, and up to `shelves` bookshelves against the back wall where the wall above is
    // whole (no way in or secret behind them), nothing hangs or stands there, and they keep clear of the lectern. A room with none of
    // them and none of its own is no library. Each shelf's cell is blocked, as a furnished one's is, so the way fields lead round it
    library: (m, r) => { const W = m.W, at = eventSpot(m, r), P = D.EVENTS.pool.library; if (!at) return null;
      const hide = new Set((m.secrets || []).flatMap((q) => q.wall.concat(q.front || []).map(([x, y]) => y * W + x)));
      const sx = Math.floor(at[0] / TILE), sy = Math.floor(at[1] / TILE), y0 = r.y * TILE + 22, half = D.PROP_W.bookshelf / 2, busy = new Set(m.block || []);
      for (const o of [...m.chests, ...m.pots, ...m.shrines, ...(m.webs || []), ...(m.ambush || []), ...m.traps]) busy.add(Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE));
      const own = m.decor.filter((d) => d.n === 'bookshelf' && d.secret === undefined && inRm(r, Math.floor(d.x / TILE), Math.floor(d.y / TILE))), put = [];
      // (a secret's wall or the floor before it is never hidden behind a shelf)
      const clear = (X, self, Y = y0, wall = 1) => { const x = Math.floor(X / TILE), y = Math.floor(Y / TILE); if (x - 1 < r.x || x + 1 > r.x + r.w - 1 || (wall && Math.abs(x - sx) <= 3 && sy - r.y < 3)) return false;
        for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) if (hide.has((y + j) * W + x + i)) return false;
        if (wall) for (let i = -1; i <= 1; i++) if (m.cells[(r.y - 1) * W + x + i] !== 0) return false;
        if (m.torches.some((t) => Math.abs(t.x - X) < half + 8 && Math.abs(t.y - Y) < 70)) return false;
        return !m.decor.concat(put).some((d) => d !== self && Math.abs(d.x - X) < half + (D.PROP_W[d.n] || 40) / 2 + 8 && Math.abs(d.y - Y) < 60); };
      const fits = (x, y = r.y, wall = 1) => { if (x - 1 < r.x || x + 1 > r.x + r.w - 1) return false;
        for (let i = -1; i <= 1; i++) { const k = y * W + x + i; if (m.cells[k] !== 1 || busy.has(k) || m.cells[k + W] !== 1 || !inRm(r, x + i, y)) return false; }
        return clear(x * TILE + TILE / 2, null, y * TILE + 22, wall); };
      // the open floor of the room stays one piece with these cells taken (a free-standing shelf must not wall off a corner)
      const whole = (ks) => { const blk = new Set([...busy, ...ks, Math.floor(at[1] / TILE) * W + Math.floor(at[0] / TILE)]), ok = (k) => inRm(r, k % W, Math.floor(k / W)) && m.cells[k] === 1 && !blk.has(k);
        let n = 0, k0 = -1; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (ok(y * W + x)) { n++; if (k0 < 0) k0 = y * W + x; }
        const seen = new Set([k0]), st = [k0]; while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) if (ok(k + d) && !seen.has(k + d)) { seen.add(k + d); st.push(k + d); } } return seen.size === n; };
      // a room furnished against its back wall already (racks, statues, cages) has no wall left: the library takes that furniture's
      // place, its shelves where the room's own pieces stood, when a shelf's width fits there
      const back = m.decor.filter((d) => d.solid && d.secret === undefined && Math.abs(d.y - y0) < 4 && /^(rack|statue|cage|pillar|crystal)$/.test(d.n) && inRm(r, Math.floor(d.x / TILE), r.y)), swap = [];
      const xs = []; for (let x = r.x + 2; x <= r.x + r.w - 3; x++) xs.push(x); xs.sort((a, b) => Math.abs(a - sx) - Math.abs(b - sx) || a - b);
      for (const x of xs) { if (put.length >= P.shelves) break; if (fits(x)) put.push({ x: x * TILE + TILE / 2, y: y0, n: 'bookshelf', solid: 1, r: r.id, lib: 1 }); }
      back.sort((a, b) => Math.abs(a.x - at[0]) - Math.abs(b.x - at[0]));
      for (const d of back) { if (put.length + swap.length >= P.shelves) break; if (clear(d.x, d) && !swap.some((o) => Math.abs(o.x - d.x) < 2 * half + 8)) swap.push(d); }
      // a room with no back wall to spare: two shelves stand free on the floor either side of the lectern, a reading corner
      // (or, short of room for two, one behind it)
      const stand = (L) => { if (put.length || swap.length || own.length || !L.every(([x, y]) => fits(x, y, 0)) || !whole(L.map(([x, y]) => y * W + x))) return;
        for (const [x, y] of L) put.push({ x: x * TILE + TILE / 2, y: y * TILE + 22, n: 'bookshelf', solid: 1, r: r.id, lib: 1 }); };
      for (const dy of [-1, 0]) stand([[sx - 3, sy + dy], [sx + 3, sy + dy]]); stand([[sx, sy - 2]]);
      if (!put.length && !swap.length && !own.length) return null;
      for (const d of swap) { d.n = 'bookshelf'; d.lib = 1; }
      for (const d of put) { m.decor.push(d); const k = Math.floor(d.y / TILE) * W + Math.floor(d.x / TILE); if (!m.block.includes(k)) m.block.push(k); }
      return at; } };
  const evOk = (E, ST, mode, opts) => ST.depth >= (E.minF || 1) && ST.depth <= (E.maxF ?? 1e9) && (!E.modes || E.modes.includes(mode)) && (!E.town || !!opts.town) && (!E.biomes || E.biomes.includes(ST.biome));
  function markEvents(m, ST, opts, seed) {
    const EV = D.EVENTS, pool = EV.pool, mode = opts.mode || 'campaign', force = (opts.events || []).filter((id) => pool[id]);
    const draw = Object.entries(pool).filter(([id, E]) => E.w > 0 && evOk(E, ST, mode, opts) && !force.includes(id));
    if (!force.length && !draw.length) return;
    const Er = mul32((seed ^ 0x3610) >>> 0), taken = specials(m).length;
    let want = Math.min(EV.n[0] + (Er() < EV.two ? 1 : 0), Math.max(0, EV.cap - taken)); want = Math.max(want, force.length);
    const ids = force.slice();
    while (ids.length < want) { const left = draw.filter(([id]) => !ids.includes(id)); if (!left.length) break;
      let roll = Er() * left.reduce((a, [, E]) => a + E.w, 0), pk = left[0][0]; for (const [id, E] of left) if ((roll -= E.w) < 0) { pk = id; break; } ids.push(pk); }
    const W = m.W, s = m.rooms[m.start], way = wayRooms(m.cells, W, m.H, m.rooms, s.cy * W + s.cx, m.exit.ty * W + m.exit.tx);
    const rooms = m.rooms.filter((r) => r.type === 'combat' && !r.hall && !r.locked && !r.pocket && !r.isle && !r.event && r.w * r.h >= EV.area && !way.has(r.id));
    const big = (r, E) => r.w * r.h >= (E.area || EV.area);
    shuffleBy(rooms, Er);
    const out = [];
    for (const id of ids) { const E = pool[id];
      for (const r of rooms) { if (r.event || !big(r, E)) continue;
        // (an elite is a room's reward, TASKS 433: a dead end off the way would be left with none, and a lair floor short of its own)
        if (E.room === 'treasure' && m.enemies.some((e) => e.room === r.id && (e.key !== undefined || e.guard || e.exit || e.elite))) continue;
        const at = EVENT_PLACE[id] ? EVENT_PLACE[id](m, r, Er) : eventSpot(m, r); if (!at) continue;
        r.event = id; if (E.room === 'treasure') { m.enemies = m.enemies.filter((e) => e.room !== r.id); if (m.webs) m.webs = m.webs.filter((w) => roomAt(m, w.x, w.y) !== r.id); }
        out.push(Object.assign({ id, room: r.id, x: at[0], y: at[1] }, at[2])); break; } }
    if (out.length) m.events = out;
  }
  // the open cell nearest a room's middle with its eight round it open too: no prop, chest, plate, web, water or doorway on it
  function eventSpot(m, r) {
    const W = m.W, busy = new Set(m.block || []), cellOf = (o) => Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE);
    for (const o of [...m.chests, ...m.pots, ...m.shrines, ...(m.webs || []), ...(m.ambush || [])]) busy.add(cellOf(o));
    for (const t of m.traps) for (let j = -1; j <= 0; j++) for (let i = -1; i <= 0; i++) busy.add(cellOf(t) + j * W + i);
    for (const d of m.doors || []) for (const [x, y] of d.cells) busy.add(y * W + x);
    for (const k of m.water || []) busy.add(k);
    let best = null, bd = 1e9;
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      let ok = true; for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1; i++) { const k = (y + j) * W + x + i; if (m.cells[k] !== 1 || busy.has(k) || !inRm(r, x + i, y + j)) { ok = false; break; } }
      const d = Math.hypot(x - r.cx, y - r.cy); if (ok && d < bd) { bd = d; best = [x, y]; } }
    return best && [best[0] * TILE + TILE / 2, best[1] * TILE + TILE / 2];
  }
  // a floor's special rooms (TASKS 1817), one list for the lair quest and the vows: { src: 'event' | 'hall' | 'altar', id, room }
  function specials(m) {
    const out = [];
    for (const r of m.rooms) { if (r.event) out.push({ src: 'event', id: r.event, room: r.id }); if (r.hall) out.push({ src: 'hall', id: r.hall, room: r.id }); if (r.type === 'shrine') out.push({ src: 'altar', id: 'altar', room: r.id }); }
    return out;
  }
  const MOD_HELD = { flood: (m) => m.waterFeatures.length > 0, lair: (m) => m.chests.some((c) => c.lair), cursed: (m) => m.traps.some((t) => t.run !== undefined) };

  // (TASKS 1925: an arch over a river that ended a cell past it stood on dry floor) it shows only where the river runs on four cells
  // south of its walk and one north
  const archLegs = (m, c) => { if (!c.lava || c.kind !== 'arch' || c.axis !== 'x') return null; const W = m.W, xs = c.cells.map((k) => k % W), ys = c.cells.map((k) => Math.floor(k / W)), x = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
    const cr = m.crust instanceof Set ? m.crust : new Set(m.crust || []), run = (y, d) => { let n = 0; while (n < 4 && m.cells[(y + d * (n + 1)) * W + x] === 3 && !cr.has((y + d * (n + 1)) * W + x)) n++; return n; };
    if (run(Math.max(...ys), 1) < 4 || run(Math.min(...ys), -1) < 1) return null;
    const wd = D.PROP_W.arch_mg, ht = D.PROP_H.arch_mg, cx = (Math.min(...xs) + Math.max(...xs) + 1) * TILE / 2, Y = (Math.max(...ys) + 1) * TILE + 2 - 0.35 * ht;
    return [[cx - wd / 2, Y + 0.4 * ht, cx - 0.2 * wd, Y + ht], [cx + 0.2 * wd, Y + 0.4 * ht, cx + wd / 2, Y + ht]]; };
  const onArchLeg = (legs, n, x, y) => { const w = D.PROP_W[n] || D.PROP_W.chest, h = D.PROP_H[n] || D.PROP_H.chest; return legs.some(([l, t, r, b]) => x + w / 2 > l && x - w / 2 < r && y > t && y - h < b); };

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
    const ends = m.rooms.filter((r) => deg[r.id] === 1 && !way.has(r.id) && ['combat', 'shrine'].includes(r.type));
    return { way, list, onWay: list.filter((q) => way.has(q.room)).length, ends, bare: ends.filter((r) => !list.some((q) => q.room === r.id)) };
  }

  // the start town (R-17, TASKS 1003): floor 0 of a run, the courtyard of a ruined fortress over the crypt, laid to a fixed plan
  // after the accepted reference (study/refs/ref_town.png, a tile ≈ 31 px of it; study/refs/README.md): the stairs down in the
  // gate at the top, the campfire and its tree in the middle of the square, the merchant top left, the forge and the enchanter
  // (one workshop, TASKS 1013) top right, the Altar of Souls and the storage chest right of the square, the notice board and the
  // portal's ring of stones below left, the mine on the right with its short rails to the mason's yard in the lower right corner,
  // clear of the way to the gate (TASKS 1151); the seed moves only the small things: decor, ruin stubs, ground decals, where the townsfolk stand
  const TOWN = { W: 56, H: 37,
    floor: [[4, 4, 48, 28]],
    // the outer ruins' ragged edge, the gate round the stairs, the services' back walls, the mine's rock and the wall over the rails
    rock: [[4, 4, 48, 4], [4, 8, 2, 2], [50, 8, 2, 3], [4, 29, 3, 3], [4, 13, 1, 3], [51, 26, 1, 6],
      [24, 8, 7, 3], [36, 14, 7, 2], [42, 14, 1, 5], [33, 21, 9, 2],
      [44, 18, 8, 4], [4, 10, 4, 2], [4, 16, 4, 2], [4, 22, 4, 2], [12, 26, 5, 2], [18, 26, 6, 2], [31, 26, 4, 2], [36, 26, 5, 2], [36, 16, 1, 2]],
    // (TASKS 1029) the long walls over the rails are broken, as the reference's ruins are; the enchanter's niche is closed on its left.
    // Niches carved out of the ruins' edge round the yard, each with its stores and a small fire (the left workshops are niches too);
    // the top row of services stands three cells in from the edge with niches behind it, as the reference's does (TASKS 1035)
    niches: [[7, 5, 3, 3], [11, 5, 3, 3], [16, 5, 3, 3], [23, 6, 9, 2], [33, 5, 2, 3], [37, 5, 3, 3], [42, 5, 3, 3], [47, 5, 2, 3], [52, 11, 2, 2], [52, 14, 2, 2], [8, 32, 3, 2], [24, 32, 3, 2], [44, 32, 3, 2]],
    // the cobbles (TASKS 1029): a round square about the fire and winding paths two or three cells wide off it to the services and the gate
    plaza: [27, 17.4, 4.6, 3.7], paths: [[27, 11], [17, 13], [36, 12], [36, 24], [22, 22], [16, 22], [27, 31], [47, 23]],
    stairs: [27, 11], fire: [27, 17], spawn: [24, 19], shop: [17, 11], anvil: [38, 11.4], forge: [39.3, 10], lectern: [39, 17], shelf: [37, 16],
    altar: [36, 23], chest: [39, 23], board: [22, 21], portal: [16, 22], tree: [31, 15], adit: [47, 22], bin: [46.6, 31], herbs: [44, 25],
    // the town's gate out (TASKS 1149): shut, in the bottom wall where the cobbled way off the square ends, as on the reference
    exitGate: [29, 31.8],
    // the portal's ring is open toward the square (no stone east of it); where a body stands to use each service (the checks walk a two-cell-wide body there from the spawn)
    use: { stairs: [27, 11], shop: [17, 13], altar: [36, 24], stash: [39, 24], anvil: [38, 13], lectern: [39, 18], board: [22, 22], portal: [16, 22], fire: [27, 19], adit: [47, 23], bin: [45, 31], exitGate: [29, 29] },
    braziers: [[25, 11], [29, 11]],
    benches: [[25, 16], [29, 19], [26, 20]],
    // the town's own lights (TASKS 1005): lanterns in the workshop niches, at the canvas stall, the well, the merchant, the portal and the rails' yard, the forge's coals, the
    // enchanter's runes, the Altar of Souls, the crypt's glow from below; the campfire and the gate's braziers are its torches
    lights: [['forge', 39, 10], ['runes', 39, 17], ['candle', 40, 17], ['altar', 36, 23], ['stash', 39, 23], ['crypt', 27, 11], ['adit', 47, 22], ['portal', 16, 22]],
    // its torches (TASKS 1029: lanterns on posts read as a street, the reference lights the ruins with torches): on the wall where
    // there is one right behind, else standing
    lamps: [[8, 13], [8, 19], [9, 25], [48, 11], [31, 28], [22, 8], [23, 28], [14, 28], [32, 31], [39, 28], [42, 27], [48, 29], [9, 8], [41, 8], [32, 8], [43, 15]],
    // trees in the courtyard's corners against the ruins, as round the reference's edge (beyond the walls the void swallows anything)
    edge: [[6, 10], [49, 8], [51, 14], [5, 14], [5, 27], [50, 30], [8, 30]],
    // the yard's own props after the reference: the log pile, the canvas stall, the well, the mine's pick rack and cart, the yard's stone and ore;
    // the workshop niches on the left with a work table, sacks, a crate and burning candles
    props: [['logs_tw', 44, 11], ['stall_tw', 47, 13], ['well_tw', 9, 19], ['picks_tw', 45, 23], ['stoneyard_tw', 36.6, 30], ['blocks_tw', 47.2, 29.5], ['ore_tw', 48.5, 31],
      ['table_candles', 6, 14], ['shop_sacks', 5, 21], ['shop_crate', 7, 24], ['candles', 5, 24]],
    rails: [[47, 22], [47, 23], [47, 24], [46, 25], [45, 26], [44, 27], [43, 28], [42, 29], [41, 30], [40, 30]],
    yardSolid: [[27, 30], [28, 30], [29, 30], [30, 30], [31, 30], [27, 31], [28, 31], [29, 31], [30, 31], [31, 31], [35, 29], [36, 29], [37, 29], [38, 29], [39, 29], [35, 30], [36, 30], [38, 30], [39, 30]],
    // the townsfolk's places (TASKS 1014–1015 put them there): each at its work, facing it; the cast is the player's (6 Nov 2026: no miner or gardener; 8 Nov 2026: a mason at the rails' end)
    // the rounds of those who walk (TASKS 1015): stops in cells, 'take' / 'drop' where the porter lifts and sets down his crate (from the
    // canvas stall to the merchant), the others pause at each stop to sweep or to scatter grain; the round loops back to the start
    routes: { porter: [[46, 15, 'take'], [44, 13], [34, 13], [22, 15], [22, 13, 'drop'], [22, 15], [34, 13], [44, 13]], sweeper: [[30, 21], [24, 23], [32, 24]], child: [[13, 18], [17, 18], [11, 16]], mason: [[41.3, 30, 'take'], [45.7, 30.4, 'drop']] },
    npcs: [['smith', 37, 11.4], ['enchanter', 40, 17], ['keeper', 29, 16], ['guard', 32, 12], ['porter', 32, 14], ['sweeper', 30, 21], ['child', 13, 18], ['hen', 12, 20], ['hen', 14, 20], ['hen', 11, 18], ['mason', 45.7, 30.4]],
    // heaps of fallen blocks at the broken ends of the ruins' walls (TASKS 1609)
    rubble: [[12, 28], [16.4, 28], [18, 28], [24, 28.6], [30.2, 28.6], [34.6, 28], [8, 11.6], [8, 17.6], [8, 23.6], [42.4, 22.4], [35.4, 24], [31, 11]],
    // the iron railings by the road south, and ivy down the ruins' faces (TASKS 1611, 1609)
    grates: [[24.6, 27.4], [29.4, 27.4], [35.4, 27.4]], ivy: [[13, 27.6], [21, 27.6], [32.5, 27.6], [38, 27.6], [6, 11.6], [6, 23.6], [38, 15.6], [46, 21.6]],
    // ruin stubs the seed picks some of, and spots for the small decor
    stubs: [[14, 8], [45, 8], [10, 27], [5, 26], [49, 13], [12, 14]],
    small: [['barrel', 13, 11], ['crate', 21, 11], ['basket_tw', 20, 14], ['bucket_tw', 41, 11], ['hay_tw', 33, 11], ['rack', 5, 12], ['table', 5, 18], ['crate', 6, 20], ['barrel', 6, 25],
      ['crate', 49, 11], ['barrel', 12, 30], ['wheel_tw', 47, 27], ['beam_tw', 35, 25], ['crate', 6, 27], ['barrel', 7, 12], ['crate', 6, 17],
      ['crate', 50, 12], ['barrel', 50, 16]],
    // what a niche keeps: its stores, and a small fire at the back
    store: ['barrel', 'crate', 'shop_sacks', 'shop_crate', 'barrel', 'crate'] };
  // a portal's ring of stones (TASKS 1037): the town's and a chapter boss's are one ring, eight stones round 240° with the gap
  // facing the angle open (radians), where the way in comes from
  const portalRing = (x, y, open) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = open + (60 + i * 240 / 7) * Math.PI / 180;
    return { x: x + Math.cos(a) * 2.4 * TILE, y: y + Math.sin(a) * 1.9 * TILE, n: i % 2 ? 'stone_tw_a' : 'stone_tw_b', s: i % 2 ? 0.85 : 1 }; });
  function genTown(seed) {
    const T = TOWN, W = T.W, H = T.H, cells = new Array(W * H).fill(0), R = mul32(seed >>> 0), wx = (x) => x * TILE + TILE / 2, wy = (y) => y * TILE + TILE / 2;
    const fill = ([x0, y0, w, h], v) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cells[y * W + x] = v; };
    for (const r of T.floor) fill(r, 1); for (const r of T.rock) fill(r, 0); for (const r of T.niches) fill(r, 1);
    const stubs = T.stubs.filter(() => R() < 0.5); for (const [x, y] of stubs) fill([x, y, 1 + (R() < 0.5 ? 1 : 0), 1], 0);
    const room = { x: 4, y: 4, w: 48, h: 28, type: 'town', id: 0 }; room.cx = 27; room.cy = 17;
    const at = ([x, y]) => ({ x: wx(x), y: wy(y) }), sanct = at(T.fire), exit = Object.assign(at(T.stairs), { tx: T.stairs[0], ty: T.stairs[1] });
    const spawn = { x: wx(T.spawn[0]) + Math.round((R() - 0.5) * 12), y: wy(T.spawn[1]) + Math.round((R() - 0.5) * 8) };
    // the forge's glow is the town's light (TASKS 1005), not a brazier's
    const torches = [{ x: sanct.x, y: sanct.y, kind: 'fire' }, ...T.braziers.map((p) => Object.assign(at(p), { kind: 'brazier' })),
      ...T.lamps.filter(([x, y]) => cells[(y - 1) * W + x] === 0).map(([x, y]) => ({ x: wx(x), y: y * TILE - 26, kind: 'wall' }))];
    const [sx, sy] = T.shop, cy = wy(sy + 1), shop = { room: 0, x: wx(sx), y: cy - 16, counter: { x: wx(sx), y: cy }, front: { x: wx(sx), y: cy + 30 },
      solid: [-1, 0, 1].map((i) => [wx(sx + i), cy]), lanterns: [] };
    // role: what each prop is to the town (services, townsfolk's work); the Altar of Souls and the storage chest are the game's own
    const decor = [
      // the town's altar and chest stand larger than the crypt's (TASKS 1029: ≈68 and ≈54 px against the reference's)
      { ...at(T.altar), n: 'altar', role: 'altar', solid: 1, s: 1.2 }, { ...at(T.chest), n: 'chest', role: 'stash', solid: 1, s: 1.25 }, { ...at(T.anvil), n: 'anvil_tw', role: 'anvil', solid: 1 },
      { ...at(T.forge), n: 'forge_tw', role: 'forge', solid: 1 }, { ...at(T.lectern), n: 'lectern_tw', role: 'lectern', solid: 1 }, { ...at(T.shelf), n: 'flasks_tw', role: 'shelf', solid: 1 },
      { ...at(T.board), n: 'board_tw', role: 'board', solid: 1 }, { ...at(T.tree), n: 'tree_tw', role: 'tree', solid: 1 }, { ...at(T.bin), n: 'orebin_tw', role: 'ore_bin', solid: 1 },
      { ...at(T.herbs), n: 'herbs_tw', role: 'herbs', solid: 1 }, { x: wx(T.adit[0]), y: wy(T.adit[1]) + 1, n: 'adit_tw', role: 'adit', solid: 1, s: 1.65 },
      { x: wx(sx), y: wy(sy - 1) + 12, n: 'awning_tw', role: 'stall' },
      { x: wx(T.exitGate[0]), y: T.exitGate[1] * TILE + 6, n: 'gate_tw', role: 'exit_gate', solid: 1 },
      ...T.benches.map((p) => ({ ...at(p), n: 'bench_tw', role: 'bench' })),
      ...T.props.map(([n, x, y]) => ({ ...at([x, y]), n, solid: 1 })),
      ...T.grates.map((p, i) => ({ ...at(p), n: ['grate_tw', 'grate_tw_b', 'grate_tw_c'][i], role: 'grate', solid: 1 })), ...T.ivy.map((p, i) => ({ ...at(p), n: i % 3 === 1 ? 'ivy_tw_b' : 'ivy_tw', role: 'ivy', s: 0.75 + 0.15 * (i % 3), f: i % 2 ? -1 : 1 })),
      // a hash, not R(): the decals after this list keep the layouts of saved towns
      ...Array.from({ length: W * H }, (_, k) => k).flatMap((k) => { const x = k % W, y = Math.floor(k / W), h = (x * 73 + y * 37) % 100; if (cells[k] !== 0 || cells[k + W] !== 1 || y < 2 || x < 2 || x > W - 3) return [];
        const px = (x + 0.5) * TILE, py = (y - 1) * TILE + 8, opR = cells[k + 1] === 1 || cells[k + 1 + W] === 0, opL = cells[k - 1] === 1 || cells[k - 1 + W] === 0;
        const v = (x * 11 + y * 5) % 7, big = v === 3;
        if (opR && !opL) return v % 3 === 0 && !big ? [] : [{ x: px + 2 - v, y: py + (v % 2) * 3, n: big ? 'wall_end_tw_c' : 'wall_end_tw_a', role: 'wall_end', s: 0.8 + 0.06 * v }];
        if (opL && !opR) return v % 3 === 1 ? [] : [{ x: px - 2 + v, y: py + (v % 2) * 3, n: big ? 'wall_end_tw_d' : 'wall_end_tw_b', role: 'wall_end', s: 0.8 + 0.06 * v }];
        return h < 12 ? [{ x: px + (h % 5) * 3 - 6, y: py + (h % 3) * 2, n: ['wall_end_tw_d', 'wall_end_tw_c', 'wall_end_tw_a', 'wall_end_tw_b'][h % 4], role: 'wall_end', f: h % 3 ? 1 : -1, s: 0.7 + 0.05 * (h % 5) }] : []; }),
      ...T.rubble.map(([x, y], i) => ({ ...at([x, y]), n: 'blocks_tw', role: 'rubble', s: 0.6 + 0.1 * (i % 4), f: i % 2 ? -1 : 1 })),
      // the portal's ring, open toward the square; a horseshoe of small stones round the forge's back
      ...portalRing(wx(T.portal[0]), wy(T.portal[1]), 0).map((q) => ({ ...q, role: 'portal_stone', solid: 1 })),
      ...T.lamps.filter(([x, y]) => cells[(y - 1) * W + x] === 1).map(([x, y], i) => ({ ...at([x, y]), n: 'torch_stand', alt: i % 3 === 1 ? 'torch_stand_b' : undefined, role: 'lamp', solid: 1 })),
            // three trees round the edge, not one six times (TASKS 1030)
      ...T.edge.map(([x, y], i) => ({ ...at([x, y]), n: ['tree_tw_b', 'tree_tw_c', 'tree_tw'][i % 3], role: 'edge', solid: 1, s: (100 + (i * 7) % 21) / [76, 60, 70][i % 3], f: (i >> 1) % 2 })),
      // the rim beyond the walls is ruin and overgrowth, not a tiled floor (TASKS 1431, 1623)
      ...Array.from({ length: 24 }, (_, i) => { const u = ((i * 61 + 17) % 97) / 97, dp = 1 + (i * 13 % 3), sd = i % 4, x = sd === 2 ? dp : sd === 3 ? W - 1 - dp : 3 + u * (W - 6), y = sd === 0 ? dp : sd === 1 ? H - 1 - dp : 3 + u * (H - 6), n = ['blocks_tw', 'tree_tw_c', 'blocks_tw', 'tree_tw_b', 'stone_tw_a', 'blocks_tw'][i % 6]; return cells[Math.floor(y) * W + Math.floor(x)] === 0 ? { x: Math.round(x * TILE), y: Math.round(y * TILE), n, role: 'edge', s: n.startsWith('tree') ? 1.2 : 0.8 + 0.1 * (i % 4), f: i % 2 } : null; }).filter(Boolean),
      ...T.small.filter(() => R() < 0.9).map(([n, x, y]) => ({ x: wx(x) + Math.round((R() - 0.5) * 10), y: wy(y) + Math.round((R() - 0.5) * 6), n, solid: 1 })),
      // each niche: its stores along the back and a few candles burning among them
      ...T.niches.flatMap(([x0, y0, w, h], k) => { const out = [], back = y0 < 10 ? y0 : y0 + h - 1, side = x0 > 50;
        const spots = side ? [[x0 + 1, y0], [x0 + 1, y0 + 1], [x0, y0]] : Array.from({ length: w }, (_, i) => [x0 + i, back]);
        const fire = Math.floor(R() * spots.length);
        spots.forEach(([x, y], i) => { if (i === fire) out.push({ x: wx(x), y: wy(y) + 4, n: 'candles', role: 'niche_fire', solid: 1 });
          else if (R() < 0.85) out.push({ x: wx(x) + Math.round((R() - 0.5) * 8), y: wy(y) + Math.round((R() - 0.5) * 4), n: T.store[Math.floor(R() * T.store.length)], solid: 1 }); });
        return out; })];
    const rails = T.rails.map(([x, y]) => y * W + x);
    // the square: an ellipse round the fire; each path leaves its edge and winds (a half-wave and a smaller full one, the seed's
    // phase and side) to where its service is used, two or three cells wide
    const pv = new Set(), dab = (cx, cy, r) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r && cells[y * W + x] === 1) pv.add(y * W + x); };
    { const [fx, fy, rx, ry] = T.plaza; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x + 0.5 - fx) / rx) ** 2 + ((y + 0.5 - fy) / ry) ** 2 <= 1 && cells[y * W + x] === 1) pv.add(y * W + x);
      for (const [tx, ty] of T.paths) { const a = Math.atan2(ty + 0.5 - fy, tx + 0.5 - fx), sx0 = fx + Math.cos(a) * rx * 0.8, sy0 = fy + Math.sin(a) * ry * 0.8, ex = tx + 0.5, ey = ty + 0.5;
        const L0 = Math.hypot(ex - sx0, ey - sy0), nx = -(ey - sy0) / L0, ny = (ex - sx0) / L0, amp = Math.min(1.6, L0 * 0.14) * (R() < 0.5 ? -1 : 1), k2 = 0.35 * (R() - 0.5), r = R() < 0.5 ? 1.05 : 1.45;
        for (let q = 0; q <= 1; q += 0.5 / L0) { const o = amp * Math.sin(Math.PI * q) + k2 * L0 * 0.1 * Math.sin(2 * Math.PI * q); dab(sx0 + (ex - sx0) * q + nx * o, sy0 + (ey - sy0) * q + ny * o, r); } } }
    dab(T.portal[0] + 0.5, T.portal[1] + 0.5, 1.7);
    const pave = [...pv];
    const npcs = T.npcs.map(([role, x, y]) => Object.assign({ role, x: wx(x) + Math.round((R() - 0.5) * 10), y: wy(y) + Math.round((R() - 0.5) * 6) },
      T.routes[role] ? { route: T.routes[role].map(([x, y, act]) => Object.assign({ x: wx(x), y: wy(y) }, act ? { act } : {})) } : {}));
    const near = (x, y, r) => decor.some((d) => Math.hypot(d.x - x, d.y - y) < r) || Math.hypot(sanct.x - x, sanct.y - y) < 3 * TILE || rails.includes(Math.floor(y / TILE) * W + Math.floor(x / TILE));
    const decals = [];
    // separate tufts over the earth (TASKS 1030: its texture keeps only fine grain, so the tile's repeat does not show)
    for (let i = 0; i < 150; i++) { const x = (4 + R() * 48) * TILE, y = (4 + R() * 28) * TILE; if (cells[Math.floor(y / TILE) * W + Math.floor(x / TILE)] !== 1 || near(x, y, 30)) continue;
      decals.push({ x, y, n: ['dc_grass_tw', 'dc_grass_tw_b', 'dc_leaves_tw', 'dc_grass_tw', 'dc_grass_tw', 'dc_leaves_tw'][Math.floor(R() * 6)], f: R() < 0.5 ? 1 : -1, s: 0.7 + R() * 0.5 }); }
    // moss in patches round the yard, thicker by the ruins, none on the cobbles (TASKS 1608)
    for (let i = 0; i < 240; i++) { const cx = (4 + R() * 48) * TILE, cy = (4 + R() * 28) * TILE, n = 3 + Math.floor(R() * 4);
      for (let j = 0; j < n; j++) { const x = cx + (R() - 0.5) * 90, y = cy + (R() - 0.5) * 60, k = Math.floor(y / TILE) * W + Math.floor(x / TILE); if (cells[k] !== 1 || pv.has(k) || near(x, y, 24)) continue;
        decals.push({ x, y, n: ['dc_moss_tw_a', 'dc_moss_tw_b', 'dc_grass_tw', 'dc_grass_tw_b', 'dc_fern_tw', 'dc_fern_tw_b', 'dc_bush_tw', 'dc_grass_tw', 'dc_moss_tw_b'][Math.floor(R() * 9)], f: R() < 0.5 ? 1 : -1, s: 0.8 + R() * 0.6 }); } }
    // greenery gathers where ground meets stone (TASKS 1432, 1429): a thick fringe at the foot of the walls and moss crumbling over the paving's edge
    for (let y = 2; y < H - 1; y++) for (let x = 2; x < W - 2; x++) { const k = y * W + x; if (cells[k] !== 1 || pv.has(k)) continue; const wallBy = cells[k - W] === 0 || cells[k - 1] === 0 || cells[k + 1] === 0, paveBy = pv.has(k - W) || pv.has(k + W) || pv.has(k - 1) || pv.has(k + 1);
      if (!wallBy && !paveBy) continue; for (let j = 0, n = wallBy ? 2 : 1; j < n; j++) { const px = (x + R()) * TILE, py = (y + R()) * TILE; if (R() < (wallBy ? 0.2 : 0.45) || near(px, py, 22)) continue;
        decals.push({ x: px, y: py, n: wallBy ? ['dc_fern_tw', 'dc_fern_tw_b', 'dc_grass_tw_b', 'dc_grass_tw', 'dc_bush_tw', 'dc_flowers_tw_a', 'dc_flowers_tw_b', 'dc_moss_tw_a'][Math.floor(R() * 8)] : ['dc_moss_tw_a', 'dc_moss_tw_b', 'dc_grass_tw'][Math.floor(R() * 3)], f: R() < 0.5 ? 1 : -1, s: 0.75 + R() * 0.55 }); } }
    for (const [k, r] of [[T.lectern, 2.2], [T.portal, 2]]) for (let i = decals.length - 1; i >= 0; i--) if (Math.hypot(decals[i].x - wx(k[0]), decals[i].y - wy(k[1])) < r * TILE) decals.splice(i, 1);
    for (let i = 0; i < 12; i++) { const a = i * 2.4, r = (2.7 + 0.08 * (i * 7 % 9)) * TILE, x = wx(T.portal[0]) + Math.cos(a) * r, y = wy(T.portal[1]) + Math.sin(a) * r * 0.8; if (cells[Math.floor(y / TILE) * W + Math.floor(x / TILE)] === 1) decals.push({ x, y, n: ['dc_flowers_tw_a', 'dc_grass_tw', 'dc_flowers_tw_b', 'dc_grass_tw_b'][i % 4], f: i % 2 ? 1 : -1, s: 0.8 + 0.05 * (i % 5) }); }
    for (const d of decals) { d.x = Math.round(d.x); d.y = Math.round(d.y); d.s = Math.round(d.s * 100) / 100; }
    const svc = { stairs: exit, fire: sanct, shop: shop.front, altar: at(T.altar), stash: at(T.chest), anvil: at(T.anvil), lectern: at(T.lectern), board: at(T.board), portal: at(T.portal), adit: at(T.adit), bin: at(T.bin), exitGate: at(T.use.exitGate) };
    // the town's solid props on the block, as on a floor (TASKS 1024: with it empty the bot's way to the ring of stones ran through the
    // merchant's counter, and it stood behind it for good on seed 52)
    const block = []; const bk = (x, y) => { const k = Math.floor(y / TILE) * W + Math.floor(x / TILE); if (!block.includes(k)) block.push(k); };
    for (const d of decor) if (d.solid) bk(d.x, d.y); for (const t of torches) if (t.kind !== 'wall') bk(t.x, t.y); for (const [x, y] of shop.solid) bk(x, y); for (const [x, y] of T.yardSolid) bk(wx(x), wy(y));
    // deprecated: kept for the map hash (GEN_PRINT, mapPrint); not ported to Godot (rugs, ambush)
    return { seed, floor: 0, town: { svc, use: T.use, rails, yardSolid: T.yardSolid.map(at), pave, npcs, lights: T.lights.map(([kind, x, y]) => ({ kind, ...at([x, y]) })) }, biome: 'town', arch: 'town', cliff: null, W, H, cells, rooms: [room], block, decals, edges: [], start: 0, exitRoom: 0, exit, spawn, sanct,
      ftype: null, ftype2: null, shareOf: null, bossType: undefined, walk: cells.filter((c) => c === 1).length, down: null, enemies: [], chests: [], pots: [], traps: [], torches,
      decor, shrines: [], rugs: [], shop, secrets: [], secretsWanted: 0, pits: [], ledges: [], lava: 0, lavaFlow: {}, crust: [], lavaUnder: [], chasmUnder: [], lavaFeatures: [], lavaBodies: [], streams: [],
      water: [], waterFlow: {}, waterFeatures: [], waterBridges: [], deep: 0, crossings: [], doors: [], locks: [], webs: [], ambush: [], drips: [], flora: [], serpentPools: [], floodCells: [] };
  }
  // where a body can stand in the town (TASKS 1003): open floor clear of its solid props (Node checks walk to every service over it)
  function townWalk(m) { const ok = m.cells.map((c) => c === 1), off = (x, y) => { const k = Math.floor(y / TILE) * m.W + Math.floor(x / TILE); ok[k] = false; };
    for (const d of m.decor) if (d.solid) off(d.x, d.y); for (const t of m.torches) if (t.kind !== 'wall') off(t.x, t.y); if (m.shop) for (const [x, y] of m.shop.solid) off(x, y); for (const p of m.town.yardSolid) off(p.x, p.y);
    return ok; }

  // room index of a world point (or -1 in a corridor); a secret room first: a plateau's box may hold one (TASKS 422)
  const roomAt = (map, x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), inR = (r) => inRm(r, tx, ty);
    for (const r of map.rooms) if (r.type === 'secret' && inR(r)) return r.id;
    for (const r of map.rooms) if (inR(r)) return r.id; return -1; };

  const fogHash = (x, y) => { const q = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return q - Math.floor(q); };
  const fogNoise = (x, y) => { const gx = x / 3, gy = y / 3, x0 = Math.floor(gx), y0 = Math.floor(gy), fx0 = gx - x0, fy0 = gy - y0, sx0 = fx0 * fx0 * (3 - 2 * fx0), sy0 = fy0 * fy0 * (3 - 2 * fy0);
    return (fogHash(x0, y0) * (1 - sx0) + fogHash(x0 + 1, y0) * sx0) * (1 - sy0) + (fogHash(x0, y0 + 1) * (1 - sx0) + fogHash(x0 + 1, y0 + 1) * sx0) * sy0; };
  // k: how much wider the oval is (the player's decision on 1636: arriving on a magma floor shows more of it)
  const FOG_ARRIVE = 2.4, inFogOval = (x, y, fx, fy, k = 1) => ((x + 0.5 - fx) / (8.5 * k)) ** 2 + ((y + 0.5 - fy) / (6.5 * k)) ** 2 <= (0.72 + 0.28 * fogNoise(x, y) + (fogHash(x + 31, y + 17) - 0.5) * 0.2) ** 2;
  const fogReach = (x, y) => 1.6 + 1.6 * fogNoise(x, y) + (fogHash(x + 7, y + 91) - 0.5) * 1.4;
  // where the hero comes out of the stairs up (TASKS 1958): the sim stands him here (sim_floor.js arrive), the generator keeps its
  // arrival gap and its pool of lava in view round it (in the magma wall a cell lower and aside, TASKS 1930)
  const arrivalAt = (up, biome) => (biome === 'magma' && !up.free ? [up.x + 34, up.y + 46 + TILE] : [up.x, up.y + 46]);
  root.DUNGEON = { FOG_ARRIVE, arrivalAt, fogHash, fogNoise, inFogOval, fogReach, genFloor, specials, genTown, townWalk, TOWN, portalRing, roomAt, inRm, rectsOf, LIGHT_R, straightRuns, narrowTo, wayRooms, rewardsOf, riverWays, riverOk, riverAt, archLegs, onArchLeg };
  // what tryGen's stages (dungeon_rooms/links/terrain/fill.js, ARCHITECTURE.md §4.2) read from this file; in Node they are required here
  Object.assign(DGX, { archLegs, arrivalAt, onArchLeg, FOG_ARRIVE, fogReach, inFogOval, D, ENEMIES, LIGHT_R, NO_SHOP, TILE, WALK_FAR, crossCuts, inRm, lakeOk, lakeWays, mul32, shuffleBy, narrowTo, noise2, rectsOf, rewardsOf,
    riverAt, riverOk, riverWays, straightRuns, wayRooms });
  if (typeof module !== 'undefined') { for (const f of require('./modules.js').parts.dungeon) require('./' + f); module.exports = root.DUNGEON; }
})(typeof window !== 'undefined' ? window : globalThis);
