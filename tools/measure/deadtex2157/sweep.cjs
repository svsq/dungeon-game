// TASKS 2157: every hero texture drawHero can ask for, in Node: the sandbox's hero (live/sandbox.cjs) over the real ASSETS sizes, with
// every sprite drawn and every ASSETS lookup recorded, swept over class × armour × helm × gloves × boots × weapon × offhand × facing ×
// action × arch/world. Bases of every slot are tried on every class (a class's own table may not know them: that is a lookup too).
//   node tools/measure/deadtex2157/sweep.cjs [--out frames/fix_2157/sweep.json]
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), SB = require(path.join(ROOT, 'live/sandbox.cjs'));
const { D, heroSt } = globalThis.SIMX;
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(ROOT, 'frames/fix_2157/sweep.json');
const HERO = /^(hero|mage|archer)__/, raw = SB.assets(), drawn = {}, probed = {};
const sizes = new Proxy(raw, { get: (t, k) => { if (typeof k === 'string' && HERO.test(k)) probed[k] = (probed[k] || 0) + 1; return t[k]; } });
const { drawHero, L } = SB.heroBox(D, SIM, sizes);
L.sprite = (n) => { if (HERO.test(n)) drawn[n] = (drawn[n] || 0) + 1; return { w: 10, h: 10 }; }; L.solid = () => {}; L.joint = () => {};
const slot = (s) => [''].concat(Object.keys(D.BASES).filter((k) => D.BASES[k].slot === s));
const item = (b) => (b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 } : undefined);
const T = 10, AIMS = [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.4];
const ACTS = [{}, { vx: 150 }, { vy: -150 }, { vy: 150 }, { vx: 150, vy: -100 }, { back: 1 }, { back: 1, vx: 150 }, { back: 1, backT: T - 0.04 }, { back: 0, backT: T - 0.04 },
  { faceT: T - 0.02 }, { faceT: T - 0.08 }, { faceT: T - 0.15 }, { atkT: T - 0.05 }, { atkT: T - 0.15 }, { atkT: T - 0.3 }, { atkT: T - 0.15, back: 1 }, { patkT: T - 0.1 }, { patkT: T - 0.1, atkT: T - 0.05 },
  { castT: T - 0.1 }, { castT: T - 0.1, castK: 'whirl', whirlT: T - 0.3 }, { castT: T - 0.1, castK: 'charge', dashT: T - 0.05 }, { castT: T - 0.15, castK: 'cry' }, { dashT: T - 0.05, dashX: 1 },
  { hurtT: T - 0.05 }, { deadT: T - 0.1 }, { deadT: T - 2 }, { read: 1 }, { climbT: T - 0.2 }, { sunk: 0.5 }];
const OPTS = [{}, { menu: 1 }, { victory: 1 }, { armsUp: 1 }, { menu: 1, victory: 1 }];
let n = 0;
const base = { vx: 0, vy: 0, gp: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
const draw = (cls, eq, faces, aims, acts, opts) => { const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls }); S.run = R;
  for (const k of ['armor', 'helm', 'gloves', 'boots', 'weapon', 'offhand']) R.hero.eq[k] = item(eq[k]);
  const st = heroSt(S);
  for (const face of faces) for (const aim of aims) for (const a of acts) for (const o of opts) {
    if (o.menu && (a.vx || a.vy || a.deadT > 0)) continue;
    drawHero(Object.assign({}, R.hero, base, { face, aim, atkA: aim, patkA: aim }, a, { gp: (a.vx || a.vy ? 1.3 : 0) + aim }), 300, 300, T, st, o); n++; } };
// every outfit with every weapon, a few poses, both views
for (const cls of Object.keys(D.CLASSES)) for (const armor of slot('armor')) for (const helm of slot('helm')) for (const gloves of slot('gloves')) for (const boots of slot('boots')) for (const weapon of slot('weapon'))
  draw(cls, { armor, helm, gloves, boots, weapon }, [1, -1], [0, Math.PI], [ACTS[0], ACTS[1], ACTS[5], ACTS[13], ACTS[16], ACTS[18]], [{}, { menu: 1 }]);
// every weapon and offhand through every action, aim and option, in three outfits
const KITS = [{}, { armor: 'plate_armor', helm: 'knight_helm', gloves: 'gauntlets', boots: 'iron_boots' }, { armor: 'cloak', helm: 'circlet', gloves: 'leather_gloves', boots: 'boots' }, { armor: 'robe', helm: 'leather_helm' }, { armor: 'leather_armor' }];
for (const cls of Object.keys(D.CLASSES)) for (const kit of KITS) for (const weapon of slot('weapon')) for (const offhand of slot('offhand'))
  draw(cls, Object.assign({ weapon, offhand }, kit), [1, -1], AIMS, ACTS, OPTS);
const assets = Object.keys(raw).filter((k) => HERO.test(k)), used = (k) => drawn[k] || probed[k];
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ draws: n, assets, drawn, probed }, null, 1));
console.log(`${n} drawHero calls; hero textures ${assets.length}, drawn ${assets.filter((k) => drawn[k]).length}, only probed ${assets.filter((k) => !drawn[k] && probed[k]).length}, untouched ${assets.filter((k) => !used(k)).length}`);
for (const k of assets) if (!drawn[k]) console.log(probed[k] ? 'probed only' : 'untouched  ', k);
