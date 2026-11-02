// node tools/plateaucheck.cjs [--seeds 30] [--out frames/plateau] [--maps 4]
// The magma caves' plateau archetype (TASKS 400) against the water caves on the same floor numbers: the walk from the spawn to the
// stairs (mean, median, range; the plateau's least is held to 1.4 × the caves' mean, data.js ARCH.plateau.path), genFloor time,
// ridge lengths (edge to edge), loops, ledges, lava share and how much of the map is floor; the lava's lakes, sources, crossings by
// kind and crust (TASKS 401). Writes an overview of the first --maps seeds' floors (floor grey, lava orange — a river's brighter —,
// crust brown, crossings: a bridge wood, slabs slate, an arch pale grey; sources white, vents yellow; chasm black, wall rows
// grey-blue, rooms framed by role). Exit 2 when a plateau floor
// walks less than 1.4 × the caves' mean.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const DG = require('../live/dungeon.js'), D = require('../live/data.js');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const N = +opt('seeds', 30), out = opt('out', 'frames/plateau'), nMaps = +opt('maps', 4);
fs.mkdirSync(out, { recursive: true });

const walkOf = (m) => { const W = m.W, s = Math.floor(m.spawn.y / 32) * W + Math.floor(m.spawn.x / 32), e = m.exit.ty * W + m.exit.tx, d = new Int32Array(W * m.H).fill(-1), q = [s]; d[s] = 0;
  for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && m.cells[n] === 1) { d[n] = d[q[i]] + 1; q.push(n); } } return d[e]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length, med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
const gen = (mode, f, sd) => { const t0 = process.hrtime.bigint(), m = DG.genFloor(sd * 31 + f * 1013, f, { mode }); return [m, Number(process.hrtime.bigint() - t0) / 1e6]; };

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

const caveMean = [], rows = []; let bad = 0;
for (let f = 1; f <= 3; f++) { const P = [], T = []; for (let sd = 1; sd <= N; sd++) { const [m, t] = gen('cave', f, sd); P.push(walkOf(m)); T.push(t); } caveMean[f] = mean(P);
  rows.push(`cave    f${f} ${D.RUNS.cave.size[f - 1].join('×')}: walk mean ${mean(P).toFixed(0)} med ${med(P)} ${Math.min(...P)}–${Math.max(...P)} | gen ${mean(T).toFixed(0)} ms (max ${Math.max(...T).toFixed(0)})`); }
for (let f = 1; f <= D.RUNS.magma.floors; f++) { const P = [], T = [], L = [], LV = [], FL = [], LP = [], LG = [], SC = [], X = {}, LK = [], SR = [], CR = [];
  for (let sd = 1; sd <= N; sd++) { const [m, t] = gen('magma', f, sd); P.push(walkOf(m)); T.push(t); L.push(...m.ridges);
    const fl = m.cells.filter((c) => c === 1).length, lv = m.cells.filter((c) => c === 3).length, main = m.rooms.filter((r) => !r.pocket && r.type !== 'secret').length;
    LV.push(lv / (fl + lv)); FL.push(fl / (m.W * m.H)); LP.push(m.ridges.length - (main - 1)); LG.push(m.rooms.filter((r) => r.pocket).length); SC.push(m.secrets.length);
    for (const c of m.crossings) X[c.kind] = (X[c.kind] || 0) + 1; LK.push(m.lavaBodies.filter((b) => b.kind === 'lake').length); SR.push(m.lavaFeatures.length); CR.push(m.crust.length);
    if (sd <= nMaps) overview(m, path.join(out, `magma_f${f}_s${sd}.png`)); }
  const ratio = caveMean[f] ? ` = ${(mean(P) / caveMean[f]).toFixed(2)}× the caves' mean (least ${(Math.min(...P) / caveMean[f]).toFixed(2)}×)` : '';
  if (caveMean[f] && Math.min(...P) < 1.4 * caveMean[f]) bad++;
  rows.push(`plateau f${f} ${D.RUNS.magma.size[f - 1].join('×')}: walk mean ${mean(P).toFixed(0)} med ${med(P)} ${Math.min(...P)}–${Math.max(...P)}${ratio} | gen ${mean(T).toFixed(0)} ms (max ${Math.max(...T).toFixed(0)})`);
  rows.push(`        ridges ${L.length}: p10 ${pct(L, 0.1)} med ${med(L)} p90 ${pct(L, 0.9)} cells (under 15: ${(L.filter((v) => v < 15).length / L.length * 100).toFixed(0)} %, over 30: ${(L.filter((v) => v > 30).length / L.length * 100).toFixed(0)} %) | loops ${mean(LP).toFixed(1)} (${Math.min(...LP)}–${Math.max(...LP)}) | ledges ${mean(LG).toFixed(1)} | secrets ${mean(SC).toFixed(1)} | lava ${(mean(LV) * 100).toFixed(0)} % of floor+lava (${(Math.min(...LV) * 100).toFixed(0)}–${(Math.max(...LV) * 100).toFixed(0)}) | floor ${(mean(FL) * 100).toFixed(0)} % of the map`);
  rows.push(`        lakes ${mean(LK).toFixed(1)} | sources ${mean(SR).toFixed(1)} | crossings ${Object.entries(X).map(([k, v]) => k + ' ' + (v / N).toFixed(1)).join(', ')} a floor | crust ${mean(CR).toFixed(0)} cells`); }
console.log(rows.join('\n'));
console.log(bad ? `plateaucheck: ${bad} floor(s) walk less than 1.4 × the caves' mean` : `plateaucheck: ok (${N} seeds, overviews in ${out})`);
if (bad) process.exitCode = 2;
