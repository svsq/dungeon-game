// node tools/measure/perf/profile.mjs [--scenes cave10,magma14,magma3] [--frames 240] [--floors] [--out frames/perf2040]
// Task 2040: the frame of the real play loop (2 sim steps + one render, a scripted hero fighting) on a cave floor 10 and in the magma:
//   where the time goes (CDP CPU profile, JS self time by function and by file, inclusive time of the suspects of study/refactor2/*.md),
//   what a frame allocates (CDP sampling heap profiler, minor-GC objects included), CPU against GPU (ms with and without gl.finish,
//   EXT_disjoint_timer_query_webgl2 when the driver has it), label texture uploads (the S.ev index of hud.js, H-20).
// --floors: a heap series over a run through the town, floors 1..16 and back, three passes, with persist() size and the journal's growth.
// Output goes to <out>/profile.json and a text table on stdout; nothing here changes the game.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const root = process.env.ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const frames = +opt('frames', 240), seed = +opt('seed', 3), out = opt('out', 'frames/perf2040'), only = opt('scenes', 'cave10,magma14,magma3').split(',');
const angle = opt('angle', process.platform === 'darwin' ? 'metal' : 'default'), doFloors = args.includes('--floors'), noScenes = args.includes('--no-scenes');
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((q, r) => { const file = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); }); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + angle, '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  const P = WebGL2RenderingContext.prototype, C = window.__gpu = { live: new Map(), bound: null };
  const bytesOf = (gl, a) => { const big = a.length >= 9, w = big ? a[3] : a[5].naturalWidth || a[5].width, h = big ? a[4] : a[5].naturalHeight || a[5].height; return w * h * (a[2] === gl.RGBA16F ? 8 : 4); };
  const hook = (name, f) => { const o = P[name]; P[name] = function (...a) { return f.call(this, o, a); }; };
  hook('createTexture', function (o, a) { const t = o.apply(this, a); C.live.set(t, 0); return t; });
  hook('deleteTexture', function (o, a) { C.live.delete(a[0]); return o.apply(this, a); });
  hook('bindTexture', function (o, a) { C.bound = a[1]; return o.apply(this, a); });
  hook('texImage2D', function (o, a) { if (C.live.has(C.bound)) C.live.set(C.bound, bytesOf(this, a)); return o.apply(this, a); });
  hook('generateMipmap', function (o, a) { if (C.live.has(C.bound)) C.live.set(C.bound, C.live.get(C.bound) * 4 / 3); return o.apply(this, a); });
});
await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
const cdp = await page.context().newCDPSession(page);

