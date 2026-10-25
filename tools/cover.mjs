import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || path.join(os.homedir(), '.claude/skills/ref2game/scripts/node_modules/playwright'));
const args = process.argv.slice(2), option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const out = option('--out', 'docs/cover.png'), zoom = Number(option('--zoom', '1.25'));
fs.mkdirSync(path.dirname(out), { recursive: true });
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let browser;
const errors = [];
try {
  browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await browser.newPage({ viewport: { width: 1320, height: 660 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const metrics = await p.evaluate((zoom) => {
    const S = SCENE.QA().states.find(([name]) => name === 'match')[1], R = S.run, h = R.hero;
    R.zoom = zoom; R.cam = [h.x - 1920 / zoom * 0.5, h.y - 1080 / zoom * 0.58];
    HUD.draw = () => {}; SCENE.state = S; SCENE.render(S.t + 0.01);
    document.body.innerHTML = '<main id="cover"></main>';
    const cover = document.getElementById('cover'); cover.appendChild(G.gl.canvas);
    const title = document.createElement('header');
    title.innerHTML = '<h1>ГЛУБИНЫ КРИПТЫ</h1><p>Спуститесь на восемь этажей и одолейте Повелителя Демонов</p>';
    cover.appendChild(title);
    const style = document.createElement('style');
    style.textContent = `
      html, body { margin: 0; width: 1320px; height: 660px; overflow: hidden; background: #050406; }
      #cover { position: relative; width: 1320px; height: 660px; overflow: hidden; }
      #cover canvas { position: absolute; display: block; width: 1320px; height: 742.5px; left: 0; top: -41.25px; image-rendering: pixelated; }
      #cover::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(5,3,5,.94), rgba(8,4,5,.72) 100px, rgba(8,4,5,.25) 175px, transparent 240px, transparent 88%, rgba(5,3,5,.35)); }
      header { position: absolute; z-index: 1; top: 22px; left: 24px; right: 24px; text-align: center; }
      h1 { margin: 0; color: #ffda78; font: 900 82px/1.1 'Arial Black', Arial, sans-serif; letter-spacing: 2px; text-shadow: 0 3px 0 #361305, 0 0 24px #351001, 3px 0 0 #210e07, -3px 0 0 #210e07; }
      p { margin: 10px 0 0; color: #e3d0a7; font: 700 25px/1.25 'Trebuchet MS', Arial, sans-serif; text-shadow: 0 2px 5px #050406, 0 0 8px #050406; }
    `;
    document.head.appendChild(style);
    return [...title.children].map((node) => { const r = node.getBoundingClientRect(); return { text: node.textContent, x: r.x, y: r.y, width: r.width, height: r.height, scroll: node.scrollWidth }; });
  }, zoom);
  await p.evaluate(() => document.fonts.ready);
  for (const m of metrics) if (m.x < 0 || m.y < 0 || m.x + m.width > 1320 || m.scroll > m.width || m.y + m.height > 175) errors.push('cover text overflow: ' + m.text);
  if (errors.length) throw new Error(errors.join('\n'));
  await p.screenshot({ path: out, animations: 'disabled' });
  console.log(JSON.stringify({ out, width: 1320, height: 660, zoom, errors }));
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
