(() => { const Q = SCENE.QA(), shots = [];
  const want = /^(zone_(dungeon|crypt|lava|arcane|cave|town)|lava_(river|hall)|cave_(hall|crossing|camp|bridge)|town_services|play)$/;
  for (const [n, S] of Q.states) { if (want.test(n)) shots.push([n, S, S.t + 0.01]); }
  window.__SHOTS = shots; })();
