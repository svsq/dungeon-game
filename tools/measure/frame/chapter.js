// chapter.js (r8): the stairs into a new chapter (8->9, 12->13): the 0.45 s fade, then the shared chapter banner by time; 
// first frames of the 13th on six more seeds with the start's vents; going up and back down; an ordinary floor as control (10->11)
(() => { const shots = [], info = [], D = DATA; const I = { px: 960, py: 540, keys: [] };
  const mk = (sd, f) => { const S = SIM.spawn(0, {}); S.meta.shards = 9999; SIM.step(S, I); S.run = SIM.newRun(S, 'campaign', sd, { town: 1 }); S.screen = 'play'; if (f) SIM.enterFloor(S, S.run, f); return S; };
  const adv = (S, s) => { const n = Math.round(s * 120); for (let i = 0; i < n; i++) { const h = S.run.hero; h.hp = Math.max(h.hp, 40); SIM.step(S, I); } };
  const E = (S) => { SIM.step(S, I); SIM.step(S, { px: 960, py: 540, keys: ['KeyE'] }); };
  const snap = (n, S, x) => { shots.push([n, structuredClone(S)]); const R = S.run; info.push(Object.assign({ f: R.floor, leaving: R.leaving, msg: R.msg && R.msg.s, msgd: R.msg && R.msg.d, msgk: R.msg && Object.keys(R.msg).join(','), biome: R.map.biome, hp: Math.round(R.hero.hp), gold: R.hero.gold, cam: R.cam && R.cam.map(Math.round), up: R.map.up && [Math.round((R.map.up.x-R.cam[0])*(R.zoom||S.meta.zoom||1)),Math.round((R.map.up.y-R.cam[1])*(R.zoom||S.meta.zoom||1))], lava: R.map.cells.reduce((a,v,k)=>{ if(v!==3) return a; const x=(k%R.map.W+.5)*32-R.cam[0], y=(Math.floor(k/R.map.W)+.5)*32-R.cam[1]; return a+(x>0&&x<1536&&y>0&&y<1080?1:0); },0), lit: (R.seen || []).reduce((a, v) => a + (v ? 1 : 0), 0) }, x || {})); };
  const slayBoss = (S) => { const R = S.run; const b = R.en.find((e) => D.BOSSES[e.type]); if (b) { b.hp = 0; b.deadT = S.t; R.bossDead = 1; R.arena = { active: 0, room: b.room, t0: 0 }; } for (const e of R.en) if (e !== b && Math.hypot(e.x - R.map.exit.x, e.y - R.map.exit.y) < 800) { e.x += 6000; e.hx = e.x; } return b; };
  const down = (tag, sd, f, ts) => { const S = mk(sd, f), R = S.run; slayBoss(S); R.hero.x = R.map.exit.x; R.hero.y = R.map.exit.y + 44; adv(S, 2.2); snap(`${tag}_pre`, S); E(S); let last = 0; for (const t of ts) { adv(S, t - last); last = t; snap(`${tag}_+${t}`, S); } return S; };
  const T = [0.1, 0.2, 0.3, 0.42, 0.46, 0.5, 0.6, 0.8, 1, 1.4, 2, 2.5, 3, 3.5, 4, 5];
  const S13 = down('d12to13_s77', 77, 12, T);


  for (const sd of [3, 5, 17, 29, 41, 53]) down(`first13_s${sd}`, sd, 12, [0.7, 1.5, 3.8]);
  { const S = structuredClone(S13), R = S.run; R.hero.x = R.map.up.x; R.hero.y = R.map.up.y + 30; adv(S, 0.5); snap('s13_at_up', S); E(S); adv(S, 0.5); snap('s13_up12_+0.5', S); adv(S, 2); R.hero.x = R.map.exit.x; R.hero.y = R.map.exit.y + 44; adv(S, 0.4); E(S); for (const t of [0.1, 0.5, 1.5, 3.5]) { adv(S, t === 0.1 ? 0.1 : t === 0.5 ? 0.4 : t === 1.5 ? 1 : 2); snap(`s13_redown_+${t}`, S); } }
  window.__SHOTS = shots; window.__INFO = info; })();
