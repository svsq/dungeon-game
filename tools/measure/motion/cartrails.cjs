// cartrails.cjs (TASKS 2122): how far the cart's wheels stand from the rails as drawn, at every s of the run: the front view's two slab feet
// and the 3/4 view's two near wheels' feet, each to the nearest rail axis of the laid track pieces (D.railLay), in view px; the fade's alpha too.
// run: node tools/measure/motion/cartrails.cjs [s0] [s1] [step]
const ROOT = require('path').resolve(__dirname, '../../..'), fs = require('fs'), path = require('path');
require(path.join(ROOT, 'live/sim.js'));
const D = DATA, m = DUNGEON.genTown(31), pts = D.railPts(m), K = D.CART.floor, C = D.CART, [s0 = 0, s1 = 400, st = 1] = process.argv.slice(2).map(Number);
const sizes = fs.readFileSync(path.join(ROOT, 'live/sizes.js'), 'utf8'), png = (n) => { const b = fs.readFileSync(path.join(ROOT, 'live/assets', n + '.png')); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const size = (n) => { const [pw, ph] = png(n), hh = +new RegExp('\\b' + n + ': (\\d+)').exec(sizes)[1]; return [Math.round(hh * pw / ph), hh]; };
const axes = D.railAxes(pts, png), off = (p) => Math.min(...axes.map(([a, b]) => { const ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey)));
  return Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey); }));
const tot = railLenOf(pts); function railLenOf(p) { return p.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0); }
for (let s = s0; s <= Math.min(s1, tot); s += st) { const v = D.cartAt(pts, s), F = D.cartFade(pts, v.ds), row = [`s ${s}`, `ds ${v.ds.toFixed(1)}`, `th ${D.cartView(pts, v.ds).th.toFixed(1)}`, `a ${F.a.toFixed(2)}`];
  if (F.a < 1) { const n = 'cart_tw_f', [w, h] = size(n); row.push('front ' + D.cartFeet(0, n, w, h, F.F, v).map((p) => off(p).toFixed(2)).join(' ')); }
  if (F.a > 0) { const n = 'cart_tw', [w, h] = size(n); row.push('3/4 ' + D.cartFeet(1, n, w, h, F.S, v).map((p) => off(p).toFixed(2)).join(' ')); }
  console.log(row.join('  ')); }
