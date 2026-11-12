// node tools/changelog.cjs [--check] [--draft [from]] — the player's changelog (TASKS 1038). CHANGELOG.md is the one source:
//   (no flag)  rebuild live/data_changes.js (DATA.CHANGES, read by the «Что нового» screen) from it, then check
//   --check    only check: the data file is current, the top entry is DATA.VERSION, versions fall and dates are real; exit 2 on failure
//   --draft    the commits since the last version tag (or `from`) with their task numbers and those tasks' titles from
//              TASKS_COMPLETED.md / TASKS.md: the raw material for the next entry, which is written by hand by the header's rules
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), MD = path.join(ROOT, 'CHANGELOG.md'), OUT = path.join(ROOT, 'live', 'data_changes.js');
// «Самое главное» (TASKS 1305): the version's few main lines for the menu's frame, kept apart from the groups the news screen lists
const arg = process.argv.slice(2), GROUPS = ['Главное', 'Геймплей', 'Интерфейс', 'Исправления'], SHORT = 'Самое главное', MAIN_N = 5, MAIN_LEN = 80;

function parse(src) {
  const out = []; let v = null, g = null, item = null;
  for (const line of src.split('\n')) {
    const h = /^## (\d+\.\d+\.\d+) — (\d\d)\.(\d\d)\.(\d{4})\s*$/.exec(line);
    if (h) { v = { v: h[1], date: `${h[2]}.${h[3]}.${h[4]}`, groups: [] }; out.push(v); g = item = null; continue; }
    if (/^## /.test(line)) throw new Error('CHANGELOG.md: a heading that is not «## X.Y.Z — ДД.ММ.ГГГГ»: ' + line);
    if (!v) continue;
    const gh = /^### (.+?)\s*$/.exec(line);
    if (gh && gh[1] === SHORT) { if (g || v.main) throw new Error(`CHANGELOG.md: ${v.v}: «${SHORT}» goes first and once`); v.main = []; g = { name: SHORT, items: v.main }; item = null; continue; }
    if (gh) { const at = GROUPS.indexOf(gh[1]), was = g ? GROUPS.indexOf(g.name) : -1;
      if (at < 0) throw new Error(`CHANGELOG.md: ${v.v}: a section «${gh[1]}» outside ${GROUPS.join(' / ')}`);
      if (at <= was) throw new Error(`CHANGELOG.md: ${v.v}: «${gh[1]}» after «${g.name}», the order is ${GROUPS.join(' / ')}`);
      g = { name: gh[1], items: [] }; v.groups.push(g); item = null; continue; }
    if (/^- /.test(line)) { if (!g) throw new Error(`CHANGELOG.md: ${v.v}: a point outside a «###» section`); item = line.slice(2).trim(); g.items.push(item); continue; }
    if (/^\s+\S/.test(line) && item !== null) { g.items[g.items.length - 1] = item = item + ' ' + line.trim(); continue; }
    if (line.trim()) throw new Error(`CHANGELOG.md: ${v.v}: a line that is neither a section nor a point: ${line}`);
    item = null;
  }
  return out;
}
const emit = (C) => '// live/data_changes.js — built by tools/changelog.cjs from CHANGELOG.md; edit the journal, not this file.\n' +
  '(function (root) {\n  const D = root.DATA || (root.DATA = {});\n  D.CHANGES = ' + JSON.stringify(C, null, 1).replace(/\n/g, '\n  ') + ';\n' +
  "})(typeof window !== 'undefined' ? window : globalThis);\n";

if (arg[0] === '--draft') {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let from = arg[1]; if (!from) try { from = git('describe', '--tags', '--abbrev=0', '--match', 'v*'); } catch (e) { from = '1b876ea'; }
  const tasks = new Map();
  for (const f of ['TASKS_COMPLETED.md', 'TASKS.md']) for (const l of fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
    const m = /^(\d+)\. \S+ (?:\*\*(?:\[[^\]]+\])+\*\* ?)?(.*)$/.exec(l); if (m && !tasks.has(m[1])) tasks.set(m[1], m[2].replace(/\*\*/g, '').slice(0, 150)); }
  console.log(`commits ${from}..HEAD\n`);
  const seen = new Set();
  for (const l of git('log', '--no-merges', '--reverse', '--format=%h %s', `${from}..HEAD`).split('\n').filter(Boolean)) {
    console.log(l);
    for (const n of new Set(l.match(/\b\d{3,4}\b/g) || [])) if (tasks.has(n) && !seen.has(n)) { seen.add(n); console.log(`    ${n}: ${tasks.get(n)}`); }
  }
  return;
}

const fails = [];
let C = [];
try { C = parse(fs.readFileSync(MD, 'utf8')); } catch (e) { fails.push(e.message); }
const txt = emit(C);
if (!arg.includes('--check') && !fails.length) { fs.writeFileSync(OUT, txt); console.log('wrote', path.relative(ROOT, OUT)); }
if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== txt) fails.push('live/data_changes.js is not built from CHANGELOG.md: run node tools/changelog.cjs');
global.TXT = Object.assign(() => '', { n: () => '' }); require(path.join(ROOT, 'live', 'data_core.js'));
const VERSION = globalThis.DATA.VERSION, key = (v) => v.split('.').map(Number).reduce((a, x) => a * 1000 + x, 0);
if (!C.length) fails.push('CHANGELOG.md holds no version');
else if (C[0].v !== VERSION) fails.push(`the top entry is ${C[0].v}, DATA.VERSION is ${VERSION}`);
C.forEach((e, i) => {
  const [d, m, y] = e.date.split('.').map(Number), dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== m - 1) fails.push(`${e.v}: no such date ${e.date}`);
  if (i && key(e.v) >= key(C[i - 1].v)) fails.push(`${e.v} is below ${C[i - 1].v}: newer versions go on top`);
  if (!e.groups.length || e.groups.some((g) => !g.items.length)) fails.push(`${e.v}: an entry or a section without points`);
  if (e.main && (!e.main.length || e.main.length > MAIN_N)) fails.push(`${e.v}: «${SHORT}» holds ${e.main.length} lines, 1 to ${MAIN_N} fit the menu's frame`);
  for (const s of e.main || []) if (s.length > MAIN_LEN) fails.push(`${e.v}: «${SHORT}»: longer than ${MAIN_LEN}: ${s}`);
});
for (const f of fails) console.log('FAIL', f);
console.log(`changelog: ${C.length} version(s), ${C.reduce((a, e) => a + e.groups.reduce((b, g) => b + g.items.length, 0), 0)} points, ${fails.length ? fails.length + ' failure(s)' : 'ok'}`);
process.exitCode = fails.length ? 2 : 0;
