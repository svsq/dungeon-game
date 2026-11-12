// body for evalq.mjs: renders the SCENE.QA() states named in N (edit the list) and returns each frame as a png with its QA box
const N = ['magma_arch', 'magma_gate_rest'], Q = SCENE.QA(), cv = document.getElementById('c'), png = {}, box = {};
for (const n of N) { const q = Q.states.find((s) => s[0] === n); if (!q) continue; const S = typeof q[1] === 'function' ? q[1]() : q[1];
  SCENE.state = S; SCENE.render(S.t + 0.01); png[n] = cv.toDataURL('image/png'); try { box[n] = Q.box && Q.box(n, S); } catch (e) { box[n] = e.message; } }
return { box, png };
