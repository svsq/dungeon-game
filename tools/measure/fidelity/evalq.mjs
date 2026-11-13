// node evalq.mjs code.js [out.json]: runs the body of code.js in the page (SCENE, SIM, DATA, LIB available; returns JSON), prints / saves it; images returned as {png:{name:dataURL}} are saved next to out
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const [code, out] = process.argv.slice(2); const body = fs.readFileSync(code, 'utf8');
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => { const file = path.join((process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url))), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, b) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(b); }); });
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
const res = await page.evaluate(new Function(body));
if (res && res.png) { for (const [n, u] of Object.entries(res.png)) fs.writeFileSync(path.join(path.dirname(out || '.'), n + '.png'), Buffer.from(u.split(',')[1], 'base64')); delete res.png; }
const s = JSON.stringify(res); if (out) fs.writeFileSync(out, s); console.log(s.slice(0, 4000), errors.slice(0, 3).join('|'));
await browser.close(); server.close();
