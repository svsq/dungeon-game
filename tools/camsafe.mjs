// TASKS 1732: the hero at a map's edge is never under the HUD and never off the view. On the town and a few floors, at every zoom of
// the slider, the hero stands on the open cell nearest each side and corner, the look still and pulling him to that edge; the frame
// is drawn, and his body's box is tested against every part the HUD reports (HUD.zones: effects, stats, top bar, minimap, tracker,
// floor card, bottom panel, key hints) and against the view's edges. A frame of each zoom at the top-left corner goes to --out.
//   node tools/camsafe.mjs [--out frames/camsafe]        exit 2 on failure
import fs from 'node:fs';
import { openGame } from './gamepage.mjs';

const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/camsafe';
const FLOORS = [1, 3, 8, 14];
fs.mkdirSync(out, { recursive: true });
const G = await openGame(), fails = [];
let n = 0;
try {
  const cases = await G.page.evaluate((floors) => {
    const QA = SCENE.QA().states, st = (name) => { const q = QA.find((s) => s[0] === name); if (!q) throw new Error('no QA state ' + name); return structuredClone(q[1]); };
    // the floor fades in from black on arrival: the frames are taken once it is up, the floor's card still on
    const arrive = (window.__ARRIVE = (S) => { for (let i = 0; i < 30; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); return S; });
    const runs = [['town', st('town_quest_marks'), (m) => DUNGEON.townWalk(m)]].concat(floors.map((f) => { const S = st('play_zoom05'); SIM.enterFloor(S, S.run, f); arrive(S); return ['floor ' + f, S, (m) => m.cells.map((c) => c === 1)]; }));
    window.__CAMSAFE = runs.map(([name, S, ok]) => ({ name, S, edges: SIMX.camEdges(S.run.map, ok(S.run.map)) }));
    const list = [];
    window.__CAMSAFE.forEach((r, i) => DATA.ZOOMS.forEach((z) => r.edges.forEach((e, j) => [0, 1].forEach((look) => list.push({ i, z, j, look, shot: look === 0 && e.dx < 0 && e.dy < 0, tag: `${r.name.replace(' ', '')}_z${String(z).replace('.', '')}` })))));
    return list;
  }, FLOORS);
  for (const c of cases) {
    const got = await G.page.evaluate(({ i, z, j, look }) => {
      const r = window.__CAMSAFE[i], S = r.S, R = S.run, h = R.hero, e = r.edges[j], T = DATA.TILE;
      S.screen = 'play'; R.zoom = z; const w = SIMX.WIN(R);
      h.x = (e.x + 0.5) * T; h.y = (e.y + 0.5) * T; SIMX.reveal(R); R.camLook = look ? [-e.dx * w.W / 2 * SIMX.CAM_LOOK, -e.dy * w.H / 2 * SIMX.CAM_LOOK] : [0, 0]; SIMX.snapCam(R);
      SCENE.state = S; SCENE.render(S.t + 0.01);
      const [bw, bh] = window.SIZES.hero, sx = (h.x - R.cam[0]) * z, sy = (h.y - R.cam[1]) * z, b = [sx - bw * z / 2, sy - bh * z, sx + bw * z / 2, sy];
      const where = `${r.name}, cell ${e.x},${e.y} (edge ${e.dx},${e.dy}) at ×${z}${look ? ', look to the edge' : ''}: the hero at ${Math.round(sx)},${Math.round(sy)}`;
      const bad = HUD.zones().filter((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]).map((q) => `${where} is under the HUD's ${q[4]}`);
      if (b[0] < 0 || b[1] < 0 || b[2] > SIM.VIEW.W || b[3] > SIM.VIEW.H) bad.push(`${where} is off the view`);
      return bad;
    }, c);
    n++; fails.push(...got);
    // the shot lets the fog and the light catch up with the hero put down there
    if (c.shot) { await G.page.evaluate(({ i }) => { const S = window.__ARRIVE(structuredClone(window.__CAMSAFE[i].S)); SCENE.state = S; SCENE.render(S.t + 0.01); }, c); await G.page.screenshot({ path: `${out}/${c.tag}_tl.png` }); }
  }
} finally { await G.close(); }
if (G.errors.length) fails.push('page errors: ' + G.errors.slice(0, 3).join(' | '));
console.log(fails.length ? `FAIL (${fails.length} of ${n})\n  ` + fails.slice(0, 20).join('\n  ') : `ok: ${n} frames, the hero at every edge and corner keeps off the HUD and in view`);
process.exit(fails.length ? 2 : 0);
