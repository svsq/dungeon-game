// r8: of the offers a run draws at its start (R.offers), which ones the board shows on the first visit and which wait behind a caged giver or the Keeper's story
//   node tools/measure/game/town_offers_hidden.cjs [from-to]
const P = require('./play.cjs'), { X } = P, [a, b = a] = (process.argv[2] || '1-12').split('-').map(Number); let shown = 0, drawn = 0, one = 0, none = 0;
for (let seed = a; seed <= b; seed++) { const S = P.start(seed), R = S.run, vis = X.boardOffers(R).filter(({ role }) => role !== 'keeper').map(({ role }) => role), raw = R.offers.map((o) => o.from + ':' + o.key);
  const hid = R.offers.filter((o) => !vis.includes(o.from)); drawn += R.offers.length; shown += vis.length; if (vis.length === 1) one++; if (!vis.length) none++;
  console.log(`seed ${String(seed).padStart(2)} drawn ${R.offers.length} (${raw.join(' ')}), board shows ${vis.length} (${vis.join(' ')}); hidden: ${hid.map((o) => o.from + ':' + o.key).join(' ') || '-'}`); }
console.log(`drawn ${drawn}, shown on the first visit ${shown}, boards with one optional quest ${one}, with none ${none} of ${b - a + 1}`);
