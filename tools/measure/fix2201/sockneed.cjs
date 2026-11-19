// node tools/measure/fix2201/sockneed.cjs [grep] : per pose of the heroShoulderCheck list (no rest), the near shoulder's gap (world px²)
// with the 2188 copy and without it (what the copy closes), and the copy on top anywhere in the figure: where the copy is needed and
// where it only shows (TASKS 2201)
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SB = require(path.join(ROOT, 'live/sandbox.cjs')), { drawHero, L } = SB.heroBox(D, SIM, SB.assets()), { poses, shoulderGap } = SIMX.shoulder, { compose } = SIMX.heroLayers;
const re = new RegExp(process.argv[2] || '.');
const bare = (...a) => { const put = L.sprite; L.sprite = (n, ...r) => (/_sock/.test(n) ? { w: 10, h: 10 } : put(n, ...r)); try { return drawHero(...a); } finally { L.sprite = put; } };
function whole(p) { const S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: p.cls }); S.run = R;
  for (const [k, b] of Object.entries(p.kit)) R.hero.eq[k] = b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2, slot: k } : undefined;
  const J = {}, spr = []; L.joint = (id, n, q) => { if (id === 'hero') J[n] = q; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, p.h), 300, 300, p.GT, SIMX.heroSt(S), p.o);
  const c = compose(spr, [J.ground[0] - 60, J.ground[1] - 110, J.ground[0] + 60, J.ground[1] + 6], 4); let n = 0;
  for (const t of c.top) if (t >= 0 && /_sock/.test(spr[t].n)) n++; return n / 16; }
for (const cls of ['warrior', 'archer', 'mage']) for (const p of poses(cls)) { if (/rest/.test(p.tag) || !re.test(p.tag)) continue;
  const a = shoulderGap(drawHero, L, p), b = shoulderGap(bare, L, p), w = whole(p); if (a.back) continue;
  if (a.gap > 0.5 || b.gap > 0.5 || w > 0.5) console.log(`${p.tag.padEnd(58)} gap ${a.gap.toFixed(2).padStart(5)} without copy ${b.gap.toFixed(2).padStart(5)} copy shows ${w.toFixed(1).padStart(6)} turned ${a.turn.toFixed(2)}`); }
