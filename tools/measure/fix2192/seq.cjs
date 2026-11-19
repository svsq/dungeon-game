// node tools/measure/fix2192/seq.cjs [out.json] : the five sequences of chars_motion_r4.md № 3–6 (TASKS 2192) frame by frame at 60 fps in
// the node sandbox (live/sandbox.cjs), the sprites composited on the CPU from the textures' own pixels (SIMX.heroLayers.compose):
//   fireball: the mage with staff and orb casting a fireball (aims right, down, up-left): px² of the face (eye − 3 .. + 3 cells across,
//     − 2.5 .. + 2.5 down: brow to mouth) and of the beard under it (to + 4.5) under the orb or its cup; frames with any of the face covered
//   whirl, cry: the warrior's weapon arm: the over-body copy's alpha and its largest one-frame step, the frames the arm is also drawn
//     under the body for one frame only, the frames the hand is open (farmR drawn, or no fistR) while the weapon shows, the frames the
//     fist is drawn but hidden (behind his back), the weapon's layer switches
//   hurt: the mage's grip (handR) and weapon tip, the largest jump in a frame (bare staff, staff and orb, wand and orb)
//   turn: the warrior's plain turn, px of each weapon on top per frame, the fewest; the tip's largest jump in a frame
const path = require('path'), fs = require('fs'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const { compose, faceCover, FACE_ROWS } = SIMX.heroLayers, out = process.argv[2] || path.join(ROOT, 'frames/fix_2192/seq.json');
const FPS = 60, T0 = 10, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const base = { vx: 0, vy: 0, gp: 40, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
function frame(cls, eq, hx, t) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R;
  for (const [k, b] of Object.entries(eq)) R.hero.eq[k] = { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 };
  const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, base, hx), 300, 300, T0 + t, SIMX.heroSt(S), {});
  return { J, spr, rig: D.CLASSES[cls].look.rig };
}
const res = {}, lines = [];
for (const [an, aim, face] of [['right', 0, 1], ['down', Math.PI / 2, 1], ['up-left', -2.3, -1]]) {
  const rows = [], beard = []; for (let k = 0; k <= 36; k++) { const f = frame('mage', { weapon: 'staff', offhand: 'orb' }, { castT: T0, castK: 'fireball', aim, face }, k / FPS); const by = /^(orb_held|mage__cupL)/, eye = D.CLASSES.mage.look.eye; rows.push(faceCover(f.spr, L, 'mage', eye, FACE_ROWS.face, by)); beard.push(faceCover(f.spr, L, 'mage', eye, FACE_ROWS.beard, by)); }
  const hit = rows.map((v, k) => (v > 0 ? k : -1)).filter((k) => k >= 0), bh = beard.filter((v) => v > 0).length;
  res['fireball ' + an] = { face: rows, beard }; lines.push(`fireball ${an.padEnd(8)} face covered ${hit.length} frames${hit.length ? ` f${hit[0]}–f${hit[hit.length - 1]}` : ''}, max ${Math.max(...rows).toFixed(1)} px² of 120; beard ${bh} frames, max ${Math.max(...beard).toFixed(1)} px² of 48`);
}
for (const [an, at] of [['whirl', { whirlT: T0 }], ['cry', { castT: T0, castK: 'cry' }]]) for (const face of [1, -1]) {
  const rows = [];
  for (let k = 0; k <= 50; k++) { const f = frame('warrior', { weapon: 'sword' }, Object.assign({ face, aim: face > 0 ? 0 : Math.PI }, at), k / FPS), pn = 'hero__';
    const body = f.spr.findIndex((q) => /^hero__body/.test(q.n)), ua = f.spr.map((q, i) => (q.n.startsWith(pn + 'uarmR') ? i : -1)).filter((i) => i >= 0);
    const over = ua.filter((i) => i > body), wp = f.spr.map((q, i) => (/^it_/.test(q.n) ? i : -1)).filter((i) => i >= 0);
    const box = [f.J.ground[0] - 50, f.J.ground[1] - 100, f.J.ground[0] + 50, f.J.ground[1] + 4], c = compose(f.spr, box, 1);
    let fist = 0, wpn = 0; for (const k of c.top) { if (k < 0) continue; if (/^hero__fistR/.test(f.spr[k].n)) fist++; if (/^it_/.test(f.spr[k].n)) wpn++; }
    const al = (i) => (f.spr[i].o.u && f.spr[i].o.u.alpha !== undefined ? f.spr[i].o.u.alpha : 1);
    rows.push({ over: over.length ? al(over[0]) : 0, under: ua.some((i) => i < body), fist, wpn, open: f.spr.some((q) => /^hero__farmR/.test(q.n)) || !f.spr.some((q) => /^hero__fistR/.test(q.n)), layer: wp.map((i) => (i < body ? 'u' : 'o') + al(i).toFixed(2)).join('+') }); }
  const steps = rows.slice(1).map((r, i) => Math.abs(r.over - rows[i].over)), step = Math.max(...steps);
  const nofist = rows.map((r, k) => (r.wpn > 0 && r.open ? k : -1)).filter((k) => k >= 0), hid = rows.filter((r) => !r.open && r.fist === 0).length;
  const blink = rows.map((r, k) => (k > 0 && k < rows.length - 1 && r.under && !rows[k - 1].under && !rows[k + 1].under ? k : -1)).filter((k) => k >= 0);
  const sw = rows.map((r, k) => (k && r.layer !== rows[k - 1].layer && r.layer.replace(/[\d.]/g, '') !== rows[k - 1].layer.replace(/[\d.]/g, '') ? `${rows[k - 1].layer.replace(/[\d.]/g, '')}→${r.layer.replace(/[\d.]/g, '')}@f${k}` : '')).filter(Boolean);
  res[`${an} face ${face}`] = rows;
  lines.push(`${an} face ${String(face).padEnd(3)} over-arm alpha step max ${step.toFixed(2)} (f${steps.indexOf(step) + 1}), open hand ${nofist.length} frames${nofist.length ? ` f${nofist[0]}–f${nofist[nofist.length - 1]}` : ''}, fist behind the back ${hid}, under arm blinks ${blink.length ? blink.map((k) => 'f' + k).join(' ') : 'none'}, weapon layer ${sw.join(' ') || 'one'}`);
}
for (const eq of [{ weapon: 'staff' }, { weapon: 'staff', offhand: 'orb' }, { weapon: 'wand', offhand: 'orb' }]) {
  const rows = [], kit = Object.values(eq).join('+'); for (let k = 0; k <= 30; k++) { const f = frame('mage', eq, { hurtT: T0, hurtX: 1 }, k / FPS); rows.push({ grip: f.J.handR, tip: f.J.tip, handL: f.J.handL }); }
  const jump = (k) => { let m = [0, 0]; for (let i = 1; i < rows.length; i++) { const v = d(rows[i][k], rows[i - 1][k]); if (v > m[0]) m = [v, i]; } return m; };
  res['hurt ' + kit] = rows; const [g, gi] = jump('grip'), [t, ti] = jump('tip'), [hl, hli] = jump('handL');
  lines.push(`mage hurt ${kit.padEnd(9)} grip jump max ${g.toFixed(1)} px (f${gi}), tip ${t.toFixed(1)} px (f${ti}), far hand ${hl.toFixed(1)} px (f${hli})`);
}
for (const wb of ['sword', 'longsword', 'axe', 'hammer']) {
  const rows = [], tips = [];
  for (let k = 0; k <= 12; k++) { const f = frame('warrior', { weapon: wb }, { face: -1, faceT: T0 }, k / FPS), box = [f.J.ground[0] - 50, f.J.ground[1] - 100, f.J.ground[0] + 50, f.J.ground[1] + 4], c = compose(f.spr, box, 1);
    let n = 0; for (const q of c.top) if (q >= 0 && /^it_/.test(f.spr[q].n)) n++; rows.push(n); tips.push([f.J.tip[0] - f.J.ground[0], f.J.tip[1] - f.J.ground[1]]); }
  const tj = Math.max(...tips.slice(1).map((p, k) => d(p, tips[k])));
  res['turn ' + wb] = rows; const gone = rows.map((v, k) => (v < 4 ? k : -1)).filter((k) => k >= 0);
  lines.push(`warrior turn ${wb.padEnd(9)} weapon px on top per frame ${rows.join(' ')}; under 4 px in ${gone.length} frames${gone.length ? ` f${gone[0]}–f${gone[gone.length - 1]}` : ''}, tip jump max ${tj.toFixed(1)} px`);
}
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res));
console.log(lines.join('\n'));
