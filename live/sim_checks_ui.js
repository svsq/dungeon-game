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
  // a save and Continue in the bolt's path, or by a corpse about to burst: after the hold it all lands as it would have
  function checkResumeHold(out) {
    const run = (save, kind) => { const { S, R, h } = playing('warrior'); R.en = []; h.ifr = 0; h.dashT = -9;
      if (kind === 'bolt') R.proj.push({ id: R.nextId++, src: -1, who: 'test', k: 'jet', x: h.x + 70, y: h.y - 20, vx: -60, vy: 0, t0: S.t, life: 5, dmg: 7, own: 'en', r: 7, gz: 20 });
      if (kind === 'fuse') R.en.push({ id: R.nextId++, type: 'skeleton', x: h.x + 30, y: h.y, vx: 0, vy: 0, hp: 0, max: 10, dmg: 1, elite: 0, room: -1, st: 'dead', t0: S.t, deadT: S.t, fuse: S.t + 0.6, mods: ['explosive'] });
      if (save) { S.screen = 'pause'; press(S, UI.pause(S.meta.zoom).find((b) => b.id === 'save')); press(S, UI.menu(true).find((b) => b.id === 'continue')); }
      const hp = h.hp; for (let i = 0; i < 360; i++) step(S, { keys: [] }); return { hurt: hp - h.hp }; };
    for (const kind of ['bolt', 'fuse']) { const a = run(0, kind), b = run(1, kind);
      if (!(a.hurt > 0)) out.push(`resume: the ${kind} set up for the check does not hurt the hero`);
      else if (b.hurt !== a.hurt) out.push(`resume: a save and Continue dodge the ${kind} (${b.hurt} hurt, not ${a.hurt})`); }
    { const { S, R, h } = playing('mage'); h.cd.dash = S.t + 2; h.burn = S.t + 1; S.screen = 'pause'; press(S, UI.pause(S.meta.zoom).find((b) => b.id === 'save')); press(S, UI.menu(true).find((b) => b.id === 'continue'));
      const cd = h.cd.dash - S.t, burn = h.burn - S.t; while (S.t < R.holdT + DT) step(S, { keys: [] });
      if (Math.abs(h.cd.dash - S.t - cd) > 3 * DT || Math.abs(h.burn - S.t - burn) > 3 * DT) out.push(`resume: the hero's clocks run on through the hold (dash ${(cd - h.cd.dash + S.t).toFixed(2)} s, burn ${(burn - h.burn + S.t).toFixed(2)} s gone)`); } }
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
      if (c0.w * c0.h >= all.w * all.h) out.push(`map cut: ${mode} ${seed}'s sheet is the whole floor's before a step (${c0.w}×${c0.h})`);
      const order = []; for (let i = 0; i < m.W * m.H; i++) if (!R.seen[i]) order.push(i); order.sort((a, b) => { const d = (i) => Math.hypot(i % m.W - m.rooms[m.start].cx, Math.floor(i / m.W) - m.rooms[m.start].cy); return d(a) - d(b); });
      let prev = c0, changes = 0;
      for (let k = 0; k < order.length; k++) { R.seen[order[k]] = 1; if (k % 8) continue; const c = SIMX.mapCut(R);
        if (c.x > prev.x || c.y > prev.y || c.x + c.w < prev.x + prev.w || c.y + c.h < prev.y + prev.h) { out.push(`map cut: ${mode} ${seed}'s sheet shrinks as the floor is seen`); break; }
        if (c.w !== prev.w || c.h !== prev.h) changes++; prev = Object.assign({}, c); }
      if (changes > Math.ceil((m.W + m.H) / 4)) out.push(`map cut: ${mode} ${seed}'s sheet changes size ${changes} times as the floor is seen`); } }
  function checkReview57(out) { checkGateFocus(out); checkDraftResource(out); checkKeyRepeat(out); checkResumeHold(out); checkResize(out); checkMapCut(out); }
  Object.assign(SIMX, { checkReview57, checkResize, checkMapCut });
})(typeof window !== 'undefined' ? window : globalThis);
