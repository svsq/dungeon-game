// live/scene_qa.js — SCENE.QA(): the named states, cycles, loops and transitions that qa.mjs, swingcheck.mjs, motioncheck.mjs,
// lootvis.mjs and the other checks render (references/engine.md §7). Built from the sim; reads the scene's inside through SCX.
(function () {
  const SCX = window.SCX, { D, EN_TEX, GLOW, SC, SZ, TILE, TOWN_FACE } = SCX;
  const build = () => {
    const mk = (fn) => { const S = SIM.spawn(0, {}); fn(S); return S; };
    const play = (fn) => mk((S) => { S.meta.shards = 9999; SIM.step(S, { keys: [] }); S.run = SIM.newRun(S, 'campaign', 1234); S.screen = 'play'; for (let i = 0; i < 30; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); if (fn) fn(S); });
    const worst = (S) => { const h = S.run.hero; h.lvl = 99; h.gold = 999999; h.xp = 1; h.pts = 99; h.sp = 99; S.meta.shards = 99999; h.ab = { whirl: 5, fireball: 5, shield: 5 };
      for (let i = 0; i < 24; i++) h.bag[i] = Object.assign(SIM.rollItem(S.run, 8, 4), { id: 1000 + i }); h.bag[0] = { id: 2000, b: 'hp_potion', n: 9, rar: 0, lvl: 1, mods: {} }; };
    const h0 = (S) => S.run.hero;
    const states = [
      ['menu', mk((S) => { S.saved = null; })],
      ['title', play((S) => { S.demo = 1; })],
      // look B's parts kit (R-41): every part in every state
      ['uikit', mk((S) => { S.saved = null; S.screen = 'uikit'; })],
      ['menu_continue', mk((S) => { S.saved = SIM.newRun(S, 'campaign', 5); })],
      // TASKS 1815: the menu shows the saved run's hero, a mage or an archer, not the painted warrior
      ...['mage', 'archer'].map((c) => ['menu_continue_' + c, mk((S) => { S.saved = SIM.newRun(S, 'campaign', 5, { cls: c }); })]),
      // the main menu's sheet (TASKS 1301): every slot taken (the longest labels, the longest saved run's line), every item under the
      // keyboard's focus, the pointer over an item; a new run pressed over five taken slots asks, naming the oldest run (TASKS 1785)
      ['menu_full', mk((S) => { for (let i = 0; i < DATA.SAVE_SLOTS; i++) S.saves[i] = SIM.newRun(S, 'campaign', 20 + i); S.saves[0] = null; S.saved = SIM.newRun(S, 'magma', 5); S.saved.floor = 12; S.saved.hero.lvl = 99;
        S.slot = 0; S.focus = 'campaign'; })],
      ...[['menu_full_ask', 'no'], ['menu_full_ask_yes', 'yes']].map(([n, f]) => [n, mk((S) => { for (let i = 0; i < DATA.SAVE_SLOTS; i++) { S.saves[i] = SIM.newRun(S, 'campaign', 20 + i); S.saves[i].at = 1.7e12 + i * 864e5; }
        S.saves[3] = SIM.newRun(S, 'magma', 9, { cls: 'mage' }); S.saves[3].floor = 12; S.saves[3].at = 1.6e12; S.saves[0] = null; S.saved = SIM.newRun(S, 'campaign', 5); S.saved.at = 1.75e12; S.slot = 0;
        S.newAsk = 'campaign'; S.focus = f; S.hover = f === 'yes' ? 'yes' : ''; })]),
      ['menu_full_hover', mk((S) => { for (let i = 1; i < DATA.SAVE_SLOTS; i++) S.saves[i] = SIM.newRun(S, 'campaign', 20 + i); S.saved = SIM.newRun(S, 'cave', 5); S.saved.floor = 0; S.hover = 'load'; S.focus = 'load'; })],
      ...DATA.UI.menu(true).map((b) => ['menu_focus_' + b.id, mk((S) => { S.saved = SIM.newRun(S, 'campaign', 5); S.focus = b.id; })]),
      ['menu_saved_note', play((S) => { S.saved = S.run; S.run = null; S.screen = 'menu'; S.savedT = S.t - 0.5; })],
      ['menu_focus_fresh', mk((S) => { S.saved = null; S.focus = 'tests'; S.hover = 'settings'; })],
      // the test runs' screen (TASKS 417): fresh, and over a saved test run with a button pressed once (the longest labels)
      ['tests', mk((S) => { S.saved = null; S.screen = 'tests'; })],
      // the news frame on the menu (TASKS 1305): the longest it may get (five lines of 80 characters), none at all, the link hovered
      ['menu_news_full', mk((S) => { S.saved = SIM.newRun(S, 'campaign', 5); S.qaNewsMain = Array.from({ length: 5 }, (_, i) => TXT('QA.states.newsMain').slice(0, 80 - i)); })],
      ['menu_news_empty', mk((S) => { S.saved = null; S.qaNewsMain = []; S.hover = 'news'; })],
      ['news', mk((S) => { S.saved = null; S.screen = 'news'; S.newsTop = 0; })],
      ['news_end', mk((S) => { S.saved = null; S.screen = 'news'; S.newsTop = DATA.UI.news(0).max; S.hover = 'back'; })],
      ['tests_saved', mk((S) => { S.saved = SIM.newRun(S, 'cave', 5); S.saved.floor = 4; S.saved.hero.lvl = 13; S.screen = 'tests'; S.hover = 'endless'; })],
      ['tests_full_ask', mk((S) => { for (let i = 1; i < DATA.SAVE_SLOTS; i++) S.saves[i] = SIM.newRun(S, 'campaign', 20 + i); S.saved = SIM.newRun(S, 'magma', 5); S.saved.floor = 4; S.slot = 0; S.screen = 'tests'; S.newAsk = 'magma'; S.focus = 'no'; })],
      ['play', play()],
      ['play_worst', play((S) => { worst(S); S.run.msg = { s: TXT('QA.states.msg.s'), t: S.t - 1 }; })],
      ['inv', play((S) => { worst(S); S.screen = 'inv'; })],
      ['inv_empty', play((S) => { worst(S); S.screen = 'inv'; S.hover = 'eq:offhand'; S.run.seen = S.run.seen.map(() => 1); })],
      ['item_balance', play((S) => {
        worst(S); S.screen = 'inv'; S.hover = 'bag:23';
        S.run.hero.eq.armor = { id: 3000, b: 'plate_armor', lvl: 6, rar: 3, def: 15, mods: {} };
        S.run.hero.bag[23] = { id: 3001, b: 'leather_armor', lvl: 8, rar: 4, def: 24, mods: { hp: 72, mp: 38, aspd: 16, regen: 3 } };
      })],
      // TASKS 182: a bag piece against a worn one of the same slot with other affixes; the swap costs health though its defence is higher
      ['item_compare', play((S) => {
        worst(S); S.screen = 'inv'; S.hover = 'bag:23'; const h = S.run.hero;
        h.eq.amulet = { id: 3010, b: 'amulet', lvl: 5, rar: 3, mods: { hp: 64, vit: 4, crit: 3, regen: 1.5 } };
        h.bag[23] = { id: 3011, b: 'amulet', lvl: 7, rar: 4, mods: { def: 6, int: 5, mp: 40, fire: 18, leech: 2 } };
      })],
      // TASKS 1674: both pieces at their longest (five affixes each, enchantments on the card), the card inside the hero window
      ['item_compare_long', play((S) => {
        worst(S); S.screen = 'inv'; S.hover = 'bag:7'; const h = S.run.hero;
        h.eq.amulet = { id: 3012, b: 'amulet', lvl: 9, rar: 4, mods: { hp: 64, vit: 4, crit: 3, regen: 1.5, mspd: 4, leech: 2 } };
        h.bag[7] = { id: 3013, b: 'amulet', lvl: 12, rar: 4, mods: { def: 6, int: 5, mp: 40, fire: 18, leech: 3, hp: 90, crit: 5 }, ench: [{ k: 'atk', v: 4 }, { k: 'aspd', v: 6 }, { k: 'dodge', v: 3 }, { k: 'mspd', v: 5 }, { k: 'critd', v: 12 }] };
      })],
      ['debug', play((S) => { S.debug = 1; SIM.debugSecrets(S, S.run); S.hover = 'dbg_secrets'; S.run.msg = null; })],
      ['debug_loot', play((S) => { S.debug = 1; S.dbgLoot = 1; S.hover = 'dbg_loot'; const R = S.run; R.msg = null; R.seen = R.seen.map(() => 1); SIM.fstat(R).loot = 999; SIM.fstat(R).lootN = 99999; })],
      ['pause', play((S) => { S.screen = 'pause'; S.run.msg = { s: TXT('QA.states.msg.s.2'), t: S.t - 1 }; })],
      ['pause_finish', play((S) => { S.run.viaTown = 1; S.run.campaignWon = 1; S.screen = 'pause'; S.hover = 'finish'; S.focus = 'back'; })],
      ['pause_ask', play((S) => { S.screen = 'pause'; S.pauseAsk = 1; S.focus = 'no'; S.hover = ''; })],
      ['pause_ask_hover', play((S) => { S.screen = 'pause'; S.pauseAsk = 1; S.focus = 'yes'; S.hover = 'yes'; })],
      ['pause_ask_finish', play((S) => { S.run.viaTown = 1; S.run.campaignWon = 1; S.screen = 'pause'; S.pauseAsk = 1; S.focus = 'no'; S.hover = ''; })],
      // the settings (TASKS 1302): from the menu with the keyboard's focus on the first row, from the pause with the pointer on
      // «Назад», a slider held at its smallest step; and the run at the zoom's ends
      ['settings', mk((S) => { S.saved = null; S.screen = 'settings'; S.setFrom = 'menu'; S.focus = 'zoom'; })],
      // the statistics (TASKS 1309): a first-timer's empty book; a long history whose new counters started at the 38th run, with the
      // widest numbers, on every tab; the keyboard's focus on «Назад»
      ['stats_new', mk((S) => { S.screen = 'stats'; S.statTab = 'all'; S.focus = 'tab:all'; })],
      ...['all', 'warrior', 'archer'].map((tab) => ['stats_full' + (tab === 'all' ? '' : '_' + tab), mk((S) => { const big = (k) => ({ runs: 1247, wins: 133, deaths: 1088, kills: 1234567, elites: 98765, bosses: 4321, shards: 9876543, best: 32, time: 99 * 3600 * 37 + 59 * 60 + k });
        Object.assign(S.meta, { runs: 1284, wins: 140, best: 32, bestEndless: 47, shards: 9999999, stats: { from: 37, all: big(0), cls: { warrior: big(1), mage: Object.assign(big(2), { runs: 412 }), archer: Object.assign(big(3), { runs: 9 }) } } });
        S.screen = 'stats'; S.statTab = tab; S.focus = 'tab:' + tab; S.hover = tab === 'all' ? 'tab:mage' : ''; })]),
      ['stats_back', mk((S) => { Object.assign(S.meta, { runs: 3, wins: 0, best: 4, shards: 120, stats: { from: 0, all: { runs: 3, deaths: 2, kills: 87, elites: 2, shards: 140, best: 4, time: 2400 }, cls: { mage: { runs: 3, deaths: 2, kills: 87, elites: 2, shards: 140, best: 4, time: 2400 } } } });
        S.screen = 'stats'; S.statTab = 'mage'; S.focus = 'back'; S.hover = 'back'; })],
      // the saved games (TASKS 1311): none; every slot taken with the widest lines (a test run's name, level 99, two-digit floors,
      // thousands of hours, a save from before the dates), the keyboard on a slot, on «Загрузить», an empty slot chosen, the delete question
      ...(() => { const fill = (S, n) => { const runs = [['magma', 12, 99, 'hard', 3600 * 4321 + 59 * 60], ['campaign', 0, 1, 'easy', 59], ['cave', 14, 47, 'normal', 3600 * 9 + 5 * 60], ['campaign', 16, 63, 'normal', 3600 * 123], ['endless', 47, 88, 'hard', 3600 * 77 + 600]];
          runs.slice(0, n).forEach(([mode, floor, lvl, diff, play], i) => { const R = SIM.newRun(S, mode, 11 + i, { cls: ['mage', 'warrior', 'archer'][i % 3] }); Object.assign(R, { floor, diff, play, at: i === 3 ? undefined : 1794182340000 - i * 90061000 }); R.hero.lvl = lvl; S.saves[i] = R; });
          S.saved = S.saves[0]; S.saves[0] = null; S.slot = 0; S.screen = 'load'; };
        return [['load_empty', mk((S) => { S.screen = 'load'; S.loadSel = 0; S.focus = 'slot:0'; })],
          ['load_full', mk((S) => { fill(S, 5); S.loadSel = 0; S.focus = 'slot:0'; S.hover = 'slot:3'; })],
          ['load_old', mk((S) => { fill(S, 5); S.loadSel = 3; S.focus = 'go'; })],
          ['load_gap', mk((S) => { fill(S, 3); S.loadSel = 4; S.focus = 'slot:4'; S.hover = 'back'; })],
          ['load_ask', mk((S) => { fill(S, 5); S.loadSel = 2; S.delAsk = 2; S.focus = 'yes'; S.hover = 'yes'; })],
          ['load_ask_rest', mk((S) => { fill(S, 5); S.loadSel = 2; S.delAsk = 2; S.focus = 'no'; S.hover = 'yes'; })],
          ['load_ask_focus', mk((S) => { fill(S, 5); S.loadSel = 2; S.delAsk = 2; S.focus = 'no'; S.hover = ''; })]]; })(),
      ['settings_pause', play((S) => { S.screen = 'settings'; S.setFrom = 'pause'; S.focus = 'back'; S.hover = 'back'; S.meta.zoom = 1.5; })],
      ['settings_drag', mk((S) => { S.saved = null; S.screen = 'settings'; S.setFrom = 'menu'; S.focus = 'zoom'; S.hover = 'zoom'; S.drag = 'zoom'; S.pressWas = true; S.meta.zoom = 0.5; })],
      ['play_zoom05', play((S) => { S.meta.zoom = 0.5; for (let i = 0; i < 240; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); })],
      ['play_zoom075', play((S) => { S.meta.zoom = 0.75; for (let i = 0; i < 240; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); })],
      // the brightness's ends (TASKS 1303): the world graded, the HUD as it was
      ['play_bright_lo', play((S) => { S.meta.bright = DATA.SETTINGS.find((q) => q.id === 'bright').stops[0]; })],
      ['play_bright_hi', play((S) => { const q = DATA.SETTINGS.find((o) => o.id === 'bright'); S.meta.bright = q.stops[q.stops.length - 1]; })],
      ['settings_bright', play((S) => { S.screen = 'settings'; S.setFrom = 'pause'; S.focus = 'bright'; S.meta.bright = 1.4; })],
      ['settings_gfx', play((S) => { S.screen = 'settings'; S.setFrom = 'pause'; S.focus = 'gfx'; S.meta.gfx = 0; })],   // (TASKS 1372)
      ['play_gfx_lo', play((S) => { S.meta.gfx = 0; })],
      ['play_gfx_mid', play((S) => { S.meta.gfx = 1; })],
      ['settings_vol', mk((S) => { S.saved = null; S.screen = 'settings'; S.setFrom = 'menu'; S.focus = 'vol'; S.meta.vol = 0.25; })],
      ['settings_full', mk((S) => { S.saved = null; S.screen = 'settings'; S.setFrom = 'menu'; S.focus = 'full'; S.hover = 'full'; S.meta.full = 1; })],
      ['play_zoom15', play((S) => { S.meta.zoom = 1.5; for (let i = 0; i < 240; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); })],
      ['meta', mk((S) => { S.screen = 'meta'; S.meta.shards = 99999; S.meta.up = Object.fromEntries(D.META.map((M, i) => [M.id, i % 3 ? M.max - 1 : i % 2 ? M.max : 0])); })],
      ['meta_refuse', mk((S) => { S.screen = 'meta'; S.meta.shards = 0; S.hover = 'gear'; S.ev.push({ k: 'nope', s: TXT('QA.states.s'), t: S.t - 0.2 }); })],
      // a dungeon altar at its widest: the longest gift of each tier, one affordable, one hovered, a refusal; then the gifts in the HUD
      ...[['altar_screen', 99999, 'gift:1'], ['altar_poor', 5, 'gift:2']].map(([id, bank, hv]) => [id, play((S) => {
        const R = S.run, h = R.hero, long = (tier) => D.GIFTS.filter((g) => g.tier === tier).sort((a, b) => b.desc.length + b.name.length - a.desc.length - a.name.length)[0].id;
        R.shrines = [{ x: h.x + 70, y: h.y, used: 0, gifts: [1, 2, 3].map((tier) => ({ id: long(tier), cost: bank > 999 ? 999 : D.giftCost(tier, 8) })) }]; R.altar = 0;
        S.meta.shards = bank; S.screen = 'altar'; S.hover = hv; if (bank < 999) S.ev.push({ k: 'nope', s: TXT('QA.states.s.2'), t: S.t - 0.2 }); })]),
      ['altar_powers', play((S) => { const R = S.run, h = R.hero; h.powers = { whirl_pull: 1, dash_trail: 1, dash_strike: 1 }; R.shrines = [{ x: h.x + 70, y: h.y, used: 0, gifts: [{ id: 'bless', cost: 9 }, { id: 'whirl_ring', cost: 50 }, { id: 'leap_trap', cost: 90 }] }]; R.altar = 0; S.meta.shards = 200; S.screen = 'altar'; S.hover = 'gift:1'; })],
      ['altar_relic', play((S) => { const R = S.run, h = R.hero; R.shrines = [{ x: h.x + 70, y: h.y, used: 0, gifts: [{ id: 'bless', cost: 9 }, { id: 'whirl_ring', cost: 50 }, { id: 'leap_trap', cost: 90 }, { id: 'rl_fifth', cost: 180 }] }]; R.altar = 0; S.meta.shards = 200; S.screen = 'altar'; S.hover = 'gift:3'; })],
      ['altar_rank', play((S) => { const R = S.run, h = R.hero; h.perks = { fury: 2 }; R.shrines = [{ x: h.x + 70, y: h.y, used: 0, rolls: 2, gifts: [{ id: 'bless', cost: 9 }, { id: 'crit', cost: 50 }, { id: 'fury', cost: 90 }] }]; R.altar = 0; S.meta.shards = 200; S.screen = 'altar'; S.hover = 'reroll'; })],
      // the gift's line after the altar at its longest (TASKS 1829)
      ['altar_gift_msg', play((S) => { const G = D.GIFTS.reduce((a, b) => (TXT('sim_town.takeGift.msg', b).length > TXT('sim_town.takeGift.msg', a).length ? b : a)); S.run.msg = { s: TXT('sim_town.takeGift.msg', G), t: S.t - 1 }; })],
      ['altar_prompt', play((S) => { const R = S.run, h = R.hero; R.shrines = [{ x: h.x + 50, y: h.y - 20, used: 0 }]; })],
      // the interaction plate with its target on each side of the hero and the stairs right under him: it never covers him
      ...[['s', 0, 36], ['n', 0, -40], ['e', 44, 0], ['se', 30, 30]].map(([d, dx, dy]) => ['prompt_chest_' + d, play((S) => { const R = S.run, h = R.hero; R.chests.push({ x: h.x + dx, y: h.y + dy, tier: 1, open: 0 }); })]),
      // a chest of every rank, shut and open, and a boss's sealed chest with its plate (TASKS 1356)
      ['chest_tiers', play((S) => { const R = S.run, h = R.hero; R.en = []; R.msg = null; R.seen.fill(1); R.rseen.fill(1); h.y += 20; const tl = TILE * 2.2;
        [[1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1]].forEach(([tier, op], i) => R.chests.push({ x: h.x + (i % 3 - 1) * tl, y: h.y - (op ? 40 : 110), tier, open: op, openT: S.t - 2 }));
        R.chests.push({ x: h.x + 2 * tl, y: h.y - 60, tier: 3, boss: 1, sealed: 1, open: 0 }); R.chests.push({ x: h.x - 2 * tl, y: h.y - 60, tier: 3, boss: 1, open: 1, openT: S.t - 2 }); })],
      // the lid coming up, the recoil and the glint of every rank (TASKS 1676); D = 0.22 / 0.28 / 0.34 / 0.55
      ...[[1, 0], [2, 0], [3, 0], [3, 1]].flatMap(([tier, boss]) => [['a', 0.08], ['b', 0.5], ['c', 0.92], ['d', 1.15]].map(([p, f]) => ['chest_open_' + (boss ? 'boss' : 't' + tier) + '_' + p, play((S) => { const R = S.run, h = R.hero; R.en = []; R.msg = null; R.seen.fill(1); R.rseen.fill(1); const D = boss ? 0.55 : [0.22, 0.28, 0.34][tier - 1], a = D * f, c = { x: h.x + 70, y: h.y - 10, tier, boss, open: 1, openT: S.t - a, loot: [] }; R.chests.push(c); S.ev.push({ k: 'chest', t: S.t - a, x: c.x, y: c.y, tier, boss }); })])),
      ['prompt_chest_sealed', play((S) => { const R = S.run, h = R.hero; R.en = []; R.chests.push({ x: h.x + 44, y: h.y, tier: 3, boss: 1, sealed: 1, open: 0 }); })],
      // a trapped chest giving itself away, its fuse burning and its blast (TASKS 1357)
      ...[['chest_trap_shut', 0], ['chest_trap_fuse_a', 0.08], ['chest_trap_fuse', 0.3], ['chest_trap_fuse_c', 0.52], ['chest_trap_bang_a', 0.58], ['chest_trap_bang', 0.7], ['chest_trap_bang_c', 1.1], ['chest_trap_after', 2.6]].map(([id, a]) => [id, play((S) => { const R = S.run, h = R.hero; R.en = []; R.msg = null; R.seen.fill(1); R.rseen.fill(1); const f = a && a < 0.55, c = { x: h.x + 60, y: h.y - 30, tier: 2, open: a ? 1 : 0, trap: 1, openT: S.t - a }; if (f) c.fuseT = S.t + 0.55 - a; if (a >= 0.55) c.bangT = S.t - (a - 0.55); R.chests.push(c);
        if (a) { S.ev.push({ k: f ? 'trapfuse' : 'trapbang', t: S.t - (f ? a : a - 0.55), x: c.x, y: c.y, d: 0.55, r: 96 }); if (!f) { S.ev.push({ k: 'boom', t: S.t - (a - 0.55), x: c.x, y: c.y - 20, big: 1, r: 96 }); } } })]),
      // a mimic getting up, gaping, in the air and biting (TASKS 367)
      ...[1, 2, 3].flatMap((tier) => [['wake', 'rise', 0.3], ['wind', 'wind', 0.45], ['air', 'strike', 0.2], ['bite', 'strike', 0.5]].map(([nm, st, a]) => ['mimic_' + nm + (tier === 2 ? '' : '_t' + tier), st, a, tier])).map(([id, st, a, tier]) => [id, play((S) => { const R = S.run, h = R.hero; R.msg = null; R.en = []; R.seen.fill(1); const c = { x: h.x + 90, y: h.y - 20, tier, open: 0, mimic: 1, loot: [] }; R.chests.push(c); SIM.openChest(S, R, c); const e = R.en[0]; e.st = st; e.t0 = S.t - a; e.jx = e.x; e.jy = e.y; e.jtx = e.x - 40; e.jty = e.y; e.hitDone = a > 0.42 ? 1 : 0; e.aimA = Math.PI; e.face = -1; })]),
      ...[1, 3].flatMap((tier) => [['die_a', 0.12], ['die_b', 0.32], ['die_c', 3]].map(([nm, d]) => ['mimic_' + nm + '_t' + tier, play((S) => { const R = S.run, h = R.hero; R.msg = null; R.en = []; R.seen.fill(1); const c = { x: h.x + 90, y: h.y - 20, tier, open: 0, mimic: 1, loot: [] }; R.chests.push(c); SIM.openChest(S, R, c); const e = R.en[0]; e.st = 'idle'; e.hp = 0; e.deadT = S.t - d; e.dieA = 0; })])),
      ...[[0, 'mimic_step_a'], [8, 'mimic_step_b']].map(([dist, id]) => [id, play((S) => { const R = S.run, h = R.hero; R.msg = null; R.en = []; R.seen.fill(1); const c = { x: h.x + 90, y: h.y - 20, tier: 3, open: 0, mimic: 1, loot: [] }; R.chests.push(c); SIM.openChest(S, R, c); const e = R.en[0]; e.st = 'chase'; e.t0 = S.t - 3; e.vx = -26; e.dist = dist + 3; e.face = -1; })]),
      ...[1, 2, 3].map((tier) => ['mimic_shut' + (tier === 2 ? '' : '_t' + tier), play((S) => { const R = S.run, h = R.hero; R.msg = null; R.en = []; R.seen.fill(1); R.chests.push({ x: h.x + 90, y: h.y - 20, tier, open: 0, mimic: 1 }); })]),
      // broken pots, vases, crates and barrels: in the air, and lying a while later (TASKS 1352)
      ...[['debris_air', 0.15], ['debris_hop', 0.6], ['debris_rest', 5]].map(([id, a]) => [id, play((S) => { const R = S.run, h = R.hero; R.en = []; R.msg = null; R.chests = []; R.seen.fill(1); ['pot', 'vase_a', 'vase_b', 'crate', 'barrel'].forEach((kind, i) => { const p = { x: h.x + (i - 2) * 66, y: h.y - 46 + (i % 2) * 22, kind, hp: 0, brokeT: S.t - a }; R.pots.push(p); S.ev.push({ k: 'break', x: p.x, y: p.y, kind, t: p.brokeT }); }); })]),
      // a smashed wreck's planks on the shore (TASKS 1361)
      ...[['wreck_broken', 5], ['wreck_breaking', 0.25]].map(([id, age]) => [id, play((S) => { for (let sd = 1; sd < 200; sd++) { const R0 = SIM.newRun(S, 'cave', 1361 + sd), d = R0.map.decor.find((o) => o.n === 'wreck_cv'); if (!d) continue; S.run = R0; const h = R0.hero; h.x = d.x + 90; h.y = d.y + 40; d.broken = 1; d.brokeT = S.t - age; d.solid = 0; R0.en = []; R0.msg = null; R0.seen.fill(1); R0.rseen.fill(1); R0.cam = [d.x - SCX.VW / 2, d.y - SCX.VH / 2]; break; } })]),
      // a skeleton climbing out of a struck coffin (TASKS 1353)
      ...[['coffin_rise_a', 0.2], ['coffin_rise', 0.5], ['coffin_rise_c', 0.85], ['coffin_rise_d', 1.3]].map(([id, age]) => [id, play((S) => { const R = S.run, h = R.hero; R.msg = null; R.en = []; R.seen.fill(1); R.map.decor.push({ x: h.x + 80, y: h.y - 40, n: 'coffin', solid: 1, rolled: 1, openT: S.t - age }); const E = D.ENEMIES.skeleton; R.en.push({ id: 991, type: 'skeleton', x: h.x + 80, y: h.y - 10, vx: 0, vy: 0, hp: 9, max: 9, dmg: 1, elite: 0, room: 0, st: age < 1 ? 'rise' : 'chase', t0: S.t - age, riseD: 1, coffinT: S.t - age, coffX: h.x + 80, coffY: h.y - 40, face: -1, aimA: 0, cdT: S.t + 2, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: 'amb', spawnT: S.t, seenT: S.t, hx: h.x, hy: h.y, ft: -9 }); })]),
      // a secret's statue: the plate that offers to move it (TASKS 1354)
      ['prompt_statue', play((S) => { for (let sd = 1; sd < 220; sd++) { const R0 = SIM.newRun(S, 'campaign', 13540 + sd), q = (R0.map.secrets || []).find((o) => o.kind === 'statue'); if (!q) continue; S.run = R0; const h = R0.hero; h.x = q.x; h.y = q.y + 80; R0.en = []; R0.msg = null; R0.seen.fill(1); R0.rseen.fill(1); R0.cam = [q.x - SCX.VW / 2, q.y - SCX.VH / 2]; break; } })],
      ['prompt_exit', play((S) => { const R = S.run, h = R.hero; R.map.exit = { x: h.x, y: h.y + 40 }; })],
      ['gifts_hud', play((S) => { const h = S.run.hero; h.bless = 1; h.shield = 999; h.shieldUntil = S.t + 3; h.burn = h.poison = S.t + 2;
        h.perks = Object.fromEntries(D.GIFTS.filter((g) => g.id !== 'bless').map((g) => [g.id, 3])); })],
      ['dead', mk((S) => { S.screen = 'dead'; S.result = { how: 'dead', floor: 8, lvl: 99, kills: 9999, gold: 999999, shards: 99999, found: 9999, base: 12529, statBonus: 40, cap: 40, win: 0, time: 35999, C: { floors: 8, foes: 9999, kills: 9999, lootN: 9999, loot: 9999, secN: 16, sec: 16, pct: 1 } }; })],
      ['win', mk((S) => { S.screen = 'win'; S.result = { how: 'win', floor: 12, lvl: 99, kills: 9999, gold: 999999, shards: 99999, found: 9999, base: 12529, statBonus: 40, cap: 40, win: 30, time: 35999, C: { floors: 8, foes: 9999, kills: 9999, lootN: 9999, loot: 9999, secN: 16, sec: 16, pct: 1 } }; })],
      ['dead_short', mk((S) => { S.screen = 'dead'; S.result = { how: 'dead', floor: 1, lvl: 1, kills: 0, gold: 0, shards: 0, found: 0, base: 0, statBonus: 0, cap: 5, win: 0, time: 12, C: { floors: 1, passed: 0, foes: 20, kills: 0, lootN: 30, loot: 0, secN: 0, sec: 0, pct: 0 } }; })],
    ];
    for (const [name, S] of states.filter(([n]) => ['dead', 'win', 'dead_short'].includes(n))) {
      const R = SIM.newRun(S, 'campaign', 1234); S.result.hero = R.hero; S.result.heroStats = SIM.stats(R.hero, S.meta);
      if (name !== 'dead_short') S.meta.shards = 99999;
      S.result.damage = name === 'dead_short' ? [] : [{ t: 1, src: 'lava', n: 28 }, { t: 2, src: 'boss bolt', n: 75 },
        { t: 3, src: 'brute elite blast', n: 180, actor: { type: 'brute', elite: 1, mods: ['explosive', 'vampire'] } }];
    }
    // a run through the town ends on «Вернуться в город» (TASKS 1006)
    { const [, S0] = states.find(([n]) => n === 'dead'), S = Object.assign({}, S0, { result: Object.assign({}, S0.result, { town: 1, allFree: 1 }) }); states.push(['dead_town', S]); }
    for (const [name, src, actor] of [['dead_caster', 'cultist elite bolt', { type: 'cultist', elite: 1, mods: ['summoner', 'vampire'] }], ['dead_lava', 'lava', null],
      ['dead_ghost', 'ghost', { type: 'ghost', elite: 0 }], ['dead_boss', 'boss', { type: 'boss', elite: 1 }]]) {
      const S = structuredClone(states.find(([n]) => n === 'dead')[1]); S.result.damage[2] = { t: 3, src, n: 99, actor }; states.push([name, S]);
    }
    { const S = structuredClone(states.find(([n]) => n === 'dead')[1]); S.result.log = { fl: [] }; S.hover = 'log'; states.push(['dead_log_tip', S]); }
    const abandoned = structuredClone(states.find(([n]) => n === 'dead')[1]); abandoned.result.abandoned = true; states.push(['end_abandoned', abandoned]);
    for (const b of ['longsword', 'axe', 'hammer', 'staff', 'fist']) {
      const S = structuredClone(states.find(([n]) => n === 'win')[1]);
      S.result.hero.eq.weapon = b === 'fist' ? null : { b, rar: 4, lvl: 8, mods: {} }; S.result.heroStats = SIM.stats(S.result.hero, S.meta);
      states.push(['win_' + b, S]);
    }
    for (const [name, gold, donations, used] of [['altar_donation', 123456, 4, 0], ['altar_used', 99999, 8, 1], ['altar_limit', 99999, 10, 1]]) {
      const S = structuredClone(states.find(([n]) => n === 'altar_screen')[1]); S.run.hero.gold = gold; S.run.donations = donations; S.run.shrines[0].used = used; S.hover = 'donate'; states.push([name, S]);
    }
    for (const pct of [0.84, 0.85, 1]) states.push(['completion_' + Math.round(pct * 100), play((S) => {
      const R = S.run, f = SIM.fstat(R); R.msg = null; R.seen = R.seen.map(() => 1); f.foes = f.lootN = 100; f.kills = f.loot = Math.round(pct * 100);
      R.en = R.en.slice(0, 2);
    })]);
    for (const [name, age] of [['shard_flash', 0.1], ['shard_flight', 0.55], ['shard_arrival', 1.05]]) {
      states.push([name, play((S) => { worst(S); S.run.msg = null; const h = S.run.hero; S.ev = [{ k: 'shard', x: h.x, y: h.y, n: 3, floor: S.run.floor, t: S.t - age }]; })]);
    }
    states.push(['shard_floor', play((S) => { SIM.enterFloor(S, S.run, 8); worst(S); S.run.msg = { s: TXT('QA.msg.s'), t: S.t - 0.8 }; const h = S.run.hero; S.ev = [{ k: 'shard', x: h.x, y: h.y, n: 10, floor: 8, s: TXT('QA.ev.shard.s'), t: S.t - 0.8 }]; })]);
    // the reference's composition: a fight in a lit room with an accent zone in the frame's far side, monsters standing apart
    // on a ring around the hero mid-swing, a chest and gold at the back wall
    // the fight mid-frame (its room half a view clear of the map's edges, so the camera never clamps), the blue hall in the frame's
    // lower right, the green crypt in its upper right and a lava field in its left third: the zones are set on the seed's own
    // layout, not searched for (TASKS 189)
    // seed 290 is the one a search over the 189 / 184 measures picked (SC.matchSeed starts the search elsewhere)
    // (on the 1st floor's map as it was when the composition was set, 72×54: the floor's own 56×42 is narrower than the view, TASKS 373)
    const stage = { size: [72, 54], rooms: 13, secretK: 1 };
    const match = (() => { for (let sd = SC.matchSeed || 290; sd < 900; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run; SIM.enterFloor(S, R, 1, { stage }); let m = R.map;
      const MW = m.W * TILE, MH = m.H * TILE, ctr = (r) => [(r.x + r.w / 2) * TILE, (r.y + r.h / 2) * TILE];
      const fits = (r) => { const [x, y] = ctr(r); return x >= 0.52 * SCX.VW && MW - x >= 0.52 * SCX.VW && y >= 0.52 * SCX.VH && MH - y >= 0.52 * SCX.VH; };
      const rm = m.rooms.find((r) => r.type === 'combat' && r.w >= 10 && r.h >= 7 && !r.wings && !r.pit && fits(r));
      if (!rm) continue;
      // each zone the room nearest to where the concept has it: the blue hall at 88 % of the width and 72 % of the height, the crypt
      // at 77 % and 23 % (but left of the minimap)
      const hx = ctr(rm)[0], hy = ctr(rm)[1] + 16, zr = (dx0, dx1, dy0, dy1, tx, ty) => m.rooms.filter((q) => q !== rm && q.type === 'combat' && q.w >= 7 && q.h >= 6)
        .map((q) => [q, ctr(q)[0] - hx, ctr(q)[1] - hy]).filter(([, dx, dy]) => dx >= dx0 && dx <= dx1 && dy >= dy0 && dy <= dy1).sort((a, b) => Math.hypot(a[1] - tx, a[2] - ty) - Math.hypot(b[1] - tx, b[2] - ty))[0];
      const arc = zr(0.22 * SCX.VW, 0.46 * SCX.VW, -0.05 * SCX.VH, 0.42 * SCX.VH, 0.37 * SCX.VW, 0.22 * SCX.VH), cry = zr(0.1 * SCX.VW, 0.3 * SCX.VW, -0.5 * SCX.VH, -0.08 * SCX.VH, 0.26 * SCX.VW, -0.27 * SCX.VH);
      if (!arc || !cry) continue;
      const cam = [hx - 0.51 * SCX.VW, hy - 0.51 * SCX.VH], inView = (r) => r.x * TILE < cam[0] + SCX.VW && (r.x + r.w) * TILE > cam[0] && r.y * TILE < cam[1] + SCX.VH && (r.y + r.h) * TILE > cam[1];
      // the concept's blue hall runs on to the frame's right edge: the rooms past it to the right and below join it
      const past = (r) => r !== rm && r !== cry[0] && ctr(r)[0] - hx > arc[1] + 4 * TILE && ctr(r)[1] - hy > -0.05 * SCX.VH;
      const zones = {}; for (const r of m.rooms) if (inView(r)) zones[r.id] = r === arc[0] || past(r) ? 'arcane' : r === cry[0] ? 'crypt' : null;
      const was = JSON.stringify(m.rooms.map((r) => [r.x, r.y, r.w, r.h])); SIM.enterFloor(S, R, 1, { zones, stage }); m = R.map;
      if (JSON.stringify(m.rooms.map((r) => [r.x, r.y, r.w, r.h])) !== was) continue;
      const h = R.hero, inR = (o) => DUNGEON.roomAt(m, o.x, o.y) === rm.id;
      m.traps = m.traps.filter((t2) => !inR(t2)); m.decor = m.decor.filter((d) => d.wall || !inR(d)); R.pots = R.pots.filter((p) => !inR(p)); R.chests = R.chests.filter((c) => !inR(c)); m.torches = m.torches.filter((t2) => t2.kind === 'wall' || !inR(t2));
      for (const fx of [rm.x + 1.5, rm.x + rm.w - 1.5]) m.torches.push({ x: fx * TILE, y: (rm.y + 1.6) * TILE, kind: 'brazier', r: rm.id });
      h.x = hx; h.y = hy;
      h.eq.armor = { id: 3100, b: 'plate_armor', lvl: 1, rar: 0, def: 3, mods: {} }; h.eq.boots = { id: 3101, b: 'boots', lvl: 1, rar: 0, def: 1, mods: {} };   // the concept's hero wears steel (TASKS 166)
      R.cam = cam;
      // the concept's lava fills the frame's left third: a field of 10×7 cells with a ragged shore, wide enough for its crust and
      // plates, on the open floor there rather than the rock where it can, never in the fight's room or a doorway (TASKS 169, 189)
      { const c0 = Math.floor(cam[0] / TILE), r0 = Math.floor(cam[1] / TILE), dr = new Set((m.doors || []).flatMap((d) => d.cells.map(([x, y]) => y * m.W + x)));
        const shape = []; for (let j = 0; j < 7; j++) for (let k = 0; k < 10; k++) if (!((j === 0 || j === 6) && (k === 0 || k === 9)) && !(j === 0 && k === 8) && !(j === 6 && k === 1) && !(j === 3 && k === 9)) shape.push([k, j]);
        shape.push([-1, 2], [-1, 3], [10, 1], [10, 4], [3, -1], [4, -1], [5, 7], [6, 7]);
        const near = (x, y) => { for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const id = DUNGEON.roomAt(m, (x + k + 0.5) * TILE, (y + j + 0.5) * TILE); if (id === rm.id || (id >= 0 && m.rooms[id].type !== 'combat') || dr.has((y + j) * m.W + x + k)) return true; } return false; };
        let best = null;
        // as near as it can to where the concept has it: its top a third down the frame, at the left edge
        for (let y = r0 + 7; y <= r0 + 20; y++) for (let x = c0; x <= c0 + 9; x++) { let sc = 0;
          for (const [k, j] of shape) { const X = x + k, Y = y + j; if (X < 1 || Y < 1 || X >= m.W - 1 || Y >= m.H - 1 || near(X, Y)) { sc = -1; break; } sc += SIM.cell(m, X, Y) === 1 ? 2 : 1; }
          if (sc > 0) sc -= 8 * (Math.abs(y - r0 - 11) + Math.abs(x - c0 - 1));
          if (sc > 0 && (!best || sc > best[2])) best = [x, y, sc]; }
        const pool = best ? shape.map(([k, j]) => [best[0] + k, best[1] + j]) : [];
        const on = (o) => pool.some(([x, y]) => Math.abs(Math.floor(o.x / TILE) - x) <= 1 && Math.floor(o.y / TILE) - y >= -1 && Math.floor(o.y / TILE) - y <= 2);
        for (const [x, y] of pool) m.cells[y * m.W + x] = 3; m.lava = (m.lava || 0) + pool.length;
        m.decor = m.decor.filter((d) => !on(d)); R.pots = R.pots.filter((p) => !on(p)); R.chests = R.chests.filter((c) => !on(c)); m.torches = m.torches.filter((t2) => !on(t2)); m.traps = m.traps.filter((t2) => !on(t2)); }
      R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      const types = ['skeleton', 'skeleton', 'goblin', 'brute', 'skeleton', 'spider', 'cultist'], ang = [0, 0.9, 1.8, 2.3, 3.3, 5.0, 4.4];   // the 5th stands clear of the gold chest: its bar and number stay off it; the demon in front of it, its face clear
      R.en = types.map((ty, i) => { const a = ang[i], E = D.ENEMIES[ty]; return { id: 900 + i, type: ty, x: h.x + Math.cos(a) * (150 + 40 * (i % 2)), y: h.y + Math.sin(a) * 110, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: rm.id, st: 'chase', t0: 0, face: Math.cos(a) > 0 ? -1 : 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }; });
      // the gold chest where the concept has its chests, at the bottom wall right of the fight: under a brazier its fire washes it orange
      R.chests.push({ x: h.x + 2.5 * TILE, y: (rm.y + rm.h - 1) * TILE + 4, tier: 2, open: 1, openT: S.t - 3, gold: 1 });
      // gold lying loose and spilt coins round the chest and the fight: the concept's yellow sparkle (TASKS 167)
      for (const [gx, gy] of [[-2, 1.2], [-4.6, 1.6], [2, 6.6]]) R.drops.push({ id: 9e5 + gx, kind: 'gold', n: 40, x: h.x + gx * TILE, y: (rm.y + gy) * TILE + 10, vx: 0, vy: 0, z: 0, vz: 0, t0: -9 });
      R.pots.push({ x: h.x + 3.5 * TILE, y: (rm.y + 1) * TILE + 10, kind: 'goldpile', hp: 1 });
      for (let i = 0; i < 22; i++) { const a = i * 2.4, r = 30 + 14 * (i % 4) + 10 * (i >= 11), c = i % 11 < 6 ? [h.x - 3.5 * TILE, (rm.y + 1.6) * TILE] : [h.x, h.y + 10];
        m.decals.push({ x: c[0] + Math.cos(a) * r, y: c[1] + Math.sin(a) * r * 0.6, n: 'dc_coins', f: i & 1, s: 0.7 + 0.08 * (i % 3) }); }
      const A = SIM.K.HIT + 0.03; h.atkT = S.t - A; h.atkA = 0; h.aim = 0; h.face = 1; S.ev.push({ k: 'swing', t: S.t - A, x: h.x, y: h.y, a: 0, f: 1 });
      R.en.slice(0, 5).forEach((e, i) => { e.hp = Math.round(e.max * 0.6); if (R.map.torches.some((tc) => tc.kind !== 'wall' && Math.abs(tc.x - e.x) < 60 && e.y - tc.y > 0 && e.y - tc.y < 160)) return; S.ev.push({ k: 'hit', t: S.t - 0.1 - 0.08 * i, x: e.x, y: e.y - D.ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: 12, crit: i === 2 ? 1 : 0, id: e.id }); });
      return S; } })();
    states.push(['match', match]);
    const brawl = (mods = ['vampire'], more) => play((S) => {
      const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0];
      h.x = (rm.x + rm.w / 2) * TILE; h.y = (rm.y + rm.h / 2) * TILE; h.hp = 45; h.hurtT = S.t - 0.18; h.hurtX = -1;
      R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; R.seen.fill(1); R.rseen.fill(1); R.msg = null; R.drops = []; R.chests = []; R.pots = [];
      m.decor = m.decor.filter((d) => DUNGEON.roomAt(m, d.x, d.y) !== rm.id);
      R.en = [['goblin', 28, 0], ['skeleton', 18, -24], ['goblin', 22, 28]].map(([ty, dx, dy], i) => {
        const E = D.ENEMIES[ty]; return { id: 970 + i, type: ty, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: E.hp * 0.6, max: E.hp, dmg: 1, elite: i === 0 ? 1 : 0,
          mods: i === 0 ? mods : undefined, room: rm.id, st: 'wind', t0: S.t - 0.2, face: -1, aimA: Math.PI, cdT: 99, hitT: S.t - 0.03, hitP: S.t - 0.43, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 };
      });
      S.ev = R.en.slice(0, 2).map((e, i) => ({ k: 'hit', t: S.t - 0.15 - i * 0.1, x: e.x, y: e.y - D.ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: 15 + i, id: e.id }));
      S.ev.push({ k: 'hurt', t: S.t - 0.18, x: h.x, y: h.y - 40, n: 8, side: -1 });
      if (more) more(S);
    });
    // the descent's deep powers (TASKS 387): a warded, cursing elite with its shield up, the hero cursed, a blink landing; the whirl's hint (TASKS 390)
    const deep = (S) => { const R = S.run, h = R.hero, e = R.en[0]; e.ward = Math.round(e.max * 0.2); h.curseT = S.t + 2; h.chillT = S.t + 1.5; R.en[1].nm = D.ELITE_NAMES.bones.names[0][0] + ' ' + D.ELITE_NAMES.bones.adj[0][0]; R.en[1].elite = 1; R.en[1].mods = ['tug', 'frost'];
      S.ev.push({ k: 'tug_warn', t: S.t - 0.35, x: R.en[1].x, y: R.en[1].y, id: R.en[1].id, d: 0.6 });
      S.ev.push({ k: 'blink', t: S.t - 0.12, x: h.x + 240, y: h.y - 70, tx: e.x, ty: e.y, id: e.id }); R.msg = { s: D.TIPS.whirl.s, t: S.t - 1, d: 3, tip: 'whirl' }; };
    states.push(['elite_brawl', brawl()], ['elite_brawl_long', brawl(['explosive', 'fiery'])], ['elite_deep', brawl(['ward', 'curse'], deep)]);
    for (const [name, age, fx] of [['early', 0.03, 'boom'], ['mid', 0.15, 'boom'], ['late', 0.35, 'boom'], ['bolt', 0.03, 'pop']]) {
      const S = brawl(); S.ev.push({ k: fx, t: S.t - age, x: S.run.hero.x, y: S.run.hero.y - 40, big: 1, hero: 1, c: 'fire' });
      states.push(['elite_brawl_' + name, S]);
    }
    for (const [i, gap] of [0.22, 0.4, 0.6].entries()) {
      const S = brawl(), e = S.run.en[0]; e.hitP = e.hitT - gap;
      states.push(['elite_hit_' + i, S]);
    }
    const spellState = (kind, age, edge = false) => play((S) => {
      const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0];
      let spot = null;
      for (let y = rm.y + 1; y < rm.y + rm.h - 1; y++) for (let x = rm.x + 1; x < rm.x + rm.w - 1; x++) {
        if (SIM.cell(m, x, y) !== 1 || edge && SIM.cell(m, x + 1, y) !== 0) continue;
        let score = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) score += SIM.cell(m, x + dx, y + dy) === 1 ? 1 : 0;
        if (!spot || score > spot.score) spot = { x, y, score };
      }
      const x = ((spot ? spot.x : rm.cx) + 0.5) * TILE, y = ((spot ? spot.y : rm.cy) + 0.5) * TILE;
      h.x = x - (kind === 'fireball' ? 90 : kind === 'boom' ? 28 : 0); h.y = y; h.aim = 0; h.face = 1; h.vx = h.vy = 0;
      h.castT = h.whirlT = -9; R.msg = null; R.en = []; R.chests = []; R.pots = []; R.drops = []; R.scorches = []; R.trauma = 0;
      m.decor = m.decor.filter((d) => DUNGEON.roomAt(m, d.x, d.y) !== rm.id); m.traps = [];
      R.seen.fill(1); R.rseen.fill(1); R.cam = [x - SCX.VW / 2, y - SCX.VH / 2]; S.ev = [];
      if (kind === 'whirl') { h.whirlT = h.castT = S.t - age; h.whirlA = 0; h.castK = 'whirl'; S.ev = [{ k: 'whirl', x: h.x, y: h.y, a: 0, r: D.abRank('whirl', 1).r, rar: 0, t: S.t - age }]; }
      if (kind === 'fireball') { h.castT = S.t - age; h.castK = 'fireball'; const [hx, hy] = SIM.hand(h);
        R.proj = [{ id: 9900, k: 'fire', x: hx + 520 * age, y: hy, vx: 520, vy: 0, t0: S.t - age, life: 1.1, own: 'hero', r: 8 }]; }
      if (kind === 'boom') S.ev = [{ k: 'boom', x, y: y - 24, gx: x, gy: y, t: S.t - age }];
      // the mage's ice wave and staff bolt (TASKS 1110): three monsters in the cone chilled, a bolt in flight and one bursting on a foe
      const foe = (ty, dx, dy, o) => { const E = D.ENEMIES[ty]; return Object.assign({ id: 970 + R.en.length, type: ty, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: rm.id, st: 'idle', t0: 0,
        face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }, o); };
      if (kind === 'frost') { h.cls = 'mage'; h.castT = S.t - age; h.castK = 'frost'; const r = D.abRank('frost', 1).r;
        for (const [ty, dx, dy] of [['skeleton', 110, -50], ['goblin', 150, 30], ['skeleton', 70, 60]]) R.en.push(foe(ty, dx, dy, { chillT: S.t - age + D.FROST.t, slowK: D.FROST.slow, hitT: S.t - age }));
        S.ev = [{ k: 'frost', x: h.x, y: h.y, a: 0, r, arc: D.FROST.arc, t: S.t - age }]; }
      // the archer's volley in flight and his traps: one set (thrown to the cursor, TASKS 1161), one armed, one sprung on a skeleton (TASKS 1120)
      if (kind === 'volley') { h.cls = 'archer'; h.eq.weapon = Object.assign({}, h.eq.weapon, { b: 'shortbow' }); const [hx, hy] = SIM.hand(h), A = D.SHOTS.arrow, V = D.VOLLEY;
        R.proj = [...Array(V.n).keys()].map((i) => { const a = (i / (V.n - 1) - 0.5) * V.arc * Math.PI / 180; return { id: 9910 + i, k: 'arrow', single: 1, x: hx + Math.cos(a) * (A.tip + A.spd * age), y: hy + Math.sin(a) * (A.tip + A.spd * age), vx: Math.cos(a) * A.spd, vy: Math.sin(a) * A.spd, t0: S.t - age, life: A.life, own: 'hero', r: A.r, gz: 20 }; }); }
      if (kind === 'trap') { h.cls = 'archer'; R.htraps = [{ id: 9920, x: h.x + 170, y: h.y + 4, fx: h.x, fy: h.y + 4, t0: S.t - age }, { id: 9921, x: h.x + 70, y: h.y + 70, t0: S.t - 5 }];
        if (age < 0.1) { R.en.push(foe('skeleton', 150, 4, { rootT: S.t + 1.5, slowK: 0, hitT: S.t - age })); S.ev = [{ k: 'trapsnap', x: h.x + 150, y: h.y + 4, t: S.t - age }]; } }
      // the warrior's charge striking a skeleton and his war cry over three (TASKS 1130)
      if (kind === 'charge') { h.dashT = S.t - age; h.dashX = 1; h.dashY = 0; R.en.push(foe('skeleton', 130, 0, { rootT: S.t + 1, slowK: 0, hitT: S.t - Math.max(0, age - 0.12) }));
        S.ev = [{ k: 'charge', x: h.x - 100, y: h.y, dx: 1, dy: 0, t: S.t - age }].concat(age > 0.12 ? [{ k: 'chargehit', x: h.x + 130, y: h.y, t: S.t - age + 0.12 }] : []); }
      if (kind === 'cry') { h.cryT = S.t - age + D.CRY.t; h.castT = S.t - age; for (const [ty, dx, dy] of [['skeleton', 110, -40], ['goblin', -120, 30], ['skeleton', 60, 90]]) R.en.push(foe(ty, dx, dy, { weakT: S.t - age + D.CRY.t }));
        S.ev = [{ k: 'cry', x: h.x, y: h.y, r: D.CRY.r, t: S.t - age }]; }
      if (kind === 'bolt') { h.cls = 'mage'; h.eq.weapon = Object.assign({}, h.eq.weapon, { b: 'staff' }); h.atkT = S.t - age - SIM.K.HIT; h.atkA = 0; const [hx, hy] = SIM.hand(h);
        R.en.push(foe('skeleton', 330, 0));
        R.proj = [{ id: 9901, k: 'bolt', x: hx + D.BOLT.spd * age, y: hy, vx: D.BOLT.spd, vy: 0, t0: S.t - age, life: D.BOLT.life, own: 'hero', r: D.BOLT.r }];
        S.ev = [{ k: 'pop', c: 'bolt', hit: 1, x: h.x + 300, y: hy, t: S.t - age * 0.5 }]; }
    });
    for (const [kind, ages] of [['whirl', [0.025, 0.08, 0.16, 0.24, 0.32, 0.44]], ['fireball', [0.01, 0.04, 0.08, 0.12, 0.18, 0.24]], ['boom', [0.015, 0.06, 0.12, 0.24, 0.44, 1.5]],
      ['frost', [0.03, 0.1, 0.2, 0.4, 0.65, 2]], ['bolt', [0.02, 0.1, 0.2]], ['volley', [0.02, 0.08, 0.16]], ['trap', [0.2, 1, 0.05, 0.12]], ['charge', [0.05, 0.15, 0.3]], ['cry', [0.05, 0.2, 0.45, 2]]]) {
      ages.forEach((age, i) => states.push(['spell_' + kind + '_' + i, spellState(kind, age)]));
    }
    states.push(['spell_scar_end', spellState('boom', 3.9)], ['spell_scar_gone', spellState('boom', 4.1)], ['spell_whirl_wall', spellState('whirl', 0.16, true)]);
    const fogWhirl = spellState('whirl', 0.16), fogX = Math.floor(fogWhirl.run.hero.x / TILE) + 1;
    for (let y = 0; y < fogWhirl.run.map.H; y++) for (let x = fogX; x < fogWhirl.run.map.W; x++) fogWhirl.run.seen[y * fogWhirl.run.map.W + x] = 0;
    states.push(['spell_whirl_fog', fogWhirl]);
    // a blow's flash: the first one fills the body white for 0.06 s, one landing within 0.3 s of the last only lights its edge
    for (const [name, prev] of [['hit_flash', -9], ['hit_edge', 0.22]]) states.push([name, play((S) => { const R = S.run, h = R.hero, rm = R.map.rooms.find((r) => r.type === 'combat') || R.map.rooms[0];
      h.x = (rm.x + rm.w / 2) * TILE; h.y = (rm.y + rm.h / 2) * TILE; R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      R.en = ['brute', 'skeleton'].map((ty, i) => { const E = D.ENEMIES[ty]; return { id: 960 + i, type: ty, x: h.x + 120, y: h.y - 70 + 140 * i, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: rm.id, st: 'chase', t0: 0,
        face: -1, aimA: Math.PI, cdT: 99, hitT: S.t - 0.03, hitP: prev < 0 ? -9 : S.t - 0.03 - prev, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }; }); })]);
    // what each kind bleeds (TASKS 136): skeleton, ghost, goblin, spider struck (top row) and where one of each was killed 2 s ago (bottom)
    for (const [name, age] of [['blood_hit', 0.12], ['blood_hit_late', 0.35]]) states.push([name, play((S) => { const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((p, q) => q.w * q.h - p.w * p.h)[0], inR = (o) => DUNGEON.roomAt(m, o.x, o.y) === rm.id;
      m.decor = m.decor.filter((d) => d.wall || !inR(d)); R.chests = R.chests.filter((c) => !inR(c)); R.pots = R.pots.filter((p) => !inR(p)); m.decals = m.decals.filter((d) => !inR(d));
      h.x = (rm.cx + 0.5) * TILE - 200; h.y = (rm.cy + 0.5) * TILE + 20; R.cam = [h.x + 200 - SCX.VW / 2, h.y - SCX.VH / 2]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      R.en = ['skeleton', 'ghost', 'goblin', 'spider'].map((ty, i) => { const E = D.ENEMIES[ty]; return { id: 930 + i, type: ty, x: h.x + 100 + i * 120, y: h.y - 60, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: rm.id,
        st: 'idle', t0: 0, face: -1, aimA: 0, cdT: 99, hitT: S.t - age, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }; });
      R.en.forEach((e) => S.ev.push({ k: 'hit', t: S.t - age, x: e.x, y: e.y - D.ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: 12, crit: 0, id: e.id }));
      ['skeleton', 'ghost', 'goblin', 'spider'].forEach((ty, i) => S.ev.push({ k: 'kill', t: S.t - 2, x: h.x + 100 + i * 120, y: h.y + 90, type: ty, id: 950 + i })); })]);
    // TASKS 1342: a critical blow against a plain one: the word, the bigger white number, the flash
    states.push(['crit_hit', play((S) => { const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((p, q) => q.w * q.h - p.w * p.h)[0]; h.x = (rm.cx + 0.5) * TILE - 200; h.y = (rm.cy + 0.5) * TILE + 20; R.cam = [h.x + 200 - SCX.VW / 2, h.y - SCX.VH / 2]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      R.en = ['skeleton', 'goblin'].map((ty, i) => { const E = D.ENEMIES[ty]; return { id: 930 + i, type: ty, x: h.x + 120 + i * 180, y: h.y - 60, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: rm.id, st: 'idle', t0: 0, face: -1, aimA: 0, cdT: 99, hitT: S.t - 0.06, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }; });
      R.en.forEach((e, i) => S.ev.push({ k: 'hit', t: S.t - 0.06, x: e.x, y: e.y - D.ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: i ? 12 : 38, crit: i ? 0 : 1, id: e.id })); })]);
    // elites next to plain monsters of the same kind: the aura and the size must tell them apart at a glance
    states.push(['elite', play((S) => { const R = S.run, h = R.hero, rm = R.map.rooms.find((r) => r.type === 'combat') || R.map.rooms[0]; h.x = (rm.x + 1.5) * TILE; h.y = (rm.y + rm.h / 2) * TILE;
      R.cam = [h.x - 260, h.y - SCX.VH / 2 - 30]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      R.en = ['skeleton', 'goblin', 'cultist', 'brute'].flatMap((ty, i) => [0, 1].map((el) => { const E = D.ENEMIES[ty]; return { id: 940 + i * 2 + el, type: ty, x: h.x + 170 + i * 190, y: h.y - 90 + el * 190, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: el, room: rm.id,
        st: 'idle', t0: 0, face: -1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, mods: el ? [['fiery'], ['vampire'], ['summoner'], ['explosive', 'fiery']][i] : undefined }; }));
      // a monster the spread put into rock steps to the nearest free floor cell: a label over the void was this state's own defect
      const free = (x, y) => SIM.cell(R.map, x, y) === 1 && !R.en.some((o) => Math.abs(Math.floor(o.x / TILE) - x) < 4 && Math.abs(Math.floor(o.y / TILE) - y) < 3);
      for (const e of R.en) { const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE); if (SIM.cell(R.map, tx, ty) === 1) continue;
        let best = null; for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) if (free(tx + i, ty + j) && (!best || i * i + j * j < best[0])) best = [i * i + j * j, tx + i, ty + j];
        if (best) { e.x = (best[1] + 0.5) * TILE; e.y = (best[2] + 0.5) * TILE; } } })]);
    // a summoner ghost elite in the crypt, right under a green wall torch, a plain ghost beside it (TASKS 172: the ghost read as
    // one green blot with its aura and the torchlight)
    states.push(['elite_ghost_crypt', play((S) => { const R = S.run, h = R.hero; SIM.enterFloor(S, R, 3); const m = R.map;
      const tr = m.torches.find((q) => q.kind === 'wall' && m.rooms.some((r) => r.type === 'combat' && q.x > (r.x + 2) * TILE && q.x < (r.x + r.w - 2) * TILE && q.y < (r.y + 1) * TILE && q.y > (r.y - 2) * TILE)) || m.torches[0];
      const rm = m.rooms.find((r) => tr.x > r.x * TILE && tr.x < (r.x + r.w) * TILE && tr.y < (r.y + 1) * TILE && tr.y > (r.y - 2) * TILE) || m.rooms[0];
      const gy = (rm.y + 2.2) * TILE; h.x = tr.x - 4.5 * TILE; h.y = gy + 1.5 * TILE; h.face = 1;
      R.cam = [tr.x - SCX.VW / 2, gy - SCX.VH / 2]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      const E = D.ENEMIES.ghost, g = (id, x, el) => ({ id, type: 'ghost', x, y: gy, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: el, mods: el ? ['summoner'] : undefined, room: rm.id,
        st: 'idle', t0: 0, face: -1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 });
      R.en = [g(960, tr.x, 1), g(961, tr.x + 3.5 * TILE, 0)]; for (let i = 0; i < 20; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); R.en.forEach((e) => { e.x = e === R.en[0] ? tr.x : tr.x + 3.5 * TILE; e.y = gy; }); })]);
    // an elite's powers in play: an explosive corpse 0.6 s into its fuse (its reach on the floor), a vampire draining the hero
    states.push(['elite_fx', play((S) => { const R = S.run, h = R.hero, rm = R.map.rooms.find((r) => r.type === 'combat') || R.map.rooms[0]; h.x = (rm.x + 2.5) * TILE; h.y = (rm.y + rm.h / 2) * TILE;
      R.cam = [h.x - 360, h.y - SCX.VH / 2 - 30]; R.rseen = R.rseen.map(() => 1); R.seen = R.seen.map(() => 1); R.msg = null;
      const mk = (id, ty, x, y, mods, o) => Object.assign({ id, type: ty, x, y, vx: 0, vy: 0, hp: 30, max: 60, dmg: 1, elite: 1, mods, room: rm.id, st: 'idle', t0: 0, face: -1, aimA: Math.PI, cdT: 99, hitT: -9,
        deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }, o);
      R.en = [mk(950, 'skeleton', h.x + 200, h.y + 40, ['explosive'], { deadT: S.t - 0.6, dieA: 0 }), mk(951, 'goblin', h.x + 40, h.y - 10, ['vampire'])];
      S.ev.push({ k: 'fuse', x: h.x + 200, y: h.y + 40, r: 110, d: 1, id: 950, t: S.t - 0.6 }, { k: 'drain', x: h.x, y: h.y - 40, tx: h.x + 40, ty: h.y - 46, n: 7, id: 951, t: S.t - 0.12 }); })]);
    // regression states: spikes mid-rise next to the hero; a room at the map's corner must not hide under the HUD
    const trapS = (() => { for (let sd = 1; sd < 60; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const m = S.run.map; if (!m.traps.length) continue;
      const tp = m.traps[Math.floor(m.traps.length / 2)], h = S.run.hero; h.x = tp.x - 70; h.y = tp.y + 10; S.run.seen = S.run.seen.map(() => 1); S.t = (1 - tp.ph) * 2.4 + 0.3; S.run.cam = [tp.x - SCX.VW / 2, tp.y - SCX.VH / 2]; return S; } })();
    if (trapS) { states.push(['trap', trapS]); const w = structuredClone(trapS), tp = w.run.map.traps[Math.floor(w.run.map.traps.length / 2)]; w.t = (0.88 - tp.ph + 2) % 1 * 2.4 + 2.4; states.push(['trap_warn', w]); }
    const edgeS = play((S) => { const R = S.run, m = R.map, r = m.rooms.reduce((a, b) => (b.x + b.w > a.x + a.w ? b : a)), h = R.hero; h.x = (r.x + r.w - 2) * TILE; h.y = (r.y + 1) * TILE + 16;
      R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; for (let i = 0; i < 300; i++) SIM.step(S, { px: 960, py: 540, keys: [] }); });
    states.push(['edge', edgeS]);
    // a cache laid open: its chest spilled and its items settled; none may rest behind a prop
    { const S = (() => { for (let sd = 1; sd < 60; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); if (S.run.map.secrets.some((q) => q.kind === 'banner')) return S; } })();
      if (S) { const R = S.run, q = R.map.secrets.find((o) => o.kind === 'banner'), rm = R.map.rooms[q.room], h = R.hero, hx = (rm.cx + 0.5) * TILE, hy = (rm.y + rm.h - 1) * TILE; SIM.openSecret(S, R, q, true); R.en = []; R.msg = null;
        for (const c of R.chests) if (DUNGEON.roomAt(R.map, c.x, c.y) === rm.id) SIM.openChest(S, R, c);
        for (let i = 0; i < 150; i++) { h.x = hx + 400; h.y = hy; SIM.step(S, { keys: [], px: 960, py: 540 }); } h.x = hx; h.y = hy; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [hx - SCX.VW / 2, (rm.y + rm.h / 2) * TILE - SCX.VH / 2]; S.debug = 1; S.dbgLoot = 1; states.push(['loot_spill', S]); } }
    // an accent zone's doorway: its coloured light must fade out into the corridor, not stop at the room's cells
    for (const zone of ['arcane', 'crypt']) { const S = (() => { for (let sd = 1; sd < 60; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, m = R.map;
      for (const r of m.rooms.filter((q) => q.zone === zone)) for (let x = r.x; x < r.x + r.w; x++) for (const [y, dy] of [[r.y + r.h - 1, 1], [r.y, -1]]) {
        if (SIM.cell(m, x, y + dy) !== 1 || DUNGEON.roomAt(m, x * TILE, (y + dy) * TILE) >= 0) continue;
        const h = R.hero; let k = 1; while (k < 4 && SIM.cell(m, x, y + dy * (k + 1)) === 1) k++; h.x = (x + 0.5) * TILE; h.y = (y + dy * k + 0.5) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [h.x - SCX.VW / 2, (y + 0.5) * TILE - SCX.VH / 2]; return S; } } })();
      if (S) states.push(['zone_door_' + zone, S]); }
    // sconces on a left and a right side wall: plate against the wall, the torch leaning into the room
    for (const side of [-1, 1]) states.push(['side_torch_' + (side < 0 ? 'l' : 'r'), play((S) => { const R = S.run, tc = R.map.torches.find((t) => t.side === side && !SIM.hidden(R.map, t)), h = R.hero;
      if (!tc) return; h.x = tc.x - side * 120; h.y = tc.y + 60; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [tc.x - SCX.VW / 2, tc.y - SCX.VH / 2]; })]);
    // a cobweb in a room's top-left and top-right corner: spun across the corner, mirrored on the right
    for (const f of [0, 1]) states.push(['web_' + (f ? 'r' : 'l'), play((S) => { S.run = SIM.newRun(S, 'campaign', 1); const R = S.run, d = R.map.decals.find((o) => o.n === 'dc_web' && o.f === f), h = R.hero;
      if (!d) return; h.x = d.x + (f ? -90 : 90); h.y = d.y + 90; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [d.x - SCX.VW / 2, d.y - SCX.VH / 2]; })]);
    // a floor without light (TASKS 1364): the hero in a room's west end, three foes east of him, near and at the edge of the lamp's reach;
    // dark_plain is the same floor with its modifier off
    for (const plain of [0, 1]) { let found = null;
      for (let sd = 1; sd < 300 && !found; sd++) for (let f = 3; f <= 4 && !found; f++) if (D.stageOf('campaign', f, sd).mod === 'dark') found = [sd, f];
      if (found) states.push([plain ? 'dark_plain' : 'dark_floor', play((S) => { S.run = SIM.newRun(S, 'campaign', found[0]); SIM.enterFloor(S, S.run, found[1]); const R = S.run, m = R.map, h = R.hero; if (plain) m.mod = null;
        const r = m.rooms.find((q) => q.type === 'combat' && !q.zone), foes = R.en.filter((e) => !D.BOSSES[e.type]).slice(0, 3); R.msg = null; S.ev = [];
        h.x = (r.x + 1.2) * TILE; h.y = (r.y + r.h / 2) * TILE; h.vx = h.vy = 0;
        foes.forEach((e, i) => { e.x = h.x + [80, 140, 195][i]; e.y = h.y + [-50, 30, -20][i]; });
        R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [h.x + 100 - SCX.VW / 2, h.y - SCX.VH / 2]; })]); }
    // the floor's worst-lit room: the one whose farthest cell is farthest from any light
    // the largest lava pool on the fire floors, close: its straight shores and its outer and inner corners (TASKS 105)
    { let best = null; for (const seed of [1234, 1, 2, 3]) { const S = play(); S.run = SIM.newRun(S, 'campaign', seed); for (const f of [5, 6]) { SIM.enterFloor(S, S.run, f); const m = S.run.map, seen = new Set();
        for (let k = 0; k < m.W * m.H; k++) { if (m.cells[k] !== 3 || seen.has(k)) continue; const comp = [], st = [k]; seen.add(k);
          while (st.length) { const c = st.pop(); comp.push(c); for (const d of [1, -1, m.W, -m.W]) if (m.cells[c + d] === 3 && !seen.has(c + d)) { seen.add(c + d); st.push(c + d); } }
          if (!best || comp.length > best.n) best = { n: comp.length, seed, f, x: comp.reduce((a, c) => a + c % m.W, 0) / comp.length, y: comp.reduce((a, c) => a + Math.floor(c / m.W), 0) / comp.length }; } } }
      if (best) states.push(['lava_pool', play((S) => { S.run = SIM.newRun(S, 'campaign', best.seed); const R = S.run; SIM.enterFloor(S, R, best.f); const h = R.hero;
        R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); h.x = (best.x + 0.5) * TILE; h.y = (best.y + 4) * TILE;
        R.cam = [(best.x + 0.5) * TILE - SCX.VW / 2, (best.y + 0.5) * TILE - SCX.VH / 2]; })]); }
    // the fire depths' streams (TASKS 186): a lava hall with the hero on its island, and a river with the hero on its causeway
    // (lava_foe_*, TASKS 510: a monster on the lava and one before it, whom the lava's glow must not show through)
    for (const [kind, foe] of [['hall'], ['river'], ['hall', 1]]) { let got = null;
      for (const seed of [1, 2, 3, 1234]) { if (got) break; const S = play(); S.run = SIM.newRun(S, 'campaign', seed); for (const f of [5, 6]) { SIM.enterFloor(S, S.run, f);
        const q = (S.run.map.streams || []).filter((o) => o.kind === kind).sort((a, b) => b.n - a.n)[0]; if (q) { got = { seed, f, room: q.room }; break; } } }
      if (got) states.push([(foe ? 'lava_foe_' : 'lava_') + kind, play((S) => { S.run = SIM.newRun(S, 'campaign', got.seed); const R = S.run; SIM.enterFloor(S, R, got.f); const m = R.map, h = R.hero, r = m.rooms[got.room];
        const foes = R.en.filter((e) => !D.BOSSES[e.type]).slice(0, 2); R.en = foe ? foes : []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
        let at = null; for (let d = 0; d < 8 && !at; d++) for (let j = -d; j <= d && !at; j++) for (let i = -d; i <= d && !at; i++) if (SIM.cell(m, r.cx + i, r.cy + j) === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => SIM.cell(m, r.cx + i + a, r.cy + j + b) === 3)) at = [r.cx + i, r.cy + j];
        at = at || [r.cx, r.cy]; h.x = (at[0] + 0.5) * TILE; h.y = (at[1] + 0.6) * TILE; R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2];
        if (foe && foes.length === 2) { let L = null; for (let d = 0; d < 12 && !L; d++) for (let j = -d; j <= d && !L; j++) for (let i = -d; i <= d && !L; i++) if (SIM.cell(m, r.cx + i, r.cy + j) === 3 && SIM.cell(m, r.cx + i, r.cy + j - 1) === 3 && SIM.cell(m, r.cx + i, r.cy + j + 1) === 1) L = [r.cx + i, r.cy + j];
          if (L) { foes.forEach((e, k) => { e.st = 'idle'; e.elite = 1; e.x = e.hx = (L[0] + 0.5 + k * 2.5) * TILE; e.y = e.hy = (L[1] + (k ? 1.1 : 0.2)) * TILE; }); h.x = (L[0] + 5) * TILE; h.y = (L[1] + 3) * TILE; R.cam = [foes[0].x - SCX.VW / 2, foes[0].y - SCX.VH / 2]; } } })]); }
    for (const floor of [1, 3, 7]) for (const kind of ['fountain', 'stream']) {
      for (const seed of [1, 2, 3, 1234]) {
        const S = play(); S.run = SIM.newRun(S, 'campaign', seed); const R = S.run; SIM.enterFloor(S, R, floor);
        const m = R.map, q = m.waterFeatures.find((q) => q.kind === kind); if (!q) continue;
        const r = m.rooms[q.room], h = R.hero, k = q.bridge?.[Math.floor(q.bridge.length / 2)] || m.water.filter((k) => DUNGEON.roomAt(m, (k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE) === r.id
          && !m.block.includes(k) && !R.pots.some((p) => Math.floor(p.y / TILE) * m.W + Math.floor(p.x / TILE) === k)).sort((a, b) => Math.hypot(a % m.W - r.cx, Math.floor(a / m.W) - r.cy) - Math.hypot(b % m.W - r.cx, Math.floor(b / m.W) - r.cy))[0];
        h.x = (k % m.W + 0.5) * TILE; h.y = (Math.floor(k / m.W) + 0.6) * TILE; h.vx = h.vy = 0; h.ifr = 1e9;
        R.en = []; R.msg = null;
        R.zoom = 2; R.cam = [(r.x + r.w / 2) * TILE - SCX.W / 4, (r.y + r.h / 2) * TILE - SCX.H / 4 - 20];
        R.seen.fill(1); R.rseen.fill(1); S.ev = [];
        states.push(['water_' + kind + '_' + m.biome, S]);
        if (kind === 'fountain' && floor === 1) {
          const bank = [];
          for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
            const k2 = y * m.W + x, d = Math.hypot((x + 0.5) * TILE - h.x, (y + 0.5) * TILE - h.y);
            if (d >= 2 * TILE && !m.water.includes(k2) && !m.block.includes(k2) && !R.pots.some((p) => Math.floor(p.y / TILE) * m.W + Math.floor(p.x / TILE) === k2)) bank.push([x, y, d]);
          }
          if (bank.length) { bank.sort((a, b) => a[2] - b[2]); const shore = structuredClone(S); shore.run.hero.x = (bank[0][0] + 0.5) * TILE; shore.run.hero.y = (bank[0][1] + 0.6) * TILE; states.push(['water_crossing', shore]); }
        }
        break;
      }
    }
    // shallow water with the hero wading in it, and the same pool seen whole with the hero on its shore (TASKS 106)
    for (const seed of [1234, 1, 2, 3]) { const S = play(); S.run = SIM.newRun(S, 'campaign', seed); const R = S.run, m = R.map; if (!m.water.length) continue;
      const k = m.water[Math.floor(m.water.length / 2)], h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      h.x = (k % m.W + 0.5) * TILE; h.y = (Math.floor(k / m.W) + 0.5) * TILE; R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['water_pool', S]);
      const S2 = structuredClone(S); S2.run.hero.y += 2.5 * TILE; states.push(['water_shore', S2]);
      // TASKS 176: an elite cultist, its blow's number and the pool in unexplored cells on the frame's right show nothing; explored, they show
      for (const open of [0, 1]) { const S3 = structuredClone(S), R3 = S3.run, h3 = R3.hero, px = (k % m.W + 0.5) * TILE, py = (Math.floor(k / m.W) + 0.5) * TILE, E = D.ENEMIES.cultist;
        h3.x = px - 9 * TILE; h3.y = py; R3.cam = [px - SCX.VW * 0.62, py - SCX.VH / 2]; R3.seen = R3.seen.map((v, i) => (open || i % m.W <= Math.floor(h3.x / TILE) + 3 ? 1 : 0));
        R3.en = [{ id: 990, type: 'cultist', x: px + 2 * TILE, y: py - 2 * TILE, vx: 0, vy: 0, hp: E.hp * 0.6, max: E.hp, dmg: 1, elite: 1, mods: ['summoner'], room: -1,
          st: 'idle', t0: 0, face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }];
        S3.ev.push({ k: 'hit', t: S3.t - 0.15, x: px + 2 * TILE, y: py - 2 * TILE - E.h * 0.5 - 6, type: 'cultist', n: 17, crit: 0, id: 990 });
        states.push([open ? 'fog_hide_seen' : 'fog_hide', S3]); }
      break; }
    // one room per furnishing plan (data.js ROOM_PLANS), lit and empty, the camera on it
    for (const plan of Object.keys(D.ROOM_PLANS)) states.push(['plan_' + plan, play((S) => { for (const seed of [1234, 1, 2, 3, 4, 5, 6]) { S.run = SIM.newRun(S, 'campaign', seed); const R = S.run;
      for (let f = 1; f <= D.RUNS.campaign.chapter; f++) { SIM.enterFloor(S, R, f); const m = R.map, rm = m.rooms.filter((q) => q.plan === plan && q.type !== 'start').sort((a, b) => b.w * b.h - a.w * a.h)[0]; if (!rm) continue;
        const h = R.hero; h.x = (rm.x + 0.5) * TILE; h.y = (rm.y + rm.h - 0.5) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
        R.cam = [(rm.x + rm.w / 2) * TILE - SCX.VW / 2, (rm.y + rm.h / 2) * TILE - SCX.VH / 2]; return; } } })]);
    // the fog across a thin wall between two rooms with no passage: the hero's room open whole, the one behind the wall dark (TASKS 104)
    states.push(['fog_wall', play((S) => { for (const seed of [1234, 1, 2, 3, 4, 5, 6, 7, 8]) { S.run = SIM.newRun(S, 'campaign', seed); const R = S.run, h = R.hero;
      for (let f = 1; f <= D.RUNS.campaign.chapter; f++) { SIM.enterFloor(S, R, f); const m = R.map;
        for (const A of m.rooms) for (const B of m.rooms) for (const vert of [0, 1]) { if (A === B || A.type === 'secret' || B.type === 'secret') continue;
          const a0 = vert ? A.y : A.x, aw = vert ? A.h : A.w, b0 = vert ? B.y : B.x, gap = b0 - (a0 + aw); if (gap < 1 || gap > 2) continue;
          const o0 = Math.max(vert ? A.x : A.y, vert ? B.x : B.y), o1 = Math.min(vert ? A.x + A.w : A.y + A.h, vert ? B.x + B.w : B.y + B.h); if (o1 - o0 < 3) continue;
          let shut = true; for (let v = o0 - 1; v <= o1; v++) for (let u = a0 + aw; u < b0; u++) if ((vert ? SIM.cell(m, v, u) : SIM.cell(m, u, v)) !== 0) shut = false;
          if (!shut) continue; const mid = Math.floor((o0 + o1) / 2), hx = vert ? mid : a0 + aw - 1, hy = vert ? a0 + aw - 1 : mid;
          R.en = R.en.filter((e) => e.room === B.id); R.msg = null; h.x = (hx + 0.5) * TILE; h.y = (hy + 0.5) * TILE; SIM.step(S, { px: 960, py: 540, keys: [] });
          R.cam = [(vert ? h.x : (A.x + A.w + gap / 2) * TILE) - SCX.VW / 2, (vert ? (A.y + A.h + gap / 2) * TILE : h.y) - SCX.VH / 2]; return; } } } })]);
    // the hero in the darkest corridor cell, the farthest from every light: his own lamp must show the floor around him (TASKS 170)
    states.push(['dark_corridor', play((S) => { const R = S.run, m = R.map, LR = DUNGEON.LIGHT_R, ls = m.torches.map((t) => [t.x, t.y, LR[t.kind]]).concat(m.decor.filter((d) => LR[d.n]).map((d) => [d.x, d.y, LR[d.n]]));
      const inRoom = (x, y) => m.rooms.some((r) => x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
      let best = null, bv = -1; for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { if (SIM.cell(m, x, y) !== 1 || inRoom(x, y)) continue;
        const v = Math.min(...ls.map(([lx, ly, lr]) => Math.hypot(lx - (x + 0.5) * TILE, (ly - (y + 0.5) * TILE) / 0.8) / (lr * TILE))); if (v > bv) { bv = v; best = [x, y]; } }
      const h = R.hero; h.x = (best[0] + 0.5) * TILE; h.y = (best[1] + 0.5) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; for (let i = 0; i < 60; i++) SIM.step(S, { px: 960, py: 510, keys: [] }); })]);
    states.push(['dark_room', play((S) => { const R = S.run, m = R.map, LR = DUNGEON.LIGHT_R, ls = m.torches.map((t) => [t.x, t.y, LR[t.kind]]).concat(m.decor.filter((d) => LR[d.n]).map((d) => [d.x, d.y, LR[d.n]]));
      const worst = (r) => { let v = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) v = Math.max(v, Math.min(...ls.map(([lx, ly, lr]) => Math.hypot(lx - (x + 0.5) * TILE, (ly - (y + 0.5) * TILE) / 0.8) / (lr * TILE)))); return v; };
      const r = m.rooms.filter((q) => q.type !== 'shop' && q.id !== m.start).reduce((a, b) => (worst(b) > worst(a) ? b : a)), h = R.hero;
      h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 1) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; })]);
    // one prop of each material in a row, each knocked from its own side: mid-recoil with chips and sparks in the air, then settling
    const propS = (age) => play((S) => { const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((p, q) => q.w * q.h - p.w * p.h)[0], inR = (o) => DUNGEON.roomAt(m, o.x, o.y) === rm.id;
      m.decor = m.decor.filter((d) => !inR(d)); m.torches = m.torches.filter((t2) => t2.kind === 'wall' || !inR(t2)); R.chests = R.chests.filter((c) => !inR(c)); R.pots = R.pots.filter((p) => !inR(p));
      R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); const cx = (rm.cx + 0.5) * TILE, cy = (rm.cy + 0.5) * TILE + 6;
      ['table', 'statue', 'cage', 'crystal', 'coffin', 'shop_sacks', 'bookshelf', 'brazier'].forEach((n, i) => { const x = cx + (i % 4 - 1.5) * 76, y = cy + (i < 4 ? -40 : 60), s = i % 2 ? -1 : 1;
        if (n === 'brazier') { m.torches.push({ x, y, kind: 'brazier', r: rm.id }); S.ev.push({ k: 'prop', t: S.t - age, x, y, i: 't' + (m.torches.length - 1), n, mat: 'metal', s }); return; }
        m.decor.push({ x, y, n, solid: 1, r: rm.id }); S.ev.push({ k: 'prop', t: S.t - age, x, y, i: 'd' + (m.decor.length - 1), n, mat: D.PROP_MAT[n], s }); });
      // the fires and a plain banner (TASKS 135): a campfire, a torch and a banner on the top wall, struck from the left
      const ty = rm.y * TILE, onTop = (o) => Math.abs(o.y - ty) < TILE && o.x > rm.x * TILE && o.x < (rm.x + rm.w) * TILE;
      m.torches = m.torches.filter((t2) => !(t2.kind === 'wall' && !t2.side && onTop(t2))); m.decor = m.decor.filter((d) => !(d.wall && d.secret === undefined && onTop(d)));
      for (const [o, n, mat] of [[{ x: cx + 300, y: cy + 10, kind: 'fire' }, 'brazier', 'metal'], [{ x: cx - 80, y: ty - 26, kind: 'wall' }, 'torch_sconce', 'metal'], [{ x: cx + 80, y: ty - 2, n: 'banner', wall: 1 }, 'banner', 'cloth']]) {
        const L2 = o.n ? m.decor : m.torches; L2.push(o); S.ev.push({ k: 'prop', t: S.t - age, x: o.x, y: o.y, i: (o.n ? 'd' : 't') + (L2.length - 1), n, mat, s: 1 }); }
      h.x = cx; h.y = cy + 150; R.cam = [cx - SCX.VW / 2, cy - SCX.VH / 2]; });
    states.push(['props_knock', propS(0.07)], ['props_settle', propS(0.4)]);
    // the magma caves' staged moments stand on a plain plateau floor (a run's first floor is a lava cave, TASKS 426): run 3's first
    // plain floor, else the next run's
    const plainMagma = (S) => { for (let sd = 3; sd < 60; sd++) { S.run = SIM.newRun(S, 'magma', sd); for (let f = 2; f <= 3; f++) { SIM.enterFloor(S, S.run, f); if (S.run.map.ftype === 'plain') return S.run; } } return S.run; };
    // the magma kinds' moves, loops and cycles (TASKS 454) play on their own floor, not the crypt's: the hero in a plateau's hall with
    // bare floor 14 cells to his left (where he stands for a blow) and 10 to his right (a priest's or an imp's range), the spot of
    // those with the most lava round it
    const MG = new Set(['skel_ember', 'fire_priest', 'imp', 'golem', 'salamander']); let mgS = null;
    const playMg = (fn) => { if (!mgS) { const S = play(); plainMagma(S); S.screen = 'play'; const R = S.run, m = R.map, W = m.W, crust = new Set(m.crust); let best = null;
        for (let y = 3; y < m.H - 4; y++) for (let x = 14; x < W - 10; x++) { let ok = true;
          for (let j = -3; j <= 4 && ok; j++) for (let i = -14; i <= 10 && ok; i++) { const k = (y + j) * W + x + i; ok = m.cells[k] === 1 && !crust.has(k); } if (!ok) continue;
          let n = 0; for (let j = -8; j <= 8; j++) for (let i = -8; i <= 12; i++) if (m.cells[(y + j) * W + x + i] === 3) n++; if (!best || n > best[2]) best = [x, y, n]; }
        if (!best) throw new Error('no bare hall for the magma kinds');
        const h = R.hero, hx = (best[0] + 0.5) * TILE, hy = (best[1] + 0.5) * TILE, inBox = (p) => p.x > hx - 15 * TILE && p.x < hx + 11 * TILE && p.y > hy - 5 * TILE && p.y < hy + 6 * TILE;
        for (const k of ['decor', 'torches', 'traps', 'hazards', 'webs', 'rugs']) if (m[k]) m[k] = m[k].filter((p) => !inBox(p));
        m.block = m.block.filter((k) => !inBox({ x: (k % W + 0.5) * TILE, y: (Math.floor(k / W) + 0.5) * TILE }));
        for (const k of ['pots', 'chests', 'shrines', 'drops']) if (R[k]) R[k] = R[k].filter((p) => !inBox(p));
        R.en = []; R.proj = []; R.fires = []; S.ev = []; h.x = hx; h.y = hy; h.vx = h.vy = 0; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [hx - SCX.VW / 2, hy - SCX.VH / 2]; mgS = S; }
      const S = structuredClone(mgS); if (fn) fn(S); return S; };
    const playOf = (ty) => (MG.has(ty) ? playMg : play);
    // each way a secret hides: whole, worked (a banner torn, a bookcase broken, a statue slid, a sconce pulled, a flagstone stepped on) at age `age`, and the room found behind it
    const secretS = (f, stage, age = 0, mode = 'campaign') => { for (let sd = 1; sd < 120; sd++) for (let fl = 1; fl <= (mode === 'cave' || mode === 'magma' ? 4 : 1); fl++) { const S = play(); S.run = SIM.newRun(S, mode, sd); if (fl > 1) SIM.enterFloor(S, S.run, fl); const R = S.run, m = R.map, q = m.secrets.find(f); if (!q) continue;
      if (SIM.secretMask(m).has(q.front[5][1] * m.W + q.front[5][0])) continue;
      const h = R.hero, P = q.trig; h.x = q.x - q.dx * 70 + (q.dy ? 50 : 0); h.y = q.y - q.dy * 80 + (q.kind === 'shelf' || q.kind === 'statue' ? 40 : 0); h.aim = Math.atan2(q.dy, q.dx); R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [q.x - SCX.VW / 2, q.y - SCX.VH / 2 - 40];
      // (TASKS 1682) the hero off the plinth, on the side the stone leaves, and no locked door's word over the statue
      if (q.slide) { h.x = q.x - q.slide.s * 96; h.y = q.y + 100; if (SIM.Q.doorNear(R, 64)) continue; }
      if (P && P.k === 'plate') { h.x = P.x + 40; h.y = P.y + 10; R.cam = [(q.x + P.x) / 2 - SCX.VW / 2, (q.y + P.y) / 2 - SCX.VH / 2 - 20]; }
      if (P && P.k === 'sconce') { const t2 = m.torches[P.t]; h.x = t2.x + 80; h.y = t2.y + 70; R.chests = R.chests.filter((c) => Math.hypot(c.x - h.x, c.y - h.y) > 120); R.cam = [(q.x + t2.x) / 2 - SCX.VW / 2, (q.y + t2.y) / 2 - SCX.VH / 2]; }
      if (stage >= 2) { S.ev = []; SIM.openSecret(S, R, q); q.openT = S.t - (stage === 2 ? age : 3); if (P) P.downT = q.openT; const cv = m.decor.find((o) => o.secret === m.secrets.indexOf(q) && o.brokeT !== undefined); if (cv) cv.brokeT = q.openT; S.ev = S.ev.filter((e) => e.k === 'secret' || e.k === 'break'); for (const e of S.ev) e.t = q.openT; R.msg = null; R.trauma = 0; R.freeze = 0; }
      if (stage === 4) { const r = m.rooms[q.room]; h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 1) * TILE + 10; R.cam = [h.x - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; }
      return S; } };
    // doors from the room (the corridor behind under the fog) and from the corridor (the room unseen), shut, swinging, open; the
    // locked ones with their padlock or bar, a lever up and pulled
    const doorS = (dir, stage, age = 0, lk = '', out = 0) => { for (let sd = 1; sd < 160; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, m = R.map;
      const d = m.doors.find((o) => o.dir === dir && (lk ? (SIM.doorLock(m, o) || {}).kind === lk : !SIM.doorLock(m, o))); if (!d) continue;
      const h = R.hero, dx = dir === 'l' ? -1 : dir === 'r' ? 1 : 0, dy = dir === 'u' ? -1 : dir === 'd' ? 1 : 0, k = out ? 1 : -1;
      h.x = d.x + k * dx * (out ? 52 : 80) + (dy && !out ? 40 : 0); h.y = d.y + k * dy * (out ? (dy > 0 ? 100 : 56) : 90) + (dx && !out ? 40 : 0) + (dy < 0 && !out ? 20 : 0); h.aim = Math.atan2(-k * dy, -k * dx); R.en = R.en.filter((e) => e.room === d.room && out); R.msg = null;
      R.seen.fill(0); R.rseen.fill(0); R.drops = []; R.chests = R.chests.filter((c) => Math.hypot(c.x - h.x, c.y - h.y) > 70);
      if (stage >= 1) { S.ev = []; if (lk === 'lever') { const L0 = m.locks[d.lock]; L0.open = 1; L0.openT = S.t - 3; } if (lk === 'key') R.keys = 1; SIM.openDoor(S, R, d, stage === 1 && age < 0.1); d.openT = S.t - (stage === 1 ? age : 3); for (const e of S.ev) e.t = d.openT; R.msg = null; R.trauma = 0; }
      // (a locked room is a fight's room now, no hoard: its monsters' alert would pop over the door's prompt)
      SIM.step(S, { keys: [], px: 960, py: 540 }); S.ev = S.ev.filter((e) => e.k !== 'alert'); R.cam = [d.x - SCX.VW / 2, d.y - SCX.VH / 2 - 30]; R.msg = null; return S; } };
    for (const [n, dir, stage, age, lk, out] of [['door_u', 'u', 0], ['door_u_out', 'u', 0, 0, '', 1], ['door_u_swing', 'u', 1, 0.12], ['door_u_open', 'u', 2], ['door_u_open_out', 'u', 2, 0, '', 1],
      ['door_d', 'd', 0], ['door_d_out', 'd', 0, 0, '', 1], ['door_d_open', 'd', 2], ['door_l', 'l', 0], ['door_l_out', 'l', 0, 0, '', 1], ['door_l_swing', 'l', 1, 0.12], ['door_l_open', 'l', 2], ['door_r', 'r', 0], ['door_r_open', 'r', 2],
      ['door_key', 'u', 0, 0, 'key', 1], ['door_key_r', 'r', 0, 0, 'key', 1], ['door_key_unlock', 'u', 1, 0.2, 'key', 1], ['door_bar', 'u', 0, 0, 'lever', 1], ['door_bar_l', 'l', 0, 0, 'lever', 1], ['door_bar_open', 'u', 2, 0, 'lever', 1]]) {
      const S = doorS(dir, stage, age, lk, out); if (S) states.push([n, S]); }
    // the hero right beside a shut side door, in the room: the leaf's far end goes behind him, its near end in front
    for (const dir of ['l', 'r']) { const S = doorS(dir, 0); if (!S) continue; const R = S.run, d = R.map.doors.find((o) => o.dir === dir && !SIM.doorLock(R.map, o));
      Object.assign(R.hero, { x: d.x + (dir === 'l' ? 18 : -18), y: d.y + 8 }); states.push(['door_' + dir + '_beside', S]); }
    // an open door's leaf keeps its hinge side (TASKS 1351): the hero pressed along the hinge lane into the opening stops short of the leaf
    for (const dir of ['u', 'd', 'l', 'r']) { const S = doorS(dir, 2); if (!S) continue; const R = S.run, d = R.map.doors.find((o) => o.dir === dir && !SIM.doorLock(R.map, o)), h = R.hero, [vx, vy] = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[dir];
      h.x = (d.cells[0][0] + 0.5) * TILE - vx * 2 * TILE; h.y = (d.cells[0][1] + 0.5) * TILE - vy * 2 * TILE; h.vx = h.vy = 0; R.en = [];
      for (let i = 0; i < 90; i++) SIM.step(S, { left: vx < 0, right: vx > 0, up: vy < 0, down: vy > 0, px: 960, py: 540, keys: [] });
      R.cam = [d.x - SCX.VW / 2, d.y - SCX.VH / 2 - 30]; R.msg = null; states.push(['door_' + dir + '_open_pressed', S]); }
    { const S = play(); for (let sd = 1; sd < 160; sd++) { S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, m = R.map, L0 = m.locks.find((q) => q.kind === 'lever'); if (!L0) continue;
        const h = R.hero; h.x = L0.lever.x + 60; h.y = L0.lever.y + 70; R.en = []; R.msg = null; R.seen.fill(1); R.rseen.fill(1); R.cam = [L0.lever.x - SCX.VW / 2, L0.lever.y - SCX.VH / 2]; states.push(['lever', S]);
        const S2 = play(); S2.run = SIM.newRun(S2, 'campaign', sd); const R2 = S2.run, L2 = R2.map.locks[m.locks.indexOf(L0)]; Object.assign(R2.hero, { x: h.x, y: h.y }); R2.en = []; R2.msg = null; R2.seen.fill(1); R2.rseen.fill(1); R2.cam = R.cam.slice();
        SIM.pullLever(S2, R2, L2); L2.openT = S2.t - 2; R2.msg = null; states.push(['lever_pulled', S2]); break; } }
    { const S = play(), R = S.run, h = R.hero; R.en = []; R.msg = null; R.keys = 1; R.drops.push({ id: 9e6, kind: 'key', lock: 0, x: h.x + 60, y: h.y + 10, vx: 0, vy: 0, z: 0, vz: 0, t0: -9, rest: 2 }); states.push(['key_drop', S]); }
    // traps (TASKS 71, 76): a room's webs whole and torn, a corridor's spikes up
    { const find = (f) => { for (let sd = 1; sd < 120; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); for (let fl = 1; fl <= 4; fl++) { if (fl > 1) SIM.enterFloor(S, S.run, fl); const o = f(S.run.map); if (o) return [S, o]; } } return []; };
      const at = (S, x, y, hx = x + 50, hy = y + 40) => { const R = S.run; Object.assign(R.hero, { x: hx, y: hy, vx: 0, vy: 0 }); R.en = R.en.filter((e) => e.type === 'spider' && Math.hypot(e.x - x, e.y - y) < 260); R.msg = null; R.seen.fill(1); R.rseen.fill(1); R.cam = [x - SCX.VW / 2, y - SCX.VH / 2]; };
      let [S, w] = find((m) => m.webs.length >= 2 && m.webs[0]); if (S) { at(S, w.x, w.y, w.x + 4, w.y + 2); states.push(['web', S]);
        const [S2, w2] = find((m) => m.webs.length >= 2 && m.webs[0]); at(S2, w2.x, w2.y); for (const o of S2.run.map.webs) { o.torn = 1; o.tornT = S2.t - 2; } states.push(['web_torn', S2]); }

      [S, w] = find((m) => m.traps.find((t) => t.cor)); if (S) { at(S, w.x, w.y, w.x + 70, w.y); S.run.en = []; w.ph = (1 - (S.t / 2.4) % 1 + 0.1) % 1; states.push(['trap_corridor', S]); } }
    const sconce = (o) => o.trig && o.trig.k === 'sconce', plate = (o) => o.trig && o.trig.k === 'plate';
    for (const [n, f, stage, age] of [
      ['secret_banner', (o) => o.kind === 'banner', 0], ['secret_banner_fall', (o) => o.kind === 'banner', 2, 0.25], ['secret_banner_down', (o) => o.kind === 'banner', 3], ['secret_room', (o) => o.kind === 'banner', 4],
      ['secret_shelf', (o) => o.kind === 'shelf', 0], ['secret_shelf_break', (o) => o.kind === 'shelf', 2, 0.2], ['secret_shelf_books', (o) => o.kind === 'shelf', 2, 0.9], ['secret_shelf_open', (o) => o.kind === 'shelf', 3],
      ['secret_sconce', sconce, 0], ['secret_sconce_sink', sconce, 2, 0.8], ['secret_sconce_open', sconce, 3],
      ['secret_plate', plate, 0], ['secret_plate_sink', plate, 2, 0.8], ['secret_plate_open', plate, 3],
      ['secret_statue', (o) => o.kind === 'statue', 0], ['secret_statue_slide', (o) => o.kind === 'statue', 2, 0.6], ['secret_statue_knock', (o) => o.kind === 'statue', 2, 1.25], ['secret_statue_open', (o) => o.kind === 'statue', 3],
      ['secret_wall_lever', (o) => o.trig && o.trig.k === 'lever', 0], ['secret_wall_lever_open', (o) => o.trig && o.trig.k === 'lever', 3]]) { const S = secretS(f, stage, age); if (S) states.push([n, S]); }
    // (TASKS 1852) a bookcase rocking to a blow short of its third; one broken after a save and a load; one saved open on its hinge
    // (0.3.0) or slid along the wall (a build of 1851) loads broken at its own place, never as a squeezed strip or moved
    { const S = secretS((o) => o.kind === 'shelf', 0); if (S) { const R = S.run, m = R.map, q = m.secrets.find((o) => o.kind === 'shelf'), d = m.decor.find((o) => o.secret === m.secrets.indexOf(q));
        S.ev = []; SIM.hitProps(S, R, d.x, d.y + 30, 40); for (const e of S.ev) e.t = S.t - 0.06; R.msg = null; R.trauma = 0; if (q.hits === 1) states.push(['secret_shelf_hit', S]); } }
    { const S = secretS((o) => o.kind === 'shelf', 3); if (S) { S.run = JSON.parse(JSON.stringify(S.run)); SIM.migrateSecrets(S.run); states.push(['secret_shelf_loaded', S]); } }
    for (const [n, slid] of [['secret_shelf_loaded_hinge', 0], ['secret_shelf_loaded_slid', 1]]) { const S = secretS((o) => o.kind === 'shelf', 0); if (!S) continue; const R = S.run, m = R.map, i = m.secrets.findIndex((o) => o.kind === 'shelf'), q = m.secrets[i], d = m.decor.find((o) => o.secret === i), k0 = Math.floor(d.y / TILE) * m.W + Math.floor(q.x / TILE);
      q.open = 1; q.openT = S.t - 30; for (const [x, y] of q.wall) m.cells[y * m.W + x] = 1; m.block = m.block.filter((b) => b !== k0);
      if (slid) { q.slide = { s: 1, n: 3 }; d.x = q.x + 3 * TILE; d.solid = 1; m.block.push(k0 + 3); } else { q.hinge = 1; d.solid = 0; d.broken = 1; }
      S.run = JSON.parse(JSON.stringify(R)); SIM.migrateSecrets(S.run); states.push([n, S]); }
    // puzzles (TASKS 1692): three levers with their tallies, then one pulled; three unlit candles with theirs, then two lit
    for (const [n, k, on] of [['secret_puzzle_levers', 'levers', 0], ['secret_puzzle_levers_on', 'levers', 1], ['secret_puzzle_candles', 'candles', 0], ['secret_puzzle_candles_lit', 'candles', 2]]) { for (let sd = 1; sd < 120; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); const R = S.run, m = R.map, q = m.secrets.find((o) => o.pz && o.pz.k === k); if (!q) continue;
        const it = q.pz.items, xs = it.map((o) => o.x), mx = (Math.min(...xs) + Math.max(...xs)) / 2, h = R.hero; h.x = mx + 30; h.y = it[0].y + 90; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [mx - SCX.VW / 2, it[0].y - SCX.VH / 2];
        for (const o of it.slice().sort((a, b) => a.n - b.n).slice(0, on)) { o.on = 1; q.pz.step++; if (k === 'candles') m.decor.find((d) => d.pz === m.secrets.indexOf(q) && d.pzI === it.indexOf(o)).outUntil = 0; } states.push([n, S]); break; } }
    // the cave's loose stone is cut from the baked cave floor (TASKS 337): the same three moments on a cave floor
    // the magma caves' caches (TASKS 410, the player's note: they are found too easily), shut, as the hero comes up to them
    for (const [n, f, stage] of [['magma_secret_lever', (o) => o.kind === 'lever' && o.trig && o.trig.k !== 'plate', 0], ['magma_secret_plate', plate, 0]]) { const S = secretS(f, stage, 0, 'magma'); if (S) states.push([n, S]); }
    for (const [n, stage, age] of [['cave_secret_plate', 0], ['cave_secret_plate_sink', 2, 0.04], ['cave_secret_plate_open', 3]]) { const S = secretS(plate, stage, age, 'cave'); if (S) states.push([n, S]); }
    // the endless descent (TASKS 353): each biome's first-size and capped-size floor, each of the five bosses in its arena, the menu
    // with a record depth, the end of a run that set a new one
    { const at = (f, find) => { for (let sd = 1; sd < 400; sd++) if (find(DATA.stageOf('endless', f, sd))) return sd; return 0; };
      const floorS = (sd, f, boss) => play((S) => { S.run = SIM.newRun(S, 'endless', sd); if (f > 1) SIM.enterFloor(S, S.run, f); const R = S.run, h = R.hero; R.msg = null; S.ev = [];
        R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); const b = boss && R.en.find((e) => DATA.BOSSES[e.type]);
        if (b) { const r = R.map.rooms[b.room]; h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h - 2) * TILE; R.cam = [h.x - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; } });
      for (const b of DATA.RUNS.endless.pool) {
        const s1 = at(1, (q) => q.biome === b); if (s1) states.push(['endless_' + b + '_small', floorS(s1, 1)]);
        const s2 = at(17, (q) => q.biome === b); if (s2) states.push(['endless_' + b + '_cap', floorS(s2, 17)]); }
      for (const type of Object.values(DATA.RUNS.endless.bosses)) { let found = null;
        for (let f = 8; f <= 24 && !found; f += 4) { const sd = at(f, (q) => q.boss === type); if (sd) found = [sd, f]; }
        if (found) states.push(['endless_boss_' + type, floorS(found[0], found[1], true)]); }
      // TASKS 1808: half the 10th's foes slain, the stairs show through the fog and on the minimap, the hero far off
      states.push(['stairs_marked', play((S) => { SIM.enterFloor(S, S.run, 10); const R = S.run, m = R.map; R.msg = null;
        const foes = R.en.filter((e) => e.deadT < 0 && !DATA.BOSSES[e.type] && !e.summ && !DATA.ENEMIES[e.type].deep); for (const e of foes.slice(0, Math.ceil(foes.length / 2) + 1)) { e.hp = 0; SIM.killEnemy(S, R, e); }
        R.drops = []; S.ev = []; R.cam = [m.exit.x - SCX.VW / 2, m.exit.y - 60 - SCX.VH / 2]; })]);
      states.push(['endless_menu', mk((S) => { S.saved = null; S.meta.bestEndless = 23; })]);
      const dead = states.find(([n]) => n === 'dead'); if (dead) { const S = structuredClone(dead[1]); S.result.mode = 'endless'; S.result.floor = 24; S.result.record = { best: 24, fresh: true }; states.push(['endless_dead_record', S]); } }
    // every monster type in a row, idle, facing right: the rigs at rest against their approved sprites
    const lineup = (S) => { const R = S.run, r = R.map.rooms.filter((q) => q.id !== R.map.start).reduce((a, b) => (b.w > a.w ? b : a)), h = R.hero, y0 = (r.y + r.h / 2) * TILE + 16;
      R.msg = null; R.seen = R.seen.map(() => 1); h.x = (r.x + 1) * TILE; h.y = (r.y + 1) * TILE + 20;
      R.en = ['skeleton', 'goblin', 'spider', 'cultist', 'ghost', 'brute'].map((ty, i) => { const E = D.ENEMIES[ty]; return { id: 960 + i, type: ty, x: (r.x + r.w / 2) * TILE + (i - 2.5) * 110, y: y0, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: r.id, st: 'idle', t0: 0,
        face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }; });
      R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, y0 - SCX.VH / 2 - 40]; };
    states.push(['monsters', play(lineup)]);
    // the crab (TASKS 309) turned four ways and between, at rest in a lit hall: its shell, legs and claws must read whichever way it faces
    states.push(['crab_facings', play((S) => { S.run = SIM.newRun(S, 'cave', 8); SIM.enterFloor(S, S.run, 2); const R = S.run, r = R.map.rooms.filter((q) => q.type !== 'secret').sort((a, b) => b.w * b.h - a.w * a.h)[0], E = D.ENEMIES.crab, y0 = (r.cy + 0.5) * TILE; R.seen.fill(1); R.msg = null; R.cam = [(r.cx + 0.5) * TILE - SCX.VW / 2, y0 - SCX.VH / 2];
      R.en = [0, 1, 2, 3, 4, 5].map((i) => ({ id: 960 + i, type: 'crab', x: (r.x + r.w / 2) * TILE + (i - 2.5) * 110, y: y0 + (i % 2) * 40, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: r.id, st: 'idle', t0: 0,
        fa: [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.8, -2.4][i], face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 })); })]);
    // event responses: pain at the rim on low health with a bolt bursting on the hero, the fall, a scroll's two pillars,
    // the arrival on a floor, the boss's roar, a spike plate firing, the buff row with its worst strings
    const fx = (fn) => play((S) => { const R = S.run, h = R.hero; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; fn(S, R, h); });
    const reactionS = (kind, age) => fx((S, R, h) => {
      const m = R.map, rm = m.rooms.find((r) => r.type === 'combat' && r.w >= 9 && r.h >= 7) || m.rooms[m.start];
      h.x = (rm.cx - 1) * TILE; h.y = rm.cy * TILE; R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2];
      const x = h.x + (kind === 'water' || kind === 'douse' ? 0 : 60), y = h.y; m.seed += 1000000 + ['bone', 'snuff', 'water', 'douse'].indexOf(kind) * 1000;
      R.en = []; R.pots = []; R.chests = []; R.shrines = []; R.drops = []; m.decor = []; m.torches = [{ x: h.x - 100, y: h.y - 90, kind: 'brazier' }]; m.traps = []; m.webs = []; m.block = []; S.ev = [];
      if (kind === 'bone') { m.decor.push({ n: 'bones', x, y }); S.ev.push({ k: 'prop', mat: 'bone', n: 'bones', i: 'd0', s: 1, x, y, t: S.t - age }); }
      if (kind === 'snuff') { m.decor.push({ n: 'candles', x, y, outUntil: age >= 0 ? S.t - age + 3 : 0 }); if (age >= 0) S.ev.push({ k: kind, x, y, t: S.t - age }); }
      if (kind === 'water' || kind === 'douse') { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); m.water = [];
        for (let cy = ty - 1; cy <= ty + 1; cy++) for (let cx = tx - 2; cx <= tx + 2; cx++) { const k = cy * m.W + cx; m.cells[k] = 1; m.water.push(k); }
        S.ev.push({ k: kind === 'water' ? 'step' : kind, wet: true, x, y, t: S.t - age }); }
    });
    for (const kind of ['bone', 'snuff', 'water', 'douse']) for (const age of [0.08, 0.24, 0.5]) states.push(['reaction_' + kind + '_' + Math.round(age * 100), reactionS(kind, age)]);
    for (const age of [-0.1, 2.9, 3.1]) states.push(['reaction_candles_' + age, reactionS('snuff', age)]);
    states.push(['fx_hurt', fx((S, R, h) => { h.hp = Math.round(SIM.stats(h, S.meta).maxHp * 0.15); h.hurtT = S.t - 0.08;
      S.ev.push({ k: 'hurt', t: S.t - 0.08, x: h.x, y: h.y - 40, n: 30 }, { k: 'pop', t: S.t - 0.08, x: h.x, y: h.y - 38, c: 'hex', hero: 1 }); })]);
    states.push(['fx_die', fx((S, R, h) => { h.hp = 0; h.deadT = S.t - 0.8; S.ev.push({ k: 'die', t: S.t - 0.8, x: h.x, y: h.y }); })]);
    states.push(['fx_teleport', fx((S, R, h) => { S.ev.push({ k: 'teleport', t: S.t - 0.2, x: h.x, y: h.y, fx: h.x + 360, fy: h.y - 60 }); })]);
    states.push(['fx_arrive', fx((S, R, h) => { S.keepFloor = 1; S.ev.push({ k: 'floor', t: S.t - 0.45, x: h.x, y: h.y, f: R.floor }); })]);
    states.push(['fx_roar', play((S) => { const R = S.run; SIM.enterFloor(S, R, D.RUNS.campaign.chapter); const b = R.en.find((e) => e.type === 'boss'), h = R.hero; h.x = b.x; h.y = b.y + 220; b.st = 'chase';
      R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [b.x - SCX.VW / 2, b.y + 60 - SCX.VH / 2]; S.ev.push({ k: 'roar', t: S.t - 0.25, x: b.x, y: b.y - 70, id: b.id }); })]);
    // the HUD's worst cases (TASKS 1759, 1794, 1862): four-digit health and mana on their plates, the legend folded after its 10 s,
    // a boss's arrival under its ribbon, a hero at 14 % health, a pickup and a new level over the hero's head
    const hudBig = (S) => { const h = S.run.hero; h.base.vit = 400; h.base.int = 400; const st = SIM.Q.stats(h, S.meta); h.hp = st.maxHp - 7; h.mp = st.maxMp - 13; };
    states.push(['hud_hp4', play((S) => { hudBig(S); S.run.msg = null; })]);
    states.push(['hud_folded', play((S) => { const R = S.run; R.msg = null; R.enteredT = S.t - 20; R.seen.fill(1); R.rseen.fill(1); })]);
    states.push(['hud_town_folded', play((S) => { S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); const R = S.run, h = R.hero; R.msg = null; S.ev = []; R.enteredT = S.t - 20; R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; })]);
    states.push(['town_legend_shut', play((S) => { S.run = SIM.newRun(S, 'campaign', 3, { town: 1 }); const R = S.run, h = R.hero; R.msg = null; S.ev = []; R.enteredT = S.t - 1; R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; })]);
    states.push(['hud_boss_arrival', play((S) => { const R = S.run; SIM.enterFloor(S, R, D.RUNS.campaign.chapter); const b = R.en.find((e) => e.type === 'boss'), h = R.hero; h.x = b.x; h.y = b.y + 220; b.st = 'chase';
      R.seen = R.seen.map(() => 1); R.cam = [b.x - SCX.VW / 2, b.y + 60 - SCX.VH / 2]; R.msg = { chapter: D.ENEMIES.boss.name, s: D.ENEMIES.boss.title, t: S.t - 0.8, d: 3 }; })]);
    states.push(['hud_mute', play((S) => { S.run.msg = null; S.meta.mute = 1; S.muteT = S.t - 0.6; })], ['hud_muted', play((S) => { S.run.msg = null; S.meta.mute = 1; S.muteT = S.t - 9; })]);
    // TASKS 1863 ж: the names of the items by the hero, two close together stacked, and one he threw away under its E prompt
    states.push(['loot_names', play((S) => { const R = S.run, h = R.hero; R.msg = null; R.en = []; const it = (rar, q) => Object.assign(SIM.rollItem(R, 3, rar), { id: 7100 + q });
      for (const [q, dx, dy, rar] of [[0, -70, 30, 1], [1, -52, 40, 3], [2, 90, 10, 4]]) R.drops.push({ id: 7200 + q, kind: 'item', item: it(rar, q), x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, z: 0, vz: 0, t0: -9, loot: 1, rest: 2 });
      R.drops.push({ id: 7210, kind: 'item', item: it(2, 9), x: h.x + 30, y: h.y - 34, vx: 0, vy: 0, z: 0, vz: 0, t0: -9, tossed: 1, rest: 2 }); })]);
    states.push(['hud_low_hp', play((S) => { const R = S.run, h = R.hero; R.msg = null; h.hp = Math.ceil(SIM.Q.stats(h, S.meta).maxHp * 0.14); })]);
    states.push(['hud_pickup', play((S) => { const R = S.run, h = R.hero; R.msg = null; S.ev.push({ k: 'pickup', t: S.t - 0.5, x: h.x, y: h.y, s: SIM.Q.itemName(Object.assign(SIM.rollItem(R, 3, 3), { id: 3001 })), rar: 3 }, { k: 'lvl', t: S.t - 0.3, x: h.x, y: h.y, lvl: 2 }); })]);
    // what the HUD's numbers and cells are, under the pointer in the pause (TASKS 1862)
    const gifted = (S) => { const h = S.run.hero; h.bless = 1; h.burn = S.t + 2; h.perks = Object.fromEntries(D.GIFTS.filter((g) => g.id !== 'bless').slice(0, 6).map((g) => [g.id, 2])); };
    states.push(['pause_tip_stat', play((S) => { S.run.msg = null; S.screen = 'pause'; S.ptr = [40, 216]; })]);
    states.push(['pause_tip_gift', play((S) => { S.run.msg = null; gifted(S); S.screen = 'pause'; S.ptr = [206, 266]; })]);
    states.push(['pause_tip_gold', play((S) => { S.run.msg = null; S.screen = 'pause'; S.ptr = [150, 218]; })]);
    if (trapS) { const s2 = structuredClone(trapS), tp = s2.run.map.traps[Math.floor(s2.run.map.traps.length / 2)]; s2.ev.push({ k: 'spike', t: s2.t - 0.08, x: tp.x, y: tp.y }); states.push(['fx_spike', s2]); }
    states.push(['power_fire', fx((S, R, h) => { h.powers = { whirl_ring: 1, dash_trail: 1 }; R.fires = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: 8800 + i, own: 'hero', who: 'hero', x: h.x + Math.cos(i * Math.PI / 4) * 100, y: h.y + Math.sin(i * Math.PI / 4) * 75, t0: S.t - 0.6, r: 26, ry: 0.7, t: 2, dmg: 0, per: 9, kind: 'flame' })); })]);
    states.push(['buffs', fx((S, R, h) => { worst(S); h.perks = Object.fromEntries(D.GIFTS.map((g) => [g.id, 2])); Object.assign(h, { bless: 1, shield: 99999, shieldUntil: S.t + 4, burn: S.t + 0.4, poison: S.t + 2.2 }); })]);
    // the hero standing in lava, a quarter second after a burn tick (the scorch flash and smoke)
    for (let sd = 1; sd < 30; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); SIM.enterFloor(S, S.run, 5); const R = S.run, m = R.map, lv = [];
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.cells[y * m.W + x] === 3) lv.push([x, y]);
      if (lv.length) { const [lx, ly] = lv[Math.floor(lv.length / 2)], h = R.hero; h.x = lx * TILE + 16; h.y = ly * TILE + 16; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1);
        S.ev.push({ k: 'scorch', t: S.t - 0.12, x: h.x, y: h.y }); h.hurtT = S.t - 0.12; h.hurtX = 0; R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['lava', S]); break; } }
    // big props against a room's top wall: they must stand on the floor in front of the facade, not on its cap
    const wallS = (tall) => { for (let sd = 1; sd < 80; sd++) { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); if (tall) SIM.enterFloor(S, S.run, 3); const R = S.run, m = R.map;
      const r = m.rooms.find((q) => { const w = m.decor.filter((d) => d.solid && d.r === q.id && Math.abs(d.y - (q.y * TILE + 22)) < 1); return w.length >= (tall ? 1 : 3) && (!tall || w.some((d) => d.n === 'statue' || d.n === 'pillar')); }); if (!r) continue;
      const h = R.hero; h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h - 1) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, r.y * TILE - SCX.VH / 2 + 40]; return S; } };
    for (const [nm, tall] of [['wallprops', 0], ['wallprops_tall', 1]]) { const S = wallS(tall); if (S) states.push([nm, S]); }
    states.push(['sanct', play((S) => { const R = S.run, r = R.map.rooms[R.map.start], h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1);
      h.x = (r.x + 1.5) * TILE; h.y = (r.y + r.h - 1.5) * TILE; R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; })]);
    // the shop: the room from its doorway side, the hero at the counter (the prompt), and the trade screen at its worst
    const shopS = (prep) => play((S) => { const R = S.run, sh = R.map.shop, r = R.map.rooms[sh.room], h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      h.x = sh.front.x + 20; h.y = sh.front.y + 4; R.shop.away = 0; R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2 - 20]; if (prep) prep(S); });
    states.push(['shop', shopS()]);
    states.push(['shop_screen', shopS((S) => { worst(S); const R = S.run; for (let i = 0; i < 6; i++) R.shop.back.push({ it: Object.assign(SIM.rollItem(R, 8, 4), { id: 3000 + i }), price: 99999 });
      R.shop.back = R.shop.back.slice(-D.SHOP.buyback); for (const g of R.shop.goods) g.price = 99999; R.shop.line = 1; S.screen = 'shop'; S.hover = 'buy:0'; })]);
    states.push(['long_names_shop', shopS((S) => { worst(S); const R = S.run, lb = Object.keys(D.BASES).filter((b) => D.LEGEND_NAMES[b]).sort((a, b) => D.LEGEND_NAMES[b].length - D.LEGEND_NAMES[a].length)[0];
      for (const g of R.shop.goods) if (!SIM.Q.isCons(g.it)) Object.assign(g.it, SIM.rollItem(R, 12, 4, D.BASES[lb].slot), { id: g.it.id, b: lb, rar: 4 }); S.screen = 'shop'; S.hover = 'buy:0'; })]);
    // the merchant's key poses: a coin onto the scales, a stroke of the beard (hero away), a wave, the nod on a trade
    const at6 = (S, u) => { const R = S.run, k = R.map.seed % 7; S.t += ((u - (S.t + k)) % 6 + 6) % 6; R.shop.greetT = R.shop.tradeT = -9; R.cam = [R.map.shop.x - SCX.VW / 2, R.map.shop.y - 40 - SCX.VH / 2]; };
    states.push(['merchant_coin', shopS((S) => { S.run.hero.x -= 400; at6(S, 1.0); })]);
    states.push(['merchant_beard', shopS((S) => { S.run.hero.x -= 400; at6(S, 3.8); })]);
    states.push(['merchant_greet', shopS((S) => { at6(S, 0); S.run.shop.greetT = S.t - 0.6; })]);
    states.push(['merchant_nod', shopS((S) => { at6(S, 0); S.run.shop.tradeT = S.t - 0.35; })]);
    for (let line = 0; line < D.SHOP.hitLines.length; line++) states.push(['merchant_hit_' + line, shopS((S) => { at6(S, 0); S.run.shop.hitT = S.t - 0.16; S.run.shop.hitLine = line; })]);
    states.push(['shop_screen_sell', shopS((S) => { worst(S); S.screen = 'shop'; S.hover = 'sell:23'; })]);
    // TASKS 1687: three pouches, every cell full; the merchant's grid on the first pouch's tab
    const pouches = (S) => { const R = S.run, h = R.hero; S.meta.up.pouch = 3; SIM.step(S, { keys: [], px: 960, py: 540 });
      for (let i = 24; i < h.bag.length; i++) h.bag[i] = Object.assign(SIM.rollItem(R, 3 + (i % 9), i % 5), { id: 3100 + i }); };
    states.push(['shop_idle', shopS((S) => { worst(S); S.screen = 'shop'; S.hover = ''; })]);
    states.push(['shop_pouch', shopS((S) => { worst(S); pouches(S); S.screen = 'shop'; S.bagTab = 1; S.hover = 'sell:30'; })]);
    states.push(['small_props', play((S) => {
      const R = S.run, m = R.map, r = m.rooms.filter((q) => q.type === 'combat').reduce((a, b) => a.w * a.h > b.w * b.h ? a : b), h = R.hero;
      R.en = []; R.pots = []; R.chests = []; R.shrines = []; R.msg = null; S.ev = [];
      m.decor = []; m.traps = []; m.webs = []; m.rugs = [];
      const at = (col, row) => ({ x: (r.x + r.w * (0.25 + 0.25 * col)) * TILE, y: (r.y + r.h * (0.3 + 0.25 * row)) * TILE });
      for (const [i, n] of ['table', 'candles', 'bones', 'vase_a', 'vase_b', 'vase_c', 'padlock', 'shop_scales', 'shop_gems'].entries()) m.decor.push(Object.assign({ n }, at(i % 3, Math.floor(i / 3))));
      m.decor.push(Object.assign({ n: 'candles', lift: 30 }, at(0, 0), { y: at(0, 0).y + 1 }));
      h.x = (r.x + 1) * TILE; h.y = (r.y + r.h - 1) * TILE;
      R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2];
    })]);
    // every biome's floor texture under real light, so a regenerated floor is judged in place
    for (const [zone, f] of [['dungeon', 1], ['crypt', 3], ['lava', 5], ['arcane', 7]]) { const S = play(); S.run = SIM.newRun(S, 'campaign', 3); SIM.enterFloor(S, S.run, f);
      const R = S.run, r = R.map.rooms.filter((q) => q.type !== 'start').reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)), h = R.hero;
      h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h / 2) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['zone_' + zone, S]);
      // the mage on the same spot (TASKS 1114): his blue must part from the cold crypt and arcane stone
      // and the archer (TASKS 1124), in the crypt beside a skeleton archer
      if (zone === 'crypt' || zone === 'arcane') for (const cls of ['mage', 'archer']) { const S2 = play(); S2.run = SIM.newRun(S2, 'campaign', 3); SIM.enterFloor(S2, S2.run, f); const R2 = S2.run, h2 = R2.hero;
        h2.x = h.x; h2.y = h.y; h2.cls = cls; if (cls === 'mage') { h2.eq.weapon = Object.assign({}, h2.eq.weapon, { b: 'staff' }); h2.eq.armor = Object.assign({}, h2.eq.armor, { b: 'robe' }); } else h2.eq.weapon = Object.assign({}, h2.eq.weapon, { b: 'shortbow' });
        R2.en = cls === 'archer' && zone === 'crypt' ? [{ id: 975, type: 'skel_archer', x: h2.x + 90, y: h2.y + 10, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0, face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }] : [];
        R2.msg = null; R2.seen = R2.seen.map(() => 1); R2.cam = [h2.x - SCX.VW / 2, h2.y - SCX.VH / 2]; states.push(['zone_' + zone + '_' + cls, S2]); } }
    // the cave's stone under real light (TASKS 303): the 2nd floor's biggest hall with its rock, banks and water
    { const S = play(); S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play'; SIM.enterFloor(S, S.run, 2);
      const R = S.run, r = R.map.rooms.filter((q) => q.type !== 'start' && q.type !== 'secret').reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)), h = R.hero;
      h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h / 2) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['zone_cave', S]); }
    // the town (R-17, TASKS 1002): the hero where a town run puts him, by the campfire
    { const S = play(); S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero; R.msg = null; S.ev = [];
      R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; states.push(['zone_town', S]); }
    // the whole town in one frame (TASKS 1003): every service, the gate, the mine and the rails
    { const S = play(); S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero; R.msg = null; S.ev = [];
      const r = m.rooms[0]; R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; void h; states.push(['town_services', S]); }
    // the townsfolk at their places (TASKS 1014), the hero out of the way at the unloading yard
    { const S = play(); S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero; R.msg = null; S.ev = [];
      h.x = m.town.svc.portal.x + 3 * TILE; h.y = m.town.svc.portal.y; const r = m.rooms[0]; R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; states.push(['town_npc', S]); }
    // the magma caves' 2nd floor (TASKS 399; their own floor, rock and lava come in 400–404): its biggest hall, its monsters left in
    { const S = play(); plainMagma(S); S.screen = 'play';
      const R = S.run, r = R.map.rooms.filter((q) => q.type !== 'start' && q.type !== 'secret').reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)), h = R.hero;
      h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h / 2) * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['zone_magma', S]); }
    // the magma caves' look (TASKS 402): a plateau backing onto the top wall, its face over the chasm and the lava below; a ridge
    // with the drop on both sides
    { const S = play(); plainMagma(S); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero;
      const r = m.rooms.filter((q) => q.type !== 'secret' && q.y <= m.cliff[q.cx] + 2).sort((a, b) => b.w * b.h - a.w * a.h)[0] || m.rooms[0];
      h.x = (r.cx + 0.5) * TILE; h.y = (r.y + 4.5) * TILE; R.en = R.en.filter((e) => Math.hypot(e.x - h.x, e.y - h.y) > 500); R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, r.y * TILE - 160]; states.push(['magma_hall', S]); }
    // TASKS 413: the colossus's arena on the magma caves' 4th floor: the ring round the lake, its slabs and cover, the boss above it
    { const S = play(); S.run = SIM.newRun(S, 'magma', 3); S.screen = 'play'; SIM.enterFloor(S, S.run, 4); const R = S.run, m = R.map, r = m.rooms.find((q) => q.type === 'boss'), h = R.hero;
      h.x = (r.cx + 0.5) * TILE + 90; h.y = (r.cy + 0.5) * TILE + 200; R.en = R.en.filter((e) => D.BOSSES[e.type]); R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [(r.cx + 0.5) * TILE - SCX.VW / 2, (r.cy + 0.5) * TILE - SCX.VH / 2]; states.push(['magma_arena', S]); }
    // TASKS 413: the colossus rising out of its lake, wading ashore, its moves' wind-ups and what they leave on the floor, stuck after
    // its fists, the edge giving way (2nd phase), the rain of rocks (3rd)
    { const S0 = play(); S0.run = SIM.newRun(S0, 'magma', 3); S0.screen = 'play'; SIM.enterFloor(S0, S0.run, 4);
      const col = (name, f) => { const S = structuredClone(S0), R = S.run, m = R.map, r = m.rooms.find((q) => q.type === 'boss'), h = R.hero, b = R.en.find((e) => e.type === 'boss_colossus'), L0 = D.ARCH.plateau.arena;
        R.en = [b]; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); S.t = R.t = 40; S.ev = []; h.ifr = 1e9;
        const ox = (r.cx + 0.5) * TILE, oy = (r.cy + 0.5 - L0.lake[1] - 2.5) * TILE; h.x = ox + 230; h.y = oy + 60; R.arena = { active: 1, room: r.id, t0: S.t - 5 };
        Object.assign(b, { x: ox, y: oy, st: 'chase', t0: S.t - 2, cdT: 99, face: 1, aimA: Math.atan2(h.y - oy, h.x - ox), tx: h.x, ty: h.y, phase: 0, dist: 0 });
        f(S, R, h, b, r); R.cam = [b.x + 100 - SCX.VW / 2, b.y - 120 - SCX.VH / 2]; states.push([name, S]); };
      const wind = (S, b, mv, k, ph = 0) => { b.phase = ph; b.st = 'bwind'; b.mv = mv; b.fired = 0; b.hitDone = 0; b.t0 = S.t - D.BOSSES.boss_colossus.moves[mv].wind * k; };
      col('colossus_basalt', () => {});
      col('colossus_step', (S, R, h, b) => { b.vx = D.ENEMIES[b.type].spd; b.dist = D.BOSSES[b.type].step + 3;
        S.ev.push({ k: 'colstep', ...D.colossusStepAt(b, 1), id: b.id, t: S.t - 0.15 }); });
      col('colossus_rise', (S, R, h, b) => { const p = R.map.enemies.find((e) => e.type === 'boss_colossus'); b.x = p.x; b.y = p.y; b.st = 'emerge'; b.t0 = S.t - 1.4; h.x = b.x + 60; h.y = b.y + 5 * TILE; });
      col('colossus_wade', (S, R, h, b) => { const p = R.map.enemies.find((e) => e.type === 'boss_colossus'); b.x = p.x; b.y = p.y - 50; b.st = 'wade'; b.t0 = S.t - 0.5; b.tx = p.x; b.ty = p.y - 2.6 * TILE; b.vy = -70; b.dist = 30; h.x = b.x + 60; h.y = b.y - 5 * TILE; });
      col('colossus_fists', (S, R, h, b) => wind(S, b, 'fists', 0.75));
      col('colossus_stomp', (S, R, h, b) => { h.x = b.x + 70; h.y = b.y + 10; wind(S, b, 'stomp', 0.75); });
      col('colossus_stuck', (S, R, h, b) => { b.mv = 'fists'; b.st = 'chase'; b.t0 = S.t - D.BOSSES.boss_colossus.moves.fists.wind - 0.5; b.openUntil = S.t + 0.6; b.cdT = b.openUntil + 0.3; });
      col('colossus_stuck_left', (S, R, h, b) => { b.face = b.pf = -1; b.ft = -9; b.mv = 'fists'; b.st = 'chase'; b.t0 = S.t - D.BOSSES.boss_colossus.moves.fists.wind - 0.5; b.openUntil = S.t + 0.6; b.cdT = b.openUntil + 0.3; });
      col('colossus_crack', (S, R, h, b) => { wind(S, b, 'crack', 0.7); const p = D.colossusContact(b); R.cracks = [{ id: 7701, owner: b.id, who: 'boss_colossus', x: p.x, y: p.y, a: 0.9, len: 380, w: 30, speed: 900, linger: 0.5, t0: S.t - 0.25, dmg: 0, hit: 1 }]; });
      col('colossus_boulder', (S, R, h, b) => { wind(S, b, 'boulder', 0.7, 1); R.rocks = [{ id: 7702, owner: b.id, who: 'boss_colossus', kind: 'boulder', x: h.x + 40, y: h.y + 150, sx: b.x - 30, gy: b.y + 2, z: 240, t0: S.t - 0.5, t: S.t + 0.45, r: 56, dmg: 0, pool: 1 }];
        const P = D.BOSSES.boss_colossus.moves.boulder.pool; R.fires = [{ id: 7703, src: b.id, who: 'boss_colossus', x: h.x - 160, y: h.y + 120, t0: S.t - 1.2, r: P.r, ry: P.ry, t: P.t, dmg: 0, per: P.per, kind: 'pool' }]; });
      col('colossus_rain', (S, R, h, b) => { wind(S, b, 'rain', 1.8, 2); const M = D.BOSSES.boss_colossus.moves.rain;
        R.rocks = [0.15, 0.45, 0.75, 0.92, 0.99, 0.6, 0.3].map((f, i) => ({ id: 7710 + i, owner: b.id, who: 'boss_colossus', kind: 'rain', x: h.x - 300 + i * 95, y: h.y + 40 + (i % 3) * 70, t0: S.t - f * M.warn, t: S.t + (1 - f) * M.warn, r: M.r, dmg: 0, shelter: M.shelter })); });
      col('colossus_shatter', (S, R, h, b) => { wind(S, b, 'shatter', 0.999, 1); const keep = S.t; for (let i = 0; i < 3; i++) SIM.step(S, { keys: [] }); b.t0 -= 0.5; S.t = R.t = keep + 0.03;
        for (const q of R.lavaPending) { q.t0 -= 0.8; } R.en = R.en.filter((e) => e === b); }); }
    // TASKS 427: a lake floor, the camera on the island with the hoard and the crossings to it
    for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; let m = null;
      for (let f = 1; f <= 3 && !m; f++) { SIM.enterFloor(S, S.run, f); if (S.run.map.ftype === 'lake') m = S.run.map; } if (!m) continue;
      const R = S.run, h = R.hero, r = m.rooms.find((q) => q.isle);
      h.x = (r.cx + 0.5) * TILE; h.y = (r.cy + 0.5) * TILE; R.en = R.en.filter((e) => Math.hypot(e.x - h.x, e.y - h.y) > 700); R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['magma_lake', S]);
      // TASKS 453: the same island under the fog as play leaves it, revealed from where the hero stands (every other magma state
      // sees the whole map, so the fog's edge was never in a QA frame)
      const F = structuredClone(S), RF = F.run; RF.seen = RF.seen.map(() => 0); RF.rseen = RF.rseen.map(() => 0); RF.en = []; F.ev = [];
      for (let i = 0; i < 3; i++) SIM.step(F, { keys: [] }); RF.hero.x = h.x; RF.hero.y = h.y; RF.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['magma_fog', F]);
      // TASKS 482: the fog as a walk over the floor leaves it, 45 cells along the way to the exit, the camera looking back on it
      const Wk = structuredClone(F), RW = Wk.run, W0 = m.W, from = Math.floor(h.y / TILE) * W0 + Math.floor(h.x / TILE), to = m.exit.ty * W0 + m.exit.tx, prev = new Map([[from, -1]]), q = [from];
      for (let i = 0; i < q.length && !prev.has(to); i++) for (const o of [1, -1, W0, -W0]) { const n = q[i] + o; if (!prev.has(n) && (m.cells[n] === 1 || m.cells[n] === 6)) { prev.set(n, q[i]); q.push(n); } }
      const way = []; for (let k = prev.has(to) ? to : -1; k >= 0; k = prev.get(k)) way.unshift(k);
      for (const k of way.slice(0, 45)) { RW.hero.x = (k % W0 + 0.5) * TILE; RW.hero.y = (Math.floor(k / W0) + 0.5) * TILE; SIM.step(Wk, { keys: [] }); }
      const mid = way[Math.min(way.length - 1, 22)] ?? from; RW.cam = [(mid % W0 + 0.5) * TILE - SCX.VW / 2, (Math.floor(mid / W0) + 0.5) * TILE - SCX.VH / 2]; Wk.ev = [];
      states.push(['magma_fog_walk', Wk]); break; }
    // and the lake from its north shore: the hero on the floor of a shore plateau nearest the islands, the camera out over the lake
    for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; let m = null;
      for (let f = 1; f <= 3 && !m; f++) { SIM.enterFloor(S, S.run, f); if (S.run.map.ftype === 'lake') m = S.run.map; } if (!m) continue;
      const R = S.run, h = R.hero, W = m.W, is = m.rooms.filter((q) => q.isle), lx = is.reduce((a, q) => a + q.cx, 0) / is.length, ly = is.reduce((a, q) => a + q.cy, 0) / is.length;
      let best = null; for (let k = 0; k < W * m.H; k++) { const x = k % W, y = Math.floor(k / W), r = m.rooms[DUNGEON.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE)];
        if (m.cells[k] !== 1 || !r || r.isle || y > ly - 6 || m.cells[k + W] !== 1 || m.cells[k + 2 * W] === 1) continue; const d = Math.hypot(x - lx, (y - ly) * 1.5); if (!best || d < best[2]) best = [x, y, d]; }
      if (!best) continue; h.x = (best[0] + 0.5) * TILE; h.y = (best[1] + 0.5) * TILE; R.en = R.en.filter((e) => Math.hypot(e.x - h.x, e.y - h.y) > 700); R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH * 0.3]; states.push(['magma_lake_shore', S]); break; }
    // TASKS 428: a river floor, the camera on its widest way over with the pack waiting past it
    for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; let m = null;
      for (let f = 1; f <= 3 && !m; f++) { SIM.enterFloor(S, S.run, f); if (S.run.map.ftype === 'river') m = S.run.map; } if (!m) continue;
      const R = S.run, h = R.hero, W = m.W, c = m.crossings.filter((q) => q.river && q.kind !== 'arch').sort((a, b) => b.cells.length - a.cells.length)[0]; if (!c) continue;
      const cx = c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length, cy = c.cells.reduce((a, k) => a + Math.floor(k / W), 0) / c.cells.length, k0 = c.cells.reduce((a, k) => (Math.hypot(k % W - cx, Math.floor(k / W) - cy) > Math.hypot(a % W - cx, Math.floor(a / W) - cy) ? k : a));
      h.x = (k0 % W + 0.5) * TILE; h.y = (Math.floor(k0 / W) + 0.5) * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [(cx + 0.5) * TILE - SCX.VW / 2, (cy + 0.5) * TILE - SCX.VH / 2]; states.push(['magma_river', S]); break; }
    // TASKS 429: a chasm floor, the camera on its longest chain bridge
    for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; let m = null;
      for (let f = 1; f <= 3 && !m; f++) { SIM.enterFloor(S, S.run, f); if (S.run.map.ftype === 'chasm') m = S.run.map; } if (!m) continue;
      const R = S.run, h = R.hero, W = m.W, c = m.crossings.filter((q) => q.chasm).sort((a, b) => b.cells.length - a.cells.length)[0]; if (!c) continue;
      const cx = c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length, cy = c.cells.reduce((a, k) => a + Math.floor(k / W), 0) / c.cells.length;
      h.x = (cx + 0.5) * TILE; h.y = (cy + 0.5) * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['magma_chasm', S]);
      // (TASKS 1050: a rock in the last half of its warning over the bridge's middle, the hero off it at the near end: the boards crack)
      { const B = structuredClone(S), RB = B.run, k0 = c.cells[Math.floor(c.cells.length / 2)], z = { k: 'fall', x: (k0 % W + 0.5) * TILE, y: (Math.floor(k0 / W) + 0.5) * TILE, per: 5, ph: 0, aim: 1 };
        RB.map.hazards = (RB.map.hazards || []).concat([z]); const c0 = 5 - D.HAZ.fall.warn * 0.3; B.t = RB.t = (((c0 / z.per - z.ph) % 1 + 1) % 1 + 20) * z.per;
        RB.hero.y += c.axis === 'x' ? 3 * TILE : 0; RB.hero.x += c.axis === 'x' ? 0 : 3 * TILE; states.push(['magma_bridge_rock', B]); }
      break; }
    // TASKS 426: a mixed floor (the lake over the chasm), the camera on its longest chain bridge
    for (let sd = 1; sd < 60; sd++) { const S = play(); S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; let m = null;
      for (let f = 1; f <= 3 && !m; f++) { SIM.enterFloor(S, S.run, f); if (S.run.map.ftype2 && S.run.map.ftype === 'lake') m = S.run.map; } if (!m) continue;
      const R = S.run, h = R.hero, W = m.W, c = m.crossings.filter((q) => q.chasm).sort((a, b) => b.cells.length - a.cells.length)[0]; if (!c) continue;
      const cx = c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length, cy = c.cells.reduce((a, k) => a + Math.floor(k / W), 0) / c.cells.length;
      h.x = (cx + 0.5) * TILE; h.y = (cy + 0.5) * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['magma_mix', S]); break; }
    // TASKS 430: a terrace floor, the camera by its lavafall over the first rows and the turn down between them
    for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; let m = null;
      for (let f = 1; f <= 3 && !m; f++) { SIM.enterFloor(S, S.run, f); if (S.run.map.ftype === 'terrace') m = S.run.map; } if (!m) continue;
      const R = S.run, h = R.hero, q = m.lavaFeatures.find((o) => o.kind === 'fall'); if (!q) continue; const r = m.rooms.filter((o) => o.row === 1).sort((a, b) => Math.abs(a.cx * TILE - q.x) - Math.abs(b.cx * TILE - q.x))[0];
      h.x = (r.cx + 0.5) * TILE; h.y = (r.cy + 0.5) * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [(q.x + h.x) / 2 - SCX.VW / 2, q.y + SCX.VH * 0.2 - SCX.VH / 2]; states.push(['magma_terrace', S]); break; }
    // TASKS 475: a terrace's step, the upper row's face down onto the lower one where the rock between them was kept, the hero above it
    for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; let m = null;
      for (let f = 1; f <= 3 && !m; f++) { SIM.enterFloor(S, S.run, f); if (S.run.map.ftype === 'terrace' && !S.run.map.ftype2 && (S.run.map.steps || []).length) m = S.run.map; } if (!m) continue;
      const R = S.run, h = R.hero, W = m.W, n = m.steps.length, x = m.steps.reduce((a, k) => a + (k % W + 0.5) * TILE, 0) / n, y = m.steps.reduce((a, k) => a + (Math.floor(k / W) + 0.5) * TILE, 0) / n;
      let hy = y - 3 * TILE; for (let j = 2; j < 8; j++) if (SIM.cell(m, Math.floor(x / TILE), Math.floor(y / TILE) - j) === 1) { hy = y - j * TILE; break; }
      h.x = x; h.y = hy; R.en = R.en.filter((e) => Math.hypot(e.x - x, e.y - y) > 700); R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [x - SCX.VW / 2, y - SCX.VH / 2]; states.push(['magma_terrace_step', S]); break; }
    // TASKS 431: a lava cave, the camera on a way over a stream of lava across a tunnel
    for (let sd = 1; sd < 40; sd++) { const S = play(); S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; let m = null;
      for (let f = 1; f <= 3 && !m; f++) { SIM.enterFloor(S, S.run, f); if (S.run.map.ftype === 'cave') m = S.run.map; } if (!m) continue;
      const R = S.run, h = R.hero, W = m.W, c = m.crossings.filter((q) => q.kind !== 'arch').sort((a, b) => b.cells.length - a.cells.length)[0] || m.crossings[0]; if (!c) continue;
      const cx = c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length, cy = c.cells.reduce((a, k) => a + Math.floor(k / W), 0) / c.cells.length;
      h.x = (cx + 0.5) * TILE; h.y = (cy + 0.5) * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1);
      R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['magma_cave', S]); break; }
    // TASKS 411: smouldering skeletons in a magma hall: one running at the hero, one with its fuse lit half way, the bones of one
    // struck down burning beside a goblin caught in its reach
    { const S = play(); plainMagma(S); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero;
      const r = m.rooms.filter((q) => q.type !== 'secret' && q.y <= m.cliff[q.cx] + 2).sort((a, b) => b.w * b.h - a.w * a.h)[0] || m.rooms[0], E = D.ENEMIES.skel_ember, B = E.boom;
      h.x = (r.cx + 0.5) * TILE; h.y = (r.y + 4.5) * TILE; h.ifr = 1e9; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; S.t = R.t = 40;
      const mk = (id, type, dx, dy, o) => Object.assign({ id, type, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: r.id, st: 'chase', t0: S.t - 1, face: dx > 0 ? -1 : 1, aimA: Math.atan2(-dy, -dx),
        cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }, o);
      R.en = [mk(1101, 'skel_ember', -260, 40, { vx: E.spd, dist: 37 }), mk(1102, 'skel_ember', 70, -20, { st: 'wind', t0: S.t - E.wind * 0.55, fuse: S.t + E.wind * 0.45 }),
        mk(1103, 'skel_ember', 300, 90, { deadT: S.t - 0.5, hp: 0, dieA: 0, fuse: S.t + B.fuse - 0.5 }), mk(1104, 'goblin', 360, 40, { st: 'idle' })];
      S.ev = [{ k: 'fuse', t: S.t - E.wind * 0.55, x: h.x + 70, y: h.y - 20, r: B.r, d: E.wind, id: 1102, lit: 1 }, { k: 'fuse', t: S.t - 0.5, x: h.x + 300, y: h.y + 90, r: B.r, d: B.fuse, id: 1103 }];
      states.push(['magma_ember', S]); }
    // TASKS 410: a fire priest behind its pack, their weapons alight (a skeleton's sword, a goblin's knife, a demon's fists), its
    // ring glowing under the hero half way through its warning and a pillar standing in another one
    { const S = play(); plainMagma(S); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero;
      const r = m.rooms.filter((q) => q.type !== 'secret' && q.y <= m.cliff[q.cx] + 2).sort((a, b) => b.w * b.h - a.w * a.h)[0] || m.rooms[0], P = D.ENEMIES.fire_priest.pyre;
      h.x = (r.cx + 0.5) * TILE - 120; h.y = (r.y + 4.5) * TILE; h.ifr = 1e9; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x + 120 - SCX.VW / 2, h.y - SCX.VH / 2]; S.t = R.t = 40;
      const mk = (id, type, dx, dy, o) => Object.assign({ id, type, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: r.id, st: 'chase', t0: S.t - 1, face: -1, aimA: Math.PI,
        cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9, kinT: 1e9 }, o);
      R.en = [mk(1201, 'fire_priest', 420, -30, { st: 'wind', t0: S.t - 0.3, aimA: Math.PI }), mk(1202, 'skeleton', 150, -60, { fireT: S.t + 4 }), mk(1203, 'goblin', 180, 50, { fireT: S.t + 4 }),
        mk(1204, 'brute', 290, 10, { fireT: S.t + 0.5 })];
      R.pyres = [{ id: 1210, src: 1201, who: 'fire_priest', x: h.x, y: h.y, t0: S.t - P.warn * 0.6, dmg: 1 }];
      S.ev = [{ k: 'pillar', t: S.t - 0.15, x: h.x + 60, y: h.y + 150, r: P.r, id: 1211 }, { k: 'kindle', t: S.t - 0.18, x: h.x + 420, y: h.y - 74, id: 1201, to: [1202, 1203, 1204] }];
      states.push(['magma_priest', S]); }
    // TASKS 407–409: the magma caves' new kinds, each in a hall by its lava. Imps: one in the air over the lava half way through a
    // leap, one drawing back to throw with the spark in its hand, a spark on its way, one standing across the lava. Golems: one
    // in its whole crust walking up, one heaving its fists up for the slam with its crust half gone, the pool of one fallen
    // apart. Salamanders: one swimming, one breathing fire up the bank with its fire on the floor, one drawing breath on land
    let mgLava = null;
    { const S0 = play(); plainMagma(S0); const m = S0.run.map, W = m.W, crust = new Set(m.crust), lav = (x, y) => m.cells[y * W + x] === 3 && !crust.has(y * W + x);
      // a floor cell of a big hall with four cells of open lava to its right, two to four cells on, and the far bank (fx, three
      // floor cells across) no more than ten cells on
      const bank = (x, y) => { for (let i = x + 6; i <= x + 10; i++) if ([0, 1, 2].every((j) => m.cells[y * W + i + j] === 1 && m.cells[(y - 1) * W + i + j] === 1)) return i; return 0; };
      let spot = null; for (const r of m.rooms.filter((q) => q.type !== 'secret' && q.type !== 'start').sort((a, b) => b.w * b.h - a.w * a.h)) { for (let y = r.y + 2; y < r.y + r.h - 2 && !spot; y++) for (let x = r.x + 2; x < r.x + r.w && !spot; x++)
        if (m.cells[y * W + x] === 1 && m.cells[y * W + x - 1] === 1 && m.cells[y * W + x - 2] === 1 && [2, 3, 4, 5].every((i) => lav(x + i, y)) && [2, 3, 4].every((i) => lav(x + i, y - 1) && lav(x + i, y + 1)) && bank(x, y)) spot = [x, y, r, bank(x, y)]; if (spot) break; }
      if (!spot) throw new Error('no hall by the lava with a far bank for the magma kinds');
      mgLava = { S0, spot };
      const stage = (name, f) => { const S = structuredClone(S0); S.screen = 'play'; const R = S.run, h = R.hero, [x, y, r, fx] = spot;
        h.x = (x - 3.5) * TILE; h.y = (y + 0.5) * TILE + 6; h.ifr = 1e9; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x + 120 - SCX.VW / 2, h.y - SCX.VH / 2]; S.t = R.t = 40; R.fires = []; R.proj = []; S.ev = [];
        const mk = (id, type, dx, dy, o) => Object.assign({ id, type, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: r.id, st: 'chase', t0: S.t - 1, face: dx > 0 ? -1 : 1, aimA: Math.atan2(-dy, -dx),
          cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9, leapT: 1e9, lookT: 1e9, brT: 1e9 }, o);
        f(S, R, h, mk, x, y, fx); states.push([name, S]); };
      const lavaX = (x) => (x + 3.5) * TILE;
      // the leap from the near bank (x) to the far one (fx) over the lava, caught at its top
      stage('magma_imp', (S, R, h, mk, x, y, fx) => { const L0 = D.ENEMIES.imp.leap, lx = (x + 0.5) * TILE, ly = h.y - 20, ltx = (fx + 0.6) * TILE, lty = h.y - 10, ld = 0.16 + Math.hypot(ltx - lx, lty - ly) / L0.spd, u = L0.crouch + ld * 0.5;
        R.en = [mk(1301, 'imp', (lx + ltx) / 2 - h.x, (ly + lty) / 2 - h.y, { st: 'leap', t0: S.t - u, lx, ly, ltx, lty, ld, face: 1 }), mk(1302, 'imp', 100, 6, { st: 'wind', t0: S.t - 0.35, claw: 0, tx: h.x, ty: h.y, aimA: Math.PI }),
          mk(1303, 'imp', (fx + 1.8) * TILE - h.x, -40, { st: 'idle' })];
        R.proj = [{ id: 1310, src: 1303, who: 'imp', k: 'spark', kind: 'fire', x: h.x + 90, y: h.y - 26, vx: -290, vy: 0, t0: S.t - 0.4, life: 2, dmg: 1, own: 'en', r: 5, gz: 26 }]; });
      stage('magma_golem', (S, R, h, mk) => { const E = D.ENEMIES.golem;
        R.en = [mk(1401, 'golem', -290, 40, { vx: E.spd, dist: 40, face: 1, crust: 2, plateG: { 2: S.t - 0.12 } }), mk(1402, 'golem', -130, -95, { st: 'wind', t0: S.t - E.wind * 0.7, crust: 2, tx: h.x, ty: h.y, face: 1, aimA: 0.4 })];   // (in the hall: the bank is three cells wide)
        R.fires = [{ id: 1410, src: 1403, who: 'golem', x: h.x - 80, y: h.y + 90, t0: S.t - 0.8, r: E.pool.r, ry: E.pool.ry, t: E.pool.t, dmg: 0, per: E.pool.per, kind: 'pool' }]; });
      stage('magma_salamander', (S, R, h, mk, x) => { const B = D.ENEMIES.salamander.breath, sx0 = lavaX(x) - h.x;
        R.en = [mk(1501, 'salamander', sx0 + 40, 10, { st: 'idle', fa: Math.PI / 2, lv: 1, lvT: S.t - 2, vx: 0, vy: 30, dist: 30 }), mk(1502, 'salamander', sx0 - 3 * TILE, -70, { st: 'strike', t0: S.t - 0.3, br: 1, fa: Math.PI - 0.3, aimA: Math.PI - 0.3 }),
          mk(1503, 'salamander', 130, 100, { st: 'wind', t0: S.t - B.wind * 0.7, br: 1, fa: Math.PI - 0.2, aimA: Math.PI - 0.2 })];
        R.fires = [0.35, 0.65, 0.95].map((q, i) => ({ id: 1510 + i, src: 1502, who: 'salamander', x: h.x + sx0 - 3 * TILE + Math.cos(Math.PI - 0.3) * (16 + B.reach * q), y: h.y - 70 + Math.sin(Math.PI - 0.3) * (16 + B.reach * q) * 0.8, t0: S.t - 0.25, r: 15, ry: 0.6, t: 2.4, dmg: 0, per: 1, kind: 'breath' })); }); }
    // TASKS 405: a hall of the cult (banners, a cage, basalt, a chain fence on its edge) and the cult's camp round the start's fire
    { const find = (want) => { for (const sd of [3, 5, 8, 13, 21]) for (let f = 1; f <= 3; f++) { const S = play(); S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; if (f > 1) SIM.enterFloor(S, S.run, f); const r = want(S.run.map); if (r) return [S, r]; } return null; };
      const shot = (got, name) => { if (!got) return; const [S, r] = got, R = S.run, h = R.hero; h.x = (r.cx + 0.5) * TILE; h.y = (r.cy + 1.5) * TILE; R.en = R.en.filter((e) => Math.abs(e.x - h.x) > SCX.VW / 2 + 200 || Math.abs(e.y - h.y) > SCX.VH / 2 + 200); R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push([name, S]); };
      shot(find((m) => m.rooms.find((r) => r.plan === 'cultden' && m.decor.some((d) => d.n === 'fence_mg' && d.r === r.id) && m.decor.some((d) => d.n === 'cage' && d.r === r.id))), 'magma_props');
      shot(find((m) => m.rooms.find((r) => r.camp)), 'magma_camp'); }
    // TASKS 404: the light of the magma caves: an altar's hall by the lava, the hero and a foe on its bank lit from the lava's side
    { const S = play(); plainMagma(S); S.screen = 'play'; const R = S.run, m = R.map, W = m.W, h = R.hero, sh = R.shrines[0];
      if (sh) { let best = null; for (let k = 0; k < m.cells.length; k++) { if (m.cells[k] !== 1 || ![1, -1, W, -W].some((o) => m.cells[k + o] === 3 && !m.crust.includes(k + o))) continue;
          const x = (k % W + 0.5) * TILE, y = (Math.floor(k / W) + 0.5) * TILE, d = Math.hypot(x - sh.x, y - sh.y); if (d > 160 && (!best || d < best[2])) best = [x, y, d]; }
        if (best) { h.x = best[0]; h.y = best[1]; const foe = R.en.find((e) => e.type === 'skeleton') || R.en[0];
          R.en = R.en.filter((e) => Math.hypot(e.x - h.x, e.y - h.y) > 600); if (foe) R.en.push(Object.assign(structuredClone(foe), { id: 9201, x: h.x + 70, y: h.y + 10, st: 'chase', face: -1 }));
          R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [(h.x + sh.x) / 2 - SCX.VW / 2, (h.y + sh.y) / 2 - SCX.VH / 2]; states.push(['magma_light', S]); } } }
    // a ridge between the lava and the chasm: lava within three cells on one side, the chasm on the other
    { const S = play(); plainMagma(S); S.screen = 'play'; const R = S.run, m = R.map, W = m.W, h = R.hero;
      const ch = (k) => SIM.chasm(m, k % W, Math.floor(k / W)), lv = (k) => m.cells[k] === 3, inRoom = (k) => DUNGEON.roomAt(m, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE) >= 0;
      const side = (k, o, f) => [1, 2, 3].some((d) => f(k + o * d)), score = (k) => [1, W].some((o) => (side(k, -o, lv) && side(k, o, ch)) || (side(k, -o, ch) && side(k, o, lv)));
      let best = -1; for (const out of [1, 0]) for (let k = W * 8; k < m.cells.length - W * 8 && best < 0; k++) if (m.cells[k] === 1 && (!out || !inRoom(k)) && score(k)) best = k;
      if (best >= 0) { const x = (best % W + 0.5) * TILE, y = (Math.floor(best / W) + 0.5) * TILE; h.x = x; h.y = y; R.en = R.en.filter((e) => Math.hypot(e.x - x, e.y - y) > 500); R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [x - SCX.VW / 2, y - SCX.VH / 2]; states.push(['magma_crossing', S]); } }
    // the rooms' shapes (TASKS 374): each one in view, its whole floor explored, on the first campaign floor that has it
    for (const shape of ['pit', 'colonnade', 'round', 'cross', 'L', 'T', 'gallery', 'hall', 'closet', 'tier']) { const S = play(), R = S.run; let r = null;
      for (let sd = 0; sd < 6 && !r; sd++) { if (sd) { S.run = SIM.newRun(S, 'campaign', 1234 + sd); S.screen = 'play'; }
        for (let f = 1; f <= 8 && !r; f++) { SIM.enterFloor(S, S.run, f); r = S.run.map.rooms.find((q) => q.shape === shape && q.type === 'combat' && (shape !== 'pit' || q.pit)); } }
      if (!r) continue; void R; const Q = S.run, h = Q.hero, x = (r.x + r.w / 2) * TILE, y = (r.y + r.h / 2) * TILE;
      h.x = (r.x + 1.5) * TILE; h.y = (r.y + r.h - 1) * TILE; Q.en = Q.en.filter((e) => e.room === r.id).slice(0, 2); Q.msg = null; Q.seen = Q.seen.map(() => 1); Q.rseen = Q.rseen.map(() => 1); Q.cam = [x - SCX.VW / 2, y - SCX.VH / 2];
      states.push(['room_' + shape, S]); }
    // a two-level hall (TASKS 1358, 375): the whole hall in view with the hero on its gallery and on the floor below, on the floors that have one
    [[22, 6], [18, 8], [33, 6]].forEach(([sd, f], i) => { const S = play(); S.run = SIM.newRun(S, 'campaign', sd); S.screen = 'play'; SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, r = m.rooms.find((q) => q.tier); if (!r) return;
      R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.rseen = R.rseen.map(() => 1); R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2];
      for (const [n, hx, hy] of [['gallery', r.x + 3, r.tier.y - 1], ['floor', r.x + 3, r.tier.y + 4]]) { const T = structuredClone(S); Object.assign(T.run.hero, { x: (hx + 0.5) * TILE, y: hy * TILE + 8, vx: 0, vy: 0 }); states.push(['tier_' + i + '_' + n, T]); } });
    // the rooms floors' layouts (TASKS 379): the first campaign floor of each, the view on its middle, the whole floor explored
    for (const lay of ['maze', 'hall', 'catacomb', 'fortress', 'tomb']) { let S = null;
      for (let sd = 1; sd < 40 && !S; sd++) for (const f of [3, 5, 7]) if (D.stageOf('campaign', f, sd).lay === lay) { S = play(); S.run = SIM.newRun(S, 'campaign', sd); S.screen = 'play'; SIM.enterFloor(S, S.run, f); break; }
      if (!S) continue; const Q = S.run, m = Q.map, r = m.rooms[m.start] || m.rooms[0], x = m.W * TILE / 2, y = m.H * TILE / 2;
      Q.hero.x = (r.cx + 0.5) * TILE; Q.hero.y = (r.cy + 0.5) * TILE; Q.en = []; Q.msg = null; Q.seen = Q.seen.map(() => 1); Q.rseen = Q.rseen.map(() => 1); Q.cam = [x - SCX.VW / 2, y - SCX.VH / 2];
      states.push(['lay_' + lay, S]); }
    // a bridge over a rift of lava and a trapped corridor (TASKS 377): the first campaign floor with each, in view, explored
    for (const [name, find] of [['rift_bridge', (m) => { const c = m.crossings.find((q) => q.rift); return c && c.cells[0]; }], ['gauntlet', (m) => { const t = m.traps.find((q) => q.run !== undefined); return t && Math.floor(t.y / TILE) * m.W + Math.floor(t.x / TILE); }]]) {
      let S = null, k = null; for (let sd = 1; sd < 30 && k == null; sd++) for (let f = 3; f <= 7 && k == null; f++) { S = play(); S.run = SIM.newRun(S, 'campaign', sd); S.screen = 'play'; SIM.enterFloor(S, S.run, f); k = find(S.run.map); }
      if (k == null) continue; const Q = S.run, m = Q.map, x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE;
      Q.hero.x = x - 3 * TILE; Q.hero.y = y + 2 * TILE; Q.en = []; Q.msg = null; Q.seen = Q.seen.map(() => 1); Q.rseen = Q.rseen.map(() => 1); Q.cam = [x - SCX.VW / 2, y - SCX.VH / 2]; states.push([name, S]); }
    // the magma caves' lava (TASKS 401): each kind of crossing over a river, a lake with its source, the crust giving under the hero
    // beside a cell of it melted, and monsters knocked off a plateau, one sinking in the lava and one dropping into the chasm
    { const at = (S, f, pick) => { S.run = SIM.newRun(S, 'magma', 3); S.screen = 'play'; for (let ff = f; ff <= 3; ff++) { SIM.enterFloor(S, S.run, ff); const got = pick(S.run.map); if (got) return got; } return null; };
      const view = (S, x, y, hx = x, hy = y + 40) => { const R = S.run, h = R.hero; h.x = hx; h.y = hy; R.en = R.en.filter((e) => Math.hypot(e.x - x, e.y - y) > 700); R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [x - SCX.VW / 2, y - SCX.VH / 2]; };
      const mid = (m, ks) => [ks.reduce((a, k) => a + (k % m.W + 0.5) * TILE, 0) / ks.length, ks.reduce((a, k) => a + (Math.floor(k / m.W) + 0.5) * TILE, 0) / ks.length];
      for (const kind of ['bridge', 'slabs', 'arch']) { const S = play(), c = at(S, 1, (m) => m.crossings.find((q) => q.lava && q.kind === kind)); if (!c) continue;
        const m = S.run.map, [x, y] = mid(m, c.cells), end = c.cells[0]; view(S, x, y, (end % m.W + 0.5) * TILE, (Math.floor(end / m.W) + 0.5) * TILE); states.push(['magma_' + kind, S]); }
      { const S = play(), q = at(S, 1, (m) => m.lavaFeatures.find((f) => f.kind === 'fall') || m.lavaFeatures[0]); if (q) { view(S, q.x, q.y + 160); states.push(['magma_source', S]); } }
      // TASKS 403: a lavafall down the back wall close up, and a still lake with its vent, its bubbles and a river leaving it
      { const S = play(), q = at(S, 1, (m) => m.lavaFeatures.find((f) => f.kind === 'fall')); if (q) { view(S, q.x, q.y + 60, q.x + 150, q.y + 120); S.t = S.run.t = 50.4; states.push(['magma_fall', S]); } }
      { const S = play(), q = at(S, 1, (m) => m.lavaFeatures.find((f) => f.kind === 'vent' && f.lake)); if (q) { view(S, q.x, q.y, q.x, q.y + 400); S.t = S.run.t = 50.4; states.push(['magma_lava', S]); } }
      { const S = play(), ck = at(S, 1, (m) => m.crust.find((k) => [1, -1, m.W, -m.W].some((o) => m.cells[k + o] === 1 && m.cells[k + 2 * o] === 1) && m.crust.includes(k + 1)));
        if (ck !== null) { const m = S.run.map, x = (ck % m.W + 0.5) * TILE, y = (Math.floor(ck / m.W) + 0.5) * TILE, o = [1, -1, m.W, -m.W].find((d) => m.cells[ck + d] === 1);
          view(S, x, y, x + (o === 1 ? 1 : o === -1 ? -1 : 0) * TILE, y + (o === m.W ? 1 : o === -m.W ? -1 : 0) * TILE + 10);
          S.t = S.run.t = 50; m.melt = { [ck]: { on: 1, crackT: S.t - 0.3 }, [ck + 1]: { on: 1, crackT: S.t - 2, hot: 1, meltT: S.t - 1.5 } }; states.push(['magma_crust', S]); } }
      { const S = play(), got = at(S, 1, (m) => { const W = m.W; for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 1) for (const o of [1, -1]) {
          if (m.cells[k + o] === 3 && m.cells[k + 2 * o] === 3 && !m.crust.includes(k + o)) { const c0 = Math.floor(k / W); for (let j = -10; j <= 10; j++) for (let i = -10; i <= 10; i++) { const n = (c0 + j) * W + k % W + i; if (SIM.chasm(m, n % W, Math.floor(n / W)) && [1, -1, W, -W].some((d) => m.cells[n + d] === 1)) return [k, o, n]; } } } return null; });
        if (got) { const R = S.run, m = R.map, [k, o, n] = got, x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE, foe = R.en.find((e) => e.type === 'skeleton') || R.en[0]; view(S, x, y, x - o * 60, y);
          S.t = R.t = 50; const mk = (id, px, py, extra) => Object.assign(structuredClone(foe), { id, x: px, y: py, st: 'chase', vx: 0, vy: 0, kbx: 0, kby: 0, deadT: -1, hitT: -9, face: -o, elite: 0, mods: [] }, extra);
          R.en.push(mk(9101, x + o * 1.5 * TILE, y + 6, { sinkT: S.t - 0.6, burn: S.t + 2, burnT: S.t }), mk(9102, (n % m.W + 0.5) * TILE, (Math.floor(n / m.W) + 0.5) * TILE, { fallT: S.t - 0.25 }));
          states.push(['magma_knock', S]); } }
      // the hazards (TASKS 406): a vent and a falling rock in the middle of their warning and just after their burst, the hero by them
      for (const k of ['vent', 'fall']) { const name = k === 'vent' ? 'magma_vent' : 'magma_rock';
        // (TASKS 485: a rock in mid-air, its run's others falling after it)
        for (const ph of k === 'vent' ? ['rest', 'warn', 'burst'] : ['warn', 'drop', 'burst']) { const S = play(), z = at(S, 1, (m) => (m.hazards || []).find((q) => q.k === k && (k === 'vent' || (q.aim && !q.tail)))); if (!z) continue; const R = S.run, H = D.HAZ[k], i = R.map.hazards.indexOf(z);
          view(S, z.x, z.y, z.x + H.r + 46, z.y + 10); const c = ph === 'rest' ? z.per * 0.45 : ph === 'warn' ? z.per - H.warn * 0.35 : ph === 'drop' ? z.per - 0.2 : 0.12, t = (((c / z.per - z.ph) % 1 + 1) % 1 + 20) * z.per; S.t = R.t = t; S.ev = [];
          if (ph === 'burst') S.ev.push({ k: k === 'vent' ? 'erupt' : 'rockfall', t: t - c, x: z.x, y: z.y, i }); states.push([name + '_' + ph, S]); } }
      // a vent gate (TASKS 1719, 1645): at rest, as its warning begins, late in it and just after the burst, the hero four cells off
      for (const ph of ['rest', 'warn0', 'warn', 'burst']) { const S = play(), z = at(S, 1, (m) => (m.hazards || []).find((q) => q.gate)); if (!z) continue; const R = S.run, H = D.HAZ.vent, set = R.map.hazards.filter((q) => q.gate && q.ph === z.ph);
        view(S, z.x, z.y, z.x - z.ax * 4 * TILE, z.y - z.ay * 4 * TILE); const c = ph === 'rest' ? z.per * 0.45 : ph === 'warn0' ? z.per - H.warn + 0.1 : ph === 'warn' ? z.per - H.warn * 0.35 : 0.12, t = (((c / z.per - z.ph) % 1 + 1) % 1 + 20) * z.per; S.t = R.t = t; S.ev = [];
        if (ph === 'burst') for (const q of set) S.ev.push({ k: 'erupt', t: t - c, x: q.x, y: q.y, i: R.map.hazards.indexOf(q) }); states.push(['magma_gate_' + ph, S]); }
      // a terrace's surge (TASKS 475): at rest, creeping up late in its warning, at its flood and ebbing back, the view on its ridge
      // down the steps, the hero waiting on the plateau above it
      for (const [ph, c0] of [['rest', 0.5], ['warn', -0.15], ['front', -0.06], ['flood', 0.35], ['ebb', 0.95]]) { const S = play(); let z = null;
        for (let sd = 3; sd < 60 && !z; sd++) { S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; for (let f = 2; f <= 3 && !z; f++) { SIM.enterFloor(S, S.run, f); const m = S.run.map; if (m.ftype === 'terrace' && !m.ftype2) z = (m.hazards || []).find((q) => q.k === 'surge'); } }
        if (!z) continue; const R = S.run, H = D.HAZ.surge, W = R.map.W, k0 = z.cells[z.lv.indexOf(Math.max(...z.lv))], x = (k0 % W + 0.5) * TILE, y = (Math.floor(k0 / W) + 0.5) * TILE;
        const c = ph === 'rest' ? z.per * 0.5 : ph === 'warn' || ph === 'front' ? z.per + c0 * H.warn * 2 : c0 * (ph === 'flood' ? H.burst : H.burst + H.ebb), t = (((c / z.per - z.ph) % 1 + 1) % 1 + 20) * z.per;
        let hy = y - 4 * TILE; for (let j = 4; j < 9; j++) if (SIM.cell(R.map, Math.floor(x / TILE), Math.floor(y / TILE) - j) === 1 && !z.cells.includes(k0 - j * W)) { hy = y - j * TILE; break; }
        view(S, x, y, x, hy); S.t = R.t = t; S.ev = []; if (ph !== 'rest' && ph !== 'warn' && ph !== 'front') S.ev.push({ k: 'surge', t: t - c, x: z.x, y: z.y, i: R.map.hazards.indexOf(z) }); states.push(['magma_surge_' + ph, S]); }
      // (the flood over a floor all unexplored, and the same frame without the surge: they must be the same, TASKS 475 review)
      { const q = states.find((p) => p[0] === 'magma_surge_flood'); if (q) { const S = structuredClone(q[1]); S.run.seen = S.run.seen.map(() => 0); S.run.rseen = (S.run.rseen || []).map(() => 0); states.push(['magma_surge_unseen', S]);
        const S2 = structuredClone(S); S2.run.map.hazards = S2.run.map.hazards.filter((z) => z.k !== 'surge'); S2.ev = S2.ev.filter((e) => e.k !== 'surge'); states.push(['magma_surge_unseen_none', S2]); } }
      // the magma caves' halls (TASKS 434): each kind's first on the runs from seed 3, the camera on it, the hero at its edge
      for (const kind of Object.keys(D.MAGMA_HALLS.kinds)) { const S = play(); let r = null;
        for (let sd = 3; sd < 40 && !r; sd++) { S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; for (let f = 1; f <= 3 && !r; f++) { SIM.enterFloor(S, S.run, f); r = S.run.map.rooms.find((q) => q.hall === kind); } }
        if (!r) continue; const R = S.run, x = (r.cx + 0.5) * TILE, y = (r.cy + 0.5) * TILE; const pack = R.en.filter((e) => e.room === r.id).map((e) => Object.assign(e, { st: 'idle' })); view(S, x, y, x - (r.w / 2 - 1) * TILE, y + 2 * TILE); R.en = pack; states.push(['magma_hall_' + kind, S]); }
      // the magma caves' dead things answering a blow (TASKS 466): a crack's embers, a charred skeleton's ash, a fence's swing
      { const S = play(); const k0 = at(S, 2, (m) => { const W = m.W; if (m.ftype === 'cave') return null; for (let k = W * 6; k < W * (m.H - 6); k++) if ([0, 1, 2, 3, -1, -2, -3].every((i) => [-2, -1, 0, 1, 2].every((j) => m.cells[k + j * W + i] === 1))) return k; return null; });
        if (k0 !== null) { const R = S.run, m = R.map, W = m.W, x = (k0 % W + 0.5) * TILE, y = (Math.floor(k0 / W) + 0.5) * TILE; view(S, x, y, x, y + 8); R.en = [];
          m.decor = m.decor.filter((d) => Math.hypot(d.x - x, d.y - y) > 200).concat([{ n: 'vent_mg', x: x - 70, y: y + 10 }, { n: 'skel_mg', x: x + 60, y: y + 6 }, { n: 'fence_mg', x: x - 60, y: y - 60, len: 120 }]);
          const n0 = m.decor.length - 3; S.ev = [0, 1, 2].map((j) => ({ k: 'prop', t: S.t - 0.15, x: m.decor[n0 + j].n === 'fence_mg' ? x : m.decor[n0 + j].x, y: m.decor[n0 + j].y, i: 'd' + (n0 + j), n: m.decor[n0 + j].n, mat: D.PROP_MAT[m.decor[n0 + j].n], scale: 1, s: j ? 1 : -1 }));
          states.push(['magma_react', S]); } }
      // a hoard's islet (TASKS 476): the hero at the foot of its thin crust; and the moment he falls through it
      // (TASKS 484: under the lava to the chest where he went in, and coming up over the bank's lip where he climbs out)
      for (const ph of ['islet', 'crustfall', 'crustclimb']) { const S = play(); let r = null;
        for (let sd = 3; sd < 40 && !r; sd++) { S.run = SIM.newRun(S, 'magma', sd); S.screen = 'play'; for (let f = 2; f <= 3 && !r; f++) { SIM.enterFloor(S, S.run, f); r = S.run.map.rooms.find((q) => q.islet); } }
        if (!r) continue; const R = S.run, m = R.map, W = m.W, th = m.thin || [], k = th.reduce((b, q) => (Math.hypot(q % W - r.cx, Math.floor(q / W) - r.cy) > Math.hypot(b % W - r.cx, Math.floor(b / W) - r.cy) ? q : b), th[0]);
        const x = (k % W + 0.5) * TILE, y = (Math.floor(k / W) + 0.5) * TILE, mx = (r.cx + 0.5) * TILE, my = (r.cy + 0.5) * TILE; view(S, (x + mx) / 2, (y + my) / 2, x, y);
        const o = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].find((d) => m.cells[k + d] === 1) ?? 1, bx = ((k + o) % W + 0.5) * TILE, by = (Math.floor((k + o) / W) + 0.5) * TILE + 6, h = R.hero;
        if (ph === 'crustfall') { m.melt = { [k]: { on: 1, crackT: S.t - 0.7, hot: 1, meltT: S.t - 0.2 } }; h.x = x; h.y = y; h.sunk = { t: S.t - 0.2, x, y, bx, by }; S.ev.push({ k: 'lavafall', t: S.t - 0.2, x, y, tx: bx, ty: by }); }
        if (ph === 'crustclimb') { h.x = bx; h.y = by; h.climbT = S.t - 0.15; S.ev.push({ k: 'lavafall', t: S.t - 0.75, x, y, tx: bx, ty: by }); }
        states.push(['magma_' + ph, S]); }
      // the brink (TASKS 476): a skeleton a step off the lava, its edge lit, the hero two steps off it on the other side
      { const S = play(); const k0 = at(S, 2, (m) => { const W = m.W; if (m.ftype === 'cave') return null; for (let k = W * 4; k < W * (m.H - 4); k++) if (m.cells[k] === 1 && m.cells[k + 1] === 3 && m.cells[k + 2] === 3 && [-1, -2, -3, -4, -W, W, -W - 1, W - 1, -W - 2, W - 2].every((o) => m.cells[k + o] === 1)) return k; return null; });
        if (k0 !== null) { const R = S.run, W = R.map.W, x = (k0 % W + 0.75) * TILE, y = (Math.floor(k0 / W) + 0.5) * TILE; view(S, x, y, x - 90, y + 6);
          R.en = [{ id: 9001, type: 'skeleton', x, y, vx: 0, vy: 0, hp: 40, max: 40, dmg: 5, elite: 0, room: -1, st: 'chase', t0: 0, face: -1, aimA: Math.PI, cdT: 9, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: 0 }];
          states.push(['magma_brink', S]); } } }
    // the campaign going on into the caves (TASKS 339): its 9th floor on arrival, title and all, and the serpent's 12th
    { const S = play(); SIM.enterFloor(S, S.run, 9); S.run.msg.t = S.t - 0.8; states.push(['campaign_f9_arrive', S]); }
    { const S = play(); SIM.enterFloor(S, S.run, 12); const R = S.run, r = R.map.rooms.find((q) => q.type === 'boss') || R.map.rooms[0], h = R.hero;
      h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h - 2) * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['campaign_f12_serpent', S]); }
    // past the colossus (TASKS 354, 398, 514–515: the choice moved to the 16th; a run through the town): the stairs on, shut while it
    // lives, and once it falls open beside its portal home; the end of a run that won the campaign on the way down
    for (const dead of [0, 1]) { const S = play(); S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); const F = DATA.RUNS.campaign.floors; SIM.enterFloor(S, S.run, F); const R = S.run, m = R.map, h = R.hero; if (!m.down) continue;
      const b = R.en.find((e) => e.type === 'boss_colossus');
      if (dead && b) { R.arena = { active: 1, room: b.room, t0: S.t }; b.hp = 0; SIM.killEnemy(S, R, b); R.en = R.en.filter((e) => e !== b); }
      const g = R.arena && R.arena.gate, mid = g ? [(m.down.x + g.x) / 2, (m.down.y + g.y) / 2] : [m.down.x, m.down.y];
      h.x = m.down.x + 46; h.y = m.down.y + 30; R.msg = null; S.ev = []; R.seen = R.seen.map(() => 1); R.cam = [mid[0] - SCX.VW / 2, mid[1] - SCX.VH / 2];
      states.push([dead ? 'campaign_f16_down_open' : 'campaign_f16_down_shut', S]); }
    { const dead = states.find(([n]) => n === 'dead'); if (dead) { const S = structuredClone(dead[1]); Object.assign(S.result, { mode: 'endless', floor: 21, record: { best: 21, fresh: true }, campaignWon: 1 }); states.push(['endless_dead_campaign', S]); } }
    // the water caves' biggest hall and its winding ways (TASKS 301), the whole hall in view
    { const S = play(); S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play'; SIM.enterFloor(S, S.run, 3);
      const R = S.run, r = R.map.rooms.filter((q) => q.type !== 'start' && q.type !== 'secret').reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a)), h = R.hero;
      h.x = (r.x + r.w / 2) * TILE; h.y = (r.y + r.h / 2) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['cave_hall', S]); }
    {
      const base = structuredClone(states.find(([n]) => n === 'cave_hall')[1]);
      base.run.map.torches = []; base.run.map.decor = base.run.map.decor.filter((d) => !GLOW[d.n]);
      states.push(['cave_known_dark', structuredClone(base)]);
      const R = base.run, m = R.map, mid = Math.floor(R.hero.x / TILE) + 2;
      for (let y = 0; y < m.H; y++) for (let x = mid; x < m.W; x++) R.seen[y * m.W + x] = 0;
      states.push(['cave_known_boundary', structuredClone(base)]);
      for (const [name, x, y] of [['left', -32, R.hero.y], ['right', m.W * TILE + 32, R.hero.y], ['top', R.hero.x, -32], ['bottom', R.hero.x, m.H * TILE + 32]]) {
        const S = structuredClone(base); S.run.hero.x = x; S.run.hero.y = y; states.push(['cave_map_' + name, S]);
      }
    }
    for (const type of ['shroom_a', 'skel_cv', 'shop_sign']) {
      const S = play(); S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play'; const R = S.run;
      const d = R.map.decor.find((q) => q.n === type); if (!d) throw new Error('Missing cave reaction prop: ' + type);
      R.en = []; R.msg = null; R.seen.fill(1); R.rseen.fill(1); R.hero.x = d.x; R.hero.y = d.y + (d.wall ? 40 : 15); R.cam = [d.x - SCX.VW / 2, d.y - SCX.VH / 2];
      SIM.hitProps(S, R, R.hero.x, R.hero.y, 60);
      for (const age of [0.08, 0.2, 0.5]) { const T = structuredClone(S); T.t += age; states.push(['cave_reaction_' + type + '_' + age, T]); }
    }
    {
      let found = false;
      for (let seed = 1; seed <= 20 && !found; seed++) {
        const S = play(); S.run = SIM.newRun(S, 'cave', seed); S.screen = 'play'; const R = S.run, m = R.map;
        for (let k = 0; k < m.cells.length && !found; k++) {
          if (m.cells[k] !== 1 || m.cells[k + 1] !== 6 || m.block.includes(k)) continue;
          let end = k + 1; while (end < k + 10 && m.cells[end] === 6) end++;
          if (end - k < 5 || m.cells[end] !== 1 || Math.floor(k / m.W) !== Math.floor(end / m.W)) continue;
          const h = R.hero; h.x = (k % m.W + 0.5) * TILE; h.y = (Math.floor(k / m.W) + 0.5) * TILE; h.ab.fireball = 1; h.cd.fireball = 0; h.mp = 999; h.cls = 'mage';   // (the warrior's right click is the charge now, TASKS 1130)
          R.en = []; R.pots = []; R.chests = []; R.proj = []; R.msg = null; R.freeze = R.trauma = 0; S.ev = []; R.seen.fill(1); R.rseen.fill(1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2];
          SIM.step(S, { keys: [], rclick: 1, px: SCX.W, py: SCX.H / 2 });
          let n = 0; const pending = [];
          for (let i = 0; i < 100; i++) {
            const p = R.proj.find((p) => p.own === 'hero');
            if (p && SIM.cell(m, Math.floor(p.x / TILE), Math.floor((p.y + (p.gz ?? 20)) / TILE)) === 6 && Math.hypot(p.x - h.x, p.y + (p.gz ?? 20) - h.y) > 60 && n < 3 && i >= n * 8 + 4) { R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; pending.push(['cave_fireball_deep_' + n++, structuredClone(S)]); }
            SIM.step(S, { keys: [], px: SCX.W, py: SCX.H / 2 });
          }
          found = n === 3; if (found) states.push(...pending);
        }
      }
      if (!found) throw new Error('No real fireball crossing deep water in cave QA');
    }
    // the cave's water (TASKS 302): the hero on the shore by a plank bridge over deep water, and a fall into a hall's pool
    { const S = play(); S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play';
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, c = m.crossings.find((q) => q.kind === 'bridge'); if (!c) continue;
        const k = c.cells[0], h = R.hero, shore = [1, -1, m.W, -m.W].map((d) => k + d).find((n) => m.cells[n] === 1 && !c.cells.includes(n)) ?? k;
        h.x = (shore % m.W + 0.5) * TILE; h.y = (Math.floor(shore / m.W) + 0.6) * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; states.push(['cave_crossing', structuredClone(S)]); break; }
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, q = m.waterFeatures.find((o) => o.kind === 'waterfall' && o.room >= 0); if (!q) continue;
        const h = R.hero; h.x = q.x + 2 * TILE; h.y = q.y + 4 * TILE; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [q.x - SCX.VW / 2, q.y - SCX.VH / 2]; states.push(['cave_waterfall', structuredClone(S)]); break; }
      // a breach gushing out of a side wall and a spring boiling up under the rock (TASKS 304)
      for (const kind of ['breach', 'spring']) for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, q = R.map.waterFeatures.find((o) => o.kind === kind); if (!q) continue;
        const h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [q.x - SCX.VW / 2, q.y - SCX.VH / 2]; const m = R.map, block = new Set(m.block || []), spots = [];
        for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 1; x++) {
          if (SIM.cell(m, x, y) !== 1 || block.has(y * m.W + x)) continue;
          const px = (x + 0.5) * TILE, py = (y + 0.5) * TILE;
          if ([-12, 12].some((dx) => [-12, 12].some((dy) => SIM.cell(m, Math.floor((px + dx) / TILE), Math.floor((py + dy) / TILE)) !== 1))) continue;
          spots.push([Math.hypot(px - q.x, py - q.y), px, py]);
        }
        spots.sort((a, b) => a[0] - b[0]); if (!spots.length) throw new Error('No safe hero position for cave_' + kind);
        [, h.x, h.y] = spots[0];
        states.push(['cave_' + kind, structuredClone(S)]); break; }
      // a stream running into a lake with deep water (TASKS 304), the hero wading in the shallows by it, his last steps' rings spreading
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, run = Object.keys(m.waterFlow).map(Number).filter((k) => m.cells[k] === 1 || m.cells[k] === 6); if (!run.length) continue;
        const k0 = run[run.length >> 1], x0 = (k0 % m.W + 0.5) * TILE, y0 = (Math.floor(k0 / m.W) + 0.5) * TILE, at = (k) => [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE];
        const k = m.water.filter((k) => !run.includes(k)).sort((a, b) => Math.hypot(...at(a).map((v, i) => v - [x0, y0][i])) - Math.hypot(...at(b).map((v, i) => v - [x0, y0][i])))[0]; if (k === undefined) continue;
        const h = R.hero; [h.x, h.y] = at(k); R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [x0 - SCX.VW / 2, y0 - SCX.VH / 2]; S.ev = [];
        for (const [age, dx] of [[0.12, 0], [0.4, -14]]) S.ev.push({ k: 'step', wet: true, x: h.x + dx, y: h.y, t: S.t - age });
        states.push(['cave_water', structuredClone(S)]); break; }
      for (const kind of ['hit', 'hurt', 'absorb']) {
        const Q = structuredClone(states.find(([n]) => n === 'cave_water')[1]), h = Q.run.hero;
        Q.ev = [{ k: kind, n: 16.799999999999997, x: h.x, y: h.y, t: Q.t - 0.2, fire: 1 }];
        states.push(['cave_fraction_' + kind, Q]);
      }
      // the cave's own light (TASKS 305): a crystal by water with mushrooms round it, a drop falling and another just landed
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, at = (o) => Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE);
        const near = (o, r) => m.water.some((k) => Math.hypot((k % m.W + 0.5) * TILE - o.x, (Math.floor(k / m.W) + 0.5) * TILE - o.y) < r);
        const c = m.decor.find((d) => d.n === 'crystal_cv' && near(d, 6 * TILE) && m.decor.filter((e) => e.n.startsWith('shroom') && Math.hypot(e.x - d.x, e.y - d.y) < 500).length >= 2); if (!c) continue;
        const h = R.hero; h.x = c.x + 90; h.y = c.y + 70; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [c.x - SCX.VW / 2, c.y - SCX.VH / 2]; S.ev = [];
        m.drips = m.drips.filter((q) => Math.abs(q.x - c.x) > SCX.VW / 2 || Math.abs(q.y - c.y) > SCX.VH / 2);
        m.drips.push({ x: c.x - 150, y: c.y + 40, p: 4, ph: S.t + 0.2, wet: 0 }, { x: c.x + 200, y: c.y - 60, p: 4, ph: S.t - 0.15, wet: 0 }, { x: c.x - 40, y: c.y + 160, p: 5, ph: S.t + 0.25, wet: near({ x: c.x - 40, y: c.y + 160 }, 20) ? 1 : 0 });
        if (at(c) >= 0) states.push(['cave_light', structuredClone(S)]); break; }
      // the cave's props (TASKS 306): a rope bridge with a fire on its posts, the hero on its deck; a plank walk and stepping stones;
      // the explorer's camp round the start's fire; a hall with a boat's wreck on its shore
      const look = (name, find, seeds = [3, 5, 8, 13, 21]) => { for (const sd of seeds) for (let f = 1; f <= 4; f++) { if (S.run.seed !== sd && f === 1) S.run = SIM.newRun(S, 'cave', sd); SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, o = find(m); if (!o) continue;
        const h = R.hero; R.en = []; R.msg = null; R.seen = R.seen.map(() => 1); [h.x, h.y] = o.hero || [o.x + 120, o.y + 90]; R.cam = [o.x - SCX.VW / 2, o.y - SCX.VH / 2]; S.ev = []; states.push([name, structuredClone(S)]); return; } };
      const mid = (c) => { const xs = c.cells.map((k) => (k % S.run.map.W + 0.5) * TILE), ys = c.cells.map((k) => (Math.floor(k / S.run.map.W) + 0.5) * TILE); return [xs.reduce((a, b) => a + b) / xs.length, ys.reduce((a, b) => a + b) / ys.length]; };
      // the bridge with the most swaying plants round it: their stir is measured on this frame (cave_bridge_life); a lily drifts a
      // step in seconds, so a bridge among lilies alone measured as frozen
      const plants = (m, c) => { const [x, y] = mid(c); return (m.flora || []).filter((q) => q.n !== 'lily_cv' && Math.abs(q.x - x) < 240 && Math.abs(q.y - y) < 160).length; };
      look('cave_bridge', (m) => { const bs = m.crossings.filter((q) => q.kind === 'bridge' && q.axis === 'x'), c = bs.filter((q) => q.span[1] - q.span[0] >= 4 && plants(m, q) >= 6).sort((a, b) => plants(m, b) - plants(m, a))[0]; if (!c) return null; const [x, y] = mid(c); return { x, y, hero: [x, y + 8] }; }, [1, 3, 5, 8, 13, 21]);
      look('cave_bridge_v', (m) => { const c = m.crossings.find((q) => q.kind === 'bridge' && q.axis === 'y'); if (!c) return null; const [x, y] = mid(c); return { x, y, hero: [x + 10, y] }; });
      look('cave_ford', (m) => { const c = m.crossings.find((q) => q.look === 'walk'), d = m.crossings.find((q) => q.look === 'stones'); if (!c) return null; if (!d) { const [x, y] = mid(c); return { x, y, hero: [x, y] }; } const [x, y] = mid(c), [x2, y2] = mid(d);
        return Math.hypot(x2 - x, y2 - y) < 700 ? { x: (x + x2) / 2, y: (y + y2) / 2, hero: [x, y] } : { x, y, hero: [x, y] }; });
      look('cave_camp', (m) => { const r = m.rooms.find((q) => q.camp); return r ? { x: m.sanct.x, y: m.sanct.y - 40, hero: [m.spawn.x, m.spawn.y] } : null; });
      look('cave_wreck', (m) => { const d = m.decor.find((o) => o.n === 'wreck_cv'); return d ? { x: d.x, y: d.y - 20 } : null; });
      for (const place of ['bridge', 'camp']) for (const [dir, face, back] of [['front', 1, 0], ['back', 1, 1], ['left', -1, 0], ['right', 1, 0]]) {
        const Q = structuredClone(states.find(([n]) => n === 'cave_' + place)[1]), h = Q.run.hero;
        Object.assign(h, { face, back, backT: -9, faceT: -9, vx: 0, vy: 0, atkT: -9, castT: -9, dashT: -9 }); Q.ev = [];
        states.push(['cave_light_' + place + '_' + dir, Q]);
      }
      for (const [name, dx, dy] of [['front', 0, 1], ['back', 0, -1], ['left', -1, 0], ['right', 1, 0]]) for (const moving of [0, 1]) {
        const Q = structuredClone(states.find(([n]) => n === 'cave_water')[1]), R = Q.run, h = R.hero;
        h.face = dx < 0 ? -1 : 1; h.back = dy < 0; h.backT = -9; h.aim = Math.atan2(dy, dx);
        h.vx = dx * 150 * moving; h.vy = dy * 150 * moving; h.gp = 1.2; h.atkT = h.castT = h.dashT = h.hurtT = -9;
        Q.ev = []; R.zoom = 2; R.cam = [h.x - SCX.VW / 4, h.y - SCX.VH / 4];
        states.push(['cave_wade_' + name + (moving ? '_stride' : '_idle'), Q]);
      }
      // the cave's monsters (TASKS 307, 308) on a shore: a drowned halfway up out of the shallows, another lying in wait (bubbles),
      // a slime at the top of its hop, a small one squatting to jump, a puddle of slime
      S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play';
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, wet = new Set(m.water), dry = (k) => m.cells[k] === 1 && !wet.has(k), W = m.W;
        const at = (k) => [(k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE], open = (k) => [-W - 3, -W, -W + 3, -2 * W - 6, -2 * W + 6, -3 * W].every((d) => dry(k + d));
        const k = m.water.find((k) => m.cells[k] === 1 && open(k)); if (k === undefined) continue;
        const [x, y] = at(k), k2 = m.water.find((j) => m.cells[j] === 1 && Math.hypot(at(j)[0] - x, at(j)[1] - y) > 3 * TILE && Math.hypot(at(j)[0] - x, at(j)[1] - y) < 7 * TILE); if (k2 === undefined) continue;
        const h = R.hero, mk = (id, type, X, Y, o) => { const E = D.ENEMIES[type]; return Object.assign({ id, type, x: X, y: Y, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: -1, st: 'chase', t0: 0,
          face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }, o); };
        h.x = x - 20; h.y = y - 3 * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [x - SCX.VW / 2, y - 2 * TILE - SCX.VH / 2]; S.ev = [];
        R.en = [mk(970, 'drowned', x, y, { st: 'rise', t0: S.t - 0.5, face: -1 }), mk(971, 'drowned', ...at(k2), { st: 'lurk', t0: -9 }),
          mk(972, 'slime', x - 200, y - 3 * TILE, { st: 'strike', t0: S.t - 0.23, aimA: 0 }), mk(973, 'slime_s', x - 250, y - 5 * TILE, { st: 'wind', t0: S.t - 0.3, aimA: 0.3 }),
          mk(974, 'crab', x + 90, y - 3 * TILE - 20, { st: 'wind', t0: S.t - 0.45, fa: Math.PI - 0.3, face: -1, tx: h.x, ty: h.y }), mk(975, 'crab', x - 120, y - 3 * TILE + 70, { st: 'chase', fa: -1.2, face: 1, hitT: S.t - 0.06, armT: S.t - 0.06 })];
        S.ev.push({ k: 'hit', t: S.t - 0.06, x: x - 120, y: y - 3 * TILE + 70 - D.ENEMIES.crab.h * 0.5 - 6, type: 'crab', n: 3, crit: 0, id: 975, arm: 1, a: -1.2 });
        m.goo.push({ id: 9, x: x + 160, y: y - 4 * TILE, t0: S.t - 3, T: 10, r: 34, rNow: 34 }); S.ev.push({ k: 'rise', t: S.t - 0.5, x, y, id: 970 });
        states.push(['cave_monsters', structuredClone(S)]); break; }
      // the eel (TASKS 310) by a lake's shore: one up watching the hero, one coiled to bite, one spitting its jet, one about to come
      // up (its shadow and the boiling water), and the hero on the shore above them
      S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play';
      for (let f = 1; f <= 4; f++) { SIM.enterFloor(S, S.run, f); const R = S.run, m = R.map, W = m.W, deep = (k) => m.cells[k] === 6;
        // a shore over a run of deep water at least nine cells long, two rows out
        const at = (k) => [(k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE], run = (k) => { let n = 0; while (deep(k + n)) n++; return n; };
        const k = m.cells.findIndex((c, k) => c === 1 && m.cells[k - W] === 1 && deep(k + W) && run(k + 2 * W) >= 9); if (k < 0) continue;
        const [x, y] = at(k + 2 * W), h = R.hero, mk = (id, X, Y, o) => { const E = D.ENEMIES.eel; return Object.assign({ id, type: 'eel', x: X, y: Y, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: -1, st: 'chase', t0: S.t - 1,
          face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, hx: X, hy: Y, upT: S.t - 1, bit: 0 }, o); };
        h.x = x + 4.5 * TILE; h.y = y - 2.5 * TILE; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [x + 4.5 * TILE - SCX.VW / 2, y - 40 - SCX.VH / 2]; S.ev = [];
        R.en = [mk(980, x + 0.5 * TILE, y, { face: 1 }), mk(981, x + 3 * TILE, y + 4, { st: 'wind', t0: S.t - 0.4, aimA: -1.0, face: 1 }),
          mk(982, x + 6 * TILE, y, { st: 'strike', t0: S.t - 0.03, spit: 1, aimA: Math.atan2(h.y - 38 - (y - 56), h.x - x - 6 * TILE + 44) }), mk(983, x + 8.5 * TILE, y - 4, { st: 'stir', t0: S.t - 0.6 })];
        states.push(['eel_states', structuredClone(S)]); break; } }
      // the skeleton archer and mage (TASKS 311) in a cave hall: a crab before them, the archer drawn with its aim fixed on the hero
      // and another just raising its bow, the mage gathering water behind the crab, an arrow and a ball of water in flight, the hero soaked
    { const S = play(); S.run = SIM.newRun(S, 'cave', 3); S.screen = 'play'; SIM.enterFloor(S, S.run, 3);
      const R = S.run, m = R.map, r = m.rooms.filter((q) => q.id !== m.start && q.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0], h = R.hero, x0 = (r.x + 2) * TILE, y0 = (r.cy + 0.5) * TILE;
        const mk = (id, type, X, Y, o) => { const E = D.ENEMIES[type]; return Object.assign({ id, type, x: X, y: Y, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: r.id, st: 'chase', t0: S.t - 1,
          face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, hx: X, hy: Y }, o); };
        m.decor = m.decor.filter((d) => !(Math.abs(d.y - y0) < 4 * TILE && d.x > x0 - TILE && d.x < x0 + 10 * TILE));
        h.x = x0; h.y = y0; h.slowT = S.t + 1.5; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [x0 + 4 * TILE - SCX.VW / 2, y0 - 40 - SCX.VH / 2]; S.ev = [];
        const aim = (X, Y) => Math.atan2(h.y - 38 - (Y - SIM.ARROW_Y), h.x - X), A = D.ENEMIES.skel_archer;
        R.en = [mk(970, 'crab', x0 + 3 * TILE, y0 + 6, { fa: Math.PI, face: -1 }),
          mk(971, 'skel_archer', x0 + 8 * TILE, y0 - 1.6 * TILE, { st: 'wind', t0: S.t - A.wind + 0.12, aimA: aim(x0 + 8 * TILE, y0 - 1.6 * TILE), aimD: 7.4 * TILE }),
          mk(972, 'skel_archer', x0 + 9 * TILE, y0 + 1.8 * TILE, { st: 'wind', t0: S.t - 0.18, aimA: aim(x0 + 9 * TILE, y0 + 1.8 * TILE), aimD: 9 * TILE, elite: 1, mods: ['fiery'] }),
          mk(973, 'skel_mage', x0 + 6.5 * TILE, y0 + 0.2 * TILE, { st: 'wind', t0: S.t - 0.6, aimA: Math.PI })];
        const O = D.ENEMIES.skel_mage.orb, ar = D.ENEMIES.skel_archer.arrow;
        R.proj = [{ id: 9901, src: 973, k: 'orb', kind: 'water', x: x0 + 4.4 * TILE, y: y0 - 44, vx: -O.spd, vy: 0, t0: S.t - 0.5, life: O.life, dmg: 1, own: 'en', r: O.r, hitR: 20 + O.r },
          { id: 9902, src: 971, k: 'arrow', kind: 'arrow', x: x0 + 2 * TILE, y: y0 - 70, vx: -ar.spd, vy: 40, t0: S.t - 0.3, life: 1, dmg: 1, own: 'en', r: ar.r, gz: SIM.ARROW_Y - 10 }];
        states.push(['skel_ranged', structuredClone(S)]); }
    // hero walk cycles: right, left, down, up — the same state at successive distances
    // (TASKS 1708) a walk cycle keeps its walker where the game's camera keeps him, the floor travels under him: on a still camera
    // he crossed most of his box over the cycle, past the motion check's ±8 px alignment, and every frame read as changed. S.cam is
    // the camera's travel on the pixel grid, so the rig checks still measure the feet against the floor
    const follow = (S, tx, ty) => { const R = S.run, q = (v) => Math.round(v / 2) * 2, c0 = R.cam; R.cam = [c0[0] + tx, c0[1] + ty]; S.cam = [q(R.cam[0]) - q(c0[0]), q(R.cam[1]) - q(c0[1])]; };
    const cyc = (dx, dy, fn) => { const out = []; for (let i = 0; i < 12; i++) { const S = play(fn); const h = S.run.hero; h.vx = dx * SIM.K.RUN; h.vy = dy * SIM.K.RUN; h.face = dx < 0 ? -1 : 1; h.back = dy < 0 ? 1 : 0; const sl = SIM.stepLen(Math.abs(dx)); h.gp = i * 2 * Math.PI / 12; h.dist = i * 2 * sl / 12; h.x += dx * h.dist; h.y += dy * h.dist; follow(S, dx * h.dist, dy * h.dist); out.push(S); } return out; };
    // the swing: impact frames all round (the sim's damage frame vs a target at 0.8 reach), and whole swings 1/60 s apart for pops
    const base = play((S) => { S.run.msg = null; S.run.en = []; }), clone = () => structuredClone(base);
    const swingAt = (a, T, tgt) => { const S = clone(), h = S.run.hero; h.aim = h.atkA = a; h.face = Math.cos(a) >= 0 ? 1 : -1; h.back = Math.sin(a) < -0.5 ? 1 : 0; h.atkT = S.t - T; h.vx = h.vy = 0;
      S.ev.push({ k: 'swing', t: h.atkT, x: h.x, y: h.y, a, n: 0, f: h.face });
      if (tgt) { const r = SIM.stats(h, S.meta).reach * 0.8; h.qaTgt = [h.x + Math.cos(a) * r, h.y + Math.sin(a) * r]; } return S; };
    // the impact frame with a real body on the target (a skeleton facing the hero), for the blade-over-target check
    const impactAt = (a) => { const S = swingAt(a, SIM.K.HIT, 1), h = S.run.hero, [x, y] = h.qaTgt;
      S.run.en = [{ id: 990, type: 'skeleton', x, y, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0, face: x < h.x ? 1 : -1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }]; return S; };
    const impacts = Object.fromEntries([...Array(16).keys()].map((i) => { const a = -Math.PI + i * Math.PI / 8; return ['a' + Math.round(a * 180 / Math.PI), impactAt(a)]; }));
    const attacks = { hero_swing: { subject: 'hero', states: [...Array(16).keys()].map((i) => swingAt(-Math.PI + i * Math.PI / 8, SIM.K.HIT, 1)) } };
    const swings = {};
    for (const deg of [-135, -90, -45, 0, 45, 90, 135, 180]) swings['hero_swing_' + (deg < 0 ? 'm' + -deg : deg)] = [...Array(30).keys()].map((i) => swingAt(deg * Math.PI / 180, -0.03 + i / 60, 1));
    // enemy attacks played by the sim 1/60 s apart: wind-up → strike → back to the chase must not pop
    const enemyT = (ty, elite, move = 'slam', phase = 0, extra = {}) => { const fr = []; let S = playOf(ty)((S) => { const R = S.run, r = R.map.rooms.find((q) => q.id !== R.map.start && q.w >= 7 && q.h >= 5), h = R.hero, E = D.ENEMIES[ty];
      if (!MG.has(ty)) { h.x = (r.x + 2) * TILE; h.y = (r.y + r.h / 2) * TILE; } h.ifr = 1e9; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2];
      R.en = [{ id: 990, type: ty, x: h.x + 34 + E.r, y: h.y, tx: h.x, ty: h.y, vx: 0, vy: 0, hp: E.hp * (phase ? 0.4 : 1), max: E.hp, dmg: 1, elite, room: MG.has(ty) ? DUNGEON.roomAt(R.map, h.x, h.y) : r.id, st: D.BOSSES[ty] ? 'bwind' : 'wind', mv: move, phase, bossVersion: 1, t0: S.t,
        face: -1, aimA: Math.PI, targetD: 34 + E.r, travel: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }]; if (ty === 'boss_colossus' && move === 'charge') {
        const e = R.en[0], m = R.map, cx = Math.floor(e.x / TILE), cy = Math.floor(e.y / TILE);
        for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 12; x <= cx + 3; x++) if (x > 0 && y > 0 && x < m.W - 1 && y < m.H - 1) m.cells[y * m.W + x] = 1;
        const clear = (p) => p.x > e.x - 13 * TILE && p.x < e.x + 4 * TILE && Math.abs(p.y - e.y) < 5 * TILE;
        m.decor = m.decor.filter((p) => !clear(p)); m.torches = m.torches.filter((p) => !clear(p)); m.block = m.block.filter((k) => !clear({ x: (k % m.W + 0.5) * TILE, y: (Math.floor(k / m.W) + 0.5) * TILE }));
        R.chests = []; R.pots = []; R.shrines = []; m.doors = [];
        h.x = e.x - 340; e.targetD = 340;
      }
      Object.assign(R.en[0], typeof extra === 'function' ? extra(R.en[0], h, R) : extra); });
      for (let i = 0; i < (ty === 'boss_colossus' ? 200 : move === 'weave' || move === 'charge' ? 180 : 100); i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } return fr; };   // the sim steps 1/120 s; frames are 1/60 s
    // monster walk cycles, right and down: one stride in 12 frames (the rig's own stride), subject en990
    const enCyc = (ty, dx, dy) => { const out = [], n = D.BOSSES[ty] ? 24 : 12, H0 = SZ(EN_TEX[ty])[1] * (D.BOSSES[ty] ? D.BOSSES[ty].scale || 1.6 : 1), st = MONSTERS.stride(ty, H0), E = D.ENEMIES[ty];
      for (let i = 0; i < n; i++) { const S = playOf(ty)((S) => { const R = S.run, h = R.hero, r = R.map.rooms.find((q) => q.id !== R.map.start && q.w >= 7 && q.h >= 5); R.msg = null; R.seen = R.seen.map(() => 1);
        const mg = MG.has(ty), hx = h.x, hy = h.y; h.x = mg ? hx - 4 * TILE : (r.x + 1) * TILE; h.y = mg ? hy - 2 * TILE : (r.y + 1) * TILE + 20;
        const x0 = mg ? hx + TILE : (r.x + r.w / 2) * TILE, y0 = mg ? hy : (r.y + r.h / 2) * TILE, d = i * st / n;
        R.en = [{ id: 990, type: ty, x: x0 + dx * d, y: y0 + dy * d, vx: dx * E.spd, vy: dy * E.spd, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: r.id, st: 'chase', t0: -9, face: dx < 0 ? -1 : 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: d, kbx: 0, kby: 0, burn: 0, burnT: 0 }];
        R.cam = [x0 - SCX.VW / 2, y0 - SCX.VH / 2]; follow(S, dx * d, dy * d); }); out.push(S); } return out; };
    const enCycles = {}; for (const ty of ['skeleton', 'goblin', 'brute', 'cultist', 'spider', 'drowned', 'crab', 'skel_archer', 'skel_mage', 'skel_ember', 'fire_priest', 'imp', 'golem', 'salamander', 'boss_spider', 'boss_necro', 'boss_forge', 'boss_colossus']) if (MONSTERS.rigOf(ty)) { enCycles[ty + '_right'] = enCyc(ty, 1, 0); enCycles[ty + '_down'] = enCyc(ty, 0, 1); }
    {
      const S = play(); S.run = SIM.newRun(S, 'cave', 8); SIM.enterFloor(S, S.run, 2);
      const R = S.run, m = R.map, e = structuredClone(enCycles.crab_right[0].run.en[0]);
      const center = m.cells.findIndex((c, k) => c === 1 && m.rooms.some((r) => r.type === 'combat' && k % m.W >= r.x && k % m.W < r.x + r.w && Math.floor(k / m.W) >= r.y && Math.floor(k / m.W) < r.y + r.h) && Array.from({ length: 81 }, (_, j) => [j % 9 - 4, Math.floor(j / 9) - 4]).every(([dx, dy]) => Math.hypot(dx, dy) > 4 || m.cells[k + dy * m.W + dx] === 1));
      if (center < 0) throw new Error('No open floor for crab turning');
      const frames = [], trail = [], speed = D.ENEMIES.crab.spd, rate = 0.8, radius = speed / rate;
      const x0 = (center % m.W + 0.5) * TILE, y0 = (Math.floor(center / m.W) + 0.5) * TILE - radius;
      R.en = [e]; R.pots = []; R.chests = []; R.msg = null; R.seen.fill(1); R.cam = [x0 - SCX.VW / 2, y0 + radius - SCX.VH / 2];
      for (let i = -120; i < 180; i++) {
        const t = (i + 120) / 60, a = t * rate;
        Object.assign(e, { x: x0 + radius * Math.sin(a), y: y0 + radius * (1 - Math.cos(a)), fa: a, vx: speed * Math.cos(a), vy: speed * Math.sin(a), dist: speed * t, crabTrail: trail });
        trail.push({ x: e.x, y: e.y, fa: a, vx: e.vx, vy: e.vy, dist: e.dist }); if (trail.length > 180) trail.shift();
        S.t = 5 + t; if (i >= 0) frames.push(structuredClone(S));
      }
      enCycles.crab_turning = frames;
    }
    // boss_slam_chain: the linked charge that missed (the hero stepped aside, as in the sim's own check) hands over to the slam
    const transitions = { boss_combo: enemyT('boss', 1, 'charge', 1), boss_slam_chain: enemyT('boss', 1, 'charge', 1, (e, h) => { h.y += 70; }), queen_weave: enemyT('boss_spider', 1, 'weave'), queen_attack: enemyT('boss_spider', 1), necro_attack: enemyT('boss_necro', 1), forge_attack: enemyT('boss_forge', 1), colossus_fists: enemyT('boss_colossus', 1, 'fists'), colossus_stomp: enemyT('boss_colossus', 1, 'stomp'), colossus_crack: enemyT('boss_colossus', 1, 'crack'), colossus_boulder: enemyT('boss_colossus', 1, 'boulder', 1), colossus_charge: enemyT('boss_colossus', 1, 'charge'), colossus_call: enemyT('boss_colossus', 1, 'imps', 1), skeleton_attack: enemyT('skeleton', 0), drowned_attack: enemyT('drowned', 0), slime_attack: enemyT('slime', 0), slime_s_attack: enemyT('slime_s', 0),
      // the grab from out of the blow's reach: it catches the hero and hauls him a step in
      drowned_grab: enemyT('drowned', 0, 'slam', 0, (e, h) => ({ x: h.x + 34 + D.ENEMIES.drowned.r + 70, grab: 1 })),
      // the crab (TASKS 309): the pinch at the hero before it; the rush at a hero off its right side (it faces right, the hero below)
      crab_attack: enemyT('crab', 0), crab_rush: enemyT('crab', 0, 'slam', 0, (e, h, R) => { const r = R.map.rooms[e.room]; h.y = Math.max(h.y, (r.y + 0.6) * TILE + 110); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2];
        return { x: h.x, y: h.y - 110, fa: 0, face: 1, aimA: Math.PI / 2, rush: 1 }; }), brute_attack: enemyT('brute', 1),
      // the archer looses from range and the mage throws from behind (TASKS 311): the hero 6 cells off
      skel_archer_attack: enemyT('skel_archer', 0, 'slam', 0, (e, h) => ({ x: h.x + 6 * TILE })), skel_mage_attack: enemyT('skel_mage', 0, 'slam', 0, (e, h) => ({ x: h.x + 6 * TILE })), spider_attack: enemyT('spider', 0), boss_attack: enemyT('boss', 0), cultist_attack: enemyT('cultist', 0),
      // the smouldering skeleton (TASKS 411) comes up to the hero, lights its fuse, stands shaking and bursts
      skel_ember_attack: enemyT('skel_ember', 0, 'slam', 0, { st: 'chase' }),
      // the fire priest (TASKS 410) casts its ring from six cells off, and raises its staff to light its allies' weapons
      // the imp (TASKS 407) throws its spark from five cells off, claws one beside it, and leaps over four cells
      imp_attack: enemyT('imp', 0, 'slam', 0, (e, h) => ({ x: h.x + 5 * TILE, claw: 0, tx: h.x, ty: h.y })), imp_claw: enemyT('imp', 0, 'slam', 0, { claw: 1 }),
      imp_leap: enemyT('imp', 0, 'slam', 0, (e, h) => ({ st: 'leap', x: h.x + 8 * TILE, lx: h.x + 8 * TILE, ly: h.y, ltx: h.x + 4 * TILE, lty: h.y + 30, ld: 0.16 + Math.hypot(4 * TILE, 30) / D.ENEMIES.imp.leap.spd, face: -1, leapT: 1e9, lookT: 1e9 })),
      // the golem (TASKS 409) slams both fists down before it; the salamander (408) snaps at the hero beside it and breathes fire at one four cells off
      // (a row lower than the hero, TASKS 490: level with him he stood over its slam in every frame of it)
      golem_attack: enemyT('golem', 0, 'slam', 0, (e, h) => ({ y: h.y + 26 })), salamander_attack: enemyT('salamander', 0, 'slam', 0, { fa: Math.PI, br: 0 }),
      salamander_breath: enemyT('salamander', 0, 'slam', 0, (e, h) => ({ x: h.x + 4 * TILE, fa: Math.PI, br: 1, brT: 0 })),
      fire_priest_attack: enemyT('fire_priest', 0, 'slam', 0, (e, h) => ({ x: h.x + 6 * TILE, kinT: 1e9 })), fire_priest_kindle: enemyT('fire_priest', 0, 'slam', 0, (e, h) => ({ x: h.x + 6 * TILE, kin: 1, kinT: 1e9 })) };
    // a door's leaf turning on its hinge (TASKS 1683), from shut to open over half a second
    const doorSubj = {};
    for (const dir of ['u', 'l', 'r']) { const S0 = doorS(dir, 1, 0); if (!S0) continue; for (const d of S0.run.map.doors) if (d.open && !d.arena && d.dir === dir && d.kick) { d.kick = 0; d.openT = S0.t - 0.01; } transitions['door_' + dir + '_turn'] = Array.from({ length: 40 }, (_, k) => { const S = structuredClone(S0); S.t += k / 60; S.run.t = S.t; return S; });
      doorSubj['door_' + dir + '_turn'] = 'door' + S0.run.map.doors.findIndex((d) => d.open && !d.arena && d.dir === dir && d.openT === S0.t - 0.01); }
    transitions.crab_turning = enCycles.crab_turning; delete enCycles.crab_turning;
    // deaths: a few live frames, then the kill, through the fall and the bounce (the hero mid-stride and at rest, a skeleton)
    {
      let S = structuredClone(states.find(([name]) => name === 'colossus_rise')[1]);
      const e = S.run.en.find((e) => e.type === 'boss_colossus');
      e.id = 990; e.st = 'emerge'; e.t0 = S.t; S.run.en = [e]; S.run.hero.ifr = 1e9;
      // recorded from the moment it shows: under the lake its rig reports only the ground, and qa took 100 px for its height, not ~215
      const frames = [];
      for (let i = 0; i < 345; i++) { if (i >= 45) frames.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); }
      transitions.colossus_emerge = frames;
      transitions.colossus_phase_stuck = enemyT('boss_colossus', 1, 'fists', 0, { hp: D.ENEMIES.boss_colossus.hp * 0.55 });
      for (const move of ['fists', 'boulder', 'call', 'charge']) {
        const source = transitions['colossus_' + move], start = structuredClone(source[move === 'charge' ? 65 : 40]), frames = [];
        for (let i = 0; i < 180; i++) {
          const S = structuredClone(start), b = S.run.en[0]; S.t += i / 60; S.run.t = S.t;
          if (i >= 5) { b.deathPose = { ...b }; b.deadT = start.t + 5 / 60; b.hp = 0; }
          frames.push(S);
        }
        transitions['colossus_death_' + move] = frames;
      }
    }
    const eventT = (prep, kill, ty) => { const fr = []; let S = playOf(ty)(prep); for (let i = 0; i < 75; i++) { if (i === 5) kill(S); fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } return fr; };
    const heroDies = (S) => { const h = S.run.hero; h.hp = 0; h.deadT = S.t; };
    transitions.hero_death = eventT((S) => { S.run.en = []; S.run.msg = null; }, heroDies);
    transitions.hero_death_run = eventT((S) => { S.run.en = []; S.run.msg = null; const h = S.run.hero; h.vx = SIM.K.RUN; h.gp = 1.3; }, heroDies);
    const clear = (S) => { S.run.en = []; S.run.msg = null; };
    transitions.hero_dash = eventT(clear, (S) => { const h = S.run.hero; h.dashT = S.t; h.dashX = 1; h.dashY = 0; });
    transitions.hero_dash_up = eventT(clear, (S) => { const h = S.run.hero; h.dashT = S.t; h.dashX = 0; h.dashY = -1; });
    transitions.hero_hurt = eventT(clear, (S) => { const h = S.run.hero; h.hurtT = S.t; h.hurtX = 1; });
    transitions.hero_turn = eventT(clear, (S) => { const h = S.run.hero; h.face = -h.face; h.faceT = S.t; });
    // whirl and cast need the pointer held on one aim: the sim re-aims the hero every step
    const aimT = (a, fire) => { const fr = []; let S = play(clear); for (let i = 0; i < 75; i++) { const h = S.run.hero, R = S.run;
      if (i === 5) { h.aim = a; const f = Math.cos(a) >= 0 ? 1 : -1; if (f !== h.face) { h.face = f; h.faceT = S.t; } fire(S, h); } fr.push(S); S = structuredClone(S);
      const sx = (h.x - R.cam[0]) * (D.ZOOM || 1), sy = (h.y - 30 - R.cam[1]) * (D.ZOOM || 1); for (let k = 0; k < 2; k++) SIM.step(S, { px: sx + Math.cos(a) * 300, py: sy + Math.sin(a) * 300, keys: [] }); } return fr; };
    const whirl = (S, h) => { h.whirlT = h.castT = S.t; h.castK = 'whirl'; h.whirlA = h.aim; S.ev.push({ k: 'whirl', t: S.t, x: h.x, y: h.y, a: h.aim, r: D.abRank('whirl', 1).r }); };
    // TASKS 177: the whirl's circle on screen is its reach: skeletons at the edge of the damage zone, right, left and below (the zone is squeezed ×1.3 in depth)
    states.push(['whirl_reach', play((S) => { const R = S.run, h = R.hero, E = D.ENEMIES.skeleton, wr = D.abRank('whirl', 1).r - 4 + E.r; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2];
      R.en = [[wr, 0], [-wr, 0], [0, wr / 1.3]].map(([dx, dy], i) => ({ id: 980 + i, type: 'skeleton', x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0,
        face: dx > 0 ? -1 : 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }));
      h.aim = 0; whirl(S, h); h.whirlT = h.castT = S.ev.at(-1).t = S.t - 0.22; })]);
    const cast = (S, h) => { h.castT = S.t; h.castK = 'fireball'; };
    for (const [n, a] of [['r', 0], ['d', Math.PI / 2], ['ul', -2.3]]) { transitions['hero_whirl_' + n] = aimT(a, whirl); transitions['hero_cast_' + n] = aimT(a, cast); }
    // a lone monster beside the hero, then an event on it: a skeleton crumbles, a spider flips onto its back, a goblin's ears ring on a hit
    const lone = (ty, id = 990) => (S) => { const R = S.run, h = R.hero; R.msg = null; R.en = [{ id, type: ty, x: h.x + 60, y: h.y, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0,
      face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9 }]; };   // calm: it must not notice the hero and step up first
    const kill = (S) => { const e = S.run.en[0]; e.hp = 0; e.deadT = S.t; e.hitT = S.t; e.dieA = 0; };   // struck from the hero's side
    // every way each dies (the variant is the id's: skeleton id % 3 — heap, burst, topple; spider id % 2 — on its back, curled)
    transitions.skeleton_death = eventT(lone('skeleton'), kill); transitions.skeleton_death_burst = eventT(lone('skeleton', 991), kill); transitions.skeleton_death_topple = eventT(lone('skeleton', 992), kill);
    transitions.spider_death = eventT(lone('spider'), kill); transitions.spider_death_curl = eventT(lone('spider', 991), kill);
    // the two ways each of the rest goes down (id % 2), the ghost's one; then a blow on every type (the flinch)
    for (const ty of ['goblin', 'brute', 'cultist', 'fire_priest', 'boss']) { transitions[ty + '_death'] = eventT(lone(ty), kill, ty); transitions[ty + '_death_b'] = eventT(lone(ty, 991), kill, ty); }
    transitions.ghost_death = eventT(lone('ghost'), kill);
    for (const ty of ['skel_archer', 'skel_mage']) { transitions[ty + '_death'] = eventT(lone(ty), kill); transitions[ty + '_death_burst'] = eventT(lone(ty, 991), kill); transitions[ty + '_death_topple'] = eventT(lone(ty, 992), kill); }
    // a smouldering skeleton struck down: its bones lie with the fuse burning, then burst
    const emberKill = (S) => { kill(S); const e = S.run.en[0], B = D.ENEMIES.skel_ember.boom; e.fuse = S.t + B.fuse; S.ev.push({ k: 'fuse', t: S.t, x: e.x, y: e.y, r: B.r, d: B.fuse, id: e.id }); };
    transitions.skel_ember_death = eventT(lone('skel_ember'), emberKill, 'skel_ember'); transitions.skel_ember_death_topple = eventT(lone('skel_ember', 992), emberKill, 'skel_ember');
    for (const ty of ['drowned', 'slime', 'crab', 'imp', 'golem', 'salamander', 'mimic']) { transitions[ty + '_death'] = eventT(lone(ty), kill, ty); transitions[ty + '_death_b'] = eventT(lone(ty, 991), kill, ty); }
    // a golem's pool of lava where it fell apart, through its whole life (TASKS 409)
    transitions.golem_pool = eventT(lone('golem'), (S) => { kill(S); const e = S.run.en[0], P = D.ENEMIES.golem.pool; S.run.fires = [{ id: 995, src: e.id, who: 'golem', x: e.x, y: e.y, t0: S.t, r: P.r, ry: P.ry, t: P.t, dmg: 0, per: P.per, kind: 'pool' }]; S.ev.push({ k: 'pool', t: S.t, x: e.x, y: e.y, r: P.r, d: P.t, id: e.id }); }, 'golem');
    // a blow on a golem's crust takes a plate off: sparks off the stone, a clang; with its crust gone its cracks blaze
    transitions.hit_golem_crust = eventT((S) => { lone('golem')(S); const h = S.run.hero; h.x -= 400; S.run.cam = [h.x + 400 - SCX.VW / 2, h.y - SCX.VH / 2]; }, (S) => { const e = S.run.en[0], h = S.run.hero; e.hitT = e.armT = S.t; e.crust = 1;
      S.ev.push({ k: 'hit', t: S.t, x: e.x, y: e.y - D.ENEMIES.golem.h * 0.5 - 6, type: 'golem', n: 3, crit: 0, id: e.id, arm: 1, a: Math.atan2(h.y - e.y, h.x - e.x) }); }, 'golem');
    const roll = (S, n, at) => { const fr = []; for (let i = 0; i < n; i++) { if (at) at(S, i); fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } return fr; };
    // the golem's crust struck off plate by plate, then grown back plate by plate once the hero has gone off (TASKS 454)
    transitions.golem_crust_off = roll(playMg(lone('golem')), 150, (S, i) => { if (i < 5 || (i - 5) % 25 || i > 80) return; const e = S.run.en[0], h = S.run.hero;
      const n0 = e.crust ?? D.ENEMIES.golem.crust.n; e.crust = n0 - 1; e.hitT = e.armT = e.blowT = e.growT = S.t; (e.plateT = e.plateT || {})[n0] = S.t; (e.plateA = e.plateA || {})[n0] = Math.atan2(e.y - h.y, e.x - h.x);
      S.ev.push({ k: 'hit', t: S.t, x: e.x, y: e.y - D.ENEMIES.golem.h * 0.5 - 6, type: 'golem', n: 3, crit: 0, id: e.id, arm: 1, a: Math.atan2(h.y - e.y, h.x - e.x) }); });
    // (TASKS 1719: the hero stood over the claw's and the plates' contact; the same frames again with him hidden)
    for (const k of ['imp_claw', 'golem_crust_off']) if (transitions[k]) transitions[k + '_clear'] = transitions[k].map((S) => { const C = structuredClone(S); C.run.hero.qaHide = 1; return C; });
    transitions.golem_crust_regrow = roll(playMg((S) => { lone('golem')(S); const h = S.run.hero, e = S.run.en[0], C = D.ENEMIES.golem.crust; h.x -= 400; S.run.cam = [h.x + 400 - SCX.VW / 2, h.y - SCX.VH / 2];
      Object.assign(e, { crust: 0, blowT: S.t - C.calm - 1, growT: S.t - C.regrow + 0.2 }); }), 300);
    // the salamander at the lava's bank of magma_salamander: down into the lava to heal, and up out of it once mended (TASKS 454)
    { const { S0, spot: [x, y] } = mgLava, E = D.ENEMIES.salamander, sal = (o) => { const S = structuredClone(S0); S.screen = 'play'; const R = S.run, h = R.hero;
        h.x = (x - 3.5) * TILE; h.y = (y + 0.5) * TILE + 6; h.ifr = 1e9; R.msg = null; R.seen = R.seen.map(() => 1); R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; R.camV = [0, 0]; R.fires = []; R.proj = []; S.ev = [];   // (the camera at rest on its target: a camera still travelling jitters the art grid)
        R.en = [Object.assign({ id: 990, type: 'salamander', x: (x + 0.5) * TILE, y: h.y, vx: 0, vy: 0, hp: E.hp * 0.3, max: E.hp, dmg: 1, elite: 0, room: DUNGEON.roomAt(R.map, h.x, h.y), st: 'soak', t0: S.t, face: 1, fa: 0, aimA: 0,
          cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, calmT: 1e9, healT: S.t + 99, brT: 1e9, sx: (x + 3.5) * TILE, sy: h.y, soaked: 0, lv: 0, lvT: S.t - 2 }, o(S))]; return S; };
      transitions.salamander_submerge = roll(sal(() => ({})), 150);
      transitions.salamander_emerge = roll(sal((S) => ({ x: (x + 3.5) * TILE, hp: E.hp, soaked: 1, soakT: S.t - 2, fa: Math.PI, face: -1, lv: 1 })), 150);
      // the imp's leap over the lava from the far bank to the hero's (TASKS 1054: its leap was staged over the floor only)
      { const I = D.ENEMIES.imp, lx = (fx => (fx + 1.5) * TILE)(mgLava.spot[3]), ltx = (x + 0.5) * TILE;
        transitions.imp_leap_lava = roll(sal((S) => ({ type: 'imp', x: lx, hp: I.hp, max: I.hp, st: 'leap', t0: S.t, lx, ly: S.run.hero.y, ltx, lty: S.run.hero.y, ld: 0.16 + Math.abs(lx - ltx) / I.leap.spd, face: -1, leapT: 1e9, lookT: 1e9, cdT: 99 })), 90); } }
    // the drowned stands up out of the shallows (the hero out of its sense: the rise is the event's), and sinks back at its post
    const lurk = (S) => { lone('drowned')(S); const e = S.run.en[0], h = S.run.hero; h.x -= 140; e.st = 'lurk'; e.t0 = -9; };
    transitions.drowned_rise = eventT(lurk, (S) => { const e = S.run.en[0]; e.st = 'rise'; e.t0 = S.t; S.ev.push({ k: 'rise', t: S.t, x: e.x, y: e.y, id: e.id }); });
    transitions.drowned_sink = eventT((S) => { lurk(S); S.run.en[0].st = 'idle'; }, (S) => { const e = S.run.en[0]; e.st = 'lurk'; e.t0 = S.t; });
    // a blow off the crab's armour: sparks, the claws driven back, no flinch of the shell
    transitions.hit_crab_armor = eventT((S) => { lone('crab')(S); const h = S.run.hero; S.run.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; }, (S) => { const e = S.run.en[0], h = S.run.hero; e.hitT = e.armT = S.t;
      S.ev.push({ k: 'hit', t: S.t, x: e.x, y: e.y - D.ENEMIES.crab.h * 0.5 - 6, type: 'crab', n: 3, crit: 0, id: e.id, arm: 1, a: Math.atan2(h.y - e.y, h.x - e.x) }); });
    for (const ty of ['skeleton', 'spider', 'brute', 'cultist', 'ghost', 'boss', 'drowned', 'slime', 'crab', 'skel_archer', 'skel_mage', 'skel_ember', 'fire_priest', 'imp', 'salamander']) transitions['hit_' + ty] = eventT((S) => { lone(ty)(S); const h = S.run.hero; h.x -= 400; S.run.cam = [h.x + 400 - SCX.VW / 2, h.y - SCX.VH / 2]; }, (S) => { S.run.en[0].hitT = S.t; }, ty);
    transitions.goblin_attack = enemyT('goblin', 0);
    transitions.goblin_hit = eventT((S) => { lone('goblin')(S); const h = S.run.hero; h.x -= 400; S.run.cam = [h.x + 400 - SCX.VW / 2, h.y - SCX.VH / 2]; }, (S) => { S.run.en[0].hitT = S.t; });
    // a monster at its post, 2 s at 1/60 s: breathing, a turn and a shift about the spot
    const loops = {};
    const serpentState = (fn) => play((S) => {
      S.run = SIM.newRun(S, 'cave', 71); SIM.enterFloor(S, S.run, 4); const R = S.run, m = R.map, h = R.hero, b = R.en.find((e) => e.type === 'boss_serpent'), r = m.rooms[b.room];
      h.x = (r.cx + 0.5) * TILE; h.y = (r.cy + 0.5) * TILE; h.ifr = 1e9; SIM.step(S, { px: 960, py: 540, keys: [] });
      R.en = [b]; b.id = 990; const k = m.serpentPools[1][0];
      Object.assign(b, { x: (k % m.W + 0.5) * TILE, y: (Math.floor(k / m.W) + 0.5) * TILE, pool: 1, st: 'chase', cdT: S.t + 99, t0: S.t, face: 1, mv: 'wave', phase: 0, bit: 0 });
      R.seen.fill(1); R.msg = null; R.trauma = 0; S.ev = []; R.cam = [b.x + 85 - SCX.VW / 2, b.y - 25 - SCX.VH / 2]; if (fn) fn(S, b);
    });
    const serpentFrames = (fn, n = 120) => { const frames = []; let S = serpentState(fn);
      for (let i = 0; i < n; i++) { frames.push(S); S = structuredClone(S); for (let j = 0; j < 2; j++) SIM.step(S, { px: 960, py: 540, keys: [] }); } return frames;
    };
    loops.serpent_idle = serpentFrames(undefined, 271);
    transitions.serpent_rise = serpentFrames((S, b) => { b.st = 'stir'; b.t0 = S.t - 0.3; });
    transitions.serpent_dive = serpentFrames((S, b) => { b.st = 'dive'; b.t0 = S.t; });
    transitions.serpent_death = serpentFrames((S, b) => { b.hp = 0; b.deadT = S.t; }, 95);
    states.push(['serpent_arena', serpentState()]);
    states.push(['cave_arena_exit', serpentState((S, b) => {
      const R = S.run, h = R.hero; S.t += 10; R.t += 10; R.bossDead = true; b.hp = 0; b.deadT = S.t - 3;
      h.x = R.map.exit.x - 48; h.y = R.map.exit.y + 32; R.cam = [R.map.exit.x - SCX.VW / 2, R.map.exit.y - SCX.VH / 2];
    })]);
    for (const mv of Object.keys(D.BOSSES.boss_serpent.moves)) {
      const setup = (S, b) => { b.st = 'bwind'; b.mv = mv; b.t0 = S.t; b.fired = 0; b.hitDone = 0; b.tx = S.run.hero.x; b.ty = S.run.hero.y; b.face = b.tx >= b.x ? 1 : -1; b.aimA = Math.atan2(b.ty - b.y, b.tx - b.x);
        if (mv === 'fan') { const [x, y] = SIM.serpentMouth(b); b.aimA = Math.atan2(S.run.hero.y - 38 - y, S.run.hero.x - x); }
      };
      transitions['serpent_' + mv] = serpentFrames(setup, 155);
      states.push(['serpent_warn_' + mv, structuredClone(transitions['serpent_' + mv][Math.floor(D.BOSSES.boss_serpent.moves[mv].wind * 60 * 0.9)])]);
      states.push(['serpent_attack_' + mv, structuredClone(transitions['serpent_' + mv][Math.floor((D.BOSSES.boss_serpent.moves[mv].wind + 0.12) * 60)])]);
      if (mv === 'wave') states.push(['serpent_emit_wave', structuredClone(transitions.serpent_wave[52])]);
      if (mv === 'fan') for (const face of [-1, 1]) {
        const frames = serpentFrames((S, b) => { setup(S, b); b.face = face; const h = S.run.hero; h.x = b.x + face * 100; h.y = b.y;
          const [x, y] = SIM.serpentMouth(b); b.aimA = Math.atan2(h.y - 38 - y, h.x - x);
        }, 65);
        states.push(['serpent_emit_fan_' + face, structuredClone(frames[61])]);
      }
    }
    states.push(['serpent_punish_window', serpentState((S, b) => { b.st = 'recover'; b.openUntil = b.cdT = S.t + 2; })]);
    for (let i = 0; i < 8; i++) states.push(['serpent_bite_aim_' + i, serpentState((S, b) => {
      const a = i * Math.PI / 4; b.st = 'bwind'; b.mv = 'bite'; b.t0 = S.t - D.BOSSES.boss_serpent.moves.bite.wind - 0.01; b.aimA = a; b.face = Math.cos(a) >= 0 ? 1 : -1;
      b.tx = b.x + Math.cos(a) * 100; b.ty = b.y + Math.sin(a) * 100; S.run.hero.x = b.tx; S.run.hero.y = b.ty;
    })]);
    transitions.serpent_flood = serpentFrames((S, b) => {
      const R = S.run, m = R.map, h = R.hero, threshold = D.BOSSES.boss_serpent.phases.find((p) => p.at < 1).at;
      b.hp = b.max * threshold + 1; b.cdT = S.t + 0.25;
      const floor = m.cells.flatMap((v, k) => v === 1 && !m.block.includes(k) ? [{ x: (k % m.W + 0.5) * TILE, y: (Math.floor(k / m.W) + 0.5) * TILE }] : [])
        .sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y));
      if (!floor.length) throw new Error('No shore for phase two cast');
      h.x = floor[0].x; h.y = floor[0].y; h.mp = 999; h.ab.fireball = 1; h.cd.fireball = 0; h.cls = 'mage';
      const z = R.zoom || D.ZOOM || 1;
      SIM.step(S, { keys: [], rclick: 1, px: (b.x - R.cam[0]) * z, py: (b.y - D.ENEMIES.boss_serpent.h * 0.45 - R.cam[1]) * z });
    }, 240);
    {
      const frames = transitions.serpent_flood, complete = frames.find((S) => S.run.map.flood && S.run.map.flood.n === S.run.map.floodCells.length);
      const attack = frames.find((S) => S.run.en[0].phase === 1 && S.run.proj.some((p) => p.src === S.run.en[0].id && (p.k === 'wave' || p.k === 'jet')));
      if (!complete || !attack || !complete.run.en.some((e) => e.type === 'drowned')) throw new Error('Incomplete live phase two QA');
      states.push(['cave_flood_complete', structuredClone(complete)], ['cave_phase2_attack', structuredClone(attack)]);
    }
    states.push(['serpent_flood_warning', structuredClone(transitions.serpent_flood[45])]);
    states.push(['serpent_flood', structuredClone(transitions.serpent_flood[100])]);
    states.push(['serpent_emerge_warning', structuredClone(transitions.serpent_rise[30])]);
    {
      const S = structuredClone(states.find(([name]) => name === 'win')[1]); S.result.mode = 'cave'; S.result.floor = 4;
      const R = SIM.newRun(S, 'cave', 71); S.result.hero = structuredClone(R.hero); S.result.heroStats = SIM.stats(R.hero, S.meta);
      S.result.C.floors = S.result.C.passed = 4; states.push(['win_cave_worst', structuredClone(S)]);
      Object.assign(S.result, { lvl: 12, kills: 80, gold: 800, shards: 121, found: 70, base: 31, statBonus: 20, time: 1800 });
      Object.assign(S.result.C, { foes: 80, kills: 80, lootN: 70, loot: 65, secN: 4, sec: 2, pct: (1 + 65 / 70 + 0.5) / 3 });
      states.push(['win_cave', S]);
    }
    { const S = structuredClone(states.find(([name]) => name === 'win_cave')[1]), R = SIM.newRun(S, 'magma', 71);
      S.result.mode = 'magma'; S.result.hero = structuredClone(R.hero); S.result.heroStats = SIM.stats(R.hero, S.meta); S.result.lvl = 17; states.push(['win_magma', S]); }
    { const fr = []; let S = play((S) => { S.run.en = []; S.run.msg = null; }); for (let i = 0; i < 180; i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } loops.hero_idle = fr; }
    for (const ty of ['skeleton', 'goblin', 'spider', 'cultist', 'brute', 'ghost', 'boss', 'drowned', 'slime', 'crab', 'skel_archer', 'skel_mage', 'mimic', ...MG]) { const fr = []; let S = playOf(ty)((S) => { const R = S.run, h = R.hero; R.msg = null;
      R.en = [{ id: 990, type: ty, x: h.x + 90, y: h.y, hx: h.x + 90, hy: h.y, vx: 0, vy: 0, hp: 30, max: 30, dmg: 1, elite: 0, room: -1, st: 'idle', t0: 0, face: -1, pf: -1, ft: -9, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 }];
      h.x -= 400; R.cam = [h.x + 400 - SCX.VW / 2, h.y - SCX.VH / 2]; });
      // the camera held where it was set: the sim eased it toward the hero 400 px off, and the sheets slid for the first 17 frames
      const cam = S.run.cam.slice();
      for (let i = 0; i < 120; i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); S.run.cam = cam.slice(); }
      loops[ty + '_idle'] = fr; }
    // the eel (TASKS 310) on the lake of eel_states, the hero on the shore: it comes up, bites him, spits at him farther off, dives,
    // is struck and dies; up and watching for 2 s (subject en990)
    { const lake = (states.find((q) => q[0] === 'eel_states') || [])[1], E = D.ENEMIES.eel;
      const eelT = (o, hero = [20, -2 * TILE], ev, n = 100) => { if (!lake) return []; const fr = []; let S = structuredClone(lake); const R = S.run, h = R.hero, e = R.en.find((q) => q.id === 981);
        Object.assign(e, { id: 990, st: 'chase', t0: S.t, upT: S.t, cdT: 99, face: 1, aimA: 0, spit: 0, bit: 0 }); R.en = [e]; S.ev = []; h.x = e.x + hero[0]; h.y = e.y + hero[1]; h.ifr = 1e9; h.vx = h.vy = 0;
        R.cam = [e.x - SCX.VW / 2, e.y - 60 - SCX.VH / 2]; Object.assign(e, typeof o === 'function' ? o(e, h, S) : o);
        for (let i = 0; i < n; i++) { if (i === 5 && ev) ev(S, e); fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } return fr; };
      transitions.eel_rise = eelT((e, h, S) => ({ st: 'stir', t0: S.t - E.warn + 0.15 }));
      // the sim picks the attack and its aim itself: up with no wait, the hero within its bite, then out of it
      transitions.eel_bite = eelT((e, h, S) => ({ cdT: S.t }));
      transitions.eel_spit = eelT((e, h, S) => ({ cdT: S.t }), [4 * TILE, -2.5 * TILE]);
      transitions.eel_dive = eelT((e, h, S) => ({ upT: S.t - E.stay + 0.1 }), [5 * TILE, -2.5 * TILE]);
      transitions.eel_death = eelT({}, [5 * TILE, -2.5 * TILE], (S, e) => { e.hp = 0; e.deadT = S.t; e.hitT = S.t; e.dieA = Math.PI; }, 75);
      transitions.hit_eel = eelT({}, [5 * TILE, -2.5 * TILE], (S, e) => { e.hitT = S.t; }, 75);
      loops.eel_idle = eelT({}, [7 * TILE, -2.5 * TILE], null, 120); }
    // the merchant: his work loop (5 of its 6 s) at 1/60 s, then a greeting and a nod on a trade (subject 'merchant')
    { const fr = []; let S = shopS((S) => { const h = S.run.hero; h.x -= 500; h.y += 200; S.run.shop.greetT = -9; S.run.shop.tradeT = -9; });
      for (let i = 0; i < 300; i++) { fr.push(S); S = structuredClone(S); for (let k = 0; k < 2; k++) SIM.step(S, { px: 960, py: 540, keys: [] }); } loops.merchant_work = fr; }
    for (const [nm, k] of [['merchant_greet', 'greetT'], ['merchant_trade', 'tradeT'], ['merchant_hit', 'hitT']]) { const fr = []; let S = shopS((S) => { S.run.shop.greetT = -9; S.run.shop.tradeT = -9; S.run.shop[k] = S.t + 0.1; S.run.shop.away = 0; });
      for (let i = 0; i < 100; i++) { fr.push(S); S = structuredClone(S); for (let k2 = 0; k2 < 2; k2++) SIM.step(S, { px: 960, py: 540, keys: [] }); } transitions[nm] = fr; }
    // the townsfolk (TASKS 1015), subject npc<i>: each one's work loop over one loop, the walkers' strides (the porter with his crate,
    // the child), the porter lifting his crate, a talk starting (as the hammer comes back up: the blow itself is faster than a pop);
    // stills of a talk's first and second line and the merchant calling
    const folkSubj = {}, folkCyc = {}, folkCycT = {}, folkSpr = {};
    const folkS = (fn) => play((S) => { S.run = SIM.newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero; R.msg = null; R.captives = null; R.folk = D.folkInit(m.town.npcs);
      h.x = m.town.svc.portal.x + 3 * TILE; h.y = m.town.svc.portal.y; SIM.step(S, { keys: [] }); S.ev = []; if (fn) fn(S, R, m, h); });
    const folkAt = (R, role) => R.folk.find((q) => q.role === role), camOn = (R, f) => { R.cam = [f.x - SCX.VW / 2, f.y - 40 - SCX.VH / 2]; };
    const atStop = (R, f, k) => { const st = R.map.town.npcs[f.i].route[k]; Object.assign(f, { x: st.x, y: st.y, way: k, go: 0, spd: 0, vx: 0, vy: 0 }); };
    for (const role of ['smith', 'keeper', 'guard', 'enchanter', 'sweeper', 'child', 'mason']) { let i = 0, per = 1;
      const base = folkS((S, R) => { const f = folkAt(R, role); i = f.i; per = D.folkClock(role, i, S.t).per; if (R.map.town.npcs[i].route) { atStop(R, f, role === 'mason' ? 1 : 0); f.t0 = S.t - (role === 'mason' ? 3 : 0); f.face = role === 'child' || role === 'mason' ? 1 : -1; if (role === 'mason') Object.assign(R.cart, { st: 'in', t: S.t + 99 }); } camOn(R, f); });
      loops['folk_' + role + '_work'] = Array.from({ length: 48 }, (_, k) => { const S = structuredClone(base); S.t += k * per / 48; return S; }); folkSubj['folk_' + role + '_work'] = 'npc' + i; }
    // every townsperson with a round has a walk (TASKS 1031): the cycles come from the town's rounds, and a rig with no gait fails here
    const walkers = Object.keys(DUNGEON.TOWN.routes);
    for (const role of walkers) { const nm = 'town_' + role, H0 = SZ(nm)[1], RG = RIGS[nm], dd = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]), v = D.FOLK[role].v, load = role === 'porter' ? 1 : 0;
      const st = RG.hipL ? 0.8 * (dd(RG.hipL, RG.kneeL) + dd(RG.kneeL, RG.ankleL)) * H0 / RG.h : MONSTERS.robeStride(nm, H0); let i = 0;
      if (!st) throw new Error('folk: the ' + role + ' walks a round but its rig has no gait');
      folkCyc['folk_' + role + '_right'] = Array.from({ length: 12 }, (_, k) => folkS((S, R) => { const f = folkAt(R, role), d = k * st / 12; i = f.i; const n = R.map.town.npcs[f.i];
        Object.assign(f, { x: n.x + d, dist: d, vx: v, vy: 0, spd: v, go: 1, way: 1, face: 1, load }); R.cam = [n.x - SCX.VW / 2, n.y - 40 - SCX.VH / 2]; follow(S, d, 0); }));
      folkCycT['folk_' + role + '_right'] = st / v; folkSubj['folk_' + role + '_right'] = 'npc' + i; folkSpr['folk_' + role + '_right'] = Object.keys(ASSETS).filter((a) => a.startsWith(nm + '__')); }
    { let i = 0; const base = folkS((S, R) => { const f = folkAt(R, 'hen'); i = f.i; camOn(R, f); }); folkSubj.folk_hen_peck = 'npc' + i; loops.folk_hen_peck = Array.from({ length: 24 }, (_, k) => { const S = structuredClone(base); S.t += k / 12; return S; }); }
    { const base = folkS((S, R) => { Object.assign(R.cart, { st: 'down', s: 120 }); const p = SCX.railPts(R.map)[4]; R.cam = [p[0] - SCX.VW / 2, p[1] - SCX.VH / 2]; }); folkSubj.folk_cart_roll = 'cart'; loops.folk_cart_roll = Array.from({ length: 24 }, (_, k) => { const S = structuredClone(base); S.run.cart.s += k * 6; return S; }); }
    { const base = folkS((S, R) => { Object.assign(R.cart, { st: 'down', s: 40 }); const p = SCX.railPts(R.map)[2]; R.cam = [p[0] - SCX.VW / 2, p[1] - SCX.VH / 2]; }); folkSubj.folk_cart_turn = 'cart'; loops.folk_cart_turn = Array.from({ length: 24 }, (_, k) => { const S = structuredClone(base); S.run.cart.s += k * 3; return S; }); }
    { let i = 0; const base = folkS((S, R) => { const f = folkAt(R, 'porter'); i = f.i; atStop(R, f, 0); f.t0 = S.t; f.load = 1; f.lift = 'take'; f.face = 1; camOn(R, f); });
      transitions.folk_porter_take = Array.from({ length: 110 }, (_, k) => { const S = structuredClone(base); S.t += k / 60; return S; }); folkSubj.folk_porter_take = 'npc' + i; }
    { let i = 0; const base = folkS((S, R, m, h) => { const f = folkAt(R, 'smith'); i = f.i; const c = D.folkClock('smith', i, S.t); S.t += ((0.72 - c.u + 1) % 1) * c.per; h.x = f.x + 46; h.y = f.y + 16; f.near = 1; f.sayT = S.t + 0.1; f.sayN = 0; f.face = 1; camOn(R, f); });
      transitions.folk_talk = Array.from({ length: 60 }, (_, k) => { const S = structuredClone(base); S.t += k / 60; return S; }); folkSubj.folk_talk = 'npc' + i; }
    // (TASKS 1032) the turns and the loops' own moments frame by frame at 1/60 s, for the trace's jump check: the smith turning to a
    // hero on the far side of the anvil and back again, the guard's look back over the yard, the smith's blows into a breather,
    // the keeper's poke at the fire, the enchanter's flask raised and lowered
    const frames = (nm, base, n, i) => { transitions[nm] = Array.from({ length: n }, (_, k) => { const S = structuredClone(base); S.t += k / 60; return S; }); folkSubj[nm] = 'npc' + i; };
    for (const [nm, out] of [['folk_talk_back', 0], ['folk_talk_back_out', 1]]) { let i = 0;
      const base = folkS((S, R, m, h) => { const f = folkAt(R, 'smith'), n = m.town.npcs[f.i], wf = TOWN_FACE(m, n) >= n.x ? 1 : -1; i = f.i;
        h.x = f.x - wf * (out ? 200 : 46); h.y = f.y + 16; f.near = out ? 0 : 1; f.sayT = S.t + 0.1 - (out ? 2 : 0); f.byeT = out ? S.t + 0.1 : -9; f.sayN = 0; f.face = -wf; camOn(R, f); });
      frames(nm, base, 80, i); }
    const atU = (role, u0) => { let i = 0; const base = folkS((S, R) => { const f = folkAt(R, role); i = f.i; const c = D.folkClock(role, i, S.t); S.t += ((u0 - c.u + 1) % 1) * c.per; camOn(R, f); }); return [base, i]; };
    { const [b, i] = atU('guard', 0.5); frames('folk_guard_look', b, 110, i); }
    { let i = 0; const base = folkS((S, R) => { const f = folkAt(R, 'smith'); i = f.i; const c = D.folkClock('smith', i, S.t), rest = D.FOLK.smith.rest;
      const d = (rest - 2 - c.n % rest + rest) % rest + 0.5 - c.u; S.t += (d < 0 ? d + rest : d) * c.per; camOn(R, f); }); frames('folk_smith_blow', base, Math.round(2 * D.FOLK.smith.per * 60), i); }
    { const [b, i] = atU('keeper', 0.08); frames('folk_keeper_poke', b, Math.round(0.38 * D.FOLK.keeper.per * 60), i); }
    { const [b, i] = atU('enchanter', 0.36); frames('folk_enchanter_flask', b, Math.round(0.52 * D.FOLK.enchanter.per * 60), i); }
    states.push(['town_talk', folkS((S, R, m, h) => { const f = folkAt(R, 'smith'); h.x = f.x - 46; h.y = f.y + 18; f.near = 1; f.sayT = S.t - 1; f.sayN = 1; f.face = -1; camOn(R, f); })]);
    states.push(['town_talk_line2', folkS((S, R, m, h) => { const f = folkAt(R, 'porter'); Object.assign(f, { x: 22 * TILE, y: 12 * TILE + 16, load: 1, go: 1, way: 2, face: -1 }); h.x = f.x - 60; h.y = f.y - 4; f.near = 1; f.sayT = S.t - 3.4; f.sayN = 2; camOn(R, f); })]);
    states.push(['town_folk_talk_longest', folkS((S, R, m, h) => { for (const f of R.folk) { const L = D.FOLK[f.role].lines; if (!L) continue; f.near = 1; f.sayT = S.t - 1; f.sayN = L.reduce((b, p, i) => (p[0].length > L[b][0].length ? i : b), 0); f.face = 1; } const r = m.rooms[0]; R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; })]);
    states.push(['town_folk_talk_all', folkS((S, R, m, h) => { for (const f of R.folk) if (D.FOLK[f.role].lines) { f.near = 1; f.sayT = S.t - 1; f.sayN = 0; f.face = 1; } const r = m.rooms[0]; R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; })]);
    states.push(['merchant_call', folkS((S, R, m, h) => { R.shop.callT = S.t - 0.7; R.shop.callN = 3; h.x = m.shop.x + 300; h.y = m.shop.y + 200; R.cam = [m.shop.x + 150 - SCX.VW / 2, m.shop.y + 100 - SCX.VH / 2]; })]);
    // a run through the town on its floors (TASKS 1007, 1027): at the stairs up on the 2nd and on the 1st (to the town), a scroll
    // two thirds read, the town with a portal open and the hero at it, the floor above reached up the stairs
    const climbS = (f, fn) => play((S) => { S.run = SIM.newRun(S, 'campaign', 77, { town: 1 }); S.screen = 'play'; for (let k = 1; k <= f; k++) SIM.enterFloor(S, S.run, k);
      const R = S.run, h = R.hero; R.msg = null; S.ev = []; for (const e of R.en) if (Math.hypot(e.x - R.map.spawn.x, e.y - R.map.spawn.y) < 400) e.x += 3000; fn(S, R, R.map, h); R.cam = R.map.town ? [-64, 52] : [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; });
    states.push(['climb_up_prompt', climbS(2, (S, R, m, h) => { h.x = m.up.x; h.y = m.up.y + 30; })]);
    states.push(['climb_up_wall', climbS(2, (S, R, m, h) => { h.x = m.up.x + 110; h.y = m.up.y + 120; })]);   // TASKS 511: the opening seen whole
    states.push(['climb_town_prompt', climbS(1, (S, R, m, h) => { h.x = m.up.x + 20; h.y = m.up.y + 34; })]);
    states.push(['scroll_read', climbS(1, (S, R, m, h) => { h.read = { t0: S.t - 1.1, i: 0 }; })]);
    states.push(['climb_arrived', climbS(2, (S, R, m, h) => { SIM.enterFloor(S, R, 1, undefined, 'up'); S.ev = []; R.msg = null; })]);
    // waystones (TASKS 1009): asleep by the start of the 4th, waking under the hero's touch, awake; the town's ring with a portal and
    // two waystones (its prompt and its window, the longest floor name in the rows)
    if (D.wayFloor(4)) states.push(['way_asleep', climbS(4, (S, R, m, h) => { h.x = m.way.x + 90; h.y = m.way.y + 50; R.cam = [m.way.x - SCX.VW / 2, m.way.y - 40 - SCX.VH / 2]; })]);
    if (D.wayFloor(4)) states.push(['way_wake', climbS(4, (S, R, m, h) => { h.x = m.way.x + 30; h.y = m.way.y + 36; R.ways = [4]; S.ev.push({ k: 'waystone', x: m.way.x, y: m.way.y, t: S.t - 0.35 }); R.cam = [m.way.x - SCX.VW / 2, m.way.y - 40 - SCX.VH / 2]; })]);
    if (D.wayFloor(4)) states.push(['way_awake', climbS(4, (S, R, m, h) => { h.x = m.way.x + 40; h.y = m.way.y + 50; R.ways = [4]; R.cam = [m.way.x - SCX.VW / 2, m.way.y - 40 - SCX.VH / 2]; })]);
    // the merchant (TASKS 1010): the town's shelf after six floors and a boss, the wandering merchant's screen on a floor
    states.push(['town_shop', climbS(0, (S, R, m, h) => { for (let f = 1; f <= 6; f++) SIM.enterFloor(S, R, f); R.bossN = 1; SIM.enterFloor(S, R, 0, undefined, 'up'); S.ev = []; R.msg = null;
      h.x = R.map.shop.front.x; h.y = R.map.shop.front.y + 10; R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; S.screen = 'shop'; S.hover = 'buy:0'; })]);
    states.push(['shop_wander', climbS(5, (S, R, m, h) => { R.shop = SIM.stockShopFor(R, 5, 'wander'); R.shop.line = 3; S.screen = 'shop'; S.hover = 'buy:0'; })]);
    // the Altar of Souls on the square (TASKS 1011): its prompt, and its screen opened there mid-run
    states.push(['town_altar_prompt', climbS(0, (S, R, m, h) => { h.x = m.town.svc.altar.x; h.y = m.town.svc.altar.y + 40; })]);
    states.push(['fork', fx((S, R, h) => { R.hero.cls = 'mage'; R.hero.ab = { fireball: 3, shield: 1, frost: 0 }; S.screen = 'fork'; S.hover = 'fork:1'; })]);
    // TASKS 1857: a card lit by the first press and sealed (the pointer gone to the other, which stays unlit); a warrior's fork whose
    // two ways carry the potion icons; on the hero's page what a point and the next rank give, and a visit's points with «Сбросить»
    states.push(['fork_sel', fx((S, R, h) => { R.hero.cls = 'mage'; R.hero.ab = { fireball: 3, shield: 1, frost: 0 }; S.screen = 'fork'; S.forkSel = 0; S.hover = 'fork:1'; })]);
    states.push(['fork_whirl', fx((S, R, h) => { R.hero.ab = { whirl: 3, charge: 3, cry: 1 }; R.hero.forks = { 'charge:3': 0 }; S.screen = 'fork'; S.forkSel = 1; S.hover = 'fork:1'; })]);
    const tipOn = (S, id) => { const h = S.run.hero, q = D.UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab).r.find((b) => b.id === id); S.hover = id; S.ptr = [q.x + q.w / 2, q.y + q.h / 2 + D.uiDy('inv', SIM.VIEW.H)]; S.uiPtr = [q.x + q.w / 2, q.y + q.h / 2]; };
    states.push(['inv_tip_stat', play((S) => { const h = S.run.hero; h.pts = 3; S.screen = 'inv'; tipOn(S, 'stat:agi'); })]);
    states.push(['inv_tip_rank', play((S) => { const h = S.run.hero; h.lvl = 6; h.sp = 2; h.ab = { whirl: 2, charge: 1 }; S.screen = 'inv'; tipOn(S, 'ab:whirl'); })]);
    states.push(['inv_tip_learn', play((S) => { const h = S.run.hero; h.lvl = 6; h.sp = 2; h.ab = { whirl: 4 }; S.screen = 'inv'; tipOn(S, 'ab:cry'); })]);
    states.push(['inv_draft', play((S) => { const h = S.run.hero; h.lvl = 6; h.pts = 4; h.sp = 1; h.ab = { whirl: 3, charge: 1 }; h.forks = { 'whirl:3': 1 }; h.base.str += 2; h.base.vit += 1;
      h.draft = { st: { str: 2, vit: 1 }, ab: { charge: 1 }, hp: 10, mp: 0, mast: 0 }; S.screen = 'inv'; tipOn(S, 'reset:st'); })]);
    states.push(['codex', mk((S) => { S.meta.codex = { m: Object.fromEntries(Object.keys(D.ENEMIES).filter((_, i) => i % 3).map((k) => [k, 1])) }; S.meta.best = 12; S.meta.bestEndless = 34; S.screen = 'codex'; S.codexTab = 'm'; S.codexPage = 0; S.hover = 'next'; })]);
    states.push(['codex_all', mk((S) => { S.meta.codex = { m: Object.fromEntries(Object.keys(D.ENEMIES).map((k) => [k, 1])) }; S.screen = 'codex'; S.codexTab = 'm'; S.codexPage = 0; S.hover = 'cx:boss_serpent'; })]);
    states.push(['codex_items', mk((S) => { S.meta.codex = { it: Object.fromEntries(Object.keys(D.BASES).map((k) => [k, 1])) }; S.screen = 'codex'; S.codexTab = 'it'; })]);
    states.push(['meta_unlocks', mk((S) => { S.meta.cls = 'warrior'; S.meta.shards = 55; S.meta.open = { g_whirl_ring: 1, k_w_axe: 1 }; S.meta.ach = { a_elites: 13 }; S.screen = 'meta'; S.metaTab = 'open'; S.hover = 'un:1'; })]);
    states.push(['meta_unlocks_poor', mk((S) => { S.meta.cls = 'warrior'; S.meta.shards = 0; S.screen = 'meta'; S.metaTab = 'open'; S.hover = 'un:2'; })]);
    states.push(['meta_tab_hover', mk((S) => { S.meta.shards = 35; S.screen = 'meta'; S.hover = 'tab:open'; })]);
    states.push(['town_meta', climbS(0, (S, R, m, h) => { h.x = m.town.svc.altar.x; h.y = m.town.svc.altar.y + 40; S.meta.shards = 99999; S.screen = 'meta'; S.metaRun = 1; S.hover = 'hp'; })]);
    // the storage chest (TASKS 1012): its prompt; its window with a piece in, a locked cell and a tip; a piece dragged over the bag
    const stashS = (fn) => climbS(0, (S, R, m, h) => { h.x = m.town.svc.stash.x; h.y = m.town.svc.stash.y + 40; const T = SIM.stashOf(S);
      T.items = [Object.assign(SIM.rollItem(R, 9, 3, 'weapon'), { id: 900 }), null]; h.bag[3] = Object.assign(SIM.rollItem(R, 6, 2, 'armor'), { id: 901 }); S.screen = 'stash'; fn(S, R, h); });
    states.push(['town_stash_prompt', climbS(0, (S, R, m, h) => { h.x = m.town.svc.stash.x + 6; h.y = m.town.svc.stash.y + 40; })]);
    states.push(['town_stash', stashS((S) => { S.hover = 'stash:0'; })]);
    // gear above the hero's level (TASKS 1028): a deep piece in the chest and in the bag, the red line in its tooltip and the bag's mark
    states.push(['town_stash_req', stashS((S, R, h) => { h.lvl = 2; S.hover = 'stash:0'; })]);
    // another class's gear (TASKS 1102, 1112): a warrior's bag with the mage's robe and wand, the robe's tooltip naming its class in red
    states.push(['inv_foreign', play((S) => { const R = S.run, h = R.hero; h.bag[4] = Object.assign(SIM.rollItem(R, 2, 1, 'armor'), { id: 1510, b: 'robe' });
      h.bag[5] = Object.assign(SIM.rollItem(R, 2, 2, 'weapon'), { id: 1511, b: 'wand' }); S.screen = 'inv'; S.hover = 'bag:4'; })]);
    states.push(['inv_req', play((S) => { const R = S.run, h = R.hero; h.lvl = 3; for (let i = 0; i < 6; i++) h.bag[4 + i] = Object.assign(SIM.rollItem(R, 4 + 2 * i, 2), { id: 1500 + i }); S.screen = 'inv'; S.hover = 'bag:9'; })]);
    // TASKS 1331: a piece lifted from the hero screen's bag over another cell, and a sort button under the pointer
    // TASKS 1684: the bag scattered over its cells, so a sort has something to show; the held piece over a cell it would swap into, over
    // a slot it would be worn in, over a slot that refuses it; the refusals after the drop
    const scatter = (S) => { worst(S); const R = S.run, h = R.hero; S.screen = 'inv';
      [[2, 3, 1, 'armor'], [5, 9, 3, 'weapon'], [8, 6, 2, 'ring'], [11, 12, 4, 'boots'], [14, 2, 0, 'helm'], [17, 7, 3, 'amulet'], [20, 5, 2, 'weapon']].forEach(([i, lv, rar, sl]) => { h.bag[i] = Object.assign(SIM.rollItem(R, lv, rar, sl, { own: 1 }), { id: 1600 + i }); }); };
    const invAt = (S, id, o = {}) => { const b = DATA.UI.inv(DATA.clsOf(S.run.hero).abs, S.run.hero.bag.length, S.bagTab).r.find((q) => q.id === id); return Object.assign({ keys: [], px: b.x + b.w / 2, py: b.y + b.h / 2 + D.uiDy('inv', SIM.VIEW.H) }, o); };
    const hold = (S, from, over) => { const a = invAt(S, over); S.hover = over; S.drag = { from, x: a.px, y: a.py }; };
    const drop = (S, from, over) => { S.drag = { from, x: 0, y: 0 }; SIM.step(S, invAt(S, over)); };
    states.push(['inv_drag', play((S) => { scatter(S); hold(S, 'bag:5', 'bag:8'); })]);
    states.push(['inv_drag_wear', play((S) => { scatter(S); hold(S, 'bag:5', 'eq:weapon'); })]);
    states.push(['inv_drag_worn_swap', play((S) => { scatter(S); hold(S, 'eq:armor', 'bag:2'); })]);
    states.push(['inv_drag_refused', play((S) => { scatter(S); hold(S, 'bag:0', 'eq:ring'); })]);
    states.push(['inv_drop_potion', play((S) => { scatter(S); drop(S, 'bag:0', 'eq:ring'); })]);
    states.push(['inv_drop_worn_refused', play((S) => { scatter(S); drop(S, 'eq:armor', 'bag:0'); })]);
    // TASKS 1349: every rank full at 15, the points past them shown as mastery
    states.push(['inv_mastery', play((S) => { const h = S.run.hero; h.lvl = 60; for (const a of DATA.clsOf(h).abs) h.ab[a.id] = DATA.AB_MAX; h.mast = 17; h.sp = 0; S.screen = 'inv'; })]);
    states.push(['inv_sort', play((S) => { scatter(S); S.hover = 'sort:rar'; })]);
    states.push(['inv_sort_after', play((S) => { scatter(S); const a = invAt(S, 'sort:rar'); SIM.step(S, Object.assign({ click: 1 }, a)); SIM.step(S, a); S.hover = 'sort:rar'; })]);
    const stashMix = (S, R, h) => { const T = SIM.stashOf(S); T.items = [[3, 1, 'armor'], [9, 3, 'weapon'], null, [5, 2, 'ring'], [12, 4, 'boots'], null, [7, 3, 'amulet']].map((q, i) => q && Object.assign(SIM.rollItem(R, q[0], q[1], q[2], { own: 1 }), { id: 910 + i })); };
    states.push(['town_stash_sort', stashS((S, R, h) => { stashMix(S, R, h); S.hover = 'sortS:rar'; })]);
    states.push(['town_stash_sort_after', stashS((S, R, h) => { stashMix(S, R, h); const b = DATA.UI.stash().r.find((q) => q.id === 'sortS:rar'), a = { keys: [], px: b.x + b.w / 2, py: b.y + b.h / 2 + D.uiDy('stash', SIM.VIEW.H) }; SIM.step(S, Object.assign({ click: 1 }, a)); SIM.step(S, a); S.hover = 'sortS:rar'; })]);
    // TASKS 1348: a find well above the hero: the card names the level it waits for
    states.push(['inv_over_lvl', play((S) => { const R = S.run, h = R.hero; h.lvl = 5; h.bag[4] = Object.assign(SIM.rollItem(R, 18, 2, 'weapon', { own: 1 }), { id: 1520 }); S.screen = 'inv'; S.hover = 'bag:4'; })]);
    states.push(['town_stash_drag', stashS((S) => { S.hover = 'bag:12'; S.drag = { from: 'bag:3', x: 760, y: 640 }; })]);
    // TASKS 1687: the bag and its three pouches full, each tab open in turn; a piece held over a pouch's tab; a drop on a full one
    // refused; the chest with a pouch open; the Altar's row that sells them
    for (let k = 0; k < 4; k++) states.push(['inv_pouch_' + k, play((S) => { worst(S); pouches(S); S.screen = 'inv'; S.bagTab = k; S.hover = 'btab:' + k; })]);
    states.push(['inv_pouch_card', play((S) => { worst(S); pouches(S); S.screen = 'inv'; S.bagTab = 2; S.hover = 'bag:47'; })]);
    states.push(['inv_pouch_drag', play((S) => { scatter(S); S.meta.up.pouch = 3; SIM.step(S, { keys: [], px: 960, py: 540 }); S.screen = 'inv'; hold(S, 'bag:5', 'btab:2'); })]);
    states.push(['inv_pouch_full', play((S) => { worst(S); pouches(S); S.screen = 'inv'; h0(S).bag[3] = null; drop(S, 'bag:5', 'btab:3'); })]);
    states.push(['town_stash_pouch', stashS((S) => { pouches(S); S.screen = 'stash'; S.bagTab = 2; S.hover = 'btab:2'; })]);
    states.push(['town_stash_card_low', stashS((S, R, h) => { pouches(S); S.screen = 'stash'; S.bagTab = 2; const T = D.bagTabs(h.bag.length)[2]; S.hover = 'bag:' + (T.a + T.n - 1); })]);
    states.push(['town_meta_pouch', climbS(0, (S, R, m, h) => { h.x = m.town.svc.altar.x; h.y = m.town.svc.altar.y + 40; S.meta.shards = 120; S.meta.up.pouch = 1; S.screen = 'meta'; S.metaRun = 1; S.hover = 'pouch'; })]);
    // the workshops (TASKS 1013): the prompts at the anvil and the lectern; the smith with a rare ring chosen; the enchanter after a
    // failed enchantment; a piece with all five enchantments (the button's refusal, the longest)
    const craftS = (kind, fn) => climbS(0, (S, R, m, h) => { const P = m.town.svc[kind === 'forge' ? 'anvil' : 'lectern']; h.x = P.x; h.y = P.y + 30; h.gold = 23456; S.meta.shards = 77;
      const it = Object.assign(SIM.rollItem(R, 7, 3, 'ring'), { id: 950, rar: 3 }); h.bag[4] = it; S.screen = 'craft'; S.craft = { kind, sel: 'bag:4' }; fn(S, R, h, it); });
    states.push(['town_forge_prompt', climbS(0, (S, R, m, h) => { h.x = m.town.svc.anvil.x; h.y = m.town.svc.anvil.y + 30; })]);
    // the mage's look (TASKS 1114): in a crypt room facing the camera and turned away, in each of his armours and his circlet, and
    // in the town beside the enchanter he must not be mistaken for
    const mageS = (fn) => play((S) => { const R = S.run, h = R.hero, gear = (b, slot) => Object.assign(SIM.rollItem(R, 1, 0, slot), { b, id: R.nextId++ });
      h.cls = 'mage'; h.eq.weapon = gear('staff', 'weapon'); h.eq.armor = gear('robe', 'armor'); R.msg = null; fn(S, R, h, gear); });
    states.push(['mage_front', mageS(() => {})], ['mage_back', mageS((S, R, h) => { h.back = 1; })],
      ['mage_leather', mageS((S, R, h, gear) => { h.eq.armor = gear('leather_armor', 'armor'); h.eq.offhand = gear('orb', 'offhand'); })],
      ['mage_cloak', mageS((S, R, h, gear) => { h.eq.armor = gear('cloak', 'armor'); h.eq.weapon = gear('wand', 'weapon'); })],
      ['mage_circlet', mageS((S, R, h, gear) => { h.eq.helm = gear('circlet', 'helm'); })], ['mage_warrior', play((S) => { S.run.msg = null; })]);
    // the class screen (TASKS 1103): the mage picked, the pointer on the warrior's card
    states.push(['classes_kit', mk((S) => { S.meta.cls = 'archer'; S.meta.kit = { warrior: 'w_hammer', mage: 'm_ash', archer: 'a_cross' }; S.screen = 'classes'; S.pendingMode = 'campaign'; S.hover = 'kit:archer'; })]);
    states.push(['classes', mk((S) => { S.meta.cls = 'mage'; S.screen = 'classes'; S.pendingMode = 'campaign'; S.hover = 'cls:warrior'; })]);
    // the start screen (TASKS 1304): every difficulty and class chosen, the keyboard's focus on each row, the first-timer's tip and
    // the lore line in its place once he has won or picked the easy one
    states.push(['classes_dif_easy', mk((S) => { S.meta.cls = 'warrior'; S.meta.diff = 'easy'; S.screen = 'classes'; S.pendingMode = 'campaign'; S.focus = 'dif:easy'; })]);
    states.push(['classes_focus_tab', mk((S) => { S.meta.cls = 'warrior'; S.meta.diff = 'easy'; S.screen = 'classes'; S.pendingMode = 'campaign'; S.focus = 'dif:hard'; })]);
    states.push(['classes_dif_hard', mk((S) => { S.meta.cls = 'archer'; S.meta.diff = 'hard'; S.screen = 'classes'; S.pendingMode = 'campaign'; S.focus = 'cls:archer'; S.hover = 'dif:normal'; })]);
    states.push(['classes_won', mk((S) => { S.meta.cls = 'mage'; S.meta.diff = 'normal'; S.meta.wins = 1; S.meta.open = Object.fromEntries(DATA.UNLOCKS.filter((u) => u.kind === 'kit').map((u) => [u.id, 1])); S.meta.kit = { warrior: 'w_hammer', mage: 'm_ash', archer: 'a_cross' }; S.screen = 'classes'; S.pendingMode = 'cave'; S.focus = 'kit:mage'; })]);
    states.push(['classes_go', mk((S) => { S.meta.cls = 'warrior'; S.screen = 'classes'; S.pendingMode = 'campaign'; S.focus = 'go'; S.hover = 'go'; S.pressWas = true; })]);
    // the keyboard's focus on each row of the start screen (TASKS 1856): the chosen tab, the chosen card, «В путь», each told apart
    // from the plain choice
    states.push(['classes_focus_cls', mk((S) => { S.meta.cls = 'warrior'; S.meta.diff = 'normal'; S.screen = 'classes'; S.pendingMode = 'campaign'; S.focus = 'cls:warrior'; })]);
    states.push(['classes_focus_dif', mk((S) => { S.meta.cls = 'warrior'; S.meta.diff = 'normal'; S.screen = 'classes'; S.pendingMode = 'campaign'; S.focus = 'dif:normal'; })]);
    states.push(['classes_focus_go', mk((S) => { S.meta.cls = 'warrior'; S.meta.diff = 'normal'; S.screen = 'classes'; S.pendingMode = 'campaign'; S.focus = 'go'; })]);
    // the archer's look (TASKS 1124): as the mage's, and on the green crypt floor beside the skeleton archer he must not be taken for
    const archerS = (fn) => play((S) => { const R = S.run, h = R.hero, gear = (b, slot) => Object.assign(SIM.rollItem(R, 1, 0, slot), { b, id: R.nextId++ });
      h.cls = 'archer'; h.eq.armor = null; h.eq.weapon = gear('shortbow', 'weapon'); R.msg = null; fn(S, R, h, gear); });
    states.push(['archer_front', archerS(() => {})], ['archer_back', archerS((S, R, h) => { h.back = 1; })],
      ['archer_leather', archerS((S, R, h, gear) => { h.eq.armor = gear('leather_armor', 'armor'); })],
      ['archer_cloak', archerS((S, R, h, gear) => { h.eq.armor = gear('cloak', 'armor'); })],
      ['archer_helm', archerS((S, R, h, gear) => { h.eq.helm = gear('leather_helm', 'helm'); })],
      ['archer_bows_inv', archerS((S, R, h, gear) => { h.eq.weapon = gear('longbow', 'weapon'); h.bag[0] = gear('shortbow', 'weapon'); h.bag[1] = gear('crossbow', 'weapon'); h.bag[2] = gear('longbow', 'weapon'); S.screen = 'inv'; S.hover = 'eq:weapon'; })],
      ['archer_bows_floor', archerS((S, R, h, gear) => { ['shortbow', 'longbow', 'crossbow'].forEach((b, i) => R.drops.push({ id: R.nextId++, kind: 'item', loot: 1, item: Object.assign(gear(b, 'weapon'), { rar: 0 }), x: h.x - 50 + 50 * i, y: h.y + 50, vx: 0, vy: 0, z: 0, vz: 0, t0: S.t - 5 })); })],
      ...['longbow', 'crossbow'].flatMap((b) => [['archer_' + b, archerS((S, R, h, gear) => { h.eq.weapon = gear(b, 'weapon'); })], ['archer_' + b + '_back', archerS((S, R, h, gear) => { h.eq.weapon = gear(b, 'weapon'); h.back = 1; })]]));
    states.push(['town_archer', climbS(0, (S, R, m, h) => { h.cls = 'archer'; h.eq.weapon = Object.assign({}, h.eq.weapon, { b: 'shortbow' }); h.x = m.town.svc.lectern.x - 70; h.y = m.town.svc.lectern.y + 60; })]);
    states.push(['town_mage', climbS(0, (S, R, m, h) => { h.cls = 'mage'; h.eq.weapon = Object.assign({}, h.eq.weapon, { b: 'staff' }); h.eq.armor = Object.assign({}, h.eq.armor, { b: 'robe' });
      h.x = m.town.svc.lectern.x - 70; h.y = m.town.svc.lectern.y + 60; })]);
    states.push(['town_enchant_prompt', climbS(0, (S, R, m, h) => { h.x = m.town.svc.lectern.x; h.y = m.town.svc.lectern.y + 30; })]);
    states.push(['town_forge', craftS('forge', (S, R, h, it) => { it.ench = [{ k: 'crit', v: 4 }]; S.hover = 'do'; })]);
    states.push(['town_enchant', craftS('enchant', (S, R, h, it) => { it.ench = [{ k: 'hp', v: 40 }]; S.craft.res = { s: TXT('QA.res.s'), ok: 0, t: S.t - 0.5 }; S.hover = 'eq:weapon'; })]);
    states.push(['town_enchant_full', craftS('enchant', (S, R, h, it) => { it.ench = [{ k: 'hp', v: 40 }, { k: 'leech', v: 3 }, { k: 'mspd', v: 6 }, { k: 'crit', v: 4 }, { k: 'atk', v: 5 }]; })]);
    // a word with the townsfolk (TASKS 1016, 1023): the prompt by the Keeper; his dialogue on its longest page; the guard's line
    states.push(['captive_cage', climbS(1, (S, R, m, h) => { h.x = R.captives.merchant.x + 50; h.y = R.captives.merchant.y + 30; R.en = []; R.seen.fill(1); R.rseen.fill(1); })]);
    states.push(['captive_freed', climbS(1, (S, R, m, h) => { h.x = R.captives.merchant.x + 50; h.y = R.captives.merchant.y + 30; R.en = []; R.seen.fill(1); R.rseen.fill(1); R.freed = { merchant: 1 }; R.msg = { s: TXT('sim_town.captive.free'), t: S.t - 1, d: 5 }; })]);
    const noteWorst = () => D.NOTES.list.reduce((a, n) => (n.text.length > a.text.length ? n : a));
    states.push(['captive_smith', climbS(3, (S, R, m, h) => { const C = R.captives.smith; h.x = C.x + 50; h.y = C.y + 30; R.en = []; R.seen.fill(1); R.rseen.fill(1); })]);
    states.push(['captive_enchanter', climbS(4, (S, R, m, h) => { const b = R.en.find((e) => D.BOSSES[e.type]); SIMX.captiveBoss(S, R, b); const C = R.captives.enchanter; h.x = C.x + 50; h.y = C.y + 30; R.en = []; R.seen.fill(1); R.rseen.fill(1); })]);
    states.push(['note_floor', climbS(1, (S, R, m, h) => { const p = R.drops.find((d) => d.kind === 'note' && d.sec === undefined); h.x = p.x + 30; h.y = p.y + 24; R.en = []; R.seen.fill(1); R.rseen.fill(1); })]);
    states.push(['note_read', climbS(1, (S, R) => { S.note = { id: noteWorst().id }; S.screen = 'note'; })]);
    states.push(['notes_list', climbS(1, (S, R) => { S.meta.notes = D.NOTES.list.slice(0, 30).map((n) => n.id); S.noteSel = noteWorst().id; S.meta.notes.push(S.noteSel); S.screen = 'notes'; })]);
    states.push(['notes_empty', climbS(1, (S, R) => { S.meta.notes = []; S.screen = 'notes'; })]);
    states.push(['town_shop_shut', climbS(0, (S, R, m, h) => { h.x = m.shop.front.x; h.y = m.shop.front.y + 20; })]);
    const keeperS = (fn) => climbS(0, (S, R, m, h) => { R.captives = null; R.folk = D.folkInit(m.town.npcs); SIM.step(S, { keys: [] });
      const k = S.run.folk.find((q) => q.role === 'keeper'); h.x = k.x + 44; h.y = k.y + 12; R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; fn(S, R, h, k); });
    states.push(['town_keeper_prompt', keeperS(() => {})]);
    // a giver's prompt with his own mark and the Keeper's near: the prompt stands in place of his own mark (TASKS 1026)
    states.push(['town_porter_prompt', keeperS((S, R, h, k) => { R.offers = [{ key: 'fetch', from: 'porter', q: 0 }]; const p = R.folk.find((q) => q.role === 'porter');
      Object.assign(p, { x: k.x + 110, y: k.y + 40, go: 0, spd: 0 }); h.x = p.x + 40; h.y = p.y + 10; R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; })]);
    states.push(['town_keeper_talk', keeperS((S, R) => { const P = D.KEEPER.rare(TXT('QA.P')); S.talk = { role: 'keeper', i: 0, pages: [P[0], D.KEEPER.win[0], D.KEEPER.away[0]], p: 2 }; S.screen = 'talk'; S.hover = 'next'; })]);
    states.push(['town_talk_menu', keeperS((S) => { S.talk = { role: 'keeper', i: 0, pages: [''], p: 0, act: null, topics: D.FOLK.keeper.topics, menu: 1 }; S.screen = 'talk'; S.hover = 'topic:1'; })]);
    states.push(['town_talk_topic', keeperS((S) => { S.talk = { role: 'keeper', i: 0, pages: D.FOLK.keeper.topics[0].a, p: 0, act: null, topics: D.FOLK.keeper.topics, inTopic: 1 }; S.screen = 'talk'; })]);
    states.push(['town_guard_talk', keeperS((S) => { S.talk = { role: 'guard', i: 0, pages: D.FOLK.guard.lines[2].slice(), p: 0 }; S.screen = 'talk'; })]);
    // PR 49 review: E at the anvil and at the lectern opens the master's talk with «Поговорить» and the workshop's button (the smith's
    // with a quest on its last page: the full row of four); the Keeper's end of the campaign, its longest page and its last with the
    // choice; Kip's words for it
    const noQ = (R) => { R.offers = []; R.quests = [{ id: -1, key: 'chapter', f: 99, need: 1, n: 0, st: 'taken', from: 'keeper', rw: {} }]; };
    const eNear = (S, R, h, x, y) => { h.x = x; h.y = y; R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; SIM.step(S, { keys: [] }); SIM.step(S, { keys: ['KeyE'] }); };
    const masterS = (role, quest) => keeperS((S, R, h) => { const at = R.map.town.svc[role === 'smith' ? 'anvil' : 'lectern']; noQ(R); if (quest) R.offers = [{ key: 'cull', from: role, q: 0 }];
      eNear(S, R, h, at.x, at.y + 30); if (S.talk) S.talk.p = S.talk.pages.length - 1; S.hover = 'talk'; });
    // TASKS 1847, 1848: a new game's first word with the Keeper by the fire, his quest about Horatio on its first page
    states.push(['town_first_talk', climbS(0, (S, R, m, h) => { SIM.step(S, { keys: [] }); const k = R.folk.find((q) => q.role === 'keeper'); eNear(S, R, h, k.x + 44, k.y + 12); S.hover = ''; })]);
    // TASKS 1849: a new game's welcome from the real sim: the hero held by the spawn, the Keeper still at the fire, on his way with his
    // word, the talk he opens by the hero; frame by frame his walk over (the set-off, the stride, the stop and the turn to the hero) and,
    // the talk left with Esc, his walk back to the fire and his turn to it
    { const key = (S) => S.run.folk.find((q) => q.role === 'keeper'), go = (S, n, keys) => { for (let q = 0; q < n; q++) SIM.step(S, { px: 960, py: 540, keys: keys && !q ? keys : [] }); };
      const base = play((S) => { S.run = SIM.newRun(S, 'campaign', 77, { town: 1 }); S.run.greet = 1; S.screen = 'play'; S.run.msg = null; go(S, 1); });
      const at = (fn) => { const S = structuredClone(base); fn(S); return S; }, until = (S, ok, n = 120 * 15) => { while (!ok(S) && n-- > 0) go(S, 1); return S; };
      states.push(['town_greet_before', at((S) => go(S, 60))], ['town_greet_mid', at((S) => { until(S, (Q) => Q.run.greet.st === 'walk'); go(S, 300); })], ['town_greet_talk', at((S) => until(S, (Q) => Q.screen === 'talk'))], ['town_greet_offer', at((S) => { until(S, (Q) => Q.screen === 'talk'); S.talk.p = S.talk.pages.length - 1; })]);
      let S = at((Q) => go(Q, 60)), fr = []; for (let k = 0; k < 360 && S.screen === 'play'; k++) { fr.push(S); S = structuredClone(S); go(S, 2); }
      const i = key(S).i; transitions.folk_keeper_greet = fr; folkSubj.folk_keeper_greet = 'npc' + i;
      S = structuredClone(S); go(S, 1, ['Escape']); fr = []; for (let k = 0; k < 420 && !(S.run.greet === 'done' && S.t > key(S).walkB + 0.6); k++) { fr.push(S); S = structuredClone(S); go(S, 2); }
      transitions.folk_keeper_greet_back = fr; folkSubj.folk_keeper_greet_back = 'npc' + i; }
    states.push(['town_smith_talk', masterS('smith', 0)], ['town_smith_talk_quest', masterS('smith', 1)], ['town_enchanter_talk', masterS('enchanter', 0)]);
    const endS = (pick) => keeperS((S, R, h, k) => { const F = D.RUNS.campaign.floors; noQ(R); R.slain = [F]; R.deepest = F; R.goldTot = 1000; S.meta.keeperMet = 1; S.meta.endTold = 1;
      eNear(S, R, h, k.x + 44, k.y + 12); if (S.talk) { S.talk.p = pick(S.talk.pages); S.hover = 'act'; } });
    states.push(['town_keeper_end', endS((P) => P.length - 1)], ['town_keeper_end_long', endS((P) => P.indexOf(P.reduce((a, q) => (q.length > a.length ? q : a))))]);
    states.push(['town_kip_won', keeperS((S, R, h) => { const F = D.RUNS.campaign.floors; noQ(R); R.slain = [F]; R.deepest = F; const c = R.folk.find((q) => q.role === 'child');
      for (const f of R.folk) if (f !== c) f.x += 2000; eNear(S, R, h, c.x + 44, c.y + 12); for (const f of R.folk) if (f !== c) f.x -= 2000; if (S.talk) S.talk.p = 0; })]);
    // quests (TASKS 1018–1022): the marks over the givers (! and ?), the offer on its page (the longest text: a keepsake), the smith's
    // offer with his workshop's button, the turn-in and its thanks with the longest reward; on the floor the named foe, the keepsake
    // in the open, the marked room; the tracker full (four quests, the longest lines)
    const qFull = (R) => { const mk = (key, f, o) => Object.assign({ id: 900 + R.quests.length, key, f, need: D.QUESTS[key].need(f), n: 0, st: 'taken', from: 'porter', rw: D.questReward(D.QUESTS[key].rw, f) }, o);
      R.quests.push(mk('cull', 12, { n: 30 }), mk('fetch', 11, { thing: TXT('QA.qFull.thing'), ic: 'qi_horse' }), mk('chapter', 12, { st: 'done', from: 'keeper' })); };
    const questS = (key, fn) => play((S) => { S.run = SIM.newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run; R.offers = [{ key, from: 'guard', q: 0 }]; R.quests = [];
      SIM.giveQuest(S, R, 'guard'); const q = R.quests[0], h = R.hero; for (let f = 1; f <= q.f; f++) SIM.enterFloor(S, R, f); R.msg = null; R.seen = R.seen.map(() => 1); fn(S, R, q, h); R.cam = [h.x - SCX.VW / 2, h.y - 30 - SCX.VH / 2]; S.ev = []; });
    states.push(['town_quest_marks', climbS(0, (S, R, m) => { SIM.step(S, { keys: [] }); R.offers = [{ key: 'named', from: 'guard', q: 0 }, { key: 'fetch', from: 'child', q: 0 }];
      R.quests = [{ id: 900, key: 'cull', f: 2, need: 14, n: 14, st: 'done', from: 'porter', rw: D.questReward(['scroll', 'xp'], 2) }]; const r = m.rooms[0]; R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; })]);
    const talkQ = (role, key, p) => keeperS((S, R) => { R.offers = [{ key, from: role, q: 0 }]; R.quests = [{ id: -1, key: 'chapter', f: 99, need: 1, n: 0, st: 'taken', from: 'keeper', rw: {} }];
      const qt = SIM.questTalk(R, role), f = R.folk.find((q) => q.role === role); S.talk = Object.assign({ role, i: f.i, pages: qt.pages, p, act: qt.act }, role === 'smith' ? { craft: 'forge' } : {}); S.screen = 'talk'; S.hover = 'act'; });
    states.push(['town_quest_offer', talkQ('sweeper', 'fetch', 1)]);
    states.push(['town_quest_smith', talkQ('smith', 'named', 1)]);
    states.push(['town_quest_turn', keeperS((S, R) => { R.offers = []; R.quests = [{ id: 900, key: 'elites', f: 12, need: 5, n: 5, st: 'done', from: 'guard', rw: Object.assign(D.questReward(['scroll', 'item', 'shards', 'xp'], 12)) }];
      const qt = SIM.questTalk(R, 'guard'); S.talk = { role: 'guard', i: 0, pages: qt.pages, p: qt.pages.length - 1, act: qt.act }; S.screen = 'talk'; })]);
    // TASKS 1850: the same turn-in once «Сдать задание» is pressed: its words first, then the thanks and the reward
    states.push(['town_quest_turned', keeperS((S, R) => { R.offers = []; R.quests = [{ id: 900, key: 'elites', f: 12, need: 5, n: 5, st: 'done', from: 'guard', rw: Object.assign(D.questReward(['scroll', 'item', 'shards', 'xp'], 12)) }];
      const qt = SIM.questTalk(R, 'guard'); S.talk = { role: 'guard', i: 0, pages: qt.pages, p: 0, act: qt.act }; S.screen = 'talk'; SIMX.talkAct(S, R, S.talk); })]);
    states.push(['town_quest_thanks', keeperS((S, R) => { const rw = Object.assign(D.questReward(['scroll', 'item', 'shards', 'xp'], 12), { got: TXT('QA.rw.got') });
      S.talk = { role: 'keeper', i: 0, pages: [TXT('QA.talk.pages', { thanks: D.QUEST_SAY.keeper.thanks[0], p2: SIM.rwLine(rw) })], p: 0, act: null }; S.screen = 'talk'; })]);
    // the quest journal (TASKS 1023): every quest a run can hold (three side, the Keeper's six steps) with the longest words, a turned-in
    // one chosen with its longest reward; empty in the town
    states.push(['journal', keeperS((S, R) => { R.offers = []; const mk = (key, f, from, o) => Object.assign({ id: 900 + R.quests.length, key, f, need: D.QUESTS[key].need(f), n: 0, st: 'taken', from, rw: D.questReward(D.QUESTS[key].rw, f) }, o);
      R.quests = []; for (const [key, f, from, o] of [['fetch', 11, 'sweeper', { thing: TXT('QA.thing'), ic: 'qi_horse', st: 'turned' }], ['named', 11, 'child', { title: TXT('QA.title') }], ['elites', 12, 'guard', { st: 'done', n: 5 }],
        ...D.storyChain('campaign').map((c, i) => [c.key, c.f, 'keeper', { st: i < 5 ? 'turned' : 'taken' }])]) R.quests.push(mk(key, f, from, o));
      R.quests[0].rw = Object.assign({}, D.questReward(['scroll', 'item', 'shards', 'xp'], 12), { got: TXT('QA.rw.got.2'), rar: 4 }); S.jsel = R.quests[0].id; S.screen = 'journal'; S.hover = 'q:3'; })]);
    states.push(['journal_alike', keeperS((S, R) => { R.offers = []; R.quests = []; const sd = ['keeper', 'guard', 'child', 'sweeper', 'smith'];
      const ch = D.storyChain('campaign').filter((c) => c.key === 'chapter').map((c) => c.f);
      for (let i = 0; i < 10; i++) { const key = i < 5 ? 'chapter' : 'named', f = i < 5 ? ch[i % ch.length] : 2 + i; R.quests.push({ id: 950 + i, key, f, need: D.QUESTS[key].need(f), n: 0, st: i === 0 ? 'done' : 'taken', from: sd[i % 5], rw: D.questReward(D.QUESTS[key].rw, f), title: TXT('QA.title') }); }
      S.jsel = 951; S.screen = 'journal'; })]);
    states.push(['journal_empty', keeperS((S, R) => { R.quests = []; S.screen = 'journal'; })]);
    // the longest real names where a label once shrank to fit (review of PR 57): no font step is under 20 px now, so a name longer than
    // its box loses its tail to «…» instead of running out of the panel
    const longest = (o) => Object.keys(o).sort((a, b) => o[b].length - o[a].length || (a < b ? -1 : 1));
    const legendB = longest(Object.fromEntries(Object.keys(D.BASES).filter((b) => D.LEGEND_NAMES[b]).map((b) => [b, D.LEGEND_NAMES[b]])))[0];
    const legend = (R, id, slot) => Object.assign(SIM.rollItem(R, 12, 4, slot || D.BASES[legendB].slot), { id, b: legendB, rar: 4 });
    states.push(['long_names_journal', keeperS((S, R) => { R.offers = []; R.quests = []; const keys = longest(Object.fromEntries(Object.entries(D.QUESTS).map(([k, q]) => [k, q.name]))).slice(0, 4);
      keys.forEach((key, i) => R.quests.push({ id: 960 + i, key, f: 12, need: D.QUESTS[key].need(12), n: 0, st: i ? 'taken' : 'done', from: 'keeper', rw: D.questReward(D.QUESTS[key].rw, 12) })); S.jsel = 960; S.screen = 'journal'; S.hover = 'q:1'; })]);
    states.push(['long_names_tracker', keeperS((S, R) => { R.offers = []; R.quests = []; longest(Object.fromEntries(Object.entries(D.QUESTS).map(([k, q]) => [k, q.name]))).slice(0, 4)
      .forEach((key, i) => R.quests.push({ id: 970 + i, key, f: 12, need: D.QUESTS[key].need(12), n: 0, st: 'taken', from: 'keeper', rw: D.questReward(D.QUESTS[key].rw, 12) })); S.screen = 'play'; })]);
    states.push(['long_names_craft', craftS('forge', (S, R, h, it) => { Object.assign(it, legend(R, 950)); h.bag[4] = it; S.hover = 'do'; })]);
    states.push(['long_names_card', play((S) => { worst(S); const h = S.run.hero; h.bag[23] = legend(S.run, 3101); h.eq[D.BASES[legendB].slot] = legend(S.run, 3102); S.screen = 'inv'; S.hover = 'bag:23'; })]);
    // the town's loop for the player (TASKS 1033): the notice board full (every giver with an offer, the longest names) and empty;
    // a townsman answering a blow; the minimap's ! and ?; the scroll slot and its hint at low health on a floor
    states.push(['town_board', keeperS((S, R) => { R.offers = D.QUEST_GIVE.from.map((from, i) => ({ key: D.QUEST_GIVE.pool[i % D.QUEST_GIVE.pool.length], from, q: 0 })); S.screen = 'board'; S.hover = 'take:1'; })]);
    states.push(['town_board_empty', keeperS((S, R) => { R.offers = []; R.offerB = 99; R.quests = [{ id: -1, key: 'chapter', f: 99, need: 1, n: 0, st: 'taken', from: 'keeper', rw: {} }]; S.screen = 'board'; })]);
    states.push(['town_ouch', keeperS((S, R, h) => { const g = R.folk.find((q) => q.role === 'guard'); g.hitT = S.t - 0.25; g.ouch = 2; h.x = g.x - 40; h.y = g.y + 8; R.cam = [g.x - SCX.VW / 2, g.y - 40 - SCX.VH / 2]; })]);
    states.push(['scroll_tip', climbS(2, (S, R, m, h) => { h.bag[5] = { b: 'scroll', n: 3, id: R.nextId++ }; h.hp = 6; R.msg = { s: TXT('QA.msg.s.2'), t: S.t - 0.5, d: 4.5, tip: 'scroll' }; })]);
    states.push(['quest_named', questS('named', (S, R, q, h) => { const e = R.en.find((o) => o.quest === q.id); h.x = e.x - 120; h.y = e.y + 30; e.st = 'idle'; qFull(R); })]);
    states.push(['quest_keepsake', questS('fetch', (S, R, q, h) => { for (const c of R.chests) if (c.quest) delete c.quest; R.drops = R.drops.filter((d) => d.kind !== 'qitem');
      const r = R.map.rooms.find((o) => o.type === 'start'); h.x = r.cx * TILE; h.y = r.cy * TILE; R.drops.push({ id: 9999, kind: 'qitem', quest: q.id, ic: q.ic, x: h.x + 90, y: h.y + 10, vx: 0, vy: 0, z: 0, vz: 0, t0: -9, rest: 4 }); R.en = R.en.filter((e) => Math.hypot(e.x - h.x, e.y - h.y) > 500); })]);
    states.push(['quest_room', questS('room', (S, R, q, h) => { const r = R.map.rooms[q.room]; h.x = r.cx * TILE - 200; h.y = r.cy * TILE; qFull(R); })]);
    // the town's gate out (TASKS 1149): its prompt in view of the square's bottom, its window to give up, and past the colossus to end the run won
    states.push(['town_stoneyard', folkS((S, R) => { const f = folkAt(R, 'mason'); atStop(R, f, 0); f.t0 = S.t; f.face = -1; R.offers = []; R.cam = [41 * TILE - SCX.VW / 2, 27 * TILE - SCX.VH / 2]; })]);
    { let i = 0; const base = folkS((S, R) => { const f = folkAt(R, 'mason'); i = f.i; atStop(R, f, 0); f.t0 = S.t; f.load = 1; f.lift = 'take'; f.face = -1; camOn(R, f); });
      transitions.folk_mason_take = Array.from({ length: 110 }, (_, k) => { const S = structuredClone(base); S.t += k / 60; return S; }); folkSubj.folk_mason_take = 'npc' + i; }
    // the mason's round from the real sim, not a staged pose: the turn with the stone, the walk, the drop (TASKS 1616)
    { let i = 0, S = folkS((S, R) => { const f = folkAt(R, 'mason'); i = f.i; atStop(R, f, 1); f.t0 = S.t - 3; f.face = 1; camOn(R, f); R.cam = [43 * TILE - SCX.VW / 2, 29 * TILE - SCX.VH / 2]; }); const fr = [];
      for (let k = 0; k < 360; k++) { fr.push(S); S = structuredClone(S); for (let q = 0; q < 2; q++) SIM.step(S, { px: 960, py: 540, keys: [] }); } transitions.folk_mason_round = fr; folkSubj.folk_mason_round = 'npc' + i; }
    // what clampCam gives the town at the 1920×1080 these frames render at: SCX.VH here is still the smaller loading view
    states.push(['town_cart_rolling', folkS((S, R) => { Object.assign(R.cart, { s: 200, st: 'down' }); R.offers = []; R.cam = [-64, 52]; })]);
    states.push(['town_exit_gate', climbS(0, (S, R, m, h) => { const g = m.town.svc.exitGate; h.x = g.x; h.y = g.y; R.cam = [-64, 52]; })]);
    states.push(['town_leave', climbS(0, (S, R, m, h) => { const g = m.town.svc.exitGate; h.x = g.x; h.y = g.y; S.screen = 'leave'; S.focus = 'stay'; })]);
    states.push(['town_leave_hover', climbS(0, (S, R, m, h) => { const g = m.town.svc.exitGate; h.x = g.x; h.y = g.y; S.screen = 'leave'; S.focus = 'go'; S.hover = 'go'; })]);
    states.push(['town_leave_done', climbS(0, (S, R, m, h) => { const g = m.town.svc.exitGate; h.x = g.x; h.y = g.y; R.slain = [DATA.RUNS.campaign.floors]; S.screen = 'leave'; S.focus = 'stay'; })]);
    states.push(['town_gate_prompt', climbS(0, (S, R, m, h) => { R.offers = []; R.portal = { f: 3, x: 0, y: 0 }; R.ways = [4, 8]; h.x = m.town.svc.portal.x + 10; h.y = m.town.svc.portal.y + 44; })]);
    // past the campaign (PR #21 review): the waystones of the descent are named by the descent's biomes, not the campaign's
    states.push(['town_gate_descent', climbS(0, (S, R, m, h) => { R.campaignWon = 1; R.memo = Object.assign({}, R.memo, { 14: { mode: 'endless' }, 15: { mode: 'endless' }, 16: { mode: 'endless' } }); R.portal = { f: 15, x: 0, y: 0 }; R.ways = [4, 8, 12, 14, 16]; h.x = m.town.svc.portal.x + 10; h.y = m.town.svc.portal.y + 44; S.screen = 'gate'; })]);
    states.push(['town_gate', climbS(0, (S, R, m, h) => { R.portal = { f: 11, x: 0, y: 0 }; R.ways = [4, 8, 12]; h.x = m.town.svc.portal.x + 10; h.y = m.town.svc.portal.y + 44; S.screen = 'gate'; S.hover = 'go:1'; })]);
    states.push(['town_portal_prompt', climbS(0, (S, R, m, h) => { R.offers = []; R.portal = { f: 3, x: 0, y: 0 }; h.x = m.town.svc.portal.x + 10; h.y = m.town.svc.portal.y + 44; })]);
    // a chapter boss's portal home (TASKS 383): the town's ring of stones and rune disc in its hall, the hero at it
    const gateS = (f) => climbS(f, (S, R, m, h) => { const b = R.en.find((e) => D.BOSSES[e.type]); R.arena = { active: 1, room: b.room, t0: S.t }; b.hp = 0; SIM.killEnemy(S, R, b); R.freeze = 0; R.inbuf = null; R.msg = null; S.ev = [];
      for (const e of R.en) if (e !== b) e.x += 6000; const g = R.arena.gate, r = m.rooms[b.room]; h.x = g.x + 40; h.y = g.y + 70;
      for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) R.seen[y * m.W + x] = 1; R.rseen[b.room] = 1; });
    states.push(['boss_gate', gateS(2)], ['boss_gate_crypt', gateS(4)]);
    // the portal both ways through the sim itself (TASKS 1025): a scroll read through in the 3rd floor's biggest hall, the hero a
    // quarter second out at the town's ring; E there, a quarter second back at the very spot
    const portalS = (back) => climbS(3, (S, R, m, h) => { const r = m.rooms.filter((q) => q.type !== 'start' && q.type !== 'secret').reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
      h.x = r.cx * TILE; h.y = r.cy * TILE; for (const e of R.en) if (Math.hypot(e.x - h.x, e.y - h.y) < 700) { e.hp = 0; e.deadT = S.t; } else { e.st = 'idle'; e.x += 5000; e.hx = e.x; }
      h.bag[6] = { b: 'scroll', n: 1, id: R.nextId++ }; h.read = { t0: S.t, i: 6 }; for (let i = 0; i < 240 && R.floor; i++) SIM.step(S, { keys: [] });
      if (back) SIM.step(S, { keys: ['KeyE'] }); for (let i = 0; i < 30; i++) SIM.step(S, { keys: [] }); });
    states.push(['town_portal', portalS(0)]);
    states.push(['town_portal_back', portalS(1)]);
    // the town with quests going (TASKS 1025): the first offer taken and done (? over its giver), the Keeper's chapter taken, the
    // other givers' ! left, the tracker with both
    states.push(['town_quests', play((S) => { S.run = SIM.newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, m = R.map; SIM.step(S, { keys: [] });
      const q = SIM.giveQuest(S, R, SIM.offersOf(R)[0].from); q.n = q.need; q.st = 'done'; SIM.giveQuest(S, R, 'keeper'); S.ev = []; R.msg = null;
      const r = m.rooms[0]; R.cam = [(r.x + r.w / 2) * TILE - SCX.VW / 2, (r.y + r.h / 2) * TILE - SCX.VH / 2]; })]);
    // every monster caught mid-turn (a third of the way through)
    states.push(['monsters_turn', play((S) => { lineup(S); for (const e of S.run.en) { e.pf = e.face; e.ft = S.t - 0.05; } })]);
    const box = (name, S) => SCX.Z === 1 || !S.run ? box1(name, S) : box1(name, S).map((v) => v * SCX.Z), box1 = (name, S) => { const R = S.run; if (!R) return [0, 0, SCX.W, SCX.H];
      if (name.startsWith('serpent')) { const e = R.en[0]; return [e.x - R.cam[0] - 180, e.y - R.cam[1] - 205, 380, 235]; }
      if (name.startsWith('merchant')) { const sh = R.map.shop; return [sh.x - R.cam[0] - 60, sh.y - R.cam[1] - 100, 120, 110]; }
      if (folkSubj[name] && R.folk) { const f = R.folk[+folkSubj[name].slice(3)]; return [f.x - R.cam[0] - 70, f.y - R.cam[1] - 120, 140, 136]; }
      const e = (enCycles[name] || loops[name]) && R.en[0];
      if (e && e.type === 'crab') { const hh = SZ('en_crab')[1]; return [e.x - R.cam[0] - 2 * hh, e.y - R.cam[1] - 2 * hh, 4 * hh, 4 * hh]; }
      if (e) { const hh = SZ(EN_TEX[e.type])[1] * 1.15, ww = hh * 1.5; return [e.x - R.cam[0] - ww / 2, e.y - R.cam[1] - hh, ww, hh + 16]; }
      const h = R.hero; return [h.x - R.cam[0] - 50, h.y - R.cam[1] - 90, 100, 110]; };
    const anim = {};
    for (const kind of ['fountain', 'stream']) {
      const base = states.find(([name]) => name === 'water_' + kind + '_dungeon')?.[1]; if (!base) continue;
      const on = [], off = [];
      for (let i = 0; i < 24; i++) {
        const S = structuredClone(base); S.t += i / 60; on.push(S);
        const clean = structuredClone(S); clean.run.map.seed += 211000; clean.run.map.water = []; clean.run.map.waterFeatures = []; off.push(clean);
      }
      anim['water_' + kind] = { on, off, box: [400, 200, 1120, 680], min: 0.003 };
    }
    // the cave's water moves, and its fall pours, without going still (TASKS 304)
    for (const name of ['cave_water', 'cave_waterfall']) {
      const base = states.find(([n]) => n === name)?.[1]; if (!base) continue;
      const on = [], off = [];
      for (let i = 0; i < 24; i++) { const S = structuredClone(base); S.t += i / 60; S.ev = []; on.push(S);
        const clean = structuredClone(S), m = clean.run.map; m.seed += 304000; m.waterFeatures = [];
        if (name === 'cave_water') { m.water = []; m.waterBridges = []; m.crossings = []; m.cells = m.cells.map((c) => (c === 6 ? 1 : c)); } off.push(clean); }
      anim[name] = { on, off, box: name === 'cave_water' ? [400, 200, 1120, 680] : [880, 420, 160, 180], min: 0.003 };
    }
    // the low and middle graphics (TASKS 1372) where they differ: the lava's light and embers, the cave's moss, an elite's aura
    for (const name of ['magma_lava', 'cave_bridge', 'elite_brawl']) { const base = states.find(([n]) => n === name)?.[1]; if (!base) continue;
      for (const g of [1, 0]) { const S = structuredClone(base); S.meta.gfx = g; states.push([name + '_gfx' + g, S]); } }
    // the magma caves' lava flows, bubbles and shimmers, its fall pours and steams (TASKS 403): without them the frame goes still
    for (const name of ['magma_lava', 'magma_fall']) {
      const base = states.find(([n]) => n === name)?.[1]; if (!base) continue;
      const on = [], off = [];
      for (let i = 0; i < 24; i++) { const S = structuredClone(base); S.t += i / 60; S.ev = []; on.push(S);
        const clean = structuredClone(S), m = clean.run.map; m.seed += 403000; m.lavaFeatures = [];
        if (name === 'magma_lava') { m.cells = m.cells.map((c) => (c === 3 ? 0 : c)); m.lava = 0; m.crust = []; m.lavaUnder = []; m.crossings = []; } off.push(clean); }
      anim[name] = { on, off, box: name === 'magma_lava' ? [400, 200, 1120, 680] : [870, 330, 180, 220], min: 0.003 };
    }
    // the cave's mushrooms breathe and shed spores, its roof drips: with them gone the frame must be calmer
    { const base = states.find(([n]) => n === 'cave_light')?.[1];
      if (base) { const on = [], off = [];
        for (let i = 0; i < 24; i++) { const S = structuredClone(base); S.t += i / 60; on.push(S); const clean = structuredClone(S), m = clean.run.map; m.decor = m.decor.filter((d) => !GLOW[d.n]); m.drips = []; off.push(clean); }
        anim.cave_light = { on, off, box: [610, 290, 700, 500], min: 0.003 }; } }
    // a fireball in flight on the cave's 2nd floor, bigger than every floor before it: the spells' floor mask was left with the
    // last floor's size there and hid every spell (the cast and the damage went on); masked, the ball still lights the floor
    // (+0.25 over the frame without it), drawn it adds +1.1
    { const S0 = play(); S0.run = SIM.newRun(S0, 'cave', 3); S0.screen = 'play'; SIM.enterFloor(S0, S0.run, 2); const R = S0.run, m = R.map, W = m.W;
      const k = m.rooms.filter((q) => q.type !== 'start' && q.type !== 'secret').map((q) => q.cy * W + q.cx).concat([...m.cells.keys()])
        .find((k) => [...Array(14).keys()].every((i) => m.cells[k + i - 2] === 1 && m.cells[k + i - 2 - W] === 1));
      if (k !== undefined) { const h = R.hero; h.x = (k % W + 0.5) * TILE; h.y = (Math.floor(k / W) + 0.5) * TILE; h.aim = 0; h.face = 1; h.vx = h.vy = 0;
        R.en = []; R.msg = null; R.seen.fill(1); R.rseen.fill(1); R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; S0.ev = [];
        const on = [], off = [], [hx, hy] = SIM.hand(h);
        for (let i = 0; i < 12; i++) { const S = structuredClone(S0); S.t += i / 60; const age = 0.05 + i / 60; off.push(structuredClone(S));
          S.run.proj = [{ id: 9900, k: 'fire', x: hx + 520 * age, y: hy, vx: 520, vy: 0, t0: S.t - age, life: 1.1, own: 'hero', r: 8 }]; on.push(S); }
        anim.cave_fireball = { on, off, box: [960, 380, 420, 160], min: 0.5 }; } }
    // the cave's water plants, lilies and moss stir, and the water rings round a bridge's posts (TASKS 306): measured on a frame
    // stilled round them (the water, the glowing mushrooms and the drips taken out, the bake rekeyed), with them and without them
    for (const name of ['cave_bridge']) { const base = states.find(([n]) => n === name)?.[1]; if (!base) continue; const on = [], off = [];
      const still = (S) => { const m = S.run.map; m.seed += 306000; m.water = []; m.waterFeatures = []; m.drips = []; m.deep = 0; m.cells = m.cells.map((c) => (c === 6 ? 1 : c)); m.decor = m.decor.filter((d) => !GLOW[d.n]); return S; };
      for (let i = 0; i < 24; i++) { const S = still(structuredClone(base)); S.t += i / 60; S.ev = []; on.push(S); const clean = structuredClone(S), m = clean.run.map;
        m.flora = []; for (const c of m.crossings) c.posts = []; off.push(clean); }
      anim[name + '_life'] = { on, off, box: [720, 380, 480, 320], min: 0.002 }; }
    for (const kind of ['bone', 'snuff', 'water', 'douse']) {
      const base = reactionS(kind, 0.02), on = [], off = [];
      for (let i = 0; i < 16; i++) { const S = structuredClone(base); S.t += i / 60; on.push(S); const clean = structuredClone(S); clean.ev = []; off.push(clean); }
      anim['reaction_' + kind] = { on, off, box: [940, 430, 170, 150], min: 0.002 };
    }
    for (const kind of ['whirl', 'fireball', 'boom']) {
      const base = spellState(kind, 0.05), on = [], off = [];
      for (let i = 0; i < 16; i++) {
        const S = structuredClone(base); S.t += i / 60;
        for (const p of S.run.proj) { p.x += p.vx * i / 60; p.y += p.vy * i / 60; }
        on.push(S); const clean = structuredClone(S); clean.ev = []; clean.run.proj = []; clean.run.scorches = []; off.push(clean);
      }
      anim['spell_' + kind] = { on, off, box: [760, 350, 420, 300], min: 0.02 };
    }
    for (const [name, kind] of [['shard_pickup', 'shard'], ['shard_reward', 'stairs']]) {
      const base = structuredClone(states.find(([key]) => key === (kind === 'shard' ? 'shard_flash' : 'shard_floor'))[1]);
      const on = [], off = [];
      for (let i = 0; i < 90; i++) {
        const S = structuredClone(base); S.t = base.t + i / 60; S.ev[0].t = base.t;
        on.push(S); const clean = structuredClone(S); clean.ev = []; off.push(clean);
      }
      anim[name] = { on, off, box: [100, 130, 1000, 500] };
    }
    // starting a run or a floor fades the screen in from black; every QA state but the one that checks it is looked at in full light
    const calm = (o, seen = new Set()) => { if (!o || typeof o !== 'object' || seen.has(o) || (Array.isArray(o) && typeof o[0] === 'number')) return; seen.add(o);
      if ('screen' in o) { if (Array.isArray(o.ev) && !o.keepFloor) o.ev = o.ev.filter((e) => e.k !== 'floor'); return; }   // (a state holds no states: walking its map overflowed the Set)
      for (const v of Object.values(o)) calm(v, seen); };
    // what the hero wears (TASKS 155): every armour with a matching set, from the front and from behind, alone in a lit room; the
    // walk cycles again in the full plate set (its parts must move like the plain rig's)
    const KIT = { none: {}, leather: { armor: 'leather_armor', helm: 'leather_helm', gloves: 'leather_gloves', boots: 'boots', offhand: 'buckler' },
      plate: { armor: 'plate_armor', helm: 'knight_helm', gloves: 'gauntlets', boots: 'iron_boots', offhand: 'tower_shield' }, cloak: { armor: 'cloak', gloves: 'leather_gloves', boots: 'boots', offhand: 'shield' },
      rare: { armor: 'plate_armor', helm: 'leather_helm', gloves: 'gauntlets', boots: 'boots', offhand: 'shield', rar: 3 } };
    const wear = (kit) => (S) => { const h = S.run.hero, k = KIT[kit]; for (const sl of ['armor', 'helm', 'gloves', 'boots', 'offhand']) h.eq[sl] = k[sl] ? { id: 0, b: k[sl], rar: k.rar || 0, lvl: 1, mods: {} } : null; };
    for (const kit of Object.keys(KIT)) for (const back of [0, 1]) states.push(['gear_' + kit + (back ? '_back' : ''), play((S) => { wear(kit)(S); const R = S.run, h = R.hero, m = R.map, rm = m.rooms[m.start];
      h.x = (rm.cx - 2.5) * TILE; h.y = (rm.cy + 1.5) * TILE; h.back = back; h.backT = -9; h.vx = h.vy = 0; R.en = []; R.msg = null; R.cam = [h.x - SCX.VW / 2, h.y - SCX.VH / 2]; })]);
    for (const [type, f] of [['boss_spider', 2], ['boss_necro', 4], ['boss_forge', 6], ['boss', 8]]) {
      for (const mv of Object.keys(D.BOSSES[type].moves)) states.push(['arena_' + type + '_' + mv, play((S) => {
        SIM.enterFloor(S, S.run, f); const R = S.run, b = R.en.find((e) => e.type === type), h = R.hero;
        h.x = b.x + 90; h.y = b.y + 130; h.ifr = 1e9; R.seen.fill(1); R.msg = null;
        SIM.step(S, { keys: [] }); b.st = 'bwind'; b.mv = mv; b.t0 = S.t; b.fired = 0; b.hitDone = 0;
        const span = D.bossMove(b).wind + (mv === 'weave' || mv === 'barrier' || mv === 'lava' ? 0.2 : mv === 'eggs' ? 1 : -0.05);
        for (let i = 0; i < Math.ceil(span / SIM.DT); i++) SIM.step(S, { keys: [] });
        R.cam = [b.x - SCX.VW / 2, b.y - SCX.VH / 2]; R.msg = { s: D.ENEMIES[type].name, t: S.t - 0.5 };
      })]);
    }
    // the forge lord's lava through its warning, a third, two thirds and the instant before it breaks through (TASKS 233)
    for (const [i, part] of [0.33, 0.66, 0.97].entries()) states.push(['arena_lava_warn_' + i, play((S) => {
      SIM.enterFloor(S, S.run, 6); const R = S.run, b = R.en.find((e) => e.type === 'boss_forge'), h = R.hero;
      h.x = b.x + 90; h.y = b.y + 130; h.ifr = 1e9; R.seen.fill(1); R.msg = null;
      SIM.step(S, { keys: [] }); b.st = 'bwind'; b.mv = 'lava'; b.t0 = S.t; b.fired = 0; b.hitDone = 0; const M = D.bossMove(b);
      for (let k = 0; k < Math.ceil((M.wind + 0.01 + M.warn * part) / SIM.DT); k++) SIM.step(S, { keys: [] });
      R.cam = [b.x - SCX.VW / 2, b.y - SCX.VH / 2]; })]);
    for (const [name, phase, span] of [['boss_phase2_volley', 1, 2.25], ['boss_phase3_warning', 2, 1.4], ['boss_phase3_lava', 2, 2.2]]) states.push([name, play((S) => {
      SIM.enterFloor(S, S.run, 8); const R = S.run, b = R.en.find((e) => e.type === 'boss'), h = R.hero;
      h.x = b.x + 90; h.y = b.y + 110; h.ifr = 1e9; R.seen.fill(1); SIM.step(S, { keys: [] });
      for (const e of R.en) if (e !== b) { e.hp = 0; e.deadT = S.t - 2; }
      b.hp = b.max * (D.BOSSES.boss.phases[phase].at - 0.001); b.phase = phase - 1;
      for (let i = 0; i < Math.ceil(span / SIM.DT); i++) SIM.step(S, { keys: [] });
      R.cam = [b.x - SCX.VW / 2, b.y - SCX.VH / 2]; R.msg = null;
    })]);
    // (TASKS 1708) the motion check isolates an actor by these names: the hero walks in his starting leather and cloth, whose parts
    // carry suffixes, and the fire priest wears the cultist's rig in its own paint; listed by hand, only the cape and nothing were measured
    const heroSpr = Object.keys(ASSETS).filter((a) => a.startsWith('hero__')).concat(['it_sword', 'it_longsword', 'it_shield', 'it_shield_t']);
    // (TASKS 1765) a window over the world is staged a second after the floor opens, when the only lit room hides under the window
    // and the frame reads black; a player pauses on a floor already walked, and brightness from the pause is judged on that world
    const overWorld = (S) => S.run && !S.run.town && (S.screen === 'pause' || S.screen === 'altar' || S.screen === 'note' || S.screen === 'notes' || (S.screen === 'settings' && S.setFrom === 'pause'));
    for (const [, S] of states) if (overWorld(S)) S.run.seen.fill(1);
    const out = { states, anim, cycles: Object.assign({ hero_right: cyc(1, 0), hero_left: cyc(-1, 0), hero_down: cyc(0, 1), hero_up: cyc(0, -1), hero_plate_right: cyc(1, 0, wear('plate')), hero_plate_up: cyc(0, -1, wear('plate')) }, enCycles, folkCyc),
      sprites: Object.assign(Object.fromEntries(['hero_right', 'hero_left', 'hero_down', 'hero_up', 'hero_plate_right', 'hero_plate_up'].map((k) => [k, heroSpr])),
        Object.fromEntries(Object.keys(enCycles).map((k) => { const n = MONSTERS.rigOf(k.split('_').slice(0, -1).join('_')); const pn = k.startsWith('fire_priest_') ? 'priest' : n; return [k, Object.keys(ASSETS).filter((a) => a.startsWith(n + '__') || a.startsWith(pn + '__') || a === n + '_weapon' || a === n + '_shield')]; }))),
      subject: Object.assign({ hero_right: 'hero', hero_left: 'hero', hero_down: 'hero', hero_up: 'hero', hero_plate_right: 'hero', hero_plate_up: 'hero' }, Object.fromEntries(Object.entries(transitions).map(([k, fr]) => [k, k.startsWith('hero') ? 'hero' : k.startsWith('merchant') ? 'merchant' : 'en' + ((fr[0].run.en[0] || {}).id ?? 990)])), Object.fromEntries(Object.keys(enCycles).map((k) => [k, 'en990'])), Object.fromEntries(Object.keys(loops).map((k) => [k, k.startsWith('merchant') ? 'merchant' : k.startsWith('hero') ? 'hero' : 'en990'])), Object.fromEntries(Object.keys(swings).map((k) => [k, 'hero']))), cycleT: { ...Object.fromEntries(Object.keys(enCycles).map((k) => { const ty = k.split('_').slice(0, -1).join('_'); return [k, MONSTERS.stride(ty, SZ(EN_TEX[ty])[1] * (D.BOSSES[ty] ? D.BOSSES[ty].scale || 1.6 : 1)) / D.ENEMIES[ty].spd]; })), hero_right: 2 * SIM.stepLen(1) / SIM.K.RUN, hero_left: 2 * SIM.stepLen(1) / SIM.K.RUN, hero_down: 2 * SIM.stepLen(0) / SIM.K.RUN, hero_up: 2 * SIM.stepLen(0) / SIM.K.RUN },
      rest: { hero_right: play(), hero_left: play(), hero_down: play(), hero_up: play((S) => { S.run.hero.back = 1; }), hero_plate_right: play(wear('plate')), hero_plate_up: play((S) => { wear('plate')(S); S.run.hero.back = 1; }) }, actors: ['hero', ...new Set(Object.keys(enCycles).map((k) => k.split('_').slice(0, -1).join('_'))), 'ghost', 'slime', 'eel', 'serpent', 'boss'], loops, attacks, swings, impacts, transitions, box };
    // the mage (TASKS 1115): his walk on his own parts, his staff shot (the arm brings the staff up, a bolt leaves), his casts, a blow and
    // his death, round the compass; every sequence is the hero's with the mage's class and kit
    const asMage = (S) => { const h = S.run.hero; h.cls = 'mage'; h.eq.weapon = { id: 0, b: 'staff', rar: 0, lvl: 1, mods: {}, atk: 6 }; h.eq.armor = { id: 0, b: 'robe', rar: 0, lvl: 1, mods: {}, def: 3 }; };
    const mageSpr = Object.keys(ASSETS).filter((a) => a.startsWith('mage__')).concat(['it_staff']);
    for (const [k, dx, dy] of [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]]) { const n = 'mage_' + k;
      out.cycles[n] = cyc(dx, dy, asMage); out.sprites[n] = mageSpr; out.subject[n] = 'hero'; out.cycleT[n] = out.cycleT['hero_' + k]; out.rest[n] = play((S) => { asMage(S); if (dy < 0) S.run.hero.back = 1; }); }
    const mageT = (a0, fire, press, turn) => { const fr = []; let S = play((S) => { clear(S); asMage(S); }); for (let i = 0; i < 75; i++) { const h = S.run.hero, R = S.run, a = turn && i >= turn[0] ? a0 + turn[1] : a0;
      if (i === 5) { h.aim = a; const f = Math.cos(a) >= 0 ? 1 : -1; if (f !== h.face) { h.face = f; h.faceT = S.t; } if (fire) fire(S, h); } fr.push(S); S = structuredClone(S);
      const sx = (h.x - R.cam[0]) * (D.ZOOM || 1), sy = (h.y - 30 - R.cam[1]) * (D.ZOOM || 1); for (let k = 0; k < 2; k++) SIM.step(S, { px: sx + Math.cos(a) * 300, py: sy + Math.sin(a) * 300, press: press && [].concat(press === 1 ? [5] : press).some((q) => i >= q && i < q + 2) ? 1 : 0, keys: [] }); } return fr; };
    const frost = (S, h) => { h.castT = S.t; h.castK = 'frost'; S.ev.push({ k: 'frost', t: S.t, x: h.x, y: h.y, a: h.aim, r: D.abRank('frost', 1).r, arc: D.FROST.arc }); };
    for (const [n, a] of [['r', 0], ['d', Math.PI / 2], ['ul', -2.3]]) { transitions['hero_mage_shoot_' + n] = mageT(a, null, 1); transitions['hero_mage_frost_' + n] = mageT(a, frost); transitions['hero_mage_cast_' + n] = mageT(a, cast); }
    // two shots 0.47 s apart (the staff's own pace): the second raise carries on from the first
    transitions.hero_mage_shoot2_r = mageT(0, null, [5, 33]);
    // (TASKS 1153: the pointer turned in the wind-up; a wand's shots 0.36 s apart with the aim flipped)
    transitions.hero_mage_shoot_turn = mageT(0, null, 1, [7, 1.2]); transitions.hero_mage_wand_flip = mageT(0, (S, h) => { h.eq.weapon = Object.assign({}, h.eq.weapon, { b: 'wand' }); }, [5, 30], [20, Math.PI]);
    transitions.hero_mage_hurt = mageT(0, (S, h) => { h.hurtT = S.t; h.hurtX = 1; });
    transitions.hero_mage_death = mageT(0, (S, h) => { h.hp = 0; h.deadT = S.t; });
    // the archer (TASKS 1125): the same sequences with his bow; the volley and the leap through the sim
    const asArcher = (S, b = 'shortbow') => { const h = S.run.hero; h.cls = 'archer'; h.eq.weapon = { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6 }; h.eq.armor = { id: 0, b: 'leather_armor', rar: 0, lvl: 1, mods: {}, def: 3 }; };
    const archerSpr = Object.keys(ASSETS).filter((a) => a.startsWith('archer__') || /^it_(bow_[sl]|crossbow)(_h)?$/.test(a)).concat(['skel_arrow']);
    for (const [k, dx, dy] of [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]]) { const n = 'archer_' + k;
      out.cycles[n] = cyc(dx, dy, asArcher); out.sprites[n] = archerSpr; out.subject[n] = 'hero'; out.cycleT[n] = out.cycleT['hero_' + k]; out.rest[n] = play((S) => { asArcher(S); if (dy < 0) S.run.hero.back = 1; }); }
    const archerT = (a0, fire, press, turn, b) => { const fr = []; let S = play((S) => { clear(S); asArcher(S, b); S.run.hero.lvl = 4; S.run.hero.ab.volley = 1; S.run.hero.ab.trap = 1; S.run.hero.ab.leap = 1; S.run.hero.mp = 999; }); for (let i = 0; i < 75; i++) { const h = S.run.hero, R = S.run, a = turn && i >= turn[0] ? a0 + turn[1] : a0;
      if (i === 5) { h.aim = a; const f = Math.cos(a) >= 0 ? 1 : -1; if (f !== h.face) { h.face = f; h.faceT = S.t; } if (typeof fire === 'function') fire(S, h); } fr.push(S); S = structuredClone(S);
      const sx = (h.x - R.cam[0]) * (D.ZOOM || 1), sy = (h.y - 30 - R.cam[1]) * (D.ZOOM || 1); for (let k = 0; k < 2; k++) SIM.step(S, { px: sx + Math.cos(a) * 300, py: sy + Math.sin(a) * 300, press: press && [].concat(press === 1 ? [5] : press).some((q) => i >= q && i < q + 2) ? 1 : 0, slot: fire === 'volley' && i === 5 && k === 0 ? 1 : fire === 'leap' && i === 5 && k === 0 ? 3 : 0, keys: [] }); } return fr; };
    for (const [n, a] of [['r', 0], ['d', Math.PI / 2], ['ul', -2.3]]) transitions['hero_archer_shoot_' + n] = archerT(a, null, 1);
    transitions.hero_archer_shoot_l = archerT(Math.PI, null, 1); transitions.hero_archer_shoot_u = archerT(-Math.PI / 2, null, 1); transitions.hero_archer_shoot_turn = archerT(0, null, 1, [7, 1.2]); transitions.hero_archer_pair = archerT(0, null, [5, 34]);
    // each bow and the crossbow at rest, walking and shooting all round (TASKS 1710, 1711)
    const AIM8 = [['r', 0], ['dr', Math.PI / 4], ['d', Math.PI / 2], ['dl', 3 * Math.PI / 4], ['l', Math.PI], ['ul', -3 * Math.PI / 4], ['u', -Math.PI / 2], ['ur', -Math.PI / 4]];
    for (const b of ['longbow', 'crossbow']) {
      for (const [n, a] of AIM8) transitions['hero_' + b + '_shoot_' + n] = archerT(a, null, 1, null, b);
      for (const [k, dx, dy] of [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]]) { const n = b + '_' + k;
        out.cycles[n] = cyc(dx, dy, (S) => asArcher(S, b)); out.sprites[n] = archerSpr; out.subject[n] = 'hero'; out.cycleT[n] = out.cycleT['hero_' + k]; out.rest[n] = play((S) => { asArcher(S, b); if (dy < 0) S.run.hero.back = 1; }); } }
    transitions.hero_archer_shoot2_r = archerT(0, null, [5, 30]); transitions.hero_archer_volley_r = archerT(0, 'volley'); transitions.hero_archer_leap_r = archerT(0, 'leap');
    // the warrior's charge and war cry (TASKS 1134), through the sim
    const warT = (a, slot, foe, press) => { const fr = []; let S = play((S) => { clear(S); const h = S.run.hero; h.lvl = 4; h.ab.charge = 1; h.ab.cry = 1; h.mp = 100; if (foe) lone('skeleton')(S); if (foe) Object.assign(S.run.en[0], { x: h.x + 140, ifr: 0, hp: 1e6, max: 1e6 }); }); for (let i = 0; i < 75; i++) { const h = S.run.hero, R = S.run;
      if (i === 5) { h.aim = a; const f = Math.cos(a) >= 0 ? 1 : -1; if (f !== h.face) { h.face = f; h.faceT = S.t; } } fr.push(S); S = structuredClone(S); h.mp = 100;
      const sx = (h.x - R.cam[0]) * (D.ZOOM || 1), sy = (h.y - 30 - R.cam[1]) * (D.ZOOM || 1); for (let k = 0; k < 2; k++) SIM.step(S, { px: sx + Math.cos(a) * 300, py: sy + Math.sin(a) * 300, slot: i === 5 && k === 0 ? slot : 0, press: press && i >= press && i < press + 2 ? 1 : 0, keys: [] }); } return fr; };
    transitions.hero_charge_r = warT(0, 2); transitions.hero_charge_hit = warT(0, 2, 1); transitions.hero_charge_ul = warT(-2.3, 2); transitions.hero_charge_d = warT(Math.PI / 2, 2); transitions.hero_charge_l = warT(Math.PI, 2); transitions.hero_charge_strike = warT(0, 2, 1, 28); transitions.hero_cry = warT(0, 3);
    transitions.hero_archer_hurt = archerT(0, (S, h) => { h.hurtT = S.t; h.hurtX = 1; }); transitions.hero_archer_death = archerT(0, (S, h) => { h.hp = 0; h.deadT = S.t; });
    for (const k of Object.keys(transitions)) if (k.startsWith('hero')) out.subject[k] = 'hero';
    Object.assign(out.subject, doorSubj);
    Object.assign(out.subject, folkSubj); Object.assign(out.cycleT, folkCycT); Object.assign(out.sprites, folkSpr);
    out.actors.push(...['smith', 'keeper', 'guard', 'enchanter', 'sweeper', 'child', 'porter', 'mason', 'hen', 'cart'].map((r) => 'folk_' + r));
    calm(out); return out;
  };
  SC.QA = () => SIM.genApart(build);
})();
