// a series of the game page's real start (TASKS 2179): the page without ?render=1 loaded N times per condition in fresh browser
// contexts, from the runner's own static server or from python's http.server (the one start.command runs); counts the starts that
// reach the menu and every distinct error. Exit code 1 when a condition misses 0 errors and 100 % starts; a dropped request the
// loader asked again in a start that reached the menu is counted as recovered, not as an error.
//   node tools/loadseries.mjs [--n 40] [--cond cold,warm,cpu4,cpu6,fast3g,slow4g,blips,flaky,python,python4,serve,serve4] [--timeout 180000]
//                             [--page live/index.html] [--json frames/loadseries.json]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('n', 40), TIMEOUT = +arg('timeout', 180000), PAGE = arg('page', 'live/index.html'), OUT = arg('json', '');
const MBIT = 125000;
// the conditions: CPU slowdown, network (Chrome's presets), the server's own delays and faults; warm: one context for the whole series
const CONDS = {
  cold: {},
  warm: { warm: true },
  cpu4: { cpu: 4 },
  cpu6: { cpu: 6 },
  fast3g: { net: { latency: 562.5, downloadThroughput: 1.44 * MBIT, uploadThroughput: 0.675 * MBIT } },
  slow4g: { net: { latency: 150, downloadThroughput: 1.6 * MBIT * 4, uploadThroughput: 0.75 * MBIT * 4 } },
  blips: { blips: true },
  flaky: { delay: 300, abort: 0.004, trunc: 0.004 },
  python: { python: ['-m', 'http.server'] },
  serve: { python: ['tools/serve.py'] },
  serve4: { python: ['tools/serve.py'], cpu: 4 },
  python4: { python: ['-m', 'http.server'], cpu: 4 },
};
const TYPES = { '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf' };

const serve = (o, faults) => {
  const server = http.createServer((q, r) => {
    const url = q.url.split('?')[0], file = path.join(ROOT, decodeURIComponent(url));
    if (!file.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { r.writeHead(404); r.end(); return; }
      const head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size, 'Last-Modified': st.mtime.toUTCString() };
      if (q.method === 'HEAD') { r.writeHead(200, head); r.end(); return; }
      const doc = url.endsWith('.html'), wait = o.delay && !doc ? Math.random() * o.delay : 0;
      setTimeout(() => fs.readFile(file, (e2, bytes) => {
        if (e2) { r.writeHead(500); r.end(); return; }
        if (!doc && o.abort && Math.random() < o.abort) { faults.push('abort ' + url); r.socket.destroy(); return; }
        if (!doc && o.trunc && Math.random() < o.trunc) { faults.push('truncate ' + url); r.writeHead(200, head); r.write(bytes.subarray(0, bytes.length >> 1)); setTimeout(() => r.socket.destroy(), 20); return; }
        r.writeHead(200, head); r.end(bytes);
      }), wait);
    });
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res({ port: server.address().port, close: () => server.close() })));
};
const servePython = async (cmd) => {
  const port = 20000 + Math.floor(Math.random() * 20000), p = spawn('python3', [...cmd, String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { const ok = await new Promise((res) => http.get(`http://127.0.0.1:${port}/`, (r) => { r.resume(); res(true); }).on('error', () => res(false))); if (ok) break; await new Promise((r) => setTimeout(r, 100)); }
  return { port, close: () => p.kill() };
};

const norm = (s) => String(s).replace(/\?(v|poll|p)=\d+/g, '').replace(/127\.0\.0\.1:\d+/g, 'host').replace(/:\d+:\d+\b/g, ':L:C').replace(/\d{3,}(\.\d+)? ?ms/g, 'N ms').slice(0, 220);

const probe = () => {
  const boot = document.getElementById('boot'), shown = boot && boot.style.display !== 'none' && !boot.classList.contains('fade');
  let lum = -1;
  try { const c = document.getElementById('c'), t = document.createElement('canvas'); t.width = 64; t.height = 36; const x = t.getContext('2d'); x.drawImage(c, 0, 0, 64, 36);
    const d = x.getImageData(0, 0, 64, 36).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; lum = s / (d.length / 4) / 3; } catch (e) {}
  return { ready: !!window.__ready, boot: !!shown, lum, failed: !!(boot && /Не удалось/.test(boot.textContent)) || !!document.querySelector('body > pre'), renderErr: window.__renderErr ? String(window.__renderErr) : '', retries: window.__bootRetries || 0 };
};

async function one(ctx, base, c, faults) {
  const page = await ctx.newPage(), errs = [];
  const add = (kind, s) => errs.push(kind + ': ' + norm(s));
  page.on('pageerror', (e) => add('pageerror', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') add('console.' + m.type(), m.text()); });
  page.on('requestfailed', (q) => { if (!/[?&](poll|p)=/.test(q.url())) add('requestfailed', q.failure().errorText + ' ' + q.url()); });
  page.on('response', (r) => { if (r.status() >= 400) add('http ' + r.status(), r.url()); });
  page.on('crash', () => add('crash', 'page crashed'));
  const cdp = await ctx.newCDPSession(page);
  if (c.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: c.cpu });
  if (c.net) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...c.net }); }
  let blip = null;
  if (c.blips) { await cdp.send('Network.enable');
    const go = async () => { blip = setTimeout(async () => { try { await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 350)); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); go(); } catch (e) {} }, 500 + Math.random() * 2500); };
    go(); }
  const f0 = faults.length, t0 = Date.now();
  let st = null, ok = false, ms = 0;
  try {
    await page.goto(`${base}/${PAGE}`, { timeout: TIMEOUT });
    for (;;) { st = await page.evaluate(probe);
      if (st.ready && !st.boot && st.lum > 4) { ok = true; ms = Date.now() - t0; break; }
      if (st.failed || Date.now() - t0 > TIMEOUT) break;
      await page.waitForTimeout(250); }
    if (ok) { await page.waitForTimeout(1500); st = await page.evaluate(probe); if (st.renderErr) { ok = false; add('renderErr', st.renderErr); } }
  } catch (e) { add('runner', e.message.split('\n')[0]); }
  if (blip) clearTimeout(blip);
  if (!ok && st) add('nostart', st.failed ? 'error screen' : !st.ready ? 'no __ready' : st.boot ? 'loading screen stays' : 'black canvas lum ' + st.lum.toFixed(1));
  await page.close().catch(() => {});
  return { ok, ms, errs: [...new Set(errs)], faults: faults.slice(f0), retries: st ? st.retries : 0 };
}

