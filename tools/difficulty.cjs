// node tools/difficulty.cjs [--seeds 1-40] [--profiles novice,average,expert] [--runs 1] [--diff easy|normal|hard] [-j 8]
// the playtest bot over many seeds and player profiles, in parallel; one row per profile and run number (run 2+ has the meta
// ranks bought with the earlier runs' shards): wins, where runs die, how close they come, what they spend
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
}
const GROUPS = ['mob', 'elite', 'bolt', 'trap', 'dot'];
const perFloor = (a, fn, dp) => Array.from({ length: FLOORS }, (_, i) => { const l = a.map((r) => r.floors.find((f) => f.floor === i + 1)).filter(Boolean); return l.length ? avg(l, fn).toFixed(dp) : '-'; }).join(' ');
function next() {
  const job = todo.shift(); if (!job) return; const [p, s] = job;
  execFile('node', [path.join(__dirname, 'playtest.cjs'), String(s), '--profile', p, '--runs', String(runs), '--diff', diff, '--json'], { maxBuffer: 1 << 26 }, (err, out) => {
    if (err) console.error(`seed ${s} ${p}: ${err.message.split('\n')[0]}`);
    else (res[p] = res[p] || []).push(out.trim().split('\n').map((l) => JSON.parse(l)));
    if (--left === 0) report(); else next(); });
}
for (let i = 0; i < jobs; i++) next();
