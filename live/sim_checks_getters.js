// live/sim_checks_getters.js — selfCheck's part for what the render may ask the sim (SIM.Q and the getters beside it): a read leaves the state as it was, so a frame drawn or not changes nothing (TASKS 2064). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { enterFloor, newRun, spawn, step } = SIMX;
  const SKIP = { at: 'it replays the attract demo into a cache of its own, not into the state' };
  const BESIDE = ['offersOf'];
  const ser = SIMX.checks.kit.stateJson;
  const parts = (S) => { const { run, ...rest } = S, o = {}; for (const [k, v] of Object.entries(rest)) o['S.' + k] = ser(v); for (const [k, v] of Object.entries(run || {})) o['run.' + k] = ser(v); return o; };
  const changed = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
  // a getter takes its own shape of arguments and the sim has no signatures to read, so each is tried with the shapes the sim passes about
  const argSets = (S, R) => { const h = R.hero, e = R.en[0] || h;
    return [[], [R], [S], [S, R], [R, S], [S.meta], [R.map], [h], [h, S.meta], [R.map, h.x, h.y], [R, h.x, h.y], [R, 60], [S, 0], [R, 'guard'], [S, R, e], [R, e], [R.map, e], [h.x, h.y]]; };
  const getters = () => [...Object.entries(root.SIM.Q), ...BESIDE.map((k) => [k, root.SIM[k]])].filter(([k, f]) => typeof f === 'function' && !SKIP[k]);
  function sweep(S, out, where) {
    const sets = argSets(S, S.run); let base = parts(S);
    for (const [name, get] of getters()) {
      for (const a of sets) { try { get(...a); } catch (e) { /* the shape is not this getter's; the state it left is checked all the same */ } }
      const now = parts(S), d = changed(base, now); if (d.length) out.push(`getters: ${name} writes the state on a read (${d.join(', ')}; ${where})`); base = now; }
  }
  const scene = (kind) => { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; if (kind === 'floor') enterFloor(S, S.run, 1); return S; };
  function gettersCheck(out) {
    for (const [name, why] of Object.entries(SKIP)) if (!(name in root.SIM.Q)) out.push(`getters: ${name} is left out of the check (${why}) but is not asked of the render any more`);
    for (const kind of ['town', 'floor']) {
      const A = scene(kind), B = scene(kind);
      for (let i = 0; i < 60; i++) { step(A, { keys: [] }); step(B, { keys: [] }); if (i === 0 || i === 30) sweep(B, out, `${kind}, step ${i}`); }
      if (ser(A) !== ser(B)) out.push(`getters: a ${kind} run read every few steps ends otherwise than one never read (${changed(parts(A), parts(B)).join(', ')})`);
    }
    { const S = spawn(0, {}), s0 = ser(S);
      if (!S.meta.stats || S.meta.stats.from !== 0) out.push('getters: a new game starts without its counters');
      SIMX.statsOf(S); if (ser(S) !== s0) out.push('getters: statsOf writes the state on a read');
      delete S.meta.stats; SIMX.statsOf(S); if ('stats' in S.meta) out.push('getters: statsOf makes the counters on a read'); }
    { const R = scene('town').run;
      if (!R.offers || R.offerB === undefined || !R.stats || !R.stats[0]) out.push('getters: a run through the town starts without its offers or its floor count');
      R.bossN = (R.bossN || 0) + 1; const s0 = ser(R); SIMX.offersOf(R); if (ser(R) !== s0) out.push('getters: offersOf deals a batch on a read'); }
    { const S = scene('floor'), R = S.run, f = R.floor;
      if (!R.stats[f]) out.push('getters: a floor entered has no count of its own');
      delete R.stats; step(S, { keys: [] }); if (!R.stats || !R.stats[f]) out.push('getters: a run saved without its counts gets none in the step');
      delete R.stats; const s0 = ser(R); try { SIMX.fstat(R); } catch (e) { /* no count to read */ } if (ser(R) !== s0) out.push('getters: fstat makes the floor\'s count on a read'); }
  }
  SIMX.checks.add('gettersCheck', gettersCheck, { slow: true });
})(typeof window !== 'undefined' ? window : globalThis);
