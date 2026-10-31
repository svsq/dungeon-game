import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/cave_wading'; fs.mkdirSync(out, { recursive: true });
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
  const results = await page.evaluate(() => {
    const qa = SCENE.QA(), cv = document.getElementById('c'), c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
    const ctx = c.getContext('2d', { willReadFrequently: true }), solid = LIB.solid, ring = LIB.ring;
    const eq = (c, v) => c && c.length === 3 && c.every((x, i) => x === v[i]);
    let skip = false, waterCalls = 0;
    LIB.solid = (...a) => {
      if (eq(a[4], [0.07, 0.3, 0.42]) || eq(a[4], [0.62, 0.84, 0.86])) { waterCalls++; if (skip) return; }
      return solid(...a);
    };
    LIB.ring = (...a) => { if (skip && eq(a[4], [0.62, 0.86, 0.88])) return; return ring(...a); };
    const results = [];
    const cases = qa.states.filter(([n]) => n.startsWith('cave_wade_') || ['cave_bridge', 'cave_bridge_v', 'cave_ford'].includes(n)).flatMap(([name, S]) => {
      if (name.startsWith('cave_wade_')) return [[name, S]];
      const overlap = structuredClone(S), { map: m, hero: h } = overlap.run;
      const cell = Math.floor(h.y / DATA.TILE) * m.W + Math.floor(h.x / DATA.TILE);
      if (!m.water.includes(cell)) m.water.push(cell);
      return [[name, S], [name + '_wet_mask', overlap]];
    });
    try {
      for (const [name, base] of cases) {
        const S = structuredClone(base), R = S.run, h = R.hero, z = R.zoom || 1, x = Math.round((h.x - R.cam[0]) * z), y = Math.round((h.y - R.cam[1]) * z);
        const render = (noWater, noHero) => {
          skip = noWater; SCENE.hide.hero = noHero; waterCalls = 0; SCENE.state = S; SCENE.render(S.t + 0.01);
          ctx.drawImage(cv, 0, 0); return ctx.getImageData(x - 90, y - 180, 180, 210).data;
        };
        const full = render(false, false), calls = waterCalls, url = cv.toDataURL(), dry = render(true, false), empty = render(true, true);
        let covered = 0, silhouette = 0, upperChanged = 0;
        for (let yy = 0; yy < 210; yy++) for (let xx = 0; xx < 180; xx++) {
          const i = (yy * 180 + xx) * 4;
          const diff = (a, b) => Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
          if (diff(dry, empty) > 45 && yy >= 180 - 10 * z && yy <= 180 + 6 * z) { silhouette++; if (diff(full, dry) > 12) covered++; }
          if (yy < 180 - 18 * z && diff(full, dry) > 12) upperChanged++;
        }
        const m = R.map, cell = Math.floor(h.y / DATA.TILE) * m.W + Math.floor(h.x / DATA.TILE), crossing = m.crossings.find((c) => c.cells.includes(cell));
        results.push({ name, calls, silhouette, covered, upperChanged, shallow: m.water.includes(cell), crossing: crossing?.kind || null, url });
      }
    } finally { LIB.solid = solid; LIB.ring = ring; delete SCENE.hide.hero; }
    return results;
  });
  for (const r of results) {
    fs.writeFileSync(path.join(out, r.name + '.png'), Buffer.from(r.url.split(',')[1], 'base64')); delete r.url;
    if (r.name.startsWith('cave_wade_')) {
      if (!r.shallow || r.crossing || !r.calls || r.covered < 10) errors.push(r.name + ': water does not cover the lower hero silhouette');
      if (r.upperChanged) errors.push(r.name + ': water covers the upper body');
    } else if (r.calls) errors.push(r.name + ': hero wades on a dry crossing');
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ results, errors }, null, 2));
} finally { await browser.close(); server.close(); }
console.log(errors.length ? errors.join('\n') : 'cavewadecheck: ok');
if (errors.length) process.exitCode = 2;
