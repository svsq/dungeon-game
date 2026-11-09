// live/data_forks.js — ability forks (R-02, TASKS 396): at ranks 3 and 6 each ability is taken one of two ways, on the powers' engine.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  Object.assign(D.POWERS, {
    f_whirl_3a: { id: 'f_whirl_3a', ab: 'whirl', name: TXT('POWERS.f_whirl_3a.name'), desc: TXT('POWERS.f_whirl_3a.desc'), trig: 'cast:whirl', fx: 'nova', k: 0.3, r: 130, kb: 0 },
    f_whirl_3b: { id: 'f_whirl_3b', ab: 'whirl', name: TXT('POWERS.f_whirl_3b.name'), desc: TXT('POWERS.f_whirl_3b.desc'), trig: 'cast:whirl', fx: 'heal', v: 0.03 },
    f_whirl_6a: { id: 'f_whirl_6a', ab: 'whirl', name: TXT('POWERS.f_whirl_6a.name'), desc: TXT('POWERS.f_whirl_6a.desc'), trig: 'cast:whirl', fx: 'stun', r: 125, t: 0.4, boss: 0.1 },
    f_whirl_6b: { id: 'f_whirl_6b', ab: 'whirl', name: TXT('POWERS.f_whirl_6b.name'), desc: TXT('POWERS.f_whirl_6b.desc'), trig: 'cast:whirl', fx: 'slow', r: 140, t: 2, slow: 0.6 },
    f_charge_3a: { id: 'f_charge_3a', ab: 'charge', name: TXT('POWERS.f_charge_3a.name'), desc: TXT('POWERS.f_charge_3a.desc'), trig: 'cast:charge', fx: 'mana', v: 0.2 },
    f_charge_3b: { id: 'f_charge_3b', ab: 'charge', name: TXT('POWERS.f_charge_3b.name'), desc: TXT('POWERS.f_charge_3b.desc'), trig: 'dashTouch', fx: 'strike', k: 0.4 },
    f_charge_6a: { id: 'f_charge_6a', ab: 'charge', name: TXT('POWERS.f_charge_6a.name'), desc: TXT('POWERS.f_charge_6a.desc'), trig: 'dashTouch', fx: 'stun', t: 0.8, boss: 0.2 },
    f_charge_6b: { id: 'f_charge_6b', ab: 'charge', name: TXT('POWERS.f_charge_6b.name'), desc: TXT('POWERS.f_charge_6b.desc'), trig: 'cast:charge', fx: 'burnGround', shape: 'line', gap: 40, k: 0.2, t: 1.5, per: 0.5 },
    f_cry_3a: { id: 'f_cry_3a', ab: 'cry', name: TXT('POWERS.f_cry_3a.name'), desc: TXT('POWERS.f_cry_3a.desc'), trig: 'cast:cry', fx: 'nova', k: 0.5, r: 200, kb: 0.6 },
    f_cry_3b: { id: 'f_cry_3b', ab: 'cry', name: TXT('POWERS.f_cry_3b.name'), desc: TXT('POWERS.f_cry_3b.desc'), trig: 'cast:cry', fx: 'mana', v: 0.25 },
    f_cry_6a: { id: 'f_cry_6a', ab: 'cry', name: TXT('POWERS.f_cry_6a.name'), desc: TXT('POWERS.f_cry_6a.desc'), trig: 'cast:cry', fx: 'slow', r: 200, t: 3, slow: 0.5 },
    f_cry_6b: { id: 'f_cry_6b', ab: 'cry', name: TXT('POWERS.f_cry_6b.name'), desc: TXT('POWERS.f_cry_6b.desc'), trig: 'cast:cry', fx: 'heal', v: 0.1 },
    f_fireball_3a: { id: 'f_fireball_3a', ab: 'fireball', name: TXT('POWERS.f_fireball_3a.name'), desc: TXT('POWERS.f_fireball_3a.desc'), trig: 'cast:fireball', fx: 'proj', dmg: 1.25, spd: 0.8 },
    f_fireball_3b: { id: 'f_fireball_3b', ab: 'fireball', name: TXT('POWERS.f_fireball_3b.name'), desc: TXT('POWERS.f_fireball_3b.desc'), trig: 'cast:fireball', fx: 'proj', spd: 1.4 },
    f_fireball_6a: { id: 'f_fireball_6a', ab: 'fireball', name: TXT('POWERS.f_fireball_6a.name'), desc: TXT('POWERS.f_fireball_6a.desc'), trig: 'cast:fireball', fx: 'mana', v: 0.06 },
    f_fireball_6b: { id: 'f_fireball_6b', ab: 'fireball', name: TXT('POWERS.f_fireball_6b.name'), desc: TXT('POWERS.f_fireball_6b.desc'), trig: 'cast:fireball', fx: 'heal', v: 0.02 },
    f_shield_3a: { id: 'f_shield_3a', ab: 'shield', name: TXT('POWERS.f_shield_3a.name'), desc: TXT('POWERS.f_shield_3a.desc'), trig: 'cast:shield', fx: 'shieldAdd', k: 0.3 },
    f_shield_3b: { id: 'f_shield_3b', ab: 'shield', name: TXT('POWERS.f_shield_3b.name'), desc: TXT('POWERS.f_shield_3b.desc'), trig: 'cast:shield', fx: 'shieldMore', t: 3 },
    f_shield_6a: { id: 'f_shield_6a', ab: 'shield', name: TXT('POWERS.f_shield_6a.name'), desc: TXT('POWERS.f_shield_6a.desc'), trig: 'shieldHit', fx: 'nova', k: 0.3, r: 80, kb: 0.5, icd: 1 },
    f_shield_6b: { id: 'f_shield_6b', ab: 'shield', name: TXT('POWERS.f_shield_6b.name'), desc: TXT('POWERS.f_shield_6b.desc'), trig: 'cast:shield', fx: 'slow', r: 200, t: 2, slow: 0.6 },
    f_frost_3a: { id: 'f_frost_3a', ab: 'frost', name: TXT('POWERS.f_frost_3a.name'), desc: TXT('POWERS.f_frost_3a.desc'), trig: 'cast:frost', fx: 'slow', r: 200, t: 4, slow: 0.45 },
    f_frost_3b: { id: 'f_frost_3b', ab: 'frost', name: TXT('POWERS.f_frost_3b.name'), desc: TXT('POWERS.f_frost_3b.desc'), trig: 'cast:frost', fx: 'nova', k: 0.3, r: 130, kb: 0.3 },
    f_frost_6a: { id: 'f_frost_6a', ab: 'frost', name: TXT('POWERS.f_frost_6a.name'), desc: TXT('POWERS.f_frost_6a.desc'), trig: 'cast:frost', fx: 'stun', r: 180, t: 0.5, boss: 0.1 },
    f_frost_6b: { id: 'f_frost_6b', ab: 'frost', name: TXT('POWERS.f_frost_6b.name'), desc: TXT('POWERS.f_frost_6b.desc'), trig: 'cast:frost', fx: 'mana', v: 0.1 },
    f_volley_3a: { id: 'f_volley_3a', ab: 'volley', name: TXT('POWERS.f_volley_3a.name'), desc: TXT('POWERS.f_volley_3a.desc'), trig: 'cast:volley', fx: 'proj', dmg: 1.2 },
    f_volley_3b: { id: 'f_volley_3b', ab: 'volley', name: TXT('POWERS.f_volley_3b.name'), desc: TXT('POWERS.f_volley_3b.desc'), trig: 'cast:volley', fx: 'proj', spd: 1.3 },
    f_volley_6a: { id: 'f_volley_6a', ab: 'volley', name: TXT('POWERS.f_volley_6a.name'), desc: TXT('POWERS.f_volley_6a.desc'), trig: 'cast:volley', fx: 'mana', v: 0.1 },
    f_volley_6b: { id: 'f_volley_6b', ab: 'volley', name: TXT('POWERS.f_volley_6b.name'), desc: TXT('POWERS.f_volley_6b.desc'), trig: 'cast:volley', fx: 'proj', kb: 2 },
    f_trap_3a: { id: 'f_trap_3a', ab: 'trap', name: TXT('POWERS.f_trap_3a.name'), desc: TXT('POWERS.f_trap_3a.desc'), trig: 'trapsnap', fx: 'nova', k: 0.3, r: 40, kb: 0 },
    f_trap_3b: { id: 'f_trap_3b', ab: 'trap', name: TXT('POWERS.f_trap_3b.name'), desc: TXT('POWERS.f_trap_3b.desc'), trig: 'trapsnap', fx: 'stun', r: 70, t: 1, boss: 0.3 },
    f_trap_6a: { id: 'f_trap_6a', ab: 'trap', name: TXT('POWERS.f_trap_6a.name'), desc: TXT('POWERS.f_trap_6a.desc'), trig: 'trapsnap', fx: 'dropTrap', k: 1, icd: 4 },
    f_trap_6b: { id: 'f_trap_6b', ab: 'trap', name: TXT('POWERS.f_trap_6b.name'), desc: TXT('POWERS.f_trap_6b.desc'), trig: 'trapsnap', fx: 'burnGround', k: 0.3, t: 2, per: 0.5 },
    f_leap_3a: { id: 'f_leap_3a', ab: 'leap', name: TXT('POWERS.f_leap_3a.name'), desc: TXT('POWERS.f_leap_3a.desc'), trig: 'cast:leap', fx: 'mana', v: 0.1 },
    f_leap_3b: { id: 'f_leap_3b', ab: 'leap', name: TXT('POWERS.f_leap_3b.name'), desc: TXT('POWERS.f_leap_3b.desc'), trig: 'cast:leap', fx: 'slow', r: 130, t: 2, slow: 0.6 },
    f_leap_6a: { id: 'f_leap_6a', ab: 'leap', name: TXT('POWERS.f_leap_6a.name'), desc: TXT('POWERS.f_leap_6a.desc'), trig: 'cast:leap', fx: 'burnGround', k: 0.25, t: 2, per: 0.5 },
    f_leap_6b: { id: 'f_leap_6b', ab: 'leap', name: TXT('POWERS.f_leap_6b.name'), desc: TXT('POWERS.f_leap_6b.desc'), trig: 'cast:leap', fx: 'nova', k: 0.5, r: 90, kb: 1 },
    th_warrior: { id: 'th_warrior', trig: 'hit', if: 'str25', fx: 'stun', t: 0.4, boss: 0.1, icd: 1.5 },
    th_mage: { id: 'th_mage', trig: 'cast:fireball', if: 'int25', fx: 'pierce', n: 1 },
  });
  const FORKS = {
    whirl: { 3: ['f_whirl_3a', 'f_whirl_3b'], 6: ['f_whirl_6a', 'f_whirl_6b'] },
    charge: { 3: ['f_charge_3a', 'f_charge_3b'], 6: ['f_charge_6a', 'f_charge_6b'] },
    cry: { 3: ['f_cry_3a', 'f_cry_3b'], 6: ['f_cry_6a', 'f_cry_6b'] },
    fireball: { 3: ['f_fireball_3a', 'f_fireball_3b'], 6: ['f_fireball_6a', 'f_fireball_6b'] },
    shield: { 3: ['f_shield_3a', 'f_shield_3b'], 6: ['f_shield_6a', 'f_shield_6b'] },
    frost: { 3: ['f_frost_3a', 'f_frost_3b'], 6: ['f_frost_6a', 'f_frost_6b'] },
    volley: { 3: ['f_volley_3a', 'f_volley_3b'], 6: ['f_volley_6a', 'f_volley_6b'] },
    trap: { 3: ['f_trap_3a', 'f_trap_3b'], 6: ['f_trap_6a', 'f_trap_6b'] },
    leap: { 3: ['f_leap_3a', 'f_leap_3b'], 6: ['f_leap_6a', 'f_leap_6b'] },
  };
  const FORK_RANKS = [3, 6];
  // a class's stat threshold (R-02): cheap reason to raise its main stat; the archer's is the second dash in sim_hero
  const STAT_POWER = { warrior: 'th_warrior', mage: 'th_mage' }, THRESHOLD = { warrior: ['str', 25, TXT('TH.warrior')], mage: ['int', 25, TXT('TH.mage')], archer: ['agi', 20, TXT('TH.archer')] };
  const forkKey = (ab, rank) => ab + ':' + rank;
  // the first choice this hero owes: a rank reached with no way picked
  const forkPending = (h) => { for (const A of D.clsOf(h).abs) for (const rank of FORK_RANKS) if ((h.ab[A.id] || 0) >= rank && FORKS[A.id] && !((h.forks || {})[forkKey(A.id, rank)] >= 0)) return { ab: A.id, rank }; return null; };
  Object.assign(D, { FORKS, FORK_RANKS, STAT_POWER, THRESHOLD, forkKey, forkPending });
})(typeof window !== 'undefined' ? window : globalThis);
