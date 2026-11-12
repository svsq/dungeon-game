// node tools/measure/frame/shdiff.cjs <old tree> [new tree]: the magma ground shader of two trees (git archive one into frames/) drawn on the same
// synthetic textures and uniforms, 10 trials (6..9 the lake islands: no plateau, all lake); diffBytes 0 is the same image (PR 64 review)
const { chromium } = require(process.env.HOME + '/.claude/skills/ref2game/scripts/node_modules/playwright');
const src = require('./shsrc.cjs'), [base, cur] = process.argv.slice(2), A = src(base), B = src(cur || require('path').join(__dirname, '../../..'));
const VS = `#version 300 es
in vec2 a_pos; out vec2 v_uv; out vec2 v_px; uniform vec2 u_res;
void main(){ v_px = a_pos * u_res; v_uv = a_pos; gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`;
(async () => { const br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), pg = await br.newPage();
  const res = await pg.evaluate(({ VS, fa, fb }) => { const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270; const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true });
    const mk = (fs) => { const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'a_pos'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    let seed = 1; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const texs = []; const tex = (bias) => { const t = gl.createTexture(), N = 48, d = new Uint8Array(N * N * 4); for (let i = 0; i < d.length; i++) d[i] = Math.max(0, Math.min(255, Math.floor(rnd() * 256 * 0.6 + bias * 255 * 0.5))); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
    const run = (fs, trial) => { const p = mk(fs); gl.useProgram(p); seed = 1000 + trial * 7919; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); let unit = 0;
      for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i), l = gl.getUniformLocation(p, u.name), sz = u.size;
        if (u.type === gl.SAMPLER_2D) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, trial >= 6 && u.name === 'u_plat' ? tex(-2) : trial >= 6 && u.name === 'u_lake' ? tex(3) : tex(trial % 3 / 2)); gl.uniform1i(l, unit++); continue; }
        const v = (k) => Array.from({ length: k * sz }, () => rnd());
        if (u.name === 'u_res') { gl.uniform2f(l, 480, 270); continue; }
        if (u.name === 'u_map') { gl.uniform2f(l, 600, 400); continue; }
        if (u.name.startsWith('u_fall')) { const a = []; for (let j = 0; j < sz; j++) a.push(rnd() * 480, rnd() * 300, 10 + rnd() * 40, j < 3 ? 40 + rnd() * 120 : 0); gl.uniform4fv(l, a); continue; }
        if (u.type === gl.FLOAT) gl.uniform1fv(l, v(1).map((x) => x * (trial % 2 ? 4 : 1))); else if (u.type === gl.FLOAT_VEC2) gl.uniform2fv(l, v(2).map((x) => x * 300)); else if (u.type === gl.FLOAT_VEC3) gl.uniform3fv(l, v(3)); else if (u.type === gl.FLOAT_VEC4) gl.uniform4fv(l, v(4).map((x) => x * 300)); else if (u.type === gl.INT) gl.uniform1i(l, 0); }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); const px = new Uint8Array(480 * 270 * 4); gl.readPixels(0, 0, 480, 270, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    const out = []; for (let trial = 0; trial < 10; trial++) { const a = run(fa, trial), b = run(fb, trial); let d = 0, nz = 0; for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) d++; if (a[i]) nz++; } out.push({ trial, diffBytes: d, nonzero: nz }); } return out; },
    { VS, fa: A.common + A.MAGMA, fb: B.common + B.MAGMA });
  console.log(JSON.stringify(res)); await br.close(); })().catch((e) => { console.error(e.message); process.exit(1); });
