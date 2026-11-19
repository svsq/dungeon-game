// node tools/measure/flicker2149/series.mjs [--states zone_town,town_services,town_stoneyard,zone_dungeon] [--frames 60] [--out frames/flicker2149/after] [--eval 'DATA.BIOMES.town.flick.waves = []']
// Task 2149: a 60 Hz series of one still state (only the render clock moves) and how much its light shimmers: per 8×8 px tile the std of
// its mean luminance over the series and the p95 of its frame-to-frame step, on the floor round the campfire and round a torch (the
// flame's own quad is left out, it is a shader of its own) and over the whole frame; plus what a frame lights: TL entries, light-map
// quads, glows and occglows of the emissive pass, GL draw calls, and the headless frame time (Metal through ANGLE: not a Deck's).
// Output: <out>/series.json, <out>/<state>_f0.png and _f30.png; a table on stdout.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const root = process.env.ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const states = opt('states', 'zone_town,town_services,town_stoneyard,zone_dungeon').split(','), N = +opt('frames', 60), out = opt('out', 'frames/flicker2149/after'), tweak = opt('eval', '');
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((q, r) => { const file = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); }); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  const P = WebGL2RenderingContext.prototype, C = window.__dc = { n: 0 };
  for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) { const o = P[k]; P[k] = function (...a) { C.n++; return o.apply(this, a); }; }
});
await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
if (tweak) await page.evaluate((s) => new Function(s)(), tweak);

