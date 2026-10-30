import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/bankcheck'; fs.mkdirSync(out, { recursive: true });
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
  const results = [];
  for (const name of ['cave_water', 'cave_crossing', 'cave_hall', 'serpent_arena']) {
    const result = await page.evaluate((name) => {
      window.bankQA ||= SCENE.QA();
      const S = structuredClone(window.bankQA.states.find(([n]) => n === name)[1]), m = S.run.map, gl = G.gl, shader = gl.getAttachedShaders(LIB.P.cave.p).find((s) => gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER);
      let source = gl.getShaderSource(shader); source = source.slice(source.indexOf('uniform sampler2D u_open'));
      source = source.replace('float op = openAt(w); vec3 col;', 'float op = openAt(w); vec3 col; float bank = 0.0;').replace('if (ld < 99.0) { float h', 'if (ld < 99.0) { bank = 1.0; float h').replace('o = vec4(col, 1.0);', 'o = vec4(bank, op > 0.47 && waterAt(w) <= 0.5 ? 1.0 : 0.0, waterAt(w) > 0.5 ? 1.0 : 0.0, 1.0);');
      if (!source.includes('bank = 1.0')) throw new Error('bank shader instrumentation missing');
      const program = G.program('bank_measure', source), draw = G.draw; let uniforms;
      m.seed += 10000000;
      G.draw = (p, u, ...args) => { if (p === LIB.P.cave) uniforms = u; return draw(p, u, ...args); };
      try { SCENE.state = S; SCENE.render(S.t + 0.01); } finally { G.draw = draw; }
      if (!uniforms) throw new Error('cave bake not captured');
      const w = m.W * 16, h = m.H * 16, target = G.target(w, h, false, { view: [m.W * 32, m.H * 32], nearest: true });
      G.bind(target, [0, 0, 0, 1]); G.blend('none'); G.draw(program, uniforms, G.xf(0, 0, m.W * 32, m.H * 32));
      const pixels = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const runs = [], at = (x, y, c) => x >= 0 && x < w && y >= 0 && y < h && pixels[((h - 1 - y) * w + x) * 4 + c] > 128;
      for (let x = 0; x < w; x++) { let n = 0;
        for (let y = 0; y <= h; y++) { if (y < h && at(x, y, 0)) n++;
          else if (n) {
            let top = y - n, bottom = y;
            while (at(x, top - 1, 1)) top--;
            while (at(x, bottom, 1)) bottom++;
            runs.push({ x: x * 2, y: (y - n) * 2, height: n * 2, drySupport: (bottom - top) * 2,
              class: n >= 5 ? 'full' : !at(x, y, 2) ? 'rock_corner' : bottom - top < 5 ? 'narrow_land' : 'short_open_face' });
            n = 0;
          } }
      }
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'), im = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) im.data.set(pixels.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4); ctx.putImageData(im, 0, 0);
      const url = canvas.toDataURL(); G.bind(null); G.free(target);
      return { name, runs, url, seed: m.seed - 10000000, floor: S.run.floor };
    }, name);
    fs.writeFileSync(path.join(out, name + '_mask.png'), Buffer.from(result.url.split(',')[1], 'base64')); delete result.url;
    const hist = {}; for (const r of result.runs) hist[r.height] = (hist[r.height] || 0) + 1;
    const full = result.runs.filter((r) => r.height >= 10 && r.height <= 14);
    const short = result.runs.filter((r) => r.class === 'short_open_face');
    if (result.runs.some((r) => r.height > 14)) errors.push(name + ': bank face exceeds 14 view px');
    if (full.length < 3) errors.push('fewer than three measured 10–14 view px bank faces');
    if (short.length) errors.push(short.length + ' short faces with at least 10 view px of dry support');
    results.push({ ...result, histogram: hist });
    console.log(JSON.stringify({ name, histogram: hist, classes: result.runs.reduce((a, r) => { a[r.class] = (a[r.class] || 0) + 1; return a; }, {}), short: short.slice(0, 10), samples: full.slice(0, 5) }));
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ maps: results, errors }, null, 2));
} finally { await browser.close(); server.close(); }
if (errors.length) process.exitCode = 2;
