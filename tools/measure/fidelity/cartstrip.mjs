// the mine cart along its rails: one zoomed crop round the cart per rope length s, from the town_cart_rolling QA state
//   node tools/measure/fidelity/cartstrip.mjs frames/critic_r8_fidelity/cart [s0,s1,...] [box] [zoom]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = process.argv[2] || 'frames/cartstrip', S = (process.argv[3] || '0,20,40,70,100,130,160,200,240,280,320,360').split(',').map(Number);
const BOX = +(process.argv[4] || 110), Z = +(process.argv[5] || 4);
fs.mkdirSync(out, { recursive: true });
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => {
  const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__Q = SCENE.QA(); });
  const info = [];
  for (const s of S) {
    const r = await page.evaluate(([s, BOX, Z]) => {
      const st = __Q.states.find((q) => q[0] === 'town_cart_rolling')[1]; SCENE.state = st; const R = st.run; R.cart.s = s; R.cart.st = 'down';
      LIB.TRACE = {}; SCENE.render(st.t + 0.01); const j = LIB.TRACE.cart; if (!j) return null;
      const V = DATA.cartView(DATA.railPts(R.map), s), c = j.ground, cv = document.createElement('canvas'); cv.width = cv.height = BOX * Z;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(document.getElementById('c'), c[0] - BOX / 2, c[1] - BOX * 0.7, BOX, BOX, 0, 0, BOX * Z, BOX * Z);
      return { url: cv.toDataURL('image/png'), V, ground: c };
    }, [s, BOX, Z]);
    if (!r) { console.log('no cart at', s); continue; }
    fs.writeFileSync(path.join(out, `s${String(s).padStart(4, '0')}.png`), Buffer.from(r.url.split(',')[1], 'base64'));
    info.push({ s, ...r.V, ground: r.ground }); console.log(s, JSON.stringify(r.V), r.ground.map(Math.round).join(','));
  }
  fs.writeFileSync(path.join(out, 'views.json'), JSON.stringify(info, null, 1));
  // the hero's back in the open, on zone_town's own camera (hero at the frame's middle), cropped and blown up
  for (const back of [1, 0]) {
    const url = await page.evaluate(([back, Z]) => { const st = __Q.states.find((q) => q[0] === 'zone_town')[1]; SCENE.state = st; st.run.hero.back = back; SCENE.render(st.t + 0.01);
      const cv = document.createElement('canvas'), B = 160; cv.width = cv.height = B * Z; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      g.drawImage(document.getElementById('c'), 885, 440, B, B, 0, 0, B * Z, B * Z); return cv.toDataURL('image/png'); }, [back, Z]);
    fs.writeFileSync(path.join(out, back ? 'hero_back.png' : 'hero_front.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
} finally { await browser.close(); server.close(); }
