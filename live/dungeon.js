// live/dungeon.js — procedural floor generator: genFloor(seed, floor) → plain JSON map data. Pure function of its inputs.
// Rooms placed at random without overlap → MST + extra loop edges → 2-wide L corridors → start room (safe) at a leaf,
// exit room farthest by graph distance (floor 8: the boss lair) → room roles → contents (enemies, chests, pots, traps,
// lava, torches, decor) → validation (everything reachable from the start, spawns on open floor).
(function (root) {
  const D = root.DATA || require('./data.js');
  const { TILE, ENEMIES } = D;
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
    const leaves = rooms.filter((r) => adj[r.id].length === 1 && !(boss && r.id === 0));
    const start = (leaves.length ? pick(leaves) : rooms[rooms.length - 1]);
    const hop = rooms.map(() => 99); hop[start.id] = 0; const q = [start.id];
    while (q.length) { const a = q.shift(); for (const b of adj[a]) if (hop[b] > hop[a] + 1) { hop[b] = hop[a] + 1; q.push(b); } }
    const exitR = boss ? rooms[0] : rooms.filter((r) => r !== start).sort((p, q2) => (hop[q2.id] - hop[p.id]) || (dist(q2, start) - dist(p, start)))[0];
    start.type = 'start'; exitR.type = boss ? 'boss' : 'exit';
    // a Fisher–Yates shuffle: a random sort comparator gives each JS engine its own order, so node checks would see other maps than the browser
    const others = rooms.filter((r) => r.type === 'combat'); for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    const nTreasure = 1 + (R() < 0.5 ? 1 : 0);
    others.slice(0, nTreasure).forEach((r) => (r.type = 'treasure'));
    if (others.length > 4 && R() < 0.7) others[nTreasure].type = 'shrine';
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
        secrets.push({ room: sr.id, dir, dx, dy, x: ex, y: ey, wall, hide, front, hp: 2, open: 0 }); } }
    // ---- contents ----
    // a cell next to a corridor mouth: any neighbour outside every room that is open floor
    const inRoom = (x, y) => rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
    const doorway = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (at(x + i, y + j) === 1 && !inRoom(x + i, y + j)) return true; return false; };
    const used = new Set(), key = (x, y) => x + ',' + y;
    const free = (x, y, pad = 0) => { for (let j = -pad; j <= pad; j++) for (let i = -pad; i <= pad; i++) if (at(x + i, y + j) !== 1 || used.has(key(x + i, y + j))) return false; return true; };
    // bulky props draw wider than their cell: no two of them may share an edge or a corner
    const bulk = new Set(), roomy = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (bulk.has(key(x + i, y + j))) return false; return true; };
    const spot = (r, inset = 1, pad = 0, big = false) => { for (let k = 0; k < 40; k++) { const x = ri(r.x + inset, r.x + r.w - 1 - inset), y = ri(r.y + inset, r.y + r.h - 1 - inset);
      if (free(x, y, pad) && !doorway(x, y) && (!big || roomy(x, y))) { used.add(key(x, y)); if (big) bulk.add(key(x, y)); return [x, y]; } } return null; };
    for (const sc of secrets) for (const [x, y] of sc.front) used.add(key(x, y));
    const wx = (x) => x * TILE + TILE / 2, wy = (y) => y * TILE + TILE / 2 + 6;
    const enemies = [], chests = [], pots = [], traps = [], torches = [], decor = [], shrines = [], rugs = [];
    // stairs / boss altar
    const sx = exitR.cx, sy = exitR.cy; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 2; i++) used.add(key(sx + i, sy + j));
    const exit = { x: sx * TILE + TILE, y: sy * TILE + TILE / 2, tx: sx, ty: sy };
    for (let j = -1; j <= 3; j++) for (let i = -1; i <= 1; i++) used.add(key(start.cx + i, start.cy + j));   // the bonfire and the spawn tiles
    const roster = D.BIOMES[biome].roster, lvl = floor;
    const addEnemy = (type, x, y, room, elite = 0) => enemies.push({ type, x: wx(x), y: wy(y), room, elite });
    for (const r of rooms) if (r.type === 'shrine') { used.add(key(r.cx, r.cy)); bulk.add(key(r.cx, r.cy)); }   // the altar's cell first: props are placed around it
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
          if (side && free(x, y) && roomy(x, y) && !nearMouth(x, y)) cand.push([x, y, Math.min(x - r.x, r.x + r.w - 1 - x) + Math.min(y - r.y, r.y + r.h - 1 - y) <= 1 ? 0 : 1]); }
        for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
        cand.sort((p, q) => p[2] - q[2]);
        for (const [x, y] of cand) if (keepsWay(x, y)) { take(x, y); return [x, y]; } return null; };
      const along = (n) => { const p = edgeSpot(); if (p) decor.push({ x: wx(p[0]), y: wy(p[1]), n, solid: 1, r: r.id }); };
      // the stands go against the back wall clear of the wide shelves, or else along another wall
      const wall = (dir, n) => { for (let x = cx + dir * 4; x >= r.x && x < r.x + r.w; x += dir)
          if (at(x, y0 - 1) === 0 && free(x, y0) && roomy(x, y0) && !nearMouth(x, y0) && keepsWay(x, y0)) { take(x, y0); decor.push({ x: wx(x), y: y0 * TILE + 22, n, solid: 1, r: r.id }); return; }
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
        for (const [lx, ly] of [[x + ax * (a + 1), y + ay * (a + 1)], [x - ax, y - ay]]) if (inR(lx, ly) && free(lx, ly) && roomy(lx, ly) && keepsWay(lx, ly)) {
          take(lx, ly); shop.lanterns.push({ x: wx(lx), y: wy(ly) }); break; } }
      for (const L0 of shop.lanterns) decor.push({ x: L0.x, y: L0.y, n: 'shop_lantern', solid: 1, r: r.id });
      wall(-1, 'shop_armor'); wall(1, 'shop_weapons');
      for (const x of [r.x + 1, r.x + r.w - 2]) if (!at(x, r.y - 1) && Math.abs(x - cx) > 3) torches.push({ x: x * TILE + TILE / 2, y: r.y * TILE - 26, kind: 'wall', r: r.id });
      along('shop_gold'); along('shop_crate'); }
    if (!shop) return null;
    for (const r of rooms) { if (r.type === 'shop') continue;
      const area = r.w * r.h, zb = r.zone || biome;
      if (r.type === 'combat' || r.type === 'exit' || r.type === 'treasure') {
        let n = Math.min(Math.floor(area / 9), 2 + Math.floor(floor / 2) + ri(0, 3) + (r.type === 'exit' ? 2 : 0) - (r.type === 'treasure' ? 1 : 0));
        n = Math.max(1, Math.round(n * D.BAL.pop));
        const pack = pick(roster);
        for (let i = 0; i < n; i++) { const p = spot(r, 1); if (!p) break;
          let type = R() < 0.6 ? pack : pick(roster); if (type === 'brute' && R() < 0.6) type = pack === 'brute' ? 'skeleton' : pack;
          addEnemy(type, p[0], p[1], r.id, (r.type === 'exit' && i === 0) || (floor >= 3 && R() < 0.08) ? 1 : 0); }
        if (r.type === 'exit' && floor % 2 === 0) { const p = spot(r, 2); if (p) addEnemy('brute', p[0], p[1], r.id, 1); }
      }
      if (r.type === 'boss') { addEnemy('boss', r.cx, r.cy - 3, r.id, 1); for (let i = 0; i < Math.round(4 * D.BAL.pop); i++) { const p = spot(r, 2); if (p) addEnemy(pick(roster.filter((t) => t !== 'brute')), p[0], p[1], r.id); } }
      // chests
      const nc = Math.min(1 + Math.floor(r.w * r.h / 30), r.type === 'treasure' ? ri(2, 3) : r.type === 'secret' ? 1 : r.type === 'boss' ? 0 : r.type === 'start' ? (floor === 1 ? 1 : 0) : R() < 0.3 ? 1 : 0);
      // the hoard's centrepiece, as in the reference: a rug running from the top wall with the best chest on it
      let first = null;
      if (r.type === 'treasure' && r.w >= 7 && r.h >= 6) { const y0 = r.y + 1; rugs.push({ cx: wx(r.cx), y: y0 * TILE - 6, h: Math.min(r.h - 2, 4.4) * TILE });
        if (free(r.cx, y0 + 1) && roomy(r.cx, y0 + 1)) { used.add(key(r.cx, y0 + 1)); bulk.add(key(r.cx, y0 + 1)); first = [r.cx, y0 + 1]; } }
      for (let i = 0; i < nc; i++) { const p = i === 0 && first ? first : spot(r, 1, 0, true); if (p) chests.push({ x: wx(p[0]), y: wy(p[1]), tier: r.type === 'secret' ? 3 : r.type === 'treasure' ? 2 : 1, open: 0 }); }
      // breakables along the walls
      for (let i = 0, n = ri(1, 4); i < n; i++) { const side = ri(0, 3), x = side === 0 ? r.x : side === 1 ? r.x + r.w - 1 : ri(r.x, r.x + r.w - 1),
        y = side === 2 ? r.y : side === 3 ? r.y + r.h - 1 : ri(r.y, r.y + r.h - 1);
        const out = side === 0 ? at(x - 1, y) : side === 1 ? at(x + 1, y) : side === 2 ? at(x, y - 1) : at(x, y + 1);
        if (free(x, y) && out === 0 && !doorway(x, y)) { used.add(key(x, y)); pots.push({ x: wx(x), y: wy(y), kind: R() < 0.5 ? 'pot' : R() < 0.5 ? 'barrel' : 'crate', hp: 1 }); } }
      // heaps of gold: the treasure room's hoard, now and then one left in a fought-over room
      for (let i = 0, n = r.type === 'treasure' ? ri(2, 4) : r.type === 'secret' ? ri(1, 2) : r.type === 'exit' || (r.type === 'combat' && R() < 0.3) ? 1 : 0; i < n; i++) { const p = spot(r, 1); if (p) pots.push({ x: wx(p[0]), y: wy(p[1]), kind: 'gold', hp: 1 }); }
      // torches on the top wall face (cells above the room's first row that are rock), every 4–5 tiles
      if (r.type !== 'secret') for (let x = r.x + 1 + ri(0, 1); x < r.x + r.w - 1; x += ri(3, 5)) if (!at(x, r.y - 1) && at(x, r.y)) torches.push({ x: x * TILE + TILE / 2, y: r.y * TILE - 26, kind: 'wall', r: r.id });
      if (r.type !== 'start' && r.type !== 'secret' && R() < 0.5) { const p = spot(r, 1, 0, true); if (p) torches.push({ x: wx(p[0]), y: wy(p[1]), kind: 'brazier', r: r.id }); }
      // decor
      for (let i = 0, n = ri(1, 3); i < n; i++) { const n2 = pick(['bones', 'candles', 'bones', 'table']), p = spot(r, 1, 0, n2 === 'table'); if (p) decor.push({ x: wx(p[0]), y: wy(p[1]), n: n2 }); }
      for (let x = r.x + 2; x < r.x + r.w - 2; x += ri(5, 8)) if (!at(x, r.y - 1) && R() < 0.5) decor.push({ x: x * TILE + TILE / 2, y: r.y * TILE - 2, n: 'banner', wall: 1 });
      // big biome props standing against the top wall (solid)
      for (let x = r.x + 1 + ri(0, 2); x < r.x + r.w - 1; x += ri(2, 5)) { if (R() < 0.3 || !free(x, r.y) || !free(x, r.y + 1) || !roomy(x, r.y) || !roomy(x, r.y + 1) || at(x, r.y - 1) !== 0 || doorway(x, r.y)) continue; used.add(key(x, r.y)); used.add(key(x, r.y + 1)); bulk.add(key(x, r.y)); bulk.add(key(x, r.y + 1));
        decor.push({ x: wx(x), y: r.y * TILE + 22, n: pick(D.BIOMES[zb].props), solid: 1, r: r.id }); }
      for (let i = 0, n = ri(1, 3); i < n; i++) { const x = ri(r.x + 1, r.x + r.w - 2); if (!free(x, r.y) || at(x, r.y - 1) !== 0 || doorway(x, r.y)) continue; used.add(key(x, r.y)); decor.push({ x: wx(x) + ri(-6, 6), y: r.y * TILE + 20, n: 'candles' }); }
      if (r.zone === 'arcane') for (let i = 0; i < 2; i++) { const p = spot(r, 2, 0, true); if (p) decor.push({ x: wx(p[0]), y: wy(p[1]), n: 'crystal', solid: 1, r: r.id }); }
      if (r.zone === 'crypt') for (let i = 0; i < 2; i++) { const p = spot(r, 2, 0, true); if (p) decor.push({ x: wx(p[0]), y: wy(p[1]), n: R() < 0.5 ? 'coffin' : 'grave', solid: 1, r: r.id }); }
      if (r.type === 'shrine') shrines.push({ x: wx(r.cx), y: wy(r.cy), used: 0 });
    }
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
    const plate = (r, x, y, ph) => { if (x < r.x || y < r.y + 1 || x + 1 >= r.x + r.w || y + 1 >= r.y + r.h || nearDoor(x, y)) return false;
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
    // a monster whose post ended up on a plate steps off it to the nearest free cell of its room, or it would bleed on its post
    for (const e of enemies) { const ex = Math.floor(e.x / TILE), ey = Math.floor(e.y / TILE); if (!traps.some((t) => ex >= t.x / TILE - 1 && ex < t.x / TILE + 1 && ey >= t.y / TILE - 1 && ey < t.y / TILE + 1)) continue;
      const r = rooms[e.room]; let best = null;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (free(x, y) && !solid.has(key(x, y)) && !doorway(x, y)) { const d = Math.hypot(x - ex, y - ey); if (!best || d < best[0]) best = [d, x, y]; }
      if (best) { used.add(key(best[1], best[2])); e.x = wx(best[1]); e.y = wy(best[2]); } }
    // start room: a sanctuary bonfire in the centre
    const sanct = { x: start.cx * TILE + TILE / 2, y: start.cy * TILE + TILE / 2 + 8 };
    torches.push({ x: sanct.x, y: sanct.y, kind: 'fire' });
    const spawn = { x: start.cx * TILE + TILE / 2, y: (start.cy + 2) * TILE + TILE / 2 };
    if (at(start.cx, start.cy + 2) !== 1) spawn.y = (start.cy + 1) * TILE + TILE / 2;
    // flat floor decals (baked into the floor map): wear everywhere, a biome flavour per room, gore and coins where fights happen
    const DEC = { dungeon: ['dc_crack', 'dc_grime', 'dc_rubble', 'dc_slab', 'dc_straw', 'dc_shards', 'dc_leaves'], crypt: ['dc_moss', 'dc_web', 'dc_bones', 'dc_crack', 'dc_grime', 'dc_puddle'],
      lava: ['dc_soot', 'dc_rubble', 'dc_crack', 'dc_slab', 'dc_soot'], arcane: ['dc_puddle', 'dc_web', 'dc_crack', 'dc_grime', 'dc_slab'] };
    const decals = [];
    for (const r of rooms) { const zb = r.zone || biome, n = Math.round(r.w * r.h / 6);
      for (let i = 0; i < n; i++) { const x = r.x + R() * r.w, y = r.y + 0.5 + R() * (r.h - 0.5); if (at(Math.floor(x), Math.floor(y)) !== 1) continue;
        const fight = r.type === 'combat' || r.type === 'exit' || r.type === 'boss';
        const pool = (fight || r.type === 'treasure' || r.type === 'secret') && R() < 0.35 ? ['dc_blood', 'dc_blood2', 'dc_coins', 'dc_bones', 'dc_sword'] : DEC[zb];
        decals.push({ x: x * TILE, y: y * TILE, n: pool[Math.floor(R() * pool.length)], f: R() < 0.5 ? 1 : 0, s: 0.8 + 0.5 * R() }); } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 1 && !rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) && R() < 0.06)
      decals.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, n: DEC[biome][Math.floor(R() * DEC[biome].length)], f: R() < 0.5 ? 1 : 0, s: 0.7 + 0.3 * R() });
    const secAt = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      return secrets.findIndex((sc) => { const r = rooms[sc.room]; return (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) || sc.hide.includes(ty * W + tx); }); };
    for (const list of [chests, pots, torches, decor, decals]) for (const o of list) { const i = secAt(o.x, o.y + (o.wall ? TILE : 0)); if (i >= 0) o.sec = i; }
    // cells taken by solid props: the flow fields route around them
    const block = []; const bl = (x, y) => block.push(Math.floor(y / TILE) * W + Math.floor(x / TILE));
    for (const c of chests) bl(c.x, c.y); for (const t of torches) if (t.kind !== 'wall') bl(t.x, t.y); for (const d of decor) if (d.solid) bl(d.x, d.y); for (const s of shrines) bl(s.x, s.y); for (const [x, y] of shop.solid) bl(x, y);
    return { seed, floor, biome, W, H, cells, rooms, block, decals, edges: edges.map((e) => [e[0], e[1]]), start: start.id, exitRoom: exitR.id, exit, spawn, sanct,
      enemies, chests, pots, traps, torches, decor, shrines, rugs, shop, secrets, secretsWanted, lava: lava.length };
  }

  // room index of a world point (or -1 in a corridor)
  const roomAt = (map, x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (const r of map.rooms) if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r.id; return -1; };

  root.DUNGEON = { genFloor, roomAt, mul32 };
  if (typeof module !== 'undefined') module.exports = root.DUNGEON;
})(typeof window !== 'undefined' ? window : globalThis);
