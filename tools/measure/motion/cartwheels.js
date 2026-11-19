// body for evalq.mjs: the cart's wheels magnified: 8 positions 2 px of rail apart on the straight (s from 200), the wheel line in the 3/4 painting at zoom 8; then the cart at rest (s = end), and the front view at s=20
// node tools/measure/motion/evalq.mjs tools/measure/motion/cartwheels.js frames/critic_r8_motion/cartwheels.json
const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play';
const R = S.run, m = R.map, h = R.hero; R.msg = null; R.captives = null; R.folk = DATA.folkInit(m.town.npcs); h.x = m.town.svc.portal.x + 3 * DATA.TILE; h.y = m.town.svc.portal.y; SIM.step(S, { keys: [] }); S.ev = []; R.offers = [];
const cv = document.getElementById('c'), pts = SCX.railPts(m), BOX = 64, Z = 8, png = {}, rows = [];
const at = (s) => { let d = s, x = pts[pts.length - 1][0], y = pts[pts.length - 1][1]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay); if (d <= l) { x = ax + (bx - ax) * d / l; y = ay + (by - ay) * d / l; break; } d -= l; } return [x, y]; };
const shot = (s, k) => { Object.assign(R.cart, { s, st: 'down', load: 3 }); const [x, y] = at(s); R.cam = [x - SCX.VW / 2, y - 6 - SCX.VH / 2]; LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
  const j = JSON.parse(JSON.stringify(LIB.TRACE.cart || {})), c = j.ground || [960, 560], o = document.createElement('canvas'); o.width = o.height = BOX * Z; const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(cv, c[0] - BOX / 2, c[1] - BOX * 0.8, BOX, BOX, 0, 0, BOX * Z, BOX * Z); png[k] = o.toDataURL(); rows.push({ k, s, j }); };
for (let i = 0; i < 8; i++) shot(200 + 2 * i, 'wh_' + (200 + 2 * i));
for (const s of [20, 330, 345, 355, 364]) shot(s, 'cart_s' + s);
return { rows, png };