await page.evaluate(() => {
  const gl = G.gl, T = DATA.TILE, VW = SIM.VIEW.W, VH = SIM.VIEW.H, round = (v, d = 2) => +v.toFixed(d);
  const base = SIM.spawn(0, {}); base.meta.shards = 9999; SIM.step(base, { keys: [] }); base.run = SIM.newRun(base, 'campaign', 1234); base.screen = 'play';
  for (let i = 0; i < 30; i++) SIM.step(base, { px: 960, py: 540, keys: [] });
  const up = { n: 0, bytes: 0, tex: 0, names: {} };
  const cu = G.canvasUpdate; G.canvasUpdate = (rec, cv) => { up.n++; up.bytes += cv.width * cv.height * 4; return cu(rec, cv); };
  const ct = G.canvasTex; G.canvasTex = (name, cv) => { up.tex++; { const k = String(name).replace(/\d+/g, '#'); up.names[k] = (up.names[k] || 0) + 1; } up.bytes += cv.width * cv.height * 4; return ct(name, cv); };
  const st = { S: null }, mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))];
  const texMB = () => round([...window.__gpu.live.values()].reduce((a, b) => a + b, 0) / 1048576, 1);
  const prep = (S, R) => { R.seen = R.seen.map(() => 1); if (R.rseen) R.rseen = R.rseen.map(() => 1); R.msg = null; S.ev = []; R.leaving = 0; R.hero.hp = 1e7; SCENE.state = S;
    const Z = R.zoom || DATA.ZOOM || 1, r = (R.map.rooms || []).filter((q) => q.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0] || R.map.rooms[0];
    if (r) { R.hero.x = (r.x + r.w / 2) * T; R.hero.y = (r.y + r.h / 2) * T; } R.cam = [R.hero.x - VW / Z / 2, R.hero.y - VH / Z / 2]; };
  const stepOnce = (S) => { const inp = SIM.scriptInput(S.t, S); SIM.step(S, inp); S.run.hero.hp = 1e7; };
  const frame = (S) => { stepOnce(S); stepOnce(S); SCENE.state = S; SCENE.render(S.t); };
  window.__P = {
    up, texMB,
    enter(mode, opts, f) { const S = structuredClone(base); S.run = SIM.newRun(S, mode, 3, opts); S.screen = 'play'; const a = performance.now();
      if (f) SIM.enterFloor(S, S.run, f); const enterMs = performance.now() - a; st.S = S; prep(S, S.run); const t0 = performance.now(); SCENE.render(S.t + 0.01); gl.finish();
      const firstMs = performance.now() - t0; for (let i = 0; i < 40; i++) frame(S); gl.finish(); const R = S.run, m = R.map;
      return { biome: m.biome, size: m.W + 'x' + m.H, foes: R.en.length, decor: m.decor.length, torches: m.torches.length, enterMs: round(enterMs, 1), firstMs: round(firstMs, 1) }; },
    loop(n) { const S = st.S; for (let i = 0; i < n; i++) frame(S); gl.finish(); },
    timing(n) { const S = st.S, sim = [], ren = [], fullMs = [], play = []; let evMax = 0, evFull = 0, trims = 0;
      for (let i = 0; i < n; i++) { const a = performance.now(); stepOnce(S); stepOnce(S); const b = performance.now(); SCENE.state = S; SCENE.render(S.t); const c = performance.now(); sim.push(b - a); ren.push(c - b); play.push(c - a);
        evMax = Math.max(evMax, S.ev.length); if (S.ev.length >= 64) evFull++; }
      gl.finish(); { const a = performance.now(); for (let i = 0; i < n; i++) frame(S); gl.finish(); var thru = (performance.now() - a) / n; }
      for (let i = 0; i < n; i++) { const a = performance.now(); frame(S); gl.finish(); fullMs.push(performance.now() - a); }
      return { n, simPer2Steps: round(mean(sim), 3), simP95: round(pct(sim, 0.95), 3), simMax: round(Math.max(...sim), 2), renderCpu: round(mean(ren), 3), renderP95: round(pct(ren, 0.95), 3), renderMax: round(Math.max(...ren), 2),
        playCpuMean: round(mean(play), 3), playCpuP95: round(pct(play, 0.95), 3), thruMs: round(thru, 3), fullMean: round(mean(fullMs), 3), fullP95: round(pct(fullMs, 0.95), 3), fullMax: round(Math.max(...fullMs), 2),
        evMax, evFrames64: evFull, renderOver16: ren.filter((v) => v > 16.7).length, renderOver33: ren.filter((v) => v > 33).length, fullOver16: fullMs.filter((v) => v > 16.7).length, fullOver33: fullMs.filter((v) => v > 33).length, kills: S.run.kills, foesAlive: S.run.en.filter((e) => e.deadT < 0).length }; },
    spikes(n) { const S = st.S, X = window.SCX; let cur = null; const orig = []; const wrap = (obj, k, name) => { const f = obj[k]; orig.push([obj, k, f]); obj[k] = (...a) => { const t0 = performance.now(); try { return f(...a); } finally { cur[name] = (cur[name] || 0) + performance.now() - t0; } }; };
      wrap(X, 'worldPass', 'world'); wrap(X, 'lightPass', 'light'); wrap(X, 'fxPass', 'fx'); wrap(X.L, 'finish', 'post'); wrap(window.HUD, 'draw', 'hud');
      const rows = []; for (let i = 0; i < n; i++) { cur = { i, uploads: up.n, ev: 0 }; stepOnce(S); stepOnce(S); SCENE.state = S; const a = performance.now(); SCENE.render(S.t); cur.total = performance.now() - a; cur.uploads = up.n - cur.uploads; cur.ev = S.ev.length; rows.push(cur); }
      for (const [o, k, f] of orig) o[k] = f; gl.finish();
      const worst = rows.slice().sort((a, b) => b.total - a.total).slice(0, 8).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? round(v, 1) : v])));
      const med = (k) => round(pct(rows.map((r) => r[k] || 0), 0.5), 2);
      return { n, worst, median: { total: med('total'), world: med('world'), light: med('light'), fx: med('fx'), post: med('post'), hud: med('hud') }, over33: rows.filter((r) => r.total > 33).map((r) => r.i) }; },
    raf(n, fin, kind) { return new Promise((res) => { const S = st.S, cb = [], dts = [], wait = []; let last = 0, i = 0;
      const tick = (ts) => { if (last) dts.push(ts - last); last = ts; const a = performance.now(); if (kind === 'render') { SCENE.state = S; SCENE.render(S.t + i / 60); } else frame(S); const b = performance.now(); cb.push(b - a);
        if (fin) { gl.finish(); wait.push(performance.now() - b); } if (++i < n) requestAnimationFrame(tick); else res({ n, cbMean: round(mean(cb), 3), cbMedian: round(pct(cb, 0.5), 3), cbP95: round(pct(cb, 0.95), 3), cbMax: round(Math.max(...cb), 2),
          waitMean: wait.length ? round(mean(wait), 3) : null, waitMedian: wait.length ? round(pct(wait, 0.5), 3) : null, waitP95: wait.length ? round(pct(wait, 0.95), 3) : null, dtMean: round(mean(dts), 2), dtMedian: round(pct(dts, 0.5), 2), dtP95: round(pct(dts, 0.95), 2), dtMax: round(Math.max(...dts), 1), over20: dts.filter((v) => v > 20).length }); };
      requestAnimationFrame(tick); }); },
    rafLoop(n) { return new Promise((res) => { const S = st.S; let i = 0; const tick = () => { frame(S); if (++i < n) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); }); },
    simOnly(n) { const S = st.S, a = performance.now(); for (let i = 0; i < n; i++) stepOnce(S); return round((performance.now() - a) / n, 4); },
    renderOnly(n) { const S = st.S; SCENE.state = S; const a = performance.now(); for (let i = 0; i < n; i++) SCENE.render(S.t + i / 60); const cpu = (performance.now() - a) / n; gl.finish(); return round(cpu, 3); },
    gpuTime(n) { const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); if (!ext) return null; const S = st.S, qs = [];
      for (let i = 0; i < n; i++) { stepOnce(S); stepOnce(S); SCENE.state = S; const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); SCENE.render(S.t); gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(q); gl.finish(); }
      const res = []; for (const q of qs) { let tries = 0; while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && tries++ < 1000); res.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); }
      const bad = gl.getParameter(ext.GPU_DISJOINT_EXT); return { n, gpuMean: round(mean(res), 3), gpuP95: round(pct(res, 0.95), 3), gpuMax: round(Math.max(...res), 2), disjoint: !!bad }; },
    upReset() { up.n = up.bytes = up.tex = 0; },
    upload(n) { const S = st.S; this.upReset(); for (let i = 0; i < n; i++) frame(S); gl.finish(); return { frames: n, uploadsPerFrame: round(up.n / n, 2), newTexPerFrame: round(up.tex / n, 3), kbPerFrame: round(up.bytes / n / 1024, 1) }; },
    // the same render with a stream of hit events at a given rate, S.ev trimmed to 64 as the sim does, against a stream whose labels never change index
    evStress(n, rate, trim) { const S = st.S, R = S.run, foes = R.en.filter((e) => e.deadT < 0).slice(0, 6); S.ev = []; this.upReset(); let nid = 0; const ms = [];
      for (let i = 0; i < n; i++) { const t0 = performance.now(); for (let k = 0; k < rate; k++) { const e = foes[(nid++) % foes.length]; if (!e) break; const ev = { k: 'hit', t: S.t, x: e.x, y: e.y - 40, type: e.type, n: 10 + (nid % 90), id: e.id }; S.ev.push(ev); }
        if (trim && S.ev.length > 64) S.ev.splice(0, S.ev.length - 64); if (!trim && S.ev.length > 64) S.ev = S.ev.filter((x) => S.t - x.t < 0.8);
        S.t += 1 / 60; SCENE.state = S; SCENE.render(S.t); ms.push(performance.now() - t0); }
      gl.finish(); const r = { n, rate, trim: !!trim, cpuMedianMs: round(pct(ms, 0.5), 3), cpuMeanMs: round(mean(ms), 3), uploadsPerFrame: round(up.n / n, 2), newTexPerFrame: round(up.tex / n, 3), kbPerFrame: round(up.bytes / n / 1024, 1), live: S.ev.length }; S.ev = []; return r; },
    mem() { if (window.gc) gc(); const S = st.S, R = S.run; return { heapMB: round(performance.memory.usedJSHeapSize / 1048576, 2), texMB: texMB(), tex: window.__gpu.live.size, canvasTexNames: { ...up.names } }; },
    persistSize() { const S = st.S, p = SIM.persist(S), a = performance.now(), meta = JSON.stringify(p.meta).length, run = p.run ? JSON.stringify(p.run).length : 0, saves = JSON.stringify(p.saves || []).length, ms = performance.now() - a;
      const R = S.run, log = R.log ? JSON.stringify(R.log).length : 0, fl = R.log && R.log.fl ? JSON.stringify(R.log.fl).length : 0, memo = R.memo ? JSON.stringify(R.memo).length : 0, seen = JSON.stringify(R.seen).length, rseen = R.rseen ? JSON.stringify(R.rseen).length : 0;
      let lsMs = null; try { const str = JSON.stringify(p.run || {}), q = performance.now(); localStorage.setItem('__perf2040', str); lsMs = performance.now() - q; localStorage.removeItem('__perf2040'); } catch (e) { lsMs = -1; }
      const b = performance.now(), whole = JSON.stringify({ simT: 0, speed: 1, paused: false, play: S }).length, wms = performance.now() - b;
      return { metaB: meta, runB: run, savesB: saves, persistMs: round(ms, 2), lsWriteMs: lsMs === null ? null : round(lsMs, 2), logB: log, flB: fl, flN: R.log && R.log.fl ? R.log.fl.length : 0, memoB: memo, seenB: seen, rseenB: rseen, wholeSessionB: whole, wholeMs: round(wms, 2), floor: R.floor }; },
    enterAny(f) { const S = st.S; const a = performance.now(); SIM.enterFloor(S, S.run, f); const ms = performance.now() - a; prep(S, S.run); return round(ms, 1); },
    fast(f) { const S = st.S; SIM.enterFloor(S, S.run, f); prep(S, S.run); },
    seq() { return DATA.RUNS.campaign.floors; },
  };
});

