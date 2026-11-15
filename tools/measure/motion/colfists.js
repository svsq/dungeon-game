// evalq.mjs body (TASKS 2082): colossus_fists frame by frame — each fist's miss of its contact point as colossuscheck.mjs measures it, in the
// contact frames, and how far each knee sinks under its ankle (motioncheck kneeLow, 2 px and more on fewer than 40 of 200)
const Q = SCENE.QA(), name = 'colossus_fists', list = Q.transitions[name], id = Q.subject[name], M = DATA.BOSSES.boss_colossus.moves.fists, H = DATA.ENEMIES.boss_colossus.h;
const rows = [], gap = { L: 0, R: 0 }; let low = 0, contactN = 0;
for (let i = 0; i < list.length; i++) {
  const S = list[i], t = S.t + 0.01; LIB.TRACE = {}; SCENE.state = S; SCENE.render(t);
  const j = LIB.TRACE[id], e = S.run.en.find((q) => 'en' + q.id === id);
  if (!j || !e) { rows.push([i, null]); continue; }
  const knee = { L: j.kneeL[1] - j.ankleL[1], R: j.kneeR[1] - j.ankleR[1] };
  if (knee.L > 2 || knee.R > 2) low++;
  const contact = e.mv === 'fists' && t >= e.t0 + M.wind && t < (e.openUntil || e.t0 + M.wind + M.duration + M.stuck), miss = {};
  if (contact) { contactN++;
    for (const side of ['L', 'R']) { const p = DATA.colossusContact(e, side), target = [j.ground[0] + p.x - e.x, j.ground[1] + p.y - e.y - 0.11 * H];
      miss[side] = Math.hypot(j['hand' + side][0] - target[0], j['hand' + side][1] - target[1]); gap[side] = Math.max(gap[side], miss[side]); } }
  rows.push([i, e.st, +(t - e.t0).toFixed(2), contact ? 1 : 0, +(miss.L ?? -1).toFixed(1), +(miss.R ?? -1).toFixed(1), +knee.L.toFixed(1), +knee.R.toFixed(1), +(j.hip[1] - j.ground[1]).toFixed(1)]);
}
return { frames: list.length, contactN, gapL: +gap.L.toFixed(2), gapR: +gap.R.toFixed(2), kneeLow: low, cols: 'i st u contact missL missR kneeL kneeR hipOverGround', rows };
