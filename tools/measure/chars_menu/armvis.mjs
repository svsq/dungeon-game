// the arch's hero at ease, render-twice per arm: the screen pixels each arm's parts leave visible (the frame with them left out of
// LIB.sprite against the whole frame), their box and the lowest visible pixel over the soles in shares of the body's height (the body
// boxed without its weapon)
//   node tools/measure/chars_menu/armvis.mjs [--out frames/critic_chars_r3_menu]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r3_menu'));
const CASES = [['warrior', 'sword', {}], ['warrior', 'sword', { armor: 'plate_armor' }], ['mage', 'staff', {}], ['archer', 'shortbow', {}]];
const ARMS = { L: /__(uarmL|farmL|handL|fistL|cuffL)/, R: /__(uarmR|farmR|cuffR|fistR|handR)/ };
const G = await openGame();
const rows = await G.page.evaluate(([CASES, ARMS]) => {
  const c = document.getElementById('c'), X0 = 700, Y0 = 380, W = 520, H = 460, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
  const sp = LIB.sprite; let skip = null;
  LIB.sprite = (n, ...a) => (skip && skip.test(n) ? { w: 1, h: 1 } : sp(n, ...a));
  const grab = (S) => { SCENE.state = S; SCENE.render(S.t + 0.01); g.clearRect(0, 0, W, H); g.drawImage(c, X0, Y0, W, H, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
  const diff = (a, b) => { let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) { n++; const p = i / 4, x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { n, box: x1 < 0 ? null : [x0 + X0, y0 + Y0, x1 + X0, y1 + Y0] }; };
  const out = [];
  for (const [cls, b, eq] of CASES) {
    const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls }); const R = S.saved; R.hero.eq.weapon = Object.assign(SIM.rollItem(R, 1, 0, 'weapon'), { b, id: R.nextId++ });
    for (const [slot, base] of Object.entries(eq)) R.hero.eq[slot] = Object.assign(SIM.rollItem(R, 1, 0, slot), { b: base, id: R.nextId++ });
    const all = grab(S), mh = SCENE.menuHero; SCENE.menuHero = () => {}; const none = grab(S); SCENE.menuHero = mh;
    SCENE.hide.weapon = 1; const bare = grab(S); delete SCENE.hide.weapon; const body = diff(bare, none).box, row = { cls, b, eq: Object.values(eq).join(',') || '-', body };
    for (const [k, re] of Object.entries(ARMS)) { skip = new RegExp(re.slice(1, -1)); const wo = grab(S); skip = null; row[k] = diff(all, wo); }
    out.push(row);
  }
  LIB.sprite = sp;
  return out;
}, [CASES, Object.fromEntries(Object.entries(ARMS).map(([k, v]) => [k, String(v)]))]);
const lines = rows.map((r) => { const Hb = r.body[3] - r.body[1], up = (y) => ((r.body[3] - y) / Hb).toFixed(2);
  return `${(r.cls + ' ' + r.b + ' ' + r.eq).padEnd(30)} body ${JSON.stringify(r.body)}  ` + ['L', 'R'].map((k) => `${k} visible ${String(r[k].n).padStart(5)} px box ${JSON.stringify(r[k].box)} lowest ${r[k].box ? up(r[k].box[3]) : '-'} H`).join('  '); });
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'armvis.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
await G.close?.();
process.exit(0);
