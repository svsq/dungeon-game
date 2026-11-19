// r8: a first run's walk through every service of the town with real input: what E opens, what it says, what a shut one says.
//   node tools/measure/game/town_walk.cjs [seed] [gold] [shards]
const P = require('./play.cjs');
const seed = +(process.argv[2] || 1), S = P.start(seed), R = S.run, h = R.hero;
if (process.argv[3]) h.gold = +process.argv[3]; if (process.argv[4]) S.meta.shards = +process.argv[4];
const g = P.greet(S); console.log('greet at', g.at, 's; pages', S.talk ? '' : '', 'msg:', R.msg && R.msg.s);
const text = (e) => e.s || e.k, real = (e) => e.k !== 'ui' && e.k !== 'step';
for (const k of ['shop', 'anvil', 'lectern', 'stash', 'altar', 'board', 'portal', 'fire', 'adit', 'stairs']) {
  const r = P.goSvc(S, k); if (!r.ok) { console.log(k, 'WALK', JSON.stringify(r)); continue; }
  const before = S.ev.length; P.tap(S, 'KeyE'); const newEv = S.ev.filter((e) => e.t >= S.t - 0.4 && real(e)).map(text);
  console.log(k.padEnd(8), 'walk', r.t.toFixed(1) + 's', '-> screen', S.screen, S.talk ? 'talk:' + S.talk.role : '', '| ev', JSON.stringify(newEv).slice(0, 160), '| msg', R.msg && R.msg.s);
  if (S.screen === 'talk') { const T = S.talk; console.log('   talk pages', JSON.stringify(T.pages).slice(0, 300), 'topics', (T.topics || []).length, 'act', T.act && T.act.k); }
  for (let i = 0; i < 6 && S.screen !== 'play'; i++) P.tap(S, S.screen === 'talk' ? 'KeyE' : 'Escape');
  if (S.screen !== 'play') console.log('   stuck screen', S.screen);
}
console.log('t', Math.round(S.t), 'gold', h.gold, 'shards', S.meta.shards);
