// ref critic r4: the arch and world views drawn by layers, for the near-shoulder wedge and the mage's orb hand.
// Each view is drawn: all, no hero, without one part key, and that part alone over the empty scene; the arch over a sweep of its idle
// time, so the breath that opens the wedge is caught. Parts are keys of the hero's sprites (hero__cape -> cape, orb_held -> orb).
//   node tools/measure/chars_ref/grab_r4.mjs [--out frames/critic_chars_r4_ref/layers]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r4_ref/layers'));
fs.mkdirSync(OUT, { recursive: true });
const G = await openGame();
const res = await G.page.evaluate(() => {
  const c = document.getElementById('c'), Q = SCENE.QA(), out = {}, sp0 = LIB.sprite;
  const HERO = /^(hero|archer|mage)__|^it_|^orb/;
  const key = (t) => { const m = /__([a-zA-Z]+)/.exec(t); return /^orb/.test(t) ? 'orb' : /^it_/.test(t) ? 'weapon' : m ? m[1].replace(/_.*$/, '') : t; };
  let filt = null; const seen = {};
  LIB.sprite = function (t, ...a) { if (typeof t === 'string' && HERO.test(t)) { seen[key(t)] = t; if (filt && !filt(key(t))) return; } return sp0.call(this, t, ...a); };
  const shot = (box) => { const [x0, y0, w, h] = box, cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); return cv.toDataURL('image/png'); };
  const render = (S, t) => { SCENE.state = S; LIB.TRACE = {}; SCENE.render(t); return JSON.parse(JSON.stringify(LIB.TRACE || {})); };
  const ARCH = [640, 300, 660, 520];
  const layers = (name, S, t, box, parts, at) => {
    for (const k in seen) delete seen[k];
    filt = null; const tr = render(S, t); const r = { box, at, joints: tr.menu || tr.hero || {}, img: { all: shot(box) } };
    r.sprites = Object.assign({}, seen);
    filt = () => false; render(S, t); r.img.none = shot(box);
    for (const p of parts) { filt = (k) => k !== p; render(S, t); r.img['no_' + p] = shot(box); filt = (k) => k === p; render(S, t); r.img['only_' + p] = shot(box); }
    filt = null; out[name] = r;
  };
  const gear = (R, b, slot) => Object.assign(SIM.rollItem(R, 1, 0, slot), { b, id: R.nextId++ });
  const archS = (cls, kit) => { const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls }); const h = S.saved.hero;
    for (const [slot, b] of Object.entries(kit)) { if (b) h.eq[slot] = gear(S.saved, b, slot); else delete h.eq[slot]; } return S; };
  const mh = SCENE.menuHero; let at = null; SCENE.menuHero = (...a) => { at = a.slice(3, 6); return mh(...a); };
  const SH = ['cape', 'uarmL', 'body'], HAND = ['cupL', 'cuffL', 'farmL', 'orb', 'uarmL', 'body'];
  const TS = [0.01, 0.6, 1.2, 1.8, 2.4, 3.0];
  for (const t of TS) {
    layers(`arch_warrior_t${t}`, archS('warrior', {}), t, ARCH, SH, null); out[`arch_warrior_t${t}`].at = at;
    layers(`arch_archer_t${t}`, archS('archer', {}), t, ARCH, SH, null); out[`arch_archer_t${t}`].at = at;
  }
  for (const [n, kit] of [['robe_leather', { armor: 'robe', helm: 'leather_helm', offhand: 'orb' }], ['robe_none', { armor: 'robe', offhand: 'orb' }], ['robe_circlet', { armor: 'robe', helm: 'circlet', offhand: 'orb' }]]) {
    layers(`arch_mage_${n}`, archS('mage', kit), 0.01, ARCH, HAND, null); out[`arch_mage_${n}`].at = at; }
  SCENE.menuHero = mh;
  const world = (name, S0, parts) => { if (!S0) return; const S = structuredClone(S0); const tr = render(S, S.t + 0.01), g = (tr.hero || {}).ground || [960, 540];
    layers(name, structuredClone(S0), S0.t + 0.01, [Math.round(g[0] - 90), Math.round(g[1] - 160), 180, 190], parts, null); };
  const R = Q.rest;
  world('rest_mage_right', R.mage_orb_right, HAND); world('rest_mage_down', R.mage_orb_down, HAND);
  for (const [n, k] of [['rest_warrior_right', 'hero_right'], ['rest_warrior_shield_right', 'hero_shield_right'], ['rest_archer_right', 'archer_right'], ['rest_warrior_down', 'hero_down'], ['rest_archer_down', 'archer_down']]) world(n, R[k], SH);
  for (const [n, k, parts] of [['run_warrior', 'hero_right', SH], ['run_archer', 'archer_right', SH], ['run_mage', 'mage_orb_right', HAND]]) {
    const cy = Q.cycles[k]; if (!cy) continue; for (let i = 0; i < 6; i++) world(n + '_' + i, cy[Math.round(i * (cy.length - 1) / 6)], parts); }
  const T = Q.transitions || {};
  for (const [n, k, f, parts] of [['act_warrior', 'hero_attack_r', 12, SH], ['act_warrior_b', 'hero_attack_r', 4, SH], ['act_archer', 'hero_archer_shoot_r', 12, SH], ['act_archer_b', 'hero_archer_shoot_r', 4, SH], ['act_mage', 'hero_mage_orb_cast_r', 14, HAND]])
    if (T[k]) world(n, T[k][f], parts);
  LIB.sprite = sp0;
  return out;
});
const meta = {};
for (const [n, r] of Object.entries(res)) {
  for (const [k, v] of Object.entries(r.img)) fs.writeFileSync(path.join(OUT, `${n}__${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
  delete r.img; meta[n] = r;
}
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
console.log(Object.keys(res).join(' '), '\nerrors', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
