// live/hud.js — every screen-space UI: the in-game HUD (portrait, HP/MP/XP, skill bar, stats, minimap, toasts, prompts,
// enemy bars, damage numbers), the hero screen (gear, bag, stats, skills, tooltips), menus, pause, death/victory, the altar of
// souls. Drawn after the grade at full resolution. Panels are sized to their content and registered for qa.mjs (L.uiBox).
(function () {
  const HUD = (window.HUD = {}), L = LIB, D = DATA, W = SIM.VIEW.W, H = SIM.VIEW.H, TILE = D.TILE;
  const SZ = (n) => window.SIZES[n] || [G.tex(n).w, G.tex(n).h];
  const C = { panel0: [0.10, 0.085, 0.10], panel1: [0.055, 0.048, 0.06], rim: [0.42, 0.34, 0.27], rimHi: [0.62, 0.5, 0.36], gold: '#ffd76a', text: '#efe3cc', dim: '#a89a88', red: '#ff6a5a' };
  const MAP = { key: '', rec: null, cv: null, k: 2 };
  HUD.init = () => {};
  const hex = (c) => '#' + c.map((v) => Math.round(Math.min(1, v) * 255).toString(16).padStart(2, '0')).join('');
  const lab = (id, s, x, y, o = {}) => L.label(id, String(s), x, y, Object.assign({ size: 26, col: C.text, out: '#140c0c' }, o));
  const lw = (id, s, o = {}) => L.labelW(id, String(s), Object.assign({ size: 26 }, o));
  function panel(id, x, y, w, h, o = {}) {
    L.rrect(x - 3, y - 3, w + 6, h + 6, (o.r || 8) + 3, o.rim || C.rim, o.rim2 || [0.2, 0.16, 0.13], o.a ?? 0.95);
    L.rrect(x, y, w, h, o.r || 8, o.c0 || C.panel0, o.c1 || C.panel1, o.a ?? 0.94);
    L.uiBox(id, x, y, w, h, o.pad === undefined ? 4 : o.pad);
  }
  function bar(id, x, y, w, h, f, c0, c1, label) {
    panel(id, x, y, w, h, { r: 6, c0: [0.06, 0.05, 0.06], c1: [0.03, 0.03, 0.04] });
    const fw = Math.max(0, Math.min(1, f)) * (w - 6); if (fw > 1) { L.rrect(x + 3, y + 3, fw, h - 6, 4, c0, c1); L.rrect(x + 3, y + 3, fw, (h - 6) * 0.35, 4, [1, 1, 1], [1, 1, 1], 0.12); }
    if (label) lab(id + '_t', label, x + w / 2, y + h / 2 + 1, { size: Math.round(h * 0.62), al: 0.5 });
  }
  const icon = (n, x, y, s, u) => { const [w, h] = SZ(n), k = s / Math.max(w, h); L.sprite(n, x + (s - w * k) / 2, y + (s - h * k) / 2, { w: w * k, h: h * k, u }); };
  function button(id, b, hover) {
    const on = b.on !== false, hv = hover === b.id && on;
    panel(id, b.x, b.y, b.w, b.h, { c0: hv ? [0.24, 0.16, 0.1] : [0.13, 0.1, 0.11], c1: hv ? [0.13, 0.08, 0.06] : [0.06, 0.05, 0.06], rim: hv ? C.rimHi : C.rim });
    lab(id + '_l', b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, { size: 30, al: 0.5, col: on ? (hv ? '#fff2c8' : C.text) : '#6d6258' });
  }
  const dim = (a = 0.62) => L.solid(0, 0, W, H, [0, 0, 0], 0, 0, 0, a);
  const fmtT = (s) => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  HUD.draw = (S, t, V) => {
    G.bind(null); G.blend();
    const R = S.run;
    if (S.demo) { title(S, t); return; }
    if (R && V) world(S, R, t, V);
    if (R && (S.screen === 'play' || S.screen === 'pause')) hud(S, R, t);
    if (R && V && S.screen === 'play') souls(S, R, V);
    if (S.screen === 'menu') menu(S, t);
    if (S.screen === 'meta') meta(S, t);
    if (R && S.debug && S.screen === 'play' && !S.demo) { if (S.dbgLoot && V) lootMarks(R, t, V); for (const b of D.UI.debug(R, S)) button('dbg_' + b.id, b, S.hover); lab('dbg_tag', 'Отладка · `', W / 2, 92, { size: 20, al: 0.5, col: C.text }); if (S.dbgLoot) lootBooks(R); }
    if (S.screen === 'pause') { dim(0.55); lab('p_title', 'Пауза', W / 2, 340, { size: 64, al: 0.5, col: C.gold }); for (const b of D.UI.pause()) button('pb_' + b.id, b, S.hover); }
    if (S.screen === 'inv' && R) inv(S, R, t);
    if (S.screen === 'shop' && R) shop(S, R, t);
    if (S.screen === 'altar' && R) altar(S, R, t);
    if (S.screen === 'dead' || S.screen === 'win') end(S, t);
  };

  // ---------------- attract title over the demo ----------------
  function title(S, t) {
    L.solid(0, 0, W, 200, [0, 0, 0], 0, 0, 0, 0.35);
    lab('tt', 'ГЛУБИНЫ КРИПТЫ', W / 2, 92, { size: 92, al: 0.5, col: C.gold, out: '#2a0d06' });
    lab('ts', 'восемь этажей тьмы · случайные подземелья · лут и прокачка', W / 2, 168, { size: 28, al: 0.5, col: C.dim });
    const a = 0.55 + 0.45 * Math.sin(t * 3);
    lab('tp', 'Нажмите любую клавишу', W / 2, H - 90, { size: 34, al: 0.5, a });
  }

  // ---------------- world-space overlays: monster bars, damage numbers, prompts ----------------
  function world(S, R, t, V) {
    const GT = S.t, h = R.hero, m = R.map;
    let bi = 0;
    for (const e of R.en) { if (e.deadT >= 0 || e.type === 'boss') continue; const E = D.ENEMIES[e.type], x = V.sx(e.x), y = V.sy(e.y) - (SZ('en_' + (e.type === 'boss' ? 'brute' : e.type))[1] * (e.elite ? 1.3 : 1) + 16) * (V.k || 1);
      if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
      if (e.st !== 'idle' || e.hp < e.max || e.elite) { const w = e.elite ? 64 : 48; L.rrect(x - w / 2 - 2, y - 2, w + 4, 10, 3, [0.02, 0.02, 0.02], [0.02, 0.02, 0.02], 0.85);
        L.rrect(x - w / 2, y, w * Math.max(0, e.hp / e.max), 6, 2, e.elite ? [1, 0.6, 0.15] : [0.85, 0.12, 0.1], e.elite ? [0.7, 0.3, 0.05] : [0.5, 0.05, 0.05]); }
      if (e.st === 'idle' || bi > 40) continue; bi++; void E; }
    // the "!" when a monster notices the hero
    for (const ev of S.ev) { const a = GT - ev.t; if (a < 0) continue;
      if (ev.k === 'alert' && a < 0.7) lab('al' + (ev.id % 30), '!', V.sx(ev.x), V.sy(ev.y) - 20 * L.SS(0, 0.15, a), { size: 34, al: 0.5, col: '#ffd040', a: 1 - L.SS(0.5, 0.7, a) });
      if (ev.k === 'hit' && a < 0.8) { const q = a / 0.8, s = Math.round((ev.crit ? 34 : 24) * (1 + 0.3 * L.SS(0, 0.08, a) - 0.3 * L.SS(0.08, 0.2, a)));
        lab('dn' + (ev.id % 40), String(ev.n), V.sx(ev.x) + (L.rnd(ev.t, 1) - 0.5) * 24, V.sy(ev.y) - 40 * q - 10, { size: s, al: 0.5, col: ev.crit ? '#ffcf3a' : ev.fire ? '#ffa05a' : '#f4ead2', out: '#2a0d06', a: 1 - L.SS(0.6, 0.8, a) }); }
      if (ev.k === 'hurt' && a < 0.8) lab('hu' + Math.floor(ev.t * 10 % 8), '-' + ev.n, V.sx(ev.x), V.sy(ev.y) - 50 * (a / 0.8), { size: 30, al: 0.5, col: C.red, a: 1 - L.SS(0.6, 0.8, a) });
      if (ev.k === 'gold' && a < 0.9) lab('gd' + Math.floor(ev.t * 10 % 8), '+' + ev.n, V.sx(ev.x), V.sy(ev.y) - 30 - 40 * (a / 0.9), { size: 24, al: 0.5, col: C.gold, a: 1 - L.SS(0.7, 0.9, a) });
      if (ev.k === 'absorb' && a < 0.7) lab('ab' + Math.floor(ev.t * 10 % 6), 'щит ' + ev.n, V.sx(ev.x), V.sy(ev.y) - 70 - 30 * a, { size: 22, al: 0.5, col: '#8fc4ff', a: 1 - a / 0.7 }); }
    // interaction prompt
    let pr = null;
    const ch = R.chests.find((c) => !c.open && Math.hypot(c.x - h.x, c.y - h.y) < 56); if (ch) pr = [ch.x, ch.y - 50, 'E или удар — открыть сундук'];
    const sh = R.shrines.find((s) => !s.used && Math.hypot(s.x - h.x, s.y - h.y) < 60); if (sh) pr = [sh.x, sh.y - 70, 'E — дары алтаря'];
    if (SIM.atCounter(R)) pr = [m.shop.front.x, m.shop.front.y + 62, 'E — торговать'];
    if (Math.hypot(m.exit.x - h.x, m.exit.y - h.y) < 60) pr = [m.exit.x, m.exit.y - 60, m.floor === D.FLOORS ? (R.bossDead ? 'E — выйти на поверхность' : 'Портал запечатан') : 'E — спуститься на этаж ' + (m.floor + 1)];
    if (pr && S.screen === 'play') { const s = pr[2], w = lw('prompt', s, { size: 24 }) + 28, x = V.sx(pr[0]) - w / 2, y = V.sy(pr[1]) - 20; panel('prompt_box', x, y, w, 40, { r: 6 }); lab('prompt', s, x + 14, y + 21, { size: 24, col: '#fff2c8' }); }
  }

  // ---------------- in-game HUD ----------------
  function hud(S, R, t) {
    const h = R.hero, st = SIM.stats(h, S.meta), GT = S.t;
    // portrait + level (sizes measured from the reference HUD, ~0.6 of the first pass)
    panel('portrait', 14, 12, 90, 104, { r: 5 });
    L.sprite('portrait', 18, 16, { w: 82, h: 70, src: [0.08, 0.02, 0.92, 0.74] });
    lab('lvl', 'Ур. ' + h.lvl, 59, 100, { size: 19, al: 0.5 });
    if (h.pts > 0 || h.sp > 0) { const a = 0.6 + 0.4 * Math.sin(t * 5); L.rrect(86, 6, 24, 24, 12, [1, 0.75, 0.2], [0.8, 0.45, 0.1], a); L.uiBox('lvl_up_b', 83, 3, 30, 30, 0); lab('lvl_up', '+', 98, 18, { size: 20, al: 0.5, col: '#2a1606', out: '' }); }
    // bars
    bar('hpbar', 116, 12, 230, 28, h.hp / st.maxHp, [0.86, 0.12, 0.1], [0.5, 0.04, 0.04], Math.ceil(h.hp) + ' / ' + st.maxHp);
    bar('mpbar', 116, 44, 230, 24, h.mp / st.maxMp, [0.18, 0.42, 0.95], [0.07, 0.18, 0.55], Math.floor(h.mp) + ' / ' + st.maxMp);
    bar('xpbar', 116, 72, 230, 9, h.xp / D.xpNeed(h.lvl), [0.95, 0.75, 0.25], [0.6, 0.4, 0.08]);
    if (h.shield > 0 && GT < h.shieldUntil) L.rrect(119, 15, 224 * Math.min(1, h.shield / st.maxHp), 6, 3, [0.6, 0.85, 1], [0.3, 0.55, 1], 0.9);
    // skill bar + potions
    D.ABILITIES.forEach((A, i) => { const x = 116 + i * 54, y = 88, r = h.ab[A.id] || 0;
      panel('sk_' + A.id, x, y, 48, 48, { r: 5, rim: r ? C.rimHi : C.rim });
      icon(A.icon, x + 3, y + 3, 42, { alpha: r ? 1 : 0.25, grade: r ? [1, 1, 0, 1] : [0, 0.5, 0, 1] });
      const cd = h.cd[A.id] - GT, full = A.cd; if (r && cd > 0) { L.solid(x + 3, y + 3 + 42 * (1 - cd / full), 42, 42 * cd / full, [0, 0, 0], 0, 0, 0, 0.6); lab('skc_' + A.id, cd.toFixed(1), x + 24, y + 25, { size: 16, al: 0.5 }); }
      else if (r && h.mp < A.mp) L.solid(x + 3, y + 3, 42, 42, [0.05, 0.1, 0.4], 0, 0, 0, 0.5);
      lab('skk_' + A.id, A.key, x + 8, y + 11, { size: 14, col: C.gold }); });
    const pot = (b) => h.bag.reduce((n, it) => n + (it && it.b === b ? it.n : 0), 0);
    [['hp_potion', 'it_hp', 'Q'], ['mp_potion', 'it_mp', 'R']].forEach(([b, ic, k], i) => { const x = 282 + i * 42, y = 90;
      panel('pot_' + b, x, y, 38, 44, { r: 5 }); icon(ic, x + 4, y + 3, 30); lab('potn_' + b, pot(b), x + 33, y + 35, { size: 15, al: 1 }); lab('potk_' + b, k, x + 7, y + 10, { size: 12, col: C.gold }); });
    // stats column (no panel, like the reference: icons and numbers straight on the frame, with an ink outline)
    const rows = [['it_sword', st.atk], ['it_shield', st.def], ['it_boots', Math.round(st.aspd) + '%'], ['it_ring', Math.round(st.crit) + '%']];
    const sw = Math.max(...rows.map(([, v], i) => lw('stv' + i, v, { size: 19 }))) + 46;
    panel('stats', 14, 128, sw, rows.length * 28 + 8, { r: 5, a: 0.55 });
    rows.forEach(([ic, v], i) => { icon(ic, 19, 133 + i * 28, 22); lab('stv' + i, v, 48, 145 + i * 28, { size: 19 }); });
    const money = currencies(S, R);
    for (const [id, ic, value, x, w, col] of money) {
      panel(id + '_box', x, 146, w, 36, { r: 5, a: 0.85 });
      icon(ic, x + 6, 152, 24); lab(id, value, x + 36, 165, { size: 19, col });
    }
    buffs(S, R, GT);
    // floor title + minimap
    minimap(S, R, t);
    // boss bar
    const boss = R.en.find((e) => e.type === 'boss' && e.deadT < 0 && e.st !== 'idle');
    if (boss) { lab('bossn', D.ENEMIES.boss.name, W / 2, 46, { size: 30, al: 0.5, col: '#ff8a5a' }); bar('bossbar', W / 2 - 400, 66, 800, 26, boss.hp / boss.max, [0.9, 0.25, 0.08], [0.45, 0.05, 0.02]); }
    // floor banner
    if (R.msg && S.screen === 'play') { const a = S.t - R.msg.t; if (a >= 0 && a < 3.5) { const al = L.SS(0, 0.3, a) * (1 - L.SS(2.8, 3.5, a)), s = R.msg.s;
      const size = Math.max(18, Math.floor(30 * Math.min(1, 1000 / lw('msg_m', s, { size: 30 })))), w = lw('msg', s, { size }) + 60;
      panel('msg_box', W / 2 - w / 2, 150, w, 52, { a: 0.85 * al }); lab('msg', s, W / 2, 177, { size, al: 0.5, col: C.gold, a: al }); } }
    // feed: pickups and refusals, newest at the bottom
    const feed = S.ev.filter((e) => (e.k === 'pickup' || e.k === 'nope' || e.k === 'lvl' || e.k === 'unlock' || e.k === 'trade') && S.t - e.t < 3).slice(-5);
    feed.forEach((e, i) => { const a = S.t - e.t, al = 1 - L.SS(2.4, 3, a), y = H - 44 - (feed.length - 1 - i) * 34;
      const s = e.k === 'trade' ? e.s + (e.n > 0 ? '  +' : '  −') + Math.abs(e.n) + ' зол.' : e.k === 'pickup' ? (e.worn ? 'Надето: ' : 'Подобрано: ') + e.s : e.k === 'lvl' ? 'Новый уровень ' + e.lvl + '! Нажмите I' : e.k === 'unlock' ? 'Открыта способность: ' + D.ABILITIES.find((A) => A.id === e.id).name : e.s;
      const col = e.k === 'pickup' || e.k === 'trade' ? hex(D.RARITY[e.rar || 0].col) : e.k === 'nope' ? '#ffb0a0' : C.gold, w = lw('feed' + i, s, { size: 19 }) + 24;
      panel('feedbox' + i, 18, y - 15, w, 30, { r: 5, a: 0.7 * al }); lab('feed' + i, s, 30, y + 1, { size: 19, col, a: al }); });
    if (S.screen === 'play') { const k = 'I — герой · M — звук · Esc — пауза'; lab('keys', k, W - 18, H - 20, { size: 15, al: 1, col: '#8a7d6c' }); }
  }

  // active effects under the currencies: the shrine's blessing lasts the floor, the shield shows what it still soaks, the
  // timed ones drain clockwise; debuffs sit on a red rim
  function buffs(S, R, GT) {
    const h = R.hero, list = [];
    if (h.bless) list.push({ id: 'bless', ic: 'bf_bless', v: '+20%', col: '#9cc8ff' });
    // the altars' gifts for the run: one cell per kind, the value summed over every altar that gave it
    for (const G of D.GIFTS) { const n = (h.perks || {})[G.id]; if (n) list.push({ id: 'g_' + G.id, ic: G.icon, v: G.desc.split(' ')[0].replace(/[\d.]+/, String(Math.round(G.v * n * 10) / 10)), col: '#9cc8ff' }); }
    if (h.shield > 0 && GT < h.shieldUntil) list.push({ id: 'shield', ic: 'ab_shield', v: String(Math.ceil(h.shield)), col: '#9cc8ff', left: (h.shieldUntil - GT) / 5 });
    if (h.burn > GT) list.push({ id: 'burn', ic: 'bf_burn', left: (h.burn - GT) / 3, bad: 1 });
    if (h.poison > GT) list.push({ id: 'poison', ic: 'bf_poison', left: (h.poison - GT) / 3, bad: 1 });
    list.forEach((b, i) => { const x = 116 + (i % 8) * 46, y = 190 + Math.floor(i / 8) * 64;
      panel('bf_' + b.id, x, y, 40, 40, { r: 5, rim: b.bad ? [0.75, 0.2, 0.15] : C.rimHi, a: 0.9 });
      if (window.ASSETS[b.ic]) icon(b.ic, x + 3, y + 3, 34);
      if (b.left !== undefined) { const f = Math.max(0, Math.min(1, 1 - b.left)); L.solid(x + 3, y + 3, 34, 34 * f, [0, 0, 0], 0, 0, 0, 0.55);
        if (b.left < 0.25 && Math.sin(GT * 18) > 0) L.rrect(x, y, 40, 40, 5, [1, 1, 1], [1, 1, 1], 0.12); }
      if (b.v) lab('bfv_' + b.id, b.v, x + 20, y + 49, { size: 14, al: 0.5, col: b.col }); });
  }

  function currencies(S, R) {
    const gold = String(R.hero.gold), shards = String(S.meta.shards), gw = lw('gold_count', gold, { size: 19 }) + 48;
    return [['gold_count', 'it_gold', gold, 116, gw, C.gold], ['shard_count', 'crystal', shards, 126 + gw, lw('shard_count', shards, { size: 19 }) + 48, '#9cc8ff']];
  }

  function souls(S, R, V) {
    const tx = currencies(S, R)[1][3] + 18, ty = 164;
    for (const e of S.ev) {
      const a = S.t - e.t, floorReward = e.k === 'stairs' && e.n > 0;
      if ((!floorReward && e.k !== 'shard') || a < 0 || a > 3.5 || (e.floor !== undefined && e.floor !== R.floor - (floorReward ? 1 : 0))) continue;
      const x0 = floorReward ? W / 2 : V.sx(e.x), y0 = floorReward ? 280 : V.sy(e.y) - 20;
      if (floorReward) {
        const text = 'Осколки душ: +' + e.n + ' за этаж ' + e.floor, alpha = L.SS(0, 0.15, a) * (1 - L.SS(2.8, 3.5, a));
        const w = lw('soul_reward', text, { size: 22 }) + 36;
        panel('soul_reward_box', W / 2 - w / 2, 213, w, 42, { a: 0.8 * alpha });
        lab('soul_reward', text, W / 2, 235, { size: 22, al: 0.5, col: '#9cc8ff', a: alpha });
      }
      if (a < 0.45 && !floorReward) {
        G.blend('add'); L.glow(x0, y0, 55 + a * 100, [0.35, 0.65, 1], (1 - a / 0.45) * 0.9); G.blend();
      }
      const start = floorReward ? 0.55 : 0.15, q = L.SS(start, start + 0.85, a);
      if (a < start + 0.85) {
        const x = x0 + (tx - x0) * q, y = y0 + (ty - y0) * q + Math.sin(q * Math.PI) * (floorReward ? 60 : -80);
        G.blend('add'); L.glow(x, y, 24, [0.35, 0.65, 1], 0.75); G.blend();
        icon('crystal', x - 12, y - 12, 24);
      }
      const pulse = 1 - Math.abs((a - start - 0.85) / 0.3);
      if (pulse > 0) { G.blend('add'); L.glow(tx, ty, 38, [0.35, 0.65, 1], pulse * 0.7); G.blend(); }
    }
  }

  // debug: every item of loot still on the floor (a diamond) and every closed chest holding some (a square, one pip per item),
  // green where the hero can walk to it, violet behind an unfound secret, red where nothing can reach it; off screen, an arrow
  // at the edge points to it
  const LOOT_COL = { open: [0.35, 1, 0.45], secret: [0.8, 0.5, 1], stuck: [1, 0.22, 0.2] };
  function lootMarks(R, t, V) { const A = SIM.lootAudit(R), pulse = 0.75 + 0.25 * Math.sin(t * 5);
    for (const o of A.list) { const col = LOOT_COL[o.at], x = V.sx(o.x), y = V.sy(o.y) - 12;
      if ((x > W - 240 && y < 290) || (x < 380 && y < 260) || (y < 150 && x > 500 && x < 1420)) continue;   // under a HUD panel: the minimap shows it
      if (x > 30 && x < W - 30 && y > 30 && y < H - 30) {
        if (o.chest) { L.rrect(x - 17, y - 17, 34, 34, 4, col, col, 0.25 * pulse); L.ring(x, y, 22, 22, col, pulse, 0.12); for (let k = 0; k < o.n; k++) L.rrect(x - (o.n - 1) * 5 + k * 10 - 3, y - 34, 6, 6, 3, col, col); }
        else { L.solid(x, y, 16, 16, col, Math.PI / 4, 8, 8, 0.85 * pulse); L.ring(x, y, 18, 18, col, pulse, 0.14); }
        continue; }
      const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy, k = Math.min((W / 2 - 40) / Math.abs(dx || 1e-6), (H / 2 - 40) / Math.abs(dy || 1e-6)), ex = cx + dx * k, ey = cy + dy * k, a = Math.atan2(dy, dx);
      L.solid(ex, ey, 26, 12, col, a, 13, 6, 0.9); L.solid(ex + Math.cos(a) * 10, ey + Math.sin(a) * 10, 12, 12, col, a + Math.PI / 4, 6, 6, 0.9); } }
  // debug: the floor's loot books under the debug buttons
  function lootBooks(R) { const A = SIM.lootAudit(R), sec = A.list.filter((o) => o.at === 'secret').reduce((n, o) => n + o.n, 0);
    const line = `Лут: подобрано ${A.got} из ${A.total} · на полу ${A.lying} · в сундуках ${A.boxed} · в тайниках ${sec} · недоступно ${A.stuck} · расхождение ${A.off}`;
    const w = lw('dbg_loot_l', line, { size: 20 }) + 28; panel('dbg_loot_p', W / 2 - w / 2, 108, w, 34, { r: 5, a: 0.85 });
    lab('dbg_loot_l', line, W / 2, 126, { size: 20, al: 0.5, col: A.off || A.stuck ? '#ff7a6a' : C.text }); }
  function minimap(S, R, t) {
    const m = R.map, k = MAP.k, mw = m.W * k, mh = m.H * k, py = 46, n = R.seen.reduce((a, b) => a + b, 0);
    const hid = SIM.secretMask(m), key = m.seed + ':' + m.floor + ':' + n + ':' + R.chests.map((c) => c.open).join('') + R.rseen.join('') + (m.secrets || []).map((q) => q.open).join('');
    if (MAP.key !== key) { MAP.key = key; const cv = MAP.cv || (MAP.cv = document.createElement('canvas')); cv.width = mw; cv.height = mh; const g = cv.getContext('2d'); g.clearRect(0, 0, mw, mh);
      // an unfound secret room is rock on the map, its fake wall a wall
      const at = (x, y) => (hid.has(y * m.W + x) ? 0 : SIM.cell(m, x, y));
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { if (!R.seen[y * m.W + x]) continue; const c = at(x, y);
        if (c === 1) { g.fillStyle = '#6b625c'; g.fillRect(x * k, y * k, k, k); } else if (c === 3) { g.fillStyle = '#c4441a'; g.fillRect(x * k, y * k, k, k); }
        else if (at(x, y + 1) === 1 || at(x, y - 1) === 1 || at(x + 1, y) === 1 || at(x - 1, y) === 1) { g.fillStyle = '#2a2427'; g.fillRect(x * k, y * k, k, k); } }
      if (MAP.rec) { const gl = G.gl; gl.bindTexture(gl.TEXTURE_2D, MAP.rec.t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D); MAP.rec.w = mw; MAP.rec.h = mh; }
      else MAP.rec = G.canvasTex('minimap', cv); }
    const title = ('Этаж ' + m.floor + ' — ' + D.floorName(m.floor)).toUpperCase(), tw = lw('mm_t', title, { size: 17 });
    const legend = [['#4aa0ff', 'Вы'], ['#ffd040', 'Сокровища'], ['#ff4040', 'Босс'], ['#e8e0d0', 'Выход'], ['#5ee08a', 'Торговец']];
    // the legend's right column decides the width on small maps with short floor names
    const lgw = 2 * (Math.max(...legend.filter((_, i) => i % 2).map(([, s], j) => lw('mm_l' + (2 * j + 1), s, { size: 14 }))) + 23);
    const pw = Math.max(mw + 20, tw + 20, lgw), px = W - 14 - pw / 2 - mw / 2;
    const lgh = 22 * Math.ceil(legend.length / 2), prog = progress(R);
    panel('minimap', W - pw - 14, 12, pw, mh + 44 + lgh + 8 + 30, { r: 5, a: 0.82 });
    lab('mm_t', title, W - pw / 2 - 14, 29, { size: 17, al: 0.5 });
    L.sprite('minimap', px, py, { w: mw, h: mh });
    const dot = (x, y, col, r) => L.rrect(px + x / TILE * k - r * 0.75, py + y / TILE * k - r * 0.75, 1.5 * r, 1.5 * r, r * 0.75, col, col);
    for (const c of R.chests) if (!c.open && !SIM.hidden(m, c) && R.seen[Math.floor(c.y / TILE) * m.W + Math.floor(c.x / TILE)]) dot(c.x, c.y, [1, 0.82, 0.25], 4);
    for (const e of R.en) if (e.type === 'boss' && e.deadT < 0 && R.seen[Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE)]) dot(e.x, e.y, [1, 0.25, 0.25], 6);
    if (R.seen[m.exit.ty * m.W + m.exit.tx]) { dot(m.exit.x, m.exit.y, [0.92, 0.88, 0.8], 5); }
    if (m.shop && R.rseen[m.shop.room]) dot(m.shop.x, m.shop.y, [0.37, 0.88, 0.54], 5);
    if (S.debug && S.dbgLoot) for (const o of SIM.lootAudit(R).list) dot(o.x, o.y, LOOT_COL[o.at], o.chest ? 4 : 3);
    dot(R.hero.x, R.hero.y, [0.3, 0.65, 1], 5 + Math.sin(t * 6));
    legend.forEach(([col, s], i) => { const x = W - pw - 4 + (i % 2) * (pw / 2 - 6), y = py + mh + 16 + Math.floor(i / 2) * 22; L.rrect(x, y - 5, 10, 10, 5, hexc(col), hexc(col)); lab('mm_l' + i, s, x + 15, y, { size: 14, col: C.dim }); });
    // this floor's completion: monsters, loot, secrets (the last only where the floor has any)
    const y = py + mh + lgh + 22; L.solid(W - pw - 4, y - 14, pw - 20, 1, C.rim, 0, 0, 0, 0.5);
    prog.forEach(([id, ic, s, done], i) => { const x = W - pw - 4 + i * (pw - 20) / prog.length; icon(ic, x, y - 4, 18, done ? undefined : { alpha: 0.75 });
      lab('mm_p' + id, s, x + 22, y + 6, { size: 15, col: done ? C.gold : C.text }); });
  }
  // floor completion cells for the minimap: [id, icon, text, complete]
  function progress(R) {
    const f = SIM.fstat(R), pc = (k, n) => Math.floor(100 * Math.min(1, k / n)) + '%', out = [];
    if (f.foes) out.push(['foes', 'it_sword', pc(f.kills, f.foes), f.kills >= f.foes]);
    if (f.lootN) out.push(['loot', 'chest', pc(f.loot, f.lootN), f.loot >= f.lootN]);
    // secrets as a share only, and always shown: neither how many the floor hides nor whether it hides any is given away
    out.push(['sec', 'it_key', f.secN ? pc(f.sec, f.secN) : '0%', f.secN > 0 && f.sec >= f.secN]);
    return out;
  }
  const hexc = (s) => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];

  // ---------------- hero screen ----------------
  function inv(S, R, t) {
    const h = R.hero, st = SIM.stats(h, S.meta), U = D.UI.inv(), P = U.P;
    dim(0.35); panel('inv', P.x, P.y, P.w, P.h, { r: 10, a: 0.72 });
    lab('inv_t', 'Герой', P.x + 40, P.y + 46, { size: 40, col: C.gold });
    lab('inv_g', h.gold + ' золота', P.x + P.w - 96, P.y + 46, { size: 28, al: 1, col: C.gold }); icon('it_gold', P.x + P.w - 96 - lw('inv_g', h.gold + ' золота', { size: 28 }) - 46, P.y + 28, 36);
    lab('inv_souls', 'Осколки душ: ' + S.meta.shards, P.x + 310, P.y + 46, { size: 22, col: '#9cc8ff' });
    // portrait and level
    L.sprite('portrait', P.x + 40, P.y + 90, { w: 220, h: 220 * 0.84, src: [0.04, 0.0, 0.96, 0.77] }); L.uiBox('inv_por', P.x + 40, P.y + 90, 220, 186);
    lab('inv_lv', 'Уровень ' + h.lvl, P.x + 150, P.y + 300, { size: 28, al: 0.5 });
    bar('inv_xp', P.x + 40, P.y + 322, 220, 16, h.xp / D.xpNeed(h.lvl), [0.95, 0.75, 0.25], [0.6, 0.4, 0.08]);
    lab('inv_xpn', h.xp + ' / ' + D.xpNeed(h.lvl) + ' опыта', P.x + 150, P.y + 360, { size: 20, al: 0.5, col: C.dim });
    // stats
    lab('inv_pts', h.pts > 0 ? 'Очки характеристик: ' + h.pts : 'Характеристики', P.x + 40, P.y + 418, { size: 24, col: h.pts > 0 ? C.gold : C.text });
    D.STATS.forEach((s, i) => { const b = U.r.find((q) => q.id === 'stat:' + s.k), y = b.y + 20;
      lab('st_n' + i, s.name, P.x + 40, y, { size: 26, col: C.dim }); lab('st_v' + i, h.base[s.k] + (st[s.k] - h.base[s.k] ? ' (+' + (st[s.k] - h.base[s.k]) + ')' : ''), P.x + 110, y, { size: 26 });
      if (h.pts > 0) { panel('st_b' + i, b.x, b.y, b.w, b.h, { r: 6, c0: S.hover === b.id ? [0.35, 0.25, 0.1] : [0.2, 0.15, 0.08] }); lab('st_p' + i, '+', b.x + b.w / 2, b.y + b.h / 2, { size: 30, al: 0.5, col: C.gold }); } });
    // equipment, and under it what it all adds up to
    lab('inv_eq', 'Снаряжение', P.x + 310, P.y + 90, { size: 24, col: C.dim });
    for (const b of U.r) if (b.id.startsWith('eq:')) slot(S, b, h.eq[b.slot], b.slot);
    const he = U.r.find((q) => q.id === S.hover && q.slot && !h.eq[q.slot]);
    const pct = (v) => (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + '%', num = (v) => Math.round(v * 10) / 10;
    const derived = [['Атака', st.atk], ['Защита', st.def], ['Здоровье', st.maxHp], ['Мана', st.maxMp], ['Крит', Math.round(st.crit) + '%'], ['Ск. атаки', pct(st.aspd)],
      ['Ск. бега', pct(st.mspd)], ['Вампиризм', st.leech ? num(st.leech) + '%' : '—'], ['Здоровье/с', st.regen ? '+' + num(st.regen) : '—'], ['За удар', st.onhit ? '+' + num(st.onhit) : '—']];
    const dy0 = P.y + 446; L.rrect(P.x + 304, dy0 - 18, 286, derived.length * 24 + 18, 6, [0.07, 0.06, 0.07], [0.04, 0.035, 0.045], 0.8);
    derived.forEach(([n, v], i) => { const y = dy0 + 6 + i * 24; lab('dv_n' + i, n, P.x + 318, y, { size: 19, col: C.dim }); lab('dv_v' + i, v, P.x + 576, y, { size: 20, al: 1 }); });
    L.uiBox('inv_der', P.x + 304, dy0 - 18, 286, derived.length * 24 + 18);
    lab('inv_bag', 'Сумка', P.x + 640, P.y + 90, { size: 24, col: C.dim });
    for (const b of U.r) if (b.id.startsWith('bag:')) slot(S, b, h.bag[b.i]);
    // skills
    lab('inv_sk', h.sp > 0 ? 'Очки навыков: ' + h.sp : 'Способности', P.x + 640, P.y + 448, { size: 24, col: h.sp > 0 ? C.gold : C.dim });
    D.ABILITIES.forEach((A, i) => { const b = U.r.find((q) => q.id === 'ab:' + A.id), r = h.ab[A.id] || 0, can = h.sp > 0 && h.lvl >= A.unlock && r < D.AB_MAX;
      panel('ab_' + i, b.x, b.y, b.w, b.h, { r: 8, rim: S.hover === b.id && can ? C.rimHi : C.rim });
      icon(A.icon, b.x + 10, b.y + 10, 64, { alpha: r ? 1 : 0.3 });
      lab('ab_n' + i, A.name, b.x + 84, b.y + 26, { size: 19, col: C.text });
      lab('ab_r' + i, r ? 'ранг ' + r + ' / ' + D.AB_MAX : 'с ' + A.unlock + ' уровня', b.x + 84, b.y + 56, { size: 19, col: r ? C.gold : C.dim });
      const k = D.abRank(A.id, r).k, d = A.id === 'whirl' ? Math.round(k * 100) : A.id === 'fireball' ? Math.round((14 + st.int * 2.6) * k * st.spell) : Math.round((30 + st.int * 4) * k);
      const ds = A.desc.replace('{d}', d), parts = ds.split(': ');
      lab('ab_d' + i, parts[0] + ':', b.x + 12, b.y + 96, { size: 17, col: C.dim }); lab('ab_e' + i, parts[1] || '', b.x + 12, b.y + 122, { size: 17, col: C.dim });
      if (can) { L.rrect(b.x + b.w - 40, b.y + 40, 32, 32, 16, [1, 0.75, 0.2], [0.8, 0.45, 0.1], 0.6 + 0.4 * Math.sin(t * 5)); lab('ab_p' + i, '+', b.x + b.w - 24, b.y + 56, { size: 24, al: 0.5, col: '#2a1606', out: '' }); } });
    lab('inv_help', 'ЛКМ — надеть / использовать · ПКМ — выбросить · I или Esc — закрыть', P.x + P.w / 2, P.y + P.h - 30, { size: 20, al: 0.5, col: '#8a7d6c' });
    // close
    const cb = U.r.find((q) => q.id === 'close'); panel('inv_x', cb.x, cb.y, cb.w, cb.h, { r: 6, rim: S.hover === 'close' ? C.rimHi : C.rim }); lab('inv_xl', '×', cb.x + cb.w / 2, cb.y + cb.h / 2, { size: 34, al: 0.5 });
    if (he) { const s = D.SLOT_NAME[he.slot], w = lw('sle', s, { size: 20 }) + 24; panel('slh', he.x + he.w / 2 - w / 2, he.y + he.h + 6, w, 34, { r: 5, rim: C.rimHi });
      lab('sle', s, he.x + he.w / 2, he.y + he.h + 24, { size: 20, al: 0.5 }); }
    // tooltip
    const hb = U.r.find((q) => q.id === S.hover); if (hb) { const it = hb.id.startsWith('bag:') ? h.bag[hb.i] : hb.id.startsWith('eq:') ? h.eq[hb.slot] : null; if (it) tooltip(S, it, hb, h); }
  }
  // ---------------- the merchant's screen ----------------
  function shop(S, R, t) {
    const h = R.hero, sh = R.shop, U = D.UI.shop(sh.goods.length), P = U.P, f = R.floor;
    dim(0.6); panel('shop', P.x, P.y, P.w, P.h, { r: 10 });
    lab('sh_t', 'Лавка торговца', P.x + 40, P.y + 46, { size: 40, col: C.gold });
    const gs = h.gold + ' золота'; lab('sh_g', gs, P.x + P.w - 96, P.y + 46, { size: 28, al: 1, col: C.gold }); icon('it_gold', P.x + P.w - 96 - lw('sh_g', gs, { size: 28 }) - 46, P.y + 28, 36);
    const price = (id, b, n, can) => { const s = String(n), w = lw(id, s, { size: 20 }) + 24; icon('it_gold', b.x + b.w / 2 - w / 2, b.y + b.h + 6, 20); lab(id, s, b.x + b.w / 2 - w / 2 + 24, b.y + b.h + 17, { size: 20, col: can ? C.gold : '#8a6a5a' }); };
    lab('sh_buy', 'Товары · этаж ' + f, P.x + 40, P.y + 100, { size: 24, col: C.dim });
    sh.goods.forEach((g, i) => { const b = U.r.find((q) => q.id === 'buy:' + i); slot(S, b, g.n ? Object.assign({}, g.it, { n: g.n }) : g.it); price('shp_b' + i, b, g.price, h.gold >= g.price); });
    lab('sh_back', 'Выкуп проданного', P.x + 40, P.y + 550, { size: 24, col: C.dim });
    for (let i = 0; i < D.SHOP.buyback; i++) { const b = U.r.find((q) => q.id === 'back:' + i), g = sh.back[i]; slot(S, b, g && g.it); if (g) price('shp_k' + i, b, g.price, h.gold >= g.price); }
    lab('sh_bag', 'Ваша сумка — продать', P.x + 620, P.y + 100, { size: 24, col: C.dim });
    for (let i = 0; i < 24; i++) { const b = U.r.find((q) => q.id === 'sell:' + i), it = h.bag[i]; slot(S, b, it); if (it) price('shp_s' + i, b, D.sellPrice(it, f), true); }
    // the merchant himself, his line for this visit
    const mx = P.x + 720, my = P.y + P.h - 64, [mw, mh] = SZ('merchant'), k = 2.1;
    L.sprite('merchant', mx - mw * k / 2, my - mh * k, { w: mw * k, h: mh * k }); L.uiBox('sh_merch', mx - mw * k / 2, my - mh * k, mw * k, mh * k);
    const line = '«' + D.SHOP.lines[sh.line % D.SHOP.lines.length] + '»', lsz = Math.min(24, Math.floor(24 * 400 / lw('sh_line_m', line, { size: 24 }))), bw = lw('sh_line', line, { size: lsz }) + 40;
    panel('sh_bubble', P.x + 620, P.y + 556, bw, 48, { r: 10 }); lab('sh_line', line, P.x + 640, P.y + 581, { size: lsz, col: '#fff2c8' });
    lab('sh_help', 'ЛКМ по товару — купить · ЛКМ по вещи в сумке — продать · E или Esc — закрыть', P.x + P.w / 2, P.y + P.h - 30, { size: 20, al: 0.5, col: '#8a7d6c' });
    const cb = U.r.find((q) => q.id === 'close'); panel('sh_x', cb.x, cb.y, cb.w, cb.h, { r: 6, rim: S.hover === 'close' ? C.rimHi : C.rim }); lab('sh_xl', '×', cb.x + cb.w / 2, cb.y + cb.h / 2, { size: 34, al: 0.5 });
    const hb = U.r.find((q) => q.id === S.hover); if (!hb) return;
    const g = hb.id.startsWith('buy:') ? sh.goods[hb.i] : hb.id.startsWith('back:') ? sh.back[hb.i] : null, it = g ? g.it : hb.id.startsWith('sell:') ? h.bag[hb.i] : null;
    // the details sit in a fixed pane in the corner: a floating tip would cover the next slots' prices
    if (it) tooltip(S, it, hb, h, g ? ['Купить за ' + g.price + ' золота', h.gold >= g.price ? C.gold : C.red] : ['Продать за ' + D.sellPrice(it, f) + ' золота', C.gold], [P.x + 1090, P.y + 556]);
  }
  // an empty gear slot shows the outline of what goes in it, its name on hover
  const SLOT_SIL = { weapon: 'it_sword', offhand: 'it_shield', helm: 'it_helm_k', armor: 'it_armor_p', gloves: 'it_gloves', boots: 'it_boots', ring: 'it_ring', amulet: 'it_amulet' };
  function slot(S, b, it, empty) {
    const hv = S.hover === b.id, col = it ? D.RARITY[it.rar].col : null;
    panel('sl_' + b.id, b.x, b.y, b.w, b.h, { r: 6, rim: it && it.rar ? col : hv ? C.rimHi : [0.3, 0.25, 0.21], c0: hv ? [0.16, 0.12, 0.1] : [0.07, 0.06, 0.07], c1: [0.04, 0.035, 0.045] });
    if (it) { if (it.rar >= 2) L.rrect(b.x + 3, b.y + 3, b.w - 6, b.h - 6, 5, col, [0, 0, 0], 0.18); icon(SIM.itemIcon(it), b.x + 8, b.y + 8, b.w - 16);
      if (it.n > 1) lab('sln_' + b.id, it.n, b.x + b.w - 8, b.y + b.h - 14, { size: 20, al: 1 }); }
    else if (empty) icon(SLOT_SIL[empty], b.x + 12, b.y + 12, b.w - 24, { grade: [0, hv ? 0.7 : 0.5, 0.6, 1], haze: hv ? [0.3, 0.26, 0.22] : [0.17, 0.15, 0.14], alpha: 0.8 });
  }
  function tooltip(S, it, b, h, deal, at) {
    const lines = [], cons = SIM.isCons(it), B = cons ? null : D.BASES[it.b];
    lines.push([SIM.itemName(it), hex(D.RARITY[it.rar].col), 28]);
    if (!cons) { lines.push([D.RARITY[it.rar].name + ' · ' + D.SLOT_NAME[B.slot] + ' · ур. ' + it.lvl, C.dim, 20]);
      if (it.atk) lines.push(['Атака: ' + it.atk + (B.spell ? '  (+' + Math.round(B.spell * 100) + '% к магии)' : ''), C.text, 22]);
      if (it.def) lines.push(['Защита: ' + it.def, C.text, 22]);
      const typed = SIM.typeMods(it), mod = (m, col) => { for (const k in m) lines.push([D.AFFIXES.find((a) => a.k === k).label.replace('{v}', m[k]), col, 22]); };
      mod(typed, C.text); mod(it.mods, '#8fd98a');
      const cur = h.eq[B.slot]; if (cur && cur !== it) { lines.push(['Надето: ' + SIM.itemName(cur) + (cur.atk ? ' · атака ' + cur.atk : '') + (cur.def ? ' · защита ' + cur.def : ''), C.dim, 19]); }
      if (!deal) lines.push([b.id.startsWith('eq:') ? 'ЛКМ — снять' : 'ЛКМ — надеть', '#8a7d6c', 18]); }
    else { lines.push([it.b === 'hp_potion' ? 'Восстанавливает 40% здоровья (Q)' : it.b === 'mp_potion' ? 'Восстанавливает 50% маны (R)' : 'Возвращает в безопасную комнату', C.text, 20]); if (!deal) lines.push(['ЛКМ — использовать', '#8a7d6c', 18]); }
    if (deal) lines.push([deal[0], deal[1], 22]);
    const w = Math.max(...lines.map(([s, , z], i) => lw('tt' + i, s, { size: z }))) + 36, hh = lines.reduce((a, l) => a + l[2] * 1.45, 0) + 24;
    let x = b.x + b.w + 12, y = b.y; if (x + w > W - 10) x = b.x - w - 12; if (y + hh > H - 10) y = H - 10 - hh;
    if (at) { x = Math.min(at[0], W - 10 - w); y = Math.min(at[1], H - 10 - hh); }
    L.uiCover('tip', x, y, w, hh);
    panel('tip', x, y, w, hh, { r: 8, rim: D.RARITY[it.rar].col, a: 0.97 });
    let yy = y + 14; lines.forEach(([s, col, z], i) => { yy += z * 0.72; lab('tt' + i, s, x + 18, yy, { size: z, col }); yy += z * 0.73; });
  }

  // ---------------- menus ----------------
  function menu(S, t) {
    L.solid(0, 0, W, H, [0.02, 0.015, 0.02], 0, 0, 0, 1);
    for (let i = 0; i < 6; i++) { G.blend('add'); L.glow(W * (0.15 + 0.14 * i), H * 0.8, 260, [1, 0.45, 0.15], 0.12 + 0.05 * Math.sin(t * 2 + i), 2); G.blend(); }
    const [hw, hh] = SZ('hero'); L.sprite('hero', W / 2 - 520 - hw * 1.6, 340, { w: hw * 3.2, h: hh * 3.2 }); L.uiBox('menu_hero', W / 2 - 520 - hw * 1.6, 340, hw * 3.2, hh * 3.2);
    const [bw, bh] = SZ('en_brute'); L.sprite('en_brute', W / 2 + 470, 330, { w: bw * 2.6, h: bh * 2.6, flip: true, u: { grade: [0.9, 0.75, 0, 1] } });
    lab('m_t', 'ГЛУБИНЫ КРИПТЫ', W / 2, 220, { size: 104, al: 0.5, col: C.gold, out: '#2a0d06' });
    lab('m_s', 'Спуститесь на восемь этажей и одолейте Повелителя Демонов', W / 2, 310, { size: 28, al: 0.5, col: C.dim });
    for (const b of D.UI.menu(!!S.saved)) button('mb_' + b.id, b, S.hover);
    if (S.saved) { const s = 'Сохранённый забег: этаж ' + S.saved.floor + ', уровень ' + S.saved.hero.lvl; lab('m_sv', s, W / 2, 452, { size: 22, al: 0.5, col: '#9fd08a' }); }
    const info = 'Осколки душ: ' + S.meta.shards + '   ·   Забегов: ' + (S.meta.runs || 0) + '   ·   Побед: ' + (S.meta.wins || 0) + '   ·   Рекорд: этаж ' + (S.meta.best || 0);
    lab('m_i', info, W / 2, H - 70, { size: 24, al: 0.5, col: C.dim });
  }
  function meta(S, t) {
    L.solid(0, 0, W, H, [0.02, 0.015, 0.03], 0, 0, 0, 1);
    G.blend('add'); L.glow(W / 2, 200, 500, [0.3, 0.5, 1], 0.25 + 0.05 * Math.sin(t * 2)); G.blend();
    lab('mt_t', 'Алтарь душ', W / 2, 140, { size: 72, al: 0.5, col: '#9cc8ff' });
    lab('mt_s', 'Осколки душ: ' + S.meta.shards + ' — их приносят монстры, боссы и каждый пройденный этаж', W / 2, 220, { size: 26, al: 0.5, col: C.dim });
    for (const b of D.UI.meta()) {
      if (b.id === 'back') { button('mt_back', b, S.hover); continue; }
      const M = D.META.find((q) => q.id === b.id), r = S.meta.up[M.id] || 0, c = M.cost(r), max = r >= M.max, can = !max && S.meta.shards >= c;
      panel('mt_' + b.id, b.x, b.y, b.w, b.h, { r: 8, rim: S.hover === b.id && can ? C.rimHi : C.rim });
      lab('mt_n' + b.id, M.name, b.x + 24, b.y + 32, { size: 28 }); lab('mt_d' + b.id, D.metaLine(M, r), b.x + 24, b.y + 70, { size: 20, col: r ? '#9cc8ff' : C.dim });
      const px = b.x + 36 + lw('mt_n' + b.id, M.name, { size: 28 });
      for (let i = 0; i < M.max; i++) L.rrect(px + i * 26, b.y + 22, 18, 18, 4, i < r ? [0.45, 0.7, 1] : [0.15, 0.15, 0.2], i < r ? [0.25, 0.45, 0.9] : [0.08, 0.08, 0.1]);
      lab('mt_c' + b.id, max ? 'Максимум' : 'Цена: ' + c, b.x + b.w - 24, b.y + b.h / 2, { size: 24, al: 1, col: max ? C.gold : can ? '#9cc8ff' : '#7a6e64' }); }
    refusal(S, W / 2, 836);
  }
  // the latest refusal on a full-screen menu, where the in-game feed is hidden
  function refusal(S, x, y) {
    const e = S.ev.filter((q) => q.k === 'nope' && S.t - q.t < 2).at(-1); if (!e) return;
    lab('nope_m', e.s, x, y, { size: 24, al: 0.5, col: '#ffb0a0', a: 1 - L.SS(1.5, 2, S.t - e.t) });
  }
  // ---------------- a dungeon altar: three gifts for shards ----------------
  function altar(S, R, t) {
    const sh = R.shrines[R.altar]; if (!sh || !sh.gifts) return;
    const U = D.UI.altar(), P = U.P, bank = S.meta.shards;
    dim(0.6); G.blend('add'); L.glow(W / 2, P.y + 60, 420, [0.3, 0.5, 1], 0.18 + 0.04 * Math.sin(t * 2)); G.blend();
    panel('altar', P.x, P.y, P.w, P.h, { r: 10, rim: [0.32, 0.42, 0.62] });
    lab('al_t', 'Алтарь душ', P.x + 40, P.y + 50, { size: 40, col: '#9cc8ff' });
    const bs = String(bank); lab('al_b', bs, P.x + P.w - 40, P.y + 50, { size: 30, al: 1, col: '#9cc8ff' }); icon('crystal', P.x + P.w - 40 - lw('al_b', bs, { size: 30 }) - 44, P.y + 32, 36);
    lab('al_s', 'Пожертвуйте осколки душ за один дар на весь забег. После этого алтарь угаснет.', P.x + 40, P.y + 104, { size: 22, col: C.dim });
    sh.gifts.forEach((o, i) => { const b = U.r[i], Gf = D.GIFTS.find((q) => q.id === o.id), can = bank >= o.cost, hv = S.hover === b.id;
      panel('al_g' + i, b.x, b.y, b.w, b.h, { r: 8, rim: hv && can ? C.rimHi : can ? [0.32, 0.42, 0.62] : C.rim, c0: hv && can ? [0.14, 0.14, 0.2] : C.panel0 });
      if (can) { G.blend('add'); L.glow(b.x + b.w / 2, b.y + 110, 90, [0.35, 0.6, 1], hv ? 0.35 : 0.15); G.blend(); }
      icon(Gf.icon, b.x + b.w / 2 - 56, b.y + 52, 112, can ? undefined : { alpha: 0.45 });
      lab('al_n' + i, Gf.name, b.x + b.w / 2, b.y + 214, { size: 28, al: 0.5, col: can ? C.text : C.dim });
      const ds = Gf.desc, dz = Math.min(22, Math.floor(22 * (b.w - 32) / lw('al_dm' + i, ds, { size: 22 })));
      lab('al_d' + i, ds, b.x + b.w / 2, b.y + 256, { size: dz, al: 0.5, col: '#9cc8ff' });
      lab('al_w' + i, o.id === 'bless' ? 'до конца этажа' : 'до конца забега', b.x + b.w / 2, b.y + 290, { size: 18, al: 0.5, col: C.dim });
      const cs = String(o.cost), cw = lw('al_c' + i, cs, { size: 28 }) + 40, cx = b.x + b.w / 2 - cw / 2;
      icon('crystal', cx, b.y + b.h - 62, 30); lab('al_c' + i, cs, cx + 40, b.y + b.h - 46, { size: 28, col: can ? '#9cc8ff' : '#8a6a5a' }); });
    button('al_leave', U.r[3], S.hover);
    refusal(S, W / 2, P.y + P.h - 124);
    lab('al_help', 'ЛКМ — принять дар · E или Esc — уйти', W / 2, P.y + P.h + 34, { size: 20, al: 0.5, col: '#8a7d6c' });
  }
  function end(S, t) {
    const r = S.result || {}, win = S.screen === 'win';
    L.solid(0, 0, W, H, win ? [0.03, 0.04, 0.06] : [0.05, 0.01, 0.01], 0, 0, 0, 0.92);
    lab('e_t', win ? 'ПОБЕДА' : 'ВЫ ПОГИБЛИ', W / 2, 150, { size: 100, al: 0.5, col: win ? C.gold : '#d8402a', out: '#1a0505' });
    lab('e_s', win ? 'Повелитель Демонов повержен, вы выбрались на поверхность' : 'Подземелье забрало ещё одного героя. Но души помнят…', W / 2, 228, { size: 28, al: 0.5, col: C.dim });
    const C2 = r.C || { floors: 0, foes: 0, kills: 0, lootN: 0, loot: 0, secN: 0, sec: 0, pct: 0 }, pc = (k, n) => Math.floor(100 * Math.min(1, k / n)) + '%';
    const runRows = [['Этаж', r.floor], ['Уровень', r.lvl], ['Время', fmtT(r.time || 0)], ['Собрано золота', r.gold], ['Убито монстров', r.kills]];
    const doneRows = [['Монстры', C2.foes ? C2.kills + ' из ' + C2.foes + ' · ' + pc(C2.kills, C2.foes) : '—'], ['Подобранные предметы', C2.lootN ? C2.loot + ' из ' + C2.lootN + ' · ' + pc(C2.loot, C2.lootN) : '—'],
      ['Тайные комнаты', C2.secN ? pc(C2.sec, C2.secN) : '—'], ['Этажей пройдено', C2.floors], ['Полнота', Math.round(100 * C2.pct) + '%']];
    const bx = W / 2 - 620, by = 280, colW = 600;
    panel('e_box', bx, by, 1240, 590, { r: 10 });
    lab('e_h1', 'Забег', bx + 30, by + 34, { size: 26, col: C.gold }); lab('e_h2', 'Полнота прохождения', bx + 650, by + 34, { size: 26, col: C.gold });
    runRows.forEach(([n, v], i) => { lab('e_n' + i, n, bx + 30, by + 80 + i * 40, { size: 24, col: C.dim }); lab('e_v' + i, v, bx + colW - 20, by + 80 + i * 40, { size: 24, al: 1 }); });
    doneRows.forEach(([n, v], i) => { const last = i === doneRows.length - 1; lab('e_cn' + i, n, bx + 650, by + 80 + i * 40, { size: 24, col: last ? C.text : C.dim });
      lab('e_cv' + i, v, bx + 1210, by + 80 + i * 40, { size: 24, al: 1, col: last ? C.gold : C.text }); });
    // the reward, line by line: what was found, the base payout, the thoroughness bonus with its formula, the total
    L.solid(bx + 30, by + 290, 1180, 1, C.rim, 0, 0, 0, 0.6);
    const base = r.base ?? r.bonus ?? 0, sb = r.statBonus || 0;
    const rew = [['Осколки, найденные в забеге', '+' + (r.found ?? (r.shards - base - sb))],
      ['Награда за забег: золото ÷ 80' + (r.win ? ' + ' + r.win + ' за победу' : ''), '+' + base],
      ['Бонус за полноту: ' + Math.round(100 * C2.pct) + '% от ' + (r.cap || 0) + ' (по 5 за каждый этаж)', '+' + sb]];
    rew.forEach(([n, v], i) => { lab('e_rn' + i, n, bx + 30, by + 330 + i * 44, { size: 24, col: C.dim }); lab('e_rv' + i, v, bx + 1210, by + 330 + i * 44, { size: 24, al: 1, col: '#9cc8ff' }); });
    L.solid(bx + 30, by + 488, 1180, 1, C.rim, 0, 0, 0, 0.6);
    lab('e_tn', 'Итого осколков душ', bx + 30, by + 530, { size: 30, col: C.text }); lab('e_tv', '+' + r.shards, bx + 1210, by + 530, { size: 30, al: 1, col: '#9cc8ff' });
    for (const b of D.UI.end()) button('eb_' + b.id, b, S.hover);
  }
})();
