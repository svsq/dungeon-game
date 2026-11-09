// live/dungeon_fill.js — the contents: monsters and packs, lights, furniture, the caves' and magma's dressing, traps, decals; the checks a floor type is held to.
// A stage of tryGen (ARCHITECTURE.md §4.2): it reads the floor's shared values from GF and leaves there what later stages use; null rerolls.
(function (root) {
  const DGX = root.DGX, {
    D, ENEMIES, LIGHT_R, NO_SHOP, TILE, inRm, lakeOk, lakeWays, mul32, narrowTo, rectsOf, rewardsOf, riverAt, riverOk, riverWays } = DGX;
  DGX.fill = (GF) => {
    const {
      AR, FM, H, HL, LY, MIX, MX, R, ST, TY, W, arch, at, biome, boss, bossType, cave, cells, chasmUnder, circles, cliff, crossings, crust,
      deadEnd, deckUsed, depth, doors, edges, exitR, fig, figAt, fin, floodCells, floor, flow, ftype, ftype2, lakeWay, lastTry, lava,
      lavaBodies, lavaFeatures, lavaUnder, lc, ledges, lines, locks, merchant, opts, pathMin, pick, pits, plat, ri, ridgeLen, riverB,
      riverWay, riverY, roomOf, rooms, runFloor, secrets, secretsWanted, seed, serpentPools, shareOf, shopR, start, stepHold, streams,
      strict, terr, thin, tierDecor, wander, water, waterBridges, waterFeatures, waterFlow, way, wet } = GF;
    // ---- contents ----
    // a cell next to a corridor mouth: any neighbour outside every room that is open floor
    const inRoom = (x, y) => rooms.some((q) => inRm(q, x, y));
    const doorway = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (at(x + i, y + j) === 1 && !inRoom(x + i, y + j)) return true; return false; };
    const used = new Set(), key = (x, y) => x + ',' + y;
    // a terrace floor's surge (TASKS 475, data.js HAZ.surge): the lavafall's surge floods the ridges down the steps on its side of
    // the floor (every other turn of the serpentine): the floor off the plateaus within HAZ.surge.band of their middle lines, by the
    // lava; its level: how far from the lava (the cells by it 0), so the warning's creep shows on their edges
    const surge = { cells: [], lv: [] };
    if (terr) { const B = D.HAZ.surge.band, rowOf = (id) => terr.rows.findIndex((row) => row.includes(id)), mid = W / 2;
      const inBox = (x, y) => rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h), got = new Set();
      const lavaD = (x, y) => { let d = 99; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (at(x + i, y + j) === 3) d = Math.min(d, Math.max(Math.abs(i), Math.abs(j))); return d; };
      for (const q of lines) { const ra = rowOf(q.a), rb = rowOf(q.b); if (ra < 0 || rb < 0 || Math.abs(ra - rb) !== 1) continue;
        const mx = q.line.reduce((a, p) => a + p[0], 0) / q.line.length; if (terr.left ? mx > mid : mx < mid) continue;
        for (const [px, py] of q.line) for (let j = -B; j <= B; j++) for (let i = -B; i <= B; i++) { const x = Math.round(px + i), y = Math.round(py + j), k = y * W + x;
          if (got.has(k) || at(x, y) !== 1 || inBox(x, y) || lavaD(x, y) > B) continue; got.add(k); surge.cells.push(k); surge.lv.push(Math.round(Math.max(0, lavaD(x, y) - 1) / B * 100) / 100); used.add(key(x, y)); } } }
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
    for (const [x, y] of deckUsed) used.add(key(x, y));
    // (a two-level hall's steps and the cells at their foot and head stay clear, TASKS 375)
    for (const r of rooms) if (r.tier) for (let y = r.tier.y - 1; y <= r.tier.y + 2; y++) for (let x = r.tier.sx - 1; x <= r.tier.sx + 2; x++) used.add(key(x, y));
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
    const enemies = [], chests = [], pots = [], traps = [], torches = [], decor = [...tierDecor], shrines = [], rugs = [];
    // the top wall: what hangs on it (torches, sconces, banners, the shop sign) and the tall props standing against it (columns,
    // statues, racks, shelves) must not overlap across their drawn widths, whichever came first: a prop would hide a sconce that
    // works a secret, or a torch would stick out of a statue's head
    const HANG = { wall: 14, banner: 18, shop_sign: 22 };
    const hungAt = (px, ry, hw) => torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.y - (ry * TILE - 26)) < TILE && Math.abs(t.x - px) < hw + HANG.wall)
      || decor.some((d) => HANG[d.n] && Math.abs(d.y - ry * TILE) < 2 * TILE && Math.abs(d.x - px) < hw + HANG[d.n]) || doorTop(px, ry, hw)
      || waterFeatures.some((q) => wallRow(q) === ry && Math.abs(q.x - px) < hw + 34);
    // a door in a top wall stands in a stone arch wider than its corridor
    const doorTop = (px, ry, hw) => doors.some((d) => d.dir === 'u' && d.y === ry * TILE && Math.abs(d.x - px) < hw + 58) || (up && !up.free && up.ty + 1 === ry && Math.abs(up.x - px) < hw + 58);
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
    // the stairs back up (R-19, TASKS 1027, in the wall since 511), only in a run through the town for now: an opening in a top wall of
    // the start room, as near its middle as a spot allows, solid rock either side so it never reads as a way in and the floor before it
    // kept clear. (tx, ty) is the wall cell; the hero stands below it. Ragged cave walls and small rooms ask less of the spot, step by step
    let up = null;
    for (let j = -1; j <= 3; j++) for (let i = -1; i <= 1; i++) used.add(key(start.cx + i, start.cy + j));   // reserved before the steps so that their footprint cannot cover them
    if (opts.town) { const secretNear = (x, y) => secrets.some((q) => Math.abs(q.x / TILE - x) < 5 && Math.abs(q.y / TILE - y) < 4), mouth = (x, y, n) => doors.some((d) => d.cells.some(([cx, cy]) => Math.abs(cx - x) < n && Math.abs(cy - y) < n));
      const inS = (x, y) => x >= start.x && x < start.x + start.w && y >= start.y && y < start.y + start.h, clearAt = (x, y) => at(x, y) === 1 && !used.has(key(x, y)) && !wet.has(y * W + x) && open[y * W + x];
      // (the hero arrives by the steps: only floor walked to from the start with the caches and locked doors shut will do)
      const open = new Uint8Array(W * H), shut = new Set(doors.filter((d) => d.lock >= 0).flatMap((d) => d.cells.map(([x, y]) => y * W + x))), go = [start.cy * W + start.cx]; open[go[0]] = 1;
      while (go.length) { const k = go.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!open[n] && (cells[n] === 1 || cells[n] === 5) && !shut.has(n)) { open[n] = 1; go.push(n); } } }
      for (const [rock, deep, wide, rows, far] of [[2, 2, 1, 2, 0], [1, 1, 1, 2, 0], [1, 1, 0, 2, 0], [1, 1, 1, 2, 8], [1, 1, 0, 2, 8]]) { if (up) break; const cand = [];
        for (let y = start.y - far; y < start.y + start.h + far; y++) for (let x = start.x - far; x < start.x + start.w + far; x++) cand.push([x, y, (y === start.y ? 0 : 30 + Math.abs(y - start.y)) + Math.abs(x - start.cx) + (inS(x, y) ? 0 : 40)]);
        for (const [x, y] of cand.sort((a, b) => a[2] - b[2])) { let ok = !(plat && y - 1 > AR.cliff) && !secretNear(x, y) && !mouth(x, y, rock + 2);
          for (let i = -rock; i <= rock && ok; i++) for (let j = 1; j <= deep && ok; j++) if (at(x + i, y - j) !== 0) ok = false;
          for (let j = 0; j < rows && ok; j++) for (let i = -wide; i <= wide && ok; i++) if (!clearAt(x + i, y + j)) ok = false;
          // (and no chest a step off them: E by the steps opened it, not the way up, TASKS 373's small start rooms put them out among the rooms)
          if (ok) { for (let j = 0; j <= 3; j++) for (let i = -2; i <= 2; i++) used.add(key(x + i, y + j)); up = { x: x * TILE + TILE / 2, y: (y - 1) * TILE + TILE / 2, tx: x, ty: y - 1 }; break; } } }
      // (a plateau far from its top wall, or no wall that will do: free-standing steps on three by three clear cells, as before 511)
      if (!up) { const cand = []; for (let y = start.y - 6; y < start.y + start.h + 6; y++) for (let x = start.x - 6; x < start.x + start.w + 6; x++) cand.push([x, y, (inS(x, y) ? 0 : 20) + (y - start.cy < 0 ? 0 : 4) + Math.hypot(x - start.cx, y - start.cy + 2.5)]);
        cand.sort((a, b) => a[2] - b[2]); for (const half of [1, 0]) for (const [x, y] of cand) { if (up) break; let ok = true; for (let j = -half; j <= half && ok; j++) for (let i = -half; i <= half && ok; i++) if (!clearAt(x + i, y + j)) ok = false;
          if (ok) { for (let j = -2; j <= 3; j++) for (let i = -2; i <= 2; i++) used.add(key(x + i, y + j)); up = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, tx: x, ty: y, free: 1 }; } } } }
    // a free-standing stair can sit away from the start room the terrain's pool was dug beside (TASKS 1507)
    if (up && !boss && biome === 'magma' && (runFloor === 1 || (D.RUNS[opts.mode || 'campaign'].chapters || []).some((c) => c.from === runFloor))) { const ax = up.tx, ay = up.ty + 1, inMap = (x, y) => x > 2 && y > 2 && x < W - 3 && y < H - 3, O4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const sees = (x, y) => { const n = Math.ceil(Math.hypot(x - ax, y - ay) * 3); for (let i = 1; i < n; i++) { const u = Math.floor(ax + 0.5 + (x - ax) * i / n), v = Math.floor(ay + 0.5 + (y - ay) * i / n), c = at(u, v); if (u === x && v === y) break; if (c !== 1 && c !== 3 && c !== 6) return false; } return true; };
      const K = DGX.FOG_ARRIVE, RX = Math.ceil(8 * K), RY = Math.ceil(6 * K), shows = (x, y) => DGX.inFogOval(x, y, ax + 0.5, ay + 0.5, K);
      const roomShown = rectsOf(start).some(([bx, by, bw, bh]) => { for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (Math.abs(x - ax) <= RX && Math.abs(y - ay) <= RY && shows(x, y)) return true; return false; });
      const byRoom = (x, y) => { if (!roomShown || !rectsOf(start).some(([bx, by, bw, bh]) => x >= bx - 2 && x <= bx + bw + 1 && y >= by - 2 && y <= by + bh + 1)) return false; const rr = DGX.fogReach(x, y); for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) if (u * u + v * v <= rr * rr && at(x + u, y + v) === 1 && inRm(start, x + u, y + v)) return true; return false; };
      const keepOff = (x, y) => (Math.abs(x - ax) <= 3 && y < ay + 2 && y > ay - 5) || used.has(key(x, y)) || doors.some((d) => d.cells.some(([cx, cy]) => Math.abs(cx - x) < 3 && Math.abs(cy - y) < 3)) || secrets.some((q) => Math.abs(q.x / TILE - x) < 5 && Math.abs(q.y / TILE - y) < 4);
      let shown = 0; for (let y = ay - RY - 3; y <= ay + RY + 3; y++) for (let x = ax - RX - 4; x <= ax + RX + 4; x++) if (at(x, y) === 3 && ((Math.abs(x - ax) <= RX && Math.abs(y - ay) <= RY && shows(x, y)) || byRoom(x, y))) shown++;
      if (shown < 8) { const seeds = []; for (let y = ay - 5; y <= ay + 5; y++) for (let x = ax - 9; x <= ax + 9; x++) { const d = Math.max(Math.abs(x - ax), Math.abs(y - ay)); if (d >= 3 && inMap(x, y) && at(x, y) === 0 && !keepOff(x, y) && O4.some(([a, b]) => at(x + a, y + b) === 1) && shows(x, y)) seeds.push([Math.abs(d - 5) + ((x * 7 + y * 13) % 5) / 10, x, y]); }
        seeds.sort((p, q) => p[0] - q[0]);
        if (seeds.length) { const got = [[seeds[0][1], seeds[0][2]]], has = new Set([key(seeds[0][1], seeds[0][2])]); for (let i = 0; i < got.length && got.length < 14; i++) for (const [a, b] of O4) { const x = got[i][0] + a, y = got[i][1] + b; if (got.length < 14 && !has.has(key(x, y)) && inMap(x, y) && at(x, y) === 0 && !keepOff(x, y) && Math.abs(x - ax) <= 9 && Math.abs(y - ay) <= 5) { has.add(key(x, y)); got.push([x, y]); } }
          for (const [x, y] of got) cells[y * W + x] = 3;
          for (let pass = 0; pass < 4; pass++) for (const [px, py] of got.slice()) for (const [a, b] of O4) { const x = px + a, y = py + b, open = (u, v) => at(u, v) !== 0; if (at(x, y) === 0 && inMap(x, y) && ((open(x - 1, y) && open(x + 1, y)) || (open(x, y - 1) && open(x, y + 1)))) { cells[y * W + x] = 3; got.push([x, y]); } } } } }
    // a waystone (TASKS 1009) by the start on every D.wayFloor: to one side of the bonfire, three or four cells out, on clear dry floor
    let wayStone = null;
    if (opts.town && D.wayFloor(runFloor)) { const cand = []; for (let y = start.y; y < start.y + start.h; y++) for (let x = start.x; x < start.x + start.w; x++) {
        const dx = x - start.cx, dy = y - start.cy;
        cand.push([x, y, Math.abs(Math.hypot(dx, dy) - 3.5) + (Math.abs(dx) < 2 ? 3 : 0)]); }
      // its own cell and the one in front (where the hero stands to touch it) are free; no door, water or lava within two cells, so a
      // seven-cell-wide start room can take it by its side wall without it blocking a way in
      const inS = (x, y) => x >= start.x && x < start.x + start.w && y >= start.y && y < start.y + start.h;
      for (const [x, y] of cand.sort((a, b) => a[2] - b[2])) { let ok = y > start.y && inS(x, y) && inS(x, y + 1) && !(up && Math.max(Math.abs(x - up.tx), Math.abs(y - up.ty)) < 3);
        for (const [i, j] of [[0, 0], [0, 1]]) if (at(x + i, y + j) !== 1 || used.has(key(x + i, y + j)) || wet.has((y + j) * W + x + i)) ok = false;
        for (let j = -2; j <= 2 && ok; j++) for (let i = -2; i <= 2 && ok; i++) { const c = at(x + i, y + j); if ((c !== 0 && c !== 1) || wet.has((y + j) * W + x + i) || (c === 1 && Math.abs(i) < 2 && Math.abs(j) < 2 && !inS(x + i, y + j))) ok = false; }
        if (ok) { used.add(key(x, y)); used.add(key(x, y + 1)); wayStone = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, tx: x, ty: y }; break; } } }
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
      if (MP) { const wOf = (P) => (Array.isArray(P.w) ? P.w[Math.min(P.w.length, floor) - 1] : P.w), opts = Object.values(MP).filter((P) => P.plan[0][0].some(has)); let roll = R() * opts.reduce((a, P) => a + wOf(P), 0), P = opts[opts.length - 1];
        for (const o of opts) if ((roll -= wOf(o)) < 0) { P = o; break; }
        // (a lake's islands are the short way under fire, TASKS 472: archers at their far side over the crossings, the rest by the way in;
        // its shore stands past a bow's reach of them)
        if (r.isle && MP.line && has('skel_archer')) P = MP.line;
        if (r.hall && MP[HL.kinds[r.hall].pack] && MP[HL.kinds[r.hall].pack].plan[0][0].some(has)) P = MP[HL.kinds[r.hall].pack];   // (a hall's own, TASKS 434)
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
        const W2 = { near, back, any: anywhere, bank, lava: lavaPost }; plan.length = 0;
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
        addEnemy(type, p[0], p[1], r.id, (r.type === 'exit' && first && !(guard && depth <= 2)) || (depth >= 3 && R() < ST.elite && !(type === 'crab' && enemies.some((q) => q.room === r.id && q.type === 'crab' && q.elite))) ? 1 : 0);
        if (r.type === 'exit' && first) enemies[enemies.length - 1].exit = 1; first = false; }
      // an eel in the hall's deep water, out of the count
      if (has('eel') && R() < CP.eel[kf - 1]) { const q = deepIn(r); if (q) addEnemy('eel', q[0], q[1], r.id); } };
    if (boss && !fin) claim(exitR.cx - 3, sy, 'altar');
    for (const r of rooms) if (r.type === 'shrine') claim(r.cx, r.cy, 'altar');   // the altar's cell first: props are placed around it
    // no corner of a room is left in the dark: while some floor cell lies outside every light's reach, light the cell
    // nearest to it, preferring a sconce on the top wall, then on a side wall, then a brazier, then candles
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // (a floor without light, TASKS 381, lights no dark corner: its rooms keep only a share of their own torches, cut below)
    const lightRoom = (r, extra, wallOnly) => { if (FM.torch && r.type !== 'shop') return true;
      const inR = (o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= (r.y - 1) * TILE && o.y < (r.y + r.h) * TILE;
      const lights = torches.filter((t) => t.r === r.id).map((t) => [t.x, t.y, LIGHT_R[t.kind]])
        .concat(decor.filter((d) => LIGHT_R[d.n] && inR(d)).map((d) => [d.x, d.y, LIGHT_R[d.n]]), shrines.filter(inR).map((s) => [s.x, s.y, LIGHT_R.shrine]), extra);
      // (the fire stands 2 px lower than a cell's spot: a plateau's halls are wide enough for a cell to sit on that edge of its reach)
      if (r.id === start.id) lights.push([wx(start.cx), start.cy * TILE + TILE / 2 + 8, LIGHT_R.fire]);   // where the camp's fire stands (sanct)
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
    if (!shop && merchant) return null;
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
      // a room dressed all alike reads as one with nothing behind its walls (TASKS 1355): a room that hosts a top-wall secret tends to take such a dressing
      if (secrets.some((q) => q.dir === 'u' && q.host === r.id)) { const Bp = mul32(seed ^ 0x1355 ^ r.id), alike = fit.filter((k) => D.STATUE_SECRET.plans.includes(k)); if (alike.length && Bp() < D.STATUE_SECRET.hostP) plan = alike[Math.floor(Bp() * alike.length)]; }
      const P = r.type === 'boss' && bossType === 'boss_necro' ? Object.assign({}, D.ROOM_PLANS[plan], { floor: { n: ['pillar'], mode: 'pair' } }) : D.ROOM_PLANS[plan], busy = r.type === 'boss' || r.type === 'shrine' || r.type === 'start', c2 = 2 * r.x + r.w - 1;
      r.plan = plan;
      // the back wall: one kind of tall prop, evenly spaced or mirrored about the room's axis
      const backOK = (x, n) => x > r.x && x < r.x + r.w - 1 && [...Array(2 * Math.ceil(half(n) / TILE) + 1).keys()].every((i) => at(x + i - Math.ceil(half(n) / TILE), r.y - 1) === 0) && free(x, r.y) && free(x, r.y + 1) && roomy(x, r.y, n) && roomyCell(x, r.y + 1) && !doorway(x, r.y) && !hungAt(wx(x), r.y, half(n)) && keeps([[x, r.y]]) && (hard.delete(key(x, r.y)), true);
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
        n = Math.max(r.kind === 'ledge' ? 0 : 1, Math.round(n * D.BAL.pop * ST.pop * (plat ? TY.pop : 1) * (LY ? LY.pop : 1) * kp * (FM.pop || 1)));
        if (r.islet) n = 0;   // (a hoard's islet, TASKS 476: no pack could reach it)
        const pack = pick(roster), guard = r.type === 'exit' && !!ST.guard;
        if (cave) { if (n > 0) cavePack(r, n + (r.hall ? HL.kinds[r.hall].extra : 0), guard); }
        else for (let i = 0; i < n; i++) { const p = spot(r, 1); if (!p) break;
          let type = R() < 0.6 ? pack : pick(roster); if (type === 'brute' && R() < 0.6) type = pack === 'brute' ? 'skeleton' : pack;
          // a drowned lies in the room's shallows (TASKS 307); a room with none takes another of the roster
          if (ENEMIES[type].lurk) { const q = shallowIn(r); if (q) { p[0] = q[0]; p[1] = q[1]; } else type = roster.find((o) => !ENEMIES[o].lurk && !ENEMIES[o].deep); }
          // an eel in its deep water; a room with none takes another
          if (ENEMIES[type].deep) { const q = deepIn(r); if (q) { p[0] = q[0]; p[1] = q[1]; } else type = roster.find((o) => !ENEMIES[o].lurk && !ENEMIES[o].deep); }
          // on floors 1–2 the guard is the exit's only elite: two at once killed before a potion could help
          addEnemy(type, p[0], p[1], r.id, (r.type === 'exit' && i === 0 && !(guard && depth <= 2)) || (r.courtElite && i === 0) || (depth >= 3 && R() < ST.elite && !(type === 'crab' && enemies.some((q) => q.room === r.id && q.type === 'crab' && q.elite))) ? 1 : 0);
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
            if (!free(x, y, 1) || doorway(x, y) || Math.abs(x - sx) <= 2 && Math.abs(y - sy) <= 2 || wide.some(([ex, ey, eh]) => Math.abs(ey - y) <= 1 && Math.abs(ex - wx(x)) < eh + half('basalt_a') + 4)) continue; claim(x, y, 'basalt_a'); decor.push({ x: wx(x), y: wy(y), n: n % 2 ? 'basalt_b' : 'basalt_a', solid: 1, r: r.id, cover: 1 }); n++; } } for (let i = 0; i < (bossType === 'boss' || bossType === 'boss_necro' ? Math.round(4 * D.BAL.pop) : 0); i++) { const p = spot(r, 2); if (p) addEnemy(bossType === 'boss_necro' ? 'skeleton' : pick(roster.filter((t) => t !== 'brute' && !ENEMIES[t].lurk && !ENEMIES[t].deep)), p[0], p[1], r.id); } }
      // chests
      // a locked room pays for its key: one chest of the secret rooms' tier and another of the hoards', often a heap of gold
      const nc = Math.min(1 + Math.floor(r.w * r.h / 30), r.locked ? 2 : r.type === 'treasure' ? 1 + (r.w * r.h >= 70 && R() < 0.4 ? 1 : 0) : r.type === 'secret' ? 1 : r.type === 'boss' ? 0 : r.type === 'start' ? (runFloor === 1 ? 1 : 0) : r.pocket && !cave ? (R() < 0.55 ? 1 : 0) : R() < 0.2 && !way.has(r.id) ? 1 : 0);
      for (let i = 0; i < nc; i++) { const p = i === 0 && first ? first : (r.type === 'secret' ? spot(r, 1, 0, true) : null) || wallSpot(r, 'chest') || spot(r, 1, 0, true); if (p) chests.push({ x: wx(p[0]), y: wy(p[1]), tier: r.type === 'secret' || r.islet || (r.locked && i === 0) ? 3 : r.type === 'treasure' || r.locked || (r.pocket && !cave) ? 2 : 1, open: 0 }); }
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
    // a boss's chest (TASKS 1356), from a stream of its own: the rest of the floor stays as it was
    for (const r of rooms) { if (r.type !== 'boss') continue; const Bc = mul32(seed ^ 0x1356), c = []; for (let y = r.y + (cave ? 0 : 2); y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { if (cave ? at(x - 1, y) !== 0 && at(x + 1, y) !== 0 && at(x, y + 1) !== 0 : !(x === r.x && at(x - 1, y) === 0) && !(x === r.x + r.w - 1 && at(x + 1, y) === 0) && !(y === r.y + r.h - 1 && at(x, y + 1) === 0)) continue; if (free(x, y) && !doorway(x, y) && roomy(x, y, 'chest')) c.push([x, y]); }
      if (c.length) { const p = c[Math.floor(Bc() * c.length)]; claim(...p, 'chest'); chests.push({ x: wx(p[0]), y: wy(p[1]), tier: 3, open: 0, boss: 1, sealed: 1 }); } }
    // a lair (TASKS 381): as many more plain monsters of the fighting rooms as `elites` turn elite, each in a room of its own while
    // there are rooms, and the first one's room holds a chest of the top tier
    if (FM.elites) { const pool = enemies.filter((e) => !e.elite && !D.BOSSES[e.type] && rooms[e.room] && rooms[e.room].type === 'combat'), took = [];
      for (let i = 0; i < FM.elites && pool.length; i++) { const apart = pool.filter((e) => !took.some((q) => q.room === e.room)), e = pick(apart.length ? apart : pool);
        e.elite = 1; took.push(e); pool.splice(pool.indexOf(e), 1); }
      // (a shaped room may have no spot left for it: the next elite's room, then any fighting room)
      for (const r of [...took.map((e) => rooms[e.room]), ...rooms.filter((q) => q.type === 'combat')]) { const p = wallSpot(r, 'chest') || spot(r, 1, 0, true);
        if (p) { chests.push({ x: wx(p[0]), y: wy(p[1]), tier: FM.chest, open: 0, lair: 1 }); break; } } }
    // a floor without light (TASKS 381): only `torch` of the wall torches stay, before a secret's sconce is picked out of them
    if (FM.torch) for (let i = torches.length - 1; i >= 0; i--) if (torches[i].kind === 'wall' && R() >= FM.torch) torches.splice(i, 1);
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
      for (const o of [...chests, ...pots, ...shrines, ...torches.filter((t) => t.kind !== 'wall'), ...decor.filter((d) => d.solid && !d.wall)]) hard(o.x, o.y); if (shop) for (const [x, y] of shop.solid) hard(x, y);
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
      // (TASKS 466) a pile breaks, but the monsters' flow and a body two cells wide don't go through it: the start still reaches the
      // stairs by a way two cells wide past every pile and solid prop (a pile shut a throat of two cells on 4 floors of 32)
      const s0 = start.cy * W + start.cx, e0 = exit.ty * W + exit.tx, wideWay = () => { const c2 = cells.slice(); for (const k of hardC) { const [a, b] = k.split(',').map(Number); c2[b * W + a] = 0; } c2[e0] = 1; return !narrowTo(c2, W, H, s0, [e0]).length; };
      const stack = (r, near) => { const c0 = cellsOf(r, (x, y) => edgeN(x, y) >= 1 && dry(x, y) && free(x, y) && !doorway(x, y) && roomyCell(x, y) && keepsWay(x, y)).sort((a, b) => (near ? Math.hypot(a[0] - near[0], a[1] - near[1]) - Math.hypot(b[0] - near[0], b[1] - near[1]) : 0));
        for (const [x, y] of c0.slice(0, 12)) { const cs = [[x, y], ...N4.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => edgeN(a, b) >= 1 && dry(a, b) && free(a, b) && !doorway(a, b) && roomyCell(a, b))].slice(0, dri(2, 3));
          if (cs.length < 2 || cs.some(([a, b]) => wide.some(([ex, ey, eh]) => Math.abs(ey - b) <= 1 && Math.abs(ex - wx(a)) < eh + 28))) continue;
          const ok = []; for (const [a, b] of cs) { if (!keepsWay(a, b)) break; hardC.add(key(a, b)); ok.push([a, b]); } if (ok.length < 2 || !wideWay()) { for (const [a, b] of ok) hardC.delete(key(a, b)); continue; }
          stackN++; for (const [a, b] of ok) { used.add(key(a, b)); bulk.add(key(a, b)); pots.push({ x: wx(a), y: wy(b), kind: Dr() < 0.5 ? 'barrel' : 'crate', hp: 1, stack: stackN }); wide.push([wx(a), b, 24]); } return true; } return false; };
      const lie = (r, n, k, by) => { for (const [x, y] of cellsOf(r, (x, y) => dry(x, y) && free(x, y) && !doorway(x, y) && rockN(x, y) >= 1 && (!by || Math.hypot(x - by[0], y - by[1]) < 5)).slice(0, k)) {
        used.add(key(x, y)); decor.push({ x: wx(x) + dri(-6, 6), y: wy(y), n, f: Dr() < 0.5 ? 1 : 0, r: r.id, ...(n === 'skel_mg' ? { ember: 1 } : {}) }); } };
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
      // (a banner only against the back wall, TASKS 1054: stood out on the floor it hid the hero to the waist when he passed behind it)
      const standIn = (r, n, k) => { const backOnly = n === 'banner_mg', backC = (x, y) => at(x, y - 1) === 0 && at(x, y - 2) === 0;
        for (let i = 0; i < k; i++) { const c = (backOnly ? cellsOf(r, backC) : [...cellsOf(r, (x, y) => rockN(x, y) >= 1), ...cellsOf(r, () => true)]).find(([x, y]) => canStand(x, y, n)); if (c) stand(...c, n, r.id); } };
      // a hall's props and reward (TASKS 434): its centre the hoard's, its props round it and against the rock
      const near = (r, c, f) => cellsOf(r, f).sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]));
      const chestAt = (r, c) => { const Y = HL.kinds[r.hall].pay, p = near(r, c, (x, y) => canStand(x, y, 'chest'))[0] || near(r, c, (x, y) => free(x, y) && !doorway(x, y))[0]; if (p) { claim(p[0], p[1], 'chest'); hardC.add(key(p[0], p[1])); chests.push({ x: wx(p[0]), y: wy(p[1]), tier: Y.tier, open: 0, ...(Y.forge || Y.stash ? { hall: r.hall } : {}) }); } return p; };
      const goldAt = (r, c, k) => { for (const p of near(r, c, (x, y) => canStand(x, y, 'goldpile')).slice(0, 8)) { if (k <= 0) break; if (!canStand(p[0], p[1], 'goldpile')) continue; claim(p[0], p[1], 'goldpile'); hardC.add(key(p[0], p[1])); pots.push({ x: wx(p[0]), y: wy(p[1]), kind: 'goldpile', hp: 1 }); k--; } };
      const brazierAt = (r, c) => { const p = near(r, c, (x, y) => canStand(x, y, 'brazier'))[0]; if (p) { claim(p[0], p[1], 'brazier'); hardC.add(key(p[0], p[1])); torches.push({ x: wx(p[0]), y: wy(p[1]), kind: 'brazier', r: r.id }); } };
      const hallProps = (r) => { const c = [r.cx, r.cy], back = (x, y) => at(x, y - 1) === 0 && at(x, y - 2) === 0;
        if (r.hall === 'sanctum') { circles.push({ x: wx(c[0]), y: wy(c[1]) - 6, r: r.id, ...(HL.kinds.sanctum.pay.bless ? { bless: 1 } : {}) }); chestAt(r, [c[0], c[1] + 4]);
          for (const [dx, dy] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) { const x = c[0] + dx, y = c[1] + dy; if (free(x, y) && !doorway(x, y)) { used.add(key(x, y)); decor.push({ x: wx(x), y: wy(y), n: 'candles' }); } }
          // (TASKS 1159: spikes in the circle cost 80 HP for its blessing)
          for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.hypot(i, j) <= 2.5) used.add(key(c[0] + i, c[1] + j));
          brazierAt(r, [c[0] - 4, c[1]]); brazierAt(r, [c[0] + 4, c[1]]); standIn(r, 'banner_mg', 2); lie(r, 'bones', dri(2, 3)); }
        // (TASKS 488: the forge on the magma's basalt one, the town's slate came out pink; every hall reads as its kind in the frame and
        // pays as the forge and the sanctum do)
        else if (r.hall === 'forge') { const f = near(r, c, (x, y) => back(x, y) && canStand(x, y, 'forge_mg'))[0] || near(r, c, (x, y) => canStand(x, y, 'forge_mg'))[0]; if (f) stand(...f, 'forge_mg', r.id);
          const a = f && near(r, [f[0] + 3, f[1] + 2], (x, y) => canStand(x, y, 'anvil_tw') && !chests.some((c) => Math.hypot(c.x - wx(x), c.y - wy(y)) < 3 * TILE))[0]; if (a) stand(...a, 'anvil_tw', r.id);
          if (f) { brazierAt(r, [f[0] - 3, f[1] + 1]); brazierAt(r, [f[0] + 4, f[1] - 1]); } standIn(r, 'rack', 2); stack(r); chestAt(r, a ? [a[0] + 2, a[1]] : c); goldAt(r, a || c, HL.kinds.forge.pay.gold); lie(r, 'bones', dri(1, 2)); }
        else if (r.hall === 'nest') { const lieOpen = (n, k) => { for (const [x, y] of cellsOf(r, (x, y) => dry(x, y) && free(x, y) && !doorway(x, y) && !N8.some(([dx, dy]) => at(x + dx, y + dy) === 3)).slice(0, k)) { used.add(key(x, y)); decor.push({ x: wx(x) + dri(-6, 6), y: wy(y), n, f: Dr() < 0.5 ? 1 : 0, r: r.id, ...(n === 'skel_mg' ? { ember: 1 } : {}) }); } };
          lieOpen('skel_mg', dri(5, 6)); lieOpen('bones', dri(6, 8)); chestAt(r, c); goldAt(r, c, HL.kinds.nest.pay.gold); rocks(r, dri(2, 3), false); }
        else if (r.hall === 'prison') { standIn(r, 'cage', dri(4, 5)); standIn(r, 'banner_mg', 1); stack(r); stack(r); chestAt(r, c); goldAt(r, c, HL.kinds.prison.pay.gold); lie(r, 'bones', dri(2, 4)); lie(r, 'skel_mg', 1); } };
      for (const r of rooms) {
        if (r.type === 'shop' || r.type === 'secret' || r.type === 'boss') continue;
        if (plat && r.hall) { hallProps(r); continue; }
        if (r === start && plat) {
          // the cult's camp round the fire: its banners on their posts a few steps off, a pile of its barrels and crates, a cage,
          // the bones of whoever it burnt (TASKS 405)
          const fire = [start.cx, start.cy], ring = (n) => cellsOf(r, (x, y) => Math.hypot(x - fire[0], y - fire[1]) >= 2.5 && Math.hypot(x - fire[0], y - fire[1]) <= 5.5).find(([x, y]) => canStand(x, y, n));
          for (let i = 0; i < 2; i++) { const c = ring('banner_mg'); if (c) stand(...c, 'banner_mg', r.id); }
          stack(r, fire); if (Dr() < 0.5) { const c = ring('cage'); if (c) stand(...c, 'cage', r.id); } lie(r, 'skel_mg', Dr() < 0.5 ? 1 : 0, fire); lie(r, 'bones', dri(1, 2)); r.camp = 1;
          for (let i = 0; i < 3; i++) { const c = ring('vent_mg'); if (c) { used.add(key(c[0], c[1])); decor.push({ x: wx(c[0]), y: wy(c[1]), n: 'vent_mg', r: r.id }); } }
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
          const runs = []; for (let y = r.y; y < r.y + r.h; y++) { let x0 = -1; for (let x = r.x; x <= r.x + r.w; x++) { const ok = x < r.x + r.w && at(x, y) === 1 && (at(x, y + 1) === 0 || at(x, y + 1) === 3) && at(x, y + 2) !== 1 && !over.has((y + 1) * W + x) && !thin.includes((y + 1) * W + x) && !hardC.has(key(x, y));
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
    secrets.forEach((q, i) => { const [fx, fy] = q.front[5], sh = rooms.find((o) => o.type === 'shop') || NO_SHOP, inR = (o, x, y) => x >= o.x - 1 && x <= o.x + o.w && y >= o.y - 1 && y <= o.y + o.h;
      const torchNear = torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.x - q.x) < 2 * TILE && Math.abs(t.y - fy * TILE) < TILE);
      if (q.kind === 'banner' && torchNear) q.kind = 'shelf';
      const hostPlan = (rooms.find((o) => o.id === q.host) || {}).plan;
      if (!cave && q.dir === 'u' && hostPlan === 'library' && (q.kind === 'crack' || q.kind === 'lever') && mul32(seed ^ 0x1355 ^ i)() < D.STATUE_SECRET.planned) q.kind = 'shelf';
      // a statue that slides along the wall (TASKS 1354): two free cells beside the opening under solid wall, the row in front open
      const slides = [1, -1].filter((s) => { const xs = s > 0 ? [fx + 2, fx + 3] : [fx - 2, fx - 1]; return xs.every((x) => (free(x, fy) || q.front.some(([a, b]) => a === x && b === fy)) && !doorway(x, fy) && at(x, fy - 1) === 0 && at(x, fy + 1) === 1 && !secCells.has(fy * W + x)) && !torches.some((t) => t.kind === 'wall' && !t.side && Math.abs(t.y - fy * TILE) < TILE * 1.5 && Math.abs(t.x - (q.x + s * 2 * TILE)) < 24); });
      if (!cave && q.dir === 'u' && (q.kind === 'crack' || q.kind === 'lever') && slides.length && roomy(fx, fy, 'statue', q.x) && !hungAt(q.x, fy, half('statue')) && mul32(seed ^ 0x1354 ^ i)() < (D.STATUE_SECRET.plans.includes(hostPlan) ? D.STATUE_SECRET.planned : D.STATUE_SECRET.p)) { q.kind = 'statue'; q.slide = slides[0] * 2 * TILE; claim(fx, fy, 'statue', q.x); const xs = slides[0] > 0 ? [fx + 2, fx + 3] : [fx - 2, fx - 1]; for (const x of xs) used.add(key(x, fy)); decor.push({ x: q.x, y: fy * TILE + 22, n: 'statue', solid: 1, secret: i }); }
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
      // a sconce counts only if the walk from it to the wall it opens is short: one behind the wall, a floor's walk away, read as a bug (TASKS 1360)
      const nearW = near.filter(([t]) => seen.has(key(Math.floor(t.x / TILE), Math.floor((t.y + 40) / TILE))));
      if (nearW.length && (!plates.length || R() < 0.5)) { const [t, k] = pick(nearW); t.lever = i; q.trig = { k: 'sconce', t: k }; }
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
    for (const d of decor) if (d.solid) sol(d.x, d.y); for (const s of shrines) sol(s.x, s.y); if (shop) for (const [x, y] of shop.solid) sol(x, y);
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
    // (no plates in a nest, TASKS 1041: its ≈ 17 read as a minefield under the smouldering dead)
    const inCircle = (px, py) => circles.some((q) => Math.hypot(px - q.x, py - q.y) < 2.6 * TILE);   // (a foe's post is `used` too, and `ok` lets plates onto those)
    const plate = (r, x, y, ph) => { if (r.hall === 'nest' || x < r.x || y < r.y + 1 || x + 1 >= r.x + r.w || y + 1 >= r.y + r.h || nearDoor(x, y) || crowded(x, y)) return false;
      if (traps.some((t) => Math.abs(t.x / TILE - (x + 1)) < 3 && Math.abs(t.y / TILE - (y + 1)) < 3)) return false;   // plates never touch: no strips
      const cs = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]; if (cs.some(([cx, cy]) => !ok(cx, cy) || inCircle(wx(cx), wy(cy)))) return false;
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
      // a trapped corridor (TASKS 377), a way of its own kind from the 3rd floor: the floor's longest straight stretch two cells wide
      // between rock (five cells and more, a cell off any room), a plate every third cell down all of it, their spikes rising in a wave
      // along it, so it is crossed in time, plate by plate
      // (a cursed floor, TASKS 381: such a row down every straight stretch of `FM.gauntlet` cells and more, the longest first)
      if (LY && depth >= 3 && (FM.gauntlet || R() < (LY.gauntlet ?? 0.7))) { let best = null; const all = [];
        const ok = (x, y) => at(x, y) === 1 && !inAny(x, y, 1) && !used.has(key(x, y)) && !water.includes(y * W + x) && !doors.some((d) => d.cells.some(([dx, dy]) => Math.abs(dx - x) <= 2 && Math.abs(dy - y) <= 2));
        const fits = (hor, u, v) => { const c = (uu, vv) => (hor ? [uu, vv] : [vv, uu]); return ok(...c(u, v)) && ok(...c(u, v + 1)) && at(...c(u, v - 1)) === 0 && at(...c(u, v + 2)) === 0; };
        for (const hor of [1, 0]) for (let v = 3; v < (hor ? H : W) - 4; v++) { let n = 0;
          for (let u = 2; u < (hor ? W : H) - 2; u++) {
            const was = n; n = fits(hor, u, v) ? n + 1 : 0; if (n >= 5 && (!best || n > best[3])) best = [hor, u - n + 1, v, n];
            if (FM.gauntlet && (n === 0 || u === (hor ? W : H) - 3) && Math.max(n, was) >= FM.gauntlet) { const m = n || was; all.push([hor, (n ? u + 1 : u) - m, v, m]); } } }
        const lay = ([hor, u0, v, n]) => { const ph0 = R(), id = traps.length;
          for (let o = (n - 1) % 3 >> 1, k = 0; o + 1 < n; o += 3, k++) { const [px, py] = hor ? [u0 + o, v] : [v, u0 + o];
            for (const [cx, cy] of [[px, py], [px + 1, py], [px, py + 1], [px + 1, py + 1]]) used.add(key(cx, cy));
            traps.push({ x: (px + 1) * TILE, y: (py + 1) * TILE, ph: (ph0 + k * 0.2) % 1, cor: 1, run: id }); } };
        if (!FM.gauntlet) { if (best) lay(best); }
        else for (const q of all.sort((a, b) => b[3] - a[3])) if (Array.from({ length: q[3] }, (_, i) => fits(q[0], q[1] + i, q[2])).every(Boolean)) lay(q); }
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
      for (let i = decor.length - 1; i >= 0; i--) if (/^(vent|torch_stand)/.test(decor[i].n) && decor[i].haz === undefined && circles.some((q) => Math.hypot(decor[i].x - q.x, decor[i].y - q.y) < 3.2 * TILE)) decor.splice(i, 1);
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
    const fitDecal = (d) => { if (inCircle(d.x, d.y)) return; for (let s = d.s; s >= 0.5; s -= 0.05) if (onFloor(d.x, d.y, 20 * s)) { d.s = s; decals.push(d); return; } };
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
    // cobwebs: the sprite is spun across a top-left corner, so a web hangs where the back wall's upper face meets a side wall
    // (mirrored for the right one), its spun corner at the wall's top edge, not on the floor below; more of them in the crypt
    // and the halls than in the fire depths
    const WEB = { crypt: 0.6, arcane: 0.6, dungeon: 0.35, cave: 0.35, lava: 0.15 };
    for (const r of rooms) { const p = WEB[r.zone || biome] || 0.3;
      for (const [x, s, f] of [[r.x, -1, 0], [r.x + r.w - 1, 1, 1]]) { if (at(x, r.y) !== 1 || at(x + s, r.y) !== 0 || at(x, r.y - 1) !== 0 || R() > p) continue;
        const k = 0.95 + 0.35 * R(), w = 40 * k, cx = f ? (x + 1) * TILE - w / 2 : x * TILE + w / 2, x2 = f ? x - 1 : x + 1;
        if ([x, x2].some((q) => at(q, r.y - 1) !== 0 || at(q, r.y - 2) !== 0) || hungAt(cx, r.y, w / 2) || tallAt(cx, r.y, w / 2)) continue;
        decals.push({ x: cx, y: (r.y - 2) * TILE + 4 + w / 2, n: 'dc_web', f, s: k }); } }
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
    // a river's two ways over (TASKS 473) cost each its own: the shortest is guarded at its far landing (a golem; before the golems
    // come, a salamander in the lava by it, or an elite), the next falls under rocks (laid with the hazards below)
    let riverFire = null, riverGuard = null;
    if (riverWay) { const N4 = [1, -1, W, -W], s0 = Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE), e0 = exit.ty * W + exit.tx, Rw = riverWays(cells, W, H, fig, s0, (c) => c === 1), ws = riverAt(Rw, e0);
      if (ws.length >= 2) { const own = (p) => { const o = []; for (let k = 0; k < W * H; k++) if (Rw.lab[k] === p) o.push(k); return o; }, c1 = own(ws[0][1]);
        const dE = new Int32Array(W * H).fill(-1), q = [e0]; dE[e0] = 0; for (let i = 0; i < q.length; i++) for (const o of N4) { const n = q[i] + o; if (dE[n] < 0 && cells[n] === 1) { dE[n] = dE[q[i]] + 1; q.push(n); } }
        const land = c1.flatMap((k) => N4.map((o) => k + o)).filter((n) => cells[n] === 1 && !fig[n] && dE[n] >= 0).sort((a, b) => dE[a] - dE[b])[0];
        const ok = rooms.filter((r) => !['secret', 'start', 'shop'].includes(r.type) && !r.islet), inBoxOf = (r, x, y) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h, barred = (x, y) => rooms.some((r) => (r.type === 'start' || r.type === 'shop') && inBoxOf(r, x, y));
        const roomAt = (x, y) => (ok.find((r) => inBoxOf(r, x, y)) || ok.slice().sort((a, b) => Math.hypot(a.cx - x, a.cy - y) - Math.hypot(b.cx - x, b.cy - y))[0]).id;
        if (land !== undefined) { const lx = land % W, ly = Math.floor(land / W), near = [];
          for (const pad of [1, 0]) { if (near.length) break; for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const x = lx + i, y = ly + j, k = y * W + x; if (free(x, y, pad) && !fig[k] && !barred(x, y) && dE[k] >= 0 && dE[k] <= dE[land] + 1) near.push([x, y, Math.hypot(i, j)]); } }
          near.sort((a, b) => a[2] - b[2]);
          const pool = c1.flatMap((k) => [-2, -1, 0, 1, 2].flatMap((j) => [-2, -1, 0, 1, 2].map((i) => k + j * W + i))).filter((k, i, a) => a.indexOf(k) === i && cells[k] === 3 && !crust.includes(k) && !bridged.has(k) && !lavaUnder.includes(k) && !barred(k % W, Math.floor(k / W)));
          if (roster.includes('golem') && near.length) { const [x, y] = near[0]; used.add(key(x, y)); addEnemy('golem', x, y, roomAt(x, y)); enemies[enemies.length - 1].post = 'ford'; }
          // (an elite on the landing before a salamander in the lava by it, TASKS 486: the salamander did not stand in the way, the
          // choice on the 2nd floor was none; it guards only a landing with no floor to stand an elite on)
          else if (near.length) { const [x, y] = near[0], t = ['skeleton', 'goblin'].find((o) => roster.includes(o)) || roster[0]; used.add(key(x, y)); addEnemy(t, x, y, roomAt(x, y), 1); enemies[enemies.length - 1].post = 'ford'; }
          else if (roster.includes('salamander') && pool.length) { const k = pool[Math.floor(R() * pool.length)]; addEnemy('salamander', k % W, Math.floor(k / W), roomAt(k % W, Math.floor(k / W))); enemies[enemies.length - 1].post = 'ford'; } }
        riverFire = new Set(own(ws[1][1])); riverGuard = new Set(c1); } }
    // a lake's way round pays for its length (TASKS 1040: the islands were the one answer, shorter and no worse): a chest of the 2nd
    // tier half way along it, off the islands' chain
    // a chasm's second way over (TASKS 1054, terrain's `alt` bridge) pays for its length as the lake's way round does: off the walk to
    // the stairs, half way along the part of the other way the walk does not take
    const altC = plat && ftype === 'chasm' ? crossings.filter((c) => c.alt) : [], altB = altC[0] || null;
    if ((lakeWay || altB) && plat) { const N4 = [1, -1, W, -W], s0 = Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE), e0 = exit.ty * W + exit.tx;
      const pathBy = (ban) => { const from = new Int32Array(W * H).fill(-2), qq = [s0]; from[s0] = -1;
        for (let i = 0; i < qq.length && from[e0] === -2; i++) for (const o of N4) { const n = qq[i] + o; if (from[n] === -2 && cells[n] === 1 && !ban[n]) { from[n] = qq[i]; qq.push(n); } }
        const out = []; if (from[e0] !== -2) for (let k = e0; k >= 0; k = from[k]) out.push(k); return out; };
      const chain = new Uint8Array(W * H); let way = [];
      if (lakeWay) { const q = rooms.filter((r) => r.isle).map((r) => r.cy * W + r.cx).filter((k) => cells[k] === 1); for (const k of q) chain[k] = 1;
        for (let i = 0; i < q.length; i++) for (const o of N4) { const n = q[i] + o; if (!chain[n] && fig[n] && cells[n] === 1) { chain[n] = 1; q.push(n); } }
        way = pathBy(chain); }
      else { const B = crossings.find((c) => !c.alt && c.cells.includes(altB.of)), noAlt = new Uint8Array(W * H); for (const c of altC) for (const k of c.cells) noAlt[k] = 1;
        if (B) { const viaMain = pathBy(noAlt); for (const k of B.cells) chain[k] = 1; const viaAlt = pathBy(chain); if (viaAlt.length) { const walked = viaAlt.length === viaMain.length && pathBy(new Uint8Array(W * H)).some((k) => altC.some((c) => c.cells.includes(k))), altLong = !walked && viaAlt.length >= viaMain.length, short = altLong ? viaMain : viaAlt, on = new Set(short); way = (altLong ? viaAlt : viaMain).filter((k) => !on.has(k)); for (const c of altC) for (const k of c.cells) chain[k] = 1; for (const k of short) for (const o of [0, ...N4]) chain[k + o] = 1; } } }   // (TASKS 1169: the chest goes on the branch a walker to the stairs would not take)
      const cand = way.slice(Math.floor(way.length * 0.3), Math.ceil(way.length * 0.7)).flatMap((k) => [0, 1, -1, W, -W, 2, -2, 2 * W, -2 * W].map((o) => k + o)), ok = (k, pad) => cells[k] === 1 && !chain[k] && free(k % W, Math.floor(k / W), pad) && ![...decor, ...pots, ...torches].some((d) => Math.hypot(d.x - wx(k % W), d.y - wy(Math.floor(k / W))) < 64 || (Math.abs(Math.floor(d.y / TILE) - Math.floor(k / W)) <= 1 && Math.abs(d.x - wx(k % W)) < (D.PROP_W.chest + (D.PROP_W[d.n] || 0)) / 2 + 4)) && !traps.some((d) => Math.hypot(d.x - wx(k % W), d.y - wy(Math.floor(k / W))) < 110) && !chests.some((c) => Math.hypot(c.x - wx(k % W), c.y - wy(Math.floor(k / W))) < 96) && !doorway(k % W, Math.floor(k / W));
      const roomy8 = (k) => [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].filter((o) => cells[k + o] === 1).length >= 6;   // (never across a ridge's narrow)
      const all = way.flatMap((k) => [0, 1, -1, W, -W, 2, -2, 2 * W, -2 * W].map((o) => k + o)), mid = cand.find((k) => ok(k, 1)) ?? cand.find((k) => ok(k, 0) && roomy8(k)) ?? all.find((k) => ok(k, 0) && roomy8(k));   // (TASKS 1161: props in its middle third cost a lake its chest)
      if (mid !== undefined) { const x = mid % W, y = Math.floor(mid / W); claim(x, y, 'chest'); chests.push({ x: wx(x), y: wy(y), tier: 2, open: 0, round: 1 }); } }
    const hazards = [];
    if (plat) { const Z = mul32(seed ^ 0x406a), HZ = D.HAZ, keepOff = [[wx(start.cx), wy(start.cy)], [spawn.x, spawn.y], [exit.x, exit.y], ...chests.map((c) => [c.x, c.y]), ...enemies.map((e) => [e.x, e.y]), ...shrines.map((q) => [q.x, q.y]), ...circles.map((q) => [q.x, q.y])];
      const clear = (x, y) => keepOff.every(([px, py]) => Math.hypot(px - wx(x), py - wy(y)) >= (HZ.clear + 0.5) * TILE) && !(Math.abs(x - shopR.cx) <= 6 && y >= shopR.y - 2 && y <= shopR.y + 7);
      const under = new Set(lavaUnder), inBox = (x, y) => rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      const shuf = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Z() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const lay = (k, cand, ordered) => { const H = HZ[k]; let n = H.n[Math.min(floor, H.n.length) - 1] - hazards.filter((z) => z.k === k && !z.tail && !z.islet).length;
        for (const [x, y] of ordered ? cand : shuf(cand)) { if (n <= 0) break; if (!clear(x, y) || hazards.some((z) => z.k === k && Math.hypot(z.x - wx(x), z.y - wy(y)) < H.apart * TILE)) continue;
          const z = { k, x: wx(x), y: wy(y), per: H.per[0] + Z() * (H.per[1] - H.per[0]), ph: Z() }; hazards.push(z); n--;
          if (k === 'vent') { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) used.add(key(x + i, y + j)); decor.push({ x: z.x, y: z.y, n: 'vent_mg', r: roomOf(x, y), haz: hazards.length - 1 }); } } };
      const roomOf = (x, y) => { const q = rooms.find((r) => r.type !== 'secret' && inRm(r, x, y)); return q ? q.id : -1; };
      // (TASKS 461) laid at random they stood on the walk to the stairs 1.5 rings a floor, a third of floors none: HZ.fall.aim rocks
      // go first on its narrows, a ridge between the lava or a crossing's landing, and the vents by the chests off it, where a
      // reward is worth the risk; the rest at random as before
      // (TASKS 1160: a river's aimed rocks go down the way that is not guarded; moved off the guard's landings only, they went on along its road, 1.70 runs against 0.70)
      const way = (() => { const s0 = Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE), e = exit.ty * W + exit.tx, by = (ban) => { const from = new Int32Array(W * H).fill(-2), q = [s0]; from[s0] = -1;
          for (let i = 0; i < q.length && from[e] === -2; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (from[n] === -2 && cells[n] === 1 && !(ban && ban.has(n))) { from[n] = q[i]; q.push(n); } }
          const out = []; if (from[e] !== -2) for (let k = e; k >= 0; k = from[k]) out.push(k); return out; }, free = riverGuard ? by(riverGuard) : [];
        return free.length ? free : by(null); })(), onWay = new Set(way);
      const wide = (x, y) => { let n = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (at(x + i, y + j) === 1 && !under.has((y + j) * W + x + i)) n++;
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (under.has((y + j) * W + x + i)) return n - 8; return n; };
      // (a lake's islands are the short way under fire, TASKS 472: on its floor the aimed rocks fall first on the islands and the
      // landings and crossings onto them, one an island, by the lava as they are; a vent wants 3×3 of free floor, which their hoard and their packs leave none of)
      const isl = ftype === 'lake' ? rooms.filter((r) => r.isle) : [], isleOf = (x, y) => isl.findIndex((r) => x >= r.x - 2 && x < r.x + r.w + 2 && y >= r.y - 2 && y < r.y + r.h + 2);
      const narrows = way.map((k) => [k % W, Math.floor(k / W)]).filter(([x, y]) => (!under.has(y * W + x) || isleOf(x, y) >= 0) && (!used.has(key(x, y)) || (shore.has(key(x, y)) && isleOf(x, y) >= 0))).map(([x, y], i) => [x, y, wide(x, y), i]).sort((a, b) => (isleOf(b[0], b[1]) >= 0) - (isleOf(a[0], a[1]) >= 0) || a[2] - b[2] || a[3] - b[3]);
      const aim = Math.min(Math.max(HZ.fall.aim, isl.length), HZ.fall.n[Math.min(floor, HZ.fall.n.length) - 1]), hit = new Set();
      // (a chasm's bridges, TASKS 474: on its floor a rock falls on the longest bridge the walk to the stairs takes, over and above
      // the aimed ones: crossing it is a matter of the moment)
      if (ftype === 'chasm' || MIX) { const cand = crossings.filter((c) => c.chasm && c.cells.some((k) => onWay.has(k))).sort((a, b) => b.cells.length - a.cells.length);
        // (a second pass past `clear`, TASKS 1644: with second ways over, the walk's only bridge can stand by a landing's pack)
        span: for (const free of [true, false]) for (const c of cand) { const cs = c.cells, mx = cs.reduce((a, k) => a + k % W, 0) / cs.length, my = cs.reduce((a, k) => a + Math.floor(k / W), 0) / cs.length;
          const p = cs.filter((k) => onWay.has(k)).map((k) => [k % W, Math.floor(k / W)]).filter(([x, y]) => !free || clear(x, y)).sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my))[0];
          if (p) { hazards.push({ k: 'fall', x: wx(p[0]), y: wy(p[1]), per: HZ.fall.per[0] + Z() * (HZ.fall.per[1] - HZ.fall.per[0]), ph: Z(), aim: 1, span: 1 }); break span; } } }
      // (a river's second way over, TASKS 473: a rock falls in its middle)
      if (riverFire) { const cs = [...riverFire], mx = cs.reduce((a, k) => a + k % W, 0) / cs.length, my = cs.reduce((a, k) => a + Math.floor(k / W), 0) / cs.length;
        const c = cs.map((k) => [k % W, Math.floor(k / W)]).filter(([x, y]) => clear(x, y)).sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my))[0];
        // (a run of them down its way over, as the walk's own aimed rocks are, TASKS 1040: off the walk to the stairs it stayed one rock
        // and the second way cost less than the guarded first)
        if (c) { const z = { k: 'fall', x: wx(c[0]), y: wy(c[1]), per: HZ.fall.per[0] + Z() * (HZ.fall.per[1] - HZ.fall.per[0]), ph: Z(), aim: 1, ford: 1 }; hazards.push(z);
          const run = cs.map((k) => [k % W, Math.floor(k / W)]).filter(([x, y]) => clear(x, y) && Math.hypot(x - c[0], y - c[1]) <= HZ.fall.run + 0.5).sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1])).slice(0, 2 * HZ.fall.run + 1);
          const ax = Math.abs(Math.max(...run.map((q) => q[0])) - Math.min(...run.map((q) => q[0]))) >= Math.abs(Math.max(...run.map((q) => q[1])) - Math.min(...run.map((q) => q[1]))) ? 0 : 1, dir = Z() < 0.5 ? 1 : -1;
          run.sort((a, b) => (a[ax] - b[ax]) * dir); const i0 = run.findIndex((q) => q[0] === c[0] && q[1] === c[1]);
          run.forEach((q, i) => { const ph = ((z.ph - (i - i0) * HZ.fall.gap / z.per) % 1 + 1) % 1; if (i === i0) return; hazards.push({ ...z, x: wx(q[0]), y: wy(q[1]), ph, tail: 1 }); });
          z.ph = ((z.ph % 1) + 1) % 1; } }
      // (none by a river's guarded way over, TASKS 1051: it carried the walk's rock runs on top of its guard, 1.4 against 0.6)
      const byGuard = (x, y) => !!riverGuard && [...riverGuard].some((k) => Math.max(Math.abs(k % W - x), Math.abs(Math.floor(k / W) - y)) <= 6);   // (6 cells: at 3 the runs by its landings stayed, TASKS 1057)
      for (const pass of [0, 1]) for (const [x, y] of narrows) { if (hazards.filter((z) => z.k === 'fall' && !z.ford && !z.span).length >= aim) break; const ii = isleOf(x, y); if ((!pass && ii >= 0 && hit.has(ii)) || byGuard(x, y)) continue;
        if (!clear(x, y) || hazards.some((z) => Math.hypot(z.x - wx(x), z.y - wy(y)) < HZ.fall.apart * TILE)) continue;
        hazards.push({ k: 'fall', x: wx(x), y: wy(y), per: HZ.fall.per[0] + Z() * (HZ.fall.per[1] - HZ.fall.per[0]), ph: Z(), aim: 1 }); if (ii >= 0) hit.add(ii); }
      // an aimed rock is a run of them down the walk (TASKS 485): HZ.fall.run cells either way of it fall one after another HZ.fall.gap
      // s apart, from one end, on the same clock. One ring was crossed in ≈ 0.2 s and none of ≈ 410 ever hit the hero: the run is
      // waited out or dashed through, not walked into
      for (const z of hazards.filter((q) => q.k === 'fall' && q.aim)) { const i0 = way.indexOf(Math.floor(z.y / TILE) * W + Math.floor(z.x / TILE)); if (i0 < 0) continue;
        const dir = Z() < 0.5 ? 1 : -1, cs = []; for (let j = -HZ.fall.run; j <= HZ.fall.run; j++) { const k = way[i0 + j]; if (k === undefined || (j && (!clear(k % W, Math.floor(k / W)) || under.has(k) && !z.span))) continue; cs.push([k, (j + HZ.fall.run) * dir]); }
        const o0 = Math.min(...cs.map((c) => c[1])), ph0 = z.ph; for (const [k, o] of cs) { const ph = ((ph0 - (o - o0) * HZ.fall.gap / z.per) % 1 + 1) % 1;
          if (k === Math.floor(z.y / TILE) * W + Math.floor(z.x / TILE)) { z.ph = ph; continue; } hazards.push({ ...z, x: wx(k % W), y: wy(Math.floor(k / W)), ph, tail: 1 }); } }
      // a hoard's islet (TASKS 1054: its strip of thin crust had no hazard and no monster, the risk only a stop on it) has a run of
      // rocks down its strip: crossed in their window, waited out on the bank, never on the crust
      for (const r of rooms.filter((q) => q.islet)) { const cs = thin.filter((k) => Math.max(Math.abs(k % W - r.cx), Math.abs(Math.floor(k / W) - r.cy)) <= AR.lava.islet.len[1] + 3);
        if (cs.length < 4) continue; const xs = cs.map((k) => k % W), ys = cs.map((k) => Math.floor(k / W)), hor = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys), a0 = hor ? Math.min(...ys) : Math.min(...xs);
        const line = cs.filter((k) => (hor ? Math.floor(k / W) : k % W) === a0).sort((a, b) => (hor ? a % W - b % W : a - b)), dir = Z() < 0.5 ? 1 : -1, c = line[line.length >> 1];
        const z = { k: 'fall', x: wx(c % W), y: wy(Math.floor(c / W)), per: HZ.fall.per[0] + Z() * (HZ.fall.per[1] - HZ.fall.per[0]), ph: Z(), aim: 1, islet: 1 }; hazards.push(z);
        const every = Math.max(1, Math.ceil(line.length / 5));
        line.forEach((k, i) => { if (k === c || (i - (line.length >> 1)) % every) return; const ph = ((z.ph - (i - (line.length >> 1)) / every * dir * HZ.fall.gap / z.per) % 1 + 1) % 1; hazards.push({ ...z, x: wx(k % W), y: wy(Math.floor(k / W)), ph, tail: 1 }); }); }
      const halls = rooms.filter((r) => !r.pocket && ['combat', 'exit', 'treasure'].includes(r.type)), vents = [];
      for (const r of halls) for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (free(x, y, 1) && !doorway(x, y) && !shore.has(key(x, y)) && !altC.some((c) => c.cells.some((k) => Math.max(Math.abs(k % W - x), Math.abs(Math.floor(k / W) - y)) <= 4))) vents.push([x, y]);
      const byChest = (x, y) => !onWay.has(y * W + x) && chests.some((c) => Math.hypot(c.x - wx(x), c.y - wy(y)) < 6.5 * TILE);
      // a gate of vents across the walk, bursting together on a short visible clock: pass in the window between bursts, not round a ring
      // (TASKS 1645: every hazard was solved by one move, stepping round a circle); it takes vents off the floor's count, so the rest thin out
      if (biome === 'magma' && floor <= 3 && way.length > 40 && HZ.vent.gate) { const G = HZ.vent.gate, w = way.slice(Math.floor(way.length * 0.35), Math.floor(way.length * 0.65)), deck = new Set(crossings.flatMap((c) => c.cells));
        // (a gate is only a question if no way runs outside its rings, however long)
        const seals = (row) => { const zs = row.map((c) => ({ k: 'vent', x: wx(c % W), y: wy(Math.floor(c / W)) })), seen = new Uint8Array(W * H), q = [way[0]], end = way[way.length - 1]; seen[way[0]] = 1;
          for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) { const n = q[i] + o; if (n < 0 || n >= W * H || seen[n] || !(cells[n] === 1 || cells[n] === 6 || deck.has(n)) || zs.some((z) => D.hazIn(z, wx(n % W), wy(Math.floor(n / W))))) continue; if (n === end) return false; seen[n] = 1; q.push(n); }
          return true; };
        for (let i = 1; i < w.length - 1; i++) { const k = w[i], d = Math.abs(w[i + 1] - w[i - 1]) === 2 ? 1 : W, side = d === 1 ? W : 1, row = [-2, 0, 2].map((j) => k + side * j * 1), x0 = k % W, y0 = Math.floor(k / W);
          if (!row.every((c) => cells[c] === 1 && clear(c % W, Math.floor(c / W)) && !under.has(c) && !used.has(key(c % W, Math.floor(c / W))))) continue;
          if (!seals(row)) continue;
          const per = G.per, ph = Z(); for (const c of row) { const x = c % W, y = Math.floor(c / W), z = { k: 'vent', gate: 1, x: wx(x), y: wy(y), per, ph }; hazards.push(z); for (let j = -1; j <= 1; j++) for (let i2 = -1; i2 <= 1; i2++) used.add(key(x + i2, y + j)); decor.push({ x: z.x, y: z.y, n: 'vent_mg', r: roomOf(x, y), haz: hazards.length - 1 }); }
          // (and a share of the walk's rock tails goes, the player's decision on 1645: the gate is not to raise the floor's damage)
          // (from a run's far ends only: a hole in its middle broke its even step)
          { const gone = new Set(); for (const z0 of hazards) { if (z0.k !== 'fall' || !z0.aim || z0.tail) continue; const run = hazards.map((z, j) => [z, j]).filter(([z]) => z.k === 'fall' && z.tail && z.per === z0.per), off = ([z]) => Math.abs((((z.ph - z0.ph) % 1 + 1.5) % 1) - 0.5);
              run.sort((a, b) => off(b) - off(a)).slice(0, G.tails).forEach(([, j]) => gone.add(j)); }
            for (const d of decor) if (d.haz !== undefined) d.haz -= [...gone].filter((j) => j < d.haz).length;
            for (const j of [...gone].sort((p, q) => q - p)) hazards.splice(j, 1); }
          break; } }
      lay('vent', shuf(vents).map((v) => [v, byChest(...v) ? 0 : 1]).sort((a, b) => a[1] - b[1]).map(([v]) => v), true);
      // (a plain terrace floor whose surge the walk to the stairs misses is laid again: its surge is the floor's question)
      if (terr && !MIX && strict && !surge.cells.some((k) => onWay.has(k))) return null;
      if (surge.cells.length) { const S2 = HZ.surge, n = surge.cells.length, mx = surge.cells.reduce((a, k) => a + k % W, 0) / n, my = surge.cells.reduce((a, k) => a + Math.floor(k / W), 0) / n;
        hazards.push({ k: 'surge', x: wx(Math.round(mx)), y: wy(Math.round(my)), per: S2.per[0] + Z() * (S2.per[1] - S2.per[0]), ph: Z(), W, cells: surge.cells, lv: surge.lv }); }
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
    for (const c of chests) bl(c.x, c.y); for (const t of torches) if (t.kind !== 'wall') bl(t.x, t.y); for (const d of decor) if (d.solid) bl(d.x, d.y); for (const s of shrines) bl(s.x, s.y); if (shop) for (const [x, y] of shop.solid) bl(x, y);
    // the waystone is solid too (TASKS 1024: off the block, the bot's way to the exit ran through it on seeds 55 and 58 and it stood there 400 s)
    if (wayStone) bl(wayStone.x, wayStone.y);
    // a fountain's basin stands on the floor, three cells wide; a stream's culvert is in the wall (TASKS 230)
    for (const q of waterFeatures) if (q.kind === 'fountain') for (const dx of [-TILE, 0, TILE]) bl(q.x + dx, q.y);
    // (a floor type's invariants selfCheck holds it to, kept by a retry, TASKS 432: the plateaus' sizes vary, and a rare floor
    // came out with its lava past its type's share or a lava cave with one way over its streams)
    if (plat) { const fl = cells.filter((c) => c === 1).length, sh = shareOf, share = lava.length / (fl + lava.length);
      if (share < sh[0] || share > sh[1] || (lc && crossings.filter((c) => c.lava).length < 2)) return null; }
    // a stone arch shows only over a river running toward the camera (across the screen its side is a causeway, drawn as slabs: 3 of
    // a floor's 4 arches read as no arch at all), and its span reaches 3 cells either side: by a bridge it stood on its boards (TASKS 480)
    const nearX = (a, b) => a.cells.some((k) => b.cells.some((j) => Math.max(Math.abs(k % W - j % W), Math.abs(Math.floor(k / W) - Math.floor(j / W))) <= 4));
    if (plat) for (const c of crossings) if (c.kind === 'arch' && (c.axis !== 'x' || crossings.some((q) => q.kind === 'bridge' && nearX(c, q)))) c.kind = 'slabs';
    // a chapter's first floor gives the hero room under its banner (TASKS 1204)
    if ((D.RUNS[opts.mode || 'campaign'].chapters || []).some((c) => c.from === runFloor)) for (let i = enemies.length - 1; i >= 0; i--) if (Math.hypot(enemies[i].x - (up ? up.x : spawn.x), enemies[i].y - (up ? up.y + 46 : spawn.y)) < 9 * TILE) enemies.splice(i, 1);
    // a stream of its own: which chests are trapped must not move anything else on the floor (TASKS 1357)
    if (runFloor >= D.CHEST_TRAP.from) { const Tc = mul32(seed ^ 0x1357), T = D.CHEST_TRAP; let n = 0; for (const c of chests) { const v = Tc(); if (n < T.max && !c.boss && !c.lair && c.key === undefined && v < T.p) { c.trap = 1; n++; } } }
    if (runFloor >= D.MIMIC.from) { const Mc = mul32(seed ^ 0x367), st = rooms.find((r) => r.type === 'start'), inSt = (c) => st && c.x >= st.x * TILE && c.x < (st.x + st.w) * TILE && c.y >= st.y * TILE && c.y < (st.y + st.h) * TILE; for (const c of chests) { const v = Mc(); if (v < D.MIMIC.p && !c.boss && !c.lair && !c.trap && !c.hall && c.sec === undefined && c.key === undefined && !inSt(c)) { c.mimic = 1; break; } } }
    const map = { seed, floor: runFloor, biome, mod: ST.mod, arch: arch || 'rooms', cliff, ridges: plat ? lines.map((q) => Math.round(ridgeLen(q))) : undefined, W, H, cells, rooms, block, decals, edges: edges.map((e) => [e[0], e[1]]), start: start.id, exitRoom: exitR.id, exit, spawn, sanct,
      ftype, ftype2, shareOf, ...(riverGuard ? { riverGuard: [...riverGuard], riverFire: [...riverFire] } : {}), ...(thin.length ? { thin } : {}), ...(circles.length ? { circles } : {}), ...(stepHold.size ? { steps: [...stepHold] } : {}), ...(riverWay ? { riverWay, riverBand: riverB.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]) } : {}), ...(lakeWay ? { lakeWay, lakeAt: figAt.map((v) => Math.round(v * 10) / 10) } : {}), bossType, walk, down, up, pits, ledges, lay: LY ? ST.lay || 'rooms' : undefined, way: wayStone, wander: wander ? 1 : 0, enemies, chests, pots, traps, torches, decor, shrines, rugs, shop, secrets, secretsWanted, ...(plat ? { hazards } : {}), lava: lava.length, lavaFlow: flow, crust, lavaUnder, chasmUnder: [...chasmUnder], lavaFeatures, lavaBodies, streams, water, waterFlow, waterFeatures, waterBridges, deep: cells.filter((c) => c === 6).length, crossings, doors, locks, webs, ambush, drips, flora, serpentPools, floodCells };
    // (a magma floor keeps two thirds of its rewards and more off the way and a reward at the end of every dead end off it, TASKS 433;
    // the rare floor that misses is laid again)
    if (plat && !boss && strict) { const q = rewardsOf(map); if (q.onWay * 3 > q.list.length || q.bare.length) return null; }
    // (the crossings laid over the lava after the roles may have cut the islands' chain: the lake's ways are counted again on the
    // floor as laid, from the spawn to the stairs)
    // (a river's choice counted again on the floor as laid, TASKS 473: its crossings may have merged two places into one)
    if (riverWay) { const Rw = riverWays(cells, W, H, fig, Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE), (c) => c === 1), ws = riverAt(Rw, exit.ty * W + exit.tx);
      riverWay.ways = ws.map((q) => q[0]); riverWay.dry = Rw.dry[exit.ty * W + exit.tx]; if (!lastTry && !riverOk(Rw, exit.ty * W + exit.tx, strict ? AR.river.choice : AR.river.loose)) return null; }
    if (lakeWay) { Object.assign(lakeWay, lakeWays(cells, W, H, fig, Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE), exit.ty * W + exit.tx, rooms.filter((r) => r.isle), (c) => c === 1)); if (!lakeOk(lakeWay, strict, lastTry)) return null; }
    // the choice a lake or a river floor puts is seen from its first bank (TASKS 486: the way round and the stairs lay in the fog when
    // the hero came out by the water, so the islands or the nearest crossing were the only answer): the floor of every way over and
    // of the stairs' room shows once he stands within 3 cells of the water on his side of it (choice.at)
    if (lakeWay || riverWay) { const s0 = Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE), e0 = exit.ty * W + exit.tx, N4 = [1, -1, W, -W], walk = (cells[s0] === 1);
      const pathBy = (ok) => { const from = new Int32Array(W * H).fill(-2), q = [s0]; from[s0] = -1;
        for (let i = 0; i < q.length && from[e0] === -2; i++) for (const o of N4) { const n = q[i] + o; if (from[n] === -2 && cells[n] === 1 && ok(n)) { from[n] = q[i]; q.push(n); } }
        const out = []; if (from[e0] !== -2) for (let k = e0; k >= 0; k = from[k]) out.push(k); return out; };
      const ways = []; if (lakeWay) { const chain = new Uint8Array(W * H), q = rooms.filter((r) => r.isle).map((r) => r.cy * W + r.cx).filter((k) => cells[k] === 1); for (const k of q) chain[k] = 1;
        for (let i = 0; i < q.length; i++) for (const o of N4) { const n = q[i] + o; if (!chain[n] && fig[n] && cells[n] === 1) { chain[n] = 1; q.push(n); } }
        ways.push(pathBy(() => true), pathBy((n) => !chain[n])); }
      else { const Rw = riverWays(cells, W, H, fig, s0, (c) => c === 1); for (const [, pl] of riverAt(Rw, e0).slice(0, 3)) ways.push(pathBy((n) => Rw.lab[n] < 0 || Rw.lab[n] === pl)); }
      const show = new Set(); for (const w of ways) for (const k of w) for (const o of [0, ...N4]) if (cells[k + o] === 1) show.add(k + o);
      for (let y = exitR.y - 1; y <= exitR.y + exitR.h; y++) for (let x = exitR.x - 1; x <= exitR.x + exitR.w; x++) if (cells[y * W + x] === 1) show.add(y * W + x);
      const mine = new Int32Array(W * H).fill(-1), q = [s0]; mine[s0] = 0; for (let i = 0; i < q.length; i++) for (const o of N4) { const n = q[i] + o; if (mine[n] < 0 && cells[n] === 1 && !fig[n]) { mine[n] = 1; q.push(n); } }
      const at = []; for (const k of q) { const x = k % W, y = Math.floor(k / W); let near = false; for (let j = -3; j <= 3 && !near; j++) for (let i = -3; i <= 3 && !near; i++) if (fig[(y + j) * W + x + i] && cells[(y + j) * W + x + i] === 3) near = true; if (near) at.push(k); }
      if (walk && at.length && show.size) map.choice = { at, show: [...show] }; }
    // (TASKS 1158: a chasm's second way over is a choice like the lake's, and lay in the fog from where it is made)
    if (altB && crossings.some((c) => !c.alt && c.cells.includes(altB.of))) { const s0 = Math.floor(spawn.y / TILE) * W + Math.floor(spawn.x / TILE), e0 = exit.ty * W + exit.tx, N4 = [1, -1, W, -W], B = crossings.find((c) => !c.alt && c.cells.includes(altB.of)), altS = new Set(altC.flatMap((c) => c.cells)), mainS = new Set(B.cells);
      const pathBy = (ban) => { const from = new Int32Array(W * H).fill(-2), q = [s0]; from[s0] = -1; for (let i = 0; i < q.length && from[e0] === -2; i++) for (const o of N4) { const n = q[i] + o; if (from[n] === -2 && cells[n] === 1 && !ban.has(n)) { from[n] = q[i]; q.push(n); } } const out = []; if (from[e0] !== -2) for (let k = e0; k >= 0; k = from[k]) out.push(k); return out; };
      const show = new Set(); for (const w of [pathBy(altS), pathBy(mainS)]) for (const k of w) for (const o of [0, ...N4]) if (cells[k + o] === 1) show.add(k + o);
      for (let y = exitR.y - 1; y <= exitR.y + exitR.h; y++) for (let x = exitR.x - 1; x <= exitR.x + exitR.w; x++) if (cells[y * W + x] === 1) show.add(y * W + x);
      const mine = new Uint8Array(W * H), q = [s0]; mine[s0] = 1; for (let i = 0; i < q.length; i++) for (const o of N4) { const n = q[i] + o; if (!mine[n] && cells[n] === 1 && !altS.has(n) && !mainS.has(n)) { mine[n] = 1; q.push(n); } }
      const span = [...altS, ...mainS], at = q.filter((k) => span.some((j) => Math.max(Math.abs(k % W - j % W), Math.abs(Math.floor(k / W) - Math.floor(j / W))) <= 3));
      if (cells[s0] === 1 && at.length && show.size) map.choice = { at, show: [...show] }; }
    if (strict && rooms.some((r) => r.hall && !chests.some((c) => inRm(r, Math.floor(c.x / TILE), Math.floor(c.y / TILE))))) return null;
    return map;
  };
})(typeof window !== 'undefined' ? window : globalThis);
