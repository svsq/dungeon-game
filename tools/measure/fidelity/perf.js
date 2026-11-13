const Q = SCENE.QA(), gl = document.getElementById('c').getContext('webgl2'), px = new Uint8Array(4), res = {};
const want = ['magma_arch','magma_lake_shore','magma_crossing','magma_brink','zone_cave','zone_dungeon'];
for (const [n, S] of Q.states) { if (!want.includes(n)) continue; SCENE.state = S; for (let i = 0; i < 10; i++) { SCENE.render(S.t + 0.01); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); } const a = []; for (let i = 0; i < 80; i++) { const t0 = performance.now(); SCENE.render(S.t + 0.01 + i / 60); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); a.push(performance.now() - t0); } a.sort((x, y) => x - y); res[n] = [+a[40].toFixed(2), +a[72].toFixed(2)]; }
return res;
