// node survey.cjs N: town-run floors 13-15, layouts, gates, bridges, arrival
const L = require('./lib.cjs'), { SIM, D, T, cellOf, way, ringCells, mean } = L; const N = +(process.argv[2] || 30);
const mkT = (sd, f) => { const S = SIM.create(); S.demo = 0; S.meta = S.meta || {}; S.run = SIM.newRun(S, 'campaign', sd * 7, { town: true }); S.screen = 'play'; for (let g = 1; g <= f; g++) SIM.enterFloor(S, S.run, g); return S; };
module.exports = { mkT };
if (require.main === module) {
const rows = [];
for (let sd = 1; sd <= N; sd++) for (const f of [13, 14, 15]) { const t0 = Date.now(); const S = mkT(sd, f), R = S.run, m = R.map, h = R.hero, W = m.W; if (m.biome !== 'magma') { rows.push({ sd, f, biome: m.biome }); continue; }
  const w = way(S), on = new Set(w), gates = m.hazards.filter((z) => z.gate), sets = {}; gates.forEach((z) => { (sets[z.ph] = sets[z.ph] || []).push(z); });
  const xs = m.crossings.filter((c) => c.cells.some((k) => on.has(k))), br = xs.map((c) => { const r = way(S, new Set(c.cells)); return { kind: c.kind, n: c.cells.length, round: r ? r.length - w.length : null }; });
  const out = { sd, f, ft: m.ftype + (m.ftype2 ? '+' + m.ftype2 : ''), way: w.length, gateN: Object.keys(sets).length, br, haz: { vent: m.hazards.filter((z) => z.k === 'vent' && !z.gate).length, fall: m.hazards.filter((z) => z.k === 'fall').length, surge: m.hazards.filter((z) => z.k === 'surge').length }, en: R.en.filter((e) => e.deadT < 0).length };
  out.gates = Object.values(sets).map((g) => { const rc = new Set(g.flatMap((z) => ringCells(m, z))); const r = way(S, rc); const idx = w.findIndex((k) => rc.has(k)); return { at: idx / w.length, n: g.length, bypass: r ? r.length - w.length : null, rcOn: w.filter((k) => rc.has(k)).length }; });
  // arrival
  for (let i = 0; i < 12; i++) SIM.step(S, { keys: [] }); const Z = R.zoom || D.ZOOM || 1, vw = 1920 / Z / T / 2, vh = 1080 / Z / T / 2, cr = new Set(m.crust || []); let seen = 0, view = 0, near = 99;
  for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 3 && !cr.has(k)) { const dx = ((k % W + .5) * T - h.x) / T, dy = ((Math.floor(k / W) + .5) * T - h.y) / T; near = Math.min(near, Math.hypot(dx, dy)); if (Math.abs(dx) < vw && Math.abs(dy) < vh) { view++; if (R.seen[k]) seen++; } }
  out.arr = { seen, view, near: +near.toFixed(1), enNear: +Math.min(...R.en.filter((e) => e.deadT < 0).map((e) => Math.hypot(e.x - h.x, e.y - h.y) / T)).toFixed(1) };
  out.ms = Date.now() - t0; rows.push(out); }
const mg = rows.filter((r) => r.ft);
for (const r of rows) console.log(r.ft ? JSON.stringify(r) : `s${r.sd} f${r.f} ${r.biome}`);
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
console.log(`\nfloors ${mg.length}`); for (const f of [13, 14, 15]) { const F = mg.filter((r) => r.f === f), t = {}; F.forEach((r) => t[r.ft] = (t[r.ft] || 0) + 1); console.log(f, 'types', JSON.stringify(t), 'gate floors', F.filter((r) => r.gateN).length, '/', F.length, 'way mean', mean(F.map((r) => r.way)).toFixed(0)); }
const A = mg.flatMap((r) => r.br); console.log('crossings on walk', A.length, 'lone', A.filter((b) => b.round === null).length, 'rounds p50', pct(A.filter((b) => b.round !== null).map((b) => b.round), 0.5), 'p90', pct(A.filter((b) => b.round !== null).map((b) => b.round), 0.9));
console.log('floors with any lone crossing', mg.filter((r) => r.br.some((b) => b.round === null)).length, 'floors no crossing on walk', mg.filter((r) => !r.br.length).length);
const G = mg.flatMap((r) => r.gates); console.log('gate sets', G.length, 'at p50', pct(G.map((g) => g.at), .5), 'bypassable', G.filter((g) => g.bypass !== null).length, 'off-walk (rc 0)', G.filter((g) => !g.rcOn).length, 'rc cells on walk mean', mean(G.map((g) => g.rcOn)).toFixed(1));
console.log('arrival: seen0', mg.filter((r) => r.arr.seen === 0).length, 'seen<8', mg.filter((r) => r.arr.seen < 8).length, 'med', pct(mg.map((r) => r.arr.seen), .5), 'nearest max', Math.max(...mg.map((r) => r.arr.near)), 'enemy min', Math.min(...mg.map((r) => r.arr.enNear)));
const AC = mg.filter((r) => /chasm/.test(r.ft)); console.log('arrival chasm (hot lava cells seen, crust excluded; need >= 8):', AC.length, 'seen<8', AC.filter((r) => r.arr.seen < 8).length, 'min', Math.min(...AC.map((r) => r.arr.seen)), 'med', pct(AC.map((r) => r.arr.seen), .5));
}
