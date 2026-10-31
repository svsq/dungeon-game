import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/cave_materials'; fs.mkdirSync(out, { recursive: true });
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
    const S = SCENE.QA().states.find(([n]) => n === 'cave_water')[1], gl = G.gl;
    const shader = gl.getAttachedShaders(LIB.P.cave.p).find((s) => gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER);
    let source = gl.getShaderSource(shader);
    source = source.slice(source.indexOf('uniform sampler2D u_open'), source.indexOf('void main()'));
    const draw = G.draw; let uniforms;
    G.draw = (p, u, ...args) => { if (p === LIB.P.cave) uniforms = u; return draw(p, u, ...args); };
    try { SCENE.state = S; SCENE.render(S.t + 0.01); } finally { G.draw = draw; }
    if (!uniforms) throw new Error('cave bake not captured');
    const swatches = {};
    for (const [name, fn] of [['floor', 'gFloor'], ['wall', 'gWall'], ['top', 'gTop']]) {
      const program = G.program('material_' + name, source + 'void main(){ vec2 w = floor(v_px / 2.0) * 2.0 + 1.0; o = vec4(' + fn + '(w), 1.0); }');
      const target = G.target(256, 256, false, { view: [256, 256], nearest: true });
      const render = () => {
        G.bind(target, [0, 0, 0, 1]); G.blend('none'); G.draw(program, uniforms, G.xf(0, 0, 256, 256));
        const pixels = new Uint8Array(256 * 256 * 4); gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      };
      const pixels = render(), repeat = render();
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d'), im = ctx.createImageData(256, 256);
      for (let y = 0; y < 256; y++) im.data.set(pixels.subarray(y * 256 * 4, (y + 1) * 256 * 4), (255 - y) * 256 * 4);
      ctx.putImageData(im, 0, 0);
      swatches[name] = { url: canvas.toDataURL(), deterministic: pixels.every((v, i) => v === repeat[i]) };
      G.bind(null); G.free(target);
    }
    return swatches;
  });
  for (const [name, swatch] of Object.entries(result)) {
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(swatch.url.split(',')[1], 'base64')); delete swatch.url;
    if (!swatch.deterministic) errors.push(name + ': repeated material changed');
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ materials: result, errors }, null, 2));
} finally { await browser.close(); server.close(); }
console.log(errors.length ? errors.join('\n') : 'cavematerialcheck: ok');
if (errors.length) process.exitCode = 2;
