import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const out = 'frames/serpentcheck'; fs.mkdirSync(out, { recursive: true });
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
    const Q = SCENE.QA(); window.serpentQA = Q;
    const frames = Q.states.filter(([n]) => n.startsWith('serpent')).map(([, s]) => s).concat(...Object.entries(Q.transitions).filter(([n]) => n.startsWith('serpent')).map(([, s]) => s));
    if (frames.some((s) => !s.run.cam.every(Number.isFinite))) throw new Error('serpent QA has a non-finite camera');
    return Q.states.filter(([n]) => n.startsWith('serpent')).map(([n]) => n);
  });
  const report = {};
  for (const name of names) {
    const result = await page.evaluate((name) => {
      const S = window.serpentQA.states.find(([n]) => n === name)[1]; SCENE.state = S; SCENE.render(S.t + 0.01);
      return { anchors: window.__ANCHORS, url: document.getElementById('c').toDataURL('image/png') };
    }, name);
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(result.url.split(',')[1], 'base64'));
    report[name] = result.anchors;
    const anchor = name === 'serpent_emit_wave' ? 'serpent_wave' : name.startsWith('serpent_emit') ? 'serpent_mouth' : name.startsWith('serpent_bite_aim') ? 'serpent_bite' : null;
    if (anchor && !result.anchors.some((a) => a.name === anchor)) errors.push(name + ': missing ' + anchor);
    for (const a of result.anchors) if (!Number.isFinite(a.d) || a.d > a.tol) errors.push(`${name}: ${a.name} misses by ${a.d.toFixed(1)} px`);
  }
  for (const name of ['serpent_tail', 'serpent_bite']) {
    const url = await page.evaluate((name) => {
      const frames = window.serpentQA.transitions[name], sheet = document.createElement('canvas'); sheet.width = 1600; sheet.height = 900;
      const ctx = sheet.getContext('2d'); ctx.imageSmoothingEnabled = false;
      [0, 20, 36, 44, 52, 60, 68, 76, 84, 96, 116, 154].forEach((index, i) => {
        const S = frames[Math.min(index, frames.length - 1)], R = S.run, e = R.en[0], z = R.zoom || DATA.ZOOM || 1; SCENE.state = S; SCENE.render(S.t + 0.01);
        ctx.drawImage(document.getElementById('c'), (e.x - R.cam[0]) * z - 210, (e.y - R.cam[1]) * z - 240, 420, 320, (i % 4) * 400, Math.floor(i / 4) * 300, 400, 300);
      });
      return sheet.toDataURL('image/png');
    }, name);
    fs.writeFileSync(path.join(out, name + '_strip.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ errors, states: report }, null, 2));
  console.log(errors.length ? errors.join('\n') : `serpentcheck: ok (${names.length} states, finite cameras, fan emitters and eight bite directions)`);
  if (errors.length) process.exitCode = 2;
} finally {
  await browser.close(); server.close();
}
