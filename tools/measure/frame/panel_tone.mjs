// the main menu's two parchment sheets, the items' (m_sheet) and the version's (nf_p), are one paper (TASKS 1983): the median Lab
// of each sheet's writing box, the ΔE76 between them; exit 2 over the limit
//   node tools/measure/frame/panel_tone.mjs [--states menu,menu_continue] [--max 4]
// the median, not the mean: the ink, the rules and the seal cover a different share of each sheet
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const states = opt('states', 'menu,menu_continue').split(','), MAX = +opt('max', 4);
const root = process.env.ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => {
  const file = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
let bad = 0;
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  for (const name of states) {
    const r = await page.evaluate((name) => {
      const st = (SCENE.QA().states.find((q) => q[0] === name) || [])[1]; if (!st) return null;
      SCENE.state = st; SCENE.render(st.t + 0.01);
      const c = document.getElementById('c'), g = Object.assign(document.createElement('canvas'), { width: c.width, height: c.height }).getContext('2d');
      g.drawImage(c, 0, 0); const sx = c.width / SIM.VIEW.W, sy = c.height / SIM.VIEW.H;
      const lin = (v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4, f = (t) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
      const lab = (R, G, B) => { const r = lin(R), gg = lin(G), b = lin(B);
        const x = f((0.4124 * r + 0.3576 * gg + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * gg + 0.0722 * b), z = f((0.0193 * r + 0.1192 * gg + 0.9505 * b) / 1.08883);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; };
      const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
      const tone = (id) => { const q = (window.__UI || []).find((u) => u.k === 'box' && u.id === id); if (!q) return null;
        const x0 = Math.round(q.x * sx), y0 = Math.round(q.y * sy), w = Math.round(q.w * sx), h = Math.round(q.h * sy), d = g.getImageData(x0, y0, w, h).data, ch = [[], [], []];
        for (let i = 0; i < d.length; i += 4) lab(d[i], d[i + 1], d[i + 2]).forEach((v, k) => ch[k].push(v));
        return ch.map(med); };
      return { a: tone('m_sheet'), b: tone('nf_p') };
    }, name);
    if (!r || !r.a || !r.b) { console.log(name, 'no state or no sheet'); bad = 1; continue; }
    const dE = Math.hypot(r.a[0] - r.b[0], r.a[1] - r.b[1], r.a[2] - r.b[2]), f1 = (v) => v.map((x) => x.toFixed(1)).join(' ');
    console.log(`${name}: items Lab ${f1(r.a)}  version Lab ${f1(r.b)}  ΔE ${dE.toFixed(2)}${dE > MAX ? '  OVER ' + MAX : ''}`);
    if (dE > MAX) bad = 1;
  }
} finally { await browser.close(); server.close(); }
process.exit(bad ? 2 : 0);
