// live/text.js — the game's texts by key (TASKS 1141). A table is a set of files text_<lang>_<domain>.js, each registering its keys
// with TEXT.add(lang, domain, {key: text}); modules.js finds the files, so a new feature's texts are one new file and no common list.
// TXT(key, params): the text in TEXT.lang (Russian where a language lacks the key) with {name} filled from params; TXT.n(key, n):
// the plural form for n by the language's rule; TXT.fem(word): an adjective's feminine form, which the elite names need for a monster of feminine gender.
(function (root) {
  const TEXT = root.TEXT || (root.TEXT = {});
  TEXT.lang = TEXT.lang || 'ru';
  // a key held by two files used to be overwritten without a word; TEXT.domains[lang][key] names the file's domain (textcheck)
  TEXT.domains = TEXT.domains || {};
  TEXT.add = (lang, domain, table) => {
    const L = TEXT[lang] || (TEXT[lang] = {}), D = TEXT.domains[lang] || (TEXT.domains[lang] = {});
    for (const k of Object.keys(table)) { if (k in L) throw new Error(`text.js: ${lang} text ${k} is in ${D[k]} and in ${domain}`); L[k] = table[k]; D[k] = domain; }
  };
  const RULES = { ru: (n) => (n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 1 : 2) };
  const FEM = { ru: (w) => w.replace(/(ый|ой|ий)$/, 'ая') };
  const get = (key) => { const L = TEXT[TEXT.lang], s = L && key in L ? L[key] : TEXT.ru[key]; if (s === undefined) throw new Error('text.js: no text ' + key); return typeof s === 'string' ? s.replace(/\{@(\w+)\}/g, (m, k) => get('NAME.' + k)) : s; };
  // a fractional number goes into a text with its language's decimal mark, never JavaScript's dot (TASKS 1900: «+1.5» in Russian)
  const DEC = { ru: ',' }, num = (v, d = 1, fixed = false) => (fixed ? v.toFixed(d) : String(Math.round(v * 10 ** d) / 10 ** d)).replace('.', DEC[TEXT.lang] || '.');
  const val = (x) => (typeof x === 'number' ? num(x, 2) : String(x));
  // {name:how} writes a number as `how` says: «pct» is a fraction as percent, a text key is the plural form of its word after the number
  const HOW = { pct: (v) => val(Math.round(v * 100)) }, slot = (v, how) => (how === undefined ? val(v) : how in HOW ? HOW[how](v) : val(v) + ' ' + TXT.n(how, v));
  // a text's numbers come from the data they describe: bind(key, source) names the object (or a function giving it) that fills the key's
  // {name}s, so a call site, the gamepad's twin «key@pad» included, asks for the text alone and no digit is written into it
  const BOUND = {}, sourceOf = (key) => { const b = BOUND[key.replace(/@pad$/, '')]; return typeof b === 'function' ? b() : b; };
  const TXT = (key, p) => { const s = get(key), b = sourceOf(key), q = p || b ? { ...b, ...p } : null; return q ? s.replace(/\{(\w+)(?::([\w.]+))?\}/g, (m, k, how) => (k in q ? slot(q[k], how) : m)) : s; };
  TXT.bound = BOUND; TXT.how = Object.keys(HOW);
  TXT.bind = (key, source) => { if (key in BOUND) throw new Error(`text.js: ${key} is bound twice`); BOUND[key] = source; };
  // a table's field written from its entries' own numbers: every entry is the source of the text its key names
  TXT.bake = (entries, field, keyOf, sourceFor = (x) => x) => { for (const x of entries) { const k = keyOf(x); TXT.bind(k, sourceFor(x)); x[field] = TXT(k); } };
  TXT.num = num;
  TXT.n = (key, n) => get(key)[(RULES[TEXT.lang] || RULES.ru)(n)];
  const fill = (v) => (typeof v === 'string' ? v.replace(/\{@(\w+)\}/g, (m, k) => get('NAME.' + k)) : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v);
  TXT.talk = (role) => fill((TEXT.talk || {})[role] || {});
  TXT.fem = (w) => (FEM[TEXT.lang] || ((x) => x))(w);
  root.TXT = TXT;
  if (typeof module !== 'undefined') module.exports = TXT;
})(typeof window !== 'undefined' ? window : globalThis);
