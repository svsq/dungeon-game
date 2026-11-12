(() => { const Q = SCENE.QA(), shots = [];
  const want = /^magma_(lake|lake_shore|river|lava|terrace|terrace_step|islet|crossing|arch|chasm|hall|fog)$|^zone_magma$/;
  for (const [n, S] of Q.states) { if (want.test(n)) shots.push([n, S, S.t + 0.01]); }
  window.__SHOTS = shots; })();
