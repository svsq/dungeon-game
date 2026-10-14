// live/data.js — game content as data: biomes, enemies, items, affixes, abilities, meta upgrades, UI layout.
// Shared by sim.js (rules) and scene.js / hud.js (drawing). Pure data + pure helpers, no state.
(function (root) {
  const TILE = 32;                         // world units are view px; HD-pixel art drawn at display size (styles.md §1)
  // the camera's zoom: the world fills the 1920×1080 screen from a 1920/ZOOM × 1080/ZOOM window. 1.5 keeps the pixel grid whole
  // (one art pixel = 2 world px = 3 screen px); the HUD stays in screen px
  const ZOOM = 1.5;

  const BIOMES = {
    dungeon: { name: 'Подземелье', amb: [0.11, 0.09, 0.10], torch: [1.0, 0.62, 0.26], floor: 'floor_d_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [1, 1, 1], roster: ['skeleton', 'goblin', 'spider'], props: ['rack', 'bookshelf', 'cage', 'statue', 'rack'] },
    crypt: { name: 'Крипты', amb: [0.07, 0.11, 0.09], torch: [0.45, 1.0, 0.45], floor: 'floor_c_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [0.86, 0.98, 0.9], roster: ['skeleton', 'cultist', 'ghost', 'spider'], props: ['coffin', 'grave', 'statue', 'pillar', 'grave'] },
    lava: { name: 'Огненные глубины', amb: [0.14, 0.07, 0.05], torch: [1.0, 0.45, 0.16], floor: 'floor_l_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [1.04, 0.9, 0.84], roster: ['goblin', 'skeleton', 'cultist', 'brute'], lava: true, props: ['pillar', 'cage', 'rack', 'statue'] },
    arcane: { name: 'Чертоги', amb: [0.07, 0.08, 0.14], torch: [0.4, 0.7, 1.0], floor: 'floor_a_tex', wall: 'wall_d_tex', top: 'walltop_d_tex',
      tint: [0.86, 0.9, 1.04], roster: ['ghost', 'skeleton', 'cultist', 'brute'], props: ['crystal', 'statue', 'bookshelf', 'crystal', 'pillar'] },
  };
  const FLOORS = 8;
  const biomeOf = (f) => (f <= 2 ? 'dungeon' : f <= 4 ? 'crypt' : f <= 6 ? 'lava' : 'arcane');
  const floorName = (f) => (f === FLOORS ? 'Трон Демона' : BIOMES[biomeOf(f)].name);

  // enemies: hp, dmg, spd (native px/s), r (body radius), reach (attack range from body edge), wind (telegraph s), cd, xp, kind
  const ENEMIES = {
    skeleton: { name: 'Скелет', hp: 30, dmg: 8, spd: 68, r: 13, reach: 36, wind: 0.52, cd: 1.2, xp: 8, kind: 'melee', h: 76 },
    goblin: { name: 'Гоблин', hp: 20, dmg: 6, spd: 104, r: 10, reach: 28, wind: 0.30, cd: 0.9, xp: 6, kind: 'melee', h: 72 },
    spider: { name: 'Паук', hp: 18, dmg: 5, spd: 92, r: 15, reach: 76, wind: 0.36, cd: 1.6, xp: 7, kind: 'lunge', h: 53, poison: 1 },
    cultist: { name: 'Культист', hp: 26, dmg: 9, spd: 56, r: 13, reach: 305, wind: 0.55, cd: 2.0, xp: 10, kind: 'caster', h: 84 },
    ghost: { name: 'Призрак', hp: 28, dmg: 7, spd: 60, r: 13, reach: 30, wind: 0.45, cd: 1.3, xp: 9, kind: 'melee', h: 74, ghost: 1 },
    brute: { name: 'Демон', hp: 120, dmg: 18, spd: 52, r: 23, reach: 46, wind: 0.7, cd: 2.0, xp: 30, kind: 'slam', h: 112 },
    boss: { name: 'Повелитель Демонов', hp: 520, dmg: 24, spd: 48, r: 36, reach: 56, wind: 0.8, cd: 1.6, xp: 300, kind: 'boss', h: 180 },
  };

  // half the monsters, each 2.5× as dangerous (hp × dmg ≈ 2.56: a straight 2.5 on both walled every bot run at floor 2);
  // a kill pays double so XP and loot per floor stay where they were
  const BAL = { pop: 0.5, hp: 1.6, dmg: 1.6, reward: 2 };
  // elites over a regular monster of their kind, brought up to the floor-2 exit guard (the elite demon, kept as it was): hard to
  // kill, quicker on its feet, swings sooner and more often, hits harder and is never knocked back (a knockback per blow kept
  // plain elites from ever swinging). Fewer of them than before: each is a fight of its own. share: chance of a monster from floor 3
  const ELITE = { hp: 8, dmg: 2.2, spd: 1.3, wind: 0.75, cd: 0.6, share: 0.04, brute: { hp: 2.4, dmg: 1.5, spd: 1.1, wind: 0.85, cd: 1 } };
  // the boss is an elite too but keeps its own pace
  const eliteK = (e, k) => !e.elite ? 1 : e.type === 'boss' ? ({ spd: 1.1, wind: 0.85 }[k] || 1) : e.type === 'brute' ? ELITE.brute[k] : ELITE[k];
  // an elite's powers: one up to floor 3, then one or two, two from floor 6; each is seen in its aura's colour and its name
  const ELITE_MODS = [
    { id: 'fiery', name: 'Огненный', col: [1.0, 0.42, 0.08], burn: 3 },
    { id: 'vampire', name: 'Кровожадный', col: [0.92, 0.08, 0.2], heal: 0.12 },
    { id: 'summoner', name: 'Призывающий', col: [0.5, 1.0, 0.4], every: 8, n: 2, cap: 3 },
    { id: 'explosive', name: 'Взрывной', col: [1.0, 0.86, 0.35], fuse: 1.0, r: 110, dmg: 1.5 },
  ];
  const eliteMods = (f) => (f >= 6 ? [2, 2] : f >= 4 ? [1, 2] : [1, 1]);
  const eliteName = (e) => [...(e.mods || []).map((id) => ELITE_MODS.find((m) => m.id === id).name), ENEMIES[e.type].name]
    .map((w, i) => (i ? w.toLowerCase() : w)).join(' ');

  // equipment slots and bases. lvl scales with the floor where the item drops.
  const SLOTS = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
  const SLOT_NAME = { weapon: 'Оружие', offhand: 'Щит', helm: 'Шлем', armor: 'Доспех', gloves: 'Перчатки', boots: 'Сапоги', ring: 'Кольцо', amulet: 'Амулет' };
  const BASES = {
    sword: { slot: 'weapon', name: 'Короткий меч', icon: 'it_sword', atk: 6, spd: 0.42, arc: 120, reach: 56 },
    longsword: { slot: 'weapon', name: 'Длинный меч', icon: 'it_longsword', atk: 6.5, spd: 0.44, arc: 130, reach: 66 },
    axe: { slot: 'weapon', name: 'Боевой топор', icon: 'it_axe', atk: 7, spd: 0.46, arc: 140, reach: 61 },
    hammer: { slot: 'weapon', name: 'Боевой молот', icon: 'it_hammer', atk: 7.5, spd: 0.48, arc: 150, reach: 61, kb: 2 },
    staff: { slot: 'weapon', name: 'Посох мага', icon: 'it_staff', atk: 6, spd: 0.45, arc: 110, reach: 61, spell: 0.35 },
    shield: { slot: 'offhand', name: 'Круглый щит', icon: 'it_shield', def: 4 },
    leather_helm: { slot: 'helm', name: 'Кожаный шлем', icon: 'it_helm_l', def: 2, typed: { aspd: 0.6 } },
    knight_helm: { slot: 'helm', name: 'Рыцарский шлем', icon: 'it_helm_k', def: 2, typed: { hp: 0.5 }, minF: 3 },
    leather_armor: { slot: 'armor', name: 'Кожаная броня', icon: 'it_armor_l', def: 3, typed: { mspd: 0.8 } },
    plate_armor: { slot: 'armor', name: 'Латный доспех', icon: 'it_armor_p', def: 3, typed: { hp: 1 }, minF: 3 },
    gauntlets: { slot: 'gloves', name: 'Латные перчатки', icon: 'it_gloves', def: 1 },
    boots: { slot: 'boots', name: 'Кожаные сапоги', icon: 'it_boots', def: 1 },
    ring: { slot: 'ring', name: 'Кольцо', icon: 'it_ring' },
    amulet: { slot: 'amulet', name: 'Амулет', icon: 'it_amulet' },
    cloak: { slot: 'armor', name: 'Плащ странника', icon: 'it_cloak', def: 3, typed: { mp: 1.4 } },
  };
  // BASES typed: the base's own bonus as a share of an average affix roll of that stat, so it grows with level and rarity like one
  const ITEM_BAL = { version: 2, atkLevel: 0.3, defLevel: 0.25, rarity: [1, 1.3, 1.7, 2.2, 2.9] };
  const CONSUMABLES = {
    hp_potion: { name: 'Зелье здоровья', icon: 'it_hp', heal: 0.4, stack: 9 },
    mp_potion: { name: 'Зелье маны', icon: 'it_mp', mana: 0.5, stack: 9 },
    scroll: { name: 'Свиток телепорта', icon: 'it_scroll', stack: 5 },
  };
  const RARITY = [
    { id: 'common', name: 'Обычный', col: [0.78, 0.76, 0.72], affixes: 0 },
    { id: 'uncommon', name: 'Необычный', col: [0.42, 0.86, 0.32], affixes: 1 },
    { id: 'rare', name: 'Редкий', col: [0.36, 0.62, 1.0], affixes: 2 },
    { id: 'epic', name: 'Эпический', col: [0.74, 0.38, 0.98], affixes: 3 },
    { id: 'legendary', name: 'Легендарный', col: [1.0, 0.6, 0.14], affixes: 4 },
  ];
  // affix: stat key, label (with {v}), per-level value range
  const AFFIXES = [
    { k: 'str', label: '+{v} к силе', a: 1, b: 0.5 }, { k: 'agi', label: '+{v} к ловкости', a: 1, b: 0.5 },
    { k: 'int', label: '+{v} к интеллекту', a: 1, b: 0.5 }, { k: 'vit', label: '+{v} к живучести', a: 1, b: 0.5 },
    { k: 'atk', label: '+{v} к атаке', a: 2, b: 1.0 }, { k: 'def', label: '+{v} к защите', a: 1, b: 0.6 },
    { k: 'crit', label: '+{v}% крит. шанса', a: 2, b: 0.4 }, { k: 'hp', label: '+{v} к здоровью', a: 8, b: 4 },
    { k: 'mp', label: '+{v} к мане', a: 5, b: 2 }, { k: 'aspd', label: '+{v}% скорости атаки', a: 4, b: 0.8 },
    { k: 'mspd', label: '+{v}% скорости бега', a: 3, b: 0.5 }, { k: 'leech', label: '+{v}% вампиризма', a: 1, b: 0.3 },
    { k: 'fire', label: '+{v}% урона огнём', a: 6, b: 2 },
    { k: 'regen', label: '+{v} здоровья в секунду', a: 0.5, b: 0.15 }, { k: 'onhit', label: '+{v} здоровья за удар', a: 0.5, b: 0.2 },
  ];
  // by base first: a legendary staff or axe must not be called a blade
  const LEGEND_NAMES = { sword: 'Пламенный клинок', longsword: 'Меч Рассвета', axe: 'Секира Палача', hammer: 'Молот Грома', staff: 'Посох Вечного Пламени',
    cloak: 'Плащ Ночи', weapon: 'Пламенный клинок', offhand: 'Эгида Зари', helm: 'Венец Короля', armor: 'Доспех Феникса', gloves: 'Длани Титана',
    boots: 'Поступь Тени', ring: 'Кольцо Бездны', amulet: 'Сердце Дракона' };

  const ABILITIES = [
    { id: 'whirl', name: 'Вихрь клинка', icon: 'ab_whirl', key: '1', unlock: 1, mp: 10, cd: 6, desc: 'Круговой удар: {d}% атаки всем рядом' },
    { id: 'fireball', name: 'Огненный шар', icon: 'ab_fire', key: '2', unlock: 2, mp: 12, cd: 1.4, desc: 'Огненный взрыв: {d} урона' },
    { id: 'shield', name: 'Магический щит', icon: 'ab_shield', key: '3', unlock: 4, mp: 20, cd: 16, desc: 'Барьер на 5 с: {d} урона' },
  ];
  // ten ranks at half the old per-rank gain: rank 10 lands a little past the old rank-5 cap instead of 1.7× it
  const AB_MAX = 10;
  const abRank = (id, r) => { const n = Math.max(0, r - 1);
    return id === 'whirl' ? { k: 1.6 + 0.125 * n, cd: 1 - 0.04 * n } : id === 'fireball' ? { k: 1 + 0.125 * n, cd: 1 } : { k: 1 + 0.15 * n, cd: 1 }; };
  const STATS = [
    { k: 'str', name: 'СИЛ', full: 'Сила: урон в ближнем бою' },
    { k: 'agi', name: 'ЛОВ', full: 'Ловкость: скорость атаки, крит' },
    { k: 'int', name: 'ИНТ', full: 'Интеллект: мана, сила заклинаний' },
    { k: 'vit', name: 'ЖИВ', full: 'Живучесть: здоровье' },
  ];
  const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);
  const metaLine = (M, r) => { const f = (k) => (M.neg ? '−' : '+') + M.v(k) + (M.pct ? '%' : ''), n = r && r < M.max ? r + 1 : Math.max(1, r);
    return (r && r < M.max ? f(r) + '  →  ' : '') + f(n) + ' ' + M.unit(M.v(n)); };
  const META = [
    // v(r): the total bonus at rank r, so the altar shows what is owned and what the next rank brings; unit(n) agrees with n
    { id: 'hp', name: 'Крепость предков', v: (r) => 12 * r, unit: () => 'к здоровью', max: 5, cost: (r) => 15 + r * 15 },
    { id: 'dmg', name: 'Ярость', v: (r) => 6 * r, pct: 1, unit: () => 'урона', max: 5, cost: (r) => 20 + r * 20 },
    { id: 'potion', name: 'Запас зелий', v: (r) => r, unit: (n) => plural(n, 'зелье', 'зелья', 'зелий') + ' здоровья на старте', max: 3, cost: (r) => 15 + r * 20 },
    { id: 'gold', name: 'Жадность', v: (r) => 15 * r, pct: 1, unit: () => 'золота', max: 3, cost: (r) => 10 + r * 15 },
    { id: 'stat', name: 'Наследие', v: (r) => 2 * r, unit: (n) => plural(n, 'очко', 'очка', 'очков') + ' характеристик на старте', max: 3, cost: (r) => 25 + r * 25 },
    { id: 'mana', name: 'Глубокий колодец', v: (r) => 10 * r, unit: () => 'к мане', max: 3, cost: (r) => 15 + r * 15 },
    { id: 'regen', name: 'Второе дыхание', v: (r) => 0.5 * r, unit: () => 'здоровья в секунду', max: 3, cost: (r) => 20 + r * 20 },
    { id: 'gear', name: 'Фамильное снаряжение', v: (r) => r, unit: () => 'к редкости стартового меча и брони', max: 2, cost: (r) => 40 + r * 40 },
    { id: 'skill', name: 'Наставник', v: (r) => r, unit: (n) => plural(n, 'очко', 'очка', 'очков') + ' навыков на старте', max: 2, cost: (r) => 30 + r * 30 },
    { id: 'resist', name: 'Закалка', v: (r) => 15 * r, pct: 1, neg: 1, unit: () => 'урона от яда, огня и лавы', max: 3, cost: (r) => 20 + r * 20 },
  ];

  // a dungeon altar's gifts: it offers one of each tier, takes shards from the meta bank and gives one gift for the rest of the
  // run (the blessing only for the floor), then goes dark. v is the bonus per gift taken
  const GIFTS = [
    { id: 'bless', tier: 1, name: 'Благословение', icon: 'bf_bless', v: 20, desc: '+20% урона' },
    { id: 'vigor', tier: 1, name: 'Крепкая плоть', icon: 'it_hp', v: 20, desc: '+20 к здоровью' },
    { id: 'wisdom', tier: 1, name: 'Ясный разум', icon: 'it_mp', v: 20, desc: '+20 к мане' },
    { id: 'greed', tier: 1, name: 'Звон монет', icon: 'it_gold', v: 25, desc: '+25% золота' },
    { id: 'swift', tier: 2, name: 'Лёгкие ноги', icon: 'it_boots', v: 10, desc: '+10% скорости бега' },
    { id: 'haste', tier: 2, name: 'Быстрая рука', icon: 'it_gloves', v: 12, desc: '+12% скорости атаки' },
    { id: 'ward', tier: 2, name: 'Каменная кожа', icon: 'it_shield', v: 6, desc: '+6 к защите' },
    { id: 'crit', tier: 2, name: 'Глаз хищника', icon: 'it_ring', v: 8, desc: '+8% крит. шанса' },
    { id: 'fury', tier: 3, name: 'Ярость крови', icon: 'it_sword', v: 15, desc: '+15% урона' },
    { id: 'leech', tier: 3, name: 'Жажда', icon: 'it_amulet', v: 4, desc: '+4% вампиризма' },
    { id: 'arcane', tier: 3, name: 'Пламя души', icon: 'ab_fire', v: 25, desc: '+25% силы заклинаний' },
    { id: 'life', tier: 3, name: 'Живая кровь', icon: 'crystal', v: 1.5, desc: '+1.5 здоровья в секунду' },
  ];
  // a floor's takings in shards are about the floor's number: a cheap gift is most of a floor, the dear one three
  const giftCost = (tier, f) => Math.round([0, 4, 9, 16][tier] * (1 + 0.15 * (f - 1)));

  const xpNeed = (lvl) => Math.round(24 * Math.pow(lvl, 1.55));

  // the merchant: one per floor. A bot clearing a floor brings home ~150 + 200 × floor gold, so a floor's takings buy one
  // piece a rarity above what it drops, or a few potions; loot sells back for a quarter
  const SHOP = {
    gear: (f) => 4 + (f >= 4 ? 1 : 0),
    // the first piece on the shelf is the showpiece: at least this rarity
    best: (f) => Math.min(4, 1 + Math.floor(f / 3)),
    q: (f) => 0.6 + 0.1 * f,
    cons: (f) => [['hp_potion', 3 + Math.floor(f / 2)], ['mp_potion', 2 + Math.floor(f / 3)], ['scroll', 1 + (f >= 5 ? 1 : 0)]],
    rarK: [1, 1.8, 3.2, 5.5, 9],
    sell: 0.25, buyback: 4,
    lines: ['Заходи, путник! Золото не пахнет.', 'Всё с прошлых героев. Почти не ношеное.', 'Торгуюсь честно. Почти всегда.',
      'Монстры ко мне не суются — у меня обереги.', 'Глубже — дороже. Такова жизнь.', 'Продашь хлам? Возьму, не глядя.'],
  };
  const CONS_PRICE = { hp_potion: (f) => 30 + 10 * f, mp_potion: (f) => 25 + 8 * f, scroll: (f) => 50 + 10 * f };
  const itemPrice = (it, f) => (CONSUMABLES[it.b] ? CONS_PRICE[it.b](f) : Math.round((25 + 15 * it.lvl) * SHOP.rarK[it.rar] / 5) * 5);
  const sellPrice = (it, f) => Math.max(1, Math.floor(itemPrice(it, f) * SHOP.sell));

  // ---------------- UI layout (view px) — the sim hit-tests these, the HUD draws them ----------------
  const UI = {
    menu: (hasRun) => {
      const items = [['continue', 'Продолжить забег', hasRun], ['campaign', hasRun ? 'Новая кампания (сброс)' : 'Кампания — 8 этажей', true], ['endless', 'Бесконечный спуск (WIP)', false],
        ['meta', 'Алтарь душ', true]];
      return items.map(([id, label, on], i) => ({ id, label, on, x: 760, y: 470 + i * 92, w: 400, h: 72 }));
    },
    // debug panel (` in play): open every secret of the floor (pressed again, seal the ones it opened); show every item of loot
    debug: (R, S) => [{ id: 'dbg_secrets', label: R.dbgOpen ? 'Скрыть секреты' : 'Открыть все секреты', on: true, x: 520, y: 16, w: 430, h: 60 },
      { id: 'dbg_loot', label: S && S.dbgLoot ? 'Убрать подсветку лута' : 'Подсветить лут', on: true, x: 970, y: 16, w: 430, h: 60 }],
    pause: () => [['resume', 'Продолжить'], ['save', 'Сохранить и выйти в меню'], ['abandon', 'Сдаться (конец забега)']]
      .map(([id, label], i) => ({ id, label, on: true, x: 720, y: 430 + i * 92, w: 480, h: 72 })),
    end: () => [['menu', 'В главное меню'], ['again', 'Новый забег']].map(([id, label], i) => ({ id, label, on: true, x: 600 + i * 380, y: 920, w: 340, h: 72 })),
    meta: () => META.map((m, i) => ({ id: m.id, x: 180 + Math.floor(i / 5) * 800, y: 270 + (i % 5) * 112, w: 760, h: 96 })).concat([{ id: 'back', label: 'Назад', on: true, x: 810, y: 870, w: 300, h: 70 }]),
    // a dungeon altar: its three gifts side by side, cheapest first
    altar: () => { const P = { x: 360, y: 190, w: 1200, h: 700 };
      return { P, r: [0, 1, 2].map((i) => ({ id: 'gift:' + i, i, x: P.x + 40 + i * 380, y: P.y + 150, w: 340, h: 390 }))
        .concat([{ id: 'leave', label: 'Уйти', on: true, x: P.x + P.w / 2 - 150, y: P.y + P.h - 100, w: 300, h: 70 }]) }; },
    // hero screen: equipment column, bag grid, stats and abilities
    inv: () => {
      const P = { x: 250, y: 170, w: 1420, h: 740 }, r = [];
      const eq = [['helm', 0, 0], ['amulet', 1, 0], ['weapon', 0, 1], ['armor', 1, 1], ['offhand', 2, 1], ['gloves', 0, 2], ['ring', 1, 2], ['boots', 2, 2]];
      for (const [s, cx, cy] of eq) r.push({ id: 'eq:' + s, slot: s, x: P.x + 310 + cx * 96, y: P.y + 110 + cy * 96, w: 84, h: 84 });
      for (let i = 0; i < 24; i++) r.push({ id: 'bag:' + i, i, x: P.x + 640 + (i % 8) * 92, y: P.y + 110 + Math.floor(i / 8) * 92, w: 82, h: 82 });
      STATS.forEach((s, i) => r.push({ id: 'stat:' + s.k, k: s.k, x: P.x + 40 + 196, y: P.y + 452 + i * 52, w: 40, h: 40 }));
      ABILITIES.forEach((a, i) => r.push({ id: 'ab:' + a.id, ab: a.id, x: P.x + 640 + i * 258, y: P.y + 470, w: 250, h: 150 }));
      r.push({ id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 });
      return { P, r };
    },
    // the merchant's screen: his shelf (gear, then consumables) and the buy-back row on the left, the hero's bag on the
    // right; every slot has its price line under it
    shop: (nGoods) => {
      const P = { x: 190, y: 110, w: 1540, h: 860 }, r = [];
      for (let i = 0; i < nGoods; i++) r.push({ id: 'buy:' + i, i, x: P.x + 40 + (i % 4) * 116, y: P.y + 130 + Math.floor(i / 4) * 140, w: 92, h: 92 });
      for (let i = 0; i < SHOP.buyback; i++) r.push({ id: 'back:' + i, i, x: P.x + 40 + i * 116, y: P.y + 580, w: 92, h: 92 });
      for (let i = 0; i < 24; i++) r.push({ id: 'sell:' + i, i, x: P.x + 620 + (i % 8) * 108, y: P.y + 130 + Math.floor(i / 8) * 140, w: 92, h: 92 });
      r.push({ id: 'close', x: P.x + P.w - 64, y: P.y + 16, w: 48, h: 48 });
      return { P, r };
    },
  };
  // what a blow on a big prop sounds and looks like: wood rocks and sheds splinters, stone shudders and chips, metal rings and
  // sparks, crystal chimes and flashes, sacks slump
  // how wide each floor prop draws, in view px (its display height in sizes.js times its sprite's aspect); the generator keeps
  // these apart so no two overlap on screen. A gold heap draws as the `treasure` sprite, a small pile as `shop_gold`
  const PROP_W = { chest: 53, coffin: 81, grave: 50, statue: 61, pillar: 81, crystal: 49, cage: 51, rack: 69, bookshelf: 103, table: 59, brazier: 57,
    altar: 67, gold: 96, goldpile: 46, barrel: 45, crate: 48, pot: 32, vase_a: 30, vase_b: 43, vase_c: 30 };
  // and how tall (sizes.js heights): with the width, the sprite's box an item lying behind the prop disappears in
  const PROP_H = { chest: 52, coffin: 51, grave: 51, statue: 117, pillar: 89, crystal: 81, cage: 81, rack: 71, bookshelf: 107, table: 52, brazier: 51,
    altar: 56, gold: 52, goldpile: 32, barrel: 56, crate: 51, pot: 36, vase_a: 60, vase_b: 48, vase_c: 60 };
  const PROP_MAT = { table: 'wood', rack: 'wood', bookshelf: 'wood', coffin: 'wood', shop_shelf: 'wood', shop_barrel: 'wood', shop_crate: 'wood',
    statue: 'stone', pillar: 'stone', grave: 'stone', cage: 'metal', brazier: 'metal', shop_lantern: 'metal', shop_armor: 'metal', shop_weapons: 'metal',
    crystal: 'crystal', shop_sacks: 'cloth', shop_gold: 'cloth' };
  const hitUI = (rects, x, y) => rects.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);

  root.DATA = { TILE, ZOOM, BIOMES, FLOORS, biomeOf, floorName, ENEMIES, BAL, ELITE, eliteK, ELITE_MODS, eliteMods, eliteName, SLOTS, SLOT_NAME, BASES, ITEM_BAL, CONSUMABLES, RARITY, AFFIXES, LEGEND_NAMES,
    ABILITIES, AB_MAX, abRank, STATS, META, metaLine, GIFTS, giftCost, xpNeed, SHOP, itemPrice, sellPrice, UI, hitUI, PROP_MAT, PROP_W, PROP_H };
  if (typeof module !== 'undefined') module.exports = root.DATA;
})(typeof window !== 'undefined' ? window : globalThis);
