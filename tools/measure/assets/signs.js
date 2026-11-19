// signs.js (town r9, body for evalq.mjs): the «−» and «+» buttons of the stack split window (TASKS 1988, 2114) on the stash screen,
// normal, hover and pressed; crops of each button x6 and of the window x1. The bag's first stackable item gets n 7.
// run: node tools/measure/motion/evalq.mjs tools/measure/assets/signs.js frames/critic_r9_assets/signs/views.json
const Q = SCENE.QA(), pick = (n) => (Q.states.find((s) => s[0] === n) || [])[1], c = document.getElementById('c'), png = {}, info = [];
const crop = (x, y, w, h, k) => { const v = document.createElement('canvas'); v.width = w * k; v.height = h * k; const g = v.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(c, x, y, w, h, 0, 0, w * k, h * k); return v.toDataURL('image/png'); };
const S = pick('town_stash'), R = S.run, bag = R.hero.bag; let k = bag.findIndex((it) => it && it.n > 1);
if (k < 0) { k = bag.findIndex((it) => it); if (k < 0) { bag[0] = { id: 'potion', n: 7 }; k = 0; } else bag[k].n = 7; }
const r = DATA.UI.split().r;
for (const [tag, hov, press] of [['norm', '', ''], ['hover', 'spPlus', ''], ['hoverm', 'spMinus', '']]) {
  S.split = { id: 'bag:' + k, key: bag[k].id, act: 'put', hi: bag[k].n, n: 3 }; S.focus = 'spOk'; S.hover = hov;
  SCENE.state = S; SCENE.render(S.t + 0.01);
  for (const b of r.filter((q) => q.id === 'spPlus' || q.id === 'spMinus')) png[tag + '_' + b.id] = crop(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 6);
  if (tag === 'norm') png.window = crop(700, 330, 520, 360, 1); }
info.push({ item: bag[k], r: r.map((q) => [q.id, q.x, q.y, q.w, q.h]) });
return { info, png };
