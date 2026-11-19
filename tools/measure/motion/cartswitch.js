// cartswitch.js (TASKS 2122, body for evalq.mjs): the town cart across the change of view at the adit's bend, one camera for all frames,
// the frames side by side in one sheet (crop BOX x Z each) with each frame's s, the 3/4 painting's alpha and the traced ground and top.
// run: node tools/measure/motion/evalq.mjs tools/measure/motion/cartswitch.js frames/fix_2122/switch.json   (S, LOAD, BOX, Z below)
const S = [66, 70, 74, 76, 78, 80, 82, 84], LOAD = 3, BOX = 90, Z = 5;
const Q = SCENE.QA(), st = Q.states.find((q) => q[0] === 'town_cart_rolling')[1], R = st.run, pts = DATA.railPts(R.map), c = document.getElementById('c');
const mid = DATA.cartAt(pts, (S[0] + S[S.length - 1]) / 2), sheet = document.createElement('canvas'); sheet.width = BOX * Z * S.length; sheet.height = BOX * Z;
const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false; const info = [];
R.cam = [mid.x - SCX.VW / 2, mid.y - SCX.VH / 2]; R.offers = [];
S.forEach((s, i) => { Object.assign(R.cart, { s, st: 'down', load: LOAD }); LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
  const j = LIB.TRACE.cart || {}, v = DATA.cartAt(pts, s); if (!i) info.cam = j.ground;
  info.push({ s, a: +DATA.cartFade(pts, v.ds).a.toFixed(2), ground: j.ground && j.ground.map((q) => +q.toFixed(1)), top: j.top && j.top.map((q) => +q.toFixed(1)) });
  const [cx, cy] = info.cam; g.drawImage(c, cx - BOX / 2, cy - BOX * 0.62, BOX, BOX, i * BOX * Z, 0, BOX * Z, BOX * Z);
  g.fillStyle = '#fff'; g.font = '28px monospace'; g.fillText(`s ${s} a ${info[i].a}`, i * BOX * Z + 10, 34); });
return { info, png: { cartswitch: sheet.toDataURL('image/png') } };
