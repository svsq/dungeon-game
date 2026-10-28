// live/scene.js — the dungeon, drawn. Pure function of t and the sim state.
// Pipeline per frame: baked floor map (floor, wall faces, wall tops, rims, AO; rebaked per floor) → ground decals (stairs, spikes,
// stains, cracks) → Y-sorted band (props, monsters, the rigged hero, loot) → unlit composite; then a light map (ambient per
// biome + flickering torches, braziers, lava, spells, the hero's aura) multiplied in with the fog of war (explored cells) →
// emissive pass (flames, lava, fireballs, slashes, sparks) → bloom + grade → HUD (hud.js).
(function () {
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
uniform sampler2D u_mask, u_seen; uniform vec4 u_box; uniform vec2 u_map; uniform float u_mode;
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
  float heat = clamp(col.r + col.g - 0.5, 0.0, 1.4);
  if (u_mode < 0.5) { float scorch = smoothstep(-10.0, -1.0, d) * (1.0 - inside);
    o = vec4(col * inside * 0.7 + vec3(0.035, 0.02, 0.015) * scorch, max(inside, scorch * 0.7)); }   // its own lights brighten it
  else if (u_mode < 1.5) o = vec4(col * heat * inside * 0.33 * texture(u_seen, w / u_map).r, 0.0);
  else o = vec4(col * inside * 0.56, inside); }`;
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
float openAt(vec2 p){ return texture(u_open, p / u_map).r + (fbm(p / 40.0) - 0.5) * 0.7 + (vnoise(p / 7.0) - 0.5) * 0.12; }
bool isOpen(vec2 p){ return openAt(p) > 0.47; }
float waterAt(vec2 p){ return u_wet * (texture(u_water, p / u_map).r + (vnoise(p / 6.0) - 0.5) * 0.32); }
float faceH(float x){ return 26.0 + 14.0 * vnoise(vec2(x / 31.0, 3.0)); }
`;
  const CAVE = CAVE_EDGE + `
uniform sampler2D u_floor, u_wall, u_top, u_shore; uniform float u_lift;
vec3 tx(sampler2D s, vec2 p){ return textureLod(s, p / 256.0, 0.0).rgb; }
vec3 moss(vec2 p){ float n = vnoise(p / 3.0); return n < 0.4 ? vec3(0.1, 0.25, 0.21) : n < 0.75 ? vec3(0.18, 0.35, 0.17) : vec3(0.31, 0.48, 0.17); }
void main(){ vec2 w = floor(v_px / 2.0) * 2.0 + 1.0; float op = openAt(w); vec3 col;
  if (op > 0.47) {
    vec3 sh = tx(u_shore, w + 37.0); float wa = waterAt(w);
    col = tx(u_floor, w) * (0.86 + 0.28 * fbm(w / 170.0));
    col = mix(col, sh * 0.9, smoothstep(0.14, 0.44, wa));
    if (wa > 0.5) col = sh * vec3(0.4, 0.5, 0.56);
    else if (wa > 0.02) { float hl = 10.0 + 5.0 * vnoise(vec2(w.x / 23.0, 9.0)), ld = 99.0;
      for (int k = 1; k <= 8; k++) { float d = float(k) * 2.0; if (d > hl) break; if (waterAt(w + vec2(0.0, d)) > 0.5) { ld = d; break; } }
      if (ld < 99.0) { float h = ld / hl; col = mix(sh, tx(u_wall, w), 0.55) * (0.42 + 0.4 * h);
        if (hl - ld < 2.5) col = col * 1.45 + 0.05;
        if (ld < 2.5) col *= 0.55;
        if (step(0.62, vnoise(vec2(w.x / 5.0, 2.0))) * step(hl - ld, 2.0 + 6.0 * hash(vec2(floor(w.x / 2.0), 4.0))) > 0.5) col = moss(w); } }
    float ao = smoothstep(0.47, 0.9, op), under = 0.0;
    for (int k = 1; k <= 6; k++) if (!isOpen(w - vec2(0.0, float(k) * 2.0))) { under = 1.0 - float(k) / 7.0; break; }
    col *= (0.6 + 0.4 * ao) * (1.0 - 0.5 * under);
    float m = (1.0 - smoothstep(0.47, 0.6, op)) * step(0.56, fbm(w / 13.0 + 5.0)) * step(wa, 0.3);
    if (m > 0.5) col = moss(w) * (0.75 + 0.25 * ao);
  } else {
    float hf = faceH(w.x), fd = 99.0;
    for (int k = 1; k <= 20; k++) { float d = float(k) * 2.0; if (d > hf) break; if (isOpen(w + vec2(0.0, d))) { fd = d; break; } }
    if (fd < 99.0) { float h = fd / hf; col = tx(u_wall, w) * (0.4 + 0.65 * h * h);
      if (hf - fd < 2.5) col = col * 1.5 + 0.05;
      if (fd < 2.5) col *= 0.45;
      float drip = step(0.55, vnoise(vec2(w.x / 13.0, 5.0))) * (2.0 + 14.0 * hash(vec2(floor(w.x / 2.0), 1.0)) * step(0.5, vnoise(vec2(w.x / 5.0, 8.0))));
      if (hf - fd < drip) col = moss(w) * (0.6 + 0.4 * h);
      if (waterAt(w + vec2(0.0, fd + 2.0)) > 0.5) col *= mix(vec3(0.6, 0.72, 0.78), vec3(1.0), smoothstep(0.0, 14.0, fd)); }
    else { col = tx(u_top, w + 91.0) * u_lift;
      if (isOpen(w - vec2(2.0, 0.0)) || isOpen(w + vec2(2.0, 0.0)) || isOpen(w - vec2(0.0, 2.0))) col = vec3(0.024, 0.02, 0.026);
      else if (isOpen(w - vec2(4.0, 0.0)) || isOpen(w - vec2(0.0, 4.0))) col = col * 1.6 + 0.04; } }
  o = vec4(col, 1.0); }`;
  // a cave's water (TASKS 304): deep water the style bible's dark teal and nearly opaque, shallows clear over the pebbled bed the
  // bake lays under them, darker as they deepen; foam flecks along the bank, a wet rim on the stone. Streams carry streaks down
  // their flow; lakes and pools lie still (ref v2): only slow swells and a few glints twinkle on them. The fires stand in it as
  // columns broken into bands. The bank is the bake's waterAt (CAVE_EDGE), so the two meet
  const CAVE_WATER = `
uniform sampler2D u_mask, u_deep; uniform vec4 u_box; uniform vec2 u_map; uniform vec4 u_fire[16]; uniform vec3 u_fireCol[16];
void main(){ vec2 w = floor((u_box.xy + v_uv * u_box.zw) / 2.0) * 2.0 + 1.0;
  float mk = texture(u_mask, w / u_map).r; if (mk < 0.04) discard;
  float d = (mk + (vnoise(w / 6.0) - 0.5) * 0.32 - 0.5) * 32.0; if (d < -12.0) discard;
  float inside = step(0.0, d);
  vec2 fl = texture(u_mask, w / u_map).gb * 2.0 - 1.0; float run = smoothstep(0.1, 0.5, length(fl)); vec2 flow = length(fl) > 0.01 ? normalize(fl) : vec2(0.0, 1.0);
  vec2 p = w - flow * u_t * 30.0, q = vec2(dot(p, vec2(-flow.y, flow.x)), dot(p, flow));
  float dp = smoothstep(0.2, 0.8, texture(u_deep, w / u_map).r + (vnoise(w / 11.0) - 0.5) * 0.25), depth = smoothstep(2.0, 16.0, d);
  float streak = run * step(0.78, vnoise(vec2(q.x / 2.5, q.y / 16.0))) * step(0.45, vnoise(p / 23.0));
  float swell = (1.0 - run) * step(0.87, vnoise(vec2(w.x / 14.0 + u_t * 0.15, w.y / 5.0))) * step(0.5, vnoise(w / 40.0 + u_t * 0.05));
  vec2 gc = floor(w / vec2(24.0, 12.0)), gl = w - (gc + vec2(0.3 + 0.4 * hash(gc + 3.0), 0.5)) * vec2(24.0, 12.0); float gh = hash(gc);
  float glint = step(0.82, gh) * step(0.55, sin(u_t * (0.8 + 1.6 * gh) + gh * 40.0)) * step(abs(gl.y), 1.0) * step(abs(gl.x), 2.0 + 4.0 * hash(gc + 5.0));
  vec3 refl = vec3(0.0); float band = step(0.5, vnoise(vec2(w.x / 5.0 + sin(u_t * 0.7) * 0.6, w.y / 2.5 - u_t * (0.6 + 2.5 * run))));
  for (int i = 0; i < 16; i++) { vec2 r0 = w - u_fire[i].xy - vec2(sin(w.y * 0.25 + u_t * 1.4 + hash(u_fire[i].xy) * 6.283) * (1.5 + 3.0 * run), 44.0);
    refl += u_fireCol[i] * exp(-r0.x * r0.x / 70.0 - r0.y * r0.y / 1400.0) * u_fire[i].w * band; }
  vec3 shallow = vec3(0.08, 0.24, 0.3), deep = vec3(0.059, 0.165, 0.18);
  vec3 col = mix(mix(shallow, shallow * 0.75, depth), deep * (0.85 + 0.15 * vnoise(w / 30.0)), dp);
  col += vec3(0.12, 0.2, 0.19) * streak + vec3(0.06, 0.1, 0.1) * swell + vec3(0.3, 0.38, 0.36) * glint;
  float foam = inside * (1.0 - smoothstep(0.0, 4.0, d)) * step(0.55, vnoise(w / 4.0 + vec2(u_t * 0.25, 0.0) - flow * run * u_t * 3.0));
  col = mix(col, vec3(0.42, 0.52, 0.5), foam * 0.85) + refl * 0.35;
  float a = max(inside * mix(mix(0.42, 0.72, depth), 0.96, dp), foam * 0.85), wet = (1.0 - inside) * smoothstep(-10.0, -1.0, d);
  o = vec4(col * a, a + wet * 0.2); }`;
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
uniform sampler2D u_src, u_light, u_seen, u_void, u_top, u_veins, u_water; uniform vec2 u_cam, u_map; uniform vec3 u_rock, u_amb; uniform vec4 u_vein; uniform float u_seam, u_cave;
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
void main(){ vec4 src = texture(u_src, scr(v_px)); vec3 c = src.rgb, l = texture(u_light, scr(v_px)).rgb; float em = clamp(1.0 - src.a, 0.0, 1.0);
  // the rim breaks off into the abyss block by block, as the concept's masonry does: the edge is decided per 14 px wall-top block
  // a cave's rock breaks off per art pixel instead (TASKS 303): no masonry blocks in its outline
  float blk = u_cave > 0.5 ? 2.0 : 14.0;
  vec2 w = (v_px + u_cam) / u_map, wp = floor(v_px / 2.0) * 2.0 + u_cam, bq = floor(wp / blk) * blk + blk * 0.5, pb = wp - bq + blk * 0.5; float vd = rimAt(bq);
  // a block on the stepped edge: one art pixel of pale bevel on its top and left where they face the abyss, a dark one on its
  // bottom and right
  if (vd < 0.5) { float lit = max(step(pb.y, 1.0) * rimAt(bq - vec2(0.0, blk)), step(pb.x, 1.0) * rimAt(bq - vec2(blk, 0.0))),
      dk = max(step(blk - 2.0, pb.y) * rimAt(bq + vec2(0.0, blk)), step(blk - 2.0, pb.x) * rimAt(bq + vec2(blk, 0.0)));
    c = lit > 0.5 ? c * 1.4 + 0.05 : dk > 0.5 ? c * 0.3 : c; }
  float s = texture(u_seen, w).r * (1.0 - vd) * step(0.0, w.x) * step(w.x, 1.0) * step(0.0, w.y) * step(w.y, 1.0);
  float top = texture(u_top, w).r;
  // wall tops past the first row keep the ambient: no torch shines through a wall; their pale bevels still catch a fire close by
  l = mix(l, min(l, u_amb * 1.3), smoothstep(0.3, 1.0, top) * 0.8 * (1.0 - 0.75 * smoothstep(0.14, 0.3, dot(c, vec3(0.3, 0.5, 0.2)))));
  // the water throws the light it catches back onto the rock over and beside it (TASKS 305): slow bright ripples on a cave's wet
  // rock and bank within two cells of the water, stronger where the light at the water is. Added, not multiplied: on the dark
  // rock a multiplied glint was lost
  vec3 glint = vec3(0.0);
  if (u_cave > 0.5) { vec2 cs = 32.0 / u_map; float near = 0.0;
    for (int i = 0; i < 11; i++) { vec2 o = i < 9 ? vec2(float(i % 3) - 1.0, 0.5 + float(i / 3)) : vec2(float(i) * 2.0 - 19.0, 0.0);
      near = max(near, texture(u_water, w + o * cs).r * (i < 9 ? 1.0 - 0.3 * float(i / 3) : 0.8)); }
    near *= 1.0 - smoothstep(0.2, 0.6, texture(u_water, w).r);
    // ripples thrown on a wall run as broken wavy bands drifting upward
    float band = smoothstep(0.55, 0.95, sin(wp.y / 4.5 + 2.2 * sin(wp.x / 26.0 + u_t * 0.9) + u_t * 1.7)) * smoothstep(0.35, 0.7, fbm(wp / 46.0 + vec2(u_t * 0.12, -u_t * 0.2)));
    glint = vec3(0.3, 0.75, 0.8) * band * near * (0.14 + 0.6 * dot(min(l, vec3(1.2)), vec3(0.33))); }
  l = 3.2 * tanh(l / 3.2);                                              // soft cap: pools never flatten into one blown-out level
  l = max(vec3(0.0), mix(vec3(dot(l, vec3(0.3, 0.5, 0.2))), l, 1.6));   // grey stone takes the fire's colour: the concept's torchlit walls are orange, not grey (TASKS 163)
  // the black joints between wall-top blocks smoulder here and there, slowly breathing
  float gap = smoothstep(0.09, 0.03, max(c.r, max(c.g, c.b))) * smoothstep(0.6, 0.95, top), hot = smoothstep(0.4, 0.65, fbm(wp / 70.0 + vec2(0.0, u_t * 0.05)));
  vec3 seam = u_vein.rgb * gap * hot * u_seam * (0.7 + 0.3 * sin(u_t * 0.9 + fbm(wp / 40.0) * 9.0));
  o = vec4(mix(abyss(floor(v_px / 2.0) * 2.0 + u_cam * 0.55, w), mix(c * l + seam + glint, c * 1.8, em), s), 1.0); }`;
  const PORTAL = `
uniform float u_amt;
void main(){ vec2 q = v_uv * 2.0 - 1.0; float r = length(q), a = atan(q.y, q.x);
  float sw = fbm(vec2(a * 2.0 + r * 4.0 - u_t * 2.0, r * 3.0 - u_t)), ring = smoothstep(0.95, 0.7, r) * smoothstep(0.2, 0.7, r + sw * 0.3);
  vec3 c = mix(vec3(0.3, 0.5, 1.0), vec3(0.9, 0.95, 1.0), sw * smoothstep(0.8, 0.2, r)); float al = ring * u_amt; o = vec4(c * al, 0.0); }`;
  SC.REPEAT = ['floor_cv_tex', 'wall_cv_tex', 'walltop_cv_tex', 'shore_cv_tex'];
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
    L.init(W, H, { flame: FLAME, arc: ARC, lit: LIT, portal: PORTAL, lava: LAVA, pool: WATER, cave: CAVE, cavewater: CAVE_WATER, cavesrc: CAVE_SRC, jet: JET, whirl: WHIRL, fireball: FIREBALL, blast: BLAST }, { pixel: PIX * Z, view: [VW, VH] });
    if (LT) { G.free(LT.light); G.free(LT.lit); }
    LT = { light: G.target(W / 2, H / 2, true, { view: [VW, VH] }), lit: G.target(W, H, true, { view: [VW, VH] }) };
  }
  const rnd = L.rnd, SS = L.SS;
  const zoneAt = (m, x, y) => { for (const r of m.rooms) if (r.zone && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.zone; return m.biome; };
  // the cave's glowing props: where the light sits above the foot (up), its pool's radius and strength, and the colour key of
  // its biome (BIOMES.cave.shroom / gem); a prop away from the cave keeps the fallback colour
  const GLOW = { shroom_a: { up: 22, r: 150, amt: 0.65, col: 'shroom', cap: 15 }, shroom_b: { up: 34, r: 175, amt: 0.75, col: 'shroom', cap: 19 }, crystal_cv: { up: 42, r: 230, amt: 0.9, col: 'gem', cap: 26 } };
  const GLOW_COL = { shroom: [0.2, 0.85, 0.78], gem: [0.32, 0.62, 1.0] };
  const glowBeat = (d, t) => (d.n === 'crystal_cv' ? 0.94 + 0.04 * Math.sin(t * 2.3 + d.x) + 0.02 * Math.sin(t * 7.1 + d.y) : 0.84 + 0.16 * Math.sin(t * 0.9 + (d.x * 0.37 + d.y * 0.11)));
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
  // ---------------- the floor map, baked once per floor into a world-size texture ----------------
  // the wall-top slate is painted dark (raw L≈14): lifted so unlit masses read as cold blue-grey stone, not a black hole
  // the fire biome's tops are dark basalt instead (its seams smoulder in LIT), so it no longer reads as the dungeon gone brown
  const TOP_LIFT = 1.45, topTint = (B) => (B.lava ? [0.8, 0.66, 0.62, 1] : [0.95, 0.97, 1.04, 1]);
  function bake(m) {
    const key = m.seed + ':' + m.floor + ':' + (m.lava || 0) + ':' + m.rooms.map((r) => (r.zone || '-')[0]).join('') + ':' + (m.secrets || []).map((q) => (q.open ? 'o' : q.hp)).join(''); if (BAKE.key === key) return; BAKE.key = key;
    const MW = m.W * TILE, MH = m.H * TILE, B = D.BIOMES[m.biome];
    if (!BAKE.tg || BAKE.tg.w !== MW || BAKE.tg.h !== MH) {
      BAKE.tg = G.target(MW, MH, false);
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const rec = G.canvasTex('map', cv); rec.t = BAKE.tg.t; rec.w = MW; rec.h = MH; }
    G.bind(BAKE.tg, [0, 0, 0, 1]); G.blend();
    const hid = SIM.secretMask(m), c = (x, y) => { const v = SIM.cell(m, x, y); return v === 4 || hid.has(y * m.W + x) ? 0 : v === 5 || v === 6 ? 1 : v; }, TS = 288, TSW = 224, TST = 96;   // repeat periods must be whole tiles, or a cell straddles the texture edge and smears it              // texture repeat = 256 world px (1024 src px)
    const RD = rockDist(m);
    const near = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (c(x + i, y + j) === 1 || c(x + i, y + j) === 3) return true; return false; };
    const tile = (tex, x, y, u, ts = TS) => { const u0 = ((x * TILE) % ts) / ts, v0 = ((y * TILE) % ts) / ts; L.sprite(tex, x * TILE, y * TILE, { w: TILE, h: TILE, src: [u0, v0, u0 + TILE / ts, v0 + TILE / ts], u }); };
    const dark = (x, y, w, h, a) => L.solid(x, y, w, h, [0.01, 0.01, 0.015], 0, 0, 0, a);
    if (B.cave) G.draw(L.P.cave, { u_open: openTex(m), u_water: waterTex(m), u_wet: m.water.length || m.deep ? 1 : 0, u_lift: TOP_LIFT, u_map: [MW, MH],
      u_floor: G.tex(B.floor), u_wall: G.tex(B.wall), u_top: G.tex(B.top), u_shore: G.tex(B.shore) }, G.xf(0, 0, MW, MH));
    else masonry();
    function masonry() {
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const v = c(x, y);
        // an accent zone keeps its own stone, near grey and dark (as dark as the tint it lost made it): the colour proper is its hearths'
        // light and the fill, which fades out past the doorway
        if (v === 1 || v === 3) { const z = zoneAt(m, x, y), Z = D.BIOMES[z]; tile(Z.floor, x, y, { grade: [z === m.biome ? 1 : 0.25, 0.96 * (z === m.biome ? 1 : 0.55 * (Z.dim || 1)), 0, 1], tint: [...Z.tint, z === m.biome ? 1 : 0.35] }); }
        else if (v === 0 && (c(x, y + 1) !== 0 || (c(x, y + 2) !== 0 && c(x, y + 2) !== undefined))) tile(B.wall, x, y, { grade: [0.9, 1.05, 0, 1.05], tint: [B.tint[0], B.tint[1], B.tint[2], 1] }, TSW);
        else if (v === 0 && RD[y * m.W + x] <= 3) tile(B.top, x, y, { grade: [0.55, TOP_LIFT, 0, 1], tint: topTint(B) }, TST);
      }
      // an accent zone's stone thins out over the cells past its doorway in 8 px steps, so the threshold has no hard line
      for (const r of m.rooms) if (r.zone) { const Z = D.BIOMES[r.zone], q = TILE / 4;
        for (let y = r.y - 3; y < r.y + r.h + 3; y++) for (let x = r.x - 3; x < r.x + r.w + 3; x++) { if (c(x, y) !== 1 || zoneAt(m, x, y) !== m.biome) continue;
          for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4, d = Math.hypot(Math.max(r.x - px, 0, px - r.x - r.w), Math.max(r.y - py, 0, py - r.y - r.h)), a = 1 - SS(0, 2.6, d);
            if (a < 0.03) continue; const X = x * TILE + i * q, Y = y * TILE + j * q, u0 = (X % TS) / TS, v0 = (Y % TS) / TS;
            L.sprite(Z.floor, X, Y, { w: q, h: q, src: [u0, v0, u0 + q / TS, v0 + q / TS], u: { grade: [0.25, 0.96 * 0.55 * (Z.dim || 1), 0, 1], tint: [...Z.tint, 0.35], alpha: a } }); } } }
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
        }
      }
    }
    // large-scale variation without a grid: soft overlapping blobs (never per-cell steps, which read as dashed stripes)
    for (let i = 0; i < m.W * m.H / 18; i++) { const x = rnd(i, 7.7) * m.W, y = rnd(i, 8.8) * m.H; if (c(Math.floor(x), Math.floor(y)) !== 1) continue;
      L.puff(x * TILE, y * TILE, 60 + 70 * rnd(i, 9.9), [0.02, 0.015, 0.015], 0.10 + 0.1 * rnd(i, 6.6), i + 0.5); }
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (c(x, y) === 0 && RD[y * m.W + x] >= 2 && RD[y * m.W + x] <= 3) L.puff(x * TILE + 16, y * TILE + 16, 36, [0, 0, 0], RD[y * m.W + x] === 2 ? 0.05 : 0.12, x * 3 + y);
    for (const g of m.rugs || []) if (window.ASSETS.carpet) { const w = g.h * ASSETS.carpet.w / ASSETS.carpet.h; L.puff(g.cx, g.y + g.h / 2 + 4, g.h * 0.55, [0, 0, 0], 0.3, 1); L.sprite('carpet', g.cx - w / 2, g.y, { w, h: g.h }); }
    // painted floor decals: cracks, grime, moss, blood, coins, bones, webs…
    for (const d of m.decals || []) { if (SIM.hidden(m, d)) continue; const [w0, h0] = SZ(d.n), k = 40 * d.s / Math.max(w0, h0); L.sprite(d.n, d.x - w0 * k / 2, d.y - h0 * k / 2, { w: w0 * k, h: h0 * k, flip: !!d.f, u: { alpha: d.n === 'dc_web' ? 0.7 : 0.92 } }); }
    // stains and scorch marks scattered on the floor
    for (let i = 0; i < m.W * m.H / 40; i++) { const x = Math.floor(rnd(i, m.seed % 97) * m.W), y = Math.floor(rnd(i + 0.5, m.seed % 89) * m.H);
      if (c(x, y) !== 1) continue; const wall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i2, j2]) => c(x + i2, y + j2) !== 1 && c(x + i2, y + j2) !== 3), r = Math.min(wall ? 12 : 99, 8 + 14 * rnd(i, 3));   // a stain by a wall stays off it
      L.puff(x * TILE + 16, y * TILE + 16, r, rnd(i, 4) < 0.35 ? [0.22, 0.03, 0.02] : [0.04, 0.03, 0.03], 0.35 + 0.25 * rnd(i, 5), i); }
    // a breakable fake wall looks like any other stretch of the (already cracked) masonry until it is struck: then a crack runs
    // from the opening's edge into the wall (up the face of a top wall, across the rock of the other sides) and branches
    (m.secrets || []).forEach((q, i) => { if (q.open || (q.kind || 'crack') !== 'crack' || q.hp >= 2) return; const hurt = true, a0 = Math.atan2(q.dy, q.dx), ux = Math.cos(a0), uy = Math.sin(a0);
      const crack = (x0, y0, a1, len, w, seed, depth) => { let x = x0, y = y0, a = a1;
        for (let k = 0; k < len; k++) { const l = 6 + 4 * rnd(seed, k); a += (rnd(seed, k + 9) - 0.5) * 0.9; const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
          L.solid(x, y, l + 1, w, [0.02, 0.015, 0.02], a, 0, w / 2, 0.92); L.solid(x, y + w / 2 + 1, l, 2, [0.7, 0.64, 0.6], a, 0, 0, q.dy < 0 ? 0.35 : 0.6);
          if (depth && rnd(seed, k + 30) < (hurt ? 0.55 : 0.3)) crack(nx, ny, a + (rnd(seed, k + 40) < 0.5 ? -0.9 : 0.9), 2 + Math.floor(rnd(seed, k + 50) * 2), Math.max(1, w - 1), seed * 7 + k, depth - 1);
          x = nx; y = ny; } };
      const bx = q.x + ux * 3 - 4 * uy, by = q.y + uy * 3;
      crack(bx, by, a0 - 0.15, 5, hurt ? 5 : 4, 11 + i, hurt ? 2 : 1);
      if (hurt) { const hx = bx + ux * 24, hy = by + uy * 24; crack(hx, hy, a0 - 1.4, 3, 3, 21 + i, 1); crack(hx, hy, a0 + 1.4, 3, 3, 31 + i, 1); L.solid(hx - 7, hy - 5, 14, 10, [0.03, 0.02, 0.03], a0, 7, 5, 0.9); } });
    // wall decor: banners hang on the wall faces
    // (a plain banner hangs in the Y band: struck, it swings)
    for (const d of m.decor) if (d.wall && d.n !== 'banner' && d.secret === undefined && !SIM.hidden(m, d)) { const [w, h] = SZ(d.n); L.sprite(d.n, d.x - w / 2, d.y - h + 8, { w, h }); }
    G.bind(null);
  }
  // the fog's edge fades over ~2 cells instead of cutting along the grid; the fade spreads into rock but never onto unseen floor,
  // so nothing behind a wall shows through it
  // a set of cells (lava, water) as a soft mask, 4 texels a cell, blurred over about a cell so its 0.5 contour runs along the cells'
  // edges and rounds their corners
  const MASKS = {};
  // a map's key with its secrets' state: an unfound secret room is rock to the masonry and the abyss, found it gets its rim
  const mapKey = (m) => m.seed + ':' + m.floor + ':' + (m.lava || 0) + ':' + m.rooms.map((r) => (r.zone || '-')[0]).join('') + ':' + (m.secrets || []).map((q) => (q.open ? 'o' : '-')).join('');
  // R: the soft mask; G, B (vec, optional): a direction per cell (x, y in -1..1) around 0.5, not blurred: the shader reads its cell's
  // own with texelFetch
  function maskTex(m, name, has, vec, passes = 2) {
    const M = MASKS[name] || (MASKS[name] = { key: '', rec: null, cv: null }), key = mapKey(m); if (M.key === key) return M.rec; M.key = key;
    const K = 4, W = m.W * K, H = m.H * K, ch = [0, 1, 2].map(() => new Float32Array(W * H)), b = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const cx = Math.floor(x / K), cy = Math.floor(y / K), v = +has(cx, cy), f = v && vec ? vec(cx, cy) : null;
      ch[0][y * W + x] = v; if (f) { ch[1][y * W + x] = f[0]; ch[2][y * W + x] = f[1]; } }
    for (const a of [ch[0]]) for (let pass = 0; pass < passes; pass++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -2; d <= 2; d++) v += a[y * W + Math.min(W - 1, Math.max(0, x + d))]; b[y * W + x] = v / 5; }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -2; d <= 2; d++) v += b[Math.min(H - 1, Math.max(0, y + d)) * W + x]; a[y * W + x] = v / 5; } }
    const cv = M.cv || (M.cv = document.createElement('canvas')); cv.width = W; cv.height = H; const g = cv.getContext('2d'), im = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { const v = Math.round(255 * ch[0][i]); im.data[i * 4] = v; im.data[i * 4 + 3] = 255;
      im.data[i * 4 + 1] = vec ? Math.round(255 * (0.5 + 0.5 * ch[1][i])) : v; im.data[i * 4 + 2] = vec ? Math.round(255 * (0.5 + 0.5 * ch[2][i])) : v; }
    g.putImageData(im, 0, 0);
    if (!M.rec) M.rec = G.canvasTex(name + 'mask', cv);
    else { const gl = G.gl; gl.bindTexture(gl.TEXTURE_2D, M.rec.t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D); }
    return M.rec;
  }
  // a river's crust drifts its way (dungeon.js lavaFlow: 0 right, 1 down, 2 left, 3 up); a pool, or the staged field, lies still
  const FLOW = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const lavaTex = (m) => maskTex(m, 'lava', (x, y) => SIM.cell(m, x, y) === 3, (x, y) => { const d = m.lavaFlow && m.lavaFlow[y * m.W + x]; return d === undefined ? [0, 0] : FLOW[d]; }, 1);   // one blur pass: the banks step with the masonry, only their corners round off
  const topTex = (m) => { const d = rockDist(m); return maskTex(m, 'top', (x, y) => (x < 0 || y < 0 || x >= m.W || y >= m.H || !d[y * m.W + x] ? 0 : d[y * m.W + x] === 1 ? 0.4 : 1)); };
  // where the fire depths' abyss may glow: rock within a few cells of a floor or lava cell
  const veinTex = (m) => { const d = rockDist(m); return maskTex(m, 'veins', (x, y) => x >= 0 && y >= 0 && x < m.W && y < m.H && d[y * m.W + x] <= 5); };
  // the dry crossings are stepping stones laid in the stream: the water runs on under them (TASKS 230)
  // a cave's deep water (cell 6) and the bridges over it are water too, and deep water has a mask of its own (TASKS 302)
  const waterTex = (m) => { const w = new Set((m.water || []).concat(m.waterBridges || [], (m.crossings || []).flatMap((c) => c.cells))); return maskTex(m, 'water', (x, y) => w.has(y * m.W + x) || SIM.cell(m, x, y) === 6, (x, y) => FLOW[m.waterFlow?.[y * m.W + x]] || [0, 0], 1); };
  const deepTex = (m) => maskTex(m, 'deep', (x, y) => SIM.cell(m, x, y) === 6, null, 1);
  const SRC_KIND = { waterfall: 0, breach: 1, spring: 2 }, SRC_DIR = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  // a cave's open cells (floor, water, doors, found secrets) for its rock outline (CAVE)
  const openTex = (m) => { const hid = SIM.secretMask(m); return maskTex(m, 'open', (x, y) => { const v = SIM.cell(m, x, y); return v !== 0 && v !== 4 && !hid.has(y * m.W + x); }, null, 1); };
  // 1 deep in the rock (3 to 6 cells from any floor, soft) and toward the map's edge, where a room may lie close: the abyss shows through
  // cells of rock from the nearest floor or wall face (a top wall's two face cells count as open): the masonry is a rim of two
  // cells around the rooms, the third fades, and the abyss shows past it, so rooms read by their silhouette as in the reference
  const RDIST = { key: '', d: null };
  function rockDist(m) {
    const key = mapKey(m); if (RDIST.key === key) return RDIST.d; RDIST.key = key;
    const hid = SIM.secretMask(m), W = m.W, H = m.H, d = new Float32Array(W * H).fill(99), open = (x, y) => y < H && m.cells[y * W + x] !== 0 && m.cells[y * W + x] !== 4 && !hid.has(y * W + x);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (open(x, y) || open(x, y + 1) || open(x, y + 2)) d[y * W + x] = 0;
    for (let pass = 0; pass < 8; pass++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = d[y * W + x];
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < W && Y < H) v = Math.min(v, d[Y * W + X] + 1); } d[y * W + x] = v; }
    return (RDIST.d = d);
  }
  function voidTex(m) {
    const key = mapKey(m); if (VOID.key === key) return VOID.rec; VOID.key = key;
    const W = m.W, H = m.H, d = rockDist(m);
    const cv = VOID.cv || (VOID.cv = document.createElement('canvas')); cv.width = W; cv.height = H; const g = cv.getContext('2d'), im = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { const x = i % W, y = Math.floor(i / W), e = Math.min(x, y, W - 1 - x, H - 1 - y), v = Math.round(255 * Math.max(SS(1.25, 2.15, d[i]), 1 - SS(0, 2.5, e))); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    if (!VOID.rec) VOID.rec = G.canvasTex('void', cv);
    else { const gl = G.gl; gl.bindTexture(gl.TEXTURE_2D, VOID.rec.t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D); }
    return VOID.rec;
  }
  function seenTex(R) {
    const m = R.map; let n = 0; for (let i = 0; i < R.seen.length; i++) n += R.seen[i];
    const key = m.seed + ':' + m.floor + ':' + n + ':' + R.rseen.join('');
    if (SEEN.key === key) return SEEN.rec; SEEN.key = key;
    if (!SEEN.cv) { SEEN.cv = document.createElement('canvas'); }
    const cv = SEEN.cv; cv.width = m.W; cv.height = m.H; const g = cv.getContext('2d'), im = g.createImageData(m.W, m.H);
    const K = [1, 2, 3, 2, 1], W = m.W, H = m.H, a = new Float32Array(W * H), b = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -2; d <= 2; d++) { const u = Math.min(W - 1, Math.max(0, x + d)); v += K[d + 2] * R.seen[y * W + u]; } a[y * W + x] = v / 9; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -2; d <= 2; d++) { const u = Math.min(H - 1, Math.max(0, y + d)); v += K[d + 2] * a[u * W + x]; } b[y * W + x] = v / 9; }
    for (let i = 0; i < W * H; i++) { const seen = R.seen[i], c = m.cells[i], f = seen ? 0.35 + 0.65 * Math.min(1, b[i] * 1.6) : c === 1 || c === 3 || c === 5 || c === 6 ? 0 : 0.6 * b[i];
      const v = Math.round(255 * f); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    if (!SEEN.rec) SEEN.rec = G.canvasTex('seen', cv);
    else { const gl = G.gl; gl.bindTexture(gl.TEXTURE_2D, SEEN.rec.t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D); }
    return SEEN.rec;
  }
  const SPELL_FLOOR = { key: '', rec: null, cv: null };
  function spellFloor(R) {
    // a rolling hash of the cells and the explored mask: no string of the whole map per frame (TASKS 242)
    const m = R.map; let hsh = 0; for (let i = 0; i < m.cells.length; i++) hsh = (Math.imul(hsh, 31) + m.cells[i] * 2 + (R.seen[i] ? 1 : 0)) | 0;
    const key = m.seed + ':' + m.floor + ':' + hsh + ':' + (m.secrets || []).filter((q) => q.open).length;
    if (SPELL_FLOOR.key === key) return SPELL_FLOOR.rec;
    const cv = SPELL_FLOOR.cv || (SPELL_FLOOR.cv = document.createElement('canvas')); cv.width = m.W; cv.height = m.H;
    const g = cv.getContext('2d'), im = g.createImageData(m.W, m.H), hidden = SIM.secretMask(m);
    for (let i = 0; i < m.cells.length; i++) {
      im.data[i * 4] = (m.cells[i] === 1 || m.cells[i] === 3) && R.seen[i] && !hidden.has(i) ? 255 : 0;
      im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    if (!SPELL_FLOOR.rec) SPELL_FLOOR.rec = G.canvasTex('spell_floor', cv);
    // the mips are rebuilt with every upload: a floor of another size left the old ones behind, the texture went incomplete and
    // read as all rock, so every spell on the cave's larger floors was masked away
    else { const gl = G.gl; gl.bindTexture(gl.TEXTURE_2D, SPELL_FLOOR.rec.t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D);
      SPELL_FLOOR.rec.w = cv.width; SPELL_FLOOR.rec.h = cv.height; }
    SPELL_FLOOR.key = key; return SPELL_FLOOR.rec;
  }

  // ---------------- the hero: cut-out rig (partrig.py) with planted foot paths, IK knees, swinging arms, a held weapon ----------------
  const WEAPON = { sword: ['it_sword', 46], longsword: ['it_longsword', 53], axe: ['it_axe', 48], hammer: ['it_hammer', 51], staff: ['it_staff', 58], fist: null };
  const HERO_H = 84, STEP = SIM.K.STEP || 22;
  // what the hero wears (TASKS 155): each slot picks the rig parts painted for its base (tools/gear.py), '' = the hero as first drawn
  // (plate armour, leather gloves, iron boots); a helmet is a whole head, drawn over a body without its own; the shield rides the far forearm
  const GEAR = { armor: { '': 'cl', leather_armor: 'le', plate_armor: '', cloak: 'hd' }, gloves: { '': 'cl', leather_gloves: '', gauntlets: 'pl' },
    boots: { '': 'cl', boots: 'le', iron_boots: '' }, helm: { leather_helm: 'le', knight_helm: 'kn' } };
  const SHIELD = { shield: ['it_shield', 30], buckler: ['it_buckler', 22], tower_shield: ['it_shield_t', 44] };
  const SLOT_OF = { uarm: 'armor', thigh: 'armor', farm: 'gloves', shin: 'boots', foot: 'boots' };
  function gearOf(h) {
    const eq = h.eq || {}, b = (k) => (eq[k] ? eq[k].b : ''), tex = (n, sfx) => (sfx && window.ASSETS['hero__' + n + '_' + sfx] ? 'hero__' + n + '_' + sfx : 'hero__' + n);
    const sfx = { armor: GEAR.armor[b('armor')] ?? '', gloves: GEAR.gloves[b('gloves')] ?? '', boots: GEAR.boots[b('boots')] ?? '' }, helm = GEAR.helm[b('helm')];
    // a better piece is tinted toward its rarity: uncommon green .. legendary gold, just enough to tell at a glance
    const rar = (k) => { const it = eq[k]; return it && it.rar > 0 ? [...D.RARITY[it.rar].col, 0.12 + 0.06 * it.rar] : null; };
    const part = (n) => { const slot = SLOT_OF[n.slice(0, -1)]; return { tex: tex(n, sfx[slot]), tint: rar(slot) }; };
    const nh = helm ? '_nh' : '', body = (v) => (window.ASSETS['hero__' + v + (sfx.armor ? '_' + sfx.armor : '') + nh] ? 'hero__' + v + (sfx.armor ? '_' + sfx.armor : '') + nh : 'hero__' + v);
    const sh = SHIELD[b('offhand')];
    return { part, body: body('body'), back: body('body_back'), helm: helm && window.ASSETS['hero__head_' + helm] ? helm : null, helmTint: rar('helm'), shield: sh, shieldTint: rar('offhand') };
  }
  SC.gearOf = gearOf;
  function heroPose(h, GT, st) {
    const RG = RIGS.hero, s = HERO_H / RG.h, sp = Math.hypot(h.vx, h.vy), run = SS(10, 150, sp) * (h.deadT >= 0 ? 1 - SS(0, 0.15, GT - h.deadT) : 1);
    const dirx = sp > 1 ? h.vx / sp : 0, diry = sp > 1 ? h.vy / sp : 0;
    const p = h.gp || 0, u0 = ((p / (2 * Math.PI)) % 1 + 1) % 1, sl = SIM.stepLen(Math.abs(dirx));
    return { RG, s, run, dirx: dirx * h.face, diry, p, u0, sl };
  }
  // the melee swing in rig angles: a short pull back, an ease-in strike that crosses the aim on the sim's damage frame (K.HIT),
  // a follow-through that bleeds the speed off, then a recovery that turns the blade flat toward the camera before it travels
  // back to guard, so its way home never reads as a second sweep in any direction. It starts from the end of the arc nearer the
  // rest pose (an aim straight up is an uppercut), which keeps the wind-up short in every direction.
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
    else { const bf = follow(Tf - Ts), u = (T - Tf) / (SWING.end - Tf), q = SS(0, 1, u), d0 = wrapPi(rest - bf), d1 = d0 - Math.sign(d0) * TAU;
      const via = (d, x) => { let t = wrapPi(x - bf); if (d < 0 && t > 0) t -= TAU; if (d > 0 && t < 0) t += TAU; return Math.abs(t) <= Math.abs(d); };   // the blade lowers past the hip
      blade = bf + (via(d0, Math.PI / 2) || Math.abs(d1) > 1.25 * Math.PI ? d0 : d1) * SS(0.15, 0.75, u); k = 1 - q; bend = 0.3; fs = 1 - 0.6 * SS(0, 0.2, u) * (1 - SS(0.6, 0.95, u)); }
    return { blade, k, bend, fs, dir, start, end, Ts, Tf, arm: T < Tf ? blade : follow(Tf - Ts) };   // arm: the arm follows the blade until the recovery, then lowers from the end pose
  }
  const DEPTH_K = 0.65;   // the 3/4 camera's squeeze of floor depth
  // the slash crescent's half-span about the aim, and where its brightness centroid sits along it (the ARC shader's taper and tail fade)
  const ARC_HALF = 1.35, ARC_MID = 0.52;
  // the whirl's turn (0..1) over WHIRL_T s: speeds up and slows down over 0.1 s, so the blade neither starts nor stops dead
  const WHIRL_T = 0.4, whirlP = (t) => { const a = 0.1, v = 1 / (WHIRL_T - a); t = Math.max(0, Math.min(WHIRL_T, t));
    return t < a ? v * t * t / (2 * a) : t < WHIRL_T - a ? v * (t - a / 2) : 1 - v * (WHIRL_T - t) ** 2 / (2 * a); };
  SC.swingPose = swingPose; SC.SWING = SWING; SC.hide = {};   // hide: QA-only switches (weapon, hero) for render-twice checks
  // the hero's paint under the light: his own lantern lights him wherever he stands, so his paint is taken down, not lifted (at 1.3 he
  // read as a pink-white blot, TASKS 197), a little less by a fire; HSAT keeps his steel from taking the fire's orange.
  // k: how lit the hero already is (0 dark .. 1 by a fire), which takes his key light back off
  const HERO = { lift: 0.85, k: 0 }, HSAT = 0.8;
  function drawHero(h, hx, hy, GT, st, o = {}) {
    const P = heroPose(h, GT, st), { RG, s, run } = P, gx = RG.gap, gy = RG.footL[1];
    const atkT = GT - h.atkT, swinging = atkT >= 0 && atkT < SWING.end, castT = GT - h.castT, casting = castT < 0.5 && h.castK !== 'whirl';
    // whirl: the hand and blade sweep a ground ellipse at waist height around the body from the aim, behind it while pointing away;
    // eased in from the current pose and out of a crouch
    const wt = GT - h.whirlT, whirlE = wt >= 0 ? SS(0, 0.14, wt) * (1 - SS(WHIRL_T, WHIRL_T + 0.14, wt)) : 0, wa0 = h.whirlA ?? h.aim;
    const wTh0 = Math.atan2(Math.sin(wa0) / DEPTH_K, Math.cos(wa0)), whirlTh = wTh0 + Math.PI * 2 * whirlP(wt);
    // a turn mirrors the rig in one frame: narrowing it through a sliver read as a flat cut-out card spinning; the cape swings out instead
    const fX = h.face, face = h.face;
    const pdx = P.dirx * face * h.face;
    const hurt = GT - h.hurtT < 0.12, alpha = o.alpha === undefined ? 1 : o.alpha;
    // body: hip rides the stance leg (low at double support), slow breath at rest
    const dbl = 0.5 + 0.5 * Math.cos(4 * Math.PI * P.u0), breath = (1 - run) * Math.sin(GT * 2.1) * 0.9;
    const bodyDy = run * (2.6 - 0.9 * Math.abs(pdx)) * dbl;
    // dash and hurt lean the upper body about the hip (the feet stay planted): eased in and out, never a one-frame switch
    const dA = GT - h.dashT, dashE = SS(0, 0.09, dA) * (1 - SS(0.14, 0.3, dA)), dashF = h.dashX * face >= -0.2 ? 1 : -1;
    const hA = GT - h.hurtT, hurtE = h.deadT >= 0 ? 0 : SS(0, 0.07, hA) * (1 - SS(0.12, 0.3, hA));
    // standing, the upper body sways slowly about the hip (two slow waves, so it never reads as a metronome)
    const swE = atkT >= 0 ? SS(0, 0.06, atkT) * (1 - SS(SWING.end - 0.1, SWING.end, atkT)) : 0;
    const idle = (1 - run) * (1 - dashE) * (1 - hurtE) * (1 - swE) * (h.deadT >= 0 ? 1 - SS(0, 0.15, GT - h.deadT) : 1), sway = idle * (0.022 * Math.sin(GT * 0.83) + 0.01 * Math.sin(GT * 1.37 + 1));
    // every 4–5 s the weight moves onto the other leg: the hip slides toward it and the free heel lifts
    const wsh = 2 * SS(-0.35, 0.35, Math.sin(GT * 1.43) + 0.3 * Math.sin(GT * 0.61)) - 1, hipDx = 10 * wsh * idle;
    const heel = { L: 0.06 * idle * SS(0.3, 1, wsh), R: 0.06 * idle * SS(0.3, 1, -wsh) };
    const bodyR = 0.25 * dashE * (Math.abs(h.dashX) > 0.3 ? Math.sign(h.dashX) : 0) + 0.15 * hurtE * (h.hurtX || 0) + sway * face;
    // death keeps the rig: the knees buckle (the hip drops, IK folds them), the arms fling, then the whole body falls back about the feet,
    // accelerating but slowed just before the floor so it lands with a small bounce instead of a board's slap
    const du = h.deadT >= 0 ? GT - h.deadT : -1, buckle = du >= 0 ? SS(0, 0.15, du) : 0, fq = Math.min(1, Math.max(0, (du - 0.12) / 0.35));
    const fallR = du < 0 ? 0 : -face * (0.1 * buckle + 1.32 * (2.4 * fq * fq - 1.4 * fq * fq * fq) - (du > 0.47 ? 0.03 * Math.sin(Math.PI * Math.min(1, (du - 0.47) / 0.16)) : 0));
    const fc = Math.cos(fallR), fs = Math.sin(fallR);
    const root = [hx, hy], R2S = (px, py, dy = 0) => { const x = fX * (px - gx) * s, y = (py - gy) * s + dy; return [root[0] + x * fc - y * fs, root[1] + x * fs + y * fc]; };
    const dk = du >= 0 ? 1 - 0.25 * SS(0.4, 1.2, du) : 1, ft = hurt || !HERO.fireTint ? [1, 1, 1, 0] : [...HERO.fireTint(h.x, h.y), 1], U = { alpha, tint: ft, grade: hurt ? [0.4, 2.4, 0, 1] : [HSAT * dk, HERO.lift * dk, 0, 1] }, Ufar = { alpha, tint: ft, grade: hurt ? [0.4, 2.4, 0, 1] : [0.85 * HSAT * dk, 0.72 * HERO.lift * dk, 0, 1] };
    const GR = gearOf(h), tinted = (u, t) => (t ? Object.assign({}, u, { tint: [0, 1, 2].map((i) => (u.tint ? 1 + (u.tint[i] - 1) * u.tint[3] : 1) * (1 + (t[i] - 1) * t[3])).concat(1) }) : u);   // a piece's rarity over the fire's tint
    const part = (n, pivotRig, at, rot, u = U, k = 1, up = 0) => { const g = GR.part(n); return L.sprite(g.tex, 0, 0, { u: tinted(u, g.tint), m: M.of(M.t(at[0], at[1]), M.r(fallR + up), M.s(fX, 1), M.r(rot), M.s(1, k)), w: RG.w * s, h: RG.h * s, pivot: [pivotRig[0] * s, pivotRig[1] * s] }); };
    const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
    const dist2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const id = o.id || 'hero';
    // ---- legs: foot targets in rig px: rest ankle + travel × sweep in stance, eased forward with a lift in the swing ----
    const legs = {}, tg = {};
    for (const side of ['L', 'R']) {
      const A0 = RG['ankle' + side], u = ((P.u0 + (side === 'L' ? 0 : 0.5)) % 1), A = P.sl / 2 / s * run;   // half a step in rig px: stance slides back at body speed
      let off, lift = 0;
      if (u < 0.5) off = A * (1 - 4 * u); else { const w = (u - 0.5) * 2, e = SS(0.12, 0.95, w); off = -A + 2 * A * e; lift = Math.pow(Math.sin(Math.PI * w), 0.6) * (13 + 2 * Math.abs(pdx)) * run; }
      tg[side] = { tx: A0[0] + off * pdx + (side === 'L' ? -9 : 9) * (1 - run * 0.6), ty: A0[1] - lift, lift, dz: off * P.diry - 0.5 * A * Math.abs(P.diry) };
    }
    // the dash pose: the near leg reaches toward the dash, the far one trails with its knee bent (the gait does not run while dashing)
    if (dashE > 0) { tg.R.tx += 12 * dashE * dashF; tg.L.tx -= 16 * dashE * dashF; tg.L.ty -= 12 * dashE; tg.L.lift = Math.max(tg.L.lift, 12 * dashE); }
    // the hip rides the legs: it drops as far as the farther-reaching foot needs to stay on its target
    let drop = 0;
    for (const side of ['L', 'R']) { const H0 = RG['hip' + side], K0 = RG['knee' + side], A0 = RG['ankle' + side], Lm = 0.955 * (dist2(H0, K0) + dist2(K0, A0)), dx = tg[side].tx - H0[0];
      drop = Math.max(drop, tg[side].ty - H0[1] - Math.sqrt(Math.max(0, Lm * Lm - dx * dx))); }
    const hipDy = Math.max(bodyDy / s, drop) + breath * 1.4 / s + 48 * buckle + 10 * dashE + 8 * hurtE + 7 * whirlE;
    const Hc = [(RG.hipL[0] + RG.hipR[0]) / 2, RG.hipL[1]], hipS = R2S(Hc[0] + hipDx, Hc[1], hipDy * s), bc = Math.cos(bodyR), bs = Math.sin(bodyR);
    // the face is painted on the world's art grid (one texture cell, RIGS.hero.h / 42 px, is one world pixel): the cell of the near
    // eye is kept on a world pixel through the torso's lean, or the one-cell eye lands across two pixels and drops out of the snap.
    // Arms ride on hipS and move with it
    if (du < 0) { const C = RG.h / 42, ex = fX * ((13.5 * C) - Hc[0]) * s, ey = (6.5 * C - Hc[1]) * s, r = fallR + bodyR;
      const qx = hipS[0] + ex * Math.cos(r) - ey * Math.sin(r), qy = hipS[1] + ex * Math.sin(r) + ey * Math.cos(r);
      hipS[0] += 2 * Math.round((qx - 1) / 2) + 1 - qx; hipS[1] += 2 * Math.round((qy - 1) / 2) + 1 - qy; }
    const R2U = (px, py, dy = 0) => { const p = R2S(px + hipDx, py, dy), x = p[0] - hipS[0], y = p[1] - hipS[1]; return [hipS[0] + x * bc - y * bs, hipS[1] + x * bs + y * bc]; };
    for (const side of ['L', 'R']) {
      const H0 = RG['hip' + side], K0 = RG['knee' + side], A0 = RG['ankle' + side], { tx, ty, lift } = tg[side];
      const Hp = [H0[0] + hipDx, H0[1] + hipDy];
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
    let swingK = 0, bend = 0, bladeFs = 1, armA = 0;
    // the swing aims along shoulder → target (chest height at 0.8 reach), not along the raw aim from the feet, so the blade crosses
    // the body it hits even when the arm is raised for an uppercut
    const swAim = (a) => { const sh = R2U(RG.shR[0], RG.shR[1] + hipDy), tx = hx + Math.cos(a) * st.reach * 0.8, ty = hy + Math.sin(a) * st.reach * 0.8 - 34, g = Math.atan2(ty - sh[1], tx - sh[0]);
      return face > 0 ? g : Math.PI - g; };
    if (whirlE === 0 && swinging) { const arcR = st.arc * Math.PI / 180, pT = GT - (h.patkT === undefined ? -9 : h.patkT);
      const prev = pT < SWING.end && h.patkT < h.atkT ? swingPose(pT, swAim(h.patkA), arcR, -0.95) : null;
      const sw = swingPose(atkT, swAim(h.atkA), arcR, -0.95, prev);
      bladeA = sw.blade; armA = sw.arm; swingK = sw.k; bend = sw.bend; bladeFs = sw.fs; }
    const shoulderDy = hipDy - 0.6 * breath / s;   // the chest lifts on the breath a little more than the hip
    const armPose = (side, swingA) => {
      const S0 = RG['sh' + side], E0 = RG['elbow' + side], Hd0 = RG['hand' + side];
      const Sp = [S0[0], S0[1] + shoulderDy];
      let r1 = swingA, r2 = swingA * 0.6 + 0.18;
      return { S0, E0, Hd0, Sp, r1, r2 };
    };
    // a positive turn moves the hand (−dy, dx): the sign that carries it along the travel against its own leg
    const legSwing = Math.cos(P.p) * 0.42 * run, sg = (side) => ((RG['hand' + side][0] - RG['sh' + side][0]) * P.diry - (RG['hand' + side][1] - RG['sh' + side][1]) * P.dirx >= 0 ? 1 : -1);
    const arms = { L: armPose('L', -sg('L') * legSwing * 0.8 + breath * 0.06 - sway * 1.5), R: armPose('R', sg('R') * legSwing * 0.8 - breath * 0.05 - sway * 1.5) };
    const pose = (A, dr1, bend, k) => { A.r1 += dr1 * k; A.r2 += (A.r1 + bend - A.r2) * k; };   // blended by the effect's strength: no elbow snap at its start
    if (swingK > 0) {
      armR = arms.R; const w = wrapPi(armA - Math.PI / 2), r1 = w - 0.15 * Math.sin(w);   // ≈0.85·w near rest, yet periodic: no spin at ±π
      armR.r2 = armR.r2 + wrapPi(r1 + bend - armR.r2) * swingK; armR.r1 = armR.r1 + wrapPi(r1 - armR.r1) * swingK;
    }
    // two-bone reach of an arm to a rig-space target (relative to its shoulder), the elbow bending down: blended by k
    const reach = (A, tx, ty, k) => { const l1 = dist2(A.S0, A.E0), l2 = dist2(A.E0, A.Hd0), d = Math.min(Math.hypot(tx, ty), l1 + l2 - 0.5), b = Math.atan2(ty, tx);
      const a1 = b + Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))), E = [Math.cos(a1) * l1, Math.sin(a1) * l1];
      const r1 = a1 - ang(A.S0, A.E0), r2 = Math.atan2(ty - E[1], tx - E[0]) - ang(A.E0, A.Hd0);
      A.r1 += wrapPi(r1 - A.r1) * k; A.r2 += wrapPi(r2 - A.r2) * k; };
    const armLen = (A) => dist2(A.S0, A.E0) + dist2(A.E0, A.Hd0);
    const castE = casting ? SS(0, 0.24, castT) * (1 - SS(0.3, 0.5, castT)) : 0;
    if (whirlE > 0 && swingK === 0) {   // the ellipse is centred behind the shoulder, toward the body's axis, inside the arm's reach
      const l = armLen(arms.R), wx = Math.cos(whirlTh) * face, tx = -0.3 * l + 0.4 * l * wx, ty = 0.6 * l + 0.25 * l * Math.sin(whirlTh);
      armR = arms.R; reach(arms.R, tx, ty, whirlE);
      pose(arms.L, 0.8, -0.5, whirlE);
    } else if (castE > 0) {             // the free hand pushes the spell toward the aim; the sword arm lowers its blade
      const l = armLen(arms.L); reach(arms.L, 0.25 * l + Math.cos(aimL) * 0.6 * l, Math.sin(aimL) * 0.6 * l, castE);
      pose(arms.R, -0.25, 0.35, castE);
    }
    if (dashE > 0) { pose(arms.L, 0.55 * dashF, 0.45, dashE); pose(arms.R, 0.55 * dashF, 0.45, dashE); }
    if (hurtE > 0 && swingK === 0) { pose(arms.L, -0.45, 0.5, hurtE); pose(arms.R, -0.3, 0.45, hurtE); }
    if (o.victory) { reach(arms.R, armLen(arms.R) * 0.32, -armLen(arms.R) * 0.88, 1); pose(arms.L, -0.25, 0.2, 1); bladeA = -Math.PI / 2 + 0.08; }
    if (buckle > 0) { const f = SS(0, 0.2, du); arms.L.r1 -= 0.9 * f; arms.L.r2 = arms.L.r1 + 0.35; arms.R.r1 -= 1.1 * f; arms.R.r2 = arms.R.r1 + 0.3; }
    // cape and hair are painted into the body, so they bend in the shader (soft bones, art/softbones.json). The render has no
    // springs: every event (swing, turn, hurt) rings out as a damped wave from its timestamp, the run trails them back
    const ring = (x, f, k) => x > 0 ? Math.exp(-k * x) * Math.sin(TAU * f * x) : 0, fwd = Math.abs(P.dirx);
    const wave = (1 - run) * (0.06 * Math.sin(GT * 1.1 + 0.4) + 0.035 * Math.sin(GT * 1.9));
    const capeA = Math.max(-0.04, wave + run * (0.12 + 0.12 * fwd + 0.08 * Math.sin(2 * P.p)) + 0.35 * dashE * (dashF > 0 ? 1 : 0) + 0.12 * ring(atkT - 0.08, 2.2, 5)
      + 0.25 * ring(GT - (h.faceT ?? -9), 1.6, 4) + 0.15 * hurtE + 0.25 * buckle);
    const capeB = wave + run * (0.1 * P.dirx + 0.05 * Math.sin(P.p)) + 0.08 * ring(atkT - 0.08, 2.2, 5) + 0.1 * ring(GT - (h.backT ?? -9) - 0.05, 1.6, 4);
    const hairA = 1.5 * wave - run * (0.1 + 0.08 * fwd - 0.08 * Math.sin(2 * P.p + 0.8)) - 0.2 * dashE + 0.15 * ring(atkT - 0.05, 3, 6) + 0.12 * hurtE;
    const soft = (n, ...a) => window.ASSETS[n + '_w'] ? Object.assign({ wtex: G.tex(n + '_w'), wsz: [RG.w, RG.h] }, ...a.map((v, b) => ({ ['bone' + b]: [RIGS[n].bones[b][0] / RG.w, RIGS[n].bones[b][1] / RG.h, v, 1] }))) : {};
    // positions of the near arm's joints in rig px (for the weapon and the trace)
    const rotP = (p, c, a) => { const dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; };
    const armJ = (A) => { const E = rotP([A.E0[0], A.E0[1] + shoulderDy], A.Sp, A.r1), Hd = rotP(rotP([A.Hd0[0], A.Hd0[1] + shoulderDy], A.Sp, A.r1), E, A.r2 - A.r1); return { E, Hd }; };
    const jL = armJ(arms.L), jR = armJ(arms.R);
    // ---- draw: far arm → far leg → near leg → body → near arm + weapon (weapon behind the body when it points away) ----
    const drawLeg = (side, u) => { const g = legs[side];
      part('thigh' + side, g.H0, R2S(g.Hp[0], g.Hp[1]), g.r1, u, g.k1); part('shin' + side, g.K0, R2S(g.K[0], g.K[1]), g.r2, u, g.k2); part('foot' + side, g.A0, R2S(g.T[0], g.T[1]), -g.lift * 0.02 + heel[side], u); };
    const drawArm = (side, u) => { const A = arms[side], J = side === 'L' ? jL : jR;
      part('uarm' + side, A.S0, R2U(A.Sp[0], A.Sp[1]), A.r1, u, 1, bodyR); part('farm' + side, A.E0, R2U(J.E[0], J.E[1]), A.r2, u, 1, bodyR); };
    // the shield is strapped across the far forearm, its face to the camera; from behind its plain back shows (darker)
    const shield = (u) => { if (!GR.shield) return; const [tex, hh] = GR.shield, A = arms.L, E = R2U(jL.E[0], jL.E[1]), Hd = R2U(jL.Hd[0], jL.Hd[1]), ww = hh * G.tex(tex).w / G.tex(tex).h;
      const c = [E[0] + 0.55 * (Hd[0] - E[0]) - fX * 4, E[1] + 0.55 * (Hd[1] - E[1])], back = backK > 0.5;
      L.sprite(tex, 0, 0, { m: M.of(M.t(c[0], c[1]), M.r(fallR + bodyR + 0.25 * (A.r2 - 0.18)), M.s(fX, 1)), w: ww, h: hh, pivot: [ww / 2, hh / 2], u: back ? Object.assign({}, u, { grade: [0.35, 0.45, 0, 1] }) : tinted(u, GR.shieldTint) }); };
    const weapon = () => { if (!W || SC.hide.weapon) return; const [tex, len] = W, Hd = R2U(jR.Hd[0], jR.Hd[1]), b0 = -0.95 + arms.R.r1 * 0.5, ba = bladeA !== null ? bladeA : b0 + (0.9 - b0) * castE;
      let sa = Math.atan2(Math.sin(ba), fX * Math.cos(ba)) + fallR + bodyR;           // screen angle of the blade, squeezed with the rig
      // a slash sweeps flat around the body: on the floor plane the camera squeezes depth to DEPTH_K, so a blade pointing up or down
      // the screen points away from or at the camera and projects shorter (by the screen angle of a flat blade)
      let fsD = bladeFs * (1 + (DEPTH_K / Math.hypot(DEPTH_K * Math.cos(sa), Math.sin(sa)) - 1) * swingK) * Math.hypot(fX * Math.cos(ba), Math.sin(ba));
      if (whirlE > 0) { const c = Math.cos(whirlTh), d = Math.sin(whirlTh) * DEPTH_K; sa += wrapPi(Math.atan2(d, c) - sa) * whirlE; fsD += (Math.hypot(c, d) - fsD) * whirlE; }
      const tw = len, th = len * G.tex(tex).h / G.tex(tex).w;
      L.sprite(tex, 0, 0, { m: M.of(M.t(Hd[0], Hd[1]), M.r(sa), M.s(fsD, 1), M.r(Math.PI / 4)), w: tw, h: th, pivot: [tw * 0.22, th * 0.78], u: U });
      const tip = [Hd[0] + Math.cos(sa) * len * 0.78 * fsD, Hd[1] + Math.sin(sa) * len * 0.78 * fsD];
      L.joint(id, 'grip', Hd); L.joint(id, 'tip', tip); };
    // from behind the resting blade points away from the camera, so it sits behind the body unless it swings down
    const backK = h.back ? SS(0, 0.08, GT - (h.backT ?? -9)) : 1 - SS(0, 0.08, GT - (h.backT ?? -9));
    const behind = whirlE > 0.5 ? Math.sin(whirlTh) < -0.1 : bladeA !== null ? Math.sin(face > 0 ? bladeA : Math.PI - bladeA) < -0.35 : backK > 0.5;
    L.joint(id + '_view', 'back', [backK, 0]);
    L.joint(id + '_view', 'face', [face, 0]);
    const all = () => {
      const castFront = castE > 0.3;   // the casting hand reaches forward across the chest, in front of the body
      const bodyAt = { m: M.of(M.t(...hipS), M.r(fallR + bodyR), M.s(fX, 1)), w: RG.w * s, h: RG.h * s, pivot: [Hc[0] * s, Hc[1] * s] };
      if (!castFront) drawArm('L', Ufar);
      // seen from the front the cape's flap hangs over the far arm, as painted, but behind both legs
      if (backK < 1 && window.ASSETS.hero__cape) L.sprite('hero__cape', 0, 0, Object.assign({ u: Object.assign({}, U, soft('hero__cape', capeA)) }, bodyAt));
      if (!castFront) shield(Ufar);
      drawLeg('L', Ufar); drawLeg('R', U);
      if (behind) { weapon(); drawArm('R', U); }
      if (backK < 1) L.sprite(GR.body, 0, 0, Object.assign({ u: Object.assign({}, U, { snap: 2 * L.SNAP }, soft('hero__body', GR.helm ? 0 : hairA)) }, bodyAt));
      if (backK < 1 && GR.helm) L.sprite('hero__head_' + GR.helm, 0, 0, Object.assign({ u: Object.assign(tinted(U, GR.helmTint), { snap: 2 * L.SNAP }) }, bodyAt));
      if (backK > 0 && window.ASSETS.hero__body_back) L.sprite(GR.back, 0, 0, Object.assign({ u: Object.assign({}, U, { alpha: alpha * backK }, soft('hero__body_back', capeB, GR.helm ? 0 : hairA)) }, bodyAt));
      if (backK > 0 && GR.helm) L.sprite('hero__head_back_' + GR.helm, 0, 0, Object.assign({ u: Object.assign({}, tinted(U, GR.helmTint), { alpha: alpha * backK }) }, bodyAt));
      if (castFront) { drawArm('L', backK > 0.5 ? Ufar : U); shield(backK > 0.5 ? Ufar : U); }
      if (!behind) { drawArm('R', U); weapon(); }
    };
    all();
    // joint trace (animation.md §14)
    const J = (n, p) => L.joint(id, n, p);
    if (h.qaTgt) { const tx = hx + h.qaTgt[0] - h.x, ty = hy + h.qaTgt[1] - h.y; J('target', [tx, ty - 34]); J('targetLo', [tx, ty]); J('targetHi', [tx, ty - 68]); }
    // the bent cape hem and hair tip: rig px turned about their roots as the shader turns them, then placed like the body
    const tipJ = (n, b, a) => { const r = RIGS[n].bones[b], q = rotP(RIGS[n].tips[b], r, a), x = fX * (q[0] - Hc[0]) * s, y = (q[1] - Hc[1]) * s, c = Math.cos(fallR + bodyR), sn = Math.sin(fallR + bodyR);
      return [hipS[0] + x * c - y * sn, hipS[1] + x * sn + y * c]; };
    // one point per view while that view is drawn: the two views cross-fade, their hems are far apart and never travel between them
    if (backK < 1 && RIGS.hero__cape) { J('cape', tipJ('hero__cape', 0, capeA)); J('hairTip', tipJ('hero__body', 0, hairA)); }
    if (backK > 0 && RIGS.hero__body_back) { J('capeBack', tipJ('hero__body_back', 0, capeB)); J('hairTipBack', tipJ('hero__body_back', 1, hairA)); }
    J('ground', root); J('head', R2U(RG.head[0], RG.head[1], hipDy * s)); J('top', R2U(RG.top[0], RG.top[1], hipDy * s)); J('hip', R2S((RG.hipL[0] + RG.hipR[0]) / 2 + hipDx, RG.hipL[1], hipDy * s));
    for (const side of ['L', 'R']) { const g = legs[side]; J('hip' + side, R2S(g.Hp[0], g.Hp[1])); J('knee' + side, R2S(g.K[0], g.K[1])); J('ankle' + side, R2S(g.T[0], g.T[1]));
      const dT = [g.T[0] - g.A0[0], g.T[1] - g.A0[1]]; J('heel' + side, R2S(RG['heel' + side][0] + dT[0], RG['heel' + side][1] + dT[1])); J('toe' + side, R2S(RG['toe' + side][0] + dT[0], RG['toe' + side][1] + dT[1])); J('ground' + side, [root[0], root[1] + tg[side].dz * s]);
      const A = arms[side], j2 = side === 'L' ? jL : jR; J('sh' + side, R2U(A.Sp[0], A.Sp[1])); J('elbow' + side, R2U(j2.E[0], j2.E[1])); J('hand' + side, R2U(j2.Hd[0], j2.Hd[1])); }
  }
  SC.drawHero = drawHero;

  // ---------------- monsters (whole sprites for now; rigs land in the next pass) ----------------
  const ELITE = [1.0, 0.32, 0.12], SLIME_FOOT = 184 / 188;
  // an elite glows in its powers' colours: a two-power elite alternates them ring by ring and ember by ember
  const modCol = (e, j = 0) => e.mods && e.mods.length ? D.ELITE_MODS.find((m) => m.id === e.mods[j % e.mods.length]).col : ELITE;
  const EN_TEX = { boss_spider: 'en_spider', boss_necro: 'en_cultist', boss_forge: 'en_brute', skeleton: 'en_skeleton', goblin: 'en_goblin', spider: 'en_spider', cultist: 'en_cultist', ghost: 'en_ghost', brute: 'en_brute', boss: 'en_brute', drowned: 'en_drowned', slime: 'en_slime', slime_s: 'en_slime' };
  // per frame: the rim colour of the floor's fire, and the cultists' free hands (view px) for their glow
  const RIM = { col: [1, 0.75, 0.4], hands: {} };
  // how a body goes down, picked by its id: dl s on its feet first (the knees giving, a robe sinking), then dur s to the floor,
  // and a bounce on landing; a heavy body falls slower and the boss slowest
  function deathOf(e) { const v = e.id % 2, ty = e.type;
    if (ty === 'goblin') return v ? { v, dl: 0.25, dur: 0.38, bounce: 0.02, buckle: 1 } : { v, dl: 0, dur: 0.32, bounce: 0.03, buckle: 0.6 };
    if (ty === 'brute' || ty === 'boss') { const k = ty === 'boss' ? 1.35 : 1; return v ? { v, dl: 0, dur: 0.4 * k, bounce: 0.06, buckle: 0.5 } : { v, dl: 0.3 * k, dur: 0.42 * k, bounce: 0.025, buckle: 1 }; }
    if (ty === 'drowned') return v ? { v, dl: 0.3, dur: 0.45, bounce: 0.03, buckle: 1 } : { v, dl: 0.05, dur: 0.42, bounce: 0.035, buckle: 0.6 };
    if (ty === 'cultist') return v ? { v, dl: 0, dur: 0.38, bounce: 0.025, sink: 0 } : { v, dl: 0.32, dur: 0.36, bounce: 0.02, sink: 1 };
    return { v, dl: 0, dur: 0.35, bounce: 0.025, buckle: 0 }; }
  // a drowned under the shallows (TASKS 307): 1 lying under, 0 standing; it sinks back over 0.9 s when it comes home
  const submerged = (e, E, GT) => e.deadT >= 0 || !E.lurk ? 0 : e.st === 'lurk' ? SS(0, 0.9, GT - e.t0) : e.st === 'rise' ? 1 - SS(0.05, E.rise * 0.9, GT - e.t0) : 0;
  // what shows of it then: a dark shape swaying under the surface and bubbles that rise and pop in small rings
  function lurkFx(e, x, y, t, sub) { const k = SS(0.3, 0.9, sub), col = [0.42, 0.62, 0.66];
    L.shadow(x + 3 * Math.sin(t * 0.7 + e.id), y - 3, 25, 8, 0.4 * k);
    for (let j = 0; j < 3; j++) { const per = 1.7 + 0.5 * j, ph = ((t + e.id * 0.37 + j * 0.61) % per) / per, bx = x + (rnd(e.id, j) - 0.5) * 24, by = y - 5 + (rnd(e.id, j + 3) - 0.5) * 8;
      if (ph < 0.22) { const q = ph / 0.22; L.ring(bx, by, 1.5 + 2.5 * q, 1 + 1.6 * q, col, 0.75 * k, 0.45); }
      else if (ph < 0.42) { const q = (ph - 0.22) / 0.2; L.ring(bx, by, 4 + 12 * q, 2 + 5 * q, col, 0.55 * (1 - q) * k, 0.1); } } }
  function drawEnemy(e, x, y, GT, t) {
    const E = D.ENEMIES[e.type], tex = EN_TEX[e.type], [w0, h0] = SZ(window.SIZES['en_' + e.type] ? 'en_' + e.type : tex), k = D.BOSSES[e.type] ? (D.BOSSES[e.type].scale || 1.6) : e.elite ? 1.3 : 1, w = w0 * k, h = h0 * k;
    const dead = e.deadT >= 0 ? GT - e.deadT : -1, hA0 = GT - e.hitT, rapid = e.elite || e.hitT - (e.hitP ?? -9) < 0.3, hit = hA0 >= 0 && hA0 < 0.06 && !rapid, edge = hA0 >= 0 && hA0 < 0.08 && rapid, ew = D.BOSSES[e.type] ? D.bossMove(e).wind : E.wind * D.eliteK(e, 'wind'), wind = e.st === 'wind' ? SS(0, ew, GT - e.t0) : e.st === 'bwind' ? SS(0, ew, GT - e.t0) * (1 - SS(ew, ew + 0.15, GT - e.t0)) : 0;
    const sp = Math.hypot(e.vx, e.vy), ph = e.dist / 20 * Math.PI, step = SS(5, 40, sp) * Math.abs(Math.sin(ph));
    const flt = E.ghost ? 6 + 3 * Math.sin(t * 2.3 + e.id) : 0;
    let sx = 1, sy = 1, lean = 0;
    if (dead < 0) { sy = 1 - 0.05 * step + 0.03 * Math.sin(t * 2 + e.id); sx = 1 / Math.sqrt(sy); 
      // lean back through the wind-up, swing forward over 0.1 s on the strike, settle back to upright before the strike ends: no one-frame pops
      // melee bodies swing forward through the impact (centred on it), others on the strike's first frames
      const sd = E.kind === 'lunge' ? 0.45 : 0.32, u = GT - e.t0, mel = E.kind === 'melee', c = mel ? 0.1 : 0;
      lean = (e.st === 'strike' ? (-0.08 + 0.2 * SS(-c, 0.1, u)) * (1 - SS(sd - 0.15, sd, u)) : e.st === 'wind' ? -0.08 * wind + (mel ? 0.2 * SS(ew - 0.1, ew + 0.1, u) : 0) : -0.08 * wind) * e.face; }
    const alpha = dead < 0 ? (E.ghost ? 0.82 : 1) : E.ghost ? 0.82 * (1 - SS(0.1, 0.9, dead)) : 1 - SS(4.5, 6, dead);
    // a live monster is a dark body with a rim of the fire's colour on its upper-left edge, as in the reference: it reads anywhere
    // in the room, not only inside a pool; bone loses its warm cast
    // in a fire's pool the body is darkened as the hero's is, so the light on it reads as a rim, not a lit figure (TASKS 165); the rim
    // takes the monster's own colour where it has one (a spider's cold blue, a cultist's green), else the biome's fire
    // the fire's colour falls on a monster half bleached, and without the lit pass's 1.6 saturation: the concept's demon stays red, its
    // spider blue and its cultist green in the torchlight (TASKS 185). The tint takes the boosted light to the bleached one
    const sat = e.type === 'skeleton' ? 0.4 : 0.95, val = (E.val || 1) * (1 - 0.3 * (HERO.kAt ? HERO.kAt(e.x, e.y) : 0));
    const grade = hit ? [0.3, 2.6, 0, 1] : e.burn > GT ? [1.1, 1.15, 0, 1] : wind > 0.5 && Math.sin(GT * 40) > 0 ? [1, 1.5, 0, 1] : [sat, val, 0, 1.05];
    const lt = HERO.lightAt ? HERO.lightAt(e.x, e.y) : null, et = E.tint || [1, 1, 1, 0], own = et.slice(0, 3).map((v) => 1 + (v - 1) * et[3]);
    const tint = lt ? HERO.fireTint(e.x, e.y, own) : own;
    // bone, horn and eyes stay pale under the fire: a demon's horns lit salmon read as orange, the concept's are tan (TASKS 185)
    const rim = dead < 0 && !hit ? { tint: [...tint, 1], pale: 1 } : {};
    // the lit edge: one art pixel on the side of the whole silhouette that faces the nearest fire, in its colour; in the dark, none
    const edgeOf = () => { if (dead >= 0 || hit || !lt || lt.k < 0.15) return null; const n = Math.hypot(lt.dx, lt.dy * 1.25) || 1, a = 0.4 * SS(0.15, 0.8, lt.k);
      const c = E.rim || lt.col, g = 0.3 * c[0] + 0.5 * c[1] + 0.2 * c[2];
      return { dx: Math.round(2 * lt.dx / n), dy: Math.round(2 * lt.dy * 1.25 / n), col: c.map((v) => (g + 0.5 * (v - g)) * a) }; };
    const INK = [0.024, 0.02, 0.024];
    const sub = submerged(e, E, GT), cut = sub > 0 ? { cut: [y + 3, 5, 1] } : {};
    if (sub > 0) lurkFx(e, x, y, t, sub);
    if (sub > 0.995) { L.joint('en' + e.id, 'ground', [x, y]); return; }
    L.shadow(x, y + 2, w * 0.32 * (1 - sub), 7, 0.45 * alpha * (1 - sub));
    // a body topples (accelerating, slowed just before the floor), bounces once and lies for seconds before it fades; a ghost dissolves upward
    if (dead >= 0) { if (E.ghost) { const gy = y - flt - 40 * SS(0, 0.9, dead); L.joint('en' + e.id, 'ground', [x, y]); L.joint('en' + e.id, 'top', [x, gy - h * (1 + 0.3 * dead)]);
        if (dead < 0.9) L.sprite(tex, 0, 0, { m: M.of(M.t(x, y - flt - 40 * SS(0, 0.9, dead)), M.s(e.face * (1 - 0.2 * dead), 1 + 0.3 * dead)), w, h, pivot: [w / 2, h], u: { alpha, grade: [1.3, 1.3, 0, 1] } }); return; }
      if (E.blood === 'slime') { const q = SS(0, 0.3, dead); L.joint('en' + e.id, 'ground', [x, y]); L.joint('en' + e.id, 'top', [x, y - h * SLIME_FOOT * (1 - 0.85 * q)]); if (dead > 0.5) return;
        L.sprite(tex, 0, 0, { m: M.of(M.t(x, y)), w, h, pivot: [w / 2, h * SLIME_FOOT], pad: 0.6, u: { alpha: 1 - SS(0.2, 0.5, dead), grade: [1, 0.8, 0, 1], jelly: [0.5, SLIME_FOOT, 1 - 0.85 * q, 1] } }); return; }
      if (dead > 6) return; const DV = deathOf(e), d0 = dead - DV.dl, q = Math.max(0, Math.min(1, d0 / DV.dur)), land = DV.dl + DV.dur, dk = 0.7 + 0.3 * (1 - SS(0.2, 1, dead));
      const fall = 2.6 * q * q - 1.6 * q * q * q - (dead > land ? DV.bounce * Math.sin(Math.PI * Math.min(1, (dead - land) / 0.16)) : 0);
      // away from the killing blow: a body that fell the way it faced landed on the hero who killed it
      const away = Math.cos(e.dieA ?? (e.face > 0 ? Math.PI : 0)) >= 0 ? 1 : -1; x += away * 10 * SS(0, 0.15, dead);
      const ca = fall * 1.3 * away, cs = 1 - 0.3 * SS(DV.dl, land, dead), CJ = (n, d) => L.joint('en' + e.id, n, [x + Math.sin(ca) * d * cs, y - Math.cos(ca) * d * cs]);
      L.joint('en' + e.id, 'ground', [x, y]); CJ('mid', h / 2); CJ('top', h);
      const corpse = () => L.sprite(tex, 0, 0, { m: M.of(M.t(x, y), M.r(ca), M.s(e.face, cs)), w, h, pivot: [w / 2, h], u: { alpha, grade: [dk, dk * 0.9, 0, 1] } });
      if (MONSTERS.rigOf(e.type)) { const dk2 = [dk, dk * 0.9, 0, 1];
        L.inked(() => MONSTERS.draw(e, E, x, y, GT, { id: 'en' + e.id, H: h, face: e.face, lean: 0, fallR: ca, death: DV, U: { alpha, grade: dk2 }, Ufar: { alpha, grade: [dk * 0.85, dk * 0.72, 0, 1] }, t }), { r: 2, n: 8, col: INK, dy: 0, emit: true }); return; }
      L.inked(corpse, { r: 2, n: 8, col: INK, dy: 0, emit: true }); return; }
    // turning about narrows the body to a sliver and opens it the other way over 0.16 s instead of mirroring in one frame
    const tA = GT - (e.ft ?? -9), tc = tA < 0.16 ? -Math.cos(Math.PI * SS(0, 0.16, tA)) : 1, tw = Math.sign(tc || 1) * Math.max(0.12, Math.abs(tc));
    if (tw < 1) L.pre = M.of(M.t(x, y), M.s(tw, 1), M.t(-x, -y));
    try { drawLive(); } finally { L.pre = null; }
    // an elite's aura: its own silhouette, blurred and glowing, breathing and flickering behind the body
    function halo(draw) { if (!e.elite || D.BOSSES[e.type]) return; const pu = 0.5 + 0.5 * Math.sin(t * 2.6 + e.id);
      for (const [ri, [R0, n, a0]] of [[11, 12, 0.1], [7, 10, 0.16], [3.5, 8, 0.28]].entries()) for (let i = 0; i < n; i++) { const an = i * 2 * Math.PI / n + t * 0.8, r = R0 * (1 + 0.35 * pu) + 1.2 * Math.sin(t * 7 + i * 2.1);
        L.sp = { dx: Math.cos(an) * r, dy: Math.sin(an) * r * 1.2 - 2 - 2 * pu, a: a0 * (0.75 + 0.25 * pu), lod: 0.8, ink: modCol(e, ri) }; draw(); }
      L.sp = null; }
    // a blow landing within 0.3 s of the last one only lights the silhouette's edge: a body flashed solid white the whole time a
    // hero keeps hacking hides its own wind-up
    function rimFlash(draw) { for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; L.sp = { dx: Math.cos(an) * 3.5, dy: Math.sin(an) * 3.5, a: 0.85 * (1 - hA0 / 0.08), lod: 0, ink: [1, 0.95, 0.85] }; draw(); } L.sp = null; }
    function drawLive() {
    if (E.blood === 'slime') return drawSlime();
    if (MONSTERS.rigOf(e.type)) { const hA = GT - e.hitT, fl = hA >= 0 ? SS(0, 0.08, hA) * (1 - SS(0.12, 0.32, hA)) : 0;   // a hit flinches the upper body away from the hero
      const Ur = Object.assign({ alpha, grade }, rim, cut), Uf = Object.assign({ alpha, grade: hit ? grade : [grade[0] * 0.85, grade[1] * 0.72, 0, 1] }, cut), dy = sub * h * 1.02;
      const rig = () => { const r = MONSTERS.draw(e, E, x, y + dy, GT, { id: 'en' + e.id, H: h, face: e.face, lean: lean - 0.14 * fl * e.face, crouch: 6 * fl, fallR: 0, U: Ur, Ufar: Uf, t, rise: 1 - sub }); if (r && r.handR) RIM.hands[e.id] = r.handR; };
      halo(rig); if (edge) rimFlash(rig); L.inked(rig, { r: 2, n: 8, col: INK, dy: 0, emit: true, rim: edgeOf() }); return; }
    // the slime (TASKS 308) is one painting on a soft bone (art/softbones.json) squashed and stretched about its foot in the shader
    // (u_jelly): it breathes and ripples as it creeps, squats through the wind-up, shoots up stretched and leans along the hop,
    // lands squashed and wobbles out; a blow dents it
    function drawSlime() {
      const lerp = (a, b, q) => a + (b - a) * q, ring = (t0, A, hz, tau) => { const v = GT - t0; return v >= 0 && v < 6 * tau ? A * SS(0, 0.06, v) * Math.exp(-v / tau) * Math.sin(TAU * hz * v) : 0; };
      const J = E.jump, u = GT - e.t0, ew = E.wind * D.eliteK(e, 'wind'), sp = Math.hypot(e.vx, e.vy), crawl = e.st === 'strike' ? 0 : SS(4, 30, sp), dir = Math.cos(e.aimA) >= 0 ? 1 : -1;
      let k = 1 + 0.03 * Math.sin(t * 2.4 + e.id) * (1 - crawl) + 0.08 * crawl * Math.sin(e.dist / 8), bend = 0.1 * crawl * Math.sign(e.vx) + 0.04 * Math.sin(t * 1.7 + e.id), z = 0;
      if (e.st === 'wind') { const q = SS(0, ew, u); k = lerp(k, 0.68, q) + 0.025 * q * (1 - SS(ew - 0.12, ew, u)) * Math.sin(u * 50); bend = lerp(bend, -0.12 * dir, q); }
      // the arc eases up out of the squat (sin²) and falls on at speed (sin); the squash takes the fall on at the same speed in the
      // top and brings it to rest, then a damped spring sets it level: no jolt at take-off or landing
      else if (e.st === 'strike' && u < J.t) { const q = u / J.t; z = q < 0.5 ? J.h * Math.sin(Math.PI * q) ** 2 : J.h * Math.sin(Math.PI * q); k = 0.68 + 0.52 * SS(0, 0.7, q) - 0.08 * SS(0.7, 0.88, q) + 0.04 * SS(0.88, 1, q);
        bend = lerp(-0.12 * dir, 0.15 * dir * (1 - 2 * q), SS(0, 0.3, q)) * SS(0, 0.3, 1 - q); }
      else if (e.st === 'strike') { const v = u - J.t, km = 0.66, k0 = 1.16, tq = 2 * (k0 - km) * h * SLIME_FOOT * J.t / (Math.PI * J.h), w = TAU * 1.8, tau = 0.09;
        k = v < tq ? km + (k0 - km) * (1 - v / tq) ** 2 : 1 - (1 - km) * Math.exp(-(v - tq) / tau) * (Math.cos(w * (v - tq)) + Math.sin(w * (v - tq)) / (w * tau)); bend = 0; }
      k += ring(e.hitT, -0.09, 3.5, 0.14); bend += ring(e.hitT, 0.07 * (e.face || 1), 3, 0.16);
      const [tw, th] = [G.tex('en_slime_w').w, G.tex('en_slime_w').h], bones = window.ASSETS.en_slime_w ? { wtex: G.tex('en_slime_w'), wsz: [tw, th], bone0: [0.5, SLIME_FOOT, bend, 1] } : {};
      L.joint('en' + e.id, 'ground', [x, y]); L.joint('en' + e.id, 'top', [x + Math.sin(bend) * h * k, y - z - h * k * SLIME_FOOT]);
      const body = () => L.sprite(tex, 0, 0, { m: M.of(M.t(x, y - z)), w, h, pivot: [w / 2, h * SLIME_FOOT], pad: 0.35, u: Object.assign({ alpha, grade, jelly: [0.5, SLIME_FOOT, k, 1] }, rim, bones) });
      halo(body); if (edge) rimFlash(body); L.inked(body, { r: 2, n: 8, col: INK, dy: 0, emit: true, rim: edgeOf() });
    }
    // an unrigged body (the ghost) is knocked back off the blow on a spring and leans away from it; the tail lashes
    const kA = GT - e.hitT, kick = kA >= 0 && kA < 0.6 ? SS(0, 0.08, kA) * Math.exp(-kA / 0.14) * Math.cos(TAU * 3 * kA) : 0;
    x -= e.face * 6 * kick; lean -= 0.2 * kick * e.face;
    const J = (n, d) => L.joint('en' + e.id, n, [x + Math.sin(lean) * d * sy, y - flt - Math.cos(lean) * d * sy]);
    L.joint('en' + e.id, 'ground', [x, y]); J('mid', h / 2); J('top', h);
    // the ghost bends its one painting (soft bones): the tail trails its motion on a slow wave, the near claw reaches through the wind-up
    let bones = {};
    if (E.ghost && window.ASSETS.en_ghost_w) { const sp = Math.hypot(e.vx, e.vy), [tw, th] = [G.tex('en_ghost_w').w, G.tex('en_ghost_w').h];
      const tail = 0.12 * Math.sin(t * 2.2 + e.id) + 0.05 * Math.sin(t * 3.7 + e.id * 2) + 0.3 * SS(0, 60, sp) + 0.25 * kick, reach = -0.7 * wind + 0.06 * Math.sin(t * 1.9 + e.id);
      bones = { wtex: G.tex('en_ghost_w'), wsz: [tw, th], bone0: [190 / 361, 198 / 409, tail, 1], bone1: [266 / 361, 148 / 409, reach, 1] };
      // the bent tips for the trace: texture px turned about their roots as the shader turns them, then placed like the sprite
      const tp = (q, c, a) => { const dx = q[0] - c[0], dy = q[1] - c[1], u = c[0] + dx * Math.cos(a) - dy * Math.sin(a), v = c[1] + dx * Math.sin(a) + dy * Math.cos(a);
        const X = (u / 361 - 0.5) * w * sx * e.face, Y = (v / 409 - 1) * h * sy; return [x + X * Math.cos(lean) - Y * Math.sin(lean), y - flt + X * Math.sin(lean) + Y * Math.cos(lean)]; };
      L.joint('en' + e.id, 'tail', tp([205, 395], [190, 198], tail)); L.joint('en' + e.id, 'claw', tp([330, 250], [266, 148], reach)); }
    const body = () => L.sprite(tex, 0, 0, { m: M.of(M.t(x, y - flt), M.r(lean), M.s(sx * e.face, sy)), w, h, pivot: [w / 2, h], u: Object.assign({ alpha, grade }, rim, bones) });
    halo(body); if (edge) rimFlash(body); if (E.ghost) body(); else L.inked(body, { r: 2, n: 8, col: INK, dy: 0, emit: true, rim: edgeOf() });
    }
  }

  // ---------------- props ----------------
  // gold is an emitter (TASKS 192): drawn again over itself in the 'emit' mode at alpha GOLD_EM, the colour stays and the lit pass
  // mixes it GOLD_EM of the way from lit to self-lit, so a torch's orange no longer turns the coins copper; the stamp leans yellow
  const GOLD_EM = 1, GOLD_TINT = [1, 1.14, 0.6, 1], emitted = (draw) => { G.blend('emit'); draw(GOLD_EM); G.blend(); };
  SC.endActors = (r, win, t, x, y) => {
    HERO.fireTint = HERO.lightAt = HERO.kAt = null; HERO.k = 0; HERO.lift = 1;
    const enemy = (actor, px, py, dead) => {
      const gt = t + 100, e = Object.assign({ id: 990, x: 0, y: 0, vx: 0, vy: 0, dist: 0, face: -1, st: 'idle', t0: -9, hitT: -9, hitP: -9, burn: 0, deadT: dead ? gt - 2 : -1, dieA: 0 }, actor);
      const k = dead ? 0.85 : 160 / (SZ(EN_TEX[e.type])[1] * (D.BOSSES[e.type] ? (D.BOSSES[e.type].scale || 1.6) : e.elite ? 1.3 : 1));
      L.pre = M.of(M.t(px, py), M.s(k, k), M.t(-px, -py));
      try { drawEnemy(e, px, py, gt, t); } finally { L.pre = null; }
    };
    if (win) {
      // the fallen lord behind and aside, the hero large and lit in front of him: the two never merge into one dark shape (TASKS 235)
      enemy({ type: 'boss', elite: 1 }, x - 90, y - 5, true);
      if (r.hero) {
        const h = Object.assign({}, r.hero, { vx: 0, vy: 0, gp: 0, face: 1, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 });
        const hx = x + 35, hy = y + 70;
        G.blend('add'); L.glow(hx, hy - 70, 120, [0.95, 0.7, 0.35], 0.28); G.blend(); L.shadow(hx, hy + 2, 46, 9, 0.6);
        L.pre = M.of(M.t(hx, hy), M.s(1.5, 1.5), M.t(-hx, -hy));
        try { drawHero(h, hx, hy, t, r.heroStats, { id: 'victor', victory: true }); } finally { L.pre = null; }
      }
    } else {
      const last = (r.damage || []).slice(-1)[0]; if (last && last.actor) enemy(last.actor, x, y, false);
    }
  };
  const PROP_H = { pot: 'pot', barrel: 'barrel', crate: 'crate', gold: 'treasure', goldpile: 'shop_gold', vase_a: 'vase_a', vase_b: 'vase_b', vase_c: 'vase_c' };
  // standing props share the actors' one dark contour; flat floor clutter and wall fittings lie on stone that already frames them
  const NO_INK = new Set(['bones', 'torch_sconce']);
  function drawProp(n, x, y, o = {}) { const [w, h] = SZ(n), k = o.k || 1, j = o.j;
    const draw = () => { if (!j) { L.sprite(n, x - w * k / 2, y - h * k + (o.dy || 0), { w: w * k, h: h * k, flip: o.flip, u: o.u }); return; }
      const W = w * k, H = h * k * j.sy, u = j.fl > 0 ? Object.assign({}, o.u, { tint: [2.2, 2, 1.8, j.fl] }) : o.u;
      L.sprite(n, 0, 0, { m: M.of(M.t(x + j.dx, y + (o.dy || 0)), M.r(j.rot)), w: W, h: H, pivot: [W / 2, H], flip: o.flip, u }); };
    if (NO_INK.has(n)) draw(); else L.inked(draw, { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 }); }
  // a knocked prop's recoil about its foot, away from the blow (s): wood rocks, metal rattles, stone shudders, crystal rings, sacks slump
  const KNOCK = {
    wood: (a, s) => ({ rot: s * 0.1 * Math.exp(-5 * a) * Math.sin(20 * a), dx: 0, sy: 1 - 0.03 * Math.exp(-8 * a) * Math.sin(20 * a) }),
    metal: (a, s) => ({ rot: s * 0.05 * Math.exp(-3.5 * a) * Math.sin(34 * a), dx: s * 1.5 * Math.exp(-10 * a) * Math.sin(60 * a), sy: 1 }),
    stone: (a, s) => ({ rot: s * 0.015 * Math.exp(-8 * a) * Math.sin(40 * a), dx: s * 2.5 * Math.exp(-12 * a) * Math.sin(70 * a), sy: 1 }),
    crystal: (a, s) => ({ rot: s * 0.03 * Math.exp(-4 * a) * Math.sin(26 * a), dx: 0, sy: 1 + 0.04 * Math.exp(-6 * a) * Math.sin(30 * a) }),
    cloth: (a, s) => ({ rot: s * 0.04 * Math.exp(-6 * a) * Math.sin(16 * a), dx: 0, sy: 1 - 0.1 * Math.exp(-6 * a) * Math.sin(16 * a) }) };
  const BLOOD = (type) => (D.ENEMIES[type] || {}).blood;
  const knockOf = (e, T) => { const a = T - e.t; if (a < 0 || a >= 1.5 || !KNOCK[e.mat]) return null; const j = KNOCK[e.mat](a, e.s); j.fl = 0.6 * (1 - SS(0.03, 0.12, a)); return j; };

  // ---------------- render ----------------
  SC.render = (t) => {
    const ST = SC.state || SIM.at(t), GT = ST.t, R = ST.run;
    if (R && (R.zoom || D.ZOOM || 1) !== Z) views(R.zoom || D.ZOOM || 1);
    if (!R) { L.beginBG([0.02, 0.015, 0.02, 1]); L.beginComp(); L.finish(t, { bloom: [0, 0] }); if (window.HUD) HUD.draw(ST, t, null); return; }
    const m = R.map, B = D.BIOMES[m.biome], h = R.hero, _rim = (RIM.col = B.torch.map((v) => Math.min(1, v * 1.2)), RIM.hands = {}), st = SIM.stats(h, ST.meta);
    bake(m); const seen = seenTex(R);
    const tr = R.trauma * R.trauma, shx = 16 * tr * (L.rnd(Math.floor(GT * 30), 1) - 0.5) * 2, shy = 12 * tr * (L.rnd(Math.floor(GT * 30), 2) - 0.5) * 2;
    const cx = Math.round((R.cam[0] + shx) / PIX) * PIX, cy = Math.round((R.cam[1] + shy) / PIX) * PIX, sx = (x) => x - cx, sy = (y) => y - cy;
    const vis = (x, y, pad = 120) => x > cx - pad && x < cx + VW + pad && y > cy - pad && y < cy + VH + pad * 1.5;
    const MW = m.W * TILE, MH = m.H * TILE;
    const known = (x, y) => R.seen[Math.floor(y / TILE) * m.W + Math.floor(x / TILE)] || R.seen[Math.floor((y + 40) / TILE) * m.W + Math.floor(x / TILE)];
    const spellU = { u_floor: spellFloor(R), u_map: [MW, MH], u_cam: [cx, cy] };
    const spell = (program, x, y, rx, ry, u) => G.draw(L.P[program], { ...spellU, ...u }, G.xf(sx(x) - rx, sy(y) - ry, rx * 2, ry * 2));
    const weaponCol = (rar) => rar ? D.RARITY[rar].col : [0.55, 0.72, 0.9];
    const whirlFx = (e, a, mode) => {
      const radius = e.r || 92, y = e.y - (mode ? 0 : 34), angle = Math.atan2(Math.sin(e.a || 0) / DEPTH_K, Math.cos(e.a || 0)) + Math.PI * 2 * whirlP(a);
      spell('whirl', e.x, y, radius + 32, radius + 32, { u_center: [e.x, y], u_origin: [e.x, e.y], u_radius: radius, u_age: a, u_angle: angle, u_col: weaponCol(e.rar || 0), u_mode: mode });
    };
    const blastFx = (e, a, mode) => {
      const x = e.gx ?? e.x, y = e.gy ?? e.y + 24, radius = e.big ? 140 : 88;
      spell('blast', x, y, radius + 12, radius + 12, { u_center: [x, y], u_origin: [x, y], u_radius: radius, u_age: a, u_seed: e.t * 13, u_mode: mode });
    };
    const fireFx = (p) => {
      const speed = Math.hypot(p.vx, p.vy), dir = speed ? [p.vx / speed, p.vy / speed] : [1, 0], age = GT - p.t0;
      G.blend('emit');
      for (let j = 7; j >= 0; j--) {
        const lag = j * 0.12 / 7; if (lag > age) continue;
        const x = p.x - p.vx * lag, y = p.y - p.vy * lag, radius = (p.r + 4) * (1 - j * 0.075);
        spell('fireball', x, y, radius * 1.4, radius * 1.4, { u_center: [x, y], u_origin: [p.x, p.y + 20], u_dir: dir, u_radius: radius, u_age: GT - lag, u_amt: j ? 0.6 * (1 - j / 8) : 1, u_seed: p.id, u_mode: 0, u_lift: 20 });
      }
      for (let j = 0; j < 5; j++) {
        const q = (age * 3.5 + rnd(p.id, j)) % 1, lag = q * 0.12; if (lag > age) continue;
        const side = (rnd(p.id, j + 7) - 0.5) * (8 + q * 22), x = p.x - p.vx * lag - dir[1] * side, y = p.y - p.vy * lag + dir[0] * side;
        spell('fireball', x, y, 5, 5, { u_center: [x, y], u_origin: [p.x, p.y + 20], u_dir: dir, u_radius: 2 + (1 - q) * 2, u_age: GT, u_amt: 0.6 * (1 - q), u_seed: p.id + j, u_mode: 1, u_lift: 20 });
      }
      G.blend();
    };
    const hid = (o) => SIM.hidden(m, o);
    const flick = (i) => 0.85 + 0.1 * Math.sin(t * 9.1 + i * 3.7) + 0.06 * Math.sin(t * 23.3 + i * 1.3);
    // a green fire reaches less far: the crypt is lit in pools, not flooded (TASKS 169); so does a cold hearth on the floor, its
    // near light in its own colour, or a zone's four to six of them wash its floor pale (TASKS 188)
    const TL = []; m.torches.forEach((tc, i) => { if (hid(tc)) return; const col = torchCol(m, tc), f = flick(i) * (col[2] > col[0] ? 1.35 : 1), big = tc.kind === 'fire', gr = col[1] > col[0] && col[1] > col[2] ? 0.7 : 1;
      const pool = col[0] < 0.5 && tc.kind === 'brazier', pr = (pool ? 0.6 : 1) * (tc.kind === 'brazier' ? 0.8 : 1), pa = pool ? 0.6 : 1;   // a brazier's pool is a fifth smaller: its light fell off too gently (TASKS 193)
      TL.push([tc.x - (tc.side || 0) * 30, tc.y - (tc.side ? 10 : tc.kind === 'wall' ? -10 : 20), (big ? 200 : 220) * gr * pr, col, (big ? 1.5 : 1.15) * f * pa, 3.0]);
      if (col[0] < 0.5) TL.push([tc.x - (tc.side || 0) * 9, tc.y - 14, 70, col.map((v) => 0.3 + 0.7 * v), 2.2 * f, 2.6]);
      TL.push([tc.x - (tc.side || 0) * 16, tc.y + (tc.side ? 0 : tc.kind === 'wall' ? 34 : 6), 130 * gr * pr, pool ? col : col.map((v) => 0.5 + 0.5 * v), 1.7 * f * pa, 3.5]); });
    for (const d of m.decor) if (d.n === 'candles' && (d.outUntil || 0) <= GT && !hid(d)) TL.push([d.x, d.y - 10 - (d.lift || 0), 120, [1, 0.7, 0.35], 0.6 * flick(d.y)]);
    for (const d of m.decor) if (STAND[d.n] && !hid(d)) { const tp = d.n === 'torch_stand', col = tp ? torchCol(m, d) : CANDLE, up = STAND[d.n][0][1];
      TL.push([d.x, d.y + 4 - up + (tp ? 30 : 40), tp ? 200 : d.n === 'candelabra' ? 150 : 125, col, (tp ? 1.0 : d.n === 'candelabra' ? 0.8 : 0.6) * flick(d.x), 3.0]);
      TL.push([d.x, d.y + 4 - up, tp ? 70 : 40, col.map((v) => 0.4 + 0.6 * v), tp ? 1.6 : 1.1, 2.6]); }
    // a cave bridge's fire posts (TASKS 306): the crossing's warm light, on the deck and in the water under it
    for (const c of m.crossings || []) for (const p of c.posts || []) if (p.fire) { const f = flick(p.x + p.y);
      // the pool lies on the deck and the water round the post's foot, the small bright one at the flame over the post's top, so
      // the post itself is not burnt out by a light at its middle
      TL.push([p.x, p.y + 30, 190, B.torch, 0.95 * f, 3.0]); TL.push([p.x, p.y - BRIDGE.up - 50, 44, B.torch.map((v) => 0.4 + 0.6 * v), 1.1 * f, 2.6]); }
    // the cave's own light (TASKS 305): mushrooms breathe slowly in turquoise, crystals hold a steady blue with a faint shimmer;
    // each is a wide soft pool and a small bright one at its heart, so the floor round it reads as lit by it, not tinted. Kept out
    // of TL: fireTint takes a fire's colour back off the actors, and taken off a cold light it painted the hero red
    const GL = []; for (const d of m.decor) { const g = GLOW[d.n]; if (!g || hid(d)) continue; const col = B[g.col] || GLOW_COL[g.col], b = glowBeat(d, t);
      GL.push([d.x, d.y - g.up, g.r, col, g.amt * b, 2.6]); GL.push([d.x, d.y - g.up, g.r * 0.4, col, g.amt * 1.8 * b, 2.4]); }
    for (const p of R.pots) if ((p.kind === 'gold' || p.kind === 'goldpile') && p.hp > 0 && !hid(p)) TL.push([p.x, p.y - 10, 110, [1, 0.78, 0.4], 0.35]);
    for (const c of R.chests) if (c.tier === 3 && !c.open && !hid(c)) TL.push([c.x, c.y - 14, 130, [1, 0.72, 0.35], 0.55 + 0.15 * Math.sin(t * 2.4)]);
    // how deep a point of the floor stands in the fires' light, 0 in the dark to 1 in a brazier's pool
    HERO.kAt = (px, py) => { let l = 0; for (const [x, y, r, col, amt, k = 2.2] of TL) { const d = Math.hypot((px - x) / r, (py - 40 - y) / (0.8 * r)); if (d < 1) l += amt * Math.exp(-d * d * k) * SS(1, 0.7, d) * (col[0] + col[1] + col[2]) / 3; }
      return SS(0.4, 1.2, l); };
    // where the fires' light on a point of the floor comes from and its colour, weighted as kAt weighs it; null in the dark
    const AMB0 = [0.34, 0.40, 0.58].map((v, i) => (1 - (B.ambK || 0.3)) * v + (B.ambK || 0.3) * B.amb[i] * 0.5 / Math.max(...B.amb));
    HERO.lightAt = (px, py) => { let bx = 0, by = 0, w = 0; const c = [0, 0, 0];
      for (const [x, y, r, col, amt, k = 2.2] of TL) { const d = Math.hypot((px - x) / r, (py - 40 - y) / (0.8 * r)); if (d >= 1) continue;
        const s = amt * Math.exp(-d * d * k) * SS(1, 0.7, d), dx = x - px, dy = y - (py - 40), n = Math.hypot(dx, dy) || 1; bx += dx / n * s; by += dy / n * s; w += s; for (let i = 0; i < 3; i++) c[i] += col[i] * s; }
      return { dx: w ? bx / w : 0, dy: w ? by / w : 0, col: w ? c.map((v) => v / w) : [1, 1, 1], k: w, all: AMB0.map((v, i) => v + c[i]) }; };
    // the fire's colour on an actor falls half bleached and without the lit pass's 1.6 saturation: as a tint over its own (own),
    // the boosted light is taken back to the bleached one (TASKS 185); the concept's demon stays red, its hero steel in torchlight
    HERO.fireTint = (px, py, own = [1, 1, 1]) => { const lt = HERO.lightAt(px, py); if (!lt) return own; const c = lt.all, g = 0.3 * c[0] + 0.5 * c[1] + 0.2 * c[2];
      return c.map((v, i) => own[i] * Math.max(0.5, Math.min(1.8, (g + 0.5 * (v - g)) / Math.max(0.02, g + 1.6 * (v - g))))); };
    HERO.k = HERO.kAt(h.x, h.y); HERO.lift = 0.85 + 0.1 * HERO.k;

    // ===== ground: the baked map, then decals =====
    L.beginBG([0, 0, 0, 1]);
    // only the part of the view that lies on the map (sampling past its edge smears the edge texels into stripes)
    { const x0 = Math.max(0, cx), y0 = Math.max(0, cy), x1 = Math.min(MW, cx + VW), y1 = Math.min(MH, cy + VH);
      if (x1 > x0 && y1 > y0) L.sprite('map', x0 - cx, y0 - cy, { w: x1 - x0, h: y1 - y0, src: [x0 / MW, 1 - y0 / MH, x1 / MW, 1 - y1 / MH] }); }
    L.beginComp();
    // lava about to break through (TASKS 233): over the whole warning the cell darkens to crust, its cracks spread and glow
    // (emissive pass below) and it lights the floor, so the next tongue reads before it lands
    const warnOf = (q) => SS(0, 1, (GT - (q.t0 ?? q.t - 1.1)) / Math.max(0.1, q.t - (q.t0 ?? q.t - 1.1)));
    for (const q of R.lavaPending || []) { const x = (q.cell % m.W) * TILE + 16, y = Math.floor(q.cell / m.W) * TILE + 16; if (!vis(x, y) || !known(x, y)) continue;
      const u = warnOf(q); L.solid(sx(x - 16), sy(y - 16), TILE, TILE, [0.06, 0.03, 0.025], 0, 0, 0, 0.55 * u); L.cracks(sx(x), sy(y), 12 + 14 * u, 0.17 * u, q.cell, 0); }
    // lava (animated, also emissive later): the crust drifts
    const lavaCells = [];
    if (m.lava) for (let y = Math.floor(cy / TILE) - 1; y <= Math.floor((cy + VH) / TILE) + 1; y++) for (let x = Math.floor(cx / TILE) - 1; x <= Math.floor((cx + VW) / TILE) + 1; x++) if (SIM.cell(m, x, y) === 3) lavaCells.push([x, y]);
    // lava is ground (anyone can stand in it now, so it draws under them); its own short strong lights keep it glowing after lighting
    let lavaXf = null; const lavaU = (mode) => ({ u_t: t, u_mask: lavaTex(m), u_seen: seen, u_box: lavaBox, u_map: [MW, MH], u_mode: mode });
    let lavaBox = null;
    if (lavaCells.length) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of lavaCells) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      lavaBox = [(x0 - 1) * TILE, (y0 - 1) * TILE, (x1 - x0 + 3) * TILE, (y1 - y0 + 3) * TILE]; lavaXf = G.xf(sx(lavaBox[0]), sy(lavaBox[1]), lavaBox[2], lavaBox[3]);
      G.draw(L.P.lava, lavaU(0), lavaXf); G.blend('emit'); G.draw(L.P.lava, lavaU(2), lavaXf); G.blend(); }
    const waterRooms = new Map(), caveW = D.runOf(R.mode).arch === 'cave';
    // a cave's water runs through the rock between its halls: one pass over the whole view, unclipped. The fires it reflects are
    // the ones over the view taken in map order, not by distance to the camera, so a reflection never pops as the camera moves
    if (caveW && (m.water.length || m.deep)) { const box = [Math.floor(cx / TILE - 1) * TILE, Math.floor(cy / TILE - 1) * TILE, VW + 3 * TILE, VH + 3 * TILE];
      const fires = TL.filter((f) => f[0] > box[0] - 40 && f[0] < box[0] + box[2] + 40 && f[1] + 44 > box[1] - 80 && f[1] + 44 < box[1] + box[3] + 80).sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, 16);
      while (fires.length < 16) fires.push([0, 0, 0, [0, 0, 0], 0]);
      G.draw(L.P.cavewater, { u_t: t, u_mask: waterTex(m), u_deep: deepTex(m), u_box: box, u_map: [MW, MH],
        u_fire: fires.flatMap((f) => [f[0], f[1], f[2], f[4]]), u_fireCol: fires.flatMap((f) => f[3]) }, G.xf(sx(box[0]), sy(box[1]), box[2], box[3])); }
    if (!caveW) for (const k of m.water || []) {
      const x = k % m.W, y = Math.floor(k / m.W), id = DUNGEON.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE);
      const b = waterRooms.get(id) || [x, y, x, y]; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); waterRooms.set(id, b);
    }
    for (const [id, [x0, y0, x1, y1]] of waterRooms) {
      if ((x1 + 2) * TILE < cx || (x0 - 1) * TILE > cx + VW || (y1 + 2) * TILE < cy || (y0 - 1) * TILE > cy + VH) continue;
      const waterBox = [(x0 - 1) * TILE, (y0 - 1) * TILE, (x1 - x0 + 3) * TILE, (y1 - y0 + 3) * TILE], room = m.rooms[id], b = D.BIOMES[room?.zone || m.biome];
      const fires = TL.slice().sort((a, b) => Math.hypot(a[0] - (x0 + x1) * TILE / 2, a[1] - (y0 + y1) * TILE / 2) - Math.hypot(b[0] - (x0 + x1) * TILE / 2, b[1] - (y0 + y1) * TILE / 2)).slice(0, 8);
      while (fires.length < 8) fires.push([0, 0, 0, [0, 0, 0], 0]);
      G.draw(L.P.pool, { u_t: t, u_mask: waterTex(m), u_deep: deepTex(m), u_box: waterBox, u_map: [MW, MH], u_col: b.water || [0.07, 0.1, 0.12],
        u_room: room ? [room.x * TILE, room.y * TILE, (room.x + room.w) * TILE, (room.y + room.h) * TILE] : [0, 0, MW, MH],
        u_fire: fires.flatMap((f) => [f[0], f[1], f[2], f[4]]), u_fireCol: fires.flatMap((f) => f[3]) }, G.xf(sx(waterBox[0]), sy(waterBox[1]), waterBox[2], waterBox[3]));
    }
    if (!caveW) for (const k of m.waterBridges || []) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE; if (!vis(x, y)) continue;
      const n = rnd(k, 3) < 0.35 ? 'water_stone_b' : 'water_stone_a', [w, hh] = SZ(n), jx = Math.round((rnd(k, 5) - 0.5) * 4) * 2;
      L.shadow(sx(x + jx), sy(y + hh / 2), w * 0.45, 4, 0.5); drawProp(n, sx(x + jx), sy(y) + hh / 2, { flip: rnd(k, 9) < 0.5, u: { grade: [0.85, 0.72, 0, 1] } }); }
    const wetSet = WET.get(m) || (WET.set(m, new Set(m.water)), WET.get(m));
    const inWet = (x, y) => { const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE); return SIM.cell(m, cx, cy) === 6 || wetSet.has(cy * m.W + cx); };
    const ev2 = (v) => Math.round(v / 2) * 2;
    // rings spreading slowly round whatever stands in the water
    const ripple = (x, y, r, sd, a = 0.28) => { for (let k = 0; k < 2; k++) { const ph = (t * 0.42 + k * 0.5 + rnd(sd, 3)) % 1, q = r * (0.55 + 0.9 * ph);
      L.ring(sx(x), sy(y), q, q * 0.38, [0.55, 0.82, 0.84], a * Math.sin(Math.PI * ph), 0.16); } };
    // a stream's water breaks white on a post or a stone it runs past
    const spray = (x, y, sd) => { const k = Math.floor(y / TILE) * m.W + Math.floor(x / TILE); if (m.waterFlow[k] === undefined) return;
      for (let j = 0; j < 4; j++) { const ph = (t * 1.4 + rnd(sd, j)) % 1; L.solid(ev2(sx(x) + (rnd(sd, j + 4) - 0.5) * 18), ev2(sy(y) - 2 - 7 * Math.sin(Math.PI * ph)), 2, 2, [0.8, 0.92, 0.92], 0, 0, 0, 0.7 * (1 - ph)); } };
    // a ford of flat stepping stones, one to a cell, each a little off the grid, the water ringing round it
    const fordStones = (c) => { for (const k of c.cells) { const n = rnd(k, 3) < 0.4 ? 'ford_b' : 'ford_a', [w, hh] = SZ(n), x = (k % m.W + 0.5) * TILE + ev2((rnd(k, 5) - 0.5) * 8), y = (Math.floor(k / m.W) + 0.5) * TILE + ev2((rnd(k, 6) - 0.5) * 6);
      ripple(x, y + 3, w * 0.55, k); L.shadow(sx(x), sy(y) + hh * 0.3, w * 0.5, 4, 0.45); drawProp(n, sx(x), sy(y) + hh * 0.55, { flip: rnd(k, 9) < 0.5 }); spray(x, y, k); } };
    // a plank crossing: one board at a time across the way with a dark gap between, each a little off in length, place, slant and
    // tone. A bridge stands high and sags towards its middle, casts its shadow and its reflection on the water below, and its rope
    // rails run on short stakes between thick posts at its ends; a plank walk lies low on stilts with no rails
    const planks = (c, band) => { const hor = c.axis === 'x', [u0, u1, v0] = c.span, bridge = c.kind === 'bridge', T = TILE, sd = c.cells[0];
      const A0 = u0 * T - 6, len = (u1 - u0 + 1) * T + 12, B0 = v0 * T, BW = 2 * T, n = Math.max(3, Math.round(len / BRIDGE.pitch)), pitch = len / n;
      const sag = bridge ? Math.min(10, 3 + len / 45) : 0, lift = bridge ? 8 : 3, z = (a) => lift - sag * Math.sin(Math.PI * Math.max(0, Math.min(1, (a - A0) / len)));
      const P = (a, b, h = 0) => (hor ? [ev2(sx(a)), ev2(sy(b) - h)] : [ev2(sx(b)), ev2(sy(a) - h)]);
      const boards = []; for (let i = 0; i < n; i++) { const a = A0 + (i + 0.5) * pitch, r = (j) => rnd(sd + i * 7, j);
        if (bridge && i > 1 && i < n - 2 && r(1) < 0.05) continue;
        boards.push({ a, off: (r(2) - 0.5) * 4, l: BW + 6 + (r(3) - 0.5) * 7, rot: (r(4) - 0.5) * 0.07, tone: 0.72 + 0.36 * r(5), n: r(6) < 0.5 ? 'plank_a' : 'plank_b', f: r(7) < 0.5, z: z(a) }); }
      const board = (q, h, draw) => { const [X, Y] = P(q.a, B0 + BW / 2 + q.off, h); draw(X, Y, hor ? Math.PI / 2 + q.rot : q.rot); };
      // the shadow on the water, then the reflection of the near edge and the posts, wavering
      for (const q of boards) board(q, -6, (X, Y, rot) => L.solid(X - q.l / 2, Y - 5, q.l, 10, [0.005, 0.02, 0.025], rot, q.l / 2, 5, bridge ? 0.42 : 0.3));
      if (bridge && hor) for (const q of boards) { const near = B0 + BW + 4; if (!inWet(q.a, near + 14)) continue;
        for (let k = 0; k < 5; k++) { const [X, Y] = P(q.a, near + 4 + k * 4), dx = ev2(Math.sin(t * 1.6 + q.a * 0.13 + k * 1.3) * 1.6); L.solid(X - 4 + dx, Y, 8, 4, [0.2 * q.tone, 0.13 * q.tone, 0.08 * q.tone], 0, 0, 0, 0.2 * (1 - k / 5)); } }
      for (const p of c.posts || []) if (inWet(p.x, p.y + 6)) { ripple(p.x, p.y + 2, 16, p.x + p.y); for (let k = 0; k < 6; k++) { const dx = ev2(Math.sin(t * 1.5 + p.x * 0.1 + k * 1.1) * 1.6);
        L.solid(ev2(sx(p.x)) - 6 + dx, ev2(sy(p.y)) + 4 + k * 4, 12, 4, [0.18, 0.11, 0.07], 0, 0, 0, 0.26 * (1 - k / 6)); } }
      // a plank walk's stilts into the water along its near edge
      if (!bridge) for (let i = 0; i < boards.length; i += 3) for (const b of hor ? [B0 + BW + 1] : [B0 + 3, B0 + BW - 3]) { const q = boards[i], [X, Y] = P(q.a, b);
        if (inWet(hor ? q.a : b, hor ? b + 4 : q.a + 4)) ripple(hor ? q.a : b, hor ? b + 4 : q.a + 4, 9, q.a + b, 0.22); L.solid(X - 2, Y - 2, 4, 8, [0.12, 0.07, 0.045]); }
      // the beams under the boards: along the near edge of a deck across the screen, along both sides of one running down it
      if (hor) for (const q of boards) { const [X, Y] = P(q.a, B0 + BW + 2, q.z); L.solid(X - pitch / 2 - 1, Y - 2, pitch + 2, 5, [0.12, 0.07, 0.045]); }
      for (const q of boards) board(q, q.z, (X, Y, rot) => L.sprite(q.n, X - q.l / 2, Y - 5, { w: q.l, h: 10, rot, pivot: [q.l / 2, 5], flip: q.f, u: { grade: [0.9, q.tone, 0, 1] } }));
      // a deck running down the screen is framed by its two stringers, logs along its sides over the boards' ends, and shows the
      // edge of its last board at its near end
      if (!hor) { const [, y0] = P(A0, 0, lift), [, y1] = P(A0 + len, 0, lift);
        for (const b of [B0 - 1, B0 + BW + 1]) { const [X] = P(0, b); L.solid(X - 3, y0, 6, y1 - y0, [0.15, 0.09, 0.055]); L.solid(X - 3, y0, 2, y1 - y0, [0.33, 0.21, 0.12]); L.solid(X + 2, y0, 1, y1 - y0, [0.06, 0.035, 0.02]); }
        const [xl] = P(0, B0 - 4); L.solid(xl, y1, BW + 8, 4, [0.1, 0.06, 0.035]); }
      if (!bridge) return;
      // the rails: a stake every third board on each side, two ropes from stake to stake, each span sagging
      const stakes = boards.filter((q, i) => i % (hor ? 3 : 4) === 0 || i === boards.length - 1), sh = hor ? 22 : 13;
      // seen from above a stake and the rope it holds run down the same line on a deck running down the screen: one rope there,
      // the stakes over it, each with its pale cut top
      const sw = hor ? 4 : 6, stake = (X, Y) => { L.solid(X - sw / 2, Y - sh, sw, sh, [0.09, 0.05, 0.03]); L.solid(X - sw / 2, Y - sh, 2, sh, [0.26, 0.16, 0.09]);
        L.solid(X - sw / 2, Y - sh - 2, sw, 3, [0.5, 0.36, 0.21]); L.solid(X - sw / 2, Y - sh + 1, sw, 1, [0.05, 0.03, 0.02]); };
      const rail = (side) => { const b = side ? B0 + BW + 1 : B0 - 1, top = (q, hgt) => P(q.a, b, q.z + hgt);
        if (hor) for (const q of stakes) stake(...top(q, 0));
        for (let i = 0; i + 1 < stakes.length; i++) for (const hgt of hor ? [19, 10] : [11]) { const A = stakes[i], Bq = stakes[i + 1];
          for (let k = 0; k < 6; k++) { const w0 = k / 6, w1 = (k + 1) / 6, dr = (w) => 3 * Math.sin(Math.PI * w);
            const [x0, y0] = P(A.a + (Bq.a - A.a) * w0, b, A.z + (Bq.z - A.z) * w0 + hgt - dr(w0)), [x1, y1] = P(A.a + (Bq.a - A.a) * w1, b, A.z + (Bq.z - A.z) * w1 + hgt - dr(w1));
            const l = Math.hypot(x1 - x0, y1 - y0), an = Math.atan2(y1 - y0, x1 - x0); L.solid(x0, y0 + 1, l + 1, 1, [0.2, 0.13, 0.06], an, 0, 0); L.solid(x0, y0 - 1, l + 1, 2, [0.55, 0.42, 0.22], an, 0, 0); } }
        if (!hor) for (const q of stakes) { const [X, Y] = top(q, 0); stake(X + (side ? 2 : -2), Y); } };
      // a deck running down the screen has its rails at its sides, level with whoever walks it: they draw behind him
      if (hor) { rail(0); band.push([B0 + BW + 2, () => rail(1)]); } else { rail(0); rail(1); }
      for (const p of c.posts) band.push([p.y, () => { L.shadow(sx(p.x), sy(p.y), 12, 4, 0.5); drawProp(p.fire ? 'bridge_torch' : 'bridge_post', sx(p.x), sy(p.y), { dy: 4 });
        if (p.fire && known(p.x, p.y)) { halo(sx(p.x), sy(p.y) - BRIDGE.up + 6, B.torch, p.x); flameB(sx(p.x), sy(p.y) - BRIDGE.up, 18 * flick(p.x), 32 * flick(p.x + 1), B.torch, p.x + p.y, 0); } }]); };
    // the cave's crossings (TASKS 306): stepping stones, a low plank walk, a rope bridge; its near rail and posts stand in the band
    const bandX = [];
    for (const c of m.crossings || []) { if (c.kind === 'neck') continue; const xs = c.cells.map((k) => (k % m.W) * TILE), ys = c.cells.map((k) => Math.floor(k / m.W) * TILE);
      if (!vis((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, 260)) continue;
      if (c.look === 'stones') { fordStones(c); continue; }
      planks(c, bandX); }
    // a strand of moss hanging from the lip of a rock face, one art pixel wide: dark at its root, yellow-green at its tip, a leaf
    // pixel now and then to either side; it sways more the lower it hangs. Painted strands drawn this small melted into the rock
    const MOSS = [[0.12, 0.27, 0.2], [0.25, 0.47, 0.19], [0.45, 0.66, 0.2], [0.68, 0.84, 0.28]];
    const mossStrand = (o, sd) => { const n = Math.round(9 + 16 * o.s), top = o.y - 34 - 2 * Math.floor(3 * rnd(o.x, 2)), x0 = ev2(sx(o.x));
      for (let k = 0; k < n; k++) { const q = k / n, dx = ev2(Math.sin(t * 0.7 + sd + k * 0.18) * 3.2 * q * q), col = MOSS[Math.min(3, Math.floor(q * 3.6))], Y = ev2(sy(top)) + 2 * k;
        L.solid(x0 + dx, Y, 2, 2, col); if (k > 2 && rnd(sd, k) < 0.22) L.solid(x0 + dx + (rnd(sd, k + 50) < 0.5 ? -2 : 2), Y, 2, 2, MOSS[Math.min(3, Math.floor(q * 3.6) + 1)]); } };
    // the cave's flora: lilies float on the calm water, moss hangs from the rock faces (water weed stands in the band)
    for (const o of m.flora || []) { if (!vis(o.x, o.y) || o.n === 'weed_cv') continue; const sd = o.x * 0.37 + o.y * 0.11;
      if (o.n === 'lily_cv') { const [w0, h0] = SZ(o.n), w = w0 * o.s, hh = h0 * o.s, dx = Math.round(Math.sin(t * 0.35 + sd)) * 2; L.sprite('lily_cv', sx(o.x) - w / 2 + dx, sy(o.y) - hh / 2, { w, h: hh, flip: !!o.f, u: { grade: [0.9, 0.85, 0, 1] } }); }
      else mossStrand(o, sd); }
    for (const q of m.waterFeatures || []) { if (q.drain === undefined) continue;
      const x = (q.drain % m.W + 0.5) * TILE, y = (Math.floor(q.drain / m.W) + 0.5) * TILE, [w, hh] = SZ('water_drain');
      if (vis(x, y)) L.sprite('water_drain', sx(x) - w / 2, sy(y) - hh / 2, { w, h: hh });
      // the source on the wall: a mask spouting into a basin (a fountain), or a barred culvert at the wall's foot (a stream)
      const top = m.rooms[q.room].y * TILE;
      if (!vis(q.x, top)) continue;
      if (q.kind === 'fountain') { const [sw, sh] = SZ('water_spout'); L.sprite('water_spout', sx(q.x) - sw / 2, sy(top - 9) - sh, { w: sw, h: sh }); }
      else { const [gw, gh] = SZ('water_grate'); L.sprite('water_grate', sx(q.x) - gw / 2, sy(top + 4) - gh, { w: gw, h: gh }); }
    }
    // stairs / boss portal
    if (vis(m.exit.x, m.exit.y)) { if (m.floor < D.runOf(R.mode).floors) { const [w, hh] = SZ('stairs'); L.sprite('stairs', sx(m.exit.x) - w / 2, sy(m.exit.y) - hh / 2 - 4, { w, h: hh }); } }
    // the start room's bonfire sits in a rune circle
    if (window.ASSETS.sanct_circle && vis(m.sanct.x, m.sanct.y)) { const d = 3.4 * TILE; L.sprite('sanct_circle', sx(m.sanct.x) - d / 2, sy(m.sanct.y - 6) - d / 2, { w: d, h: d }); }
    // spike traps: a 2×2-cell plate on the ground; its spikes stand in the Y-sorted band (they have height)
    for (const tp of m.traps) if (vis(tp.x, tp.y)) L.sprite('trap_plate', sx(tp.x - TILE), sy(tp.y - TILE), { w: 2 * TILE, h: 2 * TILE });
    // spilt coins are baked into the floor; stamped again as emitters so the fire's orange can't take their yellow
    for (const d of m.decals) if (d.n === 'dc_coins' && vis(d.x, d.y) && !SIM.hidden(m, d)) { const [w0, h0] = SZ(d.n), k = 40 * d.s / Math.max(w0, h0);
      emitted((a) => L.sprite(d.n, sx(d.x) - w0 * k / 2, sy(d.y) - h0 * k / 2, { w: w0 * k, h: h0 * k, flip: !!d.f, u: { alpha: 0.92 * a, tint: GOLD_TINT } })); }
    // flat decor (bones) and blood / scorch decals from events
    for (const d of m.decor) if (!d.wall && d.n === 'bones' && vis(d.x, d.y) && !hid(d)) drawProp('bones', sx(d.x), sy(d.y), { dy: 6 });
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      // what a kill leaves on the floor by what it bled: a pool, a skeleton's bone dust, nothing of a ghost
      if (e.k === 'kill' && a < 12) { const bl = BLOOD(e.type); if (bl === 'bone') { if (a < 6) L.puff(sx(e.x), sy(e.y) + 2, 14 + 6 * SS(0, 0.3, a), [0.5, 0.47, 0.4], 0.3 * (1 - SS(3, 6, a)), e.id); }
        else if (bl !== 'ecto' && bl !== 'slime' && bl !== 'water') L.puff(sx(e.x), sy(e.y) + 2, 18 + 8 * SS(0, 0.3, a), bl === 'ichor' ? [0.1, 0.14, 0.03] : [0.25, 0.02, 0.02], 0.6 * (1 - SS(6, 12, a)), e.id); }
      if (e.k === 'slam' && a < 4.6) L.cracks(sx(e.x), sy(e.y), e.big ? 130 : 70, a, e.id || 1, 0);
      if (e.k === 'whirl' && a < 0.5) whirlFx(e, a, 1);
      if (e.k === 'boom' && a < 0.6) { G.blend('emit'); blastFx(e, a, 1); G.blend(); }
      if (e.k === 'die') L.puff(sx(e.x) + 6, sy(e.y) + 4, 12 + 30 * SS(0.1, 1.4, a), [0.28, 0.02, 0.02], 0.75, 41); }
    // a slime's puddle (TASKS 308): a glossy green spill that spreads out of the splat, then shrinks as it dries (sim GOO.dry)
    for (const g of m.goo || []) { const a = GT - g.t0, left = g.t0 + g.T - GT; if (a < 0 || left <= 0 || !vis(g.x, g.y)) continue;
      const r = g.r * SS(0, 0.25, a) * Math.min(1, left / 2), X = sx(g.x), Y = sy(g.y);
      for (let j = 0; j < 5; j++) { const an = rnd(g.id, j) * TAU, d = r * 0.45 * rnd(g.id, j + 5); L.puff(X + Math.cos(an) * d, Y + Math.sin(an) * d * 0.55, r * (0.55 + 0.25 * rnd(g.id, j + 9)), [0.1, 0.3, 0.08], 0.75, g.id + j); }
      L.puff(X - r * 0.2, Y - r * 0.12, r * 0.3, [0.45, 0.75, 0.3], 0.35, g.id + 7); }
    const scars = R.scorches || [];
    for (const e of scars.concat(ST.ev.filter((e) => e.k === 'boom' && !scars.some((s) => s.t === e.t && s.x === e.x && s.y === e.y)))) {
      const a = GT - e.t; if (a >= 0 && a < 4) blastFx(e, a, 0);
    }

    // the only tell of a hidden opening: a faint draught, a few pale motes at its foot that only show from a step or two away
    // (a banner sways in it instead)
    const inSecret = (q) => SIM.secretMask(m).has(q.front[5][1] * m.W + q.front[5][0]);
    (m.secrets || []).forEach((q, i) => { if (q.open || q.kind === 'banner' || !vis(q.x, q.y) || inSecret(q)) return; const near = 1 - SS(70, 150, Math.hypot(h.x - q.x, h.y - q.y)); if (near <= 0) return;
      const X = sx(q.x), Yf = sy(q.y) + (q.kind === 'shelf' ? 24 : 0), ux = q.dx, uy = q.dy;
      for (let j = 0; j < 4; j++) { const ph = (t * 0.22 + rnd(i, j)) % 1, sp = (rnd(i, j + 5) - 0.5) * (q.kind === 'shelf' ? 110 : 40) * (0.5 + ph) + Math.sin(t * 1.6 + j * 2) * 4;
        L.solid(X - ux * (ph * 30 - 4) - uy * sp, Yf - uy * (ph * 30 - 4) + ux * sp + (q.dy ? 0 : ph * ph * 10), 2, 2, [0.8, 0.84, 0.92], 0, 0, 0, 0.35 * near * Math.sin(ph * Math.PI)); } });
    // a secret's loose flagstone: the floor's own stone standing a hair proud of its neighbours; it sinks when stepped on
    // an ambush's flagstone (TASKS 71) is the same loose stone: nothing tells the two apart until one is stepped on
    const flagstone = (P, down, crack) => { const z = zoneAt(m, P.cx, P.cy), Z = D.BIOMES[z], TS = 288, X = P.cx * TILE, Yw = P.cy * TILE, u0 = (X % TS) / TS, v0 = (Yw % TS) / TS, lift = 1.5 * (1 - down) - down;
      const ink = [0.02, 0.015, 0.02], X0 = sx(X) + 2, Y0 = sy(Yw) + 2, S0 = TILE - 4;
      L.solid(X0, Y0 + S0 - 1, S0, 3, ink, 0, 0, 0, 0.45 + 0.3 * down);
      L.sprite(Z.floor, X0, Y0 - lift, { w: S0, h: S0, src: [u0 + 2 / TS, v0 + 2 / TS, u0 + (TILE - 2) / TS, v0 + (TILE - 2) / TS], u: { grade: [z === m.biome ? 1 : 0.35, 0.96 * (z === m.biome ? 1 : Z.dim || 1) * (1.05 - 0.22 * down), 0, 1], tint: [B.tint[0], B.tint[1], B.tint[2], 1] } });
      for (const [x, y, w, hh] of [[X0, Y0 - lift, S0, 2], [X0, Y0 - lift, 2, S0], [X0 + S0 - 2, Y0 - lift, 2, S0]]) L.solid(x, y, w, hh, ink, 0, 0, 0, 0.4 + 0.35 * down);
      if (down < 0.5) L.solid(X0 + 2, Y0 - lift + 2, S0 - 4, 1, [0.9, 0.8, 0.65], 0, 0, 0, 0.12);
      if (crack && down > 0.5) {   // a sprung ambush stays a broken, sunken stone, so on the way back it is not taken for one still waiting
        L.solid(X0 + 2, Y0 - lift + 2, S0 - 4, S0 - 4, ink, 0, 0, 0, 0.18);
        const r0 = rnd(P.cx, P.cy); let x = X0 + S0 / 2 - 4 + Math.floor(r0 * 4) * 2, y = Y0 - lift + 2;
        for (let k = 0, d = r0 < 0.5 ? -2 : 2; y < Y0 - lift + S0 - 4; k++) { L.solid(x, y, 2, 2, ink, 0, 0, 0, 0.85); y += 2;
          if (rnd(P.cx + k, P.cy - k) < 0.25) d = -d; if (rnd(P.cy + k, P.cx) < 0.5) x = Math.max(X0 + 2, Math.min(X0 + S0 - 4, x + d));
          if (k === 4) for (let j = 1; j <= 3; j++) L.solid(x - d * j, y + j * 2 - 2, 2, 2, ink, 0, 0, 0, 0.7); } } };
    for (const q of m.secrets || []) { const P = q.trig; if (P && P.k === 'plate' && vis(P.x, P.y)) flagstone(P, q.open ? SS(0, 0.12, GT - (P.downT ?? q.openT ?? -9)) : 0); }
    for (const P of m.ambush || []) if (vis(P.x, P.y)) flagstone(P, P.fired ? SS(0, 0.12, GT - (P.downT ?? -9)) : 0, P.fired);

    // webs on the floor (TASKS 71): torn to a few strands by a blow, burnt to a sooty few by fire
    (m.webs || []).forEach((w, i) => { if (!vis(w.x, w.y)) return; const n = w.torn ? 'web_torn' : w.v ? 'web_b' : 'web_a', A0 = ASSETS[n], ww = 84 * w.s * (w.torn ? 0.8 : w.v ? 0.85 : 1), hh = ww * A0.h / A0.w;
      const burnt = w.torn && ST.ev.some((e) => e.k === 'webburn' && e.i === i), a = w.torn ? GT - (w.tornT ?? -9) : 9;
      L.sprite(n, sx(w.x) - ww / 2, sy(w.y) - hh / 2, { w: ww, h: hh, flip: !!w.f, u: { alpha: w.torn ? 0.8 : 1, grade: burnt ? [0.35, 0.4, 0, 1] : [1.25, 1.1, 0, 1.1] } });
      if (a < 0.4 && !burnt) { const q = a / 0.4; for (let j = 0; j < 6; j++) L.solid(sx(w.x) + (rnd(i, j) - 0.5) * 60 * (0.5 + q), sy(w.y) - 30 * q * rnd(i, j + 4) - 4, 3, 3, [0.9, 0.88, 0.8], 0, 0, 0, 0.8 * (1 - q)); } });

    // ===== Y-sorted band =====
    const Y = [], knocked = {}; for (const e of ST.ev) if (e.k === 'prop') knocked[e.i] = e;
    // a clutch on the art grid like every sprite (TASKS 234); it stirs by whole art pixels, quicker as the hatch nears, never by a squash
    for (const egg of R.eggs || []) if (egg.hp > 0 && vis(egg.x, egg.y)) Y.push([egg.y, () => { const [w, h] = SZ('spider_eggs'), left = egg.hatchT - GT, beat = 3 + 9 * SS(2, 0, left);
      const stir = Math.sin((GT - egg.t0) * beat) > 0.55 ? 2 : 0, lean = left < 1 && Math.sin((GT - egg.t0) * 23) > 0.3 ? 2 : 0;
      L.shadow(sx(egg.x), sy(egg.y), w / 2, 5, 0.5); L.sprite('spider_eggs', sx(egg.x) - w / 2 + lean, sy(egg.y) - h - stir, { w, h }); }]);
    for (const q of m.waterFeatures || []) if (q.kind === 'fountain' && vis(q.x, q.y)) { const top = m.rooms[q.room].y * TILE, [bw, bh] = SZ('water_basin'), foot = top + 36;
      Y.push([foot, () => {
        L.shadow(sx(q.x), sy(foot - 2), bw * 0.45, 6, 0.6); L.sprite('water_basin', sx(q.x) - bw / 2, sy(foot) - bh, { w: bw, h: bh });
        // the pour: from the mask's mouth (a quarter up its plate) to the basin's water, a third down the basin
        const mouth = top - 9 - SZ('water_spout')[1] * 0.3, water = foot - bh * 0.62, xf = G.xf(sx(q.x) - 24, sy(mouth), 48, 64);
        G.draw(L.P.jet, { u_t: t, u_seed: q.room, u_fall: water - mouth, u_wide: 0 }, xf);
        L.anchor('water_source', [sx(q.x), sy(mouth)], [xf[6] + xf[0] * 0.5, xf[7]], 2);
      }]); }
    // a cave's sources: a fall down a top wall, a breach in a side wall, a spring under the rock (CAVE_SRC)
    for (const q of m.waterFeatures || []) { const kind = SRC_KIND[q.kind]; if (kind === undefined || !vis(q.x, q.y)) continue;
      const box = kind ? [q.x - 48, q.y - 48, 96, 96] : [q.x - 48, q.y - 100, 96, 150], xf = G.xf(sx(box[0]), sy(box[1]), box[2], box[3]);
      const U = { u_t: t, u_open: openTex(m), u_water: waterTex(m), u_wet: 1, u_map: [MW, MH], u_box: box, u_src: [q.x, q.y], u_dir: SRC_DIR[q.dir], u_kind: kind, u_seed: q.cell % 97 };
      G.draw(L.P.cavesrc, Object.assign(U, { u_mode: 0 }), xf); G.blend('emit'); G.draw(L.P.cavesrc, Object.assign(U, { u_mode: 1 }), xf); G.blend();
      L.anchor('cave_' + q.kind, [sx(q.x), sy(q.y)], [xf[6] + xf[0] * (q.x - box[0]) / box[2], xf[7] + xf[4] * (q.y - box[1]) / box[3]], 2); }
    for (const e of ST.ev) { const a = GT - e.t;
      if (e.k === 'whirl' && a >= 0 && a < 0.48) Y.push([e.y - 1000, () => { G.blend('emit'); whirlFx(e, a, 0); G.blend(); }]);
    }
    for (const p of R.proj) if (p.own === 'hero' && p.k === 'fire' && vis(p.x, p.y)) Y.push([p.y + 20, () => fireFx(p)]);
    const jig = (id) => knocked[id] && knockOf(knocked[id], GT);
    // the painted wax is near white and outshone the fight; dimmed, the flames stay the brightest thing on a candle
    const WAX = { grade: [0.8, 0.55, 0, 1] }, WAX_T = { grade: [0.9, 0.8, 0, 1] };
    // candles standing on a table are one painted piece with it (table_candles): the pair drawn apart never sat right
    const onTable = (c) => m.decor.find((t) => t.n === 'table' && Math.abs(t.x - c.x) <= 6 && c.y - t.y === 1);
    const lit = new Set(m.decor.filter((c) => c.n === 'candles' && c.lift).map(onTable).filter(Boolean));
    m.decor.forEach((d, i) => { if (!d.wall && d.secret === undefined && d.n !== 'bones' && !(d.n === 'candles' && d.lift && onTable(d)) && vis(d.x, d.y) && !hid(d)) Y.push([d.y, () => drawProp(lit.has(d) ? 'table_candles' : d.n, sx(d.x), sy(d.y) - (d.lift || 0), { dy: 4, j: jig('d' + i), u: lit.has(d) ? WAX_T : d.n === 'candles' ? WAX : undefined })]); });   // lift: candles standing on a table
    // a plain banner hangs still (only a secret's banner stirs in a draught); struck, it swings on its rod and settles
    m.decor.forEach((d, i) => { if (!d.wall || d.n !== 'banner' || d.secret !== undefined || !vis(d.x, d.y) || hid(d)) return; const [w, hh] = SZ('banner'), e = knocked['d' + i], a = e ? GT - e.t : 9;
      const rot = a < 1.5 ? e.s * 0.16 * Math.exp(-2.4 * a) * Math.sin(8 * a) : 0;
      Y.push([d.y - 38, () => L.sprite('banner', 0, 0, { m: M.of(M.t(sx(d.x), sy(d.y + 8 - hh)), M.r(rot)), w, h: hh, pivot: [w / 2, 0] })]); });
    for (const c of R.chests) if (vis(c.x, c.y) && !hid(c)) Y.push([c.y, () => { const op = c.open ? SS(0, 0.18, GT - (c.openT || -9)) : 0; L.shadow(sx(c.x), sy(c.y) + 2, 22, 6, 0.5);
      // the gold chest's coins are painted in their own flat golds: the tier's lift would melt them into one orange heap
      const gold = op > 0.5 && c.gold && window.ASSETS.chest_open_gold;
      drawProp(gold ? 'chest_open_gold' : op > 0.5 ? 'chest_open' : 'chest', sx(c.x), sy(c.y), { dy: 4, k: c.tier >= 2 ? 1.15 : 1, u: { grade: gold ? [1, 1, 0, 1] : c.tier === 3 ? [1.2, 1.12, 0, 1.1] : c.tier === 2 ? [1.15, 1.08, 0, 1.05] : [1, 1, 0, 1] } }); }]);
    for (const p of R.pots) { if (!vis(p.x, p.y) || hid(p)) continue; if (p.hp > 0) Y.push([p.y, () => { L.shadow(sx(p.x), sy(p.y) + 2, 14, 5, 0.45); drawProp(PROP_H[p.kind], sx(p.x), sy(p.y), { dy: 4 });
      if (p.kind === 'gold' || p.kind === 'goldpile') emitted((a) => drawProp(PROP_H[p.kind], sx(p.x), sy(p.y), { dy: 4, u: { alpha: a, tint: GOLD_TINT } })); }]); }
    // lean: the flame's tip shifted sideways (px), its base stays on the wick
    // fires [x, y, w, hh, col, seed, lean]: emissive, they replace what is behind them and the light map leaves them unlit
    const flames = (fs) => { const xf = ([x, y, w, hh, , , lean = 0]) => [w, 0, 0, -lean, hh, 0, x - w / 2 + lean, y - hh, 1];
      G.blend('emit'); for (const f of fs) G.draw(L.P.flame, { u_t: t, u_seed: f[5], u_amt: 1, u_col: f[4] }, xf(f)); G.blend(); };
    const flameB = (...f) => flames([f]);
    // a sconce's fire warms the stone round it: painted onto the wall before the flame, so the flame's core stays clean
    const halo = (x, y, col, i) => { if (col[0] >= col[2]) L.glow(x, y - 16, 52, col, 0.2 * flick(i), 3.0); };
    // a struck fire flares and leans away from the blow, swings back past upright once and settles
    const blown = (id, hh) => { const e = knocked[id], a = e ? GT - e.t : 9; return a < 1.2 ? { fl: 1 + 0.55 * Math.exp(-4 * a), lean: e.s * hh * 0.45 * Math.exp(-3.5 * a) * Math.cos(7 * a) } : { fl: 1, lean: 0 }; };
    for (const b of bandX) Y.push(b);
    // water weed stands up out of the water, its foot under the surface, stirring in the slow current
    for (const o of m.flora || []) if (o.n === 'weed_cv' && vis(o.x, o.y)) Y.push([o.y, () => { const [w0, h0] = SZ('weed_cv'), w = w0 * o.s, hh = h0 * o.s * 0.86, sd = o.x * 0.37 + o.y * 0.11;
      ripple(o.x, o.y, w * 0.45, sd, 0.2);
      L.sprite('weed_cv', ev2(sx(o.x)) - w / 2, ev2(sy(o.y)) - hh, { w, h: hh, rot: 0.035 * Math.sin(t * 0.9 + sd), pivot: [w / 2, hh], src: [0, 0, 1, 0.86], flip: !!o.f, u: { grade: [0.9, 0.9, 0, 1] } }); }]);
    // the secrets' covers: a banner that sways in the draught and falls when torn, a bookshelf that breaks; a wall worked by a
    // mechanism sinks into the floor (a top wall's face slides down, other sides' rock settles away)
    (m.secrets || []).forEach((q, i) => { if (!vis(q.x, q.y) || inSecret(q)) return; const kind = q.kind || 'crack', a = q.open ? GT - (q.openT ?? -9) : -1;
      if (kind === 'banner') { const [w, hh] = SZ('banner'), top = q.y + 6 - hh;
        if (!q.open) { const near = 1 - SS(50, 170, Math.hypot(h.x - q.x, h.y - q.y)), rot = (0.006 + 0.035 * near) * Math.sin(t * 2.1 + i) + 0.01 * near * Math.sin(t * 5.3);
          Y.push([q.y - 40, () => L.sprite('banner', 0, 0, { m: M.of(M.t(sx(q.x), sy(top)), M.r(rot)), w, h: hh, pivot: [w / 2, 0] })]); }
        else if (a < 0.5) { const p = a / 0.5; Y.push([q.y - 40, () => L.sprite('banner', 0, 0, { m: M.of(M.t(sx(q.x) + 10 * p, sy(top) + 30 * p * p), M.r(0.5 * p * p)), w, h: hh * (1 - 0.5 * p * p), pivot: [w / 2, 0] })]); }
        else Y.push([q.y - 60, () => L.sprite('banner', sx(q.x) - w * 0.55 + 10, sy(q.y) + 4, { w: w * 1.1, h: hh * 0.32, u: { grade: [0.8, 0.75, 0, 1] } })]); }
      if (kind === 'shelf') { const k = m.decor.findIndex((o) => o.secret === i), d = m.decor[k]; if (!d || d.broken) return;
        Y.push([d.y, () => drawProp('bookshelf', sx(d.x), sy(d.y), { dy: 4, j: jig('d' + k) })]); }
      if (kind === 'lever' && q.open && a < 1.8) { const p = SS(0.15, 1.6, a), xs = q.wall.map((c) => c[0]), ys = q.wall.map((c) => c[1]), jit = Math.sin(GT * 70) * 1.5 * (1 - p);
        const x0 = Math.min(...xs) * TILE, x1 = (Math.max(...xs) + 1) * TILE, y0 = Math.min(...ys) * TILE, y1 = (Math.max(...ys) + 1) * TILE;
        if (q.dir === 'u') { const TSW = 224, Hf = (y1 - y0) * (1 - p), u0 = (x0 % TSW) / TSW, v0 = (y0 % TSW) / TSW;
          if (Hf > 0.5) Y.push([q.y - 1, () => { L.sprite(B.wall, sx(x0) + jit, sy(y0) + (y1 - y0) * p, { w: x1 - x0, h: Hf, src: [u0, v0, u0 + (x1 - x0) / TSW, v0 + Hf / TSW], u: { grade: [0.9, 1.05, 0, 1.05], tint: [B.tint[0], B.tint[1], B.tint[2], 1] } });
            L.solid(sx(x0) + jit, sy(y0) + (y1 - y0) * p, x1 - x0, 3, [0.02, 0.015, 0.02], 0, 0, 0, 0.75); }]); }
        else Y.push([q.y - 1, () => { const u0 = (x0 % 96) / 96, v0 = (y0 % 96) / 96; L.sprite(B.top, sx(x0) + jit, sy(y0) + 6 * p, { w: x1 - x0, h: y1 - y0, src: [u0, v0, u0 + (x1 - x0) / 96, v0 + (y1 - y0) / 96], u: { grade: [0.55, TOP_LIFT * (1.0 - 0.4 * p), 0, 1], tint: topTint(B), alpha: 1 - p } }); }]); } });
    // doors (TASKS 77, 78). Two views of one leaf: face-on (door_leaf) and edge-on (door_edge_a seen from the left, _b from the
    // right; one painting each, never mirrored, so the light stays top-left). A top wall's door stands face-on in its arch and opens
    // edge-on along the corridor's left side; a bottom wall's the same without the arch. A side wall's stands edge-on in the gap
    // (the wall's own flat top is its jambs) and opens face-on, in shadow, against the corridor's back wall. The swing cross-fades
    for (const d of m.doors || []) { if (!vis(d.x, d.y)) continue; const i = m.doors.indexOf(d), lock = SIM.doorLock(m, d);
      const a = d.open ? GT - (d.openT ?? -9) : -1, p = d.open ? 1 - Math.pow(1 - Math.min(1, a / (d.kick ? 0.16 : 0.32)), 3) : 0;
      const bump = ST.ev.find((e) => e.k === 'locked' && e.i === i && GT - e.t >= 0 && GT - e.t < 0.3), jit = bump ? Math.sin((GT - bump.t) * 90) * 2 * (1 - (GT - bump.t) / 0.3) : 0;
      const side = d.dir === 'l' || d.dir === 'r', s = d.dir === 'r' ? 1 : -1, X = sx(d.x) + jit, un = ST.ev.find((e) => e.k === 'unlatch' && e.i === i && GT - e.t >= 0 && GT - e.t < 0.7);
      const fa = 1 - SS(0.15, 0.55, p), ea = SS(0.35, 0.8, p);   // the two views overlap only briefly mid-swing
      const E = DEDGE, k = E.k, ew = ASSETS.door_edge_a.w * k, eh = ASSETS.door_edge_a.h * k;
      // the lock on the leaf: a padlock, or the iron bar along its bands (face-on level, edge-on on the bands' slope)
      const locks = (cx, cy, ang, len, al) => { if (!lock && !un) return;
        if (lock && lock.kind === 'lever') { const bh = Math.max(9, len * ASSETS.door_bar.h / ASSETS.door_bar.w); L.sprite('door_bar', 0, 0, { m: [Math.cos(ang), Math.sin(ang), 0, 1, cx - Math.cos(ang) * len / 2, cy - Math.sin(ang) * len / 2 - bh / 2], w: len / Math.cos(ang), h: bh, u: { alpha: al, grade: [1.35, 0.6, 0, 1] } }); }
        const [w, hh] = SZ('padlock');
        if (lock && lock.kind === 'key') L.sprite('padlock', cx - w / 2, cy - hh / 2, { w, h: hh, u: { alpha: al } });
        if (un) { const q = GT - un.t; L.sprite('padlock', cx - w / 2 + 30 * q, cy - hh / 2 - 60 * q + 260 * q * q, { w, h: hh, rot: 4 * q, pivot: [w / 2, hh / 2], u: { alpha: 1 - SS(0.5, 0.7, q) } }); } };
      // an edge-on leaf drawn in horizontal strips, each sorted by the foot of its own rows: the far end goes behind whoever stands
      // beside the door, the near end in front of them
      const edge = (n, left, topW, al, lk) => { const farW = topW + E.far * k, nearW = topW + E.near * k, H0 = ASSETS[n].h;
        for (let j = 0; j < 4; j++) { const r0 = H0 * j / 4, r1 = H0 * (j + 1) / 4, key = Math.max(farW, Math.min(nearW, topW + r1 * k));
          Y.push([key, () => { L.sprite(n, left, sy(topW) + r0 * k, { w: ew, h: (r1 - r0) * k, src: [0, r0 / H0, 1, r1 / H0], u: { alpha: al } });
            if (lk && j === 2) { const a0 = n === 'door_edge_a' ? E.band : -E.band, cx = left + (n === 'door_edge_a' ? E.lock[0] : ASSETS[n].w - E.lock[0]) * k; locks(cx, sy(topW) + E.lock[1] * k, a0, ew * 0.95, al); } }]); } };
      if (side) {
        const nearW = d.y + TILE, topW = nearW - E.near * k, n = s > 0 ? 'door_edge_a' : 'door_edge_b';
        if (p < 1) edge(n, X - ew / 2 + s * ew * 0.45, topW, fa, true);   // in the door's own cells: the room's fog never dims it
        // open, it stands ajar at ~60°, hinged at the gap's far end, its free edge clearly nearer the camera and in shadow (≤ 0.7 of a
        // shut leaf's brightness, doors_r2): it reads as swung back, never as a door in the corridor's wall
        if (p > 0) { const fy = sy(d.y - TILE) + 4, ux = s * Math.sin(1.05) * DOOR.w, uy = Math.cos(1.05) * DOOR.w;
          Y.push([d.y - TILE + 4 + uy, () => { for (let j = 0; j < 4; j++) L.shadow(X + ux * (j + 0.5) / 4, fy + uy * (j + 0.5) / 4 + 2, DOOR.w / 7, 4, 0.5 * p);
            L.sprite('door_leaf', 0, 0, { m: [ux / DOOR.w, uy / DOOR.w, 0, 1, X, fy - DOOR.h], w: DOOR.w, h: DOOR.h, flip: s < 0, u: { alpha: ea, grade: [0.45, 0.7, 0, 1] } }); }]); }
        continue; }
      const foot = sy(d.y) + (d.dir === 'd' ? TILE : 0), footW = d.y + (d.dir === 'd' ? TILE : 0);
      if (p < 1) Y.push([footW, () => { if (d.dir === 'd') L.shadow(X, foot + 1, DOOR.w / 2 + 2, 4, 0.5 * (1 - p));
        L.sprite('door_leaf', X - DOOR.w / 2, foot - DOOR.h, { w: DOOR.w, h: DOOR.h, u: { alpha: fa, grade: d.dir === 'd' ? [0.8, 0.9, 0, 1] : [1, 1, 0, 1] } });
        locks(X - DOOR.w * 0.04, foot - DOOR.h * 0.36, 0, d.dir === 'u' ? DOOR.fw * 0.78 : DOOR.w + 6, fa); }]);
      // open: hinged at the left jamb, the leaf runs off into the corridor, up from a top wall (seen from the right, its near end
      // at the hinge) or down from a bottom wall (seen from the left, its far end at the hinge)
      if (p > 0) { if (d.dir === 'u') edge('door_edge_b', X - DOOR.w / 2 - E.nearX * k, d.y - E.near * k, ea);
        else edge('door_edge_a', X - DOOR.w / 2 - E.farX * k, d.y + 4 - E.far * k, ea); }
      if (d.dir === 'u') Y.push([d.y + 0.5, () => L.sprite('door_frame', X - DOOR.fw / 2, foot - DOOR.fh + 3, { w: DOOR.fw, h: DOOR.fh })]); }
    // a locked room's lever on a top wall: up until pulled, then down for good
    for (const Lk of m.locks || []) { const lv = Lk.lever; if (Lk.kind !== 'lever' || !lv || !vis(lv.x, lv.y)) continue;
      const down = Lk.open && GT - (Lk.openT ?? -9) > 0.08, n = down ? 'lever_down' : 'lever_up', [ax, ay] = down ? [101, 92] : [189, 164], k = 30 / 190, A0 = ASSETS[n];
      Y.push([lv.y - 20, () => L.sprite(n, sx(lv.x) - ax * k, sy(lv.y) - ay * k, { w: A0.w * k, h: A0.h * k })]); }
    m.torches.forEach((tc, i) => { if (!vis(tc.x, tc.y) || hid(tc)) return; const col = torchCol(m, tc), lit = known(tc.x, tc.y), j = jig('t' + i), { fl, lean } = blown('t' + i, 36);
      if (tc.kind === 'wall' && tc.side) Y.push([tc.y - 20, () => { drawProp('torch_sconce', sx(tc.x), sy(tc.y) + 16, { flip: tc.side > 0, j }); if (lit) { halo(sx(tc.x) - tc.side * 9 + (j ? j.dx : 0), sy(tc.y) - 6, col, i); flameB(sx(tc.x) - tc.side * 9 + (j ? j.dx : 0), sy(tc.y) - 6, 20 * fl, 36 * fl, col, i, lean); } }]);
      else if (tc.kind === 'wall' && tc.lever !== undefined) { const q = m.secrets[tc.lever], pull = q && q.open ? SS(0, 0.22, GT - q.openT) : 0, rot = 0.07 + 0.6 * pull, c = Math.cos(rot), s = Math.sin(rot);
        Y.push([tc.y - 20, () => { drawProp('torch_sconce', sx(tc.x), sy(tc.y) + 16, { j: { rot, dx: 0, sy: 1 } }); if (lit) flameB(sx(tc.x) + 3 * c + 41 * s + 7 * pull, sy(tc.y) + 37 + 3 * s - 41 * c - 6 * pull, 20 * fl, 36 * fl, col, i, lean); }]); }
      else if (tc.kind === 'wall') Y.push([tc.y - 20, () => { drawProp('torch_sconce', sx(tc.x), sy(tc.y) + 16, { j }); if (lit) { halo(sx(tc.x) + 3 + (j ? j.dx + Math.sin(j.rot) * 40 : 0), sy(tc.y) - 4, col, i); flameB(sx(tc.x) + 3 + (j ? j.dx + Math.sin(j.rot) * 40 : 0), sy(tc.y) - 4, 20 * fl, 36 * fl, col, i, lean); } }]);
      else { const big = tc.kind === 'fire', up = big ? 44 : 32, bl = blown('t' + i, big ? 80 : 50);
        // the cave's camp fire burns in a ring of stones on the ground (TASKS 306), not in a brazier
        const camp = big && B.cave, lo = camp ? 12 : up;
        Y.push([tc.y, () => { L.shadow(sx(tc.x), sy(tc.y) + 2, big ? 30 : 18, 6, 0.5); drawProp(camp ? 'campfire_cv' : 'brazier', sx(tc.x), sy(tc.y), { k: big && !camp ? 1.35 : 1, dy: camp ? 10 : 4, j });
          if (lit) flameB(sx(tc.x) + (j ? j.dx + Math.sin(j.rot) * lo : 0), sy(tc.y) - lo, (big ? 44 : 26) * bl.fl, (big ? 64 : 40) * bl.fl, col, i, bl.lean); }]); } });
    for (const d of m.decor) { const t2 = d.n === 'candles' && d.lift && onTable(d); if (t2 && vis(d.x, d.y) && known(d.x, d.y) && !hid(d)) Y.push([d.y + 1, () => flames(TABLE_WICKS.map(([ox, oy]) => [sx(t2.x) + ox, sy(t2.y) + 4 - oy + 2, 7, 12, [1, 0.7, 0.35], d.x + ox]))]); }
    for (const d of m.decor) if (d.n === 'candles' && (d.outUntil || 0) <= GT && !(d.lift && onTable(d)) && vis(d.x, d.y) && known(d.x, d.y) && !hid(d)) Y.push([d.y + 1, () => flames([0, 1, 2].map((k) => [sx(d.x) + [-8, 0, 9][k], sy(d.y) - (d.lift || 0) - [16, 28, 18][k], 9, 15, [1, 0.7, 0.35], d.x + k]))]);
    // standing lights (TASKS 194): their fires ride the prop when it is knocked
    m.decor.forEach((d, i) => { const S0 = STAND[d.n]; if (!S0 || !vis(d.x, d.y) || !known(d.x, d.y) || hid(d)) return; const j = jig('d' + i), col = d.n === 'torch_stand' ? torchCol(m, d) : CANDLE;
      Y.push([d.y + 1, () => flames(S0.map(([ox, up, w, hh], k) => [sx(d.x) + ox + (j ? j.dx + Math.sin(j.rot) * up : 0), sy(d.y) + 4 - up, w, hh, col, d.x + 7 * k]))]); });
    // the shop: the merchant behind his counter (it hides his legs), the scales and his coins on top of it
    const sh = m.shop;
    if (sh && vis(sh.x, sh.y)) { const ds = Math.hypot(h.x - sh.x, h.y - sh.y), near = 1 - SS(140, 300, ds), look = Math.max(-1, Math.min(1, (h.x - sh.x) / 120));
      Y.push([sh.y, () => { L.shadow(sx(sh.x), sy(sh.y) + 2, 26, 6, 0.4);
        L.inked(() => MONSTERS.merchant({ id: 'merchant', x: sx(sh.x), y: sy(sh.y), H: SZ('merchant')[1], t: GT, look, near, greetT: R.shop.greetT, tradeT: R.shop.tradeT, hitT: R.shop.hitT, seed: m.seed % 7, U: {} }), { r: 2, n: 8, col: [0.09, 0.04, 0.04], dy: 0 }); }]);
      Y.push([sh.counter.y, () => { const c = sh.counter, [cw] = SZ('shop_counter'); L.shadow(sx(c.x), sy(c.y) + 2, cw * 0.5, 7, 0.5); drawProp('shop_counter', sx(c.x), sy(c.y), { dy: 4 });
        const top = sy(c.y) - 24 - (SZ('shop_counter')[1] - 42);
        drawProp('shop_scales', sx(c.x) - 26, top); drawProp('shop_gems', sx(c.x) + 28, top); }]); }
    for (const s of R.shrines) if (vis(s.x, s.y)) Y.push([s.y, () => { L.shadow(sx(s.x), sy(s.y) + 2, 26, 7, 0.5); drawProp('altar', sx(s.x), sy(s.y), { dy: 6, u: { grade: s.used ? [0.5, 0.7, 0, 1] : [1, 1, 0, 1] } }); }]);
    // each spike slides out of its hole (only the part above the lip shows): tips peek and rattle just before the strike,
    // then the sheaves shoot up for the up phase the sim hurts in
    for (const tp of m.traps) { if (!vis(tp.x, tp.y)) continue; const ph = ((GT / 2.4 + tp.ph) % 1 + 1) % 1;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const q = ph - j * 0.01, up = q < 0.29 && q > 0 ? SS(0, 0.025, q) * (1 - SS(0.25, 0.29, q)) : 0, k = Math.max(up, 0.3 * SS(0.82, 0.86, ph));
        if (k < 0.02) continue; const bx = tp.x - TILE + TRAP_HOLE.x[i] * 2 * TILE, by = tp.y - TILE + TRAP_HOLE.y[j] * 2 * TILE, jit = up < 0.5 && ph > 0.82 ? Math.sin(GT * 70 + i * 2 + j) * 0.7 : 0;
        Y.push([by + 6, () => { for (const [dx, dy, sw, sh, tex] of TRAP_SPIKE) L.sprite(tex, sx(bx + dx) - sw / 2 + jit, sy(by + dy) - k * sh, { w: sw, h: k * sh, src: [0, 0, 1, k] }); }]); } }
    // a body on the floor sorts under everyone standing: lying across the band it would cover the living in front of it
    for (const e of R.en) if (vis(e.x, e.y)) { const fl = e.deadT >= 0 && GT - e.deadT > deathOf(e).dl + deathOf(e).dur; Y.push([e.y - (fl ? 1000 : 0), () => drawEnemy(e, sx(e.x), sy(e.y), GT, t)]); }
    for (const p of R.drops) if (vis(p.x, p.y)) Y.push([p.y, () => drawDrop(p, sx(p.x), sy(p.y), GT, t)]);
    Y.push([h.y + (GT - h.atkT >= 0 && GT - h.atkT < 0.2 ? 90 : 0), () => {   // during the strike the blade must read over the target it hits
      L.shadow(sx(h.x), sy(h.y) + 2, 20, 6, 0.85);
      if (GT - h.dashT < 0.3) for (let k = 3; k >= 1; k--) { const a = GT - h.dashT; drawHero(h, sx(h.x - h.dashX * k * 22 * SS(0, 0.16, a)), sy(h.y - h.dashY * k * 22 * SS(0, 0.16, a)), GT, st, { alpha: 0.18 * (1 - a / 0.3), id: 'ghost' + k }); }
      if (!SC.hide.hero) L.inked(() => drawHero(h, sx(h.x), sy(h.y), GT, st), { r: 2, n: 8, col: [0.024, 0.02, 0.024], dy: 0 });
    }]);
    L.SNAP = 1; try { Y.sort((a, b) => a[0] - b[0]).forEach(([, d]) => d()); } finally { L.SNAP = 0; }

    // ===== light map =====
    const ab = 0.5 / Math.max(...B.amb), AMB = [0.34, 0.40, 0.58], ak = B.ambK || 0.3, amb = AMB.map((v, i) => (1 - ak) * v + ak * B.amb[i] * ab); G.bind(LT.light, [...amb, 1]); G.blend('add');
    const lt = (x, y, r, col, amt, k = 2.2) => { if (x < cx - r || x > cx + VW + r || y < cy - r || y > cy + VH + r) return; G.draw(L.P.glow, { u_col: col, u_k: k, u_amt: amt }, G.xf(sx(x) - r, sy(y) - r * 0.8, 2 * r, 1.6 * r)); };
    // the hero is the frame's focus: a wide fill plus a tight warm key on the body that barely reaches the floor around him.
    // Away from fire the fill is the player's lamp: 3–4 cells of floor, traps and foes must read in a dark corridor (TASKS 170)
    lt(h.x, h.y - 30, 250, [0.8, 0.72, 0.6], 0.1 + 0.9 * (1 - HERO.k) ** 2); lt(h.x, h.y - 44, 95, [1, 0.88, 0.7], 0.85 * (1 - 0.8 * HERO.k), 2.4);
    for (const e of R.en) if (e.deadT < 0 && e.st !== 'idle' && e.st !== 'lurk' && vis(e.x, e.y)) lt(e.x, e.y - 40, 70, [1, 0.8, 0.6], 0.12);
    for (const [id, p] of Object.entries(RIM.hands)) lt(p[0] + cx, p[1] + cy, 60, [0.5, 1, 0.3], 0.8);
    TL.forEach((q) => lt(...q)); GL.forEach((q) => lt(...q));
    for (const r of m.rooms) if (r.zone) { const col = D.BIOMES[r.zone].torch, nx = Math.max(1, Math.round((r.w - 2) / 8)), ny = Math.max(1, Math.round((r.h - 2) / 8));
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) lt((r.x + 1 + (r.w - 2) * (i + 0.5) / nx) * TILE, (r.y + 1 + (r.h - 2) * (j + 0.5) / ny) * TILE, 150, col, D.BIOMES[r.zone].fill || 0.32, 1.8); }
    for (const d of m.decor) if (d.n === 'crystal' && !hid(d)) lt(d.x, d.y - 30, 220, [0.35, 0.6, 1.0], 0.9 * flick(d.x));
    // the shop is lit warm and bright: lanterns by its ways in, a lamp over the counter
    if (m.shop) { for (const q of m.shop.lanterns) lt(q.x, q.y - 40, 190, [1, 0.78, 0.45], 0.85 * flick(q.x)); lt(m.shop.x, m.shop.y - 50, 260, [1, 0.82, 0.55], 0.75); }
    for (const [x, y] of lavaCells) { if ((x + y) % 2 === 0) lt(x * TILE + 16, y * TILE + 16, 140, [1.0, 0.42, 0.12], 0.55 * flick(x * 3 + y)); lt(x * TILE + 16, y * TILE + 16, 24, [1.0, 0.75, 0.55], 1.2, 1.6); }
    for (const q of R.lavaPending || []) lt((q.cell % m.W) * TILE + 16, Math.floor(q.cell / m.W) * TILE + 16, 80, [1, 0.45, 0.12], 0.55 * warnOf(q));
    for (const s of R.shrines) if (!s.used) lt(s.x, s.y - 20, 200, [0.4, 0.7, 1.0], 0.9);
    if (m.floor === D.runOf(R.mode).floors && R.bossDead) lt(m.exit.x, m.exit.y - 20, 320, [0.5, 0.7, 1.0], 1.4);
    for (const p of R.proj) lt(p.x, p.y + 20, p.own === 'hero' ? 140 : 150, p.k === 'hex' ? [0.4, 1.0, 0.4] : [1.0, 0.55, 0.2], p.own === 'hero' ? 0.65 : 1.2);
    // every item on the floor carries a little white light of its own, so its colours read under any room's tint
    for (const p of R.drops) if (p.kind === 'key') lt(p.x, p.y - 14, 80, [1, 0.85, 0.5], 0.6);
    for (const p of R.drops) if (p.kind === 'item') { lt(p.x, p.y - 14, 46, [1, 0.97, 0.92], 0.7, 2.4); if (p.item.rar >= 2) lt(p.x, p.y - 10, 90, D.RARITY[p.item.rar].col, 0.5); }
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0) continue;
      if (e.k === 'prop' && e.mat === 'crystal' && a < 0.7) lt(e.x, e.y - 30, 260, [0.4, 0.65, 1.0], 1.4 * (1 - a / 0.7));
      if (e.k === 'prop' && (e.n === 'brazier' || e.n === 'torch_sconce') && a < 0.6) lt(e.x, e.y - 30, 240, [1.0, 0.6, 0.25], 0.9 * (1 - a / 0.6));
      if (e.k === 'boom' && a < 0.3) lt(e.gx ?? e.x, e.gy ?? e.y + 24, 180, [1.0, 0.6, 0.25], 0.6 * (1 - a / 0.3));
      if (e.k === 'whirl' && a < 0.25) lt(e.x, e.y - 20, 190, weaponCol(e.rar || 0), 0.6 * (1 - a / 0.25));
      if (e.k === 'lvl' && a < 1.5) lt(e.x, e.y - 30, 300, [1, 0.85, 0.4], 1.5 * (1 - a / 1.5));
      if (e.k === 'swing' && a < 0.22) lt(h.x + Math.cos(e.a) * 30, h.y - 30 + Math.sin(e.a) * 20, 150, [1, 0.9, 0.75], 0.7 * (1 - a / 0.22));
      if (e.k === 'pop' && a < 0.3) lt(e.x, e.y + 20, e.hero ? 200 : 120, e.c === 'hex' ? [0.4, 1, 0.4] : [1, 0.55, 0.2], (e.hero ? 1.4 : 0.8) * (1 - a / 0.3));
      if (e.k === 'teleport' && a < 0.9) { const q = 1 - a / 0.9; lt(e.x, e.y - 30, 260, [0.55, 0.75, 1], 1.6 * q); lt(e.fx ?? e.x, (e.fy ?? e.y) - 30, 220, [0.55, 0.75, 1], 1.2 * q); }
      if (e.k === 'floor' && a < 1.6) lt(e.x, e.y - 20, 300, [1, 0.85, 0.55], 1.2 * (1 - a / 1.6));
      if (e.k === 'roar' && a < 0.8) lt(e.x, e.y + 40, 420, [1, 0.3, 0.12], 1.4 * (1 - a / 0.8));
      if (e.k === 'die' && a < 1.6) lt(e.x, e.y - 40 - 60 * SS(0.3, 1.6, a), 200, [0.5, 0.7, 1], 0.9 * SS(0.2, 0.5, a) * (1 - SS(1.2, 1.6, a)));
      if (e.k === 'spike' && a < 0.2) lt(e.x, e.y, 110, [1, 0.9, 0.75], 0.5 * (1 - a / 0.2)); }
    if (h.shield > 0 && GT < h.shieldUntil) lt(h.x, h.y - 30, 160, [0.4, 0.7, 1], 0.7);
    for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'secret' && a >= 0 && a < 1.2) lt(e.x, e.y, 340, [0.7, 0.8, 1], ((e.kind || 'crack') === 'crack' ? 1.4 : 0.7) * (1 - a / 1.2)); }
    for (const e of R.en) if (e.elite && e.type !== 'boss' && e.deadT < 0 && e.st !== 'lurk') lt(e.x, e.y + 4, 110, modCol(e), 0.3 + 0.1 * Math.sin(t * 3 + e.id));
    // an explosive corpse's fuse: its light swells and beats faster until the burst
    for (const e of ST.ev) { const a = GT - e.t; if (e.k === 'fuse' && a >= 0 && a < e.d) { const q = a / e.d; lt(e.x, e.y, e.r * 1.6, [1, 0.8, 0.35], (0.3 + 0.9 * q) * (0.6 + 0.4 * Math.sin(a * (8 + 30 * q)))); } }
    G.blend();
    // ===== lit composite (fog of war: unexplored cells stay black) =====
    G.bind(LT.lit); G.blend('none'); G.full(L.P.lit, { u_src: L.T.comp, u_light: LT.light, u_seen: seen, u_void: voidTex(m), u_top: topTex(m), u_veins: veinTex(m), u_water: waterTex(m), u_amb: amb, u_seam: B.seam || 0, u_cave: B.cave ? 1 : 0, u_cam: [cx, cy], u_map: [MW, MH], u_t: t, u_rock: B.rock, u_vein: B.vein }); G.blend();

    // ===== emissive pass =====
    G.blend('add');
    if (lavaXf) G.draw(L.P.lava, lavaU(1), lavaXf);
    for (const q of R.lavaPending || []) { const x = (q.cell % m.W) * TILE + 16, y = Math.floor(q.cell / m.W) * TILE + 16; if (!vis(x, y) || !known(x, y)) continue;
      const u = warnOf(q), beat = 0.7 + 0.3 * Math.sin(GT * (8 + 10 * u) + q.cell); L.glow(sx(x), sy(y), 12 + 10 * u, [1, 0.42, 0.1], (0.2 + 0.7 * u) * beat, 2.4); }
    G.blend();
    G.blend('add');
    // shrine and portal
    if (m.shop) for (const q of m.shop.lanterns) if (vis(q.x, q.y) && known(q.x, q.y)) { const [lw0, lh0] = SZ('shop_lantern'); L.glow(sx(q.x) + lw0 * 0.22, sy(q.y) - lh0 * 0.42, 16, [1, 0.8, 0.45], 0.7 * flick(q.y)); }
    // a mechanism catches the light now and then: a faint four-point glint for a third of a second every five or so, each on
    // its own beat, so it reads only to someone already looking at it
    (m.secrets || []).forEach((q, i) => { const P = q.trig; if (q.open || !P || inSecret(q)) return; const ph = (t + i * 1.73) % 5.2; if (ph > 0.35) return;
      const env = Math.sin(Math.PI * ph / 0.35), tc = P.k === 'sconce' ? m.torches[P.t] : null, x = tc ? tc.x - 8 : P.cx * TILE + 7, y = tc ? tc.y - 2 : P.cy * TILE + 6;
      if (vis(x, y) && known(x, y)) L.star(sx(x), sy(y), 12, [1, 0.94, 0.78], 0.5 * env); });
    // the cultist's free hand holds a green spark: the brightest point of the figure, as in the reference's enemy sheet
    for (const [id, p] of Object.entries(RIM.hands)) { const e = R.en.find((o) => String(o.id) === id); if (!e || !known(e.x, e.y)) continue; L.glow(p[0], p[1], 18, [0.5, 1, 0.3], 0.9); L.glow(p[0], p[1], 6, [0.9, 1, 0.8], 0.9, 4); }
    // crystals and cold-fire torches carry a halo of their own, so the arcane blue is a light source, not a tint
    for (const d of m.decor) if (d.n === 'crystal' && !hid(d) && vis(d.x, d.y) && known(d.x, d.y)) L.glow(sx(d.x), sy(d.y) - 30, 40, [0.3, 0.55, 1], 0.8 * flick(d.x));
    // a cold fire carries a halo of its own over everything (a warm sconce's is painted on the wall behind it, `halo`)
    m.torches.forEach((tc, i) => { const col = torchCol(m, tc); if (hid(tc) || !vis(tc.x, tc.y) || !known(tc.x, tc.y)) return;
      if (col[2] > col[0]) L.glow(sx(tc.x) - (tc.side || 0) * 9, sy(tc.y) - 14, 34, col, 0.75 * flick(i), 3.2); });
    for (const s of R.shrines) if (!s.used && vis(s.x, s.y) && known(s.x, s.y)) { L.glow(sx(s.x), sy(s.y) - 34, 30, [0.4, 0.7, 1.0], 0.5 + 0.2 * Math.sin(t * 3)); }
    // gold catches the light: loose coins, heaps and spilt coins keep a yellow sheen the fire's orange can't take, and twinkle pale
    // yellow, each on its own beat (TASKS 167)
    const glint = (x, y, n, k, sheen = true) => { if (sheen) L.glow(sx(x), sy(y) + 2, 6 + 3 * n, [0.9, 0.95, 0.3], 0.7, 3); for (let j = 0; j < n; j++) { const ph = (t * (0.7 + 0.3 * rnd(k, j)) + rnd(k, j + 5)) % 1.6; if (ph > 0.5) continue;
      L.star(sx(x) + (rnd(k, j + 9) - 0.5) * 16, sy(y) - 4 - rnd(k, j + 13) * 10, 9, [1, 0.92, 0.5], 0.8 * Math.sin(Math.PI * ph / 0.5)); } };
    for (const p of R.drops) if (p.kind === 'gold' && !p.got && vis(p.x, p.y) && known(p.x, p.y)) glint(p.x, p.y - p.z, 2, p.id);
    for (const p of R.pots) if ((p.kind === 'gold' || p.kind === 'goldpile') && p.hp > 0 && !hid(p) && vis(p.x, p.y) && known(p.x, p.y)) glint(p.x, p.y - 8, 3, p.x * 7 + p.y);
    for (const d of m.decals) if (d.n === 'dc_coins' && vis(d.x, d.y) && known(d.x, d.y)) glint(d.x, d.y + 4, 1, d.x * 3 + d.y);
    // the gold chest's coins are painted in the concept's golds (tools/goldchest.py): the sheen would turn them green, they only twinkle
    for (const c of R.chests) if (c.gold && c.open && vis(c.x, c.y) && known(c.x, c.y)) { glint(c.x - 8, c.y - 22, 3, c.x, false); glint(c.x + 10, c.y - 18, 2, c.y, false); }
    // embers: single art pixels rising off every fire and the lava's cracks and dying out, each on its own beat; the concept's fires
    // throw off sparks, and the hot specks of its frame are these points, not more glow (TASKS 184)
    const embers = (x, y, n, rise, col, k) => { for (let j = 0; j < n; j++) { const q = (t * (0.45 + 0.2 * rnd(k, j)) + rnd(k, j + 3)) % 1; if (q > 0.85) continue;
      const ex = x + (rnd(k, j + 7) - 0.5) * 10 + Math.sin(t * 1.7 + j * 2.1 + k) * 5 * q, ey = y - rise * q * (0.7 + 0.3 * rnd(k, j + 11));
      G.blend('add'); L.solid(Math.round(sx(ex) / PIX) * PIX, Math.round(sy(ey) / PIX) * PIX, PIX, PIX, q < 0.35 ? col.map((v) => 0.5 + 0.5 * v) : col, 0, 0, 0, 1.8 * Math.pow(1 - q / 0.85, 0.6)); G.blend(); } };
    m.torches.forEach((tc, i) => { if (!vis(tc.x, tc.y) || hid(tc) || !known(tc.x, tc.y)) return; const col = torchCol(m, tc), big = tc.kind === 'fire';
      if (tc.kind === 'wall') embers(tc.x + (tc.side ? -tc.side * 9 : 3), tc.y - 30, 2, 34, col, i * 13 + 1);
      else embers(tc.x, tc.y - (big ? 44 + 40 : 32 + 26), big ? 5 : 3, big ? 70 : 46, col, i * 13 + 2); });
    for (const d of m.decor) if (d.n === 'torch_stand' && vis(d.x, d.y) && known(d.x, d.y) && !hid(d)) embers(d.x, d.y + 4 - STAND.torch_stand[0][1] - 20, 3, 40, torchCol(m, d), d.x + d.y);
    for (const [x, y] of lavaCells) if (rnd(x, y) < 0.6 && known(x * TILE, y * TILE)) embers((x + rnd(y, x)) * TILE, (y + 0.5) * TILE, 1, 30, [1, 0.62, 0.15], x * 31 + y);
    // the mushrooms' caps and the crystals glow over their own light, and the mushrooms shed spores: single pale motes drifting up
    // and sideways a long way, slower than embers, each on its own beat (TASKS 305)
    for (const d of m.decor) { const g = GLOW[d.n]; if (!g || hid(d) || !vis(d.x, d.y) || !known(d.x, d.y)) continue; const col = B[g.col] || GLOW_COL[g.col], b = glowBeat(d, t);
      L.glow(sx(d.x), sy(d.y) - g.up, g.cap * 2.4, col, 0.32 * b, 2.4); L.glow(sx(d.x), sy(d.y) - g.up, g.cap, col.map((v) => 0.5 + 0.5 * v), 0.22 * b, 3);
      if (g.col !== 'shroom') continue;
      for (let j = 0; j < 4; j++) { const k = d.x * 7 + d.y * 13, q = (t * (0.12 + 0.06 * rnd(k, j)) + rnd(k, j + 3)) % 1; if (q > 0.9) continue;
        const ex = d.x + (rnd(k, j + 7) - 0.5) * 22 + Math.sin(t * 0.7 + j * 2.3 + k) * 14 * q, ey = d.y - g.up + 4 - 70 * q * (0.6 + 0.4 * rnd(k, j + 11));
        G.blend('add'); L.solid(Math.round(sx(ex) / PIX) * PIX, Math.round(sy(ey) / PIX) * PIX, PIX, PIX, col.map((v) => 0.4 + 0.6 * v), 0, 0, 0, 0.9 * Math.sin(Math.PI * q / 0.9)); G.blend(); } }
    // roof drops: a short pale streak speeding down, then a crown of two motes on stone or a ring on the water
    for (const q of m.drips || []) { if (!vis(q.x, q.y) || !known(q.x, q.y)) continue; const a = dripAge(q, t), land = q.p - DRIP_FALL;
      G.blend('add');
      if (a >= land) { const f = (a - land) / DRIP_FALL, y = q.y - 90 * (1 - f * f); L.solid(Math.round(sx(q.x) / PIX) * PIX, Math.round(sy(y) / PIX) * PIX, PIX, PIX * 3, [0.55, 0.75, 0.8], 0, 0, 0, 0.55 * SS(0, 0.2, f)); }
      else if (a < 0.45) { const f = a / 0.45;
        if (q.wet) L.ring(sx(q.x), sy(q.y), 3 + 14 * f, (3 + 14 * f) * 0.45, [0.55, 0.78, 0.82], 0.5 * (1 - f), 0.25);
        else for (const s of [-1, 1]) L.solid(Math.round((sx(q.x) + s * 7 * f) / PIX) * PIX, Math.round((sy(q.y) - 10 * Math.sin(Math.PI * Math.min(1, f * 1.6))) / PIX) * PIX, PIX, PIX, [0.5, 0.7, 0.75], 0, 0, 0, 0.6 * (1 - f)); }
      G.blend(); }
    if (m.floor === D.runOf(R.mode).floors && R.bossDead) G.draw(L.P.portal, { u_t: t, u_amt: 1 }, G.xf(sx(m.exit.x) - 46, sy(m.exit.y) - 80, 92, 92));
    // projectiles
    for (const p of R.proj) { if (p.own === 'hero' && p.k === 'fire' || !known(p.x, p.y)) continue; const x = sx(p.x), y = sy(p.y), col = p.k === 'hex' ? [0.45, 1.0, 0.4] : [1.0, 0.55, 0.18], a = Math.atan2(p.vy, p.vx);
      for (let k = 6; k >= 0; k--) { const f = k / 6; L.glow(x - Math.cos(a) * k * 7, y - Math.sin(a) * k * 7, (p.r + 4) * (1 - f * 0.6) * 1.6, col, 0.5 * (1 - f), 2.5); }
      L.glow(x, y, p.r * 2.2, [1, 0.95, 0.8], 0.9, 3); }
    // elites: a few embers drift up off the body, over the halo drawn behind it
    for (const e of R.en) { if (!e.elite || D.BOSSES[e.type] || e.deadT >= 0 || e.st === 'lurk' || !vis(e.x, e.y) || !known(e.x, e.y)) continue;
      const E = D.ENEMIES[e.type], x = sx(e.x), y = sy(e.y), hh = SZ(EN_TEX[e.type])[1] * 1.3;
      for (let j = 0; j < 4; j++) { const q = (t * 0.45 + rnd(e.id, j)) % 1, an = rnd(e.id, j + 7) * 6.28;
        L.star(x + Math.cos(an) * (E.r * 1.3 + 6) * (1 - 0.5 * q) + 6 * Math.sin(t * 2 + j), y - hh * (0.25 + 0.9 * q), 4 + 2 * (1 - q), modCol(e, j), Math.sin(Math.PI * q) * 0.6); } }
    // the forge lord is charred dark, or his red skin vanished into his own red-lit arena; his heat shows as a breathing glow in the
    // chest and embers off the body (TASKS 232)
    for (const e of R.en) { if (e.type !== 'boss_forge' || e.deadT >= 0 || !vis(e.x, e.y) || !known(e.x, e.y)) continue;
      const E = D.ENEMIES[e.type], x = sx(e.x), y = sy(e.y), hh = SZ(EN_TEX[e.type])[1] * D.BOSSES[e.type].scale, pu = 0.5 + 0.5 * Math.sin(t * 2.2);
      L.glow(x, y - hh * 0.58, 20 + 5 * pu, [1, 0.5, 0.12], 0.55 + 0.25 * pu, 3);
      for (let j = 0; j < 9; j++) { const q = (t * 0.5 + rnd(e.id, j)) % 1, an = rnd(e.id, j + 7) * 6.28;
        L.star(x + Math.cos(an) * E.r * 1.1 * (1 - 0.4 * q) + 7 * Math.sin(t * 2 + j), y - hh * (0.15 + 0.95 * q), 4 + 3 * (1 - q), [1, 0.5 + 0.3 * rnd(e.id, j + 3), 0.12], Math.sin(Math.PI * q) * 0.8); } }
    // event FX
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || !known(e.x, e.y)) continue; const ex = sx(e.x), ey = sy(e.y);
      // the crescent is a vertical C on the chest, ±ARC_HALF about the aim, drawn in the blade's turning direction over the strike so
      // it stands whole on the damage frame (the concept's slash); after the hit it fades and its tail runs after the head
      if (e.k === 'swing' && a >= SWING.pull && a < SWING.end) { const f = e.f < 0 ? -1 : 1, RG = RIGS.hero, s = HERO_H / RG.h;
        const shx = ex + f * (RG.shR[0] - RG.gap) * s, shy = ey + (RG.shR[1] - RG.footL[1]) * s, tx = ex + Math.cos(e.a) * st.reach * 0.8, ty = ey + Math.sin(e.a) * st.reach * 0.8 - 34;
        const sw = swingPose(a, f > 0 ? Math.atan2(ty - shy, tx - shx) : Math.PI - Math.atan2(ty - shy, tx - shx), st.arc * Math.PI / 180, -0.95);
        const cx = 2 * Math.round(ex / 2), cy = 2 * Math.round((ey - 0.5 * HERO_H) / 2), g = Math.atan2(ty - cy, tx - cx), Rr = 2 * Math.round(0.62 * HERO_H / 0.8 / 2);
        const p = 1 - (1 - Math.min(1, (a - SWING.pull) / (SIM.K.HIT - SWING.pull))) ** 2, q = SS(SIM.K.HIT, SIM.K.HIT + 0.1, a), span = 2 * ARC_HALF * f * sw.dir;
        const e0 = g - span / 2 + 0.3 * span * q, e1 = g - span / 2 + span * p, amt = 1.3 * (1 - q * q), open = p > 0.02 && q < 1;
        const pt = (b) => [cx + Math.cos(b) * Rr * 0.8, cy + Math.sin(b) * Rr * 0.8];
        L.joint('hero_fx', 'trailC', [cx, cy]); L.joint('hero_fx', 'trail', pt(e1)); L.joint('hero_fx', 'trailMid', pt(e0 + ARC_MID * (e1 - e0)));
        L.joint('hero_fx', 'aim', [cx + Math.cos(g) * 40, cy + Math.sin(g) * 40]);
        L.joint('hero_fx', 'trailA', [open ? amt * p : 0, 0]);
        if (open) G.draw(L.P.arc, { u_arc: [e0, e1, 0.12, 1], u_col: [1, 0.85, 0.6], u_sz: [2 * Rr, 2 * Rr], u_amt: amt, u_dark: 0.45 * (1 - q), u_hard: 1 }, G.xf(cx - Rr, cy - Rr, 2 * Rr, 2 * Rr)); }
      if (e.k === 'eswing' && a < 0.2) G.draw(L.P.arc, { u_arc: [e.a - 0.9, e.a + 0.9 * Math.min(1, a / 0.12), 0.2, 0.75], u_col: [1, 0.5, 0.4], u_amt: 1 - a / 0.2, u_dark: 0, u_hard: 0 }, G.xf(ex - 50, ey - 26 - 50, 100, 100));
      // a ghost's ectoplasm: glowing drops that drift up and thin out, they never reach the floor
      if (e.k === 'hit' && a < 0.6 && !e.fire && BLOOD(e.type) === 'ecto') { const q = a / 0.6; L.glow(ex, ey, 30 + 16 * q, [0.4, 1, 0.8], 0.7 * (1 - q), 2.4);
        for (let j = 0; j < 6; j++) { const an = rnd(e.t, j + 20) * 6.28, d = 6 + 26 * Math.sqrt(q); L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d * 0.7 - 34 * q, 5 + 3 * rnd(e.t, j), [0.5, 1, 0.85], 0.9 * (1 - q)); } }
      if (e.k === 'hit' && a < 0.3) { const q = a / 0.3; for (let j = 0; j < (e.crit ? 9 : 5); j++) { const an = rnd(e.t, j) * 6.28, d = 8 + 34 * q * (0.5 + rnd(e.t, j + 9));
          L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d, e.crit ? 12 : 8, e.fire ? [1, 0.6, 0.2] : [1, 0.85, 0.6], (e.fire ? 0.6 : 1) * (1 - q)); } }
      if (e.k === 'scorch' && a < 0.4) { const q = a / 0.4; L.glow(ex, ey - 6, 34, [1, 0.5, 0.15], 0.3 * (1 - q), 2.4); L.ring(ex, ey, 10 + 22 * q, 6 + 10 * q, [1, 0.55, 0.2], 0.6 * (1 - q), 0.2); }
      if (e.k === 'boom' && a < 0.65) {
        const gx = e.gx ?? e.x, gy = e.gy ?? e.y + 24, k = e.big ? 1.4 : 1;
        for (let j = 0; j < 18; j++) {
          const an = rnd(e.t, j) * Math.PI * 2, speed = (65 + 135 * rnd(e.t, j + 3)) * k, d = speed * a, lift = Math.max(0, (65 + rnd(e.t, j + 8) * 100) * a - 180 * a * a);
          const x = gx + Math.cos(an) * d, y = gy + Math.sin(an) * d / 1.3 - lift, r = 2 + 3 * (1 - a / 0.65);
          spell('fireball', x, y, r * 1.5, r * 1.5, { u_center: [x, y], u_origin: [gx, gy], u_dir: [Math.cos(an), Math.sin(an)], u_radius: r, u_age: a, u_amt: 0.6 * (1 - a / 0.65), u_seed: j + e.t, u_mode: 1, u_lift: lift });
        }
      }
      if (e.k === 'cast' && a < 0.25) L.glow(ex, ey, 30, [1, 0.6, 0.2], 0.4 * (1 - a / 0.25), 3);
      if (e.k === 'eshoot' && a < 0.3) L.glow(ex, ey, 26, [0.4, 1, 0.4], 1 - a / 0.3, 3);
      if (e.k === 'slam' && a < 4.6) L.cracks(ex, ey, e.big ? 130 : 70, a, e.id || 1, 1);
      if (e.k === 'lvl' && a < 1.6) { const q = a / 1.6; L.ring(ex, ey, 30 + 80 * q, 14 + 36 * q, [1, 0.85, 0.4], 1 - q, 0.1); for (let j = 0; j < 14; j++) { const an = j / 14 * 6.28;
          L.star(ex + Math.cos(an) * (20 + 30 * q), ey - 20 - 90 * q * (0.5 + rnd(j, 2)), 9, [1, 0.85, 0.4], 1 - q); } }
      if ((e.k === 'pickup' || e.k === 'gold' || e.k === 'shard' || e.k === 'chest') && a < 0.5) { const q = a / 0.5, col = e.k === 'shard' ? [0.4, 0.7, 1] : e.k === 'pickup' ? D.RARITY[e.rar || 0].col : [1, 0.85, 0.3];
        for (let j = 0; j < 6; j++) { const an = j / 6 * 6.28 + e.t; L.star(ex + Math.cos(an) * 26 * q, ey - 10 + Math.sin(an) * 18 * q - 20 * q, 9, col, 1 - q); } }
      if ((e.k === 'shield' || e.k === 'barrier') && a < 0.4) L.ring(ex, ey - 30, 30 + 30 * (a / 0.4), 40 + 30 * (a / 0.4), [0.5, 0.8, 1], 1 - a / 0.4, 0.15);
      if (e.k === 'drink' && a < 0.6) for (let j = 0; j < 8; j++) { const q = a / 0.6, an = j / 8 * 6.28 + a * 6; L.star(ex + Math.cos(an) * 20, ey - 10 - 60 * q * (0.4 + rnd(j, 1)), 7, e.b === 'hp_potion' ? [1, 0.35, 0.35] : [0.4, 0.6, 1], 1 - q); }
      // the fuse: the blast's true reach drawn on the floor, a second ring closing in on it as the time runs out
      if (e.k === 'fuse' && a < e.d) { const q = a / e.d, beat = 0.6 + 0.4 * Math.sin(a * (8 + 30 * q));
        L.ring(ex, ey, e.r, e.r, [1, 0.8, 0.35], (0.35 + 0.5 * q) * beat, 0.03); L.ring(ex, ey, e.r * q, e.r * q, [1, 0.6, 0.2], 0.5 * beat, 0.08);
        L.glow(ex, ey - 20, 40 + 30 * q, [1, 0.75, 0.3], 0.4 * q * beat, 2.4); }
      // a vampire's blow: blood drawn off the hero into the elite
      if (e.k === 'drain' && a < 0.5) for (let j = 0; j < 7; j++) { const u = Math.min(1, Math.max(0, (a - j * 0.03) / 0.3)); if (u <= 0 || u >= 1) continue;
        L.star(ex + (sx(e.tx) - ex) * u, ey + (sy(e.ty) - ey) * u - 30 * Math.sin(Math.PI * u), 8, [0.95, 0.1, 0.18], 1 - u * 0.5); }
      if (e.k === 'summon' && a < 0.6) { const q = a / 0.6; L.ring(ex, ey, 20 + 30 * q, 10 + 15 * q, [0.5, 1, 0.4], 1 - q, 0.2); L.glow(ex, ey - 20, 50, [0.4, 1, 0.3], 1 - q); }
      if (e.k === 'bless' && a < 1.2) { const q = a / 1.2; L.glow(ex, ey - 30, 90, [0.5, 0.8, 1], 1.4 * (1 - q)); L.ring(ex, ey, 40 + 90 * q, 20 + 45 * q, [0.6, 0.85, 1], 1 - q, 0.1); }
      // an enemy bolt bursts where it dies; on the hero it splashes wider with a ring
      if (e.k === 'pop' && a < (e.hero ? 0.4 : 0.25)) { const q = a / (e.hero ? 0.4 : 0.25), col = e.c === 'hex' ? [0.45, 1, 0.4] : [1, 0.55, 0.18];
        L.glow(ex, ey, (e.hero ? 46 : 26) * (1 + 0.5 * q), col, 0.35 * (1 - q), 2.4); if (e.hero) L.ring(ex, ey, 14 + 40 * q, 10 + 28 * q, col, 0.6 * (1 - q), 0.18);
        for (let j = 0; j < (e.hero ? 8 : 4); j++) { const an = rnd(e.t, j) * 6.28, d = 6 + (e.hero ? 40 : 22) * q; L.star(ex + Math.cos(an) * d, ey + Math.sin(an) * d * 0.8, 7, col, 0.6 * (1 - q)); } }
      // a knocked prop: sparks off metal and stone, a brazier spits embers, crystal flares
      if (e.k === 'prop' && a < 0.9) { const [pw, ph] = SZ(e.n), ix = ex - e.s * pw * 0.3, iy = ey - ph * 0.45;
        if ((e.mat === 'metal' || e.mat === 'stone') && a < 0.3) { const q = a / 0.3; for (let j = 0; j < (e.mat === 'metal' ? 8 : 4); j++) { const an = Math.PI * (e.s > 0 ? 1 : 0) + (rnd(e.t, j) - 0.5) * 2.4, v = 90 + 120 * rnd(e.t, j + 5);
          L.star(ix + Math.cos(an) * v * a, iy + Math.sin(an) * v * a * 0.7 + 260 * a * a, 6, [1, 0.88, 0.6], 1 - q); } }
        if (e.n === 'brazier' || e.n === 'torch_sconce' || e.mat === 'fire') for (let j = 0; j < (e.n === 'torch_sconce' ? 7 : 10); j++) { const q = a / 0.9, an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 1.6, v = 60 + 110 * rnd(e.t, j + 3);
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
    for (const e of ST.ev) { const a = GT - e.t; if (a < 0 || !known(e.x, e.y)) continue; const ex = sx(e.x), ey = sy(e.y);
      if (e.k === 'step' && !e.wet && a < 0.4) { const q = a / 0.4; L.puff(ex, ey - 2 - 6 * q, 5 + 8 * q, [0.35, 0.3, 0.27], 0.35 * (1 - q), e.t * 10); }
      if (e.k === 'step' && e.wet && a < 0.6) { const q = a / 0.6, col = B.water.map((v) => Math.min(1, v * 3 + 0.15));
        L.ring(ex, ey + 2, 5 + 27 * q, 2 + 12 * q, col, 0.65 * (1 - q), 0.07);
        L.ring(ex - 2, ey + 3, 2 + 19 * q, 1 + 8 * q, col, 0.3 * (1 - q), 0.09);
        for (let j = 0; j < 3; j++) { const an = rnd(e.t, j) * 6.28, v = 25 + 30 * rnd(e.t, j + 4), u = Math.min(a, 0.32);
          L.solid(ex + Math.cos(an) * v * u, ey + Math.sin(an) * v * u * 0.5 - 65 * u + 210 * u * u, 3, 4, col, an, 1, 2, 1 - SS(0.2, 0.34, a)); } }
      // the drowned bursts up out of the shallows (TASKS 307): rings and a sheet of drops thrown high
      if (e.k === 'rise' && a < 0.9) { const q = a / 0.9, col = B.water.map((v) => Math.min(1, v * 3 + 0.2));
        L.ring(ex, ey + 2, 12 + 46 * q, 5 + 18 * q, col, 0.7 * (1 - q), 0.06); L.ring(ex, ey + 3, 6 + 30 * SS(0.15, 1, q), 3 + 12 * SS(0.15, 1, q), col, 0.45 * (1 - q), 0.09);
        for (let j = 0; j < 12; j++) { const an = rnd(e.t, j) * 6.28, v = 30 + 50 * rnd(e.t, j + 4), up = 120 + 90 * rnd(e.t, j + 8), u = Math.min(a, 0.55);
          L.solid(ex + Math.cos(an) * v * u, ey - 20 + Math.sin(an) * v * u * 0.5 - up * u + 420 * u * u, 3, 4, col, an, 1, 2, 1 - SS(0.4, 0.6, a)); } }
      // a drowned's blow sheds water, not blood; a slime's spatters green gobs (and more of them when it lands, splits or bursts)
      if (e.k === 'hit' && a < 0.45 && !e.fire && BLOOD(e.type) === 'water') { const col = B.water.map((v) => Math.min(1, v * 3 + 0.2));
        for (let j = 0; j < 5; j++) { const an = rnd(e.t, j + 20) * 6.28, v = 30 + 40 * rnd(e.t, j + 4), u = Math.min(a, 0.4); L.solid(ex + Math.cos(an) * v * u, ey + Math.sin(an) * v * u * 0.6 - 40 * u + 300 * u * u, 2, 4, col, an, 1, 2, 1 - SS(0.3, 0.45, a)); } }
      { const gob = e.k === 'hit' && !e.fire && BLOOD(e.type) === 'slime' ? 5 : e.k === 'land' ? 4 : e.k === 'split' ? 12 : e.k === 'kill' && BLOOD(e.type) === 'slime' ? 9 : 0;
        if (gob && a < 0.55) { const big = e.k === 'split' || e.type === 'slime' ? 1 : 0.7;
          for (let j = 0; j < gob; j++) { const an = rnd(e.t, j + 30) * 6.28, v = (40 + 60 * rnd(e.t, j + 4)) * big, u = Math.min(a, 0.45), up = e.k === 'hit' ? 40 : 90;
            const px = ex + Math.cos(an) * v * u, py = ey - (e.k === 'hit' ? 0 : 12) + Math.sin(an) * v * u * 0.55 - up * u + 380 * u * u, sz = (3 + 2 * rnd(e.t, j + 9)) * big;
            L.solid(px, py, sz + 1, sz + 1, [0.06, 0.16, 0.05], 0, (sz + 1) / 2, (sz + 1) / 2, 1 - SS(0.4, 0.55, a)); L.solid(px, py, sz - 1, sz - 1, [0.3, 0.68, 0.2], 0, (sz - 1) / 2, (sz - 1) / 2, 1 - SS(0.4, 0.55, a)); } } }
      if ((e.k === 'douse' || e.k === 'snuff') && a < 0.6) { const q = a / 0.6, steam = e.k === 'douse';
        for (let j = 0; j < 3; j++) L.puff(ex + (j - 1) * (steam ? 9 : 7) + Math.sin(q * 5 + j) * 4, ey - (steam ? 16 : [16, 28, 18][j]) - (steam ? 38 : 26) * q, (steam ? 9 : 4) + 10 * q, steam ? [0.88, 0.92, 0.94] : [0.4, 0.39, 0.37], (steam ? 0.75 : 0.5) * (1 - q), e.t * 13 + j); }
      if (e.k === 'hollow' && a < 0.6) { const q = a / 0.6;
        for (let j = 0; j < 4; j++) L.puff(ex + (j - 1.5) * 10, ey + 8 + 14 * q, 4 + 10 * q, [0.4, 0.36, 0.34], 0.45 * (1 - q), e.t * 11 + j); }
      if (e.k === 'prop' && e.mat === 'bone' && a < 0.7) { const n = 3 + (parseInt(e.i.slice(1), 10) % 3);
        for (let j = 0; j < n; j++) { const an = j / n * 6.28 + rnd(e.t, j), u = Math.min(a, 0.38), px = ex + Math.cos(an) * (45 + 20 * rnd(e.t, j + 7)) * u, py = ey + Math.sin(an) * 28 * u - 70 * u + 185 * u * u, rot = an + u * 8, al = 1 - SS(0.45, 0.7, a);
          L.solid(px, py, 9, 4, [0.23, 0.2, 0.17], rot, 4, 2, al); L.solid(px, py - 1, 7, 2, [0.73, 0.69, 0.57], rot, 3, 1, al);
          for (const side of [-1, 1]) L.solid(px + side * Math.cos(rot) * 3, py + side * Math.sin(rot) * 3 - 1, 3, 3, [0.73, 0.69, 0.57], rot, 1.5, 1.5, al); } }
      if (e.k === 'dash' && a < 0.45) for (let j = 0; j < 5; j++) { const q = a / 0.45, s = rnd(e.t, j); L.puff(ex - e.dx * (10 + 60 * q * s), ey - e.dy * (10 + 60 * q * s) - 4, 7 + 12 * q, [0.35, 0.3, 0.27], 0.45 * (1 - q), e.t + j); }
      // a skeleton chips: bone splinters thrown up, they bounce once on the floor at its feet and fade
      if (e.k === 'hit' && a < 0.7 && !e.fire && BLOOD(e.type) === 'bone') { const fl = ey + D.ENEMIES[e.type].h * 0.5 + 6;
        for (let j = 0; j < (e.crit ? 9 : 6); j++) { const an = -Math.PI / 2 + (rnd(e.t, j + 20) - 0.5) * 2.6, v = 50 + 80 * rnd(e.t, j + 7), long = rnd(e.t, j + 3) < 0.4;
          L.solid(ex + Math.cos(an) * v * a, Math.min(fl - 4 * rnd(e.t, j + 2), ey + Math.sin(an) * v * a - 60 * a + 520 * a * a), long ? 7 : 4, long ? 2 : 3, [0.86, 0.82, 0.7], an + a * 12 * (rnd(e.t, j + 4) - 0.5), long ? 3 : 2, 1, 1 - SS(0.5, 0.7, a)); } }
      // red blood; a spider's ichor is a sick green
      if (e.k === 'hit' && a < 0.45 && !e.fire && (!BLOOD(e.type) || BLOOD(e.type) === 'ichor')) for (let j = 0; j < 5; j++) { const q = a / 0.45, an = rnd(e.t, j + 20) * 6.28, d = 6 + 30 * q;
        L.puff(ex + Math.cos(an) * d, ey + Math.sin(an) * d + 50 * q * q, 3 + 2 * rnd(e.t, j), BLOOD(e.type) === 'ichor' ? [0.36, 0.46, 0.08] : [0.45, 0.04, 0.04], 0.9 * (1 - q), j); }
      if (e.k === 'break' && a < 0.7) for (let j = 0; j < 7; j++) { const q = a / 0.7, an = rnd(e.t, j) * 6.28, v = 40 + 60 * rnd(e.t, j + 7);
        L.solid(ex + Math.cos(an) * v * a, ey - 14 + Math.sin(an) * v * a * 0.6 - 120 * a + 300 * a * a, 5, 4, e.kind === 'pot' || e.kind.startsWith('vase') ? [0.5, 0.24, 0.14] : e.kind === 'gold' || e.kind === 'goldpile' ? [1, 0.78, 0.25] : [0.4, 0.26, 0.14], an, 2, 2, 1 - SS(0.5, 0.7, a)); }
      // a blow on a fake wall knocks out chips and a breath of dust; the break blows the stretch of wall into the room
      if (e.k === 'secret' && e.kind === 'shelf' && a < 1.2) { for (let j = 0; j < 18; j++) { const an = -Math.PI / 2 + (rnd(e.t, j) - 0.5) * 2.6, v = 80 + 140 * rnd(e.t, j + 7), px = ex + (rnd(e.t, j + 3) - 0.5) * 90 + Math.cos(an) * v * a * 0.6;
          const py = ey + 30 + Math.min(20 + 16 * rnd(e.t, j + 11), -Math.abs(Math.sin(an)) * v * a + 520 * a * a) - 30, book = j % 3 === 0, col = book ? [[0.45, 0.1, 0.08], [0.12, 0.2, 0.4], [0.3, 0.32, 0.12]][j % 9 / 3 | 0] : [0.4, 0.26, 0.14];
          L.solid(px, py, book ? 7 : 12, book ? 5 : 3, col, an + a * (book ? 4 : 7), 4, 2, 1 - SS(0.85, 1.2, a)); }
        for (let j = 0; j < 6; j++) { const q2 = Math.min(1, a / 1.2); L.puff(ex + (j - 2.5) * 16, ey + 40 + 14 * q2, 14 + 18 * q2, [0.36, 0.3, 0.26], 0.45 * (1 - q2), e.t * 11 + j); } }
      if (e.k === 'secret' && (e.kind === 'lever' || e.kind === 'banner') && a < 1.8) { const q2 = Math.min(1, a / 1.8), n = e.kind === 'lever' ? 8 : 3;
        for (let j = 0; j < n; j++) L.puff(ex + (j - (n - 1) / 2) * 12, ey + 22 - 10 * q2, 12 + 20 * q2, [0.4, 0.36, 0.34], (e.kind === 'lever' ? 0.5 : 0.3) * Math.sin(Math.PI * q2), e.t * 11 + j); }
      // a door flung open blows the dust off its threshold
      if (e.k === 'door' && a < 0.9) { const D0 = m.doors[e.i], side = D0 && (D0.dir === 'l' || D0.dir === 'r'), n = e.kick ? 12 : 7;
        for (let j = 0; j < n; j++) { const q = a / 0.9, an = rnd(e.t, j) * 6.28, v = (20 + 40 * rnd(e.t, j + 3)) * (e.kick ? 1.6 : 1), ox = side ? 0 : (rnd(e.t, j + 9) - 0.5) * 60, oy = side ? (rnd(e.t, j + 9) - 0.5) * 60 : 0;
          L.puff(sx(e.x + ox) + Math.cos(an) * v * q, sy(e.y + oy) - 4 + Math.sin(an) * v * q * 0.5 - 10 * q, 6 + 10 * q, [0.45, 0.4, 0.36], 0.35 * (1 - q), e.t + j); } }
      if ((e.k === 'wallhit' || (e.k === 'secret' && (e.kind || 'crack') === 'crack')) && a < 1.4) { const big = e.k === 'secret', n = big ? 22 : 8, life = big ? 1.1 : 0.7;
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
        if ((col || mat === 'cloth') && a < 0.7) for (let j = 0; j < 3; j++) { const q = a / 0.7; L.puff(ix + (j - 1) * 9 - e.s * 14 * q, iy + 10 * q, 7 + 10 * q, [0.4, 0.36, 0.33], 0.35 * (1 - q), e.t * 7 + j); } }
      if (e.k === 'scorch' && a < 0.8) for (let j = 0; j < 3; j++) { const q = a / 0.8; L.puff(ex + (j - 1) * 7, ey - 8 - 26 * q, 6 + 8 * q, [0.12, 0.1, 0.1], 0.45 * (1 - q), e.t * 13 + j); }
      if (e.k === 'kill' && a < 0.6) for (let j = 0; j < 6; j++) { const q = a / 0.6; L.puff(ex + (j - 2.5) * 8, ey - 10 - 20 * q, 8 + 10 * q, e.type === 'ghost' ? [0.5, 0.7, 0.9] : [0.3, 0.27, 0.25], 0.5 * (1 - q), e.t + j); }
      if ((e.k === 'hurt' || e.k === 'die') && a < 0.45) for (let j = 0; j < (e.k === 'die' ? 9 : 5); j++) { const q = a / 0.45, an = rnd(e.t, j + 30) * 6.28, d = 6 + 30 * q, oy = e.k === 'die' ? -40 : 0;
        L.puff(ex + Math.cos(an) * d, ey + oy + Math.sin(an) * d + 50 * q * q, 3 + 2 * rnd(e.t, j), [0.5, 0.04, 0.04], 0.9 * (1 - q), j); }
      if (e.k === 'spike' && a < 0.5) for (let j = 0; j < 4; j++) { const q = a / 0.5; L.puff(ex + (j - 1.5) * 16, ey + 8 - 14 * q, 6 + 10 * q, [0.35, 0.3, 0.27], 0.4 * (1 - q), e.t * 9 + j); }
      if (e.k === 'roar' && a < 1.2) for (let j = 0; j < 10; j++) { const q = a / 1.2, an = j / 10 * 6.28; L.puff(ex + Math.cos(an) * (60 + 140 * q), ey + 70 + Math.sin(an) * (30 + 70 * q), 12 + 16 * q, [0.3, 0.25, 0.22], 0.4 * (1 - q), e.t + j); }
    }
    for (const e of R.en) if (e.deadT < 0 && e.shield > 0 && GT < e.shieldUntil && vis(e.x, e.y) && known(e.x, e.y)) { G.blend('add'); const f = 0.3 + 0.08 * Math.sin(t * 6), x = sx(e.x), y = sy(e.y) - 56; L.ring(x, y, 58, 65, [0.35, 0.9, 0.6], f, 0.2); L.glow(x, y, 65, [0.2, 0.7, 0.4], 0.2); G.blend(); }
    // the hero's magic shield bubble
    if (h.shield > 0 && GT < h.shieldUntil) { G.blend('add'); const f = 0.35 + 0.1 * Math.sin(t * 6); L.ring(sx(h.x), sy(h.y) - 32, 36, 44, [0.45, 0.75, 1], f, 0.25); L.glow(sx(h.x), sy(h.y) - 32, 44, [0.3, 0.55, 1], 0.25); G.blend(); }

    // ===== bloom + grade (on the lit target) =====
    const scr = screenFx(ST, R, h, st, GT);
    const comp = L.T.comp; L.T.comp = LT.lit; L.finish(t, Object.assign({ bloom: [0.18, 0.14], vignette: 0.85, warm: 0.2, roll: 1, dither: 1 }, scr)); L.T.comp = comp;
    if (window.HUD) HUD.draw(ST, t, { cx, cy, sx: (x) => (x - cx) * Z, sy: (y) => (y - cy) * Z, k: Z, st });
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
    if (p.qaHide) return;   // tools/lootvis.mjs: the frame without the item's sprite, its light kept
    const z = p.z || 0, bob = p.z > 0 ? 0 : 2 * Math.sin(t * 3 + p.id);
    L.shadow(x, y + 2, 10, 4, 0.4);
    if (p.kind === 'gold') { const k = Math.min(1, 0.5 + p.n / 40), [w, hh] = SZ('it_gold'), coin = (a) => L.sprite('it_gold', x - w * 0.3 * k, y - z - hh * 0.6 * k, { w: w * 0.6 * k, h: hh * 0.6 * k, u: a ? { alpha: a, tint: GOLD_TINT } : {} });
      coin(); emitted(coin); return; }
    if (p.kind === 'key') { G.blend('add'); L.glow(x, y - z - 14 - bob, 30, [1, 0.8, 0.4], 0.7); G.blend(); const [w, hh] = SZ('it_key'); L.sprite('it_key', x - w * 0.3, y - z - hh * 0.6 - 4 - bob, { w: w * 0.6, h: hh * 0.6 }); return; }
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
      ['menu_cave_armed', mk((S) => { S.saved = SIM.newRun(S, 'cave', 5); S.saved.floor = 4; S.saved.hero.lvl = 13; S.resetT = S.t; S.resetM = 'cave'; })],
      ['play', play()],
      ['play_worst', play((S) => { worst(S); S.run.msg = { s: 'Повелитель Демонов повержен! Портал наружу открыт — путь на поверхность свободен, герой', t: S.t - 1 }; })],
      ['inv', play((S) => { worst(S); S.screen = 'inv'; })],
      ['inv_empty', play((S) => { worst(S); S.screen = 'inv'; S.hover = 'eq:offhand'; S.run.seen = S.run.seen.map(() => 1); })],
      ['item_balance', play((S) => {
        worst(S); S.screen = 'inv'; S.hover = 'bag:23';
        S.run.hero.eq.armor = { id: 3000, b: 'plate_armor', lvl: 6, rar: 3, def: 15, mods: {} };
        S.run.hero.bag[23] = { id: 3001, b: 'leather_armor', lvl: 8, rar: 4, def: 24, mods: { hp: 72, mp: 38, aspd: 16, regen: 3 } };
      })],
      // TASKS 182: a bag piece against a worn one of the same slot with other affixes; the swap costs health though its defence is higher
      ['item_compare', play((S) => {
        worst(S); S.screen = 'inv'; S.hover = 'bag:23'; const h = S.run.hero;
        h.eq.amulet = { id: 3010, b: 'amulet', lvl: 5, rar: 3, mods: { hp: 64, vit: 4, crit: 3, regen: 1.5 } };
        h.bag[23] = { id: 3011, b: 'amulet', lvl: 7, rar: 4, mods: { def: 6, int: 5, mp: 40, fire: 18, leech: 2 } };
      })],
      ['debug', play((S) => { S.debug = 1; SIM.debugSecrets(S, S.run); S.hover = 'dbg_secrets'; S.run.msg = null; })],
      ['debug_loot', play((S) => { S.debug = 1; S.dbgLoot = 1; S.hover = 'dbg_loot'; const R = S.run; R.msg = null; R.seen = R.seen.map(() => 1); SIM.fstat(R).loot = 999; SIM.fstat(R).lootN = 99999; })],
      ['pause', play((S) => { S.screen = 'pause'; S.run.msg = { s: 'Этаж 1 — Подземелье', t: S.t - 1 }; })],
      ['meta', mk((S) => { S.screen = 'meta'; S.meta.shards = 99999; S.meta.up = Object.fromEntries(D.META.map((M, i) => [M.id, i % 3 ? M.max - 1 : i % 2 ? M.max : 0])); })],
      ['meta_refuse', mk((S) => { S.screen = 'meta'; S.meta.shards = 0; S.hover = 'gear'; S.ev.push({ k: 'nope', s: 'Не хватает осколков', t: S.t - 0.2 }); })],
      // a dungeon altar at its widest: the longest gift of each tier, one affordable, one hovered, a refusal; then the gifts in the HUD
      ...[['altar_screen', 99999, 'gift:1'], ['altar_poor', 5, 'gift:2']].map(([id, bank, hv]) => [id, play((S) => {
        const R = S.run, h = R.hero, long = (tier) => D.GIFTS.filter((g) => g.tier === tier).sort((a, b) => b.desc.length + b.name.length - a.desc.length - a.name.length)[0].id;
        R.shrines = [{ x: h.x + 70, y: h.y, used: 0, gifts: [1, 2, 3].map((tier) => ({ id: long(tier), cost: bank > 999 ? 999 : D.giftCost(tier, 8) })) }]; R.altar = 0;
        S.meta.shards = bank; S.screen = 'altar'; S.hover = hv; if (bank < 999) S.ev.push({ k: 'nope', s: 'Не хватает осколков душ', t: S.t - 0.2 }); })]),
      ['altar_prompt', play((S) => { const R = S.run, h = R.hero; R.shrines = [{ x: h.x + 50, y: h.y - 20, used: 0 }]; })],
      // the interaction plate with its target on each side of the hero and the stairs right under him: it never covers him
      ...[['s', 0, 36], ['n', 0, -40], ['e', 44, 0], ['se', 30, 30]].map(([d, dx, dy]) => ['prompt_chest_' + d, play((S) => { const R = S.run, h = R.hero; R.chests.push({ x: h.x + dx, y: h.y + dy, tier: 1, open: 0 }); })]),
      ['prompt_exit', play((S) => { const R = S.run, h = R.hero; R.map.exit = { x: h.x, y: h.y + 40 }; })],
      ['gifts_hud', play((S) => { const h = S.run.hero; h.bless = 1; h.shield = 999; h.shieldUntil = S.t + 3; h.burn = h.poison = S.t + 2;
        h.perks = Object.fromEntries(D.GIFTS.filter((g) => g.id !== 'bless').map((g) => [g.id, 3])); })],
      ['dead', mk((S) => { S.screen = 'dead'; S.result = { how: 'dead', floor: 8, lvl: 99, kills: 9999, gold: 999999, shards: 99999, found: 9999, base: 12529, statBonus: 40, cap: 40, win: 0, time: 35999, C: { floors: 8, foes: 9999, kills: 9999, lootN: 9999, loot: 9999, secN: 16, sec: 16, pct: 1 } }; })],
      ['win', mk((S) => { S.screen = 'win'; S.result = { how: 'win', floor: 8, lvl: 99, kills: 9999, gold: 999999, shards: 99999, found: 9999, base: 12529, statBonus: 40, cap: 40, win: 30, time: 35999, C: { floors: 8, foes: 9999, kills: 9999, lootN: 9999, loot: 9999, secN: 16, sec: 16, pct: 1 } }; })],
      ['dead_short', mk((S) => { S.screen = 'dead'; S.result = { how: 'dead', floor: 1, lvl: 1, kills: 0, gold: 0, shards: 0, found: 0, base: 0, statBonus: 0, cap: 5, win: 0, time: 12, C: { floors: 1, foes: 20, kills: 0, lootN: 30, loot: 0, secN: 0, sec: 0, pct: 0 } }; })],
    ];
    for (const [name, S] of states.filter(([n]) => ['dead', 'win', 'dead_short'].includes(n))) {
      const R = SIM.newRun(S, 'campaign', 1234); S.result.hero = R.hero; S.result.heroStats = SIM.stats(R.hero, S.meta);
      if (name !== 'dead_short') S.meta.shards = 99999;
      S.result.damage = name === 'dead_short' ? [] : [{ t: 1, src: 'lava', n: 28 }, { t: 2, src: 'boss снаряд', n: 75 },
        { t: 3, src: 'brute (элита) взрыв', n: 180, actor: { type: 'brute', elite: 1, mods: ['explosive', 'vampire'] } }];
    }
    for (const [name, src, actor] of [['dead_caster', 'cultist (элита) снаряд', { type: 'cultist', elite: 1, mods: ['summoner', 'vampire'] }], ['dead_lava', 'lava', null],
      ['dead_ghost', 'ghost', { type: 'ghost', elite: 0 }], ['dead_boss', 'boss', { type: 'boss', elite: 1 }]]) {
      const S = structuredClone(states.find(([n]) => n === 'dead')[1]); S.result.damage[2] = { t: 3, src, n: 99, actor }; states.push([name, S]);
    }
    const abandoned = structuredClone(states.find(([n]) => n === 'dead')[1]); abandoned.result.abandoned = true; states.push(['end_abandoned', abandoned]);
    for (const b of ['longsword', 'axe', 'hammer', 'staff', 'fist']) {
      const S = structuredClone(states.find(([n]) => n === 'win')[1]);
      S.result.hero.eq.weapon = b === 'fist' ? null : { b, rar: 4, lvl: 8, mods: {} }; S.result.heroStats = SIM.stats(S.result.hero, S.meta);
      states.push(['win_' + b, S]);
    }
    for (const [name, gold, donations, used] of [['altar_donation', 123456, 4, 0], ['altar_used', 99999, 8, 1], ['altar_limit', 99999, 10, 1]]) {
      const S = structuredClone(states.find(([n]) => n === 'altar_screen')[1]); S.run.hero.gold = gold; S.run.donations = donations; S.run.shrines[0].used = used; S.hover = 'donate'; states.push([name, S]);
    }
    for (const pct of [0.84, 0.85, 1]) states.push(['completion_' + Math.round(pct * 100), play((S) => {
      const R = S.run, f = SIM.fstat(R); R.msg = null; R.seen = R.seen.map(() => 1); f.foes = f.lootN = 100; f.kills = f.loot = Math.round(pct * 100);
      R.en = R.en.slice(0, 2);
    })]);
    for (const [name, age] of [['shard_flash', 0.1], ['shard_flight', 0.55], ['shard_arrival', 1.05]]) {
      states.push([name, play((S) => { worst(S); S.run.msg = null; const h = S.run.hero; S.ev = [{ k: 'shard', x: h.x, y: h.y, n: 3, floor: S.run.floor, t: S.t - age }]; })]);
    }
    states.push(['shard_floor', play((S) => { SIM.enterFloor(S, S.run, 8); worst(S); S.run.msg = { s: 'Этаж 8 — Трон Демона', t: S.t - 0.8 }; const h = S.run.hero; S.ev = [{ k: 'shard', x: h.x, y: h.y, n: 10, floor: 8, s: 'Все враги этажа повержены · +10 осколков душ', t: S.t - 0.8 }]; })]);
    // the reference's composition: a fight in a lit room with an accent zone in the frame's far side, monsters standing apart
    // on a ring around the hero mid-swing, a chest and gold at the back wall
    // the fight mid-frame (its room half a view clear of the map's edges, so the camera never clamps), the blue hall in the frame's
    // lower right, the green crypt in its upper right and a lava field in its left third: the zones are set on the seed's own
    // layout, not searched for (TASKS 189)
    // seed 290 is the one a search over the 189 / 184 measures picked (SC.matchSeed starts the search elsewhere)
    const match = (() => { for (let sd = SC.matchSeed || 290; sd < 900; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run; let m = R.map;
      const MW = m.W * TILE, MH = m.H * TILE, ctr = (r) => [(r.x + r.w / 2) * TILE, (r.y + r.h / 2) * TILE];
      const fits = (r) => { const [x, y] = ctr(r); return x >= 0.52 * VW && MW - x >= 0.52 * VW && y >= 0.52 * VH && MH - y >= 0.52 * VH; };
      const rm = m.rooms.find((r) => r.type === 'combat' && r.w >= 12 && r.h >= 8 && fits(r));
      if (!rm) continue;
      // each zone the room nearest to where the concept has it: the blue hall at 88 % of the width and 72 % of the height, the crypt
      // at 77 % and 23 % (but left of the minimap)
      const hx = ctr(rm)[0], hy = ctr(rm)[1] + 16, zr = (dx0, dx1, dy0, dy1, tx, ty) => m.rooms.filter((q) => q !== rm && (q.type === 'combat' || q.type === 'treasure') && q.w >= 7 && q.h >= 6)
        .map((q) => [q, ctr(q)[0] - hx, ctr(q)[1] - hy]).filter(([, dx, dy]) => dx >= dx0 && dx <= dx1 && dy >= dy0 && dy <= dy1).sort((a, b) => Math.hypot(a[1] - tx, a[2] - ty) - Math.hypot(b[1] - tx, b[2] - ty))[0];
      const arc = zr(0.22 * VW, 0.46 * VW, -0.05 * VH, 0.42 * VH, 0.37 * VW, 0.22 * VH), cry = zr(0.1 * VW, 0.3 * VW, -0.5 * VH, -0.08 * VH, 0.26 * VW, -0.27 * VH);
      if (!arc || !cry) continue;
      const cam = [hx - 0.51 * VW, hy - 0.51 * VH], inView = (r) => r.x * TILE < cam[0] + VW && (r.x + r.w) * TILE > cam[0] && r.y * TILE < cam[1] + VH && (r.y + r.h) * TILE > cam[1];
      // the concept's blue hall runs on to the frame's right edge: the rooms past it to the right and below join it
      const past = (r) => r !== rm && r !== cry[0] && ctr(r)[0] - hx > arc[1] + 4 * TILE && ctr(r)[1] - hy > -0.05 * VH;
      const zones = {}; for (const r of m.rooms) if (inView(r)) zones[r.id] = r === arc[0] || past(r) ? 'arcane' : r === cry[0] ? 'crypt' : null;
      const was = JSON.stringify(m.rooms.map((r) => [r.x, r.y, r.w, r.h])); SIM.enterFloor(S, R, 1, { zones }); m = R.map;
      if (JSON.stringify(m.rooms.map((r) => [r.x, r.y, r.w, r.h])) !== was) continue;
      const h = R.hero, inR = (o) => DUNGEON.roomAt(m, o.x, o.y) === rm.id;
      m.traps = m.traps.filter((t2) => !inR(t2)); m.decor = m.decor.filter((d) => d.wall || !inR(d)); R.pots = R.pots.filter((p) => !inR(p)); R.chests = R.chests.filter((c) => !inR(c)); m.torches = m.torches.filter((t2) => t2.kind === 'wall' || !inR(t2));
      for (const fx of [rm.x + 1.5, rm.x + rm.w - 1.5]) m.torches.push({ x: fx * TILE, y: (rm.y + 1.6) * TILE, kind: 'brazier', r: rm.id });
      h.x = hx; h.y = hy;
      h.eq.armor = { id: 3100, b: 'plate_armor', lvl: 1, rar: 0, def: 3, mods: {} }; h.eq.boots = { id: 3101, b: 'boots', lvl: 1, rar: 0, def: 1, mods: {} };   // the concept's hero wears steel (TASKS 166)
      R.cam = cam;
      // the concept's lava fills the frame's left third: a field of 10×7 cells with a ragged shore, wide enough for its crust and
      // plates, on the open floor there rather than the rock where it can, never in the fight's room or a doorway (TASKS 169, 189)
      { const c0 = Math.floor(cam[0] / TILE), r0 = Math.floor(cam[1] / TILE), dr = new Set((m.doors || []).flatMap((d) => d.cells.map(([x, y]) => y * m.W + x)));
        const shape = []; for (let j = 0; j < 7; j++) for (let k = 0; k < 10; k++) if (!((j === 0 || j === 6) && (k === 0 || k === 9)) && !(j === 0 && k === 8) && !(j === 6 && k === 1) && !(j === 3 && k === 9)) shape.push([k, j]);
        shape.push([-1, 2], [-1, 3], [10, 1], [10, 4], [3, -1], [4, -1], [5, 7], [6, 7]);
        const near = (x, y) => { for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const id = DUNGEON.roomAt(m, (x + k + 0.5) * TILE, (y + j + 0.5) * TILE); if (id === rm.id || (id >= 0 && !['combat', 'treasure'].includes(m.rooms[id].type)) || dr.has((y + j) * m.W + x + k)) return true; } return false; };
        let best = null;
        // as near as it can to where the concept has it: its top a third down the frame, at the left edge
        for (let y = r0 + 7; y <= r0 + 20; y++) for (let x = c0; x <= c0 + 9; x++) { let sc = 0;
          for (const [k, j] of shape) { const X = x + k, Y = y + j; if (X < 1 || Y < 1 || X >= m.W - 1 || Y >= m.H - 1 || near(X, Y)) { sc = -1; break; } sc += SIM.cell(m, X, Y) === 1 ? 2 : 1; }
          if (sc > 0) sc -= 8 * (Math.abs(y - r0 - 11) + Math.abs(x - c0 - 1));
          if (sc > 0 && (!best || sc > best[2])) best = [x, y, sc]; }
        const pool = best ? shape.map(([k, j]) => [best[0] + k, best[1] + j]) : [];
        const on = (o) => pool.some(([x, y]) => Math.abs(Math.floor(o.x / TILE) - x) <= 1 && Math.floor(o.y / TILE) - y >= -1 && Math.floor(o.y / TILE) - y <= 2);
        for (const [x, y] of pool) m.cells[y * m.W + x] = 3; m.lava = (m.lava || 0) + pool.length;
        m.decor = m.decor.filter((d) => !on(d)); R.pots = R.pots.filter((p) => !on(p)); R.chests = R.chests.filter((c) => !on(c)); m.torches = m.torches.filter((t2) => !on(t2)); m.traps = m.traps.filter((t2) => !on(t2)); }
      R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      const types = ['skeleton', 'skeleton', 'goblin', 'brute', 'skeleton', 'spider', 'cultist'], ang = [0, 0.9, 1.8, 2.3, 3.3, 5.0, 4.4];   // the 5th stands clear of the gold chest: its bar and number stay off it; the demon in front of it, its face clear
      R.en = types.map((ty, i) => { const a = ang[i], E = D.ENEMIES[ty]; return { id: 900 + i, type: ty, x: h.x + Math.cos(a) * (150 + 40 * (i % 2)), y: h.y + Math.sin(a) * 110, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: rm.id, st: 'chase', t0: 0, face: Math.cos(a) > 0 ? -1 : 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }; });
      // the gold chest where the concept has its chests, at the bottom wall right of the fight: under a brazier its fire washes it orange
      R.chests.push({ x: h.x + 2.5 * TILE, y: (rm.y + rm.h - 1) * TILE + 4, tier: 2, open: 1, openT: S.t - 3, gold: 1 });
      // gold lying loose and spilt coins round the chest and the fight: the concept's yellow sparkle (TASKS 167)
      for (const [gx, gy] of [[-2, 1.2], [-4.6, 1.6], [2, 6.6]]) R.drops.push({ id: 9e5 + gx, kind: 'gold', n: 40, x: h.x + gx * TILE, y: (rm.y + gy) * TILE + 10, vx: 0, vy: 0, z: 0, vz: 0, t0: -9 });
      R.pots.push({ x: h.x + 3.5 * TILE, y: (rm.y + 1) * TILE + 10, kind: 'goldpile', hp: 1 });
      for (let i = 0; i < 22; i++) { const a = i * 2.4, r = 30 + 14 * (i % 4) + 10 * (i >= 11), c = i % 11 < 6 ? [h.x - 3.5 * TILE, (rm.y + 1.6) * TILE] : [h.x, h.y + 10];
        m.decals.push({ x: c[0] + Math.cos(a) * r, y: c[1] + Math.sin(a) * r * 0.6, n: 'dc_coins', f: i & 1, s: 0.7 + 0.08 * (i % 3) }); }
      const A = SIM.K.HIT + 0.03; h.atkT = S.t - A; h.atkA = 0; h.aim = 0; h.face = 1; S.ev.push({ k: 'swing', t: S.t - A, x: h.x, y: h.y, a: 0, f: 1 });
      R.en.slice(0, 5).forEach((e, i) => { e.hp = Math.round(e.max * 0.6); if (R.map.torches.some((tc) => tc.kind !== 'wall' && Math.abs(tc.x - e.x) < 60 && e.y - tc.y > 0 && e.y - tc.y < 160)) return; S.ev.push({ k: 'hit', t: S.t - 0.1 - 0.08 * i, x: e.x, y: e.y - D.ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: 12, crit: i === 2 ? 1 : 0, id: e.id }); });
      return S; } })();
    states.push(['match', match]);
    const brawl = (mods = ['vampire']) => play((S) => {
      const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0];
      h.x = (rm.x + rm.w / 2) * TILE; h.y = (rm.y + rm.h / 2) * TILE; h.hp = 45; h.hurtT = S.t - 0.18; h.hurtX = -1;
      R.cam = [h.x - VW / 2, h.y - VH / 2]; R.seen.fill(1); R.rseen.fill(1); R.msg = null; R.drops = []; R.chests = []; R.pots = [];
      m.decor = m.decor.filter((d) => DUNGEON.roomAt(m, d.x, d.y) !== rm.id);
      R.en = [['goblin', 28, 0], ['skeleton', 18, -24], ['goblin', 22, 28]].map(([ty, dx, dy], i) => {
        const E = D.ENEMIES[ty]; return { id: 970 + i, type: ty, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: E.hp * 0.6, max: E.hp, dmg: 1, elite: i === 0 ? 1 : 0,
          mods: i === 0 ? mods : undefined, room: rm.id, st: 'wind', t0: S.t - 0.2, face: -1, aimA: Math.PI, cdT: 99, hitT: S.t - 0.03, hitP: S.t - 0.43, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 };
      });
      S.ev = R.en.slice(0, 2).map((e, i) => ({ k: 'hit', t: S.t - 0.15 - i * 0.1, x: e.x, y: e.y - D.ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: 15 + i, id: e.id }));
      S.ev.push({ k: 'hurt', t: S.t - 0.18, x: h.x, y: h.y - 40, n: 8, side: -1 });
    });
    states.push(['elite_brawl', brawl()], ['elite_brawl_long', brawl(['explosive', 'fiery'])]);
    for (const [name, age, fx] of [['early', 0.03, 'boom'], ['mid', 0.15, 'boom'], ['late', 0.35, 'boom'], ['bolt', 0.03, 'pop']]) {
      const S = brawl(); S.ev.push({ k: fx, t: S.t - age, x: S.run.hero.x, y: S.run.hero.y - 40, big: 1, hero: 1, c: 'fire' });
      states.push(['elite_brawl_' + name, S]);
    }
    for (const [i, gap] of [0.22, 0.4, 0.6].entries()) {
      const S = brawl(), e = S.run.en[0]; e.hitP = e.hitT - gap;
      states.push(['elite_hit_' + i, S]);
    }
    const spellState = (kind, age, edge = false) => play((S) => {
      const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0];
      let spot = null;
      for (let y = rm.y + 1; y < rm.y + rm.h - 1; y++) for (let x = rm.x + 1; x < rm.x + rm.w - 1; x++) {
        if (SIM.cell(m, x, y) !== 1 || edge && SIM.cell(m, x + 1, y) !== 0) continue;
        let score = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) score += SIM.cell(m, x + dx, y + dy) === 1 ? 1 : 0;
        if (!spot || score > spot.score) spot = { x, y, score };
      }
      const x = ((spot ? spot.x : rm.cx) + 0.5) * TILE, y = ((spot ? spot.y : rm.cy) + 0.5) * TILE;
      h.x = x - (kind === 'fireball' ? 90 : kind === 'boom' ? 28 : 0); h.y = y; h.aim = 0; h.face = 1; h.vx = h.vy = 0;
      h.castT = h.whirlT = -9; R.msg = null; R.en = []; R.chests = []; R.pots = []; R.drops = []; R.scorches = []; R.trauma = 0;
      m.decor = m.decor.filter((d) => DUNGEON.roomAt(m, d.x, d.y) !== rm.id); m.traps = [];
      R.seen.fill(1); R.rseen.fill(1); R.cam = [x - VW / 2, y - VH / 2]; S.ev = [];
      if (kind === 'whirl') { h.whirlT = h.castT = S.t - age; h.whirlA = 0; h.castK = 'whirl'; S.ev = [{ k: 'whirl', x: h.x, y: h.y, a: 0, r: D.abRank('whirl', 1).r, rar: 0, t: S.t - age }]; }
      if (kind === 'fireball') { h.castT = S.t - age; h.castK = 'fireball'; const [hx, hy] = SIM.hand(h);
        R.proj = [{ id: 9900, k: 'fire', x: hx + 520 * age, y: hy, vx: 520, vy: 0, t0: S.t - age, life: 1.1, own: 'hero', r: 8 }]; }
      if (kind === 'boom') S.ev = [{ k: 'boom', x, y: y - 24, gx: x, gy: y, t: S.t - age }];
    });
    for (const [kind, ages] of [['whirl', [0.025, 0.08, 0.16, 0.24, 0.32, 0.44]], ['fireball', [0.01, 0.04, 0.08, 0.12, 0.18, 0.24]], ['boom', [0.015, 0.06, 0.12, 0.24, 0.44, 1.5]]]) {
      ages.forEach((age, i) => states.push(['spell_' + kind + '_' + i, spellState(kind, age)]));
    }
    states.push(['spell_scar_end', spellState('boom', 3.9)], ['spell_scar_gone', spellState('boom', 4.1)], ['spell_whirl_wall', spellState('whirl', 0.16, true)]);
    const fogWhirl = spellState('whirl', 0.16), fogX = Math.floor(fogWhirl.run.hero.x / TILE) + 1;
    for (let y = 0; y < fogWhirl.run.map.H; y++) for (let x = fogX; x < fogWhirl.run.map.W; x++) fogWhirl.run.seen[y * fogWhirl.run.map.W + x] = 0;
    states.push(['spell_whirl_fog', fogWhirl]);
    // a blow's flash: the first one fills the body white for 0.06 s, one landing within 0.3 s of the last only lights its edge
    for (const [name, prev] of [['hit_flash', -9], ['hit_edge', 0.22]]) states.push([name, play((S) => { const R = S.run, h = R.hero, rm = R.map.rooms.find((r) => r.type === 'combat') || R.map.rooms[0];
      h.x = (rm.x + rm.w / 2) * TILE; h.y = (rm.y + rm.h / 2) * TILE; R.cam = [h.x - VW / 2, h.y - VH / 2]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      R.en = ['brute', 'skeleton'].map((ty, i) => { const E = D.ENEMIES[ty]; return { id: 960 + i, type: ty, x: h.x + 120, y: h.y - 70 + 140 * i, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: rm.id, st: 'chase', t0: 0,
        face: -1, aimA: Math.PI, cdT: 99, hitT: S.t - 0.03, hitP: prev < 0 ? -9 : S.t - 0.03 - prev, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }; }); })]);
    // what each kind bleeds (TASKS 136): skeleton, ghost, goblin, spider struck (top row) and where one of each was killed 2 s ago (bottom)
    for (const [name, age] of [['blood_hit', 0.12], ['blood_hit_late', 0.35]]) states.push([name, play((S) => { const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((p, q) => q.w * q.h - p.w * p.h)[0], inR = (o) => DUNGEON.roomAt(m, o.x, o.y) === rm.id;
      m.decor = m.decor.filter((d) => d.wall || !inR(d)); R.chests = R.chests.filter((c) => !inR(c)); R.pots = R.pots.filter((p) => !inR(p)); m.decals = m.decals.filter((d) => !inR(d));
      h.x = (rm.cx + 0.5) * TILE - 200; h.y = (rm.cy + 0.5) * TILE + 20; R.cam = [h.x + 200 - VW / 2, h.y - VH / 2]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      R.en = ['skeleton', 'ghost', 'goblin', 'spider'].map((ty, i) => { const E = D.ENEMIES[ty]; return { id: 930 + i, type: ty, x: h.x + 100 + i * 120, y: h.y - 60, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: rm.id,
        st: 'idle', t0: 0, face: -1, aimA: 0, cdT: 99, hitT: S.t - age, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }; });
      R.en.forEach((e) => S.ev.push({ k: 'hit', t: S.t - age, x: e.x, y: e.y - D.ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: 12, crit: 0, id: e.id }));
      ['skeleton', 'ghost', 'goblin', 'spider'].forEach((ty, i) => S.ev.push({ k: 'kill', t: S.t - 2, x: h.x + 100 + i * 120, y: h.y + 90, type: ty, id: 950 + i })); })]);
    // elites next to plain monsters of the same kind: the aura and the size must tell them apart at a glance
    states.push(['elite', play((S) => { const R = S.run, h = R.hero, rm = R.map.rooms.find((r) => r.type === 'combat') || R.map.rooms[0]; h.x = (rm.x + 1.5) * TILE; h.y = (rm.y + rm.h / 2) * TILE;
      R.cam = [h.x - 260, h.y - VH / 2 - 30]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      R.en = ['skeleton', 'goblin', 'cultist', 'brute'].flatMap((ty, i) => [0, 1].map((el) => { const E = D.ENEMIES[ty]; return { id: 940 + i * 2 + el, type: ty, x: h.x + 170 + i * 190, y: h.y - 90 + el * 190, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: el, room: rm.id,
        st: 'idle', t0: 0, face: -1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, mods: el ? [['fiery'], ['vampire'], ['summoner'], ['explosive', 'fiery']][i] : undefined }; }));
      // a monster the spread put into rock steps to the nearest free floor cell: a label over the void was this state's own defect
      const free = (x, y) => SIM.cell(R.map, x, y) === 1 && !R.en.some((o) => Math.abs(Math.floor(o.x / TILE) - x) < 4 && Math.abs(Math.floor(o.y / TILE) - y) < 3);
      for (const e of R.en) { const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE); if (SIM.cell(R.map, tx, ty) === 1) continue;
        let best = null; for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) if (free(tx + i, ty + j) && (!best || i * i + j * j < best[0])) best = [i * i + j * j, tx + i, ty + j];
        if (best) { e.x = (best[1] + 0.5) * TILE; e.y = (best[2] + 0.5) * TILE; } } })]);
    // a summoner ghost elite in the crypt, right under a green wall torch, a plain ghost beside it (TASKS 172: the ghost read as
    // one green blot with its aura and the torchlight)
    states.push(['elite_ghost_crypt', play((S) => { const R = S.run, h = R.hero; SIM.enterFloor(S, R, 3); const m = R.map;
      const tr = m.torches.find((q) => q.kind === 'wall' && m.rooms.some((r) => r.type === 'combat' && q.x > (r.x + 2) * TILE && q.x < (r.x + r.w - 2) * TILE && q.y < (r.y + 1) * TILE && q.y > (r.y - 2) * TILE)) || m.torches[0];
      const rm = m.rooms.find((r) => tr.x > r.x * TILE && tr.x < (r.x + r.w) * TILE && tr.y < (r.y + 1) * TILE && tr.y > (r.y - 2) * TILE) || m.rooms[0];
      const gy = (rm.y + 2.2) * TILE; h.x = tr.x - 4.5 * TILE; h.y = gy + 1.5 * TILE; h.face = 1;
      R.cam = [tr.x - VW / 2, gy - VH / 2]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      const E = D.ENEMIES.ghost, g = (id, x, el) => ({ id, type: 'ghost', x, y: gy, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: el, mods: el ? ['summoner'] : undefined, room: rm.id,
        st: 'idle', t0: 0, face: -1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 });
      R.en = [g(960, tr.x, 1), g(961, tr.x + 3.5 * TILE, 0)]; for (let i = 0; i < 20; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); R.en.forEach((e) => { e.x = e === R.en[0] ? tr.x : tr.x + 3.5 * TILE; e.y = gy; }); })]);
    // an elite's powers in play: an explosive corpse 0.6 s into its fuse (its reach on the floor), a vampire draining the hero
    states.push(['elite_fx', play((S) => { const R = S.run, h = R.hero, rm = R.map.rooms.find((r) => r.type === 'combat') || R.map.rooms[0]; h.x = (rm.x + 2.5) * TILE; h.y = (rm.y + rm.h / 2) * TILE;
      R.cam = [h.x - 360, h.y - VH / 2 - 30]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      const mk = (id, ty, x, y, mods, o) => Object.assign({ id, type: ty, x, y, vx: 0, vy: 0, hp: 30, max: 60, dmg: 1, elite: 1, mods, room: rm.id, st: 'idle', t0: 0, face: -1, aimA: Math.PI, cdT: 99, hitT: -9,
        deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }, o);
      R.en = [mk(950, 'skeleton', h.x + 200, h.y + 40, ['explosive'], { deadT: S.t - 0.6, dieA: 0 }), mk(951, 'goblin', h.x + 40, h.y - 10, ['vampire'])];
      S.ev.push({ k: 'fuse', x: h.x + 200, y: h.y + 40, r: 110, d: 1, id: 950, t: S.t - 0.6 }, { k: 'drain', x: h.x, y: h.y - 40, tx: h.x + 40, ty: h.y - 46, n: 7, id: 951, t: S.t - 0.12 }); })]);
    // regression states: spikes mid-rise next to the hero; a room at the map's corner must not hide under the HUD
    const trapS = (() => { for (let sd = 1; sd < 60; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const m = S.run.map; if (!m.traps.length) continue;
      const tp = m.traps[Math.floor(m.traps.length / 2)], h = S.run.hero; h.x = tp.x - 70; h.y = tp.y + 10; S.run.seen = S.run.seen.map(() => 1); S.t = (1 - tp.ph) * 2.4 + 0.3; S.run.cam = [tp.x - VW / 2, tp.y - VH / 2]; return S; } })();
    if (trapS) { states.push(['trap', trapS]); const w = structuredClone(trapS), tp = w.run.map.traps[Math.floor(w.run.map.traps.length / 2)]; w.t = (0.88 - tp.ph + 2) % 1 * 2.4 + 2.4; states.push(['trap_warn', w]); }
    const edgeS = play((S) => { const R = S.run, m = R.map, r = m.rooms.reduce((a, b) => (b.x + b.w > a.x + a.w ? b : a)), h = R.hero; h.x = (r.x + r.w - 2) * TILE; h.y = (r.y + 1) * TILE + 16;
      R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, h.y - VH / 2]; for (let i = 0; i < 300; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); });
    states.push(['edge', edgeS]);
    const treasureS = (() => { for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, r = R.map.rooms.find((q) => q.type === 'treasure' && R.map.rugs.length);
      if (!r) continue; const h = R.hero; h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 1) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, (r.y + r.h / 2) * TILE - VH / 2]; return S; } })();
    if (treasureS) states.push(['treasure', treasureS]);
    // the hoard fully dressed: statues by the rug, vases, a pile of gold
    for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, pile = R.pots.find((p) => p.kind === 'goldpile'); if (!pile) continue;
      const r = R.map.rooms[DUNGEON.roomAt(R.map, pile.x, pile.y)], h = R.hero;
      h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 1) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, (r.y + r.h / 2) * TILE - VH / 2]; states.push(['treasure_rich', S]); break; }
    // a hoard spilled: every chest of the treasure room opened and its items settled; none may rest behind a prop
    if (treasureS) { const S = structuredClone(treasureS), R = S.run, rm = R.map.rooms.find((q) => q.type === 'treasure'), h = R.hero, hx = h.x, hy = h.y;
      for (const c of R.chests) if (DUNGEON.roomAt(R.map, c.x, c.y) === rm.id) SIM.openChest(S, R, c);
      for (let i = 0; i < 150; i++) { h.x = hx + 400; h.y = hy; SIM.step(S, { keys: [], px: 960, py: 540 }); } h.x = hx; h.y = hy; R.cam = [hx - VW / 2, (rm.y + rm.h / 2) * TILE - VH / 2]; S.debug = 1; S.dbgLoot = 1; states.push(['loot_spill', S]); }
    // an accent zone's doorway: its coloured light must fade out into the corridor, not stop at the room's cells
    for (const zone of ['arcane', 'crypt']) { const S = (() => { for (let sd = 1; sd < 60; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, m = R.map;
      for (const r of m.rooms.filter((q) => q.zone === zone)) for (let x = r.x; x < r.x + r.w; x++) for (const [y, dy] of [[r.y + r.h - 1, 1], [r.y, -1]]) {
        if (SIM.cell(m, x, y + dy) !== 1 || DUNGEON.roomAt(m, x * TILE, (y + dy) * TILE) >= 0) continue;
        const h = R.hero; let k = 1; while (k < 4 && SIM.cell(m, x, y + dy * (k + 1)) === 1) k++; h.x = (x + 0.5) * TILE; h.y = (y + dy * k + 0.5) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [h.x - VW / 2, (y + 0.5) * TILE - VH / 2]; return S; } } })();
      if (S) states.push(['zone_door_' + zone, S]); }
    // sconces on a left and a right side wall: plate against the wall, the torch leaning into the room
    for (const side of [-1, 1]) states.push(['side_torch_' + (side < 0 ? 'l' : 'r'), play((S) => { const R = S.run, tc = R.map.torches.find((t) => t.side === side && !SIM.hidden(R.map, t)), h = R.hero;
      if (!tc) return; h.x = tc.x - side * 120; h.y = tc.y + 60; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [tc.x - VW / 2, tc.y - VH / 2]; })]);
    // a cobweb in a room's top-left and top-right corner: spun across the corner, mirrored on the right
    for (const f of [0, 1]) states.push(['web_' + (f ? 'r' : 'l'), play((S) => { S.run = SIM.newRun(S, 'campaign', 1); const R = S.run, d = R.map.decals.find((o) => o.n === 'dc_web' && o.f === f), h = R.hero;
      if (!d) return; h.x = d.x + (f ? -90 : 90); h.y = d.y + 90; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [d.x - VW / 2, d.y - VH / 2]; })]);
    // the floor's worst-lit room: the one whose farthest cell is farthest from any light
    // the largest lava pool on the fire floors, close: its straight shores and its outer and inner corners (TASKS 105)
    { let best = null; for (const seed of [1234, 1, 2, 3]) { const S = play(); S.run = SIM.newRun(S, 'campaign', seed); for (const f of [5, 6]) { SIM.enterFloor(S, S.run, f); const m = S.run.map, seen = new Set();
        for (let k = 0; k < m.W * m.H; k++) { if (m.cells[k] !== 3 || seen.has(k)) continue; const comp = [], st = [k]; seen.add(k);
          while (st.length) { const c = st.pop(); comp.push(c); for (const d of [1, -1, m.W, -m.W]) if (m.cells[c + d] === 3 && !seen.has(c + d)) { seen.add(c + d); st.push(c + d); } }
          if (!best || comp.length > best.n) best = { n: comp.length, seed, f, x: comp.reduce((a, c) => a + c % m.W, 0) / comp.length, y: comp.reduce((a, c) => a + Math.floor(c / m.W), 0) / comp.length }; } } }
      if (best) states.push(['lava_pool', play((S) => { S.run = SIM.newRun(S, 'campaign', best.seed); const R = S.run; SIM.enterFloor(S, R, best.f); const h = R.hero;
        R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); h.x = (best.x + 0.5) * TILE; h.y = (best.y + 4) * TILE;
        R.cam = [(best.x + 0.5) * TILE - VW / 2, (best.y + 0.5) * TILE - VH / 2]; })]); }
    // the fire depths' streams (TASKS 186): a lava hall with the hero on its island, and a river with the hero on its causeway
    for (const kind of ['hall', 'river']) { let got = null;
      for (const seed of [1, 2, 3, 1234]) { if (got) break; const S = play(); S.run = SIM.newRun(S, 'campaign', seed); for (const f of [5, 6]) { SIM.enterFloor(S, S.run, f);
        const q = (S.run.map.streams || []).filter((o) => o.kind === kind).sort((a, b) => b.n - a.n)[0]; if (q) { got = { seed, f, room: q.room }; break; } } }
      if (got) states.push(['lava_' + kind, play((S) => { S.run = SIM.newRun(S, 'campaign', got.seed); const R = S.run; SIM.enterFloor(S, R, got.f); const m = R.map, h = R.hero, r = m.rooms[got.room];
        R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
        let at = null; for (let d = 0; d < 8 && !at; d++) for (let j = -d; j <= d && !at; j++) for (let i = -d; i <= d && !at; i++) if (SIM.cell(m, r.cx + i, r.cy + j) === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => SIM.cell(m, r.cx + i + a, r.cy + j + b) === 3)) at = [r.cx + i, r.cy + j];
        at = at || [r.cx, r.cy]; h.x = (at[0] + 0.5) * TILE; h.y = (at[1] + 0.6) * TILE; R.cam = [(r.x + r.w / 2) * TILE - VW / 2, (r.y + r.h / 2) * TILE - VH / 2]; })]); }
    for (const floor of [1, 3, 7]) for (const kind of ['fountain', 'stream']) {
      for (const seed of [1, 2, 3, 1234]) {
        const S = play(); S.run = SIM.newRun(S, 'campaign', seed); const R = S.run; SIM.enterFloor(S, R, floor);
        const m = R.map, q = m.waterFeatures.find((q) => q.kind === kind); if (!q) continue;
        const r = m.rooms[q.room], h = R.hero, k = q.bridge?.[Math.floor(q.bridge.length / 2)] || m.water.filter((k) => DUNGEON.roomAt(m, (k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE) === r.id
          && !m.block.includes(k) && !R.pots.some((p) => Math.floor(p.y / TILE) * m.W + Math.floor(p.x / TILE) === k)).sort((a, b) => Math.hypot(a % m.W - r.cx, Math.floor(a / m.W) - r.cy) - Math.hypot(b % m.W - r.cx, Math.floor(b / m.W) - r.cy))[0];
        h.x = (k % m.W + 0.5) * TILE; h.y = (Math.floor(k / m.W) + 0.6) * TILE; h.vx = h.vy = 0; h.ifr = 1e9;
        R.en = []; R.msg = null;
        R.zoom = 2; R.cam = [(r.x + r.w / 2) * TILE - W / 4, (r.y + r.h / 2) * TILE - H / 4 - 20];
        R.seen.fill(1); R.rseen.fill(1); S.ev = [];
        states.push(['water_' + kind + '_' + m.biome, S]);
        if (kind === 'fountain' && floor === 1) {
          const bank = [];
          for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
            const k2 = y * m.W + x, d = Math.hypot((x + 0.5) * TILE - h.x, (y + 0.5) * TILE - h.y);
            if (d >= 2 * TILE && !m.water.includes(k2) && !m.block.includes(k2) && !R.pots.some((p) => Math.floor(p.y / TILE) * m.W + Math.floor(p.x / TILE) === k2)) bank.push([x, y, d]);
          }
          if (bank.length) { bank.sort((a, b) => a[2] - b[2]); const shore = structuredClone(S); shore.run.hero.x = (bank[0][0] + 0.5) * TILE; shore.run.hero.y = (bank[0][1] + 0.6) * TILE; states.push(['water_crossing', shore]); }
        }
        break;
      }
    }
    // shallow water with the hero wading in it, and the same pool seen whole with the hero on its shore (TASKS 106)
    for (const seed of [1234, 1, 2, 3]) { const S = play(); S.run = SIM.newRun(S, 'campaign', seed); const R = S.run, m = R.map; if (!m.water.length) continue;
      const k = m.water[Math.floor(m.water.length / 2)], h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      h.x = (k % m.W + 0.5) * TILE; h.y = (Math.floor(k / m.W) + 0.5) * TILE; R.cam = [h.x - VW / 2, h.y - VH / 2]; states.push(['water_pool', S]);
      const S2 = structuredClone(S); S2.run.hero.y += 2.5 * TILE; states.push(['water_shore', S2]);
      // TASKS 176: an elite cultist, its blow's number and the pool in unexplored cells on the frame's right show nothing; explored, they show
      for (const open of [0, 1]) { const S3 = structuredClone(S), R3 = S3.run, h3 = R3.hero, px = (k % m.W + 0.5) * TILE, py = (Math.floor(k / m.W) + 0.5) * TILE, E = D.ENEMIES.cultist;
        h3.x = px - 9 * TILE; h3.y = py; R3.cam = [px - VW * 0.62, py - VH / 2]; R3.seen = R3.seen.map((v, i) => (open || i % m.W <= Math.floor(h3.x / TILE) + 3 ? 1 : 0));
        R3.en = [{ id: 990, type: 'cultist', x: px + 2 * TILE, y: py - 2 * TILE, vx: 0, vy: 0, hp: E.hp * 0.6, max: E.hp, dmg: 1, elite: 1, mods: ['summoner'], room: -1,
          st: 'idle', t0: 0, face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }];
        S3.ev.push({ k: 'hit', t: S3.t - 0.15, x: px + 2 * TILE, y: py - 2 * TILE - E.h * 0.5 - 6, type: 'cultist', n: 17, crit: 0, id: 990 });
        states.push([open ? 'fog_hide_seen' : 'fog_hide', S3]); }
      break; }
    // one room per furnishing plan (data.js ROOM_PLANS), lit and empty, the camera on it
    for (const plan of Object.keys(D.ROOM_PLANS)) states.push(['plan_' + plan, play((S) => { for (const seed of [1234, 1, 2, 3, 4, 5, 6]) { S.run = SIM.newRun(S, 'campaign', seed); const R = S.run;
      for (let f = 1; f <= D.RUNS.campaign.floors; f++) { SIM.enterFloor(S, R, f); const m = R.map, rm = m.rooms.filter((q) => q.plan === plan && q.type !== 'start').sort((a, b) => b.w * b.h - a.w * a.h)[0]; if (!rm) continue;
        const h = R.hero; h.x = (rm.x + 0.5) * TILE; h.y = (rm.y + rm.h - 0.5) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
        R.cam = [(rm.x + rm.w / 2) * TILE - VW / 2, (rm.y + rm.h / 2) * TILE - VH / 2]; return; } } })]);
    // the fog across a thin wall between two rooms with no passage: the hero's room open whole, the one behind the wall dark (TASKS 104)
    states.push(['fog_wall', play((S) => { for (const seed of [1234, 1, 2, 3, 4, 5, 6, 7, 8]) { S.run = SIM.newRun(S, 'campaign', seed); const R = S.run, h = R.hero;
      for (let f = 1; f <= D.RUNS.campaign.floors; f++) { SIM.enterFloor(S, R, f); const m = R.map;
        for (const A of m.rooms) for (const B of m.rooms) for (const vert of [0, 1]) { if (A === B || A.type === 'secret' || B.type === 'secret') continue;
          const a0 = vert ? A.y : A.x, aw = vert ? A.h : A.w, b0 = vert ? B.y : B.x, gap = b0 - (a0 + aw); if (gap < 1 || gap > 2) continue;
          const o0 = Math.max(vert ? A.x : A.y, vert ? B.x : B.y), o1 = Math.min(vert ? A.x + A.w : A.y + A.h, vert ? B.x + B.w : B.y + B.h); if (o1 - o0 < 3) continue;
          let shut = true; for (let v = o0 - 1; v <= o1; v++) for (let u = a0 + aw; u < b0; u++) if ((vert ? SIM.cell(m, v, u) : SIM.cell(m, u, v)) !== 0) shut = false;
          if (!shut) continue; const mid = Math.floor((o0 + o1) / 2), hx = vert ? mid : a0 + aw - 1, hy = vert ? a0 + aw - 1 : mid;
          R.en = R.en.filter((e) => e.room === B.id); R.msg = null; h.x = (hx + 0.5) * TILE; h.y = (hy + 0.5) * TILE; SIM.step(S, { px: 960, py: 540, keys: [] });
          R.cam = [(vert ? h.x : (A.x + A.w + gap / 2) * TILE) - VW / 2, (vert ? (A.y + A.h + gap / 2) * TILE : h.y) - VH / 2]; return; } } } })]);
    // the hero in the darkest corridor cell, the farthest from every light: his own lamp must show the floor around him (TASKS 170)
    states.push(['dark_corridor', play((S) => { const R = S.run, m = R.map, LR = DUNGEON.LIGHT_R, ls = m.torches.map((t) => [t.x, t.y, LR[t.kind]]).concat(m.decor.filter((d) => LR[d.n]).map((d) => [d.x, d.y, LR[d.n]]));
      const inRoom = (x, y) => m.rooms.some((r) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
      let best = null, bv = -1; for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { if (SIM.cell(m, x, y) !== 1 || inRoom(x, y)) continue;
        const v = Math.min(...ls.map(([lx, ly, lr]) => Math.hypot(lx - (x + 0.5) * TILE, (ly - (y + 0.5) * TILE) / 0.8) / (lr * TILE))); if (v > bv) { bv = v; best = [x, y]; } }
      const h = R.hero; h.x = (best[0] + 0.5) * TILE; h.y = (best[1] + 0.5) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [h.x - VW / 2, h.y - 30 - VH / 2]; for (let i = 0; i < 60; i++) SIM.step(S, { px: 960, py: 510, keys: [] }); })]);
    states.push(['dark_room', play((S) => { const R = S.run, m = R.map, LR = DUNGEON.LIGHT_R, ls = m.torches.map((t) => [t.x, t.y, LR[t.kind]]).concat(m.decor.filter((d) => LR[d.n]).map((d) => [d.x, d.y, LR[d.n]]));
      const worst = (r) => { let v = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) v = Math.max(v, Math.min(...ls.map(([lx, ly, lr]) => Math.hypot(lx - (x + 0.5) * TILE, (ly - (y + 0.5) * TILE) / 0.8) / (lr * TILE)))); return v; };
      const r = m.rooms.filter((q) => q.type !== 'shop' && q.id !== m.start).reduce((a, b) => (worst(b) > worst(a) ? b : a)), h = R.hero;
      h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 1) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [(r.x + r.w / 2) * TILE - VW / 2, (r.y + r.h / 2) * TILE - VH / 2]; })]);
    // one prop of each material in a row, each knocked from its own side: mid-recoil with chips and sparks in the air, then settling
    const propS = (age) => play((S) => { const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((p, q) => q.w * q.h - p.w * p.h)[0], inR = (o) => DUNGEON.roomAt(m, o.x, o.y) === rm.id;
      m.decor = m.decor.filter((d) => !inR(d)); m.torches = m.torches.filter((t2) => t2.kind === 'wall' || !inR(t2)); R.chests = R.chests.filter((c) => !inR(c)); R.pots = R.pots.filter((p) => !inR(p));
      R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); const cx = (rm.cx + 0.5) * TILE, cy = (rm.cy + 0.5) * TILE + 6;
      ['table', 'statue', 'cage', 'crystal', 'coffin', 'shop_sacks', 'bookshelf', 'brazier'].forEach((n, i) => { const x = cx + (i % 4 - 1.5) * 76, y = cy + (i < 4 ? -40 : 60), s = i % 2 ? -1 : 1;
        if (n === 'brazier') { m.torches.push({ x, y, kind: 'brazier', r: rm.id }); S.ev.push({ k: 'prop', t: S.t - age, x, y, i: 't' + (m.torches.length - 1), n, mat: 'metal', s }); return; }
        m.decor.push({ x, y, n, solid: 1, r: rm.id }); S.ev.push({ k: 'prop', t: S.t - age, x, y, i: 'd' + (m.decor.length - 1), n, mat: D.PROP_MAT[n], s }); });
      // the fires and a plain banner (TASKS 135): a campfire, a torch and a banner on the top wall, struck from the left
      const ty = rm.y * TILE, onTop = (o) => Math.abs(o.y - ty) < TILE && o.x > rm.x * TILE && o.x < (rm.x + rm.w) * TILE;
      m.torches = m.torches.filter((t2) => !(t2.kind === 'wall' && !t2.side && onTop(t2))); m.decor = m.decor.filter((d) => !(d.wall && d.secret === undefined && onTop(d)));
      for (const [o, n, mat] of [[{ x: cx + 300, y: cy + 10, kind: 'fire' }, 'brazier', 'metal'], [{ x: cx - 80, y: ty - 26, kind: 'wall' }, 'torch_sconce', 'metal'], [{ x: cx + 80, y: ty - 2, n: 'banner', wall: 1 }, 'banner', 'cloth']]) {
        const L2 = o.n ? m.decor : m.torches; L2.push(o); S.ev.push({ k: 'prop', t: S.t - age, x: o.x, y: o.y, i: (o.n ? 'd' : 't') + (L2.length - 1), n, mat, s: 1 }); }
      h.x = cx; h.y = cy + 150; R.cam = [cx - VW / 2, cy - VH / 2]; });
    states.push(['props_knock', propS(0.07)], ['props_settle', propS(0.4)]);
    // each way a secret hides: whole (from a step away, where the draught or a banner's sway is the only tell), worked (a blow
    // on a wall or a shelf, a banner torn, a sconce pulled, a flagstone stepped on) at age `age`, and the room found behind it
    const secretS = (f, stage, age = 0) => { for (let sd = 1; sd < 120; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, m = R.map, q = m.secrets.find(f); if (!q) continue;
      if (SIM.secretMask(m).has(q.front[5][1] * m.W + q.front[5][0])) continue;
      const h = R.hero, P = q.trig; h.x = q.x - q.dx * 70 + (q.dy ? 50 : 0); h.y = q.y - q.dy * 80 + (q.kind === 'shelf' ? 40 : 0); h.aim = Math.atan2(q.dy, q.dx); R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [q.x - VW / 2, q.y - VH / 2 - 40];
      if (P && P.k === 'plate') { h.x = P.x + 40; h.y = P.y + 10; R.cam = [(q.x + P.x) / 2 - VW / 2, (q.y + P.y) / 2 - VH / 2 - 20]; }
      if (P && P.k === 'sconce') { const t2 = m.torches[P.t]; h.x = t2.x + 80; h.y = t2.y + 70; R.chests = R.chests.filter((c) => Math.hypot(c.x - h.x, c.y - h.y) > 120); R.cam = [(q.x + t2.x) / 2 - VW / 2, (q.y + t2.y) / 2 - VH / 2]; }
      if (stage === 1) { SIM.hitSecret(S, R, q); S.ev = S.ev.filter((e) => e.k === 'wallhit' || e.k === 'hollow'); if (S.ev[0]) S.ev[0].t = S.t - (age || 0.1); }
      if (stage >= 2) { S.ev = []; SIM.openSecret(S, R, q); q.openT = S.t - (stage === 2 ? age : 3); if (P) P.downT = q.openT; S.ev = S.ev.filter((e) => e.k === 'secret'); S.ev[0].t = q.openT; R.msg = null; R.trauma = 0; R.freeze = 0; }
      if (stage === 3 && q.kind === 'crack') { const r = m.rooms[q.room]; h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 1) * TILE + 10; R.cam = [h.x - VW / 2, (r.y + r.h / 2) * TILE - VH / 2]; }
      return S; } };
    // doors from the room (the corridor behind under the fog) and from the corridor (the room unseen), shut, swinging, open; the
    // locked ones with their padlock or bar, a lever up and pulled
    const doorS = (dir, stage, age = 0, lk = '', out = 0) => { for (let sd = 1; sd < 160; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, m = R.map;
      const d = m.doors.find((o) => o.dir === dir && (lk ? (SIM.doorLock(m, o) || {}).kind === lk : !SIM.doorLock(m, o))); if (!d) continue;
      const h = R.hero, dx = dir === 'l' ? -1 : dir === 'r' ? 1 : 0, dy = dir === 'u' ? -1 : dir === 'd' ? 1 : 0, k = out ? 1 : -1;
      h.x = d.x + k * dx * (out ? 52 : 80) + (dy && !out ? 40 : 0); h.y = d.y + k * dy * (out ? (dy > 0 ? 100 : 56) : 90) + (dx && !out ? 40 : 0) + (dy < 0 && !out ? 20 : 0); h.aim = Math.atan2(-k * dy, -k * dx); R.en = R.en.filter((e) => e.room === d.room && out); R.msg = null;
      R.seen.fill(0); R.rseen.fill(0); R.drops = []; R.chests = R.chests.filter((c) => Math.hypot(c.x - h.x, c.y - h.y) > 70);
      if (stage >= 1) { S.ev = []; if (lk === 'lever') { const L0 = m.locks[d.lock]; L0.open = 1; L0.openT = S.t - 3; } if (lk === 'key') R.keys = 1; SIM.openDoor(S, R, d, stage === 1 && age < 0.1); d.openT = S.t - (stage === 1 ? age : 3); for (const e of S.ev) e.t = d.openT; R.msg = null; R.trauma = 0; }
      SIM.step(S, { keys: [], px: 960, py: 540 }); R.cam = [d.x - VW / 2, d.y - VH / 2 - 30]; R.msg = null; return S; } };
    for (const [n, dir, stage, age, lk, out] of [['door_u', 'u', 0], ['door_u_out', 'u', 0, 0, '', 1], ['door_u_swing', 'u', 1, 0.12], ['door_u_open', 'u', 2], ['door_u_open_out', 'u', 2, 0, '', 1],
      ['door_d', 'd', 0], ['door_d_out', 'd', 0, 0, '', 1], ['door_d_open', 'd', 2], ['door_l', 'l', 0], ['door_l_out', 'l', 0, 0, '', 1], ['door_l_swing', 'l', 1, 0.12], ['door_l_open', 'l', 2], ['door_r', 'r', 0], ['door_r_open', 'r', 2],
      ['door_key', 'u', 0, 0, 'key', 1], ['door_key_r', 'r', 0, 0, 'key', 1], ['door_key_unlock', 'u', 1, 0.2, 'key', 1], ['door_bar', 'u', 0, 0, 'lever', 1], ['door_bar_l', 'l', 0, 0, 'lever', 1], ['door_bar_open', 'u', 2, 0, 'lever', 1]]) {
      const S = doorS(dir, stage, age, lk, out); if (S) states.push([n, S]); }
    // the hero right beside a shut side door, in the room: the leaf's far end goes behind him, its near end in front
    for (const dir of ['l', 'r']) { const S = doorS(dir, 0); if (!S) continue; const R = S.run, d = R.map.doors.find((o) => o.dir === dir && !SIM.doorLock(R.map, o));
      Object.assign(R.hero, { x: d.x + (dir === 'l' ? 18 : -18), y: d.y + 8 }); states.push(['door_' + dir + '_beside', S]); }
    { const S = play(); for (let sd = 1; sd < 160; sd++) { S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, m = R.map, L0 = m.locks.find((q) => q.kind === 'lever'); if (!L0) continue;
        const h = R.hero; h.x = L0.lever.x + 60; h.y = L0.lever.y + 70; R.en = []; R.msg = null; R.seen.fill(1); R.rseen.fill(1); R.cam = [L0.lever.x - VW / 2, L0.lever.y - VH / 2]; states.push(['lever', S]);
        const S2 = play(); S2.run = SIM.newRun(S2, 'campaign', sd); const R2 = S2.run, L2 = R2.map.locks[m.locks.indexOf(L0)]; Object.assign(R2.hero, { x: h.x, y: h.y }); R2.en = []; R2.msg = null; R2.seen.fill(1); R2.rseen.fill(1); R2.cam = R.cam.slice();
        SIM.pullLever(S2, R2, L2); L2.openT = S2.t - 2; R2.msg = null; states.push(['lever_pulled', S2]); break; } }
    { const S = play(), R = S.run, h = R.hero; R.en = []; R.msg = null; R.keys = 1; R.drops.push({ id: 9e6, kind: 'key', lock: 0, x: h.x + 60, y: h.y + 10, vx: 0, vy: 0, z: 0, vz: 0, t0: -9, rest: 2 }); states.push(['key_drop', S]); }
    // traps (TASKS 71, 76): a room's webs whole and torn, an ambush's flagstone before and as it springs, a corridor's spikes up
    { const find = (f) => { for (let sd = 1; sd < 120; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); for (let fl = 1; fl <= 4; fl++) { if (fl > 1) SIM.enterFloor(S, S.run, fl); const o = f(S.run.map); if (o) return [S, o]; } } return []; };
      const at = (S, x, y, hx = x + 50, hy = y + 40) => { const R = S.run; Object.assign(R.hero, { x: hx, y: hy, vx: 0, vy: 0 }); R.en = R.en.filter((e) => e.type === 'spider' && Math.hypot(e.x - x, e.y - y) < 260); R.msg = null; R.seen.fill(1); R.rseen.fill(1); R.cam = [x - VW / 2, y - VH / 2]; };
      let [S, w] = find((m) => m.webs.length >= 2 && m.webs[0]); if (S) { at(S, w.x, w.y, w.x + 4, w.y + 2); states.push(['web', S]);
        const [S2, w2] = find((m) => m.webs.length >= 2 && m.webs[0]); at(S2, w2.x, w2.y); for (const o of S2.run.map.webs) { o.torn = 1; o.tornT = S2.t - 2; } states.push(['web_torn', S2]); }
      [S, w] = find((m) => m.ambush[0]); if (S) { at(S, w.x, w.y, w.x + 40, w.y + 30); S.run.en = []; states.push(['ambush', S]);
        const [S2, P] = find((m) => m.ambush[0]); at(S2, P.x, P.y, P.x, P.y); S2.run.en = []; S2.ev = []; SIM.springAmbush(S2, S2.run, P); for (const e of S2.ev) e.t = S2.t - 0.3; S2.run.msg = null; states.push(['ambush_sprung', S2]);
        const [S3, P3] = find((m) => m.ambush[0]); at(S3, P3.x, P3.y, P3.x, P3.y); SIM.springAmbush(S3, S3.run, P3); P3.downT = S3.t - 30; S3.run.en = []; S3.ev = []; S3.run.msg = null;
        at(S3, P3.x, P3.y, P3.x + 70, P3.y + 40); S3.run.en = []; states.push(['ambush_spent', S3]); }
      [S, w] = find((m) => m.traps.find((t) => t.cor)); if (S) { at(S, w.x, w.y, w.x + 70, w.y); S.run.en = []; w.ph = (1 - (S.t / 2.4) % 1 + 0.1) % 1; states.push(['trap_corridor', S]); } }
    const crack = (d) => (o) => o.kind === 'crack' && o.dir === d, sconce = (o) => o.trig && o.trig.k === 'sconce', plate = (o) => o.trig && o.trig.k === 'plate';
    for (const [n, f, stage, age] of [['secret_crack', crack('u'), 0], ['secret_crack_hit', crack('u'), 1], ['secret_crack_break', crack('u'), 2, 0.25], ['secret_room', crack('u'), 3],
      ['secret_crack_d', crack('d'), 0], ['secret_crack_hit_d', crack('d'), 1], ['secret_crack_l', crack('l'), 0], ['secret_crack_hit_l', crack('l'), 1], ['secret_crack_r', crack('r'), 0], ['secret_crack_hit_r', crack('r'), 1],
      ['secret_banner', (o) => o.kind === 'banner', 0], ['secret_banner_fall', (o) => o.kind === 'banner', 2, 0.25], ['secret_banner_down', (o) => o.kind === 'banner', 3],
      ['secret_shelf', (o) => o.kind === 'shelf', 0], ['secret_shelf_break', (o) => o.kind === 'shelf', 2, 0.2], ['secret_shelf_open', (o) => o.kind === 'shelf', 3],
      ['secret_sconce', sconce, 0], ['secret_sconce_sink', sconce, 2, 0.8], ['secret_sconce_open', sconce, 3],
      ['secret_plate', plate, 0], ['secret_plate_sink', plate, 2, 0.8], ['secret_plate_open', plate, 3]]) { const S = secretS(f, stage, age); if (S) states.push([n, S]); }
    // every monster type in a row, idle, facing right: the rigs at rest against their approved sprites
    const lineup = (S) => { const R = S.run, r = R.map.rooms.filter((q) => q.id !== R.map.start).reduce((a, b) => (b.w > a.w ? b : a)), h = R.hero, y0 = (r.y + r.h / 2) * TILE + 16;
      R.msg = null; R.seen = R.seen.map(() => 1); h.x = (r.x + 1) * TILE; h.y = (r.y + 1) * TILE + 20;
      R.en = ['skeleton', 'goblin', 'spider', 'cultist', 'ghost', 'brute'].map((ty, i) => { const E = D.ENEMIES[ty]; return { id: 960 + i, type: ty, x: (r.x + r.w / 2) * TILE + (i - 2.5) * 110, y: y0, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: r.id, st: 'idle', t0: 0,
        face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }; });
      R.cam = [(r.x + r.w / 2) * TILE - VW / 2, y0 - VH / 2 - 40]; };
    states.push(['monsters', play(lineup)]);
    // event responses: pain at the rim on low health with a bolt bursting on the hero, the fall, a scroll's two pillars,
    // the arrival on a floor, the boss's roar, a spike plate firing, the buff row with its worst strings
    const fx = (fn) => play((S) => { const R = S.run, h = R.hero; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, h.y - VH / 2]; fn(S, R, h); });
    const reactionS = (kind, age) => fx((S, R, h) => {
      const m = R.map, rm = m.rooms.find((r) => r.type === 'combat' && r.w >= 9 && r.h >= 7) || m.rooms[m.start];
      h.x = (rm.cx - 1) * TILE; h.y = rm.cy * TILE; R.cam = [h.x - VW / 2, h.y - VH / 2];
      const x = h.x + (kind === 'water' || kind === 'douse' ? 0 : 60), y = h.y; m.seed += 1000000 + ['bone', 'snuff', 'water', 'douse'].indexOf(kind) * 1000;
      R.en = []; R.pots = []; R.chests = []; R.shrines = []; R.drops = []; m.decor = []; m.torches = [{ x: h.x - 100, y: h.y - 90, kind: 'brazier' }]; m.traps = []; m.webs = []; m.block = []; S.ev = [];
      if (kind === 'bone') { m.decor.push({ n: 'bones', x, y }); S.ev.push({ k: 'prop', mat: 'bone', n: 'bones', i: 'd0', s: 1, x, y, t: S.t - age }); }
      if (kind === 'snuff') { m.decor.push({ n: 'candles', x, y, outUntil: age >= 0 ? S.t - age + 3 : 0 }); if (age >= 0) S.ev.push({ k: kind, x, y, t: S.t - age }); }
      if (kind === 'water' || kind === 'douse') { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); m.water = [];
        for (let cy = ty - 1; cy <= ty + 1; cy++) for (let cx = tx - 2; cx <= tx + 2; cx++) { const k = cy * m.W + cx; m.cells[k] = 1; m.water.push(k); }
        S.ev.push({ k: kind === 'water' ? 'step' : kind, wet: true, x, y, t: S.t - age }); }
    });
    for (const kind of ['bone', 'snuff', 'water', 'douse']) for (const age of [0.08, 0.24, 0.5]) states.push(['reaction_' + kind + '_' + Math.round(age * 100), reactionS(kind, age)]);
    for (const age of [-0.1, 2.9, 3.1]) states.push(['reaction_candles_' + age, reactionS('snuff', age)]);
    states.push(['reaction_hollow', secretS((q) => q.kind === 'lever', 1, 0.18)]);
    states.push(['fx_hurt', fx((S, R, h) => { h.hp = Math.round(SIM.stats(h, S.meta).maxHp * 0.15); h.hurtT = S.t - 0.08;
      S.ev.push({ k: 'hurt', t: S.t - 0.08, x: h.x, y: h.y - 40, n: 30 }, { k: 'pop', t: S.t - 0.08, x: h.x, y: h.y - 38, c: 'hex', hero: 1 }); })]);
    states.push(['fx_die', fx((S, R, h) => { h.hp = 0; h.deadT = S.t - 0.8; S.ev.push({ k: 'die', t: S.t - 0.8, x: h.x, y: h.y }); })]);
    states.push(['fx_teleport', fx((S, R, h) => { S.ev.push({ k: 'teleport', t: S.t - 0.2, x: h.x, y: h.y, fx: h.x + 360, fy: h.y - 60 }); })]);
    states.push(['fx_arrive', fx((S, R, h) => { S.keepFloor = 1; S.ev.push({ k: 'floor', t: S.t - 0.45, x: h.x, y: h.y, f: R.floor }); })]);
    states.push(['fx_roar', play((S) => { const R = S.run; SIM.enterFloor(S, R, D.RUNS.campaign.floors); const b = R.en.find((e) => e.type === 'boss'), h = R.hero; h.x = b.x; h.y = b.y + 220; b.st = 'chase';
      R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [b.x - VW / 2, b.y + 60 - VH / 2]; S.ev.push({ k: 'roar', t: S.t - 0.25, x: b.x, y: b.y - 70, id: b.id }); })]);
    if (trapS) { const s2 = structuredClone(trapS), tp = s2.run.map.traps[Math.floor(s2.run.map.traps.length / 2)]; s2.ev.push({ k: 'spike', t: s2.t - 0.08, x: tp.x, y: tp.y }); states.push(['fx_spike', s2]); }
    states.push(['buffs', fx((S, R, h) => { worst(S); h.perks = Object.fromEntries(D.GIFTS.map((g) => [g.id, 2])); Object.assign(h, { bless: 1, shield: 99999, shieldUntil: S.t + 4, burn: S.t + 0.4, poison: S.t + 2.2 }); })]);
    // the hero standing in lava, a quarter second after a burn tick (the scorch flash and smoke)
    for (let sd = 1; sd < 30; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); SIM.enterFloor(S, S.run, 5); const R = S.run, m = R.map, lv = [];
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.cells[y * m.W + x] === 3) lv.push([x, y]);
      if (lv.length) { const [lx, ly] = lv[Math.floor(lv.length / 2)], h = R.hero; h.x = lx * TILE + 16; h.y = ly * TILE + 16; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1);
        S.ev.push({ k: 'scorch', t: S.t - 0.12, x: h.x, y: h.y }); h.hurtT = S.t - 0.12; h.hurtX = 0; R.cam = [h.x - VW / 2, h.y - VH / 2]; states.push(['lava', S]); break; } }
    // big props against a room's top wall: they must stand on the floor in front of the facade, not on its cap
    const wallS = (tall) => { for (let sd = 1; sd < 80; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); if (tall) SIM.enterFloor(S, S.run, 3); const R = S.run, m = R.map;
      const r = m.rooms.find((q) => { const w = m.decor.filter((d) => d.solid && d.r === q.id && Math.abs(d.y - (q.y * TILE + 22)) < 1); return w.length >= (tall ? 1 : 3) && (!tall || w.some((d) => d.n === 'statue' || d.n === 'pillar')); }); if (!r) continue;
      const h = R.hero; h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h - 1) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, r.y * TILE - VH / 2 + 40]; return S; } };
    for (const [nm, tall] of [['wallprops', 0], ['wallprops_tall', 1]]) { const S = wallS(tall); if (S) states.push([nm, S]); }
    states.push(['sanct', play((S) => { const R = S.run, r = R.map.rooms[R.map.start], h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1);
      h.x = (r.x + 1.5) * TILE; h.y = (r.y + r.h - 1.5) * TILE; R.cam = [(r.x + r.w / 2) * TILE - VW / 2, (r.y + r.h / 2) * TILE - VH / 2]; })]);
    // the shop: the room from its doorway side, the hero at the counter (the prompt), and the trade screen at its worst
    const shopS = (prep) => play((S) => { const R = S.run, sh = R.map.shop, r = R.map.rooms[sh.room], h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      h.x = sh.front.x + 20; h.y = sh.front.y + 4; R.shop.away = 0; R.cam = [(r.x + r.w / 2) * TILE - VW / 2, (r.y + r.h / 2) * TILE - VH / 2 - 20]; if (prep) prep(S); });
    states.push(['shop', shopS()]);
    states.push(['shop_screen', shopS((S) => { worst(S); const R = S.run; for (let i = 0; i < 6; i++) R.shop.back.push({ it: Object.assign(SIM.rollItem(R, 8, 4), { id: 3000 + i }), price: 99999 });
      R.shop.back = R.shop.back.slice(-D.SHOP.buyback); for (const g of R.shop.goods) g.price = 99999; R.shop.line = 1; S.screen = 'shop'; S.hover = 'buy:0'; })]);
    // the merchant's key poses: a coin onto the scales, a stroke of the beard (hero away), a wave, the nod on a trade
    const at6 = (S, u) => { const R = S.run, k = R.map.seed % 7; S.t += ((u - (S.t + k)) % 6 + 6) % 6; R.shop.greetT = R.shop.tradeT = -9; R.cam = [R.map.shop.x - VW / 2, R.map.shop.y - 40 - VH / 2]; };
    states.push(['merchant_coin', shopS((S) => { S.run.hero.x -= 400; at6(S, 1.0); })]);
    states.push(['merchant_beard', shopS((S) => { S.run.hero.x -= 400; at6(S, 3.8); })]);
    states.push(['merchant_greet', shopS((S) => { at6(S, 0); S.run.shop.greetT = S.t - 0.6; })]);
    states.push(['merchant_nod', shopS((S) => { at6(S, 0); S.run.shop.tradeT = S.t - 0.35; })]);
    for (let line = 0; line < D.SHOP.hitLines.length; line++) states.push(['merchant_hit_' + line, shopS((S) => { at6(S, 0); S.run.shop.hitT = S.t - 0.16; S.run.shop.hitLine = line; })]);
    states.push(['shop_screen_sell', shopS((S) => { worst(S); S.screen = 'shop'; S.hover = 'sell:23'; })]);
    states.push(['small_props', play((S) => {
      const R = S.run, m = R.map, r = m.rooms.filter((q) => q.type === 'combat').reduce((a, b) => a.w * a.h > b.w * b.h ? a : b), h = R.hero;
      R.en = []; R.pots = []; R.chests = []; R.shrines = []; R.msg = null; S.ev = [];
      m.decor = []; m.traps = []; m.webs = []; m.rugs = [];
      const at = (col, row) => ({ x: (r.x + r.w * (0.25 + 0.25 * col)) * TILE, y: (r.y + r.h * (0.3 + 0.25 * row)) * TILE });
      for (const [i, n] of ['table', 'candles', 'bones', 'vase_a', 'vase_b', 'vase_c', 'padlock', 'shop_scales', 'shop_gems'].entries()) m.decor.push(Object.assign({ n }, at(i % 3, Math.floor(i / 3))));
      m.decor.push(Object.assign({ n: 'candles', lift: 30 }, at(0, 0), { y: at(0, 0).y + 1 }));
      h.x = (r.x + 1) * TILE; h.y = (r.y + r.h - 1) * TILE;
      R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [(r.x + r.w / 2) * TILE - VW / 2, (r.y + r.h / 2) * TILE - VH / 2];
    })]);
    // every biome's floor texture under real light, so a regenerated floor is judged in place
    for (const [zone, f] of [['dungeon', 1], ['crypt', 3], ['lava', 5], ['arcane', 7]]) { const S = play(); S.run = SIM.newRun(S, 'campaign', 3); SIM.enterFloor(S, S.run, f);
      const R = S.run, r = R.map.rooms.filter((q) => q.type !== 'start').reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)), h = R.hero;
      h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h / 2) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, h.y - VH / 2]; states.push(['zone_' + zone, S]); }
    // the cave's stone under real light (TASKS 303): the 2nd floor's biggest hall with its rock, banks and water
    { const S = play(); S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play'; SIM.enterFloor(S, S.run, 2);
      const R = S.run, r = R.map.rooms.filter((q) => q.type !== 'start' && q.type !== 'secret').reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)), h = R.hero;
      h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h / 2) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, h.y - VH / 2]; states.push(['zone_cave', S]); }
    // the water caves' biggest hall and its winding ways (TASKS 301), the whole hall in view
    { const S = play(); S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play'; SIM.enterFloor(S, S.run, 3);
      const R = S.run, r = R.map.rooms.filter((q) => q.type !== 'start' && q.type !== 'secret').reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)), h = R.hero;
      h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h / 2) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, h.y - VH / 2]; states.push(['cave_hall', S]); }
    // the cave's water (TASKS 302): the hero on the shore by a plank bridge over deep water, and a fall into a hall's pool
    { const S = play(); S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play';
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, c = m.crossings.find((q) => q.kind === 'bridge'); if (!c) continue;
        const k = c.cells[0], h = R.hero, shore = [1, -1, m.W, -m.W].map((d) => k + d).find((n) => m.cells[n] === 1 && !c.cells.includes(n)) ?? k;
        h.x = (shore % m.W + 0.5) * TILE; h.y = (Math.floor(shore / m.W) + 0.6) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, h.y - VH / 2]; states.push(['cave_crossing', structuredClone(S)]); break; }
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, q = m.waterFeatures.find((o) => o.kind === 'waterfall' && o.room >= 0); if (!q) continue;
        const h = R.hero; h.x = q.x + 2 * TILE; h.y = q.y + 4 * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [q.x - VW / 2, q.y - VH / 2]; states.push(['cave_waterfall', structuredClone(S)]); break; }
      // a breach gushing out of a side wall and a spring boiling up under the rock (TASKS 304)
      for (const kind of ['breach', 'spring']) for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, q = R.map.waterFeatures.find((o) => o.kind === kind); if (!q) continue;
        const h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [q.x - VW / 2, q.y - VH / 2]; h.x = q.x - VW / 2 + 160; h.y = q.y - VH / 2 + 160;
        states.push(['cave_' + kind, structuredClone(S)]); break; }
      // a stream running into a lake with deep water (TASKS 304), the hero wading in the shallows by it, his last steps' rings spreading
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, run = Object.keys(m.waterFlow).map(Number).filter((k) => m.cells[k] === 1 || m.cells[k] === 6); if (!run.length) continue;
        const k0 = run[run.length >> 1], x0 = (k0 % m.W + 0.5) * TILE, y0 = (Math.floor(k0 / m.W) + 0.5) * TILE, at = (k) => [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE];
        const k = m.water.filter((k) => !run.includes(k)).sort((a, b) => Math.hypot(...at(a).map((v, i) => v - [x0, y0][i])) - Math.hypot(...at(b).map((v, i) => v - [x0, y0][i])))[0]; if (k === undefined) continue;
        const h = R.hero; [h.x, h.y] = at(k); R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [x0 - VW / 2, y0 - VH / 2]; S.ev = [];
        for (const [age, dx] of [[0.12, 0], [0.4, -14]]) S.ev.push({ k: 'step', wet: true, x: h.x + dx, y: h.y, t: S.t - age });
        states.push(['cave_water', structuredClone(S)]); break; }
      // the cave's own light (TASKS 305): a crystal by water with mushrooms round it, a drop falling and another just landed
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, at = (o) => Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE);
        const near = (o, r) => m.water.some((k) => Math.hypot((k % m.W + 0.5) * TILE - o.x, (Math.floor(k / m.W) + 0.5) * TILE - o.y) < r);
        const c = m.decor.find((d) => d.n === 'crystal_cv' && near(d, 6 * TILE) && m.decor.filter((e) => e.n.startsWith('shroom') && Math.hypot(e.x - d.x, e.y - d.y) < 500).length >= 2); if (!c) continue;
        const h = R.hero; h.x = c.x + 90; h.y = c.y + 70; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [c.x - VW / 2, c.y - VH / 2]; S.ev = [];
        m.drips = m.drips.filter((q) => Math.abs(q.x - c.x) > VW / 2 || Math.abs(q.y - c.y) > VH / 2);
        m.drips.push({ x: c.x - 150, y: c.y + 40, p: 4, ph: S.t + 0.2, wet: 0 }, { x: c.x + 200, y: c.y - 60, p: 4, ph: S.t - 0.15, wet: 0 }, { x: c.x - 40, y: c.y + 160, p: 5, ph: S.t + 0.25, wet: near({ x: c.x - 40, y: c.y + 160 }, 20) ? 1 : 0 });
        if (at(c) >= 0) states.push(['cave_light', structuredClone(S)]); break; }
      // the cave's props (TASKS 306): a rope bridge with a fire on its posts, the hero on its deck; a plank walk and stepping stones;
      // the explorer's camp round the start's fire; a hall with a boat's wreck on its shore
      const look = (name, find) => { for (const sd of [3, 5, 8, 13, 21]) for (let f = 1; f <= 4; f++) { if (S.run.seed !== sd && f === 1) S.run = SIM.newRun(S, 'cave', sd); SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, o = find(m); if (!o) continue;
        const h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); [h.x, h.y] = o.hero || [o.x + 120, o.y + 90]; R.cam = [o.x - VW / 2, o.y - VH / 2]; S.ev = []; states.push([name, structuredClone(S)]); return; } };
      const mid = (c) => { const xs = c.cells.map((k) => (k % S.run.map.W + 0.5) * TILE), ys = c.cells.map((k) => (Math.floor(k / S.run.map.W) + 0.5) * TILE); return [xs.reduce((a, b) => a + b) / xs.length, ys.reduce((a, b) => a + b) / ys.length]; };
      look('cave_bridge', (m) => { const c = m.crossings.find((q) => q.kind === 'bridge' && q.axis === 'x' && q.span[1] - q.span[0] >= 4) || m.crossings.find((q) => q.kind === 'bridge' && q.axis === 'x'); if (!c) return null; const [x, y] = mid(c); return { x, y, hero: [x, y + 8] }; });
      look('cave_bridge_v', (m) => { const c = m.crossings.find((q) => q.kind === 'bridge' && q.axis === 'y'); if (!c) return null; const [x, y] = mid(c); return { x, y, hero: [x + 10, y] }; });
      look('cave_ford', (m) => { const c = m.crossings.find((q) => q.look === 'walk'), d = m.crossings.find((q) => q.look === 'stones'); if (!c) return null; if (!d) { const [x, y] = mid(c); return { x, y, hero: [x, y] }; } const [x, y] = mid(c), [x2, y2] = mid(d);
        return Math.hypot(x2 - x, y2 - y) < 700 ? { x: (x + x2) / 2, y: (y + y2) / 2, hero: [x, y] } : { x, y, hero: [x, y] }; });
      look('cave_camp', (m) => { const r = m.rooms.find((q) => q.camp); return r ? { x: m.sanct.x, y: m.sanct.y - 40, hero: [m.spawn.x, m.spawn.y] } : null; });
      look('cave_wreck', (m) => { const d = m.decor.find((o) => o.n === 'wreck_cv'); return d ? { x: d.x, y: d.y - 20 } : null; });
      // the cave's monsters (TASKS 307, 308) on a shore: a drowned halfway up out of the shallows, another lying in wait (bubbles),
      // a slime at the top of its hop, a small one squatting to jump, a puddle of slime
      S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play';
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, wet = new Set(m.water), dry = (k) => m.cells[k] === 1 && !wet.has(k), W = m.W;
        const at = (k) => [(k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE], open = (k) => [-W - 3, -W, -W + 3, -2 * W - 6, -2 * W + 6, -3 * W].every((d) => dry(k + d));
        const k = m.water.find((k) => m.cells[k] === 1 && open(k)); if (k === undefined) continue;
        const [x, y] = at(k), k2 = m.water.find((j) => m.cells[j] === 1 && Math.hypot(at(j)[0] - x, at(j)[1] - y) > 3 * TILE && Math.hypot(at(j)[0] - x, at(j)[1] - y) < 7 * TILE); if (k2 === undefined) continue;
        const h = R.hero, mk = (id, type, X, Y, o) => { const E = D.ENEMIES[type]; return Object.assign({ id, type, x: X, y: Y, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: -1, st: 'chase', t0: 0,
          face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }, o); };
        h.x = x - 20; h.y = y - 3 * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [x - VW / 2, y - 2 * TILE - VH / 2]; S.ev = [];
        R.en = [mk(970, 'drowned', x, y, { st: 'rise', t0: S.t - 0.5, face: -1 }), mk(971, 'drowned', ...at(k2), { st: 'lurk', t0: -9 }),
          mk(972, 'slime', x - 200, y - 3 * TILE, { st: 'strike', t0: S.t - 0.23, aimA: 0 }), mk(973, 'slime_s', x - 250, y - 5 * TILE, { st: 'wind', t0: S.t - 0.3, aimA: 0.3 })];
        m.goo.push({ id: 9, x: x + 160, y: y - 4 * TILE, t0: S.t - 3, T: 10, r: 34, rNow: 34 }); S.ev.push({ k: 'rise', t: S.t - 0.5, x, y, id: 970 });
        states.push(['cave_monsters', structuredClone(S)]); break; } }
    // hero walk cycles: right, left, down, up — the same state at successive distances
    const cyc = (dx, dy, fn) => { const out = []; for (let i = 0; i < 12; i++) { const S = play(fn); const h = S.run.hero; h.vx = dx * SIM.K.RUN; h.vy = dy * SIM.K.RUN; h.face = dx < 0 ? -1 : 1; h.back = dy < 0 ? 1 : 0; const sl = SIM.stepLen(Math.abs(dx)); h.gp = i * 2 * Math.PI / 12; h.dist = i * 2 * sl / 12; h.x += dx * h.dist; h.y += dy * h.dist; out.push(S); } return out; };
    // the swing: impact frames all round (the sim's damage frame vs a target at 0.8 reach), and whole swings 1/60 s apart for pops
    const base = play((S) => { S.run.msg = null; S.run.en = []; }), clone = () => structuredClone(base);
    const swingAt = (a, T, tgt) => { const S = clone(), h = S.run.hero; h.aim = h.atkA = a; h.face = Math.cos(a) >= 0 ? 1 : -1; h.back = Math.sin(a) < -0.5 ? 1 : 0; h.atkT = S.t - T; h.vx = h.vy = 0;
      S.ev.push({ k: 'swing', t: h.atkT, x: h.x, y: h.y, a, n: 0, f: h.face });
      if (tgt) { const r = SIM.stats(h, S.meta).reach * 0.8; h.qaTgt = [h.x + Math.cos(a) * r, h.y + Math.sin(a) * r]; } return S; };
    // the impact frame with a real body on the target (a skeleton facing the hero), for the blade-over-target check
    const impactAt = (a) => { const S = swingAt(a, SIM.K.HIT, 1), h = S.run.hero, [x, y] = h.qaTgt;
      S.run.en = [{ id: 990, type: 'skeleton', x, y, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0, face: x < h.x ? 1 : -1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }]; return S; };
    const impacts = Object.fromEntries([...Array(16).keys()].map((i) => { const a = -Math.PI + i * Math.PI / 8; return ['a' + Math.round(a * 180 / Math.PI), impactAt(a)]; }));
    const attacks = { hero_swing: { subject: 'hero', states: [...Array(16).keys()].map((i) => swingAt(-Math.PI + i * Math.PI / 8, SIM.K.HIT, 1)) } };
    const swings = {};
    for (const deg of [-135, -90, -45, 0, 45, 90, 135, 180]) swings['hero_swing_' + (deg < 0 ? 'm' + -deg : deg)] = [...Array(30).keys()].map((i) => swingAt(deg * Math.PI / 180, -0.03 + i / 60, 1));
    // enemy attacks played by the sim 1/60 s apart: wind-up → strike → back to the chase must not pop
    const enemyT = (ty, elite, move = 'slam', phase = 0, extra = {}) => { const fr = []; let S = play((S) => { const R = S.run, r = R.map.rooms.find((q) => q.id !== R.map.start && q.w >= 7 && q.h >= 5), h = R.hero, E = D.ENEMIES[ty];
      h.x = (r.x + 2) * TILE; h.y = (r.y + r.h / 2) * TILE; h.ifr = 1e9; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, h.y - VH / 2];
      R.en = [{ id: 990, type: ty, x: h.x + 34 + E.r, y: h.y, tx: h.x, ty: h.y, vx: 0, vy: 0, hp: E.hp * (phase ? 0.4 : 1), max: E.hp, dmg: 1, elite, room: r.id, st: D.BOSSES[ty] ? 'bwind' : 'wind', mv: move, phase, bossVersion: 1, t0: S.t,
        face: -1, aimA: Math.PI, targetD: 34 + E.r, travel: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }]; Object.assign(R.en[0], typeof extra === 'function' ? extra(R.en[0], h) : extra); });
      for (let i = 0; i < (move === 'weave' || move === 'charge' ? 180 : 100); i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } return fr; };   // the sim steps 1/120 s; frames are 1/60 s
    // monster walk cycles, right and down: one stride in 12 frames (the rig's own stride), subject en990
    const enCyc = (ty, dx, dy) => { const out = [], n = D.BOSSES[ty] ? 24 : 12, H0 = SZ(EN_TEX[ty])[1] * (D.BOSSES[ty] ? D.BOSSES[ty].scale || 1.6 : 1), st = MONSTERS.stride(ty, H0), E = D.ENEMIES[ty];
      for (let i = 0; i < n; i++) { const S = play((S) => { const R = S.run, h = R.hero, r = R.map.rooms.find((q) => q.id !== R.map.start && q.w >= 7 && q.h >= 5); R.msg = null; R.seen = R.seen.map(() => 1);
        h.x = (r.x + 1) * TILE; h.y = (r.y + 1) * TILE + 20; const x0 = (r.x + r.w / 2) * TILE, y0 = (r.y + r.h / 2) * TILE, d = i * st / n;
        R.en = [{ id: 990, type: ty, x: x0 + dx * d, y: y0 + dy * d, vx: dx * E.spd, vy: dy * E.spd, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: r.id, st: 'chase', t0: -9, face: dx < 0 ? -1 : 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: d, kbx: 0, kby: 0, burn: 0, burnT: 0 }];
        R.cam = [x0 - VW / 2, y0 - VH / 2]; }); out.push(S); } return out; };
    const enCycles = {}; for (const ty of ['skeleton', 'goblin', 'brute', 'cultist', 'spider', 'drowned', 'boss_spider', 'boss_necro', 'boss_forge']) if (MONSTERS.rigOf(ty)) { enCycles[ty + '_right'] = enCyc(ty, 1, 0); enCycles[ty + '_down'] = enCyc(ty, 0, 1); }
    const transitions = { boss_combo: enemyT('boss', 1, 'charge', 1), queen_weave: enemyT('boss_spider', 1, 'weave'), queen_attack: enemyT('boss_spider', 1), necro_attack: enemyT('boss_necro', 1), forge_attack: enemyT('boss_forge', 1), skeleton_attack: enemyT('skeleton', 0), drowned_attack: enemyT('drowned', 0), slime_attack: enemyT('slime', 0), slime_s_attack: enemyT('slime_s', 0),
      // the grab from out of the blow's reach: it catches the hero and hauls him a step in
      drowned_grab: enemyT('drowned', 0, 'slam', 0, (e, h) => ({ x: h.x + 34 + D.ENEMIES.drowned.r + 70, grab: 1 })), brute_attack: enemyT('brute', 1), spider_attack: enemyT('spider', 0), boss_attack: enemyT('boss', 0), cultist_attack: enemyT('cultist', 0) };
    // deaths: a few live frames, then the kill, through the fall and the bounce (the hero mid-stride and at rest, a skeleton)
    const eventT = (prep, kill) => { const fr = []; let S = play(prep); for (let i = 0; i < 75; i++) { if (i === 5) kill(S); fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } return fr; };
    const heroDies = (S) => { const h = S.run.hero; h.hp = 0; h.deadT = S.t; };
    transitions.hero_death = eventT((S) => { S.run.en = []; S.run.msg = null; }, heroDies);
    transitions.hero_death_run = eventT((S) => { S.run.en = []; S.run.msg = null; const h = S.run.hero; h.vx = SIM.K.RUN; h.gp = 1.3; }, heroDies);
    const clear = (S) => { S.run.en = []; S.run.msg = null; };
    transitions.hero_dash = eventT(clear, (S) => { const h = S.run.hero; h.dashT = S.t; h.dashX = 1; h.dashY = 0; });
    transitions.hero_dash_up = eventT(clear, (S) => { const h = S.run.hero; h.dashT = S.t; h.dashX = 0; h.dashY = -1; });
    transitions.hero_hurt = eventT(clear, (S) => { const h = S.run.hero; h.hurtT = S.t; h.hurtX = 1; });
    transitions.hero_turn = eventT(clear, (S) => { const h = S.run.hero; h.face = -h.face; h.faceT = S.t; });
    // whirl and cast need the pointer held on one aim: the sim re-aims the hero every step
    const aimT = (a, fire) => { const fr = []; let S = play(clear); for (let i = 0; i < 75; i++) { const h = S.run.hero, R = S.run;
      if (i === 5) { h.aim = a; const f = Math.cos(a) >= 0 ? 1 : -1; if (f !== h.face) { h.face = f; h.faceT = S.t; } fire(S, h); } fr.push(S); S = structuredClone(S);
      const sx = (h.x - R.cam[0]) * (D.ZOOM || 1), sy = (h.y - 30 - R.cam[1]) * (D.ZOOM || 1); for (let k = 0; k < 2; k++) SIM.step(S, { px: sx + Math.cos(a) * 300, py: sy + Math.sin(a) * 300, keys: [] }); } return fr; };
    const whirl = (S, h) => { h.whirlT = h.castT = S.t; h.castK = 'whirl'; h.whirlA = h.aim; S.ev.push({ k: 'whirl', t: S.t, x: h.x, y: h.y, a: h.aim, r: D.abRank('whirl', 1).r }); };
    // TASKS 177: the whirl's circle on screen is its reach: skeletons at the edge of the damage zone, right, left and below (the zone is squeezed ×1.3 in depth)
    states.push(['whirl_reach', play((S) => { const R = S.run, h = R.hero, E = D.ENEMIES.skeleton, wr = D.abRank('whirl', 1).r - 4 + E.r; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - VW / 2, h.y - VH / 2];
      R.en = [[wr, 0], [-wr, 0], [0, wr / 1.3]].map(([dx, dy], i) => ({ id: 980 + i, type: 'skeleton', x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0,
        face: dx > 0 ? -1 : 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }));
      h.aim = 0; whirl(S, h); h.whirlT = h.castT = S.ev.at(-1).t = S.t - 0.22; })]);
    const cast = (S, h) => { h.castT = S.t; h.castK = 'fireball'; };
    for (const [n, a] of [['r', 0], ['d', Math.PI / 2], ['ul', -2.3]]) { transitions['hero_whirl_' + n] = aimT(a, whirl); transitions['hero_cast_' + n] = aimT(a, cast); }
    // a lone monster beside the hero, then an event on it: a skeleton crumbles, a spider flips onto its back, a goblin's ears ring on a hit
    const lone = (ty, id = 990) => (S) => { const R = S.run, h = R.hero; R.msg = null; R.en = [{ id, type: ty, x: h.x + 60, y: h.y, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0,
      face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }]; };   // calm: it must not notice the hero and step up first
    const kill = (S) => { const e = S.run.en[0]; e.hp = 0; e.deadT = S.t; e.hitT = S.t; e.dieA = 0; };   // struck from the hero's side
    // every way each dies (the variant is the id's: skeleton id % 3 — heap, burst, topple; spider id % 2 — on its back, curled)
    transitions.skeleton_death = eventT(lone('skeleton'), kill); transitions.skeleton_death_burst = eventT(lone('skeleton', 991), kill); transitions.skeleton_death_topple = eventT(lone('skeleton', 992), kill);
    transitions.spider_death = eventT(lone('spider'), kill); transitions.spider_death_curl = eventT(lone('spider', 991), kill);
    // the two ways each of the rest goes down (id % 2), the ghost's one; then a blow on every type (the flinch)
    for (const ty of ['goblin', 'brute', 'cultist', 'boss']) { transitions[ty + '_death'] = eventT(lone(ty), kill); transitions[ty + '_death_b'] = eventT(lone(ty, 991), kill); }
    transitions.ghost_death = eventT(lone('ghost'), kill);
    for (const ty of ['drowned', 'slime']) { transitions[ty + '_death'] = eventT(lone(ty), kill); transitions[ty + '_death_b'] = eventT(lone(ty, 991), kill); }
    // the drowned stands up out of the shallows (the hero out of its sense: the rise is the event's), and sinks back at its post
    const lurk = (S) => { lone('drowned')(S); const e = S.run.en[0], h = S.run.hero; h.x -= 140; e.st = 'lurk'; e.t0 = -9; };
    transitions.drowned_rise = eventT(lurk, (S) => { const e = S.run.en[0]; e.st = 'rise'; e.t0 = S.t; S.ev.push({ k: 'rise', t: S.t, x: e.x, y: e.y, id: e.id }); });
    transitions.drowned_sink = eventT((S) => { lurk(S); S.run.en[0].st = 'idle'; }, (S) => { const e = S.run.en[0]; e.st = 'lurk'; e.t0 = S.t; });
    for (const ty of ['skeleton', 'spider', 'brute', 'cultist', 'ghost', 'boss', 'drowned', 'slime']) transitions['hit_' + ty] = eventT((S) => { lone(ty)(S); const h = S.run.hero; h.x -= 400; S.run.cam = [h.x + 400 - VW / 2, h.y - VH / 2]; }, (S) => { S.run.en[0].hitT = S.t; });
    transitions.goblin_attack = enemyT('goblin', 0);
    transitions.goblin_hit = eventT((S) => { lone('goblin')(S); const h = S.run.hero; h.x -= 400; S.run.cam = [h.x + 400 - VW / 2, h.y - VH / 2]; }, (S) => { S.run.en[0].hitT = S.t; });
    // a monster at its post, 2 s at 1/60 s: breathing, a turn and a shift about the spot
    const loops = {};
    { const fr = []; let S = play((S) => { S.run.en = []; S.run.msg = null; }); for (let i = 0; i < 180; i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } loops.hero_idle = fr; }
    for (const ty of ['skeleton', 'goblin', 'spider', 'cultist', 'brute', 'ghost', 'boss', 'drowned', 'slime']) { const fr = []; let S = play((S) => { const R = S.run, h = R.hero; R.msg = null;
      R.en = [{ id: 990, type: ty, x: h.x + 90, y: h.y, hx: h.x + 90, hy: h.y, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0, face: -1, pf: -1, ft: -9, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }];
      h.x -= 400; R.cam = [h.x + 400 - VW / 2, h.y - VH / 2]; });
      for (let i = 0; i < 120; i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); }
      loops[ty + '_idle'] = fr; }
    // the merchant: his work loop (5 of its 6 s) at 1/60 s, then a greeting and a nod on a trade (subject 'merchant')
    { const fr = []; let S = shopS((S) => { const h = S.run.hero; h.x -= 500; h.y += 200; S.run.shop.greetT = -9; S.run.shop.tradeT = -9; });
      for (let i = 0; i < 300; i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } loops.merchant_work = fr; }
    for (const [nm, k] of [['merchant_greet', 'greetT'], ['merchant_trade', 'tradeT'], ['merchant_hit', 'hitT']]) { const fr = []; let S = shopS((S) => { S.run.shop.greetT = -9; S.run.shop.tradeT = -9; S.run.shop[k] = S.t + 0.1; S.run.shop.away = 0; });
      for (let i = 0; i < 100; i++) { fr.push(S); S = structuredClone(S); for (let k2 = 0; k2 < 2; k2++) SIM.step(S, { px: 960, py: 540, keys: [] }); } transitions[nm] = fr; }
    // every monster caught mid-turn (a third of the way through)
    states.push(['monsters_turn', play((S) => { lineup(S); for (const e of S.run.en) { e.pf = e.face; e.ft = S.t - 0.05; } })]);
    const box = (name, S) => Z === 1 || !S.run ? box1(name, S) : box1(name, S).map((v) => v * Z), box1 = (name, S) => { const R = S.run; if (!R) return [0, 0, W, H];
      if (name.startsWith('merchant')) { const sh = R.map.shop; return [sh.x - R.cam[0] - 60, sh.y - R.cam[1] - 100, 120, 110]; }
      const e = (enCycles[name] || loops[name]) && R.en[0];
      if (e) { const hh = SZ(EN_TEX[e.type])[1] * 1.15, ww = hh * 1.5; return [e.x - R.cam[0] - ww / 2, e.y - R.cam[1] - hh, ww, hh + 16]; }
      const h = R.hero; return [h.x - R.cam[0] - 50, h.y - R.cam[1] - 90, 100, 110]; };
    const anim = {};
    for (const kind of ['fountain', 'stream']) {
      const base = states.find(([name]) => name === 'water_' + kind + '_dungeon')?.[1]; if (!base) continue;
      const on = [], off = [];
      for (let i = 0; i < 24; i++) {
        const S = structuredClone(base); S.t += i / 60; on.push(S);
        const clean = structuredClone(S); clean.run.map.seed += 211000; clean.run.map.water = []; clean.run.map.waterFeatures = []; off.push(clean);
      }
      anim['water_' + kind] = { on, off, box: [400, 200, 1120, 680], min: 0.003 };
    }
    // the cave's water moves, and its fall pours, without going still (TASKS 304)
    for (const name of ['cave_water', 'cave_waterfall']) {
      const base = states.find(([n]) => n === name)?.[1]; if (!base) continue;
      const on = [], off = [];
      for (let i = 0; i < 24; i++) { const S = structuredClone(base); S.t += i / 60; S.ev = []; on.push(S);
        const clean = structuredClone(S), m = clean.run.map; m.seed += 304000; m.waterFeatures = [];
        if (name === 'cave_water') { m.water = []; m.waterBridges = []; m.crossings = []; m.cells = m.cells.map((c) => (c === 6 ? 1 : c)); } off.push(clean); }
      anim[name] = { on, off, box: name === 'cave_water' ? [400, 200, 1120, 680] : [880, 420, 160, 180], min: 0.003 };
    }
    // the cave's mushrooms breathe and shed spores, its roof drips: with them gone the frame must be calmer
    { const base = states.find(([n]) => n === 'cave_light')?.[1];
      if (base) { const on = [], off = [];
        for (let i = 0; i < 24; i++) { const S = structuredClone(base); S.t += i / 60; on.push(S); const clean = structuredClone(S), m = clean.run.map; m.decor = m.decor.filter((d) => !GLOW[d.n]); m.drips = []; off.push(clean); }
        anim.cave_light = { on, off, box: [610, 290, 700, 500], min: 0.003 }; } }
    // a fireball in flight on the cave's 2nd floor, bigger than every floor before it: the spells' floor mask was left with the
    // last floor's size there and hid every spell (the cast and the damage went on); masked, the ball still lights the floor
    // (+0.25 over the frame without it), drawn it adds +1.1
    { const S0 = play(); S0.run = SIM.newRun(S0, 'cave', 3); S0.screen = 'play'; SIM.enterFloor(S0, S0.run, 2); const R = S0.run, m = R.map, W = m.W;
      const k = m.rooms.filter((q) => q.type !== 'start' && q.type !== 'secret').map((q) => q.cy * W + q.cx).concat([...m.cells.keys()])
        .find((k) => [...Array(14).keys()].every((i) => m.cells[k + i - 2] === 1 && m.cells[k + i - 2 - W] === 1));
      if (k !== undefined) { const h = R.hero; h.x = (k % W + 0.5) * TILE; h.y = (Math.floor(k / W) + 0.5) * TILE; h.aim = 0; h.face = 1; h.vx = h.vy = 0;
        R.en = []; R.msg = null; R.seen.fill(1); R.rseen.fill(1); R.cam = [h.x - VW / 2, h.y - VH / 2]; S0.ev = [];
        const on = [], off = [], [hx, hy] = SIM.hand(h);
        for (let i = 0; i < 12; i++) { const S = structuredClone(S0); S.t += i / 60; const age = 0.05 + i / 60; off.push(structuredClone(S));
          S.run.proj = [{ id: 9900, k: 'fire', x: hx + 520 * age, y: hy, vx: 520, vy: 0, t0: S.t - age, life: 1.1, own: 'hero', r: 8 }]; on.push(S); }
        anim.cave_fireball = { on, off, box: [960, 380, 420, 160], min: 0.5 }; } }
    // the cave's water plants, lilies and moss stir, and the water rings round a bridge's posts (TASKS 306): measured on a frame
    // stilled round them (the water, the glowing mushrooms and the drips taken out, the bake rekeyed), with them and without them
    for (const name of ['cave_bridge']) { const base = states.find(([n]) => n === name)?.[1]; if (!base) continue; const on = [], off = [];
      const still = (S) => { const m = S.run.map; m.seed += 306000; m.water = []; m.waterFeatures = []; m.drips = []; m.deep = 0; m.cells = m.cells.map((c) => (c === 6 ? 1 : c)); m.decor = m.decor.filter((d) => !GLOW[d.n]); return S; };
      for (let i = 0; i < 24; i++) { const S = still(structuredClone(base)); S.t += i / 60; S.ev = []; on.push(S); const clean = structuredClone(S), m = clean.run.map;
        m.flora = []; for (const c of m.crossings) c.posts = []; off.push(clean); }
      anim[name + '_life'] = { on, off, box: [720, 380, 480, 320], min: 0.002 }; }
    for (const kind of ['bone', 'snuff', 'water', 'douse']) {
      const base = reactionS(kind, 0.02), on = [], off = [];
      for (let i = 0; i < 16; i++) { const S = structuredClone(base); S.t += i / 60; on.push(S); const clean = structuredClone(S); clean.ev = []; off.push(clean); }
      anim['reaction_' + kind] = { on, off, box: [940, 430, 170, 150], min: 0.002 };
    }
    for (const kind of ['whirl', 'fireball', 'boom']) {
      const base = spellState(kind, 0.05), on = [], off = [];
      for (let i = 0; i < 16; i++) {
        const S = structuredClone(base); S.t += i / 60;
        for (const p of S.run.proj) { p.x += p.vx * i / 60; p.y += p.vy * i / 60; }
        on.push(S); const clean = structuredClone(S); clean.ev = []; clean.run.proj = []; clean.run.scorches = []; off.push(clean);
      }
      anim['spell_' + kind] = { on, off, box: [760, 350, 420, 300], min: 0.02 };
    }
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
    // what the hero wears (TASKS 155): every armour with a matching set, from the front and from behind, alone in a lit room; the
    // walk cycles again in the full plate set (its parts must move like the plain rig's)
    const KIT = { none: {}, leather: { armor: 'leather_armor', helm: 'leather_helm', gloves: 'leather_gloves', boots: 'boots', offhand: 'buckler' },
      plate: { armor: 'plate_armor', helm: 'knight_helm', gloves: 'gauntlets', boots: 'iron_boots', offhand: 'tower_shield' }, cloak: { armor: 'cloak', gloves: 'leather_gloves', boots: 'boots', offhand: 'shield' },
      rare: { armor: 'plate_armor', helm: 'leather_helm', gloves: 'gauntlets', boots: 'boots', offhand: 'shield', rar: 3 } };
    const wear = (kit) => (S) => { const h = S.run.hero, k = KIT[kit]; for (const sl of ['armor', 'helm', 'gloves', 'boots', 'offhand']) h.eq[sl] = k[sl] ? { id: 0, b: k[sl], rar: k.rar || 0, lvl: 1, mods: {} } : null; };
    for (const kit of Object.keys(KIT)) for (const back of [0, 1]) states.push(['gear_' + kit + (back ? '_back' : ''), play((S) => { wear(kit)(S); const R = S.run, h = R.hero, m = R.map, rm = m.rooms[m.start];
      h.x = (rm.cx - 2.5) * TILE; h.y = (rm.cy + 1.5) * TILE; h.back = back; h.backT = -9; h.vx = h.vy = 0; R.en = []; R.msg = null; R.cam = [h.x - VW / 2, h.y - VH / 2]; })]);
    for (const [type, f] of [['boss_spider', 2], ['boss_necro', 4], ['boss_forge', 6], ['boss', 8]]) {
      for (const mv of Object.keys(D.BOSSES[type].moves)) states.push(['arena_' + type + '_' + mv, play((S) => {
        SIM.enterFloor(S, S.run, f); const R = S.run, b = R.en.find((e) => e.type === type), h = R.hero;
        h.x = b.x + 90; h.y = b.y + 130; h.ifr = 1e9; R.seen.fill(1); R.msg = null;
        SIM.step(S, { keys: [] }); b.st = 'bwind'; b.mv = mv; b.t0 = S.t; b.fired = 0; b.hitDone = 0;
        const span = D.bossMove(b).wind + (mv === 'weave' || mv === 'barrier' || mv === 'lava' ? 0.2 : mv === 'eggs' ? 1 : -0.05);
        for (let i = 0; i < Math.ceil(span / SIM.DT); i++) SIM.step(S, { keys: [] });
        R.cam = [b.x - VW / 2, b.y - VH / 2]; R.msg = { s: D.ENEMIES[type].name, t: S.t - 0.5 };
      })]);
    }
    // the forge lord's lava through its warning, a third, two thirds and the instant before it breaks through (TASKS 233)
    for (const [i, part] of [0.33, 0.66, 0.97].entries()) states.push(['arena_lava_warn_' + i, play((S) => {
      SIM.enterFloor(S, S.run, 6); const R = S.run, b = R.en.find((e) => e.type === 'boss_forge'), h = R.hero;
      h.x = b.x + 90; h.y = b.y + 130; h.ifr = 1e9; R.seen.fill(1); R.msg = null;
      SIM.step(S, { keys: [] }); b.st = 'bwind'; b.mv = 'lava'; b.t0 = S.t; b.fired = 0; b.hitDone = 0; const M = D.bossMove(b);
      for (let k = 0; k < Math.ceil((M.wind + 0.01 + M.warn * part) / SIM.DT); k++) SIM.step(S, { keys: [] });
      R.cam = [b.x - VW / 2, b.y - VH / 2]; })]);
    for (const [name, phase, span] of [['boss_phase2_volley', 1, 2.25], ['boss_phase3_warning', 2, 1.4], ['boss_phase3_lava', 2, 2.2]]) states.push([name, play((S) => {
      SIM.enterFloor(S, S.run, 8); const R = S.run, b = R.en.find((e) => e.type === 'boss'), h = R.hero;
      h.x = b.x + 90; h.y = b.y + 110; h.ifr = 1e9; R.seen.fill(1); SIM.step(S, { keys: [] });
      for (const e of R.en) if (e !== b) { e.hp = 0; e.deadT = S.t - 2; }
      b.hp = b.max * (D.BOSSES.boss.phases[phase].at - 0.001); b.phase = phase - 1;
      for (let i = 0; i < Math.ceil(span / SIM.DT); i++) SIM.step(S, { keys: [] });
      R.cam = [b.x - VW / 2, b.y - VH / 2]; R.msg = null;
    })]);
    const out = { states, anim, cycles: Object.assign({ hero_right: cyc(1, 0), hero_left: cyc(-1, 0), hero_down: cyc(0, 1), hero_up: cyc(0, -1), hero_plate_right: cyc(1, 0, wear('plate')), hero_plate_up: cyc(0, -1, wear('plate')) }, enCycles),
      sprites: Object.assign(Object.fromEntries(['hero_right', 'hero_left', 'hero_down', 'hero_up', 'hero_plate_right', 'hero_plate_up'].map((k) => [k, ['hero__cape', 'hero__thighL', 'hero__shinL', 'hero__footL', 'hero__thighR', 'hero__shinR', 'hero__footR', 'hero__body', 'hero__uarmL', 'hero__farmL', 'hero__uarmR', 'hero__farmR', 'hero__body_nh', 'hero__body_back_nh', 'hero__head_kn', 'hero__head_back_kn', 'hero__farmL_pl', 'hero__farmR_pl', 'it_shield_t']])),
        Object.fromEntries(Object.keys(enCycles).map((k) => { const n = MONSTERS.rigOf(k.split('_').slice(0, -1).join('_')); return [k, Object.keys(ASSETS).filter((a) => a.startsWith(n + '__') || a === n + '_weapon' || a === n + '_shield')]; }))),
      subject: Object.assign({ hero_right: 'hero', hero_left: 'hero', hero_down: 'hero', hero_up: 'hero', hero_plate_right: 'hero', hero_plate_up: 'hero' }, Object.fromEntries(Object.entries(transitions).map(([k, fr]) => [k, k.startsWith('hero') ? 'hero' : k.startsWith('merchant') ? 'merchant' : 'en' + ((fr[0].run.en[0] || {}).id ?? 990)])), Object.fromEntries(Object.keys(enCycles).map((k) => [k, 'en990'])), Object.fromEntries(Object.keys(loops).map((k) => [k, k.startsWith('merchant') ? 'merchant' : k.startsWith('hero') ? 'hero' : 'en990'])), Object.fromEntries(Object.keys(swings).map((k) => [k, 'hero']))), cycleT: { ...Object.fromEntries(Object.keys(enCycles).map((k) => { const ty = k.split('_').slice(0, -1).join('_'); return [k, MONSTERS.stride(ty, SZ(EN_TEX[ty])[1] * (D.BOSSES[ty] ? D.BOSSES[ty].scale || 1.6 : 1)) / D.ENEMIES[ty].spd]; })), hero_right: 2 * SIM.stepLen(1) / SIM.K.RUN, hero_left: 2 * SIM.stepLen(1) / SIM.K.RUN, hero_down: 2 * SIM.stepLen(0) / SIM.K.RUN, hero_up: 2 * SIM.stepLen(0) / SIM.K.RUN },
      rest: { hero_right: play(), hero_left: play(), hero_down: play(), hero_up: play((S) => { S.run.hero.back = 1; }), hero_plate_right: play(wear('plate')), hero_plate_up: play((S) => { wear('plate')(S); S.run.hero.back = 1; }) }, actors: ['hero', ...new Set(Object.keys(enCycles).map((k) => k.split('_').slice(0, -1).join('_'))), 'ghost', 'slime', 'boss'], loops, attacks, swings, impacts, transitions, box };
    calm(out); return out;
  };
})();
