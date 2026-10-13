// node tools/lootvis.mjs [--out frames/lootvis] — every item of loot lying on the floor must be seen. On several floors of a few
// campaigns, every secret is opened and every chest emptied; once the items settle, each one is rendered with and without its sprite (its light
// kept) and the change in a box around it is measured. A prop drawn over it, or a dark tinted room it vanishes into, shows as a small change.
// Writes a crop of each failure. Exit 2 when an item changes its box by less than MIN.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/lootvis';
const MIN = 20000;   // summed RGB change in the 60×60 box: a clearly drawn item gives 40k and more, the hidden ones measured 0–18k
fs.mkdirSync(out, { recursive: true });
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`);
await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
const res = await p.evaluate((MIN) => {
  const out = [], Z = DATA.ZOOM, cv = document.getElementById('c'), g = document.createElement('canvas'); g.width = 1920; g.height = 1080;
  const gx = g.getContext('2d', { willReadFrequently: true });
  const grab = (S, x, y) => { SCENE.state = S; SCENE.render(S.t + 0.01); gx.drawImage(cv, 0, 0); const X = Math.round((x - S.run.cam[0]) * Z), Y = Math.round((y - S.run.cam[1]) * Z);
    return { px: gx.getImageData(X - 30, Y - 50, 60, 60).data, X, Y }; };
  let n = 0;
  for (const sd of [1, 2, 3, 4, 5, 6]) for (const f of [1, 3, 5, 7]) {
    const S = SIM.spawn(0, {}); SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', sd); if (f > 1) SIM.enterFloor(S, S.run, f); S.screen = 'play';
    const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9; R.seen = R.seen.map(() => 1); for (const q of R.map.secrets) SIM.openSecret(S, R, q, true);
    for (const c of R.chests) SIM.openChest(S, R, c); h.x = -9999; h.y = -9999; for (let k = 0; k < 150; k++) SIM.step(S, { keys: [], px: 960, py: 540 }); R.msg = null; S.ev = [];
    for (const d of R.drops.filter((o) => o.kind === 'item' && !o.got)) { n++; R.cam = [d.x - 640, d.y - 360];
      const a = grab(S, d.x, d.y), crop = cv.toDataURL(); d.qaHide = 1; const b = grab(S, d.x, d.y); delete d.qaHide;
      let diff = 0; for (let k = 0; k < a.px.length; k += 4) diff += Math.abs(a.px[k] - b.px[k]) + Math.abs(a.px[k + 1] - b.px[k + 1]) + Math.abs(a.px[k + 2] - b.px[k + 2]);
      if (diff < MIN) out.push({ sd, f, x: Math.round(d.x), y: Math.round(d.y), b: d.item.b, diff, crop, X: a.X, Y: a.Y }); } }
  return { n, out };
}, MIN);
for (const [i, o] of res.out.entries()) fs.writeFileSync(path.join(out, `seed${o.sd}_f${o.f}_${o.b}_${i}.png`), Buffer.from(o.crop.split(',')[1], 'base64'));
for (const o of res.out) console.log(`hidden: seed ${o.sd} f${o.f} ${o.b} at ${o.x},${o.y} (change ${o.diff}) → ${out}/`);
if (errors.length) console.log('page errors:', errors.join(' | '));
console.log(res.out.length || errors.length ? `lootvis: ${res.out.length} of ${res.n} items hard to see` : `lootvis: ok (${res.n} items seen)`);
await browser.close(); srv.close(); process.exit(res.out.length || errors.length ? 2 : 0);
