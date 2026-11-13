// shore.js: real magma floors 13, 14 on six seeds, all revealed, no enemies, no hero: two views each centred on the longest lava edges; info holds the map for the shore-vs-cells check
(() => { const shots = [], info = [], I = { px: 960, py: 540, keys: [] }, T = 32;
  for (const sd of [1, 3, 5, 29, 53, 77]) for (const f of [13, 14]) {
    const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, I); S.run = SIM.newRun(S, 'campaign', sd, { town: 1 }); S.screen = 'play'; const R = S.run; SIM.enterFloor(S, R, f); const m = R.map; if (m.biome !== 'magma') continue;
    R.hero.ifr = 1e12; R.en = []; for (let i = 0; i < 90; i++) SIM.step(S, I); R.msg = null; R.en = []; R.seen = R.seen.map(() => 1); if (R.rseen) R.rseen = R.rseen.map(() => 1);
    const W = m.W, H = m.H, c = m.cells, score = [], vw = Math.ceil(SCX.VW / T), vh = Math.ceil(SCX.VH / T);
    for (let y = 2; y < H - vh; y += 4) for (let x = 2; x < W - vw; x += 4) { let e = 0; for (let v = y; v < y + vh; v++) for (let u = x; u < x + vw; u++) { const k = v * W + u; if (c[k] === 3 && (c[k + 1] === 1 || c[k - 1] === 1 || c[k + W] === 1 || c[k - W] === 1)) e++; } score.push([e, x, y]); }
    score.sort((a, b) => b[0] - a[0]); const views = [score[0]]; for (const s of score) if (views.length < 2 && Math.max(Math.abs(s[1] - views[0][1]) / vw, Math.abs(s[2] - views[0][2]) / vh) > 0.7) views.push(s);
    views.forEach((v, i) => { const C = structuredClone(S), Q = C.run; Q.cam = [v[1] * T, v[2] * T]; Q.hero.x = (v[1] + vw / 2) * T; Q.hero.y = (v[2] + vh / 2) * T; const n = `s${sd}_f${f}_v${i}`; shots.push([n, C, C.t + 0.01, { hero: 1 }]);
      let cells = ''; for (let y = v[2]; y < v[2] + vh + 1; y++) { for (let x = v[1]; x < v[1] + vw + 1; x++) cells += c[y * W + x]; cells += '/'; } const uS = new Set(m.lavaUnder || []); let under = ''; for (let y = v[2]; y < v[2] + vh + 1; y++) { for (let x = v[1]; x < v[1] + vw + 1; x++) under += uS.has(y * W + x) ? 'u' : '.'; under += '/'; } info.push({ cam: Q.cam, cells, under, zoom: Q.zoom || C.meta.zoom || 1, vw, vh }); });
  }
  window.__SHOTS = shots; window.__INFO = info; })();
