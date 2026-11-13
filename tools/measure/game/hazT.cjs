// node tools/measure/game/hazT.cjs [N] — town run, magma floors 13–16, seeds 1..N. (1) arrival: the hero stands 6 s where he
// comes in, enemies on: hits and who; (2) blind walk: enemies off, he walks the shortest way to the stairs (or the arena on 16)
// without looking: time, hits by source (vent, gate, rock, surge, burn, spike, lava), stuck. HP shares (the blow before a shield takes its part) count against an 850-HP
// hero (QA level 15); the sim's hero is level 1, so the share of max-HP hits is taken from the sim and the flat ticks from 850.
// Rebuilt for r15 (r14 hazT.cjs and arrive2.cjs were lost 12.11.2026): new base, compare with r14 by trend only.
const { SIM, D, T, way, follow, idle, evNow, mean } = require('./lib.cjs'); const N = +(process.argv[2] || 20), HERO_HP = 850;
const rows = [];
for (let sd = 1; sd <= N; sd++) { const S = SIM.create(); S.demo = 0; S.meta = S.meta || {}; S.run = SIM.newRun(S, 'campaign', sd * 7, { town: true }); S.screen = 'play';
  for (let g = 1; g <= 16; g++) { SIM.enterFloor(S, S.run, g); if (g < 13) continue; const R = S.run, m = R.map, h = R.hero; if (m.biome !== 'magma') continue;
    if (R.maxHp0 === undefined) R.maxHp0 = h.hp; const maxHp = R.maxHp0, keep = () => { h.hp = 1e5; }; const snap = JSON.stringify({ x: h.x, y: h.y });
    // arrival
    keep(); const arr = {}; for (let i = 0; i < Math.round(6 / SIM.DT); i++) { SIM.step(S, { keys: [] }); for (const e of evNow(S)) if (e.k === 'hurt') arr[e.src] = (arr[e.src] || 0) + (e.blow ?? e.n); }
    // blind walk, from where he came in
    const o = JSON.parse(snap); h.x = o.x; h.y = o.y; h.vx = h.vy = 0; h.burn = 0; h.stag = null; const en = R.en; R.en = []; R.proj = []; R.pyres = []; keep();
    const w = way(S); if (!w) { rows.push({ sd, f: g, ft: m.ftype, noway: 1 }); R.en = en; continue; }
    const cut = w.slice(0, Math.max(2, w.length - 2)); const r = follow(S, cut, 240);
    const by = {}; for (const e of r.evs) if (e.k === 'hurt') by[e.src] = (by[e.src] || 0) + (e.blow ?? e.n);
    const share = Object.fromEntries(Object.entries(by).map(([k, n]) => [k, (k === 'burn' ? n / HERO_HP : n / maxHp)]));
    rows.push({ sd, f: g, ft: m.ftype + (m.ftype2 ? '+' + m.ftype2 : ''), ok: r.ok, t: r.t, cells: w.length, hits: r.hits.filter((x) => x.src !== 'burn').length, share, arr: Object.fromEntries(Object.entries(arr).map(([k, n]) => [k, n / maxHp])) });
    R.en = en; } }
const pct = (x) => (100 * x).toFixed(1) + '%';
for (const r of rows) console.log(r.noway ? `s${r.sd} f${r.f} ${r.ft}: no way` : `s${r.sd} f${r.f} ${r.ft}: ${r.ok ? 'ok' : 'STUCK'} ${r.t.toFixed(0)} s, ${r.cells} cells, hits ${r.hits}, ${JSON.stringify(Object.fromEntries(Object.entries(r.share).map(([k, v]) => [k, +(100 * v).toFixed(1)])))}${Object.keys(r.arr).length ? ' ARRIVAL ' + JSON.stringify(r.arr) : ''}`);
const ok = rows.filter((r) => !r.noway);
console.log('\nby floor type (blind walk, no enemies): floors, stuck, time s, hits/floor, HP share/floor');
const types = {}; for (const r of ok) (types[r.ft.split('+')[0] + (r.f === 16 ? '@16' : '')] = types[r.ft.split('+')[0] + (r.f === 16 ? '@16' : '')] || []).push(r);
for (const [k, A] of Object.entries(types)) console.log(`  ${k}: ${A.length}, stuck ${A.filter((r) => !r.ok).length}, ${mean(A.map((r) => r.t)).toFixed(0)}, ${mean(A.map((r) => r.hits)).toFixed(2)}, ${pct(mean(A.map((r) => Object.values(r.share).reduce((a, b) => a + b, 0))))}`);
const src = {}; for (const r of ok) for (const [k, v] of Object.entries(r.share)) src[k] = (src[k] || 0) + v; console.log('HP share by source, sum over floors / floors:', Object.entries(src).map(([k, v]) => `${k} ${pct(v / ok.length)}`).join(', '));
console.log(`arrival (6 s standing): floors hit ${ok.filter((r) => Object.keys(r.arr).length).length}/${ok.length}`, JSON.stringify(ok.filter((r) => Object.keys(r.arr).length).map((r) => `s${r.sd}f${r.f}`)));
