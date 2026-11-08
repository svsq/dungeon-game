import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(process.env.PLAYWRIGHT || path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/spells';
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
  const names = await p.evaluate(() => {
    window.__SPELLS = SCENE.QA().states.filter(([n]) => n.startsWith('spell_'));
    window.__SPELL_SHEETS = {};
    return window.__SPELLS.map(([n]) => n);
  });
  for (const name of names) {
    const result = await p.evaluate((name) => {
      const S = structuredClone(window.__SPELLS.find(([n]) => n === name)[1]), commands = [], draw = G.draw, issues = [], cv = document.getElementById('c');
      G.draw = (program, u, xf, flip) => { if (['whirl', 'fireball', 'blast'].includes(program.name)) commands.push({ program, u, xf, flip }); return draw(program, u, xf, flip); };
      try { SCENE.state = S; SCENE.render(S.t + 0.01); } finally { G.draw = draw; }
      const url = cv.toDataURL(); SCENE.render(S.t + 0.01); if (cv.toDataURL() !== url) issues.push('render is not deterministic');
      const match = name.match(/^spell_(whirl|fireball|boom)_(\d)$/);
      if (match) {
        const kind = match[1], i = +match[2]; let sheet = window.__SPELL_SHEETS[kind];
        if (!sheet) { sheet = document.createElement('canvas'); sheet.width = 4320; sheet.height = 500; window.__SPELL_SHEETS[kind] = sheet; }
        const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#100d13'; g.fillRect(i * 720, 0, 720, 500);
        g.drawImage(cv, 780, 380, 360, 230, i * 720, 40, 720, 460); g.fillStyle = '#eee3d0'; g.font = '22px monospace';
        const age = kind === 'fireball' ? S.t - S.run.proj[0].t0 : S.t - S.ev[0].t;
        g.fillText(`${i + 1} · ${age.toFixed(3)} s`, i * 720 + 12, 28);
      }
      if (name === 'spell_scar_gone' && commands.some((c) => c.program.name === 'blast')) issues.push('scorch survives past four seconds');
      if (name === 'spell_boom_5' && !commands.some((c) => c.program.name === 'blast' && c.u.u_mode === 0)) issues.push('scorch disappears with the blast');
      let pixels = 0;
      if (['spell_whirl_wall', 'spell_whirl_fog', 'spell_whirl_2', 'spell_fireball_5'].includes(name)) {
        const target = G.target(1920, 1080), gl = G.gl, m = S.run.map;
        for (const c of commands) {
          G.bind(target, [0, 0, 0, 0]); G.blend(); draw(c.program, c.u, c.xf, c.flip);
          const x0 = 740, y0 = 340, w = 500, h = 360, px = new Uint8Array(w * h * 4);
          gl.readPixels(x0, 1080 - y0 - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const alphas = new Set(); let leaks = 0, mixels = 0;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = ((h - 1 - y) * w + x) * 4; if (!px[i + 3]) continue; pixels++; alphas.add(px[i + 3]);
            const lift = c.program.name === 'whirl' ? c.u.u_mode ? 0 : 34 : c.u.u_lift || 0;
            const tx = Math.floor((x0 + x + c.u.u_cam[0]) / 32), ty = Math.floor((y0 + y + c.u.u_cam[1] + lift) / 32), tile = ty * m.W + tx;
            if (!S.run.seen[tile] || ![1, 3].includes(m.cells[tile])) leaks++;
            const j = ((h - 1 - (y - y % 2)) * w + x - x % 2) * 4;
            if ([0, 1, 2, 3].some((k) => px[i + k] !== px[j + k])) mixels++;
          }
          if (leaks) issues.push(`${c.program.name}: ${leaks} pixels outside known floor`);
          if (mixels) issues.push(`${c.program.name}: ${mixels} pixels leave the two-pixel grid`);
          if (c.program.name === 'whirl' && c.u.u_mode === 0 && alphas.size > 3) issues.push(`whirl has ${alphas.size} alpha levels`);
        }
        G.free(target); G.bind(null); if (!pixels) issues.push('effect is invisible');
      }
      return { issues, pixels, commands: commands.length, url };
    }, name);
    failures.push(...result.issues.map((s) => `${name}: ${s}`)); samples.push({ name, pixels: result.pixels, commands: result.commands });
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(result.url.split(',')[1], 'base64'));
  }
  for (const kind of ['whirl', 'fireball', 'boom']) {
    const url = await p.evaluate((kind) => window.__SPELL_SHEETS[kind].toDataURL(), kind);
    fs.writeFileSync(path.join(out, kind + '_ages.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ failures, samples }, null, 2));
for (const f of failures) console.log('FAIL', f);
console.log(`spellcheck: ${failures.length ? failures.length + ' failure(s)' : 'ok'} (${samples.length} states)`);
process.exitCode = failures.length ? 2 : 0;
