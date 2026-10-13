// node tools/swingcheck.mjs [--out frames/swing] — measure the hero's melee swings from SCENE.QA().swings (states 1/60 s apart).
// Per swing: the largest per-frame move of the hand and the blade tip (relative to the ground point), and how far the blade turns
// back against the swing per frame (a fast back-sweep reads as a second attack); the slash trail must turn the same way as the
// blade. Writes a contact sheet per swing. Then, on SCENE.QA().impacts (the damage frame all round, a body on the target): the blade
// stays visible over the body (pixels it changes with the target vs without), and it projects shorter when it strikes toward or
// away from the camera. Last, the walk cycles draw the view they travel in (hero_up from behind, the rest from the front).
// Exit 2 when a hand moves more than HAND_MAX px in one frame, the blade turns back by more than BACK_MAX, or any check fails.
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
  const fr = [], trail = [];
  const n = await p.evaluate((nm) => window.__QA.swings[nm].length, name);
  for (let i = 0; i < n; i++) {
    const r = await p.evaluate(([nm, i]) => { const st = window.__QA.swings[nm][i]; LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE.hero, fx = LIB.TRACE.hero_fx; LIB.TRACE = null;
      const h = st.run.hero, c = st.run.cam, T = st.t - h.atkT, sw = SCENE.swingPose(T, h.face > 0 ? h.atkA : Math.PI - h.atkA, SIM.stats(h, st.meta).arc * Math.PI / 180, -0.95);
      return { j, fx, strike: T >= SCENE.SWING.pull && T < sw.Ts + 1 / 60, box: [(h.x - c[0]) * (DATA.ZOOM || 1) - 135, (h.y - c[1]) * (DATA.ZOOM || 1) - 195, 270, 255] }; }, [name, i]);
    const shot = await p.screenshot({ clip: { x: r.box[0], y: r.box[1], width: r.box[2], height: r.box[3] } });
    fs.writeFileSync(path.join(out, `${name}_${String(i).padStart(2, '0')}.png`), shot);
    fr.push(Object.assign(r.j || {}, { strike: r.strike })); trail.push(r.fx && r.fx.trail ? Math.atan2(r.fx.trail[1] - r.fx.trailC[1], r.fx.trail[0] - r.fx.trailC[0]) : null);
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
  // the trail's leading end turns about its centre the way the blade turns (a trail sweeping backwards reads as a second swing)
  let tsum = 0; for (let i = 1; i < trail.length; i++) if (trail[i] !== null && trail[i - 1] !== null) { let x = trail[i] - trail[i - 1]; x -= 2 * Math.PI * Math.round(x / (2 * Math.PI)); tsum += x; }
  const trailOk = Math.abs(tsum) > 0.3 && Math.sign(tsum) === sgn;
  rep[name] = { ang: ang.map((a) => a === null ? null : +a.toFixed(2)), handMax: +hand.toFixed(1), handAt, tipMax: +tip.toFixed(1), backPerFrame: +back.toFixed(2), trailTurn: +tsum.toFixed(2) };
  const bad = hand > HAND_MAX || back > BACK_MAX || !trailOk; if (bad) fails++;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${name}: hand ≤ ${hand.toFixed(1)} px/frame outside the strike (@${handAt}), tip ≤ ${tip.toFixed(1)} px/frame, back ≤ ${back.toFixed(2)} rad/frame, trail turns ${tsum.toFixed(2)} rad${trailOk ? '' : ' (against the blade)'}`);
}
// ---- impacts: the blade over the body it hits, and its length by direction ----
const VIS_MIN = 0.5, DEPTH_MAX = 0.9;   // share of the blade's own pixels still drawn over the body; vertical / horizontal blade length
// the blade's pixels: what hiding the weapon changes inside the blade's box, with the body on the target and without it
const pixDiff = (a, b) => p.evaluate(async ([a, b]) => { const load = (s) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + s; });
  const [A, B] = await Promise.all([load(a), load(b)]), c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data; g.clearRect(0, 0, c.width, c.height); g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 30) n++; return n; }, [a.toString('base64'), b.toString('base64')]);
const imp = {};
for (const name of await p.evaluate(() => Object.keys(window.__QA.impacts || {}))) {
  const r = await p.evaluate((nm) => { const st = window.__QA.impacts[nm], bare = structuredClone(st); bare.run.en = []; LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE.hero; LIB.TRACE = null;
    const Z = DATA.ZOOM || 1, gx = j.grip[0] * Z, gy = j.grip[1] * Z, tx = j.tip[0] * Z, ty = j.tip[1] * Z;   // joints are in view px
    window.__imp = { st, bare }; return { len: Math.hypot(j.tip[0] - j.grip[0], j.tip[1] - j.grip[1]), box: [Math.max(0, Math.min(gx, tx) - 12), Math.max(0, Math.min(gy, ty) - 12), Math.abs(tx - gx) + 24, Math.abs(ty - gy) + 24].map(Math.round) }; }, name);
  const st = await p.evaluateHandle(() => window.__imp.st), bare = await p.evaluateHandle(() => window.__imp.bare);
  const shot = async (h, hide) => { await p.evaluate(([s, hide]) => { SCENE.hide.weapon = hide; SCENE.state = s; SCENE.render(s.t + 0.01); SCENE.hide.weapon = 0; }, [h, hide]); return p.screenshot({ clip: { x: r.box[0], y: r.box[1], width: r.box[2], height: r.box[3] } }); };
  r.withT = await pixDiff(await shot(st, 0), await shot(st, 1)); r.without = await pixDiff(await shot(bare, 0), await shot(bare, 1)); delete r.box; imp[name] = r; }
const L0 = []; const LV = [];
for (const [name, r] of Object.entries(imp)) { const a = +name.slice(1), vis = r.without ? r.withT / r.without : 1; r.vis = +vis.toFixed(2);
  if (Math.abs(Math.abs(a) - 90) <= 23) LV.push(r.len); if (Math.abs(a) <= 23 || Math.abs(a) >= 157) L0.push(r.len);
  const bad = vis < VIS_MIN; if (bad) fails++; console.log(`${bad ? 'FAIL' : 'ok  '} impact ${name}°: blade ${(vis * 100).toFixed(0)}% visible over the body (${r.withT}/${r.without} px), length ${r.len.toFixed(1)}`); }
const mean = (v) => v.reduce((x, y) => x + y, 0) / Math.max(1, v.length), depth = mean(LV) / mean(L0); rep.impacts = imp; rep.depthRatio = +depth.toFixed(2);
{ const bad = !(depth <= DEPTH_MAX); if (bad) fails++; console.log(`${bad ? 'FAIL' : 'ok  '} blade toward/away from the camera ${(depth * 100).toFixed(0)}% of its side length (max ${DEPTH_MAX * 100}%)`); }
// ---- views: each walk cycle draws the side it travels in ----
const views = await p.evaluate(() => Object.fromEntries(['hero_right', 'hero_left', 'hero_down', 'hero_up'].map((nm) => [nm, window.__QA.cycles[nm].map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const v = LIB.TRACE.hero_view; LIB.TRACE = null; return v ? v.back[0] : null; })])));
for (const [nm, v] of Object.entries(views)) { const want = nm === 'hero_up' ? 1 : 0, bad = v.some((x) => x === null || Math.abs(x - want) > 0.01); if (bad) fails++;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${nm}: draws the ${want ? 'back' : 'front'} view (back = ${[...new Set(v.map((x) => x === null ? '?' : +x.toFixed(2)))].join(', ')})`); }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(rep, null, 1));
if (errors.length) { console.log('page errors:', errors.slice(0, 5)); fails++; }
await browser.close(); srv.close();
process.exit(fails ? 2 : 0);
