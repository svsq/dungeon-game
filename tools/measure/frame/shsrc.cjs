const fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = (dir) => { const file = path.join(dir, 'live/scene_core.js'), src = fs.readFileSync(file, 'utf8').split('\n'), at = (re, what) => { const i = src.findIndex((l) => re.test(l)); if (i < 0) throw new Error(`${file}: no ${what}`); return i; };
  const start = at(/^\(function \(root\) \{\s*$/, 'opening (function (root) {') + 1, end = at(/^\s*const CAVE_WATER = `/, 'const CAVE_WATER = `');
  let body = src.slice(start, end).join('\n'); const D = require(path.resolve(dir, 'live/data.js'));
  for (const [re, what] of [[/^.*const SCX = \(root\.SCX = \{\}\);.*$/m, 'SCX line'], [/^.*const SC = \(window\.SCENE.*$/m, 'SC line'], [/^\s*let W = SIM\.VIEW.*$/m, 'view size line']]) { if (!re.test(body)) throw new Error(`${file}: no ${what}`); body = body.replace(re, ''); }
  const gl = fs.readFileSync(path.join(dir, 'live/gl.js'), 'utf8'), c0 = gl.indexOf('const COMMON = `'); if (c0 < 0) throw new Error(`${dir}/live/gl.js: no const COMMON`);
  const common = gl.slice(c0 + 16, gl.indexOf('`;', c0));
  const ctx = { window: { SIZES: {} }, SIM: { VIEW: { W: 1920, H: 1080 } }, DATA: D, LIB: { M: {} }, G: {}, out: null };
  vm.runInNewContext('(function(root){ const SCX = {}; const SC = {}, L = LIB, M = L.M, D = DATA, TILE = D.TILE; let W = 1920, H = 1080; ' + body + '\n; out = { MAGMA, LAVA }; })(this);', ctx);
  if (typeof ctx.out.MAGMA !== 'string' || typeof ctx.out.LAVA !== 'string') throw new Error(`${file}: MAGMA or LAVA is not a shader string`);
  return { common, ...ctx.out }; };
