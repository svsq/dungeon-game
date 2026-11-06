// node tools/motioncheck.mjs [--json frames/motion.json] — this game's motion checks on the joint trace of SCENE.QA() transitions and
// loops (states 1/60 s apart), the defects the generic qa.mjs measures pass:
//   corpse    — *_death: on the last frame the head lies on the far side of the ground point from the hero who killed it, and the
//               body's box overlaps the hero's no more than it did standing (a body that fell the way it faced landed on its killer)
//   arm       — *_attack (skeleton, goblin, brute, boss): the weapon arm (shoulder → hand) sweeps at most SPAN of a turn over the whole
//               attack (the old chop wound it a full turn round the shoulder, a windmill) and travels at most ARM_UP up to the blow
//               (an overhead slam goes up the front and back down the same arc)
//   flinch    — hit_* and goblin_hit: the top moves at least FLINCH of the height 0.1–0.3 s after the blow, on every type
//   lunge     — spider_attack: the spider's ground stays at least the two bodies' radii short of the hero's (it stopped passing through)
//   flat      — spider_death: the body never collapses to a card while it turns over (its joints' height ≥ FLAT of the rest's)
//   breath    — *_idle loops: the hip and the head rise and fall at least HIP / HEAD of the height (a still pelvis passed "something moves")
//   cast      — hero_cast_*: the casting hand leaves its rest by at least CAST of the height (a cast down moved it 3 px)
//   phase     — side walk cycles (*_right, *_left): each arm's swing along the travel correlates with its own leg's at most PHASE (qa.mjs
//               fails only above +0.3, so arms a quarter cycle off the legs, 0.06, passed as swinging against them); an arm that holds
//               something and swings less than 4 % of the height is not measured
//   aim       — attacks: on an impact frame whose target stands more than AIM_R of the height from the grip, the blade points within
//               AIM of the target (qa.mjs takes the blade touching the target's body axis, which a fist next to it does at 146°)
//   prompt    — *prompt* states: the interaction plate (HUD.promptBox) stays clear of the hero's joint box (it sat on him at a chest)
//   work      — folk_*_work loops: the tool or the working hand travels at least WORK of the height over the loop (TASKS 1015)
//   blow      — folk_smith_work: the hammer's lowest point lies on the anvil's top (the blow lands on the anvil)
//   turn      — folk_talk, town_talk: talking, the smith's front hand is toward the hero, on either side of him
//   slam      — golem_attack: on the strike's first frame both fists lie within the slam's radius of its centre and before the
//               golem's ground point (the far one swung on past the body and lay behind it)
//   crust     — golem_crust_off: the molten share of the golem's box grows by CRUST once its plates are knocked off
//   breathBody — salamander_breath: drawing its breath, the snout leaves its rest by at least BREATH of the body's length (TASKS 460:
//               the fire hung on a still head, 2 px)
// Exit 2 when any check fails.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const BREATH = 0.15, ARM_UP = 1.5 * Math.PI, SPAN = 1.2 * Math.PI, FLINCH = 0.04, FLAT = 0.25, HIP = 0.008, HEAD = 0.012, CAST = 0.15, PHASE = -0.3, AIM_R = 0.25, AIM = 75, WORK = 0.12, CRUST = 0.05;
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

