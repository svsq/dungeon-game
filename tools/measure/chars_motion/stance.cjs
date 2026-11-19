// node tools/measure/chars_motion/stance.cjs [gait.json] : the standing pose at the end of each class's plain turn (both facings via the
// turn's first and last frame): ankle spread and depth offset in heights, knee bends, cape-side hand ahead of its elbow, toe-to-heel gap
const path = require('path'), ROOT = process.env.ROOT || path.join(__dirname, '../../..');
const T = require(process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'frames/critic_chars_r2_motion/gait.json'));
const knee = (j, k) => { const a = Math.atan2(j['knee' + k][1] - j['hip' + k][1], j['knee' + k][0] - j['hip' + k][0]) - Math.atan2(j['ankle' + k][1] - j['knee' + k][1], j['ankle' + k][0] - j['knee' + k][0]); return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI; };
for (const n of ['hero_turn', 'hero_mage_turn', 'hero_archer_turn', 'hero_idle']) { const s = T[n]; if (!s) continue;
  for (const [tag, r] of [['first', s.rows[0]], ['last', s.rows[s.rows.length - 1]]]) { const j = r.j, face = r.v.face ? r.v.face[0] : 1, H = j.ground[1] - j.top[1];
    console.log(`${n.padEnd(17)} ${tag.padEnd(5)} face ${face} H ${H.toFixed(1)}  spread ${(Math.abs(j.ankleR[0] - j.ankleL[0]) / H).toFixed(3)}H  depth ${((j.ankleL[1] - j.ankleR[1]) / H).toFixed(3)}H  knees L ${knee(j, 'L').toFixed(0)}° R ${knee(j, 'R').toFixed(0)}°  toe-heel gap ${((j.heelR[0] - j.toeL[0]) * face).toFixed(1)}px  handL-elbowL ${((j.handL[0] - j.elbowL[0]) * face).toFixed(1)}px`); } }
