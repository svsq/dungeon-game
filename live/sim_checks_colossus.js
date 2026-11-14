// live/sim_checks_colossus.js — selfCheck's part for the colossus's step geometry (TASKS 2073). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D } = SIMX, fs = require('fs'), path = require('path');
  // rigs.js is one assignment of a JSON object, written by the rig scripts; it is read as that object and no script is run
  const rigs = () => { const text = fs.readFileSync(path.join(__dirname, 'rigs.js'), 'utf8'); return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); };
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
  }
  SIMX.checks.add('colossusRigCheck', rigCheck);
})(typeof window !== 'undefined' ? window : globalThis);
