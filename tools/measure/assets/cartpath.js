// cartpath.js (town r8, body for evalq.mjs): the mine cart along its whole track, s from 0 to the end in 16 steps, rolling down, full load.
// Each step: D.cartView's track angle th, side/front painting, turn, squash sx, rot and tilt, and a 200x170 crop round the cart's ground joint
// blown up x3 with hard pixels (cart_sNNNN.png). Also the whole frame of the hero's back (town_gate_behind) and the bridge / debris states.
// run: node tools/measure/motion/evalq.mjs tools/measure/assets/cartpath.js frames/critic_r8_assets/cartpath/views.json
const Q = SCENE.QA(), D = DATA, pick = (n) => (Q.states.find((s) => s[0] === n) || [])[1], c = document.getElementById('c'), png = {}, info = [];
const S = pick('town_cart_rolling'), R = S.run, pts = D.railPts(R.map);
const tot = pts.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
const crop = (cx, cy, w, h, k) => { const v = document.createElement('canvas'); v.width = w * k; v.height = h * k; const g = v.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(c, cx - w / 2, cy - h / 2, w, h, 0, 0, w * k, h * k); return v.toDataURL('image/png'); };
for (let i = 0; i <= 16; i++) { const s = Math.round(tot * i / 16); Object.assign(R.cart, { s, st: 'down', load: 3 }); const V = D.cartView(pts, s);
  LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const j = LIB.TRACE.cart, g = j && j.ground;
  info.push({ s, th: +V.th.toFixed(1), side: V.side, turn: +(V.turn || 0).toFixed(2), sx: +V.sx.toFixed(2), rot: +V.rot.toFixed(1), tilt: +V.tilt.toFixed(1), at: g && g.map(Math.round) });
  if (g) png['cart_s' + String(s).padStart(4, '0')] = crop(Math.round(g[0]), Math.round(g[1]) - 25, 200, 170, 3); }
for (const n of ['town_gate_behind', 'town_altar_behind', 'cave_bridge', 'bridge', 'debris_rest', 'wreck_broken']) { const st = pick(n); if (!st) continue;
  SCENE.state = st; SCENE.render(st.t + 0.01); png[n] = c.toDataURL('image/png'); }
return { pts: pts.map((p) => p.map(Math.round)), tot: Math.round(tot), info, png };
