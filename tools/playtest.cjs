// node tools/playtest.cjs [seed] — a bot plays the campaign headless: clears each floor, spends points, takes the stairs.
const SIM = require('../live/sim.js'), D = require('../live/data.js');
const seed = +(process.argv[2] || 1);
const S = SIM.spawn(0, {}); S.seedBase = seed; SIM.step(S, { keys: [], px: 960, py: 598, click: 1 });
let f0 = 0, tF = 0, log = [];
for (let i = 0; i < 120 * 60 * 40 && S.run; i++) {
  const R = S.run, h = R.hero;
  if (R.floor !== f0) { if (f0) log.push(`floor ${f0}: ${(S.t - tF).toFixed(0)}s lvl ${h.lvl} hp ${h.hp.toFixed(0)} kills ${R.kills} gold ${h.gold}`); f0 = R.floor; tF = S.t; }
  // spend points: str/vit alternately, skills in order
  while (h.pts > 0) { const k = ['str', 'vit', 'agi', 'int'][h.pts % 4]; h.base[k]++; h.pts--; }
  for (const a of D.ABILITIES) if (h.sp > 0 && h.lvl >= a.unlock && (h.ab[a.id] || 0) < D.AB_MAX) { h.ab[a.id] = (h.ab[a.id] || 0) + 1; h.sp--; }
  // equip better items
  const st = SIM.stats(h, S.meta);
  h.bag.forEach((it, j) => { if (!it || SIM.isCons(it)) return; const sl = D.BASES[it.b].slot, cur = h.eq[sl]; const v = (x) => x ? (x.atk || 0) * 2 + (x.def || 0) * 2 + x.rar * 3 + x.lvl : -1; if (v(it) > v(cur)) { h.eq[sl] = it; h.bag[j] = cur; } });
  let inp = SIM.scriptInput(S.t, S);
  const alive = R.en.filter((e) => e.deadT < 0).length;
  if (!alive || (R.floor < 8 && S.t - tF > 200)) {      // walk to the exit
    const m = R.map, F = SIM.flow(m, m.exit.tx, m.exit.ty, 1), tx = Math.floor(h.x / 32), ty = Math.floor(h.y / 32);
    inp = { keys: [], px: 960, py: 540 }; let best = null;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = F[(ty + ay) * m.W + tx + ax]; if (v >= 0 && (!best || v < best[0])) best = [v, ax, ay]; }
    if (best) { const gx = (tx + best[1]) * 32 + 16 - h.x, gy = (ty + best[2]) * 32 + 18 - h.y; if (Math.abs(gx) > 4) inp[gx > 0 ? 'right' : 'left'] = 1; if (Math.abs(gy) > 4) inp[gy > 0 ? 'down' : 'up'] = 1; }
    if (Math.hypot(m.exit.x - h.x, m.exit.y - h.y) < 55) inp.keys.push('KeyE');
  }
  // stuck against a prop for a second: swing in the walking direction (breaks barrels and pots)
  if (Math.hypot(h.x - (S._lx || 0), h.y - (S._ly || 0)) > 20) { S._lx = h.x; S._ly = h.y; S._lt = S.t; }
  if (S.t - S._lt > 1) { const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); inp.press = 1; inp.px = h.x - R.cam[0] + dx * 60; inp.py = h.y - 30 - R.cam[1] + dy * 60; if (S.t - S._lt > 3) { inp.keys.push('Space'); S._lt = S.t; } }
  if (h.hp < st.maxHp * 0.35) inp.keys.push('KeyQ');
  if (h.mp < 15) inp.keys.push('KeyR');
  if (inp.slot === 0 && h.cd.whirl <= S.t && R.en.filter((e) => e.deadT < 0 && Math.hypot(e.x - h.x, e.y - h.y) < 90).length >= 3) inp.slot = 1;
  if (h.ab.shield && h.cd.shield <= S.t && h.hp < st.maxHp * 0.6) inp.slot = 3;
  S._minhp = Math.min(S._minhp || 1, h.hp / st.maxHp);
  SIM.step(S, inp); if (process.env.DBG && S.steps % 1200 === 0) console.log(S.t.toFixed(0), "pos", h.x.toFixed(0), h.y.toFixed(0), "hp", h.hp.toFixed(0), "alive", alive, "kills", R.kills, "inp", JSON.stringify(inp).slice(0,90));
}
console.log(log.join('\n'));
console.log('minhp', (S._minhp*100).toFixed(0)+'%', 'end', S.screen, JSON.stringify(S.result), 'shards', S.meta.shards);
