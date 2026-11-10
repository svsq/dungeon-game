// node tools/difficulty.cjs [--seeds 1-40] [--no-cache] [--profiles novice,average,expert,builder] [--runs 1] [--diff easy|normal|hard] [--mode campaign|town|cave|magma|endless] [--cls warrior|mage: the hero's class (TASKS 1116)] [--no-town: a run through the town played straight down] [--floors 30: the endless descent's report window] [--descend: the campaign goes on past the serpent] [-j 8] [--quiet] [--check] [--full: no early stop] [--job-min M: a bot process killed as hung after M min] [--snapshots dir [--replay-floor 9]: the deep floors from the snapshots]
// the playtest bot over many seeds and player profiles, in parallel; one row per profile and run number (run 2+ has the meta
// ranks bought with the earlier runs' shards): wins, where runs die, how close they come, what they spend. --check exits 2 when
// the first run misses the target bands (BANDS): the yardstick every balance change is held against; with --runs 3 it also holds
// the third run, bought meta and all, to its band. By default it takes half the cores; --quiet (for the night) runs 3 bots at the lowest
// priority: slower, and the laptop's fans stay quieter
const { execFile, execFileSync } = require('child_process'), os = require('os'), path = require('path');
// --quiet: 3 bots at the lowest priority, free to use any core the rest of the machine leaves idle, the collector in each bot's own
// thread (TASKS 467): on the efficiency cores alone (macOS background QoS), with the collectors' threads crowding the same cores,
// a seed took ten times as long as in a normal run, 160 seeds well over an hour
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const [s0, s1] = arg('--seeds', '1-40').split('-').map(Number), runs = +arg('--runs', 1), diff = arg('--diff', 'normal'), quiet = process.argv.includes('--quiet'), jobs = +arg('-j', quiet ? 3 : Math.max(1, Math.floor(os.cpus().length / 2)));
const fs = require('fs');
const DATA = require('../live/data.js'), mode = arg('--mode', 'campaign'), RUN = DATA.runOf(mode), DESCEND = process.argv.includes('--descend'), FLOORS = Number.isFinite(RUN.floors) && !DESCEND ? RUN.floors : +arg('--floors', 30), STAGE = (f) => DATA.stageOf(mode, f), BOSS_FLOORS = Array.from({ length: FLOORS }, (_, i) => i + 1).filter((f) => STAGE(f).boss);
// past: of the runs, the share that got past floor f (won, or died deeper): the demon lord's 8th is the old campaign's finale (TASKS 339)
// the descent's bosses met in a run (TASKS 386): a boss again before all five came up is a repeat; in --descend only past the campaign
const bossRepeats = (r) => { let n = 0, round = new Set(); const all = new Set(Object.values(DATA.RUNS.endless.bosses));
  for (const f of r.floors) { if (!f.bt || (DESCEND && f.floor <= DATA.RUNS.campaign.floors)) continue; if (round.has(f.bt)) n++; round.add(f.bt); if (round.size === all.size) round = new Set(); }
  return n; };
