const assert = require('node:assert/strict');
const fs = require('node:fs');
const SIM = require('../live/sim.js');
const DATA = require('../live/data.js');
const out = 'frames/cave_results';
fs.mkdirSync(out, { recursive: true });
const states = [], report = [];
const click = (S, buttons, id) => {
  const b = buttons.find((b) => b.id === id);
  assert.ok(b, id);
  SIM.step(S, { keys: [], click: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 });
  SIM.step(S, { keys: [] });
};
for (const seed of [1, 7, 26837]) for (const mode of ['cave', 'campaign']) for (const how of ['win', 'dead', 'retreat']) {
  let S = SIM.spawn(0, {}); S.run = SIM.newRun(S, mode, seed); S.screen = 'play';
  const floors = how === 'win' ? DATA.runOf(mode).floors : 2;
  for (let f = 2; f <= floors; f++) SIM.enterFloor(S, S.run, f);
  S.run.hero.ifr = 1e9;
  const before = SIM.runCompletion(S.run), hero = structuredClone(S.run.hero);
  S.screen = 'pause'; click(S, DATA.UI.pause(S.meta.zoom), 'save');
  assert.equal(S.run, null);
  S = SIM.spawn(0, JSON.parse(JSON.stringify(SIM.persist(S))));
  click(S, DATA.UI.menu(true, S.meta.diff, false, S.meta.zoom), 'continue');
  assert.equal(S.screen, 'play');
  assert.deepEqual(SIM.runCompletion(S.run), before);
  assert.deepEqual(S.run.hero.eq, hero.eq);
  const R = S.run, h = R.hero; let expected = before;
  R.freeze = 0;
  if (how === 'win') {
    const b = R.en.find((e) => e.type === (mode === 'cave' ? 'boss_serpent' : 'boss'));
    assert.ok(b);
    const room = R.map.rooms[b.room], T = DATA.TILE;
    const shore = R.map.cells.flatMap((c, k) => c === 1 ? [{ x: (k % R.map.W + 0.5) * T, y: (Math.floor(k / R.map.W) + 0.5) * T }] : [])
      .filter((p) => p.x > room.x * T + 20 && p.x < (room.x + room.w) * T - 20 && p.y > room.y * T + 20 && p.y < (room.y + room.h) * T - 20)
      .sort((a, c) => Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 150) - Math.abs(Math.hypot(c.x - b.x, c.y - b.y) - 150))[0];
    assert.ok(shore); h.x = shore.x; h.y = shore.y; SIM.step(S, { keys: [] });
    assert.ok(R.arena && R.arena.active);
    b.hp = 1; b.st = mode === 'cave' ? 'chase' : 'idle'; b.t0 = S.t;
    R.en = [b]; R.proj = [{ id: R.nextId++, own: 'hero', k: 'fire', x: b.x, y: b.y - 20, gz: 20, vx: 0, vy: 0, life: 0, t0: S.t, dmg: 1e6, r: 6 }];
    for (let i = 0; i < 3; i++) SIM.step(S, { keys: [] });
    assert.equal(R.bossDead, 1, mode + ': actual projectile did not kill boss');
    expected = SIM.runCompletion(R);
    assert.equal(expected.kills, before.kills + 1);
    R.chests = []; R.shrines = []; R.pots = []; R.en = []; R.arena = null;
    R.freeze = 0; h.x = R.map.exit.x; h.y = R.map.exit.y;
    SIM.step(S, { keys: ['KeyE'] });
  } else if (how === 'dead') {
    h.hp = 0; h.deadT = S.t;
    for (let i = 0; i < 220 && S.run; i++) SIM.step(S, { keys: [] });
  } else {
    S.screen = 'pause'; click(S, DATA.UI.pause(S.meta.zoom), 'abandon');
  }
  assert.equal(S.screen, how === 'win' ? 'win' : 'dead');
  assert.equal(S.result.mode, mode);
  assert.equal(S.result.floor, floors);
  assert.equal(S.result.C.floors, floors);
  assert.equal(S.result.abandoned, how === 'retreat');
  assert.equal(S.result.log.end.how, how === 'retreat' ? 'abandon' : how);
  assert.equal(SIM.persist(S).run, null);
  assert.equal(S.saved, null);
  assert.equal(S.result.hero.lvl, h.lvl);
  assert.ok(S.result.heroStats.maxHp > 0);
  const C = S.result.C;
  assert.deepEqual(C, expected);
  report.push({ seed, mode, how, floor: S.result.floor, C, abandoned: S.result.abandoned });
  if (mode === 'cave' && seed === 1) states.push([how + '_cave_actual', S]);
}
fs.writeFileSync(out + '/simulation.json', JSON.stringify(report, null, 2));
fs.writeFileSync(out + '/states.json', JSON.stringify(states));
console.log('caveresultcheck: ok (18 endings after save/continue, actual boss kills, cave 4/campaign 8 floors)');
