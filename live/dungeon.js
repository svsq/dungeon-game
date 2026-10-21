// live/dungeon.js — procedural floor generator: genFloor(seed, floor) → plain JSON map data. Pure function of its inputs.
// Rooms placed at random without overlap → MST + extra loop edges → 2-wide L corridors → start room at a leaf,
// exit room farthest by graph distance (floor 8: the boss lair) → room roles → contents (enemies, chests, pots, traps,
// lava, torches, decor) → validation (everything reachable from the start, spawns on open floor).
(function (root) {
  const D = root.DATA || require('./data.js');
  const { TILE, ENEMIES } = D;
  // how far each light source reaches, in tiles (matches the glow radii of the scene's light map)
  const LIGHT_R = { wall: 6.5, brazier: 6.5, fire: 8.5, candles: 3, crystal: 6.5, shrine: 6 };
  // cells: 0 rock, 1 floor, 3 lava (blocks walking, not projectiles), 4 a secret room's fake wall (solid until broken)
  const mul32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  function genFloor(seed, floor, opts = {}) {
    // a floor without a secret room is rerolled a few times before one is accepted, unless it meant to have none
    for (let attempt = 0; attempt < 20; attempt++) { const m = tryGen((seed + attempt * 7919) >>> 0, floor, opts); if (m && (m.secrets.length || !m.secretsWanted || attempt >= 12)) return m; }
    throw new Error('dungeon generation failed');
  }

  function tryGen(seed, floor, opts) {
    const R = mul32(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = (arr) => arr[Math.floor(R() * arr.length)];
    const biome = D.biomeOf(floor), boss = floor === D.FLOORS && !opts.endless;
    const W = 72, H = 54, cells = new Array(W * H).fill(0), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : cells[y * W + x]);
    const set = (x, y, v) => { if (x > 1 && y > 2 && x < W - 2 && y < H - 2) cells[y * W + x] = v; };
    // ---- rooms ----
    const rooms = [], want = 13 + Math.min(4, floor >> 1);
    for (let i = 0; i < 900 && rooms.length < want; i++) {
      const big = rooms.length === 0 && boss;
      const w = big ? 18 : ri(7, 14), h = big ? 14 : ri(6, 10), x = ri(3, W - w - 3), y = ri(4, H - h - 3);
      if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'combat', id: rooms.length });
    }
    if (rooms.length < 8) return null;
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, 1);
    // ---- connections: Prim MST on centre distance + extra short edges for loops ----
    const dist = (a, b) => Math.hypot(a.cx - b.cx, (a.cy - b.cy) * 1.2);
    const inT = new Set([0]), edges = [];
    while (inT.size < rooms.length) { let best = null;
      for (const a of inT) for (let b = 0; b < rooms.length; b++) if (!inT.has(b)) { const d = dist(rooms[a], rooms[b]); if (!best || d < best[2]) best = [a, b, d]; }
      edges.push(best); inT.add(best[1]); }
    for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) {
      if (edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) continue;
      const d = dist(rooms[a], rooms[b]); if (d < 26 && R() < 0.28) edges.push([a, b, d]); }
    const carveH = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { if (!at(x, y)) set(x, y, 1); if (!at(x, y + 1)) set(x, y + 1, 1); } };
    const carveV = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { if (!at(x, y)) set(x, y, 1); if (!at(x + 1, y)) set(x + 1, y, 1); } };
    for (const [a, b] of edges) { const A = rooms[a], B = rooms[b];
      if (R() < 0.5) { carveH(A.cx, B.cx, A.cy); carveV(A.cy, B.cy, B.cx); } else { carveV(A.cy, B.cy, A.cx); carveH(A.cx, B.cx, B.cy); } }
    const adj = rooms.map(() => []); for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
    // ---- roles: start at a leaf on the rim, exit farthest by hops then distance ----
    const hops = (from) => { const h = rooms.map(() => 99), q = [from.id]; h[from.id] = 0;
      while (q.length) { const a = q.shift(); for (const b of adj[a]) if (h[b] > h[a] + 1) { h[b] = h[a] + 1; q.push(b); } } return h; };
    let leaves = rooms.filter((r) => adj[r.id].length === 1 && !(boss && r.id === 0));
    // the boss hall is fixed (the biggest room), so the start is among the rooms farthest from it on foot (rim leaves first), or the
    // boss was a room away; the walk is counted on the carved cells, not by room hops: corridors cut through rooms and merge
    if (boss) { const d = new Array(W * H).fill(-1), q = [rooms[0].cy * W + rooms[0].cx], at0 = (r) => d[r.cy * W + r.cx]; d[q[0]] = 0;
      for (let i = 0; i < q.length; i++) { const c = q[i]; for (const n of [c - 1, c + 1, c - W, c + W]) if (cells[n] && d[n] < 0) { d[n] = d[c] + 1; q.push(n); } }
      const farAll = Math.max(...rooms.map(at0)); if (!leaves.some((r) => at0(r) >= farAll * 0.6)) leaves = rooms.slice(1);
      const far = Math.max(...leaves.map(at0)); leaves = leaves.filter((r) => at0(r) >= far * 0.8); }
    const start = (leaves.length ? pick(leaves) : rooms[rooms.length - 1]);
    const hop = hops(start);
    const exitR = boss ? rooms[0] : rooms.filter((r) => r !== start).sort((p, q2) => (hop[q2.id] - hop[p.id]) || (dist(q2, start) - dist(p, start)))[0];
    start.type = 'start'; exitR.type = boss ? 'boss' : 'exit';
    // a Fisher–Yates shuffle: a random sort comparator gives each JS engine its own order, so node checks would see other maps than the browser
    const others = rooms.filter((r) => r.type === 'combat'); for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    const nTreasure = 1 + (R() < 0.5 ? 1 : 0);
    others.slice(0, nTreasure).forEach((r) => (r.type = 'treasure'));
    // an altar on every second floor (TASKS 137): the roll stays so the rest of the floor is laid out as before
    R(); if (floor % 2 === 0) (others[nTreasure] || others[0] || rooms.find((r) => r.type === 'treasure') || {}).type = 'shrine';
    // the merchant's room, on every floor: the counter and his back wall need a solid top wall and no corridor mouth near them
    const isDoor = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const nx = x + i, ny = y + j;
      if (at(nx, ny) === 1 && !rooms.some((q) => nx >= q.x && nx < q.x + q.w && ny >= q.y && ny < q.y + q.h)) return true; } return false; };
    const shopFits = (r) => { if (r.w < 8 || r.h < 6) return false;
      for (let x = r.cx - 3; x <= r.cx + 3; x++) { if (Math.abs(x - r.cx) <= 2 && at(x, r.y - 1) !== 0) return false; for (let y = r.y; y <= r.y + 3; y++) if (isDoor(x, y)) return false; }
      return true; };
    const shopR = others.find((r) => r.type === 'combat' && shopFits(r));
    if (!shopR) return null;
    shopR.type = 'shop';
    for (const r of others) if (r.type === 'combat' && R() < 0.35 && r.w >= 8) r.trap = 1;
    // accent zones: one or two rooms per floor in another biome's look (the reference shows a green crypt and a blue hall
    // beside the torch-lit dungeon in one view)
    const zones = ['crypt', 'arcane', 'dungeon'].filter((z) => z !== biome);
    others.filter((r) => r.type === 'combat' || r.type === 'treasure').slice(0, 1 + (R() < 0.6 ? 1 : 0)).forEach((r, i) => (r.zone = zones[(i + Math.floor(R() * 2)) % zones.length]));
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
    // a fire floor without a single pool reads as the wrong biome: a second pass that skips the roll
    if (D.BIOMES[biome].lava || boss) for (let pass = 0; pass < 2 && !lava.length; pass++) for (const r of rooms) {
      if (r.type !== 'start' && r.type !== 'shop' && r.w >= 8 && r.h >= 6 && (pass || R() < (boss ? 1 : 0.75))) pool(r); }
    function connected() { const seen = new Uint8Array(W * H), st = [[start.cx, start.cy]]; seen[start.cy * W + start.cx] = 1;
      while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
        if ((at(nx, ny) === 1 || at(nx, ny) === 4) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; st.push([nx, ny]); } } }
      for (let i = 0; i < W * H; i++) if (cells[i] === 1 && !seen[i]) return false; return true; }
    if (!connected()) return null;
    // ---- secret rooms: anywhere off a straight stretch of wall (a room's or a corridor's, any side but the shop's), a small room
    // behind a two-cell-thick fake wall (cell 4: solid, drawn as rock, breaks under blows) and a short passage. How many is
    // left to chance (1–10, fewer when the rock has no room for them; none at all only on the boss's floor, and rarely), so the
    // player never knows when a floor is cleaned out ----
    const secrets = [];
    const secretsWanted = boss && R() < 0.06 ? 0 : 1 + Math.floor(Math.pow(R(), 1.8) * 10);
    { const want = secretsWanted, DIRS = [[0, -1, 'u'], [0, 1, 'd'], [-1, 0, 'l'], [1, 0, 'r']];
      const shopRoom = rooms.find((q) => q.type === 'shop');
      const inShop = (x, y) => x >= shopRoom.x - 1 && x <= shopRoom.x + shopRoom.w && y >= shopRoom.y - 1 && y <= shopRoom.y + shopRoom.h;
      const rockAt = (x, y) => x >= 2 && y >= 3 && x <= W - 3 && y <= H - 3 && at(x, y) === 0;
      for (let k = 0; k < 8000 && secrets.length < want; k++) {
        const hx = ri(2, W - 3), hy = ri(3, H - 3), [dx, dy, dir] = DIRS[Math.floor(R() * 4)], px = dy ? 1 : 0, py = dx ? 1 : 0;
        // (depth, lateral) → cell: depth runs from the host floor (0) into the rock, lateral 0–1 is the two-cell-wide opening
        const C = (d, l) => [hx + dx * d + px * l, hy + dy * d + py * l];
        const all = (d0, d1, l0, l1, f) => { for (let d = d0; d <= d1; d++) for (let l = l0; l <= l1; l++) if (!f(...C(d, l))) return false; return true; };
        // a straight stretch of wall with open floor in front of it, clear of the shop
        if (!all(-1, 0, -1, 2, (x, y) => at(x, y) === 1 && !inShop(x, y)) || !all(1, 2, -1, 2, rockAt)) continue;
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
        const kind = pick(dir === 'u' ? ['crack', 'banner', 'banner', 'shelf', 'shelf', 'lever', 'lever'] : ['crack', 'crack', 'lever', 'lever', 'lever']);
        secrets.push({ room: sr.id, dir, dx, dy, x: ex, y: ey, wall, hide, front, hp: 2, open: 0, kind }); } }
    // ---- shallow water (dungeon, crypt and hall floors): a few pools on a room's floor, clear of its ways in; the cells stay
    // floor (anyone wades through, slowed, and a burning one is put out: sim.js) and keep props and posts off them ----
    const water = []; let pools = 0;
    if (!D.BIOMES[biome].lava && !boss) for (const r of rooms) { if (pools >= 3 || r.type === 'start' || r.type === 'shop' || r.type === 'secret' || r.w < 7 || r.h < 6 || R() > 0.35) continue;
      for (let k = 0; k < 6; k++) { const pw = ri(2, Math.min(4, r.w - 4)), ph = ri(2, Math.min(3, r.h - 4)), px = ri(r.x + 1, r.x + r.w - 1 - pw), py = ri(r.y + 2, r.y + r.h - 1 - ph), got = [];
        for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) { if ((x === px || x === px + pw - 1) && (y === py || y === py + ph - 1) && pw > 2 && ph > 2 && R() < 0.6) continue;
          if (at(x, y) === 1 && !isDoor(x, y) && !isDoor(x - 1, y) && !isDoor(x + 1, y) && !isDoor(x, y - 1) && !isDoor(x, y + 1) && !water.includes(y * W + x)) got.push(y * W + x); }
        if (got.length >= 3) { water.push(...got); pools++; break; } } }
    // ---- doors (TASKS 77, 78): a room whose every way in is a clean two-cell mouth in a straight wall may get a door in each, on
    // the first corridor cells past its edge, so the room stays unseen until one opens. One such room a floor may be locked, but
    // only one the floor can do without: shutting it cuts nothing else off, and its key or lever lies on this side (placed below,
    // once the rooms are furnished) ----
    const doors = [], locks = [];
    { const inAny = (x, y) => rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
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
      if (R() < (floor === 1 ? 0.5 : 0.8)) { const lk = cand.filter(([r, ds]) => r.type !== 'exit' && spare(r, ds)).sort(([a], [b]) => (b.type === 'treasure') - (a.type === 'treasure'))[0];
        if (lk) { for (const d of lk[1]) { d.lock = 0; doors.push(d); } locks.push({ room: lk[0].id, kind: '', open: 0 }); lk[0].locked = lk[0].doors = 1; if (lk[0].w >= 8 && R() < 0.35) lk[0].trap = 1; } }
      let n = 0; const want = ri(1, 3) + (floor >= 4 ? 1 : 0);
      for (const [r, ds] of cand) { if (n >= want) break; if (r.locked || clash(ds)) continue; r.doors = 1; doors.push(...ds); n++; } }
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
    for (const k of water) used.add(key(k % W, Math.floor(k / W)));
    const wx = (x) => x * TILE + TILE / 2, wy = (y) => y * TILE + TILE / 2 + 6;
    const enemies = [], chests = [], pots = [], traps = [], torches = [], decor = [], shrines = [], rugs = [];
    // the top wall: what hangs on it (torches, sconces, banners, the shop sign) and the tall props standing against it (columns,
    // statues, racks, shelves) must not overlap across their drawn widths, whichever came first: a prop would hide a sconce that
    // works a secret, or a torch would stick out of a statue's head
    const HANG = { wall: 14, banner: 18, shop_sign: 22 };
    const hungAt = (px, ry, hw) => torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.y - (ry * TILE - 26)) < TILE && Math.abs(t.x - px) < hw + HANG.wall)
      || decor.some((d) => HANG[d.n] && Math.abs(d.y - ry * TILE) < 2 * TILE && Math.abs(d.x - px) < hw + HANG[d.n]) || doorTop(px, ry, hw);
    // a door in a top wall stands in a stone arch wider than its corridor
    const doorTop = (px, ry, hw) => doors.some((d) => d.dir === 'u' && d.y === ry * TILE && Math.abs(d.x - px) < hw + 58);
    const tallAt = (px, ry, hw) => decor.some((d) => d.solid && Math.abs(d.y - (ry * TILE + 22)) < 4 && Math.abs(d.x - px) < hw + half(d.n));
    // stairs / boss altar
    const sx = exitR.cx, sy = exitR.cy; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 2; i++) used.add(key(sx + i, sy + j));
    const exit = { x: sx * TILE + TILE, y: sy * TILE + TILE / 2, tx: sx, ty: sy };
    for (let j = -1; j <= 3; j++) for (let i = -1; i <= 1; i++) used.add(key(start.cx + i, start.cy + j));   // the bonfire and the spawn tiles
    const roster = D.BIOMES[biome].roster, lvl = floor;
    const addEnemy = (type, x, y, room, elite = 0) => enemies.push({ type, x: wx(x), y: wy(y), room, elite });
    for (const r of rooms) if (r.type === 'shrine') claim(r.cx, r.cy, 'altar');   // the altar's cell first: props are placed around it
    // no corner of a room is left in the dark: while some floor cell lies outside every light's reach, light the cell
    // nearest to it, preferring a sconce on the top wall, then on a side wall, then a brazier, then candles
    const lightRoom = (r, extra, wallOnly) => {
      const inR = (o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= (r.y - 1) * TILE && o.y < (r.y + r.h) * TILE;
      const lights = torches.filter((t) => t.r === r.id).map((t) => [t.x, t.y, LIGHT_R[t.kind]])
        .concat(decor.filter((d) => LIGHT_R[d.n] && inR(d)).map((d) => [d.x, d.y, LIGHT_R[d.n]]), shrines.filter(inR).map((s) => [s.x, s.y, LIGHT_R.shrine]), extra);
      if (r.id === start.id) lights.push([wx(start.cx), wy(start.cy), LIGHT_R.fire]);
      const reach = (x, y) => Math.min(...lights.map(([lx, ly, lr]) => Math.hypot(lx - wx(x), (ly - wy(y)) / 0.8) / (lr * TILE)));
      for (let k = 0; k < 12; k++) { let dark = null;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (at(x, y) === 1) { const v = lights.length ? reach(x, y) : 9; if (v > 1 && (!dark || v > dark[2])) dark = [x, y, v]; }
        if (!dark) break;
        const cand = [];
        for (let x = r.x; x < r.x + r.w; x++) if (!at(x, r.y - 1) && at(x, r.y) === 1 && !doorway(x, r.y) && !tallAt(wx(x), r.y, HANG.wall) && !doorTop(wx(x), r.y, HANG.wall) && !torches.some((t) => t.kind === 'wall' && Math.abs(t.x - wx(x)) < 2 * TILE && Math.abs(t.y - r.y * TILE) < TILE) && !decor.some((d) => d.n === 'banner' && Math.abs(d.x - wx(x)) < 1.5 * TILE && Math.abs(d.y - r.y * TILE) < TILE))
          cand.push([x, r.y, 0, { x: wx(x), y: r.y * TILE - 26, kind: 'wall', r: r.id }]);
        for (let y = r.y + 1; y < r.y + r.h; y++) for (const [x, s] of [[r.x, -1], [r.x + r.w - 1, 1]]) if (!at(x + s, y) && free(x, y) && !doorway(x, y))
          cand.push([x, y, 0.5, { x: s < 0 ? x * TILE + 14 : (x + 1) * TILE - 14, y: y * TILE + 4, kind: 'wall', side: s, r: r.id, cell: [x, y] }]);
        for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (!wallOnly && free(x, y) && !doorway(x, y)) {
          if (r.type !== 'start' && roomy(x, y, 'brazier')) cand.push([x, y, 1.5, { x: wx(x), y: wy(y), kind: 'brazier', r: r.id, cell: [x, y], big: 1 }]);
          cand.push([x, y, 3, { x: wx(x), y: wy(y), n: 'candles', cell: [x, y] }]); }
        if (!cand.length) break;
        const best = cand.reduce((a, b) => (Math.hypot(b[0] - dark[0], b[1] - dark[1]) + b[2] < Math.hypot(a[0] - dark[0], a[1] - dark[1]) + a[2] ? b : a))[3];
        if (best.cell) { used.add(key(...best.cell)); if (best.big) claim(...best.cell, 'brazier'); }
        delete best.cell; delete best.big;
        if (best.n) decor.push(best); else torches.push(best);
        lights.push([best.x, best.y, LIGHT_R[best.n || best.kind]]); } };
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
      along('shop_gold'); along('shop_crate'); lightRoom(r, shop.lanterns.map((q) => [q.x, q.y, LIGHT_R.wall]).concat([[shop.x, shop.y, LIGHT_R.fire]]), true); }
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
      const kinds = r.type === 'start' ? ['store'] : r.type === 'boss' || r.type === 'shrine' ? ['hall', 'gallery', 'crypt', 'sanctum'] : Object.keys(D.ROOM_PLANS);
      let fit = kinds.filter((k) => { const P = D.ROOM_PLANS[k]; return !P.need.length || has(P.need).length; });
      if (r.zone === 'crypt' && fit.includes('crypt')) fit = ['crypt']; if (r.zone === 'arcane' && fit.includes('sanctum')) fit = ['sanctum'];
      if (!fit.length) return;
      let roll = R() * fit.reduce((a, k) => a + D.ROOM_PLANS[k].w, 0), plan = fit[0]; for (const k of fit) { roll -= D.ROOM_PLANS[k].w; if (roll < 0) { plan = k; break; } }
      const P = D.ROOM_PLANS[plan], busy = r.type === 'boss' || r.type === 'shrine' || r.type === 'start', c2 = 2 * r.x + r.w - 1;
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
      const putFloor = (x, y, n) => { claim(x, y, n); hard.add(key(x, y)); decor.push({ x: wx(x), y: wy(y), n, solid: 1, r: r.id }); };
      const fn = P.floor && !busy && has(P.floor.n)[R() < 0.5 ? 0 : has(P.floor.n).length - 1];
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
    const wallSpot = (r, n) => { const c = []; for (let y = r.y + 2; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        if (!(x === r.x && at(x - 1, y) === 0) && !(x === r.x + r.w - 1 && at(x + 1, y) === 0) && !(y === r.y + r.h - 1 && at(x, y + 1) === 0)) continue;
        if (free(x, y) && !doorway(x, y) && roomy(x, y, n)) c.push([x, y]); }
      if (!c.length) return null; const p = c[Math.floor(R() * c.length)]; used.add(key(...p)); claim(...p, n); return p; };
    for (const r of rooms) { if (r.type === 'shop') continue;
      const area = r.w * r.h, zb = r.zone || biome;
      // the hoard's centrepiece, as in the reference: a rug running from the top wall with the best chest on it
      let first = null;
      if (r.type === 'treasure' && r.w >= 7 && r.h >= 6) { const y0 = r.y + 1; rugs.push({ cx: wx(r.cx), y: y0 * TILE - 6, h: Math.min(r.h - 2, 4.4) * TILE });
        if (free(r.cx, y0 + 1) && roomy(r.cx, y0 + 1)) { claim(r.cx, y0 + 1); first = [r.cx, y0 + 1]; } }
      if (r.type !== 'treasure' && r.type !== 'secret') furnish(r, zb);   // a secret room is a small cache: its chest and gold need the space
      if (r.type === 'combat' || r.type === 'exit' || r.type === 'treasure') {
        let n = Math.min(Math.floor(area / 9), 2 + Math.floor(floor / 2) + ri(0, 3) + (r.type === 'exit' ? 2 : 0) - (r.type === 'treasure' ? 1 : 0));
        n = Math.max(1, Math.round(n * D.BAL.pop));
        const pack = pick(roster), guard = r.type === 'exit' && floor % 2 === 0;
        for (let i = 0; i < n; i++) { const p = spot(r, 1); if (!p) break;
          let type = R() < 0.6 ? pack : pick(roster); if (type === 'brute' && R() < 0.6) type = pack === 'brute' ? 'skeleton' : pack;
          // on floors 1–2 the guard is the exit's only elite: two at once killed before a potion could help
          addEnemy(type, p[0], p[1], r.id, (r.type === 'exit' && i === 0 && !(guard && floor <= 2)) || (floor >= 3 && R() < D.ELITE.share) ? 1 : 0); }
        if (guard) { const p = spot(r, 2); if (p) addEnemy('brute', p[0], p[1], r.id, 1); }
      }
      if (r.type === 'boss') { addEnemy('boss', r.cx, r.cy - 3, r.id, 1); for (let i = 0; i < Math.round(4 * D.BAL.pop); i++) { const p = spot(r, 2); if (p) addEnemy(pick(roster.filter((t) => t !== 'brute')), p[0], p[1], r.id); } }
      // chests
      // a locked room pays for its key: one chest of the secret rooms' tier and another of the hoards', often a heap of gold
      const nc = Math.min(1 + Math.floor(r.w * r.h / 30), r.locked ? 2 : r.type === 'treasure' ? 1 + (r.w * r.h >= 70 && R() < 0.4 ? 1 : 0) : r.type === 'secret' ? 1 : r.type === 'boss' ? 0 : r.type === 'start' ? (floor === 1 ? 1 : 0) : R() < 0.2 ? 1 : 0);
      for (let i = 0; i < nc; i++) { const p = i === 0 && first ? first : (r.type === 'secret' ? spot(r, 1, 0, true) : null) || wallSpot(r, 'chest') || spot(r, 1, 0, true); if (p) chests.push({ x: wx(p[0]), y: wy(p[1]), tier: r.type === 'secret' || (r.locked && i === 0) ? 3 : r.type === 'treasure' || r.locked ? 2 : 1, open: 0 }); }
      // the hoard's dressing: a statue each side of the rug against the back wall, vases along the walls, now and then a small
      // pile of gold
      if (r.type === 'treasure') {
        for (const side of [-1, 1]) for (const d of [3, 4, 2]) { const x = r.cx + side * d; if (x <= r.x || x >= r.x + r.w - 1 || at(x, r.y - 1) !== 0 || !free(x, r.y) || !free(x, r.y + 1) || !roomy(x, r.y, 'statue') || doorway(x, r.y) || hungAt(wx(x), r.y, half('statue'))) continue;
          claim(x, r.y, 'statue'); used.add(key(x, r.y + 1)); decor.push({ x: wx(x), y: r.y * TILE + 22, n: 'statue', solid: 1, r: r.id }); break; }
        for (let i = 0, n = ri(2, 4); i < n; i++) { const kind = pick(['vase_a', 'vase_b', 'vase_c']), p = wallSpot(r, kind); if (p) pots.push({ x: wx(p[0]), y: wy(p[1]), kind, hp: 1 }); }
        if (R() < 0.25) { const p = wallSpot(r, 'goldpile'); if (p) pots.push({ x: wx(p[0]), y: wy(p[1]), kind: 'goldpile', hp: 1 }); } }
      // a heap of gold is a secret or a locked room's reward only (a rich one), never left lying in the open
      if (r.type === 'secret' || (r.locked && R() < 0.6)) { const p = spot(r, 1, 0, 'gold'); if (p) pots.push({ x: wx(p[0]), y: wy(p[1]), kind: 'gold', hp: 1, rich: 1 }); }
      // torches on the top wall face (cells above the room's first row that are rock), every 4–5 tiles, between the tall props
      for (let x = r.x + 1 + ri(0, 1); x < r.x + r.w - 1; x += ri(3, 5)) if (!at(x, r.y - 1) && at(x, r.y) && !tallAt(wx(x), r.y, HANG.wall) && !doorTop(wx(x), r.y, HANG.wall)) torches.push({ x: x * TILE + TILE / 2, y: r.y * TILE - 26, kind: 'wall', r: r.id });
      for (let x = r.x + 2; x < r.x + r.w - 2; x += ri(5, 8)) if (!at(x, r.y - 1) && R() < 0.5 && !tallAt(wx(x), r.y, HANG.banner) && !doorTop(wx(x), r.y, HANG.banner) && !torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.x - wx(x)) < 1.5 * TILE && Math.abs(t.y - r.y * TILE) < TILE)) decor.push({ x: x * TILE + TILE / 2, y: r.y * TILE - 2, n: 'banner', wall: 1 });
      // one group at most, and never at the foot of a statue, a rack or a sconce: candles piled on a pedestal read as clutter
      for (let i = 0, n = R() < 0.6 ? 1 : 0; i < n; i++) { const x = ri(r.x + 1, r.x + r.w - 2); if (!free(x, r.y) || at(x, r.y - 1) !== 0 || doorway(x, r.y) || !roomy(x, r.y, 'candles') || tallAt(wx(x), r.y, 14) || hungAt(wx(x), r.y, 6)) continue; used.add(key(x, r.y)); decor.push({ x: wx(x) + ri(-6, 6), y: r.y * TILE + 20, n: 'candles' }); }
      if (r.type === 'shrine') shrines.push({ x: wx(r.cx), y: wy(r.cy), used: 0 });
      lightRoom(r, []);
    }
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
      const elites = enemies.filter((e) => e.elite && e.type !== 'boss' && here(e)), boxes = chests.filter((c) => c.tier < 3 && here(c));
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
      for (let n = floor < 2 ? 0 : ri(0, 2) + (floor >= 5 ? 1 : 0), k = 0; n > 0 && k < 60 && cand.length; k++) { const [x, y] = cand[Math.floor(R() * cand.length)];
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
      for (const r of pool.slice(0, floor === 1 ? (R() < 0.3 ? 1 : 0) : ri(1, 2))) { const p = floorSpot(r); if (p) ambush.push({ x: wx(p[0]), y: p[1] * TILE + TILE / 2, cx: p[0], cy: p[1], room: r.id, n: 2 + Math.floor(floor / 3) + (r.locked ? 1 : 0) }); } }
    // start room: a sanctuary bonfire in the centre
    const sanct = { x: start.cx * TILE + TILE / 2, y: start.cy * TILE + TILE / 2 + 8 };
    torches.push({ x: sanct.x, y: sanct.y, kind: 'fire' });
    const spawn = { x: start.cx * TILE + TILE / 2, y: (start.cy + 2) * TILE + TILE / 2 };
    if (at(start.cx, start.cy + 2) !== 1) spawn.y = (start.cy + 1) * TILE + TILE / 2;
    // flat floor decals (baked into the floor map): wear everywhere, a biome flavour per room, gore and coins where fights happen
    const DEC = { dungeon: ['dc_crack', 'dc_grime', 'dc_rubble', 'dc_slab', 'dc_straw', 'dc_shards', 'dc_leaves'], crypt: ['dc_moss', 'dc_bones', 'dc_crack', 'dc_grime', 'dc_puddle'],
      lava: ['dc_soot', 'dc_rubble', 'dc_crack', 'dc_slab', 'dc_soot'], arcane: ['dc_puddle', 'dc_crack', 'dc_grime', 'dc_slab'] };
    // a decal is drawn up to 40·s px across (scene.js bake, over the walls already painted): it shrinks until that square lies on
    // open floor, so no stone, rubbish or stain climbs a wall or spills onto the rock; one that would have to shrink past half is left out
    const decals = [], onFloor = (px, py, h) => { for (let y = Math.floor((py - h) / TILE); y <= Math.floor((py + h - 0.01) / TILE); y++) for (let x = Math.floor((px - h) / TILE); x <= Math.floor((px + h - 0.01) / TILE); x++) if (at(x, y) !== 1) return false; return true; };
    const fitDecal = (d) => { for (let s = d.s; s >= 0.5; s -= 0.05) if (onFloor(d.x, d.y, 20 * s)) { d.s = s; decals.push(d); return; } };
    for (const r of rooms) { const zb = r.zone || biome, n = Math.round(r.w * r.h / 6);
      for (let i = 0; i < n; i++) { const x = r.x + R() * r.w, y = r.y + 0.5 + R() * (r.h - 0.5); if (at(Math.floor(x), Math.floor(y)) !== 1) continue;
        const fight = r.type === 'combat' || r.type === 'exit' || r.type === 'boss';
        const pool = (fight || r.type === 'treasure' || r.type === 'secret') && R() < 0.35 ? ['dc_blood', 'dc_blood2', 'dc_coins', 'dc_bones', 'dc_sword'] : DEC[zb];
        if (water.includes(Math.floor(y) * W + Math.floor(x))) continue; fitDecal({ x: x * TILE, y: y * TILE, n: pool[Math.floor(R() * pool.length)], f: R() < 0.5 ? 1 : 0, s: 0.8 + 0.5 * R() }); } }
    // cobwebs: the sprite is spun across a top-left corner, so a web only ever hangs in a room's top corner where the back wall
    // meets a side wall (mirrored for the right one), more of them in the crypt and the halls than in the fire depths
    const WEB = { crypt: 0.6, arcane: 0.6, dungeon: 0.35, lava: 0.15 };
    for (const r of rooms) { const p = WEB[r.zone || biome] || 0.3;
      for (const [x, s, f] of [[r.x, -1, 0], [r.x + r.w - 1, 1, 1]]) { if (at(x, r.y) !== 1 || at(x + s, r.y) !== 0 || at(x, r.y - 1) !== 0 || R() > p) continue;
        const k = 0.95 + 0.35 * R(), w = 40 * k; decals.push({ x: f ? (x + 1) * TILE - w / 2 : x * TILE + w / 2, y: r.y * TILE + w / 2, n: 'dc_web', f, s: k }); } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 1 && !rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) && R() < 0.06)
      fitDecal({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, n: DEC[biome][Math.floor(R() * DEC[biome].length)], f: R() < 0.5 ? 1 : 0, s: 0.7 + 0.3 * R() });
    const secAt = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      return secrets.findIndex((sc) => { const r = rooms[sc.room]; return (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) || sc.hide.includes(ty * W + tx); }); };
    for (const list of [chests, pots, torches, decor, decals]) for (const o of list) { const i = secAt(o.x, o.y + (o.wall ? TILE : 0)); if (i >= 0) o.sec = i; }
    for (const t of torches) { const i = secrets.findIndex((sc) => sc.room === t.r); if (i >= 0) t.sec = i; }
    // cells taken by solid props: the flow fields route around them
    const block = []; const bl = (x, y) => block.push(Math.floor(y / TILE) * W + Math.floor(x / TILE));
    for (const c of chests) bl(c.x, c.y); for (const t of torches) if (t.kind !== 'wall') bl(t.x, t.y); for (const d of decor) if (d.solid) bl(d.x, d.y); for (const s of shrines) bl(s.x, s.y); for (const [x, y] of shop.solid) bl(x, y);
    return { seed, floor, biome, W, H, cells, rooms, block, decals, edges: edges.map((e) => [e[0], e[1]]), start: start.id, exitRoom: exitR.id, exit, spawn, sanct,
      enemies, chests, pots, traps, torches, decor, shrines, rugs, shop, secrets, secretsWanted, lava: lava.length, water, doors, locks, webs, ambush };
  }

  // room index of a world point (or -1 in a corridor)
  const roomAt = (map, x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (const r of map.rooms) if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r.id; return -1; };

  root.DUNGEON = { genFloor, roomAt, mul32, LIGHT_R };
  if (typeof module !== 'undefined') module.exports = root.DUNGEON;
})(typeof window !== 'undefined' ? window : globalThis);
