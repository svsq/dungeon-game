// node tools/measure/chars_assets/cape8_r5.mjs [outDir] [--cls warrior]: author remark 7 (r5, task 2202). The hero's cape in the live render
// (?render=1, the rest state of hero_right dressed as the class) in 8 directions at a walk (0.4 K.RUN) and a run (K.RUN), 4 stride phases,
// facing as sim_hero sets it (face = sign dx, back when moving up), plus a backpedal (facing right, moving left: a shot or swing turns him).
// Cape pixels = the pixels that change when the cape texture is withheld. Prints per case: cape px, its lowest point under the ground line
// (world px, ground = 0, negative = above), the hem's height above the ground, mean Lab, and ΔE76 against the rest pose.
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ROOT = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url));
const OUT = path.resolve(ROOT, args[0] && !args[0].startsWith('--') ? args[0] : 'frames/critic_chars_r5_assets/cape8'), CLS = opt('cls', 'warrior');
fs.mkdirSync(OUT, { recursive: true });
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, b) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(b); }); });
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const res = await page.evaluate(([CLS]) => {
    const Q = SCENE.QA(), base = Q.rest['hero_right'], RUN = (SIM.K && SIM.K.RUN) || 150, rig = ({ warrior: 'hero', archer: 'archer', mage: 'mage' })[CLS] + '__cape', BOX = 160;
    const cv = document.getElementById('c'), tmp = document.createElement('canvas'); tmp.width = tmp.height = BOX; const tg = tmp.getContext('2d', { willReadFrequently: true });
    const grab = (S, c) => { SCENE.state = S; SCENE.render(S.t + 0.01); tg.clearRect(0, 0, BOX, BOX); tg.drawImage(cv, c[0] - BOX / 2, c[1] - BOX * 0.8, BOX, BOX, 0, 0, BOX, BOX); return tg.getImageData(0, 0, BOX, BOX).data; };
    const lab = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, R = f(r), G = f(g), B = f(b);
      const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883, h = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
      return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
    const cases = [['rest', 0, 0, 1, 0], ['rest face left', 0, 0, -1, 0]];
    for (const [n, dx, dy] of [['E', 1, 0], ['SE', 1, 1], ['S', 0, 1], ['SW', -1, 1], ['W', -1, 0], ['NW', -1, -1], ['N', 0, -1], ['NE', 1, -1]])
      for (const [g, k] of [['walk', 0.4], ['run', 1]]) cases.push([n + ' ' + g, dx * k * RUN / Math.hypot(dx, dy), dy * k * RUN / Math.hypot(dx, dy), dx ? Math.sign(dx) : 1, dy < 0 ? 1 : 0]);
    cases.push(['W run backpedal (face right)', -RUN, 0, 1, 0]);
    const out = [], shots = {};
    for (const [name, vx, vy, face, back] of cases) { const acc = { n: 0, L: [0, 0, 0], low: -1e9, ph: [] };
      for (const ph of name.startsWith('rest') ? [0] : [0, 0.5, 1, 1.5].map((x) => x * Math.PI)) {
        const S = structuredClone(base), h = S.run.hero; h.cls = CLS; Object.assign(h, { vx, vy, face, back, gp: ph, faceT: -9, backT: -9 });
        if (CLS !== 'warrior') h.eq.weapon = Object.assign({}, h.eq.weapon, { b: { mage: 'staff', archer: 'shortbow' }[CLS] });
        LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const c = (LIB.TRACE.hero || {}).ground || [960, 540];
        const A = grab(S, c), keep = window.ASSETS[rig]; delete window.ASSETS[rig]; const B = grab(S, c); window.ASSETS[rig] = keep;
        let n = 0, low = -1e9; const sum = [0, 0, 0];
        for (let i = 0; i < BOX * BOX; i++) { const k = i * 4; if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) < 24) continue;
          n++; const y = Math.floor(i / BOX); low = Math.max(low, y - BOX * 0.8); const l = lab(A[k], A[k + 1], A[k + 2]); sum[0] += l[0]; sum[1] += l[1]; sum[2] += l[2]; }
        acc.ph.push({ n, low }); acc.n += n; acc.low = Math.max(acc.low, low); if (n) for (let j = 0; j < 3; j++) acc.L[j] += sum[j];
        if (ph === 0) shots[name] = cv.toDataURL ? (() => { tg.putImageData(new ImageData(A, BOX, BOX), 0, 0); return tmp.toDataURL('image/png'); })() : '';
      }
      out.push({ name, px: acc.n / acc.ph.length, low: acc.low, lowPh: acc.ph.map((p) => p.low), pxPh: acc.ph.map((p) => p.n), Lab: acc.n ? acc.L.map((v) => v / acc.n) : null }); }
    return { out, shots, z: SIM.VIEW ? 1 : 1 }; }, [CLS]);
  const r0 = res.out[0];
  for (const r of res.out) { const dE = r.Lab && r0.Lab ? Math.hypot(...r.Lab.map((v, i) => v - r0.Lab[i])) : NaN;
    console.log(`${r.name.padEnd(30)} cape px ${r.px.toFixed(0).padStart(5)} [${r.pxPh.join(',')}]  lowest y ${String(r.low).padStart(4)} [${r.lowPh.join(',')}]  Lab ${r.Lab ? r.Lab.map((v) => v.toFixed(1)).join(' ') : '-'}  dE vs rest ${dE.toFixed(1)}`); }
  for (const [n, url] of Object.entries(res.shots)) if (url) fs.writeFileSync(path.join(OUT, `${CLS}_${n.replace(/[ ()]/g, '_')}.png`), Buffer.from(url.split(',')[1], 'base64'));
} finally { if (errors.length) console.log('errors:', errors.slice(0, 3).join(' | ')); await browser.close(); server.close(); }
