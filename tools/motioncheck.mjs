// node tools/motioncheck.mjs [--json frames/motion.json] — this game's motion checks on the joint trace of SCENE.QA() transitions and
// loops (states 1/60 s apart), the defects the generic qa.mjs measures pass:
//   corpse    — *_death: on the last frame the head lies on the far side of the ground point from the hero who killed it, and the
//               body's box stays clear of the hero's (a body that fell the way it faced landed on its killer)
//   arm       — *_attack (skeleton, goblin, brute, boss): the weapon arm (shoulder → hand) sweeps at most SPAN of a turn over the whole
//               attack (the old chop wound it a full turn round the shoulder, a windmill) and travels at most ARM_UP up to the blow
//               (an overhead slam goes up the front and back down the same arc)
//   flinch    — hit_* and goblin_hit: the top moves at least FLINCH of the height 0.1–0.3 s after the blow, on every type
//   lunge     — spider_attack: the spider's ground stays at least the two bodies' radii short of the hero's (it stopped passing through)
//   flat      — spider_death: the body never collapses to a card while it turns over (its joints' height ≥ FLAT of the rest's)
//   breath    — *_idle loops: the hip and the head rise and fall at least HIP / HEAD of the height (a still pelvis passed "something moves")
//   cast      — hero_cast_*: the casting hand leaves its rest by at least CAST of the height (a cast down moved it 3 px)
// Exit 2 when any check fails.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const ARM_UP = 1.5 * Math.PI, SPAN = 1.2 * Math.PI, FLINCH = 0.04, FLAT = 0.25, HIP = 0.008, HEAD = 0.012, CAST = 0.15;
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
const meta = await p.evaluate(() => ({ tr: Object.keys(window.__QA.transitions), loops: Object.keys(window.__QA.loops), K: { R: SIM.K.R, HIT: SIM.K.HIT }, r: Object.fromEntries(Object.entries(DATA.ENEMIES).map(([k, v]) => [k, v.r])) }));
// the subject's and the hero's joints on every frame, plus when each frame is (s) and the monster's id
const trace = (kind, nm) => p.evaluate(([kind, nm]) => { const Q = window.__QA, id = Q.subject[nm]; return Q[kind][nm].map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
  const o = { t: st.t, st: (st.run.en[0] || {}).st, en: LIB.TRACE[id] || null, hero: LIB.TRACE.hero || null }; LIB.TRACE = null; return o; }); }, [kind, nm]);
