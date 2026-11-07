// live/scene.js — the dungeon, drawn. Pure function of t and the sim state.
// Pipeline per frame: baked floor map (floor, wall faces, wall tops, rims, AO; rebaked per floor) → ground decals (stairs, spikes,
// stains, cracks) → Y-sorted band (props, monsters, the rigged hero, loot) → unlit composite; then a light map (ambient per
// biome + flickering torches, braziers, lava, spells, the hero's aura) multiplied in with the fog of war (explored cells) →
// emissive pass (flames, lava, fireballs, slashes, sparks) → bloom + grade → HUD (hud.js).
(function () {
  const SCX = window.SCX, {
    ARC_HALF, ARC_MID, ARROW_H, BAKE, BLOOD, BRIDGE, CANDLE, D, DECK, DEDGE, DEPTH_K, DOOR, DRIP_FALL, EN_TEX, FALL_DROP, FOLK0, GLOW,
    GLOW_COL, GOLD_TINT, HERO, HERO_H, L, M, OCC_SOLIDS, PILLAR_T, PIX, PROP_BAS, PROP_H, RIM, SC, SRC_DIR, SRC_KIND, SS, STAND, SWING, SZ,
    TABLE_WICKS, TAU, TILE, TOP_LIFT, TOWN_LIGHT, TRAP_HOLE, TRAP_SPIKE, WET, bake, breathFx, cliffTex, crustTex, deathOf, deepTex,
    drawEnemy, drawFolk, drawHero, drawProp, dripAge, emitted, fallU, flameAt, glowBeat, glowOf, impSpark, knockOf, lavaGlowTex,
    lavaNearTex, lavaTex, lavaUnder, modCol, openTex, rnd, seenTex, sinkOf, spellFloor, submerged, surgeBox, surgeTex, swimFx, swimOf,
    swingPose, topTex, topTint, torchCol, veinTex, views, voidTex, waterTex, whirlP, zoneAt } = SCX;
  // ---------------- render ----------------
  SC.render = (t) => {
    const ST = SC.state || SIM.at(t), GT = ST.t, R = ST.run;
    if (R && (R.zoom || D.ZOOM || 1) !== SCX.Z) views(R.zoom || D.ZOOM || 1);
    if (!R) { L.beginBG([0.02, 0.015, 0.02, 1]); L.beginComp(); L.finish(t, { bloom: [0, 0] }); if (window.HUD) HUD.draw(ST, t, null); return; }
    const m = R.map, B = D.BIOMES[m.biome], h = R.hero, _rim = (RIM.col = B.torch.map((v) => Math.min(1, v * 1.2)), RIM.hands = {}, RIM.heads = {}, RIM.mages = {}, RIM.embers = {}, RIM.priests = {}, RIM.kindled = {}, RIM.imps = {}, RIM.salams = {}, RIM.folk = []), st = SIM.stats(h, ST.meta);
    // a fuse's ring and light stay on its body: a lit smouldering skeleton knocked back carries them with it (TASKS 411)
    const fuseAt = (q) => { const o = R.en.find((b) => b.id === q.id); return o ? [o.x, o.y] : [q.x, q.y]; };
    bake(m); const seen = seenTex(R);
    const tr = R.trauma * R.trauma, shx = 16 * tr * (L.rnd(Math.floor(GT * 30), 1) - 0.5) * 2, shy = 12 * tr * (L.rnd(Math.floor(GT * 30), 2) - 0.5) * 2;
    const cx = Math.round((R.cam[0] + shx) / PIX) * PIX, cy = Math.round((R.cam[1] + shy) / PIX) * PIX, sx = (x) => x - cx, sy = (y) => y - cy;
    SCX.LAVA_CLIP = m.cliff ? { clipm: lavaGlowTex(m), clipb: [-cx, -cy, m.W * TILE, m.H * TILE] } : null;   // (drawEnemy's sunk salamander, TASKS 460)
    const vis = (x, y, pad = 120) => x > cx - pad && x < cx + SCX.VW + pad && y > cy - pad && y < cy + SCX.VH + pad * 1.5;
    const MW = m.W * TILE, MH = m.H * TILE;
    const known = (x, y) => R.seen[Math.floor(y / TILE) * m.W + Math.floor(x / TILE)] || R.seen[Math.floor((y + 40) / TILE) * m.W + Math.floor(x / TILE)];
    const spellU = { u_floor: spellFloor(R), u_map: [MW, MH], u_cam: [cx, cy] };
    const spell = (program, x, y, rx, ry, u) => G.draw(L.P[program], { ...spellU, ...(program === 'fireball' ? { u_floor: spellFloor(R, true) } : {}), ...u }, G.xf(sx(x) - rx, sy(y) - ry, rx * 2, ry * 2));
    const weaponCol = (rar) => rar ? D.RARITY[rar].col : [0.55, 0.72, 0.9];
    const whirlFx = (e, a, mode) => {
      const radius = e.r || 92, y = e.y - (mode ? 0 : 34), angle = Math.atan2(Math.sin(e.a || 0) / DEPTH_K, Math.cos(e.a || 0)) + Math.PI * 2 * whirlP(a);
      spell('whirl', e.x, y, radius + 32, radius + 32, { u_center: [e.x, y], u_origin: [e.x, e.y], u_radius: radius, u_age: a, u_angle: angle, u_col: weaponCol(e.rar || 0), u_mode: mode });
    };
    const blastFx = (e, a, mode) => {
      const x = e.gx ?? e.x, y = e.gy ?? e.y + 24, radius = e.big ? 140 : 88;
      spell('blast', x, y, radius + 12, radius + 12, { u_center: [x, y], u_origin: [x, y], u_radius: radius, u_age: a, u_seed: e.t * 13, u_mode: mode });
    };
    const fireFx = (p) => {
      const speed = Math.hypot(p.vx, p.vy), dir = speed ? [p.vx / speed, p.vy / speed] : [1, 0], age = GT - p.t0;
      G.blend('emit');
      for (let j = 7; j >= 0; j--) {
        const lag = j * 0.12 / 7; if (lag > age) continue;
        const x = p.x - p.vx * lag, y = p.y - p.vy * lag, radius = (p.r + 4) * (1 - j * 0.075);
        spell('fireball', x, y, radius * 1.4, radius * 1.4, { u_center: [x, y], u_origin: [p.x, p.y + 20], u_dir: dir, u_radius: radius, u_age: GT - lag, u_amt: j ? 0.6 * (1 - j / 8) : 1, u_seed: p.id, u_mode: 0, u_lift: 20 });
      }
      for (let j = 0; j < 5; j++) {
        const q = (age * 3.5 + rnd(p.id, j)) % 1, lag = q * 0.12; if (lag > age) continue;
        const side = (rnd(p.id, j + 7) - 0.5) * (8 + q * 22), x = p.x - p.vx * lag - dir[1] * side, y = p.y - p.vy * lag + dir[0] * side;
        spell('fireball', x, y, 5, 5, { u_center: [x, y], u_origin: [p.x, p.y + 20], u_dir: dir, u_radius: 2 + (1 - q) * 2, u_age: GT, u_amt: 0.6 * (1 - q), u_seed: p.id + j, u_mode: 1, u_lift: 20 });
      }
      G.blend();
    };
    const hid = (o) => SIM.hidden(m, o);
    const flick = (i) => 0.85 + 0.1 * Math.sin(t * 9.1 + i * 3.7) + 0.06 * Math.sin(t * 23.3 + i * 1.3);
    // a green fire reaches less far: the crypt is lit in pools, not flooded (TASKS 169); so does a cold hearth on the floor, its
    // near light in its own colour, or a zone's four to six of them wash its floor pale (TASKS 188)
    const TL = []; m.torches.forEach((tc, i) => { if (hid(tc)) return; const col = torchCol(m, tc), f = flick(i) * (col[2] > col[0] ? 1.35 : 1) * (B.fireK || 1), big = tc.kind === 'fire', gr = col[1] > col[0] && col[1] > col[2] ? 0.7 : 1;
      const pool = col[0] < 0.5 && tc.kind === 'brazier', pr = (pool ? 0.6 : 1) * (tc.kind === 'brazier' ? 0.8 : 1), pa = (pool ? 0.6 : 1) * (B.cave && tc.kind === 'wall' ? 0.55 : 1);   // a brazier's pool is a fifth smaller: its light fell off too gently (TASKS 193)
      const tr = tc.kind === 'wall' ? B.torchR || 1 : 1;   // the town's torches light pools ≈115 px across (TASKS 1029), its fire stays wide
      TL.push([tc.x - (tc.side || 0) * 30, tc.y - (tc.side ? 10 : tc.kind === 'wall' ? -10 : 20), (big ? 200 : 220) * gr * pr * tr, col, (big ? 1.5 : 1.15) * f * pa, 3.0]);
      if (col[0] < 0.5) TL.push([tc.x - (tc.side || 0) * 9, tc.y - 14, 70, col.map((v) => 0.3 + 0.7 * v), 2.2 * f, 2.6]);
      TL.push([tc.x - (tc.side || 0) * 16, tc.y + (tc.side ? 0 : tc.kind === 'wall' ? 34 : 6), 130 * gr * pr, pool ? col : col.map((v) => 0.5 + 0.5 * v), 1.7 * f * pa, 3.5]);
      // (TASKS 1036) the reference's brightest stone is the ruin by a fire, its face and its top grey in a wide soft spill: the town's
      // fires add one up over the masonry behind them; the floor's pools and the shadows between stay as they were
      if (B.spill) TL.push([tc.x, tc.y - (big ? 60 : 30), (big ? 380 : 190) * B.spill[0], col.map((v) => 0.55 + 0.45 * v), B.spill[1] * f / (B.fireK || 1) * (big ? 0.7 : 1), 1.4]); });
    for (const d of m.decor) if (d.n === 'candles' && (d.outUntil || 0) <= GT && !hid(d)) TL.push([d.x, d.y - 10 - (d.lift || 0), 120, [1, 0.7, 0.35], 0.6 * flick(d.y)]);
    for (const d of m.decor) if (STAND[d.n] && !hid(d)) { const tp = d.n === 'torch_stand', col = tp ? torchCol(m, d) : CANDLE, up = STAND[d.n][0][1];
      TL.push([d.x, d.y + 4 - up + (tp ? 30 : 40), (tp ? 200 * (B.torchR || 1) : d.n === 'candelabra' ? 150 : 125), col, (tp ? 1.0 : d.n === 'candelabra' ? 0.8 : 0.6) * flick(d.x), 3.0]);
      TL.push([d.x, d.y + 4 - up, tp ? 70 : 40, col.map((v) => 0.4 + 0.6 * v), tp ? 1.6 : 1.1, 2.6]);
      if (tp && B.spill) TL.push([d.x, d.y - up, 190 * B.spill[0], col.map((v) => 0.55 + 0.45 * v), B.spill[1] * flick(d.x), 1.4]); }
    // a cave bridge's fire posts (TASKS 306): the crossing's warm light, on the deck and in the water under it
    for (const c of m.crossings || []) for (const p of c.posts || []) if (p.fire) { const f = flick(p.x + p.y);
      // the pool lies on the deck and the water round the post's foot, the small bright one at the flame over the post's top, so
      // the post itself is not burnt out by a light at its middle
      TL.push([p.x, p.y + 30, 190, B.torch, 0.95 * f, 3.0]); TL.push([p.x, p.y - BRIDGE.up - 50, 44, B.torch.map((v) => 0.4 + 0.6 * v), 1.1 * f, 2.6]); }
    // the cave's own light (TASKS 305): mushrooms breathe slowly in turquoise, crystals hold a steady blue with a faint shimmer;
    // each is a wide soft pool and a small bright one at its heart, so the floor round it reads as lit by it, not tinted. Kept out
    // of TL: fireTint takes a fire's colour back off the actors, and taken off a cold light it painted the hero red
    const GL = []; for (const d of m.decor) { const g = glowOf(d); if (!g || hid(d)) continue; const col = B[g.col] || GLOW_COL[g.col], b = glowBeat(d, t);
      GL.push([d.x, d.y - g.up, g.r, col, g.amt * b, 2.6]); GL.push([d.x, d.y - g.up, g.r * 0.4, col, g.amt * 1.8 * b, 2.4]); }
    for (const p of R.pots) if ((p.kind === 'gold' || p.kind === 'goldpile') && p.hp > 0 && !hid(p)) TL.push([p.x, p.y - 10, 110, [1, 0.78, 0.4], 0.35]);
    for (const c of R.chests) if (c.tier === 3 && !c.open && !hid(c)) TL.push([c.x, c.y - 14, 130, [1, 0.72, 0.35], 0.55 + 0.15 * Math.sin(t * 2.4)]);
    // how deep a point of the floor stands in the fires' light, 0 in the dark to 1 in a brazier's pool
    HERO.kAt = (px, py) => { let l = 0; for (const [x, y, r, col, amt, k = 2.2] of TL) { const d = Math.hypot((px - x) / r, (py - 40 - y) / (0.8 * r)); if (d < 1) l += amt * Math.exp(-d * d * k) * SS(1, 0.7, d) * (col[0] + col[1] + col[2]) / 3; }
      return SS(0.4, 1.2, l); };
    // where the fires' light on a point of the floor comes from and its colour, weighted as kAt weighs it; null in the dark
    const AMB0 = [0.34, 0.40, 0.58].map((v, i) => (1 - (B.ambK || 0.3)) * v + (B.ambK || 0.3) * B.amb[i] * 0.5 / Math.max(...B.amb));
    HERO.lightAt = (px, py) => { let bx = 0, by = 0, w = 0; const c = [0, 0, 0];
      for (const [x, y, r, col, amt, k = 2.2] of TL) { const d = Math.hypot((px - x) / r, (py - 40 - y) / (0.8 * r)); if (d >= 1) continue;
        const s = amt * Math.exp(-d * d * k) * SS(1, 0.7, d), dx = x - px, dy = y - (py - 40), n = Math.hypot(dx, dy) || 1; bx += dx / n * s; by += dy / n * s; w += s; for (let i = 0; i < 3; i++) c[i] += col[i] * s; }
      return { dx: w ? bx / w : 0, dy: w ? by / w : 0, col: w ? c.map((v) => v / w) : [1, 1, 1], k: w, all: AMB0.map((v, i) => v + c[i]) }; };
    // the fire's colour on an actor falls half bleached and without the lit pass's 1.6 saturation: as a tint over its own (own),
    // the boosted light is taken back to the bleached one (TASKS 185); the concept's demon stays red, its hero steel in torchlight
    // By the magma's lava the lit pass bleaches the light on an actor itself (TASKS 479, the occluders' mask): a tint over it as
    // well turned the steel khaki over a river and violet on a slab, the bones blue and the golem lilac; away from it (TASKS 1035,
    // as the lit pass's own nearness to the lava) the tint takes the torches' boosted light back as everywhere else
    const lavaD = (px, py) => { if (!m.cliff) return 9; const cx0 = Math.floor(px / TILE), cy0 = Math.floor(py / TILE); let d = 9;
      for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) if (SIM.cell(m, cx0 + i, cy0 + j) === 3) d = Math.min(d, Math.hypot(i, j)); return d; };
    HERO.lavaNear = (px, py) => SS(5.5, 2, lavaD(px, py));   // (as far as the lava's own light reaches, 170 px)
    HERO.fireTint = (px, py, own = [1, 1, 1]) => { const lt = HERO.lightAt(px, py); if (!lt) return own; const c = lt.all, g = 0.3 * c[0] + 0.5 * c[1] + 0.2 * c[2], wl = HERO.lavaNear(px, py);
      const t = c.map((v, i) => { const q = own[i] * Math.max(0.5, Math.min(1.8, (g + 0.5 * (v - g)) / Math.max(0.02, g + 1.6 * (v - g)))); return q + (own[i] - q) * wl; });
      return t; };
    HERO.k = HERO.kAt(h.x, h.y); HERO.lift = 0.85 + 0.1 * HERO.k;

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
    if (m.lava) for (let y = Math.floor(cy / TILE) - 1; y <= Math.floor((cy + SCX.VH) / TILE) + 1; y++) for (let x = Math.floor(cx / TILE) - 1; x <= Math.floor((cx + SCX.VW) / TILE) + 1; x++) if (SIM.cell(m, x, y) === 3 || lavaUnder(m).has(y * m.W + x)) lavaCells.push([x, y]);
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
    const inWet = (x, y) => { const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE); return SIM.cell(m, cx, cy) === 6 || wetSet.has(cy * m.W + cx); };
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
    const SLAB = ['slab_mg_a', 'slab_mg_b', 'slab_mg_c'], basaltOcc = [], INKC = [0.03, 0.025, 0.03]; PROP_BAS.length = 0; OCC_SOLIDS.length = 0; DECK.dy = 0;
    const basaltSlabs = (c, cells = c.cells) => { for (const k of cells) { const n = SLAB[Math.floor(3 * rnd(k, 7))], [w, hh] = SZ(n);
      const x = (k % m.W + 0.5) * TILE + ev2((rnd(k, 5) - 0.5) * 8), y = (Math.floor(k / m.W) + 0.5) * TILE + ev2((rnd(k, 6) - 0.5) * 6), foot = ev2(sy(y) + hh * 0.5);
      // (the hot line only where the lava itself lies under its foot, shorter and off its middle, TASKS 1039: under every row of a
      // wide crossing it ruled the slabs into a cobbled road)
      L.shadow(sx(x), foot + 3, w * 0.55, 4, 0.7); if (!cells.includes(k + m.W)) L.solid(ev2(sx(x) - w * (0.2 + 0.2 * rnd(k, 3))), foot, ev2(w * 0.45), 2, [1, 0.45, 0.1], 0, 0, 0, 0.6);
      drawProp(n, sx(x), foot, { flip: rnd(k, 9) < 0.5 }); basaltOcc.push([n, sx(x) - w / 2, foot - hh, w, hh, rnd(k, 9) < 0.5]); } };
    const stoneArch = (c) => { const xs = c.cells.map((k) => k % m.W), ys = c.cells.map((k) => Math.floor(k / m.W)), x0 = Math.min(...xs) * TILE, x1 = (Math.max(...xs) + 1) * TILE, y1 = (Math.max(...ys) + 1) * TILE;
      if (c.axis !== 'x' || SIM.cell(m, Math.floor((x0 + 16) / TILE), Math.floor((y1 + 16) / TILE)) !== 3) { basaltSlabs(c); return; }
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
      const hs = Math.hypot(R.hero.vx, R.hero.vy) > 20 ? (R.hero.dist / SIM.stepLen(1)) % 1 : 1, foot = 3 * Math.exp(-8 * hs);
      const fallR = bridge ? (m.hazards || []).filter((z) => z.k === 'fall' && D.hazClock(z, GT) < 0.7 && c.cells.some((k) => Math.hypot((k % m.W + 0.5) * T - z.x, (Math.floor(k / m.W) + 0.5) * T - z.y) < 60)) : [];
      const shake = (a) => fallR.reduce((v, z) => { const q = D.hazClock(z, GT); return v + 7 * Math.exp(-6 * q) * Math.sin(q * 38) * Math.exp(-Math.abs(a - (hor ? z.x : z.y)) / 90); }, 0);
      const dip = (a) => (on ? onW * (5 + foot) * Math.exp(-(((a - ha) / Math.max(40, len * 0.3)) ** 2)) * Math.sin(Math.PI * Math.max(0, Math.min(1, (a - A0) / len))) : 0) + shake(a) * Math.sin(Math.PI * Math.max(0, Math.min(1, (a - A0) / len)));
      const sag = bridge ? Math.min(10, 3 + len / 45) : 0, lift = bridge ? 8 : 3, z = (a) => lift - sag * Math.sin(Math.PI * Math.max(0, Math.min(1, (a - A0) / len))) - dip(a);
      // (the sag on the grid and the step's jolt a whole 2 px apart from it, TASKS 1058: rounded together the jolt was lost)
      if (on) DECK.dy = ev2((lift - z(ha) - onW * foot * Math.sin(Math.PI * Math.max(0, Math.min(1, (ha - A0) / len)))) * onW) + (onW > 0.5 && hs < 0.09 ? 2 : 0);
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
      const HF = D.HAZ.fall, under = (q) => { const [wx0, wy0] = hor ? [q.a, B0 + BW / 2] : [B0 + BW / 2, q.a]; return (m.hazards || []).find((z) => z.k === 'fall' && Math.hypot(z.x - wx0, (z.y - wy0) / HF.ry) < HF.r * 0.8); };
      const stateOf = (q) => { const z = bridge && under(q); if (!z) return 0; const c = D.hazClock(z, GT); return c < 0.6 ? 2 : c > z.per - HF.warn ? 1 : 0; };
      for (const q of boards) board(q, q.z, (X, Y, rot) => { const st2 = stateOf(q);
        if (st2 === 1) { const w = (D.hazClock(under(q), GT) - (under(q).per - HF.warn)) / HF.warn, j = w > 0.2 && Math.sin(GT * 50 + q.a) > 0 ? -2 : 0;   // (whole 2 px, TASKS 1050: rounded it rattled not at all)
          L.sprite(q.n, X - q.l / 2, Y - 5 + j, { w: q.l, h: 10, rot: rot + 0.05 * w * Math.sin(GT * 37 + q.a), pivot: [q.l / 2, 5], flip: q.f, u: { grade: [0.7, 0.42 * q.tone, 0, 1] } });
          // (a white-hot crack across the boards under the middle of its shadow, TASKS 1050, 1058: red-orange it read as the target
          // ring's own ticks)
          const [wx0, wy0] = hor ? [q.a, B0 + BW / 2] : [B0 + BW / 2, q.a], z0 = under(q);
          if (Math.hypot(z0.x - wx0, (z0.y - wy0) / HF.ry) < HF.r * 0.5) { L.solid(X - 2, Y - 5 + j, 4, 10, [1, 0.95, 0.6], rot, 2, 5, 0.4 + 0.6 * w); L.solid(X - 2 + (q.f ? 2 : -2), Y - 1 + j, 4, 2, [1, 0.95, 0.6], rot, 2, 1, 0.4 + 0.6 * w); G.blend('add'); L.glow(X, Y + j, 12, [1, 0.8, 0.4], 0.8 * w, 2.4); G.blend(); }
          return; }
        if (st2 === 2) { for (const sd of [-1, 1]) L.sprite(q.n, X + sd * q.l / 4 - q.l / 4, Y - 3, { w: q.l / 2 - 2, h: 10, rot: rot + sd * 0.35, pivot: [sd < 0 ? 0 : q.l / 2 - 2, 5], flip: q.f, u: { grade: [0.6, 0.45 * q.tone, 0, 1] } }); return; }
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
    if (m.down && vis(m.down.x, m.down.y)) { const [w, hh] = SZ('stairs'); L.sprite('stairs', sx(m.down.x) - w / 2, sy(m.down.y) - hh / 2 - 4, { w, h: hh, u: R.bossDead ? undefined : { grade: [0.6, 0.55, 0, 1] } }); }
    // the town's crypt gate is a dark mouth between its braziers, not a lit frame (fidelity r2)
    if (vis(m.exit.x, m.exit.y)) { if (m.floor < D.runOf(R.mode).floors) { const st = m.town ? 'stairs_tw' : 'stairs', [w, hh] = SZ(st); L.sprite(st, sx(m.exit.x) - w / 2, sy(m.exit.y) - hh / 2 - 4, { w, h: hh }); } }
    // the start room's bonfire sits in a rune circle
    if (window.ASSETS.sanct_circle && !m.town && vis(m.sanct.x, m.sanct.y)) { const d = 3.4 * TILE; L.sprite('sanct_circle', sx(m.sanct.x) - d / 2, sy(m.sanct.y - 6) - d / 2, { w: d, h: d }); }
    // a magma hall's ritual circle (TASKS 434), the fire priests' as on ref_cave_lava
    if (window.ASSETS.sanct_circle) for (const q of m.circles || []) if (vis(q.x, q.y)) { const d = 4.2 * TILE; L.sprite('sanct_circle', sx(q.x) - d / 2, sy(q.y) - d / 2, { w: d, h: d }); }
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
    for (const d of m.decals) if (d.n === 'dc_coins' && vis(d.x, d.y) && !SIM.hidden(m, d)) { const [w0, h0] = SZ(d.n), k = 40 * d.s / Math.max(w0, h0);
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
    const inSecret = (q) => SIM.secretMask(m).has(q.front[5][1] * m.W + q.front[5][0]);
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
    for (const d of m.doors || []) { if (!vis(d.x, d.y)) continue; const i = m.doors.indexOf(d), lock = SIM.doorLock(m, d);
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
    if (m.up && vis(m.up.x, m.up.y)) { const [w, hh] = SZ('stairs_up'), u = m.up; Y.push([u.y + 14, () => L.inked(() => L.sprite('stairs_up', sx(u.x) - w / 2, sy(u.y) + 18 - hh, { w, h: hh }), { r: 2, n: 8, col: [0.06, 0.04, 0.05], dy: 0 })]); }
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
        L.inked(() => L.sprite('boulder_mg_b', 0, 0, { m: M.of(M.t(sx(z.x), yy + rh / 2), M.r((1 - p) * 4 + z.x)), w: rw, h: rh, pivot: [rw / 2, rh / 2] }), { r: 2, n: 8, col: [0.02, 0.015, 0.02], dy: 0 }); }]); }
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
      if (caveW && h.deadT < 0 && !dryCrossings.has(heroCell) && SIM.cell(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)) !== 6 && wetSet.has(heroCell)) {
        const X = Math.round(sx(h.x) / PIX) * PIX, Y0 = Math.round(sy(h.y) / PIX) * PIX;
        for (let dy = -10; dy <= 6; dy += PIX) { const hw = Math.round(24 * Math.sqrt(Math.max(0, 1 - ((dy + 2) / 9) ** 2)) / PIX) * PIX; if (hw <= 0) continue;
          L.solid(X - hw, Y0 + dy, 2 * hw, PIX, dy < -8 ? [0.62, 0.84, 0.86] : [0.07, 0.3, 0.42], 0, 0, 0, dy < -8 ? 0.7 : 0.5); }
        for (let k = 0; k < 2; k++) { const ph = (t * 0.9 + k * 0.5) % 1; L.ring(X, Y0 - 2, 14 + 22 * ph, (14 + 22 * ph) * 0.4, [0.62, 0.86, 0.88], 0.5 * (1 - ph), 0.16); }
      }
    }]);
    L.SNAP = 1; try { Y.sort((a, b) => a[0] - b[0]).forEach(([, d]) => d()); } finally { L.SNAP = 0; }

    // ===== light map =====
    const ab = 0.5 / Math.max(...B.amb), AMB = [0.34, 0.40, 0.58], ak = B.ambK || 0.3, amb = AMB.map((v, i) => ((1 - ak) * v + ak * B.amb[i] * ab) * (B.ambLvl || 1)); G.bind(SCX.LT.light, [...amb, 1]); G.blend('add');
    const lt = (x, y, r, col, amt, k = 2.2) => { if (x < cx - r || x > cx + SCX.VW + r || y < cy - r || y > cy + SCX.VH + r) return; G.draw(L.P.glow, { u_col: col, u_k: k, u_amt: amt }, G.xf(sx(x) - r, sy(y) - r * 0.8, 2 * r, 1.6 * r)); };
    // the hero is the frame's focus: a wide fill plus a tight warm key on the body that barely reaches the floor around him.
    // Away from fire the fill is the player's lamp: 3–4 cells of floor, traps and foes must read in a dark corridor (TASKS 170)
    if (B.cave && !m.cliff) lt(h.x, h.y - 45, 75, [0.35, 0.6, 0.85], 0.18);
    lt(h.x, h.y - 30, 250, [0.8, 0.72, 0.6], 0.1 + 0.9 * (1 - HERO.k) ** 2); lt(h.x, h.y - 44, 95, [1, 0.88, 0.7], 0.85 * (1 - 0.8 * HERO.k), 2.4);
    for (const e of R.en) if (e.deadT < 0 && e.st !== 'idle' && e.st !== 'lurk' && !D.under(e) && vis(e.x, e.y)) lt(e.x, e.y - 40, 70, [1, 0.8, 0.6], 0.12);
    for (const [id, p] of Object.entries(RIM.hands)) lt(p[0] + cx, p[1] + cy, 60, [0.5, 1, 0.3], 0.8);
    for (const [id, [hd, hn]] of Object.entries(RIM.priests)) { lt(hd[0] + cx, hd[1] + cy, 120, [1, 0.5, 0.16], 0.55 + 0.1 * Math.sin(t * 9 + +id)); lt(hn[0] + cx, hn[1] + cy, 70, [1, 0.45, 0.12], 0.6); }
    for (const [id, [p0, p1]] of Object.entries(RIM.kindled)) lt((p0[0] + p1[0]) / 2 + cx, (p0[1] + p1[1]) / 2 + cy, 90, [1, 0.5, 0.15], 0.5 + 0.1 * Math.sin(t * 13 + +id));
    for (const [id, f] of Object.entries(RIM.embers)) lt(f[1][0] + cx, f[1][1] + cy + 20, 150, [1, 0.5, 0.15], 0.55 + 0.12 * Math.sin(t * 11 + +id) + 0.08 * Math.sin(t * 23 + 2 * id));
    for (const [id, [pe, pa, g]] of Object.entries(RIM.mages)) { if (pe) lt(pe[0] + cx, pe[1] + cy, 70, [0.35, 0.85, 0.95], 0.5); if (g > 0) lt(pa[0] + cx, pa[1] + cy, 50 + 40 * g, [0.35, 0.85, 0.95], 0.8 * g); }
    TL.forEach((q) => lt(...q)); GL.forEach((q) => lt(...q));
    for (const r of m.rooms) if (r.zone) { const col = D.BIOMES[r.zone].torch, nx = Math.max(1, Math.round((r.w - 2) / 8)), ny = Math.max(1, Math.round((r.h - 2) / 8));
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) lt((r.x + 1 + (r.w - 2) * (i + 0.5) / nx) * TILE, (r.y + 1 + (r.h - 2) * (j + 0.5) / ny) * TILE, 150, col, D.BIOMES[r.zone].fill || 0.32, 1.8); }
    for (const d of m.decor) if (d.n === 'crystal' && !hid(d)) lt(d.x, d.y - 30, 220, [0.35, 0.6, 1.0], 0.9 * flick(d.x));
    // the shop is lit warm and bright: lanterns by its ways in, a lamp over the counter
    if (m.shop) { for (const q of m.shop.lanterns) lt(q.x, q.y - 40, 190, [1, 0.78, 0.45], 0.85 * flick(q.x)); lt(m.shop.x, m.shop.y - 50, 260, [1, 0.82, 0.55], 0.75); }
    // the town's lights (TASKS 1005): from its map's data, beating on the clock like every fire
    if (m.town) for (const q of m.town.lights) { const L0 = TOWN_LIGHT[q.kind]; if (!L0) continue; const b = q.kind === 'runes' || q.kind === 'altar' ? 0.88 + 0.12 * Math.sin(t * 1.3 + q.x) : flick(q.x + q.y);
      lt(q.x, q.y + L0.dy, L0.r, L0.col, L0.amt * b); if (L0.core) lt(q.x, q.y + L0.dy, L0.core, L0.col.map((v) => 0.5 + 0.5 * v), L0.amt * b, 2.4); }
    // the magma caves' lava is their main light: wider, and its pools beat slowly instead of flickering like a fire (TASKS 404)
    // (a cell the map's edge bit off throws less, TASKS 490: their light lit a straight red band along the edge)
    const edgeK = (x, y) => (m.cliff ? Math.min(1, Math.max(0, (Math.min(x, y, m.W - 1 - x, m.H - 1 - y) - 1.5) / 4)) : 1);
    for (const [x, y] of lavaCells) { const ek = edgeK(x, y); if (ek <= 0) continue; if ((x + y) % 2 === 0) lt(x * TILE + 16, y * TILE + 16, m.cliff ? 170 : 140, [1.0, 0.42, 0.12], (m.cliff ? 0.5 * lavaBeat(x, y) : 0.55 * flick(x * 3 + y)) * ek); lt(x * TILE + 16, y * TILE + 16, 24, [1.0, 0.75, 0.55], 1.2 * ek, 1.6); }
    for (const q of R.lavaPending || []) lt((q.cell % m.W) * TILE + 16, Math.floor(q.cell / m.W) * TILE + 16, 80, [1, 0.45, 0.12], 0.55 * warnOf(q));
    // a vent heats up over its warning (TASKS 406); its burst flashes from its event
    for (const z of m.hazards || []) { if (z.k !== 'vent') continue; const H = D.HAZ.vent, w = D.hazClock(z, GT) - (z.per - H.warn); if (w >= 0) lt(z.x, z.y - 10, 110 + 90 * w / H.warn, [1, 0.45, 0.12], 0.25 + 0.95 * w / H.warn); }
    // a surge lights its band as it rises (TASKS 475)
    for (const z of m.hazards || []) { if (z.k !== 'surge') continue; const q = D.surgeLevel(z, GT); if (q <= 0) continue;
      z.cells.forEach((k, i) => { if (i % 3 || z.lv[i] > q || !R.seen[k]) return; lt((k % z.W + 0.5) * TILE, (Math.floor(k / z.W) + 0.5) * TILE, 90, [1, 0.45, 0.12], 0.6 * q); }); }
    // no cold light in the magma caves: their altars glow ember red (TASKS 404)
    const altarCol = m.cliff ? [1, 0.5, 0.22] : [0.4, 0.7, 1.0];
    for (const s of R.shrines) if (!s.used) lt(s.x, s.y - 20, 200, altarCol, 0.9);
    if (m.floor === D.runOf(R.mode).floors && R.bossDead) lt(m.exit.x, m.exit.y - 20, 320, [0.5, 0.7, 1.0], 1.4);
    // the town's end of an open portal (TASKS 1007) and a scroll being read: the same cold blue as the way out
    if (!m.town && R.arena && R.arena.gate && R.seen[Math.floor(R.arena.gate.y / TILE) * m.W + Math.floor(R.arena.gate.x / TILE)]) lt(R.arena.gate.x, R.arena.gate.y - 20, 260, [0.5, 0.7, 1.0], 1.3);
    const TP = R.town && R.portal && m.town ? m.town.svc.portal : null; if (TP) lt(TP.x, TP.y - 20, 260, [0.5, 0.7, 1.0], 1.3);
    // a waystone: a faint pool asleep, a breathing cold one awake; the town's ring answers once any waystone of the run is awake
    if (m.way) { const on = (R.ways || []).includes(m.floor); lt(m.way.x, m.way.y + 6, on ? 150 : 90, [0.55, 0.65, 1], on ? 0.45 + 0.08 * Math.sin(t * 1.7) : 0.2); }
    if (R.town && m.town && !TP && (R.ways || []).length) lt(m.town.svc.portal.x, m.town.svc.portal.y - 20, 200, [0.5, 0.65, 1], 0.55 + 0.1 * Math.sin(t * 1.3));
    if (h.read) lt(h.x, h.y - 30, 200, [0.55, 0.75, 1], 1.2 * SS(0, 1.6, GT - h.read.t0));
    for (const p of R.proj) if (p.k !== 'arrow') lt(p.x, p.y + 20, p.own === 'hero' ? 140 : p.k === 'jet' || p.k === 'wave' ? 90 : p.k === 'orb' ? 120 : 150, p.k === 'orb' ? [0.35, 0.85, 0.95] : p.k === 'hex' ? [0.4, 1.0, 0.4] : p.k === 'jet' || p.k === 'wave' ? [0.5, 0.85, 1] : [1.0, 0.55, 0.2], p.own === 'hero' ? 0.65 : p.k === 'jet' ? 0.35 : 1.2);
    // every item on the floor carries a little white light of its own, so its colours read under any room's tint
    for (const p of R.drops) if (p.kind === 'key') lt(p.x, p.y - 14, 80, [1, 0.85, 0.5], 0.6);
    // a quest's keepsake in a small white light of its own, as loot: in a warm one it took the floor's own orange (TASKS 1026)
    for (const p of R.drops) if (p.kind === 'qitem') lt(p.x, p.y - 14, 50, [1, 0.97, 0.92], 0.8, 2.4);
    for (const p of R.drops) if (p.kind === 'item') { lt(p.x, p.y - 14, 46, [1, 0.97, 0.92], 0.7, 2.4); if (p.item.rar >= 2) lt(p.x, p.y - 10, 90, D.RARITY[p.item.rar].col, 0.5); }
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      if (e.k === 'prop' && e.mat === 'fungus' && a < 0.5) lt(e.x, e.y - (e.n === 'shroom_b' ? 34 : 22) * (e.scale || 1), 90, B.shroom || GLOW_COL.shroom, (e.touch ? 0.2 : 0.55) * (1 - a / 0.5));
      if (e.k === 'prop' && e.mat === 'crystal' && a < 0.7) lt(e.x, e.y - 30, 260, [0.4, 0.65, 1.0], 1.4 * (1 - a / 0.7));
      if (e.k === 'prop' && (e.n === 'brazier' || e.n === 'torch_sconce') && a < 0.6) lt(e.x, e.y - 30, 240, [1.0, 0.6, 0.25], 0.9 * (1 - a / 0.6));
      if (e.k === 'boom' && a < 0.3) lt(e.gx ?? e.x, e.gy ?? e.y + 24, 180, [1.0, 0.6, 0.25], 0.6 * (1 - a / 0.3));
      if (e.k === 'whirl' && a < 0.25) lt(e.x, e.y - 20, 190, weaponCol(e.rar || 0), 0.6 * (1 - a / 0.25));
      if (e.k === 'lvl' && a < 1.5) lt(e.x, e.y - 30, 300, [1, 0.85, 0.4], 1.5 * (1 - a / 1.5));
      if (e.k === 'swing' && a < 0.22) lt(h.x + Math.cos(e.a) * 30, h.y - 30 + Math.sin(e.a) * 20, 150, [1, 0.9, 0.75], 0.7 * (1 - a / 0.22));
      if (e.k === 'pop' && e.c !== 'jet' && e.c !== 'arrow' && a < 0.3) lt(e.x, e.y + 20, e.hero ? 200 : 120, e.c === 'hex' ? [0.4, 1, 0.4] : e.c === 'orb' ? [0.35, 0.85, 0.95] : [1, 0.55, 0.2], (e.hero ? 1.4 : 0.8) * (1 - a / 0.3));
      if (e.k === 'craft' && a < 0.6) lt(e.x, e.y - 30, 200, e.kind === 'forge' ? [1, 0.7, 0.35] : e.ok ? [0.55, 0.75, 1] : [1, 0.35, 0.25], 1.3 * (1 - a / 0.6));
      if (e.k === 'waystone' && a < 1.2) lt(e.x, e.y - 40, 260, [0.55, 0.75, 1], 1.4 * (1 - a / 1.2));
      if (e.k === 'teleport' && a < 0.9) { const q = 1 - a / 0.9; lt(e.x, e.y - 30, 260, [0.55, 0.75, 1], 1.6 * q); lt(e.fx ?? e.x, (e.fy ?? e.y) - 30, 220, [0.55, 0.75, 1], 1.2 * q); }
      if (e.k === 'floor' && a < 1.6) lt(e.x, e.y - 20, 300, [1, 0.85, 0.55], 1.2 * (1 - a / 1.6));
      if (e.k === 'roar' && a < 0.8) lt(e.x, e.y + 40, 420, B.cave ? [0.35, 0.7, 0.85] : [1, 0.3, 0.12], 1.4 * (1 - a / 0.8));
      if (e.k === 'die' && a < 1.6) lt(e.x, e.y - 40 - 60 * SS(0.3, 1.6, a), 200, [0.5, 0.7, 1], 0.9 * SS(0.2, 0.5, a) * (1 - SS(1.2, 1.6, a)));
      if (e.k === 'spike' && a < 0.2) lt(e.x, e.y, 110, [1, 0.9, 0.75], 0.5 * (1 - a / 0.2));
      if (e.k === 'erupt' && a < 0.7) lt(e.x, e.y - 20, 320, [1, 0.5, 0.15], 1.7 * (1 - a / 0.7));
      if (e.k === 'lavafall' && a < 0.6) lt(e.x, e.y - 10, 260, [1, 0.5, 0.15], 1.5 * (1 - a / 0.6));
      if ((e.k === 'boulder' || e.k === 'colrise') && a < 0.6) lt(e.x, e.y - 10, 260, [1, 0.5, 0.15], 1.4 * (1 - a / 0.6));
      if ((e.k === 'shatter' || e.k === 'colerupt') && a < 1) lt(e.x, e.y - 60, 520, [1, 0.45, 0.12], 0.8 * SS(0, 0.15, a) * (1 - a));
      if (e.k === 'pillar' && a < PILLAR_T) lt(e.x, e.y - 40, 300, [1, 0.5, 0.15], 1.6 * (1 - SS(PILLAR_T * 0.5, PILLAR_T, a))); }
    // a salamander's fire and a golem's pool light the floor round them (TASKS 408, 409); so does a salamander's breath
    for (const p of R.fires || []) { const u = GT - p.t0, k = SS(0, 0.15, u) * (1 - SS(0.6, 1, u / p.t)); lt(p.x, p.y - 6, p.kind === 'pool' ? 190 : 90, [1, 0.45, 0.12], (p.kind === 'pool' ? 1.2 : 0.55) * k); }
    for (const e of R.en) if (e.type === 'salamander' && e.deadT < 0 && e.br && (e.st === 'wind' || e.st === 'strike')) { const B = D.ENEMIES.salamander.breath, u = GT - e.t0;
      if (e.st === 'wind') lt(e.x + Math.cos(e.aimA) * 20, e.y + Math.sin(e.aimA) * 16, 110, [1, 0.45, 0.12], 0.9 * SS(0, D.windOf(e, B.wind), u)); else if (u < B.t) lt(e.x + Math.cos(e.aimA) * B.reach * 0.55, e.y + Math.sin(e.aimA) * B.reach * 0.45, 230, [1, 0.5, 0.15], 1.5 * (1 - SS(B.t - 0.2, B.t, u))); }
    // the colossus's heart and its cracks running over the floor (TASKS 413)
    for (const e of R.en) if (e.type === 'boss_colossus' && e.deadT < 0 && e.st !== 'idle') lt(e.x, e.y - 60, 220, [1, 0.42, 0.1], 0.35 + 0.25 * (e.phase || 0));
    for (const c of R.cracks || []) { const u = GT - c.t0, front = Math.min(c.len, u * c.speed), cool = 1 - SS(c.len / c.speed, c.len / c.speed + c.linger, u); for (let l = 0; l < front; l += 90) lt(c.x + Math.cos(c.a) * l, c.y + Math.sin(c.a) * l, 120, [1, 0.45, 0.12], 0.7 * cool); }
    for (const e of R.en) if (e.type === 'golem' && e.deadT < 0) lt(e.x, e.y - 50, 120, [1, 0.4, 0.1], 0.25 + 0.5 * (1 - (e.crust ?? D.ENEMIES.golem.crust.n) / D.ENEMIES.golem.crust.n));
    // a fire priest's ring warms the floor under it as its warning runs out (TASKS 410)
    for (const p of R.pyres || []) { const q = Math.min(1, (GT - p.t0) / D.ENEMIES.fire_priest.pyre.warn); lt(p.x, p.y, 120, [1, 0.35, 0.1], 0.2 + 0.6 * q); }
    if (h.shield > 0 && GT < h.shieldUntil) lt(h.x, h.y - 30, 160, [0.4, 0.7, 1], 0.7);
    for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'secret' && a >= 0 && a < 1.2) lt(e.x, e.y, 340, [0.7, 0.8, 1], ((e.kind || 'crack') === 'crack' ? 1.4 : 0.7) * (1 - a / 1.2)); }
    for (const e of R.en) if (e.elite && e.type !== 'boss' && e.deadT < 0 && e.st !== 'lurk' && !D.under(e)) lt(e.x, e.y + 4, 110, modCol(e), 0.3 + 0.1 * Math.sin(t * 3 + e.id));
    // an explosive corpse's fuse: its light swells and beats faster until the burst
    for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'fuse' && a >= 0 && a < e.d) { const q = a / e.d, [fx, fy] = fuseAt(e); lt(fx, fy, e.r * 1.6, [1, 0.8, 0.35], (0.3 + 0.9 * q) * (0.6 + 0.4 * Math.sin(a * (8 + 30 * q)))); } }
    G.blend();
    // ===== lit composite (fog of war: unexplored cells stay black) =====
    // whoever stands before the lava keeps its glow and its shimmer off them (TASKS 407): the monsters' silhouettes in a mask both
    // leave out. Without it a demon by a river came out see-through, the lava's plates showing through its body
    G.bind(SCX.LT.occ, [0, 0, 0, 0]); G.blend();
    if (m.cliff) { const J0 = L.joint; L.joint = () => {}; const SP0 = L.sp = { dx: 0, dy: 0, a: 1, lod: 0, ink: [0, 0, 0] };
      try { for (const [n, x, y, w, hh, f] of basaltOcc.concat(PROP_BAS)) L.sprite(n, x, y, { w, h: hh, flip: f }); for (const [x, y, w, hh] of OCC_SOLIDS) L.solid(x, y, w, hh, [0, 0, 0]);
        L.sp.ink = [1, 1, 1];
        for (const e of R.en) { if (e.deadT >= 0 || !vis(e.x, e.y) || !MONSTERS.rigOf(e.type) || (D.under(e) && !(D.ENEMIES[e.type].lake && e.st === 'emerge')) || e.sinkT !== undefined || e.fallT !== undefined) continue;
          const E = D.ENEMIES[e.type], [, h0] = SZ(window.SIZES['en_' + e.type] ? 'en_' + e.type : EN_TEX[e.type]), k = D.BOSSES[e.type] ? (D.BOSSES[e.type].scale || 1.6) : e.elite ? 1.3 : 1;
          const sub = E.lake ? submerged(e, E, GT) : 0, U = sub > 0 ? { cut: [sy(e.y) + 3, 5, 1] } : {};
          L.sp = SP0; SP0.ink = [1, HERO.lavaNear(e.x, e.y), 1];   // (green: how near the lava it stands, by its feet: TASKS 1035; a rig's own draw may clear L.sp)
          MONSTERS.draw(e, E, sx(e.x), sy(e.y) + sub * h0 * k * 1.02, GT, { id: 'occ', H: h0 * k, face: e.face, lean: 0, fallR: 0, U, Ufar: U, t, swim: swimOf(e, GT) }); }
        // (the hero too: before the lava he took its whole glow and came out one orange figure, TASKS 450)
        L.sp = SP0; SP0.ink = [1, HERO.lavaNear(h.x, h.y), 0];   // (blue: a monster, not the hero, TASKS 1055)
        // (not while he is under the lava: his raised blade left a pale patch over it in the mask, TASKS 1058)
        if (!SC.hide.hero && h.deadT < 0 && h.fallT === undefined && !h.sunk && vis(h.x, h.y)) drawHero(h, sx(h.x), sy(h.y) + DECK.dy + sinkOf(h, GT, sy(h.y)).dy, GT, st, { id: 'occ', cut: sinkOf(h, GT, sy(h.y)).cut, armsUp: sinkOf(h, GT, sy(h.y)).arms }); }
      finally { L.sp = null; L.joint = J0; } }
    G.bind(SCX.LT.lit); G.blend('none'); G.full(L.P.lit, { u_src: L.T.comp, u_light: SCX.LT.light, u_occ: SCX.LT.occ, u_seen: seen, u_void: voidTex(m), u_top: topTex(m), u_veins: veinTex(m), u_water: waterTex(m), u_heat: m.cliff ? lavaGlowTex(m) : waterTex(m), u_haze: m.cliff ? 1 : 0, u_face: m.cliff && BAKE.face ? BAKE.face : seen, u_far: m.cliff ? lavaNearTex(m) : seen, u_amb: amb, u_seam: B.seam || 0, u_cave: B.cave ? 1 : 0, u_low: B.low || [0.86, 0.82, 0.78], u_cam: [cx, cy], u_map: [MW, MH], u_t: t, u_rock: B.rock, u_vein: B.vein }); G.blend();

    for (const q of m.lavaFeatures || []) { const got = lavaSrc(q); if (got && known(q.x, q.y)) G.draw(L.P.magmasrc, Object.assign(got.U, { u_mode: 2 }), got.xf); }
    // ===== emissive pass =====
    G.blend('add');
    if (lavaXf) G.draw(lavaP(), lavaU(1), lavaXf);
    for (const q of R.lavaPending || []) { const x = (q.cell % m.W) * TILE + 16, y = Math.floor(q.cell / m.W) * TILE + 16; if (!vis(x, y) || !known(x, y)) continue;
      const u = warnOf(q), beat = 0.7 + 0.3 * Math.sin(GT * (8 + 10 * u) + q.cell); L.glow(sx(x), sy(y), 12 + 10 * u, [1, 0.42, 0.1], (0.2 + 0.7 * u) * beat, 2.4); }
    G.blend();
    G.blend('add');
    // shrine and portal
    if (m.town) for (const q of m.town.lights) { const L0 = TOWN_LIGHT[q.kind]; if (!L0 || !L0.glow || !vis(q.x, q.y)) continue; const [gx, gy, gr, ga] = L0.glow, b = q.kind === 'runes' ? 0.8 + 0.2 * Math.sin(t * 1.3 + q.x) : flick(q.x * 3 + q.y);
      L.glow(sx(q.x) + gx, sy(q.y) + gy, gr, L0.col, ga * b); }
    if (m.shop) for (const q of m.shop.lanterns) if (vis(q.x, q.y) && known(q.x, q.y)) { const [lw0, lh0] = SZ('shop_lantern'); L.glow(sx(q.x) + lw0 * 0.22, sy(q.y) - lh0 * 0.42, 16, [1, 0.8, 0.45], 0.7 * flick(q.y)); }
    // a mechanism catches the light now and then: a faint four-point glint for a third of a second every five or so, each on
    // its own beat, so it reads only to someone already looking at it
    (m.secrets || []).forEach((q, i) => { const P = q.trig; if (q.open || !P || inSecret(q)) return; const ph = (t + i * 1.73) % 5.2; if (ph > 0.35) return;
      const env = Math.sin(Math.PI * ph / 0.35), tc = P.k === 'sconce' ? m.torches[P.t] : null, x = tc ? tc.x - 8 : P.cx * TILE + 7, y = tc ? tc.y - 2 : P.cy * TILE + 6;
      if (vis(x, y) && known(x, y)) L.star(sx(x), sy(y), 12, [1, 0.94, 0.78], 0.5 * env); });
    // the townsfolk's work (TASKS 1015): sparks off the anvil on the blow, embers up off the keeper's poke, the enchanter's blue flame
    for (const q of RIM.folk) { const a = q.a || 0;
      if (q.k === 'spark') for (let j = 0; j < 8; j++) { const an = -Math.PI / 2 + (rnd(q.seed, j) - 0.5) * 2.6, v = 70 + 90 * rnd(q.seed, j + 8), k = 1 - SS(0.15, 0.45, a);
        L.star(q.x + Math.cos(an) * v * a, q.y + Math.sin(an) * v * a + 260 * a * a, 5, [1, 0.85, 0.5], k); }
      if (q.k === 'spark' && a < 0.12) L.glow(q.x, q.y, 18, [1, 0.6, 0.25], 0.8 * (1 - a / 0.12));
      if (q.k === 'embers') for (let j = 0; j < 9; j++) { const b = a - 0.1 * rnd(q.seed, j); if (b < 0) continue; const k = 1 - SS(0.5, 1.1, b), dx = (rnd(q.seed, j + 9) - 0.5) * 40 * b + 6 * Math.sin(b * 7 + j);
        L.star(q.x + dx, q.y - (50 + 40 * rnd(q.seed, j + 3)) * b, 5, [1, 0.6, 0.22], k); }
      if (q.k === 'flame') { const fl = 0.85 + 0.15 * Math.sin(t * 23 + q.seed); L.glow(q.x, q.y - 6, 22, [0.3, 0.55, 1], 0.9 * q.amt * fl); L.glow(q.x, q.y - 6, 7, [0.75, 0.9, 1], q.amt * fl, 4);
        L.star(q.x, q.y - 10 - 3 * Math.sin(t * 9), 7, [0.6, 0.8, 1], 0.7 * q.amt); } }
    // the imps' sparks in hand, the salamanders' breath and their ripples in the lava (TASKS 407, 408)
    for (const e of R.en) { if (e.deadT >= 0 || !vis(e.x, e.y) || !known(e.x, e.y)) continue; const E = D.ENEMIES[e.type];
      if (RIM.imps[e.id]) impSpark(e, E, RIM.imps[e.id], GT, t); if (RIM.salams[e.id] && e.br) breathFx(e, E, RIM.salams[e.id], GT, t); const sw = swimOf(e, GT); if (sw > 0.02) { let bank = 1e9; const cx0 = Math.floor(e.x / TILE), cy0 = Math.floor(e.y / TILE);
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (SIM.cell(m, cx0 + i, cy0 + j) !== 3) bank = Math.min(bank, Math.max(0, Math.hypot(Math.max(0, Math.abs((cx0 + i + 0.5) * TILE - e.x) - 16), Math.max(0, Math.abs((cy0 + j + 0.5) * TILE - e.y) - 16))));
        swimFx(e, E, sx(e.x), sy(e.y), sw, GT, t, bank); } }
    // the cultist's free hand holds a green spark: the brightest point of the figure, as in the reference's enemy sheet
    // the fire priest's free hand holds a ball of fire, as in the reference (TASKS 410)
    for (const [id, [, hn]] of Object.entries(RIM.priests)) { L.glow(hn[0], hn[1], 20, [1, 0.45, 0.12], 0.9); L.glow(hn[0], hn[1], 7, [1, 0.9, 0.6], 0.9, 4); }
    for (const [id, p] of Object.entries(RIM.hands)) { const e = R.en.find((o) => String(o.id) === id); if (!e || !known(e.x, e.y)) continue; L.glow(p[0], p[1], 18, [0.5, 1, 0.3], 0.9); L.glow(p[0], p[1], 6, [0.9, 1, 0.8], 0.9, 4); }
    // a skeleton mage's pearl glows sea-green on its staff; through the cast water gathers and swirls in its free hand (TASKS 311)
    for (const [id, [pe, pa, g]] of Object.entries(RIM.mages)) { const e = R.en.find((o) => String(o.id) === id); if (!e || !known(e.x, e.y)) continue;
      if (pe) { L.glow(pe[0], pe[1], 12, [0.35, 0.85, 0.95], 0.55 + 0.15 * Math.sin(t * 2.3 + e.id), 3); L.glow(pe[0], pe[1], 4, [0.85, 1, 1], 0.7, 4); }
      if (g > 0) { L.glow(pa[0], pa[1], 6 + 12 * g, [0.35, 0.85, 0.95], 0.9 * g, 3);
        for (let j = 0; j < 5; j++) { const an = t * 7 + j * 1.256, rr = 13 * (1 - 0.6 * g); L.solid(Math.round((pa[0] + Math.cos(an) * rr) / PIX) * PIX, Math.round((pa[1] + Math.sin(an) * rr * 0.6) / PIX) * PIX, PIX, PIX, [0.6, 0.95, 1], 0, 0, 0, 0.9 * g); } } }
    // crystals and cold-fire torches carry a halo of their own, so the arcane blue is a light source, not a tint
    for (const d of m.decor) if (d.n === 'crystal' && !hid(d) && vis(d.x, d.y) && known(d.x, d.y)) L.glow(sx(d.x), sy(d.y) - 30, 40, [0.3, 0.55, 1], 0.8 * flick(d.x));
    // a cold fire carries a halo of its own over everything (a warm sconce's is painted on the wall behind it, `halo`)
    m.torches.forEach((tc, i) => { const col = torchCol(m, tc); if (hid(tc) || !vis(tc.x, tc.y) || !known(tc.x, tc.y)) return;
      if (col[2] > col[0]) L.glow(sx(tc.x) - (tc.side || 0) * 9, sy(tc.y) - 14, 34, col, 0.75 * flick(i), 3.2); });
    for (const s of R.shrines) if (!s.used && vis(s.x, s.y) && known(s.x, s.y)) { L.glow(sx(s.x), sy(s.y) - 34, 30, altarCol, 0.5 + 0.2 * Math.sin(t * 3)); }
    // gold catches the light: loose coins, heaps and spilt coins keep a yellow sheen the fire's orange can't take, and twinkle pale
    // yellow, each on its own beat (TASKS 167)
    const glint = (x, y, n, k, sheen = true) => { if (sheen) L.glow(sx(x), sy(y) + 2, 6 + 3 * n, [0.9, 0.95, 0.3], 0.7, 3); for (let j = 0; j < n; j++) { const ph = (t * (0.7 + 0.3 * rnd(k, j)) + rnd(k, j + 5)) % 1.6; if (ph > 0.5) continue;
      L.star(sx(x) + (rnd(k, j + 9) - 0.5) * 16, sy(y) - 4 - rnd(k, j + 13) * 10, 9, [1, 0.92, 0.5], 0.8 * Math.sin(Math.PI * ph / 0.5)); } };
    for (const p of R.drops) if (p.kind === 'gold' && !p.got && vis(p.x, p.y) && known(p.x, p.y)) glint(p.x, p.y - p.z, 2, p.id);
    for (const p of R.pots) if ((p.kind === 'gold' || p.kind === 'goldpile') && p.hp > 0 && !hid(p) && vis(p.x, p.y) && known(p.x, p.y)) glint(p.x, p.y - 8, 3, p.x * 7 + p.y);
    for (const d of m.decals) if (d.n === 'dc_coins' && vis(d.x, d.y) && known(d.x, d.y)) glint(d.x, d.y + 4, 1, d.x * 3 + d.y);
    // the gold chest's coins are painted in the concept's golds (tools/goldchest.py): the sheen would turn them green, they only twinkle
    for (const c of R.chests) if (c.gold && c.open && vis(c.x, c.y) && known(c.x, c.y)) { glint(c.x - 8, c.y - 22, 3, c.x, false); glint(c.x + 10, c.y - 18, 2, c.y, false); }
    // embers: single art pixels rising off every fire and the lava's cracks and dying out, each on its own beat; the concept's fires
    // throw off sparks, and the hot specks of its frame are these points, not more glow (TASKS 184)
    const embers = (x, y, n, rise, col, k) => { for (let j = 0; j < n; j++) { const q = (t * (0.45 + 0.2 * rnd(k, j)) + rnd(k, j + 3)) % 1; if (q > 0.85) continue;
      const ex = x + (rnd(k, j + 7) - 0.5) * 10 + Math.sin(t * 1.7 + j * 2.1 + k) * 5 * q, ey = y - rise * q * (0.7 + 0.3 * rnd(k, j + 11));
      G.blend('add'); L.solid(Math.round(sx(ex) / PIX) * PIX, Math.round(sy(ey) / PIX) * PIX, PIX, PIX, q < 0.35 ? col.map((v) => 0.5 + 0.5 * v) : col, 0, 0, 0, 1.8 * Math.pow(1 - q / 0.85, 0.6)); G.blend(); } };
    m.torches.forEach((tc, i) => { if (!vis(tc.x, tc.y) || hid(tc) || !known(tc.x, tc.y)) return; const col = torchCol(m, tc), big = tc.kind === 'fire';
      if (tc.kind === 'wall') embers(tc.x + (tc.side ? -tc.side * 9 : 3), tc.y - 30, 2, 34, col, i * 13 + 1);
      else embers(tc.x, tc.y - (big ? 44 + 40 : 32 + 26), big ? 5 : 3, big ? 70 : 46, col, i * 13 + 2); });
    for (const d of m.decor) if (d.n === 'torch_stand' && vis(d.x, d.y) && known(d.x, d.y) && !hid(d)) embers(d.x, d.y + 4 - STAND.torch_stand[0][1] - 20, 3, 40, torchCol(m, d), d.x + d.y);
    for (const [x, y] of lavaCells) if (rnd(x, y) < 0.6 && known(x * TILE, y * TILE)) embers((x + rnd(y, x)) * TILE, (y + 0.5) * TILE, 1, 30, [1, 0.62, 0.15], x * 31 + y);
    for (const [id, f] of Object.entries(RIM.embers)) { embers(f[1][0] + cx, f[1][1] + cy, 4, 64, [1, 0.6, 0.2], +id * 13 + 5); embers(f[0][0] + cx, f[0][1] + cy, 2, 44, [1, 0.7, 0.3], +id * 13 + 6); }
    // the magma caves' air (TASKS 404): sparks leaping high off the lava now and then, smoke drifting up off it, ash falling slowly
    // over everything; all on the world, so they stay put as the camera moves
    if (m.cliff) { G.blend();
      for (const [x, y] of lavaCells) if (rnd(y, x + 0.5) < 0.12 && known(x * TILE, y * TILE)) embers((x + rnd(x, y + 2)) * TILE, (y + 0.5) * TILE, 2, 90, [1, 0.78, 0.3], x * 17 + y * 5 + 3);
      for (const [x, y] of lavaCells) { if (rnd(x + 0.3, y) > 0.035 || !known(x * TILE, y * TILE)) continue; const P = 7 + 4 * rnd(x, y + 9);
        for (let j = 0; j < 2; j++) { const q = (t / P + rnd(x, y + j) + j * 0.5) % 1, px = (x + 0.5) * TILE + Math.sin(q * 5 + x) * 14 * q, py = (y + 0.5) * TILE - 150 * q;
          L.puff(sx(px), sy(py), 18 + 46 * q, [0.06, 0.05, 0.05], 0.22 * Math.sin(Math.PI * q), x * 7 + y + j); } }
      const AG = 150; for (let gy = Math.floor(cy / AG) - 1; gy <= Math.floor((cy + SCX.VH) / AG); gy++) for (let gx = Math.floor(cx / AG); gx <= Math.floor((cx + SCX.VW) / AG); gx++) for (let j = 0; j < 2; j++) {
        const k = gx * 131 + gy * 71 + j, fall = 10 + 8 * rnd(k, 1), y0 = (rnd(k, 2) * AG + t * fall) % AG, ax = gx * AG + rnd(k, 3) * AG + Math.sin(t * (0.4 + 0.3 * rnd(k, 4)) + k) * 12, ay = gy * AG + y0;
        if (!known(ax, ay)) continue; const sz = rnd(k, 5) < 0.3 ? PIX * 2 : PIX;
        L.solid(Math.round(sx(ax) / PIX) * PIX, Math.round(sy(ay) / PIX) * PIX, sz, PIX, [0.5, 0.46, 0.43], 0, 0, 0, 0.5 * Math.sin(Math.PI * y0 / AG)); } }
    // the mushrooms' caps and the crystals glow over their own light, and the mushrooms shed spores: single pale motes drifting up
    // and sideways a long way, slower than embers, each on its own beat (TASKS 305)
    for (const d of m.decor) { const g = glowOf(d); if (!g || hid(d) || !vis(d.x, d.y) || !known(d.x, d.y)) continue; const col = B[g.col] || GLOW_COL[g.col], b = glowBeat(d, t);
      L.glow(sx(d.x), sy(d.y) - g.up, g.cap * 2.4, col, (g.col === 'shroom' ? 0.16 : 0.32) * b, 2.4); L.glow(sx(d.x), sy(d.y) - g.up, g.cap, col.map((v) => 0.5 + 0.5 * v), (g.col === 'shroom' ? 0.11 : 0.22) * b, 3);
      if (g.col !== 'shroom') continue;
      for (let j = 0; j < 4; j++) { const k = d.x * 7 + d.y * 13, q = (t * (0.12 + 0.06 * rnd(k, j)) + rnd(k, j + 3)) % 1; if (q > 0.9) continue;
        const ex = d.x + (rnd(k, j + 7) - 0.5) * 22 + Math.sin(t * 0.7 + j * 2.3 + k) * 14 * q, ey = d.y - g.up + 4 - 70 * q * (0.6 + 0.4 * rnd(k, j + 11));
        G.blend('add'); L.solid(Math.round(sx(ex) / PIX) * PIX, Math.round(sy(ey) / PIX) * PIX, PIX, PIX, col.map((v) => 0.4 + 0.6 * v), 0, 0, 0, 0.9 * Math.sin(Math.PI * q / 0.9)); G.blend(); } }
    // roof drops: a short pale streak speeding down, then a crown of two motes on stone or a ring on the water
    for (const q of m.drips || []) { if (!vis(q.x, q.y) || !known(q.x, q.y)) continue; const a = dripAge(q, t), land = q.p - DRIP_FALL;
      G.blend('add');
      if (a >= land) { const f = (a - land) / DRIP_FALL, y = q.y - 90 * (1 - f * f); L.solid(Math.round(sx(q.x) / PIX) * PIX, Math.round(sy(y) / PIX) * PIX, PIX, PIX * 3, [0.55, 0.75, 0.8], 0, 0, 0, 0.55 * SS(0, 0.2, f)); }
      else if (a < 0.45) { const f = a / 0.45;
        if (q.wet) L.ring(sx(q.x), sy(q.y), 3 + 14 * f, (3 + 14 * f) * 0.45, [0.55, 0.78, 0.82], 0.5 * (1 - f), 0.25);
        else for (const s of [-1, 1]) L.solid(Math.round((sx(q.x) + s * 7 * f) / PIX) * PIX, Math.round((sy(q.y) - 10 * Math.sin(Math.PI * Math.min(1, f * 1.6))) / PIX) * PIX, PIX, PIX, [0.5, 0.7, 0.75], 0, 0, 0, 0.6 * (1 - f)); }
      G.blend(); }
    if (m.floor === D.runOf(R.mode).floors && R.bossDead) G.draw(L.P.portal, { u_t: t, u_amt: 1 }, G.xf(sx(m.exit.x) - 46, sy(m.exit.y) - 80, 92, 92));
    { const g = !m.town && R.arena && R.arena.gate; if (g && vis(g.x, g.y) && known(g.x, g.y)) G.draw(L.P.portal, { u_t: t, u_amt: 1 }, G.xf(sx(g.x) - 52, sy(g.y) - 86, 104, 104)); }
    if (R.town && R.portal && m.town) { const P = m.town.svc.portal; G.draw(L.P.portal, { u_t: t, u_amt: 1 }, G.xf(sx(P.x) - 52, sy(P.y) - 86, 104, 104)); }
    // a scroll being read (TASKS 1007): a ring of cold light closes in round the hero's feet, sparks rise and quicken
    if (h.read) { const k = SS(0, 1.6, GT - h.read.t0), X = sx(h.x), Yh = sy(h.y);
      L.ring(X, Yh, 44 - 22 * k, (44 - 22 * k) * 0.42, [0.55, 0.78, 1], 0.35 + 0.5 * k, 0.12); L.glow(X, Yh - 30, 40, [0.4, 0.65, 1], 0.5 * k);
      for (let j = 0; j < 8; j++) { const u = ((GT * (0.8 + 0.6 * k) + j / 8) % 1), a = j * 2.4; L.star(X + Math.cos(a) * (26 - 10 * k), Yh - 4 - 70 * u, 5, [0.7, 0.85, 1], (0.3 + 0.7 * k) * Math.sin(Math.PI * u)); } }
    for (const e of R.en) { if (e.type !== 'boss_serpent' || e.deadT >= 0 || e.st !== 'bwind') continue;
      const Mv = D.bossMove(e), u = GT - e.t0; if (u > Mv.wind + (e.mv === 'tail' ? 0.5 : 0)) continue;
      const q = SS(0, Mv.wind, u), x = sx(e.x), y = sy(e.y), tele = (ox, oy, kind, reach, extra) => { const R0 = reach + (extra.u_hw || 0) + 12;
        G.draw(L.P.serptele, Object.assign({ u_t: t, u_kind: kind, u_q: q, u_r: reach, u_arc: 0, u_hw: 0, u_n: 1, u_fade: 1 - SS(Mv.wind, Mv.wind + 0.5, u), u_org: [R0, R0], u_sz: [2 * R0, 2 * R0], u_dir: [Math.cos(e.aimA), Math.sin(e.aimA)] }, extra), G.xf(ox - R0, oy - R0, 2 * R0, 2 * R0)); };
      if (e.mv === 'tail') tele(x, y, 0, Mv.r, { u_arc: Math.PI + 0.1 });
      else if (e.mv === 'bite') tele(x, y, 0, Mv.r, { u_arc: Mv.arc });
      else if (e.mv === 'wave') { const L = SIM.flightReach(m, e.x, e.y - 38, e.aimA, Mv.speed, Mv.reach / Mv.speed, 28); tele(x, sy(e.y - 38 + 28), 1, Mv.reach, { u_hw: 34, u_len: [L, 0, 0, 0], u_len4: 0 }); }
      else { const [mx, my] = SIM.serpentMouth(e), L = []; for (let i = 0; i < Mv.n; i++) L.push(SIM.flightReach(m, mx, my, e.aimA + (i / (Mv.n - 1) - 0.5) * Mv.spread * 2, Mv.speed, Mv.reach / Mv.speed, 82));
        tele(sx(mx), sy(my + 82), 2, Mv.reach, { u_arc: Mv.spread, u_hw: 22, u_n: Mv.n, u_len: [L[0], L[1] || 0, L[2] || 0, L[3] || 0], u_len4: L[4] || 0 }); }
    }
    for (const e of R.en) if (e.type === 'boss_serpent' && e.floodAt > GT) {
      const q = 1 - (e.floodAt - GT) / 1.2;
      for (const k of m.floodCells) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE;
        for (let j = 0; j < 2; j++) { const ph = (t * 1.6 + j * 0.5 + rnd(k, 1)) % 1; L.ring(sx(x), sy(y), 10 + 14 * ph, (10 + 14 * ph) * 0.5, [0.7, 0.92, 0.95], (0.35 + 0.55 * q) * (1 - ph), 0.16); } }
    }
    // the shallows spreading over the shore (TASKS 326): a ring of foam and a few flecks where the water has just arrived
    if (m.flood && m.flood.n) for (let i = Math.max(0, m.flood.n - 40); i < m.flood.n; i++) { const k = m.flood.cells[i], a = GT - (m.flood.t0 + 1.6 * i / m.flood.cells.length); if (a < 0 || a > 0.7) continue;
      const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE, f = a / 0.7;
      L.ring(sx(x), sy(y), 8 + 16 * f, (8 + 16 * f) * 0.5, [0.8, 0.95, 0.95], 0.8 * (1 - f), 0.2);
      for (let j = 0; j < 3; j++) L.solid(Math.round((sx(x) + (rnd(k, j) - 0.5) * 26) / PIX) * PIX, Math.round((sy(y) + (rnd(k, j + 4) - 0.5) * 12 - 8 * f) / PIX) * PIX, PIX, PIX, [0.85, 0.97, 0.96], 0, 0, 0, 0.9 * (1 - f)); }
    // projectiles
    for (const p of R.proj) { if (p.own === 'hero' && p.k === 'fire' || p.k === 'arrow' || !known(p.x, p.y)) continue; const x = sx(p.x), y = sy(p.y), col = p.k === 'hex' ? [0.45, 1.0, 0.4] : [1.0, 0.55, 0.18], a = Math.atan2(p.vy, p.vx);
      if (p.k === 'wave') { const ca = Math.cos(a), sa = Math.sin(a), age = GT - p.t0;
        for (let j = -9; j <= 9; j++) { const v = j / 9, bend = 9 * (1 - v * v) + 3 * Math.sin(j * 1.7 + age * 16), X = x - sa * v * 34 + ca * bend, Y = y + ca * v * 34 + sa * bend;
          L.shadow(X, Y + 32, 10, 5, 0.35);
          for (let b = 2; b >= 0; b--) L.solid(X - ca * b * 6, Y - sa * b * 6 + b * 3, 7, 7 - b, b ? [0.18, 0.47, 0.53] : [0.65, 0.87, 0.9], a, 3.5, 3, (1 - 0.25 * Math.abs(v)) * (1 - b * 0.2));
        }
        continue;
      }
      // an eel's jet (TASKS 310): a rope of water off its mouth, a bright head and drops strung out behind it that sag and thin out
      if (p.k === 'jet') { const age = GT - p.t0, back = Math.min(70, age * Math.hypot(p.vx, p.vy)), ca = Math.cos(a), sa = Math.sin(a);
        for (let j = 0; j < 9; j++) { const q = j / 8, d = back * q + 3 * Math.sin(t * 40 + j), w = 6 * (1 - 0.55 * q); L.solid(x - ca * d, y - sa * d + 8 * q * q, w + 3, w * 0.75, [0.42 + 0.35 * (1 - q), 0.7 + 0.2 * (1 - q), 0.82], a, (w + 3) / 2, w * 0.37, 0.9 * (1 - 0.75 * q)); }
        for (let j = 0; j < 6; j++) { const q = rnd(p.id, j), d = back * (0.2 + 0.8 * q); L.solid(x - ca * d + (rnd(p.id, j + 9) - 0.5) * 12, y - sa * d + 14 * q + (rnd(p.id, j + 5) - 0.5) * 8, 3, 3, [0.62, 0.84, 0.92], 0, 1.5, 1.5, 0.8 * (1 - q)); }
        L.solid(x, y, 7, 6, [0.85, 0.96, 1], a, 3.5, 3, 0.95); L.glow(x, y, p.r * 2, [0.5, 0.85, 1], 0.2, 3); continue; }
      // a mage's ball of water (TASKS 311): a wobbling sphere with a bright crest, a ring rolling round it and drops shed behind it
      if (p.k === 'orb') { const age = GT - p.t0, r = p.r * (1 + 0.08 * Math.sin(age * 18)), ca = Math.cos(a), sa = Math.sin(a);
        L.glow(x, y, r * 2.6, [0.3, 0.8, 0.95], 0.45, 2.4); L.glow(x, y, r * 1.2, [0.55, 0.95, 1], 0.8, 3.2); L.ring(x, y, r * (1 + 0.1 * Math.sin(age * 14)), r * (0.85 + 0.1 * Math.cos(age * 14)), [0.7, 0.95, 1], 0.7, 0.18);
        L.solid(x - r * 0.35, y - r * 0.45, PIX * 2, PIX, [0.95, 1, 1], 0, 0, 0, 0.9);
        for (let j = 0; j < 5; j++) { const q = ((age * 2.2 + j / 5) % 1), d = r + 26 * q; L.solid(Math.round((x - ca * d + (rnd(p.id, j) - 0.5) * 8) / PIX) * PIX, Math.round((y - sa * d + 14 * q * q) / PIX) * PIX, PIX, PIX, [0.55, 0.9, 1], 0, 0, 0, 0.8 * (1 - q)); }
        continue; }
      // an imp's spark (TASKS 407): a small white-hot ember that crackles, shedding sparks that fall behind it
      if (p.k === 'spark') { const age = GT - p.t0, ca = Math.cos(a), sa = Math.sin(a); L.glow(x, y, 16, [1, 0.5, 0.12], 0.6, 2.2); L.star(x, y, 7 + 2 * Math.sin(age * 50 + p.id), [1, 0.9, 0.6], 1);
        for (let j = 0; j < 6; j++) { const q = ((age * 4 + j / 6) % 1), d = 6 + 34 * q; L.star(x - ca * d + (rnd(p.id, j) - 0.5) * 8, y - sa * d + 18 * q * q, 3 + 2 * (1 - q), [1, 0.6, 0.2], 0.9 * (1 - q)); }
        continue; }
      for (let k = 6; k >= 0; k--) { const f = k / 6; L.glow(x - Math.cos(a) * k * 7, y - Math.sin(a) * k * 7, (p.r + 4) * (1 - f * 0.6) * 1.6, col, 0.5 * (1 - f), 2.5); }
      L.glow(x, y, p.r * 2.2, [1, 0.95, 0.8], 0.9, 3); }
    // elites: a few embers drift up off the body, over the halo drawn behind it
    for (const e of R.en) { if (!e.elite || D.BOSSES[e.type] || e.deadT >= 0 || e.st === 'lurk' || D.under(e) || !vis(e.x, e.y) || !known(e.x, e.y)) continue;
      const E = D.ENEMIES[e.type], x = sx(e.x), y = sy(e.y), hh = SZ(EN_TEX[e.type])[1] * 1.3;
      for (let j = 0; j < 4; j++) { const q = (t * 0.45 + rnd(e.id, j)) % 1, an = rnd(e.id, j + 7) * 6.28;
        L.star(x + Math.cos(an) * (E.r * 1.3 + 6) * (1 - 0.5 * q) + 6 * Math.sin(t * 2 + j), y - hh * (0.25 + 0.9 * q), 4 + 2 * (1 - q), modCol(e, j), Math.sin(Math.PI * q) * 0.6); }
      // a warded elite's shield (TASKS 387): a half ring of light before it, as thick as what is left of it; its back is bare
      if (e.ward > 0) { const W = D.ELITE_MODS.find((m) => m.id === 'ward'), k = Math.min(1, e.ward / (e.max * W.share)), fa = e.face > 0 ? 0 : Math.PI;
        for (let j = 0; j <= 8; j++) { const an = fa + (j / 8 - 0.5) * Math.PI; L.star(x + Math.cos(an) * (E.r + 16), y - hh * 0.35 + Math.sin(an) * (E.r + 16) * 0.55, 5 + 3 * k, W.col, (0.35 + 0.45 * k) * (0.8 + 0.2 * Math.sin(t * 4 + j))); } } }
    // a curse on the hero (TASKS 387): green motes sink round him while his blows are weak
    { const h = R.hero, C = D.ELITE_MODS.find((m) => m.id === 'curse'); if (h && h.curseT > ST.t && h.deadT < 0) { const x = sx(h.x), y = sy(h.y), k = Math.min(1, (h.curseT - ST.t) / C.t);
      for (let j = 0; j < 5; j++) { const q = (t * 0.6 + j / 5) % 1, an = j * 1.26 + t; L.star(x + Math.cos(an) * 22, y - 90 + 70 * q, 5, C.col, Math.sin(Math.PI * q) * 0.7 * (0.4 + 0.6 * k)); } } }
    // a frost elite's chill on the hero (TASKS 477): pale frost at his feet and flakes about him while he is slowed
    { const h = R.hero, F = D.ELITE_MODS.find((m) => m.id === 'frost'); if (h && h.chillT > ST.t && h.deadT < 0) { const x = sx(h.x), y = sy(h.y), k = Math.min(1, (h.chillT - ST.t) / F.t);
      L.ring(x, y, 24, 11, F.col, 0.5 * k, 0.25); for (let j = 0; j < 6; j++) { const an = j * 1.05 + t * 0.7; L.star(x + Math.cos(an) * 20, y - 30 - 26 * Math.sin(an * 0.5 + t), 4, [0.85, 0.95, 1], 0.6 * k); } } }
    // the forge lord is charred dark, or his red skin vanished into his own red-lit arena; his heat shows as a breathing glow in the
    // chest and embers off the body (TASKS 232)
    for (const e of R.en) { if (e.type !== 'boss_forge' || e.deadT >= 0 || !vis(e.x, e.y) || !known(e.x, e.y)) continue;
      const E = D.ENEMIES[e.type], x = sx(e.x), y = sy(e.y), hh = SZ(EN_TEX[e.type])[1] * D.BOSSES[e.type].scale, pu = 0.5 + 0.5 * Math.sin(t * 2.2);
      L.glow(x, y - hh * 0.58, 20 + 5 * pu, [1, 0.5, 0.12], 0.55 + 0.25 * pu, 3);
      for (let j = 0; j < 9; j++) { const q = (t * 0.5 + rnd(e.id, j)) % 1, an = rnd(e.id, j + 7) * 6.28;
        L.star(x + Math.cos(an) * E.r * 1.1 * (1 - 0.4 * q) + 7 * Math.sin(t * 2 + j), y - hh * (0.15 + 0.95 * q), 4 + 3 * (1 - q), [1, 0.5 + 0.3 * rnd(e.id, j + 3), 0.12], Math.sin(Math.PI * q) * 0.8); } }
    // event FX
    // a rock about to fall (TASKS 406): its shadow alone is lost on the dark ash, so a pale ring of falling dust marks where it lands
    for (const z of m.hazards || []) { if (z.k !== 'fall' || !vis(z.x, z.y) || !known(z.x, z.y)) continue; const H = D.HAZ.fall, w = D.hazClock(z, GT) - (z.per - H.warn); if (w < 0) continue;
      // (TASKS 487: the marks read by meaning, danger red, a gain yellow-green, a shelter blue: a pale ring was all of them) a danger is
      // a red target, its ticks pointing in at where it lands
      const q = w / H.warn, X = sx(z.x), Y0 = sy(z.y), a = (0.35 + 0.6 * q) * (0.8 + 0.2 * Math.sin(GT * 22)); L.ring(X, Y0, H.r, H.r * H.ry, [1, 0.22, 0.08], a, 0.14);
      for (let j = 0; j < 8; j++) { const an = j / 8 * 6.283 + 0.39, cx = X + Math.cos(an) * H.r * 0.86, cy = Y0 + Math.sin(an) * H.r * H.ry * 0.86; L.solid(cx - 4, cy - 1, 8, 2, [1, 0.25, 0.1], an, 4, 1, a); } }
    // a fire priest's ring (TASKS 410): a circle of fire on the floor where the hero stood, its runes running round it and a second
    // ring closing in on it as the warning runs out; then the pillar (event FX)
    for (const p of R.pyres || []) { const P = D.ENEMIES.fire_priest.pyre, u = GT - p.t0; if (u >= P.warn || !vis(p.x, p.y)) continue;
      const q = u / P.warn, X = sx(p.x), Y0 = sy(p.y), beat = 0.75 + 0.25 * Math.sin(GT * (10 + 18 * q)), rx = P.r, ry = P.r * P.ry, in0 = SS(0, 0.15, u);
      L.glow(X, Y0, rx * 1.1, [1, 0.3, 0.08], (0.15 + 0.45 * q) * in0, 2.2);
      L.ring(X, Y0, rx, ry, [1, 0.35, 0.1], (0.45 + 0.5 * q) * beat * in0, 0.07); L.ring(X, Y0, rx * (1.6 - 0.6 * q), ry * (1.6 - 0.6 * q), [1, 0.55, 0.2], 0.5 * q * beat, 0.05);
      for (let j = 0; j < 6; j++) { const an = j / 6 * TAU + GT * 1.6; L.star(X + Math.cos(an) * rx * 0.72, Y0 + Math.sin(an) * ry * 0.72, 6 + 3 * q, [1, 0.5, 0.15], (0.4 + 0.5 * q) * in0); } }
    // a golem's pool of lava (TASKS 409): bright at first, a ring of crust closing in on it as it cools, bubbles popping
    // a pool that has yet to burn (`arm`, TASKS 463) spreads dull red, its rim racing out, and flares hot as it starts to
    for (const p of R.fires || []) { if (p.kind !== 'pool' || !vis(p.x, p.y) || !known(p.x, p.y)) continue; const u = GT - p.t0, q = u / p.t, X = sx(p.x), Y0 = sy(p.y), k = SS(0, 0.25, u) * (1 - SS(0.75, 1, q)), arm = p.arm || 0, hot = arm ? SS(arm * 0.6, arm, u) : 1, r = p.r * (0.55 + 0.45 * SS(0, Math.max(0.35, arm), u));
      L.glow(X, Y0, r * 1.6, [1, 0.32, 0.06], 0.55 * k, 1.6); L.glow(X, Y0, r * (1.1 - 0.5 * q), [1, 0.62, 0.22], 0.9 * k * (0.25 + 0.75 * hot), 2.6); L.ring(X, Y0, r * (1 - 0.35 * q), r * p.ry * (1 - 0.35 * q), hot < 1 ? [1, 0.3, 0.08] : [1, 0.5, 0.15], (0.6 + 0.3 * (1 - hot)) * k, 0.12);
      for (let j = 0; j < 4; j++) { const b = (t * 0.9 + rnd(p.id, j)) % 1, bx = X + (rnd(p.id, j + 5) - 0.5) * r, by = Y0 + (rnd(p.id, j + 9) - 0.5) * r * p.ry; if (b < 0.3) L.ring(bx, by, 2 + 6 * b / 0.3, 1 + 3 * b / 0.3, [1, 0.8, 0.4], 0.8 * k * hot * (1 - b / 0.3), 0.3); } }
    // the colossus's telegraphs (TASKS 413), on the floor in the add pass: the fists' ring closing in through the wind-up; the crack's
    // line of embers to where it will run, then the crack itself racing out and glowing as it cools; a circle where a rock will land,
    // brighter as it comes; stars over its head while it stands stuck
    {
      for (const e of R.en) { if (e.type !== 'boss_colossus' || e.deadT >= 0 || !known(e.x, e.y)) continue; const X = sx(e.x), Y0 = sy(e.y), u = GT - e.t0;
        if (e.openUntil > GT && RIM.heads[e.id]) {
          const head = RIM.heads[e.id], h = D.ENEMIES[e.type].h, center = [head[0], head[1] - 0.16 * h];
          L.anchor('colossus_stars', head, center, 0.18 * h);
          L.joint('en' + e.id, 'stun', center);
          for (let j = 0; j < 3; j++) { const a = t * 6 + j * TAU / 3;
            L.star(center[0] + Math.cos(a) * 0.12 * h, center[1] + Math.sin(a) * 0.048 * h, 8, [1, 0.9, 0.55], 1);
          }
        }
        if (e.st !== 'bwind') continue; const Mv = D.bossMove(e), w = Mv.wind, q = SS(0, w, u), beat = 0.75 + 0.25 * Math.sin(GT * (10 + 18 * q));
        if (e.mv === 'fists' && u < w) { L.ring(X, Y0, Mv.r, Mv.r * 0.75, [1, 0.4, 0.1], (0.3 + 0.55 * q) * beat, 0.05); L.ring(X, Y0, Mv.r * (1.5 - 0.5 * q), Mv.r * 0.75 * (1.5 - 0.5 * q), [1, 0.55, 0.2], 0.5 * q * beat, 0.04); }
        if (e.mv === 'crack' && u < w) { const p = D.colossusContact(e), c = Math.cos(e.aimA), sn = Math.sin(e.aimA);
          for (let l = 0; l <= Mv.len; l += 18) { const px = p.x + c * l, py = p.y + sn * l, cl = SIM.cell(m, Math.floor(px / TILE), Math.floor(py / TILE)); if (cl !== 1 && cl !== 3) break; const fl = 0.7 + 0.3 * Math.sin(GT * 30 + l * 0.2);
            L.glow(sx(px), sy(py), 9 + 6 * q, [1, 0.4, 0.1], (0.15 + 0.55 * q) * fl * SS(0, w * 0.5, u - l / Mv.len * w * 0.4), 2.4); } } }
      for (const c of R.cracks || []) { const u = GT - c.t0, run = c.len / c.speed, front = Math.min(c.len, u * c.speed), cool = 1 - SS(run, run + c.linger, u), co = Math.cos(c.a), sn = Math.sin(c.a);
        for (let l = 0; l <= front; l += 12) { const px = c.x + co * l, py = c.y + sn * l, jig = (rnd(c.id, Math.floor(l / 12)) - 0.5) * 8, hot = l > front - 40 ? 1.4 : 1;
          L.glow(sx(px - sn * jig), sy(py + co * jig), c.w * 0.75, [1, 0.45, 0.1], 0.75 * cool * hot, 2.2); L.star(sx(px - sn * jig), sy(py + co * jig), 5, [1, 0.8, 0.4], 0.6 * cool * hot); } }
      // the colossus's rain (TASKS 466): while rocks of it are on their way, each whole slab of cover shows its shelter, a dark
      // overhang on the floor with a pale rim, where none falls
      if ((R.rocks || []).some((q) => q.kind === 'rain' && !q.done && GT < q.t + 0.2)) { const sh = D.BOSSES.boss_colossus.moves.rain.shelter, pulse = 0.8 + 0.2 * Math.sin(GT * 4);
        // (a shelter: a cool blue pool, filled, with a steady blue rim, TASKS 487)
        for (const d of m.decor) if (d.cover && !d.broken && vis(d.x, d.y)) { const X = sx(d.x), Y0 = sy(d.y); L.shadow(X, Y0, sh, sh * 0.62, 0.42); L.glow(X, Y0, sh * 0.9, [0.3, 0.6, 1], 0.35 * pulse, 1.4); L.ring(X, Y0, sh, sh * 0.62, [0.45, 0.75, 1], 0.7 * pulse, 0.07); } }
      for (const q of R.rocks || []) { if (q.x === undefined || GT < q.t0 || !known(q.x, q.y)) continue; const f = Math.min(1, (GT - q.t0) / (q.t - q.t0)), X = sx(q.x), Y0 = sy(q.y), beat = 0.75 + 0.25 * Math.sin(GT * (10 + 18 * f));
        if (q.kind === 'boulder') { L.ring(X, Y0, q.r, q.r * 0.75, [1, 0.4, 0.1], (0.35 + 0.55 * f) * beat, 0.06); if (q.pool) L.glow(X, Y0, q.r * 0.9, [1, 0.35, 0.08], 0.25 * f, 2); }
        else { L.ring(X, Y0, q.r, q.r * 0.75, [1, 0.22, 0.08], (0.45 + 0.55 * f) * beat, 0.12); L.glow(X, Y0, q.r * 0.7, [1, 0.3, 0.1], 0.2 * f, 2); } }
    }
    // the brink (TASKS 476): a monster the hero could drive off an edge (SIM.brinkOf) has a ring at its feet beating slowly and the
    // edge by it lit, while the hero is near enough to make it a move
    if (m.cliff) for (const e of R.en) { if (Math.hypot(e.x - R.hero.x, e.y - R.hero.y) > 420 || !known(e.x, e.y)) continue; const b = SIM.brinkOf(m, e); if (!b) continue;
      // (the ring at its feet, on the dark floor: on the lava's own glare a ring at the edge was lost)
      const X = sx(e.x), Y = sy(e.y), beat = 0.7 + 0.3 * Math.sin(GT * 5 + e.id), a = (1 - b.d / D.BRINK.near * 0.5) * beat;
      // (a gain: yellow-green chevrons at its feet running toward the edge it can be driven off, TASKS 487)
      const an = Math.atan2(sy(b.y) - Y, sx(b.x) - X), G2 = [0.7, 1, 0.3];
      L.ring(X, Y, 24, 14, G2, 1.5 * a, 0.16);
      for (let j = 0; j < 3; j++) { const f = ((GT * 1.2 + j / 3) % 1), d = 4 + 40 * f, cx = X + Math.cos(an) * d, cy = Y + Math.sin(an) * d * 0.62, al = 1.4 * a * Math.sin(Math.PI * f);
        for (const sg of [-1, 1]) for (let i = 0; i <= 3; i++) { const b2 = an + Math.PI + sg * 0.75; L.star(cx + Math.cos(b2) * i * 4, cy + Math.sin(b2) * i * 4 * 0.62, 4, G2, al); } }
      L.glow(sx(b.x), sy(b.y), 18, [0.75, 1, 0.4], 0.5 * a, 2.4); }
    // a terrace's surge (TASKS 475), over the bridges' decks too: over its warning its band glows and beats faster, sparks jump off
    // the lava by it and the lava creeps up its edges; then it floods it and ebbs back
    for (const z of m.hazards || []) { if (z.k !== 'surge') continue; const H = D.HAZ.surge, q = D.surgeLevel(z, GT), w = D.hazClock(z, GT) - (z.per - H.warn); if (q <= 0) continue;
      if (w >= 0) { const k = w / H.warn, beat = 0.7 + 0.3 * Math.sin(GT * (8 + 14 * k));
        z.cells.forEach((c, i) => { if (i % 2 || !R.seen[c]) return; const wx0 = (c % z.W + 0.5) * TILE, wy0 = (Math.floor(c / z.W) + 0.5) * TILE; if (!vis(wx0, wy0)) return; const X = sx(wx0), Y = sy(wy0);
          L.glow(X, Y, 22 + 10 * k, [1, 0.45, 0.1], (0.12 + 0.45 * k) * beat, 2.2);
          if (i % 6 === 0) { const b = (GT * (1.1 + 2 * k) + rnd(c, 1)) % 1; L.star(X + (rnd(c, 2) - 0.5) * 20, Y - 4 - 26 * b, 2 + 3 * k * (1 - b), [1, 0.6 + 0.3 * (1 - b), 0.15], k * (1 - b)); } }); }
      const box = surgeBox(z), xf = G.xf(sx(box[0]), sy(box[1]), box[2], box[3]);
      const FR = 0.4, fr = w >= H.warn - FR ? (w - (H.warn - FR)) / FR * 1.1 : -1;
      const u = (mode) => ({ u_t: GT, u_q: q, u_fr: fr, u_mask: surgeTex(m, z), u_crust: crustTex(m), u_melt: melt.flatMap((p) => p.slice(0, 4)), u_seen: seen, u_box: box, u_map: [MW, MH], u_mode: mode, u_scorch: 0, u_face: BAKE.face || seen, u_occ: SCX.LT.occ });
      G.draw(L.P.spill, u(0), xf); G.blend('add'); G.draw(L.P.spill, u(2), xf); G.blend(); }
    // a vent's warning (TASKS 406), from its clock: the ring it will throw lava over heats up and beats faster, its mouth bubbles
    for (const z of m.hazards || []) { if (z.k !== 'vent' || !vis(z.x, z.y) || !known(z.x, z.y)) continue; const H = D.HAZ.vent, w = D.hazClock(z, GT) - (z.per - H.warn);
      // (TASKS 462: and always lies in a ring of scorched ground as wide as its burst, which no dead crack has)
      { const X = sx(z.x), Y0 = sy(z.y); L.shadow(X, Y0, H.r, H.r * H.ry, 0.5); L.ring(X, Y0, H.r * 0.96, H.r * H.ry * 0.96, [0.75, 0.22, 0.06], 0.5, 0.06);
        for (let j = 0; j < 10; j++) { const an = j / 10 * 6.283 + rnd(z.x, j) * 0.5, f = 0.5 + 0.5 * Math.sin(GT * (1.5 + rnd(z.y, j)) + j * 2.1);
          L.star(X + Math.cos(an) * H.r * 0.96, Y0 + Math.sin(an) * H.r * H.ry * 0.96, 3, [1, 0.45, 0.12], 0.35 + 0.4 * f); } }
      if (w < 0) { const X = sx(z.x), Y0 = sy(z.y), br = 0.6 + 0.4 * Math.sin(GT * 2.2 + z.x);   // a live vent smoulders at rest, a dead crack doesn't
        L.ring(X, Y0, H.r * 0.4, H.r * H.ry * 0.4, [1, 0.35, 0.08], 0.28 * br, 0.1); L.glow(X, Y0 - 3, 14, [1, 0.5, 0.12], 0.3 * br, 2.4);
        for (let j = 0; j < 2; j++) { const b = (GT * 0.5 + rnd(z.x + z.y, j)) % 1; L.puff(X + (rnd(z.x, j + 3) - 0.5) * 14, Y0 - 4 - 26 * b, 3 + 3 * b, [0.5, 0.4, 0.34], 0.3 * (1 - b), j); } continue; }
      const q = w / H.warn, X = sx(z.x), Y0 = sy(z.y), beat = 0.7 + 0.3 * Math.sin(GT * (9 + 16 * q));
      L.ring(X, Y0, H.r, H.r * H.ry, [1, 0.4, 0.1], (0.18 + 0.7 * q) * beat, 0.06); L.ring(X, Y0, H.r * 0.55, H.r * H.ry * 0.55, [1, 0.5, 0.15], 0.35 * q * beat, 0.1);
      L.glow(X, Y0 - 4, 18 + 30 * q, [1, 0.55, 0.15], 0.2 + 0.7 * q, 2.4);
      for (let j = 0; j < 7; j++) { const b = (GT * (1.2 + 2.4 * q) + rnd(z.x + z.y, j)) % 1, px = X + (rnd(z.x, j + 3) - 0.5) * 26, py = Y0 - 2 - 22 * b;
        L.star(px, py, 2 + 4 * q * (1 - b), [1, 0.55 + 0.3 * (1 - b), 0.15], q * (1 - b)); } }
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || !known(e.x, e.y)) continue; const ex = sx(e.x), ey = sy(e.y);
      // the crescent is a vertical C on the chest, ±ARC_HALF about the aim, drawn in the blade's turning direction over the strike so
      // it stands whole on the damage frame (the concept's slash); after the hit it fades and its tail runs after the head
      if (e.k === 'swing' && a >= SWING.pull && a < SWING.end) { const f = e.f < 0 ? -1 : 1, RG = RIGS.hero, s = HERO_H / RG.h;
        const shx = ex + f * (RG.shR[0] - RG.gap) * s, shy = ey + (RG.shR[1] - RG.footL[1]) * s, tx = ex + Math.cos(e.a) * st.reach * 0.8, ty = ey + Math.sin(e.a) * st.reach * 0.8 - 34;
        const sw = swingPose(a, f > 0 ? Math.atan2(ty - shy, tx - shx) : Math.PI - Math.atan2(ty - shy, tx - shx), st.arc * Math.PI / 180, -0.95);
        const cx = 2 * Math.round(ex / 2), cy = 2 * Math.round((ey - 0.5 * HERO_H) / 2), g = Math.atan2(ty - cy, tx - cx), Rr = 2 * Math.round(0.62 * HERO_H / 0.8 / 2);
        const p = 1 - (1 - Math.min(1, (a - SWING.pull) / (SIM.K.HIT - SWING.pull))) ** 2, q = SS(SIM.K.HIT, SIM.K.HIT + 0.1, a), span = 2 * ARC_HALF * f * sw.dir;
        const e0 = g - span / 2 + 0.3 * span * q, e1 = g - span / 2 + span * p, amt = 1.3 * (1 - q * q), open = p > 0.02 && q < 1;
        const pt = (b) => [cx + Math.cos(b) * Rr * 0.8, cy + Math.sin(b) * Rr * 0.8];
        L.joint('hero_fx', 'trailC', [cx, cy]); L.joint('hero_fx', 'trail', pt(e1)); L.joint('hero_fx', 'trailMid', pt(e0 + ARC_MID * (e1 - e0)));
        L.joint('hero_fx', 'aim', [cx + Math.cos(g) * 40, cy + Math.sin(g) * 40]);
        L.joint('hero_fx', 'trailA', [open ? amt * p : 0, 0]);
        if (open) G.draw(L.P.arc, { u_arc: [e0, e1, 0.12, 1], u_col: [1, 0.85, 0.6], u_sz: [2 * Rr, 2 * Rr], u_amt: amt, u_dark: 0.45 * (1 - q), u_hard: 1 }, G.xf(cx - Rr, cy - Rr, 2 * Rr, 2 * Rr)); }
      if (e.k === 'eswing' && a < 0.2) G.draw(L.P.arc, { u_arc: [e.a - 0.9, e.a + 0.9 * Math.min(1, a / 0.12), 0.2, 0.75], u_col: [1, 0.5, 0.4], u_amt: 1 - a / 0.2, u_dark: 0, u_hard: 0 }, G.xf(ex - 50, ey - 26 - 50, 100, 100));
      // a ghost's ectoplasm: glowing drops that drift up and thin out, they never reach the floor
      if (e.k === 'hit' && a < 0.6 && !e.fire && BLOOD(e.type) === 'ecto') { const q = a / 0.6; L.glow(ex, ey, 30 + 16 * q, [0.4, 1, 0.8], 0.7 * (1 - q), 2.4);
        for (let j = 0; j < 6; j++) { const an = rnd(e.t, j + 20) * 6.28, d = 6 + 26 * Math.sqrt(q); L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d * 0.7 - 34 * q, 5 + 3 * rnd(e.t, j), [0.5, 1, 0.85], 0.9 * (1 - q)); } }
      // a blow off the crab's armour (TASKS 309): a white flash on the shell's edge toward the blow and a fan of sparks thrown back at it
      // under gravity, no blood: it reads as steel struck, not a wound
      if (e.k === 'hit' && e.arm && a < 0.45) { const ox = ex + Math.cos(e.a) * 20, oy = ey + 10 + Math.sin(e.a) * 15, q = a / 0.45;
        if (a < 0.12) { L.glow(ox, oy, 26 + 30 * a, [1, 0.92, 0.7], 1.6 * (1 - a / 0.12), 2.6); L.star(ox, oy, 22 * (1 - a / 0.12) + 6, [1, 0.97, 0.85], 1 - a / 0.12); }
        for (let j = 0; j < (e.crit ? 14 : 10); j++) { const an = e.a + (rnd(e.t, j) - 0.5) * 1.9, v = 140 + 220 * rnd(e.t, j + 5), life = 0.2 + 0.25 * rnd(e.t, j + 9); if (a > life) continue;
          const px = ox + Math.cos(an) * v * a, py = oy + Math.sin(an) * v * a * 0.75 - 50 * a + 520 * a * a, k = 1 - a / life;
          L.star(px, py, 5 + 3 * k, [1, 0.75 + 0.2 * k, 0.4 + 0.4 * k], k); L.star(px - Math.cos(an) * v * 0.012, py - (Math.sin(an) * v * 0.75 - 50 + 1040 * a) * 0.012, 3, [1, 0.6, 0.25], 0.5 * k); } }
      // the imp (TASKS 407): sparks off its fingers as it throws; the salamander's jaws (408) glint as they snap; lava thrown up as it
      // goes under or comes out
      if (e.k === 'flick' && a < 0.2) { const k = 1 - a / 0.2; L.glow(ex, ey, 14, [1, 0.6, 0.2], 0.9 * k, 2.4); for (let j = 0; j < 5; j++) { const an = e.a + (rnd(e.t, j) - 0.5) * 1.6, d = 6 + 40 * a; L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d + 60 * a * a, 4 * k + 2, [1, 0.75, 0.35], k); } }
      if (e.k === 'snap' && a < 0.15) { const k = 1 - a / 0.15; L.star(ex, ey - 6, 14 * k + 4, [1, 0.95, 0.8], 0.8 * k); }
      if ((e.k === 'submerge' || e.k === 'emerge' || e.k === 'flee') && e.k !== 'flee' && a < 0.7) { const q = a / 0.7; L.glow(ex, ey, 30 + 20 * q, [1, 0.5, 0.15], 0.8 * (1 - q), 2);
        for (let j = 0; j < 10; j++) { const an = rnd(e.t, j) * TAU, v = 50 + 90 * rnd(e.t, j + 3), life = 0.35 + 0.3 * rnd(e.t, j + 7); if (a > life) continue; const k = 1 - a / life;
          L.star(ex + Math.cos(an) * v * a, ey + Math.sin(an) * v * a * 0.6 - 120 * a + 420 * a * a, 4 + 3 * k, [1, 0.6 + 0.3 * k, 0.2], k); } }
      // the colossus (TASKS 413): a boulder's dust and sparks, a falling rock's puff, lava thrown up as it rises, its crust bursting
      if ((e.k === 'boulder' || e.k === 'rock') && a < 0.6) { const big = e.k === 'boulder', q = a / 0.6; L.ring(ex, ey, e.r * (0.5 + 0.8 * q), e.r * 0.75 * (0.5 + 0.8 * q), [0.95, 0.8, 0.6], 0.6 * (1 - q), 0.15);
        for (let j = 0; j < (big ? 10 : 4); j++) { const an = rnd(e.t, j) * TAU, v = 60 + 120 * rnd(e.t, j + 3); L.star(ex + Math.cos(an) * v * a, ey + Math.sin(an) * v * a * 0.6 - 140 * a + 500 * a * a, 4 + 3 * (1 - q), [1, 0.6, 0.2], (big ? 1 : 0.6) * (1 - q)); } }
      if ((e.k === 'colrise' || e.k === 'shatter' || e.k === 'colerupt') && a < 1.2) { const q = a / 1.2; L.glow(ex, ey - 80, 120 + 80 * q, [1, 0.45, 0.12], 0.7 * (1 - q), 2);
        for (let j = 0; j < 18; j++) { const an = rnd(e.t, j) * TAU, v = 80 + 160 * rnd(e.t, j + 3), life = 0.6 + 0.6 * rnd(e.t, j + 7); if (a > life) continue; const k = 1 - a / life;
          L.star(ex + Math.cos(an) * v * a, ey - 90 + Math.sin(an) * v * a * 0.6 - 160 * a + 380 * a * a, 4 + 4 * k, [1, 0.6 + 0.3 * k, 0.2], k); } }
      // the crab's pinch: a glint where the claw snaps shut
      if (e.k === 'pinch' && a < 0.15) { const k = 1 - a / 0.15; L.star(ex, ey - 12, 16 * k + 4, [1, 0.95, 0.8], 0.9 * k); }
      if (e.k === 'hit' && !e.arm && a < 0.3) { const q = a / 0.3; for (let j = 0; j < (e.crit ? 9 : 5); j++) { const an = rnd(e.t, j) * 6.28, d = 8 + 34 * q * (0.5 + rnd(e.t, j + 9));
          L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d, e.crit ? 12 : 8, e.fire ? [1, 0.6, 0.2] : [1, 0.85, 0.6], (e.fire ? 0.6 : 1) * (1 - q)); } }
      // the crust (TASKS 401): a flash of heat through the cracks as it gives, a splash of lava as it melts or as a monster goes in
      if (e.k === 'crack' && a < 0.5) { const q = a / 0.5; L.glow(ex, ey, 40, [1, 0.45, 0.1], 0.5 * (1 - q), 2.2); }
      if ((e.k === 'melt' || e.k === 'sink') && a < 0.7) { const q = a / 0.7; L.glow(ex, ey - 4, 46, [1, 0.5, 0.12], 0.45 * (1 - q), 2.4);
        for (let j = 0; j < 8; j++) { const an = -Math.PI * (0.1 + 0.8 * rnd(e.t, j)), v = 60 + 90 * rnd(e.t, j + 9), px = ex + Math.cos(an) * v * a, py = ey + Math.sin(an) * v * a + 380 * a * a;
          if (py < ey + 6) L.star(px, py, 5, [1, 0.6 + 0.3 * (1 - q), 0.2], 1 - q); } }
      // a vent's burst (TASKS 406): a flash, a ring of heat running out to the edge of its reach, lava thrown over it
      if (e.k === 'erupt' && a < 0.9) { const H = D.HAZ.vent, q = Math.min(1, a / 0.3);
        L.glow(ex, ey - 10, 30 + 40 * q, [1, 0.55, 0.15], 0.75 * (1 - a / 0.9), 2.2); L.ring(ex, ey, H.r * (0.25 + 0.75 * q), H.r * H.ry * (0.25 + 0.75 * q), [1, 0.6, 0.2], 0.9 * (1 - SS(0.15, 0.6, a)), 0.12);
        // (TASKS 485: it read as a soft disc) a jet of lava stands up out of the mouth, and each gout thrown lands with a splash
        const jh = 110 * SS(0, 0.12, a) * (1 - SS(0.25, 0.55, a)); for (let k = 0; k * 6 < jh; k++) { const f = k * 6 / Math.max(1, jh), jx = ex + Math.sin(a * 30 + k * 0.7) * 2;
          L.glow(jx, ey - 6 - k * 6, 14 - 7 * f, [1, 0.6 - 0.25 * f, 0.12], 1.1, 2.6); L.star(jx, ey - 6 - k * 6, 7 - 3 * f, [1, 0.92 - 0.3 * f, 0.45], 1); }
        for (let j = 0; j < 24; j++) { const life = 0.45 + 0.4 * rnd(e.t, j + 7), an = rnd(e.t, j) * 6.283, d1 = H.r * (0.5 + 0.55 * rnd(e.t, j + 40));
          if (a > life && a < life + 0.3) { const sq = (a - life) / 0.3; L.ring(ex + Math.cos(an) * d1, ey + Math.sin(an) * d1 * H.ry, 3 + 9 * sq, 2 + 5 * sq, [1, 0.5, 0.15], 0.8 * (1 - sq), 0.3); }
          if (a > life) continue; const k = 1 - a / life, d = d1 * Math.min(1, a / 0.35);
          const px = ex + Math.cos(an) * d, py = ey + Math.sin(an) * d * H.ry - Math.max(0, (150 + 120 * rnd(e.t, j + 20)) * a - 520 * a * a); L.star(px, py, 4 + 5 * k, [1, 0.5 + 0.4 * k, 0.12 + 0.3 * k], k); } }
      if (e.k === 'scorch' && a < 0.4) { const q = a / 0.4; L.glow(ex, ey - 6, 34, [1, 0.5, 0.15], 0.3 * (1 - q), 2.4); L.ring(ex, ey, 10 + 22 * q, 6 + 10 * q, [1, 0.55, 0.2], 0.6 * (1 - q), 0.2); }
      if (e.k === 'boom' && a < 0.65) {
        const gx = e.gx ?? e.x, gy = e.gy ?? e.y + 24, k = e.big ? 1.4 : 1;
        for (let j = 0; j < 18; j++) {
          const an = rnd(e.t, j) * Math.PI * 2, speed = (65 + 135 * rnd(e.t, j + 3)) * k, d = speed * a, lift = Math.max(0, (65 + rnd(e.t, j + 8) * 100) * a - 180 * a * a);
          const x = gx + Math.cos(an) * d, y = gy + Math.sin(an) * d / 1.3 - lift, r = 2 + 3 * (1 - a / 0.65);
          spell('fireball', x, y, r * 1.5, r * 1.5, { u_center: [x, y], u_origin: [gx, gy], u_dir: [Math.cos(an), Math.sin(an)], u_radius: r, u_age: a, u_amt: 0.6 * (1 - a / 0.65), u_seed: j + e.t, u_mode: 1, u_lift: lift });
        }
      }
      if (e.k === 'cast' && a < 0.25) L.glow(ex, ey, 30, [1, 0.6, 0.2], 0.4 * (1 - a / 0.25), 3);
      if (e.k === 'eshoot' && a < 0.3) L.glow(ex, ey, 26, [0.4, 1, 0.4], 1 - a / 0.3, 3);
      if (e.k === 'slam' && a < 4.6) L.cracks(ex, ey, e.big ? 130 : 70, a, e.id || 1, 1);
      if (e.k === 'lvl' && a < 1.6) { const q = a / 1.6; L.ring(ex, ey, 30 + 80 * q, 14 + 36 * q, [1, 0.85, 0.4], 1 - q, 0.1); for (let j = 0; j < 14; j++) { const an = j / 14 * 6.28;
          L.star(ex + Math.cos(an) * (20 + 30 * q), ey - 20 - 90 * q * (0.5 + rnd(j, 2)), 9, [1, 0.85, 0.4], 1 - q); } }
      if ((e.k === 'pickup' || e.k === 'gold' || e.k === 'shard' || e.k === 'chest') && a < 0.5) { const q = a / 0.5, col = e.k === 'shard' ? [0.4, 0.7, 1] : e.k === 'pickup' ? D.RARITY[e.rar || 0].col : [1, 0.85, 0.3];
        for (let j = 0; j < 6; j++) { const an = j / 6 * 6.28 + e.t; L.star(ex + Math.cos(an) * 26 * q, ey - 10 + Math.sin(an) * 18 * q - 20 * q, 9, col, 1 - q); } }
      if ((e.k === 'shield' || e.k === 'barrier') && a < 0.4) L.ring(ex, ey - 30, 30 + 30 * (a / 0.4), 40 + 30 * (a / 0.4), [0.5, 0.8, 1], 1 - a / 0.4, 0.15);
      if (e.k === 'drink' && a < 0.6) for (let j = 0; j < 8; j++) { const q = a / 0.6, an = j / 8 * 6.28 + a * 6; L.star(ex + Math.cos(an) * 20, ey - 10 - 60 * q * (0.4 + rnd(j, 1)), 7, e.b === 'hp_potion' ? [1, 0.35, 0.35] : [0.4, 0.6, 1], 1 - q); }
      // a fire priest's pillar (TASKS 410): flames standing in the ring for its burst, a white-hot core, then dying down
      if (e.k === 'pillar' && a < PILLAR_T) { const P = D.ENEMIES.fire_priest.pyre, up = SS(0, 0.06, a), dn = 1 - SS(P.burst, PILLAR_T, a), k = up * dn;
        L.glow(ex, ey - 50, P.r * 1.6, [1, 0.45, 0.12], 0.9 * k, 2.2); L.ring(ex, ey, P.r, P.r * P.ry, [1, 0.6, 0.25], 0.8 * k, 0.12);
        G.blend('add'); for (let j = 0; j < 7; j++) { const an = j / 7 * TAU + e.id, rr = j ? 0.62 : 0, fx = ex + Math.cos(an) * P.r * rr, fy = ey + Math.sin(an) * P.r * P.ry * rr, hh = (j ? 70 : 130) * (0.6 + 0.4 * up) * (0.4 + 0.6 * dn);
          flameAt(fx, fy + 6, (j ? 26 : 42) * (0.7 + 0.3 * dn), hh, [1, 0.45 + 0.15 * (j % 2), 0.12], e.id * 11 + j, 3 * Math.sin(t * 3 + j), t * 1.5); } G.blend();
        L.glow(ex, ey - 30, 26, [1, 0.95, 0.75], 0.8 * k, 3); }
      // a fire priest lights its allies' weapons: sparks fly from its staff to each in an arc
      if (e.k === 'kindle' && a < 0.45) for (const id of e.to || []) { const o = R.en.find((q) => q.id === id); if (!o) continue; const tx = sx(o.x), ty = sy(o.y) - 40;
        for (let j = 0; j < 5; j++) { const u = Math.min(1, Math.max(0, (a - j * 0.04) / 0.3)); if (u <= 0 || u >= 1) continue;
          L.star(ex + (tx - ex) * u, ey + (ty - ey) * u - 50 * Math.sin(Math.PI * u), 9, [1, 0.55 + 0.1 * j, 0.15], 1 - 0.5 * u); } }
      if (e.k === 'kindle' && a < 0.4) L.glow(ex, ey - 30, 40, [1, 0.5, 0.15], 0.9 * (1 - a / 0.4), 2.4);
      // the fuse: the blast's true reach drawn on the floor, a second ring closing in on it as the time runs out
      if (e.k === 'fuse' && a < e.d) { const q = a / e.d, beat = 0.6 + 0.4 * Math.sin(a * (8 + 30 * q)), [fx, fy] = fuseAt(e), ex = sx(fx), ey = sy(fy);
        // (a danger, red as the rocks' marks, TASKS 1041: gold it read apart from the marks of 487)
        L.ring(ex, ey, e.r, e.r, [1, 0.22, 0.08], (0.45 + 0.5 * q) * beat, 0.05); L.ring(ex, ey, e.r * q, e.r * q, [1, 0.3, 0.1], 0.55 * beat, 0.08);
        L.glow(ex, ey - 20, 40 + 30 * q, [1, 0.75, 0.3], 0.4 * q * beat, 2.4); }
      // a vampire's blow: blood drawn off the hero into the elite
      if (e.k === 'drain' && a < 0.5) for (let j = 0; j < 7; j++) { const u = Math.min(1, Math.max(0, (a - j * 0.03) / 0.3)); if (u <= 0 || u >= 1) continue;
        L.star(ex + (sx(e.tx) - ex) * u, ey + (sy(e.ty) - ey) * u - 30 * Math.sin(Math.PI * u), 8, [0.95, 0.1, 0.18], 1 - u * 0.5); }
      // (the colossus's imps, TASKS 413, come up out of the ground in fire, not in the necromancer's green)
      if (e.k === 'summon' && a < 0.6) { const q = a / 0.6, c = e.fire ? [1, 0.5, 0.15] : [0.5, 1, 0.4]; L.ring(ex, ey, 20 + 30 * q, 10 + 15 * q, c, 1 - q, 0.2); L.glow(ex, ey - 20, 50, e.fire ? [1, 0.4, 0.1] : [0.4, 1, 0.3], 1 - q); }
      // an elite's blink, its curse landing, its ward broken (TASKS 387)
      if (e.k === 'blink' && a < 0.45) { const q = a / 0.45, c = [0.2, 0.95, 0.85], tx = sx(e.tx), ty = sy(e.ty); L.ring(ex, ey, 14 + 30 * q, 7 + 15 * q, c, 1 - q, 0.2); L.glow(ex, ey - 30, 50, c, 1 - q);
        L.ring(tx, ty, 44 - 30 * q, 22 - 15 * q, c, 1 - q, 0.2); L.glow(tx, ty - 30, 60, c, 1.2 * (1 - q)); }
      if (e.k === 'chill' && a < 0.5) { const q = a / 0.5; L.glow(ex, ey, 55, [0.55, 0.85, 1], 1 - q, 2.2); }
      // a tugging elite's warning: a ring closing in on it; the tug itself: a streak from the hero to it
      if (e.k === 'tug_warn' && a < e.d) { const q = a / e.d, c = [1, 0.5, 0.8]; L.ring(ex, ey, 90 * (1 - q) + 20, 45 * (1 - q) + 10, c, 0.4 + 0.5 * q, 0.12); L.glow(ex, ey - 30, 40, c, 0.5 * q); }
      if (e.k === 'tug' && a < 0.4) { const q = a / 0.4, tx = sx(e.tx), ty = sy(e.ty); for (let j = 0; j < 8; j++) { const u = j / 7; L.star(ex + (tx - ex) * u, ey - 30 + (ty - ey) * u, 5, [1, 0.55, 0.85], (1 - q) * (0.4 + 0.6 * u)); } }
      if (e.k === 'curse' && a < 0.6) { const q = a / 0.6; L.glow(ex, ey, 60, [0.5, 0.85, 0.2], 1 - q, 2.2); L.ring(ex, ey + 40, 40 - 20 * q, 20 - 10 * q, [0.5, 0.85, 0.2], 1 - q, 0.15); }
      if (e.k === 'ward_break' && a < 0.5) { const q = a / 0.5; for (let j = 0; j < 8; j++) { const an = j * 0.785 + 0.3; L.star(ex + Math.cos(an) * (10 + 50 * q), ey + Math.sin(an) * (6 + 30 * q), 7 * (1 - q) + 2, [0.35, 0.6, 1.0], 1 - q); }
        L.glow(ex, ey, 50, [0.4, 0.65, 1], 1 - q, 2.2); }
      if (e.k === 'bless' && a < 1.2) { const q = a / 1.2; L.glow(ex, ey - 30, 90, [0.5, 0.8, 1], 1.4 * (1 - q)); L.ring(ex, ey, 40 + 90 * q, 20 + 45 * q, [0.6, 0.85, 1], 1 - q, 0.1); }
      // an enemy bolt bursts where it dies; on the hero it splashes wider with a ring
      // the jet bursts into a spray that falls
      if (e.k === 'orb' && a < 0.3) { const q = a / 0.3; L.glow(ex, ey, 22, [0.35, 0.85, 0.95], 0.9 * (1 - q), 3); L.ring(ex, ey, 6 + 16 * q, 4 + 10 * q, [0.7, 0.95, 1], 0.8 * (1 - q), 0.15); }
      if (e.k === 'soak' && a < 0.5) { const q = a / 0.5; L.ring(ex, ey + 38, 12 + 30 * q, 5 + 12 * q, [0.6, 0.9, 1], 0.7 * (1 - q), 0.12); }
      if (e.k === 'pop' && e.c === 'arrow') { /* splinters: below, not lit up */ }
      else if (e.k === 'pop' && (e.c === 'jet' || e.c === 'orb' || e.c === 'wave') && a < 0.5) { const col = [0.62, 0.86, 0.94]; if (e.hero) L.ring(ex, ey + 30, 10 + 40 * a / 0.5, 6 + 16 * a / 0.5, col, 0.6 * (1 - a / 0.5), 0.15);
        for (let j = 0; j < (e.hero ? 12 : 7); j++) { const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 3, v = 60 + 90 * rnd(e.t, j + 4), u = Math.min(a, 0.45); L.solid(ex + Math.cos(an) * v * u, ey + Math.sin(an) * v * u - 30 * u + 420 * u * u, 3, 4, col, an, 1.5, 2, 1 - SS(0.3, 0.45, a)); } }
      else if (e.k === 'pop' && a < (e.hero ? 0.4 : 0.25)) { const q = a / (e.hero ? 0.4 : 0.25), col = e.c === 'hex' ? [0.45, 1, 0.4] : [1, 0.55, 0.18];
        L.glow(ex, ey, (e.hero ? 46 : 26) * (1 + 0.5 * q), col, 0.35 * (1 - q), 2.4); if (e.hero) L.ring(ex, ey, 14 + 40 * q, 10 + 28 * q, col, 0.6 * (1 - q), 0.18);
        for (let j = 0; j < (e.hero ? 8 : 4); j++) { const an = rnd(e.t, j) * 6.28, d = 6 + (e.hero ? 40 : 22) * q; L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d * 0.8, 7, col, 0.6 * (1 - q)); } }
      // a knocked prop: sparks off metal and stone, a brazier spits embers, crystal flares
      if (e.k === 'prop' && a < 0.9) { const [pw, ph] = e.n === 'fence_mg' ? [24, 30] : SZ(e.n), ix = ex - e.s * pw * 0.3, iy = ey - ph * 0.45;
        if ((e.mat === 'metal' || e.mat === 'stone') && a < 0.3) { const q = a / 0.3; for (let j = 0; j < (e.mat === 'metal' ? 8 : 4); j++) { const an = Math.PI * (e.s > 0 ? 1 : 0) + (rnd(e.t, j) - 0.5) * 2.4, v = 90 + 120 * rnd(e.t, j + 5);
          L.star(ix + Math.cos(an) * v * a, iy + Math.sin(an) * v * a * 0.7 + 260 * a * a, 6, [1, 0.88, 0.6], 1 - q); } }
        if (e.n === 'brazier' || e.n === 'torch_sconce' || e.mat === 'fire') for (let j = 0; j < (e.n === 'torch_sconce' ? 7 : 10); j++) { const q = a / 0.9, an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 1.6, v = 60 + 110 * rnd(e.t, j + 3);
          L.star(ex + Math.cos(an) * v * a, ey - ph * 0.9 + Math.sin(an) * v * a + 60 * a * a, 5, [1, 0.6, 0.2], (1 - q) * (0.6 + 0.4 * rnd(e.t, j + 9))); }
        if (e.mat === 'crystal' && a < 0.5) { const q = a / 0.5; L.glow(ix, iy, 40 + 30 * q, [0.5, 0.75, 1], 1.4 * (1 - q), 2.6); for (let j = 0; j < 6; j++) { const an = j / 6 * 6.28 + e.t;
          L.star(ix + Math.cos(an) * 30 * q, iy + Math.sin(an) * 22 * q, 8, [0.6, 0.85, 1], 1 - q); } } }
      if (e.k === 'prop' && e.mat === 'fungus' && a < 0.7) {
        const g = glowOf({ n: e.n, s: e.scale }), col = B.shroom || GLOW_COL.shroom, strength = e.touch ? 0.4 : 1;
        L.glow(ex, ey - g.up, g.cap * 2, col, 0.45 * strength * (1 - a / 0.7), 3);
        for (let j = 0; j < 9; j++) {
          const an = rnd(e.t, j) * Math.PI * 2, v = 15 + rnd(e.t, j + 11) * 40, x = ex + Math.cos(an) * v * a, y = ey - g.up + Math.sin(an) * v * a * 0.5 - a * 25;
          L.solid(Math.round(x / PIX) * PIX, Math.round(y / PIX) * PIX, PIX, PIX, col, 0, 0, 0, strength * (1 - a / 0.7));
        }
      }
      // the plate fires: sparks off the steel tips
      if (e.k === 'spike' && a < 0.3) { const q = a / 0.3; for (let j = 0; j < 7; j++) { const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 2.2, v = 60 + 90 * rnd(e.t, j + 5);
        L.star(ex + Math.cos(an) * v * a * 1.6, ey - 18 + Math.sin(an) * v * a * 1.6 + 200 * a * a, 6, [1, 0.88, 0.6], 1 - q); } }
      // a scroll's light pillar where the hero vanished and where he lands
      if (e.k === 'teleport' && a < 0.9) { const q = a / 0.9;
        for (const [px, py, k] of [[ex, ey, 1], [sx(e.fx ?? e.x), sy(e.fy ?? e.y), 0.7]]) { const wd = 60 * (1 - 0.6 * q);
          G.draw(L.P.glow, { u_col: [0.55, 0.78, 1], u_k: 2.2, u_amt: 1.3 * k * (1 - q) }, G.xf(px - wd / 2, py - 220, wd, 240)); L.ring(px, py, 20 + 50 * q, 8 + 18 * q, [0.6, 0.85, 1], k * (1 - q), 0.15);
          for (let j = 0; j < 8; j++) { const an = j / 8 * 6.28 + a * 5; L.star(px + Math.cos(an) * 26 * (1 - q), py - 10 - 140 * q * (0.4 + rnd(j, 3)), 7, [0.7, 0.88, 1], k * (1 - q)); } } }
      // a workshop's work (TASKS 1013): sparks off the anvil; a blue burst over the lectern, or a red one when the spell falls apart
      if (e.k === 'craft' && a < 0.9) { const q = a / 0.9, col = e.kind === 'forge' ? [1, 0.75, 0.35] : e.ok ? [0.55, 0.78, 1] : [1, 0.35, 0.25];
        for (let j = 0; j < 12; j++) { const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 2.6, v = 40 + 90 * rnd(e.t, j + 7); L.star(ex + Math.cos(an) * v * q, ey - 30 + Math.sin(an) * v * q + 120 * q * q, 7, col, 1 - q); }
        if (e.kind !== 'forge') L.ring(ex, ey - 20, 16 + 70 * q, 8 + 30 * q, col, 0.9 * (1 - q), 0.12); }
      // a waystone wakes: a cold ring off its foot and sparks running up its face
      if (e.k === 'waystone' && a < 1.2) { const q = a / 1.2; L.ring(ex, ey, 20 + 110 * q, 9 + 48 * q, [0.6, 0.8, 1], 0.9 * (1 - q), 0.1);
        for (let j = 0; j < 9; j++) L.star(ex + (rnd(e.t, j) - 0.5) * 30, ey - 20 - 110 * Math.min(1, q * (1.2 + rnd(e.t, j + 4))), 7, [0.7, 0.88, 1], 1 - q); }
      if (e.k === 'floor' && a < 1.4) { const q = a / 1.4; L.ring(ex, ey, 30 + 120 * q, 14 + 56 * q, [1, 0.85, 0.5], 0.8 * (1 - q), 0.08);
        for (let j = 0; j < 10; j++) { const an = j / 10 * 6.28; L.star(ex + Math.cos(an) * (24 + 60 * q), ey - 20 + Math.sin(an) * (12 + 30 * q), 7, [1, 0.85, 0.5], 1 - q); } }
      // the boss's roar: shock rings off his maw and the floor around him
      if (e.k === 'roar' && a < 0.9) for (let j = 0; j < 3; j++) { const q = (a - j * 0.12) / 0.6; if (q < 0 || q > 1) continue;
        L.ring(ex, ey, 40 + 260 * q, 24 + 150 * q, B.cave ? [0.5, 0.8, 0.9] : [1, 0.4, 0.15], 0.9 * (1 - q), 0.06); if (j === 0) L.glow(ex, ey, 70, B.cave ? [0.5, 0.85, 1] : [1, 0.45, 0.2], 1.2 * (1 - q), 2.4); }
      if (e.k === 'die') { if (a < 0.4) L.glow(ex, ey - 40, 70, [1, 0.25, 0.15], 1.4 * (1 - a / 0.4), 2.4);
        const q = SS(0.3, 1.6, a); if (a > 0.25 && a < 1.6) { L.glow(ex, ey - 50 - 110 * q, 26, [0.55, 0.75, 1], 0.9 * (1 - SS(1.2, 1.6, a)), 2.6);
          for (let j = 0; j < 5; j++) L.star(ex + 10 * Math.sin(a * 4 + j * 1.3), ey - 50 - 110 * q + j * 14, 6 - j, [0.6, 0.8, 1], 0.7 * (1 - j / 5) * (1 - SS(1.2, 1.6, a))); } }
    }
    G.blend();
    // a hero soaked by a mage's water drips from head to foot while it slows him (TASKS 311)
    if (GT < (h.slowT ?? -9) && h.deadT < 0 && !SC.hide.hero) { const left = h.slowT - GT;
      for (let j = 0; j < 6; j++) { const c = GT * 1.7 + j / 6, q = c % 1, k = Math.floor(c) * 7 + j;
        L.solid(Math.round((sx(h.x) + (rnd(k, 1) - 0.5) * 28) / PIX) * PIX, Math.round((sy(h.y) - 64 * rnd(k, 2) + 46 * q * q) / PIX) * PIX, PIX, PIX * 2, [0.55, 0.85, 0.95], 0, 0, 0, 0.85 * (1 - q) * SS(0, 0.3, left)); } }
    // non-additive event FX (dust, debris, blood)
    // a rock about to fall (TASKS 406), from its clock: dust and grit trickle down onto its shadow
    for (const z of m.hazards || []) { if (z.k !== 'fall' || !vis(z.x, z.y) || !known(z.x, z.y)) continue; const H = D.HAZ.fall, w = D.hazClock(z, GT) - (z.per - H.warn); if (w < 0) continue;
      const q = w / H.warn; for (let j = 0; j < 5; j++) { const b = (GT * 1.6 + rnd(z.x + z.y, j)) % 1, px = sx(z.x) + (rnd(z.x, j + 5) - 0.5) * 30;
        L.puff(px, sy(z.y) - 150 + 150 * b, 5 + 4 * b, [0.62, 0.56, 0.5], 0.6 * q * (1 - b * b), j); } }
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || !known(e.x, e.y)) continue; const ex = sx(e.x), ey = sy(e.y);
      // an arrow breaks on the rock: splinters of its shaft and a puff of grit (TASKS 311)
      if (e.k === 'pop' && e.c === 'arrow' && !e.hero && a < 0.4) { const u = Math.min(a, 0.3); L.puff(ex, ey + 4, 4 + 10 * a / 0.4, [0.35, 0.3, 0.27], 0.35 * (1 - a / 0.4), e.t * 10);
        for (let j = 0; j < 4; j++) { const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 2.6, v = 50 + 70 * rnd(e.t, j + 4); L.solid(ex + Math.cos(an) * v * u, ey + Math.sin(an) * v * u + 300 * u * u, 4, 2, [0.55, 0.36, 0.2], an + 8 * u * (j - 1.5), 2, 1, 1 - SS(0.25, 0.4, a)); } }
      if (e.k === 'colstep' && a < 0.65) { const q = a / 0.65;
        for (let i = 0; i < 3; i++) L.puff(ex + (i - 1) * (6 + 12 * q), ey - 3 - 9 * q, 8 + 15 * q, [0.3, 0.28, 0.27], 0.32 * (1 - q), e.t * 10 + i);
      }
      if (e.k === 'step' && !e.wet && a < 0.4) { const q = a / 0.4; L.puff(ex, ey - 2 - 6 * q, 5 + 8 * q, [0.35, 0.3, 0.27], 0.35 * (1 - q), e.t * 10); }
      if (e.k === 'step' && e.wet && a < 0.6) { const q = a / 0.6, col = B.water.map((v) => Math.min(1, v * 3 + 0.15));
        L.ring(ex, ey + 2, 5 + 27 * q, 2 + 12 * q, col, 0.65 * (1 - q), 0.07);
        L.ring(ex - 2, ey + 3, 2 + 19 * q, 1 + 8 * q, col, 0.3 * (1 - q), 0.09);
        for (let j = 0; j < 3; j++) { const an = rnd(e.t, j) * 6.28, v = 25 + 30 * rnd(e.t, j + 4), u = Math.min(a, 0.32);
          L.solid(ex + Math.cos(an) * v * u, ey + Math.sin(an) * v * u * 0.5 - 65 * u + 210 * u * u, 3, 4, col, an, 1, 2, 1 - SS(0.2, 0.34, a)); } }
      // the drowned bursts up out of the shallows (TASKS 307): rings and a sheet of drops thrown high; so does the eel coming up, going
      // under and sinking dead (TASKS 310)
      if ((e.k === 'rise' || e.k === 'dive' || (e.k === 'kill' && e.type === 'eel')) && a < 0.9) { const q = a / 0.9, col = B.water.map((v) => Math.min(1, v * 3 + 0.2));
        L.ring(ex, ey + 2, 12 + 46 * q, 5 + 18 * q, col, 0.7 * (1 - q), 0.06); L.ring(ex, ey + 3, 6 + 30 * SS(0.15, 1, q), 3 + 12 * SS(0.15, 1, q), col, 0.45 * (1 - q), 0.09);
        for (let j = 0; j < 12; j++) { const an = rnd(e.t, j) * 6.28, v = 30 + 50 * rnd(e.t, j + 4), up = 120 + 90 * rnd(e.t, j + 8), u = Math.min(a, 0.55);
          L.solid(ex + Math.cos(an) * v * u, ey - 20 + Math.sin(an) * v * u * 0.5 - up * u + 420 * u * u, 3, 4, col, an, 1, 2, 1 - SS(0.4, 0.6, a)); } }
      // the eel's jaws snap shut shedding water
      if (e.k === 'bite' && a < 0.4) { const col = B.water.map((v) => Math.min(1, v * 3 + 0.25));
        for (let j = 0; j < 7; j++) { const an = e.a + (rnd(e.t, j) - 0.5) * 2.2, v = 50 + 70 * rnd(e.t, j + 4), u = Math.min(a, 0.35); L.solid(ex + Math.cos(an) * v * u, ey - 40 + Math.sin(an) * v * u * 0.6 - 40 * u + 380 * u * u, 2, 4, col, an, 1, 2, 1 - SS(0.25, 0.4, a)); } }
      // a drowned's blow sheds water, not blood; a slime's spatters green gobs (and more of them when it lands, splits or bursts)
      if (e.k === 'hit' && a < 0.45 && !e.fire && BLOOD(e.type) === 'water') { const col = B.water.map((v) => Math.min(1, v * 3 + 0.2));
        for (let j = 0; j < 5; j++) { const an = rnd(e.t, j + 20) * 6.28, v = 30 + 40 * rnd(e.t, j + 4), u = Math.min(a, 0.4); L.solid(ex + Math.cos(an) * v * u, ey + Math.sin(an) * v * u * 0.6 - 40 * u + 300 * u * u, 2, 4, col, an, 1, 2, 1 - SS(0.3, 0.45, a)); } }
      { const gob = e.k === 'hit' && !e.fire && BLOOD(e.type) === 'slime' ? 5 : e.k === 'land' && BLOOD(e.type) === 'slime' ? 4 : e.k === 'split' ? 12 : e.k === 'kill' && BLOOD(e.type) === 'slime' ? 9 : 0;
        if (gob && a < 0.55) { const big = e.k === 'split' || e.type === 'slime' ? 1 : 0.7;
          for (let j = 0; j < gob; j++) { const an = rnd(e.t, j + 30) * 6.28, v = (40 + 60 * rnd(e.t, j + 4)) * big, u = Math.min(a, 0.45), up = e.k === 'hit' ? 40 : 90;
            const px = ex + Math.cos(an) * v * u, py = ey - (e.k === 'hit' ? 0 : 12) + Math.sin(an) * v * u * 0.55 - up * u + 380 * u * u, sz = (3 + 2 * rnd(e.t, j + 9)) * big;
            L.solid(px, py, sz + 1, sz + 1, [0.06, 0.16, 0.05], 0, (sz + 1) / 2, (sz + 1) / 2, 1 - SS(0.4, 0.55, a)); L.solid(px, py, sz - 1, sz - 1, [0.3, 0.68, 0.2], 0, (sz - 1) / 2, (sz - 1) / 2, 1 - SS(0.4, 0.55, a)); } } }
      if ((e.k === 'douse' || e.k === 'snuff') && a < 0.6) { const q = a / 0.6, steam = e.k === 'douse';
        for (let j = 0; j < 3; j++) L.puff(ex + (j - 1) * (steam ? 9 : 7) + Math.sin(q * 5 + j) * 4, ey - (steam ? 16 : [16, 28, 18][j]) - (steam ? 38 : 26) * q, (steam ? 9 : 4) + 10 * q, steam ? [0.88, 0.92, 0.94] : [0.4, 0.39, 0.37], (steam ? 0.75 : 0.5) * (1 - q), e.t * 13 + j); }
      if (e.k === 'hollow' && a < 0.6) { const q = a / 0.6;
        for (let j = 0; j < 4; j++) L.puff(ex + (j - 1.5) * 10, ey + 8 + 14 * q, 4 + 10 * q, [0.4, 0.36, 0.34], 0.45 * (1 - q), e.t * 11 + j); }
      // the magma caves' answers (TASKS 466): a crack spits embers (a few sparks and a hiss of smoke underfoot), a charred skeleton
      // puffs ash as its bones fly, a chain fence throws a few sparks off its links
      if (e.k === 'prop' && e.mat === 'ember' && a < 0.8) { const q = a / 0.8, k = e.touch ? 4 : 10;
        for (let j = 0; j < k; j++) { const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * (e.touch ? 1.2 : 2.2), v = (e.touch ? 40 : 80) + 90 * rnd(e.t, j + 3);
          L.star(ex + Math.cos(an) * v * a, ey + Math.sin(an) * v * a + 140 * a * a, 4 + 2 * rnd(e.t, j + 5), [1, 0.55 + 0.3 * rnd(e.t, j + 7), 0.12], (1 - q) * 0.9); }
        L.glow(ex, ey - 2, 16 + 10 * (1 - q), [1, 0.45, 0.1], (e.touch ? 0.3 : 0.6) * (1 - q), 2.4);
        for (let j = 0; j < 2; j++) L.puff(ex + (j - 0.5) * 10, ey - 6 - 30 * q, 5 + 8 * q, [0.45, 0.4, 0.37], 0.3 * (1 - q), e.t * 5 + j); }
      if (e.k === 'prop' && e.n === 'skel_mg' && !e.touch && a < 0.9) { const q = a / 0.9; for (let j = 0; j < 4; j++) L.puff(ex + (j - 1.5) * 9, ey - 10 - 18 * q, 7 + 12 * q, [0.3, 0.28, 0.27], 0.5 * (1 - q), e.t * 3 + j); }
      if (e.k === 'prop' && e.mat === 'chain' && a < 0.3) { const q = a / 0.3; for (let j = 0; j < (e.touch ? 2 : 5); j++) { const an = (rnd(e.t, j) - 0.5) * 6.28, v = 50 + 60 * rnd(e.t, j + 2);
        L.star(ex + Math.cos(an) * v * a, ey - 18 + Math.sin(an) * v * a * 0.6, 4, [1, 0.88, 0.6], 1 - q); } }
      if (e.k === 'prop' && e.mat === 'bone' && a < 0.7) { const n = 3 + (parseInt(e.i.slice(1), 10) % 3);
        for (let j = 0; j < n; j++) { const an = j / n * 6.28 + rnd(e.t, j), u = Math.min(a, 0.38), px = ex + Math.cos(an) * (45 + 20 * rnd(e.t, j + 7)) * u, py = ey + Math.sin(an) * 28 * u - 70 * u + 185 * u * u, rot = an + u * 8, al = 1 - SS(0.45, 0.7, a);
          L.solid(px, py, 9, 4, [0.23, 0.2, 0.17], rot, 4, 2, al); L.solid(px, py - 1, 7, 2, [0.73, 0.69, 0.57], rot, 3, 1, al);
          for (const side of [-1, 1]) L.solid(px + side * Math.cos(rot) * 3, py + side * Math.sin(rot) * 3 - 1, 3, 3, [0.73, 0.69, 0.57], rot, 1.5, 1.5, al); } }
      if (e.k === 'dash' && a < 0.45) for (let j = 0; j < 5; j++) { const q = a / 0.45, s = rnd(e.t, j); L.puff(ex - e.dx * (10 + 60 * q * s), ey - e.dy * (10 + 60 * q * s) - 4, 7 + 12 * q, [0.35, 0.3, 0.27], 0.45 * (1 - q), e.t + j); }
      // a skeleton chips: bone splinters thrown up, they bounce once on the floor at its feet and fade
      if (e.k === 'hit' && a < 0.7 && !e.fire && BLOOD(e.type) === 'bone') { const fl = ey + D.ENEMIES[e.type].h * 0.5 + 6;
        for (let j = 0; j < (e.crit ? 9 : 6); j++) { const an = -Math.PI / 2 + (rnd(e.t, j + 20) - 0.5) * 2.6, v = 50 + 80 * rnd(e.t, j + 7), long = rnd(e.t, j + 3) < 0.4;
          L.solid(ex + Math.cos(an) * v * a, Math.min(fl - 4 * rnd(e.t, j + 2), ey + Math.sin(an) * v * a - 60 * a + 520 * a * a), long ? 7 : 4, long ? 2 : 3, [0.86, 0.82, 0.7], an + a * 12 * (rnd(e.t, j + 4) - 0.5), long ? 3 : 2, 1, 1 - SS(0.5, 0.7, a)); } }
      // the crab's shell chips off a blow past its armour: red-brown flakes and a few drops of its pale blue blood
      if (e.k === 'hit' && !e.arm && a < 0.6 && !e.fire && BLOOD(e.type) === 'shell') { const fl = ey + D.ENEMIES[e.type].h * 0.5 + 6;
        for (let j = 0; j < (e.crit ? 8 : 5); j++) { const an = -Math.PI / 2 + (rnd(e.t, j + 20) - 0.5) * 2.8, v = 50 + 70 * rnd(e.t, j + 7);
          L.solid(ex + Math.cos(an) * v * a, Math.min(fl - 4 * rnd(e.t, j + 2), ey + Math.sin(an) * v * a - 50 * a + 480 * a * a), 4, 3, j % 2 ? [0.45, 0.16, 0.08] : [0.62, 0.3, 0.14], an + a * 10 * (rnd(e.t, j + 4) - 0.5), 2, 1.5, 1 - SS(0.4, 0.6, a)); }
        for (let j = 0; j < 4; j++) { const q = Math.min(1, a / 0.45), an = rnd(e.t, j + 40) * 6.28, d = 6 + 26 * q; L.puff(ex + Math.cos(an) * d, ey + Math.sin(an) * d + 50 * q * q, 2.5 + 2 * rnd(e.t, j), [0.35, 0.5, 0.62], 0.85 * (1 - q), j); } }
      // the rush kicks up grit off the floor behind it
      if (e.k === 'rush' && a < 0.6) for (let j = 0; j < 5; j++) { const q = a / 0.6, s2 = rnd(e.t, j); L.puff(ex - Math.cos(e.a) * (10 + 50 * q * s2) + (s2 - 0.5) * 20, ey - Math.sin(e.a) * (10 + 50 * q * s2) * 0.8 - 3, 6 + 10 * q, [0.35, 0.33, 0.3], 0.4 * (1 - q), e.t + j); }
      // an imp's take-off and landing (TASKS 407) puff ash off the floor; a golem's plate of crust growing back (409) sheds grit
      if ((e.k === 'leap' || e.k === 'land') && a < 0.45) for (let j = 0; j < 4; j++) { const q = a / 0.45, an = (j / 4 + rnd(e.t, j) * 0.2) * TAU; L.puff(ex + Math.cos(an) * (6 + 18 * q), ey + Math.sin(an) * (3 + 8 * q) - 2, 5 + 7 * q, [0.34, 0.32, 0.3], 0.38 * (1 - q), e.t + j); }
      if (e.k === 'regrow' && a < 0.5) for (let j = 0; j < 5; j++) { const q = a / 0.5, an = rnd(e.t, j) * TAU; L.solid(ex + Math.cos(an) * 26 * (1 - q), ey + Math.sin(an) * 30 * (1 - q), 3, 3, [0.3, 0.28, 0.28], 0, 1.5, 1.5, 0.9 * (1 - q)); }
      // red blood; a spider's ichor is a sick green
      if (e.k === 'hit' && a < 0.45 && !e.fire && (!BLOOD(e.type) || BLOOD(e.type) === 'ichor')) for (let j = 0; j < 5; j++) { const q = a / 0.45, an = rnd(e.t, j + 20) * 6.28, d = 6 + 30 * q;
        L.puff(ex + Math.cos(an) * d, ey + Math.sin(an) * d + 50 * q * q, 3 + 2 * rnd(e.t, j), BLOOD(e.type) === 'ichor' ? [0.36, 0.46, 0.08] : [0.45, 0.04, 0.04], 0.9 * (1 - q), j); }
      if (e.k === 'break' && a < 0.7) for (let j = 0; j < 7; j++) { const q = a / 0.7, an = rnd(e.t, j) * 6.28, v = 40 + 60 * rnd(e.t, j + 7);
        L.solid(ex + Math.cos(an) * v * a, ey - 14 + Math.sin(an) * v * a * 0.6 - 120 * a + 300 * a * a, 5, 4, e.kind === 'pot' || e.kind.startsWith('vase') ? [0.5, 0.24, 0.14] : e.kind === 'gold' || e.kind === 'goldpile' ? [1, 0.78, 0.25] : [0.4, 0.26, 0.14], an, 2, 2, 1 - SS(0.5, 0.7, a)); }
      // a blow on a fake wall knocks out chips and a breath of dust; the break blows the stretch of wall into the room
      if (e.k === 'secret' && e.kind === 'shelf' && a < 1.2) { for (let j = 0; j < 18; j++) { const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 2.6, v = 80 + 140 * rnd(e.t, j + 7), px = ex + (rnd(e.t, j + 3) - 0.5) * 90 + Math.cos(an) * v * a * 0.6;
          const py = ey + 30 + Math.min(20 + 16 * rnd(e.t, j + 11), -Math.abs(Math.sin(an)) * v * a + 520 * a * a) - 30, book = j % 3 === 0, col = book ? [[0.45, 0.1, 0.08], [0.12, 0.2, 0.4], [0.3, 0.32, 0.12]][j % 9 / 3 | 0] : [0.4, 0.26, 0.14];
          L.solid(px, py, book ? 7 : 12, book ? 5 : 3, col, an + a * (book ? 4 : 7), 4, 2, 1 - SS(0.85, 1.2, a)); }
        for (let j = 0; j < 6; j++) { const q2 = Math.min(1, a / 1.2); L.puff(ex + (j - 2.5) * 16, ey + 40 + 14 * q2, 14 + 18 * q2, [0.36, 0.3, 0.26], 0.45 * (1 - q2), e.t * 11 + j); } }
      if (e.k === 'secret' && (e.kind === 'lever' || e.kind === 'banner') && a < 1.8) { const q2 = Math.min(1, a / 1.8), n = e.kind === 'lever' ? 8 : 3;
        for (let j = 0; j < n; j++) L.puff(ex + (j - (n - 1) / 2) * 12, ey + 22 - 10 * q2, 12 + 20 * q2, [0.4, 0.36, 0.34], (e.kind === 'lever' ? 0.5 : 0.3) * Math.sin(Math.PI * q2), e.t * 11 + j); }
      // a door flung open blows the dust off its threshold
      if (e.k === 'door' && a < 0.9) { const D0 = m.doors[e.i], side = D0 && (D0.dir === 'l' || D0.dir === 'r'), n = e.kick ? 12 : 7;
        for (let j = 0; j < n; j++) { const q = a / 0.9, an = rnd(e.t, j) * 6.28, v = (20 + 40 * rnd(e.t, j + 3)) * (e.kick ? 1.6 : 1), ox = side ? 0 : (rnd(e.t, j + 9) - 0.5) * 60, oy = side ? (rnd(e.t, j + 9) - 0.5) * 60 : 0;
          L.puff(sx(e.x + ox) + Math.cos(an) * v * q, sy(e.y + oy) - 4 + Math.sin(an) * v * q * 0.5 - 10 * q, 6 + 10 * q, [0.45, 0.4, 0.36], 0.35 * (1 - q), e.t + j); } }
      if ((e.k === 'wallhit' || (e.k === 'secret' && (e.kind || 'crack') === 'crack')) && a < 1.4) { const big = e.k === 'secret', n = big ? 22 : 8, life = big ? 1.1 : 0.7;
        for (let j = 0; j < n; j++) { if (a > life) break; const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * (big ? 3 : 2), v = (big ? 90 : 50) + (big ? 160 : 70) * rnd(e.t, j + 7), g = 520;
          const px = ex + (rnd(e.t, j + 3) - 0.5) * (big ? 60 : 24) + Math.cos(an) * v * a * 0.6, py = ey + Math.min(30 + 20 * rnd(e.t, j + 11), -Math.abs(Math.sin(an)) * v * a + g * a * a);
          const sz = (big ? 4 : 3) + 4 * rnd(e.t, j + 13); L.solid(px, py, sz, sz * 0.8, [0.34, 0.3, 0.29], an + a * 6, sz / 2, sz / 2, 1 - SS(life * 0.75, life, a)); }
        for (let j = 0; j < (big ? 10 : 4); j++) { const q = Math.min(1, a / (big ? 1.4 : 0.8)); L.puff(ex + (j - (big ? 4.5 : 1.5)) * (big ? 12 : 10), ey + 10 + 26 * q, (big ? 16 : 10) + 22 * q, [0.4, 0.36, 0.34], (big ? 0.55 : 0.4) * (1 - q), e.t * 11 + j); } }
      // chips knocked off a prop fly from the struck side, bounce off the floor at its foot and fade; dust breathes out of it
      if (e.k === 'prop' && a < 0.9) { const [pw, ph] = e.n === 'fence_mg' ? [24, 30] : SZ(e.n), ix = ex - e.s * pw * 0.3, iy = ey - ph * 0.45, mat = e.mat,
          col = mat === 'wood' ? [0.42, 0.27, 0.15] : mat === 'stone' ? [0.42, 0.4, 0.4] : mat === 'crystal' ? [0.55, 0.75, 1] : e.n === 'shop_gold' ? [1, 0.78, 0.25] : null;
        if (col) for (let j = 0; j < (mat === 'wood' ? 8 : 7); j++) { const an = Math.PI * (e.s > 0 ? 1 : 0) + (rnd(e.t, j) - 0.5) * 1.8, v = 50 + 70 * rnd(e.t, j + 7);
          const px = ix + Math.cos(an) * v * a, py = Math.min(ey + 4 - 6 * rnd(e.t, j + 2), iy + Math.sin(an) * v * a * 0.6 - 110 * a + 420 * a * a), long = mat === 'wood';
          L.solid(px, py, long ? 9 : 5, long ? 3 : 4, col, an + a * 9 * (rnd(e.t, j + 4) - 0.5), long ? 3.5 : 2, 1.5, 1 - SS(0.6, 0.9, a)); }
        if ((col || mat === 'cloth') && a < 0.7) for (let j = 0; j < 3; j++) { const q = a / 0.7; L.puff(ix + (j - 1) * 9 - e.s * 14 * q, iy + 10 * q, 7 + 10 * q, [0.4, 0.36, 0.33], 0.35 * (1 - q), e.t * 7 + j); } }
      // a rock's fall (TASKS 406): a ring of dust and chips of basalt bouncing off; a vent's burst leaves a column of smoke
      if (e.k === 'rockfall' && a < 1) { const q = a / 1; for (let j = 0; j < 8; j++) { const an = j / 8 * 6.283 + rnd(e.t, j); L.puff(ex + Math.cos(an) * (10 + 46 * q), ey + 4 + Math.sin(an) * (6 + 26 * q) - 12 * q, 10 + 16 * q, [0.6, 0.54, 0.48], 0.75 * (1 - q), j); }
        for (let j = 0; j < 6; j++) { const an = rnd(e.t, j + 3) * 6.283, v = 50 + 70 * rnd(e.t, j + 9); if (a > 0.6) break; L.solid(ex + Math.cos(an) * v * a, Math.min(ey + 4, ey - 14 + Math.sin(an) * v * a * 0.6 - 120 * a + 520 * a * a), 4, 3, [0.18, 0.16, 0.17], an + a * 8, 2, 1.5, 1 - SS(0.4, 0.6, a)); } }
      // the hero through the crust (TASKS 476): a splash of lava where he went in, smoke and embers where he climbs out
      if (e.k === 'lavafall' && a < 1.2) { const q = a / 1.2, X2 = sx(e.tx), Y2 = sy(e.ty);
        // (a pool of open lava where he went in, over the crust's net, while he is under: TASKS 1043, he sank into whole stone)
        // (once his head is under: over it, it lay on his face; and gone before he climbs out, TASKS 1058)
        if (a < 0.6) { const k = SS(0.3, 0.42, a) * (1 - SS(0.45, 0.6, a)); L.glow(ex, ey - 2, 34, [1, 0.5, 0.12], 1.1 * k, 1.6); L.ring(ex, ey, 22 + 4 * Math.sin(a * 18), 13, [1, 0.85, 0.35], 1.2 * k, 0.25); }
        for (let j = 0; j < 14; j++) { const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 2.6, v = 90 + 160 * rnd(e.t, j + 3); if (a > 0.8) break;
          L.star(ex + Math.cos(an) * v * a, ey + Math.sin(an) * v * a + 420 * a * a, 5 + 3 * rnd(e.t, j + 5), [1, 0.5 + 0.4 * rnd(e.t, j + 7), 0.1], 1 - a / 0.8); }
        L.ring(ex, ey, 14 + 40 * q, (14 + 40 * q) * 0.6, [1, 0.6, 0.2], 0.9 * (1 - q), 0.1);
        for (let j = 0; j < 4; j++) L.puff(X2 + (j - 1.5) * 9, Y2 - 10 - 40 * q, 7 + 12 * q, [0.4, 0.36, 0.34], 0.5 * (1 - q), e.t * 5 + j); }
      if (e.k === 'erupt' && a < 1.6) for (let j = 0; j < 5; j++) { const q = a / 1.6; L.puff(ex + (j - 2) * 8 + Math.sin(a * 3 + j) * 6, ey - 16 - 70 * q * (0.6 + 0.4 * rnd(e.t, j)), 10 + 14 * q, [0.12, 0.1, 0.1], 0.5 * (1 - q), j); }
      if (e.k === 'scorch' && a < 0.8) for (let j = 0; j < 3; j++) { const q = a / 0.8; L.puff(ex + (j - 1) * 7, ey - 8 - 26 * q, 6 + 8 * q, [0.12, 0.1, 0.1], 0.45 * (1 - q), e.t * 13 + j); }
      if (e.k === 'kill' && a < 0.6 && !e.gone) for (let j = 0; j < 6; j++) { const q = a / 0.6; L.puff(ex + (j - 2.5) * 8, ey - 10 - 20 * q, 8 + 10 * q, e.type === 'ghost' ? [0.5, 0.7, 0.9] : [0.3, 0.27, 0.25], 0.5 * (1 - q), e.t + j); }
      if ((e.k === 'hurt' || e.k === 'die') && a < 0.45) for (let j = 0; j < (e.k === 'die' ? 9 : 5); j++) { const q = a / 0.45, an = rnd(e.t, j + 30) * 6.28, d = 6 + 30 * q, oy = e.k === 'die' ? -40 : 0;
        L.puff(ex + Math.cos(an) * d, ey + oy + Math.sin(an) * d + 50 * q * q, 3 + 2 * rnd(e.t, j), [0.5, 0.04, 0.04], 0.9 * (1 - q), j); }
      if (e.k === 'spike' && a < 0.5) for (let j = 0; j < 4; j++) { const q = a / 0.5; L.puff(ex + (j - 1.5) * 16, ey + 8 - 14 * q, 6 + 10 * q, [0.35, 0.3, 0.27], 0.4 * (1 - q), e.t * 9 + j); }
      if (e.k === 'roar' && a < 1.2) for (let j = 0; j < 10; j++) { const q = a / 1.2, an = j / 10 * 6.28; L.puff(ex + Math.cos(an) * (60 + 140 * q), ey + 70 + Math.sin(an) * (30 + 70 * q), 12 + 16 * q, [0.3, 0.25, 0.22], 0.4 * (1 - q), e.t + j); }
    }
    for (const e of R.en) if (e.deadT < 0 && e.shield > 0 && GT < e.shieldUntil && vis(e.x, e.y) && known(e.x, e.y)) { G.blend('add'); const f = 0.3 + 0.08 * Math.sin(t * 6), x = sx(e.x), y = sy(e.y) - 56; L.ring(x, y, 58, 65, [0.35, 0.9, 0.6], f, 0.2); L.glow(x, y, 65, [0.2, 0.7, 0.4], 0.2); G.blend(); }
    // the hero's magic shield bubble
    if (h.shield > 0 && GT < h.shieldUntil) { G.blend('add'); const f = 0.35 + 0.1 * Math.sin(t * 6); L.ring(sx(h.x), sy(h.y) - 32, 36, 44, [0.45, 0.75, 1], f, 0.25); L.glow(sx(h.x), sy(h.y) - 32, 44, [0.3, 0.55, 1], 0.25); G.blend(); }

    // ===== bloom + grade (on the lit target) =====
    const scr = screenFx(ST, R, h, st, GT);
    const comp = L.T.comp; L.T.comp = SCX.LT.lit; L.finish(t, Object.assign({ bloom: [0.18, 0.14], vignette: 0.85, warm: 0.2, roll: 1, dither: 1 }, scr)); L.T.comp = comp;
    if (window.HUD) HUD.draw(ST, t, { cx, cy, sx: (x) => (x - cx) * SCX.Z, sy: (y) => (y - cy) * SCX.Z, k: SCX.Z, st });
  };

  // full-screen responses: pain tints the rim red by the share of health lost, a low health throbs, a roar flashes it,
  // a scroll flashes it pale blue; death greys and darkens the frame before the end screen; a new floor fades in from black
  function screenFx(ST, R, h, st, GT) {
    let r = 0, g = 0, b = 0, w = 0, dark = 0, desat = 0;
    const add = (col, amt) => { if (amt <= 0) return; r += col[0] * amt; g += col[1] * amt; b += col[2] * amt; w += amt; };
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      if (e.k === 'hurt' && a < 0.5) add([0.55, 0.02, 0.02], (0.25 + 0.4 * Math.min(1, 4 * e.n / st.maxHp)) * (1 - SS(0.05, 0.5, a)));
      if (e.k === 'roar' && a < 0.8) add(R.map.biome === 'cave' ? [0.15, 0.35, 0.45] : [0.6, 0.12, 0.02], 0.45 * (1 - SS(0.1, 0.8, a)));
      if (e.k === 'teleport' && a < 0.5) add([0.6, 0.8, 1], 0.3 * (1 - SS(0, 0.5, a)));
      if (e.k === 'floor' && a < 0.9) dark = Math.max(dark, 1 - SS(0, 0.9, a)); }
    const f = h.hp / st.maxHp; if (h.deadT < 0 && f < 0.3) add([0.45, 0.02, 0.02], (1 - f / 0.3) * (0.22 + 0.12 * Math.sin(GT * 6.5)));
    if (h.deadT >= 0) { const du = GT - h.deadT; desat = 0.85 * SS(0, 1.2, du); dark = Math.max(dark, 0.55 * SS(0.6, 1.6, du)); add([0.4, 0.02, 0.02], 0.5 * (1 - SS(0.4, 1.4, du))); }
    return { edge: w > 0 ? [r / w, g / w, b / w, Math.min(0.7, w)] : [0, 0, 0, 0], desat, dark };
  }

  function drawDrop(p, x, y, GT, t) {
    if (p.qaHide) return;   // tools/lootvis.mjs: the frame without the item's sprite, its light kept
    const z = p.z || 0, bob = p.z > 0 ? 0 : 2 * Math.sin(t * 3 + p.id);
    L.shadow(x, y + 2, 10, 4, 0.4);
    if (p.kind === 'gold') { const k = Math.min(1, 0.5 + p.n / 40), [w, hh] = SZ('it_gold'), coin = (a) => L.sprite('it_gold', x - w * 0.3 * k, y - z - hh * 0.6 * k, { w: w * 0.6 * k, h: hh * 0.6 * k, u: a ? { alpha: a, tint: GOLD_TINT } : {} });
      coin(); emitted(coin); return; }
    if (p.kind === 'key') { G.blend('add'); L.glow(x, y - z - 14 - bob, 30, [1, 0.8, 0.4], 0.7); G.blend(); const [w, hh] = SZ('it_key'); L.sprite('it_key', x - w * 0.3, y - z - hh * 0.6 - 4 - bob, { w: w * 0.6, h: hh * 0.6 }); return; }
    if (p.kind === 'shard') { G.blend('add'); L.glow(x, y - z - 14 - bob, 24, [0.4, 0.7, 1], 0.8); G.blend(); const [w, hh] = SZ('crystal'); L.sprite('crystal', x - w * 0.15, y - z - hh * 0.3 - bob, { w: w * 0.3, h: hh * 0.3 }); return; }
    // a quest's keepsake (TASKS 1020): its own icon in a warm gold light and a beam, so it reads as nobody's loot
    if (p.kind === 'qitem') { const ic = p.ic || 'qi_casket', [w, hh] = SZ(ic), k = 0.7, col = [1, 0.93, 0.7]; L.shadow(x, y + 2, 16, 6, 0.6); G.blend('add'); L.glow(x, y - z - 16 - bob, 34, col, 0.5); L.solid(x - 3, y - z - 120, 6, 108, col, 0, 0, 0, 0.22 + 0.06 * Math.sin(t * 4)); G.blend();
      L.sprite(ic, x - w * k / 2, y - z - hh * k - 4 - bob, { w: w * k, h: hh * k }); return; }
    const it = p.item, ic = SIM.itemIcon(it), [w, hh] = SZ(ic), k = 0.62, col = D.RARITY[it.rar].col;
    if (it.rar >= 1) { G.blend('add'); L.glow(x, y - z - 14 - bob, 30, col, 0.55); if (it.rar >= 3) L.solid(x - 3, y - z - 110, 6, 100, col, 0, 0, 0, 0.18 + 0.05 * Math.sin(t * 4)); G.blend(); }
    // (on the magma's islets and banks the lava's glow and bloom wash over a dark common item, TASKS 490: it gets a pale glow of its
    // own and a dark ink rim there)
    const draw = () => L.sprite(ic, x - w * k / 2, y - z - hh * k - 4 - bob, { w: w * k, h: hh * k });
    if (SC.state && SC.state.run && SC.state.run.map.cliff) { if (it.rar < 1) { G.blend('add'); L.glow(x, y - z - 14 - bob, 26, [1, 0.92, 0.75], 0.4); G.blend(); } L.inked(draw, { r: 2, n: 8, col: [0.02, 0.015, 0.015], dy: 0 }); } else draw();
  }
})();
