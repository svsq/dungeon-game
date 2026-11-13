// live/gl.js — a tiny deterministic WebGL2 layer renderer: textures (premultiplied, mipmapped or nearest), programs, render
// targets, pixel-space quads (y down) with an affine transform. Everything the scene draws is a quad with a shader.
(function () {
  const G = (window.G = {});
  let gl, quadBuf, cur = null, PAR = null;
  const progs = {}, texs = {};
  let dropBinds = () => {};

  G.init = (canvas, W, H) => {
    canvas.width = W; canvas.height = H;
    gl = G.gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 not available');
    gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_color_buffer_half_float'); gl.getExtension('OES_texture_float_linear');
    PAR = gl.getExtension('KHR_parallel_shader_compile');
    quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    G.W = W; G.H = H;
  };
  G.resize = (W, H) => { const cv = gl.canvas; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } G.W = W; G.H = H; };
  // oy: a shift down of everything drawn on the screen (not into a target), for the HUD's windows laid out on a 1920×1080 frame
  // inside a taller view (TASKS 1861)
  G.oy = 0;
  const onScreen = (xf) => { if (!G.oy || cur) return xf; const q = xf.slice(); q[7] += G.oy; return q; };

  // the time spent in texture uploads on the page's thread, for the start's log (TASKS 2004)
  G.upMs = 0;
  // the PNG is unpacked by createImageBitmap off the page's thread (TASKS 2004): from an <img>, texImage2D unpacked each one on it,
  // 1.2 of the start's 1.9 s on a Mac; the same pixels either way (qashot frames compared). nearest: NEAREST min/mag, no mipmaps
  // (pixel art: crisp texels; lod bias has no effect)
  const viaImg = (name, url, o) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(upload(name, im, o)); im.onerror = () => rej(new Error('failed to load ' + url)); im.src = url; });
  G.load = (name, url, o = {}) => (!window.createImageBitmap ? viaImg(name, url, o) : fetch(url).then((r) => { if (!r.ok) throw new Error('failed to load ' + url); return r.blob(); })
    .then((b) => createImageBitmap(b, { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'default' })).then((im) => { const r = upload(name, im, o); im.close(); return r; }));
  const upload = (name, im, { repeat = false, nearest = false } = {}) => {
    dropBinds(); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const t0 = performance.now(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    if (!nearest) gl.generateMipmap(gl.TEXTURE_2D); G.upMs += performance.now() - t0;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    const wr = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
    return (texs[name] = { t, w: im.width, h: im.height });
  };
  G.canvasTex = (name, cv) => {
    dropBinds(); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return (texs[name] = { t, w: cv.width, h: cv.height });
  };
  // the render's CPU-side drawing surface (a 2D canvas: masks, the minimap, text) and its re-upload into the texture made from it:
  // with the page's address, the only ways the render reaches the page (ARCHITECTURE.md §8)
  G.canvas = () => document.createElement('canvas');
  G.params = new URLSearchParams(location.search);   // the render's dev switches (?fx=0, ?only=…)
  G.canvasUpdate = (rec, cv) => { if (qn) G.flush(); dropBinds(); gl.bindTexture(gl.TEXTURE_2D, rec.t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D); };
  // filled on the CPU already premultiplied, so a dark colour at low alpha keeps its 8 bits; sampled texel for texel
  G.dataTex = (name, w, h, data) => { if (qn) G.flush(); dropBinds(); let r = texs[name];
    if (!r) { r = texs[name] = { t: gl.createTexture(), w: 0, h: 0 }; gl.bindTexture(gl.TEXTURE_2D, r.t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
    else gl.bindTexture(gl.TEXTURE_2D, r.t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (r.w === w && r.h === h) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    else { r.w = w; r.h = h; gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data); }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); return r; };
  G.tex = (n) => { const t = texs[n]; if (!t) throw new Error('no texture ' + n); return t; };

  const VS_HEAD = `#version 300 es
in vec2 a_pos; uniform vec2 u_res; uniform mat3 u_xf; uniform vec2 u_flip;
out vec2 v_uv; out vec2 v_px;
`, VS_TAIL = `  v_px = p.xy; v_uv = mix(a_pos, 1.0 - a_pos, u_flip);
  gl_Position = vec4(p.x / u_res.x * 2.0 - 1.0, 1.0 - p.y / u_res.y * 2.0, 0.0, 1.0); }`;
  // the vertex shaders: 'one' every program's, the two batched ones apart (TASKS 2011: their uniform arrays in every program cost
  // each draw on ANGLE's Vulkan, which uploads a program's whole uniform block when any of it changes)
  const VSS = {
    one: VS_HEAD + 'void main(){ vec3 p = u_xf * vec3(a_pos, 1.0);\n' + VS_TAIL,
    // G.drawN: copy k of the quad shifted by u_off[k] px (an outline's ink copies, TASKS 2010)
    off: VS_HEAD + 'uniform vec2 u_off[16];\nvoid main(){ vec3 p = u_xf * vec3(a_pos, 1.0); p.xy += u_off[gl_InstanceID];\n' + VS_TAIL,
    // G.solid's batch: rect k is x, y, w, h in view px, its colour rgb and alpha (TASKS 2011)
    rect: VS_HEAD + 'uniform vec4 u_rect[64], u_rcol[64]; flat out vec4 v_rc;\nvoid main(){ vec4 r = u_rect[gl_InstanceID]; vec3 p = vec3(r.xy + a_pos * r.zw, 1.0); v_rc = u_rcol[gl_InstanceID];\n' + VS_TAIL,
  };
  const COMMON = `#version 300 es
precision highp float;
in vec2 v_uv; in vec2 v_px; out vec4 o;
uniform vec2 u_res; uniform float u_t;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// soft effects on the art grid (TASKS 1792): u_fxpx > 0 samples a quad once per u_fxpx view px and lays its level in four steps,
// grained where two steps meet, as the world's pixel art is; 0 keeps it smooth (the HUD, the light map)
uniform float u_fxpx; uniform vec4 u_fxq;
vec2 fxuv(){ if (u_fxpx <= 0.0 || u_fxq.z <= 0.0) return v_uv; return ((floor(v_px / u_fxpx) + 0.5) * u_fxpx - u_fxq.xy) / u_fxq.zw; }
float fxq(float g){ if (u_fxpx <= 0.0) return g; return floor(clamp(g, 0.0, 1.0) * 4.0 + 0.25 + 0.5 * hash(floor(v_px / u_fxpx))) / 4.0; }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s; }
vec2 scr(vec2 px){ return vec2(px.x / u_res.x, 1.0 - px.y / u_res.y); }   // screen px -> render-target uv
`;
  G.COMMON = COMMON;

  // G.defer (TASKS 2004): a program is compiled and linked but not asked whether it compiled until G.settle or its first draw. A
  // status query right after a compile waits for that one shader, so the forty of the start compiled one after another; on Windows
  // ANGLE turns each into HLSL for D3D11, much slower than on a Mac. Asked all at the end, the driver compiles them side by side
  G.defer = false;
  const unchecked = new Set();
  const finish = (P) => { const { p, sh, name } = P; unchecked.delete(P);
    for (const s of sh) if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(name + ': ' + gl.getShaderInfoLog(s));
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ': ' + gl.getProgramInfoLog(p));
    const loc = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); loc[u.name.replace('[0]', '')] = { l: gl.getUniformLocation(p, u.name), type: u.type }; }
    P.loc = loc; P.sh = null; };
  // programs are kept by name: a name asked again with another vertex shader is an error, not the old program (review of PR 62)
  G.program = (name, fs, vs = 'one') => {
    if (progs[name]) { if (progs[name].vs !== vs) throw new Error(name + ': made with the vertex shader ' + progs[name].vs + ', asked with ' + vs); return progs[name]; }
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram(), sh = [mk(gl.VERTEX_SHADER, VSS[vs]), mk(gl.FRAGMENT_SHADER, COMMON + fs)]; for (const s of sh) gl.attachShader(p, s);
    gl.bindAttribLocation(p, 0, 'a_pos'); gl.linkProgram(p);
    const P = (progs[name] = { p, loc: null, name, sh, vs }); unchecked.add(P); if (!G.defer) finish(P); return P;
  };
  // waits, a frame at a time, until the driver has compiled every deferred program (KHR_parallel_shader_compile; without it they are
  // asked at once), then checks them; returns how many there were
  G.settle = async () => { const n = unchecked.size, done = (P) => gl.getProgramParameter(P.p, PAR.COMPLETION_STATUS_KHR);
    if (PAR) while ([...unchecked].some((P) => !done(P))) await new Promise((r) => requestAnimationFrame(r));
    for (const P of [...unchecked]) finish(P); G.defer = false; return n; };
  G.parallel = () => !!PAR;

  // view: the coordinate space draws use (default w×h), e.g. a W/k × H/k target drawn in W×H view px; nearest: sample it crisp
  G.target = (w, h, float = false, { view = [w, h], nearest = false } = {}) => {
    if (qn) G.flush();
    dropBinds(); const t = gl.createTexture(), f = nearest ? gl.NEAREST : gl.LINEAR; gl.bindTexture(gl.TEXTURE_2D, t);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { fb, t, w, h, vw: view[0], vh: view[1] };
  };
  G.free = (tg) => { if (!tg) return; if (qn) G.flush(); gl.deleteFramebuffer(tg.fb); gl.deleteTexture(tg.t); };
  G.bind = (tg, clear) => {
    if (qn) G.flush();
    cur = tg; gl.bindFramebuffer(gl.FRAMEBUFFER, tg ? tg.fb : null);
    gl.viewport(0, 0, tg ? tg.w : G.W, tg ? tg.h : G.H);
    if (clear) { gl.clearColor(clear[0], clear[1], clear[2], clear[3]); gl.clear(gl.COLOR_BUFFER_BIT); }
  };
  G.cur = () => cur;
  G.clip = (tg, x, y, w, h) => { if (qn) G.flush(); if (!tg) { gl.disable(gl.SCISSOR_TEST); return; } const k = tg.w / tg.vw; gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.floor(x * k), Math.floor((tg.vh - y - h) * k), Math.ceil(w * k), Math.ceil(h * k)); };
  G.clearBox = (x, y, w, h) => { if (qn) G.flush(); const k = cur.w / cur.vw; gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.floor(x * k), Math.floor((cur.vh - y - h) * k), Math.ceil(w * k), Math.ceil(h * k)); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.disable(gl.SCISSOR_TEST); };
  G.blend = (mode) => {
    if (G.rec) { G.rec.push(mode || ''); return; }
    if (qn && (mode || '') !== qBlend) G.flush(); qBlend = mode || '';
    gl.enable(gl.BLEND);
    if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else if (mode === 'screen') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    // premultiplied over, but alpha drops by the source's: the lit pass reads 1 - alpha as "an emitter, don't multiply by the light"
    else if (mode === 'emit') gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'none') gl.disable(gl.BLEND);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  };

  // affine: place the unit quad at x,y (top-left) with size w,h, rotated by rot (rad) about pivot (px,py) in local px
  G.xf = (x, y, w, h, rot = 0, px = 0, py = 0) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    // local (u*w - px, v*h - py) rotated, then + (x + px, y + py)
    return [w * c, w * s, 0, -h * s, h * c, 0, x + px - (px * c - py * s), y + py - (px * s + py * c), 1];
  };

  // the quad's corners decide coverage alone: the one vertex shader only applies u_xf, so a quad outside the target can't touch a pixel
  // m: a margin (px) the quad may still move by, as G.drawN's copies do
  G.outside = (xf, m = 0) => { xf = onScreen(xf);
    const vw = (cur ? cur.vw : G.W) + m, vh = (cur ? cur.vh : G.H) + m, x0 = xf[6], y0 = xf[7], x1 = x0 + xf[0], y1 = y0 + xf[1], x2 = x0 + xf[3], y2 = y0 + xf[4], x3 = x1 + xf[3], y3 = y1 + xf[4];
    return (x0 <= -m && x1 <= -m && x2 <= -m && x3 <= -m) || (x0 >= vw && x1 >= vw && x2 >= vw && x3 >= vw) || (y0 <= -m && y1 <= -m && y2 <= -m && y3 <= -m) || (y0 >= vh && y1 >= vh && y2 >= vh && y3 >= vh);
  };
  let unit = 0, lastProg = null, attrSet = false;
  const unitTex = [];
  dropBinds = () => { unitTex.length = 0; };
  const sameVec = (u, v) => { const l = u.last; if (!l || l.length !== v.length) { u.last = new Float64Array(v); return false; } let eq = true; for (let i = 0; i < v.length; i++) if (l[i] !== v[i]) { l[i] = v[i]; eq = false; } return eq; };
  // a plain array is converted value by value on each call; a typed array of the same float32s is handed over as it is (TASKS 1372)
  const f32 = (u, v) => { let a = u.f32; if (!a || a.length !== v.length) a = u.f32 = new Float32Array(v.length); a.set(v); return a; };
  const sameNum = (u, v) => { if (u.last === v) return true; u.last = v; return false; };
  const setU = (P, k, v) => { const u = P.loc[k]; if (u) setL(u, v); };
  // a program's own uniforms (past u_res, u_xf, u_flip and the batches' u_off, u_rect, u_rcol) set from U by a function made for it, each field read by its name:
  // looking every key of U up in loc cost the Steam Deck a tenth of its frame (TASKS 1372); a sampler's unit follows loc's order
  const setterOf = (P) => {
    const keys = Object.keys(P.loc).filter((k) => k !== 'u_res' && k !== 'u_xf' && k !== 'u_flip' && k !== 'u_off' && k !== 'u_rect' && k !== 'u_rcol'), locs = keys.map((k) => P.loc[k]);
    if (!keys.every((k) => /^[A-Za-z_]\w*$/.test(k))) return (U) => { for (let i = 0; i < keys.length; i++) if (keys[i] in U) setL(locs[i], U[keys[i]]); };
    return new Function('setL', 'locs', 'return function (U) {' + keys.map((k, i) => ` if ('${k}' in U) setL(locs[${i}], U.${k});`).join('') + ' };')(setL, locs);
  };
  const setL = (u, v) => {
    const T = gl;
    if (u.type === T.SAMPLER_2D) { const tx = v.t || v, n = unit++; if (unitTex[n] !== tx) { unitTex[n] = tx; gl.activeTexture(gl.TEXTURE0 + n); gl.bindTexture(gl.TEXTURE_2D, tx); } if (!sameNum(u, n)) gl.uniform1i(u.l, n); }
    else if (u.type === T.FLOAT) { if (!sameNum(u, v)) gl.uniform1f(u.l, v); }
    else if (u.type === T.FLOAT_VEC2) { if (!sameVec(u, v)) gl.uniform2fv(u.l, f32(u, v)); }
    else if (u.type === T.FLOAT_VEC3) { if (!sameVec(u, v)) gl.uniform3fv(u.l, f32(u, v)); }
    else if (u.type === T.FLOAT_VEC4) { if (!sameVec(u, v)) gl.uniform4fv(u.l, f32(u, v)); }
    else if (u.type === T.FLOAT_MAT3) { if (!sameVec(u, v)) gl.uniformMatrix3fv(u.l, false, f32(u, v)); }
    else if (u.type === T.INT) { if (!sameNum(u, v)) gl.uniform1i(u.l, v); }
  };
  G.draw = (P, U, xf, flip = [0, 0]) => {
    if (G.rec) { G.rec.push([P, U, xf, flip]); return; }
    if (qn) G.flush();
    if (G.outside(xf)) return;
    xf = onScreen(xf);
    if (!P.loc) finish(P);
    if (lastProg !== P.p) { lastProg = P.p; gl.useProgram(P.p); }
    unit = 0;
    const res = cur ? [cur.vw, cur.vh] : [G.W, G.H];
    setU(P, 'u_res', res); setU(P, 'u_xf', xf); setU(P, 'u_flip', flip);
    (P.setAll || (P.setAll = setterOf(P)))(U);
    if (!attrSet) { attrSet = true; gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  // n copies of one quad in one call, copy k shifted by (off[2k], off[2k+1]) view px; n ≤ 16. The copies blend in order, k = 0 first.
  // No culling per copy: a copy off the target is clipped by the GPU, so it draws nothing, as G.draw's skip would
  G.N_OFF = 16;
  G.drawN = (P, U, xf, flip, off, n) => {
    if (G.rec) throw new Error('G.drawN while L.stamp records: the copies are drawn from the record, not into it');
    if (qn) G.flush();
    if (n <= 0) return;
    xf = onScreen(xf);
    if (!P.loc) finish(P);
    if (lastProg !== P.p) { lastProg = P.p; gl.useProgram(P.p); }
    unit = 0;
    const res = cur ? [cur.vw, cur.vh] : [G.W, G.H];
    setU(P, 'u_res', res); setU(P, 'u_xf', xf); setU(P, 'u_flip', flip); setU(P, 'u_off', off);
    (P.setAll || (P.setAll = setterOf(P)))(U);
    if (!attrSet) { attrSet = true; gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); }
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
  };
  // G.solid (TASKS 2011): flat rectangles in a row go out in one instanced call, 64 at most, in their order. The cave's moss is
  // hundreds of 2 px squares a frame and each was a draw of its own. Anything else that draws, binds, clips or changes the blend
  // sends the batch first, and SCENE.render ends with G.flush(); L.solid keeps a plain draw while G.rec records or for a turned rectangle
  const QN = 64, QR = new Float32Array(4 * QN), QC = new Float32Array(4 * QN); let qn = 0, qP = null, qBlend = '';
  G.solid = (P, xf, col, a) => {
    if (G.rec) throw new Error('G.solid while L.stamp records: L.solid draws a plain G.draw then');
    if (G.outside(xf)) return;
    xf = onScreen(xf);   // (the 16:10 frame's shift, as G.draw takes it)
    if (qn === QN || (qn && qP !== P)) G.flush();
    const i = 4 * qn++; qP = P; QR[i] = xf[6]; QR[i + 1] = xf[7]; QR[i + 2] = xf[0]; QR[i + 3] = xf[4]; QC[i] = col[0]; QC[i + 1] = col[1]; QC[i + 2] = col[2]; QC[i + 3] = a;
  };
  // a frame that threw left its batch behind: dropped at the next frame's start, not drawn into whatever target is bound then
  G.drop = () => { qn = 0; };
  G.flush = () => {
    if (!qn) return; const n = qn, P = qP; qn = 0;
    if (G.onFlush) G.onFlush(P, QR, n);   // tools (frameprof): the batch's program and rectangles
    if (!P.loc) finish(P);
    if (lastProg !== P.p) { lastProg = P.p; gl.useProgram(P.p); }
    const res = cur ? [cur.vw, cur.vh] : [G.W, G.H];
    setU(P, 'u_res', res);
    const r = P.loc.u_rect, c = P.loc.u_rcol; gl.uniform4fv(r.l, QR, 0, 4 * n); gl.uniform4fv(c.l, QC, 0, 4 * n); r.last = c.last = null;
    if (!attrSet) { attrSet = true; gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); }
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
  };
  G.full = (P, U) => { const res = cur ? [cur.vw, cur.vh] : [G.W, G.H]; G.draw(P, U, G.xf(0, 0, res[0], res[1])); };
})();
