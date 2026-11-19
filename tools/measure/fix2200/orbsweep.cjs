// node tools/measure/fix2200/orbsweep.cjs : the arch orb's height against the arch hold (TASKS 2200): ORB_HOLD.menu (hand reach, the upper
// arm's turn from plumb) and ORB_CUP.cut swept on a patched scene_hero.js, each with the limits heroPoseCheck and heroFistCheck put on the
// orb's palm (0.58..0.66 H, 0.03 H out, within 14 px of the orb, the forearm at most 50° off level); shares of the height over the soles
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '../../..');
const SIM = require(path.join(ROOT, 'live/sim.js')), D = require(path.join(ROOT, 'live/data.js')), SIMX = globalThis.SIMX;
const SBP = path.join(ROOT, 'live/sandbox.cjs'), read0 = fs.readFileSync;
const box = (hold, cut) => { fs.readFileSync = (f, ...a) => { const s = read0(f, ...a); if (String(f).endsWith('scene_hero.js')) return String(s).replace(/menu: \{ hand: \[[^\]]+\], elbow: [\d.-]+ \}/, `menu: { hand: [${hold[0]}, ${hold[1]}], elbow: ${hold[2]} }`).replace(/ORB_CUP = \{ cut: [\d.]+/, `ORB_CUP = { cut: ${cut}`); return s; };
  try { delete require.cache[require.resolve(SBP)]; const SB = require(SBP); return SB.heroBox(D, SIM, SB.assets()); } finally { fs.readFileSync = read0; } };
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), f3 = (x) => x.toFixed(3);
function at(hold, cut) {
  const { drawHero, L } = box(hold, cut), S = SIM.spawn(0, {}), R = SIM.newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R;
  R.hero.eq.weapon = { id: 0, b: 'staff', rar: 0, lvl: 1, mods: {}, atk: 6 }; R.hero.eq.offhand = { id: 0, b: 'orb', rar: 0, lvl: 1, mods: {}, def: 2 };
  const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, q) => { spr.push({ n, o: q }); return { w: 10, h: 10 }; }; L.solid = () => {};
  drawHero(Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face: 1, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), 300, 300, 10, SIMX.heroSt(S), { menu: 1 });
  const H = J.ground[1] - J.top[1], hy = (p) => (J.ground[1] - p[1]) / H, orb = spr.find((q) => /^orb_held/.test(q.n)), oc = [orb.o.m[4], orb.o.m[5]];
  const out = -(J.handL[0] - J.shL[0]) / H, lv = Math.abs(Math.atan2(J.handL[1] - J.elbowL[1], Math.abs(J.handL[0] - J.elbowL[0]))) * 180 / Math.PI, pd = d(oc, J.handL);
  const ok = hy(J.handL) >= 0.58 && hy(J.handL) <= 0.66 && out >= 0.03 && pd <= 14 && lv <= 50;
  return { orb: hy(oc), orbOut: -(oc[0] - J.shL[0]) / H, hand: hy(J.handL), elbow: hy(J.elbowL), sh: hy(J.shL), out, pd, lv, ok, belt: null };
}
const base = at([-0.3, 0.56, 0.08], 0.13);
console.log(`now: orb ${f3(base.orb)} H (out ${f3(base.orbOut)}), hand ${f3(base.hand)}, elbow ${f3(base.elbow)}, shoulder ${f3(base.sh)}`);
const rows = [];
for (const ea of [-0.3, -0.15, 0, 0.08, 0.2, 0.35, 0.5]) for (const hy of [0.5, 0.56, 0.62, 0.68, 0.74]) for (const hx of [-0.2, -0.3, -0.4]) for (const cut of [0.13, 0.3, 0.5]) {
  const r = at([hx, hy, ea], cut); rows.push(Object.assign({ hx, hy, ea, cut }, r)); }
rows.sort((a, b) => a.orb - b.orb);
console.log('lowest orbs that keep every limit:');
for (const r of [...rows.filter((r) => r.ok && r.cut === 0.13).slice(0, 3), ...rows.filter((r) => r.ok).slice(0, 4)]) console.log(`  hand [${r.hx}, ${r.hy}] elbow ${r.ea} cut ${r.cut}: orb ${f3(r.orb)} H out ${f3(r.orbOut)}, palm ${f3(r.hand)} out ${f3(r.out)}, elbow ${f3(r.elbow)}, orb–palm ${r.pd.toFixed(1)} px, forearm ${r.lv.toFixed(0)}°`);
console.log('lowest orbs over all (the limit each breaks):');
for (const r of rows.slice(0, 6)) console.log(`  hand [${r.hx}, ${r.hy}] elbow ${r.ea} cut ${r.cut}: orb ${f3(r.orb)} H, palm ${f3(r.hand)} out ${f3(r.out)}, orb–palm ${r.pd.toFixed(1)} px, forearm ${r.lv.toFixed(0)}°`);
