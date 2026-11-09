// live/data_powers.js — the powers (R-21, TASKS 356): what changes how an ability or a blow plays, as data; live/sim_powers.js runs them.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data, no state; data.js checks the set.
// A power: trig — what fires it (hit, crit, kill, hurt, lowHp, cast:<ability>, dash, dashTouch, potion, scroll, roomClear, trapsnap,
// shieldEnd, shieldBreak, every:N for each N-th blow), if? — 'shield' while the hero's shield is up, n? — every n-th trigger, p? — the
// chance, icd? — seconds between firings, fx — what it does (sim_powers FX) with its numbers; cls or ab — whom it is for.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const POWERS = {};
  Object.assign(D, { POWERS });
})(typeof window !== 'undefined' ? window : globalThis);
