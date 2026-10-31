import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/serpentmotion'; fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready);
  await page.evaluate(() => { window.motionQA = SCENE.QA(); });
  const records = [];
  for (let direction = 0; direction < 8; direction++) {
    const frames = await page.evaluate((direction) => {
      const S = structuredClone(window.motionQA.states.find(([n]) => n === 'serpent_bite_aim_' + direction)[1]), b = S.run.en[0], M = DATA.BOSSES.boss_serpent.moves.bite;
      b.t0 = S.t; b.fired = b.hitDone = 0; b.st = 'bwind'; S.run.hero.ifr = 1e9; S.ev = []; S.run.trauma = 0;
      const textures = Object.keys(ASSETS).filter((n) => n.startsWith('serpent__')).map((n) => G.tex(n));
      const target = G.target(240, 240, false, { view: [480, 480], nearest: true }), canvas = document.createElement('canvas'); canvas.width = canvas.height = 240;
      const ctx = canvas.getContext('2d'), out = [], draw = G.draw, start = S.t;
      try {
        for (let frame = 0; frame < Math.ceil((M.wind + M.duration + 0.15) * 60); frame++) {
          const calls = []; G.draw = (p, u, xf, ...args) => { if (p === LIB.P.sprite && textures.includes(u.u_tex) && u.u_grade[2] < 0.5 && u.u_lod === 0) calls.push({ p, u, xf }); return draw(p, u, xf, ...args); };
          LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const joints = LIB.TRACE.en990; LIB.TRACE = null; G.draw = draw;
          if (!joints || !calls.length) throw new Error('missing serpent geometry');
          const ox = joints.ground[0] - 240, oy = joints.ground[1] - 300;
          G.bind(target, [0, 0, 0, 1]); G.blend();
          for (const { p, u, xf } of calls) { const x = xf.slice(); x[6] -= ox; x[7] -= oy; const cut = u.u_cut.slice(); if (cut[2]) cut[0] -= oy;
            draw(p, { ...u, u_grade: [0, 0, 1, 1], u_haze: [1, 1, 1], u_tint: [1, 1, 1, 0], u_pale: 0, u_cut: cut }, x);
          }
          const pixels = new Uint8Array(240 * 240 * 4); G.gl.readPixels(0, 0, 240, 240, G.gl.RGBA, G.gl.UNSIGNED_BYTE, pixels); const im = ctx.createImageData(240, 240);
          for (let y = 0; y < 240; y++) im.data.set(pixels.subarray(y * 960, (y + 1) * 960), (239 - y) * 960); ctx.putImageData(im, 0, 0);
          out.push({ frame, t: S.t - start, head: [joints.head[0] - joints.ground[0], joints.head[1] - joints.ground[1]], url: canvas.toDataURL() });
          G.bind(null); for (let i = 0; i < 2; i++) SIM.step(S, { keys: [], px: 960, py: 540 });
        }
      } finally { G.draw = draw; LIB.TRACE = null; G.bind(null); G.free(target); }
      return out;
    }, direction);
    const dir = path.join(out, String(direction)); fs.mkdirSync(dir, { recursive: true });
    for (const record of frames) { fs.writeFileSync(path.join(dir, String(record.frame).padStart(3, '0') + '.png'), Buffer.from(record.url.split(',')[1], 'base64')); delete record.url; }
    records.push({ direction, frames }); console.log('captured bite direction ' + direction);
  }
  fs.writeFileSync(path.join(out, 'trace.json'), JSON.stringify(records));
} finally { await browser.close(); server.close(); }
