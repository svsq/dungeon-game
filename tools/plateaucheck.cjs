// node tools/plateaucheck.cjs [--seeds 30] [--out frames/plateau] [--maps 4]
// The magma caves' plateau archetype (TASKS 400) against the water caves on the same floor numbers: the walk from the spawn to the
// stairs (mean, median, range; a plain plateau's least is held to data.js ARCH.plateau.path, 0.9 of it loose), genFloor time,
// ridge lengths (edge to edge), loops, ledges, lava share and how much of the map is floor; the lava's lakes, sources, crossings by
// kind and crust (TASKS 401). Writes an overview of the first --maps seeds' floors (floor grey, lava orange — a river's brighter —,
// crust brown, crossings: a bridge wood, slabs slate, an arch pale grey; sources white, vents yellow; chasm black, wall rows
// grey-blue, rooms framed by role). Exit 2 when a plain plateau floor
// walks less than its least, or the frame's shares are off their bands (TASKS 422). The floor types (426–431) are listed after.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const DG = require('../live/dungeon.js'), D = require('../live/data.js');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const N = +opt('seeds', 30), out = opt('out', 'frames/plateau'), nMaps = +opt('maps', 4);
fs.mkdirSync(out, { recursive: true });

const walkOf = (m) => { const W = m.W, s = Math.floor(m.spawn.y / 32) * W + Math.floor(m.spawn.x / 32), e = m.exit.ty * W + m.exit.tx, d = new Int32Array(W * m.H).fill(-1), q = [s]; d[s] = 0;
  for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && m.cells[n] === 1) { d[n] = d[q[i]] + 1; q.push(n); } } return d[e]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length, med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
// (the magma's floors held to the walk and the frame are its plain plateaus, TASKS 1146: since the floor types (426–431) a lake's
// walk is cut short by its islands on purpose, a chasm's frame is a third dark, and over all types 4 of the checks failed on a
// game as designed; the types are listed after, measured and not held)
const gen = (mode, f, sd, ftype) => { const t0 = process.hrtime.bigint(), m = DG.genFloor(sd * 31 + f * 1013, f, { mode, ...(ftype ? { ftype } : {}) }); return [m, Number(process.hrtime.bigint() - t0) / 1e6]; };

// a PNG of an RGB buffer, no dependencies
const png = (file, w, h, rgb) => { const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); };
const ROLE = { start: [60, 220, 60], exit: [60, 160, 255], boss: [255, 40, 40], shop: [255, 220, 0], treasure: [255, 160, 220], shrine: [200, 120, 255], secret: [120, 80, 200] };
const overview = (m, file) => { const S = 6, w = m.W * S, h = m.H * S, b = Buffer.alloc(w * h * 3), put = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) { const i = (y * w + x) * 3; b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; } };
  const crust = new Set(m.crust || []), XC = { bridge: [150, 95, 40], slabs: [90, 100, 120], arch: [200, 200, 210] }, over = new Map((m.crossings || []).flatMap((c) => c.cells.map((k) => [k, XC[c.kind]])));
  for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { const k = y * m.W + x, v = m.cells[k], c = over.get(k) || (crust.has(k) ? [120, 50, 25] : v === 1 ? [150, 140, 125] : v === 3 ? (m.lavaFlow[k] !== undefined ? [255, 120, 30] : [210, 75, 15]) : v === 4 ? [90, 60, 120] : m.cliff && y < m.cliff[x] ? [70, 70, 82] : [12, 10, 14]);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) put(x * S + i, y * S + j, c); }
  for (const r of m.rooms) { const c = ROLE[r.type] || [110, 100, 90]; for (let i = r.x * S; i < (r.x + r.w) * S; i++) { put(i, r.y * S, c); put(i, (r.y + r.h) * S - 1, c); } for (let j = r.y * S; j < (r.y + r.h) * S; j++) { put(r.x * S, j, c); put((r.x + r.w) * S - 1, j, c); } }
  const dot = (px, py, c, R) => { for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) if (i * i + j * j <= R * R) put(Math.round(px / 32 * S) + i, Math.round(py / 32 * S) + j, c); };
  for (const e of m.enemies) dot(e.x, e.y, [200, 0, 0], 2); for (const c of m.chests) dot(c.x, c.y, [255, 215, 0], 2); dot(m.spawn.x, m.spawn.y, [0, 255, 0], 4);
  for (const q of m.lavaFeatures || []) dot(q.x, q.y, q.kind === 'vent' ? [255, 255, 120] : [255, 255, 255], 3); dot(m.exit.x, m.exit.y, [0, 200, 255], 4);
  png(file, w, h, b); };

