// r8 game critic: the game's page as a player has it (no ?render=1: the page's own loop and keyboard), driven with real key events.
//   import { openLive } from './live.mjs'; const G = await openLive(); await G.tap('Enter'); const st = await G.st(...); await G.close();
// G.state() hands the sim's state (SCENE.state is the page's own `play`); G.hold(codes, ms) holds keys for wall-clock ms.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const ROOT = path.resolve(process.env.ROOT || path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..'));
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const TYPES = { '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.html': 'text/html' };

export async function openLive({ width = 1920, height = 1080, query = '', timeout = 180000 } = {}) {
  const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
  const server = http.createServer((q, r) => {
    const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', TYPES[path.extname(file)] || 'text/html'); r.end(bytes); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height } }), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const close = async () => { await browser.close(); server.close(); };
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html${query}`);
    await page.waitForFunction(() => window.__ready, null, { timeout });
  } catch (e) { await close(); throw e; }
  const wait = (ms) => page.waitForTimeout(ms);
  const tap = async (code, ms = 60) => { await page.keyboard.down(code); await wait(ms); await page.keyboard.up(code); await wait(40); };
  const hold = async (codes, ms) => { for (const c of [].concat(codes)) await page.keyboard.down(c); await wait(ms); for (const c of [].concat(codes)) await page.keyboard.up(c); };
  const shot = (file) => page.screenshot({ path: file });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  return { page, errors, close, wait, tap, hold, shot, ev };
}
