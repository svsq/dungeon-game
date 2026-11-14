// live/data_hero.js — classes, abilities, stats, the meta upgrades, the altars' gifts, experience.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const TIPS = { whirl: { n: 3, every: 20, until: 5, s: TXT('TIPS.whirl.s') } };
  const ABILITIES = [
    { id: 'whirl', name: TXT('ABILITIES.whirl.name'), icon: 'ab_whirl', key: '1', unlock: 1, mp: 0, cd: 6, desc: TXT('ABILITIES.whirl.desc') },
    { id: 'fireball', name: TXT('ABILITIES.fireball.name'), icon: 'ab_fire', key: '2', unlock: 2, mp: 12, cd: 2.5, desc: TXT('ABILITIES.fireball.desc') },
    { id: 'shield', name: TXT('ABILITIES.shield.name'), icon: 'ab_shield', key: '3', unlock: 4, mp: 30, cd: 16, desc: TXT('ABILITIES.shield.desc') },
    { id: 'frost', name: TXT('ABILITIES.frost.name'), icon: 'ab_frost', key: '3', unlock: 4, mp: 20, cd: 8, desc: TXT('ABILITIES.frost.desc') },
    { id: 'charge', name: TXT('ABILITIES.charge.name'), icon: 'ab_charge', key: '2', unlock: 2, mp: 0, cd: 8, desc: TXT('ABILITIES.charge.desc') },
    { id: 'cry', name: TXT('ABILITIES.cry.name'), icon: 'ab_cry', key: '3', unlock: 4, mp: 40, cd: 20, desc: TXT('ABILITIES.cry.desc') },
    { id: 'volley', name: TXT('ABILITIES.volley.name'), icon: 'ab_volley', key: '1', unlock: 1, mp: 10, cd: 4, desc: TXT('ABILITIES.volley.desc') },
    { id: 'trap', name: TXT('ABILITIES.trap.name'), icon: 'ab_trap', key: '2', unlock: 2, mp: 15, cd: 8, desc: TXT('ABILITIES.trap.desc') },
    { id: 'leap', name: TXT('ABILITIES.leap.name'), icon: 'ab_leap', key: '3', unlock: 4, mp: 12, cd: 7, desc: TXT('ABILITIES.leap.desc') },
  ];
  // ten ranks at half the old per-rank gain: rank 10 lands a little past the old rank-5 cap instead of 1.7× it. Ranks 11–15 (TASKS 1349)
  // add damage only: the whirl's cooldown and both radii stop at rank 10, as 15 ranks of them made a 2.6 s whirl 200 px wide; the cry
  // keeps a quarter of its time gain, as its full gain outlasted its own cooldown
  // a critical blow (TASKS 1342): `k` times the damage, the crit-damage property adds to it up to `cap`, so stacking it on every slot stays bounded
  const CRIT = { k: 1.75, cap: 3 };
  // attack speed (TASKS 1977): one ceiling for every class, the player's call 13.11.2026; per point of agility. Every source adds to the base swing,
  // none on an already quickened one, yet at 1.2 a point and the affix's old flat 4 a mage stood at +64 % on floor 4 and an archer touched his swing's limit by floor 10
  const ASPD = { cap: 75, agi: 0.3 };
  const AB_MAX = 15;
  const abRank = (id, r) => { const n = Math.max(0, r - 1), m = Math.min(n, 9);
    return id === 'whirl' ? { k: 1.6 + 0.125 * n, cd: 1 - 0.04 * m, r: 118 + 6 * m } : id === 'frost' ? { k: 1 + 0.125 * n, cd: 1, r: FROST.r + 5 * m } : id === 'volley' || id === 'trap' || id === 'leap' || id === 'charge' ? { k: 1 + 0.125 * n, cd: 1 } : id === 'cry' ? { k: 1, cd: 1 - 0.03 * m, t: CRY.t + 0.5 * m + 0.25 * (n - m) } : id === 'fireball' ? { k: 1 + 0.125 * n, cd: 1 } : { k: 1 + 0.15 * n, cd: 1 }; };
  // about one elite's blow anywhere (TASKS 179), but slower to grow than the blows: INT, rank and floor all multiplied in made it
  // a second life bar, 688 on floor 8 against the hero's 588 (TASKS 199)
  // skill points past the last rank (TASKS 1349) turn into mastery by themselves, so none wait for a spend that can never come; 0.5% a point
  // keeps a dozen points under one rank of the altar's «dmg» (6%), as the endless descent has no last level to stop it
  const MASTERY = { pct: 0.5 }, ranksFull = (h) => clsOf(h).abs.every((a) => (h.ab[a.id] || 0) >= AB_MAX), masteryK = (h) => (h.mast || 0) * MASTERY.pct / 100;
  const masteryTake = (h) => { if (h.sp > 0 && ranksFull(h)) { h.mast = (h.mast || 0) + h.sp; h.sp = 0; } };
  const SHIELD_T = 10, shieldHp = (int, r, f) => Math.round((24 + int * 2) * abRank('shield', r).k * (1 + 0.2 * (f - 1)));
  // a swing with INT for STR: the weapon in hand plus 1.6 per INT (stats: spellBase), so it grows with the gear as a swing does
  // and a strength build keeps casting deep down (TASKS 203); its bonuses add up into one sum (stats: spell). INT counted twice,
  // fire %, rank and floor all multiplied in made one fireball take 1800 on the 8th on hard, seven swings (TASKS 245)
  const FIRE_K = 1.5;
  // the mage's ice wave (TASKS 1110): a cone before him, `arc` degrees wide and `r` deep, that hurts everyone in it at `dmg` of a
  // fireball's sum (it hits a crowd, the ball one) and slows them to `slow` of their pace for `t` s: room to step back and shoot
  const FROST = { r: 190, arc: 80, dmg: 0.8, slow: 0.6, t: 3 };
  const frostDmg = (base, k, spell) => Math.round(base * k * spell * FROST.dmg);
  // the mage's staff shoots (TASKS 1110, R-24): a bolt at the swing's hit frame instead of the blade's arc, at the swing's damage, no mana
  // t: it leaves when the staff points at the target (raised by 0.2 s, TASKS 1115 critic: at the swing's 0.13 s it left a staff still
  // pointing sideways); tip: from the crystal, this far along the aim past the hand
  const BOLT = { spd: 620, life: 0.7, r: 7, kb: 0.6, t: 0.2, tip: 34 };
  // a weapon's shot by its base's `shot` (TASKS 1120): the staff's bolt, a bow's arrow (drawn at 0.18 s, quicker and lighter)
  const SHOTS = { bolt: Object.assign({ k: 'bolt' }, BOLT), arrow: { k: 'arrow', spd: 760, life: 0.6, r: 6, kb: 0.4, t: 0.18, tip: 26 } };
  // the archer's abilities (TASKS 1120): the volley's fan (n arrows over `arc` degrees at `k` of a shot each); the trap (`root` s held,
  // a boss `boss` s, at `k` of a shot, armed after `arm` s, `max` set at once, gone after `life` s); the leap (back as a dash, a shot at `k`)
  // the warrior's rage (TASKS 1130, the player's decision 1101): his resource instead of mana, `max` at most; it grows `hit` a blow he
  // lands and `hurt` a share of his health a blow takes (×100), and drains `decay` a second once `calm` s pass with no blow either way
  // a shot that strikes a caster or an archer in its wind-up breaks it off (TASKS 1155): the answer of both ranged classes to
  // what shoots back; once per `every` s a monster, so a steady stream does not lock one in place
  const HUSH = { kinds: ['caster', 'archer'], cd: 0.5, every: 2.5 };
  // a staff's or wand's attack per INT against STR's or AGI's (TASKS 1140: at 1 the mage's range won 78 % against the warrior's 48 %)
  // (TASKS 1156: `MAGE_SPELL` of the fire on his gear and the arcane gift reaches the bolt, so what he wears grows his main attack; INT's
  // share is cut from 0.8 to 0.76 to hold his power level, which the player did not ask to raise)
  const MAGE_ATK = 0.76, MAGE_SPELL = 0.5;
  // STR for the classes that shoot (TASKS 1913, the player's call 13.11.2026: no stat may do nothing): `atk`, its share of the main stat's
  // 1.6 a point on the shot (the archer's AGI gives 1.7–2.4 of it, the mage's INT 0.76, so STR stays the lesser buy); `poise`, the mage's
  // % a point off a blow's shove and off its chance to break a scroll's reading, his only casting a blow can break; at most POISE.cap
  const POISE = { cap: 50 };
  // (TASKS 1184: the bar filled in seconds and only unlocked cooldowns: now what is held adds `dmg` of damage per 10 rage, so the cry's 40 is a price)
  // `guard`: the share of a monster's blow full rage takes off (TASKS 1140: without the town the melee warrior won 29 % to the archer's 94 %)
  const RAGE = { max: 100, hit: 6, hurt: 1.2, decay: 12, calm: 4, charge: 14, dmg: 0.015, guard: 0.35 };
  // the charge: a rush down the aim at `spd` for `t` s (~200 px) that strikes the first monster in its way at `k` of a swing, stuns it
  // `stun` s (a boss `boss` s); the war cry: monsters within `r` deal `weak` of their damage, the warrior `buff` more, for `t` s
  const CHARGE = { spd: 900, t: 0.22, k: 1.5, stun: 1, boss: 0.4, miss: 3, prep: 0.06 }, CRY = { r: 200, weak: 0.7, buff: 1.2, t: 6 };
  // the volley's fan closes on the cursor (TASKS 1161): `w` px across where it points, at most `arc`°, at least `min`°; the trap is set at
  // the cursor within `far` px and holds the monster's blow as well as its feet; the leap carries him `spd` × the dash's time; the fan leaves `loose` s after the key
  const VOLLEY = { n: 5, arc: 50, min: 4, w: 36, k: 0.7, loose: 0.13 }, TRAP = { r: 22, root: 2, boss: 1, k: 1.5, arm: 0.4, max: 2, life: 30, far: 250, toss: 0.25 }, LEAP = { k: 2, spd: 1000 };
  const fireDmg = (base, k, spell) => Math.round(base * k * spell * FIRE_K);
  // a class (R-03, TASKS 1100): base stats, the gain per level, its three abilities on keys 1–3 with their unlock levels, the
  // right click's ability, `shoots`: the weapons it fires from instead of swinging, the starting gear and the look (`look`: the rig's and the textures' name; `ready`: its own art is in,
  // the class screen of 1103 lists only those; `sat`: the paint's saturation under the light, the warrior's 0.8 kept his steel off the
  // fire's orange and greyed the mage's blue); `borrow`: the classes whose gear it wears while it has none of its own (1102). Mage and archer hold the warrior's kit until their tasks (1110–1124) give them theirs
  const CLASSES = {
    warrior: { name: TXT('CLASSES.warrior.name'), style: TXT('CLASSES.warrior.style'), base: { str: 5, agi: 4, int: 3, vit: 5 }, grow: { hp: 6, mp: 2, pts: 5, sp: 1 },
      abilities: ['whirl', 'charge', 'cry'], unlock: [1, 2, 4], rclick: 'charge', res: 'rage', start: { weapon: 'sword', armor: 'leather_armor' }, look: { rig: 'hero', ready: 1 } },
    // the mage (1111): INT for STR, less health and more mana a level; two knobs on INT for the round-2 lag (TASKS 217: the INT bot
    // won 30 % against 57 %), `intK.spell` (spell power per INT) or `intK.hp` (health per INT), the one to keep chosen by 1140's runs
    mage: { name: TXT('CLASSES.mage.name'), style: TXT('CLASSES.mage.style'), base: { str: 3, agi: 4, int: 7, vit: 3 }, grow: { hp: 4, mp: 4, pts: 5, sp: 1 }, intK: { spell: 0, hp: 0 }, strK: { atk: 0.3, poise: 2 },
      abilities: ['fireball', 'shield', 'frost'], unlock: [1, 2, 4], shoots: ['staff', 'wand'], rclick: 'fireball', start: { weapon: 'staff', armor: 'robe' }, look: { rig: 'mage', ready: 1, sat: 1, eye: [13.3, 5.9] } },
    // the archer's mana comes from his arrows (TASKS 1162: `hitMp` a hit, a crit; the pool held on potions); `slow` the share of his
    // shot's cycle he is slowed after it, so a quick bow does not keep him slow
    archer: { name: TXT('CLASSES.archer.name'), style: TXT('CLASSES.archer.style'), base: { str: 3, agi: 6, int: 3, vit: 5 }, grow: { hp: 7, mp: 3, pts: 5, sp: 1 },
      abilities: ['volley', 'trap', 'leap'], unlock: [1, 2, 4], shoots: ['shortbow', 'longbow', 'crossbow'], rclick: 'volley', strK: { atk: 0.4 }, hitMp: { hit: 1, crit: 3 }, slow: 0.4, start: { weapon: 'shortbow', armor: 'leather_armor' }, look: { rig: 'archer', ready: 1, sat: 0.65, cold: { sat: 0.8, lift: 0.8 } } },
  };
  // what does nothing for a class is not offered to it (TASKS 1185): altar gifts and ranks, item properties, consumables. The mage's and
  // the archer's sweep only breaks pots, so a blow's reach and arc are dead for them; the warrior's rage has no use for mana, INT or fire
  // a deep test run's kit is written in the warrior's gear (data_runs RUNS kit): each class wears its own of the same slot and rarity (PR 36 review)
  CLASSES.mage.kit = { longsword: 'staff', shield: 'orb', knight_helm: 'circlet', plate_armor: 'robe', gauntlets: 'leather_gloves', iron_boots: 'boots' };
  CLASSES.archer.kit = { longsword: 'shortbow', shield: 'quiver', knight_helm: 'leather_helm', plate_armor: 'leather_armor', gauntlets: 'leather_gloves', iron_boots: 'boots' };
  Object.assign(CLASSES.warrior, { note: TXT('CLASSES.warrior.note'), resWord: TXT('CLASSES.warrior.resWord'), dead: { gifts: ['wisdom', 'arcane'], meta: ['mana'], mods: ['int', 'mp', 'fire'], cons: ['mp_potion'] } });
  Object.assign(CLASSES.mage, { note: TXT('CLASSES.mage.note'), resWord: TXT('CLASSES.mage.resWord'), dead: { gifts: ['reach', 'cleave'], meta: [], mods: [], cons: [] } });
  Object.assign(CLASSES.archer, { note: TXT('CLASSES.archer.note'), resWord: TXT('CLASSES.archer.resWord'), dead: { gifts: ['reach', 'cleave', 'arcane'], meta: [], mods: ['fire'], cons: [] } });
  for (const [id, C] of Object.entries(CLASSES)) C.id = id, C.abs = C.abilities.map((id, i) => Object.assign({}, ABILITIES.find((a) => a.id === id), { key: String(i + 1), unlock: C.unlock[i] }));
  // the classes whose own look is in (TASKS 1103): only they are offered at a new run
  const classesReady = () => Object.keys(CLASSES).filter((k) => CLASSES[k].look.ready);
  const clsOf = (h) => CLASSES[(h && h.cls) || 'warrior'] || CLASSES.warrior;
  const liveFor = (h, kind, list, key = (q) => q.id) => { const no = clsOf(h).dead[kind]; return list.filter((q) => !no.includes(key(q))); };
  const metaFor = (cls) => liveFor({ cls }, 'meta', META);
  const statFull = (h, s) => (clsOf(h).statFull || {})[s.k] || s.full;

  CLASSES.mage.statFull = { str: TXT('STATS.str.full.mage') }; CLASSES.archer.statFull = { str: TXT('STATS.str.full.archer') };
  const STATS = [
    { k: 'str', name: TXT('STATS.str.name'), full: TXT('STATS.str.full') },
    { k: 'agi', name: TXT('STATS.agi.name'), full: TXT('STATS.agi.full') },
    { k: 'int', name: TXT('STATS.int.name'), full: TXT('STATS.int.full') },
    { k: 'vit', name: TXT('STATS.vit.name'), full: TXT('STATS.vit.full') },
  ];

  const metaLine = (M, r) => { const f = (k) => (M.neg ? '−' : '+') + M.v(k) + (M.pct ? '%' : ''), n = r && r < M.max ? r + 1 : Math.max(1, r);
    return (r && r < M.max ? f(r) + '  →  ' : '') + f(n) + ' ' + M.unit(M.v(n)); };
  // first ranks twice the old price, each step after three quarters of it: at 10–25 shards a won run bought five first ranks and
  // the next run was won before the rest of the ~1400 mattered (TASKS 202)
  // the bag (TASKS 1687): 24 cells, and up to three pouches of 16 bought at the Altar of souls, each its own tab as in Grim Dawn;
  // the pouches are kept in the meta, so every hero after the purchase carries them
  const BAG = { start: 24, pouch: 16, max: 3 }, bagLen = (up) => BAG.start + BAG.pouch * Math.min(BAG.max, (up && up.pouch) || 0);
  const META = [
    // v(r): the total bonus at rank r, so the altar shows what is owned and what the next rank brings; unit(n) agrees with n
    { id: 'hp', name: TXT('META.hp.name'), v: (r) => 12 * r, unit: () => TXT('META.hp.unit'), max: 5, cost: (r) => 30 + r * 11 },
    { id: 'dmg', name: TXT('META.dmg.name'), v: (r) => 6 * r, pct: 1, unit: () => TXT('META.dmg.unit'), max: 5, cost: (r) => 40 + r * 15 },
    { id: 'potion', name: TXT('META.potion.name'), v: (r) => r, unit: (n) => TXT('META.potion.unit', { p1: TXT.n('META.potion.unit.2', n) }), max: 3, cost: (r) => 30 + r * 15 },
    { id: 'gold', name: TXT('META.gold.name'), v: (r) => 15 * r, pct: 1, unit: () => TXT('META.gold.unit'), max: 3, cost: (r) => 20 + r * 10 },
    { id: 'stat', name: TXT('META.stat.name'), v: (r) => 2 * r, unit: (n) => TXT('META.stat.unit', { p1: TXT.n('META.stat.unit.2', n) }), max: 3, cost: (r) => 50 + r * 19 },
    { id: 'mana', name: TXT('META.mana.name'), v: (r) => 10 * r, unit: () => TXT('META.mana.unit'), max: 3, cost: (r) => 30 + r * 11 },
    { id: 'regen', name: TXT('META.regen.name'), v: (r) => 0.5 * r, unit: () => TXT('META.regen.unit'), max: 3, cost: (r) => 40 + r * 15 },
    { id: 'gear', name: TXT('META.gear.name'), v: (r) => r, unit: () => TXT('META.gear.unit'), max: 2, cost: (r) => 80 + r * 30 },
    { id: 'skill', name: TXT('META.skill.name'), v: (r) => r, unit: (n) => TXT('META.skill.unit', { p1: TXT.n('META.skill.unit.2', n) }), max: 2, cost: (r) => 60 + r * 22 },
    { id: 'pouch', name: TXT('META.pouch.name'), v: (r) => r, unit: (n) => TXT('META.pouch.unit', { p1: TXT.n('META.pouch.unit.2', n), n: BAG.pouch }), max: BAG.max, cost: (r) => 60 + r * 40 },
    { id: 'resist', name: TXT('META.resist.name'), v: (r) => 15 * r, pct: 1, neg: 1, unit: () => TXT('META.resist.unit'), max: 3, cost: (r) => 40 + r * 15 },
  ];
  // quests (R-17, TASKS 1017): a run's tasks, taken and turned in in the town, gone with the hero. A template: kind (side: a
  // townsman's; story: the Keeper's chain, 1022), type (what counts: kill — monsters slain on floor f or deeper, `elite` only
  // elites; reach — floor f reached; boss — a chapter's boss slain; clear — rooms cleared to the last monster on floor f or deeper;
  // named — the named foe put on floor f slain (1019); fetch — the keepsake put on floor f picked up (1020); room — the marked room
  // of floor f cleared, or the room's event done (1021)), need(f), its words and its reward kinds; the reward grows with its floor.
  // `fresh`: the goal is put on floor f when it is first built, so f must be a floor not yet reached and no boss's (`noBoss`)

  // a dungeon altar's gifts: it offers one of each tier, takes shards from the meta bank and gives one gift for the rest of the
  // run (the blessing only for the floor), then goes dark. v is the bonus per gift taken
  // tag: the HUD chip's text when the desc does not start with the number ({v} the total value, {n} how many taken)
  const GIFTS = [
    { id: 'bless', tier: 1, name: TXT('GIFTS.bless.name'), icon: 'bf_bless', v: 20 },
    { id: 'vigor', tier: 1, name: TXT('GIFTS.vigor.name'), icon: 'it_armor_p', v: 20 },
    { id: 'wisdom', tier: 1, name: TXT('GIFTS.wisdom.name'), icon: 'it_mp', v: 20 },
    { id: 'alert', tier: 1, name: TXT('GIFTS.alert.name'), icon: 'it_ring', v: 5 },
    { id: 'reach', tier: 1, name: TXT('GIFTS.reach.name'), icon: 'it_longsword', v: 12 },
    { id: 'thrift', tier: 1, name: TXT('GIFTS.thrift.name'), icon: 'it_hp', v: 30, tag: '+{v}%' },
    { id: 'swift', tier: 2, name: TXT('GIFTS.swift.name'), icon: 'it_boots', v: 10 },
    { id: 'haste', tier: 2, name: TXT('GIFTS.haste.name'), icon: 'it_gloves', v: 6 },
    { id: 'ward', tier: 2, name: TXT('GIFTS.ward.name'), icon: 'it_shield', v: 6 },
    { id: 'crit', tier: 2, name: TXT('GIFTS.crit.name'), icon: 'it_ring', v: 8 },
    { id: 'cleave', tier: 2, name: TXT('GIFTS.cleave.name'), icon: 'ab_whirl', v: 25 },
    { id: 'feast', tier: 2, name: TXT('GIFTS.feast.name'), icon: 'it_axe', v: 3, tag: '{v}%' },
    { id: 'thorns', tier: 2, name: TXT('GIFTS.thorns.name'), icon: 'it_buckler', v: 30 },
    { id: 'fury', tier: 3, name: TXT('GIFTS.fury.name'), icon: 'it_sword', v: 15 },
    { id: 'leech', tier: 3, name: TXT('GIFTS.leech.name'), icon: 'it_amulet', v: 4 },
    { id: 'arcane', tier: 3, name: TXT('GIFTS.arcane.name'), icon: 'ab_fire', v: 25 },
    { id: 'life', tier: 3, name: TXT('GIFTS.life.name'), icon: 'crystal', v: 1.5 },
    { id: 'phoenix', flat: 1, tier: 3, name: TXT('GIFTS.phoenix.name'), icon: 'bf_burn', v: 50, tag: '×{n}' },
    { id: 'execute', tier: 3, name: TXT('GIFTS.execute.name'), icon: 'it_hammer', v: 60 },
  ];
  // a number written into the text as well as in v drifted from it: the HUD had to find it there to sum the altars' gifts, and kept its dot (TASKS 1900)
  const giftDesc = (G, n = 1) => TXT('GIFTS.' + G.id + '.desc', { v: G.v * n });
  for (const G of GIFTS) G.desc = giftDesc(G);
  // an altar stands on every second floor, so it is paid from two floors' takings: a bot reaches the floor-2 altar with ~12 shards,
  // so the middle gift is within reach at every altar (TASKS 183), the dear one takes three floors or more
  const giftCost = (tier, f) => Math.round([0, 4, 9, 16, 40][tier] * (1 + 0.15 * (f - 1)));

  // (TASKS 389) each change within one visit dearer than the last: a way to look for a build, not to shop the whole pool
  const rerollCost = (n, f) => Math.round((3 + 2 * n) * (1 + 0.15 * (f - 1)));

  const xpNeed = (lvl) => Math.round(66 * Math.pow(lvl, 1.7));
  // the hero's own name (TASKS 1879): typed on the start screen or thrown on the die. One list for every hero until a hero has a sex
  // (1880), then a list per sex under its own key; a run from before names, or a test's, goes by its class
  const NAME_MAX = 14, NAME_CHAR = /^[A-Za-z\u0410-\u044f\u0401\u0451' -]$/;
  const heroNames = () => TXT('HERO.names.any').split(', ');
  const heroName = (h) => (h && h.name) || clsOf(h).name;

  Object.assign(D, { TIPS, CLASSES, clsOf, NAME_MAX, NAME_CHAR, heroNames, heroName, liveFor, metaFor, statFull, classesReady, ABILITIES, CRIT, ASPD, AB_MAX, abRank, MASTERY, masteryK, masteryTake, SHIELD_T, shieldHp, fireDmg, FROST, frostDmg, BOLT, SHOTS, MAGE_ATK, MAGE_SPELL, POISE, HUSH, VOLLEY, TRAP, LEAP, RAGE, CHARGE, CRY, STATS, metaLine, META, BAG, bagLen, GIFTS, giftDesc, giftCost, rerollCost, xpNeed });
})(typeof window !== 'undefined' ? window : globalThis);
