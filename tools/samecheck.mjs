// proof that a pure move of code (R-38: 501–503, 1142, 1141) changed nothing (ARCHITECTURE.md §6)
//   node tools/samecheck.mjs --save [--only sim,gen,frames]   take the reference on the branch before the move
//   node tools/samecheck.mjs [--only ...]                      compare with it; exit 2 on any difference
//   --query k=v[&k=v]: added to the page's URL (a render switch, e.g. stamp1=0 for the picture before a render change)
// sim: the bot's runs in every mode, the whole state hashed on each floor it reaches and at the end, plus tune.cjs's output;
// gen: genFloor over modes × run seeds × floors, genTown; frames: every SCENE.QA() state rendered, pixels hashed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const save = args.includes('--save'), query = opt('query', ''), only = opt('only', 'sim,gen,frames').split(','), file = opt('file', 'frames/samecheck/base.json');
const sha = (b) => crypto.createHash('sha1').update(b).digest('hex').slice(0, 16);
// v8.serialize writes one number differently as V8's own storage of it changes, so equal states hashed apart between runs (TASKS 1143)
const stateJson = (S) => JSON.stringify(S, (k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v.entries()] : ArrayBuffer.isView(v) ? [...v] : v));
const got = {};

if (process.argv[2] === '--run') {
  const { play } = require('./bot.cjs'), [mode, seed] = [process.argv[3], +process.argv[4]], marks = [];
  play({ seed, mode, profile: 'average', stopAfter: 3, checkpoint: (fr) => marks.push(`f${fr.S.run.floor}:${sha(stateJson(fr.S))}`),
    log: (r, S) => { marks.push('end:' + sha(stateJson(S))); marks.push('res:' + sha(JSON.stringify({ ...r, ver: 0 }))); } });
  console.log(marks.join(' '));
  process.exit(0);
}

if (only.includes('sim')) {
  const RUNS = [['town', 1], ['town', 2], ['campaign', 3], ['cave', 4], ['magma', 5], ['endless', 6]];
  const one = (cmd, a) => new Promise((res, rej) => execFile('node', a, { encoding: 'utf8', maxBuffer: 1 << 26 }, (e, out) => (e ? rej(e) : res(out))));
  const outs = await Promise.all([...RUNS.map(([mode, seed]) => one('node', [process.argv[1], '--run', mode, String(seed)])), one('node', ['live/tune.cjs'])]);
  RUNS.forEach(([mode, seed], i) => { got[`sim ${mode} ${seed}`] = outs[i].trim(); });
  got['sim tune'] = sha(outs[RUNS.length]);
}

if (only.includes('gen')) {
  const D = require('../live/data.js'), DG = require('../live/dungeon.js');
  for (const mode of ['campaign', 'cave', 'magma', 'endless']) {
    const n = Math.min(D.RUNS[mode].floors, 16);
    for (const runSeed of [1, 7, 23]) {
      const h = [];
      for (let f = 1; f <= n; f++) h.push(sha(JSON.stringify(DG.genFloor(runSeed * 131 + f * 1013, f, { mode, runSeed }))));
      got[`gen ${mode} ${runSeed}`] = sha(h.join());
    }
  }
  // as the sim calls it (from, town), 8 run seeds a mode: a stage of tryGen cut wrong changed 1 floor in 288 and none of the above
  for (const mode of ['campaign', 'cave', 'magma', 'endless']) for (let runSeed = 1; runSeed <= 8; runSeed++) {
    const n = mode === 'campaign' ? 16 : mode === 'endless' ? 12 : 4, h = [];
    for (let f = 1; f <= n; f++) h.push(sha(JSON.stringify(DG.genFloor((runSeed * 7919 + f * 104729) >>> 0, f, { mode, runSeed, from: 1, town: 0 }))));
    got[`gen wide ${mode} ${runSeed}`] = sha(h.join());
  }
  got['gen town'] = [1, 2, 3].map((s) => sha(JSON.stringify(DG.genTown(s)))).join(' ');
}

if (only.includes('frames')) {
  const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
  const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
  const server = http.createServer((q, r) => {
    const f = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
      r.setHeader('Content-Type', f.endsWith('.js') ? 'application/javascript' : f.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); });
  });
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  // SCENE.QA() keeps every transition's frames: past V8's default heap on the Steam Deck it stalls for good (TASKS 1373)
  const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1${query ? '&' + query : ''}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    const names = await page.evaluate(() => { window.__Q = SCENE.QA(); return __Q.states.map((s) => s[0]); });
    const base = save || !fs.existsSync(file) ? {} : JSON.parse(fs.readFileSync(file, 'utf8')), shot = async (name) => {
      await page.evaluate((name) => { const st = __Q.states.find((q) => q[0] === name)[1]; SCENE.state = st; SCENE.render(st.t + 0.01); }, name);
      return sha(await page.locator('#c').screenshot()); };
    // a frame that differs is drawn twice more: one in some 500 came out different once and the same on the next draw
    for (const name of names) {
      const k = 'frame ' + name; got[k] = await shot(name);
      for (let i = 0; i < 2 && base[k] && got[k] !== base[k]; i++) { const again = await shot(name); if (again === base[k]) { console.log('unsteady: ' + k); got[k] = again; } }
    }
  } finally { await browser.close(); server.close(); }
  if (errors.length) got['frame errors'] = errors.slice(0, 5).join(' | ');
}

if (save) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const k of Object.keys(old)) if (only.some((o) => k.startsWith(o === 'frames' ? 'frame' : o))) delete old[k];
  fs.writeFileSync(file, JSON.stringify(Object.assign(old, got), null, 1));
  console.log(`saved ${Object.keys(got).length} keys to ${file}`);
} else {
  const base = JSON.parse(fs.readFileSync(file, 'utf8')), diff = [];
  for (const k of Object.keys(got)) if (base[k] !== got[k]) diff.push(k in base ? `changed: ${k}` : `new: ${k}`);
  for (const k of Object.keys(base)) if (!(k in got) && only.some((o) => k.startsWith(o === 'frames' ? 'frame' : o))) diff.push(`missing: ${k}`);
  for (const d of diff) console.log(d);
  console.log(diff.length ? `samecheck: ${diff.length} difference(s) of ${Object.keys(got).length}` : `samecheck ok: ${Object.keys(got).length} keys same`);
  process.exitCode = diff.length ? 2 : 0;
}
