// node tools/playtest.cjs [seed] [--profile novice|average|expert] [--runs N] [--diff easy|normal|hard] [--json]
// the bot (tools/bot.cjs) plays N campaigns in a row with meta ranks bought in between; prints each floor and each run's end.
// A floor it cannot finish in 400 s ends as "stuck": a bot defect, never a balance result.
const { play } = require('./bot.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const seed = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 1), json = process.argv.includes('--json');
const pct = (x) => Math.round(x * 100) + '%';
play({ seed, profile: arg('profile', 'average'), runs: +arg('runs', 1), diff: arg('diff', 'normal'), log: (r) => {
  if (json) return console.log(JSON.stringify(r));
  for (const f of r.floors) console.log(`floor ${f.floor}: ${f.time}s lvl ${f.lvl} hp ${f.hp} kills ${f.kills} gold ${f.gold} loot ${f.loot}/${f.lootN} shards ${f.shards} bank ${f.bank} dodge ${f.dodge}%`);
  const R = r.result, meta = Object.entries(r.meta).map(([k, v]) => k + v).join(' ') || '-';
  console.log(`end ${R.how} f${R.floor}${R.time ? ' ' + Math.round(R.time) + 's' : ''} lvl ${R.lvl || '-'} shards ${R.shards ?? '-'} meta ${meta}`);
  console.log(`  minhp ${pct(r.minhp)} minmp ${pct(r.minmp)} hurt ${r.hurt} dodges ${r.dodges} potions hp ${r.hp_potion} mp ${r.mp_potion}` +
    ` whirl ${r.whirl} fireball ${r.cast} shield ${r.shield} gifts ${r.gifts} sold ${r.sold} spent ${r.spent} gear ${r.ups}`);
} });
