import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || path.join(skill, 'node_modules/playwright'));
const out = 'frames/bossvis', root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((q, r) => {
  const file = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => {
    r.writeHead(err ? 404 : 200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    r.end(err ? '' : bytes);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(() => {
    const qa = SCENE.QA(), cv = document.getElementById('c'), copy = document.createElement('canvas');
    copy.width = cv.width; copy.height = cv.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    const grab = (S) => { SCENE.state = S; SCENE.render(S.t + 0.01); ctx.drawImage(cv, 0, 0); return ctx.getImageData(0, 0, cv.width, cv.height).data; };
    return ['queen_crown', 'spider_eggs'].map((asset) => {
      const S = qa.states.find(([name]) => name === 'arena_boss_spider_eggs')[1];
      const before = grab(S), frame = cv.toDataURL(), sprite = LIB.sprite;
      let after;
      try {
        LIB.sprite = (name, ...args) => name === asset ? { w: 0, h: 0 } : sprite(name, ...args);
        after = grab(S);
      } finally { LIB.sprite = sprite; }
      let pixels = 0;
      for (let i = 0; i < before.length; i += 4) {
        const diff = Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]);
        if (diff > 24) pixels++;
      }
      return { asset, pixels, frame };
    });
  });
  for (const item of result) {
    fs.writeFileSync(path.join(out, item.asset + '.png'), Buffer.from(item.frame.split(',')[1], 'base64'));
    console.log(`${item.asset}: ${item.pixels} visible pixels`);
    if (item.pixels < 100) errors.push(`${item.asset}: silhouette disappears at play scale`);
  }
  for (const error of errors) console.error(error);
  console.log(errors.length ? 'bossvis: FAIL' : 'bossvis: ok');
  process.exitCode = errors.length ? 2 : 0;
} finally {
  await browser.close();
  server.close();
}
