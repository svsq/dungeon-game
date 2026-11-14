// node tools/textcheck.cjs — the game's texts live in live/text_<lang>_<domain>.js (TASKS 1141, 2044): no Cyrillic in a string, template or regex
// of the code outside them, every TXT / TXT.n key is a plain literal (or a family «'A.' + id + '.b'») that the Russian table holds (a TXT.n key: its three plural
// forms), and the table holds no key the code never asks for. Exit 2 on failure.
// sim_checks*.js is the sim's self-check code (its messages are for the developer) and is not scanned.
const fs = require('fs'), path = require('path');
const LIVE = path.join(__dirname, '..', 'live'), SKIP = new Set(['text.js', 'assets.js', 'rigs.js', 'sizes.js', 'data_changes.js', 'tune.cjs']);
require(path.join(LIVE, 'text.js')); for (const f of require(path.join(LIVE, 'modules.js')).text) require(path.join(LIVE, f));
const RU = globalThis.TEXT.ru, DOM = globalThis.TEXT.domains.ru, at = (k) => `text_ru_${DOM[k] || '?'}.js`;
const CY = /[А-Яа-яЁё]/, fails = [], used = new Map(), { code } = require('./jsscan.cjs');
for (const f of fs.readdirSync(LIVE).filter((f) => f.endsWith('.js') && !SKIP.has(f) && !/^text_\w+\.js$/.test(f) && !/^sim_checks/.test(f))) {
  const c = code(fs.readFileSync(path.join(LIVE, f), 'utf8')), lines = c.split('\n');
  lines.forEach((l, i) => { if (CY.test(l)) fails.push(`${f}:${i + 1}: Cyrillic in code: ${l.trim().slice(0, 100)}`); });
  for (const m of c.matchAll(/\bTXT(\.n)?\(\s*('([^'\\]*)'|[^'\s)][^,)]*)/g)) {
    if (!m[3]) { fails.push(`${f}: a TXT key that is not a literal: ${m[2].slice(0, 60)}`); continue; }
    // a family read by one key per item, «'A.' + id + '.b'» (the gifts' descriptions, TASKS 1900): every A.*.b text is the family's
    { const fam = /^\s*\+\s*[\w$.]+\s*\+\s*'([^'\\]*)'/.exec(c.slice(m.index + m[0].length));
      if (fam && !m[1]) { const pre = m[3], suf = fam[1], ks = Object.keys(RU).filter((k) => k.startsWith(pre) && k.endsWith(suf) && k.length > pre.length + suf.length && !k.slice(pre.length, -suf.length || undefined).includes('.'));
        if (!ks.length) fails.push(`${f}: no text for the family ${pre}*${suf}`); for (const k of ks) used.set(k, (used.get(k) || 0) + 1); continue; } }
    const k = m[3], plural = !!m[1], v = RU[k]; used.set(k, (used.get(k) || 0) + 1);
    if (v === undefined) fails.push(`${f}: no text for ${k}`);
    else if (plural && !(Array.isArray(v) && v.length === 3)) fails.push(`${f}: ${k} is used as a plural but is not [one, few, many]`);
    else if (!plural && typeof v !== 'string') fails.push(`${f}: ${k} is a plural used as a text`);
  }
}
for (const [k, v] of Object.entries(RU)) for (const m of JSON.stringify(v).matchAll(/\{@(\w+)\}/g)) {
  const n = 'NAME.' + m[1];
  if (RU[n] === undefined) fails.push(`${at(k)}: ${k} refers to ${n}, which the table lacks`); else used.set(n, 1);
}
// a «key@pad» text is the gamepad's twin of «key» (hud.js shows it while the pad speaks): used with its key, and its key must be there
for (const k of Object.keys(RU)) if (k.endsWith('@pad')) { const base = k.slice(0, -4); if (RU[base] === undefined) fails.push(`${at(k)}: ${k} twins ${base}, which the table lacks`); else if (used.has(base)) used.set(k, 1); }
for (const k of Object.keys(RU)) if (!DOM[k]) fails.push(`${k} is in no domain file`);
for (const k of Object.keys(RU)) if (!used.has(k)) fails.push(`${at(k)}: ${k} is never used`);
require(path.join(LIVE, 'text_names_ru.js'));
const BAD = /хуй|хуе|пизд|ебан|ебат|бляд|сука|мудак|жоп|говн|дерьм|ублюд/i, NAMES = globalThis.TEXT.names || {};
for (const [g, v] of Object.entries(NAMES)) for (const [k, L] of [['name', v.names.map((n) => n[0])], ['epithet', v.adj.map((a) => a[0])]]) {
  const seen = new Set(); for (const w of L) { if (seen.has(w)) fails.push(`names ${g}: duplicate ${k} ${w}`); seen.add(w); if (BAD.test(w)) fails.push(`names ${g}: crude ${k} ${w}`); } }
// TASKS 1985: every giver has 3 to 5 turn-in lines for each kind of quest it can give, and each line's {words} fill from such a quest
require(path.join(LIVE, 'text_talk_ru.js')); const D = require(path.join(LIVE, 'data.js'));
const atF = (key) => (D.storyChain('campaign').find((c) => c.key === key) || { f: 3 }).f, sample = (key) => ({ key, f: atF(key), need: D.QUESTS[key].need(atF(key)), title: 'A B', thing: 'T' }), sideKeys = D.QUEST_GIVE.pool;
for (const role of Object.keys(D.QUEST_SAY)) for (const key of role === 'keeper' ? Object.keys(D.QUESTS) : sideKeys) {
  const L = (D.QUEST_SAY[role].turnin || {})[D.QUESTS[key].type];
  if (!L || L.length < 3 || L.length > 5) { fails.push(`turn-in: the ${role} has ${L ? L.length : 'no'} lines for ${D.QUESTS[key].type}, not 3 to 5`); continue; }
  for (const s of L) { const t = D.turnFill(s, sample(key)); if (/[{}]/.test(t) || /undefined|null/.test(t)) fails.push(`turn-in: ${role}/${key} leaves a word unfilled: ${t.slice(0, 80)}`); } }
for (const f of fails) console.log('FAIL', f);
console.log(`textcheck: ${Object.keys(RU).length} texts, ${fails.length ? fails.length + ' failure(s)' : 'ok'}`);
process.exitCode = fails.length ? 2 : 0;
