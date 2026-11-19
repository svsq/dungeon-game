// evalq.mjs body (TASKS 2124): the child stopping and setting off (every 2nd frame round the switch at 1/60 s) and the porter's and the mason's
// walks without a load (folk_mason_right, the porter's cycle with the crate taken off), cropped round the walker's ground point at zoom 3
// node tools/measure/motion/evalq.mjs tools/measure/motion/stopgostrip.js frames/fix_2124/stopgostrip.json
const Q = SCENE.QA(), cv = document.getElementById('c'), BOX = 90, Z = 3, png = {}, out = {};
const strip = (key, id, fr) => { const c2 = document.createElement('canvas'); c2.width = fr.length * BOX * Z; c2.height = BOX * Z; const g = c2.getContext('2d'); g.imageSmoothingEnabled = false; out[key] = [];
  fr.forEach((st, k) => { LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01); const j = LIB.TRACE[id] || {}, c = j.ground || [960, 560]; LIB.TRACE = null;
    g.drawImage(cv, c[0] - BOX / 2, c[1] - BOX * 0.85, BOX, BOX, k * BOX * Z, 0, BOX * Z, BOX * Z); out[key].push(j.handR && [j.handR[0] - c[0], j.handR[1] - c[1]].map((v) => +v.toFixed(1))); });
  png[key] = c2.toDataURL(); };
for (const nm of ['folk_child_stop', 'folk_child_go']) { const fr = Q.transitions[nm], id = Q.subject[nm], sw = fr.findIndex((s, i) => i && s.run.folk.find((f) => 'npc' + f.i === id).go !== fr[i - 1].run.folk.find((f) => 'npc' + f.i === id).go);
  strip(nm.replace(/^folk_/, ''), id, fr.filter((_, i) => i >= sw - 6 && i < sw + 24 && (i - sw) % 2 === 0)); }
for (const role of ['porter', 'mason']) { const nm = 'folk_' + role + '_right', id = Q.subject[nm];
  strip('walk_' + role, id, Q.cycles[nm].map((s) => { const S = structuredClone(s); S.run.folk.find((f) => 'npc' + f.i === id).load = 0; return S; })); }
return { out, png };
