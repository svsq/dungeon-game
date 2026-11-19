// node tools/measure/chars_motion/turn2202.mjs [outdir] : r5b motion, author remark 4 in the live game (tools/gamepage.mjs, WebGL, grade, soft
// bones), the sim stepped with the player's inputs: each class walks UP (or DOWN) for 0.5 s, then holds LEFT (or RIGHT); every frame of the first
// 24 after the switch is grabbed. Per frame: the view the renderer draws (hero_view back), the warrior's cape hem over the ground (rows with at
// least 0.15 H of red cape px, as fix2202/live.mjs) and the mage's orb centre and its step from the frame before. Sheets <cls>_<case>.png ×3.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { openGame } from '../../gamepage.mjs';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url)); process.chdir(ROOT);
const OUT = process.argv[2] || path.join(ROOT, 'frames/critic_chars_r5b_motion/turn'); fs.mkdirSync(OUT, { recursive: true });
const CASES = { upLeft: [[0, -1], [-1, 0]], upRight: [[0, -1], [1, 0]], downLeft: [[0, 1], [-1, 0]], upLeftWalkDiag: [[0, -1], [-1, -1]] };
const KIT = { warrior: ['sword'], mage: ['staff', 'orb'], archer: ['shortbow'] }, N = 24, BOX = 120, Z = 3;
const G = await openGame(); const log = [];
try {
  for (const cls of Object.keys(KIT)) for (const [cn, [pre, way]] of Object.entries(CASES)) {
    const r = await G.page.evaluate(([cls, kit, pre, way, N, BOX, Z]) => {
      const lab = (r, g, b) => { const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; }, R = f(r), G = f(g), B = f(b);
        const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Zz = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
        const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Zz))]; };
      const cv = document.getElementById('c'), tmp = document.createElement('canvas'); tmp.width = tmp.height = BOX; const gt = tmp.getContext('2d', { willReadFrequently: true });
      const sheet = document.createElement('canvas'); sheet.width = 12 * BOX * Z; sheet.height = Math.ceil(N / 12) * BOX * Z; const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false;
      const S = SIM.spawn(0, {}); SCENE.state = S; const R = SIM.newRun(S, 'campaign', 91, { cls }); S.run = R; S.screen = 'play'; R.en = []; R.msg = null; S.t = R.t = 10;
      const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 9; y <= cy + 9; y++) for (let x = cx - 12; x <= cx + 12; x++) m.cells[y * m.W + x] = 1;
      h.x = cx * SIMX.TILE + 16; h.y = cy * SIMX.TILE + 18; h.eq.weapon = { id: 0, b: kit[0], rar: 0, lvl: 1, mods: {}, atk: 6 };
      if (kit[1]) h.eq.offhand = { id: 0, b: kit[1], rar: 0, lvl: 1, mods: {}, def: 1 };
      const inp = ([dx, dy]) => { const q = { px: 480, py: 270 }; if (dx > 0) q.right = 1; if (dx < 0) q.left = 1; if (dy > 0) q.down = 1; if (dy < 0) q.up = 1; return q; };
      for (let i = 0; i < 30; i++) SIM.step(S, inp(pre));
      const fr = [];
      for (let f = 0; f < N; f++) { SIM.step(S, inp(way)); LIB.TRACE = {}; SCENE.render(S.t + 0.001); const j = LIB.TRACE.hero || {}, v = LIB.TRACE.hero_view || {};
        const c0 = j.ground || [960, 540], ox = Math.round(c0[0] - BOX / 2), oy = Math.round(c0[1] - BOX * 0.8);
        gt.clearRect(0, 0, BOX, BOX); gt.drawImage(cv, ox, oy, BOX, BOX, 0, 0, BOX, BOX); const px = gt.getImageData(0, 0, BOX, BOX).data;
        const gy = c0[1] - oy, H = gy - (j.top ? j.top[1] - oy : gy - 84), sh = j.shL ? Math.max(j.shL[1], j.shR[1]) - oy : gy - 0.7 * H; let lo = -1;
        if (cls === 'warrior') for (let y = Math.round(sh); y < BOX; y++) { let k = 0; for (let x = 0; x < BOX; x++) { const i = (y * BOX + x) * 4, q = lab(px[i], px[i + 1], px[i + 2]);
          if (q[1] > 14 && q[1] > q[2] + 4 && q[0] < 48 && Math.abs(x - BOX / 2) < 0.3 * H) k++; } if (k >= 0.15 * H) lo = y; }
        fr.push({ back: v.back ? v.back[0] : null, hem: lo >= 0 ? (gy - lo - 1) / H : null, orb: j.orb ? [j.orb[0] - ox, j.orb[1] - oy] : null, face: h.face });
        g.drawImage(tmp, 0, 0, BOX, BOX, (f % 12) * BOX * Z, Math.floor(f / 12) * BOX * Z, BOX * Z, BOX * Z); }
      return { fr, url: sheet.toDataURL('image/png') };
    }, [cls, KIT[cls], pre, way, N, BOX, Z]);
    fs.writeFileSync(path.join(OUT, `${cls}_${cn}.png`), Buffer.from(r.url.split(',')[1], 'base64'));
    let prev = null, worst = [0, -1];
    const cells = r.fr.map((q, i) => { let s = ''; if (q.orb) { const st = prev ? Math.hypot(q.orb[0] - prev[0], q.orb[1] - prev[1]) : 0; if (st > worst[0]) worst = [st, i]; prev = q.orb; s = ` orb ${q.orb[1].toFixed(1)}`; }
      return `${i}:${q.back === null ? '?' : q.back.toFixed(2)}${q.hem !== null ? ' hem ' + q.hem.toFixed(3) : ''}${s}`; });
    const hems = r.fr.map((q) => q.hem).filter((v) => v !== null);
    log.push(`${cls.padEnd(8)} ${cn.padEnd(15)} ${hems.length ? `hem ${Math.min(...hems).toFixed(3)}..${Math.max(...hems).toFixed(3)} H  ` : ''}${worst[1] >= 0 ? `orb max step ${worst[0].toFixed(1)} px @${worst[1]}  ` : ''}back frames ${r.fr.filter((q) => q.back > 0.5).length}/${N}`);
    log.push('   ' + cells.join(' | '));
  }
  log.push('errors ' + JSON.stringify(G.errors.slice(0, 3)));
} finally { await G.close(); }
fs.writeFileSync(path.join(OUT, 'turn.txt'), log.join('\n') + '\n'); console.log(log.join('\n'));
