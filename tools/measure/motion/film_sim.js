// body for evalq.mjs: the town run from the real sim, hero parked, 360 s of game time at 60 Hz; every 6th tick logs each townsperson and the cart
// node tools/measure/motion/evalq.mjs tools/measure/motion/film_sim.js frames/critic_r8_motion/film_sim.json
const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] });
S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play';
const R = S.run, m = R.map, h = R.hero; R.msg = null; R.captives = null; R.folk = DATA.folkInit(m.town.npcs);
h.x = m.town.svc.portal.x + 3 * DATA.TILE; h.y = m.town.svc.portal.y; SIM.step(S, { keys: [] }); S.ev = []; R.greet = 'done';
const rows = [], ev = [];
for (let i = 0; i < 360 * 60; i++) { SIM.step(S, { px: 960, py: 540, keys: [] });
  if (i % 6 === 0) rows.push({ t: +S.t.toFixed(2), f: R.folk.map((f) => [f.role, f.i, +f.x.toFixed(1), +f.y.toFixed(1), +(f.vx || 0).toFixed(1), +(f.vy || 0).toFixed(1), +(f.spd || 0).toFixed(1), f.go ? 1 : 0, f.way ?? -1, f.face || 0, f.load || 0, f.lift || 0]),
    c: [R.cart.st, +R.cart.s.toFixed(1), R.cart.load, R.cart.bin || 0] });
  for (const e of S.ev) if (e.k !== 'say') ev.push([+S.t.toFixed(2), e.k]); S.ev = []; }
return { n: rows.length, roles: R.folk.map((f) => f.role + f.i), rows, ev: ev.slice(0, 200), dt: S.t / (360 * 60) };
