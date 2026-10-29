import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
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
  const cycles = await page.evaluate(() => {
    const Q = SCENE.QA(), out = {};
    for (const [kind, name] of [...Object.keys(Q.cycles).map((n) => ['cycles', n]), ...Object.keys(Q.loops || {}).map((n) => ['loops', n]), ...Object.keys(Q.transitions || {}).filter((n) => n === 'crab_turning').map((n) => ['transitions', n])].filter(([, n]) => n.startsWith('crab'))) {
      const id = Q.subject[name], fr = [], sheet = name === 'crab_turning' ? document.createElement('canvas') : null;
      const sample = [0, 17, 18, 34, 49, 65, 90, 120, 150, 160, 170, 179];
      if (sheet) { sheet.width = 960; sheet.height = 480; }
      for (const st of Q[kind][name]) { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id], cam = st.run.cam || [0, 0];
        const index = sample.indexOf(fr.length);
        if (sheet && j && index >= 0) sheet.getContext('2d').drawImage(document.getElementById('c'), j.ground[0] - 120, j.ground[1] - 110, 240, 160, index % 4 * 240, Math.floor(index / 4) * 160, 240, 160);
        fr.push(j ? Object.fromEntries(Object.entries(j).map(([k, v]) => [k, [v[0] + cam[0], v[1] + cam[1]]])) : null); }
      LIB.TRACE = null; out[name] = { loop: kind === 'loops', fr, sheet: sheet && sheet.toDataURL() };
    }
    return out;
  });
  fs.mkdirSync('frames/crabcheck', { recursive: true });
  for (const [name, c] of Object.entries(cycles)) if (c.sheet) fs.writeFileSync('frames/crabcheck/' + name + '.png', Buffer.from(c.sheet.split(',')[1], 'base64'));
  if (!cycles.crab_turning || cycles.crab_turning.fr.length < 120) errors.push('missing moving turn trace');
  for (const [name, { fr }] of Object.entries(cycles)) if (!fr.length || fr.some((f) => !f || !f.hip || !Array.from({ length: 6 }, (_, i) => f['foot' + i]).every(Boolean))) throw new Error(name + ': incomplete crab joint trace');
  const report = {};
  for (const [name, { fr }] of Object.entries(cycles)) {
    if (name !== 'crab_turning') continue;
    const H = fr[0].ground[1] - fr[0].top[1]; let jump = 0, at = '';
    const relative = (f, k) => [f[k][0] - f.ground[0], f[k][1] - f.ground[1]];
    for (let i = 2; i < fr.length; i++) for (const k of Object.keys(fr[i])) {
      const a = relative(fr[i], k), b = relative(fr[i - 1], k), c = relative(fr[i - 2], k), d = Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1]);
      if (d > jump) { jump = d; at = k + ' @' + i; }
    }
    report[name] = { jump, at, height: H, limit: H * 0.06 };
    if (jump > H * 0.06) errors.push(name + ': pose acceleration pop ' + jump.toFixed(2) + ' at ' + at);
  }
  fs.mkdirSync('frames/crabcheck', { recursive: true }); fs.writeFileSync('frames/crabcheck/report.json', JSON.stringify(report, null, 2));
  // a foot standing on the floor keeps its place in the world while the body walks over it: of each foot's frame-to-frame world moves,
  // the quietest 40 % must be under 25 % of the body's own move
  // standing, a crab turning on the spot sets its feet down: each stays put for at least half of the frames
  for (const [name, { loop, fr: all }] of Object.entries(cycles)) { if (!loop) continue; const fr = all.slice(60);
    const rest = []; for (let l = 0; l < 6; l++) { let still = 0; for (let i = 1; i < fr.length; i++) if (Math.hypot(fr[i]['foot' + l][0] - fr[i - 1]['foot' + l][0], fr[i]['foot' + l][1] - fr[i - 1]['foot' + l][1]) < 0.3) still++; rest.push(still / (fr.length - 1)); }
    if (process.env.DUMP) console.log(fr.map((f, i) => i && [0, 1].map((l) => Math.hypot(f['foot' + l][0] - fr[i - 1]['foot' + l][0], f['foot' + l][1] - fr[i - 1]['foot' + l][1]).toFixed(2)).join('/') + ' hip ' + Math.hypot(f.hip[0] - fr[i - 1].hip[0], f.hip[1] - fr[i - 1].hip[1]).toFixed(2)).slice(1, 60).join('\n'));
    const w = Math.min(...rest); console.log(`${name}: feet at rest ${rest.map((x) => (x * 100).toFixed(0)).join(' ')} % of the frames`);
    if (w < 0.5) errors.push(`${name}: a foot is at rest in only ${(w * 100).toFixed(0)} % of the frames of the turn (min 50 %)`); }
  for (const [name, { loop, fr }] of Object.entries(cycles)) { if (loop) continue;
    const body = []; for (let i = 1; i < fr.length; i++) body.push(Math.hypot(fr[i].hip[0] - fr[i - 1].hip[0], fr[i].hip[1] - fr[i - 1].hip[1]));
    const v = body.reduce((a, b) => a + b, 0) / body.length, worst = [];
    for (let l = 0; l < 6; l++) { const sp = []; for (let i = 1; i < fr.length; i++) sp.push(Math.hypot(fr[i]['foot' + l][0] - fr[i - 1]['foot' + l][0], fr[i]['foot' + l][1] - fr[i - 1]['foot' + l][1]));
      sp.sort((a, b) => a - b); const q = sp[Math.floor(sp.length * 0.4)]; worst.push(q / v); }
    const w = Math.max(...worst); console.log(`${name}: body ${v.toFixed(2)} px/frame, quietest foot moves ${(w * 100).toFixed(0)} % of it (${worst.map((x) => (x * 100).toFixed(0)).join(' ')})`);
    if (w > 0.25) errors.push(`${name}: a standing foot slides at ${(w * 100).toFixed(0)} % of the body's speed (max 25 %)`);
  }
} finally { await browser.close(); server.close(); }
console.log(errors.length ? errors.join('\n') : 'crabcheck: ok');
if (errors.length) process.exitCode = 2;