const past = (a, f) => avg(a, (r) => r.result.how === 'win' || r.result.floor > f);
const profiles = arg('--profiles', 'novice,average,expert').split(',');
const res = {}, failed = [], hung = [];
// a bot process that has not finished in --job-min minutes is killed and listed as hung (TASKS 397): one hang held a whole run of
// seeds for good. Gauged from a 1-run campaign's half a minute, the quiet mode's slow cores and the descent's hours
const jobMin = +arg('--job-min', 15 * runs * (RUN.endless || DESCEND ? 4 * +arg('--hours', 1) : 1) * (quiet ? 4 : 1));
// the deep floors measured without the floors before them (TASKS 467): a run with --snapshots keeps each seed's state on its arrival
// at a chapter's first floor and its results beside them; --replay-floor F then plays every seed that got there from that state,
// the floor built again by this version, and takes the rest from the results. A share of those seeds is played whole as well: a
// floor before F that comes out otherwise means the snapshots are stale, and the run fails. For tuning only: --check refuses it
const snapDir = arg('--snapshots', ''), replayFloor = +arg('--replay-floor', 0), resume = arg('--resume', '') || (replayFloor && snapDir ? path.join(snapDir, 'results.json') : '');
const chapterFloors = () => Array.from({ length: FLOORS }, (_, i) => i + 1).filter((f) => f > 1 && STAGE(f).lf === 1);
if (resume) for (const [p, rows] of Object.entries(JSON.parse(fs.readFileSync(resume, 'utf8')))) {
  res[p] = rows.filter((r) => r.length === runs && r.every((x) => x.seed === r[0].seed && ['win', 'dead'].includes(x.result?.how))
    && r[0].seed >= s0 && r[0].seed <= (s1 || s0) && (!replayFloor || r[0].result.floor < replayFloor));
}
const todo = []; for (const p of profiles) for (let s = s0; s <= (s1 || s0); s++) {
  if (!(res[p] || []).some((r) => r[0].seed === s && r.length >= runs)) todo.push([p, s]);
}
let left;
const avg = (a, f) => a.reduce((n, r) => n + f(r), 0) / (a.length || 1);
function report() {
  const head = ['profile', 'run', 'n', 'wins', 'stuck', 'deaths by floor ' + Array.from({ length: FLOORS }, (_, i) => i + 1).join(' '), 'minhp', 'hurt', 'dodges', 'hp pot', 'mp pot', 'minmp', 'time', 'lvl after floor ' + Array.from({ length: FLOORS }, (_, i) => i + 1).join(' ')];
  console.log(head.join(' | '));
  const ends = RUN.endless ? [] : BOSS_FLOORS.filter((f) => STAGE(f).last && f < FLOORS);
  // the endless descent (TASKS 352): how deep the runs go — a run still alive when the bot's hour is up ends as 'timeout', not stuck
  if (RUN.endless || DESCEND) for (const p of profiles) { const a = (res[p] || []).map((x) => x[0]).filter(Boolean); if (!a.length) continue;
    const deep = a.map((r) => r.result.floor || 0).sort((x, y) => x - y), q = (k) => deep[Math.min(deep.length - 1, Math.floor(deep.length * k))];
    console.log(`${p}: depth reached median ${q(0.5)}, p10 ${q(0.1)}, p90 ${q(0.9)}, deepest ${deep[deep.length - 1]}; alive at the hour ${a.filter((r) => r.result.how === 'timeout').length}, stuck ${a.filter((r) => r.result.how === 'stuck').length}, boss repeats within a round ${a.reduce((n, r) => n + bossRepeats(r), 0)}\n`); }
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue;
    const by = Array(FLOORS).fill(0); for (const r of a) if (r.result.how === 'dead') by[Math.min(r.result.floor, FLOORS) - 1]++;   // deeper than the window: its last column
    const pc = (x) => Math.round(x * 100) + '%';
    console.log([p, k + 1, a.length, pc(avg(a, (r) => r.result.how === 'win')), a.filter((r) => r.result.how === 'stuck' || (r.result.how === 'timeout' && !RUN.endless && !DESCEND)).length,
      by.join(' '), pc(avg(a, (r) => r.minhp)), avg(a, (r) => r.hurt).toFixed(0), avg(a, (r) => r.dodges).toFixed(0), avg(a, (r) => r.hp_potion).toFixed(1),
      avg(a, (r) => r.mp_potion).toFixed(1), pc(avg(a, (r) => r.minmp)), Math.round(avg(a, (r) => r.floors.reduce((n, f) => n + f.time, 0)) / 60) + 'm',
      perFloor(a, (f) => f.lvl, 0)].join(' | ') + ends.map((f) => ` | past f${f} ${Math.round(past(a, f) * 100)}%`).join('')); }
  // each stuck run and each hung process, to replay it (playtest.cjs <seed> --profile <p> --runs <n>)
  const stuck = profiles.flatMap((p) => (res[p] || []).flatMap((rows) => rows.map((r, k) => [p, k, r]))).filter(([, , r]) => r.result.how === 'stuck')
    .map(([p, k, r]) => `${p} seed ${r.seed} run ${k + 1} f${r.result.floor} ${r.result.why || 'floor'} at ${r.result.at} goal ${r.result.goal}`);
  if (stuck.length || hung.length) console.log(`\nstuck ${stuck.length}, hung ${hung.length}\n` + stuck.concat(hung.map((h) => h + ': hung, killed after ' + jobMin + ' min')).map((l) => '  ' + l).join('\n'));
  // per floor, of the runs that reached it: potions drunk and what the damage came from
  console.log('\nprofile | run | min hp by floor | hits by floor | hp pot by floor | mp pot by floor | damage share ' + GROUPS.join(' / ') + ' | top source by floor');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue;
    const tot = {}; for (const r of a) for (const f of r.floors) for (const g in f.dmg || {}) tot[g] = (tot[g] || 0) + f.dmg[g];
    const sum = Object.values(tot).reduce((n, v) => n + v, 0) || 1;
    const top = Array.from({ length: FLOORS }, (_, i) => { const t = {}; for (const r of a) { const f = r.floors.find((q) => q.floor === i + 1); for (const g in (f && f.dmg) || {}) t[g] = (t[g] || 0) + f.dmg[g]; }
      const g = Object.keys(t).sort((x, y) => t[y] - t[x])[0]; return g || '-'; }).join(' ');
    console.log([p, k + 1, perFloor(a, (f) => Math.round((f.minhp ?? 1) * 100), 0), perFloor(a, (f) => f.hits || 0, 0), perFloor(a, (f) => f.hpPot || 0, 1), perFloor(a, (f) => f.mpPot || 0, 1), GROUPS.map((g) => Math.round((tot[g] || 0) / sum * 100) + '%').join(' / '), top].join(' | ')); }
  // by monster (TASKS 468): the health each took per run, as a share of the max, and what struck the killing blow
  console.log('\nprofile | run | health taken per run, % of max, by monster | killing blows');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue;
    const by = {}, kill = {}; for (const r of a) { for (const f of r.floors) for (const t in f.by || {}) by[t] = (by[t] || 0) + f.by[t]; if (r.result.how === 'dead' && r.killer) kill[r.killer] = (kill[r.killer] || 0) + 1; }
    const list = (o, f) => Object.keys(o).sort((x, y) => o[y] - o[x]).slice(0, 10).map((t) => t + ' ' + f(o[t])).join(', ') || '-';
    console.log([p, k + 1, list(by, (v) => Math.round(v / a.length * 100)), list(kill, (v) => v)].join(' | ')); }
  // a run through the town (TASKS 1024): trips home by the scroll, scrolls read, quests taken and turned in, gold spent, per run
  if (mode === 'town') { console.log('\nprofile | run | trips home | scrolls read (found, bought) | quests taken | turned in | gold spent | hp pot bought');
    for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue; const T = (f) => avg(a, (r) => (r.town ? f(r.town) : 0)).toFixed(1);
      console.log([p, k + 1, T((t) => t.visits), T((t) => t.scrolls) + ' (' + T((t) => t.found || 0) + ', ' + T((t) => t.bought || 0) + ')', T((t) => t.taken), T((t) => t.turned), avg(a, (r) => r.spent).toFixed(0), avg(a, (r) => r.potBought || 0).toFixed(1)].join(' | ')); } }
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
  console.log('\nprofile | run | floor / boss: reached / died / fight s (median) / health lost / hp potions / held by pools s');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue; for (const f of BOSS_FLOORS) { const b = bossOf(a, f);
    if (b.n) console.log([p, k + 1, f, `${b.n} / ${Math.round(b.died * 100)}% / ${b.t.toFixed(0)} / ${Math.round(b.dmg * 100)}% / ${b.pot.toFixed(1)} / ${b.cut.toFixed(1)}`].join(' | ')); } }
  // how big one blow is before the shield, as a share of the max health; levels gained on each floor
  console.log('\nprofile | run | blow % of max hp by floor: mob p50 | heavy p50 | mob p90 | elite p90 | levels gained by floor');
  for (const p of profiles) for (let k = 0; k < runs; k++) { const a = (res[p] || []).map((x) => x[k]).filter(Boolean); if (!a.length) continue;
    const by = (g, q) => Array.from({ length: FLOORS }, (_, i) => { const v = blowAt(a, i, g, q); return v === null ? '-' : v.toFixed(0); }).join(' ');
    console.log([p, k + 1, by('mob', 0.5), by('heavy', 0.5), by('mob', 0.9), by('elite', 0.9), Array.from({ length: FLOORS }, (_, i) => { const v = lvlUp(a, i); return v === null ? '-' : v.toFixed(1); }).join(' ')].join(' | ')); }
}
// the q-th share of the blows of a source group on floor i + 1 over all runs, in % of the max health
const blowAt = (a, i, g, q) => { const l = a.flatMap((r) => ((r.floors.find((f) => f.floor === i + 1) || {}).blows || {})[g] || []).sort((x, y) => x - y);
  return l.length >= 20 ? l[Math.min(l.length - 1, Math.floor(l.length * q))] * 100 : null; };
