// node tools/measure/chars_motion/anchor.cjs [gait.json] : per frame distance of the weapon grip from the nearer hand, frames above 4 px
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const T = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'frames/critic_chars_r1_motion/gait.json'));
for (const [n, s] of Object.entries(T)) { if (!s) continue; const bad = [];
  s.rows.forEach((r, i) => { const j = r.j; if (!j.grip || !j.handR) return; const d = Math.min(Math.hypot(j.grip[0] - j.handR[0], j.grip[1] - j.handR[1]), j.handL ? Math.hypot(j.grip[0] - j.handL[0], j.grip[1] - j.handL[1]) : 1e9); if (d > 4) bad.push(i + ':' + d.toFixed(1)); });
  if (bad.length) console.log(n.padEnd(22), bad.length + '/' + s.rows.length, bad.slice(0, 14).join(' ')); }
