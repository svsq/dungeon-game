// node tools/measure/chars_assets/sprlist_r4.cjs <cls> [menu] [json-extra] : the sprites drawHero lays down for one pose, in draw order, with their place and size
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SIMX = globalThis.SIMX, D = SIMX.D;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets());
const [cls = 'warrior', menu = '0', extra = '{}', kit = '{}'] = process.argv.slice(2);
const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R;
for (const [k, b] of Object.entries(JSON.parse(kit))) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 } : undefined;
const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
drawHero(Object.assign({}, R.hero, base, JSON.parse(extra)), 300, 300, 10, SIMX.heroSt(S), menu === '1' ? { menu: 1 } : {});
for (const q of spr) if (q.o && q.o.m) console.log(q.n.padEnd(30), 'at', q.o.m.slice(4).map((v) => v.toFixed(1)).join(','), 'rot', Math.atan2(q.o.m[1], q.o.m[0]).toFixed(2), 'w', q.o.w.toFixed(1), 'h', q.o.h.toFixed(1), 'alpha', q.o.u && q.o.u.alpha);
console.log('joints', Object.entries(J).map(([k, v]) => k + '[' + v.map((x) => x.toFixed(1)) + ']').join(' '));
