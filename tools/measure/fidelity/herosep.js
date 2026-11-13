(() => { const Q = SCENE.QA(), shots = [];
  const want = /^(magma_(arch|slabs|crossing|fog_walk|hall_prison|arena|brink|crust|surge_rest|cave|lava|islet|lake_shore|terrace_step|chasm)$|play$)/;
  for (const [n, S] of Q.states) { if (!want.test(n) || !S.run) continue;
    shots.push([n, S, S.t + 0.01]); shots.push([n + '__nohero', S, S.t + 0.01, { hero: 1 }]); }
  window.__SHOTS = shots; })();
