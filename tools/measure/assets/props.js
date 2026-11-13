// body for evalq.mjs (r15 assets): props and family on magma QA states. Each prop group is isolated (its sprites only vs none, as impbody.js);
// reports px, L* p50/p90, C* p50, hue p50 of the group as the frame shows it, and the floor field. Hue in degrees of a*b* (30-60 = warm red-orange,
// 200-280 = cool blue-violet). run: node tools/measure/motion/evalq.mjs tools/measure/assets/props.js frames/critic_r15_assets/props.json
const Q = SCENE.QA(), c = document.getElementById('c'), W = 1920, H = 1080;
const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const g = tmp.getContext('2d', { willReadFrequently: true });
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lab = (r, gg, b) => { const R = lin(r), G = lin(gg), B = lin(b); const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null; };
const grab = (st, o) => { LIB.ONLY = o || []; SCENE.state = st; SCENE.render(st.t + 0.01); LIB.ONLY = []; g.clearRect(0, 0, W, H); g.drawImage(c, 0, 0); return g.getImageData(0, 0, W, H).data; };
const GROUPS = { basalt: ['basalt_a', 'basalt_b'], boulder: ['boulder_mg_a', 'boulder_mg_b'], slab: ['slab_mg_a', 'slab_mg_b', 'slab_mg_c', 'slab_mg_d'], obsidian: ['obsidian_mg'], arch: ['arch_mg'],
  vent: ['vent_mg'], post: ['bridge_post_mg'], stairs: ['stairs_mg', 'stairs_up_mg'], skel: ['skel_mg'], banner: ['banner_mg'], forge: ['forge_mg'] };
const STATES = ['zone_magma', 'magma_cave', 'magma_hall', 'magma_slabs', 'magma_arch', 'magma_terrace', 'magma_bridge', 'magma_crossing', 'magma_hall_forge', 'magma_props'];
const res = {};
for (const sn of STATES) { const st = (Q.states.find((s) => s[0] === sn) || [])[1]; if (!st) { res[sn] = 'no state'; continue; }
  const B = grab(st, ['__none__']), full = grab(st), r = {};
  for (const [gn, names] of Object.entries(GROUPS)) { const F = grab(st, names), Ls = [], Cs = [], Hs = [];
    for (let k = 0; k < W * H; k++) { const y = Math.floor(k / W), x = k % W; if (y > 930 || (x > 1520 && y < 370) || (x < 400 && y < 320)) continue;
      const d = Math.abs(F[k * 4] - B[k * 4]) + Math.abs(F[k * 4 + 1] - B[k * 4 + 1]) + Math.abs(F[k * 4 + 2] - B[k * 4 + 2]); if (d <= 24) continue;
      const [l, a, b] = lab(full[k * 4], full[k * 4 + 1], full[k * 4 + 2]); if (l < 6) continue; Ls.push(l); Cs.push(Math.hypot(a, b)); Hs.push((Math.atan2(b, a) * 180 / Math.PI + 360) % 360); }
    if (Ls.length > 200) r[gn] = { px: Ls.length, L50: q(Ls, 0.5), L90: q(Ls, 0.9), C50: q(Cs, 0.5), hue50: q(Hs, 0.5) }; }
  res[sn] = r; }
return res;
