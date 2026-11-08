// The magma caves' lava sound (TASKS 403): audio.js rendered offline with a lava source left, right and far off the hero.
// The near source must be heard on its own side, the far one quieter, none clip. Exit 2 on failure.
//   node tools/lavaaudio.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const source = fs.readFileSync('live/audio.js', 'utf8');
const browser = await chromium.launch(); const page = await browser.newPage();
let fail = [];
try {
  const res = await page.evaluate(async (source) => {
    const out = {};
    for (const [name, dx, kind] of [['left', -220, 'fall'], ['right', 220, 'fall'], ['far', 470, 'fall'], ['vent', 120, 'vent'], ['none', 9000, 'fall']]) {
      const sr = 22050, ctx = new OfflineAudioContext(2, sr * 2, sr), listeners = {}, W = { AudioContext: function () { return ctx; } }, M = Object.create(Math); let seed = 403;
      M.random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
      new Function('window', 'localStorage', 'addEventListener', 'Math', source)(W, { getItem: () => null, setItem() {} }, (n, cb) => { listeners[n] = cb; }, M);
      listeners.pointerdown();
      const T = 32, map = { biome: 'magma', W: 100, H: 100, lavaFeatures: [{ kind, x: 1600 + dx, y: 1600, cell: 0, w: 2 }] };
      const run = { map, seen: new Array(100 * 100).fill(1), hero: { x: 1600, y: 1600, deadT: 0, hp: 1 }, cam: [1600 - 960, 1600 - 540] };
      W.DATA = { TILE: T };
      for (let i = 0; i < 40; i++) { const S = { t: i / 20, screen: 'play', run, ev: [] }; window.DATA = W.DATA; W.AUDIO.update(S); }
      const buf = await ctx.startRendering(), a = buf.getChannelData(0), b = buf.getChannelData(1);
      const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
      out[name] = { L: rms(a), R: rms(b), peak: Math.max(...a.map(Math.abs), ...b.map(Math.abs)) };
    }
    return out;
  }, source);
  console.log(JSON.stringify(res));
  // energy above the biome's own drone (the case with no lava in reach)
  const ex = (r, ch) => Math.max(0, r[ch] ** 2 - res.none[ch] ** 2), lava = (r) => ex(r, 'L') + ex(r, 'R');
  if (!(ex(res.left, 'L') > ex(res.left, 'R') * 1.3)) fail.push('a source on the left is not heard on the left');
  if (!(ex(res.right, 'R') > ex(res.right, 'L') * 1.3)) fail.push('a source on the right is not heard on the right');
  if (!(lava(res.far) < lava(res.right) * 0.4)) fail.push('a far source is not quieter');
  if (!(lava(res.vent) > lava(res.none) + 0.2 * lava(res.right))) fail.push('a vent is not heard');
  for (const [k, r] of Object.entries(res)) if (r.peak >= 0.99) fail.push(k + ': clipping');
} finally { await browser.close(); }
if (fail.length) { console.log('lavaaudio: FAIL\n  ' + fail.join('\n  ')); process.exit(2); }
console.log('lavaaudio: ok');
