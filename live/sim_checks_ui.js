// live/sim_checks_ui.js — selfCheck's part for the menus and windows found in the review of PR 57. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, DG, DT, UI, TILE, newRun, spawn, step } = SIMX;
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
  // a resize under a still pointer is not a move of it, and the attract demo plays the same in any window
  function checkResize(out) { const h0 = SIMX.VIEW.H;
    try { SIMX.setView(1200); const T = spawn(0, {}), U = UI.menu(false, T.meta.diff, T.meta.zoom), st = U.find((b) => b.id === 'stats'), P = mid(T, st);
      step(T, Object.assign({ keys: [] }, P)); step(T, Object.assign({ keys: [], moved: 1 }, P, { px: P.px + 1 })); const f0 = T.focus;
      step(T, { keys: ['ArrowDown'], px: P.px + 1, py: P.py, moved: 0 }); const f1 = T.focus;
      SIMX.setView(1080); const Q = mid(T, U.find((b) => b.id === (f1 === 'settings' ? 'load' : 'settings'))); step(T, Object.assign({ keys: [], moved: 0 }, Q));
      if (f1 === f0 || T.focus !== f1) out.push(`resize: a still pointer takes the menu's focus as the window is resized (${f0} → ${f1} → ${T.focus})`); }
    finally { SIMX.setView(h0); }
    const demo = (vh) => { SIMX.setView(vh); try { const S = root.SIM.create(); while (S.t < root.SIM.L - 1e-6) step(S, root.SIM.scriptInput(S.t, S)); const h = S.run.hero;
      return [h.x, h.y, h.hp, h.mp, S.run.kills, S.steps].map((v) => +v.toFixed(6)).join(','); } finally { SIMX.setView(h0); } };
    { const a = demo(1080), b = demo(1248); if (a !== b) out.push(`resize: the attract demo plays otherwise in a 16:10 window (${b}, not ${a})`); } }
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
        ['the first class, ←', () => { P.meta.cls = ids[0]; P.focus = 'cls:' + ids[0]; }, ['ArrowLeft'], []], ['«В путь», →', () => { P.focus = 'go'; }, ['ArrowRight'], []]];
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
    const life = D.GIFTS.find((g) => g.id === 'life'); if (life.desc !== '+1,5 здоровья в секунду') out.push(`gift life: «${life.desc}»`);
    const tk = TXT('sim_town.takeGift.msg', { name: life.name, desc: life.desc }); if (dot.test(tk)) out.push(`gift life: the message on taking it reads «${tk}»`);
    if (TXT('GIFTS.phoenix.descN', { n: 2, times: 'раза', v: 50 }).indexOf('50%') < 0) out.push('gift phoenix: the tip for two loses its 50%');
    for (const [k, v] of Object.entries(R)) for (const s of [].concat(v)) if (typeof s === 'string' && /(^|[^\d.])\d+\.\d+(?![.\d])/.test(s.replace(/\{[^}]*\}/g, ''))) out.push(`text ${k}: a decimal dot in «${s}»`);
    if (TXT('GIFTS.life.desc', { v: 4.5 }) !== '+4,5 здоровья в секунду') out.push(`text: a fractional value goes in as «${TXT('GIFTS.life.desc', { v: 4.5 })}»`); }
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
        for (const [x, y] of lowest(m, ok)) { h.x = (x + 0.5) * TILE; h.y = (y + 0.9) * TILE; R.camLook = [0, w.H / 2 * 0.12]; SIMX.snapCam(R);
          const py = (h.y + SIMX.CAM_FEET - R.cam[1]) * z; if (py > vh - top + 0.5) { out.push(`hud foot: ${m.town ? 'the town' : 'floor ' + R.floor}'s cell ${x},${y} at ×${z}, view ${vh}: the hero's feet at ${py.toFixed(0)} px are under the bottom panel's top ${vh - top}`); return SIMX.setView(h0); } } } } }
    SIMX.setView(h0); }
  // the tracker's fold (TASKS 1992): its key flips the player's fold in play and on the pause
  function checkTrkFold(out) { const { S } = playing('warrior'), f0 = S.meta.trkFold ? 1 : 0;
    step(S, { keys: ['TrkFold'] }); if ((S.meta.trkFold ? 1 : 0) === f0) out.push('tracker: the fold key does not fold the done quests in play');
    S.screen = 'pause'; step(S, { keys: ['TrkFold'] }); if ((S.meta.trkFold ? 1 : 0) !== f0) out.push('tracker: the fold key does not unfold them on the pause'); }
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
  // the scene has no node entry, so the hero's drawing runs in a sandbox with L and G stubbed and its sprites' placements recorded
  // (TASKS 1896): on the world's grid the face snap holds the body still through a sub-pixel step, under L.pre (the menu's arch,
  // the victory screen) it must move with him, or a scaled hero jerks by whole world pixels
  function checkHudHero(out) { const fs = require('fs'), vm = require('vm'), path = require('path'), src = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
    const M = { mul: (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]],
      t: (x, y) => [1, 0, 0, 1, x, y], s: (x, y) => [x, 0, 0, y, 0, 0], r: (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], ap: (A, p) => [A[0] * p[0] + A[2] * p[1] + A[4], A[1] * p[0] + A[3] * p[1] + A[5]] };
    M.of = (...Ls) => Ls.reduce((a, b) => M.mul(a, b));
    const calls = [], size = { w: 10, h: 10 }, L = new Proxy({ M, SS: (e0, e1, x) => { const q = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return q * q * (3 - 2 * q); }, SNAP: 0, pre: null, sp: null,
      sprite: (n, x, y, o) => { calls.push(o && o.m ? o.m[4] : x); return size; } }, { get: (t, k) => (k in t ? t[k] : () => size) });
    const box = { Math, Object, Array, JSON, Number, String, Set, Map, WeakMap, Float32Array, Float64Array, console, SIM: root.SIM, G: { w: 1920, h: 1080, tex: () => size }, ASSETS: new Proxy({}, { get: () => size }) };
    box.window = box; box.SCX = { D, L, M, SC: {}, SS: L.SS }; vm.createContext(box); vm.runInContext(src('rigs.js'), box); vm.runInContext(src('scene_hero.js'), box);
    const S = spawn(0, {}), R = newRun(S, 'campaign', 5, {}); S.run = R;
    const h = Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face: 1, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), st = SIMX.heroSt(S);
    const draw = (x, pre) => { calls.length = 0; L.pre = pre; try { box.SCX.drawHero(h, x, 300, 10, st, {}); } finally { L.pre = null; } return calls.slice(); };
    const lag = (pre) => { const a = draw(100.1, pre), b = draw(100.45, pre); return a.length && a.length === b.length ? Math.max(...a.map((x, i) => Math.abs(b[i] - x - 0.35))) : NaN; };
    const world = lag(null), hud = lag([1, 0, 0, 1, 0, 0]);
    if (!(world > 0.3)) out.push(`hud hero: on the world's grid the face snap does not hold the body (lag ${world})`);
    if (!(hud < 1e-6)) out.push(`hud hero: under L.pre the body snaps to the world's pixels (lag ${hud})`); }
  Object.assign(SIMX, { checkHudHero, checkStrUse, checkKeyWords, checkTestEnd, checkTrkFold, checkHudFoot, checkAbCard, checkReview57, checkResize, checkMapCut, checkSplit, checkStacks });
})(typeof window !== 'undefined' ? window : globalThis);
