// body for evalq.mjs: the hens from the real sim — (a) one at its wander pace, 12 frames 1/12 s apart; (b) the hero walked up to it, 24 frames 1/24 s apart from the first sign of fright;
// (c) the child's grain: 12 frames 1/6 s apart of a hen pecking. Zoom 4, box 70. Each hen's ground point comes from LIB.TRACE (npc<i>).
// node tools/measure/motion/evalq.mjs tools/measure/motion/film_hens.js frames/critic_r8_motion/film_hens.json
const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] });
S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play';
const R = S.run, m = R.map, h = R.hero; R.msg = null; R.captives = null; R.folk = DATA.folkInit(m.town.npcs);
h.x = m.town.svc.portal.x + 3 * DATA.TILE; h.y = m.town.svc.portal.y; SIM.step(S, { keys: [] }); S.ev = []; R.greet = 'done';
const cv = document.getElementById('c'), BOX = 70, Z = 4, png = {}, out = {};
const step = (keys = []) => SIM.step(S, { px: 960, py: 540, keys });
const hens = R.folk.filter((q) => q.role === 'hen'), hen = hens[0];
const film = (name, n, gap, f) => { const strip = document.createElement('canvas'); strip.width = n * BOX * Z; strip.height = BOX * Z; const g = strip.getContext('2d'); g.imageSmoothingEnabled = false; const r = [];
  for (let k = 0; k < n; k++) { for (let q = 0; q < gap; q++) step(); R.cam = [f.x - SCX.VW / 2, f.y - 10 - SCX.VH / 2]; LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
    const j = LIB.TRACE['npc' + f.i] || {}, c = j.ground || [960, 550]; g.drawImage(cv, c[0] - BOX / 2, c[1] - BOX * 0.7, BOX, BOX, k * BOX * Z, 0, BOX * Z, BOX * Z);
    r.push({ k, t: +S.t.toFixed(3), x: +f.x.toFixed(1), y: +f.y.toFixed(1), vx: +(f.vx || 0).toFixed(1), vy: +(f.vy || 0).toFixed(1), spd: +f.spd.toFixed(1), face: f.face, scareT: f.scareT ?? null, turnT: f.turnT ?? null, j: JSON.parse(JSON.stringify(j)) }); }
  png[name] = strip.toDataURL(); out[name] = r; };
let n = 0; while (!(hen.spd > 18) && n++ < 120 * 120) step(); film('hen_wander', 12, 10, hen);
n = 0; while (n++ < 120 * 60 && hen.spd > 3) step();
h.x = hen.x - 70; h.y = hen.y; R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2];
n = 0; while (n++ < 120 * 10) { h.x += 0.5; h.vx = 60; step(); if (hen.scareT != null && S.t - hen.scareT < 0.1) break; }
film('hen_scare', 24, 5, hen);
R.grain = { x: hen.x + 6, y: hen.y + 3, t: S.t }; hen.goal = { x: hen.x + 6, y: hen.y + 3, v: 42, k: R.grain.t };
n = 0; while (Math.hypot(hen.x - R.grain.x, hen.y - R.grain.y) > 6 && n++ < 120 * 10) step();
film('hen_peck', 12, 20, hen);
return { out, png };
