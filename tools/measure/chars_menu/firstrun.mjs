// the first launch as a player sees it (no ?render=1): page screenshots every ~100 ms for DUR ms, the mean luma of the whole view and
// of the menu's arch, the frame-to-frame change; a black or white flash, a jump of the arch's hero and the time to the menu are reported
//   node tools/measure/chars_menu/firstrun.mjs [--dur 9000] [--out frames/critic_chars_r1_menu/firstrun] [--save] [--slow 4]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const DUR = +opt('dur', 9000), OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r1_menu/firstrun')), SAVE = args.includes('--save'), SLOW = +opt('slow', 0);
fs.mkdirSync(OUT, { recursive: true });
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const req = createRequire(path.join(skill, 'qa.mjs'));
const { chromium } = req(process.env.PLAYWRIGHT || path.join(skill, 'node_modules/playwright'));
const TYPES = { '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.html': 'text/html' };
const server = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  // --slow k: every file k ms late, a slow disk's start
  setTimeout(() => fs.readFile(file, (err, b) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', TYPES[path.extname(file)] || 'text/html'); r.end(b); }), SLOW); });
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const t0 = Date.now();
page.goto(`http://127.0.0.1:${server.address().port}/live/index.html`).catch((e) => errors.push(String(e)));
// the luma is measured on a 96×54 copy drawn in the page: whole view and the arch's box (the hero stands at x 820–1040, y 470–760)
const shots = [];
let prev = null;
while (Date.now() - t0 < DUR) {
  let buf; try { buf = await page.screenshot({ type: 'png' }); } catch (e) { await new Promise((r) => setTimeout(r, 50)); continue; }
  const t = Date.now() - t0;
  const st = await page.evaluate(() => ({ boot: !!(document.getElementById('boot') && document.getElementById('boot').style.display !== 'none'),
    screen: window.__ready && typeof SCENE !== 'undefined' && SCENE.state ? SCENE.state.screen : null, ready: !!window.__ready })).catch(() => ({}));
  shots.push({ t, buf, st });
}
// decode with the page itself: no image library needed in node
const stat = await page.evaluate(async (list) => {
  const out = [];
  for (const b64 of list) { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = 192; cv.height = 108; const g = cv.getContext('2d'); g.drawImage(img, 0, 0, 192, 108);
    const d = g.getImageData(0, 0, 192, 108).data, lum = (x0, y0, x1, y1) => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 192 + x) * 4; s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; } return s / n; };
    const px = Array.from(d.filter((_, i) => i % 4 !== 3));
    out.push({ all: lum(0, 0, 192, 108), arch: lum(82, 47, 104, 76), px }); }
  return out;
}, shots.map((s) => s.buf.toString('base64')));
const lines = [];
let first = null;
for (let i = 0; i < shots.length; i++) {
  const s = stat[i], p = i ? stat[i - 1] : null;
  const diff = p ? s.px.reduce((a, v, k) => a + Math.abs(v - p.px[k]), 0) / s.px.length : 0;
  if (first === null && shots[i].st.screen === 'menu' && !shots[i].st.boot) first = shots[i].t;
  lines.push(`${String(shots[i].t).padStart(6)} ms  boot ${shots[i].st.boot ? 1 : 0}  screen ${shots[i].st.screen || '-'}  luma ${s.all.toFixed(1).padStart(5)}  arch ${s.arch.toFixed(1).padStart(5)}  change ${diff.toFixed(2)}`);
  if (SAVE) fs.writeFileSync(path.join(OUT, `f${String(i).padStart(3, '0')}_${shots[i].t}.png`), shots[i].buf);
}
lines.push(`menu first seen at ${first} ms; frames ${shots.length}; errors ${errors.length}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
fs.writeFileSync(path.join(OUT, `firstrun${SLOW ? '_slow' + SLOW : ''}.txt`), lines.join('\n') + '\n');
console.log(lines.join('\n'));
await browser.close(); server.close();
