// node tools/measure/game/resp.cjs — responsiveness on magma floor 14 of the town run (seed 7, enemies off): frames from a
// direction key to the hero moving, to full speed, to a stop after release; frames from a click to the swing; dash distance;
// walk speed on floor, crust and slabs; the gate's stun (time without control after a vent throws him back)
const { SIM, D, T, cellOf, way, mean } = require('./lib.cjs'), { mkT } = require('./survey.cjs');
const S = mkT(1, 14), R = S.run, h = R.hero, m = R.map, W = m.W; R.en = []; m.hazards = []; const st = (i) => SIM.step(S, Object.assign({ px: 960, py: 540, keys: [] }, i));
for (let i = 0; i < 30; i++) st({});
const at = (k) => { h.x = (k % W + 0.5) * T; h.y = (Math.floor(k / W) + 0.5) * T + 2; h.vx = h.vy = 0; for (let i = 0; i < 20; i++) st({}); };
const floorK = way(S).find((k, i, a) => i > 5 && [1, 2, 3, 4, 5, 6].every((d) => m.cells[k + d] === 1)); at(floorK);
let x0 = h.x, f1 = -1, fFull = -1, sp = 0; for (let f = 1; f <= 40; f++) { st({ right: true }); const v = (h.x - x0) / SIM.DT; x0 = h.x; if (f1 < 0 && v > 1) f1 = f; sp = Math.max(sp, v); if (fFull < 0 && v > 0.95 * sp && f > 3 && Math.abs(v - sp) < 1) fFull = f; }
let fStop = -1; for (let f = 1; f <= 40; f++) { st({}); const v = (h.x - x0) / SIM.DT; x0 = h.x; if (fStop < 0 && Math.abs(v) < 1) fStop = f; }
console.log(`move: first motion frame ${f1}, full speed by frame ${fFull} (${sp.toFixed(0)} px/s), stop after release frame ${fStop}`);
S.ev = []; let fs = -1; for (let f = 1; f <= 20; f++) { st({ press: f === 1 }); if (fs < 0 && S.ev.some((e) => e.k === 'swing' && e.t === S.t)) fs = f; } console.log(`attack: swing event on frame ${fs}`);
for (let i = 0; i < 60; i++) st({}); at(floorK); x0 = h.x; st({ right: true, keys: ['Space'] }); for (let f = 0; f < 30; f++) st({}); console.log(`dash from rest: ${(h.x - x0).toFixed(0)} px`);
const speedOn = (cells) => { for (const k of cells) { if (![1, 2, 3, 4].every((d) => cells.includes(k + d))) continue; at(k); const xa = h.x; for (let f = 0; f < 20; f++) st({ right: true }); return ((h.x - xa) / (20 * SIM.DT)).toFixed(0); } return '-'; };
const cr = m.crust || [], deck = (m.crossings || []).filter((c) => c.kind === 'slabs').flatMap((c) => c.cells);
console.log(`walk 20 frames from rest, px/s: floor ${speedOn(way(S).filter((k) => m.cells[k] === 1))}, crust ${speedOn(cr)}, slabs ${speedOn(deck)}`);
