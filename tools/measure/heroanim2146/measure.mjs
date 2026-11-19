// node tools/measure/heroanim2146/measure.mjs frames/hero_anim_2146/<label>.json [--cmp frames/hero_anim_2146/before.json]
// per class over its run, attack, hurt, death and turn sequences (SCENE.QA() cycles and transitions): the held weapon's anchor to the
// hand holding it, the frame-to-frame jump (p95, screen px about the hero's feet) of the grip, the weapon tip, the cape hem, the shield
// and the orb, and the planted foot's slide on the floor (screen px per frame while it bears weight)
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const args = process.argv.slice(2), out = args[0], cmp = args.includes('--cmp') ? args[args.indexOf('--cmp') + 1] : null;
const ROOT = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url));
const SEQ = {
  warrior: { run: ['hero_right', 'hero_left', 'hero_down', 'hero_up', 'hero_shield_right', 'hero_shield_left', 'hero_shield_down', 'hero_shield_up'], act: ['hero_swing_0', 'hero_swing_90', 'hero_swing_m90', 'hero_attack_r', 'hero_attack_d'], hurt: ['hero_hurt'], death: ['hero_death'], turn: ['hero_turn', 'hero_shield_turn'] },
  mage: { run: ['mage_right', 'mage_left', 'mage_down', 'mage_up', 'mage_wand_orb_right', 'mage_wand_orb_left', 'mage_wand_orb_down', 'mage_wand_orb_up'], act: ['hero_mage_shoot_r', 'hero_mage_cast_r', 'hero_mage_wand_orb_cast_r'], hurt: ['hero_mage_hurt'], death: ['hero_mage_death'], turn: ['hero_mage_shoot_turn', 'hero_mage_turn'] },
  archer: { run: ['archer_right', 'archer_left', 'archer_down', 'archer_up'], act: ['hero_archer_shoot_r', 'hero_archer_shoot_d', 'hero_archer_shoot_ul'], hurt: ['hero_archer_hurt'], death: ['hero_archer_death'], turn: ['hero_archer_shoot_turn', 'hero_archer_turn'] } };
const PTS = ['grip', 'tip', 'cape', 'shield', 'orb'];
const p95 = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(0.95 * s.length))].toFixed(1); };
const max = (a) => (a.length ? +Math.max(...a).toFixed(1) : null);
async function trace(names) {
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
    return await page.evaluate((names) => { const Q = SCENE.QA(), R = {};
      for (const name of names) { const list = Q.cycles[name] || Q.transitions[name] || (Q.swings || {})[name]; if (!list) { R[name] = null; continue; }
        R[name] = { cycle: !!Q.cycles[name], rows: list.map((S) => { LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const h = S.run.hero;
          return { j: JSON.parse(JSON.stringify(LIB.TRACE.hero || {})), x: h.x, y: h.y, zoom: DATA.ZOOM || 1 }; }) }; }
      return R; }, names);
  } finally { if (errors.length) console.log('errors:', errors.slice(0, 3).join(' | ')); await browser.close(); server.close(); }
}
function measure(seq) {
  const rel = (r, n) => (r.j[n] && r.j.ground ? [r.j[n][0] - r.j.ground[0], r.j[n][1] - r.j.ground[1]] : null), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const anchor = [], jump = Object.fromEntries(PTS.map((p) => [p, []])), slide = [];
  const rows = seq.cycle ? [...seq.rows, seq.rows[0]] : seq.rows;
  rows.forEach((r, i) => { if (r.j.grip && r.j.handR) anchor.push(Math.min(d(r.j.grip, r.j.handR), r.j.handL ? d(r.j.grip, r.j.handL) : 1e9));
    if (!i) return; const q = rows[i - 1];
    for (const p of PTS) { const a = rel(q, p), b = rel(r, p); if (a && b) jump[p].push(d(a, b)); }
    // a foot bears weight while its ankle is at its lowest over the sequence (side runs only: walking in depth the stance
    // ankle's height on screen changes with the floor's): its floor position should not move
    for (const s of ['L', 'R']) { const lo = Math.max(...rows.map((w) => (w.j['ankle' + s] ? w.j['ankle' + s][1] - w.j.ground[1] : -1e9)));
      const at = (w) => [(w.j['ankle' + s][0] - w.j.ground[0]) / w.zoom + w.x, (w.j['ankle' + s][1] - w.j.ground[1]) / w.zoom + w.y];
      if (!(seq.cycle && i === rows.length - 1) && q.j['ankle' + s] && r.j['ankle' + s] && lo - (q.j['ankle' + s][1] - q.j.ground[1]) < 1 && lo - (r.j['ankle' + s][1] - r.j.ground[1]) < 1) slide.push(d(at(q), at(r)) * r.zoom); } });
  return { anchorMax: max(anchor), anchorP95: p95(anchor), jump: Object.fromEntries(PTS.map((p) => [p, p95(jump[p])]).filter(([, v]) => v !== null)), jumpMax: Object.fromEntries(PTS.map((p) => [p, max(jump[p])]).filter(([, v]) => v !== null)), slideP95: p95(slide), frames: seq.rows.length };
}
const names = Object.values(SEQ).flatMap((c) => Object.values(c).flat()), T = await trace(names), res = {};
for (const [cls, g] of Object.entries(SEQ)) { res[cls] = {}; for (const [k, list] of Object.entries(g)) for (const n of list) if (T[n]) res[cls][n] = Object.assign({ kind: k }, measure(T[n])); }
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res, null, 1));
const old = cmp ? JSON.parse(fs.readFileSync(cmp, 'utf8')) : null, f = (v, w) => (w === undefined ? String(v) : `${w}→${v}`);
for (const [cls, g] of Object.entries(res)) { console.log('==', cls); for (const [n, m] of Object.entries(g)) { const o = old && old[cls] && old[cls][n];
  console.log(`${n.padEnd(28)} anchor max ${f(m.anchorMax, o && o.anchorMax)}  slide p95 ${f(m.slideP95, o && o.slideP95)}  jump p95 ` + Object.entries(m.jump).map(([p, v]) => `${p} ${f(v, o && o.jump[p])}`).join(', ') + '  max ' + Object.entries(m.jumpMax).map(([p, v]) => `${p} ${f(v, o && o.jumpMax && o.jumpMax[p])}`).join(', ')); } }
