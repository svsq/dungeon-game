// live/sim_checks_gen.js — selfCheck's parts for the level generator: floors, floor types and modifiers, props, the generator's print. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    addFire, cell, crustAt, D, DG, DT, ENEMIES, enterFloor, flow, heroSt, hitEnemy, hitProps, inRoom1, inStart, K, newRun, onLava, openChest, rnd,
    secretMask, spawn, step, TILE, toPx, under, who } = SIMX;
  const { swing } = SIMX.checks.kit;
  // secrets, loot tables and completion stats, played through the sim
  // how each cache is opened, checked on the floor as laid: no way that needs a blow, every mechanism reached from the open floor (the outer floor, or the parent cache for one inside another)
  function cacheIssues(m, q, i, shut) { const out = [], W = m.W, reachC = (x, y) => shut[y * W + x] || (q.parent !== undefined && inRoom1(m.rooms[m.secrets[q.parent].room], x, y));
    if (!['banner', 'shelf', 'statue', 'lever', 'puzzle'].includes(q.kind) || q.hp !== undefined) out.push('has an old or missing kind');
    if (['banner', 'shelf', 'statue'].includes(q.kind) && q.dir !== 'u') out.push('is not on a top wall');
    if (q.kind === 'banner' && !m.decor.some((d) => d.secret === i && d.n === 'banner' && d.wall)) out.push('has no banner');
    if (q.kind === 'shelf' && (!m.decor.some((d) => d.secret === i && d.n === 'bookshelf' && d.solid) || q.slide)) out.push('has no bookshelf, or one that slides');
    if (q.kind === 'statue') { const d = m.decor.find((o) => o.secret === i && o.solid); if (!d || !q.slide || ![1, 2].includes(q.slide.n) || ![1, -1].includes(q.slide.s)) out.push('has no statue or slide');
      else { const fy = Math.floor(d.y / TILE), fc = Math.floor(q.x / TILE), tc = fc + q.slide.s * q.slide.n, tk = fy * W + tc, o0 = fy * W + fc, blk = new Set(m.block), flood = (b) => { const sv = new Set(), st = [Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE)]; sv.add(st[0]); while (st.length) { const k = st.pop(); for (const v of [1, -1, W, -W]) { const n = k + v; if (!sv.has(n) && m.cells[n] === 1 && !b.has(n)) { sv.add(n); st.push(n); } } } return sv; };
        for (let c = fc + q.slide.s; c !== tc + q.slide.s; c += q.slide.s) if (m.cells[fy * W + c] !== 1) out.push('slides into rock');
        const sA = flood(blk); blk.delete(o0); blk.add(tk); const sB = flood(blk); if (sB.size < sA.size) out.push('statue shuts a passage when moved'); } }
    if (q.kind !== 'lever' && q.trig) out.push('has a mechanism it should not');
    if (q.kind === 'lever') { const P = q.trig; if (!P) out.push('has no mechanism');
      else if (P.k === 'plate') { if (!reachC(P.cx, P.cy) || m.traps.some((t) => Math.abs(t.x / TILE - P.cx - 0.5) < 1.5 && Math.abs(t.y / TILE - P.cy - 0.5) < 1.5)) out.push('its flagstone is out of reach or on spikes'); }
      else if (P.k === 'sconce') { const t = m.torches[P.t]; if (!t || t.kind !== 'wall' || t.side || t.lever !== i || t.sec !== undefined) out.push('its sconce is missing or hidden'); }
      else if (P.k === 'lever') { const x = Math.floor(P.x / TILE), y = Math.floor((P.y + 48) / TILE); if (!reachC(x, y)) out.push('its lever is out of reach'); }
      else out.push('has an unknown mechanism'); }
    if (q.kind === 'puzzle') { const Z = q.pz, ns = (Z && Z.items || []).map((it) => it.n).sort(); if (!Z || ns.join() !== '1,2,3') out.push('has a broken puzzle');
      else for (const it of Z.items) { const x = Math.floor(it.x / TILE), y = Z.k === 'levers' ? Math.floor((it.y + 48) / TILE) : Math.floor(it.y / TILE); if (!reachC(x, y)) out.push(`a ${Z.k} piece is out of reach`); }
      if (Z && Z.k === 'candles' && m.decor.filter((d) => d.pz === i && d.n === 'candles').length !== 3) out.push('is missing its candles'); }
    return out; }
  // level data checks for tune.cjs: every floor of several seeds — spawns on open floor and outside the start room, exit reachable
  function genCheck() {
    const out = [];
    // the water caves' floors (TASKS 301) are held to the campaign's rules
    // (the campaign's 9th–12th are cave floors, TASKS 339: held to the caves' rules, kind 'cave')
    // (seed 7: its 3rd and 7th floors are tombs, TASKS 378)
    const GEN = [1, 77, 4242, 90001, 7].flatMap((sd) => Array.from({ length: D.RUNS.campaign.floors }, (_, i) => ['campaign', sd, i + 1]))
      .concat([1, 77, 4242, 90001, 5, 12, 33, 2024].flatMap((sd) => Array.from({ length: D.RUNS.cave.floors }, (_, i) => ['cave', sd, i + 1])))
      // the magma caves' plateaus (TASKS 400): held to the caves' rules but the water's, and to their own
      .concat([1, 77, 4242, 5, 12, 33].flatMap((sd) => Array.from({ length: D.RUNS.magma.floors }, (_, i) => ['magma', sd, i + 1])))
      // a 5×5 cave pocket for a start room with no clear spot by the fire: the hero arrived inside the rock (run seed 93, TASKS 335)
      .concat([['campaign', 101, 9]]);
    const caveKinds = {}, shapes = {};
    for (const [run, sd, f] of GEN) { const ST = D.stageOf(run, f), mode = ST.arch === 'cave' || ST.arch === 'plateau' ? 'cave' : 'campaign', plat = ST.arch === 'plateau', lf = ST.lf, seed = (run === 'campaign' ? '' : run + ' ') + sd, m = DG.genFloor(sd * 31 + f * 1013, f, { mode: run, ...(run === 'campaign' ? { runSeed: sd } : {}) });
      const F = flow(m, Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE));
      const reachH = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return cell(m, tx, ty) === 1; };
      if (!reachH(m.spawn.x, m.spawn.y)) out.push(`seed ${seed} f${f}: spawn blocked`);
      for (const e of m.enemies) { if (!reachH(e.x, e.y) && !(ENEMIES[e.type].deep && cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 6) && !((ENEMIES[e.type].kind === 'salamander' || ENEMIES[e.type].lake) && cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 3)) out.push(`seed ${seed} f${f}: ${e.type} spawns in rock`); if (inStart(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) out.push(`seed ${seed} f${f}: ${e.type} in the start room`); }
      for (const c of m.chests) if (!reachH(c.x, c.y)) out.push(`seed ${seed} f${f}: chest in rock`);
      // a boss hall is shut by its doors alone (TASKS 505): no floor or lava runs up to its box past them
      { const b = m.rooms.find((q) => q.type === 'boss'), dc = new Set(m.doors.filter((d) => d.arena).flatMap((d) => d.cells.map(([x, y]) => y * m.W + x)));
        if (b && !plat && ST.arch !== 'cave') for (const [a, bb, c, d] of DG.rectsOf(b)) for (let y = bb - 1; y <= bb + d; y++) for (let x = a - 1; x <= a + c; x++) {
          if (DG.inRm(b, x, y) || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => DG.inRm(b, x + u, y + v)) || dc.has(y * m.W + x)) continue; const v = cell(m, x, y); if (v === 1 || v === 3) { out.push(`seed ${seed} f${f}: the boss hall's wall is open at ${x},${y}`); break; } } }
      if (mode === 'campaign') {
        // the rooms' shapes (TASKS 374): a wing is floor joined to its room; a pit is deep cells inside its room's box with two cells
        // of floor round it (three at the top), nothing stands on it, and no stream runs through a shaped room
        // a floor's layout (TASKS 379): all four come up over the floors checked; a catacomb's chambers are one size on its grid
        if (m.lay) shapes['lay:' + m.lay] = 1;
        // a bridge over a rift of lava and a trapped corridor (TASKS 377): the deck is floor with lava under it and beside it; the plates
        // of a run go down one line three cells apart
        for (const c of m.crossings.filter((q) => q.rift)) { shapes.rift = 1; const lu = new Set(m.lavaUnder), hor = c.axis === 'x';
          if (c.cells.some((k) => m.cells[k] !== 1 || !lu.has(k))) out.push(`seed ${seed} f${f}: a rift bridge's deck is not floor over lava`);
          if (!c.cells.some((k) => [hor ? -m.W : -1, hor ? m.W : 1].some((o) => m.cells[k + o] === 3))) out.push(`seed ${seed} f${f}: a rift bridge with no lava beside it`); }
        const runs = {}; for (const t of m.traps) if (t.run !== undefined) (runs[t.run] = runs[t.run] || []).push(t);
        for (const ps of Object.values(runs)) { shapes.gauntlet = 1; const xs = new Set(ps.map((t) => t.x)), ys = new Set(ps.map((t) => t.y)), st = (xs.size > 1 ? [...xs] : [...ys]).sort((a, b) => a - b);
          if ((xs.size > 1) === (ys.size > 1) || ps.length < 2 || st.some((v, i) => i && v - st[i - 1] !== 3 * TILE)) out.push(`seed ${seed} f${f}: a trapped corridor's plates are not in a line three cells apart`); }
        // a fortress (TASKS 380): the court is reached by its gates only, the start and the stairs lie outside its ring, and it holds
        // the altar or an elite
        // a tomb (TASKS 378) has no corridor: a floor cell outside every room is a way through a wall, a room a cell or two off it
        // on two opposite sides (secret caches aside)
        if (m.lay === 'tomb') { const rm = (x, y) => DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) >= 0, hid = secretMask(m); let loose = 0;
          for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 1; x++) { const k = y * m.W + x; if (m.cells[k] !== 1 || rm(x, y) || hid.has(k) || m.secrets.some((q) => q.front.some(([fx, fy]) => fx === x && fy === y))) continue;
            const two = (dx, dy) => [1, 2].some((d) => rm(x + dx * d, y + dy * d)) && [1, 2].some((d) => rm(x - dx * d, y - dy * d));
            if (!two(1, 0) && !two(0, 1)) loose++; }
          if (loose) out.push(`seed ${seed} f${f}: a tomb with ${loose} cells of corridor`); }
        const ct = m.rooms.find((r) => r.court);
        if (ct) { const [x0, y0, x1, y1] = ct.ring, inRing = (o) => { const x = Math.floor(o.x / TILE), y = Math.floor(o.y / TILE); return x >= x0 && x <= x1 && y >= y0 && y <= y1; };
          const mouth = []; for (let y = ct.y - 1; y <= ct.y + ct.h; y++) for (let x = ct.x - 1; x <= ct.x + ct.w; x++) if (!DG.inRm(ct, x, y) && cell(m, x, y) === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => DG.inRm(ct, x + dx, y + dy))) mouth.push([x, y]);
          let ways = 0; const seen = new Set(); for (const q of mouth) { if (seen.has(q.join())) continue; ways++; const st = [q]; seen.add(q.join()); while (st.length) { const [x, y] = st.pop(); for (const o of mouth) if (!seen.has(o.join()) && Math.abs(o[0] - x) <= 1 && Math.abs(o[1] - y) <= 1) { seen.add(o.join()); st.push(o); } } }
          if (ways !== ct.gates.length) out.push(`seed ${seed} f${f}: the fortress's court has ${ways} ways in, not its ${ct.gates.length} gates`);
          if (inRing(m.spawn) || inRing(m.exit)) out.push(`seed ${seed} f${f}: the start or the stairs inside the fortress's ring`);
          if (ct.type !== 'shrine' && !m.enemies.some((e) => e.elite && e.room === ct.id)) out.push(`seed ${seed} f${f}: the fortress's court holds neither the altar nor an elite`); }
        if (m.lay === 'catacomb') { const ch = m.rooms.filter((r) => !r.pocket && r.type !== 'secret'), [cw, cH] = D.ARCH.catacomb.grid.cell, [sx, sy] = D.ARCH.catacomb.grid.step;
          if (ch.some((r) => r.w !== cw || r.h !== cH || (r.x - ch[0].x) % sx || (r.y - ch[0].y) % sy)) out.push(`seed ${seed} f${f}: a catacomb chamber off its grid or size`); }
        for (const r of m.rooms) { if (r.shape) shapes[r.shape + (r.pit ? '*' : '')] = 1;
          for (const [a, b, c, d] of r.wings || []) for (let y = b; y < b + d; y++) for (let x = a; x < a + c; x++) if (cell(m, x, y) !== 1 && cell(m, x, y) !== 3) out.push(`seed ${seed} f${f}: room ${r.id}'s wing is not floor at ${x},${y}`);
          if (r.pit) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const inner = x >= r.x + 2 && x < r.x + r.w - 2 && y >= r.y + 3 && y < r.y + r.h - 2;
            if (inner !== (cell(m, x, y) === 6)) { out.push(`seed ${seed} f${f}: pit room ${r.id} is not a pit ringed with floor at ${x},${y}`); break; } } }
        for (const k of m.pits) if (m.cells[k] !== 6) out.push(`seed ${seed} f${f}: a pit cell is not deep`);
        // a two-level hall (TASKS 375): its drop two rows of deep cells the room's width but the steps' gap, the gap floor, both levels
        // reached on foot from the spawn, a railing along the drop
        for (const r of m.rooms) if (r.tier) { const { y: ly, sx } = r.tier;
          for (let y = ly; y <= ly + 1; y++) for (let x = r.x; x < r.x + r.w; x++) if ((x === sx || x === sx + 1) !== (cell(m, x, y) === 1) || (x !== sx && x !== sx + 1 && cell(m, x, y) !== 6)) { out.push(`seed ${seed} f${f}: two-level room ${r.id}'s drop or steps broken at ${x},${y}`); y = 1e9; break; }
          if (!m.__walk) { const d = new Uint8Array(m.W * m.H), q = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; d[q[0]] = 1;
            for (let i = 0; i < q.length; i++) for (const o of [1, -1, m.W, -m.W]) { const n = q[i] + o; if (!d[n] && m.cells[n] === 1) { d[n] = 1; q.push(n); } } m.__walk = d; }
          const reach = (y) => { for (let x = r.x; x < r.x + r.w; x++) if (m.__walk[y * m.W + x]) return true; return false; };
          if (!reach(ly - 1) || !reach(ly + 2)) out.push(`seed ${seed} f${f}: a level of two-level room ${r.id} is out of reach`);
          if (!m.decor.some((d) => d.n === 'balustrade' && d.r === r.id) || !m.decor.some((d) => d.steps && d.r === r.id)) out.push(`seed ${seed} f${f}: two-level room ${r.id} without its railing or its steps`); }
        // a nook (TASKS 376) is a dead end: one way in, no wider than a corridor; and some corridor runs three cells wide
        for (const r of m.rooms) if (r.pocket) { const mouth = []; for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (!DG.inRm(r, x, y) && cell(m, x, y) === 1 && DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) < 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => DG.inRm(r, x + dx, y + dy))) mouth.push([x, y]);
          // (one way: the cells by its mouth meet each other within six cells of it without passing through it)
          const near = (x, y) => x >= r.x - 6 && x < r.x + r.w + 6 && y >= r.y - 6 && y < r.y + r.h + 6, got = new Set(mouth.length ? [mouth[0].join()] : []), st = mouth.slice(0, 1);
          while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (!got.has(X + ',' + Y) && near(X, Y) && !DG.inRm(r, X, Y) && cell(m, X, Y) === 1) { got.add(X + ',' + Y); st.push([X, Y]); } } }
          if (r.type === 'start' || r.type === 'exit' || !mouth.length || mouth.some((q) => !got.has(q.join())) || mouth.length > 6) out.push(`seed ${seed} f${f}: nook ${r.id} is no dead end (${r.type}, ${mouth.length} cells by it)`); }
        for (let k = m.W; k < m.cells.length - 2 * m.W && !shapes.wide; k++) if ([0, 1, 2].every((j) => [0, 1, 2].every((i) => m.cells[k + j * m.W + i] === 1 && DG.roomAt(m, ((k + i) % m.W + 0.5) * TILE, (Math.floor(k / m.W) + j + 0.5) * TILE) < 0))) shapes.wide = 1;
        for (const o of [...m.chests, ...m.pots, ...m.decor, ...m.torches.filter((q) => q.kind !== 'wall'), ...m.traps]) if (m.pits.includes(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE))) out.push(`seed ${seed} f${f}: a ${o.n || o.kind || 'thing'} in a pit`);
        for (const q of m.waterFeatures) if (m.rooms[q.room].wings || m.rooms[q.room].pit) out.push(`seed ${seed} f${f}: a stream through a shaped room`);
        const wet = new Set(m.water), bridge = new Set(m.waterBridges);
        for (const k of wet) if (m.cells[k] !== 1 || !Number.isInteger(m.waterFlow[k]) || m.waterFlow[k] < 0 || m.waterFlow[k] > 3) out.push(`seed ${seed} f${f}: water off floor or without flow`);
        for (const k of bridge) if (m.cells[k] !== 1 || wet.has(k) || m.block.includes(k)) out.push(`seed ${seed} f${f}: water crossing is wet or blocked`);
        for (const o of [...m.chests, ...m.pots, ...m.enemies, ...m.decor.filter((d) => d.solid), ...m.torches.filter((q) => q.kind !== 'wall')]) {
          if (wet.has(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE))) out.push(`seed ${seed} f${f}: post or prop in stream`);
        }
        for (const q of m.waterFeatures) {
          const r = m.rooms[q.room];
          if (['start', 'shop', 'secret', 'boss'].includes(r.type)) out.push(`seed ${seed} f${f}: water in protected room`);
          {
            const path = new Set(q.cells), seen = new Set([q.source]), todo = [q.source];
            for (let i = 0; i < todo.length; i++) for (const d of [-1, 1, -m.W, m.W]) if (path.has(todo[i] + d) && !seen.has(todo[i] + d)) { seen.add(todo[i] + d); todo.push(todo[i] + d); }
            if (!seen.has(q.drain) || seen.size !== path.size || !q.bridge.length || q.width < 1 || q.width > 3) out.push(`seed ${seed} f${f}: stream or crossing disconnected`);
            if (cell(m, Math.floor(q.x / TILE), r.y - 1) !== 0) out.push(`seed ${seed} f${f}: spring not attached to wall`);
          }
        }
      }
      // the cave's water (TASKS 302): deep water (6) never meets dry floor, every deep pool has shallows on its shore, every floor
      // cell is reached on foot over shallows and crossings, the water keeps its share of the floor (secret caches left out), nothing
      // stands in it, a crossing lies over deep water, and every source is on a wall over its water
      if (mode === 'cave') { const W = m.W, wet = new Set(m.water), over = new Set(m.crossings.flatMap((c) => (c.kind === 'neck' ? [] : c.cells))), hid = new Set(m.secrets.flatMap((q) => q.hide));
        for (const r of m.rooms) if (r.type === 'secret') for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) hid.add(y * W + x);
        const D8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1], dry = (k) => m.cells[k] === 1 && !wet.has(k) && !over.has(k), deepAt = (k) => m.cells[k] === 6;
        let open = 0, nDeep = 0, bad = 0; const seenD = new Uint8Array(W * m.H);
        for (let k = 0; k < W * m.H; k++) { const c = m.cells[k]; if ((c === 1 || c === 6) && !hid.has(k)) open++; if (c !== 6) continue; nDeep++;
          if (D8.some((d) => dry(k + d)) && !bad++) out.push(`seed ${seed} f${f}: deep water on dry floor at ${k % W},${Math.floor(k / W)}`);
          if (seenD[k]) continue; const st = [k]; seenD[k] = 1; let shore = false;
          while (st.length) { const j = st.pop(); for (const d of D8) { const n = j + d; if (deepAt(n) && !seenD[n]) { seenD[n] = 1; st.push(n); } else if (wet.has(n)) shore = true; } }
          if (!shore) out.push(`seed ${seed} f${f}: deep water at ${k % W},${Math.floor(k / W)} without a shore of shallows`); }
        const share = (m.water.length + nDeep + over.size) / open;
        if (!plat && (share < 0.15 || share > 0.35)) out.push(`seed ${seed} f${f}: water is ${Math.round(share * 100)} % of the floor`);
        { const seen = new Uint8Array(W * m.H), s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), st = [s0]; seen[s0] = 1;
          // (a hoard's islet, TASKS 476, is reached over its thin crust only)
          const thinS = new Set(m.thin || []); while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && (m.cells[n] === 1 || m.cells[n] === 4 || thinS.has(n))) { seen[n] = 1; st.push(n); } } }
          const cut = m.cells.findIndex((c, k) => c === 1 && !seen[k]); if (cut >= 0) out.push(`seed ${seed} f${f}: floor at ${cut % W},${Math.floor(cut / W)} cut off by water`);
          for (const r of m.rooms) if (!seen[r.cy * W + r.cx] && m.cells[r.cy * W + r.cx] === 1) out.push(`seed ${seed} f${f}: the ${r.type} hall ${r.id} cut off by water`); }
        const inW = (k) => wet.has(k) || over.has(k) || deepAt(k), cellOf = (o) => Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE);
        // a drowned lies in the shallows (TASKS 307), off the crossings; every other monster stands dry
        for (const o of m.enemies) if (ENEMIES[o.type].lurk && (!wet.has(cellOf(o)) || over.has(cellOf(o)) || deepAt(cellOf(o)))) out.push(`seed ${seed} f${f}: a drowned out of the shallows at ${Math.round(o.x)},${Math.round(o.y)}`);
        // an eel (TASKS 310) has its post in deep water
        for (const o of m.enemies) if (ENEMIES[o.type].deep && m.cells[cellOf(o)] !== 6) out.push(`seed ${seed} f${f}: an eel out of the deep water at ${Math.round(o.x)},${Math.round(o.y)}`);
        for (const [n, list] of [['monster', m.enemies.filter((o) => !ENEMIES[o.type].lurk && !ENEMIES[o.type].deep)], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((d) => !d.wall && !d.lift)], ['fire', m.torches.filter((q) => q.kind !== 'wall')], ['altar', m.shrines], ['web', m.webs], ['ambush', m.ambush]])
          for (const o of list) if (inW(cellOf(o))) out.push(`seed ${seed} f${f}: a ${n} in the water at ${Math.round(o.x)},${Math.round(o.y)}`);
        for (const tr of m.traps) for (const [i, j] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (inW((tr.y / TILE + j) * W + tr.x / TILE + i)) out.push(`seed ${seed} f${f}: a spike plate in the water`);
        for (const c of m.crossings) { if (c.lava || c.chasm) continue; caveKinds[c.kind] = (caveKinds[c.kind] || 0) + 1;
          if (c.cells.some((k) => m.cells[k] !== 1 || (c.kind !== 'neck' && wet.has(k)))) out.push(`seed ${seed} f${f}: a ${c.kind} off the floor or wading`);
          if (c.kind !== 'neck' && !c.cells.some((k) => [1, -1, W, -W].some((d) => deepAt(k + d)))) out.push(`seed ${seed} f${f}: a ${c.kind} over no deep water`); }
        for (const q of m.waterFeatures) { caveKinds[q.kind] = (caveKinds[q.kind] || 0) + 1; const back = { u: -W, d: W, l: -1, r: 1 }[q.dir];
          if (!['waterfall', 'breach', 'spring'].includes(q.kind) || !(wet.has(q.cell) || deepAt(q.cell) || over.has(q.cell)) || m.cells[q.cell + back] !== 0) out.push(`seed ${seed} f${f}: a ${q.kind} off its wall or its water`); }
        for (const k in m.waterFlow) if (!(wet.has(+k) || deepAt(+k)) || !(m.waterFlow[k] >= 0 && m.waterFlow[k] <= 3)) out.push(`seed ${seed} f${f}: a stream's flow off its water`);
        // the cave's dressing (TASKS 306): no solid prop cuts a way, lilies and weed grow in the water, moss hangs from a rock face
        { const blocked = new Set(m.block.concat(m.pots.map(cellOf))), seen = new Uint8Array(W * m.H), s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), st = [s0]; seen[s0] = 1;
          const thinS = new Set(m.thin || []); while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && (m.cells[n] === 1 || m.cells[n] === 4 || thinS.has(n)) && !blocked.has(n)) { seen[n] = 1; st.push(n); } } }
          // the space behind the merchant's counter is closed on purpose (the shop is one built piece)
          const sh = m.rooms.find((r) => r.type === 'shop'), inShop = (k) => sh && k % W >= sh.x && k % W < sh.x + sh.w && Math.floor(k / W) >= sh.y && Math.floor(k / W) < sh.y + sh.h;
          const cut = m.cells.findIndex((c, k) => c === 1 && !seen[k] && !blocked.has(k) && !inShop(k) && !hid.has(k)); if (cut >= 0) out.push(`seed ${seed} f${f}: floor at ${cut % W},${Math.floor(cut / W)} cut off by the props`); }
        for (const o of m.flora) { const k = cellOf(o), up = Math.floor(o.y / TILE - 1) * W + Math.floor(o.x / TILE);
          if (o.n === 'moss' ? m.cells[up] !== 0 : !inW(k)) out.push(`seed ${seed} f${f}: ${o.n} off its ${o.n === 'moss' ? 'rock face' : 'water'} at ${Math.round(o.x)},${Math.round(o.y)}`); } }
      // the fire depths (TASKS 186): two rivers at least, and nothing stands in lava or a cell from its shore (but the plateaus' chain
      // fences, railings on the very edge that block and hide nothing: TASKS 405)
      if (D.BIOMES[m.biome].lava && !(ST.last && ST.boss) && (m.streams || []).filter((q) => q.kind === 'river' && q.n >= 8).length < 2) out.push(`seed ${seed} f${f}: fewer than two lava rivers`);
      { const shore = (o) => { const tx = Math.floor(o.x / TILE), ty = Math.floor((o.y - 1) / TILE); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, tx + i, ty + j) === 3) return true; return false; };
        for (const [k, list] of [['monster', m.enemies.filter((e) => (!ENEMIES[e.type].lava || ENEMIES[e.type].kind !== 'salamander') && !ENEMIES[e.type].lake)], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((d) => !d.wall && !d.lift && d.n !== 'fence_mg')], ['brazier', m.torches.filter((t) => t.kind !== 'wall')]]) for (const o of list) if (shore(o)) out.push(`seed ${seed} f${f}: a ${k} by lava at ${Math.round(o.x)},${Math.round(o.y)}`); }
      // a secret's fake wall counts as broken: rock one cell thick between two floors would hang in the floor as a bare wall face (TASKS 178)
      for (let y = 1; y < m.H - 1; y++) for (let x = 0; x < m.W; x++) if (!cell(m, x, y) && cell(m, x, y - 1) && cell(m, x, y + 1)) out.push(`seed ${seed} f${f}: one-cell wall between floors at ${x},${y}`);
      // bulky props (chests, tables, coffins, statues…) read wider than their cell: two of them never share a cell edge or corner
      { const big = m.chests.map((c) => [c.x, c.y, 'chest']).concat(m.decor.filter((d) => (d.solid || d.n === 'table') && !d.wall).map((d) => [d.x, d.y, d.n]), m.torches.filter((t) => t.kind === 'brazier').map((t) => [t.x, t.y, 'brazier']), m.shrines.map((t) => [t.x, t.y, 'altar']),
          m.pots.map((p) => [p.x, p.y, p.kind, p.stack]));
        // the shop is one built piece: its shelves, sacks and barrel close the space behind the counter on purpose. Elsewhere no two
        // props draw over each other: in the same row or the next one, their drawn widths (PROP_W) never meet
        const w2 = (n) => (D.PROP_W[n] || 0) / 2;
        for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) { const [ax, ay, an, as] = big[i], [bx, by, bn, bs] = big[j]; if (an.startsWith('shop_') || bn.startsWith('shop_') || (as && as === bs)) continue;   // a corner stack of barrels and crates is one pile
          if (Math.abs(Math.floor(ay / TILE) - Math.floor(by / TILE)) <= 1 && Math.abs(ax - bx) < w2(an) + w2(bn) + 4) out.push(`seed ${seed} f${f}: ${an} draws over ${bn} at ${Math.round(ax)},${Math.round(ay)}`); }
        for (const d of m.decor) if (d.n === 'bookshelf' && d.r !== undefined) { const cy = Math.floor(d.y / TILE) - 1, c0 = Math.floor((d.x - 51) / TILE), c1 = Math.floor((d.x + 51) / TILE); for (let cx = c0; cx <= c1; cx++) if (m.cells[cy * m.W + cx] !== 0) out.push(`seed ${seed} f${f}: a bookshelf sticks into the passage at ${cx},${cy}`); }
        // nothing hung on a top wall (torch, sconce, banner, sign) hides behind a tall prop standing against that wall
        const hung = m.torches.filter((t) => t.kind === 'wall' && !t.side).map((t) => [t.x, Math.round((t.y + 26) / TILE), 14, t.lever !== undefined ? 'sconce' : 'torch'])
          .concat(m.decor.filter((d) => d.n === 'banner' || d.n === 'shop_sign').map((d) => [d.x, Math.round((d.y + (d.n === 'banner' ? 2 : 34)) / TILE), d.n === 'banner' ? 18 : 22, d.n]));
        for (const d of m.decor) { if (!d.solid || (d.y - 22) % TILE) continue; const ry = (d.y - 22) / TILE;
          for (const [hx, hy, hw, hn] of hung) if (hy === ry && Math.abs(hx - d.x) < hw + (D.PROP_W[d.n] || 53) / 2) out.push(`seed ${seed} f${f}: ${d.n} hides a ${hn} on the wall at ${Math.round(hx)},${hy * TILE}`); }
        for (const p of m.pots) { const r = m.rooms[DG.roomAt(m, p.x, p.y)] || {}; if (p.kind === 'gold' && r.type !== 'secret' && !r.locked) out.push(`seed ${seed} f${f}: a heap of gold outside a secret or locked room`); }
        for (const r of m.rooms) { const n = m.chests.filter((c) => DG.roomAt(m, c.x, c.y) === r.id).length; if (n > Math.min(2, 1 + Math.floor(r.w * r.h / 30))) out.push(`seed ${seed} f${f}: ${n} chests in a ${r.w}×${r.h} room`); } }
      // a cobweb hangs on the back wall's upper face in a room's top corner, its spun corner at the wall's top edge against the side wall (mirrored on the right)
      for (const d of m.decals) if (d.n === 'dc_web') { const w = 40 * d.s, cx = d.f ? d.x + w / 2 : d.x - w / 2, tx = Math.round(cx / TILE) - (d.f ? 1 : 0), ty = Math.round((d.y - w / 2 - 4) / TILE) + 2, ox = d.f ? -1 : 1, sx = d.f ? 1 : -1;
        if (cell(m, tx, ty) !== 1 || cell(m, tx + sx, ty) !== 0 || [0, ox].some((o) => cell(m, tx + o, ty - 1) !== 0 || cell(m, tx + o, ty - 2) !== 0) || Math.abs(cx - Math.round(cx / TILE) * TILE) > 1 || Math.abs(d.y - w / 2 - 4 - (ty - 2) * TILE) > 1) out.push(`seed ${seed} f${f}: a cobweb away from a corner at ${Math.round(d.x)},${Math.round(d.y)}`); }
      // a floor decal's drawn square (40·s px) lies on open floor: nothing climbs a wall (the corner cobwebs hang there on purpose)
      for (const d of m.decals) { if (d.n === 'dc_web') continue; const h = 20 * d.s;
        for (const [px, py] of [[d.x - h, d.y - h], [d.x + h - 0.01, d.y - h], [d.x - h, d.y + h - 0.01], [d.x + h - 0.01, d.y + h - 0.01]]) if (cell(m, Math.floor(px / TILE), Math.floor(py / TILE)) !== 1) { out.push(`seed ${seed} f${f}: decal ${d.n} on a wall at ${Math.round(d.x)},${Math.round(d.y)}`); break; } }
      // decor never wears an interactive object's sprite: a dead altar or chest reads as one already used
      for (const d of m.decor) if (['altar', 'chest', 'chest_open', 'pot', 'stairs', 'treasure'].includes(d.n)) out.push(`seed ${seed} f${f}: decor uses the ${d.n} sprite`);
      // spike plates (2×2 cells) keep clear of corridor mouths and never wall off floor: walking around every plate reaches
      // everything walking over them would
      // webs lie on the floor of a room spiders keep; ambush plates are gone (TASKS 320)
      for (const w of m.webs) { const ri = DG.roomAt(m, w.x, w.y); if (ri < 0 || !m.enemies.some((e) => e.room === ri && e.type === 'spider') || cell(m, Math.floor(w.x / TILE), Math.floor(w.y / TILE)) !== 1) out.push(`seed ${seed} f${f}: a web off a spiders' room`); }
      for (const P of m.ambush) { const r = m.rooms[P.room], k = P.cy * m.W + P.cx;
        if (!r || !(r.type === 'combat' || r.type === 'exit' || r.locked) || cell(m, P.cx, P.cy) !== 1 || m.block.includes(k) || DG.roomAt(m, P.x, P.y) !== P.room) out.push(`seed ${seed} f${f}: an ambush off a fighting room's open floor`);
        if (m.traps.some((t) => Math.abs(t.x / TILE - P.cx - 0.5) < 1.5 && Math.abs(t.y / TILE - P.cy - 0.5) < 1.5)) out.push(`seed ${seed} f${f}: an ambush on a spike plate`); }
      // a corridor's plate (TASKS 76) fills a straight two-cell stretch with rock both sides, three cells and more from any room or door
      // (a trapped corridor's plates, TASKS 377, a cell off a room and two off a door)
      { const roomNear = (x, y, pad) => m.rooms.some((q) => DG.inRm(q, x, y, pad));
        for (const tr of m.traps) { if (!tr.cor) continue; const x0 = tr.x / TILE - 1, y0 = tr.y / TILE - 1, cs = [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]], pr = tr.run !== undefined ? 1 : 3, pd = tr.run !== undefined ? 2 : 3;
          if (cs.some(([x, y]) => cell(m, x, y) !== 1 || roomNear(x, y, pr) || m.doors.some((d) => d.cells.some(([dx, dy]) => Math.abs(dx - x) <= pd && Math.abs(dy - y) <= pd)))) out.push(`seed ${seed} f${f}: corridor spike plate near a room or a door`);
          const runX = [0, 1].every((i) => cell(m, x0 + i, y0 - 1) === 0 && cell(m, x0 + i, y0 + 2) === 0), runY = [0, 1].every((j) => cell(m, x0 - 1, y0 + j) === 0 && cell(m, x0 + 2, y0 + j) === 0);
          if (!runX && !runY) out.push(`seed ${seed} f${f}: corridor spike plate off a straight stretch`); } }
      { const tc = new Set(); for (const tr of m.traps) if (!tr.cor) for (let j = -1; j <= 0; j++) for (let i = -1; i <= 0; i++) tc.add((Math.floor(tr.y / TILE) + j) * m.W + Math.floor(tr.x / TILE) + i);
        const inR = (x, y) => m.rooms.some((q) => DG.inRm(q, x, y));
        for (const k of tc) { const x = k % m.W, y = Math.floor(k / m.W); if (cell(m, x, y) !== 1) out.push(`seed ${seed} f${f}: spike plate off the floor`);
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, x + i, y + j) === 1 && !inR(x + i, y + j)) out.push(`seed ${seed} f${f}: spike plate at a corridor mouth`); }
        const fill = (skip) => { const seen = new Uint8Array(m.W * m.H), st = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; seen[st[0]] = 1;
          while (st.length) { const k = st.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!seen[n] && cell(m, n % m.W, Math.floor(n / m.W)) === 1 && !m.block.includes(n) && !skip.has(n)) { seen[n] = 1; st.push(n); } } } return seen; };
        for (const e of m.enemies) if (tc.has(Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE))) out.push(`seed ${seed} f${f}: ${e.type} posted on a spike plate`);
        for (const p of m.chests.concat(m.torches.filter((t) => t.kind === 'brazier'), m.shrines, m.decor.filter((d) => (d.solid || d.n === 'table') && !d.wall))) {
          const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE); let hit = false;
          for (let j = -1; j <= 1 && !hit; j++) for (let i = -1; i <= 1; i++) if (tc.has((y + j) * m.W + x + i)) hit = true;
          if (hit) out.push(`seed ${seed} f${f}: ${p.n || p.kind || 'chest'} right beside a spike plate at ${p.x},${p.y}`); }
        const a = fill(new Set()), b = fill(tc); for (let k = 0; k < a.length; k++) if (a[k] && !b[k] && !tc.has(k)) { out.push(`seed ${seed} f${f}: spike plates cut off floor`); break; } }
      const ex = DG.genFloor; void ex; void F;
      // exit reachable from the spawn over floor
      const seen = new Uint8Array(m.W * m.H), st = [[Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE)]]; let ok = false;
      while (st.length) { const [x, y] = st.pop(); if (x === m.exit.tx && y === m.exit.ty) { ok = true; break; }
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (cell(m, nx, ny) === 1 && !seen[ny * m.W + nx]) { seen[ny * m.W + nx] = 1; st.push([nx, ny]); } } }
      if (!ok) out.push(`seed ${seed} f${f}: exit unreachable`);
      // a cave (TASKS 301): its floor's size, no doors and no masonry streams, pockets that lead nowhere, and no straight stretch of
      // wall over four cells but the merchant's back wall and the secret caches
      if (mode === 'cave') { const [w0, h0] = ST.size || ST.N.size[lf - 1], sh = m.rooms.find((r) => r.type === 'shop'), hid = new Set(m.secrets.flatMap((q) => q.hide));
        if (m.W !== w0 || m.H !== h0) out.push(`seed ${seed} f${f}: the cave is ${m.W}×${m.H}, not ${w0}×${h0}`);
        if (m.doors.some((d) => !d.arena)) out.push(`seed ${seed} f${f}: non-arena doors in the cave`);
        for (const r of m.rooms) if (r.pocket && m.edges.filter((e) => e.includes(r.id)).length !== 1) out.push(`seed ${seed} f${f}: pocket ${r.id} is not a dead end`);
        const chU = new Set(m.chasmUnder || []), skip = (x, y) => (Math.abs(x - sh.cx) <= 5 && y >= sh.y - 2 && y <= sh.y + 5) || hid.has(y * m.W + x) || chU.has(y * m.W + x) || m.rooms.some((r) => r.type === 'secret' && x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
        for (const q of DG.straightRuns(m.cells, m.W, m.H, skip)) out.push(`seed ${seed} f${f}: a straight cave wall ${q.n} cells long at ${q.x},${q.y}`); }
      // the plateaus (TASKS 400): a body two cells wide walks from the spawn to every plateau and ledge (a ridge never narrows to one
      // cell), the walk to the stairs is held to ARCH.plateau.path, the rock wall stands at the top only and no lava lies in it, and
      // the floor has lava
      if (plat) { const W = m.W, A = D.ARCH.plateau, s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE);
        // (a lava cave, TASKS 431, is the water caves' layout: its tunnels may narrow, its rock is all wall)
        const thinC = m.cells.slice(); for (const k of m.thin || []) thinC[k] = 1;   // (an islet's thin crust is its way, TASKS 476)
        const lc = m.ftype === 'cave', lost = lc ? [] : DG.narrowTo(thinC, W, m.H, s0, m.rooms.filter((r) => r.type !== 'secret').map((r) => r.cy * W + r.cx));
        for (const k of lost) out.push(`seed ${seed} f${f}: plateau or ledge at ${k % W},${Math.floor(k / W)} out of reach of a body two cells wide`);
        const d = new Int32Array(W * m.H).fill(-1), q = [s0]; d[s0] = 0;
        for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && m.cells[n] === 1) { d[n] = d[q[i]] + 1; q.push(n); } }
        const pth = (((m.ftype && A[m.ftype]) || A).path || A.path).map((q) => q * (m.ftype2 ? A.blend.pathKeep : 1)), walk = d[m.exit.ty * W + m.exit.tx]; if (walk !== m.walk || walk < pth[lf - 1] * (m.loose ? 0.9 : 1)) out.push(`seed ${seed} f${f}: the walk to the stairs is ${walk} cells (${m.walk} counted, ${pth[lf - 1]} at least)`);
        if (!m.cliff || m.cliff.length !== W) out.push(`seed ${seed} f${f}: a plateau floor without its wall rows`);
        else if (!lc) for (let x = 0; x < W; x++) for (let y = 0; y < m.cliff[x]; y++) if (m.cells[y * W + x] === 3) { out.push(`seed ${seed} f${f}: lava in the wall at ${x},${y}`); x = W; break; }
        if (!m.lava) out.push(`seed ${seed} f${f}: a plateau floor without lava`);
        // a cache hides in the top wall (TASKS 425): its room and passage in the wall's rows, the wall over it on each side, never a
        // block of dark in the lava
        for (const [i, q] of m.secrets.entries()) { const r = m.rooms[q.room], ks = q.hide.slice(); for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) ks.push(y * W + x);
          if (ks.some((k) => Math.floor(k / W) >= m.cliff[k % W])) out.push(`seed ${seed} f${f}: secret ${i} is not in the top wall`); }
        // the lava (TASKS 401): its share of floor and lava in AR.lava.share, lakes and sources, every crossing a walk over lava, the crust
        // on lava by the floor and no way shorter over it, and nothing stands in the lava, on the crust or a cell from either
        const L = A.lava, under = new Set(m.lavaUnder), crustS = new Set(m.crust), fl = m.cells.filter((c) => c === 1).length, share = m.lava / (fl + m.lava);
        const sh = m.shareOf || L.share;
        if (share < sh[0] || share > sh[1]) out.push(`seed ${seed} f${f}: lava is ${Math.round(share * 100)} % of floor and lava (${m.ftype})`);
        if (!m.lavaBodies.some((b) => b.kind === 'lake') || !m.lavaFeatures.length) out.push(`seed ${seed} f${f}: no lake or no source of lava`);
        for (const q of m.lavaFeatures) if (m.cells[q.cell] !== 3) out.push(`seed ${seed} f${f}: a lava ${q.kind} off its lava`);
        // (a chain bridge over the chasm, TASKS 429: on floor walked over the dark, the dark beside it, never over lava)
        const chU = new Set(m.chasmUnder || []);
        for (const c of m.crossings) if (c.chasm ? c.kind !== 'bridge' || c.cells.some((k) => m.cells[k] !== 1 || !chU.has(k) || under.has(k)) || !c.cells.some((k) => [1, -1, W, -W].some((o) => m.cells[k + o] === 0)) : !c.lava || c.cells.some((k) => m.cells[k] !== 1 || !under.has(k)) || !c.cells.some((k) => [1, -1, W, -W].some((o) => m.cells[k + o] === 3))) out.push(`seed ${seed} f${f}: a ${c.kind} that is no crossing over ${c.chasm ? 'the chasm' : 'lava'}`);
        for (const k of crustS) if (m.cells[k] !== 3 || (![1, -1, W, -W].some((o) => m.cells[k + o] === 1) && !(m.thin || []).includes(k))) out.push(`seed ${seed} f${f}: crust off a bank at ${k % W},${Math.floor(k / W)}`);
        // a hoard's islet (TASKS 476): its chest on it, no monster on it, out of reach but over its thin crust
        for (const r of m.rooms.filter((q) => q.islet)) { const inR = (o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= r.y * TILE && o.y < (r.y + r.h) * TILE, thinS = new Set(m.thin || []);
          const walk = (u) => { const d = new Uint8Array(W * m.H), q = [s0]; d[s0] = 1; for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const k = q[i] + o; if (!d[k] && (m.cells[k] === 1 || (u && thinS.has(k)))) { d[k] = 1; q.push(k); } } return d[r.cy * W + r.cx]; };
          if (!m.chests.some(inR)) out.push(`seed ${seed} f${f}: an islet without its hoard`); if (m.enemies.some((e) => e.room === r.id || inR(e))) out.push(`seed ${seed} f${f}: a monster on an islet`);
          if (walk(false) || !walk(true)) out.push(`seed ${seed} f${f}: an islet reached otherwise than over its thin crust`); }
        // (the floor round each crust cell joins up on foot within a few steps: a crust cell never takes anyone over the lava; an islet's
        // thin crust, TASKS 476, is its one way on purpose)
        const thinK = new Set(m.thin || []);
        for (const k of crustS) { if (thinK.has(k)) continue; const fl8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].map((o) => k + o).filter((n) => m.cells[n] === 1); if (fl8.length < 2) continue;
          const dl = new Map([[fl8[0], 0]]), ql = [fl8[0]]; for (let i = 0; i < ql.length; i++) { const c = ql[i]; if (dl.get(c) >= 6) continue; for (const o of [1, -1, W, -W]) { const n = c + o; if (!dl.has(n) && m.cells[n] === 1) { dl.set(n, dl.get(c) + 1); ql.push(n); } } }
          if (fl8.some((n) => !dl.has(n))) { out.push(`seed ${seed} f${f}: the crust is a short cut at ${k % W},${Math.floor(k / W)}`); break; } }
        const hot = new Set(); for (let k = 0; k < W * m.H; k++) if (m.cells[k] === 3) for (const o of [0, 1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) hot.add(k + o);
        const onHot = (o) => hot.has(Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE));
        for (const [n, list] of [['monster', m.enemies.filter((e) => ENEMIES[e.type].kind !== 'salamander' && !ENEMIES[e.type].lake)], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((q) => !q.wall && !q.lift && q.n !== 'fence_mg')], ['fire', m.torches.filter((q) => q.kind !== 'wall')]])
          for (const o of list) if (onHot(o)) { out.push(`seed ${seed} f${f}: a ${n} in the lava or a cell from it at ${Math.round(o.x)},${Math.round(o.y)}`); break; } }
      // doors: two corridor cells just past a room's edge, every way into a doored room has one; a locked room is never the way to
      // the exit or to anything else, and its key or lever lies on this side of its doors
      { const inR = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, any = (x, y) => m.rooms.some((r) => inR(r, x, y));
        for (const d of m.doors) { const r = m.rooms[d.room];
          if ((!d.arena && d.cells.length !== 2) || d.cells.some(([x, y]) => cell(m, x, y) !== 1 || any(x, y) || !inRoom1(r, x, y))) out.push(`seed ${seed} f${f}: door ${d.dir} of room ${d.room} off its mouth`);
          if (['start', 'shop', 'boss', 'secret'].includes(r.type) && !d.arena) out.push(`seed ${seed} f${f}: a door to the ${r.type} room`); }
        for (const r of m.rooms) if (r.doors) for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++)
          if (!inR(r, x, y) && (x >= r.x && x < r.x + r.w || y >= r.y && y < r.y + r.h) && cell(m, x, y) === 1 && !any(x, y) && !m.doors.some((d) => d.room === r.id && d.cells.some(([cx, cy]) => cx === x && cy === y))) { out.push(`seed ${seed} f${f}: room ${r.id} has a way in without a door`); y = 1e9; break; }
        m.locks.forEach((L, li) => { const ds = m.doors.filter((d) => d.lock === li); if (!ds.length) return; const r = m.rooms[L.room], shut = new Set(ds.flatMap((d) => d.cells.map(([x, y]) => y * m.W + x)));
          const walk = (skip) => { const sv = new Uint8Array(m.W * m.H), q3 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; sv[q3[0]] = 1;
            while (q3.length) { const k = q3.pop(); for (const dd of [1, -1, m.W, -m.W]) { const n = k + dd; if (!sv[n] && m.cells[n] === 1 && !skip.has(n)) { sv[n] = 1; q3.push(n); } } } return sv; };
          const all = walk(new Set()), cut = walk(shut), at0 = (x, y) => cut[Math.floor(y / TILE) * m.W + Math.floor(x / TILE)], tag = `seed ${seed} f${f}: locked room ${L.room}`;
          if (!at0(m.exit.x, m.exit.y)) out.push(`${tag} shuts the way to the exit`);
          for (let k = 0; k < all.length; k++) if (all[k] && !cut[k] && !shut.has(k) && !inR(r, k % m.W, Math.floor(k / m.W))) { out.push(`${tag} cuts off floor beyond it`); break; }
          const holders = m.chests.filter((c) => c.key === li).concat(m.enemies.filter((e) => e.key === li));
          if (L.kind === 'key' && (holders.length !== 1 || !at0(holders[0].x, holders[0].y) || inR(r, Math.floor(holders[0].x / TILE), Math.floor(holders[0].y / TILE)))) out.push(`${tag}: its key is not on this side`);
          if (holders.some((o) => D.BOSSES[o.type])) out.push(`${tag}: its key is on a boss behind a sealed arena`);
          if (L.kind === 'lever' && (!L.lever || !at0(L.lever.x, L.lever.y + 40))) out.push(`${tag}: its lever is out of reach`);
          if (L.kind !== 'key' && L.kind !== 'lever') out.push(`${tag} has no key and no lever`); }); }
      // a merchant on every floor: his counter's front is reachable on foot, his room holds no monster post
      if (!m.shop) out.push(`seed ${seed} f${f}: no merchant`);
      else { const fx = Math.floor(m.shop.front.x / TILE), fy = Math.floor(m.shop.front.y / TILE), sn = new Uint8Array(m.W * m.H), q2 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)];
        while (q2.length) { const k = q2.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sn[n] && cell(m, n % m.W, Math.floor(n / m.W)) === 1 && !m.block.includes(n)) { sn[n] = 1; q2.push(n); } } }
        if (!sn[fy * m.W + fx]) out.push(`seed ${seed} f${f}: the merchant's counter can't be reached`);
        for (const e of m.enemies) if (e.room === m.shop.room || inStart(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) out.push(`seed ${seed} f${f}: ${e.type} posted in the start room or the shop`);
        // the shop's loose props stand against a wall and keep off its ways in; every open cell of the room is reachable from
        // the counter (only the merchant's nook behind it is closed on purpose)
        const r = m.rooms[m.shop.room], inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, blk = new Set(m.block);
        const mouths = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (cell(m, x + dx, y + dy) === 1 && !inR(x + dx, y + dy)) mouths.push([x, y]);
        for (const d of m.decor) if (d.r === r.id && ['shop_armor', 'shop_weapons', 'shop_gold', 'shop_crate'].includes(d.n)) { const x = Math.floor(d.x / TILE), y = Math.floor((d.y - 6) / TILE);
          if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cell(m, x + dx, y + dy) === 0)) out.push(`seed ${seed} f${f}: ${d.n} stands in the middle of the shop`);
          if (mouths.some(([mx, my]) => Math.max(Math.abs(mx - x), Math.abs(my - y)) <= 2)) out.push(`seed ${seed} f${f}: ${d.n} by a way into the shop`); }
        // (a cell of its box the counter reaches only round the outside of the box, by a plateau's ridge along its edge, is the floor's
        // shape, not the props': it counts only if the box's bare floor joins it to the counter)
        const nook = (x, y) => y <= r.y + 1 && Math.abs(x - r.cx) <= 1, bare = (x, y) => inR(x, y) && cell(m, x, y) === 1 && !nook(x, y), go = (x, y) => bare(x, y) && !blk.has(y * m.W + x);
        const fill = (ok) => { const sv = new Set([fy * m.W + fx]), q3 = [[fx, fy]]; while (q3.length) { const [x, y] = q3.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
          if (ok(nx, ny) && !sv.has(ny * m.W + nx)) { sv.add(ny * m.W + nx); q3.push([nx, ny]); } } } return sv; };
        const sv = fill(go), sv0 = fill(bare);
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (go(x, y) && sv0.has(y * m.W + x) && !sv.has(y * m.W + x)) { out.push(`seed ${seed} f${f}: shop props wall off floor`); y = 1e9; break; } }
      // fire floors always show lava, and no pool cuts floor off from the rest
      if (D.BIOMES[m.biome].lava && !m.lava) out.push(`seed ${seed} f${f}: a fire floor without lava`);
      { const sv = new Uint8Array(m.W * m.H), q3 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; sv[q3[0]] = 1;
        const thinS = new Set(m.thin || []); while (q3.length) { const k = q3.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sv[n] && (m.cells[n] === 1 || m.cells[n] === 4 || thinS.has(n))) { sv[n] = 1; q3.push(n); } } }
        if (m.cells.some((c, k) => c === 1 && !sv[k])) out.push(`seed ${seed} f${f}: lava cuts floor off`); }
      // secret rooms: sealed off by their fake wall (walking never gets in), reached once it breaks, one top-tier chest, no monsters
      if ((!m.secrets.length && !m.bossType) || m.secrets.length > 10) out.push(`seed ${seed} f${f}: ${m.secrets.length} secret rooms`);
      { const walk = (pass) => { const sv = new Uint8Array(m.W * m.H), q3 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; sv[q3[0]] = 1;
          while (q3.length) { const k = q3.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sv[n] && (m.cells[n] === 1 || (pass && m.cells[n] === 4)) && !m.block.includes(n)) { sv[n] = 1; q3.push(n); } } } return sv; };
        const shut = walk(0), open = walk(1);
        m.secrets.forEach((q, i) => { const r = m.rooms[q.room], ch = m.chests.filter((c) => c.sec === i);
          if (q.wall.length !== 4 || q.wall.some(([x, y]) => cell(m, x, y) !== 4)) out.push(`seed ${seed} f${f}: secret ${i} has no fake wall`);
          if (q.front.some(([x, y]) => inRoom1(m.rooms[m.shop.room], x, y))) out.push(`seed ${seed} f${f}: secret off the shop`);
          if (ch.length !== 1 || ch[0].tier !== (q.pz || q.inner ? 5 : 4)) out.push(`seed ${seed} f${f}: secret ${i} holds ${ch.length} chests`);
          for (const c of ch) { const k = Math.floor(c.y / TILE) * m.W + Math.floor(c.x / TILE), nb = [1, -1, m.W, -m.W].map((d) => k + d);
            if (nb.some((n) => shut[n])) out.push(`seed ${seed} f${f}: secret ${i} reachable without breaking the wall`);
            if (!nb.some((n) => open[n])) out.push(`seed ${seed} f${f}: secret ${i} chest unreachable after the wall breaks`); }
          if (m.enemies.some((e) => e.room === r.id)) out.push(`seed ${seed} f${f}: monsters in secret ${i}`);
          if (m.torches.some((t) => t.r === r.id && t.sec !== i)) out.push(`seed ${seed} f${f}: a torch lights secret ${i} before it is found`);
          // each secret has its cover or its mechanism, and a mechanism is found and worked from the open floor
          for (const e of cacheIssues(m, q, i, shut)) out.push(`seed ${seed} f${f}: secret ${i} (${q.kind}) ${e}`); }); }
      // every floor cell of every room lies within reach of a light: a torch, a brazier, candles, a crystal, an altar, the bonfire or a shop lamp
      // (but a dark room, TASKS 365, whose torches and candles are put out)
      { const LR = DG.LIGHT_R, lights = m.torches.filter((t) => !t.dark).map((t) => [t.x, t.y, LR[t.kind]]).concat(m.decor.filter((d) => LR[d.n] && !d.dark).map((d) => [d.x, d.y, LR[d.n]]),
          m.shrines.map((s) => [s.x, s.y, LR.shrine]), m.shop.lanterns.map((q) => [q.x, q.y, LR.wall]), [[m.shop.x, m.shop.y, LR.fire]]);
        for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 3) lights.push([(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE + 6, LR.lava]);   // lava glows
        for (const r of m.rooms) { let dark = 0; if (r.event === 'dark') continue;
          for (const [bx, by, bw, bh] of DG.rectsOf(r)) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (cell(m, x, y) === 1 && !lights.some(([lx, ly, lr]) => Math.hypot(lx - (x + 0.5) * TILE, (ly - (y + 0.5) * TILE - 6) / 0.8) <= lr * TILE)) dark++;
          if (dark) out.push(`seed ${seed} f${f}: ${dark} dark cells in ${r.type} room ${r.id} (${r.w}×${r.h})`); } } }
    // the cave's water comes in every kind over the floors checked: falls, breaches, springs, isthmuses, fords and bridges
    for (const k of ['waterfall', 'breach', 'spring', 'neck', 'ford', 'bridge']) if (!caveKinds[k]) out.push(`cave: no ${k} on any of the floors checked`);
    for (const k of Object.keys(D.ROOM_SHAPES)) if (!shapes[k] && !shapes[k + '*']) out.push(`rooms: no ${k} room on any of the floors checked`);
    if (!shapes['pit*']) out.push('rooms: no pit dug on any of the floors checked');
    if (!shapes.wide) out.push('rooms: no corridor three cells wide on any of the floors checked');
    if (!shapes.rift) out.push('rooms: no bridge over a rift of lava on any of the floors checked');
    if (!shapes.gauntlet) out.push('rooms: no trapped corridor on any of the floors checked');
    for (const k of ['rooms', 'maze', 'hall', 'catacomb', 'fortress', 'tomb']) if (!shapes['lay:' + k]) out.push(`rooms: no ${k} layout on any of the floors checked`);
    return out;
  }
  // over many floors: caches open by honest means only, the floors keep no hoards, and the planned rooms and puzzles do turn up
  function cacheGenCheck() { const out = [], seen = {}, lib = { n: 0, shelf: 0 };
    for (let seed = 1; seed <= 30; seed++) for (let f = 1; f <= D.RUNS.campaign.floors; f++) { const s0 = (seed * 811 + f * 1303) >>> 0; let m; try { m = DG.genFloor(s0, f); } catch (e) { out.push(`gen ${s0} f${f}: ${e.message}`); continue; }
      if (m.rooms.some((r) => r.type === 'treasure')) out.push(`gen ${s0} f${f}: a treasure room`);
      if (m.secrets.some((q) => q.kind === 'crack')) out.push(`gen ${s0} f${f}: a crack secret`);
      const W = m.W, walk = (() => { const sv = new Uint8Array(W * m.H), st = [Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE)]; sv[st[0]] = 1; while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!sv[n] && m.cells[n] === 1 && !m.block.includes(n)) { sv[n] = 1; st.push(n); } } } return sv; })();
      m.secrets.forEach((q, i) => { for (const e of cacheIssues(m, q, i, walk)) out.push(`gen ${s0} f${f}: secret ${i} (${q.kind}) ${e}`); seen[q.kind] = 1; if (q.trig) seen[q.trig.k] = 1; if (q.pz) seen[q.pz.k] = 1; if (q.parent !== undefined) seen.inner = 1;
        const h = m.rooms[q.host]; if (h && h.plan && (q.kind === 'statue' || q.kind === 'shelf')) seen.planned = 1; if (h && h.plan === 'library' && q.dir === 'u') { lib.n++; if (q.kind === 'shelf') lib.shelf++; } }); }
    for (const k of ['banner', 'shelf', 'statue', 'sconce', 'plate', 'lever', 'levers', 'candles', 'inner', 'planned']) if (!seen[k]) out.push(`cache check: no ${k} cache on any of the floors checked`);
    // (TASKS 1852) a planned bookcase stays one, room along the wall or not: a library's wall caches keep their share of bookcases
    if (lib.shelf < lib.n * 0.12) out.push(`cache check: ${lib.shelf} of ${lib.n} library wall caches are bookcases (a planned bookcase turned into a lever or banner)`);
    return out; }
  // the magma floors' types (TASKS 426, 427): a run's floors never take one type twice running and every type turns up; a lake floor
  // has islands in its lake, a hoard on the big one, no start, stairs or merchant on one and no cache dug in the lake; a river floor
  // its island with the hoard, two to four ways over and packs by them
  function floorTypeCheck() {
    const out = [], seen = {}, AR = D.ARCH.plateau;
    let mixed = 0;
    for (let sd = 1; sd <= 10; sd++) { let prev = null, pm = false;
      for (let f = 1; f <= D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f} (${m.ftype})`; seen[m.ftype] = (seen[m.ftype] || 0) + 1;
        if (f < D.RUNS.magma.floors && m.ftype === prev) out.push(`${tag}: the same type as the floor before`); prev = m.ftype;
        if (m.ftype2) { mixed++; if (pm) out.push(`${tag}: a mixed floor after a mixed floor`); if (!AR.blend.over.includes(m.ftype)) out.push(`${tag}: ${m.ftype} mixed with ${m.ftype2}`); } pm = !!m.ftype2;
        if (f === D.RUNS.magma.floors && m.ftype !== 'plain') out.push(`${tag}: the boss's floor is not the plain plateaus`);
        if (f === 1 && AR.first && m.ftype !== AR.first) out.push(`${tag}: the first floor is not ${AR.first}`);
        if (f > 1 && AR.first && m.ftype === AR.first) out.push(`${tag}: ${AR.first} again past the first floor`);
        if (f < D.RUNS.magma.floors && D.floorName(f, 'magma', sd, undefined, m) !== AR.names[m.ftype]) out.push(`${tag}: the title does not name the floor's type`);
        for (const c of m.crossings.filter((q) => q.lava && q.kind === 'arch' && !DG.archLegs(m, q))) out.push(`${tag}: an arch at cell ${c.cells[0]} that does not span its river`);
        // (TASKS 1940) a stone arch's legs stand clear of props, chests, pots and braziers
        for (const legs of m.crossings.map((c) => DG.archLegs(m, c)).filter(Boolean)) for (const [n, x, y] of [...m.decor.filter((d) => d.solid && !d.wall).map((d) => [d.n, d.x, d.y]), ...m.chests.map((c) => ['chest', c.x, c.y]), ...m.pots.map((q) => ['pot', q.x, q.y]), ...m.torches.filter((t) => t.kind === 'brazier').map((t) => ['brazier', t.x, t.y])])
          if (DG.onArchLeg(legs, n, x, y)) out.push(`${tag}: ${n} at ${Math.round(x)},${Math.round(y)} over a stone arch's leg`);
        // a river (TASKS 428): one island; two to four places to cross, a pack waiting at them
        if (m.ftype === 'river') { const W = m.W, isles = m.rooms.filter((r) => r.isle), rc = m.crossings.filter((c) => c.river);
          if (isles.length !== 1) out.push(`${tag}: ${isles.length} islands on the river`);
          const xs = rc.map((c) => c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length).sort((a, b) => a - b); let places = 0, last = -99; for (const x of xs) { if (x - last > 8) places++; last = x; }
          if (places < 2 || places > 4) out.push(`${tag}: ${places} places to cross the river`);
          const mx = (c) => c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length, held = rc.filter((c) => { const own = new Set(c.cells), ends = c.cells.flatMap((k) => [1, -1, W, -W].map((o) => k + o)).filter((k) => m.cells[k] === 1 && !own.has(k));
            return m.enemies.some((e) => ends.some((k) => Math.hypot(e.x / TILE - 0.5 - (k % W), e.y / TILE - 0.5 - Math.floor(k / W)) < 8)); });
          const bare = xs.filter((x, i) => (i === 0 || x - xs[i - 1] > 8) && !held.some((c) => Math.abs(mx(c) - x) <= 8 * 3)).length;
          if (bare > 1) out.push(`${tag}: ${bare} places to cross the river with no pack by them`);
          // the river's choice (TASKS 473), walked on the floor as laid: two ways over within AR.river.loose of each other, no walk
          // round it shorter, the shortest guarded at its far landing and a rock falling on the next
          const fig = new Uint8Array(W * m.H); if (m.riverBand) m.riverBand.forEach(([a, b], x) => { for (let y = Math.max(6, Math.floor(a)); y <= Math.min(m.H - 5, Math.ceil(b)); y++) if (y + 0.5 > a && y + 0.5 < b) fig[y * W + x] = 1; });
          const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e0 = m.exit.ty * W + m.exit.tx, Rw = DG.riverWays(m.cells, W, m.H, fig, s0, (c) => c === 1), ws = DG.riverAt(Rw, e0);
          // (TASKS 1160) the way with the guard has no aimed rocks of its own
          if (m.riverGuard) { const g = new Set(m.riverGuard); for (const z of m.hazards) if (z.k === 'fall' && z.aim && !z.tail && g.has(Math.floor(z.y / TILE) * W + Math.floor(z.x / TILE))) out.push(`${tag}: a run of rocks on the guarded crossing`); }
          if (!m.riverBand || !DG.riverOk(Rw, e0, AR.river.loose)) out.push(`${tag}: no choice of ways over the river (${ws.map((q) => q[0]).join('/')}, round its end ${Rw.dry[e0]})`);
          if (!m.enemies.some((e) => e.post === 'ford')) out.push(`${tag}: no guard at the river's shortest way over`);
          if (!m.hazards.some((z) => z.ford)) out.push(`${tag}: no rock falling on the river's second way over`); }
        // a chasm (TASKS 429): two chain bridges over the dark and more, packs waiting at them, the dark (not lava) round the plateaus
        if (m.ftype === 'chasm') { const W = m.W, br = m.crossings.filter((c) => c.chasm);
          // (TASKS 474) a rock falls on a bridge the walk to the stairs takes
          { const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e0 = m.exit.ty * W + m.exit.tx, from = new Int32Array(W * m.H).fill(-2), q = [s0]; from[s0] = -1;
            for (let i = 0; i < q.length && from[e0] === -2; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (from[n] === -2 && m.cells[n] === 1) { from[n] = q[i]; q.push(n); } }
            const way = new Set(); for (let k = e0; k >= 0 && from[e0] !== -2; k = from[k]) way.add(k);
            if (br.some((c) => c.cells.some((k) => way.has(k))) && !m.hazards.some((z) => z.span && br.some((c) => c.cells.some((k) => way.has(k) && D.hazIn(z, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE))))) out.push(`${tag}: no rock falling on a bridge of the walk to the stairs`); }
          if (br.length < 2) out.push(`${tag}: ${br.length} bridges over the chasm`);
          const held = br.filter((c) => m.enemies.some((e) => c.cells.some((k) => Math.hypot(e.x / TILE - 0.5 - (k % W), e.y / TILE - 0.5 - Math.floor(k / W)) < 9))).length;
          if (held < br.length / 2) out.push(`${tag}: ${held} of ${br.length} bridges with a pack by them`);
          let rim = 0, lav = 0; for (let k = 0; k < W * m.H; k++) if (m.cells[k] === 1 && [1, -1, W, -W].some((o) => m.cells[k + o] !== 1 && m.cells[k + o] !== 4)) { rim++; if ([1, -1, W, -W].some((o) => m.cells[k + o] === 3)) lav++; }
          if (lav > rim * 0.25) out.push(`${tag}: ${Math.round(lav / rim * 100)} % of the plateaus' edges by lava`); }
        // terraces (TASKS 430): three rows and more, the start on the first or the last and the stairs on the other, a lavafall down
        // the wall at the head of the river
        if (m.ftype === 'terrace') { const rows = Math.max(...m.rooms.map((r) => (r.row ?? -1))) + 1, s0 = m.rooms.find((r) => r.type === 'start'), e0 = m.rooms.find((r) => r.type === 'exit');
          if (rows < 3) out.push(`${tag}: ${rows} rows of terraces`);
          if (!s0 || !e0 || s0.row === undefined || e0.row === undefined || Math.min(s0.row, e0.row) !== 0 || Math.max(s0.row, e0.row) !== rows - 1) out.push(`${tag}: the start and the stairs are not the serpentine's two ends`);
          if (!m.lavaFeatures.some((q) => q.kind === 'fall')) out.push(`${tag}: no lavafall`); }
        // a lava cave (TASKS 431): its rock all wall (no chasm), streams of lava across its tunnels crossed twice and more, a source
        if (m.ftype === 'cave') { if (m.cliff.some((c) => c < m.H)) out.push(`${tag}: a lava cave with a chasm under its rock`);
          if (m.crossings.filter((c) => c.lava).length < 2) out.push(`${tag}: ${m.crossings.length} ways over its lava`);
          if (!m.lavaFeatures.length) out.push(`${tag}: no source of its lava`); }
        if (m.rooms.some((r) => r.isle && ['start', 'exit', 'boss', 'shop'].includes(r.type))) out.push(`${tag}: the start, the stairs or the merchant on an island`);
        if (m.ftype !== 'lake') continue; const isles = m.rooms.filter((r) => r.isle);
        if (isles.length < 2) out.push(`${tag}: ${isles.length} islands in the lake`);
        if (isles.some((r) => ['start', 'exit', 'boss', 'shop'].includes(r.type))) out.push(`${tag}: the start, the stairs or the merchant on an island`);
        // the lake's choice (TASKS 472), walked on the floor as laid: over the islands, and round them (their chain shut: the floor
        // reached from their middles within the lake's figure, its noise allowed for)
        if (!m.lakeAt) out.push(`${tag}: a lake without its figure`);
        else { const W = m.W, s0 = Math.floor(m.spawn.y / D.TILE) * W + Math.floor(m.spawn.x / D.TILE), e0 = m.exit.ty * W + m.exit.tx, shut = new Uint8Array(W * m.H), [cx, cy, rx, ry] = m.lakeAt;
          const inLake = (k) => Math.hypot((k % W + 0.5 - cx) / rx, (Math.floor(k / W) + 0.5 - cy) / ry) < 1.2, cq = isles.map((r) => r.cy * W + r.cx); for (const k of cq) shut[k] = 1;
          for (let i = 0; i < cq.length; i++) for (const o of [1, -1, W, -W]) { const n = cq[i] + o; if (!shut[n] && m.cells[n] === 1 && inLake(n) && !(m.rooms.some((r) => !r.isle && n % W >= r.x && n % W < r.x + r.w && Math.floor(n / W) >= r.y && Math.floor(n / W) < r.y + r.h))) { shut[n] = 1; cq.push(n); } }
          const walk = (ok) => { const d = new Int32Array(W * m.H).fill(-1), q = [s0]; d[s0] = 0; for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && m.cells[n] === 1 && ok(n)) { d[n] = d[q[i]] + 1; q.push(n); } } return d[e0]; };
          const a = walk(() => true), b = walk((n) => !shut[n]), L = AR.lake.loose;
          if (b < 0) out.push(`${tag}: no way round the lake`); else if (1 - a / b < L[0] || 1 - a / b > L[1]) out.push(`${tag}: the islands save ${Math.round(100 * (1 - a / b))} % of the way round (${a} against ${b})`); }
        // the lake is the floor's figure (the player's note on 427): a big island with the hoard and smaller ones, the plateaus on its
        // shore no bigger than the lake's own sizes, and no hole into the dark left in its lava
        if (new Set(isles.map((r) => r.w * r.h > 90 ? 'big' : r.w * r.h > 40 ? 'mid' : 'small')).size < 2) out.push(`${tag}: the islands are all of a size`);
        for (const r of m.rooms) if (!r.isle && !r.pocket && r.type !== 'secret' && r.type !== 'shop' && (r.w > (r.g || AR.lake.grow)[0] || r.h > (r.g || AR.lake.grow)[1])) out.push(`${tag}: a shore plateau of ${r.w}×${r.h}`);
        { const W = m.W, seen = new Uint8Array(W * m.H), wallAt = (k) => Math.floor(k / W) < m.cliff[k % W];
          for (let k0 = 0; k0 < W * m.H; k0++) { if (m.cells[k0] !== 0 || seen[k0] || wallAt(k0)) continue; const cs = [k0]; seen[k0] = 1; let shut = true;
            for (let i = 0; i < cs.length; i++) for (const o of [1, -1, W, -W]) { const n = cs[i] + o, x = n % W, y = Math.floor(n / W);
              if (x < 3 || y < 3 || x > W - 4 || y > m.H - 4) { shut = false; continue; } if (m.cells[n] === 3) continue; if (m.cells[n] !== 0 || wallAt(n)) { shut = false; continue; } if (!seen[n]) { seen[n] = 1; cs.push(n); } }
            if (shut) { out.push(`${tag}: a hole of ${cs.length} cells into the dark in the lava at ${k0 % W},${Math.floor(k0 / W)}`); break; } } }
        for (const q of m.secrets) { const r = m.rooms[q.room]; let lava = 0; for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (cell(m, x, y) === 3) lava++;
          if (lava > 2) out.push(`${tag}: a cache with ${lava} cells of lava round it`); } } }
    // terraces' steps and surge (TASKS 475), on 20 terrace floors of their own: most have a step down (the upper row's face onto the
    // lower), every one a surge the walk to the stairs crosses
    { let stepless = 0;
      for (let sd = 1; sd <= 10; sd++) for (const f of [2, 3]) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd, ftype: 'terrace' }), W = m.W, tag = `magma terrace ${sd} f${f}`;
        if (!(m.steps || []).length) stepless++; const z = (m.hazards || []).find((q) => q.k === 'surge'); if (!z) { out.push(`${tag}: no surge`); continue; }
        const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e0 = m.exit.ty * W + m.exit.tx, from = new Int32Array(W * m.H).fill(-2), q = [s0]; from[s0] = -1;
        for (let i = 0; i < q.length && from[e0] === -2; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (from[n] === -2 && m.cells[n] === 1) { from[n] = q[i]; q.push(n); } }
        let on = false; for (let k = e0; k >= 0 && from[e0] !== -2; k = from[k]) if (D.hazIn(z, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE)) on = true;
        if (!on) out.push(`${tag}: the walk to the stairs misses the surge`);
        if (m.enemies.some((e) => D.hazIn(z, e.x, e.y))) out.push(`${tag}: a monster posted in the surge`); }
      if (stepless > 4) out.push(`magma terraces: ${stepless} of 20 floors with no step down`); }
    // the magma caves' halls (TASKS 434): one or two a floor but the boss's, each with its props, its reward and its own pack
    { const HL = D.MAGMA_HALLS, kinds = {}, inR = (r, o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= r.y * TILE && o.y < (r.y + r.h) * TILE;
      for (let sd = 1; sd <= 10; sd++) for (let f = 1; f <= D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f}`, hs = m.rooms.filter((r) => r.hall);
        if (f === D.RUNS.magma.floors ? hs.length : hs.length < HL.n[0] || hs.length > HL.n[1] + 1) out.push(`${tag}: ${hs.length} halls`);
        for (const r of hs) { kinds[r.hall] = 1; const K = HL.kinds[r.hall], lead = D.MAGMA_PACKS[K.pack].plan[0][0];
          const props = { sanctum: (m.circles || []).some((q) => q.r === r.id), forge: ['forge_mg', 'anvil_tw'].every((n) => m.decor.some((d) => d.n === n && inR(r, d))),
            nest: m.decor.filter((d) => d.n === 'skel_mg' && inR(r, d)).length >= 3, prison: m.decor.filter((d) => d.n === 'cage' && inR(r, d)).length >= 2 }[r.hall];
          if (!props) out.push(`${tag}: the ${r.hall} hall without its props`);
          if (!m.chests.some((c) => inR(r, c))) out.push(`${tag}: the ${r.hall} hall without its chest`);
          // (each kind its own pay, TASKS 1054)
          else if (!m.chests.some((c) => inR(r, c) && c.tier === K.pay.tier && (!(K.pay.forge || K.pay.stash) || c.hall === r.hall))) out.push(`${tag}: the ${r.hall} hall's chest not its own pay`);
          if (K.pay.bless && !(m.circles || []).some((q) => q.r === r.id && q.bless)) out.push(`${tag}: the sanctum's circle gives no blessing`);
          // (TASKS 1159) nothing that hurts or scars in the circle, and it blesses a floor still to be fought
          for (const q of (m.circles || []).filter((q) => q.r === r.id)) { if (m.traps.some((t) => Math.hypot(t.x - q.x, t.y - q.y) < 2.6 * TILE)) out.push(`${tag}: spikes in the sanctum's circle`); if ((m.decals || []).some((d) => Math.hypot(d.x - q.x, d.y - q.y) < 2.6 * TILE)) out.push(`${tag}: a decal in the sanctum's circle`); if (m.decor.some((d) => /^vent/.test(d.n) && Math.hypot(d.x - q.x, d.y - q.y) < 2.6 * TILE)) out.push(`${tag}: a vent in the sanctum's circle`); if (m.decor.some((d) => d.n === 'torch_stand' && Math.hypot(d.x - q.x, d.y - q.y) < 3.2 * TILE)) out.push(`${tag}: a torch in the sanctum's circle`); if (q.bless && Math.hypot(m.exit.x - q.x, m.exit.y - q.y) < HL.blessOff * TILE) out.push(`${tag}: the sanctum by the stairs`); }
          // (an early kind on the 1st floor, TASKS 488, has the floor's own pack: its monster comes later)
          if (!(f === 1 && K.early) && !m.enemies.some((e) => e.room === r.id && lead.includes(e.type))) out.push(`${tag}: the ${r.hall} hall without its pack`);
          if (f === 1 && K.early && !m.enemies.some((e) => e.room === r.id)) out.push(`${tag}: the ${r.hall} hall without a pack`); } }
      for (const k of Object.keys(HL.kinds)) if (!kinds[k]) out.push(`magma halls: no ${k} hall in 10 runs`);
      // (TASKS 1943) every hall keeps its own monster, `need`: the arrival's gap took run 169's 3rd floor's golem, a small prison's cut its skeleton
      for (const [sd, f] of [[169, 3], [12, 1], [15, 1], [21, 1], ...Array.from({ length: 10 }, (_, i) => [i + 1, (i % 3) + 1])]) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd });
        for (const r of m.rooms.filter((q) => q.hall)) if (!(f === 1 && HL.kinds[r.hall].early) && !m.enemies.some((e) => e.room === r.id && e.type === HL.kinds[r.hall].need)) out.push(`magma run ${sd} f${f}: the ${r.hall} hall without its ${HL.kinds[r.hall].need}`); }
      // (TASKS 1647, PR 79 review) a nest keeps its fire priest once the roster has one: 1943's keeping of every smouldering one cut it
      { let nests = 0; for (const sd of [11, 13, 20, 21, ...Array.from({ length: 10 }, (_, i) => i + 1)]) { const f = 3, m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd });
        if (!D.rosterAt('magma', f).includes('fire_priest')) { out.push('magma nests: no fire priest in the 3rd floor\'s roster to check'); break; }
        for (const r of m.rooms.filter((q) => q.hall === 'nest')) { nests++; if (!m.enemies.some((e) => e.room === r.id && e.type === 'fire_priest')) out.push(`magma run ${sd} f${f}: the nest without its fire priest`); } }
        if (nests < 5) out.push(`magma nests: ${nests} nests on the checked floors, too few to check the priest`); }
      // (PR 79 review) the cut keeps the hall's leader past every keep entry: more of them than the pack's room dropped it silently
      { const lead = ['lead', 0], trim = (plan, lim) => DG.trimPlan(plan, lead, lim), keep = (k) => ['keep' + k, 0, 1];
        for (const [plan, lim, want] of [[[keep(1), lead, keep(2), keep(3)], 2, 1], [[lead, keep(1), keep(2), keep(3), ['x', 0]], 3, 2], [[['x', 0], lead, ['y', 0], keep(1)], 2, 1], [[keep(1), keep(2), lead], 1, 0]]) {
          const got = trim(plan, lim); if (got.length !== lim || !got.includes(lead) || got.filter((q) => q[2]).length !== want) out.push(`magma halls: the pack's cut to ${lim} keeps ${got.map((q) => q[0]).join(',')}`); } }
      // (TASKS 1963) a terrace's way round joins the two banks of the crossing it is laid for (`of`), past its first and last rows
      for (const [seed, f, rs] of [[15918, 14, 56], [17654, 14, 112], [20837, 15, 182], [20692, 14, 210]]) { const m = DG.genFloor(seed, f, { mode: 'campaign', runSeed: rs, from: 1, town: 1 }), W = m.W, X = m.crossings, deck = new Set(X.flatMap((c) => c.cells)), cr = new Set(m.crust || []);
        if (!X.some((c) => c.bend)) out.push(`town run ${rs} f${f}: no way round a terrace's crossing to check`);
        for (const of of new Set(X.filter((c) => c.bend).map((c) => c.of))) { const B = X.find((c) => !c.bend && c.cells.includes(of)); if (!B) { out.push(`town run ${rs} f${f}: a way round for no crossing at ${of}`); continue; }
          const Bc = new Set(B.cells), along = (k) => (B.axis === 'x' ? k % W : Math.floor(k / W)), lo = Math.min(...B.cells.map(along)), hi = Math.max(...B.cells.map(along)), st = B.axis === 'x' ? 1 : W;
          const ends = [[lo, -st], [hi, st]].map(([v, o]) => B.cells.filter((k) => along(k) === v).map((k) => k + o).find((n) => m.cells[n] === 1 && !Bc.has(n)));
          if (ends.some((k) => k === undefined)) { out.push(`town run ${rs} f${f}: the crossing at ${of} has no bank past an end`); continue; }
          const d = new Int32Array(W * m.H).fill(-1), q = [ends[0]]; d[ends[0]] = 0;
          for (let i = 0; i < q.length && d[ends[1]] < 0; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && (m.cells[n] === 1 || deck.has(n) || cr.has(n)) && !Bc.has(n)) { d[n] = d[q[i]] + 1; q.push(n); } }
          if (d[ends[1]] < 0) out.push(`town run ${rs} f${f}: the way round the crossing at ${of} does not join its two banks`); } }
      // (TASKS 1958) the arrival's gap is kept round where the hero comes out of the stairs (DG.arrivalAt), not the old spot by the opening
      for (const [sd, f] of [[203, 14], [14, 14], [21, 13], [35, 15]]) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd, { town: true }); enterFloor(S, S.run, f); const R = S.run, m = R.map, h = R.hero;
        if (!m.up) { out.push(`town run ${sd} f${f}: no stairs up to check the arrival's gap by`); continue; } const [ax, ay] = DG.arrivalAt(m.up, m.biome); if (Math.hypot(h.x - ax, h.y - ay) > 1.5 * TILE) out.push(`town run ${sd} f${f}: the hero comes out ${Math.round(Math.hypot(h.x - ax, h.y - ay))} px off the arrival spot`);
        for (const e of R.en) if (e.deadT < 0 && e.key === undefined && Math.hypot(e.x - ax, e.y - ay) < 9 * TILE) out.push(`town run ${sd} f${f}: a ${e.type} ${(Math.hypot(e.x - ax, e.y - ay) / TILE).toFixed(1)} cells from the arrival`); }
      // (TASKS 1944) a save laid before GEN_VERSION 24 with a lava arch standing on dry floor is loaded with slabs there, as a run in play
      // and as a slot's run
      { let done = 0; for (let sd = 1; sd <= 6 && !done; sd++) for (let f = 1; f <= 3 && !done; f++) { const S = spawn(0, {}); S.run = newRun(S, 'magma', sd); if (f > 1) enterFloor(S, S.run, f);
        const m = S.run.map, i = m.crossings.findIndex((c) => c.lava && c.kind === 'slabs' && c.axis === 'x' && !DG.archLegs(m, Object.assign({}, c, { kind: 'arch' }))); if (i < 0) continue; done = 1;
        m.crossings[i].kind = 'arch'; const old = JSON.parse(JSON.stringify(S.run)), S2 = spawn(0, { run: old, saves: [JSON.parse(JSON.stringify(old))] });
        if (S2.saved.map.crossings[i].kind !== 'slabs') out.push(`magma run ${sd} f${f}: a saved run's arch with no legs is not loaded as slabs`);
        const sl = S2.saves.find(Boolean); if (sl && sl.map.crossings[i].kind !== 'slabs') out.push(`magma run ${sd} f${f}: a slot's arch with no legs is not loaded as slabs`); }
        if (!done) out.push('saves: no magma floor with lava slabs across to check an old arch on'); }
      // (TASKS 1920, PR 64 review) no shooter within the calm of a gate, and a hall within it keeps its own monster: run 310's 3rd floor's
      // sanctum lost its priest. Built through newRun and enterFloor, as a run builds them, so the floor checked is the one played
      const G = D.HAZ.vent.gate; for (const [sd, f] of [[310, 3], ...Array.from({ length: 12 }, (_, i) => [i + 1, (i % 3) + 1])]) { const S = spawn(0, {}); S.run = newRun(S, 'magma', sd); if (f > 1) enterFloor(S, S.run, f);
        const m = S.run.map, en = S.run.en, gz = m.hazards.filter((z) => z.gate), tag = `magma run ${sd} f${f}`, key = sd === 310 && f === 3; let near = 0;
        if (!gz.length) { if (key) out.push(`${tag}: no gate, the sanctum-by-the-gate case is no longer checked`); continue; } const gx = gz.reduce((t, z) => t + z.x, 0) / gz.length, gy = gz.reduce((t, z) => t + z.y, 0) / gz.length;
        for (const e of en) if (G.shy.includes(e.type) && Math.hypot(e.x - gx, e.y - gy) < G.calm * TILE) out.push(`${tag}: a ${e.type} within ${G.calm} cells of the gate`);
        for (const r of m.rooms.filter((q) => q.hall)) { const K = HL.kinds[r.hall], dx = Math.max(r.x * TILE - gx, 0, gx - (r.x + r.w) * TILE), dy = Math.max(r.y * TILE - gy, 0, gy - (r.y + r.h) * TILE);
          if (G.shy.includes(K.need) && !(f === 1 && K.early) && Math.hypot(dx, dy) < G.calm * TILE && (near += r.hall === 'sanctum', !en.some((e) => e.room === r.id && e.type === K.need))) out.push(`${tag}: the ${r.hall} hall within ${G.calm} cells of the gate without its ${K.need}`); }
        if (key && !near) out.push(`${tag}: the sanctum not within ${G.calm} cells of the gate, the sanctum-by-the-gate case is no longer checked`); } }
    // (TASKS 1938, PR 64 review) a monster's step about its post takes D.AMB_T, the time monsters.js plants its feet over: it moves
    // inside that window only, and ends it on the step's far spot
    { const Z = spawn(0, {}); Z.run = newRun(Z, 'magma', 7); const m = Z.run.map, e = Z.run.en.find((o) => !ENEMIES[o.type].ghost && ENEMIES[o.type].amble !== 0 && !D.BOSSES[o.type]);
      if (!e) out.push('amble: no monster to step'); else { e.hx = e.x; e.hy = e.y; let A = null, moved = [];
        for (let t = 0; t < 30 && !(A && t > A.t + D.AMB_T + 0.5); t += DT) { const x = e.x, y = e.y; SIMX.idle(m, e, ENEMIES[e.type], t); if (!A && e.amb && e.amb.t >= 0) A = e.amb; if (Math.hypot(e.x - x, e.y - y) > 1e-6) moved.push(t); }
        if (!A) out.push(`amble: a ${e.type} at its post never steps`);
        else { if (moved.some((t) => t < A.t - 1e-9 || t > A.t + D.AMB_T + DT)) out.push(`amble: a ${e.type}'s step runs outside its ${D.AMB_T} s`);
          if (Math.hypot(e.x - A.x1, e.y - A.y1) > 0.5) out.push(`amble: a ${e.type}'s step does not end on its far spot`); } }
      // (TASKS 1969) a shove inside the step stays; the foe looks the way it steps; a hopper, with no legs to plant, keeps still
      if (e) { const Y = spawn(0, {}); Y.run = newRun(Y, 'magma', 7); const f = Y.run.en.find((o) => o.id === e.id); f.hx = f.x; f.hy = f.y; let B = null, x1 = 0, y1 = 0, pushed = 0;
        for (let t = 0; t < 30 && !(B && t > B.t + D.AMB_T + 0.5); t += DT) { SIMX.idle(Y.run.map, f, ENEMIES[f.type], t);
          if (!B && f.amb && f.amb.t >= 0) { B = f.amb; x1 = B.x1; y1 = B.y1; if (Math.abs(B.x1 - B.x0) > 2 && f.face !== (B.x1 > B.x0 ? 1 : -1)) out.push(`amble: a ${f.type} steps one way and looks the other`); }
          if (B && !pushed && t > B.t + D.AMB_T / 2) { pushed = 1; f.y += 6; } }
        if (B && Math.abs(f.y - (y1 + 6)) > 0.5) out.push(`amble: a ${f.type} shoved inside its step springs back (${(f.y - y1).toFixed(1)} px of 6 kept)`);
        const H = spawn(0, {}); H.run = newRun(H, 'magma', 7); const hm = H.run.map, sl = { id: 7, type: 'slime', x: f.hx, y: f.hy, hx: f.hx, hy: f.hy, vx: 0, vy: 0, face: 1, dist: 0 };
        for (let t = 0; t < 12; t += DT) { SIMX.idle(hm, sl, ENEMIES.slime, t); if (Math.hypot(sl.x - sl.hx, sl.y - sl.hy) > 1e-6) { out.push('amble: a slime slides about its post with no hop'); break; } } } }
    // (TASKS 1054) a chasm floor's way over has another on half of them and more; a hoard's islet is a chest of the 3rd tier past a run of
    // rocks down its strip of crust
    { let n = 0, alt = 0, isl = 0; const walk = (m, ban) => { const W = m.W, s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e0 = m.exit.ty * W + m.exit.tx, from = new Int32Array(W * m.H).fill(-2), q = [s0]; from[s0] = -1;
        for (let i = 0; i < q.length && from[e0] === -2; i++) for (const o of [1, -1, W, -W]) { const k = q[i] + o; if (from[k] === -2 && m.cells[k] === 1 && !ban.has(k)) { from[k] = q[i]; q.push(k); } }
        const way = new Set(); for (let k = e0; k >= 0 && from[e0] !== -2; k = from[k]) way.add(k); return way; };
      for (let sd = 1; sd <= 30; sd++) for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f}`;
        for (const r of m.rooms.filter((q) => q.islet)) { isl++; const inR = (o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= r.y * TILE && o.y < (r.y + r.h) * TILE;
          if (!m.chests.some((c) => inR(c) && c.tier === 3)) out.push(`${tag}: the islet's hoard not of the 3rd tier`);
          if (!m.hazards.some((z) => z.islet && !z.tail)) out.push(`${tag}: no rocks down the islet's strip`); }
        if (m.ftype !== 'chasm' || m.ftype2) continue; n++; const way = walk(m, new Set());
        if (m.crossings.some((c) => c.chasm && c.cells.some((k) => way.has(k)) && walk(m, new Set(c.cells)).size)) alt++;
        // (TASKS 1169) a walker to the stairs does not pass the second way's chest
        if (m.crossings.some((c) => c.alt)) for (const c of m.chests.filter((q) => q.round)) if (way.has(Math.floor(c.y / TILE) * m.W + Math.floor(c.x / TILE))) out.push(`${tag}: the second way's chest on the shortest walk`);
        // (TASKS 1158) the second way is no twin of the first
        for (const a of m.crossings.filter((c) => c.alt)) { const B = m.crossings.find((c) => !c.alt && c.cells.includes(a.of)); if (B && a.cells.some((k) => B.cells.some((j) => Math.max(Math.abs(k % m.W - j % m.W), Math.abs(Math.floor(k / m.W) - Math.floor(j / m.W))) < D.ARCH.plateau.chasm.alt.off))) out.push(`${tag}: the second bridge within ${D.ARCH.plateau.chasm.alt.off} cells of the first`); } }
      if (n && alt * 2 < n) out.push(`magma chasm: a way round a bridge of the walk on ${alt} of ${n} floors`);
      if (!isl) out.push('magma: no hoard\'s islet in 30 runs'); }
    for (const t of AR.types) if (!seen[t]) out.push(`floor type ${t} never turns up in 10 magma runs`);
    // the mix (TASKS 426): a lake, river or terrace floor over the chasm: it turns up in the runs, and on each figure a floor holds
    // the figure's own checks that the chasm could break (a walk to the stairs, a lava share, two bridges, every plateau in reach, the lake's islands)
    if (!mixed) out.push('no mixed floor in 10 magma runs');
    return out;
  }
  function floorBlendCheck() {
    const out = [], AR = D.ARCH.plateau;
    for (const ft of AR.blend.over) for (let sd = 1; sd <= 5; sd++) for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd, ftype: ft, ftype2: AR.blend.with }), tag = `mixed ${ft}+${m.ftype2} ${sd} f${f}`, W = m.W;
      if (m.ftype !== ft || m.ftype2 !== AR.blend.with) { out.push(`${tag}: came out as ${m.ftype}+${m.ftype2}`); continue; }
      const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), lost = DG.narrowTo(m.cells, W, m.H, s0, m.rooms.filter((r) => r.type !== 'secret').map((r) => r.cy * W + r.cx));
      if (lost.length) out.push(`${tag}: ${lost.length} plateau cells out of reach of a body two cells wide`);
      const pth = (AR[ft].path || AR.path)[f - 1] * AR.blend.pathKeep * 0.9; if (m.walk < pth)   // (0.9: tryGen's last attempts relax the walk to that share)
       out.push(`${tag}: the walk to the stairs is ${m.walk}, ${pth} at least`);
      const sh = m.lava / (m.cells.filter((c) => c === 1).length + m.lava); if (sh < m.shareOf[0] || sh > m.shareOf[1]) out.push(`${tag}: lava is ${Math.round(sh * 100)} % of floor and lava`);
      const br = m.crossings.filter((c) => c.chasm).length, need = ft === 'river' ? AR.blend.riverBridges : 2; if (br < need) out.push(`${tag}: ${br} bridges over the chasm`);
      if (!m.cells.some((c, k) => c === 0 && Math.floor(k / W) >= m.cliff[k % W] && [1, -1, W, -W].some((o) => m.cells[k + o] === 1))) out.push(`${tag}: no chasm by the plateaus`);
      if (ft === 'lake' && m.rooms.filter((r) => r.isle).length < 2) out.push(`${tag}: fewer than two islands in the lake`);
}
    // taking the stairs from every floor of a run onto the next, whatever its type (a step that read the floor it left crashed on a
    // floor with no crust)
    for (let sd = 1; sd <= 6; sd++) { const Z = spawn(0, {}); Z.run = newRun(Z, 'magma', sd); Z.screen = 'play'; const R2 = Z.run;
      try { for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = R2.map; R2.en = []; R2.hero.x = m.exit.x; R2.hero.y = m.exit.y; R2.msg = null;
          for (let i = 0; i < 30 && R2.floor === f; i++) step(Z, { keys: i % 10 === 0 ? ['KeyE'] : [] });
          if (R2.floor !== f + 1) { out.push(`magma run ${sd}: the stairs of floor ${f} (${m.ftype}) do not take the hero down`); break; }
          for (let i = 0; i < 60; i++) step(Z, { keys: [] }); } }
      catch (e) { out.push(`magma run ${sd}: taking the stairs threw ${e.message}`); } }
    // the magma caves' packs (TASKS 412): each floor brings its own kinds — none of the 2nd's on the 1st, none of the 3rd's on the 2nd
    const by = [{}, {}, {}]; for (let sd = 1; sd <= 10; sd++) for (let f = 1; f <= 3; f++) for (const e of DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }).enemies) if (!e.guard) by[f - 1][e.type] = 1;
    for (const [t, f0] of Object.entries(D.BIOMES.magma.from)) { if (f0 > 3) continue; if (!by[f0 - 1][t]) out.push(`magma: no ${t} on the ${f0}th floor it comes on`); if (f0 > 1 && by[f0 - 2][t]) out.push(`magma: a ${t} before the ${f0}th floor`); }
    return out; }
  // the magma caves' side ways (TASKS 433): on every floor but the boss's two dead ends off the way to the stairs and more, a ledge
  // always one, each holding a reward (a chest, an altar, an elite or a cache dug from it); no elite on the way but the stairs' own,
  // and two thirds of the floor's rewards and more off it
  function branchCheck() {
    const out = [];
    for (let sd = 1; sd <= 10; sd++) for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f} (${m.ftype})`, q = DG.rewardsOf(m);
      const deg = m.rooms.map(() => 0); for (const [a, b] of m.edges) { deg[a]++; deg[b]++; }
      // (TASKS 1158: a chasm's second bridge joins up what were dead ends; its way round, with its chest, is the side way there)
      if (q.ends.length < 2 && !m.crossings.some((c) => c.alt)) out.push(`${tag}: ${q.ends.length} dead ends off the way`);
      for (const r of q.bare) out.push(`${tag}: a dead end off the way with no reward (room ${r.id})`);
      for (const r of m.rooms) if (r.kind === 'ledge' && deg[r.id] !== 1) out.push(`${tag}: a ledge on ${deg[r.id]} ways (room ${r.id})`);
      if (q.onWay * 3 > q.list.length) out.push(`${tag}: ${q.onWay} of ${q.list.length} rewards on the way`);
      const el = q.list.filter((w) => w.kind === 'elite' && q.way.has(w.room)).length; if (el) out.push(`${tag}: ${el} elites on the way`); }
    return out; }
  // the magma caves' hazards (TASKS 406): as many on each floor as HAZ.n has (more each floor to the 3rd), every one HAZ.clear cells
  // off the start's fire, the spawn, the stairs, chests, monsters' posts and the altar, a vent on 3×3 of floor a cell off the lava;
  // the warning comes HAZ.warn s before the burst, which hurts the hero (a vent sets him alight) and a monster in its ring once a
  // cycle, and nobody outside it
  // a run on a plain plateau floor for the checks of the plateaus' lava, chasm, crust and hazards (TASKS 426: a run's first floor
  // is a lava cave): run 3's first plain floor, else the next run's
  // the magma caves' new kinds (TASKS 407–409), by a river of lava on a plain floor: a bank, three cells of open lava, the far bank
  function magmaKindsCheck() {
    const out = [], Z = spawn(0, {}); Z.screen = 'play'; let sp = null, LW = 3;
    // the floor a bank cell reaches within eight cells round: a pocket of lava inside one plateau has its two sides joined
    const bankOf = (m, x0, y0) => { const W = m.W, got = new Set([y0 * W + x0]); for (const k of got) for (const o of [1, -1, W, -W]) { const n = k + o, x = n % W, y = Math.floor(n / W);
      if (Math.abs(x - x0) <= 8 && Math.abs(y - y0) <= 8 && cell(m, x, y) === 1) got.add(n); } return got; };
    // (the first magma floor with such a crossing, seed by seed)
    for (let sd = 3; sd < 40 && !sp; sd++) { Z.run = newRun(Z, 'magma', sd); for (let f = 1; f < D.RUNS.magma.floors && !sp; f++) { enterFloor(Z, Z.run, f); const m = Z.run.map, W = m.W; if (m.ftype2) continue;
      const lav = (x, y) => cell(m, x, y) === 3 && !crustAt(m, y * W + x), fl = (x, y) => cell(m, x, y) === 1;
      for (let k = 3; k >= 2 && !sp; k--) for (let y = 3; y < m.H - 3 && !sp; y++) for (let x = 3; x < W - 9 && !sp; x++)
        if ([-2, -1, 0].every((i) => [-1, 0, 1].every((j) => fl(x + i, y + j))) && Array.from({ length: k }, (_, i) => i + 1).every((i) => [-1, 0, 1].every((j) => lav(x + i, y + j))) && [k + 1, k + 2].every((i) => [-1, 0, 1].every((j) => fl(x + i, y + j))) && !bankOf(m, x, y).has(y * W + x + k + 1)) { sp = [x, y]; LW = k; } } }
    if (!sp) return ['magma kinds: no river two or three cells wide with banks on any magma floor'];
    const R = Z.run, m = R.map, h = R.hero, W = m.W, t = () => Z.t, lav = (x, y) => cell(m, x, y) === 3 && !crustAt(m, y * W + x); R.msg = null;
    const haz = m.hazards; m.hazards = []; m.traps = [];   // (no vent, rock or spike in the way of what is measured, and no blow dodged)
    const agi = h.base.agi; h.base.agi = 0; h.eq = Object.fromEntries(Object.keys(h.eq).map((k) => [k, null]));
    const X = (i) => (sp[0] + i + 0.5) * TILE, Y = (sp[1] + 0.5) * TILE + 4, steps = (s, f) => { for (let i = 0; i < 120 * s; i++) { step(Z, { keys: [] }); if (f && f()) return true; } return false; };
    const put = (hx = X(-1)) => { R.en = []; R.proj = []; R.fires = []; h.hp = heroSt(Z).maxHp; h.deadT = -1; h.burn = 0; h.ifr = 0; h.x = hx; h.y = Y; h.vx = h.vy = 0; h.dashT = -9; };
    const mk = (type, x, y, o) => { const E = ENEMIES[type], e = Object.assign({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp: E.hp * 3, max: E.hp * 3, dmg: 6, elite: 0, room: -1, st: 'chase', t0: t(), face: -1, aimA: Math.PI,
      cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: t(), hx: x, hy: y }, o); R.en.push(e); return e; };
    // the imp: a spark from range hurts and burns; one beside it leaps away; knocked into the lava it doesn't sink and leaps out;
    // on the hero's bank it leaps over the lava to the far one, where he can't walk to it
    { put(); const a = h.hp, i1 = mk('imp', X(-1) - 200, Y, { leapT: 1e9, lookT: 1e9 }); steps(3, () => h.hp < a);
      if (!(h.hp < a)) out.push('an imp in range never hurts the hero with its spark'); else if (!(h.burn > t())) out.push("an imp's spark does not set the hero burning"); void i1;
      put(); const i2 = mk('imp', X(-1) - 40, Y, { cdT: 1e9 }); let leapt = 0; steps(1.5, () => { if (i2.st === 'leap') leapt = 1; return leapt && i2.st === 'chase'; });
      if (!leapt) out.push('an imp beside the hero does not leap away'); else if (Math.hypot(i2.x - h.x, i2.y - h.y) < ENEMIES.imp.flee) out.push('an imp leaps away and lands still beside the hero');
      put(X(-3)); const i3 = mk('imp', X(Math.ceil(LW / 2)), Y, { cdT: 1e9 }); steps(1.5);
      if (i3.sinkT !== undefined || i3.deadT >= 0) out.push('an imp in the lava sinks or burns'); else if (cell(m, Math.floor(i3.x / TILE), Math.floor(i3.y / TILE)) !== 1) out.push('an imp in the lava stays in it');
      put(X(-2)); const i4 = mk('imp', X(-2) + 70, Y + 20, { cdT: 1e9, leapT: 0, lookT: 0 }); let over = 0; const F0 = () => flow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE));
      // (the far bank: floor the hero's bank doesn't reach within eight cells round; past a bend it lies lower down the river too)
      const near = bankOf(m, sp[0], sp[1]), far = () => { const x = Math.floor(i4.x / TILE), y = Math.floor(i4.y / TILE); return cell(m, x, y) === 1 && !near.has(y * W + x); };
      steps(4, () => { if (i4.st === 'leap' && lav(Math.floor(i4.x / TILE), Math.floor(i4.y / TILE))) over = 1; h.x = X(-2); h.y = Y; return over && i4.st === 'chase' && far(); }); void F0;
      if (!over) out.push('an imp on the hero\'s bank never leaps over the lava'); else if (!far()) out.push('an imp leaps out over the lava and does not land on the far bank'); }
    // the salamander: in the lava by the bank it comes for the hero and hurts him, never burning in it; its breath burns one in its
    // cone and spares one who stepped out of it; its fire on the floor burns; hurt, it swims back and heals, not while hit
    { put(X(-2)); const a = h.hp, s1 = mk('salamander', X(Math.ceil(LW / 2)), Y, { fa: Math.PI }); let out1 = 0; steps(6, () => { if (!onLava(m, s1)) out1 = 1; return h.hp < a; });
      if (s1.sinkT !== undefined || s1.hp < s1.max) out.push('a salamander burns in the lava'); if (!(h.hp < a)) out.push('a salamander by the bank never hurts the hero'); void out1;
      for (const stay of [1, 0]) { put(X(-2)); const B = ENEMIES.salamander.breath, s2 = mk('salamander', X(-2) - 110, Y, { fa: 0, aimA: 0, brT: 0 }); let lit = -1, a2 = h.hp, early = 0;
        // (out of the cone: off its side on whole floor, beyond its bite)
        const side = [[0, 120], [0, -120], [-40, 120], [-40, -120]].map(([dx, dy]) => [s2.x + dx, s2.y + dy]).find(([x, y]) => cell(m, Math.floor(x / TILE), Math.floor(y / TILE)) === 1 && cell(m, Math.floor(x / TILE), Math.floor((y - 20) / TILE)) === 1) || [s2.x, s2.y + 120];
        steps(2.5, () => { if (lit < 0 && s2.st === 'wind' && s2.br) lit = t(); if (!stay && lit >= 0) { h.x = side[0]; h.y = side[1]; h.vx = h.vy = 0; } if (lit >= 0 && t() - lit < B.wind - DT && h.hp < a2) early = 1; return lit >= 0 && t() > lit + B.wind + B.t; });
        if (lit < 0) { out.push('a salamander in reach never breathes fire'); break; }
        if (early) out.push("a salamander's breath burns before its wind-up is out");
        if (stay && !(h.hp < a2 && h.burn > t() - 0.5)) out.push("a salamander's breath does not burn the hero in its cone"); if (!stay && h.hp < a2) out.push("a salamander's breath burns a hero out of its cone"); }
      put(); const a3 = h.hp; addFire(R, Z, h.x, h.y, { src: 0, who: 'salamander', r: 30, ry: 0.6, t: 2.4, dmg: 5, per: 1, kind: 'trail' }); steps(0.2);
      if (!(h.hp < a3) || !(h.burn > t())) out.push("a salamander's fire on the floor does not burn the hero in it");
      put(X(-5)); const s3 = mk('salamander', X(-1), Y, { fa: 0 }); s3.hp = Math.round(s3.max * 0.4); const hp0 = s3.hp; let soaked = 0;
      steps(6, () => { h.x = X(-8); h.y = Y; if (s3.st === 'soak' && onLava(m, s3)) soaked = 1; return soaked && s3.hp > s3.max * 0.55; });
      if (!soaked) out.push('a salamander under half its health does not go back into the lava'); else if (!(s3.hp > hp0)) out.push('a salamander in the lava does not heal');
      if (soaked && s3.st === 'soak') { const v = s3.hp; hitEnemy(Z, R, s3, 1, false, s3.x, s3.y, 0); const v1 = s3.hp; steps(0.8, () => { h.x = X(-8); h.y = Y; }); if (s3.hp > v1 + 0.5) out.push('a salamander heals in the lava while it is being hit'); void v; } }
    // the golem: its first blows only take its crust off, then blows land whole; the crust grows back with the hero away and no blow
    // landing; its slam hurts the hero before it and spares one who stepped back; dead, its pool burns him
    { put(X(-6)); const C = ENEMIES.golem.crust, g = mk('golem', X(-6) - 60, Y, { cdT: 1e9, hp: 400, max: 400 }), took = [];
      for (let i = 0; i <= C.n; i++) { const v = g.hp; hitEnemy(Z, R, g, 40, false, h.x, h.y); took.push(v - g.hp); }
      if (took.slice(0, C.n).some((d) => d !== Math.round(40 * C.k)) || took[C.n] !== 40) out.push(`a golem's blows through its crust took ${took.join('/')}, not ${Math.round(40 * C.k)} × ${C.n} then 40`);
      // (calm at its post: one walking after the hero stepped on a spike plate, a blow all the same)
      put(X(-6)); R.en = [g]; Object.assign(g, { x: X(-2), y: Y, hx: X(-2), hy: Y, st: 'idle', calmT: 1e9 }); g.hitT = g.blowT = t(); let grew = 0; steps(C.calm + 3 * C.regrow, () => { h.x = g.x + 340; h.y = g.y; if ((g.crust ?? C.n) > 0) grew = 1; return grew; });
      if (!grew) out.push("a golem's crust never grows back with the hero away");
      for (const stay of [1, 0]) { put(X(0)); const g2 = mk('golem', X(-2), Y, { cdT: 0 }); let w = -1, a = h.hp;
        steps(3, () => { if (w < 0 && g2.st === 'wind') w = t(); if (!stay && w >= 0) { h.x = g2.x - 2 * TILE; h.y = g2.y - 3 * TILE; } else if (stay) { h.x = X(0); h.y = Y; } h.vx = h.vy = 0; return w >= 0 && g2.st === 'chase'; });
        if (w < 0) { out.push('a golem beside the hero never slams'); break; } if (stay && !(h.hp < a)) out.push("a golem's slam does not hurt the hero before it"); if (!stay && h.hp < a) out.push("a golem's slam hurts a hero who stepped back"); }
      put(X(-1)); const g3 = mk('golem', X(-1), Y, { cdT: 1e9, st: 'idle', calmT: 1e9 }); g3.hp = 1; g3.crust = 0; hitEnemy(Z, R, g3, 10, false, h.x - 30, h.y); const pool = (R.fires || []).find((p) => p.kind === 'pool');
      if (!pool) out.push('a golem falls without a pool of lava'); else { const a = h.hp; steps(ENEMIES.golem.pool.arm * 0.8); if (h.hp < a) out.push("a golem's pool burns its killer before he can step out");
        steps(ENEMIES.golem.pool.arm * 0.2 + 0.3); if (!(h.hp < a)) out.push("a golem's pool does not burn the hero in it");
        steps(ENEMIES.golem.pool.t); if (R.fires.includes(pool)) out.push("a golem's pool never cools"); } }
    // a burning hero beats the flames out with a dash (TASKS 463)
    { put(); h.burn = t() + 3; h.cd.dash = 0; Z.ev = []; step(Z, { keys: ['Space'] }); if (h.burn > t() || !Z.ev.some((e) => e.k === 'snuff')) out.push('a dash does not put out a burning hero'); }
    m.hazards = haz; h.base.agi = agi; return out;
  }
  // a table stops the hero walking into it; a blow on it (or on a brazier) knocks once per swing and carries its material
  function propCheck() {
    const out = []; let S = null, d = null, di = -1;
    for (let sd = 1; sd < 80 && !d; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', 7000 + sd); const m = S.run.map;
      di = m.decor.findIndex((o) => { const x = Math.floor(o.x / TILE), y = Math.floor(o.y / TILE); return o.n === 'table' && [1, 2].every((k) => cell(m, x - k, y) === 1 && !m.block.includes(y * m.W + x - k)); }); d = m.decor[di]; }
    if (!d) return ['prop check: no table with open floor on its left in 80 seeds'];
    S.screen = 'play'; const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9;
    if (!d.solid) out.push('prop check: a table is not solid');
    const A = () => ({ ...toPx(R, d.x, d.y - 30) });
    h.x = d.x - 50; h.y = d.y; let close = 99;
    for (let k = 0; k < 120; k++) { step(S, Object.assign({ right: 1, keys: [] }, A())); close = Math.min(close, d.x - h.x); }
    if (close < 18) out.push(`prop check: the hero walks ${(18 - close).toFixed(0)} px into a table`);
    const swing = () => { h.x = d.x - 40; h.y = d.y; h.cd.atk = 0; step(S, Object.assign({ press: 1, keys: [] }, A())); for (let k = 0; k < 40; k++) { h.x = d.x - 40; h.y = d.y; step(S, Object.assign({ keys: [] }, A())); } };
    S.ev = []; swing(); const hits = S.ev.filter((e) => e.k === 'prop' && e.i === 'd' + di);
    if (hits.length !== 1) out.push(`prop check: a swing at a table knocks it ${hits.length} times`);
    else if (hits[0].mat !== 'wood' || hits[0].s !== 1) out.push(`prop check: a table knocked from the left reads ${hits[0].mat} / ${hits[0].s}`);
    const m = R.map, bi = m.torches.findIndex((t2) => t2.kind === 'brazier');
    if (bi >= 0) { const b = m.torches[bi]; S.ev = []; hitProps(S, R, b.x + 30, b.y, 40);
      if (!S.ev.some((e) => e.k === 'prop' && e.i === 't' + bi && e.mat === 'metal' && e.s === -1)) out.push('prop check: a blow from the right does not knock the brazier'); }
    return out;
  }
  // the floor modifiers (TASKS 381): drawn only on the rooms floors 3, 5 and 7 of the campaign and the descent's rooms floors past the
  // 2nd that are no boss's, about half of them, each of the five, no flood on the fire floors; each one does what it says over the
  // same floor laid without it; the banner names it; gold and a hoard's ambush answer it in the sim
  function floorModCheck() {
    const out = [], ids = Object.keys(D.FLOOR_MODS), got = {}; let on = 0, may = 0;
    for (let sd = 1; sd <= 200; sd++) for (let f = 1; f <= D.RUNS.campaign.floors; f++) { const st = D.stageOf('campaign', f, sd);
      if (st.mod !== D.stageOf('campaign', f, sd).mod) out.push(`floor mod: campaign ${sd}/${f} draws another modifier the second time`);
      const can = f >= D.FLOOR_MOD.from && !st.boss && !st.arch && f <= D.RUNS.campaign.chapter;
      if (st.mod && !can) out.push(`floor mod: campaign ${sd}/${f} has «${st.mod}» on a floor that takes none`);
      if (st.mod && (D.FLOOR_MODS[st.mod].not || []).includes(st.biome)) out.push(`floor mod: campaign ${sd}/${f} has «${st.mod}» in ${st.biome}`);
      if (st.mod && (D.FLOOR_MODS[st.mod].notLay || []).includes(st.lay)) out.push(`floor mod: campaign ${sd}/${f} has «${st.mod}» on a ${st.lay} floor`);
      if (can) { may++; if (st.mod) { on++; got[st.mod] = 1; } } }
    if (on < may * 0.4 || on > may * 0.6) out.push(`floor mod: ${on} of ${may} campaign floors drew one, not about half`);
    for (const k of ids) if (!got[k]) out.push(`floor mod: «${k}» never drawn on 200 campaign runs`);
    for (let sd = 1; sd <= 40; sd++) for (let f = 1; f <= 24; f++) { const st = D.stageOf('endless', f, sd); if (st.mod && (st.boss || st.arch || f < D.FLOOR_MOD.from)) out.push(`floor mod: descent ${sd}/${f} has «${st.mod}» on a boss's, cave's or early floor`); }
    // the banner never names a modifier its floor lacks (PR 30: campaign 24/3 drew «flood» and laid no stream), and few floors lose theirs
    const held = { flood: (m) => m.waterFeatures.length > 0, lair: (m) => m.chests.some((c) => c.lair), cursed: (m) => m.traps.some((t) => t.run !== undefined) };
    { let drew = 0, lost = 0; for (let sd = 1; sd <= 60; sd++) for (const f of [3, 5, 7]) { const st = D.stageOf('campaign', f, sd); if (!st.mod) continue;
        const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd }); drew++; if (!m.mod) { lost++; continue; }
        if (m.mod !== st.mod || (held[m.mod] && !held[m.mod](m))) out.push(`floor mod: campaign ${sd}/${f} names «${m.mod}» and does not have it`); }
      if (lost > drew * 0.05) out.push(`floor mod: ${lost} of ${drew} campaign floors laid without their modifier`); }
    const gen = (sd, f, mod) => DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd, stage: { mod } });
    const sum = (mod, fn) => { let n = 0; for (let sd = 1; sd <= 6; sd++) for (const f of [3, 7]) n += fn(gen(sd, f, mod), sd, f); return n; };
    const walls = (m) => m.torches.filter((t) => t.kind === 'wall').length, rows = (m) => new Set(m.traps.filter((t) => t.run !== undefined).map((t) => t.run)).size;
    const elites = (m) => m.enemies.filter((e) => e.elite).length;
    if (sum('flood', (m) => m.waterFeatures.length) < 1.5 * sum(undefined, (m) => m.waterFeatures.length)) out.push('floor mod: a flooded floor has not half as many streams again');
    { const d = sum('dark', walls), b = sum(undefined, walls); if (d < 0.25 * b || d > 0.55 * b) out.push(`floor mod: a dark floor keeps ${d} of ${b} wall torches, not about 40 %`); }
    sum('lair', (m, sd, f) => { const b = gen(sd, f, undefined); if (elites(m) !== elites(b) + D.FLOOR_MODS.lair.elites) out.push(`floor mod: lair ${sd}/${f} has ${elites(m)} elites over ${elites(b)}`);
      if (!m.chests.some((c) => c.lair && c.tier === D.FLOOR_MODS.lair.chest)) out.push(`floor mod: lair ${sd}/${f} has no chest of the top tier`); return 0; });
    if (sum('cursed', rows) < 2 * Math.max(1, sum(undefined, rows))) out.push('floor mod: a cursed floor has not the plate rows of all its long corridors');
    if (sum('quiet', (m) => m.enemies.length) > 0.8 * sum(undefined, (m) => m.enemies.length)) out.push('floor mod: a quiet floor holds not about 30 % fewer monsters');
    { const m = gen(1, 3, 'quiet'); if (m.mod !== 'quiet' || !D.placeName(3, 'campaign', 1, 1, m).includes(D.FLOOR_MODS.quiet.name)) out.push('floor mod: the banner does not name the modifier'); }
    // gold picked up, and a hoard's chest springing its ambush on a draw between its plain chance and the doubled one
    const run = (mod) => { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77); S.screen = 'play'; const R = S.run; for (const e of R.en) { e.st = 'idle'; e.x += 5000; e.hx = e.x; } R.map.mod = mod; return [S, R]; };
    for (const mod of [undefined, 'cursed']) { const [S, R] = run(mod), h = R.hero, g0 = h.gold, want = Math.round(100 * heroSt(S).gold * ((D.FLOOR_MODS[mod] || {}).gold || 1));
      R.drops.push({ kind: 'gold', x: h.x, y: h.y, n: 100, id: R.nextId++ }); for (let i = 0; i < 5; i++) step(S, { keys: [] });
      if (h.gold - g0 !== want) out.push(`floor mod: gold picked up on a ${mod || 'plain'} floor is ${h.gold - g0}, not ${want}`); }
    for (const mod of [undefined, 'quiet']) { const [S, R] = run(mod), h = R.hero, room = DG.roomAt(R.map, h.x, h.y), was = R.map.rooms[room].type;
      let rs = 1; for (; rs < 1e6; rs++) { const v = rnd({ rs }); if (v > 0.06 && v < 0.09) break; }
      R.map.rooms[room].type = 'secret'; R.rs = rs; S.ev = []; openChest(S, R, { x: h.x, y: h.y, tier: 1, open: 0, loot: [] }); R.map.rooms[room].type = was;
      if (S.ev.some((e) => e.k === 'ambush') !== !!mod) out.push(`floor mod: a cache's chest on a ${mod || 'plain'} floor ${mod ? 'does not spring' : 'springs'} an ambush on a draw of 0.06–0.09`); }
    return out;
  }
  // the generator's print (TASKS 1917): a kept floor is a diff against its rebuild, so floors laid otherwise under the same
  // D.GEN_VERSION patch the wrong floor; a change to what the generator lays needs a new version and its print here
  const GEN_PRINT = { 34: 'b7a355cecbaeeced' };
  function genPrintCheck() { const h = require('crypto').createHash('sha1');
    for (const mode of Object.keys(D.RUNS)) for (const sd of [1, 586791]) for (let f = 1; f <= (mode === 'campaign' ? 8 : 3); f++) h.update(JSON.stringify(DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode, runSeed: sd, from: 1, town: mode === 'campaign' ? 1 : 0 })));
    h.update(JSON.stringify(DG.genTown(31))); const p = h.digest('hex').slice(0, 16);
    return p === GEN_PRINT[D.GEN_VERSION] ? [] : [`gen print: the generator lays other floors (${p}) under D.GEN_VERSION ${D.GEN_VERSION}: raise the version and put the print in GEN_PRINT`]; }
  SIMX.checks.add('genCheck', genCheck, { slow: true });
  SIMX.checks.add('cacheGenCheck', cacheGenCheck, { slow: true });
  SIMX.checks.add('floorTypeCheck', floorTypeCheck, { slow: true });
  SIMX.checks.add('floorBlendCheck', floorBlendCheck);
  SIMX.checks.add('branchCheck', branchCheck, { slow: true });
  SIMX.checks.add('magmaKindsCheck', magmaKindsCheck);
  SIMX.checks.add('propCheck', propCheck);
  SIMX.checks.add('floorModCheck', floorModCheck, { slow: true });
  SIMX.checks.add('genPrintCheck', genPrintCheck);
})(typeof window !== 'undefined' ? window : globalThis);