const scenes = { cave10: ['campaign', { town: 1 }, 10], magma14: ['campaign', { town: 1 }, 14], magma3: ['magma', {}, 3], cave3: ['cave', {}, 3] };
const results = { env: { angle, frames, renderer: await page.evaluate(() => { const gl = G.gl, d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }), cpus: os.cpus()[0].model }, scenes: {} };

const fileOf = (u) => (u || '').split('/').pop() || '(native)';
const keyOf = (cf) => `${cf.functionName || '(anon)'}@${fileOf(cf.url)}:${cf.lineNumber + 1}`;
// inclusive time of a function: each sample counts once for every distinct function on its stack
const SUSPECTS = ['spellFloor', 'seenTex', 'waterTex', 'swimTex', 'crustTex', 'lakeTex', 'mapKey', 'maskTex', 'voidTex', 'bake', 'minimap', 'world', 'hud', 'rebalanceRun', 'migrateAbilities', 'migrateTown', 'fitBag', 'fstat', 'stats', 'heroSt', 'heroPowers', 'firePowers', 'solids', 'reveal', 'flow', 'bfs', 'stepPlay', 'stepMonsters', 'stepBossMove', 'stepCrust',
  'worldPass', 'lightPass', 'fxPass', 'drawEnemy', 'drawHero', 'drawFolk', 'lblTex', 'label', 'fitText', 'sizeToFit', 'measureText', 'canvasUpdate', 'canvasTex', 'secretMask', 'filter', 'structuredClone', 'sprite', 'draw', 'drawN', 'flush', 'stamp', 'inked', 'snapTex', 'uiBox'];