// (the serpent and the eel sink and leave no body; a body wider than it stands, a crab or a salamander, settles where it is and
// has no way to fall, so only its box is held: it may not spread over the hero more than it stood over him)
const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
for (const nm of meta.tr.filter((n) => /_death/.test(n) && !n.startsWith('hero') && !/^spider|^ghost|^serpent|^eel|^skeleton_death_burst$/.test(n))) {
  const fr = await trace('transitions', nm), F = fr.find((f) => f.en && f.hero), L = fr[fr.length - 1]; if (!F || !L.en || !L.hero) { report('corpse', nm, false, 'no trace'); continue; }
  const side = Math.sign(L.en.ground[0] - L.hero.ground[0]), lean = (L.en.head || L.en.top)[0] - L.en.ground[0], b0 = box(F.en), flat = b0[2] - b0[0] > b0[3] - b0[1];
  const over0 = overlap(b0, box(F.hero)), over = overlap(box(L.en), box(L.hero));
  report('corpse', nm, (flat || lean * side >= 0) && over <= over0, `head ${lean.toFixed(0)} px from the ground point${flat ? ' (flat, settles)' : ''}, the hero on the ${side > 0 ? 'left' : 'right'}; overlap with the hero ${over.toFixed(0)} px², ${over0.toFixed(0)} px² standing`);
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
for (const nm of meta.tr.filter((n) => /^hit_|_hit$/.test(n) && !/_armor$/.test(n))) {   // (a blow off the crab's armour is taken by its claws: the shell doesn't flinch)
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
if (meta.tr.includes('salamander_breath')) { const fr = (await trace('transitions', 'salamander_breath')).filter((f) => f.en && f.en.snout && f.en.tail), f0 = fr[0];
  const L = Math.hypot(f0.en.snout[0] - f0.en.tail[0], f0.en.snout[1] - f0.en.tail[1]), d = Math.max(...fr.map((f) => Math.hypot(f.en.snout[0] - f0.en.snout[0], f.en.snout[1] - f0.en.snout[1])));
  report('breathBody', 'salamander_breath', d >= BREATH * L, `snout leaves its rest ${d.toFixed(1)} px = ${(100 * d / L).toFixed(0)} % of ${L.toFixed(0)} px`); }
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
for (const nm of await p.evaluate(() => window.__QA.states.map((q) => q[0]).filter((n) => n.includes('prompt')))) {
  const r = await p.evaluate((nm) => { const st = window.__QA.states.find((q) => q[0] === nm)[1]; LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
    const o = { pb: HUD.promptBox, hero: LIB.TRACE.hero || null }; LIB.TRACE = null; return o; }, nm);
  if (!r.pb || !r.hero) { report('prompt', nm, false, r.pb ? 'no hero joints' : 'no prompt drawn'); continue; }
  const [x0, y0, x1, y1] = box(r.hero), [px, py, pw, ph] = r.pb, ix = Math.min(x1, px + pw) - Math.max(x0, px), iy = Math.min(y1, py + ph) - Math.max(y0, py);
  report('prompt', nm, ix <= 0 || iy <= 0, `plate ${px.toFixed(0)},${py.toFixed(0)} ${pw.toFixed(0)}×${ph} against hero ${x0.toFixed(0)},${y0.toFixed(0)}–${x1.toFixed(0)},${y1.toFixed(0)}`);
}
const corr = (a, b) => { const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length; let s = 0, sa = 0, sb = 0;
  a.forEach((x, i) => { s += (x - ma) * (b[i] - mb); sa += (x - ma) ** 2; sb += (b[i] - mb) ** 2; }); return s / Math.sqrt(sa * sb || 1); };
const cycles = await p.evaluate(() => Object.keys(window.__QA.cycles || {}).filter((n) => /_(right|left)$/.test(n) && window.__QA.subject[n]));
for (const nm of cycles) {
  const fr = await p.evaluate((nm) => { const Q = window.__QA, id = Q.subject[nm]; return Q.cycles[nm].map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
    const j = LIB.TRACE[id] || null, c = st.cam || [0, 0]; LIB.TRACE = null; return j && Object.fromEntries(Object.entries(j).filter(([, q]) => Array.isArray(q)).map(([k, q]) => [k, [q[0] + c[0], q[1] + c[1]]])); }); }, nm);
  if (fr.some((j) => !j)) { report('phase', nm, false, 'no trace'); continue; }
  const dx = Math.sign(fr[fr.length - 1].ground[0] - fr[0].ground[0]) || 1, cs = [];
  // an arm that holds something (the porter's crate, the child's grain bag) barely swings: no phase to measure
  const Hc = fr[0].ground[1] - (fr[0].top || fr[0].head)[1], amp = (s) => { const v = fr.map((j) => j['hand' + s][0] - j['sh' + s][0]); return Math.max(...v) - Math.min(...v); };
  for (const s of ['L', 'R']) { if (!fr.every((j) => j['hand' + s] && j['sh' + s] && j['ankle' + s] && j['hip' + s]) || amp(s) < 0.04 * Hc) continue;
    cs.push([s, corr(fr.map((j) => (j['hand' + s][0] - j['sh' + s][0]) * dx), fr.map((j) => (j['ankle' + s][0] - j['hip' + s][0]) * dx))]); }
  if (cs.length) report('phase', nm, cs.every(([, c]) => c <= PHASE), cs.map(([s, c]) => `arm ${s} vs its leg ${c.toFixed(2)}`).join(', '));
}
for (const nm of await p.evaluate(() => Object.keys(window.__QA.attacks || {}))) {
  const fr = await p.evaluate((nm) => { const A = window.__QA.attacks[nm]; return A.states.map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[A.subject] || null; LIB.TRACE = null; return j; }); }, nm);
  let worst = 0, n = 0; const bad = [];
  for (const j of fr) { if (!j || !j.grip || !j.tip || !j.target || !j.ground) continue; const H = j.ground[1] - (j.top || j.head)[1], tg = [j.target[0] - j.grip[0], j.target[1] - j.grip[1]];
    if (Math.hypot(tg[0], tg[1]) <= AIM_R * H) continue; n++;
    let d = Math.abs(Math.atan2(j.tip[1] - j.grip[1], j.tip[0] - j.grip[0]) - Math.atan2(tg[1], tg[0])) * 180 / Math.PI; d = Math.min(d, 360 - d); worst = Math.max(worst, d);
    if (d > AIM) bad.push(`${(Math.atan2(tg[1], tg[0]) * 180 / Math.PI).toFixed(0)}°→${d.toFixed(0)}°`); }
  report('aim', nm, !bad.length, `${n} far targets, worst blade error ${worst.toFixed(0)}°${bad.length ? ', off: ' + bad.join(' ') : ''}`);
}
// the golem's slam (TASKS 458): on the first frame of its strike both fists lie in the slam's zone and before its ground point
if (meta.tr.includes('golem_attack')) {
  const fr = await p.evaluate(() => { const Q = window.__QA, id = Q.subject.golem_attack; return Q.transitions.golem_attack.map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
    const e = st.run.en[0] || {}, h = st.run.hero; const o = { st: e.st, ex: e.x, ey: e.y, aim: e.aimA, hx: h.x, en: LIB.TRACE[id] || null, hero: LIB.TRACE.hero || null }; LIB.TRACE = null; return o; }); });
  const G0 = await p.evaluate(() => DATA.ENEMIES.golem.slam), f = fr.find((q) => q.st === 'strike' && q.en && q.hero);
  if (!f || !f.en.handL || !f.en.handR) report('slam', 'golem_attack', false, 'no strike frame with both hands');
  else { const s = Math.abs(f.hero.ground[0] - f.en.ground[0]) / Math.abs(f.hx - f.ex), c = [f.en.ground[0] + Math.cos(f.aim) * G0.at * s, f.en.ground[1] + Math.sin(f.aim) * G0.at * 0.8 * s], dir = Math.sign(Math.cos(f.aim)) || 1;
    const far = ['L', 'R'].map((k) => { const q = f.en['hand' + k]; return [k, Math.hypot(q[0] - c[0], (q[1] - c[1]) / 0.7) / s, (q[0] - f.en.ground[0]) * dir / s]; });
    report('slam', 'golem_attack', far.every(([, d, fw]) => d <= G0.r && fw >= 0), far.map(([k, d, fw]) => `hand ${k} ${d.toFixed(0)} px from the slam's centre (r ${G0.r}), ${fw.toFixed(0)} px before the ground`).join(', ')); } }
