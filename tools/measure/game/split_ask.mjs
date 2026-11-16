// r10 game critic: the «how many» window (S.split) has no QA state; it is opened here over the shop (buy, sell) and the bag (take),
// with the count at 1, the middle and the top, and each one shot with its buttons' boxes from window.__UI (the «+» and «−» sizes).
//   node tools/measure/game/split_ask.mjs [out] > frames/critic_r10_game/split_ask.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(process.env.ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'));
process.chdir(ROOT);
const out = process.argv[2] || 'frames/critic_r10_game/split'; fs.mkdirSync(out, { recursive: true });
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const G = await openGame();
const cases = [['town_shop', 'sell', 'bag:0', 1], ['town_shop', 'sell', 'bag:0', 0.5], ['town_shop', 'buy', 'buy:0', 1], ['inv', 'take', 'bag:0', 0.5], ['inv', 'take', 'bag:0', 9]];
try {
  for (const [st, act, id, n] of cases) {
    const r = await G.page.evaluate(([st, act, id, n]) => {
      const S = SCENE.QA().states.find((q) => q[0] === st)[1], R = S.run, h = R.hero;
      if (!h.bag[0] || h.bag[0].n < 2) h.bag[0] = Object.assign({}, h.bag.find((x) => x && x.n > 1) || { k: 'potion', id: 'hp', n: 1 }, { n: 7 });
      const g = act === 'buy' ? R.shop.goods[0] : null, hi = act === 'buy' ? 9 : h.bag[0].n, k = n === 1 ? 1 : n === 9 ? hi : Math.ceil(hi * n);
      S.split = { id, n: k, hi, act }; S.hover = 'spPlus';
      S.t += 0.001; SCENE.state = S; SCENE.render(S.t);
      const ui = (window.__UI || []).filter((u) => /^sp_/.test(u.id)).map((u) => `${u.id}:${u.k}:${Math.round(u.x)},${Math.round(u.y)} ${Math.round(u.w)}x${Math.round(u.h)}${u.s ? ' «' + u.s + '»' : ''}`);
      return { hi, n: k, g: g && g.it && g.it.id, ui };
    }, [st, act, id, n]);
    const f = `${out}/split_${st}_${act}_${r.n}of${r.hi}.png`; await G.page.screenshot({ path: f });
    console.log(f, JSON.stringify(r));
  }
} finally { await G.close(); }
