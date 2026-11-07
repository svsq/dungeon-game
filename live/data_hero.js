// live/data_hero.js — abilities, stats, the meta upgrades, the altars' gifts, experience.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { plural } = D;
  const TIPS = { whirl: { n: 3, every: 20, until: 5, s: 'Толпа вплотную — клавиша 1: Вихрь клинка' } };
  const ABILITIES = [
    { id: 'whirl', name: 'Вихрь клинка', icon: 'ab_whirl', key: '1', unlock: 1, mp: 0, cd: 6, desc: 'Круговой удар: {d}% атаки всем рядом' },
    { id: 'fireball', name: 'Огненный шар', icon: 'ab_fire', key: '2', unlock: 2, mp: 12, cd: 2.5, desc: 'Огненный взрыв: {d} урона' },
    { id: 'shield', name: 'Магический щит', icon: 'ab_shield', key: '3', unlock: 4, mp: 30, cd: 16, desc: 'Барьер на 10 с: {d} урона' },
  ];
  // ten ranks at half the old per-rank gain: rank 10 lands a little past the old rank-5 cap instead of 1.7× it
  const AB_MAX = 10;
  const abRank = (id, r) => { const n = Math.max(0, r - 1);
    return id === 'whirl' ? { k: 1.6 + 0.125 * n, cd: 1 - 0.04 * n, r: 118 + 6 * n } : id === 'fireball' ? { k: 1 + 0.125 * n, cd: 1 } : { k: 1 + 0.15 * n, cd: 1 }; };
  // about one elite's blow anywhere (TASKS 179), but slower to grow than the blows: INT, rank and floor all multiplied in made it
  // a second life bar, 688 on floor 8 against the hero's 588 (TASKS 199)
  const SHIELD_T = 10, shieldHp = (int, r, f) => Math.round((24 + int * 2) * abRank('shield', r).k * (1 + 0.2 * (f - 1)));
  // a swing with INT for STR: the weapon in hand plus 1.6 per INT (stats: spellBase), so it grows with the gear as a swing does
  // and a strength build keeps casting deep down (TASKS 203); its bonuses add up into one sum (stats: spell). INT counted twice,
  // fire %, rank and floor all multiplied in made one fireball take 1800 on the 8th on hard, seven swings (TASKS 245)
  const FIRE_K = 1.5;
  const fireDmg = (base, k, spell) => Math.round(base * k * spell * FIRE_K);
  const STATS = [
    { k: 'str', name: 'СИЛ', full: 'Сила: урон в ближнем бою' },
    { k: 'agi', name: 'ЛОВ', full: 'Ловкость: скорость атаки, крит' },
    { k: 'int', name: 'ИНТ', full: 'Интеллект: мана, сила заклинаний' },
    { k: 'vit', name: 'ЖИВ', full: 'Живучесть: здоровье' },
  ];

  const metaLine = (M, r) => { const f = (k) => (M.neg ? '−' : '+') + M.v(k) + (M.pct ? '%' : ''), n = r && r < M.max ? r + 1 : Math.max(1, r);
    return (r && r < M.max ? f(r) + '  →  ' : '') + f(n) + ' ' + M.unit(M.v(n)); };
  // first ranks twice the old price, each step after three quarters of it: at 10–25 shards a won run bought five first ranks and
  // the next run was won before the rest of the ~1400 mattered (TASKS 202)
  const META = [
    // v(r): the total bonus at rank r, so the altar shows what is owned and what the next rank brings; unit(n) agrees with n
    { id: 'hp', name: 'Крепость предков', v: (r) => 12 * r, unit: () => 'к здоровью', max: 5, cost: (r) => 30 + r * 11 },
    { id: 'dmg', name: 'Ярость', v: (r) => 6 * r, pct: 1, unit: () => 'урона', max: 5, cost: (r) => 40 + r * 15 },
    { id: 'potion', name: 'Запас зелий', v: (r) => r, unit: (n) => plural(n, 'зелье', 'зелья', 'зелий') + ' здоровья на старте', max: 3, cost: (r) => 30 + r * 15 },
    { id: 'gold', name: 'Жадность', v: (r) => 15 * r, pct: 1, unit: () => 'золота', max: 3, cost: (r) => 20 + r * 10 },
    { id: 'stat', name: 'Наследие', v: (r) => 2 * r, unit: (n) => plural(n, 'очко', 'очка', 'очков') + ' характеристик на старте', max: 3, cost: (r) => 50 + r * 19 },
    { id: 'mana', name: 'Глубокий колодец', v: (r) => 10 * r, unit: () => 'к мане', max: 3, cost: (r) => 30 + r * 11 },
    { id: 'regen', name: 'Второе дыхание', v: (r) => 0.5 * r, unit: () => 'здоровья в секунду', max: 3, cost: (r) => 40 + r * 15 },
    { id: 'gear', name: 'Фамильное снаряжение', v: (r) => r, unit: () => 'к редкости стартового меча и брони', max: 2, cost: (r) => 80 + r * 30 },
    { id: 'skill', name: 'Наставник', v: (r) => r, unit: (n) => plural(n, 'очко', 'очка', 'очков') + ' навыков на старте', max: 2, cost: (r) => 60 + r * 22 },
    { id: 'resist', name: 'Закалка', v: (r) => 15 * r, pct: 1, neg: 1, unit: () => 'урона от яда, огня и лавы', max: 3, cost: (r) => 40 + r * 15 },
    // the town's storage chest (TASKS 1012): one cell of its own, a cell more per rank
    { id: 'vault', name: 'Сундук предков', town: 1, v: (r) => r, unit: (n) => plural(n, 'ячейка', 'ячейки', 'ячеек') + ' хранилища в городе', max: 2, cost: (r) => 40 + r * 20 },
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
    { id: 'bless', tier: 1, name: 'Благословение', icon: 'bf_bless', v: 20, desc: '+20% урона' },
    { id: 'vigor', tier: 1, name: 'Крепкая плоть', icon: 'it_armor_p', v: 20, desc: '+20 к здоровью' },
    { id: 'wisdom', tier: 1, name: 'Ясный разум', icon: 'it_mp', v: 20, desc: '+20 к мане' },
    { id: 'alert', tier: 1, name: 'Острый взгляд', icon: 'it_ring', v: 5, desc: '+5% уклонения' },
    { id: 'reach', tier: 1, name: 'Длинная рука', icon: 'it_longsword', v: 12, desc: '+12% дальности удара' },
    { id: 'thrift', tier: 1, name: 'Крепкий настой', icon: 'it_hp', v: 30, desc: 'Зелья сильнее на 30%', tag: '+{v}%' },
    { id: 'swift', tier: 2, name: 'Лёгкие ноги', icon: 'it_boots', v: 10, desc: '+10% скорости бега' },
    { id: 'haste', tier: 2, name: 'Быстрая рука', icon: 'it_gloves', v: 12, desc: '+12% скорости атаки' },
    { id: 'ward', tier: 2, name: 'Каменная кожа', icon: 'it_shield', v: 6, desc: '+6 к защите' },
    { id: 'crit', tier: 2, name: 'Глаз хищника', icon: 'it_ring', v: 8, desc: '+8% крит. шанса' },
    { id: 'cleave', tier: 2, name: 'Широкий замах', icon: 'ab_whirl', v: 25, desc: '+25° к ширине замаха' },
    { id: 'feast', tier: 2, name: 'Пир', icon: 'it_axe', v: 3, desc: 'Убийство лечит 3% здоровья', tag: '{v}%' },
    { id: 'thorns', tier: 2, name: 'Шипы', icon: 'it_buckler', v: 30, desc: '30% урона вблизи — обратно врагу' },
    { id: 'fury', tier: 3, name: 'Ярость крови', icon: 'it_sword', v: 15, desc: '+15% урона' },
    { id: 'leech', tier: 3, name: 'Жажда', icon: 'it_amulet', v: 4, desc: '+4% вампиризма' },
    { id: 'arcane', tier: 3, name: 'Пламя души', icon: 'ab_fire', v: 25, desc: '+25% силы заклинаний' },
    { id: 'life', tier: 3, name: 'Живая кровь', icon: 'crystal', v: 1.5, desc: '+1.5 здоровья в секунду' },
    { id: 'phoenix', tier: 3, name: 'Второй шанс', icon: 'bf_burn', v: 50, desc: 'Раз за забег: смерть → 50% здоровья', tag: '×{n}' },
    { id: 'execute', tier: 3, name: 'Добивание', icon: 'it_hammer', v: 60, desc: '+60% урона по врагам при HP < 25%' },
  ];
  // an altar stands on every second floor, so it is paid from two floors' takings: a bot reaches the floor-2 altar with ~12 shards,
  // so the middle gift is within reach at every altar (TASKS 183), the dear one takes three floors or more
  const giftCost = (tier, f) => Math.round([0, 4, 9, 16][tier] * (1 + 0.15 * (f - 1)));

  const xpNeed = (lvl) => Math.round(66 * Math.pow(lvl, 1.7));

  Object.assign(D, { TIPS, ABILITIES, AB_MAX, abRank, SHIELD_T, shieldHp, fireDmg, STATS, metaLine, META, GIFTS, giftCost, xpNeed });
})(typeof window !== 'undefined' ? window : globalThis);
