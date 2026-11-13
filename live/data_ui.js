// live/data_ui.js — UI layout in view px: the sim hit-tests these, the HUD draws them.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { ABILITIES, DIFF, META, SHOP, SLOTS, STASH, STATS, zoomName } = D;
  // ---------------- UI layout (view px) — the sim hit-tests these, the HUD draws them ----------------
  // the town (R-17, TASKS 1002): the campaign through the town, a test run until the town is done and the campaign starts there
  const TEST_RUNS = [['cave', TXT('TEST_RUNS'), TXT('TEST_RUNS.2')], ['magma', TXT('TEST_RUNS.3'), TXT('TEST_RUNS.4')], ['endless', TXT('TEST_RUNS.5'), TXT('TEST_RUNS.6')]];
  // the buttons that start a run from the main menu, in the order pressed (bots and checks press these): a test run's screen opens
  // by ` on the menu (TASKS 1878), the step ['menu', 'tests'] stands for that key
  const campaignLen = () => { const n = D.RUNS.campaign.floors; return { n, floors: TXT.n('UI.menu.floors', n) }; };
  // the buttons a new run of this mode is started by, screen by screen; the start screen with the difficulty and the class comes last (TASKS 1304)
  const startPath = (mode) => (mode === 'campaign' || mode === 'town' ? [['menu', 'campaign']] : [['menu', 'tests'], ['tests', mode]]).concat([['classes', 'go']]);
  // «Что нового» (TASKS 1038): DATA.CHANGES, newest first, as rows of fixed heights; a point is wrapped by its length (the sim
  // scrolls by whole rows, so it needs the rows without the HUD's text measure; the screen's qa check catches a line too long)
  const NEWS = { P: { x: 300, y: 60, w: 1320, h: 960 }, top: 150, bottom: 120, wrap: 84, h: { ver: 70, group: 46, line: 34, gap: 8 } };
  const wrapLine = (s, n) => { const out = []; let cur = '';
    for (const w of s.split(' ')) { if (cur && cur.length + 1 + w.length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    return cur ? out.concat([cur]) : out; };
  // only the versions in `open` show their points (TASKS 1971); with no `open` only the newest one does
  let newsMemo = { src: null, by: {} };
  const newsRows = (open) => { const top = (D.CHANGES[0] || {}).v, on = open || { [top]: 1 }, key = (D.CHANGES || []).filter((e) => on[e.v]).map((e) => e.v).join('|');
    if (newsMemo.src !== D.CHANGES) newsMemo = { src: D.CHANGES, by: {} };
    if (newsMemo.by[key]) return newsMemo.by[key]; const rows = [];
    for (const e of D.CHANGES || []) { rows.push({ k: 'ver', v: e.v, date: e.date, open: !!on[e.v], h: NEWS.h.ver });
      if (!on[e.v]) continue;
      for (const g of e.groups) { rows.push({ k: 'group', s: g.name, h: NEWS.h.group });
        for (const it of g.items) wrapLine(it, NEWS.wrap).forEach((s, i, a) => rows.push({ k: 'line', s, first: !i, h: NEWS.h.line + (i === a.length - 1 ? NEWS.h.gap : 0) })); } }
    return (newsMemo.by[key] = rows); };
  const MENU_SHEET = { x: 48, w: 620, bottom0: 1012, top: 92, row: 56, sub: 26, gap: 34, bottom: 78, inX: 56 };
  const MENU_ITEMS = [['continue', 'campaign', 'load'], ['stats', 'settings'], ['update', 'quit']];
  const MENU_LABEL = { update: (u) => (u && u.web ? TXT('UI.menu.update.web', { v: u.v }) : TXT('UI.menu.update')), continue: () => TXT('UI.menu'), load: () => TXT('UI.menu.load'), stats: () => TXT('UI.menu.stats'), settings: () => TXT('UI.menu.settings'), quit: () => TXT('UI.menu.quit') };
  // the update's item (TASKS 1870) and its small mark under the label: a version found, its download, the restart it waits for
  const updShown = (u) => !!u && (!!u.can || (!!u.web && u.st === 'web'));
  const updMark = (u) => (!u || u.web ? '' : u.st === 'avail' ? TXT('hud.menu.upd.avail', { v: u.v }) : u.st === 'down' ? TXT('hud.menu.upd.down', { pct: Math.floor(u.pct || 0) }) : u.st === 'ready' ? TXT('hud.menu.upd.ready') : '');
  // a release's short «Что нового» from its notes on GitHub, which are the CHANGELOG entry: the first section's points (the menu's
  // «Самое главное» where the entry has it), markup dropped, a point's wrapped lines joined
  const relNotes = (body, n = 5) => { const out = []; let cur = -1, secs = 0;
    for (const l of String(body || '').replace(/\r/g, '').split('\n')) {
      if (/^#{2,4} /.test(l)) { if (secs++ && out.length) break; cur = -1; continue; }
      if (/^[-*] /.test(l)) { if (out.length >= n) break; cur = out.push(l.slice(2).trim()) - 1; continue; }
      if (/^\s+\S/.test(l) && cur >= 0) { out[cur] += ' ' + l.trim(); continue; }
      if (l.trim()) cur = -1; }
    return out.map((s) => s.replace(/\*\*|`/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')); };
  const verNewer = (a, b) => { const p = (v) => String(v || '').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0); const A = p(a), B = p(b);
    for (let i = 0; i < 3; i++) if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0); return false; };
  const NEWS_FRAME = { x: 1250, bottom0: 972, w: 640, top: 134, line: 28, gap: 20, bottom: 44, wrap: 42, link: { gap: 14, w: 320, h: 36 } };
  // the sort buttons beside a grid: by type, rarity, level, stacked from (x, y)
  const SORTS = [['type', TXT('UI.sort.type')], ['rar', TXT('UI.sort.rar')], ['lvl', TXT('UI.sort.lvl')]];
  // the paper windows close by a button at the bottom's middle, as «Уйти» at the gate and altars, not by a corner cross (TASKS 1899)
  const paperClose = (P) => ({ id: 'close', label: TXT('UI.paper.close'), on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 60, w: 300, h: 60 });
  const sortCol = (pre, x, y, w = 210, h = 46) => SORTS.map(([k, label], i) => ({ id: pre + ':' + k, k, label, on: true, x, y: y + i * (h + 12), w, h }));
  // the bag's cells (TASKS 1332): 72 px on an 80 px step, eight to a row, as on ref_ui_inv_b; `id` makes each cell's id from its
  // index, so the merchant's grid sells what the hero screen's grid wears
  const CELL = 72, STEP = 80, COLS = 8;
  const grid = (id, n, x, y, o = {}) => Array.from({ length: n }, (_, j) => Object.assign({ id: id + ':' + ((o.a || 0) + j), i: (o.a || 0) + j, x: x + (j % COLS) * STEP, y: y + Math.floor(j / COLS) * (o.dy || STEP), w: CELL, h: CELL }));
  // the bag's tabs (TASKS 1687): the bag's own 24 cells, then a tab for each pouch of 16 bought at the Altar of souls; a grid shows
  // the open tab's cells, their ids the bag's own indices
  const bagTabs = (len = D.BAG.start) => { const t = [{ a: 0, n: Math.min(len, D.BAG.start) }]; for (let a = D.BAG.start; a < len; a += D.BAG.pouch) t.push({ a, n: Math.min(D.BAG.pouch, len - a) }); return t; };
  const tabAt = (len, tab) => { const T = bagTabs(len); return T[Math.max(0, Math.min(T.length - 1, tab | 0))]; };
  const bagTabOf = (len, i) => bagTabs(len).findIndex((q) => i >= q.a && i < q.a + q.n);
  const bagGrid = (x, y, pre = 'bag', dy, len, tab) => { const T = tabAt(len, tab); return grid(pre, T.n, x, y, { a: T.a, dy }); };
  const tabRow = (x, y, len, w = 200, h = 50) => bagTabs(len).map((q, k) => ({ id: 'btab:' + k, tab: k, label: k ? TXT('hud.inv.pouch', { n: k }) : TXT('hud.inv.10'), on: true, x: x + k * (w + 8), y, w, h }));
  // the settings screen's rows, in order (TASKS 1302): each a slider over its stops, its value kept in S.meta[key]
  const SETTINGS_BOOK = { x: 380, w: 1160, top: 236, row: 100, foot: 160 };
  // the brightness (TASKS 1303): a gamma on the frame's final grade, the HUD drawn after it untouched
  const VOLS = [0, 0.25, 0.5, 0.75, 1], BRIGHTS = [0.7, 0.85, 1, 1.2, 1.4], stepName = (v) => { const i = BRIGHTS.indexOf(v) - 2; return i > 0 ? '+' + i : i < 0 ? '\u2212' + -i : '0'; };
  const SETTINGS = [{ id: 'zoom', key: 'zoom', name: () => TXT('UI.settings.zoom'), stops: D.ZOOMS, def: D.ZOOM, fmt: zoomName },
    { id: 'bright', key: 'bright', name: () => TXT('UI.settings.bright'), stops: BRIGHTS, def: 1, fmt: stepName, ends: () => [TXT('UI.settings.bright.lo'), TXT('UI.settings.bright.hi')] },
    { id: 'vol', key: 'vol', name: () => TXT('UI.settings.vol'), stops: VOLS, def: 1, fmt: (v) => Math.round(v * 100) + ' %', ends: () => [TXT('UI.settings.vol.lo'), TXT('UI.settings.vol.hi')] },
    // the fullscreen (TASKS 1864): a checkbox, as on ref_ui_settings_b; the sim keeps the wish, the page applies it and reports it back
    { id: 'full', key: 'full', name: () => TXT('UI.settings.full'), stops: [0, 1], def: 0, check: true }];
  // the statistics' rows in order; runs, wins and the best depth the meta has kept from the start, the rest only since 1309
  const STATS_BOOK = { x: 240, y: 90, w: 1440, h: 880 }, STAT_ROWS = ['runs', 'wins', 'deaths', 'kills', 'elites', 'bosses', 'shards', 'best', 'time'];
  // five save slots: five rows of a portrait and four columns fill the left page at a readable size, as on ref_ui_saves_b
  const SAVE_SLOTS = 5, LOAD_BOOK = { x: 160, y: 60, w: 1600, h: 900 };
  // a saved run's wall-clock stamp (local time, ms since 1970, written by the sim from the page's input) as day, month, year, hour,
  // minute: calendar arithmetic, so the render never asks the clock
  const dateOf = (ms) => { const day = Math.floor(ms / 864e5), rest = ms - day * 864e5, z = day + 719468, era = Math.floor(z / 146097), doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365), doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153), d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9;
    return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d, h: Math.floor(rest / 36e5), mi: Math.floor(rest / 6e4) % 60 }; };
  // the view's height range (TASKS 1861, the sim keeps the size: sim_core) and the windows' frame: they are laid out on 1920×1080, the menu's
  // sheet and the talk stand on the view's bottom edge, the rest in its middle, on the 2 px grid
  const VIEW_H = [1080, 1248], uiDy = (scr, vh) => (!scr || scr === 'play' ? 0 : scr === 'menu' || scr === 'talk' ? vh - VIEW_H[0] : Math.round((vh - VIEW_H[0]) / 4) * 2);
  // the play feed's plates, newest last: a refusal said again while its plate still shows takes that plate's place, fresh, instead of
  // stacking a copy (TASKS 1815). Kept here and not in the bus (review of PR 57): S.ev stays append-only for everyone who reads it
  const FEED_K = new Set(['pickup', 'nope', 'lvl', 'unlock', 'trade']);
  const feedOf = (ev, t, n = 5) => { const f = ev.filter((e) => FEED_K.has(e.k) && t - e.t < 3);
    return f.filter((e, i) => !(e.k === 'nope' && e.s && f.some((q, j) => j > i && q.k === 'nope' && q.s === e.s))).slice(-n); };
  const INV = { L: { x: 96, y: 84, w: 600, h: 912 }, R: { x: 720, y: 84, w: 1104, h: 912 } };
  const UI = {
    // the bottom panel's height and its gap to the view's foot: the HUD lays it out by them and the camera keeps the hero above it (TASKS 1911)
    bp: { h: 122, foot: 6 },
    // full: every save slot holds a run, so a new one takes the place of the one played longest ago (TASKS 1311, 1785)
    // quit: the game can close its own window (the desktop build, TASKS 1877); a browser tab cannot, and there «Выход» is not shown
    // upd: the update's state from the page (TASKS 1870): the desktop build always has its item, the browser one only once a newer version is out
    menu: (hasRun, diff, zoom, full = hasRun, quit = false, upd = null) => { const F = UI.newsFrame();
      return UI.menuSheet(hasRun, full ? TXT('UI.menu.4') : TXT('UI.menu.2'), quit, upd).r.concat(F ? [Object.assign({ id: 'news', label: F.linkLabel, on: true, link: true }, F.link)] : []); },
    // the main menu (TASKS 1301), look B: small ink items on a parchment sheet in the bottom-left corner, as on ref_ui_menu_b; the
    // sheet stands on its bottom edge, so without «Продолжить» it is shorter and the rest keep their places. Groups are cut by a
    // rule: the run, then the books, then «Выход» where there is one
    menuSheet: (hasRun, newLabel = TXT('UI.menu.2'), quit = false, upd = null) => { const M = MENU_SHEET, r = [], rules = []; let y = M.top;
      MENU_ITEMS.map((g) => g.filter((id) => (id !== 'continue' || hasRun) && (id !== 'quit' || quit) && (id !== 'update' || updShown(upd)))).filter((g) => g.length).forEach((g, gi) => { if (gi) { rules.push(y + M.gap / 2); y += M.gap; }
        for (const id of g) { const h = M.row + (id === 'continue' || (id === 'update' && updMark(upd)) ? M.sub : 0);
          r.push({ id, label: id === 'campaign' ? newLabel : MENU_LABEL[id](upd), on: true, x: M.x + M.inX, y, w: M.w - M.inX * 2, h }); y += h; } });
      const h = y + M.bottom, y0 = M.bottom0 - h; r.forEach((b) => { b.y += y0; });
      return { P: { x: M.x, y: y0, w: M.w, h }, r, rules: rules.map((v) => v + y0) }; },
    // the version's sheet on the menu's right (TASKS 1305, 1873): «Версия N» over its main lines, wrapped to the frame, and the
    // small link to the whole «Что нового» under them; it stands on its bottom edge, so a longer list grows up into the empty
    // corner. It carries the version itself, so with no main lines it still stands, the heading and the link alone
    newsFrame: (main = (D.CHANGES[0] || {}).main) => { const top = D.CHANGES[0]; if (!top) return null; const F = NEWS_FRAME, rows = []; let y = F.top;
      (main || []).forEach((s, i) => { if (i) y += F.gap; wrapLine(s, F.wrap).forEach((q, j) => { rows.push({ s: q, first: !j, y }); y += F.line; }); });
      const ly = (rows.length ? y + F.link.gap : y - 20), h = ly + F.link.h + F.bottom - 12, y0 = F.bottom0 - h;
      return { P: { x: F.x, y: y0, w: F.w, h }, v: top.v, rows: rows.map((r) => Object.assign(r, { y: y0 + r.y })),
        link: { x: F.x + (F.w - F.link.w) / 2, y: y0 + ly, w: F.link.w, h: F.link.h }, linkLabel: TXT('UI.menu.news', { v: top.v }) }; },
    // the test runs (TASKS 417, 1878): a screen of their own behind ` on the main menu, in the campaign's order (the caves, then the
    // magma caves, then the endless descent past them), «Назад» last
    // the start screen (TASKS 1103, 1304): the difficulty's tabs over the class cards, a card a ready class, side by side, the start
    // and back buttons under them
    // with no kit to choose (a first hero) the cards lose the kit button's row, or about 70 px of each stay empty (TASKS 1757)
    classes: (meta) => { const ids = D.classesReady(), W = 536, gap = 24, x0 = 960 - (ids.length * W + (ids.length - 1) * gap) / 2, TW = 300, tg = 16;
      const CH = ids.some((id) => D.kitsOf(id, meta).length > 1) ? 696 : 650, by = 182 + CH + 18;
      return ids.filter((id) => D.kitsOf(id, meta).length > 1).map((id) => ({ id: 'kit:' + id, kit: id, on: true, x: x0 + ids.indexOf(id) * (W + gap) + 60, y: 762, w: W - 120, h: 44 }))
        .concat(D.DIFF_ORDER.map((d, i, a) => ({ id: 'dif:' + d, dif: d, label: DIFF[d].name, on: true, x: 960 - (a.length * TW + (a.length - 1) * tg) / 2 + i * (TW + tg), y: 44, w: TW, h: 60 })))
        .concat(ids.map((id, i) => ({ id: 'cls:' + id, cls: id, on: true, x: x0 + i * (W + gap), y: 182, w: W, h: CH })))
        // the hero's name between «Назад» and «В путь» (TASKS 1879): the field, and the die that throws a name into it
        .concat([{ id: 'go', label: TXT('UI.classes.go'), on: true, x: 1284, y: by, w: 300, h: 68 }, { id: 'back', label: TXT('UI.classes.back'), on: true, x: 336, y: by, w: 300, h: 68 },
          { id: 'name', on: true, x: 660, y: by, w: 520, h: 68 }, { id: 'dice', on: true, x: 1192, y: by, w: 68, h: 68 }]); },
    tests: (hasRun, full = hasRun) => TEST_RUNS.map(([id, fresh, again], i) => ({ id, label: !full ? fresh : again, on: true, x: 720, y: 440 + i * 86, w: 480, h: 72 }))
      .concat([{ id: 'back', label: TXT('UI.tests.back.label'), on: true, x: 810, y: 440 + TEST_RUNS.length * 86 + 40, w: 300, h: 70 }]),
    // the rows that fit from row `top`, and the last top that still fills the view (the end of the list sits at its bottom)
    news: (top, open) => { const P = NEWS.P, rows = newsRows(open), vh = P.h - NEWS.top - NEWS.bottom; let max = rows.length, fill = 0;
      while (max > 0 && fill + rows[max - 1].h <= vh) fill += rows[--max].h;
      const t = Math.max(0, Math.min(max, top || 0)), shown = []; let y = P.y + NEWS.top;
      for (let i = t; i < rows.length && y + rows[i].h <= P.y + NEWS.top + vh; i++) { shown.push(Object.assign({ y }, rows[i])); y += rows[i].h; }
      const view = { x: P.x + 60, y: P.y + NEWS.top, w: P.w - 120, h: vh }, sx = P.x + P.w - 56;
      // the scroll's track and thumb for both the sim's drag and the HUD (TASKS 1971); the track's hit is wider than its ink rule
      const th = Math.max(60, vh * vh / (vh + max * 34)), bar = max > 0 ? { track: { id: 'track', x: sx - 14, y: view.y, w: 31, h: vh }, thumb: { x: sx - 4, y: view.y + (vh - th) * (t / max), w: 11, h: th }, x: sx } : null;
      return { P, rows: shown, top: t, max, n: rows.length, view, bar,
        heads: shown.filter((r) => r.k === 'ver').map((r) => ({ id: 'ver:' + r.v, v: r.v, x: view.x, y: r.y, w: bar ? bar.track.x - view.x : view.w, h: r.h })),
        r: [{ id: 'back', label: TXT('UI.news.back.label'), on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 94, w: 300, h: 66 }] }; },
    // the settings (TASKS 1302): a wide sheet (1876, no spine), a row a setting across it (its name on the left, its control on the right).
    // The sheet is as tall as the settings there are (TASKS 1758: five rows' room held two and stood two thirds empty); the graphics
    // modes (1372) and the language (1039) will each add a row. «Назад» under the sheet, as on the saves' screen
    settings: () => { const K = SETTINGS_BOOK, h = K.top + SETTINGS.length * K.row - 50 + K.foot, y = Math.max(40, Math.round((1080 - h - 150) / 2)), B = { x: K.x, y, w: K.w, h };
      const rows = SETTINGS.map((q, i) => Object.assign({ y: B.y + K.top + i * K.row }, q));
      return { B, rows, r: rows.map((q) => (q.check ? { id: q.id, check: 1, x: 1000, y: q.y - 34, w: 68, h: 68 } : { id: q.id, slider: q.stops, x: 1000, y: q.y - 34, w: 420, h: 68 }))
        .concat([{ id: 'back', label: TXT('UI.settings.back'), on: true, x: 960 - 150, y: B.y + B.h + 26, w: 300, h: 64 }]) }; },
    // the statistics (TASKS 1309): an open book, the counters on the left page, the tabs (all classes, then each ready one) over the
    // right page with its chart, «Назад» at the right page's foot
    stats: () => { const B = STATS_BOOK, tabs = ['all'].concat(D.classesReady()), TW = 138, tg = 8, rx = B.x + B.w / 2 + 48, rw = B.w / 2 - 110;
      const x0 = rx + (rw - (tabs.length * TW + (tabs.length - 1) * tg)) / 2;
      return { B, tabs, rows: STAT_ROWS.map((k, i) => ({ k, y: B.y + 212 + i * 62 })), chart: { x: rx + 40, y: B.y + 280, w: rw - 80, h: 230 },
        r: tabs.map((c, i) => ({ id: 'tab:' + c, tab: c, label: c === 'all' ? TXT('UI.stats.all') : D.CLASSES[c].name, on: true, x: x0 + i * (TW + tg), y: B.y + 92, w: TW, h: 52 }))
          .concat([{ id: 'back', label: TXT('UI.stats.back'), on: true, x: rx + rw / 2 - 150, y: B.y + B.h - 150, w: 300, h: 64 }]) }; },
    // the saved games (TASKS 1311): an open book, a row a slot on the left page, the chosen slot's page on the right with «Загрузить»
    // and «Удалить»; a delete asks first on a loose sheet laid over the right page, its «Нет» the default
    load: () => { const B = LOAD_BOOK, lx = B.x + 62, lw = B.w / 2 - 110, rx = B.x + B.w / 2 + 48, rw = B.w / 2 - 110, ask = { x: rx + 40, y: B.y + 590, w: rw - 80, h: 240 };
      return { B, ask, rows: Array.from({ length: SAVE_SLOTS }, (_, i) => ({ id: 'slot:' + i, i, on: true, x: lx, y: B.y + 150 + i * 132, w: lw, h: 118 })),
        btn: [{ id: 'go', label: TXT('UI.load.go'), x: rx + rw / 2 - 170, y: B.y + 610, w: 340, h: 70 }, { id: 'del', label: TXT('UI.load.del'), x: rx + rw / 2 - 130, y: B.y + 700, w: 260, h: 58 },
          { id: 'back', label: TXT('UI.load.back'), x: 960 - 150, y: B.y + B.h + 6, w: 300, h: 60 }],
        yes: [{ id: 'yes', label: TXT('UI.load.yes'), x: ask.x + 50, y: ask.y + 146, w: 180, h: 64 }, { id: 'no', label: TXT('UI.load.no'), x: ask.x + ask.w - 230, y: ask.y + 146, w: 180, h: 64 }] }; },
    // debug panel (` in play): open every secret of the floor (pressed again, seal the ones it opened); show every item of loot
    debug: (R, S) => [{ id: 'dbg_secrets', label: R.dbgOpen ? TXT('UI.debug.dbg_secrets.label') : TXT('UI.debug.dbg_secrets.label.2'), on: true, x: 520, y: 16, w: 430, h: 60 },
      { id: 'dbg_loot', label: S && S.dbgLoot ? TXT('UI.debug.dbg_loot.label') : TXT('UI.debug.dbg_loot.label.2'), on: true, x: 970, y: 16, w: 430, h: 60 }],
    // past the campaign's last boss (TASKS 1150) the run is no longer given up but ended, won
    // the run's end sits apart under a rule, smaller than the rest, and asks first (TASKS 1853)
    // a test run (TASKS 1916) is not given up but ended: the same button and question, in its own words
    pause: (zoom, done, test) => [['resume', TXT('UI.pause')], ['settings', TXT('UI.pause.settings')], ['save', TXT('UI.pause.3')]]
      .map(([id, label], i) => ({ id, label, on: true, x: 720, y: 404 + i * 88, w: 480, h: 72 }))
      .concat([done ? { id: 'finish', label: TXT('UI.pause.5') } : { id: 'abandon', label: test ? TXT('UI.pause.test') : TXT('UI.pause.4') }].map((b) => Object.assign(b, { on: true, x: 780, y: 714, w: 360, h: 56, size: 22 }))),
    // a new run over five taken slots (TASKS 1785): the question in the middle of the menu, «Нет» on the right as in the pause's
    // the update's window over the menu (TASKS 1870): its lines by the state, the download's bar, one or two buttons under them
    upd: (u) => { const st = !u || u.st === 'idle' ? 'check' : u.st, v = (u && u.v) || '', A = { w: 760 }, rows = [], LW = 46, NW = 56; let y = 146, bar = null, ids;
      const line = (s, k = 'line') => { for (const q of wrapLine(s, k === 'line' ? LW : NW)) { rows.push({ s: q, k, y }); y += k === 'line' ? 36 : 30; } };
      const notes = () => { const N = (u.notes || []).slice(0, 5); if (!N.length) return; y += 8; line(TXT('hud.upd.news'), 'head');
        for (const n of N) { const w = wrapLine(n, NW - 8); const two = w.length > 2 ? [w[0], w[1] + '…'] : w; two.forEach((q, i) => { rows.push({ s: q, k: 'note', first: !i, y }); y += 30; }); } };
      if (st === 'check') { line(TXT('hud.upd.check')); ids = ['close']; }
      else if (st === 'none') { line(TXT('hud.upd.none', { v })); ids = ['close']; }
      else if (st === 'avail') { line(TXT('hud.upd.avail', { v })); notes(); ids = ['get', 'later']; }
      else if (st === 'web') { line(TXT('hud.upd.avail', { v })); notes(); y += 16; line(TXT('hud.upd.web.2')); ids = ['open', 'close']; }
      else if (st === 'down') { line(TXT('hud.upd.down', { v })); bar = { y: y + 4, h: 24, pct: Math.max(0, Math.min(100, u.pct || 0)) }; y += 60; line(TXT('hud.upd.down.2'), 'dim'); ids = ['hide']; }
      else if (st === 'ready') { line(TXT('hud.upd.ready', { v })); line(TXT('hud.upd.ready.2'), 'dim'); ids = ['run', 'later']; }
      else { line(u.err === 'down' ? TXT('hud.upd.err.down') : TXT('hud.upd.err')); line(u.err === 'net' ? TXT('hud.upd.err.net') : u.err === 'down' ? TXT('hud.upd.err.cut') : TXT('hud.upd.err.other'), 'dim'); ids = ['retry', 'close']; }
      A.h = y + 24 + 64 + 44; A.x = 960 - A.w / 2; A.y = Math.max(316, Math.round((540 - A.h / 2) / 2) * 2);
      const BW = 330, gap = 30, x0 = 960 - (ids.length * BW + (ids.length - 1) * gap) / 2;
      const LABEL = { get: () => TXT('UI.upd.get'), later: () => TXT('UI.upd.later'), hide: () => TXT('UI.upd.hide'), run: () => TXT('UI.upd.run'), retry: () => TXT('UI.upd.retry'), close: () => TXT('UI.upd.close'), open: () => TXT('UI.upd.open') };
      return { A, st, rows: rows.map((r) => Object.assign(r, { y: A.y + r.y })), bar: bar && Object.assign(bar, { x: A.x + 110, w: A.w - 260, y: A.y + bar.y }),
        r: ids.map((id, i) => ({ id, label: LABEL[id](), on: true, size: 24, x: x0 + i * (BW + gap), y: A.y + A.h - 108, w: BW, h: 64 })) }; },
    newAsk: () => { const A = { x: 680, y: 390, w: 560, h: 380 };
      return { A, r: [{ id: 'yes', label: TXT('UI.menu.ask.yes'), on: true, x: A.x + 50, y: A.y + A.h - 96, w: 220, h: 64 }, { id: 'no', label: TXT('UI.load.no'), on: true, x: A.x + A.w - 270, y: A.y + A.h - 96, w: 220, h: 64 }] }; },
    pauseAsk: (done, test) => { const A = { x: 680, y: 480, w: 560, h: 300 };
      return { A, r: [{ id: 'yes', label: done || test ? TXT('UI.pause.ask.yesDone') : TXT('UI.pause.ask.yes'), on: true, x: A.x + 50, y: A.y + A.h - 96, w: 220, h: 64 }, { id: 'no', label: TXT('UI.load.no'), on: true, x: A.x + A.w - 270, y: A.y + A.h - 96, w: 220, h: 64 }] }; },
    // a run through the town (R-17, TASKS 1006) goes back there with a new hero, and the button says so (TASKS 1812)
    end: (hasLog, town) => [['menu', TXT('UI.end'), true], ['again', town ? TXT('UI.end.2') : TXT('UI.end.3'), true], ['log', TXT('UI.end.4'), !!hasLog]].map(([id, label, on], i) => ({ id, label, on, x: 410 + i * 380, y: 920, w: 340, h: 72 })),
    // the discoveries tab (TASKS 394): two columns of rows under the same tab button
    unlocks: () => D.UNLOCKS.map((U, i) => ({ id: 'un:' + i, un: i, on: true, x: 200 + (i % 2) * 770, y: 276 + Math.floor(i / 2) * 76, w: 750, h: 72 })),
    meta: (cls, tab) => { const back = { id: 'back', label: TXT('UI.meta.back.label'), on: true, x: 810, y: 890, w: 300, h: 70 }, cx = { id: 'codex', label: TXT('UI.codex.open'), on: true, x: 180, y: 120, w: 260, h: 60 }, tb = [['up', TXT('UI.meta.tab.up')], ['open', TXT('UI.meta.tab.open')]].map(([t, label], i) => ({ id: 'tab:' + t, tab: t, label, on: true, x: 1300 + i * 222, y: 124, w: 212, h: 56 })); if (tab === 'open') return UI.unlocks().concat([back, ...tb, cx]); const list = D.metaFor(cls), rows = Math.ceil(list.length / 2), step = Math.min(112, Math.floor(572 / rows));
      return list.map((m, i) => ({ id: m.id, x: 180 + Math.floor(i / rows) * 800, y: 276 + (i % rows) * step, w: 760, h: step - 4 })).concat([back, ...tb, cx]); },
    fork: () => [0, 1].map((i) => ({ id: 'fork:' + i, i, on: true, x: 460 + i * 520, y: 340, w: 480, h: 390 })),
    // the codex (TASKS 395): its pages' entries in three columns, tabs over them, the pager and the way back under them
    codex: (tab, page) => { const list = D.codexList(tab), pages = Math.max(1, Math.ceil(list.length / D.CODEX_PAGE)), p = Math.min(page || 0, pages - 1);
      const pg = list.slice(p * D.CODEX_PAGE, (p + 1) * D.CODEX_PAGE), rows = Math.max(1, Math.ceil(pg.length / 3)), step = Math.min(64, Math.floor(600 / rows));
      // a page's entries spread evenly over its three columns, the rows as tall as the page lets them (TASKS 1764)
      return { list, pages, page: p, r: pg.map((q, i) => ({ id: 'cx:' + q.k, q, x: 120 + Math.floor(i / rows) * 580, y: 274 + (i % rows) * step, w: 560, h: step - 6 }))
        .concat(D.CODEX_TABS.map((t, i) => ({ id: 'tab:' + t, tab: t, label: { m: TXT('UI.codex.m'), it: TXT('UI.codex.it'), p: TXT('UI.codex.p') }[t], on: true, x: 590 + i * 250, y: 190, w: 240, h: 60 })))
        .concat([{ id: 'back', label: TXT('UI.codex.back'), on: true, x: 810, y: 890, w: 300, h: 70 }])
        .concat(pages > 1 ? [{ id: 'prev', label: TXT('UI.codex.prev'), on: p > 0, x: 660, y: 890, w: 130, h: 70 }, { id: 'next', label: TXT('UI.codex.next'), on: p < pages - 1, x: 1130, y: 890, w: 130, h: 70 }] : []) }; },
    // a town workshop (TASKS 1013): the worn gear in a row and the bag under it on the left, the chosen piece, its affixes, the price
    // and the work's button on the right
    craft: (len, tab) => { const P = { x: 190, y: 110, w: 1540, h: 860 }, r = [];
      SLOTS.forEach((sl, i) => r.push({ id: 'eq:' + sl, slot: sl, x: P.x + 60 + i * STEP, y: P.y + 170, w: CELL, h: CELL }));
      r.push(...bagGrid(P.x + 60, P.y + 340, 'bag', undefined, len, tab), ...tabRow(P.x + 60, P.y + 282, len, 172, 46));
      r.push({ id: 'do', on: true, label: '', x: P.x + 860, y: P.y + P.h - 170, w: 620, h: 72 }, { id: 'close', x: P.x + P.w - 92, y: P.y + 34, w: 52, h: 52 }, { id: 'talk', on: true, label: TXT('UI.craft.talk'), x: P.x + 60, y: P.y + 690, w: 620, h: 64 });
      return { P, r }; },
    // a word with a townsman (TASKS 1016, 1023): a panel over the bottom of the screen, his likeness on the left, his words, a button
    // a quest's page (TASKS 1018) puts its take or turn-in button left of it; a master's talk keeps a way into his workshop; «Поговорить»
    // is on every page of a talk that carries topics, outside them: the row narrows to fit them all right of the likeness (PR 49 review)
    talk: (T) => { const P = { x: 330, y: 540, w: 1260, h: 430 }, last = T && T.p + 1 >= T.pages.length, ids = ['next'];
      if (T && T.act && last) ids.push('act'); if (T && T.craft && !T.menu && !T.inTopic) ids.push('craft'); if (T && T.topics && !T.menu && !T.inTopic) ids.push('talk');
      const gap = 20, w = Math.min(290, Math.floor((P.w - 340 - gap * (ids.length - 1)) / ids.length)), label = { craft: TXT('UI.talk.label'), talk: TXT('UI.talk.talk') };
      const r = ids.map((id, i) => ({ id, label: label[id] || '', on: true, x: P.x + P.w - 40 - w - i * (w + gap), y: P.y + P.h - 92, w, h: 64 }));
      if (T && T.menu) T.topics.forEach((q, i) => r.push({ id: 'topic:' + i, i, label: q.q, on: true, x: P.x + 300, y: P.y + 118 + i * 54, w: 610, h: 48 })); return { P, r }; },
    // the quest journal (TASKS 1023): the run's quests in a column on the left, the chosen one's words on the right
    // the notice board on the square (TASKS 1033): every quest on offer now, a row each with its button to take it
    // six rows, one per giver, leave the bottom to the close button
    board: (n) => { const P = { x: 130, y: 60, w: 1660, h: 900 }, r = [];
      for (let i = 0; i < Math.min(n, 6); i++) r.push({ id: 'take:' + i, i, x: P.x + P.w - 250, y: P.y + 136 + i * 104 + 22, w: 200, h: 52 });
      r.push(paperClose(P)); return { P, r }; },
    // past ten quests the list scrolls (TASKS 1884): nine rows from top, the tenth slot says how many more lie above and below
    journal: (n, canDrop, top = 0) => { const P = { x: 330, y: 80, w: 1260, h: 880 }, r = [], many = n > 10, rows = many ? 9 : Math.min(n, 10), t = many ? Math.max(0, Math.min(n - 9, top | 0)) : 0;
      for (let k = 0; k < rows; k++) r.push({ id: 'q:' + (t + k), i: t + k, x: P.x + 30, y: P.y + 110 + k * 68, w: 470, h: 60 });
      if (canDrop) r.push({ id: 'drop', on: true, label: '', x: P.x + P.w - 440, y: P.y + P.h - 116, w: 400, h: 58 });
      r.push({ id: 'notes', on: true, label: '', x: P.x + P.w - 290, y: P.y + 16, w: 230, h: 48 }, paperClose(P));
      return { P, r, top: t, rows, more: many ? { above: t, below: n - t - rows, x: P.x + 30, y: P.y + 110 + 9 * 68, w: 470, h: 60 } : null }; },
    // the first row shown: the one asked, moved just enough to keep the chosen quest (index si) in sight
    journalTop: (n, si, top = 0) => (n <= 10 ? 0 : Math.max(0, Math.min(n - 9, Math.max(si - 8, Math.min(si, top | 0))))),
    notes: (n, page) => { const P = { x: 330, y: 80, w: 1260, h: 880 }, r = [], per = 12, on = Math.min(per, Math.max(0, n - page * per));
      for (let i = 0; i < on; i++) r.push({ id: 'n:' + i, i: page * per + i, x: P.x + 30, y: P.y + 110 + i * 52, w: 470, h: 46 });
      r.push({ id: 'prev', on: page > 0, label: '', x: P.x + 30, y: P.y + P.h - 130, w: 150, h: 52 }, { id: 'next', on: (page + 1) * per < n, label: '', x: P.x + 350, y: P.y + P.h - 130, w: 150, h: 52 });
      r.push(paperClose(P)); return { P, r, per }; },
    // the town's storage chest (TASKS 1012): its cells across the top, the hero's bag under them
    stash: (len, tab) => { const P = { x: 420, y: 90, w: 1080, h: 900 }, x0 = P.x + 80, sx = P.x + P.w - 300;
      const r = grid('stash', STASH.cells, x0, P.y + 190).concat(bagGrid(x0, P.y + 560, 'bag', undefined, len, tab), tabRow(x0, P.y + 504, len, 190));
      r.push({ id: 'close', x: P.x + P.w - 92, y: P.y + 34, w: 52, h: 52 }, ...sortCol('sortS', sx, P.y + 190), ...sortCol('sort', sx, P.y + 560));
      return { P, r }; },
    // the town's ring of stones (TASKS 1009): one row per way out, the open portal first, then the waystones by floor
    // the town's gate out (TASKS 1149): its question and two buttons, the way out on the left
    leave: () => { const P = { x: 610, y: 330, w: 700, h: 330 };
      return { P, r: [{ id: 'go', label: '', on: true, x: P.x + 40, y: P.y + P.h - 100, w: 300, h: 64 }, { id: 'stay', label: TXT('UI.leave.stay'), on: true, x: P.x + P.w - 340, y: P.y + P.h - 100, w: 300, h: 64 }] }; },
    gate: (n) => { const P = { x: 560, y: 190, w: 800, h: 200 + Math.max(1, n) * 84 + 90 };
      return { P, r: Array.from({ length: n }, (_, i) => ({ id: 'go:' + i, i, x: P.x + 40, y: P.y + 150 + i * 84, w: P.w - 80, h: 72 }))
        .concat([{ id: 'leave', label: TXT('UI.gate.r.leave.label'), on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 96, w: 300, h: 60 }]) }; },
    // a dungeon altar: its three gifts side by side, cheapest first; with a fourth the page widens, as its words cannot shrink
    // under the font's 20 px floor (TASKS 1861)
    altar: (n = 3) => { const P = n > 3 ? { x: 160, y: 150, w: 1600, h: 780 } : { x: 360, y: 150, w: 1200, h: 780 }, step = 380, cw = 360;
      return { P, r: Array.from({ length: n }, (_, i) => ({ id: 'gift:' + i, i, x: P.x + 40 + i * step, y: P.y + 150, w: cw, h: 410 }))
        .concat([{ id: 'leave', label: TXT('UI.altar.r.leave.label'), on: true, x: P.x + P.w / 2 + 20, y: P.y + P.h - 86, w: 300, h: 60 },
          { id: 'reroll', label: '', on: true, x: P.x + P.w / 2 - 360, y: P.y + P.h - 86, w: 340, h: 60 },
          { id: 'donate', label: TXT('UI.altar.r.donate.label'), on: true, x: P.x + 120, y: P.y + 578, w: 560, h: 64 }]) }; },
    // the hero screen (TASKS 1332), look B as on ref_ui_inv_b: the gear round the portrait and the stats on a leather panel on the
    // left, the bag and the skills on a parchment sheet on the right
    inv: (abs = ABILITIES, len, tab) => {
      const { L: Lp, R: Rp } = INV, r = [], lx = Lp.x + 50, rx = Lp.x + Lp.w - 50 - CELL;
      const eq = [['helm', lx, 0], ['armor', lx, 1], ['gloves', lx, 2], ['boots', lx, 3], ['amulet', rx, 0], ['weapon', rx, 1], ['offhand', rx, 2], ['ring', rx, 3]];
      for (const [s, x, row] of eq) r.push({ id: 'eq:' + s, slot: s, x, y: Lp.y + 108 + row * 86, w: CELL, h: CELL });
      r.push(...bagGrid(Rp.x + 76, Rp.y + 130, 'bag', undefined, len, tab), ...tabRow(Rp.x + 76, Rp.y + 76, len));
      STATS.forEach((s, i) => r.push({ id: 'stat:' + s.k, k: s.k, x: Lp.x + Lp.w - 100, y: Lp.y + 476 + i * 52, w: 44, h: 44 }));
      // a visit's points taken back (TASKS 1857): each button after its points' count, the stats' on their heading's line, as it
      // hung loose between two rows (TASKS 1887 з)
      r.push({ id: 'reset:st', label: TXT('UI.inv.reset'), on: true, x: Lp.x + 330, y: Lp.y + 447, w: 150, h: 36 }, { id: 'reset:ab', label: TXT('UI.inv.reset'), on: true, x: Rp.x + 360, y: Rp.y + 414, w: 190, h: 48 });
      abs.forEach((a, i) => r.push({ id: 'ab:' + a.id, ab: a.id, x: Rp.x + 76 + i * 324, y: Rp.y + 470, w: 300, h: 280 }));
      r.push({ id: 'close', x: Rp.x + Rp.w - 92, y: Rp.y + 34, w: 52, h: 52 }, ...sortCol('sort', Rp.x + 76 + COLS * STEP + 40, Rp.y + 130));
      return { P: { x: Lp.x, y: Lp.y, w: Rp.x + Rp.w - Lp.x, h: Lp.h }, L: Lp, R: Rp, r };
    },
    // an ability card's lines in a card h tall (TASKS 2001): the cost at the foot, the fork line over it, the rank's text in its n
    // wrapped lines (split: its head on a line of its own) raised with its rule before it would reach the fork line, which drops
    // under the text only when the text cannot rise further
    abCard: (h, n, split, fork) => { const LH = 27, cost = h - 34, span = n <= 1 ? 0 : (split ? 30 : LH) + LH * (n - 2);
      const y0 = Math.max(116, Math.min(146, (fork ? h - 66 : cost) - LH - span)), f = fork ? Math.min(cost - 22, Math.max(h - 66, y0 + span + LH)) : null;
      return { rule: y0 - 24, y0, d1: y0 + 30, last: y0 + span, fork: f, cost }; },
    // the merchant's screen: his shelf (gear, then consumables) and the buy-back row on the left, the hero's bag on the
    // right; every slot has its price line under it
    shop: (nGoods, len, tab) => {
      const P = { x: 190, y: 40, w: 1540, h: 980 }, r = [];
      for (let i = 0; i < nGoods; i++) r.push({ id: 'buy:' + i, i, x: P.x + 60 + (i % 4) * 116, y: P.y + 150 + Math.floor(i / 4) * 118, w: CELL, h: CELL });
      for (let i = 0; i < SHOP.buyback; i++) r.push({ id: 'back:' + i, i, x: P.x + 60 + i * 116, y: P.y + 540, w: CELL, h: CELL });
      r.push(...bagGrid(P.x + 700, P.y + 194, 'sell', 118, len, tab), ...tabRow(P.x + 700, P.y + 140, len, 196, 46));
      r.push({ id: 'talk', on: true, label: TXT('UI.talk.talk'), x: P.x + 250, y: P.y + P.h - 150, w: 260, h: 56 });
      r.push({ id: 'close', x: P.x + P.w - 92, y: P.y + 34, w: 52, h: 52 });
      // the item's card has its own pane under the bag, the merchant and his button moved under his shelf, so the card covers
      // neither the bag's prices nor the button (TASKS 1761)
      const by = Math.max(...r.filter((q) => q.id.startsWith('sell:')).map((q) => q.y + q.h)) + 40, card = { x: P.x + 700, y: by, w: P.w - 740, h: P.y + P.h - 20 - by, bot: 1036 };
      return { P, r, card };
    },
    // a legendary's sale asks first (TASKS 1978): a sheet in the middle of the shop, clear of the merchant's button, «Оставить» on the right
    sellAsk: () => { const A = { x: 660, y: 320, w: 600, h: 380 }, cell = { id: 'sellAsk_it', x: A.x + A.w / 2 - CELL / 2, y: A.y + 56, w: CELL, h: CELL };
      return { A, cell, q: { x: A.x + 40, y: A.y + 150, w: A.w - 80, h: 90 }, r: [{ id: 'sellYes', label: TXT('UI.shop.sellYes'), on: true, x: A.x + 50, y: A.y + A.h - 100, w: 230, h: 64 },
        { id: 'sellNo', label: TXT('UI.shop.sellNo'), on: true, x: A.x + A.w - 280, y: A.y + A.h - 100, w: 230, h: 64 }] }; },
    // how many of a stack (TASKS 1988): the count between − and +, the answer under them, «Отмена» on the right
    split: () => { const A = { x: 710, y: 340, w: 500, h: 340 };
      return { A, cell: { id: 'split_it', x: A.x + A.w / 2 - CELL / 2, y: A.y + 40, w: CELL, h: CELL }, num: { x: A.x + A.w / 2 - 80, y: A.y + 136, w: 160, h: 64 },
        r: [{ id: 'spOk', label: '', on: true, x: A.x + 40, y: A.y + A.h - 96, w: 200, h: 60 }, { id: 'spNo', label: TXT('UI.split.no'), on: true, x: A.x + A.w - 240, y: A.y + A.h - 96, w: 200, h: 60 },
          { id: 'spMinus', label: '\u2212', on: true, x: A.x + A.w / 2 - 150, y: A.y + 140, w: 56, h: 56 }, { id: 'spPlus', label: '+', on: true, x: A.x + A.w / 2 + 94, y: A.y + 140, w: 56, h: 56 }] }; },
  };

  // a start path's step's buttons on its screen (bot.cjs, the checks): the menu and the tests list as on a fresh start
  const uiAt = (scr, meta) => (scr === 'menu' ? UI.menu(false) : scr === 'tests' ? UI.tests(false) : UI.classes(meta));
  Object.assign(D, { updShown, updMark, relNotes, verNewer, VIEW_H, uiDy, feedOf, bagTabs, bagTabOf, SAVE_SLOTS, dateOf, SETTINGS, TEST_RUNS, uiAt, startPath, campaignLen, newsRows, UI });
})(typeof window !== 'undefined' ? window : globalThis);
