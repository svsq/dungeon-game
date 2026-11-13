// node tools/measure/fidelity/archprops.cjs [seeds 3-23] — magma floors 1–4: every stone arch drawn over a lava river (archSpans of
// scene_map.js) and the solid props, pots, chests and torches whose sprite box overlaps one of its legs (TASKS 1940)
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '../../..'));
const { mk } = require(path.join(ROOT, 'tools/measure/game/lib.cjs'));
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'live/assets.js'), 'utf8') + ';' + fs.readFileSync(path.join(ROOT, 'live/sizes.js'), 'utf8'), ctx);
const SZ = (n) => (ctx.window.SIZES || {})[n] || [40, 50], T = 32;
const [a, b] = (process.argv[2] || '3-23').split('-').map(Number);
const spans = (m, c) => { if (c.axis !== 'x') return false; const W = m.W, xs = c.cells.map((k) => k % W), ys = c.cells.map((k) => Math.floor(k / W)), x = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
  const cr = new Set(m.crust || []), run = (y, d) => { let n = 0; while (n < 4 && m.cells[(y + d * (n + 1)) * W + x] === 3 && !cr.has((y + d * (n + 1)) * W + x)) n++; return n; };
  return run(Math.max(...ys), 1) >= 4 && run(Math.min(...ys), -1) >= 1; };
let arches = 0, bad = 0; const rows = [];
for (let sd = a; sd <= b; sd++) for (let f = 1; f <= 4; f++) {
  let S; try { S = mk(sd, f, true); } catch (e) { continue; } const R = S.run, m = R.map, W = m.W;
  for (const c of (m.crossings || []).filter((q) => q.lava && q.kind === 'arch' && spans(m, q))) { arches++;
    const xs = c.cells.map((k) => k % W), ys = c.cells.map((k) => Math.floor(k / W)), x0 = Math.min(...xs) * T, x1 = (Math.max(...xs) + 1) * T, y1 = (Math.max(...ys) + 1) * T;
    const [wd, ht] = SZ('arch_mg'), X = (x0 + x1) / 2 - wd / 2, Y = y1 + 2 - 0.35 * ht;
    const legs = [[X, X + 0.3 * wd], [X + 0.7 * wd, X + wd]].map(([l, r]) => [l, Y + 0.4 * ht, r, Y + ht]);
    const things = [...(m.decor || []).filter((d) => d.solid).map((d) => [d.n, d.x, d.y]), ...(R.pots || []).map((p) => [p.kind, p.x, p.y]), ...(R.chests || []).map((q) => ['chest', q.x, q.y]), ...(m.torches || []).map((t) => [t.kind, t.x, t.y])];
    const on = things.filter(([n, x, y]) => { const [w, h] = SZ(n); return legs.some(([l, t, r, btm]) => x + w / 2 > l && x - w / 2 < r && y > t && y - h < btm); });
    bad += on.length; rows.push(`seed ${sd} floor ${f} arch at ${Math.round((x0 + x1) / 2)},${y1}: ${on.length ? on.map(([n, x, y]) => `${n} ${Math.round(x)},${Math.round(y)}`).join('; ') : 'legs clear'}`); } }
console.log(rows.join('\n')); console.log(`arches ${arches}, props on their legs ${bad}`);
