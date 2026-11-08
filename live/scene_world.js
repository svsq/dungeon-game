// live/scene_world.js — the world pass of a frame: the baked map, lava, water, crossings, decals, then the Y-sorted band (props, monsters, the hero, loot, fires, doors, secrets).
// A pass of SC.render (ARCHITECTURE.md §4.3): it reads the frame's shared values from F and leaves there what later passes use.
(function () {
  const SCX = window.SCX, {
    ARROW_H, BAKE, BLOOD, BRIDGE, CANDLE, D, DECK, DEDGE, DOOR, FALL_DROP, FOLK0, GLOW, GOLD_TINT, HERO, L, M, OCC_SOLIDS, PIX, PROP_BAS,
    PROP_H, SC, SRC_DIR, SRC_KIND, SS, STAND, SZ, TABLE_WICKS, TAU, TILE, TOP_LIFT, TRAP_HOLE, TRAP_SPIKE, WET, cliffTex, crustTex,
    deathOf, deepTex, drawDrop, drawEnemy, drawFolk, drawHero, drawProp, emitted, fallU, knockOf, lavaGlowTex, lavaTex, lavaUnder, openTex,
    rnd, sinkOf, topTint, torchCol, waterTex, zoneAt } = SCX;
  SCX.worldPass = (F) => {
    const {
      B, GT, MH, MW, R, ST, TL, blastFx, cx, cy, fireFx, flick, h, hid, known, m, seen, st, sx, sy, t, vis, whirlFx } = F;
    // ===== ground: the baked map, then decals =====
    L.beginBG([0, 0, 0, 1]);
    // only the part of the view that lies on the map (sampling past its edge smears the edge texels into stripes)
    { const x0 = Math.max(0, cx), y0 = Math.max(0, cy), x1 = Math.min(MW, cx + SCX.VW), y1 = Math.min(MH, cy + SCX.VH);
      if (x1 > x0 && y1 > y0) L.sprite('map', x0 - cx, y0 - cy, { w: x1 - x0, h: y1 - y0, src: [x0 / MW, 1 - y0 / MH, x1 / MW, 1 - y1 / MH] }); }
    L.beginComp();
    // lava about to break through (TASKS 233): over the whole warning the cell darkens to crust, its cracks spread and glow
    // (emissive pass below) and it lights the floor, so the next tongue reads before it lands
    const warnOf = (q) => SS(0, 1, (GT - (q.t0 ?? q.t - 1.1)) / Math.max(0.1, q.t - (q.t0 ?? q.t - 1.1)));
    for (const q of R.lavaPending || []) { const x = (q.cell % m.W) * TILE + 16, y = Math.floor(q.cell / m.W) * TILE + 16; if (!vis(x, y) || !known(x, y)) continue;
      const u = warnOf(q); L.solid(sx(x - 16), sy(y - 16), TILE, TILE, [0.06, 0.03, 0.025], 0, 0, 0, 0.55 * u); L.cracks(sx(x), sy(y), 12 + 14 * u, 0.17 * u, q.cell, 0); }
    // lava (animated, also emissive later): the crust drifts
    const lavaCells = [];
    if (m.lava) for (let y = Math.floor(cy / TILE) - 1; y <= Math.floor((cy + SCX.VH) / TILE) + 1; y++) for (let x = Math.floor(cx / TILE) - 1; x <= Math.floor((cx + SCX.VW) / TILE) + 1; x++) if (SIM.Q.cell(m, x, y) === 3 || lavaUnder(m).has(y * m.W + x)) lavaCells.push([x, y]);
    // the magma caves' lava lights whoever stands by it from its side (TASKS 404): a lit edge on the actor toward the river, in
    // the lava's colour; one light every other cell, beating slowly as the lava's own light does
    const lavaBeat = (x, y) => 0.8 + 0.2 * Math.sin(t * 0.55 + x * 0.31 + y * 0.17);
    const LV = m.cliff ? lavaCells.filter(([x, y]) => (x + y) % 2 === 0).map(([x, y]) => [x * TILE + 16, y * TILE + 16, 170, [1, 0.45, 0.12], 0.6 * lavaBeat(x, y)]) : [];
    HERO.lavaAt = (px, py) => { let bx = 0, by = 0, w = 0;
      for (const [x, y, r, , amt] of LV) { const d = Math.hypot((px - x) / r, (py - 40 - y) / (0.8 * r)); if (d >= 1) continue;
        const s2 = amt * Math.exp(-d * d * 2.2) * SS(1, 0.7, d), dx = x - px, dy = y - (py - 40), n = Math.hypot(dx, dy) || 1; bx += dx / n * s2; by += dy / n * s2; w += s2; }
      return w ? { dx: bx / w, dy: by / w, col: [1, 0.45, 0.12], k: Math.min(1.2, w) } : null; };
    // by the lava he is lit as by a fire: his own lamp and key light give way to it, or its light on top of theirs blows him out
    if (LV.length) { const lk = HERO.lavaAt(h.x, h.y); if (lk) { HERO.k = Math.max(HERO.k, Math.min(1, lk.k * 0.8)); HERO.lift = 0.85 + 0.1 * HERO.k; } }
    // the crust giving under a weight, melted, setting again (sim m.melt), the nearest the hero first: its cracks light the floor
    const melt = []; for (const key in m.melt || {}) { const q = m.melt[key], k = +key, x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE; if (!vis(x, y)) continue;
      const ck = q.crackT === undefined ? 0.35 * Math.min(1, q.on / SIM.CRUST.stand) : q.setT !== undefined ? 1 - SS(0, SIM.CRUST.set, GT - q.setT) : q.hot ? 1 : 0.35 + 0.65 * SS(0, SIM.CRUST.crack, GT - q.crackT);
      const mt = q.hot ? SS(0, 0.2, GT - q.meltT) : q.setT !== undefined ? 1 - SS(0, SIM.CRUST.set, GT - q.setT) : 0;
      melt.push([x, y, ck, mt, Math.hypot(x - R.hero.x, y - R.hero.y)]); }
    melt.sort((a, b) => a[4] - b[4]); melt.length = Math.min(8, melt.length);
    for (const [x, y, ck, mt] of melt) if (ck > 0.3) TL.push([x, y, 70 + 50 * mt, [1, 0.45, 0.12], 0.25 * ck + 0.35 * mt]);
    while (melt.length < 8) melt.push([-1e4, -1e4, 0, 0, 0]);
    // lava is ground (anyone can stand in it now, so it draws under them); its own short strong lights keep it glowing after lighting
    let lavaXf = null; const lavaU = (mode) => ({ u_t: t, u_mask: mode === 1 && m.lavaUnder && m.lavaUnder.length ? lavaGlowTex(m) : lavaTex(m), u_crust: crustTex(m), u_melt: melt.flatMap((q) => q.slice(0, 4)), u_seen: seen, u_box: lavaBox, u_map: [MW, MH], u_mode: mode, u_scorch: m.cliff ? 0 : 1, u_face: BAKE.face || seen, u_occ: SCX.LT.occ });
    let lavaBox = null; const lavaP = () => (m.cliff ? L.P.mlava : L.P.lava);
    if (lavaCells.length) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of lavaCells) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      lavaBox = [(x0 - 1) * TILE, (y0 - 1) * TILE, (x1 - x0 + 3) * TILE, (y1 - y0 + 3) * TILE]; lavaXf = G.xf(sx(lavaBox[0]), sy(lavaBox[1]), lavaBox[2], lavaBox[3]);
      G.draw(lavaP(), lavaU(0), lavaXf); G.blend('emit'); G.draw(lavaP(), lavaU(2), lavaXf); G.blend(); }
    const waterRooms = new Map(), caveW = !!B.cave;
    // a cave's water runs through the rock between its halls: one pass over the whole view, unclipped. The fires it reflects are
    // the ones over the view taken in map order, not by distance to the camera, so a reflection never pops as the camera moves
    if (caveW && (m.water.length || m.deep)) { const box = [Math.floor(cx / TILE - 1) * TILE, Math.floor(cy / TILE - 1) * TILE, SCX.VW + 3 * TILE, SCX.VH + 3 * TILE];
      const fires = TL.filter((f) => f[0] > box[0] - 40 && f[0] < box[0] + box[2] + 40 && f[1] + 44 > box[1] - 80 && f[1] + 44 < box[1] + box[3] + 80).sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, 16);
      while (fires.length < 16) fires.push([0, 0, 0, [0, 0, 0], 0]);
      const cwU = { u_t: t, u_mask: waterTex(m), u_deep: deepTex(m), u_box: box, u_map: [MW, MH],
        u_fire: fires.flatMap((f) => [f[0], f[1], f[2], f[4]]), u_fireCol: fires.flatMap((f) => f[3]) }, cwX = G.xf(sx(box[0]), sy(box[1]), box[2], box[3]);
      G.draw(L.P.cavewater, Object.assign(cwU, { u_emit: 0 }), cwX); G.blend('emit'); G.draw(L.P.cavewater, Object.assign(cwU, { u_emit: 1 }), cwX); G.blend(); }
    if (!caveW) for (const k of m.water || []) {
      const x = k % m.W, y = Math.floor(k / m.W), id = DUNGEON.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE);
      const b = waterRooms.get(id) || [x, y, x, y]; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); waterRooms.set(id, b);
    }
    for (const [id, [x0, y0, x1, y1]] of waterRooms) {
      if ((x1 + 2) * TILE < cx || (x0 - 1) * TILE > cx + SCX.VW || (y1 + 2) * TILE < cy || (y0 - 1) * TILE > cy + SCX.VH) continue;
      const waterBox = [(x0 - 1) * TILE, (y0 - 1) * TILE, (x1 - x0 + 3) * TILE, (y1 - y0 + 3) * TILE], room = m.rooms[id], b = D.BIOMES[room?.zone || m.biome];
      const fires = TL.slice().sort((a, b) => Math.hypot(a[0] - (x0 + x1) * TILE / 2, a[1] - (y0 + y1) * TILE / 2) - Math.hypot(b[0] - (x0 + x1) * TILE / 2, b[1] - (y0 + y1) * TILE / 2)).slice(0, 8);
      while (fires.length < 8) fires.push([0, 0, 0, [0, 0, 0], 0]);
      G.draw(L.P.pool, { u_t: t, u_mask: waterTex(m), u_deep: deepTex(m), u_box: waterBox, u_map: [MW, MH], u_col: b.water || [0.07, 0.1, 0.12],
        u_room: room ? [room.x * TILE, room.y * TILE, (room.x + room.w) * TILE, (room.y + room.h) * TILE] : [0, 0, MW, MH],
        u_fire: fires.flatMap((f) => [f[0], f[1], f[2], f[4]]), u_fireCol: fires.flatMap((f) => f[3]) }, G.xf(sx(waterBox[0]), sy(waterBox[1]), waterBox[2], waterBox[3]));
    }
    if (!caveW) for (const k of m.waterBridges || []) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE; if (!vis(x, y)) continue;
      const n = rnd(k, 3) < 0.35 ? 'water_stone_b' : 'water_stone_a', [w, hh] = SZ(n), jx = Math.round((rnd(k, 5) - 0.5) * 4) * 2;
      L.shadow(sx(x + jx), sy(y + hh / 2), w * 0.45, 4, 0.5); drawProp(n, sx(x + jx), sy(y) + hh / 2, { flip: rnd(k, 9) < 0.5, u: { grade: [0.85, 0.72, 0, 1] } }); }
    const wetSet = WET.get(m) || (WET.set(m, new Set(m.water)), WET.get(m));
    const dryCrossings = new Set((m.crossings || []).filter((c) => c.kind === 'bridge' || c.kind === 'ford').flatMap((c) => c.cells));
    const inWet = (x, y) => { const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE); return SIM.Q.cell(m, cx, cy) === 6 || wetSet.has(cy * m.W + cx); };
    const ev2 = (v) => Math.round(v / 2) * 2;
    // rings spreading slowly round whatever stands in the water
    const ripple = (x, y, r, sd, a = 0.28) => { for (let k = 0; k < 2; k++) { const ph = (t * 0.42 + k * 0.5 + rnd(sd, 3)) % 1, q = r * (0.55 + 0.9 * ph);
      L.ring(sx(x), sy(y), q, q * 0.38, [0.55, 0.82, 0.84], a * Math.sin(Math.PI * ph), 0.16); } };
    // a stream's water breaks white on a post or a stone it runs past
    const spray = (x, y, sd) => { const k = Math.floor(y / TILE) * m.W + Math.floor(x / TILE); if (m.waterFlow[k] === undefined) return;
      for (let j = 0; j < 4; j++) { const ph = (t * 1.4 + rnd(sd, j)) % 1; L.solid(ev2(sx(x) + (rnd(sd, j + 4) - 0.5) * 18), ev2(sy(y) - 2 - 7 * Math.sin(Math.PI * ph)), 2, 2, [0.8, 0.92, 0.92], 0, 0, 0, 0.7 * (1 - ph)); } };
    // a ford of flat stepping stones, one to a cell, each a little off the grid, the water ringing round it
    const fordStones = (c) => { for (const k of c.cells) { const n = rnd(k, 3) < 0.4 ? 'ford_b' : 'ford_a', [w, hh] = SZ(n), x = (k % m.W + 0.5) * TILE + ev2((rnd(k, 5) - 0.5) * 8), y = (Math.floor(k / m.W) + 0.5) * TILE + ev2((rnd(k, 6) - 0.5) * 6);
      ripple(x, y + 3, w * 0.55, k); L.shadow(sx(x), sy(y) + hh * 0.3, w * 0.5, 4, 0.45); drawProp(n, sx(x), sy(y) + hh * 0.55, { flip: rnd(k, 9) < 0.5 }); spray(x, y, k); } };
    // the magma caves' crossings (TASKS 401, art 448/451): stepping stones are the tops of basalt columns sunk in the lava, one to a
    // cell, a little off the grid, a hot line where the lava licks their foot; an arch over a narrow river flowing toward the camera
    // is the painted basalt arch, its opening over the river (the lava runs on under it), scaled to the river's width; one over a
    // river across the screen shows only its causeway of column tops
    const SLAB = ['slab_mg_a', 'slab_mg_b', 'slab_mg_c'], basaltOcc = [], INKC = [0.03, 0.025, 0.03]; PROP_BAS.length = 0; OCC_SOLIDS.length = 0; DECK.dy = 0; DECK.tgt = 0;
    const basaltSlabs = (c, cells = c.cells) => { for (const k of cells) { const n = SLAB[Math.floor(3 * rnd(k, 7))], [w, hh] = SZ(n);
      const x = (k % m.W + 0.5) * TILE + ev2((rnd(k, 5) - 0.5) * 8), y = (Math.floor(k / m.W) + 0.5) * TILE + ev2((rnd(k, 6) - 0.5) * 6), foot = ev2(sy(y) + hh * 0.5);
      // (the hot line only where the lava itself lies under its foot, shorter and off its middle, TASKS 1039: under every row of a
      // wide crossing it ruled the slabs into a cobbled road)
      L.shadow(sx(x), foot + 3, w * 0.55, 4, 0.7); if (!cells.includes(k + m.W)) L.solid(ev2(sx(x) - w * (0.2 + 0.2 * rnd(k, 3))), foot, ev2(w * 0.45), 2, [1, 0.45, 0.1], 0, 0, 0, 0.6);
      drawProp(n, sx(x), foot, { flip: rnd(k, 9) < 0.5 }); basaltOcc.push([n, sx(x) - w / 2, foot - hh, w, hh, rnd(k, 9) < 0.5]); } };
    const stoneArch = (c) => { const xs = c.cells.map((k) => k % m.W), ys = c.cells.map((k) => Math.floor(k / m.W)), x0 = Math.min(...xs) * TILE, x1 = (Math.max(...xs) + 1) * TILE, y1 = (Math.max(...ys) + 1) * TILE;
      if (c.axis !== 'x' || SIM.Q.cell(m, Math.floor((x0 + 16) / TILE), Math.floor((y1 + 16) / TILE)) !== 3) { basaltSlabs(c); return; }
      // (the crown, 0.35 of its height down, sits on the walk's near edge; its size is fixed on the art grid, TASKS 480: scaled to the
      // river it was redrawn 7–15× smaller than painted and lost its contour)
      const [wd, ht] = SZ('arch_mg'), X = ev2(sx((x0 + x1) / 2) - wd / 2), Y = ev2(sy(y1) + 2 - 0.35 * ht);
      basaltSlabs(c, c.cells.filter((k) => (Math.floor(k / m.W) + 1) * TILE < y1 + 2 - 0.35 * ht + 0.12 * ht));
      L.shadow(sx((x0 + x1) / 2), Y + ht - 2, wd * 0.5, 6, 0.5); L.sprite('arch_mg', X, Y, { w: ev2(wd), h: ev2(ht) }); basaltOcc.push(['arch_mg', X, Y, ev2(wd), ev2(ht), false]); };
    // a plank crossing: one board at a time across the way with a dark gap between, each a little off in length, place, slant and
    // tone. A bridge stands high and sags towards its middle, casts its shadow and its reflection on the water below, and its rope
    // rails run on short stakes between thick posts at its ends; a plank walk lies low on stilts with no rails
    const planks = (c, band) => { const hor = c.axis === 'x', [u0, u1, v0] = c.span, bridge = c.kind === 'bridge', T = TILE, sd = c.cells[0], iron = !!c.lava || !!c.chasm;
      const A0 = u0 * T - 6, len = (u1 - u0 + 1) * T + 12, B0 = v0 * T, BW = 2 * T, n = Math.max(3, Math.round(len / BRIDGE.pitch)), pitch = len / n;
      // (a chain bridge gives under the hero, TASKS 466: the boards by him dip and tremble with his steps)
      // (how much he is on it, by where he stands across the deck and along it, TASKS 1050: decided by his cell, the deck already sagged
      // under it and he dropped 9 px in a frame)
      const ha = hor ? R.hero.x : R.hero.y, hb = hor ? R.hero.y : R.hero.x, onW = bridge ? SS(B0 - 10, B0 + 6, hb) * (1 - SS(B0 + BW - 6, B0 + BW + 10, hb)) * SS(A0 - 8, A0 + 10, ha) * (1 - SS(A0 + len - 10, A0 + len + 8, ha)) : 0, on = onW > 0;
      // (TASKS 490: it trembled on a clock) each footfall of his jolts it and dies away, and a rock landing on the deck shakes it
      const hs = Math.hypot(R.hero.vx, R.hero.vy) > 20 ? (R.hero.dist / SIM.Q.stepLen(1)) % 1 : 1, foot = 3 * Math.exp(-8 * hs);
      const fallR = bridge ? (m.hazards || []).filter((z) => z.k === 'fall' && D.hazClock(z, GT) < 0.7 && c.cells.some((k) => Math.hypot((k % m.W + 0.5) * T - z.x, (Math.floor(k / m.W) + 0.5) * T - z.y) < 60)) : [];
      const shake = (a) => fallR.reduce((v, z) => { const q = D.hazClock(z, GT); return v + 7 * Math.exp(-6 * q) * Math.sin(q * 38) * Math.exp(-Math.abs(a - (hor ? z.x : z.y)) / 90); }, 0);
      const dip = (a) => (on ? onW * (5 + foot) * Math.exp(-(((a - ha) / Math.max(40, len * 0.3)) ** 2)) * Math.sin(Math.PI * Math.max(0, Math.min(1, (a - A0) / len))) : 0) + shake(a) * Math.sin(Math.PI * Math.max(0, Math.min(1, (a - A0) / len)));
      const sag = bridge ? Math.min(10, 3 + len / 45) : 0, lift = bridge ? 8 : 3, z = (a) => lift - sag * Math.sin(Math.PI * Math.max(0, Math.min(1, (a - A0) / len))) - dip(a);
      // (the sag on the grid and the step's jolt a whole 2 px apart from it, TASKS 1058: rounded together the jolt was lost)
      // (the jolt held two frames by the clock, TASKS 1162: as a share of the stride it lasted half a frame; and at most one 2 px step a frame, its end falling on a step of the sag made 4)
      const stride = hs * SIM.Q.stepLen(1) / Math.max(1, Math.hypot(R.hero.vx, R.hero.vy));
      if (on) { const tgt = ev2((lift - z(ha) - onW * foot * Math.sin(Math.PI * Math.max(0, Math.min(1, (ha - A0) / len)))) * onW) + (onW > 0.5 && stride < 2.5 / 60 ? 2 : 0); const dt = GT - (DECK.at ?? -9), same = onW > 0.5 && dt >= 0 && dt < 0.05 && Math.hypot(R.hero.x - DECK.hx, R.hero.y - DECK.hy) < 24; DECK.dy = same ? DECK.last + Math.max(-2, Math.min(2, tgt - DECK.last)) : tgt; Object.assign(DECK, { last: DECK.dy, tgt, at: GT, hx: R.hero.x, hy: R.hero.y }); }   // (the last frame's drop kept apart, TASKS 1164: dy is zeroed every frame and stepping from it held the hero 12 px over the deck)
      const P = (a, b, h = 0) => (hor ? [ev2(sx(a)), ev2(sy(b) - h)] : [ev2(sx(b)), ev2(sy(a) - h)]);
      const boards = []; for (let i = 0; i < n; i++) { const a = A0 + (i + 0.5) * pitch, r = (j) => rnd(sd + i * 7, j);
        if (bridge && i > 1 && i < n - 2 && r(1) < 0.05) continue;
        boards.push({ a, off: (r(2) - 0.5) * 4, l: BW + 6 + (r(3) - 0.5) * 7, rot: iron ? 0 : (r(4) - 0.5) * 0.07, tone: 0.72 + 0.36 * r(5), n: r(6) < 0.5 ? 'plank_a' : 'plank_b', f: r(7) < 0.5, z: z(a) }); }
      const board = (q, h, draw) => { const [X, Y] = P(q.a, B0 + BW / 2 + q.off, h); draw(X, Y, hor ? Math.PI / 2 + q.rot : q.rot); };
      // the shadow on the water, then the reflection of the near edge and the posts, wavering
      for (const q of boards) board(q, -6, (X, Y, rot) => L.solid(X - q.l / 2, Y - 5, q.l, 10, [0.005, 0.02, 0.025], rot, q.l / 2, 5, bridge ? 0.42 : 0.3));
      if (bridge && hor) for (const q of boards) { const near = B0 + BW + 4; if (!inWet(q.a, near + 14)) continue;
        for (let k = 0; k < 5; k++) { const [X, Y] = P(q.a, near + 4 + k * 4), dx = ev2(Math.sin(t * 1.6 + q.a * 0.13 + k * 1.3) * 1.6); L.solid(X - 4 + dx, Y, 8, 4, [0.2 * q.tone, 0.13 * q.tone, 0.08 * q.tone], 0, 0, 0, 0.2 * (1 - k / 5)); } }
      for (const p of c.posts || []) if (inWet(p.x, p.y + 6)) { ripple(p.x, p.y + 2, 16, p.x + p.y); for (let k = 0; k < 6; k++) { const dx = ev2(Math.sin(t * 1.5 + p.x * 0.1 + k * 1.1) * 1.6);
        L.solid(ev2(sx(p.x)) - 6 + dx, ev2(sy(p.y)) + 4 + k * 4, 12, 4, [0.18, 0.11, 0.07], 0, 0, 0, 0.26 * (1 - k / 6)); } }
      // a plank walk's stilts into the water along its near edge
      if (!bridge) for (let i = 0; i < boards.length; i += 3) for (const b of hor ? [B0 + BW + 1] : [B0 + 3, B0 + BW - 3]) { const q = boards[i], [X, Y] = P(q.a, b);
        if (inWet(hor ? q.a : b, hor ? b + 4 : q.a + 4)) ripple(hor ? q.a : b, hor ? b + 4 : q.a + 4, 9, q.a + b, 0.22); L.solid(X - 2, Y - 2, 4, 8, [0.12, 0.07, 0.045]); }
      // the beams under the boards: along the near edge of a deck across the screen, along both sides of one running down it
      if (hor) for (const q of boards) { const [X, Y] = P(q.a, B0 + BW + 2, q.z); L.solid(X - pitch / 2 - 1, Y - 2, pitch + 2, 5, [0.12, 0.07, 0.045]); }
      // (a chain bridge's boards end in a dark edge 2 px, TASKS 448: without it they ran together into one sheet)
      // a falling rock that lands on a bridge's deck snaps the boards under it (TASKS 485): they hang split and askew a while
      // (TASKS 1042: they hung broken for 2.4 s after the blow, the safest window, a telegraph backwards) the boards under a rock's
      // shadow crack and rattle over its warning, then hang broken only a moment after it lands
      const HF = D.HAZ.fall, along = (z, q) => Math.abs((hor ? z.x : z.y) - q.a), under = (q) => { const near = (m.hazards || []).filter((z) => z.k === 'fall' && Math.abs((hor ? z.y : z.x) - (B0 + BW / 2)) < BW && along(z, q) < HF.r * 0.8), live = (z) => { const c = D.hazClock(z, GT); return c < 1 || c > z.per - HF.warn; }; return near.find(live) || near[0]; };   // (TASKS 1162: a run's rocks overlap, and the first one listed hid the warning of the one falling)
      const stateOf = (q) => { const z = bridge && under(q); if (!z) return 0; const c = D.hazClock(z, GT); return c < 1 ? 2 : c > z.per - HF.warn ? 1 : 0; };
      for (const q of boards) board(q, q.z, (X, Y, rot) => { const st2 = stateOf(q);
        if (st2 === 1) { const w = (D.hazClock(under(q), GT) - (under(q).per - HF.warn)) / HF.warn, j = w > 0.2 && Math.sin(GT * 50 + q.a) > 0 ? -2 : 0;   // (whole 2 px, TASKS 1050: rounded it rattled not at all)
          L.sprite(q.n, X - q.l / 2, Y - 5 + j, { w: q.l, h: 10, rot: rot + 0.05 * w * Math.sin(GT * 37 + q.a), pivot: [q.l / 2, 5], flip: q.f, u: { grade: [0.7, 0.42 * q.tone, 0, 1] } });
          // (a white-hot crack across the boards under the middle of its shadow, TASKS 1050, 1058: red-orange it read as the target
          // ring's own ticks)
          const z0 = under(q);
          if (along(z0, q) < HF.r * 0.9) (SC.crackFx ||= []).push({ X, Y: Y + j, rot, w, f: q.f, s: Math.imul(Math.round(q.a), 40503) >>> 4, d: along(z0, q) / (HF.r * 0.9), wx: hor ? q.a : B0 + BW / 2, wy: hor ? B0 + BW / 2 : q.a });   // (drawn in the emissive pass, TASKS 1162: the lit pass put it out on the dark boards)
          return; }
        if (st2 === 2) { if (along(under(q), q) < HF.r * 0.45) return;   // (the boards the rock went through are gone a moment, TASKS 1162)
          for (const sd of [-1, 1]) L.sprite(q.n, X + sd * q.l / 4 - q.l / 4, Y - 3, { w: q.l / 2 - 2, h: 10, rot: rot + sd * 0.35, pivot: [sd < 0 ? 0 : q.l / 2 - 2, 5], flip: q.f, u: { grade: [0.6, 0.45 * q.tone, 0, 1] } }); return; }
        L.sprite(q.n, X - q.l / 2, Y - 5, { w: q.l, h: 10, rot, pivot: [q.l / 2, 5], flip: q.f, u: { grade: iron ? [0.5, 0.42 * q.tone, 0, 1] : [0.9, q.tone, 0, 1] } });
        if (iron) { L.solid(X - q.l / 2, Y - 5, 2, 10, [0.03, 0.02, 0.015], rot, q.l / 2, 5); L.solid(X + q.l / 2 - 2, Y - 5, 2, 10, [0.03, 0.02, 0.015], rot, 2 - q.l / 2, 5); } });
      // a deck running down the screen is framed by its two stringers, logs along its sides over the boards' ends, and shows the
      // edge of its last board at its near end
      if (!hor) { const [, y0] = P(A0, 0, lift), [, y1] = P(A0 + len, 0, lift);
        for (const b of [B0 - 1, B0 + BW + 1]) { const [X] = P(0, b); L.solid(X - 3, y0, 6, y1 - y0, [0.15, 0.09, 0.055]); L.solid(X - 3, y0, 2, y1 - y0, [0.33, 0.21, 0.12]); L.solid(X + 2, y0, 1, y1 - y0, [0.06, 0.035, 0.02]); }
        const [xl] = P(0, B0 - 4); L.solid(xl, y1, BW + 8, 4, [0.1, 0.06, 0.035]); }
      if (!bridge) return;
      // the rails: a stake every third board on each side, two ropes from stake to stake, each span sagging
      const stakes = boards.filter((q, i) => i % (hor ? 3 : 4) === 0 || i === boards.length - 1), sh = hor ? 22 : 13;
      // seen from above a stake and the rope it holds run down the same line on a deck running down the screen: one rope there,
      // the stakes over it, each with its pale cut top
      // over lava (TASKS 401) the stakes are iron and the rails chains, links alternately seen face-on and edge-on, sagging deeper
      // (an iron stake 3 art px thick with an inked side each, TASKS 480: 2 px it read as a wire's barb)
      const sw = iron ? 6 : hor ? 4 : 6, stake = (X, Y) => { if (iron) { L.solid(X - sw / 2 - 2, Y - sh - 2, sw + 4, sh + 2, INKC); OCC_SOLIDS.push([X - sw / 2 - 2, Y - sh - 2, sw + 4, sh + 2]); }
        L.solid(X - sw / 2, Y - sh, sw, sh, iron ? [0.06, 0.06, 0.065] : [0.09, 0.05, 0.03]); L.solid(X - sw / 2, Y - sh, 2, sh, iron ? [0.22, 0.21, 0.22] : [0.26, 0.16, 0.09]);
        L.solid(X - sw / 2, Y - sh - 2, sw, 3, iron ? [0.32, 0.3, 0.3] : [0.5, 0.36, 0.21]); L.solid(X - sw / 2, Y - sh + 1, sw, 1, [0.05, 0.03, 0.02]); };
      const rail = (side) => { const b = side ? B0 + BW + 1 : B0 - 1, top = (q, hgt) => P(q.a, b, q.z + hgt);
        // (an iron rail is one chain, its stakes drawn over it, TASKS 1039: two rows of links ran together into one brick band, the
        // stakes lost behind it)
        for (let i = 0; i + 1 < stakes.length; i++) for (const hgt of hor ? (iron ? [16] : [19, 10]) : [11]) { const A = stakes[i], Bq = stakes[i + 1];
          for (let k = 0; k < 6; k++) { const w0 = k / 6, w1 = (k + 1) / 6, dr = (w) => (iron ? 6 : 3) * Math.sin(Math.PI * w);
            const [x0, y0] = P(A.a + (Bq.a - A.a) * w0, b, A.z + (Bq.z - A.z) * w0 + hgt - dr(w0)), [x1, y1] = P(A.a + (Bq.a - A.a) * w1, b, A.z + (Bq.z - A.z) * w1 + hgt - dr(w1));
            const l = Math.hypot(x1 - x0, y1 - y0), an = Math.atan2(y1 - y0, x1 - x0);
            // (the concept's links, face-on and edge-on in turn: a face-on one an open ring 6×5 art px, the lava showing through it, inked
            // round; packed solid blocks at 5 px read as barbed wire, TASKS 480)
            if (iron) { const n = Math.max(1, Math.round(l / 9)); for (let j = 0; j < n; j++) { const px = ev2(x0 + (x1 - x0) * (j + 0.5) / n), py = ev2(y0 + (y1 - y0) * (j + 0.5) / n);
                // (cool iron, lit warm by the lava it read pink-brown; along a deck running down the screen the links turn with the chain)
                const R4 = (x, y, w, h, c) => { const a = hor ? [px + x, py + y, w, h] : [px + y, py + x, h, w]; L.solid(...a, c); OCC_SOLIDS.push(a); }, G1 = [0.26, 0.26, 0.28], G0 = [0.08, 0.08, 0.09], G2 = [0.16, 0.16, 0.17];   // (dark neutral iron, TASKS 1055: lavender in the basalt's light)
                if ((k * n + j) % 2) { R4(-6, -4, 12, 4, INKC); R4(-4, -4, 8, 2, G1); }
                else { for (const [x, y, w, h] of [[-4, -6, 8, 2], [-4, 2, 8, 2], [-6, -4, 2, 6], [4, -4, 2, 6]]) R4(x, y, w, h, INKC);
                  R4(-4, -4, 8, 2, G1); R4(-4, 0, 8, 2, G0); R4(-4, -2, 2, 2, G2); R4(2, -2, 2, 2, G2); } } }
            else { L.solid(x0, y0 + 1, l + 1, 1, [0.2, 0.13, 0.06], an, 0, 0); L.solid(x0, y0 - 1, l + 1, 2, [0.55, 0.42, 0.22], an, 0, 0); } } }
        if (hor) for (const q of stakes) stake(...top(q, 0));
        if (!hor) for (const q of stakes) { const [X, Y] = top(q, 0); stake(X + (side ? 2 : -2), Y); } };
      // a deck running down the screen has its rails at its sides, level with whoever walks it: they draw behind him
      if (hor) { rail(0); band.push([B0 + BW + 2, () => rail(1)]); } else { rail(0); rail(1); }
      for (const p of c.posts) band.push([p.y, () => { L.shadow(sx(p.x), sy(p.y), 12, 4, 0.5); drawProp(p.fire ? 'bridge_torch' : iron ? 'bridge_post_mg' : 'bridge_post', sx(p.x), sy(p.y), { dy: 4, u: iron && p.fire ? { grade: [0.45, 0.4, 0, 1] } : undefined });
        if (iron && !p.fire) { const [w, hh] = SZ('bridge_post_mg'); basaltOcc.push(['bridge_post_mg', sx(p.x) - w / 2, sy(p.y) - hh + 4, w, hh, false]); }
        if (p.fire && known(p.x, p.y)) { halo(sx(p.x), sy(p.y) - BRIDGE.up + 6, B.torch, p.x); flameB(sx(p.x), sy(p.y) - BRIDGE.up, 18 * flick(p.x), 32 * flick(p.x + 1), B.torch, p.x + p.y, 0); } }]); };
    // the cave's crossings (TASKS 306): stepping stones, a low plank walk, a rope bridge; its near rail and posts stand in the band
    const bandX = [];
    for (const c of m.crossings || []) { if (c.kind === 'neck') continue; const xs = c.cells.map((k) => (k % m.W) * TILE), ys = c.cells.map((k) => Math.floor(k / m.W) * TILE);
      if (!vis((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, 260)) continue;
      if (c.lava && c.kind === 'slabs') { basaltSlabs(c); continue; }
      if (c.lava && c.kind === 'arch') { stoneArch(c); continue; }
      if (c.look === 'stones') { fordStones(c); continue; }
      planks(c, bandX); }
    // a strand of moss hanging from the lip of a rock face, one art pixel wide: dark at its root, yellow-green at its tip, a leaf
    // pixel now and then to either side; it sways more the lower it hangs. Painted strands drawn this small melted into the rock
    const MOSS = [[0.12, 0.27, 0.2], [0.25, 0.47, 0.19], [0.45, 0.66, 0.2], [0.68, 0.84, 0.28]];
    const mossStrand = (o, sd) => { const n = Math.round(9 + 16 * o.s), top = o.y - 34 - 2 * Math.floor(3 * rnd(o.x, 2)), x0 = ev2(sx(o.x));
      for (let k = 0; k < n; k++) { const q = k / n, dx = ev2(Math.sin(t * 0.7 + sd + k * 0.18) * 3.2 * q * q), col = MOSS[Math.min(3, Math.floor(q * 3.6))], Y = ev2(sy(top)) + 2 * k;
        L.solid(x0 + dx, Y, 2, 2, col); if (k > 2 && rnd(sd, k) < 0.22) L.solid(x0 + dx + (rnd(sd, k + 50) < 0.5 ? -2 : 2), Y, 2, 2, MOSS[Math.min(3, Math.floor(q * 3.6) + 1)]); } };
    // the cave's flora: lilies float on the calm water, moss hangs from the rock faces (water weed stands in the band)
    for (const o of m.flora || []) { if (!vis(o.x, o.y) || o.n === 'weed_cv') continue; const sd = o.x * 0.37 + o.y * 0.11;
      if (o.n === 'lily_cv') { const [w0, h0] = SZ(o.n), w = w0 * o.s, hh = h0 * o.s, dx = Math.round(Math.sin(t * 0.35 + sd)) * 2; L.sprite('lily_cv', sx(o.x) - w / 2 + dx, sy(o.y) - hh / 2, { w, h: hh, flip: !!o.f, u: { grade: [0.9, 0.85, 0, 1] } }); }
      else mossStrand(o, sd); }
    for (const q of m.waterFeatures || []) { if (q.drain === undefined) continue;
      const x = (q.drain % m.W + 0.5) * TILE, y = (Math.floor(q.drain / m.W) + 0.5) * TILE, [w, hh] = SZ('water_drain');
      if (vis(x, y)) L.sprite('water_drain', sx(x) - w / 2, sy(y) - hh / 2, { w, h: hh });
      // the source on the wall: a mask spouting into a basin (a fountain), or a barred culvert at the wall's foot (a stream)
      const top = m.rooms[q.room].y * TILE;
      if (!vis(q.x, top)) continue;
      if (q.kind === 'fountain') { const [sw, sh] = SZ('water_spout'); L.sprite('water_spout', sx(q.x) - sw / 2, sy(top - 9) - sh, { w: sw, h: sh }); }
      else { const [gw, gh] = SZ('water_grate'); L.sprite('water_grate', sx(q.x) - gw / 2, sy(top + 4) - gh, { w: gw, h: gh }); }
    }
    // stairs / boss portal
    // a chapter boss's portal home (TASKS 383) is the town's own: its rune disc on the floor, its ring of stones, its light
    const GATE = !m.town && R.arena && R.arena.gate;
    if (GATE && vis(GATE.x, GATE.y) && known(GATE.x, GATE.y)) { const w = 2.6 * TILE, [w0, h0] = SZ('disc_tw'), k = w / w0; L.puff(sx(GATE.x), sy(GATE.y) + 4, w * 0.55, [0, 0, 0], 0.25, 3); L.sprite('disc_tw', sx(GATE.x) - w / 2, sy(GATE.y) - h0 * k / 2, { w, h: h0 * k }); }
    // the stairs on past the serpent (TASKS 354), beside the portal: dark till it falls
    if (m.down && vis(m.down.x, m.down.y)) { const st = m.biome === 'magma' ? 'stairs_mg' : 'stairs', [w, hh] = SZ(st); L.sprite(st, sx(m.down.x) - w / 2, sy(m.down.y) - hh / 2 - 4, { w, h: hh, u: R.bossDead ? undefined : { grade: [0.6, 0.55, 0, 1] } }); }
    // the town's crypt gate is a dark mouth between its braziers, not a lit frame (fidelity r2)
    if (vis(m.exit.x, m.exit.y)) { if (SIM.Q.exitKind(R, m.floor) === 'stairs') { const st = m.town ? 'stairs_tw' : m.biome === 'magma' ? 'stairs_mg' : 'stairs', [w, hh] = SZ(st); L.sprite(st, sx(m.exit.x) - w / 2, sy(m.exit.y) - hh / 2 - 4, { w, h: hh }); } }
    // the start room's bonfire sits in a rune circle
    if (window.ASSETS.sanct_circle && !m.town && vis(m.sanct.x, m.sanct.y)) { const d = 3.4 * TILE; L.sprite('sanct_circle', sx(m.sanct.x) - d / 2, sy(m.sanct.y - 6) - d / 2, { w: d, h: d }); }
    // a magma hall's ritual circle (TASKS 434), the fire priests' as on ref_cave_lava
    // (its blessing taken, TASKS 1054, it goes dull as a used altar does)
    if (window.ASSETS.sanct_circle) for (const q of m.circles || []) if (vis(q.x, q.y)) { const d = 4.2 * TILE; L.sprite('sanct_circle', sx(q.x) - d / 2, sy(q.y) - d / 2, { w: d, h: d, u: q.used ? { grade: [0.5, 0.7, 0, 1] } : undefined }); }
    // spike traps: a 2×2-cell plate on the ground; its spikes stand in the Y-sorted band (they have height)
    // on the magma's basalt the crypt's grey masonry plate read as a tile (TASKS 456): it goes dark and dull, a hot glint in each hole
    for (const tp of m.traps) if (vis(tp.x, tp.y)) { L.sprite('trap_plate', sx(tp.x - TILE), sy(tp.y - TILE), { w: 2 * TILE, h: 2 * TILE, u: m.cliff ? { grade: [0.35, 0.9, 0, 1.05] } : undefined });
      if (m.cliff) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const bx = tp.x - TILE + TRAP_HOLE.x[i] * 2 * TILE, by = tp.y - TILE + TRAP_HOLE.y[j] * 2 * TILE, br = 0.75 + 0.25 * Math.sin(GT * 1.3 + i * 2.1 + j * 3.7 + tp.x);
        for (const [dx, dy] of TRAP_SPIKE) L.glow(sx(bx + dx), sy(by + dy), 4, [1, 0.32, 0.06], 0.6 * br, 2.4); } }
    // the magma caves' falling rocks (TASKS 406): the rock's shadow grows on the floor over its warning (the rock drops in the Y band),
    // the rubble it leaves lies a moment after
    for (const z of m.hazards || []) { if (z.k !== 'fall' || !vis(z.x, z.y)) continue; const H = D.HAZ.fall, w = D.hazClock(z, GT) - (z.per - H.warn); if (w < 0) continue;
      const q = w / H.warn, k = 0.3 + 0.7 * q; L.shadow(sx(z.x), sy(z.y) + 2, H.r * k, H.r * H.ry * k, 0.35 + 0.6 * q); }
    for (const e of ST.ev) { const a = GT - e.t; if (e.k !== 'rockfall' || a < 0 || a >= 2.4 || !vis(e.x, e.y)) continue; const [w0, h0] = SZ('dc_rubble'), k = 56 / Math.max(w0, h0);
      L.sprite('dc_rubble', sx(e.x) - w0 * k / 2, sy(e.y) - h0 * k / 2 + 2, { w: w0 * k, h: h0 * k, u: { alpha: 1 - SS(1.4, 2.4, a) } }); }
    // spilt coins are baked into the floor; stamped again as emitters so the fire's orange can't take their yellow
    for (const d of m.decals) if (d.n === 'dc_coins' && vis(d.x, d.y) && !SIM.Q.hidden(m, d)) { const [w0, h0] = SZ(d.n), k = 40 * d.s / Math.max(w0, h0);
      emitted((a) => L.sprite(d.n, sx(d.x) - w0 * k / 2, sy(d.y) - h0 * k / 2, { w: w0 * k, h: h0 * k, flip: !!d.f, u: { alpha: 0.92 * a, tint: GOLD_TINT } })); }
    // flat decor (bones) and blood / scorch decals from events
    for (const d of m.decor) if (!d.wall && d.n === 'bones' && vis(d.x, d.y) && !hid(d)) drawProp('bones', sx(d.x), sy(d.y), { dy: 6 });
    // a two-level hall's steps (TASKS 375) lie on the ground: whoever walks them is drawn over them
    for (const d of m.decor) if (d.steps && vis(d.x, d.y) && !hid(d)) drawProp(d.n, sx(d.x), sy(d.y), { dy: 0 });
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      // what a kill leaves on the floor by what it bled: a pool, a skeleton's bone dust, nothing of a ghost
      if (e.k === 'kill' && a < 12 && !e.gone) { const bl = BLOOD(e.type); if (bl === 'bone') { if (a < 6) L.puff(sx(e.x), sy(e.y) + 2, 14 + 6 * SS(0, 0.3, a), [0.5, 0.47, 0.4], 0.3 * (1 - SS(3, 6, a)), e.id); }
        else if (bl !== 'ecto' && bl !== 'slime' && bl !== 'water') L.puff(sx(e.x), sy(e.y) + 2, 18 + 8 * SS(0, 0.3, a), bl === 'ichor' ? [0.1, 0.14, 0.03] : [0.25, 0.02, 0.02], 0.6 * (1 - SS(6, 12, a)), e.id); }
      if (e.k === 'slam' && a < 4.6) L.cracks(sx(e.x), sy(e.y), e.big ? 130 : 70, a, e.id || 1, 0);
      if (e.k === 'whirl' && a < 0.5) whirlFx(e, a, 1);
      if (e.k === 'boom' && a < 0.6) { G.blend('emit'); blastFx(e, a, 1); G.blend(); }
      if (e.k === 'die') L.puff(sx(e.x) + 6, sy(e.y) + 4, 12 + 30 * SS(0.1, 1.4, a), [0.28, 0.02, 0.02], 0.75, 41); }
    // a slime's puddle (TASKS 308): a glossy green spill that spreads out of the splat, then shrinks as it dries (sim GOO.dry)
    for (const g of m.goo || []) { const a = GT - g.t0, left = g.t0 + g.T - GT; if (a < 0 || left <= 0 || !vis(g.x, g.y)) continue;
      const r = g.r * SS(0, 0.25, a) * Math.min(1, left / 2), X = sx(g.x), Y = sy(g.y);
      for (let j = 0; j < 5; j++) { const an = rnd(g.id, j) * TAU, d = r * 0.45 * rnd(g.id, j + 5); L.puff(X + Math.cos(an) * d, Y + Math.sin(an) * d * 0.55, r * (0.55 + 0.25 * rnd(g.id, j + 9)), [0.1, 0.3, 0.08], 0.75, g.id + j); }
      L.puff(X - r * 0.2, Y - r * 0.12, r * 0.3, [0.45, 0.75, 0.3], 0.35, g.id + 7); }
    const scars = R.scorches || [];
    for (const e of scars.concat(ST.ev.filter((e) => e.k === 'boom' && !scars.some((s) => s.t === e.t && s.x === e.x && s.y === e.y)))) {
      const a = GT - e.t; if (a >= 0 && a < 4) blastFx(e, a, 0);
    }

    // the only tell of a hidden opening: a faint draught, a few pale motes at its foot that only show from a step or two away
    // (a banner sways in it instead)
    const inSecret = (q) => SIM.Q.secretMask(m).has(q.front[5][1] * m.W + q.front[5][0]);
    (m.secrets || []).forEach((q, i) => { if (q.open || q.kind === 'banner' || !vis(q.x, q.y) || inSecret(q)) return; const near = 1 - SS(70, 150, Math.hypot(h.x - q.x, h.y - q.y)); if (near <= 0) return;
      const X = sx(q.x), Yf = sy(q.y) + (q.kind === 'shelf' ? 24 : 0), ux = q.dx, uy = q.dy;
      for (let j = 0; j < 4; j++) { const ph = (t * 0.22 + rnd(i, j)) % 1, sp = (rnd(i, j + 5) - 0.5) * (q.kind === 'shelf' ? 110 : 40) * (0.5 + ph) + Math.sin(t * 1.6 + j * 2) * 4;
        L.solid(X - ux * (ph * 30 - 4) - uy * sp, Yf - uy * (ph * 30 - 4) + ux * sp + (q.dy ? 0 : ph * ph * 10), 2, 2, [0.8, 0.84, 0.92], 0, 0, 0, 0.35 * near * Math.sin(ph * Math.PI)); } });
    // a secret's loose flagstone: the floor's own stone standing a hair proud of its neighbours; it sinks when stepped on
    // (ambush plates are gone, TASKS 320; only secrets use it now)
    const flagstone = (P, down, crack) => { const z = zoneAt(m, P.cx, P.cy), Z = D.BIOMES[z], TS = 288, X = P.cx * TILE, Yw = P.cy * TILE, u0 = (X % TS) / TS, v0 = (Yw % TS) / TS, lift = 1.5 * (1 - down) - down;
      const ink = [0.02, 0.015, 0.02], X0 = sx(X) + 2, Y0 = sy(Yw) + 2, S0 = TILE - 4;
      L.solid(X0, Y0 + S0 - 1, S0, 3, ink, 0, 0, 0, 0.45 + 0.3 * down);
      // a cave's floor is the CAVE bake's own (gradient maps, noise, moss), not the floor tile: the stone is cut from the baked map
      // where it is drawn, so its grain and colour run on from its neighbours and only the ink rim, its shadow and the pale lip tell it
      // (TASKS 337: the floor tile it used to take stood 16–25 levels off the cave floor's mean colour)
      if (B.cave) { const MW = m.W * TILE, MH = m.H * TILE, xw = X + 2, yw = Yw + 2;
        L.sprite('map', X0, Y0 - lift, { w: S0, h: S0, src: [xw / MW, 1 - (yw - lift) / MH, (xw + S0) / MW, 1 - (yw - lift + S0) / MH] });
        L.solid(X0, Y0 - lift, S0, S0, ink, 0, 0, 0, 0.2 * down); }
      else L.sprite(Z.floor, X0, Y0 - lift, { w: S0, h: S0, src: [u0 + 2 / TS, v0 + 2 / TS, u0 + (TILE - 2) / TS, v0 + (TILE - 2) / TS], u: { grade: [z === m.biome ? 1 : 0.35, 0.96 * (z === m.biome ? 1 : Z.dim || 1) * (1.05 - 0.22 * down), 0, 1], tint: [B.tint[0], B.tint[1], B.tint[2], 1] } });
      for (const [x, y, w, hh] of [[X0, Y0 - lift, S0, 2], [X0, Y0 - lift, 2, S0], [X0 + S0 - 2, Y0 - lift, 2, S0]]) L.solid(x, y, w, hh, ink, 0, 0, 0, 0.4 + 0.35 * down);
      if (down < 0.5) L.solid(X0 + 2, Y0 - lift + 2, S0 - 4, 1, [0.9, 0.8, 0.65], 0, 0, 0, 0.12);
      if (crack && down > 0.5) {   // a sprung ambush stays a broken, sunken stone, so on the way back it is not taken for one still waiting
        L.solid(X0 + 2, Y0 - lift + 2, S0 - 4, S0 - 4, ink, 0, 0, 0, 0.18);
        const r0 = rnd(P.cx, P.cy); let x = X0 + S0 / 2 - 4 + Math.floor(r0 * 4) * 2, y = Y0 - lift + 2;
        for (let k = 0, d = r0 < 0.5 ? -2 : 2; y < Y0 - lift + S0 - 4; k++) { L.solid(x, y, 2, 2, ink, 0, 0, 0, 0.85); y += 2;
          if (rnd(P.cx + k, P.cy - k) < 0.25) d = -d; if (rnd(P.cy + k, P.cx) < 0.5) x = Math.max(X0 + 2, Math.min(X0 + S0 - 4, x + d));
          if (k === 4) for (let j = 1; j <= 3; j++) L.solid(x - d * j, y + j * 2 - 2, 2, 2, ink, 0, 0, 0, 0.7); } } };
    for (const q of m.secrets || []) { const P = q.trig; if (P && P.k === 'plate' && vis(P.x, P.y)) flagstone(P, q.open ? SS(0, 0.12, GT - (P.downT ?? q.openT ?? -9)) : 0); }

    // webs on the floor (TASKS 71): torn to a few strands by a blow, burnt to a sooty few by fire
    (m.webs || []).forEach((w, i) => { if (!vis(w.x, w.y)) return; const n = w.torn ? 'web_torn' : w.v ? 'web_b' : 'web_a', A0 = ASSETS[n], ww = 84 * w.s * (w.torn ? 0.8 : w.v ? 0.85 : 1), hh = ww * A0.h / A0.w;
      const burnt = w.torn && ST.ev.some((e) => e.k === 'webburn' && e.i === i), a = w.torn ? GT - (w.tornT ?? -9) : 9;
      L.sprite(n, sx(w.x) - ww / 2, sy(w.y) - hh / 2, { w: ww, h: hh, flip: !!w.f, u: { alpha: w.torn ? 0.8 : 1, grade: burnt ? [0.35, 0.4, 0, 1] : [1.25, 1.1, 0, 1.1] } });
      if (a < 0.4 && !burnt) { const q = a / 0.4; for (let j = 0; j < 6; j++) L.solid(sx(w.x) + (rnd(i, j) - 0.5) * 60 * (0.5 + q), sy(w.y) - 30 * q * rnd(i, j + 4) - 4, 3, 3, [0.9, 0.88, 0.8], 0, 0, 0, 0.8 * (1 - q)); } });

    // ===== Y-sorted band =====
    const Y = [], knocked = {}; for (const e of ST.ev) if (e.k === 'prop') knocked[e.i] = e;
    // a clutch on the art grid like every sprite (TASKS 234); it stirs by whole art pixels, quicker as the hatch nears, never by a squash
    for (const egg of R.eggs || []) if (egg.hp > 0 && vis(egg.x, egg.y)) Y.push([egg.y, () => { const [w, h] = SZ('spider_eggs'), left = egg.hatchT - GT, beat = 3 + 9 * SS(2, 0, left);
      const stir = Math.sin((GT - egg.t0) * beat) > 0.55 ? 2 : 0, lean = left < 1 && Math.sin((GT - egg.t0) * 23) > 0.3 ? 2 : 0;
      L.shadow(sx(egg.x), sy(egg.y), w / 2, 5, 0.5); L.sprite('spider_eggs', sx(egg.x) - w / 2 + lean, sy(egg.y) - h - stir, { w, h }); }]);
    for (const q of m.waterFeatures || []) if (q.kind === 'fountain' && vis(q.x, q.y)) { const top = m.rooms[q.room].y * TILE, [bw, bh] = SZ('water_basin'), foot = top + 36;
      Y.push([foot, () => {
        L.shadow(sx(q.x), sy(foot - 2), bw * 0.45, 6, 0.6); L.sprite('water_basin', sx(q.x) - bw / 2, sy(foot) - bh, { w: bw, h: bh });
        // the pour: from the mask's mouth (a quarter up its plate) to the basin's water, a third down the basin
        const mouth = top - 9 - SZ('water_spout')[1] * 0.3, water = foot - bh * 0.62, xf = G.xf(sx(q.x) - 24, sy(mouth), 48, 64);
        G.draw(L.P.jet, { u_t: t, u_seed: q.room, u_fall: water - mouth, u_wide: 0 }, xf);
        L.anchor('water_source', [sx(q.x), sy(mouth)], [xf[6] + xf[0] * 0.5, xf[7]], 2);
      }]); }
    // the magma caves' sources: a fall down the back wall, a breach at its foot, a vent in the lava (MAGMA_SRC)
    const lavaSrc = (q) => { const kind = { fall: 0, breach: 1, vent: 2 }[q.kind], cx = q.x + (q.w - 1) * TILE / 2, bw = Math.max(72, q.w * TILE * 0.36 + 44), box = [cx - bw, q.y - 270, bw * 2, 330];
      return kind === undefined || !vis(q.x, q.y) ? null : { box, xf: G.xf(sx(box[0]), sy(box[1]), box[2], box[3]),
        U: { u_t: t, u_open: openTex(m), u_cliff: cliffTex(m), u_lava: lavaTex(m), u_map: [MW, MH], u_box: box, u_src: [cx, q.y], u_kind: kind, u_seed: q.cell % 97, u_wide: Math.max(q.w * TILE * 0.36, kind ? 0 : 18), u_fall: fallU(m) } }; };
    for (const q of m.lavaFeatures || []) { const got = lavaSrc(q); if (!got) continue; const { box, xf, U } = got;
      G.draw(L.P.magmasrc, Object.assign(U, { u_mode: 0 }), xf); G.blend('emit'); G.draw(L.P.magmasrc, Object.assign(U, { u_mode: 1 }), xf); G.blend();
      L.anchor('magma_' + q.kind, [sx(q.x), sy(q.y)], [xf[6] + xf[0] * (q.x - box[0]) / box[2], xf[7] + xf[4] * (q.y - box[1]) / box[3]], 2); }
    // a cave's sources: a fall down a top wall, a breach in a side wall, a spring under the rock (CAVE_SRC)
    for (const q of m.waterFeatures || []) { const kind = SRC_KIND[q.kind]; if (kind === undefined || !vis(q.x, q.y)) continue;
      const box = kind ? [q.x - 48, q.y - 48, 96, 96] : [q.x - 48, q.y - 100, 96, 150], xf = G.xf(sx(box[0]), sy(box[1]), box[2], box[3]);
      const U = { u_t: t, u_open: openTex(m), u_water: waterTex(m), u_wet: 1, u_map: [MW, MH], u_box: box, u_src: [q.x, q.y], u_dir: SRC_DIR[q.dir], u_kind: kind, u_seed: q.cell % 97 };
      G.draw(L.P.cavesrc, Object.assign(U, { u_mode: 0 }), xf); G.blend('emit'); G.draw(L.P.cavesrc, Object.assign(U, { u_mode: 1 }), xf); G.blend();
      L.anchor('cave_' + q.kind, [sx(q.x), sy(q.y)], [xf[6] + xf[0] * (q.x - box[0]) / box[2], xf[7] + xf[4] * (q.y - box[1]) / box[3]], 2); }
    for (const e of ST.ev) { const a = GT - e.t;
      if (e.k === 'whirl' && a >= 0 && a < 0.48) Y.push([e.y - 1000, () => { G.blend('emit'); whirlFx(e, a, 0); G.blend(); }]);
    }
    for (const p of R.proj) if (p.own === 'hero' && p.k === 'fire' && vis(p.x, p.y)) Y.push([p.y + 20, () => fireFx(p)]);
    // the colossus's boulder in flight and the eruption's rocks falling (TASKS 413): over everything, their shadows on the floor
    for (const q of R.rocks || []) { if (q.x === undefined || GT < q.t0 || !known(q.x, q.y)) continue; const big = q.kind === 'boulder', n = big ? 'boulder_mg_a' : 'boulder_mg_b', [w0, h0] = SZ(n), k = big ? 0.42 * D.ENEMIES.boss_colossus.h / w0 : 0.95;
      const f = big ? Math.min(1, (GT - q.t0) / (q.t - q.t0)) : SS(0, 1, (GT - (q.t - 0.4)) / 0.4), gx = big ? q.sx + (q.x - q.sx) * f : q.x, gy = big ? q.gy + (q.y - q.gy) * f : q.y, z = big ? q.z * (1 - f) + 4 * 130 * f * (1 - f) : 640 * (1 - f * f);
      Y.push([gy - 60, () => L.shadow(sx(gx), sy(gy) + 2, q.r * (0.3 + 0.5 * f), q.r * 0.75 * (0.3 + 0.5 * f), 0.5 * SS(0, 1, f))]);
      if (!big && f <= 0) continue;
      if (big) L.joint('en' + q.owner, 'rock', [sx(gx), sy(gy) - z]);
      Y.push([1e8, () => L.inked(() => L.sprite(n, 0, 0, { m: M.of(M.t(sx(gx), sy(gy) - z), M.r((GT - q.t0) * (big ? 4 : 7) * (q.id % 2 ? 1 : -1))), w: w0 * k, h: h0 * k, pivot: [w0 * k / 2, h0 * k * 0.6] }), { r: 2, n: 8, col: [0.024, 0.02, 0.024], dy: 0 })]); }
    // a salamander's fire on the floor (TASKS 408): low tongues of flame that flare up as it lands and die down over its last third
    for (const p of R.fires || []) if (p.kind !== 'pool' && vis(p.x, p.y) && known(p.x, p.y)) Y.push([p.y, () => { const u = GT - p.t0, k = SS(0, 0.15, u) * (1 - SS(0.6, 1, u / p.t));
      flames([0, 1, 2].map((j) => { const f = k * (0.75 + 0.25 * Math.sin(t * 9 + p.id + j * 2.1)); return [sx(p.x) + (rnd(p.id, j) - 0.5) * p.r * 1.2, sy(p.y) + (rnd(p.id, j + 3) - 0.5) * p.r * p.ry, 10 * f + 2, (14 + 8 * rnd(p.id, j + 6)) * f, [1, 0.5, 0.15], p.id * 3 + j, 2 * Math.sin(t * 2 + j)]; })); }]);
    // a skeleton archer's arrow (TASKS 311): the painted arrow along its flight, a faint streak of air behind it
    for (const p of R.proj) if (p.k === 'arrow' && vis(p.x, p.y) && known(p.x, p.y)) Y.push([p.y + p.gz, () => { const a = Math.atan2(p.vy, p.vx), ah = ARROW_H, aw = ah * G.tex('skel_arrow').w / G.tex('skel_arrow').h, x = sx(p.x), y = sy(p.y);
      L.solid(x, y, 26, 2, [0.75, 0.75, 0.7], a + Math.PI, 0, 1, 0.18 * SS(0, 0.05, GT - p.t0));
      L.inked(() => L.sprite('skel_arrow', 0, 0, { m: M.of(M.t(x, y), M.r(a + Math.PI / 2)), w: aw, h: ah, pivot: [aw / 2, ah * 0.1] }), { r: 1.5, n: 6, col: [0.024, 0.02, 0.024], dy: 0 }); }]);
    const jig = (id) => knocked[id] && knockOf(knocked[id], GT);
    // the painted wax is near white and outshone the fight; dimmed, the flames stay the brightest thing on a candle
    const WAX = { grade: [0.8, 0.55, 0, 1] }, WAX_T = { grade: [0.9, 0.8, 0, 1] };
    // candles standing on a table are one painted piece with it (table_candles): the pair drawn apart never sat right
    const onTable = (c) => m.decor.find((t) => t.n === 'table' && Math.abs(t.x - c.x) <= 6 && c.y - t.y === 1);
    const lit = new Set(m.decor.filter((c) => c.n === 'candles' && c.lift).map(onTable).filter(Boolean));
    // a chain fence on the plateau's edge (TASKS 405): iron posts with a cap, two chains of links sagging between them, on the art grid
    // (struck or brushed, TASKS 466, its chains swing: the sag beats and dies away)
    const fence = (d, i) => { const n = Math.max(1, Math.round(d.len / 40)), step = d.len / n, X0 = sx(d.x), Y0 = sy(d.y), px2 = (v) => Math.round(v / PIX) * PIX;
      const e = knocked['d' + i], ka = e ? GT - e.t : 9, swing = ka < 1.6 ? (e.touch ? 2.5 : 5) * Math.exp(-2.2 * ka) * Math.sin(11 * ka) : 0;
      for (let i = 0; i < n; i++) for (const [up, sag] of [[24, 7], [13, 5]]) { const a = X0 + i * step, len = step;
        for (let u = 4; u < len - 2; u += 4) { const q = u / len, y = Y0 - up + (sag + swing) * 4 * q * (1 - q), lk = (u / 4) % 2;
          L.solid(px2(a + u), px2(y) + PIX, lk ? PIX * 2 : PIX, PIX, [0.02, 0.018, 0.02]); L.solid(px2(a + u), px2(y), lk ? PIX * 2 : PIX, PIX, lk ? [0.36, 0.32, 0.3] : [0.55, 0.5, 0.46]); } }
      for (let i = 0; i <= n; i++) { const X = px2(X0 + i * step) - PIX;
        L.solid(X - PIX, px2(Y0 - 30), PIX * 4, 30, [0.02, 0.018, 0.02]); L.solid(X, px2(Y0 - 28), PIX * 2, 28, [0.2, 0.18, 0.17]); L.solid(X, px2(Y0 - 28), PIX, 28, [0.34, 0.31, 0.29]);
        L.solid(X - PIX, px2(Y0 - 34), PIX * 4, PIX * 2, [0.12, 0.11, 0.1]); } };
    m.decor.forEach((d, i) => { if (d.n === 'fence_mg' && vis(d.x + d.len / 2, d.y) && !hid(d)) Y.push([d.y, () => fence(d, i)]); });
    if (GATE) for (const q of DUNGEON.portalRing(GATE.x, GATE.y, GATE.open || 0)) if (vis(q.x, q.y) && known(q.x, q.y)) Y.push([q.y, () => drawProp(q.n, sx(q.x), sy(q.y), { dy: 4, k: q.s })]);
    m.decor.forEach((d, i) => { if ((!d.wall || d.n === 'shop_sign') && d.secret === undefined && d.n !== 'bones' && !d.steps && d.n !== 'fence_mg' && !(d.n === 'candles' && d.lift && onTable(d)) && vis(d.x, d.y) && !hid(d)) Y.push([d.y, () => drawProp(lit.has(d) ? 'table_candles' : d.n, sx(d.x), sy(d.y) - (d.lift || 0), { dy: 4, k: GLOW[d.n] || d.role === 'edge' || m.town ? d.s || 1 : 1, flip: d.role === 'edge' && !!d.f, j: jig('d' + i), u: lit.has(d) ? WAX_T : d.n === 'candles' ? WAX : /^shroom_[ab]$/.test(d.n) ? { grade: [0.9, 0.72, 0, 1] } : undefined })]); });   // lift: candles standing on a table
    // a plain banner hangs still (only a secret's banner stirs in a draught); struck, it swings on its rod and settles
    m.decor.forEach((d, i) => { if (!d.wall || d.n !== 'banner' || d.secret !== undefined || !vis(d.x, d.y) || hid(d)) return; const [w, hh] = SZ('banner'), e = knocked['d' + i], a = e ? GT - e.t : 9;
      const rot = a < 1.5 ? e.s * 0.16 * Math.exp(-2.4 * a) * Math.sin(8 * a) : 0;
      Y.push([d.y - 38, () => L.sprite('banner', 0, 0, { m: M.of(M.t(sx(d.x), sy(d.y + 8 - hh)), M.r(rot)), w, h: hh, pivot: [w / 2, 0] })]); });
    for (const c of R.chests) if (vis(c.x, c.y) && !hid(c)) Y.push([c.y, () => { const op = c.open ? SS(0, 0.18, GT - (c.openT || -9)) : 0; L.shadow(sx(c.x), sy(c.y) + 2, 22, 6, 0.5);
      // the gold chest's coins are painted in their own flat golds: the tier's lift would melt them into one orange heap
      const gold = op > 0.5 && c.gold && window.ASSETS.chest_open_gold;
      drawProp(gold ? 'chest_open_gold' : op > 0.5 ? 'chest_open' : 'chest', sx(c.x), sy(c.y), { dy: 4, k: c.tier >= 2 ? 1.15 : 1, u: { grade: gold ? [1, 1, 0, 1] : c.tier === 3 ? [1.2, 1.12, 0, 1.1] : c.tier === 2 ? [1.15, 1.08, 0, 1.05] : [1, 1, 0, 1] } }); }]);
    for (const p of R.pots) { if (!vis(p.x, p.y) || hid(p)) continue; if (p.hp > 0) Y.push([p.y, () => { L.shadow(sx(p.x), sy(p.y) + 2, 14, 5, 0.45); drawProp(PROP_H[p.kind], sx(p.x), sy(p.y), { dy: 4 });
      if (p.kind === 'gold' || p.kind === 'goldpile') emitted((a) => drawProp(PROP_H[p.kind], sx(p.x), sy(p.y), { dy: 4, u: { alpha: a, tint: GOLD_TINT } })); }]); }
    // lean: the flame's tip shifted sideways (px), its base stays on the wick
    // fires [x, y, w, hh, col, seed, lean]: emissive, they replace what is behind them and the light map leaves them unlit
    const flames = (fs) => { const xf = ([x, y, w, hh, , , lean = 0]) => [w, 0, 0, -lean, hh, 0, x - w / 2 + lean, y - hh, 1];
      G.blend('emit'); for (const f of fs) G.draw(L.P.flame, { u_t: t, u_seed: f[5], u_amt: 1, u_col: f[4] }, xf(f)); G.blend(); };
    const flameB = (...f) => flames([f]);
    // a sconce's fire warms the stone round it: painted onto the wall before the flame, so the flame's core stays clean
    const halo = (x, y, col, i) => { if (col[0] >= col[2]) L.glow(x, y - 16, 52, col, 0.2 * flick(i), 3.0); };
    // a struck fire flares and leans away from the blow, swings back past upright once and settles
    const blown = (id, hh) => { const e = knocked[id], a = e ? GT - e.t : 9; return a < 1.2 ? { fl: 1 + 0.55 * Math.exp(-4 * a), lean: e.s * hh * 0.45 * Math.exp(-3.5 * a) * Math.cos(7 * a) } : { fl: 1, lean: 0 }; };
    for (const b of bandX) Y.push(b);
    // water weed stands up out of the water, its foot under the surface, stirring in the slow current
    for (const o of m.flora || []) if (o.n === 'weed_cv' && vis(o.x, o.y)) Y.push([o.y, () => { const [w0, h0] = SZ('weed_cv'), w = w0 * o.s, hh = h0 * o.s * 0.86, sd = o.x * 0.37 + o.y * 0.11;
      ripple(o.x, o.y, w * 0.45, sd, 0.2);
      L.sprite('weed_cv', ev2(sx(o.x)) - w / 2, ev2(sy(o.y)) - hh, { w, h: hh, rot: 0.035 * Math.sin(t * 0.9 + sd), pivot: [w / 2, hh], src: [0, 0, 1, 0.86], flip: !!o.f, u: { grade: [0.9, 0.9, 0, 1] } }); }]);
    // the secrets' covers: a banner that sways in the draught and falls when torn, a bookshelf that breaks; a wall worked by a
    // mechanism sinks into the floor (a top wall's face slides down, other sides' rock settles away)
    (m.secrets || []).forEach((q, i) => { if (!vis(q.x, q.y) || inSecret(q)) return; const kind = q.kind || 'crack', a = q.open ? GT - (q.openT ?? -9) : -1;
      if (kind === 'banner') { const [w, hh] = SZ('banner'), top = q.y + 6 - hh;
        if (!q.open) { const near = 1 - SS(50, 170, Math.hypot(h.x - q.x, h.y - q.y)), rot = (0.006 + 0.035 * near) * Math.sin(t * 2.1 + i) + 0.01 * near * Math.sin(t * 5.3);
          Y.push([q.y - 40, () => L.sprite('banner', 0, 0, { m: M.of(M.t(sx(q.x), sy(top)), M.r(rot)), w, h: hh, pivot: [w / 2, 0] })]); }
        else if (a < 0.5) { const p = a / 0.5; Y.push([q.y - 40, () => L.sprite('banner', 0, 0, { m: M.of(M.t(sx(q.x) + 10 * p, sy(top) + 30 * p * p), M.r(0.5 * p * p)), w, h: hh * (1 - 0.5 * p * p), pivot: [w / 2, 0] })]); }
        else Y.push([q.y - 60, () => L.sprite('banner', sx(q.x) - w * 0.55 + 10, sy(q.y) + 4, { w: w * 1.1, h: hh * 0.32, u: { grade: [0.8, 0.75, 0, 1] } })]); }
      if (kind === 'shelf') { const k = m.decor.findIndex((o) => o.secret === i), d = m.decor[k]; if (!d || d.broken) return;
        Y.push([d.y, () => drawProp('bookshelf', sx(d.x), sy(d.y), { dy: 4, j: jig('d' + k) })]); }
      if (kind === 'lever' && q.open && a < 1.8) { const p = SS(0.15, 1.6, a), xs = q.wall.map((c) => c[0]), ys = q.wall.map((c) => c[1]), jit = Math.sin(GT * 70) * 1.5 * (1 - p);
        const x0 = Math.min(...xs) * TILE, x1 = (Math.max(...xs) + 1) * TILE, y0 = Math.min(...ys) * TILE, y1 = (Math.max(...ys) + 1) * TILE;
        if (q.dir === 'u') { const TSW = 224, Hf = (y1 - y0) * (1 - p), u0 = (x0 % TSW) / TSW, v0 = (y0 % TSW) / TSW;
          if (Hf > 0.5) Y.push([q.y - 1, () => { L.sprite(B.wall, sx(x0) + jit, sy(y0) + (y1 - y0) * p, { w: x1 - x0, h: Hf, src: [u0, v0, u0 + (x1 - x0) / TSW, v0 + Hf / TSW], u: { grade: [0.9, 1.05, 0, 1.05], tint: [B.tint[0], B.tint[1], B.tint[2], 1] } });
            L.solid(sx(x0) + jit, sy(y0) + (y1 - y0) * p, x1 - x0, 3, [0.02, 0.015, 0.02], 0, 0, 0, 0.75); }]); }
        else Y.push([q.y - 1, () => { const u0 = (x0 % 96) / 96, v0 = (y0 % 96) / 96; L.sprite(B.top, sx(x0) + jit, sy(y0) + 6 * p, { w: x1 - x0, h: y1 - y0, src: [u0, v0, u0 + (x1 - x0) / 96, v0 + (y1 - y0) / 96], u: { grade: [0.55, TOP_LIFT * (1.0 - 0.4 * p), 0, 1], tint: topTint(B), alpha: 1 - p } }); }]); } });
    // doors (TASKS 77, 78). Two views of one leaf: face-on (door_leaf) and edge-on (door_edge_a seen from the left, _b from the
    // right; one painting each, never mirrored, so the light stays top-left). A top wall's door stands face-on in its arch and opens
    // edge-on along the corridor's left side; a bottom wall's the same without the arch. A side wall's stands edge-on in the gap
    // (the wall's own flat top is its jambs) and opens face-on, in shadow, against the corridor's back wall. The swing cross-fades
    for (const d of m.doors || []) { if (!vis(d.x, d.y)) continue; const i = m.doors.indexOf(d), lock = SIM.Q.doorLock(m, d);
      const a = d.open ? GT - (d.openT ?? -9) : -1, p = d.open ? 1 - Math.pow(1 - Math.min(1, a / (d.kick ? 0.16 : 0.32)), 3) : 0;
      const bump = ST.ev.find((e) => e.k === 'locked' && e.i === i && GT - e.t >= 0 && GT - e.t < 0.3), jit = bump ? Math.sin((GT - bump.t) * 90) * 2 * (1 - (GT - bump.t) / 0.3) : 0;
      const side = d.dir === 'l' || d.dir === 'r', s = d.dir === 'r' ? 1 : -1, X = sx(d.x) + jit, un = ST.ev.find((e) => e.k === 'unlatch' && e.i === i && GT - e.t >= 0 && GT - e.t < 0.7);
      const fa = 1 - SS(0.15, 0.55, p), ea = SS(0.35, 0.8, p);   // the two views overlap only briefly mid-swing
      const E = DEDGE, k = E.k, ew = ASSETS.door_edge_a.w * k, eh = ASSETS.door_edge_a.h * k;
      // the lock on the leaf: a padlock, or the iron bar along its bands (face-on level, edge-on on the bands' slope)
      const locks = (cx, cy, ang, len, al) => { if (!lock && !un) return;
        if (lock && lock.kind === 'lever') { const bh = Math.max(9, len * ASSETS.door_bar.h / ASSETS.door_bar.w); L.sprite('door_bar', 0, 0, { m: [Math.cos(ang), Math.sin(ang), 0, 1, cx - Math.cos(ang) * len / 2, cy - Math.sin(ang) * len / 2 - bh / 2], w: len / Math.cos(ang), h: bh, u: { alpha: al, grade: [1.35, 0.6, 0, 1] } }); }
        const [w, hh] = SZ('padlock');
        if (lock && lock.kind === 'key') L.sprite('padlock', cx - w / 2, cy - hh / 2, { w, h: hh, u: { alpha: al } });
        if (un) { const q = GT - un.t; L.sprite('padlock', cx - w / 2 + 30 * q, cy - hh / 2 - 60 * q + 260 * q * q, { w, h: hh, rot: 4 * q, pivot: [w / 2, hh / 2], u: { alpha: 1 - SS(0.5, 0.7, q) } }); } };
      // an edge-on leaf drawn in horizontal strips, each sorted by the foot of its own rows: the far end goes behind whoever stands
      // beside the door, the near end in front of them
      const edge = (n, left, topW, al, lk) => { const farW = topW + E.far * k, nearW = topW + E.near * k, H0 = ASSETS[n].h;
        for (let j = 0; j < 4; j++) { const r0 = H0 * j / 4, r1 = H0 * (j + 1) / 4, key = Math.max(farW, Math.min(nearW, topW + r1 * k));
          Y.push([key, () => { L.sprite(n, left, sy(topW) + r0 * k, { w: ew, h: (r1 - r0) * k, src: [0, r0 / H0, 1, r1 / H0], u: { alpha: al } });
            if (lk && j === 2) { const a0 = n === 'door_edge_a' ? E.band : -E.band, cx = left + (n === 'door_edge_a' ? E.lock[0] : ASSETS[n].w - E.lock[0]) * k; locks(cx, sy(topW) + E.lock[1] * k, a0, ew * 0.95, al); } }]); } };
      if (side) {
        const nearW = d.y + TILE, topW = nearW - E.near * k, n = s > 0 ? 'door_edge_a' : 'door_edge_b';
        if (p < 1) edge(n, X - ew / 2 + s * ew * 0.45, topW, fa, true);   // in the door's own cells: the room's fog never dims it
        // open, it stands ajar at ~60°, hinged at the gap's far end, its free edge clearly nearer the camera and in shadow (≤ 0.7 of a
        // shut leaf's brightness, doors_r2): it reads as swung back, never as a door in the corridor's wall
        if (p > 0) { const fy = sy(d.y - TILE) + 4, ux = s * Math.sin(1.05) * DOOR.w, uy = Math.cos(1.05) * DOOR.w;
          Y.push([d.y - TILE + 4 + uy, () => { for (let j = 0; j < 4; j++) L.shadow(X + ux * (j + 0.5) / 4, fy + uy * (j + 0.5) / 4 + 2, DOOR.w / 7, 4, 0.5 * p);
            L.sprite('door_leaf', 0, 0, { m: [ux / DOOR.w, uy / DOOR.w, 0, 1, X, fy - DOOR.h], w: DOOR.w, h: DOOR.h, flip: s < 0, u: { alpha: ea, grade: [0.45, 0.7, 0, 1] } }); }]); }
        continue; }
      const foot = sy(d.y) + (d.dir === 'd' ? TILE : 0), footW = d.y + (d.dir === 'd' ? TILE : 0);
      if (p < 1) Y.push([footW, () => { if (d.dir === 'd') L.shadow(X, foot + 1, DOOR.w / 2 + 2, 4, 0.5 * (1 - p));
        L.sprite('door_leaf', X - DOOR.w / 2, foot - DOOR.h, { w: DOOR.w, h: DOOR.h, u: { alpha: fa, grade: d.dir === 'd' ? [0.8, 0.9, 0, 1] : [1, 1, 0, 1] } });
        locks(X - DOOR.w * 0.04, foot - DOOR.h * 0.36, 0, d.dir === 'u' ? DOOR.fw * 0.78 : DOOR.w + 6, fa); }]);
      // open: hinged at the left jamb, the leaf runs off into the corridor, up from a top wall (seen from the right, its near end
      // at the hinge) or down from a bottom wall (seen from the left, its far end at the hinge)
      if (p > 0) { if (d.dir === 'u') edge('door_edge_b', X - DOOR.w / 2 - E.nearX * k, d.y - E.near * k, ea);
        else edge('door_edge_a', X - DOOR.w / 2 - E.farX * k, d.y + 4 - E.far * k, ea); }
      if (d.dir === 'u' && !B.cave) Y.push([d.y + 0.5, () => L.sprite('door_frame', X - DOOR.fw / 2, foot - DOOR.fh + 3, { w: DOOR.fw, h: DOOR.fh })]); }
    // a locked room's lever on a top wall: up until pulled, then down for good
    for (const Lk of m.locks || []) { const lv = Lk.lever; if (Lk.kind !== 'lever' || !lv || !vis(lv.x, lv.y)) continue;
      const down = Lk.open && GT - (Lk.openT ?? -9) > 0.08, n = down ? 'lever_down' : 'lever_up', [ax, ay] = down ? [101, 92] : [189, 164], k = 30 / 190, A0 = ASSETS[n];
      Y.push([lv.y - 20, () => L.sprite(n, sx(lv.x) - ax * k, sy(lv.y) - ay * k, { w: A0.w * k, h: A0.h * k })]); }
    m.torches.forEach((tc, i) => { if (!vis(tc.x, tc.y) || hid(tc)) return; const col = torchCol(m, tc), lit = known(tc.x, tc.y), j = jig('t' + i), { fl, lean } = blown('t' + i, 36);
      if (tc.kind === 'wall' && tc.side) Y.push([tc.y - 20, () => { drawProp('torch_sconce', sx(tc.x), sy(tc.y) + 16, { flip: tc.side > 0, j }); if (lit) { halo(sx(tc.x) - tc.side * 9 + (j ? j.dx : 0), sy(tc.y) - 6, col, i); flameB(sx(tc.x) - tc.side * 9 + (j ? j.dx : 0), sy(tc.y) - 6, 20 * fl, 36 * fl, col, i, lean); } }]);
      else if (tc.kind === 'wall' && tc.lever !== undefined) { const q = m.secrets[tc.lever], pull = q && q.open ? SS(0, 0.22, GT - q.openT) : 0, rot = 0.07 + 0.6 * pull, c = Math.cos(rot), s = Math.sin(rot);
        Y.push([tc.y - 20, () => { drawProp('torch_sconce', sx(tc.x), sy(tc.y) + 16, { j: { rot, dx: 0, sy: 1 } }); if (lit) flameB(sx(tc.x) + 3 * c + 41 * s + 7 * pull, sy(tc.y) + 37 + 3 * s - 41 * c - 6 * pull, 20 * fl, 36 * fl, col, i, lean); }]); }
      else if (tc.kind === 'wall') Y.push([tc.y - 20, () => { drawProp('torch_sconce', sx(tc.x), sy(tc.y) + 16, { j }); if (lit) { halo(sx(tc.x) + 3 + (j ? j.dx + Math.sin(j.rot) * 40 : 0), sy(tc.y) - 4, col, i); flameB(sx(tc.x) + 3 + (j ? j.dx + Math.sin(j.rot) * 40 : 0), sy(tc.y) - 4, 20 * fl, 36 * fl, col, i, lean); } }]);
      else { const big = tc.kind === 'fire', up = big ? 44 : 32, bl = blown('t' + i, big ? 80 : 50);
        // the cave's camp fire burns in a ring of stones on the ground (TASKS 306), not in a brazier
        const camp = big && (B.cave || B.town), lo = camp ? 12 : up;
        Y.push([tc.y, () => { L.shadow(sx(tc.x), sy(tc.y) + 2, big ? 30 : 18, 6, 0.5); drawProp(camp ? (B.town ? 'campfire_tw' : 'campfire_cv') : 'brazier', sx(tc.x), sy(tc.y), { k: big && !camp ? 1.35 : 1, dy: camp ? 10 : 4, j });
          if (lit) flameB(sx(tc.x) + (j ? j.dx + Math.sin(j.rot) * lo : 0), sy(tc.y) - lo, (big ? 44 : 26) * bl.fl, (big ? 64 : 40) * bl.fl, col, i, bl.lean); }]); } });
    for (const d of m.decor) { const t2 = d.n === 'candles' && d.lift && onTable(d); if (t2 && vis(d.x, d.y) && known(d.x, d.y) && !hid(d)) Y.push([d.y + 1, () => flames(TABLE_WICKS.map(([ox, oy]) => [sx(t2.x) + ox, sy(t2.y) + 4 - oy + 2, 7, 12, [1, 0.7, 0.35], d.x + ox]))]); }
    for (const d of m.decor) if (d.n === 'candles' && (d.outUntil || 0) <= GT && !(d.lift && onTable(d)) && vis(d.x, d.y) && known(d.x, d.y) && !hid(d)) Y.push([d.y + 1, () => flames([0, 1, 2].map((k) => [sx(d.x) + [-8, 0, 9][k], sy(d.y) - (d.lift || 0) - [16, 28, 18][k], 9, 15, [1, 0.7, 0.35], d.x + k]))]);
    // standing lights (TASKS 194): their fires ride the prop when it is knocked
    m.decor.forEach((d, i) => { const S0 = STAND[d.n]; if (!S0 || !vis(d.x, d.y) || !known(d.x, d.y) || hid(d)) return; const j = jig('d' + i), col = d.n === 'torch_stand' ? torchCol(m, d) : CANDLE;
      Y.push([d.y + 1, () => flames(S0.map(([ox, up, w, hh], k) => [sx(d.x) + ox + (j ? j.dx + Math.sin(j.rot) * up : 0), sy(d.y) + 4 - up, w, hh, col, d.x + 7 * k]))]); });
    // the shop: the merchant behind his counter (it hides his legs), the scales and his coins on top of it
    const sh = m.shop;
    if (sh && vis(sh.x, sh.y)) { const ds = Math.hypot(h.x - sh.x, h.y - sh.y), near = 1 - SS(140, 300, ds), look = Math.max(-1, Math.min(1, (h.x - sh.x) / 120));
      Y.push([sh.y, () => { L.shadow(sx(sh.x), sy(sh.y) + 2, 26, 6, 0.4);
        L.inked(() => MONSTERS.merchant({ id: 'merchant', x: sx(sh.x), y: sy(sh.y), H: SZ('merchant')[1], t: GT, look, near, greetT: Math.max(R.shop.greetT, R.town ? R.shop.callT ?? -9 : -9), tradeT: R.shop.tradeT, hitT: R.shop.hitT, seed: m.seed % 7, U: {} }), { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 }); }]);
      Y.push([sh.counter.y, () => { const c = sh.counter, [cw] = SZ('shop_counter'); L.shadow(sx(c.x), sy(c.y) + 2, cw * 0.5, 7, 0.5); drawProp('shop_counter', sx(c.x), sy(c.y), { dy: 4 });
        const top = sy(c.y) - 24 - (SZ('shop_counter')[1] - 42);
        drawProp('shop_scales', sx(c.x) - 26, top); drawProp('shop_gems', sx(c.x) + 28, top); }]); }
    // the stairs back up (TASKS 1027): a flight rising into a dark arch, the hero walks up to its lowest step
    if (m.up && vis(m.up.x, m.up.y)) { const u = m.up, st = (u.free ? 'stairs_up_free' : 'stairs_up') + (m.biome === 'magma' ? '_mg' : ''), [w, hh] = SZ(st); if (m.biome === 'magma') PROP_BAS.push([st, sx(u.x) - w / 2, sy(u.y) + 18 - hh, w, hh, false]); Y.push([u.y + 14, () => L.inked(() => L.sprite(st, sx(u.x) - w / 2, sy(u.y) + 18 - hh, { w, h: hh }), { r: 2, n: 8, col: [0.06, 0.04, 0.05], dy: 0 })]); }
    // a waystone (TASKS 1009): a rune obelisk by the start; its runes light once it is touched
    if (m.way && vis(m.way.x, m.way.y)) { const [w, hh] = SZ('waystone'), u = m.way, on = (R.ways || []).includes(m.floor), woke = ST.ev.find((e) => e.k === 'waystone');
      const k = !on ? 0 : woke && GT - woke.t < 0.8 ? SS(0, 0.8, GT - woke.t) : 0.8 + 0.2 * Math.sin(t * 1.7);
      Y.push([u.y + 6, () => { const X = sx(u.x) - w / 2, Yt = sy(u.y) + 10 - hh; L.shadow(sx(u.x), sy(u.y) + 4, w * 0.28, 6, 0.5);
        L.inked(() => L.sprite('waystone', X, Yt, { w, h: hh, u: { tint: [0.6, 0.58, 0.66, 1] } }), { r: 2, n: 8, col: [0.06, 0.04, 0.05], dy: 0 });
        if (k > 0.01) { G.blend('emit'); for (let j = 0; j < 2; j++) L.sprite('waystone_runes', X, Yt, { w, h: hh, u: { alpha: k } }); G.blend();
          G.blend('add'); L.glow(X + 0.455 * w, Yt + 0.48 * hh, 0.3 * hh, [0.45, 0.65, 1], 0.22 * k, 2.4); G.blend(); } }]); }
    // the townsfolk (TASKS 1014–1015) at their work, on their rounds, turned to the hero who speaks to them
    if (m.town) (R.folk || FOLK0(m)).forEach((f) => { const n = m.town.npcs[f.i]; if (vis(f.x, f.y)) drawFolk(f, n, m, R, GT, Y, sx, sy); });
    for (const s of R.shrines) if (vis(s.x, s.y)) Y.push([s.y, () => { L.shadow(sx(s.x), sy(s.y) + 2, 26, 7, 0.5); drawProp('altar', sx(s.x), sy(s.y), { dy: 6, u: { grade: s.used ? [0.5, 0.7, 0, 1] : [1, 1, 0, 1] } }); }]);
    // each spike slides out of its hole (only the part above the lip shows): tips peek and rattle just before the strike,
    // then the sheaves shoot up for the up phase the sim hurts in
    for (const tp of m.traps) { if (!vis(tp.x, tp.y)) continue; const ph = ((GT / 2.4 + tp.ph) % 1 + 1) % 1;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const q = ph - j * 0.01, up = q < 0.29 && q > 0 ? SS(0, 0.025, q) * (1 - SS(0.25, 0.29, q)) : 0, k = Math.max(up, 0.3 * SS(0.82, 0.86, ph));
        if (k < 0.02) continue; const bx = tp.x - TILE + TRAP_HOLE.x[i] * 2 * TILE, by = tp.y - TILE + TRAP_HOLE.y[j] * 2 * TILE, jit = up < 0.5 && ph > 0.82 ? Math.sin(GT * 70 + i * 2 + j) * 0.7 : 0;
        Y.push([by + 6, () => { for (const [dx, dy, sw, sh, tex] of TRAP_SPIKE) L.sprite(tex, sx(bx + dx) - sw / 2 + jit, sy(by + dy) - k * sh, { w: sw, h: k * sh, src: [0, 0, 1, k] }); }]); } }
    // a falling rock (TASKS 406) drops the last FALL_DROP s of its warning, from high over its shadow
    for (const z of m.hazards || []) { if (z.k !== 'fall' || !vis(z.x, z.y)) continue; const H = D.HAZ.fall, w = D.hazClock(z, GT) - (z.per - H.warn); if (w < H.warn - FALL_DROP) continue;
      // (TASKS 485: a dark rock over the dark floor for 0.18 s was not seen; now longer, in a glowing rim, a dust trail over it)
      const p = (w - (H.warn - FALL_DROP)) / FALL_DROP, [rw, rh] = SZ('boulder_mg_b'); Y.push([z.y + 2, () => { const yy = sy(z.y) - rh + 8 - 360 * (1 - p * p);
        for (let j = 1; j <= 4; j++) L.puff(sx(z.x) + (rnd(z.x, j) - 0.5) * 8, yy - j * 14 * (0.4 + p), 5 + j * 2, [0.45, 0.38, 0.34], 0.32 * (1 - j / 5), j);
        // (TASKS 1044: rimmed in orange and flat it read as a pit in the floor) a dark tumbling rock, a hot spot on its underside, its
        // shadow under it darkening as it comes
        L.shadow(sx(z.x), sy(z.y) + 2, H.r * (0.35 + 0.45 * p), H.r * H.ry * (0.35 + 0.45 * p), 0.5 + 0.4 * p);
        L.glow(sx(z.x), yy + rh * 0.8, rh * 0.7, [1, 0.5, 0.15], 0.3 + 0.3 * p, 2.4);
        L.inked(() => L.sprite('boulder_mg_b', 0, 0, { m: M.of(M.t(sx(z.x), yy + rh / 2), M.r((1 - p) * 4 + z.x)), w: rw, h: rh, pivot: [rw / 2, rh / 2], u: { grade: [0.1, 0.8, 0, 1] } }), { r: 2, n: 8, col: [0.02, 0.015, 0.02], dy: 0 }); }]); }
    // a body on the floor sorts under everyone standing: lying across the band it would cover the living in front of it
    for (const e of R.en) if (vis(e.x, e.y)) { const fl = e.deadT >= 0 && GT - e.deadT > deathOf(e).dl + deathOf(e).dur; Y.push([e.y - (fl ? 1000 : 0), () => drawEnemy(e, sx(e.x), sy(e.y), GT, t)]); }
    for (const p of R.drops) if (vis(p.x, p.y)) Y.push([p.y + (p.kind === 'item' || p.kind === 'qitem' ? 12 : 0), () => drawDrop(p, sx(p.x), sy(p.y), GT, t)]);   // (an item over the coins spilt beside it: lootvis found a staff under gold)
    Y.push([h.y + (GT - h.atkT >= 0 && GT - h.atkT < 0.2 ? 90 : 0), () => {   // during the strike the blade must read over the target it hits
      L.shadow(sx(h.x), sy(h.y) + 2 + DECK.dy, 20, 6, 0.85);
      if (GT - h.dashT < 0.3) for (let k = 3; k >= 1; k--) { const a = GT - h.dashT; drawHero(h, sx(h.x - h.dashX * k * 22 * SS(0, 0.16, a)), sy(h.y - h.dashY * k * 22 * SS(0, 0.16, a)), GT, st, { alpha: 0.18 * (1 - a / 0.3), id: 'ghost' + k }); }
      // on the magma caves the hero keeps a dark outline the lava's light can't lift and a lit edge toward the lava, so he never melts
      // into it or the warm ground (TASKS 404); elsewhere as before
      const lv = m.cliff && h.deadT < 0 ? HERO.lavaAt(h.x, h.y) : null, hn = lv ? Math.hypot(lv.dx, lv.dy * 1.25) || 1 : 1;
      const heroRim = lv && lv.k > 0.15 ? { dx: Math.round(2 * lv.dx / hn), dy: Math.round(2 * lv.dy * 1.25 / hn), col: [1, 0.6, 0.22].map((v) => v * 0.75 * SS(0.15, 0.8, lv.k)) } : null;
      if (!SC.hide.hero) L.inked(() => drawHero(h, sx(h.x), sy(h.y) + DECK.dy + sinkOf(h, GT, sy(h.y)).dy, GT, st, { cut: sinkOf(h, GT, sy(h.y)).cut, armsUp: sinkOf(h, GT, sy(h.y)).arms }), { r: 2, n: 8, col: [0.024, 0.02, 0.024], dy: 0, emit: !!m.cliff, rim: heroRim });
      // wading (TASKS 323): the water stands over his shins, a wavering foam line along its top
      const heroCell = Math.floor(h.y / TILE) * m.W + Math.floor(h.x / TILE);
      if (caveW && h.deadT < 0 && !dryCrossings.has(heroCell) && SIM.Q.cell(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)) !== 6 && wetSet.has(heroCell)) {
        const X = Math.round(sx(h.x) / PIX) * PIX, Y0 = Math.round(sy(h.y) / PIX) * PIX;
        for (let dy = -10; dy <= 6; dy += PIX) { const hw = Math.round(24 * Math.sqrt(Math.max(0, 1 - ((dy + 2) / 9) ** 2)) / PIX) * PIX; if (hw <= 0) continue;
          L.solid(X - hw, Y0 + dy, 2 * hw, PIX, dy < -8 ? [0.62, 0.84, 0.86] : [0.07, 0.3, 0.42], 0, 0, 0, dy < -8 ? 0.7 : 0.5); }
        for (let k = 0; k < 2; k++) { const ph = (t * 0.9 + k * 0.5) % 1; L.ring(X, Y0 - 2, 14 + 22 * ph, (14 + 22 * ph) * 0.4, [0.62, 0.86, 0.88], 0.5 * (1 - ph), 0.16); }
      }
    }]);
    L.SNAP = 1; try { Y.sort((a, b) => a[0] - b[0]).forEach(([, d]) => d()); } finally { L.SNAP = 0; }
    Object.assign(F, {
      basaltOcc, inSecret, lavaBeat, lavaCells, lavaP, lavaSrc, lavaU, lavaXf, melt, warnOf });
  };
})();