// levels gained on floor i + 1 by the runs that finished it (the hero starts at the run's level)
const lvlUp = (a, i) => { const l = a.map((r) => { const f = r.floors.find((q) => q.floor === i + 1), pr = i ? r.floors.find((q) => q.floor === i) : { lvl: RUN.lvl }; return f && pr ? f.lvl - pr.lvl : null; }).filter((v) => v !== null);
  return l.length ? avg(l, (v) => v) : null; };
// the fight's length is the winners' (a death cuts a fight short); deaths carry a 95 % Wilson interval: a band met by a point is
// only as sure as the sample (TASKS 227)
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, c = (p + z * z / (2 * n)) / (1 + z * z / n), w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n); return [c - w, c + w]; };
const ci = (k, n) => wilson(k, n).map((v) => (v * 100).toFixed(1)).join('–') + '%';
const bossOf = (a, floor = FLOORS) => { const l = a.map((r) => (r.floors.find((f) => f.floor === floor) || {}).boss).filter(Boolean), ts = l.filter((b) => !b.died).map((b) => b.t).sort((x, y) => x - y);
  return { n: l.length, k: l.filter((b) => b.died).length, died: avg(l, (b) => b.died || 0),
    t: ts[ts.length >> 1] || 0, dmg: avg(l, (b) => b.dmg), pot: avg(l, (b) => b.pot), cut: avg(l, (b) => b.cut || 0) }; };
