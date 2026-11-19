// node tools/measure/frames2168/margins.mjs [--states load_full,classes,inv,play,load_gap] [--out frames/fix_2168/margins_after.json]
// Task 2168: every hero portrait the frame draws and the dark well left round it inside its frame. Per portrait (the sprites named
// portrait*): its drawn rect, the run of well pixels (all channels < --dark) from each of its edges outward to the frame, and the
// art's stretch (the src crop's aspect over the drawn rect's, 1 = none). A table on stdout, the rows as JSON in --out.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const root = process.env.ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const states = opt('states', 'load_full,load_gap,classes,inv,play').split(','), out = opt('out', 'frames/fix_2168/margins.json'), DARK = +opt('dark', 52);
fs.mkdirSync(path.dirname(out), { recursive: true });

const server = http.createServer((q, r) => { const file = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); }); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const rows = [];
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__Q = SCENE.QA(); const sp = LIB.sprite; window.__PORTS = [];
    LIB.sprite = (n, x, y, o = {}) => { if (/^portrait/.test(n)) window.__PORTS.push({ n, x, y, w: o.w, h: o.h, src: o.src || [0, 0, 1, 1] }); return sp(n, x, y, o); }; });
  for (const name of states) {
    const res = await page.evaluate(([name, DARK]) => { const st = (__Q.states.find((q) => q[0] === name) || [])[1]; if (!st) return null;
      window.__PORTS = []; SCENE.state = st; SCENE.render(st.t + 0.01);
      const c = document.getElementById('c'), cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height;
      const g = cv.getContext('2d'); g.drawImage(c, 0, 0); const k = c.width / 1920, img = g.getImageData(0, 0, cv.width, cv.height).data;
      const dark = (x, y) => { const i = (Math.round(y * k) * cv.width + Math.round(x * k)) * 4; return Math.max(img[i], img[i + 1], img[i + 2]) < DARK; };
      const run = (x, y, dx, dy) => { let n = 0; while (n < 40 && dark(x + dx * n, y + dy * n)) n++; return n; };
      return window.__PORTS.map((p) => { const cx = p.x + p.w / 2, cy = p.y + p.h / 2, T = G.tex(p.n), sa = ((p.src[2] - p.src[0]) * T.w) / ((p.src[3] - p.src[1]) * T.h);
        return { state: name, tex: p.n, rect: [p.x, p.y, p.w, p.h].map((v) => Math.round(v * 10) / 10), top: run(cx, Math.round(p.y) - 1, 0, -1), bottom: run(cx, Math.round(p.y + p.h), 0, 1),
          left: run(Math.round(p.x) - 1, cy, -1, 0), right: run(Math.round(p.x + p.w), cy, 1, 0), stretch: Math.round((sa / (p.w / p.h)) * 1000) / 1000, src: p.src.map((v) => Math.round(v * 1000) / 1000) }; }); }, [name, DARK]);
    if (!res) { console.log('no state', name); continue; }
    for (const r of res) { rows.push(r); console.log(`${r.state.padEnd(12)} ${r.tex.padEnd(16)} rect ${r.rect.join(',').padEnd(24)} well top ${r.top} bottom ${r.bottom} left ${r.left} right ${r.right}  |top-bottom| ${Math.abs(r.top - r.bottom)}  stretch ${r.stretch}`); }
  }
  fs.writeFileSync(out, JSON.stringify(rows, null, 1));
} finally { if (errors.length) console.log('errors:', errors.slice(0, 5).join(' | ')); await browser.close(); server.close(); }