// what the camera sees (TASKS 422): a 60×34-cell window (the 1920×1080 view at zoom 1) centred on every 3rd floor cell and held
// inside the map (the camera's own leave past the map's edge, for the HUD, shows the same dark on every floor and is left out),
// the wall rows along the top left out. Plateau: floor (crossings count as floor, crust as lava); lava: lava; chasm: the open dark.
// The task's bands: plateau 50 % and more, lava 20–30 %, chasm 15 % and less, over all floors
const shareOf = (m) => { const W = m.W, H = m.H, cls = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = m.cells[y * W + x];
    cls[y * W + x] = v === 3 ? 1 : v ? 0 : m.cliff && y < m.cliff[x] ? 3 : 2; }
  const S = [0, 0, 0]; let n = 0;
  for (let k = 0; k < W * H; k += 3) { if (cls[k] !== 0 || m.cells[k] !== 1) continue; const cx = Math.max(30, Math.min(W - 30, k % W)), cy = Math.max(17, Math.min(H - 17, Math.floor(k / W))); n++;
    for (let y = cy - 17; y < cy + 17; y++) for (let x = cx - 30; x < cx + 30; x++) { const c = x < 0 || y < 0 || x >= W || y >= H ? 2 : cls[y * W + x]; if (c < 3) S[c]++; } }
  const t = S[0] + S[1] + S[2]; return S.map((v) => v / t); };
const caveMean = [], rows = []; let bad = 0; const SH = [];
for (let f = 1; f <= 3; f++) { const P = [], T = []; for (let sd = 1; sd <= N; sd++) { const [m, t] = gen('cave', f, sd); P.push(walkOf(m)); T.push(t); } caveMean[f] = mean(P);
  rows.push(`cave    f${f} ${D.RUNS.cave.size[f - 1].join('×')}: walk mean ${mean(P).toFixed(0)} med ${med(P)} ${Math.min(...P)}–${Math.max(...P)} | gen ${mean(T).toFixed(0)} ms (max ${Math.max(...T).toFixed(0)})`); }
