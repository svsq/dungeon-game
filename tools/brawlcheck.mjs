import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(process.env.PLAYWRIGHT || path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/brawl';
fs.mkdirSync(out, { recursive: true });
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let browser;
const failures = [], samples = [];
try {
  browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => failures.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const cases = await p.evaluate(() => {
    window.__BRAWL = SCENE.QA().states.filter(([name]) => name.startsWith('elite_brawl') || name.startsWith('elite_hit_'));
    return window.__BRAWL.map(([name]) => name);
  });
  for (const name of cases) for (const zoom of [1, 1.5, 2]) for (const age of name === 'elite_brawl' || name === 'elite_brawl_long' ? [0, 0.1, 0.2, 0.3, 0.4, 0.5] : [0]) {
    const result = await p.evaluate(({ name, zoom, age }) => {
      const S = structuredClone(window.__BRAWL.find(([n]) => n === name)[1]), h = S.run.hero;
      S.run.zoom = zoom; S.run.cam = [h.x - 960 / zoom, h.y - 540 / zoom]; S.t += age;
      const labels = [], grades = [], bars = [], label = LIB.label, draw = MONSTERS.draw, rect = LIB.rrect;
      LIB.label = (id, s, x, y, o) => { labels.push({ id, s, x, y, ...o }); return label(id, s, x, y, o); };
      LIB.rrect = (x, y, w, hh, ...rest) => { if (w === 84 && hh === 16) bars.push({ x, y, w, h: hh }); return rect(x, y, w, hh, ...rest); };
      MONSTERS.draw = (e, E, x, y, t, o) => { if (e.elite) grades.push(o.U.grade); return draw(e, E, x, y, t, o); };
      try { SCENE.state = S; SCENE.render(S.t + 0.01); } finally { LIB.label = label; MONSTERS.draw = draw; LIB.rrect = rect; }
      const texts = window.__UI.filter((u) => u.k === 'text'), issues = [];
      for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i], b = texts[j];
        if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2) issues.push(`text overlap: ${a.id}/${b.id}`);
      }
      const numbers = texts.filter((u) => /^(dn|hu)/.test(u.id)), names = texts.filter((u) => /^el\d/.test(u.id));
      if (numbers.length !== 3 || names.length !== 1) issues.push(`missing labels: ${numbers.length} damage, ${names.length} elite`);
      if (bars.length !== 1 || names.length === 1 && bars[0].y < names[0].y + names[0].h + 3) issues.push('elite HP bar moves above its name');
      for (const n of names) for (const d of numbers) if (d.x < n.x + n.w + 20 && d.x + d.w > n.x - 20 && d.y < n.y + n.h + 20 && d.y + d.h > n.y - 20) issues.push(`damage enters elite name corridor: ${d.id}`);
      const hurt = labels.find((l) => /^hu/.test(l.id));
      if (!hurt || hurt.col !== '#fff4ee' || hurt.out !== '#9b211e' || Math.abs(hurt.x - 960) < 40) issues.push('received damage loses its colour or side placement');
      if (hurt && Math.abs(hurt.y - (540 - 40 * zoom)) > 45) issues.push('received damage moves away from the hero');
      if (grades.some((g) => g[0] < 0.4 || g[1] > 1.5)) issues.push('elite body fills white on impact');
      return { issues, numbers, names, url: document.getElementById('c').toDataURL() };
    }, { name, zoom, age });
    const tag = `${name}_z${zoom}_a${age}`;
    failures.push(...result.issues.map((s) => `${tag}: ${s}`));
    samples.push({ tag, numbers: result.numbers, names: result.names });
    if (age === 0 || name === 'elite_brawl' && zoom === 1) fs.writeFileSync(path.join(out, tag + '.png'), Buffer.from(result.url.split(',')[1], 'base64'));
  }
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ failures, samples }, null, 2));
for (const f of failures) console.log('FAIL', f);
console.log(`brawlcheck: ${failures.length ? failures.length + ' failure(s)' : 'ok'} (${samples.length} frames)`);
process.exitCode = failures.length ? 2 : 0;
