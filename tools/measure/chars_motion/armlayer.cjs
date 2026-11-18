// node tools/measure/chars_motion/armlayer.cjs [out.json] : the weapon arm's layer through each action, frame by frame (60 fps) in the
// node sandbox (live/sandbox.cjs heroBox, the stubbed drawHero heroArmCheck uses): per frame the over-body copy's alpha (front), whether
// the arm under the body is drawn, the forearm part (cuffR / farmR), the fist, the weapon's place against the body (under / over).
// Prints for each action the frames of the fade in and out, the largest one-frame alpha step in the first 0.35 s and at the end, and
// every frame where the forearm part, the fist or the weapon's layer switches (a pop of the hand or the weapon over or under the body).
const path = require('path'), fs = require('fs'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const out = process.argv[2] || path.join(ROOT, 'frames/critic_chars_r3_motion/armlayer.json');
const DT = 1 / 60, GT = 10, LEN = 1.0;
// [label, class, weapon, field set at the start, extra hero fields]
const ACTS = [
  ['warrior blow', 'warrior', 'sword', { atkT: 0 }, {}],
  ['warrior blow back (aim pi)', 'warrior', 'sword', { atkT: 0 }, { aim: Math.PI }],
  ['warrior blow up', 'warrior', 'sword', { atkT: 0 }, { aim: -Math.PI / 2 }],
  ['warrior charge', 'warrior', 'sword', { castT: 0 }, { castK: 'charge' }],
  ['warrior cry', 'warrior', 'sword', { castT: 0 }, { castK: 'cry' }],
  ['warrior leap', 'warrior', 'sword', { castT: 0 }, { castK: 'leap' }],
  ['warrior whirl', 'warrior', 'sword', { whirlT: 0 }, {}],
  ['warrior hurt', 'warrior', 'sword', { hurtT: 0 }, {}],
  ['archer shot', 'archer', 'shortbow', { atkT: 0, patkT: 0 }, {}],
  ['archer shot up', 'archer', 'shortbow', { atkT: 0, patkT: 0 }, { aim: -Math.PI / 2 }],
  ['archer cast', 'archer', 'shortbow', { castT: 0 }, { castK: 'volley' }],
  ['mage shot', 'mage', 'staff', { atkT: 0, patkT: 0 }, {}],
  ['mage shot up', 'mage', 'staff', { atkT: 0, patkT: 0 }, { aim: -Math.PI / 2 }],
  ['mage cast', 'mage', 'staff', { castT: 0 }, { castK: 'fireball' }],
  ['mage frost', 'mage', 'staff', { castT: 0 }, { castK: 'frost' }],
];
const base = { vx: 0, vy: 0, gp: 40, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
const R0 = {}, rows = {};
for (const [label, cls, wb, start, extra] of ACTS) for (const face of [1, -1]) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
  const st = SIMX.heroSt(S), pn = D.CLASSES[cls].look.rig + '__', seq = [];
  for (let f = -3; f * DT <= LEN; f++) { const t0 = GT - f * DT, h = Object.assign({}, R.hero, base, extra, { face });
    if (extra.aim !== undefined) h.aim = face > 0 ? extra.aim : Math.PI - extra.aim;
    if (f >= 0) for (const k of Object.keys(start)) h[k] = t0;
    const spr = []; L.joint = () => {}; L.solid = () => {}; L.sprite = (n, x, y, o) => { spr.push({ n, a: o && o.u && o.u.alpha !== undefined ? o.u.alpha : 1 }); return { w: 10, h: 10 }; };
    drawHero(h, 300, 300, GT, st, {});
    const idx = (re) => spr.map((q, i) => (q.n.startsWith(pn) && re.test(q.n.slice(pn.length)) ? i : -1)).filter((i) => i >= 0);
    const body = idx(/^body(_w)?$|^body$/)[0] ?? idx(/^body/)[0] ?? -1, back = idx(/^body_back/)[0] ?? -1, bi = body >= 0 ? body : back, ua = idx(/^uarmR/), wpn = spr.findIndex((q) => /^it_/.test(q.n));
    const under = ua.filter((i) => i < bi), over = ua.filter((i) => i > bi), fa = [...idx(/^cuffR/).map(() => 'cuff'), ...idx(/^farmR/).map(() => 'farm')];
    seq.push({ f, under: under.length, overA: over.length ? +spr[over[0]].a.toFixed(3) : 0, fore: [...new Set(fa)].join('+'), fist: idx(/^fistR/).length,
      wpn: wpn < 0 ? '-' : wpn < bi ? 'under' : 'over', back: back >= 0 && body < 0 ? 1 : 0 }); }
  rows[label + ' face ' + face] = seq;
}
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(rows));
for (const [n, seq] of Object.entries(rows)) {
  const a = seq.map((r) => r.overA), act = seq.filter((r) => r.f >= 0), blend = act.filter((r) => r.overA > 0.02 && r.overA < 0.98);
  const firstIn = act.findIndex((r) => r.overA > 0.02), full = act.findIndex((r) => r.overA >= 0.98), lastFull = act.map((r) => r.overA >= 0.98).lastIndexOf(true), endZero = act.findIndex((r, i) => i > lastFull && r.overA <= 0.02);
  let stepIn = 0, stepOut = 0; for (let i = 1; i < seq.length; i++) { const dlt = Math.abs(a[i] - a[i - 1]); if (seq[i].f <= 0.35 / DT) stepIn = Math.max(stepIn, dlt); else stepOut = Math.max(stepOut, dlt); }
  const sw = []; for (let i = 1; i < seq.length; i++) for (const k of ['fore', 'fist', 'wpn', 'back', 'under']) if (seq[i][k] !== seq[i - 1][k]) sw.push(`${k} ${seq[i - 1][k]}→${seq[i][k]}@f${seq[i].f}`);
  console.log(`${n.padEnd(32)} in f${firstIn}→full f${full} (${full - firstIn + 1} fr)  out f${lastFull}→0 f${endZero}  blend frames ${blend.length}  max step in ${stepIn.toFixed(2)} out ${stepOut.toFixed(2)}  ${sw.join(' ')}`);
}
