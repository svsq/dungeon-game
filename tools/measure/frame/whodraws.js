// evalq.mjs body (TASKS 1962, 1964): which LIB primitive puts the dark patches in a box of a QA state. Each primitive is muted in turn and the
// box rendered again; the pixels that change by more than DIFF and the mean luminance are reported, with the crops as png
const CASES = [['magma_arch', [900, 560, 110, 150]], ['magma_fog_walk', [480, 280, 240, 170]]], DIFF = 40;
const PRIMS = ['shadow', 'solid', 'sprite', 'stamp', 'cracks', 'glow', 'rrect', 'puff', 'star', 'ring'].filter((k) => typeof LIB[k] === 'function');
const Q = SCENE.QA(), cv = document.getElementById('c'), png = {}, out = {};
const grab = (S, box) => { SCENE.state = S; SCENE.render(S.t + 0.01); const o = document.createElement('canvas'); o.width = box[2]; o.height = box[3];
  const g = o.getContext('2d', { willReadFrequently: true }); g.drawImage(cv, box[0], box[1], box[2], box[3], 0, 0, box[2], box[3]); return { url: o.toDataURL('image/png'), d: g.getImageData(0, 0, box[2], box[3]).data }; };
const lum = (d) => { let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; return +(s / (d.length / 4)).toFixed(1); };
for (const [name, box] of CASES) {
  const S = (Q.states.find((q) => q[0] === name) || [])[1]; if (!S) { out[name] = 'no state'; continue; }
  const base = grab(S, box); png[name] = base.url; const r = { lum: lum(base.d) };
  for (const k of PRIMS) { const was = LIB[k]; LIB[k] = () => {}; let g; try { g = grab(S, box); } finally { LIB[k] = was; }
    let n = 0; for (let i = 0; i < g.d.length; i += 4) if (Math.abs(g.d[i] - base.d[i]) + Math.abs(g.d[i + 1] - base.d[i + 1]) + Math.abs(g.d[i + 2] - base.d[i + 2]) > DIFF) n++;
    r[k] = { changed: n, lum: lum(g.d) }; png[name + '_no_' + k] = g.url; }
  out[name] = r;
}
return Object.assign(out, { png });