const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(process.env.PLAYWRIGHT || path.join(skill, 'node_modules/playwright'));
const launch = () => chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const summary = {};
let bad = false;
for (const name of arg('cond', 'cold,warm,cpu4,fast3g,flaky,python').split(',')) {
  const c = CONDS[name]; if (!c) { console.error('unknown condition ' + name); process.exit(2); }
  const faults = [], srv = c.python ? await servePython(c.python) : await serve(c, faults), base = `http://127.0.0.1:${srv.port}`;
  let browser = await launch(), shared = c.warm ? await browser.newContext({ viewport: { width: 1280, height: 720 } }) : null;
  const res = [];
  for (let i = 0; i < N; i++) {
    if (!browser.isConnected()) { browser = await launch(); shared = c.warm ? await browser.newContext({ viewport: { width: 1280, height: 720 } }) : null; }
    const ctx = shared || await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const r = await one(ctx, base, c, faults); res.push(r);
    if (!shared) await ctx.close().catch(() => {});
    process.stdout.write(`${name} ${i + 1}/${N} ${r.ok ? 'ok ' + r.ms + ' ms' : 'FAIL'}${r.retries ? ' (' + r.retries + ' retries)' : ''}${r.errs.length ? '  ' + r.errs.join(' | ') : ''}${r.faults.length ? '  [server: ' + r.faults.join(', ') + ']' : ''}\n`);
  }
  await browser.close().catch(() => {}); srv.close();
  // a dropped request the loader asked again and the start went on is the connection's fault, counted apart from the errors
  const NET = /^(requestfailed|console\.error: Failed to load resource)/, count = {}; let recovered = 0;
  for (const r of res) for (const e of r.errs) { if (r.ok && NET.test(e)) { recovered++; continue; } count[e] = (count[e] || 0) + 1; }
  const okN = res.filter((r) => r.ok).length, times = res.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  summary[name] = { runs: N, ok: okN, errors: Object.values(count).reduce((a, b) => a + b, 0), median: times[times.length >> 1] || 0, max: times[times.length - 1] || 0, faults: res.reduce((a, r) => a + r.faults.length, 0), retries: res.reduce((a, r) => a + r.retries, 0), recovered, distinct: count };
  if (okN < N || summary[name].errors) bad = true;
}
console.log('\ncondition  runs  started  errors  recovered  server faults  retries  median ms  max ms');
for (const [k, s] of Object.entries(summary)) console.log(`${k.padEnd(10)} ${String(s.runs).padStart(4)}  ${String(s.ok).padStart(7)}  ${String(s.errors).padStart(6)}  ${String(s.recovered).padStart(9)}  ${String(s.faults).padStart(13)}  ${String(s.retries).padStart(7)}  ${String(s.median).padStart(9)}  ${String(s.max).padStart(6)}`);
const kind = (e) => e.replace(/\/live\/assets\/\S+\.png/, '/live/assets/*.png').replace(/^(requestfailed: \S+ \S+\/live\/)\w+\.js/, '$1*.js').replace(/failed \w+\.js/, 'failed *.js').split('\n')[0];
const all = {}; for (const [k, s] of Object.entries(summary)) for (const [e, n] of Object.entries(s.distinct)) { const by = (all[kind(e)] = all[kind(e)] || {}); by[k] = (by[k] || 0) + n; }
if (Object.keys(all).length) { console.log('\ndistinct errors (count per condition)'); for (const [e, by] of Object.entries(all)) console.log(`  ${Object.entries(by).map(([k, n]) => k + ' ' + n).join(', ')}  ${e}`); }
if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(summary, null, 1)); }
process.exit(bad ? 1 : 0);