// the golem's crust (TASKS 458): with its plates knocked off the molten core shows over at least CRUST of its body (it changed only
// the cracks' glow before: the silhouette never told how much crust was left)
if (meta.tr.includes('golem_crust_off')) {
  const hot = await p.evaluate(() => { const Q = window.__QA, fr = Q.transitions.golem_crust_off, id = Q.subject.golem_crust_off, c = document.getElementById('c'), g = c.getContext('webgl2') || c.getContext('webgl');
    return [0, fr.length - 1].map((i) => { const st = fr[i]; LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id]; LIB.TRACE = null; if (!j) return null;
      const v = Object.values(j).filter((q) => Array.isArray(q)), x0 = Math.max(0, Math.round(Math.min(...v.map((q) => q[0])))), y0 = Math.max(0, Math.round(Math.min(...v.map((q) => q[1])))), x1 = Math.round(Math.max(...v.map((q) => q[0]))), y1 = Math.round(Math.max(...v.map((q) => q[1])));
      const w = x1 - x0, h = y1 - y0, px = new Uint8Array(w * h * 4); g.readPixels(x0, c.height - y1, w, h, g.RGBA, g.UNSIGNED_BYTE, px); let n = 0;
      for (let k = 0; k < w * h; k++) { const r = px[k * 4], gg = px[k * 4 + 1], b = px[k * 4 + 2]; if (r > 170 && gg > 60 && gg < 170 && b < 70) n++; } return n / (w * h); }); });
  if (hot.some((q) => q === null)) report('crust', 'golem_crust_off', false, 'no trace');
  else report('crust', 'golem_crust_off', hot[1] - hot[0] >= CRUST, `molten share of the golem's box ${(100 * hot[0]).toFixed(1)} % with its crust, ${(100 * hot[1]).toFixed(1)} % with it knocked off (at least +${100 * CRUST} %)`); }
