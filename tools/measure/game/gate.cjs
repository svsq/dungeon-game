// node tools/measure/game/gate.cjs [N] [phases] — gates (vent rows, TASKS 1645/1710/1920) on the town run's magma floors 13–15:
// for every gate set on the walk to the stairs, the hero walks from 6 cells before its ring to 6 past it, without enemies or other
// hazards, entering at `phases` evenly spread points of the gate's cycle ("blind"); a "reader" stops a cell before the ring and goes
// when the burst is over. Reports blind hit share, time with/without a hit, expected blind cost vs the reader's wait, HP lost,
// knock-back distance and whether the knock-back ends on lava; also whether the ring centre and rim are in R.seen 6 cells out.
// Rebuilt for r15 (the r14 gate.cjs/knock.cjs were lost 12.11.2026): new base, compare with r14 by trend only.
const { SIM, D, T, cellOf, way, follow, mean } = require('./lib.cjs'), { mkT } = require('./survey.cjs');
const N = +(process.argv[2] || 20), P = +(process.argv[3] || 16);
// the sim's hero here is level 1 (130 HP): the vent's share of max HP scales, the burn ticks are flat, so they count against the
// HP a hero has by floor 13 in the QA states (about 850)
const HERO_HP = 850;
const ring = (m, zs) => { const out = new Set(); for (const z of zs) { const c = cellOf(m, z.x, z.y); for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) { const k = c + j * m.W + i; if (D.hazIn(z, (k % m.W + 0.5) * T, (Math.floor(k / m.W) + 0.5) * T)) out.add(k); } } return out; };
const rows = [], seenRows = [];
for (let sd = 1; sd <= N; sd++) for (const f of [13, 14, 15]) { const S = mkT(sd, f), R = S.run, m = R.map, h = R.hero, W = m.W; if (m.biome !== 'magma') continue; R.en = [];
  const all = m.hazards, sets = {}; all.filter((z) => z.gate).forEach((z) => (sets[z.ph] = sets[z.ph] || []).push(z)); const w = way(S); if (!w) continue;
  const home = [h.x, h.y];
  for (const [ph, zs] of Object.entries(sets)) { const rc = ring(m, zs), i0 = w.findIndex((k) => rc.has(k)); if (i0 < 0 || i0 > w.length - 6) continue; let i1 = i0; while (i1 + 1 < w.length && rc.has(w[i1 + 1])) i1++;
    const a = Math.max(0, i0 - 6), b = Math.min(w.length - 4, i1 + 6), seg = w.slice(a, b + 1), per = zs[0].per, H = D.HAZ.vent;
    const put = (k) => { h.x = (k % W + 0.5) * T; h.y = (Math.floor(k / W) + 0.5) * T + 2; h.vx = h.vy = 0; h.burn = 0; h.stag = null; h.haz = {}; h.sunk = 0; };
    m.hazards = zs; if (R.maxHp0 === undefined) R.maxHp0 = h.hp; const maxHp = R.maxHp0; const keep = () => { h.hp = 1e5; };
    // what the hero knows of the ring standing 6 cells out, after a moment there
    put(w[a]); for (let s = 0; s < 20; s++) SIM.step(S, { keys: [] }); const rim = zs.flatMap((z) => { const [rx, ry] = D.hazAxes(z); return [[z.x, z.y], [z.x + rx, z.y], [z.x - rx, z.y], [z.x, z.y + ry], [z.x, z.y - ry]]; });
    seenRows.push({ sd, f, ph, centre: zs.every((z) => R.seen[cellOf(m, z.x, z.y)]), rim: rim.filter(([x, y]) => R.seen[cellOf(m, x, y)]).length / rim.length });
    const setPhase = (p) => { for (const z of zs) z.lag = S.t - (p - z.ph) * per; };
    for (let p = 0; p < P; p++) { put(w[a]); keep(); setPhase((p + 0.5) / P - 0.33); // phase at the ring ≈ p/P (6 cells ≈ 0.33 cycle at walk speed, rough)
      let sunk = 0, kb = 0, at = null; const r = follow(S, seg, 30, (S2) => { if (h.sunk) sunk = 1; if (h.stag && !at) at = [h.x, h.y]; if (at && h.stag && S2.t < h.stag.t) kb = Math.max(kb, Math.hypot(h.x - at[0], h.y - at[1])); }); const vh = r.hits.filter((x) => x.src === 'vent');
      const hv = r.evs.filter((e) => e.k === 'hurt' && e.src === 'vent').reduce((s2, e) => s2 + (e.blow ?? e.n), 0), hb = r.evs.filter((e) => e.k === 'hurt' && e.src === 'burn').reduce((s2, e) => s2 + e.n, 0);
      rows.push({ sd, f, ph, p, ok: r.ok, t: r.t, hits: vh.length, hp: hv / maxHp + hb / HERO_HP, stuck: !r.ok, sunk, kb }); }
    // reader: walk to the cell before the ring, wait for the burst to end, then go
    for (let p = 0; p < 4; p++) { put(w[a]); keep(); setPhase(p / 4); const t0 = S.t; const pre = w.slice(a, Math.max(a + 1, i0)); follow(S, pre, 20); const tw = S.t;
      let g = 0; const c = () => D.hazClock(zs[0], S.t); while (!(c() > H.burst + 0.05 && c() < H.burst + 0.2) && g++ < 600) SIM.step(S, { keys: [] }); const waited = S.t - tw;
      const r = follow(S, w.slice(Math.max(a, i0 - 1), b + 1), 30); rows.push({ sd, f, ph, reader: 1, t: S.t - t0, waited, hits: r.hits.filter((x) => x.src === 'vent').length }); }
    m.hazards = all; }
  h.x = home[0]; h.y = home[1]; }
