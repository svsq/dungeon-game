// TASKS 2177 in the arch: the order the hero's parts are drawn at ease (menu:1) and in the world, per class; the weapon arm (R) is
// behind the body when its upper arm and forearm come before the torso, and its fist after the weapon; tints on the R and L parts
//   node tools/measure/chars_menu/armorder.cjs
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js'));
const SB = require(path.join(ROOT, 'live/sandbox.cjs'));
const { D, heroSt } = globalThis.SIMX;
const { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
for (const [cls, wb] of [['warrior', 'sword'], ['mage', 'staff'], ['archer', 'shortbow']]) for (const menu of [1, 0]) {
  const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
  const h = Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face: 1, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 });
  const spr = [];
  L.joint = () => {}; L.solid = () => {};
  L.sprite = (n, x, y, o = {}) => { spr.push(n + (o.tint ? '[' + [].concat(o.tint).map((v) => +(+v).toFixed(2)).join(',') + ']' : '')); return { w: 10, h: 10 }; };
  drawHero(h, 300, 300, 10, heroSt(S), menu ? { menu: 1 } : {});
  console.log(`${(cls + ' ' + wb).padEnd(16)} ${menu ? 'arch ' : 'world'}  ${spr.join(' > ')}`);
}
