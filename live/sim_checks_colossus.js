// live/sim_checks_colossus.js — selfCheck's part for the colossus's step geometry (TASKS 2073). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D } = SIMX;
  // rigs.js is run as the page runs it (live/sandbox.cjs: the logic may not stand up a page), so whatever it assigns after the table reaches the check too
  const { rigs, monsterBox } = require('./sandbox.cjs');
  // a regenerated rig writes the same joints as the same floats, and a redrawn one moves a joint by a pixel at least, so a millionth of a
  // pixel separates the two; the step is a sum of square roots and may differ in its last digits from the table's
  const EPS = 1e-6;
  // monsters.js takes the length of a step as this share of the leg (bipedSL); it is a render file and not loaded by the sim's checks
  const LEG_SHARE = 0.4;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function rigCheck(out) {
    const G = D.COLOSSUS_GEO, R = rigs().colossus;
    if (!R) { out.push('colossus: RIGS lacks the colossus'); return; }
    const same = (name, table, rig) => { if (!(Math.abs(table - rig) <= EPS)) out.push(`colossus: COLOSSUS_GEO.${name} is ${table}, the rig says ${rig}`); };
    same('rigH', G.rigH, R.h); same('gap', G.gap, R.gap); same('midAnkle', G.midAnkle, (R.ankleL[0] + R.ankleR[0]) / 2);
    for (const side of ['L', 'R']) { same(`ankle.${side}`, G.ankle[side], R['ankle' + side][0]); same(`foot.${side}`, G.foot[side], R['foot' + side][0]); }
    const leg = dist(R.hipL, R.kneeL) + dist(R.kneeL, R.ankleL);
    same('step', G.step, LEG_SHARE * leg * D.ENEMIES.boss_colossus.h / R.h);
    same('step in BOSSES', D.BOSSES.boss_colossus.step, G.step);
    depthCheck(out, G.depth);
  }
  // the rig's dz is what monsters.js gives for a step (MONSTERS.legDz, run in the sandbox, not read from its source); it must follow the
  // table the sim's contact reads (DATA.stepDz, COLOSSUS_GEO.depth), or the drawn foot and the sim's step part in depth (TASKS 2080)
  function depthCheck(out, P) {
    let legDz; try { legDz = monsterBox(D).legDz; } catch (e) { out.push('colossus: monsters.js does not run in the sandbox: ' + e.message); return; }
    if (typeof legDz !== 'function') { out.push('colossus: monsters.js has no step depth to check (MONSTERS.legDz)'); return; }
    const dz = () => [legDz(1, 0, 1, 1), -legDz(0, 1, -1, 1)], [ahead, back] = dz();
    if (ahead !== P.ahead || back !== P.back) out.push(`colossus: the rig's step gives ahead ${ahead}, back ${back}, COLOSSUS_GEO.depth says ${P.ahead}, ${P.back}`);
    const was = { ...P }; P.ahead *= 2; P.back *= 2;
    try { const [a2, b2] = dz(); if (a2 !== P.ahead || b2 !== P.back) out.push('colossus: the rig\'s step does not follow COLOSSUS_GEO.depth'); } finally { Object.assign(P, was); }
    if (legDz(1, 0, 1, 4) >= legDz(1, 0, 1, 1)) out.push('colossus: a lengthened stride does not ease the step\'s depth');
  }
  SIMX.checks.add('colossusRigCheck', rigCheck);
})(typeof window !== 'undefined' ? window : globalThis);
