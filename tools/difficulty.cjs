// node tools/difficulty.cjs [--seeds 1-40] [--profiles novice,average,expert,builder] [--runs 1] [--diff easy|normal|hard] [-j 8] [--quiet] [--check]
// the playtest bot over many seeds and player profiles, in parallel; one row per profile and run number (run 2+ has the meta
// ranks bought with the earlier runs' shards): wins, where runs die, how close they come, what they spend. --check exits 2 when
// the first run misses the target bands (BANDS): the yardstick every balance change is held against; with --runs 3 it also holds
// the third run, bought meta and all, to its band. By default it takes half the cores; --quiet (for the night) runs 2 bots at the lowest
// priority, on macOS in the background QoS class (the efficiency cores): slower, but the laptop's fans stay quiet
const { execFile } = require('child_process'), os = require('os'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const [s0, s1] = arg('--seeds', '1-40').split('-').map(Number), runs = +arg('--runs', 1), diff = arg('--diff', 'normal'), quiet = process.argv.includes('--quiet'), jobs = +arg('-j', quiet ? 2 : Math.max(1, Math.floor(os.cpus().length / 2)));
const fs = require('fs');
const profiles = arg('--profiles', 'novice,average,expert').split(','), FLOORS = require('../live/data.js').FLOORS;
const res = {}, failed = [];
const resume = arg('--resume', ''), replayFloor = +arg('--replay-floor', 0);
if (resume) for (const [p, rows] of Object.entries(JSON.parse(fs.readFileSync(resume, 'utf8')))) {
  res[p] = rows.filter((r) => r.length === runs && r.every((x) => x.seed === r[0].seed && ['win', 'dead'].includes(x.result?.how))
    && r[0].seed >= s0 && r[0].seed <= (s1 || s0) && (!replayFloor || r[0].result.floor < replayFloor));
}
const todo = []; for (const p of profiles) for (let s = s0; s <= (s1 || s0); s++) {
  if (!(res[p] || []).some((r) => r[0].seed === s && r.length >= runs)) todo.push([p, s]);
}
let left = todo.length;
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
  console.log('\nprofile | run | floor / boss: reached / died / fight s (median) / health lost / hp potions');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue; for (const f of [2, 4, 6, FLOORS]) { const b = bossOf(a, f);
    if (b.n) console.log([p, k + 1, f, `${b.n} / ${Math.round(b.died * 100)}% / ${b.t.toFixed(0)} / ${Math.round(b.dmg * 100)}% / ${b.pot.toFixed(1)}`].join(' | ')); } }
  // how big one blow is before the shield, as a share of the max health; levels gained on each floor
  console.log('\nprofile | run | blow % of max hp by floor: mob p50 | heavy p50 | mob p90 | elite p90 | levels gained by floor');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue;
    const by = (g, q) => Array.from({ length: FLOORS }, (_, i) => { const v = blowAt(a, i, g, q); return v === null ? '-' : v.toFixed(0); }).join(' ');
    console.log([p, k + 1, by('mob', 0.5), by('heavy', 0.5), by('mob', 0.9), by('elite', 0.9), Array.from({ length: FLOORS }, (_, i) => { const v = lvlUp(a, i); return v === null ? '-' : v.toFixed(1); }).join(' ')].join(' | ')); }
}
// the q-th share of the blows of a source group on floor i + 1 over all runs, in % of the max health
const blowAt = (a, i, g, q) => { const l = a.flatMap((r) => ((r.floors.find((f) => f.floor === i + 1) || {}).blows || {})[g] || []).sort((x, y) => x - y);
  return l.length >= 20 ? l[Math.min(l.length - 1, Math.floor(l.length * q))] * 100 : null; };
// levels gained on floor i + 1 by the runs that finished it (the hero starts at level 1)
const lvlUp = (a, i) => { const l = a.map((r) => { const f = r.floors.find((q) => q.floor === i + 1), pr = i ? r.floors.find((q) => q.floor === i) : { lvl: 1 }; return f && pr ? f.lvl - pr.lvl : null; }).filter((v) => v !== null);
  return l.length ? avg(l, (v) => v) : null; };
