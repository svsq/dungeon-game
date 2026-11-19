// r8: the hero's trips between the town's services with the real collision and the townsfolk walking their rounds: how often a trip is held up
// (no progress for 0.5 s or more), by what (a townsman near, a prop), and how long a trip takes against the free path at the run speed
//   node tools/measure/game/town_trips.cjs [seeds 1-6] [trips 40]
const P = require('./play.cjs'), [a, b = a] = (process.argv[2] || '1-6').split('-').map(Number), N = +(process.argv[3] || 40), RUN = P.SIM.K.RUN;
const names = ['stairs', 'shop', 'anvil', 'lectern', 'altar', 'stash', 'board', 'portal', 'adit', 'fire'];
let trips = 0, held = 0, slow = 0, fail = 0; const by = {}, worst = [];
for (let seed = a; seed <= b; seed++) { const S = P.start(seed), R = S.run, h = R.hero; P.greet(S); R.freed = { merchant: 1, smith: 1, enchanter: 1 }; let r = seed * 99991 % 2147483647; const rnd = (n) => (r = (r * 48271) % 2147483647) % n;
  for (let i = 0; i < N; i++) { const k = names[rnd(names.length)], a0 = k === 'adit' ? 36 : 36, tgt = k === 'shop' ? R.map.shop.front : P.svc(S, k), gx = tgt.x, gy = tgt.y + (k === 'shop' ? 4 : a0);
    const p = P.finePath(S, gx, gy); if (!p) { fail++; continue; } const L = p.reduce((s, q, j) => s + (j ? Math.hypot(q[0] - p[j - 1][0], q[1] - p[j - 1][1]) : 0), 0); const t0 = S.t; let hold = 0, mx = 0, cur = 0, prev = [h.x, h.y], who = {};
    const hook = () => { const mv = Math.hypot(h.x - prev[0], h.y - prev[1]); prev = [h.x, h.y]; if (mv < 0.5) { cur += P.SIM.DT; mx = Math.max(mx, cur); const f = R.folk.find((q) => q.role !== 'hen' && Math.hypot(q.x - h.x, q.y - h.y) < 46); if (f) who[f.role] = 1; } else cur = 0; };
    // the same walk as goXY, with a look at each step
    let j = 0, ok = false, still = 0, last = [h.x, h.y];
    while (S.t - t0 < 40) { while (j < p.length - 1 && Math.hypot(p[j][0] - h.x, p[j][1] - h.y) < 14) j++; const dx = p[j][0] - h.x, dy = p[j][1] - h.y; if (j >= p.length - 1 && Math.hypot(dx, dy) < 10) { ok = true; break; }
      P.step(S, { left: dx < -3, right: dx > 3, up: dy < -3, down: dy > 3 }); hook(); if (S.screen !== 'play') break; }
    trips++; const T = S.t - t0, free = L / RUN; if (!ok) fail++; if (mx >= 0.5) { held++; for (const w of Object.keys(who)) by[w] = (by[w] || 0) + 1; if (!Object.keys(who).length) by.prop = (by.prop || 0) + 1; worst.push([+mx.toFixed(1), seed, k]); } if (ok && T > free * 1.25 + 0.5) slow++; } }
worst.sort((x, y) => y[0] - x[0]);
console.log(`trips ${trips}, held up >= 0.5 s: ${held} (${(100 * held / trips).toFixed(0)} %), slower than 1.25x the free path: ${slow}, not arrived in 40 s: ${fail}; held by`, JSON.stringify(by), 'longest holds', JSON.stringify(worst.slice(0, 6)));
