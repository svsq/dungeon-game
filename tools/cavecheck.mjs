import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/cavecheck'; fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready);
  const names = await page.evaluate(() => {
    window.caveQA = SCENE.QA();
    return window.caveQA.states.filter(([n]) => n.startsWith('cave_') || ['zone_cave', 'completion_85', 'win_cave'].includes(n)).map(([n]) => n);
  });
  for (const required of ['cave_spring', 'cave_breach', 'cave_hall', 'cave_crossing', 'zone_cave', 'win_cave']) if (!names.includes(required)) errors.push('missing state ' + required);
  const report = {};
  for (const name of names) {
    const result = await page.evaluate((name) => {
      const S = structuredClone(window.caveQA.states.find(([n]) => n === name)[1]);
      SCENE.state = S; SCENE.render(S.t + 0.01);
      const canvas = document.getElementById('c'), url = canvas.toDataURL();
      SCENE.render(S.t + 0.01);
      const R = S.run, m = R && R.map, h = R && R.hero;
      return { url, deterministic: url === canvas.toDataURL(), seed: m && m.seed, floor: R && R.floor, t: S.t, cam: R && R.cam,
        hero: h && [h.x, h.y], heroCell: h && SIM.cell(m, Math.floor(h.x / DATA.TILE), Math.floor(h.y / DATA.TILE)), hints: R && SIM.completionHints(R).map((o) => o.kind) };
    }, name);
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(result.url.split(',')[1], 'base64'));
    delete result.url; report[name] = result;
    if (!result.deterministic) errors.push(name + ': repeated frame changed');
    if (['cave_spring', 'cave_breach'].includes(name) && result.heroCell !== 1) errors.push(name + ': hero off walkable floor');
    if (result.hints && result.hints.includes('secret')) errors.push(name + ': secret hint remains');
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ states: report, errors }, null, 2));
} finally { await browser.close(); server.close(); }
console.log(errors.length ? errors.join('\n') : 'cavecheck: ok');
if (errors.length) process.exitCode = 2;
