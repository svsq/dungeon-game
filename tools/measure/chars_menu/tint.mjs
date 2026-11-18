// which sprite paints a spot of the arch: named textures are tinted (their luma kept, put in one channel), the arch rendered at time t
// and the box saved ×k next to the untinted one
//   node tools/measure/chars_menu/tint.mjs --cls warrior --tint hero__body_menu=g,hero__uarmL_menu=b [--eq armor:cloak] [--t 0.8] [--box 820,500,940,620] [--k 5] [--out frames/critic_chars_r4_menu/tint/x.png]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const CLS = opt('cls', 'warrior'), T = +opt('t', 0.8), BOX = opt('box', '820,500,940,620').split(',').map(Number), K = +opt('k', 5);
const EQ = Object.fromEntries((opt('eq', '') || '').split(',').filter(Boolean).map((s) => s.split(':')));
const TINT = (opt('tint', '') || '').split(',').filter(Boolean).map((s) => s.split('='));
const OUT = path.resolve(ROOT, opt('out', `frames/critic_chars_r4_menu/tint/${CLS}.png`)); fs.mkdirSync(path.dirname(OUT), { recursive: true });
const G = await openGame();
const shot = () => G.page.evaluate(([cls, eq, BOX, T]) => {
  const S = SIM.spawn(0, {}); S.saved = SIM.newRun(S, 'campaign', 5, { cls }); const R = S.saved;
  for (const [slot, b] of Object.entries(eq)) R.hero.eq[slot] = Object.assign(SIM.rollItem(R, 1, 0, slot), { b, id: R.nextId++ });
  SCENE.state = S; SCENE.render(S.t + T);
  const c = document.getElementById('c'), [x0, y0, x1, y1] = BOX, cv = document.createElement('canvas'); cv.width = x1 - x0; cv.height = y1 - y0;
  cv.getContext('2d').drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0); return cv.toDataURL('image/png'); }, [CLS, EQ, BOX, T]);
const plain = await shot();
await G.page.evaluate(async (TINT) => { for (const [n, ch] of TINT) { const im = new Image(); im.src = 'assets/' + n + '.png?v=' + Date.now(); await im.decode();
  const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height);
  const k = { r: 0, g: 1, b: 2, m: -1 }[ch]; for (let i = 0; i < d.data.length; i += 4) { const l = 0.3 * d.data[i] + 0.6 * d.data[i + 1] + 0.1 * d.data[i + 2], v = 60 + l * 0.75;
    if (k < 0) { d.data[i] = v; d.data[i + 1] = 0; d.data[i + 2] = v; } else for (let j = 0; j < 3; j++) d.data[i + j] = j === k ? v : 0; }
  g.putImageData(d, 0, 0); await G.load(n, cv.toDataURL('image/png'), { nearest: SCENE.NEAREST === true || (SCENE.NEAREST || []).includes(n) }); } }, TINT);
const tinted = await shot();
const { execFileSync } = await import('node:child_process');
const a = OUT.replace(/\.png$/, '_plain.png'), b = OUT.replace(/\.png$/, '_tint.png');
fs.writeFileSync(a, Buffer.from(plain.split(',')[1], 'base64')); fs.writeFileSync(b, Buffer.from(tinted.split(',')[1], 'base64'));
execFileSync('python3', [path.join(ROOT, 'tools/measure/chars_menu/sheet.py'), OUT, '0', '0', String(BOX[2] - BOX[0]), String(BOX[3] - BOX[1]), String(K), a, b]);
console.log(OUT, 'errors:', G.errors.length ? G.errors.join(' | ') : 'none');
await G.close();
