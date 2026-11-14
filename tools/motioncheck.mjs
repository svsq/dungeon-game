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
//   amble     — *_amble loops (TASKS 1938): a foe's step at its post; a foot moving under AMB_V px a frame is planted, and over
//               each planted run it drifts at most AMB px from where it was set down, while the feet do step at least 3 px
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
//   fists     — golem_attack: while the fists rest on the floor neither stands more than FIST px over the slam's line (the far one hung at 35)
//   crust     — golem_crust_off: the molten share of the golem's box grows by CRUST once its plates are knocked off
//   leapSpacing, leapPose, throw — imp_leap, imp_attack (TASKS 489): an even flight, legs that push off, tuck and reach, and an
//               overhand throw from behind the head
//   kneeLow   — colossus_fists (TASKS 1965): a knee under its ankle by 2 px and more on fewer than KNEE_N frames
//   breathBody — salamander_breath: drawing its breath, the snout leaves its rest by at least BREATH of the body's length (TASKS 460:
//               the fire hung on a still head, 2 px)
//   flicker   — the fire priest's ring, a vent's and a surge's warning, and the smouldering skeleton's flames and arms: no jump in alpha, width or
//               hand from one frame to the next, deep into a run (TASKS 1688)
//   cover     — secret_shelf*, secret_statue* (TASKS 1851): the sliding cover is drawn at its own size and proportions shut, on its way,
//               at its stop and after a save and a load (the bookcase squeezed to a strip as it moved off its cache)
//   reach     — *_attack of the monsters (TASKS 1801): a hand leaves its place against the hip by REACH of the height
//   glide     — walk cycles (TASKS 1801): some joint travels GLIDE of the height against the ground point (a robe slid); townsfolk warn
//   cadence   — walk cycles (TASKS 1802): at most STEPS steps a second, a biped's step at least STEP of its height; townsfolk warn
//   lies      — hero_*death (TASKS 1803) and the monsters' *_death but the crab's (TASKS 1907): lying (hip under LOW of the height),
//               no hand or tip over UP of it; inertia — hero_*death_run: the hip's way over the first 0.3 s goes the way he ran
//   recoil    — hit_* on a light body (TASKS 1804): the head is thrown against the hip by RECOIL of the height
//   same      — monster attacks pairwise, the mage's shot/frost/cast per aim, the three hero deaths (TASKS 1805): the near hand's paths
//               against the hip correlate at most SAME in x and in y at the best lag (one motion reused)
//   body      — transitions named shoot|cast|frost|volley|whirl|attack|swing (TASKS 1800): the head moves against the hip by BODY of the
//               height (a shot made with the arm alone left the body standing as at rest)
// Exit 2 when any check fails.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const AMB = 2, AMB_V = 0.5, BREATH = 0.15, ARM_UP = 1.5 * Math.PI, SPAN = 1.2 * Math.PI, FLINCH = 0.04, FLAT = 0.25, HIP = 0.008, HEAD = 0.012, CAST = 0.15, PHASE = -0.3, AIM_R = 0.25, AIM = 75, WORK = 0.12, CRUST = 0.05;
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
for (const nm of meta.loops.filter((n) => n.endsWith('_amble'))) {
  const fr = (await trace('loops', nm)).map((f) => f.en).filter(Boolean); if (fr.length < 2) { report('amble', nm, false, 'no trace'); continue; }
  let slide = 0, moved = 0;
  for (const k of ['ankleL', 'ankleR']) { if (!fr.every((j) => j[k])) continue; let run = null;
    moved = Math.max(moved, Math.hypot(fr[fr.length - 1][k][0] - fr[0][k][0], fr[fr.length - 1][k][1] - fr[0][k][1]));
    for (let i = 1; i < fr.length; i++) { const d = Math.hypot(fr[i][k][0] - fr[i - 1][k][0], fr[i][k][1] - fr[i - 1][k][1]);
      if (d < AMB_V) { run = run || fr[i - 1][k]; slide = Math.max(slide, Math.hypot(fr[i][k][0] - run[0], fr[i][k][1] - run[1])); } else run = null; } }
  report('amble', nm, slide <= AMB && moved >= 3, `a planted foot slides ${slide.toFixed(1)} px (max ${AMB}), the feet step ${moved.toFixed(1)} px`);
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
for (const kind of ['shelf', 'statue']) {
  const r = await p.evaluate((kind) => window.__QA.states.filter((q) => q[0].startsWith('secret_' + kind)).map(([nm, st]) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
    const id = Object.keys(LIB.TRACE).find((k) => k.startsWith(kind === 'shelf' ? 'shelf' : 'cover')), j = id ? LIB.TRACE[id] : null; LIB.TRACE = null; return [nm, j]; }), kind);
  // (TASKS 1852) a bookcase is never moved: whole at its full size until it breaks, then gone to planks, after a load too
  const broken = (nm) => kind === 'shelf' && /_(break|books|open|loaded)/.test(nm);
  for (const [nm, j] of r) { if (broken(nm)) { report('cover', nm, !j, j ? 'a broken bookcase is still drawn' : 'broken, no bookcase drawn'); continue; }
    if (!j) { report('cover', nm, false, 'no cover drawn'); continue; }
    const w = j.br[0] - j.tl[0], h = j.br[1] - j.tl[1], w0 = r[0][1] ? r[0][1].br[0] - r[0][1].tl[0] : w, h0 = r[0][1] ? r[0][1].br[1] - r[0][1].tl[1] : h;
    report('cover', nm, Math.abs(w - w0) < 0.5 && Math.abs(h - h0) < 0.5, `${w.toFixed(1)}×${h.toFixed(1)} px against ${w0.toFixed(1)}×${h0.toFixed(1)} shut`); } }
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
// (TASKS 1156, 1175: 40 → 45, the ragged shore moves it 38–44 at any noise strength; the defect this guards was thousands of px; TASKS 1951: the camera
// raised 64 px lights the same frame differently, 44 → 46 with the salamander drawn the same, so 48) submergedClip: a salamander under the lava changes the bank by no more than 48 px, and by no more than 400 from a frame to the next
for (const nm of ['salamander_emerge', 'salamander_submerge']) { if (!meta.tr.includes(nm)) continue;
  const r = await p.evaluate((nm) => { const Q = window.__QA, c = document.getElementById('c'), g = c.getContext('webgl2'), W = c.width, H = c.height, grab = (st) => { SCENE.state = st; SCENE.render(st.t + 0.01); const a = new Uint8Array(W * H * 4); g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, a); return a; };
    return Q.transitions[nm].map((st) => { const e = st.run.en[0], m = st.run.map; if (!e) return null; const ss = (a, b, v) => { const q = Math.max(0, Math.min(1, (v - a) / (b - a))); return q * q * (3 - 2 * q); }, u0 = st.t - (e.lvT ?? -9), sw = e.lv ? ss(0, 0.35, u0) : 1 - ss(0, 0.35, u0); const a = grab(st), s0 = structuredClone(st); s0.run.en = []; const b = grab(s0); let n = 0; const k = W / 1920, cam = st.run.cam;
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const i = (H - 1 - y) * W * 4 + x * 4; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) <= 40) continue; const wx = cam[0] + x / k, wy = cam[1] + y / k; if (Math.abs(wx - e.x) < 140 && Math.abs(wy - e.y) < 70 && m.cells[Math.floor(wy / 32) * m.W + Math.floor(wx / 32)] !== 3) n++; } return { sw, n, st: e.st }; }).filter(Boolean); }, nm);
  const sunk = Math.max(0, ...r.filter((q) => q.sw >= 0.5).map((q) => q.n)), pop = Math.max(0, ...r.slice(1).map((q, i) => Math.abs(q.n - r[i].n))); report('submergedClip', nm, sunk <= 48 && pop <= 400, `the bank changes by ${sunk} px while it is sunk (≤ 48), by at most ${pop} px from a frame to the next (≤ 400)`); }