const GROUPS = ['mob', 'elite', 'bolt', 'trap', 'dot'];
// builder: a player who gathers fire and crit and burns the bosses with fireballs still fights each for 15 s or more (TASKS 245)
const BUILDER = { bossT: [15, Infinity], chapters: { 2: { t: [15, Infinity] }, 8: { t: [15, Infinity] }, 4: { t: [15, Infinity] }, 6: { t: [15, Infinity] } } };
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
// the water caves' bands (TASKS 314, 05.11.2026, the player's call: each floor harder than the last): the average hero of level 10 wins 71–77 % of 160 seeds,
// minimum health falls 45→27 % and potions climb 0.9→1.9 from the 1st floor to the 4th (two sets, 1–160 and 161–320), the serpent takes 153–160 %;
// the water caves get their bands with their balance (TASKS 314); in the campaign (TASKS 339) the old finale's bands hold its 8th:
// past: the share past a floor (the old 8-floor campaign's wins), bossFloor: the floor of bossDied (the demon lord); the serpent's own
// fight bands stand on the 12th (chapters: lost, pot, t). The whole run's wins (the town run, TASKS 1195, the player's call 10.11.2026): novice 20–30 %, average 50–60 %, expert 70–80 %
// for now (the average takes 45–48 % over 160 seeds; a band belongs to the follow-up balance, TASKS 340/341)
// the magma caves' colossus (TASKS 413): harder than the serpent (1.55 of the health, 0.9 potions, 35 s) by the player's call 02.11.2026
// (magma, TASKS 414: harder than the caves; deaths over every floor, the boss's at most 60 %)
// (the campaign's 13th–16th, the magma's chapter, TASKS 416: a step harder than the caves' 9th–12th, the colossus as in the magma's own run)
const BANDS = { cave: { normal: { average: { win: [0.65, 0.85], bossLost: [1.5, 2.5], bossPot: [0, 2], bossT: [20, 90], deathShare: 0.4,
    floor: { 1: { minhp: [38, 54], hpPot: [0.5, 1.4] }, 2: { minhp: [30, 46], hpPot: [0.8, 1.9] }, 3: { minhp: [30, 46], hpPot: [1.1, 2.1] }, 4: { minhp: [20, 36], hpPot: [1.3, 2.5] } } }, expert: { win: [0.72, 0.92] }, builder: { win: [0.72, 0.92] } } }, magma: { normal: { average: { win: [0.55, 0.7], bossLost: [1.8, 2.5], bossPot: [1.5, 2.5], bossT: [40, 70], deathShare: 0.6 }, expert: { win: [0, 0.85] } } }, campaign: {
  easy: { average: { past: { 8: [0.85, 1] } } },
  normal: { average: { win: [0.5, 0.6], past: { 8: [0.4, 0.6] }, deep: { lost: [1.5, 2.5], t: [20, 90] }, bossFloor: 8, minhp: [25, 45], hpPot: [0.8, 2], floor: { 2: { hpPot: [0.4, 2] }, 7: { minhp: [25, 50] }, 8: { minhp: null, hpPot: null, winMinhp: [18, 45] }, 9: { minhp: [34, 50], hpPot: [0.6, 1.6] }, 10: { minhp: [30, 44], hpPot: [0.9, 1.8] }, 11: { minhp: [26, 40], hpPot: [1.2, 2.3] }, 12: { minhp: [18, 32], hpPot: [1.6, 2.8] },
    13: { minhp: [30, 46], hpPot: [0.9, 1.8] }, 14: { minhp: [26, 40], hpPot: [1.2, 2.3] }, 15: { minhp: [22, 36], hpPot: [1.5, 2.6] }, 16: { minhp: [15, 30], hpPot: [1.8, 3] } }, deathShare: 0.25, bossDied: [0.1, 0.2], pressure: true, chapters: { 12: { lost: [1.5, 2.5], pot: [0, 2], t: [20, 90] }, 16: { lost: [1.8, 2.5], pot: [1.5, 2.5], t: [40, 70] }, 2: { died: [0, 0.05], t: [15, 20] }, 4: { died: [0, 0.05] }, 6: { died: [0, 0.05] } }, bossLost: [1.5, 3], bossPot: [1, 2.5], bossT: [20, 30],
    mobBlow: [6, 10], heavyBlow: [15, 25], lvlUp: [0.8, 2.2], meta: { run: 3, win: [0, 0.65] } }, expert: { win: [0.7, 0.8], past: { 8: [0, 0.85] } }, novice: { win: [0.2, 0.3] }, builder: BUILDER },
  hard: { average: { past: { 8: [0.1, 0.25] } }, expert: { past: { 8: [0.4, 0.6] } }, builder: BUILDER } } };
