// live/hud.js — every screen-space UI: the in-game HUD (portrait, HP/MP/XP, skill bar, stats, minimap, toasts, prompts,
// enemy bars, damage numbers), the hero screen (gear, bag, stats, skills, tooltips), menus, pause, death/victory, the altar of
// souls. Drawn after the grade at full resolution. Panels are sized to their content and registered for qa.mjs (L.uiBox).
(function () {
  const HUD = (window.HUD = {}), L = LIB, D = DATA, TILE = D.TILE;
  // H is the bottom of what is drawn now: the view's in play, the 1920×1080 frame's own past a window's shift (TASKS 1851), so a
  // line kept off the bottom by H stays on the screen's bottom edge; VH is always the view's
  let W = SIM.VIEW.W, H = SIM.VIEW.H, VH = H;
  const framed = (oy, fn) => { const o = G.oy, h = H; G.oy = oy; H = VH - oy; try { fn(); } finally { G.oy = o; H = h; } };
  const SZ = (n) => window.SIZES[n] || [G.tex(n).w, G.tex(n).h];
  const C = { panel0: [0.10, 0.085, 0.10], panel1: [0.055, 0.048, 0.06], rim: [0.42, 0.34, 0.27], rimHi: [0.62, 0.5, 0.36], gold: '#ffd76a', text: '#efe3cc', dim: '#a89a88', red: '#ff6a5a' };
  const MAP = { key: '', rec: null, cv: null, k: 3 };
  HUD.init = () => {};
  // a line of text broken into lines of at most `width` px
  const wrapLab = (id, s0, x, y, width, size, col) => { const lines = []; let line = '';
    for (const w of String(s0).split(' ')) { const next = line ? line + ' ' + w : w; if (line && lw(id + '_m', next, { size }) > width) { lines.push(line); line = w; } else line = next; }
    if (line) lines.push(line); lines.forEach((v, i) => lab(id + i, v, x, y + i * (size + 7), { size, col })); return lines.length * (size + 7); };
  // a C window's key hint sits on the scorched rim of its parchment: a pale backing keeps it at 4.5:1 and over (TASKS 1851)
  const hintC = (id, s, y) => { const w = lw(id, s, { size: 26 }) + 36; L.rrect(W / 2 - w / 2, y - 19, w, 38, 8, [0.89, 0.81, 0.65], [0.84, 0.75, 0.58], 0.92);
    lab(id, s, W / 2, y, { size: 26, al: 0.5, col: INK.t }); };
  const wrapWords = (s, width, size) => { const out = []; let line = '';
    for (const w of String(s).split(' ')) { const next = line ? line + ' ' + w : w; if (line && L.labelW(0, next, { size }) > width) { out.push(line); line = w; } else line = next; }
    if (line) out.push(line); return out; };
  const hex = (c) => '#' + c.map((v) => Math.round(Math.min(1, v) * 255).toString(16).padStart(2, '0')).join('');
  const lab = (id, s, x, y, o = {}) => L.label(id, String(s), x, y, Object.assign({ size: 26, col: C.text, out: Object.values(INK).includes(o.col) ? '' : '#140c0c' }, o));
  // a class drawn on its own rig has its own portrait (TASKS 1114)
  const portraitOf = (h) => { const r = D.clsOf(h).look.rig; return r !== 'hero' && window.ASSETS['portrait_' + r] ? 'portrait_' + r : 'portrait'; };
  // the corners the HUD panels cover: the portrait and bars, the boss bar, the minimap
  // (the minimap's corner is its panel's, legend and all: a fixed 440 px let labels slip under the taller one of a big map, TASKS 432)
  let MMB = null, TRK = null;
  const WAY_LEG = ['way', TXT('WAY_LEG')];
  // the town's own legend (TASKS 1023): its services instead of the dungeon's rooms, bosses and altars
  const TOWN_LEG = [['you', TXT('TOWN_LEG')], ['exit', TXT('TOWN_LEG.2')], ['shop', TXT('TOWN_LEG.3')], ['camp', TXT('TOWN_LEG.4')], ['altar', TXT('TOWN_LEG.5')], ['stash', TXT('TOWN_LEG.6')], ['craft', TXT('TOWN_LEG.7')], ['way', TXT('TOWN_LEG.8')], ['board', TXT('TOWN_LEG.9')]];
  // a quest's goal on this floor (TASKS 1019–1021) adds its own line
  const QUEST_LEG = ['quest', TXT('QUEST_LEG')];
  // (the magma's map is mostly lava and chasm, TASKS 490: the legend named neither)
  const MAGMA_LEG = [['lava', TXT('MAGMA_LEG')], ['chasm', TXT('MAGMA_LEG.2')]];
  // the town's shop shut till its merchant is brought home says so in the legend (TASKS 1853 з)
  const SHOP_SHUT_LEG = ['shop', TXT('TOWN_LEG.shut')], townLeg = (R) => (SIM.Q.shopShut(R) ? TOWN_LEG.map((q) => (q[0] === 'shop' ? SHOP_SHUT_LEG : q)) : TOWN_LEG);
  const legendOf = (R) => (R.map.town ? townLeg(R) : LEGEND.concat(R.map.cliff ? MAGMA_LEG : [], R.map.way ? [WAY_LEG] : [], SIM.Q.questMarks(R).length ? [QUEST_LEG] : []));
  const LEGEND = [['you', TXT('LEGEND')], ['room', TXT('LEGEND.2')], ['gold', TXT('LEGEND.3')], ['boss', TXT('LEGEND.4')], ['exit', TXT('LEGEND.5')], ['shop', TXT('LEGEND.6')], ['camp', TXT('LEGEND.7')], ['altar', TXT('LEGEND.8')], ['altar_used', TXT('LEGEND.9')]];
  const underHud = (x, y) => (MMB ? x > MMB[0] - 4 && y < MMB[1] + MMB[3] + 4 : x > W - 260 && y < 440) || (TRK && x > TRK[0] - 4 && y > TRK[1] - 4 && y < TRK[1] + TRK[3] + 4) || (x < HB.x + HB.w + 12 && y < 316) || (y < 150 && x > 500 && x < 1420) || (y > H - 56 && x > W - 40 - lw('keys', TXT('hud.hud.k'), { size: 26 }));
  const lw = (id, s, o = {}) => L.labelW(id, String(s), Object.assign({ size: 26 }, o));
  // the dark burnt sheet of the talk, the journal, the board and the notes (TASKS 1329): ink on paper, not the panels' light text on dark
  const INK = { t: '#2a1a10', d: '#4a2e1b', r: '#7d1e12', g: '#4d2c08' };
  const parch = (id, P, wide) => { const px = wide ? 36 : 56, py = wide ? 26 : 50; L.sprite(wide ? 'ui_parchment_w' : 'ui_parchment_t', P.x - px, P.y - py, { w: P.w + px * 2, h: P.h + py * 2 }); L.uiBox(id, P.x, P.y, P.w, P.h); };
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
    lab(id + '_l', b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, { size: L.sizeToFit(b.label, b.w - 8, 30), al: 0.5, col: on ? (hv ? '#fff2c8' : C.text) : '#6d6258' });
  }
  const dim = (a = 0.62) => L.solid(0, -G.oy, W, VH, [0, 0, 0], 0, 0, 0, a);
  const fmtT = (s) => { s = Math.floor(s); const p2 = (n) => String(n).padStart(2, '0'); return Math.floor(s / 3600) + ':' + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60); };

  // what a number or a cell is, under the pointer in the pause and on the hero's page (TASKS 1852): rects [x, y, w, h, title, line]
  // in the pause the note hangs under the HUD's left column and left of the pause window, so it covers none of their lines
  let TIPS = [], TIPY = 0;
  // line: one line or several (TASKS 1847: what a point or a rank gives, a line a change); over the hero's page the stats' and the
  // skills' notes show under a lit «+» or card, an item's own card under a cell
  const tipAt = (x, y, w, h, title, line) => TIPS.push([x, y, w, h, title, line || '']);
  function drawTip(S) { if (!S.ptr || !(S.screen === 'pause' || S.screen === 'inv') || (S.screen === 'inv' && /^(bag|eq):/.test(S.hover || ''))) return; if (S.screen === 'inv') { framed(D.uiDy('inv', VH), () => tipIn(S, (S.uiPtr || S.ptr)[0], S.uiPtr ? S.uiPtr[1] : S.ptr[1] - G.oy)); return; } tipIn(S, S.ptr[0], S.ptr[1]); }
  function tipIn(S, px, py) { const T = TIPS.find(([x, y, w, h]) => px >= x && px < x + w && py >= y && py < y + h); if (!T) return;
    const [, , , , title, line] = T, ls = [].concat(line).filter(Boolean), w = Math.max(lw('tip_t', title, { size: 24 }), ...ls.map((q, i) => lw('tip_l' + i, q, { size: 20 }))) + 32, h = 46 + 28 * ls.length, inPause = S.screen === 'pause',
      x = Math.max(8, Math.min((inPause ? 650 : W) - w - 8, px + 20)), y = inPause ? TIPY : Math.max(8, Math.min(H - h - 8, py + 22));
    L.uiCover('hud_tipc', x, y, w, h); plate('hud_tip', x, y, w, h, { k: 0.3, grade: [1, 0.8, 0, 1.02] }); lab('tip_t', title, x + 16, y + 23, { size: 24, col: C.gold }); ls.forEach((q, i) => lab('tip_l' + i, q, x + 16, y + 52 + 28 * i, { size: 20, col: C.text })); }
  HUD.draw = (S, t, V) => {
    G.bind(null); G.blend(); MMB = null; TRK = null; TIPS = []; W = SIM.VIEW.W; VH = H = SIM.VIEW.H; G.oy = 0;
    const R = S.run;
    if (S.demo) { title(S, t); return; }
    if (R && V) world(S, R, t, V);
    if (R && (S.screen === 'play' || S.screen === 'pause')) hud(S, R, t);
    if (R && V && S.screen === 'play') souls(S, R, V);
    framed(D.uiDy(S.screen, VH), () => windows(S, R, t, V));
    if (R && S.debug && S.screen === 'play' && !S.demo) { if (S.dbgLoot && V) lootMarks(R, t, V); for (const b of D.UI.debug(R, S)) button('dbg_' + b.id, b, S.hover); lab('dbg_tag', TXT('hud.draw'), W / 2, 92, { size: 20, al: 0.5, col: C.text }); if (S.dbgLoot) lootBooks(R); }
    if (!S.demo) muteNote(S);
    drawTip(S);
  };
  function windows(S, R, t) {
    if (S.screen === 'menu') menu(S, t);
    if (S.screen === 'uikit') KIT.sheet();
    if (S.screen === 'settings') settings(S, t);
    if (S.screen === 'stats') stats(S, t);
    if (S.screen === 'load') load(S, t);
    if (S.screen === 'tests') tests(S, t);
    if (S.screen === 'classes') classes(S, t);
    if (S.screen === 'codex') codex(S, t);
    if (S.screen === 'fork' && R) fork(S, R, t);
    if (S.screen === 'news') news(S, t);
    if (S.screen === 'meta') meta(S, t);
    if (S.screen === 'pause') pause(S);
    if (S.screen === 'inv' && R) inv(S, R, t);
    if (S.screen === 'shop' && R) shop(S, R, t);
    if (S.screen === 'altar' && R) altar(S, R, t);
    if (S.screen === 'gate' && R) gate(S, R, t);
    if (S.screen === 'leave' && R) leave(S, R);
    if (S.screen === 'stash' && R) stash(S, R, t);
    if (S.screen === 'craft' && R) craft(S, R, t);
    if (S.screen === 'talk' && R && S.talk) talk(S, R, t);
    if (S.screen === 'journal' && R) journal(S, R, t);
    if (S.screen === 'note' && S.note) note(S);
    if (S.screen === 'notes') notes(S);
    if (S.screen === 'board' && R) board(S, R, t);
    if (S.screen === 'dead' || S.screen === 'win') end(S, t);
  }

  // M's answer (TASKS 1853 а): a plate for a few seconds on whatever screen it was pressed, and while muted a speaker crossed out by
  // the key hints in play, so a silent game is never a mystery
  function muteNote(S) {
    const a = S.t - (S.muteT ?? -1e9);
    if (a < 2.6) { const s = S.meta.mute ? TXT('hud.mute.off') : TXT('hud.mute.on'), al = 1 - L.SS(2, 2.6, a), w = lw('mute_n', s, { size: 24 }) + 48;
      plate('mute_box', W / 2 - w / 2, H - 170, w, 50, { a: 0.92 * al }); lab('mute_n', s, W / 2, H - 145, { size: 24, al: 0.5, col: S.meta.mute ? '#ffb0a0' : C.gold, a: al }); }
    if (S.meta.mute && S.screen === 'play') speakerOff(W - 34, H - 90); }
  function speakerOff(x, y) { plate('mute_ic', x - 26, y - 22, 52, 44, { a: 0.85 }); const c = [0.85, 0.78, 0.66];
    L.solid(x - 14, y - 5, 7, 10, c); for (let i = 0; i < 7; i++) L.solid(x - 7 + i, y - 5 - i, 1, 10 + i * 2, c);
    for (let i = 0; i < 13; i++) { L.solid(x + 3 + i * 0.9, y - 6 + i, 3, 2, [0.95, 0.42, 0.35]); L.solid(x + 3 + i * 0.9, y + 6 - i, 3, 2, [0.95, 0.42, 0.35]); } }

  // ---------------- attract title over the demo ----------------
  function title(S, t) {
    L.solid(0, 0, W, 200, [0, 0, 0], 0, 0, 0, 0.35);
    lab('tt', TXT('hud.title'), W / 2, 92, { size: 92, al: 0.5, col: C.gold, out: '#2a0d06', bold: true });
    lab('tsb', TXT('hud.title.sub'), W / 2, 164, { size: 40, al: 0.5, col: '#e8c890', out: '#2a0d06' });
    lab('ts', TXT('hud.title.2'), W / 2, 214, { size: 28, al: 0.5, col: C.dim });
    const a = 0.55 + 0.45 * Math.sin(t * 3);
    lab('tp', TXT('hud.title.3'), W / 2, H - 90, { size: 34, al: 0.5, a });
  }

  // ---------------- world-space overlays: monster bars, damage numbers, prompts ----------------
  // the concept's enemy bar: a capsule with a pale rim and a red heart ball on its left end
  function capsule(x, y, w, f, elite, quiet = false) {
    const x0 = x - w / 2, fill = elite ? [[1, 0.62, 0.16], [0.66, 0.28, 0.04]] : [[0.88, 0.1, 0.06], [0.54, 0.04, 0.03]];
    if (quiet) {
      L.rrect(x0, y + 2, w, 8, 3, [0.05, 0.04, 0.05], [0.03, 0.025, 0.03], 0.6);
      const fw = Math.max(0, Math.min(1, f)) * (w - 4);
      if (fw > 1) L.rrect(x0 + 2, y + 4, fw, 4, 2, ...fill, 0.6);
      return;
    }
    L.rrect(x0 - 2, y - 2, w + 4, 16, 8, [0.79, 0.77, 0.75], [0.46, 0.43, 0.42], 0.95);
    L.rrect(x0, y, w, 12, 6, [0.05, 0.04, 0.05], [0.03, 0.025, 0.03]);
    const fw = Math.max(0, Math.min(1, f)) * (w - 14); if (fw > 1) L.rrect(x0 + 10, y + 3, fw, 6, 3, ...fill);
    L.rrect(x0 - 5, y - 3, 18, 18, 9, [0.12, 0.05, 0.04], [0.12, 0.05, 0.04]);
    L.rrect(x0 - 3, y - 1, 14, 14, 7, [1, 0.3, 0.18], [0.62, 0.04, 0.03]);
    L.rrect(x0, y + 1, 4, 4, 2, [1, 0.9, 0.85], [1, 0.9, 0.85], 0.85);
  }
  function world(S, R, t, V) {
    MMB = mmBox(S, R); TRK = trkBox(S, R);
    const GT = S.t, h = R.hero, m = R.map, seen = (x, y) => R.seen[Math.floor(y / TILE) * m.W + Math.floor(x / TILE)];
    const k = V.k || 1, actorZones = [{ x: V.sx(h.x) - 30 * k, y: V.sy(h.y) - 84 * k, w: 60 * k, h: 90 * k }];
    for (const e of R.en) if (e.deadT < 0 && e.st !== 'lurk' && !D.under(e) && seen(e.x, e.y)) {
      const [w, hh] = SZ(D.BOSSES[e.type] ? 'en_' + (D.BOSSES[e.type].rig || 'brute') : D.ENEMIES[e.type].tex || 'en_' + e.type), scale = (D.BOSSES[e.type] ? (D.BOSSES[e.type].scale || 1.6) : e.elite ? 1.3 : 1) * k;
      actorZones.push({ x: V.sx(e.x) - w * scale / 2, y: V.sy(e.y) - hh * scale, w: w * scale, h: hh * scale + 6 });
    }
    const occupied = [], nameZones = [], overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const place = (x, y, w, hh, extra = []) => {
      const b = { x: Math.round(Math.max(4, Math.min(W - w - 4, x - w / 2))), y, w, h: hh };
      for (let i = 0; i <= occupied.length + extra.length; i++) {
        const hits = occupied.concat(extra).filter((o) => overlaps(b, o));
        if (!hits.length) {
          if (b.y < 4 || b.y + b.h > H - 4 || [[b.x, b.y], [b.x + w, b.y], [b.x, b.y + hh], [b.x + w, b.y + hh]].some(([px, py]) => underHud(px, py))) return null;
          occupied.push(b); return b;
        }
        b.y = Math.min(...hits.map((o) => o.y)) - hh - 4;
      }
      return null;
    };
    const float = (id, s, x, y, o) => {
      const w = lw(id, s, o) + 8, hh = Math.max(20, o.size) * 1.24 + 8, b = place(x, y - hh / 2, w, hh, nameZones.concat(actorZones));
      if (b) lab(id, s, b.x + w / 2, b.y + hh / 2, { ...o, al: 0.5 });
    };
    if (m.shop && R.shop && GT >= R.shop.hitT && GT - R.shop.hitT < 2.5 && seen(m.shop.x, m.shop.y) && S.screen === 'play') {
      const s = (R.shop.wander ? D.SHOP.wander.hit : D.SHOP.hitLines)[R.shop.hitLine || 0], size = 22, w = lw('merchant_hit', s, { size }) + 28;
      const b = place(V.sx(m.shop.x), V.sy(m.shop.y) - SZ('merchant')[1] * k - 60, w, 42, actorZones);
      if (b) { plate('merchant_bubble', b.x, b.y, w, 42); lab('merchant_hit', s, b.x + w / 2, b.y + 22, { size, al: 0.5, col: C.gold }); }
    }
    // a townsman's quest business over his head (TASKS 1018): ! a quest to take, ? one to turn in; his lines keep above it
    // the one the hero stands by shows his prompt in its place (TASKS 1026: the prompt, pushed off his own mark, landed by the Keeper's)
    const talkTo = S.screen === 'play' ? SIM.Q.folkNear(R) : null;
    if (m.town && R.folk && (S.screen === 'play' || S.screen === 'pause')) for (const f of R.folk) { const mk = SIM.Q.questMark(R, f.role); if (!mk || f === talkTo) continue;
      // a giver whose feet are on screen keeps his mark inside it, his head may be past the edge (TASKS 1025)
      if (V.sx(f.x) < 0 || V.sx(f.x) > W || V.sy(f.y) < 0 || V.sy(f.y) > H) continue;
      let x = Math.min(W - 20, Math.max(20, V.sx(f.x))); const y = Math.max(26, V.sy(f.y) - SZ('town_' + f.role)[1] * k - 30 + 4 * Math.sin(GT * 3 + f.i)), col = mk === '?' ? [1, 0.86, 0.3] : [1, 0.62, 0.18];
      // under the HUD's plate the mark steps out to its right edge, still at the giver's height
      if (x < HB.x + HB.w + 24 && y < HB.y + HB.h + 24) x = HB.x + HB.w + 24;
      G.blend('add'); L.glow(x, y, 46, col, 0.35 + 0.1 * Math.sin(GT * 4 + f.i)); G.blend();
      L.rrect(x - 17, y - 20, 34, 40, 12, [0.09, 0.06, 0.05], [0.05, 0.035, 0.03], 0.82);
      lab('qmk' + f.i, mk, x, y + 1, { size: 34, al: 0.5, col: mk === '?' ? '#ffe070' : '#ffb040' });
      actorZones.push({ x: x - 20, y: y - 24, w: 40, h: 48 }); nameZones.push({ x: x - 22, y: y - 26, w: 44, h: 52 }); }
    // the townsfolk's lines (TASKS 1015): a pair, the first line then the second, over the speaker's head; the merchant's call
    const bubble = (id, s, x, y) => { const size = 20, w = lw(id, s, { size }) + 28, b = place(x, y, w, 40, actorZones);
      if (b) { plate(id + '_b', b.x, b.y, w, 40); lab(id, s, b.x + w / 2, b.y + 21, { size, al: 0.5, col: '#fff2c8' }); nameZones.push({ x: b.x, y: b.y, w, h: 40 }); } };   // the prompt keeps off a line being said (TASKS 1013)
    if (m.town && R.folk && S.screen === 'play') for (const f of R.folk) { const FD = D.FOLK[f.role]; if (!FD.lines || !f.near || GT < f.sayT || GT - f.sayT >= D.FOLK_SAY) continue;
      bubble('folk' + f.i, (f.sayS || FD.lines[f.sayN])[GT - f.sayT < D.FOLK_SAY / 2 ? 0 : 1], V.sx(f.x), V.sy(f.y) - SZ('town_' + f.role)[1] * k - 48); }
    // a townsman struck by the hero's blow says so (TASKS 1033), over whatever he was saying
    if (m.town && R.folk && S.screen === 'play') for (const f of R.folk) if (f.role !== 'hen' && GT - (f.hitT ?? -9) < 1.6) bubble('ouch' + f.i, SIM.FOLK_OUCH[f.ouch || 0], V.sx(f.x), V.sy(f.y) - SZ('town_' + f.role)[1] * k - 92);
    if (!R.town && S.screen === 'play') for (const C of Object.values(R.captives || {})) { if (C.x === undefined || R.floor !== D.CAPTIVES[C.who].f || (R.freed && R.freed[C.who]) || Math.hypot(C.x - h.x, C.y - h.y) > 320 || !seen(C.x, C.y)) continue; const cg = D.CAPTIVES[C.who].caged; bubble('cap_' + C.who, cg[Math.floor(GT / 5) % cg.length], V.sx(C.x), V.sy(C.y) - 150 * k); }
    if (m.town && m.shop && R.shop && GT - (R.shop.callT ?? -99) < 3 && S.screen === 'play') bubble('merchant_call', D.SHOP.calls[R.shop.callN || 0], V.sx(m.shop.x), V.sy(m.shop.y) - SZ('merchant')[1] * k - 60);
    const bars = [], fadeIn = S.ev.some((v) => v.k === 'floor' && GT - v.t < 0.9);
    // in rock a body is void: no label over nothing; nor over the black a new floor fades in from (TASKS 1724)
    for (const e of R.en) { if (fadeIn || e.deadT >= 0 || e.st === 'lurk' || D.under(e) || !!D.BOSSES[e.type] || !seen(e.x, e.y) || !SIM.Q.cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) continue; const x = V.sx(e.x), y = V.sy(e.y) - (SZ(D.ENEMIES[e.type].tex || 'en_' + e.type)[1] * (e.elite ? 1.3 : 1) + 16) * (V.k || 1);
      if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
      let named = false;
      // an elite's name, its powers first, in the colour of its first power
      if (S.screen !== 'shop' && e.elite && (e.title || (e.mods && e.mods.length))) { const c = e.title ? [1, 0.82, 0.4] : D.ELITE_MODS.find((m) => m.id === e.mods[0]).col, s = D.eliteName(e), hw = lw('el' + (e.id % 40), s, { size: 18 }) / 2 + 4, ly = y - 24;
        const sub = e.nm && e.mods && e.mods.length ? e.mods.map((id) => D.ELITE_MODS.find((m) => m.id === id).name).join(', ') : '', ow = Math.max(hw, sub ? lw('els' + (e.id % 40), sub, { size: 20 }) / 2 + 6 : 0), oy = sub ? ly + 50 : ly;
        if (x - ow > 0 && x + ow < W && ly > 30 && ![[x - ow, ly - 24], [x + ow, ly - 24], [x - ow, oy], [x + ow, oy]].some(([px, py]) => underHud(px, py))) {
          // (place() may move the label up under a panel: it is checked where it lands, TASKS 432's zone_magma)
          const b0 = place(x, ly - 15, Math.max(ow * 2, 92), sub ? 70 : 54, actorZones), b = b0 && ![[b0.x, b0.y], [b0.x + b0.w, b0.y], [b0.x, b0.y + b0.h], [b0.x + b0.w, b0.y + b0.h]].some(([px, py]) => underHud(px, py)) ? b0 : null;
          if (b) {
            const cx = b.x + b.w / 2;
            // a plate: on lava the name's own colour was 1.1:1; at 0.62 it was still 2.5–2.9:1 for the dark reds and blues (TASKS 487),
            // so it is near solid and the name a quarter toward white: 4.5:1 and over on the brightest lava
            L.rrect(cx - hw, b.y - 2, hw * 2, 24, 8, [0.05, 0.04, 0.05], [0.03, 0.025, 0.03], 0.9);
            lab('el' + (e.id % 40), s, cx, b.y + 15, { size: 18, al: 0.5, col: hex(c.map((v) => v + (1 - v) * 0.25)) });
            capsule(cx, b.y + 39, 80, e.hp / e.max, true);
            if (sub) { const sw = lw('els' + (e.id % 40), sub, { size: 20 }) / 2 + 6; L.rrect(cx - sw, b.y + 49, sw * 2, 22, 8, [0.05, 0.04, 0.05], [0.03, 0.025, 0.03], 0.85); lab('els' + (e.id % 40), sub, cx, b.y + 60, { size: 20, al: 0.5, col: hex(c.map((v) => v + (1 - v) * 0.4)) }); }
            nameZones.push({ x: cx - hw - 20, y: b.y - 20, w: hw * 2 + 40, h: 70 });
            named = true;
          }
        }
      }
      if (!named && (e.hp < e.max || e.elite)) bars.push({ e, x, y });
    }
    for (const { e, x, y } of bars.sort((a, b) => b.e.elite - a.e.elite)) {
      const w = e.elite ? 80 : 64, b = place(x, y - 3, w + 12, 18, actorZones);
      if (!b) continue;
      const quiet = !e.elite && R.en.some((o) => o.elite && o.deadT < 0 && Math.hypot(o.x - e.x, o.y - e.y) < 160);
      capsule(b.x + b.w / 2, b.y + 3, w, e.hp / e.max, e.elite, quiet);
    }
    // the "!" when a monster notices the hero
    for (const [i, ev] of S.ev.entries()) { const a = GT - ev.t; if (a < 0 || !seen(ev.x, ev.y) || V.sx(ev.x) < -50 || V.sx(ev.x) > W + 50 || V.sy(ev.y) < -50 || V.sy(ev.y) > H + 150) continue;
      if (ev.k === 'alert' && a < 0.7 && !R.en.some((e) => e.id === ev.id && e.deadT >= 0)) float('al' + i, '!', V.sx(ev.x), V.sy(ev.y) - 20 * L.SS(0, 0.15, a), { size: 34, col: '#ffd040', a: 1 - L.SS(0.5, 0.7, a) });
      if (ev.k === 'hit' && a < 0.8) { const q = a / 0.8, s = Math.round((ev.crit ? 32 : 19) * (1 + 0.3 * L.SS(0, 0.08, a) - 0.3 * L.SS(0.08, 0.2, a)));
        const E = D.ENEMIES[ev.type], side = ev.x < h.x ? -1 : 1, hx = ev.x + side * (E ? 14 : 0), hy = ev.y - (E ? E.h * 0.5 + 18 : 0);   // over the head and its HP bar, leaning away from the hero: the chest stays clear
        float('dn' + i, String(Math.round(ev.n)), V.sx(hx) + (L.rnd(ev.t, 1) - 0.5) * 12, V.sy(hy) - 40 * q - 10, ev.arm ? { size: Math.round(s * 0.85), col: '#aab6c2', out: '#141a20', a: 1 - L.SS(0.6, 0.8, a) }
          : { size: s, col: ev.crit ? '#f4ead2' : ev.fire ? '#ffa05a' : '#e5281c', out: '#1a0503', a: 1 - L.SS(0.6, 0.8, a) });
        if (ev.crit && !ev.arm) float('cr' + i, TXT('hud.crit'), V.sx(hx), V.sy(hy) - 40 * q - 58, { size: Math.round(36 * (1 + 0.2 * L.SS(0, 0.08, a) - 0.2 * L.SS(0.08, 0.2, a))), col: '#ff5a38', out: '#1a0503', a: 1 - L.SS(0.6, 0.8, a) }); }
      // a burn's ticks show as one number running up (TASKS 463): only its latest tick is drawn, with the burn's sum so far
      if (ev.k === 'hurt' && a < 0.8 && !(ev.chain !== undefined && S.ev.some((o, j) => j > i && o.k === 'hurt' && o.chain === ev.chain))) {
        const s = '-' + Math.round(ev.chain !== undefined ? ev.sum : ev.n), offset = 30 * k + lw('hu' + i, s, { size: 30 }) / 2 + 12 + 14 * a / 0.8;
        float('hu' + i, s, V.sx(ev.x) + (ev.side || h.hurtX || -1) * offset, V.sy(ev.y) - 24 * (a / 0.8), { size: 30, col: '#fff4ee', out: '#9b211e', a: 1 - L.SS(0.6, 0.8, a) });
      }
      if (ev.k === 'gold' && a < 0.9) { const x0 = V.sx(ev.x), y0 = V.sy(ev.y) - 100 - 16 * L.SS(0, 0.15, a), q = L.SS(0.15, 0.85, a), tx = currencies(S, R)[0][3] + 20;   // up off the head, then into the counter
        lab('gd' + i, '+' + ev.n, x0 + (tx - x0) * q, y0 + (HB.y + HB.h + 27 - y0) * q, { size: 24 - 6 * q, al: 0.5, col: C.gold, a: 1 - L.SS(0.75, 0.9, a) }); }
      if (ev.k === 'dodge' && a < 0.7) float('dg' + i, TXT('hud.world'), V.sx(ev.x), V.sy(ev.y) - 70 - 30 * a, { size: 22, col: '#d8e6f0', a: 1 - a / 0.7 });
      if (ev.k === 'absorb' && a < 0.7) float('ab' + i, TXT('hud.world.2', { p1: Math.round(ev.n) }), V.sx(ev.x), V.sy(ev.y) - 70 - 30 * a, { size: 22, col: '#8fc4ff', a: 1 - a / 0.7 }); }
    // a pickup, a new level or a new skill also says so over the hero's head, where the eye is in a fight; the feed in the corner
    // keeps the history (TASKS 1852)
    S.ev.filter((e) => (e.k === 'pickup' || e.k === 'lvl' || e.k === 'unlock') && GT - e.t >= 0 && GT - e.t < 1.4).slice(-3).forEach((e, i) => { const a = GT - e.t;
      const s = e.k === 'pickup' ? '+ ' + e.s : e.k === 'lvl' ? TXT('hud.float.lvl') : D.ABILITIES.find((A) => A.id === e.id).name, col = e.k === 'pickup' ? hex(D.RARITY[e.rar || 0].col) : C.gold;
      float('fb' + i, s, V.sx(h.x), V.sy(h.y) - 84 * k - 34 - 24 * L.SS(0, 0.4, a), { size: 24, col, a: L.SS(0, 0.08, a) * (1 - L.SS(1.0, 1.4, a)) }); });
    // the short names of the items lying by the hero (TASKS 1853 ж), stacked up where two would meet; a thrown-away one under its prompt
    const tz = S.screen === 'play' ? SIM.Q.tossedNear(R) : null;
    if (S.screen === 'play' && h.deadT < 0) { const tags = [];
      for (const p of R.drops) { if (p.kind !== 'item' || p.got || p.fly > 0 || p.z > 0 || p === tz || Math.hypot(p.x - h.x, p.y - h.y) > 150 || !seen(p.x, p.y) || SIM.Q.hidden(m, p)) continue;
        const s = SIM.Q.itemName(p.item), w = lw('ln_w', s, { size: 20 }) + 18; let x = V.sx(p.x) - w / 2, y = V.sy(p.y) - 46 * k;
        for (let n = 0; n < 6 && tags.some((o) => x < o.x + o.w && x + w > o.x && y < o.y + 28 && y + 28 > o.y); n++) y -= 30;
        tags.push({ x, y, w, s, c: hex(D.RARITY[p.item.rar || 0].col), id: p.id }); }
      for (const g of tags) { plate('ln_b' + g.id, g.x, g.y, g.w, 28, { a: 0.8 }); lab('ln_' + g.id, g.s, g.x + g.w / 2, g.y + 15, { size: 20, al: 0.5, col: g.c }); } }
    // interaction prompt
    let pr = null; HUD.promptBox = null;
    const ch = R.chests.find((c) => !c.open && Math.hypot(c.x - h.x, c.y - h.y) < 56 && !SIM.Q.overLava(m, h.x, h.y, c.x, c.y)); if (ch) { const bz = ch.sealed && R.en.find((e) => D.BOSSES[e.type] && e.deadT < 0); pr = [ch.x, ch.y - 74, !ch.sealed ? TXT('hud.world.3') : bz ? TXT('hud.world.3s', { name: D.ENEMIES[bz.type].name }) : TXT('hud.world.3s.anon')]; }
    const sh = R.shrines.find((s) => Math.hypot(s.x - h.x, s.y - h.y) < 60 && (!s.used || SIM.Q.canDonate(R))); if (sh) pr = [sh.x, sh.y - 78, sh.used ? TXT('hud.world.4') : TXT('hud.world.5')];
    if (SIM.Q.atCounter(R)) pr = [m.shop.front.x, m.shop.front.y + 62, SIM.Q.shopShut(R) ? TXT('hud.world.shut') : TXT('hud.world.6')];
    const noteP = SIM.Q.noteNear(R); if (noteP) pr = [noteP.x, noteP.y - 40, TXT('hud.world.note')];
    const capP = SIM.Q.captiveNear(R); if (capP) pr = [capP.x, capP.y - 122, TXT('hud.world.captive')];
    if (SIM.Q.craftShut(R)) pr = [h.x, h.y - 110, TXT('hud.world.note')];
    const dr = SIM.Q.doorNear(R, 64); if (dr) { const lk = SIM.Q.doorLock(m, dr); pr = [dr.x, dr.y - (dr.dir === 'u' ? 110 : dr.dir === 'd' ? 60 : 130), !lk ? TXT('hud.world.7') : lk.kind === 'key' ? (R.keys > 0 ? TXT('hud.world.8') : TXT('hud.world.9')) : TXT('hud.world.10')]; }
    const lv = SIM.Q.leverNear(R); if (lv) pr = [lv.lever.x, lv.lever.y - 30, TXT('hud.world.11')];
    { const q = SIM.Q.secretUnder(R), z = SIM.Q.puzzleNear(R); if (q) pr = q.kind === 'banner' ? [q.x, q.y - 76, TXT('hud.world.banner')] : q.kind === 'shelf' ? [q.x, q.y - 100, TXT('hud.world.shelf')] : q.kind === 'statue' ? [q.x, q.y - 110, TXT('hud.world.statue')] : q.trig.k === 'sconce' ? [m.torches[q.trig.t].x, m.torches[q.trig.t].y - 30, TXT('hud.world.sconce')] : [q.trig.x, q.trig.y - 30, TXT('hud.world.11')];
      if (z) { const it = z.q.pz.items[z.i]; pr = z.q.pz.k === 'levers' ? [it.x, it.y - 30, TXT('hud.world.11')] : [it.x, it.y - 44, TXT('hud.world.candle')]; } }
    if (m.down && Math.hypot(m.down.x - h.x, m.down.y - h.y) < 60) pr = [m.down.x, m.down.y - 66, R.campaignWon ? TXT('hud.world.17', { p1: m.floor + 1 }) : R.bossDead ? TXT('hud.world.12') : TXT('hud.world.13')];
    if (SIM.Q.exitKind(R, m.floor) !== null && Math.hypot(m.exit.x - h.x, m.exit.y - h.y) < 60) pr = [m.exit.x, m.exit.y - 66, SIM.Q.exitKind(R, m.floor) === 'portal' ? (R.bossDead ? TXT('hud.world.14') : TXT('hud.world.15')) : m.town ? TXT('hud.world.16') : TXT('hud.world.17', { p1: m.floor + 1 })];
    { const g = SIM.Q.gateNear(R); if (g) pr = [g.x, g.y - 80, TXT('hud.world.18')]; }
    // back up the stairs (TASKS 1027) and the town's portal back down (1007)
    if (m.up && Math.hypot(m.up.x - h.x, m.up.y - h.y) < 56) pr = [m.up.x, m.up.y - 70, m.floor === 1 ? TXT('hud.world.19') : TXT('hud.world.20', { p1: m.floor - 1 })];
    { const cw = SIM.Q.atCraft(R); if (cw) { const P = m.town.svc[cw === 'forge' ? 'anvil' : 'lectern'], who = cw === 'forge' ? 'smith' : 'enchanter', mk = SIM.Q.questMark(R, who); pr = [P.x, P.y - 96, (mk === '?' ? TXT('hud.world.31') : mk === '!' ? TXT('hud.world.32') : TXT('hud.world.33')) + D.FOLK[who].name, cw === 'forge' ? TXT('hud.world.22') : TXT('hud.world.23')]; } }
    if (SIM.Q.atStash(R)) pr = [m.town.svc.stash.x, m.town.svc.stash.y - 74, TXT('hud.world.24')];
    if (m.town && SIM.Q.atBoard(R)) pr = [m.town.svc.board.x, m.town.svc.board.y - 86, TXT('hud.world.25')];
    if (SIM.Q.atSoulAltar(R)) pr = [m.town.svc.altar.x, m.town.svc.altar.y - 84, TXT('hud.world.26')];
    if (SIM.Q.atExitGate(R)) pr = [m.town.svc.exitGate.x, m.town.svc.exitGate.y - 110, TXT('hud.world.gate')];
    if (SIM.Q.atGate(R)) { const o = SIM.Q.gateWays(R); pr = [m.town.svc.portal.x, m.town.svc.portal.y - 80, o.length > 1 ? (R.portal ? TXT('hud.world.27') : TXT('hud.world.28')) : o[0].k === 'portal' ? TXT('hud.world.29', { f: o[0].f }) : TXT('hud.world.30', { f: o[0].f })]; }
    if (!pr && S.screen === 'play') { const f = SIM.Q.folkNear(R); if (f) { const mk = SIM.Q.questMark(R, f.role); pr = [f.x, f.y - SZ('town_' + f.role)[1] - 40, (mk === '?' ? TXT('hud.world.31') : mk === '!' ? TXT('hud.world.32') : TXT('hud.world.33')) + D.FOLK[f.role].name, D.FOLK[f.role].job]; } }
    if (!pr && tz) pr = [tz.x, tz.y - 46, TXT('hud.world.take', { p1: SIM.Q.itemName(tz.item) })];
    if (!pr && S.screen === 'play' && m.town && !SIM.Q.gateWays(R).length && Math.hypot(m.town.svc.portal.x - h.x, m.town.svc.portal.y - h.y) < 64) pr = [m.town.svc.portal.x, m.town.svc.portal.y - 80, TXT('hud.world.ring')];
    // the plate sits just above its target's sprite; it never covers the hero: when it would, it goes above his head too, and
    // when that leaves the screen, to the bottom of the screen (TASKS 134)
    if (pr && S.screen === 'play' && !(R.leaving > 0) && !SIM.Q.greetHold(R) && !S.ev.some((e) => e.k === 'floor' && S.t - e.t < 0.5)) { const s = pr[2], sub = pr[3], bh = sub ? 64 : 40, w = Math.max(lw('prompt', s, { size: 24 }), sub ? lw('prompt_j', sub, { size: 20 }) : 0) + 28; let x = V.sx(pr[0]) - w / 2, y = V.sy(pr[1]) - 20;
      const hx0 = V.sx(h.x - 30), hx1 = V.sx(h.x + 30), hy0 = V.sy(h.y - 92), hy1 = V.sy(h.y + 6);
      if (x < hx1 && x + w > hx0 && y < hy1 && y + 40 > hy0) y = Math.min(y, hy0 - 48);
      // nor an elite's name over its head (the exit's guard by the stairs down a hero has just come up): then under his feet
      if (nameZones.some((z) => x < z.x + z.w && x + w > z.x && y < z.y + z.h && y + 40 > z.y)) y = V.sy(h.y) + 18;
      if (y < 120 || (y < 316 && x < HB.x + HB.w + 12) || (y < 490 && x + w > W - 300)) { x = (W - w) / 2; y = H - 150; }
      HUD.promptBox = [x, y, w, bh]; plate('prompt_box', x - 6, y - 4, w + 12, bh + 8); lab('prompt', s, x + 14, y + 21, { size: 24, col: '#fff2c8' }); if (sub) lab('prompt_j', sub, x + 14, y + 47, { size: 20, col: C.dim }); }
  }

  // ---------------- in-game HUD ----------------
  // look B (TASKS 1332): the portrait, the flasks with their bars, the skills and the potions on one leather plate in the corner,
  // as on ref_ui_hud_b; the layout of the old HUD is kept, so nothing moves under the hand in a fight
  const HB = { x: 8, y: 8, w: 588, h: 182 };
  function skillCell(id, x, y, s, A, r, cd, full, low, rage) {
    L.rrect(x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8, s * 0.4, [0.11, 0.08, 0.09], [0.06, 0.045, 0.05]);
    icon(A.icon, x + s * 0.17, y + s * 0.17, s * 0.66, { alpha: r ? 1 : 0.25, grade: r ? [1, 1, 0, 1] : [0, 0.5, 0, 1] });
    if (r && cd > 0) { const f = Math.min(1, cd / full), ih = s * 0.76, top = y + s * 0.12 + ih * (1 - f); L.rrect(x + s * 0.12, top, s * 0.76, y + s * 0.88 - top, Math.min(s * 0.38, (y + s * 0.88 - top) / 2), [0, 0, 0], [0, 0, 0], 0.62); }
    else if (r && low) L.rrect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, s * 0.38, rage ? [0.4, 0.1, 0.02] : [0.05, 0.1, 0.4], rage ? [0.4, 0.1, 0.02] : [0.05, 0.1, 0.4], 0.5);
    KIT.part('ui_b_cell_round', [48, 48], x, y, { k: s / 96, u: { grade: r ? [1, 1, 0, 1] : [0.3, 0.7, 0, 1] } }); L.uiBox(id, x, y, s, s, 0);
  }
  function hud(S, R, t) {
    const h = R.hero, st = SIM.Q.stats(h, S.meta), GT = S.t, K = KIT;
    plate('hud_plate', HB.x, HB.y, HB.w, HB.h, { k: 0.35, pad: 0 });
    // portrait + level
    L.solid(22, 22, 92, 80, [0.05, 0.035, 0.03]); L.sprite(portraitOf(h), 25, 25, { w: 86, h: 74, src: [0.08, 0.02, 0.92, 0.74] }); edge(22, 22, 92, 80, BRASS, 3); L.uiBox('portrait', 22, 22, 92, 80, 0);
    K.nine('btn', 16, 110, 104, 36); K.ink('lvl', TXT('hud.hud', { lvl: h.lvl }), 68, 129, { size: 20, al: 0.5 }); L.uiBox('lvl_b', 30, 110, 76, 36, 0);
    if (h.pts > 0 || h.sp > 0) { const a = 0.6 + 0.4 * Math.sin(t * 5); L.rrect(100, 12, 26, 26, 13, [1, 0.75, 0.2], [0.8, 0.45, 0.1], a); L.uiBox('lvl_up_b', 98, 10, 30, 30, 0); lab('lvl_up', '+', 113, 25, { size: 20, al: 0.5, col: '#2a1606', out: '' }); }
    // flasks and bars; the warrior's rage (TASKS 1130) in the mana's flask, in its own ember colour
    const rage = D.clsOf(h).res === 'rage', hpF = h.hp / st.maxHp, mpF = h.mp / st.maxMp;
    K.flask('hp_fl', 120, 12, 88, hpF, [0.78, 0.1, 0.07]); K.flask('mp_fl', 178, 12, 88, mpF, rage ? [0.9, 0.38, 0.08] : [0.15, 0.32, 0.85]);
    // the numbers stand on their own parchment plates beside the bars, as on ref_ui_hud_b: on the bar a 20 px number covered its
    // brass rims and left the fill two thin strips (TASKS 1759); four-digit pairs lose their spaces before they would overflow (1794)
    const bx = 240, bw = 200, nx = bx + bw + 8, nw = 136, pair = (id, a, b) => { const s = a + ' / ' + b; return lw(id, s, { size: 20 }) <= nw - 44 ? s : a + '/' + b; };
    const num = (id, s, y, hh) => { K.nine('btn', nx, y, nw, hh); K.ink(id, s, nx + nw / 2, y + hh / 2 + 1, { size: 20, al: 0.5 }); L.uiBox(id + '_b', nx + 14, y, nw - 28, hh, 0); };
    K.bar('hpbar', bx, 18, bw, 32, hpF, [0.86, 0.12, 0.1], [0.5, 0.04, 0.04]);
    if (h.shield > 0 && GT < h.shieldUntil) L.rrect(bx + 24, 28, (bw - 48) * Math.min(1, h.shield / st.maxHp), 5, 2, [0.6, 0.85, 1], [0.3, 0.55, 1], 0.9);
    num('hpbar_t', pair('hpbar_t', Math.ceil(h.hp), st.maxHp), 16, 36);
    K.bar('mpbar', bx, 58, bw, 28, mpF, rage ? [0.95, 0.42, 0.1] : [0.18, 0.42, 0.95], rage ? [0.5, 0.14, 0.04] : [0.07, 0.18, 0.55]); num('mpbar_t', pair('mpbar_t', Math.floor(h.mp), st.maxMp), 56, 32);
    if (rage && h.mp >= st.maxMp) L.solid(bx + bw - 25, 58 + 8, 4, 12, [1, 0.86, 0.45], 0, 0, 0, 1);
    K.bar('xpbar', bx, 94, nx + nw - bx, 16, h.xp / D.xpNeed(h.lvl), [0.95, 0.75, 0.25], [0.6, 0.4, 0.08]);
    // skill bar + potions
    D.clsOf(h).abs.forEach((A, i) => { const x = 126 + i * 58, y = 122, r = h.ab[A.id] || 0, cd = h.cd[A.id] - GT;
      skillCell('sk_' + A.id, x, y, 54, A, r, cd, A.cd, h.mp < A.mp, rage);
      if (r && cd > 0) lab('skc_' + A.id, cd.toFixed(1), x + 27, y + 28, { size: 20, al: 0.5 });
      lab('skk_' + A.id, A.key, x + 6, y + 8, { size: 20, col: C.gold }); });
    const pot = (b) => h.bag.reduce((n, it) => n + (it && it.b === b ? it.n : 0), 0);
    // a town run's scrolls of return beside the potions (TASKS 1033): the way home in sight, with its key
    [['hp_potion', 'it_hp', 'Q'], ['mp_potion', 'it_mp', 'R']].concat(R.viaTown ? [['scroll', 'it_scroll', 'T']] : []).forEach(([b, ic, k], i) => { const x = 304 + i * 50, y = 126;
      K.nine('cell', x, y, 46, 46); L.uiBox('pot_' + b, x, y, 46, 46, 0); icon(ic, x + 7, y + 6, 32); lab('potn_' + b, pot(b), x + 41, y + 37, { size: 20, al: 1 }); lab('potk_' + b, k, x + 8, y + 10, { size: 20, col: C.gold }); });
    // stats column (light numbers on a narrow plate under the portrait)
    const rows = [['it_sword', st.atk], ['it_shield', st.def], ['it_boots', Math.round(st.aspd) + '%'], ['it_ring', Math.round(st.crit) + '%']];
    const sw = Math.max(...rows.map(([, v], i) => lw('stv' + i, v, { size: 19 }))) + 54;
    plate('stats', 8, HB.y + HB.h + 8, sw, rows.length * 28 + 16, { a: 0.85 });
    const rowTip = [[TXT('hud.inv.derived'), TXT('hud.tip.atk')], [TXT('hud.inv.derived.2'), TXT('hud.tip.def')], [TXT('hud.inv.derived.7'), TXT('hud.tip.aspd')], [TXT('hud.inv.derived.5'), TXT('hud.tip.crit')]];
    rows.forEach(([ic, v], i) => { const y = HB.y + HB.h + 16 + i * 28; icon(ic, 17, y + 1, 22); lab('stv' + i, v, 46, y + 13, { size: 19 }); tipAt(8, y - 2, sw, 28, rowTip[i][0] + ' ' + v, rowTip[i][1]); });
    const money = currencies(S, R);
    for (const [id, ic, value, x, w, col] of money) {
      plate(id + '_box', x, HB.y + HB.h + 8, w, 38, { a: 0.9 });
      icon(ic, x + 8, HB.y + HB.h + 15, 24); lab(id, value, x + 38, HB.y + HB.h + 28, { size: 19, col });
      tipAt(x, HB.y + HB.h + 8, w, 38, id === 'gold_count' ? TXT('hud.altar.6', { gold: value }) : id === 'shard_count' ? TXT('hud.stats.hand', { n: value }) : TXT('hud.tip.key', { n: value }), id === 'gold_count' ? TXT('hud.tip.gold') : id === 'key_count' ? TXT('hud.tip.key.2') : '');
    }
    buffs(S, R, GT);
    // floor title + minimap
    minimap(S, R, t); tracker(S, R);
    // boss bar
    const boss = R.en.find((e) => !!D.BOSSES[e.type] && e.deadT < 0 && e.st !== 'idle');
    if (boss) {
      const max = Number.isFinite(boss.max) && boss.max > 0 ? boss.max : 1, hp = Math.max(0, Number.isFinite(boss.hp) ? boss.hp : 0), E = D.ENEMIES[boss.type];
      K.banner('bossn', W / 2, 2, Math.max(420, lw('bossn_m', E.name, { size: 30 }) + 220), E.name, { h: 62, size: 30 });
      if (E.title) lab('bosst', E.title, W / 2, 78, { size: 18, al: 0.5, col: '#e8cdb4' });
      // 700 px: the wider HUD plate (TASKS 1759) ends at x 596, and the bar keeps clear of it
      const BW = 700, bx = W / 2 - BW / 2, by = E.title ? 92 : 70, bh = 34, ix = bh * 12 / 16;
      K.bar('bossbar', bx, by, BW, bh, hp / max, [0.9, 0.25, 0.08], [0.45, 0.05, 0.02]); lab('bossbar_t', Math.ceil(hp) + ' / ' + Math.ceil(max), W / 2, by + bh / 2 + 1, { size: 20, al: 0.5 });
      for (const phase of D.BOSSES[boss.type].phases || []) if (phase.at > 0 && phase.at < 1) {
        const x = bx + ix + (BW - 2 * ix) * phase.at;
        L.solid(x - 1, by + 8, 2, 5, [1, 0.9, 0.7]); L.solid(x - 1, by + bh - 13, 2, 5, [1, 0.9, 0.7]);
      }
    }
    // floor banner
    // a boss's arrival plate gives way to its ribbon, or its name stood on the screen two and three times over (TASKS 1794)
    const named = boss && R.msg && R.msg.chapter === D.ENEMIES[boss.type].name;
    if (R.msg && S.screen === 'play' && !named) { const a = S.t - R.msg.t, d = R.msg.d || 3.5; if (a >= 0 && a < d) { const al = L.SS(0, 0.3, a) * (1 - L.SS(d - 0.7, d, a)) * (R.msg.outT ? 1 - L.SS(R.msg.outT, R.msg.outT + 0.3, S.t) : 1), s = R.msg.s;
      if (R.msg.chapter) { const w = Math.max(lw('msg_c', R.msg.chapter, { size: 46 }), lw('msg', s, { size: 24 })) + 90; plate('msg_box', W / 2 - w / 2, 142, w, 104, { a: al, k: 0.4 }); lab('msg_c', R.msg.chapter, W / 2, 180, { size: 46, al: 0.5, col: C.gold, a: al }); lab('msg', s, W / 2, 222, { size: 24, al: 0.5, col: C.dim, a: al }); }
      else {
      // a long line (a gift's name and its whole effect, TASKS 1829) breaks in two instead of shrinking past the 20 px floor, and
      // stays narrow enough to clear the HUD panel and the map
      const one = lw('msg_m', s, { size: 30 }) <= 1000, size = one ? 30 : 24, ls = one ? [s] : wrapWords(s, 660, size), lh = size + 8;
      const w = Math.max(...ls.map((q, k) => lw('msg' + (k || ''), q, { size }))) + 60;
      plate('msg_box', W / 2 - w / 2, 148, w, 56 + (ls.length - 1) * lh, { a: al });
      ls.forEach((q, k) => lab('msg' + (k || ''), q, W / 2, 177 + k * lh, { size, al: 0.5, col: C.gold, a: al })); } } }
    // feed: pickups and refusals, newest at the bottom
    const feed = D.feedOf(S.ev, S.t);
    feed.forEach((e, i) => { const a = S.t - e.t, al = 1 - L.SS(2.4, 3, a), y = H - 44 - (feed.length - 1 - i) * 34;
      const s = e.k === 'trade' ? TXT('hud.hud.s', { p1: e.s + (e.n > 0 ? '  +' : '  −') + Math.abs(e.n) }) : e.k === 'pickup' ? (e.worn ? TXT('hud.hud.s.2') : TXT('hud.hud.s.3')) + e.s : e.k === 'lvl' ? TXT('hud.hud.s.4', { lvl: e.lvl }) : e.k === 'unlock' ? TXT('hud.hud.s.5', { name: D.ABILITIES.find((A) => A.id === e.id).name }) : e.s;
      const col = e.k === 'pickup' || e.k === 'trade' ? hex(D.RARITY[e.rar || 0].col) : e.k === 'nope' ? '#ffb0a0' : C.gold, w = lw('feed' + i, s, { size: 19 }) + 32;
      plate('feedbox' + i, 14, y - 17, w, 34, { a: 0.85 * al }); lab('feed' + i, s, 30, y + 1, { size: 19, col, a: al }); });
    if (S.screen === 'play') { const k = S.meta.mute ? TXT('hud.hud.k.mute') : TXT('hud.hud.k'), kw = lw('keys', k, { size: 26 }) + 24;
      plate('keys_box', W - 12 - kw, H - 48, kw, 42, { a: 0.85 }); lab('keys', k, W - 24, H - 26, { size: 26, al: 1, col: '#8a7d6c' }); }
  }

  // active effects under the currencies: the shrine's blessing lasts the floor, the shield shows what it still soaks, the
  // timed ones drain clockwise; debuffs sit on a red rim
  // a gift taken at several altars: its tooltip names the summed value, as its cell does, and how many times it was given
  const giftTip = (G, n) => { if (n < 2) return G.desc; const times = TXT.n('hud.tip.times', n);
    const d = G.flat ? TXT('GIFTS.phoenix.descN', { n, times }) : G.desc.replace(String(G.v), String(Math.round(G.v * n * 10) / 10));
    return G.flat ? d : TXT('hud.tip.giftN', { d, n, times }); };
  function buffs(S, R, GT) {
    const h = R.hero, list = [], gift = (id) => D.GIFTS.find((g) => g.id === id);
    if (h.bless) list.push({ id: 'bless', ic: 'bf_bless', v: '+20%', col: '#9cc8ff', gift: 1, name: gift('bless').name, desc: gift('bless').desc });
    if ((h.perks || {}).greed) list.push({ id: 'g_greed', ic: 'it_gold', v: '+' + h.perks.greed * 25 + '%', col: '#9cc8ff', gift: 1, name: TXT('hud.tip.greed') });
    // the altars' gifts for the run: one cell per kind, the value summed over every altar that gave it
    for (const G of D.GIFTS) if (G.power && D.hasPower(h, G.id)) list.push({ id: 'g_' + G.id, ic: G.icon, v: '', col: '#ffd27a', gift: 1, name: G.name, desc: G.desc });
    for (const G of D.GIFTS) { if (G.power) continue; const n = (h.perks || {})[G.id]; if (n) list.push({ id: 'g_' + G.id, ic: G.icon, v: G.tag ? G.tag.replace('{v}', String(Math.round(G.v * n * 10) / 10)).replace('{n}', n) : G.desc.split(' ')[0].replace(/[\d.]+/, String(Math.round(G.v * n * 10) / 10)), col: '#9cc8ff', gift: 1, name: G.name, desc: giftTip(G, n) }); }
    if (h.shield > 0 && GT < h.shieldUntil) list.push({ id: 'shield', ic: 'ab_shield', v: String(Math.ceil(h.shield)), col: '#9cc8ff', left: (h.shieldUntil - GT) / D.SHIELD_T, name: D.ABILITIES.find((A) => A.id === 'shield').name, desc: TXT('hud.tip.shield', { n: Math.ceil(h.shield) }) });
    if (h.burn > GT) list.push({ id: 'burn', ic: 'bf_burn', left: (h.burn - GT) / 3, bad: 1, name: TXT('sim_floor.damageName.burn'), desc: TXT('hud.tip.burn') });
    if (h.poison > GT) list.push({ id: 'poison', ic: 'bf_poison', left: (h.poison - GT) / 3, bad: 1, name: TXT('sim_floor.damageName.poison'), desc: TXT('hud.tip.poison') });
    // a gift sits in a round brass cell, the shield and the curses in square ones: the same item icons, told apart by their rim (TASKS 1852)
    TIPY = Math.max(HB.y + HB.h + 8 + 4 * 28 + 24, HB.y + HB.h + 56 + Math.ceil(list.length / 8) * 64);
    list.forEach((b, i) => { const x = 120 + (i % 8) * 66, y = HB.y + HB.h + 56 + Math.floor(i / 8) * 64;
      if (b.gift) { L.rrect(x + 3, y + 3, 34, 34, 17, [0.11, 0.08, 0.09], [0.06, 0.045, 0.05]); KIT.part('ui_b_cell_round', [48, 48], x - 3, y - 3, { k: 46 / 96 }); }
      else { KIT.nine('cell', x, y, 40, 40, { u: { grade: b.bad ? [1, 1, 0, 1] : [1, 1.1, 0, 1] } }); if (b.bad) edge(x, y, 40, 40, [0.8, 0.2, 0.15], 2); }
      L.uiBox('bf_' + b.id, x, y, 40, 40, 4); tipAt(x - 4, y - 4, 48, 66, b.name, b.desc);
      if (window.ASSETS[b.ic]) icon(b.ic, x + (b.gift ? 6 : 3), y + (b.gift ? 6 : 3), b.gift ? 28 : 34);
      if (b.left !== undefined) { const f = Math.max(0, Math.min(1, 1 - b.left)); L.solid(x + 3, y + 3, 34, 34 * f, [0, 0, 0], 0, 0, 0, 0.55);
        if (b.left < 0.25 && Math.sin(GT * 18) > 0) L.rrect(x, y, 40, 40, 5, [1, 1, 1], [1, 1, 1], 0.12); }
      // chips stand 66 px apart: a value cannot shrink under the font's 20 px floor, and +180% is 60 px wide (TASKS 1851)
      if (b.v) lab('bfv_' + b.id, b.v, x + 20, y + 49, { size: 20, al: 0.5, col: b.col }); });
  }

  function currencies(S, R) {
    const gold = String(R.hero.gold), shards = String(S.meta.shards), gw = lw('gold_count', gold, { size: 19 }) + 54;
    const sw = lw('shard_count', shards, { size: 19 }) + 54, out = [['gold_count', 'it_gold', gold, 120, gw, C.gold], ['shard_count', 'crystal', shards, 130 + gw, sw, '#9cc8ff']];
    // a key found on this floor, until it opens its door
    if (R.keys > 0) out.push(['key_count', 'it_key', String(R.keys), 140 + gw + sw, lw('key_count', String(R.keys), { size: 19 }) + 54, C.gold]);
    return out;
  }

  function souls(S, R, V) {
    const tx = currencies(S, R)[1][3] + 20, ty = HB.y + HB.h + 27;
    for (const e of S.ev) {
      const a = S.t - e.t, floorReward = e.k === 'shard' && !!e.s;
      if (e.k !== 'shard' || a < 0 || a > 3.5 || (e.floor !== undefined && e.floor !== R.floor)) continue;
      const x0 = floorReward ? W / 2 : V.sx(e.x), y0 = floorReward ? 280 : V.sy(e.y) - 20;
      if (floorReward) {
        const text = e.s, alpha = L.SS(0, 0.15, a) * (1 - L.SS(2.8, 3.5, a));
        const w = lw('soul_reward', text, { size: 22 }) + 36;
        plate('soul_reward_box', W / 2 - w / 2, 211, w, 46, { a: alpha });
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
  function lootMarks(R, t, V) { const A = SIM.Q.lootAudit(R), pulse = 0.75 + 0.25 * Math.sin(t * 5);
    for (const o of A.list) { const col = LOOT_COL[o.at], x = V.sx(o.x), y = V.sy(o.y) - 12;
      if (underHud(x, y)) continue;   // under a HUD panel: the minimap shows it
      if (x > 30 && x < W - 30 && y > 30 && y < H - 30) {
        if (o.chest) { L.rrect(x - 17, y - 17, 34, 34, 4, col, col, 0.25 * pulse); L.ring(x, y, 22, 22, col, pulse, 0.12); for (let k = 0; k < o.n; k++) L.rrect(x - (o.n - 1) * 5 + k * 10 - 3, y - 34, 6, 6, 3, col, col); }
        else { L.solid(x, y, 16, 16, col, Math.PI / 4, 8, 8, 0.85 * pulse); L.ring(x, y, 18, 18, col, pulse, 0.14); }
        continue; }
      const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy, k = Math.min((W / 2 - 40) / Math.abs(dx || 1e-6), (H / 2 - 40) / Math.abs(dy || 1e-6)), ex = cx + dx * k, ey = cy + dy * k, a = Math.atan2(dy, dx);
      L.solid(ex, ey, 26, 12, col, a, 13, 6, 0.9); L.solid(ex + Math.cos(a) * 10, ey + Math.sin(a) * 10, 12, 12, col, a + Math.PI / 4, 6, 6, 0.9); } }
  // debug: the floor's loot books under the debug buttons
  function lootBooks(R) { const A = SIM.Q.lootAudit(R), sec = A.list.filter((o) => o.at === 'secret').reduce((n, o) => n + o.n, 0);
    const line = TXT('hud.lootBooks.line', { got: A.got, total: A.total, lying: A.lying, boxed: A.boxed, sec, stuck: A.stuck, off: A.off });
    const w = lw('dbg_loot_l', line, { size: 20 }) + 28; panel('dbg_loot_p', W / 2 - w / 2, 108, w, 34, { r: 5, a: 0.85 });
    lab('dbg_loot_l', line, W / 2, 126, { size: 20, al: 0.5, col: A.off || A.stuck ? '#ff7a6a' : C.text }); }
  // the town is a small map: its cells drawn larger, so its services' marks stand apart (TASKS 1023)
  const mapK = (R) => (R.map.town ? 5 : MAP.k);
  const mapCut = (R) => SIM.Q.mapCut(R);
  // the legend is open for the first 10 s on a floor, then folds away, so the map's corner covers no more than the ref's
  // (TASKS 1794); L keeps it open, and in the pause the pointer over the map opens it
  const legOpen = (S, R, hov = true) => R.mapLeg === 1 || (S.t - (R.enteredT ?? -1e9) < 10 && !((R.legCut ?? -1e9) >= (R.enteredT ?? -1e9))) || (hov && S.screen === 'pause' && !!S.ptr && (() => { const B = mmGeo(S, R, true).box; return S.ptr[0] > B[0] && S.ptr[1] < B[1] + B[3]; })());
  // the ribbon says the floor as the ref does («Этаж 2»), and its curse if it has one; the place's name is on the arrival plate
  const mmTitle = (R) => D.placeName(R.map.floor, R.mode, R.seed, R.campaignWon ? D.RUNS.campaign.floors + 1 : 1, R.map).replace(/:[^·]*/, ' ').replace(/\s+/g, ' ').trim();
  // the map's sheet, from the state alone (world() keeps labels off it before it is drawn): a parchment sheet with the floor's
  // ribbon over its top edge, as on ref_ui_hud_b
  function mmGeo(S, R, leg) {
    const k = mapK(R), cut = mapCut(R), mw = cut.w * k, mh = cut.h * k, title = mmTitle(R), bw = Math.max(240, lw('mm_t', title, { size: 26, bold: true }) + 130);
    const legend = leg ? legendOf(R).concat(SIM.Q.completionHints(R).length ? [['hint', TXT('hud.minimap.legend')]] : []) : [];
    const legW = Math.max(...LEGEND.concat([['hint', TXT('hud.minimap.legend')], WAY_LEG, QUEST_LEG, SHOP_SHUT_LEG], TOWN_LEG, MAGMA_LEG).map(([, s], i) => lw('mm_l' + i, s, { size: 20 }))) + 46 + 116;
    const pw = Math.max(mw + 44, bw + 20, legW), x0 = W - pw - 14, y0 = 24, py = 66, lg0 = py + mh + 26, rule = lg0 + 26 * legend.length + (legend.length ? 6 : -10), bot = rule + 46;
    return { k, cut, mw, mh, title, bw, legend, pw, x0, y0, py, px: x0 + Math.round((pw - mw) / 2), lg0, rule, bot, box: [x0, 4, pw, bot - 4] };
  }
  function mmBox(S, R) { return mmGeo(S, R, legOpen(S, R)).box; }
  // the quests in hand (TASKS 1018, part of 1023): under the minimap, each its name and where it stands
  const trkAll = (R) => SIM.Q.journalOf(R).filter((q) => q.st !== 'turned'), trkRows = (R) => trkAll(R).slice(0, 4), trkMore = (R) => Math.max(0, trkAll(R).length - 4);
  function trkBox(S, R) { const Q = trkRows(R); if (!Q.length || !(S.screen === 'play' || S.screen === 'pause')) return null; const mb = mmBox(S, R);
    const w = Math.max(280, ...Q.map((q, i) => Math.max(lw('qt_n' + i, D.QUESTS[q.key].name, { size: 19 }), lw('qt_l' + i, SIM.Q.questLine(q, R), { size: 20 })))) + 32;
    return [W - 14 - w, mb[1] + mb[3] + 14, w, 38 + Q.length * 50 + (trkMore(R) ? 26 : 0)]; }
  function tracker(S, R) { const B = trkBox(S, R); if (!B) return; const [x0, y0, w, h] = B;
    plate('qtrack', x0 - 4, y0 - 4, w + 8, h + 8, { k: 0.35, pad: 8 }); lab('qt_t', TXT('hud.tracker'), x0 + 14, y0 + 20, { size: 20, col: C.dim }); if (trkMore(R)) lab('qt_more', TXT('hud.tracker.more', { n: trkMore(R) }), x0 + 14, y0 + h - 16, { size: 20, col: C.dim });
    trkRows(R).forEach((q, i) => { const y = y0 + 48 + i * 50, done = q.st === 'done', Q = D.QUESTS[q.key];
      lab('qt_n' + i, Q.name, x0 + 14, y, { size: 19, col: done ? '#8fd98a' : Q.kind === 'story' ? '#ffc070' : C.gold });
      lab('qt_l' + i, SIM.Q.questLine(q, R), x0 + 14, y + 22, { size: 20, col: done ? '#8fd98a' : C.text }); }); }
  function minimap(S, R, t) {
    const m = R.map, Gm = mmGeo(S, R, legOpen(S, R)), { k, cut, mw, mh, px, py, x0, pw, legend } = Gm, n = R.seen.reduce((a, b) => (Math.imul(a, 31) + b) | 0, 0), I = KIT.INK;
    const hid = SIM.Q.secretMask(m), key = m.seed + ':' + m.floor + ':' + n + ':' + R.chests.map((c) => c.open).join('') + R.rseen.join('') + (m.secrets || []).map((q) => q.open).join('') + (m.doors || []).map((d) => d.open).join('');
    if (MAP.key !== key) { MAP.key = key; const cv = MAP.cv || (MAP.cv = G.canvas()); cv.width = mw; cv.height = mh; const g = cv.getContext('2d'); g.clearRect(0, 0, mw, mh);
      // an unfound secret room is rock on the map, its fake wall a wall
      const at = (x, y) => (hid.has(y * m.W + x) ? 0 : SIM.Q.cell(m, x, y)), open = (c) => c === 1 || c === 3 || c === 5 || c === 6;
      const fill = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      // rooms as stone slabs with a pale rim, as in the concept: the rim sits on the wall cells that border the floor
      for (let y = cut.y; y < cut.y + cut.h; y++) for (let x = cut.x; x < cut.x + cut.w; x++) { if (!R.seen[y * m.W + x]) continue; const c = at(x, y), X = (x - cut.x) * k, Y = (y - cut.y) * k;
        if (c === 1) { const v = L.rnd(x * 7 + y * 131, 3); fill(X, Y, k, k, v < 0.2 ? '#6e665f' : v > 0.85 ? '#8a8178' : '#7d746c'); }
        else if (c === 3) fill(X, Y, k, k, '#c4441a');
        else if (c === 5) fill(X, Y, k, k, '#a0682e');
        else if (c === 6) fill(X, Y, k, k, '#1f4d52');
        else { const u = open(at(x, y - 1)), d = open(at(x, y + 1)), l = open(at(x - 1, y)), r = open(at(x + 1, y)); if (!(u || d || l || r)) continue;
          fill(X, Y, k, k, '#1b1719');
          if (d) fill(X, Y + k - 2, k, 2, '#a59a8e'); if (l) fill(X, Y, 2, k, '#a59a8e'); if (r) fill(X + k - 2, Y, 2, k, '#a59a8e');
          if (u) fill(X, Y, k, 2, '#3a3230'); } }
      if (MAP.rec) { G.canvasUpdate(MAP.rec, cv); MAP.rec.w = mw; MAP.rec.h = mh; }
      else MAP.rec = G.canvasTex('minimap', cv); }
    KIT.nine('torn', x0, Gm.y0, pw, Gm.bot - Gm.y0, { k: 0.5 }); L.uiBox('minimap', x0 + 12, Gm.y0 + 12, pw - 24, Gm.bot - Gm.y0 - 24, 0);
    KIT.banner('mm_t', x0 + pw / 2, 4, Gm.bw, Gm.title, { h: 54, size: 26 });
    L.sprite('minimap', px, py, { w: mw, h: mh });
    const ox = cut.x * TILE, oy = cut.y * TILE;
    const mark = (x, y, id, s) => icon_(id, px + (x - ox) / TILE * k, py + (y - oy) / TILE * k, s);
    for (const c of R.chests) if (!c.open && !SIM.Q.hidden(m, c) && R.seen[Math.floor(c.y / TILE) * m.W + Math.floor(c.x / TILE)]) mark(c.x, c.y, 'gold', 12);
    for (const e of R.en) if (!!D.BOSSES[e.type] && e.deadT < 0 && R.seen[Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE)]) mark(e.x, e.y, 'boss', 14);
    if (SIM.Q.exitKind(R, m.floor) !== null && R.seen[m.exit.ty * m.W + m.exit.tx]) mark(m.exit.x, m.exit.y, 'exit', 14);
    if (m.shop && R.rseen[m.shop.room]) mark(m.shop.x, m.shop.y, 'shop', 12);
    if (m.sanct && R.seen[Math.floor(m.sanct.y / TILE) * m.W + Math.floor(m.sanct.x / TILE)]) mark(m.sanct.x, m.sanct.y, 'camp', 12);
    if (m.way && R.seen[m.way.ty * m.W + m.way.tx]) mark(m.way.x, m.way.y, 'way', 13);
    if (m.town) { const V0 = m.town.svc; mark(V0.altar.x, V0.altar.y, 'altar', 12); mark(V0.stash.x, V0.stash.y, 'stash', 12); mark(V0.anvil.x, V0.anvil.y, 'craft', 12); mark(V0.lectern.x, V0.lectern.y, 'craft', 12); mark(V0.portal.x, V0.portal.y, 'way', 13); mark(V0.board.x, V0.board.y, 'board', 12); }
    for (const q of R.shrines) if (!SIM.Q.hidden(m, q) && R.seen[Math.floor(q.y / TILE) * m.W + Math.floor(q.x / TILE)]) mark(q.x, q.y, q.used ? 'altar_used' : 'altar', 12);
    // the townsfolk with quest business (TASKS 1033): their ! and ? on the town's map, where they stand now
    if (m.town && R.folk) R.folk.forEach((f, i) => { const mk = SIM.Q.questMark(R, f.role); if (!mk) return; const x = px + (f.x - ox) / TILE * k, y = py + (f.y - oy) / TILE * k;
      L.rrect(x - 8, y - 9, 16, 18, 5, [0.1, 0.07, 0.04], [0.1, 0.07, 0.04], 0.9); lab('mm_q' + i, mk, x, y + 1, { size: 20, al: 0.5, col: mk === '?' ? '#8fd98a' : '#ffc040' }); });
    for (const o of SIM.Q.completionHints(R)) { const x = px + (o.x - ox) / TILE * k, y = py + (o.y - oy) / TILE * k, pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 6));
      const c = o.kind === 'foe' ? [1, 0.3, 0.2] : [1, 0.85, 0.3];
      L.rrect(x - 4, y - 4, 8, 8, 4, c, c, pulse); }
    // a quest's goal (TASKS 1019–1021), seen or not: the named foe, the room to clear (its outline), the keepsake once seen
    for (const o of SIM.Q.questMarks(R)) { const x = px + (o.x - ox) / TILE * k, y = py + (o.y - oy) / TILE * k, pulse = 0.55 + 0.45 * Math.sin(t * 5);
      if (o.kind === 'room') { const r = o.r, c = [1, 0.8, 0.3]; const rx = px + (r.x - cut.x) * k, ry = py + (r.y - cut.y) * k; L.solid(rx, ry, r.w * k, 2, c, 0, 0, 0, pulse); L.solid(rx, ry + r.h * k - 2, r.w * k, 2, c, 0, 0, 0, pulse);
        L.solid(rx, ry, 2, r.h * k, c, 0, 0, 0, pulse); L.solid(rx + r.w * k - 2, ry, 2, r.h * k, c, 0, 0, 0, pulse); }
      icon_('quest', x, y, 14, pulse); }
    if (S.debug && S.dbgLoot) for (const o of SIM.Q.lootAudit(R).list) { const c = LOOT_COL[o.at], r = o.chest ? 4 : 3; L.rrect(px + (o.x - ox) / TILE * k - r, py + (o.y - oy) / TILE * k - r, 2 * r, 2 * r, r, c, c); }
    const hs = 13 + 1.5 * Math.sin(t * 6), hx = Math.max(hs, Math.min(mw - hs, (R.hero.x - ox) / TILE * k)), hy = Math.max(hs, Math.min(mh - hs, (R.hero.y - oy) / TILE * k));
    icon_('you', px + hx, py + hy, hs);
    legend.forEach(([id, s], i) => { const y = Gm.lg0 + i * 26; icon_(id, x0 + 30, y, 16); KIT.ink('mm_l' + i, s, x0 + 46, y + 1, { size: 20, col: I.t }); });
    if (legend.length) compass(x0 + pw - 58, Gm.lg0 + 26 * legend.length - 64, 34);
    // this floor's completion: monsters, loot, secrets (the last only where the floor has any)
    const y = Gm.rule + 22; KIT.rule(x0 + 22, Gm.rule, pw - 44, 0.7);
    const prog = progress(R); prog.forEach(([id, ic, s, done], i) => { const x = x0 + 26 + i * (pw - 52) / prog.length; icon(ic, x, y - 9, 18, done ? undefined : { alpha: 0.8 });
      KIT.ink('mm_p' + id, s, x + 24, y + 1, { size: 20, col: done ? I.r : I.t }); });
  }
  // minimap markers, centred on (x, y): gems as in the concept, a slab for a room, the stairs for the exit
  const GEM = { you: [[0.55, 0.8, 1], [0.1, 0.3, 0.95]], gold: [[1, 0.9, 0.4], [0.85, 0.5, 0.05]], boss: [[1, 0.4, 0.3], [0.65, 0.04, 0.03]], shop: [[0.6, 1, 0.7], [0.12, 0.6, 0.3]] };
  function icon_(id, x, y, s, a0 = 1) {
    if (id === 'camp') { L.solid(x, y + s * 0.25, s, 3, [0.6, 0.35, 0.16]); L.solid(x, y, s * 0.55, s * 0.7, [1, 0.65, 0.2], Math.PI / 4, s * 0.275, s * 0.35); return; }
    if (id === 'altar' || id === 'altar_used') { const col = id === 'altar' ? [0.65, 0.85, 1] : [0.45, 0.45, 0.5]; L.solid(x - s / 2, y + s / 4, s, s / 4, col); L.ring(x, y - s / 6, s / 3, s / 3, col, 1, 0.3); return; }
    if (id === 'stash') { L.solid(x - s / 2, y - s * 0.2, s, s * 0.55, [0.55, 0.36, 0.18]); L.solid(x - s / 2, y - s * 0.38, s, s * 0.2, [0.7, 0.5, 0.25]); L.solid(x - s * 0.1, y - s * 0.15, s * 0.2, s * 0.2, [1, 0.85, 0.4]); return; }
    if (id === 'board') { L.solid(x - s * 0.5, y - s * 0.42, s, s * 0.62, [0.5, 0.36, 0.22]); L.solid(x - s * 0.32, y - s * 0.28, s * 0.64, s * 0.34, [0.86, 0.8, 0.62]); L.solid(x - s * 0.08, y + s * 0.2, s * 0.16, s * 0.32, [0.36, 0.26, 0.16]); return; }
    if (id === 'craft') { L.solid(x - s * 0.45, y + s * 0.1, s * 0.9, s * 0.25, [0.6, 0.6, 0.66]); L.solid(x - s * 0.25, y - s * 0.15, s * 0.5, s * 0.28, [0.75, 0.75, 0.8]); L.solid(x - s * 0.08, y - s * 0.5, s * 0.16, s * 0.4, [0.62, 0.42, 0.24]); return; }
    if (id === 'way') { const c = [0.62, 0.7, 1]; L.solid(x - s / 2, y + s * 0.3, s, s * 0.2, [0.4, 0.38, 0.45]); L.solid(x - s * 0.22, y - s / 2, s * 0.44, s * 0.82, [0.5, 0.47, 0.56]); L.solid(x - s * 0.08, y - s * 0.32, s * 0.16, s * 0.5, c); return; }
    if (id === 'quest') { const a = a0; L.rrect(x - s / 2 - 2, y - s / 2 - 2, s + 4, s + 4, s / 2 + 2, [0.08, 0.05, 0.03], [0.08, 0.05, 0.03], a); L.solid(x, y, s * 0.62, s * 0.62, [1, 0.78, 0.25], Math.PI / 4, s * 0.31, s * 0.31, a); L.solid(x, y, s * 0.26, s * 0.26, [1, 0.97, 0.8], Math.PI / 4, s * 0.13, s * 0.13, a); return; }
    if (id === 'hint') { L.rrect(x - 4, y - 4, 8, 8, 4, [1, 0.85, 0.3], [1, 0.85, 0.3]); return; }
    if (id === 'lava') { L.rrect(x - s / 2, y - s / 2, s, s, 2, [0.77, 0.27, 0.1], [0.77, 0.27, 0.1]); return; }
    if (id === 'chasm') { L.rrect(x - s / 2, y - s / 2, s, s, 2, [0.4, 0.37, 0.38], [0.4, 0.37, 0.38]); L.rrect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4, 1, [0.02, 0.015, 0.02], [0.02, 0.015, 0.02]); return; }
    if (id === 'exit') { icon('stairs', x - s / 2, y - s / 2, s); return; }
    if (id === 'room') { L.rrect(x - s / 2, y - s / 2, s, s, 2, [0.65, 0.6, 0.55], [0.65, 0.6, 0.55]); L.rrect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4, 1, [0.49, 0.45, 0.42], [0.42, 0.39, 0.37]); return; }
    const [c0, c1] = GEM[id], r = s / 2;
    L.rrect(x - r - 1.5, y - r - 1.5, s + 3, s + 3, r + 1.5, [0.06, 0.04, 0.04], [0.06, 0.04, 0.04]);
    L.rrect(x - r, y - r, s, s, r, c0, c1);
    L.rrect(x - r * 0.55, y - r * 0.6, r * 0.6, r * 0.5, r * 0.25, [1, 1, 1], [1, 1, 1], 0.75);
    if (id === 'boss') { L.rrect(x - r * 0.45, y - r * 0.25, r * 0.9, r * 0.6, r * 0.3, [0.98, 0.92, 0.85], [0.98, 0.92, 0.85]); L.solid(x - r * 0.3, y - r * 0.05, r * 0.2, r * 0.2, [0.3, 0.02, 0.02]); L.solid(x + r * 0.1, y - r * 0.05, r * 0.2, r * 0.2, [0.3, 0.02, 0.02]); }
  }
  // the compass rose of the concept's map panel; the long needle points north
  function compass(cx, cy, r) {
    const ink = [0.29, 0.18, 0.1];
    L.ring(cx, cy, r * 0.62, r * 0.62, ink, 0.7, 0.08);
    const ndl = (a, len, col) => { for (let i = 0; i < 6; i++) { const q = i / 6, w = (1 - q) * r * 0.16 + 1, d = q * len; L.solid(cx + Math.cos(a) * d - w / 2, cy + Math.sin(a) * d - w / 2, w, w, col, a + Math.PI / 4, w / 2, w / 2); } };
    for (let i = 0; i < 4; i++) ndl(i * Math.PI / 2 + Math.PI / 4, r * 0.45, [0.55, 0.42, 0.3]);
    for (let i = 0; i < 4; i++) ndl(i * Math.PI / 2 - Math.PI / 2, i === 0 ? r * 0.95 : r * 0.75, i === 0 ? [0.49, 0.12, 0.07] : ink);
    [[TXT('hud.compass'), 0, -1], [TXT('hud.compass.2'), 1, 0], [TXT('hud.compass.3'), 0, 1], [TXT('hud.compass.4'), -1, 0]].forEach(([s, dx, dy]) => KIT.ink('mm_c' + s, s, cx + dx * (r + 7), cy + dy * (r + 10) + 1, { size: 20, al: 0.5, col: KIT.INK.d }));
  }
  // floor completion cells for the minimap: [id, icon, text, complete]
  function progress(R) {
    const f = SIM.Q.fstat(R), pc = (k, n) => Math.floor(100 * Math.min(1, k / n)) + '%', out = [];
    if (f.foes) out.push(['foes', 'it_sword', pc(f.kills, f.foes), f.kills >= f.foes]);
    if (f.lootN) out.push(['loot', 'chest', pc(f.loot, f.lootN), f.loot >= f.lootN]);
    // secrets as a share only, and always shown: neither how many the floor hides nor whether it hides any is given away
    if (!R.town) out.push(['sec', 'it_key', f.secN ? pc(f.sec, f.secN) : '0%', f.secN > 0 && f.sec >= f.secN]);
    return out;
  }

  // ---------------- hero screen ----------------
  // look B (TASKS 1332): a window's close cross on a cell, its sort buttons, a leather plate under light text
  // the way out of a window is a parchment button of the kit, its two ends meeting round the cross (TASKS 1760)
  const closeBtn = (id, U, S) => { const b = U.r.find((q) => q.id === 'close'), lit = S.hover === 'close', dy = lit && S.pressWas ? 2 : 0;
    KIT.nine('btn', b.x - 6, b.y + dy, b.w + 12, b.h, { u: { grade: lit ? [1.08, 1.13, 0, 1.04] : [1, 1, 0, 1] } });
    KIT.ink(id + '_l', '×', b.x + b.w / 2, b.y + b.h / 2 - 2 + dy, { size: 40, al: 0.5, col: lit ? KIT.INK.r : KIT.INK.t }); L.uiBox(id, b.x, b.y, b.w, b.h, 0); };
  const sortBtns = (id, U, S) => { for (const b of U.r) if (b.id.startsWith('sort')) KIT.button(id + b.id, Object.assign({}, b, { size: 22 }), KIT.st(S, b.id)); };
  const edge = (x, y, w, h, c, t = 2, a = 1) => { L.solid(x, y, w, t, c, 0, 0, 0, a); L.solid(x, y + h - t, w, t, c, 0, 0, 0, a); L.solid(x, y, t, h, c, 0, 0, 0, a); L.solid(x + w - t, y, t, h, c, 0, 0, 0, a); };
  // the leather darkened under small light text, so the dim lines keep their contrast (TASKS 1332)
  const DARK = [1, 0.62, 0, 1.05];
  const plate = (id, x, y, w, h, o = {}) => { KIT.nine('leather', x, y, w, h, { k: o.k || 0.3, u: { grade: o.grade || DARK, alpha: o.a ?? 1 } }); L.uiBox(id, x, y, w, h, o.pad ?? 4); };
  const BRASS = [0.66, 0.5, 0.28];
  // the bag's tabs over its grid (TASKS 1687), the open one raised with its seal; while a piece is held the tab under it is lit
  // each tab carries a badge with its free cells (TASKS 1786), red at none, so a full pouch shows before a drop on it is refused;
  // a badge, as the count in the label left the pouch's name no room on the narrow tabs
  const bagTabs = (id, U, S) => { const bag = S.run.hero.bag, tabs = U.r.filter((q) => q.tab !== undefined), open = 'btab:' + Math.max(0, Math.min(tabs.length - 1, S.bagTab | 0));
    KIT.tabs(id, tabs, open, S);
    for (const q of tabs) { const T = D.bagTabs(bag.length)[q.tab], n = bag.slice(T.a, T.a + T.n).filter((it) => !it).length, s = String(n), bw = Math.max(30, lw(id + '_fw', s, { size: 20 }) + 16), bx = q.x + q.w - bw - 6, by = q.y - (q.id === open ? 8 : 0) - 14;
      L.rrect(bx, by, bw, 28, 14, n ? [0.2, 0.13, 0.09] : [0.62, 0.14, 0.08], n ? [0.12, 0.08, 0.05] : [0.42, 0.08, 0.05], 0.95);
      lab(id + '_f' + q.tab, s, bx + bw / 2, by + 14, { size: 20, al: 0.5, col: n ? '#e8d6b0' : '#fff2e0' }); L.uiBox(id + '_fb' + q.tab, bx, by, bw, 28, 0); } const hb = S.drag && tabs.find((q) => q.id === S.hover); if (hb) edge(hb.x + 6, hb.y - 2, hb.w - 12, hb.h + 2, [1, 0.82, 0.35], 3); };
  const nf = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  // what one point of a stat gives, from the stats' own formula with the point and without it (TASKS 1847)
  const GAIN = [['atk', (v) => TXT('hud.stat.atk', { v })], ['def', (v) => TXT('hud.stat.def', { v })], ['maxHp', (v) => TXT('hud.stat.maxHp', { v })], ['maxMp', (v) => TXT('hud.stat.maxMp', { v })],
    ['crit', (v) => TXT('hud.stat.crit', { v })], ['dodge', (v) => TXT('hud.stat.dodge', { v })], ['aspd', (v) => TXT('hud.stat.aspd', { v })], ['mspd', (v) => TXT('hud.stat.mspd', { v })]];
  function statGain(S, h, k) { const a = SIM.Q.stats(h, S.meta), b = SIM.Q.stats(Object.assign({}, h, { base: Object.assign({}, h.base, { [k]: h.base[k] + 1 }) }), S.meta), out = [];
    for (const [q, say] of GAIN) if (Math.abs(b[q] - a[q]) >= 0.05) out.push(say(nf(b[q] - a[q])));
    const sp = Math.round(b.spellBase * b.spell - a.spellBase * a.spell); if (sp > 0) out.push(TXT('hud.stat.spell', { v: sp }));
    return out.length ? [TXT('hud.stat.one'), ...out] : [TXT('hud.stat.none')]; }
  // a skill's number at a rank, as its card's line says it
  const abD = (A, r, st, R) => { const k = D.abRank(A.id, r).k; return A.id === 'whirl' ? Math.round(k * 100) : A.id === 'fireball' ? D.fireDmg(st.spellBase, k, st.spell) : A.id === 'frost' ? D.frostDmg(st.spellBase, k, st.spell) : A.id === 'charge' ? Math.round(k * D.CHARGE.k * 100) : A.id === 'cry' ? Math.round((D.CRY.buff - 1) * 100) : A.id === 'volley' ? Math.round(k * D.VOLLEY.k * 100) : A.id === 'trap' ? Math.round(k * D.TRAP.k * 100) : A.id === 'leap' ? Math.round(k * D.LEAP.k * 100) : D.shieldHp(st.int, Math.max(1, r), R.floor); };
  const abDesc = (A, r, st, R) => A.desc.replace('{d}', abD(A, r, st, R)).replace('{t}', nf(D.abRank(A.id, r).t)).replace('{w}', Math.round((1 - D.CRY.weak) * 100));
  // the next rank against this one, a line for each number that moves; a fork the rank opens is said before the press
  function abTip(h, A, r, st, R, pend, forkAt) {
    if (r >= D.AB_MAX) return [TXT('hud.abtip.max', { r })];
    const n = r + 1, a = D.abRank(A.id, Math.max(1, r)), b = D.abRank(A.id, n), pc = A.desc.includes('{d}%') ? '%' : '', out = [];
    if (!r) out.push(abDesc(A, 1, st, R));
    else { const d0 = abD(A, r, st, R), d1 = abD(A, n, st, R); if (d1 !== d0) out.push(TXT('hud.abtip.power', { a: d0 + pc, b: d1 + pc }));
      if (b.cd !== a.cd) out.push(TXT('hud.abtip.cd', { a: nf(A.cd * a.cd), b: nf(A.cd * b.cd) }));
      if (b.t && b.t !== a.t) out.push(TXT('hud.abtip.dur', { a: nf(a.t), b: nf(b.t) }));
      if (b.r && a.r && b.r > a.r) out.push(TXT('hud.abtip.reach', { p: Math.round((b.r / a.r - 1) * 100) })); }
    if (forkAt) out.push(TXT('hud.abtip.forkNext'));
    if (pend) out.push(TXT('hud.abtip.forkNow')); else if (h.lvl < A.unlock) out.push(TXT('hud.abtip.locked', { unlock: A.unlock })); else if (h.sp <= 0) out.push(TXT('hud.abtip.noSp'));
    return [r ? TXT('hud.abtip.next', { r: n }) : TXT('hud.abtip.learn'), out]; }
  function inv(S, R, t) {
    const h = R.hero, st = SIM.Q.stats(h, S.meta), U = D.UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab), P = U.P, Lp = U.L, Rp = U.R, I = KIT.INK, cx = Lp.x + Lp.w / 2;
    dim(0.45);
    KIT.panel('inv', Lp.x, Lp.y, Lp.w, Lp.h, 'leather'); KIT.panel('inv_r', Rp.x, Rp.y, Rp.w, Rp.h, 'torn', { pad: 0 });
    KIT.banner('inv_t', cx, Lp.y + 16, 340, TXT('hud.inv'), { h: 72, size: 34 });
    // portrait and level between the two columns of gear
    L.solid(cx - 121, Lp.y + 106, 242, 206, [0.05, 0.035, 0.03]); L.sprite(portraitOf(h), cx - 115, Lp.y + 112, { w: 230, h: 194, src: [0.04, 0.0, 0.96, 0.77] }); edge(cx - 121, Lp.y + 106, 242, 206, BRASS, 3);
    L.uiBox('inv_por', cx - 121, Lp.y + 106, 242, 206);
    KIT.light('inv_lv', TXT('hud.inv.5', { lvl: h.lvl }), cx, Lp.y + 340, { size: 30, al: 0.5 });
    KIT.bar('inv_xp', cx - 130, Lp.y + 362, 260, 22, h.xp / D.xpNeed(h.lvl), [0.95, 0.75, 0.25], [0.6, 0.4, 0.08]);
    KIT.light('inv_xpn', TXT('hud.inv.6', { xp: h.xp, p2: D.xpNeed(h.lvl) }), cx, Lp.y + 404, { size: 19, al: 0.5, col: '#cdb89a' });
    const dr = S.drag, held = (id) => dr && dr.from === id;
    for (const b of U.r) if (b.id.startsWith('eq:')) slot(S, b, held(b.id) ? null : h.eq[b.slot], b.slot);
    const he = U.r.find((q) => q.id === S.hover && q.slot && !h.eq[q.slot]);
    // stats, and under them what it all adds up to
    L.solid(Lp.x + 44, Lp.y + 444, Lp.w - 88, 2, BRASS, 0, 0, 0, 0.7);
    KIT.light('inv_pts', h.pts > 0 ? TXT('hud.inv.7', { pts: h.pts }) : TXT('hud.inv.8'), Lp.x + 50, Lp.y + 462, { size: 24, col: h.pts > 0 ? C.gold : '#cdb89a' });
    D.STATS.forEach((s, i) => { const b = U.r.find((q) => q.id === 'stat:' + s.k), y = b.y + b.h / 2;
      KIT.light('st_n' + i, s.name, Lp.x + 50, y, { size: 26, col: '#cdb89a' }); KIT.light('st_v' + i, h.base[s.k] + (st[s.k] - h.base[s.k] ? ' (+' + (st[s.k] - h.base[s.k]) + ')' : ''), Lp.x + 150, y, { size: 26 });
      if (h.pts > 0) { KIT.cell('st_b' + i, b.x, b.y, b.w, KIT.st(S, b.id)); KIT.light('st_p' + i, '+', b.x + b.w / 2, b.y + b.h / 2, { size: 30, al: 0.5, col: C.gold }); }
      const tip = statGain(S, h, s.k); tipAt(Lp.x + 44, b.y - 4, 236, b.h + 8, s.full, tip); tipAt(b.x - 4, b.y - 4, b.w + 8, b.h + 8, s.full, tip); });
    const draft = h.draft || {}, rst = (id, on) => { if (on) KIT.button('inv_' + id, Object.assign({}, U.r.find((q) => q.id === id), { size: 22 }), KIT.st(S, id)); };
    rst('reset:st', Object.values(draft.st || {}).some((n) => n > 0));
    const pct = (v) => (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + '%', num = (v) => Math.round(v * 10) / 10;
    const derived = [[TXT('hud.inv.derived'), st.atk], [TXT('hud.inv.derived.2'), st.def], [TXT('hud.inv.derived.3'), st.maxHp], [TXT('hud.inv.derived.4'), st.maxMp], [TXT('hud.inv.derived.5'), Math.round(st.crit) + '%'], [TXT('hud.inv.derived.12'), '×' + String(Math.round(st.critK * 100) / 100).replace('.', ',')], [TXT('hud.inv.derived.6'), num(st.dodge) + '%'], [TXT('hud.inv.derived.7'), pct(st.aspd)],
      [TXT('hud.inv.derived.8'), pct(st.mspd)], [TXT('hud.inv.derived.9'), st.leech ? num(st.leech) + '%' : '—'], [TXT('hud.inv.derived.10'), st.regen ? '+' + num(st.regen) : '—'], [TXT('hud.inv.derived.11'), st.onhit ? '+' + num(st.onhit) : '—']];
    const dy0 = Lp.y + 694, half = Math.ceil(derived.length / 2), colW = (Lp.w - 100 - 28) / 2;
    L.solid(Lp.x + 44, dy0 - 20, Lp.w - 88, 2, BRASS, 0, 0, 0, 0.7);
    derived.forEach(([n, v], i) => { const x = Lp.x + 50 + Math.floor(i / half) * (colW + 28), y = dy0 + 6 + (i % half) * 27;
      KIT.light('dv_n' + i, n, x, y, { size: 19, col: '#cdb89a' }); KIT.light('dv_v' + i, v, x + colW, y, { size: 20, al: 1 }); });
    L.uiBox('inv_der', Lp.x + 44, dy0 - 14, Lp.w - 88, half * 27 + 10);
    { const gs = String(h.gold), ss = String(S.meta.shards), y = Lp.y + Lp.h - 40, gw = lw('inv_g', gs, { size: 26 }) + 40, sw = lw('inv_souls', ss, { size: 26 }) + 40, x0 = cx - (gw + sw + 40) / 2;
      icon('crystal', x0, y - 16, 32); KIT.light('inv_souls', ss, x0 + 40, y, { size: 26, col: '#9cc8ff' });
      icon('it_gold', x0 + sw + 40, y - 16, 32); KIT.light('inv_g', gs, x0 + sw + 80, y, { size: 26, col: C.gold });
      tipAt(x0 - 4, y - 20, sw + 8, 40, TXT('hud.stats.hand', { n: ss })); tipAt(x0 + sw + 36, y - 20, gw + 8, 40, TXT('hud.altar.6', { gold: gs }), TXT('hud.tip.gold')); }
    // the bag on the sheet
    bagTabs('inv_tb', U, S);
    for (const b of U.r) if (b.id.startsWith('bag:')) slot(S, b, held(b.id) ? null : h.bag[b.i]);
    sortBtns('inv_', U, S);
    // skills
    KIT.ink('inv_sk', h.sp > 0 ? TXT('hud.inv.11', { sp: h.sp }) : TXT('hud.inv.12'), Rp.x + 76, Rp.y + 440, { size: 28, col: h.sp > 0 ? I.r : I.d });
    rst('reset:ab', Object.values(draft.ab || {}).some((n) => n > 0) || draft.mast > 0);
    if (h.mast) KIT.ink('inv_mst', TXT('hud.inv.mastery', { n: h.mast, pct: String(h.mast * D.MASTERY.pct).replace('.', ',') }), Rp.x + Rp.w - 76, Rp.y + 440, { size: 22, al: 1, col: I.g });
    D.clsOf(h).abs.forEach((A, i) => { const b = U.r.find((q) => q.id === 'ab:' + A.id), r = h.ab[A.id] || 0, can = h.sp > 0 && h.lvl >= A.unlock && r < D.AB_MAX;
      plate('ab_' + i, b.x, b.y, b.w, b.h, { k: 0.4, grade: S.hover === b.id && can ? [1, 0.85, 0, 1.05] : DARK });
      icon(A.icon, b.x + 16, b.y + 22, 70, { alpha: r ? 1 : 0.3 });
      lab('ab_n' + i, A.name, b.x + 98, b.y + 46, { size: L.sizeToFit(A.name, b.w - 110, 22), col: C.text });
      lab('ab_r' + i, r ? TXT('hud.inv.13', { r, AB_MAX: D.AB_MAX }) : TXT('hud.inv.14', { unlock: A.unlock }), b.x + 98, b.y + 78, { size: 20, col: r ? C.gold : C.dim });
      { const cs = abCost(D.clsOf(h), A, r); lab('ab_c' + i, cs, b.x + 20, b.y + b.h - 34, { size: L.sizeToFit(cs, b.w - 90, 18), col: C.dim }); }
      const ds = abDesc(A, r, st, R), parts = ds.split(': '), forkAt = r < D.AB_MAX && D.FORKS[A.id] && D.FORK_RANKS.includes(r + 1);
      const chosen = D.FORK_RANKS.map((q) => { const n = (h.forks || {})[D.forkKey(A.id, q)]; return n >= 0 ? D.POWERS[D.FORKS[A.id][q][n]].name : ''; }).filter(Boolean).join(', ');
      // the next rank's fork shows on the card before the press (TASKS 1847), not only as «Ждёт выбора» after it
      const pend = D.forkPending(h) && D.forkPending(h).ab === A.id, fl = pend ? TXT('hud.fork.pending') : forkAt ? TXT('hud.abtip.forkAt', { r: r + 1 }) : '';
      if (fl && (pend || !chosen)) lab('ab_f' + i, fl, b.x + 20, b.y + b.h - 66, { size: 20, col: '#ffb060' }); else if (chosen) lab('ab_f' + i, chosen, b.x + 20, b.y + b.h - 66, { size: L.sizeToFit(chosen, b.w - 40, 18), col: C.gold });
      tipAt(b.x, b.y, b.w, b.h, ...abTip(h, A, r, st, R, !!D.forkPending(h), forkAt));
      L.solid(b.x + 20, b.y + 122, b.w - 40, 1, [0.66, 0.5, 0.28], 0, 0, 0, 0.4);
      { const d0 = parts[0] + ':', d1 = parts[1] || ''; if (lw('ab_d' + i, d0, { size: 20 }) > b.w - 40) wrapLab('ab_e' + i, ds, b.x + 20, b.y + 146, b.w - 40, 20, C.text);
        else { lab('ab_d' + i, d0, b.x + 20, b.y + 146, { size: 20, col: C.dim }); wrapLab('ab_e' + i, d1, b.x + 20, b.y + 176, b.w - 40, 20, C.text); } }
      if (can) { L.rrect(b.x + b.w - 52, b.y + b.h - 52, 32, 32, 16, [1, 0.75, 0.2], [0.8, 0.45, 0.1], 0.6 + 0.4 * Math.sin(t * 5)); lab('ab_p' + i, '+', b.x + b.w - 36, b.y + b.h - 36, { size: 24, al: 0.5, col: '#2a1606', out: '' }); } });
    { const p = TXT('hud.inv.drag').split(' · '), n = Math.ceil(p.length / 2); [p.slice(0, n), p.slice(n)].forEach((q, i) => KIT.ink('inv_help' + i, q.join(' · '), Rp.x + Rp.w / 2, Rp.y + Rp.h - 84 + i * 28, { size: 26, al: 0.5, col: I.d })); }
    closeBtn('inv_x', U, S);
    if (he) { const s = D.SLOT_NAME[he.slot], w = lw('sle', s, { size: 20 }) + 32; plate('slh', he.x + he.w / 2 - w / 2, he.y + he.h + 6, w, 36);
      lab('sle', s, he.x + he.w / 2, he.y + he.h + 25, { size: 20, al: 0.5 }); }
    // tooltip
    if (dr) { const it = dr.from.startsWith('bag:') ? h.bag[+dr.from.split(':')[1]] : h.eq[dr.from.slice(3)]; if (it) icon(SIM.Q.itemIcon(it), dr.x - 34, dr.y - 34, 68); dropChip(S, U); refusal(S, Rp.x + Rp.w / 2, Rp.y + Rp.h - 130, I.r); return; }
    refusal(S, Rp.x + Rp.w / 2, Rp.y + Rp.h - 130, I.r);
    const hb = U.r.find((q) => q.id === S.hover); if (hb) { const it = hb.id.startsWith('bag:') ? h.bag[hb.i] : hb.id.startsWith('eq:') ? h.eq[hb.slot] : null; if (it) tooltip(S, it, hb, h, null, null, [10, P.y + 8, P.x + P.w - 8, P.y + P.h - 8]); }
  }
  // ---------------- the merchant's screen ----------------
  function shop(S, R, t) {
    const h = R.hero, sh = R.shop, U = D.UI.shop(sh.goods.length, h.bag.length, S.bagTab), P = U.P, f = SIM.Q.tradeDepth(R);
    dim(0.6); KIT.panel('shop', P.x, P.y, P.w, P.h, 'leather');
    lab('sh_t', sh.wander ? TXT('hud.shop') : TXT('hud.shop.2'), P.x + 60, P.y + 58, { size: 36, col: C.gold }); lab('sh_j', sh.wander ? TXT('hud.shop.job.w') : TXT('hud.shop.job'), P.x + 60, P.y + 94, { size: 19, col: '#cdb89a' });
    const gs = TXT('hud.shop.gs', { gold: h.gold }); lab('sh_g', gs, P.x + P.w - 130, P.y + 60, { size: 28, al: 1, col: C.gold }); icon('it_gold', P.x + P.w - 130 - lw('sh_g', gs, { size: 28 }) - 46, P.y + 42, 36);
    const price = (id, b, n, can) => { const s = String(n), w = lw(id, s, { size: 19 }) + 24; icon('it_gold', b.x + b.w / 2 - w / 2, b.y + b.h + 6, 20); lab(id, s, b.x + b.w / 2 - w / 2 + 24, b.y + b.h + 17, { size: 19, col: can ? C.gold : '#9a7a6a' }); };
    lab('sh_buy', R.town ? TXT('hud.shop.3', { p1: sh.at ? TXT('hud.shop.4', { at: sh.at }) : '' }) : sh.wander ? TXT('hud.shop.5', { floor: R.floor }) : TXT('hud.shop.6', { floor: R.floor }), P.x + 60, P.y + 132, { size: 23, col: '#cdb89a' });
    sh.goods.forEach((g, i) => { const b = U.r.find((q) => q.id === 'buy:' + i); slot(S, b, g.n ? Object.assign({}, g.it, { n: g.n }) : g.it); price('shp_b' + i, b, g.price, h.gold >= g.price); });
    lab('sh_back', TXT('hud.shop.7'), P.x + 60, P.y + 520, { size: 23, col: '#cdb89a' });
    for (let i = 0; i < D.SHOP.buyback; i++) { const b = U.r.find((q) => q.id === 'back:' + i), g = sh.back[i]; slot(S, b, g && g.it); if (g) price('shp_k' + i, b, g.price, h.gold >= g.price); }
    lab('sh_bag', TXT('hud.shop.8'), P.x + 700, P.y + 102, { size: 23, col: '#cdb89a' }); bagTabs('sh_tb', U, S);
    for (const b of U.r) { if (!b.id.startsWith('sell:')) continue; const it = h.bag[b.i]; slot(S, b, it); if (it) price('shp_s' + b.i, b, D.sellPrice(it, f), true); }
    // the merchant himself, his line for this visit
    const mx = P.x + 140, my = P.y + P.h - 40, mn = sh.wander ? 'wanderer' : 'merchant', [mw, mh] = SZ(mn), k = 2.1;
    L.sprite(mn, mx - mw * k / 2, my - mh * k, { w: mw * k, h: mh * k }); L.uiBox('sh_merch', mx - mw * k / 2, my - mh * k, mw * k, mh * k);
    const LN = sh.wander ? D.SHOP.wander.lines : D.SHOP.lines, line = '«' + LN[sh.line % LN.length] + '»', ql = lw('sh_line_m', line, { size: 22 }) > 520 ? halves(line) : [line], bw = Math.max(...ql.map((q) => lw('sh_line_m', q, { size: 22 }))) + 48;
    const bh = 24 + 28 * ql.length, ty = my - mh * k - 38 - bh; plate('sh_bubble', P.x + 60, ty, bw, bh); ql.forEach((q, i) => lab('sh_line' + i, q, P.x + 84, ty + 26 + i * 28, { size: 22, col: '#fff2c8' }));
    refusal(S, P.x + 380, P.y + P.h - 114);
    if (!sh.wander) { const b = U.r.find((q) => q.id === 'talk'); KIT.button('sh_orig', b, KIT.st(S, b.id)); }
    lab('sh_help', TXT('hud.shop.9'), P.x + P.w / 2, P.y + P.h + 30, { size: 26, al: 0.5, col: '#b8a48a' });
    const Cd = U.card; L.rrect(Cd.x, Cd.y, Cd.w, Cd.h, 10, [0.1, 0.05, 0.04], [0.07, 0.035, 0.03], 0.3);
    closeBtn('sh_x', U, S);
    const hb = U.r.find((q) => q.id === S.hover), idle = () => lab('sh_card0', TXT('hud.shop.card'), Cd.x + Cd.w / 2, Cd.y + Cd.h / 2, { size: 21, al: 0.5, col: '#9a8670' }); if (!hb) return idle();
    const g = hb.id.startsWith('buy:') ? sh.goods[hb.i] : hb.id.startsWith('back:') ? sh.back[hb.i] : null, it = g ? g.it : hb.id.startsWith('sell:') ? h.bag[hb.i] : null;
    // the details sit in a fixed pane: a floating tip would cover the next slots' prices
    if (it) tooltip(S, it, hb, h, g ? [TXT('hud.shop.10', { price: g.price }), h.gold >= g.price ? C.gold : C.red] : [TXT('hud.shop.11', { p1: D.sellPrice(it, f) }), C.gold], [Cd.x, Cd.y], [Cd.x, Cd.y, Cd.x + Cd.w, Cd.bot]); else idle();
  }
  // an empty gear slot shows the outline of what goes in it, its name on hover
  const SLOT_SIL = { weapon: 'it_sword', offhand: 'it_shield', helm: 'it_helm_k', armor: 'it_armor_p', gloves: 'it_gloves', boots: 'it_boots', ring: 'it_ring', amulet: 'it_amulet' };
  // tag: the item's classes written in the cell's corner (the stash, kept for a hero of any class, TASKS 1102)
  // what letting go of the held piece over this cell does: 1 swaps with what lies there (or moves in), 2 wears it, -1 is refused
  function dropKind(S, b) {
    const dr = S.drag, h = S.run && S.run.hero; if (!dr || !h || b.id === dr.from) return 0;
    const f = dr.from, fb = f.startsWith('bag:') ? h.bag[+f.slice(4)] : f.startsWith('eq:') ? h.eq[f.slice(3)] : null, fits = (it, sl) => !!it && !SIM.Q.isCons(it) && D.BASES[it.b].slot === sl;
    if (b.id.startsWith('eq:')) return f.startsWith('bag:') ? (fits(fb, b.slot) ? 2 : -1) : 0;
    if (b.id.startsWith('stash:')) return 1;
    if (!b.id.startsWith('bag:')) return 0;
    if (!f.startsWith('eq:')) return 1;
    const o = h.bag[b.i]; return !o || fits(o, f.slice(3)) ? 1 : -1;
  }
  // a small plate behind a corner mark, so the mark reads as a badge and not as writing on the item's picture
  function chip(id, s, x, y, o) {
    const sz = o.size || 20, w = lw(id, s, { size: sz }) + 10, cx = o.mid ? x - w / 2 : o.right ? x - w : x;
    L.rrect(cx, y, w, sz + 6, 4, [0.1, 0.05, 0.05], [0.04, 0.02, 0.02], 0.9); L.uiBox(id + '_b', cx, y - 1, w, sz + 8, 0); lab(id, s, cx + w / 2, y + (sz + 6) / 2 + 1, { size: sz, al: 0.5, col: o.col });
  }
  // over the held piece's picture, on the cell it would swap into or be worn in
  function dropChip(S, U) {
    const b = S.drag && U.r.find((q) => q.id === S.hover); if (!b || dropKind(S, b) < 1) return;
    const h = S.run.hero, it = b.id.startsWith('bag:') ? h.bag[b.i] : b.id.startsWith('eq:') ? h.eq[b.slot] : b.id.startsWith('stash:') ? SIM.Q.stashOf(S).items[b.i] : null;
    if (it || b.id.startsWith('eq:')) chip('slt_' + b.id, (b.id.startsWith('eq:') ? TXT('hud.inv.target.wear') : TXT('hud.inv.target.swap')), b.x + b.w / 2, b.y + b.h - 26, { size: 20, col: '#ffe9a8', mid: 1 });
  }
  function slot(S, b, it, empty, tag) {
    const hv = S.hover === b.id, col = it ? D.RARITY[it.rar].col : null, dk = hv ? dropKind(S, b) : 0, s = b.w;
    KIT.cell('sl_' + b.id, b.x, b.y, s, Object.assign(KIT.st(S, b.id), { focus: false }));
    if (it && it.rar) { if (it.rar >= 2) L.rrect(b.x + 6, b.y + 6, s - 12, s - 12, 4, col, [0, 0, 0], 0.2); edge(b.x + 4, b.y + 4, s - 8, s - 8, col, 2, 0.85); }
    // where the held piece would land: a brass frame, or a red one where it is refused
    if (dk) { const c = dk > 0 ? [1, 0.82, 0.35] : [0.95, 0.22, 0.16]; L.solid(b.x + 4, b.y + 4, s - 8, s - 8, c, 0, 0, 0, 0.2); edge(b.x - 3, b.y - 3, s + 6, s + 6, c, 3); }
    if (it) { icon(SIM.Q.itemIcon(it), b.x + 8, b.y + 8, s - 16);
      if (it.n > 1) lab('sln_' + b.id, it.n, b.x + s - 8, b.y + s - 14, { size: 19, al: 1 });
      const hr = S.run && S.run.hero, cons = SIM.Q.isCons(it);
      if (tag && !cons && D.BASES[it.b].cls) chip('slc_' + b.id, D.BASES[it.b].cls.map((c) => D.CLASSES[c].name[0]).join(''), b.x + 4, b.y + s - 24, { col: '#b8aa98', size: 20 });
      if (hr && !cons && !D.wears(D.clsOf(hr).id, it.b)) { L.rrect(b.x + 4, b.y + 4, s - 8, s - 8, 4, [0.9, 0.15, 0.1], [0.4, 0.02, 0.02], 0.22); chip('slx_' + b.id, '×', b.x + s - 4, b.y + 4, { right: 1, size: 20, col: '#ff6a5a' }); }
      else if (hr && hr.lvl < D.reqLvl(it)) { L.rrect(b.x + 4, b.y + 4, s - 8, s - 8, 4, [0.9, 0.15, 0.1], [0.4, 0.02, 0.02], 0.22); chip('slr_' + b.id, String(D.reqLvl(it)), b.x + s - 4, b.y + 4, { right: 1, size: 20, col: '#ff6a5a' }); } }
    if (!it && empty) icon(SLOT_SIL[empty], b.x + 12, b.y + 12, s - 24, { grade: [0, hv ? 0.7 : 0.5, 0.6, 1], haze: hv ? [0.3, 0.26, 0.22] : [0.17, 0.15, 0.14], alpha: 0.8 });
  }
  // against the piece worn in the same slot: every stat it adds or takes away, the worn piece's own affixes included, then the
  // hero's max health, attack and defence before and after the swap, so an "upgrade" can't quietly cost health (TASKS 182)
  const UP = '#8fd98a', DOWN = '#e0604f';
  // a worn piece that adds nothing to a stat leaves the card's own line as the whole difference, so only stats the worn piece
  // also gives are listed; `dim` mutes the comparison of a piece that can't be worn yet, `compact` drops the stat rows
  function compare(S, it, slot, h, lines, o) {
    const cur = h.eq[slot], of = (x) => { const m = { atk: (x && x.atk) || 0, def: (x && x.def) || 0 }; if (x) { const q = SIM.Q.itemMods(x); for (const k in q) m[k] = (m[k] || 0) + q[k]; } return m; };
    const a = of(it), c = of(cur), num = (v) => String(Math.round(Math.abs(v) * 10) / 10), mute = (col) => (o.dim ? C.dim : col);
    lines.push([cur ? TXT('hud.compare', { p1: SIM.Q.itemName(cur) }) : TXT('hud.compare.2', { p1: D.SLOT_NAME[slot] }), C.dim, 19]);
    if (cur) lines.push(['   ' + TXT('hud.compare.lvl', { p1: it.lvl, p2: cur.lvl }), mute(it.lvl > cur.lvl ? UP : it.lvl < cur.lvl ? DOWN : C.dim), 19]);
    if (!o.compact) for (const k of D.AFFIXES.map((q) => q.k)) { const d = (a[k] || 0) - (c[k] || 0); if (Math.abs(d) < 0.05 || !c[k]) continue;
      lines.push(['   ' + D.AFFIXES.find((q) => q.k === k).label.replace('+{v}', (d > 0 ? '+' : '−') + num(d)), mute(d > 0 ? UP : DOWN), 19]); }
    const s0 = SIM.Q.stats(h, S.meta), s1 = SIM.Q.stats(Object.assign({}, h, { eq: Object.assign({}, h.eq, { [slot]: it }) }), S.meta);
    const tot = [[TXT('hud.compare.tot'), 'maxHp'], [TXT('hud.compare.tot.2'), 'atk'], [TXT('hud.compare.tot.3'), 'def']].filter(([, k]) => Math.round(s1[k]) !== Math.round(s0[k]));
    if (tot.length) lines.push([TXT('hud.compare.3', { p1: tot.map(([n, k]) => n + ' ' + Math.round(s0[k]) + ' → ' + Math.round(s1[k])).join(' · ') }),
      mute(tot.every(([, k]) => s1[k] >= s0[k]) ? UP : tot.every(([, k]) => s1[k] <= s0[k]) ? DOWN : C.gold), 20]);
  }
  function tooltip(S, it, b, h, deal, at, box) {
    const bx = box || [10, 10, W - 10, H - 10], cons = SIM.Q.isCons(it), B = cons ? null : D.BASES[it.b];
    const make = (compact) => { const lines = [];
      lines.push([SIM.Q.itemName(it), hex(D.RARITY[it.rar].col), 28]);
      if (!cons) { lines.push([TXT('hud.tooltip', { name: D.RARITY[it.rar].name, p2: D.SLOT_NAME[B.slot], lvl: it.lvl }), C.dim, 20]);
        if (B.cls) lines.push([TXT('hud.tooltip.cls', { p1: D.clsNames(it.b) }), D.wears(D.clsOf(h).id, it.b) ? C.dim : '#ff6a5a', 20]);
        const rq = D.reqLvl(it); if (rq > 1) lines.push([TXT('hud.tooltip.2', { rq }), h.lvl < rq ? '#ff6a5a' : C.dim, 20]);
        if (it.atk) lines.push([TXT('hud.tooltip.3', { atk: it.atk, p2: B.spell ? TXT('hud.tooltip.4', { p1: Math.round(B.spell * 100) }) : B.pierce ? TXT('hud.tooltip.pierce') : B.shotV ? TXT('hud.tooltip.far') : '' }), C.text, 22]);
        if (it.def) lines.push([TXT('hud.tooltip.5', { def: it.def }), C.text, 22]);
        const typed = SIM.Q.typeMods(it), mod = (m, col) => { for (const k in m) lines.push([D.AFFIXES.find((a) => a.k === k).label.replace('{v}', m[k]), col, 22]); };
        mod(typed, C.text); mod(it.mods, '#8fd98a');
        for (const e of it.ench || []) lines.push([TXT('hud.tooltip.6', { p1: D.AFFIXES.find((a) => a.k === e.k).label.replace('{v}', e.v) }), '#9cc8ff', 22]);
        const own = D.wears(D.clsOf(h).id, it.b);
        if (h.eq[B.slot] !== it && own) compare(S, it, B.slot, h, lines, { dim: h.lvl < rq, compact });
        if (!deal) lines.push([b.id.startsWith('eq:') ? TXT('hud.tooltip.7') : !own ? TXT('hud.tooltip.cls2') : h.lvl < rq ? TXT('hud.tooltip.8', { rq }) : TXT('hud.tooltip.9'), '#8a7d6c', 18]); }
      else { lines.push([it.b === 'hp_potion' ? TXT('hud.tooltip.10') : it.b === 'mp_potion' ? TXT('hud.tooltip.11') : S.run && S.run.viaTown ? TXT('hud.tooltip.12') : TXT('hud.tooltip.13'), C.text, 20]); if (!deal) lines.push([TXT('hud.tooltip.14'), '#8a7d6c', 18]); }
      if (!cons && !compact && it.rar === 4) { const L0 = TXT.talk('legends'), lore = L0[it.b] || L0[B.slot]; if (lore) { let ln = ''; for (const w of lore.split(' ')) { if ((ln + ' ' + w).length > 40) { lines.push([ln, '#c9b79c', 18]); ln = w; } else ln = ln ? ln + ' ' + w : w; } if (ln) lines.push([ln, '#c9b79c', 18]); } }
      if (deal) lines.push([deal[0], deal[1], 22]);
      return lines; };
    const size = (lines) => [Math.max(...lines.map(([s, , z], i) => lw('tt' + i, s, { size: z }))) + 60, lines.reduce((a, l) => a + l[2] * 1.45, 0) + 56];
    let lines = make(false), [w, hh] = size(lines);
    if (hh > bx[3] - bx[1]) { lines = make(true); [w, hh] = size(lines); }
    let x = b.x + b.w + 12, y = b.y; if (x + w > bx[2]) x = b.x - w - 12; y = Math.max(bx[1], Math.min(y, bx[3] - hh));
    if (at) { x = Math.max(10, Math.min(at[0], bx[2] - w)); y = Math.max(bx[1], Math.min(at[1], bx[3] - hh)); }
    L.uiCover('tip', x, y, w, hh);
    plate('tip', x, y, w, hh, { k: 0.45, grade: [1, 0.5, 0, 1.05], pad: 8 });
    // the name's rarity in a rule under it
    L.solid(x + 22, y + 26 + lines[0][2] * 1.45, w - 44, 2, D.RARITY[it.rar].col, 0, 0, 0, 0.8);
    let yy = y + 22; lines.forEach(([s, col, z], i) => { if (i === 1) yy += 10; yy += z * 0.72; lab('tt' + i, s, x + 30, yy, { size: z, col }); yy += z * 0.73; });
  }

  // ---------------- menus ----------------
  // one backdrop behind the front screens and the end screens (TASKS 1763, 1795 б). The crypt of ref_ui_menu_b is painted with
  // its fires out (TASKS 1751), the bowls holding cold coals and the sconces empty cups, so the flames flicker and the embers rise
  // here; their places are measured on bg_crypt at 1920×1080
  const CRYPT = { bowls: [[535, 658], [1375, 658]], cups: [[768, 524], [847, 526], [1073, 526], [1152, 524]], col: [1, 0.55, 0.2] };
  // in a view taller than 16:9 the painting covers it, scaled by its height and cut at the sides; bk maps its 1920×1080 places
  // onto the frame being drawn
  const bk = () => { const k = VH / 1080; return { k, x0: (W - 1920 * k) / 2, y0: -G.oy }; };
  function backdrop(t) {
    L.solid(0, -G.oy, W, VH, [0.02, 0.015, 0.02], 0, 0, 0, 1);
    if (!window.ASSETS.bg_crypt) return;
    const { k, x0, y0 } = bk(), fl = (i) => 0.85 + 0.1 * Math.sin(t * 9.1 + i * 3.7) + 0.06 * Math.sin(t * 23.3 + i * 1.3), col = CRYPT.col;
    L.sprite('bg_crypt', x0, y0, { w: 1920 * k, h: 1080 * k });
    CRYPT.bowls.forEach(([x, y], i) => { L.glow(x0 + x * k, y0 + (y - 40) * k, 300 * k, col, 0.2 * fl(i), 2.2); L.glow(x0 + x * k, y0 + (y - 20) * k, 110 * k, col, 0.22 * fl(i + 5), 2.6); });
    CRYPT.cups.forEach(([x, y], i) => L.glow(x0 + x * k, y0 + (y - 14) * k, 70 * k, col, 0.16 * fl(i + 2), 2.8));
    const fire = (x, y, w, hh, seed, lean) => G.draw(L.P.flame, { u_t: t, u_seed: seed, u_amt: 1, u_col: col }, [w * k, 0, 0, -lean * k, hh * k, 0, x0 + (x - w / 2 + lean) * k, y0 + (y - hh) * k, 1]);
    G.blend('emit');
    CRYPT.bowls.forEach(([x, y], i) => fire(x, y, 84 * fl(i), 120 * fl(i + 1), 11 + i, 6 * Math.sin(t * 1.3 + i * 2)));
    CRYPT.cups.forEach(([x, y], i) => fire(x, y, 18 * fl(i + 2), 34 * fl(i + 3), 21 + i, 2 * Math.sin(t * 1.7 + i)));
    G.blend('add');
    CRYPT.bowls.forEach(([x, y], b) => { for (let i = 0; i < 12; i++) { const p = (t * (0.28 + 0.12 * L.rnd(i, b + 1)) + L.rnd(i, b + 7)) % 1, s = 4 * k;
      const ex = x + (L.rnd(i, b + 3) - 0.5) * 60 + Math.sin(t * 1.9 + i * 2.3) * 14 * p, ey = y - 50 - p * 300;
      L.solid(Math.round((x0 + ex * k) / 2) * 2, Math.round((y0 + ey * k) / 2) * 2, s, s, [1, 0.6 + 0.3 * (1 - p), 0.2], 0, 0, 0, 0.9 * (1 - p) * Math.min(1, p * 8)); } });
    G.blend();
  }
  // the hero and a brute facing each other across the buttons; the news frame takes the brute's place on the right; on the main
  // menu (mid) the hero stands in the crypt's arch. It is the hero of the run under «Продолжить», or of the run played last (TASKS
  // 1815: a warrior stood there over a mage's save); with neither, the painted warrior
  function menuBack(t, alone, mid, S) {
    backdrop(t);
    const { k, x0, y0 } = bk(), [hw, hh] = SZ('hero'), hk = 3.2 * k, hx = x0 + k * (mid ? 900 - hw * 1.6 : 440 - hw * 1.6), hy = y0 + k * (mid ? 470 : 340);
    const own = S && ((S.saved && S.saved.hero) || (S.result && S.result.hero));
    if (own && D.clsOf(own).look.rig !== 'hero') { try { SCENE.menuHero(own, SIM.Q.stats(own, S.meta), t, hx + hw * hk / 2, hy + hh * hk, hk); } catch (e) { console.error(e); L.pre = null; G.blend(); } }
    else L.sprite('hero', hx, hy, { w: hw * hk, h: hh * hk });
    if (!(S && S.newAsk)) L.uiBox('menu_hero', hx, hy, hw * hk, hh * hk);
    if (alone) return;
    const [bw, bh] = SZ('en_brute'); L.sprite('en_brute', x0 + 1430 * k, y0 + 330 * k, { w: bw * 2.6 * k, h: bh * 2.6 * k, flip: true, u: { grade: [0.9, 0.75, 0, 1] } });
  }
  // the version's main lines (TASKS 1305), look B: a loose parchment sheet pinned with a brass nail, a red diamond a line
  function newsFrame(F, v) {
    const P = F.P; KIT.panel('nf_p', P.x, P.y, P.w, P.h, 'torn'); KIT.knob(P.x + P.w / 2, P.y + 20, 1.2);
    KIT.heading('nf_t', TXT('hud.news.main', { v }), P.x + P.w / 2, P.y + 72, { size: 34, wing: 60 });
    F.rows.forEach((r, i) => { if (r.first) { if (i) KIT.rule(P.x + 60, r.y - 20, P.w - 120, 0.45); L.solid(P.x + 58, r.y - 5, 10, 10, [0.49, 0.12, 0.07], 0.7854, 5, 5); }
      KIT.ink('nf_r' + i, r.s, P.x + 82, r.y, { size: 20 }); });
  }
  const savedLine = (S) => TXT('hud.savedLine', { p1: S.saved.mode === 'campaign' ? '' : D.runOf(S.saved.mode).name + ', ', p2: S.saved.floor ? TXT('hud.savedLine.2', { floor: S.saved.floor }) : TXT('hud.savedLine.3'), lvl: S.saved.hero.lvl });
  // the test runs (TASKS 417): a press over a saved run asks again, as on the main menu, so the save is named here too
  function tests(S, t) {
    menuBack(t, false, false, S);
    lab('ts_t', TXT('hud.tests'), W / 2, 220, { size: 104, al: 0.5, col: C.gold, out: '#2a0d06', bold: true });
    lab('ts_s', TXT('hud.tests.2'), W / 2, 310, { size: 28, al: 0.5, col: C.dim });
    if (!S.newAsk) for (const b of D.UI.tests(!!S.saved, SIM.Q.isFull(S))) button('tb_' + b.id, b, S.hover);
    if (S.saved) lab('ts_sv', savedLine(S), W / 2, 412, { size: 22, al: 0.5, col: '#9fd08a' });
    newAsk(S);
  }
  // the class screen (TASKS 1103): a card a ready class — its portrait, name, way of playing, three abilities and starting kit
  const abCost = (Cl, A, r) => { const cd = String(Math.round(A.cd * D.abRank(A.id, Math.max(1, r)).cd * 10) / 10).replace('.', ','); return A.mp ? TXT('hud.ab.cost', { mp: A.mp, res: Cl.resWord, cd }) : TXT('hud.ab.free', { cd }); };
  const halves = (s) => { if (s.length < 34) return [s]; const w = s.split(' '); let best = 1, d = 1e9;
    for (let i = 1; i < w.length; i++) { const k = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (k < d) { d = k; best = i; } }
    return [w.slice(0, best).join(' '), w.slice(best).join(' ')]; };
  // one lit control a screen (TASKS 1754, 1757): the keyboard's focus, which the pointer moves onto what it passes over, or the
  // pointer alone when nothing has the focus
  const litOf = (S, ids) => (ids.includes(S.focus) ? S.focus : ids.includes(S.hover) ? S.hover : '');
  // look B (TASKS 1304): the difficulty's tabs over the cards, each card a page in a leather frame, the chosen one sealed with wax
  function classes(S, t) {
    backdrop(t);
    const U = D.UI.classes(S.meta), dif = S.meta.diff || 'normal', cur = D.classesReady().includes(S.meta.cls) ? S.meta.cls : 'warrior';
    const lit = litOf(S, U.map((q) => q.id)), sl = (id) => ({ hover: lit === id, press: S.hover === id && !!S.pressWas, focus: false, off: false });
    KIT.tabs('cl_d', U.filter((b) => b.dif), 'dif:' + dif, S, { fill: true, lit });
    // the difficulty is the player's own choice (TASKS 1825), so the line tells the story instead of advising the easy one
    const tip = TXT('UI.classes.hint'), tz = L.sizeToFit(tip, W - 200, 26);
    KIT.light('cl_s', tip, W / 2, 142, { size: tz, al: 0.5, col: '#cdb894' }); L.uiBox('cl_s_b', 100, 120, W - 200, 44, 0);
    for (const b of U.filter((q) => q.cls)) {
      const Cl = D.CLASSES[b.cls], on = cur === b.cls, hot = lit === b.id;
      if (hot) L.glow(b.x + b.w / 2, b.y + b.h / 2, b.h * 0.85, [1, 0.6, 0.25], 0.4, 2);
      KIT.nine('leather', b.x, b.y, b.w, b.h, hot ? { u: { grade: [1.1, 1.5, 0, 1.06] } } : {}); KIT.paper(b.x + 22, b.y + 22, b.w - 44, b.h - 44, { u: hot ? { grade: [1.08, 1.17, 0, 1.04] } : undefined });
      const ix = b.x + 34, iw = b.w - 68; L.uiBox('cl_card' + b.cls, ix, b.y + 30, iw, b.h - 50, 0);
      KIT.nine('cell', b.x + (b.w - 236) / 2, b.y + 38, 236, 200);
      const por = Cl.look.rig !== 'hero' && window.ASSETS['portrait_' + Cl.look.rig] ? 'portrait_' + Cl.look.rig : 'portrait';
      L.sprite(por, b.x + (b.w - 220) / 2, b.y + 46, { w: 220, h: 220 * 0.84, src: [0.04, 0.0, 0.96, 0.77] });
      if (on) KIT.seal(b.x + b.w - 52, b.y + 52, 1.1);
      KIT.ink('cl_n' + b.cls, Cl.name, b.x + b.w / 2, b.y + 268, { size: 44, al: 0.5, col: on ? KIT.INK.r : KIT.INK.t, bold: true });
      KIT.rule(ix + 30, b.y + 296, iw - 60, 0.7);
      const sy = halves(Cl.style); sy.forEach((q, i) => KIT.ink('cl_y' + b.cls + i, q, b.x + b.w / 2, b.y + 320 + i * 25, { size: L.sizeToFit(q, iw, 21), al: 0.5, col: KIT.INK.t }));
      KIT.ink('cl_u' + b.cls, Cl.note, b.x + b.w / 2, b.y + 322 + sy.length * 25, { size: L.sizeToFit(Cl.note, iw, 18), al: 0.5, col: KIT.INK.d });
      Cl.abs.forEach((A, i) => { const y = b.y + 390 + i * 62; KIT.cell('cl_a' + b.cls + i, ix + 6, y, 56, {}); icon(A.icon, ix + 12, y + 6, 44);
        KIT.ink('cl_an' + b.cls + i, A.name, ix + 78, y + 17, { size: 22 }); KIT.ink('cl_ak' + b.cls + i, TXT('hud.inv.14', { unlock: A.unlock }) + ' · ' + abCost(Cl, A, 1), ix + 78, y + 41, { size: 18, col: KIT.INK.d }); });
      const Kt = D.kitOf(S.meta, b.cls), kb = U.find((q) => q.id === 'kit:' + b.cls);
      if (kb) KIT.button('cl_kb' + b.cls, Object.assign({ label: TXT('UI.classes.kit', { p1: Kt.name }), size: 23 }, kb), sl(kb.id));
      const kd = L.labelW(0, Kt.desc, { size: 20 }) > iw ? halves(Kt.desc) : [Kt.desc];
      kd.forEach((q, i) => KIT.ink('cl_k' + b.cls + i, q, b.x + b.w / 2, b.y + b.h - 44 - (kd.length - 1) * 11 + i * 22, { size: L.sizeToFit(q, iw, kd.length > 1 ? 19 : 20), al: 0.5, col: KIT.INK.d }));
    }
    for (const id of ['back', 'go']) { const b = U.find((q) => q.id === id); KIT.button('cl_' + id, b, sl(id), id === 'go' ? 'wax' : 'parch'); }
    const ky = 1012, kw = lw('cl_keys_w', TXT('hud.classes.keys'), { size: 26 }); L.uiBox('cl_keys_b', W / 2 - kw / 2 - 12, ky - 20, kw + 24, 40, 0);
    KIT.light('cl_keys', TXT('hud.classes.keys'), W / 2, ky, { size: 26, al: 0.5, col: '#cdb894' });
  }
  // the settings (TASKS 1302), look B: an open book over the menu's backdrop, or over the dimmed run when opened from the pause
  function settings(S, t) {
    if (S.run && S.setFrom === 'pause') dim(0.6); else menuBack(t);
    const U = D.UI.settings(), B = KIT.book('st_book', U.B.x, U.B.y, U.B.w, U.B.h), P = { x: U.B.x + 22, y: U.B.y + 22, w: U.B.w - 44, h: U.B.h - 44 };
    KIT.corners({ x: P.x + 18, y: P.y + 18, w: P.w - 36, h: P.h - 36 }, 0.7);
    KIT.heading('st_t', TXT('hud.settings'), W / 2, U.B.y + 120, { size: 60, wing: 120 });
    for (const q of U.rows) { const r = U.r.find((o) => o.id === q.id), st = KIT.st(S, q.id), i = q.stops.indexOf(S.meta[q.key] ?? q.def), v = q.stops[i < 0 ? q.stops.indexOf(q.def) : i];
      const tw = KIT.ink('st_n_' + q.id, q.name(), B.L.x + 20, q.y, { size: 36, col: st.hover || st.focus ? KIT.INK.r : KIT.INK.t });
      KIT.leader(B.L.x + 20 + tw + 20, r.x - 60, q.y + 8);
      if (q.check) KIT.check('st_c_' + q.id, r.x + 16, q.y - 18, !!v, st);
      else KIT.slider('st_s_' + q.id, r.x + 20, q.y, r.w - 40, q.stops.indexOf(v) / (q.stops.length - 1), Object.assign(st, { press: S.drag === q.id }), { ticks: q.stops.length, value: q.fmt(v), ends: q.ends ? q.ends() : [q.fmt(q.stops[0]), q.fmt(q.stops[q.stops.length - 1])] });
      KIT.rule(B.all.x, q.y + 50, B.all.w, 0.7); }
    const back = U.r.find((o) => o.id === 'back'); KIT.button('st_back', back, KIT.st(S, 'back'));
    const ky = back.y + back.h + 40, kw = lw('st_keys_w', TXT('hud.settings.keys'), { size: 26 }); L.uiBox('st_keys_b', W / 2 - kw / 2 - 12, ky - 20, kw + 24, 40, 0);
    KIT.light('st_keys', TXT('hud.settings.keys'), W / 2, ky, { size: 26, al: 0.5, col: '#cdb894' });
  }
  const statName = { runs: () => TXT('hud.stats.runs'), wins: () => TXT('hud.stats.wins'), deaths: () => TXT('hud.stats.deaths'), kills: () => TXT('hud.stats.kills'), elites: () => TXT('hud.stats.elites'),
    bosses: () => TXT('hud.stats.bosses'), shards: () => TXT('hud.stats.shards'), best: () => TXT('hud.stats.best'), time: () => TXT('hud.stats.time') };
  const grp = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const hrs = (s) => { const m = Math.floor((s || 0) / 60); return m >= 60 ? TXT('hud.stats.hm', { h: grp(Math.floor(m / 60)), m: m % 60 }) : TXT('hud.stats.m', { m }); };
  // the statistics (TASKS 1309), look B: the counters on the left page with dotted leaders, the class tabs, the runs by class as
  // inked bars and the shards in hand on the right. A counter younger than the player's history is marked and footnoted
  function stats(S, t) {
    backdrop(t);
    const U = D.UI.stats(), B = KIT.book('sa_book', U.B.x, U.B.y, U.B.w, U.B.h), P = { x: U.B.x + 22, y: U.B.y + 22, w: U.B.w - 44, h: U.B.h - 44 };
    KIT.corners({ x: P.x + 18, y: P.y + 18, w: P.w - 36, h: P.h - 36 }, 0.7);
    const T = S.meta.stats || { from: S.meta.runs || 0, all: {}, cls: {} }, tab = U.tabs.includes(S.statTab) ? S.statTab : 'all', C = tab === 'all' ? T.all : T.cls[tab] || {};
    const full = { runs: S.meta.runs || 0, wins: S.meta.wins || 0, best: S.meta.best || 0 }, late = T.from > 0;
    const lx = B.L.x + 10, rx = B.L.x + B.L.w - 6;
    KIT.heading('sa_t', TXT('hud.stats'), B.L.x + B.L.w / 2, U.B.y + 130, { size: 56, wing: 90 });
    let marked = 0;
    for (const q of U.rows) { const own = tab === 'all' && q.k in full, v = own ? full[q.k] : C[q.k] || 0, mark = late && !own; marked += mark;
      const s = q.k === 'time' ? hrs(v) : q.k === 'best' ? (v ? TXT('hud.stats.floor', { n: v }) : TXT('hud.stats.none')) : grp(v);
      const tw = KIT.ink('sa_n_' + q.k, statName[q.k](), lx, q.y, { size: 32 }), vw = KIT.ink('sa_v_' + q.k, s, rx, q.y, { size: 32, al: 1, col: KIT.INK.r });
      if (mark) KIT.ink('sa_m_' + q.k, '*', lx + tw + 4, q.y - 10, { size: 26, col: KIT.INK.r });
      KIT.leader(lx + tw + (mark ? 30 : 18), rx - vw - 14, q.y + 8); KIT.rule(B.L.x, q.y + 32, B.L.w, 0.55); }
    if (marked) halves(TXT('hud.stats.late', { n: T.from + 1 })).forEach((s, i) => KIT.ink('sa_late' + i, s, lx, U.rows[U.rows.length - 1].y + 62 + i * 24, { size: L.sizeToFit(s, B.L.w - 20, 21), col: KIT.INK.d }));
    KIT.tabs('sa_tb', U.r.filter((b) => b.tab), 'tab:' + tab, S);
    const G0 = U.chart, ids = U.tabs.filter((c) => c !== 'all'), runs = ids.map((c) => (T.cls[c] || {}).runs || 0), top = Math.max(1, ...runs);
    KIT.rule(B.R.x, U.B.y + 182, B.R.w, 0.7);
    KIT.ink('sa_ct', TXT('hud.stats.chart'), B.R.x + B.R.w / 2, G0.y - 46, { size: 26, al: 0.5, col: KIT.INK.d });
    const ink = [0.17, 0.10, 0.06], red = [0.49, 0.12, 0.07];
    L.solid(G0.x, G0.y, 3, G0.h, ink); L.solid(G0.x, G0.y + G0.h - 3, G0.w, 3, ink);
    if (!runs.some((n) => n)) KIT.ink('sa_ce', TXT('hud.stats.chart.none'), G0.x + G0.w / 2, G0.y + G0.h / 2, { size: 24, al: 0.5, col: KIT.INK.d });
    const bw = Math.min(110, G0.w / ids.length - 50);
    ids.forEach((c, i) => { const cx = G0.x + 20 + (G0.w - 20) * (i + 0.5) / ids.length, h = runs[i] ? Math.max(6, (G0.h - 40) * runs[i] / top) : 0, on = tab === 'all' || tab === c, col = on ? (tab === c ? red : ink) : [0.45, 0.36, 0.27];
      if (h) { L.solid(cx - bw / 2, G0.y + G0.h - 3 - h, bw, h, col, 0, 0, 0, on ? 0.22 : 0.12); for (let yy = G0.y + G0.h - 3 - h; yy < G0.y + G0.h - 3; yy += 10) L.solid(cx - bw / 2, yy, bw, 2, col, 0, 0, 0, on ? 0.6 : 0.3);
        for (const [a, b2, w2, h2] of [[0, 0, bw, 3], [0, 0, 3, h], [bw - 3, 0, 3, h]]) L.solid(cx - bw / 2 + a, G0.y + G0.h - 3 - h + b2, w2, h2, col, 0, 0, 0, on ? 1 : 0.5);
        KIT.ink('sa_cv' + c, grp(runs[i]), cx, G0.y + G0.h - h - 22, { size: 22, al: 0.5, col: on ? KIT.INK.t : KIT.INK.off }); }
      KIT.ink('sa_cn' + c, D.CLASSES[c].name, cx, G0.y + G0.h + 26, { size: 24, al: 0.5, col: tab === c ? KIT.INK.r : on ? KIT.INK.t : KIT.INK.off }); });
    KIT.rule(B.R.x, G0.y + G0.h + 50, B.R.w, 0.7);
    const sy = G0.y + G0.h + 96, sh = TXT('hud.stats.hand', { n: grp(S.meta.shards || 0) }), shw = lw('sa_hw', sh, { size: 28 }) + 56;
    icon('dc_shards', B.R.x + B.R.w / 2 - shw / 2, sy - 22, 44); KIT.ink('sa_hand', sh, B.R.x + B.R.w / 2 - shw / 2 + 56, sy, { size: 28 });
    if (S.meta.bestEndless) KIT.ink('sa_end', TXT('hud.stats.endless', { n: S.meta.bestEndless }), B.R.x + B.R.w / 2, sy + 44, { size: 22, al: 0.5, col: KIT.INK.d });
    const back = U.r.find((o) => o.id === 'back'); KIT.button('sa_back', back, KIT.st(S, 'back'));
    const ky = U.B.y + U.B.h + 36, kw = lw('sa_keys_w', TXT('hud.stats.keys'), { size: 26 }); L.uiBox('sa_keys_b', W / 2 - kw / 2 - 12, ky - 20, kw + 24, 40, 0);
    KIT.light('sa_keys', TXT('hud.stats.keys'), W / 2, ky, { size: 26, al: 0.5, col: '#cdb894' });
  }
  const stamp = (ms) => { if (!ms) return TXT('hud.load.nodate'); const d = D.dateOf(ms), p2 = (n) => String(n).padStart(2, '0'); return TXT('hud.load.date', { d: p2(d.d), m: p2(d.m), y: d.y, h: p2(d.h), mi: p2(d.mi) }); };
  const whereOf = (R) => (R.mode === 'campaign' ? '' : D.runOf(R.mode).name + ', ') + (R.floor ? TXT('hud.load.floor', { n: R.floor }) : TXT('hud.load.town'));
  // the saved games (TASKS 1311), look B: the slots as parchment strips down the left page (portrait, class, level, place, date,
  // time in play), the chosen slot's page on the right; the delete question on a torn sheet over the right page's buttons
  function load(S, t) {
    backdrop(t);
    const U = D.UI.load(), B = KIT.book('ld_book', U.B.x, U.B.y, U.B.w, U.B.h), ask = S.delAsk !== undefined, sel = Math.max(0, Math.min(D.SAVE_SLOTS - 1, S.loadSel | 0)), q = ask ? {} : S;
    KIT.corners({ x: U.B.x + 40, y: U.B.y + 40, w: U.B.w - 80, h: U.B.h - 80 }, 0.6);
    KIT.banner('ld_t', W / 2, U.B.y - 30, 620, TXT('hud.load'), { h: 96, size: 44 });
    // the chosen slot keeps the seal; the focus (or the pointer) also lights its row and glows behind it, as the focus on the list
    // always sits on the chosen slot and the seal alone did not tell the list from the buttons (TASKS 1846)
    for (const r of U.rows) { const R = SIM.Q.slotRun(S, r.i), st = KIT.st(q, r.id), on = r.i === sel, lit = st.hover || st.focus;
      if (lit) L.glow(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.6, [1, 0.6, 0.25], 0.3, 2);
      KIT.nine('btn', r.x, r.y, r.w, r.h, { u: { grade: lit ? [1.06, 1.16, 0, 1.04] : on ? [1.03, 1.06, 0, 1.03] : R ? [1, 1, 0, 1] : [0.9, 0.8, 0, 0.97] } });
      if (on) KIT.seal(r.x + 6, r.y + r.h / 2, 0.9);
      L.uiBox('ld_r' + r.i, r.x + 24, r.y + 8, r.w - 48, r.h - 16, 0);
      const cx = r.x + 40, cs = r.h - 26; KIT.nine('cell', cx, r.y + 13, cs, cs);
      if (!R) { KIT.ink('ld_e' + r.i, TXT('hud.load.empty'), cx + cs + 24, r.y + r.h / 2, { size: 28, col: KIT.INK.off }); continue; }
      L.sprite(portraitOf(R.hero), cx + 6, r.y + 19, { w: cs - 12, h: (cs - 12), src: [0.1, 0.0, 0.9, 0.74] });
      const nx = cx + cs + 20, rr = r.x + r.w - 54, lv = TXT('hud.load.lvl', { n: R.hero.lvl }), wh = whereOf(R), dt = stamp(R.at), tm = hrs(R.play);
      KIT.ink('ld_n' + r.i, D.clsOf(R.hero).name, nx, r.y + 30, { size: 30, col: on ? KIT.INK.r : KIT.INK.t, bold: true });
      KIT.ink('ld_l' + r.i, lv, rr, r.y + 32, { size: 24, al: 1 });
      KIT.ink('ld_w' + r.i, wh, nx, r.y + 58, { size: L.sizeToFit(wh, rr - nx, 22) });
      KIT.ink('ld_d' + r.i, dt, nx, r.y + 83, { size: 20, col: KIT.INK.d });
      KIT.ink('ld_p' + r.i, tm, rr, r.y + 83, { size: L.sizeToFit(tm, (rr - nx) / 2 - 10, 20), al: 1, col: KIT.INK.d }); }
    const R = SIM.Q.slotRun(S, sel), px = B.R.x, pw = B.R.w, mx = px + pw / 2;
    if (R) { const Cl = D.clsOf(R.hero); KIT.nine('cell', mx - 110, U.B.y + 120, 220, 190); L.sprite(portraitOf(R.hero), mx - 100, U.B.y + 128, { w: 200, h: 200 * 0.84, src: [0.04, 0.0, 0.96, 0.77] });
      KIT.ink('ld_dn', Cl.name, mx, U.B.y + 346, { size: 44, al: 0.5, col: KIT.INK.r, bold: true }); KIT.rule(px + 60, U.B.y + 378, pw - 120, 0.7);
      const lines = [[TXT('hud.load.d.lvl'), String(R.hero.lvl)], [TXT('hud.load.d.where'), D.placeName(R.floor, R.mode, R.seed, R.campaignWon ? D.RUNS.campaign.floors + 1 : 1, R.map)], [TXT('hud.load.d.diff'), (D.DIFF[R.diff] || D.DIFF.normal).name],
        [TXT('hud.load.d.time'), hrs(R.play)], [TXT('hud.load.d.saved'), stamp(R.at)]];
      lines.forEach(([k, v], i) => { const y = U.B.y + 412 + i * 36, tw = KIT.ink('ld_dk' + i, k, px + 40, y, { size: 24, col: KIT.INK.d }), vs = L.sizeToFit(v, pw - 120 - tw, 24), vw = KIT.ink('ld_dv' + i, v, px + pw - 40, y, { size: vs, al: 1 }); KIT.leader(px + 40 + tw + 14, px + pw - 40 - vw - 10, y + 6); }); }
    else { KIT.ink('ld_none', TXT('hud.load.none'), mx, U.B.y + 300, { size: 30, al: 0.5, col: KIT.INK.d }); const s = TXT('hud.load.none.2'); halves(s).forEach((v, i) => KIT.ink('ld_none2' + i, v, mx, U.B.y + 350 + i * 30, { size: L.sizeToFit(v, pw - 60, 22), al: 0.5, col: KIT.INK.d })); }
    for (const b of U.btn) { if (b.id !== 'back' && (!R || ask)) continue; KIT.button('ld_' + b.id, b, KIT.st(q, b.id), b.id === 'go' ? 'wax' : 'parch'); }
    if (ask) { const A = U.ask, P = KIT.panel('ld_ask', A.x, A.y, A.w, A.h, 'torn'); KIT.seal(A.x + A.w / 2, A.y + 16, 0.9);
      KIT.ink('ld_ask_q', TXT('hud.load.ask'), A.x + A.w / 2, A.y + 76, { size: 32, al: 0.5, col: KIT.INK.r });
      const AR = SIM.Q.slotRun(S, S.delAsk), s = AR ? TXT('hud.load.ask.who', { cls: D.clsOf(AR.hero).name, n: AR.hero.lvl, where: whereOf(AR) }) : '';
      KIT.ink('ld_ask_w', s, A.x + A.w / 2, A.y + 116, { size: L.sizeToFit(s, P.w - 40, 22), al: 0.5, col: KIT.INK.d });
      for (const b of U.yes) KIT.button('ld_' + b.id, b, askSt(S, { r: U.yes }, b.id)); }
    const keys = ask ? TXT('hud.load.keys.ask') : TXT('hud.load.keys'), ky = H - 26, kw = lw('ld_keys_w', keys, { size: 26 }); L.uiBox('ld_keys_b', W / 2 - kw / 2 - 12, ky - 20, kw + 24, 40, 0);
    KIT.light('ld_keys', keys, W / 2, ky, { size: 26, al: 0.5, col: '#cdb894' });
  }
  // the main menu (TASKS 1301): the item sheet pinned in the bottom-left corner; the item Enter or a click would press carries the
  // wax seal and a red rule under it, and it alone is red (TASKS 1754)
  function menu(S, t) {
    const F = D.UI.newsFrame(S.qaNewsMain || (D.CHANGES[0] || {}).main), full = SIM.Q.isFull(S);
    menuBack(t, !!F, true, S); if (F) newsFrame(F, D.CHANGES[0].v);
    const ty = (y) => Math.round((bk().y0 + y * bk().k) / 2) * 2;
    lab('m_t', TXT('hud.menu'), W / 2, ty(150), { size: 104, al: 0.5, col: C.gold, out: '#2a0d06', bold: true });
    lab('m_sb', TXT('hud.menu.sub'), W / 2, ty(230), { size: 44, al: 0.5, col: '#e8c890', out: '#2a0d06' });
    lab('m_s', TXT('hud.menu.2', D.campaignLen()), W / 2, ty(282), { size: 28, al: 0.5, col: C.dim });
    const bs = D.UI.menu(!!S.saved, S.meta.diff, S.meta.zoom, full), M = D.UI.menuSheet(!!S.saved), P = M.P, items = bs.filter((b) => !b.link);
    const lit = litOf(S, bs.map((b) => b.id)), cur = lit ? (items.some((b) => b.id === lit) ? lit : '') : items[0].id;
    KIT.part('ui_b_strap_ring', [32, 47], P.x + P.w - 112, P.y + P.h - 34);
    const IP = KIT.panel('m_sheet', P.x, P.y, P.w, P.h, 'menu'); KIT.strap(P.x + P.w / 2, P.y + 22);
    KIT.corners({ x: IP.x + 8, y: IP.y + 8, w: IP.w - 16, h: IP.h - 16 }, 0.45);
    for (const y of M.rules) KIT.rule(P.x + 70, y, P.w - 140, 0.75);
    for (const b of items) { const lx = b.x + 46, ly = b.y + 30, maxW = b.x + b.w - lx - 6;
      const size = L.sizeToFit(b.label, maxW, 32), tw = KIT.ink('mb_' + b.id, b.label, lx, ly, { size, col: b.id === cur ? KIT.INK.r : KIT.INK.t });
      if (b.id === cur) { KIT.seal(b.x + 16, ly, 0.5); L.solid(lx, ly + 20, tw, 3, [0.49, 0.12, 0.07]); }
      if (b.id === 'continue' && S.saved) { const R = S.saved, s0 = TXT('hud.menu.saved', { p1: R.mode === 'campaign' ? '' : D.runOf(R.mode).name + ', ', p2: R.floor ? TXT('hud.savedLine.2', { floor: R.floor }) : TXT('hud.savedLine.3'), lvl: R.hero.lvl }), s1 = s0[0].toUpperCase() + s0.slice(1);
        KIT.ink('mb_sv', s1, lx, ly + 40, { size: L.sizeToFit(s1, maxW, 18), col: KIT.INK.d }); }
      L.uiBox('mb_' + b.id + '_b', b.x, b.y, b.w, b.h, 0); }
    for (const b of bs) { if (!b.link) continue; const hv = lit === b.id, lw0 = lw('mb_lw', b.label, { size: 20 }), x1 = b.x + b.w - 4;
      lab('mb_' + b.id, b.label, x1, b.y + b.h / 2, { size: 20, al: 1, col: hv ? C.gold : '#b8a68a' }); L.solid(x1 - lw0, b.y + b.h / 2 + 12, lw0, 2, hv ? [1, 0.84, 0.42] : [0.55, 0.47, 0.36]);
      L.uiBox('mb_' + b.id + '_b', b.x, b.y, b.w, b.h, 0); }
    lab('m_ver', TXT('hud.menu.ver', { v: D.VERSION }), W - 24, H - 62, { size: 18, al: 1, col: '#6d6258' });
    // «Сохранить и выйти» answers on the menu it lands on (TASKS 1853 б)
    const sa = S.t - (S.savedT ?? -1e9); if (S.saved && sa < 3) { const s = TXT('hud.menu.savedNote'), al = 1 - L.SS(2.4, 3, sa), w = lw('m_svn', s, { size: 26 }) + 56;
      plate('m_svn_box', W / 2 - w / 2, 318, w, 54, { a: 0.92 * al }); lab('m_svn', s, W / 2, 345, { size: 26, al: 0.5, col: '#9fd08a', a: al }); }
    newAsk(S);
  }
  // a new run over five taken slots asks first and names the run it will take the place of (TASKS 1785)
  function newAsk(S) {
    if (!S.newAsk) return;
    const U = D.UI.newAsk(), A = U.A, R = SIM.Q.slotRun(S, SIM.Q.oldestSlot(S)); dim(0.5); const P = KIT.panel('na_ask', A.x, A.y, A.w, A.h, 'torn'); KIT.seal(A.x + A.w / 2, A.y + 16, 0.9);
    KIT.ink('na_ask_q', TXT('hud.menu.ask'), A.x + A.w / 2, A.y + 80, { size: 32, al: 0.5, col: KIT.INK.r });
    halves(TXT('hud.menu.ask.who')).forEach((v, i) => KIT.ink('na_ask_w' + i, v, A.x + A.w / 2, A.y + 124 + i * 30, { size: L.sizeToFit(v, P.w - 60, 22), al: 0.5, col: KIT.INK.d }));
    if (R) { const run = TXT('hud.menu.ask.run', { cls: D.clsOf(R.hero).name, where: whereOf(R) }); KIT.ink('na_ask_r', run, A.x + A.w / 2, A.y + 200, { size: L.sizeToFit(run, P.w - 60, 26), al: 0.5, col: KIT.INK.t, bold: true });
      KIT.ink('na_ask_d', stamp(R.at), A.x + A.w / 2, A.y + 234, { size: 22, al: 0.5, col: KIT.INK.d }); }
    for (const b of U.r) KIT.button('na_' + b.id, b, askSt(S, U, b.id));
    const keys = TXT('hud.pause.keys.ask'), ky = H - 26, kw = lw('na_keys_w', keys, { size: 26 }); L.uiBox('na_keys_b', W / 2 - kw / 2 - 12, ky - 20, kw + 24, 40, 0);
    KIT.light('na_keys', keys, W / 2, ky, { size: 26, al: 0.5, col: '#cdb894' });
  }
  // «Что нового» (TASKS 1038): the changelog's rows from the sim's scroll, a version with its date, its sections, the points
  // «Что нового» (TASKS 1750), look B: the whole changelog on one loose parchment sheet, as the version's frame in the menu is, a red
  // diamond a change, the scroll an ink rule with a red thumb
  function news(S, t) {
    backdrop(t);
    const N = D.UI.news(S.newsTop), P = N.P, V = N.view, I = KIT.INK;
    KIT.panel('nw_p', P.x, P.y, P.w, P.h, 'torn'); KIT.knob(P.x + P.w / 2, P.y + 22, 1.2);
    KIT.heading('nw_t', TXT('hud.news'), P.x + P.w / 2, P.y + 80, { size: 56, wing: 80 });
    const dot = (x, y, s) => L.solid(x - s / 2, y - s / 2, s, s, [0.49, 0.12, 0.07], 0.7854, s / 2, s / 2);
    N.rows.forEach((r, i) => { const id = 'nw_r' + i;
      if (r.k === 'ver') { const vw = KIT.ink(id, r.v, V.x, r.y + 38, { size: 40, col: I.r }); KIT.ink(id + 'd', r.date, V.x + vw + 24, r.y + 42, { size: 24, col: I.d }); }
      else if (r.k === 'group') { KIT.ink(id, r.s, V.x + 4, r.y + 26, { size: 30, col: I.r }); }
      else { if (r.first) dot(V.x + 22, r.y + 17, 10); KIT.ink(id, r.s, V.x + 40, r.y + 17, { size: 24 }); } });
    if (N.max > 0) { const k = N.top / N.max, th = Math.max(60, V.h * V.h / (V.h + N.max * 34)), sx = P.x + P.w - 56;
      L.solid(sx, V.y, 3, V.h, [0.42, 0.27, 0.15], 0, 0, 0, 0.8); L.rrect(sx - 4, V.y + (V.h - th) * k, 11, th, 5, [0.62, 0.16, 0.09], [0.42, 0.09, 0.05], 1);
      KIT.ink('nw_k', TXT('hud.news.keys'), P.x + 70, P.y + P.h - 60, { size: 26, col: I.d }); }
    for (const b of N.r) KIT.button('nw_' + b.id, b, stN(S, b.id));
  }
  // these windows have no keyboard focus of their own: a focus left over from another screen must not frame their buttons
  const stN = (S, id, on = true) => Object.assign(KIT.st(S, id, on), { focus: false });
  // a question's two buttons, both parchment (TASKS 1844), one lit: the one Enter answers with, which the pointer takes by moving (TASKS 1754)
  const askSt = (S, U, id) => Object.assign(KIT.st(S, id), { hover: litOf(S, U.r.map((b) => b.id)) === id, focus: false });
  const HOT = [1.04, 1.1, 0, 1.04], POOR = [0.55, 0.86, 0, 0.96], POOR_HOT = [0.8, 1.04, 0, 1.02], SOUL = '#24407a';
  // a manuscript page: the leather frame with the parchment inside, its writing area registered for qa.mjs
  const page = (id, x, y, w, h, pad = 4) => { KIT.nine('leather', x, y, w, h); KIT.paper(x + 22, y + 22, w - 44, h - 44); L.uiBox(id, x + 22, y + 22, w - 44, h - 44, pad); };
  const desk = (t) => { L.solid(0, -G.oy, W, VH, [0.02, 0.015, 0.02], 0, 0, 0, 1);
    for (let i = 0; i < 6; i++) { G.blend('add'); L.glow(W * (0.15 + 0.14 * i), VH * 0.86 - G.oy, 240, [1, 0.45, 0.15], 0.1 + 0.04 * Math.sin(t * 2 + i), 2); G.blend(); } };
  const pip = (x, y, on) => { L.solid(x, y, 14, 14, [0.17, 0.10, 0.06], 0.7854, 7, 7); if (!on) L.solid(x + 3, y + 3, 8, 8, [0.86, 0.76, 0.58], 0.7854, 4, 4); else L.solid(x + 2, y + 2, 10, 10, [0.62, 0.14, 0.08], 0.7854, 5, 5); };
  function pause(S) {
    dim(0.55); KIT.panel('p_sheet', 660, 240, 600, 580, 'torn'); KIT.knob(W / 2, 262, 1.2);
    KIT.heading('p_title', TXT('hud.draw.2'), W / 2, 340, { size: 60, wing: 80 });
    // while it asks, the question's sheet takes the buttons' place under the title, as the load screen's does (TASKS 1843)
    const done = !!S.run && SIM.Q.campaignDone(S.run);
    if (!S.pauseAsk) { for (const b of D.UI.pause(S.meta.zoom, done)) KIT.button('pb_' + b.id, b, stN(S, b.id), b.id === 'resume' ? 'wax' : 'parch');
      KIT.rule(780, 692, 360, 0.7); return; }
    const U = D.UI.pauseAsk(done), A = U.A; dim(0.35); KIT.panel('pa_ask', A.x, A.y, A.w, A.h, 'torn'); KIT.seal(A.x + A.w / 2, A.y + 16, 0.9);
    KIT.ink('pa_ask_q', done ? TXT('hud.pause.askDone') : TXT('hud.pause.ask'), A.x + A.w / 2, A.y + 80, { size: 32, al: 0.5, col: KIT.INK.r });
    const s = done ? TXT('hud.pause.askDone.who') : TXT('hud.pause.ask.who');
    halves(s).forEach((v, i) => KIT.ink('pa_ask_w' + i, v, A.x + A.w / 2, A.y + 124 + i * 30, { size: L.sizeToFit(v, A.w - 80, 22), al: 0.5, col: KIT.INK.d }));
    for (const b of U.r) KIT.button('pa_' + b.id, b, askSt(S, U, b.id));
    const keys = TXT('hud.pause.keys.ask'), ky = H - 26, kw = lw('pa_keys_w', keys, { size: 26 }); L.uiBox('pa_keys_b', W / 2 - kw / 2 - 12, ky - 20, kw + 24, 40, 0);
    KIT.light('pa_keys', keys, W / 2, ky, { size: 26, al: 0.5, col: '#cdb894' });
  }
  // a fork's way in numbers from its power's own data (TASKS 1847), with what it hits for now beside the share of the attack
  const FK_TAG = { nova: () => TXT('hud.fk.tag.nova'), heal: () => TXT('hud.fk.tag.heal'), mana: () => TXT('hud.fk.tag.mana'), stun: () => TXT('hud.fk.tag.stun'), slow: () => TXT('hud.fk.tag.slow'),
    strike: () => TXT('hud.fk.tag.strike'), burnGround: () => TXT('hud.fk.tag.burnGround'), dmg: () => TXT('hud.fk.tag.dmg'), spd: () => TXT('hud.fk.tag.spd'), kb: () => TXT('hud.fk.tag.kb'),
    shieldAdd: () => TXT('hud.fk.tag.shieldAdd'), shieldMore: () => TXT('hud.fk.tag.shieldMore'), dropTrap: () => TXT('hud.fk.tag.dropTrap') };
  const fkTag = (P) => (P.fx === 'proj' ? (P.dmg ? 'dmg' : P.spd ? 'spd' : 'kb') : P.fx);
  const FK_BADGE = { heal: 'it_hp', mana: 'it_mp', burnGround: 'bf_burn', slow: 'ab_frost' };
  function fkNums(P, st, h) { const pc = (v) => Math.round(v * 100), hit = (k) => Math.max(1, Math.round((P.spell ? st.spellBase * st.spell : st.atk) * k)), Cl = D.clsOf(h), sg = (v) => (v > 0 ? '+' : '−') + Math.abs(v), out = [];
    const f = { nova: () => TXT('hud.fk.nova', { k: pc(P.k), n: hit(P.k) }), heal: () => TXT('hud.fk.heal', { v: pc(P.v), n: Math.round(st.maxHp * P.v) }), mana: () => TXT('hud.fk.mana', { v: pc(P.v), res: Cl.resWord, n: Math.round(st.maxMp * P.v) }),
      stun: () => TXT('hud.fk.stun', { t: nf(P.t), b: nf(P.boss) }), slow: () => TXT('hud.fk.slow', { s: pc(1 - P.slow), t: nf(P.t) }), strike: () => TXT('hud.fk.strike', { k: pc(P.k), n: hit(P.k) }),
      burnGround: () => TXT('hud.fk.burn', { t: nf(P.t), k: pc(P.k), n: hit(P.k), per: nf(P.per || 0.5) }), shieldAdd: () => TXT('hud.fk.shieldAdd', { p: pc(P.k) }), shieldMore: () => TXT('hud.fk.shieldMore', { t: nf(P.t) }),
      dropTrap: () => TXT('hud.fk.trap', { k: pc(P.k), n: hit(P.k) }) }[P.fx];
    if (f) out.push(f());
    if (P.fx === 'proj') { if (P.dmg) out.push(TXT('hud.fk.dmg', { p: sg(pc(P.dmg - 1)) })); if (P.spd) out.push(TXT('hud.fk.spd', { p: sg(pc(P.spd - 1)) })); if (P.kb) out.push(TXT('hud.fk.kb', { x: nf(P.kb) })); }
    if (P.icd) out.push(TXT('hud.fk.icd', { t: nf(P.icd) }));
    return out; }
  // the two ways of a fork: the first press lights a card and seals it, the second takes it (TASKS 1847); the two read apart by a word
  // of what each does under the skill's icon and, where an icon of the game fits the effect, that icon in the corner
  function fork(S, R, t) { const P = D.forkPending(R.hero); if (!P) return; const h = R.hero, Ab = D.clsOf(h).abs.find((a) => a.id === P.ab), I = KIT.INK, st = SIM.Q.stats(h, S.meta), sel = S.forkSel;
    dim(0.7); KIT.panel('fk_p', 400, 170, 1120, 600, 'leather');
    KIT.banner('fk_t', W / 2, 184, 820, TXT('hud.fork.title', { p1: Ab.name }), { h: 84, size: 40 });
    KIT.light('fk_h', TXT('hud.fork.hint'), W / 2, 302, { size: 22, al: 0.5, col: '#cdb89a' });
    for (const b of D.UI.fork()) { const Pw = D.POWERS[D.FORKS[P.ab][P.rank][b.i]], st0 = stN(S, b.id), on = sel != null ? sel === b.i : st0.hover, cs = Object.assign({}, st0, { hover: on }), cx = b.x + b.w / 2, iw = b.w - 64;
      KIT.nine('torn', b.x, b.y, b.w, b.h, { u: { grade: on ? HOT : [1, 1, 0, 1] } }); L.uiBox('fk_' + b.i, b.x + 26, b.y + 20, b.w - 52, b.h - 40, 0);
      KIT.cell('fk_c' + b.i, cx - 54, b.y + 30, 108, cs, { sel: sel === b.i }); icon(Ab.icon, cx - 44, b.y + 40, 88);
      const bd = FK_BADGE[Pw.fx]; if (bd && !(Pw.fx === 'slow' && Ab.icon === bd) && !(Pw.fx === 'mana' && D.clsOf(h).res === 'rage')) { L.solid(cx - 64, b.y + 24, 44, 44, [0.1, 0.07, 0.05], 0, 0, 0, 0.85); icon(bd, cx - 62, b.y + 26, 40); }
      const tg = (FK_TAG[fkTag(Pw)] || (() => ''))(), tw = lw('fk_g' + b.i, tg, { size: 20 }) + 24; plate('fk_gb' + b.i, cx - tw / 2, b.y + 142, tw, 30, { pad: 0 }); lab('fk_g' + b.i, tg, cx, b.y + 157, { size: 20, al: 0.5, col: C.gold });
      KIT.ink('fk_n' + b.i, Pw.name, cx, b.y + 200, { size: L.sizeToFit(Pw.name, iw, 32), al: 0.5, col: on ? I.r : I.t });
      KIT.rule(b.x + 70, b.y + 222, b.w - 140, 0.6);
      KIT.ink('fk_d' + b.i, Pw.desc, cx, b.y + 250, { size: L.sizeToFit(Pw.desc, iw, 23), al: 0.5, col: I.d });
      const nl = []; for (const q of fkNums(Pw, st, h)) { const j = nl.length - 1, tr = j >= 0 ? nl[j] + ', ' + q : q; if (j >= 0 && lw('fk_xw', tr, { size: 20 }) <= iw) nl[j] = tr; else nl.push(q); } nl.forEach((q, k) => KIT.ink('fk_x' + b.i + '_' + k, q, cx, b.y + 284 + k * 26, { size: L.sizeToFit(q, iw, 20), al: 0.5, col: I.t }));
      if (sel === b.i) KIT.ink('fk_a' + b.i, TXT('hud.fork.again'), cx, b.y + b.h - 38, { size: 22, al: 0.5, col: I.r }); }
  }
  // the codex (TASKS 395), look B: one manuscript page, the tabs over its three columns, each entry a small cell and its name
  function codex(S, t) { const tab = S.codexTab || 'm', U = D.UI.codex(tab, S.codexPage), seen = (S.meta.codex || {})[tab] || {}, n = U.list.filter((q) => seen[q.k]).length, I = KIT.INK;
    desk(t); page('cx_page', 40, 50, 1840, 950);
    KIT.corners({ x: 76, y: 86, w: 1768, h: 878 }, 0.55);
    KIT.heading('cx_t', TXT('UI.codex.title'), W / 2, 112, { size: 60, wing: 110 });
    KIT.ink('cx_c', TXT('hud.codex.count', { n, m: U.list.length }), 120, 226, { size: 24, col: I.d });
    KIT.ink('cx_b', TXT('hud.codex.best', { p1: S.meta.best || 0, p2: S.meta.bestEndless || 0 }), W - 120, 226, { size: 22, al: 1, col: I.d });
    // how a «???» row opens (TASKS 1853 к), while the tab still has one
    if (n < U.list.length) { const s = tab === 'm' ? TXT('hud.codex.how.m') : tab === 'it' ? TXT('hud.codex.how.it') : TXT('hud.codex.how.p'); KIT.ink('cx_how', s, 150, 925, { size: L.sizeToFit(s, 630, 22), col: I.d }); }
    KIT.tabs('cx_tb', U.r.filter((b) => b.tab), 'tab:' + tab, S);
    KIT.rule(100, 258, W - 200, 0.7);
    // a monster's cell holds its own sprite, as the items' cells hold their icons
    const look = (k) => { const tx = tab === 'm' && window.SCX && window.SCX.EN_TEX[k]; return tx && window.ASSETS[tx] ? tx : null; };
    for (const b of U.r) { if (!b.q) continue; const on = !!seen[b.q.k], mon = look(b.q.k), cs = b.h, x = b.x + (b.q.icon || mon ? cs + 14 : 16);
      if (b.q.icon || mon) { KIT.cell('cx_' + b.q.k, b.x, b.y, cs, on ? {} : { off: true });
        if (on && b.q.icon) icon(b.q.icon, b.x + 5, b.y + 5, cs - 10);
        if (on && mon) { const [sw, sh] = SZ(mon), f = (cs - 12) / Math.max(sw, sh); L.sprite(mon, b.x + cs / 2 - sw * f / 2, b.y + cs / 2 - sh * f / 2, { w: sw * f, h: sh * f }); } }
      KIT.ink('cx_n' + b.q.k, on ? b.q.name : TXT('hud.codex.unknown'), x, b.y + b.h / 2, { size: L.sizeToFit(on ? b.q.name : '???', b.w - (x - b.x) - 8, 24), col: on ? I.t : I.off });
      L.solid(x, b.y + b.h - 2, b.w - (x - b.x) - 12, 2, [0.42, 0.27, 0.15], 0, 0, 0, 0.25); }
    for (const b of U.r) if (!b.q && !b.tab) KIT.button('cx_b' + b.id, b, stN(S, b.id, b.on));
  }
  // the Altar of souls (TASKS 1722), look B: a manuscript page, each upgrade or discovery a parchment strip, its ranks red diamonds
  function meta(S, t) { const I = KIT.INK;
    desk(t); page('mt_page', 130, 70, 1660, 940);
    KIT.heading('mt_t', TXT('hud.meta'), W / 2, 140, { size: 60, wing: 100 });
    { const s = TXT('hud.meta.2', { shards: S.meta.shards }); KIT.ink('mt_s', s, W / 2, S.metaRun ? 206 : 226, { size: L.sizeToFit(s, 1560, 26), al: 0.5, col: I.d }); }
    // at the town's altar mid-run (TASKS 1011) some upgrades reach the hero at once, the rest wait for the next one (sim.js: newHero)
    if (S.metaRun) halves(TXT('hud.meta.3')).forEach((q, i) => KIT.ink('mt_run' + i, q, W / 2, 237 + i * 24, { size: 20, al: 0.5, col: I.d }));
    // a row lights under the pointer whether or not it can be bought; one the shards do not reach is dimmed and says how many are missing (TASKS 1848)
    const strip = (id, b, st, can, poor) => { KIT.nine('btn', b.x, b.y, b.w, b.h, { u: { grade: poor ? (st.hover ? POOR_HOT : POOR) : st.hover ? HOT : [1, 1, 0, 1] } }); L.uiBox(id, b.x + 26, b.y, b.w - 52, b.h, 2); };
    const short = (c) => TXT('hud.meta.short', { n: c - S.meta.shards });
    const bs = D.UI.meta(S.meta.cls, S.metaTab);
    KIT.tabs('mt_tb', bs.filter((b) => b.tab), 'tab:' + (S.metaTab === 'open' ? 'open' : 'up'), S);
    for (const b of bs) {
      if (b.tab) continue;
      if (b.id === 'back' || b.id === 'codex') { KIT.button('mt_' + b.id, b, stN(S, b.id)); continue; }
      const st = stN(S, b.id);
      if (b.un !== undefined) { const U = D.UNLOCKS[b.un], open = !!(S.meta.open || {})[U.id], A = U.ach && D.ACHIEVE.find((q) => q.id === U.ach), Th = U.kind === 'gift' ? D.GIFTS.find((g) => g.id === U.ref) : D.KITS.find((k) => k.id === U.ref), poor = !open && !U.ach && S.meta.shards < U.cost;
        strip('un_' + b.un, b, st, !poor, poor);
        const cw = KIT.ink('un_c' + b.un, open ? TXT('hud.unlock.done') : U.ach ? A.name : TXT('hud.unlock.cost', { c: U.cost }), b.x + b.w - 44, b.y + 23, { size: 20, al: 1, col: open ? I.g : poor ? I.off : I.r });
        if (poor) KIT.ink('un_sh' + b.un, short(U.cost), b.x + b.w - 64 - cw, b.y + 23, { size: 20, al: 1, col: I.r });
        const ds = A && !open ? TXT('hud.unlock.ach', { p1: A.desc, p2: Math.min((S.meta.ach || {})[A.id] || 0, A.need), p3: A.need }) : Th.desc;
        KIT.ink('un_n' + b.un, Th.name, b.x + 44, b.y + 22, { size: 22, col: open ? I.g : poor ? I.d : st.hover ? I.r : I.t });
        KIT.ink('un_d' + b.un, ds, b.x + 44, b.y + 46, { size: L.sizeToFit(ds, b.w - 88, 18), col: poor ? I.off : I.d }); continue; }
      const M = D.META.find((q) => q.id === b.id), r = S.meta.up[M.id] || 0, c = M.cost(r), max = r >= M.max, poor = !max && S.meta.shards < c;
      strip('mt_' + b.id, b, st, !poor, poor);
      const tw = KIT.ink('mt_n' + b.id, M.name, b.x + 44, b.y + 32, { size: 28, col: poor ? I.d : st.hover && !max ? I.r : I.t });
      KIT.ink('mt_d' + b.id, D.metaLine(M, r), b.x + 44, b.y + 68, { size: 20, col: r ? I.g : poor ? I.off : I.d });
      for (let i = 0; i < M.max; i++) pip(b.x + 58 + tw + i * 24, b.y + 24, i < r);
      if (poor) { KIT.ink('mt_c' + b.id, TXT('hud.meta.5', { c }), b.x + b.w - 44, b.y + 32, { size: 24, al: 1, col: I.off }); KIT.ink('mt_sh' + b.id, short(c), b.x + b.w - 44, b.y + 68, { size: 20, al: 1, col: I.r }); }
      else KIT.ink('mt_c' + b.id, max ? TXT('hud.meta.4') : TXT('hud.meta.5', { c }), b.x + b.w - 44, b.y + b.h / 2, { size: 24, al: 1, col: max ? I.g : I.r }); }
    refusal(S, W / 2, 868, I.r);
  }
  // the latest refusal on a full-screen menu, where the in-game feed is hidden
  function refusal(S, x, y, col = '#ffb0a0') {
    const e = S.ev.filter((q) => (q.k === 'nope' || q.k === 'ask') && S.t - q.t < (q.k === 'ask' ? 3 : 2)).at(-1); if (!e) return;
    const T = e.k === 'ask' ? 3 : 2; lab('nope_m', e.s, x, y, { size: 24, al: 0.5, col, a: 1 - L.SS(T - 0.5, T, S.t - e.t) });
  }
  // ---------------- a dungeon altar: three gifts for shards ----------------
  function altar(S, R, t) {
    const sh = R.shrines[R.altar]; if (!sh || !sh.gifts) return;
    const U = D.UI.altar(sh.gifts.length), P = U.P, bank = S.meta.shards, byId = (id) => U.r.find((q) => q.id === id);
    const I = KIT.INK;
    dim(0.6); G.blend('add'); L.glow(W / 2, P.y + 60, 420, [0.3, 0.5, 1], 0.12 + 0.03 * Math.sin(t * 2)); G.blend();
    KIT.panel('altar', P.x, P.y, P.w, P.h, 'leather');
    KIT.banner('al_t', W / 2, P.y + 16, 480, TXT('hud.altar'), { h: 76, size: 36 });
    const bs = String(bank); KIT.light('al_b', bs, P.x + P.w - 56, P.y + 56, { size: 30, al: 1, col: '#9cc8ff' }); icon('crystal', P.x + P.w - 56 - lw('al_b', bs, { size: 30 }) - 44, P.y + 38, 36);
    { const s = sh.used ? TXT('hud.altar.2') : TXT('hud.altar.3'); KIT.light('al_s', s, W / 2, P.y + 118, { size: L.sizeToFit(s, P.w - 100, 22), al: 0.5, col: '#cdb89a' }); }
    sh.gifts.forEach((o, i) => { const b = U.r[i], Gf = D.GIFTS.find((q) => q.id === o.id), can = !sh.used && bank >= o.cost && !D.giftBlocked(R.hero, Gf), st = stN(S, b.id, can), cx = b.x + b.w / 2, iw = b.w - 44;
      KIT.nine('torn', b.x, b.y, b.w, b.h, { u: { grade: st.hover ? HOT : can ? [1, 1, 0, 1] : POOR } }); L.uiBox('al_g' + i, b.x + 20, b.y + 20, b.w - 40, b.h - 40, 0);
      if (Gf.relic || Gf.evo) KIT.seal(b.x + b.w - 40, b.y + 40, 1);
      KIT.cell('al_cl' + i, cx - 64, b.y + 44, 128, Object.assign({}, st, { off: false })); icon(Gf.icon, cx - 56, b.y + 52, 112, can ? undefined : { alpha: 0.5 });
      KIT.ink('al_n' + i, Gf.name, cx, b.y + 214, { size: L.sizeToFit(Gf.name, iw, 28), al: 0.5, col: !can ? I.d : st.hover ? I.r : I.t });
      // a sentence too long for one line breaks by words: it cannot shrink under the font's 20 px floor (TASKS 1851)
      const rank = !Gf.power && o.id !== 'bless' ? (R.hero.perks || {})[o.id] || 0 : 0;
      const ds = rank && !Gf.flat ? Gf.desc.replace(/[\d.]+/, String(Math.round(Gf.v * (rank + 1) * 10) / 10)) : Gf.desc, lines = wrapWords(ds, iw, 21);
      lines.forEach((q, k) => KIT.ink('al_d' + i + (k || ''), q, cx, b.y + 250 + k * 25, { size: 21, al: 0.5, col: can ? I.t : I.d }));
      const wn = rank ? TXT('hud.altar.rank', { p1: rank, p2: rank + 1 }) : Gf.relic ? TXT('hud.altar.relic') : Gf.evo ? TXT('hud.altar.evo') : o.id === 'bless' ? TXT('hud.altar.4') : TXT('hud.altar.5');
      KIT.ink('al_w' + i, wn, cx, b.y + Math.max(306, 256 + lines.length * 25), { size: L.sizeToFit(wn, iw, 18), al: 0.5, col: Gf.relic || Gf.evo ? I.r : I.d });
      const cs = String(o.cost), cw = lw('al_c' + i, cs, { size: 28 }) + 40, x0 = cx - cw / 2;
      icon('crystal', x0, b.y + b.h - 66, 30); KIT.ink('al_c' + i, cs, x0 + 40, b.y + b.h - 50, { size: 28, col: can ? SOUL : I.d }); });
    KIT.button('al_leave', byId('leave'), stN(S, 'leave'));
    const rc = D.rerollCost(sh.rolls || 0, SIM.Q.depOf(R)), rb = Object.assign({}, byId('reroll'), { on: !sh.used && bank >= rc, label: TXT('hud.altar.reroll', { cost: rc }) }); KIT.button('al_reroll', rb, stN(S, 'reroll', rb.on));
    const left = 10 - (R.donations || 0), b = Object.assign({}, byId('donate'), { on: left > 0 && R.hero.gold >= 1000, label: left ? byId('donate').label : TXT('hud.altar.b.label') });
    KIT.button('al_donate', b, stN(S, 'donate', b.on), 'wax');
    KIT.light('al_gold', TXT('hud.altar.6', { gold: R.hero.gold }), b.x + b.w + 40, b.y + 18, { size: 22, col: C.gold });
    KIT.light('al_limit', TXT('hud.altar.7', { left }), b.x + b.w + 40, b.y + 48, { size: 21, col: '#cdb89a' });
    refusal(S, W / 2, P.y + 674);
    KIT.light('al_help', sh.used ? TXT('hud.altar.8') : TXT('hud.altar.9'), W / 2, P.y + P.h + 34, { size: 26, al: 0.5, col: '#a89880' });
  }
  // ---------------- a word with a townsman (TASKS 1016, 1023): his likeness, his name, a page of his words ----------------
  function talk(S, R, t) {
    const T = S.talk, U = D.UI.talk(T), P = U.P, FD = D.FOLK[T.role], keeper = T.role === 'keeper', nm = T.role === 'merchant' ? 'merchant' : 'town_' + T.role, at = (id) => U.r.find((q) => q.id === id);
    parch('talk', P, true);
    panel('tk_frame', P.x + 34, P.y + 44, 232, P.h - 88, { r: 4, c0: [0.09, 0.07, 0.07] });
    const [sw, sh] = SZ(nm), k = 230 / sh; L.sprite(nm, P.x + 150 - sw * k / 2, P.y + P.h - 30 - sh * k, { w: sw * k, h: sh * k });
    lab('tk_n', FD.name, P.x + 300, P.y + 46, { size: 32, col: INK.r });
    lab('tk_j', FD.job, P.x + 300, P.y + 82, { size: 19, col: INK.d });
    wrapLab('tk_s', T.pages[T.p], P.x + 300, P.y + 122, P.w - 360, 28, INK.t);
    const act = at('act');
    // a quest's last page (TASKS 1018): what it pays over the buttons, its button left of the way out
    // and the keepsake a fetch quest asks for, its icon before the reward (TASKS 1030); a turn-in shows its reward only once pressed (TASKS 1840)
    if (act) { const rs = TXT('hud.talk.rs', { p1: SIM.Q.rwLine(T.act.rw) }), ic = SIM.Q.questIcon(R, T.role, T.act), dx = ic ? 54 : 0;
      if (ic) { panel('tk_ic', P.x + 300, P.y + P.h - 160, 44, 44, { r: 6 }); icon(ic, P.x + 304, P.y + P.h - 156, 36); }
      if (T.act.k !== 'turn' && SIM.Q.rwLine(T.act.rw)) lab('tk_rw', rs, P.x + 300 + dx, P.y + P.h - 122, { size: 22, col: INK.g }); }
    if (T.pages.length > 1) lab('tk_p', (T.p + 1) + ' / ' + T.pages.length, P.x + P.w - 40, P.y + 52, { size: 20, al: 1, col: INK.d });
    button('tk_next', Object.assign({}, at('next'), { label: T.menu ? TXT('hud.talk.label.3') : T.p + 1 < T.pages.length ? TXT('hud.talk.label') : T.inTopic ? TXT('UI.talk.back') : act && T.act.k === 'take' ? TXT('hud.talk.label.2') : act && T.act.k === 'finish' ? TXT('hud.talk.goOn') : TXT('hud.talk.label.3') }), S.hover);
    if (act) button('tk_act', Object.assign({}, act, { label: T.act.k === 'take' ? TXT('hud.talk.label.4') : T.act.k === 'finish' ? TXT('hud.talk.finish') : TXT('hud.talk.label.5') }), S.hover);
    if (at('craft')) button('tk_craft', at('craft'), S.hover);
    if (at('talk')) button('tk_orig', at('talk'), S.hover);
    U.r.filter((q) => q.id.startsWith('topic:')).forEach((q) => button('tk_t' + q.i, q, S.hover));
    lab('tk_keys', act && T.act.k === 'finish' ? TXT('hud.talk.finishKeys') : at('craft') && !act && T.p + 1 >= T.pages.length && !T.inTopic ? TXT('hud.talk.craftKeys') : act ? TXT('hud.talk', { p1: T.act.k === 'take' ? (T.act.first ? TXT('hud.talk.2first') : TXT('hud.talk.2')) : TXT('hud.talk.3') }) : T.inTopic ? TXT('hud.talk.topic') : TXT('hud.talk.4'), W / 2, P.y + P.h + 30, { size: 26, al: 0.5, col: '#8a7d6c' });
  }
  // ---------------- the notice board (TASKS 1033): the quests on offer, each with its giver, floor, reward and a button ----------------
  function board(S, R, t) {
    const L0 = SIM.Q.boardOffers(R), U = D.UI.board(L0.length), P = U.P;
    dim(0.6); parch('board', P);
    lab('bd_t', TXT('hud.board'), P.x + 40, P.y + 50, { size: 40, col: INK.r });
    const cb = U.r.find((q) => q.id === 'close'); panel('bd_x', cb.x, cb.y, cb.w, cb.h, { r: 6, rim: S.hover === 'close' ? C.rimHi : C.rim }); lab('bd_xl', '×', cb.x + cb.w / 2, cb.y + cb.h / 2, { size: 34, al: 0.5 });
    hintC('bd_keys', TXT('hud.board.2'), P.y + P.h - 30);
    if (!L0.length) { wrapLab('bd_none', TXT('hud.board.3'), P.x + 40, P.y + 130, P.w - 80, 26, INK.t); return; }
    L0.slice(0, 7).forEach(({ role, of }, i) => { const q = of.q, Q = D.QUESTS[q.key], y = P.y + 136 + i * 104, b = U.r[i], ic = q.ic;
      panel('bd_r' + i, P.x + 30, y, P.w - 60, 96, { r: 6 });
      if (ic) { panel('bd_ic' + i, P.x + 46, y + 18, 60, 60, { r: 6 }); icon(ic, P.x + 52, y + 24, 48); }
      const X = P.x + (ic ? 124 : 50);
      lab('bd_n' + i, Q.name, X, y + 28, { size: 24, col: Q.kind === 'story' ? '#ffc070' : C.gold });
      lab('bd_f' + i, TXT('hud.board.4', { name: D.FOLK[role].name, f: q.f }), X, y + 56, { size: 20, col: C.dim });
      wrapLab('bd_x' + i, Q.text(q), P.x + 700, y + 18, P.w - 970, 20, C.text);
      lab('bd_w' + i, TXT('hud.board.5', { p1: SIM.Q.rwLine(q.rw) }), X, y + 80, { size: 20, col: '#d8b870' });
      button('bd_take' + i, Object.assign({}, b, { label: TXT('hud.board.label') }), S.hover); });
  }
  // ---------------- the quest journal (TASKS 1023): the run's quests on the left, the chosen one on the right ----------------
  const QST = { done: [TXT('QST.done'), '#8fd98a'], taken: [TXT('QST.taken'), '#e8c890'], turned: [TXT('QST.turned'), '#8a7d6c'] };
  function journal(S, R, t) {
    const L0 = SIM.Q.journalOf(R), sel = L0.find((q) => q.id === S.jsel) || L0[0], U = D.UI.journal(L0.length, sel && sel.st === 'taken'), P = U.P;
    dim(0.6); parch('journal', P);
    lab('jr_t', TXT('hud.journal'), P.x + 40, P.y + 50, { size: 40, col: INK.r });
    const cb = U.r.find((q) => q.id === 'close'); panel('jr_x', cb.x, cb.y, cb.w, cb.h, { r: 6, rim: S.hover === 'close' ? C.rimHi : C.rim }); lab('jr_xl', '×', cb.x + cb.w / 2, cb.y + cb.h / 2, { size: 34, al: 0.5 });
    const nb = U.r.find((q) => q.id === 'notes'); button('jr_notes', Object.assign({}, nb, { label: TXT('hud.journal.notes', { n: (S.meta.notes || []).length }) }), S.hover);
    hintC('jr_keys', TXT('hud.journal.2'), P.y + P.h - 30);
    if (!L0.length) { wrapLab('jr_none', R.viaTown ? TXT('hud.journal.3') : TXT('hud.journal.4'), P.x + 40, P.y + 130, P.w - 80, 26, INK.t); return; }
    L0.slice(0, 10).forEach((q, i) => { const b = U.r[i], Q = D.QUESTS[q.key], on = q === sel, hv = S.hover === b.id, [st, col] = QST[q.st];
      panel('jr_r' + i, b.x, b.y, b.w, b.h, { r: 6, rim: on ? [0.85, 0.65, 0.3] : hv ? C.rimHi : C.rim, c0: on ? [0.2, 0.14, 0.09] : undefined, a: q.st === 'turned' && !on ? 0.7 : undefined });
      // ten alike quests tell apart by their floor in the title and their goal under it (TASKS 1853 л); a done or turned-in one, its giver
      const sw = lw('jr_s' + i, st, { size: 20 }), nm = TXT('hud.journal.row', { name: Q.name, f: q.f }), sub = q.st !== 'taken' ? TXT('hud.journal.5', { p1: D.FOLK[q.from] ? D.FOLK[q.from].name : '', f: q.f }) : SIM.Q.questLine(q, R);
      lab('jr_n' + i, nm, b.x + 16, b.y + 19, { size: Math.max(20, L.sizeToFit(nm, b.w - sw - 48, 24)), col: q.st === 'turned' ? '#a89a88' : Q.kind === 'story' ? '#ffc070' : C.gold });
      lab('jr_s' + i, st, b.x + b.w - 16, b.y + 19, { size: 20, al: 1, col });
      lab('jr_f' + i, sub, b.x + 16, b.y + 44, { size: 20, col: C.dim }); });
    const Q = D.QUESTS[sel.key], X = P.x + 540, Wd = P.w - 580, [st, col] = QST[sel.st]; let y = P.y + 130;
    L.solid(X - 20, P.y + 110, 1, P.h - 180, [0.32, 0.2, 0.12], 0, 0, 0, 0.5);
    if (sel.ic) { panel('jr_ic', X, y - 30, 48, 48, { r: 6 }); icon(sel.ic, X + 4, y - 26, 40); }
    lab('jr_dn', Q.name, X + (sel.ic ? 60 : 0), y, { size: 32, col: INK.r }); y += 40;
    lab('jr_dk', TXT('hud.journal.6', { p1: Q.kind === 'story' ? TXT('hud.journal.7') : '', p2: D.FOLK[sel.from] ? D.FOLK[sel.from].name : '—' }), X, y, { size: 20, col: INK.d }); y += 44;
    y += wrapLab('jr_dt', Q.text(sel), X, y, Wd, 24, INK.t) + 18;
    lab('jr_ds', st + (sel.st === 'taken' ? ' · ' + SIM.Q.questLine(sel, R) : sel.st === 'done' ? TXT('hud.journal.8', { p1: D.FOLK[sel.from] ? D.FOLK[sel.from].name : '' }) : ''), X, y, { size: 22, col: INK.g }); y += 48;
    lab('jr_rw0', sel.st === 'turned' ? TXT('hud.journal.9') : TXT('hud.journal.10'), X, y, { size: 22, col: INK.d }); y += 32;
    wrapLab('jr_rw', SIM.Q.rwLine(sel.rw), X, y, Wd, 22, INK.g);
    const dr = U.r.find((q) => q.id === 'drop'); if (dr) button('jr_drop', Object.assign({}, dr, { label: S.jdrop === sel.id && S.t - S.jdropT < 3 ? TXT('hud.journal.drop2') : TXT('hud.journal.drop') }), S.hover);
  }
  function note(S) { const N = D.NOTES.byId[S.note.id], P = { x: 460, y: 240, w: 1000, h: 500 }; if (!N) return; dim(0.6); parch('note', P);
    lab('nt_t', N.title, P.x + 50, P.y + 56, { size: 34, col: INK.r }); wrapLab('nt_s', N.text, P.x + 50, P.y + 120, P.w - 100, 28, INK.t); hintC('nt_k', TXT('hud.note.keys'), P.y + P.h - 34); }
  function notes(S) { const L0 = S.meta.notes || [], pg = S.notesPage || 0, U = D.UI.notes(L0.length, pg), P = U.P, at = (id) => U.r.find((q) => q.id === id); dim(0.6); parch('notes', P);
    lab('ns_t', TXT('hud.notes'), P.x + 40, P.y + 50, { size: 40, col: INK.r }); const cb = at('close'); panel('ns_x', cb.x, cb.y, cb.w, cb.h, { r: 6, rim: S.hover === 'close' ? C.rimHi : C.rim }); lab('ns_xl', '×', cb.x + cb.w / 2, cb.y + cb.h / 2, { size: 34, al: 0.5 });
    if (!L0.length) { wrapLab('ns_none', TXT('hud.notes.none'), P.x + 40, P.y + 130, P.w - 80, 26, INK.t); return; }
    const sel = D.NOTES.byId[S.noteSel] || D.NOTES.byId[L0[0]];
    U.r.filter((q) => q.id.startsWith('n:')).forEach((b) => { const N = D.NOTES.byId[L0[b.i]], on = N === sel; if (!N) return; panel('ns_r' + b.i, b.x, b.y, b.w, b.h, { r: 6, rim: on ? [0.85, 0.65, 0.3] : S.hover === b.id ? C.rimHi : C.rim, c0: on ? [0.2, 0.14, 0.09] : undefined }); lab('ns_n' + b.i, N.title, b.x + 16, b.y + 23, { size: 22, col: N.kind === 'secret' ? '#9cc8ff' : N.kind === 'boss' ? '#ffc070' : C.gold }); });
    const X = P.x + 540, Wd = P.w - 580; L.solid(X - 20, P.y + 110, 1, P.h - 180, [0.32, 0.2, 0.12], 0, 0, 0, 0.5); if (sel) { lab('ns_dn', sel.title, X, P.y + 130, { size: 32, col: INK.r }); wrapLab('ns_dt', sel.text, X, P.y + 190, Wd, 26, INK.t); }
    button('ns_p', Object.assign({}, at('prev'), { label: TXT('hud.notes.prev') }), S.hover); button('ns_nx', Object.assign({}, at('next'), { label: TXT('hud.notes.next') }), S.hover); lab('ns_pg', TXT('hud.notes.page', { p: pg + 1, n: Math.max(1, Math.ceil(L0.length / U.per)) }), P.x + 265, P.y + P.h - 74, { size: 22, al: 0.5, col: INK.d }); }
  // ---------------- a town workshop (R-32, TASKS 1013): the smith's reforging, the enchanter's enchanting ----------------
  function craft(S, R, t) {
    const h = R.hero, U = D.UI.craft(h.bag.length, S.bagTab), P = U.P, c = S.craft, forge = c.kind === 'forge', it = SIM.Q.craftItem(S, R), at = (id) => U.r.find((q) => q.id === id);
    dim(0.55); KIT.panel('craft', P.x, P.y, P.w, P.h, 'leather');
    if (!forge) { G.blend('add'); L.glow(P.x + 1170, P.y + 90, 360, [0.3, 0.5, 1], 0.12 + 0.03 * Math.sin(t * 2)); G.blend(); }
    lab('cr_t', forge ? TXT('hud.craft') : TXT('hud.craft.2'), P.x + 60, P.y + 64, { size: 40, col: forge ? C.gold : '#9cc8ff' });
    const gs = TXT('hud.craft.gs', { gold: h.gold }); lab('cr_g', gs, P.x + P.w - 130, P.y + 60, { size: 26, al: 1, col: C.gold }); icon('it_gold', P.x + P.w - 130 - lw('cr_g', gs, { size: 26 }) - 42, P.y + 44, 32);
    if (!forge) { const ss = String(S.meta.shards); lab('cr_sh', ss, P.x + P.w - 130, P.y + 100, { size: 24, al: 1, col: '#9cc8ff' }); icon('crystal', P.x + P.w - 130 - lw('cr_sh', ss, { size: 24 }) - 36, P.y + 84, 30); }
    lab('cr_eq', TXT('hud.craft.3'), P.x + 60, P.y + 146, { size: 22, col: '#cdb89a' }); bagTabs('cr_tb', U, S);
    for (const b of U.r) { if (b.id.startsWith('eq:')) slot(S, b, h.eq[b.slot], b.slot); else if (b.id.startsWith('bag:')) slot(S, b, h.bag[b.i]); else continue;
      if (b.id === c.sel) edge(b.x - 5, b.y - 5, b.w + 10, b.h + 10, forge ? [1, 0.8, 0.4] : [0.55, 0.75, 1], 3); }
    const X = P.x + 860, help = forge ? TXT('hud.craft.help') : TXT('hud.craft.help.2');
    wrapLab('cr_help', help, X, P.y + 146, 620, 21, '#cdb89a');
    if (!it) lab('cr_pick', TXT('hud.craft.5'), X, P.y + 300, { size: 26, col: C.text });
    else { const b = { id: 'cr_sel', x: X, y: P.y + 220, w: 104, h: 104 }; slot(S, b, it);
      lab('cr_n', SIM.Q.itemName(it), X + 130, P.y + 250, { size: 28, col: hex(D.RARITY[it.rar].col) }); lab('cr_r', TXT('hud.craft.6', { name: D.RARITY[it.rar].name, lvl: it.lvl }), X + 130, P.y + 290, { size: 20, col: '#cdb89a' });
      const rows = Object.entries(it.mods || {}).map(([k, v]) => [D.AFFIXES.find((a) => a.k === k).label.replace('{v}', v), '#8fd98a']).concat((it.ench || []).map((e) => [TXT('hud.craft.rows', { p1: D.AFFIXES.find((a) => a.k === e.k).label.replace('{v}', e.v) }), '#9cc8ff']));
      if (!rows.length) rows.push([TXT('hud.craft.7'), '#cdb89a']);
      rows.forEach(([s0, col], i) => lab('cr_m' + i, s0, X, P.y + 360 + i * 32, { size: 22, col }));
      const k = SIM.Q.craftCost(S, R, it), btn = Object.assign({}, at('do'), { on: k.can && h.gold >= k.gold && S.meta.shards >= k.shards, label: !k.can ? k.why : TXT('hud.craft.btn.label', { p1: forge ? TXT('hud.craft.btn.label.2') : TXT('hud.craft.btn.label.3'), gold: k.gold, p3: k.shards ? TXT('hud.craft.btn.label.4', { shards: k.shards }) : '' }) });
      KIT.button('cr_do', btn, KIT.st(S, 'do', btn.on), 'wax');
      if (k.can && !forge) lab('cr_risk', k.fail ? TXT('hud.craft.8', { p1: Math.round(k.fail * 100) }) : TXT('hud.craft.9'), X + 310, btn.y - 26, { size: 21, al: 0.5, col: k.fail ? '#e0a070' : '#8fd98a' }); }
    if (c.res && S.t - c.res.t < 4) lab('cr_res', c.res.s, X + 310, P.y + P.h - 60, { size: 23, al: 0.5, col: c.res.ok ? '#8fd98a' : '#e0604f', a: 1 - L.SS(3.4, 4, S.t - c.res.t) });
    else refusal(S, X + 310, P.y + P.h - 60);
    KIT.button('cr_talk', at('talk'), KIT.st(S, 'talk'));
    closeBtn('cr_x', U, S);
    lab('cr_keys', TXT('hud.craft.10'), W / 2, P.y + P.h + 34, { size: 26, al: 0.5, col: '#8a7d6c' });
    const hb = U.r.find((q) => q.id === S.hover), hi = hb && (hb.id.startsWith('eq:') ? h.eq[hb.slot] : hb.id.startsWith('bag:') ? h.bag[hb.i] : null);
    if (hi) tooltip(S, hi, hb, h, [TXT('hud.craft.11'), C.gold]);
  }
  // ---------------- the town's storage chest (R-33, TASKS 1012): gear left for the heroes to come ----------------
  function stash(S, R, t) {
    const h = R.hero, U = D.UI.stash(h.bag.length, S.bagTab), P = U.P, T = SIM.Q.stashOf(S), n = D.STASH.cells, dr = S.drag, held = (id) => dr && dr.from === id;
    dim(0.5); KIT.panel('stash', P.x, P.y, P.w, P.h, 'leather');
    KIT.banner('st_t', P.x + P.w / 2, P.y + 22, 460, TXT('hud.stash'), { h: 72, size: 34 });
    lab('st_s', TXT('hud.stash.2'), P.x + P.w / 2, P.y + 140, { size: 21, al: 0.5, col: '#cdb89a' });
    for (const b of U.r) if (b.id.startsWith('stash:')) slot(S, b, held(b.id) ? null : T.items[b.i], undefined, 1);
    lab('st_cells', TXT('hud.stash.4', { n: T.items.filter(Boolean).length, max: n }), P.x + 80 + 632, P.y + 450, { size: 21, al: 1, col: '#cdb89a' });
    bagTabs('st_tb', U, S);
    for (const b of U.r) if (b.id.startsWith('bag:')) slot(S, b, held(b.id) ? null : h.bag[b.i]);
    sortBtns('st_', U, S);
    { const s = TXT('hud.stash.6'), p = s.split(' · '), n = Math.ceil(p.length / 2), q = L.labelW(0, s, { size: 26 }) > P.w - 120 ? [p.slice(0, n).join(' · '), p.slice(n).join(' · ')] : [s]; q.forEach((v, i) => lab('st_help' + i, v, W / 2, P.y + P.h - 36 - (q.length - 1 - i) * 30, { size: 26, al: 0.5, col: '#b8a48a' })); }
    closeBtn('st_x', U, S);
    if (dr) { const it = dr.from.startsWith('bag:') ? h.bag[+dr.from.split(':')[1]] : T.items[+dr.from.split(':')[1]]; if (it) icon(SIM.Q.itemIcon(it), dr.x - 34, dr.y - 34, 68); dropChip(S, U); refusal(S, W / 2, P.y + 476); return; }
    const hb = U.r.find((q) => q.id === S.hover), it = hb && (hb.id.startsWith('bag:') ? h.bag[hb.i] : hb.id.startsWith('stash:') && hb.i < n ? T.items[hb.i] : null);
    if (it) tooltip(S, it, hb, h, [hb.id.startsWith('bag:') ? TXT('hud.stash.8') : TXT('hud.stash.9'), C.gold], null, [10, 10, W - 10, P.y + P.h - 70]);
    refusal(S, W / 2, P.y + 476);
  }
  // ---------------- the town's ring of stones: the open portal and the waystones woken this run (TASKS 1009) ----------------
  // the town's gate out (TASKS 1149): give up, or end the run won past the campaign's last boss
  function leave(S, R) {
    const U = D.UI.leave(), P = U.P, done = SIM.Q.campaignDone(R);
    dim(0.6); KIT.panel('leave', P.x, P.y, P.w, P.h, 'leather');
    KIT.banner('lv_t', W / 2, P.y + 16, 460, TXT('hud.leave'), { h: 76, size: 36 });
    wrapLab('lv_s', done ? TXT('hud.leave.done') : TXT('hud.leave.give'), P.x + 48, P.y + 122, P.w - 96, 26, KIT.INK.cream);
    KIT.button('lv_go', Object.assign({}, U.r[0], { label: done ? TXT('hud.leave.goDone') : TXT('hud.leave.goGive') }), askSt(S, U, 'go'));
    KIT.button('lv_stay', U.r[1], askSt(S, U, 'stay'));
    KIT.light('lv_help', TXT('hud.leave.keys'), W / 2, P.y + P.h + 34, { size: 26, al: 0.5, col: '#a89880' });
  }
  function gate(S, R, t) {
    const o = SIM.Q.gateWays(R), U = D.UI.gate(o.length), P = U.P, I = KIT.INK;
    dim(0.6); G.blend('add'); L.glow(W / 2, P.y + 60, 380, [0.45, 0.55, 1], 0.12 + 0.03 * Math.sin(t * 2)); G.blend();
    KIT.panel('gate', P.x, P.y, P.w, P.h, 'leather');
    KIT.banner('gt_t', W / 2, P.y + 16, 460, TXT('hud.gate'), { h: 76, size: 36 });
    KIT.light('gt_s', TXT('hud.gate.2'), W / 2, P.y + 118, { size: 22, al: 0.5, col: '#cdb89a' });
    o.forEach((q, i) => { const b = U.r[i], st = stN(S, b.id), nm = q.k === 'portal' ? TXT('hud.gate.3', { f: q.f }) : TXT('hud.gate.4', { f: q.f }), x = b.x + 108, iw = b.w - 108 - 40;
      KIT.nine('btn', b.x, b.y, b.w, b.h, { u: { grade: st.hover ? HOT : [1, 1, 0, 1] } }); L.uiBox('gt_r' + i, b.x + 30, b.y, b.w - 60, b.h, 2);
      if (q.k === 'portal') icon('it_scroll', b.x + 44, b.y + 12, 48); else L.sprite('waystone', b.x + 46, b.y + 6, { h: 62 });
      KIT.ink('gt_n' + i, nm, x, b.y + 26, { size: L.sizeToFit(nm, iw, 26), col: st.hover ? I.r : I.t });
      const ds = q.k === 'portal' ? TXT('hud.gate.5') : D.floorName(q.f, (R.memo && R.memo[q.f] || R).mode, R.seed, R.campaignWon ? D.RUNS.campaign.floors + 1 : 1);
      KIT.ink('gt_d' + i, ds, x, b.y + 52, { size: L.sizeToFit(ds, iw, 18), col: I.d }); });
    KIT.button('gt_leave', U.r[o.length], stN(S, 'leave'));
    KIT.light('gt_help', TXT('hud.gate.6'), W / 2, P.y + P.h + 34, { size: 26, al: 0.5, col: '#a89880' });
  }
  let endErr = null;
  function end(S, t) {
    const r = S.result || {}, win = S.screen === 'win', damage = (r.damage || []).slice(-3), last = damage[damage.length - 1];
    backdrop(t);
    const title = win ? TXT('hud.end') : r.abandoned ? TXT('hud.end.2') : TXT('hud.end.3');
    KIT.banner('e_t', W / 2, 18, Math.max(560, lw('e_t_m', title, { size: 52, bold: true }) + 300), title, { h: 108, size: 52 });
    KIT.light('e_s', win ? (r.mode === 'cave' ? TXT('hud.end.4') : r.mode === 'magma' ? TXT('hud.end.5', { name: D.ENEMIES[D.RUNS.magma.boss(D.RUNS.magma.floors)].name }) : TXT('hud.end.6')) : TXT('hud.end.7'), W / 2, 168, { size: 26, al: 0.5, col: '#d9c8a8' });
    KIT.panel('e_story', 200, 220, 420, 650, 'leather', { pad: 0 });
    const wrap = (id, s, x, y, width, size, col, al = 0) => {
      const words = String(s).split(' '), lines = []; let line = '';
      for (const w of words) { const next = line ? line + ' ' + w : w;
        if (line && lw(id + '_measure', next, { size }) > width) { lines.push(line); line = w; } else line = next; }
      if (line) lines.push(line);
      lines.forEach((v, i) => lab(id + i, v, x, y + i * (size + 7), { size, col, al })); return lines.length * (size + 7);
    };
    lab('e_story_t', win ? TXT('hud.end.8') : r.abandoned ? TXT('hud.end.9') : TXT('hud.end.10'), 410, 258, { size: 23, al: 0.5, col: C.gold });
    G.blend('add'); L.glow(410, 400, 180, win ? [0.75, 0.5, 0.2] : [0.55, 0.08, 0.06], 0.25); G.blend();
    // a portrait that fails must not take the rest of the screen with it: the buttons are the only way to save the run's log (TASKS 1335)
    if (!r.abandoned) try { SCENE.endActors(r, win, t, 410, 490); } catch (e) { if (!endErr) { endErr = e; console.error(e); } L.pre = L.sp = null; G.blend(); }
    if (!win && (!last || !last.actor || r.abandoned)) icon(r.abandoned ? 'it_scroll' : last && last.src === 'spike' ? 'trap_spike' : 'bf_burn', 346, 340, 128);
    const actor = last && last.actor, name = win ? (D.runOf(r.mode).won || TXT('hud.end.name')) : r.abandoned ? TXT('hud.end.name.2') : actor ? (actor.elite && actor.type !== 'boss' ? D.eliteName(actor) : D.ENEMIES[actor.type].name) : SIM.Q.damageName(last && last.src);
    const ny = win ? 590 : 540, y = ny + wrap('e_cause', name, 410, ny, 350, 28, C.text, 0.5);
    if (!win && !r.abandoned && last) {
      lab('e_last', TXT('hud.end.11', { p1: Math.round(last.n) }), 410, y + 12, { size: 24, al: 0.5, col: KIT.INK.gold, out: '#2a0d08' });
      lab('e_recent', TXT('hud.end.12'), 234, 686, { size: 21, col: C.dim });
      damage.slice().reverse().forEach((d, i) => {
        const src = SIM.Q.damageName(d.src), size = Math.min(20, Math.floor(20 * 280 / Math.max(280, lw('e_src_m' + i, src, { size: 20 }))));
        lab('e_src' + i, src, 234, 724 + i * 38, { size }); lab('e_dmg' + i, '−' + Math.round(d.n), 588, 724 + i * 38, { size: 21, al: 1, col: '#ffb49a', out: '#2a0d08' });
      });
    } else wrap('e_flavor', win ? (D.runOf(r.mode).wonText || TXT('hud.end.13')) : TXT('hud.end.14'), 234, 674, 350, 25, C.dim);
    const C2 = r.C || { floors: 0, foes: 0, kills: 0, lootN: 0, loot: 0, secN: 0, sec: 0, pct: 0 }, pc = (k, n) => Math.floor(100 * Math.min(1, k / n)) + '%';
    const runRows = [r.record ? [TXT('hud.end.runRows'), (r.deepest || r.floor) + (r.record.fresh ? TXT('hud.end.runRows.2') : TXT('hud.end.runRows.3', { best: r.record.best }))] : [TXT('hud.end.runRows.4'), r.deepest || r.floor], ...(r.campaignWon ? [[TXT('hud.end.runRows.5'), TXT('hud.end.runRows.6')]] : []), [TXT('hud.end.runRows.7'), r.lvl], [TXT('hud.end.runRows.8'), fmtT(r.time || 0)], [TXT('hud.end.runRows.9'), r.gold], [TXT('hud.end.runRows.10'), r.kills]];
    const doneRows = [[TXT('hud.end.doneRows'), C2.foes ? C2.kills + '/' + C2.foes + ' · ' + pc(C2.kills, C2.foes) : '—'], [TXT('hud.end.doneRows.2'), C2.lootN ? C2.loot + '/' + C2.lootN + ' · ' + pc(C2.loot, C2.lootN) : '—'],
      [TXT('hud.end.doneRows.3'), C2.secN ? C2.sec + '/' + C2.secN + ' · ' + pc(C2.sec, C2.secN) : '—'], [TXT('hud.end.doneRows.4'), C2.passed ?? C2.floors], [TXT('hud.end.doneRows.5'), Math.round(100 * C2.pct) + '%']];
    const bx = 650, by = 220, I = KIT.INK;
    page('e_box', bx, by, 1070, 650);
    KIT.ink('e_h1', TXT('hud.end.15'), bx + 30, by + 46, { size: 28, col: I.r }); KIT.ink('e_h2', TXT('hud.end.16'), bx + 570, by + 46, { size: 28, col: I.r });
    runRows.forEach(([n, v], i) => { const y = by + 94 + i * 40, tw = KIT.ink('e_n' + i, n, bx + 30, y, { size: 24, col: I.d }), vw = KIT.ink('e_v' + i, v, bx + 480, y, { size: 24, al: 1 }); KIT.leader(bx + 30 + tw + 12, bx + 480 - vw - 10, y + 6); });
    doneRows.forEach(([n, v], i) => { const y = by + 94 + i * 40, tw = KIT.ink('e_cn' + i, n, bx + 570, y, { size: 24, col: I.d }), vw = KIT.ink('e_cv' + i, v, bx + 1040, y, { size: 24, al: 1, col: I.g }); KIT.leader(bx + 570 + tw + 12, bx + 1040 - vw - 10, y + 6); });
    KIT.rule(bx + 30, by + 300, 1010, 0.7);
    const base = r.base ?? r.bonus ?? 0, sb = r.statBonus || 0;
    const rew = [[TXT('hud.end.rew'), '+' + (r.found ?? (r.shards - base - sb))],
      [TXT('hud.end.rew.2', { goldPer: SIM.REWARD.goldPer, p2: r.win ? TXT('hud.end.rew.3', { win: r.win }) : '' }), '+' + base]];
    rew.forEach(([n, v], i) => { KIT.ink('e_rn' + i, n, bx + 30, by + 338 + i * 42, { size: 23, col: I.d }); KIT.ink('e_rv' + i, v, bx + 1040, by + 338 + i * 42, { size: 24, al: 1, col: SOUL }); });
    if (r.donations) KIT.ink('e_donations', TXT('hud.end.17', { donations: r.donations }), bx + 30, by + 424, { size: 21, col: I.d });
    KIT.rule(bx + 30, by + 456, 1010, 0.7);
    KIT.ink('e_tn', TXT('hud.end.18'), bx + 30, by + 500, { size: 32 }); KIT.ink('e_tv', '+' + r.shards, bx + 1040, by + 500, { size: 32, al: 1, col: SOUL });
    const up = S.meta.up || {}, available = D.metaFor(S.meta.cls).filter((m) => (up[m.id] || 0) < m.max), affordable = available.find((m) => m.cost(up[m.id] || 0) <= S.meta.shards), next = affordable || available.slice().sort((a, b) => a.cost(up[a.id] || 0) - b.cost(up[b.id] || 0))[0];
    const rank = ['I', 'II', 'III', 'IV', 'V'], goal = next ? next.name + ' ' + rank[up[next.id] || 0] : '';
    const line = affordable ? TXT('hud.end.line', { goal }) : next ? TXT('hud.end.line.2', { goal, p2: next.cost(up[next.id] || 0) - S.meta.shards }) : TXT('hud.end.line.3');
    wrap('e_goal', line, bx + 30, by + 566, 1000, 25, I.g);
    for (const b of D.UI.end(r.log, r.town)) KIT.button('eb_' + b.id, b, stN(S, b.id, b.on), b.id === 'again' ? 'wax' : 'parch');
    // what the journal button gives (TASKS 1853 и): a file, so the player knows where it went
    if (S.hover === 'log' && r.log) lab('eb_log_tip', TXT('hud.end.logTip'), W / 2, 1030, { size: 22, al: 0.5, col: C.dim });
  }
})();
