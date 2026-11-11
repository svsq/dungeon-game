// live/sim_ui.js — the run's end, descending, and the menus and screens (stepUI).
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const {
    BASES, D, DT, FROM, abandonQuest, campaignDone, META, REWARD, RUN, UI, bagAdd, boardOffers, buy, craft, donate, enterFloor, ev, gateGo, gateWays,
    gearName, giveQuest, heroSt, journalOf, newRun, potCount, runReward, sell, stashOf, stashPut, stashTake, takeGift, talkAct,
    sortItems, throwAway, useItem, isCons, tally } = SIMX;
  // ---------------- run end / menus ----------------
  function endRun(S, how) {
    const R = S.run; if (!R) return;
    const W2 = runReward(R, how), bonus = W2.base + W2.bonus;
    S.meta.shards += bonus; S.meta.runs = (S.meta.runs || 0) + 1; if (how === 'win' && !R.campaignWon) S.meta.wins = (S.meta.wins || 0) + 1;
    // what the Keeper of the Fire will speak of to the next hero (TASKS 1016)
    if (how === 'dead' && !(R.log && R.log.abandon)) S.meta.deaths = (S.meta.deaths || 0) + 1; S.meta.lastEnd = R.log && R.log.abandon ? 'abandon' : how; S.meta.endTold = 0; S.meta.lastCls = D.clsOf(R.hero).id;
    // the records are the deepest floor reached, not the one the run ended on (TASKS 516: down to the 17th, back up to the 16th)
    const deep = Math.max(R.deepest || 0, R.floor);
    if (RUN(R) === D.RUNS.campaign) { S.meta.best = Math.max(S.meta.best || 0, deep); tally(S, R, 'best', deep, 1); }
    tally(S, R, 'runs'); tally(S, R, 'shards', bonus); if (how === 'win' && !R.campaignWon) tally(S, R, 'wins'); if (how === 'dead' && !(R.log && R.log.abandon)) tally(S, R, 'deaths');
    // the endless descent's record depth (TASKS 348)
    const deepBest = S.meta.bestEndless || 0; if (RUN(R).endless) S.meta.bestEndless = Math.max(deepBest, deep);
    S.result = { how, mode: R.mode, floor: R.floor, deepest: deep, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, shards: R.shards + bonus, found: R.shards, base: W2.base, statBonus: W2.bonus, cap: W2.cap,
      C: W2.C, win: how === 'win' && !R.campaignWon ? REWARD.win : 0, time: R.play || 0, donations: R.donations || 0,
      damage: (R.recentDamage || []).slice(-3), abandoned: !!(R.log && R.log.abandon), record: RUN(R).endless ? { best: S.meta.bestEndless, fresh: deep > deepBest } : undefined, campaignWon: R.campaignWon ? 1 : 0, town: R.viaTown ? 1 : 0, hero: JSON.parse(JSON.stringify(R.hero)), heroStats: heroSt(S) };
    if (R.log) { R.log.end = { how: R.log.abandon ? 'abandon' : how, time: R.play || 0, floor: R.floor, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, cause: how === 'dead' ? R.log.last || null : null, bag: potCount(R.hero), tail: R.log.tail || [], done: R.stats || {}, pct: W2.C.pct };   // done: per floor kills/foes, loot/lootN, sec/secN
      S.result.log = R.log; S.logN = (S.logN || 0) + 1; }
    S.run = null; S.saved = null; pickLatest(S); S.screen = how; S.saveN++;
  }
  // the run ended alive past the campaign's last boss (TASKS 1148): a win, the campaign's if not won yet at the stairs on
  function finishRun(S) { S.talk = null; S.screen = 'play'; endRun(S, 'win'); }
  // a hero who starts above level 1 opens on the hero screen, his points still to lay out
  // past the serpent, down the stairs (TASKS 354): the campaign is won on the spot — its reward (gold and the win's shards), a win,
  // its record — and the same run goes on as the endless descent from the 13th, the hero as he is; the descent's depth is its record
  function descend(S, R) {
    const W2 = runReward(R, 'win'); S.meta.shards += W2.base; S.meta.wins = (S.meta.wins || 0) + 1; S.meta.best = Math.max(S.meta.best || 0, R.floor);
    tally(S, R, 'wins'); tally(S, R, 'shards', W2.base); tally(S, R, 'best', R.floor, 1);
    R.goldBanked = R.goldTot; R.campaignWon = 1; R.mode = RUN(R).then; S.saveN++;
    ev(S, { k: 'stairs', x: R.hero.x, y: R.hero.y, floor: R.floor }); enterFloor(S, R, R.floor + 1);
    R.msg = { s: TXT('sim_ui.descend.msg.s', { base: W2.base, floor: R.floor, p3: D.floorName(R.floor, R.mode, R.seed, FROM(R)) }), t: S.t, d: 5 }; }
  // the checks of the dungeon's own workings start from the menu as before and play its 1st floor laid out without the town (a
  // merchant on the floor, no stairs up), the run's seed kept (TASKS 1026: the campaign itself now starts in the town)
  const begin = (S) => { const c = UI.menu(!!S.saved).find((b) => b.id === 'campaign'); SIMX.step(S, { keys: [], px: c.x + c.w / 2, py: c.y + c.h / 2, click: 1 }); if (S.screen === 'classes') startRun(S, S.pendingMode); if (S.run && S.run.town) { S.run = newRun(S, 'campaign', S.run.seed); S.screen = 'play'; } };
  // the campaign starts in the town (TASKS 1026); the test runs (the caves, the magma caves, the endless descent) as before
  // the save slots (TASKS 1311): the run in play or named on the menu (S.run, S.saved) belongs to slot S.slot, whose cell in S.saves
  // stays empty meanwhile, so no run is held twice. A save from before the slots comes as the lone run and lands in the first slot
  const slotRun = (S, i) => (i === S.slot && (S.run || S.saved)) || S.saves[i] || null;
  const isFull = (S) => S.saves.every((r, i) => r || (i === S.slot && (S.run || S.saved)));
  function loadSaves(S, P) { const n = D.SAVE_SLOTS, list = Array.isArray(P.saves) ? P.saves.slice(0, n) : [];
    S.saves = Array.from({ length: n }, (_, i) => (list[i] && list[i].map ? list[i] : null));
    for (const R of S.saves) if (R) { SIMX.rebalanceRun(R); SIMX.migrateSecrets(R); SIMX.regate(R); }
    S.slot = Number.isInteger(P.slot) && P.slot >= 0 && P.slot < n ? P.slot : 0;
    if (S.saved && S.saves[S.slot]) { const j = S.saves.indexOf(null); if (j >= 0) S.saves[j] = S.saves[S.slot]; S.saves[S.slot] = null; }
    pickLatest(S); }
  // with no run named on the menu, the one played last of the other slots takes its place, so «Продолжить» stays while any slot
  // holds a run (TASKS 1721)
  function pickLatest(S) { if (S.run || S.saved) return; let j = -1;
    S.saves.forEach((r, i) => { if (r && (j < 0 || (r.at || 0) > (S.saves[j].at || 0))) j = i; });
    if (j >= 0) { S.slot = j; S.saved = S.saves[j]; S.saves[j] = null; } }
  // a new run takes the first free slot and the saved one goes back to its own; with every slot taken it replaces the run played
  // longest ago, the saved one among them (TASKS 1785: it took the run under «Продолжить», the one a player least expects to lose),
  // and the menu asks first, naming that run
  function oldestSlot(S) { let j = -1; for (let i = 0; i < S.saves.length; i++) { const r = slotRun(S, i); if (r && (j < 0 || (r.at || 0) < (slotRun(S, j).at || 0))) j = i; } return j; }
  function takeSlot(S) { const full = isFull(S), old = full ? oldestSlot(S) : -1;
    if (S.saved && old !== S.slot) S.saves[S.slot] = S.saved; S.saved = null;
    let j = S.saves.indexOf(null); if (full) { j = old; S.saves[j] = null; }
    S.slot = j; }
  // the run's timers are marks on the clock it was played on, so the clock goes back to the run's own; the events and menu marks of
  // what was played since would then lie in its future, and go
  // the monsters wait under the floor's name a moment as on an arrival (TASKS 1812): an elite left at arm's length struck at once
  function resume(S, R) { S.t = (R.t ?? S.t) + DT; S.ev = []; S.newAsk = 0; S.jdrop = 0; S.run = R; S.screen = 'play'; R.msg = { s: D.placeName(R.floor, R.mode, R.seed, FROM(R), R.map), t: S.t };
    R.holdT = S.t + RESUME_HOLD; R.hero.ifr = Math.max(R.hero.ifr || 0, R.holdT); }
  const RESUME_HOLD = 1.2;
  function loadSlot(S, i) { const R = slotRun(S, i); if (!R) return false;
    if (i !== S.slot) { if (S.saved) S.saves[S.slot] = S.saved; S.saves[i] = null; S.slot = i; S.saved = R; }
    resume(S, R); S.saveN++; return true; }
  function dropSlot(S, i) { if (i === S.slot && S.saved) S.saved = null; else S.saves[i] = null; pickLatest(S); S.saveN++; }
  function startRun(S, mode = 'campaign') { takeSlot(S); const seed = (S.seedBase + S.meta.runs * 7777 + Math.floor(S.t * 1000)) >>> 0, town = mode === 'town' || mode === 'campaign'; S.run = newRun(S, town ? 'campaign' : mode, seed, { town }); S.saved = null; if (town) S.run.greet = 1;
    S.screen = S.run.hero.pts > 0 && RUN(S.run).lvl > 1 ? 'inv' : 'play'; }

  // a new run from the menus (TASKS 1103, 1304): the start screen with the difficulty and the class comes first, its run waiting in
  // pendingMode, the keyboard's focus on the chosen class
  const clsNow = (S) => (D.classesReady().includes(S.meta.cls) ? S.meta.cls : 'warrior');
  const chooseRun = (S, mode = 'campaign') => { S.pendingMode = mode; S.screen = 'classes'; S.hover = ''; S.focus = 'cls:' + clsNow(S); };
  // with every slot taken a new run first asks, on the yes-or-no sheet, «Нет» in focus (TASKS 1785: the second press it took
  // before went stale in 3 s without a word)
  const pressRun = (S, id) => { if (!isFull(S)) chooseRun(S, id); else { S.newAsk = id; S.focus = 'no'; S.hover = ''; } };
  const newAsked = (S, inp, keys, x, y, click) => { const a = askAnswer(S, UI.newAsk(), keys, x, y, click, inp.moved), id = S.newAsk;
    if (a < 0) { S.newAsk = 0; S.focus = id; S.hover = ''; ev(S, { k: 'ui', x, y }); }
    else if (a > 0) { S.newAsk = 0; ev(S, { k: 'ui', x, y }); chooseRun(S, id); } };
  // each screen's input, by S.screen: one function a screen (dead and win share one)
  const SCREEN = {};
  // the main menu (TASKS 1301): ↑↓ walk the items and «Что нового», Enter presses the focused one; with no item focused Enter
  // presses the first, as before the focus (continue the saved run, or a new one)
  SCREEN.menu = (S, inp, keys, x, y, click) => {
    if (S.newAsk) { newAsked(S, inp, keys, x, y, click); return; }
    const U = UI.menu(!!S.saved, S.meta.diff, S.meta.zoom, isFull(S)), b = D.hitUI(U, x, y); S.hover = b ? b.id : '';
    const order = U.map((q) => q.id);
    if (b && inp.moved) S.focus = b.id;
    if (order.includes(S.focus)) S.menuAt = S.focus;
    const at = order.indexOf(S.focus), mv = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    const press = (id) => {
      if (id === 'continue') resume(S, S.saved);
      if (id === 'load') openLoad(S);
      if (D.RUNS[id]) pressRun(S, id);
      if (id === 'tests') S.screen = 'tests';
      if (id === 'news') { S.screen = 'news'; S.newsTop = 0; }
      if (id === 'settings') openSettings(S, 'menu');
      if (id === 'stats') { S.screen = 'stats'; S.statTab = 'all'; S.focus = 'tab:all'; S.hover = ''; }
      ev(S, { k: 'ui', x, y }); };
    if (click && b && b.on) { S.focus = S.menuAt = b.id; press(b.id); return; }
    if (mv) { S.focus = order[at < 0 ? (mv > 0 ? 0 : order.length - 1) : (at + mv + order.length) % order.length]; ev(S, { k: 'ui', x, y }); return; }
    if (keys.Enter) press(at < 0 ? order[0] : S.focus);
  };
  // the test runs' screen (TASKS 417): each starts its run as the main menu's buttons did; «Назад» or Escape go back
  SCREEN.tests = (S, inp, keys, x, y, click) => {
    if (S.newAsk) { newAsked(S, inp, keys, x, y, click); return; }
    const b = D.hitUI(UI.tests(!!S.saved, isFull(S)), x, y); S.hover = b ? b.id : '';
    if ((click && b && b.id === 'back') || keys.Escape) { S.screen = 'menu'; S.hover = ''; if (click) ev(S, { k: 'ui', x, y }); return; }
    if (click && b && b.on) { pressRun(S, b.id); ev(S, { k: 'ui', x, y }); }
    return;
  };
  // the start screen (TASKS 1103, 1304): a tab picks the difficulty, a card the class, its kit button the kit (all kept in the meta
  // for the next time); «В путь» or Enter start the run the menu asked for, «Назад» or Escape go back to the menu. The keyboard
  // walks the rows with ↑↓ (difficulty, class, kit, buttons) and changes the focused row's choice with ←→
  const setDiff = (S, d) => { if ((S.meta.diff || 'normal') !== d) { S.meta.diff = d; S.saveN++; } };
  const setCls = (S, c) => { if (S.meta.cls !== c) { S.meta.cls = c; S.saveN++; } };
  const stepKit = (S, cls, k) => { const list = D.kitsOf(cls, S.meta), i = list.indexOf(D.kitOf(S.meta, cls)); S.meta.kit = S.meta.kit || {};
    S.meta.kit[cls] = list[(i + k + list.length) % list.length].id; S.saveN++; };
  SCREEN.classes = (S, inp, keys, x, y, click) => {
    const U = UI.classes(S.meta), b = D.hitUI(U, x, y); S.hover = b ? b.id : '';
    if (b && inp.moved) S.focus = b.id;
    const back = () => { S.screen = 'menu'; S.hover = ''; ev(S, { k: 'ui', x, y }); };
    if ((click && b && b.id === 'back') || keys.Escape || (keys.Enter && S.focus === 'back')) { back(); return; }
    if ((click && b && b.id === 'go') || keys.Enter) { ev(S, { k: 'ui', x, y }); startRun(S, S.pendingMode || 'campaign'); return; }
    if (click && b && b.dif) { setDiff(S, b.dif); S.focus = b.id; ev(S, { k: 'ui', x, y }); }
    if (click && b && b.kit) { stepKit(S, b.kit, 1); setCls(S, b.kit); S.focus = b.id; ev(S, { k: 'ui', x, y }); }
    if (click && b && b.cls) { setCls(S, b.cls); S.focus = b.id; ev(S, { k: 'ui', x, y }); }
    const cls = clsNow(S), ids = D.classesReady(), dif = D.DIFF_ORDER, row = (S.focus || '').split(':')[0];
    const rows = ['dif', 'cls'].concat(U.some((q) => q.id === 'kit:' + cls) ? ['kit'] : [], ['btn']), at = (r) => (r === 'dif' ? 'dif:' + (S.meta.diff || 'normal') : r === 'btn' ? 'go' : r + ':' + cls);
    const r0 = rows.includes(row) ? row : row === 'go' || row === 'back' ? 'btn' : 'cls';
    const mv = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0), st = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    if (mv) { S.focus = at(rows[Math.max(0, Math.min(rows.length - 1, rows.indexOf(r0) + mv))]); ev(S, { k: 'ui', x, y }); return; }
    if (!st) return;
    if (r0 === 'dif') { const i = dif.indexOf(S.meta.diff || 'normal'), d = dif[Math.max(0, Math.min(dif.length - 1, i + st))]; setDiff(S, d); S.focus = 'dif:' + d; }
    if (r0 === 'cls') { const c = ids[Math.max(0, Math.min(ids.length - 1, ids.indexOf(cls) + st))]; setCls(S, c); S.focus = 'cls:' + c; }
    if (r0 === 'kit') stepKit(S, cls, st);
    if (r0 === 'btn') S.focus = st > 0 ? 'go' : 'back';
    ev(S, { k: 'ui', x, y });
  };
  // the statistics (TASKS 1309): a tab or ←→ picks whose counters the book shows, ↑↓ go between the tabs and «Назад»; «Назад»,
  // Escape or Enter on «Назад» go back to the menu
  SCREEN.stats = (S, inp, keys, x, y, click) => {
    const U = UI.stats(), b = D.hitUI(U.r, x, y), tab = U.tabs.includes(S.statTab) ? S.statTab : 'all'; S.hover = b ? b.id : '';
    if (keys.Escape || (click && b && b.id === 'back') || (keys.Enter && S.focus === 'back')) { S.screen = 'menu'; S.hover = ''; ev(S, { k: 'ui', x, y }); return; }
    if (click && b && b.tab) { S.statTab = b.tab; S.focus = b.id; ev(S, { k: 'ui', x, y }); return; }
    const mv = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0), st = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    if (mv) { S.focus = mv > 0 ? 'back' : 'tab:' + tab; ev(S, { k: 'ui', x, y }); }
    if (st) { const i = Math.max(0, Math.min(U.tabs.length - 1, U.tabs.indexOf(tab) + st)); if (U.tabs[i] !== tab) { S.statTab = U.tabs[i]; ev(S, { k: 'ui', x, y }); } S.focus = 'tab:' + U.tabs[i]; }
  };
  // the saved games (TASKS 1311): ↑↓ walk the slots and the buttons, ←→ go between the list and the chosen slot's buttons, Enter
  // loads the chosen slot or presses the focused button, Delete asks to delete it; the question takes ←→, Enter and Escape
  const openLoad = (S) => { S.screen = 'load'; S.hover = ''; S.delAsk = undefined; const i = S.saved ? S.slot : Math.max(0, S.saves.findIndex(Boolean)); S.loadSel = i; S.focus = 'slot:' + i; };
  SCREEN.load = (S, inp, keys, x, y, click) => {
    const U = UI.load(), sel = Math.max(0, Math.min(D.SAVE_SLOTS - 1, S.loadSel | 0)), has = !!slotRun(S, sel), mv = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0), st = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const tick = () => ev(S, { k: 'ui', x, y });
    if (S.delAsk !== undefined) { const b = D.hitUI(U.yes, x, y); S.hover = b ? b.id : '';
      if (b && inp.moved) S.focus = b.id;
      if (st) { S.focus = S.focus === 'yes' ? 'no' : 'yes'; tick(); }
      const yes = (click && b && b.id === 'yes') || (keys.Enter && S.focus === 'yes'), no = keys.Escape || (click && b && b.id === 'no') || (keys.Enter && S.focus !== 'yes');
      if (yes) { dropSlot(S, S.delAsk); S.focus = 'slot:' + S.delAsk; S.delAsk = undefined; tick(); } else if (no) { S.focus = 'del'; S.delAsk = undefined; tick(); }
      return; }
    const b = D.hitUI(U.rows.concat(U.btn.map((q) => Object.assign({ on: q.id === 'back' || has }, q))), x, y); S.hover = b ? b.id : '';
    const order = U.rows.map((r) => r.id).concat(has ? ['go', 'del'] : [], ['back']), at = Math.max(0, order.indexOf(S.focus));
    const go = () => { if (loadSlot(S, sel)) { S.hover = ''; tick(); } }, ask = () => { if (has) { S.delAsk = sel; S.focus = 'no'; S.hover = ''; tick(); } };
    if (keys.Escape || (click && b && b.id === 'back') || (keys.Enter && S.focus === 'back')) { S.screen = 'menu'; S.hover = ''; tick(); return; }
    if (click && b && b.i !== undefined) { S.loadSel = b.i; S.focus = b.id; tick(); return; }
    if ((click && b && b.id === 'go') || (keys.Enter && (S.focus === 'go' || (S.focus || '').startsWith('slot:')))) { go(); return; }
    if ((click && b && b.id === 'del') || (keys.Enter && S.focus === 'del') || keys.Delete || keys.Backspace) { ask(); return; }
    if (mv) { S.focus = order[Math.max(0, Math.min(order.length - 1, at + mv))]; tick(); }
    else if (st) { S.focus = (S.focus || '').startsWith('slot:') ? (has ? 'go' : 'back') : 'slot:' + sel; tick(); }
    if ((S.focus || '').startsWith('slot:')) S.loadSel = +S.focus.slice(5);
  };
  // «Что нового» (TASKS 1038): the changelog scrolled by whole rows, the wheel and the arrows a row, a page a page; Escape goes back
  SCREEN.news = (S, inp, keys, x, y, click) => {
    const N = UI.news(S.newsTop), b = D.hitUI(N.r, x, y), page = Math.max(1, N.rows.length - 2); S.hover = b ? b.id : '';
    if ((click && b && b.id === 'back') || keys.Escape) { S.screen = 'menu'; S.hover = ''; if (click) ev(S, { k: 'ui', x, y }); return; }
    const d = (inp.wheel || 0) + (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0) + (keys.PageDown ? page : 0) - (keys.PageUp ? page : 0) + (keys.End ? N.n : 0) - (keys.Home ? N.n : 0);
    if (d) S.newsTop = Math.max(0, Math.min(N.max, N.top + d));
  };
  SCREEN.meta = (S, inp, keys, x, y, click) => {
    const bs = UI.meta(S.meta.cls, S.metaTab), b = D.hitUI(bs, x, y); S.hover = b ? b.id : '';
    if (click && b && b.id === 'codex') { S.screen = 'codex'; S.codexTab = 'm'; S.codexPage = 0; S.hover = ''; ev(S, { k: 'ui', x, y }); return; }
    if (click && b && b.tab) { if ((S.metaTab || 'up') !== b.tab) ev(S, { k: 'ui', x, y }); S.metaTab = b.tab; return; }
    if (click && b && b.un !== undefined) { SIMX.buyUnlock(S, D.UNLOCKS[b.un], x, y); return; }
    if ((click && b && b.id === 'back') || keys.Escape || (S.metaRun && keys.KeyE)) { S.screen = S.metaRun && S.run ? 'play' : 'menu'; S.metaRun = 0; return; }
    if (click && b) { const M = META.find((q) => q.id === b.id); if (M) { const r = S.meta.up[M.id] || 0, c = M.cost(r);
      if (r < M.max && S.meta.shards >= c) { S.meta.shards -= c; S.meta.up[M.id] = r + 1; S.saveN++; ev(S, { k: 'buy', x, y, id: M.id }); } else ev(S, { k: 'nope', x, y, s: r >= M.max ? TXT('sim_ui.meta.s') : TXT('sim_ui.meta.s.2') }); } }
    return;
  };
  SCREEN.fork = (S, inp, keys, x, y, click) => { const R = S.run, b = D.hitUI(UI.fork(), x, y); S.hover = b ? b.id : '';
    // a choice for the whole run is taken on a second press of the same card (TASKS 1847): the first only lights it, Escape or a
    // press anywhere else lets it go, a second Escape puts the fork off
    if (keys.Escape) { if (S.forkSel != null) S.forkSel = null; else { S.screen = 'inv'; S.hover = ''; } return; }
    if (click && b && S.forkSel === b.i) { SIMX.chooseFork(S, R, b.i); delete R.hero.draft; S.forkSel = null; ev(S, { k: 'buy', x, y }); if (!D.forkPending(R.hero)) S.screen = 'inv'; S.hover = ''; }
    else if (click && b) { S.forkSel = b.i; ev(S, { k: 'ui', x, y }); }
    else if (click) S.forkSel = null;
    return;
  };
  SCREEN.codex = (S, inp, keys, x, y, click) => { const U = UI.codex(S.codexTab || 'm', S.codexPage), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if ((click && b && b.id === 'back') || keys.Escape) { S.screen = 'meta'; S.hover = ''; return; }
    if (click && b && b.tab) { S.codexTab = b.tab; S.codexPage = 0; ev(S, { k: 'ui', x, y }); }
    if (click && b && b.id === 'prev' && U.page > 0) S.codexPage = U.page - 1;
    if (click && b && b.id === 'next' && U.page < U.pages - 1) S.codexPage = U.page + 1;
    return;
  };
  // the settings (TASKS 1302), from the main menu or the pause: the arrows move the focus between the rows and step the focused
  // slider, a click or a drag sets a slider, «Назад», Escape or Enter on «Назад» go back where it was opened from
  const openSettings = (S, from) => { S.screen = 'settings'; S.setFrom = from; S.hover = ''; S.drag = ''; S.focus = D.SETTINGS[0].id; };
  const setTo = (S, q, i) => { const v = q.stops[Math.max(0, Math.min(q.stops.length - 1, i))]; if (S.meta[q.key] === v) return false;
    S.meta[q.key] = v; if (q.key === 'zoom' && S.run) { S.run.zoom = v; if (S.run.map) SIMX.snapCam(S.run); } S.saveN++; return true; };
  const stopOf = (S, q) => { const i = q.stops.indexOf(S.meta[q.key] ?? q.def); return i < 0 ? q.stops.indexOf(q.def) : i; };
  SCREEN.settings = (S, inp, keys, x, y, click) => {
    const U = UI.settings(), b = D.hitUI(U.r, x, y), order = U.r.map((q) => q.id); S.hover = b ? b.id : '';
    if (keys.Escape || (click && b && b.id === 'back') || (keys.Enter && S.focus === 'back')) { S.screen = S.setFrom === 'pause' && S.run ? 'pause' : 'menu'; S.hover = ''; S.drag = ''; ev(S, { k: 'ui', x, y }); return; }
    const mv = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    if (mv) { S.focus = order[(Math.max(0, order.indexOf(S.focus)) + mv + order.length) % order.length]; ev(S, { k: 'ui', x, y }); }
    const q = D.SETTINGS.find((o) => o.id === S.focus), st = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    if (q && st && setTo(S, q, stopOf(S, q) + st)) ev(S, { k: 'ui', x, y });
    if (click && b) { S.focus = b.id; if (b.slider) S.drag = b.id; }
    if (!inp.press) S.drag = '';
    const dq = S.drag && D.SETTINGS.find((o) => o.id === S.drag), r = dq && U.r.find((o) => o.id === S.drag);
    if (dq && setTo(S, dq, Math.round((x - r.x) / r.w * (dq.stops.length - 1)))) ev(S, { k: 'ui', x, y });
  };
  // a yes-or-no question (TASKS 1843, 1844): «Нет» is the focus it opens with, ←→ move it, Enter answers it, Escape says no
  const askAnswer = (S, U, keys, x, y, click, moved) => { const b = D.hitUI(U.r, x, y), st = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0); S.hover = b ? b.id : '';
    if (b && moved) S.focus = b.id;
    if (st) { S.focus = S.focus === U.r[0].id ? U.r[1].id : U.r[0].id; ev(S, { k: 'ui', x, y }); }
    if ((click && b && b.id === U.r[0].id) || (keys.Enter && S.focus === U.r[0].id)) return 1;
    if (keys.Escape || (click && b && b.id === U.r[1].id) || keys.Enter) return -1;
    return 0; };
  SCREEN.pause = (S, inp, keys, x, y, click) => {
    const done = !!S.run && campaignDone(S.run);
    if (S.pauseAsk) { const a = askAnswer(S, UI.pauseAsk(done), keys, x, y, click, inp.moved);
      if (a < 0) { S.pauseAsk = 0; S.focus = ''; S.hover = ''; ev(S, { k: 'ui', x, y }); }
      else if (a > 0) { S.pauseAsk = 0; S.focus = ''; if (done) finishRun(S); else { if (S.run.log) S.run.log.abandon = 1; endRun(S, 'dead'); } }
      return; }
    const b = D.hitUI(UI.pause(S.meta.zoom, done), x, y); S.hover = b ? b.id : '';
    if (click && b && b.id === 'settings') { openSettings(S, 'pause'); ev(S, { k: 'ui', x, y }); return; }
    if (keys.Escape || (click && b && b.id === 'resume')) { S.screen = 'play'; return; }
    if (click && b && b.id === 'save') { S.saved = S.run; S.run = null; S.screen = 'menu'; S.saveN++; S.savedT = S.t; return; }
    if (click && b && (b.id === 'finish' || b.id === 'abandon')) { S.pauseAsk = 1; S.focus = 'no'; S.hover = ''; ev(S, { k: 'ui', x, y }); return; }
    return;
  };
  SCREEN.dead = (S, inp, keys, x, y, click) => {
    const b = D.hitUI(UI.end(S.result && S.result.log, S.result && S.result.town), x, y); S.hover = b ? b.id : '';
    if (click && b && b.on) { if (b.id === 'log') { S.logReq = (S.logReq || 0) + 1; ev(S, { k: 'ui', x, y }); } else if (b.id === 'menu') S.screen = 'menu'; else chooseRun(S, S.result && S.result.town ? 'town' : S.result && !S.result.campaignWon && S.result.mode || 'campaign'); }
    return;
  };
  SCREEN.win = SCREEN.dead;
  // the storage chest: a click moves an item across, a drag drops it on the cell under the pointer (a drop where it started, or
  // off any cell, moves it across as a click would)
  const TALK_SETTLE = 0.5;
  SCREEN.talk = (S, inp, keys, x, y, click) => {
    const T = S.talk, b = T && D.hitUI(UI.talk(T).r, x, y); S.hover = b ? b.id : '';
    if (!T || !S.run || (keys.Escape && !T.inTopic)) { S.screen = 'play'; S.talk = null; return; }
    if (keys.Escape) { T.inTopic = 0; T.menu = 1; T.pages = ['']; T.p = 0; ev(S, { k: 'ui', x, y }); return; }
    if (T.pk !== T.pages[T.p]) { T.pk = T.pages[T.p]; T.pT = S.t; }
    if (click && b && b.id === 'craft') { SIMX.openCraft(S, S.run, T.craft); return; }
    // in the topics menu a number or a click opens a topic; «Дальше» / «Не сейчас», E, the space or Enter leave it
    if (T.menu) { const pick = T.topics.findIndex((q, i) => keys['Digit' + (i + 1)]), n = click && b && b.id.startsWith('topic:') ? b.i : pick; if (n >= 0) { T.pages = T.topics[n].a; T.p = 0; T.menu = 0; T.inTopic = 1; ev(S, { k: 'ui', x, y }); return; } if ((click && b && b.id === 'next') || keys.KeyE || keys.Space || keys.Enter) { S.screen = 'play'; S.talk = null; } return; }
    const last = T.p + 1 >= T.pages.length;
    // E run through the pages must never take a side quest or end the run (TASKS 1148, 1657), nor drop the offer unread (TASKS 1849):
    // on an offer's page E and the space do nothing, save the Keeper's first story quest, which E takes once the page has been up a breath
    const quest = T.act && last && T.act.k === 'take', settled = S.t - (T.pT ?? S.t) >= TALK_SETTLE,
      byE = keys.KeyE && T.act && (T.act.k === 'turn' || (T.act.k === 'take' && T.act.first && settled));
    if (T.act && last && ((click && b && b.id === 'act') || byE || keys.Enter)) { talkAct(S, S.run, T); return; }
    if (quest && (keys.KeyE || keys.Space)) return;
    if (click && b && b.id === 'talk' && T.topics) { T.menu = 1; T.pages = ['']; T.p = 0; T.act = null; T.craft = 0; ev(S, { k: 'ui', x, y }); return; }
    // a master's last page with no quest on it: E goes on into the workshop, so E, E still reaches the forge (TASKS 1635)
    if (T.craft && last && !T.act && !T.inTopic && keys.KeyE) { SIMX.openCraft(S, S.run, T.craft); return; }
    if ((click && b && b.id === 'next') || keys.KeyE || keys.Space || keys.Enter) { if (++T.p >= T.pages.length) { if (T.inTopic) { T.inTopic = 0; T.menu = 1; T.pages = ['']; T.p = 0; ev(S, { k: 'ui', x, y }); } else { S.screen = 'play'; S.talk = null; } } else ev(S, { k: 'ui', x, y }); }
    return;
  };
  SCREEN.craft = (S, inp, keys, x, y, click) => {
    const R = S.run, U = R && UI.craft(R.hero.bag.length, S.bagTab), b = U && D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!R || !S.craft || keys.Escape || keys.KeyE || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    // back to the master's talk, kept off E so that E only leaves the workshop
    if (keys.Enter || (click && b && b.id === 'talk')) { const sm = SIMX.folkOf(R).find((q) => q.role === SIMX.CRAFT_OF[S.craft.kind]); if (sm) { SIMX.openTalk(S, R, sm); ev(S, { k: 'ui', x, y }); return; } }
    if ((click || inp.rclick) && b && (b.id.startsWith('eq:') || b.id.startsWith('bag:'))) { const it = b.id.startsWith('eq:') ? R.hero.eq[b.slot] : R.hero.bag[b.i];
      if (it && BASES[it.b]) { S.craft.sel = b.id; S.craft.res = null; ev(S, { k: 'ui', x, y }); } else if (it) ev(S, { k: 'nope', x, y, s: TXT('sim_ui.craft.s') }); }
    if (click && b && b.tab !== undefined) tabClick(S, b, x, y);
    if (click && b && b.id === 'do') craft(S, R);
    return;
  };
  SCREEN.stash = (S, inp, keys, x, y, click) => {
    const R = S.run, U = R && UI.stash(R.hero.bag.length, S.bagTab), b = U && D.hitUI(U.r, x, y), n = D.STASH.cells; S.hover = b ? b.id : '';
    if (!R || keys.Escape || keys.KeyE || (click && b && b.id === 'close')) { S.screen = 'play'; S.drag = null; return; }
    const T = stashOf(S);
    if (click && b && b.tab !== undefined && !S.drag) { tabClick(S, b, x, y); return; }
    if (inp.rclick && b && !S.drag) { if (b.id.startsWith('bag:') && R.hero.bag[b.i]) { stashPut(S, R, b.i); return; } if (b.id.startsWith('stash:') && T.items[b.i]) { stashTake(S, R, b.i); return; } }
    if (click && b && b.id.startsWith('sort')) { if (b.id.startsWith('sortS:')) sortItems(T.items, n, b.k, false); else sortTab(S, R.hero, b.k); S.saveN++; ev(S, { k: 'ui', x, y }); return; }
    if (click && b && ((b.id.startsWith('bag:') && R.hero.bag[b.i]) || (b.id.startsWith('stash:') && T.items[b.i]))) S.drag = { from: b.id, x, y };
    if (S.drag && inp.press) { S.drag.x = x; S.drag.y = y; }
    else if (S.drag) { const from = S.drag.from, k = +from.split(':')[1], to = b && b.id !== from ? b : null; S.drag = null;
      if (to && to.tab !== undefined) { if (from.startsWith('bag:')) intoTab(S, R, R.hero, k, false, to.tab, x, y); else { const j = freeIn(R.hero, to.tab); if (j < 0) ev(S, { k: 'nope', x, y, s: TXT('sim_ui.inv.full') }); else stashTake(S, R, k, j); } return; }
      const same = to && to.id.split(':')[0] === from.split(':')[0];
      // a drag within one grid moves the piece there, as the window's own line says (TASKS 1413)
      if (same && from.startsWith('bag:')) { const B = R.hero.bag; [B[k], B[to.i]] = [B[to.i], B[k]]; S.saveN++; }
      else if (same) { if (to.i < n) { [T.items[k], T.items[to.i]] = [T.items[to.i] || null, T.items[k]]; S.saveN++; } }
      else if (from.startsWith('bag:')) stashPut(S, R, k, to && to.id.startsWith('stash:') && to.i < n ? to.i : undefined);
      else stashTake(S, R, k, to && to.id.startsWith('bag:') ? to.i : undefined); }
    return;
  };
  SCREEN.gate = (S, inp, keys, x, y, click) => {
    const R = S.run, o = gateWays(R), U = UI.gate(o.length), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!o.length || keys.Escape || keys.KeyE || (click && b && b.id === 'leave')) { S.screen = 'play'; return; }
    if (click && b && b.id.startsWith('go:') && o[b.i]) gateGo(S, R, o[b.i]);
    return;
  };
  // the town's gate out (TASKS 1149): give up the run, or past the campaign's last boss end it won; a question like the pause's
  // (TASKS 1844): «Остаться» in focus, so Enter alone never ends the run
  SCREEN.leave = (S, inp, keys, x, y, click) => {
    const R = S.run, a = R ? askAnswer(S, UI.leave(), Object.assign({}, keys, { Escape: keys.Escape || keys.KeyE }), x, y, click, inp.moved) : -1;
    if (a < 0) { S.screen = 'play'; S.focus = ''; return; }
    if (a > 0) { S.focus = ''; if (campaignDone(R)) finishRun(S); else { if (R.log) R.log.abandon = 1; endRun(S, 'dead'); } }
  };
  SCREEN.altar = (S, inp, keys, x, y, click) => {
    const R = S.run, sh = R.shrines[R.altar], U = UI.altar(sh && sh.gifts ? sh.gifts.length : 3), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!sh || keys.Escape || keys.KeyE || (click && b && b.id === 'leave')) { S.screen = 'play'; return; }
    if (click && b && b.id.startsWith('gift:')) takeGift(S, R, sh, b.i, x, y);
    if (click && b && b.id === 'donate') donate(S, R, x, y);
    if (click && b && b.id === 'reroll') SIMX.rerollAltar(S, R, sh, x, y);
    return;
  };
  SCREEN.shop = (S, inp, keys, x, y, click) => {
    const R = S.run, sh = R.shop, U = UI.shop(sh.goods.length, R.hero.bag.length, S.bagTab), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (keys.Escape || keys.KeyE || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    if (inp.rclick && b && b.id.startsWith('sell:')) { sellAsk(S, R, b.i, x, y); return; }
    if (!click || !b) return;
    if (b.id === 'talk' && !sh.wander) { S.talk = { role: 'merchant', i: 0, pages: [''], p: 0, act: null, topics: D.FOLK.merchant.topics, menu: 1 }; S.screen = 'talk'; S.hover = ''; ev(S, { k: 'ui', x, y }); return; }
    if (b.id.startsWith('buy:') && sh.goods[b.i]) buy(S, R, sh.goods[b.i], 0);
    if (b.id.startsWith('back:') && sh.back[b.i]) buy(S, R, sh.back[b.i], 1);
    if (b.tab !== undefined) tabClick(S, b, x, y);
    if (b.id.startsWith('sell:')) sellAsk(S, R, b.i, x, y);
    return;
  };
  // a legendary or better goes on a second press (TASKS 1853 г): the merchant buys it back only while it is among his last few
  const sellAsk = (S, R, i, x, y) => { const it = R.hero.bag[i]; if (!it) return;
    if ((it.rar || 0) < 4 || again(S, 'sell', it)) sell(S, R, i); else ev(S, { k: 'ask', x, y, s: TXT('sim_ui.shop.sellAsk', { p1: SIMX.itemName(it) }) }); };
  // one way out of every window (TASKS 1853 д): Esc or the key that opened it, and its own button; the talk alone keeps E for its pages
  // the notice board (TASKS 1033): E or Esc closes it, a row's button takes its quest
  SCREEN.board = (S, inp, keys, x, y, click) => {
    const R = S.run, L0 = R ? boardOffers(R) : [], U = UI.board(L0.length), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!R || keys.Escape || keys.KeyE || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    if (click && b && b.id.startsWith('take:') && L0[b.i]) giveQuest(S, R, L0[b.i].role);
    return;
  };
  // the quest journal (TASKS 1023): J or Esc closes it, a click picks a quest to read
  SCREEN.journal = (S, inp, keys, x, y, click) => {
    const R = S.run, L0 = R ? journalOf(R) : [], sel = L0.find((q) => q.id === S.jsel) || L0[0], U = UI.journal(L0.length, sel && sel.st === 'taken'), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!R || keys.Escape || keys.KeyJ || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    if (click && b && b.id === 'notes') { S.screen = 'notes'; S.hover = ''; ev(S, { k: 'ui', x, y }); return; }
    if (click && b && b.id.startsWith('q:') && L0[b.i]) { S.jsel = L0[b.i].id; S.jdrop = 0; ev(S, { k: 'ui', x, y }); }
    // given up only on a second press, as a saved run is dropped: nothing brings a quest back but its giver (TASKS 1633)
    if (click && b && b.id === 'drop' && sel) { if (S.jdrop === sel.id && S.t - S.jdropT < 3) { S.jdrop = 0; abandonQuest(S, R, sel); } else { S.jdrop = sel.id; S.jdropT = S.t; ev(S, { k: 'ui', x, y }); } }
    return;
  };
  SCREEN.note = (S, inp, keys, x, y, click) => { if (keys.KeyE || keys.Escape || keys.Enter || keys.Space || click) { S.screen = 'play'; ev(S, { k: 'ui', x, y }); } };
  SCREEN.notes = (S, inp, keys, x, y, click) => { const L0 = S.meta.notes || [], pg = S.notesPage || 0, U = UI.notes(L0.length, pg), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (keys.Escape || keys.KeyJ || (click && b && b.id === 'close')) { S.screen = 'journal'; S.hover = ''; return; }
    if (click && b && b.id === 'prev' && b.on) S.notesPage = pg - 1; if (click && b && b.id === 'next' && b.on) S.notesPage = pg + 1;
    if (click && b && b.id.startsWith('n:')) S.noteSel = L0[b.i]; if (click && b) ev(S, { k: 'ui', x, y }); };
  // a press asked twice (TASKS 1853 в, г): true on the second within 3 s on the same piece, else it arms and the caller says why
  const again = (S, k, it) => { const A = S.ask2; if (A && A.k === k && A.id === it.id && S.t - A.t < 3) { S.ask2 = null; return true; } S.ask2 = { k, id: it.id, t: S.t }; return false; };
  // the bag's tabs (TASKS 1687): the open one is kept per player, not per window; a sort orders the open tab's cells only
  const openTab = (S, h) => { const T = D.bagTabs(h.bag.length), k = Math.max(0, Math.min(T.length - 1, S.bagTab | 0)); return T[k]; };
  const sortTab = (S, h, k) => { const T = openTab(S, h), part = h.bag.slice(T.a, T.a + T.n); sortItems(part, T.n, k, true); h.bag.splice(T.a, T.n, ...part); };
  const freeIn = (h, t) => { const T = D.bagTabs(h.bag.length)[t]; if (T) for (let i = T.a; i < T.a + T.n; i++) if (!h.bag[i]) return i; return -1; };
  const tabClick = (S, b, x, y) => { S.bagTab = b.tab; S.hover = ''; ev(S, { k: 'ui', x, y }); };
  // a piece let go over a tab goes to that tab's first free cell (a worn one comes off into it)
  const intoTab = (S, R, h, k, eq, t, x, y) => { const T = D.bagTabs(h.bag.length)[t]; if (!T) return;
    if (!eq && k >= T.a && k < T.a + T.n) { ev(S, { k: 'nope', x, y, s: t ? TXT('sim_ui.inv.same') : TXT('sim_ui.inv.sameBag') }); return; }
    const j = freeIn(h, t); if (j < 0) { ev(S, { k: 'nope', x, y, s: TXT('sim_ui.inv.full') }); return; }
    if (eq) unequip(S, R, h, k, j); else { h.bag[j] = h.bag[k]; h.bag[k] = null; S.saveN++; ev(S, { k: 'ui', x, y }); } };
  const unequip = (S, R, h, slot, i) => { const it = h.eq[slot]; if (!it) return;
    if (i === undefined ? bagAdd(R, it) : !h.bag[i]) { if (i !== undefined) { it.id = it.id || R.nextId++; h.bag[i] = it; } h.eq[slot] = null; const st = heroSt(S); h.hp = Math.min(h.hp, st.maxHp); h.mp = Math.min(h.mp, st.maxMp); ev(S, { k: 'unequip', x: h.x, y: h.y, slot, off: gearName(it) }); } };
  // a press on a bag or worn piece picks it up; letting go over its own cell is the click (use / unequip), over another bag cell
  // moves it there (a swap with what lies there), off any cell drops nothing
  const fitsSlot = (it, slot) => !!it && !isCons(it) && BASES[it.b].slot === slot;
  const dropInv = (S, R, h, b) => { const dr = S.drag, f = dr.from, eq = f.startsWith('eq:'), k = eq ? f.slice(3) : +f.split(':')[1]; S.drag = null;
    if (b && b.tab !== undefined) { intoTab(S, R, h, k, eq, b.tab, dr.x, dr.y); return; }
    const bagTo = b && b.id.startsWith('bag:') && b.id !== f && b.i < h.bag.length, nope = (s) => ev(S, { k: 'nope', x: dr.x, y: dr.y, s });
    if (b && b.id === f) { if (eq) unequip(S, R, h, k); else useItem(S, R, k); }
    else if (bagTo && !eq) { [h.bag[k], h.bag[b.i]] = [h.bag[b.i], h.bag[k]]; S.saveN++; ev(S, { k: 'ui', x: dr.x, y: dr.y }); }
    else if (bagTo && eq) { const o = h.bag[b.i]; if (!o) unequip(S, R, h, k, b.i); else if (fitsSlot(o, k)) useItem(S, R, b.i); else nope(TXT('sim_ui.inv.swap', { p1: D.SLOT_NAME[k] })); }
    else if (b && b.id.startsWith('eq:') && !eq) { const it = h.bag[k]; if (it && isCons(it)) nope(TXT('sim_ui.inv.cons')); else if (!fitsSlot(it, b.slot)) nope(TXT('sim_ui.inv.slot', { p1: D.SLOT_NAME[b.slot] })); else useItem(S, R, k); } };
  SCREEN.inv = (S, inp, keys, x, y, click) => {
    const R = S.run, h = R.hero, U = UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (keys.Escape || keys.KeyI || keys.KeyC || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; S.drag = null; return; }
    if (click && b && (b.id.startsWith('bag:') ? h.bag[b.i] : b.id.startsWith('eq:') && h.eq[b.slot])) S.drag = { from: b.id, x, y };
    if (S.drag && inp.press) { S.drag.x = x; S.drag.y = y; return; }
    if (S.drag) { dropInv(S, R, h, b); return; }
    if (!b) return;
    if (click && b.tab !== undefined) { tabClick(S, b, x, y); return; }
    if (click && b.id.startsWith('sort:')) { sortTab(S, h, b.k); S.saveN++; ev(S, { k: 'ui', x, y }); }
    // the right button is each window's quick action on a bag piece (TASKS 1853 в): here it throws it away, on a second press, as a
    // legendary is sold, for a piece on the floor of a cave is as good as lost
    if (inp.rclick && b.id.startsWith('bag:') && h.bag[b.i]) { const it = h.bag[b.i];
      if (again(S, 'toss', it)) { h.bag[b.i] = null; throwAway(R, h, it); ev(S, { k: 'toss', x: h.x, y: h.y }); } else ev(S, { k: 'ask', x, y, s: TXT('sim_ui.inv.tossAsk', { p1: SIMX.itemName(it) }) }); }
    if (click && b.id.startsWith('stat:') && h.pts > 0) { const d = draftOf(h); d.thTip = d.thTip ?? (h.thTip || 0); h.base[b.k]++; h.pts--; d.st[b.k] = (d.st[b.k] || 0) + 1;
      if (b.k === 'vit') { h.hp += 10; d.hp += 10; } if (b.k === 'int') { h.mp += 6; d.mp += 6; } ev(S, { k: 'buy', x, y }); SIMX.thresholdTip(S, R); }
    if (click && b.id === 'reset:st' && h.draft && draftHas(h.draft.st)) { resetDraft(S, h, 'st'); ev(S, { k: 'ui', x, y }); }
    if (click && b.id === 'reset:ab' && h.draft && (draftHas(h.draft.ab) || h.draft.mast)) { resetDraft(S, h, 'ab'); ev(S, { k: 'ui', x, y }); }
    if (click && b.id.startsWith('ab:') && D.forkPending(h)) { toFork(S); return; }
    if (click && b.id.startsWith('ab:') && h.sp > 0) { const A = D.clsOf(h).abs.find((a) => a.id === b.ab); if (h.lvl >= A.unlock && (h.ab[b.ab] || 0) < D.AB_MAX) { const d = draftOf(h), m0 = h.mast || 0;
      h.ab[b.ab] = (h.ab[b.ab] || 0) + 1; h.sp--; d.ab[b.ab] = (d.ab[b.ab] || 0) + 1; D.masteryTake(h); d.mast += (h.mast || 0) - m0; ev(S, { k: 'buy', x, y }); if (D.forkPending(h)) toFork(S); } }
  };
  // points put in on one visit to the hero's page stay a draft until the page closes (TASKS 1847): base, ranks and health carry them
  // at once, as everything reads them, and the draft only remembers how to take them back; leaving the page forgets it, and that is
  // the commit. A choice made at a fork commits it too, for a rank taken back from under its fork would leave the fork hanging
  const draftOf = (h) => h.draft || (h.draft = { st: {}, ab: {}, hp: 0, mp: 0, mast: 0 });
  const draftHas = (o) => Object.values(o || {}).some((n) => n > 0);
  function resetDraft(S, h, part) { const d = h.draft; if (!d) return;
    if (part === 'st') { for (const k in d.st) { h.base[k] -= d.st[k]; h.pts += d.st[k]; } d.st = {}; const st = heroSt(S);
      h.hp = Math.max(1, Math.min(st.maxHp, h.hp - d.hp)); h.mp = Math.max(0, Math.min(st.maxMp, h.mp - d.mp)); d.hp = 0; d.mp = 0; h.thTip = d.thTip ?? h.thTip; delete d.thTip; }
    else { h.mast = (h.mast || 0) - d.mast; h.sp += d.mast; d.mast = 0; for (const k in d.ab) { h.ab[k] -= d.ab[k]; h.sp += d.ab[k]; if (!h.ab[k]) delete h.ab[k]; } d.ab = {}; if (!h.mast) delete h.mast; }
    if (!draftHas(d.st) && !draftHas(d.ab) && !d.mast) delete h.draft; S.saveN++; }
  const toFork = (S) => { S.screen = 'fork'; S.hover = ''; S.forkSel = null; };
  const commitDraft = (S) => { const h = S.run && S.run.hero; if (h && h.draft && S.screen !== 'inv' && S.screen !== 'fork') delete h.draft; };
  // the screens the menu opens: back from one of them the menu's focus returns to the item that opened it (TASKS 1850); back from
  // a run it starts again from none, the first item (the run just saved), not the item that started the run long ago
  const MENU_SUBS = ['load', 'stats', 'settings', 'news', 'tests', 'classes'];
  // moved: the pointer moved since the last step, and only then takes the focus onto what it is over (TASKS 1754), so a pointer
  // resting over an item does not take it back from the keyboard
  function stepUI(S, inp, keys) {
    const f = SCREEN[S.screen], moved = !S.ptr || S.ptr[0] !== inp.px || S.ptr[1] !== inp.py; S.ptr = [inp.px, inp.py];
    if (S.screen === 'menu' && S.uiWas !== 'menu') S.focus = MENU_SUBS.includes(S.uiWas) && S.menuAt ? S.menuAt : '';
    S.uiWas = S.screen; if (f) f(S, Object.assign({}, inp, { moved }), keys, inp.px, inp.py, inp.click); commitDraft(S);
  }

  Object.assign(SIMX, {
    endRun, finishRun, descend, begin, startRun, stepUI, commitDraft, loadSaves, slotRun, isFull, oldestSlot, loadSlot, dropSlot });
})(typeof window !== 'undefined' ? window : globalThis);
