// r8: the town as a run's hub, played through SIM.step with real input. Visit 1: a new hero, the Keeper, the board (every offer taken by a click
// on its button), the journal, a descent. Visit 2: back with what a run brings (floors seen, bosses, quests done, gold and shards, the captives
// freed): the turn-ins, the shop, the forge, the enchanter, the altar, the chest. Counts the seconds and the presses each costs.
//   node tools/measure/game/town_loop.cjs [seed]
const P = require('./play.cjs'), { X, D, UI } = P;
const seed = +(process.argv[2] || 1), S = P.start(seed), R = S.run, h = R.hero, T0 = () => S.t;
const rep = (s) => console.log(s);
const say = (S) => S.talk && S.talk.pages.map((p) => p.replace(/\*\*/g, '')).join(' / ');
rep('== visit 1: seed ' + seed + ', a new hero');
const g = P.greet(S); rep(`greet: the Keeper walks up at ${g.at} s and talks (the hero held that long); story quest taken at once: ${JSON.stringify((R.quests || []).map((q) => q.key))}`);
// the board
let t = T0(); const w = P.goSvc(S, 'board'); rep(`walk to the board ${w.ok ? (S.t - t).toFixed(1) + ' s' : w.why}`); P.tap(S, 'KeyE'); rep('board opens: ' + S.screen);
const rows = S.bdRows || []; rep('board rows: ' + rows.map((r) => `${r.role}:${r.q.key}@${r.q.f}`).join(', '));
const Ub = UI.board(rows.length); for (let i = 0; i < rows.length; i++) { P.clickId(S, Ub.r, 'take:' + i); }
rep('after clicking every Take: quests ' + (R.quests || []).map((q) => q.key + '@' + q.f + ':' + q.st).join(', ') + '; msg: ' + (R.msg && R.msg.s)); P.tap(S, 'KeyE'); rep('board closed: ' + S.screen);
P.tap(S, 'KeyJ'); rep('J: ' + S.screen + ', journal rows ' + X.journalOf(R).length); P.tap(S, 'KeyJ');
// talk to every townsman who has an offer mark
for (const role of ['guard', 'porter', 'sweeper', 'child', 'mason', 'keeper']) { const f = P.folk(S, role); if (!f) { rep(role + ': not in the town'); continue; }
  const mk = X.questMark ? X.questMark(R, role) : ''; t = T0(); const ok = P.goXY(S, f.x + (role === 'mason' ? 0 : 0), f.y + 30, 30);
  P.tap(S, 'KeyE'); rep(`${role}: mark '${mk}', walk ${ok.ok ? (S.t - t).toFixed(1) + ' s' : ok.why}, E -> ${S.screen}${S.talk ? ' ' + (say(S) || '').slice(0, 110) : ''}`);
  for (let i = 0; i < 8 && S.screen !== 'play'; i++) P.tap(S, S.screen === 'talk' ? 'KeyE' : 'Escape'); }
rep('== visit 2: after a run (floors 1-6 seen, boss slain, captives freed, quests done)');
R.freed = { merchant: 1, smith: 1, enchanter: 1 }; R.deepest = 6; R.bossN = 1; R.lastBoss = 'goblin'; h.gold = 2400; S.meta.shards = 55; h.lvl = 7; R.away = 6; R.townDeep = 6; S.meta.runs = 1;
for (const q of R.quests || []) { q.n = q.need; q.st = 'done'; }
let done = 0; for (const q of R.quests || []) if (q.st === 'done') done++; rep('quests done and waiting: ' + done);
const stash = (txt) => rep(txt);
for (const role of ['keeper', 'guard', 'porter', 'sweeper', 'child']) { const f = P.folk(S, role); if (!f) continue; const mk = X.questMark(R, role); if (mk !== '?') continue; t = T0(); const ok = P.goXY(S, f.x, f.y + 30, 30); P.tap(S, 'KeyE');
  let n = 1; const first = say(S), np0 = S.talk ? S.talk.pages.length : 0, acts = []; while (S.screen === 'talk' && n < 60) { if (S.talk.act) acts.push(S.talk.act.k + '@p' + (S.talk.p + 1) + '/' + S.talk.pages.length); const T = S.talk; P.tap(S, T.act && T.act.k === 'take' && T.p + 1 >= T.pages.length ? 'Escape' : 'KeyE'); n++; }
  rep(`${role}: turn-in ${ok.ok ? (S.t - t).toFixed(1) + ' s' : ok.why}, ${n} presses (first batch ${np0} pages, acts ${[...new Set(acts)].join(',')}), gold ${h.gold}, shards ${S.meta.shards}, xp ${h.xp}; said: ${(first || '').slice(0, 90)}`); }
for (const k of ['shop', 'anvil', 'lectern', 'altar', 'stash']) { t = T0(); const r = P.goSvc(S, k, k === 'shop' ? 4 : 36); P.tap(S, 'KeyE'); rep(`${k}: walk ${r.ok ? (S.t - t).toFixed(1) + ' s' : r.why} -> ${S.screen}${S.talk ? ' talk:' + S.talk.role + ' ' + (say(S) || '').slice(0, 80) : ''}`);
  for (let i = 0; i < 6 && S.screen !== 'play'; i++) P.tap(S, S.screen === 'talk' ? 'KeyE' : 'Escape'); }
rep(`end t=${S.t.toFixed(0)} s, gold ${h.gold}, shards ${S.meta.shards}`);
