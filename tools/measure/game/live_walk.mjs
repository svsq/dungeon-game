// r8: on the real page, a new run in the town walked by hand: past the Keeper's greeting, a held key at a time (hold/steer to a point by the sim's own position),
// E at the board, a click on «Взять» of its first row, J, then the town's four corners with a frame each. Shots in frames/critic_r8_game/live/.
//   node tools/measure/game/live_walk.mjs
import fs from 'node:fs';
import { openLive } from './live.mjs';
const out = 'frames/critic_r8_game/live'; fs.mkdirSync(out, { recursive: true });
const G = await openLive(); const log = (...a) => console.log(...a);
const st = () => G.ev(() => { const S = SCENE.state, R = S && S.run; return S && { screen: S.screen, hero: R && [Math.round(R.hero.x), Math.round(R.hero.y)], cam: R && R.cam.map(Math.round), msg: R && R.msg && R.msg.s, z: R && R.zoom }; });
const clickView = async (x, y) => { await G.page.mouse.move(x, y); await G.wait(80); await G.page.mouse.down(); await G.wait(80); await G.page.mouse.up(); await G.wait(250); };
// steer to (x, y) of the map with held arrow keys, reading the hero from the sim; the player's reflex: look, press, correct
const steer = async (x, y, lim = 20000) => { const t0 = Date.now(); const held = new Set();
  const set = async (code, on) => { if (on && !held.has(code)) { await G.page.keyboard.down(code); held.add(code); } else if (!on && held.has(code)) { await G.page.keyboard.up(code); held.delete(code); } };
  try { while (Date.now() - t0 < lim) { const s = await st(); if (s.screen !== 'play') break; const dx = x - s.hero[0], dy = y - s.hero[1]; if (Math.hypot(dx, dy) < 14) return true;
      await set('KeyA', dx < -8); await set('KeyD', dx > 8); await set('KeyW', dy < -8); await set('KeyS', dy > 8); await G.wait(60); } return false; }
  finally { for (const c of [...held]) await G.page.keyboard.up(c); } };
try {
  await G.tap('Space'); await G.wait(800);
  const menu = await G.ev(() => DATA.UI.menu(false).map((b) => [b.id, b.x + b.w / 2, b.y + b.h / 2 + SIMX.uiDy('menu')])); const c = menu.find((b) => b[0] === 'campaign');
  await clickView(c[1], c[2]); await G.tap('Enter'); await G.wait(1200);
  const t0 = Date.now(); let tried = 0; while ((await st()).screen !== 'talk' && Date.now() - t0 < 40000) { if (tried++ % 8 === 0) await G.tap('KeyD', 40); await G.wait(250); }   // the player tries to walk; the greeting holds him
  log('greeting opened after', Date.now() - t0, 'ms wall, hero', JSON.stringify((await st()).hero));
  for (let i = 0; i < 8 && (await st()).screen === 'talk'; i++) { await G.tap('KeyE'); await G.wait(400); } await G.wait(500);
  const bd = await G.ev(() => SCENE.state.run.map.town.svc.board); const ok = await steer(bd.x, bd.y + 36); log('walked to the board', ok, JSON.stringify(await st()));
  await G.tap('KeyE'); await G.wait(600); log('E ->', (await st()).screen); await G.shot(out + '/10_board.png');
  const take = await G.ev(() => { const L = SCENE.state.bdRows || [], U = DATA.UI.board(L.length); return U.r.filter((q) => q.id.startsWith('take:')).map((q) => [q.id, q.x + q.w / 2, q.y + q.h / 2 + SIMX.uiDy('board')]); });
  if (take[0]) { await clickView(take[0][1], take[0][2]); await G.wait(400); await G.shot(out + '/11_board_took.png'); }
  await G.tap('KeyE'); await G.wait(400); await G.tap('KeyJ'); await G.wait(500); await G.shot(out + '/12_journal.png'); await G.tap('KeyJ'); await G.wait(700); await G.shot(out + '/13_tracker.png');
  log('quests', await G.ev(() => (SCENE.state.run.quests || []).map((q) => q.key + ':' + q.st)));
  const corners = await G.ev(() => { const m = SCENE.state.run.map, e = SIMX.camEdges(m, DUNGEON.townWalk(m)); return e.map((q) => [q.x, q.y, q.dx, q.dy]); });
  for (const [cx, cy, dx, dy] of corners.filter((q) => q[2] && q[3])) { const ok2 = await steer((cx + 0.5) * 32, (cy + 0.5) * 32, 30000); await G.wait(1500); log('corner', dx, dy, ok2, JSON.stringify(await st())); await G.shot(`${out}/20_corner_${dx}_${dy}.png`); }
  log('errors', G.errors.slice(0, 3));
} finally { await G.close(); }
