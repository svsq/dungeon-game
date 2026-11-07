// live/data_town.js — quests, crafting, the storage chest, the townsfolk and the keeper.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { plural, runOf, stageOf, xpNeed } = D;
  const QUESTS = {
    cull: { kind: 'side', type: 'kill', name: 'Прополка', need: (f) => 10 + 2 * f, text: (q) => 'Убей ' + q.need + ' ' + plural(q.need, 'чудовище', 'чудовища', 'чудовищ') + ' на ' + q.f + '-м этаже или глубже.', rw: ['scroll', 'xp'] },
    elites: { kind: 'side', type: 'kill', elite: 1, name: 'Сильнейшие', need: (f) => 2 + Math.floor(f / 4), text: (q) => 'Одолей ' + q.need + ' ' + plural(q.need, 'элитного врага', 'элитных врагов', 'элитных врагов') + ' на ' + q.f + '-м этаже или глубже.', rw: ['scroll', 'item'] },
    sweep: { kind: 'side', type: 'clear', name: 'Тишина в залах', need: (f) => 3 + Math.floor(f / 4), text: (q) => 'Зачисти ' + q.need + ' ' + plural(q.need, 'комнату', 'комнаты', 'комнат') + ' до последнего врага на ' + q.f + '-м этаже или глубже.', rw: ['xp', 'shards'] },
    descent: { kind: 'side', type: 'reach', name: 'Глубже', need: () => 1, ahead: 2, text: (q) => 'Спустись до ' + q.f + '-го этажа.', rw: ['scroll', 'shards'] },
    // the named foe from the 3rd floor (TASKS 1024: on the 1st it killed the bot's level-1 hero on two seeds in six)
    named: { kind: 'side', type: 'named', name: 'Охота', need: () => 1, fresh: 1, noBoss: 1, from: 3, text: (q) => 'На ' + q.f + '-м этаже бродит чудовище по прозвищу ' + q.title + '. Найди и убей его: оно отмечено на карте.', rw: ['scroll', 'item'], item: 3 },
    fetch: { kind: 'side', type: 'fetch', name: 'Пропажа', need: () => 1, fresh: 1, noBoss: 1, text: (q) => '«' + q.thing + '» лежит где-то на ' + q.f + '-м этаже: в комнате, в сундуке или в тайнике. Найди и принеси.', rw: ['scroll', 'xp'] },
    room: { kind: 'side', type: 'room', name: 'Логово', need: () => 1, fresh: 1, noBoss: 1, text: (q) => 'На ' + q.f + '-м этаже есть логово — оно отмечено на карте. Зачисти его до последнего врага.', rw: ['xp', 'shards'] },
    chapter: { kind: 'story', type: 'boss', name: 'Хозяин главы', need: () => 1, text: (q) => 'Одолей хозяина главы на ' + q.f + '-м этаже.', rw: ['shards', 'item'] },
    depths: { kind: 'story', type: 'reach', name: 'Новая глава', need: () => 1, text: (q) => 'Спустись до ' + q.f + '-го этажа: там начинается новая глава.', rw: ['shards', 'item'] },
  };
  // what a quest pointing at floor f gives on its turn-in (item: the reward piece's least rarity, 2 rare unless the template says)
  // (TASKS 1024: at 0.35 of a level's XP and 150 + 60·f gold the bot that turned in ~6 a run came to each floor a level up on the
  // campaign's hero, and the average went past the 8th in 83 % of runs against the campaign's 70 % on the same seeds)
  // (TASKS 1033) a reward is told by its kind, not its size: scrolls of return in place of gold (on the 1st floor 140 gold went to a
  // hero with thousands and nothing to buy), and the experience of the hero's own level, not the floor's (10 on the 1st floor read as
  // nothing): lvl is the hero's level when it is offered and again when it is turned in
  const questReward = (rw, f, lvl) => Object.fromEntries(rw.map((k) => [k, k === 'gold' ? 100 + 40 * f : k === 'scroll' ? 1 + (f >= 8 ? 1 : 0) : k === 'xp' ? Math.round(0.15 * xpNeed(Math.max(1, lvl || f))) : k === 'shards' ? 3 + Math.floor(f / 2) : 1]));
  // who gives the side quests (TASKS 1018): a run draws QUEST_GIVE.n of them by its seed from the pool, each from a townsman of
  // its own; the floor a quest points at is set when it is taken, `ahead` floors past the deepest reached (one, unless the template
  // says). The Keeper gives the story chain (1022) and may give a side quest too
  const QUEST_GIVE = { n: [2, 3], from: ['smith', 'porter', 'sweeper', 'child', 'guard', 'keeper'], pool: ['named', 'fetch', 'room', 'cull', 'elites', 'sweep', 'descent'] };
  // the townsfolk's words around a quest: the ask, the thanks on the turn-in, and the keepsake each would have back (1020)
  const QUEST_SAY = {
    smith: { done: 'Ну, показывай. Вижу — сделано.', ask: 'Раз уж ты вниз — есть дело. Заплачу честно.', thanks: 'Добрая работа. Держи, заслужил.', thing: 'Ларец с печатью', ic: 'qi_casket' },
    porter: { done: 'Неужто управился? Вот это да!', ask: 'Слушай, раз уж ты туда идёшь… Мне самому никак — ящики.', thanks: 'Вот спасибо! Держи, от души.', thing: 'Ларец с печатью', ic: 'qi_casket' },
    sweeper: { done: 'Вернулся, сынок! Живой, и дело сделал.', ask: 'Сынок, помоги старой. Внизу пропадает всё, что дорого.', thanks: 'Ох, уважил старуху. Возьми, не отказывайся.', thing: 'Серебряный медальон', ic: 'qi_locket' },
    child: { done: 'Ты правда это сделал?! Покажи!', ask: 'Эй! Ты же герой? Тогда слушай, это важно!', thanks: 'Ух ты! Я всем расскажу! Это тебе!', thing: 'Деревянная лошадка', ic: 'qi_horse' },
    guard: { done: 'Вижу по глазам — сделано.', ask: 'Пока стоишь тут — работа есть. Внизу кое-что не даёт мне спать.', thanks: 'Одной заботой меньше. Держи.', thing: 'Ларец с печатью', ic: 'qi_casket' },
    keeper: { done: 'Огонь уже сказал мне. Ты справился.', ask: 'Огонь показал мне кое-что внизу. Послушай.', thanks: 'Огонь горит ровнее. Возьми, это твоё.', thing: 'Серебряный медальон', ic: 'qi_locket' },
  };
  // the named foes (1019): a name and what it is, drawn for the quest; it walks as a strong elite of its floor's kind

  // the Keeper's story chain (TASKS 1022, a stub for R-04): a run's chapters as quests in order — each boss of the run's floors
  // (`chapter`), and the first floor of each of its later chapters (`depths`); R-04 will give the steps their own words
  const storyChain = (mode) => { const M = runOf(mode), out = []; if (M.endless) return out;
    for (let f = 1; f <= M.floors; f++) { if ((M.chapters || []).some((c) => c.from === f)) out.push({ key: 'depths', f }); if (stageOf(mode, f).boss) out.push({ key: 'chapter', f }); }
    return out; };

  // the town's workshops (R-32, TASKS 1013), a sink for spare gold and shards (389): the smith reforges a piece's own affixes for a
  // share of its price; the enchanter lays on up to three more, each dearer and riskier: a failure strips every enchantment
  // (strip share of failures) or spoils the piece (it loses one affix of its own)
  const CRAFT = { reforge: 0.35, ench: { max: 3, gold: [0.3, 0.6, 1.2], shards: [3, 6, 12], fail: [0, 0.2, 0.4], strip: 0.6 } };
  // the storage chest (R-33, TASKS 1012): gear left for the heroes to come, kept in the meta save with the item balance it was made under
  const STASH = { max: 3, cells: (meta) => 1 + ((meta && meta.up && meta.up.vault) || 0) };

  // the townsfolk (R-17, TASKS 1015): a pair of lines when the hero comes up (the next pair the next time), the clock of the work
  // loop (per s; hit: the loop's impact phase, rest: every rest-th loop is a breather) and, for those with a round, the walking
  // speed and the pause at each stop. The sim's events (the anvil's ring, the keeper's sparks) and the render share one clock
  const FOLK = {
    smith: { name: 'Кузнец', per: 1.45, hit: 0.6, rest: 4, lines: [['Горн не любит ждать.', 'Принесёшь руды — скую и тебе.'],
      ['Слышишь, как поёт железо?', 'Внизу оно только ржавеет.'], ['Не стой у наковальни.', 'Искры кусаются, проверено.']] },
    enchanter: { name: 'Зачарователь', per: 7.5, hit: 0.55, lines: [['Тише. Руны не любят шума.', 'Эта колба — не для питья.'],
      ['В крипте спят старые чары.', 'Найдёшь камень с узором — неси.'], ['Пламя синее — значит, верно.', 'Жёлтое — значит, беги.']] },
    keeper: { name: 'Хранитель огня', per: 9, hit: 0.3, lines: [['Костёр горит, пока ты жив.', 'Вернёшься — согреет снова.'],
      ['Я помню всех, кто спускался.', 'Возвращались не все.'], ['Посиди у огня, путник.', 'Тьма подождёт.']] },
    guard: { name: 'Страж', per: 8, lines: [['Внизу крипта. Сам решай.', 'Назад дорога длиннее.'], ['Мертвецы там не спят.', 'Держи клинок наготове.'],
      ['Стою тут двадцать лет.', 'Наверх лезут реже, чем ты думаешь.']] },
    porter: { name: 'Носильщик', per: 1.7, v: 34, lines: [['Посторонись, ноша тяжёлая!', 'Торговцу всё мало товару.'],
      ['Ящик туда, ящик сюда.', 'Так и живём.'], ['Говорят, внизу золото.', 'А я вот ящики таскаю.']] },
    sweeper: { name: 'Метельщица', per: 1.25, pause: 7, v: 20, lines: [['Опять пепел нанесли!', 'Ноги вытирай, милок.'],
      ['Подмету — и снова сажа.', 'Как у вас там внизу, чисто?'], ['Береги себя, сынок.', 'Метлой от мертвецов не отмашешься.']] },
    child: { name: 'Мальчишка', per: 2.3, pause: 6, v: 42, lines: [['А ты правда был в крипте?', 'Я тоже пойду, когда вырасту!'],
      ['Куры меня слушаются!', 'Почти всегда.'], ['А мечом дашь подержать?', 'Ну хоть чуть-чуть!']] },
    hen: { per: 2.2 },
  };
  // how long a pair of lines shows (each line half of it)
  const FOLK_SAY = 5;
  // the Keeper of the Fire (R-25, TASKS 1016): what he says when spoken to (E), by what has happened since he last spoke; each
  // event is a page of the dialogue, the most weighty first, each told once; with nothing new, a pair of his idle lines
  const KEEPER = {
    first: ['Новое лицо у старого огня. Садись, грейся.', 'Внизу крипта. Кто спускается — тот меняется. Кто возвращается — тот рассказывает.',
      'Прочти свиток возвращения (T) — и окажешься у кольца камней. Портал из кольца вернёт тебя туда, откуда ушёл. Свитки — у торговца и в сундуках.'],
    death1: ['Первый из вас не вернулся. Я видел, как дрогнул огонь.', 'Не горюй о нём: осколки его души остались у алтаря. Ты пойдёшь дальше, чем он.'],
    death: ['Ещё один огонёк погас внизу.', 'Каждый, кто падает, оставляет тропу короче для следующего.'],
    win: ['Ты вернулся с самого дна. Огонь горит ровнее, когда ты рядом.', 'Об этом спуске будут рассказывать у костра. Я — первым.'],
    boss: (name) => [name + ' больше не ходит по крипте. Я почувствовал это даже здесь.', 'Но тьма внизу не пустеет — она ждёт следующего.'],
    rare: (name) => ['«' + name + '»… Такие вещи не падают в руки случайно.', 'Береги её. Или она сбережёт тебя.'],
    away: ['Давно тебя не было. Я уж думал подбросить в огонь ещё одно имя.', 'Отдохни. Глубина никуда не денется.'],
  };
  // a townsperson's loop clock: its own rate and phase per instance, so no two move in sync
  const folkClock = (role, i, t) => { const per = FOLK[role].per * (1 + 0.12 * (((i * 0.618) % 1) - 0.5)), x = (t + i * 1.37) / per, n = Math.floor(x); return { n, u: x - n, per }; };

  // a walker starts standing at a stop of its round (the one it is placed on, give or take the seed's nudge, else the round's last): a first leg from off the round
  // ran into the forge's corner, and the porter skipped his pick-up and walked to the merchant empty-handed (TASKS 1031)
  const folkInit = (npcs) => npcs.map((n, i) => { const r = n.route, k = r ? r.findIndex((q) => Math.hypot(q.x - n.x, q.y - n.y) < 12) : -1, w = r ? (k >= 0 ? k : r.length - 1) : -1;
    return { i, role: n.role, x: r ? r[w].x : n.x, y: r ? r[w].y : n.y, face: 0, dist: 0, vx: 0, vy: 0, spd: 0, way: w, go: 0, t0: -i * 1.9, load: 0, lift: 0, stuck: 0, sayT: -9, byeT: -9, sayN: -1, near: 0 }; });

  Object.assign(D, { QUESTS, questReward, QUEST_GIVE, QUEST_SAY, storyChain, CRAFT, STASH, FOLK, FOLK_SAY, KEEPER, folkClock, folkInit });
})(typeof window !== 'undefined' ? window : globalThis);