// the fight's length is the winners' (a death cuts a fight short); deaths carry a 95 % Wilson interval: a band met by a point is
// only as sure as the sample (TASKS 227)
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, c = (p + z * z / (2 * n)) / (1 + z * z / n), w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n); return [c - w, c + w]; };
const ci = (k, n) => wilson(k, n).map((v) => (v * 100).toFixed(1)).join('–') + '%';
const bossOf = (a, floor = FLOORS) => { const l = a.map((r) => (r.floors.find((f) => f.floor === floor) || {}).boss).filter(Boolean), ts = l.filter((b) => !b.died).map((b) => b.t).sort((x, y) => x - y);
  return { n: l.length, k: l.filter((b) => b.died).length, died: avg(l, (b) => b.died || 0),
    t: ts[ts.length >> 1] || 0, dmg: avg(l, (b) => b.dmg), pot: avg(l, (b) => b.pot) }; };
const GROUPS = ['mob', 'elite', 'bolt', 'trap', 'dot'];
// builder: a player who gathers fire and crit and burns the bosses with fireballs still fights each for 15 s or more (TASKS 245)
const BUILDER = { bossT: [15, Infinity], chapters: { 2: { t: [15, Infinity] }, 4: { t: [15, Infinity] }, 6: { t: [15, Infinity] } } };
// on normal the yardstick is pressure, not losses (the player's call): the average player drinks a potion or two a floor and drops
// to a quarter or so of the health on every floor, and no single floor is where the runs end
// (the 2nd floor may be lighter than the 1st: the 1st does not always give decent gear, the player's call — its potion floor is lower; the 7th's blows come rarer and bigger, so its lowest health sits higher;
// pressure, like the finale's deaths, is judged on 160 seeds: on 80 a floor's potions swing ±0.4 (the player's call in TASKS 227);
// the 8th is judged by the finale's own bands and its survivors' lowest health (winMinhp), not by the floor's potions and lowest
// health with the dead as 0: a finale that kills 10–20 % costs about 2.4 potions and leaves the survivors at 22–25 %, and the finale
// itself may cost up to 2.5 potions (the player's calls in TASKS 227); the survivors' floor is 18 %, not 22: both are set by the
// one fight (the average drinks below 40 %, the finale's blow reaches the 50 % cap), and no finale kept both bands a standard
// error inside, a blow of 27 killed 9 % with the survivors at 23 % (the player's call in TASKS 246)
// mobBlow: a plain monster's blow (median, % of the max health, before the shield); heavyBlow: the same for the plain demon, a slow
// telegraphed heavy hitter by design (the player's call); lvlUp: levels a floor gives, so none drags or rushes; meta: the third run in a row with the meta bought from the first two, so the meta does not win the game (TASKS 202, 225)
const BANDS = {
  easy: { average: { win: [0.85, 1] } },
  normal: { average: { win: [0.4, 0.6], minhp: [25, 45], hpPot: [0.8, 2], floor: { 2: { hpPot: [0.4, 2] }, 7: { minhp: [25, 50] }, 8: { minhp: null, hpPot: null, winMinhp: [18, 45] } }, deathShare: 0.25, bossDied: [0.1, 0.2], pressure: true, chapters: { 2: { died: [0, 0.05], t: [15, 20] }, 4: { died: [0, 0.05] }, 6: { died: [0, 0.05] } }, bossLost: [1.5, 3], bossPot: [1, 2.5], bossT: [20, 30],
    mobBlow: [6, 10], heavyBlow: [15, 25], lvlUp: [0.8, 2.2], meta: { run: 3, win: [0, 0.65] } }, expert: { win: [0, 0.85] }, builder: BUILDER },
  hard: { average: { win: [0.1, 0.25] }, expert: { win: [0.4, 0.6] }, builder: BUILDER } };