function cpuReport(profile, nFrames) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n])), parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const self = new Map(), file = new Map(), incl = new Map(); let total = 0;
  profile.samples.forEach((id, i) => { const dt = (profile.timeDeltas[i + 1] ?? profile.timeDeltas[i]) / 1000, n = nodes.get(id), k = keyOf(n.callFrame); total += dt;
    self.set(k, (self.get(k) || 0) + dt); const f = fileOf(n.callFrame.url); file.set(f, (file.get(f) || 0) + dt);
    const seen = new Set(); for (let c = id; c !== undefined; c = parent.get(c)) { const nm = nodes.get(c).callFrame.functionName; if (nm && !seen.has(nm)) { seen.add(nm); incl.set(nm, (incl.get(nm) || 0) + dt); } } });
  const per = (v) => +(v / nFrames).toFixed(3), top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, v]) => ({ name: n, msPerFrame: per(v) }));
  return { totalMsPerFrame: per(total), topSelf: top(self, 30), byFile: top(file, 18), inclusive: SUSPECTS.map((s) => ({ name: s, msPerFrame: per(incl.get(s) || 0) })).filter((x) => x.msPerFrame > 0).sort((a, b) => b.msPerFrame - a.msPerFrame) };
}
function heapReport(profile, nFrames) {
  const rows = new Map(), incl = new Map(); let total = 0;
  const walk = (n, stack) => { const nm = n.callFrame.functionName, k = keyOf(n.callFrame), here = nm ? new Set([...stack, nm]) : stack; total += n.selfSize; rows.set(k, (rows.get(k) || 0) + n.selfSize);
    if (n.selfSize) for (const s of here) incl.set(s, (incl.get(s) || 0) + n.selfSize); for (const c of n.children || []) walk(c, here); };
  walk(profile.head, new Set());
  const per = (v) => +(v / nFrames / 1024).toFixed(2), top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, v]) => ({ name: n, kbPerFrame: per(v) }));
  return { totalKBPerFrame: per(total), topSelf: top(rows, 25), inclusive: SUSPECTS.map((s) => ({ name: s, kbPerFrame: per(incl.get(s) || 0) })).filter((x) => x.kbPerFrame > 0).sort((a, b) => b.kbPerFrame - a.kbPerFrame) };
}