// the golem's slam (TASKS 458): on the first frame of its strike both fists lie in the slam's zone and before its ground point
if (meta.tr.includes('golem_attack')) {
  const fr = await p.evaluate(() => { const Q = window.__QA, id = Q.subject.golem_attack; return Q.transitions.golem_attack.map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
    const e = st.run.en[0] || {}, h = st.run.hero; const o = { st: e.st, ex: e.x, ey: e.y, aim: e.aimA, hx: h.x, en: LIB.TRACE[id] || null, hero: LIB.TRACE.hero || null }; LIB.TRACE = null; return o; }); });
  const G0 = await p.evaluate(() => DATA.ENEMIES.golem.slam), f = fr.find((q) => q.st === 'strike' && q.en && q.hero);
  if (!f || !f.en.handL || !f.en.handR) report('slam', 'golem_attack', false, 'no strike frame with both hands');
  else { const s = Math.abs(f.hero.ground[0] - f.en.ground[0]) / Math.abs(f.hx - f.ex), c = [f.en.ground[0] + Math.cos(f.aim) * G0.at * s, f.en.ground[1] + Math.sin(f.aim) * G0.at * 0.8 * s], dir = Math.sign(Math.cos(f.aim)) || 1;
    const far = ['L', 'R'].map((k) => { const q = f.en['hand' + k]; return [k, Math.hypot(q[0] - c[0], (q[1] - c[1]) / 0.7) / s, (q[0] - f.en.ground[0]) * dir / s]; });
    report('slam', 'golem_attack', far.every(([, d, fw]) => d <= G0.r && fw >= 0), far.map(([k, d, fw]) => `hand ${k} ${d.toFixed(0)} px from the slam's centre (r ${G0.r}), ${fw.toFixed(0)} px before the ground`).join(', '));
    // (TASKS 1054) while they rest on the floor (the strike's first GOLEM_SLAM.hold s, 1/60 s a frame) both fists lie no more than
    // FIST px over the slam's line: the far one hung 35.5 px by this measure, 17.7 after 1054; the 12 asked takes a longer arm in the
    // rig (TASKS 1156), so the line holds what the pose can do and stops it sliding back
    const FIST = 12, held = fr.filter((q) => q.st === 'strike' && q.en && q.en.handL && q.en.handR).slice(0, 12), up = Math.max(...held.map((q) => Math.max(...['L', 'R'].map((k) => (q.en.ground[1] + Math.sin(q.aim) * G0.at * 0.8 * s - q.en['hand' + k][1]) / s))));
    report('fists', 'golem_attack', up <= FIST, `the higher fist ${up.toFixed(1)} px over the slam's line while they rest (≤ ${FIST})`); } }
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
// the imp's leap and throw (TASKS 489). leapSpacing: over the middle half of its flight its step along the ground varies at most
// LEAP_SPAN times (eased all along, it went 2.7× faster at the middle); leapPose: the feet travel against the hip, the ankle's height
// under it ranging over at least LEAP_LEG of the leg (they hung the same, 8 %), and it lands lower than it flies (a crouch);
// throw: on its wind the throwing hand passes over the head and behind it
if (meta.tr.includes('imp_leap')) {
  const LEAP_SPAN = 1.5, LEAP_LEG = 0.35;
  const fr = await p.evaluate(() => { const Q = window.__QA, id = Q.subject.imp_leap; return Q.transitions.imp_leap.map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
    const e = st.run.en.find((q) => 'en' + q.id === id || q.id === id) || st.run.en[0] || {}; const o = { st: e.st, x: e.x, en: LIB.TRACE[id] || null }; LIB.TRACE = null; return o; }); });
  const fl = fr.filter((f) => f.st === 'leap' && f.en), xs = fl.map((f) => f.x), vs = xs.slice(1).map((x, i) => Math.abs(x - xs[i])).filter((v) => v > 0.01), mid = vs.slice(Math.floor(vs.length * 0.25), Math.ceil(vs.length * 0.75));
  const span = mid.length ? Math.max(...mid) / Math.min(...mid) : 99; report('leapSpacing', 'imp_leap', span <= LEAP_SPAN, `its step over the middle of the flight varies ${span.toFixed(2)}× (≤ ${LEAP_SPAN})`);
  const leg = Math.max(...fl.map((f) => Math.hypot(f.en.hipL[0] - f.en.kneeL[0], f.en.hipL[1] - f.en.kneeL[1]) + Math.hypot(f.en.kneeL[0] - f.en.ankleL[0], f.en.kneeL[1] - f.en.ankleL[1]))), dy = fl.map((f) => f.en.ankleL[1] - f.en.hip[1]);
  const range = (Math.max(...dy) - Math.min(...dy)) / leg; report('leapPose', 'imp_leap', range >= LEAP_LEG, `the ankle's height under the hip ranges over ${(range * 100).toFixed(0)} % of the leg (≥ ${LEAP_LEG * 100} %)`); }
