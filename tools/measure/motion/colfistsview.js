// evalq.mjs body (TASKS 2082): colossus_fists frames 20, 50, 70, 100, 130 close up, the hero taken off the frame, with each fist's contact
// point marked (green L, blue R) and its hand joint (yellow), three times the size
const Q = SCENE.QA(), list = Q.transitions.colossus_fists, id = Q.subject.colossus_fists, H = DATA.ENEMIES.boss_colossus.h, FR = [20, 50, 70, 100, 130], BOX = 260, K = 3;
const sheet = document.createElement('canvas'); sheet.width = FR.length * BOX * K; sheet.height = BOX * K; const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false;
FR.forEach((i, n) => { const S = structuredClone(list[i]); S.run.hero.x += 2000; LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
  const j = LIB.TRACE[id], e = S.run.en.find((q) => 'en' + q.id === id), c = j.ground, ox = c[0] - BOX / 2, oy = c[1] - BOX * 0.75;
  g.drawImage(document.getElementById('c'), ox, oy, BOX, BOX, n * BOX * K, 0, BOX * K, BOX * K);
  const dot = (p, col) => { g.fillStyle = col; g.fillRect(n * BOX * K + (p[0] - ox) * K - 4, (p[1] - oy) * K - 4, 8, 8); };
  for (const [side, col] of [['L', '#0f0'], ['R', '#08f']]) { const p = DATA.colossusContact(e, side); dot([c[0] + p.x - e.x, c[1] + p.y - e.y - 0.11 * H], col); dot(j['hand' + side], '#ff0'); } });
return { png: { colfists_view: sheet.toDataURL('image/png') } };
