const SIM = require('../live/sim.js');
const DATA = require('../live/data.js');
const assert = require('node:assert/strict');
let success = 0, cancelled = 0;
for (const mode of ['cave', 'campaign']) {
  const S = SIM.spawn(0, {}); S.run = SIM.newRun(S, mode, 26837); S.screen = 'play';
  for (let floor = 1; floor <= DATA.runOf(mode).floors; floor++) {
    SIM.enterFloor(S, S.run, floor); const R = S.run, m = R.map;
    assert.equal(m.ambush.length, 0);
    for (const c of R.chests) {
      const room = m.rooms.find((q) => c.x >= q.x * DATA.TILE && c.x < (q.x + q.w) * DATA.TILE && c.y >= q.y * DATA.TILE && c.y < (q.y + q.h) * DATA.TILE);
      if (!room) continue;
      if (room.type === 'secret') { const secret = m.secrets.find((q) => q.room === room.id); SIM.openSecret(S, R, secret); }
      for (let trial = 0; trial < 80; trial++) {
        const T = structuredClone(S), A = T.run, C = A.chests.find((q) => q.x === c.x && q.y === c.y);
        A.rs = trial + 1; A.en = []; A.hero.x = c.x; A.hero.y = c.y + 40; T.ev = [];
        SIM.openChest(T, A, C); const got = A.en.filter((e) => e.summ === 'amb');
        if (!['treasure', 'secret'].includes(room.type)) assert.equal(got.length, 0);
        if (got.length) {
          success++; assert.ok(got.length >= 2 && got.length <= 4);
          assert.ok(got.every((e) => !e.elite && e.room === room.id && DATA.rosterAt(m.biome, floor).includes(e.type)));
        } else { cancelled++; assert.ok(!T.ev.some((e) => e.k === 'ambush')); }
        SIM.openChest(T, A, C); assert.equal(A.en.length, got.length);
        const saved = SIM.spawn(0, JSON.parse(JSON.stringify(SIM.persist(T))));
        assert.ok(saved.saved.chests.find((q) => q.x === c.x && q.y === c.y).ambushRolled);
      }
    }
  }
}
assert.ok(success > 0, 'no successful chest ambush exercised');
assert.ok(cancelled > 0, 'no cancelled chest ambush exercised');
console.log(`ambushcheck: ok (${success} groups, ${cancelled} silent outcomes, both modes, seed 26837)`);
