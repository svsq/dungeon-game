// live/sim_checks_events.js — selfCheck's part for the event rooms (TASKS 361, 1817). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, DG, TILE, enterFloor, newRun, spawn, step } = SIMX;
  const MODES = [['campaign', {}], ['campaign', { town: 1 }], ['cave', {}], ['magma', {}]];
  // the probe asked for on every floor of each run: marked in the same layout as the floor without it, the same each time, in a
  // plain fight's room off the walk to the stairs, its spot open and its room cleared; a prop on its spot cuts no way to the stairs
  function checkEventGen(out) {
    let floors = 0, marked = 0;
    for (const [mode, o] of MODES) for (let sd = 1; sd <= 6; sd++) for (let f = 1; f <= Math.min(5, D.RUNS[mode].floors); f++) {
      const seed = (sd * 31 + f * 1013) >>> 0, op = Object.assign({ mode, runSeed: sd }, o), tag = `events ${mode}${o.town ? ' (town)' : ''} ${sd}/${f}`;
      const plain = DG.genFloor(seed, f, op), m = DG.genFloor(seed, f, Object.assign({ events: ['probe'] }, op)), again = sd <= 2 ? DG.genFloor(seed, f, Object.assign({ events: ['probe'] }, op)) : m;
      if (plain.events || plain.rooms.some((r) => r.event)) out.push(`${tag}: an event on a floor whose pool draws none`);
      if (JSON.stringify(m) !== JSON.stringify(again)) out.push(`${tag}: the same seed marks its events otherwise`);
      const evR = new Set((m.events || []).map((e) => e.room)), strip = (q) => JSON.stringify(Object.assign({}, q, { rooms: q.rooms.map((r) => { const c = Object.assign({}, r); delete c.event; return c; }), enemies: q.enemies.filter((e) => !evR.has(e.room)), events: undefined }));
      if (strip(m) !== strip(plain)) out.push(`${tag}: marking an event moved something else on the floor`);
      floors++; if (!m.events) continue; marked++;
      const W = m.W, s = m.rooms[m.start], way = DG.wayRooms(m.cells, W, m.H, m.rooms, s.cy * W + s.cx, m.exit.ty * W + m.exit.tx), sp = DG.specials(m);
      if (new Set(sp.map((q) => q.room)).size !== sp.length) out.push(`${tag}: a room with two special roles ${JSON.stringify(sp)}`);
      if (evR.size !== m.events.length) out.push(`${tag}: two events in one room`);
      for (const E of m.events) { const r = m.rooms[E.room], P = D.EVENTS.pool[E.id], tx = Math.floor(E.x / TILE), ty = Math.floor(E.y / TILE);
        if (r.event !== E.id || r.type !== 'combat' || r.hall || r.locked || r.pocket || r.isle) out.push(`${tag}: the ${E.id} event in a ${r.type}${r.hall ? ' hall' : ''}${r.locked ? ' locked' : ''} room`);
        if (way.has(r.id)) out.push(`${tag}: the ${E.id} event on the walk to the stairs`);
        if (!DG.inRm(r, tx, ty) || m.cells[ty * W + tx] !== 1 || m.block.includes(ty * W + tx)) out.push(`${tag}: the ${E.id} event's spot is off its room's open floor`);
        if (P.room === 'treasure' && m.enemies.some((e) => e.room === r.id)) out.push(`${tag}: the ${E.id} event's treasure room keeps its pack`);
        const shut = new Set(m.block); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) shut.add((ty + j) * W + tx + i);
        const seen = new Uint8Array(W * m.H), go = [Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE)]; seen[go[0]] = 1;
        while (go.length) { const k = go.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && (m.cells[n] === 1 || m.cells[n] === 5) && !shut.has(n)) { seen[n] = 1; go.push(n); } } }
        if (!seen[m.exit.ty * W + m.exit.tx] && !seen[(m.exit.ty + 1) * W + m.exit.tx]) out.push(`${tag}: a prop on the ${E.id} event's spot cuts the way to the stairs`); } }
    if (marked < floors * 0.8) out.push(`events: only ${marked} of ${floors} floors find a room for the probe`);
    for (const sd of [1, 2, 3]) for (let f = 1; f <= 4; f++) { const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'magma', runSeed: sd }), sp = DG.specials(m);
      if (m.rooms.some((r) => r.hall && !sp.some((q) => q.src === 'hall' && q.room === r.id && q.id === r.hall))) out.push(`events: magma ${sd}/${f}: a hall missing from the floor's special rooms`);
      if (m.rooms.some((r) => r.type === 'shrine' && !sp.some((q) => q.src === 'altar' && q.room === r.id))) out.push(`events: magma ${sd}/${f}: the altar missing from the floor's special rooms`); }
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
  Object.assign(SIMX, { checkEventGen, checkEventPlay });
})(typeof window !== 'undefined' ? window : globalThis);
