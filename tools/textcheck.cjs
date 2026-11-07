// node tools/textcheck.cjs — the game's texts live in live/text_<lang>.js (TASKS 1141): no Cyrillic in a string, template or regex
// of the code outside them, every TXT / TXT.n key is a plain literal that the Russian table holds (a TXT.n key: its three plural
// forms), and the table holds no key the code never asks for. Exit 2 on failure.
// sim_checks.js is the sim's self-check code (its messages are for the developer) and is not scanned.
const fs = require('fs'), path = require('path');
const LIVE = path.join(__dirname, '..', 'live'), SKIP = new Set(['text.js', 'sim_checks.js', 'assets.js', 'rigs.js', 'sizes.js', 'tune.cjs']);
require(path.join(LIVE, 'text_ru.js')); const RU = globalThis.TEXT.ru;
const CY = /[А-Яа-яЁё]/, fails = [], used = new Map();
// the code with its comments cut out; strings, templates and regexes kept (a regex is told from a division by what stands before it)
function code(src) {
  let out = '', i = 0; const n = src.length, stack = [];
  const regexOk = () => { const t = out.replace(/\s+$/, ''); const c = t[t.length - 1]; return !c || /[(,=:[!&|?{};+\-*%<>~^]/.test(c) || /\b(return|typeof|case|in|of|new|delete|void|throw)$/.test(t); };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"') { let j = i + 1; while (src[j] !== c) j += src[j] === '\\' ? 2 : 1; out += src.slice(i, j + 1); i = j + 1; continue; }
    if (c === '`') { stack.push('`'); out += c; i++; while (i < n) { if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; } if (src[i] === '`') { out += '`'; i++; stack.pop(); break; }
      if (src[i] === '$' && src[i + 1] === '{') { out += '${'; i += 2; let depth = 1, j = i; while (depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; if (depth) j++; } out += code(src.slice(i, j)) + '}'; i = j + 1; continue; }
      out += src[i++]; } continue; }
    if (c === '/' && regexOk()) { let j = i + 1, cls = false; while (j < n && (src[j] !== '/' || cls)) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; } out += src.slice(i, j + 1); i = j + 1; continue; }
    out += c; i++;
  }
  return out;
}
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
