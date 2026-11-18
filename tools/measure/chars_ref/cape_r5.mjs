// ref critic r5, author remark 7 (task 2202): the warrior's cloak per run direction in the live game, drawn alone (hero__cape only)
// and with the whole hero, so its length and colour can be set against the rest pose. Samples: the start of the walk (accelerating,
// frames 3..9) and the full run (frames 30..46), eight directions, the default kit and plate.
//   node tools/measure/chars_ref/cape_r5.mjs [--town] [--out frames/critic_chars_r5_ref/cape]   (--town: the town run's square, as the author's frames)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const TOWN = args.includes('--town'), OUT = path.resolve(ROOT, opt('out', TOWN ? 'frames/critic_chars_r5_ref/cape_town' : 'frames/critic_chars_r5_ref/cape'));
fs.mkdirSync(OUT, { recursive: true });
const G = await openGame();
const res = await G.page.evaluate((TOWN) => {
  const c = document.getElementById('c'), out = {}, sp0 = LIB.sprite, used = {};
  let filt = null, cur = null;
  LIB.sprite = function (t, ...a) { if (typeof t === 'string' && /^hero__|^it_/.test(t)) { if (cur) (used[cur] = used[cur] || new Set()).add(t); if (filt && !filt(t)) return; } return sp0.call(this, t, ...a); };
  const shot = (box) => { const [x0, y0, w, h] = box, cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); return cv.toDataURL('image/png'); };
  const render = (S) => { SCENE.state = S; LIB.TRACE = {}; SCENE.render(S.t); return JSON.parse(JSON.stringify(LIB.TRACE || {})); };
  const grab = (S, name) => { cur = name; filt = null; const tr = render(S), g = (tr.hero || {}).ground; if (!g) return; const box = [Math.round(g[0] - 70), Math.round(g[1] - 130), 140, 150];
    out[name] = { all: shot(box) }; filt = (t) => /^hero__cape/.test(t); render(S); out[name].cape = shot(box); filt = () => false; render(S); out[name].none = shot(box); filt = null; cur = null; };
  const live = (kit) => { const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', TOWN ? 77 : 1234, TOWN ? { cls: 'warrior', town: 1 } : { cls: 'warrior' }); S.screen = 'play';
    if (kit) { const h = S.run.hero; h.eq.armor = Object.assign(SIM.rollItem(S.run, 1, 0, 'armor'), { b: kit, id: S.run.nextId++ }); }
    for (let i = 0; i < 40; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); S.run.en = []; S.run.msg = null; S.run.hero.ifr = 1e9; return S; };
  const DIRS = { r: [1, 0], dr: [1, 1], d: [0, 1], dl: [-1, 1], l: [-1, 0], ul: [-1, -1], u: [0, -1], ur: [1, -1] };
  const scr = (S, dx, dy) => { const h = S.run.hero, R = S.run, z = SIMX.D.ZOOM || 1; return [(h.x - R.cam[0]) * z + dx * 300, (h.y - 30 - R.cam[1]) * z + dy * 300]; };
  for (const [kn, kit] of [['def', null], ['plate', 'plate']]) {
    const S0 = live(kit); grab(S0, `${kn}_rest`);
    { const S = structuredClone(S0); S.run.hero.face = -1; S.run.hero.faceT = S.t - 1; grab(S, `${kn}_rest_l`); }
    for (const [dn, [dx, dy]] of Object.entries(DIRS)) { let S = structuredClone(S0);
      for (let f = 0; f <= 46; f++) { if ([3, 6, 9].includes(f)) grab(S, `${kn}_walk_${dn}_${f}`); if ([30, 34, 38, 42, 46].includes(f)) grab(S, `${kn}_run_${dn}_${f}`);
        const p = scr(S, dx, dy); SIM.step(S, { px: p[0], py: p[1], keys: [], right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0 }); } }
  }
  LIB.sprite = sp0;
  out.__used = Object.fromEntries(Object.entries(used).map(([k, v]) => [k, [...v].filter((t) => /cape/.test(t))]));
  return out;
}, TOWN);
const used = res.__used; delete res.__used;
for (const [n, r] of Object.entries(res)) for (const [k, v] of Object.entries(r)) fs.writeFileSync(path.join(OUT, `${n}__${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
fs.writeFileSync(path.join(OUT, 'used.json'), JSON.stringify(used, null, 1));
console.log(Object.keys(res).length, 'views\nerrors', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
