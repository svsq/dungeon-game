// node tools/measure/chars_motion/armpop.mjs [outdir] : the weapon arm coming over the body (TASKS 2177) in pixels. Each action is started
// on a still hero (the QA rest frame of each class) and drawn 1/60 s apart with the clock held, so nothing but the hero changes between
// frames; per step the count of pixels changed (> 60 sum |dRGB|) in a box round the hero, and the steps that spike (>= 2x both
// neighbours, >= 30 px) in the first 0.35 s, the middle and the return to rest. Sheets of each action (x3) go to outdir.
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const ROOT = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url));
const out = process.argv[2] || path.join(ROOT, 'frames/critic_chars_r3_motion/armpop');
const CASES = [
  ['warrior_blow_r', 'hero_attack_r', { atk: 0 }], ['warrior_blow_ul', 'hero_attack_r', { atk: -2.3 }], ['warrior_blow_d', 'hero_attack_r', { atk: Math.PI / 2 }],
  ['warrior_blow_u', 'hero_attack_r', { atk: -Math.PI / 2 }], ['warrior_blow_l', 'hero_attack_r', { atk: Math.PI }],
  ['warrior_charge', 'hero_attack_r', { cast: 'charge' }], ['warrior_cry', 'hero_attack_r', { cast: 'cry' }], ['warrior_whirl', 'hero_attack_r', { whirl: 1 }],
  ['archer_shot_r', 'hero_archer_shoot_r', { shot: 0 }], ['archer_shot_d', 'hero_archer_shoot_r', { shot: Math.PI / 2 }],
  ['mage_shot_r', 'hero_mage_shoot_r', { shot: 0 }], ['mage_shot_d', 'hero_mage_shoot_r', { shot: Math.PI / 2 }],
  ['mage_cast_r', 'hero_mage_shoot_r', { cast: 'fireball' }], ['mage_frost_r', 'hero_mage_shoot_r', { cast: 'frost' }],
];
const F0 = -3, F1 = 66, BOX = 140;
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, b) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(b); }); });
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
fs.mkdirSync(out, { recursive: true });
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const res = await page.evaluate(([CASES, F0, F1, BOX]) => { const Q = SCENE.QA(), R = {};
    for (const [name, src, c] of CASES) {
      const base = Q.transitions[src][0], sheet = document.createElement('canvas'), n = F1 - F0 + 1, cols = 10, rows = Math.ceil(n / cols);
      sheet.width = cols * BOX; sheet.height = rows * BOX; const g = sheet.getContext('2d'), tmp = document.createElement('canvas'); tmp.width = tmp.height = BOX; const gt = tmp.getContext('2d', { willReadFrequently: true });
      const counts = []; let prev = null;
      for (let f = F0; f <= F1; f++) { const S = structuredClone(base), h = S.run.hero, t0 = S.t - f / 60; S.ev = []; S.run.en = []; S.run.proj = []; h.vx = h.vy = 0;
        if (f >= 0) {
          if (c.atk !== undefined) { h.aim = h.atkA = c.atk; h.face = Math.cos(c.atk) >= 0 ? 1 : -1; h.back = Math.sin(c.atk) < -0.5 ? 1 : 0; h.atkT = t0; }
          if (c.shot !== undefined) { h.aim = h.atkA = c.shot; h.atkT = h.patkT = t0; }
          if (c.cast) { h.castT = t0; h.castK = c.cast; }
          if (c.whirl) { h.whirlT = t0; h.whirlA = 0; }
        }
        if (c.atk !== undefined && f < 0) { h.face = Math.cos(c.atk) >= 0 ? 1 : -1; h.aim = c.atk; }
        LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
        const j = LIB.TRACE.hero, cx = j && j.ground ? j.ground : [960, 540];
        gt.clearRect(0, 0, BOX, BOX); gt.drawImage(document.getElementById('c'), cx[0] - BOX / 2, cx[1] - BOX * 0.7, BOX, BOX, 0, 0, BOX, BOX);
        const px = gt.getImageData(0, 0, BOX, BOX).data;
        if (prev) { let k = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - prev[i]) + Math.abs(px[i + 1] - prev[i + 1]) + Math.abs(px[i + 2] - prev[i + 2]) > 60) k++; counts.push(k); }
        prev = px; const i = f - F0; g.drawImage(tmp, (i % cols) * BOX, Math.floor(i / cols) * BOX); }
      R[name] = { counts, url: sheet.toDataURL('image/png') }; }
    return R; }, [CASES, F0, F1, BOX]);
  const lines = [];
  for (const [name, { counts, url }] of Object.entries(res)) {
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    const sp = []; counts.forEach((v, i) => { const nb = Math.max(counts[i - 1] ?? 0, counts[i + 1] ?? 0), f = i + F0 + 1; if (v >= 30 && v >= 2 * Math.max(nb, 1)) sp.push(`f${f - 1}->f${f} ${v} (x${(v / Math.max(nb, 1)).toFixed(1)})${f <= 21 ? ' [first 0.35 s]' : ''}`); });
    const last = counts.map((v) => v > 8).lastIndexOf(true) + F0 + 1;
    lines.push(`${name.padEnd(18)} max step ${Math.max(...counts)} at f${counts.indexOf(Math.max(...counts)) + F0}->f${counts.indexOf(Math.max(...counts)) + F0 + 1}; settles f${last}; spikes: ${sp.join('; ') || 'none'}`);
    lines.push(' '.repeat(18) + ' steps ' + counts.join(' '));
  }
  console.log(lines.join('\n')); fs.writeFileSync(path.join(out, 'armpop.txt'), lines.join('\n') + '\n');
} finally { await browser.close(); server.close(); }
