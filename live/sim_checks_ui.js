// live/sim_checks_ui.js — selfCheck's part for the menus and windows found in the review of PR 57. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, UI, newRun, spawn, step } = SIMX;
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
  function checkReview57(out) { checkGateFocus(out); checkDraftResource(out); }
  Object.assign(SIMX, { checkReview57 });
})(typeof window !== 'undefined' ? window : globalThis);