if (meta.tr.includes('imp_attack')) {
  const fr = await p.evaluate(() => { const Q = window.__QA, id = Q.subject.imp_attack; return Q.transitions.imp_attack.map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
    const e = st.run.en.find((q) => 'en' + q.id === id || q.id === id) || st.run.en[0] || {}; const o = { st: e.st, face: e.face, en: LIB.TRACE[id] || null }; LIB.TRACE = null; return o; }); });
  const w = fr.filter((f) => f.st === 'wind' && f.en && f.en.handR), best = Math.max(-99, ...w.filter((f) => f.en.handR[1] < f.en.head[1]).map((f) => (f.en.head[0] - f.en.handR[0]) * f.face));
  report('throw', 'imp_attack', best > 0, `the throwing hand over the head reaches ${best.toFixed(0)} px behind it`); }
// kneeLow (TASKS 1965): on the colossus's fists the knees stay over the ankles; under them by 2 px and more on fewer than KNEE_N frames
// (held at the stomp's hip floor, the left knee folded 12 px under its ankle on 115 of 200)
if (meta.tr.includes('colossus_fists')) {
  const KNEE_N = 40, fr = await p.evaluate(() => { const Q = window.__QA, id = Q.subject.colossus_fists; return Q.transitions.colossus_fists.map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
    const o = LIB.TRACE[id] || null; LIB.TRACE = null; return o; }); });
  const low = fr.filter((j) => j && ['L', 'R'].some((sd) => j['knee' + sd] && j['ankle' + sd] && j['knee' + sd][1] > j['ankle' + sd][1] + 2)).length;
  report('kneeLow', 'colossus_fists', low < KNEE_N, `a knee 2 px and more under its ankle on ${low} of ${fr.length} frames (< ${KNEE_N})`); }
