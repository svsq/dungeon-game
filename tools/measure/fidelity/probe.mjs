// node probe.mjs "stateName" "js expr over S (state) returning JSON-able"
import { fileURLToPath } from 'node:url';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(process.env.HOME + '/.claude/skills/ref2game/scripts/package.json'); const { chromium } = require('playwright');
const [name, expr] = process.argv.slice(2);
const root = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url)), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((r0, r) => { const f = path.join(root, decodeURIComponent(r0.url.split('?')[0])); fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`); await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
const r = await p.evaluate(([n, ex]) => { const Q = SCENE.QA(); const s = Q.states.find((x) => x[0] === n)[1]; return JSON.stringify((new Function('S', 'return ' + ex))(s)); }, [name, expr]);
console.log(r); await browser.close(); srv.close();
