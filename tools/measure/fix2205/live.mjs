// node tools/measure/fix2205/live.mjs [outdir] [class] [armour] : TASKS 2205, tools/measure/fix2202/live.mjs for the warrior or the archer in
// an outfit: the cape front and back in the game's own renderer (tools/gamepage.mjs: grade, light, soft bones) on one spot under one light,
// rest, walking and running 12 frames of a stride, front facing right and back. Cape px under the shoulders within 0.3 H of the axis, L* under
// 48: the warrior's red (a* over 14 and over b* + 4), the archer's olive (a* under -1, b* over 6) or, in the cloak, its brown (a* over 4,
// b* over a*); the hem is the lowest row with at least 0.15 H of them.
// Prints per case the hem above the ground in shares of the height, its travel over the stride, the mean Lab and ΔE76 back against front;
// writes <outdir>/live.png (rows: front rest, back rest, back walking, back running; ×3).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url)); process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const OUT = path.resolve(ROOT, process.argv[2] || 'frames/fix_2205/after'), CLS = process.argv[3] || 'warrior', ARMOR = process.argv[4] || ''; fs.mkdirSync(OUT, { recursive: true });
const G = await openGame(); let r;
try {
  r = await G.page.evaluate(([CLS, ARMOR]) => {
    const BOX = 110, Z = 3, WIDE = 0.15, lab = (r, g, b) => { const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }, R = f(r), G = f(g), B = f(b);
      const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Zz = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
      const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Zz))]; };
    const cv = document.getElementById('c'), tmp = document.createElement('canvas'); tmp.width = tmp.height = BOX; const gt = tmp.getContext('2d', { willReadFrequently: true });
    const S = SIM.spawn(0, {}); SCENE.state = S; const R = SIM.newRun(S, 'campaign', 91, { cls: CLS }); S.run = R; S.screen = 'play'; R.en = []; R.msg = null; S.t = R.t = 10;
    const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 12; x <= cx + 12; x++) m.cells[y * m.W + x] = 1;
    h.x = cx * SIMX.TILE + 16; h.y = cy * SIMX.TILE + 18; h.eq.weapon = { id: 0, b: CLS === 'archer' ? 'shortbow' : 'sword', rar: 0, lvl: 1, mods: {}, atk: 6 }; if (ARMOR) h.eq.armor = { id: 0, b: ARMOR, rar: 0, lvl: 1, mods: {}, def: 3 };
    const cloth = CLS === 'archer' ? (ARMOR === 'cloak' ? (q) => q[1] > 4 && q[2] > q[1] : (q) => q[1] < -1 && q[2] > 6) : (q) => q[1] > 14 && q[1] > q[2] + 4;
    for (let i = 0; i < 30; i++) SIM.step(S, { px: 480, py: 270 });
    const base = { vx: 0, vy: 0, back: 0, backT: -9, face: 1, faceT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9, hurtT: -9, dashT: -9 }, keep = Object.assign({}, h);
    const grab = (over) => { Object.assign(h, keep, base, over); LIB.TRACE = {}; SCENE.render(S.t); const j = LIB.TRACE.hero || {}, c0 = j.ground, ox = Math.round(c0[0] - BOX / 2), oy = Math.round(c0[1] - BOX * 0.85);
      gt.clearRect(0, 0, BOX, BOX); gt.drawImage(cv, ox, oy, BOX, BOX, 0, 0, BOX, BOX); const px = gt.getImageData(0, 0, BOX, BOX).data;
      const gy = c0[1] - oy, H = gy - (j.top[1] - oy), sh = Math.max(j.shL[1], j.shR[1]) - oy, s = [0, 0, 0]; let n = 0, lo = -1;
      for (let y = Math.round(sh); y < BOX; y++) { let k = 0; for (let x = 0; x < BOX; x++) { const i = (y * BOX + x) * 4, q = lab(px[i], px[i + 1], px[i + 2]);
        if (cloth(q) && q[0] < 48 && Math.abs(x - BOX / 2) < 0.3 * H) { k++; n++; for (let c = 0; c < 3; c++) s[c] += q[c]; } } if (k >= WIDE * H) lo = y; }
      const img = document.createElement('canvas'); img.width = img.height = BOX; img.getContext('2d').drawImage(tmp, 0, 0);
      return { hem: (gy - lo - 1) / H, lab: s.map((v) => v / Math.max(1, n)), n, img }; };
    const RUN = SIM.K.RUN, rows = [['front rest', [{}]], ['back rest', [{ back: 1 }]],
      ['back walk', Array.from({ length: 12 }, (_, f) => ({ back: 1, vy: -0.5 * RUN, gp: f * Math.PI / 6 }))], ['back run', Array.from({ length: 12 }, (_, f) => ({ back: 1, vy: -RUN, gp: f * Math.PI / 6 }))],
      ['front walk', Array.from({ length: 12 }, (_, f) => ({ vx: 0.5 * RUN, gp: f * Math.PI / 6 }))], ['front run', Array.from({ length: 12 }, (_, f) => ({ vx: RUN, gp: f * Math.PI / 6 }))]];
    const sheet = document.createElement('canvas'); sheet.width = 12 * BOX * Z; sheet.height = rows.length * BOX * Z; const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false;
    const res = {}; rows.forEach(([name, overs], j) => { const fs = overs.map(grab); fs.forEach((f, i) => g.drawImage(f.img, 0, 0, BOX, BOX, i * BOX * Z, j * BOX * Z, BOX * Z, BOX * Z));
      res[name] = { hem: fs.reduce((a, f) => a + f.hem, 0) / fs.length, travel: Math.max(...fs.map((f) => f.hem)) - Math.min(...fs.map((f) => f.hem)), lab: [0, 1, 2].map((c) => fs.reduce((a, f) => a + f.lab[c], 0) / fs.length), n: fs.reduce((a, f) => a + f.n, 0) / fs.length }; });
    Object.assign(h, keep); return { res, url: sheet.toDataURL('image/png') };
  }, [CLS, ARMOR]);
} finally { await G.close(); }
const TAG = `${CLS}${ARMOR ? '_' + ARMOR : ''}`;
fs.writeFileSync(path.join(OUT, `live_${TAG}.png`), Buffer.from(r.url.split(',')[1], 'base64'));
const F = r.res['front rest'], log = Object.entries(r.res).map(([k, v]) => `${k.padEnd(11)} hem ${v.hem.toFixed(3)} H  hem travel ${v.travel.toFixed(3)} H  cape ${v.n.toFixed(0)} px  Lab ${v.lab.map((x) => x.toFixed(1)).join(' ')}  ΔE76 to front rest ${Math.hypot(...v.lab.map((x, i) => x - F.lab[i])).toFixed(1)}`);
fs.writeFileSync(path.join(OUT, `live_${TAG}.txt`), log.join('\n') + '\n'); console.log(log.join('\n'));
