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
    // the evolutions (TASKS 392): two powers held, the altar's dear card is this one
    ev_storm: { id: 'ev_storm', name: TXT('POWERS.ev_storm.name'), desc: TXT('POWERS.ev_storm.desc'), ab: 'whirl', trig: 'cast:whirl', fx: 'nova', k: 0.8, r: 150, fire: 1 },
    ev_comet: { id: 'ev_comet', name: TXT('POWERS.ev_comet.name'), desc: TXT('POWERS.ev_comet.desc'), ab: 'fireball', trig: 'cast:fireball', fx: 'split', a: 0.55, k: 0.4 },
    ev_bulwark: { id: 'ev_bulwark', name: TXT('POWERS.ev_bulwark.name'), desc: TXT('POWERS.ev_bulwark.desc'), ab: 'shield', trig: 'shieldBreak', fx: 'nova', k: 1, spell: 1, r: 130, fire: 1 },
    ev_mines: { id: 'ev_mines', name: TXT('POWERS.ev_mines.name'), desc: TXT('POWERS.ev_mines.desc'), ab: 'trap', trig: 'trapsnap', fx: 'dropTrap', k: 1, icd: 2 },
    ev_shoulder: { id: 'ev_shoulder', name: TXT('POWERS.ev_shoulder.name'), desc: TXT('POWERS.ev_shoulder.desc'), trig: 'dashTouch', fx: 'nova', k: 0.5, r: 70, fire: 1 },
    // the kits' passives (TASKS 393): the same engine, carried from the first step of the run
    kit_axe: { id: 'kit_axe', trig: 'crit', fx: 'stun', t: 0.6, boss: 0.2, icd: 1 },
    kit_hammer: { id: 'kit_hammer', trig: 'every:4', fx: 'nova', k: 0.6, r: 90, kb: 1 },
    kit_wand: { id: 'kit_wand', trig: 'cast:fireball', fx: 'mana', v: 0.08 },
    kit_ash: { id: 'kit_ash', trig: 'kill', fx: 'burnGround', k: 0.3, t: 1.5, per: 0.5 },
    kit_long: { id: 'kit_long', trig: 'hit', p: 0.15, fx: 'slow', t: 2, slow: 0.6 },
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
    volley_pierce: [2, 'ab_volley'], trap_burst: [2, 'ab_trap'], leap_trap: [3, 'ab_leap'], dash_trail: [3, 'it_boots'], dash_strike: [2, 'ab_charge'] };
  for (const [id, [tier, icon]] of Object.entries(GIFT_OF)) { const P = POWERS[id]; D.GIFTS.push({ id, tier, name: P.name, icon, desc: P.desc, power: 1, ab: P.ab }); }
  for (const [id, icon] of Object.entries({ rl_fifth: 'bf_burn', rl_scroll: 'it_hp', rl_pyre: 'bf_burn', rl_maelstrom: 'ab_whirl', rl_phalanx: 'ab_shield', rl_quiver: 'ab_volley' })) { const P = POWERS[id]; D.GIFTS.push({ id, tier: 4, relic: 1, name: P.name, icon, desc: P.desc, power: 1, ab: P.ab }); }
  for (const [id, needs, icon] of [['ev_storm', ['whirl_pull', 'whirl_ring'], 'ab_whirl'], ['ev_comet', ['fire_split', 'fire_pierce'], 'ab_fire'], ['ev_bulwark', ['shield_burst', 'shield_feed'], 'ab_shield'], ['ev_mines', ['trap_burst', 'leap_trap'], 'ab_trap'], ['ev_shoulder', ['dash_trail', 'dash_strike'], 'bf_burn']]) { const P = POWERS[id]; D.GIFTS.push({ id, tier: 3, evo: 1, needs, name: P.name, icon, desc: P.desc, power: 1, ab: P.ab }); }
  const RELIC_MAX = 3, relicsOf = (h) => Object.keys(h.powers || {}).filter((id) => (D.GIFTS.find((g) => g.id === id) || {}).relic).length;
  const hasPower = (h, id) => !!(h.powers || {})[id];
  // what an altar may offer this hero of a tier: not another class's power, not one for an ability not yet open, not one already held
  const giftPool = (h, tier, meta) => D.liveFor(h, 'gifts', D.GIFTS).filter((g) => g.tier === tier && isOpen(meta, 'gift', g.id) && !g.needs && (!g.power || (!hasPower(h, g.id) && (!g.ab || ((h.ab || {})[g.ab] || 0) > 0))));
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
  Object.assign(D, { CODEX_TABS, CODEX_PAGE, codexList, ACHIEVE, UNLOCKS, isOpen, KITS, kitsOf, kitOf, POWERS, giftPool, evosReady, hasPower, RELIC_MAX, relicsOf });
})(typeof window !== 'undefined' ? window : globalThis);
