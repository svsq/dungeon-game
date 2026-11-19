// r8: the town's layout as the sim has it: size, services, townsfolk, spawn, exits; node tools/measure/game/town_layout.cjs [seed...]
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '..', '..', '..'), P = path.join(ROOT, 'live') + path.sep;
global.window = global; require(P + 'assets.js'); require(P + 'sizes.js');
const SIM = require(P + 'sim.js');
const seeds = process.argv.slice(2).map(Number); if (!seeds.length) seeds.push(1);
for (const seed of seeds) {
  const S = SIM.spawn(seed * 7.3, {}), step = (keys) => SIM.step(S, { keys, rep: [], chars: [], px: 960, py: 540 });
  for (let i = 0; i < 400 && !(S.run && S.screen === 'play'); i++) step(i % 20 === 0 ? ['Enter'] : []);
  const R = S.run, m = R.map;
  console.log('seed', seed, 'map', m.W, m.H, 'hero', Math.round(R.hero.x), Math.round(R.hero.y), 'screen', S.screen, 'floor', R.floor, 'cls', R.hero.cls);
  console.log('svc', JSON.stringify(Object.fromEntries(Object.entries(m.town.svc).map(([k, v]) => [k, [Math.round(v.x), Math.round(v.y)]]))));
  console.log('folk', JSON.stringify((R.folk || []).map((f) => [f.role, Math.round(f.x), Math.round(f.y)])));
  console.log('exit', JSON.stringify(m.exit), 'up', JSON.stringify(m.up), 'keys', Object.keys(m.town).join(','));
  console.log('rooms', JSON.stringify(m.rooms.map((r) => [r.x, r.y, r.w, r.h])));
}
