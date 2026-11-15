// node tools/measure/perf/packcheck.cjs [dir]
// Task 2040: what pack.py (skill, line 29: every live/*.js) ships against what the page loads (live/modules.js `page`, plus index.html).
// With a dir (a built desktop/game or a pack's game/ folder) it also lists which of the unloaded files are there.
const fs = require('fs'), path = require('path');
const root = process.env.ROOT || path.resolve(__dirname, '../../..'), live = path.join(root, 'live');
const { page } = require(path.join(live, 'modules.js'));
const html = fs.readFileSync(path.join(live, 'index.html'), 'utf8');
const loaded = new Set(['modules.js', ...page, ...[...html.matchAll(/src="([^"?]+\.js)/g)].map((m) => m[1])]);
const shipped = fs.readdirSync(live).filter((f) => f.endsWith('.js')), size = (f) => fs.statSync(path.join(live, f)).size;
const extra = shipped.filter((f) => !loaded.has(f)), total = shipped.reduce((a, f) => a + size(f), 0), dead = extra.reduce((a, f) => a + size(f), 0);
console.log(`pack.py copies ${shipped.length} live/*.js files, ${(total / 1048576).toFixed(2)} MB; the page loads ${shipped.length - extra.length} of them`);
console.log(`never loaded by the page, but shipped: ${extra.length} files, ${(dead / 1048576).toFixed(2)} MB (${(100 * dead / total).toFixed(1)} % of the JS)`);
for (const f of extra.sort((a, b) => size(b) - size(a))) console.log('  ', String(size(f)).padStart(8), f);
const dir = process.argv[2];
if (dir) { const there = extra.filter((f) => fs.existsSync(path.join(dir, f))); console.log(`in ${dir}: ${there.length} of them present`); }
