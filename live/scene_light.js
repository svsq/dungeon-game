// live/scene_light.js — the light pass of a frame: the light map (biome ambient, torches, lava, spells) and the lit composite with the fog of war.
// A pass of SC.render (ARCHITECTURE.md §4.3): it reads the frame's shared values from F and leaves there what later passes use.
(function () {
  const SCX = window.SCX, {
    BAKE, D, DECK, EN_TEX, GLOW_COL, HERO, L, OCC_SOLIDS, PILLAR_T, PROP_BAS, RIM, SC, SS, SZ, TILE, TOWN_LIGHT, drawHero, lavaGlowTex,
    lavaNearTex, modCol, sinkOf, submerged, swimOf, topTex, veinTex, voidTex, waterTex } = SCX;
  SCX.lightPass = (F) => {
    const {
      B, GL, GT, MH, MW, R, ST, TL, basaltOcc, cx, cy, flick, fuseAt, h, hid, known, lavaBeat, lavaCells, lavaSrc, m, seen, st, sx, sy, t,
      vis, warnOf, weaponCol } = F;
    // ===== light map =====
    const ab = 0.5 / Math.max(...B.amb), AMB = [0.34, 0.40, 0.58], ak = B.ambK || 0.3, amb = AMB.map((v, i) => ((1 - ak) * v + ak * B.amb[i] * ab) * (B.ambLvl || 1)); G.bind(SCX.LT.light, [...amb, 1]); G.blend('add');
    const lt = (x, y, r, col, amt, k = 2.2) => { if (x < cx - r || x > cx + SCX.VW + r || y < cy - r || y > cy + SCX.VH + r) return; G.draw(L.P.glow, { u_col: col, u_k: k, u_amt: amt }, G.xf(sx(x) - r, sy(y) - r * 0.8, 2 * r, 1.6 * r)); };
    // the hero is the frame's focus: a wide fill plus a tight warm key on the body that barely reaches the floor around him.
    // Away from fire the fill is the player's lamp: 3–4 cells of floor, traps and foes must read in a dark corridor (TASKS 170)
    if (B.cave && !m.cliff) lt(h.x, h.y - 45, 75, [0.35, 0.6, 0.85], 0.18);
    // (a floor without light, TASKS 381, has the lamp reach `light` times as far)
    const lk = (D.FLOOR_MODS[m.mod] || {}).light || 1;
    lt(h.x, h.y - 30, 250 * lk, [0.8, 0.72, 0.6], 0.1 + 0.9 * (1 - HERO.k) ** 2); lt(h.x, h.y - 44, 95 * lk, [1, 0.88, 0.7], 0.85 * (1 - 0.8 * HERO.k), 2.4);
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
    if (SIM.Q.exitKind(R, m.floor) === 'portal' && R.bossDead) lt(m.exit.x, m.exit.y - 20, 320, [0.5, 0.7, 1.0], 1.4);
    // the town's end of an open portal (TASKS 1007) and a scroll being read: the same cold blue as the way out
    if (!m.town && R.arena && R.arena.gate && R.seen[Math.floor(R.arena.gate.y / TILE) * m.W + Math.floor(R.arena.gate.x / TILE)]) lt(R.arena.gate.x, R.arena.gate.y - 20, 260, [0.5, 0.7, 1.0], 1.3);
    const TP = R.town && R.portal && m.town ? m.town.svc.portal : null; if (TP) lt(TP.x, TP.y - 20, 260, [0.5, 0.7, 1.0], 1.3);
    // a waystone: a faint pool asleep, a breathing cold one awake; the town's ring answers once any waystone of the run is awake
    if (m.way) { const on = (R.ways || []).includes(m.floor); lt(m.way.x, m.way.y + 6, on ? 150 : 90, [0.55, 0.65, 1], on ? 0.45 + 0.08 * Math.sin(t * 1.7) : 0.2); }
    if (R.town && m.town && !TP && (R.ways || []).length) lt(m.town.svc.portal.x, m.town.svc.portal.y - 20, 200, [0.5, 0.65, 1], 0.55 + 0.1 * Math.sin(t * 1.3));
    if (h.read) lt(h.x, h.y - 30, 200, [0.55, 0.75, 1], 1.2 * SS(0, 1.6, GT - h.read.t0));
    for (const p of R.proj) if (p.k !== 'arrow') lt(p.x, p.y + 20, p.own === 'hero' ? (p.k === 'bolt' ? 120 : 140) : p.k === 'jet' || p.k === 'wave' ? 90 : p.k === 'orb' ? 120 : 150, p.k === 'orb' ? [0.35, 0.85, 0.95] : p.k === 'bolt' ? [0.55, 0.6, 1] : p.k === 'hex' ? [0.4, 1.0, 0.4] : p.k === 'jet' || p.k === 'wave' ? [0.5, 0.85, 1] : [1.0, 0.55, 0.2], p.own === 'hero' ? (p.k === 'bolt' ? 1.1 : 0.65) : p.k === 'jet' ? 0.35 : 1.2);
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
      if (e.k === 'cry' && a < 0.4) lt(e.x, e.y - 30, e.r, [1, 0.4, 0.15], 0.8 * (1 - a / 0.4));
      if (e.k === 'chargehit' && a < 0.25) lt(e.x, e.y - 30, 160, [1, 0.6, 0.25], 0.9 * (1 - a / 0.25));
      if (e.k === 'frost' && a < 0.5) lt(e.x + Math.cos(e.a) * e.r * 0.5, e.y + Math.sin(e.a) * e.r * 0.4, e.r * 1.4, [0.55, 0.85, 1], 0.7 * (1 - a / 0.5));
      if (e.k === 'whirl' && a < 0.25) lt(e.x, e.y - 20, 190, weaponCol(e.rar || 0), 0.6 * (1 - a / 0.25));
      if (e.k === 'lvl' && a < 1.5) lt(e.x, e.y - 30, 300, [1, 0.85, 0.4], 1.5 * (1 - a / 1.5));
      if (e.k === 'swing' && !e.shot && a < 0.22) lt(h.x + Math.cos(e.a) * 30, h.y - 30 + Math.sin(e.a) * 20, 150, [1, 0.9, 0.75], 0.7 * (1 - a / 0.22));
      if (e.k === 'pop' && e.c !== 'jet' && e.c !== 'arrow' && a < 0.3) lt(e.x, e.y + 20, e.hero ? 200 : 120, e.c === 'hex' ? [0.4, 1, 0.4] : e.c === 'bolt' ? [0.55, 0.6, 1] : e.c === 'orb' ? [0.35, 0.85, 0.95] : [1, 0.55, 0.2], (e.hero ? 1.4 : 0.8) * (1 - a / 0.3));
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
    for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'secret' && a >= 0 && a < 1.2) lt(e.x, e.y, 340, [0.7, 0.8, 1], 0.7 * (1 - a / 1.2)); }
    for (const e of R.en) if (e.elite && e.type !== 'boss' && e.deadT < 0 && e.st !== 'lurk' && !D.under(e)) lt(e.x, e.y + 4, 110, modCol(e), 0.3 + 0.1 * Math.sin(t * 3 + e.id));
    // an explosive corpse's fuse: its light swells and beats faster until the burst
    for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'fuse' && a >= 0 && a < e.d) { const q = a / e.d, [fx, fy] = fuseAt(e); lt(fx, fy, e.r * 1.6, [1, 0.8, 0.35], (0.3 + 0.9 * q) * (0.6 + 0.4 * Math.sin(a * (8 + 30 * q)))); } }
    G.blend();
    // ===== lit composite (fog of war: unexplored cells stay black) =====
    // whoever stands before the lava keeps its glow and its shimmer off them (TASKS 407): the monsters' silhouettes in a mask both
    // leave out. Without it a demon by a river came out see-through, the lava's plates showing through its body
    G.bind(SCX.LT.occ, [0, 0, 0, 0]); G.blend();
    // (the fire depths' lava too, TASKS 510: their actors go in black, alpha only, as the lit pass's colour channels are the magma's)
    if (m.cliff || m.lava) { const J0 = L.joint; L.joint = () => {}; const SP0 = L.sp = { dx: 0, dy: 0, a: 1, lod: 0, ink: [0, 0, 0] }, ink = (c) => (m.cliff ? c : [0, 0, 0]);
      try { if (m.cliff) { for (const [n, x, y, w, hh, f] of basaltOcc.concat(PROP_BAS)) L.sprite(n, x, y, { w, h: hh, flip: f }); for (const [x, y, w, hh] of OCC_SOLIDS) L.solid(x, y, w, hh, [0, 0, 0]); }
        L.sp.ink = ink([1, 1, 1]);
        for (const e of R.en) { if (e.deadT >= 0 || !vis(e.x, e.y) || !MONSTERS.rigOf(e.type) || (D.under(e) && !(D.ENEMIES[e.type].lake && e.st === 'emerge')) || e.sinkT !== undefined || e.fallT !== undefined) continue;
          const E = D.ENEMIES[e.type], [, h0] = SZ(window.SIZES['en_' + e.type] ? 'en_' + e.type : EN_TEX[e.type]), k = D.BOSSES[e.type] ? (D.BOSSES[e.type].scale || 1.6) : e.elite ? 1.3 : 1;
          const sub = E.lake ? submerged(e, E, GT) : 0, sw0 = swimOf(e, GT), U = Object.assign(sub > 0 ? { cut: [sy(e.y) + 3, 5, 1] } : {}, sw0 > 0 && e.type === 'salamander' && SCX.LAVA_CLIP ? SCX.swimClip(sw0) : {});   // (clipped as its body is, TASKS 1156: unclipped here it bleached the bank in a grey veil)
          L.sp = SP0; SP0.ink = ink([1, HERO.lavaNear(e.x, e.y), 1]);   // (green: how near the lava it stands, by its feet: TASKS 1035; a rig's own draw may clear L.sp)
          MONSTERS.draw(e, E, sx(e.x), sy(e.y) + sub * h0 * k * 1.02, GT, { id: 'occ', H: h0 * k, face: e.face, lean: 0, fallR: 0, U, Ufar: U, t, swim: swimOf(e, GT) }); }
        // (the hero too: before the lava he took its whole glow and came out one orange figure, TASKS 450)
        L.sp = SP0; SP0.ink = ink([1, HERO.lavaNear(h.x, h.y), 0]);   // (blue: a monster, not the hero, TASKS 1055)
        // (not while he is under the lava: his raised blade left a pale patch over it in the mask, TASKS 1058)
        if (!SC.hide.hero && h.deadT < 0 && h.fallT === undefined && !h.sunk && vis(h.x, h.y)) drawHero(h, sx(h.x), sy(h.y) + DECK.dy + sinkOf(h, GT, sy(h.y)).dy, GT, st, { id: 'occ', cut: sinkOf(h, GT, sy(h.y)).cut, armsUp: sinkOf(h, GT, sy(h.y)).arms }); }
      finally { L.sp = null; L.joint = J0; } }
    G.bind(SCX.LT.lit); G.blend('none'); G.full(L.P.lit, { u_src: L.T.comp, u_light: SCX.LT.light, u_occ: SCX.LT.occ, u_seen: seen, u_void: voidTex(m), u_top: topTex(m), u_veins: veinTex(m), u_water: waterTex(m), u_heat: m.cliff ? lavaGlowTex(m) : waterTex(m), u_haze: m.cliff ? 1 : 0, u_face: m.cliff && BAKE.face ? BAKE.face : seen, u_far: m.cliff ? lavaNearTex(m) : seen, u_amb: amb, u_seam: B.seam || 0, u_cave: B.cave ? 1 : 0, u_low: B.low || [0.86, 0.82, 0.78], u_cam: [cx, cy], u_map: [MW, MH], u_t: t, u_rock: B.rock, u_vein: B.vein }); G.blend();

    for (const q of m.lavaFeatures || []) { const got = lavaSrc(q); if (got && known(q.x, q.y)) G.draw(L.P.magmasrc, Object.assign(got.U, { u_mode: 2 }), got.xf); }
    Object.assign(F, {
      altarCol });
  };
})();
