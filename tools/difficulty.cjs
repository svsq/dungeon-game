// node tools/difficulty.cjs [--seeds 1-40] [--profiles novice,average,expert] [--runs 1] [--diff easy|normal|hard] [-j 8] [--check]
// the playtest bot over many seeds and player profiles, in parallel; one row per profile and run number (run 2+ has the meta
// ranks bought with the earlier runs' shards): wins, where runs die, how close they come, what they spend. --check exits 2 when
// the first run misses the target bands (BANDS): the yardstick every balance change is held against
const { execFile } = require('child_process'), os = require('os'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const [s0, s1] = arg('--seeds', '1-40').split('-').map(Number), runs = +arg('--runs', 1), diff = arg('--diff', 'normal'), jobs = +arg('-j', os.cpus().length);
const profiles = arg('--profiles', 'novice,average,expert').split(','), FLOORS = require('../live/data.js').FLOORS;
const todo = []; for (const p of profiles) for (let s = s0; s <= (s1 || s0); s++) todo.push([p, s]);
const res = {}; let left = todo.length;
const avg = (a, f) => a.reduce((n, r) => n + f(r), 0) / (a.length || 1);
function report() {
  const head = ['profile', 'run', 'n', 'wins', 'stuck', 'deaths by floor ' + Array.from({ length: FLOORS }, (_, i) => i + 1).join(' '), 'minhp', 'hurt', 'dodges', 'hp pot', 'mp pot', 'minmp', 'time', 'lvl after floor ' + Array.from({ length: FLOORS }, (_, i) => i + 1).join(' ')];
  console.log(head.join(' | '));
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue;
    const by = Array(FLOORS).fill(0); for (const r of a) if (r.result.how === 'dead') by[r.result.floor - 1]++;
    const pc = (x) => Math.round(x * 100) + '%';
    console.log([p, k + 1, a.length, pc(avg(a, (r) => r.result.how === 'win')), a.filter((r) => r.result.how === 'stuck' || r.result.how === 'timeout').length,
      by.join(' '), pc(avg(a, (r) => r.minhp)), avg(a, (r) => r.hurt).toFixed(0), avg(a, (r) => r.dodges).toFixed(0), avg(a, (r) => r.hp_potion).toFixed(1),
      avg(a, (r) => r.mp_potion).toFixed(1), pc(avg(a, (r) => r.minmp)), Math.round(avg(a, (r) => r.floors.reduce((n, f) => n + f.time, 0)) / 60) + 'm',
      perFloor(a, (f) => f.lvl, 0)].join(' | ')); }
  // per floor, of the runs that reached it: potions drunk and what the damage came from
  console.log('\nprofile | run | min hp by floor | hits by floor | hp pot by floor | mp pot by floor | damage share ' + GROUPS.join(' / ') + ' | top source by floor');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue;
    const tot = {}; for (const r of a) for (const f of r.floors) for (const g in f.dmg || {}) tot[g] = (tot[g] || 0) + f.dmg[g];
    const sum = Object.values(tot).reduce((n, v) => n + v, 0) || 1;
    const top = Array.from({ length: FLOORS }, (_, i) => { const t = {}; for (const r of a) { const f = r.floors.find((q) => q.floor === i + 1); for (const g in (f && f.dmg) || {}) t[g] = (t[g] || 0) + f.dmg[g]; }
      const g = Object.keys(t).sort((x, y) => t[y] - t[x])[0]; return g || '-'; }).join(' ');
    console.log([p, k + 1, perFloor(a, (f) => Math.round((f.minhp ?? 1) * 100), 0), perFloor(a, (f) => f.hits || 0, 0), perFloor(a, (f) => f.hpPot || 0, 1), perFloor(a, (f) => f.mpPot || 0, 1), GROUPS.map((g) => Math.round((tot[g] || 0) / sum * 100) + '%').join(' / '), top].join(' | ')); }
  // the shard economy: found in the run, the end-of-run bonus, gifts taken at altars, floors' categories at 100%, potions left in the bag
  console.log('\nprofile | run | shards found | end reward | gifts | full categories by floor | secrets found by floor | hp pot left');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue;
    console.log([p, k + 1, avg(a, (r) => r.result.found || 0).toFixed(1), avg(a, (r) => (r.result.base || 0) + (r.result.statBonus || 0)).toFixed(1), avg(a, (r) => r.gifts).toFixed(1),
      perFloor(a, (f) => f.full || 0, 1), perFloor(a, (f) => (f.secN ? f.sec / f.secN : 1) * 100, 0), avg(a, (r) => r.potLeft || 0).toFixed(1) + ' (found ' + avg(a, (r) => r.potFound || 0).toFixed(1) + ', bought ' + avg(a, (r) => r.potBought || 0).toFixed(1) + ')'].join(' | ')); }
  // at each altar: the bank on arrival, the tier-2 gift's price, the share of visits that could pay for it
  console.log('\nprofile | run | altar floor: bank / tier-2 price / can pay');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue;
    const fl = [...new Set(a.flatMap((r) => (r.altars || []).map((q) => q.f)))].sort((x, y) => x - y);
    console.log([p, k + 1, fl.map((f) => { const l = a.flatMap((r) => (r.altars || []).filter((q) => q.f === f));
      return `f${f}: ${avg(l, (q) => q.bank).toFixed(0)} / ${avg(l, (q) => q.c2).toFixed(0)} / ${Math.round(avg(l, (q) => q.bank >= q.c2) * 100)}%`; }).join('  ')].join(' | ')); }
  // the boss fight, for the runs that reached the boss
  console.log('\nprofile | run | boss: reached / died / fight s (median) / health lost / hp potions');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue; const b = bossOf(a);
    if (b.n) console.log([p, k + 1, `${b.n} / ${Math.round(b.died * 100)}% / ${b.t.toFixed(0)} / ${Math.round(b.dmg * 100)}% / ${b.pot.toFixed(1)}`].join(' | ')); }
}
const bossOf = (a) => { const l = a.map((r) => (r.floors.find((f) => f.floor === FLOORS) || {}).boss).filter(Boolean), ts = l.map((b) => b.t).sort((x, y) => x - y);
  return { n: l.length, died: a.filter((r) => r.result.how === 'dead' && r.result.floor === FLOORS && (r.floors.find((f) => f.floor === FLOORS) || {}).boss).length / (l.length || 1),
    t: ts[ts.length >> 1] || 0, dmg: avg(l, (b) => b.dmg), pot: avg(l, (b) => b.pot) }; };
