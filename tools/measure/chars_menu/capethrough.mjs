// where the cape shows through the figure at the near shoulder in the arch (r4, the author's frame 25): the cape's textures (and the
// quiver's) are swapped for flat magenta ones, the arch rendered over the idle; magenta pixels right of the near sleeve's outer edge and
// under the pauldron are the cape seen through the armpit. Worst moment saved ×7 beside the same moment with the real cape
//   node tools/measure/chars_menu/capethrough.mjs [--out frames/critic_chars_r4_menu/armpit] [--dur 6] [--dt 0.1]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r4_menu/armpit')), DUR = +opt('dur', 6), DT = +opt('dt', 0.1);
fs.mkdirSync(OUT, { recursive: true });
const CASES = [['warrior', 'warrior', {}], ['warrior_plate', 'warrior', { armor: 'plate_armor', weapon: 'sword' }], ['warrior_cloak', 'warrior', { armor: 'cloak', weapon: 'sword' }],
  ['archer', 'archer', {}], ['archer_cloak', 'archer', { armor: 'cloak', weapon: 'longbow' }], ['archer_leather', 'archer', { armor: 'leather_armor', weapon: 'shortbow' }],
  ['mage', 'mage', {}], ['mage_orb', 'mage', { weapon: 'staff', offhand: 'orb' }]];
const BOX = [820, 500, 940, 620];
const G = await openGame();
const swap = (names, magenta) => G.page.evaluate(async ([names, magenta]) => {
  for (const n of names) { if (!window.ASSETS[n]) continue; const im = new Image(); im.src = 'assets/' + n + '.png?v=' + Date.now(); await im.decode();
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    if (magenta) { const d = g.getImageData(0, 0, cv.width, cv.height); for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3] > 0) { d.data[i] = 255; d.data[i + 1] = 0; d.data[i + 2] = 255; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }
    await G.load(n, cv.toDataURL('image/png'), { nearest: SCENE.NEAREST === true || (SCENE.NEAREST || []).includes(n) }); } }, [names, magenta]);
const CAPES = ['hero__cape_menu', 'hero__cape', 'archer__cape_menu', 'archer__cape_hd_menu', 'archer__cape', 'archer__cape_hd', 'mage__cape_menu', 'mage__cape', 'archer__quiver_menu', 'archer__quiver'];
const res = [];
for (const [name, cls, eq] of CASES) {
  const run = (mark) => G.page.evaluate(([cls, eq, BOX, DUR, DT, mark]) => {
    const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls }); const R = S.saved;
    for (const [slot, b] of Object.entries(eq)) R.hero.eq[slot] = Object.assign(SIM.rollItem(R, 1, 0, slot), { b, id: R.nextId++ });
    SCENE.state = S;
    const c = document.getElementById('c'), [x0, y0, x1, y1] = BOX, W = x1 - x0, H = y1 - y0, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
    const rows = [], urls = {};
    for (let k = 0; k * DT <= DUR + 1e-9; k++) { const t = k * DT;
      SCENE.render(S.t + t); g.clearRect(0, 0, W, H); g.drawImage(c, x0, y0, W, H, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
      // enclosed: a magenta pixel with a figure pixel (not magenta, not the arch's dark) to its left within 14 px and to its right within 14 px
      const mag = (x, y) => { const i = (y * W + x) * 4; return d[i] > 200 && d[i + 1] < 60 && d[i + 2] > 200; };
      let n = 0; if (mark) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!mag(x, y)) continue; let l = 0, r = 0;
        for (let s = 1; s <= 14; s++) { if (!l && x - s >= 0 && !mag(x - s, y)) l = 1; if (!r && x + s < W && !mag(x + s, y)) r = 1; }
        // a pixel inside the cape's own outer band is not enclosed: needs figure on both sides within the band
        let lf = 0; for (let s = 1; s <= 14 && x - s >= 0; s++) if (!mag(x - s, y)) { lf = s; break; }
        if (l && r && lf) n++; }
      rows.push([+t.toFixed(2), n]); if (k === 0 || k === 8 || k === 9) urls[k] = cv.toDataURL('image/png'); }
    return { rows, urls };
  }, [cls, eq, BOX, DUR, DT, mark]);
  await swap(CAPES, true); const m = await run(true); await swap(CAPES, false); const p = await run(false);
  const ns = m.rows.map((q) => q[1]); const line = `${name.padEnd(15)} enclosed magenta px (arch, 1920 view): max ${Math.max(...ns)} min ${Math.min(...ns)} mean ${(ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(0)}`;
  res.push(line); console.log(line);
  for (const k of Object.keys(m.urls)) { fs.writeFileSync(path.join(OUT, `${name}_cape_t${k}.png`), Buffer.from(m.urls[k].split(',')[1], 'base64')); fs.writeFileSync(path.join(OUT, `${name}_real_t${k}.png`), Buffer.from(p.urls[k].split(',')[1], 'base64')); }
}
fs.writeFileSync(path.join(OUT, 'capethrough.txt'), res.join('\n') + `\nerrors: ${G.errors.length ? G.errors.join(' | ') : 'none'}\n`);
await G.close();
