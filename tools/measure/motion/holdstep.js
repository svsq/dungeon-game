// evalq.mjs body (town_motion_r10, TASKS 2126): a walker with an offer held by the hero coming his way, from the real sim at 1/60 s:
// the joints' largest one-frame step against the ground point through the stop (FOLK_HOLD.stop) and through setting off again after
// FOLK_HOLD.max, and a strip of every 2nd frame round each switch at zoom 3
// node tools/measure/motion/evalq.mjs tools/measure/motion/holdstep.js frames/critic_r10_motion/holdstep.json
const H = D => D.FOLK_HOLD, out = {}, png = {}, cv = document.getElementById('c'), BOX = 90, Z = 3;
for (const role of ['child', 'porter', 'sweeper', 'mason']) {
  const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play';
  const R = S.run, m = R.map, h = R.hero, HD = H(DATA); R.msg = null; R.captives = null; R.offers = [{ key: DATA.QUEST_SAY[role] ? 'fetch' : 'elites', from: role, q: 0 }]; R.quests = [];
  const f = R.folk.find((q) => q.role === role); if (!f) { out[role] = 'no walker'; continue; }
  h.x = m.town.svc.bin.x + DATA.TILE; h.y = m.town.svc.bin.y; const v0 = DATA.FOLK[role].v;
  const clear = () => [m.down, m.exit].every((q) => !q || Math.hypot(q.x - f.x, q.y - f.y) > HD.way + HD.near);
  for (let i = 0; i < 120 * 120 && !(f.go && f.spd > 0.9 * v0 && clear()); i++) SIM.step(S, { keys: [] });
  if (!(f.go && f.spd > 0.9 * v0)) { out[role] = 'never walks'; continue; }
  const v = Math.hypot(f.vx, f.vy); h.x = f.x - f.vx / v * (HD.near - 20); h.y = f.y - f.vy / v * (HD.near - 20); h.vx = h.vy = 0;
  const toward = () => ({ keys: [], left: f.x < h.x - 3, right: f.x > h.x + 3, up: f.y < h.y - 3, down: f.y > h.y + 3 });
  const id = 'npc' + f.i, fr = [];
  const shot = () => { const C = structuredClone(S); C.run.cam = [f.x - SCX.VW / 2, f.y - 40 - SCX.VH / 2]; fr.push(C); };
  let i = 0; for (; i < 60 && f.holdA == null; i++) { SIM.step(S, toward()); SIM.step(S, toward()); shot(); }
  if (f.holdA == null) { out[role] = 'not held'; continue; }
  const k0 = fr.length - 1; for (let q = 0; q < 40; q++) { SIM.step(S, { keys: [] }); SIM.step(S, { keys: [] }); shot(); }
  while (S.t - f.holdA < HD.max - 0.4) SIM.step(S, { keys: [] });
  const k1 = fr.length; for (let q = 0; q < 70; q++) { SIM.step(S, { keys: [] }); SIM.step(S, { keys: [] }); shot(); }
  const J = fr.map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id] || {}; LIB.TRACE = null; const g = st.run.folk.find((q) => q.i === f.i); return { j, spd: g.spd, go: g.go, held: g.holdA != null }; });
  const g0 = J.find((q) => q.j.ground && q.j.top), HH = g0.j.ground[1] - g0.j.top[1];
  const keys = Object.keys(g0.j).filter((k) => k !== 'ground' && J.every((q) => q.j[k] && q.j.ground));
  const worst = (a, b) => { const w = {}; for (const k of keys) { let mx = 0, at = -1; for (let n = Math.max(1, a); n < b; n++) { const p = J[n].j[k], o = J[n - 1].j[k], g = J[n].j.ground, go = J[n - 1].j.ground;
      const d = Math.hypot(p[0] - g[0] - (o[0] - go[0]), p[1] - g[1] - (o[1] - go[1])); if (d > mx) { mx = d; at = n; } } w[k] = [+(mx / HH).toFixed(3), at]; }
    return Object.entries(w).sort((x, y) => y[1][0] - x[1][0]).slice(0, 4); };
  const wait = fr[Math.min(fr.length - 1, k0 + 30)].run, wf = wait.folk.find((q) => q.i === f.i);
  out[role + '_face'] = { face: wf.face, heroSide: Math.sign(wait.hero.x - wf.x), heroD: Math.round(Math.hypot(wait.hero.x - wf.x, wait.hero.y - wf.y)), near: !!wf.near };
  const firstStill = J.findIndex((q, n) => n > k0 && q.spd === 0), firstGo = J.findIndex((q, n) => n >= k1 && q.spd > 0);
  out[role] = { H: +HH.toFixed(1), held: k0, still: firstStill, stillAfter: +((firstStill - k0) / 60).toFixed(2), go: firstGo, stopWorst: worst(Math.max(1, k0 - 4), k0 + 40), goWorst: worst(k1, fr.length),
    spd: J.slice(k0 - 2, k0 + 12).map((q) => +q.spd.toFixed(1)), ankles: J.slice(k0, k0 + 16).map((q) => q.j.ankleL ? [+(q.j.ankleL[0] - q.j.ground[0]).toFixed(1), +(q.j.ankleR[0] - q.j.ground[0]).toFixed(1)] : null) };
  const strip = (a, n, key) => { const c2 = document.createElement('canvas'); c2.width = n * BOX * Z; c2.height = BOX * Z; const g = c2.getContext('2d'); g.imageSmoothingEnabled = false;
    for (let q = 0; q < n; q++) { const st = fr[Math.min(fr.length - 1, a + q)]; LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const c = (LIB.TRACE[id] || {}).ground || [960, 560]; LIB.TRACE = null;
      g.drawImage(cv, c[0] - BOX / 2, c[1] - BOX * 0.85, BOX, BOX, q * BOX * Z, 0, BOX * Z, BOX * Z); }
    png[key] = c2.toDataURL(); };
  strip(Math.max(0, k0 - 3), 16, 'hold_' + role); strip(k1 + Math.max(0, firstGo - k1 - 3), 16, 'holdgo_' + role); }
return { out, png };
