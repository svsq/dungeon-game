// body for evalq.mjs (r15 assets): per magma actor cycle (right/down, 6 frames each) and the hero as control. The actor is isolated as
// impbody.js does it (sprites only vs none). Measures: silhouette height h (px, mask bbox) vs sizes.js H; body L* median (mask, L* >= 8)
// against the field round it; ink: share of the mask's outer border with L* < 15 (1.0 = closed dark outline, the rim inside it);
// out: border px brighter than L* 30 (rim / light past the ink); run1: share of 1-px horizontal colour runs inside the mask (off the 2-px art grid);
// chroma C* median of the body. run: node tools/measure/motion/evalq.mjs tools/measure/assets/actors.js frames/critic_r15_assets/actors.json
const Q = SCENE.QA(), c = document.getElementById('c');
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lab = (r, g, b) => { const R = lin(r), G = lin(g), B = lin(b); const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; }, r1 = (v) => +(+v).toFixed(2);
const out = {}, png = {};
const NAMES = ['imp_right', 'imp_down', 'golem_right', 'golem_down', 'salamander_right', 'salamander_down', 'fire_priest_right', 'fire_priest_down', 'boss_colossus_right', 'boss_colossus_down', 'hero_right', 'hero_down'];
for (const NAME of NAMES) {
  const fr = Q.cycles[NAME]; if (!fr) { out[NAME] = 'no cycle'; continue; }
  const only = Q.sprites[NAME] || []; if (!only.length) { out[NAME] = 'no sprites'; continue; }
  const [bx, by, bw, bh] = Q.box(NAME, fr[0]).map(Math.round), P = 16, X0 = Math.max(0, bx - P), Y0 = Math.max(0, by - P), W = bw + 2 * P, H = bh + 2 * P;
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const g = tmp.getContext('2d', { willReadFrequently: true });
  const grab = (st, o) => { LIB.ONLY = o || []; SCENE.state = st; SCENE.render(st.t + 0.01); LIB.ONLY = []; g.clearRect(0, 0, W, H); g.drawImage(c, X0, Y0, W, H, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
  const hs = [], body = [], field = [], chroma = [], ink = [], outb = [], run1 = [], runs = [];
  for (let i = 0; i < 6; i++) { const st = fr[Math.round(i * (fr.length - 1) / 5)];
    const full = grab(st), F = grab(st, only), B = grab(st, ['__none__']), m = new Uint8Array(W * H), L = new Float32Array(W * H);
    let y0 = 1e9, y1 = -1;
    for (let k = 0; k < W * H; k++) { const d = Math.abs(F[k * 4] - B[k * 4]) + Math.abs(F[k * 4 + 1] - B[k * 4 + 1]) + Math.abs(F[k * 4 + 2] - B[k * 4 + 2]);
      const [l, a, b] = lab(full[k * 4], full[k * 4 + 1], full[k * 4 + 2]); L[k] = l;
      if (d > 24) { m[k] = 1; const y = Math.floor(k / W); y0 = Math.min(y0, y); y1 = Math.max(y1, y); if (l >= 8) { body.push(l); chroma.push(Math.hypot(a, b)); } } else field.push(l); }
    hs.push(y1 - y0 + 1);
    let nb = 0, nd = 0, no = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; if (!m[k]) continue;
      if (!m[k - 1] || !m[k + 1] || !m[k - W] || !m[k + W]) { nb++; if (L[k] < 15) nd++; if (L[k] > 30) no++; } }
    ink.push(nd / Math.max(1, nb)); outb.push(no / Math.max(1, nb));
    let n1 = 0, nr = 0;
    for (let y = 0; y < H; y++) { let len = 0; for (let x = 0; x < W; x++) { const k = y * W + x; if (!m[k]) { if (len) { nr++; if (len === 1) n1++; } len = 0; continue; }
      const same = len && x > 0 && m[k - 1] && Math.abs(full[k * 4] - full[k * 4 - 4]) + Math.abs(full[k * 4 + 1] - full[k * 4 - 3]) + Math.abs(full[k * 4 + 2] - full[k * 4 - 2]) < 18;
      if (len && !same) { nr++; if (len === 1) n1++; len = 1; } else len++; } if (len) { nr++; if (len === 1) n1++; } }
    run1.push(n1 / Math.max(1, nr));
    if (i === 0) { g.putImageData(new ImageData(new Uint8ClampedArray(full), W, H), 0, 0); png['act_' + NAME] = tmp.toDataURL(); }
  }
  out[NAME] = { h: [Math.min(...hs), Math.max(...hs)], bodyL: r1(q(body, 0.5)), bodyL75: r1(q(body, 0.75)), fieldL: r1(q(field, 0.5)), dL: r1(q(body, 0.5) - q(field, 0.5)), C: r1(q(chroma, 0.5)),
    ink: r1(ink.reduce((a, b) => a + b, 0) / ink.length), out: r1(outb.reduce((a, b) => a + b, 0) / outb.length), run1: r1(run1.reduce((a, b) => a + b, 0) / run1.length) };
}
return Object.assign(out, { png });
