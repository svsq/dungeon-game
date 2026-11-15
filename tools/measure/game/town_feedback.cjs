// r8: what the sim sends the render and the sound after each town action (the events of S.ev that are not footsteps or window clicks), and the message line
//   node tools/measure/game/town_feedback.cjs [seed]
const P = require('./play.cjs'), { X, D, UI } = P, seed = +(process.argv[2] || 1), S = P.start(seed), R = S.run, h = R.hero;
P.greet(S); R.freed = { merchant: 1, smith: 1, enchanter: 1 }; R.deepest = 6; R.bossN = 1; h.gold = 5000; S.meta.shards = 200; h.lvl = 7;
const evs = (t0) => [...new Set(S.ev.filter((e) => e.t >= t0 && e.k !== 'step').map((e) => e.k + (e.s ? '(' + String(e.s).slice(0, 40) + ')' : '')))].join(', ') || 'NOTHING';
const act = (name, fn) => { const t0 = S.t, g = h.gold, sh = S.meta.shards, m0 = R.msg; fn(); P.run(S, 0.1); console.log(name.padEnd(26), 'events:', evs(t0 - 0.01), '| gold', g, '->', h.gold, 'shards', sh, '->', S.meta.shards, '| msg', R.msg && R.msg !== m0 ? R.msg.s : '-'); };
P.goSvc(S, 'shop', 4); P.tap(S, 'KeyE'); console.log('shop opens', S.screen, 'goods', R.shop.goods.length);
act('buy the cheapest', () => { const i = R.shop.goods.map((g, k) => [g.price, k]).sort((a, b) => a[0] - b[0])[0][1]; P.clickId(S, UI.shop(R.shop.goods.length, h.bag.length, S.bagTab).r, 'buy:' + i); });
act('sell a potion', () => { const i = h.bag.findIndex((q) => q && q.b === 'hp'); const idb = i >= 0 ? i : h.bag.findIndex(Boolean); P.clickId(S, UI.shop(R.shop.goods.length, h.bag.length, S.bagTab).r, 'sell:' + idb); });
act('buy too dear (gold 1)', () => { h.gold = 1; const i = R.shop.goods.length - 1; P.clickId(S, UI.shop(R.shop.goods.length, h.bag.length, S.bagTab).r, 'buy:' + i); h.gold = 5000; });
P.tap(S, 'KeyE');
P.goSvc(S, 'altar'); P.tap(S, 'KeyE'); console.log('altar opens', S.screen);
const U = UI.meta(S.meta.cls, S.metaTab), rows = Array.isArray(U) ? U : U.r;
console.log('altar ids', rows.map((q) => q.id).join(' ').slice(0, 200));
const first = rows.find((q) => P.D.META ? false : false) || rows.find((q) => q.id === 'hp' || q.id === 'might') || rows[0]; act('altar buy ' + first.id, () => P.clickId(S, rows, first.id)); act('altar buy again', () => P.clickId(S, rows, first.id)); S.meta.shards = 0; act('altar buy with no shards', () => P.clickId(S, rows, first.id));
P.tap(S, 'Escape');
const it = { b: 'shortsword' }; P.goSvc(S, 'anvil'); P.tap(S, 'KeyE'); console.log('anvil E ->', S.screen, S.talk && S.talk.role); P.tap(S, 'KeyE'); for (let i = 0; i < 5 && S.screen === 'talk'; i++) P.tap(S, 'KeyE'); console.log('after E x', S.screen);
if (S.screen === 'craft') { const Uc = UI.craft(h.bag.length, S.bagTab); const eq = Uc.r.find((q) => q.id === 'eq:weapon'); if (eq) { P.clickId(S, Uc.r, 'eq:weapon'); act('forge do', () => P.clickId(S, UI.craft(h.bag.length, S.bagTab).r, 'do')); } }
