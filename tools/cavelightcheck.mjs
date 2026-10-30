import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/cave_lighting'; fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    if (q.headers['x-cave-density'] === 'before' && file.endsWith('/live/dungeon.js')) { let src = bytes.toString(); const a = src.indexOf('    if (cave) {\n      const mushrooms ='), b = src.indexOf('    if (cave) for (const d of decor)', a); if (a < 0 || b < 0) throw new Error('density baseline missing'); bytes = Buffer.from(src.slice(0, a) + src.slice(b)); }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], results = [];
try {
  for (const version of ['before', 'after']) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, extraHTTPHeaders: { 'x-cave-density': version } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
    await page.waitForFunction(() => window.__ready);
    const names = await page.evaluate(() => {
      window.lightQA = SCENE.QA();
      return lightQA.states.filter(([n]) => n.startsWith('cave_light_bridge_') || n.startsWith('cave_light_camp_') || ['cave_arena_exit', 'serpent_arena', 'cave_phase2_attack', 'cave_water', 'cave_hall', 'cave_crossing', 'zone_cave'].includes(n)).map(([n]) => n);
    });
    for (const name of names) {
      const r = await page.evaluate((name) => {
        const S = structuredClone(lightQA.states.find(([n]) => n === name)[1]), R = S.run, m = R.map, h = R.hero, z = R.zoom || 1;
        const canvas = document.getElementById('c'), c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
        const ctx = c.getContext('2d', { willReadFrequently: true }), draw = G.draw, calls = { door_frame: 0, portal: 0, jet: [] };
        G.draw = (p, u, ...a) => { if (u.u_tex === G.tex('door_frame')) calls.door_frame++; if (p === LIB.P.portal) calls.portal++;
          if (p === LIB.P.jet) calls.jet.push(u.u_col); return draw(p, u, ...a); };
        SCENE.state = S;
        try { SCENE.render(S.t + 0.01); } finally { G.draw = draw; }
        const url = canvas.toDataURL(); ctx.drawImage(canvas, 0, 0); const full = ctx.getImageData(0, 0, 1920, 1080).data;
        SCENE.render(S.t + 0.01); const deterministic = canvas.toDataURL() === url;
        SCENE.hide.hero = true;
        try { SCENE.render(S.t + 0.01); } finally { delete SCENE.hide.hero; }
        ctx.drawImage(canvas, 0, 0); const empty = ctx.getImageData(0, 0, 1920, 1080).data;
        const sprite = LIB.sprite;
        LIB.sprite = (n, ...a) => /^shroom_[ab]$/.test(n) ? undefined : sprite(n, ...a);
        try { SCENE.render(S.t + 0.01); } finally { LIB.sprite = sprite; }
        ctx.drawImage(canvas, 0, 0); const noMushrooms = ctx.getImageData(0, 0, 1920, 1080).data;
        const values = [], luma = (i) => (full[i] * 0.2126 + full[i + 1] * 0.7152 + full[i + 2] * 0.0722), x0 = (h.x - R.cam[0]) * z, y0 = (h.y - R.cam[1]) * z;
        let contrast = 0;
        for (let y = Math.max(0, Math.floor(y0 - 90 * z)); y < Math.min(1080, y0 + 10 * z); y++) for (let x = Math.max(0, Math.floor(x0 - 45 * z)); x < Math.min(1920, x0 + 45 * z); x++) {
          const i = (y * 1920 + x) * 4, d = Math.abs(full[i] - empty[i]) + Math.abs(full[i + 1] - empty[i + 1]) + Math.abs(full[i + 2] - empty[i + 2]);
          if (d > 45) { values.push(luma(i)); contrast += d; }
        }
        const percentile = (v, p) => { v.sort((a, b) => a - b); return v[Math.floor((v.length - 1) * p)] || 0; };
        const mushrooms = m.decor.filter((d) => /^shroom_[ab]$/.test(d.n)).filter((d) => { const x = (d.x - R.cam[0]) * z, y = (d.y - R.cam[1]) * z; return x > 0 && x < 1590 && y > 0 && y < 1080; });
        const caps = mushrooms.map((d) => { const size = d.s || 1, x = Math.round((d.x - R.cam[0]) * z), y = Math.round((d.y - R.cam[1] - (d.n === 'shroom_a' ? 22 : 34) * size) * z), radius = Math.ceil(10 * size * z), v = [];
          for (let yy = Math.max(0, y - radius); yy < Math.min(1080, y + radius); yy++) for (let xx = Math.max(0, x - radius); xx < Math.min(1920, x + radius); xx++) {
            const i = (yy * 1920 + xx) * 4, diff = Math.abs(full[i] - noMushrooms[i]) + Math.abs(full[i + 1] - noMushrooms[i + 1]) + Math.abs(full[i + 2] - noMushrooms[i + 2]);
            if (diff > 30) v.push(luma(i));
          }
          return { x: d.x, y: d.y, n: d.n, size, pixels: v.length, energy: v.reduce((a, b) => a + b, 0), p95: percentile(v, 0.95) }; });
        return { name, seed: m.seed, floor: R.floor, hero: [h.x, h.y], cam: R.cam, mushroomCount: mushrooms.length, largeMushrooms: mushrooms.filter((d) => (d.s || 1) >= 1).length, caps, heroPixels: values.length, heroEnergy: values.reduce((a, b) => a + b, 0), heroP95: percentile(values, 0.95), heroContrast: contrast, deterministic, calls, url };
      }, name);
      fs.writeFileSync(path.join(out, version + '_' + name + '.png'), Buffer.from(r.url.split(',')[1], 'base64')); delete r.url;
      if (!r.deterministic) errors.push(version + '/' + name + ': repeated frame changed');
      if (r.calls.door_frame) errors.push(version + '/' + name + ': masonry arch in cave');
      if (r.heroPixels < 100) errors.push(version + '/' + name + ': hero silhouette missing');
      if (name === 'cave_arena_exit' && !r.calls.portal) errors.push('cave exit portal missing');
      results.push({ version, ...r });
    }
    await page.close();
  }
  for (const a of results.filter((r) => r.version === 'before')) {
    const b = results.find((r) => r.version === 'after' && r.name === a.name);
    if (!b || ['seed', 'floor', 'hero', 'cam'].some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))) errors.push(a.name + ': density pair changed map or camera');
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ results, errors }, null, 2));
} finally { await browser.close(); server.close(); }
console.log(errors.length ? errors.join('\n') : 'cavelightcheck: ok (density pairs, hero facings, arena and exit)');
if (errors.length) process.exitCode = 2;
