// live/sim_unlocks.js — discoveries (TASKS 394): deeds counted across runs and what they and the shards open.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX, { D, ev } = SIMX;
  function openIt(S, U) { (S.meta.open = S.meta.open || {})[U.id] = 1; S.saveN++; const T = U.kind === 'gift' ? D.GIFTS.find((g) => g.id === U.ref) : D.KITS.find((k) => k.id === U.ref); if (S.run) S.run.msg = { s: TXT('hud.unlock.msg', { p1: T.name }), t: S.t, d: 4 }; }
  function metaEvent(S, e) { for (const A of D.ACHIEVE) { if (A.on !== e.k || !A.test(e)) continue; const n = ((S.meta.ach = S.meta.ach || {})[A.id] = (S.meta.ach[A.id] || 0) + 1); if (n >= A.need) for (const U of D.UNLOCKS) if (U.ach === A.id && !(S.meta.open || {})[U.id]) openIt(S, U); } }
  function buyUnlock(S, U, x, y) { if (!U.cost || (S.meta.open || {})[U.id]) return; if (S.meta.shards < U.cost) { ev(S, { k: 'nope', x, y, s: TXT('sim_ui.meta.s.2') }); return; } S.meta.shards -= U.cost; openIt(S, U); ev(S, { k: 'buy', x, y, id: U.id }); }
  Object.assign(SIMX, { metaEvent, buyUnlock });
})(typeof window !== 'undefined' ? window : globalThis);