const B = rows.filter((r) => !r.reader), hit = B.filter((r) => r.hits && r.ok), hitAll = B.filter((r) => r.hits), clean = B.filter((r) => !r.hits && r.ok), Rd = rows.filter((r) => r.reader);
const sets = new Set(B.map((r) => `${r.sd}/${r.f}/${r.ph}`)).size;
const extra = mean(hit.map((r) => r.t)) - mean(clean.map((r) => r.t));
for (const r of B.filter((r) => r.stuck || r.hits > 2)) console.log(`  s${r.sd} f${r.f} gate ${String(r.ph).slice(0, 6)} phase ${r.p}: ${r.stuck ? 'stuck' : 'through'} after ${r.t.toFixed(1)} s, ${r.hits} hits`);
console.log(`gate sets on the walk ${sets}, blind passes ${B.length}, stuck ${B.filter((r) => r.stuck).length} (the walker lost its path after a knock-back or bounced each cycle; left out of the times)`);
console.log(`blind hit share ${(100 * hitAll.length / B.length).toFixed(1)}%, hits per hit pass max ${Math.max(0, ...hit.map((r) => r.hits))}`);
console.log(`time clean ${mean(clean.map((r) => r.t)).toFixed(2)} s, with hit ${mean(hit.map((r) => r.t)).toFixed(2)} s, extra per hit ${extra.toFixed(2)} s`);
console.log(`expected blind cost ${(hitAll.length / B.length * extra).toFixed(2)} s; HP per blind pass ${(100 * mean(B.map((r) => r.hp))).toFixed(2)}%, per hit pass ${(100 * mean(hit.map((r) => r.hp))).toFixed(2)}%`);
console.log(`knock-back px mean ${mean(hit.map((r) => r.kb)).toFixed(0)} (min ${Math.min(...hit.map((r) => r.kb)).toFixed(0)}, max ${Math.max(...hit.map((r) => r.kb)).toFixed(0)}), passes touching lava ${B.filter((r) => r.sunk).length}`);
console.log(`reader: wait ${mean(Rd.map((r) => r.waited)).toFixed(2)} s mean, hits ${Rd.filter((r) => r.hits).length}/${Rd.length}, total ${mean(Rd.map((r) => r.t)).toFixed(2)} s vs blind ${mean(B.map((r) => r.t)).toFixed(2)} s`);
console.log(`seen 6 cells out (after 0.33 s): centre of every vent ${seenRows.filter((r) => r.centre).length}/${seenRows.length}, rim share p50 ${seenRows.map((r) => r.rim).sort((a, b) => a - b)[seenRows.length >> 1]?.toFixed(2)}, rim < 0.5 ${seenRows.filter((r) => r.rim < 0.5).length}`);
