// ref critic r5, author remark 11 / task 2204: the mage's weapon arm (far arm R, screen-right) by layers, in the arch and the world,
// for each outfit, helm and weapon: all, none, without and alone for uarmR, farmR, cuffR, fistR and body, plus the sprite names drawn.
//   node tools/measure/chars_ref/mage_arm_r5.mjs [--out frames/critic_chars_r5_ref/mage_arm]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r5_ref/mage_arm'));
fs.mkdirSync(OUT, { recursive: true });
const G = await openGame();
const res = await G.page.evaluate(() => {
  const c = document.getElementById('c'), out = {}, sp0 = LIB.sprite;
  const key = (t) => { const m = /__([a-zA-Z]+)/.exec(t); return /^orb/.test(t) ? 'orb' : /^it_/.test(t) ? 'weapon' : m ? m[1] : t; };
  let filt = null, seen = [];
  LIB.sprite = function (t, ...a) { if (typeof t === 'string' && /^mage__|^it_|^orb/.test(t)) { seen.push(t); if (filt && !filt(key(t))) return; } return sp0.call(this, t, ...a); };
  const shot = (box) => { const [x0, y0, w, h] = box, cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); return cv.toDataURL('image/png'); };
  const render = (S, t) => { SCENE.state = S; LIB.TRACE = {}; SCENE.render(t); return JSON.parse(JSON.stringify(LIB.TRACE || {})); };
  const PARTS = ['uarmR', 'farmR', 'cuffR', 'fistR', 'body'];
  const layers = (name, S, t, box) => { seen = []; filt = null; render(S, t); const r = { sprites: [...new Set(seen)], img: { all: shot(box) } };
    filt = () => false; render(S, t); r.img.none = shot(box);
    for (const p of PARTS) { filt = (k) => k !== p; render(S, t); r.img['no_' + p] = shot(box); filt = (k) => k === p; render(S, t); r.img['only_' + p] = shot(box); }
    filt = null; out[name] = r; };
  const gear = (R, b, slot) => Object.assign(SIM.rollItem(R, 1, 0, slot), { b, id: R.nextId++ });
  const kitOn = (R, h, kit) => { for (const [slot, b] of Object.entries(kit)) { if (b) h.eq[slot] = gear(R, b, slot); else delete h.eq[slot]; } };
  const KITS = [];
  for (const armor of ['robe', 'leather_armor', 'cloak']) for (const helm of [null, 'leather_helm', 'circlet']) for (const weapon of ['staff', 'wand']) KITS.push([`${armor}_${helm || 'none'}_${weapon}`, { armor, helm, weapon }]);
  for (const [n, kit] of KITS) { const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls: 'mage' }); kitOn(S.saved, S.saved.hero, kit); layers(`arch_${n}`, S, 0.01, [820, 450, 220, 300]); }
  const live = (kit) => { const S = SIM.spawn(0, {}); SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 1234, { cls: 'mage' }); S.screen = 'play'; kitOn(S.run, S.run.hero, kit);
    for (let i = 0; i < 40; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); S.run.en = []; S.run.msg = null; S.run.hero.ifr = 1e9; return S; };
  for (const [n, kit] of KITS.filter(([n]) => !/leather_armor_(leather|circlet)/.test(n))) {
    const S0 = live(kit); const tr = render(S0, S0.t), g = (tr.hero || {}).ground; if (!g) continue;
    layers(`world_${n}`, S0, S0.t, [Math.round(g[0] - 50), Math.round(g[1] - 110), 100, 120]); }
  LIB.sprite = sp0;
  return out;
});
const meta = {};
for (const [n, r] of Object.entries(res)) { for (const [k, v] of Object.entries(r.img)) fs.writeFileSync(path.join(OUT, `${n}__${k}.png`), Buffer.from(v.split(',')[1], 'base64')); meta[n] = r.sprites; }
fs.writeFileSync(path.join(OUT, 'sprites.json'), JSON.stringify(meta, null, 1));
console.log(Object.keys(res).length, 'views\nerrors', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
