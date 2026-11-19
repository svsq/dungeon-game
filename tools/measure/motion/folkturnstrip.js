// evalq.mjs body (town_motion_r9): every folk_*_turn transition as one strip, frames 4..19 at 1/60 s, cropped round the walker's ground point at zoom 4
// node tools/measure/motion/evalq.mjs tools/measure/motion/folkturnstrip.js frames/critic_r9_motion/folkturnstrip.json
const Q = SCENE.QA(), cv = document.getElementById('c'), BOX = 90, Z = 4, A = 4, B = 20, png = {}, out = {};
for (const nm of Object.keys(Q.transitions).filter((n) => /^folk_.*_turn$/.test(n))) { const id = Q.subject[nm], fr = Q.transitions[nm].slice(A, B);
  const strip = document.createElement('canvas'); strip.width = fr.length * BOX * Z; strip.height = BOX * Z; const g = strip.getContext('2d'); g.imageSmoothingEnabled = false; out[nm] = [];
  fr.forEach((st, k) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id] || {}, c = j.ground || [960, 560]; LIB.TRACE = null;
    g.drawImage(cv, c[0] - BOX / 2, c[1] - BOX * 0.85, BOX, BOX, k * BOX * Z, 0, BOX * Z, BOX * Z); out[nm].push(c); });
  png['turn_' + nm.replace(/^folk_|_turn$/g, '')] = strip.toDataURL(); }
return { out, png };