function check() {
  const miss = failed.map((s) => `missing result: ${s}`), B = BANDS[diff] || {}, inB = (v, [a, b]) => v >= a - 1e-9 && v <= b + 1e-9;
  // one fresh version only: results saved from another version or resumed from a checkpoint never pass (TASKS 240)
  const { VERSION } = require('./bot.cjs'), all = Object.values(res).flat(2);
  const stale = all.filter((r) => r.ver !== VERSION).length, resumed = all.filter((r) => r.resumed).length;
  if (stale) miss.push(`${stale} result(s) played on another version of the game or the bot (now ${VERSION})`);
  if (resumed) miss.push(`${resumed} result(s) resumed from a checkpoint: --check needs fresh runs`);
  for (const p of profiles) {
    const rows = res[p] || [], seen = new Set();
    for (const row of rows) {
      const seed = row[0]?.seed;
      if (!Number.isInteger(seed) || seed < s0 || seed > (s1 || s0) || seen.has(seed)) miss.push(`${p}: invalid or duplicate seed ${seed}`);
      seen.add(seed);
      if (row.length !== runs) miss.push(`${p} seed ${seed}: ${row.length} runs, expected ${runs}`);
      for (let k = 0; k < runs; k++) {
        const r = row[k];
        if (!r || r.seed !== seed || !['win', 'dead'].includes(r.result?.how)) miss.push(`${p} seed ${seed} run ${k + 1}: incomplete result (${r?.result?.how || 'missing'})`);
      }
    }
    for (let seed = s0; seed <= (s1 || s0); seed++) if (!seen.has(seed)) miss.push(`${p}: missing seed ${seed}`);
  }
  for (const p in B) { const a = (res[p] || []).map((x) => x[0]).filter(Boolean), b = B[p]; if (!profiles.includes(p)) continue;
    if (a.length !== (s1 || s0) - s0 + 1) miss.push(`${p}: ${a.length} results, expected ${(s1 || s0) - s0 + 1}`); if (!a.length) continue;
    const win = avg(a, (r) => r.result.how === 'win'); if (b.win && !inB(win, b.win)) miss.push(`${p}: wins ${Math.round(win * 100)}% outside ${b.win.map((v) => v * 100).join('–')}%`);
    for (let i = 0; i < FLOORS; i++) { const l = a.map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean); if (!l.length) continue;
      const mh = avg(l, (f) => (f.minhp ?? 1) * 100), hp = avg(l, (f) => f.hpPot || 0), bf = Object.assign({}, b, (b.floor || {})[i + 1]);
      if (bf.minhp && !inB(mh, bf.minhp)) miss.push(`${p} f${i + 1}: min hp ${Math.round(mh)}% outside ${bf.minhp.join('–')}%`);
      if (bf.winMinhp) { const w = a.filter((r) => r.result.how === 'win').map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean), v = w.length ? avg(w, (f) => (f.minhp ?? 1) * 100) : null;
        if (v !== null && !inB(v, bf.winMinhp)) miss.push(`${p} f${i + 1}: survivors' min hp ${v.toFixed(1)}% outside ${bf.winMinhp.join('–')}%`); }
      if (bf.hpPot && !inB(hp, bf.hpPot)) miss.push(`${p} f${i + 1}: ${hp.toFixed(1)} hp potions outside ${bf.hpPot.join('–')}`);
      for (const [g, k, who] of [['mob', 'mobBlow', 'a plain monster'], ['heavy', 'heavyBlow', 'a plain demon']]) { const v = blowAt(a, i, g, 0.5);
        if (bf[k] && v !== null && !inB(v, bf[k])) miss.push(`${p} f${i + 1}: ${who}'s blow ${v.toFixed(1)}% of the health, outside ${bf[k].join('–')}%`); }
      const lu = lvlUp(a, i); if (bf.lvlUp && lu !== null && !inB(lu, bf.lvlUp)) miss.push(`${p} f${i + 1}: ${lu.toFixed(1)} levels gained, outside ${bf.lvlUp.join('–')}`); }
    const bo = bossOf(a); if (b.bossLost && bo.n && !inB(bo.dmg, b.bossLost)) miss.push(`${p}: the boss takes ${Math.round(bo.dmg * 100)}% of the health, outside ${b.bossLost.map((v) => v * 100).join('–')}%`);
    if (b.bossPot && bo.n && !inB(bo.pot, b.bossPot)) miss.push(`${p}: ${bo.pot.toFixed(1)} hp potions at the boss, outside ${b.bossPot.join('–')}`);
    if (b.bossT && bo.n && !inB(bo.t, b.bossT)) miss.push(`${p}: the boss fight lasts ${bo.t.toFixed(0)} s, outside ${b.bossT.join('–')} s`);
    if (b.bossDied && a.length < 160) console.log(`${p}: boss death band needs 160 seeds (${a.length} measured)`);
    if (b.bossDied && bo.n) console.log(`${p}: boss deaths ${bo.k}/${bo.n} = ${(bo.died * 100).toFixed(1)}% (95% CI ${ci(bo.k, bo.n)})`);
    if (b.bossDied && a.length >= 160 && !inB(bo.died, b.bossDied)) miss.push(`${p}: boss deaths ${(bo.died * 100).toFixed(1)}%, outside ${b.bossDied.map((v) => v * 100).join('–')}%`);
    for (const f in b.chapters || {}) { const c = bossOf(a, +f), band = b.chapters[f]; if (!c.n) continue;
      if (band.died && !inB(c.died, band.died)) miss.push(`${p} f${f}: boss deaths ${(c.died * 100).toFixed(1)}%, outside ${band.died.map((v) => v * 100).join('–')}%`);
      if (band.t && !inB(c.t, band.t)) miss.push(`${p} f${f}: boss fight ${c.t.toFixed(1)} s, outside ${band.t.join('–')} s`);
    }
    if (b.pressure && a.length < 160) console.log(`${p}: pressure curve needs 160 seeds (${a.length} measured)`);
    if (b.pressure && a.length >= 160) for (let f = 4; f <= FLOORS; f++) { const at = (floor, fn) => { const l = a.flatMap((r) => r.floors.filter((q) => q.floor === floor)); return avg(l, fn); },
      dmg = at(f, (q) => q.dmgHp || 0), prev = at(f - 1, (q) => q.dmgHp || 0), pot = at(f, (q) => q.hpPot || 0), pot0 = at(f - 1, (q) => q.hpPot || 0);
      if (dmg < prev) miss.push(`${p} f${f}: floor damage ${dmg.toFixed(2)} max HP, below f${f - 1} ${prev.toFixed(2)}`);
      if (pot < pot0 - 0.3 - 1e-9) miss.push(`${p} f${f}: potion use falls ${ (pot0 - pot).toFixed(2)}, over 0.3`);
    }
    const dead = a.filter((r) => r.result.how === 'dead'), by = Array(FLOORS).fill(0); for (const r of dead) by[r.result.floor - 1]++;
    if (b.deathShare && dead.length >= 8) by.forEach((n, i) => { if (n / dead.length > b.deathShare) miss.push(`${p}: ${n} of ${dead.length} deaths on floor ${i + 1}, over ${b.deathShare * 100}%`); });
    const am = b.meta && runs >= b.meta.run ? (res[p] || []).map((x) => x[b.meta.run - 1]).filter(Boolean) : [];
    if (am.length) { const w = avg(am, (r) => r.result.how === 'win'); if (!inB(w, b.meta.win)) miss.push(`${p}: run ${b.meta.run} with meta wins ${Math.round(w * 100)}%, outside ${b.meta.win.map((v) => v * 100).join('–')}%`); } }
  console.log('\ncheck (' + diff + (runs >= 3 ? ', runs 1 and 3' : ', run 1') + '): ' + (miss.length ? miss.length + ' miss(es)\n  ' + miss.join('\n  ') : 'every band met'));
  if (miss.length) process.exitCode = 2;
}
const perFloor = (a, fn, dp) => Array.from({ length: FLOORS }, (_, i) => { const l = a.map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean); return l.length ? avg(l, fn).toFixed(dp) : '-'; }).join(' ');
function next() {
  const job = todo.shift(); if (!job) return; const [p, s] = job;
  const cmd = ['node', path.join(__dirname, 'playtest.cjs'), String(s), '--profile', p, '--runs', String(runs), '--diff', diff, '--json'];
  const snapshots = arg('--snapshots', ''), floor = arg('--replay-floor', '');
  const dump = arg('--dump-state', ''); if (dump) cmd.push('--dump-state', dump);
  if (snapshots) {
    cmd.push('--snapshots', snapshots);
    const file = path.join(snapshots, `${diff}_${p}_${s}_f${floor}.bin`);
    if (floor && fs.existsSync(file)) cmd.push('--checkpoint', file);
  }
  if (quiet && process.platform === 'darwin') cmd.unshift('taskpolicy', '-b');
  const child = execFile(cmd[0], cmd.slice(1), { maxBuffer: 1 << 26 }, (err, out) => {
    if (err) { failed.push(`${s} ${p}`); console.error(`seed ${s} ${p}: ${err.message.split('\n')[0]}\n${(err.stderr || '').split('\n').slice(0, 7).join('\n')}`); }
    else { res[p] = (res[p] || []).filter((r) => r[0].seed !== s); res[p].push(out.trim().split('\n').map((l) => JSON.parse(l))); }
    const dest = arg('--json-out', ''); if (dest) fs.writeFileSync(dest, JSON.stringify(res));
    if (--left === 0) { report(); if (process.argv.includes('--check')) check(); } else next(); });
  if (quiet) try { os.setPriority(child.pid, 19); } catch (e) { /* the bot just runs at normal priority */ }
}
const sources = arg('--from-json', '');
if (sources) {
  for (const file of sources.split(',')) for (const [p, rows] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))) {
    res[p] = (res[p] || []).concat(rows.filter((r) => r[0].seed >= s0 && r[0].seed <= (s1 || s0)));
  }
  report(); if (process.argv.includes('--check')) check();
} else if (!left) { report(); if (process.argv.includes('--check')) check(); }
else for (let i = 0; i < jobs; i++) next();
