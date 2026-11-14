// live/ui_menu.js — the main menu, the start screens, the settings, the statistics, the saved games, the pause and the end of a run, in view px.
// One of the UI layout files (ARCHITECTURE.md §4.7): it registers its screens with UI.add; ui_kit.js holds the registry and the shared helpers.
(function (root) {
  const D = root.DATA || (root.DATA = {}), { UI } = D;
  const { DIFF, zoomName } = D;
  // the town (R-17, TASKS 1002): the campaign through the town, a test run until the town is done and the campaign starts there
  const TEST_RUNS = [['cave', TXT('TEST_RUNS'), TXT('TEST_RUNS.2')], ['magma', TXT('TEST_RUNS.3'), TXT('TEST_RUNS.4')], ['endless', TXT('TEST_RUNS.5'), TXT('TEST_RUNS.6')]];
  // the buttons that start a run from the main menu, in the order pressed (bots and checks press these): a test run's screen opens
  // by ` on the menu (TASKS 1878), the step ['menu', 'tests'] stands for that key
  const campaignLen = () => { const n = D.RUNS.campaign.floors; return { n, floors: TXT.n('UI.menu.floors', n) }; };
  // the buttons a new run of this mode is started by, screen by screen; the start screen with the difficulty and the class comes last (TASKS 1304)
  const startPath = (mode) => (mode === 'campaign' || mode === 'town' ? [['menu', 'campaign']] : [['menu', 'tests'], ['tests', mode]]).concat([['classes', 'go']]);
  const MENU_SHEET = { x: 48, w: 620, bottom0: 1012, top: 92, row: 56, sub: 26, gap: 34, bottom: 78, inX: 56 };
  const MENU_ITEMS = [['continue', 'campaign', 'load'], ['stats', 'settings'], ['update', 'quit']];
  const MENU_LABEL = { update: (u) => (u && u.web ? TXT('UI.menu.update.web', { v: u.v }) : TXT('UI.menu.update')), continue: () => TXT('UI.menu'), load: () => TXT('UI.menu.load'), stats: () => TXT('UI.menu.stats'), settings: () => TXT('UI.menu.settings'), quit: () => TXT('UI.menu.quit') };
  // the update's item (TASKS 1870) and its small mark under the label: a version found, its download, the restart it waits for
  const updShown = (u) => !!u && (!!u.can || (!!u.web && u.st === 'web'));
  const updMark = (u) => (!u || u.web ? '' : u.st === 'avail' ? TXT('hud.menu.upd.avail', { v: u.v }) : u.st === 'down' ? TXT('hud.menu.upd.down', { pct: Math.floor(u.pct || 0) }) : u.st === 'ready' ? TXT('hud.menu.upd.ready') : '');
  // the settings screen's rows, in order (TASKS 1302): each a slider over its stops, its value kept in S.meta[key]
  const SETTINGS_BOOK = { x: 380, w: 1160, top: 236, row: 100, foot: 160 };
  // the brightness (TASKS 1303): a gamma on the frame's final grade, the HUD drawn after it untouched
  const VOLS = [0, 0.25, 0.5, 0.75, 1], BRIGHTS = [0.7, 0.85, 1, 1.2, 1.4], stepName = (v) => { const i = BRIGHTS.indexOf(v) - 2; return i > 0 ? '+' + i : i < 0 ? '\u2212' + -i : '0'; };
  const SETTINGS = [{ id: 'zoom', key: 'zoom', name: () => TXT('UI.settings.zoom'), stops: D.ZOOMS, def: D.ZOOM, fmt: zoomName },
    { id: 'bright', key: 'bright', name: () => TXT('UI.settings.bright'), stops: BRIGHTS, def: 1, fmt: stepName, ends: () => [TXT('UI.settings.bright.lo'), TXT('UI.settings.bright.hi')] },
    { id: 'vol', key: 'vol', name: () => TXT('UI.settings.vol'), stops: VOLS, def: 1, fmt: (v) => Math.round(v * 100) + ' %', ends: () => [TXT('UI.settings.vol.lo'), TXT('UI.settings.vol.hi')] },
    // the graphics (TASKS 1372): 2 the full picture, 1 and 0 drop the costliest passes for the Steam Deck and weak PCs (scene reads S.meta.gfx)
    { id: 'gfx', key: 'gfx', name: () => TXT('UI.settings.gfx'), stops: [0, 1, 2], def: 2, fmt: (v) => (v === 0 ? TXT('UI.settings.gfx.0') : v === 1 ? TXT('UI.settings.gfx.1') : TXT('UI.settings.gfx.2')), ends: () => [TXT('UI.settings.gfx.lo'), TXT('UI.settings.gfx.hi')] },
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
  UI.add('menu', {
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
    // the test runs (TASKS 417, 1878): a screen of their own behind ` on the main menu, in the campaign's order (the caves, then the
    // magma caves, then the endless descent past them), «Назад» last
    tests: (hasRun, full = hasRun) => TEST_RUNS.map(([id, fresh, again], i) => ({ id, label: !full ? fresh : again, on: true, x: 720, y: 440 + i * 86, w: 480, h: 72 }))
      .concat([{ id: 'back', label: TXT('UI.tests.back.label'), on: true, x: 810, y: 440 + TEST_RUNS.length * 86 + 40, w: 300, h: 70 }]),
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
    newAsk: () => { const A = { x: 680, y: 390, w: 560, h: 380 };
      return { A, r: [{ id: 'yes', label: TXT('UI.menu.ask.yes'), on: true, x: A.x + 50, y: A.y + A.h - 96, w: 220, h: 64 }, { id: 'no', label: TXT('UI.load.no'), on: true, x: A.x + A.w - 270, y: A.y + A.h - 96, w: 220, h: 64 }] }; },
    pauseAsk: (done, test) => { const A = { x: 680, y: 480, w: 560, h: 300 };
      return { A, r: [{ id: 'yes', label: done || test ? TXT('UI.pause.ask.yesDone') : TXT('UI.pause.ask.yes'), on: true, x: A.x + 50, y: A.y + A.h - 96, w: 220, h: 64 }, { id: 'no', label: TXT('UI.load.no'), on: true, x: A.x + A.w - 270, y: A.y + A.h - 96, w: 220, h: 64 }] }; },
    // a run through the town (R-17, TASKS 1006) goes back there with a new hero, and the button says so (TASKS 1812)
    end: (hasLog, town) => [['menu', TXT('UI.end'), true], ['again', town ? TXT('UI.end.2') : TXT('UI.end.3'), true], ['log', TXT('UI.end.4'), !!hasLog]].map(([id, label, on], i) => ({ id, label, on, x: 410 + i * 380, y: 920, w: 340, h: 72 })),
  });

  // a start path's step's buttons on its screen (bot.cjs, the checks): the menu and the tests list as on a fresh start
  const uiAt = (scr, meta) => (scr === 'menu' ? UI.menu(false) : scr === 'tests' ? UI.tests(false) : UI.classes(meta));
  UI.share('menu', { updShown, updMark, SAVE_SLOTS, dateOf, SETTINGS, TEST_RUNS, uiAt, startPath, campaignLen });
})(typeof window !== 'undefined' ? window : globalThis);
