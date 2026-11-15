// the game's page in a headless browser for a check: a static server on the repo, the skill's playwright, the 1920×1080 view
//   const G = await openGame(); ... await G.page.evaluate(...); ... await G.close(); G.errors holds the page's errors
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const TYPES = { '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.html': 'text/html' };

export async function openGame({ width = 1920, height = 1080, timeout = 120000 } = {}) {
  const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(process.env.PLAYWRIGHT || path.join(skill, 'node_modules/playwright'));
  const server = http.createServer((q, r) => {
    const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', TYPES[path.extname(file)] || 'text/html'); r.end(bytes); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height } }), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const close = async () => { await browser.close(); server.close(); };
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
    await page.waitForFunction(() => window.__ready, null, { timeout });
  } catch (e) { await close(); throw e; }
  return { page, errors, close };
}
