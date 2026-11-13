// body for evalq.mjs (TASKS 1942): L* p50/p95/max in magma_gate_rest's gate box (its vents' bursts across, half their height down and up: the hero's head and the torch
// behind stay out; the QA box is the hero's), at the state's time and at 7 more moments of the
// same rest (the crack's smoulder and its kinks pulse), with the box of the first as a png
const Q = SCENE.QA(), q = Q.states.find((s) => s[0] === 'magma_gate_rest'), S0 = typeof q[1] === 'function' ? q[1]() : q[1], c = document.getElementById('c');
const z = S0.run.map.hazards.find((h) => h.gate), H = DATA.HAZ.vent, gs = S0.run.map.hazards.filter((h) => h.gate && h.per === z.per && h.ph === z.ph), [Hr, Ry] = DATA.hazAxes(z), k = c.width / SCX.VW, cam = S0.run.cam;
const X = (x) => (x - cam[0]) * k, Y = (y) => (y - cam[1]) * k, bx = Math.round(X(Math.min(...gs.map((h) => h.x)) - Hr)), by = Math.round(Y(Math.min(...gs.map((h) => h.y)) - Ry / 2)), bw = Math.round(X(Math.max(...gs.map((h) => h.x)) + Hr)) - bx, bh = Math.round(Y(Math.max(...gs.map((h) => h.y)) + Ry / 2)) - by, tmp = document.createElement('canvas'); tmp.width = bw; tmp.height = bh; const g = tmp.getContext('2d', { willReadFrequently: true });
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, Lab = (r, gg, b) => { const y = 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
const rows = [], png = {};
for (let i = 0; i < 8; i++) { const S = structuredClone(S0), t = S0.t + i * 0.37; { const k0 = DATA.hazClock(z, t); if (k0 >= z.per - H.warn || k0 < H.burst) continue; } S.t = S.run.t = t; SCENE.state = S; SCENE.render(t + 0.01);
  g.drawImage(c, bx, by, bw, bh, 0, 0, bw, bh); if (!i) png.gate_rest = tmp.toDataURL(); const d = g.getImageData(0, 0, bw, bh).data, L = [];
  for (let k = 0; k < bw * bh; k++) L.push(Lab(d[k * 4], d[k * 4 + 1], d[k * 4 + 2])); L.sort((a, b) => a - b); const p = (f) => +L[Math.floor(f * (L.length - 1))].toFixed(1);
  rows.push({ t: +t.toFixed(2), p50: p(0.5), p95: p(0.95), max: p(1) }); }
png.frame = c.toDataURL(); return { box: [bx, by, bw, bh], n: gs.length, rows, p95max: Math.max(...rows.map((r) => r.p95)), png };
