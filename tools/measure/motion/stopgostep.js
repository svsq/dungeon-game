// evalq.mjs body (town_motion_r10): every folk_*_stop, folk_*_go and folk_hen_enter_* transition: the largest one-frame step of each joint
// as a share of the height, the frame it happens on and whether go switched there; and for the turns the width and pixel share per frame
// node tools/measure/motion/evalq.mjs tools/measure/motion/stopgostep.js frames/critic_r10_motion/stopgostep.json
const Q = SCENE.QA(), out = {};
for (const nm of Object.keys(Q.transitions).filter((n) => /^folk_.*_(stop|go|turn)$|^folk_hen_enter_/.test(n))) { const id = Q.subject[nm], L = Q.transitions[nm];
  const fr = L.map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id] || {}, v = LIB.TRACE[id + '_view'] || {}; LIB.TRACE = null;
    const f = st.run.folk.find((q) => 'npc' + q.i === id) || {}; return { j, w: v.face && v.face[0], go: f.go, x: f.x, y: f.y, cam: st.run.cam.slice() }; });
  if (/hen_enter/.test(nm)) { const W = fr.map((f) => f.j.head && f.j.tail ? f.j.head[0] - f.j.tail[0] : null), full = Math.max(...W.map((w) => Math.abs(w || 0)));
    out[nm] = { full: +full.toFixed(1), maxStep: +Math.max(...W.slice(1).map((w, i) => Math.abs(w - W[i]))).toFixed(1), w: W.map((w) => w === null ? null : +w.toFixed(1)) }; continue; }
  const g0 = fr.find((f) => f.j.ground && f.j.top); if (!g0) { out[nm] = 'no trace'; continue; }
  const H = g0.j.ground[1] - g0.j.top[1], keys = Object.keys(g0.j).filter((k) => Array.isArray(g0.j[k]) && k !== 'ground' && fr.every((f) => f.j[k]));
  const worst = {}; for (const k of keys) { let b = 0, at = -1; for (let i = 1; i < fr.length; i++) { const p = fr[i].j[k], q = fr[i - 1].j[k];
      const dg = [fr[i].j.ground[0] - fr[i - 1].j.ground[0], fr[i].j.ground[1] - fr[i - 1].j.ground[1]];
      const d = Math.hypot(p[0] - q[0] - dg[0], p[1] - q[1] - dg[1]); if (d > b) { b = d; at = i; } } worst[k] = [+(b / H).toFixed(3), at]; }
  const sw = fr.findIndex((f, i) => i && f.go !== fr[i - 1].go), gsteps = fr.slice(1).map((f, i) => +Math.hypot(f.j.ground[0] - fr[i].j.ground[0], f.j.ground[1] - fr[i].j.ground[1]).toFixed(2));
  const top = Object.entries(worst).sort((a, b) => b[1][0] - a[1][0]).slice(0, 4);
  out[nm] = { H: +H.toFixed(1), n: fr.length, sw, top, w: fr.map((f) => f.w === undefined ? null : +(+f.w).toFixed(2)), gmax: Math.max(...gsteps) }; }
return out;
