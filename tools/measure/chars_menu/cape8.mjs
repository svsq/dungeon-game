// the hero's cape in the live sim, 8 directions: rendered with and without the cape layer, the difference is the cape's visible
// pixels; their height (share of the hero's ground-to-head span), the hem's lowest row, the mean Lab and ΔE76 against the rest pose
//   node tools/measure/chars_menu/cape8.mjs [--out frames/critic_chars_r5_menu/cape8] [--cls warrior,archer]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const { openGame } = await import(path.join(ROOT, 'tools/gamepage.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'frames/critic_chars_r5_menu/cape8'));
const CLS = opt('cls', 'warrior,archer').split(',');
fs.mkdirSync(OUT, { recursive: true });
const DIRS = [['rest', 0, 0], ['E', 1, 0], ['SE', 1, 1], ['S', 0, 1], ['SW', -1, 1], ['W', -1, 0], ['NW', -1, -1], ['N', 0, -1], ['NE', 1, -1]];
// walk: the first 0.25 s from a stand (still speeding up); run: 1.2 s in, at full speed; several frames each, the median taken
// the sim has one speed (8-way run with acceleration): «walk» is the first half second after the turn, «run» a second later
const PHASES = [['walk', [20, 24, 28, 32]], ['run', [70, 76, 82, 88]]];
const G = await openGame();
const lines = [];
for (const cls of CLS) {
  const res = await G.page.evaluate(([cls, DIRS, PHASES]) => {
    const fresh = () => { const S = SIM.spawn(0, {}); SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 1234, { cls }); S.screen = 'play';
      for (let i = 0; i < 30; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); const R = S.run; R.en = []; R.seen && R.seen.fill(1); return S; };
    const cv = document.getElementById('c'), tmp = document.createElement('canvas'), g = tmp.getContext('2d', { willReadFrequently: true });
    const capeKeys = Object.keys(window.ASSETS).filter((k) => /^hero__cape/.test(k) || /^hero_[a-z]+__cape/.test(k));
    const grab = (S, hide) => { const keep = {}; if (hide) for (const k of capeKeys) { keep[k] = window.ASSETS[k]; delete window.ASSETS[k]; }
      LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const tr = JSON.parse(JSON.stringify(LIB.TRACE.hero || {}));
      tmp.width = cv.width; tmp.height = cv.height; g.drawImage(cv, 0, 0); for (const k in keep) window.ASSETS[k] = keep[k]; return tr; };
    const lab = (r, gg, b) => { const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
      const R = f(r), G2 = f(gg), B = f(b), X = (0.4124 * R + 0.3576 * G2 + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G2 + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G2 + 0.9505 * B) / 1.08883;
      const h = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
    const out = {}, crops = {};
    for (const [dn, dx, dy] of DIRS) for (const [ph, frames] of PHASES) {
      if (dn === 'rest' && ph === 'run') continue;
      const S = fresh(), rows = []; let f = 0; const X0 = S.run.hero.x, Y0 = S.run.hero.y, C0 = S.run.cam.slice();
      for (const at of frames) {
        while (f < at) { SIM.step(S, { px: 960, py: 540, keys: [], left: dx < 0, right: dx > 0, up: dy < 0, down: dy > 0 }); f++; }
        const R = S.run, h = R.hero;
        // back on the start spot and camera for the frame only: the same light and floor under every direction
        const keepPos = [h.x, h.y, R.cam.slice()]; h.x = X0; h.y = Y0; R.cam = C0.slice();
        const tr = grab(S, false); const W = tmp.width, H = tmp.height;
        const gx = Math.round(tr.ground ? tr.ground[0] : W / 2), gy = Math.round(tr.ground ? tr.ground[1] : H / 2), hy = tr.head ? tr.head[1] : gy - 250;
        const x0 = Math.max(0, gx - 160), y0 = Math.max(0, gy - 330), cw = 320, ch = 360;
        const a = g.getImageData(x0, y0, cw, ch).data.slice(); grab(S, true); const b = g.getImageData(x0, y0, cw, ch).data;
        let n = 0, top = 1e9, bot = -1, left = 1e9, right = -1, L = 0, A = 0, B = 0;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const i = (y * cw + x) * 4;
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) { n++; top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); right = Math.max(right, x);
            const l = lab(a[i], a[i + 1], a[i + 2]); L += l[0]; A += l[1]; B += l[2]; } }
        const span = gy - hy;
        rows.push({ n, hgt: n ? (bot - top + 1) / span : 0, hem: n ? (gy - (y0 + bot)) / span : null, top: n ? (gy - (y0 + top)) / span : null, w: n ? (right - left + 1) / span : 0, lab: n ? [L / n, A / n, B / n] : null,
          face: h.face, back: h.back, spd: Math.hypot(h.vx, h.vy), span });
        if (at === frames[frames.length - 1]) { const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch; const g2 = c2.getContext('2d');
          const im = g2.createImageData(cw, ch); im.data.set(a); g2.putImageData(im, 0, 0); g2.strokeStyle = 'rgba(0,255,255,0.8)'; if (n) g2.strokeRect(left + 0.5, top + 0.5, right - left, bot - top);
          crops[cls + '_' + ph + '_' + dn] = c2.toDataURL('image/png'); }
        h.x = keepPos[0]; h.y = keepPos[1]; R.cam = keepPos[2];
      }
      out[ph + '_' + dn] = rows;
    }
    return { out, crops, capeKeys };
  }, [cls, DIRS, PHASES]);
  for (const [k, u] of Object.entries(res.crops)) fs.writeFileSync(path.join(OUT, k + '.png'), Buffer.from(u.split(',')[1], 'base64'));
  const med = (a) => { const s = a.filter((v) => v != null).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  const avgLab = (rows) => { const r = rows.filter((q) => q.lab); return r.length ? [0, 1, 2].map((i) => r.reduce((s, q) => s + q.lab[i], 0) / r.length) : null; };
  const ref = res.out.walk_rest, refLab = avgLab(ref), refH = med(ref.map((q) => q.hgt)), refHem = med(ref.map((q) => q.hem));
  lines.push(`== ${cls} (cape layers: ${res.capeKeys.join(' ')}); rest: height ${refH?.toFixed(3)} H, hem ${refHem?.toFixed(3)} H above ground, Lab ${refLab?.map((v) => v.toFixed(1)).join('/')}`);
  for (const [k, rows] of Object.entries(res.out)) { const L = avgLab(rows), dE = L && refLab ? Math.hypot(L[0] - refLab[0], L[1] - refLab[1], L[2] - refLab[2]) : null;
    const h = med(rows.map((q) => q.hgt)), hem = med(rows.map((q) => q.hem));
    lines.push(`${k.padEnd(9)} px ${String(med(rows.map((q) => q.n))).padStart(5)}  height ${h == null ? '-' : h.toFixed(3)} H (${h && refH ? (100 * h / refH).toFixed(0) : '-'} % of rest)  top ${med(rows.map((q) => q.top))?.toFixed(3) ?? '-'}  hem ${hem == null ? '-' : hem.toFixed(3)}  width ${med(rows.map((q) => q.w))?.toFixed(3)}  Lab ${L ? L.map((v) => v.toFixed(1)).join('/') : '-'}  dE ${dE == null ? '-' : dE.toFixed(1)}  face ${rows.at(-1).face} back ${rows.at(-1).back} spd ${rows.at(-1).spd.toFixed(0)}`); }
}
console.log(lines.join('\n') + '\n| errors: ' + (G.errors.length ? G.errors.slice(0, 3).join(' | ') : 'none'));
fs.writeFileSync(path.join(OUT, 'cape8.txt'), lines.join('\n') + '\n');
await G.close();