// strikePeak (TASKS 1716, 1719): a claw is fastest on its blow, not on its lift: the hand's fastest frame falls in the strike
if (meta.tr.includes('imp_claw')) {
  const fr = await p.evaluate(() => { const Q = window.__QA, id = Q.subject.imp_claw; return Q.transitions.imp_claw.map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
    const e = st.run.en.find((q) => 'en' + q.id === id || q.id === id) || st.run.en[0] || {}; const o = { st: e.st, en: LIB.TRACE[id] || null }; LIB.TRACE = null; return o; }); });
  const rel = (f) => [f.en.handR[0] - f.en.ground[0], f.en.handR[1] - f.en.ground[1]]; let pk = -1, v = 0;
  for (let i = 1; i < fr.length; i++) { if (!fr[i].en || !fr[i - 1].en || !fr[i].en.handR || !['wind', 'strike'].includes(fr[i].st)) continue; const a = rel(fr[i]), b = rel(fr[i - 1]), s = Math.hypot(a[0] - b[0], a[1] - b[1]); if (s > v) { v = s; pk = i; } }
  report('strikePeak', 'imp_claw', pk >= 0 && fr[pk].st === 'strike', `the hand's fastest frame ${pk} (${pk >= 0 ? fr[pk].st : '-'}) at ${v.toFixed(1)} px`); }
// crustFall (TASKS 1058): climbing out of the lava after a fall through the crust, frame by frame over its 0.55 s, at most CLIMB_POP of
// the hero's pixels show in one frame (half of him popped in at once); bridgeStep: walking down a chain bridge the hero's drop with the
// deck changes at most STEP_POP px a frame (stepping on he fell 9 px in one)
{ const CLIMB_POP = 400, STEP_POP = 3, STEP_LAG = 4;
  const climb = await p.evaluate(() => { const st0 = window.__QA.states.find((q) => q[0] === 'magma_crustclimb'); if (!st0) return null; const c = document.getElementById('c'), g = document.createElement('canvas'); g.width = 1920; g.height = 1080;
    const gx = g.getContext('2d', { willReadFrequently: true }), out = [];
    for (let i = 0; i <= 36; i++) { const S = structuredClone(st0[1]); S.run.hero.climbT = S.t - i / 60; const shot = () => { SCENE.state = S; SCENE.render(S.t + 0.01); gx.drawImage(c, 0, 0); return gx.getImageData(560, 240, 800, 600).data; };
      const a = shot(); SCENE.hide.hero = true; const b = shot(); SCENE.hide.hero = false; let n = 0; for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) > 40) n++; out.push(n); }
    return out; });
  if (!climb) report('crustFall', 'magma_crustclimb', false, 'no state'); else { const jumps = climb.slice(1).map((v, i) => v - climb[i]), mx = Math.max(...jumps); report('crustFall', 'magma_crustclimb', mx <= CLIMB_POP, `at most ${mx} of the hero's pixels show in one frame of the climb (≤ ${CLIMB_POP}); first frame ${climb[0]}`); }
  const deck = await p.evaluate(() => { const st0 = window.__QA.states.find((q) => q[0] === 'magma_chasm'); if (!st0) return null; const out = [];
    for (let i = -40; i <= 40; i++) { const S = structuredClone(st0[1]), h = S.run.hero, m = S.run.map, c = m.crossings.filter((q) => q.chasm).sort((a, b) => b.cells.length - a.cells.length)[0], hor = c.axis === 'x';
      if (hor) h.x += i * 4; else h.y += i * 4; h.vx = hor ? 175 : 0; h.vy = hor ? 0 : 175; h.dist = (h.dist || 0) + i * 4; SCENE.state = S; SCENE.render(S.t + 0.01); out.push([SCENE.deckDy(), SCENE.deckTgt()]); }
    return out; });
  if (!deck) report('bridgeStep', 'magma_chasm', false, 'no state'); else { const dy = deck.map((q) => q[0]), d = dy.slice(1).map((v, i) => Math.abs(v - dy[i])), mx = Math.max(...d), lag = Math.max(...deck.map((q) => Math.abs(q[0] - q[1]))); report('bridgeStep', 'magma_chasm', mx <= STEP_POP && lag <= STEP_LAG, `the hero's drop with the deck changes at most ${mx} px a frame walking across it (≤ ${STEP_POP}), stays within ${lag} px of the deck's sag (≤ ${STEP_LAG}); range ${Math.min(...dy)}–${Math.max(...dy)}`); } }