function check() {
  const miss = failed.map((s) => `missing result: ${s}`), B = (BANDS[mode === 'town' ? 'campaign' : mode] || {})[diff] || {}, inB = (v, [a, b]) => v >= a - 1e-9 && v <= b + 1e-9;
  // one fresh version only: results saved from another version or resumed from a checkpoint never pass (TASKS 240)
  const { VERSION } = require('./bot.cjs'), all = Object.values(res).flat(2);
  const stale = all.filter((r) => r.ver !== VERSION).length, resumed = all.filter((r) => r.resumed).length;
  if (stale) miss.push(`${stale} result(s) played on another version of the game or the bot (now ${VERSION})`);
  if (resumed) miss.push(`${resumed} result(s) resumed from a checkpoint: --check needs fresh runs`);
  if (RUN.endless || DESCEND) for (const p of profiles) for (const row of res[p] || []) for (const r of row) if (bossRepeats(r)) miss.push(`${p} seed ${r.seed}: ${bossRepeats(r)} boss repeat(s) before all five came up`);
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
    for (const f in b.past || {}) { const v = past(a, +f); if (!inB(v, b.past[f])) miss.push(`${p}: ${Math.round(v * 100)}% past floor ${f}, outside ${b.past[f].map((x) => x * 100).join('–')}%`); }
    for (let i = 0; i < FLOORS; i++) { const l = a.map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean); if (!l.length) continue;
      const mh = avg(l, (f) => (f.minhp ?? 1) * 100), hp = avg(l, (f) => f.hpPot || 0), bf = Object.assign({}, b, (b.floor || {})[i + 1]);
      if (bf.minhp && !inB(mh, bf.minhp)) miss.push(`${p} f${i + 1}: min hp ${Math.round(mh)}% outside ${bf.minhp.join('–')}%`);
      if (bf.winMinhp) { const w = a.filter((r) => r.result.how === 'win' || r.result.floor > i + 1).map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean), v = w.length ? avg(w, (f) => (f.minhp ?? 1) * 100) : null;
        if (v !== null && !inB(v, bf.winMinhp)) miss.push(`${p} f${i + 1}: survivors' min hp ${v.toFixed(1)}% outside ${bf.winMinhp.join('–')}%`); }
      if (bf.hpPot && !inB(hp, bf.hpPot)) miss.push(`${p} f${i + 1}: ${hp.toFixed(1)} hp potions outside ${bf.hpPot.join('–')}`);
      for (const [g, k, who] of [['mob', 'mobBlow', 'a plain monster'], ['heavy', 'heavyBlow', 'a plain demon']]) { const v = blowAt(a, i, g, 0.5);
        if (bf[k] && v !== null && !inB(v, bf[k])) miss.push(`${p} f${i + 1}: ${who}'s blow ${v.toFixed(1)}% of the health, outside ${bf[k].join('–')}%`); }
      const lu = lvlUp(a, i); if (bf.lvlUp && lu !== null && !inB(lu, bf.lvlUp)) miss.push(`${p} f${i + 1}: ${lu.toFixed(1)} levels gained, outside ${bf.lvlUp.join('–')}`); }
    const bo = bossOf(a, b.bossFloor || FLOORS); if (b.bossLost && bo.n && !inB(bo.dmg, b.bossLost)) miss.push(`${p}: the boss takes ${Math.round(bo.dmg * 100)}% of the health, outside ${b.bossLost.map((v) => v * 100).join('–')}%`);
    if (b.bossPot && bo.n && !inB(bo.pot, b.bossPot)) miss.push(`${p}: ${bo.pot.toFixed(1)} hp potions at the boss, outside ${b.bossPot.join('–')}`);
    if (b.bossT && bo.n && !inB(bo.t, b.bossT)) miss.push(`${p}: the boss fight lasts ${bo.t.toFixed(0)} s, outside ${b.bossT.join('–')} s`);
    const bd = bo;
    if (b.bossDied && a.length < 160) console.log(`${p}: boss death band needs 160 seeds (${a.length} measured)`);
    if (b.bossDied && bd.n) console.log(`${p}: boss deaths ${bd.k}/${bd.n} = ${(bd.died * 100).toFixed(1)}% (95% CI ${ci(bd.k, bd.n)})`);
    if (b.bossDied && a.length >= 160 && !inB(bd.died, b.bossDied)) miss.push(`${p}: boss deaths ${(bd.died * 100).toFixed(1)}%, outside ${b.bossDied.map((v) => v * 100).join('–')}%`);
    for (const f in b.chapters || {}) { const c = bossOf(a, +f), band = b.chapters[f]; if (!c.n) continue;
      if (band.died && !inB(c.died, band.died)) miss.push(`${p} f${f}: boss deaths ${(c.died * 100).toFixed(1)}%, outside ${band.died.map((v) => v * 100).join('–')}%`);
      if (band.t && !inB(c.t, band.t)) miss.push(`${p} f${f}: boss fight ${c.t.toFixed(1)} s, outside ${band.t.join('–')} s`);
      if (band.lost && !inB(c.dmg, band.lost)) miss.push(`${p} f${f}: the boss takes ${Math.round(c.dmg * 100)}% of the health, outside ${band.lost.map((v) => v * 100).join('–')}%`);
      if (band.pot && !inB(c.pot, band.pot)) miss.push(`${p} f${f}: ${c.pot.toFixed(1)} hp potions at the boss, outside ${band.pot.join('–')}`);
    }
    // past the serpent (--descend, TASKS 354): the descent's bosses on floors 13+ hold the campaign's boss bands, all fights pooled
    if (DESCEND && b.deep) { const l = a.flatMap((r) => r.floors.filter((f) => f.floor > 12 && f.boss).map((f) => f.boss)), ts = l.filter((q) => !q.died).map((q) => q.t).sort((x, y) => x - y);
      if (l.length) { const lost = avg(l, (q) => q.dmg), t = ts[ts.length >> 1] || 0; console.log(`${p}: descent bosses ${l.length} fights, ${Math.round(lost * 100)}% of the health, ${t.toFixed(0)} s`);
        if (!inB(lost, b.deep.lost)) miss.push(`${p}: descent bosses take ${Math.round(lost * 100)}% of the health, outside ${b.deep.lost.map((v) => v * 100).join('–')}%`);
        if (!inB(t, b.deep.t)) miss.push(`${p}: descent boss fights last ${t.toFixed(0)} s, outside ${b.deep.t.join('–')} s`); } }
    if (b.pressure && a.length < 160) console.log(`${p}: pressure curve needs 160 seeds (${a.length} measured)`);
    if (b.pressure && a.length >= 160) for (let f = 4; f <= FLOORS; f++) { if (STAGE(f).lf === 1) continue;   // a chapter starts afresh past its boss
      const at = (floor, fn) => { const l = a.flatMap((r) => r.floors.filter((q) => q.floor === floor)); return avg(l, fn); },
      dmg = at(f, (q) => q.dmgHp || 0), prev = at(f - 1, (q) => q.dmgHp || 0), pot = at(f, (q) => q.hpPot || 0), pot0 = at(f - 1, (q) => q.hpPot || 0);
      if (dmg < prev) miss.push(`${p} f${f}: floor damage ${dmg.toFixed(2)} max HP, below f${f - 1} ${prev.toFixed(2)}`);
      if (pot < pot0 - 0.3 - 1e-9) miss.push(`${p} f${f}: potion use falls ${ (pot0 - pot).toFixed(2)}, over 0.3`);
    }
    const dead = a.filter((r) => r.result.how === 'dead'), by = Array(FLOORS).fill(0); for (const r of dead) by[r.result.floor - 1]++;
    if (b.deathShare && dead.length >= 8) by.forEach((n, i) => { if (n / dead.length > b.deathShare) miss.push(`${p}: ${n} of ${dead.length} deaths on floor ${i + 1}, over ${b.deathShare * 100}%`); });
    const am = b.meta && runs >= b.meta.run ? (res[p] || []).map((x) => x[b.meta.run - 1]).filter(Boolean) : [];
    if (am.length) { const w = avg(am, (r) => r.result.how === 'win'); if (!inB(w, b.meta.win)) miss.push(`${p}: run ${b.meta.run} with meta wins ${Math.round(w * 100)}%, outside ${b.meta.win.map((v) => v * 100).join('–')}%`); } }
  console.log('\ncheck (' + (mode === 'campaign' ? '' : mode + ', ') + diff + (runs >= 3 ? ', runs 1 and 3' : ', run 1') + '): ' + (miss.length ? miss.length + ' miss(es)\n  ' + miss.join('\n  ') : 'every band met'));
  if (miss.length) process.exitCode = 2;
}
const perFloor = (a, fn, dp) => Array.from({ length: FLOORS }, (_, i) => { const l = a.map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean); return l.length ? avg(l, fn).toFixed(dp) : '-'; }).join(' ');
const botCmd = (p, s) => ['--profile', p, '--runs', String(runs), '--diff', diff, '--mode', mode].concat(DESCEND ? ['--descend'] : [], process.argv.includes('--no-town') ? ['--no-town'] : [], arg('--hours', '') ? ['--hours', arg('--hours', '')] : [], arg('--cls', '') ? ['--cls', arg('--cls', '')] : []);
// results kept by the version of the game and the bot, the bot's driver and node, with every flag the bot gets (TASKS 467): a --check
// again on the same seeds reads them instead of playing. A share of them is played afresh beside the rest and must come out the same
// to the byte, or the version's whole cache is thrown away and the run fails
const noCache = ['--no-cache', '--from-json', '--snapshots', '--dump-state', '--replay-floor'].some((k) => process.argv.includes(k));
const CACHE = (() => { const h = require('crypto').createHash('sha1'); h.update(fs.readFileSync(path.join(__dirname, 'playtest.cjs'))); h.update(process.version);
  return path.join(__dirname, '..', 'frames', 'balance-cache', require('./bot.cjs').VERSION + '-' + h.digest('hex').slice(0, 8)); })();
