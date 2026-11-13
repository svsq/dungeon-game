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
    // a test run (TASKS 1878) pays its shards but counts in no counter, record or journal, nor is the Keeper of the Fire told of it
    const test = !!R.test;
    S.meta.shards += bonus; if (!test) { S.meta.runs = (S.meta.runs || 0) + 1; if (how === 'win' && !R.campaignWon) S.meta.wins = (S.meta.wins || 0) + 1; }
    // what the Keeper of the Fire will speak of to the next hero (TASKS 1016)
    if (!test) { if (how === 'dead' && !(R.log && R.log.abandon)) S.meta.deaths = (S.meta.deaths || 0) + 1; S.meta.lastEnd = R.log && R.log.abandon ? 'abandon' : how; S.meta.endTold = 0; S.meta.lastCls = D.clsOf(R.hero).id; }
    // the records are the deepest floor reached, not the one the run ended on (TASKS 516: down to the 17th, back up to the 16th)
    const deep = Math.max(R.deepest || 0, R.floor);
    if (RUN(R) === D.RUNS.campaign && !test) { S.meta.best = Math.max(S.meta.best || 0, deep); tally(S, R, 'best', deep, 1); }
    tally(S, R, 'runs'); tally(S, R, 'shards', bonus); if (how === 'win' && !R.campaignWon) tally(S, R, 'wins'); if (how === 'dead' && !(R.log && R.log.abandon)) tally(S, R, 'deaths');
    // the endless descent's record depth (TASKS 348)
    const deepBest = S.meta.bestEndless || 0; if (RUN(R).endless && !test) S.meta.bestEndless = Math.max(deepBest, deep);
    S.result = { how, mode: R.mode, floor: R.floor, deepest: deep, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, shards: R.shards + bonus, found: R.shards, base: W2.base, statBonus: W2.bonus, cap: W2.cap,
      C: W2.C, win: how === 'win' && !R.campaignWon ? REWARD.win : 0, time: R.play || 0, donations: R.donations || 0,
      damage: (R.recentDamage || []).slice(-3), abandoned: !!(R.log && R.log.abandon), record: RUN(R).endless && !test ? { best: S.meta.bestEndless, fresh: deep > deepBest } : undefined, campaignWon: R.campaignWon ? 1 : 0, town: R.viaTown ? 1 : 0, hero: JSON.parse(JSON.stringify(R.hero)), heroStats: heroSt(S) };
    if (R.log && !test) { R.log.end = { how: R.log.abandon ? 'abandon' : how, time: R.play || 0, floor: R.floor, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, cause: how === 'dead' ? R.log.last || null : null, bag: potCount(R.hero), tail: R.log.tail || [], done: R.stats || {}, pct: W2.C.pct };   // done: per floor kills/foes, loot/lootN, sec/secN
      S.result.log = R.log; S.logN = (S.logN || 0) + 1; }
    S.run = null; S.saved = null; pickLatest(S); S.screen = how; S.saveN++;
  }
  // the run ended alive past the campaign's last boss (TASKS 1148): a win, the campaign's if not won yet at the stairs on
  function finishRun(S) { S.talk = null; S.screen = 'play'; endRun(S, 'win'); }
  // a hero who starts above level 1 opens on the hero screen, his points still to lay out
  // past the serpent, down the stairs (TASKS 354): the campaign is won on the spot — its reward (gold and the win's shards), a win,
  // its record — and the same run goes on as the endless descent from the 13th, the hero as he is; the descent's depth is its record
  function descend(S, R) {
    // (the win is counted once the way down opens: a step that fails leaves the run as it was, review of PR 69)
    const W2 = runReward(R, 'win'), f0 = R.floor, e = { k: 'stairs', x: R.hero.x, y: R.hero.y, floor: f0 };
    const was = { goldBanked: R.goldBanked, campaignWon: R.campaignWon, mode: R.mode };
    R.goldBanked = R.goldTot; R.campaignWon = 1; R.mode = RUN(R).then; if (!enterFloor(S, R, f0 + 1)) { Object.assign(R, was); return; }
    S.meta.shards += W2.base; if (!R.test) { S.meta.wins = (S.meta.wins || 0) + 1; S.meta.best = Math.max(S.meta.best || 0, f0); }
    tally(S, R, 'wins'); tally(S, R, 'shards', W2.base); tally(S, R, 'best', f0, 1); S.saveN++; ev(S, e);
    R.msg = { s: TXT('sim_ui.descend.msg.s', { base: W2.base, floor: R.floor, p3: D.floorName(R.floor, R.mode, R.seed, FROM(R)) }), t: S.t, d: 5 }; }
  // the checks of the dungeon's own workings start from the menu as before and play its 1st floor laid out without the town (a
  // merchant on the floor, no stairs up), the run's seed kept (TASKS 1026: the campaign itself now starts in the town)
  const begin = (S) => { const c = UI.menu(!!S.saved).find((b) => b.id === 'campaign'); SIMX.step(S, { keys: [], px: c.x + c.w / 2, py: c.y + c.h / 2 + SIMX.uiDy('menu'), click: 1 }); if (S.screen === 'classes') startRun(S, S.pendingMode); if (S.run && S.run.town) { S.run = newRun(S, 'campaign', S.run.seed); S.screen = 'play'; } };
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
  // the floor waits under its name a moment as on an arrival (TASKS 1812): an elite left at arm's length struck at once. The hero
  // waits with it (holdClocks), so nothing a load gives can be chained into a dodge
  function resume(S, R) { S.t = (R.t ?? S.t) + DT; S.ev = []; S.newAsk = 0; S.jdrop = 0; S.potAsk = null; S.run = R; S.screen = 'play'; R.msg = { s: D.placeName(R.floor, R.mode, R.seed, FROM(R), R.map), t: S.t };
    SIMX.mendRun(S, R); R.holdT = S.t + RESUME_HOLD; }
  const RESUME_HOLD = 1.2;
  function loadSlot(S, i) { const R = slotRun(S, i); if (!R) return false;
    if (i !== S.slot) { if (S.saved) S.saves[S.slot] = S.saved; S.saves[i] = null; S.slot = i; S.saved = R; }
    resume(S, R); S.saveN++; return true; }
  function dropSlot(S, i) { if (i === S.slot && S.saved) S.saved = null; else S.saves[i] = null; pickLatest(S); S.saveN++; }
  // the run in play put aside under «Продолжить» (the pause's «Сохранить и выйти в меню», the menu's «Выход»)
  function saveRun(S) { S.saved = S.run; S.run = null; S.saveN++; S.savedT = S.t; }
  // a run of the tests' screen is marked a test (TASKS 1878): it leaves no trace in the statistics or the run journals
  function startRun(S, mode = 'campaign') { takeSlot(S); const seed = (S.seedBase + S.meta.runs * 7777 + Math.floor(S.t * 1000)) >>> 0, town = mode === 'town' || mode === 'campaign'; S.run = newRun(S, town ? 'campaign' : mode, seed, { town, name: nameOf(S) }); S.saved = null; if (town) S.run.greet = 1; else S.run.test = 1;
    S.screen = S.run.hero.pts > 0 && RUN(S.run).lvl > 1 ? 'inv' : 'play'; }

  // a new run from the menus (TASKS 1103, 1304): the start screen with the difficulty and the class comes first, its run waiting in
  // pendingMode, the keyboard's focus on the chosen class
  const clsNow = (S) => (D.classesReady().includes(S.meta.cls) ? S.meta.cls : 'warrior');
  // the hero's name (TASKS 1879): each new run's start screen offers one off the die, the player may type another. The die is the
  // sim's own (the session's seed and its count of throws), never the same name twice running; an empty field throws it at the start
  const rollName = (S) => { const N = D.heroNames(), was = N.indexOf(S.pendName);
    if (N.length < 2) { S.pendName = N[0] || ''; return N[0] || D.clsOf({ cls: clsNow(S) }).name; }
    S.nameN = (S.nameN || 0) + 1; let x = Math.imul((S.seedBase | 0) ^ Math.imul(S.nameN, 0x9e3779b1), 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    // the throw falls among the other names, so it never lands on the one shown, however the hash comes out
    let i = (x >>> 0) % (N.length - (was >= 0 ? 1 : 0)); if (was >= 0 && i >= was) i++;
    S.pendName = N[i]; return N[i]; };
  const nameOf = (S) => { const n = (S.pendName || '').trim(); return n || rollName(S); };
  const typing = (S) => S.screen === 'classes' && S.focus === 'name';
  // a name typed in lowercase or with stray spaces must still read as a name on the slots and the end screens: its first letter is
  // made capital, and a space may neither lead nor double
  const typeName = (S, chars, keys) => { let n = S.pendName || '';
    if (keys.Backspace) n = n.slice(0, -1);
    for (const c of chars || []) if (D.NAME_CHAR.test(c) && n.length < D.NAME_MAX && !(c === ' ' && (!n || n.endsWith(' ')))) n += n ? c : c.toUpperCase();
    if (n !== (S.pendName || '')) { S.pendName = n; return true; } return false; };
  const chooseRun = (S, mode = 'campaign') => { S.pendingMode = mode; S.screen = 'classes'; S.hover = ''; S.focus = 'cls:' + clsNow(S); rollName(S); };
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
    const U = UI.menu(!!S.saved, S.meta.diff, S.meta.zoom, isFull(S), !!S.canQuit), b = D.hitUI(U, x, y); S.hover = b ? b.id : '';
    const order = U.map((q) => q.id);
    if (b && inp.moved) S.focus = b.id;
    if (order.includes(S.focus)) S.menuAt = S.focus;
    const at = order.indexOf(S.focus), mv = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    const press = (id) => {
      if (id === 'continue') resume(S, S.saved);
      if (id === 'load') openLoad(S);
      if (D.RUNS[id]) pressRun(S, id);
      if (id === 'news') openNews(S);
      if (id === 'settings') openSettings(S, 'menu');
      // «Выход» (TASKS 1877): a run still in play is saved first, as «Сохранить и выйти в меню» does; the page writes the save
      // and then closes the window on quitReq
      if (id === 'quit' && S.canQuit) { if (S.run) saveRun(S); S.quitReq = (S.quitReq || 0) + 1; S.saveN++; }
      if (id === 'stats') { S.screen = 'stats'; S.statTab = 'all'; S.focus = 'tab:all'; S.hover = ''; }
      ev(S, { k: 'ui', x, y }); };
    if (click && b && b.on) { S.focus = S.menuAt = b.id; press(b.id); return; }
    // the test runs are no item of the menu (TASKS 1878): ` opens them, as it opens the debug panel in play
    if (keys.Backquote) { S.screen = 'tests'; S.hover = ''; ev(S, { k: 'ui', x, y }); return; }
    // with no focus the first item already wears the seal, as Enter presses it, so the arrows go on from it (TASKS 1887 г)
    if (mv) { S.focus = order[((at < 0 ? 0 : at) + mv + order.length) % order.length]; ev(S, { k: 'ui', x, y }); return; }
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
  // the name's field in focus is the mode of typing (review of PR 63): neither the pointer nor W, A, S and D move the focus into
  // it or out of it, so a typed name is never lost to a passing pointer or written over by a walk. A click or an arrow lets it in;
  // a click elsewhere, ↑↓, Enter (on to «В путь») or Escape let it out. Off the field the pointer over it takes the keyboard's
  // focus away, so the field is lit as the pointer's alone, as every other control under the pointer is
  SCREEN.classes = (S, inp, keys, x, y, click) => {
    const U = UI.classes(S.meta), b = D.hitUI(U, x, y); S.hover = b ? b.id : '';
    let typing = S.focus === 'name';
    if (typing && click && !(b && b.id === 'name')) { S.focus = ''; typing = false; }
    if (b && inp.moved && !typing) S.focus = b.id === 'name' ? '' : b.id;
    const back = () => { S.screen = 'menu'; S.hover = ''; ev(S, { k: 'ui', x, y }); };
    if (typing) {
      if (typeName(S, inp.chars, keys)) ev(S, { k: 'ui', x, y });
      // Escape leaves the field and keeps the screen: going back to the menu would throw the typed name away. The keyboard goes
      // on to «В путь», lit, so the next Enter starts the run under the typed name; the die would throw it away (TASKS 1902)
      if (keys.Escape) { S.focus = 'go'; ev(S, { k: 'ui', x, y }); return; }
      if (keys.Enter) { S.focus = 'go'; ev(S, { k: 'ui', x, y }); return; }
    } else {
      if ((click && b && b.id === 'back') || keys.Escape || (keys.Enter && S.focus === 'back')) { back(); return; }
      // what is lit is what Enter presses (TASKS 1901): the field lit by the pointer takes the keyboard as a click would, and with
      // nothing lit Enter lights «В путь» before it starts anything
      if ((click && b && b.id === 'name') || (keys.Enter && !S.focus && S.hover === 'name')) { S.focus = 'name'; ev(S, { k: 'ui', x, y }); return; }
      if (keys.Enter && !S.focus && !click) { S.focus = 'go'; ev(S, { k: 'ui', x, y }); return; }
      if ((click && b && b.id === 'dice') || (keys.Enter && S.focus === 'dice')) { rollName(S); S.focus = 'dice'; ev(S, { k: 'ui', x, y }); return; }
      if ((click && b && b.id === 'go') || keys.Enter) { ev(S, { k: 'ui', x, y }); startRun(S, S.pendingMode || 'campaign'); return; }
      if (click && b && b.dif) { setDiff(S, b.dif); S.focus = b.id; ev(S, { k: 'ui', x, y }); }
      if (click && b && b.kit) { stepKit(S, b.kit, 1); setCls(S, b.kit); S.focus = b.id; ev(S, { k: 'ui', x, y }); }
      if (click && b && b.cls) { setCls(S, b.cls); S.focus = b.id; ev(S, { k: 'ui', x, y }); }
    }
    const cls = clsNow(S), ids = D.classesReady(), dif = D.DIFF_ORDER, row = (S.focus || '').split(':')[0];
    const rows = ['dif', 'cls'].concat(U.some((q) => q.id === 'kit:' + cls) ? ['kit'] : [], ['nm', 'btn']);
    // the focus taken off the field stays on its row
    const r0 = rows.includes(row) ? row : row === 'go' || row === 'back' ? 'btn' : row === 'name' || row === 'dice' || !row ? 'nm' : 'cls';
    const wasd = !typing, arV = keys.ArrowDown || keys.ArrowUp, arH = keys.ArrowLeft || keys.ArrowRight;
    const mv = (keys.ArrowDown || (wasd && keys.KeyS) ? 1 : 0) - (keys.ArrowUp || (wasd && keys.KeyW) ? 1 : 0), st = (keys.ArrowRight || (wasd && keys.KeyD) ? 1 : 0) - (keys.ArrowLeft || (wasd && keys.KeyA) ? 1 : 0);
    const at = (r) => (r === 'dif' ? 'dif:' + (S.meta.diff || 'normal') : r === 'btn' ? 'go' : r === 'nm' ? (arV ? 'name' : 'dice') : r + ':' + cls);
    if (mv) { S.focus = at(rows[Math.max(0, Math.min(rows.length - 1, rows.indexOf(r0) + mv))]); ev(S, { k: 'ui', x, y }); return; }
    if (!st) return;
    if (r0 === 'dif') { const i = dif.indexOf(S.meta.diff || 'normal'), d = dif[Math.max(0, Math.min(dif.length - 1, i + st))]; setDiff(S, d); S.focus = 'dif:' + d; }
    if (r0 === 'cls') { const c = ids[Math.max(0, Math.min(ids.length - 1, ids.indexOf(cls) + st))]; setCls(S, c); S.focus = 'cls:' + c; }
    if (r0 === 'kit') stepKit(S, cls, st);
    if (r0 === 'btn') S.focus = st > 0 ? 'go' : 'back';
    if (r0 === 'nm') S.focus = st > 0 ? 'dice' : arH ? 'name' : S.focus;
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
  // «Что нового» (TASKS 1038): the changelog scrolled by whole rows, the wheel and the arrows a row, a page a page; Escape goes back.
  // Every opening shows only the newest version's points (the player's decision 13.11.2026, TASKS 1971): the past ones wait folded
  // under their headers, and what was unfolded is not kept
  const openNews = (S) => { S.screen = 'news'; S.newsTop = 0; S.newsDrag = null; S.newsOpen = { [(D.CHANGES[0] || {}).v]: 1 }; };
  SCREEN.news = (S, inp, keys, x, y, click) => {
    const N = UI.news(S.newsTop, S.newsOpen), hd = D.hitUI(N.heads, x, y), b = D.hitUI(N.r, x, y) || hd, page = Math.max(1, N.rows.length - 2); S.hover = b ? b.id : '';
    if ((click && b && b.id === 'back') || keys.Escape) { S.screen = 'menu'; S.hover = ''; S.newsDrag = null; if (click) ev(S, { k: 'ui', x, y }); return; }
    if (click && hd) { const o = Object.assign({}, S.newsOpen); if (o[hd.v]) delete o[hd.v]; else o[hd.v] = 1; S.newsOpen = o;
      S.newsTop = UI.news(N.top, o).top; ev(S, { k: 'ui', x, y }); return; }
    // the thumb is taken where it was grabbed; a press on the track elsewhere brings the thumb's middle there and goes on dragging
    const B = N.bar;
    if (click && B && D.hitUI([B.track], x, y)) S.newsDrag = y >= B.thumb.y && y <= B.thumb.y + B.thumb.h ? y - B.thumb.y : B.thumb.h / 2;
    if (!inp.press || !B) S.newsDrag = null;
    if (S.newsDrag != null) { S.newsTop = Math.max(0, Math.min(N.max, Math.round((y - S.newsDrag - N.view.y) / (N.view.h - B.thumb.h) * N.max))); return; }
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
    // a choice for the whole run is taken on a second press of the same card (TASKS 1857): the first only lights it, Escape or a
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
    if (q && q.check && (keys.Enter || keys.Space) && setTo(S, q, 1 - stopOf(S, q))) ev(S, { k: 'ui', x, y });
    if (click && b) { S.focus = b.id; if (b.slider) S.drag = b.id; const cq = b.check && D.SETTINGS.find((o) => o.id === b.id); if (cq && setTo(S, cq, 1 - stopOf(S, cq))) ev(S, { k: 'ui', x, y }); }
    if (!inp.press) S.drag = '';
    const dq = S.drag && D.SETTINGS.find((o) => o.id === S.drag), r = dq && U.r.find((o) => o.id === S.drag);
    if (dq && setTo(S, dq, Math.round((x - r.x) / r.w * (dq.stops.length - 1)))) ev(S, { k: 'ui', x, y });
  };
  // a yes-or-no question (TASKS 1853, 1854): «Нет» is the focus it opens with, ←→ move it, Enter answers it, Escape says no
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
    if (click && b && b.id === 'save') { saveRun(S); S.screen = 'menu'; return; }
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
  // the button Enter presses (TASKS 1883): lit as «Остаться» at the gate, walked by ←→ on a page and ↑↓ in the topics; never the end of
  // the run, which only a click gives (TASKS 1854)
  const talkWalk = (T, U) => U.r.filter((q) => (T.menu ? q.id.startsWith('topic:') || q.id === 'next' : !q.id.startsWith('topic:') && !(q.id === 'act' && T.act.k === 'finish'))).sort((p, q) => (T.menu ? (p.id === 'next') - (q.id === 'next') : p.x - q.x)).map((q) => q.id);
  const talkFirst = (T, walk) => (T.menu ? walk[0] : walk.includes('act') ? 'act' : 'next');
  SCREEN.talk = (S, inp, keys, x, y, click) => {
    const T = S.talk, U = T && UI.talk(T), b = T && D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!T || !S.run || (keys.Escape && !T.inTopic)) { S.screen = 'play'; S.talk = null; S.focus = ''; return; }
    if (keys.Escape) { T.inTopic = 0; T.menu = 1; T.pages = ['']; T.p = 0; ev(S, { k: 'ui', x, y }); return; }
    if (T.pk !== T.pages[T.p]) { T.pk = T.pages[T.p]; T.pT = S.t; }
    const walk = talkWalk(T, U), fk = (T.menu ? 'menu' : T.p + ':' + (T.act ? T.act.k : '') + ':' + walk.join()) + ':' + T.pages[T.p];
    if (T.fk !== fk || !U.r.some((q) => q.id === S.focus)) { T.fk = fk; S.focus = talkFirst(T, walk); }
    // the pointer moves the focus only among the buttons Enter can press: over «Завершить поход» Enter would light the end of the run and do nothing
    if (b && inp.moved && walk.includes(b.id)) S.focus = b.id;
    if (inp.moved) T.byKeys = 0;
    const mv = T.menu ? (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0) : (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    if (mv) { T.byKeys = 1; const i = walk.indexOf(S.focus), j = Math.max(0, Math.min(walk.length - 1, (i < 0 ? 0 : i + mv))); if (walk[j] !== S.focus) { S.focus = walk[j]; ev(S, { k: 'ui', x, y }); } return; }
    const enter = keys.Enter ? S.focus : '';
    if ((click && b && b.id === 'craft') || enter === 'craft') { SIMX.openCraft(S, S.run, T.craft); return; }
    // in the topics menu a number, a click or Enter opens a topic; «Уйти», E or the space leave it
    if (T.menu) { const pick = T.topics.findIndex((q, i) => keys['Digit' + (i + 1)]), n = click && b && b.id.startsWith('topic:') ? b.i : enter.startsWith('topic:') ? +enter.slice(6) : pick; if (n >= 0) { T.pages = T.topics[n].a; T.p = 0; T.menu = 0; T.inTopic = 1; ev(S, { k: 'ui', x, y }); return; } if ((click && b && b.id === 'next') || keys.KeyE || keys.Space || enter === 'next') { S.screen = 'play'; S.talk = null; S.focus = ''; } return; }
    const last = T.p + 1 >= T.pages.length;
    // E run through the pages must never take a side quest or end the run (TASKS 1148, 1657), nor drop the offer unread (TASKS 1859):
    // on an offer's page E and the space do nothing, save the Keeper's first story quest, which E takes once the page has been up a breath.
    // The end of the run is never on Enter either, as at the town gate (TASKS 1854): only a click on «Завершить поход» ends it
    const quest = T.act && last && T.act.k === 'take', settled = S.t - (T.pT ?? S.t) >= TALK_SETTLE,
      byE = keys.KeyE && T.act && (T.act.k === 'turn' || (T.act.k === 'take' && T.act.first && settled)),
      byEnter = enter === 'act' && T.act && T.act.k !== 'finish';
    if (T.act && last && ((click && b && b.id === 'act') || byE || byEnter)) { talkAct(S, S.run, T); if (S.screen !== 'talk') S.focus = ''; return; }
    if (quest && (keys.KeyE || keys.Space)) return;
    if (((click && b && b.id === 'talk') || enter === 'talk') && T.topics) { T.menu = 1; T.pages = ['']; T.p = 0; T.act = null; T.craft = 0; ev(S, { k: 'ui', x, y }); return; }
    // a master's last page with no quest on it: E goes on into the workshop, so E, E still reaches the forge (TASKS 1635)
    if (T.craft && last && !T.act && !T.inTopic && keys.KeyE) { SIMX.openCraft(S, S.run, T.craft); return; }
    if ((click && b && b.id === 'next') || keys.KeyE || keys.Space || enter === 'next') { if (++T.p >= T.pages.length) { if (T.inTopic) { T.inTopic = 0; T.menu = 1; T.pages = ['']; T.p = 0; ev(S, { k: 'ui', x, y }); } else { S.screen = 'play'; S.talk = null; S.focus = ''; } } else ev(S, { k: 'ui', x, y }); }
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
  // a stack split (TASKS 1988): Shift+click asks how many, Shift+right click takes half at once. The part rides the pointer until the
  // next click lays it down; the source keeps it all till then. At the merchant the same question sells or buys that many
  const cellItem = (S, R, id) => { const [p, i] = id.split(':'), k = +i; return p === 'bag' || p === 'sell' ? R.hero.bag[k] : p === 'stash' ? stashOf(S).items[k] : p === 'buy' ? R.shop.goods[k] : null; };
  const stackOf = (S, R, id) => { const q = cellItem(S, R, id); return q && (q.it ? (q.n ? q : null) : isCons(q) && q.n > 1 ? q : null); };
  const splitOpen = (S, R, id, act, x, y) => { const q = stackOf(S, R, id); if (!q) return false; const it = q.it || q, h = R.hero;
    const hi = act === 'take' ? it.n - 1 : act === 'sell' ? it.n : Math.min(q.n, Math.floor(h.gold / q.price), SIMX.roomFor(h, it.b));
    if (act === 'buy' && hi < 1) { buy(S, R, q, 0); return true; }
    S.split = { id, key: it.id, act, hi, n: act === 'take' ? Math.ceil(it.n / 2) : 1 }; S.focus = 'spOk'; S.hover = ''; ev(S, { k: 'ui', x, y }); return true; };
  const carry = (S, R, id, n, x, y) => { S.drag = { from: id, x, y, n, carry: 1 }; ev(S, { k: 'ui', x, y }); };
  const halfOff = (S, R, id, x, y) => { const q = stackOf(S, R, id); if (!q || q.it) return false; carry(S, R, id, Math.ceil(q.n / 2), x, y); return true; };
  // true while the question is up: it takes the step's input
  function splitStep(S, R, inp, keys, x, y, click) { const A = S.split; if (!A) return false; const q = cellItem(S, R, A.id), it = q && (q.it || q);
    if (!it || it.id !== A.key) { S.split = null; S.focus = ''; return true; }
    const U = UI.split(), b = D.hitUI(U.r, x, y), P = U.A; S.hover = b ? b.id : '';
    const d = (b && click && b.id === 'spPlus' ? 1 : 0) - (b && click && b.id === 'spMinus' ? 1 : 0) - (inp.wheel || 0) + (keys.ArrowRight || keys.ArrowUp ? 1 : 0) - (keys.ArrowLeft || keys.ArrowDown ? 1 : 0);
    if (d) { const n = Math.max(1, Math.min(A.hi, A.n + d)); if (n !== A.n) { A.n = n; ev(S, { k: 'ui', x, y }); } }
    const out = click && !(x >= P.x && x < P.x + P.w && y >= P.y && y < P.y + P.h);
    if (keys.Escape || out || (click && b && b.id === 'spNo')) { S.split = null; S.focus = ''; ev(S, { k: 'ui', x, y }); return true; }
    if (keys.Enter || (click && b && b.id === 'spOk')) { S.split = null; S.focus = '';
      if (A.act === 'take') carry(S, R, A.id, A.n, x, y); else if (A.act === 'sell') sell(S, R, +A.id.split(':')[1], A.n); else buy(S, R, q, 0, A.n); }
    return true; }
  // the part held is laid down by the next click: a free cell or a stack of its kind takes it, another piece refuses it; Esc or the
  // right button, a click on its own cell or off the cells put it back
  function dropPart(S, R, A, k, B, j, n, x, y) { if (!B) return; if (j < 0) { ev(S, { k: 'nope', x, y, s: TXT('sim_ui.inv.full') }); return; }
    const o = B[j]; if (o && o.b === A[k].b && o.n >= D.CONSUMABLES[o.b].stack) { ev(S, { k: 'nope', x, y, s: TXT('sim_ui.split.full') }); return; }
    if (!SIMX.movePart(R, A, k, B, j, n)) { ev(S, { k: 'nope', x, y, s: TXT('sim_ui.split.busy') }); return; }
    S.saveN++; ev(S, { k: 'equip', x: R.hero.x, y: R.hero.y }); }
  // the carried part's step in a window: true while it is held; arrOf gives the list and cell for a target cell, or null
  function carryStep(S, R, inp, keys, x, y, click, b, arrOf) { const dr = S.drag; if (!dr || !dr.carry) return false;
    dr.x = x; dr.y = y; const src = arrOf(dr.from), it = src && src[0][src[1]];
    if (!it || keys.Escape || inp.rclick) { S.drag = null; return true; }
    if (!click) return true; S.drag = null;
    if (!b || b.id === dr.from) return true;
    if (b.tab !== undefined) { dropPart(S, R, src[0], src[1], R.hero.bag, freeIn(R.hero, b.tab), dr.n, x, y); return true; }
    if (b.id.startsWith('eq:')) { ev(S, { k: 'nope', x, y, s: TXT('sim_ui.inv.cons') }); return true; }
    const to = arrOf(b.id); if (to) dropPart(S, R, src[0], src[1], to[0], to[1], dr.n, x, y); return true; }
  SCREEN.stash = (S, inp, keys, x, y, click) => {
    const R = S.run, U = R && UI.stash(R.hero.bag.length, S.bagTab), b = U && D.hitUI(U.r, x, y), n = D.STASH.cells; S.hover = b ? b.id : '';
    if (!R || ((keys.Escape || keys.KeyE) && !S.split && !(S.drag && S.drag.carry)) || (click && b && b.id === 'close' && !S.split)) { S.screen = 'play'; S.drag = null; S.split = null; return; }
    const T = stashOf(S);
    if (splitStep(S, R, inp, keys, x, y, click)) return;
    if (carryStep(S, R, inp, keys, x, y, click, b, (id) => { const [p, i] = id.split(':'), k = +i; return p === 'bag' && k < R.hero.bag.length ? [R.hero.bag, k] : p === 'stash' && k < n ? [T.items, k] : null; })) return;
    if (b && !S.drag && inp.shift && (b.id.startsWith('bag:') || b.id.startsWith('stash:')) && ((click && splitOpen(S, R, b.id, 'take', x, y)) || (inp.rclick && halfOff(S, R, b.id, x, y)))) return;
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
  // (TASKS 1854): «Остаться» in focus, so Enter alone never ends the run
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
    const R = S.run, sh = R.shop;
    if (S.sellAsk) { const a = askAnswer(S, UI.sellAsk(), keys, x, y, click, inp.moved), A = S.sellAsk, it = R.hero.bag[A.i];
      if (a) { S.sellAsk = null; S.focus = ''; S.hover = ''; if (a > 0 && it && it.id === A.id) sell(S, R, A.i); else ev(S, { k: 'ui', x, y }); }
      return; }
    if (splitStep(S, R, inp, keys, x, y, click)) return;
    const U = UI.shop(sh.goods.length, R.hero.bag.length, S.bagTab), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (keys.Escape || keys.KeyE || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    if (click && b && inp.shift && ((b.id.startsWith('sell:') && splitOpen(S, R, b.id, 'sell', x, y)) || (b.id.startsWith('buy:') && splitOpen(S, R, b.id, 'buy', x, y)))) return;
    if (inp.rclick && b && b.id.startsWith('sell:')) { sellAsk(S, R, b.i, x, y); return; }
    if (!click || !b) return;
    if (b.id === 'talk' && !sh.wander) { S.talk = { role: 'merchant', i: 0, pages: [''], p: 0, act: null, topics: D.FOLK.merchant.topics, menu: 1 }; S.screen = 'talk'; S.hover = ''; ev(S, { k: 'ui', x, y }); return; }
    if (b.id.startsWith('buy:') && sh.goods[b.i]) buy(S, R, sh.goods[b.i], 0);
    if (b.id.startsWith('back:') && sh.back[b.i]) buy(S, R, sh.back[b.i], 1);
    if (b.tab !== undefined) tabClick(S, b, x, y);
    if (b.id.startsWith('sell:')) sellAsk(S, R, b.i, x, y);
    return;
  };
  // a legendary or better asks first (TASKS 1863 г, 1978): the merchant buys it back only while it is among his last few
  const sellAsk = (S, R, i, x, y) => { const it = R.hero.bag[i]; if (!it) return;
    if ((it.rar || 0) < 4) sell(S, R, i); else { S.sellAsk = { i, id: it.id }; S.focus = 'sellNo'; S.hover = ''; ev(S, { k: 'ui', x, y }); } };
  // one way out of every window (TASKS 1863 д): Esc or the key that opened it, and its own button; the talk alone keeps E for its pages
  // the notice board (TASKS 1033): E or Esc closes it, a row's button takes its quest
  // the rows stand as the board opened until it closes (TASKS 1885): a taken one stays in place with its button out, so the rows
  // under it never slide up under the pointer and a second click takes nothing
  SCREEN.board = (S, inp, keys, x, y, click) => {
    const R = S.run; if (R && !S.bdRows) { S.bdRows = boardRows(R); S.bdTook = []; }
    const L0 = S.bdRows || [], U = UI.board(L0.length), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!R || keys.Escape || keys.KeyE || (click && b && b.id === 'close')) { S.screen = 'play'; S.bdRows = null; S.bdTook = null; return; }
    if (click && b && b.id.startsWith('take:') && L0[b.i] && !S.bdTook.includes(b.i) && giveQuest(S, R, L0[b.i].role)) S.bdTook.push(b.i);
    return;
  };
  const boardRows = (R) => boardOffers(R).map(({ role, of }) => ({ role, q: JSON.parse(JSON.stringify(of.q)) }));
  // the quest journal (TASKS 1023): J or Esc closes it, a click picks a quest to read
  SCREEN.journal = (S, inp, keys, x, y, click) => {
    const R = S.run, L0 = R ? journalOf(R) : [], si = Math.max(0, L0.findIndex((q) => q.id === S.jsel));
    // the wheel scrolls the list and drags the chosen quest along at its edge, so the chosen one never leaves it (TASKS 1884)
    let top = UI.journalTop(L0.length, si, S.jtop); if (inp.wheel && L0.length > 10) { top = Math.max(0, Math.min(L0.length - 9, top + inp.wheel)); const k = Math.max(top, Math.min(top + 8, si)); if (k !== si) { S.jsel = L0[k].id; S.jdrop = 0; } }
    S.jtop = top;
    const sel = L0.find((q) => q.id === S.jsel) || L0[0], U = UI.journal(L0.length, sel && sel.st === 'taken', top), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
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
  // a press asked twice (TASKS 1863 в, г): true on the second within 3 s on the same piece, else it arms and the caller says why
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
    if (splitStep(S, R, inp, keys, x, y, click)) return;
    if (carryStep(S, R, inp, keys, x, y, click, b, (id) => { const [p, i] = id.split(':'), k = +i; return p === 'bag' && k < h.bag.length ? [h.bag, k] : null; })) return;
    if (keys.Escape || keys.KeyI || keys.KeyC || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; S.drag = null; return; }
    if (b && !S.drag && inp.shift && b.id.startsWith('bag:') && ((click && splitOpen(S, R, b.id, 'take', x, y)) || (inp.rclick && halfOff(S, R, b.id, x, y)))) return;
    if (click && b && (b.id.startsWith('bag:') ? h.bag[b.i] : b.id.startsWith('eq:') && h.eq[b.slot])) S.drag = { from: b.id, x, y };
    if (S.drag && inp.press) { S.drag.x = x; S.drag.y = y; return; }
    if (S.drag) { dropInv(S, R, h, b); return; }
    if (!b) return;
    if (click && b.tab !== undefined) { tabClick(S, b, x, y); return; }
    if (click && b.id.startsWith('sort:')) { sortTab(S, h, b.k); S.saveN++; ev(S, { k: 'ui', x, y }); }
    // the right button is each window's quick action on a bag piece (TASKS 1863 в): here it throws it away, on a second press, as a
    // legendary is sold, for a piece on the floor of a cave is as good as lost
    if (inp.rclick && b.id.startsWith('bag:') && h.bag[b.i]) { const it = h.bag[b.i];
      if (again(S, 'toss', it)) { h.bag[b.i] = null; throwAway(R, h, it); ev(S, { k: 'toss', x: h.x, y: h.y }); } else ev(S, { k: 'ask', x, y, s: TXT('sim_ui.inv.tossAsk', { p1: SIMX.itemName(it) }) }); }
    if (click && b.id.startsWith('stat:') && h.pts > 0) { const d = draftOf(h); d.thTip = d.thTip ?? (h.thTip || 0); h.base[b.k]++; h.pts--; d.st[b.k] = (d.st[b.k] || 0) + 1;
      const st = heroSt(S), hp0 = h.hp, mp0 = h.mp; if (b.k === 'vit') h.hp = Math.min(st.maxHp, h.hp + 10); if (b.k === 'int') h.mp = Math.min(st.maxMp, h.mp + 6);
      d.hp += h.hp - hp0; d.mp += h.mp - mp0; ev(S, { k: 'buy', x, y }); SIMX.thresholdTip(S, R); }
    if (click && b.id === 'reset:st' && h.draft && draftHas(h.draft.st)) { resetDraft(S, h, 'st'); ev(S, { k: 'ui', x, y }); }
    if (click && b.id === 'reset:ab' && h.draft && (draftHas(h.draft.ab) || h.draft.mast)) { resetDraft(S, h, 'ab'); ev(S, { k: 'ui', x, y }); }
    if (click && b.id.startsWith('ab:') && D.forkPending(h)) { toFork(S); return; }
    if (click && b.id.startsWith('ab:') && h.sp > 0) { const A = D.clsOf(h).abs.find((a) => a.id === b.ab); if (h.lvl >= A.unlock && (h.ab[b.ab] || 0) < D.AB_MAX) { const d = draftOf(h), m0 = h.mast || 0;
      h.ab[b.ab] = (h.ab[b.ab] || 0) + 1; h.sp--; d.ab[b.ab] = (d.ab[b.ab] || 0) + 1; D.masteryTake(h); d.mast += (h.mast || 0) - m0; ev(S, { k: 'buy', x, y }); if (D.forkPending(h)) toFork(S); } }
  };
  // points put in on one visit to the hero's page stay a draft until the page closes (TASKS 1857): base, ranks and health carry them
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
  // the screens the menu opens: back from one of them the menu's focus returns to the item that opened it (TASKS 1860); back from
  // a run it starts again from none, the first item (the run just saved), not the item that started the run long ago
  const MENU_SUBS = ['load', 'stats', 'settings', 'news', 'tests', 'classes'];
  // moved: the pointer moved since the last step, and only then takes the focus onto what it is over (TASKS 1754), so a pointer
  // resting over an item does not take it back from the keyboard. A window or question just opened never counts it (review of
  // PR 57): a pointer left over «Сдаться» took the gate's focus off «Остаться» as the window came up, and Enter gave the run up
  const uiKey = (S) => [S.screen, S.newAsk || '', S.delAsk ?? '', S.pauseAsk || ''].join(':');
  function stepUI(S, inp, keys) {
    const f = SCREEN[S.screen], moved = !!inp.moved && S.uiKey === uiKey(S), py = S.uiPtr ? S.uiPtr[1] : inp.py - SIMX.uiDy(S.screen);
    if (S.screen === 'menu' && S.uiWas !== 'menu') S.focus = MENU_SUBS.includes(S.uiWas) && S.menuAt ? S.menuAt : '';
    S.uiWas = S.screen; if (f) f(S, Object.assign({}, inp, { moved, py }), keys, inp.px, py, inp.click); S.uiKey = uiKey(S); commitDraft(S);
  }

  Object.assign(SIMX, { talkWalk, talkFirst, boardRows,
    endRun, finishRun, descend, begin, startRun, stepUI, typing, rollName, clsNow, commitDraft, loadSaves, slotRun, isFull, oldestSlot, loadSlot, dropSlot });
})(typeof window !== 'undefined' ? window : globalThis);