if (!noScenes) for (const name of only) {
  if (!scenes[name]) continue; const [mode, opts, f] = scenes[name];
  console.error('scene', name);
  const r = { info: await page.evaluate(([m, o, ff]) => __P.enter(m, o, ff), [mode, opts, f]) };
  r.timing = await page.evaluate((n) => __P.timing(n), frames);
  if (args.includes('--spikes')) r.spikes = await page.evaluate((n) => __P.spikes(n), 240);
  r.rafPlay = await page.evaluate((n) => __P.raf(n, false, 'play'), frames); r.rafPlayFinish = await page.evaluate((n) => __P.raf(n, true, 'play'), frames); r.rafRender = await page.evaluate((n) => __P.raf(n, false, 'render'), frames); r.rafRenderFinish = await page.evaluate((n) => __P.raf(n, true, 'render'), frames);
  r.simOnlyMsPerStep = await page.evaluate((n) => __P.simOnly(n), 480);
  r.renderOnlyCpuMs = await page.evaluate((n) => __P.renderOnly(n), 120);
  r.gpu = await page.evaluate((n) => __P.gpuTime(n), 120);
  r.uploads = await page.evaluate((n) => __P.upload(n), 240);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  await page.evaluate((n) => __P.rafLoop(n), frames);
  r.cpu = cpuReport((await cdp.send('Profiler.stop')).profile, frames); await cdp.send('Profiler.disable');
  await page.evaluate(() => { if (window.gc) gc(); });
  await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  await page.evaluate((n) => __P.rafLoop(n), frames);
  r.alloc = heapReport((await cdp.send('HeapProfiler.stopSampling')).profile, frames); await cdp.send('HeapProfiler.disable');
  r.mem = await page.evaluate(() => __P.mem());
  results.scenes[name] = r;
}

