// bends.js (r15): terrace bends of 1939 (slab rows that curve through the lava, `bend: 1` crossings) on campaign floors 13–16 via the town,
// seeds 1–12 (sd * 7); the first 6 found, hero set at the middle cell of the row, enemies moved away, after 0.6 s.
// run: node tools/measure/frame/shot.mjs tools/measure/assets/bends.js frames/critic_r15_assets/bends
(() => { const shots = [], info = [], I = { px: 960, py: 540, keys: [] }, T = DATA.TILE;
  const adv = (S, s) => { for (let i = 0, n = Math.round(s * 120); i < n; i++) { const h = S.run.hero; h.hp = Math.max(h.hp, 40); SIM.step(S, I); } };
  let found = 0, scanned = [];
  for (let sd = 1; sd <= 12 && found < 6; sd++) for (const f of [13, 14, 15, 16]) { if (found >= 6) break;
    const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, I); S.run = SIM.newRun(S, 'campaign', sd * 7, { town: true }); S.screen = 'play'; SIM.enterFloor(S, S.run, f);
    const R = S.run, m = R.map, bs = (m.crossings || []).filter((c) => c.bend); scanned.push([sd, f, m.ftype, bs.length]); if (!bs.length) continue;
    for (const e of R.en) { e.x += 9000; e.hx = e.x; }
    const B = bs[0], k = B.cells[Math.floor(B.cells.length / 2)]; R.hero.x = (k % m.W + 0.5) * T; R.hero.y = (Math.floor(k / m.W) + 0.5) * T;
    if (R.seen) R.seen.fill(1); adv(S, 0.6); shots.push([`bend_s${sd}_f${f}`, S]); info.push({ ftype: m.ftype, cells: B.cells.length, bends: bs.length }); found++; }
  console.log('scanned ' + JSON.stringify(scanned));
  window.__SHOTS = shots; window.__INFO = info; })();
