// r9 game critic: a death in the normal mode (TASKS 2104) played through SIM.step. The hero dies on floor F with and without a portal
// left open; prints where he wakes, the message, the experience lost, the ring's ways and what the stairs offer, the Keeper's words.
//   node tools/measure/game/death_normal.cjs [floor] [seed]
const P = require('./play.cjs'), { X, D } = P;
const F = +(process.argv[2] || 5), seed = +(process.argv[3] || 1);
function trial(withPortal, boss) {
  const S = P.start(seed), R = S.run, h = R.hero; P.greet(S);
  R.deathMode = 'normal'; h.lvl = 6; h.xp = Math.round(D.xpNeed(6) * 0.5);
  if (boss) { S.meta.portals = [2, 4]; }
  X.enterFloor(S, R, F); R.deepest = Math.max(R.deepest || 0, F);
  if (withPortal) R.portal = { f: F, x: h.x, y: h.y, from: 'scroll' };   // a scroll read earlier on this floor, its portal left open
  const xp0 = h.xp, need = D.xpNeed(h.lvl), gold0 = h.gold, deaths0 = S.meta.deaths || 0, f0 = R.floor;
  h.hp = 0; h.deadT = S.t; P.run(S, 2.5);
  const ways = X.gateWays ? X.gateWays(R, S) : '(no gateWays export)';
  console.log(`portal ${withPortal ? 'open' : 'none'}${boss ? ', halls 2,4 open' : ''}: died on ${f0} -> screen ${S.screen}, floor ${R.floor}, town ${!!R.town}; xp ${xp0} -> ${h.xp} (lost ${xp0 - h.xp} = ${((xp0 - h.xp) / need * 100).toFixed(1)} % of the level's ${need}); lvl ${h.lvl}; gold ${gold0} -> ${h.gold}; deaths ${deaths0} -> ${S.meta.deaths}`);
  console.log(`  msg: ${R.msg && R.msg.s}`);
  console.log(`  portal ${JSON.stringify(R.portal)}; ring ways ${JSON.stringify(ways)}; deepest ${R.deepest}; result ${JSON.stringify(S.result && S.result.how)}`);
  const k = P.folk(S, 'keeper'); if (k) { P.goXY(S, k.x, k.y + 30, 30); P.tap(S, 'KeyE'); console.log(`  keeper: ${S.screen} ${S.talk ? S.talk.pages.join(' / ').slice(0, 160) : ''}`); for (let i = 0; i < 8 && S.screen !== 'play'; i++) P.tap(S, S.screen === 'talk' ? 'KeyE' : 'Escape'); }
  const r = P.goSvc(S, 'stairs', 30); P.tap(S, 'KeyE'); P.run(S, 1);
  console.log(`  stairs: walk ${r.ok} -> screen ${S.screen}, floor ${R.floor}${S.screen !== 'play' ? ' rows ' + JSON.stringify((S.gateRows || S.descRows || []).map((q) => q.f || q.k)) : ''}`);
}
for (const [p, b] of [[false, false], [true, false], [false, true]]) trial(p, b);