// flicker (TASKS 1688): a beat that quickens over a warning takes its phase from the integral of the rate. Built as the clock times the rate it
// raced thousands of rad/s deep into a run and the ring, the sparks and the flames strobed. In QA states set 40-200 s into a run, the
// alpha (or the flame's width) of the fire priest's ring, a vent's and a surge's warning, and the smouldering skeleton's tongues, and its
// hand against its shoulder, may change only a little from one frame to the next
{ const ALPHA = 0.2, WIDE = 0.1, HAND = 7, FRAMES = 20;
  const r = await p.evaluate(([FRAMES]) => { const hot = new Set(['1,0.35,0.1', '1,0.4,0.1', '1,0.45,0.1']), ring = LIB.ring, glow = LIB.glow, draw = G.draw, out = {};
    try { for (const [name, mode] of [['magma_priest', 'alpha'], ['magma_vent_warn', 'alpha'], ['magma_surge_warn', 'alpha'], ['magma_ember', 'flame']]) { const st0 = window.__QA.states.find((q) => q[0] === name); if (!st0) { out[name] = null; continue; }
        const S = structuredClone(st0[1]), R = S.run; let calls = [], prev = null, jump = 0, frames = 0, draws = 0, hand = 0, ph = null;
        LIB.ring = (x, y, rx, ry, col, amt, w) => { if (mode === 'alpha' && hot.has(col.join())) calls.push(amt); return ring(x, y, rx, ry, col, amt, w); };
        LIB.glow = (x, y, rr, col, amt, soft) => { if (mode === 'alpha' && hot.has(col.join())) calls.push(amt); return glow(x, y, rr, col, amt, soft); };
        G.draw = function (prog, u, xf) { if (mode === 'flame' && prog === LIB.P.flame && xf && xf[0] > 0) calls.push(xf[0]); return draw.apply(this, arguments); };
        const t0 = S.t, wind = R.en.find((e) => e.st === 'wind' && e.type === 'skel_ember');
        for (let i = 0; i < FRAMES; i++) { S.t = R.t = t0 + i / 60; calls = []; LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
          if (prev && prev.length === calls.length) { frames++; for (let k = 0; k < calls.length; k++) jump = Math.max(jump, mode === 'flame' ? Math.abs(calls[k] - prev[k]) / Math.max(1, prev[k]) : Math.abs(calls[k] - prev[k])); }
          prev = calls; draws = Math.max(draws, calls.length);
          if (wind) { const j = LIB.TRACE['en' + wind.id]; if (j && j.handL && j.shL) { const v = [j.handL[0] - j.shL[0], j.handL[1] - j.shL[1]]; if (ph) hand = Math.max(hand, Math.hypot(v[0] - ph[0], v[1] - ph[1])); ph = v; } } }
        out[name] = { frames, draws, jump, hand }; } } finally { LIB.ring = ring; LIB.glow = glow; G.draw = draw; LIB.TRACE = null; }
    return out; }, [FRAMES]);
  for (const [name, o] of Object.entries(r)) { if (!o) { report('flicker', name, false, 'no state'); continue; } const lim = name === 'magma_ember' ? WIDE : ALPHA;
    report('flicker', name, o.frames >= 8 && o.draws > 0 && o.jump <= lim && o.hand <= HAND, `${o.draws} draws, ${o.frames} frames, largest ${name === 'magma_ember' ? 'width' : 'alpha'} jump ${o.jump.toFixed(3)} (≤ ${lim})${name === 'magma_ember' ? `, hand against shoulder ${o.hand.toFixed(1)} px a frame (≤ ${HAND})` : ''}`); } }