const GROUPS = ['mob', 'elite', 'bolt', 'trap', 'dot'];
// on normal the yardstick is pressure, not losses (the player's call): the average player drinks a potion or two a floor and drops
// to a quarter or so of the health on every floor, and no single floor is where the runs end
// (the 2nd floor may be lighter than the 1st: the 1st does not always give decent gear, the player's call — its potion floor is lower)
const BANDS = {
  easy: { average: { win: [0.85, 1] } },
  normal: { average: { win: [0.4, 0.6], minhp: [25, 45], hpPot: [0.8, 2], floor: { 2: { hpPot: [0.4, 2] } }, deathShare: 0.25, bossLost: [1.5, 3], bossPot: [1, 2], bossT: [20, 30] }, expert: { win: [0, 0.85] } },
  hard: { average: { win: [0.1, 0.25] }, expert: { win: [0.4, 0.6] } } };
function check() {
  const miss = [], B = BANDS[diff] || {}, inB = (v, [a, b]) => v >= a - 1e-9 && v <= b + 1e-9;
  for (const p in B) { const a = (res[p] || []).map((x) => x[0]).filter(Boolean), b = B[p]; if (!a.length) continue;
    const win = avg(a, (r) => r.result.how === 'win'); if (b.win && !inB(win, b.win)) miss.push(`${p}: wins ${Math.round(win * 100)}% outside ${b.win.map((v) => v * 100).join('–')}%`);
    for (let i = 0; i < FLOORS; i++) { const l = a.map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean); if (!l.length) continue;
      const mh = avg(l, (f) => (f.minhp ?? 1) * 100), hp = avg(l, (f) => f.hpPot || 0), bf = Object.assign({}, b, (b.floor || {})[i + 1]);
      if (bf.minhp && !inB(mh, bf.minhp)) miss.push(`${p} f${i + 1}: min hp ${Math.round(mh)}% outside ${bf.minhp.join('–')}%`);
      if (bf.hpPot && !inB(hp, bf.hpPot)) miss.push(`${p} f${i + 1}: ${hp.toFixed(1)} hp potions outside ${bf.hpPot.join('–')}`); }
    // deaths at the boss swing 2–10% between runs of 80 seeds (the bot comes with potions to spare): the band is on what it costs
    const bo = bossOf(a); if (b.bossLost && bo.n && !inB(bo.dmg, b.bossLost)) miss.push(`${p}: the boss takes ${Math.round(bo.dmg * 100)}% of the health, outside ${b.bossLost.map((v) => v * 100).join('–')}%`);
    if (b.bossPot && bo.n && !inB(bo.pot, b.bossPot)) miss.push(`${p}: ${bo.pot.toFixed(1)} hp potions at the boss, outside ${b.bossPot.join('–')}`);
    if (b.bossT && bo.n && !inB(bo.t, b.bossT)) miss.push(`${p}: the boss fight lasts ${bo.t.toFixed(0)} s, outside ${b.bossT.join('–')} s`);
    const dead = a.filter((r) => r.result.how === 'dead'), by = Array(FLOORS).fill(0); for (const r of dead) by[r.result.floor - 1]++;
    if (b.deathShare && dead.length >= 8) by.forEach((n, i) => { if (n / dead.length > b.deathShare) miss.push(`${p}: ${n} of ${dead.length} deaths on floor ${i + 1}, over ${b.deathShare * 100}%`); }); }
  console.log('\ncheck (' + diff + ', run 1): ' + (miss.length ? miss.length + ' miss(es)\n  ' + miss.join('\n  ') : 'every band met'));
  if (miss.length) process.exitCode = 2;
}
const perFloor = (a, fn, dp) => Array.from({ length: FLOORS }, (_, i) => { const l = a.map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean); return l.length ? avg(l, fn).toFixed(dp) : '-'; }).join(' ');
function next() {
  const job = todo.shift(); if (!job) return; const [p, s] = job;
  execFile('node', [path.join(__dirname, 'playtest.cjs'), String(s), '--profile', p, '--runs', String(runs), '--diff', diff, '--json'], { maxBuffer: 1 << 26 }, (err, out) => {
    if (err) console.error(`seed ${s} ${p}: ${err.message.split('\n')[0]}`);
    else (res[p] = res[p] || []).push(out.trim().split('\n').map((l) => JSON.parse(l)));
    if (--left === 0) { report(); if (process.argv.includes('--check')) check(); } else next(); });
}
for (let i = 0; i < jobs; i++) next();
