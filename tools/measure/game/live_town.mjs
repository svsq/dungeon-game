// r8: the town on the real page (page loop, keyboard and mouse events as a player sends them): menu -> campaign -> class -> the town,
// the Keeper's greeting, a walk to the board and a click on its first offer, J, the courtyard's edges. Shots in frames/critic_r8_game/live/.
//   node tools/measure/game/live_town.mjs
import fs from 'node:fs';
import { openLive } from './live.mjs';
const out = 'frames/critic_r8_game/live'; fs.mkdirSync(out, { recursive: true });
const G = await openLive();
const log = (...a) => console.log(...a);
const st = () => G.ev(() => { const S = SCENE.state; if (!S) return null; const R = S.run; return { screen: S.screen, t: +S.t.toFixed(1), hero: R && [Math.round(R.hero.x), Math.round(R.hero.y)], cam: R && R.cam.map(Math.round), msg: R && R.msg && R.msg.s, talk: S.talk && S.talk.role }; });
const clickView = async (x, y) => { await G.page.mouse.move(x, y); await G.wait(80); await G.page.mouse.down(); await G.wait(80); await G.page.mouse.up(); await G.wait(200); };
try {
  await G.tap('Space'); await G.wait(800); log('after key', JSON.stringify(await st()));
  const menu = await G.ev(() => { const S = SCENE.state, U = DATA.UI.menu(!!S.saved); return U.map((b) => [b.id, b.x + b.w / 2, b.y + b.h / 2 + SIMX.uiDy('menu')]); });
  log('menu', JSON.stringify(menu)); await G.shot(out + '/01_menu.png');
  const c = menu.find((b) => b[0] === 'campaign'); await clickView(c[1], c[2]); await G.wait(500); log('after campaign', JSON.stringify(await st())); await G.shot(out + '/02_classes.png');
  await G.tap('Enter'); await G.wait(1500); log('after enter', JSON.stringify(await st())); await G.shot(out + '/03_town_arrive.png');
  for (let i = 0; i < 20; i++) { await G.wait(500); const s = await st(); if (s.screen === 'talk') { log('talk opened at', JSON.stringify(s)); break; } }
  await G.wait(600); await G.shot(out + '/04_greet_p1.png');
  for (let i = 0; i < 6; i++) { const s = await st(); if (s.screen !== 'talk') break; await G.tap('KeyE'); await G.wait(500); if (i === 0) await G.shot(out + '/05_greet_p2.png'); }
  await G.wait(800); log('after greet', JSON.stringify(await st())); await G.shot(out + '/06_after_greet.png');
  await G.tap('KeyJ'); await G.wait(500); await G.shot(out + '/07_journal.png'); await G.tap('Escape'); await G.wait(300);
  log('end', JSON.stringify(await st()), 'errors', G.errors.slice(0, 3));
} finally { await G.close(); }
