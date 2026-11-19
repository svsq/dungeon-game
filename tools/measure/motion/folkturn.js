// evalq.mjs body (TASKS 2116): every folk_*_turn frame's hand and tool joints against the ground point, the turn's width and each joint's step
const Q = SCENE.QA(), out = {};
for (const nm of Object.keys(Q.transitions).filter((n) => /^folk_.*_turn$/.test(n))) { const id = Q.subject[nm];
  const fr = Q.transitions[nm].map((st) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id] || {}, v = LIB.TRACE[id + '_view'] || {}; LIB.TRACE = null; return { j, w: v.face && v.face[0] }; });
  const H = fr[0].j.ground[1] - fr[0].j.top[1], K = ['handL', 'handR', 'grip', 'tip'].filter((k) => fr.every((f) => f.j[k]));
  out[nm] = { H: +H.toFixed(1), rows: fr.map((f, i) => [+(f.w || 0).toFixed(2)].concat(K.map((k) => { const p = f.j[k], q = i ? fr[i - 1].j[k] : p; return k + ' ' + (p[0] - f.j.ground[0]).toFixed(1) + ',' + (p[1] - f.j.ground[1]).toFixed(1) + ' d' + Math.hypot(p[0] - q[0], p[1] - q[1]).toFixed(1); })).join(' | ')) }; }
return out;
