import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const seed = +opt('seed', 3), frames = +opt('frames', 60), out = opt('out', 'frames/frameprof');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, r) => { const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); }); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
let result;
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  result = await page.evaluate(([seed, frames]) => {
    const gl = G.gl, X = window.SCX, base = SCENE.QA().states.find(([n]) => n === 'zone_magma')[1];
    const live = new Map(); let bound = null, fbs = 0, cur = 'other', tg = null, fin = false;
    const bytesOf = (a) => { const big = a.length >= 9, w = big ? a[3] : a[5].width, h = big ? a[4] : a[5].height; return w * h * (a[2] === gl.RGBA16F ? 8 : 4); };
    const hook = (name, f) => { const o = gl[name].bind(gl); gl[name] = (...a) => f(o, a); };
    hook('createTexture', (o) => { const t = o(); live.set(t, 0); return t; });
    hook('deleteTexture', (o, a) => { live.delete(a[0]); o(...a); });
    hook('bindTexture', (o, a) => { bound = a[1]; o(...a); });
    hook('texImage2D', (o, a) => { if (live.has(bound)) live.set(bound, bytesOf(a)); o(...a); });
    hook('createFramebuffer', (o) => { fbs++; return o(); });
    hook('deleteFramebuffer', (o, a) => { fbs--; o(...a); });
    const gBind = G.bind; G.bind = (t, c) => { tg = t; gBind(t, c); };
    let pass = {}, prog = {};
    const gDraw = G.draw; G.draw = (P, U, xf, flip) => {
      const vw = tg ? tg.vw : G.W, vh = tg ? tg.vh : G.H, k = tg ? tg.w * tg.h / (tg.vw * tg.vh) : 1;
      const xs = [xf[6], xf[6] + xf[0], xf[6] + xf[3], xf[6] + xf[0] + xf[3]], ys = [xf[7], xf[7] + xf[1], xf[7] + xf[4], xf[7] + xf[1] + xf[4]];
      const area = Math.abs(xf[0] * xf[4] - xf[1] * xf[3]), box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) || 1;
      const cw = Math.max(0, Math.min(vw, Math.max(...xs)) - Math.max(0, Math.min(...xs))), ch = Math.max(0, Math.min(vh, Math.max(...ys)) - Math.max(0, Math.min(...ys)));
      const px = area * (cw * ch / box) * k, q = prog[P.name] || (prog[P.name] = { n: 0, px: 0 }); q.n++; q.px += px;
      (pass[cur] || (pass[cur] = { ms: 0, n: 0 })).n++; gDraw(P, U, xf, flip); };
    const wrap = (obj, k, name) => { const f = obj[k]; obj[k] = (...a) => { const was = cur; cur = name; if (fin) gl.finish(); const t0 = performance.now(); try { return f(...a); } finally { if (fin) gl.finish(); (pass[name] || (pass[name] = { ms: 0, n: 0 })).ms += performance.now() - t0; cur = was; } }; };
    wrap(X, 'worldPass', 'world'); wrap(X, 'lightPass', 'light'); wrap(X, 'fxPass', 'fx'); wrap(X.L, 'finish', 'post'); wrap(window.HUD, 'draw', 'hud');
    const VW = SIM.VIEW.W, VH = SIM.VIEW.H, T = DATA.TILE, round = (v, d = 2) => +v.toFixed(d);
    const mem = () => { if (window.gc) gc(); return { tex: live.size, texMB: round([...live.values()].reduce((a, b) => a + b, 0) / 1048576, 1), fbs, heapMB: round(performance.memory.usedJSHeapSize / 1048576, 1) }; };
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
      pass = {}; prog = {}; fin = true; const full = [];
      for (let i = 0; i < frames; i++) { const a = performance.now(); SCENE.render(S.t + 0.1 + i / 60); gl.finish(); full.push(performance.now() - a); } fin = false;
      const passes = Object.fromEntries(Object.entries(pass).map(([k, v]) => [k, { ms: round(v.ms / frames), draws: Math.round(v.n / frames) }]));
      const shaders = Object.entries(prog).map(([k, v]) => ({ name: k, draws: Math.round(v.n / frames), mpx: round(v.px / frames / 1e6) })).sort((a, b) => b.mpx - a.mpx).slice(0, 10);
      const inp = { keys: [], px: 0, py: 0 }, simMs = []; let simErr = null;
      try { for (let i = 0; i < 90; i++) { const a = performance.now(); SIM.step(S, inp); simMs.push(performance.now() - a); } } catch (e) { simErr = e.message; }
      return { label, biome: R.map.biome, size: R.map.W + '×' + R.map.H, foes: R.en.length, torches: R.map.torches.length, decor: R.map.decor.length, firstMs: round(firstMs, 1), cpuMs: round(cpu.reduce((a, b) => a + b, 0) / frames), cpuP95: round(pct(cpu, 0.95)), fullMs: round(full.reduce((a, b) => a + b, 0) / frames), fullP95: round(pct(full, 0.95)),
        passes, shaders, simMs: simMs.length ? round(simMs.reduce((a, b) => a + b, 0) / simMs.length) : null, simMax: simMs.length ? round(Math.max(...simMs)) : null, simErr, mem: mem() };
    };
    const rows = [], mems = [];
    const floorRun = (mode, opts, list, tag) => { const S = structuredClone(base); S.run = SIM.newRun(S, mode, seed, opts); S.screen = 'play';
      for (const f of list) { const a = performance.now(); if (f !== null) SIM.enterFloor(S, S.run, f); const enterMs = round(performance.now() - a, 1); const row = measure(S, S.run, `${tag} f${f === null ? 0 : f}`); row.enterMs = enterMs; rows.push(row); mems.push({ at: row.label, ...row.mem }); } };
    const seq = [null, ...Array.from({ length: DATA.RUNS.campaign.floors }, (_, i) => i + 1)];
    mems.push({ at: 'start', ...mem() });
    floorRun('campaign', { town: 1 }, seq, 'run1');
    floorRun('cave', {}, [1, 2, 3, 4], 'cave');
    floorRun('magma', {}, [1, 2, 3, 4], 'magma');
    floorRun('campaign', { town: 1 }, seq, 'run2');
    return { rows, mems, renderer: gl.getParameter(gl.RENDERER), canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
  }, [seed, frames]);
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 1));
const P = ['world', 'light', 'fx', 'post', 'hud'];
console.log(`${result.renderer} ${result.canvas.join('×')}`);
console.log('scene | biome | size | foes | enter | 1st | cpu p95 | full p95 | ' + P.join(' ') + ' | sim max | top shaders Mpx');
for (const r of result.rows) console.log(`${r.label} | ${r.biome} | ${r.size} | ${r.foes} | ${r.enterMs} | ${r.firstMs} | ${r.cpuMs} ${r.cpuP95} | ${r.fullMs} ${r.fullP95} | ${P.map((k) => r.passes[k]?.ms ?? '-').join(' ')} | ${r.simMs} ${r.simMax}${r.simErr ? ' ERR ' + r.simErr : ''} | ${r.shaders.slice(0, 4).map((s) => `${s.name}:${s.mpx}`).join(' ')}`);
console.log('\nmemory: at | textures | tex MB | framebuffers | heap MB');
for (const m of result.mems) console.log(`${m.at} | ${m.tex} | ${m.texMB} | ${m.fbs} | ${m.heapMB}`);
if (errors.length) { console.log('page errors:\n' + errors.slice(0, 5).join('\n')); process.exitCode = 2; }
