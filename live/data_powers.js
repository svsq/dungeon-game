// live/data_powers.js — the powers (R-21, TASKS 356): what changes how an ability or a blow plays, as data; live/sim_powers.js runs them.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data, no state; data.js checks the set.
// A power: trig — what fires it (hit, crit, kill, hurt, lowHp, cast:<ability>, dash, dashTouch, potion, scroll, roomClear, trapsnap,
// shieldEnd, shieldHit, shieldBreak, chargeHit, every:N for each N-th blow), if? — 'shield' while the hero's shield is up, 'chilled' when the one it fired on is chilled, 'held' when it is stunned or held, 'dead' when the blow killed it, each? — every each-th trigger, p? — the
// chance, icd? — seconds between firings, fx — what it does (sim_powers FX) with its numbers; cls or ab — whom it is for.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  // the fire's numbers are small on purpose: a ring of eight patches stands on what it burns, and a whole ring's worth a tick would be a second whirl
  // the shatter (TASKS 1982): on the first monster it meets the ball bursts weaker and breaks into `n` shards over an `a` rad fan, each
  // a smaller ball of k of its damage that flies `life` s and bursts in full; shards never shatter again
  const SHARDS = { fx: 'shatter', n: 3, a: 0.52, k: 0.5, first: 0.7, life: 0.45 };
  const POWERS = {
    whirl_pull: { id: 'whirl_pull', name: TXT('POWERS.whirl_pull.name'), desc: TXT('POWERS.whirl_pull.desc'), ab: 'whirl', trig: 'cast:whirl', fx: 'pull', r: 200, to: 40 },
    whirl_ring: { id: 'whirl_ring', name: TXT('POWERS.whirl_ring.name'), desc: TXT('POWERS.whirl_ring.desc'), ab: 'whirl', trig: 'cast:whirl', fx: 'burnGround', shape: 'ring', n: 8, k: 0.25, t: 2, per: 0.5 },
    fire_split: { id: 'fire_split', name: TXT('POWERS.fire_split.name'), desc: TXT('POWERS.fire_split.desc'), ab: 'fireball', trig: 'cast:fireball', fx: 'split', a: 0.3, k: 0.5 },
    fire_pierce: { id: 'fire_pierce', name: TXT('POWERS.fire_pierce.name'), desc: TXT('POWERS.fire_pierce.desc'), ab: 'fireball', trig: 'cast:fireball', ...SHARDS },
    shield_burst: { id: 'shield_burst', name: TXT('POWERS.shield_burst.name'), desc: TXT('POWERS.shield_burst.desc'), ab: 'shield', trig: 'shieldEnd', fx: 'shieldBurst', k: 1, r: 130, kb: 1 },
    shield_feed: { id: 'shield_feed', name: TXT('POWERS.shield_feed.name'), desc: TXT('POWERS.shield_feed.desc'), ab: 'shield', trig: 'kill', if: 'shield', fx: 'shieldMore', t: 1 },
    volley_pierce: { id: 'volley_pierce', name: TXT('POWERS.volley_pierce.name'), desc: TXT('POWERS.volley_pierce.desc'), ab: 'volley', trig: 'cast:volley', fx: 'pierce', n: 1 },
    trap_burst: { id: 'trap_burst', name: TXT('POWERS.trap_burst.name'), desc: TXT('POWERS.trap_burst.desc'), ab: 'trap', trig: 'trapsnap', fx: 'nova', k: 0.6, r: 90, kb: 0.4 },
    leap_trap: { id: 'leap_trap', name: TXT('POWERS.leap_trap.name'), desc: TXT('POWERS.leap_trap.desc'), ab: 'leap', trig: 'cast:leap', fx: 'dropTrap', k: 1.5 },
    dash_trail: { id: 'dash_trail', name: TXT('POWERS.dash_trail.name'), desc: TXT('POWERS.dash_trail.desc'), trig: 'dash', fx: 'burnGround', shape: 'line', gap: 40, k: 0.15, t: 1.5, per: 0.4, icd: 0.5 },
    dash_strike: { id: 'dash_strike', name: TXT('POWERS.dash_strike.name'), desc: TXT('POWERS.dash_strike.desc'), trig: 'dashTouch', fx: 'strike', k: 0.5 },
    // the charge's, the cry's and the ice wave's (TASKS 1819)
    charge_quake: { id: 'charge_quake', name: TXT('POWERS.charge_quake.name'), desc: TXT('POWERS.charge_quake.desc'), ab: 'charge', trig: 'chargeHit', fx: 'stun', r: 110, t: 0.8, boss: 0.2 },
    charge_rend: { id: 'charge_rend', name: TXT('POWERS.charge_rend.name'), desc: TXT('POWERS.charge_rend.desc'), ab: 'charge', trig: 'chargeHit', fx: 'nova', k: 0.5, r: 90, kb: 1.2 },
    cry_mirror: { id: 'cry_mirror', name: TXT('POWERS.cry_mirror.name'), desc: TXT('POWERS.cry_mirror.desc'), ab: 'cry', trig: 'cast:cry', fx: 'mirror', t: 3, k: 0.6 },
    cry_push: { id: 'cry_push', name: TXT('POWERS.cry_push.name'), desc: TXT('POWERS.cry_push.desc'), ab: 'cry', trig: 'cast:cry', fx: 'shieldBurst', k: 0, r: 200, kb: 1 },
    frost_freeze: { id: 'frost_freeze', name: TXT('POWERS.frost_freeze.name'), desc: TXT('POWERS.frost_freeze.desc'), ab: 'frost', trig: 'cast:frost', fx: 'freeze', t: 1.5, boss: 0.3 },
    frost_brittle: { id: 'frost_brittle', name: TXT('POWERS.frost_brittle.name'), desc: TXT('POWERS.frost_brittle.desc'), ab: 'frost', trig: 'kill', if: 'chilled', fx: 'slow', r: 110, t: 3, slow: 0.5 },
    // the second pack (TASKS 2019): the warrior's blow and the abilities that had one or two powers each
    blow_echo: { id: 'blow_echo', name: TXT('POWERS.blow_echo.name'), desc: TXT('POWERS.blow_echo.desc'), cls: 'warrior', trig: 'every:3', fx: 'chain', n: 2, r: 140, k: 0.4 },
    blow_cinder: { id: 'blow_cinder', name: TXT('POWERS.blow_cinder.name'), desc: TXT('POWERS.blow_cinder.desc'), cls: 'warrior', trig: 'crit', fx: 'burnGround', k: 0.3, t: 2, per: 0.5, icd: 1 },
    blow_reap: { id: 'blow_reap', name: TXT('POWERS.blow_reap.name'), desc: TXT('POWERS.blow_reap.desc'), cls: 'warrior', trig: 'kill', fx: 'pull', r: 150, to: 20 },
    blow_finisher: { id: 'blow_finisher', name: TXT('POWERS.blow_finisher.name'), desc: TXT('POWERS.blow_finisher.desc'), cls: 'warrior', trig: 'hit', if: 'held', fx: 'strike', k: 0.4, kb: 0 },
    whirl_parry: { id: 'whirl_parry', name: TXT('POWERS.whirl_parry.name'), desc: TXT('POWERS.whirl_parry.desc'), ab: 'whirl', trig: 'cast:whirl', fx: 'mirror', t: 0.6, k: 0.6 },
    charge_again: { id: 'charge_again', name: TXT('POWERS.charge_again.name'), desc: TXT('POWERS.charge_again.desc'), ab: 'charge', trig: 'chargeHit', if: 'dead', fx: 'ready' },
    cry_call: { id: 'cry_call', name: TXT('POWERS.cry_call.name'), desc: TXT('POWERS.cry_call.desc'), ab: 'cry', trig: 'cast:cry', fx: 'pull', r: 260, to: 50 },
    fire_blaze: { id: 'fire_blaze', name: TXT('POWERS.fire_blaze.name'), desc: TXT('POWERS.fire_blaze.desc'), ab: 'fireball', trig: 'cast:fireball', fx: 'proj', blaze: 1, spell: 1, k: 0.25, t: 2, per: 0.5, fr: 30 },
    shield_mirror: { id: 'shield_mirror', name: TXT('POWERS.shield_mirror.name'), desc: TXT('POWERS.shield_mirror.desc'), ab: 'shield', trig: 'cast:shield', fx: 'mirror', t: 2, k: 0.5, spell: 1 },
    frost_step: { id: 'frost_step', name: TXT('POWERS.frost_step.name'), desc: TXT('POWERS.frost_step.desc'), ab: 'frost', trig: 'cast:frost', fx: 'recoil' },
    volley_chill: { id: 'volley_chill', name: TXT('POWERS.volley_chill.name'), desc: TXT('POWERS.volley_chill.desc'), ab: 'volley', trig: 'cast:volley', fx: 'proj', t: 2, slow: 0.6 },
    volley_bounce: { id: 'volley_bounce', name: TXT('POWERS.volley_bounce.name'), desc: TXT('POWERS.volley_bounce.desc'), ab: 'volley', trig: 'cast:volley', fx: 'proj', bounce: 1 },
    trap_lure: { id: 'trap_lure', name: TXT('POWERS.trap_lure.name'), desc: TXT('POWERS.trap_lure.desc'), ab: 'trap', trig: 'trapsnap', fx: 'pull', r: 170, to: 30 },
    trap_chain: { id: 'trap_chain', name: TXT('POWERS.trap_chain.name'), desc: TXT('POWERS.trap_chain.desc'), ab: 'trap', trig: 'trapsnap', fx: 'chain', n: 3, r: 160, k: 0.5 },
    leap_fan: { id: 'leap_fan', name: TXT('POWERS.leap_fan.name'), desc: TXT('POWERS.leap_fan.desc'), ab: 'leap', trig: 'cast:leap', fx: 'split', a: 0.25, k: 0.6 },
    leap_pierce: { id: 'leap_pierce', name: TXT('POWERS.leap_pierce.name'), desc: TXT('POWERS.leap_pierce.desc'), ab: 'leap', trig: 'cast:leap', fx: 'pierce', n: 5 },
    // the evolutions (TASKS 392): two powers held, the altar's dear card is this one
    ev_storm: { id: 'ev_storm', name: TXT('POWERS.ev_storm.name'), desc: TXT('POWERS.ev_storm.desc'), ab: 'whirl', trig: 'cast:whirl', fx: 'nova', k: 0.8, r: 150, fire: 1 },
    ev_comet: { id: 'ev_comet', name: TXT('POWERS.ev_comet.name'), desc: TXT('POWERS.ev_comet.desc'), ab: 'fireball', trig: 'cast:fireball', ...SHARDS, n: 5, a: 0.9 },
    ev_bulwark: { id: 'ev_bulwark', name: TXT('POWERS.ev_bulwark.name'), desc: TXT('POWERS.ev_bulwark.desc'), ab: 'shield', trig: 'shieldBreak', fx: 'nova', k: 1, spell: 1, r: 130, fire: 1 },
    ev_mines: { id: 'ev_mines', name: TXT('POWERS.ev_mines.name'), desc: TXT('POWERS.ev_mines.desc'), ab: 'trap', trig: 'trapsnap', fx: 'dropTrap', k: 1, icd: 2 },
    ev_shoulder: { id: 'ev_shoulder', name: TXT('POWERS.ev_shoulder.name'), desc: TXT('POWERS.ev_shoulder.desc'), trig: 'dashTouch', fx: 'nova', k: 0.5, r: 70, fire: 1 },
    ev_ram: { id: 'ev_ram', name: TXT('POWERS.ev_ram.name'), desc: TXT('POWERS.ev_ram.desc'), ab: 'charge', trig: 'chargeHit', fx: 'nova', k: 1, r: 140, kb: 2 },
    ev_roar: { id: 'ev_roar', name: TXT('POWERS.ev_roar.name'), desc: TXT('POWERS.ev_roar.desc'), ab: 'cry', trig: 'cast:cry', fx: 'stun', r: 200, t: 1.2, boss: 0.3 },
    ev_glacier: { id: 'ev_glacier', name: TXT('POWERS.ev_glacier.name'), desc: TXT('POWERS.ev_glacier.desc'), ab: 'frost', trig: 'kill', if: 'chilled', fx: 'nova', k: 0.6, spell: 1, r: 110, kb: 0.5 },
    // the kits' passives (TASKS 393): the same engine, carried from the first step of the run
    kit_axe: { id: 'kit_axe', trig: 'crit', fx: 'stun', t: 0.6, boss: 0.2, icd: 1 },
    kit_hammer: { id: 'kit_hammer', name: TXT('POWERS.kit_hammer.name'), desc: TXT('POWERS.kit_hammer.desc'), trig: 'every:4', fx: 'nova', k: 0.6, r: 90, kb: 1 },
    kit_wand: { id: 'kit_wand', trig: 'cast:fireball', fx: 'mana', v: 0.08 },
    kit_ash: { id: 'kit_ash', trig: 'kill', fx: 'burnGround', k: 0.3, t: 1.5, per: 0.5 },
    kit_long: { id: 'kit_long', name: TXT('POWERS.kit_long.name'), desc: TXT('POWERS.kit_long.desc'), trig: 'hit', p: 0.15, fx: 'slow', t: 2, slow: 0.6 },
    kit_cross: { id: 'kit_cross', trig: 'dash', fx: 'mana', v: 0.1, icd: 1 },
    // the relics (TASKS 1178): a dear tier of its own, a rule of the run changed
    rl_fifth: { id: 'rl_fifth', name: TXT('POWERS.rl_fifth.name'), desc: TXT('POWERS.rl_fifth.desc'), trig: 'kill', each: 5, fx: 'nova', k: 1.5, r: 130, kb: 1, fire: 1 },
    rl_scroll: { id: 'rl_scroll', name: TXT('POWERS.rl_scroll.name'), desc: TXT('POWERS.rl_scroll.desc'), trig: 'scroll', fx: 'heal', v: 1 },
    rl_pyre: { id: 'rl_pyre', name: TXT('POWERS.rl_pyre.name'), desc: TXT('POWERS.rl_pyre.desc'), trig: 'dash', fx: 'burnGround', shape: 'line', gap: 32, k: 0.4, t: 3, per: 0.4, icd: 0.5 },
    rl_maelstrom: { id: 'rl_maelstrom', name: TXT('POWERS.rl_maelstrom.name'), desc: TXT('POWERS.rl_maelstrom.desc'), ab: 'whirl', trig: 'cast:whirl', fx: 'pull', r: 380, to: 30 },
    rl_phalanx: { id: 'rl_phalanx', name: TXT('POWERS.rl_phalanx.name'), desc: TXT('POWERS.rl_phalanx.desc'), ab: 'shield', trig: 'shieldBreak', fx: 'shieldBurst', k: 0, r: 180, kb: 2 },
    rl_quiver: { id: 'rl_quiver', name: TXT('POWERS.rl_quiver.name'), desc: TXT('POWERS.rl_quiver.desc'), ab: 'volley', trig: 'every:4', fx: 'bolt', k: 0.7, r: 260, shot: 'arrow', icd: 0.15 },
  };
  // a power is taken at an altar as a gift of its tier; `ab` keeps it to the class that has the ability (TASKS 391)
  const GIFT_OF = { whirl_pull: [2, 'ab_whirl'], whirl_ring: [3, 'ab_whirl'], fire_split: [3, 'ab_fire'], fire_pierce: [2, 'ab_fire'], shield_burst: [2, 'ab_shield'], shield_feed: [2, 'ab_shield'],
    volley_pierce: [2, 'ab_volley'], trap_burst: [2, 'ab_trap'], leap_trap: [3, 'ab_leap'], dash_trail: [3, 'it_boots'], dash_strike: [2, 'ab_charge'],
    charge_quake: [2, 'ab_charge'], charge_rend: [3, 'ab_charge'], cry_mirror: [3, 'ab_cry'], cry_push: [2, 'ab_cry'], frost_freeze: [2, 'ab_frost'], frost_brittle: [3, 'ab_frost'],
    blow_echo: [3, 'it_sword'], blow_cinder: [2, 'bf_burn'], blow_reap: [2, 'it_axe'], blow_finisher: [3, 'it_hammer'], whirl_parry: [2, 'ab_whirl'], charge_again: [3, 'ab_charge'], cry_call: [2, 'ab_cry'],
    fire_blaze: [2, 'ab_fire'], shield_mirror: [3, 'ab_shield'], frost_step: [2, 'ab_frost'], volley_chill: [2, 'ab_volley'], volley_bounce: [3, 'ab_volley'], trap_lure: [2, 'ab_trap'], trap_chain: [3, 'ab_trap'],
    leap_fan: [2, 'ab_leap'], leap_pierce: [3, 'ab_leap'] };
  for (const [id, [tier, icon]] of Object.entries(GIFT_OF)) { const P = POWERS[id]; D.GIFTS.push({ id, tier, name: P.name, icon, desc: P.desc, power: 1, ab: P.ab, cls: P.cls }); }
  for (const [id, icon] of Object.entries({ rl_fifth: 'bf_burn', rl_scroll: 'it_hp', rl_pyre: 'bf_burn', rl_maelstrom: 'ab_whirl', rl_phalanx: 'ab_shield', rl_quiver: 'ab_volley' })) { const P = POWERS[id]; D.GIFTS.push({ id, tier: 4, relic: 1, name: P.name, icon, desc: P.desc, power: 1, ab: P.ab }); }
  for (const [id, needs, icon] of [['ev_storm', ['whirl_pull', 'whirl_ring'], 'ab_whirl'], ['ev_comet', ['fire_split', 'fire_pierce'], 'ab_fire'], ['ev_bulwark', ['shield_burst', 'shield_feed'], 'ab_shield'], ['ev_mines', ['trap_burst', 'leap_trap'], 'ab_trap'], ['ev_shoulder', ['dash_trail', 'dash_strike'], 'bf_burn'],
    ['ev_ram', ['charge_quake', 'charge_rend'], 'ab_charge'], ['ev_roar', ['cry_mirror', 'cry_push'], 'ab_cry'], ['ev_glacier', ['frost_freeze', 'frost_brittle'], 'ab_frost']]) { const P = POWERS[id]; D.GIFTS.push({ id, tier: 3, evo: 1, needs, name: P.name, icon, desc: P.desc, power: 1, ab: P.ab }); }
  // an epic's weak power (TASKS 359): one of the altar's own, fired by chance `k` of the times the full one would, so its numbers stay in one place;
  // its odds grow with the floor. The step back of frost_step is left out: at random it would take the hero's footing from the player
  const EPIC_POWER = { p: (f) => Math.min(0.4, 0.04 + 0.02 * f), k: 0.5, skip: ['frost_step'] };
  const epicPool = (cls) => Object.keys(GIFT_OF).filter((id) => { const P = POWERS[id]; return !EPIC_POWER.skip.includes(id) && (!P.cls || P.cls === cls) && (!P.ab || D.CLASSES[cls].abilities.includes(P.ab)); });
  const RELIC_MAX = 3, relicsOf = (h) => Object.keys(h.powers || {}).filter((id) => (D.GIFTS.find((g) => g.id === id) || {}).relic).length;
  const hasPower = (h, id) => !!(h.powers || {})[id];
  // an offer is rolled when its altar is first opened, the hero may have changed by the time he comes back to it
  const giftBlocked = (h, g) => (!g.power ? '' : hasPower(h, g.id) ? 'held' : g.relic && relicsOf(h) >= RELIC_MAX ? 'relics' : '');
  // what an altar may offer this hero of a tier: not another class's power (by its ability or its `cls`), not one for an ability not yet open, not one already held
  const giftPool = (h, tier, meta) => D.liveFor(h, 'gifts', D.GIFTS).filter((g) => g.tier === tier && isOpen(meta, 'gift', g.id) && !g.needs && (!g.power || (!hasPower(h, g.id) && (!g.cls || g.cls === D.clsOf(h).id) && (!g.ab || ((h.ab || {})[g.ab] || 0) > 0))));
  const evosReady = (h) => D.GIFTS.filter((g) => g.needs && !hasPower(h, g.id) && g.needs.every((id) => hasPower(h, id)));
  // a class's starting kits (TASKS 393): the first is the plain start, a weapon of its own class and a passive for the others
  const KITS = [
    { id: 'w_sword', cls: 'warrior', weapon: 'sword', name: TXT('KITS.w_sword.name'), desc: TXT('KITS.w_sword.desc') },
    { id: 'w_axe', cls: 'warrior', weapon: 'axe', power: 'kit_axe', name: TXT('KITS.w_axe.name'), desc: TXT('KITS.w_axe.desc') },
    { id: 'w_hammer', cls: 'warrior', weapon: 'hammer', power: 'kit_hammer', name: TXT('KITS.w_hammer.name'), desc: TXT('KITS.w_hammer.desc') },
    { id: 'm_staff', cls: 'mage', weapon: 'staff', name: TXT('KITS.m_staff.name'), desc: TXT('KITS.m_staff.desc') },
    { id: 'm_wand', cls: 'mage', weapon: 'wand', power: 'kit_wand', name: TXT('KITS.m_wand.name'), desc: TXT('KITS.m_wand.desc') },
    { id: 'm_ash', cls: 'mage', weapon: 'staff', power: 'kit_ash', name: TXT('KITS.m_ash.name'), desc: TXT('KITS.m_ash.desc') },
    { id: 'a_short', cls: 'archer', weapon: 'shortbow', name: TXT('KITS.a_short.name'), desc: TXT('KITS.a_short.desc') },
    { id: 'a_long', cls: 'archer', weapon: 'longbow', power: 'kit_long', name: TXT('KITS.a_long.name'), desc: TXT('KITS.a_long.desc') },
    { id: 'a_cross', cls: 'archer', weapon: 'crossbow', power: 'kit_cross', name: TXT('KITS.a_cross.name'), desc: TXT('KITS.a_cross.desc') },
  ];
  // the discoveries (TASKS 394): what enters a pool only once bought for shards or earned by a deed; the rest is in it from the start
  const ACHIEVE = [
    { id: 'a_elites', name: TXT('ACHIEVE.a_elites.name'), desc: TXT('ACHIEVE.a_elites.desc'), on: 'kill', test: (e) => !!e.elite, need: 25 },
    { id: 'a_bosses', name: TXT('ACHIEVE.a_bosses.name'), desc: TXT('ACHIEVE.a_bosses.desc'), on: 'kill', test: (e) => !!e.boss, need: 5 },
    { id: 'a_priests', name: TXT('ACHIEVE.a_priests.name'), desc: TXT('ACHIEVE.a_priests.desc'), on: 'kill', test: (e) => e.type === 'fire_priest', need: 10 },
  ];
  const UNLOCKS = [
    ...[['whirl_ring', 30], ['fire_split', 30], ['shield_feed', 30], ['leap_trap', 30], ['dash_strike', 30], ['rl_pyre', 60]].map(([ref, cost]) => ({ id: 'g_' + ref, kind: 'gift', ref, cost })),
    ...[['rl_maelstrom', 'a_elites'], ['rl_phalanx', 'a_bosses'], ['rl_quiver', 'a_priests']].map(([ref, ach]) => ({ id: 'g_' + ref, kind: 'gift', ref, ach })),
    ...[['w_axe', 40], ['w_hammer', 70], ['m_wand', 40], ['m_ash', 70], ['a_long', 40], ['a_cross', 70]].map(([ref, cost]) => ({ id: 'k_' + ref, kind: 'kit', ref, cost })),
  ];
  const isOpen = (meta, kind, ref) => { const U = UNLOCKS.find((q) => q.kind === kind && q.ref === ref); return !U || !!((meta || {}).open || {})[U.id]; };
  const kitsOf = (cls, meta) => KITS.filter((k) => k.cls === cls && (meta === undefined || isOpen(meta, 'kit', k.id)));
  const kitOf = (meta, cls) => { const list = kitsOf(cls, meta || {}), id = ((meta || {}).kit || {})[cls]; return list.find((k) => k.id === id) || list[0]; };
  // the codex (TASKS 395): what a page of it lists; an entry opens on first meeting (sim_unlocks)
  const CODEX_TABS = ['m', 'it', 'p'], CODEX_PAGE = 36;
  const codexList = (tab) => (tab === 'm' ? Object.keys(D.ENEMIES).map((k) => ({ k, name: D.ENEMIES[k].name })) : tab === 'it' ? Object.keys(D.BASES).map((k) => ({ k, name: D.BASES[k].name, icon: D.BASES[k].icon })) : D.GIFTS.filter((g) => g.power).map((g) => ({ k: g.id, name: g.name, icon: g.icon })));
  Object.assign(D, { SHARDS, EPIC_POWER, epicPool, CODEX_TABS, CODEX_PAGE, codexList, ACHIEVE, UNLOCKS, isOpen, KITS, kitsOf, kitOf, POWERS, giftPool, evosReady, hasPower, giftBlocked, RELIC_MAX, relicsOf });
})(typeof window !== 'undefined' ? window : globalThis);