if (noScenes || only.includes('evstress')) {
  await page.evaluate(([m, o, f]) => __P.enter(m, o, f), scenes.cave10);
  const rows = [];
  for (const rate of [0, 1, 3]) for (const trim of [1, 0]) rows.push(await page.evaluate(([n, r, t]) => __P.evStress(n, r, t), [180, rate, trim]));
  results.evStress = rows;
}

if (doFloors) {
  const series = [];
  await page.evaluate(([m, o]) => __P.enter(m, o, 0), ['campaign', { town: 1 }]);
  const mem0 = await page.evaluate(() => __P.mem()); series.push({ at: 'start', pass: 0, ...mem0, ...(await page.evaluate(() => __P.persistSize())) });
  const F = await page.evaluate(() => __P.seq());
  for (let pass = 1; pass <= 3; pass++) for (let f = 1; f <= F; f++) {
    let enterMs, err = null; try { enterMs = await page.evaluate((ff) => __P.enterAny(ff), f); } catch (e) { err = e.message; }
    await page.evaluate(() => __P.loop(120));
    const row = { at: 'f' + f, pass, floor: f, enterMs, err, ...(await page.evaluate(() => __P.mem())), ...(await page.evaluate(() => __P.persistSize())) };
    series.push(row);
    try { await page.evaluate(() => __P.fast(0)); } catch (e) { row.townErr = e.message; }
  }
  results.floors = series;
}

results.pageErrors = errors.slice(0, 8);
fs.writeFileSync(path.join(out, 'profile.json'), JSON.stringify(results, null, 1));
for (const [n, r] of Object.entries(results.scenes)) {
  console.log(`\n## ${n}: ${JSON.stringify(r.info)}`); console.log('timing', JSON.stringify(r.timing)); console.log('sim ms/step', r.simOnlyMsPerStep, 'render cpu', r.renderOnlyCpuMs, 'gpu', JSON.stringify(r.gpu), 'uploads', JSON.stringify(r.uploads), 'mem', JSON.stringify(r.mem));
  if (r.spikes) console.log('spikes', JSON.stringify(r.spikes));
  for (const k of ['rafPlay', 'rafPlayFinish', 'rafRender', 'rafRenderFinish']) console.log(k, JSON.stringify(r[k]));
  console.log('cpu profile ms/frame', r.cpu.totalMsPerFrame, '| files:', r.cpu.byFile.slice(0, 10).map((x) => `${x.name} ${x.msPerFrame}`).join(', '));
  console.log('top self:'); for (const x of r.cpu.topSelf.slice(0, 18)) console.log('  ', x.msPerFrame, x.name);
  console.log('inclusive:', r.cpu.inclusive.slice(0, 24).map((x) => `${x.name} ${x.msPerFrame}`).join(', '));
  console.log('alloc KB/frame', r.alloc.totalKBPerFrame); for (const x of r.alloc.topSelf.slice(0, 14)) console.log('  ', x.kbPerFrame, x.name);
  console.log('alloc inclusive:', r.alloc.inclusive.slice(0, 20).map((x) => `${x.name} ${x.kbPerFrame}`).join(', '));
}
if (results.evStress) { console.log('\nev stress'); for (const x of results.evStress) console.log(JSON.stringify(x)); }
if (results.floors) { const L = results.floors[results.floors.length - 1]; console.log('canvasTex names created over the whole series:', JSON.stringify(L.canvasTexNames)); console.log('\nfloors: at | pass | heap MB | tex MB | tex | persist run B | log B | fl N | memo B | whole B | enter ms'); for (const s of results.floors) console.log([s.at, s.pass, s.heapMB, s.texMB, s.tex, s.runB, s.logB, s.flN, s.memoB, s.wholeSessionB, s.enterMs ?? s.err].join(' | ')); }
if (errors.length) { console.log('page errors:\n' + errors.slice(0, 5).join('\n')); process.exitCode = 2; }
await browser.close(); server.close();
