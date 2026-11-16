// r9 game critic: walking up to a townsman who walks his own round (porter, sweeper), as a player does: steer at where he is now,
// the path made again every 0.25 s, E once within 60 px. Prints the time to reach him, whether he stopped for the hero, who answered.
//   node tools/measure/game/chase.cjs [seed] [tries]
const P = require('./play.cjs'), { X } = P;
const seed = +(process.argv[2] || 3), N = +(process.argv[3] || 6), S = P.start(seed), R = S.run, h = R.hero;
P.greet(S);
const spots = ['board', 'shop', 'anvil', 'altar', 'portal', 'stairs'];
for (const role of ['porter', 'sweeper', 'child', 'mason']) for (let k = 0; k < N; k++) {
  P.goSvc(S, spots[k % spots.length]); for (let i = 0; i < 4 && S.screen !== 'play'; i++) P.tap(S, 'Escape');
  P.run(S, 1 + k * 1.7);
  const f = P.folk(S, role); if (!f) break; const t0 = S.t; let moved = 0, last = [f.x, f.y], p = null, pt = -1, ok = false;
  while (S.t - t0 < 30) {
    const d = Math.hypot(f.x - h.x, f.y - h.y); if (d < 60) { ok = true; break; }
    if (S.t - pt > 0.25) { p = P.finePath(S, f.x, f.y + 24) || P.finePath(S, f.x, f.y - 24); pt = S.t; }
    if (!p) { P.step(S, {}); continue; }
    let j = 0; while (j < p.length - 1 && Math.hypot(p[j][0] - h.x, p[j][1] - h.y) < 14) j++;
    const dx = p[j][0] - h.x, dy = p[j][1] - h.y; P.step(S, { left: dx < -3, right: dx > 3, up: dy < -3, down: dy > 3 });
    moved += Math.hypot(f.x - last[0], f.y - last[1]); last = [f.x, f.y];
  }
  const tR = S.t - t0, fx = f.x, fy = f.y; P.run(S, 0.3); const stillAfter = Math.hypot(f.x - fx, f.y - fy);
  P.tap(S, 'KeyE'); const who = S.talk && S.talk.role; for (let i = 0; i < 6 && S.screen !== 'play'; i++) P.tap(S, 'Escape');
  console.log(`${role} try ${k}: ${ok ? 'reached in ' + tR.toFixed(1) + ' s' : 'not reached in 30 s'}, he walked ${moved.toFixed(0)} px meanwhile, ${stillAfter.toFixed(0)} px in the next 0.3 s, E -> ${who || S.screen}`);
}
