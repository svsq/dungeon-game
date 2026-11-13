// node pool.mjs OUTDIR "seed,seed": first chapter frame at 1.5 s plus the shape of the start pool (cells, straight shore runs, columns in front)
import { fileURLToPath } from 'node:url';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(process.env.HOME + '/.claude/skills/ref2game/scripts/package.json'); const { chromium } = require('playwright');
const [out, seeds = '1,2,3'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const root = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url)), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((a, r) => { const f = path.join(root, decodeURIComponent(a.url.split('?')[0])); fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`); await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
await p.evaluate(() => { window.__q = 0; });
for (const sd of seeds.split(',').map(Number)) {
  const r = await p.evaluate((seed) => { const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', seed, { town: 1 }); S.screen = 'play'; const R = S.run; SIM.enterFloor(S, R, 13); for (let i = 0; i < 90; i++) { SIM.step(S, { px: 960, py: 540, keys: [] }); R.hero.hp = R.hero.hpMax || 9999; }
    const m = R.map, W = m.W, H = m.H, h = R.hero, cx = Math.floor(h.x / 32), cy = Math.floor(h.y / 32), g = m.grid || m.tiles || m.cells; const lava = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (SIM.Q.cell(m, x, y) === 3 && R.seen[y * W + x]) lava.push([x - cx, y - cy]);
    SCENE.state = S; SCENE.render(S.t + 0.01); const full = document.getElementById('c').toDataURL('image/png'); SCENE.hide = { hero: 1 }; SCENE.render(S.t + 0.01); SCENE.hide = {}; return [full, { nohero: document.getElementById('c').toDataURL('image/png'), up: m.up ? [Math.round(m.up.x - R.cam[0]), Math.round(m.up.y - R.cam[1])] : null, cam: R.cam, hero: [h.x - R.cam[0], h.y - R.cam[1]], lavaSeen: lava.length, rx: lava.length ? [Math.min(...lava.map((q) => q[0])), Math.max(...lava.map((q) => q[0]))] : 0, ry: lava.length ? [Math.min(...lava.map((q) => q[1])), Math.max(...lava.map((q) => q[1]))] : 0 }]; }, sd);
  fs.writeFileSync(path.join(out, `s${sd}.png`), Buffer.from(r[0].split(',')[1], 'base64')); fs.writeFileSync(path.join(out, `s${sd}__nohero.png`), Buffer.from(r[1].nohero.split(',')[1], 'base64')); delete r[1].nohero; console.log(sd, JSON.stringify(r[1])); }
await browser.close(); srv.close();
