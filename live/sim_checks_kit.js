// live/sim_checks_kit.js — helpers that checks of more than one domain share. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    D, enterFloor, newRun, step, toPx } = SIMX;
  // the checks that start a game from the menu for something else skip the Keeper's welcome (TASKS 1849), which holds the hero
  const noWelcome = (S) => { if (S.run && S.run.greet === 1) S.run.greet = 'done'; };
  const plainRun = (Z) => { for (let sd = 3; sd < 60; sd++) { Z.run = newRun(Z, 'magma', sd); for (let f = 2; f < D.RUNS.magma.floors; f++) { enterFloor(Z, Z.run, f); if (Z.run.map.ftype === 'plain') return Z.run; } } return Z.run; };
  // a run whose townsfolk have no quest business (no offers, the Keeper's chain in hand), for the checks of the talk and the workshops
  const noQuests = (R) => { R.offers = []; R.quests = [{ id: -1, key: 'chapter', f: 99, need: 1, n: 0, st: 'taken', from: 'keeper', rw: {} }]; };
  const swing = (S, R, q) => { const h = R.hero; h.x = q.x; h.y = q.y + 34; h.vx = h.vy = 0; h.cd.atk = 0; const A = { ...toPx(R, q.x, q.y - 30) }; step(S, Object.assign({ press: 1, keys: [] }, A)); for (let j = 0; j < 40; j++) step(S, Object.assign({ keys: [] }, A)); };
  Object.assign(SIMX.checks.kit, { noWelcome, plainRun, noQuests, swing });
})(typeof window !== 'undefined' ? window : globalThis);
