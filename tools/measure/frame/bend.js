// bend.js (r15): terrace bends (TASKS 1939) on the town run, floors 13-16: one view per floor centred on its longest bend, all revealed, no enemies,
// the hero standing on the bend's middle slab; info: bend count, slab cells, slab cells of the view under the HUD panel (y > 940)
(() => { const shots = [], info = [], I = { px: 960, py: 540, keys: [] }, T = 32; let floors = 0, terr = 0;
  for (let sd = 7; sd <= 210 && shots.length < 10; sd += 7) for (const f of [13, 14, 15, 16]) {
    const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, I); S.run = SIM.newRun(S, 'campaign', sd, { town: 1 }); S.screen = 'play'; const R = S.run; SIM.enterFloor(S, R, f); const m = R.map; if (m.biome !== 'magma') continue; floors++;
    const B = (m.crossings || []).filter((c) => c.bend); if (m.ftype === 'terrace') terr++; if (!B.length || shots.length >= 10) continue;
    B.sort((a, b) => b.cells.length - a.cells.length); const b = B[0], mid = b.cells[b.cells.length >> 1], W = m.W;
    R.hero.ifr = 1e12; for (let i = 0; i < 400; i++) SIM.step(S, I); R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); if (R.rseen) R.rseen = R.rseen.map(() => 1);
    R.hero.x = (mid % W + 0.5) * T; R.hero.y = (Math.floor(mid / W) + 0.5) * T; for (let i = 0; i < 90; i++) SIM.step(S, I); R.en = []; R.msg = null;
    const z = R.zoom || S.meta.zoom || 1; let low = 0; for (const k of b.cells) { const y = ((Math.floor(k / W) + 0.5) * T - R.cam[1]) * z; if (y > 940) low++; }
    shots.push([`bend_s${sd}_f${f}`, S, S.t + 0.01]); info.push({ ft: m.ftype, bends: B.length, slabs: B.map((c) => c.cells.length), low, cam: R.cam.map(Math.round), zoom: z });
  }
  console.log(JSON.stringify({ floors, terr })); window.__SHOTS = shots; window.__INFO = info; })();
