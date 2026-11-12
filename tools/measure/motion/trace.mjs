// node tools/measure/motion/trace.mjs out.json name1,name2,... — per frame joint trace (LIB.TRACE.en990 or hero) of SCENE.QA() transitions/cycles/loops plus entity fields
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const [out, names, sub = 'en990'] = process.argv.slice(2);
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
const res = await page.evaluate(([names, sub]) => { const Q = SCENE.QA(), R = {};
  for (const name of names.split(',')) { const list = Q.cycles[name] || (Q.transitions || {})[name] || (Q.loops || {})[name]; if (!list) { R[name] = null; continue; }
    const id = Q.subject[name] || sub, rows = [];
    for (let i = 0; i < list.length; i++) { const S = list[i]; LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const j = LIB.TRACE[id] || {};
      const e = S.run && S.run.en && S.run.en.find((e) => 'en' + e.id === id);
      const pick = {}; if (e) for (const k of Object.keys(e)) { const v = e[k]; if (typeof v === 'number' || typeof v === 'string') pick[k] = v; }
      rows.push({ i, t: S.t, j: JSON.parse(JSON.stringify(j)), e: pick, ev: (S.ev || []).filter((v) => v.t > S.t - 1 / 60 - 1e-6).map((v) => v.k) }); }
    R[name] = { id, rows }; }
  return R; }, [names, sub]);
fs.writeFileSync(out, JSON.stringify(res)); console.log('ok', Object.keys(res).map((k) => k + ':' + (res[k] ? res[k].rows.length : 'none')).join(' '), errors.slice(0, 3).join('|'));
await browser.close(); server.close();
