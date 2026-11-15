// cartend.js (town r8, body for evalq.mjs): the cart's last stretch (the turn onto the level run to the unloading yard, s 290 to the end),
// camera centred on the cart, 200x170 crops x3; and the hero's back (h.back) on the paving by the fire, a 140x140 crop x4 next to his front.
// run: node tools/measure/motion/evalq.mjs tools/measure/assets/cartend.js frames/critic_r8_assets/cartend/views.json
const Q = SCENE.QA(), D = DATA, pick = (n) => (Q.states.find((s) => s[0] === n) || [])[1], c = document.getElementById('c'), png = {}, info = [];
const crop = (cx, cy, w, h, k) => { const v = document.createElement('canvas'); v.width = w * k; v.height = h * k; const g = v.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(c, cx - w / 2, cy - h / 2, w, h, 0, 0, w * k, h * k); return v.toDataURL('image/png'); };
const S = pick('town_cart_rolling'), R = S.run, pts = D.railPts(R.map);
const tot = pts.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
for (const s of [290, 305, 320, 330, 340, 350, 358, Math.round(tot)]) { Object.assign(R.cart, { s, st: s >= tot ? 'at' : 'down', load: 3 });
  const V = D.cartView(pts, s), end = pts[pts.length - 1]; R.cam = [end[0] - 960, end[1] - 540];
  LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const g = LIB.TRACE.cart && LIB.TRACE.cart.ground;
  info.push({ s, th: +V.th.toFixed(1), side: V.side, sx: +V.sx.toFixed(2), rot: +V.rot.toFixed(1), tilt: +V.tilt.toFixed(1), at: g && g.map(Math.round) });
  if (g) png['end_s' + String(s).padStart(4, '0')] = crop(Math.round(g[0]), Math.round(g[1]) - 25, 200, 170, 3); }
png.end_whole = c.toDataURL('image/png');
const H = pick('town_services'), h = H.run.hero;
for (const [nm, back] of [['hero_front', false], ['hero_back', true]]) { h.back = back; h.backT = -9; h.vx = 0; h.vy = 0; H.run.cam = [h.x - 960, h.y - 540];
  LIB.TRACE = {}; SCENE.state = H; SCENE.render(H.t + 0.01); png[nm] = crop(960, 520, 140, 140, 4); }
return { tot: Math.round(tot), info, png };
