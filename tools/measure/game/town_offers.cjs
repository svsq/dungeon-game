// r8: what a run's board and townsfolk offer at the start, per seed, and after each boss (a batch more): giver, quest, floor, reward
//   node tools/measure/game/town_offers.cjs [from-to]
const P = require('./play.cjs'), { X, D } = P, [a, b = a] = (process.argv[2] || '1-12').split('-').map(Number);
const tally = {};
for (let seed = a; seed <= b; seed++) { const S = P.start(seed), R = S.run;
  const row = (R) => X.boardOffers(R).map(({ role, of }) => `${role}:${of.q.key}@${of.q.f}`).join(' ');
  const first = row(R); R.bossN = 1; X.dealOffers ? 0 : 0; const mk = D.QUEST_GIVE;
  console.log(`seed ${String(seed).padStart(2)} offers(${X.boardOffers(R).length}): ${first}`);
  for (const o of R.offers) tally[o.key] = (tally[o.key] || 0) + 1; }
console.log('kinds over the seeds', JSON.stringify(tally));
