// live/sim_checks_saves.js — selfCheck's parts for floors left and come back to, scrolls, time away. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    boxHit, D, descend, DG, enterFloor, exitKind, FROM, interact, K, killEnemy, newQuest, newRun, persist, spawn, STAGE, step, TILE, useItem } = SIMX;
  function useItemCheck(S, R, i, out) { useItem(S, R, i); if (R.hero.read || !S.ev.some((e) => e.k === 'nope' && e.s === 'В городе свиток не нужен')) out.push('climb: a scroll is read in the town'); }
  // TASKS 1007, 1008, 1027: in a run through the town every floor has its stairs up in the start room, reachable from the spawn
  // (and a run that is not through the town has none); a floor left and come back to is as it was left (a kill, an open chest, loot
  // on the floor, the explored cells), the floor above is reached at the foot of its stairs down and the town from the 1st at its
  // gate; a scroll read through takes the hero home and the town's portal back to the very spot, then closes; a step breaks the
  // reading off and keeps the scroll; it is not read in the town; the save stays small and a saved run comes back on a kept floor
  function climbCheck() {
    const out = [], E = (S) => { if (S.run) S.run.enteredT = -9; step(S, { keys: ['KeyE'] }); };
    // the steps are where a hero coming down arrives: on floor reached from the start with the caches and locked doors shut (PR 30: seed 1's 7th put them in a cache)
    for (const sd of [1, 4, 5, 7, 17, 32, 39]) for (let f = 1; f <= 16; f++) { const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd, town: 1 }); if (!m.up) continue;
      const W = m.W, shut = new Set(m.doors.filter((d) => d.lock >= 0).flatMap((d) => d.cells.map(([x, y]) => y * W + x))), r = m.rooms[m.start], open = new Uint8Array(W * m.H), go = [r.cy * W + r.cx]; open[go[0]] = 1;
      while (go.length) { const k = go.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!open[n] && (m.cells[n] === 1 || m.cells[n] === 5) && !shut.has(n)) { open[n] = 1; go.push(n); } } }
      if (!open[(m.up.ty + (m.up.free ? 0 : 1)) * W + m.up.tx]) out.push(`climb ${sd}/${f}: the stairs up are cut off from the start`); }
    for (const sd of [5, 17]) for (let f = 1; f <= 12; f++) { const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd, town: 1 });
      if (!m.up) { out.push(`climb ${sd}/${f}: no stairs up`); continue; } const k = (m.up.ty + (m.up.free ? 0 : 1)) * m.W + m.up.tx, s0 = Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE);
      if (!m.up.free && [-1, 0, 1].some((i) => m.cells[m.up.ty * m.W + m.up.tx + i] !== 0)) out.push(`climb ${sd}/${f}: the stairs up are not in solid wall`);
      if (!m.up.free && (m.doors || []).some((d) => d.cells.some(([x, y]) => Math.abs(x - m.up.tx) < 3 && Math.abs(y - m.up.ty) < 3))) out.push(`climb ${sd}/${f}: a door beside the stairs up`);
      if (!m.up.free && f <= 8 && m.up.ty + 1 !== m.rooms[m.start].y && !m.rooms[m.start].wings) out.push(`climb ${sd}/${f}: the stairs up are not in the start room's top wall`);
      if (m.cells[k] !== 1 || m.walk[k] < 0 || Math.abs(m.walk[k] - m.walk[s0]) > 12) out.push(`climb ${sd}/${f}: the stairs up are off the floor or far from the spawn`);
      if (m.chests.some((c) => Math.hypot(c.x - m.up.x, c.y - m.up.y - 30) < 60)) out.push(`climb ${sd}/${f}: a chest by the stairs up takes the hero's E`);
      if (f === 3 && DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd }).up) out.push('climb: stairs up in a run not through the town'); }
    const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, at = (p, dy = 0) => { h.x = p.x; h.y = p.y + dy; };
    at(R.map.exit); E(S); if (R.floor !== 1) { out.push('climb: the crypt stairs do not lead down'); return out; }
    for (const e of R.en) { e.st = 'idle'; e.x += 5000; e.hx = e.x; }
    const e0 = R.en[0]; e0.hp = 0; e0.deadT = S.t; const c0 = R.chests[0]; c0.open = 1; R.seen[7] = 1; R.drops.push({ kind: 'gold', x: h.x, y: h.y, n: 77, id: R.nextId++ });
    at(R.map.exit); E(S); if (R.floor !== 2) { out.push('climb: no way down from the 1st'); return out; }
    if (Math.hypot(h.x - R.map.up.x, h.y - R.map.up.y) > 90) out.push('climb: down the stairs, the hero is not at the stairs up');
    at(R.map.up, 30); { const f0 = R.floor; R.enteredT = S.t; step(S, { keys: ['KeyE'] }); if (R.floor !== f0) out.push('climb: a tap of E right after arriving goes back up'); } E(S); if (R.floor !== 1) { out.push('climb: the stairs up do not lead to the floor above'); return out; }
    if (Math.hypot(h.x - R.map.exit.x, h.y - R.map.exit.y) > 80) out.push('climb: back up, the hero is not at the foot of the stairs down');
    const e1 = R.en.find((q) => q.id === e0.id), c1 = R.chests.find((q) => q.x === c0.x && q.y === c0.y);
    if (!e1 || e1.deadT < 0 || !c1 || !c1.open || R.seen[7] !== 1 || !R.drops.some((q) => q.kind === 'gold' && q.n === 77)) out.push('climb: the floor above is not as it was left');
    const T = spawn(1, JSON.parse(JSON.stringify(persist(S)))); T.run = T.saved; T.saved = null; T.screen = 'play'; at.call(null, T.run.map.exit);
    { const Q = T.run; Q.hero.x = Q.map.exit.x; Q.hero.y = Q.map.exit.y; E(T); Q.hero.x = Q.map.up.x; Q.hero.y = Q.map.up.y + 30; E(T); if (Q.floor !== 1 || !Q.en.find((q) => q.id === e0.id && q.deadT >= 0)) out.push('climb: a kept floor is lost in a saved run'); }
    h.bag[6] = { b: 'scroll', n: 2, id: R.nextId++ }; const px = h.x, py = h.y; step(S, { keys: [], click: 1, px: -999, py: -999 });
    h.read = { t0: S.t, i: 6 }; for (let i = 0; i < 30; i++) step(S, { right: 1, keys: [] }); if (h.read || h.bag[6].n !== 2) out.push('climb: walking does not break off the reading or the scroll is spent');
    h.read = { t0: S.t, i: 6 }; for (let i = 0; i < 240 && R.floor; i++) step(S, { keys: [] });
    if (R.floor !== 0 || !R.portal || R.portal.f !== 1 || h.bag[6].n !== 1) { out.push('climb: a scroll read through does not take the hero home'); return out; } void px; void py;
    const shelf0 = R.shop.goods.map((g) => g.it.id).join(), qx = R.portal.x, qy = R.portal.y; useItemCheck(S, R, 6, out);
    at(R.map.town.svc.portal, 30); E(S); if (R.floor !== 1 || R.portal || Math.hypot(h.x - qx, h.y - qy) > 2) out.push(`climb: the town's portal does not lead back to the spot (and close): floor ${R.floor}, ${Math.round(h.x - qx)},${Math.round(h.y - qy)}`);
    at(R.map.up, 30); E(S); if (R.floor !== 0 || !R.town || Math.hypot(h.x - R.map.exit.x, h.y - R.map.exit.y) > 80) out.push('climb: the 1st floor\'s stairs up do not lead to the town\'s gate');
    if (R.shop.goods.map((g) => g.it.id).join() !== shelf0) out.push('climb: the town shelf is re-rolled on a return with no deeper floor reached');
    const size = JSON.stringify(persist(S)).length; if (size > 120000) out.push(`climb: a run with two kept floors saves ${size} bytes`);
    // a floor kept by an older generator (a save from before R-18): its diff points past the monsters built now; the floor is built
    // anew with as many dead as died there, and stays so when left again
    // (two left of its own, ids M.id+2 and M.id+4: three bodies (ids M.id+0, 1, 3) cleared away and the first of the two lying dead: four; a hunt in hand there)
    { const M = R.memo[1]; delete M.gv; M.d = { p: { en: { n: 3, p: { 0: { p: { id: { v: M.id + 2 }, deadT: { v: 5 }, hp: { v: 0 } } }, 1: { p: { id: { v: M.id + 4 } } }, 2: { p: { id: { v: 99999 }, summ: { v: 7 } } }, 999: { p: { hp: { v: 1 } } } } } } };
      const q = newQuest(R, 'named', 1); (R.quests = R.quests || []).push(q); q.placed = 1;
      const dead = () => R.en.filter((e) => e.deadT >= 0).length, hunt = () => R.en.filter((e) => e.quest === q.id && e.deadT < 0).length;
      try { enterFloor(S, R, 1, undefined, 'up'); if (M.gv !== D.GEN_VERSION || dead() !== 4) out.push(`memo: an old generator's floor is not built anew with its dead, the cleared bodies too (${dead()}, not 4)`);
        if (hunt() !== 1) out.push('memo: a hunt in hand on an old generator\'s floor gets no quarry anew');
        enterFloor(S, R, 0, undefined, 'up'); enterFloor(S, R, 1); if (dead() !== 4 || hunt() !== 1) out.push('memo: an old generator\'s floor brings its dead back or loses its quarry once left again'); }
      catch (err) { out.push('memo: an old generator\'s floor fails to load: ' + err.message); }
      R.quests = R.quests.filter((o) => o !== q); }
    // an almost cleared old floor (more dead than the floor built now holds) still keeps a quarry for a hunt in hand
    { enterFloor(S, R, 0, undefined, 'up'); const M = R.memo[1]; delete M.gv; M.d = { p: { en: { n: 1, p: { 0: { p: { id: { v: M.id + 999 } } } } } } };
      const q = newQuest(R, 'named', 1); R.quests.push(q); q.placed = 1;
      try { enterFloor(S, R, 1); const live = R.en.filter((e) => e.deadT < 0 && !D.BOSSES[e.type]);
        if (live.length !== 1 || live[0].quest !== q.id) out.push(`memo: an almost cleared old floor leaves a hunt no quarry (${live.length} alive)`); }
      catch (err) { out.push('memo: an almost cleared old floor fails to load: ' + err.message); }
      R.quests = R.quests.filter((o) => o !== q); }
    // TASKS 1917, 1993: a kept floor whose diff no longer fits, or whose rebuild is laid otherwise, is built anew with its dead, never
    // shut; a step that still fails leaves the run where it was, its objects the same and the scroll read for it kept; a save made in
    // the half-made state the old code saved (the floor's number over the town's map, the town written into the floor's diff; no
    // step can make it now) loads in the town with its portal
    { const T3 = spawn(0, {}); T3.run = newRun(T3, 'campaign', 77, { town: 1, allFree: 1 }); T3.screen = 'play'; const Q = T3.run, hq = Q.hero, M = () => Q.memo[1];
      const home = () => { Q.portal = { f: 1, x: hq.x, y: hq.y }; enterFloor(T3, Q, 0, undefined, 'portal'); }, gate = (S, P) => { P.hero.x = P.map.town.svc.portal.x; P.hero.y = P.map.town.svc.portal.y + 30; interact(S, P); };
      const err = console.error, cp = root.SIMX.captivePlace, ofs = root.SIMX.offersOf; console.error = () => {};
      try {
        enterFloor(T3, Q, 1); const ids = Q.en.filter((e) => !D.BOSSES[e.type]).slice(0, 3).map((e) => e.id); for (const e of Q.en) if (ids.includes(e.id)) { e.hp = 0; e.deadT = T3.t; }
        Q.stats[1].kills = 3; Q.seen.fill(1); home(); M().d.p.map = { p: { gone: { p: { step: { v: 1 } } } } }; gate(T3, Q);
        if (Q.floor !== 1 || Q.town || Q.map.town || M().gv !== D.GEN_VERSION || Q.en.filter((e) => e.deadT >= 0).length !== 3 || Q.seen.some((v) => !v))
          out.push(`memo: a kept floor whose diff no longer fits is not built anew with its dead and its map (floor ${Q.floor}, ${Q.en.filter((e) => e.deadT >= 0).length} dead)`);
        const mp = M().mp; home(); M().mp = 'other'; gate(T3, Q);
        if (Q.floor !== 1 || M().mp !== mp || Q.en.filter((e) => e.deadT >= 0).length !== 3 || Q.seen.every((v) => v)) out.push('memo: a kept floor whose rebuild is laid otherwise is patched over it, or keeps its explored map');
        home(); const d0 = JSON.stringify(M().d), n0 = Q.log.fl.length; root.SIMX.captivePlace = () => { throw new Error('a step that fails'); };
        gate(T3, Q); root.SIMX.captivePlace = cp;
        if (Q.floor !== 0 || !Q.town || !Q.map.town || !Q.portal || Q.portal.f !== 1 || Q.log.fl.length !== n0 || JSON.stringify(M().d) !== d0 || T3.floorFails !== 1 || Q.hero !== hq)
          out.push(`memo: a floor step that fails leaves the run half moved (floor ${Q.floor}, town ${Q.town}, portal ${JSON.stringify(Q.portal)}, hero kept ${Q.hero === hq})`);
        gate(T3, Q); hq.bag[6] = { b: 'scroll', n: 2, id: Q.nextId++ }; hq.read = { t0: T3.t, i: 6 }; root.SIMX.offersOf = () => { throw new Error('a step that fails'); };
        for (let k = 0; k < 240 && hq.read; k++) step(T3, { keys: [] }); root.SIMX.offersOf = ofs;
        if (Q.floor !== 1 || Q.portal || !hq.bag[6] || hq.bag[6].n !== 2) out.push('memo: a scroll read for a way home that does not open is spent, or a portal is left');
        home(); Q.floor = 1; Q.town = 0; Q.portal = null; M().d = { p: { map: { p: { town: { v: Q.map.town } } } } };
        const U = spawn(1, JSON.parse(JSON.stringify(persist(T3)))); U.run = null; root.SIMX.loadSlot(U, U.slot); const Z = U.run;
        if (!Z || Z.floor !== 0 || !Z.town || !Z.portal || Z.portal.f !== 1) out.push('memo: a save with the floor\'s number over the town\'s map does not load in the town with its portal');
        else { gate(U, Z); if (Z.floor !== 1 || Z.town || Z.map.town || Z.portal) out.push('memo: the mended save\'s portal does not lead back to the floor'); } }
      catch (e) { out.push('memo: the kept floors\' checks fail: ' + e.message); }
      finally { console.error = err; root.SIMX.captivePlace = cp; root.SIMX.offersOf = ofs; } }
    // TASKS 383: a chapter boss falls and leaves the town's portal in its hall, clear of the stairs; it takes the hero home, the
    // town's portal brings him back beside it, and the stairs lead on
    for (const f of [2, 4, 6, 8]) { const T2 = spawn(0, {}); T2.run = newRun(T2, 'campaign', 31 + f, { town: 1, allFree: 1 }); T2.screen = 'play'; const Q = T2.run, hq = Q.hero; enterFloor(T2, Q, f);
      const b = Q.en.find((e) => D.BOSSES[e.type]); if (!b) { out.push(`gate f${f}: no boss`); continue; }
      Q.arena = { active: 1, room: b.room, t0: T2.t }; b.hp = 0; killEnemy(T2, Q, b); Q.en = Q.en.filter((e) => e === b); for (let i = 0; i < 200 && (Q.freeze > 0 || Q.inbuf); i++) step(T2, { keys: [] }); const g = Q.arena && Q.arena.gate;
      if (!g) { out.push(`gate f${f}: no portal home after the boss`); continue; }
      // (TASKS 1037) the ring's gap opens on floor a body can walk from the disc out past the stones
      for (let d = 0; d <= 2.6 * TILE; d += 8) if (boxHit(Q.map, g.x + Math.cos(g.open) * d, g.y + Math.sin(g.open) * d, K.R, false, false)) { out.push(`gate f${f}: the ring's gap is walled at ${d} px`); break; }
      if (Math.hypot(g.x - Q.map.exit.x, g.y - Q.map.exit.y) < 100) out.push(`gate f${f}: the portal stands by the stairs`);
      hq.x = g.x; hq.y = g.y + 30; E(T2); if (Q.floor !== 0 || !Q.portal || Q.portal.f !== f) { out.push(`gate f${f}: the portal does not take the hero home`); continue; }
      hq.x = Q.map.town.svc.portal.x; hq.y = Q.map.town.svc.portal.y + 30; E(T2);
      if (Q.floor !== f || Math.hypot(hq.x - g.x, hq.y - g.y) > 90 || !Q.arena || !Q.arena.gate) { out.push(`gate f${f}: the town's portal does not lead back beside the boss's`); continue; }
      hq.x = Q.map.exit.x; hq.y = Q.map.exit.y; E(T2); if (Q.leaving > 0) { Q.leaving = 0; SIMX.enterFloor(T2, Q, Q.floor + 1); } if (Q.floor !== f + 1) out.push(`gate f${f}: the stairs do not lead on after the portal`); }
    // past the colossus (TASKS 514): its hall keeps the town's portal and one stairs down; down them, back up from the descent's
    // 17th, the 16th is the campaign's again (PR 19 review: the descent's bag has no round before its first floor), the hero by the
    // stairs on, still one way down (its portal out no second stairs) and the portal home, and the stairs on take him to the 17th
    // with no second win
    try { const F = D.RUNS.campaign.floors, S2 = spawn(0, {}); S2.run = newRun(S2, 'campaign', 1, { town: 1, allFree: 1 }); S2.screen = 'play'; const R2 = S2.run, h2 = R2.hero; enterFloor(S2, R2, F);
      const b = R2.en.find((e) => e.type === 'boss_colossus'); R2.arena = { active: 1, room: b.room, t0: S2.t }; b.hp = 0; killEnemy(S2, R2, b); R2.en = R2.en.filter((e) => e === b);
      // (TASKS 515: no way out to the surface there, before the colossus falls or after: the run ends in the town)
      if (exitKind(R2) !== null) out.push('climb: the campaign\'s last floor of a run through the town has a way out'); else { h2.x = R2.map.exit.x; h2.y = R2.map.exit.y; E(S2); if (!S2.run || R2.floor !== F) out.push('climb: E at the last floor\'s old way out ends the run or leaves the floor'); }
      if (!R2.arena || !R2.arena.gate) out.push('climb: the colossus leaves no portal home');
      else if (R2.map.down && Math.hypot(R2.arena.gate.x - R2.map.down.x, R2.arena.gate.y - R2.map.down.y) < 100) out.push('climb: the colossus\'s portal home stands by the stairs on');
      // (PR 29 review) a run saved with the colossus slain before it left a portal, its body cleared away: the portal is set on load
      // and when the floor is entered again
      { const keep = R2.arena.gate, en = R2.en; delete R2.arena.gate; R2.en = []; const T3 = spawn(1, JSON.parse(JSON.stringify(persist(S2))));
        if (!T3.saved || !T3.saved.arena || !T3.saved.arena.gate) out.push('climb: a save with the colossus slain and no portal home gets none on load');
        delete R2.arena.gate; enterFloor(S2, R2, F - 1, undefined, 'up'); enterFloor(S2, R2, F); if (!R2.arena || !R2.arena.gate) out.push('climb: the colossus\'s floor kept with no portal home gets none when entered again');
        delete R2.arena.gate; enterFloor(S2, R2, 0); enterFloor(S2, R2, F); if (!R2.arena || !R2.arena.gate) out.push('climb: the colossus\'s floor kept with no portal home gets none when entered from the town');
        void keep; void en; }
      // (review of PR 69: a way down that does not open counts no win and keeps the campaign, and the next try counts it; on a copy)
      { const T4 = spawn(1, JSON.parse(JSON.stringify(persist(S2)))), Q = T4.saved; T4.run = Q; T4.saved = null; T4.screen = 'play'; const w = T4.meta.wins || 0, sh = T4.meta.shards;
        const cp = root.SIMX.captivePlace, err = console.error; root.SIMX.captivePlace = () => { throw new Error('a step that fails'); }; console.error = () => {};
        try { descend(T4, Q); } finally { root.SIMX.captivePlace = cp; console.error = err; }
        if (Q.floor !== F || Q.campaignWon || Q.mode !== 'campaign' || (T4.meta.wins || 0) !== w || T4.meta.shards !== sh) out.push('climb: a way down past the colossus that does not open counts the win or leaves the campaign');
        descend(T4, Q); if (T4.meta.wins !== w + 1 || Q.floor !== F + 1 || !Q.campaignWon) out.push('climb: the win is not counted on the try after a way down that did not open'); }
      descend(S2, R2); const w0 = S2.meta.wins, s0 = S2.meta.shards;
      if (R2.floor !== F + 1 || R2.mode !== 'endless') out.push(`climb: the descent past the colossus does not start on the ${F + 1}th`);
      else { h2.x = R2.map.up.x; h2.y = R2.map.up.y + 30; E(S2); for (let i = 0; i < 60; i++) step(S2, { keys: [] }); const m2 = R2.map;
        if (R2.floor !== F || STAGE(R2).boss !== 'boss_colossus' || D.placeName(F, R2.mode, R2.seed, FROM(R2)) !== D.placeName(F, 'campaign', R2.seed)) out.push(`climb: back up from the ${F + 1}th, the ${F}th is not the campaign's`);
        else if (!m2.down || exitKind(R2) === 'stairs' || !R2.arena || !R2.arena.gate) out.push(`climb: back up on the ${F}th, not one stairs down and the portal home`);
        else { if (Math.hypot(h2.x - m2.down.x, h2.y - m2.down.y) > 80) out.push(`climb: back up on the ${F}th, the hero is not by the stairs on`);
          h2.x = R2.arena.gate.x; h2.y = R2.arena.gate.y + 30; E(S2); if (R2.floor !== 0) out.push(`climb: the ${F}th's portal home does not take the hero home after the descent`);
          else { h2.x = R2.map.town.svc.portal.x; h2.y = R2.map.town.svc.portal.y + 30; E(S2); if (R2.floor !== F) out.push(`climb: the town's portal does not lead back to the ${F}th`); }
          h2.x = m2.down.x; h2.y = m2.down.y + 20; E(S2); if (R2.floor !== F + 1 || S2.meta.wins !== w0 || S2.meta.shards !== s0) out.push(`climb: the ${F}th's stairs on, taken again, do not lead to the ${F + 1}th or win the campaign twice`); } } }
    catch (err) { out.push('climb: back up from the descent fails: ' + err.stack); }
    return out;
  }

  // TASKS 1882: the page's away flag (a lost window, a hidden tab) pauses a run as Esc does, and leaves other screens and the demo alone
  function awayCheck() {
    const out = [], play = () => { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 5); S.screen = 'play'; S.t = S.run.t = 10; return S; };
    { const S = play(); step(S, { keys: [], away: 1 }); if (S.screen !== 'pause' || S.pauseAsk) out.push(`away: a run in play goes to ${S.screen}, not the pause`); }
    { const S = play(); step(S, { keys: [], away: 1 }); for (let i = 0; i < 60; i++) step(S, { keys: [] }); if (S.screen !== 'pause') out.push('away: the pause does not hold after the flag'); }
    { const S = play(); S.screen = 'inv'; step(S, { keys: [], away: 1 }); if (S.screen !== 'inv') out.push(`away: the hero's page turns into ${S.screen}`); }
    { const S = spawn(0, {}); step(S, { keys: [], away: 1 }); if (S.screen !== 'menu') out.push(`away: the menu turns into ${S.screen}`); }
    { const S = play(); S.demo = 1; step(S, { keys: [], away: 1 }); if (S.screen !== 'play') out.push('away: the attract demo pauses'); }
    return out;
  }
  SIMX.checks.add('awayCheck', awayCheck);
  SIMX.checks.add('climbCheck', climbCheck, { slow: true });
})(typeof window !== 'undefined' ? window : globalThis);
