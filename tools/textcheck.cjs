// node tools/textcheck.cjs — the game's texts live in live/text_<lang>.js (TASKS 1141): no Cyrillic in a string, template or regex
// of the code outside them, every TXT / TXT.n key is a plain literal that the Russian table holds (a TXT.n key: its three plural
// forms), and the table holds no key the code never asks for. Exit 2 on failure.
// sim_checks.js is the sim's self-check code (its messages are for the developer) and is not scanned.
const fs = require('fs'), path = require('path');
const LIVE = path.join(__dirname, '..', 'live'), SKIP = new Set(['text.js', 'sim_checks.js', 'assets.js', 'rigs.js', 'sizes.js', 'tune.cjs']);
require(path.join(LIVE, 'text_ru.js')); const RU = globalThis.TEXT.ru;
const CY = /[А-Яа-яЁё]/, fails = [], used = new Map(), { code } = require('./jsscan.cjs');
for (const f of fs.readdirSync(LIVE).filter((f) => f.endsWith('.js') && !SKIP.has(f) && !/^text_\w+\.js$/.test(f))) {
  const c = code(fs.readFileSync(path.join(LIVE, f), 'utf8')), lines = c.split('\n');
  lines.forEach((l, i) => { if (CY.test(l)) fails.push(`${f}:${i + 1}: Cyrillic in code: ${l.trim().slice(0, 100)}`); });
  for (const m of c.matchAll(/\bTXT(\.n)?\(\s*('([^'\\]*)'|[^'\s)][^,)]*)/g)) {
    if (!m[3]) { fails.push(`${f}: a TXT key that is not a literal: ${m[2].slice(0, 60)}`); continue; }
    const k = m[3], plural = !!m[1], v = RU[k]; used.set(k, (used.get(k) || 0) + 1);
    if (v === undefined) fails.push(`${f}: no text for ${k}`);
    else if (plural && !(Array.isArray(v) && v.length === 3)) fails.push(`${f}: ${k} is used as a plural but is not [one, few, many]`);
    else if (!plural && typeof v !== 'string') fails.push(`${f}: ${k} is a plural used as a text`);
  }
}
for (const k of Object.keys(RU)) if (!used.has(k)) fails.push(`text_ru.js: ${k} is never used`);
for (const f of fails) console.log('FAIL', f);
console.log(`textcheck: ${Object.keys(RU).length} texts, ${fails.length ? fails.length + ' failure(s)' : 'ok'}`);
process.exitCode = fails.length ? 2 : 0;
