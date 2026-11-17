// live/sim_checks_ui.js — selfCheck's parts for the menus, settings and windows (the review of PR 57 and on). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    BASES, begin, castAbility, D, DG, DT, endRun, itemMods, itemPower, K, killEnemy, newRun, persist, RARITY, rebalanceRun, rollItem, spawn, startRun,
    stats, step, TILE, typeMods, UI } = SIMX;
  const { fight, noWelcome } = SIMX.checks.kit;
  const mid = (S, b) => ({ px: b.x + b.w / 2, py: b.y + b.h / 2 + SIMX.uiDy(S.screen) });
  const press = (S, b) => { const p = mid(S, b); step(S, Object.assign({ keys: [], click: 1, press: 1 }, p)); step(S, Object.assign({ keys: [] }, p)); };
  const townRun = () => { const S = spawn(0, {}); press(S, UI.menu(false).find((b) => b.id === 'campaign')); if (S.screen === 'classes') press(S, UI.classes(S.meta).find((b) => b.id === 'go')); if (S.run) S.run.greet = 'done'; return S; };
  function checkGateFocus(out) {
    const S = townRun(), R = S.run, g = R.map.town.svc.exitGate, P = mid({ screen: 'leave' }, UI.leave().r[0]), at = (keys) => step(S, Object.assign({ keys }, P));
    for (let i = 0; i < 30; i++) at([]);
    R.hero.x = g.x; R.hero.y = g.y; at([]); at(['KeyE']); at([]);
    if (S.screen !== 'leave' || S.focus !== 'stay') out.push(`gate: a pointer resting over the give-up button since play takes the focus as the window opens (${S.screen}, ${S.focus})`);
    at(['Enter']); if (S.screen !== 'play' || S.run !== R) out.push('gate: Enter right after the window opened over a resting pointer gives the run up');
    const T = spawn(0, {}), U = UI.menu(false, T.meta.diff, T.meta.zoom), st = U.find((b) => b.id === 'stats'); step(T, Object.assign({ keys: [] }, mid(T, st)));
    if (T.focus === 'stats') out.push('menu: the pointer the menu opened under takes its focus on the first step'); }
  const playing = (cls) => { const S = spawn(0, {}), R = newRun(S, 'campaign', 91, { cls }); S.run = R; S.screen = 'play'; S.t = R.t = 10; R.en = []; step(S, { keys: [] }); return { S, R, h: R.hero }; };
  const invAt = (S, id) => { const h = S.run.hero, q = D.UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab).r.find((b) => b.id === id); step(S, { keys: [], px: q.x + 5, py: q.y + 5, click: 1 }); step(S, { keys: [], px: q.x + 5, py: q.y + 5 }); };
  function checkDraftResource(out) {
    for (const [cls, k, res, full] of [['warrior', 'int', 'mp', 1], ['mage', 'int', 'mp', 1], ['mage', 'int', 'mp', 0], ['warrior', 'vit', 'hp', 1], ['archer', 'vit', 'hp', 0]]) {
      const { S, h } = playing(cls), M = SIMX.heroSt(S); h.pts = 2; h.hp = full ? M.maxHp : M.maxHp - 25; h.mp = full ? M.maxMp : Math.floor(M.maxMp / 2); const v0 = h[res];
      S.screen = 'inv'; invAt(S, 'stat:' + k); invAt(S, 'stat:' + k); invAt(S, 'reset:st');
      if (h[res] !== v0 || h.pts !== 2) out.push(`draft: a ${cls}'s ${res} is ${h[res]}, not ${v0}, after two points in ${k} were taken back`); } }
  function checkKeyRepeat(out) {
    const T = spawn(0, {}); step(T, { keys: ['KeyM'] }); for (let i = 0; i < 5; i++) step(T, { keys: [], rep: ['KeyM'] });
    if (T.meta.mute !== 1) out.push('keys: a held M flips the sound on each of its repeats');
    step(T, { keys: [], px: 5, py: 5 }); const f0 = T.focus; step(T, { keys: [], rep: ['ArrowDown'], px: 5, py: 5 }); step(T, { keys: [], rep: ['ArrowDown'], px: 5, py: 5 });
    if (T.focus === f0) out.push('keys: a held arrow does not walk the menu');
    const { S, R } = playing('warrior'); R.enteredT = -99; step(S, { keys: ['KeyL'] }); const leg = R.mapLeg; for (let i = 0; i < 4; i++) step(S, { keys: [], rep: ['KeyL'] });
    if (R.mapLeg !== leg) out.push('keys: a held L flips the legend on each of its repeats');
    for (const k of ['Escape', 'KeyI', 'KeyJ', 'Tab']) { const c = playing('warrior'); step(c.S, { keys: [], rep: [k] }); if (c.S.screen !== 'play') out.push(`keys: a repeat of ${k} alone opens ${c.S.screen}`); } }
  // a save and Continue in the bolt's path, by a corpse about to burst, on a vent about to blow or in a priest's ring: after the hold
  // it all lands as it would have, at the same moment of the play
  function checkResumeHold(out) {
    const run = (save, kind) => { const { S, R, h } = playing('warrior'); R.en = []; h.ifr = 0; h.dashT = -9;
      if (kind === 'bolt') R.proj.push({ id: R.nextId++, src: -1, who: 'test', k: 'jet', x: h.x + 70, y: h.y - 20, vx: -60, vy: 0, t0: S.t, life: 5, dmg: 7, own: 'en', r: 7, gz: 20 });
      if (kind === 'fuse') R.en.push({ id: R.nextId++, type: 'skeleton', x: h.x + 30, y: h.y, vx: 0, vy: 0, hp: 0, max: 10, dmg: 1, elite: 0, room: -1, st: 'dead', t0: S.t, deadT: S.t, fuse: S.t + 0.6, mods: ['explosive'] });
      if (kind === 'vent') R.map.hazards = [{ k: 'vent', x: h.x, y: h.y, per: 6, ph: 1 - ((S.t + 0.5) / 6) % 1 }];
      if (kind === 'pyre') R.pyres = [{ id: R.nextId++, src: -1, who: 'test', x: h.x, y: h.y, t0: S.t - 0.5, dmg: 9 }];
      if (save) { S.screen = 'pause'; press(S, UI.pause(S.meta.zoom).find((b) => b.id === 'save')); press(S, UI.menu(true).find((b) => b.id === 'continue')); }
      const hp = h.hp, hurt = []; for (let n = 0; n < 360;) { step(S, { keys: [] }); if (!(S.t < (R.holdT ?? -1))) n++; if (n === 20 || n === 360) hurt.push(hp - h.hp); } return hurt.join('/'); };
    for (const kind of ['bolt', 'fuse', 'vent', 'pyre']) { const a = run(0, kind), b = run(1, kind);
      if (!(+a.split('/')[1] > 0)) out.push(`resume: the ${kind} set up for the check does not hurt the hero`);
      else if (b !== a) out.push(`resume: a save and Continue change what the ${kind} does (${b} hurt at 0.3 s/6 s, not ${a})`); }
    { const { S, R, h } = playing('mage'); h.cd.dash = S.t + 2; h.burn = S.t + 1; S.screen = 'pause'; press(S, UI.pause(S.meta.zoom).find((b) => b.id === 'save')); press(S, UI.menu(true).find((b) => b.id === 'continue'));
      const cd = h.cd.dash - S.t, burn = h.burn - S.t; while (S.t < R.holdT + DT) step(S, { keys: [] });
      if (Math.abs(h.cd.dash - S.t - cd) > 3 * DT || Math.abs(h.burn - S.t - burn) > 3 * DT) out.push(`resume: the hero's clocks run on through the hold (dash ${(cd - h.cd.dash + S.t).toFixed(2)} s, burn ${(burn - h.burn + S.t).toFixed(2)} s gone)`); }
    { const { S, R, h } = playing('warrior'), e = { id: R.nextId++, type: 'skeleton', x: h.x + 900, y: h.y, vx: 0, vy: 0, hp: 0, max: 10, dmg: 1, elite: 0, room: -1, st: 'dead', t0: S.t, deadT: S.t, nearT: 1, stompT: S.t - 1 };
      R.en = [e]; S.screen = 'pause'; press(S, UI.pause(S.meta.zoom).find((b) => b.id === 'save')); press(S, UI.menu(true).find((b) => b.id === 'continue'));
      const ago = S.t - e.stompT; while (S.t < R.holdT + DT) step(S, { keys: [] });
      if (e.nearT !== 1 || Math.abs(S.t - e.stompT - ago) > 3 * DT) out.push(`resume: the hold moves the colossus's stomp (nearT ${e.nearT}, stomp ${(S.t - e.stompT).toFixed(2)} s ago, not ${ago.toFixed(2)})`); } }
  // a resize under a still pointer is not a move of it, and a run plays the same in any window
  function checkResize(out) { const h0 = SIMX.VIEW.H;
    try { SIMX.setView(1200); const T = spawn(0, {}), U = UI.menu(false, T.meta.diff, T.meta.zoom), st = U.find((b) => b.id === 'stats'), P = mid(T, st);
      step(T, Object.assign({ keys: [] }, P)); step(T, Object.assign({ keys: [], moved: 1 }, P, { px: P.px + 1 })); const f0 = T.focus;
      step(T, { keys: ['ArrowDown'], px: P.px + 1, py: P.py, moved: 0 }); const f1 = T.focus;
      SIMX.setView(1080); const Q = mid(T, U.find((b) => b.id === (f1 === 'settings' ? 'load' : 'settings'))); step(T, Object.assign({ keys: [], moved: 0 }, Q));
      if (f1 === f0 || T.focus !== f1) out.push(`resize: a still pointer takes the menu's focus as the window is resized (${f0} → ${f1} → ${T.focus})`); }
    finally { SIMX.setView(h0); }
    const run = (vh) => { SIMX.setView(vh); try { const S = spawn(0, {}); begin(S); for (let i = 0; i < 120 * 26; i++) step(S, fight(S)); const h = S.run.hero;
      return [h.x, h.y, h.hp, h.mp, S.run.kills, S.steps].map((v) => +v.toFixed(6)).join(','); } finally { SIMX.setView(h0); } };
    { const a = run(1080), b = run(1248); if (a !== b) out.push(`resize: a run plays otherwise in a 16:10 window (${b}, not ${a})`); } }
  // the minimap's sheet tells nothing of the floor before it is seen, and grows by blocks as it is, never each step
  function checkMapCut(out) {
    for (const [mode, seed] of [['campaign', 5], ['campaign', 17], ['cave', 5], ['magma', 5]]) {
      const S = spawn(0, {}), R = newRun(S, mode, seed), m = R.map, c0 = Object.assign({}, SIMX.mapCut(R)), seen0 = R.seen.slice(); R.seen = R.seen.map(() => 1); const all = Object.assign({}, SIMX.mapCut(R)); R.seen = seen0;
      { const s1 = R.seen.slice(); SIMX.markStairs(R, { foes: 4, kills: 2 }); const c = SIMX.mapCut(R), q = m.exit;
        if (!(q.tx >= c.x && q.tx < c.x + c.w && q.ty >= c.y && q.ty < c.y + c.h)) out.push(`map cut: ${mode} ${seed}'s sheet leaves out the stairs the fog shows at half the kills`); R.seen = s1; }
      if (c0.w * c0.h >= all.w * all.h) out.push(`map cut: ${mode} ${seed}'s sheet is the whole floor's before a step (${c0.w}×${c0.h})`);
      const order = []; for (let i = 0; i < m.W * m.H; i++) if (!R.seen[i]) order.push(i); order.sort((a, b) => { const d = (i) => Math.hypot(i % m.W - m.rooms[m.start].cx, Math.floor(i / m.W) - m.rooms[m.start].cy); return d(a) - d(b); });
      let prev = c0, changes = 0;
      for (let k = 0; k < order.length; k++) { R.seen[order[k]] = 1; if (k % 8) continue; const c = SIMX.mapCut(R);
        if (c.x > prev.x || c.y > prev.y || c.x + c.w < prev.x + prev.w || c.y + c.h < prev.y + prev.h) { out.push(`map cut: ${mode} ${seed}'s sheet shrinks as the floor is seen`); break; }
        if (c.w !== prev.w || c.h !== prev.h) changes++; prev = Object.assign({}, c); }
      if (changes > Math.ceil((m.W + m.H) / 4)) out.push(`map cut: ${mode} ${seed}'s sheet changes size ${changes} times as the floor is seen`); } }
  // the step that opens the hero page from play already gives its pointer in the page's frame, or its tip stands uiDy px off for a frame
  function checkUiPtr(out) { const h0 = SIMX.VIEW.H;
    try { SIMX.setView(1248); const { S } = playing('warrior'); step(S, { keys: ['KeyI'], px: 700, py: 600 });
      if (S.screen !== 'inv' || S.uiPtr[1] !== 600 - SIMX.uiDy('inv')) out.push(`pointer: the step from play to the hero page keeps play's frame (${S.uiPtr[1]}, not ${600 - SIMX.uiDy('inv')})`); }
    finally { SIMX.setView(h0); } }
  // a key pressed in the hold acts once it is over, as in a hit-stop: lost, a potion drunk in the banner's 1.2 s did nothing
  function checkHoldInput(out) {
    const { S, R, h } = playing('mage'), M = SIMX.heroSt(S), ab = D.clsOf(h).abs[0].id; h.ab[ab] = h.ab[ab] || 1; h.mp = M.maxMp; h.hp = Math.floor(M.maxHp / 2);
    const pots = () => h.bag.filter((it) => it && it.b === 'hp_potion').reduce((n, it) => n + (it.n || 1), 0), p0 = pots();
    S.screen = 'pause'; press(S, UI.pause(S.meta.zoom).find((b) => b.id === 'save')); press(S, UI.menu(true).find((b) => b.id === 'continue'));
    step(S, { keys: ['KeyQ'], slot: 1 }); while (S.t < R.holdT + 3 * DT) step(S, { keys: [] });
    if (!p0) out.push('hold: the mage of the check carries no health potion');
    else if (pots() !== p0 - 1) out.push('hold: Q pressed in the hold on Continue is lost');
    if (!(h.cd[ab] > S.t)) out.push('hold: a slot key pressed in the hold on Continue is lost'); }
  // TASKS 1887 и: the legend opens by itself in the run's first town and on its first floor, and not again on the next ones
  function checkLegendOnce(out) {
    const S = townRun(), R = S.run, seen = [R.legAuto];
    for (const f of [1, 2, 0, 3]) { SIMX.enterFloor(S, R, f); seen.push(R.legAuto); }
    if (seen.join('') !== '11000') out.push(`legend: opens by itself on town, floor 1, floor 2, town, floor 3 as ${seen.join('')}, not 11000`); }
  // TASKS 1883: in a talk Enter presses the lit button, ←→ walk a page's buttons and ↑↓ the topics; a focus left from the start is not used
  function checkTalkFocus(out) {
    const offer = () => { const S = townRun(), R = S.run, k = (keys) => step(S, { keys, px: 5, py: 5 }); R.offers = [{ key: 'fetch', from: 'sweeper', q: 0 }]; R.quests = [];
      const qt = SIMX.questTalk(R, 'sweeper'); S.talk = { role: 'sweeper', i: 0, pages: qt.pages, p: qt.pages.length - 1, act: qt.act }; S.screen = 'talk'; S.focus = 'cls:warrior'; k([]); return { S, R, k }; };
    { const { S, R, k } = offer(); if (S.focus !== 'act') out.push(`talk: an offer opens with ${S.focus} lit, not the take button`);
      k(['ArrowRight']); if (S.focus !== 'next') out.push(`talk: → on an offer lights ${S.focus}, not the way out`);
      k(['Enter']); if (S.screen !== 'play' || R.quests.length) out.push('talk: Enter on the way out does not leave the offer untaken'); }
    { const { S, R, k } = offer(); k(['Enter']); if (R.quests.length !== 1) out.push('talk: Enter on a fresh offer does not take it'); }
    { const S = townRun(), k = (keys) => step(S, { keys, px: 5, py: 5 }), tp = D.FOLK.keeper.topics; S.talk = { role: 'keeper', i: 0, pages: [''], p: 0, act: null, topics: tp, menu: 1 }; S.screen = 'talk'; k([]);
      if (S.focus !== 'topic:0') out.push(`talk: the topics open with ${S.focus} lit`);
      k(['ArrowDown']); k(['Enter']); if (!S.talk || !S.talk.inTopic || S.talk.pages !== tp[1].a) out.push('talk: ↓ and Enter in the topics do not ask the second one'); } }
  // TASKS 1884: past ten quests the journal scrolls by the wheel, and the chosen quest is always among the rows shown
  function checkJournalScroll(out) {
    const S = townRun(), R = S.run, W = (wheel) => step(S, { keys: [], px: 5, py: 5, wheel }); R.offers = [];
    R.quests = Array.from({ length: 14 }, (_, i) => ({ id: 950 + i, key: 'cull', f: 1 + i, need: 5, n: 0, st: 'taken', from: 'guard', rw: {} }));
    const L0 = SIMX.journalOf(R), shown = () => UI.journal(L0.length, true, S.jtop).r.filter((b) => b.id.startsWith('q:')).map((b) => L0[b.i].id);
    S.jsel = L0[12].id; S.screen = 'journal'; W(0);
    if (!shown().includes(S.jsel)) out.push(`journal: the 13th of 14 chosen is not among the rows shown (${shown().length})`);
    for (let i = 0; i < 20; i++) W(-1); if (S.jtop !== 0 || !shown().includes(S.jsel)) out.push(`journal: wheeled to the top the list starts at ${S.jtop} or loses the chosen quest`);
    for (let i = 0; i < 20; i++) W(1); if (!shown().includes(L0[13].id) || !shown().includes(S.jsel)) out.push('journal: wheeled down the last quest or the chosen one is not shown'); }
  // TASKS 1885: a taken row stays in place until the board closes, so clicks down its buttons and a double click take one each
  function checkBoardRows(out) {
    const S = townRun(), R = S.run; R.offers = D.QUEST_GIVE.from.map((from, i) => ({ key: D.QUEST_GIVE.pool[i % D.QUEST_GIVE.pool.length], from, q: 0 })); R.quests = [];
    S.screen = 'board'; step(S, { keys: [], px: 5, py: 5 }); const n0 = SIMX.boardOffers(R).length, rows = UI.board(n0).r, tap = (i) => press(S, rows.find((b) => b.id === 'take:' + i));
    if (n0 < 3) { out.push(`board: the check's board holds ${n0} offers`); return; }
    const want = S.bdRows.slice(0, 3).map((o) => o.role); tap(0); tap(0); tap(1); tap(2);
    const got = R.quests.map((q) => q.from);
    if (got.join() !== want.join()) out.push(`board: clicks on rows 1, 1, 2, 3 took ${got.join() || 'nothing'}, not ${want.join()}`);
    step(S, { keys: ['Escape'], px: 5, py: 5 }); S.screen = 'board'; step(S, { keys: [], px: 5, py: 5 });
    if (S.bdRows.length !== n0 - 3) out.push(`board: reopened it still shows the ${n0 - S.bdRows.length} taken rows wrong (${S.bdRows.length} of ${n0})`); }
  // the hero's name (TASKS 1879): the die is the sim's own and repeats from the same seed, the field takes letters, Backspace and Enter,
  // keeps to NAME_MAX, the run and its save carry the name, an empty field throws one at the start, a save from before names still loads
  function checkHeroName(out) {
    const N = D.heroNames(), J = (o) => JSON.parse(JSON.stringify(o)), toStart = () => { const S = spawn(0, {}); press(S, UI.menu(false).find((b) => b.id === 'campaign')); return S; };
    const B = (S, id) => UI.classes(S.meta).find((b) => b.id === id), put = (S, keys, chars) => step(S, { keys, chars, px: 5, py: 5 });
    const A = toStart(), A2 = toStart();
    if (A.screen !== 'classes' || !N.includes(A.pendName)) out.push(`name: the start screen offers no name off the list (${A.pendName})`);
    press(A, B(A, 'dice')); press(A2, B(A2, 'dice'));
    if (!N.includes(A.pendName) || A.pendName !== A2.pendName) out.push(`name: the die is not the same from the same seed (${A.pendName}, ${A2.pendName})`);
    // the throws grow with the list, twelve a name, so a longer list is still thrown whole (review of PR 63)
    const thrown = new Set(), nT = N.length * 12; let rep = false;
    for (let i = 0; i < nT; i++) { const was = A.pendName; press(A, B(A, 'dice')); thrown.add(A.pendName); if (A.pendName === was && !rep) { rep = true; out.push(`name: the die threw the same name twice running (${was}, throw ${i + 1})`); } }
    if ([...thrown].some((n) => !N.includes(n)) || thrown.size < N.length) out.push(`name: ${nT} throws of the die land off the list or miss some of it (${thrown.size} of ${N.length})`);
    { const P = toStart(), f0 = P.focus, n0 = P.pendName, mute = P.meta.mute; step(P, Object.assign({ keys: [], moved: 1 }, mid(P, B(P, 'name'))));
      if (P.focus === 'name') out.push('name: the pointer passing over the field gives it the keyboard');
      step(P, Object.assign({ keys: ['KeyM'], chars: ['m'], moved: 0 }, mid(P, B(P, 'name'))));
      if (P.pendName !== n0 || P.meta.mute === mute) out.push(`name: with the pointer over the field M writes a letter or does not mute (${P.pendName}, focus ${f0} → ${P.focus})`); }
    { const P = toStart(); press(P, B(P, 'name')); P.pendName = 'Ulf'; const mute = P.meta.mute;
      for (const id of ['dice', 'go']) step(P, Object.assign({ keys: [], moved: 1 }, mid(P, B(P, id))));
      step(P, Object.assign({ keys: ['KeyM'], chars: ['m'], moved: 1 }, mid(P, B(P, 'go'))));
      if (P.focus !== 'name' || P.pendName !== 'Ulfm' || P.meta.mute !== mute) out.push(`name: the pointer over the die or the start button takes the field's keyboard (${P.focus}, ${P.pendName}, mute ${P.meta.mute})`);
      step(P, Object.assign({ keys: ['Enter'], moved: 1 }, mid(P, B(P, 'dice'))));
      if (P.focus !== 'go' || P.pendName !== 'Ulfm') out.push(`name: Enter in the field under the pointer on the die throws it (${P.focus}, ${P.pendName})`);
      press(P, B(P, 'name')); put(P, ['Escape'], []);
      if (P.screen !== 'classes' || P.focus === 'name' || P.pendName !== 'Ulfm') out.push(`name: Escape in the field does not just leave it (${P.screen}, ${P.focus}, ${P.pendName})`);
      // Escape leaves the keyboard on «В путь», and the next Enter starts the run under the typed name (TASKS 1902)
      if (P.focus !== 'go') out.push(`name: Escape in the field leaves the keyboard on ${P.focus || 'nothing'}, not the start button`);
      press(P, B(P, 'name')); press(P, { x: 2, y: 2, w: 4, h: 4 });
      if (P.focus === 'name') out.push('name: a click off the field does not take its keyboard away');
      press(P, B(P, 'name')); put(P, ['Escape'], []); put(P, ['Enter'], []);
      if (!P.run || P.run.hero.name !== 'Ulfm') out.push(`name: Enter after Escape in the field does not start the run under the typed name (${P.screen}, ${P.run && P.run.hero.name})`); }
    { const P = toStart(), rows = UI.classes(P.meta), cls = SIMX.clsNow(P), above = rows.some((q) => q.id === 'kit:' + cls) ? 'kit:' + cls : 'cls:' + cls;
      P.pendName = 'Ulf'; P.focus = above; put(P, ['KeyS'], ['s']);
      if (P.focus === 'name' || P.pendName !== 'Ulf') out.push(`name: S from the row above takes the field (${P.focus}, ${P.pendName})`);
      P.focus = 'dice'; put(P, ['KeyA'], ['a']);
      if (P.focus === 'name' || P.pendName !== 'Ulf') out.push(`name: A on the die takes the field (${P.focus}, ${P.pendName})`);
      P.focus = above; put(P, ['ArrowDown'], []); if (P.focus !== 'name') out.push(`name: ↓ from the row above does not take the field (${P.focus})`);
      P.focus = 'dice'; put(P, ['ArrowLeft'], []); if (P.focus !== 'name') out.push(`name: ← on the die does not take the field (${P.focus})`); }
    // a key that changes neither the focus nor a choice makes no interface sound (TASKS 1905)
    { const P = toStart(), cls = SIMX.clsNow(P), dif = D.DIFF_ORDER, ids = D.classesReady(), ui = (keys, chars = []) => { P.ev = []; put(P, keys, chars); return P.ev.filter((e) => e.k === 'ui').length; };
      const hush = [['the die, A', () => { P.focus = 'dice'; }, ['KeyA'], ['a']], ['the field, ←', () => { press(P, B(P, 'name')); }, ['ArrowLeft'], []],
        ['the top row, ↑', () => { P.meta.diff = dif[0]; P.focus = 'dif:' + dif[0]; }, ['ArrowUp'], []], ['the last difficulty, →', () => { P.meta.diff = dif[dif.length - 1]; P.focus = 'dif:' + dif[dif.length - 1]; }, ['ArrowRight'], []],
        ['the first class, ←', () => { P.meta.cls = ids[0]; P.focus = 'cls:' + ids[0]; }, ['ArrowLeft'], []], ['the go button, →', () => { P.focus = 'go'; }, ['ArrowRight'], []]];
      for (const [what, set, keys, chars] of hush) { set(); const n = ui(keys, chars); if (n) out.push(`start screen: ${what} changes nothing but sounds ${n} time(s)`); if (P.focus === 'name') put(P, ['Escape'], []); }
      P.meta.cls = cls; P.focus = 'dice'; if (ui(['ArrowLeft']) !== 1 || P.focus !== 'name') out.push(`start screen: ← from the die into the field does not sound once (${P.focus})`);
      put(P, ['Escape'], []); P.meta.diff = dif[0]; P.focus = 'dif:' + dif[0]; if (dif.length > 1 && (ui(['ArrowRight']) !== 1 || P.meta.diff !== dif[1])) out.push(`start screen: → on the difficulty does not sound once (${P.meta.diff})`); }
    { const P = toStart(), ids = UI.classes(P.meta).map((q) => q.id); step(P, Object.assign({ keys: [], moved: 1 }, mid(P, B(P, 'name'))));
      const lit = ids.includes(P.focus) ? P.focus : ids.includes(P.hover) ? P.hover : '';
      if (lit !== 'name') out.push(`name: the pointer over the field lights ${lit || 'nothing'}, not the field`); }
    // what is lit is what Enter presses (TASKS 1901): the field lit by the pointer takes the keyboard, it does not start the run
    { const P = toStart(); P.focus = 'back'; step(P, Object.assign({ keys: [], moved: 1 }, mid(P, B(P, 'name'))));
      step(P, Object.assign({ keys: ['Enter'], moved: 0 }, mid(P, B(P, 'name'))));
      if (P.screen !== 'classes' || P.focus !== 'name') out.push(`name: Enter with the field lit by the pointer does not take the field (${P.screen}, ${P.focus})`);
      const Q = toStart(); step(Q, Object.assign({ keys: [], moved: 1 }, mid(Q, B(Q, 'name')))); step(Q, { keys: [], moved: 1, px: 2, py: 2 });
      step(Q, { keys: ['Enter'], px: 2, py: 2 });
      if (Q.screen !== 'classes' || Q.focus !== 'go') out.push(`name: Enter with nothing lit does not light the start button first (${Q.screen}, ${Q.focus})`); }
    press(A, B(A, 'name')); if (A.focus !== 'name') out.push(`name: a click on the field does not give it the keyboard (${A.focus})`);
    for (let i = 0; i < 16; i++) put(A, ['Backspace'], []);
    if (A.pendName !== '') out.push(`name: Backspace does not empty the field (${A.pendName})`);
    const mute = A.meta.mute; put(A, ['KeyS', 'KeyM', 'Digit1'], ['s', 'm', '1', 'a', 'w']);
    if (A.pendName !== 'Smaw' || A.focus !== 'name' || A.meta.mute !== mute) out.push(`name: typing walked or muted or took a digit (${A.pendName}, ${A.focus}, mute ${A.meta.mute})`);
    put(A, [], 'bjorn of the long dark'.split(''));
    if (A.pendName.length !== D.NAME_MAX) out.push(`name: the field holds ${A.pendName.length} letters, not ${D.NAME_MAX}`);
    for (let i = 0; i < 16; i++) put(A, ['Backspace'], []); put(A, [], ['\u0431', 'j', 'o', 'r', 'n']);
    put(A, ['Enter'], []); if (A.focus !== 'go' || A.screen !== 'classes') out.push(`name: Enter in the field does not go on to the start button (${A.focus}, ${A.screen})`);
    put(A, ['Enter'], []); const R = A.run;
    if (!R || R.hero.name !== '\u0411jorn' || (R.log && R.log.name !== '\u0411jorn')) { out.push(`name: the run does not carry the typed name (${R && R.hero.name})`); return; }
    const L = spawn(1, J(SIMX.persist(A))); if (!L.saved || L.saved.hero.name !== '\u0411jorn') out.push('name: the save loses the name');
    const old = J(SIMX.persist(A)); delete old.run.hero.name; const O = spawn(1, old);
    if (!O.saved || D.heroName(O.saved.hero) !== D.clsOf(O.saved.hero).name) out.push('name: a save from before names does not load under its class');
    const E = toStart(); press(E, B(E, 'name')); for (let i = 0; i < 16; i++) put(E, ['Backspace'], []); put(E, ['Enter'], []); put(E, ['Enter'], []);
    if (!E.run || !N.includes(E.run.hero.name)) out.push(`name: an empty field does not start with a name off the list (${E.run && E.run.hero.name})`);
    const names = D.heroNames, F = toStart(), cls = D.clsOf({ cls: SIMX.clsNow(F) }).name; try { D.heroNames = () => ['Ulf'];
      if (SIMX.rollName(F) !== 'Ulf' || SIMX.rollName(F) !== 'Ulf') out.push(`name: a list of one name does not throw that name (${F.pendName})`);
      D.heroNames = () => []; if (SIMX.rollName(F) !== cls) out.push(`name: an empty list does not give the class's name (${F.pendName})`);
      F.meta.cls = 'none'; if (SIMX.rollName(F) !== D.clsOf({ cls: 'warrior' }).name) out.push('name: an empty list with no class ready does not give the warrior\'s name'); } finally { D.heroNames = names; }
  }
  // review of PR 63: a test run leaves the Keeper of the Fire nothing to speak of and counts in no win or record, though it pays its
  // shards (TASKS 1878); the descent past the last boss on such a run alike; nor do its deeds, codex finds and whirls count
  function checkTestTrace(out) {
    const S = spawn(0, {}), M = S.meta; Object.assign(M, { lastEnd: 'win', lastCls: 'mage', endTold: 1, wins: 2, best: 7 });
    const was = () => JSON.stringify([M.lastEnd, M.lastCls, M.endTold, M.wins, M.best]), w0 = was();
    S.run = newRun(S, 'cave', 5, { cls: 'warrior' }); S.run.test = 1; S.screen = 'play'; const sh0 = M.shards; SIMX.endRun(S, 'dead');
    if (was() !== w0) out.push(`test run: its end changes the Keeper's last end, a win or a record (${was()})`);
    const F = D.RUNS.campaign.floors, R = newRun(S, 'campaign', 5, { cls: 'warrior' }); R.test = 1; R.floor = F; R.bossDead = 1; S.run = R; S.screen = 'play';
    const sh1 = M.shards; SIMX.descend(S, R);
    if (was() !== w0) out.push(`test run: the descent past the last boss counts a win or a record (${was()})`);
    if (!(M.shards > sh1) || !(sh1 >= sh0)) out.push('test run: the descent no longer pays its shards');
    const T = newRun(S, 'cave', 5, { cls: 'warrior' }); T.test = 1; S.run = T; S.screen = 'play'; const hints = () => JSON.stringify([M.ach || {}, M.codex || {}, M.whirls || 0, M.open || {}]), hn0 = hints();
    for (const e of [{ k: 'kill', type: 'fire_priest', elite: 1, boss: 1 }, { k: 'hit', type: 'fire_priest' }, { k: 'pickup', b: Object.keys(D.BASES)[0] }, { k: 'bless', id: Object.keys(D.POWERS)[0] }]) SIMX.ev(S, Object.assign({ x: 0, y: 0 }, e));
    const h = T.hero; h.ab.whirl = h.ab.whirl || 1; h.cd.whirl = 0; h.mp = 1e9; SIMX.castAbility(S, T, 'whirl', {});
    if (hints() !== hn0) out.push(`test run: its kills, finds, blessings or whirls change the deeds, the codex or the hints (${hints()})`); }
  // review of PR 63: the pointer over «Завершить поход» does not take the focus, so Enter presses the safe button; it hovers the
  // finish, and the HUD then lights that one alone (TASKS 1890, 1894), till an arrow takes the light to the keys' button
  function checkFinishFocus(out) {
    const S = townRun();
    S.talk = { role: 'keeper', i: 0, pages: ['a'], p: 0, act: { k: 'finish', rw: {} } }; S.screen = 'talk'; step(S, { keys: [], px: 5, py: 5 });
    const U = UI.talk(S.talk), fb = U.r.find((q) => q.id === 'act'); if (!fb) { out.push('finish: the keeper\'s last page has no finish button'); return; }
    step(S, Object.assign({ keys: [], moved: 1 }, mid(S, fb)));
    if (S.focus === 'act' || !SIMX.talkWalk(S.talk, U).includes(S.focus)) out.push(`finish: the pointer over the finish button moves the focus onto it (${S.focus})`);
    if (S.hover !== 'act') out.push(`finish: the pointer over the finish button does not hover it (${S.hover}), so the HUD would light Enter's button beside it`);
    // an arrow under the still pointer takes the light back to the keys' button, and the pointer's next move gives it to the finish
    { const T = S.talk, f0 = S.focus; step(S, Object.assign({ keys: ['ArrowLeft'], moved: 0 }, mid(S, fb)));
      if (!T.byKeys) out.push(`finish: an arrow under the pointer on the finish button leaves it lit, the keys' ${S.focus} dark`);
      step(S, Object.assign({ keys: [], moved: 1 }, mid(S, fb), { px: mid(S, fb).px + 1 }));
      if (T.byKeys || S.hover !== 'act') out.push('finish: the pointer moved again on the finish button does not light it');
      S.focus = f0; }
    const lit = S.focus; step(S, Object.assign({ keys: ['Enter'] }, mid(S, fb)));
    if (!S.run || S.screen === 'win') out.push('finish: Enter under the pointer on the finish button ends the run');
    else if (lit === 'next' && S.screen !== 'play') out.push(`finish: Enter does not press the lit ${lit} (${S.screen})`); }
  // an ability card's rank text, however many lines it wraps to, keeps 22 px clear of the fork line, the fork line of the cost, and
  // all of them stay under the rank's line and inside the card (TASKS 2001)
  // TASKS 1994: a likeness of any shape, from a narrow child to a squat counter, stays inside the talk window's dark frame
  function checkTalkFace(out) { const U = UI.talk(null), F = U.F;
    for (const [sw, sh] of [[292, 620], [719, 864], [1200, 300], [100, 1500]]) { const f = U.face(sw, sh);
      if (f.x < F.x || f.y < F.y || f.x + f.w > F.x + F.w || f.y + f.h > F.y + F.h) out.push(`talk: a ${sw}×${sh} likeness leaves its frame (${[f.x, f.y, f.w, f.h].map(Math.round)})`); } }
  function checkAbCard(out) {
    const c = UI.inv().r.find((q) => q.id.startsWith('ab:'));
    for (const split of [true, false]) for (const fork of [true, false]) for (let n = 1; n <= 4; n++) { const Y = UI.abCard(c.h, n, split, fork), tag = `ability card: ${n} line(s), ${split ? 'split' : 'whole'}, ${fork ? 'fork' : 'no fork'}`;
      if (Y.rule < 92 || Y.y0 - Y.rule < 20) out.push(`${tag}: the text rises into the rank's line (${Y.rule}, ${Y.y0})`);
      if (fork && (Y.fork - Y.last < 22 || Y.cost - Y.fork < 22)) out.push(`${tag}: the fork line at ${Y.fork} crowds the text (${Y.last}) or the cost (${Y.cost})`);
      if (!fork && Y.cost - Y.last < 22) out.push(`${tag}: the text (${Y.last}) reaches the cost (${Y.cost})`);
      if (Y.cost > c.h - 20) out.push(`${tag}: the cost leaves the card`); } }
  // a gift's number reads with the Russian decimal comma wherever it shows: the altar's card, the HUD chip and tip for n gifts, the
  // message on taking it; the number comes from v, so no text holds one of its own (TASKS 1900)
  function checkGiftDecimal(out) {
    const R = root.TEXT.ru, dot = /\d\.\d/, comma = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
    for (const G of D.GIFTS) { if (G.power) continue;
      if (!/\{v\}/.test(R['GIFTS.' + G.id + '.desc'] || '')) out.push(`gift ${G.id}: its text holds its number apart from v`);
      for (let n = 1; n <= 4; n++) { const d = D.giftDesc(G, n); if (dot.test(d) || !d.includes(comma(G.v * n))) out.push(`gift ${G.id} ×${n}: «${d}» does not read ${comma(G.v * n)}`); } }
    const life = D.GIFTS.find((g) => g.id === 'life'); if (!life.desc.startsWith('+1,5 ') || dot.test(life.desc)) out.push(`gift life: «${life.desc}»`);
    const tk = TXT('sim_town.takeGift.msg', { name: life.name, desc: life.desc }); if (dot.test(tk)) out.push(`gift life: the message on taking it reads «${tk}»`);
    if (TXT('GIFTS.phoenix.descN', { n: 2, times: TXT.n('hud.tip.times', 2), v: 50 }).indexOf('50%') < 0) out.push('gift phoenix: the tip for two loses its 50%');
    for (const [k, v] of Object.entries(R)) for (const s of [].concat(v)) if (typeof s === 'string' && /(^|[^\d.])\d+\.\d+(?![.\d])/.test(s.replace(/\{[^}]*\}/g, ''))) out.push(`text ${k}: a decimal dot in «${s}»`);
    if (!TXT('GIFTS.life.desc', { v: 4.5 }).startsWith('+4,5 ')) out.push(`text: a fractional value goes in as «${TXT('GIFTS.life.desc', { v: 4.5 })}»`); }
  function checkReview57(out) { checkGiftDecimal(out); checkTalkFace(out); checkAbCard(out); checkBoardRows(out); checkJournalScroll(out); checkTalkFocus(out); checkLegendOnce(out); checkGateFocus(out); checkDraftResource(out); checkKeyRepeat(out); checkHeroName(out); checkResumeHold(out); checkResize(out); checkMapCut(out); checkHoldInput(out); checkUiPtr(out); checkTestTrace(out); checkFinishFocus(out); }
  // TASKS 1988: Shift+click asks how many of a stack and the part rides the pointer to the next click, Shift+right click takes half; the
  // total never changes, no stack goes past its limit, a save keeps both parts; the merchant sells and buys the number asked, at its price
  function checkSplit(out) {
    const hp = (h, T) => h.bag.concat(T ? T.items : []).reduce((a, q) => a + (q && q.b === 'hp_potion' ? q.n : 0), 0), cap = D.CONSUMABLES.hp_potion.stack;
    const over = (L0) => L0.some((q) => q && SIMX.isCons(q) && q.n > D.CONSUMABLES[q.b].stack);
    const go = (S, U, id, o = {}) => { const b = U.r.find((q) => q.id === id), p = mid(S, b); step(S, Object.assign({ keys: [] }, p, o)); step(S, Object.assign({ keys: [] }, p)); };
    const pot = (R, n) => Object.assign(SIMX.potion('hp_potion', n), { id: R.nextId++ });
    { const { S, R, h } = playing('warrior'); S.screen = 'inv'; h.bag.fill(null); h.bag[0] = pot(R, 9); h.bag[1] = pot(R, cap); const U = () => UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab);
      go(S, U(), 'bag:0', { click: 1, press: 1, shift: 1 }); if (!S.split || S.split.n !== 5 || S.split.hi !== 8) out.push(`split: Shift+click on a stack of 9 does not ask how many (${JSON.stringify(S.split)})`);
      step(S, { keys: [], wheel: -1 }); step(S, { keys: [], wheel: 1 }); step(S, { keys: [], wheel: -9 }); if (S.split && S.split.n !== 8) out.push('split: the wheel does not hold the count to the stack less one');
      step(S, { keys: [], wheel: 3 }); step(S, { keys: ['Enter'] }); if (!S.drag || S.drag.n !== 5 || !S.drag.carry) out.push('split: Enter does not put the part on the pointer');
      if (h.bag[0].n !== 9) out.push('split: the part leaves its stack before it is laid down');
      go(S, U(), 'bag:5', { click: 1, press: 1 }); if (!h.bag[5] || h.bag[5].n !== 5 || h.bag[0].n !== 4 || h.bag[5].id === h.bag[0].id || S.drag) out.push('split: the part does not land in a free cell');
      go(S, U(), 'bag:5', { rclick: 1, shift: 1 }); if (!S.drag || S.drag.n !== 3) out.push('split: Shift+right click does not take half');
      go(S, U(), 'bag:1', { click: 1, press: 1 }); if (h.bag[1].n !== cap || h.bag[5].n !== 5) out.push('split: a part goes onto a full stack');
      go(S, U(), 'bag:5', { rclick: 1, shift: 1 }); go(S, U(), 'bag:0', { click: 1, press: 1 }); if (h.bag[0].n !== 7 || h.bag[5].n !== 2) out.push(`split: a part does not join a stack of its kind (${h.bag[0].n}, ${h.bag[5].n})`);
      go(S, U(), 'bag:0', { click: 1, press: 1, shift: 1 }); step(S, { keys: ['Escape'] }); if (S.split || S.screen !== 'inv') out.push('split: Esc does not just close the question');
      if (hp(h) !== 9 + cap || over(h.bag)) out.push(`split: the bag holds ${hp(h)} potions, not ${9 + cap}, or a stack past its limit`);
      const P = JSON.parse(JSON.stringify(SIMX.persist(S))), T = spawn(1, P), B = (T.saved || T.run).hero.bag;
      if (!B[0] || B[0].n !== 7 || !B[5] || B[5].n !== 2) out.push('split: a save and load do not keep both parts'); }
    { const S = townRun(), R = S.run, h = R.hero; S.screen = 'stash'; h.bag.fill(null); h.bag[0] = pot(R, 9); const T = SIMX.stashOf(S); T.items = []; const U = () => UI.stash(h.bag.length, S.bagTab);
      go(S, U(), 'bag:0', { click: 1, press: 1, shift: 1 }); step(S, { keys: [], wheel: 1 }); step(S, { keys: ['Enter'] }); go(S, U(), 'stash:3', { click: 1, press: 1 });
      if (!T.items[3] || T.items[3].n !== 4 || h.bag[0].n !== 5 || hp(h, T) !== 9) out.push('split: a part does not go into the chest');
      go(S, U(), 'stash:3', { rclick: 1, shift: 1 }); go(S, U(), 'bag:2', { click: 1, press: 1 }); if (!h.bag[2] || h.bag[2].n !== 2 || T.items[3].n !== 2 || hp(h, T) !== 9) out.push('split: half of a chest stack does not come out'); }
    { const S = spawn(0, {}); SIMX.begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, sh = R.map.shop; R.en = []; h.x = sh.front.x; h.y = sh.front.y; step(S, { keys: ['KeyE'] });
      if (S.screen !== 'shop') { out.push('split: the shop does not open'); return; }
      h.bag.fill(null); h.bag[0] = pot(R, 9); h.gold = 0; const U = () => UI.shop(R.shop.goods.length, h.bag.length, S.bagTab), unit = D.sellPrice(h.bag[0], SIMX.tradeDepth(R));
      go(S, U(), 'sell:0', { click: 1, shift: 1 }); step(S, { keys: [], wheel: -3 }); step(S, { keys: ['Enter'] });
      const lot = R.shop.back[R.shop.back.length - 1]; if (h.gold !== 4 * unit || h.bag[0].n !== 5 || !lot || lot.it.n !== 4 || lot.price !== 4 * unit) out.push(`split: selling 4 of 9 pays ${h.gold}, not ${4 * unit}, or leaves ${h.bag[0] && h.bag[0].n}`);
      const gi = R.shop.goods.findIndex((q) => q.n && q.it.b === 'hp_potion'), g = R.shop.goods[gi];
      if (g) { g.n = Math.max(g.n, 5); h.gold = g.price * 3 + 7; const n0 = g.n, c0 = hp(h); go(S, U(), 'buy:' + gi, { click: 1, shift: 1 }); step(S, { keys: ['ArrowRight'] }); step(S, { keys: ['ArrowRight'] }); step(S, { keys: [], wheel: -5 }); step(S, { keys: ['Enter'] });
        if (h.gold !== 7 || hp(h) !== c0 + 3 || (R.shop.goods.includes(g) ? g.n : 0) !== n0 - 3 || over(h.bag)) out.push(`split: buying 3 at the merchant leaves ${h.gold} gold (7) and ${hp(h) - c0} potions`); }
      else out.push('split: the merchant sells no potions');
      if (g) { h.bag.fill(null); g.n = cap * 2 + 3; h.gold = g.price * g.n; const n = g.n; SIMX.buy(S, R, g, false, n);
        if (hp(h) !== n || over(h.bag) || h.bag.filter(Boolean).length !== 3) out.push(`split: buying ${n} into an empty bag gives ${hp(h)} potions in ${h.bag.filter(Boolean).length} cells, or a stack past its limit`); } } }
  // TASKS 1999: potions and scrolls stack to 20; a stack let go on a stack of its kind joins it up to that and the rest stays where it
  // came from (in the bag, the chest and onto a tab), and everything that puts one into the bag fills the stacks first
  function checkStacks(out) {
    for (const [b, q] of Object.entries(D.CONSUMABLES)) if (q.stack !== 20) out.push(`stacks: ${b} stacks to ${q.stack}, not 20`);
    const c = (R, b, n) => Object.assign(SIMX.potion(b, n), { id: R.nextId++ }), ns = (L0, b = 'hp_potion') => L0.filter((q) => q && q.b === b).map((q) => q.n).sort((p, q) => q - p).join(',');
    const at = (S, U, id) => mid(S, U.r.find((q) => q.id === id)), drop = (S, U, from, to) => { S.drag = { from, x: 0, y: 0 }; step(S, Object.assign({ keys: [] }, at(S, U, to))); };
    { const { S, R, h } = playing('warrior'); S.screen = 'inv'; h.bag.fill(null); const U = () => UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab);
      h.bag[0] = c(R, 'scroll', 5); h.bag[1] = c(R, 'scroll', 2); drop(S, U(), 'bag:1', 'bag:0'); if (ns(h.bag, 'scroll') !== '7' || h.bag[1]) out.push(`stacks: 2 scrolls dropped on 5 give ${ns(h.bag, 'scroll')}, not one stack of 7`);
      h.bag[2] = c(R, 'hp_potion', 18); h.bag[3] = c(R, 'hp_potion', 5); drop(S, U(), 'bag:3', 'bag:2'); if (h.bag[2].n !== 20 || !h.bag[3] || h.bag[3].n !== 3) out.push(`stacks: 5 potions dropped on 18 give ${ns(h.bag)}, not 20 and 3 left where they were`);
      drop(S, U(), 'bag:2', 'bag:3'); if (ns(h.bag) !== '20,3') out.push(`stacks: a full stack dropped on a stack of its kind gives ${ns(h.bag)}`);
      h.bag[4] = c(R, 'mp_potion', 4); const m = h.bag[2]; drop(S, U(), 'bag:4', 'bag:2'); if (h.bag[2] !== h.bag[4] && h.bag[4] !== m) out.push('stacks: a stack dropped on another kind does not swap'); }
    { const { S, R, h } = playing('warrior'); h.bag = Array(D.BAG.start + D.BAG.pouch).fill(null); S.screen = 'inv'; S.bagTab = 1; const U = () => UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab);
      h.bag[2] = c(R, 'scroll', 4); h.bag[30] = c(R, 'scroll', 3); drop(S, U(), 'bag:30', 'btab:0'); if (ns(h.bag, 'scroll') !== '7') out.push(`stacks: scrolls let go over the bag's tab give ${ns(h.bag, 'scroll')}, not one stack of 7`); }
    { const S = townRun(), R = S.run, h = R.hero; S.screen = 'stash'; h.bag.fill(null); const T = SIMX.stashOf(S); T.items = Array(D.STASH.cells).fill(null); const U = () => UI.stash(h.bag.length, S.bagTab);
      T.items[0] = c(R, 'hp_potion', 15); T.items[1] = c(R, 'hp_potion', 9); drop(S, U(), 'stash:1', 'stash:0'); if (T.items[0].n !== 20 || !T.items[1] || T.items[1].n !== 4) out.push(`stacks: in the chest 9 on 15 give ${ns(T.items)}, not 20 and 4`);
      h.bag[0] = c(R, 'hp_potion', 17); drop(S, U(), 'stash:1', 'bag:0'); if (h.bag[0].n !== 20 || T.items[1].n !== 1) out.push(`stacks: 4 from the chest on 17 in the bag give ${ns(h.bag)} / ${ns(T.items)}`);
      h.bag[1] = c(R, 'scroll', 6); T.items[5] = c(R, 'scroll', 16); drop(S, U(), 'bag:1', 'stash:5'); if (T.items[5].n !== 20 || !h.bag[1] || h.bag[1].n !== 2) out.push(`stacks: 6 scrolls on 16 in the chest give ${ns(T.items, 'scroll')} / ${ns(h.bag, 'scroll')}`);
      h.bag[1].n = 2; h.bag[7] = c(R, 'scroll', 5); step(S, Object.assign({ keys: [], rclick: 1 }, at(S, U(), 'stash:5'))); if (ns(h.bag, 'scroll') !== '20,7' || T.items[5]) out.push(`stacks: 20 scrolls taken from the chest give ${ns(h.bag, 'scroll')}, not 20 on 2 and 7 on 5`); }
    { const { S, R, h } = playing('warrior'); h.bag.fill(null); h.bag[3] = c(R, 'hp_potion', 5);
      const pick = (it) => SIMX.takeItem(S, R, { item: it, x: h.x, y: h.y });
      pick(SIMX.potion('hp_potion')); if (ns(h.bag) !== '6' || !h.bag[3]) out.push(`stacks: a potion picked up beside 5 gives ${ns(h.bag)}, not one stack of 6`);
      h.bag[3].n = 19; pick(SIMX.potion('hp_potion', 3)); if (ns(h.bag) !== '20,2') out.push(`stacks: 3 potions picked up beside 19 give ${ns(h.bag)}, not 20 and 2`);
      h.bag[5] = c(R, 'scroll', 5); SIMX.bagAdd(R, SIMX.potion('scroll', 1)); if (ns(h.bag, 'scroll') !== '6') out.push(`stacks: a scroll given beside 5 gives ${ns(h.bag, 'scroll')}`); }
    { const S = spawn(0, {}); SIMX.begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, g = R.shop.goods.find((q) => q.n && q.it.b === 'hp_potion');
      if (!g) out.push('stacks: the merchant sells no potions');
      else { h.bag.fill(null); h.bag[4] = c(R, 'hp_potion', 19); g.n = 5; h.gold = g.price * 3; SIMX.buy(S, R, g, false, 3); if (ns(h.bag) !== '20,2') out.push(`stacks: 3 potions bought beside 19 give ${ns(h.bag)}, not 20 and 2`);
        h.bag.fill(null); h.bag[6] = c(R, 'hp_potion', 5); R.shop.back.push({ it: c(R, 'hp_potion', 2), price: 1 }); h.gold = 1; SIMX.buy(S, R, R.shop.back[R.shop.back.length - 1], true);
        if (ns(h.bag) !== '7') out.push(`stacks: 2 potions bought back beside 5 give ${ns(h.bag)}, not one stack of 7`); } } }
  // the bottom panel never covers the hero (TASKS 1911): with him on the lowest walkable cells of the town and of a few floors, at
  // every zoom and view height and the cursor pulling the look down, his feet stay over the panel's top
  function checkHudFoot(out) { const h0 = SIMX.VIEW.H, top = D.UI.bp.h + D.UI.bp.foot;
    const lowest = (m, ok) => { const r = []; for (let x = 0; x < m.W; x++) for (let y = m.H - 1; y >= 0; y--) if (ok[y * m.W + x]) { r.push([x, y]); break; } return r.sort((p, q) => q[1] - p[1]).slice(0, 6); };
    const runs = [townRun().run].concat([3, 8].map((f) => { const S = spawn(0, {}), R = newRun(S, 'campaign', 91 + f); SIMX.enterFloor(S, R, f); return R; }));
    for (const R of runs) { const m = R.map, ok = m.town ? DG.townWalk(m) : m.cells.map((c) => c === 1), h = R.hero;
      for (const vh of D.VIEW_H) { SIMX.setView(vh); for (const z of D.ZOOMS) { R.zoom = z; const w = SIMX.WIN(R);
        for (const [x, y] of lowest(m, ok)) { h.x = (x + 0.5) * TILE; h.y = (y + 0.9) * TILE; R.camLook = [0, w.H / 2 * SIMX.CAM_LOOK]; SIMX.snapCam(R);
          const py = (h.y + SIMX.CAM_FEET - R.cam[1]) * z; if (py > vh - top + 0.5) { out.push(`hud foot: ${m.town ? 'the town' : 'floor ' + R.floor}'s cell ${x},${y} at ×${z}, view ${vh}: the hero's feet at ${py.toFixed(0)} px are under the bottom panel's top ${vh - top}`); return SIMX.setView(h0); } } } } }
    // TASKS 1951 а: away from the map's edges the hero's middle stands halfway between the frame's top and the panel's (bend_s84_f14)
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 84, { town: true }); SIMX.enterFloor(S, R, 14); const h = R.hero, m = R.map; R.zoom = 1; h.x = m.W * TILE / 2; h.y = m.H * TILE / 2; R.camLook = [0, 0]; SIMX.snapCam(R);
      const up = h.y - 30 - R.cam[1], down = SIMX.VIEW.H - top - up; if (Math.abs(up - down) > 20) out.push(`camera: over the hero ${up.toFixed(0)} px of the view, under him to the panel ${down.toFixed(0)}, not even within 20`); }
    SIMX.setView(h0); }
  // TASKS 1732: on the open cells of the town and of a few floors nearest each side and corner, at every zoom and view height, the look
  // still and pulling him toward that edge, the camera stands where it aims, so the hero is where he is away from the edges: never under
  // the HUD's corners (tools/camsafe.mjs measures that by the HUD's own zones in the page), never off in the void
  function checkCamAim(out) { const h0 = SIMX.VIEW.H;
    const runs = [townRun().run].concat([1, 3, 8, 14].map((f) => { const S = spawn(0, {}), R = newRun(S, 'campaign', 60 + f); SIMX.enterFloor(S, R, f); return R; }));
    try { for (const R of runs) { const m = R.map, h = R.hero, edges = SIMX.camEdges(m, m.town ? DG.townWalk(m) : m.cells.map((c) => c === 1));
      for (const vh of D.VIEW_H) { SIMX.setView(vh); for (const z of D.ZOOMS) { R.zoom = z; const w = SIMX.WIN(R);
        for (const e of edges) for (const lk of [[0, 0], [-e.dx * w.W / 2 * SIMX.CAM_LOOK, -e.dy * w.H / 2 * SIMX.CAM_LOOK]]) {
          h.x = (e.x + 0.5) * TILE; h.y = (e.y + 0.5) * TILE; R.camLook = lk; SIMX.snapCam(R);
          const off = Math.hypot(R.cam[0] - (h.x - w.W / 2 + lk[0]), R.cam[1] - (SIMX.camAimY(R, h) + lk[1]));
          if (off > 0.5) { out.push(`camera aim: ${m.town ? 'the town' : 'floor ' + R.floor}'s cell ${e.x},${e.y} (edge ${e.dx},${e.dy}) at ×${z}, view ${vh}: the camera stops ${off.toFixed(0)} px short of its aim on the hero`); return; } } } } } }
    finally { SIMX.setView(h0); } }
  // every count of a currency in one look (TASKS 2084): one record of DATA.UI.purse with no per-currency style, and its layout gives a
  // group's plates one size, each icon one place by its plate, each number its plate's middle, whatever the values and alignment
  function checkPurse(out) {
    const P = UI.purse, K = UI.kit; if (!P || !K.purseLay || !K.purseBox) { out.push('purse: no shared layout for the counts of gold and shards (DATA.UI.purse, UI.kit.purseLay)'); return; }
    for (const k of ['gold', 'shards', 'key']) if (!P.icons[k]) out.push(`purse: no icon for ${k}`);
    const per = Object.keys(P).filter((k) => k !== 'icons' && P[k] && typeof P[k] === 'object' && !Array.isArray(P[k]));
    if (per.length) out.push(`purse: DATA.UI.purse holds a style by currency (${per.join(', ')}); the look is one for all`);
    const measure = (s, size) => String(s).length * size * 0.6, row = (...q) => q.map(([k, s]) => ({ k, s }));
    const cases = [[row(['gold', '56']), row(['shards', '81'])], [row(['gold', '999999']), row(['shards', '7'], ['key', '1'])], [row(['gold', '0'], ['shards', '99999'])], [row(['shards', '81'])]];
    for (const rows of cases) for (const al of [0, 0.5, 1]) {
      const at = K.purseLay(rows, 500, 100, measure, al), B = K.purseBox(rows, measure), tag = rows.map((r) => r.map((q) => q.k + ' ' + q.s).join(' + ')).join(' / ') + ' at ' + al;
      const one = (f) => new Set(at.map(f)).size === 1;
      if (!one((q) => q.plate.w + 'x' + q.plate.h)) out.push(`purse: the plates of ${tag} differ in size`);
      if (!one((q) => [q.icon.x - q.plate.x, q.icon.y - q.plate.y, q.icon.s].join())) out.push(`purse: the icons of ${tag} stand apart from their plates differently`);
      for (const q of at) {
        if (q.ic !== P.icons[q.k]) out.push(`purse: ${q.k} in ${tag} has the icon ${q.ic}, not ${P.icons[q.k]}`);
        if (measure(q.s, P.size) > q.plate.w - 2 * P.padX) out.push(`purse: ${q.k} ${q.s} in ${tag} runs past its plate's margins`);
        if (Math.abs(q.c[0] - (q.plate.x + q.plate.w / 2)) > 0.5 || Math.abs(q.c[1] - P.ty - (q.plate.y + q.plate.h / 2)) > 0.5) out.push(`purse: ${q.k} in ${tag} is not on its plate's middle`); }
      const box = (q) => [q.icon.x, q.plate.y, q.plate.x + q.plate.w, q.plate.y + q.plate.h];
      for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) { const a = box(at[i]), b = box(at[j]);
        if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) out.push(`purse: ${at[i].k} and ${at[j].k} in ${tag} overlap`); }
      const x0 = Math.min(...at.map((q) => box(q)[0])), x1 = Math.max(...at.map((q) => box(q)[2]));
      if (Math.abs(x0 - Math.round(500 - B.w * al)) > 0.5 || Math.abs(x1 - x0 - B.w) > 0.5) out.push(`purse: ${tag} spans ${x0}..${x1}, not the ${B.w} px its box gives`); } }
  // the tracker's fold (TASKS 1992): its key flips the player's fold in play and on the pause
  function checkTrkFold(out) { const { S } = playing('warrior'), f0 = S.meta.trkFold ? 1 : 0;
    step(S, { keys: ['TrkFold'] }); if ((S.meta.trkFold ? 1 : 0) === f0) out.push('tracker: the fold key does not fold the done quests in play');
    S.screen = 'pause'; step(S, { keys: ['TrkFold'] }); if ((S.meta.trkFold ? 1 : 0) !== f0) out.push('tracker: the fold key does not unfold them on the pause');
    for (const [where, T] of [['a floor', playing('warrior').S], ['the town', townRun()]]) { const h0 = T.meta.trkHide ? 1 : 0; T.screen = 'play';
      step(T, { keys: ['TrkHide'] }); if ((T.meta.trkHide ? 1 : 0) === h0) out.push(`tracker: the hide key does not hide it on ${where}`);
      T.screen = 'pause'; step(T, { keys: ['TrkHide'] }); if ((T.meta.trkHide ? 1 : 0) !== h0) out.push(`tracker: the hide key does not show it again on the pause on ${where}`); } }
  // TASKS 2110: the tracker stands still under the minimap wherever the hero walks; over the town's adit it only drops rows, and its
  // plate keeps off the adit at any count of quests unless even one row cannot fit. Its width keeps under a quarter of the view however
  // long a line, every drawn line (rows, «и ещё N») sits inside its box, a fitted line ends inside its right edge, and hidden it is a
  // small chip. Windows from the author's 2576×1456 down to 800×600
  function checkTrkAdit(out) { const K = UI.kit, T = K.TRACKER, h0 = SIMX.VIEW.H; if (!K.trkLay || !K.trkFit) { out.push('tracker: no shared layout (UI.kit.trkLay, trkFit)'); return; }
    const fs = require('fs'), path = require('path'), src = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
    const px = /"adit_tw": \{"w": (\d+), "h": (\d+)/.exec(src('assets.js')), ht = /\badit_tw: (\d+)/.exec(src('sizes.js'));
    if (!px || !ht) { out.push('tracker: the adit\'s painting size is not found in assets.js / sizes.js'); return; }
    const W = SIMX.VIEW.W, sh = +ht[1], sw = Math.round(sh * px[1] / px[2]), hit = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
    const plate = (L) => [L.x - T.out, L.y - T.out, L.w + 2 * T.out, L.h + 2 * T.out], wins = [[2576, 1456], [1920, 1080], [1600, 900], [1366, 768], [1280, 720], [1024, 768], [800, 600]];
    const cap = K.trkMaxW(W), half = T.textH / 2, measure = (s, size) => String(s).length * size * 0.6;
    if (cap > W / 4) out.push(`tracker: its width ceiling ${cap} px is over a quarter of the view's ${W}`);
    const longest = Object.values(D.QUESTS).map((q) => q.name).concat(['«Ларец с накладными» · 3-й этаж · в тайной комнате', 'Нитежуй Гостеприимный · 3-й этаж · в тайной комнате за водопадом']);
    for (const s of longest) for (const size of [T.size.name, T.size.line]) { const L = K.trkLay(W, 400, 4000, 6, null), f = K.trkFit(s, L.textW, size, measure);
      if (measure(f, size) > L.textW || L.textX + L.textW > L.x + L.w) { out.push(`tracker: the line «${s}» runs past its right edge (${(L.textX + measure(f, size) - L.x - L.w).toFixed(0)} px)`); break; } }
    const test = (tag, vh, mmBot, w, n, adit) => { const L = K.trkLay(W, mmBot, w, n, adit), F = K.trkLay(W, mmBot, w, n, null), bot = L.y + L.h;
      if (L.x !== F.x || L.y !== F.y || L.w !== F.w) return `tracker: ${tag} moves it to ${L.x},${L.y} from its place ${F.x},${F.y} under the minimap`;
      if (L.w > cap || L.w < Math.min(w, T.minW)) return `tracker: ${tag} is ${L.w} px wide, over its ceiling ${cap}`;
      if (L.fold && (!n || L.h !== T.chip || L.n)) return `tracker: ${tag} folds to a ${L.w}×${L.h} box with ${L.n} rows, not to its chip`;
      if (L.n + L.more !== n || L.n > T.rows || (L.n < Math.min(1, n) && !L.fold) || L.rows.length !== L.n) return `tracker: ${tag} shows ${L.n} rows and ${L.more} more of ${n} quests`;
      let top = L.titleY + half; for (const r of L.rows) { if (r.nameY - half < top - 0.5 || r.lineY - r.nameY < T.textH - 0.5) return `tracker: ${tag} draws a row over the line above it`; top = r.lineY + half; }
      if (L.more && L.moreY - half < top - 0.5) return `tracker: ${tag} draws «и ещё ${L.more}» over its last row`;
      if ((L.more ? L.moreY + half : top) > bot + 0.5) return `tracker: ${tag} draws its last line ${((L.more ? L.moreY + half : top) - bot).toFixed(0)} px under the box's foot`;
      if (bot > vh) return `tracker: ${tag} runs ${bot - vh} px off the view's bottom`;
      if (L.n && hit(plate(L), adit)) return `tracker: ${tag} covers the adit with ${L.n} rows`;
      const C = K.trkLay(W, mmBot, 160, n, adit, true); if (C.h > T.chip || C.w > cap || (L.n && C.h * 2 > L.h) || C.x !== W - T.right - C.w || C.y !== L.y) return `tracker: ${tag} hidden is a ${C.w}×${C.h} chip at ${C.x},${C.y}, not a small one in its place`;
      return null; };
    const town = townRun().run, m = town.map, d = m.decor.find((o) => o.role === 'adit'), walk = DG.townWalk(m), sc = d && (d.s || 1);
    if (!d) { out.push('tracker: the town has no adit to keep off'); return; }
    try { for (const [ww, wh] of wins) { const vh = SIMX.setView(SIMX.viewFor(ww, wh)), boxes = [];
      for (const z of D.ZOOMS) { const aw = sw * sc * z, ah = sh * sc * z; for (let ax = -aw; ax < W; ax += 40) for (let ay = -ah; ay < vh; ay += 20) boxes.push([`adit at ${ax.toFixed(0)},${ay.toFixed(0)} ×${z}`, [ax, ay, aw, ah]]); }
      for (const z of [1, D.ZOOMS[D.ZOOMS.length - 1]]) { town.zoom = z; const aw = sw * sc * z, ah = sh * sc * z;
        for (let k = 0; k < walk.length; k += 5) { if (!walk[k]) continue; const cx = k % m.W, cy = Math.floor(k / m.W);
          town.hero.x = (cx + 0.5) * TILE; town.hero.y = (cy + 0.5) * TILE; town.camLook = [0, 0]; SIMX.snapCam(town);
          boxes.push([`the hero on the town's cell ${cx},${cy} ×${z}`, [(d.x - town.cam[0]) * z - aw / 2, (d.y - town.cam[1]) * z + 4 * z - ah, aw, ah]]); } }
      for (const mmBot of [240, 360, 480, 620]) for (const w of [200, 420, 860, 2000]) for (let n = 0; n <= 7; n++) for (const [at, adit] of boxes) {
        const e = test(`${ww}×${wh}, minimap foot ${mmBot}, width ${w}, ${n} quests, ${at}`, vh, mmBot, w, n, adit); if (e) { out.push(e); return; } } } }
    finally { SIMX.setView(h0); } }
  // TASKS 2117: every way in the ring of stones keeps its name and its line inside its row, and the death modes' lines on the
  // statistics page inside it, measured by the font the page draws them in (UI.kit.face and the TTF's advances), not by letters
  function checkLabelFit(out) { const { fitW } = SIMX.checks.kit, C = D.RUNS.campaign, bosses = [];
    for (let f = 1; f <= C.floors; f++) { const b = D.ENEMIES[D.stageOf('campaign', f).boss]; if (b) bosses.push([b.name, f]); }
    const fits = (what, s, w, size, floor) => { const r = fitW(s, w, size); if (r.cut || r.size < floor) out.push(`${what}: «${s}» is ${r.w.toFixed(0)} px at ${r.size} px, its room ${w}`); };
    for (let n = 1; n <= bosses.length + 2; n++) for (const b of D.UI.gate(n).r.filter((q) => q.full)) { const iw = b.tw;
      for (const k of ['hud.gate.5', 'hud.gate.hall', 'hud.gate.boss.2']) fits('ring of stones', TXT(k), iw, 18, 18);
      fits('ring of stones', TXT('hud.gate.3', { f: C.floors }), iw, 26, 20);
      for (const [name, f] of bosses) fits('ring of stones', TXT('hud.gate.boss', { name, f }), iw, 26, 20); }
    // TASKS 2127: with every hall of the campaign and the portal the ring's rows keep their second line, the window on the screen
    { const G = D.UI.gate(bosses.length + 1); if (G.r.some((q) => q.i !== undefined && !q.full)) out.push(`ring of stones: with ${bosses.length + 1} ways a row loses its second line`);
      if (G.P.y < 0 || G.P.y + G.P.h + 60 > D.VIEW_H[0]) out.push(`ring of stones: with ${bosses.length + 1} ways the window spans ${G.P.y}..${G.P.y + G.P.h}, its help line off the screen`); }
    // the start screen's lines on the two modes (TASKS 2127), each on one line right of the hardcore box up to the cards' right edge
    { const CU = UI.classes({}), hb = CU.find((q) => q.id === 'hard');
      for (const s of [TXT('UI.classes.normal.note', { pct: Math.round(D.BAL.deathXpLoss * 100) }), TXT('UI.classes.hard.note')]) fits('start screen', s, D.classesRight(CU) - hb.x - hb.w, 19, 19); }
    const U = D.UI.stats();
    // the normal death's toast (TASKS 2126): each of its two lines whole on one line of the toast, the widest number in it
    { const T = D.TOAST, xp = String(Math.round(D.xpNeed(99) * D.BAL.deathXpLoss));
      for (const s of [TXT('sim_ui.fell.msg', { xp }), TXT('sim_ui.fell.msg.none'), TXT('sim_ui.fell.way.first'), TXT('sim_ui.fell.way.portal', { f: C.floors }), TXT('sim_ui.fell.way.boss', { f: C.floors })]) fits('death toast', s, T.one, T.size2, T.size2); }
    // the quantity window's count with its top (town_game_r10 2), the widest a stack or a purse gives, between its − and +
    { const { fontW } = SIMX.checks.kit, N = D.UI.split().num, w = fontW('999', 40, true) + 10 + fontW(TXT('hud.split.of', { n: 999 }), 22); if (w > N.w) out.push(`quantity window: «999 ${TXT('hud.split.of', { n: 999 })}» is ${w.toFixed(0)} px, its room ${N.w}`); }
    for (const k of D.DEATH_ORDER) fits('statistics', TXT('hud.stats.mode', { name: D.DEATH_MODES[k].name, w: '999', d: '99 999', b: C.floors }), U.modeW, 22, 20); }
  // a test run is ended, not given up (TASKS 1916): the pause's end button says so, its question's «yes» too, and the result is marked a test
  function checkTestEnd(out) { const S = spawn(0, {}); SIMX.startRun(S, 'magma'); const R = S.run; S.screen = 'pause'; S.t = R.t = 10;
    const ab = UI.pause(S.meta.zoom, false, true).find((b) => b.id === 'abandon');
    if (!R.test) out.push('test end: a run from the tests screen is not marked a test');
    { const S2 = SIMX.spawn(0, JSON.parse(JSON.stringify(root.SIM.persist(S)))); if (!(S2.saved || S2.saves.find(Boolean) || {}).test) out.push('test end: a saved test run loads without its test mark, so the load screen names it a plain run (TASKS 2003)'); }
    if (!ab || ab.label !== TXT('UI.pause.test')) out.push(`test end: the pause's end button of a test run reads ${ab && ab.label}`);
    press(S, ab); if (!S.pauseAsk) { out.push('test end: the end button asks nothing'); return; }
    press(S, UI.pauseAsk(false, true).r.find((b) => b.id === 'yes'));
    if (!S.result || !S.result.test || !S.result.abandoned) out.push(`test end: an ended test leaves the result ${JSON.stringify(S.result && { test: S.result.test, abandoned: S.result.abandoned })}`); }
  // STR does something for every class (TASKS 1913): a point more moves a number the class's own weapon uses, the mage's poise softens a
  // blow's shove, and no class's affix pool leaves STR out
  function checkStrUse(out) { for (const cl of ['warrior', 'mage', 'archer']) { const S = spawn(0, {}), R = newRun(S, 'campaign', 7, { cls: cl }), h = R.hero; S.run = R;
    const a = SIMX.stats(h, S.meta), b = SIMX.stats(Object.assign({}, h, { base: Object.assign({}, h.base, { str: h.base.str + 1 }) }), S.meta);
    if (!(b.atk > a.atk || b.poise > a.poise)) out.push(`str: a point of STR changes nothing a ${cl} with ${a.wtype} uses`);
    if (D.CLASSES[cl].dead.mods.includes('str')) out.push(`str: a ${cl}'s items never roll STR`);
    if (cl === 'mage') { if (!(b.poise > a.poise)) out.push('str: STR gives the mage no poise');
      const shove = (str) => { const S2 = spawn(0, {}), R2 = newRun(S2, 'campaign', 7, { cls: cl }), q = R2.hero; S2.run = R2; S2.screen = 'play'; S2.t = R2.t = 10; q.base.str = str; q.ifr = 0; q.dashT = -9; q.hp = 1e4; q.vx = q.vy = 0; q.base.agi = 0;
        let n = 0; while (q.vx === 0 && n++ < 50) SIMX.hurtHero(S2, R2, 5, q.x - 30, q.y); return q.vx; };
      if (!(shove(20) < shove(0))) out.push('str: a strong mage is thrown as far as a weak one'); } } }
  // an offer's key words (TASKS 1995): every page of every giver's offer opens and shuts its **…** marks, the giver's name in it is
  // marked whole, and a name never marks a longer word it starts
  function checkKeyWords(out) { const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { town: 1 }); S.run = R;
    const own = R.offers; for (const [role, key] of own.map((o) => [o.from, o.key]).concat(...Object.keys(D.QUEST_SAY).map((r) => Object.keys(D.QUESTS).filter((k) => D.QUESTS[k].kind === 'side').map((k) => [r, k])))) {
      R.offers = own.some((o) => o.from === role && o.key === key) ? own : [{ key, from: role, q: 0 }]; const qt = SIMX.questTalk(R, role); if (!qt || !qt.act || qt.act.k !== 'take') continue;
      for (const p of qt.pages) { const n = (p.match(/\*\*/g) || []).length;
        if (n % 2 || /\*/.test(p.replace(/\*\*/g, ''))) out.push(`key words: ${role}/${key} leaves a mark open: ${p.slice(0, 80)}`);
        for (const f of Object.values(D.FOLK)) if (f.name && p.includes(f.name) && !p.includes('**' + f.name + '**') && !new RegExp('\\p{L}' + f.name + '|' + f.name + '\\p{L}', 'u').test(p)) out.push(`key words: ${role}/${key} leaves ${f.name} unmarked`); }
      if (!qt.pages[qt.pages.length - 1].startsWith('**«' + D.QUESTS[qt.act.key].name + '».**')) out.push(`key words: ${role}/${qt.act.key}'s last page does not open with its title`); }
    { const k = D.FOLK.child.name, s = SIMX.keyNames(k + k + ' ' + k); if (s !== k + k + ' **' + k + '**') out.push(`key words: a short name marks a longer word it is part of: ${s}`); } }
  // the scene has no node entry, so the hero's drawing runs in a sandbox (live/sandbox.cjs) with its sprites' placements recorded
  // (TASKS 1896): on the world's grid the face snap holds the body still through a sub-pixel step, under L.pre (the menu's arch,
  // the victory screen) it must move with him, or a scaled hero jerks by whole world pixels
  function checkHudHero(out) { const { drawHero, L, calls } = require('./sandbox.cjs').heroBox(D, root.SIM);
    const S = spawn(0, {}), R = newRun(S, 'campaign', 5, {}); S.run = R;
    const h = Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face: 1, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), st = SIMX.heroSt(S);
    const draw = (x, pre) => { calls.length = 0; L.pre = pre; try { drawHero(h, x, 300, 10, st, {}); } finally { L.pre = null; } return calls.slice(); };
    const lag = (pre) => { const a = draw(100.1, pre), b = draw(100.45, pre); return a.length && a.length === b.length ? Math.max(...a.map((x, i) => Math.abs(b[i] - x - 0.35))) : NaN; };
    const world = lag(null), hud = lag([1, 0, 0, 1, 0, 0]);
    if (!(world > 0.3)) out.push(`hud hero: on the world's grid the face snap does not hold the body (lag ${world})`);
    if (!(hud < 1e-6)) out.push(`hud hero: under L.pre the body snaps to the world's pixels (lag ${hud})`); }
  function menuCheck() {
    const out = [];
    { const T = spawn(0, { meta: { zoom: 2, up: {} } }), at = (rs, id) => { const b = rs.find((q) => q.id === id); return { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }; };
      if (T.meta.zoom !== 1.5) out.push('settings: a saved ×2 does not become ×1,5');
      step(T, at(UI.menu(false, T.meta.diff, 0), 'settings')); step(T, { keys: ['ArrowLeft'] });
      if (T.screen !== 'settings' || T.meta.zoom !== 1.25) out.push('settings: the menu does not open them, or ← does not step the zoom');
      const r = UI.settings().r.find((q) => q.id === 'zoom'); step(T, { keys: [], click: 1, press: 1, px: r.x, py: r.y + r.h / 2 });
      if (T.meta.zoom !== D.ZOOMS[0]) out.push('settings: a click at the slider\'s left end does not set ×0,5');
      step(T, { keys: [], press: 0 }); step(T, { keys: ['ArrowDown'] }); step(T, { keys: ['ArrowRight'] }); if (T.meta.bright !== 1.2) out.push('settings: → on the brightness row does not brighten one step');
      step(T, { keys: ['ArrowDown'] }); step(T, { keys: ['ArrowLeft'] }); if (T.meta.vol !== 0.75) out.push(`settings: ← on the volume row does not step it down (${T.meta.vol})`);
      step(T, { keys: ['ArrowDown'] }); step(T, { keys: ['ArrowLeft'] }); step(T, { keys: ['ArrowLeft'] }); if (T.meta.amb !== 0.5 || T.meta.vol !== 0.75) out.push(`settings: the background row does not move apart from the effects (${T.meta.amb}, ${T.meta.vol})`);
      step(T, { keys: ['ArrowDown'] }); step(T, { keys: ['ArrowLeft'] }); if (T.meta.gfx !== 1) out.push('settings: ← on the graphics row does not step from high to middle (TASKS 1372)');
      // TASKS 1864: the fullscreen row is a checkbox, a click or Enter on it flips the wish kept in the meta
      const fr = UI.settings().r.find((q) => q.id === 'full'), n1 = T.saveN; step(T, { keys: [], press: 0 }); step(T, { keys: [], click: 1, press: 1, px: fr.x + fr.w / 2, py: fr.y + fr.h / 2 }); step(T, { keys: [], press: 0 });
      if (T.meta.full !== 1 || T.saveN === n1) out.push('settings: a click on «Полный экран» does not ask for the full screen, or the wish is not kept');
      step(T, { keys: ['Enter'] }); if (T.meta.full !== 0 || T.screen !== 'settings') out.push('settings: Enter on «Полный экран» does not turn it off');
      step(T, { keys: ['Escape'] }); if (T.screen !== 'menu') out.push('settings: Escape does not go back to the menu');
      // TASKS 1863 а: M mutes from any screen and says so, a second M gives the sound back
      const n0 = T.saveN; step(T, { keys: ['KeyM'] }); if (!T.meta.mute || T.muteT !== T.t || T.saveN === n0) out.push('mute: M does not mute, or the mute is not kept');
      step(T, { keys: ['KeyM'] }); if (T.meta.mute) out.push('mute: a second M does not give the sound back'); }
    // TASKS 1784: a zoom changed from the pause moves the camera at once, the world behind the pause framed as play will frame it
    { const T = spawn(0, { meta: { zoom: 1, up: {} } }); T.run = newRun(T, 'campaign', 31); T.screen = 'play'; for (let i = 0; i < 20; i++) step(T, { keys: [] });
      const R = T.run, h = R.hero; T.screen = 'pause'; step(T, { keys: [], click: 1, px: UI.pause(T.meta.zoom).find((q) => q.id === 'settings').x + 10, py: UI.pause(T.meta.zoom).find((q) => q.id === 'settings').y + 10 });
      step(T, { keys: ['ArrowLeft'] }); const z = R.zoom, cw = SIMX.WIN(R), mid = [R.cam[0] + cw.W / 2, R.cam[1] + cw.H / 2], c0 = [R.cam[0], R.cam[1]]; SIMX.snapCam(R);
      if (T.screen !== 'settings' || z === 1 || Math.hypot(R.cam[0] - c0[0], R.cam[1] - c0[1]) > 1 || Math.hypot(mid[0] - h.x, mid[1] - h.y) > cw.W / 2) out.push('settings: a zoom changed from the pause leaves the camera where the old zoom had it'); }
    // TASKS 1861: in a 16:10 view the windows' frame moves down, the menu's to the bottom edge and the rest to the middle, and a
    // click lands where the frame drew the button
    { const h0 = SIMX.VIEW.H; SIMX.setView(1200);
      try { const T = spawn(0, { meta: { up: {} } }), at = (scr, rs, id) => { const b = rs.find((q) => q.id === id); return { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 + SIMX.uiDy(scr) }; };
        if (SIMX.uiDy('menu') !== 120 || SIMX.uiDy('settings') !== 60 || SIMX.uiDy('play') !== 0) out.push(`view 16:10: the frame's shift is ${SIMX.uiDy('menu')} / ${SIMX.uiDy('settings')}, not 120 / 60`);
        step(T, at('menu', UI.menu(false, T.meta.diff, 0), 'settings')); if (T.screen !== 'settings') out.push('view 16:10: a click on «Настройки» misses');
        step(T, at('settings', UI.settings().r, 'back')); if (T.screen !== 'menu') out.push('view 16:10: a click on the settings\' «Назад» misses');
        const R = SIMX.newRun(T, 'campaign', 5); T.run = R; T.screen = 'play'; R.cam = [0, -1e6]; SIMX.clampCam(R, R.cam);
        if (Math.abs(R.cam[1] + 1200 / SIMX.zoomOf(R)) > 1) out.push('view 16:10: the camera\'s clamp keeps the 1080 window');
      } finally { SIMX.setView(h0); } }
    { const T = spawn(0, { meta: { up: {} } }), at = (rs, id) => { const b = rs.find((q) => q.id === id); return { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }; };
      if (UI.menu(false).some((q) => q.id === 'diff')) out.push('start: the menu still has its difficulty item');
      step(T, at(UI.menu(false), 'campaign')); if (T.screen !== 'classes') out.push('start: «Старт» does not open the difficulty and class screen');
      step(T, { keys: ['ArrowUp'] }); step(T, { keys: ['ArrowRight'] }); if (T.meta.diff !== 'hard') out.push('start: ↑ then → do not pick the hard difficulty');
      step(T, { keys: ['ArrowDown'] }); step(T, { keys: ['ArrowRight'] }); if (T.meta.cls !== D.classesReady()[1]) out.push('start: ↓ then → do not pick the next class');
      step(T, at(UI.classes(T.meta), 'dif:easy')); if (T.meta.diff !== 'easy') out.push('start: a click on a tab does not pick its difficulty');
      step(T, { keys: ['Escape'] }); step(T, at(UI.menu(false), 'campaign')); if (T.meta.diff !== 'easy' || T.meta.cls !== D.classesReady()[1]) out.push('start: the chosen difficulty and class are not kept');
      step(T, { keys: ['Enter'] }); if (!T.run || T.run.diff !== 'easy' || T.run.hero.cls !== D.classesReady()[1]) out.push('start: Enter does not start the run with the chosen difficulty and class'); }
    { const T = spawn(0, { meta: { runs: 5, wins: 1, up: {} } }), F = spawn(0, {}), key = (k) => step(T, { keys: [k] });
      if (T.meta.stats.from !== 5 || F.meta.stats.from !== 0) out.push('stats: the counters do not note the runs finished before them');
      T.run = newRun(T, 'campaign', 7, { cls: 'mage' }); T.screen = 'play'; const R = T.run;
      for (let i = 0; i < 120; i++) step(T, { keys: [] });
      const foe = R.en.find((e) => !D.BOSSES[e.type]); foe.elite = 1; killEnemy(T, R, foe); SIMX.giveShards(T, R, 3, R.hero.x, R.hero.y, ''); endRun(T, 'dead');
      const A = T.meta.stats.all, M = T.meta.stats.cls.mage || {};
      if (A.kills !== 1 || A.elites !== 1 || A.bosses || A.deaths !== 1 || A.runs !== 1 || M.runs !== 1 || M.kills !== 1 || !(A.time > 0.9) || !(A.shards >= 3) || A.shards !== M.shards) out.push('stats: a run\'s kill, elite, death, time or shards are not counted, or not for its class');
      if (T.meta.runs !== 6) out.push('stats: the meta\'s run count changed its rule');
      const L2 = spawn(1, JSON.parse(JSON.stringify(persist(T)))); if (L2.meta.stats.from !== 5 || L2.meta.stats.all.kills !== 1) out.push('stats: the counters are lost or restarted on load');
      T.screen = 'menu'; step(T, (() => { const b = UI.menu(false).find((q) => q.id === 'stats'); return { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }; })());
      if (T.screen !== 'stats' || T.statTab !== 'all') out.push('stats: the menu does not open the statistics');
      step(T, { keys: [], press: 0 }); key('ArrowRight'); if (T.statTab !== D.classesReady()[0] || T.focus !== 'tab:' + T.statTab) out.push('stats: → does not open the first class\'s tab');
      key('ArrowDown'); if (T.focus !== 'back') out.push('stats: ↓ does not reach «Назад»');
      key('Enter'); if (T.screen !== 'menu') out.push('stats: Enter on «Назад» does not go back to the menu'); }
    { const { slotRun, isFull } = SIMX, key = (S, k) => step(S, { keys: [k] }), J = (o) => JSON.parse(JSON.stringify(o));
      const at = (S, rs, id) => { const b = rs.find((q) => q.id === id); step(S, { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }); step(S, { keys: [], press: 0 }); };
      { const d = D.dateOf(1794182340000); if (d.d !== 8 || d.m !== 11 || d.y !== 2026 || d.h !== 23 || d.mi !== 59) out.push('saves: dateOf does not read 08.11.2026 23:59'); }
      const S0 = spawn(0, {}), old = J(newRun(S0, 'campaign', 21));
      const T = spawn(0, { meta: { up: {} }, run: old });
      if (!T.saved || T.slot !== 0 || T.saves.length !== D.SAVE_SLOTS || T.saves.some(Boolean) || slotRun(T, 0) !== T.saved) out.push('saves: a save from before the slots does not land in the first slot');
      T.screen = 'menu'; at(T, UI.menu(true), 'campaign'); if (T.screen !== 'classes') out.push('saves: with free slots a new run still asks to drop the saved one');
      key(T, 'Enter'); const fresh = T.run;
      if (!fresh || T.slot !== 1 || T.saves[0] !== old && (!T.saves[0] || T.saves[0].seed !== old.seed)) out.push('saves: a new run does not take a free slot, or the old run leaves its slot');
      T.screen = 'play'; step(T, { keys: [], now: 1794182340000 }); if (fresh.at !== 1794182340000) out.push('saves: the run in play does not keep the page\'s wall clock');
      T.screen = 'pause'; T.focus = 'dif:easy'; at(T, UI.pause(T.meta.zoom), 'save'); if (T.screen !== 'menu' || T.saved !== fresh) out.push('saves: «Сохранить и выйти» does not keep the run in its slot');
      if (T.focus) out.push('saves: back in the menu after «Сохранить и выйти» the focus is left from another screen (TASKS 1860)');
      const L2 = spawn(1, J(persist(T))); if (L2.slot !== 1 || !L2.saved || L2.saved.at !== 1794182340000 || !L2.saves[0] || L2.saves[0].seed !== old.seed || L2.saves.filter(Boolean).length !== 1) out.push('saves: the slots are not kept through save and load');
      at(L2, UI.menu(true), 'load'); if (L2.screen !== 'load' || L2.loadSel !== 1) out.push('saves: «Загрузить игру» does not open the list on the saved run');
      key(L2, 'ArrowUp'); key(L2, 'Enter'); if (L2.screen !== 'play' || !L2.run || L2.run.seed !== old.seed || L2.slot !== 0 || !L2.saves[1] || L2.saves[1].at !== 1794182340000) out.push('saves: ↑ and Enter do not load the first slot and keep the other');
      L2.screen = 'pause'; at(L2, UI.pause(L2.meta.zoom), 'save'); at(L2, UI.menu(true), 'load'); key(L2, 'ArrowDown');
      key(L2, 'Delete'); if (L2.delAsk !== 1 || L2.focus !== 'no') out.push('saves: Delete does not ask about the chosen slot with «Нет» first');
      key(L2, 'Enter'); if (L2.delAsk !== undefined || !L2.saves[1]) out.push('saves: «Нет» deletes the save or keeps asking');
      key(L2, 'Delete'); { const b = UI.load().yes.find((q) => q.id === 'yes'); step(L2, { keys: [], px: b.x + b.w / 2, py: b.y + b.h / 2 }); }
      if (L2.focus !== 'yes') out.push('saves: the pointer moved over «Да» does not take the focus, two buttons light (TASKS 1754)'); key(L2, 'Escape');
      key(L2, 'Delete'); key(L2, 'ArrowLeft'); key(L2, 'Enter'); if (L2.saves[1] || L2.delAsk !== undefined || !L2.saved) out.push('saves: «Да» does not delete the slot, or deletes another');
      key(L2, 'ArrowUp'); key(L2, 'Delete'); at(L2, UI.load().yes, 'yes'); if (L2.saved || slotRun(L2, 0)) out.push('saves: deleting the saved run by pointer does not empty its slot');
      key(L2, 'Escape'); if (L2.screen !== 'menu') out.push('saves: Escape does not go back to the menu');
      const F = spawn(0, {}); for (let i = 0; i < D.SAVE_SLOTS; i++) F.saves[i] = J(newRun(F, 'campaign', 30 + i)); F.saved = F.saves[2]; F.saves[2] = null; F.slot = 2;
      if (!isFull(F)) out.push('saves: five runs do not fill the slots');
      // TASKS 1785: with every slot taken a new run asks on the question sheet («Нет» first) and takes the place of the run played
      // longest ago, the saved one under «Продолжить» only when it is that run
      F.saves.forEach((r, i) => { if (r) r.at = 100 + i; }); F.saved.at = 102; F.saves[3].at = 50;
      if (SIMX.oldestSlot(F) !== 3) out.push('saves: the oldest slot is not the run played longest ago');
      at(F, UI.menu(true, F.meta.diff, F.meta.zoom, true), 'campaign'); if (F.screen !== 'menu' || F.newAsk !== 'campaign' || F.focus !== 'no' || F.run) out.push('saves: with every slot taken one press starts a run, or asks with «Да» first');
      key(F, 'Enter'); if (F.newAsk || F.run || F.screen !== 'menu') out.push('saves: Enter on «Нет» starts the run or keeps asking');
      at(F, UI.menu(true, F.meta.diff, F.meta.zoom, true), 'campaign'); key(F, 'ArrowLeft'); key(F, 'Enter'); key(F, 'Enter');
      if (!F.run || F.slot !== 3 || F.saves.filter(Boolean).length !== 4 || !F.saves.some((r) => r && r.seed === 32) || F.saves.some((r) => r && r.seed === 33)) out.push('saves: a new run over five taken slots does not take the oldest one\'s place, or loses the saved run');
      { const G = spawn(0, {}); for (let i = 0; i < D.SAVE_SLOTS; i++) { G.saves[i] = J(newRun(G, 'campaign', 60 + i)); G.saves[i].at = 100 + i; } G.saved = G.saves[1]; G.saves[1] = null; G.slot = 1; G.saved.at = 10;
        at(G, UI.menu(true, G.meta.diff, G.meta.zoom, true), 'campaign'); at(G, UI.newAsk().r, 'yes'); key(G, 'Enter');
        if (!G.run || G.slot !== 1 || G.saves.filter(Boolean).length !== 4 || G.saves.some((r) => r && r.seed === 61)) out.push('saves: a new run does not take the place of the saved run when it is the oldest'); }
      const E = spawn(0, {}); E.saves[3] = J(newRun(E, 'campaign', 41)); E.saves[3].at = 5; E.saves[1] = J(newRun(E, 'campaign', 42)); E.saves[1].at = 9;
      E.run = newRun(E, 'campaign', 43); E.slot = 0; E.screen = 'play'; endRun(E, 'dead'); E.screen = 'menu';
      if (!E.saved || E.saved.seed !== 42 || E.slot !== 1 || E.saves[1] || !E.saves[3] || !UI.menu(!!E.saved).some((b) => b.id === 'continue')) out.push('saves: after a death «Продолжить» does not name the latest run of the other slots');
      at(E, UI.menu(true, E.meta.diff, E.meta.zoom, isFull(E)), 'continue'); if (E.screen !== 'play' || !E.run || E.run.seed !== 42) out.push('saves: «Продолжить» after a death does not load the other slot\'s run');
      const E2 = spawn(0, {}); E2.run = newRun(E2, 'campaign', 44); E2.screen = 'play'; endRun(E2, 'dead'); E2.screen = 'menu';
      if (E2.saved || UI.menu(!!E2.saved).some((b) => b.id === 'continue') || spawn(1, J(persist(E2))).saved) out.push('saves: «Продолжить» shows with no run in any slot');
      // TASKS 1812: «Продолжить» gives the hero a moment under the floor's name: the monsters wait, then go on
      { const C = spawn(0, {}); C.run = newRun(C, 'campaign', 37); C.screen = 'play'; noWelcome(C); for (let i = 0; i < 20; i++) step(C, { keys: [] });
        const R = C.run, h = R.hero, e = R.en.find((q) => q.deadT < 0); R.en = [e]; Object.assign(e, { x: h.x + 44, y: h.y, st: 'chase', t0: C.t, seenT: C.t, cdT: 0, kbx: 0, kby: 0 });
        C.screen = 'pause'; at(C, UI.pause(C.meta.zoom), 'save'); at(C, UI.menu(true), 'continue');
        const hp = h.hp, p0 = [e.x, e.y]; for (let i = 0; i < 110; i++) step(C, { keys: [] });
        if (C.run !== R || h.hp < hp || Math.hypot(e.x - p0[0], e.y - p0[1]) > 1) out.push('continue: the monsters act at once on «Продолжить»');
        for (let i = 0; i < 360; i++) step(C, { keys: [] }); if (h.hp >= hp && Math.hypot(e.x - p0[0], e.y - p0[1]) < 1) out.push('continue: the monsters still wait long after «Продолжить»'); }
      // TASKS 1815: a locked ability pressed again and again keeps one refusal plate, refreshed, not a stack of copies
      { const Z = spawn(0, {}); Z.run = newRun(Z, 'campaign', 38); const R = Z.run, A = D.clsOf(R.hero).abs.find((q) => !R.hero.ab[q.id]);
        if (!A) out.push('nope: a new hero has no locked ability to press');
        else { for (let i = 0; i < 3; i++) { castAbility(Z, R, A.id, {}); Z.t += 0.3; } const n = D.feedOf(Z.ev, Z.t).filter((q) => q.k === 'nope'), last = n.at(-1);
          if (n.length !== 1 || !last || Math.abs(last.t - (Z.t - 0.3)) > 1e-9) out.push(`nope: a locked ability pressed three times leaves ${n.length} plates, or an old one`);
          // the bus itself keeps every refusal, for whoever listens to it (review of PR 57), and two refusals without words stay two
          if (Z.ev.filter((q) => q.k === 'nope').length !== 3) out.push('nope: the event bus drops a refusal said again');
          SIMX.ev(Z, { k: 'nope' }); SIMX.ev(Z, { k: 'nope' }); if (Z.ev.filter((q) => q.k === 'nope' && !q.s).length !== 2) out.push('nope: two refusals without words come out of the bus as one'); } }
      const E3 = spawn(1, J({ meta: E.meta, run: null, slot: 0, saves: [null, null, Object.assign(J(old), { at: 3 }), null, null] })); if (!E3.saved || E3.slot !== 2) out.push('saves: a load with no named run does not name the run in the slots');
      const k2 = (S, k) => { step(S, { keys: [k] }); step(S, { keys: [] }); }, K = spawn(0, {}); K.saved = J(newRun(K, 'campaign', 45)); K.screen = 'menu'; K.focus = '';
      k2(K, 'ArrowDown'); if (K.focus !== 'campaign') out.push('menu: the first ↓ does not step past the item already sealed (TASKS 1887 г)');
      k2(K, 'ArrowDown'); k2(K, 'Enter'); if (K.screen !== 'load') out.push('menu: Enter on the focused «Загрузить игру» does not open it');
      key(K, 'Escape'); step(K, { keys: [] }); if (K.screen !== 'menu' || K.focus !== 'load') out.push('menu: back from «Загрузить игру» the focus is not on it (TASKS 1860)');
      for (const id of ['stats', 'settings']) { K.focus = id; k2(K, 'Enter'); k2(K, 'Escape'); if (K.screen !== 'menu' || K.focus !== id) out.push('menu: back from ' + id + ' by Escape the focus is not on it (TASKS 1860)'); }
      K.focus = 'settings'; k2(K, 'ArrowDown'); k2(K, 'Enter'); if (K.screen !== 'news') out.push('menu: ↓ Enter after coming back does not go on from the item left');
      K.screen = 'menu'; K.uiWas = 'menu'; K.focus = ''; k2(K, 'ArrowUp'); if (K.focus !== 'news') out.push('menu: ↑ from no focus does not reach «Что нового»');
      k2(K, 'Enter'); if (K.screen !== 'news') out.push('menu: Enter on «Что нового» does not open it');
      // TASKS 1873: the link to the whole changelog lies on the version's sheet, under its main lines, and is the menu's last stop
      { const F = UI.newsFrame(), nl = UI.menu(true).at(-1), P = F && F.P, last = F && F.rows.at(-1);
        if (!F || nl.id !== 'news' || nl.x < P.x || nl.y < P.y || nl.x + nl.w > P.x + P.w || nl.y + nl.h > P.y + P.h || (last && nl.y < last.y)) out.push('menu: the link to «Что нового» is not the last stop under the version sheet\'s lines');
        const E = UI.newsFrame([]); if (!E || E.rows.length || !(E.link.y > E.P.y)) out.push('menu: with no main lines the version sheet does not keep its heading and link'); }
      // TASKS 1877: «Выход» only where the page can close its window; ↑↓ reach it, and a press saves a run in play and asks the page to quit
      { if (UI.menu(true).some((b) => b.id === 'quit')) out.push('menu: «Выход» shows where the page cannot close its window');
        const Q = spawn(0, {}); Q.screen = 'menu'; Q.focus = ''; step(Q, { keys: [], quit: 1 }); const ids = UI.menu(false, 0, 0, false, true).map((b) => b.id);
        if (!Q.canQuit || ids.at(-2) !== 'quit') out.push('menu: the desktop page\'s menu has no «Выход» before the version\'s link');
        k2(Q, 'ArrowUp'); k2(Q, 'ArrowUp'); if (Q.focus !== 'quit') out.push('menu: ↑ does not reach «Выход»');
        const R = Q.run = newRun(Q, 'campaign', 46); k2(Q, 'Enter'); if (Q.quitReq !== 1 || Q.run || Q.saved !== R) out.push('menu: «Выход» does not save the run in play and ask the page to quit');
        const B = spawn(0, {}); B.screen = 'menu'; B.focus = 'quit'; step(B, { keys: ['Enter'] }); if (B.quitReq) out.push('menu: «Выход» asks to quit where the page cannot'); }
      // TASKS 1870: the update's item and window. No state from the page, no item; the desktop's item stands before «Выход», a press
      // asks for a check and opens the window; its buttons ask the page for the download, the restart (saving a run in play first)
      // and a new try, by what failed; Escape closes it back onto the item. The browser's item shows only a newer version and its page
      { if (UI.menu(true, 0, 0, false, true).some((b) => b.id === 'update')) out.push('update: the item shows with no state from the page');
        const n = { v: 0 }, upd = (o) => Object.assign({ can: 1, st: 'idle', n: ++n.v }, o);
        const U = spawn(0, {}); U.screen = 'menu'; U.focus = ''; step(U, { keys: [], quit: 1, upd: upd() }); const ids = UI.menu(false, 0, 0, false, true, U.upd).map((b) => b.id);
        if (ids.indexOf('update') < 0 || ids.indexOf('update') !== ids.indexOf('quit') - 1) out.push('update: the desktop menu has no «Проверить обновления» right before «Выход»');
        const ask = () => (U.updReq ? U.updReq.k : ''), was = () => (U.updReq ? U.updReq.n : 0);
        U.focus = 'update'; k2(U, 'Enter'); if (!U.updOpen || ask() !== 'check') out.push('update: the item does not open its window and ask for a check');
        let w = was(); step(U, { keys: [], upd: upd({ st: 'check' }) }); k2(U, 'Enter'); if (U.updOpen || U.focus !== 'update' || was() !== w) out.push('update: «Закрыть» over a check does not close back onto the item');
        step(U, { keys: [], upd: upd({ st: 'avail', v: '9.9.9', notes: [{ v: '9.9.9', items: D.relNotes('### A\n\n- one\n  two\n- three\n\n### B\n\n- four') }] }) });
        if (U.upd.notes[0].items.join('|') !== 'one two|three') out.push('update: a release\'s notes are not its first section\'s points: ' + U.upd.notes[0].items.join('|'));
        if (!D.updMark(U.upd)) out.push('update: a version found leaves no mark on the menu');
        { const long = 'Доспехи складываются аккуратнее, а запасная броня в сумке больше не мешает носить оружие и щит вместе со всем остальным добром', Z = UI.upd({ st: 'avail', v: '9.9.9', notes: [{ v: '9.9.9', items: [long] }] }).rows.filter((r) => r.k === 'note');
          if (Z.length !== 2 || !Z[1].s.endsWith('…') || Z[1].s.length > 48) out.push('update: a long «Что нового» point is not two lines ending in «…» within the width: ' + Z.map((r) => r.s).join('|'));
          else if (!long.split(' ').includes(Z[1].s.slice(0, -1).split(' ').pop())) out.push('update: a long «Что нового» point is cut inside a word: ' + Z[1].s); }
        U.focus = 'update'; w = was(); k2(U, 'Enter'); if (was() !== w) out.push('update: the item asks for a new check over a version already found');
        k2(U, 'Enter'); if (ask() !== 'get') out.push('update: «Обновить» does not ask for the download');
        step(U, { keys: [], upd: upd({ st: 'err', err: 'down', v: '9.9.9' }) }); k2(U, 'Enter'); if (ask() !== 'get') out.push('update: a new try after a broken download does not download again');
        step(U, { keys: [], upd: upd({ st: 'err', err: 'net' }) }); k2(U, 'Enter'); if (ask() !== 'check') out.push('update: a new try offline does not check again');
        const R = U.run = newRun(U, 'campaign', 47); step(U, { keys: [], upd: upd({ st: 'ready', v: '9.9.9' }) }); k2(U, 'ArrowRight'); k2(U, 'ArrowLeft'); k2(U, 'Enter');
        if (ask() !== 'run' || U.run || U.saved !== R) out.push('update: «Перезапустить» does not save the run in play and ask for the restart');
        k2(U, 'Escape'); if (U.updOpen || U.screen !== 'menu') out.push('update: Escape does not close the window');
        // TASKS 2089: the notes are every release after the installed one up to the found one, the newest first; «Обновить» restarts the game
        // as soon as the download is in and the main menu is up, and a download that ends in a run waits for the menu
        { const rel = (v, b) => ({ tag_name: 'v' + v, body: b }), list = [rel('0.5.2', '### Х\n\n- b'), rel('0.5.4', '- d'), rel('0.5.3', '### Самое главное\n\n- a\n- aa'), rel('0.5.1', '- c'), rel('0.5.5', '- e'), rel('0.5.0', '')];
          const L = D.relLog(list, '0.5.1', '0.5.4'); if (L.map((r) => r.v).join('|') !== '0.5.4|0.5.3|0.5.2' || L[1].items.join('|') !== 'a|aa') out.push('update: the releases between the installed and the found are wrong: ' + JSON.stringify(L));
          if (D.relLog(null, '0.5.1', '0.5.4').length) out.push('update: no list gives some releases');
          const rels = (n) => Array.from({ length: n }, (_, i) => ({ v: '0.5.' + (n + 2 - i), items: ['один пункт журнала для проверки окна', 'второй пункт журнала, подлиннее первого, чтобы не вместился в одну строку окна обновления', 'третий', 'четвёртый'] }));
          for (const n of [2, 3, 4, 9]) { const Z = UI.upd({ st: 'avail', v: '9.9.9', notes: rels(n) }), nr = Z.rows.filter((r) => r.k === 'note' || r.k === 'ver' || r.k === 'more'), vers = Z.rows.filter((r) => r.k === 'ver').length;
            if (vers !== Math.min(n, 3) || (Z.rows.some((r) => r.k === 'more') !== n > 3) || nr.length > 9) out.push('update: ' + n + ' releases do not fit the notes\' room: ' + vers + ' versions, ' + nr.length + ' rows');
            if (Z.A.y + Z.A.h > 968) out.push('update: ' + n + ' releases push the window below the keys\' line: ' + (Z.A.y + Z.A.h)); }
          const mk = (st) => { const C = spawn(0, {}); C.screen = 'menu'; step(C, { keys: [], quit: 1, upd: upd({ st: 'avail', v: '9.9.9' }) }); C.focus = 'update'; k2(C, 'Enter'); k2(C, 'Enter'); step(C, { keys: [], upd: upd({ st, v: '9.9.9', pct: 40 }) }); return C; };
          const asked = (C) => (C.updReq ? C.updReq.k : '');
          let C = mk('down'); if (!C.updGo || asked(C) === 'run') out.push('update: «Обновить» does not hold the restart for the end of the download');
          const Rn = C.run = newRun(C, 'campaign', 48); C.screen = 'play'; step(C, { keys: [], upd: upd({ st: 'ready', v: '9.9.9' }) });
          if (asked(C) === 'run' || C.run !== Rn) out.push('update: a download that ends in a run restarts the game in play');
          C.screen = 'menu'; step(C, { keys: [] }); if (asked(C) !== 'run' || C.run || C.saved !== Rn || C.updGo) out.push('update: a download that ended in a run does not restart, saving the run, once the menu is up');
          C = mk('ready'); if (asked(C) !== 'run' || C.updGo) out.push('update: a download that ends on the main menu does not restart at once');
          C = mk('err'); C.screen = 'play'; step(C, { keys: [], upd: upd({ st: 'ready', v: '9.9.9' }) }); C.screen = 'menu'; step(C, { keys: [] }); if (C.updGo || asked(C) === 'run') out.push('update: a failed download still restarts the game later');
          C = spawn(0, {}); C.screen = 'menu'; step(C, { keys: [], quit: 1, upd: upd({ st: 'ready', v: '9.9.9' }) }); step(C, { keys: [] }); if (asked(C) === 'run') out.push('update: a download nobody asked for restarts the game'); }
        const B = spawn(0, {}); B.screen = 'menu'; step(B, { keys: [], upd: { web: 1, st: 'none', n: 1 } }); if (UI.menu(false, 0, 0, false, false, B.upd).some((b) => b.id === 'update')) out.push('update: the browser shows the item with no newer version');
        step(B, { keys: [], upd: { web: 1, st: 'web', v: '9.9.9', n: 2 } }); B.focus = 'update'; k2(B, 'Enter'); k2(B, 'Enter'); if (!B.updOpen || !B.updReq || B.updReq.k !== 'open') out.push('update: the browser\'s window does not open the release page');
        if (!D.verNewer('0.10.0', '0.9.9') || D.verNewer('v0.4.1', '0.4.1') || D.verNewer('0.4.0', '0.4.1')) out.push('update: versions compare wrong'); }
      K.screen = 'menu'; K.uiWas = 'menu'; K.focus = ''; k2(K, 'Enter'); if (K.screen !== 'play' || !K.run || K.run.seed !== 45) out.push('menu: Enter with no focus does not continue the saved run'); }
    { const { loadSlot, slotRun } = SIMX, J = (o) => JSON.parse(JSON.stringify(o)), play = (S, n) => { S.screen = 'play'; for (let i = 0; i < n; i++) step(S, { keys: [] }); };
      const save = (S) => { const b = UI.pause(S.meta.zoom).find((q) => q.id === 'save'); S.screen = 'pause'; step(S, { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }); step(S, { keys: [], press: 0 }); };
      const mage = (S, n) => { S.meta.cls = 'mage'; startRun(S, 'campaign'); play(S, n); const h = S.run.hero; h.ab.shield = 1; h.mp = 1e3; castAbility(S, S.run, 'shield', {}); play(S, 30);
        return { R: S.run, slot: S.slot, sh: h.shield, left: h.shieldUntil - S.t, cd: h.cd.shield - S.t }; };
      const kept = (S, A, tag) => { if (!loadSlot(S, A.slot) || S.run !== A.R) { out.push(`saves: ${tag}: the slot does not load its run`); return; } play(S, 1);
        const h = A.R.hero, left = h.shieldUntil - S.t, cd = h.cd.shield - S.t;
        if (!(A.sh > 0 && A.left > 5 && A.cd > 1)) out.push(`saves: ${tag}: the mage's shield or cooldown did not start (${A.sh}, ${A.left.toFixed(2)}, ${A.cd.toFixed(2)})`);
        else if (h.shield !== A.sh || Math.abs(left - A.left) > 0.1 || Math.abs(cd - A.cd) > 0.1) out.push(`saves: ${tag}: the shield ${A.sh} with ${A.left.toFixed(2)}s left and the ${A.cd.toFixed(2)}s cooldown come back as ${h.shield}, ${left.toFixed(2)}s, ${cd.toFixed(2)}s`);
        if (S.ev.some((e) => e.t > S.t)) out.push(`saves: ${tag}: the loaded run sees events from the future of another run`); };
      const S1 = spawn(0, {}), A1 = mage(S1, 60); save(S1); startRun(S1, 'campaign'); play(S1, 2400); save(S1); kept(S1, A1, 'B played longer');
      const S2 = spawn(0, {}), A2 = mage(S2, 2400); save(S2); const B2 = mage(S2, 60); save(S2); kept(S2, A2, 'A played longer'); save(S2); kept(S2, B2, 'back to the shorter B');
      const L = spawn(1, J(persist(S2))), A3 = { R: slotRun(L, A2.slot), slot: A2.slot, sh: A2.sh, left: A2.left, cd: A2.cd }; kept(L, A3, 'after a reload'); }
    for (let lvl = 1; lvl <= 32; lvl++) for (const slot of D.SLOTS) {
      const bases = Object.keys(BASES).filter((b) => BASES[b].slot === slot);
      for (const b of bases) for (let rar = 0; rar < RARITY.length; rar++) {
        const it = itemPower({ b, lvl, rar, mods: {} }), next = itemPower({ b, lvl: lvl + 1, rar, mods: {} });
        for (const k of ['atk', 'def']) if (it[k]) {
          if (next[k] < it[k]) out.push(`${b} r${rar} lvl${lvl}: ${k} falls with level`);
          if (rar < RARITY.length - 1) for (const other of bases) {
            const higher = itemPower({ b: other, lvl, rar: rar + 1, mods: {} });
            if (higher[k] < it[k]) out.push(`${other} r${rar + 1} lvl${lvl}: ${k} below ${b} r${rar}`);
          }
        }
      }
    }
    for (const seed of [1, 77, 4242]) {
      const R = { rs: seed };
      for (let lvl = 1; lvl <= D.RUNS.campaign.floors; lvl++) for (let i = 0; i < 100; i++) {
        const it = rollItem(R, lvl, i % 4), expected = itemPower({ b: it.b, rar: it.rar, lvl, mods: {} });
        if (it.atk !== expected.atk || it.def !== expected.def) out.push(`seed ${seed} lvl${lvl}: rolled item has wrong power`);
        if (Object.keys(it.mods).length !== RARITY[it.rar].affixes) out.push(`seed ${seed} lvl${lvl}: wrong affix count`);
      }
    }
    {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 81), h = R.hero;
      const make = (b, lvl, rar, def) => ({ id: R.nextId++, b, lvl, rar, def, mods: { vit: 3 } });
      h.eq.armor = make('leather_armor', 8, 4, 11); h.bag[2] = make('plate_armor', 6, 3, 16);
      R.drops.push({ kind: 'item', item: make('cloak', 8, 4, 7) });
      R.shop.goods[0].it = make('knight_helm', 6, 3, 8); R.shop.back.push({ it: make('leather_helm', 8, 4, 2), price: 50 });
      delete R.itemBalance;
      const T = spawn(0, { run: JSON.parse(JSON.stringify(R)) }), saved = T.saved;
      const items = [saved.hero.eq.armor, saved.hero.bag[2], saved.drops.at(-1).item, saved.shop.goods[0].it, saved.shop.back[0].it];
      for (const it of items) {
        if (it.def !== itemPower({ b: it.b, lvl: it.lvl, rar: it.rar }).def || it.mods.vit !== 3) out.push('saved equipment was not rebalanced without changing affixes');
      }
      if (items[0].def <= items[1].def) out.push('legendary lvl8 leather armor still loses to epic lvl6 plate');
      const speed = typeMods(items[0]).mspd;
      if (!(speed > typeMods({ b: 'leather_armor', lvl: 1, rar: 0 }).mspd) || itemMods(items[0]).mspd !== speed || itemMods(items[0]).vit !== 3) out.push('item type bonuses missing or not scaled');
      const before = JSON.stringify(saved); rebalanceRun(saved);
      if (JSON.stringify(saved) !== before) out.push('item rebalance is not idempotent');
      const H = JSON.parse(JSON.stringify(saved.hero)); H.eq.armor = null;
      if (Math.abs(stats(saved.hero, S.meta).mspd - stats(H, S.meta).mspd - speed) > 1e-6) out.push('leather armor speed bonus not applied');
      S.run = R; S.screen = 'play'; step(S, { keys: [] });
      if (R.itemBalance !== D.ITEM_BAL.version || h.eq.armor.def !== items[0].def) out.push('live reload equipment was not rebalanced');
    }
    return out;
  }
  // TASKS 2105: a giver's mark is centred on him and over his head within the gap while the head is on screen; off it, it is small and kept inside the screen.
  // TASKS 2125 (tools/measure/game/marks_hud.mjs moved here): the HUD is drawn over the world's marks, so over the town measured as the
  // page measures it (HUD.markZones in live/sandbox.cjs), the hero on every 3rd cell of the yard, a giver on every cell he can stand on,
  // the legend shut and open, one quest or four in the tracker, in the author's 2576×1456 and in 1920×1080 and 1366×768: no mark's box
  // touches a part, a mark over a clear head on the screen is full and over it, and a small one stays inside the screen's margin
  function checkQuestMark(out) {
    const W = 1920, H = 1080, k = 1, sh = 200, Q = D.QMARK, at = (x, y, hud) => D.questMarkAt(x, y, sh, k, W, H, hud, Q.margin);
    const inside = (a, w = W, h = H) => a.x - Q.w * Q.small / 2 >= Q.margin - 0.5 && a.x + Q.w * Q.small / 2 <= w - Q.margin + 0.5 && a.y - Q.h * Q.small / 2 >= Q.margin - 0.5 && a.y + Q.h * Q.small / 2 <= h - Q.margin + 0.5;
    for (const [x, y] of [[960, 700], [300, 500], [1600, 900], [100, 400], [1800, 1000]]) { const a = at(x, y), head = y - sh * k;
      if (a.small || a.x !== x) out.push(`quest mark: giver at ${x},${y} has his mark at x ${a.x}, small ${a.small}`);
      else if (Math.abs((head - (a.y + Q.h / 2)) - Q.gap) > 0.5) out.push(`quest mark: giver at ${x},${y} has the plate's foot ${Math.round(head - a.y - Q.h / 2)} px over his head, not ${Q.gap}`); }
    for (const [n, x, y] of [['left', -50, 600], ['right', W + 50, 600], ['above', 960, -40], ['below', 960, H + 60], ['head over the top', 960, 120], ['corner', -80, H + 80]]) { const a = at(x, y);
      if (!a.small) out.push(`quest mark: giver ${n} has a full-size mark`);
      else if (!inside(a)) out.push(`quest mark: giver ${n} has his mark at ${Math.round(a.x)},${Math.round(a.y)}, off the screen's margin`);
      else if (!a.edge[0] && !a.edge[1]) out.push(`quest mark: giver ${n} has no edge direction`); }
    const page = require('./sandbox.cjs').hudBox(D, root.SIM, SIMX.checks.kit.fontW), { SIZES } = page, h0 = SIMX.VIEW.H, S = townRun(), R = S.run, m = R.map, h = R.hero, walk = DG.townWalk(m);
    const heights = Object.keys(D.QUEST_SAY).map((r) => (SIZES['town_' + r] || [0, 0])[1]).filter(Boolean), hs = [Math.min(...heights), Math.max(...heights)];
    const cells = []; for (let c = 0; c < walk.length; c++) if (walk[c]) cells.push([(c % m.W + 0.5) * TILE, (Math.floor(c / m.W) + 0.5) * TILE]);
    const touch = (b, hud) => hud.find((z) => b[0] < z[2] && b[2] > z[0] && b[1] < z[3] && b[3] > z[1]), quest = (i, st) => ({ id: 900 + i, key: 'cull', f: 2 + i, need: 14, n: 0, st, from: 'porter', rw: D.questReward(['scroll', 'xp'], 2) });
    S.screen = 'play'; R.offers = [{ key: 'named', from: 'guard', q: 0 }, { key: 'fetch', from: 'child', q: 0 }]; R.legAuto = 0; R.msg = null; S.t = R.enteredT ?? S.t; R.zoom = 1;
    let marks = 0, under = 0, first = null, heads = 0, headSmall = 0;
    const roomNear = (x, y, hud, w, hh) => { for (let dy = 0; dy <= Q.nudge[1]; dy += 8) for (let dx = -Q.nudge[0]; dx <= Q.nudge[0]; dx += 8) { const b = D.questMarkBox(x + dx, y + dy, false), p = Q.hudPad; if (b[0] >= 0 && b[2] <= w && b[1] >= 0 && b[3] <= hh && !touch([b[0] - p, b[1] - p, b[2] + p, b[3] + p], hud)) return true; } return false; };
    try { for (const [ww, wh] of [[2576, 1456], [1920, 1080], [1366, 768]]) { const vh = SIMX.setView(SIMX.viewFor(ww, wh)), VWd = SIMX.VIEW.W;
      for (const leg of [0, 1]) for (const nq of [1, 4]) { R.mapLeg = leg; R.quests = Array.from({ length: nq }, (_, i) => quest(i, i ? 'taken' : 'done'));
        for (let c = 0; c < cells.length; c += 3) { [h.x, h.y] = cells[c]; R.camLook = [0, 0]; SIMX.snapCam(R); const z = R.zoom, cx = R.cam[0], cy = R.cam[1];
          const hud = page.HUD.markZones(S, R, { cx, cy, sx: (x) => (x - cx) * z, sy: (y) => (y - cy) * z, k: z });
          for (const [fx, fy] of cells) { const gx = (fx - cx) * z, gy = (fy - cy) * z; for (const sh of hs) { const a = D.questMarkAt(gx, gy, sh, z, VWd, vh, hud), b = D.questMarkBox(a.x, a.y, a.small), hit = touch(b, hud); marks++;
            const tag = `${ww}×${wh}, legend ${leg ? 'open' : 'shut'}, ${nq} quests, hero at ${Math.floor(h.x / TILE)},${Math.floor(h.y / TILE)}, a ${sh} px giver at ${Math.floor(fx / TILE)},${Math.floor(fy / TILE)}`;
            if (hit) { under++; first = first || `quest mark: ${tag}: its ${a.small ? 'small ' : ''}mark at ${Math.round(a.x)},${Math.round(a.y)} lies under the HUD's ${hit[4]}`; continue; }
            const head = gy - sh * z, full = D.questMarkBox(gx, head - Q.gap - Q.h / 2, false);
            const hy = head - Q.gap - Q.h / 2, onScr = gx >= 0 && gx <= VWd && gy >= 0 && gy <= vh && full[1] >= 0;
            if (onScr) { heads++; if (a.small) headSmall++; }
            if (a.small && onScr && !touch(full, hud)) first = first || `quest mark: ${tag}: his head is on the screen and clear of the HUD, but the mark is small`;
            // town_game_r10 4: a full mark nudged within Q.nudge of the head and clear of the HUD was there to take before a small one
            else if (a.small && onScr && ww === 1920 && roomNear(gx, hy, hud, VWd, vh)) first = first || `quest mark: ${tag}: a full mark fits within ${Q.nudge} px of his head, but the mark is small`;
            else if (!a.small && (Math.abs(a.x - gx) > Q.nudge[0] + 0.5 || a.y < hy - 0.5 || a.y - hy > Q.nudge[1] + 0.5)) first = first || `quest mark: ${tag}: the full mark at ${Math.round(a.x)},${Math.round(a.y)} is not by his head`;
            else if (a.small && !inside(a, VWd, vh)) first = first || `quest mark: ${tag}: the small mark at ${Math.round(a.x)},${Math.round(a.y)} is off the screen's margin`; } } } } } }
    finally { SIMX.setView(h0); }
    if (first) out.push(first + (under ? ` (${under} of ${marks} marks under the HUD)` : ''));
    // the share the r10 critic counted: of the givers whose head is on the screen, how many show the small mark (34 % before the nudge)
    if (headSmall > heads * Q.headSmall) out.push(`quest mark: ${headSmall} of ${heads} givers with the head on the screen show a small mark, over ${Q.headSmall * 100} %`); }
  // town_game_r10 2, 3: the quantity window's «−» at 1 and «+» at the top are dim and inert, a step past an end answers with the
  // refusal's sound and a shake of the count, the top is written «из N»; its keys and the ring's lie on their own plates
  function checkSplitEnds(out) {
    const page = require('./sandbox.cjs').hudBox(D, root.SIM, SIMX.checks.kit.fontW), K = page.KIT, btn = K.button, ink = K.ink, seen = {};
    K.button = (id, b, st, kind) => { seen[id] = st; return btn(id, b, st, kind); }; K.ink = (id, s2, ...a) => { seen[id] = s2; return ink(id, s2, ...a); };
    const draw = (S) => { for (const k in seen) delete seen[k]; page.HUD.draw(S, S.t); };
    try {
      const { S, R, h } = playing('warrior'); S.screen = 'inv'; h.bag.fill(null); h.bag[0] = Object.assign(SIMX.potion('hp_potion', 3), { id: R.nextId++ });
      const cell = UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab).r.find((q) => q.id === 'bag:0'), p = mid(S, cell); step(S, Object.assign({ keys: [], click: 1, press: 1, shift: 1 }, p)); step(S, Object.assign({ keys: [] }, p));
      const A = S.split; if (!A || A.hi !== 2) { out.push(`split ends: Shift+click on a stack of 3 asks ${JSON.stringify(A)}`); return; }
      const U = UI.split(), tap = (id) => press(S, U.r.find((q) => q.id === id)), nopes = () => S.ev.filter((e) => e.k === 'nope').length;
      A.n = A.hi; draw(S); if (!seen.sp_spPlus || !seen.sp_spPlus.off || seen.sp_spMinus.off) out.push(`split ends: at ${A.n} of ${A.hi} the «+» is ${seen.sp_spPlus && seen.sp_spPlus.off ? 'dim' : 'lit'}, the «−» ${seen.sp_spMinus && seen.sp_spMinus.off ? 'dim' : 'lit'}`);
      if (seen.sp_of !== TXT('hud.split.of', { n: A.hi })) out.push(`split ends: the top reads «${seen.sp_of}», not «${TXT('hud.split.of', { n: A.hi })}»`);
      let n0 = nopes(); tap('spPlus'); if (A.n !== A.hi || nopes() !== n0 + 1 || !A.bump || A.bump.d !== 1) out.push(`split ends: «+» at the top leaves ${A.n} with ${nopes() - n0} refusals, bump ${JSON.stringify(A.bump)}`);
      tap('spMinus'); tap('spMinus'); draw(S); if (A.n !== 1 || !seen.sp_spMinus.off || seen.sp_spPlus.off) out.push(`split ends: at 1 the «−» is not the dim one (n ${A.n})`);
      n0 = nopes(); step(S, { keys: ['ArrowLeft'] }); step(S, { keys: [] }); if (A.n !== 1 || nopes() !== n0 + 1 || A.bump.d !== -1) out.push('split ends: ← at 1 does not answer');
      if (D.feedOf(S.ev, S.t).some((e) => e.k === 'nope' && !e.s)) out.push('split ends: the wordless refusal takes a plate of the feed');
      const KP = page.HUD.keyPlates(), sp = KP.sp_keys; if (!sp || sp[2] < SIMX.checks.kit.fontW(TXT('hud.split.keys'), 26) + 16) out.push(`split ends: the quantity window's keys have no plate their width (${JSON.stringify(sp)})`);
      const T = townRun(), TR = T.run; TR.portal = { f: 3, x: 0, y: 0, from: 'scroll' }; T.meta.portals = [2]; T.screen = 'gate'; draw(T); const G = page.HUD.keyPlates().gt_help, P = UI.gate(SIMX.gateWays(TR, T).length).P;
      if (!G || G[2] < SIMX.checks.kit.fontW(TXT('hud.gate.6'), 26) + 16 || G[1] < P.y + P.h) out.push(`split ends: the ring's keys have no plate their width under the window (${JSON.stringify(G)}, window to ${P.y + P.h})`);
    } finally { K.button = btn; K.ink = ink; } }
  // TASKS 2114: a button's «+» and «−» are bars whose middle is the button's middle to 0 px and whose edges fall on whole px, on odd
  // and even button sizes and at odd and even corners; the split window's ± buttons are drawn by them
  function checkSign(out) { const K = UI.kit; if (!K.signRects || !K.SIGN_OF) { out.push('sign: no shared «+»/«−» layout (UI.kit.signRects)'); return; }
    const whole = (v) => Number.isInteger(v);
    for (const x0 of [0, 7, 100, 333]) for (const y0 of [0, 4, 51]) for (let s = 16; s <= 72; s++) for (const plus of [true, false]) {
      const cx = x0 + s / 2, cy = y0 + (s + 1) / 2, R = K.signRects(cx, cy, s, plus);
      if (R.length !== (plus ? 2 : 1)) { out.push(`sign: the ${plus ? '«+»' : '«−»'} of a ${s} px button has ${R.length} bars`); return; }
      for (const q of R) { const dx = q.x + q.w / 2 - cx, dy = q.y + q.h / 2 - cy;
        if (dx || dy) { out.push(`sign: a bar of the ${plus ? '«+»' : '«−»'} on a ${s}×${s + 1} button at ${x0},${y0} is ${dx},${dy} px off its middle`); return; }
        if (![q.x, q.y, q.w, q.h].every(whole) || Math.min(q.w, q.h) < K.SIGN.min) { out.push(`sign: a bar on a ${s} px button is ${q.x},${q.y} ${q.w}×${q.h}, not on whole px or under ${K.SIGN.min} px thick`); return; } } }
    const sp = UI.split().r; for (const [id, plus] of [['spPlus', true], ['spMinus', false]]) { const b = sp.find((q) => q.id === id);
      if (!b || K.SIGN_OF[b.label] !== plus) out.push(`sign: the split window's ${id} label is not drawn as the ${plus ? '«+»' : '«−»'} sign`); } }
  SIMX.checks.add('signCheck', checkSign);
  SIMX.checks.add('menuCheck', menuCheck);
  SIMX.checks.add('uiCheck', checkReview57);
  SIMX.checks.add('splitCheck', checkSplit);
  SIMX.checks.add('splitEndsCheck', checkSplitEnds);
  SIMX.checks.add('stackCheck', checkStacks);
  SIMX.checks.add('hudFootCheck', checkHudFoot);
  SIMX.checks.add('camAimCheck', checkCamAim);
  SIMX.checks.add('purseCheck', checkPurse);
  SIMX.checks.add('trkFoldCheck', checkTrkFold);
  SIMX.checks.add('trkAditCheck', checkTrkAdit);
  SIMX.checks.add('labelFitCheck', checkLabelFit);
  SIMX.checks.add('testEndCheck', checkTestEnd);
  SIMX.checks.add('strCheck', checkStrUse);
  SIMX.checks.add('keyWordCheck', checkKeyWords);
  SIMX.checks.add('hudHeroCheck', checkHudHero);
  SIMX.checks.add('questMarkCheck', checkQuestMark);
})(typeof window !== 'undefined' ? window : globalThis);
