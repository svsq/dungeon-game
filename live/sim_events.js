// live/sim_events.js — the event rooms (R-12, TASKS 361): a floor's events (R.events, from map.events), E at an event's spot, its
// yes/no question, its rule every step and its end. One of the sim's files (ARCHITECTURE.md §4.2).
(function (root) {
  const SIMX = root.SIMX, { D, DG, TILE, ev } = SIMX;
  // a rule per entry of data.js EVENTS.pool, every part optional: setup(R, E) as its floor is built; start(S, R, E) on «yes» (on E with
  // no question); step(S, R, E) every step while it runs; reward(S, R, E) as it ends. With no step it ends as it starts; a rule with a
  // step ends it by eventDone. The probe is the checks' and the QA's: never drawn (w 0), it ends at once
  // (`leave(S, R, E)`, optional too: the floor is left while it runs; it puts the event back as it was before «yes»)
  // a skull door's grates (TASKS 362): shut, each cell of them is a shut door's cell (5) for walking, sight and the minimap; m.shut
  // tells the flow fields; the room's box holds the hero off its lava while they are down, as a sealed arena's does
  function grates(R, E, down) { const m = R.map, r = m.rooms[E.room];
    for (const g of E.gates || []) for (const [x, y] of g.cells) m.cells[y * m.W + x] = down ? 5 : 1;
    m.shut = (m.shut || 0) + 1; m.arenaBox = down ? [r.x, r.y, r.x + r.w, r.y + r.h] : null; }
  const trialFoes = (R, E) => R.en.filter((e) => e.summ === 'trial' && e.room === E.room && e.deadT < 0);
  function trialOff(S, R, E) { grates(R, E, 0); for (const e of trialFoes(R, E)) { e.deadT = S.t; e.hp = 0; } R.en = R.en.filter((e) => !(e.summ === 'trial' && e.room === E.room)); E.st = 'idle'; E.wave = 0; E.waveT = 0; S.saveN++; }
  const TRIAL = {
    start(S, R, E) { const P = D.EVENTS.pool.trial, h = R.hero; grates(R, E, 1); E.wave = 0; E.waveT = S.t + P.gap / 2;
      ev(S, { k: 'ambush', x: h.x, y: h.y }); ev(S, { k: 'grates', room: E.room, x: E.x, y: E.y }); R.trauma = Math.min(1, R.trauma + 0.3); R.msg = { s: TXT('EVENTS.trial.start'), t: S.t, d: 3 }; },
    // a wave rises at its moment, as many as find room; the next one a gap after the last of it falls, the chest after the third.
    // The hero out of the room's box some other way than through a grate (a leap, a blink) ends it as if he had never said «yes»
    step(S, R, E) { const P = D.EVENTS.pool.trial, h = R.hero, r = R.map.rooms[E.room]; if (h.deadT >= 0) return;
      if (!(h.x >= r.x * TILE && h.y >= r.y * TILE && h.x < (r.x + r.w) * TILE && h.y < (r.y + r.h) * TILE)) { trialOff(S, R, E); R.msg = { s: TXT('EVENTS.trial.fail'), t: S.t }; return; }
      if (E.waveT > 0) { if (S.t < E.waveT) return; E.waveT = 0;
        SIMX.summonPack(S, R, E.room, P.waves[E.wave] + Math.floor(SIMX.dep(R) / P.perF), 'trial', 1);
        R.msg = { s: TXT('EVENTS.trial.wave', { n: E.wave + 1, of: P.waves.length }), t: S.t, d: 2 }; S.saveN++; return; }
      if (trialFoes(R, E).length) return;
      if (++E.wave >= P.waves.length) SIMX.eventDone(S, R, E); else E.waveT = S.t + P.gap; },
    reward(S, R, E) { const P = D.EVENTS.pool.trial; grates(R, E, 0);
      const c = { x: E.x, y: E.y, tier: P.chest, open: 0, trial: 1 }; c.loot = SIMX.chestLoot(R, c); R.chests.push(c);
      ev(S, { k: 'grates', room: E.room, x: E.x, y: E.y, up: 1 }); ev(S, { k: 'summon', x: E.x, y: E.y }); },
    leave: trialOff };
  // the blood altar (TASKS 363): the cut is a wound like any other (its flash, its number), but no armour, dodge or shield takes it
  const BLOOD = {
    start(S, R, E) { const P = D.EVENTS.pool.blood, h = R.hero, n = Math.max(0, Math.min(h.hp - 1, Math.round(h.hp * P.cost)));
      h.hp -= n; h.hurtT = S.t; R.trauma = Math.min(1, R.trauma + 0.25); ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n, blow: n, side: h.x > E.x ? 1 : -1, src: 'blood', actor: null }); },
    reward(S, R, E) { const P = D.EVENTS.pool.blood, it = SIMX.rollItem(R, SIMX.dep(R), P.item.q, undefined, P.item);
      SIMX.drop(R, E.x, E.y + 18, { kind: 'item', item: it }); ev(S, { k: 'summon', x: E.x, y: E.y }); } };
  // the cursed chest (TASKS 364): a chest of the floor's from its first moment (its finds count in the floor's loot), but E or a blow at
  // it opens its question, never the lid; «yes» opens it and the floor's curse falls
  const hexChest = (R, E) => R.chests.find((c) => c.hex === E.room);
  const HEX = {
    setup(R, E) { const P = D.EVENTS.pool.hex, c = { x: E.x, y: E.y, tier: P.chest, up: P.up, open: 0, hex: E.room }; c.loot = SIMX.chestLoot(R, c); R.chests.push(c); },
    reward(S, R, E) { const c = hexChest(R, E); E.hex = 1; if (c) { c.hexOk = 1; SIMX.openChest(S, R, c); } ev(S, { k: 'curse', x: E.x, y: E.y - 40 }); } };
  // the fountain (TASKS 364): its fate thrown at the drink, by the run's dice (a save holds them, so a reload throws the same)
  const FOUNTAIN = {
    reward(S, R, E) { const P = D.EVENTS.pool.fountain, h = R.hero;
      if (!E.fate) E.fate = SIMX.rnd(R) >= P.odd ? 'heal' : SIMX.rnd(R) < 0.5 ? 'bless' : 'hex';
      if (E.fate === 'heal') { h.hp = SIMX.heroSt(S).maxHp; ev(S, { k: 'spring', x: E.x, y: E.y }); }
      else if (E.fate === 'bless') { h.bless = 1; h.blessTo = Math.max(h.blessTo || 0, R.floor); ev(S, { k: 'bless', x: h.x, y: h.y, id: 'bless', s: D.GIFTS.find((g) => g.id === 'bless').name, cost: 0 }); }
      else { E.hex = 1; ev(S, { k: 'curse', x: h.x, y: h.y - 40 }); }
      R.msg = { s: E.fate === 'heal' ? TXT('EVENTS.fountain.heal') : E.fate === 'bless' ? TXT('EVENTS.fountain.bless') : TXT('EVENTS.fountain.hex'), t: S.t, d: 4 }; } };
  // the goblin's table (TASKS 365): the stake is set as the floor is built, so the question can name it; with less gold than that the
  // goblin asks nothing. The throw falls on the run's dice at «yes» (a save holds them), as the fountain's fate does
  const DICE = {
    setup(R, E) { const P = D.EVENTS.pool.dice; E.stake = Math.round(P.stake[0] + P.stake[1] * SIMX.dep(R)); },
    can(S, R, E) { if (R.hero.gold >= E.stake) return true; R.msg = { s: TXT('EVENTS.dice.broke', { n: E.stake }), t: S.t, d: 3 }; ev(S, { k: 'nope', x: R.hero.x, y: R.hero.y }); return false; },
    reward(S, R, E) { const P = D.EVENTS.pool.dice, h = R.hero, n = Math.min(h.gold, E.stake);
      if (!E.fate) { const q = SIMX.rnd(R); E.fate = q < P.odds[0] ? 'lose' : q < P.odds[0] + P.odds[1] ? 'win' : 'jack'; }
      const back = n * P.pay[['lose', 'win', 'jack'].indexOf(E.fate)]; h.gold += back - n; R.goldTot += Math.max(0, back - n);
      ev(S, { k: 'dice', x: E.x, y: E.y, fate: E.fate }); if (back) ev(S, { k: 'gold', x: h.x, y: h.y, n: back });
      R.msg = { s: E.fate === 'lose' ? TXT('EVENTS.dice.lose') : E.fate === 'win' ? TXT('EVENTS.dice.win', { n: back }) : TXT('EVENTS.dice.jack', { n: back }), t: S.t, d: 4 }; } };
  // the dark room (TASKS 365): it starts as the hero steps in (stepEvents) and ends as the last of its pack falls; the pack's loot
  // falls twice (lootK, in killEnemy)
  const darkFoes = (R, E) => R.en.filter((e) => e.room === E.room && e.deadT < 0 && !e.summ);
  const DARK = {
    start(S, R, E) { R.msg = { s: TXT('EVENTS.dark.enter'), t: S.t, d: 4 }; ev(S, { k: 'dark', x: E.x, y: E.y }); },
    step(S, R, E) { if (!darkFoes(R, E).length) eventDone(S, R, E); } };
  const EVENT_RULES = { probe: {}, trial: TRIAL, blood: BLOOD, hex: HEX, fountain: FOUNTAIN, dice: DICE, dark: DARK };
  const lootK = (R, e) => { const E = e.room !== undefined && e.room >= 0 && eventsOf(R).find((q) => q.id === 'dark' && q.room === e.room); return E ? D.EVENTS.pool.dark.loot : 1; };
  // the cells the minimap leaves out: the dark rooms' (TASKS 365), their wings too
  function darkMask(R) { const m = R.map, out = new Set();
    for (const E of eventsOf(R)) { if (!D.EVENTS.pool[E.id] || !D.EVENTS.pool[E.id].hide) continue; const r = m.rooms[E.room];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.add(y * m.W + x);
      for (const [a, b, c, d] of r.wings || []) for (let y = b; y < b + d; y++) for (let x = a; x < a + c; x++) out.add(y * m.W + x); }
    return out; }
  // the floor's curses (TASKS 364): each the cursed chest's or a bitter fountain's, kept with the floor in its events
  const hexN = (R) => (R.events || []).filter((E) => E.hex).length;
  // a floor's blessing from its fountain comes back with the floor: arrive() clears the hero's, then this gives it again
  function eventsArrive(R) { const h = R.hero; if ((R.events || []).some((E) => E.fate === 'bless')) { h.bless = 1; h.blessTo = Math.max(h.blessTo || 0, R.floor); } }
  const eventsOf = (R) => R.events || [];
  function eventsBuild(R) {
    R.events = (R.map.events || []).map((e) => Object.assign({ st: 'idle' }, e));
    for (const E of R.events) { const F = EVENT_RULES[E.id]; if (F && F.setup) F.setup(R, E); } }
  const eventNear = (R) => { const h = R.hero; return eventsOf(R).find((E) => E.st === 'idle' && !D.EVENTS.pool[E.id].walk && Math.hypot(E.x - h.x, E.y - h.y) < (D.EVENTS.pool[E.id].near || D.EVENTS.near)) || null; };
  // «Нет» in focus, so Enter alone never takes a risk
  function eventUse(S, R, E) {
    const F = EVENT_RULES[E.id]; if (F && F.can && !F.can(S, R, E)) return;
    if (!D.EVENTS.pool[E.id].ask) { eventStart(S, R, E); return; }
    R.evAsk = R.events.indexOf(E); S.screen = 'event'; S.focus = 'evNo'; S.hover = ''; ev(S, { k: 'ui', x: E.x, y: E.y }); }
  function eventStart(S, R, E) {
    if (E.st !== 'idle') return; const F = EVENT_RULES[E.id] || {}; E.st = 'on'; E.t0 = S.t; if (F.start) F.start(S, R, E);
    if (E.st === 'on' && !F.step) eventDone(S, R, E); S.saveN++; }
  // the end: its reward, its line, and `qevent` with its room, the lair quest's word (1021)
  function eventDone(S, R, E) {
    if (E.st === 'done') return; const F = EVENT_RULES[E.id] || {}, P = D.EVENTS.pool[E.id]; E.st = 'done'; E.t1 = S.t;
    if (F.reward) F.reward(S, R, E); if (P.done) R.msg = { s: P.done, t: S.t };
    ev(S, { k: 'qevent', room: E.room, event: E.id, x: E.x, y: E.y }); S.saveN++; }
  // the floor left with an event running: back to how it stood before «yes», so the floor kept (or saved) never holds a half-fought one
  function eventsLeave(S, R) { for (const E of eventsOf(R)) if (E.st === 'on') { const F = EVENT_RULES[E.id]; if (F && F.leave) F.leave(S, R, E); } }
  function stepEvents(S, R) { const h = R.hero;
    for (const E of eventsOf(R)) if (E.st === 'idle' && D.EVENTS.pool[E.id].walk && h.deadT < 0 && DG.roomAt(R.map, h.x, h.y) === E.room) eventStart(S, R, E);
    for (const E of eventsOf(R)) if (E.st === 'on') { const F = EVENT_RULES[E.id]; if (F && F.step) F.step(S, R, E); } }
  Object.assign(SIMX, { EVENT_RULES, lootK, darkMask, hexN, eventsArrive, eventsOf, eventsBuild, eventNear, eventUse, eventStart, eventDone, eventsLeave, stepEvents });
})(typeof window !== 'undefined' ? window : globalThis);
