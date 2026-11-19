// node tools/measure/fix2201/kick.cjs : the mage in the robe running and walking sideways (12 frames of a stride, right and left, every
// outfit), the CPU composite of the node sandbox (SIMX.heroLayers.compose): px² of shin and boot drawn above the skirt's hem where they
// stand out past it (a boot pixel not under the cloth, higher than the lowest cloth row of the nearest column that has cloth), per frame
// and the worst; TASKS 2201
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const { kickOf } = SIMX.robeKick || {};
const it = (b, slot) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, [slot === 'weapon' ? 'atk' : 'def']: 3 });
let worst = [0, ''];
for (const armor of ['robe', 'leather_armor', 'cloak']) for (const [way, dx, pace] of [['right', 1, 1], ['left', -1, 1], ['right', 1, 0.5]]) {
  const row = [];
  for (let k = 0; k < 12; k++) {
    const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; Object.assign(R.hero.eq, { weapon: it('staff', 'weapon'), armor: it(armor, 'armor') });
    const h = Object.assign({}, R.hero, { vx: dx * SIM.K.RUN * pace, vy: 0, face: dx, aim: dx > 0 ? 0 : Math.PI, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9, gp: k * 2 * Math.PI / 12 });
    const J = {}, spr = []; L.joint = (id, q, p) => { if (id === 'hero') J[q] = p; }; L.sprite = (q, x, y, o) => { spr.push({ n: q, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
    drawHero(h, 300, 300, 10 + k / 60, SIMX.heroSt(S), {});
    const v = SIMX.robeKick(spr, J); row.push(v); if (v > worst[0]) worst = [v, `${armor} ${pace < 1 ? 'walking' : 'running'} ${way} frame ${k}`];
  }
  console.log(`${armor.padEnd(14)} ${(pace < 1 ? 'walk ' : 'run ') + way.padEnd(6)} boot above the hem, px² per frame: ${row.map((v) => v.toFixed(0)).join(' ')}`);
}
console.log(`worst ${worst[0].toFixed(1)} px² (${worst[1]})`);
