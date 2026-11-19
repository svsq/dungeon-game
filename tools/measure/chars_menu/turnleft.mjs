// the warrior's turn from a walk up into a walk left in the live sim (gamepage.mjs): a strip of hero crops, every 2nd step,
// with face/back per frame, to see the cape through the turn (the author's frames 31-33)
//   node tools/measure/chars_menu/turnleft.mjs [--out frames/critic_chars_r5b_menu/turn] [--cls warrior] [--up 60] [--left 36]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r5b_menu/turn')), CLS = opt('cls', 'warrior').split(','), UP = +opt('up', 60), LEFT = +opt('left', 36);
fs.mkdirSync(OUT, { recursive: true });
const G = await openGame();
const lines = [];
for (const cls of CLS) {
  const res = await G.page.evaluate(([cls, UP, LEFT]) => {
    const S = SIM.spawn(0, {}); SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 1234, { cls }); S.screen = 'play';
    for (let i = 0; i < 30; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); const R = S.run; R.en = []; R.seen && R.seen.fill(1);
    const cv = document.getElementById('c'), c2 = document.createElement('canvas'), cw = 120, ch = 130, frames = [], info = [];
    const shot = () => { LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const tr = LIB.TRACE.hero || {};
      const gx = Math.round(tr.ground ? tr.ground[0] : 960), gy = Math.round(tr.ground ? tr.ground[1] : 540);
      c2.width = cw; c2.height = ch; c2.getContext('2d').drawImage(cv, gx - cw / 2, gy - ch + 10, cw, ch, 0, 0, cw, ch); frames.push(c2.toDataURL('image/png'));
      const h = R.hero; info.push(`${frames.length - 1}: face ${h.face} back ${h.back} vx ${h.vx.toFixed(0)} vy ${h.vy.toFixed(0)}`); };
    for (let f = 0; f < UP; f++) { SIM.step(S, { px: 960, py: 540, keys: [], up: true }); if (f >= UP - 6 && f % 2 === 0) shot(); }
    for (let f = 0; f < LEFT; f++) { SIM.step(S, { px: 960, py: 540, keys: [], left: true }); if (f % 2 === 0) shot(); }
    return { frames, info };
  }, [cls, UP, LEFT]);
  res.frames.forEach((u, i) => fs.writeFileSync(path.join(OUT, `${cls}_${String(i).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
  lines.push(`== ${cls}`, ...res.info);
}
console.log(lines.join('\n') + '\n| errors: ' + (G.errors.length ? G.errors.slice(0, 3).join(' | ') : 'none'));
fs.writeFileSync(path.join(OUT, 'turn.txt'), lines.join('\n') + '\n');
await G.close();
