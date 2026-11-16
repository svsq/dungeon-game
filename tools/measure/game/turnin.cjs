// r9 game critic: the first board's quests taken, then all made done, then handed in to each giver with a '?' over him. Unlike
// town_loop.cjs it tries spots round the giver till the path is found and checks that E talked to that giver, not to a neighbour.
// Prints per giver: the mark, the walk, who answered, the presses, the reward; then the marks left in the town.
//   node tools/measure/game/turnin.cjs [seed]
const P = require('./play.cjs'), { X, D, UI } = P;
const seed = +(process.argv[2] || 1), S = P.start(seed), R = S.run, h = R.hero;
P.greet(S);
P.goSvc(S, 'board'); P.tap(S, 'KeyE'); const rows = S.bdRows || [], Ub = UI.board(rows.length); for (let i = 0; i < rows.length; i++) P.clickId(S, Ub.r, 'take:' + i);
for (let i = 0; i < 4 && S.screen !== 'play'; i++) P.tap(S, 'Escape');
const marks = () => ['keeper', 'guard', 'porter', 'sweeper', 'child', 'mason', 'smith', 'enchanter'].map((r) => r + ':' + (X.questMark(R, r) || '-')).join(' ');
console.log(`seed ${seed}: quests ${(R.quests || []).map((q) => q.key + '<' + q.from).join(', ')}\nmarks after the board: ${marks()}`);
R.freed = { merchant: 1, smith: 1, enchanter: 1 }; R.deepest = 6; R.bossN = 1; R.lastBoss = 'goblin';
for (const q of R.quests || []) { q.n = q.need; q.st = 'done'; }
console.log(`marks with all done: ${marks()}`);
function reach(f) { for (const [dx, dy] of [[0, 30], [0, 40], [30, 10], [-30, 10], [0, -30], [40, 30], [-40, 30]]) { const r = P.goXY(S, f.x + dx, f.y + dy, 30); if (r.ok) return r; } return { ok: false }; }
for (let pass = 0; pass < 2; pass++) for (const role of ['keeper', 'guard', 'porter', 'sweeper', 'child', 'mason']) {
  const f = P.folk(S, role); if (!f || X.questMark(R, role) !== '?') continue;
  const t = S.t, r = reach(f), g0 = h.gold, x0 = h.xp, s0 = S.meta.shards; P.tap(S, 'KeyE'); const who = S.talk && S.talk.role; let n = 1;
  while (S.screen === 'talk' && n < 40) { const T = S.talk; P.tap(S, T.act && T.act.k === 'take' && T.p + 1 >= T.pages.length ? 'Escape' : 'KeyE'); n++; }
  for (let i = 0; i < 4 && S.screen !== 'play'; i++) P.tap(S, 'Escape');
  console.log(`${role}: walk ${r.ok ? (S.t - t).toFixed(1) + ' s' : 'failed'}, E talked to ${who}, ${n} presses, +${h.gold - g0} gold +${h.xp - x0} xp +${S.meta.shards - s0} shards, mark now '${X.questMark(R, role) || '-'}'`);
}
console.log(`left: ${(R.quests || []).map((q) => q.key + ':' + q.st).join(', ')}\nmarks at the end: ${marks()}`);
