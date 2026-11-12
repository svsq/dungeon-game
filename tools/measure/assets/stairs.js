// stairs.js (r15, restores the lost r14 stairs.mjs): the way in (map.up) and the stairs down (map.exit) on campaign floors 13–16 via the town,
// seeds 1–3 (sd * 7), hero just south of each; run: node tools/measure/frame/shot.mjs tools/measure/assets/stairs.js frames/critic_r15_assets/stairs
(() => { const shots = [], info = [], I = { px: 960, py: 540, keys: [] };
  const mk = (sd, f) => { const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, I); S.run = SIM.newRun(S, 'campaign', sd * 7, { town: true }); S.screen = 'play'; SIM.enterFloor(S, S.run, f); return S; };
  const adv = (S, s) => { for (let i = 0, n = Math.round(s * 120); i < n; i++) { const h = S.run.hero; h.hp = Math.max(h.hp, 40); SIM.step(S, I); } };
  const away = (S) => { const R = S.run; for (const e of R.en) { e.x += 9000; e.hx = e.x; } };
  for (const sd of [1, 2, 3]) for (const f of [13, 14, 15, 16]) {
    const S = mk(sd, f), R = S.run; away(S);
    for (const [k, o] of [['up', R.map.up], ['exit', R.map.exit]]) { if (!o) continue; const T = structuredClone(S), H = T.run.hero; H.x = o.x + 40; H.y = o.y + 70; adv(T, 0.6);
      shots.push([`s${sd}_f${f}_${k}`, T]); const z = T.run.zoom || T.meta.zoom || 1;
      info.push({ floor: T.run.floor, biome: T.run.map.biome, type: T.run.map.type, at: [Math.round((o.x - T.run.cam[0]) * z), Math.round((o.y - T.run.cam[1]) * z)], z }); }
  }
  window.__SHOTS = shots; window.__INFO = info; })();
