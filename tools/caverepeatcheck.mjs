import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/cave_repeat'; fs.mkdirSync(out, { recursive: true });
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
  const result = await page.evaluate(({ clearComp, drawPixels }) => {
    const S = structuredClone(SCENE.QA().states.find(([n]) => n === 'cave_fireball_deep_0')[1]), before = JSON.stringify(S), gl = G.gl, bind = G.bind;
    const beginComp = LIB.beginComp;
    if (clearComp) LIB.beginComp = () => { G.bind(LIB.T.comp, [0, 0, 0, 0]); beginComp(); };
    const targets = new Map(), labels = new Map(Object.entries(LIB.T).map(([n, t]) => [t, n])), draw = G.draw, traces = [], pixelTraces = [];
    let target = null, trace, pixelTrace;
    G.bind = (t, ...a) => { target = t; if (t && !targets.has(t)) targets.set(t, labels.get(t) || 'target' + targets.size); return bind(t, ...a); };
    G.draw = (p, u, xf, ...a) => {
      const comp = target === LIB.T.comp;
      if (comp) trace.push(JSON.stringify([p.name, u, xf, a]));
      const r = draw(p, u, xf, ...a);
      if (comp && drawPixels) { const pixel = new Float32Array(4); gl.readPixels(489, target.h - 238, 1, 1, gl.RGBA, gl.FLOAT, pixel); pixelTrace.push([...pixel]); }
      return r;
    };
    const snapshot = () => {
      const out = {};
      for (const [t, name] of targets) {
        if (!gl.isFramebuffer(t.fb)) continue; bind(t);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) continue;
        const floating = gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE) === gl.FLOAT;
        const data = floating ? new Float32Array(t.w * t.h * 4) : new Uint8Array(t.w * t.h * 4);
        gl.readPixels(0, 0, t.w, t.h, gl.RGBA, floating ? gl.FLOAT : gl.UNSIGNED_BYTE, data);
        out[name] = { w: t.w, h: t.h, floating, data };
      }
      bind(null); const data = new Uint8Array(1920 * 1080 * 4); gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, data);
      out.screen = { w: 1920, h: 1080, data }; return out;
    };
    const urls = [], differences = [];
    try {
      SCENE.state = S; let previous;
      for (let k = 0; k < 4; k++) {
        trace = []; pixelTrace = []; SCENE.render(S.t + 0.01); traces.push(trace); pixelTraces.push(pixelTrace); urls.push(document.getElementById('c').toDataURL()); const current = snapshot();
        if (previous) for (const [name, a] of Object.entries(previous)) {
          const b = current[name]; if (!b) continue; let changed = 0, max = 0; const samples = [];
          for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) { changed++; max = Math.max(max, Math.abs(a.data[i] - b.data[i]));
            if (samples.length < 8) samples.push({ x: Math.floor(i / 4) % a.w, y: a.h - 1 - Math.floor(i / 4 / a.w), c: i % 4, a: a.data[i], b: b.data[i] }); }
          if (changed) differences.push({ frame: k, name, w: a.w, h: a.h, floating: !!a.floating, changed, max, samples });
        }
        previous = current;
      }
    } finally { G.bind = bind; G.draw = draw; LIB.beginComp = beginComp; }
    const drawDifferences = traces[0].flatMap((a, i) => a === traces[1][i] ? [] : [{ i, first: a, second: traces[1][i] }]);
    const pixelDifferences = pixelTraces[0].flatMap((a, i) => JSON.stringify(a) === JSON.stringify(pixelTraces[1][i]) ? [] : [{ i, first: a, second: pixelTraces[1][i], draw: traces[0][i] }]);
    return { pure: before === JSON.stringify(S), differences, drawCounts: traces.map((t) => t.length), drawDifferences, pixelDifferences: pixelDifferences.slice(0, 6), urls, browser: navigator.userAgent };
  }, { clearComp: args.includes('--clear-comp'), drawPixels: args.includes('--draw-pixels') });
  for (const [i, url] of result.urls.entries()) fs.writeFileSync(path.join(out, 'frame' + i + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  delete result.urls;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result, null, 2));
  if (!result.pure || result.differences.some((d) => d.name === 'screen')) errors.push('repeated frame changed');
  console.log(JSON.stringify(result));
} finally { await browser.close(); server.close(); }
if (errors.length) process.exitCode = 2;
