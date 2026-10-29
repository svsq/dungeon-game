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
  const result = await page.evaluate(() => {
    const S = SCENE.QA().states.find(([n]) => n === 'cave_water')[1], m = S.run.map, gl = G.gl, shader = gl.getAttachedShaders(LIB.P.cave.p).find((s) => gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER);
    let source = gl.getShaderSource(shader); source = source.slice(source.indexOf('uniform sampler2D u_open'));
    source = source.replace('float op = openAt(w); vec3 col;', 'float op = openAt(w); vec3 col; float bank = 0.0;').replace('if (ld < 99.0) { float h', 'if (ld < 99.0) { bank = 1.0; float h').replace('o = vec4(col, 1.0);', 'o = vec4(vec3(bank), 1.0);');
    if (!source.includes('bank = 1.0')) throw new Error('bank shader instrumentation missing');
    const program = G.program('bank_measure', source), draw = G.draw; let uniforms;
    m.seed += 10000000;
    G.draw = (p, u, ...args) => { if (p === LIB.P.cave) uniforms = u; return draw(p, u, ...args); };
    try { SCENE.state = S; SCENE.render(S.t + 0.01); } finally { G.draw = draw; }
    if (!uniforms) throw new Error('cave bake not captured');
    const w = m.W * 16, h = m.H * 16, target = G.target(w, h, false, { view: [m.W * 32, m.H * 32], nearest: true });
    G.bind(target, [0, 0, 0, 1]); G.blend('none'); G.draw(program, uniforms, G.xf(0, 0, m.W * 32, m.H * 32));
    const pixels = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const runs = [];
    for (let x = 0; x < w; x += 4) { let n = 0;
      for (let y = 0; y <= h; y++) { if (y < h && pixels[(y * w + x) * 4] > 128) n++;
        else if (n) { if (n >= 1) runs.push({ x: x * 2, y: (h - y) * 2, height: n * 2 }); n = 0; } }
    }
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'), im = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) im.data.set(pixels.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4); ctx.putImageData(im, 0, 0);
    const url = canvas.toDataURL(); G.bind(null); G.free(target);
    return { runs, url, seed: m.seed - 10000000, floor: S.run.floor };
  });
  fs.writeFileSync(path.join(out, 'bank_mask.png'), Buffer.from(result.url.split(',')[1], 'base64')); delete result.url;
  const hist = {}; for (const r of result.runs) hist[r.height] = (hist[r.height] || 0) + 1;
  const full = result.runs.filter((r) => r.height >= 10 && r.height <= 14);
  if (full.length < 3) errors.push('fewer than three measured 10–14 view px bank faces');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ ...result, histogram: hist, errors }, null, 2));
  console.log(JSON.stringify({ histogram: hist, samples: full.slice(0, 5), errors }));
} finally { await browser.close(); server.close(); }
if (errors.length) process.exitCode = 2;
