// body for evalq.mjs: the town from the real sim with the hero parked; for each walker, wait until it walks at full pace, then 12 frames 10 ticks apart
// (the sim runs at 120 Hz: 1/12 s) cropped round it and laid in one strip (zoom 3); also the walker's screen-space ground point per frame for a slide check
// node tools/measure/motion/evalq.mjs tools/measure/motion/film_walk.js frames/critic_r8_motion/film_walk.json
const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] });
S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play';
const R = S.run, m = R.map, h = R.hero; R.msg = null; R.captives = null; R.folk = DATA.folkInit(m.town.npcs);
h.x = m.town.svc.portal.x + 3 * DATA.TILE; h.y = m.town.svc.portal.y; SIM.step(S, { keys: [] }); S.ev = []; R.greet = 'done';
const cv = document.getElementById('c'), BOX = 150, Z = 3, N = 12, GAP = 10, png = {}, rows = {};
const want = ['porter', 'mason', 'sweeper', 'child'], work = ['smith', 'keeper', 'guard', 'enchanter'], GAPW = 20;
const step = () => SIM.step(S, { px: 960, py: 540, keys: [] });
for (const role of want) {
  const f = R.folk.find((q) => q.role === role); if (!f) continue;
  let n = 0; while (!(f.go && f.spd > 0.92 * DATA.FOLK[role].v) && n++ < 60 * 400) step();
  if (n >= 60 * 400) { rows[role] = { never: 1 }; continue; }
  const strip = document.createElement('canvas'); strip.width = N * BOX * Z; strip.height = BOX * Z * 1.2; const g = strip.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#222'; g.fillRect(0, 0, strip.width, strip.height);
  const r = []; for (let k = 0; k < N; k++) { for (let q = 0; q < GAP; q++) step();
    R.cam = [f.x - SCX.VW / 2, f.y - 30 - SCX.VH / 2]; LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
    const j = JSON.parse(JSON.stringify(LIB.TRACE['npc' + f.i] || {})); const c = j.ground || [960, 560];
    g.drawImage(cv, c[0] - BOX / 2, c[1] - BOX * 0.8, BOX, BOX * 1.2, k * BOX * Z, 0, BOX * Z, BOX * Z * 1.2);
    r.push({ k, t: +S.t.toFixed(3), x: +f.x.toFixed(1), y: +f.y.toFixed(1), vx: +(f.vx || 0).toFixed(1), vy: +(f.vy || 0).toFixed(1), spd: +f.spd.toFixed(1), face: f.face, ground: c, j }); }
  png['walk_' + role] = strip.toDataURL(); rows[role] = r; }
for (const role of work) { const f = R.folk.find((q) => q.role === role); if (!f) continue; for (let q = 0; q < 240 * 5; q++) step();
  const strip = document.createElement('canvas'); strip.width = N * BOX * Z; strip.height = BOX * Z * 1.2; const g = strip.getContext('2d'); g.imageSmoothingEnabled = false; const r = [];
  for (let k = 0; k < N; k++) { for (let q = 0; q < GAPW; q++) step(); R.cam = [f.x - SCX.VW / 2, f.y - 30 - SCX.VH / 2]; LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
    const j = LIB.TRACE['npc' + f.i] || {}; const c = j.ground || [960, 560]; g.drawImage(cv, c[0] - BOX / 2, c[1] - BOX * 0.8, BOX, BOX * 1.2, k * BOX * Z, 0, BOX * Z, BOX * Z * 1.2); r.push({ k, t: +S.t.toFixed(3), ground: c }); }
  png['work_' + role] = strip.toDataURL(); rows['work_' + role] = r; }
return { rows, png };
