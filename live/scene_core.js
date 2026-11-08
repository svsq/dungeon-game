// live/scene_core.js — shaders (spells, lava, water, caves, magma, sources, portal), light and colour tables, the GL programs.
// One of the scene's files (ARCHITECTURE.md §4.2): names from earlier files come from SCX at load, calls into later ones go through SCX.
(function (root) {
  const SCX = (root.SCX = {});
  const SC = (window.SCENE = {}), L = LIB, M = L.M, D = DATA, W = SIM.VIEW.W, H = SIM.VIEW.H, TILE = D.TILE;
  const SZ = (n) => window.SIZES[n] || [G.tex(n).w, G.tex(n).h], PIX = 2;
  let Z = D.ZOOM || 1, VW = W / Z, VH = H / Z;   // VW×VH: the world window on screen; Z follows the run's zoom (views)
  // each hole cluster of trap_plate is a triangle: one hole behind, two in front; TRAP_HOLE is the back hole's centre across
  // the plate (x, y), measured from the art
  const TRAP_HOLE = { x: [0.29, 0.70], y: [0.255, 0.655] };
  // a spike per hole [dx, dy, w, h, tex] on the art grid's 2 px (tools/spike.py), the tall one from the back hole drawn first
  const TRAP_SPIKE = [[0, 0, 14, 24, 'trap_spike'], [-5, 6, 10, 18, 'trap_spike_s'], [5, 6, 10, 18, 'trap_spike_s']];
  const SPELL_MASK = `
uniform sampler2D u_floor; uniform vec2 u_map, u_cam, u_origin;
float openAt(vec2 p){ ivec2 c = ivec2(floor(p / 32.0)), sz = textureSize(u_floor, 0);
  if (c.x < 0 || c.y < 0 || c.x >= sz.x || c.y >= sz.y) return 0.0;
  return texelFetch(u_floor, c, 0).r; }
float spellGate(vec2 p){ if (openAt(p) < 0.5) return 0.0;
  float n = ceil(length(p - u_origin) / 8.0);
  for (int i = 1; i <= 32; i++) { if (float(i) >= n) break; if (openAt(mix(u_origin, p, float(i) / n)) < 0.5) return 0.0; }
  return 1.0; }
vec2 artPoint(){ return (floor((v_px + u_cam) / 2.0) + 0.5) * 2.0; }
float stepped(float a){ return a < 0.16 ? 0.0 : a < 0.42 ? 0.3 : a < 0.74 ? 0.6 : 1.0; }
`;
  const WHIRL = SPELL_MASK + `
uniform vec2 u_center; uniform vec3 u_col; uniform float u_radius, u_age, u_angle, u_mode;
void main(){ vec2 p = artPoint(), q = (p - u_center) * vec2(1.0, 1.3); float r = length(q), a = atan(q.y, q.x);
  float gate = spellGate(p + vec2(0.0, u_mode < 0.5 ? 34.0 : 0.0)); if (gate < 0.5) discard;
  float tail = mod(u_angle - a + 6.2831853, 6.2831853), fade = 1.0 - smoothstep(0.28, 0.48, u_age);
  if (u_mode > 0.5) { float dust = 0.0;
    for (int j = 0; j < 12; j++) { float k = float(j), th = k * 0.5236 + u_age * (0.6 + hash(vec2(k, u_radius))), rr = u_radius + u_age * (9.0 + 12.0 * hash(vec2(k, 3.0)));
      vec2 d = q - vec2(cos(th), sin(th)) * rr; float sz = 7.0 + u_age * 22.0;
      dust = max(dust, smoothstep(sz, sz * 0.2, length(d)) * (0.55 + 0.45 * vnoise(p * 0.17 + k)) * (0.4 + 0.6 * hash(vec2(k, 7.0)))); }
    float al = stepped(dust * (1.0 - smoothstep(0.12, 0.5, u_age))) * 0.6;
    vec3 col = dust > 0.5 ? vec3(0.58, 0.50, 0.38) : vec3(0.25, 0.21, 0.17);
    o = vec4(col * al, al); return; }
  float rr = u_radius + 1.5 * sin(a * 7.0 + u_age * 19.0), d = abs(r - rr);
  float head = 1.0 - smoothstep(0.1, 1.5, tail), core = step(d, 3.0 * pow(max(0.0, head), 0.55)) * step(0.02, head);
  float halo = step(d, 8.0 * pow(max(0.0, head), 0.6)) * head * 0.65, strokes = 0.0;
  for (int j = 0; j < 10; j++) { float k = float(j), lag = 0.35 + k * 0.28, u = mod(tail - lag + 6.2831853, 6.2831853);
    float width = (2.5 + hash(vec2(k, 5.0)) * 2.0) * (1.0 - smoothstep(0.0, 0.3, u));
    float offset = 16.0 - mod(k, 3.0) * 7.0;
    strokes = max(strokes, step(abs(r - u_radius + offset), width) * (1.0 - smoothstep(0.0, 0.3, u)) * (0.85 - k * 0.02)); }
  float al = stepped(max(core * head, max(halo, strokes)) * fade);
  vec3 col = core > 0.5 ? vec3(1.0, 0.98, 0.9) : u_col;
  o = vec4(col * al, al * 0.65); }
`;
  const FIREBALL = SPELL_MASK + `
uniform vec2 u_center, u_dir; uniform float u_radius, u_age, u_amt, u_seed, u_mode, u_lift;
void main(){ vec2 p = artPoint(), d = p - u_center;
  if (spellGate(p + vec2(0.0, u_lift)) < 0.5) discard;
  vec2 q = vec2(dot(d, u_dir), dot(d, vec2(-u_dir.y, u_dir.x))) / u_radius;
  float flick = hash(vec2(floor(u_age * 30.0), u_seed)), noise = vnoise(p * 0.25 + floor(u_age * 30.0));
  float shape = length(q * vec2(0.86, 1.0)) + (noise - 0.5) * 0.24;
  shape += max(0.0, -q.x) * (0.13 + 0.12 * sin(q.y * 9.0 + u_age * 45.0));
  if (shape > 0.94 + 0.06 * flick) discard;
  vec3 col = shape < 0.36 ? mix(vec3(1.0, 0.98, 0.84), vec3(1.0, 0.85, 0.22), 0.25 + 0.25 * flick) : shape < 0.68 ? vec3(1.0, 0.69, 0.10) : vec3(0.95, 0.28, 0.035);
  float al = u_mode > 0.5 ? u_amt : stepped(u_amt);
  o = vec4(col * al * 1.25, al); }
`;
  const BLAST = SPELL_MASK + `
uniform vec2 u_center; uniform float u_radius, u_age, u_seed, u_mode;
void main(){ vec2 p = artPoint(), q = (p - u_center) * vec2(1.0, 1.3), v = q / u_radius; float r = length(v), a = atan(v.y, v.x);
  if (spellGate(p) < 0.5) discard;
  float noise = vnoise(p * 0.12 + u_seed), jag = 0.045 * sin(a * 13.0 + u_seed) + (noise - 0.5) * 0.09;
  if (u_mode < 0.5) { float edge = 0.65 + 0.15 * noise + 0.07 * sin(a * 9.0 + u_seed);
    float scar = step(r, edge) * floor((0.45 + 0.4 * noise) * 4.0 + 0.5) / 4.0;
    float al = scar * (1.0 - smoothstep(2.8, 4.0, u_age)) * 0.65;
    o = vec4(vec3(0.035, 0.022, 0.018) * al, al); return; }
  float grow = 0.12 + 0.88 * (1.0 - pow(max(0.0, 1.0 - u_age / 0.45), 2.0)), width = 0.06 * (1.0 - u_age / 0.6);
  float wave = step(abs(r + jag - grow), width) * (0.7 + 0.3 * noise);
  float wake = step(abs(r + jag * 1.5 - grow + 0.13), width * 0.6) * 0.4;
  float al = stepped(max(wave, wake) * (1.0 - smoothstep(0.02, 0.6, u_age))) * 0.6;
  o = vec4(mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.88, 0.4), wave) * al, al); }
`;
  const FLAME = `
uniform float u_seed, u_amt; uniform vec3 u_col;
void main(){ vec2 q = v_uv * 2.0 - 1.0; q.y = -q.y;                    // y up, base at q.y = -1
  float t = u_t * 2.2 + u_seed * 13.0, h = (q.y + 1.0) * 0.5;
  float n = fbm(vec2(q.x * 3.0 + u_seed, q.y * 2.4 - t * 2.4));
  float x = q.x + (n - 0.5) * 0.45 * h * h + sin(t * 1.7 + q.y * 3.0) * 0.07 * h;
  // a drop sitting in its cup, as the concept's fires are: a round belly in the lower third, a flickering point on top
  float top = 0.9 + 0.08 * sin(t * 2.3) + (n - 0.5) * 0.14, c = 0.3, b = (h - c) / c;
  float w = h < c ? 0.86 * sqrt(max(0.0, 1.0 - b * b * 0.85)) : 0.86 * pow(max(0.0, 1.0 - (h - c) / (top - c)), 1.25);
  float f = w * (0.92 + 0.16 * n) - abs(x);
  if (f <= 0.0 || h <= 0.0) discard;
  // three flat steps on the art grid, no gradient (style bible): a white heart low in the belly, a yellow body, an amber skin.
  // No red: the concept's fires hold no hue below 25 deg, and a dark rim round them is not there either
  bool warm = u_col.r >= max(u_col.g, u_col.b);
  vec3 outer = warm ? vec3(0.95, 0.5, 0.07) : u_col * 0.9, mid = warm ? vec3(1.0, 0.8, 0.26) : mix(u_col, vec3(1.0), 0.45);
  float r = abs(x) / max(w, 1e-3), heat = 1.0 - r - max(0.0, h - 0.18) * 0.9 + (n - 0.5) * 0.3;
  vec3 col = heat > 0.68 ? (warm ? vec3(1.0, 0.98, 0.9) : mix(u_col, vec3(1.0), 0.85)) : heat > 0.34 ? mid : outer;
  o = vec4(col * 1.5 * u_amt, 1.0); }`;
  // a slash crescent: angles a0..a1 (ellipse parameter) around the centre at radius 0.8 of the quad, sharp at both ends and hollow
  // inside. u_hard 1: the sword's slash, a flat band with a white heart on the art grid (u_sz: the quad in view px) fading toward the
  // tail; 0: the soft trail of the whirl and enemy swings, brightest toward the head. u_dark lays a dark rim under it so it reads on
  // a lit floor
  const ARC = `
uniform vec4 u_arc; uniform vec3 u_col; uniform vec2 u_sz; uniform float u_amt, u_dark, u_hard;     // a0, a1, thickness (fraction of r), squash y
void main(){ vec2 q = v_uv * 2.0 - 1.0; if (u_hard > 0.5) q = (floor(v_uv * u_sz * 0.5) + 0.5) * 4.0 / u_sz - 1.0;
  q.y /= u_arc.w; float r = length(q), a = atan(q.y, q.x);
  float a0 = u_arc.x, a1 = u_arc.y, span = a1 - a0, u = (a - a0) / span;
  for (int k = -1; k <= 1; k++) { float aa = a + float(k) * 6.2831853; float uu = (aa - a0) / span; if (uu >= 0.0 && uu <= 1.0) { u = uu; break; } }
  if (u < 0.0 || u > 1.0) discard;
  float d = abs(r - 0.80);
  if (u_hard > 0.5) { float th = u_arc.z * pow(sin(3.14159 * u), 0.7), px = 4.0 / u_sz.x;
    float band = step(d, th), a2 = band * (0.7 + 0.3 * u) * u_amt, sh = step(d, th + px) * step(px, th) * u_dark;
    o = vec4(mix(u_col, vec3(1.0), step(d, th * 0.65)) * a2, clamp(max(a2 * 0.5, sh), 0.0, 1.0)); return; }
  float th = u_arc.z * pow(sin(3.14159 * clamp(u * 0.92, 0.0, 1.0)), 0.7) + 1e-4;
  float band = 1.0 - smoothstep(th * 0.35, th, d), head = 1.0 - smoothstep(0.86, 1.0, u);
  float a2 = band * pow(u, 1.4) * head * u_amt, sh = (1.0 - smoothstep(th, th * 2.4 + 0.03, d)) * pow(u, 1.1) * head * u_dark;
  vec3 c = mix(u_col, vec3(1.0), max(smoothstep(0.6, 1.0, u), 1.0 - smoothstep(0.0, th * 0.8, d)) * band);
  o = vec4(c * a2, clamp(max(a2 * 0.5, sh), 0.0, 1.0)); }`;
  // lava over a soft mask of its cells (4 texels a cell, blurred): the shoreline is the mask's 0.5 contour, a little broken by noise,
  // so it never follows the grid. As in the concept it is liquid: orange mottled with dark red, split by a net of thin yellow-hot
  // cracks, a thin hot lip against the bank and scorched stone past it (TASKS 186). The mask's G, B hold each cell's flow: a
  // river's pattern is carried along it whole (one river flows one way, so nothing stretches; where two meet there is a seam),
  // still lava creeps. All in world px, flat steps, no smooth ramp. u_mode 0 draws the
  // ground, 1 the glow for the emissive pass, 2 itself again as an emitter so the fires' light can't tint it
  const LAVA = `
uniform sampler2D u_mask, u_seen, u_crust, u_occ; uniform vec4 u_box; uniform vec2 u_map; uniform float u_mode, u_scorch; uniform vec4 u_melt[8];
vec3 vor(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), o = vec2(hash(i + g), hash(i + g + 7.7));
    o = 0.5 + 0.4 * sin(u_t * 0.25 + 6.2831 * o); float dd = length(g + o - f);
    if (dd < d1) { d2 = d1; d1 = dd; id = hash(i + g + 3.3); } else if (dd < d2) d2 = dd; }
  return vec3(d1, d2, id); }
// the pattern at p: (crack width left, mottling, a darker patch)
vec3 field(vec2 p){ vec2 wq = vec2(fbm(p / 50.0 + 3.1), fbm(p / 50.0 + 8.7)); vec3 vc = vor(p / 21.0 + wq * 1.4);
  float crack = vc.y - vc.x - (0.05 + 0.12 * fbm(p / 30.0 + 5.0)) + 0.25 * step(fbm(p / 45.0 + 9.0), 0.42);   // not every seam glows
  return vec3(crack, fbm(p / 26.0 + wq * 1.8) + 0.3 * (0.5 - vc.x), step(vc.z, 0.08) * step(0.55, fbm(p / 80.0 + 2.0))); }
void main(){ vec2 w = u_box.xy + v_uv * u_box.zw;
  vec4 M = texture(u_mask, w / u_map); float mk = M.r, e = mk + (fbm(w / 20.0) - 0.5) * 0.2;
  if (e < 0.2) discard;
  float d = (e - 0.5) / max(length(vec2(dFdx(mk), dFdy(mk))), 0.002);   // px inside the shore (negative outside): bands keep their width in any pool
  vec2 fl = (texelFetch(u_mask, ivec2(w / u_map * vec2(textureSize(u_mask, 0))), 0).gb - 0.5) * 2.0;
  vec3 f = field(w - fl * 12.0 * u_t - vec2(u_t * 3.0, u_t * 2.0));
  float inside = smoothstep(-0.8, 0.8, d), lip = step(0.0, d) * step(d, 2.0) * step(0.35, fbm(w / 12.0 + vec2(0.0, u_t * 0.3)));
  vec3 Y = vec3(1.0, 0.72, 0.16), O = vec3(0.95, 0.33, 0.03), Rd = vec3(0.72, 0.1, 0.02), V = vec3(0.4, 0.05, 0.02);
  vec3 col = f.x < -0.04 ? Y : f.x < 0.0 ? O : f.y > 0.6 ? O : f.y > 0.4 ? Rd : V;
  col = f.z > 0.5 && f.x > 0.02 ? V : col;
  col = lip > 0.5 ? Y : col;
  // the magma caves' crust (TASKS 401): still dark plates with dull seams; under a weight its seams widen and glow, then it melts
  // into the lava round it and later sets again (u_melt: a cell's centre, crack 0..1, melt 0..1)
  if (texture(u_crust, w / u_map).r > 0.3) { float ck = 0.0, mt = 0.0;
    for (int i = 0; i < 8; i++) { vec2 q = abs(w - u_melt[i].xy); float c = step(q.x, 18.0) * step(q.y, 18.0); ck = max(ck, c * u_melt[i].z); mt = max(mt, c * u_melt[i].w); }
    vec3 g = field(w); float seam = step(g.x, 0.0 + 0.1 * ck);
    vec3 cc = mix(vec3(0.17, 0.1, 0.075), vec3(0.25, 0.15, 0.1), step(0.55, g.y)) * (1.0 - 0.35 * step(g.x, 0.06));
    cc = seam > 0.5 ? mix(vec3(0.6, 0.16, 0.03), Y, ck) : cc;
    col = mix(cc, col, mt); }
  float heat = clamp(col.r + col.g - 0.5, 0.0, 1.4);
  if (u_mode < 0.5) { float scorch = smoothstep(-10.0, -1.0, d) * (1.0 - inside) * u_scorch;   // the plateaus' bake draws its own bank (MAGMA)
    o = vec4(col * inside * 0.7 + vec3(0.035, 0.02, 0.015) * scorch, max(inside, scorch * 0.7)); }   // its own lights brighten it
  else if (u_mode < 1.5) o = vec4(col * heat * inside * 0.33 * texture(u_seen, w / u_map).r * (1.0 - texture(u_occ, scr(v_px)).a), 0.0);
  else o = vec4(col * inside * 0.56, inside); }`;
  // the map's edge bites the lava (TASKS 456): the generator keeps it two cells off the edge, so its bank there ran dead straight
  // along a column or row of cells, beside the plateaus' ragged banks; eaten back up to three cells by a slow noise it is ragged too
  const EDGE_BITE = `
float edgeBite(vec2 p, vec2 map){ float ed = min(min(p.x, p.y), min(map.x - p.x, map.y - p.y));
  return 0.7 * (1.0 - smoothstep(0.0, 24.0, ed - 64.0 - 96.0 * fbm(p / 56.0 + 4.2))); }
`;
  // the magma caves' lava (TASKS 403), drawn after the crops of ref_cave_lava, not the fire depths' (LAVA): liquid red-orange
  // (#fc3c0c, #fc540c) split into plates 12–20 art px across by a net of thin yellow seams, the plates hotter at their seams, a
  // few darker in their middle and flecked dark red; a yellow lip against the bank. A river's plates drift down its flow; a lake
  // lies still, its seams breathing, dark cooling plates here and there, bubbles swelling and bursting into drops. The walkable
  // crust (TASKS 401) is black glass split by dull red seams; under a weight they widen and go yellow, flashing as it gives.
  // Same uniforms and modes as LAVA; on the art grid
  const MLAVA = EDGE_BITE + `
uniform sampler2D u_mask, u_seen, u_crust, u_face, u_occ; uniform vec4 u_box; uniform vec2 u_map; uniform float u_mode, u_scorch; uniform vec4 u_melt[8];
vec3 vor(vec2 p, float wob){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), o = vec2(hash(i + g), hash(i + g + 7.7));
    o = 0.5 + 0.4 * sin(wob + 6.2831 * o); float dd = length(g + o - f);
    if (dd < d1) { d2 = d1; d1 = dd; id = hash(i + g + 3.3); } else if (dd < d2) d2 = dd; }
  return vec3(d1, d2, id); }
float mAt(vec2 p){ return textureLod(u_mask, p / u_map, 0.0).r - edgeBite(p, u_map); }
void main(){ vec2 w = floor((u_box.xy + v_uv * u_box.zw) / 2.0) * 2.0 + 1.0;
  float mk = mAt(w), e = mk + (fbm(w / 20.0) - 0.5) * 0.2;
  if (e < 0.2) discard;
  vec2 fc = textureLod(u_face, vec2(w.x / u_map.x, 1.0 - w.y / u_map.y), 0.0).rg;   // the bake's columns stand here (TASKS 418)
  if (fc.r > 0.5) discard;
  float g = length(vec2(mAt(w + vec2(2.0, 0.0)) - mAt(w - vec2(2.0, 0.0)), mAt(w + vec2(0.0, 2.0)) - mAt(w - vec2(0.0, 2.0)))) / 4.0;
  float d = (e - 0.5) / max(g, 0.002), inside = step(0.0, d);
  vec2 fl = (texelFetch(u_mask, ivec2(w / u_map * vec2(textureSize(u_mask, 0))), 0).gb - 0.5) * 2.0;
  float run = step(0.5, length(fl)), still = 1.0 - run;
  vec2 p = w - fl * 9.0 * u_t;
  vec2 wq = vec2(fbm(p / 70.0 + 3.1), fbm(p / 70.0 + 8.7));
  // (TASKS 446, measured on ref_cave_lava: plates 10–14 px, a seam a white-hot thread in yellow then orange, no blue in either;
  // the plates near one orange, a few dark red: the dark of the ref's field is the columns' shadow, not plates; a slow noise
  // dims the seams in patches, so the net is not even)
  vec3 v = vor(p / 13.0 + wq * 2.4, u_t * 0.12);   // (warped harder, TASKS 1047: the seams ran in straight 24–32 px runs)
  float dull = smoothstep(0.38, 0.58, fbm(p / 45.0 + 5.0));
  float seam = (v.y - v.x) * 6.5 * (0.85 + 0.6 * dull) * (0.8 + 2.2 * smoothstep(0.48, 0.62, fbm(p / 26.0 + 1.3))), id = v.z, beat = 0.5 + 0.5 * sin(u_t * 0.9 + id * 6.2831);
  vec3 W1 = vec3(1.0, 0.98, 0.08), Y = vec3(1.0, 0.8, 0.02), YO = vec3(1.0, 0.42, 0.02), O1 = vec3(0.99, 0.24, 0.03), O2 = vec3(0.97, 0.15, 0.02), Rd = vec3(0.5, 0.04, 0.01), Dk = vec3(0.17, 0.018, 0.008);
  vec3 col = id < 0.06 ? Rd : id < 0.55 ? O2 : O1;
  if (still > 0.5 && hash(vec2(id, 4.1)) < 0.07) col = seam > 3.0 ? vec3(0.3, 0.04, 0.015) : col;
  // the concept's field has a large pattern (TASKS 481): slow dark-red backwaters up to ~130 px over a seventh of the lava, their
  // plates cooling to red and black and their net dimmed to orange; lone dark art pixels read as pepper, not as cooling lava
  float pool = step(0.62 + (id - 0.5) * 0.08, fbm(p / 34.0 + 17.0) * 0.75 + vnoise(p / 14.0 + 3.0) * 0.25);   // (≈ 40 px backwaters, TASKS 1038, 1047: they lay as blots mid-lake)
  if (pool > 0.5) col = hash(vec2(id, 9.3)) < 0.45 ? Dk : Rd;
  // (the seams 3–4 px with a thin lemon core, TASKS 1038, 1047: a cream thread washed the lava's colour out, 44 against 82)
  float core = step(seam, 0.15 + 0.1 * beat) * (1.0 - pool);
  col = seam < 0.15 + 0.1 * beat ? (pool > 0.5 ? YO : vec3(1.35, 1.35, 0.5)) : seam < 0.75 + 0.2 * beat ? (pool > 0.5 ? O1 : Y) : seam < 1.4 ? (pool > 0.5 ? mix(col, O2, 0.5) : YO) : seam < 2.3 && pool < 0.5 ? mix(col, O1, 0.5) : col;
  col = d < 2.0 ? vec3(1.0, 0.92, 0.3) : d < 5.0 ? YO : col;
  // at a column's foot: a hot line where it meets the lava, then its shadow, the lava dark red and cooling
  // past a short shadow the lava round a column's foot glows (TASKS 481: the concept's columns stand in a bright halo)
  col = fc.g > 0.84 ? Y : fc.g > 0.62 ? mix(col, Dk * 0.8, 0.7) : fc.g > 0.0 ? mix(col, Y, 0.75 * smoothstep(0.0, 0.62, fc.g) * (1.0 - pool)) : col;
  // a lake's bubbles: one in some cells of a 48 px grid, swelling to a dome with a hot rim, bursting in a ring and a spray of drops
  if (still > 0.5 && d > 12.0) { vec2 gc = floor(w / 48.0), c = (gc + 0.25 + 0.5 * vec2(hash(gc + 1.3), hash(gc + 2.9))) * 48.0; float hb = hash(gc + 0.7);
    if (hb < 0.45) { float P = 2.6 + 3.0 * hash(gc + 5.1), a = fract(u_t / P + hb * 7.0), r = length((w - c) * vec2(1.0, 1.4));
      if (a < 0.32) { float rr = 3.0 + 10.0 * a / 0.32; if (r < rr) col = r > rr - 2.0 ? Y : r < rr * 0.4 ? YO : Dk; }
      else if (a < 0.44) { float rr = 10.0 + 14.0 * (a - 0.32) / 0.12; if (abs(r - rr) < 1.5) col = mix(Y, YO, (a - 0.32) / 0.12); }
      if (a > 0.32 && a < 0.62) for (int j = 0; j < 5; j++) { float k = float(j), an = 6.2831 * hash(vec2(k, hb)), s = (a - 0.32) / 0.3;
        vec2 dp = c + vec2(cos(an), 0.6 * sin(an)) * (6.0 + 16.0 * s) - vec2(0.0, sin(s * 3.14159) * (10.0 + 10.0 * hash(vec2(hb, k))));
        if (abs(w.x - dp.x) < 1.5 && abs(w.y - dp.y) < 1.5) col = Y; } } }
  // the crust (TASKS 419): the flat tops of sunken basalt columns, as the ref's ways across the lava are, packed hexagons with a lit
  // upper rim, a dark lower one and dull red seams between; a weight widens the seams and turns them yellow, flashing as it gives;
  // then it melts. Only its seams glow; the light lights its tops, so it reads as rock, not as a grey film over the lava
  float cm = texture(u_crust, w / u_map).r, seamC = 0.0, crustOn = 0.0;
  if (cm > 0.3) { float ck = 0.0, mt = 0.0; crustOn = 1.0;
    for (int i = 0; i < 8; i++) { vec2 q = abs(w - u_melt[i].xy); float c = step(q.x, 18.0) * step(q.y, 18.0); ck = max(ck, c * u_melt[i].z); mt = max(mt, c * u_melt[i].w); }
    // (TASKS 490: an even honeycomb, the same kerb all round every bank) the net is warped by a slow noise, so the plates vary in
    // size and lean, and toward the crust's edge some are gone, the lava showing between those left
    vec2 hp = (vec2(w.x, w.y * 1.4) + (vec2(fbm(w / 46.0 + 3.7), fbm(w / 46.0 + 9.2)) - 0.5) * 12.0) / 17.0, hs = vec2(1.0, 1.7320508), ha = mod(hp, hs) - hs * 0.5, hb = mod(hp - hs * 0.5, hs) - hs * 0.5;
    vec2 gv = dot(ha, ha) < dot(hb, hb) ? ha : hb, hid = hp - gv; float hd = max(dot(abs(gv), vec2(0.5, 0.8660254)), abs(gv.x));
    // (thin crust, TASKS 476: its seams glow from the start, a way to cross quickly)
    float thin = step(0.75, texelFetch(u_crust, ivec2(w / u_map * vec2(textureSize(u_crust, 0))), 0).g), warn = max(smoothstep(0.35, 1.0, ck), 0.45 * thin), flash = step(0.5, fract(u_t * 5.0)) * step(0.75, ck);
    vec3 cc = vec3(0.22, 0.2, 0.24) * (0.6 + 0.65 * hash(hid)) + vec3(0.25, 0.05, 0.02) * warn;
    if (hd > 0.4) cc = gv.y < 0.0 && gv.x < 0.25 ? vec3(0.36, 0.33, 0.36) : vec3(0.04, 0.032, 0.036);
    if (hd > 0.47 - 0.08 * warn) { cc = mix(vec3(0.5, 0.09, 0.03), mix(YO, Y, flash), warn); seamC = 1.0; }
    if (cm < 0.38) { cc = vec3(0.02, 0.016, 0.02); seamC = 0.0; }
    if (thin < 0.5 && hash(hid + 4.1) < 0.4 * (1.0 - smoothstep(0.4, 0.5, cm))) mt = 1.0;
    col = mix(cc, col, mt); seamC = max(seamC, mt); crustOn = 1.0 - mt; }
  // the glow over the lit frame is an even haze with no seams in it: it is added over whoever stands in front of the lava too,
  // and its pattern laid over the hero read as the lava showing through him
  if (u_mode < 0.5) o = vec4(col * inside * 0.7, inside);
  else if (u_mode < 1.5) o = vec4(vec3(1.0, 0.36, 0.08) * 0.16 * smoothstep(0.0, 10.0, d) * (1.0 - crustOn) * texture(u_seen, w / u_map).r * (1.0 - texture(u_occ, scr(v_px)).a), 0.0);
  // a crust plate's top keeps most of its own dark neutral stone through the light (TASKS 448: lit by the lava round it, it came out tan)
  else if (crustOn > 0.5 && seamC < 0.5) o = vec4(col * 0.3 * 0.75, 0.75);
  // (the seams' lemon core is the lava's own glow: lit by its orange light it could not come out lemon, TASKS 1047)
  else o = vec4(col * inside * 0.56 * (1.0 + 1.4 * core * smoothstep(0.75, 1.0, texture(u_seen, w / u_map).r)), inside); }`;   // (the core's boost dies with the fog, TASKS 1056: it sparkled along every fog edge)
  // the fog of war and the rock deep past the walls are one dark stone seen far below, drifting slower than the camera: cracked
  // plates, veins faintly glowing in the biome's colour, a few motes. An unexplored room reads as that same stone, so the fog
  // gives nothing of the layout away. On the world's 2 px grid
  // shallow water as the accepted cave reference shows it (TASKS 230, study/refs/ref_cave_water.png): dark teal, nearly opaque,
  // the bank ragged on the art grid, pale streaks and ripples carried down the flow, flecks of foam along the banks, the fires
  // above broken into its ripples; a dark wet rim on the stone round it
  const WATER = `
uniform sampler2D u_mask, u_deep; uniform vec4 u_box, u_room; uniform vec2 u_map; uniform vec3 u_col;
uniform vec4 u_fire[8]; uniform vec3 u_fireCol[8];
void main(){ vec2 w = floor((u_box.xy + v_uv * u_box.zw) / 2.0) * 2.0 + 1.0;
  if (w.x < u_room.x || w.y < u_room.y || w.x >= u_room.z || w.y >= u_room.w) discard;
  float mk = texture(u_mask, w / u_map).r;
  if (mk < 0.04) discard;
  vec2 flow = texelFetch(u_mask, ivec2(floor(w / 32.0)) * 4 + 2, 0).gb * 2.0 - 1.0;
  if (length(flow) < 0.1) flow = vec2(0.0, 1.0);
  flow = normalize(flow);
  vec2 p = w - flow * u_t * 26.0, q = vec2(dot(p, vec2(-flow.y, flow.x)), dot(p, flow));
  float e = mk + (vnoise(w / 6.0) - 0.5) * 0.32;
  float d = (e - 0.5) * 32.0, inside = step(0.0, d);
  float bank = (1.0 - smoothstep(0.0, 5.0, d)) * inside, depth = smoothstep(2.0, 14.0, d);
  float streak = step(0.8, vnoise(vec2(q.x / 2.5, q.y / 16.0))) * step(0.45, vnoise(p / 23.0));
  float rip = step(0.78, sin(q.y * 0.32 + vnoise(p / 12.0) * 5.0)) * step(0.55, vnoise(p / vec2(9.0, 20.0)));
  float foam = bank * step(0.6, vnoise(p / 4.0 + 3.0));
  vec3 reflection = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec2 r0 = w - u_fire[i].xy - vec2(sin(q.y * 0.2 + hash(u_fire[i].xy) * 6.283) * 4.0, 48.0);
    reflection += u_fireCol[i] * exp(-r0.x * r0.x / 160.0 - r0.y * r0.y / 2400.0) * u_fire[i].w * rip;
  }
  vec3 deep = u_col * 0.7 + vec3(0.02, 0.06, 0.065), shallow = u_col + vec3(0.05, 0.12, 0.12);
  vec3 col = mix(shallow, deep, depth) + vec3(0.09, 0.15, 0.14) * rip + vec3(0.16, 0.22, 0.2) * streak;
  col = mix(col, vec3(0.32, 0.38, 0.35), foam * 0.8) + reflection * 0.5;
  // deep water past the shallows: darker, opaque, the bottom gone (a cave's has its own shader, CAVE_WATER)
  float dp = smoothstep(0.35, 0.75, texture(u_deep, w / u_map).r);
  col = mix(col, u_col * 0.55 + vec3(0.0, 0.035, 0.04) + vec3(0.05, 0.08, 0.08) * rip, dp);
  float wet = smoothstep(-10.0, -1.0, d) * (1.0 - inside), a = inside * mix(mix(0.8, 0.93, depth), 0.98, dp);
  o = vec4(col * a, a + wet * 0.5); }`;
  // a cave's floor map in one pass on the art grid (TASKS 303): natural rock, no masonry. The rock's outline follows the soft mask
  // of the open cells pushed about by noise, so it runs off the cell grid; a top rock shows a low front face (ref.png's flat camera,
  // not the concepts' cliffs) with a pale lip and moss hanging from it; the other rock shows its boulder tops with an ink line and a
  // lit bevel where it faces up or left. By the water: wet pebbles, a low bank face where the floor stands over the water, the
  // pebbled bed under the shallows. waterAt is the pool shader's own bank (WATER), so the two meet
  const CAVE_EDGE = `
uniform sampler2D u_open, u_water; uniform vec2 u_map; uniform float u_wet;
float openAt(vec2 p){ return textureLod(u_open, p / u_map, 0.0).r + (fbm(p / 40.0) - 0.5) * 0.7 + (vnoise(p / 7.0) - 0.5) * 0.12; }
bool isOpen(vec2 p){ return openAt(p) > 0.47; }
float waterAt(vec2 p){ return u_wet * (textureLod(u_water, p / u_map, 0.0).r + (vnoise(p / 6.0) - 0.5) * 0.32); }
float faceH(float x){ return 26.0 + 14.0 * vnoise(vec2(x / 31.0, 3.0)); }
`;
  const CAVE = CAVE_EDGE + `
uniform sampler2D u_floor, u_wall, u_top, u_shore; uniform float u_lift;
vec3 tx(sampler2D s, vec2 p){ return textureLod(s, p / 256.0, 0.0).rgb; }
vec3 ramp(vec3 c, vec3 lo, vec3 mid, vec3 hi){ float t = clamp((dot(c, vec3(0.3, 0.55, 0.15)) - 0.08) / 0.37, 0.0, 1.0); return t < 0.5 ? mix(lo, mid, t * 2.0) : mix(mid, hi, t * 2.0 - 1.0); }
vec3 gFloor(vec2 p){
  vec3 gravel = ramp(tx(u_floor, p * 2.6), vec3(0.14, 0.1, 0.072), vec3(0.46, 0.32, 0.23), vec3(0.72, 0.56, 0.42));
  vec3 earth = mix(vec3(0.3, 0.19, 0.135), vec3(0.58, 0.39, 0.27), vnoise(p / 3.0));
  return mix(earth, gravel, smoothstep(0.28, 0.64, fbm(p / 19.0)));
}
vec3 gWall(vec2 p){ return ramp(tx(u_wall, vec2(p.x * 1.3, p.y * 0.5)), vec3(0.035, 0.035, 0.033), vec3(0.25, 0.245, 0.235), vec3(0.49, 0.475, 0.45)) * (0.74 + 0.5 * vnoise(vec2(p.x / 5.0, p.y / 48.0))); }
vec3 gTop(vec2 p){ return ramp(tx(u_top, p), vec3(0.016, 0.016, 0.014), vec3(0.1, 0.095, 0.082), vec3(0.24, 0.215, 0.18)); }
vec3 moss(vec2 p){ float n = vnoise(p / 3.0); return n < 0.4 ? vec3(0.08, 0.18, 0.14) : n < 0.75 ? vec3(0.13, 0.25, 0.15) : vec3(0.24, 0.34, 0.18); }
void main(){ vec2 w = floor(v_px / 2.0) * 2.0 + 1.0; float op = openAt(w); vec3 col;
  if (op > 0.47) {
    vec3 sh = tx(u_shore, w + 37.0); float wa = waterAt(w);
    col = gFloor(w) * (0.86 + 0.28 * fbm(w / 170.0));
    col = mix(col, sh * 0.9, smoothstep(0.14, 0.44, wa));
    if (wa > 0.5) col = sh * vec3(0.4, 0.5, 0.56);
    else { float hl = 10.0 + 5.0 * vnoise(vec2(w.x / 23.0, 9.0)), ld = 99.0;
      for (int k = 1; k <= 8; k++) { float d = float(k) * 2.0; if (d > hl) break; if (waterAt(w + vec2(0.0, d)) > 0.5) { ld = d; break; } }
      if (ld < 99.0) { float h = ld / hl; col = mix(sh, gWall(w), 0.55) * (0.42 + 0.4 * h);
        if (hl - ld < 2.5) col = col * 1.45 + 0.05;
        if (ld < 2.5) col *= 0.55;
        if (step(0.5, vnoise(vec2(w.x / 5.0, 2.0))) * step(hl - ld, 2.0 + 8.0 * hash(vec2(floor(w.x / 2.0), 4.0))) > 0.5) col = moss(w); } }
    float ao = smoothstep(0.47, 0.9, op), under = 0.0;
    for (int k = 1; k <= 6; k++) if (!isOpen(w - vec2(0.0, float(k) * 2.0))) { under = 1.0 - float(k) / 7.0; break; }
    col *= (0.6 + 0.4 * ao) * (1.0 - 0.5 * under);
    float m = (1.0 - smoothstep(0.47, 0.6, op)) * step(0.56, fbm(w / 13.0 + 5.0)) * step(wa, 0.3);
    if (m > 0.5) col = moss(w) * (0.75 + 0.25 * ao);
  } else {
    float hf = faceH(w.x), fd = 99.0;
    for (int k = 1; k <= 20; k++) { float d = float(k) * 2.0; if (d > hf) break; if (isOpen(w + vec2(0.0, d))) { fd = d; break; } }
    if (fd < 99.0) { float h = fd / hf; col = gWall(w) * (0.58 + 0.6 * h * h);
      if (hf - fd < 2.5) col = col * 1.5 + 0.05;
      if (fd < 2.5) col *= 0.45;
      float drip = step(0.5, vnoise(vec2(w.x / 13.0, 5.0))) * (3.0 + 18.0 * hash(vec2(floor(w.x / 2.0), 1.0)) * step(0.5, vnoise(vec2(w.x / 5.0, 8.0))));
      if (hf - fd < drip) col = moss(w) * (0.6 + 0.4 * h);
      if (waterAt(w + vec2(0.0, fd + 2.0)) > 0.5) col *= mix(vec3(0.6, 0.72, 0.78), vec3(1.0), smoothstep(0.0, 14.0, fd)); }
    else { col = gTop(w + 91.0) * u_lift;
      if (isOpen(w - vec2(2.0, 0.0)) || isOpen(w + vec2(2.0, 0.0)) || isOpen(w - vec2(0.0, 2.0))) col = vec3(0.024, 0.02, 0.026);
      else if (isOpen(w - vec2(4.0, 0.0)) || isOpen(w - vec2(0.0, 4.0))) col = col * 1.6 + 0.04; } }
  o = vec4(col, 1.0); }`;
  // the magma caves' floor map (TASKS 402), the cave bake's way on the art grid: plateaus of ash and basalt over the lava and the
  // chasm. Only the top rows are a rock wall (u_cliff), with the cave's face and column tops; every other rock is the chasm, darkness
  // with the lava's glow coming up from below, not a rock top. Soot and ash gather by the edges, the ground cracks hot by the lava.
  // A plateau's edge is a row of basalt columns as in ref_cave_lava (TASKS 418): round tops along its south and north edges, and
  // under the south ones their faces, 20–32 px, standing on the lava or running down into the chasm. A face covers the lava below
  // the edge (where the hero can't go), never the plateau, the crust or a crossing, and leaves a narrow river most of its width.
  // u_out 1 writes the columns' mask for the lava shader (R: a column, G: the lava at a face's foot, B: how far the lava's light is held off it: a cap's all, a face's but its foot). lavaAt is the lava shader's
  // own bank (LAVA), so the two meet
  const MAGMA_EDGE = CAVE_EDGE + `
uniform sampler2D u_cliff, u_lava;
float lavaAt(vec2 p){ return textureLod(u_lava, p / u_map, 0.0).r + (fbm(p / 20.0) - 0.5) * 0.2; }
bool isWall(vec2 p){ return textureLod(u_cliff, p / u_map, 0.0).r + (fbm(p / 40.0) - 0.5) * 0.5 > 0.5; }
// a lavafall's face (TASKS 452), u_fall: (x, its foot, half its width, the face's height): as tall as the rock over it leaves room
// for, back down to the plain face over 26 px either side, raggedly
uniform vec4 u_fall[6];
float faceHF(vec2 p){ float h = faceH(p.x);
  for (int i = 0; i < 6; i++) { vec4 f = u_fall[i]; if (f.w <= 0.0 || p.y < f.y - f.w - 12.0 || p.y > f.y + 12.0) continue;
    float d = abs(p.x - f.x) - f.z - 6.0 * vnoise(vec2(p.x / 4.0, f.x)); h = max(h, mix(f.w, h, smoothstep(0.0, 26.0, d))); }
  return h; }
`;
  const MAGMA = EDGE_BITE + MAGMA_EDGE + `
uniform sampler2D u_floor, u_wall, u_top, u_shore, u_far, u_hot, u_crust, u_plat, u_lake, u_stepm; uniform float u_lift, u_out, u_fk, u_step; uniform vec4 u_rows[8];
vec3 tx(sampler2D s, vec2 p){ return textureLod(s, p / 256.0, 0.0).rgb; }
float lum(vec3 c){ return clamp((dot(c, vec3(0.3, 0.55, 0.15)) - 0.04) / 0.4, 0.0, 1.0); }
// each generated texture's own black point and range (421), so the ramps keep the tone and spread 402 set them to
float lumN(vec3 c, float lo, float span){ return clamp((dot(c, vec3(0.3, 0.55, 0.15)) - lo) / span, 0.0, 1.0); }
vec3 ramp(float t, vec3 lo, vec3 mid, vec3 hi){ return t < 0.5 ? mix(lo, mid, t * 2.0) : mix(mid, hi, t * 2.0 - 1.0); }
bool isLow(vec2 p){ return (!isOpen(p) && !isWall(p)) || lavaAt(p) > 0.5; }
vec3 gFloor(vec2 p){ vec3 a = tx(u_floor, p); float t = lumN(a, 0.031, 0.55);
  return ramp(t, vec3(0.05, 0.047, 0.048), vec3(0.2, 0.188, 0.183), vec3(0.42, 0.395, 0.38)) * (0.86 + 0.28 * fbm(p / 150.0)) * u_fk; }
vec3 gCol(vec2 p){ return ramp(lumN(tx(u_wall, vec2(p.x * 1.4, p.y * 0.55)), 0.038, 0.28), vec3(0.022, 0.021, 0.022), vec3(0.15, 0.143, 0.14), vec3(0.36, 0.34, 0.33)); }
vec3 gTop(vec2 p){ return ramp(lumN(tx(u_top, p), 0.064, 0.45), vec3(0.012, 0.011, 0.012), vec3(0.075, 0.07, 0.068), vec3(0.19, 0.18, 0.175)); }
vec3 gCrust(vec2 p){ return ramp(lumN(tx(u_shore, p), 0.033, 0.444), vec3(0.03, 0.02, 0.02), vec3(0.11, 0.095, 0.09), vec3(0.26, 0.24, 0.23)); }
const float CW = 30.0;
bool plat(vec2 p){ return isOpen(p) && lavaAt(p) <= 0.5 && textureLod(u_plat, p / u_map, 0.0).r > 0.3; }   // not the sliver the open mask's noise leaves past a lava cell
// what a column may stand over: the open lava (not the crust, not under a crossing) or the chasm
bool drop(vec2 p){ if (isWall(p)) return false; if (!isOpen(p)) return true;
  return textureLod(u_hot, p / u_map, 0.0).r + (fbm(p / 20.0) - 0.5) * 0.2 > 0.5 && textureLod(u_crust, p / u_map, 0.0).r < 0.3; }
bool dropRaw(vec2 p){ return textureLod(u_plat, p / u_map, 0.0).r < 0.5 && textureLod(u_crust, p / u_map, 0.0).r < 0.3 && textureLod(u_cliff, p / u_map, 0.0).r < 0.5; }
// the south-edge column over w's x: (its centre x, its top's centre y, its face's height, 1 over the lava); y 0 when there is none
vec4 column(vec2 w){ float i = floor(w.x / CW), cx = i * CW + CW * 0.5, y0 = w.y + 12.0;
  if (plat(vec2(cx, y0))) return vec4(cx, 0.0, 0.0, 0.0);
  float ey = -1.0;
  for (int k = 1; k <= 92; k++) { if (k > 44 && u_step < 0.5) break; float y = y0 - float(k) * 2.0; if (plat(vec2(cx, y))) { ey = y + 1.0; break; } }
  if (ey < 0.0 || !drop(vec2(cx, ey + 1.0))) return vec4(cx, 0.0, 0.0, 0.0);
  // (a terrace's step, TASKS 475: its faces stand 64–96 px over the lava, and where the rock between two rows was kept, u_stepm,
  // the face runs down to the lower row)
  float stp = u_step * step(0.5, max(textureLod(u_stepm, vec2(cx, ey + 20.0) / u_map, 0.0).r, textureLod(u_stepm, vec2(cx, ey + 36.0) / u_map, 0.0).r)), cap = u_step > 0.5 ? 180.0 : 80.0;
  float run = 0.0; for (int k = 1; k <= 90; k++) { if (float(k) * 2.0 > cap || !dropRaw(vec2(cx, ey + float(k) * 2.0 - 1.0))) break; run = float(k) * 2.0; }
  float lava = step(0.5, lavaAt(vec2(cx, ey + 4.0))), hgt = 40.0 + floor(hash(vec2(i, 3.1)) * 13.0) * 2.0 + (1.0 - lava) * 24.0;
  if (u_step > 0.5) hgt = stp > 0.5 ? 999.0 : 64.0 + floor(hash(vec2(i, 3.1)) * 17.0) * 2.0;
  float h = min(hgt, run - (lava > 0.5 ? 16.0 : stp > 0.5 ? 0.0 : 4.0)); if (h < 8.0) h = 0.0;
  float ty = ey + floor(hash(vec2(i, 5.3)) * 5.0) * 2.0 - 8.0;
  return vec4(cx, ty, h, stp > 0.5 ? 2.0 : step(0.5, lavaAt(vec2(cx, ty + h + 4.0)))); }   // its foot glows only where it stands in the lava; 2: a step's, on the floor
// the north-edge column's top over w's x (the edge's far side shows only the tops)
vec4 northTop(vec2 w){ float i = floor(w.x / CW), cx = i * CW + CW * 0.5;
  if (plat(vec2(cx, w.y - 10.0))) return vec4(cx, 0.0, 0.0, 0.0);
  for (int k = 0; k <= 10; k++) { float y = w.y - 10.0 + float(k) * 2.0; if (plat(vec2(cx, y))) {
    if (!drop(vec2(cx, y - 2.0))) break; return vec4(cx, y + 3.0 + floor(hash(vec2(i, 6.7)) * 2.0) * 2.0, 0.0, 0.0); } }
  return vec4(cx, 0.0, 0.0, 0.0); }
// where w falls on a column (half width hw): 0 off it, 1 its top, 2 its face; f: across, down the face 0..1
float colAt(vec2 w, vec4 c, out vec2 f, float hw){ float xx = w.x - c.x, ex = xx / hw; f = vec2(xx, 0.0);
  if (c.y <= 0.0 || abs(xx) > hw) return 0.0;
  float ry = (w.y - c.y) / 8.0; if (ex * ex + ry * ry < 1.0) return 1.0;
  // (its foot curves as its cap does, TASKS 1038: cut straight, the glow under it ran as ruled bars a column wide)
  if (c.z > 0.0 && w.y > c.y && w.y < c.y + c.z + 8.0 * sqrt(max(0.0, 1.0 - ex * ex))) { f.y = min(1.0, (w.y - c.y) / c.z); return 2.0; }
  return 0.0; }
// a cluster of 3–8 columns standing in a lake or a river (TASKS 447: ref_cave_lava's field reads through its columns, 13–18 % basalt
// against our 0–2), one in most cells of a 96×80 grid, packed close, of a height the cluster shares; each column its own width and
// a few px either way of it (one in seven a head taller), and only
// where the lava under its cap and at its foot is deep: no bank, crust, crossing or source near (u_lake). A cluster may reach over
// its cell's edge, so w looks into the cells round it; the front-most column under w wins; foot: w is in the lava just under one
float island(vec2 w, out vec4 c, out vec2 f, out float foot, out float hwo){ foot = 0.0; hwo = 13.0;
  vec2 G = vec2(96.0, 80.0), g0 = floor(w / G); float on = 0.0, by = -1e9;
  for (int gy = -2; gy <= 0; gy++) for (int gx = -1; gx <= 1; gx++) { vec2 g = g0 + vec2(float(gx), float(gy)); if (hash(g + 11.1) > 0.95 * smoothstep(0.3, 0.6, vnoise(g * 0.45 + 7.0))) continue;   // (in thickets and open reaches)
    vec2 ctr = g * G + vec2(30.0 + 36.0 * hash(g + 2.2), 20.0 + 24.0 * hash(g + 3.3)); float n = 3.0 + floor(hash(g + 4.4) * 6.0), h0 = 24.0 + floor(hash(g + 7.7) * 19.0) * 2.0;
    for (int j = 0; j < 8; j++) { if (float(j) >= n) break; float fj = float(j), hw = 15.0 + floor(hash(g + fj * 4.7 + 9.1) * 8.0);   // (30–44 px wide as the concept's, TASKS 481)
      float h = max(14.0, h0 + floor((hash(g + fj * 3.1) - 0.5) * 16.0) * 2.0 + (hash(g + fj * 5.3 + 1.9) < 0.15 ? 30.0 : 0.0));
      vec4 cj = vec4(floor((ctr.x + (hash(g + fj * 1.7 + 5.5) - 0.5) * 46.0) / 2.0) * 2.0 + 1.0, floor((ctr.y + (hash(g + fj * 2.3 + 6.6) - 0.5) * 22.0) / 2.0) * 2.0 + 1.0, h, 1.0);
      if (abs(w.x - cj.x) > hw || w.y < cj.y - 10.0 || w.y > cj.y + h + 14.0) continue;
      if (textureLod(u_lake, cj.xy / u_map, 0.0).r < 0.5 || textureLod(u_lake, vec2(cj.x, cj.y + h) / u_map, 0.0).r < 0.5) continue;
      vec2 ff; float k = colAt(w, cj, ff, hw);
      if (k > 0.5 && cj.y + cj.z > by) { by = cj.y + cj.z; on = k; c = cj; f = ff; hwo = hw; }
      { float fx = (w.x - cj.x) / (hw + 7.0), fy = (w.y - cj.y - cj.z) / 13.0, rr = sqrt(fx * fx + fy * fy); if (k < 0.5 && rr < 1.0) foot = max(foot, clamp((1.0 - rr) * 1.6, 0.0, 1.0)); } } }
  return on; }
// columns standing up out of the dark under a plateau's edge over the chasm (TASKS 447; fidelity r1 p. 9: ref_cave_lava's edges have
// tops 30–100 px down in the chasm, their faces fading into the dark): two rows a half column off the edge's own, a few missing,
// their tops 64–130 px under the edge, below the edge's own faces (the second row lower), their faces running down out of sight;
// 1 a top, 2 a face; dim, how deep
float sunk(vec2 w, out vec4 c, out vec2 f, out float dim){ dim = 0.0; float best = 0.0, by = -1e9;
  for (int r = 0; r < 2; r++) { float off = r == 0 ? 15.0 : 0.0, i = floor((w.x - off) / CW), cx = i * CW + off + CW * 0.5;
    if (hash(vec2(i, 8.1 + float(r))) < 0.3) continue;
    float ey = -1.0; for (int k = 1; k <= 100; k++) { float y = w.y - float(k) * 2.0; if (plat(vec2(cx, y))) { ey = y + 1.0; break; } }
    if (ey < 0.0) continue; vec2 below = vec2(cx, ey + 8.0); if (isOpen(below) || isWall(below) || lavaAt(below) > 0.5) continue;
    float top = ey + 64.0 + floor(hash(vec2(i, 9.3 + float(r))) * 24.0) * 2.0 + float(r) * 20.0, hw = 11.0 + floor(hash(vec2(i, 4.4 + float(r))) * 4.0);
    vec4 cj = vec4(cx, top, 90.0, 0.0); vec2 ff; float k = colAt(w, cj, ff, hw);
    if (k > 0.5 && top > by) { by = top; best = k; c = cj; f = ff; f.x = ff.x / hw * 15.0; dim = smoothstep(64.0, 140.0, top - ey); } }
  return best; }
// where the chasm opens in the lava a rim of basalt stones breaks the lava's edge off into it (TASKS 1059: a black pool behind a
// yellow line, 16 % basalt round it against the concept's 50)
vec3 pitRim(vec2 w, float la, vec3 col){ if (smoothstep(0.02, 0.06, la + (fbm(w / 9.0) - 0.5) * 0.04) < 0.5) return col;
  // (rubble of uneven stones, TASKS 1163: a 6 px grid read as a row of black squares; L p90 11–15 against the reference's 24)
  vec2 p = w / 7.0 + 0.9 * vec2(vnoise(w / 11.0), vnoise(w / 11.0 + 7.3)), id = floor(p), f = fract(p), nid = id, off = vec2(0.0); float d1 = 9.0, d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), c = g + vec2(hash(id + g), hash(id + g + 3.1)) - f; float d = length(c); if (d < d1) { d2 = d1; d1 = d; nid = id + g; off = c; } else if (d < d2) d2 = d; }
  col = gCrust(w + 53.0) * (1.1 + 1.3 * hash(nid)) * (off.y > 0.12 ? 1.5 : off.y < -0.2 ? 0.6 : 1.0);
  return d2 - d1 < 0.1 ? vec3(0.03, 0.022, 0.026) : col; }
vec3 capCol(vec2 w, vec4 c, float hw){ float id = hash(c.xy * 0.37), xx = (w.x - c.x) / hw, yy = (w.y - c.y) / 8.0, r = xx * xx + yy * yy;
  vec3 col = vec3(0.25, 0.23, 0.27) * (0.8 + 0.3 * id) * (0.85 + 0.3 * step(0.5, vnoise(w / 6.0 + id * 9.0)));
  if (r > 0.64) col = yy < 0.2 && xx < 0.4 ? vec3(0.42, 0.39, 0.42) : vec3(0.03, 0.025, 0.03);
  else if (yy > 0.15 && xx > 0.05) col *= 0.72;
  return col; }
// a face: a lit left facet, a duller middle, a dark right and the ink between columns, rough with vertical streaks and a few
// joints; over the lava its lower part glows orange in steps, over the chasm it fades into the dark
vec3 faceCol(vec2 w, vec4 c, vec2 f, float hw){ float id = hash(c.xy * 0.37), xx = f.x / hw, fq = floor(f.y * 7.0) / 7.0;
  float t = xx < -0.82 ? 1.25 : xx < -0.27 ? 1.0 : xx < 0.27 ? 0.72 : xx < 0.82 ? 0.48 : 0.1;
  float streak = vnoise(vec2(w.x / 3.0 + id * 17.0, w.y / 26.0)), grain = step(0.62, vnoise(w / 4.0 + id * 5.0));
  vec3 col = vec3(0.1, 0.092, 0.11) * t * (streak < 0.3 ? 0.55 : streak > 0.72 ? 1.25 : 1.0) * (1.0 + 0.25 * grain) * (1.1 - 0.4 * fq);
  if (hash(vec2(id, floor((w.y - c.y) / 2.0))) < 0.04 && xx < 0.82) col *= 0.3;
  if (c.w > 1.5) col *= 1.0 - 0.35 * smoothstep(0.55, 1.0, fq);   // a step's face stands on the lower row: only its foot is shaded
  // (only its lower two fifths red, brightening to its foot, TASKS 447, 1053: ref_cave_lava's faces stay dark above; a fifth was too little)
  else if (c.w > 0.5) { float g = smoothstep(0.5, 1.0, fq) * (xx < 0.82 ? 1.0 : 0.4) * (streak < 0.3 ? 0.6 : 1.0);
    col = mix(col, mix(vec3(0.38, 0.07, 0.025), vec3(0.95, 0.4, 0.08), smoothstep(0.7, 1.0, fq) * step(xx, 0.5)), g * 0.9); }
  else col *= 1.0 - 0.85 * smoothstep(0.35, 1.0, fq);
  return col; }
void main(){ vec2 w = floor(v_px / 2.0) * 2.0 + 1.0;
  // the columns: the edge's only near a plateau (the floor mask over the few cells above), else a lake's
  float nearP = 0.0; for (int k = 0; k <= 6; k++) nearP = max(nearP, textureLod(u_plat, (w - vec2(0.0, float(k) * 16.0)) / u_map, 0.0).r);
  vec4 c = vec4(0.0); vec2 f = vec2(0.0); float on = 0.0, hw = CW * 0.5, foot = 0.0;
  if (nearP > 0.02) { c = column(w); on = colAt(w, c, f, hw);
    if (on < 0.5) { vec4 n = northTop(w); if (colAt(w, n, f, hw) > 0.5) { c = n; on = 1.0; } }
    if (on < 0.5 && c.y > 0.0 && c.z > 0.0 && c.w > 0.5 && c.w < 1.5 && abs(w.x - c.x) <= hw && w.y >= c.y + c.z) foot = clamp(1.0 - (w.y - c.y - c.z) / 12.0, 0.0, 1.0); }
  else { float hi; on = island(w, c, f, foot, hi); if (on > 0.5) hw = hi; }
  if (u_out > 0.5) { o = vec4(on > 0.5 ? 1.0 : 0.0, on > 0.5 ? 0.0 : foot, on > 1.5 ? 0.9 * (1.0 - smoothstep(0.55, 0.95, f.y)) : on > 0.5 ? 1.0 : 0.0, 1.0); return; }
  float op = openAt(w), la = lavaAt(w), far = textureLod(u_far, w / u_map, 0.0).r; vec3 col; vec4 sc; vec2 sf; float sdim;
  if (op > 0.47 && la <= 0.5) {
    col = gFloor(w); for (int i = 0; i < 8; i++) if (u_rows[i].z > 0.0 && w.y >= u_rows[i].x && w.y < u_rows[i].y) { col *= u_rows[i].z; break; }
    // soot and ash: the ground darkens toward a drop or the lava and greys with ash flecks there
    float edge = 1.0 - smoothstep(0.47, 0.72, op), hotEdge = smoothstep(0.18, 0.5, la), ash = hash(floor(w / 2.0) + 0.37);
    col *= 1.0 - 0.45 * max(edge, hotEdge) * (0.6 + 0.4 * fbm(w / 11.0));
    // (TASKS 457, r421 r2 p. 3.1: dark grit on the slabs too, as the ref's; light ash flecks by the edges)
    if (ash < 0.06) col *= 0.55; else if (ash > 0.99 - 0.06 * max(edge, hotEdge)) col = mix(col, vec3(0.42, 0.4, 0.39), 0.7);
    // cooled crust along the lava's bank
    if (la > 0.3) { col = mix(col, gCrust(w + 53.0), smoothstep(0.3, 0.42, la)); }
    // the ground by the lava cracks hot: thin seams from a noise field's contours, densest at the bank, dull red further off
    float near = smoothstep(0.08, 0.45, far), cr = abs(vnoise(w / 15.0 + 4.0) - 0.5) + 0.025 * (vnoise(w / 3.0) - 0.5);
    if (near > 0.0 && cr < 0.05 * near && step(0.42, fbm(w / 37.0 + 2.0)) > 0.5) col = mix(vec3(0.36, 0.06, 0.02), vec3(1.0, 0.42, 0.07), smoothstep(0.35, 0.95, near) * step(cr, 0.02 * near));
    // a lit lip on a north edge over the drop, and the contact shadow under the back wall
    if (isLow(w - vec2(0.0, 2.0))) col = col * 1.35 + 0.03;
    float under = 0.0;
    for (int k = 1; k <= 6; k++) if (isWall(w - vec2(0.0, float(k) * 2.0))) { under = 1.0 - float(k) / 7.0; break; }
    col *= (0.7 + 0.3 * smoothstep(0.47, 0.9, op)) * (1.0 - 0.5 * under);
  } else if (op > 0.47 && la - edgeBite(w, u_map) > 0.5) col = gCrust(w + 53.0) * 0.6;
  else if (op > 0.47) { float gl = smoothstep(0.05, 0.6, far) * (0.55 + 0.45 * fbm(w / 24.0)) * (1.0 - edgeBite(w, u_map) / 0.7); col = vec3(0.006, 0.005, 0.006) + vec3(0.32, 0.06, 0.015) * gl * gl;
    col = pitRim(w, la, col); }   // (its glow too, TASKS 490: a straight red band ran along the map's edge)   // (the lava the map's edge bit off: the chasm's dark)
  else if (isWall(w)) {
    float hf = faceHF(w), fd = 99.0; bool down = false;
    for (int k = 1; k <= 72; k++) { float d = float(k) * 2.0; if (d > hf) break; vec2 q = w + vec2(0.0, d); if (!isWall(q)) { fd = d; down = !isOpen(q); break; } }
    if (fd < 99.0) { float h = fd / hf; col = gCol(w) * (0.55 + 0.65 * h * h);
      if (hf - fd < 2.5) col = col * 1.5 + 0.04;
      if (fd < 2.5) col *= down ? 0.25 : 0.45;
      if (down) col *= 0.35 + 0.65 * smoothstep(0.0, hf, fd); }
    else { col = gTop(w + 91.0) * u_lift;
      if (!isWall(w - vec2(2.0, 0.0)) || !isWall(w + vec2(2.0, 0.0)) || !isWall(w - vec2(0.0, 2.0))) col = vec3(0.018, 0.016, 0.017);
      else if (!isWall(w - vec2(4.0, 0.0)) || !isWall(w - vec2(0.0, 4.0))) col = col * 1.6 + 0.03; }
  } else if (u_step > 0.5 && textureLod(u_stepm, w / u_map, 0.0).r > 0.5) {
    // a terrace's step (TASKS 475) where no column's face reaches: the rock face between the rows, not the chasm
    col = gCol(w) * (0.4 + 0.3 * fbm(w / 40.0));
  } else if (on < 0.5 && sunk(w, sc, sf, sdim) > 0.5) {
    col = (sf.y > 0.0 ? faceCol(w, sc, sf, 15.0) : capCol(w, sc, 15.0)) * (1.4 - 0.8 * sdim);
  } else {
    // the chasm: darkness, a deep red glow coming up where the lava is
    col = vec3(0.006, 0.005, 0.006);
    float glow = smoothstep(0.05, 0.6, far) * (0.55 + 0.45 * fbm(w / 24.0));
    col += vec3(0.32, 0.06, 0.015) * glow * glow;
    col = pitRim(w, la, col);
  }
  if (on > 1.5) col = faceCol(w, c, f, hw); else if (on > 0.5) col = capCol(w, c, hw);
  o = vec4(col, 1.0); }`;
  // a cave's water (TASKS 304): deep water the style bible's dark teal and nearly opaque, shallows clear over the pebbled bed the
  // bake lays under them, darker as they deepen; foam flecks along the bank, a wet rim on the stone. Streams carry streaks down
  // their flow; lakes and pools lie still (ref v2): only slow swells and a few glints twinkle on them. The fires stand in it as
  // columns broken into bands. The bank is the bake's waterAt (CAVE_EDGE), so the two meet
  const CAVE_WATER = `
uniform sampler2D u_mask, u_deep; uniform vec4 u_box; uniform vec2 u_map; uniform vec4 u_fire[16]; uniform vec3 u_fireCol[16]; uniform float u_emit;
void main(){ vec2 w = floor((u_box.xy + v_uv * u_box.zw) / 2.0) * 2.0 + 1.0;
  float mk = texture(u_mask, w / u_map).r; if (mk < 0.04) discard;
  float d = (mk + (vnoise(w / 6.0) - 0.5) * 0.32 - 0.5) * 32.0; if (d < -12.0) discard;
  float inside = step(0.0, d);
  vec2 fl = texture(u_mask, w / u_map).gb * 2.0 - 1.0; float run = smoothstep(0.1, 0.5, length(fl)); vec2 flow = length(fl) > 0.01 ? normalize(fl) : vec2(0.0, 1.0);
  vec2 p = w - flow * u_t * 30.0, q = vec2(dot(p, vec2(-flow.y, flow.x)), dot(p, flow));
  float dv = texture(u_deep, w / u_map).r + (vnoise(w / 11.0) - 0.5) * 0.25, dp = smoothstep(0.2, 0.8, dv), depth = smoothstep(2.0, 16.0, d), edge = smoothstep(0.08, 0.22, dv) * (1.0 - smoothstep(0.32, 0.6, dv));
  float streak = run * step(0.78, vnoise(vec2(q.x / 2.5, q.y / 16.0))) * step(0.45, vnoise(p / 23.0));
  float swell = (1.0 - run) * step(0.87, vnoise(vec2(w.x / 14.0 + u_t * 0.15, w.y / 5.0))) * step(0.5, vnoise(w / 40.0 + u_t * 0.05));
  vec2 gc = floor(w / vec2(24.0, 12.0)), gl = w - (gc + vec2(0.3 + 0.4 * hash(gc + 3.0), 0.5)) * vec2(24.0, 12.0); float gh = hash(gc);
  float glint = step(0.82, gh) * step(0.55, sin(u_t * (0.8 + 1.6 * gh) + gh * 40.0)) * step(abs(gl.y), 1.0) * step(abs(gl.x), 1.0 + 2.0 * hash(gc + 5.0));
  vec3 refl = vec3(0.0); float band = step(0.5, vnoise(vec2(w.x / 5.0 + sin(u_t * 0.7) * 0.6, w.y / 2.5 - u_t * (0.6 + 2.5 * run))));
  for (int i = 0; i < 16; i++) { vec2 r0 = w - u_fire[i].xy - vec2(sin(w.y * 0.25 + u_t * 1.4 + hash(u_fire[i].xy) * 6.283) * (1.5 + 3.0 * run), 44.0);
    refl += u_fireCol[i] * exp(-r0.x * r0.x / 70.0 - r0.y * r0.y / 1400.0) * u_fire[i].w * band; }
  vec3 shallow = vec3(0.09, 0.58, 0.76), deep = vec3(0.07, 0.41, 0.48);
  vec3 col = mix(mix(shallow, shallow * 0.8, depth), deep * (0.85 + 0.15 * vnoise(w / 30.0)), dp) * (1.0 - 0.4 * edge);
  col += vec3(0.12, 0.2, 0.19) * streak + vec3(0.06, 0.1, 0.1) * swell + vec3(0.3, 0.38, 0.36) * glint;
  float fn = vnoise(w / 4.0 + vec2(u_t * 0.25, 0.0) - flow * run * u_t * 3.0), foam = inside * max((1.0 - smoothstep(0.0, 6.0, d)) * step(0.55, fn), (1.0 - smoothstep(0.0, 3.0, d)) * step(0.3, fn));
  col = mix(col, vec3(0.72, 0.87, 0.85), foam * 0.85) + refl * 0.35;
  if (u_emit > 0.5) { float g = (foam * 0.8 + glint) * 0.5; o = vec4(vec3(0.7, 0.92, 0.92) * g * 0.6, g * 0.6); return; }
  float a = max(inside * mix(mix(0.5, 0.8, depth), 0.97, dp), foam * 0.85), wet = (1.0 - inside) * smoothstep(-10.0, -1.0, d);
  o = vec4(col * a, a + wet * 0.2); }`;
  // the serpent's strike zones on the ground (TASKS 324): what a blow will hit, filled from the middle outwards as the wind-up runs
  // out, rim and chevrons brightening to the instant it lands. u_kind 0 a sector or circle (bite, tail), 1 a strip (wave), 2 a fan of
  // u_n rays out to u_arc either side, each as wide as a jet's hit (u_hw)
  const SERP_TELE = `
uniform float u_kind, u_q, u_r, u_arc, u_hw, u_n, u_fade, u_len4; uniform vec2 u_org, u_sz, u_dir; uniform vec4 u_len;
float rayLen(int j){ return j == 0 ? u_len.x : j == 1 ? u_len.y : j == 2 ? u_len.z : j == 3 ? u_len.w : u_len4; }
void main(){ vec2 p = floor(v_uv * u_sz / 2.0) * 2.0 + 1.0 - u_org, nrm = vec2(-u_dir.y, u_dir.x);
  float inside = 0.0, ed = 99.0, front = 0.0, run = 0.0, ray = 1.0, across = 0.0;
  if (u_kind < 0.5) { float r = length(p), an = abs(atan(dot(p, nrm), dot(p, u_dir)));
    inside = step(r, u_r) * step(an, u_arc); ed = min(u_r - r, (u_arc - an) * max(r, 1.0)); front = step(r, u_r * u_q); run = r; }
  else {
    // a jet or the wave hits whoever is within its reach of its path, and its path ends at the first wall: a capsule along each ray
    // out to where the sim's flight stops, its rim rippled like water about the true edge so the area stays what it hits
    float best = -99.0, bestRun = 0.0, wedgeLen = 0.0, an = atan(dot(p, nrm), dot(p, u_dir)), bestAn = 99.0;
    for (int j = 0; j < 5; j++) { if (float(j) > u_n - 0.5) break;
      float aj = u_kind < 1.5 ? 0.0 : (float(j) / (u_n - 1.0) - 0.5) * 2.0 * u_arc, L = rayLen(j);
      vec2 d = vec2(cos(aj) * u_dir.x - sin(aj) * u_dir.y, sin(aj) * u_dir.x + cos(aj) * u_dir.y);
      float al = clamp(dot(p, d), 0.0, L), dist = length(p - d * al), side = dot(p, vec2(-d.y, d.x));
      float wob = (vnoise(vec2(al / 14.0 - u_t * 1.5, sign(side) * 5.0 + float(j) * 11.0)) - 0.5) * 6.0 + (vnoise(vec2(al / 5.0 + u_t * 2.0, float(j) * 7.0 + sign(side))) - 0.5) * 2.0;
      float e = u_hw + wob - dist; if (e > best) { best = e; bestRun = al; across = side / u_hw; }
      if (abs(an - aj) < bestAn) { bestAn = abs(an - aj); wedgeLen = L; } }
    float al = dot(p, u_dir), wedge = u_kind > 1.5 ? step(10.0, al) * step(length(p), wedgeLen) * step(abs(an), u_arc + 0.32) : 0.0;
    ray = step(0.0, best); inside = max(ray, wedge); ed = best; run = bestRun; front = step(run, u_r * u_q); }
  float edge = (u_kind < 0.5 ? inside : ray) * (1.0 - smoothstep(0.0, 4.0, ed));
  float hatch = step(0.5, fract((p.x + p.y) / 12.0));
  float crest = step(0.62, fract((run - u_t * 70.0) / 18.0 - across * across * 0.35 + (vnoise(vec2(run / 9.0, across * 3.0 - u_t)) - 0.5) * 0.5));
  float pulse = 0.85 + 0.15 * sin(u_t * 18.0), ready = smoothstep(0.82, 1.0, u_q);
  float fill = inside * (u_kind > 0.5 ? mix(0.015, 0.1, ray) : 0.07) * (1.0 + 1.5 * front * u_q) * (u_kind < 0.5 ? 0.8 + 0.3 * hatch : 0.75 + 0.6 * crest * ray);
  float a = clamp((fill + edge * (0.5 + 0.4 * u_q)) * pulse + inside * ready * 0.2 * (u_kind > 0.5 ? ray : 1.0), 0.0, 0.8) * u_fade;
  vec3 col = mix(vec3(0.86, 0.26, 0.15), vec3(1.0, 0.8, 0.55), clamp(edge * 0.9 + ready * 0.5 + (u_kind > 0.5 ? crest * ray * front * 0.25 : 0.0), 0.0, 1.0));
  o = vec4(col * a, a); }`;
  // a cave's water source (TASKS 304), drawn round its point u_src. A fall (u_kind 0) runs over the rock's top to the lip of the face
  // the bake laid under it and pours down it into the water: streaks racing down, foam boiling at its foot, spray thrown up, mist
  // drifting off, rings spreading. A breach (1) gushes out of a side wall (u_dir: towards the wall), a spring (2) boils up by it.
  // u_mode 1 is the foam's and the white water's glint, drawn with the emit blend so it shows in the dark
  const CAVE_SRC = CAVE_EDGE + `
uniform vec4 u_box; uniform vec2 u_src, u_dir; uniform float u_kind, u_seed, u_mode;
void main(){ vec2 w = floor((u_box.xy + v_uv * u_box.zw) / 2.0) * 2.0 + 1.0; vec3 col = vec3(0.0); float a = 0.0, glow = 0.0; vec2 base;
  float R = u_kind < 0.5 ? 30.0 : u_kind < 1.5 ? 22.0 : 20.0;
  if (u_kind < 0.5) { float x0 = floor(u_src.x / 2.0) * 2.0 + 1.0, foot = u_src.y + 16.0;
    for (int k = 0; k < 40; k++) { float y = u_src.y - 48.0 + float(k) * 2.0; if (isOpen(vec2(x0, y))) { foot = y; break; } }
    float land = foot + 24.0; for (int k = 0; k < 26; k++) { float y = foot + float(k) * 2.0; if (waterAt(vec2(x0, y)) > 0.5) { land = y; break; } }
    float lip = foot - faceH(x0), dx = w.x - u_src.x, y = w.y, wob = (vnoise(vec2(y / 6.0 - u_t * 3.0, u_seed)) - 0.5) * 3.0;
    float hw = y < lip ? 3.0 + 4.0 * smoothstep(lip - 34.0, lip, y) + (vnoise(vec2(y / 4.0, u_seed + 9.0)) - 0.5) * 3.0 : 9.0 + 4.0 * (y - lip) / max(land - lip, 1.0);
    if (y >= lip - 34.0 && y < land + 2.0 && abs(dx - wob) < hw) {
      if (y < lip - 2.0) { float s = step(0.6, vnoise(vec2(dx / 2.5, (y - u_t * 50.0) / 9.0)));
        col = mix(vec3(0.08, 0.22, 0.25), vec3(0.35, 0.52, 0.52), s); a = 0.9 * smoothstep(lip - 36.0, lip - 22.0, y); glow = 0.15 * s; }
      else if (y < lip + 1.0) { col = vec3(0.7, 0.86, 0.84); a = 0.95; glow = 0.7; }
      else { float s = vnoise(vec2(dx / 2.0, (y - u_t * 160.0) / 12.0));
        col = s > 0.6 ? vec3(0.76, 0.9, 0.88) : s > 0.38 ? vec3(0.36, 0.6, 0.62) : vec3(0.17, 0.4, 0.44);
        if (abs(dx - wob) > hw - 2.0) col *= 0.75;
        a = 0.94; glow = s > 0.6 ? 0.8 : s > 0.38 ? 0.35 : 0.15; } }
    base = vec2(u_src.x, land + 4.0); }
  else { base = u_src - u_dir * (u_kind < 1.5 ? 24.0 : 12.0);
    if (u_kind < 1.5) { vec2 v = w - u_src, side = vec2(-u_dir.y, u_dir.x); float along = -dot(v, u_dir), across = dot(v, side) - along * along * 0.025 * abs(u_dir.x);
      if (along >= -2.0 && along < 24.0 && abs(across) < 5.0 + along * 0.2) { float s = vnoise(vec2(across / 2.0, (along - u_t * 90.0) / 8.0));
        col = s > 0.58 ? vec3(0.76, 0.9, 0.88) : s > 0.36 ? vec3(0.36, 0.6, 0.62) : vec3(0.17, 0.4, 0.44); a = 0.92; glow = s > 0.58 ? 0.8 : 0.3; } } }
  vec2 r = (w - base) * vec2(1.0, 2.0); float rl = length(r);
  if (a < 0.5 && (waterAt(w) > 0.5 || rl < R * 0.45)) {
    float churn = vnoise(w / 3.0 + vec2(0.0, -u_t * 6.0)) * 0.8 + 0.45 - rl / R + (u_kind > 1.5 ? 0.5 * step(0.6, sin(u_t * 7.0 + hash(floor(w / 4.0)) * 20.0)) - 0.25 : 0.0);
    if (churn > 0.35) { col = churn > 0.55 ? vec3(0.66, 0.8, 0.78) : vec3(0.36, 0.5, 0.5); a = 0.85; glow = churn > 0.55 ? 0.45 : 0.15; }
    else if (rl < R * 1.7 && abs(fract(rl / 12.0 - u_t * 0.9 + u_seed) - 0.5) < 0.05) { col = vec3(0.36, 0.5, 0.5); a = 0.6 * (1.0 - rl / (R * 1.7)); glow = 0.3; } }
  for (int j = 0; j < 9; j++) { float k = float(j), h1 = hash(vec2(k, u_seed)), age = fract(u_t * (1.1 + 0.5 * h1) + h1);
    vec2 dp = base + vec2((hash(vec2(k, 3.0 + u_seed)) - 0.5) * R * 1.4 * age, -sin(age * 3.14159) * (5.0 + (u_kind < 0.5 ? 14.0 : 6.0) * hash(vec2(k, 7.0))));
    if (age < 0.9 && abs(w.x - dp.x) < 1.5 && abs(w.y - dp.y) < 1.5) { col = vec3(0.62, 0.78, 0.76); a = 0.9; glow = 0.4; } }
  vec4 pm = vec4(col * a, a);
  if (u_kind < 0.5) { vec2 m = (w - base + vec2(0.0, 8.0)) / vec2(42.0, 24.0); float mi = fbm(w / 9.0 + vec2(u_seed, u_t * 0.8)) * (1.0 - length(m));
    float st = mi > 0.42 ? 0.32 : mi > 0.3 ? 0.2 : mi > 0.2 ? 0.08 : 0.0; pm = vec4(vec3(0.55, 0.68, 0.7) * st, st) + pm * (1.0 - st); }
  if (pm.a <= 0.0) discard;
  o = u_mode > 0.5 ? vec4(col * glow * 0.5 * a, glow * 0.5 * a) : pm; }`;
  // the magma caves' sources (TASKS 403), round u_src. A fall (u_kind 0) runs over the wall's top to the lip of its face and pours
  // down it into the lava: hot streaks racing down, a white-hot lip, a churning foot throwing glowing drops, steam rising off it.
  // A breach (1) wells out at the wall's foot; a vent (2) is a hot mouth in the lava that heaves and spits, smoke curling up from
  // it. u_mode 1: the glow, with the emit blend
  const MAGMA_SRC = MAGMA_EDGE + `
uniform vec4 u_box; uniform vec2 u_src; uniform float u_kind, u_seed, u_mode, u_wide;
vec3 hot(float s){ return s > 0.7 ? vec3(1.0, 0.8, 0.3) : s > 0.45 ? vec3(1.0, 0.46, 0.08) : s > 0.22 ? vec3(0.96, 0.22, 0.04) : vec3(0.62, 0.07, 0.03); }
void main(){ vec2 w = floor((u_box.xy + v_uv * u_box.zw) / 2.0) * 2.0 + 1.0; vec3 col = vec3(0.0); float a = 0.0, glow = 0.0, liquid = 0.0; vec2 base = u_src;
  if (u_kind < 0.5) { float x0 = floor(u_src.x / 2.0) * 2.0 + 1.0, foot = u_src.y;
    for (int k = 0; k < 40; k++) { float y = u_src.y - 60.0 + float(k) * 2.0; if (!isWall(vec2(x0, y))) { foot = y; break; } }
    float land = foot + 8.0; for (int k = 0; k < 30; k++) { float y = foot + float(k) * 2.0; if (lavaAt(vec2(x0, y)) > 0.5) { land = y; break; } }
    float lip = foot - faceHF(vec2(x0, foot - 2.0)), dx = w.x - u_src.x, y = w.y, wob = (vnoise(vec2(y / 7.0 - u_t * 1.5, u_seed)) - 0.5) * 3.0;
    // the pool it pours from on the rock's top (ref_cave_lava: a lake ringed by column tops, not a stream out of the dark): as deep
    // as the rock over the lip goes, up to 48 px, its lava drifting to the lip faster as it nears it
    float ph = 0.0; for (int k = 1; k <= 34; k++) { if (!isWall(vec2(x0, lip - float(k) * 2.0))) break; ph = float(k) * 2.0; }
    float pw = max(u_wide + 16.0, 40.0); ph = min(ph - 10.0, min(48.0, pw * 0.75)); vec2 pc = vec2(u_src.x, lip - ph * 0.5 + 2.0);
    vec2 pq = (w - pc) / vec2(pw, max(ph * 0.5, 1.0)); float pr = length(pq) + (vnoise(w / 6.0 + u_seed) - 0.5) * 0.1, rim = 6.0 / min(pw, max(ph * 0.5, 1.0));
    if (ph > 12.0 && y < lip - 1.0 && pr < 1.0 + rim) {
      if (pr < 1.0) { vec2 fp = w - vec2(0.0, u_t * 6.0 * (1.0 + 2.5 * smoothstep(-0.3, 1.0, pq.y)));
        float seam = abs(vnoise(fp / 8.0 + u_seed) - 0.5), s = 0.2 + 0.5 * vnoise(fp / 4.0) + 0.3 * smoothstep(0.2, 1.0, pq.y) - 0.25 * smoothstep(0.7, 1.0, pr) * step(pq.y, 0.3);
        col = seam < 0.035 ? vec3(1.0, 0.86, 0.45) : hot(s); a = 1.0; glow = 1.0; liquid = 1.0; }
      else { col = pq.y < 0.0 && pq.x < 0.3 ? vec3(0.13, 0.115, 0.12) : vec3(0.04, 0.032, 0.034); if (pr < 1.0 + rim * 0.34) { col = vec3(0.62, 0.12, 0.03); glow = 0.5; } a = 1.0; } }
    // column tops ring its far side and stand at either side of the lip, the fall pouring between them
    if (ph > 12.0) for (int j = 0; j < 5; j++) { float fj = float(j), an = 3.14159 * (1.1 + 0.8 * fj / 2.0); vec2 cc = pc + vec2(cos(an) * (pw + 3.0), sin(an) * (ph * 0.5 + 3.0));
      if (j == 1 && pw < 50.0) continue;
      if (j > 2) cc = vec2(u_src.x + (fj < 3.5 ? -1.0 : 1.0) * (u_wide + 9.0), lip - 4.0);
      vec2 cq = (w - floor(cc / 2.0) * 2.0 - 1.0) / vec2(10.0 + 3.0 * hash(vec2(fj, u_seed)), 7.0); float cr = dot(cq, cq);
      if (cr < 1.0) { col = vec3(0.25, 0.23, 0.27) * (0.8 + 0.3 * hash(vec2(fj, u_seed + 3.0))) * (0.85 + 0.3 * step(0.5, vnoise(w / 6.0 + fj * 9.0)));
        if (cr > 0.62) col = cq.y < 0.2 && cq.x < 0.4 ? vec3(0.42, 0.39, 0.42) : vec3(0.03, 0.025, 0.03); else if (cq.y > 0.15 && cq.x > 0.05) col *= 0.72;
        a = 1.0; glow = 0.0; liquid = 0.0; } }
    // the fall down the face: a white-hot lip, the sheet widening a little to its foot, 3–5 runs of white-yellow an art pixel wide
    // racing down it in dashes
    // (its edges ragged and running down with it, TASKS 1038: a ruled curtain, σ 2.6 px against the concept's 11)
    // (widening to its foot, TASKS 1053: it narrowed, 55 → 33 px against 77 → 105)
    float hw0 = u_wide + 16.0 * (y - lip) / max(land - lip, 1.0), sx = dx - wob, hw = hw0 + (vnoise(vec2(sign(sx) * 7.0 + u_seed, (y - u_t * 60.0) / 9.0)) - 0.5) * 14.0 * smoothstep(lip, lip + 12.0, y);
    if (y >= lip - 1.0 && y < land + 4.0 && abs(sx) < hw && (y >= lip + 1.0 || abs(sx) < u_wide)) {
      if (y < lip + 1.0) col = vec3(1.0, 0.92, 0.6);
      else { float s = vnoise(vec2(dx / 2.5, (y - u_t * 70.0) / 14.0)) + 0.1 * (1.0 - abs(sx) / hw) - 0.17;
        col = hot(s); if (abs(sx) > hw - 2.0) col *= 0.6;
        float n = clamp(floor(hw / 7.0), 3.0, 5.0);
        for (int i = 0; i < 5; i++) { float fi = float(i); if (fi >= n) break; float px = ((fi + 0.5) / n - 0.5) * 1.5 * hw + (hash(vec2(fi, u_seed)) - 0.5) * 5.0;
          if (abs(floor(sx / 2.0) - floor(px / 2.0)) < 0.5 && vnoise(vec2(fi * 7.3 + u_seed, (y - u_t * (90.0 + 25.0 * fi)) / 16.0)) > 0.36) col = vec3(1.0, 0.92, 0.5); } }
      a = 1.0; glow = 1.0; liquid = 1.0; }
    base = vec2(u_src.x, land + 6.0); }
  else if (u_kind < 1.5) { base = u_src + vec2(0.0, 10.0); vec2 v = w - u_src; float hw = 7.0 + v.y * 0.25;
    if (v.y > -6.0 && v.y < 18.0 && abs(v.x) < hw) { float s = vnoise(vec2(v.x / 2.5, (v.y - u_t * 40.0) / 7.0)); col = hot(0.2 + 0.7 * s); a = 1.0; glow = 0.4 + 0.6 * s; } }
  // the churning foot or mouth, swelling and spitting (a vent heaves slower and harder)
  vec2 r = (w - base) * vec2(1.0, 1.6); float rl = length(r), R = u_kind > 1.5 ? 14.0 + 4.0 * sin(u_t * 1.3 + u_seed) : u_kind < 0.5 ? u_wide + 10.0 : 16.0;
  if (a < 0.5 && rl < R) { float churn = vnoise(w / 3.0 + vec2(0.0, -u_t * 4.0)) * 0.8 + 0.5 - rl / R + (u_kind > 1.5 ? 0.3 : 0.0);
    if (churn > 0.2) { col = hot(0.3 + churn + (u_kind < 0.5 ? 0.15 : 0.0)); a = 1.0; glow = 0.4 + churn; liquid = u_kind < 0.5 ? 1.0 : 0.0; } }
  // a vent's mouth: a low rim of basalt round it, lit on its top and left
  if (u_kind > 1.5 && rl >= R && rl < R + 6.0 + 2.0 * vnoise(w / 5.0)) { col = (r.y < 0.0 || r.x < -R * 0.5) ? vec3(0.1, 0.085, 0.08) : vec3(0.035, 0.028, 0.026);
    if (rl < R + 2.0) col = vec3(0.7, 0.12, 0.03); a = 1.0; glow = rl < R + 2.0 ? 0.5 : 0.0; }
  float spit = u_kind > 1.5 ? 0.7 : 1.3;
  for (int j = 0; j < 8; j++) { float k = float(j), h1 = hash(vec2(k, u_seed)), age = fract(u_t * spit * (0.6 + 0.5 * h1) + h1);
    vec2 dp = base + vec2((hash(vec2(k, 3.0 + u_seed)) - 0.5) * R * 2.2 * age, -sin(age * 3.14159) * (8.0 + 22.0 * hash(vec2(k, 7.0))));
    if (age < 0.85 && abs(w.x - dp.x) < 1.5 && abs(w.y - dp.y) < 1.5) { col = age < 0.5 ? vec3(1.0, 0.8, 0.3) : vec3(1.0, 0.4, 0.06); a = 1.0; glow = 1.0; } }
  vec4 pm = vec4(col * a, a);
  // steam off a fall's foot, smoke off a vent: puffs rising and spreading, thinning as they go. u_mode 2 draws them over the lit
  // frame: they rise past the wall's top into the dark, which the lit pass would otherwise wipe
  float al = 0.0; vec3 sc = vec3(0.0);
  { float up = base.y - w.y, sp = u_kind > 1.5 ? 1.0 : 1.4, wide = 12.0 + max(up, 0.0) * 0.45, n = fbm(vec2((w.x - base.x) / 9.0, (w.y + u_t * 16.0 * sp) / 11.0) + u_seed);
    float shape = clamp(1.0 - abs(w.x - base.x - sin(up / 25.0 + u_t * 0.4) * 6.0) / wide, 0.0, 1.0), fade = smoothstep(-4.0, 10.0, up) * clamp(1.0 - up / 130.0, 0.0, 1.0);
    float st = (n - 0.36) * 2.4 * shape * fade + 0.12 * shape * fade;
    al = st > 0.3 ? 0.62 : st > 0.16 ? 0.42 : st > 0.06 ? 0.2 : 0.0;
    sc = u_kind > 1.5 ? vec3(0.34, 0.3, 0.29) : vec3(0.78, 0.7, 0.66); }
  if (u_mode < 0.5) { if (pm.a <= 0.0) discard; o = pm; return; }
  // (a fall's lava keeps its own colour as the lava does, not the light's: lit, it came out salmon; the steam leaves it showing)
  if (u_mode > 1.5) { if (liquid > 0.5) al = min(al, 0.24); if (al <= 0.0) discard; o = vec4(sc * al, al); return; }
  if (liquid > 0.5) { o = vec4(col * 0.56, 1.0); return; }
  if (glow <= 0.0) discard; o = vec4(col * glow * 0.6 * a, glow * 0.6 * a); }`;
  // a fountain's jet from the mask's mouth into its basin: a thin twisting pour on the art grid, drops thrown out where it lands,
  // rings spreading in the basin. Box 48 x 64 view px, the mouth at the top, the basin's water at u_fall px; u_wide widens the pour
  // (a cave's fall down a wall face)
  const JET = `
uniform float u_seed, u_fall, u_wide;
void main(){ vec2 p = floor(v_uv * vec2(48.0, 64.0) / 2.0) * 2.0 + 1.0 - vec2(24.0, 0.0); float a = 0.0; vec3 col = vec3(0.0);
  if (p.y < u_fall) { float width = (2.0 + p.y / u_fall * 1.5) * (1.0 + u_wide), curve = 1.5 * sin(p.y * 0.22 - u_t * 9.0 + u_seed);
    if (abs(p.x - curve) < width) { a = 0.85; col = vec3(0.12, 0.24, 0.24) + step(0.45, sin(p.y * 0.8 - u_t * 24.0)) * vec3(0.2, 0.24, 0.2); } }
  vec2 r = (p - vec2(0.0, u_fall + 2.0)) * vec2(1.0, 2.6);
  float ring = abs(fract(length(r) / 14.0 - u_t * 1.4) - 0.5);
  if (length(r) < 26.0 && step(ring, 0.06) > 0.5) { a = max(a, 0.55 * (1.0 - length(r) / 26.0)); col = vec3(0.24, 0.32, 0.3); }
  for (int j = 0; j < 7; j++) { float k = float(j), age = fract(u_t * 1.6 + hash(vec2(k, u_seed)));
    vec2 drop = vec2((hash(vec2(k, 3.0)) - 0.5) * 26.0 * age, u_fall - sin(age * 3.14159) * (5.0 + hash(vec2(k, 7.0)) * 8.0));
    if (length(p - drop) < 1.5 && age < 0.85) { col = vec3(0.4, 0.52, 0.5); a = 0.85; } }
  if (a == 0.0) discard; o = vec4(col * a, a); }`;
  const LIT = `
uniform sampler2D u_src, u_light, u_seen, u_void, u_top, u_veins, u_water, u_heat, u_face, u_occ, u_far; uniform vec2 u_cam, u_map; uniform vec3 u_rock, u_amb, u_low; uniform vec4 u_vein; uniform float u_seam, u_cave, u_haze;
// the abyss is black (TASKS 187): the concept's rock past the masonry is a flat near-black, its veins only in the fire depths, faint,
// and only by the explored masonry and lava (u_veins), so the fog gives nothing of the layout away
vec3 abyss(vec2 p, vec2 w){ vec2 q = p / 150.0; vec3 c = u_rock;
  float near = texture(u_veins, w).r * smoothstep(0.05, 0.3, texture(u_seen, w).r) * u_vein.a;
  float vein = step(0.965, 1.0 - abs(fbm(q * 0.8 + 21.0) * 2.0 - 1.0)), pulse = 0.55 + 0.45 * sin(u_t * 0.6 + fbm(q * 0.5) * 12.0);
  c += u_vein.rgb * vein * pulse * near;
  vec2 g = p / 96.0 + vec2(0.0, u_t * 0.07), cell = floor(g), f = fract(g) - 0.5, j = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
  c += u_vein.rgb * step(length(f - j * 0.7), 0.03) * step(0.8, hash(cell)) * (0.5 + 0.5 * sin(u_t * 1.3 + hash(cell) * 40.0)) * near;
  return c; }
float rimAt(vec2 bq){ float vd = texture(u_void, bq / u_map).r;
  return smoothstep(0.45, 0.55, vd + (fbm(bq / 22.0) * 0.7 + fbm(bq / 9.0) * 0.3 - 0.5) * 1.4 * min(1.0, vd * 2.5)); }
// the air over the magma caves' lava shimmers (TASKS 403): rows of the world over it slip an art pixel aside and back in patches
// drifting upward, only over the open lava (not its banks, where an actor stands sliced by it); the HUD is drawn after this pass
vec2 haze(vec2 px){ if (u_haze < 0.5) return px; vec2 wv = px + u_cam;
  float hz = smoothstep(0.55, 0.9, texture(u_heat, (wv + vec2(0.0, 6.0)) / u_map).r) * (1.0 - textureLod(u_face, vec2(wv.x / u_map.x, 1.0 - wv.y / u_map.y), 0.0).r) * step(0.6, vnoise(vec2(wv.x / 70.0, wv.y / 22.0 + u_t * 0.9)));
  hz *= 1.0 - texture(u_occ, scr(px)).a;
  float row = floor(wv.y / 2.0), sh = floor(sin(row * 0.55 + u_t * 4.0 + vnoise(wv / 40.0) * 5.0) * 1.4 + 0.5);
  return px + vec2(2.0 * sh * hz, 0.0); }
void main(){ vec2 hp = haze(v_px); vec4 src = texture(u_src, scr(hp)); vec3 c = src.rgb, l = texture(u_light, scr(hp)).rgb; float em = clamp(1.0 - src.a, 0.0, 1.0);
  // the rim breaks off into the abyss block by block, as the concept's masonry does: the edge is decided per 14 px wall-top block
  // a cave's rock breaks off per art pixel instead (TASKS 303): no masonry blocks in its outline
  float blk = u_cave > 0.5 ? 2.0 : 14.0;
  vec2 w = (v_px + u_cam) / u_map, wp = floor(v_px / 2.0) * 2.0 + u_cam, bq = floor(wp / blk) * blk + blk * 0.5, pb = wp - bq + blk * 0.5; float vd = rimAt(bq);
  // a block on the stepped edge: one art pixel of pale bevel on its top and left where they face the abyss, a dark one on its
  // bottom and right
  if (vd < 0.5) { float lit = max(step(pb.y, 1.0) * rimAt(bq - vec2(0.0, blk)), step(pb.x, 1.0) * rimAt(bq - vec2(blk, 0.0))),
      dk = max(step(blk - 2.0, pb.y) * rimAt(bq + vec2(0.0, blk)), step(blk - 2.0, pb.x) * rimAt(bq + vec2(blk, 0.0)));
    c = lit > 0.5 ? c * 1.4 + 0.05 : dk > 0.5 ? c * 0.3 : c; }
  // (and sampled through a slow warp of up to half a cell, TASKS 482: the cells' grid still showed as straight runs on long edges)
  vec2 ws = u_haze > 0.5 ? w + (vec2(fbm(wp / 52.0 + 2.9), fbm(wp / 52.0 + 11.3)) - 0.5) * 36.0 / u_map : w;
  float s = texture(u_seen, ws).r * (1.0 - vd) * step(0.0, w.x) * step(w.x, 1.0) * step(0.0, w.y) * step(w.y, 1.0);
  // the magma's fog edge (TASKS 453) is broken by a noise on the art grid: smooth, it ran ruler-straight along the cells' rows
  if (u_haze > 0.5) s = clamp(s + (fbm(wp / 26.0 + 7.3) - 0.5) * 2.2 * s * (1.0 - s), 0.0, 1.0);
  float top = texture(u_top, w).r;
  // wall tops past the first row keep the ambient: no torch shines through a wall; their pale bevels still catch a fire close by
  l = mix(l, min(l, u_amb * 1.3), smoothstep(0.3, 1.0, top) * 0.8 * (1.0 - 0.75 * smoothstep(0.14, 0.3, dot(c, vec3(0.3, 0.5, 0.2)))));
  // the lava lights the columns from below (TASKS 445): the tops stay the dark stone of the concept (the rim and the foot of a face
  // keep the glow); lit like the lava itself they came out tan. The crossings' basalt likewise (TASKS 448, the occluders' alpha)
  // (TASKS 1036: the cold light is the caps' and the crossings' only; a face keeps the lava's warm light, held under a dull ceiling as
  // in 445, so it reads the concept's maroon lit from its foot, not grey)
  vec4 oc = texture(u_occ, scr(v_px)); float fb = textureLod(u_face, vec2(w.x, 1.0 - w.y), 0.0).b, capB = step(0.95, fb);
  if (u_haze > 0.5) l = mix(l, min(l, u_amb * 2.0 + vec3(0.22, 0.07, 0.03)), fb * (1.0 - capB) * 0.85);
  float bas = u_haze * max(capB, oc.a * (1.0 - oc.r));
  // the water throws the light it catches back onto the rock over and beside it (TASKS 305): slow bright ripples on a cave's wet
  // rock and bank within two cells of the water, stronger where the light at the water is. Added, not multiplied: on the dark
  // rock a multiplied glint was lost
  vec3 glint = vec3(0.0);
  if (u_cave > 0.5 && u_haze < 0.5) { vec2 cs = 32.0 / u_map; float near = 0.0;
    for (int i = 0; i < 11; i++) { vec2 o = i < 9 ? vec2(float(i % 3) - 1.0, 0.5 + float(i / 3)) : vec2(float(i) * 2.0 - 19.0, 0.0);
      near = max(near, texture(u_water, w + o * cs).r * (i < 9 ? 1.0 - 0.3 * float(i / 3) : 0.8)); }
    near *= 1.0 - smoothstep(0.2, 0.6, texture(u_water, w).r);
    // ripples thrown on a wall run as broken wavy bands drifting upward
    float band = smoothstep(0.55, 0.95, sin(wp.y / 4.5 + 2.2 * sin(wp.x / 26.0 + u_t * 0.9) + u_t * 1.7)) * smoothstep(0.35, 0.7, fbm(wp / 46.0 + vec2(u_t * 0.12, -u_t * 0.2)));
    glint = vec3(0.3, 0.75, 0.8) * band * near * (0.14 + 0.6 * dot(min(l, vec3(1.2)), vec3(0.33))); }
  if (u_cave > 0.5) l = max(l, mix(u_low, vec3(0.52, 0.49, 0.46), smoothstep(0.1, 0.5, texture(u_water, w).r) * (1.0 - u_haze)));
  // an islet ringed by the magma's lava sums dozens of its lights, and the soft cap clipped their red first: the floor went yellow
  // (TASKS 478). The level is held there with the hue kept, the concept's bank takes only a red rim
  // An actor keeps a little more of it, else it dims by the lava; uncapped, its steel went khaki and its sword lime (TASKS 479)
  // (both by the lava only, TASKS 1035: over the whole map they took the hero's own pool on a dry plateau, L 55 → 45, his steel brown)
  float nearL = u_haze * texture(u_far, w).r;
  nearL = mix(nearL, u_haze * oc.g, oc.r);   // (an actor by its feet: the occluders' green)
  l *= mix(1.0, min(1.0, mix(1.5, 1.8, oc.r) / max(l.r, max(l.g, l.b))), nearL);
  l = 3.2 * tanh(l / 3.2);                                              // soft cap: pools never flatten into one blown-out level
  // a monster before the lava (the occluders' mask over its glow) takes no more of its light than a torch gives: lit to the lava's
  // own level it melted into it, the reference's figures stand dark against it (TASKS 407)
  // (the occluders' mask: an actor is drawn into it white, a crossing's basalt black, TASKS 448: by the lava its tops came out tan)
  l = mix(l, min(l, vec3(1.2, 1.08, 1.0)), oc.r * smoothstep(0.1, 0.6, texture(u_heat, w).r) * u_haze);
  // (in the magma caves the light on an actor is bleached instead, TASKS 479: its own colours stay and the fire is a warm sheen)
  // (a monster's light is bleached everywhere, TASKS 1055: off the lava, boosted, a skeleton went salmon)
  l = max(vec3(0.0), mix(vec3(dot(l, vec3(0.3, 0.5, 0.2))), l, mix(1.6, 0.6, oc.r * max(nearL, oc.b))));   // grey stone takes the fire's colour: the concept's torchlit walls are orange, not grey (TASKS 163)
  // the basalt keeps the concept's cold grey-violet (TASKS 478): a capped warm light turned its neutral art brown, so it takes
  // only the light's level, not its hue
  l = mix(l, vec3(0.96, 0.9, 1.0) * min(dot(l, vec3(0.3, 0.5, 0.2)) * mix(1.5, 0.9, capB), 1.4), bas);   // (the caps darker: L 35 against the concept's 21)
  // the black joints between wall-top blocks smoulder here and there, slowly breathing
  float gap = smoothstep(0.09, 0.03, max(c.r, max(c.g, c.b))) * smoothstep(0.6, 0.95, top), hot = smoothstep(0.4, 0.65, fbm(wp / 70.0 + vec2(0.0, u_t * 0.05)));
  vec3 seam = u_vein.rgb * gap * hot * u_seam * (0.7 + 0.3 * sin(u_t * 0.9 + fbm(wp / 40.0) * 9.0));
  // an actor in the magma caves never comes out greener than both its red and blue (TASKS 1046: the hero's highlights went mint on a
  // dry plateau, the scene all warm); a cool steel keeps its blue
  vec3 lc = c * l + seam + glint; if (u_haze > 0.5 && oc.r > 0.5 && oc.b < 0.5) lc.g = min(lc.g, max(lc.r, lc.b));   // (the hero only, TASKS 1055: a goblin lost its green)
  vec3 lit = mix(lc, c * 1.8, em);
  // (TASKS 1163: dimmed whole into the fog, the lava's yellow kept its ratio and read olive; the reference's edge goes through red)
  if (u_haze > 0.5 && s < 1.0 && lit.r > lit.b) lit.g *= mix(0.35, 1.0, smoothstep(0.1, 0.9, s));
  o = vec4(mix(abyss(floor(v_px / 2.0) * 2.0 + u_cam * 0.55, w), lit, s), 1.0); }`;
  const PORTAL = `
uniform float u_amt;
void main(){ vec2 q = v_uv * 2.0 - 1.0; float r = length(q), a = atan(q.y, q.x);
  float sw = fbm(vec2(a * 2.0 + r * 4.0 - u_t * 2.0, r * 3.0 - u_t)), ring = smoothstep(0.95, 0.7, r) * smoothstep(0.2, 0.7, r + sw * 0.3);
  vec3 c = mix(vec3(0.3, 0.5, 1.0), vec3(0.9, 0.95, 1.0), sw * smoothstep(0.8, 0.2, r)); float al = ring * u_amt; o = vec4(c * al, 0.0); }`;
  SC.REPEAT = ['floor_cv_tex', 'wall_cv_tex', 'walltop_cv_tex', 'shore_cv_tex', 'floor_mg_tex', 'wall_mg_tex', 'walltop_mg_tex', 'shore_mg_tex'];
  let LT = null, BAKE = { key: '', tg: null }, SEEN = { key: '', rec: null, cv: null }, VOID = { key: '', rec: null, cv: null };
  SC.programs = () => {
    // the world renders on a 2×2 view-px grid (the reference's art pixel), every sprite and rotated rig part re-rasterised on it;
    // light, glows and the HUD stay full resolution (HD pixel, styles.md §1)
    views(Z);
    L.glyphs('0123456789+-/:%', { size: 60, fill: ['#fffbe2', '#ffd76a', '#e89a22'] });
    if (window.HUD) HUD.init();
  };
  function views(z) {
    Z = z; VW = W / Z; VH = H / Z;
    // a terrace's surge (TASKS 475): the magma's own lava (TASKS 483: the caves' shader drew it with plates three times the size of
    // the lava round it) over its band, cell by cell (its mask unblurred: a blurred one lay over a bridge's deck as a rounded pill),
    // welling up in patches as u_q rises (a slow noise, the cells by the lava first: the mask's blue), and over the warning's last
    // moments a front running from the lavafall down the band (u_fr against the mask's green, how far a cell is from the fall)
    const SPILL = MLAVA.replace('uniform sampler2D u_mask,', 'uniform float u_q, u_fr; uniform sampler2D u_mask,')
      .replace('float mAt(vec2 p){ return textureLod(u_mask, p / u_map, 0.0).r - edgeBite(p, u_map); }',
        'float mAt(vec2 p){ vec4 M = textureLod(u_mask, p / u_map, 0.0), C = texelFetch(u_mask, ivec2(p / u_map * vec2(textureSize(u_mask, 0))), 0);\n' +
        '  float lv = clamp((fbm(p / 18.0 + vec2(0.0, u_t * 0.25)) - 0.3) / 0.4, 0.0, 1.0) * 0.8 + C.b * 0.2, q = max(u_q, step(C.g + (vnoise(p / 24.0) - 0.5) * 0.12, u_fr));\n' +
        '  return M.r * (1.0 - smoothstep(q - 0.1, q + 0.02, lv)) - edgeBite(p, u_map); }')
      .replace('vec2 fl = (texelFetch(u_mask, ivec2(w / u_map * vec2(textureSize(u_mask, 0))), 0).gb - 0.5) * 2.0;', 'vec2 fl = vec2(0.0);')
      // (no bright bank round it: its band lies along a deck or a ridge by the lava, and the rim drew it as a box)
      .replace('  col = d < 2.0 ? vec3(1.0, 0.92, 0.3) : d < 5.0 ? YO : col;', '')
      // (drawn over the fog of war, it keeps to the explored cells: u_seen, 0 on an unexplored floor's)
      .replace('float d = (e - 0.5) / max(g, 0.002), inside = step(0.0, d);', 'float d = (e - 0.5) / max(g, 0.002), inside = step(0.0, d) * smoothstep(0.1, 0.3, texture(u_seen, w / u_map).r);');
    if (SPILL.split('u_fr').length < 3 || SPILL.includes('vec3(1.0, 0.92, 0.3) : d < 5.0') || !SPILL.includes('vec2 fl = vec2(0.0);') || !SPILL.includes('smoothstep(0.1, 0.3, texture(u_seen')) throw new Error('SPILL: MLAVA changed under its patches');
    L.init(W, H, { spill: SPILL, flame: FLAME, arc: ARC, lit: LIT, portal: PORTAL, lava: LAVA, mlava: MLAVA, pool: WATER, cave: CAVE, magma: MAGMA, magmasrc: MAGMA_SRC, cavewater: CAVE_WATER, cavesrc: CAVE_SRC, serptele: SERP_TELE, jet: JET, whirl: WHIRL, fireball: FIREBALL, blast: BLAST }, { pixel: PIX * Z, view: [VW, VH] });
    if (LT) { G.free(LT.light); G.free(LT.lit); G.free(LT.occ); }
    // occ: the silhouettes of the monsters before the lava, which its glow and shimmer leave out (TASKS 407)
    LT = { light: G.target(W / 2, H / 2, true, { view: [VW, VH] }), lit: G.target(W, H, true, { view: [VW, VH] }), occ: G.target(L.T.comp.w, L.T.comp.h, false, { view: [VW, VH] }) };
  }
  const rnd = L.rnd, SS = L.SS;
  const FALL_DROP = 0.45;
  const zoneAt = (m, x, y) => { for (const r of m.rooms) if (r.zone && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.zone; return m.biome; };
  // the cave's glowing props: where the light sits above the foot (up), its pool's radius and strength, and the colour key of
  // its biome (BIOMES.cave.shroom / gem); a prop away from the cave keeps the fallback colour
  const GLOW = { shroom_a: { up: 22, r: 150, amt: 0.48, col: 'shroom', cap: 15 }, shroom_b: { up: 34, r: 175, amt: 0.55, col: 'shroom', cap: 19 }, crystal_cv: { up: 42, r: 230, amt: 0.9, col: 'gem', cap: 26 },
    // the magma caves' (TASKS 405): a hot fissure in the ground breathing like a mushroom, obsidian holding a steady inner ember
    vent_mg: { up: 6, r: 140, amt: 0.5, col: 'shroom', cap: 10 }, obsidian_mg: { up: -6, r: 150, amt: 0.3, col: 'gem', cap: 3 },
    // (TASKS 488) the forge's coals, the basalt forge has no fire of its own; a nest's charred dead smoulder (d.ember)
    forge_mg: { up: 28, r: 180, amt: 0.65, col: 'shroom', cap: 14 }, ember: { up: 8, r: 110, amt: 0.4, col: 'shroom', cap: 8 } };   // its glow lies round its foot: lit from inside, it read pink
  const glowOf = (d) => {
    const g = GLOW[d.ember ? 'ember' : d.n]; if (!g) return null;
    const s = d.s || 1; return { ...g, up: g.up * s, cap: g.cap * s, r: g.r * (0.8 + 0.2 * s), amt: g.amt * (d.glow || 1) };
  };
  const GLOW_COL = { shroom: [0.28, 0.72, 0.76], gem: [0.32, 0.62, 1.0] };
  const glowBeat = (d, t) => (d.n === 'crystal_cv' || d.n === 'obsidian_mg' ? 0.94 + 0.04 * Math.sin(t * 2.3 + d.x) + 0.02 * Math.sin(t * 7.1 + d.y) : 0.84 + 0.16 * Math.sin(t * 0.9 + (d.x * 0.37 + d.y * 0.11)));
  // a roof drop of m.drips falls for DRIP_FALL s and lands at ph + n·p (audio.js plays the landing from the same schedule)
  // a cave crossing's boards (TASKS 306): pitch, board to board along the way; up, the fire cup's height on a torch post
  const BRIDGE = { pitch: 12, up: 66 }, WET = new WeakMap();
  const DRIP_FALL = 0.38, dripAge = (q, t) => { const a = (t - q.ph) % q.p; return a < 0 ? a + q.p : a; };
  const torchCol = (m, tc) =>D.BIOMES[(tc.r !== undefined && m.rooms[tc.r] && m.rooms[tc.r].zone) || m.biome].torch;

  // a door's leaf fills its two-cell opening; the arch is squashed to the wall's height, its opening as wide as the leaf
  const DOOR = { w: 62, h: 80, fw: 118, fh: 100 };
  // the fires of the standing lights from the foot's middle at their SIZES heights: [dx, up, w, h] (wick tips and the post's basket)
  const STAND = { candlestick: [[0, 59, 9, 15]], candelabra: [[0, 64, 9, 15], [-16, 54, 8, 13], [16, 54, 8, 13]], torch_stand: [[0, 69, 18, 32]] }, CANDLE = [1, 0.7, 0.35];
  // the wick tips of table_candles from its foot's middle, in view px at its SIZES height
  const TABLE_WICKS = [[2, 58], [-4, 52], [8, 52]];
  // door_edge_a (src px; _b is its mirror): k makes its vertical edges as tall as door_leaf; the feet of its far (left) and near
  // (right) ends, the columns of those ends, the lock's spot on the leaf and the slope of its iron bands
  const DEDGE = { k: 80 / 720, far: 746, near: 898, farX: 18, nearX: 18, lock: [118, 468], band: 0.55 };

  Object.assign(SCX, {
    SC, L, M, D, W, H, TILE, SZ, PIX, TRAP_HOLE, TRAP_SPIKE, BAKE, SEEN, VOID, views, rnd, SS, FALL_DROP, zoneAt, GLOW, glowOf, GLOW_COL,
    glowBeat, BRIDGE, WET, DRIP_FALL, dripAge, torchCol, DOOR, STAND, CANDLE, TABLE_WICKS, DEDGE });
  Object.defineProperties(SCX, { Z: { get: () => Z }, VW: { get: () => VW }, VH: { get: () => VH }, LT: { get: () => LT } });
})(typeof window !== 'undefined' ? window : globalThis);