// body (TASKS 1800): a shot, a cast, a whirl or an attack moves the body, not the arm alone: the head against the hip leaves its first
// frame's place by at least BODY of the height (the mage's and archer's shots and casts and the whirl moved it 0.00–0.01). A rig with no
// hip (a slime, a spider, a lizard) or one that is not a walker (the crab's shell) is not measured; x is taken along the facing, so a
// turn in the action is no lean
{ const BODY = 0.05, SKIP = /^crab_|^queen_|^slime|^spider_|^salamander_/, LATER = new Set();
  for (const nm of meta.tr.filter((n) => /shoot|cast|frost|volley|whirl|attack|swing/.test(n) && !SKIP.test(n) && !LATER.has(n))) {
    const fr = await p.evaluate((nm) => { const Q = window.__QA, id = Q.subject[nm]; return Q.transitions[nm].map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
      const j = LIB.TRACE[id] || null, v = LIB.TRACE[id + '_view']; LIB.TRACE = null; return j && j.hip && (j.head || j.top) ? { h: j.head || j.top, hip: j.hip, H: j.ground[1] - (j.top || j.head)[1], f: v && v.face ? v.face[0] : 1 } : null; }); }, nm);
    const ok = fr.filter(Boolean); if (ok.length < fr.length / 2) { report('body', nm, false, 'no hip or head in the trace'); continue; }
    const rel = (q) => [(q.h[0] - q.hip[0]) * q.f, q.h[1] - q.hip[1]], r0 = rel(ok[0]), H = ok[0].H, m = Math.max(...ok.map((q) => { const r = rel(q); return Math.hypot(r[0] - r0[0], r[1] - r0[1]); }));
    report('body', nm, m >= BODY * H, `the head moves ${m.toFixed(1)} px against the hip = ${(100 * m / H).toFixed(1)} % of ${H.toFixed(0)} px (≥ ${100 * BODY} %)`); } }
// reach (TASKS 1801): an attack throws a hand at least REACH of the height off its place against the hip (the robed casters' 0.05–0.09
// read as a tint flash, not a gesture). glide: a walk cycle moves some joint at least GLIDE of the height against the ground point (the
// robes slid at 0.06); the townsfolk only warn (TASKS 1807: the sweeper)
{ const REACH = 0.15, GLIDE = 0.1, warn = (check, nm, msg) => console.log(`WARN ${check} ${nm}: ${msg}`);
  for (const nm of meta.tr.filter((n) => /_attack$/.test(n) && !n.startsWith('hero'))) {
    const fr = (await trace('transitions', nm)).map((f) => f.en).filter((j) => j && j.hip && j.ground); if (!fr.length || !fr[0].top) continue;
    const H = tall(fr[0]), hands = ['handL', 'handR'].filter((k) => fr.every((j) => j[k])); if (!hands.length) continue;
    const m = Math.max(...hands.map((k) => { const r = (j) => [j[k][0] - j.hip[0], j[k][1] - j.hip[1]], r0 = r(fr[0]); return Math.max(...fr.map((j) => Math.hypot(r(j)[0] - r0[0], r(j)[1] - r0[1]))); }));
    report('reach', nm, m >= REACH * H, `a hand leaves its place against the hip by ${(100 * m / H).toFixed(1)} % of ${H.toFixed(0)} px (≥ ${100 * REACH} %)`); }
  for (const nm of await p.evaluate(() => Object.keys(window.__QA.cycles || {}).filter((n) => window.__QA.subject[n]))) {
    const fr = await p.evaluate((nm) => { const Q = window.__QA, id = Q.subject[nm]; return Q.cycles[nm].map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id] || null; LIB.TRACE = null; return j; }); }, nm);
    if (fr.some((j) => !j || !j.ground)) continue; const H = tall(fr[0]), keys = Object.keys(fr[0]).filter((k) => k !== 'ground' && !k.startsWith('target') && fr.every((j) => Array.isArray(j[k])));
    const m = Math.max(...fr.map((j) => Math.max(...keys.map((k) => Math.hypot(j[k][0] - j.ground[0] - fr[0][k][0] + fr[0].ground[0], j[k][1] - j.ground[1] - fr[0][k][1] + fr[0].ground[1])))));
    const msg = `the most moving joint travels ${(100 * m / H).toFixed(1)} % of ${H.toFixed(0)} px against the ground point (≥ ${100 * GLIDE} %)`;
    if (nm.startsWith('folk_') && m < GLIDE * H) warn('glide', nm, msg + ': glides'); else report('glide', nm, m >= GLIDE * H, msg); } }
