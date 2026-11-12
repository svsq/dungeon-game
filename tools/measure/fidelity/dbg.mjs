import { fileURLToPath } from 'node:url';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(process.env.HOME + '/.claude/skills/ref2game/scripts/package.json'); const { chromium } = require('playwright');
const root = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url)), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((a, r) => { const f = path.join(root, decodeURIComponent(a.url.split('?')[0])); fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`); await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
console.log(await p.evaluate(() => { SCENE.QA(); const mean = (S) => { SCENE.state = S; SCENE.render(S.t + 0.01); const c = document.createElement('canvas'); c.width = 96; c.height = 54; const x = c.getContext('2d'); x.drawImage(document.getElementById('c'), 0, 0, 96, 54); const d = x.getImageData(38, 17, 20, 20).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]; return +(s / (d.length / 4)).toFixed(1); };
  const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 77, { town: 1 }); S.screen = 'play'; const out = [];
  for (let i = 0; i < 30; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); out.push(['town', mean(S)]);
  for (const f of [1, 2, 12, 13]) { SIM.enterFloor(S, S.run, f); const R = S.run; out.push([f, 'im', mean(S), R.cam.map(Math.round), R.hero.x, R.hero.y, S.t.toFixed(2)]); for (let i = 0; i < 30; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); out.push([f, '0.5s', mean(S), R.cam.map(Math.round), R.hero.x|0, R.hero.y|0, S.screen, R.hero.hp, R.hero.deadT]); }
  return JSON.stringify(out); }));
await browser.close(); srv.close();
