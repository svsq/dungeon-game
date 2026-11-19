// r8 game critic: play the town through SIM.step with the inputs the page makes (keys, pointer, click), over the walkable cells of the town.
//   const P = require('./play.cjs'); const S = P.start(seed); P.goto(S, 'shop'); P.tap(S, 'KeyE'); ...
const path = require('path'), ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..', '..', '..')), L = path.join(ROOT, 'live') + path.sep;
global.window = global; require(L + 'assets.js'); require(L + 'sizes.js');
const SIM = require(L + 'sim.js'), X = global.SIMX, D = global.DATA, DG = global.DUNGEON, UI = X.UI, T = 32;
const idle = { keys: [], rep: [], chars: [], px: 960, py: 540 };
const step = (S, o) => SIM.step(S, Object.assign({}, idle, { keys: [], rep: [] }, o || {}));
const run = (S, sec, o) => { for (let i = 0, n = Math.round(sec / SIM.DT); i < n; i++) step(S, o); };
const tap = (S, code, o) => { step(S, Object.assign({ keys: [code] }, o)); step(S, o); run(S, 0.05, o); };
const click = (S, x, y) => { const dy = X.uiDy(S.screen); step(S, { px: x, py: y + dy, moved: true }); step(S, { px: x, py: y + dy, click: 1 }); step(S, { px: x, py: y + dy }); run(S, 0.05, { px: x, py: y + dy }); };
// the window's button by id: the window's rows come from the sim's own UI tables (a UI function per screen)
const clickId = (S, rows, id) => { const b = rows.find((q) => q.id === id); if (!b) return false; click(S, b.x + b.w / 2, b.y + b.h / 2); return true; };
function start(seed, cls) {
  const S = SIM.spawn(seed * 7.3, {}); for (let i = 0; i < 600 && !(S.run && S.screen === 'play'); i++) step(S, { keys: i % 20 === 0 ? ['Enter'] : [] });
  if (cls) S.meta.cls = cls; return S;
}
// the Keeper walks up and greets a hero who has just come in (the hero is held till he has spoken): play it out with E, return what was said
function greet(S, lim = 30) {
  const said = [], t0 = S.t; while (S.screen !== 'talk' && S.t - t0 < lim) step(S, {});
  const t1 = S.t - t0; let n = 0;
  while (S.screen === 'talk' && n++ < 30) { const T = S.talk; said.push((T.pages || []).join(' | ')); run(S, 0.5); tap(S, 'KeyE'); }
  return { at: +t1.toFixed(1), said };
}
const cellOf = (m, x, y) => Math.floor(y / T) * m.W + Math.floor(x / T);
function cellPath(S, tx, ty) {
  const R = S.run, m = R.map, W = m.W, ok = X.townOk ? X.townOk(m) : DG.townWalk(m), s = cellOf(m, R.hero.x, R.hero.y), e = Math.floor(ty / T) * W + Math.floor(tx / T);
  const from = new Int32Array(W * m.H).fill(-2), q = [s]; from[s] = -1;
  for (let i = 0; i < q.length && from[e] === -2; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (n >= 0 && n < from.length && from[n] === -2 && ok[n]) { from[n] = q[i]; q.push(n); } }
  if (from[e] === -2) return null; const out = []; for (let k = e; k >= 0; k = from[k]) out.push(k); return out.reverse();
}
// a path over a fine grid (8 px) with the sim's own collision for the hero's body (walls by boxHit, solid props by their feet ellipses, townsfolk left out)
function finePath(S, x, y, withFolk) {
  const R = S.run, m = R.map, folkSet = new Set((R.folk || []).map((f) => f.x + ':' + f.y)), sol = X.solids(R).filter((q) => withFolk || !folkSet.has(q.x + ':' + q.y)), G = 8, GW = Math.ceil(m.W * T / G), GH = Math.ceil(m.H * T / G);
  const blocked = (gx, gy) => { const px = gx * G, py = gy * G; return X.boxHit(m, px, py, SIM.K.R + 1, false, true) || sol.some((q) => { const rr = q.r + SIM.K.R + 1, dx = px - q.x, dy = (py - q.y) * 1.6; return dx * dx + dy * dy < rr * rr; }); };
  const s0 = [Math.round(R.hero.x / G), Math.round(R.hero.y / G)], e0 = [Math.round(x / G), Math.round(y / G)], from = new Int32Array(GW * GH).fill(-2), q = [s0[1] * GW + s0[0]]; from[q[0]] = -1;
  const goal = e0[1] * GW + e0[0];
  for (let i = 0; i < q.length && from[goal] === -2; i++) { const a = q[i] % GW, b = Math.floor(q[i] / GW);
    for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = a + u, ny = b + v, k = ny * GW + nx; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || from[k] !== -2) continue; if (k !== goal && blocked(nx, ny)) continue; from[k] = q[i]; q.push(k); } }
  if (from[goal] === -2) return null; const out = []; for (let k = goal; k >= 0; k = from[k]) out.push([(k % GW) * G, Math.floor(k / GW) * G]); return out.reverse();
}
// walk to a point (x, y) of the map by key presses along a fine path; returns { ok, t, why }
function goXY(S, x, y, lim = 60, reach = 10) {
  const R = S.run, h = R.hero, t0 = S.t, p = finePath(S, x, y); if (!p) return { ok: false, why: 'no path' };
  let i = 0, last = [h.x, h.y], still = 0;
  while (S.t - t0 < lim) {
    if (S.screen !== 'play') return { ok: false, why: 'screen ' + S.screen, t: S.t - t0 };
    while (i < p.length - 1 && Math.hypot(p[i][0] - h.x, p[i][1] - h.y) < 14) i++;
    const j = Math.min(p.length - 1, i), dx = p[j][0] - h.x, dy = p[j][1] - h.y;
    if (j >= p.length - 1 && Math.hypot(dx, dy) < reach) return { ok: true, t: S.t - t0 };
    step(S, { left: dx < -3, right: dx > 3, up: dy < -3, down: dy > 3 });
    if (Math.hypot(h.x - last[0], h.y - last[1]) < 0.2) still++; else still = 0; last = [h.x, h.y]; if (still > 240) return { ok: false, why: 'stuck', at: [Math.round(h.x), Math.round(h.y)], t: S.t - t0 };
  }
  return { ok: false, why: 'timeout', t: lim };
}
const svc = (S, k) => S.run.map.town.svc[k];
// stand where the prompt for a service is lit: its spot, a step below it
function goSvc(S, k, dy = 36, dx = 0, lim = 60) { const a = k === 'shop' ? S.run.map.shop.front : svc(S, k); let r, tot = 0;
  for (let n = 0; n < 4; n++) { r = goXY(S, a.x + dx, a.y + dy, lim); tot += r.t || 0; if (r.ok || r.why !== 'stuck') break; run(S, 1.5); } r.t = tot; return r; }
const folk = (S, role) => S.run.folk.find((f) => f.role === role);
const hero = (S) => S.run.hero;
const evs = (S) => S.ev.filter((e) => e.t >= S.t - 0.02);
module.exports = { greet, SIM, X, D, DG, UI, T, step, run, tap, click, clickId, start, cellOf, cellPath, finePath, goXY, goSvc, svc, folk, hero, evs, ROOT };
