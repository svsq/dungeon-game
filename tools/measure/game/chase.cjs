// r9 game critic: walking up to a townsman who walks his own round (porter, sweeper), as a player does: steer at where he is now,
// the path made again every 0.25 s (round the other townsfolk when it can: through them the hero stuck on the Keeper, TASKS 2126), E once within 60 px. Prints the time to reach him, whether he stopped for the hero, who answered.
// TASKS 2126: the keeper and the guard, who stand, are walked to from the same spots for the ratio; with 'marks' every walker has a
// quest to give (his '!'), so he waits for the hero (D.FOLK_HOLD); the last line gives each one's mean time and its ratio to the standing,
// from the start and from the hero's first step within CLOSE px (the spots lie at different ways off; a try not reached is left out).
//   node tools/measure/game/chase.cjs [seed] [tries] [marks]
const P = require('./play.cjs'), { X, D } = P;
const seed = +(process.argv[2] || 3), N = +(process.argv[3] || 6), S = P.start(seed), R = S.run, h = R.hero;
P.greet(S);
const CLOSE = 200, WALK = ['porter', 'sweeper', 'child', 'mason'], STAND = ['keeper', 'guard'], T = {};
if (process.argv[4] === 'marks') { R.offers = WALK.filter((r) => D.QUEST_GIVE.from.includes(r)).map((r) => ({ key: 'fetch', from: r, q: 0 })); R.quests = []; }
const spots = ['board', 'shop', 'anvil', 'altar', 'portal', 'stairs'];
walk: for (const role of STAND.concat(WALK)) for (let k = 0; k < N; k++) {
  P.goSvc(S, spots[k % spots.length]); for (let i = 0; i < 4 && S.screen !== 'play'; i++) P.tap(S, 'Escape');
  P.run(S, 1 + k * 1.7);
  const f = P.folk(S, role); if (!f) break; const t0 = S.t; let moved = 0, last = [f.x, f.y], p = null, pt = -1, ok = false, tC = null, movedC = 0;
  while (S.t - t0 < 30) {
    const d = Math.hypot(f.x - h.x, f.y - h.y); if (d < CLOSE && tC === null) tC = S.t; if (d < 60) { ok = true; break; }
    if (S.t - pt > 0.25) { p = P.finePath(S, f.x, f.y + 24, true) || P.finePath(S, f.x, f.y - 24, true) || P.finePath(S, f.x, f.y + 24) || P.finePath(S, f.x, f.y - 24); pt = S.t; }
    if (!p) { P.step(S, {}); continue; }
    let j = 0; while (j < p.length - 1 && Math.hypot(p[j][0] - h.x, p[j][1] - h.y) < 14) j++;
    const dx = p[j][0] - h.x, dy = p[j][1] - h.y; P.step(S, { left: dx < -3, right: dx > 3, up: dy < -3, down: dy > 3 });
    { const dm = Math.hypot(f.x - last[0], f.y - last[1]); moved += dm; if (tC !== null) movedC += dm; } last = [f.x, f.y];
  }
  const tR = S.t - t0, tc = tC === null ? 0 : S.t - tC, fx = f.x, fy = f.y; P.run(S, 0.3); const stillAfter = Math.hypot(f.x - fx, f.y - fy);
  if (ok) (T[role] = T[role] || []).push([tR, tc, movedC]); const mark = X.questMark(R, role) || '-';
  P.tap(S, 'KeyE'); const who = S.talk && S.talk.role; for (let i = 0; i < 6 && S.screen !== 'play'; i++) P.tap(S, 'Escape');
  if (!R.town) { console.log(`${role} try ${k}: E took the way down by him, the town left: the rest is not measured`); break walk; }
  console.log(`${role} try ${k}: ${ok ? 'reached in ' + tR.toFixed(1) + ' s (' + tc.toFixed(1) + ' s from ' + CLOSE + ' px)' : 'not reached in 30 s'}, he walked ${moved.toFixed(0)} px meanwhile (${movedC.toFixed(0)} px of it with the hero within ${CLOSE} px), ${stillAfter.toFixed(0)} px in the next 0.3 s, mark '${mark}', E -> ${who || S.screen}`);
}
const mean = (a, j) => a.reduce((p, q) => p + q[j], 0) / a.length, all = STAND.flatMap((r) => T[r] || []), st = [mean(all, 0), mean(all, 1)];
console.log(`standing mean ${st[0].toFixed(1)} s, ${st[1].toFixed(1)} s from ${CLOSE} px; ` + WALK.filter((r) => T[r]).map((r) => `${r} ${mean(T[r], 0).toFixed(1)} s (x${(mean(T[r], 0) / st[0]).toFixed(2)}), ${mean(T[r], 1).toFixed(1)} s (x${(mean(T[r], 1) / st[1]).toFixed(2)}), ${Math.min(...T[r].map((q) => q[0])).toFixed(1)}–${Math.max(...T[r].map((q) => q[0])).toFixed(1)} s, walked off ${mean(T[r], 2).toFixed(0)} px from ${CLOSE} px, of ${T[r].length}`).join('; '));
