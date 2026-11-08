// live/dungeon_terrain.js — roles (start, exit, merchant), lava pools, rivers and plateaus, the caves' water, secret rooms and doors.
// A stage of tryGen (ARCHITECTURE.md §4.2): it reads the floor's shared values from GF and leaves there what later stages use; null rerolls.
(function (root) {
  const DGX = root.DGX, {
    D, NO_SHOP, TILE, WALK_FAR, crossCuts, inRm, lakeOk, lakeWays, mul32, narrowTo, noise2, riverAt, riverOk, riverWays, straightRuns,
    wayRooms } = DGX;
  DGX.terrain = (GF) => {
    const {
      AR, FM, H, LY, MIX, MX, R, ST, TY, W, adj, at, biome, boss, bossType, breakRuns, cave, cells, court, depth, dist, edges, fig, figAt,
      figHit, floor, ftype, keep, lakeEnds, last, lastTry, lc, main, opts, pick, pl, plat, ri, riverY, rooms, runFloor, seed, set, side,
      altTry, strict, terr, tidy } = GF;
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
      const far = Math.max(...leaves.map(at0)); leaves = leaves.filter((r) => at0(r) >= far * WALK_FAR); }
    // the plateaus (TASKS 400) put their start and stairs as far apart on foot as the floor has them: a pair of plateaus, the start a
    // leaf, drawn from those within a tenth of the longest walk
    // (a terrace floor's start and stairs are the serpentine's two ends: its first row's free end and its last row's)
    if (terr) { const free = (row, next) => { const tied = edges.find((e) => next && ((row.includes(e[0]) && next.includes(e[1])) || (row.includes(e[1]) && next.includes(e[0])))), t = tied ? (row.includes(tied[0]) ? tied[0] : tied[1]) : -1;
        return rooms[t === row[0] ? row[row.length - 1] : row[0]]; };
      leaves = [free(terr.rows[0], terr.rows[1]), free(terr.rows[terr.rows.length - 1], terr.rows[terr.rows.length - 2])]; }
    // (a lake's start and stairs are its chain's two ends, TASKS 472: the way over the islands must save AR.lake.save of the walk
    // round, [least, most], or the islands are no choice)
    if (ftype === 'lake' && !lakeEnds && !lastTry) return null;
    let lakeWay = null;
    if (lakeEnds) {
      const mid = (AR.lake.save[0] + AR.lake.save[1]) / 2, isl = rooms.filter((r) => r.isle); let best = null;
      for (const ai of lakeEnds[0]) { const A = rooms[ai];
        for (const bi of lakeEnds[1]) { const B = rooms[bi], q = Object.assign(lakeWays(cells, W, H, fig, A.cy * W + A.cx, B.cy * W + B.cx, isl, (c) => !!c), { a: ai, b: bi }); if (q.isle < 0) continue;
          const sv = q.round > 0 ? 1 - q.isle / q.round : -1; if (!best || Math.abs(sv - mid) < Math.abs(best.sv - mid)) best = Object.assign(q, { sv }); } }
      if (!best) return null; lakeWay = { isle: best.isle, round: best.round, ends: [best.a, best.b] }; if (!lakeOk(lakeWay, strict, lastTry)) return null; }
    // (a river's start and stairs, TASKS 473: a plateau on each bank, the pair whose two shortest ways over the river are within
    // AR.river.choice of each other, the longest such walk; no pair, no floor)
    let riverWay = null;
    if (riverY.length && pl) { const RV = AR.river, cand = (sd) => rooms.filter((r, i) => i < main && !r.isle && !r.pocket && !narrow(r) && side(r) === sd); let best = null;
      for (const A of cand(-1)) { const Rw = riverWays(cells, W, H, fig, A.cy * W + A.cx, (c) => !!c);
        for (const B of cand(1)) { const ws = riverAt(Rw, B.cy * W + B.cx); if (!riverOk(Rw, B.cy * W + B.cx, RV.choice)) continue;
          if (!best || ws[0][0] > best.w) best = { a: A, b: B, w: ws[0][0], ws: ws.map((q) => q[0]) }; } }
      if (!best && !lastTry) return null; if (best) riverWay = { ways: best.ws, ends: [best.a.id, best.b.id] }; }
    const far = riverWay ? (R() < 0.5 ? [rooms[riverWay.ends[0]], rooms[riverWay.ends[1]], riverWay.ways[0]] : [rooms[riverWay.ends[1]], rooms[riverWay.ends[0]], riverWay.ways[0]]) : lakeWay ? (R() < 0.5 ? [rooms[lakeWay.ends[0]], rooms[lakeWay.ends[1]], lakeWay.isle] : [rooms[lakeWay.ends[1]], rooms[lakeWay.ends[0]], lakeWay.isle]) : pl && !boss ? (() => { const main = terr ? leaves.slice() : rooms.filter((r) => !r.pocket && !r.isle && !narrow(r)), walk = (r) => { const d = new Int32Array(W * H).fill(-1), q = [r.cy * W + r.cx]; d[q[0]] = 0;
        for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && cells[n]) { d[n] = d[q[i]] + 1; q.push(n); } } return d; };
      const pairs = []; for (const a of leaves.length ? leaves : main) { const d = walk(a); for (const b of main) if (b !== a) pairs.push([a, b, d[b.cy * W + b.cx]]); }
      const top = Math.max(...pairs.map((p) => p[2])), good = pairs.filter((p) => p[2] >= top * 0.9); return pick(good); })() : null;
    // (the last few tries take nine tenths of it: the close-set plateaus, TASKS 422, leave a rare seed no floor that walks the whole)
    // the merchant's room, on every floor: the counter and his back wall need a solid top wall and no corridor mouth near them
    const isDoor = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const nx = x + i, ny = y + j;
      if (at(nx, ny) === 1 && !rooms.some((q) => nx >= q.x && nx < q.x + q.w && ny >= q.y && ny < q.y + q.h)) return true; } return false; };
    const shopFits = (r) => { if (r.w < 8 || r.h < 6 || (r.shape && r.shape !== 'rect') || r.court) return false;
      for (let x = r.cx - 3; x <= r.cx + 3; x++) { if (Math.abs(x - r.cx) <= 2 && at(x, r.y - 1) !== 0) return false; for (let y = r.y; y <= r.y + 3; y++) if (isDoor(x, y)) return false; }
      return true; };
    // a rooms floor's start and stairs (TASKS 506): a leaf and a room at least WALK_FAR of the longest walk any leaf has to a room, not
    // the hops' farthest from any leaf: a leaf beside the room many hops off left one floor in four a short walk to the stairs; with no
    // leaf but nooks (a small map), any room starts
    const pairFar = !pl && !boss && !cave ? (() => { const main = rooms.filter((r) => !r.pocket && !r.isle && !narrow(r) && !r.court), pairs = [];
      for (const a of leaves.length ? leaves : main) { const d = new Int32Array(W * H).fill(-1), q = [a.cy * W + a.cx]; d[q[0]] = 0;
        for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && cells[n]) { d[n] = d[q[i]] + 1; q.push(n); } }
        for (const b of main) if (b !== a && d[b.cy * W + b.cx] > 0) pairs.push([a, b, d[b.cy * W + b.cx]]); }
      // (a pair that takes the only room the merchant fits leaves the floor no shop: another pair, if any is far enough)
      if (!pairs.length) return null; const top = Math.max(...pairs.map((p) => p[2])), good = pairs.filter((p) => p[2] >= top * WALK_FAR), shop = (p) => main.some((r) => r !== p[0] && r !== p[1] && shopFits(r));
      return pick(good.some(shop) ? good.filter(shop) : good); })() : null;
    const pathMin = pl ? TY.path[floor - 1] * (MIX ? AR.blend.pathKeep : 1) * (strict ? 1 : 0.9) : 0;
    if (far && far[2] < pathMin) return null;
    // (a rooms floor's last room may be a nook, TASKS 376: no start; a cave keeps its pocket start, TASKS 335)
    const start = far ? far[0] : pairFar ? pairFar[0] : (leaves.length ? pick(leaves) : rooms[cave ? rooms.length - 1 : main - 1]);
    const hop = hops(start);
    const exitR = far ? far[1] : boss ? rooms[0] : pairFar ? pairFar[1] : rooms.filter((r) => r !== start && !r.pocket && !narrow(r) && !r.court).sort((p, q2) => (hop[q2.id] - hop[p.id]) || (dist(q2, start) - dist(p, start)))[0];
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
    // in a cave the merchant's corner is squared off under a straight back wall, two cells of rock thick (the only straight wall
    // the cave keeps); the rest of his room stays a blob
    const caveShopAt = (r, cx) => !r.pocket && r.w >= 9 && r.y >= 6 && [-1, -2].every((d) => Array.from({ length: 9 }, (_, i) => cx - 4 + i).every((x) => at(x, r.y + d) === 0))
      && Array.from({ length: 9 }, (_, i) => cx - 4 + i).every((x) => [0, 1, 2, 3].every((j) => !isDoor(x, r.y + j)));
    // a plateau's ridges come in anywhere along its top edge now the plateaus stand close (TASKS 422): the corner slides along the
    // edge to where the rock above is whole, the room's middle moved under it
    const caveShop = (r) => { if (!pl) return caveShopAt(r, r.cx);
      for (let s = 0; s <= (r.w >> 1) - 5; s++) for (const cx of s ? [r.cx - s, r.cx + s] : [r.cx]) if (caveShopAt(r, cx)) { r.cx = cx; r.cy = r.y + 2; return true; } return false; };   // its middle on the corner's floor, which no lava takes
    // (the merchant keeps to the way: the rooms off it are the rewards')
    // in a run through the town (TASKS 1010) the merchant lives in the town and is met on a floor only by chance: then no room is
    // his, and the code that keeps clear of his corner keeps clear of a spot off the map
    const wander = !!opts.town && D.wanderAt(opts.runSeed || 0, runFloor), merchant = !opts.town || wander;
    const shopR = !merchant ? NO_SHOP : (plat ? [...others.filter((r) => way.has(r.id)), ...others.filter((r) => !way.has(r.id))] : others).find((r) => r.type === 'combat' && !r.isle && (cave ? caveShop(r) : shopFits(r)));
    if (!shopR) return null;
    if (merchant) shopR.type = 'shop'; if (pl) altar();
    const shopCorner = (x, y) => Math.abs(x - shopR.cx) <= 5 && y >= shopR.y - 2 && y <= shopR.y + 5;
    if (cave && merchant) { for (let y = shopR.y; y <= shopR.y + 4; y++) for (let x = shopR.cx - 4; x <= shopR.cx + 4; x++) set(x, y, 1); tidy(); breakRuns(shopCorner); }
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
    // a two-level hall (TASKS 375): the gallery its top rows (4–5), then a drop two cells high (deep water's cell: no walking, sight and
    // blows pass), the floor below; the steps down a gap two cells wide in the drop; the drop's rows are ones no corridor comes in
    // at from the side (it would end at the drop); a room with none, or another role, keeps its floor whole
    const ledges = [], tierDecor = [];
    if (!cave) for (const r of rooms) if (r.shape === 'tier') { const side = (y) => [r.x - 1, r.x + r.w].some((x) => at(x, y) === 1);
      const rows = [4, 5, 6].filter((t) => r.h - t - 2 >= 5 && !side(r.y + t) && !side(r.y + t + 1)), t = rows.length ? rows[Math.floor(R() * rows.length)] : 0;
      const mouthAt = (x) => [r.y - 1, r.y + r.h].some((y) => at(x, y) === 1 || at(x + 1, y) === 1);
      const gaps = []; for (let x = r.x + 2; x <= r.x + r.w - 4; x++) if (!mouthAt(x)) gaps.push(x);
      if (r.type !== 'combat' || r.zone || !t || !gaps.length) { r.shape = 'rect'; continue; }
      const sx = gaps[Math.floor(R() * gaps.length)], ly = r.y + t; r.tier = { y: ly, sx };
      for (let y = ly; y <= ly + 1; y++) for (let x = r.x; x < r.x + r.w; x++) if (x !== sx && x !== sx + 1) { set(x, y, 6); ledges.push(y * W + x); }
      // the railing: sections along the drop's top, the gap at the steps left open
      // (a section is three cells wide: a run shorter than one keeps its end flush with the steps and runs on into the side wall)
      for (const [a, b, toGap] of [[r.x, sx, 1], [sx + 2, r.x + r.w, 0]]) { const n = b - a, k = Math.max(1, Math.round(n / 3));
        for (let i = 0; i < k; i++) { const c = n < 3 ? (toGap ? b - 1.5 : a + 1.5) : a + (i + 0.5) * n / k; tierDecor.push({ x: Math.round(c * TILE), y: ly * TILE + 10, n: 'balustrade', r: r.id, rail: 1 }); } }
      tierDecor.push({ x: (sx + 1) * TILE, y: (ly + 2) * TILE + 2, n: 'stairs_tier', r: r.id, steps: 1 }); }
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
    const lavaRoom = (r) => (r.type === 'combat' || (r.type === 'treasure' && LY.room < 1)) && !r.zone && !r.pit && !r.tier && !r.court && !streams.some((q) => q.room === r.id);
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
    // the boss hall's wall stays rock two cells thick (TASKS 505): a river by it turned the one-cell wall to lava, a way out past its
    // sealed doors, and a river kept off the wall alone left a strip of masonry one cell thick
    const bossR = rooms.find((q) => q.type === 'boss'), arenaWall = (x, y) => !!bossR && inRm(bossR, x, y, 2) && !inRm(bossR, x, y);
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
          if (arenaWall(x, y)) { if (i < back) return undo(); break walk; }
          if (v === 3) continue;
          if (v === 1 || v === 6) { if (!q) continue; if (!CROSS.includes(q.type) || q.zone || q.pit || q.tier) { if (i < back) return undo(); break walk; } if (isDoor(x, y)) continue; crossed.add(q); was.push([x, y, 1]); }
          set(x, y, 3); cut.push([x, y]); } }
      if (!crossed.has(r)) return undo();
      // rock one cell thick between the stream and a floor would hang as a strip of masonry, and a floor and the stream meeting at a
      // cell's corner would pass blows: both become stream
      for (let pass = 0, n = 1; n && pass < 4; pass++) { n = 0;
        for (const [x0, y0] of cut.slice()) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = x0 + i, y = y0 + j;
          if (x < 2 || y < 3 || x > W - 3 || y > H - 3 || at(x, y) !== 0 || arenaWall(x, y)) continue;
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
    // (a fire floor of few rooms or small ones, TASKS 379's halls and maze, or now and then a plain one, may find no room for its second
    // river: laid anew)
    if (D.BIOMES[biome].lava && !(last && boss) && strict && LY && streams.filter((q) => q.kind === 'river' && q.n >= 8).length < 2) return null;
    // a fire floor without a river, and the boss's hall, get pools: a second pass that skips the roll
    if ((D.BIOMES[biome].lava && !lava.length) || bossType === 'boss') for (let pass = 0; pass < 2 && !lava.length; pass++) for (const r of rooms) {
      if (r.type !== 'start' && r.type !== 'shop' && r.type !== 'boss' && !r.pit && !r.tier && r.w >= 8 && r.h >= 6 && (pass || R() < (boss ? 1 : 0.75))) pool(r); }
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
    const stepHold = new Set(), thin = [], cliff = plat ? new Array(W).fill(0) : null, crust = [], lavaUnder = [], chasmUnder = new Set(), lavaFeatures = [], lavaBodies = [];
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
      if (terr) for (let x = terr.fx - Math.ceil(terr.fw / 2) - 2; x <= terr.fx + Math.ceil(terr.fw / 2) + 2; x++) if (x >= 0 && x < W) cliff[x] = AR.terrace.wall;
      // over a cache the wall comes down to the plateau it is dug from, two columns past it each side (TASKS 425)
      for (const q of secrets) { const r = rooms[q.room], hy = Math.max(...q.wall.map(([, y]) => y)) + 1, x0 = Math.min(r.x, ...q.wall.map(([x]) => x)) - 2, x1 = Math.max(r.x + r.w - 1, ...q.wall.map(([x]) => x)) + 2;
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) { let f = 0; while (f < H && !open(x, f)) f++; cliff[x] = Math.max(cliff[x], Math.min(f, hy)); } }
      // a cut one to three columns wide down the wall's face between two deeper stretches is filled: a black slot in the wall read as a
      // way in (the rock under it stays rock: the neighbours' depth is within AR.cliff, where nothing is open)
      for (const n of [1, 2, 3]) for (let x = 1; x + n < W; x++) { const lo = Math.min(cliff[x - 1], cliff[x + n]); let deep = true; for (let i = 0; i < n; i++) if (cliff[x + i] + 2 >= lo) deep = false;
        if (deep) for (let i = 0; i < n; i++) { let f = 0; while (f < H && !open(x + i, f)) f++; cliff[x + i] = Math.min(lo, f); } }
      const d = new Int8Array(W * H).fill(99), q = []; for (let k = 0; k < W * H; k++) if (open(k % W, Math.floor(k / W))) { d[k] = 0; q.push(k); }
      for (let i = 0; i < q.length; i++) { const k = q[i]; if (d[k] >= 30) continue; for (const o of D8) { const n = k + o; if (n >= 0 && n < W * H && Math.abs((n % W) - (k % W)) <= 1 && d[n] > d[k] + 1) { d[n] = d[k] + 1; q.push(n); } } }
      // a terrace floor's steps (TASKS 475): between two rows, over the columns where the upper one's floor, two to six cells of rock
      // and the lower one's floor follow down, the middle of the longest such stretch (TY.stepKeep of it, off a ridge's columns)
      // stays rock: there the upper row's face (scene.js) drops straight onto the lower row, a step rather than a strip over lava
      stepHold.clear();
      if (terr && !MIX) for (let i = 1; i < terr.rows.length; i++) { const up = terr.rows[i - 1].map((id) => rooms[id]), dn = terr.rows[i].map((id) => rooms[id]), g = 3;
        const near = (rs, x, y) => rs.some((r) => x >= r.x - g && x < r.x + r.w + g && y >= r.y - g && y < r.y + r.h + g), cols = [];
        for (let x = 2; x < W - 2; x++) { let yb = -1;
          for (let y = 3; y < H - 3; y++) { const f = cells[y * W + x] !== 0;
            if (f && near(up, x, y)) { yb = y; continue; }
            if (yb >= 0 && f) { const gap = y - yb - 1; if (gap >= 2 && gap <= 6 && near(dn, x, y)) cols.push([x, yb, y]); break; } } }
        let best = null, run = []; const flush = () => { if (run.length > (best ? best.length : 0)) best = run; run = []; };
        for (const c of cols) { if (run.length && c[0] !== run[run.length - 1][0] + 1) flush(); run.push(c); } flush();
        if (!best || best.length < 8) continue; const keep = Math.max(5, Math.round(best.length * TY.stepKeep)), s0 = (best.length - keep) >> 1;
        for (const [x, yb, yt] of best.slice(s0, s0 + keep)) for (let y = yb + 1; y < yt; y++) stepHold.add(y * W + x); }
      const held = (x, y) => y < cliff[x] + 1 || x < 2 || y < 3 || x > W - 3 || y > H - 3 || ring.has(y * W + x) || stepHold.has(y * W + x) || (Math.abs(x - shopR.cx) <= 5 && y >= shopR.y - 3 && y < shopR.y);
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
      const loneCross = () => { for (let i = crossings.length - 1; i >= 0; i--) { const c = crossings[i]; if (c.chasm || c.cells.some((k) => D4.some((o) => cells[k + o] === 3))) continue;
        const own = new Set(c.cells), to = crossings.find((e) => e !== c && e.kind !== 'bridge' && e.cells.some((k) => D4.some((o) => own.has(k + o))));
        if (to) to.cells.push(...c.cells); else for (const k of c.cells) if (!crossings.some((e) => e !== c && e.cells.includes(k))) under.delete(k); crossings.splice(i, 1); } };
      loneCross();
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
        // a chasm floor's way over has another (TASKS 1054: its bridges stood in series on 8 floors of 10, the one choice "wait or run"
        // under the rocks): the walk's longest bridge with no way round it gets a second straight deck over the dark from the
        // plateaus on its near side to those on its far side, at least `alt.off` cells off it, `alt.len` cells long
        if (ftype === 'chasm' && TY.alt) { const A = TY.alt, s0 = start.cy * W + start.cx, e0 = exitR.cy * W + exitR.cx;
          const walk = (ban) => { const from = new Int32Array(W * H).fill(-2), q = [s0]; from[s0] = -1;
            for (let i = 0; i < q.length && from[e0] === -2; i++) for (const o of D4) { const n = q[i] + o; if (from[n] === -2 && cells[n] === 1 && !ban.has(n)) { from[n] = q[i]; q.push(n); } }
            const out = []; if (from[e0] !== -2) for (let k = e0; k >= 0; k = from[k]) out.push(k); return out; };
          const way = new Set(walk(new Set())), lone = crossings.filter((c) => c.chasm && c.cells.some((k) => way.has(k)) && !walk(new Set(c.cells)).length).sort((a, b) => b.cells.length - a.cells.length);
          for (const B of lone) { const ban = new Set(B.cells), near = new Uint8Array(W * H), q = [s0]; near[s0] = 1;
            for (let i = 0; i < q.length; i++) for (const o of D4) { const n = q[i] + o; if (!near[n] && cells[n] === 1 && !ban.has(n)) { near[n] = 1; q.push(n); } }
            const dark = (x, y) => x > 1 && y > 1 && x < W - 2 && y < H - 2 && lowC(y * W + x), off = (x, y) => B.cells.every((k) => Math.max(Math.abs(k % W - x), Math.abs(Math.floor(k / W) - y)) >= A.off);
            let best = null;
            for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const hor = dx !== 0, px = hor ? 0 : 1, py = hor ? 1 : 0;
              if (!near[y * W + x] || !near[(y + py) * W + x + px] || hidden.has(y * W + x)) continue; const deck = []; let u = 1, ok = true;
              for (; u <= A.len[1]; u++) { const ax = x + dx * u, ay = y + dy * u, bx = ax + px, by = ay + py;
                if (cells[ay * W + ax] === 1 && cells[by * W + bx] === 1) break;
                if (!dark(ax, ay) || !dark(bx, by) || !dark(ax - px, ay - py) || !dark(bx + px, by + py) || !off(ax, ay) || !off(bx, by)) { ok = false; break; } deck.push(ay * W + ax, by * W + bx); }
              const ex = x + dx * u, ey = y + dy * u;
              if (!ok || u > A.len[1] || u - 1 < A.len[0] || near[ey * W + ex] || cells[ey * W + ex] !== 1 || cells[(ey + py) * W + ex + px] !== 1 || ban.has(ey * W + ex)) continue;
              if (!best || deck.length < best.deck.length) best = { deck, hor }; }
            // (TASKS 1158: 12 cells off the first, a straight shot exists on one floor in three; failing it two decks meet on a pad of rock out in the dark)
            let bent = null; const open = (x, y) => dark(x, y) && off(x, y);
            if (!best) for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const px = dx ? 0 : 1, py = dx ? 1 : 0;
              if (!near[y * W + x] || !near[(y + py) * W + x + px] || hidden.has(y * W + x)) continue; const leg = [];
              for (let u = 1; u <= A.len[1]; u++) { const ax = x + dx * u, ay = y + dy * u, side = (j) => open(ax + px * j, ay + py * j); if (!side(-1) || !side(0) || !side(1) || !side(2)) break; leg.push(ay * W + ax, (ay + py) * W + ax + px);
                if (u < 2) continue; const pad = []; let fit = true; for (let i = 1; i <= 4 && fit; i++) for (let j = -1; j <= 2; j++) { const qx = x + dx * (u + i) + px * j, qy = y + dy * (u + i) + py * j; if (!open(qx, qy)) { fit = false; break; } pad.push(qy * W + qx); }
                if (!fit) continue;
                for (const s of [1, -1]) { const leg2 = []; let v = 0, done = false; for (; v <= A.len[1]; v++) { const j = (s > 0 ? 3 : -2) + s * v, cx = x + dx * (u + 2) + px * j, cy = y + dy * (u + 2) + py * j, c2 = cy * W + cx, c3 = c2 + dy * W + dx;
                    if (cells[c2] === 1 && cells[c3] === 1) { done = v >= 2 && !near[c2] && !ban.has(c2); break; }
                    if (![-1, 0, 1, 2].every((w) => open(cx + dx * w, cy + dy * w))) break; leg2.push(c2, c3); }
                  if (done && (!bent || leg.length + leg2.length < bent.size)) bent = { size: leg.length + leg2.length, leg: leg.slice(), pad, leg2, hor: dx !== 0 }; } } }
            if (bent) { for (const k of bent.pad) cells[k] = 1; for (const k of [...bent.leg, ...bent.leg2]) { cells[k] = 1; chasmUnder.add(k); }
              crossings.push({ kind: 'bridge', cells: bent.leg, axis: bent.hor ? 'x' : 'y', clean: 1, chasm: 1, alt: 1, of: B.cells[0] }, { kind: 'bridge', cells: bent.leg2, axis: bent.hor ? 'y' : 'x', clean: 1, chasm: 1, alt: 1, of: B.cells[0] }); break; }
            if (!best) continue; for (const k of best.deck) { cells[k] = 1; chasmUnder.add(k); }
            crossings.push({ kind: 'bridge', cells: best.deck, axis: best.hor ? 'x' : 'y', clean: 1, chasm: 1, alt: 1, of: B.cells[0] }); break; }
          if (altTry && lone.length && !crossings.some((c) => c.alt)) return false; }   // (only the first tries: past them the floor's other rules are short of tries)
        // what a bridge left of its ridge off the way goes to the dark
        const sv = new Uint8Array(W * H), st = [start.cy * W + start.cx]; sv[st[0]] = 1;
        while (st.length) { const k = st.pop(); for (const o of D4) { const n = k + o; if (!sv[n] && (cells[n] === 1 || cells[n] === 4)) { sv[n] = 1; st.push(n); } } }
        for (let k = 0; k < W * H; k++) if (cells[k] === 1 && !sv[k] && !hidden.has(k)) cells[k] = 0;
        // and a cell of it left between the lava over and under it goes to lava (no strip of rock a cell thick)
        for (let k = W; k < W * (H - 1); k++) if (cells[k] === 0 && !held(k % W, Math.floor(k / W)) && cells[k - W] && cells[k + W] && (cells[k - W] === 3 || cells[k + W] === 3)) cells[k] = 3;
        // (a chain bridge's landing may take the last lava round a slab beside it, seed 4242's 14th of the campaign)
        loneCross(); }
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
      // a hoard's islet (TASKS 476, AR.lava.islet): out in the open lava, a strip of thin crust its only way; crossed at a walk it bears,
      // stood on it gives and the hero falls through (sim.js CRUST); a hoard's room with no pack (none could reach it)
      if (!boss && !chasmF && LV.islet) { const IS = LV.islet, Ip = mul32(seed ^ 0x476a), [pw, ph] = IS.pad, cr = new Set(crust);
        const openL = (x, y) => x > 2 && y > 2 && x < W - 3 && y < H - 3 && cells[y * W + x] === 3 && !under.has(y * W + x) && !cr.has(y * W + x) && !src.has(y * W + x) && !arena[y * W + x];
        const cand = []; for (let y = 4; y < H - pw - 4; y++) for (let x = 4; x < W - pw - 4; x++) { let ok = true;
          for (let j = -IS.ring; j < ph + IS.ring && ok; j++) for (let i = -IS.ring; i < pw + IS.ring; i++) if (!openL(x + i, y + j)) { ok = false; break; } if (ok) cand.push([x, y]); }
        for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(Ip() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
        let made = 0;
        for (const [x, y] of cand) { if (made >= IS.n) break;
          // (a strip out of the pad's middle two rows or columns, straight on till it meets a plateau's floor)
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const hor = dx !== 0, a0 = hor ? y + ((ph - 2) >> 1) : x + ((pw - 2) >> 1), strip = [];
            let u = hor ? (dx > 0 ? x + pw : x - 1) : (dy > 0 ? y + ph : y - 1), len = 0, land = false;
            for (; len <= IS.len[1]; len++, u += hor ? dx : dy) { const c2 = [0, 1].map((o) => (hor ? [u, a0 + o] : [a0 + o, u]));
              if (c2.every(([cx2, cy2]) => at(cx2, cy2) === 1 && !under.has(cy2 * W + cx2) && rooms.some((r) => !r.pocket && !r.isle && cx2 >= r.x - 2 && cx2 < r.x + r.w + 2 && cy2 >= r.y - 2 && cy2 < r.y + r.h + 2) && !rooms.some((r) => (r.type === 'start' || r.type === 'shop' || r.type === 'boss') && cx2 >= r.x && cx2 < r.x + r.w && cy2 >= r.y && cy2 < r.y + r.h))) { land = [1, 2].every((s) => c2.every(([cx2, cy2]) => { const qx = cx2 + (hor ? dx * s : 0), qy = cy2 + (hor ? 0 : dy * s); return at(qx, qy) === 1 && !cr.has(qy * W + qx); })) && c2.every(([cx2, cy2]) => !cr.has(cy2 * W + cx2)); break; }   // (TASKS 1161: where one waits out the rocks is firm floor, not the bank's crust)
              if (!c2.every(([cx2, cy2]) => openL(cx2, cy2))) break; strip.push(...c2.map(([cx2, cy2]) => cy2 * W + cx2)); }
            if (!land || len < IS.len[0]) continue;
            for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) cells[(y + j) * W + x + i] = 1;
            // (kept only if a body two cells wide walks to it over its crust from the start)
            const c2 = cells.slice(); for (const k of strip) c2[k] = 1;
            if (narrowTo(c2, W, H, start.cy * W + start.cx, [(y + (ph >> 1)) * W + x + (pw >> 1)]).length) { for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) cells[(y + j) * W + x + i] = 3; continue; }
            for (const k of strip) { crust.push(k); thin.push(k); }
            const shore = strip.slice(-2);   // (TASKS 1170: the bank's crust by the strip's foot is where one waits out the rocks, and it gives under a standing hero)
            for (let i = crust.length - 1; i >= 0; i--) { const k = crust[i]; if (!strip.includes(k) && shore.some((q) => Math.max(Math.abs(q % W - k % W), Math.abs(Math.floor(q / W) - Math.floor(k / W))) <= 2)) { crust.splice(i, 1); cr.delete(k); } }
            rooms.push({ x, y, w: pw, h: ph, cx: x + (pw >> 1), cy: y + (ph >> 1), type: 'treasure', id: rooms.length, islet: 1 }); made++; break; } } }
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
    // a bridge over lava on the way between rooms (TASKS 377): on a fire floor of rooms, a straight stretch of corridor two cells wide
    // with rock both sides crossed by a rift of lava 3–4 cells wide that runs 2–4 cells into the rock either side; the corridor
    // over it is a plank bridge (a crossing over lava, as the plateaus' are: floor, with the lava drawn under its deck)
    const deckUsed = [];
    if (LY && D.BIOMES[biome].lava && !(last && boss)) { const nb = ri(...(LY.bridges || [1, 2])), runs = [];
      const clear = (x, y) => at(x, y) === 1 && !rooms.some((q) => inRm(q, x, y, 2)), rock = (x, y) => at(x, y) === 0;
      for (const hor of [1, 0]) for (let v = 4; v < (hor ? H : W) - 5; v++) { let n = 0;
        for (let u = 3; u < (hor ? W : H) - 3; u++) { const c = (uu, vv) => (hor ? [uu, vv] : [vv, uu]);
          const ok = clear(...c(u, v)) && clear(...c(u, v + 1)) && rock(...c(u, v - 1)) && rock(...c(u, v + 2));
          n = ok ? n + 1 : 0; if (n >= 6) runs.push([hor, u - n + 1, v, n]); } }
      for (let i = runs.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [runs[i], runs[j]] = [runs[j], runs[i]]; }
      const took = [];
      for (const [hor, u0r, v, n] of runs) { if (took.length >= nb) break; const c = (uu, vv) => (hor ? [uu, vv] : [vv, uu]), s0 = ri(3, 4), u0 = u0r + ((n - s0) >> 1), u1 = u0 + s0 - 1;
        if (took.some(([h2, a, b]) => Math.abs(a - u0) < 12 && Math.abs(b - v) < 12)) continue;
        const rift = []; let fine = true;
        for (let u = u0; u <= u1; u++) for (const [side, base] of [[-1, v - 1], [1, v + 2]]) { const d = ri(2, 4); for (let k = 0; k < d; k++) { const [x, y] = c(u, base + side * k); if (at(x, y) !== 0 || arenaWall(x, y)) { if (k < 1) fine = false; break; } rift.push([x, y]); } }
        if (!fine) continue;
        for (const [x, y] of rift) { set(x, y, 3); lava.push([x, y]); flow[y * W + x] = hor ? 1 : 0; }
        // (rock one cell thick between the rift and a floor would hang as a strip of masonry: it becomes rift, as by a river)
        for (let pass = 0; pass < 2; pass++) for (const [x0, y0] of rift.slice()) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = x0 + i, y = y0 + j;
          if (at(x, y) === 0 && !arenaWall(x, y) && at(x, y - 1) && at(x, y + 1) && at(x, y - 1) !== 4 && at(x, y + 1) !== 4) { set(x, y, 3); lava.push([x, y]); flow[y * W + x] = hor ? 1 : 0; rift.push([x, y]); } }
        const deck = []; for (let u = u0; u <= u1; u++) for (const dv of [0, 1]) { const [x, y] = c(u, v + dv); deck.push(y * W + x); deckUsed.push([x, y]); }
        lavaUnder.push(...deck); const cr = { kind: 'bridge', cells: deck, axis: hor ? 'x' : 'y', clean: 1, lava: 1, span: [u0, u1, v], posts: [], rift: 1 };
        const lit = R() < 0.5 ? [] : [R() < 0.5 ? 0 : 1];
        for (const e of [0, 1]) for (const side of [0, 1]) { const a = e ? (u1 + 1) * TILE - 6 : u0 * TILE + 6, b = side ? (v + 2) * TILE + 2 : v * TILE + 4;
          cr.posts.push({ x: hor ? a : side ? (v + 2) * TILE + 4 : v * TILE - 4, y: hor ? b : a + (e ? 8 : 2), fire: lit.includes(e) ? 1 : 0, near: side }); }
        crossings.push(cr); took.push([hor, u0, v]); } }
    const secrets = [], onWater = new Set([...wet, ...crossings.flatMap((c) => c.cells)]);
    // the rock a fall pours down or a spring comes out of is no secret's
    const srcRock = new Set(waterFeatures.filter((q) => q.dir).flatMap((q) => { const b = { u: -W, d: W, l: -1, r: 1 }[q.dir]; return [q.cell + b, q.cell + 2 * b, q.cell + b - 1, q.cell + b + 1, q.cell + b - W, q.cell + b + W]; }));
    const secretsWanted = boss && R() < 0.06 ? 0 : Math.min(10, Math.max(1, Math.round((1 + Math.floor(Math.pow(R(), 1.8) * 10)) * (ST.secretK || 1))));
    { const want = secretsWanted, DIRS = [[0, -1, 'u'], [0, 1, 'd'], [-1, 0, 'l'], [1, 0, 'r']];
      const shopRoom = rooms.find((q) => q.type === 'shop') || NO_SHOP;
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
      const plain = (r) => !r.pit && !r.wings && !r.tier, candidates = rooms.filter((r) => r.type === 'combat' && plain(r) && !r.trap && !secrets.some((q) => q.front.some(([x, y]) => roomOf(x, y) === r)));
      for (let i = candidates.length - 1; i > 0; i--) { const j = wi(0, i); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
      let n = 0;
      for (const r of candidates.concat(rooms.filter((q) => q.type === 'combat' && plain(q) && !candidates.includes(q) && !secrets.some((s) => s.front.some(([x, y]) => roomOf(x, y) === q))))) {
        if (n >= 2 * (FM.water || 1)) continue;
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
    // the magma caves' halls (TASKS 434, data.js MAGMA_HALLS): the big plateaus off the way to the stairs, dead ends first, each a
    // kind its floor's roster has, no kind twice; their own stream, so the rest of the floor is laid out as before
    const HL = D.MAGMA_HALLS, circles = [];
    if (plat && !boss && HL) { const Hr = mul32(seed ^ 0x434a), have = D.rosterAt(biome, Math.min(ST.n, floor + ST.early)), rank = (r) => (way.has(r.id) ? 2 : 0) + (deadEnd(r) ? 0 : 1);
      const cand = rooms.filter((r) => r.type === 'combat' && !r.pocket && !r.isle && !r.branch && r.kind !== 'ledge' && r.kind !== 'ridge' && r.w * r.h >= HL.area);
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(Hr() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; } cand.sort((a, b) => rank(a) - rank(b));
      // (a kind marked `early` comes on the 1st floor before its monster does, with the floor's own pack, TASKS 488: the prison alone
      // could, and was there in 30 runs of 30)
      let n = HL.n[0] + (Hr() < HL.two ? 1 : 0); const kinds = Object.entries(HL.kinds).filter(([, K]) => have.includes(K.need) || (floor === 1 && K.early)), took = new Set();
      for (const r of cand) { if (n <= 0 || !kinds.length) break; const pk = kinds.filter(([k]) => !took.has(k) && !(HL.kinds[k].pay.bless && Math.max(Math.abs(r.cx - exitR.cx), Math.abs(r.cy - exitR.cy)) < HL.blessOff)); if (!pk.length) continue;
        let roll = Hr() * pk.reduce((a, [, K]) => a + K.w, 0), pick = pk[0][0]; for (const [k, K] of pk) if ((roll -= K.w) < 0) { pick = k; break; } r.hall = pick; took.add(pick); n--; } }
    Object.assign(GF, {
      HL, chasmUnder, circles, cliff, crossings, crust, deadEnd, deckUsed, doors, exitR, floodCells, flow, lakeWay, lava, lavaBodies,
      lavaFeatures, lavaUnder, ledges, locks, merchant, pathMin, pits, riverWay, roomOf, secrets, secretsWanted, serpentPools, shopR,
      start, stepHold, streams, thin, tierDecor, wander, water, waterBridges, waterFeatures, waterFlow, way, wet });
  };
})(typeof window !== 'undefined' ? window : globalThis);