for (let f = 1; f <= D.RUNS.magma.floors; f++) { const P = [], T = [], L = [], LV = [], FL = [], LP = [], LG = [], SC = [], X = {}, LK = [], SR = [], CR = [];
  for (let sd = 1; sd <= N; sd++) { const [m, t] = gen('magma', f, sd, f < D.RUNS.magma.floors ? 'plain' : undefined); P.push(walkOf(m)); T.push(t); L.push(...m.ridges);
    const fl = m.cells.filter((c) => c === 1).length, lv = m.cells.filter((c) => c === 3).length, main = m.rooms.filter((r) => !r.pocket && r.type !== 'secret').length;
    LV.push(lv / (fl + lv)); FL.push(fl / (m.W * m.H)); LP.push(m.ridges.length - (main - 1)); LG.push(m.rooms.filter((r) => r.pocket).length); SC.push(m.secrets.length);
    for (const c of m.crossings) X[c.kind] = (X[c.kind] || 0) + 1; LK.push(m.lavaBodies.filter((b) => b.kind === 'lake').length); SR.push(m.lavaFeatures.length); CR.push(m.crust.length);
    SH.push(shareOf(m)); if (sd <= nMaps) overview(m, path.join(out, `magma_f${f}_s${sd}.png`)); }
  const ratio = caveMean[f] ? ` = ${(mean(P) / caveMean[f]).toFixed(2)}× the caves' mean (least ${(Math.min(...P) / caveMean[f]).toFixed(2)}×)` : '';
  // (held to the generator's own least, TASKS 1146: ARCH.plateau.path, 0.9 of it on a floor laid loose after the strict tries; 1.4 × the
  // caves' mean, that least's source in 400, now asks 148.4 on the 1st of a rule that keeps 148, and 133 when laid loose)
  const least = D.ARCH.plateau.path[f - 1] * 0.9; if (caveMean[f] && Math.min(...P) < least) { bad++; rows.push(`        f${f}: a walk of ${Math.min(...P)} under the generator's least ${least.toFixed(0)}`); }
  rows.push(`plateau f${f} ${D.RUNS.magma.size[f - 1].join('×')}: walk mean ${mean(P).toFixed(0)} med ${med(P)} ${Math.min(...P)}–${Math.max(...P)}${ratio} | gen ${mean(T).toFixed(0)} ms (max ${Math.max(...T).toFixed(0)})`);
  rows.push(`        ridges ${L.length}: p10 ${pct(L, 0.1)} med ${med(L)} p90 ${pct(L, 0.9)} cells (under 15: ${(L.filter((v) => v < 15).length / L.length * 100).toFixed(0)} %, over 30: ${(L.filter((v) => v > 30).length / L.length * 100).toFixed(0)} %) | loops ${mean(LP).toFixed(1)} (${Math.min(...LP)}–${Math.max(...LP)}) | ledges ${mean(LG).toFixed(1)} | secrets ${mean(SC).toFixed(1)} | lava ${(mean(LV) * 100).toFixed(0)} % of floor+lava (${(Math.min(...LV) * 100).toFixed(0)}–${(Math.max(...LV) * 100).toFixed(0)}) | floor ${(mean(FL) * 100).toFixed(0)} % of the map`);
  rows.push(`        lakes ${mean(LK).toFixed(1)} | sources ${mean(SR).toFixed(1)} | crossings ${Object.entries(X).map(([k, v]) => k + ' ' + (v / N).toFixed(1)).join(', ')} a floor | crust ${mean(CR).toFixed(0)} cells`); }
{ const P = SH.map((s) => s[0]), L = SH.map((s) => s[1]), C = SH.map((s) => s[2]), r = (a) => `${(mean(a) * 100).toFixed(0)} % (${(Math.min(...a) * 100).toFixed(0)}–${(Math.max(...a) * 100).toFixed(0)})`;
  rows.push(`in the frame (all floors): plateau ${r(P)} | lava ${r(L)} | chasm ${r(C)}`);
  // (lava to 35 %, TASKS 1146: since 432 a plain plateau's lava is held to 0.2–0.4 of its floor, ARCH.plateau.lava.share; the frame's 30 %
  // sat on the old line)
  if (mean(P) < 0.5 || mean(L) < 0.2 || mean(L) > 0.35 || mean(C) > 0.15) { bad++; rows.push('        the frame is off the bands (plateau ≥ 50 %, lava 20–35 %, chasm ≤ 15 %)'); } }
{ const by = {}; for (let f = 1; f < D.RUNS.magma.floors; f++) for (let sd = 1; sd <= N; sd++) { const [m] = gen('magma', f, sd), k = m.ftype + (m.ftype2 ? '+' + m.ftype2 : ''), q = by[k] || (by[k] = { P: [], S: [] }); q.P.push(walkOf(m)); q.S.push(shareOf(m)); }
  rows.push('the floor types as the runs draw them (measured, not held):');
  for (const [k, q] of Object.entries(by)) rows.push(`        ${k.padEnd(14)} ${String(q.P.length).padStart(3)} floors: walk mean ${mean(q.P).toFixed(0)} ${Math.min(...q.P)}–${Math.max(...q.P)} | frame plateau ${(mean(q.S.map((v) => v[0])) * 100).toFixed(0)} %, lava ${(mean(q.S.map((v) => v[1])) * 100).toFixed(0)} %, chasm ${(mean(q.S.map((v) => v[2])) * 100).toFixed(0)} %`); }
console.log(rows.join('\n'));
console.log(bad ? `plateaucheck: ${bad} failure(s) (a plain floor's walk under the generator's least, or the frame off its bands)` : `plateaucheck: ok (${N} seeds, overviews in ${out})`);
if (bad) process.exitCode = 2;
