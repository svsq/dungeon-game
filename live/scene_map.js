// live/scene_map.js — the floor map baked once per floor into a world-size texture: walls, masonry, the town, the lava, water and rock masks.
// One of the scene's files (ARCHITECTURE.md §4.2): names from earlier files come from SCX at load, calls into later ones go through SCX.
(function (root) {
  const SCX = root.SCX;
  const {
    BAKE, D, L, M, SEEN, SS, SZ, TILE, VOID, rnd, zoneAt } = SCX;
  // ---------------- the floor map, baked once per floor into a world-size texture ----------------
  // the wall-top slate is painted dark (raw L≈14): lifted so unlit masses read as cold blue-grey stone, not a black hole
  // the fire biome's tops are dark basalt instead (its seams smoulder in LIT), so it no longer reads as the dungeon gone brown
  const TOP_LIFT = 1.45, topTint = (B) => (B.lava ? [0.8, 0.66, 0.62, 1] : [0.95, 0.97, 1.04, 1]);
  // the town's floor (R-17, TASKS 1004): cobbles on the square and its paths fade into the earth over a ragged edge of 8 px steps,
  // the rails run from under the adit to the mason's yard (the adit's short straight, the diagonal, a short end), the portal's
  // carved disc inside its ring of stones and the enchanter's rune circle under his lectern
  // the town's lights by kind (TASKS 1005): r, colour, strength, dy over the prop's foot, a hot core, and the glow on the art itself
  // [dx, dy, r, alpha]; warm lanterns and the forge, the enchanter's and the altar's cold blue, the crypt's warm breath from below
  // (a light's centre stays on open floor: inside a wall cell the light map's occlusion swallows it)
  // (TASKS 1029: the lanterns became torches, lit by the torches' own code; the forge's glow on its art no longer whitens it)
  const TOWN_LIGHT = { forge: { r: 120, col: [1, 0.5, 0.16], amt: 1.4, dy: 10, core: 48, glow: [-6, -12, 20, 0.85] },
    runes: { r: 150, col: [0.46, 0.58, 0.85], amt: 1.2, dy: 20, core: 28, glow: [0, 8, 26, 0.3] }, altar: { r: 150, col: [0.36, 0.54, 0.95], amt: 1.3, dy: 34, core: 36, glow: [0, -14, 34, 0.5] }, portal: { r: 110, col: [1, 0.58, 0.24], amt: 0.7, dy: 0, core: 30, glow: [0, 0, 30, 0.2] },
    stash: { r: 90, col: [1, 0.8, 0.55], amt: 0.9, dy: 10 }, crypt: { r: 90, col: [1, 0.66, 0.3], amt: 0.3, dy: 40 }, adit: { r: 140, col: [1, 0.72, 0.3], amt: 0.75, dy: -10, core: 24, glow: [-2, -55, 13, 1] }, candle: { r: 90, col: [1, 0.72, 0.36], amt: 0.7, dy: -40, core: 30 } };
  const PAVE_K = 1, PAVE_TS = 160;
  // rail_tw_h's sleeper period in its own pixels: sleepers start every ≈72 px, the first gap's middle at 77 (live/assets size)
  const RAIL = { w: 300, h: 131, u0: 77 / 300, per: 72 };
  // the x of what each townsperson works at, to face it: the child minds the hens, the hens the child
  const TOWN_WORK = { smith: 'anvil', enchanter: 'lectern', keeper: 'fire', guard: 'stairs', porter: 'bin', mason: 'bin', sweeper: 'fire' };
  const TOWN_FACE = (m, n) => { const T = m.town, k = TOWN_WORK[n.role]; if (k) return T.svc[k].x;
    const other = T.npcs.filter((q) => q.role === (n.role === 'hen' ? 'child' : 'hen')).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0]; return other ? other.x : n.x + 1; };
  // the townsfolk before the sim's first step (a QA state made by hand): each at its place, at rest

  // the rails' line through their cells, its corners rounded (two passes of corner-cutting, the ends kept): cut straight the stretches met with a kink (TASKS 1606)
  const railPts = (m) => { let p = m.town.rails.map((k) => [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]);
    for (let n = 0; n < 2; n++) { const q = [p[0]]; for (let i = 1; i < p.length; i++) { const [ax, ay] = p[i - 1], [bx, by] = p[i]; q.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); } q.push(p[p.length - 1]); p = q; } return p; };
  const TOWN_PAVE = (m) => m.town.paveSet || Object.defineProperty(m.town, 'paveSet', { value: new Set(m.town.pave), enumerable: false }).paveSet;
  function townFloor(m, B, c) {
    const P = TOWN_PAVE(m), TS = PAVE_TS, q = TILE / 8;
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { if (c(x, y) !== 1 || P.has(y * m.W + x)) continue;
      let any = false; for (let j = -1; j <= 1 && !any; j++) for (let i = -1; i <= 1; i++) if (P.has((y + j) * m.W + x + i)) { any = true; break; }
      if (!any) continue;
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const px = x + (i + 0.5) / 8, py = y + (j + 0.5) / 8; let d = 9;
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (P.has((y + v) * m.W + x + u)) d = Math.min(d, Math.hypot(Math.max(x + u - px, 0, px - x - u - 1), Math.max(y + v - py, 0, py - y - v - 1)));
        if (d + 0.45 * rnd(x * 4 + i, y * 4 + j) > 0.55) continue;
        const X = x * TILE + i * q, Y = y * TILE + j * q, u0 = (X % TS) / TS, v0 = (Y % TS) / TS;
        L.sprite(B.pave, X, Y, { w: q, h: q, src: [u0, v0, u0 + q / TS, v0 + q / TS], u: { grade: [1, PAVE_K, 0, 1] } }); } }
    // the rails: one sleeper period of the straight piece (a gap's middle to the next, so it repeats without its end caps) laid
    // edge to edge along the line through the rail cells' centres, turned to each stretch, at the piece's own proportions
    const T = m.town, pts = railPts(m), RH = 38, RP = RH * RAIL.per / RAIL.h;
    let carry = 0;
    for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), a = Math.atan2(by - ay, bx - ax);
      let d = carry; for (; d < len; d += RP) { const x = ax + (bx - ax) * d / len, y = ay + (by - ay) * d / len;
        L.sprite('rail_tw_h', 0, 0, { m: M.of(M.t(x, y), M.r(a)), w: RP + 0.5, h: RH, pivot: [RP / 2, RH / 2], src: [RAIL.u0, 0, RAIL.u0 + RAIL.per / RAIL.w, 1], u: { grade: [1, 1.35, 0, 1] } }); } carry = d - len; }
    // the portal's disc and the rune ring lie flat on the floor: squashed to the view's depth (TASKS 1030: drawn round they stood up)
    const disc = (n, o, w, u) => { const [w0, h0] = SZ(n), k = w / w0, h = h0 * k * 0.68; L.puff(o.x, o.y + 4, w * 0.55, [0, 0, 0], 0.25, 3); L.sprite(n, o.x - w / 2, o.y - h / 2, { w, h, u }); };
    // the rune ring's grooves are thin: lifted, so the enchanter's blue light finds them
    disc('disc_tw', T.svc.portal, 2.6 * TILE, { grade: [1, 1.3, 0, 1] }); disc('runes_tw', { x: T.svc.lectern.x, y: T.svc.lectern.y - 2 }, 3 * TILE, { grade: [1, 2.2, 0, 1] });
  }
  function bake(m) {
    const key = mapKey(m); if (BAKE.key === key) return; BAKE.key = key;
    const MW = m.W * TILE, MH = m.H * TILE, B = D.BIOMES[m.biome], changed = cellsChanged(m, BAKE), box = changed && BAKE.tg && BAKE.tg.w === MW && BAKE.tg.h === MH ? changed : null;
    // the shaders read the masks a few cells around each pixel: the falling cells' neighbours repaint, the rest of the map stands
    const clip = (tg) => { if (!box) { G.clip(null); return; } const x = Math.max(0, (box[0] - 8) * TILE), y = Math.max(0, (box[1] - 8) * TILE); G.clip(tg, x, y, Math.min(MW, (box[2] + 9) * TILE) - x, Math.min(MH, (box[3] + 9) * TILE) - y); };
    if (!BAKE.tg || BAKE.tg.w !== MW || BAKE.tg.h !== MH) {
      G.free(BAKE.tg); BAKE.tg = G.target(MW, MH, false);
      if (!BAKE.rec) { const cv = G.canvas(); cv.width = cv.height = 1; BAKE.rec = G.canvasTex('map', cv); }
      BAKE.rec.t = BAKE.tg.t; BAKE.rec.w = MW; BAKE.rec.h = MH; }
    if (m.cliff) { if (!BAKE.face || BAKE.face.vw !== MW || BAKE.face.vh !== MH) { G.free(BAKE.face); BAKE.face = G.target(MW / 2, MH / 2, false, { view: [MW, MH], nearest: true }); }   // on the art grid: a quarter of the bake's memory
      BAKE.mg = { u_fk: B.floorK || 1, u_open: openTex(m), u_water: waterTex(m), u_wet: 0, u_lift: TOP_LIFT, u_map: [MW, MH], u_cliff: cliffTex(m), u_lava: lavaTex(m), u_far: lavaFarTex(m),
        u_hot: lavaGlowTex(m), u_crust: crustTex(m), u_plat: platTex(m), u_lake: lakeTex(m), u_fall: fallU(m), u_step: m.ftype === 'terrace' && !m.ftype2 ? 1 : 0, u_stepm: stepTex(m), u_rows: terrRows(m), u_floor: G.tex(B.floor), u_wall: G.tex(B.wall), u_top: G.tex(B.top), u_shore: G.tex(B.shore) };
      clip(BAKE.face); G.bind(BAKE.face, [0, 0, 0, 1]); G.blend('none'); G.draw(L.P.magma, Object.assign({}, BAKE.mg, { u_out: 1 }), G.xf(0, 0, MW, MH)); }
    clip(BAKE.tg); G.bind(BAKE.tg, [0, 0, 0, 1]); G.blend();
    // (a pit room's chasm, TASKS 374, is its own cell here, 7: deep water's cell in the sim, drawn as a hole in the floor)
    // (a two-level hall's drop, TASKS 375, is its own cell too, 8: the gallery's front face down to the floor below)
    const PIT = new Set(m.pits || []), LEDGE = new Set(m.ledges || []), hid = SIM.Q.secretMask(m), c = (x, y) => { const v = SIM.Q.cell(m, x, y); return v === 4 || hid.has(y * m.W + x) ? 0 : PIT.has(y * m.W + x) ? 7 : LEDGE.has(y * m.W + x) ? 8 : v === 5 || v === 6 ? 1 : v; }, TS = 288, TSW = 224, TST = 96;   // repeat periods must be whole tiles, or a cell straddles the texture edge and smears it              // texture repeat = 256 world px (1024 src px)
    const GALLERY = new Set(); for (const r of m.rooms) if (r.tier) for (let y = r.y; y < r.tier.y; y++) for (let x = r.x; x < r.x + r.w; x++) GALLERY.add(y * m.W + x);
    const GALLERY_FLOOR = D.BIOMES[m.biome === 'arcane' ? 'dungeon' : 'arcane'];
    const RD = rockDist(m);
    const near = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (c(x + i, y + j) === 1 || c(x + i, y + j) === 3) return true; return false; };
    const tile = (tex, x, y, u, ts = TS) => { const u0 = ((x * TILE) % ts) / ts, v0 = ((y * TILE) % ts) / ts; L.sprite(tex, x * TILE, y * TILE, { w: TILE, h: TILE, src: [u0, v0, u0 + TILE / ts, v0 + TILE / ts], u }); };
    const dark = (x, y, w, h, a) => L.solid(x, y, w, h, [0.01, 0.01, 0.015], 0, 0, 0, a);
    if (m.cliff) G.draw(L.P.magma, Object.assign({}, BAKE.mg, { u_out: 0 }), G.xf(0, 0, MW, MH));
    else if (B.cave) G.draw(L.P.cave, { u_open: openTex(m), u_water: waterTex(m), u_wet: m.water.length || m.deep ? 1 : 0, u_lift: TOP_LIFT, u_map: [MW, MH],
      u_floor: G.tex(B.floor), u_wall: G.tex(B.wall), u_top: G.tex(B.top), u_shore: G.tex(B.shore) }, G.xf(0, 0, MW, MH));
    else masonry();
    // the town's ruin tops (TASKS 1029): laid block by block, each a cell, its own shade, the joints dark between them, moss on some
    // of those by the yard; lifted less than the crypt's slate (a lift of 1.45 read as a pale pavement round the yard)
    function townTop(x, y) {
      const k = 0.82 + 0.3 * rnd(x * 7 + 1, y * 13 + 2), moss = RD[y * m.W + x] <= 2 && rnd(x * 3 + 5, y * 5 + 9) < 0.45, X = x * TILE, Y = y * TILE;
      { const u0 = Math.floor(rnd(x * 5 + 7, y * 3 + 11) * 3) / 3, v0 = Math.floor(rnd(x * 3 + 13, y * 7 + 5) * 3) / 3; L.sprite(B.top, x * TILE, y * TILE, { w: TILE, h: TILE, src: [u0, v0, u0 + 1 / 3, v0 + 1 / 3], u: { grade: [0.55, (B.topLift || TOP_LIFT) * k, 0, 1], tint: topTint(B) } }); }
      // the top course is broken: its back edge eaten away block by block where a yard lies behind it (TASKS 1609)
      const brk = c(x, y - 1) === 1 ? [0, 1, 2, 3].map((q) => (rnd(x * 11 + q, y * 3) < 0.45 ? 8 + 8 * Math.floor(rnd(x + q, y * 7) * 2) : 0)) : null;
      // joints fall where the blocks do, off the 32 px cell: a joint on every cell read as a tiled pavement (TASKS 1623)
      for (let q = 0; q < 3; q++) { const bx = X + 2 * Math.floor(rnd(x * 3 + q, y + 41) * 12), by = Y + 2 * Math.floor(rnd(x + 43, y * 3 + q) * 12), bw = 8 + 2 * Math.floor(rnd(x + q, y + 47) * 8), bh = 6 + 2 * Math.floor(rnd(x + 53, y + q) * 5), dark = rnd(x * 9 + q, y * 2 + 3) < 0.55;
        L.solid(bx, by, bw, bh, dark ? [0.02, 0.015, 0.02] : [0.5, 0.39, 0.42], 0, 0, 0, dark ? 0.42 : 0.14); L.solid(bx, by + bh, bw, 2, [0.02, 0.015, 0.02], 0, 0, 0, 0.5); L.solid(bx + bw, by, 2, bh, [0.02, 0.015, 0.02], 0, 0, 0, 0.42); }
      if (brk) brk.forEach((h, q) => { if (!h) return; const X1 = X + q * 8, u0 = (X1 % 224) / 224, v0 = (Y % 224) / 224; L.sprite(B.floor, X1, Y, { w: 8, h, src: [u0, v0, u0 + 8 / 224, v0 + h / 224], u: { grade: [1, B.floorG, 0, 1] } }); });
      if (moss) for (let q = 0; q < 4; q++) L.puff(X + TILE * rnd(x + q, y + 3), Y + TILE * rnd(x + 2, y + q), 5 + 8 * rnd(x + 9, y + q), [0.14, 0.2, 0.05], 0.55, x * 5 + y + q); }
    // a wall takes its masonry whole, so the two tiles never meet inside one run of it (TASKS 1430)
    function wallRun(x, y) { const Y0 = c(x, y + 1) === 0 ? y + 1 : y; let xs = x; while (xs > 0 && c(xs - 1, Y0) === 0 && c(xs - 1, Y0 + 1) !== 0) xs--; return rnd(xs * 3 + 1, Y0 * 5 + 2) < 0.45; }
    function masonry() {
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const v = c(x, y);
        // an accent zone keeps its own stone, near grey and dark (as dark as the tint it lost made it): the colour proper is its hearths'
        // light and the fill, which fades out past the doorway
        // the town's earth repeats every 7 cells: its art pixel ≈2 px like the hero's (TASKS 1030; the old texture's was 4.5)
        if (v === 1 && m.town) { const pv = TOWN_PAVE(m).has(y * m.W + x); tile(pv ? B.pave : B.floor, x, y, { grade: [1, pv ? PAVE_K : B.floorG || 0.96, 0, 1], tint: [1, 1, 1, 1] }, pv ? PAVE_TS : 224); }
        else if (v === 1 && GALLERY.has(y * m.W + x)) tile(GALLERY_FLOOR.floor, x, y, { grade: [1, 1.02, 0, 1], tint: [...GALLERY_FLOOR.tint, 1] }, 192);   // on the wall bricks' scale: at the floor's own 288 the slabs read 1.5 times too big (TASKS 1680)
        else if (v === 1 || v === 3) { const z = zoneAt(m, x, y), Z = D.BIOMES[z]; tile(Z.floor, x, y, { grade: [z === m.biome ? 1 : 0.25, 0.96 * (z === m.biome ? 1 : 0.55 * (Z.dim || 1)), 0, 1], tint: [...Z.tint, z === m.biome ? 1 : 0.35] }); }
        else if (v === 0 && (c(x, y + 1) !== 0 || (c(x, y + 2) !== 0 && c(x, y + 2) !== undefined))) tile(m.town && wallRun(x, y) ? B.wall + '_b' : B.wall, x, y, { grade: m.town ? [0.9, B.wallG[1] * (0.78 + 0.42 * rnd(x * 5 + 1, y * 9 + 4)), 0, 1.05] : [0.9, 1.05, 0, 1.05], tint: [B.tint[0], B.tint[1], B.tint[2], 1] }, TSW);
        else if (v === 0 && RD[y * m.W + x] <= 10 && m.town) townTop(x, y);
        else if (v === 0 && RD[y * m.W + x] <= 3) tile(B.top, x, y, { grade: [0.55, TOP_LIFT, 0, 1], tint: topTint(B) }, TST);
      }
      // a pit (TASKS 374): black below the floor; along its far edge the wall it drops down, the room's own masonry darkening into
      // the dark over a cell and a half, a pale lip where the floor above breaks off over it; a dark edge on the other three sides
      for (const k of PIT) { const x = k % m.W, y = Math.floor(k / m.W), X = x * TILE, Y = y * TILE;
        dark(X, Y, TILE, TILE, 1);
        if (c(x, y - 1) !== 7) { tile(B.wall, x, y, { grade: B.wallG || [0.9, 1.05, 0, 1.05], tint: [B.tint[0], B.tint[1], B.tint[2], 1] }, TSW); for (let q = 0; q < 8; q++) dark(X, Y + q * 4, TILE, 4, q * 0.08); }
        else if (c(x, y - 2) !== 7) { tile(B.wall, x, y, { grade: B.wallG || [0.9, 1.05, 0, 1.05], tint: [B.tint[0], B.tint[1], B.tint[2], 1] }, TSW); for (let q = 0; q < 8; q++) dark(X, Y + q * 4, TILE, 4, Math.min(1, 0.62 + q * 0.06)); } }
      for (const k of PIT) { const x = k % m.W, y = Math.floor(k / m.W), X = x * TILE, Y = y * TILE, lip = (lx, ly, w, h, v, a) => L.solid(lx, ly, w, h, [v, v * 0.94, v * 0.88], 0, 0, 0, a);
        if (c(x, y - 1) !== 7) lip(X, Y - 2, TILE, 2, 0.6, 0.5);
        if (c(x, y + 1) !== 7) lip(X, Y + TILE, TILE, 4, 0.02, 0.55);
        if (c(x - 1, y) !== 7) lip(X - 2, Y, 2, TILE, 0.02, 0.5);
        if (c(x + 1, y) !== 7) lip(X + TILE, Y, 2, TILE, 0.02, 0.5); }
      // an accent zone's stone thins out over the cells past its doorway in 8 px steps, so the threshold has no hard line
      for (const r of m.rooms) if (r.zone) { const Z = D.BIOMES[r.zone], q = TILE / 4;
        for (let y = r.y - 3; y < r.y + r.h + 3; y++) for (let x = r.x - 3; x < r.x + r.w + 3; x++) { if (c(x, y) !== 1 || zoneAt(m, x, y) !== m.biome) continue;
          for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4, d = Math.hypot(Math.max(r.x - px, 0, px - r.x - r.w), Math.max(r.y - py, 0, py - r.y - r.h)), a = 1 - SS(0, 2.6, d);
            if (a < 0.03) continue; const X = x * TILE + i * q, Y = y * TILE + j * q, u0 = (X % TS) / TS, v0 = (Y % TS) / TS;
            L.sprite(Z.floor, X, Y, { w: q, h: q, src: [u0, v0, u0 + q / TS, v0 + q / TS], u: { grade: [0.25, 0.96 * 0.55 * (Z.dim || 1), 0, 1], tint: [...Z.tint, 0.35], alpha: a } }); } } }
      if (m.town) townFloor(m, B, c);
      // contact darkening, rims, edges
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const v = c(x, y), X = x * TILE, Y = y * TILE;
        if (v === 1) {
          // contact shadow at the wall's foot as a soft ramp (hard-edged bands read as stray stripes)
          if (c(x, y - 1) === 0) for (let k = 0; k < 6; k++) dark(X, Y, TILE, 14 - k * 2.2, 0.09);
          if (c(x - 1, y) === 0) for (let k = 0; k < 4; k++) dark(X, Y, 8 - k * 1.8, TILE, 0.08);
          if (c(x + 1, y) === 0) for (let k = 0; k < 4; k++) dark(X + TILE - 8 + k * 1.8, Y, 8 - k * 1.8, TILE, 0.08);
          if (c(x, y + 1) === 0) for (let k = 0; k < 3; k++) dark(X, Y + TILE - 6 + k * 2, TILE, 6 - k * 2, 0.08);
        } else if (v === 0) {
          // walls stand two cells tall (the reference's 3/4 faces): the lower face sits on the floor, the upper one carries the lip
          const face = c(x, y + 1) !== 0, face2 = !face && c(x, y + 2) !== 0;
          if (face) { dark(X, Y + TILE - 4, TILE, 4, 0.5); for (let k = 0; k < 4; k++) dark(X, Y + TILE - 14 + k * 2.5, TILE, 14 - k * 2.5, 0.06);
            if (c(x - 1, y) === 1 || c(x - 1, y + 1) === 1) dark(X, Y, 3, TILE, 0.7); if (c(x + 1, y) === 1 || c(x + 1, y + 1) === 1) dark(X + TILE - 3, Y, 3, TILE, 0.7); }
          if (face2) { dark(X, Y, TILE, 3, 0.75); L.solid(X, Y + 3, TILE, 1, [0.5, 0.45, 0.42], 0, 0, 0, 0.35);
            // the town's ruins catch the light on their top course (the concept's slate edge, #81676f)
            if (m.town) { L.solid(X, Y + 3, TILE, 2, [0.51, 0.4, 0.44], 0, 0, 0, 0.85); L.solid(X, Y + 5, TILE, 2, [0.37, 0.29, 0.33], 0, 0, 0, 0.6); }
            if (c(x - 1, y + 1) === 1) dark(X, Y, 3, TILE, 0.7); if (c(x + 1, y + 1) === 1) dark(X + TILE - 3, Y, 3, TILE, 0.7); }
          if (!face && !face2 && near(x, y, 4)) {
            if (c(x, y + 1) === 1) dark(X, Y + TILE - 3, TILE, 3, 0.6);
            if (c(x - 1, y) === 1) dark(X, Y, 3, TILE, 0.6);
            if (c(x + 1, y) === 1) dark(X + TILE - 3, Y, 3, TILE, 0.6);
          }
        }
      }
    }
    // large-scale variation without a grid: soft overlapping blobs (never per-cell steps, which read as dashed stripes)
    for (let i = 0; i < m.W * m.H / 18; i++) { const x = rnd(i, 7.7) * m.W, y = rnd(i, 8.8) * m.H; if (c(Math.floor(x), Math.floor(y)) !== 1) continue;
      L.puff(x * TILE, y * TILE, 60 + 70 * rnd(i, 9.9), [0.02, 0.015, 0.015], 0.10 + 0.1 * rnd(i, 6.6), i + 0.5); }
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (c(x, y) === 0 && RD[y * m.W + x] >= 2 && RD[y * m.W + x] <= 3) L.puff(x * TILE + 16, y * TILE + 16, 36, [0, 0, 0], RD[y * m.W + x] === 2 ? 0.05 : 0.12, x * 3 + y);
    for (const g of m.rugs || []) if (window.ASSETS.carpet) { const w = g.h * ASSETS.carpet.w / ASSETS.carpet.h; L.puff(g.cx, g.y + g.h / 2 + 4, g.h * 0.55, [0, 0, 0], 0.3, 1); L.sprite('carpet', g.cx - w / 2, g.y, { w, h: g.h }); }
    // the cult's circle under each altar on the plateaus (TASKS 405): a dull red ring on the art grid with marks round it
    if (m.cliff) for (const s of m.shrines || []) { const cx0 = s.x, cy0 = s.y + 8;
      for (let a = 0; a < 6.283; a += 0.035) for (const [rx, ry, col] of [[58, 26, [0.32, 0.05, 0.03]], [48, 21, [0.22, 0.04, 0.03]]]) L.solid(Math.round((cx0 + Math.cos(a) * rx) / 2) * 2, Math.round((cy0 + Math.sin(a) * ry) / 2) * 2, 2, 2, col);
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + 0.4; L.solid(Math.round((cx0 + Math.cos(a) * 53) / 2) * 2 - 2, Math.round((cy0 + Math.sin(a) * 23.5) / 2) * 2 - 2, 4, 4, [0.4, 0.07, 0.04]); } }
    // painted floor decals: cracks, grime, moss, blood, coins, bones, webs…
    for (const d of m.decals || []) { if (SIM.Q.hidden(m, d)) continue; const [w0, h0] = SZ(d.n), k = 40 * d.s / Math.max(w0, h0); L.sprite(d.n, d.x - w0 * k / 2, d.y - h0 * k / 2, { w: w0 * k, h: h0 * k, flip: !!d.f, u: { alpha: d.n === 'dc_web' ? 0.7 : 0.92 } }); }
    // stains and scorch marks scattered on the floor
    for (let i = 0; i < m.W * m.H / 40; i++) { const x = Math.floor(rnd(i, m.seed % 97) * m.W), y = Math.floor(rnd(i + 0.5, m.seed % 89) * m.H);
      if (c(x, y) !== 1) continue; const wall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i2, j2]) => c(x + i2, y + j2) !== 1 && c(x + i2, y + j2) !== 3), r = Math.min(wall ? 12 : 99, 8 + 14 * rnd(i, 3));   // a stain by a wall stays off it
      L.puff(x * TILE + 16, y * TILE + 16, r, rnd(i, 4) < 0.35 ? [0.22, 0.03, 0.02] : [0.04, 0.03, 0.03], 0.35 + 0.25 * rnd(i, 5), i); }
    tierFaces();
    // a two-level hall's drop (TASKS 375, 1358, 1680): only two cells are out of bounds, 64 px, less than the hero's height, so the face
    // starts over the gallery's edge and ends on the floor below, on the strips feet barely reach: 98 px from the cornice to the plinth's foot.
    // Drawn after the floor's stains and decals so none lies across the masonry
    function tierFaces() {
      const UP = 10, DOWN = 24, FACE = 64 + UP + DOWN, wallU = { grade: B.wallG || [0.9, 1.05, 0, 1.05], tint: [B.tint[0], B.tint[1], B.tint[2], 1] };
      const pale = (x, y, w, h, a, v = 0.82) => L.solid(x, y, w, h, [v, v * 0.92, v * 0.78], 0, 0, 0, a);
      const brick = (X, Y0, w, Y1) => { for (let y = Y0; y < Y1;) { const y1 = Math.min(Y1, (Math.floor(y / TILE) + 1) * TILE), u0 = (X % TSW) / TSW, v0 = (y % TSW) / TSW; L.sprite(B.wall, X, y, { w, h: y1 - y, src: [u0, v0, u0 + w / TSW, v0 + (y1 - y) / TSW], u: wallU }); y = y1; } };
      for (const k of LEDGE) { const x = k % m.W, ly = Math.floor(k / m.W); if (c(x, ly - 1) === 8) continue;
        const X = x * TILE, top = ly * TILE - UP, foot = top + FACE, body = top + 12, plinth = foot - 24;
        brick(X, top, TILE, foot);
        // flat steps down the face, as the walls' shading has: the top reads lit, the foot sinks into the dark
        dark(X, top, TILE, FACE, 0.26); dark(X, body + 22, TILE, plinth - body - 22, 0.14); dark(X, body + 46, TILE, plinth - body - 46, 0.16);
        pale(X, top, TILE, 4, 0.92); pale(X, top + 4, TILE, 6, 0.42, 0.6); dark(X, top + 10, TILE, 2, 0.85); dark(X, top + 12, TILE, 8, 0.52);
        pale(X, plinth, TILE, 2, 0.34, 0.6); dark(X, plinth + 2, TILE, 2, 0.5); dark(X, plinth + 4, TILE, 10, 0.18); pale(X, foot - 12, TILE, 2, 0.22, 0.6); dark(X, foot - 10, TILE, 10, 0.36);
        const leftEnd = c(x - 1, ly) === 0, rightEnd = c(x + 1, ly) === 0;
        for (const bx of (x % 4 === 0 && !leftEnd && !rightEnd ? [X + 9] : [])) { pale(bx, top + 12, 14, foot - top - 12, 0.14, 0.7); pale(bx - 2, plinth - 4, 18, 4, 0.5, 0.7); pale(bx, top + 12, 2, plinth - top - 16, 0.5, 0.75); dark(bx + 10, top + 12, 4, plinth - top - 16, 0.5); dark(bx + 14, top + 12, 2, plinth - top - 16, 0.7); pale(bx - 2, top + 4, 18, 6, 0.6, 0.7); dark(bx - 2, top + 10, 18, 2, 0.7); }
        // the end walls: where the gallery runs into the room's side wall its face turns back, a pier lit on the left, in shade on the right
        if (leftEnd) { brick(X - 16, top, 16, foot); dark(X - 16, top, 16, FACE, 0.62); dark(X - 16, top, 16, 4, 0.5); dark(X - 2, top + 4, 2, FACE - 4, 0.8); pale(X, top + 4, 2, FACE - 4, 0.2, 0.7); }
        if (rightEnd) { brick(X + TILE, top, 16, foot); dark(X + TILE, top, 16, FACE, 0.3); pale(X + TILE, top, 16, 4, 0.45, 0.7); pale(X + TILE, top + 4, 4, FACE - 4, 0.16, 0.75); dark(X + TILE - 2, top + 4, 2, FACE - 4, 0.8); }
        // the shadow it throws on the floor below, hard-edged steps the width of a course
        for (let q = 0; q < 5; q++) { const y0 = foot + q * 8; if (c(x, Math.floor(y0 / TILE)) === 0) break; dark(X, y0, TILE, 8, [0.72, 0.52, 0.36, 0.22, 0.1][q]); } } }
    // wall decor: banners hang on the wall faces
    // (a plain banner hangs in the Y band: struck, it swings)
    for (const d of m.decor) if (d.wall && d.n !== 'banner' && d.n !== 'shop_sign' && d.secret === undefined && !SIM.Q.hidden(m, d)) { const [w, h] = SZ(d.n); L.sprite(d.n, d.x - w / 2, d.y - h + 8, { w, h }); }
    G.clip(null); G.bind(null);
  }
  // the fog's edge fades over ~2 cells instead of cutting along the grid; the fade spreads into rock but never onto unseen floor,
  // so nothing behind a wall shows through it
  // a set of cells (lava, water) as a soft mask, 4 texels a cell, blurred over about a cell so its 0.5 contour runs along the cells'
  // edges and rounds their corners
  const MASKS = {};
  // a map's key with its secrets' state: an unfound secret room is rock to the masonry and the abyss, found it gets its rim
  const mapKey = (m) => m.seed + ':' + m.floor + ':' + (m.lava || 0) + ':' + (m.geometry || 0) + ':' + m.rooms.map((r) => (r.zone || '-')[0]).join('') + ':' + (m.secrets || []).map((q) => (q.open ? 'o' : '-')).join('');
  // the box [x0, y0, x1, y1] of cells that differ from what `rec` last saw on this same map, null if it must be rebuilt whole: another
  // map, or a key that moved with no cell changing (a flood grows m.water, which the cells don't show)
  const cellsChanged = (m, rec) => { const stable = m.seed + ':' + m.floor + ':' + m.rooms.map((r) => (r.zone || '-')[0]).join('') + ':' + (m.secrets || []).map((q) => (q.open ? 'o' : '-')).join('') + ':' + (m.water || []).length; let box = null;
    if (rec.stable === stable && rec.cells && rec.cells.length === m.cells.length) for (let i = 0; i < m.cells.length; i++) if (rec.cells[i] !== m.cells[i]) { const x = i % m.W, y = Math.floor(i / m.W);
      if (!box) box = [x, y, x, y]; else { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); } }
    rec.stable = stable; rec.cells = Uint8Array.from(m.cells); return box; };
  // R: the soft mask; G, B (vec, optional): a direction per cell (x, y in -1..1) around 0.5, not blurred: the shader reads its cell's
  // own with texelFetch
  // reach: how many cells away `has` looks. Only the cells that changed are redone, out to what the blur can carry: an arena's edge
  // falling a cell at a time rebuilt every mask whole on each of some 60 frames, up to 490 ms apiece (TASKS 1362)
  function maskTex(m, name, has, vec, passes = 2, reach = 0) {
    const M = MASKS[name] || (MASKS[name] = { key: '', rec: null, cv: null, im: null, stable: '', cells: null }), key = mapKey(m); if (M.key === key) return M.rec; M.key = key;
    const K = 4, W = m.W * K, H = m.H * K, pad = 2 * passes, changed = cellsChanged(m, M), box = changed && M.im && M.im.width === W && M.im.height === H ? changed : null;
    const x0 = box ? Math.max(0, (box[0] - reach) * K - pad) : 0, y0 = box ? Math.max(0, (box[1] - reach) * K - pad) : 0, x1 = box ? Math.min(W, (box[2] + 1 + reach) * K + pad) : W, y1 = box ? Math.min(H, (box[3] + 1 + reach) * K + pad) : H;
    // the output's every texel reads this far at each pass, so a window `pad` wider blurs them exactly as the whole map would
    const ax0 = Math.max(0, x0 - pad), ay0 = Math.max(0, y0 - pad), AW = Math.min(W, x1 + pad) - ax0, AH = Math.min(H, y1 + pad) - ay0;
    const ch = [0, 1, 2].map(() => new Float32Array(AW * AH)), b = new Float32Array(AW * AH);
    // `has` and `vec` run per cell, not per texel
    const cx0 = Math.floor(ax0 / K), cy0 = Math.floor(ay0 / K), CW = Math.floor((ax0 + AW - 1) / K) - cx0 + 1, CH = Math.floor((ay0 + AH - 1) / K) - cy0 + 1, cv0 = new Float32Array(CW * CH), cf = new Array(CW * CH);
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) { const v = +has(cx0 + i, cy0 + j); cv0[j * CW + i] = v; cf[j * CW + i] = v && vec ? vec(cx0 + i, cy0 + j) : null; }
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { const c = (Math.floor((ay0 + y) / K) - cy0) * CW + Math.floor((ax0 + x) / K) - cx0, f = cf[c];
      ch[0][y * AW + x] = cv0[c]; if (f) { ch[1][y * AW + x] = f[0]; ch[2][y * AW + x] = f[1]; } }
    for (const a of cv0.some((v) => v) ? [ch[0]] : []) for (let pass = 0; pass < passes; pass++) {
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { let v = 0; for (let d = -2; d <= 2; d++) v += a[y * AW + Math.min(AW - 1, Math.max(0, x + d))]; b[y * AW + x] = v / 5; }
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { let v = 0; for (let d = -2; d <= 2; d++) v += b[Math.min(AH - 1, Math.max(0, y + d)) * AW + x]; a[y * AW + x] = v / 5; } }
    const cv = M.cv || (M.cv = G.canvas()); if (!box) { cv.width = W; cv.height = H; } const g = cv.getContext('2d'), im = box ? M.im : (M.im = g.createImageData(W, H));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x, s = (y - ay0) * AW + x - ax0, v = Math.round(255 * ch[0][s]); im.data[i * 4] = v; im.data[i * 4 + 3] = 255;
      im.data[i * 4 + 1] = vec ? Math.round(255 * (0.5 + 0.5 * ch[1][s])) : v; im.data[i * 4 + 2] = vec ? Math.round(255 * (0.5 + 0.5 * ch[2][s])) : v; }
    g.putImageData(im, 0, 0, x0, y0, x1 - x0, y1 - y0);
    if (!M.rec) M.rec = G.canvasTex(name + 'mask', cv);
    else { G.canvasUpdate(M.rec, cv); }
    return M.rec;
  }
  // a river's crust drifts its way (dungeon.js lavaFlow: 0 right, 1 down, 2 left, 3 up); a pool, or the staged field, lies still
  const FLOW = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  // the magma caves' lava runs on under its slabs and bridges, not under a stone arch (TASKS 401)
  const LUND = new WeakMap(), lavaUnder = (m) => { let u = LUND.get(m); if (!u) { const arch = new Set((m.crossings || []).filter((c) => c.kind === 'arch').flatMap((c) => c.cells)); LUND.set(m, u = new Set((m.lavaUnder || []).filter((k) => !arch.has(k)))); } return u; };
  const lavaTex = (m) => maskTex(m, 'lava', (x, y) => SIM.Q.cell(m, x, y) === 3 || lavaUnder(m).has(y * m.W + x), (x, y) => { const d = m.lavaFlow && m.lavaFlow[y * m.W + x]; return d === undefined ? [0, 0] : FLOW[d]; }, 1);   // one blur pass: the banks step with the masonry, only their corners round off
  // its glow (the emissive pass, drawn over everything) leaves out what lies under a crossing, or it shines through the slabs and planks
  const surgeTex = (m, z) => { const lv = new Map(z.cells.map((k, i) => [k, z.lv[i]])), F = fallsOf(m), f = F.length ? F.reduce((a, b) => (Math.hypot(b.x - z.x, b.y - z.y) < Math.hypot(a.x - z.x, a.y - z.y) ? b : a)) : z;
    const ds = z.cells.map((k) => Math.hypot((k % m.W + 0.5) * TILE - f.x, (Math.floor(k / m.W) + 0.5) * TILE - f.y)), d0 = Math.min(...ds), d1 = Math.max(...ds), dn = new Map(z.cells.map((k, i) => [k, (ds[i] - d0) / Math.max(1, d1 - d0)]));
    return maskTex(m, 'surge', (x, y) => lv.has(y * m.W + x), (x, y) => [2 * dn.get(y * m.W + x) - 1, 2 * lv.get(y * m.W + x) - 1], 0); };
  const SBOX = new WeakMap(), surgeBox = (z) => { let b = SBOX.get(z); if (!b) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const k of z.cells) { const x = k % z.W, y = Math.floor(k / z.W); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    SBOX.set(z, b = [(x0 - 1) * TILE, (y0 - 1) * TILE, (x1 - x0 + 3) * TILE, (y1 - y0 + 3) * TILE]); } return b; };
  const lavaGlowTex = (m) => maskTex(m, 'lavaglow', (x, y) => SIM.Q.cell(m, x, y) === 3, (x, y) => { const d = m.lavaFlow && m.lavaFlow[y * m.W + x]; return d === undefined ? [0, 0] : FLOW[d]; }, 1);
  // the plateaus' back wall (TASKS 402): the rock rows above m.cliff, the only rock drawn as rock; the rest is the chasm
  // (an unfound cache in it, TASKS 425, is the wall's rock: its fake wall and room stand in the wall rows)
  // a lavafall's face (TASKS 452): as tall as the rock over it allows under its pool (48 px) and the map's black top row, up to 140
  const FALLS = { key: '', u: null };
  const fallsOf = (m) => { const key = mapKey(m); if (FALLS.key === key) return FALLS.u; FALLS.key = key;
    // (a plateau's wall ends a row over the fall's lava: the face stands on the wall's foot, the sheet runs on down over that row)
    const u = []; for (const q of (m.lavaFeatures || []).filter((f) => f.kind === 'fall').slice(0, 6)) { const x = q.x + (q.w - 1) * TILE / 2, cx = Math.floor(x / TILE), bot = Math.min(q.wallY, m.cliff[cx] - 1);
      let top = bot; while (top >= 0 && m.cells[top * m.W + cx] === 0) top--; const h = Math.min(140, (bot - top) * TILE - 84);
      u.push({ x, y: (bot + 1) * TILE, z: Math.max(q.w * TILE * 0.36, 18) + 18, h: h >= 40 ? h : 0, wallY: bot }); }
    return (FALLS.u = u); };
  // a terrace floor's rows (TASKS 490): their floor darker a row at a time away from the lavafall's row, the light it throws down
  // the steps falling off (all rows came out one lightness, L 16–23); (top, bottom, factor, 0) a row, 8 at most
  // (0.18 a row, TASKS 1045: at 0.12 the step was not seen, L 13–17)
  const terrRows = (m) => { const out = new Array(32).fill(0); if (m.ftype !== 'terrace' || m.ftype2) return out; const rows = {};
    for (const r of m.rooms) if (r.row !== undefined) { const q = rows[r.row] || (rows[r.row] = [1e9, -1e9]); q[0] = Math.min(q[0], (r.y - 1) * TILE); q[1] = Math.max(q[1], (r.y + r.h + 1) * TILE); }
    const ks = Object.keys(rows).map(Number).sort((a, b) => a - b), F = fallsOf(m), fy = F.length ? F[0].y : 0, f0 = ks.reduce((b, k) => (Math.abs((rows[k][0] + rows[k][1]) / 2 - fy) < Math.abs((rows[b][0] + rows[b][1]) / 2 - fy) ? k : b), ks[0]);
    ks.slice(0, 8).forEach((k, i) => { out[i * 4] = rows[k][0]; out[i * 4 + 1] = rows[k][1]; out[i * 4 + 2] = Math.max(0.45, 1 - 0.18 * Math.abs(k - f0)); }); return out; };
  const fallU = (m) => { const f = fallsOf(m), u = []; for (let i = 0; i < 6; i++) u.push(...(f[i] ? [f[i].x, f[i].y, f[i].z, f[i].h] : [0, 0, 0, 0])); return u; };
  const cliffTex = (m) => { const hid = SIM.Q.secretMask(m); return maskTex(m, 'cliff', (x, y) => x < 0 || x >= m.W || y < 0 || (y < m.cliff[x] && (SIM.Q.cell(m, x, y) === 0 || SIM.Q.cell(m, x, y) === 4 || hid.has(y * m.W + x))) || (!!m.stub && m.stub.includes(y * m.W + x)), null, 1); };
  // the lava's glow spread a couple of cells: hot cracks in the ground by it and its light coming up out of the chasm
  const lavaFarTex = (m) => maskTex(m, 'lavafar', (x, y) => SIM.Q.cell(m, x, y) === 3, null, 8);
  // how near the lava a cell lies, as HERO.lavaNear weighs it (TASKS 1035): the lit pass holds the lava's light down within its reach only
  // each lava cell stamps its reach: asking every cell about its 169 neighbours was most of a magma floor's first frame (TASKS 1374)
  const lavaNearTex = (m) => { let near = null; return maskTex(m, 'lavanear', (x, y) => { if (!near) { near = new Float64Array(m.W * m.H).fill(9);
    for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 3) { const cx = k % m.W, cy = Math.floor(k / m.W); for (let j = Math.max(-6, -cy); j <= Math.min(6, m.H - 1 - cy); j++) for (let i = Math.max(-6, -cx); i <= Math.min(6, m.W - 1 - cx); i++) { const n = (cy + j) * m.W + cx + i, d = Math.hypot(i, j); if (d < near[n]) near[n] = d; } } }
    return SS(5.5, 2, near[y * m.W + x]); }, null, 2, 6); };
  // a plateau's ground, crossings included: where the columns of its edge may stand (TASKS 418)
  // the chasm under a chain bridge (TASKS 429) is the dark: walked on, never ground
  const CHUND = new WeakMap(), chasmUnder = (m) => { let u = CHUND.get(m); if (!u) CHUND.set(m, u = new Set(m.chasmUnder || [])); return u; };
  const STEPS = new WeakMap(), stepTex = (m) => { let q = STEPS.get(m); if (!q) STEPS.set(m, q = new Set(m.steps || [])); return maskTex(m, 'steps', (x, y) => q.has(y * m.W + x), null, 1); };
  const platTex = (m) => maskTex(m, 'plat', (x, y) => { const v = SIM.Q.cell(m, x, y); return v !== 0 && v !== 3 && v !== 4 && !chasmUnder(m).has(y * m.W + x); }, null, 1);
  // deep in a lake, where a cluster of columns may stand (TASKS 418): the cell and those round it and two below it open lava, no
  // crust, crossing or source within a few cells
  const lakeTex = (m) => { const cr = new Set(m.crust || []), un = lavaUnder(m), src = m.lavaFeatures || [];
    const hot = (x, y) => SIM.Q.cell(m, x, y) === 3 && !cr.has(y * m.W + x) && !un.has(y * m.W + x);
    return maskTex(m, 'lake', (x, y) => { for (let j = -1; j <= 2; j++) for (let i = -1; i <= 1; i++) if (!hot(x + i, y + j)) return false;
      return !src.some((q) => Math.abs(Math.floor(q.x / TILE) - x) <= 3 && Math.abs(Math.floor(q.y / TILE) - y) <= 3); }, null, 0, 2); };
  // (G: thin crust, an islet's way, TASKS 476)
  // a sunk salamander's clip (TASKS 1054): the open lava only, its crust left out (the bank's crust is drawn as basalt: clipped by
  // the lava's mask, the sunk body lay over it as a grey see-through shape); no blur, the cut is at the cell's edge
  const swimTex = (m) => { const c = new Set(m.crust || []); return maskTex(m, 'swim', (x, y) => SIM.Q.cell(m, x, y) === 3 && !c.has(y * m.W + x), null, 1); };
  const crustTex = (m) => { const c = new Set(m.crust || []), th = new Set(m.thin || []); return maskTex(m, 'crust', (x, y) => c.has(y * m.W + x), (x, y) => [th.has(y * m.W + x) ? 1 : -1, 0], 1); };
  // the plateaus' chasm is no rock top: the lava's light reaches down into it (TASKS 402)
  const topTex = (m) => { const d = rockDist(m); return maskTex(m, 'top', (x, y) => (x < 0 || y < 0 || x >= m.W || y >= m.H || !d[y * m.W + x] || SIM.Q.chasm(m, x, y) ? 0 : d[y * m.W + x] === 1 ? 0.4 : 1), null, 2, 11); };
  // where the fire depths' abyss may glow: rock within a few cells of a floor or lava cell
  const veinTex = (m) => { const d = rockDist(m); return maskTex(m, 'veins', (x, y) => x >= 0 && y >= 0 && x < m.W && y < m.H && d[y * m.W + x] <= 5, null, 2, 11); };
  // the dry crossings are stepping stones laid in the stream: the water runs on under them (TASKS 230)
  // a cave's deep water (cell 6) and the bridges over it are water too, and deep water has a mask of its own (TASKS 302)
  const waterTex = (m) => { const w = new Set((m.water || []).concat(m.waterBridges || [], (m.crossings || []).flatMap((c) => c.cells))); return maskTex(m, 'water', (x, y) => w.has(y * m.W + x) || SIM.Q.cell(m, x, y) === 6, (x, y) => FLOW[m.waterFlow?.[y * m.W + x]] || [0, 0], 1); };
  const deepTex = (m) => maskTex(m, 'deep', (x, y) => SIM.Q.cell(m, x, y) === 6, null, 1);
  const SRC_KIND = { waterfall: 0, breach: 1, spring: 2 }, SRC_DIR = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  // a cave's open cells (floor, water, doors, found secrets) for its rock outline (CAVE)
  const openTex = (m) => { const hid = SIM.Q.secretMask(m), ch = chasmUnder(m); return maskTex(m, 'open', (x, y) => { const v = SIM.Q.cell(m, x, y); return v !== 0 && v !== 4 && !hid.has(y * m.W + x) && !ch.has(y * m.W + x); }, null, 1); };
  // 1 deep in the rock (3 to 6 cells from any floor, soft) and toward the map's edge, where a room may lie close: the abyss shows through
  // cells of rock from the nearest floor or wall face (a top wall's two face cells count as open): the masonry is a rim of two
  // cells around the rooms, the third fades, and the abyss shows past it, so rooms read by their silhouette as in the reference
  const RDIST = { key: '', d: null };
  function rockDist(m) {
    const key = mapKey(m); if (RDIST.key === key) return RDIST.d; RDIST.key = key;
    const hid = SIM.Q.secretMask(m), W = m.W, H = m.H, d = new Float32Array(W * H).fill(99), open = (x, y) => y < H && m.cells[y * W + x] !== 0 && m.cells[y * W + x] !== 4 && !hid.has(y * W + x);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (open(x, y) || open(x, y + 1) || open(x, y + 2)) d[y * W + x] = 0;
    for (let pass = 0; pass < 8; pass++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = d[y * W + x];
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < W && Y < H) v = Math.min(v, d[Y * W + X] + 1); } d[y * W + x] = v; }
    return (RDIST.d = d);
  }
  function voidTex(m) {
    const key = mapKey(m); if (VOID.key === key) return VOID.rec; VOID.key = key;
    const W = m.W, H = m.H, d = rockDist(m);
    const cv = VOID.cv || (VOID.cv = G.canvas()); cv.width = W; cv.height = H; const g = cv.getContext('2d'), im = g.createImageData(W, H);
    // a lavafall's rock stays in sight up to the map's top row: its face and the pool it pours from stand there (TASKS 452)
    const fallRock = new Set(); if (m.cliff) for (const f of fallsOf(m)) if (f.h) for (let y = Math.max(1, Math.floor((f.y - f.h - 80) / TILE)); y <= f.wallY; y++) for (let x = Math.floor((f.x - f.z - 8) / TILE); x <= Math.floor((f.x + f.z + 8) / TILE); x++) fallRock.add(y * W + x);
    for (let i = 0; i < W * H; i++) { const x = i % W, y = Math.floor(i / W), e = Math.min(x, y, W - 1 - x, H - 1 - y), v = fallRock.has(i) ? 0 : Math.round(255 * Math.max(m.town ? SS(5.25, 7.15, d[i]) : SS(1.25, 2.15, d[i]), 1 - SS(0, 2.5, e))); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    if (!VOID.rec) VOID.rec = G.canvasTex('void', cv);
    else { G.canvasUpdate(VOID.rec, cv); }
    return VOID.rec;
  }
  function seenTex(R) {
    const m = R.map; let n = 0; for (let i = 0; i < R.seen.length; i++) n = (Math.imul(n, 31) + R.seen[i]) | 0;
    const key = m.seed + ':' + m.floor + ':' + n + ':' + R.rseen.join('');
    if (SEEN.key === key) return SEEN.rec; SEEN.key = key;
    if (!SEEN.cv) { SEEN.cv = G.canvas(); }
    const cv = SEEN.cv; cv.width = m.W; cv.height = m.H; const g = cv.getContext('2d'), im = g.createImageData(m.W, m.H);
    // (the magma's fog deepens over two seen cells, TASKS 1636: the lit patch on the black was cut out, its edge 13 px)
    const K = m.cliff ? [1, 2, 3, 4, 5, 4, 3, 2, 1] : [1, 2, 3, 2, 1], KR = (K.length - 1) / 2, KS = K.reduce((p, v) => p + v, 0), W = m.W, H = m.H, a = new Float32Array(W * H), b = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -KR; d <= KR; d++) { const u = Math.min(W - 1, Math.max(0, x + d)); v += K[d + KR] * R.seen[y * W + u]; } a[y * W + x] = v / KS; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -KR; d <= KR; d++) { const u = Math.min(H - 1, Math.max(0, y + d)); v += K[d + KR] * a[u * W + x]; } b[y * W + x] = v / KS; }
    // unexplored lava next to the seen keeps a dim tail (TASKS 1724): its glow cut from ~0.45 to black in one cell read as a hard step
    for (let i = 0; i < W * H; i++) { const seen = R.seen[i], c = m.cells[i], f = seen ? (m.cliff ? 0.05 + 0.95 * Math.min(1, Math.max(0, b[i] - 0.28) * 1.85) : 0.35 + 0.65 * Math.min(1, b[i] * 1.6)) : m.cliff && c === 3 ? 0.55 * SS(0.12, 0.6, b[i]) : c === 1 || c === 3 || c === 5 || c === 6 ? 0 : 0.6 * b[i];
      const v = Math.round(255 * f); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    if (!SEEN.rec) SEEN.rec = G.canvasTex('seen', cv);
    else { G.canvasUpdate(SEEN.rec, cv); }
    return SEEN.rec;
  }
  const SPELL_FLOOR = { key: '', rec: null, cv: null }, SPELL_WATER = { key: '', rec: null, cv: null };
  function spellFloor(R, water = false) {
    const cache = water ? SPELL_WATER : SPELL_FLOOR;
    // a rolling hash of the cells and the explored mask: no string of the whole map per frame (TASKS 242)
    const m = R.map; let hsh = 0; for (let i = 0; i < m.cells.length; i++) hsh = (Math.imul(hsh, 31) + m.cells[i] * 2 + (R.seen[i] ? 1 : 0)) | 0;
    const key = m.seed + ':' + m.floor + ':' + hsh + ':' + (m.secrets || []).filter((q) => q.open).length;
    if (cache.key === key) return cache.rec;
    const cv = cache.cv || (cache.cv = G.canvas()); cv.width = m.W; cv.height = m.H;
    const g = cv.getContext('2d'), im = g.createImageData(m.W, m.H), hidden = SIM.Q.secretMask(m);
    for (let i = 0; i < m.cells.length; i++) {
      im.data[i * 4] = (m.cells[i] === 1 || m.cells[i] === 3 || water && m.cells[i] === 6) && R.seen[i] && !hidden.has(i) ? 255 : 0;
      im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    if (!cache.rec) cache.rec = G.canvasTex(water ? 'spell_water' : 'spell_floor', cv);
    // the mips are rebuilt with every upload: a floor of another size left the old ones behind, the texture went incomplete and
    // read as all rock, so every spell on the cave's larger floors was masked away
    else { G.canvasUpdate(cache.rec, cv);
      cache.rec.w = cv.width; cache.rec.h = cv.height; }
    cache.key = key; return cache.rec;
  }

  Object.assign(SCX, {
    TOP_LIFT, topTint, TOWN_LIGHT, TOWN_FACE, railPts, bake, lavaUnder, lavaTex, surgeTex, surgeBox, lavaGlowTex, swimTex, fallU, cliffTex, lavaNearTex,
    crustTex, topTex, veinTex, waterTex, deepTex, SRC_KIND, SRC_DIR, openTex, voidTex, seenTex, spellFloor });
})(typeof window !== 'undefined' ? window : globalThis);
