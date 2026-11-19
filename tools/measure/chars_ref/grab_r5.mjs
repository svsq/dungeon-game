// ref critic r5: the start arch and the class screen per class, and the live game's hero (SIM.step with real input) for each class:
// eight run directions sampled over the stride, a strike per aim, a hurt and a death; world crops at 1:1 around the hero's ground.
//   node tools/measure/chars_ref/grab_r5.mjs [--out frames/critic_chars_r5_ref/grab]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r5_ref/grab'));
fs.mkdirSync(OUT, { recursive: true });
const G = await openGame();
const res = await G.page.evaluate(() => {
  const c = document.getElementById('c'), out = {};
  const shot = (box) => { const [x0, y0, w, h] = box || [0, 0, c.width, c.height], cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); return cv.toDataURL('image/png'); };
  const render = (S, t) => { SCENE.state = S; LIB.TRACE = {}; SCENE.render(t); return JSON.parse(JSON.stringify(LIB.TRACE || {})); };
  const gear = (R, b, slot) => Object.assign(SIM.rollItem(R, 1, 0, slot), { b, id: R.nextId++ });
  const archS = (cls, kit) => { const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls }); const h = S.saved.hero;
    for (const [slot, b] of Object.entries(kit || {})) { if (b) h.eq[slot] = gear(S.saved, b, slot); else delete h.eq[slot]; } return S; };
  const ARCH = [640, 300, 660, 520];
  for (const [n, cls, kit] of [['warrior', 'warrior'], ['archer', 'archer'], ['mage', 'mage'], ['mage_orb_leather', 'mage', { armor: 'robe', helm: 'leather_helm', offhand: 'orb' }], ['mage_orb', 'mage', { armor: 'robe', offhand: 'orb' }]])
    for (const t of [0.01, 1.5]) { render(archS(cls, kit), t); out[`arch_${n}_t${t}`] = shot(ARCH); }
  for (const cls of ['warrior', 'archer', 'mage']) { const S = SIM.spawn(0, {}); SIM.step(S, { keys: [] }); S.meta.cls = cls; S.screen = 'classes'; S.pendingMode = 'campaign'; render(S, 1); out[`classes_${cls}`] = shot(); }
  const live = (cls, orb) => { const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 1234, { cls }); S.screen = 'play';
    if (orb) S.run.hero.eq.offhand = { id: 0, b: 'orb', rar: 0, lvl: 1, mods: {}, def: 4 };
    for (let i = 0; i < 40; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); S.run.en = []; S.run.msg = null; S.run.hero.ifr = 1e9; return S; };
  const crop = (S, name) => { const tr = render(S, S.t), g = (tr.hero || {}).ground; if (!g) { out[name] = null; return; } out[name] = shot([Math.round(g[0] - 70), Math.round(g[1] - 130), 140, 150]); };
  const DIRS = { r: [1, 0], dr: [1, 1], d: [0, 1], dl: [-1, 1], l: [-1, 0], ul: [-1, -1], u: [0, -1], ur: [1, -1] };
  const scr = (S, dx, dy) => { const h = S.run.hero, R = S.run, z = SIMX.D.ZOOM || 1; return [(h.x - R.cam[0]) * z + dx * 300, (h.y - 30 - R.cam[1]) * z + dy * 300]; };
  const meta = {};
  for (const [nm, cls, orb] of [['warrior', 'warrior'], ['archer', 'archer'], ['mage', 'mage'], ['mageorb', 'mage', 1]]) {
    const S0 = live(cls, orb); crop(S0, `live_${nm}_idle`); meta[nm] = { eq: Object.fromEntries(Object.entries(S0.run.hero.eq).map(([k, v]) => [k, v && v.b])) };
    for (const [dn, [dx, dy]] of Object.entries(DIRS)) {
      let S = structuredClone(S0); const inp = () => ({ px: scr(S, dx, dy)[0], py: scr(S, dx, dy)[1], keys: [], right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0 });
      const sample = [6, 30, 34, 38, 42, 46]; let k = 0;
      for (let f = 0; f <= 46; f++) { if (sample.includes(f)) { crop(S, `live_${nm}_run_${dn}_${k}`); meta[nm][dn + k] = { face: S.run.hero.face, back: S.run.hero.back }; k++; } SIM.step(S, inp()); }
      S = structuredClone(S); for (let f = 0; f < 40; f++) SIM.step(S, { px: scr(S, dx, dy)[0], py: scr(S, dx, dy)[1], keys: [] }); crop(S, `live_${nm}_stop_${dn}`);
    }
    for (const [an, a] of [['r', 0], ['d', Math.PI / 2], ['ul', -2.3], ['l', Math.PI]]) {
      let S = structuredClone(S0); for (let f = 0; f < 40; f++) { const p = scr(S, Math.cos(a), Math.sin(a)); if ([3, 9, 16, 26, 38].includes(f)) crop(S, `live_${nm}_atk_${an}_${f}`); SIM.step(S, { px: p[0], py: p[1], press: f < 2 ? 1 : 0, keys: [] }); }
    }
    { let S = structuredClone(S0); S.run.hero.hurtT = S.t; S.run.hero.hurtX = 1; for (let f = 0; f < 12; f++) { if (f === 3 || f === 8) crop(S, `live_${nm}_hurt_${f}`); SIM.step(S, { px: 960, py: 540, keys: [] }); } }
    { let S = structuredClone(S0); S.run.hero.ifr = 0; SIMX.killHero(S, S.run); for (let f = 0; f < 90; f++) { if ([5, 20, 45, 89].includes(f)) crop(S, `live_${nm}_death_${f}`); SIM.step(S, { px: 960, py: 540, keys: [] }); } }
    { const S = structuredClone(S0); render(S, S.t); out[`live_${nm}_full`] = shot(); }
  }
  out.__meta = meta;
  return out;
});
const meta = res.__meta; delete res.__meta;
for (const [n, v] of Object.entries(res)) if (v) fs.writeFileSync(path.join(OUT, `${n}.png`), Buffer.from(v.split(',')[1], 'base64'));
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
console.log(Object.keys(res).length, 'frames; missing', Object.entries(res).filter(([, v]) => !v).map(([k]) => k).join(' ') || 'none', '\nerrors', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
