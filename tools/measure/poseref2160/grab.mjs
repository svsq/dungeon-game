// the arch's hero and the world hero at rest per class, drawn with and without the hero, plus the rig's joints in canvas px (TASKS 2160)
//   node tools/measure/poseref2160/grab.mjs [--out frames/pose_ref_2160/game]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/pose_ref_2160/game'));
fs.mkdirSync(OUT, { recursive: true });
const G = await openGame();
const res = await G.page.evaluate(() => {
  const c = document.getElementById('c'), Q = SCENE.QA(), out = {};
  const grab = (S, box) => { SCENE.state = S; LIB.TRACE = {}; SCENE.render(S.t + 0.01); const [x0, y0, w, h] = box, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); return { png: cv.toDataURL('image/png'), trace: JSON.parse(JSON.stringify(LIB.TRACE || {})) }; };
  const ARCH = [700, 380, 540, 400];
  for (const cls of ['warrior', 'archer', 'mage']) {
    const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls });
    const mh = SCENE.menuHero; let pre = null; SCENE.menuHero = (...a) => { pre = a.slice(3); return mh(...a); };
    const all = grab(S, ARCH); SCENE.menuHero = () => {}; const none = grab(S, ARCH); SCENE.menuHero = mh;
    out['arch_' + cls] = { box: ARCH, all: all.png, none: none.png, joints: all.trace.menu || {}, pre };
  }
  const world = { warrior_right: Q.rest.hero_right, warrior_down: Q.rest.hero_down, archer_right: Q.rest.archer_right, archer_down: Q.rest.archer_down, mage_right: Q.rest.mage_right };
  for (const [n, S0] of Object.entries(world)) { if (!S0) continue;
    const S = structuredClone(S0); SCENE.state = S; LIB.TRACE = {}; SCENE.render(S.t + 0.01); const j = (LIB.TRACE.hero || {}), g = j.ground || [960, 540];
    const box = [Math.round(g[0] - 80), Math.round(g[1] - 150), 160, 180];
    const all = grab(S, box); SCENE.hide.hero = 1; const none = grab(S, box); delete SCENE.hide.hero;
    out['world_' + n] = { box, all: all.png, none: none.png, joints: all.trace.hero || {} };
  }
  return out;
});
for (const [n, r] of Object.entries(res)) {
  for (const k of ['all', 'none']) fs.writeFileSync(path.join(OUT, `${n}_${k}.png`), Buffer.from(r[k].split(',')[1], 'base64'));
  delete r.all; delete r.none;
}
fs.writeFileSync(path.join(OUT, 'joints.json'), JSON.stringify(res, null, 1));
console.log(Object.keys(res).join(' '), '\nerrors', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
