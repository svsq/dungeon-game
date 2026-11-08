// live/data_items.js — gear slots, bases, consumables, rarity, affixes, legendary names, level requirements, the merchant and prices.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  // equipment slots and bases. lvl scales with the floor where the item drops.
  const SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
  const SLOT_NAME = { weapon: TXT('SLOT_NAME.weapon'), offhand: TXT('SLOT_NAME.offhand'), helm: TXT('SLOT_NAME.helm'), armor: TXT('SLOT_NAME.armor'), gloves: TXT('SLOT_NAME.gloves'), boots: TXT('SLOT_NAME.boots'), ring: TXT('SLOT_NAME.ring'), amulet: TXT('SLOT_NAME.amulet') };
  // a base's classes (R-03, TASKS 1102): only they wear it, no `cls` — anyone; leather, the cloak, rings and amulets are anyone's.
  // The staff is the mage's alone (the player's decision, 1132)
  const WR = ['warrior'], MG = ['mage'], AR = ['archer'];
  const BASES = {
    sword: { slot: 'weapon', cls: WR, name: TXT('BASES.sword.name'), icon: 'it_sword', atk: 6, spd: 0.42, arc: 120, reach: 56 },
    longsword: { slot: 'weapon', cls: WR, name: TXT('BASES.longsword.name'), icon: 'it_longsword', atk: 6.5, spd: 0.44, arc: 130, reach: 66 },
    axe: { slot: 'weapon', cls: WR, name: TXT('BASES.axe.name'), icon: 'it_axe', atk: 7, spd: 0.46, arc: 140, reach: 61 },
    hammer: { slot: 'weapon', cls: WR, name: TXT('BASES.hammer.name'), icon: 'it_hammer', atk: 7.5, spd: 0.48, arc: 150, reach: 61, kb: 2 },
    staff: { slot: 'weapon', cls: MG, name: TXT('BASES.staff.name'), icon: 'it_staff', atk: 6, spd: 0.45, arc: 110, reach: 61, spell: 0.35 },
    shield: { slot: 'offhand', cls: WR, name: TXT('BASES.shield.name'), icon: 'it_shield', def: 4, w: 1 / 3 },
    buckler: { slot: 'offhand', cls: WR, name: TXT('BASES.buckler.name'), icon: 'it_buckler', def: 4, typed: { aspd: 0.6 }, w: 1 / 3 },
    tower_shield: { slot: 'offhand', cls: WR, name: TXT('BASES.tower_shield.name'), icon: 'it_shield_t', def: 4, typed: { hp: 0.5 }, minF: 3, w: 1 / 3 },
    leather_helm: { slot: 'helm', name: TXT('BASES.leather_helm.name'), icon: 'it_helm_l', def: 2, typed: { aspd: 0.6 } },
    knight_helm: { slot: 'helm', cls: WR, name: TXT('BASES.knight_helm.name'), icon: 'it_helm_k', def: 2, typed: { hp: 0.5 }, minF: 3 },
    leather_armor: { slot: 'armor', name: TXT('BASES.leather_armor.name'), icon: 'it_armor_l', def: 3, typed: { mspd: 0.8 } },
    plate_armor: { slot: 'armor', cls: WR, name: TXT('BASES.plate_armor.name'), icon: 'it_armor_p', def: 3, typed: { hp: 1 }, minF: 3 },
    gauntlets: { slot: 'gloves', cls: WR, name: TXT('BASES.gauntlets.name'), icon: 'it_gloves', def: 1, typed: { hp: 0.5 }, w: 1 / 2 },
    leather_gloves: { slot: 'gloves', name: TXT('BASES.leather_gloves.name'), icon: 'it_gloves_l', def: 1, typed: { aspd: 0.6 }, w: 1 / 2 },
    boots: { slot: 'boots', name: TXT('BASES.boots.name'), icon: 'it_boots', def: 1, typed: { mspd: 0.8 }, w: 1 / 2 },
    iron_boots: { slot: 'boots', cls: WR, name: TXT('BASES.iron_boots.name'), icon: 'it_boots_i', def: 1, typed: { hp: 0.5 }, minF: 3, w: 1 / 2 },
    ring: { slot: 'ring', name: TXT('BASES.ring.name'), icon: 'it_ring' },
    amulet: { slot: 'amulet', name: TXT('BASES.amulet.name'), icon: 'it_amulet' },
    cloak: { slot: 'armor', name: TXT('BASES.cloak.name'), icon: 'it_cloak', def: 3, typed: { mp: 1.4 } },
    // the mage's own (TASKS 1112): a wand quicker and lighter than the staff, an orb in the shield's hand, a robe and a circlet
    wand: { slot: 'weapon', cls: MG, name: TXT('BASES.wand.name'), icon: 'it_wand', atk: 6, spd: 0.36, arc: 100, reach: 51, spell: 0.25 },
    orb: { slot: 'offhand', cls: MG, name: TXT('BASES.orb.name'), icon: 'it_orb', def: 4, typed: { fire: 1 }, w: 1 / 3 },
    robe: { slot: 'armor', cls: MG, name: TXT('BASES.robe.name'), icon: 'it_robe', def: 3, typed: { int: 0.8 } },
    // the archer's own (TASKS 1122): bows shoot arrows (`shot`) and take their damage from AGI, not STR (`dex`); a quiver in the
    // shield's hand gives crit (the quiver on his back is his look whatever he holds)
    // the bows' AGI share grows with the draw (TASKS 1163: `dex` ∝ `spd`, a slower bow no longer a weaker one) and each has its own
    // arrow: the long bow's flies faster and farther (`shotV`, `shotL`), the crossbow's bolt goes through the first it strikes (`pierce`)
    shortbow: { slot: 'weapon', cls: AR, name: TXT('BASES.shortbow.name'), icon: 'it_bow_s', atk: 6, spd: 0.42, arc: 100, reach: 51, dex: 1.7, shot: 'arrow' },
    longbow: { slot: 'weapon', cls: AR, name: TXT('BASES.longbow.name'), icon: 'it_bow_l', atk: 6.5, spd: 0.48, arc: 100, reach: 51, dex: 1.94, shot: 'arrow', shotV: 1.2, shotL: 1.08, minF: 3 },
    crossbow: { slot: 'weapon', cls: AR, name: TXT('BASES.crossbow.name'), icon: 'it_crossbow', atk: 7.5, spd: 0.6, arc: 100, reach: 51, dex: 2.43, shot: 'arrow', pierce: 1, shotKb: 1.6, minF: 5 },
    quiver: { slot: 'offhand', cls: AR, name: TXT('BASES.quiver.name'), icon: 'it_quiver', def: 4, typed: { crit: 1 }, w: 1 / 3 },
    circlet: { slot: 'helm', cls: MG, name: TXT('BASES.circlet.name'), icon: 'it_circlet', def: 2, typed: { mp: 0.8 } },
  };
  // foreign: the share of drops, shelves and rewards that may be of another class; the rest is rolled again among the hero's own
  const CLASS_LOOT = { foreign: 0.15 };
  const wears = (cls, b) => { const B = BASES[b], C = D.CLASSES[cls] || D.CLASSES.warrior;
    return !B || !B.cls || B.cls.includes(cls) || (C.borrow || []).some((c) => B.cls.includes(c)); };
  const clsNames = (b) => ((BASES[b] || {}).cls || []).map((c) => D.CLASSES[c].name).join(', ');
  // BASES w: a base's share of the drops (default 1); the kinds of one slot split its share, so adding a kind does not make the slot drop more
  // BASES typed: the base's own bonus as a share of an average affix roll of that stat, so it grows with level and rarity like one
  // the floor generator's version (R-18): a floor kept by a run through the town is a diff against its rebuild, so a save made by
  // another generator cannot patch the floor it builds now; the version goes with each kept floor (3: the magma caves in the campaign
  // and the endless descent's pool, TASKS 416, laid other floors from 13 on; 4: the chasm's second bridge, the halls' pay and the
  // islet's rocks, TASKS 1054, other floors and chests from 13 on; 5: the floor modifiers, TASKS 381, the stairs up in the wall, 511)
  const GEN_VERSION = 5;
  const ITEM_BAL = { version: 2, atkLevel: 0.3, defLevel: 0.25, rarity: [1, 1.3, 1.7, 2.2, 2.9] };
  const CONSUMABLES = {
    hp_potion: { name: TXT('CONSUMABLES.hp_potion.name'), icon: 'it_hp', heal: 0.4, stack: 9 },
    mp_potion: { name: TXT('CONSUMABLES.mp_potion.name'), icon: 'it_mp', mana: 0.5, stack: 9 },
    scroll: { name: TXT('CONSUMABLES.scroll.name'), icon: 'it_scroll', stack: 5 },
  };
  const RARITY = [
    { id: 'common', name: TXT('RARITY.common.name'), col: [0.78, 0.76, 0.72], affixes: 0 },
    { id: 'uncommon', name: TXT('RARITY.uncommon.name'), col: [0.42, 0.86, 0.32], affixes: 1 },
    { id: 'rare', name: TXT('RARITY.rare.name'), col: [0.36, 0.62, 1.0], affixes: 2 },
    { id: 'epic', name: TXT('RARITY.epic.name'), col: [0.74, 0.38, 0.98], affixes: 3 },
    { id: 'legendary', name: TXT('RARITY.legendary.name'), col: [1.0, 0.6, 0.14], affixes: 4 },
  ];
  // affix: stat key, label (with {v}), per-level value range
  const AFFIXES = [
    { k: 'str', label: TXT('AFFIXES.str.label'), a: 1, b: 0.5 }, { k: 'agi', label: TXT('AFFIXES.agi.label'), a: 1, b: 0.5 },
    { k: 'int', label: TXT('AFFIXES.int.label'), a: 1, b: 0.5 }, { k: 'vit', label: TXT('AFFIXES.vit.label'), a: 1, b: 0.5 },
    { k: 'atk', label: TXT('AFFIXES.atk.label'), a: 2, b: 1.0 }, { k: 'def', label: TXT('AFFIXES.def.label'), a: 1, b: 0.6 },
    { k: 'crit', label: TXT('AFFIXES.crit.label'), a: 2, b: 0.4 }, { k: 'hp', label: TXT('AFFIXES.hp.label'), a: 8, b: 4 },
    { k: 'mp', label: TXT('AFFIXES.mp.label'), a: 5, b: 2 }, { k: 'aspd', label: TXT('AFFIXES.aspd.label'), a: 4, b: 0.8 },
    { k: 'mspd', label: TXT('AFFIXES.mspd.label'), a: 3, b: 0.5 }, { k: 'leech', label: TXT('AFFIXES.leech.label'), a: 1, b: 0.3 },
    { k: 'fire', label: TXT('AFFIXES.fire.label'), a: 6, b: 2 }, { k: 'dodge', label: TXT('AFFIXES.dodge.label'), a: 1, b: 0.25 },
    { k: 'regen', label: TXT('AFFIXES.regen.label'), a: 0.5, b: 0.15 }, { k: 'onhit', label: TXT('AFFIXES.onhit.label'), a: 0.5, b: 0.2 },
  ];
  // by base first: a legendary staff or axe must not be called a blade
  const LEGEND_NAMES = { sword: TXT('LEGEND_NAMES.sword'), longsword: TXT('LEGEND_NAMES.longsword'), axe: TXT('LEGEND_NAMES.axe'), hammer: TXT('LEGEND_NAMES.hammer'), staff: TXT('LEGEND_NAMES.staff'), wand: TXT('LEGEND_NAMES.wand'), shortbow: TXT('LEGEND_NAMES.shortbow'), longbow: TXT('LEGEND_NAMES.longbow'), crossbow: TXT('LEGEND_NAMES.crossbow'), quiver: TXT('LEGEND_NAMES.quiver'), orb: TXT('LEGEND_NAMES.orb'), robe: TXT('LEGEND_NAMES.robe'), circlet: TXT('LEGEND_NAMES.circlet'),
    cloak: TXT('LEGEND_NAMES.cloak'), weapon: TXT('LEGEND_NAMES.weapon'), offhand: TXT('LEGEND_NAMES.offhand'), helm: TXT('LEGEND_NAMES.helm'), armor: TXT('LEGEND_NAMES.armor'), gloves: TXT('LEGEND_NAMES.gloves'),
    boots: TXT('LEGEND_NAMES.boots'), ring: TXT('LEGEND_NAMES.ring'), amulet: TXT('LEGEND_NAMES.amulet') };

  // the fireball every 2.5 s, not 0.5: thrown at every recharge it adds about a third to a fight's damage; at 0.5–1.2 s a fire
  // build felled the bosses in 8–14 s (TASKS 245)
  // a newcomer's hints (TASKS 390): the whirl, shown with `n` foes awake within its reach and it ready, at most every `every` s, until
  // the player has whirled `until` times in all (the novice bot cast the fireball 34 times a run and the whirl once, and died to the
  // crypt's packs on the 3rd)

  // the hero's level a piece of gear asks (TASKS 1028): a little under its own, so a find of the floor the hero is on goes on at once
  // (the novice and average bots come to floor f at level 1, 3, 3, 5, 6, 7, 8, 9, 11, 12, 13, 15; the magma run's 15th-level hero finds
  // 15th–18th-level gear), while a piece kept in the town from a deep run waits: one of the 12th floor asks the 8th level
  const reqLvl = (it) => (!it || CONSUMABLES[it.b] ? 0 : Math.max(1, it.lvl - 2 - Math.floor(it.lvl / 6)));

  // the merchant: one per floor. A bot arrives at the 8th floor with ~6000 gold, so the showpiece (a rarity or two above what
  // drops there) costs most of a run's takings; loot sells back for an eighth, or selling alone would fund the shelf
  const SHOP = {
    gear: (f) => 4 + (f >= 4 ? 1 : 0),
    // the first piece on the shelf is the showpiece: at least this rarity
    best: (f) => Math.min(4, 2 + Math.floor(f / 3)),
    q: (f) => 1.4 + 0.15 * f,
    cons: (f) => [['hp_potion', 1 + Math.floor(f / 3)], ['mp_potion', 2 + Math.floor(f / 3)], ['scroll', 1 + (f >= 5 ? 1 : 0)]],
    // a legendary showpiece at 12× was bought on the 6th floor by every average run, and the 7th became the calmest floor (TASKS 216)
    rarK: [1, 2, 4, 7, 20],
    // selling keeps the old legendary 12×: a dearer showpiece must not make every legendary found worth more gold (209)
    sellK: [1, 2, 4, 7, 12],
    sell: 0.12, buyback: 4,
    // the town's shelf (TASKS 1010): the only steady source of potions and return scrolls in a run through the town, so it keeps
    // more of them than a floor's merchant did
    // a run through the town starts with a scroll of return (TASKS 1024): without it the first way home was a chest's 25 %, and the
    // average bot past the 8th fell from 70 to 25 % of runs, the merchant's gear and potions out of reach
    townStart: { scroll: 1 },
    townCons: (f) => [['hp_potion', 3 + Math.floor(f / 2)], ['mp_potion', 2 + Math.floor(f / 3)], ['scroll', 2 + Math.floor(f / 4)]],
    // the wandering merchant (TASKS 1010): in a run through the town a floor's merchant is a chance, from the 2nd floor on; his gear
    // is stocked `depth` floors deeper, a little better made, the showpiece a rarity up
    wander: { chance: 0.1, from: 2, depth: 2, q: 0.5, best: 1,
      lines: [TXT('SHOP.wander.lines'), TXT('SHOP.wander.lines.2'), TXT('SHOP.wander.lines.3'), TXT('SHOP.wander.lines.4')] },
    lines: [TXT('SHOP.lines'), TXT('SHOP.lines.2'), TXT('SHOP.lines.3'),
      TXT('SHOP.lines.4'), TXT('SHOP.lines.5')],
    hitLines: [TXT('SHOP.hitLines'), TXT('SHOP.hitLines.2'), TXT('SHOP.hitLines.3')],
    // in the town he calls the hero over from across the yard (TASKS 1015)
    calls: [TXT('SHOP.calls'), TXT('SHOP.calls.2'), TXT('SHOP.calls.3'), TXT('SHOP.calls.4')],
  };

  const CONS_PRICE = { hp_potion: (f) => 60 + 15 * f, mp_potion: (f) => 50 + 12 * f, scroll: (f) => 100 + 20 * f };
  const price = (it, f, rk) => (CONSUMABLES[it.b] ? CONS_PRICE[it.b](f) : Math.round((50 + 30 * it.lvl) * rk[it.rar] / 5) * 5);
  const itemPrice = (it, f) => price(it, f, SHOP.rarK);
  const sellPrice = (it, f) => Math.max(1, Math.floor(price(it, f, SHOP.sellK) * SHOP.sell));

  Object.assign(D, { CLASS_LOOT, wears, clsNames, SLOTS, SLOT_NAME, BASES, GEN_VERSION, ITEM_BAL, CONSUMABLES, RARITY, AFFIXES, LEGEND_NAMES, reqLvl, SHOP, itemPrice, sellPrice });
})(typeof window !== 'undefined' ? window : globalThis);