const res = {}; let fails = 0;
const report = (check, nm, ok, msg) => { (res[check] = res[check] || {})[nm] = { ok, msg }; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${check} ${nm}: ${msg}`); };
const box = (j) => { const v = Object.values(j).filter((q) => Array.isArray(q)); return [Math.min(...v.map((q) => q[0])), Math.min(...v.map((q) => q[1])), Math.max(...v.map((q) => q[0])), Math.max(...v.map((q) => q[1]))]; };
const tall = (j) => j.ground[1] - j.top[1];
const unwrap = (a) => { const o = [a[0]]; for (let i = 1; i < a.length; i++) { let d = a[i] - a[i - 1]; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); o.push(o[i - 1] + d); } return o; };

for (const nm of meta.tr.filter((n) => /_death/.test(n) && !n.startsWith('hero') && !/^spider|^ghost|^skeleton_death$|^skeleton_death_burst$/.test(n))) {
  const fr = await trace('transitions', nm), L = fr[fr.length - 1]; if (!L.en || !L.hero) { report('corpse', nm, false, 'no trace'); continue; }
  const side = Math.sign(L.en.ground[0] - L.hero.ground[0]), lean = (L.en.head || L.en.top)[0] - L.en.ground[0], a = box(L.en), b = box(L.hero);
  const over = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  report('corpse', nm, lean * side >= 0 && over === 0, `head ${lean.toFixed(0)} px from the ground point, the hero on the ${side > 0 ? 'left' : 'right'}; overlap with the hero ${over.toFixed(0)} px²`);
}
for (const [nm, side] of [['skeleton_attack', 'L'], ['goblin_attack', 'L'], ['brute_attack', 'R'], ['boss_attack', 'R']]) { if (!meta.tr.includes(nm)) continue;
  const fr = await trace('transitions', nm), ok = fr.filter((f) => f.en && f.en['sh' + side] && f.en['hand' + side]);
  const a = unwrap(ok.map((f) => Math.atan2(f.en['hand' + side][1] - f.en['sh' + side][1], f.en['hand' + side][0] - f.en['sh' + side][0])));
  // up to the blow: the sim's switch to 'strike'; the boss strikes inside its own wind-up ('bwind'), so its whole attack is held to
  // the whole-attack bound only
  const at = ok.findIndex((f) => f.st === 'strike'), path = (to) => a.slice(1, to).reduce((s, v, i) => s + Math.abs(v - a[i]), 0);
  const all = path(a.length), up = at > 0 ? path(at + 1) : null, span = Math.max(...a) - Math.min(...a);
  if (process.env.ARMDUMP) console.log(nm, ok.map((f, i) => `${f.st[0]}${(a[i] / Math.PI).toFixed(2)}`).join(' '));
  report('arm', nm, (up === null || up <= ARM_UP) && span <= SPAN, `${up === null ? '' : `path to the blow ${(up / Math.PI).toFixed(2)}π, `}in all ${(all / Math.PI).toFixed(2)}π, span ${(span / Math.PI).toFixed(2)}π`);
}
for (const nm of meta.tr.filter((n) => /^hit_|_hit$/.test(n))) {
  const fr = await trace('transitions', nm), f0 = fr[4]; if (!f0 || !f0.en) { report('flinch', nm, false, 'no trace'); continue; }
  const H = tall(f0.en), rt = (j) => [j.top[0] - j.ground[0], j.top[1] - j.ground[1]], d = Math.max(...fr.slice(5 + 6, 5 + 19).filter((f) => f.en).map((f) => Math.hypot(rt(f.en)[0] - rt(f0.en)[0], rt(f.en)[1] - rt(f0.en)[1])));
  report('flinch', nm, d >= FLINCH * H, `top moves ${d.toFixed(1)} px = ${(100 * d / H).toFixed(1)} % of ${H.toFixed(0)} px`);
}
if (meta.tr.includes('spider_attack')) { const fr = await trace('transitions', 'spider_attack'), lim = meta.K.R + meta.r.spider;
  const gap = Math.min(...fr.filter((f) => f.en && f.hero).map((f) => f.en.ground[0] - f.hero.ground[0]));
  report('lunge', 'spider_attack', gap >= 0.8 * lim, `closest ${gap.toFixed(0)} px from the hero's ground (bodies ${lim} px)`); }
if (meta.tr.includes('spider_death')) { const fr = (await trace('transitions', 'spider_death')).filter((f) => f.en), hy = (j) => { const b = box(j); return b[3] - b[1]; };
  const h0 = hy(fr[0].en), lo = Math.min(...fr.map((f) => hy(f.en)));
  report('flat', 'spider_death', lo >= FLAT * h0, `lowest height ${lo.toFixed(0)} px = ${(100 * lo / h0).toFixed(0)} % of ${h0.toFixed(0)} px`); }
for (const nm of meta.loops.filter((n) => n.endsWith('_idle'))) {
  const fr = (await trace('loops', nm)).map((f) => (nm.startsWith('hero') ? f.hero : f.en)).filter(Boolean); if (!fr.length) continue;
  const H = tall(fr[0]), sp = (k) => { const v = fr.filter((j) => j[k]).map((j) => j[k][1] - j.ground[1]); return v.length ? Math.max(...v) - Math.min(...v) : null; }, hip = sp('hip'), head = sp('head') ?? sp('top');
  report('breath', nm, (hip === null || hip >= HIP * H) && head >= HEAD * H, `hip ${hip === null ? '—' : (100 * hip / H).toFixed(2) + ' %'}, head ${(100 * head / H).toFixed(2)} % of ${H.toFixed(0)} px`);
}
for (const nm of meta.tr.filter((n) => n.startsWith('hero_cast_'))) {
  const fr = (await trace('transitions', nm)).map((f) => f.hero).filter(Boolean), H = tall(fr[0]);
  const rel = (j, k) => [j[k][0] - j.ground[0], j[k][1] - j.ground[1]], mv = Math.max(...['handL', 'handR'].map((k) => Math.max(...fr.map((j) => Math.hypot(rel(j, k)[0] - rel(fr[0], k)[0], rel(j, k)[1] - rel(fr[0], k)[1])))));
  report('cast', nm, mv >= CAST * H, `a hand leaves its rest by ${mv.toFixed(0)} px = ${(100 * mv / H).toFixed(0)} % of ${H.toFixed(0)} px`);
}
if (errors.length) { console.log('page errors:', errors.slice(0, 3).join(' | ')); fails++; }
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(res, null, 1));
console.log(fails ? `motioncheck: ${fails} failure(s)` : 'motioncheck: ok');
await browser.close(); srv.close(); process.exit(fails ? 2 : 0);
