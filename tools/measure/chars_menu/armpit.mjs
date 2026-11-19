// the arch's near armpit over the idle (r4, the author's frame 25): the arch rendered every DT s for DUR s per class and kit; in a box
// under the near pauldron, between the sleeve and the chest, the pixels of the cape's red or olive (the cape seen through) and of the
// floor; the worst moment's crop is saved ×8
//   node tools/measure/chars_menu/armpit.mjs [--out frames/critic_chars_r4_menu/armpit] [--dur 6] [--dt 0.05]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r4_menu/armpit')), DUR = +opt('dur', 6), DT = +opt('dt', 0.05);
fs.mkdirSync(OUT, { recursive: true });
// [name, class, kit]; BOX: the crop round the near shoulder, x0 y0 x1 y1 in the 1920×1080 view
const CASES = [['warrior', 'warrior', {}], ['warrior_plate', 'warrior', { armor: 'plate_armor', weapon: 'sword' }], ['warrior_cloak', 'warrior', { armor: 'cloak', weapon: 'sword' }],
  ['archer', 'archer', {}], ['archer_cloak', 'archer', { armor: 'cloak', weapon: 'longbow' }], ['mage', 'mage', {}]];
const BOX = [830, 505, 925, 610];
const G = await openGame();
const res = [];
for (const [name, cls, eq] of CASES) {
  const r = await G.page.evaluate(([cls, eq, BOX, DUR, DT]) => {
    const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls }); const R = S.saved;
    for (const [slot, b] of Object.entries(eq)) R.hero.eq[slot] = Object.assign(SIM.rollItem(R, 1, 0, slot), { b, id: R.nextId++ });
    SCENE.state = S;
    const c = document.getElementById('c'), [x0, y0, x1, y1] = BOX, W = x1 - x0, H = y1 - y0, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
    const rows = []; let worst = null;
    for (let t = 0; t <= DUR + 1e-9; t += DT) {
      SCENE.render(S.t + t); g.clearRect(0, 0, W, H); g.drawImage(c, x0, y0, W, H, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
      // the armpit's box inside the crop: right of the sleeve's outer edge, under the pauldron, left of the chest's middle
      let red = 0, olive = 0;
      for (let y = 35; y < 85; y++) for (let x = 28; x < 62; x++) { const i = (y * W + x) * 4, rr = d[i], gg = d[i + 1], bb = d[i + 2];
        if (rr > 38 && rr > 2.1 * gg && rr > 2.1 * bb) red++;
        if (gg > rr * 1.02 && gg > bb * 1.25 && gg > 40 && gg < 130) olive++; }
      rows.push([+t.toFixed(2), red, olive]);
      if (!worst || red + olive > worst.n) worst = { n: red + olive, t, url: cv.toDataURL('image/png') };
    }
    return { rows, worst };
  }, [cls, eq, BOX, DUR, DT]);
  const reds = r.rows.map((q) => q[1]), olives = r.rows.map((q) => q[2]);
  const line = `${name.padEnd(14)} red max ${Math.max(...reds)} min ${Math.min(...reds)}  olive max ${Math.max(...olives)} min ${Math.min(...olives)}  worst at t ${r.worst.t.toFixed(2)} (${r.worst.n})`;
  res.push(line); console.log(line);
  fs.writeFileSync(path.join(OUT, name + '_worst.png'), Buffer.from(r.worst.url.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.tsv'), r.rows.map((q) => q.join('\t')).join('\n') + '\n');
}
fs.writeFileSync(path.join(OUT, 'armpit.txt'), res.join('\n') + `\nerrors: ${G.errors.length ? G.errors.join(' | ') : 'none'}\n`);
await G.close();
