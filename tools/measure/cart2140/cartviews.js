// cartviews.js (TASKS 2140, body for evalq.mjs): the town cart at its change of view, each load (3 full, 2 half, 0 empty).
// (1) at the swap's s, three renders with one camera: no cart (bg), the front painting alone, the 3/4 painting alone (DATA.cartFade forced),
//     1:1 crops BOX px round the ground point, for cartviews.py to take the cart's mask as what differs from bg;
// (2) the frame sequence across the bend, s from the swap - SPAN to + SPAN every STEP px of rails, one camera, an SH px x Z sheet per load; the wheels' places (front slabs' feet, 3/4 hubs) in the crops.
// run: node tools/measure/motion/evalq.mjs tools/measure/cart2140/cartviews.js frames/cart_2140_before/views.json
const SZ = (n) => window.SIZES[n], BOX = 120, Z = 3, SH = 80, SPAN = 16, STEP = 2, LOADS = [3, 2, 0];
const Q = SCENE.QA(), st = Q.states.find((q) => q[0] === 'town_cart_rolling')[1], R = st.run, pts = DATA.railPts(R.map), c = document.getElementById('c');
const tot = DATA.railTot(pts), sOf = (ds) => ds * tot / (tot - DATA.CART.stop), swap = DATA.cartSwap(pts), s0 = sOf(swap), fade0 = DATA.cartFade, png = {}, info = { swap, s0, fade: DATA.CART.fade, seq: {} };
const at0 = DATA.cartAt(pts, s0); R.cam = [Math.round(at0.x - SCX.VW / 2), Math.round(at0.y - SCX.VH / 2)]; R.offers = [];
const shot = (s, load, force, hide) => { Object.assign(R.cart, { s, st: hide ? 'in' : 'down', load, v: 0 });
  DATA.cartFade = force === undefined ? fade0 : (p, d, a) => Object.assign(fade0(p, d, a), { a: force });
  LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); DATA.cartFade = fade0; return LIB.TRACE.cart || {}; };
const crop = (cx, cy, w, h, k) => { const v = document.createElement('canvas'); v.width = w * k; v.height = h * k; const g = v.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(c, cx - w / 2, cy - h / 2, w, h, 0, 0, w * k, h * k); return v; };
const g0 = shot(s0, 3, 0).ground, cx = Math.round(g0[0]), cy = Math.round(g0[1]) - 30; info.crop = [cx - BOX / 2, cy - BOX / 2, BOX];
for (const load of LOADS) {
  shot(s0, load, 0, true); png[`bg_l${load}`] = crop(cx, cy, BOX, BOX, 1).toDataURL('image/png');
  for (const [tag, a] of [['front', 0], ['side', 1]]) { const j = shot(s0, load, a), F = DATA.cartFade(pts, at0.ds), V = a ? F.S : F.F, nm = (a ? ['cart_tw', 'cart_tw_half', 'cart_tw_empty'] : ['cart_tw_f', 'cart_tw_f_half', 'cart_tw_f_empty'])[load >= 3 ? 0 : load === 2 ? 1 : 2];
    const [w, h] = SZ(nm), P = DATA.cartPut(nm, w, h, V, at0), bob = 0.8 * Math.sin(s0 / 6), crop0 = [cx - BOX / 2, cy - BOX / 2];
    const at = (p) => [p[0] - at0.x + j.ground[0] - crop0[0], p[1] - at0.y + j.ground[1] + bob - crop0[1]];
    const wheels = a ? DATA.CART.hubs[nm].map(([u, v]) => at(P((u - 0.5) * w, (v - 1) * h))) : DATA.cartFeet(0, nm, w, h, V, at0).map(at);
    info[`${tag}_l${load}`] = { ground: j.ground, top: j.top, wheels, hub: a ? DATA.cartHubs(nm, w, h) : 0 };
    png[`${tag}_l${load}`] = crop(cx, cy, BOX, BOX, 1).toDataURL('image/png'); }
  const S = []; for (let s = s0 - SPAN; s <= s0 + SPAN + 1e-6; s += STEP) S.push(s);
  const sheet = document.createElement('canvas'); sheet.width = SH * Z * S.length; sheet.height = SH * Z; const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false;
  info.seq[load] = S.map((s, i) => { const j = shot(s, load); const v = DATA.cartAt(pts, s);
    png[`seq_l${load}_${String(i).padStart(2, '0')}`] = crop(cx, cy, BOX, BOX, 1).toDataURL('image/png');
    g.drawImage(c, cx - SH / 2, cy - SH / 2, SH, SH, i * SH * Z, 0, SH * Z, SH * Z); g.fillStyle = '#fff'; g.font = '20px monospace';
    const a = +fade0(pts, v.ds).a.toFixed(2); g.fillText(`${(s - s0).toFixed(0)} a${a}`, i * SH * Z + 6, 24);
    return { s: +s.toFixed(1), a, ground: j.ground && j.ground.map((q) => +q.toFixed(1)) }; });
  png[`sheet_l${load}`] = sheet.toDataURL('image/png'); }
return { info, png };
