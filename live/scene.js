// live/scene.js — the dungeon, drawn. Pure function of t and the sim state.
// Pipeline per frame: baked floor map (floor, wall faces, wall tops, rims, AO; rebaked per floor) → ground decals (stairs, spikes,
// stains, cracks) → Y-sorted band (props, monsters, the rigged hero, loot) → unlit composite; then a light map (ambient per
// biome + flickering torches, braziers, lava, spells, the hero's aura) multiplied in with the fog of war (explored cells) →
// emissive pass (flames, lava, fireballs, slashes, sparks) → bloom + grade → HUD (hud.js).
(function () {
  const SCX = window.SCX, {
    BRIDGE, CANDLE, D, DEPTH_K, GLOW_COL, GOLD_TINT, HERO, L, PIX, RIM, SC, SS, STAND, SZ, TILE, bake, emitted, glowBeat, glowOf,
    swimTex, rnd, seenTex, spellFloor, torchCol, views, whirlP } = SCX;
  // ---------------- render ----------------
  SC.render = (t) => {
    const ST = SC.state || SIM.Q.at(t), GT = ST.t, R = ST.run;
    if (R && (R.zoom || D.ZOOM || 1) !== SCX.Z) views(R.zoom || D.ZOOM || 1);
    if (!R) { L.beginBG([0.02, 0.015, 0.02, 1]); L.beginComp(); L.finish(t, { bloom: [0, 0] }); if (window.HUD) HUD.draw(ST, t, null); return; }
    const m = R.map, B = D.BIOMES[m.biome], h = R.hero, _rim = (RIM.col = B.torch.map((v) => Math.min(1, v * 1.2)), RIM.hands = {}, RIM.heads = {}, RIM.mages = {}, RIM.embers = {}, RIM.priests = {}, RIM.kindled = {}, RIM.imps = {}, RIM.salams = {}, RIM.folk = []), st = SIM.Q.stats(h, ST.meta);
    // a fuse's ring and light stay on its body: a lit smouldering skeleton knocked back carries them with it (TASKS 411)
    const fuseAt = (q) => { const o = R.en.find((b) => b.id === q.id); return o ? [o.x, o.y] : [q.x, q.y]; };
    bake(m); const seen = seenTex(R);
    const tr = R.trauma * R.trauma, shx = 16 * tr * (L.rnd(Math.floor(GT * 30), 1) - 0.5) * 2, shy = 12 * tr * (L.rnd(Math.floor(GT * 30), 2) - 0.5) * 2;
    const cx = Math.round((R.cam[0] + shx) / PIX) * PIX, cy = Math.round((R.cam[1] + shy) / PIX) * PIX, sx = (x) => x - cx, sy = (y) => y - cy;
    SCX.LAVA_CLIP = m.cliff ? { clipm: swimTex(m), clipb: [-cx, -cy, m.W * TILE, m.H * TILE] } : null;   // (drawEnemy's sunk salamander, TASKS 460)
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
    const hid = (o) => SIM.Q.hidden(m, o);
    const flick = (i) => 0.85 + 0.1 * Math.sin(t * 9.1 + i * 3.7) + 0.06 * Math.sin(t * 23.3 + i * 1.3);
    // a green fire reaches less far: the crypt is lit in pools, not flooded (TASKS 169); so does a cold hearth on the floor, its
    // near light in its own colour, or a zone's four to six of them wash its floor pale (TASKS 188)
    const TL = []; m.torches.forEach((tc, i) => { if (hid(tc)) return; const col = torchCol(m, tc), f = flick(i) * (col[2] > col[0] ? 1.35 : 1) * (B.fireK || 1), big = tc.kind === 'fire', gr = col[1] > col[0] && col[1] > col[2] ? 0.7 : 1;
      const pool = col[0] < 0.5 && tc.kind === 'brazier', pr = (pool ? 0.6 : 1) * (tc.kind === 'brazier' ? 0.8 : 1), pa = (pool ? 0.6 : 1) * ((B.cave || B.town) && tc.kind === 'wall' ? 0.55 : 1);   // a brazier's pool is a fifth smaller: its light fell off too gently (TASKS 193)
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
    for (const c of R.chests) if (c.tier >= 3 && !c.open && !hid(c)) TL.push([c.x, c.y - 14, 130, [1, 0.72, 0.35], 0.55 + 0.15 * Math.sin(t * 2.4)]);
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
      for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) if (SIM.Q.cell(m, cx0 + i, cy0 + j) === 3) d = Math.min(d, Math.hypot(i, j)); return d; };
    HERO.lavaNear = (px, py) => SS(5.5, 2, lavaD(px, py));   // (as far as the lava's own light reaches, 170 px)
    // (the take-back is held to 0.75–1.3 a channel: up to 1.8 under the crypt's green torch it pushed red ~1.7× and every warm paint went
    // flat orange, the archer's ochre whole, TASKS 1124 critic)
    HERO.fireTint = (px, py, own = [1, 1, 1]) => { const lt = HERO.lightAt(px, py); if (!lt) return own; const c = lt.all, g = 0.3 * c[0] + 0.5 * c[1] + 0.2 * c[2], wl = HERO.lavaNear(px, py);
      const t = c.map((v, i) => { const q = own[i] * Math.max(0.75, Math.min(1.3, (g + 0.5 * (v - g)) / Math.max(0.02, g + 1.6 * (v - g)))); return q + (own[i] - q) * wl; });
      return t; };
    HERO.k = HERO.kAt(h.x, h.y); HERO.lift = 0.85 + 0.1 * HERO.k;
    const F = {
      B, GL, GT, MH, MW, R, ST, TL, blastFx, cx, cy, fireFx, flick, fuseAt, h, hid, known, m, seen, spell, st, sx, sy, t, vis, weaponCol,
      whirlFx };
    SCX.worldPass(F);
    SCX.lightPass(F);
    SCX.fxPass(F);
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
    if (R.leaving > 0) dark = Math.max(dark, 1 - R.leaving / 0.45);
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
    if (p.kind === 'note') { const [w, hh] = SZ('note_scrap'); L.shadow(x, y + 2, w * 0.5, 5, 0.45); G.blend('add'); L.glow(x, y - z - 8, 22, [1, 0.9, 0.65], 0.3); G.blend(); L.sprite('note_scrap', x - w / 2, y - z - hh + 2, { w, h: hh }); return; }
    // a quest's keepsake (TASKS 1020): its own icon in a warm gold light and a beam, so it reads as nobody's loot
    if (p.kind === 'qitem') { const ic = p.ic || 'qi_casket', [w, hh] = SZ(ic), k = 0.7, col = [1, 0.93, 0.7]; L.shadow(x, y + 2, 16, 6, 0.6); G.blend('add'); L.glow(x, y - z - 16 - bob, 34, col, 0.5); L.solid(x - 3, y - z - 120, 6, 108, col, 0, 0, 0, 0.22 + 0.06 * Math.sin(t * 4)); G.blend();
      L.sprite(ic, x - w * k / 2, y - z - hh * k - 4 - bob, { w: w * k, h: hh * k }); return; }
    const it = p.item, ic = SIM.Q.itemIcon(it), [w, hh] = SZ(ic), k = 0.62, col = D.RARITY[it.rar].col;
    if (it.rar >= 1) { G.blend('add'); L.glow(x, y - z - 14 - bob, 30, col, 0.55); if (it.rar >= 3) L.solid(x - 3, y - z - 110, 6, 100, col, 0, 0, 0, 0.18 + 0.05 * Math.sin(t * 4)); G.blend(); }
    // (on the magma's islets and banks the lava's glow and bloom wash over a dark common item, TASKS 490: it gets a pale glow of its
    // own and a dark ink rim there)
    const draw = () => L.sprite(ic, x - w * k / 2, y - z - hh * k - 4 - bob, { w: w * k, h: hh * k });
    if (SC.state && SC.state.run && SC.state.run.map.cliff) { if (it.rar < 1) { G.blend('add'); L.glow(x, y - z - 14 - bob, 26, [1, 0.92, 0.75], 0.4); G.blend(); } L.inked(draw, { r: 2, n: 8, col: [0.02, 0.015, 0.015], dy: 0 }); } else draw();
  }
  Object.assign(SCX, { drawDrop });
})();
