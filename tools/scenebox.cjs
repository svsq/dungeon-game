// tools/scenebox.cjs — the hero's drawing (live/scene_hero.js) run in Node for the self-check (TASKS 1896): the scene is render code
// with no node entry, and the logic layer may not stand up a page for it (tools/layercheck.cjs), so the sandbox lives here.
// heroBox(D, SIM) → { drawHero, L, calls }: L and G are stubs, and each sprite's placement (its matrix's x, or its x) goes into calls.
const fs = require('fs'), vm = require('vm'), path = require('path');
const LIVE = path.join(__dirname, '..', 'live'), src = (f) => fs.readFileSync(path.join(LIVE, f), 'utf8');
function heroBox(D, SIM) {
  const M = { mul: (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]],
    t: (x, y) => [1, 0, 0, 1, x, y], s: (x, y) => [x, 0, 0, y, 0, 0], r: (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], ap: (A, p) => [A[0] * p[0] + A[2] * p[1] + A[4], A[1] * p[0] + A[3] * p[1] + A[5]] };
  M.of = (...Ls) => Ls.reduce((a, b) => M.mul(a, b));
  const calls = [], size = { w: 10, h: 10 }, L = new Proxy({ M, SS: (e0, e1, x) => { const q = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return q * q * (3 - 2 * q); }, SNAP: 0, pre: null, sp: null,
    sprite: (n, x, y, o) => { calls.push(o && o.m ? o.m[4] : x); return size; } }, { get: (t, k) => (k in t ? t[k] : () => size) });
  const box = { Math, Object, Array, JSON, Number, String, Set, Map, WeakMap, Float32Array, Float64Array, console, SIM, G: { w: 1920, h: 1080, tex: () => size }, ASSETS: new Proxy({}, { get: () => size }) };
  box.window = box; box.SCX = { D, L, M, SC: {}, SS: L.SS }; vm.createContext(box); vm.runInContext(src('rigs.js'), box); vm.runInContext(src('scene_hero.js'), box);
  return { drawHero: box.SCX.drawHero, L, calls };
}
module.exports = { heroBox };
