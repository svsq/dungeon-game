// r8: walking distances (px along the hero's collision-free path, and seconds at the run speed) between the town's services
//   node tools/measure/game/town_dist.cjs [seed]
const P = require('./play.cjs'), seed = +(process.argv[2] || 1), S = P.start(seed), R = S.run, h = R.hero, RUN = P.SIM.K.RUN;
const spots = { spawn: [h.x, h.y], stairs: [P.svc(S, 'stairs').x, P.svc(S, 'stairs').y + 36], shop: [R.map.shop.front.x, R.map.shop.front.y + 4], anvil: [P.svc(S, 'anvil').x, P.svc(S, 'anvil').y + 36], lectern: [P.svc(S, 'lectern').x, P.svc(S, 'lectern').y + 36],
  altar: [P.svc(S, 'altar').x, P.svc(S, 'altar').y + 36], stash: [P.svc(S, 'stash').x, P.svc(S, 'stash').y + 36], board: [P.svc(S, 'board').x, P.svc(S, 'board').y + 36], portal: [P.svc(S, 'portal').x, P.svc(S, 'portal').y + 36],
  adit: [P.svc(S, 'adit').x, P.svc(S, 'adit').y + 36], exitGate: [P.svc(S, 'exitGate').x, P.svc(S, 'exitGate').y - 20] };
const names = Object.keys(spots), len = (p) => p && p.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
console.log('run speed', RUN, 'px/s'); console.log(' '.repeat(9) + names.map((n) => n.slice(0, 7).padStart(8)).join(''));
const D = {}; for (const a of names) { h.x = spots[a][0]; h.y = spots[a][1]; D[a] = {}; console.log(a.padEnd(9) + names.map((b) => { const p = P.finePath(S, spots[b][0], spots[b][1]); const l = len(p); D[a][b] = l; return (l == null ? 'none' : (l / RUN).toFixed(1) + 's').padStart(8); }).join('')); }
const tour = ['spawn', 'board', 'shop', 'anvil', 'lectern', 'altar', 'stash', 'stairs']; let tt = 0; for (let i = 1; i < tour.length; i++) tt += D[tour[i - 1]][tour[i]] / RUN;
console.log('tour', tour.join(' > '), tt.toFixed(1) + ' s');