// cadence (TASKS 1802): every walk cycle takes at most STEPS steps a second (2 / cycleT; the goblin stepped 15 times a second), and a
// biped's step is at least STEP of its height (the world distance over the cycle, the camera's follow added back; the skeleton's was
// 0.12); the townsfolk only warn (TASKS 1807)
{ const STEPS = 9, STEP = 0.15, cT = await p.evaluate(() => window.__QA.cycleT || {}), plod = /^(golem|boss_colossus)_/;   // (their plod is their weight: the colossus's gait was set in its own rounds)
  for (const nm of await p.evaluate(() => Object.keys(window.__QA.cycles || {}).filter((n) => window.__QA.subject[n]))) { if (!cT[nm]) continue;
    const fr = await p.evaluate((nm) => { const Q = window.__QA, id = Q.subject[nm]; return Q.cycles[nm].map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id] || null, c = (st.run && st.run.cam) || [0, 0]; LIB.TRACE = null;
      return j && j.ground ? { g: [j.ground[0] + c[0], j.ground[1] + c[1]], H: j.ground[1] - (j.top || j.head)[1], legs: !!(j.ankleL && j.ankleR) } : null; }); }, nm);
    if (fr.some((q) => !q)) continue; const n = fr.length, step = Math.hypot(fr[n - 1].g[0] - fr[0].g[0], fr[n - 1].g[1] - fr[0].g[1]) * n / (n - 1) / 2 / fr[0].H, sps = 2 / cT[nm];
    const legs = fr[0].legs && !plod.test(nm), ok = sps <= STEPS && (!legs || step >= STEP), msg = `${sps.toFixed(1)} steps a second (≤ ${STEPS})${fr[0].legs ? `, a step ${(100 * step).toFixed(0)} % of the height${legs ? ` (≥ ${100 * STEP} %)` : ' (a heavy plod, not held)'}` : ''}`;
    if (nm.startsWith('folk_') && !ok) console.log(`WARN cadence ${nm}: ${msg}`); else report('cadence', nm, ok, msg); } }
// lies (TASKS 1803): over the last 10 frames of a death, once the hip is down within LOW of the height of the floor, no hand and no held
// weapon's tip stands more than UP of it over the floor (the hero's near hand stayed 0.59 up, his sword standing in it)
{ const LOW = 0.1, UP = 0.35, RUNV = 0.5 * await p.evaluate(() => SIM.K.RUN);
  // (and the monsters' corpses, TASKS 1907; the crab is no biped and lies as it stands, the sinkers and the floaters leave no body, and a
  // skeleton's burst scatters its bones over the floor, where a bone's height on the screen is how far back it lies)
  for (const nm of meta.tr.filter((n) => /^hero.*_death(_run)?$/.test(n) || (/_death/.test(n) && !/^hero|^crab|^spider|^ghost|^serpent|^eel|^slime|_burst$/.test(n)))) {
    const fr = await p.evaluate((nm) => { const Q = window.__QA, id = Q.subject[nm]; return Q.transitions[nm].map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id] || null, h = st.run.hero; LIB.TRACE = null; return { j, t: st.t, vx: h.vx, vy: h.vy, dead: h.deadT }; }); }, nm);
    const ok = fr.map((f) => f.j).filter((j) => j && j.hip && j.ground); if (ok.length < fr.length / 2 || !ok[0].top) continue;
    const H = tall(ok[0]), up = (j, k) => (j[k] ? (j.ground[1] - j[k][1]) / H : -1), last = ok.slice(-10);
    if (last.every((j) => up(j, 'hip') < LOW)) { const hi = Math.max(...last.map((j) => Math.max(up(j, 'handL'), up(j, 'handR'), up(j, 'tip'))));
      report('lies', nm, hi <= UP, `lying, the highest hand or tip ${(100 * hi).toFixed(0)} % of the height over the floor (≤ ${100 * UP} %)`); }
    // (only the direction: the fall's size is tuned by eye, the sign is what the run gives it)
    if (/^hero.*_death_run$/.test(nm)) { const f0 = fr.find((f) => f.dead >= 0), f1 = f0 && fr.find((f) => f.t - f0.t >= 0.3), sp = f0 ? Math.hypot(f0.vx, f0.vy) : 0;
      if (!f0 || sp <= RUNV || !f1 || !f0.j || !f1.j) { report('inertia', nm, false, !f0 ? 'no frame with the hero dead' : sp <= RUNV ? `the run ${sp.toFixed(0)} px/s is not over ${RUNV.toFixed(0)}` : !f1 ? 'no frame 0.3 s after the death' : 'no trace'); continue; }
      const dx = (f1.j.hip[0] - f1.j.ground[0]) - (f0.j.hip[0] - f0.j.ground[0]); report('inertia', nm, Math.sign(dx) === Math.sign(f0.vx), `the hip moves ${dx.toFixed(1)} px over 0.3 s after the death, the run ${f0.vx.toFixed(0)} px/s`); } } }
