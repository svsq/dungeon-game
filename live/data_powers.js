// live/data_powers.js — the powers (R-21, TASKS 356): what changes how an ability or a blow plays, as data; live/sim_powers.js runs them.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data, no state; data.js checks the set.
// A power: trig — what fires it (hit, crit, kill, hurt, lowHp, cast:<ability>, dash, dashTouch, potion, scroll, roomClear, trapsnap,
// shieldEnd, shieldBreak, every:N for each N-th blow), if? — 'shield' while the hero's shield is up, each? — every each-th trigger, p? — the
// chance, icd? — seconds between firings, fx — what it does (sim_powers FX) with its numbers; cls or ab — whom it is for.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  // the fire's numbers are small on purpose: a ring of eight patches stands on what it burns, and a whole ring's worth a tick would be a second whirl
  const POWERS = {
    whirl_pull: { id: 'whirl_pull', name: TXT('POWERS.whirl_pull.name'), desc: TXT('POWERS.whirl_pull.desc'), ab: 'whirl', trig: 'cast:whirl', fx: 'pull', r: 200, to: 40 },
    whirl_ring: { id: 'whirl_ring', name: TXT('POWERS.whirl_ring.name'), desc: TXT('POWERS.whirl_ring.desc'), ab: 'whirl', trig: 'cast:whirl', fx: 'burnGround', shape: 'ring', n: 8, k: 0.25, t: 2, per: 0.5 },
    fire_split: { id: 'fire_split', name: TXT('POWERS.fire_split.name'), desc: TXT('POWERS.fire_split.desc'), ab: 'fireball', trig: 'cast:fireball', fx: 'split', a: 0.3, k: 0.5 },
    fire_pierce: { id: 'fire_pierce', name: TXT('POWERS.fire_pierce.name'), desc: TXT('POWERS.fire_pierce.desc'), ab: 'fireball', trig: 'cast:fireball', fx: 'pierce', n: 1 },
    shield_burst: { id: 'shield_burst', name: TXT('POWERS.shield_burst.name'), desc: TXT('POWERS.shield_burst.desc'), ab: 'shield', trig: 'shieldEnd', fx: 'shieldBurst', k: 1, r: 130, kb: 1 },
    shield_feed: { id: 'shield_feed', name: TXT('POWERS.shield_feed.name'), desc: TXT('POWERS.shield_feed.desc'), ab: 'shield', trig: 'kill', if: 'shield', fx: 'shieldMore', t: 1 },
    volley_pierce: { id: 'volley_pierce', name: TXT('POWERS.volley_pierce.name'), desc: TXT('POWERS.volley_pierce.desc'), ab: 'volley', trig: 'cast:volley', fx: 'pierce', n: 1 },
    trap_burst: { id: 'trap_burst', name: TXT('POWERS.trap_burst.name'), desc: TXT('POWERS.trap_burst.desc'), ab: 'trap', trig: 'trapsnap', fx: 'nova', k: 0.6, r: 90, kb: 0.4 },
    leap_trap: { id: 'leap_trap', name: TXT('POWERS.leap_trap.name'), desc: TXT('POWERS.leap_trap.desc'), ab: 'leap', trig: 'cast:leap', fx: 'dropTrap', k: 1.5 },
    dash_trail: { id: 'dash_trail', name: TXT('POWERS.dash_trail.name'), desc: TXT('POWERS.dash_trail.desc'), trig: 'dash', fx: 'burnGround', shape: 'line', gap: 40, k: 0.15, t: 1.5, per: 0.4, icd: 0.5 },
    dash_strike: { id: 'dash_strike', name: TXT('POWERS.dash_strike.name'), desc: TXT('POWERS.dash_strike.desc'), trig: 'dashTouch', fx: 'strike', k: 0.5 },
  };
  // a power is taken at an altar as a gift of its tier; `ab` keeps it to the class that has the ability (TASKS 391)
  const GIFT_OF = { whirl_pull: [2, 'ab_whirl'], whirl_ring: [3, 'ab_whirl'], fire_split: [3, 'ab_fire'], fire_pierce: [2, 'ab_fire'], shield_burst: [2, 'ab_shield'], shield_feed: [2, 'ab_shield'],
    volley_pierce: [2, 'ab_volley'], trap_burst: [2, 'ab_trap'], leap_trap: [3, 'ab_leap'], dash_trail: [3, 'it_boots'], dash_strike: [2, 'ab_charge'] };
  for (const [id, [tier, icon]] of Object.entries(GIFT_OF)) { const P = POWERS[id]; D.GIFTS.push({ id, tier, name: P.name, icon, desc: P.desc, power: 1, ab: P.ab }); }
  const hasPower = (h, id) => !!(h.powers || {})[id];
  // what an altar may offer this hero of a tier: not another class's power, not one for an ability not yet open, not one already held
  const giftPool = (h, tier) => D.liveFor(h, 'gifts', D.GIFTS).filter((g) => g.tier === tier && (!g.power || (!hasPower(h, g.id) && (!g.ab || ((h.ab || {})[g.ab] || 0) > 0))));
  Object.assign(D, { POWERS, giftPool, hasPower });
})(typeof window !== 'undefined' ? window : globalThis);
