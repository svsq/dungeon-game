// body for evalq.mjs: the whole town at 1/60 s for 80 s of the real sim, one fixed camera over the yard; every townsperson's joints (LIB.TRACE npc<i>) and the cart's per frame, for the pop check in poptown.py
// node tools/measure/motion/evalq.mjs tools/measure/motion/pops_town.js frames/critic_r8_motion/pops_town.json
const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, { keys: [] });
S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play';
const R = S.run, m = R.map, h = R.hero; R.msg = null; R.captives = null; R.folk = DATA.folkInit(m.town.npcs);
h.x = m.town.svc.portal.x + 3 * DATA.TILE; h.y = m.town.svc.portal.y; SIM.step(S, { keys: [] }); S.ev = []; R.greet = 'done';
R.cam = [300, 120]; const rows = []; const J = (o) => { const r = {}; for (const [k, v] of Object.entries(o || {})) if (Array.isArray(v)) r[k] = v.map((x) => +x.toFixed(1)); return r; };
for (let i = 0; i < 80 * 60; i++) { SIM.step(S, { px: 960, py: 540, keys: [] }); SIM.step(S, { px: 960, py: 540, keys: [] }); R.cam = [300, 120];
  LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const row = { t: +S.t.toFixed(3), f: {}, c: J(LIB.TRACE.cart), e: S.ev.filter((e) => e.k !== 'say').map((e) => e.k) }; S.ev = [];
  for (const f of R.folk) row.f[f.role + f.i] = { x: +f.x.toFixed(1), y: +f.y.toFixed(1), spd: +(f.spd || 0).toFixed(1), face: f.face || 0, go: f.go ? 1 : 0, lift: f.lift || 0, j: J(LIB.TRACE['npc' + f.i]) };
  rows.push(row); }
return { rows };
