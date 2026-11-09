// live/data_ui.js — UI layout in view px: the sim hit-tests these, the HUD draws them.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { ABILITIES, DIFF, META, SHOP, SLOTS, STASH, STATS, zoomName } = D;
  // ---------------- UI layout (view px) — the sim hit-tests these, the HUD draws them ----------------
  // the town (R-17, TASKS 1002): the campaign through the town, a test run until the town is done and the campaign starts there
  const TEST_RUNS = [['cave', TXT('TEST_RUNS'), TXT('TEST_RUNS.2')], ['magma', TXT('TEST_RUNS.3'), TXT('TEST_RUNS.4')], ['endless', TXT('TEST_RUNS.5'), TXT('TEST_RUNS.6')]];
  // the buttons that start a run from the main menu, in the order pressed: a test run is behind «Тесты» (bots and checks press these)
  const campaignLen = () => { const n = D.RUNS.campaign.floors; return { n, floors: TXT.n('UI.menu.floors', n) }; };
  // the buttons a new run of this mode is started by, screen by screen; with more than one class ready the class screen comes last (TASKS 1103)
  const startPath = (mode) => (mode === 'campaign' || mode === 'town' ? [['menu', 'campaign']] : [['menu', 'tests'], ['tests', mode]]).concat(D.classesReady().length > 1 ? [['classes', 'go']] : []);
  // «Что нового» (TASKS 1038): DATA.CHANGES, newest first, as rows of fixed heights; a point is wrapped by its length (the sim
  // scrolls by whole rows, so it needs the rows without the HUD's text measure; the screen's qa check catches a line too long)
  const NEWS = { P: { x: 300, y: 60, w: 1320, h: 960 }, top: 150, bottom: 120, wrap: 84, h: { ver: 70, group: 46, line: 34, gap: 8 } };
  const wrapLine = (s, n) => { const out = []; let cur = '';
    for (const w of s.split(' ')) { if (cur && cur.length + 1 + w.length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    return cur ? out.concat([cur]) : out; };
  let newsMemo = null;
  const newsRows = () => { if (newsMemo && newsMemo.src === D.CHANGES) return newsMemo.rows; const rows = [];
    for (const e of D.CHANGES || []) { rows.push({ k: 'ver', v: e.v, date: e.date, h: NEWS.h.ver });
      for (const g of e.groups) { rows.push({ k: 'group', s: g.name, h: NEWS.h.group });
        for (const it of g.items) wrapLine(it, NEWS.wrap).forEach((s, i, a) => rows.push({ k: 'line', s, first: !i, h: NEWS.h.line + (i === a.length - 1 ? NEWS.h.gap : 0) })); } }
    newsMemo = { src: D.CHANGES, rows }; return rows; };
  const UI = {
    // arm: the run whose button was pressed once over a saved run (a second press drops the save); «В город» (TASKS 1026, was «Алтарь
    // душ»: the upgrades are bought at the altar on the town's square) goes on with the saved run, or starts a campaign, in the town
    menu: (hasRun, diff, arm, zoom, inTown) => [['continue', TXT('UI.menu'), hasRun], ['campaign', !hasRun ? TXT('UI.menu.2', campaignLen()) : arm === 'campaign' ? TXT('UI.menu.3') : TXT('UI.menu.4'), true],
      ['tests', TXT('UI.menu.5'), true], ['diff', TXT('UI.menu.6', { name: DIFF[diff || 'normal'].name }), true], ['zoom', TXT('UI.menu.7', { p1: zoomName(zoom) }), true], ['town', TXT('UI.menu.8'), !hasRun || !!inTown], ['news', TXT('UI.menu.9'), true]]
      .map(([id, label, on], i) => ({ id, label, on, x: 720, y: 440 + i * 78, w: 480, h: 66 })),
    // the test runs (TASKS 417): a screen of their own behind the main menu's «Тесты», in the campaign's order (the caves, then the
    // magma caves, then the endless descent past them), «Назад» last
    // the class screen (TASKS 1103): a card a ready class, side by side, the start and back buttons under them
    classes: (meta) => { const ids = D.classesReady(), W = 520, gap = 40, x0 = 960 - (ids.length * W + (ids.length - 1) * gap) / 2;
      return ids.filter((id) => D.kitsOf(id, meta).length > 1).map((id) => ({ id: 'kit:' + id, kit: id, on: true, x: x0 + ids.indexOf(id) * (W + gap) + 40, y: 742, w: W - 80, h: 42 }))
        .concat(ids.map((id, i) => ({ id: 'cls:' + id, cls: id, on: true, x: x0 + i * (W + gap), y: 190, w: W, h: 640 })))
        .concat([{ id: 'go', label: TXT('UI.classes.go'), on: true, x: 980, y: 880, w: 380, h: 76 }, { id: 'back', label: TXT('UI.classes.back'), on: true, x: 560, y: 880, w: 380, h: 76 }]); },
    tests: (hasRun, arm) => TEST_RUNS.map(([id, fresh, again], i) => ({ id, label: !hasRun ? fresh : arm === id ? TXT('UI.tests.label') : again, on: true, x: 720, y: 440 + i * 86, w: 480, h: 72 }))
      .concat([{ id: 'back', label: TXT('UI.tests.back.label'), on: true, x: 810, y: 440 + TEST_RUNS.length * 86 + 40, w: 300, h: 70 }]),
    // the rows that fit from row `top`, and the last top that still fills the view (the end of the list sits at its bottom)
    news: (top) => { const P = NEWS.P, rows = newsRows(), vh = P.h - NEWS.top - NEWS.bottom; let max = rows.length, fill = 0;
      while (max > 0 && fill + rows[max - 1].h <= vh) fill += rows[--max].h;
      const t = Math.max(0, Math.min(max, top || 0)), shown = []; let y = P.y + NEWS.top;
      for (let i = t; i < rows.length && y + rows[i].h <= P.y + NEWS.top + vh; i++) { shown.push(Object.assign({ y }, rows[i])); y += rows[i].h; }
      return { P, rows: shown, top: t, max, n: rows.length, view: { x: P.x + 60, y: P.y + NEWS.top, w: P.w - 120, h: vh },
        r: [{ id: 'back', label: TXT('UI.news.back.label'), on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 94, w: 300, h: 66 }] }; },
    // debug panel (` in play): open every secret of the floor (pressed again, seal the ones it opened); show every item of loot
    debug: (R, S) => [{ id: 'dbg_secrets', label: R.dbgOpen ? TXT('UI.debug.dbg_secrets.label') : TXT('UI.debug.dbg_secrets.label.2'), on: true, x: 520, y: 16, w: 430, h: 60 },
      { id: 'dbg_loot', label: S && S.dbgLoot ? TXT('UI.debug.dbg_loot.label') : TXT('UI.debug.dbg_loot.label.2'), on: true, x: 970, y: 16, w: 430, h: 60 }],
    // past the campaign's last boss (TASKS 1150) the run is no longer given up but ended, won
    pause: (zoom, done) => [['resume', TXT('UI.pause')], ['zoom', TXT('UI.pause.2', { p1: zoomName(zoom) })], ['save', TXT('UI.pause.3')], done ? ['finish', TXT('UI.pause.5')] : ['abandon', TXT('UI.pause.4')]]
      .map(([id, label], i) => ({ id, label, on: true, x: 720, y: 430 + i * 92, w: 480, h: 72 })),
    // a run through the town (R-17, TASKS 1006) goes back there: a new hero by the campfire
    end: (hasLog, town) => [['menu', TXT('UI.end'), true], ['again', town ? TXT('UI.end.2') : TXT('UI.end.3'), true], ['log', TXT('UI.end.4'), !!hasLog]].map(([id, label, on], i) => ({ id, label, on, x: 410 + i * 380, y: 920, w: 340, h: 72 })),
    // the discoveries tab (TASKS 394): two columns of rows under the same tab button
    unlocks: () => D.UNLOCKS.map((U, i) => ({ id: 'un:' + i, un: i, on: true, x: 200 + (i % 2) * 770, y: 268 + Math.floor(i / 2) * 76, w: 750, h: 68 })),
    meta: (cls, tab) => { const back = { id: 'back', label: TXT('UI.meta.back.label'), on: true, x: 810, y: 890, w: 300, h: 70 }, cx = { id: 'codex', label: TXT('UI.codex.open'), on: true, x: 180, y: 120, w: 260, h: 60 }, tb = { id: 'tab', label: tab === 'open' ? TXT('UI.meta.tab.up') : TXT('UI.meta.tab.open'), on: true, x: 1480, y: 120, w: 260, h: 60 }; if (tab === 'open') return UI.unlocks().concat([back, tb, cx]); const list = D.metaFor(cls), rows = Math.ceil(list.length / 2), step = Math.min(112, Math.floor(588 / rows));
      return list.map((m, i) => ({ id: m.id, x: 180 + Math.floor(i / rows) * 800, y: 266 + (i % rows) * step, w: 760, h: step - 10 })).concat([back, tb, cx]); },
    // the codex (TASKS 395): its pages' entries in three columns, tabs over them, the pager and the way back under them
    codex: (tab, page) => { const list = D.codexList(tab), pages = Math.max(1, Math.ceil(list.length / D.CODEX_PAGE)), p = Math.min(page || 0, pages - 1);
      return { list, pages, page: p, r: list.slice(p * D.CODEX_PAGE, (p + 1) * D.CODEX_PAGE).map((q, i) => ({ id: 'cx:' + q.k, q, x: 120 + Math.floor(i / 12) * 580, y: 268 + (i % 12) * 48, w: 560, h: 44 }))
        .concat(D.CODEX_TABS.map((t, i) => ({ id: 'tab:' + t, tab: t, label: { m: TXT('UI.codex.m'), it: TXT('UI.codex.it'), p: TXT('UI.codex.p') }[t], on: true, x: 590 + i * 250, y: 190, w: 240, h: 60 })))
        .concat([{ id: 'back', label: TXT('UI.codex.back'), on: true, x: 810, y: 890, w: 300, h: 70 }])
        .concat(pages > 1 ? [{ id: 'prev', label: TXT('UI.codex.prev'), on: p > 0, x: 660, y: 890, w: 130, h: 70 }, { id: 'next', label: TXT('UI.codex.next'), on: p < pages - 1, x: 1130, y: 890, w: 130, h: 70 }] : []) }; },
    // a town workshop (TASKS 1013): the worn gear in a row and the bag under it on the left, the chosen piece, its affixes, the price
    // and the work's button on the right
    craft: () => { const P = { x: 190, y: 110, w: 1540, h: 860 }, r = [];
      SLOTS.forEach((sl, i) => r.push({ id: 'eq:' + sl, slot: sl, x: P.x + 40 + i * 96, y: P.y + 150, w: 84, h: 84 }));
      for (let i = 0; i < 24; i++) r.push({ id: 'bag:' + i, i, x: P.x + 40 + (i % 8) * 96, y: P.y + 316 + Math.floor(i / 8) * 96, w: 84, h: 84 });
      r.push({ id: 'do', on: true, label: '', x: P.x + 860, y: P.y + P.h - 170, w: 620, h: 72 }, { id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 }, { id: 'talk', on: true, label: TXT('UI.craft.talk'), x: P.x + 40, y: P.y + 720, w: 620, h: 64 });
      return { P, r }; },
    // a word with a townsman (TASKS 1016, 1023): a panel over the bottom of the screen, his likeness on the left, his words, a button
    // a quest's page (TASKS 1018) puts its take or turn-in button left of it; the smith's talk keeps a way into his workshop
    talk: (T) => { const P = { x: 330, y: 640, w: 1260, h: 330 }, at = (i) => ({ x: P.x + P.w - 330 - i * 310, y: P.y + P.h - 92, w: 290, h: 64 }), last = T && T.p + 1 >= T.pages.length, r = [{ id: 'next', label: '', on: true, ...at(0) }];
      if (T && T.act && last) r.push({ id: 'act', label: '', on: true, ...at(1) }); if (T && T.craft) r.push({ id: 'craft', label: TXT('UI.talk.label'), on: true, ...at(r.length) }); return { P, r }; },
    // the quest journal (TASKS 1023): the run's quests in a column on the left, the chosen one's words on the right
    // the notice board on the square (TASKS 1033): every quest on offer now, a row each with its button to take it
    board: (n) => { const P = { x: 400, y: 90, w: 1120, h: 900 }, r = [];
      for (let i = 0; i < Math.min(n, 7); i++) r.push({ id: 'take:' + i, i, x: P.x + P.w - 250, y: P.y + 136 + i * 104 + 22, w: 200, h: 52 });
      r.push({ id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 }); return { P, r }; },
    journal: (n, canDrop) => { const P = { x: 330, y: 120, w: 1260, h: 840 }, r = [];
      for (let i = 0; i < Math.min(n, 10); i++) r.push({ id: 'q:' + i, i, x: P.x + 30, y: P.y + 110 + i * 68, w: 470, h: 60 });
      if (canDrop) r.push({ id: 'drop', on: true, label: '', x: P.x + P.w - 440, y: P.y + P.h - 116, w: 400, h: 58 });
      r.push({ id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 }); return { P, r }; },
    // the town's storage chest (TASKS 1012): its cells across the top, the hero's bag under them
    stash: () => { const P = { x: 420, y: 90, w: 1080, h: 900 }, r = [];
      for (let i = 0; i < STASH.cells; i++) r.push({ id: 'stash:' + i, i, x: P.x + 88 + (i % 8) * 116, y: P.y + 130 + Math.floor(i / 8) * 104, w: 92, h: 92 });
      for (let i = 0; i < 24; i++) r.push({ id: 'bag:' + i, i, x: P.x + 88 + (i % 8) * 116, y: P.y + 500 + Math.floor(i / 8) * 104, w: 92, h: 92 });
      r.push({ id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 });
      return { P, r }; },
    // the town's ring of stones (TASKS 1009): one row per way out, the open portal first, then the waystones by floor
    // the town's gate out (TASKS 1149): its question and two buttons, the way out on the left
    leave: () => { const P = { x: 610, y: 330, w: 700, h: 330 };
      return { P, r: [{ id: 'go', label: '', on: true, x: P.x + 40, y: P.y + P.h - 100, w: 300, h: 64 }, { id: 'stay', label: TXT('UI.leave.stay'), on: true, x: P.x + P.w - 340, y: P.y + P.h - 100, w: 300, h: 64 }] }; },
    gate: (n) => { const P = { x: 610, y: 190, w: 700, h: 200 + Math.max(1, n) * 84 + 90 };
      return { P, r: Array.from({ length: n }, (_, i) => ({ id: 'go:' + i, i, x: P.x + 40, y: P.y + 150 + i * 84, w: P.w - 80, h: 72 }))
        .concat([{ id: 'leave', label: TXT('UI.gate.r.leave.label'), on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 96, w: 300, h: 60 }]) }; },
    // a dungeon altar: its three gifts side by side, cheapest first
    altar: (n = 3) => { const P = { x: 360, y: 150, w: 1200, h: 780 }, step = n > 3 ? 288 : 380, cw = n > 3 ? 264 : 340;
      return { P, r: Array.from({ length: n }, (_, i) => ({ id: 'gift:' + i, i, x: P.x + 40 + i * step, y: P.y + 150, w: cw, h: 390 }))
        .concat([{ id: 'leave', label: TXT('UI.altar.r.leave.label'), on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 86, w: 300, h: 60 },
          { id: 'reroll', label: '', on: true, x: P.x + 40, y: P.y + P.h - 86, w: 340, h: 60 },
          { id: 'donate', label: TXT('UI.altar.r.donate.label'), on: true, x: P.x + 40, y: P.y + 578, w: 560, h: 64 }]) }; },
    // hero screen: equipment column, bag grid, stats and abilities
    inv: (abs = ABILITIES) => {
      const P = { x: 250, y: 170, w: 1420, h: 740 }, r = [];
      const eq = [['helm', 0, 0], ['amulet', 1, 0], ['weapon', 0, 1], ['armor', 1, 1], ['offhand', 2, 1], ['gloves', 0, 2], ['ring', 1, 2], ['boots', 2, 2]];
      for (const [s, cx, cy] of eq) r.push({ id: 'eq:' + s, slot: s, x: P.x + 310 + cx * 96, y: P.y + 110 + cy * 96, w: 84, h: 84 });
      for (let i = 0; i < 24; i++) r.push({ id: 'bag:' + i, i, x: P.x + 640 + (i % 8) * 92, y: P.y + 110 + Math.floor(i / 8) * 92, w: 82, h: 82 });
      STATS.forEach((s, i) => r.push({ id: 'stat:' + s.k, k: s.k, x: P.x + 40 + 196, y: P.y + 452 + i * 52, w: 40, h: 40 }));
      abs.forEach((a, i) => r.push({ id: 'ab:' + a.id, ab: a.id, x: P.x + 640 + i * 258, y: P.y + 470, w: 250, h: 150 }));
      r.push({ id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 });
      return { P, r };
    },
    // the merchant's screen: his shelf (gear, then consumables) and the buy-back row on the left, the hero's bag on the
    // right; every slot has its price line under it
    shop: (nGoods) => {
      const P = { x: 190, y: 110, w: 1540, h: 860 }, r = [];
      for (let i = 0; i < nGoods; i++) r.push({ id: 'buy:' + i, i, x: P.x + 40 + (i % 4) * 116, y: P.y + 130 + Math.floor(i / 4) * 140, w: 92, h: 92 });
      for (let i = 0; i < SHOP.buyback; i++) r.push({ id: 'back:' + i, i, x: P.x + 40 + i * 116, y: P.y + 580, w: 92, h: 92 });
      for (let i = 0; i < 24; i++) r.push({ id: 'sell:' + i, i, x: P.x + 620 + (i % 8) * 108, y: P.y + 130 + Math.floor(i / 8) * 140, w: 92, h: 92 });
      r.push({ id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 });
      return { P, r };
    },
  };

  // a start path's step's buttons on its screen (bot.cjs, the checks): the menu and the tests list as on a fresh start
  const uiAt = (scr) => (scr === 'menu' ? UI.menu(false) : scr === 'tests' ? UI.tests(false) : UI.classes());
  Object.assign(D, { TEST_RUNS, uiAt, startPath, campaignLen, newsRows, UI });
})(typeof window !== 'undefined' ? window : globalThis);
