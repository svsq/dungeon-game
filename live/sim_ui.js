// live/sim_ui.js — the run's end, descending, and the menus and screens (stepUI).
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const {
    BASES, D, DT, FROM, abandonQuest, campaignDone, META, REWARD, RUN, UI, bagAdd, boardOffers, buy, craft, donate, enterFloor, ev, gateGo, gateWays,
    gearName, giveQuest, heroSt, journalOf, newRun, nextZoom, potCount, runReward, sell, stashOf, stashPut, stashTake, takeGift, talkAct,
    throwAway, useItem } = SIMX;
  // ---------------- run end / menus ----------------
  function endRun(S, how) {
    const R = S.run; if (!R) return;
    const W2 = runReward(R, how), bonus = W2.base + W2.bonus;
    S.meta.shards += bonus; S.meta.runs = (S.meta.runs || 0) + 1; if (how === 'win' && !R.campaignWon) S.meta.wins = (S.meta.wins || 0) + 1;
    // what the Keeper of the Fire will speak of to the next hero (TASKS 1016)
    if (how === 'dead' && !(R.log && R.log.abandon)) S.meta.deaths = (S.meta.deaths || 0) + 1; S.meta.lastEnd = R.log && R.log.abandon ? 'abandon' : how; S.meta.endTold = 0; S.meta.lastCls = D.clsOf(R.hero).id;
    // the records are the deepest floor reached, not the one the run ended on (TASKS 516: down to the 17th, back up to the 16th)
    const deep = Math.max(R.deepest || 0, R.floor);
    if (RUN(R) === D.RUNS.campaign) S.meta.best = Math.max(S.meta.best || 0, deep);
    // the endless descent's record depth (TASKS 348)
    const deepBest = S.meta.bestEndless || 0; if (RUN(R).endless) S.meta.bestEndless = Math.max(deepBest, deep);
    S.result = { how, mode: R.mode, floor: R.floor, deepest: deep, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, shards: R.shards + bonus, found: R.shards, base: W2.base, statBonus: W2.bonus, cap: W2.cap,
      C: W2.C, win: how === 'win' && !R.campaignWon ? REWARD.win : 0, time: R.play || 0, donations: R.donations || 0,
      damage: (R.recentDamage || []).slice(-3), abandoned: !!(R.log && R.log.abandon), record: RUN(R).endless ? { best: S.meta.bestEndless, fresh: deep > deepBest } : undefined, campaignWon: R.campaignWon ? 1 : 0, town: R.viaTown ? 1 : 0, hero: JSON.parse(JSON.stringify(R.hero)), heroStats: heroSt(S) };
    if (R.log) { R.log.end = { how: R.log.abandon ? 'abandon' : how, time: R.play || 0, floor: R.floor, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, cause: how === 'dead' ? R.log.last || null : null, bag: potCount(R.hero), tail: R.log.tail || [], done: R.stats || {}, pct: W2.C.pct };   // done: per floor kills/foes, loot/lootN, sec/secN
      S.result.log = R.log; S.logN = (S.logN || 0) + 1; }
    S.run = null; S.saved = null; S.screen = how; S.saveN++;
  }
  // the run ended alive past the campaign's last boss (TASKS 1148): a win, the campaign's if not won yet at the stairs on
  function finishRun(S) { S.talk = null; S.screen = 'play'; endRun(S, 'win'); }
  // a hero who starts above level 1 opens on the hero screen, his points still to lay out
  // past the serpent, down the stairs (TASKS 354): the campaign is won on the spot — its reward (gold and the win's shards), a win,
  // its record — and the same run goes on as the endless descent from the 13th, the hero as he is; the descent's depth is its record
  function descend(S, R) {
    const W2 = runReward(R, 'win'); S.meta.shards += W2.base; S.meta.wins = (S.meta.wins || 0) + 1; S.meta.best = Math.max(S.meta.best || 0, R.floor);
    R.goldBanked = R.goldTot; R.campaignWon = 1; R.mode = RUN(R).then; S.saveN++;
    ev(S, { k: 'stairs', x: R.hero.x, y: R.hero.y, floor: R.floor }); enterFloor(S, R, R.floor + 1);
    R.msg = { s: TXT('sim_ui.descend.msg.s', { base: W2.base, floor: R.floor, p3: D.floorName(R.floor, R.mode, R.seed, FROM(R)) }), t: S.t, d: 5 }; }
  // the checks of the dungeon's own workings start from the menu as before and play its 1st floor laid out without the town (a
  // merchant on the floor, no stairs up), the run's seed kept (TASKS 1026: the campaign itself now starts in the town)
  const begin = (S) => { const c = UI.menu(!!S.saved).find((b) => b.id === 'campaign'); SIMX.step(S, { keys: [], px: c.x + c.w / 2, py: c.y + c.h / 2, click: 1 }); if (S.screen === 'classes') startRun(S, S.pendingMode); if (S.run && S.run.town) { S.run = newRun(S, 'campaign', S.run.seed); S.screen = 'play'; } };
  // the campaign starts in the town (TASKS 1026); the test runs (the caves, the magma caves, the endless descent) as before
  function startRun(S, mode = 'campaign') { const seed = (S.seedBase + S.meta.runs * 7777 + Math.floor(S.t * 1000)) >>> 0, town = mode === 'town' || mode === 'campaign'; S.run = newRun(S, town ? 'campaign' : mode, seed, { town }); S.saved = null;
    S.screen = S.run.hero.pts > 0 && RUN(S.run).lvl > 1 ? 'inv' : 'play'; }

  // a new run from the menus (TASKS 1103): with more than one class ready the class screen comes first, its run waiting in pendingMode
  const chooseRun = (S, mode = 'campaign') => { if (D.classesReady().length > 1) { S.pendingMode = mode; S.screen = 'classes'; S.hover = ''; } else startRun(S, mode); };
  // a saved run is dropped only on a second press of the same run's button
  const pressRun = (S, id, arm) => { if (!S.saved || arm === id) { S.resetT = undefined; chooseRun(S, id); } else { S.resetT = S.t; S.resetM = id; } };
  // each screen's input, by S.screen: one function a screen (dead and win share one)
  const SCREEN = {};
  SCREEN.menu = (S, inp, keys, x, y, click) => {
    const arm = S.resetT !== undefined && S.t - S.resetT < 3 && S.resetM, b = D.hitUI(UI.menu(!!S.saved, S.meta.diff, arm, S.meta.zoom, S.saved && S.saved.town), x, y); S.hover = b ? b.id : '';
    if (click && b && b.on) {
      if (b.id === 'continue') { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; S.run.msg = { s: D.placeName(S.run.floor, S.run.mode, S.run.seed, FROM(S.run), S.run.map), t: S.t }; }
      if (D.RUNS[b.id]) pressRun(S, b.id, arm);
      if (b.id === 'tests') S.screen = 'tests';
      if (b.id === 'news') { S.screen = 'news'; S.newsTop = 0; }
      if (b.id === 'diff') { const o = D.DIFF_ORDER; S.meta.diff = o[(o.indexOf(S.meta.diff || 'normal') + 1) % o.length]; S.saveN++; }
      if (b.id === 'zoom') nextZoom(S);
      if (b.id === 'town') { if (S.saved) { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; S.run.msg = { s: D.placeName(S.run.floor, S.run.mode, S.run.seed, FROM(S.run), S.run.map), t: S.t }; } else chooseRun(S); }
      ev(S, { k: 'ui', x, y });
    }
    if (keys.Enter) { if (S.saved) { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; } else chooseRun(S); }
    return;
  };
  // the test runs' screen (TASKS 417): each starts its run as the main menu's buttons did; «Назад» or Escape go back
  SCREEN.tests = (S, inp, keys, x, y, click) => {
    const arm = S.resetT !== undefined && S.t - S.resetT < 3 && S.resetM, b = D.hitUI(UI.tests(!!S.saved, arm), x, y); S.hover = b ? b.id : '';
    if ((click && b && b.id === 'back') || keys.Escape) { S.screen = 'menu'; S.hover = ''; if (click) ev(S, { k: 'ui', x, y }); return; }
    if (click && b && b.on) { pressRun(S, b.id, arm); ev(S, { k: 'ui', x, y }); }
    return;
  };
  // the class screen (TASKS 1103): a card picks the class (kept in the meta for the next time), «В путь» or Enter starts the run the
  // menu asked for, «Назад» or Escape go back to the menu
  SCREEN.classes = (S, inp, keys, x, y, click) => {
    const b = D.hitUI(UI.classes(), x, y); S.hover = b ? b.id : '';
    if ((click && b && b.id === 'back') || keys.Escape) { S.screen = 'menu'; S.hover = ''; if (click) ev(S, { k: 'ui', x, y }); return; }
    if (click && b && b.cls) { if (S.meta.cls !== b.cls) { S.meta.cls = b.cls; S.saveN++; } ev(S, { k: 'ui', x, y }); }
    if ((click && b && b.id === 'go') || keys.Enter) { ev(S, { k: 'ui', x, y }); startRun(S, S.pendingMode || 'campaign'); }
    return;
  };
  // «Что нового» (TASKS 1038): the changelog scrolled by whole rows, the wheel and the arrows a row, a page a page; Escape goes back
  SCREEN.news = (S, inp, keys, x, y, click) => {
    const N = UI.news(S.newsTop), b = D.hitUI(N.r, x, y), page = Math.max(1, N.rows.length - 2); S.hover = b ? b.id : '';
    if ((click && b && b.id === 'back') || keys.Escape) { S.screen = 'menu'; S.hover = ''; if (click) ev(S, { k: 'ui', x, y }); return; }
    const d = (inp.wheel || 0) + (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0) + (keys.PageDown ? page : 0) - (keys.PageUp ? page : 0) + (keys.End ? N.n : 0) - (keys.Home ? N.n : 0);
    if (d) S.newsTop = Math.max(0, Math.min(N.max, N.top + d));
  };
  SCREEN.meta = (S, inp, keys, x, y, click) => {
    const bs = UI.meta(S.meta.cls), b = D.hitUI(bs, x, y); S.hover = b ? b.id : '';
    if ((click && b && b.id === 'back') || keys.Escape || (S.metaRun && keys.KeyE)) { S.screen = S.metaRun && S.run ? 'play' : 'menu'; S.metaRun = 0; return; }
    if (click && b) { const M = META.find((q) => q.id === b.id); if (M) { const r = S.meta.up[M.id] || 0, c = M.cost(r);
      if (r < M.max && S.meta.shards >= c) { S.meta.shards -= c; S.meta.up[M.id] = r + 1; S.saveN++; ev(S, { k: 'buy', x, y, id: M.id }); } else ev(S, { k: 'nope', x, y, s: r >= M.max ? TXT('sim_ui.meta.s') : TXT('sim_ui.meta.s.2') }); } }
    return;
  };
  SCREEN.pause = (S, inp, keys, x, y, click) => {
    const b = D.hitUI(UI.pause(S.meta.zoom, !!S.run && campaignDone(S.run)), x, y); S.hover = b ? b.id : '';
    if (click && b && b.id === 'zoom') { nextZoom(S); S.run.zoom = S.meta.zoom; ev(S, { k: 'ui', x, y }); return; }
    if (keys.Escape || (click && b && b.id === 'resume')) { S.screen = 'play'; return; }
    if (click && b && b.id === 'save') { S.saved = S.run; S.run = null; S.screen = 'menu'; S.saveN++; return; }
    if (click && b && b.id === 'finish') { finishRun(S); return; }
    if (click && b && b.id === 'abandon') { if (S.run.log) S.run.log.abandon = 1; endRun(S, 'dead'); return; }
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
  SCREEN.talk = (S, inp, keys, x, y, click) => {
    const T = S.talk, b = T && D.hitUI(UI.talk(T).r, x, y); S.hover = b ? b.id : '';
    if (!T || !S.run || keys.Escape) { S.screen = 'play'; S.talk = null; return; }
    if (click && b && b.id === 'craft') { S.talk = null; S.screen = 'craft'; S.craft = { kind: 'forge', sel: S.craft && S.craft.kind === 'forge' ? S.craft.sel : null }; S.hover = ''; ev(S, { k: 'ui', x, y }); return; }
    // on a quest's last page E, the space or Enter press its button; «Дальше» / «Не сейчас» leave it
    const last = T.p + 1 >= T.pages.length; if (last && T.pt === undefined) T.pt = S.t;
    // (the end of the run, TASKS 1148, only by its button or Enter: E run through the Keeper's pages must not end it)
    // a quest's taking waits a moment after its last page opens: E run through the pages must not take it (TASKS 1635); the space only turns pages and closes
    const take = T.act && T.act.k === 'take', ready = keys.KeyE && (!take || S.t - T.pt >= 0.25);
    if (take && last && keys.KeyE && !ready) return;
    if (T.act && last && ((click && b && b.id === 'act') || (ready && T.act.k !== 'finish') || keys.Enter)) { talkAct(S, S.run, T); delete T.pt; return; }
    if ((click && b && b.id === 'next') || keys.KeyE || keys.Space || keys.Enter) { if (++T.p >= T.pages.length) { S.screen = 'play'; S.talk = null; } else ev(S, { k: 'ui', x, y }); }
    return;
  };
  SCREEN.craft = (S, inp, keys, x, y, click) => {
    const R = S.run, U = UI.craft(), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!R || !S.craft || keys.Escape || keys.KeyE || keys.KeyI || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    // the smith's quest business, kept off E so that E always reaches the forge (TASKS 1635)
    if (S.craft.kind === 'forge' && SIMX.questMark(R, 'smith') && (keys.Enter || (click && b && b.id === 'talk'))) { const sm = SIMX.folkOf(R).find((q) => q.role === 'smith'); if (sm) { SIMX.openTalk(S, R, sm); ev(S, { k: 'ui', x, y }); return; } }
    if (click && b && (b.id.startsWith('eq:') || b.id.startsWith('bag:'))) { const it = b.id.startsWith('eq:') ? R.hero.eq[b.slot] : R.hero.bag[b.i];
      if (it && BASES[it.b]) { S.craft.sel = b.id; S.craft.res = null; ev(S, { k: 'ui', x, y }); } else if (it) ev(S, { k: 'nope', x, y, s: TXT('sim_ui.craft.s') }); }
    if (click && b && b.id === 'do') craft(S, R);
    return;
  };
  SCREEN.stash = (S, inp, keys, x, y, click) => {
    const R = S.run, U = UI.stash(), b = D.hitUI(U.r, x, y), n = D.STASH.cells; S.hover = b ? b.id : '';
    if (!R || keys.Escape || keys.KeyE || keys.KeyI || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; S.drag = null; return; }
    const T = stashOf(S);
    if (click && b && ((b.id.startsWith('bag:') && R.hero.bag[b.i]) || (b.id.startsWith('stash:') && T.items[b.i]))) S.drag = { from: b.id, x, y };
    if (S.drag && inp.press) { S.drag.x = x; S.drag.y = y; }
    else if (S.drag) { const from = S.drag.from, k = +from.split(':')[1], to = b && b.id !== from ? b : null; S.drag = null;
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
  // the town's gate out (TASKS 1149): give up the run, or past the campaign's last boss end it won; only by its button or Enter
  SCREEN.leave = (S, inp, keys, x, y, click) => {
    const R = S.run, U = UI.leave(), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!R || keys.Escape || keys.KeyE || (click && b && b.id === 'stay')) { S.screen = 'play'; return; }
    if ((click && b && b.id === 'go') || keys.Enter) { if (campaignDone(R)) finishRun(S); else { if (R.log) R.log.abandon = 1; endRun(S, 'dead'); } }
    return;
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
    const R = S.run, sh = R.shop, U = UI.shop(sh.goods.length), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (keys.Escape || keys.KeyE || keys.KeyI || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    if (!click || !b) return;
    if (b.id.startsWith('buy:') && sh.goods[b.i]) buy(S, R, sh.goods[b.i], 0);
    if (b.id.startsWith('back:') && sh.back[b.i]) buy(S, R, sh.back[b.i], 1);
    if (b.id.startsWith('sell:')) sell(S, R, b.i);
    return;
  };
  // the notice board (TASKS 1033): E or Esc closes it, a row's button takes its quest
  SCREEN.board = (S, inp, keys, x, y, click) => {
    const R = S.run, L0 = R ? boardOffers(R) : [], U = UI.board(L0.length), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!R || keys.Escape || keys.KeyE || keys.KeyJ || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    if (click && b && b.id.startsWith('take:') && L0[b.i]) giveQuest(S, R, L0[b.i].role);
    return;
  };
  // the quest journal (TASKS 1023): J or Esc closes it, a click picks a quest to read
  SCREEN.journal = (S, inp, keys, x, y, click) => {
    const R = S.run, L0 = R ? journalOf(R) : [], sel = L0.find((q) => q.id === S.jsel) || L0[0], U = UI.journal(L0.length, sel && sel.st === 'taken'), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (!R || keys.Escape || keys.KeyJ || keys.KeyI || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    if (click && b && b.id.startsWith('q:') && L0[b.i]) { S.jsel = L0[b.i].id; S.jdrop = 0; ev(S, { k: 'ui', x, y }); }
    // given up only on a second press, as a saved run is dropped: nothing brings a quest back but its giver (TASKS 1633)
    if (click && b && b.id === 'drop' && sel) { if (S.jdrop === sel.id && S.t - S.jdropT < 3) { S.jdrop = 0; abandonQuest(S, R, sel); } else { S.jdrop = sel.id; S.jdropT = S.t; ev(S, { k: 'ui', x, y }); } }
    return;
  };
  SCREEN.inv = (S, inp, keys, x, y, click) => {
    const R = S.run, h = R.hero, U = UI.inv(D.clsOf(h).abs), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
    if (keys.Escape || keys.KeyI || keys.KeyC || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
    if (!b) return;
    if (click && b.id.startsWith('bag:')) useItem(S, R, b.i);
    if (click && b.id.startsWith('eq:')) { const it = h.eq[b.slot]; if (it && bagAdd(R, it)) { h.eq[b.slot] = null; const st = heroSt(S); h.hp = Math.min(h.hp, st.maxHp); h.mp = Math.min(h.mp, st.maxMp); ev(S, { k: 'unequip', x: h.x, y: h.y, slot: b.slot, off: gearName(it) }); } }
    if (inp.rclick && b.id.startsWith('bag:') && h.bag[b.i]) { const it = h.bag[b.i]; h.bag[b.i] = null; throwAway(R, h, it); ev(S, { k: 'toss', x: h.x, y: h.y }); }
    if (click && b.id.startsWith('stat:') && h.pts > 0) { h.base[b.k]++; h.pts--; if (b.k === 'vit') h.hp += 10; if (b.k === 'int') h.mp += 6; ev(S, { k: 'buy', x, y }); }
    if (click && b.id.startsWith('ab:') && h.sp > 0) { const A = D.clsOf(h).abs.find((a) => a.id === b.ab); if (h.lvl >= A.unlock && (h.ab[b.ab] || 0) < D.AB_MAX) { h.ab[b.ab] = (h.ab[b.ab] || 0) + 1; h.sp--; ev(S, { k: 'buy', x, y }); } }
  };
  function stepUI(S, inp, keys) {
    const f = SCREEN[S.screen];
    if (f) f(S, inp, keys, inp.px, inp.py, inp.click);
  }

  Object.assign(SIMX, {
    endRun, finishRun, descend, begin, startRun, stepUI });
})(typeof window !== 'undefined' ? window : globalThis);
