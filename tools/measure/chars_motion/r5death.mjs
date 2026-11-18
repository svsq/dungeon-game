// node tools/measure/chars_motion/r5death.mjs [outdir] : r5 motion, the deaths of the three classes (standing and running) frame by frame in the game's renderer; the same frame and jump measures as r4seq.mjs (this file is r4seq.mjs with its sequence list swapped).
// listed QA cycles / transitions is drawn as is (a class or the orb can be put on each frame: the orb turn and the orb casts behind him have
// no QA state of their own), and per frame: the pixels changed (> 60 sum |dRGB|) in a 28 px box round the far hand (handL: the mage's cup),
// round each shoulder (shL, shR), the trace jumps of handL / orb / shoulders, the orb-to-cup distance, and on the bow the string's
// coverage: samples along nockA -> stringMid -> nockB with a light, pale pixel (max > 150, spread < 90: the lit cream string, not the orange bow) within 1 px, the longest run of misses. Sheets x3.
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const ROOT = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url));
const out = process.argv[2] || path.join(ROOT, 'frames/critic_chars_r5_motion/death');
const SEQ = [['warrior_death', 'hero_death'], ['warrior_death_run', 'hero_death_run'], ['archer_death', 'hero_archer_death'], ['mage_death', 'hero_death', ['mage']], ['mage_orb_death', 'hero_death', ['mage', 'orb']], ['mage_death_run', 'hero_death_run', ['mage']]];
const BOX = 120, LOC = 28, Z = 3;
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
  const res = await page.evaluate(([SEQ, BOX, LOC, Z]) => { const Q = SCENE.QA(), R = {};
    const MOD = {
      mage: (h) => { h.cls = 'mage'; h.eq.weapon = { id: 0, b: 'staff', rar: 0, lvl: 1, mods: {}, atk: 6 }; h.eq.armor = { id: 0, b: 'robe', rar: 0, lvl: 1, mods: {}, def: 3 }; },
      archer: (h) => { h.cls = 'archer'; h.eq.weapon = { id: 0, b: 'shortbow', rar: 0, lvl: 1, mods: {}, atk: 6 }; h.eq.armor = { id: 0, b: 'leather_armor', rar: 0, lvl: 1, mods: {}, def: 3 }; },
      orb: (h) => { h.eq.offhand = { id: 0, b: 'orb', rar: 0, lvl: 1, mods: {}, def: 4 }; },
    };
    const cv = document.getElementById('c'), tmp = document.createElement('canvas'); tmp.width = tmp.height = BOX; const gt = tmp.getContext('2d', { willReadFrequently: true });
    for (const [name, src, mods] of SEQ) { const list = Q.cycles[src] || Q.transitions[src] || Q.loops[src]; if (!list) { R[name] = null; continue; }
      const frames = list.length > 90 ? list.slice(0, 90) : list, n = frames.length, cols = 12, rows = Math.ceil(n / cols);
      const sheet = document.createElement('canvas'); sheet.width = cols * BOX * Z; sheet.height = rows * BOX * Z; const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false;
      const rowsOut = []; let prev = null;
      frames.forEach((S0, i) => { const S = structuredClone(S0); for (const m of mods || []) MOD[m](S.run.hero);
        LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const j = JSON.parse(JSON.stringify(LIB.TRACE.hero || {})), v = LIB.TRACE.hero_view || {};
        const c0 = j.ground || [960, 540], ox = Math.round(c0[0] - BOX / 2), oy = Math.round(c0[1] - BOX * 0.8);
        gt.clearRect(0, 0, BOX, BOX); gt.drawImage(cv, ox, oy, BOX, BOX, 0, 0, BOX, BOX); const px = gt.getImageData(0, 0, BOX, BOX).data;
        const loc = (p) => (p ? [p[0] - ox, p[1] - oy] : null), at = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= BOX || y >= BOX) return null; const k = (y * BOX + x) * 4; return [px[k], px[k + 1], px[k + 2]]; };
        const region = (p) => { if (!p) return null; let k = 0; if (!prev) return 0; for (let y = -LOC / 2; y < LOC / 2; y++) for (let x = -LOC / 2; x < LOC / 2; x++) { const X = Math.round(p[0] + x), Y = Math.round(p[1] + y); if (X < 0 || Y < 0 || X >= BOX || Y >= BOX) continue; const q = (Y * BOX + X) * 4; if (Math.abs(px[q] - prev[q]) + Math.abs(px[q + 1] - prev[q + 1]) + Math.abs(px[q + 2] - prev[q + 2]) > 60) k++; } return k; };
        let str = null;
        if (j.nockA && j.nockB && j.stringMid) { const pts = [loc(j.nockA), loc(j.stringMid), loc(j.nockB)], samp = [];
          for (let s = 0; s < 2; s++) { const a = pts[s], b = pts[s + 1], L = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let t = s ? 1 : 0; t <= L; t++) samp.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); }
          const hit = samp.map(([x, y]) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = at(x + dx, y + dy); if (!c) continue; const mx = Math.max(...c), mn = Math.min(...c); if (mx > 150 && mx - mn < 90) return 1; } return 0; });
          let run = 0, best = 0; const inner = hit.slice(2, -2); for (const h of inner) { run = h ? 0 : run + 1; best = Math.max(best, run); }
          str = { a: pts[0], m: pts[1], b: pts[2], n: samp.length, cov: inner.length ? inner.reduce((a, b) => a + b, 0) / inner.length : 1, gap: best, pull: Math.hypot(pts[1][0] - (pts[0][0] + pts[2][0]) / 2, pts[1][1] - (pts[0][1] + pts[2][1]) / 2) }; }
        rowsOut.push({ back: v.back ? v.back[0] : 0, face: v.face ? v.face[0] : 1, handL: loc(j.handL), handR: loc(j.handR), orb: loc(j.orb), shL: loc(j.shL), shR: loc(j.shR),
          popHand: region(loc(j.handL)), popOrb: region(loc(j.orb)), popShL: region(loc(j.shL)), popShR: region(loc(j.shR)), str });
        prev = px; g.drawImage(tmp, 0, 0, BOX, BOX, (i % cols) * BOX * Z, Math.floor(i / cols) * BOX * Z, BOX * Z, BOX * Z); });
      R[name] = { rows: rowsOut, url: sheet.toDataURL('image/png') }; }
    return R; }, [SEQ, BOX, LOC, Z]);
  const L = [], d = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0), f1 = (x) => (+x).toFixed(1);
  const spikes = (arr, min) => { const s = []; arr.forEach((v, i) => { if (v == null || i === 0) return; const nb = Math.max(arr[i - 1] ?? 0, arr[i + 1] ?? 0); if (v >= min && v >= 2.5 * Math.max(nb, 4)) s.push(`f${i}:${v}(x${(v / Math.max(nb, 4)).toFixed(1)})`); }); return s; };
  for (const [name, r] of Object.entries(res)) { if (!r) { L.push(name + ' missing'); continue; } const rows = r.rows;
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
    const jump = (k) => { let m = [0, 0]; for (let i = 1; i < rows.length; i++) { const v = d(rows[i][k], rows[i - 1][k]); if (v > m[0]) m = [v, i]; } return m; };
    const parts = [`${name.padEnd(18)} n ${rows.length} back ${rows.filter((x) => x.back > 0.5).length}`];
    for (const k of ['handL', 'orb', 'shL', 'shR']) { const [v, i] = jump(k); if (rows.some((x) => x[k])) parts.push(`${k} jump ${f1(v)}@${i}`); }
    if (rows.some((x) => x.orb)) { const ds = rows.filter((x) => x.orb && x.handL).map((x) => d(x.orb, x.handL)); parts.push(`orb-cup ${f1(Math.min(...ds))}..${f1(Math.max(...ds))}`); }
    for (const k of ['popHand', 'popOrb', 'popShL', 'popShR']) { const s = spikes(rows.map((x) => x[k]), 40); if (s.length) parts.push(`${k} spikes ${s.join(' ')}`); }
    const st = rows.filter((x) => x.str); if (st.length) { const cov = st.map((x) => x.str.cov), gap = st.map((x) => x.str.gap); const bad = st.map((x, i) => [x, rows.indexOf(x)]).filter(([x]) => x.str.gap >= 3).map(([x, i]) => `f${i}:gap${x.str.gap}/pull${f1(x.str.pull)}`);
      parts.push(`string cov min ${f1(Math.min(...cov) * 100)}% med ${f1(cov.sort((a, b) => a - b)[cov.length >> 1] * 100)}% max gap ${Math.max(...gap)}px pull max ${f1(Math.max(...st.map((x) => x.str.pull)))}` + (bad.length ? ` breaks ${bad.slice(0, 10).join(' ')}` : '')); }
    L.push(parts.join('  ')); }
  console.log(L.join('\n')); fs.writeFileSync(path.join(out, 'r4seq.txt'), L.join('\n') + '\n');
  fs.writeFileSync(path.join(out, 'r4seq.json'), JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v && v.rows]))));
} finally { await browser.close(); server.close(); }
