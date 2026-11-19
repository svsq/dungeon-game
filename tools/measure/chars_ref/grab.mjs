// ref critic, characters r2: every hero view drawn twice (with and without the hero) so the hero's own pixels come out as a clean mask
//   node tools/measure/chars_ref/grab.mjs [--out frames/critic_chars_r2_ref/game]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r2_ref/game'));
fs.mkdirSync(OUT, { recursive: true });
const G = await openGame();
const res = await G.page.evaluate(() => {
  const c = document.getElementById('c'), Q = SCENE.QA(), out = {};
  const shot = (box) => { const [x0, y0, w, h] = box, cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); return cv.toDataURL('image/png'); };
  const draw = (S) => { SCENE.state = S; LIB.TRACE = {}; SCENE.render(S.t + 0.01); return JSON.parse(JSON.stringify(LIB.TRACE || {})); };
  const ARCH = [640, 300, 660, 520];
  for (const cls of ['warrior', 'archer', 'mage']) {
    const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls });
    const mh = SCENE.menuHero; let at = null; SCENE.menuHero = (...a) => { at = a.slice(3, 6); return mh(...a); };
    const tr = draw(S); const all = shot(ARCH); SCENE.menuHero = () => {}; draw(S); const none = shot(ARCH); SCENE.menuHero = mh;
    out['arch_' + cls] = { box: ARCH, all, none, joints: tr.menu || {}, at };
  }
  const world = (name, S0) => { if (!S0) return; const S = structuredClone(S0); const tr = draw(S), g = (tr.hero || {}).ground || [960, 540];
    const box = [Math.round(g[0] - 90), Math.round(g[1] - 160), 180, 190]; const all = shot(box); SCENE.hide.hero = 1; draw(S); const none = shot(box); delete SCENE.hide.hero;
    out[name] = { box, all, none, joints: tr.hero || {} }; };
  const R = Q.rest;
  for (const [n, k] of [['rest_warrior_right', 'hero_shield_right'], ['rest_warrior_down', 'hero_shield_down'], ['rest_warrior_up', 'hero_shield_up'], ['rest_warrior_nos_right', 'hero_right'],
    ['rest_archer_right', 'archer_right'], ['rest_archer_down', 'archer_down'], ['rest_archer_up', 'archer_up'],
    ['rest_mage_right', 'mage_orb_right'], ['rest_mage_down', 'mage_orb_down'], ['rest_mage_up', 'mage_orb_up'], ['rest_mage_noorb_right', 'mage_right']]) world(n, R[k]);
  for (const [n, k] of [['run_warrior', 'hero_shield_right'], ['run_archer', 'archer_right'], ['run_mage', 'mage_orb_right']]) {
    const cy = Q.cycles[k]; if (!cy) continue; for (let i = 0; i < 4; i++) world(n + '_' + i, cy[Math.round(i * (cy.length - 1) / 4)]); }
  const T = Q.transitions || {};
  for (const [n, k, f] of [['act_warrior', 'hero_attack_r', 12], ['act_archer', 'hero_archer_shoot_r', 12], ['act_mage', 'hero_mage_orb_cast_r', 14]]) if (T[k]) world(n, T[k][f]);
  const cl = (Q.states.find((q) => q[0] === 'classes') || [])[1]; if (cl) { draw(cl); out.classes = { box: [0, 0, c.width, c.height], all: shot([0, 0, c.width, c.height]), none: null, joints: {} }; }
  return out;
});
for (const [n, r] of Object.entries(res)) {
  for (const k of ['all', 'none']) if (r[k]) fs.writeFileSync(path.join(OUT, `${n}_${k}.png`), Buffer.from(r[k].split(',')[1], 'base64'));
  delete r.all; delete r.none;
}
fs.writeFileSync(path.join(OUT, 'joints.json'), JSON.stringify(res, null, 1));
console.log(Object.keys(res).join(' '), '\nerrors', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
