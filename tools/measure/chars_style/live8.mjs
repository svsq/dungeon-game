// r5 style: the real page (own loop, real key events), each class walks the 8 ways in an open hall; a crop round the hero
// early in the hold (speeding up: walk) and late (full speed: run), plus one at rest. Crops in OUT/<cls>_<way>_<walk|run|rest>.png
//   node tools/measure/chars_style/live8.mjs [OUT]
import fs from 'node:fs';
import path from 'node:path';
import { openLive } from '../game/live.mjs';
const OUT = process.argv[2] || 'frames/critic_chars_r5_style/live8'; fs.mkdirSync(OUT, { recursive: true });
const WAYS = { down: ['KeyS'], 'down-right': ['KeyS', 'KeyD'], right: ['KeyD'], 'up-right': ['KeyW', 'KeyD'], up: ['KeyW'], 'up-left': ['KeyW', 'KeyA'], left: ['KeyA'], 'down-left': ['KeyS', 'KeyA'] };
const BACK = { KeyS: 'KeyW', KeyW: 'KeyS', KeyA: 'KeyD', KeyD: 'KeyA' };
const KIT = { warrior: 'sword', mage: 'staff', archer: 'shortbow' };
const G = await openLive();
const log = [];
try {
  for (const cls of ['warrior', 'mage', 'archer']) {
    await G.ev(([cls, wb]) => { const S = SCENE.state, R = SIM.newRun(S, 'campaign', 91, { cls }); S.run = R; S.screen = 'play'; R.en = []; R.msg = null;
      const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 12; x <= cx + 12; x++) m.cells[y * m.W + x] = 1;
      h.x = cx * SIMX.TILE + 16; h.y = cy * SIMX.TILE + 18; h.eq.weapon = Object.assign({}, h.eq.weapon, { b: wb }); window.__home = [h.x, h.y]; }, [cls, KIT[cls]]);
    await G.wait(1500);
    const clip = async (file) => { const p = await G.ev(() => { const S = SCENE.state, R = S.run, h = R.hero, c = document.querySelector('canvas'), r = c.getBoundingClientRect(), k = r.width / SIM.VIEW.W, DD = window.DATA || window.D || {}, z = DD.ZOOM || 1;
      return { x: r.left + ((h.x - R.cam[0]) * z) * k, y: r.top + ((h.y - R.cam[1]) * z) * k, back: h.back, face: h.face, sp: Math.hypot(h.vx, h.vy) }; });
      await G.page.screenshot({ path: file, clip: { x: Math.round(p.x - 110), y: Math.round(p.y - 200), width: 220, height: 240 } }); return p; };
    const p0 = await clip(path.join(OUT, `${cls}_rest.png`)); log.push(`${cls} rest back ${p0.back} face ${p0.face}`);
    for (const [way, keys] of Object.entries(WAYS)) {
      for (const k of keys) await G.page.keyboard.down(k);
      await G.wait(110); const a = await clip(path.join(OUT, `${cls}_${way}_walk.png`));
      await G.wait(500); const b = await clip(path.join(OUT, `${cls}_${way}_run.png`));
      for (const k of keys) await G.page.keyboard.up(k);
      log.push(`${cls.padEnd(8)} ${way.padEnd(10)} walk sp ${a.sp.toFixed(2)} back ${a.back} face ${a.face} | run sp ${b.sp.toFixed(2)} back ${b.back} face ${b.face}`);
      const back = keys.map((k) => BACK[k]); for (const k of back) await G.page.keyboard.down(k); await G.wait(610); for (const k of back) await G.page.keyboard.up(k);
      await G.ev(() => { const h = SCENE.state.run.hero; h.x = window.__home[0]; h.y = window.__home[1]; h.vx = h.vy = 0; }); await G.wait(400);
    }
  }
  log.push('errors ' + JSON.stringify(G.errors.slice(0, 3)));
} finally { await G.close(); }
fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\n'); console.log(log.join('\n'));
