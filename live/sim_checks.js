// live/sim_checks.js — the registry of the sim's self-checks for tune.cjs: SIM.selfCheck() → [failure strings] (engine.md §6). Node only:
// sim.js requires it, the page never loads it (ARCHITECTURE.md §4.2). A check lives in live/sim_checks_<domain>.js and registers itself
// there with SIMX.checks.add(name, run[, { slow: true }]); the files are found here by name, so a new check touches no common list.
(function (root) {
  const SIMX = root.SIMX, parts = {}, slow = [];
  // run(out) pushes failures to out, or returns its own array
  SIMX.checks = {
    kit: {},
    add(name, run, opts = {}) {
      if (parts[name]) throw new Error(`selfCheck ${name} is registered twice`);
      parts[name] = () => { const out = [], got = run(out); return Array.isArray(got) ? got : out; };
      if (opts.slow) slow.push(name);
    },
  };
  // the kit first: the domain files read its helpers as they load
  require('./sim_checks_kit.js');
  for (const f of require('fs').readdirSync(__dirname).filter((f) => /^sim_checks_\w+\.js$/.test(f) && f !== 'sim_checks_kit.js').sort()) require('./' + f);
  const selfCheck = (names = Object.keys(parts)) => names.flatMap((k) => parts[k]());
  Object.assign(root.SIM, { selfCheck, selfChecks: Object.keys(parts), slowChecks: slow });
})(typeof window !== 'undefined' ? window : globalThis);