// the townsfolk (TASKS 1015): every work loop moves the tool or the working hand by WORK of the height; the smith's hammer comes
// down onto the anvil's top (its lowest point in the loop inside the anvil's upper half); talking, the smith turns to the hero on
// either side of him (his front hand toward the hero)
for (const nm of meta.loops.filter((n) => /^folk_.*_work$/.test(n))) {
  const fr = (await trace('loops', nm)).map((f) => f.en).filter(Boolean); if (fr.length < 4) { report('work', nm, false, 'no trace'); continue; }
  const H = tall(fr[0]), span = (k) => { if (!fr.every((j) => j[k])) return 0; const rel = fr.map((j) => [j[k][0] - j.ground[0], j[k][1] - j.ground[1]]); return Math.max(...rel.map((a) => Math.max(...rel.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]))))); };
  const best = ['tip', 'handR', 'handL'].map((k) => [k, span(k)]).sort((a, b) => b[1] - a[1])[0];
  report('work', nm, best[1] >= WORK * H, `${best[0]} travels ${best[1].toFixed(0)} px = ${(100 * best[1] / H).toFixed(0)} % of ${H.toFixed(0)} px over the loop`);
}
if (meta.loops.includes('folk_smith_work')) {
  const r = await p.evaluate(() => { const Q = window.__QA, id = Q.subject.folk_smith_work, fr = Q.loops.folk_smith_work; let low = null;
    for (const st of fr) { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id]; LIB.TRACE = null; if (j && j.tip && (!low || j.tip[1] > low[1])) low = j.tip; }
    const st = fr[0], A = st.run.map.town.svc.anvil, [aw, ah] = SIZES.anvil_tw; return { low, x0: A.x - st.run.cam[0] - aw / 2, x1: A.x - st.run.cam[0] + aw / 2, y0: A.y - st.run.cam[1] - ah, y1: A.y - st.run.cam[1] - 0.45 * ah }; });
  report('blow', 'folk_smith_work', !!r.low && r.low[0] >= r.x0 && r.low[0] <= r.x1 && r.low[1] >= r.y0 && r.low[1] <= r.y1,
    r.low ? `hammer's lowest point ${r.low[0].toFixed(0)},${r.low[1].toFixed(0)}; the anvil's top ${r.x0.toFixed(0)}–${r.x1.toFixed(0)} × ${r.y0.toFixed(0)}–${r.y1.toFixed(0)}` : 'no trace');
}
for (const [kind, nm] of [['transitions', 'folk_talk'], ['states', 'town_talk']]) {
  const r = await p.evaluate(([kind, nm]) => { const Q = window.__QA, st = kind === 'states' ? Q.states.find((q) => q[0] === nm)?.[1] : Q.transitions[nm]?.at(-1); if (!st) return null;
    const id = 'npc' + st.run.folk.find((f) => f.role === 'smith').i; LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const o = { en: LIB.TRACE[id] || null, hero: LIB.TRACE.hero || null }; LIB.TRACE = null; return o; }, [kind, nm]);
  if (!r) continue; if (!r.en || !r.hero || !r.en.handR) { report('turn', nm, false, 'no trace'); continue; }
  const side = Math.sign(r.hero.ground[0] - r.en.ground[0]), hand = r.en.handR[0] - r.en.ground[0];
  report('turn', nm, hand * side > 0, `the front hand ${hand.toFixed(0)} px off his ground point, the hero on the ${side > 0 ? 'right' : 'left'}`);
}
if (errors.length) { console.log('page errors:', errors.slice(0, 3).join(' | ')); fails++; }
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(res, null, 1));
console.log(fails ? `motioncheck: ${fails} failure(s)` : 'motioncheck: ok');
await browser.close(); srv.close(); process.exit(fails ? 2 : 0);
