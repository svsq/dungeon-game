// live/sim_checks_items.js — selfCheck's parts for items: loot levels, gear levels, potions, the bag, stash, crafting, mastery. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    bagAdd, BASES, D, dep, enterFloor, heroSt, isCons, newRun, persist, potion, RARITY, rollAffixes, rollItem, spawn, stashOf, stats, step, UI,
    useItem, usePotion, wearIfFree } = SIMX;
  const { noQuests } = SIMX.checks.kit;
  // a run of its own (the caves, the magma caves) finds, is sold and is given items at about its hero's level on its first floor:
  // the magma caves' loot over their depth once made them 10 levels over him and the run a walk (TASKS 424)
  function lootLevelCheck() {
    const out = [];
    for (const mode of Object.keys(D.RUNS)) { const M = D.RUNS[mode]; if (!M.lvl || M.lvl < 2 || M.endless) continue;
      const S = spawn(0, {}), R = newRun(S, mode, 7); enterFloor(S, R, 1); const lv = rollItem(R, dep(R)).lvl, sh = R.shop.goods.filter((g) => BASES[g.it.b]).map((g) => g.it.lvl);
      if (Math.abs(lv - M.lvl) > 3) out.push(`${mode}: a 1st floor's item is level ${lv} for a hero of level ${M.lvl}`);
      if (sh.some((l) => Math.abs(l - M.lvl) > 3)) out.push(`${mode}: the 1st floor's merchant sells items of level ${Math.min(...sh)}–${Math.max(...sh)} for a hero of level ${M.lvl}`); }
    return out; }
  // TASKS 1017: a quest taken in the town counts only what its goal names, from its floor down: monsters (not in the town nor
  // above its floor; elites only for an elite hunt; a boss is no monster), rooms cleared to the last foe, the floor reached, a
  // chapter's boss; done at its need, nothing counts past it; turned in only in the town and only once, for its reward (gold, XP,
  // an item in the bag, shards to the bank); the quests travel in the save and stay small
  // TASKS 1028: gear asks a hero's level a little under its own: a find of the floor the hero is on goes on at once (the lowest levels
  // the novice and average bots come to each campaign floor at, the test runs' starting heroes); a piece above the level is not
  // put on by a click (a refusal, it stays in the bag) nor by a pickup into an empty slot; the starting gear asks nothing
  function levelCheck() {
    const out = [], S = spawn(0, {}), at = [1, 3, 3, 5, 6, 7, 8, 9, 11, 12, 13, 15];
    at.forEach((l, i) => { if (D.reqLvl({ b: 'sword', lvl: i + 1 }) > l) out.push(`level: a ${i + 1}st-floor find asks more than level ${l}`); });
    for (const mode of ['cave', 'magma']) { const R0 = newRun(S, mode, 3), f4 = rollItem(R0, dep(R0, 4), 0); if (D.reqLvl(f4) > R0.hero.lvl) out.push(`level: a ${mode} run's last floor's find asks more than its starting hero's level`); }
    S.run = newRun(S, 'campaign', 5); S.screen = 'play'; const R = S.run, h = R.hero; if (Object.values(h.eq).some((it) => it && D.reqLvl(it) > 1)) out.push('level: the starting gear asks a level');
    let deep; do deep = Object.assign(rollItem(R, 12, 0, 'helm'), { id: R.nextId++ }); while (!D.wears(h.cls, deep.b)); h.eq.helm = null; h.bag[7] = deep; useItem(S, R, 7);
    if (h.eq.helm || h.bag[7] !== deep || !S.ev.some((e) => e.k === 'nope' && e.s === 'Требуется уровень ' + D.reqLvl(deep))) out.push('level: a piece above the level is put on by a click');
    h.bag[7] = null; if (wearIfFree(S, R, deep) || h.eq.helm) out.push('level: a piece above the level goes on at a pickup');
    h.lvl = D.reqLvl(deep); h.bag[7] = deep; useItem(S, R, 7); if (h.eq.helm !== deep) out.push('level: a piece at the level is not put on');
    return out;
  }

  // TASKS 1881: a full pool keeps the potion and says why; with a power on the drink only a second press within a second drinks it
  function potionCheck() {
    const out = [], run = (cls) => { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777, { cls }); S.screen = 'play'; S.t = S.run.t = 10; const R = S.run, h = R.hero, M = heroSt(S); h.hp = M.maxHp; h.mp = M.maxMp; h.bag.fill(null); h.bag[0] = potion('hp_potion', 3); h.bag[1] = potion('mp_potion', 3); S.ev = []; return { S, R, h }; };
    const left = (h, b) => h.bag.filter((it) => it && it.b === b).reduce((n, it) => n + it.n, 0), said = (S) => S.ev.filter((e) => e.k === 'nope' && e.s).length;
    for (const [cls, b] of [['warrior', 'hp_potion'], ['mage', 'mp_potion']]) { const { S, R, h } = run(cls); usePotion(S, R, b); usePotion(S, R, b);
      if (left(h, b) !== 3) out.push(`potion: a ${cls} at a full pool spent ${3 - left(h, b)} ${b}`); if (said(S) !== 2) out.push(`potion: a ${cls}'s ${b} at a full pool kept without a reason`); }
    { const { S, R, h } = run('warrior'); h.hp -= 10; usePotion(S, R, 'hp_potion'); if (left(h, 'hp_potion') !== 2) out.push('potion: a hurt hero cannot drink'); }
    const T = '__potion'; D.POWERS[T] = { trig: 'potion', fx: 'mana', v: 0 };
    try { const { S, R, h } = run('warrior'); h.powers = { [T]: 1 }; R.town = 0; usePotion(S, R, 'hp_potion');
      if (left(h, 'hp_potion') !== 3) out.push('potion: with a power on the drink the first press at full health drinks');
      S.t += 1.5; usePotion(S, R, 'hp_potion'); if (left(h, 'hp_potion') !== 3) out.push('potion: a press 1.5 s after the first still drinks for the power');
      S.t += 0.5; usePotion(S, R, 'hp_potion'); if (left(h, 'hp_potion') !== 2 || !S.ev.some((e) => e.k === 'power' && e.id === T)) out.push('potion: the second press within a second does not drink for the power'); }
    finally { delete D.POWERS[T]; }
    return out;
  }
  function bagCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 77); S.screen = 'inv'; const R = S.run, h = R.hero, U = UI.inv(D.clsOf(h).abs);
    const at = (id, o = {}) => { const b = U.r.find((q) => q.id === id); return Object.assign({ keys: [], px: b.x + 10, py: b.y + 10 }, o); };
    if (D.BAG.start !== 24 || h.bag.length !== 24 || UI.meta(S.meta.cls).some((q) => q.id === 'bag')) out.push('bag: a fresh hero does not have 24 cells, or the altar still sells the bag');
    const had = h.bag.filter(Boolean).length; let added = 0; for (let i = 0; i < 30; i++) if (bagAdd(R, Object.assign(rollItem(R, 3 + (i % 5), i % 4), { id: 5000 + i }))) added++;
    if (h.bag.filter(Boolean).length !== 24 || added !== 24 - had) out.push('bag: the bag takes more or fewer than its 24 cells');
    const A = h.bag[3], B = h.bag[5];
    step(S, at('bag:3', { click: 1, press: 1 })); step(S, at('bag:5', { press: 1 })); step(S, at('bag:5'));
    if (h.bag[3] !== B || h.bag[5] !== A) out.push('bag: a drag does not swap two cells');
    { const w = Object.assign(rollItem(R, 1, 0, 'weapon'), { id: 6000 }); h.bag.fill(null); h.bag[2] = w; const old = h.eq.weapon;
      step(S, at('bag:2', { click: 1, press: 1 })); step(S, at('bag:2')); if (h.eq.weapon !== w || h.bag[2] !== old) out.push('bag: a click on the piece no longer wears it'); }
    { h.bag.fill(null); const e = h.eq.armor; step(S, at('eq:armor', { click: 1, press: 1 })); step(S, at('bag:7', { press: 1 })); step(S, at('bag:7'));
      if (h.eq.armor || h.bag[7] !== e) out.push('bag: a worn piece dragged to a cell does not come off into it'); }
    { const nopes = () => S.ev.filter((e) => e.k === 'nope').length, drag = (from, to, ev0 = {}) => { step(S, at(from, { click: 1, press: 1 })); step(S, at(to, { press: 1 })); step(S, at(to)); };
      h.bag.fill(null); h.eq.ring = null; const pot = potion('hp_potion', 3); pot.id = 6100; h.bag[1] = pot; let n0 = nopes(); drag('bag:1', 'eq:ring');
      if (h.bag[1] !== pot || pot.n !== 3 || h.eq.ring || nopes() !== n0 + 1) out.push('bag: a potion dropped on a worn slot is drunk, worn or goes unrefused');
      const bt = Object.assign(rollItem(R, 1, 0, 'boots'), { id: 6101 }); h.bag[2] = bt; n0 = nopes(); const wp = h.eq.weapon; drag('bag:2', 'eq:weapon');
      if (h.bag[2] !== bt || h.eq.weapon !== wp || nopes() !== n0 + 1) out.push('bag: a piece dropped on another piece\'s slot is worn or goes unrefused');
      const w2 = Object.assign(rollItem(R, 1, 0, 'weapon'), { id: 6102 }); h.bag.fill(null); h.bag[4] = w2; const w1 = h.eq.weapon; drag('eq:weapon', 'bag:4');
      if (h.eq.weapon !== w2 || h.bag[4] !== w1) out.push('bag: a worn piece dropped on a bag piece of its slot does not swap');
      h.bag.fill(null); const pot2 = potion('hp_potion', 2); pot2.id = 6103; h.bag[6] = pot2; n0 = nopes(); const w3 = h.eq.weapon; drag('eq:weapon', 'bag:6');
      if (h.eq.weapon !== w3 || h.bag[6] !== pot2 || pot2.n !== 2 || nopes() !== n0 + 1) out.push('bag: a worn piece dropped on a cell holding another slot\'s piece is not refused whole'); }
    h.bag.fill(null); const mix = [rollItem(R, 2, 1), rollItem(R, 9, 3), rollItem(R, 5, 3), rollItem(R, 7, 0), potion('hp_potion', 3)]; mix.forEach((it, i) => { it.id = 7000 + i; h.bag[i * 2] = it; });
    step(S, at('sort:rar', { click: 1 })); step(S, at('sort:rar'));
    const rs = h.bag.filter(Boolean); if (rs.length !== 5 || h.bag.slice(5).some(Boolean) || rs.some((it, i) => i && (rs[i - 1].rar || 0) < (it.rar || 0))) out.push('bag: the rarity sort does not order the cells or pack them to the front');
    step(S, at('sort:type', { click: 1 })); step(S, at('sort:type')); if (!isCons(h.bag[0])) out.push('bag: the type sort does not put consumables first');
    step(S, at('sort:lvl', { click: 1 })); step(S, at('sort:lvl')); { const ls = h.bag.filter(Boolean); if (ls.some((it, i) => i && (ls[i - 1].lvl || 0) < (it.lvl || 0))) out.push('bag: the level sort does not order the cells'); }
    const old = JSON.parse(JSON.stringify(R)); old.hero.cap = 12; old.hero.bag.fill(null); old.hero.bag[20] = Object.assign(rollItem(R, 3, 1), { id: 8000 });
    const T = spawn(1, JSON.parse(JSON.stringify(persist(Object.assign(spawn(0, {}), { run: old })))));
    if (!T.saved || !T.saved.hero.bag[20] || T.saved.hero.bag.length !== 24) out.push('bag: a run saved with the 12-cell cap loses its cells');
    else { let n = 0; while (n < 30 && bagAdd(T.saved, Object.assign(rollItem(T.saved, 3, 1), { id: 8100 + n }))) n++; if (n !== 23) out.push(`bag: a hero saved with the 12-cell cap fills ${n + 1} of 24 cells`); }
    { const Q = { rs: 71, hero: h, nextId: 1 }; let t1 = 0, t3 = 0, boss = 0; for (let i = 0; i < 400; i++) { const c = SIMX.chestLoot(Object.assign(Q, { floor: 5 }), { tier: 1 }); if (c.some((it) => !isCons(it))) t1++; if (SIMX.chestLoot(Q, { tier: 3 }).some((it) => !isCons(it))) t3++; }
      if (t1 < 40 || t1 > 130 || t3 !== 400) out.push(`chest loot: a plain chest holds gear in ${t1}/400, a top-tier one in ${t3}/400`); }
    const V = spawn(0, {}); V.run = newRun(V, 'campaign', 78, { town: 1 }); V.screen = 'stash'; const Hh = V.run.hero, Us = UI.stash(), T2 = stashOf(V);
    Hh.bag.fill(null); T2.items = [rollItem(V.run, 2, 1), rollItem(V.run, 8, 3), null, rollItem(V.run, 5, 2)]; for (const it of T2.items) if (it) it.id = V.run.nextId++;
    { const b = Us.r.find((q) => q.id === 'sortS:rar'); step(V, { keys: [], px: b.x + 10, py: b.y + 10, click: 1 }); step(V, { keys: [], px: b.x + 10, py: b.y + 10 }); }
    if (T2.items.length !== 3 || T2.items.some((it, i) => !it || (i && (T2.items[i - 1].rar || 0) < (it.rar || 0)))) out.push('bag: the chest sort does not order and pack its pieces');
    return out;
  }
  // TASKS 1687: pouches bought at the Altar of souls, each a tab of its own: the buy, the bag grown in the run at once, a save and a
  // load, a tab's sort, a drag onto a tab (from the bag, from the worn gear, from the chest), a full tab refusing, the 1340 migration
  function pouchCheck() {
    const out = [], S = spawn(0, { meta: { shards: 1000, up: {} } }); S.run = newRun(S, 'campaign', 79); const R = S.run, h = R.hero, nopes = () => S.ev.filter((e) => e.k === 'nope').length;
    const cl = (rs, id, o = {}) => { const b = rs.find((q) => q.id === id); if (!b) { out.push('pouch: no ' + id + ' on ' + S.screen); return; } step(S, Object.assign({ keys: [], px: b.x + 10, py: b.y + 10, click: 1 }, o)); step(S, { keys: [], px: b.x + 10, py: b.y + 10 }); };
    const inv = () => UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab), drag = (from, to) => { const a = inv().r.find((q) => q.id === from), b = inv().r.find((q) => q.id === to); if (!a || !b) { out.push(`pouch: no ${from} or ${to}`); return; }
      step(S, { keys: [], px: a.x + 10, py: a.y + 10, click: 1, press: 1 }); step(S, { keys: [], px: b.x + 10, py: b.y + 10, press: 1 }); step(S, { keys: [], px: b.x + 10, py: b.y + 10 }); };
    if (h.bag.length !== 24 || UI.inv(D.clsOf(h).abs, 24, 0).r.filter((q) => q.tab !== undefined).length !== 1) out.push('pouch: a hero without pouches has more than the bag');
    S.screen = 'meta'; cl(UI.meta(S.meta.cls), 'pouch'); cl(UI.meta(S.meta.cls), 'pouch');
    if (S.meta.up.pouch !== 2 || S.meta.shards !== 1000 - D.META.find((m) => m.id === 'pouch').cost(0) - D.META.find((m) => m.id === 'pouch').cost(1)) out.push('pouch: two pouches are not bought at their prices');
    if (h.bag.length !== 24 + 2 * D.BAG.pouch) out.push(`pouch: the hero in the run has ${h.bag.length} cells after two pouches`);
    { let n = 0; h.bag.fill(null); for (let i = 0; i < 80; i++) if (bagAdd(R, Object.assign(rollItem(R, 3, 1), { id: 9000 + i }))) n++; if (n !== h.bag.length) out.push(`pouch: the bag and pouches take ${n} of ${h.bag.length}`); }
    { const it = h.bag[30], T = spawn(1, JSON.parse(JSON.stringify(persist(Object.assign(spawn(0, {}), { meta: S.meta, run: R })))));
      if (!T.saved || T.saved.hero.bag.length !== h.bag.length || !T.saved.hero.bag[30] || T.saved.hero.bag[30].id !== it.id) out.push('pouch: a piece in a pouch is lost over a save and a load'); }
    S.screen = 'inv'; h.bag.fill(null); const mix = [rollItem(R, 2, 1), rollItem(R, 9, 3), rollItem(R, 5, 4)]; mix.forEach((it, i) => { it.id = 9500 + i; h.bag[25 + i * 3] = it; });
    const keep = Object.assign(rollItem(R, 4, 0), { id: 9510 }); h.bag[5] = keep;
    cl(inv().r, 'btab:1'); if (S.bagTab !== 1 || !inv().r.some((q) => q.id === 'bag:24') || inv().r.some((q) => q.id === 'bag:0')) out.push('pouch: a tab does not open its pouch');
    cl(inv().r, 'sort:rar'); { const p = h.bag.slice(24, 40), f = p.filter(Boolean); if (f.length !== 3 || p.slice(3).some(Boolean) || f.some((it, i) => i && (f[i - 1].rar || 0) < (it.rar || 0)) || h.bag[5] !== keep) out.push('pouch: the sort does not order the open pouch alone'); }
    cl(inv().r, 'btab:0'); drag('bag:5', 'btab:2'); if (h.bag[5] || h.bag[40] !== keep) out.push('pouch: a piece dragged onto a tab does not go into that pouch');
    { const w = h.eq.weapon; drag('eq:weapon', 'btab:1'); if (h.eq.weapon || h.bag[27] !== w) out.push('pouch: a worn piece dragged onto a tab does not come off into it'); h.eq.weapon = w; h.bag[27] = null; }
    { for (let i = 40; i < 56; i++) h.bag[i] = h.bag[i] || Object.assign(rollItem(R, 2, 0), { id: 9600 + i }); const it = Object.assign(rollItem(R, 2, 0), { id: 9700 }); h.bag[7] = it; const n0 = nopes(); drag('bag:7', 'btab:2');
      if (h.bag[7] !== it || nopes() !== n0 + 1) out.push('pouch: a full pouch takes a piece or does not refuse it'); }
    // TASKS 1786: a piece dropped on its own pouch's tab stays and says so
    { cl(inv().r, 'btab:2'); const it = h.bag[41], n0 = nopes(); drag('bag:41', 'btab:2'); const e = S.ev.filter((q) => q.k === 'nope').at(-1);
      if (h.bag[41] !== it || nopes() !== n0 + 1 || !e || e.s !== TXT('sim_ui.inv.same')) out.push('pouch: a piece dropped on its own pouch\'s tab is not refused with a word'); cl(inv().r, 'btab:0'); }
    { const V = spawn(0, { meta: { up: { pouch: 1 } } }); V.run = newRun(V, 'campaign', 78, { town: 1 }); V.screen = 'stash'; const Hh = V.run.hero, T2 = stashOf(V), g = Object.assign(rollItem(V.run, 3, 2), { id: V.run.nextId++ });
      T2.items = [g]; const U2 = UI.stash(Hh.bag.length, 0), a = U2.r.find((q) => q.id === 'stash:0'), b = U2.r.find((q) => q.id === 'btab:1');
      step(V, { keys: [], px: a.x + 10, py: a.y + 10, click: 1, press: 1 }); step(V, { keys: [], px: b.x + 10, py: b.y + 10, press: 1 }); step(V, { keys: [], px: b.x + 10, py: b.y + 10 });
      if (T2.items[0] || !Hh.bag.slice(24).some((q) => q && q.b === g.b && q.lvl === g.lvl)) out.push('pouch: a piece dragged from the chest onto a tab does not go into that pouch'); }
    { const old = JSON.parse(JSON.stringify(R)); old.hero.bag = new Array(24).fill(null); old.hero.bag[20] = Object.assign(rollItem(R, 3, 1), { id: 9800 }); old.hero.cap = 15;
      const T = spawn(0, { meta: { shards: 5, up: { bag: 3, hp: 1 } }, run: old });
      if (T.meta.up.pouch !== 2 || T.meta.up.bag !== undefined || T.meta.up.hp !== 1) out.push('pouch: the 1340 bag ranks do not become pouches');
      if (!T.saved || T.saved.hero.bag.length !== 24 + 2 * D.BAG.pouch || !T.saved.hero.bag[20] || T.saved.hero.bag[20].id !== 9800) out.push('pouch: an old save does not get its pouches or loses a piece'); }
    return out;
  }
  // TASKS 1012: E at the storage chest opens it (and at the altar beside it still the altar); a click lays gear in, not a potion;
  // one cell till «Сундук предков» adds more; a drag lands on the cell under the pointer; the stash outlives the run and the save,
  // the next hero takes the piece with an id of his own; a stash from an older item balance is re-powered
  function stashCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, sv = R.map.town.svc, U = UI.stash();
    const at = (id, o = {}) => { const b = U.r.find((q) => q.id === id); return Object.assign({ keys: [], px: b.x + 10, py: b.y + 10 }, o); };
    const clickOn = (id) => { step(S, at(id, { click: 1 })); step(S, at(id)); };
    h.x = sv.altar.x; h.y = sv.altar.y + 40; step(S, { keys: ['KeyE'] }); if (S.screen !== 'meta') out.push('stash: the altar beside the chest no longer answers'); S.screen = 'play';
    h.x = sv.stash.x; h.y = sv.stash.y + 40; step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); if (S.screen !== 'stash') { out.push('stash: E at the chest does not open it'); return out; }
    const g1 = rollItem(R, 6, 2), g2 = rollItem(R, 6, 2); g1.id = R.nextId++; g2.id = R.nextId++; h.bag[3] = g1; h.bag[4] = g2;
    { const p = h.bag[0]; clickOn('bag:0'); if (h.bag[0] || S.meta.stash.items[0] !== p) out.push('stash: a potion does not go into the chest'); clickOn('stash:0'); if (S.meta.stash.items[0]) out.push('stash: a potion does not come back out'); }
    if (D.STASH.cells !== 24) out.push('stash: the chest is not 24 cells');
    clickOn('bag:3'); if (h.bag[3] || S.meta.stash.items[0] !== g1) out.push('stash: a click does not lay gear in');
    step(S, at('bag:4', { click: 1, press: 1 })); step(S, at('stash:1', { press: 1 })); step(S, at('stash:1'));
    if (h.bag[4] || S.meta.stash.items[1] !== g2) out.push('stash: a drag does not land on the cell under the pointer');
    step(S, at('stash:0', { click: 1, press: 1 })); step(S, at('bag:9', { press: 1 })); step(S, at('bag:9'));
    if (h.bag[9] !== g1 || S.meta.stash.items[0]) out.push('stash: a drag out does not land on the bag cell under the pointer');
    clickOn('bag:9'); step(S, { keys: ['Escape'] }); if (S.screen !== 'play') out.push('stash: Esc does not close the chest');
    const P = JSON.parse(JSON.stringify(persist(S))), T = spawn(1, P); if (JSON.stringify(P.meta.stash).length > 4000) out.push('stash: the chest bloats the save');
    T.meta.stash.v = 0; T.run = newRun(T, 'campaign', 78, { town: 1, allFree: 1 }); T.screen = 'play'; const Q = T.run; Q.hero.x = sv.stash.x; Q.hero.y = sv.stash.y + 40; step(T, { keys: [] }); step(T, { keys: ['KeyE'] });
    if (T.meta.stash.v !== D.ITEM_BAL.version || T.meta.stash.items.filter(Boolean).length !== 2) out.push('stash: the chest does not outlive the run or is not brought to the item balance');
    const b0 = U.r.find((q) => q.id === 'stash:0'); step(T, { keys: [], click: 1, px: b0.x + 10, py: b0.y + 10 }); step(T, { keys: [], px: b0.x + 10, py: b0.y + 10 });
    const got = Q.hero.bag.find((it) => it && it.b === g1.b && it.lvl === g1.lvl && !isCons(it)); if (!got || got.id < Q.nextId - 1 || T.meta.stash.items[0]) out.push('stash: the next hero does not take the piece out with an id of his own');
    return out;
  }
  const SIM_STAT = { str: 'atk', vit: 'maxHp', hp: 'maxHp', mp: 'maxMp', atk: 'atk', def: 'def', crit: 'crit', aspd: 'aspd', dodge: 'dodge', regen: 'regen', onhit: 'onhit' };
  // TASKS 1013: E at the anvil opens the smith's reforging, at the lectern the enchanter's enchanting; a reforge re-rolls a piece's
  // own affixes for gold (not a common piece's, which has none), keeps its enchantments; the first enchantment never fails and
  // reaches the hero's stats; a failed one takes everything off the piece; a sixth is refused;
  // each is paid in gold and shards
  function craftCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, sv = R.map.town.svc, U = UI.craft(); noQuests(R);
    const click = (id) => { const b = U.r.find((q) => q.id === id); step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 }); };
    const throughTalk = () => { for (let i = 0; i < 12 && S.screen === 'talk'; i++) step(S, { keys: ['KeyE'] }); };
    h.x = sv.anvil.x; h.y = sv.anvil.y + 30; step(S, { keys: ['KeyE'] }); throughTalk(); if (S.screen !== 'craft' || S.craft.kind !== 'forge') { out.push('craft: E through the smith\'s talk does not open his workshop'); return out; }
    const it = Object.assign(rollItem(R, 6, 2, 'ring'), { id: R.nextId++, rar: 3 }); it.mods = {}; rollAffixes(R, it); h.bag[5] = it; h.gold = 100000;
    click('bag:0'); if (S.craft.sel) out.push('craft: a potion is chosen for the workshop');
    click('bag:5'); const m0 = JSON.stringify(it.mods), g0 = h.gold; it.ench = [{ k: 'str', v: 3 }]; click('do');
    if (h.gold >= g0 || JSON.stringify(it.mods) === m0 || Object.keys(it.mods).length !== RARITY[it.rar].affixes || it.ench.length !== 1) out.push('craft: a reforge does not re-roll the affixes for gold, or loses the enchantment');
    h.eq.weapon.rar = 0; h.eq.weapon.mods = {}; click('eq:weapon'); const g1 = h.gold; click('do'); if (h.gold !== g1) out.push('craft: a common piece is reforged');
    step(S, { keys: ['Escape'] }); if (S.screen !== 'play') out.push('craft: Esc does not leave the workshop');
    h.x = sv.lectern.x; h.y = sv.lectern.y + 30; step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); throughTalk(); if (S.screen !== 'craft' || S.craft.kind !== 'enchant') { out.push('craft: E through the enchanter\'s talk does not open her workshop'); return out; }
    it.ench = []; h.eq.ring = it; h.bag[5] = null; S.meta.shards = 1000; click('eq:ring'); const st0 = heroSt(S), sh0 = S.meta.shards; click('do');
    if (it.ench.length !== 1 || S.meta.shards !== sh0 - D.CRAFT.ench.shards[0]) out.push('craft: the first enchantment fails or is not paid in shards');
    else { const e = it.ench[0], st1 = heroSt(S), was = SIM_STAT[e.k]; if (was && st1[was] <= st0[was] && !(was === 'aspd' && st0.aspd >= st0.aspdMax)) out.push(`craft: the enchantment (${e.k}) does not reach the hero`); }
    // TASKS 1618: a failure is rare and takes everything off the piece, its own affixes too
    if (D.CRAFT.ench.max !== 5 || D.CRAFT.ench.fail.join() !== '0,0.01,0.02,0.05,0.1') out.push('craft: the enchantment is not 5 steps at 0, 1, 2, 5, 10 %');
    { const was = D.CRAFT.ench.fail; D.CRAFT.ench.fail = [1, 1, 1, 1, 1]; it.ench = [{ k: 'atk', v: 1 }]; rollAffixes(R, it); click('do'); D.CRAFT.ench.fail = was;
      if (!S.craft.res || S.craft.res.ok || it.ench.length || Object.keys(it.mods).length) out.push('craft: a failure does not take everything off the piece'); rollAffixes(R, it); }
    it.ench = D.AFFIXES.slice(0, 5).map((a) => ({ k: a.k, v: 1 })); const g2 = h.gold; click('do'); if (it.ench.length !== 5 || h.gold !== g2) out.push('craft: a fourth enchantment is laid on');
    return out;
  }
  // TASKS 1331, 1671: the bag is 24 cells with no altar upgrade, a hero from a save that had the 12-cell cap fills them all; a drag moves a piece
  // between cells, a click on the piece's own cell still uses it; the sort buttons order the cells and pack them to the front; the chest sorts too
  // TASKS 1349: ranks stop at AB_MAX, the points past every full rank turn into mastery and leave nothing in h.sp, a hero with a rank to
  // buy keeps his points, a save without the field loads as no mastery, and the rank-15 numbers stay sane
  function masteryCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 88); S.screen = 'inv'; const R = S.run, h = R.hero, abs = D.clsOf(h).abs, U = UI.inv(abs);
    const click = (id) => { const b = U.r.find((q) => q.id === id); for (const o of [{ click: 1 }, {}]) step(S, Object.assign({ keys: [], px: b.x + 10, py: b.y + 10 }, o)); };
    if (D.AB_MAX !== 15) out.push('mastery: the rank ceiling is not 15');
    h.lvl = 60; h.forks = {}; for (const a of abs) for (const r of D.FORK_RANKS) h.forks[D.forkKey(a.id, r)] = 0; const A = abs[0]; h.ab[A.id] = D.AB_MAX; h.sp = 1; click('ab:' + A.id); if (h.ab[A.id] !== D.AB_MAX) out.push('mastery: a rank went past the ceiling');
    if (h.sp !== 1 || h.mast) out.push('mastery: a point was taken while other ranks are open');
    for (const a of abs) h.ab[a.id] = D.AB_MAX; const st0 = stats(h, S.meta); h.ab[abs[2].id] = D.AB_MAX - 1; h.sp = 2; click('ab:' + abs[2].id);
    if (h.ab[abs[2].id] !== D.AB_MAX || h.sp !== 0 || h.mast !== 1) out.push(`mastery: the last rank left sp ${h.sp}, mastery ${h.mast}`);
    h.sp = 0; SIMX.gainXp(S, R, D.xpNeed(h.lvl) / 0.5); if (h.sp !== 0 || !(h.mast > 1)) out.push(`mastery: a level past the ceiling left sp ${h.sp}, mastery ${h.mast}`);
    h.mast = 40; h.lvl = 60; const st = stats(h, S.meta), lim = 1.21;
    if (!(st.atk > st0.atk) || !(st.maxHp > st0.maxHp) || st.atk > st0.atk * lim + 1 || st.maxHp > st0.maxHp * lim + 1) out.push(`mastery: 40 points turn atk ${st0.atk} into ${st.atk}, hp ${st0.maxHp} into ${st.maxHp}`);
    const old = JSON.parse(JSON.stringify(R)); delete old.hero.mast; old.hero.ab = Object.fromEntries(abs.map((a) => [a.id, 10])); old.hero.sp = 3;
    const T = spawn(1, JSON.parse(JSON.stringify(persist(Object.assign(spawn(0, {}), { run: old })))));
    if (!T.saved || T.saved.hero.sp !== 3 || T.saved.hero.mast) out.push('mastery: an old save at the old ceiling lost its points or gained mastery');
    for (const id of ['whirl', 'frost', 'cry', 'fireball', 'shield', 'volley']) { const a = D.abRank(id, 10), b = D.abRank(id, 15); if (!(b.cd >= 0.5) || b.cd > a.cd || (id !== 'cry' && !(b.k > a.k)) || (a.r && b.r !== a.r)) out.push(`mastery: ${id} at rank 15 is off`); }
    { const a = D.abRank('cry', 15); if (!(a.t < D.ABILITIES.find((q) => q.id === 'cry').cd * a.cd)) out.push('mastery: the cry at rank 15 outlasts its cooldown'); }
    return out;
  }
  SIMX.checks.add('lootLevelCheck', lootLevelCheck);
  SIMX.checks.add('potionCheck', potionCheck);
  SIMX.checks.add('bagCheck', bagCheck);
  SIMX.checks.add('pouchCheck', pouchCheck);
  SIMX.checks.add('stashCheck', stashCheck);
  SIMX.checks.add('craftCheck', craftCheck);
  SIMX.checks.add('masteryCheck', masteryCheck);
  SIMX.checks.add('levelCheck', levelCheck);
})(typeof window !== 'undefined' ? window : globalThis);
