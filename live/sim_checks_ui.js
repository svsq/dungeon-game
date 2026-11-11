// live/sim_checks_ui.js — selfCheck's part for the menus and windows found in the review of PR 57. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, DT, UI, newRun, spawn, step } = SIMX;
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
  // TASKS 1880 и: the legend opens by itself in the run's first town and on its first floor, and not again on the next ones
  function checkLegendOnce(out) {
    const S = townRun(), R = S.run, seen = [R.legAuto];
    for (const f of [1, 2, 0, 3]) { SIMX.enterFloor(S, R, f); seen.push(R.legAuto); }
    if (seen.join('') !== '11000') out.push(`legend: opens by itself on town, floor 1, floor 2, town, floor 3 as ${seen.join('')}, not 11000`); }
  // TASKS 1876: in a talk Enter presses the lit button, ←→ walk a page's buttons and ↑↓ the topics; a focus left from the start is not used
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
  // TASKS 1877: past ten quests the journal scrolls by the wheel, and the chosen quest is always among the rows shown
  function checkJournalScroll(out) {
    const S = townRun(), R = S.run, W = (wheel) => step(S, { keys: [], px: 5, py: 5, wheel }); R.offers = [];
    R.quests = Array.from({ length: 14 }, (_, i) => ({ id: 950 + i, key: 'cull', f: 1 + i, need: 5, n: 0, st: 'taken', from: 'guard', rw: {} }));
    const L0 = SIMX.journalOf(R), shown = () => UI.journal(L0.length, true, S.jtop).r.filter((b) => b.id.startsWith('q:')).map((b) => L0[b.i].id);
    S.jsel = L0[12].id; S.screen = 'journal'; W(0);
    if (!shown().includes(S.jsel)) out.push(`journal: the 13th of 14 chosen is not among the rows shown (${shown().length})`);
    for (let i = 0; i < 20; i++) W(-1); if (S.jtop !== 0 || !shown().includes(S.jsel)) out.push(`journal: wheeled to the top the list starts at ${S.jtop} or loses the chosen quest`);
    for (let i = 0; i < 20; i++) W(1); if (!shown().includes(L0[13].id) || !shown().includes(S.jsel)) out.push('journal: wheeled down the last quest or the chosen one is not shown'); }
  // TASKS 1878: a taken row stays in place until the board closes, so clicks down its buttons and a double click take one each
  function checkBoardRows(out) {
    const S = townRun(), R = S.run; R.offers = D.QUEST_GIVE.from.map((from, i) => ({ key: D.QUEST_GIVE.pool[i % D.QUEST_GIVE.pool.length], from, q: 0 })); R.quests = [];
    S.screen = 'board'; step(S, { keys: [], px: 5, py: 5 }); const n0 = SIMX.boardOffers(R).length, rows = UI.board(n0).r, tap = (i) => press(S, rows.find((b) => b.id === 'take:' + i));
    if (n0 < 3) { out.push(`board: the check's board holds ${n0} offers`); return; }
    const want = S.bdRows.slice(0, 3).map((o) => o.role); tap(0); tap(0); tap(1); tap(2);
    const got = R.quests.map((q) => q.from);
    if (got.join() !== want.join()) out.push(`board: clicks on rows 1, 1, 2, 3 took ${got.join() || 'nothing'}, not ${want.join()}`);
    step(S, { keys: ['Escape'], px: 5, py: 5 }); S.screen = 'board'; step(S, { keys: [], px: 5, py: 5 });
    if (S.bdRows.length !== n0 - 3) out.push(`board: reopened it still shows the ${n0 - S.bdRows.length} taken rows wrong (${S.bdRows.length} of ${n0})`); }
  // the hero's name (TASKS 1872): the die is the sim's own and repeats from the same seed, the field takes letters, Backspace and Enter,
  // keeps to NAME_MAX, the run and its save carry the name, an empty field throws one at the start, a save from before names still loads
  function checkHeroName(out) {
    const N = D.heroNames(), J = (o) => JSON.parse(JSON.stringify(o)), toStart = () => { const S = spawn(0, {}); press(S, UI.menu(false).find((b) => b.id === 'campaign')); return S; };
    const B = (S, id) => UI.classes(S.meta).find((b) => b.id === id), put = (S, keys, chars) => step(S, { keys, chars, px: 5, py: 5 });
    const A = toStart(), A2 = toStart();
    if (A.screen !== 'classes' || !N.includes(A.pendName)) out.push(`name: the start screen offers no name off the list (${A.pendName})`);
    press(A, B(A, 'dice')); press(A2, B(A2, 'dice'));
    if (!N.includes(A.pendName) || A.pendName !== A2.pendName) out.push(`name: the die is not the same from the same seed (${A.pendName}, ${A2.pendName})`);
    const thrown = []; for (let i = 0; i < 6; i++) { const was = A.pendName; press(A, B(A, 'dice')); thrown.push(A.pendName); if (A.pendName === was) out.push('name: the die threw the same name twice running'); }
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
  }
  function checkReview57(out) { checkBoardRows(out); checkJournalScroll(out); checkTalkFocus(out); checkLegendOnce(out); checkGateFocus(out); checkDraftResource(out); checkKeyRepeat(out); checkHeroName(out); checkResumeHold(out); checkResize(out); checkMapCut(out); checkHoldInput(out); checkUiPtr(out); }
  Object.assign(SIMX, { checkReview57, checkResize, checkMapCut });
})(typeof window !== 'undefined' ? window : globalThis);
