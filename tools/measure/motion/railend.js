// body for evalq.mjs: where the track's sprites end against the rail line and the cart's stop (s = line length)
const S = SIM.spawn(0, {}); SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); const R = S.run, m = R.map, pts = SCX.railPts(m);
const lay = DATA.railLay(pts, (n) => SCX.SZ(n)); const tot = pts.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
const last = pts[pts.length - 1], rails = m.town.rails.map((k) => [(k % m.W + 0.5) * DATA.TILE, (Math.floor(k / m.W) + 0.5) * DATA.TILE]);
return { tot, pts0: pts[0], last, cells: rails, n: lay.length, tail: lay.slice(-5).map((q) => [+q.x.toFixed(1), +q.y.toFixed(1), +q.w.toFixed(1), +q.h.toFixed(1)]), cartStop: R.cart ? R.cart.s : null, bin: m.town.svc.bin, mason: R.folk && R.folk.find((f) => f.role === 'mason') && { x: R.folk.find((f) => f.role === 'mason').x, y: R.folk.find((f) => f.role === 'mason').y } };
