// TASKS 2157: every hero texture the page asks for, in the browser: G.tex is wrapped (every sprite the scene draws goes through it)
// and window.ASSETS sits behind a proxy (every existence test the hero's name rules make), then every SCENE.QA() state and every frame
// of its cycles, transitions and loops is rendered. No project file is touched.
//   node tools/measure/deadtex2157/browser.mjs [--out frames/fix_2157/browser.json] [--states a,b]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', 'frames/fix_2157/browser.json'), only = opt('states', '').split(',').filter(Boolean);
fs.mkdirSync(path.dirname(out), { recursive: true });
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || /missing/i.test(m.text())) errors.push(m.text()); });
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
  const res = await page.evaluate((only) => {
    const HERO = /^(hero|mage|archer)__/, drawn = {}, probed = {}, by = {}, raw = window.ASSETS;
    let cur = '';
    const t0 = G.tex; G.tex = (n) => { if (HERO.test(n)) { drawn[n] = (drawn[n] || 0) + 1; (by[n] = by[n] || new Set()).add(cur); } return t0(n); };
    window.ASSETS = new Proxy(raw, { get: (t, k) => { if (typeof k === 'string' && HERO.test(k)) probed[k] = (probed[k] || 0) + 1; return t[k]; } });
    const Q = SCENE.QA(), seen = { states: 0, frames: 0 }, fail = [];
    const run = (tag, st) => { cur = tag; try { SCENE.state = st; SCENE.render(st.t + 0.01); } catch (e) { fail.push(tag + ': ' + e.message); } };
    for (const [name, st] of Q.states) { if (only.length && !only.includes(name)) continue; run(name, st); seen.states++; }
    if (!only.length) for (const group of ['cycles', 'transitions', 'loops']) for (const [name, list] of Object.entries(Q[group] || {})) for (let i = 0; i < list.length; i++) { run(group + ':' + name, list[i]); seen.frames++; }
    window.ASSETS = raw; G.tex = t0;
    const keys = Object.keys(raw).filter((k) => HERO.test(k));
    return { seen, fail, assets: keys, drawn, probed, where: Object.fromEntries(Object.entries(by).map(([k, s]) => [k, [...s].slice(0, 4)])) };
  }, only);
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  const unused = res.assets.filter((k) => !res.drawn[k]), unprobed = res.assets.filter((k) => !res.drawn[k] && !res.probed[k]);
  console.log(`states ${res.seen.states}, cycle frames ${res.seen.frames}, render failures ${res.fail.length}`);
  console.log(`hero textures ${res.assets.length}, drawn ${res.assets.length - unused.length}, never drawn ${unused.length} (of them never even probed ${unprobed.length})`);
  for (const k of unused) console.log('never drawn', k, res.probed[k] ? '(probed)' : '');
  for (const f of res.fail.slice(0, 10)) console.log('FAIL', f);
} finally { if (errors.length) console.log('errors:', errors.slice(0, 5).join(' | ')); await browser.close(); server.close(); }
