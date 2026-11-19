// cartload.js (town r9, body for evalq.mjs): the 3/4 cart at the track's end with each load (3 full, 2 half, 0 empty) and the front cart
// at the adit with each load, same place and camera; 160x130 crops x4, and the cart's opaque bbox in view px from LIB.TRACE.cart if traced.
// run: node tools/measure/motion/evalq.mjs tools/measure/assets/cartload.js frames/critic_r9_assets/cartload/views.json
const Q = SCENE.QA(), D = DATA, pick = (n) => (Q.states.find((s) => s[0] === n) || [])[1], c = document.getElementById('c'), png = {}, info = [];
const crop = (cx, cy, w, h, k) => { const v = document.createElement('canvas'); v.width = w * k; v.height = h * k; const g = v.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(c, cx - w / 2, cy - h / 2, w, h, 0, 0, w * k, h * k); return v.toDataURL('image/png'); };
const S = pick('town_cart_rolling'), R = S.run, pts = D.railPts(R.map);
const tot = pts.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
for (const [tag, s] of [['end', Math.round(tot) - 30], ['adit', 21]]) for (const load of [3, 2, 1, 0]) {
  Object.assign(R.cart, { s, st: 'down', load, v: 0 });
  const p = pts[0], g0 = tag === 'end' ? pts[pts.length - 1] : p; R.cam = [g0[0] - 960, g0[1] - 540];
  LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const g = LIB.TRACE.cart && LIB.TRACE.cart.ground;
  info.push({ tag, s, load, at: g && g.map(Math.round) });
  if (g) png[tag + '_l' + load] = crop(Math.round(g[0]), Math.round(g[1]) - 25, 160, 130, 4); }
return { tot: Math.round(tot), info, png };