const cacheFile = (p, s) => path.join(CACHE, botCmd(p, s).join(' ').replace(/[^\w.-]+/g, '_') + '_seed' + s + '.jsonl');
const cached = noCache ? [] : todo.filter(([p, s]) => fs.existsSync(cacheFile(p, s)));
const verify = cached.filter((_, i) => i % Math.max(1, Math.floor(cached.length / Math.max(2, Math.ceil(cached.length * 0.05)))) === 0);
const cacheBad = [];
for (const [p, s] of cached) { const rows = fs.readFileSync(cacheFile(p, s), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  res[p] = (res[p] || []).filter((r) => r[0].seed !== s); res[p].push(rows); }
todo.splice(0, todo.length, ...verify.map(([p, s]) => [p, s, 1]), ...todo.filter((j) => !cached.includes(j)));
const staleSnap = [], prefix = {}; let prefixCheck = 0;
if (replayFloor && snapDir) { const resumable = todo.filter(([p, s, again]) => !again && fs.existsSync(path.join(snapDir, `${diff}_${p}_${s}_f${replayFloor}.bin`)));
  const n = Math.max(2, Math.ceil(resumable.length * 0.05)), step = Math.max(1, Math.floor(resumable.length / n)), pick = resumable.filter((_, i) => i % step === 0).slice(0, n);
  for (const [p, rows] of Object.entries(JSON.parse(fs.readFileSync(resume, 'utf8')))) for (const r of rows) prefix[p + ' ' + r[0].seed] = r;
  for (const j of pick) j[3] = 1; prefixCheck = pick.length; todo.sort((a, b) => (b[3] || 0) - (a[3] || 0));
  console.error(`replay from floor ${replayFloor}: ${resumable.length} seed(s) from snapshots, ${pick.length} of them played whole to check the snapshots`); }
left = todo.length;
if (cached.length) console.error(`cache ${CACHE}: ${cached.length} result(s) read, ${verify.length} played again to check them`);
function finish() {
  if (staleSnap.length) { console.log(`\nsnapshots: ${staleSnap.length} of ${prefixCheck} seed(s) played whole differ before floor ${replayFloor} (${staleSnap.join(', ')}): the floors before it changed, take the snapshots again`); process.exitCode = 2; return; }
  if (cacheBad.length) { fs.rmSync(CACHE, { recursive: true, force: true }); console.log(`\ncache: ${cacheBad.length} of ${verify.length} replayed result(s) differ (${cacheBad.join(', ')}): the cache ${CACHE} is removed, run again`); process.exitCode = 2; return; }
  report(); if (process.argv.includes('--check')) check();
}
function next() {
  const job = todo.shift(); if (!job) return; const [p, s, again, whole] = job;
  const cmd = ['node', path.join(__dirname, 'playtest.cjs'), String(s)].concat(botCmd(p, s), ['--json']);
  const dump = arg('--dump-state', ''); if (dump) cmd.push('--dump-state', dump);
  const file = snapDir && path.join(snapDir, `${diff}_${p}_${s}_f${replayFloor}.bin`);
  if (snapDir && !replayFloor) cmd.push('--snapshots', snapDir, '--snap-floors', chapterFloors().join(','));
  else if (snapDir && !whole && fs.existsSync(file)) cmd.push('--checkpoint', file, '--rebuild');
  if (quiet) cmd.splice(1, 0, '--single-threaded-gc');
  const child = execFile(cmd[0], cmd.slice(1), { maxBuffer: 1 << 26, timeout: jobMin * 60e3, killSignal: 'SIGKILL' }, (err, out) => {
    children.delete(child); if (stopped) return;
    if (err && err.killed) { hung.push(`${p} seed ${s}`); failed.push(`${s} ${p}`); console.error(`seed ${s} ${p}: hung, killed after ${jobMin} min`); }
    else if (err) { failed.push(`${s} ${p}`); console.error(`seed ${s} ${p}: ${err.message.split('\n')[0]}\n${(err.stderr || '').split('\n').slice(0, 7).join('\n')}`); }
    else if (again) { if (out.trim() !== fs.readFileSync(cacheFile(p, s), 'utf8').trim()) cacheBad.push(`${p} seed ${s}`); }
    else if (whole) { const fresh = out.trim().split('\n').map((l) => JSON.parse(l)), was = prefix[p + ' ' + s], cut = (r) => JSON.stringify(r.floors.filter((f) => f.floor < replayFloor));
      if (!was || fresh.length !== was.length || fresh.some((r, k) => cut(r) !== cut(was[k]))) staleSnap.push(`${p} seed ${s}`);
      res[p] = (res[p] || []).filter((r) => r[0].seed !== s); res[p].push(fresh); }
    else { res[p] = (res[p] || []).filter((r) => r[0].seed !== s); res[p].push(out.trim().split('\n').map((l) => JSON.parse(l)));
      if (!noCache) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(cacheFile(p, s), out.trim() + '\n'); } }
    const dest = arg('--json-out', ''); if (dest) fs.writeFileSync(dest, JSON.stringify(res));
    if (snapDir && !replayFloor) fs.writeFileSync(path.join(snapDir, 'results.json'), JSON.stringify(res));
    judge(); if (stopped) return;
    if (--left === 0) finish(); else next(); });
  children.add(child);
  if (quiet) try { os.setPriority(child.pid, 19); } catch (e) { /* the bot just runs at normal priority */ }
}
// --check over more than 40 seeds stops at a block of 40 once a band is missed beyond doubt: the 95 % interval of the share or the
// mean wholly outside it (TASKS 467). A pass is still only read off all the seeds asked for (the player's call in TASKS 227)
const early = process.argv.includes('--check') && !process.argv.includes('--full') && (s1 || s0) - s0 + 1 > 40;
const children = new Set(); let stopped = 0, judged = 0;
function clearMisses(n) {
  const B = (BANDS[mode === 'town' ? 'campaign' : mode] || {})[diff] || {}, out = [], z = 1.96;
  const share = (name, k, m, [a, b]) => { const [lo, hi] = wilson(k, m); if (m && (hi < a || lo > b)) out.push(`${name} ${Math.round(k / m * 100)}% (95% ${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%), band ${a * 100}–${b * 100}%`); };
  // a mean is judged on 30 values or more, its spread taken as no less than half the band's width: a few fights, or counts all
  // alike (two boss fights without a potion), give an interval of no width that proves nothing
  const mean = (name, l, [a, b], k = 1) => { if (l.length < 30) return; const m = avg(l, (v) => v), sd = Math.max((b - a) / 2, Math.sqrt(avg(l, (v) => (v - m) ** 2) * l.length / (l.length - 1))), w = z * sd / Math.sqrt(l.length);
    if (m + w < a || m - w > b) out.push(`${name} ${(m * k).toFixed(1)} (95% ${((m - w) * k).toFixed(1)}–${((m + w) * k).toFixed(1)}), band ${a * k}–${b * k}`); };
  for (const p in B) { if (!profiles.includes(p)) continue; const b = B[p], a = (res[p] || []).map((x) => x[0]).filter((r) => r && r.seed < s0 + n);
    if (b.win) share(`${p}: wins`, a.filter((r) => r.result.how === 'win').length, a.length, b.win);
    for (const f in b.past || {}) share(`${p}: past floor ${f}`, a.filter((r) => r.result.how === 'win' || r.result.floor > +f).length, a.length, b.past[f]);
    for (let i = 0; i < FLOORS; i++) { const l = a.map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean), bf = Object.assign({}, b, (b.floor || {})[i + 1]);
      if (bf.minhp) mean(`${p} f${i + 1}: min hp %`, l.map((f) => (f.minhp ?? 1) * 100), bf.minhp);
      if (bf.hpPot) mean(`${p} f${i + 1}: hp potions`, l.map((f) => f.hpPot || 0), bf.hpPot); }
    const bl = a.map((r) => (r.floors.find((f) => f.floor === (b.bossFloor || FLOORS)) || {}).boss).filter(Boolean);
    if (b.bossLost) mean(`${p}: health the boss takes`, bl.map((q) => q.dmg), b.bossLost, 100);
    if (b.bossPot) mean(`${p}: hp potions at the boss`, bl.map((q) => q.pot), b.bossPot); }
  return out;
}
function judge() {
  if (!early || stopped) return; const done = (s) => profiles.every((p) => (res[p] || []).some((r) => r[0].seed === s)) || failed.some((f) => f.split(' ')[0] === String(s));
  let n = judged; while (n + 40 <= (s1 || s0) - s0 + 1 && Array.from({ length: 40 }, (_, i) => s0 + n + i).every(done)) n += 40;
  if (n === judged || n >= (s1 || s0) - s0 + 1) return; judged = n; const miss = clearMisses(n); if (!miss.length) return;
  stopped = 1; todo.length = 0; for (const c of children) c.kill('SIGKILL');
  for (const p in res) res[p] = res[p].filter((r) => r[0].seed < s0 + n);
  report(); console.log(`\nearly stop at seeds ${s0}–${s0 + n - 1} (TASKS 467): ${miss.length} band(s) missed beyond doubt\n  ` + miss.join('\n  ') + '\n(--full plays every seed)');
  process.exitCode = 2;
}
// one such run at a time (TASKS 467): two side by side on the same cores each took twice as long, the quiet one three hours;
// a later one, from any worktree, waits for the earlier ones to end
function othersRunning() { try { return execFileSync('ps', ['-Ao', 'pid=,command='], { encoding: 'utf8' }).split('\n').map((l) => l.trim().match(/^(\d+)\s+(.*)$/)).filter(Boolean)
  .filter(([, pid, c]) => +pid < process.pid && /^\S*node(\s+-\S+)*\s+\S*difficulty\.cjs(\s|$)/.test(c) && !/--from-json/.test(c)).map(([, pid]) => pid); } catch (e) { return []; } }
function start() { const o = othersRunning(); if (o.length) { if (!start.said) console.error(`waiting for difficulty.cjs (pid ${o.join(', ')}) to finish`); start.said = 1; return setTimeout(start, 30e3); }
  for (let i = 0; i < jobs; i++) next(); }
const sources = arg('--from-json', '');
if (sources) {
  for (const file of sources.split(',')) for (const [p, rows] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))) {
    res[p] = (res[p] || []).concat(rows.filter((r) => r[0].seed >= s0 && r[0].seed <= (s1 || s0)));
  }
  report(); if (process.argv.includes('--check')) check();
} else if (!left) finish();
else start();
