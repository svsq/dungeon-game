// node tools/swingcheck.mjs [--out frames/swing] — measure the hero's melee swings from SCENE.QA().swings (states 1/60 s apart).
// Per swing: the largest per-frame move of the hand and the blade tip (relative to the ground point), and how far the blade turns
// back against the swing per frame (a fast back-sweep reads as a second attack). Writes a contact sheet per swing.
// Exit 2 when a hand moves more than HAND_MAX px in one frame or the blade turns back by more than BACK_MAX.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/swing';
const HAND_MAX = 36, BACK_MAX = 0.35;  // px/frame outside the strike: an eased wind-up overhead peaks near 33, the old one-frame breaks were 41–47; rad/frame against the swing: the lift back to guard is ≤ 0.34, the old back-sweep 0.9+
fs.mkdirSync(out, { recursive: true });
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`);
await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
await p.evaluate(() => { window.__QA = SCENE.QA(); });
const names = await p.evaluate(() => Object.keys(window.__QA.swings || {}));
let fails = 0; const rep = {};
for (const name of names) {
  const fr = [];
  const n = await p.evaluate((nm) => window.__QA.swings[nm].length, name);
  for (let i = 0; i < n; i++) {
    const r = await p.evaluate(([nm, i]) => { const st = window.__QA.swings[nm][i]; LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE.hero; LIB.TRACE = null;
      const h = st.run.hero, c = st.run.cam, T = st.t - h.atkT, sw = SCENE.swingPose(T, h.face > 0 ? h.atkA : Math.PI - h.atkA, SIM.stats(h, st.meta).arc * Math.PI / 180, -0.95);
      return { j, strike: T >= SCENE.SWING.pull && T < sw.Ts + 1 / 60, box: [h.x - c[0] - 90, h.y - c[1] - 130, 180, 170] }; }, [name, i]);
    const shot = await p.screenshot({ clip: { x: r.box[0], y: r.box[1], width: r.box[2], height: r.box[3] } });
    fs.writeFileSync(path.join(out, `${name}_${String(i).padStart(2, '0')}.png`), shot);
    fr.push(Object.assign(r.j || {}, { strike: r.strike }));
  }
  const rel = (f, k) => [f[k][0] - f.ground[0], f[k][1] - f.ground[1]];
  let hand = 0, tip = 0, handAt = 0; const ang = [];
  for (let i = 0; i < fr.length; i++) { const f = fr[i]; if (!f || !f.grip || !f.tip) { ang.push(null); continue; } ang.push(Math.atan2(f.tip[1] - f.grip[1], f.tip[0] - f.grip[0]));
    if (i && fr[i - 1] && fr[i - 1].grip) { const dh = Math.hypot(...rel(f, 'handR').map((v, k) => v - rel(fr[i - 1], 'handR')[k])), dt = Math.hypot(...rel(f, 'tip').map((v, k) => v - rel(fr[i - 1], 'tip')[k]));
      if (!f.strike && !fr[i - 1].strike && dh > hand) { hand = dh; handAt = i; } tip = Math.max(tip, dt); } }   // the strike itself is meant to be fast
  // the dominant turning direction over the strike, then the largest turn against it afterwards
  const d = []; for (let i = 1; i < ang.length; i++) if (ang[i] !== null && ang[i - 1] !== null) { let x = ang[i] - ang[i - 1]; x -= 2 * Math.PI * Math.round(x / (2 * Math.PI)); d.push(x); } else d.push(0);
  const big = d.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0), sgn = Math.sign(big); let back = 0;
  for (const x of d) if (Math.sign(x) === -sgn) back = Math.max(back, Math.abs(x));
  rep[name] = { ang: ang.map((a) => a === null ? null : +a.toFixed(2)), handMax: +hand.toFixed(1), handAt, tipMax: +tip.toFixed(1), backPerFrame: +back.toFixed(2) };
  const bad = hand > HAND_MAX || back > BACK_MAX; if (bad) fails++;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${name}: hand ≤ ${hand.toFixed(1)} px/frame outside the strike (@${handAt}), tip ≤ ${tip.toFixed(1)} px/frame, back ≤ ${back.toFixed(2)} rad/frame`);
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(rep, null, 1));
if (errors.length) { console.log('page errors:', errors.slice(0, 5)); fails++; }
await browser.close(); srv.close();
process.exit(fails ? 2 : 0);
