// every animation frame of the first launch (no ?render=1), seen from inside the page: whether the start's screen is up, the canvas's
// mean luma and its arch's luma on a 48×27 copy; a frame the player sees black (start's screen gone, canvas dark) or a jump is listed
//   node tools/measure/chars_menu/bootframes.mjs [--dur 6000] [--slow 0] [--out frames/critic_chars_r1_menu/firstrun]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const DUR = +opt('dur', 6000), SLOW = +opt('slow', 0), OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r1_menu/firstrun'));
fs.mkdirSync(OUT, { recursive: true });
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(process.env.PLAYWRIGHT || path.join(skill, 'node_modules/playwright'));
const TYPES = { '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.html': 'text/html' };
const server = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  setTimeout(() => fs.readFile(file, (err, b) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', TYPES[path.extname(file)] || 'text/html'); r.end(b); }), SLOW); });
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.__F = []; const t0 = performance.now(), cv = document.createElement('canvas'); cv.width = 48; cv.height = 27; let g = null;
  const tick = () => { const boot = document.getElementById('boot'), c = document.getElementById('c');
    const up = !!(boot && boot.style.display !== 'none' && getComputedStyle(boot).display !== 'none');
    let all = -1, arch = -1;
    if (c && c.width) { try { g = g || cv.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, 48, 27); g.drawImage(c, 0, 0, 48, 27); const d = g.getImageData(0, 0, 48, 27).data;
      let s = 0, a = 0, na = 0; for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += l; const p = i / 4, x = p % 48, y = (p - x) / 48; if (x >= 20 && x < 26 && y >= 11 && y < 19) { a += l; na++; } }
      all = s / (d.length / 4); arch = a / na; } catch (e) {} }
    window.__F.push({ t: Math.round(performance.now() - t0), up, all: +all.toFixed(1), arch: +arch.toFixed(1), screen: typeof SCENE !== 'undefined' && SCENE.state ? SCENE.state.screen : null });
    requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html`);
await page.waitForTimeout(DUR);
const F = await page.evaluate(() => window.__F);
const lines = [], bad = [];
let firstMenu = null, lastBoot = null, maxGap = 0, gapAt = 0;
for (let i = 0; i < F.length; i++) { const f = F[i], p = F[i - 1];
  if (f.up) lastBoot = f.t;
  if (firstMenu === null && !f.up && f.screen === 'menu' && f.all > 5) firstMenu = f.t;
  if (p && f.t - p.t > maxGap) { maxGap = f.t - p.t; gapAt = p.t; }
  if (!f.up && f.all >= 0 && f.all < 5) bad.push(`${f.t} ms: start's screen gone, canvas black (luma ${f.all})`);
  if (p && !f.up && !p.up && p.all > 5 && Math.abs(f.all - p.all) > 8) bad.push(`${f.t} ms: jump ${p.all} → ${f.all}`);
  if (p && !f.up && !p.up && p.arch > 5 && Math.abs(f.arch - p.arch) > 10) bad.push(`${f.t} ms: arch jump ${p.arch} → ${f.arch}`);
  if (i < 400 && (!p || p.up !== f.up || p.screen !== f.screen || i % 20 === 0)) lines.push(`${String(f.t).padStart(6)} ms  boot ${f.up ? 1 : 0}  screen ${f.screen || '-'}  luma ${f.all}  arch ${f.arch}`); }
const fps = F.filter((f) => f.t > (firstMenu || 0) + 500).length / Math.max(1, (F[F.length - 1].t - (firstMenu || 0) - 500) / 1000);
lines.push(`frames ${F.length}; start's screen last up at ${lastBoot} ms; menu first drawn at ${firstMenu} ms; longest frame gap ${maxGap} ms after ${gapAt} ms; menu fps ${fps.toFixed(1)}`);
lines.push(`flags: ${bad.length ? bad.slice(0, 20).join(' | ') : 'none'}`, `errors: ${errors.length ? errors.join(' | ') : 'none'}`);
fs.writeFileSync(path.join(OUT, `bootframes${SLOW ? '_slow' + SLOW : ''}.txt`), lines.join('\n') + '\n');
console.log(lines.join('\n'));
await browser.close(); server.close();
