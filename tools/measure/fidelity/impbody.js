// body for evalq.mjs (TASKS 1941): L* of the imp on cycle_imp_right (cycle imp_right). mask: the actor alone (its sprites only vs none, as qa.mjs's
// motion check isolates it); body: the mask without the ink (L* under INK); fixed: the body as the untinted imp shows it, so a
// brighter tint is not measured over the dark shading it lifts past INK; field: the box outside the mask. Per frame and pooled
const NAME = 'imp_right', INK = 8, Q = SCENE.QA(), fr = Q.cycles[NAME], only = Q.sprites[NAME], c = document.getElementById('c');
const [bx, by, bw, bh] = Q.box(NAME, fr[0]).map(Math.round), tmp = document.createElement('canvas'); tmp.width = bw; tmp.height = bh; const g = tmp.getContext('2d', { willReadFrequently: true });
const grab = (st, o) => { LIB.ONLY = o || []; SCENE.state = st; SCENE.render(st.t + 0.01); LIB.ONLY = []; g.clearRect(0, 0, bw, bh); g.drawImage(c, bx, by, bw, bh, 0, 0, bw, bh); return g.getImageData(0, 0, bw, bh).data; };
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, Lab = (r, gg, b) => { const y = 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; }, mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const all = [], body = [], fixed = [], field = [], per = [], png = {}, E = DATA.ENEMIES.imp, t0 = E.tint;
fr.forEach((st, i) => { E.tint = [1, 1, 1, 0]; const U = grab(st); E.tint = t0; const full = grab(st), F = grab(st, only), B = grab(st, ['__none__']), b = [];
  for (let k = 0; k < bw * bh; k++) { const d = Math.abs(F[k * 4] - B[k * 4]) + Math.abs(F[k * 4 + 1] - B[k * 4 + 1]) + Math.abs(F[k * 4 + 2] - B[k * 4 + 2]), L = Lab(full[k * 4], full[k * 4 + 1], full[k * 4 + 2]);
    if (d > 24) { all.push(L); if (L >= INK) { body.push(L); b.push(L); } if (Lab(U[k * 4], U[k * 4 + 1], U[k * 4 + 2]) >= INK) fixed.push(L); } else field.push(L); }
  per.push(+q(b, 0.5).toFixed(1)); if (i === 0) { g.putImageData(new ImageData(new Uint8ClampedArray(full), bw, bh), 0, 0); png.imp_body = tmp.toDataURL(); } });
const r1 = (v) => +v.toFixed(1);
return { box: [bx, by, bw, bh], frames: fr.length, mask: { n: all.length, med: r1(q(all, 0.5)), mean: r1(mean(all)) }, body: { n: body.length, med: r1(q(body, 0.5)), mean: r1(mean(body)), p75: r1(q(body, 0.75)) }, fixed: { n: fixed.length, med: r1(q(fixed, 0.5)), mean: r1(mean(fixed)) }, field: { med: r1(q(field, 0.5)), mean: r1(mean(field)) }, perFrameBodyMed: per, png };
