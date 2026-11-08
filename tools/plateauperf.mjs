// node tools/plateauperf.mjs [--seed 3] [--frames 120] [--out frames/plateau]
// What the plateaus' big maps (TASKS 400) cost the renderer, in the browser (Chromium, GPU): the magma caves' 3rd floor (104×78)
// against the water caves' 3rd (88×66) and the campaign's 5th (72×54, the fire depths): the first frame on a floor (the bake, the
// cell masks), the world-size bake's texture memory, and the mean frame time (CPU + GPU, gl.finish) at the start and at the view
// with the most lava cells in it: the scene's CPU time a frame (no wait on the GPU) and the frames a second it keeps when drawn on every
// animation frame for a second (the GPU's share shows there; a desktop GPU is held to the display's 60). The lava's own share (its
// lights and shader) is the busiest view with the floor's lava hidden. Writes a shot of each view. Exit 2 when a plateau view drops
// under 55 frames a second.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const seed = +opt('seed', 3), frames = +opt('frames', 120), out = opt('out', 'frames/plateau'); fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, r) => { const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); }); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
let rows = [];
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`); await page.waitForFunction(() => window.__ready);
  rows = await page.evaluate(async ([seed, frames]) => {
    const gl = G.gl, base = SCENE.QA().states.find(([n]) => n === 'zone_magma')[1], VW = SIM.VIEW.W, VH = SIM.VIEW.H, T = DATA.TILE, res = [];
    const shot = (S) => { SCENE.render(S.t + 0.01); return document.getElementById('c').toDataURL(); };
    const time = (S, n) => { gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) SCENE.render(S.t + 0.01 + i / 60); const ms = (performance.now() - t0) / n; gl.finish(); return ms; };
    // (20 frames to warm up first: the first frames after a floor's bake upload and compile)
    const fps = (S) => new Promise((done) => { let n = -20, t0 = 0; const go = () => { SCENE.render(S.t + 0.01 + n / 60); if (++n === 0) t0 = performance.now(); if (n <= 0 || performance.now() - t0 < 1000) requestAnimationFrame(go); else done(n * 1000 / (performance.now() - t0)); }; requestAnimationFrame(go); });
    for (const [mode, f] of [['magma', 3], ['cave', 3], ['campaign', 5]]) {
      const S = structuredClone(base); S.run = SIM.newRun(S, mode, seed); S.screen = 'play'; SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, h = R.hero;
      R.seen = R.seen.map(() => 1); R.msg = null; R.en = []; S.ev = []; SCENE.state = S;   // (the floor's arrival event fades the view in from black)
      const Z = R.zoom || DATA.ZOOM || 1, look = (x, y) => { h.x = x; h.y = y; R.cam = [x - VW / Z / 2, y - VH / Z / 2]; };
      look(h.x, h.y); const t0 = performance.now(); SCENE.render(S.t + 0.01); gl.finish(); const first = performance.now() - t0;
      const atStart = time(S, frames), startShot = shot(S), fpsStart = await fps(S);
      // the view (on a 4-cell grid) with the most lava cells in it, the hero on the open floor nearest its middle
      let best = null; const vw = Math.ceil(VW / Z / T), vh = Math.ceil(VH / Z / T);
      for (let y0 = 0; y0 + vh <= m.H; y0 += 4) for (let x0 = 0; x0 + vw <= m.W; x0 += 4) { let n = 0; for (let y = y0; y < y0 + vh; y++) for (let x = x0; x < x0 + vw; x++) if (m.cells[y * m.W + x] === 3) n++; if (!best || n > best[2]) best = [x0, y0, n]; }
      let fx = (best[0] + vw / 2) * T, fy = (best[1] + vh / 2) * T, nd = 1e9;
      for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 1) { const x = (k % m.W + 0.5) * T, y = (Math.floor(k / m.W) + 0.5) * T, d = Math.hypot(x - fx, y - fy); if (d < nd) { nd = d; fx = x; fy = y; } }
      look(fx, fy); const atLava = time(S, frames), lavaShot = shot(S), fpsLava = await fps(S);
      const lava0 = m.lava; m.lava = 0; const noLava = time(S, frames); m.lava = lava0;
      res.push({ mode, f, size: m.W + '×' + m.H, cells: m.cells.filter((c) => c === 3).length, viewLava: best[2], firstMs: +first.toFixed(1), bakeMB: +(m.W * T * m.H * T * 4 / 1048576).toFixed(1),
        maskMB: +(m.W * 4 * m.H * 4 * 4 * 6 / 1048576).toFixed(1), startMs: +atStart.toFixed(2), lavaViewMs: +atLava.toFixed(2), lavaHiddenMs: +noLava.toFixed(2), fpsStart: Math.round(fpsStart), fpsLava: Math.round(fpsLava), startShot, lavaShot });
    }
    return res; }, [seed, frames]);
  for (const r of rows) { for (const k of ['startShot', 'lavaShot']) { fs.writeFileSync(path.join(out, `perf_${r.mode}_f${r.f}_${k.replace('Shot', '')}.png`), Buffer.from(r[k].split(',')[1], 'base64')); delete r[k]; } }
} finally { await browser.close(); server.close(); }
for (const r of rows) console.log(`${r.mode} f${r.f} ${r.size}: lava cells ${r.cells} (${r.viewLava} in the busiest view) | first frame ${r.firstMs} ms | bake ${r.bakeMB} MB, masks ~${r.maskMB} MB | CPU ${r.startMs} ms a frame at the start, ${r.lavaViewMs} at the lava (${r.lavaHiddenMs} without it) | ${r.fpsStart} / ${r.fpsLava} fps`);
const slow = rows.filter((r) => r.mode === 'magma' && Math.min(r.fpsStart, r.fpsLava) < 55);
if (errors.length) console.log('page errors:\n' + errors.join('\n'));
console.log(slow.length || errors.length ? 'plateauperf: over budget' : 'plateauperf: ok');
if (slow.length || errors.length) process.exitCode = 2;
