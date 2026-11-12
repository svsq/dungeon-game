// frames for the game critic (shot.mjs set): node tools/measure/frame/shot.mjs tools/measure/game/set_game.js frames/critic_r15_game/shots
// town run (campaign seed sd*7, floors entered in order): terrace bends (1939) as the hero walks up to them and with the floor
// all seen; a gate's glow through the fog 12 and 7 cells out (1712); floor 13's arrival from town; floor 16 near the colossus
(() => { const G = window.DATA || (typeof DATA !== 'undefined' ? DATA : LIB.DATA); const shots = [], info = [], T = 32, VW = 1920, VH = 1080;
  const mk = (camp, f) => { const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', camp, { town: true }); S.screen = 'play'; for (let g = 1; g <= f; g++) SIM.enterFloor(S, S.run, g); return S; };
  const stepn = (S, n) => { for (let i = 0; i < n; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); };
  const walkTo = (S, e, stop, keepEn) => { const R = S.run, m = R.map, W = m.W, deck = new Set((m.crossings || []).flatMap((c) => c.cells)), cr = new Set(m.crust || []), s = Math.floor(R.hero.y / T) * W + Math.floor(R.hero.x / T), p = new Map([[s, -1]]), q = [s];
    for (let i = 0; i < q.length && !p.has(e); i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (!p.has(n) && (m.cells[n] === 1 || m.cells[n] === 6 || deck.has(n) || cr.has(n))) { p.set(n, q[i]); q.push(n); } }
    if (!p.has(e)) return null; const way = []; for (let k = e; k >= 0; k = p.get(k)) way.unshift(k); const cut = way.slice(0, Math.max(1, way.length - stop)); const en = R.en; R.en = [];
    for (const k of cut) { R.hero.x = (k % W + 0.5) * T; R.hero.y = (Math.floor(k / W) + 0.5) * T; R.hero.hp = 9999; SIM.step(S, { px: 960, py: 540, keys: [] }); } if (keepEn) R.en = en; R.msg = null; return way; };
  // bends: [camp, floor, bend cell x, y]
  for (const [camp, f, bx, by] of [[35, 14, 26, 25], [70, 15, 0, 0]]) { const S = mk(camp, f), R = S.run, m = R.map, W = m.W;
    const bends = (m.crossings || []).filter((c) => c.bend); if (!bends.length) { console.log('no bend', camp, f); continue; }
    const c = bx ? by * W + bx : bends[0].cells[bends[0].cells.length >> 1]; const way = walkTo(S, c, 6); if (!way) { console.log('noway', camp, f); continue; } stepn(S, 20); S.ev = [];
    shots.push([`bend_${camp}f${f}_walk`, S]); info.push({ ft: m.ftype, bends: bends.length });
    const A = structuredClone(S); A.run.seen = A.run.seen.map(() => 1); A.run.rseen = (A.run.rseen || []).map(() => 1); shots.push([`bend_${camp}f${f}_seen`, A]); info.push({}); }
  // gate through the fog
  for (const [camp, f] of [[7, 13], [98, 13], [14, 15]]) { const S0 = mk(camp, f), m = S0.run.map, W = m.W, g = m.hazards.filter((z) => z.gate); if (!g.length) { console.log('nogate', camp, f); continue; }
    for (const stop of [12, 7]) { const S = structuredClone(S0); const way = walkTo(S, Math.floor(g[0].y / T) * W + Math.floor(g[0].x / T), stop); if (!way) continue; stepn(S, 120);
      const z = S.run.map.hazards.find((q) => q.gate), H = G.HAZ.vent, t = (Math.ceil(S.t / z.per) + 20) * z.per - (z.ph * z.per) % z.per + (z.per - H.warn * 0.3); // late in the warning
      S.t = S.run.t = t; S.ev = []; shots.push([`gate_${camp}f${f}_${stop}`, S]); info.push({ stop, seenC: S.run.seen[Math.floor(z.y / T) * W + Math.floor(z.x / T)] }); } }
  // floor 13 from town
  // (14/14: the chasm arrival with 4 lava cells in view, survey.cjs; 203/14: archers 7.9 cells from the hero, arrive.cjs)
  for (const [camp, f] of [[7, 13], [21, 13], [14, 14], [203, 14]]) { const S = mk(camp, f); stepn(S, 3); shots.push([`arr${f}_${camp}_n3`, S]); info.push({ ft: S.run.map.ftype }); const S2 = structuredClone(S); stepn(S2, 180); shots.push([`arr${f}_${camp}_n180`, S2]); info.push({}); }
  // the colossus
  for (const camp of [7, 35]) { const S = mk(camp, 16), R = S.run, m = R.map, W = m.W, b = R.en.find((e) => e.type === 'boss_colossus'); if (!b) { console.log('noboss', camp); continue; }
    const way = walkTo(S, Math.floor(b.y / T) * W + Math.floor(b.x / T), 9, 1); if (!way) { console.log('noway boss', camp); continue; } stepn(S, 60); S.ev = []; shots.push([`boss_${camp}`, S]); info.push({ boss: [b.x | 0, b.y | 0], hero: [R.hero.x | 0, R.hero.y | 0], st: b.st }); }
  window.__SHOTS = shots; window.__INFO = info; })();
