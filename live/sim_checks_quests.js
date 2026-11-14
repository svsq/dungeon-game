// live/sim_checks_quests.js — selfCheck's parts for quests: offers, taking and turning in. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    boxHit, completionHints, counted, D, DG, ENEMIES, enterFloor, folkOf, journalOf, killEnemy, lootAudit, newQuest, newRun, offerOf, offersOf,
    openChest, openSecret, persist, questFloor, questMark, questMarks, spawn, STAGE, step, takeQuest, TILE, turnIn, UI, who } = SIMX;
  const scrolls = (h) => h.bag.reduce((n, it) => n + (it && it.b === 'scroll' ? it.n : 0), 0);
  // TASKS 1018–1022: a run's offers are 2–3, each from its own townsman, the same for the same seed; ! over the giver, his talk ends
  // on the quest's page and E takes it; the named foe (on its floor, never a boss's; an elite with its name; marked on the map; kept
  // on the floor left and come back to), the keepsake (in a chest, a cache or on the floor, reachable, never in the bag), the marked
  // room (another room cleared does not count) each do their quest; ? over the giver, the talk turns it in and pays; the Keeper's
  // chain goes boss by boss and skips a boss slain before
  function questGiveCheck() {
    const out = [], S = spawn(0, {}), run = (sd) => { S.run = newRun(S, 'campaign', sd, { town: 1, allFree: 1 }); S.screen = 'play'; return S.run; };
    const talkTo = (R, role) => { const f = folkOf(R).find((q) => q.role === role); for (const o of folkOf(R)) if (o !== f) o.x += 3000; R.hero.x = f.x + 44; R.hero.y = f.y + 12; for (let i = 0; i < 20; i++) step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); for (const o of folkOf(R)) if (o !== f) o.x -= 3000; return S.talk; };
    const finish = () => { for (let i = 0; i < 60 && S.screen === 'talk'; i++) { const T = S.talk, take = T.act && T.act.k === 'take' && T.p + 1 >= T.pages.length; step(S, { keys: [take ? 'Enter' : 'KeyE'] }); } };
    let R = run(41); const of = offersOf(R).map((o) => o.key + ':' + o.from).join();
    if (of !== offersOf(run(41)).map((o) => o.key + ':' + o.from).join()) out.push('quest give: the offers differ for the same seed');
    const seeds = [41, 42, 43, 44, 45, 46, 47, 48].map((sd) => offersOf(run(sd)));
    if (seeds.some((o) => o.length < 2 || o.length > 3 || new Set(o.map((q) => q.from)).size !== o.length || !['named', 'fetch', 'room'].includes(o[0].key))) out.push('quest give: a run has not 2–3 offers from as many townsmen, the first a goal on a floor');
    // each kind of goal on a run of its own: its offer moved to the guard, taken by talking to him
    const takeKind = (sd, key) => { const R2 = run(sd); R2.offers = [{ key, from: 'guard', q: 0 }]; R2.quests = [{ id: -1, key: 'chapter', f: 99, need: 1, n: 0, st: 'taken', from: 'keeper', rw: {} }];
      if (questMark(R2, 'guard') !== '!') out.push('quest give: no ! over the giver of ' + key);
      const T = talkTo(R2, 'guard'); if (!T || !T.act || T.act.k !== 'take') { out.push('quest give: the giver\'s talk has no quest of ' + key); return null; }
      for (let i = 0; i < 60 && S.screen === 'talk'; i++) step(S, { keys: ['KeyE'] }); if (R2.quests.some((o) => o.key === key)) out.push('quest give: E run through the pages takes ' + key);
      if (S.screen !== 'talk') out.push('quest give: E run through the pages drops the offer of ' + key); step(S, { keys: ['Escape'] });
      if (!talkTo(R2, 'guard')) { out.push('quest give: the talk does not reopen after Esc closed it'); return null; }
      finish(); const q = R2.quests.find((o) => o.key === key); if (!q || questMark(R2, 'guard') || S.screen !== 'play') { out.push('quest give: Enter on the quest\'s page does not take ' + key); return null; }
      if (q.f !== (D.QUESTS[key].from || 1) || (D.QUESTS[key].noBoss && STAGE(R2, q.f).boss)) out.push(`quest give: ${key} points at floor ${q.f}`); return q; };
    // the named foe
    { const q0 = takeKind(19, 'named'), R0 = S.run;
      if (q0) { for (let f = 1; f <= q0.f; f++) enterFloor(S, R0, f); const e0 = R0.en.find((o) => o.quest === q0.id), i0 = R0.en.indexOf(e0);
        if (e0 && i0 > 0) { const was = e0.was; if (!e0.mods || !e0.mods.length) out.push('quest abandon: the named foe on seed 19 has no elite mods to lose'); e0.hp = Math.round(e0.max / 2); R0.en.splice(0, 1); const maxOf = new Map(R0.en.filter((o) => o !== e0).map((o) => [o.id, o.max])); enterFloor(S, R0, 0, undefined, 'up'); SIMX.abandonQuest(S, R0, q0); enterFloor(S, R0, q0.f);
          const e1 = R0.en.find((o) => o.id === e0.id); if (!e1 || e1.quest !== undefined || e1.elite || e1.title || e1.mods !== undefined || e1.ward !== undefined || e1.max !== was.max || Math.abs(e1.hp - was.max / 2) > 2) out.push(`quest abandon: the named foe is not its plain self on a kept floor (${e1 ? e1.hp + '/' + e1.max + ', was ' + was.max : 'gone'})`);
          if (R0.en.some((o) => o !== e1 && maxOf.has(o.id) && o.max !== maxOf.get(o.id))) out.push('quest abandon: another foe took the named one\'s stats'); } else out.push('quest abandon: seed 19 has no named foe past the first in the list'); } }
    // TASKS 1984: the named foe's name is the elites' «{name} {epithet}» of its family (1326), drawn when offered and kept once placed
    const ofKin = (title, type) => { const G = D.ELITE_NAMES[D.ELITE_GROUP[type]]; return !!G && G.names.some((n) => G.adj.some((a) => title === n[0] + ' ' + a[n[1] === 'f' ? 1 : 0])); };
    for (const sd of [51, 52, 53, 54, 55, 56]) { const R1 = run(sd); R1.offers = [{ key: 'named', from: 'guard', q: 0 }]; const o = offerOf(R1, 'guard'), q1 = o && o.q;
      if (!q1 || !q1.foe || !SIMX.namedPool(R1, q1.f).includes(q1.foe) || !ofKin(q1.title, q1.foe)) out.push(`quest named: seed ${sd} offers a name off the elites' generator (${q1 && q1.title})`);
      else if (!SIMX.questLine(q1, R1).startsWith(q1.title + ' ')) out.push('quest named: the quest line does not show the name'); }
    // TASKS 1998: the name said in the quest line is the one the elite on the floor bears, on every seed and on a floor without the family
    { const X = SIMX, said = (q2) => SIMX.questLine(q2, S.run).slice(0, q2.title.length), fam = (t) => D.ELITE_GROUP[t];
      for (let sd = 51; sd <= 74; sd++) { const R1 = run(sd); R1.offers = [{ key: 'named', from: 'guard', q: 0 }]; const q1 = X.giveQuest(S, R1, 'guard'); if (!q1 || !q1.title) { out.push(`quest named 1998: seed ${sd} gives no named quest`); continue; }
        const t0 = q1.title, f0 = q1.foe; for (let f = 1; f <= q1.f; f++) enterFloor(S, R1, f); const e = R1.en.find((o) => o.quest === q1.id);
        if (!e || e.title !== t0 || q1.title !== t0 || said(q1) !== t0 || D.eliteName(e) !== t0 || fam(e.type) !== fam(f0)) out.push(`quest named 1998: seed ${sd}: «${t0}» (${f0}) said, ${e ? '«' + e.title + '» ' + e.type : 'nobody'} on the floor`); }
      const place = (sd) => { const R1 = run(sd); enterFloor(S, R1, 1); const on = new Set(R1.en.filter(X.plainFoe).map((o) => fam(o.type)));
        // a family named by hand, not by questPlace's own rule: a ghost walks the crypt, not the first floor
        const foe = 'ghost'; if (on.has(fam(foe))) { out.push(`quest named 1998: seed ${sd} has ghosts on its first floor, the off-roster case is not tried`); return; }
        const title = X.nickOf(foe, sd), q1 = { id: R1.nextId++, key: 'named', f: 1, need: 1, n: 0, st: 'taken', from: 'guard', rw: {}, title, foe };
        R1.quests = [q1]; X.questPlace(S, R1); const e = R1.en.find((o) => o.quest === q1.id);
        if (!e || e.title !== title || q1.title !== title || said(q1) !== title || fam(e.type) !== fam(foe)) out.push(`quest named 1998: seed ${sd}: «${title}» of ${fam(foe)} said, ${e ? '«' + e.title + '» ' + e.type : 'nobody'} placed`);
        else if ((e.hp !== e.max || !(e.max > 0) || !(e.dmg > 0))) out.push(`quest named 1998: seed ${sd}: the retyped foe has broken stats`);
        else if (boxHit(R1.map, e.x, e.y, ENEMIES[e.type].r, true, false) || e.hx !== e.x || e.hy !== e.y) out.push(`quest named 1998: seed ${sd}: the retyped ${e.type} stands in a wall or off its post`); };
      for (const sd of [51, 52, 53]) place(sd);
      // an old save's quest without its family: the townsman has said the name, and a floor built again must find the same family (review of PR 75)
      const oldSave = (q0) => { const R1 = run(51); enterFloor(S, R1, 1); const qr = new Set(X.questRooms(R1).map((r) => r.id)), was = new Map(R1.en.map((o) => [o.id, o.type]));
        const q1 = Object.assign({ id: R1.nextId++, key: 'named', f: 1, need: 1, n: 0, st: 'taken', from: 'guard', rw: {}, title: 'Свекровь Прозрачная' }, q0); R1.quests = [q1]; X.questPlace(S, R1);
        const e = R1.en.find((o) => o.quest === q1.id); if (!e || e.title !== q1.title || q1.title !== 'Свекровь Прозрачная' || was.get(e.id) !== e.type || e.type === 'salamander' || q1.foe !== e.type || !qr.has(e.room))
          out.push(`quest named 1998: an old save (${q0.foe || 'no family'}) names ${e ? (was.get(e.id) || '?') + '→' + e.type + ' «' + e.title + '» in room ' + e.room + ', recorded ' + q1.foe : 'nobody'}`); };
      oldSave({});
      // behind a secret wall or at the merchant's the quest would hide where the hero has no reason to look (review of PR 75)
      { const R1 = run(51); enterFloor(S, R1, 1); const m = R1.map, qr = new Set(X.questRooms(R1).map((r) => r.id)), off = m.rooms.find((r) => !qr.has(r.id)), o = R1.en.find((q2) => X.plainFoe(q2) && qr.has(q2.room));
        if (!off || !o) out.push('quest named 1998: seed 51 has no room off the fighting rooms or no plain foe to hide there');
        else { Object.assign(o, { type: 'goblin', room: off.id, x: (off.cx + 0.5) * TILE, y: (off.cy + 0.5) * TILE }); R1.en = R1.en.filter((q2) => q2 === o || !X.plainFoe(q2) || fam(q2.type) !== 'goblin');
          const q1 = { id: R1.nextId++, key: 'named', f: 1, need: 1, n: 0, st: 'taken', from: 'guard', rw: {}, foe: 'goblin', title: X.nickOf('goblin', 51) }; R1.quests = [q1]; X.questPlace(S, R1); const e = R1.en.find((q2) => q2.quest === q1.id);
          if (!e || e === o || !qr.has(e.room) || fam(e.type) !== 'goblin') out.push(`quest named 1998: a goblin quest names ${e === o ? 'the goblin in room ' + off.id + ' (' + off.type + '), off the fighting rooms' : e ? 'a ' + e.type + ' in room ' + e.room : 'nobody'}`); } } }
    // (review of PR 75) a plain foe retyped to a bigger family is moved to where its new body fits, not left grazing a wall
    { const X = SIMX, big = Object.keys(D.ELITE_GROUP).filter((t) => D.ELITE_NAMES[D.ELITE_GROUP[t]] && !D.BOSSES[t] && ENEMIES[t] && !ENEMIES[t].lurk && !ENEMIES[t].deep && !ENEMIES[t].lake).sort((a, b) => ENEMIES[b].r - ENEMIES[a].r)[0], rB = ENEMIES[big].r;
      let tried = 0; for (let sd = 1; sd <= 60 && !tried; sd++) { const R1 = run(sd); enterFloor(S, R1, 1); const rooms = new Set(X.questRooms(R1).map((r) => r.id));
        const e0 = R1.en.find((o) => X.plainFoe(o) && rooms.has(o.room) && D.ELITE_GROUP[o.type] !== D.ELITE_GROUP[big] && boxHit(R1.map, o.x, o.y, rB, true, false)); if (!e0) continue; tried = 1;
        R1.en = R1.en.filter((o) => o === e0 || !X.plainFoe(o)); const q1 = { id: R1.nextId++, key: 'named', f: 1, need: 1, n: 0, st: 'taken', from: 'guard', rw: {}, foe: big, title: X.nickOf(big, sd) };
        R1.quests = [q1]; X.questPlace(S, R1); const e = R1.en.find((o) => o.quest === q1.id);
        if (!e || e.type !== big || boxHit(R1.map, e.x, e.y, rB, true, false) || e.hx !== e.x || e.hy !== e.y) out.push(`quest named: seed ${sd}: a foe retyped to ${big} is left in a wall or off its post`); }
      if (!tried) out.push('quest named: no seed in 1–60 has a plain foe too cramped for a bigger family'); }
    // (review of PR 75) a retyped foe is seated in its own room, the one its quest points at: by hand, a foe in the right-hand column
    // of a narrow room with a shrine at its left side is shoved out to the right, and the nearest spot where a golem fits lies past the
    // room's edge; a foe boxed in all over its room within reach of the ring takes the room's nearest free cell
    { let cutErr = 0; const X = SIMX, T = TILE, cut = (sd) => { const R1 = run(sd); enterFloor(S, R1, 1); const rooms = new Set(X.questRooms(R1).map((r) => r.id)), m = R1.map,
          inMap = (o) => { const x = Math.floor(o.x / T), y = Math.floor(o.y / T); return x >= 10 && x + 6 < m.W && y >= 4 && y + 4 < m.H; },
          e0 = R1.en.find((o) => X.plainFoe(o) && rooms.has(o.room) && D.ELITE_GROUP[o.type] !== 'golem' && inMap(o));
        if (!e0) { if (!cutErr++) out.push(`quest named: seed ${sd} floor 1 has no plain foe in a quest room clear of the map's edge for the hand-made seat cases`); return null; }
        const tx = Math.floor(e0.x / T), ty = Math.floor(e0.y / T); for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 9; x <= tx + 6; x++) m.cells[y * m.W + x] = 1;
        R1.en = R1.en.filter((o) => o === e0 || !X.plainFoe(o)); R1.pots = []; R1.chests = []; R1.shrines = []; R1.captives = {}; m.torches = []; m.decor = []; e0.x = (tx + 0.5) * T; e0.y = (ty + 0.5) * T; return { R1, e0, m, tx, ty }; };
      const inRoom = (m, room, o) => DG.inRm(m.rooms[room], Math.floor(o.x / T), Math.floor(o.y / T));
      for (const c of [cut(51)].filter(Boolean)) { const { R1, e0, m, tx, ty } = c, room = e0.room, x0 = e0.x, y0 = e0.y; Object.assign(m.rooms[room], { x: tx - 3, y: ty - 2, w: 4, h: 5, wings: [] }); R1.shrines = [{ x: x0 - 14, y: y0 }];
        const q1 = { id: R1.nextId++, key: 'named', f: 1, need: 1, n: 0, st: 'taken', from: 'guard', rw: {}, foe: 'golem', title: X.nickOf('golem', 51) }; R1.quests = [q1]; X.questPlace(S, R1); const e = R1.en.find((o) => o.quest === q1.id);
        if (!e || e.type !== 'golem' || !inRoom(m, room, e) || boxHit(m, e.x, e.y, ENEMIES.golem.r, true, false) || Math.hypot(e.x - (x0 - 14), (e.y - y0) * 1.6) < 18 + ENEMIES.golem.r)
          out.push(`quest named: a foe retyped by a doorway leaves its room ${room} for (${e && Math.round(e.x - x0)}, ${e && Math.round(e.y - y0)}) px`); }
      for (const c of [cut(51)].filter(Boolean)) { const { R1, e0, m, tx, ty } = c, room = e0.room, x0 = e0.x, y0 = e0.y, r = ENEMIES.golem.r, sol = [{ x: x0, y: y0, r: 200 }]; Object.assign(m.rooms[room], { x: tx - 8, y: ty - 2, w: 9, h: 5, wings: [] });
        const e = { type: 'golem', x: x0, y: y0 }; SIMX.seatFoe(R1, e, sol, room);
        // measured from where the push left it, a prop dead on the post sent the foe to the far side of its room (review of PR 75)
        { const r1 = m.rooms[room], fit = (x, y) => !boxHit(m, x, y, r, true, false) && Math.hypot(x - x0, (y - y0) * 1.6) >= 200 + r, far = (x, y) => Math.hypot(x - x0, (y - y0) * 1.6); let best = Infinity;
          for (let y = r1.y; y < r1.y + r1.h; y++) for (let x = r1.x; x < r1.x + r1.w; x++) if (fit((x + 0.5) * T, (y + 0.5) * T)) best = Math.min(best, far((x + 0.5) * T, (y + 0.5) * T));
          if (far(e.x, e.y) > best + 1e-6) out.push(`quest named: a boxed-in foe takes a cell ${Math.round(far(e.x, e.y))} px from its post, the nearest free is ${Math.round(best)}`); }
        if (!inRoom(m, room, e) || boxHit(m, e.x, e.y, r, true, false) || Math.hypot(e.x - x0, (e.y - y0) * 1.6) < 200 + r) out.push(`quest named: a foe boxed in all over its room's ring is left at (${Math.round(e.x - x0)}, ${Math.round(e.y - y0)}) px`); }
      for (const c of [cut(51)].filter(Boolean)) { const { R1, e0, m, tx, ty } = c, room = e0.room, x0 = e0.x, y0 = e0.y; Object.assign(m.rooms[room], { x: tx - 2, y: ty - 1, w: 3, h: 3, wings: [] });
        const e = { type: 'golem', x: x0, y: y0 }; SIMX.seatFoe(R1, e, [{ x: x0, y: y0, r: 400 }], room); if (e.x !== x0 || e.y !== y0) out.push(`quest named: a foe with no free cell in its room is left off its post at (${Math.round(e.x - x0)}, ${Math.round(e.y - y0)}) px`); } }
    // (review of PR 75) a lava-tied family is never offered: no foe can be made one, and few stand where a quest names
    { const X = SIMX, T4 = spawn(0, {}), R4 = newRun(T4, 'magma', 1, { town: 1, allFree: 1 }); T4.run = R4; for (const f of [1, 2, 3]) if (X.namedPool(R4, f).some((t) => ENEMIES[t].tether)) out.push(`quest named: magma 1 f${f} offers a lava-tied family`);
      // a salamander in the first fighting room and one skeleton in the last: a salamander quest of an old save, and a spider quest
      // the floor has no spider for, leave the salamander as it is (made a walker, it was dragged out of its lava)
      enterFloor(T4, R4, 1); const qrs = X.questRooms(R4), plain = R4.en.filter((o) => X.plainFoe(o) && qrs.some((r) => r.id === o.room));
      if (qrs.length < 2 || plain.length < 2) out.push('quest named: magma 1 f1 has under two fighting rooms or plain foes for the lava-tied cases');
      else { const [a, b] = plain, at = (o, r, type) => Object.assign(o, { type, room: r.id, x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE }); at(a, qrs[0], 'salamander'); at(b, qrs[qrs.length - 1], 'skeleton');
        R4.en = R4.en.filter((o) => o === a || o === b || !X.plainFoe(o)); const en0 = structuredClone(R4.en);
        for (const q0 of [{ foe: 'salamander' }, { foe: 'spider' }]) { R4.en = structuredClone(en0); const sal = R4.en.find((o) => o.id === a.id), q1 = Object.assign({ id: R4.nextId++, key: 'named', f: 1, need: 1, n: 0, st: 'taken', from: 'guard', rw: {}, title: 'Свекровь Прозрачная' }, q0);
          R4.quests = [q1]; X.questPlace(T4, R4); const e = R4.en.find((o) => o.quest === q1.id), want = q0.foe === 'spider' ? 'spider' : 'skeleton';
          if (!e || e.id !== b.id || e.type !== want || e.title !== q1.title || q1.foe !== want || sal.type !== 'salamander' || sal.quest !== undefined)
            out.push(`quest named: magma 1 f1, a ${q0.foe} quest names ${e ? (e.id === a.id ? 'the salamander' : 'foe ' + e.id) + ' as ' + e.type + ', recorded ' + q1.foe : 'nobody'}; the salamander is now ${sal.type}`); } } }
    let q = takeKind(51, 'named'); R = S.run; const offered = q && q.title, offeredFoe = q && q.foe;
    if (q) { for (let f = 1; f <= q.f; f++) enterFloor(S, R, f); const e = R.en.find((o) => o.quest === q.id);
      const lost = e && (D.ELITE_GROUP[e.type] === D.ELITE_GROUP[offeredFoe] ? q.title !== offered : R.en.some((o) => SIMX.plainFoe(o) && D.ELITE_GROUP[o.type] === D.ELITE_GROUP[offeredFoe]));
      if (lost) out.push('quest named: the foe lost the offered name, or is not of the offered family though one stood on its floor');
      if (!e || !e.elite || D.BOSSES[e.type] || e.title !== q.title || D.eliteName(e) !== q.title || !ofKin(q.title, e.type) || D.ELITE_GROUP[q.foe] !== D.ELITE_GROUP[e.type]) out.push('quest named: no elite named by its family on its floor');
      else { if (!questMarks(R).some((o) => o.kind === 'named')) out.push('quest named: the foe is not on the map');
        const hp = e.max; enterFloor(S, R, 0, undefined, 'up'); enterFloor(S, R, q.f); const e2 = R.en.find((o) => o.quest === q.id);
        if (!e2 || e2.max !== hp || R.en.filter((o) => o.quest === q.id).length !== 1) out.push('quest named: the foe is not kept on its floor (or comes twice)');
        if (e2) killEnemy(S, R, e2); if (q.st !== 'done') out.push('quest named: its death does not do the quest');
        enterFloor(S, R, 0, undefined, 'portal'); if (questMark(R, 'guard') !== '?') out.push('quest named: no ? over the giver once done');
        const g0 = scrolls(R.hero), T = talkTo(R, 'guard'); if (!T || !T.act || T.act.k !== 'turn') out.push('quest named: the talk does not offer the turn-in');
        finish(); if (q.st !== 'turned' || scrolls(R.hero) !== g0 + q.rw.scroll || !q.rw.got || q.rw.rar < 3) out.push('quest named: the turn-in does not pay (scrolls of return, an epic piece)'); } }
    // the named foe never on a boss's floor
    R = run(52); R.deepest = 1; if (questFloor(R, 'named') !== 3 || questFloor(R, 'cull') !== 2) out.push('quest give: a goal on a floor points at a boss\'s floor, or a hunt skips one');
    // the keepsake: three seeds should between them put it in a chest or cache and on the floor
    const where = new Set();
    for (const sd of [61, 62, 63, 64, 65, 66]) { q = takeKind(sd, 'fetch'); R = S.run; if (!q) continue; enterFloor(S, R, 1); where.add(q.where);
      const A = lootAudit(Object.assign(R, { hero: Object.assign(R.hero, { x: R.map.spawn.x, y: R.map.spawn.y }) })), k = A.list.filter((o) => o.quest);
      if (k.length !== 1 || k[0].at === 'stuck') { out.push(`quest fetch: seed ${sd}: the keepsake is not on its floor once, or out of reach (${k.map((o) => o.at)})`); continue; }
      for (const sq of R.map.secrets || []) openSecret(S, R, sq, true); for (const c of R.chests) if (c.quest) openChest(S, R, c);
      const d = R.drops.find((o) => o.kind === 'qitem'); const bag0 = R.hero.bag.filter(Boolean).length; R.hero.x = d.x; R.hero.y = d.y; d.t0 = -9; d.fly = 0; d.vz = 0; d.z = 0;
      for (let i = 0; i < 60 && !d.got; i++) step(S, { keys: [] });
      if (q.st !== 'done' || R.hero.bag.filter(Boolean).length !== bag0 || R.drops.some((o) => o.kind === 'qitem')) out.push(`quest fetch: seed ${sd}: picking it up does not do the quest, or it lands in the bag`); }
    if (where.size < 2) out.push('quest fetch: the keepsake always lies in the same kind of place: ' + [...where]);
    // the marked room: another room cleared does not count, the marked one does; the completion hints leave it to the quest's mark
    q = takeKind(71, 'room'); R = S.run;
    if (q) { enterFloor(S, R, 1); if (q.room === undefined || !questMarks(R).some((o) => o.kind === 'room')) out.push('quest room: no room marked');
      else { const other = R.en.find((e) => e.deadT < 0 && counted(e) && e.room >= 0 && e.room !== q.room); if (other) for (const e of R.en.filter((o) => o.room === other.room && o.deadT < 0 && counted(o))) killEnemy(S, R, e);
        if (q.n) out.push('quest room: another room cleared counts');
        for (const e of R.en.filter((o) => o.room === q.room && o.deadT < 0 && counted(o)).slice(1)) killEnemy(S, R, e);
        R.stats[1].kills = Math.ceil(R.stats[1].foes * 0.9); if (completionHints(R).some((o) => DG.roomAt(R.map, o.x, o.y) === q.room)) out.push('quest room: the completion hints mark the quest\'s room again');
        for (const e of R.en.filter((o) => o.room === q.room && o.deadT < 0 && counted(o))) killEnemy(S, R, e); if (q.st !== 'done') out.push('quest room: clearing the marked room does not do it'); } }
    // the Keeper's chain: the spider's floor first; the necromancer's after it; a boss slain before it is offered is skipped
    { const Z = S.run = newRun(S, 'campaign', 82, { town: 1 }), X = root.SIMX, Y = Object.assign({}, Z); S.screen = 'play'; delete Y.captives;
      if (!X.shopShut(Z)) out.push('rescue: the town shop is open before the merchant is freed');
      if (X.shopShut(Y)) out.push('rescue: a saved run from before the cage has its shop shut');
      if (Z.folk.some((f) => f.role === 'smith' || f.role === 'enchanter')) out.push('rescue: the smith or the enchanter stands in town before being freed');
      for (const [who, f] of [['merchant', 1], ['smith', 3]]) { enterFloor(S, Z, f); const C = Z.captives[who];
        if (C.x === undefined) { out.push('rescue: no cage for the ' + who); continue; }
        if (Z.map.decor.some((d) => Math.abs(d.x - C.x) < 40 && d.y < C.y + 8 && d.y > C.y - 60)) out.push('rescue: the cage stands on a prop');
        Z.en = []; Z.hero.x = C.x; Z.hero.y = C.y + 60; for (let i = 0; i < 120; i++) step(S, { up: 1, px: 960, py: 540, keys: [] }); if (Z.hero.y < C.y - 14) out.push('rescue: the hero walks through the cage of the ' + who);
        Z.en = []; Z.hero.x = C.x + 40; Z.hero.y = C.y + 30; X.interact(S, Z); S.screen = 'play'; if (!Z.freed || !Z.freed[who]) out.push('rescue: E at the cage does not free the ' + who); }
      enterFloor(S, Z, 0); if (X.shopShut(Z)) out.push('rescue: the town shop is shut after the merchant is freed'); if (!Z.folk.some((f) => f.role === 'smith')) out.push('rescue: the freed smith is not in town'); if (Z.folk.some((f) => f.role === 'enchanter')) out.push('rescue: the enchanter is in town though still caged'); }
    { const Z = run(83), plain = () => Z.drops.filter((p) => p.kind === 'note' && p.sec === undefined && D.NOTES.byId[p.note].kind !== 'hint');
      for (const f of [1, 3, 5, 7, 9, 13]) { enterFloor(S, Z, f); const P = plain(); if (P.length < 3 || P.length > 5) out.push('notes: floor ' + f + ' has ' + P.length); for (const p of P) { const n = D.NOTES.byId[p.note]; if (n.kind === 'boss' && (f < n.floors[0] || f > n.floors[1])) out.push('notes: ' + n.id + ' off its floors on ' + f); } }
      if (new Set(Z.notesUsed).size !== Z.notesUsed.length) out.push('notes: one repeated in a run');
      const P9 = Z.drops.filter((p) => p.kind === 'note'); if (P9.some((p, i) => P9.some((o, j) => j > i && Math.hypot(p.x - o.x, p.y - o.y) < 40))) out.push('notes: two lie on top of each other'); }
    R = run(81); R.freed = { merchant: 1 }; R.offers = []; let T = talkTo(R, 'keeper'); const st0 = T && T.act && T.act.k === 'take' ? T.act : null; finish();
    const sq = R.quests.find((o) => D.QUESTS[o.key].kind === 'story');
    if (!st0 || !sq || sq.key !== 'chapter' || sq.f !== 2 || sq.from !== 'keeper') out.push('quest story: the Keeper does not open the chain with the second floor\'s boss');
    else { enterFloor(S, R, 1); enterFloor(S, R, 2); const b = R.en.find((e) => D.BOSSES[e.type]); if (b) killEnemy(S, R, b); if (sq.st !== 'done') out.push('quest story: the boss slain does not do the step');
      enterFloor(S, R, 0, undefined, 'portal'); if (questMark(R, 'keeper') !== '?') out.push('quest story: no ? over the Keeper'); const sh = S.meta.shards; talkTo(R, 'keeper');
      for (let i = 0; i < 12 && S.screen === 'talk' && sq.st !== 'turned'; i++) step(S, { keys: ['KeyE'] });
      if (sq.st !== 'turned' || S.meta.shards <= sh) out.push('quest story: the step is not turned in for shards');
      // the thanks, then the next step's offer in the same talk
      const nt = S.talk && S.talk.act; if (!nt || nt.k !== 'take' || !D.QUEST_SAY.keeper.thanks.some((v) => S.talk.pages[1].startsWith(v))) out.push('quest story: no thanks and next offer after the turn-in');
      step(S, { keys: ['Escape'] }); const nx = offerOf(R, 'keeper'); if (!nx || nx.q.key !== 'chapter' || nx.q.f !== 4) out.push('quest story: the next step is not the fourth floor\'s boss');
      R.slain.push(4); R.deepest = 4; const nx2 = offerOf(R, 'keeper'); if (!nx2 || nx2.q.f !== 6) out.push('quest story: a boss slain before is offered again'); }
    // TASKS 1850: a quest to turn in waits behind an ordinary line with its button; its words, the thanks and the reward come once pressed
    // a quest's turn-in waits behind its giver's words on that kind of quest (PR 55 review 2, TASKS 1985; tools/textcheck.cjs checks every kind)
    for (const role in D.QUEST_SAY) if (!D.FOLK[role] || !(D.QUEST_SAY[role].turnin || {}).kill) out.push(`quest turn-in: the ${role} gives quests but has no turn-in words`);
    // (PR 55 review 2) with the Keeper's news to tell, the news is the button's page and the reward is told once pressed
    for (const [role, key, news] of [['keeper', 'fetch'], ['smith', 'fetch'], ['porter', 'cull'], ['guard', 'named'], ['keeper', 'fetch', 1]]) { R = run(41); R.offers = []; R.quests = []; const q = takeQuest(S, R, newQuest(R, key, 2, role)); q.st = 'done'; q.n = q.need;
      const SAY = D.QUEST_SAY[role], W = [D.QUESTS[key].name, root.SIMX.rwLine(q.rw), D.QUESTS[key].thanks, ...SAY.done, ...SAY.thanks].filter(Boolean), said = () => S.talk.pages.some((p) => W.some((v) => p.includes(v)));
      const met = S.meta.keeperMet; if (news) { S.meta.keeperMet = 0; R.away = 5; R.townDeep = 3; }
      const T = talkTo(R, role); if (news) S.meta.keeperMet = met; if (!T || !T.act || T.act.k !== 'turn') { out.push('quest turn-in: the ' + role + '\'s talk does not offer it'); continue; }
      if (news && (T.pages[T.pages.length - 1] !== D.KEEPER.away[D.KEEPER.away.length - 1] || !T.pages.includes(D.KEEPER.first[0]))) out.push('quest turn-in: the Keeper\'s news is not what the button\'s page tells');
      for (let i = 0; i < 8 && S.screen === 'talk' && q.st !== 'turned'; i++) { if (said()) { out.push('quest turn-in: the ' + role + ' says it before the button'); break; } step(S, { keys: ['KeyE'] }); }
      if (q.st !== 'turned' || S.screen !== 'talk' || !said()) out.push('quest turn-in: the ' + role + ' does not say it once pressed');
      else if (!S.talk.pages.some((p) => p.includes(root.SIMX.rwLine(q.rw)))) out.push('quest turn-in: the ' + role + ' gives no reward once pressed' + (news ? ' (with news)' : '')); step(S, { keys: ['Escape'] }); }
    // TASKS 1026: a boss slain deals a batch of offers more, to townsmen with none waiting; T reads the scroll on a floor
    R = run(93); const o0 = offersOf(R).length; R.bossN = 1; const o1 = offersOf(R); if (o1.length <= o0 || o1.slice(o0).some((o) => o1.slice(0, o0).some((p) => p.from === o.from && !p.q))) out.push('quest give: no fresh batch of offers after a boss');
    enterFloor(S, R, 1); S.screen = 'play'; R.en = []; step(S, { keys: [] }); step(S, { keys: ['KeyT'] }); if (!R.hero.read) out.push('scroll: T does not read the scroll of return');
    // the journal (TASKS 1023): J opens it over play, lists the run's quests done first, a click picks one, J closes it
    R = run(91); R.quests = []; const a = takeQuest(S, R, newQuest(R, 'cull', 2, 'smith')), b2 = takeQuest(S, R, newQuest(R, 'descent', 3, 'porter')); b2.st = 'done';
    S.screen = 'play'; step(S, { keys: [] }); step(S, { keys: ['KeyJ'] }); if (S.screen !== 'journal') out.push('journal: J does not open it');
    else { const L0 = journalOf(R), r1 = UI.journal(L0.length).r[1]; if (L0[0] !== b2 || L0[1] !== a) out.push('journal: a done quest is not listed first');
      step(S, { keys: [], click: 1, px: r1.x + 10, py: r1.y + 10 }); if (S.jsel !== a.id) out.push('journal: a click does not pick a quest');
      step(S, { keys: ['KeyJ'] }); if (S.screen !== 'play') out.push('journal: J does not close it'); }
    return out;
  }
  function questCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 91, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero;
    const cull = takeQuest(S, R, newQuest(R, 'cull', 2, 'smith')), eli = takeQuest(S, R, newQuest(R, 'elites', 1, 'guard')), sw = takeQuest(S, R, newQuest(R, 'sweep', 1, 'keeper')), dsc = takeQuest(S, R, newQuest(R, 'descent', 3, 'keeper'));
    enterFloor(S, R, 1); const foe = (o = {}) => { const e = R.en.find((q) => q.deadT < 0 && !D.BOSSES[q.type] && counted(q) && (o.elite === undefined || !!q.elite === o.elite)); if (e) killEnemy(S, R, e); return e; };
    foe(); if (cull.n) out.push('quest: a kill above the quest\'s floor counts');
    enterFloor(S, R, 2); const n0 = eli.n; foe({ elite: false }); if (cull.n !== 1 || eli.n !== n0) out.push(`quest: a kill counts wrong (cull ${cull.n}, elite hunt ${eli.n - n0})`);
    for (let i = 0; i < 40 && cull.st === 'taken'; i++) if (!foe()) break; if (cull.st !== 'done' || cull.n !== cull.need) out.push(`quest: the cull is not done at its need (${cull.n}/${cull.need})`);
    sw.n = 0; sw.st = 'taken'; const r0 = R.en.find((q) => q.deadT < 0 && counted(q) && q.room >= 0), s0 = sw.n; if (r0) for (const e of R.en.filter((q) => q.room === r0.room && q.deadT < 0 && counted(q))) killEnemy(S, R, e);
    if (r0 && sw.n !== s0 + 1) out.push('quest: a room cleared to the last foe does not count');
    enterFloor(S, R, 3); if (dsc.st !== 'done') out.push('quest: reaching the floor does not complete the descent');
    const g0 = scrolls(h); if (turnIn(S, R, cull)) out.push('quest: turned in outside the town');
    // TASKS 1033: scrolls of return in place of gold, and the experience of the hero's level at the turn-in
    enterFloor(S, R, 0, undefined, 'up'); const x0 = h.xp, l0 = h.lvl, sh0 = S.meta.shards; if (!turnIn(S, R, cull) || !cull.rw.scroll || scrolls(h) !== g0 + cull.rw.scroll || (h.xp === x0 && h.lvl === l0)) out.push('quest: the turn-in does not pay its scrolls and XP');
    if (cull.rw.xp !== D.questReward(['xp'], cull.f, l0).xp) out.push(`quest: the turn-in's XP is not of the hero's level (${cull.rw.xp})`);
    if (turnIn(S, R, cull) || scrolls(h) !== g0 + cull.rw.scroll) out.push('quest: a quest is turned in twice');
    if (!turnIn(S, R, dsc) || S.meta.shards !== sh0 + dsc.rw.shards) out.push('quest: the turn-in does not pay its shards');
    // PR 23 review: with no stack left to join, the reward's scrolls are a whole bag item (its rarity read by the bag's frame)
    h.bag = h.bag.map((b) => (b && b.b === 'scroll' ? null : b)); cull.st = 'done'; turnIn(S, R, cull);
    { const sc = h.bag.find((b) => b && b.b === 'scroll'); if (!sc || !D.RARITY[sc.rar] || !sc.id || !sc.mods) out.push('quest: the reward\'s scrolls in an empty bag are not a whole item'); }
    enterFloor(S, R, 4); eli.n = eli.need - 1; const el = R.en.find((q) => q.deadT < 0 && !D.BOSSES[q.type] && counted(q)); if (el) { el.elite = 1; killEnemy(S, R, el); }
    const bag0 = h.bag.filter(Boolean).length; if (eli.st === 'done') { enterFloor(S, R, 0, undefined, 'up'); turnIn(S, R, eli); if (h.bag.filter(Boolean).length !== bag0 + 1 || !eli.rw.got) out.push('quest: the reward item does not reach the bag'); } else out.push('quest: no elite to hunt');
    const P = JSON.parse(JSON.stringify(persist(S))); if (!P.run.quests || P.run.quests.length !== 4 || JSON.stringify(P.run.quests).length > 2000) out.push('quest: the quests do not travel in the save, or bloat it');
    return out;
  }
  SIMX.checks.add('questCheck', questCheck);
  SIMX.checks.add('questGiveCheck', questGiveCheck);
})(typeof window !== 'undefined' ? window : globalThis);
