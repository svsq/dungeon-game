// live/scene_fx.js — the emissive pass of a frame: flames, lava, fireballs, slashes, sparks, shields drawn over the lit world.
// A pass of SC.render (ARCHITECTURE.md §4.3): it reads the frame's shared values from F and leaves there what later passes use.
(function () {
  const SCX = window.SCX, {
    ARC_HALF, ARC_MID, BAKE, BLOOD, D, DRIP_FALL, EN_TEX, GLOW_COL, HERO_H, L, PILLAR_T, PIX, RIM, SC, SS, STAND, SWING, SZ, TAU, TILE,
    TOWN_LIGHT, breathFx, crustTex, dripAge, flameAt, glowBeat, glowOf, impSpark, modCol, rnd, surgeBox, surgeTex, swimFx, swimOf,
    swingPose, torchCol } = SCX;
  SCX.fxPass = (F) => {
    const {
      B, GT, MH, MW, R, ST, altarCol, cx, cy, flick, fuseAt, h, hid, inSecret, known, lavaCells, lavaP, lavaU, lavaXf, m, melt, seen,
      spell, st, sx, sy, t, vis, warnOf } = F;
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
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (SIM.Q.cell(m, cx0 + i, cy0 + j) !== 3) bank = Math.min(bank, Math.max(0, Math.hypot(Math.max(0, Math.abs((cx0 + i + 0.5) * TILE - e.x) - 16), Math.max(0, Math.abs((cy0 + j + 0.5) * TILE - e.y) - 16))));
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
    // a sanctum's circle whose priests are dead (TASKS 1054) rings its rim in the blessing's own blue (TASKS 1168: lava, vents and braziers burn every warm hue): step in for its blessing
    for (const q of m.circles || []) if (q.bless && !q.used && vis(q.x, q.y) && known(q.x, q.y) && !R.en.some((e) => e.deadT < 0 && e.room === q.r)) for (let j = 0; j < 56; j++) { if (j % 7 === 6) continue; const an = j * 2 * Math.PI / 56 + t * 0.2; L.solid(Math.round((sx(q.x) + Math.cos(an) * 1.85 * TILE) / 2) * 2 - 2, Math.round((sy(q.y) + Math.sin(an) * 1.85 * TILE) / 2) * 2 - 2, 4, 4, [0.72, 0.87, 1], 0, 2, 2, 0.8 + 0.2 * Math.sin(t * 3 + j / 7)); }
    // (TASKS 1161: on the islet's dark crust the rock's shadow has nothing to darken, contrast 7 against the floor's 23)
    for (const z of m.hazards || []) { if (z.k !== 'fall' || !z.islet || !vis(z.x, z.y) || !known(z.x, z.y)) continue; const H = D.HAZ.fall, w = D.hazClock(z, GT) - (z.per - H.warn); if (w < 0) continue; const q = w / H.warn, k = 0.3 + 0.7 * q; for (let j = 0; j < 12; j++) { const an = j * Math.PI / 6; L.glow(sx(z.x) + Math.cos(an) * H.r * k, sy(z.y) + 2 + Math.sin(an) * H.r * H.ry * k, 8, [1, 0.72, 0.3], 0.35 + 0.5 * q); } }
    for (const c of SC.crackFx || []) { if (!known(c.wx, c.wy)) continue; const k = Math.min(1, (c.w - 0.55 * c.d) / 0.45); if (k <= 0) continue;
      const hot = [1, 0.95, 0.6], A = 0.4 + 0.6 * c.w, H = Math.max(2, Math.round(5 * k) * 2), piece = (x, y, w, h) => L.solid(c.X + x, c.Y + y, w, h, hot, c.rot, -x, -y, A);
      let x = ((c.s & 3) - 2) * 2;
      for (let y = -H / 2, i = 0; y < H / 2; i++) { const l = Math.min(H / 2 - y, (c.s >> i) & 1 ? 4 : 2); piece(x, y, 2, l); y += l; x += (c.s >> (i + 3)) & 1 ? 2 : -2; if (Math.abs(x) > 6) x = 0; }
      if (k > 0.6) piece(((c.s & 3) - 2) * 2 + (c.f ? 2 : -4), (c.s & 4) ? -2 : 0, 4, 2);
      L.glow(c.X, c.Y, 12, [1, 0.8, 0.4], 0.27 * c.w, 2.4); } SC.crackFx = [];
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
    if (SIM.Q.exitKind(R, m.floor) === 'portal' && R.bossDead) G.draw(L.P.portal, { u_t: t, u_amt: 1 }, G.xf(sx(m.exit.x) - 46, sy(m.exit.y) - 80, 92, 92));
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
      else if (e.mv === 'wave') { const L = SIM.Q.flightReach(m, e.x, e.y - 38, e.aimA, Mv.speed, Mv.reach / Mv.speed, 28); tele(x, sy(e.y - 38 + 28), 1, Mv.reach, { u_hw: 34, u_len: [L, 0, 0, 0], u_len4: 0 }); }
      else { const [mx, my] = SIM.Q.serpentMouth(e), L = []; for (let i = 0; i < Mv.n; i++) L.push(SIM.Q.flightReach(m, mx, my, e.aimA + (i / (Mv.n - 1) - 0.5) * Mv.spread * 2, Mv.speed, Mv.reach / Mv.speed, 82));
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
          for (let l = 0; l <= Mv.len; l += 18) { const px = p.x + c * l, py = p.y + sn * l, cl = SIM.Q.cell(m, Math.floor(px / TILE), Math.floor(py / TILE)); if (cl !== 1 && cl !== 3) break; const fl = 0.7 + 0.3 * Math.sin(GT * 30 + l * 0.2);
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
    // the brink (TASKS 476): a monster the hero could drive off an edge (SIM.Q.brinkOf) has a ring at its feet beating slowly and the
    // edge by it lit, while the hero is near enough to make it a move
    if (m.cliff) for (const e of R.en) { if (Math.hypot(e.x - R.hero.x, e.y - R.hero.y) > 420 || !known(e.x, e.y)) continue; const b = SIM.Q.brinkOf(m, e); if (!b) continue;
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
    for (const z of m.hazards || []) { if (z.k !== 'surge') continue; const H = D.HAZ.surge, q = D.surgeLevel(z, GT), w = D.hazClock(z, GT) - (z.per - H.warn); if (q <= 0 || !z.cells.some((c) => R.seen[c])) continue;
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
  };
})();
