// node tools/measure/chars_motion/gait.mjs [out.json]  (default frames/critic_chars_r1_motion/gait.json)
// dumps the hero rig trace (LIB.TRACE.hero and hero_view) per frame of the three classes' run cycles, idle, turns and shots
// (SCENE.QA() cycles / transitions / loops), then prints the numbers the motion critic reads: stride axis per direction, planted-foot
// slide in depth runs, the wrap-around jump of each cycle, the back-view frames and largest one-frame jumps of each turn
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const ROOT = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url));
const out = process.argv[2] || path.join(ROOT, 'frames/critic_chars_r1_motion/gait.json');
const RUN = ['hero_right', 'hero_down', 'hero_up', 'mage_right', 'mage_down', 'mage_up', 'archer_right', 'archer_down', 'archer_up', 'mage_wand_orb_right'];
const TR = ['hero_turn', 'hero_shield_turn', 'hero_mage_turn', 'hero_archer_turn', 'hero_archer_shoot_ul', 'hero_archer_shoot_r', 'hero_attack_r', 'hero_mage_cast_r', 'hero_mage_shoot_r', 'hero_hurt', 'hero_mage_hurt', 'hero_archer_hurt', 'hero_idle', 'hero_archer_shoot_l', 'hero_archer_shoot_u', 'hero_charge_l', 'hero_charge_ul', 'hero_cast_ul', 'hero_whirl_ul', 'hero_mage_frost_ul', 'hero_mage_shoot_ul', 'hero_mage_cast_ul', 'hero_swing_180'];
async function trace(names) {
  const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
  const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
  const server = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(file, (err, b) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(b); }); });
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    return await page.evaluate((names) => { const Q = SCENE.QA(), R = {};
      for (const name of names) { const list = Q.cycles[name] || Q.transitions[name] || Q.loops[name]; if (!list) { R[name] = null; continue; }
        R[name] = { cycle: !!Q.cycles[name], T: Q.cycleT[name] || null, rows: list.map((S) => { LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const h = S.run.hero;
          return { t: S.t, j: JSON.parse(JSON.stringify(LIB.TRACE.hero || {})), v: JSON.parse(JSON.stringify(LIB.TRACE.hero_view || {})), x: h.x, y: h.y, zoom: DATA.ZOOM || 1 }; }) }; }
      return R; }, names);
  } finally { await browser.close(); server.close(); }
}
const T = await trace([...RUN, ...TR]);
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(T));
const rel = (r, n) => (r.j[n] && r.j.ground ? [r.j[n][0] - r.j.ground[0], r.j[n][1] - r.j.ground[1]] : null), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; }, f1 = (v) => (+v).toFixed(1);
console.log('== run cycles: ankle travel about the hip (x range, y range), stride axis, wrap jump vs median step, planted-foot slide (world px/frame, p95)');
for (const n of RUN) { const s = T[n]; if (!s) { console.log(n, 'missing'); continue; } const rows = s.rows, ax = [], ay = [], steps = {}, slide = [];
  for (const side of ['L', 'R']) { const xs = rows.map((r) => r.j['ankle' + side][0] - r.j.hip[0]), ys = rows.map((r) => r.j['ankle' + side][1] - r.j.hip[1]);
    ax.push(Math.max(...xs) - Math.min(...xs)); ay.push(Math.max(...ys) - Math.min(...ys));
    // world contact point of the foot: ankle x, its own ground row y; planted while the ankle is within 1 px of that row's lowest lift
    const lift = rows.map((r) => r.j['ground' + side][1] - r.j['ankle' + side][1]), lo = Math.min(...lift);
    const at = (r) => [(r.j['ankle' + side][0] - r.j.ground[0]) / r.zoom + r.x, (r.j['ground' + side][1] - r.j.ground[1]) / r.zoom + r.y];
    for (let i = 1; i < rows.length; i++) if (lift[i] - lo < 1 && lift[i - 1] - lo < 1) slide.push(d(at(rows[i]), at(rows[i - 1])) * rows[i].zoom); }
  const pts = ['ankleL', 'ankleR', 'handL', 'handR', 'grip', 'tip', 'cape', 'orb', 'head'].filter((p) => rows[0].j[p]);
  const stepD = (a, b) => Math.max(...pts.map((p) => (rel(a, p) && rel(b, p) ? d(rel(a, p), rel(b, p)) : 0)));
  const per = rows.slice(1).map((r, i) => stepD(rows[i], r)), wrap = stepD(rows[rows.length - 1], rows[0]);
  const sl = [...slide].sort((a, b) => a - b), p95 = sl.length ? sl[Math.min(sl.length - 1, Math.floor(0.95 * sl.length))] : null;
  console.log(`${n.padEnd(22)} frames ${rows.length} T ${s.T ? s.T.toFixed(3) : '-'}s  ankle x ${ax.map(f1).join('/')} y ${ay.map(f1).join('/')}  axis ${(med(ay) / Math.max(0.1, med(ax))).toFixed(2)}(y/x)  step med ${f1(med(per))} wrap ${f1(wrap)}  slide p95 ${p95 === null ? '-' : f1(p95)} (n ${sl.length})`); }
console.log('== transitions: frames, back-view frames (hero_view.back>0.5), largest one-frame jumps (screen px about the feet)');
for (const n of TR) { const s = T[n]; if (!s) { console.log(n, 'missing'); continue; } const rows = s.rows, back = rows.map((r) => (r.v.back ? r.v.back[0] : 0));
  const jumps = {}; for (const p of ['grip', 'tip', 'cape', 'capeBack', 'shield', 'orb', 'handL', 'handR', 'head']) { const a = []; for (let i = 1; i < rows.length; i++) { const x = rel(rows[i - 1], p), y = rel(rows[i], p); if (x && y) a.push([d(x, y), i]); } if (a.length) jumps[p] = a.reduce((m, q) => (q[0] > m[0] ? q : m)); }
  const dt = rows.length > 1 ? rows[1].t - rows[0].t : 0;
  console.log(`${n.padEnd(22)} frames ${rows.length} dt ${dt.toFixed(4)}s back>0.5 ${back.filter((b) => b > 0.5).length} (${(back.filter((b) => b > 0.5).length * dt).toFixed(3)}s) partial ${back.filter((b) => b > 0.02 && b < 0.98).length}  max jump ` + Object.entries(jumps).map(([p, [v, i]]) => `${p} ${f1(v)}@${i}`).join(', ')); }
