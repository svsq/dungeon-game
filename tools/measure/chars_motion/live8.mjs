// node tools/measure/chars_motion/live8.mjs [outdir] : r5 motion, author remarks 5–7. The game's page (tools/gamepage.mjs, the real WebGL
// renderer with grade and soft bones), the sim stepped by hand with the player's inputs (SIM.step, as views2198/sheet.cjs), for each class
// and each of the 8 ways, after a turn UP (0.5 s walking up) and after a turn DOWN: 4 frames walking (steps 3, 6, 9, 12 of the way: the
// hero speeding up) and 4 running (steps 40, 44, 48, 52). Per class a sheet <cls>_<after>.png (rows: ways, cols: frames, ×3), the view the
// sim keeps (h.back, h.face) per way, and for the warrior the cloak (red px: a* > 14, L* < 48, a* > b* + 2 under the shoulders) per way:
// lowest cloak row above the ground in shares of the figure's height, and mean Lab, against the warrior at rest.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { openGame } from '../../gamepage.mjs';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url)); process.chdir(ROOT);
const OUT = process.argv[2] || path.join(ROOT, 'frames/critic_chars_r5_motion/live8'); fs.mkdirSync(OUT, { recursive: true });
const WAYS = { down: [0, 1], 'down-right': [1, 1], right: [1, 0], 'up-right': [1, -1], up: [0, -1], 'up-left': [-1, -1], left: [-1, 0], 'down-left': [-1, 1] };
const KIT = { warrior: 'sword', mage: 'staff', archer: 'shortbow' }, STEPS = [3, 6, 9, 12, 40, 44, 48, 52], BOX = 120, Z = 3;
const G = await openGame(); const log = [];
try {
  for (const cls of ['warrior', 'mage', 'archer']) for (const [an, pre] of [['afterUp', [0, -1]], ['afterDown', [0, 1]]]) {
    const r = await G.page.evaluate(([cls, wb, WAYS, pre, STEPS, BOX, Z]) => {
      const lab = (r, g, b) => { const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }, R = f(r), G = f(g), B = f(b);
        const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Zz = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
        const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Zz))]; };
      const cv = document.getElementById('c'), tmp = document.createElement('canvas'); tmp.width = tmp.height = BOX; const gt = tmp.getContext('2d', { willReadFrequently: true });
      const names = Object.keys(WAYS), sheet = document.createElement('canvas'); sheet.width = STEPS.length * BOX * Z; sheet.height = names.length * BOX * Z; const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false;
      const stage = () => { const S = SIM.spawn(0, {}); SCENE.state = S; const R = SIM.newRun(S, 'campaign', 91, { cls }); S.run = R; S.screen = 'play'; R.en = []; R.msg = null; S.t = R.t = 10;
        const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 12; x <= cx + 12; x++) m.cells[y * m.W + x] = 1;
        h.x = cx * SIMX.TILE + 16; h.y = cy * SIMX.TILE + 18; h.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 }; return { S, R, h }; };
      const inp = ([dx, dy]) => { const q = { px: 480, py: 270 }; if (dx > 0) q.right = 1; if (dx < 0) q.left = 1; if (dy > 0) q.down = 1; if (dy < 0) q.up = 1; return q; };
      const grab = (S) => { LIB.TRACE = {}; SCENE.render(S.t + 0.001); const j = LIB.TRACE.hero || {}, c0 = j.ground || [960, 540], ox = Math.round(c0[0] - BOX / 2), oy = Math.round(c0[1] - BOX * 0.8);
        gt.clearRect(0, 0, BOX, BOX); gt.drawImage(cv, ox, oy, BOX, BOX, 0, 0, BOX, BOX); const px = gt.getImageData(0, 0, BOX, BOX).data;
        const gy = c0[1] - oy, top = j.top ? j.top[1] - oy : gy - 84, H = gy - top; let lo = -1, n = 0; const s = [0, 0, 0];
        if (cls === 'warrior') for (let y = Math.round(top + 0.3 * H); y < BOX; y++) for (let x = 0; x < BOX; x++) { const k = (y * BOX + x) * 4, q = lab(px[k], px[k + 1], px[k + 2]);
          if (q[1] > 14 && q[0] < 48 && q[1] > q[2] + 2 && Math.abs(x - BOX / 2) < 0.3 * H) { n++; lo = Math.max(lo, y); for (let i = 0; i < 3; i++) s[i] += q[i]; } }
        return { cape: n ? { bottom: (gy - lo) / H, n, lab: s.map((v) => v / n) } : null }; };
      const out = { ways: {}, rest: null };
      { const { S } = stage(); for (let i = 0; i < 30; i++) SIM.step(S, inp([0, 0])); out.rest = grab(S).cape; }
      names.forEach((way, row) => { const { S, h } = stage(); for (let i = 0; i < 30; i++) SIM.step(S, inp(pre)); for (let i = 0; i < 40; i++) SIM.step(S, { px: 480, py: 270 });
        const cs = [], views = []; let k = 0;
        for (let st = 1; st <= STEPS[STEPS.length - 1]; st++) { SIM.step(S, inp(WAYS[way])); if (st !== STEPS[k]) continue;
          const r = grab(S); cs.push(r.cape); views.push(`${h.back ? 'B' : 'F'}${h.face > 0 ? '>' : '<'}`); g.drawImage(tmp, 0, 0, BOX, BOX, k * BOX * Z, row * BOX * Z, BOX * Z, BOX * Z); k++; }
        out.ways[way] = { views, cs }; });
      out.url = sheet.toDataURL('image/png'); return out; }, [cls, KIT[cls], WAYS, pre, STEPS, BOX, Z]);
    fs.writeFileSync(path.join(OUT, `${cls}_${an}.png`), Buffer.from(r.url.split(',')[1], 'base64'));
    const f = (c) => (c ? `bottom ${c.bottom.toFixed(3)} H Lab ${c.lab.map((v) => v.toFixed(1)).join(' ')}` : '-');
    if (cls === 'warrior') log.push(`warrior ${an} rest cloak ${f(r.rest)}`);
    for (const [way, v] of Object.entries(r.ways)) {
      let line = `${cls.padEnd(8)} ${an.padEnd(9)} ${way.padEnd(10)} views ${v.views.join(' ')}`;
      if (cls === 'warrior' && r.rest) { const ok = v.cs.filter(Boolean), m = (sel) => ok.reduce((a, c) => a + sel(c), 0) / Math.max(ok.length, 1);
        const L = [0, 1, 2].map((i) => m((c) => c.lab[i])), dE = Math.hypot(...L.map((x, i) => x - r.rest.lab[i]));
        line += `  cloak bottom ${m((c) => c.bottom).toFixed(3)} H (rest ${r.rest.bottom.toFixed(3)})  Lab ${L.map((x) => x.toFixed(1)).join(' ')}  ΔE76 ${dE.toFixed(1)}`; }
      log.push(line); }
  }
  log.push('errors ' + JSON.stringify(G.errors.slice(0, 3)));
} finally { await G.close(); }
fs.writeFileSync(path.join(OUT, 'live8.txt'), log.join('\n') + '\n'); console.log(log.join('\n'));
