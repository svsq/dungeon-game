// r8 (r7's cart check): the hero standing on each of 10 points of the rails, the cart rolling: how long it holds, how far the hero is carried off the rails, whether he ends in rock
//   node tools/measure/game/cart_block.cjs [seed]
const P = require('./play.cjs'), { X } = P, seed = +(process.argv[2] || 1); const out = [];
for (let i = 0; i < 10; i++) { const S = P.start(seed), R = S.run, h = R.hero, m = R.map; P.greet(S); const C = R.cart, pts = m.town.rails.map((k) => [(k % m.W + 0.5) * 32, (Math.floor(k / m.W) + 0.5) * 32]); let L = 0; for (let j = 1; j < pts.length; j++) L += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); const s = L * (i + 0.5) / 10;
  const at = (d) => { for (let j = 1; j < pts.length; j++) { const l = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); if (d <= l) return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * d / l, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * d / l]; d -= l; } return pts[pts.length - 1]; }, [x, y] = at(s);
  h.x = x; h.y = y; C.st = 'down'; C.s = Math.max(0, s - 120); let held = 0, mx = 0, t0 = S.t; const x0 = h.x, y0 = h.y; const ok = P.DG.townWalk(m); let inRock = false;
  for (let k = 0; k < 120 * 30; k++) { P.step(S, {}); if ((C.held || 0) > mx) mx = C.held; if (!ok[P.cellOf(m, h.x, h.y)]) inRock = true; }
  out.push(`pt ${i}: longest hold ${mx.toFixed(1)} s, hero moved ${Math.round(Math.hypot(h.x - x0, h.y - y0))} px, in rock ${inRock}, cart ends ${C.st}`); }
console.log(out.join('\n'));
