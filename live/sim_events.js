// live/sim_events.js — the event rooms (R-12, TASKS 361): a floor's events (R.events, from map.events), E at an event's spot, its
// yes/no question, its rule every step and its end. One of the sim's files (ARCHITECTURE.md §4.2).
(function (root) {
  const SIMX = root.SIMX, { D, ev } = SIMX;
  // a rule per entry of data.js EVENTS.pool, every part optional: setup(R, E) as its floor is built; start(S, R, E) on «yes» (on E with
  // no question); step(S, R, E) every step while it runs; reward(S, R, E) as it ends. With no step it ends as it starts; a rule with a
  // step ends it by eventDone. The probe is the checks' and the QA's: never drawn (w 0), it ends at once
  const EVENT_RULES = { probe: {} };
  const eventsOf = (R) => R.events || [];
  function eventsBuild(R) {
    R.events = (R.map.events || []).map((e) => Object.assign({ st: 'idle' }, e));
    for (const E of R.events) { const F = EVENT_RULES[E.id]; if (F && F.setup) F.setup(R, E); } }
  const eventNear = (R) => { const h = R.hero; return eventsOf(R).find((E) => E.st === 'idle' && Math.hypot(E.x - h.x, E.y - h.y) < D.EVENTS.near) || null; };
  // «Нет» in focus, so Enter alone never takes a risk
  function eventUse(S, R, E) {
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
  function stepEvents(S, R) { for (const E of eventsOf(R)) if (E.st === 'on') { const F = EVENT_RULES[E.id]; if (F && F.step) F.step(S, R, E); } }
  Object.assign(SIMX, { EVENT_RULES, eventsOf, eventsBuild, eventNear, eventUse, eventStart, eventDone, stepEvents });
})(typeof window !== 'undefined' ? window : globalThis);