// recoil (TASKS 1804): a blow on a light body (not heavy, narrower than the brute) throws its head against its hip by RECOIL of its height
// (every type nodded 0.05–0.08 and the knock-back moved the rest)
{ const RECOIL = 0.1, big = await p.evaluate(() => Object.fromEntries(Object.entries(DATA.ENEMIES).map(([k, E]) => [k, !!(E.heavy || E.r >= 20 || DATA.BOSSES[k])])));
  for (const nm of meta.tr.filter((n) => /^hit_|_hit$/.test(n) && !/_armor$|_crust$/.test(n))) { const ty = nm.replace(/^hit_|_hit$/g, ''); if (big[ty] !== false) continue;
    const fr = (await trace('transitions', nm)).map((f) => f.en).filter((j) => j && j.hip && (j.head || j.top)); if (fr.length < 10) continue;
    const H = tall(fr[0]), rel = (j) => [(j.head || j.top)[0] - j.hip[0], (j.head || j.top)[1] - j.hip[1]], r0 = rel(fr[0]), m = Math.max(...fr.map((j) => Math.hypot(rel(j)[0] - r0[0], rel(j)[1] - r0[1])));
    report('recoil', nm, m >= RECOIL * H, `the head is thrown ${(100 * m / H).toFixed(1)} % of ${H.toFixed(0)} px against the hip (≥ ${100 * RECOIL} %)`); } }
// same (TASKS 1805): two different actors' attacks, or one actor's skills, are not one motion: the near hand's path against the hip (in
// heights), x and y each correlated at the best lag within LAG frames, stays at or under SAME (the forge lord and the demon lord struck
// the brute's own blow point for point, the mage's shot, frost and cast were one pose, the three hero deaths one fall)
{ const SAME = 0.98, LAG = 12, paths = {};
  const pathOf = async (nm) => { if (paths[nm] !== undefined) return paths[nm]; const fr = (await trace('transitions', nm)).map((f) => (nm.startsWith('hero') ? f.hero : f.en)).filter((j) => j && j.hip && (j.handR || j.handL));
    if (fr.length < 20) return (paths[nm] = null); const H = tall(fr[0]), k = fr.every((j) => j.handR) ? 'handR' : 'handL'; return (paths[nm] = fr.map((j) => [(j[k][0] - j.hip[0]) / H, (j[k][1] - j.hip[1]) / H])); };
  const best = (P, Q) => { let m = -1; for (let l = -LAG; l <= LAG; l++) { const ax = [], bx = [], ay = [], by = []; for (let i = 0; i < P.length; i++) { const j = i + l; if (j < 0 || j >= Q.length) continue; ax.push(P[i][0]); bx.push(Q[j][0]); ay.push(P[i][1]); by.push(Q[j][1]); }
    if (ax.length > 20) m = Math.max(m, Math.min(corr(ax, bx), corr(ay, by))); } return m; };
  const atk = meta.tr.filter((n) => /_attack$/.test(n) && !n.startsWith('hero')), groups = [atk, ...['r', 'd', 'ul'].map((d) => ['shoot', 'frost', 'cast'].map((k) => `hero_mage_${k}_${d}`)), ['hero_death', 'hero_mage_death', 'hero_archer_death']];
  for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { if (!meta.tr.includes(g[i]) || !meta.tr.includes(g[j])) continue; const P = await pathOf(g[i]), Q = await pathOf(g[j]); if (!P || !Q) continue;
    const c = best(P, Q); if (c > SAME || g !== atk) report('same', `${g[i]}~${g[j]}`, c <= SAME, `the hand paths correlate ${c.toFixed(3)} (≤ ${SAME})`); } }
if (errors.length) { console.log('page errors:', errors.slice(0, 3).join(' | ')); fails++; }
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(res, null, 1));
console.log(fails ? `motioncheck: ${fails} failure(s)` : 'motioncheck: ok');
await browser.close(); srv.close(); process.exit(fails ? 2 : 0);
