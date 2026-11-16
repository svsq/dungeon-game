// evalq.mjs body (town_motion_r9): the cart at rest at the rails' end with each load (3, 2, 1, 0) side by side at zoom 6, the same camera, and its joints;
// the three 3/4 paintings are one painting with the load changed, so the box should keep its size and place from one load to the next
// node tools/measure/motion/evalq.mjs tools/measure/motion/cartloads.js frames/critic_r9_motion/cartloads.json
const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play';
const R = S.run, m = R.map, h = R.hero; R.msg = null; R.captives = null; R.folk = DATA.folkInit(m.town.npcs); h.x = m.town.svc.portal.x + 3 * DATA.TILE; h.y = m.town.svc.portal.y; SIM.step(S, { keys: [] }); S.ev = []; R.offers = [];
const cv = document.getElementById('c'), pts = SCX.railPts(m), BOX = 70, Z = 6, rows = [], strip = document.createElement('canvas'); strip.width = 4 * BOX * Z; strip.height = BOX * Z;
const g = strip.getContext('2d'); g.imageSmoothingEnabled = false; const end = pts[pts.length - 1]; let c0 = null;
[3, 2, 1, 0].forEach((load, k) => { Object.assign(R.cart, { s: 1e4, st: 'at', load, atT: -99, takeT: -99 }); const ms = R.folk.find((q) => q.role === 'mason'); if (ms) ms.lift = 0;
  R.cam = [end[0] - SCX.VW / 2, end[1] - SCX.VH / 2]; LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const j = JSON.parse(JSON.stringify(LIB.TRACE.cart || {})); c0 = c0 || j.ground;
  g.drawImage(cv, c0[0] - BOX / 2, c0[1] - BOX * 0.75, BOX, BOX, k * BOX * Z, 0, BOX * Z, BOX * Z); rows.push({ load, j }); });
return { rows, png: { cartloads: strip.toDataURL() } };