const res = {};
for (const name of states) {
  const r = await page.evaluate(([name, N]) => {
    const Q = window.__Q || (window.__Q = SCENE.QA()), st = (Q.states.find((q) => q[0] === name) || [])[1]; if (!st) return null;
    const X = window.SCX, L = X.L, gl = G.gl, cv = document.getElementById('c'), T = 8, pname = new Map(Object.entries(L.P).map(([k, v]) => [v, k]));
    const cnt = { pass: '', tl: 0, gl: 0, light: 0, fxGlow: 0, occ: 0, dcBy: {} }; let F0 = null;
    const wrap = (k, tag, f, O = X) => { const o = O[k]; O[k] = (F, ...a) => { cnt.pass = tag; if (f) f(F); const d0 = window.__dc.n; try { return o(F, ...a); } finally { G.flush(); cnt.dcBy[tag] = window.__dc.n - d0; cnt.pass = ''; } }; return () => { O[k] = o; }; };
    const un = [wrap('finish', 'post', null, L), wrap('draw', 'hud', null, window.HUD), wrap('worldPass', 'world'), wrap('lightPass', 'light', (F) => { F0 = F; cnt.tl = F.TL.length; cnt.gl = F.GL.length; }), wrap('fxPass', 'fx')];
    const gd = G.draw; G.draw = (P, ...a) => { const n = pname.get(P); if (cnt.pass === 'light') cnt.light++; else if (cnt.pass === 'fx' && n === 'occglow') cnt.occ++; return gd(P, ...a); };
    const lg = L.glow; L.glow = (...a) => { if (cnt.pass === 'fx') cnt.fxGlow++; return lg(...a); };
    const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const g2 = c2.getContext('2d', { willReadFrequently: true });
    const TW = Math.floor(cv.width / T), TH = Math.floor(cv.height / T), series = [], shots = {};
    SCENE.state = st; const t0 = st.t + 0.01, per = { tl: 0, light: 0, fxGlow: 0, occ: 0, dc: 0 };
    for (let k = 0; k < N; k++) { Object.assign(cnt, { light: 0, fxGlow: 0, occ: 0 }); const d0 = window.__dc.n; SCENE.render(t0 + k / 60); const dc = window.__dc.n - d0;
      if (k === 1) Object.assign(per, { tl: cnt.tl, gl: cnt.gl, light: cnt.light, fxGlow: cnt.fxGlow, occ: cnt.occ, dc, dcBy: Object.assign({}, cnt.dcBy) });
      g2.drawImage(cv, 0, 0); const px = g2.getImageData(0, 0, cv.width, cv.height).data, tile = new Float32Array(TW * TH);
      for (let y = 0; y < TH * T; y++) for (let x = 0; x < TW * T; x++) { const i = (y * cv.width + x) * 4; tile[Math.floor(y / T) * TW + Math.floor(x / T)] += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; }
      for (let i = 0; i < tile.length; i++) tile[i] /= T * T; series.push(tile);
      if (k === 0 || k === 30) shots['f' + k] = cv.toDataURL('image/png'); }
    const ms = [], lms = [], lp = X.lightPass; X.lightPass = (F) => { G.flush(); gl.finish(); const a = performance.now(); try { return lp(F); } finally { G.flush(); gl.finish(); lms.push(performance.now() - a); } };
    for (let k = 0; k < 60; k++) { const a = performance.now(); SCENE.render(t0 + k / 60); gl.finish(); ms.push(performance.now() - a); } X.lightPass = lp;
    G.draw = gd; L.glow = lg; un.forEach((f) => f());
    // the sources the windows sit round: the campfire (a torch of kind fire) and the torch nearest the view's middle (a sconce or a stand)
    const m = st.run.map, k2 = cv.width / X.VW, on = (x, y) => { const a = F0.sx(x) * k2, b = F0.sy(y) * k2; return a > 60 && a < cv.width - 60 && b > 60 && b < cv.height - 60 ? [a, b] : null; };
    const srcs = [...m.torches.map((q) => ({ x: q.x, y: q.y, kind: q.kind === 'fire' ? 'fire' : q.kind === 'brazier' ? 'brazier' : 'torch' })), ...m.decor.filter((d) => d.n === 'torch_stand').map((d) => ({ x: d.x, y: d.y, kind: 'torch' }))].map((q) => Object.assign(q, { p: on(q.x, q.y) })).filter((q) => q.p);
    const near = (kind) => srcs.filter((q) => q.kind === kind).sort((a, b) => Math.hypot(a.p[0] - cv.width / 2, a.p[1] - cv.height / 2) - Math.hypot(b.p[0] - cv.width / 2, b.p[1] - cv.height / 2))[0];
    const stats = (ids) => { const sd = [], step = []; let mean = 0;
      for (const i of ids) { let s = 0, s2 = 0; for (let k = 0; k < N; k++) { const v = series[k][i]; s += v; s2 += v * v; if (k) step.push(Math.abs(v - series[k - 1][i])); } const mu = s / N; mean += mu; sd.push(Math.sqrt(Math.max(0, s2 / N - mu * mu))); }
      const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))] || 0; }, r3 = (v) => +v.toFixed(3);
      return { tiles: ids.length, meanY: r3(mean / (ids.length || 1)), sdMean: r3(sd.reduce((a, b) => a + b, 0) / (sd.length || 1)), sdP95: r3(q(sd, 0.95)), stepP95: r3(q(step, 0.95)), stepMax: r3(step.reduce((a, b) => Math.max(a, b), 0)) }; };
    const ring = (q) => { if (!q) return null; const ids = [], [ax, ay] = q.p;
      for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) { const x = tx * T + T / 2 - ax, y = ty * T + T / 2 - ay, d = Math.hypot(x, y); if (d < 40 || d > 140 || (Math.abs(x) < 48 && y < 20)) continue; ids.push(ty * TW + tx); }
      return Object.assign({ at: q.p.map(Math.round), kind: q.kind }, stats(ids)); };
    const all = [...Array(TW * TH).keys()], frameMeans = series.map((s) => s.reduce((a, b) => a + b, 0) / s.length);
    return { per, fire: ring(near('fire')), torch: ring(near('torch')), brazier: ring(near('brazier')), frame: stats(all), frame0Y: +frameMeans[0].toFixed(3), seriesY: +(frameMeans.reduce((a, b) => a + b, 0) / N).toFixed(3),
      msMean: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2), msP95: +ms.slice().sort((a, b) => a - b)[56].toFixed(2), lightMs: +(lms.reduce((a, b) => a + b, 0) / lms.length).toFixed(2), shots };
  }, [name, N]);
  if (!r) { console.log('no state', name); continue; }
  for (const [k, url] of Object.entries(r.shots)) fs.writeFileSync(path.join(out, `${name}_${k}.png`), Buffer.from(url.split(',')[1], 'base64'));
  delete r.shots; res[name] = r;
  const w = (o) => (o ? `Y ${o.meanY} sd ${o.sdMean}/p95 ${o.sdP95} step p95 ${o.stepP95} max ${o.stepMax} (${o.tiles} tiles @${o.at})` : '-');
  console.log(`${name}: TL ${r.per.tl} GL ${r.per.gl} lightQuads ${r.per.light} fxGlow ${r.per.fxGlow} occglow ${r.per.occ} drawCalls ${r.per.dc} ${JSON.stringify(r.per.dcBy)} | frame ms ${r.msMean} p95 ${r.msP95} light pass ms ${r.lightMs} | frameY ${r.frame0Y} seriesY ${r.seriesY}`);
  console.log(`  fire  ${w(r.fire)}\n  torch ${w(r.torch)}\n  brazier ${w(r.brazier)}\n  frame Y ${r.frame.meanY} sd ${r.frame.sdMean}/p95 ${r.frame.sdP95} step p95 ${r.frame.stepP95}`);
}
fs.writeFileSync(path.join(out, 'series.json'), JSON.stringify(res, null, 1));
if (errors.length) console.log('errors:', errors.slice(0, 5).join(' | '));
await browser.close(); server.close();
