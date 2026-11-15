// node tools/measure/motion/cartsweep.mjs OUTDIR [step=8] [zoom=4] [box=150] — renders the town cart at every `step` px of its rail with the camera on it,
// crops a box round it blown up with hard pixels, writes one PNG per position plus contact sheets, and a cart.json with the rail points, view and the sprite's joints.
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const [out, STEP = '8', ZOOM = '4', BOX = '150', LOAD = '3'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const ROOT = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url));
const server = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, b) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(b); }); });
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
const info = await page.evaluate(() => { window.__Q = SCENE.QA(); const st = __Q.states.find((q) => q[0] === 'town_cart_rolling')[1]; window.__S = st; const R = st.run, pts = SCX.railPts(R.map);
  const tot = pts.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0); return { pts, tot, tile: DATA.TILE }; });
const STEPN = +STEP, Z = +ZOOM, B = +BOX, rows = [];
for (let s = 0; s <= info.tot; s += STEPN) {
  const r = await page.evaluate(([s, B, Z, load]) => { const S = __S, R = S.run, pts = SCX.railPts(R.map); Object.assign(R.cart, { s, st: 'down', load: +load }); R.offers = [];
    let d = s, x = pts[pts.length - 1][0], y = pts[pts.length - 1][1]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay); if (d <= l) { x = ax + (bx - ax) * d / l; y = ay + (by - ay) * d / l; break; } d -= l; }
    R.cam = [x - SCX.VW / 2, y - 6 - SCX.VH / 2]; LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
    const j = JSON.parse(JSON.stringify(LIB.TRACE.cart || {})), V = DATA.cartView(pts, s), c = j.ground || [960, 560], cv = document.createElement('canvas'); cv.width = cv.height = B * Z;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(document.getElementById('c'), c[0] - B / 2, c[1] - B * 0.75, B, B, 0, 0, B * Z, B * Z);
    return { s, j, V, png: cv.toDataURL('image/png') }; }, [s, B, Z, LOAD]);
  fs.writeFileSync(path.join(out, 'cart_' + String(s).padStart(4, '0') + '.png'), Buffer.from(r.png.split(',')[1], 'base64')); delete r.png; rows.push(r); }
fs.writeFileSync(path.join(out, 'cart.json'), JSON.stringify({ info, rows })); console.log('ok', rows.length, 'positions, rail', info.tot.toFixed(0), 'px', errors.slice(0, 3).join('|'));
await browser.close(); server.close();
