// renders chosen SCENE.QA() states whole and chosen cycles / transitions as contact sheets round their subject (TASKS 407–409)
//   node tools/qashot.mjs [--states a,b] [--sheets c,d] [--n 12] [--box 260] [--view 1280x720] [--out frames/qashot]
//   --view: the browser window size; the canvas is drawn at 1920×1080 and scaled by the page, as a player on that screen sees it
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', 'frames/qashot'), tweak = opt('eval', ''), states = opt('states', '').split(',').filter(Boolean), sheets = opt('sheets', '').split(',').filter(Boolean), N = +opt('n', 12), F0 = +opt('from', -1), F1 = +opt('to', -1), BOX = +opt('box', 260);
fs.mkdirSync(out, { recursive: true });
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const [VW, VH] = opt('view', '1920x1080').split('x').map(Number), page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__Q = SCENE.QA(); });
  for (const name of states) {
    const ok = await page.evaluate(([name, tweak]) => { const st = (__Q.states.find((q) => q[0] === name) || [])[1]; if (!st) return false; if (tweak) new Function('S', tweak)(st); SCENE.state = st; SCENE.render(st.t + 0.01); return true; }, [name, tweak]);
    if (!ok) { console.log('no state', name); continue; }
    await page.locator('#c').screenshot({ path: path.join(out, name + '.png') }); console.log('state', name);
  }
  for (const name of sheets) {
    const url = await page.evaluate(([name, N, BOX, F0, F1]) => {
      const list = __Q.cycles[name] || (__Q.transitions || {})[name] || (__Q.loops || {})[name]; if (!list) return null;
      const id = __Q.subject[name] || 'en990', cols = Math.min(N, 6), rows = Math.ceil(N / cols), sheet = document.createElement('canvas'); sheet.width = cols * BOX; sheet.height = rows * BOX;
      const g = sheet.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, sheet.width, sheet.height);
      for (let i = 0; i < N; i++) { const st = list[F0 >= 0 ? Math.min(list.length - 1, F0 + Math.round(i * (F1 - F0) / Math.max(1, N - 1))) : Math.min(list.length - 1, Math.round(i * (list.length - 1) / Math.max(1, N - 1)))]; LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
        const j = LIB.TRACE[id], c = j && j.ground ? j.ground : [960, 540];
        g.drawImage(document.getElementById('c'), c[0] - BOX / 2, c[1] - BOX * 0.7, BOX, BOX, (i % cols) * BOX, Math.floor(i / cols) * BOX, BOX, BOX); }
      return sheet.toDataURL('image/png'); }, [name, N, BOX, F0, F1]);
    if (!url) { console.log('no sheet', name); continue; }
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64')); console.log('sheet', name);
  }
} finally { if (errors.length) console.log('errors:', errors.slice(0, 5).join(' | ')); await browser.close(); server.close(); }
