// r8: how much of the window the town's map fills with the hero on each edge or corner cell (the camera aims at the hero everywhere, TASKS 1732),
// and where on the screen the hero stands; node only. node tools/measure/game/cam_void.cjs
const P = require('./play.cjs'), { X, D, DG } = P, S = P.start(1), R = S.run, h = R.hero, m = R.map, T = 32;
console.log('view', JSON.stringify(P.SIM.VIEW), 'zooms', JSON.stringify(D.ZOOMS), 'meta zoom', S.meta.zoom, 'run zoom', R.zoom, 'map px', m.W * T, 'x', m.H * T);
const edges = X.camEdges(m, DG.townWalk(m)); const zs = [R.zoom || 1, Math.min(...D.ZOOMS), Math.max(...D.ZOOMS)];
for (const z of [...new Set(zs)]) { R.zoom = z; const w = X.WIN(R); console.log(`zoom ${z}: window ${w.W} x ${w.H} world px, map share of it when centred ${(Math.min(1, m.W * T / w.W) * Math.min(1, m.H * T / w.H)).toFixed(2)}`);
  for (const e of [{ x: Math.round(h.x / T), y: Math.round(h.y / T), dx: 0, dy: 0 }, ...edges]) { h.x = (e.x + 0.5) * T; h.y = (e.y + 0.5) * T; X.snapCam(R); for (let i = 0; i < 400; i++) P.step(S, {});
    const vis = [Math.max(0, R.cam[0]), Math.max(0, R.cam[1]), Math.min(m.W * T, R.cam[0] + w.W), Math.min(m.H * T, R.cam[1] + w.H)], share = (vis[2] - vis[0]) * (vis[3] - vis[1]) / (w.W * w.H);
    console.log(`  edge ${String(e.dx).padStart(2)},${String(e.dy).padStart(2)} cell ${e.x},${e.y}: hero on screen at ${Math.round((h.x - R.cam[0]) * z)},${Math.round((h.y - R.cam[1]) * z)}, the window holds map for ${(100 * share).toFixed(0)} %`); } }
