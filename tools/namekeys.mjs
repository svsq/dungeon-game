// the page's dev keys (P pause, [ ] speed, . step) never take a letter typed into the hero's name field (review of PR 63): on the
// Russian layout they are з х ъ ю, and the page catches them before the sim sees the letters; a pause is always lifted by P
//   node tools/namekeys.mjs        exit 2 on failure
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = [], fails = [];
page.on('pageerror', (e) => errors.push(e.message));
const frames = (n) => page.evaluate((n) => new Promise((res) => { const f = () => (--n <= 0 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const key = (code, k) => page.evaluate(([code, k]) => { dispatchEvent(new KeyboardEvent('keydown', { code, key: k })); dispatchEvent(new KeyboardEvent('keyup', { code, key: k })); }, [code, k]);
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await key('ShiftLeft', 'Shift'); await frames(4);
  await page.evaluate(() => { const S = SCENE.state; S.screen = 'classes'; S.pendingMode = 'campaign'; S.focus = 'name'; S.pendName = ''; });
  await frames(2);
  // з х ю on the Russian layout, then . and [ as the English layout gives them: the field takes no . or [, but they must not act either
  for (const [code, k] of [['KeyP', 'з'], ['BracketLeft', 'х'], ['Period', 'ю'], ['Period', '.'], ['BracketLeft', '['], ['BracketRight', ']']]) { await key(code, k); await frames(3); }
  const got = await page.evaluate(() => ({ name: SCENE.state.pendName, focus: SCENE.state.focus, dev: document.getElementById('dev').textContent }));
  if (got.name !== 'Зхю') fails.push(`the field holds «${got.name}», not «Зхю»`);
  if (/PAUSED/.test(got.dev)) fails.push('a letter in the field paused the game');
  if (!/ 1× /.test(got.dev)) fails.push(`a letter in the field changed the speed (${got.dev.trim()})`);
  if (got.focus !== 'name') fails.push(`the field lost the keyboard (${got.focus})`);
  // outside the field the dev keys still work
  await page.evaluate(() => { SCENE.state.focus = 'go'; }); await key('KeyP', 'з'); await frames(2);
  if (!/PAUSED/.test(await page.evaluate(() => document.getElementById('dev').textContent))) fails.push('P off the field no longer pauses');
  // paused, the field taking the keyboard (a step or a reload got it there): P still lifts the pause and types nothing
  await page.evaluate(() => { SCENE.state.focus = 'name'; }); await key('Period', 'ю'); await frames(2); await key('KeyP', 'з'); await frames(2);
  const back = await page.evaluate(() => ({ name: SCENE.state.pendName, dev: document.getElementById('dev').textContent }));
  if (/PAUSED/.test(back.dev)) fails.push('paused with the field in focus, P does not lift the pause');
  if (back.name !== 'Зхю') fails.push(`paused, the dev keys typed into the field («${back.name}»)`);
} finally { await browser.close(); server.close(); }
if (errors.length) fails.push('page errors: ' + errors.slice(0, 3).join(' | '));
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'ok: the dev keys leave the name field alone');
process.exit(fails.length ? 2 : 0);
