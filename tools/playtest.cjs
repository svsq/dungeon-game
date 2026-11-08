// node tools/playtest.cjs [seed] [--profile novice|average|expert|mage|builder] [--runs N] [--diff easy|normal|hard] [--mode campaign|town|cave|magma] [--no-town: in a run through the town, straight down, no shop, quests or trips home] [--json] [--descend: past the serpent, on down into the endless descent] [--stop-after N] [--snapshots dir] [--snap-floors 9,13] [--checkpoint file] [--rebuild: the checkpoint's floor built again by this version]
// the bot (tools/bot.cjs) plays N campaigns in a row with meta ranks bought in between; prints each floor and each run's end.
// A floor it cannot finish in 400 s, or 120 s with no progress on it, ends as "stuck" (why: floor / idle): a bot defect, never a balance result.
const { play } = require('./bot.cjs'), fs = require('fs'), path = require('path'), v8 = require('v8');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const seed = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 1), json = process.argv.includes('--json');
const pct = (x) => Math.round(x * 100) + '%';
const snapshots = arg('snapshots', ''), source = arg('checkpoint', ''), dump = arg('dump-state', '');
if (snapshots) fs.mkdirSync(snapshots, { recursive: true });
const only = arg('snap-floors', '') ? arg('snap-floors', '').split(',').map(Number) : null;
play({ seed, initial: source ? v8.deserialize(fs.readFileSync(source)) : null, rebuild: process.argv.includes('--rebuild'), checkpoint: snapshots ? (frame) => { if (only && !only.includes(frame.S.run.floor)) return;
  fs.writeFileSync(path.join(snapshots, `${frame.diff}_${frame.profile}_${seed}_f${frame.S.run.floor}.bin`), v8.serialize(frame));
} : null, profile: arg('profile', 'average'), descend: process.argv.includes('--descend'), stopAfter: +arg('stop-after', 0), hours: +arg('hours', 1), runs: +arg('runs', 1), diff: arg('diff', 'normal'), mode: arg('mode', 'campaign'), noTown: process.argv.includes('--no-town'), log: (r, S) => {
  if (dump) fs.writeFileSync(dump, v8.serialize(S));
  if (json) return console.log(JSON.stringify(r));
  for (const f of r.floors) console.log(`floor ${f.floor}: ${f.time}s lvl ${f.lvl} hp ${f.hp} kills ${f.kills} gold ${f.gold} loot ${f.loot}/${f.lootN} shards ${f.shards} bank ${f.bank} dodge ${f.dodge}%`);
  const R = r.result, meta = Object.entries(r.meta).map(([k, v]) => k + v).join(' ') || '-';
  console.log(`end ${R.how} f${R.floor}${R.time ? ' ' + Math.round(R.time) + 's' : ''} lvl ${R.lvl || '-'} shards ${R.shards ?? '-'} meta ${meta}${R.why ? ` (${R.why} at ${R.at} goal ${R.goal})` : ''}`);
  if (r.town && (r.town.visits || r.town.taken)) console.log(`  town: trips home ${r.town.visits}, scrolls read ${r.town.scrolls}, quests taken ${r.town.taken}, turned in ${r.town.turned}`);
  console.log(`  minhp ${pct(r.minhp)} minmp ${pct(r.minmp)} hurt ${r.hurt} dodges ${r.dodges} potions hp ${r.hp_potion} mp ${r.mp_potion}` +
    ` whirl ${r.whirl} fireball ${r.cast} shield ${r.shield} gifts ${r.gifts} sold ${r.sold} spent ${r.spent} gear ${r.ups}`);
} });
