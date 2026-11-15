// live/sim_checks_events.js — selfCheck's part for the event rooms (TASKS 361, 1817). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    D, DG, enterFloor, newRun, spawn, step, TILE } = SIMX;
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
    // (12 seeds since TASKS 366: with seven events in the pool the cave's fountain fell on none of the first 6 seeds' floors)
    // (TASKS 368: an event kept to the town's run or to some biomes is looked for only there, and never comes elsewhere)
    { const seen = {}, run = (mode, o) => mode + (o.town ? ' (town)' : ''), biomes = {};
      for (const [mode, o] of MODES) for (let sd = 1; sd <= 12; sd++) for (let f = 1; f <= Math.min(5, D.RUNS[mode].floors); f++) { const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, Object.assign({ mode, runSeed: sd }, o));
        (biomes[run(mode, o)] = biomes[run(mode, o)] || new Set()).add(m.biome);
        for (const E of m.events || []) { const P = D.EVENTS.pool[E.id]; seen[E.id + ' ' + run(mode, o)] = 1;
          if ((P.town && !o.town) || (P.biomes && !P.biomes.includes(m.biome))) out.push(`events: ${E.id} drawn in the ${run(mode, o)} run on a ${m.biome} floor`); } }
      for (const [id, P] of Object.entries(D.EVENTS.pool)) if (P.w > 0) for (const [mode, o] of MODES) { const k = run(mode, o);
        if ((!P.modes || P.modes.includes(mode)) && (!P.town || o.town) && (!P.biomes || P.biomes.some((b) => biomes[k].has(b))) && !seen[id + ' ' + k]) out.push(`events: the pool never draws ${id} in the ${k} run`); } }
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
      if (ch.length !== 1 || ch[0].tier !== P.chest || ch[0].open) out.push(`${tag}: ${ch.length} reward chests of tier ${ch.map((c) => c.tier)}`);
      if (SIMX.lootAudit(R).off) out.push(`${tag}: the reward chest is left out of the floor's loot (audit off ${SIMX.lootAudit(R).off})`); }
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
    // a wave with no room to rise in is tried again, never counted or called out empty; one that never finds room is let go
    for (const fail of [2, 1e9]) { const { S, R, E } = evRun('campaign', {}, 'trial'), h = R && R.hero; if (!E) { out.push('trial play: no skull door for the empty wave'); break; }
      const real = SIMX.summonPack, said = P.waves.map((_, i) => TXT('EVENTS.trial.wave', { n: i + 1, of: P.waves.length })), risen = [];
      let left = fail; SIMX.summonPack = (...a) => (left-- > 0 ? 0 : real(...a));
      try { SIMX.eventStart(S, R, E); for (let i = 0; i < 120 * 60 && E.st === 'on'; i++) { R.msg = null; step(S, { keys: [] }); h.hp = 1e6; h.x = E.x; h.y = E.y + 10;
        if (R.msg && said.includes(R.msg.s) && !R.en.some((e) => e.summ === 'trial' && e.deadT < 0)) out.push(`trial play: «${R.msg.s}» called out with no wave up`);
        for (const e of R.en) if (e.summ === 'trial' && e.deadT < 0) { if (risen[risen.length - 1] !== E.wave) risen.push(E.wave); e.hp = 0; SIMX.killEnemy(S, R, e); } } } finally { SIMX.summonPack = real; }
      if (E.st !== 'done') out.push(`trial play: summons failing ${fail} times leave it ${E.st}`);
      if (fail < P.tries && risen.join() !== '0,1,2') out.push(`trial play: after ${fail} failed summons the waves risen are ${risen}`); }
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
      if (SIMX.lootAudit(R).off) out.push(`${tag}: its find is left out of the floor's loot (audit off ${SIMX.lootAudit(R).off})`);
      key('KeyE'); if (S.screen === 'event') out.push(`${tag}: the altar asks again`);
      if (!SIMX.solids(R).some((b) => b.x === E.x && b.y === E.y)) out.push(`${tag}: the altar does not stand in the way`);
      if (o.town) { const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))), b = T.saved && (T.saved.events || []).find((x) => x.room === E.room); if (!b || b.st !== 'done') out.push(`${tag}: a save forgets it was given its blood`); } }
    // the last point is never taken: at 1 health «yes» leaves 1, and at 3 it takes 1
    { const { S, R, E, ask } = evRun('campaign', {}, 'blood'); if (E) { R.hero.hp = 1; ask(); if (R.hero.hp !== 1 || R.hero.deadT >= 0) out.push(`blood altar: a hero at 1 health is left at ${R.hero.hp}`); } }
  }
  // a monster's blow of 30 on the hero as it lands after his armour, under any cap (a dodge thrown again until one lands; no rage to soften it)
  function blow(S, R) { const h = R.hero, e = { type: 'skeleton', x: h.x + 30, y: h.y }; for (let i = 0; i < 40; i++) { h.ifr = 0; h.hp = 1e5; h.mp = 0; h.shield = 0; S.ev.length = 0; SIMX.hurtHero(S, R, 30, e.x, e.y, undefined, 'skeleton', e);
    const g = S.ev.find((v) => v.k === 'hurt'); h.vx = h.vy = 0; h.ifr = 0; R.freeze = 0; R.inbuf = null; if (g) return g.n; } return 0; }
  // the cursed chest (TASKS 364) in each run: a chest of its tier stands on its spot from the start, its finds rolled `up` floors
  // deeper; E or a blow at it asks and never lifts the lid; «no» leaves it shut; «yes» opens it, lays its finds, curses the floor
  // (the monsters' blows EVENTS.hex harder, the curse on the HUD's list), one `qevent`; the curse is the floor's: another floor has
  // none, and the floor come back to and a save keep it
  function checkHexPlay(out) {
    const P = D.EVENTS.pool.hex;
    for (const [mode, o] of MODES) { const tag = `cursed chest ${mode}${o.town ? ' (town)' : ''}`, { S, R, E, key, ask } = evRun(mode, o, 'hex');
      if (!E) { out.push(`${tag}: no floor of 1–4 lays it asked for`); continue; }
      const c = R.chests.find((q) => q.hex === E.room);
      if (!c || c.x !== E.x || c.y !== E.y || c.tier !== P.chest || c.up !== P.up || c.open || !(c.loot || []).length) { out.push(`${tag}: its chest is ${JSON.stringify(c && { tier: c.tier, up: c.up, open: c.open, n: (c.loot || []).length })}`); continue; }
      { const rs = R.rs, id = R.nextId, lv = (up) => { R.rs = rs; R.nextId = id; return SIMX.chestLoot(R, Object.assign({}, c, { up })).filter((it) => !SIMX.isCons(it)).map((it) => it.lvl); };
        const a = lv(0), b = lv(c.up); R.rs = rs; R.nextId = id; if (!(Math.max(...b) > Math.max(...a))) out.push(`${tag}: its finds are rolled no deeper (${a} → ${b})`); }
      const n0 = blow(S, R); R.hero.x = E.x + 30; R.hero.y = E.y + 30; R.hero.hp = 100;
      SIMX.hitChests(S, R, E.x, E.y, 80); if (c.open || S.screen !== 'event') out.push(`${tag}: a blow at it opens ${c.open ? 'the lid' : S.screen}, not its question`); key('Enter');
      key('KeyE'); if (S.screen !== 'event' || c.open) out.push(`${tag}: E at it opens ${S.screen}, the lid ${c.open ? 'up' : 'down'}`);
      key('Enter'); if (c.open || E.st !== 'idle' || SIMX.hexN(R)) out.push(`${tag}: «no» opens it or curses the floor`);
      const d0 = R.drops.length; ask(); const q = S.ev.filter((e) => e.k === 'qevent' && e.room === E.room && e.event === 'hex'), got = R.drops.slice(d0).filter((p) => p.kind === 'item');
      if (!c.open || E.st !== 'done' || q.length !== 1 || got.length < 2) out.push(`${tag}: «yes» leaves the lid ${c.open ? 'up' : 'down'}, it ${E.st}, ${q.length} qevent, ${got.length} finds out`);
      if (SIMX.lootAudit(R).off) out.push(`${tag}: its finds are counted off the floor's loot (audit off ${SIMX.lootAudit(R).off})`);
      const n1 = blow(S, R); if (SIMX.hexN(R) !== 1 || n1 <= n0 || Math.abs(n1 - n0 * (1 + D.EVENTS.hex)) > 2) out.push(`${tag}: a blow of ${n0} lands as ${n1} on the cursed floor`);
      const f = R.floor; enterFloor(S, R, f + 1); if (SIMX.hexN(R)) out.push(`${tag}: the curse follows the hero to the next floor`);
      if (o.town) { enterFloor(S, R, f, undefined, 'up'); if (SIMX.hexN(R) !== 1) out.push(`${tag}: the floor come back to forgets its curse`);
        const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))); if (!T.saved || (T.saved.events || []).filter((x) => x.hex).length !== 1) out.push(`${tag}: a save forgets the floor's curse`); } }
  }
  // the fountain (TASKS 364) in each run: «yes» heals to the full, blesses the floor (GIFTS.bless) or curses it, each a fate kept with
  // the floor; drunk, it asks no more and stands in the way. Thrown on the run's dice, about one drink in three is no plain healing
  function checkFountainPlay(out) {
    for (const [mode, o] of MODES) for (const fate of ['heal', 'bless', 'hex']) { const tag = `fountain ${mode}${o.town ? ' (town)' : ''} ${fate}`, { S, R, E, key, ask } = evRun(mode, o, 'fountain'), h = R && R.hero;
      if (!E) { out.push(`${tag}: no floor of 1–4 lays it asked for`); break; }
      E.fate = fate; h.hp = 5; h.bless = 0; ask(); const max = SIMX.heroSt(S).maxHp, f = R.floor;
      if (E.st !== 'done' || S.ev.filter((e) => e.k === 'qevent' && e.room === E.room).length !== 1) out.push(`${tag}: it ends ${E.st}`);
      if (fate === 'heal' && (h.hp < max - 1 || h.bless || SIMX.hexN(R))) out.push(`${tag}: the drink leaves ${h.hp} of ${max}, bless ${h.bless}, curses ${SIMX.hexN(R)}`);
      if (fate === 'bless' && (!h.bless || h.hp > 50 || SIMX.hexN(R))) out.push(`${tag}: the drink leaves bless ${h.bless}, ${h.hp} health`);
      if (fate === 'hex' && (h.bless || SIMX.hexN(R) !== 1)) out.push(`${tag}: the drink leaves curses ${SIMX.hexN(R)}`);
      key('KeyE'); if (S.screen === 'event') out.push(`${tag}: the fountain asks again`);
      if (!SIMX.solids(R).some((b) => b.x === E.x && b.y === E.y)) out.push(`${tag}: the fountain does not stand in the way`);
      enterFloor(S, R, f + 1); if (h.bless || SIMX.hexN(R)) out.push(`${tag}: its fate follows the hero to the next floor`);
      if (o.town) { enterFloor(S, R, f, undefined, 'up'); if (!!h.bless !== (fate === 'bless') || SIMX.hexN(R) !== (fate === 'hex' ? 1 : 0)) out.push(`${tag}: the floor come back to forgets its fate (bless ${h.bless}, curses ${SIMX.hexN(R)})`); } }
    { const { S, R, E } = evRun('campaign', {}, 'fountain'); if (!E) return; const n = {};
      for (let i = 0; i < 90; i++) { R.rs = (i * 7919 + 13) | 0; E.st = 'idle'; delete E.fate; delete E.hex; SIMX.eventStart(S, R, E); n[E.fate] = (n[E.fate] || 0) + 1; }
      if (!(n.heal >= 45 && n.heal <= 75 && n.bless >= 6 && n.hex >= 6)) out.push(`fountain: 90 drinks fall ${JSON.stringify(n)}, not about two in three healing`); }
  }
  // the goblin's table (TASKS 365) in each run: its stake set with the floor and named; with less gold the goblin asks nothing; «no»
  // takes nothing; «yes» takes the stake and pays back none, twice or thrice by the throw, one `qevent`; it asks no more and stands
  // in the way; a save keeps the throw. Thrown on the run's dice, the three fall about as the odds say
  function checkDicePlay(out) {
    const P = D.EVENTS.pool.dice;
    for (const [mode, o] of MODES) for (const [i, fate] of ['lose', 'win', 'jack'].entries()) { const tag = `goblin's table ${mode}${o.town ? ' (town)' : ''} ${fate}`, { S, R, E, key, ask } = evRun(mode, o, 'dice'), h = R && R.hero;
      if (!E) { out.push(`${tag}: no floor of 1–4 lays it asked for`); break; }
      if (E.stake !== Math.round(P.stake[0] + P.stake[1] * SIMX.dep(R))) out.push(`${tag}: its stake is ${E.stake}`);
      h.gold = E.stake - 1; key('KeyE'); if (S.screen === 'event' || h.gold !== E.stake - 1 || E.st !== 'idle') out.push(`${tag}: a hero short of the stake is asked, or loses gold`);
      h.gold = 1000; key('KeyE'); if (S.screen !== 'event') out.push(`${tag}: E with the stake in hand asks nothing (${S.screen})`); key('Enter');
      if (h.gold !== 1000 || E.st !== 'idle') out.push(`${tag}: «no» leaves ${h.gold} gold, it ${E.st}`);
      E.fate = fate; ask(); const want = 1000 - E.stake + E.stake * P.pay[i], q = S.ev.filter((e) => e.k === 'qevent' && e.room === E.room && e.event === 'dice');
      if (h.gold !== want || E.st !== 'done' || q.length !== 1) out.push(`${tag}: «yes» leaves ${h.gold} gold of ${want}, it ${E.st}, ${q.length} qevent`);
      key('KeyE'); if (S.screen === 'event') out.push(`${tag}: the table asks again`);
      if (!SIMX.solids(R).some((b) => b.x === E.x && b.y === E.y)) out.push(`${tag}: the table does not stand in the way`);
      if (o.town) { const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))), b = T.saved && (T.saved.events || []).find((x) => x.room === E.room); if (!b || b.st !== 'done' || b.fate !== fate) out.push(`${tag}: a save forgets the throw`); } }
    { const { S, R, E } = evRun('campaign', {}, 'dice'); if (!E) return; const n = { lose: 0, win: 0, jack: 0 };
      for (let i = 0; i < 200; i++) { R.rs = (i * 7919 + 13) | 0; R.hero.gold = 1000; E.st = 'idle'; delete E.fate; SIMX.eventStart(S, R, E); n[E.fate]++; }
      if (Math.abs(n.lose - 200 * P.odds[0]) > 25 || Math.abs(n.win - 200 * P.odds[1]) > 25 || n.jack < 12) out.push(`goblin's table: 200 throws fall ${JSON.stringify(n)}`); }
  }
  // the dark room (TASKS 365) in each run, its pack kept: idle until the hero steps into it, then on; off the minimap (darkMask holds
  // its box, no event mark); its pack drops twice (an elite of it two heaps of gold, one elsewhere); the last of it down ends it with
  // one `qevent`; the floor left and come back to and a save keep it done
  function checkDarkPlay(out) {
    for (const [mode, o] of MODES) { const tag = `dark room ${mode}${o.town ? ' (town)' : ''}`;
      const S = spawn(0, {}); S.run = newRun(S, mode, 77, Object.assign({ allFree: 1 }, o)); S.screen = 'play'; const R = S.run, h = R.hero; let E = null, f = 0;
      for (f = 2; f <= Math.min(5, D.RUNS[mode].floors) && !E; f++) { enterFloor(S, R, f, { events: ['dark'] }); E = (R.events || []).find((q) => q.id === 'dark'); }
      if (!E) { out.push(`${tag}: no floor of 2–5 lays it asked for`); continue; } f--;
      const m = R.map, r = m.rooms[E.room], pack = () => R.en.filter((e) => e.room === E.room && e.deadT < 0 && !e.summ);
      if (pack().length < D.EVENTS.pool.dark.pack) out.push(`${tag}: its pack is ${pack().length}`);
      if (m.torches.some((t) => t.r === E.room && !t.dark)) out.push(`${tag}: a torch still burns in it`);
      const mask = SIMX.darkMask(R); if (!mask.has(Math.floor(E.y / TILE) * m.W + Math.floor(E.x / TILE)) || !mask.has(r.y * m.W + r.x)) out.push(`${tag}: the minimap shows it`);
      if (SIMX.eventNear(Object.assign({}, R, { hero: Object.assign({}, h, { x: E.x, y: E.y }) }))) out.push(`${tag}: its spot offers E`);
      h.ifr = 1e9; for (const e of R.en) if (e.room !== E.room) { e.hp = 0; e.deadT = S.t; }
      h.x = m.spawn.x; h.y = m.spawn.y; step(S, { keys: [] }); if (E.st !== 'idle') out.push(`${tag}: it starts before the hero comes in (${E.st})`);
      h.x = E.x; h.y = E.y; step(S, { keys: [] }); if (E.st !== 'on') out.push(`${tag}: the hero in it leaves it ${E.st}`);
      const gold = (room) => { const e = Object.assign({}, pack()[0], { id: R.nextId++, elite: 1, key: undefined, room, hp: 0 }); R.en.push(e); const d0 = R.drops.length; SIMX.killEnemy(S, R, e); return R.drops.slice(d0).filter((p) => p.kind === 'gold').length; };
      const other = m.rooms.find((q) => q.id !== E.room && q.type === 'combat').id, gIn = gold(E.room), gOut = gold(other);
      if (gIn !== 2 || gOut !== 1) out.push(`${tag}: an elite drops ${gIn} heaps of gold in it and ${gOut} elsewhere`);
      S.ev.length = 0; for (const e of pack()) { e.hp = 0; SIMX.killEnemy(S, R, e); } for (let i = 0; i < 30; i++) { R.freeze = 0; S.screen = 'play'; step(S, { keys: [] }); }
      const q = S.ev.filter((e) => e.k === 'qevent' && e.room === E.room && e.event === 'dark');
      if (E.st !== 'done' || q.length !== 1) out.push(`${tag}: its pack down leaves it ${E.st} with ${q.length} qevent`);
      if (SIMX.lootAudit(R).off) out.push(`${tag}: its pack's second drop is left out of the floor's loot (audit off ${SIMX.lootAudit(R).off})`);
      if (o.town) { enterFloor(S, R, f + 1); enterFloor(S, R, f, undefined, 'up'); const B = (R.events || []).find((x) => x.room === E.room); if (!B || B.st !== 'done') out.push(`${tag}: the floor come back to forgets it`);
        const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))), b = T.saved && (T.saved.events || []).find((x) => x.room === E.room); if (!b || b.st !== 'done') out.push(`${tag}: a save forgets it`); } }
  }
  // the captive (TASKS 366) in each run: a monster of his room's pack keeps the cage's key and drops it; E with no key asks nothing,
  // «no» keeps the key; «yes» spends it and he walks out. Led along the way to the merchant (or, with none on the floor, to the spawn by
  // the stairs up), he keeps to open floor and comes home: one `qevent`, the shop's prices down by `off` or his shards paid. A waking
  // monster near him stops him, `hits` blows send him off unpaid with no `qevent`; the floor left and come back to, and a save, keep him
  function checkCaptivePlay(out) {
    const P = D.EVENTS.pool.captive, cellOf = (m, x, y) => m.cells[Math.floor(y / TILE) * m.W + Math.floor(x / TILE)];
    for (const [mode, o] of MODES) { const tag = `captive ${mode}${o.town ? ' (town)' : ''}`, { S, R, E, key, ask } = evRun(mode, o, 'captive'), h = R && R.hero;
      if (!E) { out.push(`${tag}: no floor of 1–4 lays it asked for`); continue; }
      const m = R.map; if (!m.enemies.some((e) => e.key === 'cage' && e.room === E.room)) out.push(`${tag}: no monster of its room keeps the cage's key`);
      if (!SIMX.solids(R).some((b) => Math.abs(b.x - E.x) < 40 && Math.abs(b.y - E.y) < 20)) out.push(`${tag}: the cage does not stand in the way`);
      R.keys = 0; key('KeyE'); if (S.screen === 'event' || E.st !== 'idle') out.push(`${tag}: E with no key asks, or opens the cage`);
      R.keys = 1; key('KeyE'); if (S.screen !== 'event') out.push(`${tag}: E with a key asks nothing (${S.screen})`); key('Enter');
      if (E.st !== 'idle' || R.keys !== 1) out.push(`${tag}: «no» leaves it ${E.st} with ${R.keys} keys`);
      const prices = R.shop ? R.shop.goods.map((g) => g.price) : [], sh0 = R.shards; ask();
      if (E.st !== 'on' || R.keys !== 0 || E.px === undefined) { out.push(`${tag}: «yes» leaves it ${E.st} with ${R.keys} keys`); continue; }
      if (E.goal.k !== (m.shop ? 'shop' : 'up')) out.push(`${tag}: he heads for the ${E.goal.k} on a floor ${m.shop ? 'with' : 'without'} a merchant`);
      key('KeyE'); if (S.screen === 'event') out.push(`${tag}: the open cage asks again`);
      for (const d of m.doors || []) if (!d.open && !SIMX.doorLock(m, d)) SIMX.openDoor(S, R, d, 0);
      const W = m.W, g0 = Math.floor(E.goal.y / TILE) * W + Math.floor(E.goal.x / TILE), blk = new Set(m.block), dist = new Int32Array(W * m.H).fill(-1), q = [g0]; dist[g0] = 0;
      for (let i = 0; i < q.length; i++) for (const dd of [1, -1, W, -W]) { const n = q[i] + dd; if (dist[n] < 0 && m.cells[n] === 1 && !blk.has(n)) { dist[n] = dist[q[i]] + 1; q.push(n); } }
      const ahead = (k0) => { let k = k0; for (let j = 0; j < 4; j++) { const nx = [1, -1, W, -W].map((dd) => k + dd).find((n) => dist[n] >= 0 && dist[n] < dist[k]); if (nx === undefined) break; k = nx; } return k; };
      h.ifr = 1e9; let off = 0, n = 0; const q0 = S.ev.length;
      for (; n < 120 * 150 && E.st === 'on'; n++) { if (n % 20 === 0) { const k = ahead(Math.floor(E.py / TILE) * W + Math.floor(E.px / TILE)); if (dist[k] >= 0) { h.x = (k % W + 0.5) * TILE; h.y = (Math.floor(k / W) + 0.5) * TILE; } }
        h.vx = h.vy = 0; R.freeze = 0; S.screen = 'play'; step(S, { keys: [] }); if (cellOf(m, E.px, E.py) !== 1) off++; }
      const qe = S.ev.slice(q0).filter((e) => e.k === 'qevent' && e.room === E.room && e.event === 'captive').length;
      if (E.st !== 'done' || E.lost || qe !== 1) out.push(`${tag}: led to the ${E.goal.k} for ${(n / 120).toFixed(0)} s he is ${E.st}${E.lost ? ' (fled)' : ''}, ${qe} qevent, ${Math.round(Math.hypot(E.px - E.goal.x, E.py - E.goal.y))} px off it`);
      if (off) out.push(`${tag}: he stood ${off} steps off the open floor`);
      if (E.st === 'done' && E.goal.k === 'shop' && !R.shop.goods.every((gd, i) => gd.price === Math.max(1, Math.round(prices[i] * (1 - P.off))))) out.push(`${tag}: home at the merchant's, the prices are ${R.shop.goods.map((gd) => gd.price)} of ${prices}`);
      if (E.st === 'done' && E.goal.k === 'up' && R.shards - sh0 !== Math.round(P.shards[0] + P.shards[1] * SIMX.dep(R))) out.push(`${tag}: home by the stairs up, he pays ${R.shards - sh0} shards`);
      if (o.town) { const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))), b = T.saved && (T.saved.events || []).find((x) => x.room === E.room); if (!b || b.st !== 'done') out.push(`${tag}: a save forgets him home`); } }
    { const { S, R, E, ask } = evRun('campaign', { town: 1 }, 'captive'); if (!E) return; const m = R.map, h = R.hero, f = R.floor; R.keys = 1; ask(); if (E.st !== 'on') return;
      const foe = (dx, st) => ({ id: R.nextId++, type: 'skeleton', x: E.px + dx, y: E.py, hp: 10, deadT: -1, st, vx: 0, vy: 0 });
      // (the hero on open floor 5–8 cells off: a way field from a wall cell leads nowhere)
      const F0 = SIMX.flow(m, Math.floor(E.px / TILE), Math.floor(E.py / TILE)), k = F0.findIndex((v) => v >= 5 && v <= 8); h.x = (k % m.W + 0.5) * TILE; h.y = (Math.floor(k / m.W) + 0.5) * TILE; const x0 = E.px, y0 = E.py; R.en = [foe(110, 'chase')]; for (let i = 0; i < 120; i++) { S.t += SIMX.DT; SIMX.stepEvents(S, R); }
      if (Math.hypot(E.px - x0, E.py - y0) > 3 || E.hits !== P.hits) out.push(`captive: a waking monster 110 px off lets him walk ${Math.round(Math.hypot(E.px - x0, E.py - y0))} px, or strikes him (${E.hits} hits left)`);
      R.en = [foe(110, 'idle')]; for (let i = 0; i < 60; i++) { S.t += SIMX.DT; SIMX.stepEvents(S, R); } if (Math.hypot(E.px - x0, E.py - y0) < 3) out.push('captive: a sleeping monster near him stops him');
      const px = E.px, py = E.py; enterFloor(S, R, f + 1); enterFloor(S, R, f, undefined, 'up'); const B = (R.events || []).find((x) => x.room === E.room);
      if (!B || B.st !== 'on' || Math.abs(B.px - px) > 1 || Math.abs(B.py - py) > 1) out.push(`captive: the floor come back to loses him (${B && B.st})`); else {
        const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))), b = T.saved && (T.saved.events || []).find((x) => x.room === E.room); if (!b || b.st !== 'on' || Math.abs(b.px - px) > 1) out.push('captive: a save loses him on his way');
        const sh0 = R.shards, pr0 = R.shop ? R.shop.goods.map((g) => g.price).join() : '', q0 = S.ev.length; R.en = [Object.assign(foe(0, 'strike'), { x: B.px + 20, y: B.py })];
        for (let i = 0; i < 120 * 4 && B.st === 'on'; i++) { S.t += SIMX.DT; SIMX.stepEvents(S, R); }
        if (B.st !== 'done' || !B.lost || R.shards !== sh0 || (R.shop ? R.shop.goods.map((g) => g.price).join() : '') !== pr0 || S.ev.slice(q0).some((e) => e.k === 'qevent' && e.event === 'captive')) out.push(`captive: ${P.hits} blows leave him ${B.st}${B.lost ? ' (fled)' : ''}, or pay`); } }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { allFree: 1 }); S.screen = 'play'; const R = S.run; let k = null;
      for (let f = 1; f <= 4 && !k; f++) { enterFloor(S, R, f, { events: ['captive'] }); k = R.en.find((e) => e.key === 'cage'); }
      if (!k) { out.push('captive: no monster keeps the cage\'s key'); return; } const d0 = R.drops.length; R.keys = 0; k.hp = 0; SIMX.killEnemy(S, R, k); const p = R.drops.slice(d0).find((q) => q.kind === 'key');
      if (!p) out.push('captive: the keeper drops no key'); else { R.en = []; R.hero.x = p.x; R.hero.y = p.y; for (let i = 0; i < 240 && !(R.keys > 0); i++) { R.freeze = 0; S.screen = 'play'; step(S, { keys: [] }); } if (R.keys !== 1) out.push('captive: the keeper\'s key is not picked up'); } }
  }
  // the library (TASKS 368) in the town's run: a lectern on its spot that stands in the way, shelves on its back wall whose cells the
  // way fields go round, the room's open floor still one piece. E asks nothing: it opens a plain note of the floor's era in the notes'
  // window, puts it in the journal, pays its share of the level's need once and sends one `qevent`; it opens no more, and a save keeps
  // it. Its book is never one lying unread on the floor; a series begun goes first; with the era all read a one-off comes again, and
  // with nothing left at all there is no note, but the lesson is paid. It is never drawn in a cave or by the magma
  function checkLibraryPlay(out) {
    const P = D.EVENTS.pool.library, { S, R, E, key } = evRun('campaign', { town: 1 }, 'library'), tag = 'library';
    if (!E) { out.push(`${tag}: no floor of 1–4 lays it asked for`); return; }
    const m = R.map, h = R.hero, r = m.rooms[E.room], W = m.W, era = D.NOTES.era[m.biome], ofEra = (n) => n.id.split('_')[0] === era || (n.id.startsWith('pilot') && era === 'cellar');
    const shelves = m.decor.filter((d) => d.n === 'bookshelf' && d.secret === undefined && DG.inRm(r, Math.floor(d.x / TILE), Math.floor(d.y / TILE)));
    if (!shelves.length) out.push(`${tag}: no shelf in its room`);
    if (shelves.some((d) => !m.block.includes(Math.floor(d.y / TILE) * W + Math.floor(d.x / TILE)))) out.push(`${tag}: a shelf's cell is left open to the way fields`);
    if (!SIMX.solids(R).some((b) => b.x === E.x && b.y === E.y)) out.push(`${tag}: the lectern does not stand in the way`);
    { const blk = new Set(m.block), k0 = Math.floor(E.y / TILE) * W + Math.floor(E.x / TILE); blk.add(k0); const ok = (k) => DG.inRm(r, k % W, Math.floor(k / W)) && m.cells[k] === 1 && !blk.has(k);
      const all = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (ok(y * W + x)) all.push(y * W + x);
      const seen = new Set([k0 + W]), st = [k0 + W]; while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (ok(n) && !seen.has(n)) { seen.add(n); st.push(n); } } }
      if (all.some((k) => !seen.has(k))) out.push(`${tag}: its shelves and lectern cut its floor in two`); }
    S.meta.notes = []; h.xp = 0; const lvl = h.lvl, want = Math.round(Math.round(D.xpNeed(lvl) * P.xp) * SIMX.dif(R, 'xp')); S.ev.length = 0; key('KeyE');
    const N = D.NOTES.byId[E.note], q = S.ev.filter((e) => e.k === 'qevent' && e.room === E.room && e.event === 'library');
    if (S.screen !== 'note' || !N || !S.note || S.note.id !== E.note || N.kind !== 'note' || !ofEra(N)) out.push(`${tag}: E opens ${S.screen} with ${E.note}, not a note of the ${era}`);
    if (!S.meta.notes.includes(E.note)) out.push(`${tag}: its note is not in the journal`);
    if (h.lvl !== lvl || h.xp !== want || E.st !== 'done' || q.length !== 1) out.push(`${tag}: it pays ${h.xp} of ${want} experience, ends ${E.st} with ${q.length} qevent`);
    S.screen = 'play'; key('KeyE'); if (S.screen === 'note' || h.xp !== want) out.push(`${tag}: a book read opens again or pays twice`);
    { const T = spawn(1, JSON.parse(JSON.stringify(SIMX.persist(S)))), b = T.saved && (T.saved.events || []).find((x) => x.room === E.room); if (!b || b.st !== 'done' || b.note !== E.note) out.push(`${tag}: a save forgets it was read`); }
    const L = D.NOTES.list.filter((n) => n.kind === 'note' && ofEra(n)), pick = () => SIMX.libraryNote(S, R, E), d0 = R.drops.length, used0 = (R.notesUsed || []).slice();
    { S.meta.notes = []; R.notesUsed = []; const a = pick(); R.drops.push({ id: R.nextId++, kind: 'note', note: a.id, x: 0, y: 0 }); const b = pick(); if (!b || b.id === a.id) out.push(`${tag}: its book is the note lying unread on the floor`); R.drops.length = d0; }
    { const ch = L.find((n) => n.chain && n.part === 1); S.meta.notes = [ch.id]; const a = pick(); if (!a || !a.chain || a.part < 2) out.push(`${tag}: with a series begun it opens ${a && a.id}, not its next part`); }
    { S.meta.notes = L.map((n) => n.id); R.notesUsed = []; const a = pick(); if (!a || a.chain) out.push(`${tag}: with the era all read it opens ${a && a.id}, not a one-off again`);
      R.notesUsed = L.filter((n) => !n.chain).map((n) => n.id); if (pick()) out.push(`${tag}: with every note met it still finds one`);
      E.st = 'idle'; delete E.note; S.screen = 'play'; h.xp = 0; SIMX.eventStart(S, R, E); if (S.screen === 'note' || E.note || h.xp !== want || !R.msg || R.msg.s !== TXT('EVENTS.library.empty', { n: want })) out.push(`${tag}: with nothing left to read it opens ${S.screen}, pays ${h.xp}`); }
    S.meta.notes = []; R.notesUsed = used0;
    for (const [mode, o] of MODES) for (let sd = 1; sd <= 6; sd++) for (let f = 1; f <= D.RUNS[mode].floors; f++) { const m2 = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, Object.assign({ mode, runSeed: sd }, o));
      if ((m2.events || []).some((x) => x.id === 'library') && (!o.town || !P.biomes.includes(m2.biome))) out.push(`${tag}: drawn in the ${mode}${o.town ? ' (town)' : ''} run on a ${m2.biome} floor ${f}`); }
  }
  SIMX.checks.add('eventGenCheck', checkEventGen);
  SIMX.checks.add('eventPlayCheck', checkEventPlay);
  SIMX.checks.add('trialPlayCheck', checkTrialPlay);
  SIMX.checks.add('bloodPlayCheck', checkBloodPlay);
  SIMX.checks.add('hexPlayCheck', checkHexPlay);
  SIMX.checks.add('fountainPlayCheck', checkFountainPlay);
  SIMX.checks.add('dicePlayCheck', checkDicePlay);
  SIMX.checks.add('darkPlayCheck', checkDarkPlay);
  SIMX.checks.add('captivePlayCheck', checkCaptivePlay);
  SIMX.checks.add('libraryPlayCheck', checkLibraryPlay);
})(typeof window !== 'undefined' ? window : globalThis);
