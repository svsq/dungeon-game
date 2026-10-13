// live/scene.js — the dungeon, drawn. Pure function of t and the sim state.
// Pipeline per frame: baked floor map (floor, wall faces, wall tops, rims, AO; rebaked per floor) → ground decals (stairs, spikes,
// stains, cracks) → Y-sorted band (props, monsters, the rigged hero, loot) → unlit composite; then a light map (ambient per
// biome + flickering torches, braziers, lava, spells, the hero's aura) multiplied in with the fog of war (explored cells) →
// emissive pass (flames, lava, fireballs, slashes, sparks) → bloom + grade → HUD (hud.js).
(function () {
  const SC = (window.SCENE = {}), L = LIB, M = L.M, D = DATA, W = SIM.VIEW.W, H = SIM.VIEW.H, TILE = D.TILE;
  const SZ = (n) => window.SIZES[n] || [G.tex(n).w, G.tex(n).h], PIX = 2;
  const TRAP_HOLE = [0.29, 0.67];            // hole centres across trap_plate (same on both axes), measured from the art
  // a sheaf per hole: two short side spikes behind a tall one [dx, w, h]; the tall one barely tops the row step, so the
  // back row's sheaf doesn't merge with the front's into a bar
  const TRAP_SPIKE = [[-5, 9, 19], [5, 9, 19], [0, 12, 27]];
  const FLAME = `
uniform float u_seed, u_amt; uniform vec3 u_col;
void main(){ vec2 q = v_uv * 2.0 - 1.0; q.y = -q.y;                    // y up, base at q.y = -1
  float t = u_t * 2.2 + u_seed * 13.0, h = (q.y + 1.0) * 0.5;
  float n = fbm(vec2(q.x * 3.0 + u_seed, q.y * 2.4 - t * 2.4));
  float w = mix(0.62, 0.05, pow(h, 0.9)) * (0.75 + 0.5 * n);
  float x = q.x + (n - 0.5) * 0.5 * h + sin(t * 1.7 + q.y * 3.0) * 0.08 * h;
  float body = smoothstep(w, w * 0.35, abs(x)) * smoothstep(1.0, 0.55, h + (n - 0.5) * 0.4) * smoothstep(-0.02, 0.12, h);
  float core = smoothstep(w * 0.55, 0.0, abs(x)) * smoothstep(0.65, 0.1, h);
  vec3 c = mix(u_col * vec3(1.0, 0.55, 0.35), u_col, body); c = mix(c, vec3(1.0, 0.95, 0.75), core * 0.85);
  float a = body * u_amt; o = vec4(c * a * 1.5, 0.0); }`;
  // a slash crescent: angles a0..a1 around the centre at radius r (uv of the quad), fading toward the trailing end
  const ARC = `
uniform vec4 u_arc; uniform vec3 u_col; uniform float u_amt;              // a0, a1, thickness (fraction of r), squash y
void main(){ vec2 q = v_uv * 2.0 - 1.0; q.y /= u_arc.w; float r = length(q), a = atan(q.y, q.x);
  float a0 = u_arc.x, a1 = u_arc.y, span = a1 - a0, u = (a - a0) / span;
  for (int k = -1; k <= 1; k++) { float aa = a + float(k) * 6.2831853; float uu = (aa - a0) / span; if (uu >= 0.0 && uu <= 1.0) { u = uu; break; } }
  if (u < 0.0 || u > 1.0) discard;
  float th = u_arc.z * (0.25 + 0.75 * u), band = smoothstep(th, 0.0, abs(r - 0.82 + th * 0.4));
  float a2 = band * pow(u, 1.6) * u_amt; vec3 c = mix(u_col, vec3(1.0), smoothstep(0.6, 1.0, u) * band);
  o = vec4(c * a2, a2 * 0.5); }`;
  const LIT = `
uniform sampler2D u_src, u_light, u_seen; uniform vec2 u_cam, u_map;
void main(){ vec3 c = texture(u_src, scr(v_px)).rgb, l = texture(u_light, scr(v_px)).rgb;
  vec2 w = (v_px + u_cam) / u_map; float s = texture(u_seen, w).r;
  l = 2.6 * tanh(l / 2.6);                                              // soft cap: pools never flatten into one blown-out level
  o = vec4(c * l * s, 1.0); }`;
  const PORTAL = `
uniform float u_amt;
void main(){ vec2 q = v_uv * 2.0 - 1.0; float r = length(q), a = atan(q.y, q.x);
  float sw = fbm(vec2(a * 2.0 + r * 4.0 - u_t * 2.0, r * 3.0 - u_t)), ring = smoothstep(0.95, 0.7, r) * smoothstep(0.2, 0.7, r + sw * 0.3);
  vec3 c = mix(vec3(0.3, 0.5, 1.0), vec3(0.9, 0.95, 1.0), sw * smoothstep(0.8, 0.2, r)); float al = ring * u_amt; o = vec4(c * al, 0.0); }`;
  SC.REPEAT = [];
  let LT = null, BAKE = { key: '', tg: null }, SEEN = { key: '', rec: null, cv: null };
  SC.programs = () => {
    // the world renders on a 2×2 view-px grid (the reference's art pixel), every sprite and rotated rig part re-rasterised on it;
    // light, glows and the HUD stay full resolution (HD pixel, styles.md §1)
    L.init(W, H, { flame: FLAME, arc: ARC, lit: LIT, portal: PORTAL }, { pixel: PIX });
    L.glyphs('0123456789+-/:%', { size: 60, fill: ['#fffbe2', '#ffd76a', '#e89a22'] });
    LT = { light: G.target(W / 2, H / 2, true, { view: [W, H] }), lit: G.target(W, H, true) };
    if (window.HUD) HUD.init();
  };
  const rnd = L.rnd, SS = L.SS;
  // the safe zone is the start room plus one cell (SIM's inStart): its edge is visible only where floor crosses it
  const SANCT = { key: null, edges: [] };
  const sanctEdges = (m) => { const key = m.seed + ':' + m.floor; if (SANCT.key === key) return SANCT.edges; SANCT.key = key; const out = SANCT.edges = [];
    const r = m.rooms[m.start], inZ = (x, y) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h, T = TILE;
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) { if (SIM.cell(m, x, y) !== 1) continue;
      if (!inZ(x + 1, y) && SIM.cell(m, x + 1, y) === 1) out.push([(x + 1) * T - 2, y * T, 4, T]); if (!inZ(x - 1, y) && SIM.cell(m, x - 1, y) === 1) out.push([x * T - 2, y * T, 4, T]);
      if (!inZ(x, y + 1) && SIM.cell(m, x, y + 1) === 1) out.push([x * T, (y + 1) * T - 2, T, 4]); if (!inZ(x, y - 1) && SIM.cell(m, x, y - 1) === 1) out.push([x * T, y * T - 2, T, 4]); }
    // one sill per doorway: merge edge cells that continue each other
    for (let i = 0; i < out.length; i++) for (let j = out.length - 1; j > i; j--) { const a = out[i], b = out[j], v = a[2] < a[3];
      if (v === (b[2] < b[3]) && (v ? a[0] === b[0] && (a[1] + a[3] === b[1] || b[1] + b[3] === a[1]) : a[1] === b[1] && (a[0] + a[2] === b[0] || b[0] + b[2] === a[0]))) {
        if (v) { a[1] = Math.min(a[1], b[1]); a[3] += b[3]; } else { a[0] = Math.min(a[0], b[0]); a[2] += b[2]; } out.splice(j, 1); j = out.length; } }
    return out; };
  const zoneAt = (m, x, y) => { for (const r of m.rooms) if (r.zone && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.zone; return m.biome; };
  const torchCol = (m, tc) => D.BIOMES[(tc.r !== undefined && m.rooms[tc.r] && m.rooms[tc.r].zone) || m.biome].torch;

  // ---------------- the floor map, baked once per floor into a world-size texture ----------------
  function bake(m) {
    const key = m.seed + ':' + m.floor + ':' + (m.secrets || []).map((q) => (q.open ? 'o' : q.hp)).join(''); if (BAKE.key === key) return; BAKE.key = key;
    const MW = m.W * TILE, MH = m.H * TILE, B = D.BIOMES[m.biome];
    if (!BAKE.tg || BAKE.tg.w !== MW || BAKE.tg.h !== MH) {
      BAKE.tg = G.target(MW, MH, false);
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const rec = G.canvasTex('map', cv); rec.t = BAKE.tg.t; rec.w = MW; rec.h = MH; }
    G.bind(BAKE.tg, [0, 0, 0, 1]); G.blend();
    const hid = SIM.secretMask(m), c = (x, y) => { const v = SIM.cell(m, x, y); return v === 4 || hid.has(y * m.W + x) ? 0 : v; }, TS = 288, TSW = 224;   // repeat periods must be whole tiles, or a cell straddles the texture edge and smears it              // texture repeat = 256 world px (1024 src px)
    const near = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (c(x + i, y + j) === 1 || c(x + i, y + j) === 3) return true; return false; };
    const tile = (tex, x, y, u, ts = TS) => { const u0 = ((x * TILE) % ts) / ts, v0 = ((y * TILE) % ts) / ts; L.sprite(tex, x * TILE, y * TILE, { w: TILE, h: TILE, src: [u0, v0, u0 + TILE / ts, v0 + TILE / ts], u }); };
    const dark = (x, y, w, h, a) => L.solid(x, y, w, h, [0.01, 0.01, 0.015], 0, 0, 0, a);
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const v = c(x, y);
      if (v === 1) { const Z = D.BIOMES[zoneAt(m, x, y)]; tile(Z.floor, x, y, { grade: [1, 0.96, 0, 1], tint: [Z.tint[0], Z.tint[1], Z.tint[2], 1] }); }
      else if (v === 0 && (c(x, y + 1) !== 0 || (c(x, y + 2) !== 0 && c(x, y + 2) !== undefined))) tile(B.wall, x, y, { grade: [0.9, 1.05, 0, 1.05], tint: [B.tint[0], B.tint[1], B.tint[2], 1] }, TSW);
      else if (v === 0 && near(x, y, 7)) tile(B.top, x, y, { grade: [0.9, 1.0, 0, 1.1], tint: [B.tint[0] * 0.95, B.tint[1] * 0.97, B.tint[2], 1] }, 160);
    }
    // contact darkening, rims, edges
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const v = c(x, y), X = x * TILE, Y = y * TILE;
      if (v === 1) {
        // contact shadow at the wall's foot as a soft ramp (hard-edged bands read as stray stripes)
        if (c(x, y - 1) === 0) for (let k = 0; k < 6; k++) dark(X, Y, TILE, 14 - k * 2.2, 0.09);
        if (c(x - 1, y) === 0) for (let k = 0; k < 4; k++) dark(X, Y, 8 - k * 1.8, TILE, 0.08);
        if (c(x + 1, y) === 0) for (let k = 0; k < 4; k++) dark(X + TILE - 8 + k * 1.8, Y, 8 - k * 1.8, TILE, 0.08);
        if (c(x, y + 1) === 0) for (let k = 0; k < 3; k++) dark(X, Y + TILE - 6 + k * 2, TILE, 6 - k * 2, 0.08);
      } else if (v === 0) {
        // walls stand two cells tall (the reference's 3/4 faces): the lower face sits on the floor, the upper one carries the lip
        const face = c(x, y + 1) !== 0, face2 = !face && c(x, y + 2) !== 0;
        if (face) { dark(X, Y + TILE - 4, TILE, 4, 0.5); for (let k = 0; k < 4; k++) dark(X, Y + TILE - 14 + k * 2.5, TILE, 14 - k * 2.5, 0.06);
          if (c(x - 1, y) === 1 || c(x - 1, y + 1) === 1) dark(X, Y, 3, TILE, 0.7); if (c(x + 1, y) === 1 || c(x + 1, y + 1) === 1) dark(X + TILE - 3, Y, 3, TILE, 0.7); }
        if (face2) { dark(X, Y, TILE, 3, 0.75); L.solid(X, Y + 3, TILE, 1, [0.5, 0.45, 0.42], 0, 0, 0, 0.35);
          if (c(x - 1, y + 1) === 1) dark(X, Y, 3, TILE, 0.7); if (c(x + 1, y + 1) === 1) dark(X + TILE - 3, Y, 3, TILE, 0.7); }
        if (!face && !face2 && near(x, y, 4)) {
          if (c(x, y + 1) === 1) dark(X, Y + TILE - 3, TILE, 3, 0.6);
          if (c(x - 1, y) === 1) dark(X, Y, 3, TILE, 0.6);
          if (c(x + 1, y) === 1) dark(X + TILE - 3, Y, 3, TILE, 0.6);
        }
      } else if (v === 3) for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (c(x + dx, y + dy) === 1)
        L.solid(X + (dx > 0 ? TILE - 4 : 0), Y + (dy > 0 ? TILE - 4 : 0), dx ? 4 : TILE, dy ? 4 : TILE, [0.12, 0.06, 0.04], 0, 0, 0, 1);
    }
    // large-scale variation without a grid: soft overlapping blobs (never per-cell steps, which read as dashed stripes)
    for (let i = 0; i < m.W * m.H / 18; i++) { const x = rnd(i, 7.7) * m.W, y = rnd(i, 8.8) * m.H; if (c(Math.floor(x), Math.floor(y)) !== 1) continue;
      L.puff(x * TILE, y * TILE, 60 + 70 * rnd(i, 9.9), [0.02, 0.015, 0.015], 0.10 + 0.1 * rnd(i, 6.6), i + 0.5); }
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (c(x, y) === 0 && near(x, y, 7) && !near(x, y, 1)) L.puff(x * TILE + 16, y * TILE + 16, 36, [0, 0, 0], near(x, y, 2) ? 0.12 : near(x, y, 3) ? 0.28 : near(x, y, 4) ? 0.42 : near(x, y, 5) ? 0.55 : 0.68, x * 3 + y);
    for (const g of m.rugs || []) if (window.ASSETS.carpet) { const w = g.h * ASSETS.carpet.w / ASSETS.carpet.h; L.puff(g.cx, g.y + g.h / 2 + 4, g.h * 0.55, [0, 0, 0], 0.3, 1); L.sprite('carpet', g.cx - w / 2, g.y, { w, h: g.h }); }
    // painted floor decals: cracks, grime, moss, blood, coins, bones, webs…
    for (const d of m.decals || []) { if (SIM.hidden(m, d)) continue; const [w0, h0] = SZ(d.n), k = 40 * d.s / Math.max(w0, h0); L.sprite(d.n, d.x - w0 * k / 2, d.y - h0 * k / 2, { w: w0 * k, h: h0 * k, flip: !!d.f, u: { alpha: d.n === 'dc_web' ? 0.7 : 0.92 } }); }
    // stains and scorch marks scattered on the floor
    for (let i = 0; i < m.W * m.H / 40; i++) { const x = Math.floor(rnd(i, m.seed % 97) * m.W), y = Math.floor(rnd(i + 0.5, m.seed % 89) * m.H);
      if (c(x, y) !== 1) continue; const r = 8 + 14 * rnd(i, 3);
      L.puff(x * TILE + 16, y * TILE + 16, r, rnd(i, 4) < 0.35 ? [0.22, 0.03, 0.02] : [0.04, 0.03, 0.03], 0.35 + 0.25 * rnd(i, 5), i); }
    // secret rooms' fake walls: a crack from the opening's edge into the wall (up the face of a top wall, across the rock of the
    // other sides) that branches wider after a blow
    (m.secrets || []).forEach((q, i) => { if (q.open) return; const hurt = q.hp < 2, a0 = Math.atan2(q.dy, q.dx), ux = Math.cos(a0), uy = Math.sin(a0);
      const crack = (x0, y0, a1, len, w, seed, depth) => { let x = x0, y = y0, a = a1;
        for (let k = 0; k < len; k++) { const l = 6 + 4 * rnd(seed, k); a += (rnd(seed, k + 9) - 0.5) * 0.9; const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
          L.solid(x, y, l + 1, w, [0.02, 0.015, 0.02], a, 0, w / 2, 0.92); L.solid(x, y + w / 2 + 1, l, 2, [0.7, 0.64, 0.6], a, 0, 0, q.dy < 0 ? 0.35 : 0.6);
          if (depth && rnd(seed, k + 30) < (hurt ? 0.55 : 0.3)) crack(nx, ny, a + (rnd(seed, k + 40) < 0.5 ? -0.9 : 0.9), 2 + Math.floor(rnd(seed, k + 50) * 2), Math.max(1, w - 1), seed * 7 + k, depth - 1);
          x = nx; y = ny; } };
      const bx = q.x + ux * 3 - 4 * uy, by = q.y + uy * 3;
      crack(bx, by, a0 - 0.15, 5, hurt ? 5 : 4, 11 + i, hurt ? 2 : 1);
      if (hurt) { const hx = bx + ux * 24, hy = by + uy * 24; crack(hx, hy, a0 - 1.4, 3, 3, 21 + i, 1); crack(hx, hy, a0 + 1.4, 3, 3, 31 + i, 1); L.solid(hx - 7, hy - 5, 14, 10, [0.03, 0.02, 0.03], a0, 7, 5, 0.9); } });
    // wall decor: banners hang on the wall faces
    for (const d of m.decor) if (d.wall && !SIM.hidden(m, d)) { const n = d.n || 'banner', [w, h] = SZ(n); L.sprite(n, d.x - w / 2, d.y - h + 8, { w, h }); }
    G.bind(null);
  }
  function seenTex(R) {
    const m = R.map; let n = 0; for (let i = 0; i < R.seen.length; i += 7) n += R.seen[i];
    const key = m.seed + ':' + m.floor + ':' + n + ':' + R.rseen.join('');
    if (SEEN.key === key) return SEEN.rec; SEEN.key = key;
    if (!SEEN.cv) { SEEN.cv = document.createElement('canvas'); }
    const cv = SEEN.cv; cv.width = m.W; cv.height = m.H; const g = cv.getContext('2d'), im = g.createImageData(m.W, m.H);
    for (let i = 0; i < m.W * m.H; i++) { const v = R.seen[i] ? 255 : 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    if (!SEEN.rec) SEEN.rec = G.canvasTex('seen', cv);
    else { const gl = G.gl; gl.bindTexture(gl.TEXTURE_2D, SEEN.rec.t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D); }
    return SEEN.rec;
  }

  // ---------------- the hero: cut-out rig (partrig.py) with planted foot paths, IK knees, swinging arms, a held weapon ----------------
  const WEAPON = { sword: ['it_sword', 46], longsword: ['it_longsword', 53], axe: ['it_axe', 48], hammer: ['it_hammer', 51], staff: ['it_staff', 58], fist: null };
  const HERO_H = 84, STEP = SIM.K.STEP || 22;
  function heroPose(h, GT, st) {
    const RG = RIGS.hero, s = HERO_H / RG.h, sp = Math.hypot(h.vx, h.vy), run = SS(10, 150, sp) * (h.deadT >= 0 ? 1 - SS(0, 0.15, GT - h.deadT) : 1);
    const dirx = sp > 1 ? h.vx / sp : 0, diry = sp > 1 ? h.vy / sp : 0;
    const p = h.gp || 0, u0 = ((p / (2 * Math.PI)) % 1 + 1) % 1, sl = SIM.stepLen(Math.abs(dirx));
    return { RG, s, run, dirx: dirx * h.face, diry, p, u0, sl };
  }
  // the melee swing in rig angles: a short pull back, an ease-in strike that crosses the aim on the sim's damage frame (K.HIT),
  // a follow-through that bleeds the speed off, then a recovery that keeps turning the same way so the blade never sweeps back
  // through the target. It starts from the end of the arc nearer the rest pose (an aim straight up is an uppercut), which keeps
  // the wind-up short in every direction.
  const SWING = { pull: 0.09, follow: 0.09, end: 0.5, back: 0.35, over: 0.5 }, TAU = Math.PI * 2;
  const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
  function swingPose(T, saRaw, arc, rest, from) {
    const sa = Math.PI / 2 + wrapPi(saRaw - Math.PI / 2), lo = sa - arc / 2, hi = sa + arc / 2;
    const dir = Math.abs(wrapPi(lo - rest)) <= Math.abs(wrapPi(hi - rest)) ? 1 : -1, start = dir > 0 ? lo : hi, end = dir > 0 ? hi : lo;
    const a0 = start - dir * SWING.back, th = arc + SWING.back, Ta = SWING.pull;
    const Ts = Ta + (SIM.K.HIT - Ta) / Math.pow((arc / 2 + SWING.back) / th, 1 / 1.5), vEnd = 1.5 * th / (Ts - Ta), Tf = Ts + SWING.follow;
    const follow = (x) => end + dir * SWING.over * (1 - Math.exp(-x * vEnd / SWING.over));   // leaves the strike at its speed, settles SWING.over past the arc
    let blade, k = 1, bend, fs = 1;
    if (T < Ta) { const q = SS(0, Ta, T), b0 = from ? from.blade : rest, k0 = from ? from.k : 0; k = k0 + (1 - k0) * q; blade = b0 + wrapPi(a0 - b0) * q; bend = 1.1; }
    else if (T < Ts) { const e = Math.pow((T - Ta) / (Ts - Ta), 1.5); blade = a0 + dir * th * e; bend = 1.1 - 0.95 * e; }
    else if (T < Tf) { blade = follow(T - Ts); bend = 0.15 + 0.15 * SS(Ts, Tf, T); }
    else { const bf = follow(Tf - Ts), q = SS(Tf, SWING.end, T), fwd = ((dir * (rest - bf)) % TAU + TAU) % TAU, d = fwd < Math.PI * 0.75 ? dir * fwd : wrapPi(rest - bf);
      blade = bf + d * q; k = 1 - q; bend = 0.3; fs = 1 - 0.5 * Math.sin(Math.PI * q); }   // the blade turns flat toward the camera on the way back: no second swing
    return { blade, k, bend, fs, start, Ts, Tf, arm: T < Tf ? blade : follow(Tf - Ts) };   // arm: the arm follows the blade until the recovery, then lowers from the end pose
  }
  SC.swingPose = swingPose; SC.SWING = SWING;
  function drawHero(h, hx, hy, GT, st, o = {}) {
    const P = heroPose(h, GT, st), { RG, s, run } = P, face = h.face, gx = RG.gap, gy = RG.footL[1];
    const atkT = GT - h.atkT, swinging = atkT >= 0 && atkT < SWING.end, casting = GT - h.castT < 0.3 && h.castK !== 'whirl', whirlU = (GT - h.whirlT) / 0.32;
    const hurt = GT - h.hurtT < 0.12, alpha = o.alpha === undefined ? 1 : o.alpha;
    // body: hip rides the stance leg (low at double support), slow breath at rest
    const dbl = 0.5 + 0.5 * Math.cos(4 * Math.PI * P.u0), breath = (1 - run) * Math.sin(GT * 2.1) * 0.9;
    const bodyDy = run * (2.6 - 0.9 * Math.abs(P.dirx)) * dbl + breath * 0.5;
    // dash and hurt lean the upper body about the hip (the feet stay planted): eased in and out, never a one-frame switch
    const dA = GT - h.dashT, dashE = SS(0, 0.09, dA) * (1 - SS(0.14, 0.3, dA)), dashF = h.dashX * face >= -0.2 ? 1 : -1;
    const hA = GT - h.hurtT, hurtE = h.deadT >= 0 ? 0 : SS(0, 0.07, hA) * (1 - SS(0.12, 0.3, hA));
    const bodyR = 0.25 * dashE * (Math.abs(h.dashX) > 0.3 ? Math.sign(h.dashX) : 0) + 0.15 * hurtE * (h.hurtX || 0);
    // death keeps the rig: the knees buckle (the hip drops, IK folds them), the arms fling, then the whole body falls back about the feet,
    // accelerating but slowed just before the floor so it lands with a small bounce instead of a board's slap
    const du = h.deadT >= 0 ? GT - h.deadT : -1, buckle = du >= 0 ? SS(0, 0.15, du) : 0, fq = Math.min(1, Math.max(0, (du - 0.12) / 0.35));
    const fallR = du < 0 ? 0 : -face * (0.1 * buckle + 1.32 * (2.4 * fq * fq - 1.4 * fq * fq * fq) - (du > 0.47 ? 0.03 * Math.sin(Math.PI * Math.min(1, (du - 0.47) / 0.16)) : 0));
    const fc = Math.cos(fallR), fs = Math.sin(fallR);
    const root = [hx, hy], R2S = (px, py, dy = 0) => { const x = face * (px - gx) * s, y = (py - gy) * s + dy; return [root[0] + x * fc - y * fs, root[1] + x * fs + y * fc]; };
    const dk = du >= 0 ? 1 - 0.25 * SS(0.4, 1.2, du) : 1, U = { alpha, grade: hurt ? [0.4, 2.4, 0, 1] : [dk, dk, 0, 1] }, Ufar = { alpha, grade: hurt ? [0.4, 2.4, 0, 1] : [0.85 * dk, 0.72 * dk, 0, 1] };
    const part = (n, pivotRig, at, rot, u = U, k = 1, up = 0) => L.sprite('hero__' + n, 0, 0, { m: M.of(M.t(at[0], at[1]), M.r(fallR + up), M.s(face, 1), M.r(rot), M.s(1, k)), w: RG.w * s, h: RG.h * s, pivot: [pivotRig[0] * s, pivotRig[1] * s], u });
    const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
    const dist2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const id = o.id || 'hero';
    // ---- legs: foot targets in rig px: rest ankle + travel × sweep in stance, eased forward with a lift in the swing ----
    const legs = {}, tg = {};
    for (const side of ['L', 'R']) {
      const A0 = RG['ankle' + side], u = ((P.u0 + (side === 'L' ? 0 : 0.5)) % 1), A = P.sl / 2 / s * run;   // half a step in rig px: stance slides back at body speed
      let off, lift = 0;
      if (u < 0.5) off = A * (1 - 4 * u); else { const w = (u - 0.5) * 2, e = SS(0.12, 0.95, w); off = -A + 2 * A * e; lift = Math.pow(Math.sin(Math.PI * w), 0.6) * (13 + 2 * Math.abs(P.dirx)) * run; }
      tg[side] = { tx: A0[0] + off * P.dirx + (side === 'L' ? -9 : 9) * (1 - run * 0.6), ty: A0[1] - lift, lift, dz: off * P.diry - 0.5 * A * Math.abs(P.diry) };
    }
    // the dash pose: the near leg reaches toward the dash, the far one trails with its knee bent (the gait does not run while dashing)
    if (dashE > 0) { tg.R.tx += 12 * dashE * dashF; tg.L.tx -= 16 * dashE * dashF; tg.L.ty -= 12 * dashE; tg.L.lift = Math.max(tg.L.lift, 12 * dashE); }
    // the hip rides the legs: it drops as far as the farther-reaching foot needs to stay on its target
    let drop = 0;
    for (const side of ['L', 'R']) { const H0 = RG['hip' + side], K0 = RG['knee' + side], A0 = RG['ankle' + side], Lm = 0.955 * (dist2(H0, K0) + dist2(K0, A0)), dx = tg[side].tx - H0[0];
      drop = Math.max(drop, tg[side].ty - H0[1] - Math.sqrt(Math.max(0, Lm * Lm - dx * dx))); }
    const hipDy = Math.max(bodyDy / s, drop) + 48 * buckle + 10 * dashE + 8 * hurtE;
    const Hc = [(RG.hipL[0] + RG.hipR[0]) / 2, RG.hipL[1]], hipS = R2S(Hc[0], Hc[1], hipDy * s), bc = Math.cos(bodyR), bs = Math.sin(bodyR);
    const R2U = (px, py, dy = 0) => { const p = R2S(px, py, dy), x = p[0] - hipS[0], y = p[1] - hipS[1]; return [hipS[0] + x * bc - y * bs, hipS[1] + x * bs + y * bc]; };
    for (const side of ['L', 'R']) {
      const H0 = RG['hip' + side], K0 = RG['knee' + side], A0 = RG['ankle' + side], { tx, ty, lift } = tg[side];
      const Hp = [H0[0], H0[1] + hipDy];
      const l1 = dist2(H0, K0), l2 = dist2(K0, A0); let dx = tx - Hp[0], dy = ty - Hp[1], d = Math.hypot(dx, dy);
      const dm = Math.min(d, l1 + l2 - 0.5); const base = Math.atan2(dy, dx), cosA = (l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm);
      // seen from the front or back, most of the knee's fold points at the camera: a smaller sideways bend, a foreshortened shin
      const fold = 1, alphaK = Math.acos(Math.max(-1, Math.min(1, cosA))), ka = base - alphaK * fold;
      const K1 = [Hp[0] + Math.cos(ka) * l1, Hp[1] + Math.sin(ka) * l1], T1 = [K1[0] + Math.cos(Math.atan2(ty - K1[1], tx - K1[0])) * l2, K1[1] + Math.sin(Math.atan2(ty - K1[1], tx - K1[0])) * l2];
      // a step toward or away from the camera tilts the leg in depth: it projects longer or shorter, the stance foot stays planted
      // in world space. The range is biased back (−1.5..+0.5 half-steps) since a leg projects at most ~1.12× its standing length.
      const f = (T1[1] - Hp[1] + tg[side].dz) / (T1[1] - Hp[1]), Y = (p) => [p[0], Hp[1] + (p[1] - Hp[1]) * f], K = Y(K1), T = Y(T1);
      legs[side] = { H0, K0, A0, Hp, K, T, r1: ang(K, Hp) - ang(K0, H0), r2: ang(T, K) - ang(A0, K0), k1: dist2(Hp, K) / l1, k2: dist2(K, T) / l2, lift };
    }
    // ---- arms: swing against the legs; the near (R) arm carries the weapon through the strike ----
    const aimL = face > 0 ? h.aim : Math.PI - h.aim;                       // aim in rig space (mirrored for left)
    const W = WEAPON[st.wtype];
    let bladeA = null, armR = null;
    if (whirlU >= 0 && whirlU < 1) { bladeA = aimL + whirlU * Math.PI * 2; }
    let swingK = 0, bend = 0, bladeFs = 1, armA = 0;
    // the swing aims along shoulder → target (chest height at 0.8 reach), not along the raw aim from the feet, so the blade crosses
    // the body it hits even when the arm is raised for an uppercut
    const swAim = (a) => { const sh = R2U(RG.shR[0], RG.shR[1] + hipDy), tx = hx + Math.cos(a) * st.reach * 0.8, ty = hy + Math.sin(a) * st.reach * 0.8 - 34, g = Math.atan2(ty - sh[1], tx - sh[0]);
      return face > 0 ? g : Math.PI - g; };
    if (!(whirlU >= 0 && whirlU < 1) && swinging) { const arcR = st.arc * Math.PI / 180, pT = GT - (h.patkT === undefined ? -9 : h.patkT);
      const prev = pT < SWING.end && h.patkT < h.atkT ? swingPose(pT, swAim(h.patkA), arcR, -0.95) : null;
      const sw = swingPose(atkT, swAim(h.atkA), arcR, -0.95, prev);
      bladeA = sw.blade; armA = sw.arm; swingK = sw.k; bend = sw.bend; bladeFs = sw.fs; }
    const shoulderDy = hipDy;
    const armPose = (side, swingA) => {
      const S0 = RG['sh' + side], E0 = RG['elbow' + side], Hd0 = RG['hand' + side];
      const Sp = [S0[0], S0[1] + shoulderDy];
      let r1 = swingA, r2 = swingA * 0.6 + 0.18;
      return { S0, E0, Hd0, Sp, r1, r2 };
    };
    const legSwing = Math.sin(P.p) * 0.42 * run;
    const arms = { L: armPose('L', -legSwing * 0.8 + breath * 0.02), R: armPose('R', legSwing * 0.8 - breath * 0.02) };
    if (swingK > 0) {
      armR = arms.R; const w = wrapPi(armA - Math.PI / 2), r1 = w - 0.15 * Math.sin(w);   // ≈0.85·w near rest, yet periodic: no spin at ±π
      armR.r2 = armR.r2 + wrapPi(r1 + bend - armR.r2) * swingK; armR.r1 = armR.r1 + wrapPi(r1 - armR.r1) * swingK;
    } else if (bladeA !== null || casting) {
      const want = bladeA !== null ? bladeA : aimL, rest = Math.PI / 2;      // rest arm hangs straight down
      const k = bladeA !== null ? 1 : SS(0, 0.06, GT - h.castT) * (1 - SS(0.2, 0.3, GT - h.castT));
      armR = arms.R; armR.r1 = (want - rest) * 0.85 * k + armR.r1 * (1 - k); armR.r2 = armR.r1 + 0.12;
    }
    const pose = (A, dr1, bend, k) => { A.r1 += dr1 * k; A.r2 += (A.r1 + bend - A.r2) * k; };   // blended by the effect's strength: no elbow snap at its start
    if (dashE > 0) { pose(arms.L, 0.55 * dashF, 0.45, dashE); pose(arms.R, 0.55 * dashF, 0.45, dashE); }
    if (hurtE > 0 && swingK === 0) { pose(arms.L, -0.45, 0.5, hurtE); pose(arms.R, -0.3, 0.45, hurtE); }
    if (buckle > 0) { const f = SS(0, 0.2, du); arms.L.r1 -= 0.9 * f; arms.L.r2 = arms.L.r1 + 0.35; arms.R.r1 -= 1.1 * f; arms.R.r2 = arms.R.r1 + 0.3; }
    // positions of the near arm's joints in rig px (for the weapon and the trace)
    const rotP = (p, c, a) => { const dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; };
    const armJ = (A) => { const E = rotP([A.E0[0], A.E0[1] + shoulderDy], A.Sp, A.r1), Hd = rotP(rotP([A.Hd0[0], A.Hd0[1] + shoulderDy], A.Sp, A.r1), E, A.r2 - A.r1); return { E, Hd }; };
    const jL = armJ(arms.L), jR = armJ(arms.R);
    // ---- draw: far arm → far leg → near leg → body → near arm + weapon (weapon behind the body when it points away) ----
    const drawLeg = (side, u) => { const g = legs[side];
      part('thigh' + side, g.H0, R2S(g.Hp[0], g.Hp[1]), g.r1, u, g.k1); part('shin' + side, g.K0, R2S(g.K[0], g.K[1]), g.r2, u, g.k2); part('foot' + side, g.A0, R2S(g.T[0], g.T[1]), -g.lift * 0.02, u); };
    const drawArm = (side, u) => { const A = arms[side], J = side === 'L' ? jL : jR;
      part('uarm' + side, A.S0, R2U(A.Sp[0], A.Sp[1]), A.r1, u, 1, bodyR); part('farm' + side, A.E0, R2U(J.E[0], J.E[1]), A.r2, u, 1, bodyR); };
    const weapon = () => { if (!W) return; const [tex, len] = W, Hd = R2U(jR.Hd[0], jR.Hd[1]), ba = bladeA !== null ? bladeA : -0.95 + arms.R.r1 * 0.5;
      const sa = (face > 0 ? ba : Math.PI - ba) + fallR + bodyR;                       // screen angle of the blade
      const tw = len, th = len * G.tex(tex).h / G.tex(tex).w;
      L.sprite(tex, 0, 0, { m: M.of(M.t(Hd[0], Hd[1]), M.r(sa), M.s(bladeFs, 1), M.r(Math.PI / 4)), w: tw, h: th, pivot: [tw * 0.22, th * 0.78], u: U });
      const tip = [Hd[0] + Math.cos(sa) * len * 0.78 * bladeFs, Hd[1] + Math.sin(sa) * len * 0.78 * bladeFs];
      L.joint(id, 'grip', Hd); L.joint(id, 'tip', tip); };
    // from behind the resting blade points away from the camera, so it sits behind the body unless it swings down
    const backK = h.back ? SS(0, 0.08, GT - (h.backT ?? -9)) : 1 - SS(0, 0.08, GT - (h.backT ?? -9));
    const behind = bladeA !== null ? Math.sin(face > 0 ? bladeA : Math.PI - bladeA) < -0.35 : backK > 0.5;
    const all = () => {
      drawArm('L', Ufar); drawLeg('L', Ufar); drawLeg('R', U);
      if (behind) { weapon(); drawArm('R', U); }
      const bodyAt = { m: M.of(M.t(...hipS), M.r(fallR + bodyR), M.s(face, 1)), w: RG.w * s, h: RG.h * s, pivot: [Hc[0] * s, Hc[1] * s] };
      if (backK < 1) L.sprite('hero__body', 0, 0, Object.assign({ u: U }, bodyAt));
      if (backK > 0 && window.ASSETS.hero__body_back) L.sprite('hero__body_back', 0, 0, Object.assign({ u: Object.assign({}, U, { alpha: alpha * backK }) }, bodyAt));
      if (!behind) { drawArm('R', U); weapon(); }
    };
    all();
    // joint trace (animation.md §14)
    const J = (n, p) => L.joint(id, n, p);
    if (h.qaTgt) { const tx = hx + h.qaTgt[0] - h.x, ty = hy + h.qaTgt[1] - h.y; J('target', [tx, ty - 34]); J('targetLo', [tx, ty]); J('targetHi', [tx, ty - 68]); }
    J('ground', root); J('head', R2U(RG.head[0], RG.head[1], hipDy * s)); J('top', R2U(RG.top[0], RG.top[1], hipDy * s)); J('hip', R2S((RG.hipL[0] + RG.hipR[0]) / 2, RG.hipL[1], hipDy * s));
    for (const side of ['L', 'R']) { const g = legs[side]; J('hip' + side, R2S(g.Hp[0], g.Hp[1])); J('knee' + side, R2S(g.K[0], g.K[1])); J('ankle' + side, R2S(g.T[0], g.T[1]));
      const dT = [g.T[0] - g.A0[0], g.T[1] - g.A0[1]]; J('heel' + side, R2S(RG['heel' + side][0] + dT[0], RG['heel' + side][1] + dT[1])); J('toe' + side, R2S(RG['toe' + side][0] + dT[0], RG['toe' + side][1] + dT[1])); J('ground' + side, [root[0], root[1] + tg[side].dz * s]);
      const A = arms[side], j2 = side === 'L' ? jL : jR; J('sh' + side, R2U(A.Sp[0], A.Sp[1])); J('elbow' + side, R2U(j2.E[0], j2.E[1])); J('hand' + side, R2U(j2.Hd[0], j2.Hd[1])); }
  }
  SC.drawHero = drawHero;

  // ---------------- monsters (whole sprites for now; rigs land in the next pass) ----------------
  const ELITE = [1.0, 0.32, 0.12], ELITE_HALO = [1.0, 0.36, 0.1];
  const EN_TEX = { skeleton: 'en_skeleton', goblin: 'en_goblin', spider: 'en_spider', cultist: 'en_cultist', ghost: 'en_ghost', brute: 'en_brute', boss: 'en_brute' };
  function drawEnemy(e, x, y, GT, t) {
    const E = D.ENEMIES[e.type], tex = EN_TEX[e.type], [w0, h0] = SZ(tex), k = e.type === 'boss' ? 1.6 : e.elite ? 1.3 : 1, w = w0 * k, h = h0 * k;
    const dead = e.deadT >= 0 ? GT - e.deadT : -1, hit = GT - e.hitT < 0.1, ew = E.wind * (e.elite ? 0.85 : 1), wind = e.st === 'wind' ? SS(0, ew, GT - e.t0) : e.st === 'bwind' ? SS(0, ew, GT - e.t0) * (1 - SS(ew, ew + 0.15, GT - e.t0)) : 0;
    const sp = Math.hypot(e.vx, e.vy), ph = e.dist / 20 * Math.PI, step = SS(5, 40, sp) * Math.abs(Math.sin(ph));
    const flt = E.ghost ? 6 + 3 * Math.sin(t * 2.3 + e.id) : 0;
    let sx = 1, sy = 1, lean = 0;
    if (dead < 0) { sy = 1 - 0.05 * step + 0.03 * Math.sin(t * 2 + e.id); sx = 1 / Math.sqrt(sy); 
      // lean back through the wind-up, swing forward over 0.1 s on the strike, settle back to upright before the strike ends: no one-frame pops
      // melee bodies swing forward through the impact (centred on it), others on the strike's first frames
      const sd = E.kind === 'lunge' ? 0.45 : 0.32, u = GT - e.t0, mel = E.kind === 'melee', c = mel ? 0.1 : 0;
      lean = (e.st === 'strike' ? (-0.08 + 0.2 * SS(-c, 0.1, u)) * (1 - SS(sd - 0.15, sd, u)) : e.st === 'wind' ? -0.08 * wind + (mel ? 0.2 * SS(ew - 0.1, ew + 0.1, u) : 0) : -0.08 * wind) * e.face; }
    const alpha = dead < 0 ? (E.ghost ? 0.82 : 1) : E.ghost ? 0.82 * (1 - SS(0.1, 0.9, dead)) : 1 - SS(4.5, 6, dead);
    const grade = hit ? [0.3, 2.6, 0, 1] : e.burn > GT ? [1.1, 1.15, 0, 1] : wind > 0.5 && Math.sin(GT * 40) > 0 ? [1, 1.5, 0, 1] : [1, 1, 0, 1];
    L.shadow(x, y + 2, w * 0.32, 7, 0.45 * alpha);
    // a body topples (accelerating, slowed just before the floor), bounces once and lies for seconds before it fades; a ghost dissolves upward
    if (dead >= 0) { if (E.ghost) { if (dead < 0.9) L.sprite(tex, 0, 0, { m: M.of(M.t(x, y - flt - 40 * SS(0, 0.9, dead)), M.s(e.face * (1 - 0.2 * dead), 1 + 0.3 * dead)), w, h, pivot: [w / 2, h], u: { alpha, grade: [1.3, 1.3, 0, 1] } }); return; }
      if (dead > 6) return; const q = Math.min(1, dead / 0.35), fall = 2.6 * q * q - 1.6 * q * q * q - (dead > 0.35 ? 0.025 * Math.sin(Math.PI * Math.min(1, (dead - 0.35) / 0.16)) : 0), dk = 0.7 + 0.3 * (1 - SS(0.2, 1, dead));
      const ca = fall * 1.3 * e.face, cs = 1 - 0.3 * SS(0, 0.35, dead), CJ = (n, d) => L.joint('en' + e.id, n, [x + Math.sin(ca) * d * cs, y - Math.cos(ca) * d * cs]);
      L.joint('en' + e.id, 'ground', [x, y]); CJ('mid', h / 2); CJ('top', h);
      const corpse = () => L.sprite(tex, 0, 0, { m: M.of(M.t(x, y), M.r(ca), M.s(e.face, cs)), w, h, pivot: [w / 2, h], u: { alpha, grade: [dk, dk * 0.9, 0, 1] } });
      if (MONSTERS.rigOf(e.type)) { const dk2 = [dk, dk * 0.9, 0, 1];
        L.inked(() => MONSTERS.draw(e, E, x, y, GT, { id: 'en' + e.id, H: h, face: e.face, lean: 0, fallR: ca, U: { alpha, grade: dk2 }, Ufar: { alpha, grade: [dk * 0.85, dk * 0.72, 0, 1] }, t }), { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 }); return; }
      L.inked(corpse, { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 }); return; }
    // turning about narrows the body to a sliver and opens it the other way over 0.16 s instead of mirroring in one frame
    const tA = GT - (e.ft ?? -9), tc = tA < 0.16 ? -Math.cos(Math.PI * SS(0, 0.16, tA)) : 1, tw = Math.sign(tc || 1) * Math.max(0.12, Math.abs(tc));
    if (tw < 1) L.pre = M.of(M.t(x, y), M.s(tw, 1), M.t(-x, -y));
    try { drawLive(); } finally { L.pre = null; }
    // an elite's aura: its own silhouette, blurred and glowing, breathing and flickering behind the body
    function halo(draw) { if (!e.elite || e.type === 'boss') return; const pu = 0.5 + 0.5 * Math.sin(t * 2.6 + e.id);
      for (const [R0, n, a0] of [[11, 12, 0.1], [7, 10, 0.16], [3.5, 8, 0.28]]) for (let i = 0; i < n; i++) { const an = i * 2 * Math.PI / n + t * 0.8, r = R0 * (1 + 0.35 * pu) + 1.2 * Math.sin(t * 7 + i * 2.1);
        L.sp = { dx: Math.cos(an) * r, dy: Math.sin(an) * r * 1.2 - 2 - 2 * pu, a: a0 * (0.75 + 0.25 * pu), lod: 0.8, ink: ELITE_HALO }; draw(); }
      L.sp = null; }
    function drawLive() {
    if (MONSTERS.rigOf(e.type)) { const hA = GT - e.hitT, fl = hA >= 0 ? SS(0, 0.05, hA) * (1 - SS(0.1, 0.3, hA)) : 0;   // a hit flinches the upper body away from the hero
      const Ur = { alpha, grade }, Uf = { alpha, grade: hit ? grade : [grade[0] * 0.85, grade[1] * 0.72, 0, 1] };
      const rig = () => MONSTERS.draw(e, E, x, y, GT, { id: 'en' + e.id, H: h, face: e.face, lean: lean - 0.14 * fl * e.face, crouch: 6 * fl, fallR: 0, U: Ur, Ufar: Uf, t });
      halo(rig); L.inked(rig, { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 }); return; }
    const J = (n, d) => L.joint('en' + e.id, n, [x + Math.sin(lean) * d * sy, y - flt - Math.cos(lean) * d * sy]);
    L.joint('en' + e.id, 'ground', [x, y]); J('mid', h / 2); J('top', h);
    // the ghost bends its one painting (soft bones): the tail trails its motion on a slow wave, the near claw reaches through the wind-up
    let bones = {};
    if (E.ghost && window.ASSETS.en_ghost_w) { const sp = Math.hypot(e.vx, e.vy), [tw, th] = [G.tex('en_ghost_w').w, G.tex('en_ghost_w').h];
      const tail = 0.12 * Math.sin(t * 2.2 + e.id) + 0.05 * Math.sin(t * 3.7 + e.id * 2) + 0.3 * SS(0, 60, sp), reach = -0.7 * wind + 0.06 * Math.sin(t * 1.9 + e.id);
      bones = { wtex: G.tex('en_ghost_w'), wsz: [tw, th], bone0: [190 / 361, 198 / 409, tail, 1], bone1: [266 / 361, 148 / 409, reach, 1] }; }
    const body = () => L.sprite(tex, 0, 0, { m: M.of(M.t(x, y - flt), M.r(lean), M.s(sx * e.face, sy)), w, h, pivot: [w / 2, h], u: Object.assign({ alpha, grade }, bones) });
    halo(body); if (E.ghost) body(); else L.inked(body, { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 });
    }
  }

  // ---------------- props ----------------
  const PROP_H = { pot: 'pot', barrel: 'barrel', crate: 'crate', gold: 'treasure' };
  function drawProp(n, x, y, o = {}) { const [w, h] = SZ(n), k = o.k || 1, j = o.j;
    if (!j) { L.sprite(n, x - w * k / 2, y - h * k + (o.dy || 0), { w: w * k, h: h * k, u: o.u }); return; }
    const W = w * k, H = h * k * j.sy, u = j.fl > 0 ? Object.assign({}, o.u, { tint: [2.2, 2, 1.8, j.fl] }) : o.u;
    L.sprite(n, 0, 0, { m: M.of(M.t(x + j.dx, y + (o.dy || 0)), M.r(j.rot)), w: W, h: H, pivot: [W / 2, H], u }); }
  // a knocked prop's recoil about its foot, away from the blow (s): wood rocks, metal rattles, stone shudders, crystal rings, sacks slump
  const KNOCK = {
    wood: (a, s) => ({ rot: s * 0.1 * Math.exp(-5 * a) * Math.sin(20 * a), dx: 0, sy: 1 - 0.03 * Math.exp(-8 * a) * Math.sin(20 * a) }),
    metal: (a, s) => ({ rot: s * 0.05 * Math.exp(-3.5 * a) * Math.sin(34 * a), dx: s * 1.5 * Math.exp(-10 * a) * Math.sin(60 * a), sy: 1 }),
    stone: (a, s) => ({ rot: s * 0.015 * Math.exp(-8 * a) * Math.sin(40 * a), dx: s * 2.5 * Math.exp(-12 * a) * Math.sin(70 * a), sy: 1 }),
    crystal: (a, s) => ({ rot: s * 0.03 * Math.exp(-4 * a) * Math.sin(26 * a), dx: 0, sy: 1 + 0.04 * Math.exp(-6 * a) * Math.sin(30 * a) }),
    cloth: (a, s) => ({ rot: s * 0.04 * Math.exp(-6 * a) * Math.sin(16 * a), dx: 0, sy: 1 - 0.1 * Math.exp(-6 * a) * Math.sin(16 * a) }) };
  const knockOf = (e, T) => { const a = T - e.t; if (a < 0 || a >= 1.5) return null; const j = KNOCK[e.mat](a, e.s); j.fl = 0.6 * (1 - SS(0.03, 0.12, a)); return j; };

  // ---------------- render ----------------
  SC.render = (t) => {
    const ST = SC.state || SIM.at(t), GT = ST.t, R = ST.run;
    if (!R) { L.beginBG([0.02, 0.015, 0.02, 1]); L.beginComp(); L.finish(t, { bloom: [0, 0] }); if (window.HUD) HUD.draw(ST, t, null); return; }
    const m = R.map, B = D.BIOMES[m.biome], h = R.hero, st = SIM.stats(h, ST.meta);
    bake(m); const seen = seenTex(R);
    const tr = R.trauma * R.trauma, shx = 16 * tr * (L.rnd(Math.floor(GT * 30), 1) - 0.5) * 2, shy = 12 * tr * (L.rnd(Math.floor(GT * 30), 2) - 0.5) * 2;
    const cx = Math.round((R.cam[0] + shx) / PIX) * PIX, cy = Math.round((R.cam[1] + shy) / PIX) * PIX, sx = (x) => x - cx, sy = (y) => y - cy;
    const vis = (x, y, pad = 120) => x > cx - pad && x < cx + W + pad && y > cy - pad && y < cy + H + pad * 1.5;
    const MW = m.W * TILE, MH = m.H * TILE;
    const known = (x, y) => R.seen[Math.floor(y / TILE) * m.W + Math.floor(x / TILE)] || R.seen[Math.floor((y + 40) / TILE) * m.W + Math.floor(x / TILE)];
    const hid = (o) => SIM.hidden(m, o);

    // ===== ground: the baked map, then decals =====
    L.beginBG([0, 0, 0, 1]);
    // only the part of the view that lies on the map (sampling past its edge smears the edge texels into stripes)
    { const x0 = Math.max(0, cx), y0 = Math.max(0, cy), x1 = Math.min(MW, cx + W), y1 = Math.min(MH, cy + H);
      if (x1 > x0 && y1 > y0) L.sprite('map', x0 - cx, y0 - cy, { w: x1 - x0, h: y1 - y0, src: [x0 / MW, 1 - y0 / MH, x1 / MW, 1 - y1 / MH] }); }
    L.beginComp();
    // lava (animated, also emissive later): the crust drifts
    const lavaCells = [];
    if (m.lava) for (let y = Math.floor(cy / TILE) - 1; y <= Math.floor((cy + H) / TILE) + 1; y++) for (let x = Math.floor(cx / TILE) - 1; x <= Math.floor((cx + W) / TILE) + 1; x++) if (SIM.cell(m, x, y) === 3) lavaCells.push([x, y]);
    // lava is ground (anyone can stand in it now, so it draws under them); its own short strong lights keep it glowing after lighting
    for (const [x, y] of lavaCells) { const u0 = ((x * TILE + t * 3) % 256) / 256, v0 = ((y * TILE + t * 2) % 256) / 256;
      L.sprite('lava_tex', sx(x * TILE), sy(y * TILE), { w: TILE, h: TILE, src: [u0, v0, u0 + TILE / 256, v0 + TILE / 256], u: { grade: [1.1, 0.95 + 0.12 * Math.sin(t * 1.3 + x * 0.7 + y), 0, 1.05] } }); }
    // stairs / boss portal
    if (vis(m.exit.x, m.exit.y)) { if (m.floor < D.FLOORS) { const [w, hh] = SZ('stairs'); L.sprite('stairs', sx(m.exit.x) - w / 2, sy(m.exit.y) - hh / 2 - 4, { w, h: hh }); } }
    // sanctuary: the bonfire's rune circle, and an inlaid threshold wherever the floor leaves the safe zone (its doorways)
    if (window.ASSETS.sanct_circle && vis(m.sanct.x, m.sanct.y)) { const d = 3.4 * TILE; L.sprite('sanct_circle', sx(m.sanct.x) - d / 2, sy(m.sanct.y - 6) - d / 2, { w: d, h: d }); }
    if (window.ASSETS.sanct_sill) for (const [X, Y, w, hh] of sanctEdges(m)) if (vis(X, Y)) { const v = w < hh, [aw, ah] = SZ('sanct_sill'), sw = Math.max(w, hh) + 4, sh = ah;
      L.sprite('sanct_sill', 0, 0, { m: M.of(M.t(sx(X + w / 2), sy(Y + hh / 2)), M.r(v ? Math.PI / 2 : 0)), w: sw, h: sh, pivot: [sw / 2, 6] }); }
    // spike traps: a 2×2-cell plate on the ground; its spikes stand in the Y-sorted band (they have height)
    for (const tp of m.traps) if (vis(tp.x, tp.y)) L.sprite('trap_plate', sx(tp.x - TILE), sy(tp.y - TILE), { w: 2 * TILE, h: 2 * TILE });
    // flat decor (bones) and blood / scorch decals from events
    for (const d of m.decor) if (!d.wall && d.n === 'bones' && vis(d.x, d.y) && !hid(d)) drawProp('bones', sx(d.x), sy(d.y), { dy: 6 });
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      if (e.k === 'kill' && a < 12) L.puff(sx(e.x), sy(e.y) + 2, 18 + 8 * SS(0, 0.3, a), [0.25, 0.02, 0.02], 0.6 * (1 - SS(6, 12, a)), e.id);
      if (e.k === 'slam' && a < 4.6) L.cracks(sx(e.x), sy(e.y), e.big ? 130 : 70, a, e.id || 1, 0);
      if (e.k === 'boom' && a < 6) L.puff(sx(e.x), sy(e.y) + 24, 30, [0.03, 0.02, 0.02], 0.5 * (1 - SS(3, 6, a)), e.t * 7);
      if (e.k === 'die') L.puff(sx(e.x) + 6, sy(e.y) + 4, 12 + 30 * SS(0.1, 1.4, a), [0.28, 0.02, 0.02], 0.75, 41); }

    // the draught at each fake wall (its crack is baked into the map): pale motes blown out of the opening into the room
    (m.secrets || []).forEach((q, i) => { if (q.open || !vis(q.x, q.y)) return; const X = sx(q.x), Yf = sy(q.y), ux = q.dx, uy = q.dy;
      for (let j = 0; j < 9; j++) { const ph = (t * 0.3 + rnd(i, j)) % 1, sp = (rnd(i, j + 5) - 0.5) * 36 * (0.4 + ph) + Math.sin(t * 1.6 + j * 2) * 5;
        L.solid(X - ux * (ph * 46 - 4) - uy * sp, Yf - uy * (ph * 46 - 4) + ux * sp + (q.dy ? 0 : ph * ph * 14), 3, 3, [0.82, 0.86, 0.95], 0, 0, 0, 0.8 * Math.sin(ph * Math.PI)); } });

    // ===== Y-sorted band =====
    const Y = [], knocked = {}; for (const e of ST.ev) if (e.k === 'prop') knocked[e.i] = e;
    const jig = (id) => knocked[id] && knockOf(knocked[id], GT);
    m.decor.forEach((d, i) => { if (!d.wall && d.n !== 'bones' && vis(d.x, d.y) && !hid(d)) Y.push([d.y, () => drawProp(d.n, sx(d.x), sy(d.y), { dy: 4, j: jig('d' + i) })]); });
    for (const c of R.chests) if (vis(c.x, c.y) && !hid(c)) Y.push([c.y, () => { const op = c.open ? SS(0, 0.18, GT - (c.openT || -9)) : 0; L.shadow(sx(c.x), sy(c.y) + 2, 22, 6, 0.5);
      drawProp(op > 0.5 ? 'chest_open' : 'chest', sx(c.x), sy(c.y), { dy: 4, k: c.tier >= 2 ? 1.15 : 1, u: { grade: c.tier === 3 ? [1.2, 1.12, 0, 1.1] : c.tier === 2 ? [1.15, 1.08, 0, 1.05] : [1, 1, 0, 1] } }); }]);
    for (const p of R.pots) { if (!vis(p.x, p.y) || hid(p)) continue; if (p.hp > 0) Y.push([p.y, () => { L.shadow(sx(p.x), sy(p.y) + 2, 14, 5, 0.45); drawProp(PROP_H[p.kind], sx(p.x), sy(p.y), { dy: 4 }); }]); }
    const flameB = (x, y, w, hh, col, seed) => { G.blend('add'); G.draw(L.P.flame, { u_t: t, u_seed: seed, u_amt: 1.6, u_col: col }, G.xf(x - w / 2, y - hh, w, hh)); G.blend(); };
    m.torches.forEach((tc, i) => { if (!vis(tc.x, tc.y) || hid(tc)) return; const col = torchCol(m, tc), lit = known(tc.x, tc.y);
      if (tc.kind === 'wall') Y.push([tc.y - 20, () => { drawProp('torch_sconce', sx(tc.x), sy(tc.y) + 16); if (lit) flameB(sx(tc.x) + 3, sy(tc.y) - 4, 22, 36, col, i); }]);
      else { const big = tc.kind === 'fire', j = jig('t' + i), up = big ? 44 : 32, fl = j ? 1 + 0.5 * Math.exp(-4 * (GT - knocked['t' + i].t)) : 1;
        Y.push([tc.y, () => { L.shadow(sx(tc.x), sy(tc.y) + 2, big ? 30 : 18, 6, 0.5); drawProp('brazier', sx(tc.x), sy(tc.y), { k: big ? 1.35 : 1, dy: 4, j });
          if (lit) flameB(sx(tc.x) + (j ? j.dx + Math.sin(j.rot) * up : 0), sy(tc.y) - up, (big ? 56 : 34) * fl, (big ? 80 : 50) * fl, col, i); }]); } });
    for (const d of m.decor) if (d.n === 'candles' && vis(d.x, d.y) && known(d.x, d.y) && !hid(d)) Y.push([d.y + 1, () => { for (let k = 0; k < 3; k++) flameB(sx(d.x) + [-8, 0, 9][k], sy(d.y) - [16, 28, 18][k], 9, 15, [1, 0.7, 0.35], d.x + k); }]);
    // the shop: the merchant behind his counter (it hides his legs), the scales and his coins on top of it
    const sh = m.shop;
    if (sh && vis(sh.x, sh.y)) { const ds = Math.hypot(h.x - sh.x, h.y - sh.y), near = 1 - SS(140, 300, ds), look = Math.max(-1, Math.min(1, (h.x - sh.x) / 120));
      Y.push([sh.y, () => { L.shadow(sx(sh.x), sy(sh.y) + 2, 26, 6, 0.4);
        L.inked(() => MONSTERS.merchant({ id: 'merchant', x: sx(sh.x), y: sy(sh.y), H: SZ('merchant')[1], t: GT, look, near, greetT: R.shop.greetT, tradeT: R.shop.tradeT, seed: m.seed % 7, U: {} }), { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 }); }]);
      Y.push([sh.counter.y, () => { const c = sh.counter, [cw] = SZ('shop_counter'); L.shadow(sx(c.x), sy(c.y) + 2, cw * 0.5, 7, 0.5); drawProp('shop_counter', sx(c.x), sy(c.y), { dy: 4 });
        drawProp('shop_scales', sx(c.x) - 26, sy(c.y) - 24); drawProp('shop_gems', sx(c.x) + 28, sy(c.y) - 24); }]); }
    for (const s of R.shrines) if (vis(s.x, s.y)) Y.push([s.y, () => { L.shadow(sx(s.x), sy(s.y) + 2, 26, 7, 0.5); drawProp('altar', sx(s.x), sy(s.y), { dy: 6, u: { grade: s.used ? [0.5, 0.7, 0, 1] : [1, 1, 0, 1] } }); }]);
    // each spike slides out of its hole (only the part above the lip shows): tips peek and rattle just before the strike,
    // then the sheaves shoot up for the up phase the sim hurts in
    for (const tp of m.traps) { if (!vis(tp.x, tp.y)) continue; const ph = ((GT / 2.4 + tp.ph) % 1 + 1) % 1;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const q = ph - j * 0.01, up = q < 0.29 && q > 0 ? SS(0, 0.025, q) * (1 - SS(0.25, 0.29, q)) : 0, k = Math.max(up, 0.3 * SS(0.82, 0.86, ph));
        if (k < 0.02) continue; const bx = tp.x - TILE + TRAP_HOLE[i] * 2 * TILE, by = tp.y - TILE + (TRAP_HOLE[j] + 0.07) * 2 * TILE, jit = up < 0.5 && ph > 0.82 ? Math.sin(GT * 70 + i * 2 + j) * 0.7 : 0;
        Y.push([by, () => { for (const [dx, sw, sh] of TRAP_SPIKE) L.sprite('trap_spike', sx(bx + dx) - sw / 2 + jit, sy(by) - k * sh, { w: sw, h: k * sh, src: [0, 0, 1, k] }); }]); } }
    for (const e of R.en) if (vis(e.x, e.y)) Y.push([e.y, () => drawEnemy(e, sx(e.x), sy(e.y), GT, t)]);
    for (const p of R.drops) if (vis(p.x, p.y)) Y.push([p.y, () => drawDrop(p, sx(p.x), sy(p.y), GT, t)]);
    Y.push([h.y + (GT - h.atkT >= 0 && GT - h.atkT < 0.2 ? 90 : 0), () => {   // during the strike the blade must read over the target it hits
      L.shadow(sx(h.x), sy(h.y) + 2, 20, 6, 0.5);
      if (GT - h.dashT < 0.3) for (let k = 3; k >= 1; k--) { const a = GT - h.dashT; drawHero(h, sx(h.x - h.dashX * k * 22 * SS(0, 0.16, a)), sy(h.y - h.dashY * k * 22 * SS(0, 0.16, a)), GT, st, { alpha: 0.18 * (1 - a / 0.3), id: 'ghost' + k }); }
      drawHero(h, sx(h.x), sy(h.y), GT, st);
    }]);
    Y.sort((a, b) => a[0] - b[0]).forEach(([, d]) => d());

    // ===== light map =====
    const ab = 0.5 / Math.max(...B.amb), AMB = [0.40, 0.44, 0.58]; G.bind(LT.light, [0.7 * AMB[0] + 0.3 * B.amb[0] * ab, 0.7 * AMB[1] + 0.3 * B.amb[1] * ab, 0.7 * AMB[2] + 0.3 * B.amb[2] * ab, 1]); G.blend('add');
    const lt = (x, y, r, col, amt, k = 2.2) => { if (x < cx - r || x > cx + W + r || y < cy - r || y > cy + H + r) return; G.draw(L.P.glow, { u_col: col, u_k: k, u_amt: amt }, G.xf(sx(x) - r, sy(y) - r * 0.8, 2 * r, 1.6 * r)); };
    const flick = (i) => 0.85 + 0.1 * Math.sin(t * 9.1 + i * 3.7) + 0.06 * Math.sin(t * 23.3 + i * 1.3);
    lt(h.x, h.y - 30, 170, [0.8, 0.72, 0.6], 0.18);
    m.torches.forEach((tc, i) => { if (hid(tc)) return; const f = flick(i), big = tc.kind === 'fire', col = torchCol(m, tc); lt(tc.x, tc.y - (tc.kind === 'wall' ? -10 : 20), big ? 280 : 220, col, (big ? 1.0 : 0.75) * f, 2.6); lt(tc.x, tc.y - 10, 110, col.map((v) => 0.5 + 0.5 * v), 0.5 * f, 3); });
    for (const d of m.decor) if (d.n === 'crystal' && !hid(d)) lt(d.x, d.y - 30, 220, [0.35, 0.6, 1.0], 0.9 * flick(d.x));
    for (const d of m.decor) if (d.n === 'candles' && !hid(d)) lt(d.x, d.y - 10, 120, [1, 0.7, 0.35], 0.6 * flick(d.y));
    // the shop is lit warm and bright: lanterns by its ways in, a lamp over the counter
    if (m.shop) { for (const q of m.shop.lanterns) lt(q.x, q.y - 40, 190, [1, 0.78, 0.45], 0.85 * flick(q.x)); lt(m.shop.x, m.shop.y - 50, 260, [1, 0.82, 0.55], 0.75); }
    for (const [x, y] of lavaCells) { if ((x + y) % 2 === 0) lt(x * TILE + 16, y * TILE + 16, 140, [1.0, 0.42, 0.12], 0.55 * flick(x * 3 + y)); lt(x * TILE + 16, y * TILE + 16, 24, [1.0, 0.75, 0.55], 1.2, 1.6); }
    for (const s of R.shrines) if (!s.used) lt(s.x, s.y - 20, 200, [0.4, 0.7, 1.0], 0.9);
    if (m.floor === D.FLOORS && R.bossDead) lt(m.exit.x, m.exit.y - 20, 320, [0.5, 0.7, 1.0], 1.4);
    for (const p of R.proj) lt(p.x, p.y + 20, p.own === 'hero' ? 240 : 150, p.k === 'hex' ? [0.4, 1.0, 0.4] : [1.0, 0.55, 0.2], 1.2);
    for (const p of R.pots) if (p.kind === 'gold' && p.hp > 0 && !hid(p)) lt(p.x, p.y - 10, 110, [1, 0.78, 0.4], 0.35);
    for (const p of R.drops) if (p.kind === 'item' && p.item.rar >= 2) lt(p.x, p.y - 10, 90, D.RARITY[p.item.rar].col, 0.5);
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      if (e.k === 'prop' && e.mat === 'crystal' && a < 0.7) lt(e.x, e.y - 30, 260, [0.4, 0.65, 1.0], 1.4 * (1 - a / 0.7));
      if (e.k === 'prop' && e.n === 'brazier' && a < 0.6) lt(e.x, e.y - 30, 240, [1.0, 0.6, 0.25], 0.9 * (1 - a / 0.6));
      if (e.k === 'boom' && a < 0.5) lt(e.x, e.y, 360, [1.0, 0.6, 0.25], 2.2 * (1 - a / 0.5));
      if (e.k === 'whirl' && a < 0.35) lt(e.x, e.y - 20, 240, [1, 0.9, 0.7], 1.0 * (1 - a / 0.35));
      if (e.k === 'lvl' && a < 1.5) lt(e.x, e.y - 30, 300, [1, 0.85, 0.4], 1.5 * (1 - a / 1.5));
      if (e.k === 'swing' && a < 0.12) lt(h.x + Math.cos(e.a) * 30, h.y - 30 + Math.sin(e.a) * 20, 120, [1, 0.9, 0.75], 0.4);
      if (e.k === 'pop' && a < 0.3) lt(e.x, e.y + 20, e.hero ? 200 : 120, e.c === 'hex' ? [0.4, 1, 0.4] : [1, 0.55, 0.2], (e.hero ? 1.4 : 0.8) * (1 - a / 0.3));
      if (e.k === 'teleport' && a < 0.9) { const q = 1 - a / 0.9; lt(e.x, e.y - 30, 260, [0.55, 0.75, 1], 1.6 * q); lt(e.fx ?? e.x, (e.fy ?? e.y) - 30, 220, [0.55, 0.75, 1], 1.2 * q); }
      if (e.k === 'floor' && a < 1.6) lt(e.x, e.y - 20, 300, [1, 0.85, 0.55], 1.2 * (1 - a / 1.6));
      if (e.k === 'roar' && a < 0.8) lt(e.x, e.y + 40, 420, [1, 0.3, 0.12], 1.4 * (1 - a / 0.8));
      if (e.k === 'die' && a < 1.6) lt(e.x, e.y - 40 - 60 * SS(0.3, 1.6, a), 200, [0.5, 0.7, 1], 0.9 * SS(0.2, 0.5, a) * (1 - SS(1.2, 1.6, a)));
      if (e.k === 'spike' && a < 0.2) lt(e.x, e.y, 110, [1, 0.9, 0.75], 0.5 * (1 - a / 0.2)); }
    if (h.shield > 0 && GT < h.shieldUntil) lt(h.x, h.y - 30, 160, [0.4, 0.7, 1], 0.7);
    // a fake wall breathes a cold draught through its crack: a faint blue flicker at its foot, irregular so it reads as alive
    (m.secrets || []).forEach((q, i) => { if (q.open) return; const f = Math.max(0, Math.sin(t * 1.7 + i * 2.1) * 0.6 + Math.sin(t * 6.3 + i) * 0.25 + Math.sin(t * 13.1) * 0.15);
      lt(q.x + q.dx * 6, q.y + (q.dy < 0 ? -26 : q.dy > 0 ? 6 : -8), 90, [0.55, 0.72, 1], 0.18 + 0.32 * f, 2.6); });
    for (const c of R.chests) if (c.tier === 3 && !c.open && !hid(c)) lt(c.x, c.y - 14, 130, [1, 0.72, 0.35], 0.55 + 0.15 * Math.sin(t * 2.4));
    for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'secret' && a >= 0 && a < 1.2) lt(e.x, e.y, 340, [0.7, 0.8, 1], 1.4 * (1 - a / 1.2)); }
    for (const e of R.en) if (e.elite && e.type !== 'boss' && e.deadT < 0) lt(e.x, e.y + 4, 110, ELITE, 0.3 + 0.1 * Math.sin(t * 3 + e.id));
    G.blend();
    // ===== lit composite (fog of war: unexplored cells stay black) =====
    G.bind(LT.lit); G.blend('none'); G.full(L.P.lit, { u_src: L.T.comp, u_light: LT.light, u_seen: seen, u_cam: [cx, cy], u_map: [MW, MH] }); G.blend();

    // ===== emissive pass =====
    G.blend('add');
    const flame = (x, y, w, hh, col, amt, seed) => G.draw(L.P.flame, { u_t: t, u_seed: seed, u_amt: amt, u_col: col }, G.xf(x - w / 2, y - hh, w, hh));
    G.blend();
    G.blend('add');
    // shrine and portal
    for (const [X, Y, w, hh] of sanctEdges(m)) if (vis(X, Y) && known(X, Y)) { const c = [X + w / 2, Y + hh / 2]; L.glow(sx(c[0]), sy(c[1]), 22, [1.0, 0.72, 0.3], 0.22 + 0.08 * Math.sin(t * 2 + c[0] * 0.05)); }
    if (m.shop) for (const q of m.shop.lanterns) if (vis(q.x, q.y) && known(q.x, q.y)) { const [lw0, lh0] = SZ('shop_lantern'); L.glow(sx(q.x) + lw0 * 0.22, sy(q.y) - lh0 * 0.42, 16, [1, 0.8, 0.45], 0.7 * flick(q.y)); }
    for (const s of R.shrines) if (!s.used && vis(s.x, s.y) && known(s.x, s.y)) { L.glow(sx(s.x), sy(s.y) - 34, 30, [0.4, 0.7, 1.0], 0.5 + 0.2 * Math.sin(t * 3)); }
    if (m.floor === D.FLOORS && R.bossDead) G.draw(L.P.portal, { u_t: t, u_amt: 1 }, G.xf(sx(m.exit.x) - 46, sy(m.exit.y) - 80, 92, 92));
    // projectiles
    for (const p of R.proj) { if (!known(p.x, p.y)) continue; const x = sx(p.x), y = sy(p.y), col = p.k === 'hex' ? [0.45, 1.0, 0.4] : [1.0, 0.55, 0.18], a = Math.atan2(p.vy, p.vx);
      for (let k = 6; k >= 0; k--) { const f = k / 6; L.glow(x - Math.cos(a) * k * 7, y - Math.sin(a) * k * 7, (p.r + 4) * (1 - f * 0.6) * 1.6, col, 0.5 * (1 - f), 2.5); }
      L.glow(x, y, p.r * 2.2, [1, 0.95, 0.8], 0.9, 3); }
    // elites: a few embers drift up off the body, over the halo drawn behind it
    for (const e of R.en) { if (!e.elite || e.type === 'boss' || e.deadT >= 0 || !vis(e.x, e.y) || !known(e.x, e.y)) continue;
      const E = D.ENEMIES[e.type], x = sx(e.x), y = sy(e.y), hh = SZ(EN_TEX[e.type])[1] * 1.3;
      for (let j = 0; j < 4; j++) { const q = (t * 0.45 + rnd(e.id, j)) % 1, an = rnd(e.id, j + 7) * 6.28;
        L.star(x + Math.cos(an) * (E.r * 1.3 + 6) * (1 - 0.5 * q) + 6 * Math.sin(t * 2 + j), y - hh * (0.25 + 0.9 * q), 4 + 2 * (1 - q), ELITE, Math.sin(Math.PI * q) * 0.6); } }
    // event FX
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue; const ex = sx(e.x), ey = sy(e.y);
      if (e.k === 'swing' && a >= SWING.pull && a < SWING.end) { const f = e.f < 0 ? -1 : 1, scr = (b) => (f > 0 ? b : Math.PI - b);
        const pose = (T) => swingPose(T, f > 0 ? e.a : Math.PI - e.a, st.arc * Math.PI / 180, -0.95), sw = pose(a), lead = pose(Math.min(a, sw.Tf - 1e-4)), q = SS(sw.Ts, sw.Tf + 0.05, a);
        const Rr = st.reach + 30; if (q < 1) G.draw(L.P.arc, { u_arc: [scr(sw.start), scr(lead.blade), 0.34, 0.78], u_col: [1, 0.85, 0.6], u_amt: 1.6 * (1 - q * q) }, G.xf(ex - Rr, ey - 40 - Rr, 2 * Rr, 2 * Rr)); }
      if (e.k === 'whirl' && a < 0.4) { const q = a / 0.4; G.draw(L.P.arc, { u_arc: [0, 6.2831 * Math.min(1, a / 0.32), 0.26, 0.5], u_col: [1, 0.85, 0.6], u_amt: 1.5 * (1 - q) }, G.xf(ex - 118, ey - 34 - 118, 236, 236)); }
      if (e.k === 'eswing' && a < 0.2) G.draw(L.P.arc, { u_arc: [e.a - 0.9, e.a + 0.9 * Math.min(1, a / 0.12), 0.2, 0.75], u_col: [1, 0.5, 0.4], u_amt: 1 - a / 0.2 }, G.xf(ex - 50, ey - 26 - 50, 100, 100));
      if (e.k === 'hit' && a < 0.3) { const q = a / 0.3; for (let j = 0; j < (e.crit ? 9 : 5); j++) { const an = rnd(e.t, j) * 6.28, d = 8 + 34 * q * (0.5 + rnd(e.t, j + 9));
          L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d, e.crit ? 12 : 8, e.fire ? [1, 0.6, 0.2] : [1, 0.85, 0.6], 1 - q); } }
      if (e.k === 'scorch' && a < 0.4) { const q = a / 0.4; L.glow(ex, ey - 6, 34, [1, 0.5, 0.15], 0.9 * (1 - q), 2.4); L.ring(ex, ey, 10 + 22 * q, 6 + 10 * q, [1, 0.55, 0.2], 1 - q, 0.2); }
      if (e.k === 'boom' && a < 0.6) { const q = a / 0.6; L.glow(ex, ey, 80 + 50 * q, [1, 0.55, 0.15], 1.6 * (1 - q), 2.2); L.ring(ex, ey + 10, 30 + 70 * q, 18 + 40 * q, [1, 0.7, 0.3], 1 - q, 0.12);
        for (let j = 0; j < 10; j++) { const an = rnd(e.t, j) * 6.28, d = 20 + 90 * q * rnd(e.t, j + 3); L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d * 0.7 - 30 * q, 8, [1, 0.6, 0.2], 1 - q); } }
      if (e.k === 'cast' && a < 0.25) L.glow(ex, ey, 30, [1, 0.6, 0.2], 1 - a / 0.25, 3);
      if (e.k === 'eshoot' && a < 0.3) L.glow(ex, ey, 26, [0.4, 1, 0.4], 1 - a / 0.3, 3);
      if (e.k === 'slam' && a < 4.6) L.cracks(ex, ey, e.big ? 130 : 70, a, e.id || 1, 1);
      if (e.k === 'lvl' && a < 1.6) { const q = a / 1.6; L.ring(ex, ey, 30 + 80 * q, 14 + 36 * q, [1, 0.85, 0.4], 1 - q, 0.1); for (let j = 0; j < 14; j++) { const an = j / 14 * 6.28;
          L.star(ex + Math.cos(an) * (20 + 30 * q), ey - 20 - 90 * q * (0.5 + rnd(j, 2)), 9, [1, 0.85, 0.4], 1 - q); } }
      if ((e.k === 'pickup' || e.k === 'gold' || e.k === 'shard' || e.k === 'chest') && a < 0.5) { const q = a / 0.5, col = e.k === 'shard' ? [0.4, 0.7, 1] : e.k === 'pickup' ? D.RARITY[e.rar || 0].col : [1, 0.85, 0.3];
        for (let j = 0; j < 6; j++) { const an = j / 6 * 6.28 + e.t; L.star(ex + Math.cos(an) * 26 * q, ey - 10 + Math.sin(an) * 18 * q - 20 * q, 9, col, 1 - q); } }
      if (e.k === 'shield' && a < 0.4) L.ring(ex, ey - 30, 30 + 30 * (a / 0.4), 40 + 30 * (a / 0.4), [0.5, 0.8, 1], 1 - a / 0.4, 0.15);
      if (e.k === 'drink' && a < 0.6) for (let j = 0; j < 8; j++) { const q = a / 0.6, an = j / 8 * 6.28 + a * 6; L.star(ex + Math.cos(an) * 20, ey - 10 - 60 * q * (0.4 + rnd(j, 1)), 7, e.b === 'hp_potion' ? [1, 0.35, 0.35] : [0.4, 0.6, 1], 1 - q); }
      if (e.k === 'summon' && a < 0.6) { const q = a / 0.6; L.ring(ex, ey, 20 + 30 * q, 10 + 15 * q, [0.5, 1, 0.4], 1 - q, 0.2); L.glow(ex, ey - 20, 50, [0.4, 1, 0.3], 1 - q); }
      if (e.k === 'bless' && a < 1.2) { const q = a / 1.2; L.glow(ex, ey - 30, 90, [0.5, 0.8, 1], 1.4 * (1 - q)); L.ring(ex, ey, 40 + 90 * q, 20 + 45 * q, [0.6, 0.85, 1], 1 - q, 0.1); }
      // an enemy bolt bursts where it dies; on the hero it splashes wider with a ring
      if (e.k === 'pop' && a < (e.hero ? 0.4 : 0.25)) { const q = a / (e.hero ? 0.4 : 0.25), col = e.c === 'hex' ? [0.45, 1, 0.4] : [1, 0.55, 0.18];
        L.glow(ex, ey, (e.hero ? 46 : 26) * (1 + 0.5 * q), col, 1.3 * (1 - q), 2.4); if (e.hero) L.ring(ex, ey, 14 + 40 * q, 10 + 28 * q, col, 1 - q, 0.18);
        for (let j = 0; j < (e.hero ? 8 : 4); j++) { const an = rnd(e.t, j) * 6.28, d = 6 + (e.hero ? 40 : 22) * q; L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d * 0.8, 7, col, 1 - q); } }
      // a knocked prop: sparks off metal and stone, a brazier spits embers, crystal flares
      if (e.k === 'prop' && a < 0.9) { const [pw, ph] = SZ(e.n), ix = ex - e.s * pw * 0.3, iy = ey - ph * 0.45;
        if ((e.mat === 'metal' || e.mat === 'stone') && a < 0.3) { const q = a / 0.3; for (let j = 0; j < (e.mat === 'metal' ? 8 : 4); j++) { const an = Math.PI * (e.s > 0 ? 1 : 0) + (rnd(e.t, j) - 0.5) * 2.4, v = 90 + 120 * rnd(e.t, j + 5);
          L.star(ix + Math.cos(an) * v * a, iy + Math.sin(an) * v * a * 0.7 + 260 * a * a, 6, [1, 0.88, 0.6], 1 - q); } }
        if (e.n === 'brazier') for (let j = 0; j < 10; j++) { const q = a / 0.9, an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 1.6, v = 60 + 110 * rnd(e.t, j + 3);
          L.star(ex + Math.cos(an) * v * a, ey - ph * 0.9 + Math.sin(an) * v * a + 60 * a * a, 5, [1, 0.6, 0.2], (1 - q) * (0.6 + 0.4 * rnd(e.t, j + 9))); }
        if (e.mat === 'crystal' && a < 0.5) { const q = a / 0.5; L.glow(ix, iy, 40 + 30 * q, [0.5, 0.75, 1], 1.4 * (1 - q), 2.6); for (let j = 0; j < 6; j++) { const an = j / 6 * 6.28 + e.t;
          L.star(ix + Math.cos(an) * 30 * q, iy + Math.sin(an) * 22 * q, 8, [0.6, 0.85, 1], 1 - q); } } }
      // the plate fires: sparks off the steel tips
      if (e.k === 'spike' && a < 0.3) { const q = a / 0.3; for (let j = 0; j < 7; j++) { const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 2.2, v = 60 + 90 * rnd(e.t, j + 5);
        L.star(ex + Math.cos(an) * v * a * 1.6, ey - 18 + Math.sin(an) * v * a * 1.6 + 200 * a * a, 6, [1, 0.88, 0.6], 1 - q); } }
      // a scroll's light pillar where the hero vanished and where he lands
      if (e.k === 'teleport' && a < 0.9) { const q = a / 0.9;
        for (const [px, py, k] of [[ex, ey, 1], [sx(e.fx ?? e.x), sy(e.fy ?? e.y), 0.7]]) { const wd = 60 * (1 - 0.6 * q);
          G.draw(L.P.glow, { u_col: [0.55, 0.78, 1], u_k: 2.2, u_amt: 1.3 * k * (1 - q) }, G.xf(px - wd / 2, py - 220, wd, 240)); L.ring(px, py, 20 + 50 * q, 8 + 18 * q, [0.6, 0.85, 1], k * (1 - q), 0.15);
          for (let j = 0; j < 8; j++) { const an = j / 8 * 6.28 + a * 5; L.star(px + Math.cos(an) * 26 * (1 - q), py - 10 - 140 * q * (0.4 + rnd(j, 3)), 7, [0.7, 0.88, 1], k * (1 - q)); } } }
      if (e.k === 'floor' && a < 1.4) { const q = a / 1.4; L.ring(ex, ey, 30 + 120 * q, 14 + 56 * q, [1, 0.85, 0.5], 0.8 * (1 - q), 0.08);
        for (let j = 0; j < 10; j++) { const an = j / 10 * 6.28; L.star(ex + Math.cos(an) * (24 + 60 * q), ey - 20 + Math.sin(an) * (12 + 30 * q), 7, [1, 0.85, 0.5], 1 - q); } }
      // the boss's roar: shock rings off his maw and the floor around him
      if (e.k === 'roar' && a < 0.9) for (let j = 0; j < 3; j++) { const q = (a - j * 0.12) / 0.6; if (q < 0 || q > 1) continue;
        L.ring(ex, ey, 40 + 260 * q, 24 + 150 * q, [1, 0.4, 0.15], 0.9 * (1 - q), 0.06); if (j === 0) L.glow(ex, ey, 70, [1, 0.45, 0.2], 1.2 * (1 - q), 2.4); }
      if (e.k === 'die') { if (a < 0.4) L.glow(ex, ey - 40, 70, [1, 0.25, 0.15], 1.4 * (1 - a / 0.4), 2.4);
        const q = SS(0.3, 1.6, a); if (a > 0.25 && a < 1.6) { L.glow(ex, ey - 50 - 110 * q, 26, [0.55, 0.75, 1], 0.9 * (1 - SS(1.2, 1.6, a)), 2.6);
          for (let j = 0; j < 5; j++) L.star(ex + 10 * Math.sin(a * 4 + j * 1.3), ey - 50 - 110 * q + j * 14, 6 - j, [0.6, 0.8, 1], 0.7 * (1 - j / 5) * (1 - SS(1.2, 1.6, a))); } }
    }
    G.blend();
    // non-additive event FX (dust, debris, blood)
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue; const ex = sx(e.x), ey = sy(e.y);
      if (e.k === 'step' && a < 0.4) { const q = a / 0.4; L.puff(ex, ey - 2 - 6 * q, 5 + 8 * q, [0.35, 0.3, 0.27], 0.35 * (1 - q), e.t * 10); }
      if (e.k === 'dash' && a < 0.45) for (let j = 0; j < 5; j++) { const q = a / 0.45, s = rnd(e.t, j); L.puff(ex - e.dx * (10 + 60 * q * s), ey - e.dy * (10 + 60 * q * s) - 4, 7 + 12 * q, [0.35, 0.3, 0.27], 0.45 * (1 - q), e.t + j); }
      if (e.k === 'hit' && a < 0.45 && !e.fire) for (let j = 0; j < 5; j++) { const q = a / 0.45, an = rnd(e.t, j + 20) * 6.28, d = 6 + 30 * q;
        L.puff(ex + Math.cos(an) * d, ey + Math.sin(an) * d + 50 * q * q, 3 + 2 * rnd(e.t, j), [0.45, 0.04, 0.04], 0.9 * (1 - q), j); }
      if (e.k === 'break' && a < 0.7) for (let j = 0; j < 7; j++) { const q = a / 0.7, an = rnd(e.t, j) * 6.28, v = 40 + 60 * rnd(e.t, j + 7);
        L.solid(ex + Math.cos(an) * v * a, ey - 14 + Math.sin(an) * v * a * 0.6 - 120 * a + 300 * a * a, 5, 4, e.kind === 'pot' ? [0.5, 0.24, 0.14] : e.kind === 'gold' ? [1, 0.78, 0.25] : [0.4, 0.26, 0.14], an, 2, 2, 1 - SS(0.5, 0.7, a)); }
      // a blow on a fake wall knocks out chips and a breath of dust; the break blows the stretch of wall into the room
      if ((e.k === 'wallhit' || e.k === 'secret') && a < 1.4) { const big = e.k === 'secret', n = big ? 22 : 8, life = big ? 1.1 : 0.7;
        for (let j = 0; j < n; j++) { if (a > life) break; const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * (big ? 3 : 2), v = (big ? 90 : 50) + (big ? 160 : 70) * rnd(e.t, j + 7), g = 520;
          const px = ex + (rnd(e.t, j + 3) - 0.5) * (big ? 60 : 24) + Math.cos(an) * v * a * 0.6, py = ey + Math.min(30 + 20 * rnd(e.t, j + 11), -Math.abs(Math.sin(an)) * v * a + g * a * a);
          const sz = (big ? 4 : 3) + 4 * rnd(e.t, j + 13); L.solid(px, py, sz, sz * 0.8, [0.34, 0.3, 0.29], an + a * 6, sz / 2, sz / 2, 1 - SS(life * 0.75, life, a)); }
        for (let j = 0; j < (big ? 10 : 4); j++) { const q = Math.min(1, a / (big ? 1.4 : 0.8)); L.puff(ex + (j - (big ? 4.5 : 1.5)) * (big ? 12 : 10), ey + 10 + 26 * q, (big ? 16 : 10) + 22 * q, [0.4, 0.36, 0.34], (big ? 0.55 : 0.4) * (1 - q), e.t * 11 + j); } }
      // chips knocked off a prop fly from the struck side, bounce off the floor at its foot and fade; dust breathes out of it
      if (e.k === 'prop' && a < 0.9) { const [pw, ph] = SZ(e.n), ix = ex - e.s * pw * 0.3, iy = ey - ph * 0.45, mat = e.mat,
          col = mat === 'wood' ? [0.42, 0.27, 0.15] : mat === 'stone' ? [0.42, 0.4, 0.4] : mat === 'crystal' ? [0.55, 0.75, 1] : e.n === 'shop_gold' ? [1, 0.78, 0.25] : null;
        if (col) for (let j = 0; j < (mat === 'wood' ? 8 : 7); j++) { const an = Math.PI * (e.s > 0 ? 1 : 0) + (rnd(e.t, j) - 0.5) * 1.8, v = 50 + 70 * rnd(e.t, j + 7);
          const px = ix + Math.cos(an) * v * a, py = Math.min(ey + 4 - 6 * rnd(e.t, j + 2), iy + Math.sin(an) * v * a * 0.6 - 110 * a + 420 * a * a), long = mat === 'wood';
          L.solid(px, py, long ? 9 : 5, long ? 3 : 4, col, an + a * 9 * (rnd(e.t, j + 4) - 0.5), long ? 3.5 : 2, 1.5, 1 - SS(0.6, 0.9, a)); }
        if (mat !== 'metal' && a < 0.7) for (let j = 0; j < 3; j++) { const q = a / 0.7; L.puff(ix + (j - 1) * 9 - e.s * 14 * q, iy + 10 * q, 7 + 10 * q, [0.4, 0.36, 0.33], 0.35 * (1 - q), e.t * 7 + j); } }
      if (e.k === 'scorch' && a < 0.8) for (let j = 0; j < 3; j++) { const q = a / 0.8; L.puff(ex + (j - 1) * 7, ey - 8 - 26 * q, 6 + 8 * q, [0.12, 0.1, 0.1], 0.45 * (1 - q), e.t * 13 + j); }
      if (e.k === 'kill' && a < 0.6) for (let j = 0; j < 6; j++) { const q = a / 0.6; L.puff(ex + (j - 2.5) * 8, ey - 10 - 20 * q, 8 + 10 * q, e.type === 'ghost' ? [0.5, 0.7, 0.9] : [0.3, 0.27, 0.25], 0.5 * (1 - q), e.t + j); }
      if ((e.k === 'hurt' || e.k === 'die') && a < 0.45) for (let j = 0; j < (e.k === 'die' ? 9 : 5); j++) { const q = a / 0.45, an = rnd(e.t, j + 30) * 6.28, d = 6 + 30 * q, oy = e.k === 'die' ? -40 : 0;
        L.puff(ex + Math.cos(an) * d, ey + oy + Math.sin(an) * d + 50 * q * q, 3 + 2 * rnd(e.t, j), [0.5, 0.04, 0.04], 0.9 * (1 - q), j); }
      if (e.k === 'spike' && a < 0.5) for (let j = 0; j < 4; j++) { const q = a / 0.5; L.puff(ex + (j - 1.5) * 16, ey + 8 - 14 * q, 6 + 10 * q, [0.35, 0.3, 0.27], 0.4 * (1 - q), e.t * 9 + j); }
      if (e.k === 'roar' && a < 1.2) for (let j = 0; j < 10; j++) { const q = a / 1.2, an = j / 10 * 6.28; L.puff(ex + Math.cos(an) * (60 + 140 * q), ey + 70 + Math.sin(an) * (30 + 70 * q), 12 + 16 * q, [0.3, 0.25, 0.22], 0.4 * (1 - q), e.t + j); }
    }
    // the hero's magic shield bubble
    if (h.shield > 0 && GT < h.shieldUntil) { G.blend('add'); const f = 0.35 + 0.1 * Math.sin(t * 6); L.ring(sx(h.x), sy(h.y) - 32, 36, 44, [0.45, 0.75, 1], f, 0.25); L.glow(sx(h.x), sy(h.y) - 32, 44, [0.3, 0.55, 1], 0.25); G.blend(); }

    // ===== bloom + grade (on the lit target) =====
    const scr = screenFx(ST, R, h, st, GT);
    const comp = L.T.comp; L.T.comp = LT.lit; L.finish(t, Object.assign({ bloom: [0.18, 0.14], vignette: 0.85, warm: 0.2, roll: 1, dither: 1 }, scr)); L.T.comp = comp;
    if (window.HUD) HUD.draw(ST, t, { cx, cy, sx, sy, st });
  };

  // full-screen responses: pain tints the rim red by the share of health lost, a low health throbs, a roar flashes it,
  // a scroll flashes it pale blue; death greys and darkens the frame before the end screen; a new floor fades in from black
  function screenFx(ST, R, h, st, GT) {
    let r = 0, g = 0, b = 0, w = 0, dark = 0, desat = 0;
    const add = (col, amt) => { if (amt <= 0) return; r += col[0] * amt; g += col[1] * amt; b += col[2] * amt; w += amt; };
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      if (e.k === 'hurt' && a < 0.5) add([0.55, 0.02, 0.02], (0.25 + 0.4 * Math.min(1, 4 * e.n / st.maxHp)) * (1 - SS(0.05, 0.5, a)));
      if (e.k === 'roar' && a < 0.8) add([0.6, 0.12, 0.02], 0.45 * (1 - SS(0.1, 0.8, a)));
      if (e.k === 'teleport' && a < 0.5) add([0.6, 0.8, 1], 0.3 * (1 - SS(0, 0.5, a)));
      if (e.k === 'floor' && a < 0.9) dark = Math.max(dark, 1 - SS(0, 0.9, a)); }
    const f = h.hp / st.maxHp; if (h.deadT < 0 && f < 0.3) add([0.45, 0.02, 0.02], (1 - f / 0.3) * (0.22 + 0.12 * Math.sin(GT * 6.5)));
    if (h.deadT >= 0) { const du = GT - h.deadT; desat = 0.85 * SS(0, 1.2, du); dark = Math.max(dark, 0.55 * SS(0.6, 1.6, du)); add([0.4, 0.02, 0.02], 0.5 * (1 - SS(0.4, 1.4, du))); }
    return { edge: w > 0 ? [r / w, g / w, b / w, Math.min(0.7, w)] : [0, 0, 0, 0], desat, dark };
  }

  function drawDrop(p, x, y, GT, t) {
    const z = p.z || 0, bob = p.z > 0 ? 0 : 2 * Math.sin(t * 3 + p.id);
    L.shadow(x, y + 2, 10, 4, 0.4);
    if (p.kind === 'gold') { const k = Math.min(1, 0.5 + p.n / 40); const [w, hh] = SZ('it_gold'); L.sprite('it_gold', x - w * 0.3 * k, y - z - hh * 0.6 * k, { w: w * 0.6 * k, h: hh * 0.6 * k }); return; }
    if (p.kind === 'shard') { G.blend('add'); L.glow(x, y - z - 14 - bob, 24, [0.4, 0.7, 1], 0.8); G.blend(); const [w, hh] = SZ('crystal'); L.sprite('crystal', x - w * 0.15, y - z - hh * 0.3 - bob, { w: w * 0.3, h: hh * 0.3 }); return; }
    const it = p.item, ic = SIM.itemIcon(it), [w, hh] = SZ(ic), k = 0.62, col = D.RARITY[it.rar].col;
    if (it.rar >= 1) { G.blend('add'); L.glow(x, y - z - 14 - bob, 30, col, 0.55); if (it.rar >= 3) L.solid(x - 3, y - z - 110, 6, 100, col, 0, 0, 0, 0.18 + 0.05 * Math.sin(t * 4)); G.blend(); }
    L.sprite(ic, x - w * k / 2, y - z - hh * k - 4 - bob, { w: w * k, h: hh * k });
  }

  // ---------------- QA hooks (scripts/qa.mjs) ----------------
  SC.QA = () => {
    const mk = (fn) => { const S = SIM.spawn(0, {}); fn(S); return S; };
    const play = (fn) => mk((S) => { S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 1234); S.screen = 'play'; for (let i = 0; i < 30; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); if (fn) fn(S); });
    const worst = (S) => { const h = S.run.hero; h.lvl = 99; h.gold = 999999; h.xp = 1; h.pts = 99; h.sp = 99; S.meta.shards = 99999; h.ab = { whirl: 5, fireball: 5, shield: 5 };
      for (let i = 0; i < 24; i++) h.bag[i] = Object.assign(SIM.rollItem(S.run, 8, 4), { id: 1000 + i }); h.bag[0] = { id: 2000, b: 'hp_potion', n: 9, rar: 0, lvl: 1, mods: {} }; };
    const states = [
      ['menu', mk((S) => { S.saved = null; })],
      ['menu_continue', mk((S) => { S.saved = SIM.newRun(S, 'campaign', 5); })],
      ['play', play()],
      ['play_worst', play((S) => { worst(S); S.run.msg = { s: 'Повелитель Демонов повержен! Портал наружу открыт — путь на поверхность свободен, герой', t: S.t - 1 }; })],
      ['inv', play((S) => { worst(S); S.screen = 'inv'; })],
      ['item_balance', play((S) => {
        worst(S); S.screen = 'inv'; S.hover = 'bag:23';
        S.run.hero.eq.armor = { id: 3000, b: 'plate_armor', lvl: 6, rar: 3, def: 15, mods: {} };
        S.run.hero.bag[23] = { id: 3001, b: 'leather_armor', lvl: 8, rar: 4, def: 24, mods: { hp: 72, mp: 38, aspd: 16, regen: 3 } };
      })],
      ['pause', play((S) => { S.screen = 'pause'; S.run.msg = { s: 'Этаж 1 — Подземелье', t: S.t - 1 }; })],
      ['meta', mk((S) => { S.screen = 'meta'; S.meta.shards = 99999; S.meta.up = Object.fromEntries(D.META.map((M, i) => [M.id, i % 3 ? M.max - 1 : i % 2 ? M.max : 0])); })],
      ['meta_refuse', mk((S) => { S.screen = 'meta'; S.meta.shards = 0; S.hover = 'gear'; S.ev.push({ k: 'nope', s: 'Не хватает осколков', t: S.t - 0.2 }); })],
      // a dungeon altar at its widest: the longest gift of each tier, one affordable, one hovered, a refusal; then the gifts in the HUD
      ...[['altar_screen', 99999, 'gift:1'], ['altar_poor', 5, 'gift:2']].map(([id, bank, hv]) => [id, play((S) => {
      ['inv_empty', play((S) => { worst(S); S.screen = 'inv'; S.hover = 'eq:offhand'; S.run.seen = S.run.seen.map(() => 1); })],
        const R = S.run, h = R.hero, long = (tier) => D.GIFTS.filter((g) => g.tier === tier).sort((a, b) => b.desc.length + b.name.length - a.desc.length - a.name.length)[0].id;
        R.shrines = [{ x: h.x + 70, y: h.y, used: 0, gifts: [1, 2, 3].map((tier) => ({ id: long(tier), cost: bank > 999 ? 999 : D.giftCost(tier, 8) })) }]; R.altar = 0;
        S.meta.shards = bank; S.screen = 'altar'; S.hover = hv; if (bank < 999) S.ev.push({ k: 'nope', s: 'Не хватает осколков душ', t: S.t - 0.2 }); })]),
      ['altar_prompt', play((S) => { const R = S.run, h = R.hero; R.shrines = [{ x: h.x + 50, y: h.y - 20, used: 0 }]; })],
      ['gifts_hud', play((S) => { const h = S.run.hero; h.bless = 1; h.shield = 999; h.shieldUntil = S.t + 3; h.burn = h.poison = S.t + 2;
        h.perks = Object.fromEntries(D.GIFTS.filter((g) => g.id !== 'bless').map((g) => [g.id, 3])); })],
      ['dead', mk((S) => { S.screen = 'dead'; S.result = { how: 'dead', floor: 8, lvl: 99, kills: 9999, gold: 999999, shards: 99999, found: 9999, base: 12529, statBonus: 40, cap: 40, win: 0, time: 35999, C: { floors: 8, foes: 9999, kills: 9999, lootN: 9999, loot: 9999, secN: 16, sec: 16, pct: 1 } }; })],
      ['win', mk((S) => { S.screen = 'win'; S.result = { how: 'win', floor: 8, lvl: 99, kills: 9999, gold: 999999, shards: 99999, found: 9999, base: 12529, statBonus: 40, cap: 40, win: 30, time: 35999, C: { floors: 8, foes: 9999, kills: 9999, lootN: 9999, loot: 9999, secN: 16, sec: 16, pct: 1 } }; })],
      ['dead_short', mk((S) => { S.screen = 'dead'; S.result = { how: 'dead', floor: 1, lvl: 1, kills: 0, gold: 0, shards: 0, found: 0, base: 0, statBonus: 0, cap: 5, win: 0, time: 12, C: { floors: 1, foes: 20, kills: 0, lootN: 30, loot: 0, secN: 0, sec: 0, pct: 0 } }; })],
    ];
    for (const [name, age] of [['shard_flash', 0.1], ['shard_flight', 0.55], ['shard_arrival', 1.05]]) {
      states.push([name, play((S) => { worst(S); S.run.msg = null; const h = S.run.hero; S.ev = [{ k: 'shard', x: h.x, y: h.y, n: 3, floor: S.run.floor, t: S.t - age }]; })]);
    }
    states.push(['shard_floor', play((S) => { SIM.enterFloor(S, S.run, 8); worst(S); S.run.msg = { s: 'Этаж 8 — Трон Демона', t: S.t - 0.8 }; S.ev = [{ k: 'stairs', n: 7, floor: 7, t: S.t - 0.8 }]; })]);
    // the reference's composition: a fight in a lit room, monsters around the hero mid-swing
    const match = play((S) => { const R = S.run, h = R.hero, rm = R.map.rooms.find((r) => r.type === 'combat') || R.map.rooms[0]; h.x = (rm.x + rm.w / 2) * TILE; h.y = (rm.y + rm.h / 2) * TILE;
      R.cam = [h.x - W / 2, h.y - H / 2 - 30]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1);
      const types = ['skeleton', 'skeleton', 'goblin', 'brute', 'skeleton', 'spider', 'cultist'];
      R.en = types.map((ty, i) => { const a = i / types.length * 6.28; const E = D.ENEMIES[ty]; return { id: 900 + i, type: ty, x: h.x + Math.cos(a) * (90 + 30 * (i % 2)), y: h.y + Math.sin(a) * 70, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: ty === 'brute' ? 1 : 0, room: rm.id, st: 'chase', t0: 0, face: Math.cos(a) > 0 ? -1 : 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }; });
      h.atkT = S.t - SIM.K.HIT; h.atkA = 0; h.aim = 0; h.face = 1; S.ev.push({ k: 'swing', t: S.t - SIM.K.HIT, x: h.x, y: h.y, a: 0, f: 1 }); R.msg = null;
      R.en.slice(0, 5).forEach((e, i) => { e.hp = Math.round(e.max * 0.6); S.ev.push({ k: 'hit', t: S.t - 0.1 - 0.08 * i, x: e.x, y: e.y - 50, n: 12, crit: i === 2 ? 1 : 0, id: e.id }); }); });
    states.push(['match', match]);
    // elites next to plain monsters of the same kind: the aura and the size must tell them apart at a glance
    states.push(['elite', play((S) => { const R = S.run, h = R.hero, rm = R.map.rooms.find((r) => r.type === 'combat') || R.map.rooms[0]; h.x = (rm.x + 1.5) * TILE; h.y = (rm.y + rm.h / 2) * TILE;
      R.cam = [h.x - 260, h.y - H / 2 - 30]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      R.en = ['skeleton', 'goblin', 'cultist', 'brute'].flatMap((ty, i) => [0, 1].map((el) => { const E = D.ENEMIES[ty]; return { id: 940 + i * 2 + el, type: ty, x: h.x + 170 + i * 190, y: h.y - 90 + el * 190, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: el, room: rm.id,
        st: 'idle', t0: 0, face: -1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }; })); })]);
    // regression states: spikes mid-rise next to the hero; a room at the map's corner must not hide under the HUD
    const trapS = (() => { for (let sd = 1; sd < 60; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const m = S.run.map; if (!m.traps.length) continue;
      const tp = m.traps[Math.floor(m.traps.length / 2)], h = S.run.hero; h.x = tp.x - 70; h.y = tp.y + 10; S.run.seen = S.run.seen.map(() => 1); S.t = (1 - tp.ph) * 2.4 + 0.3; S.run.cam = [tp.x - W / 2, tp.y - H / 2]; return S; } })();
    if (trapS) { states.push(['trap', trapS]); const w = structuredClone(trapS), tp = w.run.map.traps[Math.floor(w.run.map.traps.length / 2)]; w.t = (0.88 - tp.ph + 2) % 1 * 2.4 + 2.4; states.push(['trap_warn', w]); }
    const edgeS = play((S) => { const R = S.run, m = R.map, r = m.rooms.reduce((a, b) => (b.x + b.w > a.x + a.w ? b : a)), h = R.hero; h.x = (r.x + r.w - 2) * TILE; h.y = (r.y + 1) * TILE + 16;
      R.seen = R.seen.map(() => 1); R.cam = [h.x - W / 2, h.y - H / 2]; for (let i = 0; i < 300; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); });
    states.push(['edge', edgeS]);
    const treasureS = (() => { for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, r = R.map.rooms.find((q) => q.type === 'treasure' && R.map.rugs.length);
      if (!r) continue; const h = R.hero; h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 1) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - W / 2, (r.y + r.h / 2) * TILE - H / 2]; return S; } })();
    if (treasureS) states.push(['treasure', treasureS]);
    // one prop of each material in a row, each knocked from its own side: mid-recoil with chips and sparks in the air, then settling
    const propS = (age) => play((S) => { const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((p, q) => q.w * q.h - p.w * p.h)[0], inR = (o) => DUNGEON.roomAt(m, o.x, o.y) === rm.id;
      m.decor = m.decor.filter((d) => !inR(d)); m.torches = m.torches.filter((t2) => t2.kind === 'wall' || !inR(t2)); R.chests = R.chests.filter((c) => !inR(c)); R.pots = R.pots.filter((p) => !inR(p));
      R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); const cx = (rm.cx + 0.5) * TILE, cy = (rm.cy + 0.5) * TILE + 6;
      ['table', 'statue', 'cage', 'crystal', 'coffin', 'shop_sacks', 'bookshelf', 'brazier'].forEach((n, i) => { const x = cx + (i % 4 - 1.5) * 76, y = cy + (i < 4 ? -40 : 60), s = i % 2 ? -1 : 1;
        if (n === 'brazier') { m.torches.push({ x, y, kind: 'brazier', r: rm.id }); S.ev.push({ k: 'prop', t: S.t - age, x, y, i: 't' + (m.torches.length - 1), n, mat: 'metal', s }); return; }
        m.decor.push({ x, y, n, solid: 1, r: rm.id }); S.ev.push({ k: 'prop', t: S.t - age, x, y, i: 'd' + (m.decor.length - 1), n, mat: D.PROP_MAT[n], s }); });
      h.x = cx; h.y = cy + 150; R.cam = [cx - W / 2, cy - H / 2]; });
    states.push(['props_knock', propS(0.07)], ['props_settle', propS(0.4)]);
    // a secret room's fake wall: whole (crack + draught), cracked by a blow, breaking, and the room found behind it
    const secretS = (stage, dir = 'u') => { for (let sd = 1; sd < 80; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, m = R.map, q = m.secrets.find((o) => o.dir === dir); if (!q) continue;
      const h = R.hero; h.x = q.x - q.dx * 70 + (q.dy ? 50 : 0); h.y = q.y - q.dy * 80; h.aim = Math.atan2(q.dy, q.dx); R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [q.x - W / 2, q.y - H / 2 - 40];
      if (stage >= 1) { SIM.hitSecret(S, R, q); S.ev = S.ev.filter((e) => e.k === 'wallhit'); S.ev[0].t = S.t - 0.1; }
      if (stage >= 2) { q.hitT = -9; SIM.hitSecret(S, R, q); S.ev = S.ev.filter((e) => e.k === 'secret'); S.ev[0].t = S.t - (stage === 2 ? 0.25 : 3); R.msg = null; R.trauma = 0; }
      if (stage === 3) { const r = m.rooms[q.room]; h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 1) * TILE + 10; R.cam = [h.x - W / 2, (r.y + r.h / 2) * TILE - H / 2]; }
      return S; } };
    ['secret_wall', 'secret_cracked', 'secret_break', 'secret_room'].forEach((n, i) => { const S = secretS(i); if (S) states.push([n, S]); });
    for (const d of ['d', 'l', 'r']) for (const [n, i] of [['secret_wall_' + d, 0], ['secret_cracked_' + d, 1]]) { const S = secretS(i, d); if (S) states.push([n, S]); }
    // every monster type in a row, idle, facing right: the rigs at rest against their approved sprites
    const lineup = (S) => { const R = S.run, r = R.map.rooms.filter((q) => q.id !== R.map.start).reduce((a, b) => (b.w > a.w ? b : a)), h = R.hero, y0 = (r.y + r.h / 2) * TILE + 16;
      R.msg = null; R.seen = R.seen.map(() => 1); h.x = (r.x + 1) * TILE; h.y = (r.y + 1) * TILE + 20;
      R.en = ['skeleton', 'goblin', 'spider', 'cultist', 'ghost', 'brute'].map((ty, i) => { const E = D.ENEMIES[ty]; return { id: 960 + i, type: ty, x: (r.x + r.w / 2) * TILE + (i - 2.5) * 110, y: y0, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: r.id, st: 'idle', t0: 0,
        face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }; });
      R.cam = [(r.x + r.w / 2) * TILE - W / 2, y0 - H / 2 - 40]; };
    states.push(['monsters', play(lineup)]);
    // event responses: pain at the rim on low health with a bolt bursting on the hero, the fall, a scroll's two pillars,
    // the arrival on a floor, the boss's roar, a spike plate firing, the buff row with its worst strings
    const fx = (fn) => play((S) => { const R = S.run, h = R.hero; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - W / 2, h.y - H / 2]; fn(S, R, h); });
    states.push(['fx_hurt', fx((S, R, h) => { h.hp = Math.round(SIM.stats(h, S.meta).maxHp * 0.15); h.hurtT = S.t - 0.08;
      S.ev.push({ k: 'hurt', t: S.t - 0.08, x: h.x, y: h.y - 40, n: 30 }, { k: 'pop', t: S.t - 0.08, x: h.x, y: h.y - 38, c: 'hex', hero: 1 }); })]);
    states.push(['fx_die', fx((S, R, h) => { h.hp = 0; h.deadT = S.t - 0.8; S.ev.push({ k: 'die', t: S.t - 0.8, x: h.x, y: h.y }); })]);
    states.push(['fx_teleport', fx((S, R, h) => { S.ev.push({ k: 'teleport', t: S.t - 0.2, x: h.x, y: h.y, fx: h.x + 360, fy: h.y - 60 }); })]);
    states.push(['fx_arrive', fx((S, R, h) => { S.keepFloor = 1; S.ev.push({ k: 'floor', t: S.t - 0.45, x: h.x, y: h.y, f: R.floor }); })]);
    states.push(['fx_roar', play((S) => { const R = S.run; SIM.enterFloor(S, R, D.FLOORS); const b = R.en.find((e) => e.type === 'boss'), h = R.hero; h.x = b.x; h.y = b.y + 220; b.st = 'chase';
      R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [b.x - W / 2, b.y + 60 - H / 2]; S.ev.push({ k: 'roar', t: S.t - 0.25, x: b.x, y: b.y - 70, id: b.id }); })]);
    if (trapS) { const s2 = structuredClone(trapS), tp = s2.run.map.traps[Math.floor(s2.run.map.traps.length / 2)]; s2.ev.push({ k: 'spike', t: s2.t - 0.08, x: tp.x, y: tp.y }); states.push(['fx_spike', s2]); }
    states.push(['buffs', fx((S, R, h) => { worst(S); Object.assign(h, { bless: 1, shield: 99999, shieldUntil: S.t + 4, burn: S.t + 0.4, poison: S.t + 2.2 }); })]);
    // the hero standing in lava, a quarter second after a burn tick (the scorch flash and smoke)
    for (let sd = 1; sd < 30; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); SIM.enterFloor(S, S.run, 5); const R = S.run, m = R.map, lv = [];
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.cells[y * m.W + x] === 3) lv.push([x, y]);
      if (lv.length) { const [lx, ly] = lv[Math.floor(lv.length / 2)], h = R.hero; h.x = lx * TILE + 16; h.y = ly * TILE + 16; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1);
        S.ev.push({ k: 'scorch', t: S.t - 0.12, x: h.x, y: h.y }); h.hurtT = S.t - 0.12; h.hurtX = 0; R.cam = [h.x - W / 2, h.y - H / 2]; states.push(['lava', S]); break; } }
    // big props against a room's top wall: they must stand on the floor in front of the facade, not on its cap
    const wallS = (tall) => { for (let sd = 1; sd < 80; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); if (tall) SIM.enterFloor(S, S.run, 3); const R = S.run, m = R.map;
      const r = m.rooms.find((q) => { const w = m.decor.filter((d) => d.solid && d.r === q.id && Math.abs(d.y - (q.y * TILE + 22)) < 1); return w.length >= (tall ? 1 : 3) && (!tall || w.some((d) => d.n === 'statue' || d.n === 'pillar')); }); if (!r) continue;
      const h = R.hero; h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h - 1) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - W / 2, r.y * TILE - H / 2 + 40]; return S; } };
    for (const [nm, tall] of [['wallprops', 0], ['wallprops_tall', 1]]) { const S = wallS(tall); if (S) states.push([nm, S]); }
    states.push(['sanct', play((S) => { const R = S.run, r = R.map.rooms[R.map.start], h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1);
      h.x = (r.x + 1.5) * TILE; h.y = (r.y + r.h - 1.5) * TILE; R.cam = [(r.x + r.w / 2) * TILE - W / 2, (r.y + r.h / 2) * TILE - H / 2]; })]);
    // the shop: the room from its doorway side, the hero at the counter (the prompt), and the trade screen at its worst
    const shopS = (prep) => play((S) => { const R = S.run, sh = R.map.shop, r = R.map.rooms[sh.room], h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      h.x = sh.front.x + 20; h.y = sh.front.y + 4; R.shop.away = 0; R.cam = [(r.x + r.w / 2) * TILE - W / 2, (r.y + r.h / 2) * TILE - H / 2 - 20]; if (prep) prep(S); });
    states.push(['shop', shopS()]);
    states.push(['shop_screen', shopS((S) => { worst(S); const R = S.run; for (let i = 0; i < 6; i++) R.shop.back.push({ it: Object.assign(SIM.rollItem(R, 8, 4), { id: 3000 + i }), price: 99999 });
      R.shop.back = R.shop.back.slice(-D.SHOP.buyback); for (const g of R.shop.goods) g.price = 99999; R.shop.line = 1; S.screen = 'shop'; S.hover = 'buy:0'; })]);
    // the merchant's key poses: a coin onto the scales, a stroke of the beard (hero away), a wave, the nod on a trade
    const at6 = (S, u) => { const R = S.run, k = R.map.seed % 7; S.t += ((u - (S.t + k)) % 6 + 6) % 6; R.shop.greetT = R.shop.tradeT = -9; R.cam = [R.map.shop.x - W / 2, R.map.shop.y - 40 - H / 2]; };
    states.push(['merchant_coin', shopS((S) => { S.run.hero.x -= 400; at6(S, 1.0); })]);
    states.push(['merchant_beard', shopS((S) => { S.run.hero.x -= 400; at6(S, 3.8); })]);
    states.push(['merchant_greet', shopS((S) => { at6(S, 0); S.run.shop.greetT = S.t - 0.6; })]);
    states.push(['merchant_nod', shopS((S) => { at6(S, 0); S.run.shop.tradeT = S.t - 0.35; })]);
    states.push(['shop_screen_sell', shopS((S) => { worst(S); S.screen = 'shop'; S.hover = 'sell:23'; })]);
    // every biome's floor texture under real light, so a regenerated floor is judged in place
    for (const [zone, f] of [['crypt', 3], ['lava', 5], ['arcane', 7]]) { const S = play(); S.run = SIM.newRun(S, 'campaign', 3); SIM.enterFloor(S, S.run, f);
      const R = S.run, r = R.map.rooms.filter((q) => q.type !== 'start').reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)), h = R.hero;
      h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h / 2) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - W / 2, h.y - H / 2]; states.push(['zone_' + zone, S]); }
    // hero walk cycles: right, left, down, up — the same state at successive distances
    const cyc = (dx, dy) => { const out = []; for (let i = 0; i < 12; i++) { const S = play(); const h = S.run.hero; h.vx = dx * SIM.K.RUN; h.vy = dy * SIM.K.RUN; h.face = dx < 0 ? -1 : 1; h.back = dy < 0 ? 1 : 0; const sl = SIM.stepLen(Math.abs(dx)); h.gp = i * 2 * Math.PI / 12; h.dist = i * 2 * sl / 12; h.x += dx * h.dist; h.y += dy * h.dist; out.push(S); } return out; };
    // the swing: impact frames all round (the sim's damage frame vs a target at 0.8 reach), and whole swings 1/60 s apart for pops
    const base = play((S) => { S.run.msg = null; S.run.en = []; }), clone = () => structuredClone(base);
    const swingAt = (a, T, tgt) => { const S = clone(), h = S.run.hero; h.aim = h.atkA = a; h.face = Math.cos(a) >= 0 ? 1 : -1; h.back = Math.sin(a) < -0.5 ? 1 : 0; h.atkT = S.t - T; h.vx = h.vy = 0;
      if (tgt) { const r = SIM.stats(h, S.meta).reach * 0.8; h.qaTgt = [h.x + Math.cos(a) * r, h.y + Math.sin(a) * r]; } return S; };
    const attacks = { hero_swing: { subject: 'hero', states: [...Array(16).keys()].map((i) => swingAt(-Math.PI + i * Math.PI / 8, SIM.K.HIT, 1)) } };
    const swings = {};
    for (const deg of [-135, -90, -45, 0, 45, 90, 135, 180]) swings['hero_swing_' + (deg < 0 ? 'm' + -deg : deg)] = [...Array(30).keys()].map((i) => swingAt(deg * Math.PI / 180, -0.03 + i / 60, 1));
    // enemy attacks played by the sim 1/60 s apart: wind-up → strike → back to the chase must not pop
    const enemyT = (ty, elite) => { const fr = []; let S = play((S) => { const R = S.run, r = R.map.rooms.find((q) => q.id !== R.map.start && q.w >= 7 && q.h >= 5), h = R.hero, E = D.ENEMIES[ty];
      h.x = (r.x + 2) * TILE; h.y = (r.y + r.h / 2) * TILE; h.ifr = 1e9; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - W / 2, h.y - H / 2];
      R.en = [{ id: 990, type: ty, x: h.x + 34 + E.r, y: h.y, tx: h.x, ty: h.y, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite, room: r.id, st: ty === 'boss' ? 'bwind' : 'wind', mv: 'slam', phase: 0, t0: S.t,
        face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }]; });
      for (let i = 0; i < 100; i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } return fr; };   // the sim steps 1/120 s; frames are 1/60 s
    // monster walk cycles, right and down: one stride in 12 frames (the rig's own stride), subject en990
    const enCyc = (ty, dx, dy) => { const out = [], H0 = SZ(EN_TEX[ty])[1] * (ty === 'boss' ? 1.6 : 1), st = MONSTERS.stride(ty, H0), E = D.ENEMIES[ty];
      for (let i = 0; i < 12; i++) { const S = play((S) => { const R = S.run, h = R.hero, r = R.map.rooms.find((q) => q.id !== R.map.start && q.w >= 7 && q.h >= 5); R.msg = null; R.seen = R.seen.map(() => 1);
        h.x = (r.x + 1) * TILE; h.y = (r.y + 1) * TILE + 20; const x0 = (r.x + r.w / 2) * TILE, y0 = (r.y + r.h / 2) * TILE, d = i * st / 12;
        R.en = [{ id: 990, type: ty, x: x0 + dx * d, y: y0 + dy * d, vx: dx * E.spd, vy: dy * E.spd, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: r.id, st: 'chase', t0: -9, face: dx < 0 ? -1 : 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: d, kbx: 0, kby: 0, burn: 0, burnT: 0 }];
        R.cam = [x0 - W / 2, y0 - H / 2]; }); out.push(S); } return out; };
    const enCycles = {}; for (const ty of ['skeleton', 'goblin', 'brute', 'cultist', 'spider']) if (MONSTERS.rigOf(ty)) { enCycles[ty + '_right'] = enCyc(ty, 1, 0); enCycles[ty + '_down'] = enCyc(ty, 0, 1); }
    const transitions = { skeleton_attack: enemyT('skeleton', 0), brute_attack: enemyT('brute', 1), spider_attack: enemyT('spider', 0), boss_attack: enemyT('boss', 0), cultist_attack: enemyT('cultist', 0) };
    // deaths: a few live frames, then the kill, through the fall and the bounce (the hero mid-stride and at rest, a skeleton)
    const eventT = (prep, kill) => { const fr = []; let S = play(prep); for (let i = 0; i < 75; i++) { if (i === 5) kill(S); fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } return fr; };
    const heroDies = (S) => { const h = S.run.hero; h.hp = 0; h.deadT = S.t; };
    transitions.hero_death = eventT((S) => { S.run.en = []; S.run.msg = null; }, heroDies);
    transitions.hero_death_run = eventT((S) => { S.run.en = []; S.run.msg = null; const h = S.run.hero; h.vx = SIM.K.RUN; h.gp = 1.3; }, heroDies);
    const clear = (S) => { S.run.en = []; S.run.msg = null; };
    transitions.hero_dash = eventT(clear, (S) => { const h = S.run.hero; h.dashT = S.t; h.dashX = 1; h.dashY = 0; });
    transitions.hero_dash_up = eventT(clear, (S) => { const h = S.run.hero; h.dashT = S.t; h.dashX = 0; h.dashY = -1; });
    transitions.hero_hurt = eventT(clear, (S) => { const h = S.run.hero; h.hurtT = S.t; h.hurtX = 1; });
    transitions.skeleton_death = eventT((S) => { const R = S.run, h = R.hero; R.msg = null; R.en = [{ id: 990, type: 'skeleton', x: h.x + 60, y: h.y, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0,
      face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }]; }, (S) => { const e = S.run.en[0]; e.hp = 0; e.deadT = S.t; });
    // a monster at its post, 2 s at 1/60 s: breathing, a turn and a shift about the spot
    const loops = {};
    for (const ty of ['skeleton', 'goblin', 'spider', 'cultist', 'brute']) { const fr = []; let S = play((S) => { const R = S.run, h = R.hero; R.msg = null;
      R.en = [{ id: 990, type: ty, x: h.x + 90, y: h.y, hx: h.x + 90, hy: h.y, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0, face: -1, pf: -1, ft: -9, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }];
      h.x -= 400; R.cam = [h.x + 400 - W / 2, h.y - H / 2]; });
      for (let i = 0; i < 120; i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); }
      loops[ty + '_idle'] = fr; }
    // the merchant: his work loop (5 of its 6 s) at 1/60 s, then a greeting and a nod on a trade (subject 'merchant')
    { const fr = []; let S = shopS((S) => { const h = S.run.hero; h.x -= 500; h.y += 200; S.run.shop.greetT = -9; S.run.shop.tradeT = -9; });
      for (let i = 0; i < 300; i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } loops.merchant_work = fr; }
    for (const [nm, k] of [['merchant_greet', 'greetT'], ['merchant_trade', 'tradeT']]) { const fr = []; let S = shopS((S) => { S.run.shop.greetT = -9; S.run.shop.tradeT = -9; S.run.shop[k] = S.t + 0.1; S.run.shop.away = 0; });
      for (let i = 0; i < 100; i++) { fr.push(S); S = structuredClone(S); for (let k2 = 0; k2 < 2; k2++) SIM.step(S, { px: 960, py: 540, keys: [] }); } transitions[nm] = fr; }
    // every monster caught mid-turn (a third of the way through)
    states.push(['monsters_turn', play((S) => { lineup(S); for (const e of S.run.en) { e.pf = e.face; e.ft = S.t - 0.05; } })]);
    const box = (name, S) => { const R = S.run; if (!R) return [0, 0, W, H];
      if (name.startsWith('merchant')) { const sh = R.map.shop; return [sh.x - R.cam[0] - 60, sh.y - R.cam[1] - 100, 120, 110]; }
      const e = (enCycles[name] || loops[name]) && R.en[0];
      if (e) { const hh = SZ(EN_TEX[e.type])[1] * 1.15, ww = hh * 1.5; return [e.x - R.cam[0] - ww / 2, e.y - R.cam[1] - hh, ww, hh + 16]; }
      const h = R.hero; return [h.x - R.cam[0] - 50, h.y - R.cam[1] - 90, 100, 110]; };
    const anim = {};
    for (const [name, kind] of [['shard_pickup', 'shard'], ['shard_reward', 'stairs']]) {
      const base = structuredClone(states.find(([key]) => key === (kind === 'shard' ? 'shard_flash' : 'shard_floor'))[1]);
      const on = [], off = [];
      for (let i = 0; i < 90; i++) {
        const S = structuredClone(base); S.t = base.t + i / 60; S.ev[0].t = base.t;
        on.push(S); const clean = structuredClone(S); clean.ev = []; off.push(clean);
      }
      anim[name] = { on, off, box: [100, 130, 1000, 500] };
    }
    // starting a run or a floor fades the screen in from black; every QA state but the one that checks it is looked at in full light
    const calm = (o, seen = new Set()) => { if (!o || typeof o !== 'object' || seen.has(o) || (Array.isArray(o) && typeof o[0] === 'number')) return; seen.add(o);
      if (Array.isArray(o.ev) && 'screen' in o && !o.keepFloor) o.ev = o.ev.filter((e) => e.k !== 'floor'); for (const v of Object.values(o)) calm(v, seen); };
    const out = { states, anim, cycles: Object.assign({ hero_right: cyc(1, 0), hero_left: cyc(-1, 0), hero_down: cyc(0, 1), hero_up: cyc(0, -1) }, enCycles),
      sprites: { hero_right: ['hero__thighL', 'hero__shinL', 'hero__footL', 'hero__thighR', 'hero__shinR', 'hero__footR', 'hero__body', 'hero__uarmL', 'hero__farmL', 'hero__uarmR', 'hero__farmR'] },
      subject: Object.assign({ hero_right: 'hero', hero_left: 'hero', hero_down: 'hero', hero_up: 'hero' }, Object.fromEntries(Object.keys(transitions).map((k) => [k, k.startsWith('hero') ? 'hero' : k.startsWith('merchant') ? 'merchant' : 'en990'])), Object.fromEntries(Object.keys(enCycles).map((k) => [k, 'en990'])), Object.fromEntries(Object.keys(loops).map((k) => [k, k.startsWith('merchant') ? 'merchant' : 'en990'])), Object.fromEntries(Object.keys(swings).map((k) => [k, 'hero']))), cycleT: { ...Object.fromEntries(Object.keys(enCycles).map((k) => { const ty = k.split('_')[0]; return [k, MONSTERS.stride(ty, SZ(EN_TEX[ty])[1]) / D.ENEMIES[ty].spd]; })), hero_right: 2 * SIM.stepLen(1) / SIM.K.RUN, hero_left: 2 * SIM.stepLen(1) / SIM.K.RUN, hero_down: 2 * SIM.stepLen(0) / SIM.K.RUN, hero_up: 2 * SIM.stepLen(0) / SIM.K.RUN },
      rest: { hero_right: play(), hero_left: play(), hero_down: play(), hero_up: play((S) => { S.run.hero.back = 1; }) }, actors: ['hero', ...Object.keys(enCycles).map((k) => k.split('_')[0])], loops, attacks, swings, transitions, box };
    calm(out); return out;
  };
})();
