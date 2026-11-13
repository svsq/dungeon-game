// live/sim_checks_events.js — selfCheck's part for the event rooms (TASKS 361, 1817). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, DG, TILE, enterFloor, newRun, spawn, step } = SIMX;
  const MODES = [['campaign', {}], ['campaign', { town: 1 }], ['cave', {}], ['magma', {}]];
  // the probe asked for on every floor of each run: marked in the same layout as the floor without it, the same each time, in a
  // plain fight's room off the walk to the stairs, its spot open and its room cleared; a prop on its spot cuts no way to the stairs
  // a floor as laid with no event of the pool drawn: the drawn ones would take the probe's rooms and clear their packs
  const bare = (f) => { const P = D.EVENTS.pool, w = Object.fromEntries(Object.entries(P).map(([k, E]) => [k, E.w])); for (const E of Object.values(P)) E.w = 0;
    try { return f(); } finally { for (const [k, v] of Object.entries(w)) P[k].w = v; } };
  function checkEventGen(out) {
    let floors = 0, marked = 0;
    for (const [mode, o] of MODES) for (let sd = 1; sd <= 6; sd++) for (let f = 1; f <= Math.min(5, D.RUNS[mode].floors); f++) {
      const seed = (sd * 31 + f * 1013) >>> 0, op = Object.assign({ mode, runSeed: sd }, o), tag = `events ${mode}${o.town ? ' (town)' : ''} ${sd}/${f}`;
      const plain = bare(() => DG.genFloor(seed, f, op)), m = bare(() => DG.genFloor(seed, f, Object.assign({ events: ['probe'] }, op))), again = sd <= 2 ? bare(() => DG.genFloor(seed, f, Object.assign({ events: ['probe'] }, op))) : m;
      if (plain.events || plain.rooms.some((r) => r.event)) out.push(`${tag}: an event on a floor whose pool draws none`);
      if (JSON.stringify(m) !== JSON.stringify(again)) out.push(`${tag}: the same seed marks its events otherwise`);
      const evR = new Set((m.events || []).map((e) => e.room)), strip = (q) => JSON.stringify(Object.assign({}, q, { rooms: q.rooms.map((r) => { const c = Object.assign({}, r); delete c.event; return c; }), enemies: q.enemies.filter((e) => !evR.has(e.room)), webs: q.webs.filter((w) => !evR.has(DG.roomAt(q, w.x, w.y))), events: undefined }));
      if (strip(m) !== strip(plain)) out.push(`${tag}: marking an event moved something else on the floor`);
      floors++; if (!m.events) continue; marked++;
      const W = m.W, s = m.rooms[m.start], way = DG.wayRooms(m.cells, W, m.H, m.rooms, s.cy * W + s.cx, m.exit.ty * W + m.exit.tx), sp = DG.specials(m);
      if (new Set(sp.map((q) => q.room)).size !== sp.length) out.push(`${tag}: a room with two special roles ${JSON.stringify(sp)}`);
      if (evR.size !== m.events.length) out.push(`${tag}: two events in one room`);
      for (const E of m.events) { const r = m.rooms[E.room], P = D.EVENTS.pool[E.id], tx = Math.floor(E.x / TILE), ty = Math.floor(E.y / TILE);
        if (r.event !== E.id || r.type !== 'combat' || r.hall || r.locked || r.pocket || r.isle) out.push(`${tag}: the ${E.id} event in a ${r.type}${r.hall ? ' hall' : ''}${r.locked ? ' locked' : ''} room`);
        if (way.has(r.id)) out.push(`${tag}: the ${E.id} event on the walk to the stairs`);
        if (!DG.inRm(r, tx, ty) || m.cells[ty * W + tx] !== 1 || m.block.includes(ty * W + tx)) out.push(`${tag}: the ${E.id} event's spot is off its room's open floor`);
        if (P.room === 'treasure' && (m.enemies.some((e) => e.room === r.id) || m.webs.some((w) => DG.roomAt(m, w.x, w.y) === r.id))) out.push(`${tag}: the ${E.id} event's treasure room keeps its pack or its webs`);
        const shut = new Set(m.block); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) shut.add((ty + j) * W + tx + i);
        const seen = new Uint8Array(W * m.H), go = [Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE)]; seen[go[0]] = 1;
        while (go.length) { const k = go.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && (m.cells[n] === 1 || m.cells[n] === 5) && !shut.has(n)) { seen[n] = 1; go.push(n); } } }
        if (!seen[m.exit.ty * W + m.exit.tx] && !seen[(m.exit.ty + 1) * W + m.exit.tx]) out.push(`${tag}: a prop on the ${E.id} event's spot cuts the way to the stairs`); } }
    // (0.7 since TASKS 362: a room with an elite is no treasure event's, as the elite is the room's reward)
    if (marked < floors * 0.7) out.push(`events: only ${marked} of ${floors} floors find a room for the probe`);
    checkTrialGen(out);
    // (TASKS 363, 364) every event the pool draws comes on its own on some floor of each run it is for
    { const seen = {}; for (const [mode, o] of MODES) for (let sd = 1; sd <= 6; sd++) for (let f = 1; f <= Math.min(5, D.RUNS[mode].floors); f++)
        for (const E of DG.genFloor((sd * 31 + f * 1013) >>> 0, f, Object.assign({ mode, runSeed: sd }, o)).events || []) seen[E.id + ' ' + mode] = 1;
      for (const [id, P] of Object.entries(D.EVENTS.pool)) if (P.w > 0) for (const [mode] of MODES) if ((!P.modes || P.modes.includes(mode)) && !seen[id + ' ' + mode]) out.push(`events: the pool never draws ${id} in the ${mode} run`); }
    for (const sd of [1, 2, 3]) for (let f = 1; f <= 4; f++) { const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'magma', runSeed: sd }), sp = DG.specials(m);
      if (m.rooms.some((r) => r.hall && !sp.some((q) => q.src === 'hall' && q.room === r.id && q.id === r.hall))) out.push(`events: magma ${sd}/${f}: a hall missing from the floor's special rooms`);
      if (m.rooms.some((r) => r.type === 'shrine' && !sp.some((q) => q.src === 'altar' && q.room === r.id))) out.push(`events: magma ${sd}/${f}: the altar missing from the floor's special rooms`); }
  }
  // the skull door (TASKS 362) asked for on every floor of each run: its grates stand on open floor just past its room's box, and
  // with them down nothing walks from its spot out of the box; the pool draws it on its own on some floors of every run
  function checkTrialGen(out) {
    let floors = 0, got = 0; const drawn = {};
    for (const [mode, o] of MODES) for (let sd = 1; sd <= 6; sd++) for (let f = 1; f <= Math.min(5, D.RUNS[mode].floors); f++) {
      const seed = (sd * 31 + f * 1013) >>> 0, op = Object.assign({ mode, runSeed: sd }, o), tag = `trial ${mode}${o.town ? ' (town)' : ''} ${sd}/${f}`;
      if ((DG.genFloor(seed, f, op).events || []).some((E) => E.id === 'trial')) drawn[mode] = 1;
      const m = DG.genFloor(seed, f, Object.assign({ events: ['trial'] }, op)), E = (m.events || []).find((q) => q.id === 'trial'); floors++; if (!E) continue; got++;
      const W = m.W, r = m.rooms[E.room], inBox = (x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h, shut = new Set();
      if (!E.gates || !E.gates.length) { out.push(`${tag}: no grates`); continue; }
      for (const g of E.gates) for (const [x, y] of g.cells) { shut.add(y * W + x); if (inBox(x, y) || m.cells[y * W + x] !== 1) out.push(`${tag}: a grate cell ${x},${y} in its room or off open floor`); }
      const k0 = Math.floor(E.y / TILE) * W + Math.floor(E.x / TILE), seen = new Uint8Array(W * m.H), go = [k0]; seen[k0] = 1; let out1 = 0;
      while (go.length) { const k = go.pop(); if (!inBox(k % W, Math.floor(k / W))) { out1 = 1; break; }
        for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && m.cells[n] === 1 && !shut.has(n)) { seen[n] = 1; go.push(n); } } }
      if (out1) out.push(`${tag}: a way out of the trial's room past its grates`); }
    if (got < floors * 0.5) out.push(`trial: only ${got} of ${floors} floors find a room for the skull door`);
    for (const [mode] of MODES) if (!drawn[mode]) out.push(`trial: the pool never draws the skull door in the ${mode} run`);
  }
  // the probe in play: E at its spot asks, «Нет» leaves it as it was, «Да» ends it with `qevent` of its room, once; the floor left
  // and come back to, and the run saved and loaded, keep it done
  function checkEventPlay(out) {
    const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero;
    enterFloor(S, R, 1, { events: ['probe'] }); R.en = []; const E = (R.events || [])[0];
    if (!E || E.id !== 'probe' || E.st !== 'idle') { out.push('event play: the probe asked for is not on the floor'); return; }
    const key = (k) => { R.enteredT = -9; step(S, { keys: [k] }); step(S, { keys: [] }); };
    h.x = E.x; h.y = E.y; key('KeyE');
    if (S.screen !== 'event' || S.focus !== 'evNo') { out.push(`event play: E at the probe opens ${S.screen} with ${S.focus} in focus, not its question with no`); return; }
    key('Enter'); if (S.screen !== 'play' || E.st !== 'idle') out.push('event play: no does not leave the event as it was');
    key('KeyE'); key('ArrowLeft'); S.ev.length = 0; key('Enter');
    const q = S.ev.filter((e) => e.k === 'qevent' && e.room === E.room && e.event === 'probe');
    if (E.st !== 'done' || q.length !== 1 || S.screen !== 'play') out.push(`event play: yes leaves the probe ${E.st} with ${q.length} qevent of its room`);
    key('KeyE'); if (S.screen === 'event') out.push('event play: a done event asks again');
    enterFloor(S, R, 2); enterFloor(S, R, 1, undefined, 'up');
    const back = (R.events || []).find((o) => o.room === E.room);
    if (!back || back.st !== 'done') out.push('event play: the floor come back to forgets its event was done');
    const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))), b2 = T.saved && (T.saved.events || []).find((o) => o.room === E.room);
    if (!b2 || b2.st !== 'done') out.push('event play: a saved run forgets its event was done');
  }
  // the skull door in play in each run: «yes» drops its grates, three waves of the floor's roster rise in its room one after
  // another, the third one down lifts them and leaves one chest of a cache's tier and one `qevent`; a save mid-fight keeps the
  // fight, the floor left mid-fight is found as it was before «yes», a hero out of the room ends it, a dead one calls no wave
  function checkTrialPlay(out) {
    const P = D.EVENTS.pool.trial;
    for (const [mode, o] of MODES) { const tag = `trial play ${mode}${o.town ? ' (town)' : ''}`;
      const S = spawn(0, {}); S.run = newRun(S, mode, 77, Object.assign({ allFree: 1 }, o)); S.screen = 'play'; const R = S.run, h = R.hero;
      const begin = () => { R.en = []; const E = (R.events || []).find((q) => q.id === 'trial'); if (!E) return null; h.x = E.x; h.y = E.y + 10; h.hp = 1e6; R.enteredT = -9;
        step(S, { keys: ['KeyE'] }); step(S, { keys: [] }); step(S, { keys: ['ArrowLeft'] }); step(S, { keys: [] }); S.ev.length = 0; step(S, { keys: ['Enter'] }); step(S, { keys: [] }); return E; };
      let f = 0, E = null; for (f = 1; f <= Math.min(4, D.RUNS[mode].floors) && !E; f++) { enterFloor(S, R, f, { events: ['trial'] }); E = begin(); }
      if (!E) { out.push(`${tag}: no floor of 1–4 lays the skull door asked for`); continue; } f--;
      const m = R.map, shut = (v) => E.gates.every((g) => g.cells.every(([x, y]) => m.cells[y * m.W + x] === v));
      if (E.st !== 'on' || !shut(5)) { out.push(`${tag}: «yes» leaves it ${E.st}, grates ${shut(5) ? 'down' : 'up'}`); continue; }
      if (o.town) { const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))), b = T.saved && (T.saved.events || []).find((q) => q.room === E.room);
        if (!b || b.st !== 'on' || !b.gates.every((g) => g.cells.every(([x, y]) => T.saved.map.cells[y * T.saved.map.W + x] === 5))) out.push(`${tag}: a save mid-fight loses the fight or its grates`);
        enterFloor(S, R, f + 1); enterFloor(S, R, f, undefined, 'up'); const B = (R.events || []).find((q) => q.room === E.room), m2 = R.map;
        if (!B || B.st !== 'idle' || R.en.some((e) => e.summ === 'trial') || B.gates.some((g) => g.cells.some(([x, y]) => m2.cells[y * m2.W + x] !== 1))) { out.push(`${tag}: the floor left mid-fight keeps it ${B && B.st}`); continue; }
        E = begin(); if (!E || E.st !== 'on') { out.push(`${tag}: the skull door does not start again after the floor was left`); continue; } }
      const r = R.map.rooms[E.room], waves = [];
      for (let i = 0; i < 120 * 40 && E.st === 'on'; i++) { step(S, { keys: [] }); h.hp = 1e6; h.x = E.x; h.y = E.y + 10;
        const up = R.en.filter((e) => e.summ === 'trial' && e.deadT < 0); if (!up.length) continue;
        if (up.some((e) => e.room !== E.room || e.x < r.x * TILE || e.y < r.y * TILE || e.x >= (r.x + r.w) * TILE || e.y >= (r.y + r.h) * TILE)) out.push(`${tag}: a wave rises out of its room`);
        if (!waves.length || waves[waves.length - 1] !== E.wave) waves.push(E.wave); for (const e of up) { e.hp = 0; SIMX.killEnemy(S, R, e); } }
      const q = S.ev.filter((e) => e.k === 'qevent' && e.room === E.room), ch = R.chests.filter((c) => c.trial);
      if (E.st !== 'done' || waves.join() !== '0,1,2' || q.length !== 1) out.push(`${tag}: it ends ${E.st} after waves ${waves} with ${q.length} qevent`);
      if (!shut(1) || R.map.arenaBox) out.push(`${tag}: the grates stay down after the third wave`);
      if (ch.length !== 1 || ch[0].tier !== P.chest || ch[0].open) out.push(`${tag}: ${ch.length} reward chests of tier ${ch.map((c) => c.tier)}`); }
    // a hero out of the room ends it with the grates up and its wave gone; a dead one calls no wave
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero; let E = null;
      for (let f = 1; f <= 4 && !E; f++) { enterFloor(S, R, f, { events: ['trial'] }); R.en = []; E = (R.events || []).find((q) => q.id === 'trial'); }
      if (!E) { out.push('trial play: no skull door on floors 1–4 asked for it'); return; }
      // the lair quest (1021) takes the skull door's room on about half its draws, and the trial won counts it done
      const qs = Array.from({ length: 12 }, (_, i) => ({ id: 9000 + i, key: 'room', f: R.floor, need: 1, n: 0, st: 'taken', rw: {} })); R.quests = qs; SIMX.questPlace(S, R);
      const onIt = qs.filter((q) => q.room === E.room).length; if (onIt < 2 || onIt > 10) out.push(`trial play: the lair quest takes the skull door's room ${onIt} times of 12`);
      R.quests = qs.filter((q) => q.room === E.room).slice(0, 1);
      { const keep = JSON.stringify({ en: R.en, cells: R.map.cells, chests: R.chests }); SIMX.eventStart(S, R, E); h.x = E.x; h.y = E.y + 10;
        for (let i = 0; i < 120 * 40 && E.st === 'on'; i++) { step(S, { keys: [] }); h.hp = 1e6; h.x = E.x; h.y = E.y + 10; for (const e of R.en) if (e.summ === 'trial' && e.deadT < 0) { e.hp = 0; SIMX.killEnemy(S, R, e); } }
        if (R.quests[0] && R.quests[0].st !== 'done') out.push('trial play: the skull door won leaves the lair quest on its room undone');
        const back = JSON.parse(keep); R.en = back.en; R.map.cells = back.cells; R.chests = back.chests; E.st = 'idle'; R.quests = []; }
      SIMX.eventStart(S, R, E); for (let i = 0; i < 400; i++) step(S, { keys: [] });
      h.x = R.map.spawn.x; h.y = R.map.spawn.y; step(S, { keys: [] });
      if (E.st !== 'idle' || R.en.some((e) => e.summ === 'trial') || R.map.arenaBox) out.push(`trial play: the hero out of its room leaves it ${E.st}`);
      h.x = E.x; h.y = E.y + 10; SIMX.eventStart(S, R, E); h.hp = 0; h.deadT = S.t; const n = R.en.length; for (let i = 0; i < 150; i++) SIMX.stepEvents(S, R);
      if (R.en.length !== n) out.push('trial play: a wave rises for a dead hero'); }
  }
  // an event of the pool asked for on floors 1–4 of a run, the hero by it, its enemies gone; ask(S) answers its question «yes»
  function evRun(mode, o, id) { const S = spawn(0, {}); S.run = newRun(S, mode, 77, Object.assign({ allFree: 1 }, o)); S.screen = 'play'; const R = S.run; let E = null;
    for (let f = 1; f <= Math.min(4, D.RUNS[mode].floors) && !E; f++) { enterFloor(S, R, f, { events: [id] }); R.en = []; E = (R.events || []).find((q) => q.id === id); }
    if (E) { R.hero.x = E.x + 30; R.hero.y = E.y + 30; }
    const key = (k) => { R.enteredT = -9; step(S, { keys: [k] }); step(S, { keys: [] }); };
    return { S, R, E, key, ask: () => { key('KeyE'); key('ArrowLeft'); S.ev.length = 0; key('Enter'); } }; }
  // the blood altar (TASKS 363) in each run: «no» takes nothing; «yes» takes a quarter of the health he has (never the last point),
  // lays one epic or better of his class by the altar, and sends one `qevent`; it asks no more, the altar stands in the way, and a
  // save keeps it done
  function checkBloodPlay(out) {
    const P = D.EVENTS.pool.blood;
    for (const [mode, o] of MODES) { const tag = `blood altar ${mode}${o.town ? ' (town)' : ''}`, { S, R, E, key, ask } = evRun(mode, o, 'blood'), h = R && R.hero;
      if (!E) { out.push(`${tag}: no floor of 1–4 lays it asked for`); continue; }
      const st = SIMX.heroSt(S); h.hp = Math.round(st.maxHp * 0.8); const hp0 = h.hp, d0 = R.drops.length;
      key('KeyE'); key('Enter'); if (E.st !== 'idle' || Math.abs(h.hp - hp0) > 2) out.push(`${tag}: «no» leaves it ${E.st} and the hero at ${h.hp} of ${hp0}`);
      ask(); const got = R.drops.slice(d0).filter((p) => p.kind === 'item'), q = S.ev.filter((e) => e.k === 'qevent' && e.room === E.room && e.event === 'blood'), cls = D.clsOf(h).id;
      // (the health mends a little while the keys are pressed: the cut is judged by its wound against what he had as it fell)
      const cut = S.ev.filter((e) => e.k === 'hurt' && e.src === 'blood'), was = h.hp + (cut[0] ? cut[0].n : 0);
      if (cut.length !== 1 || Math.abs(cut[0].n - Math.round(was * P.cost)) > 1 || Math.abs(was - hp0) > 4) out.push(`${tag}: «yes» cuts ${cut.map((e) => e.n)} of about ${hp0}, not a quarter`);
      if (got.length !== 1 || got[0].item.rar < 3 || !D.wears(cls, got[0].item.b) || Math.hypot(got[0].x - E.x, got[0].y - E.y) > 120) out.push(`${tag}: «yes» lays ${got.map((p) => p.item.b + ' rarity ' + p.item.rar)} for a ${cls}, not one epic or better of his class by the altar`);
      if (E.st !== 'done' || q.length !== 1) out.push(`${tag}: it ends ${E.st} with ${q.length} qevent`);
      key('KeyE'); if (S.screen === 'event') out.push(`${tag}: the altar asks again`);
      if (!SIMX.solids(R).some((b) => b.x === E.x && b.y === E.y)) out.push(`${tag}: the altar does not stand in the way`);
      if (o.town) { const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))), b = T.saved && (T.saved.events || []).find((x) => x.room === E.room); if (!b || b.st !== 'done') out.push(`${tag}: a save forgets it was given its blood`); } }
    // the last point is never taken: at 1 health «yes» leaves 1, and at 3 it takes 1
    { const { S, R, E, ask } = evRun('campaign', {}, 'blood'); if (E) { R.hero.hp = 1; ask(); if (R.hero.hp !== 1 || R.hero.deadT >= 0) out.push(`blood altar: a hero at 1 health is left at ${R.hero.hp}`); } }
  }
  Object.assign(SIMX, { checkEventGen, checkEventPlay, checkTrialPlay, checkBloodPlay });
})(typeof window !== 'undefined' ? window : globalThis);
