// r9 game critic: the quest marks (TASKS 2105) and the tracker (TASKS 2110) against the HUD's right column, over the whole yard.
// The QA state town_quest_marks (givers with ! and ?, a tracker row) with the legend shut; the hero stood on every 3rd walkable cell,
// the camera on him as the page keeps it, one frame drawn each time. Per spot: each mark's box (its text in window.__UI) and whether
// it lies under the minimap's sheet or the tracker's box, or under any HUD box (the HUD is drawn over the world's marks); and the
// tracker's rows (full, cut to «и ещё N», folded to its chip).
//   node tools/measure/game/marks_hud.mjs [step] [legend 0|1] > frames/critic_r9_game/marks_hud.txt
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(process.env.ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'));
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const STEP = +(process.argv[2] || 3), LEG = +(process.argv[3] || 0);
const G = await openGame();
const out = await G.page.evaluate(([STEP, LEG]) => {
  const Q = SCENE.QA(), st = Q.states.find((q) => q[0] === 'town_quest_marks')[1], S = st, R = S.run, m = R.map, h = R.hero, T = 32;
  R.legAuto = 0; R.mapLeg = LEG ? 1 : 0;
  const ok = SIM.townOk ? SIM.townOk(m) : null, spots = [];
  for (let y = 0; y < m.H; y += STEP) for (let x = 0; x < m.W; x += STEP) { const c = SIM.Q.cell(m, x, y); if (c === 1 && (!ok || ok[y * m.W + x])) spots.push([x * T + 16, y * T + 16]); }
  const inside = (a, b) => a.x + a.w > b.x && a.x < b.x + b.w && a.y + a.h > b.y && a.y < b.y + b.h;
  const res = { spots: spots.length, marks: 0, small: 0, hidden: 0, hiddenSmall: 0, hiddenAnyHud: 0, hiddenAnySmall: 0, byRole: {}, trk: { full: 0, cut: 0, chip: 0, none: 0 }, cuts: {} };
  for (const [x, y] of spots) {
    h.x = x; h.y = y; R.cam = [x - SCENE.VIEW_W / 2 || x - 960, y - 30 - 540];
    S.t += 0.001; SCENE.state = S; SCENE.render(S.t);
    const ui = window.__UI || [], mk = ui.filter((u) => u.k === 'text' && /^qmk/.test(u.id)), mm = ui.find((u) => u.k === 'box' && /^mm|minimap/.test(u.id));
    const hud = ui.filter((u) => (u.k === 'box' || u.k === 'cover') && /^(mm|qt|qtrack|minimap)/.test(u.id));
    const hudAll = ui.filter((u) => (u.k === 'box' || u.k === 'cover') && !/^(prompt|qmk)/.test(u.id));
    const chip = ui.some((u) => u.id === 'qt_chip'), rows = ui.filter((u) => u.k === 'text' && /^qt_n\d/.test(u.id)).length, more = ui.some((u) => u.id === 'qt_more');
    if (chip) res.trk.chip++; else if (!rows) res.trk.none++; else if (more) { res.trk.cut++; res.cuts[rows] = (res.cuts[rows] || 0) + 1; } else res.trk.full++;
    for (const u of mk) { res.marks++; const small = u.h < 30; if (small) res.small++;
      const under = hud.some((b) => inside(u, b)), any = hudAll.some((b) => inside(u, b)); if (any) { res.hiddenAnyHud++; if (small) res.hiddenAnySmall++; } if (under) { res.hidden++; if (small) res.hiddenSmall++; const k = u.s + (small ? ' small' : ''); res.byRole[k] = (res.byRole[k] || 0) + 1; } }
  }
  return res;
}, [STEP, LEG]);
console.log(JSON.stringify(out, null, 1));
await G.close();
