// live/sandbox.cjs — render files and generated data run in Node for the self-check (TASKS 1896, 2086): the scene is render code with
// no node entry, and the logic layer may not stand up a page for it (tools/layercheck.cjs), so the sandbox is a file of live/ that the
// checks and the tools alike load (it was tools/scenebox.cjs).
// heroBox(D, SIM, sizes) → { drawHero, L, calls }: L and G are stubs, and each sprite's placement (its matrix's x, or its x) goes into calls;
// with sizes (assets()) the textures have their real sizes and only the painted ones exist
// monsterBox(D) → MONSTERS as monsters.js builds it over the same stubs; rigs() → RIGS as rigs.js leaves it.
const fs = require('fs'), vm = require('vm'), path = require('path');
const LIVE = __dirname, src = (f) => fs.readFileSync(path.join(LIVE, f), 'utf8');
function stage(D, SIM, sizes) {
  const M = { mul: (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]],
    t: (x, y) => [1, 0, 0, 1, x, y], s: (x, y) => [x, 0, 0, y, 0, 0], r: (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], ap: (A, p) => [A[0] * p[0] + A[2] * p[1] + A[4], A[1] * p[0] + A[3] * p[1] + A[5]] };
  M.of = (...Ls) => Ls.reduce((a, b) => M.mul(a, b));
  const calls = [], size = { w: 10, h: 10 }, L = new Proxy({ M, SS: (e0, e1, x) => { const q = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return q * q * (3 - 2 * q); }, SNAP: 0, pre: null, sp: null,
    sprite: (n, x, y, o) => { calls.push(o && o.m ? o.m[4] : x); return size; } }, { get: (t, k) => (k in t ? t[k] : () => size) });
  const box = { Math, Object, Array, JSON, Number, String, Set, Map, WeakMap, Float32Array, Float64Array, console, SIM, G: { w: 1920, h: 1080, tex: (n) => (sizes ? sizes[n] : size) }, ASSETS: sizes || new Proxy({}, { get: () => size }) };
  box.window = box; box.DATA = D; box.LIB = L; box.SCX = { D, L, M, SC: {}, SS: L.SS }; vm.createContext(box); vm.runInContext(src('rigs.js'), box);
  return { box, L, calls };
}
function heroBox(D, SIM, sizes) { const { box, L, calls } = stage(D, SIM, sizes); vm.runInContext(src('scene_hero.js'), box); return { drawHero: box.SCX.drawHero, L, calls }; }
function monsterBox(D) { const { box } = stage(D, null); vm.runInContext(src('monsters.js'), box); return box.MONSTERS; }
// rigs() → window.RIGS as the page has it once live/rigs.js has run: the file is run, not parsed, so all it assigns counts
// hudBox(D, SIM, fontW) → HUD as hud.js leaves it, over stub drawing: its geometry (HUD.markZones) measures text by fontW, the
// TTF's advances, as the page's canvas does; KIT is the kit it draws with, for a check to watch its buttons and inks; L and the page's
// globals (page) for a check to watch its sprites or stand in a scene (SCENE.menuHero)
function hudBox(D, SIM, fontW) { const size = { w: 10, h: 10 }, L = new Proxy({ labelW: (id, s, o = {}) => fontW(s, o.size || 26, !!o.bold), SS: (e0, e1, x) => { const q = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return q * q * (3 - 2 * q); }, UI: [] },
    { get: (t, k) => (k in t ? t[k] : () => size) });
  const box = { Math, Object, Array, JSON, Number, String, Set, Map, WeakMap, Float32Array, Float64Array, Infinity, console, SIM, DATA: D, TEXT: globalThis.TEXT, TXT: globalThis.TXT, LIB: L, G: new Proxy({ w: 1920, h: 1080, oy: 0, tex: () => size }, { get: (t, k) => (k in t ? t[k] : () => size) }), ASSETS: new Proxy({}, { get: () => size }) };
  box.window = box; box.globalThis = box; vm.createContext(box); for (const f of ['sizes.js', 'hud_kit.js', 'hud.js']) vm.runInContext(src(f), box, { filename: f });
  return { HUD: box.HUD, SIZES: box.SIZES, KIT: box.KIT, L, page: box }; }
function rigs() { const page = {}; page.window = page; vm.createContext(page); vm.runInContext(src('rigs.js'), page); return page.RIGS; }
// assets() → window.ASSETS as assets.js leaves it: each texture's size, for a sandbox that places sprites by their real proportions
function assets() { const page = {}; page.window = page; vm.createContext(page); vm.runInContext(src('assets.js'), page); return page.ASSETS; }
module.exports = { heroBox, monsterBox, rigs, hudBox, assets };
