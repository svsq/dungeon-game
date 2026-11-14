// TASKS 2008: open floor cells of the town (not under a solid prop's picture) the hero's body cannot reach from the spawn, with the
// sim's own collision (walls by boxHit, solid props by their feet ellipses; townsfolk left out). node tools/measure/game/townreach.cjs [seeds]
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '..', '..', '..'), P = path.join(ROOT, 'live') + path.sep;
global.window = global; require(P + 'assets.js'); require(P + 'sizes.js');
const SIM = require(P + 'sim.js'), X = global.SIMX, sz = (n) => SIZES[n] || [0, 0];
const seeds = (process.argv[2] || '1-5').split('-').map(Number), [s0, s1 = s0] = seeds;
for (let seed = s0; seed <= s1; seed++) {
  const S = SIM.spawn(seed * 7.3, {}), step = (keys) => SIM.step(S, { keys, rep: [], chars: [], px: 960, py: 540 });
  for (let i = 0; i < 400 && !(S.run && S.screen === 'play'); i++) step(i % 20 === 0 ? ['Enter'] : []);
  const R = S.run, m = R.map, W = m.W, H = m.H, folk = new Set((R.folk || []).map((f) => f.x + ':' + f.y));
  const sol = X.solids(R).filter((s) => !folk.has(s.x + ':' + s.y));
  const blocked = (x, y) => X.boxHit(m, x, y, SIM.K.R, false, true) || sol.some((s) => { const rr = s.r + SIM.K.R, dx = x - s.x, dy = (y - s.y) * 1.6; return dx * dx + dy * dy < rr * rr; });
  const G = 4, GW = Math.ceil(W * 32 / G), GH = Math.ceil(H * 32 / G), seen = new Uint8Array(GW * GH), q = [[Math.round(R.hero.x / G), Math.round(R.hero.y / G)]];
  seen[q[0][1] * GW + q[0][0]] = 1;
  while (q.length) { const [a, b] = q.pop(); for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = a + i, v = b + j, k = v * GW + u;
    if (u < 0 || v < 0 || u >= GW || v >= GH || seen[k]) continue; seen[k] = 2; if (blocked(u * G, v * G)) continue; seen[k] = 1; q.push([u, v]); } }
  const decor = m.decor.filter((d) => d.solid || d.role === 'bench' || d.role === 'exit_gate');
  const covered = (x, y) => decor.some((d) => { const [w, hh] = sz(d.alt || d.n), k = d.s || 1; return Math.abs(x - d.x) < w * k * 0.45 && y < d.y + 8 && y > d.y - hh * k * 0.5; });
  const bad = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { if (m.cells[ty * W + tx] !== 1) continue; const cx = tx * 32 + 16, cy = ty * 32 + 16; let any = false;
    for (let j = -2; j <= 2 && !any; j++) for (let i = -2; i <= 2; i++) if (seen[(Math.round(cy / G) + j) * GW + Math.round(cx / G) + i] === 1) { any = true; break; }
    if (!any && !covered(cx, cy)) bad.push([tx, ty]); }
  console.log(`seed ${seed}: ${bad.length} open cells out of reach ${JSON.stringify(bad)}`);
}
