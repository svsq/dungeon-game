// shot.mjs <setup.js> <outdir>: setup.js runs in the page (render=1) and fills window.__SHOTS = [[name, S, t?, hide?]...]; hide → SCENE.hide
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const skill = path.join(process.env.HOME, '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'x.js'))(path.join(skill, 'node_modules/playwright'));
const [setup, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const root = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url)), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'log') errors.push(m.text()); });
await p.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`);
await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
await p.evaluate(fs.readFileSync(setup, 'utf8'));
const names = await p.evaluate(() => window.__SHOTS.map((s) => s[0]));
for (let i = 0; i < names.length; i++) {
  const r = await p.evaluate((i) => { const [, S, t, hide] = window.__SHOTS[i]; SCENE.state = S; SCENE.hide = Object.assign({}, hide || {}); try { SCENE.render(t ?? S.t + 0.01); } catch (e) { SCENE.hide = {}; return { err: e.message }; } SCENE.hide = {}; return { url: document.getElementById('c').toDataURL('image/png'), info: window.__INFO ? window.__INFO[i] : null }; }, i);
  if (r.err) { console.log(names[i], 'ERR', r.err); continue; }
  fs.writeFileSync(path.join(out, names[i] + '.png'), Buffer.from(r.url.split(',')[1], 'base64')); console.log(names[i], JSON.stringify(r.info));
}
console.log('page:', errors.slice(0, 10).join(' | ')); await browser.close(); srv.close();
