import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
// --runs run1,cave,magma,run2 (TASKS 1373): which runs to measure; the whole set takes over 25 minutes on the Steam Deck
const seed = +opt('seed', 3), frames = +opt('frames', 60), runs = opt('runs', 'run1,cave,magma,run2').split(','), out = opt('out', 'frames/frameprof');
{ const bad = runs.filter((r) => !['run1', 'cave', 'magma', 'run2'].includes(r)); if (bad.length) { console.error('frameprof: unknown --runs ' + bad.join(', ') + ' (run1, cave, magma, run2)'); process.exit(2); } }
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, r) => { const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); }); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
// --cdp http://127.0.0.1:9333: a Chrome already running with --remote-debugging-port (TASKS 1373: on the Steam Deck the Flatpak
// Chrome, the browser the game is played in; start it with --js-flags=--expose-gc --enable-precise-memory-info). Without it, Playwright's own Chromium
const cdp = opt('cdp', ''), vw = +opt('w', 1920), vh = +opt('h', 1080);
// thru: frames back to back, one finish at the end (CPU and GPU overlap as in play): the frame time a player gets.
// --query k=v[&k=v]: added to the page's URL (a render switch, e.g. batch=0 or gfx=low)
// --angle vulkan|gl|default (TASKS 1373): ANGLE's backend; on the Deck the OpenGL one costs far more CPU per draw than Vulkan
const angle = opt('angle', process.platform === 'darwin' ? 'metal' : 'default'), vk = angle === 'vulkan' ? ['--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE'] : [];
const browser = cdp ? await chromium.connectOverCDP(cdp) : await chromium.launch({ args: ['--use-angle=' + angle, ...vk, '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const page = cdp ? await (await browser.newContext({ viewport: { width: vw, height: vh } })).newPage() : await browser.newPage({ viewport: { width: vw, height: vh } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
// hooked on the prototype before the page runs: the assets and first targets are created before __ready and would go uncounted
await page.addInitScript(() => {
  const P = WebGL2RenderingContext.prototype, C = window.__gpu = { live: new Map(), fbs: 0, bound: null, onDraw: null };
  const bytesOf = (gl, a) => { const big = a.length >= 9, w = big ? a[3] : a[5].naturalWidth || a[5].width, h = big ? a[4] : a[5].naturalHeight || a[5].height; return w * h * (a[2] === gl.RGBA16F ? 8 : 4); };
  const hook = (name, f) => { const o = P[name]; P[name] = function (...a) { return f.call(this, o, a); }; };
  hook('createTexture', function (o, a) { const t = o.apply(this, a); C.live.set(t, 0); return t; });
  hook('deleteTexture', function (o, a) { C.live.delete(a[0]); return o.apply(this, a); });
  hook('bindTexture', function (o, a) { C.bound = a[1]; return o.apply(this, a); });
  hook('texImage2D', function (o, a) { if (C.live.has(C.bound)) C.live.set(C.bound, bytesOf(this, a)); return o.apply(this, a); });
  hook('generateMipmap', function (o, a) { if (C.live.has(C.bound)) C.live.set(C.bound, C.live.get(C.bound) * 4 / 3); return o.apply(this, a); });
  hook('createFramebuffer', function (o, a) { C.fbs++; return o.apply(this, a); });
  hook('deleteFramebuffer', function (o, a) { C.fbs--; return o.apply(this, a); });
  hook('drawArrays', function (o, a) { if (C.onDraw) C.onDraw(); return o.apply(this, a); });
  hook('drawArraysInstanced', function (o, a) { if (C.onDraw) C.onDraw(a[3]); return o.apply(this, a); });   // G.drawN (TASKS 1872): one call, a[3] copies
});
let result;
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1${opt('query', '') ? '&' + opt('query', '') : ''}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  if (args.includes('--colossus')) {
    const rows = await page.evaluate(() => {
      const gl = G.gl, base = SCENE.QA().states.find(([n]) => n === 'colossus_basalt')[1], round = (v) => +v.toFixed(1), pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * q)];
      const frame = (S, m, out) => { const g0 = m.geometry || 0, a = performance.now(); for (let i = 0; i < 2; i++) SIM.step(S, { keys: [], px: 0, py: 0 }); const b = performance.now(); SCENE.state = S; SCENE.render(S.t + 0.01); gl.finish(); const c = performance.now(); out.sim.push(b - a); out.draw.push(c - b); out.geo += (m.geometry || 0) - g0; };
      return [['idle', 0], ['fists', 0], ['crack', 0], ['charge', 0], ['boulder', 1], ['imps', 1], ['shatter', 1], ['erupt', 2]].map(([mv, ph]) => {
        const S = structuredClone(base), R = S.run, b = R.en[0], out = { sim: [], draw: [], geo: 0 }; SCENE.state = S;
        for (let i = 0; i < 5; i++) SCENE.render(S.t + 0.01 + i / 60);
        if (mv !== 'idle') { b.phase = ph; SIMX.beginBossMove(S, R, b, mv); }
        let left = 60; for (let i = 0; i < 480 && left > 0; i++) { frame(S, R.map, out); if (mv === 'idle' || (b.st !== 'bwind' && !(R.rocks || []).length && !(R.lavaPending || []).length && !(R.cracks || []).length)) left--; }
        const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        return { mv, frames: out.sim.length, geo: out.geo, simMean: round(mean(out.sim)), simMax: round(Math.max(...out.sim)), drawMean: round(mean(out.draw)), drawP95: round(pct(out.draw, 0.95)), drawMax: round(Math.max(...out.draw)), over: out.draw.filter((v, i) => v + out.sim[i] > 16.6).length };
      });
    });
    console.log('move | frames | geometry changes | sim mean max | draw mean p95 max | frames over 16.6 ms');
    for (const r of rows) console.log(`${r.mv} | ${r.frames} | ${r.geo} | ${r.simMean} ${r.simMax} | ${r.drawMean} ${r.drawP95} ${r.drawMax} | ${r.over}`);
    if (errors.length) { console.log('page errors:\n' + errors.slice(0, 5).join('\n')); process.exitCode = 2; }
    await browser.close(); server.close(); process.exit(process.exitCode || 0);
  }
  result = await page.evaluate(([seed, frames, runs]) => {
    // the base is QA's play() (scene_qa.js), not SCENE.QA() itself: that builds every QA state, minutes on the Steam Deck (TASKS 1373),
    // and each run below replaces the base's run anyway
    const gl = G.gl, X = window.SCX, base = SIM.spawn(0, {}); base.meta.shards = 9999; SIM.step(base, { keys: [] }); base.run = SIM.newRun(base, 'campaign', 1234); base.screen = 'play';
    for (let i = 0; i < 30; i++) SIM.step(base, { px: 960, py: 540, keys: [] });
    const C = window.__gpu, live = C.live; let cur = 'other', tg = null, fin = false, drawP = null, drawXf = null;
    const gBind = G.bind; G.bind = (t, c) => { tg = t; gBind(t, c); };
    let pass = {}, prog = {};
    const gDraw = G.draw; G.draw = (P, U, xf, flip) => { drawP = P; drawXf = xf; gDraw(P, U, xf, flip); };
    const gDrawN = G.drawN; G.drawN = (P, U, xf, flip, off, n) => { drawP = P; drawXf = xf; gDrawN(P, U, xf, flip, off, n); };
    // a batch of flat rectangles (G.solid, TASKS 1873) goes out from G.flush, not from a G.draw: its own program and summed area
    // (review of PR 62: it was booked to the last G.draw's program and quad)
    let batch = null; G.onFlush = (P, R, n) => { let a = 0; for (let i = 0; i < n; i++) a += Math.abs(R[4 * i + 2] * R[4 * i + 3]); batch = { P, a }; };
    C.onDraw = (copies = 1) => { if (batch) { const { P, a } = batch; batch = null; const k = tg ? tg.w * tg.h / (tg.vw * tg.vh) : 1, q = prog[P.name] || (prog[P.name] = { n: 0, px: 0 });
        q.n++; q.px += a * k; (pass[cur] || (pass[cur] = { ms: 0, n: 0 })).n++; return; }
      const P = drawP, xf = drawXf; if (!P) return;
      const vw = tg ? tg.vw : G.W, vh = tg ? tg.vh : G.H, k = tg ? tg.w * tg.h / (tg.vw * tg.vh) : 1;
      const xs = [xf[6], xf[6] + xf[0], xf[6] + xf[3], xf[6] + xf[0] + xf[3]], ys = [xf[7], xf[7] + xf[1], xf[7] + xf[4], xf[7] + xf[1] + xf[4]];
      const area = Math.abs(xf[0] * xf[4] - xf[1] * xf[3]), box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) || 1;
      const cw = Math.max(0, Math.min(vw, Math.max(...xs)) - Math.max(0, Math.min(...xs))), ch = Math.max(0, Math.min(vh, Math.max(...ys)) - Math.max(0, Math.min(...ys)));
      const q = prog[P.name] || (prog[P.name] = { n: 0, px: 0 }); q.n++; q.px += area * (cw * ch / box) * k * copies;
      (pass[cur] || (pass[cur] = { ms: 0, n: 0 })).n++; };
    const wrap = (obj, k, name) => { const f = obj[k]; obj[k] = (...a) => { const was = cur; cur = name; if (fin) gl.finish(); const t0 = performance.now(); try { return f(...a); } finally { G.flush(); if (fin) gl.finish(); (pass[name] || (pass[name] = { ms: 0, n: 0 })).ms += performance.now() - t0; cur = was; } }; };
    wrap(X, 'worldPass', 'world'); wrap(X, 'lightPass', 'light'); wrap(X, 'fxPass', 'fx'); wrap(X.L, 'finish', 'post'); wrap(window.HUD, 'draw', 'hud');
    const VW = SIM.VIEW.W, VH = SIM.VIEW.H, T = DATA.TILE, round = (v, d = 2) => +v.toFixed(d);
    const mem = () => { if (window.gc) gc(); return { tex: live.size, texMB: round([...live.values()].reduce((a, b) => a + b, 0) / 1048576, 1), fbs: C.fbs, heapMB: round(performance.memory.usedJSHeapSize / 1048576, 1) }; };
    const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))];
    const setup = (S, R) => { R.seen = R.seen.map(() => 1); if (R.rseen) R.rseen = R.rseen.map(() => 1); R.msg = null; S.ev = []; R.leaving = 0; R.hero.hp = 1e7; SCENE.state = S; };
    const lookAt = (S, R) => { const m = R.map, h = R.hero, Z = R.zoom || DATA.ZOOM || 1, r = (m.rooms || []).filter((q) => q.type === 'boss')[0] || (m.rooms || []).slice().sort((a, b) => b.w * b.h - a.w * a.h)[0];
      if (r) { h.x = (r.x + r.w / 2) * T; h.y = (r.y + r.h / 2) * T; } R.cam = [h.x - VW / Z / 2, h.y - VH / Z / 2]; };
    const measure = (S, R, label) => {
      setup(S, R);
      const t0 = performance.now(); SCENE.render(S.t + 0.01); gl.finish(); const firstMs = performance.now() - t0;
      for (let i = 0; i < 20; i++) SCENE.render(S.t + 0.01 + i / 60); gl.finish();
      lookAt(S, R); for (let i = 0; i < 10; i++) SCENE.render(S.t + 0.02 + i / 60); gl.finish();
      const cpu = []; for (let i = 0; i < frames; i++) { const a = performance.now(); SCENE.render(S.t + 0.1 + i / 60); cpu.push(performance.now() - a); } gl.finish();
      // thru (TASKS 1872): frames drawn back to back with one finish at the end, CPU and GPU overlapping as in play: the frame time a player gets
      { const a = performance.now(); for (let i = 0; i < frames; i++) SCENE.render(S.t + 0.1 + i / 60); gl.finish(); var thruMs = (performance.now() - a) / frames; }
      pass = {}; prog = {}; fin = true; const full = [];
      for (let i = 0; i < frames; i++) { const a = performance.now(); SCENE.render(S.t + 0.1 + i / 60); gl.finish(); full.push(performance.now() - a); } fin = false;
      const passes = Object.fromEntries(Object.entries(pass).map(([k, v]) => [k, { ms: round(v.ms / frames), draws: Math.round(v.n / frames) }]));
      const shaders = Object.entries(prog).map(([k, v]) => ({ name: k, draws: Math.round(v.n / frames), mpx: round(v.px / frames / 1e6) })).sort((a, b) => b.mpx - a.mpx).slice(0, 10);
      const inp = { keys: [], px: 0, py: 0 }, simMs = []; let simErr = null;
      try { for (let i = 0; i < 90; i++) { const a = performance.now(); SIM.step(S, inp); simMs.push(performance.now() - a); } } catch (e) { simErr = e.message; }
      return { label, biome: R.map.biome, size: R.map.W + '×' + R.map.H, foes: R.en.length, torches: R.map.torches.length, decor: R.map.decor.length, firstMs: round(firstMs, 1), cpuMs: round(cpu.reduce((a, b) => a + b, 0) / frames), cpuP95: round(pct(cpu, 0.95)), thruMs: round(thruMs), fullMs: round(full.reduce((a, b) => a + b, 0) / frames), fullP95: round(pct(full, 0.95)),
        passes, shaders, simMs: simMs.length ? round(simMs.reduce((a, b) => a + b, 0) / simMs.length) : null, simMax: simMs.length ? round(Math.max(...simMs)) : null, simErr, mem: mem() };
    };
    const rows = [], mems = [];
    const floorRun = (mode, opts, list, tag) => { const S = structuredClone(base); S.run = SIM.newRun(S, mode, seed, opts); S.screen = 'play';
      for (const f of list) { const a = performance.now(); if (f !== null) SIM.enterFloor(S, S.run, f); const enterMs = round(performance.now() - a, 1); const row = measure(S, S.run, `${tag} f${f === null ? 0 : f}`); row.enterMs = enterMs; rows.push(row); mems.push({ at: row.label, ...row.mem }); } };
    const seq = [null, ...Array.from({ length: DATA.RUNS.campaign.floors }, (_, i) => i + 1)];
    mems.push({ at: 'start', ...mem() });
    const plan = { run1: ['campaign', { town: 1 }, seq], cave: ['cave', {}, [1, 2, 3, 4]], magma: ['magma', {}, [1, 2, 3, 4]], run2: ['campaign', { town: 1 }, seq] };
    for (const k of runs) floorRun(...plan[k], k);
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { rows, mems, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
  }, [seed, frames, runs]);
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 1));
const P = ['world', 'light', 'fx', 'post', 'hud'];
console.log(`${result.renderer} ${result.canvas.join('×')}`);
console.log('scene | biome | size | foes | enter | 1st | cpu p95 | thru | full p95 | ' + P.join(' ') + ' | GPU draws | sim max | top shaders Mpx');
for (const r of result.rows) console.log(`${r.label} | ${r.biome} | ${r.size} | ${r.foes} | ${r.enterMs} | ${r.firstMs} | ${r.cpuMs} ${r.cpuP95} | ${r.thruMs} | ${r.fullMs} ${r.fullP95} | ${P.map((k) => r.passes[k]?.ms ?? '-').join(' ')} | ${P.reduce((a, k) => a + (r.passes[k]?.draws || 0), 0)} | ${r.simMs} ${r.simMax}${r.simErr ? ' ERR ' + r.simErr : ''} | ${r.shaders.slice(0, 4).map((s) => `${s.name}:${s.mpx}`).join(' ')}`);
console.log('\nmemory: at | textures | tex MB | framebuffers | heap MB');
for (const m of result.mems) console.log(`${m.at} | ${m.tex} | ${m.texMB} | ${m.fbs} | ${m.heapMB}`);
if (errors.length) { console.log('page errors:\n' + errors.slice(0, 5).join('\n')); process.exitCode = 2; }
