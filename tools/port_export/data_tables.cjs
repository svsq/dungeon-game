// Where each DATA table goes in the port's data folder. `records` writes one file per entry (`<domain>/<table>/<id>.json`,
// the entry's key or `id` becomes its `id`), `table` writes the whole table into `<domain>/<table>.json`. A table can
// also move one of its fields out as records (`recordsField`). Tables whose entries feed a weighted pick or an index
// stay whole, so their order stays in the file. A name of DATA missing here and in the function plan stops the export.

const RECORDS = 'records', TABLE = 'table';

const DOMAINS = {
  core: { TILE: TABLE, ZOOM: TABLE, ZOOMS: TABLE, SETTINGS: TABLE, SAVE_SLOTS: TABLE },
  balance: { BAL: TABLE, DIFF: TABLE, DIFF_ORDER: TABLE },
  world: {
    ARCH: TABLE, HAZ: TABLE, BRINK: TABLE, EVENTS: TABLE, FLOOR_MOD: TABLE, FLOOR_MODS: TABLE, ROOM_SHAPES: TABLE,
    ROOM_PLANS: TABLE, CAVE_PACKS: TABLE, MAGMA_PACKS: TABLE, MAGMA_HALLS: TABLE, PROP_W: TABLE, PROP_H: TABLE,
    PROP_MAT: TABLE, STATUE_SECRET: TABLE, SHELF_SECRET: TABLE, COFFIN: TABLE, WRECK: TABLE, MIMIC: TABLE, CHEST_TRAP: TABLE,
  },
  biomes: { BIOMES: RECORDS },
  enemies: {
    ENEMIES: RECORDS, BOSSES: RECORDS, ELITE: TABLE, ELITE_MODS: TABLE, ELITE_GROUP: TABLE, ELITE_NAMES: RECORDS,
    NAMED: TABLE, AMB_T: TABLE, COLOSSUS_GEO: TABLE,
  },
  items: {
    BASES: RECORDS, UNIQUES: RECORDS, CONSUMABLES: RECORDS, SLOTS: TABLE, SLOT_NAME: TABLE, RARITY: TABLE, AFFIXES: TABLE,
    AFFIX_W: TABLE, ITEM_BAL: TABLE, LOOT_OVER: TABLE, LEGEND_NAMES: TABLE, CLASS_LOOT: TABLE, SHOP: TABLE,
  },
  runs: { RUNS: RECORDS },
  hero: {
    CLASSES: RECORDS, ABILITIES: RECORDS, STATS: TABLE, TIPS: TABLE, NAME_MAX: TABLE, NAME_CHAR: TABLE, CRIT: TABLE,
    ASPD: TABLE, AB_MAX: TABLE, MASTERY: TABLE, SHIELD_T: TABLE, FROST: TABLE, BOLT: TABLE, SHOTS: TABLE, MAGE_ATK: TABLE,
    MAGE_SPELL: TABLE, POISE: TABLE, HUSH: TABLE, VOLLEY: TABLE, TRAP: TABLE, LEAP: TABLE, RAGE: TABLE, CHARGE: TABLE,
    CRY: TABLE, BAG: TABLE,
  },
  powers: { POWERS: RECORDS, GIFTS: RECORDS, SHARDS: TABLE, EPIC_POWER: TABLE, RELIC_MAX: TABLE },
  progression: {
    META: RECORDS, ACHIEVE: RECORDS, UNLOCKS: RECORDS, KITS: RECORDS, DONATE: TABLE, CODEX_TABS: TABLE, CODEX_PAGE: TABLE,
  },
  forks: { FORKS: TABLE, FORK_RANKS: TABLE, STAT_POWER: TABLE, THRESHOLD: TABLE },
  town: {
    NOTES: { layout: TABLE, recordsField: 'list' }, CAPTIVES: RECORDS, QUESTS: RECORDS, QUEST_SAY: RECORDS, FOLK: RECORDS,
    STORY: TABLE, QUEST_GIVE: TABLE, CRAFT: TABLE, STASH: TABLE, FOLK_SAY: TABLE, KEEPER: TABLE, CART: TABLE,
  },
  changes: { CHANGES: TABLE },
};

const NOT_EXPORTED = {
  UI: 'screen layout in pixels and its hit tests; screens are Godot scenes in the port',
  VIEW_H: 'view heights of the screen layout; screens are Godot scenes in the port',
  TEST_RUNS: 'menu list of the standalone test runs, which the port drops',
  VERSION: 'version of the JS build; the port has its own game version and data/version.json',
};

function tablePlan() {
  const plan = {};
  for (const [domain, tables] of Object.entries(DOMAINS)) {
    for (const [name, spec] of Object.entries(tables)) {
      const entry = typeof spec === 'string' ? { layout: spec } : spec;
      plan[name] = { domain, file: domain + '/' + name.toLowerCase(), ...entry };
    }
  }
  return plan;
}

module.exports = { RECORDS, TABLE, NOT_EXPORTED, tablePlan };
