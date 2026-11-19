// r8: the size of each townsman's talk as the sim gives it: idle line sets (pages per line, characters per page), topics, and the Keeper's news pages
//   node tools/measure/game/talk_stats.cjs
const P = require('./play.cjs'), D = P.D;
let allp = 0, allc = 0;
for (const [role, F] of Object.entries(D.FOLK)) { if (!F.lines) { console.log(role.padEnd(10), 'no idle lines', F.topics ? 'topics ' + F.topics.length : ''); continue; }
  const pages = F.lines.map((l) => l.length), chars = F.lines.flat().map((s) => s.length); allp += chars.length; allc += chars.reduce((a, b) => a + b, 0);
  console.log(role.padEnd(10), 'idle sets', F.lines.length, 'pages/set', [...new Set(pages)].join('/'), 'chars/page avg', Math.round(chars.reduce((a, b) => a + b, 0) / chars.length), 'max', Math.max(...chars), '| topics', (F.topics || []).length, 'pages/topic', (F.topics || []).map((t) => t.a.length).join(','), 'chars max', Math.max(0, ...(F.topics || []).flatMap((t) => t.a.map((s) => s.length)))); }
const K = D.KEEPER; for (const k of ['first', 'greet', 'death1', 'death', 'win', 'away', 'end', 'endDeep']) console.log('keeper', k.padEnd(8), (K[k] || []).length, 'pages', (K[k] || []).map((s) => s.length).join(','));
console.log('page length over 260 chars (a card holds about 4 lines of 60):', Object.entries(D.FOLK).reduce((n, [r, F]) => n + (F.lines || []).flat().filter((s) => s.length > 260).length, 0));
