// r8: the round trip a player makes to the town and back mid-run: the stairs down, the scroll of return (T), the town, the stones' ring (E), the floor again.
//   node tools/measure/game/town_scroll.cjs [seed]
const P = require('./play.cjs'), { X } = P, seed = +(process.argv[2] || 1), S = P.start(seed), R = S.run, h = R.hero;
P.greet(S); const say = () => (R.msg && R.msg.s) || '';
let t = S.t; const w = P.goSvc(S, 'stairs'); P.tap(S, 'KeyE'); P.run(S, 2.5);
console.log('stairs: walk', w.ok, 'floor', R.floor, 'town', R.town, 'msg:', say(), 'scrolls', h.bag.filter((i) => i && i.b === 'scroll').reduce((n, i) => n + (i.n || 1), 0), 'cost in time since greet', (S.t - t).toFixed(1));
t = S.t; P.tap(S, 'KeyT'); const t1 = S.t; let n = 0; while (R.floor !== 0 && S.t - t1 < 15) { P.run(S, 0.1); n++; }
console.log('scroll: T pressed, floor', R.floor, 'after', (S.t - t1).toFixed(1), 's; msg:', say(), '; hero', Math.round(h.x), Math.round(h.y), 'portal', JSON.stringify(R.portal));
console.log('events', JSON.stringify(S.ev.filter((e) => e.t >= t - 0.1 && e.k !== 'step' && e.k !== 'ui').map((e) => e.k + (e.s ? ':' + e.s : '')).slice(-8)));
const fl = S.t; const g = P.goSvc(S, 'portal'); console.log('walk to the ring', g.ok, (S.t - fl).toFixed(1), 's; gateWays', JSON.stringify(X.gateWays(R)), 'prompt dist', Math.round(Math.hypot(P.svc(S, 'portal').x - h.x, P.svc(S, 'portal').y - h.y)));
P.tap(S, 'KeyE'); console.log('E at the ring: screen', S.screen, 'floor', R.floor); if (S.screen === 'gate') { console.log('gate window rows', JSON.stringify(P.D.UI.gate ? P.D.UI.gate(X.gateWays(R).length).r.map((q) => q.id) : '')); }
for (let i = 0; i < 4 && S.screen === 'gate'; i++) { P.tap(S, 'Enter'); }
console.log('after: screen', S.screen, 'floor', R.floor, 'hero', Math.round(h.x), Math.round(h.y), 'msg:', say());
