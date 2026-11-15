// evalq.mjs body (TASKS 1964): the LIB.sprite calls whose box covers a point of magma_fog_walk where a dark patch stands in the lava, with the
// texture, the box and the scene line that drew it
const PTS = [[515, 300], [605, 330], [685, 425]];
const S = (SCENE.QA().states.find((q) => q[0] === 'magma_fog_walk') || [])[1], was = LIB.sprite, hits = [];
LIB.sprite = function (n, x, y, o = {}) {
  if (!o.m) { const w = o.w ?? 0, h = o.h ?? 0; for (const [px, py] of PTS) if (px >= x && px <= x + w && py >= y && py <= y + h) hits.push({ n, pt: [px, py], box: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)], u: JSON.stringify(o.u || {}).slice(0, 80), at: new Error().stack.split('\n').slice(2, 5).map((s) => s.trim().replace(/https?:\/\/[^/]+\//, '')) }); }
  return was.apply(this, arguments); };
try { SCENE.state = S; SCENE.render(S.t + 0.01); } finally { LIB.sprite = was; }
return { cam: S.run.cam, hits };
