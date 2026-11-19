// ref critic r3: how much of each limb part and the weapon shows in the drawn hero, against the part's own drawn area.
// Every view is drawn with LIB.sprite filtered: all, minus one part (visible = changed pixels), only that part of the hero (own area).
//   node tools/measure/chars_ref/arms.mjs [--out frames/critic_chars_r3_ref/arms]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r3_ref/arms'));
fs.mkdirSync(OUT, { recursive: true });
const PARTS = ['uarmL', 'farmL', 'fistL', 'uarmR', 'farmR', 'cuffR', 'fistR', 'weapon', 'body', 'cape', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'];
const G = await openGame();
const res = await G.page.evaluate((PARTS) => {
  const c = document.getElementById('c'), Q = SCENE.QA(), out = {}, sp0 = LIB.sprite;
  const HERO = /^(hero|archer|mage)__|^it_|^orb/;
  const key = (t) => { const m = /__([a-zA-Z]+)/.exec(t); return /^it_|^orb/.test(t) ? 'weapon' : m ? m[1].replace(/_.*$/, '') : t; };
  let filt = null;
  LIB.sprite = function (t, ...a) { if (filt && typeof t === 'string' && HERO.test(t) && !filt(key(t))) return; return sp0.call(this, t, ...a); };
  const px = (box) => { const [x0, y0, w, h] = box, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(c, x0, y0, w, h, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return n; };
  // the median colour of the part where it shows (pixels of the full hero that change when the part is left out), the ink outline left out
  const med = (a, b) => { const ch = [[], [], []]; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24 && Math.max(a[i], a[i + 1], a[i + 2]) > 40) for (let q = 0; q < 3; q++) ch[q].push(a[i + q]);
    return ch[0].length ? ch.map((v) => v.sort((x, y) => x - y)[v.length >> 1]) : null; };
  const seen = new Set();
  const measure = (draw, box) => {
    filt = null; seen.clear(); const sp1 = LIB.sprite; LIB.sprite = function (t, ...a) { if (typeof t === 'string' && HERO.test(t)) seen.add(key(t)); return sp1.call(this, t, ...a); };
    draw(); LIB.sprite = sp1; const all = px(box);
    filt = () => false; draw(); const none = px(box);
    const r = { hero: diff(all, none), drawn: [...seen] };
    for (const p of PARTS) { if (!seen.has(p)) continue;
      filt = (k) => k !== p; draw(); const wo = px(box), vis = diff(all, wo), rgb = med(all, wo);
      filt = (k) => k === p; draw(); const own = diff(px(box), none);
      r[p] = { vis, own, share: own ? +(vis / own).toFixed(3) : null, rgb }; }
    filt = null; return r; };
  const render = (S) => { SCENE.state = S; LIB.TRACE = {}; SCENE.render(S.t + 0.01); return JSON.parse(JSON.stringify(LIB.TRACE || {})); };
  for (const cls of ['warrior', 'archer', 'mage']) {
    const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls });
    out['arch_' + cls] = measure(() => render(S), [640, 300, 660, 520]);
  }
  const R = Q.rest;
  for (const [n, k] of [['rest_warrior_right', 'hero_shield_right'], ['rest_warrior_nos_right', 'hero_right'], ['rest_archer_right', 'archer_right'], ['rest_mage_right', 'mage_orb_right'], ['rest_mage_noorb_right', 'mage_right'],
    ['rest_warrior_down', 'hero_shield_down'], ['rest_archer_down', 'archer_down'], ['rest_mage_down', 'mage_orb_down']]) {
    const S0 = R[k]; if (!S0) continue; const tr = render(structuredClone(S0)), g = (tr.hero || {}).ground || [960, 540];
    out[n] = measure(() => render(structuredClone(S0)), [Math.round(g[0] - 90), Math.round(g[1] - 160), 180, 190]);
  }
  LIB.sprite = sp0;
  return out;
}, PARTS);
fs.writeFileSync(path.join(OUT, 'arms.json'), JSON.stringify(res, null, 1));
for (const [n, r] of Object.entries(res)) {
  console.log(`\n${n}  hero px ${r.hero}  drawn: ${r.drawn.join(' ')}`);
  for (const p of PARTS) if (r[p]) console.log(`  ${p.padEnd(7)} visible ${String(r[p].vis).padStart(5)} / own ${String(r[p].own).padStart(5)} = ${r[p].share}`);
}
console.log('\nerrors', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
