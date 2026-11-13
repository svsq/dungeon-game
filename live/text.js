// live/text.js — the game's texts by key (TASKS 1141; the tables are text_<lang>.js). TXT(key, params): the text in TEXT.lang
// (Russian where a language lacks the key) with {name} filled from params; TXT.n(key, n): the plural form for n by the language's
// rule; TXT.fem(word): an adjective's feminine form, which the elite names need for a monster of feminine gender.
(function (root) {
  const TEXT = root.TEXT || (root.TEXT = {});
  TEXT.lang = TEXT.lang || 'ru';
  const RULES = { ru: (n) => (n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 1 : 2) };
  const FEM = { ru: (w) => w.replace(/(ый|ой|ий)$/, 'ая') };
  const get = (key) => { const L = TEXT[TEXT.lang], s = L && key in L ? L[key] : TEXT.ru[key]; if (s === undefined) throw new Error('text.js: no text ' + key); return typeof s === 'string' ? s.replace(/\{@(\w+)\}/g, (m, k) => get('NAME.' + k)) : s; };
  // a fractional number goes into a text with its language's decimal mark, never JavaScript's dot (TASKS 1900: «+1.5» in Russian)
  const DEC = { ru: ',' }, num = (v, d = 1, fixed = false) => (fixed ? v.toFixed(d) : String(Math.round(v * 10 ** d) / 10 ** d)).replace('.', DEC[TEXT.lang] || '.');
  const val = (x) => (typeof x === 'number' ? num(x, 2) : String(x));
  const TXT = (key, p) => { const s = get(key); return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? val(p[k]) : m)) : s; };
  TXT.num = num;
  TXT.n = (key, n) => get(key)[(RULES[TEXT.lang] || RULES.ru)(n)];
  const fill = (v) => (typeof v === 'string' ? v.replace(/\{@(\w+)\}/g, (m, k) => get('NAME.' + k)) : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v);
  TXT.talk = (role) => fill((TEXT.talk || {})[role] || {});
  TXT.fem = (w) => (FEM[TEXT.lang] || ((x) => x))(w);
  root.TXT = TXT;
  if (typeof module !== 'undefined') module.exports = TXT;
})(typeof window !== 'undefined' ? window : globalThis);
