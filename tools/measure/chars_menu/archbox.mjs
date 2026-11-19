// the arch's hero measured by render-twice (SCENE.hide.weapon; the hero left out by a no-op SCENE.menuHero): the box of the body without its weapon, the weapon's own box, how far the
// weapon reaches below the soles and past the arch's columns; per class and weapon, at the menu's mid pose
//   node tools/measure/chars_menu/archbox.mjs [--out frames/critic_chars_r1_menu]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r1_menu'));
const CASES = [['warrior', 'sword'], ['warrior', 'longsword'], ['warrior', 'axe'], ['warrior', 'hammer'], ['mage', 'staff'], ['mage', 'wand'], ['archer', 'shortbow'], ['archer', 'longbow'], ['archer', 'crossbow']];
const G = await openGame();
const rows = await G.page.evaluate((CASES) => {
  const c = document.getElementById('c'), X0 = 700, Y0 = 380, W = 520, H = 460, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
  const grab = (S) => { SCENE.state = S; SCENE.render(S.t + 0.01); g.clearRect(0, 0, W, H); g.drawImage(c, X0, Y0, W, H, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
  const box = (a, b) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) { const p = i / 4, x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return x1 < 0 ? null : [x0 + X0, y0 + Y0, x1 + X0, y1 + Y0]; };
  const hide = SCENE.hide, out = [];
  for (const [cls, b] of CASES) {
    const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls }); const R = S.saved; R.hero.eq.weapon = Object.assign(SIM.rollItem(R, 1, 0, 'weapon'), { b, id: R.nextId++ });
    for (const k in hide) delete hide[k];
    const all = grab(S), mh = SCENE.menuHero; SCENE.menuHero = () => {}; const none = grab(S); SCENE.menuHero = mh; hide.weapon = 1; const bare = grab(S); delete hide.weapon;
    out.push({ cls, b, hero: box(all, none), body: box(bare, none), weapon: box(all, bare) });
  }
  for (const k in hide) delete hide[k];
  return out;
}, CASES);
const lines = rows.map((r) => `${(r.cls + ' ' + r.b).padEnd(18)} body ${JSON.stringify(r.body)}  weapon ${JSON.stringify(r.weapon)}  below soles ${r.body && r.weapon ? r.weapon[3] - r.body[3] : '-'} px  height body ${r.body ? r.body[3] - r.body[1] : '-'}`);
fs.writeFileSync(path.join(OUT, 'archbox.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'), '\nerrors', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
