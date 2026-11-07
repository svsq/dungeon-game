// live/sim.js — deterministic dungeon-crawler simulation, fixed 120 Hz. Contract: create / step / at / spawn / respawn /
// outOfPlay / scriptInput (engine.md §6). Everything that happens lives here: menus, the run (procedural floors), the hero
// (stats, gear, abilities, levelling), monsters (FSM + flow-field chase), loot, traps, saves (S.saveN asks index.html to
// persist S.meta and the run), camera, and the event bus S.ev that drives every FX in the scene.
(function (root) {
  const D = root.DATA || require('./data.js'), DG = root.DUNGEON || require('./dungeon.js');
  const { TILE, ENEMIES, BAL, ELITE, eliteK, windOf, under, ELITE_MODS, BASES, CONSUMABLES, RARITY, AFFIXES, ABILITIES, META, UI } = D;
  const DT = 1 / 120, L = 26.0;
  // VIEW is the screen (the pointer comes in its px); WIN the world window the camera shows on it, zoomed
  // the zoom lives on the run (R.zoom, copied from the player's setting every step) so camera and pointer follow a change at once
  const VIEW = { W: 1920, H: 1080 }, zoomOf = (R) => (R && R.zoom) || D.ZOOM || 1, WIN = (R) => ({ W: VIEW.W / zoomOf(R), H: VIEW.H / zoomOf(R) }),
    toPx = (R, x, y) => ({ px: (x - R.cam[0]) * zoomOf(R), py: (y - R.cam[1]) * zoomOf(R) });
  const nextZoom = (S) => { const o = D.ZOOMS, z = S.meta.zoom || D.ZOOM; S.meta.zoom = o[(o.indexOf(z) + 1) % o.length]; S.saveN++; };
  const HINT = 'WASD — движение · ЛКМ — атака · 1 2 3 — способности · Пробел — рывок · Q/R — зелья · E — действие · I — герой · Esc — пауза';
  const K = { HIT: 0.13, RUN: 175, ACC: 1900, DEC: 2300, DASH: 640, DASH_T: 0.16, DASH_CD: 0.75, LEAP: 0.14, R: 12, STEP: 20 };
  const DEMO_SEED = 4247;
  const EEL_MOUTH = [44, 56];   // where the eel's mouth is when it is up: ahead of it and over the water (view px; the scene draws it there)

  // ---------------- rng (state lives in the run: deterministic replay) ----------------
  const rnd = (R) => { R.rs = (R.rs + 0x6d2b79f5) | 0; let t = Math.imul(R.rs ^ (R.rs >>> 15), 1 | R.rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (R, a, b) => a + Math.floor(rnd(R) * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(rnd(R) * arr.length)];
  const ev = (S, e) => { e.t = S.t; S.ev.push(e); if (S.run && S.run.quests && QUEST_EV.has(e.k)) questOn(S, S.run, e); if (S.run && e.k === 'hurt') S.run.recentDamage = (S.run.recentDamage || []).concat({ t: e.t, src: e.src, n: e.n, actor: e.actor || null }).slice(-3);
    if (S.run && e.k === 'boom') S.run.scorches = (S.run.scorches || []).filter((s) => S.t - s.t < 4).concat({ ...e }).slice(-24); if (S.run && S.run.log && !S.demo) note(S, e); };
  // hard's extra damage and HP ramp in over floors 1-3: ×1.3 × ×1.25 from the first room killed a third of average players there (TASKS 200)
  // the run's description (data.js RUNS) and how deep a floor of it is in campaign floors: everything that grows as floors climb
  // reads the depth, the run's own floor numbers only place its bosses, guards and end
  // the endless descent's first floor: past the serpent it goes on from the 13th (TASKS 386)
  const FROM = (R) => (R.campaignWon ? D.RUNS.campaign.floors + 1 : 1);
  // what the stairs say before a floor's boss is beaten: its chapter's own words (TASKS 416), the run's for its own floors
  const sealOf = (R) => { const N = D.stageOf(R.mode, R.floor, R.seed, FROM(R)).N; return (N && N !== RUN(R) && N.seal) || RUN(R).seal; };
  const RUN = (R) => D.runOf(R.mode), STAGE = (R, f = R.floor) => D.stageOf(R.mode, f || 1, R.seed, FROM(R)), dep = (R, f = R.floor) => STAGE(R, f).depth, lastFloor = (R) => R.floor === RUN(R).floors;
  const dif = (R, k) => { const v = (D.DIFF[R.diff] || D.DIFF.normal)[k]; return v > 1 && (k === 'dmg' || k === 'hp') ? 1 + (v - 1) * Math.min(1, dep(R) / 3) : v; };
  const who = (e) => e ? e.type + (e.elite && !D.BOSSES[e.type] ? ' (элита)' : '') : '?';
  // the run's log for balance analysis (index.html downloads it when the run ends): one record per floor, filled from the events
  const logFloor = (R) => R.log.fl[R.log.fl.length - 1];
  const add = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  const potCount = (h) => { const n = {}; for (const it of h.bag) if (it && /potion/.test(it.b)) add(n, it.b, it.n || 1); return n; };
  function note(S, e) { const R = S.run, L = logFloor(R); if (!L) return;
    if (e.k === 'hurt') { add(L.dmg, e.src, e.n); add(L.hits, e.src); R.log.last = e.src;
      const tail = R.log.tail = R.log.tail || []; tail.push([+e.t.toFixed(2), e.src, e.n, Math.round(R.hero.hp)]); if (tail.length > 12) tail.shift(); }   // the blows before a death
    else if (e.k === 'drink') add(L.pot, e.b);
    else if (e.k === 'kill') add(L.kills, who(R.en.find((o) => o.id === e.id) || { type: e.type }));
    else if (e.k === 'lvl') L.lvl = e.lvl;
    else if (e.k === 'gold') L.gold += e.n || 0;
    else if (e.k === 'shard') add(L, 'shards', e.n);
    else if (e.k === 'trade') { if (e.n < 0) { L.buy -= e.n; L.buys.push(e.s); } else L.sell += e.n; }
    else if (e.k === 'cast' || e.k === 'whirl' || e.k === 'shield') add(L.ab, e.k === 'cast' ? 'fireball' : e.k);
    if (e.k === 'equip' || e.k === 'unequip') { const st = heroSt(S); (L.gear = L.gear || []).push({ t: +e.t.toFixed(2), slot: e.slot, on: e.on || null, off: e.off || null, maxHp: st.maxHp, def: st.def, atk: st.atk }); }
    if (e.k === 'bless') { const st = heroSt(S); (L.gifts = L.gifts || []).push(e.cost == null ? { t: +e.t.toFixed(2), id: e.id, revive: 1 } : { t: +e.t.toFixed(2), id: e.id, name: e.s, cost: e.cost, maxHp: st.maxHp, def: st.def, atk: st.atk }); } }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  // ---------------- items ----------------
  function itemPower(it) {
    const B = BASES[it.b], bal = D.ITEM_BAL, mult = bal.rarity[it.rar];
    if (B.atk) it.atk = Math.round(B.atk * (1 + bal.atkLevel * (it.lvl - 1)) * mult);
    if (B.def) it.def = Math.round(B.def * (1 + bal.defLevel * (it.lvl - 1)) * mult);
    return it;
  }
  function typeMods(it) {
    const out = {}, typed = (BASES[it.b] && BASES[it.b].typed) || {};
    for (const k in typed) { const A = AFFIXES.find((a) => a.k === k); out[k] = Math.max(1, Math.round((A.a + A.b * it.lvl) * typed[k] * (1 + 0.15 * it.rar))); }
    return out;
  }
  function itemMods(it) {
    const mods = typeMods(it);
    for (const k in it.mods) mods[k] = (mods[k] || 0) + it.mods[k];
    for (const e of it.ench || []) mods[e.k] = (mods[e.k] || 0) + e.v;
    return mods;
  }
  function rebalanceRun(R) {
    if (!R || R.itemBalance === D.ITEM_BAL.version) return;
    const items = Object.values(R.hero.eq).concat(R.hero.bag, (R.drops || []).map((d) => d.item),
      R.shop ? R.shop.goods.concat(R.shop.back).map((g) => g.it) : []);
    for (const it of items) if (it && BASES[it.b]) itemPower(it);
    R.itemBalance = D.ITEM_BAL.version;
  }
  function rollItem(R, floor, q = 0, slotOnly, o = {}) {
    const lo = o.min || 0, hi = o.max ?? 4, w = [60, 26, 10, 3.5, 0.5].map((v, i) => (i < lo || i > hi ? 0 : v * (i ? Math.pow(1 + 0.22 * floor + 0.6 * q, i * 0.9) : 1)));
    let s = w.reduce((a, b) => a + b, 0) * rnd(R), rar = lo; while (rar < hi && (s -= w[rar]) > 0) rar++;
    const keys = Object.keys(BASES).filter((k) => (!BASES[k].minF || floor >= BASES[k].minF) && (!slotOnly || BASES[k].slot === slotOnly));
    let s2 = keys.reduce((a, k) => a + (BASES[k].w ?? 1), 0) * rnd(R), bk = keys[keys.length - 1];
    for (const k of keys) if ((s2 -= BASES[k].w ?? 1) < 0) { bk = k; break; }
    return rollAffixes(R, itemPower({ id: 0, b: bk, rar, lvl: floor + (R.mode ? RUN(R).loot || 0 : 0), mods: {} }));
  }
  function rollAffixes(R, it) {
    const pool = AFFIXES.slice(); for (let i = 0; i < RARITY[it.rar].affixes && pool.length; i++) { const a = pool.splice(Math.floor(rnd(R) * pool.length), 1)[0];
      it.mods[a.k] = Math.max(1, Math.round((a.a + a.b * it.lvl) * (0.7 + 0.6 * rnd(R)) * (1 + 0.15 * it.rar))); }
    return it;
  }
  const potion = (b, n = 1) => ({ id: 0, b, n, rar: 0, lvl: 1, mods: {} });
  const isCons = (it) => !!CONSUMABLES[it.b];
  const itemName = (it) => (isCons(it) ? CONSUMABLES[it.b].name : it.rar === 4 ? (D.LEGEND_NAMES[it.b] || D.LEGEND_NAMES[BASES[it.b].slot]) : BASES[it.b].name);
  const gearName = (it) => it ? `${itemName(it)} (${RARITY[it.rar].name}, ур. ${it.lvl})` : null;
  const itemIcon = (it) => (isCons(it) ? CONSUMABLES[it.b].icon : BASES[it.b].icon);

  // the good gear comes from the strong: common monsters drop little and never a legendary; elites, the exit room's brute and
  // the boss drop better; a chest's roll is open, but a secret room's chest rolls with a far higher epic/legendary chance
  const LOOT = {
    mob: { p: 0.07, q: 0, max: 3 },
    elite: { q: 1.6, min: 1 },
    brute: { q: 2.5, min: 2, extra: 0.5 },
    boss: [{ q: 3, min: 4 }, { q: 3, min: 3 }, { q: 3, min: 2 }],
    chest: [null, { q: 0.4, n: 1 }, { q: 1, n: 2 }, { q: 3, n: 1 }],
  };

  // ---------------- hero stats (base + gear + meta + the altars' gifts) ----------------
  const GIFT_V = Object.assign({ greed: 25 }, Object.fromEntries(D.GIFTS.map((g) => [g.id, g.v])));
  const gift = (h, id) => ((h.perks || {})[id] || 0) * GIFT_V[id];
  function stats(h, meta) {
    const s = { str: h.base.str, agi: h.base.agi, int: h.base.int, vit: h.base.vit, atk: 0, def: 0, crit: 0, hp: 0, mp: 0, aspd: 0, mspd: 0, leech: 0, fire: 0, regen: 0, onhit: 0, dodge: 0 };
    let wpn = null;
    for (const k in h.eq) { const it = h.eq[k]; if (!it) continue; if (k === 'weapon') wpn = it; s.def += it.def || 0; const mods = itemMods(it); for (const m in mods) s[m] = (s[m] || 0) + mods[m]; }
    const up = (meta && meta.up) || {}, W = wpn ? BASES[wpn.b] : { atk: 3, spd: 0.45, arc: 110, reach: 51 };
    const out = {
      str: s.str, agi: s.agi, int: s.int, vit: s.vit,
      maxHp: Math.round(80 + s.vit * 10 + (h.lvl - 1) * 6 + s.hp + 12 * (up.hp || 0) + gift(h, 'vigor')),
      maxMp: Math.round(40 + s.int * 6 + (h.lvl - 1) * 2 + s.mp + 10 * (up.mana || 0) + gift(h, 'wisdom')),
      atk: Math.round(((wpn ? wpn.atk : 3) + s.str * 1.6 + s.atk + (W.spell ? s.int * 0.8 : 0)) * (1 + 0.06 * (up.dmg || 0)) * (1 + gift(h, 'fury') / 100)),
      def: Math.round(s.def + s.vit * 0.3 + gift(h, 'ward')),
      crit: Math.min(60, 5 + s.agi * 0.5 + s.crit + gift(h, 'crit')), dodge: Math.min(BAL.dodge.cap, s.agi * BAL.dodge.agi + s.dodge + gift(h, 'alert')),
      aspd: s.agi * 1.2 + s.aspd + gift(h, 'haste'), mspd: Math.min(40, s.agi * 0.4 + s.mspd + gift(h, 'swift')), leech: s.leech + gift(h, 'leech'),
      regen: s.regen + 0.5 * (up.regen || 0) + gift(h, 'life'), onhit: s.onhit,
      spellBase: (wpn ? wpn.atk : 3) + s.int * 1.6, spell: 1 + (W.spell || 0) + s.fire / 100 + 0.06 * (up.dmg || 0) + gift(h, 'fury') / 100 + gift(h, 'arcane') / 100,
      resist: 1 - 0.15 * (up.resist || 0), gold: 1 + gift(h, 'greed') / 100,
      wcd: W.spd, arc: W.arc + gift(h, 'cleave'), reach: W.reach * (1 + gift(h, 'reach') / 100), kb: W.kb || 1, wtype: wpn ? wpn.b : 'fist',
    };
    return out;
  }

  // ---------------- run & floor ----------------
  function newHero(meta) {
    const up = meta.up || {};
    const h = { x: 0, y: 0, vx: 0, vy: 0, face: 1, faceT: -9, back: 0, backT: -9, aim: 0, hp: 1, mp: 1, lvl: 1, xp: 0, pts: 2 * (up.stat || 0), sp: up.skill || 0, perks: {},
      base: { str: 5, agi: 4, int: 3, vit: 5 }, gold: 0, eq: {}, bag: new Array(24).fill(null), ab: { whirl: 1, fireball: 0, shield: 0 },
      cd: { whirl: 0, fireball: 0, shield: 0, dash: 0, atk: 0 }, atkT: -9, atkA: 0, patkT: -9, patkA: 0, atkHit: 0, atkN: 0, castT: -9, castK: '', whirlT: -9, dashT: -9, dashX: 0, dashY: 0,
      hurtT: -9, ifr: 0, shield: 0, shieldT: -9, shieldUntil: 0, poison: 0, burn: 0, burnT: -9, spikeT: -9, dist: 0, gp: 0, deadT: -1, regen: 0, bless: 0 };
    for (const k of D.SLOTS) h.eq[k] = null;
    return h;
  }
  function newRun(S, mode, seed, o = {}) {
    const R = { mode, seed, diff: S.demo ? 'normal' : S.meta.diff || 'normal', itemBalance: D.ITEM_BAL.version, rs: seed | 0, floor: 1, t: 0, nextId: 1, kills: 0, goldTot: 0, shards: 0, hero: newHero(S.meta), cam: [0, 0], camV: [0, 0],
      freeze: 0, trauma: 0, map: null, en: [], proj: [], drops: [], chests: [], pots: [], shrines: [], seen: [], rseen: [], bossDead: 0, won: 0, saveT: 0, msg: null };
    if (!S.demo) R.log = { v: 1, diff: R.diff, seed, meta: Object.assign({}, S.meta.up), runs: S.meta.runs || 0, fl: [] };
    const h = R.hero;
    const give = (it) => { it.id = R.nextId++; return it; };
    h.eq.weapon = give(Object.assign(rollItem(R, 1, 0, 'weapon'), { b: 'sword', rar: 0, mods: {}, atk: BASES.sword.atk }));
    h.eq.armor = give({ b: 'leather_armor', rar: 0, lvl: 1, mods: {}, def: BASES.leather_armor.def });
    const gr = (S.meta.up || {}).gear || 0; if (gr) for (const it of [h.eq.weapon, h.eq.armor]) { it.rar = gr; rollAffixes(R, itemPower(it)); }
    h.bag[0] = give(potion('hp_potion', BAL.startHpPot + ((S.meta.up || {}).potion || 0))); h.bag[1] = give(potion('mp_potion', 1));
    // a run that starts deeper hands the hero its levels as points to lay out and its kit (data.js RUNS)
    const N = RUN(R); if (N.lvl > 1) { h.lvl = N.lvl; h.pts += 3 * (N.lvl - 1); h.sp += N.lvl - 1; for (const a of ABILITIES) if (a.unlock <= h.lvl) h.ab[a.id] = Math.max(1, h.ab[a.id] || 0); }
    if (N.kit) { const K = N.kit; for (const [b, rar] of K.gear) h.eq[BASES[b].slot] = give(rollAffixes(R, itemPower({ id: 0, b, rar: Math.max(rar, gr), lvl: K.lvl, mods: {} })));
      h.bag[0].n += K.hp - BAL.startHpPot; h.bag[1].n = K.mp; h.gold = K.gold; }
    const st = stats(h, S.meta); h.hp = st.maxHp; h.mp = st.maxMp;
    if (o.town) { R.viaTown = 1; h.bag[2] = give(potion('scroll', D.SHOP.townStart.scroll)); }
    enterFloor(S, R, o.town ? 0 : 1);
    return R;
  }
  // ---------------- elite powers ----------------
  const MOD = Object.fromEntries(ELITE_MODS.map((m) => [m.id, m])), has = (e, id) => !!(e.mods && e.mods.includes(id));
  function rollMods(R, f, e) { const [a, b] = D.eliteMods(f), n = a + (b > a && rnd(R) < 0.5 ? 1 : 0), pool = D.modPool(R.mode, R.floor, ENEMIES[e.type].kind), out = [];
    while (out.length < n) out.push(pool.splice(Math.floor(rnd(R) * pool.length), 1)[0]); return out; }
  // what an elite's powers add to a blow of its that landed on the hero
  function struck(S, R, e) {
    const h = R.hero; if (!e || h.hurtT !== S.t) return;
    if (e.type === 'boss_serpent') { e.hitDone = 1; e.openUntil = 0; }
    // thorns: a share of a blow taken at close quarters goes back into whoever struck it (not into a caster's bolt)
    if (gift(h, 'thorns') && e.deadT < 0 && Math.hypot(e.x - h.x, e.y - h.y) < 150) hitEnemy(S, R, e, Math.max(1, Math.round(h.lastHit * gift(h, 'thorns') / 100)), 0, h.x, h.y, 0, 'thorns');
    if (!e.mods) return;
    if (has(e, 'fiery')) { if (h.burn <= S.t) h.burnT = S.t - 0.5; h.burn = Math.max(h.burn, S.t + MOD.fiery.burn); }   // a fresh blow only extends the fire, the ticks keep their pace
    if (has(e, 'frost')) { h.chillT = S.t + MOD.frost.t; ev(S, { k: 'chill', x: h.x, y: h.y - 40, id: e.id }); }
    if (has(e, 'curse')) { h.curseT = S.t + MOD.curse.t; ev(S, { k: 'curse', x: h.x, y: h.y - 40, id: e.id }); }
    if (has(e, 'vampire') && e.deadT < 0) { const n = Math.round(e.max * MOD.vampire.heal); e.hp = Math.min(e.max, e.hp + n);
      ev(S, { k: 'drain', x: h.x, y: h.y - 40, tx: e.x, ty: e.y - ENEMIES[e.type].h * 0.5, n, id: e.id }); }
  }
  // plain skeletons of the floor's strength around a summoner, never more than its cap of its own alive at once
  function raise(S, R, e) { const M = MOD.summoner, sk = ENEMIES.skeleton, f = dep(R), own = R.en.filter((o) => o.summ === e.id && o.deadT < 0).length;
    for (let i = 0; i < Math.min(M.n, M.cap - own); i++) { const a = rnd(R) * 6.28, x = e.x + Math.cos(a) * 70, y = e.y + Math.sin(a) * 50; if (solidAt(R.map, x, y, true)) continue;
      const hp = Math.round(sk.hp * BAL.hp * dif(R, 'hp') * D.hpAt(f));
      R.en.push({ id: R.nextId++, type: 'skeleton', x, y, vx: 0, vy: 0, hp, max: hp, dmg: sk.dmg * BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob, elite: 0, room: e.room, st: 'chase', t0: S.t, face: 1, aimA: 0,
        cdT: S.t + 1, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: e.id, spawnT: S.t, seenT: S.t });
      ev(S, { k: 'summon', x, y }); } }
  // a blinking elite (TASKS 387): to the hero's side facing it, onto open floor, with a puff where it left and where it lands
  function blink(S, R, e) { const M = MOD.blink, h = R.hero, E = ENEMIES[e.type], d = Math.hypot(h.x - e.x, h.y - e.y);
    if (d < M.min || d > M.max || !losClear(R.map, e.x, e.y - 10, h.x, h.y - 10)) return false;
    const a0 = Math.atan2(e.y - h.y, e.x - h.x);
    for (const da of [0, 0.6, -0.6, 1.2, -1.2]) { const x = h.x + Math.cos(a0 + da) * M.gap, y = h.y + Math.sin(a0 + da) * M.gap;
      if (boxHit(R.map, x, y, E.r, true, false) || !losClear(R.map, x, y - 10, h.x, h.y - 10)) continue;
      ev(S, { k: 'blink', x: e.x, y: e.y, tx: x, ty: y, id: e.id }); e.x = x; e.y = y; e.vx = e.vy = 0; e.face = h.x >= x ? 1 : -1; e.cdT = Math.max(e.cdT, S.t + M.calm); return true; }
    return false; }
  // ---------------- the cave's monsters (TASKS 307, 308) ----------------
  function rise(S, R, e) { e.st = 'rise'; e.t0 = S.t; e.face = R.hero.x >= e.x ? 1 : -1; ev(S, { k: 'rise', x: e.x, y: e.y, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.15); }
  // the grab's reach plays whatever it meets; a hero inside its reach and arc is drawn a step toward the drowned (a dash slips it)
  function grab(S, R, e) {
    const E = ENEMIES[e.type], G0 = E.grab, h = R.hero, dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy) || 1; e.grabT = S.t + G0.cd;
    ev(S, { k: 'grab', x: e.x, y: e.y, a: e.aimA, id: e.id });
    if (h.deadT >= 0 || d > E.r + K.R + G0.reach + 12 || Math.abs(angDiff(Math.atan2(-dy, -dx), e.aimA)) > G0.arc || !losClear(R.map, e.x, e.y - 20, h.x, h.y - 20)) return;
    if (S.t - h.dashT < BAL.dodge.t) { ev(S, { k: 'dodge', x: h.x, y: h.y, dash: 1 }); return; }
    const n = Math.min(G0.pull, d - (E.r + K.R + 4)); if (n <= 0) return;
    h.pull = { x: dx / d, y: dy / d, n, T: G0.t, done: 0 }; e.gotT = S.t; ev(S, { k: 'grabbed', x: h.x, y: h.y - 30, id: e.id });
  }
  // a hop lands against where the hero stood at take-off (body to body), no farther than its reach, eased out of the squat and into the landing
  // (the render's squash and stretch carry the jolt); the blow is on landing
  const SS01 = (q) => q * q * (3 - 2 * q);
  function takeOff(R, e, E) { const h = R.hero, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1, n = Math.max(0, Math.min(d - (E.r + K.R + 6), E.r + K.R + E.reach + 10));
    e.jx = e.x; e.jy = e.y; e.jtx = e.x + dx / d * n; e.jty = e.y + dy / d * n; e.aimA = Math.atan2(dy, dx); e.hitDone = 0; }
  function hop(S, R, e, E) { const u = S.t - e.t0, T = E.jump.t, h = R.hero;
    if (!e.hitDone) { const q = SS01(Math.min(1, u / T)), x = e.jx + (e.jtx - e.jx) * q, y = e.jy + (e.jty - e.jy) * q, ox = e.x, oy = e.y;
      move(R.map, e, x - e.x, y - e.y, E.r, true); e.vx = (e.jtx - e.jx) / T; e.vy = (e.jty - e.jy) / T; e.dist += Math.hypot(e.x - ox, e.y - oy);
      if (q >= 1) { e.hitDone = 1; e.vx = e.vy = 0; ev(S, { k: 'land', x: e.x, y: e.y, id: e.id, type: e.type });
        if (h.deadT < 0 && Math.hypot(h.x - e.x, h.y - e.y) < E.r + K.R + 8) { hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } } }
    else skid(R.map, e, E); }
  // a slime bursts in two small ones flung apart from the killing blow; they join the fight at once
  function split(S, R, e, E) { const f = dep(R), Es = ENEMIES[E.split], hp = Math.round(Es.hp * BAL.hp * dif(R, 'hp') * D.hpAt(f)), a0 = e.dieA ?? 0;
    for (const sd of [-1, 1]) { const a = a0 + sd * 1.1, x = e.x + Math.cos(a) * 8, y = e.y + Math.sin(a) * 6;
      R.en.push({ id: R.nextId++, type: E.split, x, y, vx: 0, vy: 0, hp, max: hp, dmg: Es.dmg * BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob, elite: 0, room: e.room, st: 'chase', t0: S.t, face: Math.cos(a) >= 0 ? 1 : -1, aimA: a,
        cdT: S.t + 0.9, hitT: -9, deadT: -1, dist: 0, kbx: Math.cos(a) * 200, kby: Math.sin(a) * 140, burn: 0, burnT: 0, summ: e.id, spawnT: S.t, seenT: S.t, hx: x, hy: y, ft: -9 }); }
    ev(S, { k: 'split', x: e.x, y: e.y, id: e.id }); }
  // the crab (TASKS 309) faces its own way, fa, turning toward what it wants at no more than E.turn rad/s; a blow from within the
  // armour's arc of its front is blunted. Before its first turn it faces the way its rig was mirrored
  const faOf = (e) => e.fa ?? (e.face > 0 ? 0 : Math.PI);
  // a heavy body: the turn gathers pace and eases out onto its mark (faV, rad/s), no snap into the full rate
  function crabTurn(e, E, a, k) { const f = faOf(e), top = E.turn * eliteK(e, 'spd') * k, d = angDiff(a, f), want = Math.max(-top, Math.min(top, d * 5)), acc = 8 * DT;
    e.faV = (e.faV || 0) + Math.max(-acc, Math.min(acc, want - (e.faV || 0))); e.fa = angDiff(f + e.faV * DT, 0); e.face = Math.cos(e.fa) >= 0 ? 1 : -1; }
  const armored = (e, E, x, y) => !!E.armor && Math.hypot(x - e.x, y - e.y) > 1 && Math.abs(angDiff(Math.atan2(y - e.y, x - e.x), faOf(e))) < E.armor.arc;
  // ---------------- the eel from the deep (TASKS 310) ----------------
  // its water: the deep cells (6) joined to its post's, cached per map (deep water never changes)
  const DEEPW = new WeakMap();
  function deepBody(m, e) { let c = DEEPW.get(m); if (!c) DEEPW.set(m, c = new Map()); const k0 = Math.floor(e.hy / TILE) * m.W + Math.floor(e.hx / TILE);
    let b = c.get(k0); if (b) return b; b = [];
    if (m.cells[k0] === 6) { const seen = new Set([k0]), q = [k0]; while (q.length) { const k = q.pop(); b.push(k); for (const dd of [1, -1, m.W, -m.W]) { const n = k + dd; if (m.cells[n] === 6 && !seen.has(n)) { seen.add(n); q.push(n); } } } }
    c.set(k0, b); return b; }
  // where it comes up: a cell of its water by the hero, in sight of him, `apart` cells from the last spot (or, with none so far
  // off, any other); within a bite if it can, else among the nearest from which the jet reaches him
  function eelSpot(R, e, E, apart = E.apart) { const m = R.map, h = R.hero, bite = E.r + K.R + E.reach - 8, close = [], far = [];
    for (const k of deepBody(m, e)) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE, d = Math.hypot(h.x - x, h.y - y);
      if (d < E.r + K.R + 10 || d > E.spit.reach - 20 || (e.lx !== undefined && Math.hypot(x - e.lx, y - e.ly) < apart * TILE) || !losClear(m, x, y - 10, h.x, h.y - 10)) continue;
      (d <= bite ? close : far).push([x, y, d]); }
    if (close.length) return close[Math.floor(rnd(R) * close.length)];
    far.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]); return far.length ? far[Math.floor(rnd(R) * Math.min(3, far.length))] : apart > 1 ? eelSpot(R, e, E, 1) : null; }
  // deep → stir (bubbles and its shadow where it will come up) → rise → chase (up, turning to the hero) ⇄ wind → strike → dive → deep
  function eel(S, R, e, E, heroOk, d) {
    const m = R.map, h = R.hero, t = S.t, u = t - e.t0, dx = h.x - e.x, dy = h.y - e.y; e.vx = e.vy = 0;
    const hunt = heroOk && Math.hypot(h.x - e.hx, h.y - e.hy) < E.sense + 6 * TILE;
    if (e.st === 'deep') { if (!hunt || t < e.cdT) return;
      const p = eelSpot(R, e, E); if (!p) return; e.x = p[0]; e.y = p[1]; e.st = 'stir'; e.t0 = t; e.face = h.x >= e.x ? 1 : -1; ev(S, { k: 'stir', x: e.x, y: e.y, id: e.id }); return; }
    if (e.st === 'stir') { if (u >= windOf(e, E.warn)) { rise(S, R, e); e.bit = 0; } return; }
    if (e.st === 'dive') { if (u >= E.dive) { e.st = 'deep'; e.t0 = t; e.lx = e.x; e.ly = e.y; e.cdT = t + E.swim[0] + (E.swim[1] - E.swim[0]) * rnd(R); } return; }
    const dive = () => { e.st = 'dive'; e.t0 = t; ev(S, { k: 'dive', x: e.x, y: e.y, id: e.id }); };
    if (e.st === 'rise') { if (u < E.rise) return; e.st = 'chase'; e.t0 = e.upT = t; e.cdT = Math.max(e.cdT, t + 0.15); return; }
    if (!heroOk) { if (e.st === 'chase') dive(); return; }
    if (e.st === 'chase') { if (Math.abs(dx) > 10) e.face = dx > 0 ? 1 : -1;
      if (e.bit >= E.bites || t - e.upT > E.stay) { dive(); return; }
      if (t < e.cdT) return;
      const near = d < E.r + K.R + E.reach, los = losClear(m, e.x, e.y - 30, h.x, h.y - 30);
      if (near || (d < E.spit.reach && los)) { e.st = 'wind'; e.t0 = t; e.spit = near ? 0 : 1; e.tx = h.x; e.ty = h.y; e.face = dx >= 0 ? 1 : -1; e.aimA = e.spit ? Math.atan2(h.y - 38 - (e.y - EEL_MOUTH[1]), h.x - e.x - e.face * EEL_MOUTH[0]) : Math.atan2(dy, dx); }
      return; }
    if (e.st === 'wind') { if (u < windOf(e, e.spit ? E.spit.wind : E.wind)) return; e.st = 'strike'; e.t0 = t; e.bit++;
      if (e.spit) { const a = e.aimA, v = E.spit.spd;
        R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: 'jet', x: e.x + e.face * EEL_MOUTH[0], y: e.y - EEL_MOUTH[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: t, life: (E.spit.reach + 40) / v, dmg: e.dmg * E.spit.dmg * eliteK(e, 'bolt'), own: 'en', r: 7, gz: EEL_MOUTH[1] - 20 });
        ev(S, { k: 'spit', x: e.x + e.face * EEL_MOUTH[0], y: e.y - EEL_MOUTH[1], a, id: e.id }); return; }
      if (d < E.r + K.R + E.reach * 1.25 && Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)) < 1.0) { hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); }
      ev(S, { k: 'bite', x: e.x + Math.cos(e.aimA) * (E.r + 26), y: e.y + Math.sin(e.aimA) * (E.r + 26) * 0.8, a: e.aimA, id: e.id }); return; }
    if (e.st === 'strike') { if (u < 0.4) return; e.st = 'chase'; e.t0 = t; e.cdT = t + E.cd * eliteK(e, 'cd') * (0.8 + 0.4 * rnd(R)); } }
  const SERPENT_MOUTH = [50, 92];
  const serpentMouth = (e) => [e.x + (e.face || 1) * SERPENT_MOUTH[0], e.y - SERPENT_MOUTH[1]];
  function serpentSurface(S, R, e) {
    const m = R.map, h = R.hero, old = e.pool ?? -1;
    let best = null;
    for (const [i, pool] of m.serpentPools.entries()) { if (i === old) continue;
      for (const k of pool) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE, d = Math.hypot(x - h.x, y - h.y);
        if (!best || d < best.d) best = { x, y, i, d }; } }
    if (!best) return;
    e.pool = best.i; e.x = best.x; e.y = best.y; e.face = h.x >= e.x ? 1 : -1; e.st = 'stir'; e.t0 = S.t; e.vx = e.vy = 0;
    ev(S, { k: 'stir', x: e.x, y: e.y, id: e.id });
  }
  // the shallows spread from the lakes over 1.6 s, the nearest shore first, so the flood has a front (TASKS 326)
  function floodStep(S, R) {
    const m = R.map, F = m.flood; if (!F || F.n >= F.cells.length) return;
    const n = Math.min(F.cells.length, 1 + Math.floor(F.cells.length * Math.min(1, (S.t - F.t0) / 1.6))); if (n === F.n) return;
    const add = F.cells.slice(F.n, n); F.n = n; m.water.push(...add); m.arenaWater.push(...add); WET.delete(m); m.geometry = (m.geometry || 0) + 1;
  }
  function serpentFlood(S, R, e) {
    const m = R.map, pools = m.serpentPools.flat(), near = (k) => Math.min(...pools.map((q) => Math.hypot(q % m.W - k % m.W, Math.floor(q / m.W) - Math.floor(k / m.W))));
    const cells = m.floodCells.filter((k) => m.cells[k] === 1 && !m.water.includes(k) && !m.block.includes(k)).map((k) => [near(k), k]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((q) => q[1]);
    m.arenaWater = []; m.flood = { cells, t0: S.t, n: 0 }; e.floodT = S.t;
    const r = m.rooms[e.room], sol = solids(R), E = ENEMIES.drowned, spots = [];
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const p = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
      if (Math.hypot(p.x - R.hero.x, p.y - R.hero.y) >= 80 && !boxHit(m, p.x, p.y, E.r, true, false) && !sol.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < E.r + o.r)) spots.push(p);
    }
    spots.sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));
    const chosen = [];
    for (const p of spots) { if (chosen.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 64)) continue;
      bossSummon(S, R, { ...e, x: p.x, y: p.y }, { type: 'drowned', n: 1, cap: 2, hp: 2.5, dmg: 2.2, r: 0, delay: 1 }); chosen.push(p); if (chosen.length === 2) break;
    }
    ev(S, { k: 'flood', x: e.x, y: e.y, id: e.id });
  }
  function serpent(S, R, e, heroOk) {
    if (!R.arena?.active || !heroOk) return;
    const B = D.BOSSES[e.type], t = S.t, h = R.hero, u = t - e.t0;
    e.vx = e.vy = 0;
    if (e.floodAt && t >= e.floodAt) { e.floodAt = 0; serpentFlood(S, R, e); }
    floodStep(S, R);
    if (!e.phase && e.hp <= e.max * B.phases[1].at && e.st !== 'bwind') {
      e.phase = 1; e.floodAt = t + 1.2; R.msg = { s: 'Вода поднимается! Утопленники идут со дна', t, d: 3 };
      R.trauma = Math.min(1, R.trauma + 0.28);
      ev(S, { k: 'bossphase', id: e.id, phase: 1 }); ev(S, { k: 'floodwarn', x: e.x, y: e.y });
    }
    if (e.st === 'deep') { if (t >= e.cdT) serpentSurface(S, R, e); return; }
    if (e.st === 'stir') { if (u >= B.warn) { e.st = 'rise'; e.t0 = t; ev(S, { k: 'rise', x: e.x, y: e.y, id: e.id }); } return; }
    if (e.st === 'rise') { if (u >= B.rise) { e.st = 'chase'; e.t0 = t; e.cdT = t + 0.35; e.bit = 0; } return; }
    if (e.st === 'dive') { if (u >= B.dive) { e.st = 'deep'; e.t0 = t; e.cdT = t + B.swim; } return; }
    if (e.st === 'recover') { if (t >= e.cdT) { if (e.bit >= 2) { e.st = 'dive'; e.t0 = t; ev(S, { k: 'dive', x: e.x, y: e.y, id: e.id }); }
        else { e.st = 'chase'; e.t0 = t; } } return; }
    if (e.st === 'chase') {
      if (t < e.cdT) return;
      const moves = D.bossPhase(e).moves; let mv = moves[(e.moveI || 0) % moves.length]; e.moveI = (e.moveI || 0) + 1;
      if (mv === 'bite' && Math.hypot(h.x - e.x, h.y - e.y) > B.moves.bite.r + 35) mv = 'wave';
      beginBossMove(S, R, e, mv); e.face = h.x >= e.x ? 1 : -1;
      const [mx, my] = serpentMouth(e);
      if (mv === 'fan') e.aimA = Math.atan2(h.y - 38 - my, h.x - mx);
      return;
    }
    if (e.st !== 'bwind') return;
    const M = D.bossMove(e);
    if (!e.fired && u >= M.wind) {
      e.fired = 1; e.bit++; e.hitDone = 0;
      if (e.mv === 'wave' || e.mv === 'fan') {
        const fan = e.mv === 'fan', [mx, my] = fan ? serpentMouth(e) : [e.x, e.y - 38], n = fan ? M.n : 1;
        for (let i = 0; i < n; i++) { const a = e.aimA + (fan ? (i / (n - 1) - 0.5) * M.spread * 2 : 0);
          R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: fan ? 'jet' : 'wave', kind: 'water', x: mx, y: my, vx: Math.cos(a) * M.speed, vy: Math.sin(a) * M.speed,
            t0: t, life: M.reach / M.speed, dmg: e.dmg * M.dmg, own: 'en', r: fan ? 8 : M.r, hitR: fan ? 22 : 34, gz: fan ? SERPENT_MOUTH[1] - 10 : 28, vol: e.id + ':' + t }); }
        ev(S, { k: fan ? 'spit' : 'wave', x: mx, y: my, a: e.aimA, id: e.id });
      } else {
        const d = Math.hypot(h.x - e.x, h.y - e.y), inArc = e.mv === 'tail' || Math.abs(angDiff(Math.atan2(h.y - e.y, h.x - e.x), e.aimA)) < M.arc;
        if (d < M.r + K.R && inArc && losClear(R.map, e.x, e.y, h.x, h.y)) { hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); }
        ev(S, { k: e.mv === 'bite' ? 'bite' : 'tail', x: e.x, y: e.y, a: e.aimA, id: e.id, r: M.r });
      }
    }
    if (u >= M.wind + M.duration) { e.st = 'recover'; e.t0 = t; e.cdT = t + D.bossPhase(e).rest + (e.hitDone ? 0 : 0.65); e.openUntil = e.hitDone ? 0 : e.cdT; }
  }
  // an explosive elite's corpse bursts once its fuse burns down: the hero and the monsters in reach are hit. A smouldering
  // skeleton's blast (TASKS 411) is its own: each monster in it loses a share of its own health, and another smouldering one in it lights up
  // (a fuse is set off no sooner than BOOM_GAP after the last one lit, its ring told its true length, TASKS 1057: held back at the burst,
  // 36 % of blasts came after their ring was gone)
  const BOOM_GAP = 0.35, fuseEnd = (R, want) => { const t = Math.max(want, (R.fuseLast ?? -9) + BOOM_GAP); R.fuseLast = t; return t; };
  function blast(S, R, e) { const B = ENEMIES[e.type].boom, M = B || MOD.explosive, h = R.hero; e.fuse = 0; R.boomT = S.t;
    if (h.deadT < 0 && Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(R.map, e.x, e.y - 6, h.x, h.y - 6)) hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e) + ' взрыв', e);
    for (const o of R.en) if (o !== e && o.deadT < 0 && Math.hypot(o.x - e.x, o.y - e.y) < M.r + ENEMIES[o.type].r) { if (ENEMIES[o.type].boom) fuse(S, R, o);
      hitEnemy(S, R, o, Math.max(1, Math.round(B ? o.max * B.mon : e.max * 0.25)), false, e.x, e.y, 1.5); }
    breakPots(S, R, e.x, e.y, M.r); ev(S, { k: 'boom', x: e.x, y: e.y - 20, big: 1, r: M.r }); R.trauma = Math.min(1, R.trauma + 0.5); }
  // a smouldering skeleton lights its fuse: it stands hissing through the wind-up and bursts at its end (stepMonsters)
  function fuse(S, R, e) { const E = ENEMIES[e.type]; if (e.st === 'wind' || e.deadT >= 0) return; const d = windOf(e, E.wind);
    e.st = 'wind'; e.t0 = S.t; e.fuse = fuseEnd(R, S.t + d); e.aimA = Math.atan2(R.hero.y - e.y, R.hero.x - e.x); ev(S, { k: 'fuse', x: e.x, y: e.y, r: E.boom.r, d: e.fuse - S.t, id: e.id, lit: 1 }); }
  // a floor as it is first entered: the map from its seed, its monsters, chests, pots, altars and merchant rolled off the run's
  // RNG; deterministic from R.rs and R.nextId, so a floor kept as a diff (TASKS 1008) is rebuilt and patched, not stored whole
  // a floor is generated anew on each trip home and back (stash and restore, TASKS 1008): the generator is a pure function of its
  // arguments, so a few of its maps are kept and handed out as copies (TASKS 467)
  const GEN = new Map();
  function genKept(kind, seed, f, opts) {
    const key = kind + ':' + seed + ':' + f + ':' + JSON.stringify(opts || null); let m = GEN.get(key);
    if (!m) { m = kind === 't' ? DG.genTown(seed) : DG.genFloor(seed, f, opts); if (GEN.size >= 8) GEN.delete(GEN.keys().next().value); GEN.set(key, m = structuredClone(m)); }
    return structuredClone(m);
  }
  function buildFloor(R, f, gen) {
    R.bossDead = 0;
    const m = f === 0 ? genKept('t', (R.seed * 31) >>> 0) : genKept('f', (R.seed * 31 + f * 1013) >>> 0, f, Object.assign({ mode: R.mode, runSeed: R.seed, from: FROM(R), town: R.viaTown ? 1 : 0 }, gen)); R.town = f === 0 ? 1 : 0; R.folk = f === 0 ? D.folkInit(m.town.npcs) : null;
    R.map = m; R.arena = null; m.arenaBox = null; R.eggs = []; R.lavaPending = []; R.rocks = []; R.cracks = []; R.en = []; R.proj = []; R.pyres = []; R.fires = []; R.drops = []; R.scorches = []; m.goo = [];
    const stg = STAGE(R, f), d = stg.depth, sc = BAL.hp * dif(R, 'hp') * D.hpAt(d), dc = BAL.dmg * 1.35 * D.dmgAt(d);
    for (const e of m.enemies) { const E = ENEMIES[e.type], guard = e.guard ? stg.guard : e.exit && e.elite ? stg.exit : undefined, gk = (typeof guard === 'object' ? guard.hp : guard) || 1, gd = (typeof guard === 'object' ? guard.dmg : guard) || 1, el = (e.elite && !D.BOSSES[e.type] ? eliteK(e, 'hp') : 1) * gk, bk = (D.BOSSES[e.type] && stg.bossK) || { hp: 1, dmg: 1 };
      R.en.push({ id: R.nextId++, type: e.type, x: e.x, y: e.y, vx: 0, vy: 0, hp: Math.round(E.hp * sc * el * bk.hp), max: Math.round(E.hp * sc * el * bk.hp), dmg: E.dmg * dc * (D.BOSSES[e.type] ? D.dmgAt(d, 1) / D.dmgAt(d) : 1) * (!e.elite ? stg.mob : D.BOSSES[e.type] ? 1.35 : eliteK(e, 'dmg')) * gd * bk.dmg,
        elite: e.elite, guard: e.guard || 0, room: e.room, st: D.BOSSES[e.type] ? 'idle' : E.lurk ? 'lurk' : E.deep ? 'deep' : 'idle', t0: -9, face: rnd(R) < 0.5 ? -1 : 1, aimA: 0, cdT: 0, hitT: -9, deadT: -1, dist: rnd(R) * 50, kbx: 0, kby: 0, burn: 0, burnT: 0, tx: 0, ty: 0, phase: 0, bossVersion: 1, summ: 0, hx: e.x, hy: e.y, seenT: 0, ft: -9 }); }
    for (const e of R.en) if (e.type === 'crab') e.fa = faOf(e);
    m.enemies.forEach((e, i) => { if (e.key !== undefined) R.en[i].key = e.key; });
    for (const e of R.en) if (e.elite && !D.BOSSES[e.type]) { e.mods = rollMods(R, d, e); if (has(e, 'ward')) e.ward = Math.round(e.max * MOD.ward.share); }
    // a closed door is a solid cell (5) that blocks sight like rock until it opens
    for (const d of m.doors || []) if (!d.open) for (const [x, y] of d.cells) m.cells[y * m.W + x] = 5;
    R.keys = 0;
    R.shop = !m.shop ? null : stockShop(R, d, m.wander ? 'wander' : undefined);
    R.chests = m.chests.map((c) => Object.assign({}, c)); for (const c of R.chests) c.loot = chestLoot(R, c); R.pots = m.pots.map((p) => Object.assign({}, p)); R.shrines = m.shrines.map((s) => Object.assign({}, s));
    // a big monster's post can graze a prop: the post is where it can actually stand
    { const sol = solids(R), clear = (x, y, r) => !boxHit(m, x, y, r, true, false) && !sol.some((o) => Math.hypot(x - o.x, (y - o.y) * 1.6) < o.r + r);
      for (const e of R.en) { const r = ENEMIES[e.type].r; if (ENEMIES[e.type].ghost || ENEMIES[e.type].deep || ENEMIES[e.type].lake) continue; if (ENEMIES[e.type].kind === 'salamander') { e.hx = e.x; e.hy = e.y; continue; } shove(m, e, r, true, sol);
        // squeezed between two props, the push only rocks it back and forth: take the nearest spot where it fits
        if (!clear(e.x, e.y, r)) find: for (let d = 4; d <= 96; d += 4) for (let a = 0; a < 16; a++) { const x = e.x + Math.cos(a * Math.PI / 8) * d, y = e.y + Math.sin(a * Math.PI / 8) * d;
          if (clear(x, y, r)) { e.x = x; e.y = y; break find; } }
        e.hx = e.x; e.hy = e.y; } }
    R.seen = new Array(m.W * m.H).fill(R.town); R.rseen = m.rooms.map(() => R.town);
  }
  // ---------------- floors kept as they were left (TASKS 1008, 1027; R-19) ----------------
  // a run through the town can go back up the stairs or home through a portal and come back: each floor it leaves is kept as the
  // diff of its changing parts against the same floor rebuilt fresh (the RNG and ids it was first built with are in R.memo[f]),
  // the loot on its floor and its explored cells run-length coded; nothing comes back to life
  const FLOOR_KEYS = ['map', 'en', 'chests', 'pots', 'shrines', 'shop', 'keys', 'bossDead', 'arena', 'eggs'];
  const jclone = (o) => JSON.parse(JSON.stringify(o === undefined ? null : o));
  function fdiff(a, b) {
    if (a === b) return undefined;
    if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
      const p = {}; let n = 0; for (const k of Object.keys(b)) { const d = fdiff(a[k], b[k]); if (d !== undefined) { p[k] = d; n++; } }
      const del = Array.isArray(a) ? [] : Object.keys(a).filter((k) => !(k in b)), len = Array.isArray(a) && a.length !== b.length ? b.length : undefined;
      return n || del.length || len !== undefined ? Object.assign({ p }, del.length ? { d: del } : {}, len !== undefined ? { n: len } : {}) : undefined; }
    return { v: b === undefined ? null : b }; }
  function fpatch(a, d) {
    if ('v' in d) return jclone(d.v);
    for (const [k, q] of Object.entries(d.p)) a[k] = fpatch(a[k], q); for (const k of d.d || []) delete a[k]; if (d.n !== undefined) a.length = d.n; return a; }
  const rle = (a) => { const o = []; for (let i = 0; i < a.length;) { let j = i; while (j < a.length && a[j] === a[i]) j++; o.push(a[i], j - i); i = j; } return o; };
  const unrle = (o) => { const a = []; for (let i = 0; i < o.length; i += 2) for (let k = 0; k < o[i + 1]; k++) a.push(o[i]); return a; };
  function freshFloor(R, f, M) { const keep = Object.assign({}, R), mode = R.mode; R.rs = M.rs; R.nextId = M.id; R.mode = M.mode; R.floor = f;
    try { buildFloor(R, f, M.gen || undefined); return Object.fromEntries(FLOOR_KEYS.map((k) => [k, R[k]])); }
    finally { for (const k of Object.keys(R)) if (!(k in keep)) delete R[k]; Object.assign(R, keep); R.mode = mode; } }
  // the baseline as JSON, taken when a floor is first built or first restored, so that leaving it again does not generate it a third time
  const BASE = new WeakMap(), snapFloor = (o) => JSON.stringify(Object.fromEntries(FLOOR_KEYS.map((k) => [k, o[k]])));
  function stashFloor(R) { const f = R.floor, M = R.memo && R.memo[f]; if (!M || f < 1) return;
    const fresh = BASE.has(M) ? JSON.parse(BASE.get(M)) : jclone(freshFloor(R, f, M)), cur = jclone(Object.fromEntries(FLOOR_KEYS.map((k) => [k, R[k]])));
    M.d = fdiff(fresh, cur) || null; M.drops = jclone(R.drops); M.seen = rle(R.seen); M.rseen = R.rseen.slice(); }
  // a floor kept by another generator (an old save): its diff fits a map no longer built, so the floor is built anew and only what
  // can't come back carries over: as many of its monsters stay dead as died there, the nearest the way in first, and a slain
  // boss stays slain with its hall's portal home; the goals of its quests in hand are placed anew; its loot on the floor and what
  // was explored are lost
  function migrateFloor(R, f, M) { const B = freshFloor(R, f, M), P = (M.d && M.d.p) || {}; BASE.set(M, snapFloor(B));
    const slain = !!(P.bossDead && P.bossDead.v) || (R.slain || []).includes(f), up = B.map.up || B.map.spawn;
    const far = (a, b) => Math.hypot(a.x - up.x, a.y - up.y) - Math.hypot(b.x - up.x, b.y - up.y), spare = new Set();
    // a hunt or a lair in hand keeps a quarry alive, the farthest that fits, however few were left there
    const qr = new Set(questRooms({ map: B.map }).map((r) => r.id));
    for (const q of R.quests || []) { const T = q.st === 'taken' && q.f === f && D.QUESTS[q.key].type; if (T !== 'named' && T !== 'room') continue;
      const e = B.en.filter((o) => !spare.has(o) && qr.has(o.room) && (T === 'named' ? plainFoe(o) : o.deadT < 0 && counted(o) && !D.BOSSES[o.type])).sort(far).pop(); if (e) spare.add(e); }
    const mobs = B.en.filter((e) => !D.BOSSES[e.type] && !spare.has(e)).sort(far);
    for (const e of mobs.slice(0, oldDead(R, f, M, P.en))) { e.hp = 0; e.deadT = 0; }
    for (const k of FLOOR_KEYS) R[k] = B[k];
    const boss = slain && R.en.find((e) => D.BOSSES[e.type]);
    if (boss) { boss.hp = 0; boss.deadT = 0; R.bossDead = 1; R.arena = { active: 0, room: boss.room, t0: 0 }; if (!lastFloor(R) && R.viaTown) R.arena.gate = bossGate(R, boss); }
    for (const q of R.quests || []) if (q.st === 'taken' && q.f === f && D.QUESTS[q.key].fresh) { q.placed = 0; delete q.lost; delete q.room; delete q.where; }
    M.gv = D.GEN_VERSION; M.d = null; M.drops = []; M.seen = null; M.rseen = null; }
  // how many of an old floor's own monsters died there, from its diff: a floor built with ids from M.id on gives its i-th monster
  // the id M.id + i, so an id skipped among the survivors is a body already cleared away (6 s after death); the summoned (summ) are
  // not its own. Bodies cleared after the last survivor leave no gap: the floor's own kill count and the run's log count them
  function oldDead(R, f, M, d) { if (!d || 'v' in d) return 0; const at = (i, k, z) => { const q = d.p[i]; if (!q) return z; if ('v' in q) return q.v ? q.v[k] : z; return q.p[k] ? q.p[k].v : z; };
    let n = d.n; if (n === undefined) n = Math.max(0, ...Object.keys(d.p).map((i) => +i + 1));
    let own = 0, deadNow = 0, last = -1;
    for (let i = 0; i < n; i++) { if (at(i, 'summ', 0)) continue; own++; if (at(i, 'deadT', -1) >= 0) deadNow++; last = Math.max(last, at(i, 'id', M.id + i) - M.id); }
    const gone = d.n === undefined ? 0 : Math.max(0, last + 1 - own);
    const st = R.stats && R.stats[f], counted = st ? st.kills - ((R.slain || []).includes(f) ? 1 : 0) : 0;
    const logged = ((R.log && R.log.fl) || []).filter((v) => v.f === f).reduce((s, v) => s + Object.entries(v.kills || {}).filter(([k]) => !D.BOSSES[k.split(' ')[0]]).reduce((a, [, c]) => a + c, 0), 0);
    return Math.max(deadNow + gone, counted, logged); }
  function restoreFloor(R, f, M) { const old = (M.gv || 1) !== D.GEN_VERSION; if (old) migrateFloor(R, f, M);
    else { const B = freshFloor(R, f, M); if (!BASE.has(M)) BASE.set(M, snapFloor(B)); if (M.d) fpatch(B, M.d); for (const k of FLOOR_KEYS) R[k] = B[k]; }
    R.arena = R.arena || null; R.eggs = R.eggs || []; R.lavaPending = []; R.rocks = []; R.cracks = []; R.proj = []; R.pyres = []; R.fires = []; R.scorches = [];
    R.drops = jclone(M.drops || []); R.seen = M.seen ? unrle(M.seen) : new Array(R.map.W * R.map.H).fill(0); R.rseen = M.rseen ? M.rseen.slice() : R.map.rooms.map(() => 0); return old; }
  function standNear(R, x, y) { const m = R.map, sol = solids(R), ok = (px, py) => !boxHit(m, px, py, K.R, false, false) && !sol.some((o) => Math.hypot(px - o.x, (py - o.y) * 1.6) < o.r + K.R);
    if (ok(x, y)) return [x, y]; for (let d = 6; d <= 160; d += 6) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a * Math.PI / 8 + Math.PI / 2) * d, py = y + Math.sin(a * Math.PI / 8 + Math.PI / 2) * d; if (ok(px, py)) return [px, py]; }
    return [x, y]; }
  function enterFloor(S, R, f, gen, how = 'down') {
    if (R.map && R.viaTown) stashFloor(R);
    if (R.map && R.town && R.shop) R.townShop = R.shop;
    R.floor = f; if (f > 0) R.deepest = Math.max(R.deepest || 0, f); R.propHit = {};   // only the last floor's boss opens the way out: a save from when the 8th was the last carries the lord's
    if (R.log) R.log.fl.push({ f, bag: potCount(R.hero), eq: Object.fromEntries(Object.entries(R.hero.eq).filter(([, it]) => it).map(([k, it]) => [k, gearName(it)])), perks: Object.assign({}, R.hero.perks), time: 0, lvlIn: R.hero.lvl, lvl: R.hero.lvl, xp: 0, minHp: 1, minMp: 1, kills: {}, dmg: {}, hits: {}, pot: {}, ab: {}, gold: 0, buy: 0, sell: 0, buys: [] });
    const M = f > 0 && R.memo && R.memo[f];
    if (M) { const mig = restoreFloor(R, f, M); R.town = 0; R.folk = null; if (mig) questPlace(S, R); }
    else { if (f > 0 && R.viaTown) (R.memo = R.memo || {})[f] = { rs: R.rs, id: R.nextId, mode: R.mode, gen: gen || null, gv: D.GEN_VERSION }; buildFloor(R, f, gen); if (f > 0 && R.viaTown) { BASE.set(R.memo[f], snapFloor(R)); questPlace(S, R); } }
    // the town's shelf (TASKS 1010) is stocked once a run and again after each boss slain, for the deepest floor reached by then, so
    // going back and forth is no free re-roll; the buy-back row goes on across a restock
    // the offers (and in buildFloor the townsfolk) are made on arrival, not on first ask: the HUD asks too, and a render must not
    // write the state (TASKS 1025)
    if (f === 0) { offersOf(R); R.away = (R.deepest || 0) - (R.townDeep || 0); R.townDeep = R.deepest || 0;
      const bn = R.bossN || 0, old = R.townShop; R.townShop = null;
      if (old && (old.boss || 0) === bn) { R.shop = old; if ((old.at || 0) < (R.deepest || 0)) { restock(R, R.shop, tradeDepth(R)); R.shop.at = R.deepest; } }
      else { R.shop = stockShop(R, tradeDepth(R), 'town'); R.shop.at = R.deepest || 0; R.shop.boss = bn; if (old) R.shop.back = old.back; } }
    const m = R.map;
    R.stats = R.stats || {}; if (!M || !R.stats[f]) R.stats[f] = floorStat(R);
    arrive(S, R, how); R.arrived = M ? '' : how;
    ev(S, { k: 'floor', x: R.hero.x, y: R.hero.y, f });
    S.saveN++;
  }
  function arrive(S, R, how) { const m = R.map, h = R.hero; let [hx, hy] = [m.spawn.x, m.spawn.y];
    if (how === 'up') [hx, hy] = standNear(R, m.exit.x, m.exit.y + 46);
    else if (how === 'portal') { const P = m.town ? m.town.svc.portal : R.portal; [hx, hy] = standNear(R, P.x, P.y + (m.town ? 40 : 0)); }
    else if (how === 'way' && m.way) [hx, hy] = standNear(R, m.way.x, m.way.y + 40);
    h.x = hx; h.y = hy; h.vx = h.vy = 0; h.bless = 0; h.pull = null; h.read = null;
    // up the stairs or through a portal he may come out by a floor's guard: a second to see where he is
    if (how !== 'down') h.ifr = Math.max(h.ifr || 0, S.t + 1);
    R.zoom = S.demo ? D.ZOOM : S.meta.zoom; R.cam = [h.x - WIN(R).W / 2, h.y - WIN(R).H / 2]; R.camV = [0, 0]; clampCam(R, R.cam);
    reveal(R); R.msg = { s: D.placeName(R.floor, R.mode, R.seed, FROM(R), m), t: S.t };
  }
  // a run picked up on its arrival at a floor first built there (the bot's checkpoints, TASKS 467): the floor is built again by this
  // version of the game from the RNG and ids it was first built with, so a change to the deep floors is measured without playing
  // the floors before them again
  function rebuildArrival(S) { const R = S.run, f = R.floor, M = R.memo && R.memo[f]; if (!M || !R.arrived) return false;
    R.rs = M.rs; R.nextId = M.id; M.gv = D.GEN_VERSION; buildFloor(R, f, M.gen || undefined); BASE.set(M, snapFloor(R));
    for (const q of R.quests || []) if (q.st === 'taken' && q.f === f && D.QUESTS[q.key].fresh) { q.placed = 0; delete q.lost; delete q.room; delete q.where; }
    questPlace(S, R); R.stats[f] = floorStat(R); arrive(S, R, R.arrived); return true; }

  // ---------------- completion: per floor, monsters (not summoned ones), loot, secrets ----------------
  // loot is items picked up out of all the items the floor has put out (its chests' contents from the start, then every drop as
  // it falls); a drop counts when first picked up, and an item thrown away or sold stays counted, while picking it up again
  // never counts twice (a thrown item is not a loot drop)
  // the eel (TASKS 310) is no part of the count either: it comes up when it pleases, and a hall would wait on it
  const counted = (e) => !e.summ && (!ENEMIES[e.type].deep || !!D.BOSSES[e.type]);
  function floorStat(R) { const m = R.map;
    return { foes: R.en.filter(counted).length, kills: R.en.filter((e) => counted(e) && e.deadT >= 0).length,
      lootN: R.chests.reduce((n, c) => n + (c.loot ? c.loot.length : 0), 0) + R.drops.filter((d) => d.loot).length, loot: 0,
      secN: (m.secrets || []).length, sec: (m.secrets || []).filter((q) => q.open).length }; }
  const fstat = (R) => { R.stats = R.stats || {}; return R.stats[R.floor] || (R.stats[R.floor] = floorStat(R)); };
  // totals over the given floors' stats; a category with nothing in it is left out of the average, never counted as 0%
  function completion(list) {
    const T = { floors: list.length, foes: 0, kills: 0, lootN: 0, loot: 0, secN: 0, sec: 0 };
    for (const f of list) for (const k in T) if (k !== 'floors') T[k] += f[k] || 0;
    const parts = [[T.kills, T.foes], [T.loot, T.lootN], [T.sec, T.secN]].filter(([, n]) => n > 0);
    T.pct = parts.length ? parts.reduce((a, [k, n]) => a + Math.min(1, k / n), 0) / parts.length : 0;
    return T;
  }
  const runCompletion = (R) => completion(Object.entries(R.stats || {}).filter(([f]) => f !== '0').map(([, v]) => v));
  function completionHints(R) {
    const f = (R.stats || {})[R.floor]; if (!f) return [];
    const near = (k, n) => f[n] > 0 && f[k] < f[n] && f[k] / f[n] >= 0.85, out = [];
    const put = (o, kind) => { if (!hidden(R.map, o)) out.push({ x: o.x, y: o.y, kind }); };
    // a quest's named foe and marked room have their own mark on the map (TASKS 1021): no second one
    const qr = new Set((R.quests || []).filter((q) => q.st === 'taken' && q.f === R.floor && q.room !== undefined).map((q) => q.room));
    if (near('kills', 'foes')) for (const e of R.en) if (counted(e) && e.deadT < 0 && !e.quest && !qr.has(e.room)) put(e, 'foe');
    if (near('loot', 'lootN')) {
      for (const c of R.chests) if (!c.open && c.loot && c.loot.length) put(c, 'loot');
      for (const d of R.drops) if (d.loot && !d.got && d.kind === 'item') put(d, 'loot');
    }
    return out;
  }
  // the magma caves' hazards (TASKS 406, data.js HAZ): each on its own clock; the warning and the burst are events (the scene's
  // ring, glow and shadow are drawn from the clock itself), the burst hurts everyone in its ring once a cycle, monsters too: lure
  // them onto a vent. The hero's hit is a share of his health past armour, as spikes, and a dash leaps it
  function stepHazards(S, R) {
    const m = R.map, h = R.hero, t = S.t, dashing = t - h.dashT < BAL.dodge.t;
    m.hazards.forEach((z, i) => { const H = D.HAZ[z.k], c = D.hazClock(z, t), c0 = D.hazClock(z, t - DT), n = Math.floor(t / z.per + z.ph), tag = R.floor + ':' + i;
      if (c0 < z.per - H.warn && c >= z.per - H.warn) ev(S, { k: 'hazwarn', x: z.x, y: z.y, h: z.k, i });
      if (c < c0) { ev(S, { k: z.k === 'vent' ? 'erupt' : z.k === 'surge' ? 'surge' : 'rockfall', x: z.x, y: z.y, i }); if (Math.hypot(h.x - z.x, h.y - z.y) < 420 || (z.k === 'surge' && D.hazIn(z, h.x, h.y))) R.trauma = Math.min(1, R.trauma + (z.k === 'vent' ? 0.25 : z.k === 'surge' ? 0.2 : 0.15)); }
      if (c >= H.burst) return;
      if (h.hp > 0 && D.hazIn(z, h.x, h.y) && !dashing && (h.haz || (h.haz = {}))[tag] !== n) { h.haz[tag] = n;
        hurtHero(S, R, heroSt(S).maxHp * H.hp, z.k === 'surge' ? h.x : z.x, (z.k === 'surge' ? h.y : z.y) - 10, 'spike', z.k === 'vent' ? 'vent' : z.k === 'surge' ? 'surge' : 'rock');
        if (H.burn && h.hp > 0) { if (h.burn <= t) h.burnT = t - 0.5; h.burn = Math.max(h.burn, t + H.burn); } }
      for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && !D.BOSSES[e.type] && D.hazIn(z, e.x, e.y) && (e.haz || (e.haz = {}))[tag] !== n) { e.haz[tag] = n;
        hitEnemy(S, R, e, Math.round(H.mon * (1 + 0.2 * (dep(R) - 1))), false, z.x, z.y, H.kb, H.burn ? 'fire' : undefined); } });
  }
  // a fire priest's ring (TASKS 410): it glows over its warning, then the pillar of fire stands for its burst and hurts a hero within
  // it once; it cares for no one else
  function stepPyres(S, R) { const h = R.hero, t = S.t, P = ENEMIES.fire_priest.pyre;
    for (const p of R.pyres) { const u = t - p.t0; if (u < P.warn) continue;
      if (!p.lit) { p.lit = 1; ev(S, { k: 'pillar', x: p.x, y: p.y, r: P.r, id: p.id }); R.trauma = Math.min(1, R.trauma + 0.15); }
      if (!p.hit && h.deadT < 0 && Math.hypot(h.x - p.x, (h.y - p.y) / P.ry) < P.r) { p.hit = 1; hurtHero(S, R, p.dmg, p.x, p.y - 10, 'fire', p.who + ' столб', R.en.find((o) => o.id === p.src)); } }
    R.pyres = R.pyres.filter((p) => t - p.t0 < P.warn + P.burst); }
  // a fire priest's cast: a ring under the hero, or (kin) fire on the weapons of the allies nearest it
  function pyre(S, R, e, E) { e.kinS = 0; const h = R.hero, p = { id: R.nextId++, src: e.id, who: who(e), x: h.x, y: h.y, t0: S.t, dmg: e.dmg * E.pyre.dmg * eliteK(e, 'bolt') };
    (R.pyres = R.pyres || []).push(p); ev(S, { k: 'pyre', x: p.x, y: p.y, r: E.pyre.r, d: E.pyre.warn, id: p.id, src: e.id }); }
  const kinOf = (R, e, E) => R.en.filter((o) => o !== e && o.deadT < 0 && !o.summ && !D.BOSSES[o.type] && E.kindle.kinds.includes(ENEMIES[o.type].kind) && o.st !== 'idle' && o.st !== 'lurk'
    && Math.hypot(o.x - e.x, o.y - e.y) < E.kindle.r).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, E.kindle.n);
  function kindle(S, R, e, E) { const K = E.kindle, to = kinOf(R, e, E); e.kin = 0; e.kinS = 1; e.kinT = S.t + K.every;
    for (const o of to) o.fireT = S.t + K.t; ev(S, { k: 'kindle', x: e.x, y: e.y - 44, id: e.id, to: to.map((o) => o.id) }); }
  // ---------------- the imp (TASKS 407) ----------------
  // a spot to leap to: open floor (no crust) within its leap, in sight of the hero and away from him, free of the others and the vents.
  // across: the way round to it on foot is long or none (F, the hero's flow field), so he can't walk up to it
  function impSpot(R, e, E, F, flee) {
    const m = R.map, h = R.hero, L0 = E.leap, dh0 = Math.hypot(h.x - e.x, h.y - e.y), tx0 = Math.floor(e.x / TILE), ty0 = Math.floor(e.y / TILE), n = Math.ceil(L0.far / TILE), mid = (E.keep[0] + E.keep[1]) / 2, sol = solids(R);
    let best = null;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const tx = tx0 + i, ty = ty0 + j, k = ty * m.W + tx;
      if (cell(m, tx, ty) !== 1) continue; const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE + 4, dl = Math.hypot(x - e.x, y - e.y);
      if (dl < L0.near || dl > L0.far) continue; const dh = Math.hypot(h.x - x, h.y - y);
      if (dh < E.flee + 30 || (flee && dh < dh0 + 50) || !losClear(m, e.x, e.y - 6, x, y - 6) || !losClear(m, x, y - 30, h.x, h.y - 30)) continue;
      if (R.en.some((o) => o !== e && o.deadT < 0 && Math.hypot((o.st === 'leap' ? o.ltx : o.x) - x, (o.st === 'leap' ? o.lty : o.y) - y) < 26) || (m.hazards || []).some((z) => D.hazIn(z, x, y))) continue;
      // (not into a prop: landed in a brazier, it was shoved out of it in one frame)
      if (sol.some((o) => Math.hypot(x - o.x, (y - o.y) * 1.6) < o.r + E.r + 4)) continue;
      const f = F[k], across = f < 0 || f * TILE > 1.6 * dh + 2 * TILE, sc = Math.abs(dh - mid) - (across ? 160 : 0) + 0.15 * dl + ((e.id * 7919 + k * 104729) % 97) / 5;
      if (!best || sc < best[0]) best = [sc, x, y, across]; }
    return best;
  }
  const acrossFrom = (R, e, F) => { const m = R.map, h = R.hero, f = F[Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE)]; return f < 0 || f * TILE > 1.6 * Math.hypot(h.x - e.x, h.y - e.y) + 2 * TILE; };
  // a leap: a crouch, the flight in a line over whatever lies between (its arc is the render's), a landing crouch
  // (the walk it springs from eases out in the render, spd0 as a boss's move cuts it: zeroed in a frame, the arms' swing snapped)
  function leap(S, R, e, E, x, y) { const d = Math.hypot(x - e.x, y - e.y), sp = Math.hypot(e.vx, e.vy); e.spd0 = sp; e.vxn0 = sp > 1 ? e.vx / sp : 1; e.vyn0 = sp > 1 ? e.vy / sp : 0; Object.assign(e, { st: 'leap', t0: S.t, lx: e.x, ly: e.y, ltx: x, lty: y, ld: 0.16 + d / E.leap.spd, vx: 0, vy: 0, kbx: 0, kby: 0 });
    // it springs back from the hero facing him, its eyes on him; elsewhere it faces where it leaps
    const h = R.hero, back = Math.hypot(h.x - x, h.y - y) > Math.hypot(h.x - e.lx, h.y - e.ly) && Math.hypot(h.x - e.lx, h.y - e.ly) < E.flee + 20;
    e.face = back ? (h.x >= e.x ? 1 : -1) : x >= e.x ? 1 : -1; e.aimA = Math.atan2(y - e.y, x - e.x); ev(S, { k: 'leap', x: e.x, y: e.y, id: e.id }); }
  // (a body in flight keeps its speed, TASKS 489: eased all along it, it went 2.7× faster at the middle than near the ends; its speed
  // ramps up over the first fifth and down over the last, so the take-off and the landing don't jolt)
  // (its first steps off the landing ease in from a standstill: spd0 0)
  const leapQ = (f) => (f < 0.2 ? 3.125 * f * f : f > 0.8 ? 1 - 3.125 * (1 - f) * (1 - f) : 0.125 + 1.25 * (f - 0.2));
  function leapStep(S, R, e, E) { const L0 = E.leap, u = S.t - e.t0, f = Math.max(0, Math.min(1, (u - L0.crouch) / e.ld)), q = leapQ(f);
    e.x = e.lx + (e.ltx - e.lx) * q; e.y = e.ly + (e.lty - e.ly) * q; e.vx = e.vy = e.kbx = e.kby = 0;
    if (q >= 1 && !e.landed) { e.landed = 1; ev(S, { k: 'land', x: e.x, y: e.y, id: e.id }); }
    if (u >= L0.crouch + e.ld + L0.land) { e.st = 'chase'; e.t0 = e.seenT = S.t; e.landed = 0; e.spd0 = 0; e.vxn0 = 1; e.vyn0 = 0; e.leapT = S.t + L0.cd * (0.8 + 0.4 * rnd(R)) / eliteK(e, 'spd'); } }
  // its turn in the chase: true when it began a leap or an attack
  function impThink(S, R, e, E, F, d, dx, dy) {
    const m = R.map, h = R.hero, t = S.t, ready = t >= (e.leapT ?? 0), k = Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE);
    if (cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) !== 1) { const [x, y] = landOf(m, e.x, e.y); leap(S, R, e, E, x, y); return true; }   // knocked onto lava or crust
    if (d < E.flee && ready) { const s = impSpot(R, e, E, F, 1); if (s) { leap(S, R, e, E, s[1], s[2]); return true; } }
    if (d < E.r + K.R + E.reach && t >= e.cdT) { Object.assign(e, { st: 'wind', t0: t, claw: 1, tx: h.x, ty: h.y, aimA: Math.atan2(dy, dx) }); return true; }
    const los = losClear(m, e.x, e.y - 30, h.x, h.y - 30);
    if (los && d >= E.flee && d < E.spark.reach && t >= e.cdT) { Object.assign(e, { st: 'wind', t0: t, claw: 0, aimA: Math.atan2(h.y - 38 - (e.y - IMP_Y), h.x - e.x) }); return true; }
    // every few seconds it looks for a better spot: across from him, or in sight and in range when it has neither
    if (ready && t >= (e.lookT ?? 0)) { e.lookT = t + E.leap.look; const s = impSpot(R, e, E, F, 0), far = !los || d > E.keep[1] + 30;
      if (s && ((s[3] && !acrossFrom(R, e, F)) || far)) { leap(S, R, e, E, s[1], s[2]); return true; } }
    steer(e, E, m, F, d < E.keep[0] ? -1 : d > E.keep[1] || !los ? 1 : 0, dx, dy, d, d < E.keep[0] ? 0.9 : 1); void k;
    return false;
  }
  const IMP_Y = 32;   // the spark leaves its hand this far over its feet

  // ---------------- the lava salamander (TASKS 408) ----------------
  // the floor's lava and land as one field from a tile (the salamander's way to the hero: swimming is walking for it), cached as flow is
  const LFLOW = { key: '', d: null };
  function lavaFlow(m, tx, ty) {
    const key = m.seed + ':' + m.floor + ':' + tx + ',' + ty + ':' + doorKey(m); if (LFLOW.key === key) return LFLOW.d;
    const d = new Int16Array(m.W * m.H).fill(-1), q = [ty * m.W + tx]; d[q[0]] = 0; const blk = new Set(m.block || []);
    for (let i = 0; i < q.length; i++) { const k = q[i]; if (d[k] > 60) continue; for (const o of [1, -1, m.W, -m.W]) { const j = k + o; if (d[j] >= 0 || blk.has(j) || (m.cells[j] !== 1 && m.cells[j] !== 3)) continue; d[j] = d[k] + 1; q.push(j); } }
    LFLOW.key = key; LFLOW.d = d; return d;
  }
  // how many cells each floor cell lies from the lava, cached per map (lava doesn't move; crust counts as lava)
  const LDIST = new WeakMap();
  function lavaDist(m) { let d = LDIST.get(m); if (d) return d; d = new Int16Array(m.W * m.H).fill(-1); const q = [];
    for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 3) { d[k] = 0; q.push(k); }
    for (let i = 0; i < q.length; i++) { const k = q[i]; for (const o of [1, -1, m.W, -m.W]) { const j = k + o; if (j < 0 || j >= d.length || d[j] >= 0 || m.cells[j] !== 1) continue; d[j] = d[k] + 1; q.push(j); } }
    LDIST.set(m, d); return d; }
  const cellOf = (m, o) => Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE);
  // the open lava nearest it within n cells, its middle
  function lavaNear(m, e, n) { const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE); let best = null;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const x = tx + i, y = ty + j; if (cell(m, x, y) !== 3 || crustAt(m, y * m.W + x)) continue;
      let deep = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (cell(m, x + a, y + b) === 3) deep++;
      const dd = i * i + j * j - deep; if (!best || dd < best[2]) best = [(x + 0.5) * TILE, (y + 0.5) * TILE, dd]; }
    return best; }
  function salamThink(S, R, e, E, d, dx, dy) {
    const m = R.map, h = R.hero, t = S.t, B = E.breath, HL = E.heal, LD = lavaDist(m), here = LD[cellOf(m, e)], his = LD[cellOf(m, h)];
    crabTurn(e, E, Math.atan2(dy, dx), 1);
    if (e.hp < HL.at * e.max && t >= (e.healT ?? 0)) { const p = lavaNear(m, e, 10); if (p) { Object.assign(e, { st: 'soak', t0: t, sx: p[0], sy: p[1], healT: t + HL.cd, soaked: 0 }); ev(S, { k: 'flee', x: e.x, y: e.y, id: e.id }); return true; } }
    const front = Math.abs(angDiff(Math.atan2(dy, dx), faOf(e)));
    if (d < E.r + K.R + E.reach && t >= e.cdT && front < 0.6) { Object.assign(e, { st: 'wind', t0: t, br: 0, tx: h.x, ty: h.y, aimA: faOf(e) }); return true; }
    if (d > E.r + K.R + B.near && d < B.reach + K.R && front < 0.35 && t >= e.cdT && t >= (e.brT ?? 0) && losClear(m, e.x, e.y - 6, h.x, h.y - 6)) { Object.assign(e, { st: 'wind', t0: t, br: 1, tx: h.x, ty: h.y, aimA: faOf(e) }); return true; }
    // on land it keeps within its tether of the lava: a hero farther in is breathed at from the edge
    const hold = here > 0 && his > E.tether && here >= E.tether - 1, F = lavaFlow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE));
    steer(e, E, m, F, hold || d < E.r + K.R + E.reach * 0.8 ? 0 : 1, dx, dy, d, onLava(m, e) ? E.swim : 1);
    return false;
  }
  // back into the lava to heal: it swims to the spot, then lies under, mending while nothing hurts it
  function soak(S, R, e, E) { const m = R.map, t = S.t, HL = E.heal, dx = e.sx - e.x, dy = e.sy - e.y, d = Math.hypot(dx, dy);
    crabTurn(e, E, d > 6 ? Math.atan2(dy, dx) : faOf(e), d > 6 ? 1 : 0.3);
    const sp = (d > 6 ? E.spd * (onLava(m, e) ? E.swim : 1) * eliteK(e, 'spd') : 0) * SS01(Math.min(1, d / 24)), k = 1 - Math.exp(-9 * DT);
    e.vx += ((d > 0.01 ? dx / d : 0) * sp - e.vx) * k; e.vy += ((d > 0.01 ? dy / d : 0) * sp - e.vy) * k;
    move(m, e, e.vx * DT, e.vy * DT, E.r, true, true); e.dist += Math.hypot(e.vx, e.vy) * DT;
    if (!onLava(m, e)) { if (t - e.t0 > 5) { e.st = 'chase'; e.t0 = t; } return; }
    if (!e.soaked) { e.soaked = 1; e.soakT = t; ev(S, { k: 'submerge', x: e.x, y: e.y, id: e.id }); }
    if (t - e.hitT > HL.calm) e.hp = Math.min(e.max, e.hp + HL.rate * e.max * DT);
    if (e.hp >= HL.to * e.max || t - e.soakT > HL.most) { e.st = 'chase'; e.t0 = e.seenT = t; e.soaked = 0; e.cdT = t + 0.4; ev(S, { k: 'emerge', x: e.x, y: e.y, id: e.id }); } }
  // its fire on the floor: the trail of its belly on land and the patches its breath leaves, a golem's pool of lava (TASKS 409).
  // Each burns a hero in it once it is `arm` s old (at once by default) and again every `per` s, and sets him alight
  function addFire(R, S, x, y, o) { (R.fires = R.fires || []).push(Object.assign({ id: R.nextId++, x, y, t0: S.t }, o)); }
  function stepFires(S, R) { const h = R.hero, t = S.t;
    for (const p of R.fires) { if (t - p.t0 >= p.t || t - p.t0 < (p.arm || 0) || h.deadT >= 0 || Math.hypot(h.x - p.x, (h.y - p.y) / p.ry) >= p.r + K.R * 0.5 || t < (p.hitT ?? -9) + p.per) continue;
      if (t - h.dashT < BAL.dodge.t && p.kind !== 'pool') continue;
      p.hitT = t; hurtHero(S, R, p.dmg, p.x, p.y - 6, 'fire', p.who + (p.kind === 'pool' ? ' лужа' : ' огонь'), R.en.find((o) => o.id === p.src)); }
    R.fires = R.fires.filter((p) => t - p.t0 < p.t); }
  function breathFire(S, R, e, E) { const B = E.breath, a = e.aimA;
    for (const q of [0.35, 0.65, 0.95]) { const x = e.x + Math.cos(a) * (E.r + B.reach * q), y = e.y + Math.sin(a) * (E.r + B.reach * q) * 0.8;
      if (cell(R.map, Math.floor(x / TILE), Math.floor(y / TILE)) === 1) addFire(R, S, x, y, { src: e.id, who: who(e), r: E.trail.r * (0.9 + 0.5 * q), ry: E.trail.ry, t: E.trail.t, dmg: e.dmg * E.trail.dmg, per: E.trail.per, kind: 'breath' }); } }

  // ---------------- the magma golem (TASKS 409) ----------------
  const crustOf = (e, E) => e.crust ?? E.crust.n;
  function golemCrust(S, R, e, E, d) { const C = E.crust, t = S.t, n = crustOf(e, E);
    if (n >= C.n || t - (e.blowT ?? -9) < C.calm || d < C.far) { e.growT = t; return; }
    if (t - (e.growT ?? t) >= C.regrow) { e.crust = n + 1; e.growT = t; (e.plateG = e.plateG || {})[e.crust] = t; ev(S, { k: 'regrow', x: e.x, y: e.y - E.h * 0.55, id: e.id, n: e.crust }); } }
  function damageName(src) {
    const type = String(src || '').split(' ')[0], E = ENEMIES[type];
    if (E) return E.name + (src.includes('элита') ? ' (элита)' : '') + (src.endsWith('снаряд') ? ' · снаряд' : src.endsWith('взрыв') ? ' · взрыв' : src.endsWith('столб') ? ' · столб огня' : '');
    return ({ spike: 'Шипы', lava: 'Лава', burn: 'Горение', poison: 'Яд', fire: 'Огонь', vent: 'Жерло', rock: 'Обвал', surge: 'Волна лавы' })[src] || 'Неизвестный источник';
  }
  // the end-of-run reward: gold brought back and a win. Thoroughness is paid on the floor itself, 10 shards for each of its kills,
  // loot and secrets at 100 % and 1 per secret found (TASKS 175); with the elites and the boss a thorough win brings ~120 shards,
  // so the altar's 1395 take some 20 runs
  const REWARD = { goldPer: 500, win: 30, full: 10, secret: 1 };
  function runReward(R, how) {
    // the gold of a campaign won on the way down was paid at the stairs (descend): only the gold since counts at the end
    const C = runCompletion(R), base = Math.floor((R.goldTot - (R.goldBanked || 0)) / REWARD.goldPer) + (how === 'win' ? REWARD.win : 0);
    return { base, bonus: 0, cap: 0, C };
  }
  const FULL = [['kills', 'foes', 'Все враги этажа повержены'], ['loot', 'lootN', 'Весь лут этажа собран'], ['sec', 'secN', 'Все тайники этажа найдены']];
  function giveShards(S, R, n, x, y, s) { R.shards += n; S.meta.shards += n; ev(S, { k: 'shard', x, y, n, floor: R.floor, s }); }
  // a floor's kills, loot or secrets brought to 100 % pay once, on the spot
  function checkFull(S, R) { const f = fstat(R), h = R.hero; f.full = f.full || {};
    for (const [k, n, s] of FULL) if (!f.full[k] && f[n] > 0 && f[k] >= f[n]) { f.full[k] = 1; giveShards(S, R, REWARD.full, h.x, h.y, s + ' · +' + REWARD.full + ' осколков душ'); } }

  // cells of the secret rooms not found yet (the room, its passage and the fake wall): render and minimap show them as rock
  const MASK = { key: '', set: null };
  function secretMask(m) { const key = m.seed + ':' + m.floor + ':' + (m.secrets || []).map((q) => q.open).join('');
    if (MASK.key === key) return MASK.set; const set = new Set();
    for (const q of m.secrets || []) { if (q.open) continue; const r = m.rooms[q.room];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set.add(y * m.W + x);
      for (const k of q.hide) set.add(k); }
    MASK.key = key; MASK.set = set; return set; }
  const hidden = (m, o) => o.sec !== undefined && !!m.secrets && !m.secrets[o.sec].open;

  // ---------------- map queries ----------------
  const cell = (m, tx, ty) => (tx < 0 || ty < 0 || tx >= m.W || ty >= m.H ? 0 : m.cells[ty * m.W + tx]);
  const inRoom1 = (r, tx, ty) => tx >= r.x - 1 && tx <= r.x + r.w && ty >= r.y - 1 && ty <= r.y + r.h;
  // the start room and the merchant's shop (plus one cell): the generator posts no monster there; they are not warded (TASKS 152)
  const inRoom0 = (r, tx, ty) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  const inStart = (m, tx, ty) => inRoom0(m.rooms[m.start], tx, ty) || (!!m.shop && inRoom1(m.rooms[m.shop.room], tx, ty));
  // the magma caves' crust (dungeon.js m.crust, TASKS 401): lava gone hard along the banks. The hero walks it, a monster keeps off it as
  // off lava; under one standing on it CRUST.stand s it cracks, CRUST.crack s on it is lava again (m.melt[k].hot) for CRUST.hot s
  // (TASKS 476) thin: the crust of a way out to a hoard's islet (m.thin) cracks after `thin` s standing, so it is crossed at a walk and
  // never stood on; fall: a hero the crust melts under falls into the lava, losing that share of his health past armour and set
  // alight for `burn` s, and climbs out where he last stood on firm ground
  // (sink: how long a fallen hero is under before he climbs out, TASKS 484: at once he was moved back up to ~290 px in a frame)
  const CRUST = { stand: 1, crack: 0.5, hot: 3.5, set: 0.8, thin: 0.35, fall: 0.3, burn: 3, sink: 0.6 }, CRS = new WeakMap(), THIN = new WeakMap();
  const thinSet = (m) => { let s = THIN.get(m); if (!s) THIN.set(m, s = new Set(m.thin || [])); return s; };
  const crustSet = (m) => { if (!m.crust || !m.crust.length) return null; let s = CRS.get(m); if (!s) CRS.set(m, s = new Set(m.crust)); return s; };
  const crustAt = (m, k) => { const s = crustSet(m); return !!s && s.has(k) && !(m.melt && m.melt[k] && m.melt[k].hot); };
  // the plateaus' chasm (TASKS 400): the rock below the top wall, which only a blow knocks a monster into (TASKS 401)
  const chasm = (m, tx, ty) => !!m.cliff && tx > 0 && ty > 0 && tx < m.W - 1 && ty < m.H - 1 && ty >= m.cliff[tx] && m.cells[ty * m.W + tx] === 0;
  // lava (3) can be entered — it burns — by the hero (not on the plateaus, where it stops him at the bank as deep water does, TASKS
  // 401, but for a boss's tongues of it, which he must be able to cross) and by a monster knocked into it; a monster never walks into it on its own. lavaOk 2: a blow carries a monster into the chasm
  // a sealed arena's lava is no way out for the hero: a river of the fire biome runs through its wall in about one floor-6 arena in
  // five, and out by it he was shut out of the room with the stairs (TASKS 470); m.arenaBox is the room's box while sealed
  const sealedOut = (m, tx, ty) => { const A = m.arenaBox; return !!A && (tx < A[0] || ty < A[1] || tx >= A[2] || ty >= A[3]); };
  const solidAt = (m, x, y, mon, lavaOk) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), c = cell(m, tx, ty);
    if (c === 3) { const k = ty * m.W + tx; if (!mon && sealedOut(m, tx, ty)) return true; if (crustAt(m, k)) return !!mon && !lavaOk; return !lavaOk && !(!mon && m.arenaLava && m.arenaLava.includes(k)); } if (c === 0 && lavaOk === 2 && chasm(m, tx, ty)) return false; return c !== 1; };
  // the brink (TASKS 476, data.js BRINK): a cell a monster sinks or falls in; whether one can be pushed off at all; the drop cell
  // within `near` of it, if any (nearest first); whether a blow from (sx, sy) drives it at a drop
  const dropCell = (m, tx, ty) => (cell(m, tx, ty) === 3 && !crustAt(m, ty * m.W + tx)) || chasm(m, tx, ty);
  const pushable = (e) => { const E = ENEMIES[e.type]; return e.deadT < 0 && !E.ghost && !E.lava && !E.heavy && !E.deep && !e.elite && e.type !== 'brute' && !D.BOSSES[e.type] && e.sinkT === undefined && e.fallT === undefined; };
  const brinkOf = (m, e) => { if (!m.cliff || !pushable(e)) return null; const tx0 = Math.floor(e.x / TILE), ty0 = Math.floor(e.y / TILE); let best = null;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const tx = tx0 + i, ty = ty0 + j; if (!dropCell(m, tx, ty)) continue;
      const x = Math.max(tx * TILE, Math.min((tx + 1) * TILE, e.x)), y = Math.max(ty * TILE, Math.min((ty + 1) * TILE, e.y)), d = Math.hypot(x - e.x, y - e.y);
      if (d <= D.BRINK.near && (!best || d < best.d)) best = { x, y, d, tx, ty }; } return best; };
  const atBrink = (m, e, sx, sy) => { const dx = e.x - sx, dy = e.y - sy, d = Math.hypot(dx, dy) || 1;
    return D.BRINK.reach.some((r) => dropCell(m, Math.floor((e.x + dx / d * r) / TILE), Math.floor((e.y + dy / d * r) / TILE))); };
  const onLava = (m, o) => { const tx = Math.floor(o.x / TILE), ty = Math.floor(o.y / TILE); return cell(m, tx, ty) === 3 && !crustAt(m, ty * m.W + tx); };
  // shallow water (dungeon.js m.water) lies on floor cells: anyone wades through it slowed, and it puts out a burning one
  const WET = new WeakMap(), WADE = 0.75;
  const inWater = (m, o) => { if (!m.water || !m.water.length) return false; let w = WET.get(m); if (!w) WET.set(m, w = new Set(m.water));
    return w.has(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE)); };
  const onPlate = (a, tr) => Math.abs(a.x - tr.x) < TILE - 4 && Math.abs(a.y - tr.y) < TILE - 6;
  // a web on the floor (dungeon.js m.webs) holds whoever wades in, spiders aside, until it is torn
  const WEB = { k: 0.4, mon: 0.5, rx: 28, ry: 17 };
  const webAt = (m, o) => (m.webs || []).find((w) => !w.torn && Math.abs(o.x - w.x) < WEB.rx * w.s && Math.abs(o.y - w.y) < WEB.ry * w.s);
  // a slime's puddle (TASKS 308) slows whoever wades in, slimes and ghosts aside, until it dries; it shrinks over its last GOO.dry s
  // (m.goo; its radius now, rNow, is kept by the sim's step)
  const GOO = { k: 0.55, mon: 0.6, dry: 2 };
  // a skeleton mage's ball of water (TASKS 311) slows the hero it soaks for a while
  const ORB = ENEMIES.skel_mage.orb, soaked = (S, h) => S.t < (h.slowT ?? -9);
  const gooAt = (m, o) => (m.goo || []).find((g) => g.rNow > 4 && Math.abs(o.x - g.x) < g.rNow && Math.abs(o.y - g.y) < g.rNow * 0.6);
  // feet box against the grid, axis by axis (slides along walls); the middles of its front and back edges too, or a body wider
  // than a two-cell wall (the boss) straddles it with its corners on both sides
  const boxHit = (m, x, y, r, mon, lavaOk) => solidAt(m, x - r, y - r * 0.6, mon, lavaOk) || solidAt(m, x + r, y - r * 0.6, mon, lavaOk) || solidAt(m, x - r, y + r * 0.4, mon, lavaOk) || solidAt(m, x + r, y + r * 0.4, mon, lavaOk)
    || solidAt(m, x, y - r * 0.6, mon, lavaOk) || solidAt(m, x, y + r * 0.4, mon, lavaOk);
  function move(m, o, dx, dy, r, mon, lavaOk = (!mon && !m.cliff) || onLava(m, o)) {
    // steps of at most 8 px: the boss's roar shoved the hero 150 px in one move, through a shut door (TASKS 219)
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8);
    if (steps > 1) { let bx = false, by = false;
      for (let i = 0; i < steps; i++) { const hit = move(m, o, dx / steps, dy / steps, r, mon, lavaOk); bx ||= hit[0]; by ||= hit[1]; }
      return [bx, by];
    }
    const hit = (x, y) => boxHit(m, x, y, r, mon, lavaOk);
    let bx = false, by = false;
    // blocked on one axis by a corner it almost clears: slide sideways (up to 12 px) toward the opening
    const nudge = (ax) => { for (let k = 1; k <= 12; k += 1) for (const sg of [1, -1]) {
      if (ax === 'x' && !hit(o.x + dx, o.y + sg * k) && !hit(o.x, o.y + sg * k)) { o.y += sg * Math.min(k, Math.abs(dx) + 1); return true; }
      if (ax === 'y' && !hit(o.x + sg * k, o.y + dy) && !hit(o.x + sg * k, o.y)) { o.x += sg * Math.min(k, Math.abs(dy) + 1); return true; } } return false; };
    if (dx) { if (!hit(o.x + dx, o.y)) o.x += dx; else { bx = true; if (!dy && !mon) nudge('x'); } }
    if (dy) { if (!hit(o.x, o.y + dy)) o.y += dy; else { by = true; if (!dx && !mon) nudge('y'); } }
    if (hit(o.x, o.y)) {                                   // started inside a blocked cell (spawned or knocked there): step out
      for (let k = 1; k < 6; k++) for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!hit(o.x + ax * k * 4, o.y + ay * k * 4)) { o.x += ax * k * 4; o.y += ay * k * 4; return [bx, by]; } }
    return [bx, by];
  }
  // out of solid props (feet ellipse against each prop's circle), through move() so the push never lands in a wall
  function shove(m, o, r, mon, sol) {
    for (const s of sol) { const rr = s.r + r; let dx = o.x - s.x; if (dx >= rr || dx <= -rr) continue; let dy = (o.y - s.y) * 1.6; if (dy >= rr || dy <= -rr) continue; let d = Math.hypot(dx, dy); if (d >= rr) continue;
      if (d < 0.01) { dx = 0; dy = d = 1; }
      move(m, o, s.x + dx / d * rr - o.x, s.y + dy / d * rr / 1.6 - o.y, r, mon); }
  }
  // a point blocks the line only if the wall is there both at it and 8 px up: two actors hugging the same wall can still reach
  // each other along its face, and a line through a wall still crosses a whole blocked cell
  // a step from one cell to its diagonal neighbour between two walls slips through their shared corner: that corner is shut too
  const solidC = (m, tx, ty) => { const c = cell(m, tx, ty); return c === 0 || c === 4 || c === 5; };
  const pinch = (m, cx, cy, nx, ny) => cx !== nx && cy !== ny && solidC(m, nx, cy) && solidC(m, cx, ny);
  const losClear = (m, x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10), wall = (x, y) => solidC(m, Math.floor(x / TILE), Math.floor(y / TILE));
    let cx = Math.floor(x0 / TILE), cy = Math.floor(y0 / TILE);
    for (let i = 1; i <= n; i++) { const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, nx = Math.floor(x / TILE), ny = Math.floor(y / TILE);
      if (pinch(m, cx, cy, nx, ny)) return false; cx = nx; cy = ny; if (i < n && wall(x, y - 8) && wall(x, y)) return false; } return true; };
  // doors (dungeon.js m.doors, m.locks): a door shut by a lock that is not open yet; the doors' state for the caches' keys
  const doorLock = (m, d) => { const L = d.lock >= 0 && m.locks ? m.locks[d.lock] : null; return L && !L.open ? L : null; };
  const doorKey = (m) => (m.doors || []).map((d) => (d.open ? 'o' : doorLock(m, d) ? 'l' : 'c')).join('') + ':' + (m.geometry || 0);
  // flow field from a target tile over open floor: derived data, cached by key, never in the state
  // a field per target, a few kept: the bot asks for its own fields between the monsters' each step, and one slot was rebuilt
  // every time (TASKS 467); a secret opened changes the floor without the doors' key
  const FLOW = new Map(), FLOW2 = new Map(), secKey = (m) => (m.secrets || []).map((q) => (q.open ? 1 : 0)).join('');
  let BQ = new Int32Array(0);
  function bfs(m, tx, ty, lim, doors) {
    const W = m.W, H = m.H, N = W * H, d = new Int16Array(N).fill(-1), cs = m.cells, pass = new Uint8Array(N); if (BQ.length < N) BQ = new Int32Array(N);
    const q = BQ; let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) if (cs[i] === 1) pass[i] = 1;
    if (doors) for (const o of m.doors || []) if (!o.open && !o.arena && !doorLock(m, o)) for (const [x, y] of o.cells) pass[y * W + x] = 1;
    for (const i of m.block || []) pass[i] = 0;
    if (cell(m, tx, ty) === 1) { d[ty * W + tx] = 0; q[qt++] = ty * W + tx; }
    while (qh < qt) { const i = q[qh++], dv = d[i]; if (dv > lim) continue; const x = i % W, y = (i / W) | 0, nd = dv + 1; let j;
      if (x + 1 < W) { j = i + 1; if (d[j] < 0 && pass[j]) { d[j] = nd; q[qt++] = j; } }
      if (x > 0) { j = i - 1; if (d[j] < 0 && pass[j]) { d[j] = nd; q[qt++] = j; } }
      if (y + 1 < H) { j = i + W; if (d[j] < 0 && pass[j]) { d[j] = nd; q[qt++] = j; } }
      if (y > 0) { j = i - W; if (d[j] < 0 && pass[j]) { d[j] = nd; q[qt++] = j; } } }
    return d;
  }
  function flow(m, tx, ty, any) {
    const C = any ? FLOW2 : FLOW, key = m.seed + ':' + m.floor + ':' + tx + ',' + ty + ':' + doorKey(m) + ':' + secKey(m); let d = C.get(key);
    if (d) { C.delete(key); C.set(key, d); return d; }
    d = bfs(m, tx, ty, any ? 400 : 40, any); if (C.size >= 16) C.delete(C.keys().next().value); C.set(key, d); return d;
  }
  // a monster walking back to its post may be far from it: a whole-floor field per post, a few kept at once
  const HOME = new Map();
  function homeFlow(m, tx, ty) {
    const fk = m.seed + ':' + m.floor + ':' + (m.geometry || 0) + ':' + doorKey(m); if (HOME.fk !== fk) { HOME.clear(); HOME.fk = fk; }
    const key = ty * m.W + tx; let d = HOME.get(key);
    if (!d) { d = bfs(m, tx, ty, 400); if (HOME.size >= 24) HOME.delete(HOME.keys().next().value); }
    else HOME.delete(key);
    HOME.set(key, d); return d;
  }
  // fog of war: a cell opens when the hero has a line of sight to it (rock and fake walls block it, lava and deep water don't) within 8×6 cells;
  // the wall cells around what is seen open with it, and two more above each, so the 3/4 facades show whole. A room opens whole
  // as soon as any of its floor is in sight, its own ring of wall too, but never the floor of a room behind a thin wall (TASKS 104)
  const REV = { arr: null, k: '' };
  const CHOICE = new WeakMap();
  function reveal(R) {
    const m = R.map, h = R.hero, W = m.W, tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE), ri2 = DG.roomAt(m, h.x, h.y);
    const k = tx + ':' + ty + ':' + (m.secrets || []).map((q) => q.open).join('') + ':' + doorKey(m);
    if (REV.arr === R.seen && REV.k === k) return ri2;
    REV.arr = R.seen; REV.k = k;
    const hid = secretMask(m), inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < m.H;
    const opaque = (x, y) => { if (!inMap(x, y)) return true; const n = y * W + x, c = m.cells[n]; return (c !== 1 && c !== 3 && c !== 6) || hid.has(n); };
    const wall = (x, y) => { if (!inMap(x, y) || !opaque(x, y)) return; for (let d = 0; d <= 2 && inMap(x, y - d) && opaque(x, y - d); d++) R.seen[(y - d) * W + x] = 1; };
    const fx = h.x / TILE, fy = h.y / TILE;
    const sight = (x, y) => { const dx = x + 0.5 - fx, dy = y + 0.5 - fy, n = Math.ceil(Math.hypot(dx, dy) * 3);
      for (let i = 1; i < n; i++) { const cx = Math.floor(fx + dx * i / n), cy = Math.floor(fy + dy * i / n); if (cx === x && cy === y) break; if (opaque(cx, cy)) return false; } return true; };
    // on the plateaus (TASKS 453) the window is an ellipse, not its 17×13 box: over open lava nothing stops the sight, and the box's
    // straight sides showed as a rectangle of lava in the dark
    // (its rim varies cell by cell, TASKS 482: a walk along a straight way swept the ellipse's edge into a straight line)
    // (a smooth noise over 3 cells, TASKS 1037: hashed cell by cell it left single cells revealed out in the fog, crumbs of lava)
    // (and ±0.1 cell by cell on the rim, TASKS 1048, 1056: smooth alone, the edge ran straight along the lava again)
    const hh = (x, y) => { const q = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return q - Math.floor(q); };
    const h01 = (x, y) => { const gx = x / 3, gy = y / 3, x0 = Math.floor(gx), y0 = Math.floor(gy), fx0 = gx - x0, fy0 = gy - y0, sx0 = fx0 * fx0 * (3 - 2 * fx0), sy0 = fy0 * fy0 * (3 - 2 * fy0);
      return (hh(x0, y0) * (1 - sx0) + hh(x0 + 1, y0) * sx0) * (1 - sy0) + (hh(x0, y0 + 1) * (1 - sx0) + hh(x0 + 1, y0 + 1) * sx0) * sy0; };
    const rooms = new Set(), oval = !!m.cliff;
    for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 8; x <= tx + 8; x++) { if (!inMap(x, y) || (oval && ((x + 0.5 - fx) / 8.5) ** 2 + ((y + 0.5 - fy) / 6.5) ** 2 > (0.72 + 0.28 * h01(x, y) + (hh(x + 31, y + 17) - 0.5) * 0.2) ** 2) || !sight(x, y)) continue;
      if (opaque(x, y)) { wall(x, y); continue; }
      R.seen[y * W + x] = 1; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) wall(x + u, y + v);
      const ri = DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE); if (ri >= 0) rooms.add(ri); }
    // a room shows whole once seen; a plateau's box is mostly lava, so there only its floor and the lava within two cells of it
    // (TASKS 453: the whole box was a rectangle of lava cut out of the dark)
    // (by distance, with a reach of 1.6–3.2 cells that varies cell by cell, TASKS 482: within a 5×5 square the edge ran ruler-straight
    // along the floor's own rows for 6–18 cells)
    const nearFloor = (x, y, r) => { const rr = 1.6 + 1.6 * h01(x, y) + (hh(x + 7, y + 91) - 0.5) * 1.4; for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) { const X = x + u, Y = y + v;
      if (u * u + v * v <= rr * rr && X >= r.x - 1 && X <= r.x + r.w && Y >= r.y - 1 && Y <= r.y + r.h && inMap(X, Y) && m.cells[Y * W + X] === 1) return true; } return false; };
    for (const ri of rooms) { if (R.rseen[ri]) continue; R.rseen[ri] = 1; const r = m.rooms[ri];
      for (const [bx, by, bw, bh] of DG.rectsOf(r)) for (let y = by - 2; y <= by + bh + 1; y++) for (let x = bx - 2; x <= bx + bw + 1; x++) { if (!inMap(x, y)) continue;
        const own = DG.inRm(r, x, y);
        if (oval && m.cells[y * W + x] !== 1 && !nearFloor(x, y, r)) continue;
        if (opaque(x, y)) wall(x, y); else if (own || DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) < 0) R.seen[y * W + x] = 1; } }
    // a lake's or a river's choice (dungeon.js m.choice, TASKS 486): every way over and the stairs show from the first bank
    if (m.choice && R.choiceShown !== R.floor) { let A = CHOICE.get(m); if (!A) CHOICE.set(m, A = new Set(m.choice.at));
      // (each way as a lane of the cells within two of it, TASKS 1037: its floor alone showed as crumbs scattered in the fog)
      // (TASKS 1048: grown out from what is seen, each lane joined to it; laid whole, a lane hung in the fog, a loose piece of lava;
      // the stairs' room shows apart, as the goal)
      if (A.has(ty * W + tx)) { R.choiceShown = R.floor; const lane = new Set(), ex = m.exit.tx, ey = m.exit.ty;
        for (const k of m.choice.show) { const x = k % W, y = Math.floor(k / W); if (Math.abs(x - ex) <= 5 && Math.abs(y - ey) <= 5) { R.seen[k] = 1; continue; }
          for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if (u * u + v * v <= 2.5 + 5 * hh(x + u + 3, y + v + 61) && inMap(x + u, y + v)) lane.add((y + v) * W + x + u); }   // (ragged, TASKS 1056: an even lane ran straight beside a straight way)
        const q = [...lane].filter((k) => !R.seen[k] && [1, -1, W, -W].some((o) => R.seen[k + o] && !opaque((k + o) % W, Math.floor((k + o) / W))));
        for (let i = 0; i < q.length; i++) { const k = q[i]; if (R.seen[k]) continue; const x = k % W, y = Math.floor(k / W); if (opaque(x, y)) { wall(x, y); continue; } R.seen[k] = 1;
          for (const o of [1, -1, W, -W]) if (lane.has(k + o) && !R.seen[k + o]) q.push(k + o); } } }
    // an open cell the reveal's edges left unseen in the middle of seen ones shows (TASKS 482: black holes inside the open lava)
    if (oval) for (let y = ty - 14; y <= ty + 14; y++) for (let x = tx - 18; x <= tx + 18; x++) { if (!inMap(x, y) || R.seen[y * W + x] || opaque(x, y)) continue;
      let n = 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if ((u || v) && inMap(x + u, y + v) && R.seen[(y + v) * W + x + u]) n++;
      if (n >= 6) R.seen[y * W + x] = 1; }
    // and a closed pocket of up to 40 unseen open cells, seen cells all round it and off the map's edge, shows whole (TASKS 1037: the
    // rule above closed single cells only; pockets of 3–29 stayed black inside the open lava)
    if (oval) { const got = new Set(); for (let y = ty - 12; y <= ty + 12; y++) for (let x = tx - 16; x <= tx + 16; x++) { const k0 = y * W + x; if (!inMap(x, y) || R.seen[k0] || opaque(x, y) || got.has(k0)) continue;
        const q = [k0]; got.add(k0); let closed = true;
        for (let i = 0; i < q.length && closed; i++) { const qx = q[i] % W, qy = Math.floor(q[i] / W); if (qx <= 0 || qy <= 0 || qx >= W - 1 || qy >= m.H - 1 || q.length > 40) { closed = false; break; }
          for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = qx + u, ny = qy + v, nk = ny * W + nx; if (R.seen[nk] || got.has(nk)) continue; if (opaque(nx, ny)) { closed = false; break; } got.add(nk); q.push(nk); } }
        if (closed) for (const k of q) R.seen[k] = 1; } }
    // (a lone cell of lava seen with nothing seen round it is a crumb in the fog, not a view: it goes back under it)
    if (oval) for (let y = ty - 12; y <= ty + 12; y++) for (let x = tx - 16; x <= tx + 16; x++) { const k = y * W + x; if (!inMap(x, y) || !R.seen[k] || m.cells[k] !== 3) continue;
      let n = 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if ((u || v) && inMap(x + u, y + v) && R.seen[(y + v) * W + x + u]) n++; if (n === 0) R.seen[k] = 0; }
    // a door once seen shows whole: its leaf stands over the cells behind it (a top wall's over the corridor, a bottom wall's over the room)
    for (const d of m.doors || []) { if (!d.cells.some(([x, y]) => R.seen[y * W + x])) continue; const up = d.dir === 'u' ? [1, 2] : d.dir === 'd' ? [-1] : [];
      for (const [x, y] of d.cells) { R.seen[y * W + x] = 1; for (const k of up) if (inMap(x, y - k)) R.seen[(y - k) * W + x] = 1; } }
    return ri2;
  }
  // the camera may leave the map by more than the HUD's width, so a room at the edge never sits under the minimap or the bars
  function clampCam(R, c) { const m = R.map, w = WIN(R); c[0] = clamp(c[0], -620, m.W * TILE - w.W + 620); c[1] = clamp(c[1], -380, m.H * TILE - w.H + 300); }

  // ---------------- hero helpers ----------------
  const heroSt = (S) => stats(S.run.hero, S.meta);
  // where the hero's weapon hand / spells come from (shared with the rig: SIM.RIG.shoulder above the feet)
  const RIG = { shoulder: 51, arm: 28 };
  // one step's travel: shorter when walking toward / away from the camera, so planted feet keep pace with the ground
  const stepLen = (ux) => K.STEP * (0.82 + 0.18 * Math.min(1, ux));
  const hand = (h) => [h.x + Math.cos(h.aim) * 23, h.y - RIG.shoulder + 8 + Math.sin(h.aim) * 15];
  function bagAdd(R, it) {
    const h = R.hero;
    if (isCons(it)) { const st = h.bag.find((b) => b && b.b === it.b && b.n < CONSUMABLES[it.b].stack); if (st) { st.n += it.n || 1; return true; } }
    const i = h.bag.indexOf(null); if (i < 0) return false; if (!it.id) it.id = R.nextId++; h.bag[i] = it; return true;
  }
  function gainXp(S, R, n) {
    const h = R.hero; n = Math.round(n * dif(R, 'xp')); h.xp += n; if (R.log) logFloor(R).xp += n;
    while (h.xp >= D.xpNeed(h.lvl)) { h.xp -= D.xpNeed(h.lvl); h.lvl++; h.pts += 3; h.sp += 1;
      for (const a of ABILITIES) if (a.unlock === h.lvl && !h.ab[a.id]) { h.ab[a.id] = 1; ev(S, { k: 'unlock', x: h.x, y: h.y, id: a.id }); }
      const st = heroSt(S); h.hp = st.maxHp; h.mp = st.maxMp; ev(S, { k: 'lvl', x: h.x, y: h.y, lvl: h.lvl }); }
  }
  // no invulnerability after a blow (the balance was tuned without it). A dash leaps spikes and lava; against a monster's blow, bolt
  // or blast it only adds to the chance to dodge (BAL.dodge), it never makes the hero immune. No single monster blow takes more
  // than BAL.cap of the health (the boss's more), so an unlucky stack of elite multipliers cannot kill through a potion
  function absorbShield(S, o, dmg, extra = {}) {
    if (!(o.shield > 0 && S.t < o.shieldUntil)) return dmg;
    const n = Math.min(o.shield, dmg); o.shield -= n; ev(S, Object.assign({ k: 'absorb', x: o.x, y: o.y, n }, extra)); return dmg - n;
  }
  function hurtHero(S, R, dmg, sx, sy, kind, src, actor) {
    const h = R.hero; if (h.deadT >= 0 || S.t < h.ifr || R.town) return;
    const dashing = S.t - h.dashT < BAL.dodge.t; if (dashing && (kind === 'spike' || src === 'lava')) return;
    if (kind !== 'spike' && src !== 'lava' && rnd(R) * 100 < heroSt(S).dodge + (dashing ? BAL.dodge.dash : 0)) { ev(S, { k: 'dodge', x: h.x, y: h.y, dash: dashing ? 1 : 0 }); return; }
    if (h.read) { h.read = null; ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Чтение прервано' }); }
    // a weapon a fire priest set alight (TASKS 410): a harder blow that sets the hero burning
    if (actor && actor.fireT > S.t && kind === undefined && !/ (снаряд|взрыв|столб)$/.test(src || '')) { dmg *= ENEMIES.fire_priest.kindle.dmg; kind = 'fire'; }
    const st = heroSt(S), KD = 20 + 12 * dep(R); dmg *= dif(R, 'dmg'); dmg = kind === 'spike' ? Math.round(dmg) : Math.max(1, Math.round(dmg * KD / (KD + st.def)));   // armour's share falls as floors climb: deep monsters still bite
    if (src && src !== 'lava') dmg = Math.min(dmg, Math.round(st.maxHp * (/^boss/.test(src) ? BAL.cap.boss : BAL.cap.blow)));
    // blow: what landed before the shield took its part, for the balance tools' blow-size bands (TASKS 225)
    const blow = dmg;
    dmg = absorbShield(S, h, dmg, { blow, src: src || kind || '?' }); if (dmg <= 0) return;
    h.hp -= dmg; h.lastHit = dmg; h.hurtT = S.t; h.hurtX = Math.abs(h.x - sx) < 4 ? 0 : h.x > sx ? 1 : -1; R.trauma = Math.min(1, R.trauma + 0.35); R.freeze = Math.max(R.freeze, 0.05);
    const dx = h.x - sx, dy = h.y - sy, d = Math.hypot(dx, dy) || 1; h.vx += dx / d * 260; h.vy += dy / d * 260;
    if (kind === 'poison') h.poison = S.t + 3;
    if (kind === 'fire') h.burn = Math.max(h.burn, S.t + 3);
    if (kind === 'water') { h.slowT = S.t + ORB.t; ev(S, { k: 'soak', x: h.x, y: h.y - 38 }); }
    ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n: dmg, blow, side: h.hurtX || -1, src: src || kind || '?',
      actor: actor ? { type: actor.type, elite: actor.elite, mods: (actor.mods || []).slice() } : null });
    // a second chance (a gift): the killing blow leaves half the health instead, once per gift taken
    if (h.hp <= 0 && (h.perks || {}).phoenix > (h.revived || 0)) { h.revived = (h.revived || 0) + 1; h.hp = Math.round(st.maxHp * GIFT_V.phoenix / 100); h.ifr = S.t + 1.2;
      ev(S, { k: 'bless', x: h.x, y: h.y, id: 'phoenix' }); R.msg = { s: 'Второй шанс!', t: S.t }; return; }
    if (h.hp <= 0) { h.hp = 0; h.deadT = S.t; ev(S, { k: 'die', x: h.x, y: h.y }); }
  }
  // (ax, ay): where the blow came from on the floor, when not its source (a bolt bursts at the height of the body it hit)
  // the hero's own blows (a swing, the whirl, a fireball's burst): what a reflecting or cursing elite answers (TASKS 387)
  let byHero = 0;
  const heroHit = (...a) => { byHero = 1; try { hitEnemy(...a); } finally { byHero = 0; } };
  function hitEnemy(S, R, e, dmg, crit, sx, sy, kb = 1, kind, ax = sx, ay = sy) {
    const fromHero = byHero; byHero = 0;
    if (e.deadT >= 0 || under(e) || R.town) return;
    if (fromHero && R.hero.curseT > S.t) dmg = Math.max(1, Math.round(dmg * MOD.curse.k));
    if (R.map.bossType === e.type && !R.arena) { stepArena(S, R); if (!R.arena) return; }
    if (D.BOSSES[e.type] && e.st === 'bwind') dmg *= D.bossMove(e).vulnerable || 1;
    if (D.BOSSES[e.type] && e.openUntil > S.t) dmg *= e.type === 'boss_serpent' ? 1.4 : D.BOSSES[e.type].moves.fists.open;
    let arm = armored(e, ENEMIES[e.type], ax, ay); if (arm) { dmg = Math.max(1, Math.round(dmg * ((e.elite && ENEMIES[e.type].armor.elite) || ENEMIES[e.type].armor.k))); e.armT = S.t; }
    // a golem's crust takes the blow and a plate of it comes off (TASKS 409); its fire doesn't
    const CR0 = ENEMIES[e.type].crust; if (CR0 && kind !== 'burn' && kind !== 'thorns' && crustOf(e, ENEMIES[e.type]) > 0) { dmg = Math.max(1, Math.round(dmg * CR0.k)); const n0 = crustOf(e, ENEMIES[e.type]); e.crust = n0 - 1; e.growT = S.t; e.armT = S.t; arm = true;
      (e.plateT = e.plateT || {})[n0] = S.t; (e.plateA = e.plateA || {})[n0] = Math.atan2(e.y - sy, e.x - sx); }   // (which plate went when, and which way: the render throws it off)
    dmg = absorbShield(S, e, dmg, { id: e.id }); if (dmg <= 0) return;
    if (e.ward > 0 && kind !== 'burn') { const back = Math.hypot(ax - e.x, ay - e.y) > 1 && Math.abs(angDiff(Math.atan2(ay - e.y, ax - e.x), faOf(e))) > Math.PI / 2;
      if (back) { e.ward = 0; ev(S, { k: 'ward_break', x: e.x, y: e.y - ENEMIES[e.type].h * 0.5, id: e.id }); }
      else { const n = Math.min(e.ward, dmg); e.ward -= n; dmg -= n; ev(S, { k: 'absorb', x: e.x, y: e.y, n, id: e.id, ward: 1 }); if (e.ward <= 0) ev(S, { k: 'ward_break', x: e.x, y: e.y - ENEMIES[e.type].h * 0.5, id: e.id }); if (e.st === 'idle' || e.st === 'home') aggroRoom(R, e); if (dmg <= 0) return; } }
    if (gift(R.hero, 'execute') && e.hp < 0.25 * e.max) dmg = Math.round(dmg * (1 + gift(R.hero, 'execute') / 100));
    // blowT: a blow, not a burn's tick (a golem's crust grows back once the blows stop, TASKS 409)
    e.hp -= dmg; e.hitP = e.hitT; e.hitT = S.t; if (kind !== 'burn' && kind !== 'thorns') e.blowT = S.t; if (e.st === 'idle' || e.st === 'home') aggroRoom(R, e); if (e.st === 'lurk') rise(S, R, e);
    const dx = e.x - sx, dy = e.y - sy, d = Math.hypot(dx, dy) || 1, heavy = e.type === 'brute' || ENEMIES[e.type].heavy || e.elite || ENEMIES[e.type].ghost || ENEMIES[e.type].deep || e.st === 'rise' || e.st === 'leap';
    if (!heavy && !arm) { const kk = kb > 0 && R.map.cliff && pushable(e) && atBrink(R.map, e, sx, sy) ? kb * D.BRINK.kb : kb; e.kbx += dx / d * 300 * kk; e.kby += dy / d * 300 * kk; }
    if (kind === 'fire' && !ENEMIES[e.type].lava) { e.burn = S.t + 3; e.burnT = S.t; }
    ev(S, Object.assign({ k: 'hit', x: e.x, y: e.y - ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: dmg, crit: crit ? 1 : 0, id: e.id, fire: kind === 'fire' ? 1 : 0 }, arm ? { arm: 1, a: Math.atan2(ay - e.y, ax - e.x) } : {}));
    R.freeze = Math.max(R.freeze, crit ? 0.06 : 0.035); R.trauma = Math.min(1, R.trauma + (crit ? 0.22 : 0.12));
    const st = heroSt(S); if (kind !== 'burn' && kind !== 'thorns') R.hero.hp = Math.min(st.maxHp, R.hero.hp + dmg * st.leech / 100 + st.onhit);
    if (fromHero && has(e, 'reflect') && kind !== 'burn') { const h = R.hero, n = Math.min(Math.round(dmg * MOD.reflect.k), Math.max(0, Math.ceil(h.hp) - 1));
      if (n > 0 && h.deadT < 0) { h.hp -= n; ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n, blow: n, side: h.x > e.x ? 1 : -1, src: e.type + ' отражение', reflect: 1 }); } }
    if (e.hp <= 0) { e.dieA = Math.atan2(dy, dx); killEnemy(S, R, e); }   // the killing blow's direction: bones fly that way
  }
  function aggroRoom(R, e) { for (const o of R.en) if (o.deadT < 0 && (!D.BOSSES[o.type] || !R.map.bossType || R.arena) && (o === e || o.st === 'idle') && (o.room === e.room || (Math.hypot(o.x - e.x, o.y - e.y) < 220 && losClear(R.map, o.x, o.y - 10, e.x, e.y - 10)))) { o.st = 'chase'; o.t0 = o.seenT = R.t; }
    if (e.st === 'home') { e.st = 'chase'; e.t0 = e.seenT = R.t; } }
  // how long a monster knocked off a plateau takes to go: falling into the chasm, sinking burning in the lava (TASKS 401)
  const DOOM = { fall: 0.7, sink: 1.5 };
  // the crust under the hero or a monster knocked onto it: standing CRUST.stand s cracks it and its crusted neighbours (light, a
  // crack), CRUST.crack s on they are lava for CRUST.hot s, then they set again; stepping off before it cracks lets it be
  function stepCrust(S, R) {
    const m = R.map, t = S.t, cs = crustSet(m); if (!cs) return; const M = m.melt || (m.melt = {}), on = new Set();
    for (const o of [R.hero].concat(R.en)) { if (o.deadT >= 0 || (o !== R.hero && ENEMIES[o.type].ghost)) continue; const k = Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE); if (cs.has(k)) on.add(k); }
    for (const k of on) { const q = M[k] || (M[k] = { on: 0 }); if (q.crackT !== undefined) continue; q.on += DT; if (q.on < (thinSet(m).has(k) ? CRUST.thin : CRUST.stand)) continue;
      for (const n of [k, k + 1, k - 1, k + m.W, k - m.W]) if (cs.has(n) && (!M[n] || M[n].crackT === undefined)) M[n] = { on: CRUST.stand, crackT: t };
      ev(S, { k: 'crack', x: (k % m.W + 0.5) * TILE, y: (Math.floor(k / m.W) + 0.5) * TILE }); }
    for (const key in M) { const q = M[key], k = +key, x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE;
      // (a thin crust keeps the time stood on it, TASKS 484: there and back at a walk it holds, a pause on it on either way does not)
      if (q.crackT === undefined) { if (!on.has(k) && !thinSet(m).has(k) && (q.on -= 2 * DT) <= 0) delete M[key]; continue; }
      if (!q.hot && q.meltT === undefined && t >= q.crackT + CRUST.crack) { q.hot = 1; q.meltT = t; ev(S, { k: 'melt', x, y });
        // (only a hoard's thin crust drops him in, TASKS 484: a bank's, looking a firm stone path, did in a fight 4 seeds out of 4 and
        // the colossus's 3 times in 12 s; there it is lava again, burning as lava does, to be stepped off)
        const h = R.hero; if (h.hp > 0 && thinSet(m).has(k) && Math.floor(h.y / TILE) * m.W + Math.floor(h.x / TILE) === k) lavaFall(S, R, h); }
      else if (q.hot && t >= q.meltT + CRUST.hot) { q.hot = 0; q.setT = t; ev(S, { k: 'set', x, y }); }
      else if (!q.hot && q.setT !== undefined && t >= q.setT + CRUST.set) delete M[key]; }
  }
  // the hero falls through the crust into the lava (TASKS 476): hurt and alight, he climbs out where he last stood on firm ground
  function lavaFall(S, R, h) { const fx = h.x, fy = h.y, back = h.safe || landOf(R.map, h.x, h.y);
    // (a second fall straight after a first costs nothing more, TASKS 1057: the climb's hold put it past his grace, 70 % for two)
    if (S.t - (h.lavaFallT ?? -9) > 3) hurtHero(S, R, heroSt(S).maxHp * CRUST.fall, fx, fy - 10, 'spike', 'lava'); h.lavaFallT = S.t; if (h.hp <= 0) return;
    if (h.burn <= S.t) h.burnT = S.t - 0.5; h.burn = Math.max(h.burn, S.t + CRUST.burn);
    h.sunk = { t: S.t, x: fx, y: fy, bx: back[0], by: back[1] }; h.vx = h.vy = 0; h.dashT = -9; h.ifr = Math.max(h.ifr || 0, S.t + CRUST.sink + 1); R.trauma = Math.min(1, R.trauma + 0.35);
    ev(S, { k: 'lavafall', x: fx, y: fy, tx: back[0], ty: back[1] }); }
  // the floor nearest a spot off it (a monster gone into the lava or the chasm drops its loot on the bank)
  function landOf(m, x, y) { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (cell(m, tx, ty) === 1) return [x, y];
    for (let r = 1; r <= 8; r++) { let best = null; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (Math.max(Math.abs(i), Math.abs(j)) === r && cell(m, tx + i, ty + j) === 1) { const d = i * i + j * j; if (!best || d < best[2]) best = [tx + i, ty + j, d]; }
      if (best) return [(best[0] + 0.5) * TILE, (best[1] + 0.5) * TILE + 6]; } return [x, y]; }
  function killEnemy(S, R, e) {
    if (e.type === 'boss_colossus') e.deathPose = { ...e };
    e.deadT = S.t; e.hp = 0; R.kills++;
    if (gift(R.hero, 'feast') && R.hero.deadT < 0) { const st = heroSt(S); R.hero.hp = Math.min(st.maxHp, R.hero.hp + st.maxHp * gift(R.hero, 'feast') / 100); } if (counted(e)) { fstat(R).kills++; checkFull(S, R); } R.freeze = Math.max(R.freeze, 0.07); R.trauma = Math.min(1, R.trauma + 0.25);
    const E = ENEMIES[e.type]; const nm = e.mods ? e.mods.length : 0; gainXp(S, R, Math.round(E.xp * BAL.reward * (1 + 0.3 * (dep(R) - 1)) * (e.elite && !D.BOSSES[e.type] ? 3 + nm : 1)));
    if (E.puddle) (R.map.goo = R.map.goo || []).push({ id: R.nextId++, x: e.x, y: e.y, t0: S.t, T: E.puddle.t, r: E.puddle.r, rNow: E.puddle.r });
    if (E.split) split(S, R, e, E);
    // a golem falls apart into a pool of lava (TASKS 409)
    if (E.pool && e.sinkT === undefined && e.fallT === undefined) { addFire(R, S, e.x, e.y, { src: e.id, who: who(e), r: E.pool.r, ry: E.pool.ry, t: E.pool.t, dmg: e.dmg * E.pool.dmg, per: E.pool.per, arm: E.pool.arm, kind: 'pool' }); ev(S, { k: 'pool', x: e.x, y: e.y, r: E.pool.r, d: E.pool.t, id: e.id }); }
    // a smouldering skeleton killed bursts too, unless it went off itself or into the lava or the chasm; one already lit keeps its fuse
    if (E.boom) { if (e.blown || e.fallT !== undefined || e.sinkT !== undefined) e.fuse = 0; else if (!(e.fuse > S.t)) { e.fuse = fuseEnd(R, S.t + E.boom.fuse); ev(S, { k: 'fuse', x: e.x, y: e.y, r: E.boom.r, d: e.fuse - S.t, id: e.id }); } }
    else if (has(e, 'explosive')) { e.fuse = fuseEnd(R, S.t + MOD.explosive.fuse); ev(S, { k: 'fuse', x: e.x, y: e.y, r: MOD.explosive.r, d: e.fuse - S.t, id: e.id }); }
    ev(S, Object.assign({ k: 'kill', x: e.x, y: e.y, type: e.type, id: e.id, elite: e.elite && !D.BOSSES[e.type] ? 1 : 0, boss: D.BOSSES[e.type] ? 1 : 0 }, e.quest ? { quest: e.quest } : {}, e.sinkT !== undefined || e.fallT !== undefined ? { gone: 1 } : {}));
    // the last monster of a room down: the room is cleared (TASKS 1017, a quest's goal)
    if (counted(e) && e.room !== undefined && e.room >= 0 && !R.en.some((o) => o !== e && o.room === e.room && o.deadT < 0 && counted(o))) ev(S, { k: 'clear', x: e.x, y: e.y, room: e.room });
    // a raised skeleton pays its XP but carries nothing: a summoner is not a gold mine
    if (e.summ) return;
    const [lx, ly] = landOf(R.map, e.x, e.y), ox = e.x, oy = e.y; e.x = lx; e.y = ly;
    if (e.key !== undefined) drop(R, e.x, e.y, { kind: 'key', lock: e.key });
    const gb = 1 + 0.15 * ((S.meta.up || {}).gold || 0);
    if (rnd(R) < 0.55 || e.elite) drop(R, e.x, e.y, { kind: 'gold', n: Math.round((3 + ri(R, 0, 6) + dep(R) * 2) * (e.elite ? 4 + 2 * nm : 1) * gb * BAL.reward) });
    const LT = e.type === 'brute' && e.elite ? LOOT.brute : e.elite ? LOOT.elite : LOOT.mob;
    if (!D.BOSSES[e.type] && (e.elite || rnd(R) < LT.p * BAL.reward)) for (let i = 0, n = 1 + (rnd(R) < (LT.extra || 0) ? 1 : 0); i < n; i++) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), LT.q, undefined, LT) });
    if (rnd(R) < POT.kill * BAL.reward) drop(R, e.x, e.y, { kind: 'item', item: potion(rnd(R) < 0.65 ? 'hp_potion' : 'mp_potion') });
    // a chapter boss replaced an exit guard worth 1 shard: 3 for a sealed fight that is harder, far below the finale's 20 (TASKS 227)
    // the boss closing a chapter (the demon lord on the campaign's 8th, TASKS 339) pays as the finale did: its shards and its loot
    const fin = D.BOSSES[e.type] && lastFloor(R), big = D.BOSSES[e.type] && (fin || chapterEnd(R, e)), sh = D.BOSSES[e.type] ? (big ? 20 : 3) : e.elite ? 1 : 0; if (sh) drop(R, e.x, e.y, { kind: 'shard', n: sh });
    if (D.BOSSES[e.type]) { finishArena(S, R, e); if (R.viaTown) { R.bossN = (R.bossN || 0) + 1; R.lastBoss = e.type; (R.slain = R.slain || []).push(R.floor); } }
    if (big) for (const o of LOOT.boss) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), o.q, undefined, o) });
    if (fin) { R.bossDead = 1; R.msg = { s: ENEMIES[e.type].name + ' повержен! Портал наружу открыт', t: S.t }; }
    e.x = ox; e.y = oy;
  }
  // a thrown-away item lands on a free neighbouring cell and stays put until the hero has walked away from it and comes back
  function throwAway(R, h, it) {
    const m = R.map, tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE), taken = (x, y) => R.drops.some((p) => Math.floor(p.x / TILE) === x && Math.floor(p.y / TILE) === y);
    let best = null;
    for (let r = 1; r <= 3 && !best; r++) for (let j = -r; j <= r && !best; j++) for (let i = -r; i <= r; i++) { if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      const x = tx + i, y = ty + j; if (cell(m, x, y) === 1 && !taken(x, y) && !solids(R).some((o) => Math.hypot(o.x - (x * TILE + 16), o.y - (y * TILE + 18)) < o.r + 8)) { best = [x, y]; break; } }
    const [x, y] = best || [tx, ty];
    if (!it.id) it.id = R.nextId++;
    R.drops.push({ id: R.nextId++, kind: 'item', item: it, x: h.x, y: h.y - 10, vx: (x * TILE + 16 - h.x) / 0.45, vy: (y * TILE + 20 - h.y) / 0.45, z: 0, vz: 200, t0: R.t, tossed: 1, fly: 0.45 });
  }
  // potion drops: a floor cleared whole gives ~2.5 health potions (it gave ~9, and a player drank 4 in a whole run, TASKS 154)
  // scroll: a chest's scroll of return; in a run through the town it is the way home and back (TASKS 1024): at a chest's quarter the bot
  // found 14 a run, went home ten times and the potions never ran out (the average past the 8th in 83 % of runs, the campaign's 70 %)
  const POT = { chest: 0.085, vase: 0.07, pot: 0.055, kill: 0.007, scroll: 0.25, scrollTown: 0.07 };
  function drop(R, x, y, o) { const a = rnd(R) * Math.PI * 2, v = 60 + rnd(R) * 90; if (o.item && !o.item.id) o.item.id = R.nextId++;
    if (o.kind === 'item') { o.loot = 1; if (!o.pre) fstat(R).lootN++; delete o.pre; }
    R.drops.push(Object.assign({ id: R.nextId++, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 0, vz: 160 + rnd(R) * 80, t0: R.t }, o)); }

  // ---------------- actions ----------------
  function usePotion(S, R, b) {
    const h = R.hero, i = h.bag.findIndex((it) => it && it.b === b); if (i < 0) { ev(S, { k: 'nope', x: h.x, y: h.y, s: b === 'hp_potion' ? 'Нет зелий здоровья' : 'Нет зелий маны' }); return; }
    const st = heroSt(S), it = h.bag[i];
    const brew = 1 + gift(h, 'thrift') / 100;
    if (b === 'hp_potion') h.hp = Math.min(st.maxHp, h.hp + st.maxHp * CONSUMABLES.hp_potion.heal * brew); else h.mp = Math.min(st.maxMp, h.mp + st.maxMp * CONSUMABLES.mp_potion.mana * brew);
    if (--it.n <= 0) h.bag[i] = null; ev(S, { k: 'drink', x: h.x, y: h.y, b });
  }
  // gear for an empty slot goes straight onto the hero instead of into the bag
  function wearIfFree(S, R, it) {
    const h = R.hero, b = BASES[it.b]; if (isCons(it) || !b || !b.slot || h.eq[b.slot] || h.lvl < D.reqLvl(it)) return false;
    h.eq[b.slot] = it; ev(S, { k: 'equip', x: h.x, y: h.y, slot: b.slot, on: gearName(it) }); return true;
  }
  const READ_T = 1.6, bossFight = (R) => !!(R.map.bossType && R.en.some((e) => D.BOSSES[e.type] && e.deadT < 0 && e.st !== 'idle'));
  // the scroll being read: a step, a dash or a blow breaks it off (the scroll is kept); read through, the portal opens where the hero
  // stands and takes him to the town's ring of stones; its pair in the town brings him back to that spot (and closes)
  // its flash only where he comes out: one where he left lit the new floor at the old one's coordinates (TASKS 1025)
  function readStep(S, R, moved, dashing) { const h = R.hero, q = h.read;
    if (moved || dashing || h.deadT >= 0 || h.atkT > q.t0 || (h.castT ?? -9) > q.t0) { h.read = null; ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Чтение прервано' }); return; }
    if (S.t - q.t0 < READ_T) return;
    const it = h.bag[q.i]; h.read = null; if (!it || it.b !== 'scroll') return; if (--it.n <= 0) h.bag[q.i] = null;
    R.portal = { f: R.floor, x: h.x, y: h.y }; enterFloor(S, R, 0, undefined, 'portal'); ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); }
  function useItem(S, R, idx) {
    const h = R.hero, it = h.bag[idx]; if (!it) return;
    if (it.b === 'hp_potion' || it.b === 'mp_potion') { usePotion(S, R, it.b); return; }
    // in a run through the town (TASKS 1007) the scroll is read on the spot, READ_T s standing still, and opens a portal home
    if (it.b === 'scroll' && R.viaTown) { S.screen = 'play';
      if (R.town) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'В городе свиток не нужен' }); return; }
      if (bossFight(R)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Не посреди боя с боссом' }); return; }
      h.read = { t0: S.t, i: idx }; h.vx = h.vy = 0; ev(S, { k: 'read', x: h.x, y: h.y }); return; }
    if (it.b === 'scroll') { const m = R.map, fx = h.x, fy = h.y; h.x = m.spawn.x; h.y = m.spawn.y; if (--it.n <= 0) h.bag[idx] = null; ev(S, { k: 'teleport', x: h.x, y: h.y, fx, fy }); return; }
    // gear above the hero's level stays in the bag (TASKS 1028)
    if (h.lvl < D.reqLvl(it)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Требуется уровень ' + D.reqLvl(it) }); return; }
    const slot = BASES[it.b].slot, old = h.eq[slot]; h.eq[slot] = it; h.bag[idx] = old || null; ev(S, { k: 'equip', x: h.x, y: h.y, slot, on: gearName(it), off: gearName(old) });
    const st = heroSt(S); h.hp = Math.min(h.hp, st.maxHp); h.mp = Math.min(h.mp, st.maxMp);
  }
  function castAbility(S, R, id, inp) {
    const h = R.hero, A = ABILITIES.find((a) => a.id === id), rank = h.ab[id] || 0;
    if (!rank) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Откроется на ' + A.unlock + ' уровне' }); return; }
    if (h.cd[id] > S.t) return;
    if (h.mp < A.mp) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Не хватает маны' }); return; }
    const AR = D.abRank(id, rank); h.mp -= A.mp; h.cd[id] = S.t + A.cd * AR.cd; h.castT = S.t; h.castK = id;
    const st = heroSt(S);
    if (id === 'whirl') { h.whirlT = S.t; h.whirlA = h.aim; const dmgK = AR.k; S.meta.whirls = (S.meta.whirls || 0) + 1;
      const wr = AR.r; for (const e of R.en) { if (e.deadT >= 0) continue; const d = Math.hypot(e.x - h.x, (e.y - h.y) * 1.3); if (d < wr + ENEMIES[e.type].r && losClear(R.map, h.x, h.y, e.x, e.y)) { const c = rnd(R) * 100 < st.crit; heroHit(S, R, e, Math.round(st.atk * dmgK * (c ? 1.75 : 1)), c, h.x, h.y, 1.6); } }
      breakPots(S, R, h.x, h.y, wr); hitProps(S, R, h.x, h.y, wr); hitFolk(S, R, h.x, h.y, wr); hitChests(S, R, h.x, h.y, wr); hitSecrets(S, R, h.x, h.y, wr); hitDoors(S, R, h.x, h.y, wr); tearWebs(S, R, h.x, h.y, wr); ev(S, { k: 'whirl', x: h.x, y: h.y, a: h.aim, r: wr, rar: h.eq.weapon ? h.eq.weapon.rar : 0 }); }
    if (id === 'fireball') { const [hx, hy] = hand(h), a = h.aim, dmg = D.fireDmg(st.spellBase, AR.k, st.spell);
      R.proj.push({ id: R.nextId++, k: 'fire', x: hx, y: hy, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, t0: S.t, life: 1.1, dmg, own: 'hero', r: 8 }); ev(S, { k: 'cast', x: hx, y: hy, a }); }
    if (id === 'shield') { h.shield = D.shieldHp(st.int, rank, dep(R)); h.shieldUntil = S.t + D.SHIELD_T; h.shieldT = S.t; ev(S, { k: 'shield', x: h.x, y: h.y }); }
  }
  function breakPots(S, R, x, y, rad, ax, arc) {
    for (const p of R.pots) { if (p.hp <= 0) continue; const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 10) continue; if (arc !== undefined && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) continue; if (!losClear(R.map, x, y, p.x, p.y)) continue;
      p.hp = 0; p.brokeT = S.t; ev(S, { k: 'break', x: p.x, y: p.y, kind: p.kind });
      if (p.kind === 'gold' || p.kind === 'goldpile') { for (let k = 0; k < (p.rich ? 6 : p.kind === 'goldpile' ? 2 : 3); k++) drop(R, p.x, p.y, { kind: 'gold', n: ri(R, 4, 8) + dep(R) * 2 }); }
      else if (p.kind.startsWith('vase')) { drop(R, p.x, p.y, { kind: 'gold', n: ri(R, 4, 9) + dep(R) * 2 }); if (rnd(R) < POT.vase) drop(R, p.x, p.y, { kind: 'item', item: potion(rnd(R) < 0.7 ? 'hp_potion' : 'mp_potion') }); }
      else if (rnd(R) < 0.6) drop(R, p.x, p.y, { kind: 'gold', n: ri(R, 2, 5) + dep(R) }); else if (rnd(R) < POT.pot) drop(R, p.x, p.y, { kind: 'item', item: potion(rnd(R) < 0.7 ? 'hp_potion' : 'mp_potion') }); }
  }
  // big props don't break: each blow rocks, rings or chips them (scene.js), with a pause per prop so one swing is one knock
  // the townsfolk and hens in the way of a blow (TASKS 1033): it harms none of them, but each answers it: a townsman flinches and
  // says so (f.hitT, f.ouch), a hen flicks its tail and runs (the hero is close, so it flees him anyway)
  const FOLK_OUCH = ['Эй! Полегче!', 'Ты чего машешь?!', 'Осторожнее, герой!', 'Своих не бей!'];
  function hitFolk(S, R, x, y, rad, ax, arc) { if (!R.town || !R.folk) return;
    for (const f of R.folk) { const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy); if (d > rad + 12) continue;
      if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) continue; if (S.t - (f.hitT ?? -9) < 0.6) continue;
      f.hitT = S.t; if (f.role === 'hen') { f.scareT = S.t; f.goal = null; ev(S, { k: 'hen', x: f.x, y: f.y }); continue; }
      f.ouch = ((f.ouch ?? -1) + 1) % FOLK_OUCH.length; ev(S, { k: 'say', x: f.x, y: f.y, role: f.role, ouch: 1 }); } }
  function hitProps(S, R, x, y, rad, ax, arc, bonesOnly = false) {
    const m = R.map, hit = R.propHit || (R.propHit = {});
    // things on a wall are struck at their foot on the floor (the wall cell blocks the line), the event stays at the thing
    const knock = (id, p, n, mat = D.PROP_MAT[n] || 'stone', foot = p) => { const dx = foot.x - x, dy = foot.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 18) return false; if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) return false; if (!losClear(m, x, y, foot.x, foot.y)) return false;
      if (S.t - (hit[id] ?? -9) < 0.2) return false; hit[id] = S.t;
      if (mat === 'stone' || mat === 'metal') R.trauma = Math.min(1, R.trauma + 0.06);
      if (n !== 'merchant') ev(S, { k: 'prop', x: p.x, y: p.y, i: id, n, mat, scale: p.s || 1, s: dx >= 0 ? 1 : -1 }); return true; };
    m.decor.forEach((d, i) => { if (hidden(m, d)) return;
      if (d.n === 'bones' || d.n === 'skel_cv' || d.n === 'skel_mg') knock('d' + i, d, d.n);
      else if (bonesOnly) return;
      // the magma caves' dead things answer a blow too (TASKS 466): a crack spits embers, a chain fence clinks and swings
      else if (d.n === 'vent_mg') knock('d' + i, d, d.n);
      else if (d.n === 'fence_mg') { const f = { x: Math.max(d.x, Math.min(d.x + d.len, x)), y: d.y }; knock('d' + i, f, d.n, 'chain', f); }
      else if (d.n === 'candles' && !d.lift && (d.outUntil || 0) <= S.t) {
        if (knock('d' + i, d, d.n, 'wax')) { d.outUntil = S.t + 3; ev(S, { k: 'snuff', x: d.x, y: d.y }); } }
      else if (/^shroom_[ab]$/.test(d.n)) knock('d' + i, d, d.n, 'fungus');
      else if (d.wall && d.n === 'shop_sign') knock('d' + i, d, d.n, 'wood', { x: d.x, y: d.y + 30 });
      else if (d.solid && !d.wall) knock('d' + i, d, d.n);
      else if (d.wall && d.n === 'banner' && d.secret === undefined && !hidden(m, d)) knock('d' + i, d, 'banner', 'cloth', { x: d.x, y: d.y + 30 }); });
    if (bonesOnly) return;
    if (m.shop && R.shop && S.t - (R.shop.hitT ?? -9) >= 0.7 && knock('merchant', m.shop, 'merchant', 'cloth')) {
      R.shop.hitT = S.t; R.shop.hitLine = ((R.shop.hitLine ?? -1) + 1) % D.SHOP.hitLines.length;
      ev(S, { k: 'merchantHit', x: m.shop.x, y: m.shop.y }); }
    m.torches.forEach((t2, i) => { if (hidden(m, t2)) return; if (t2.kind !== 'wall') knock('t' + i, t2, 'brazier', D.PROP_MAT[t2.kind] || D.PROP_MAT.brazier);
      else knock('t' + i, t2, 'torch_sconce', 'metal', t2.side ? t2 : { x: t2.x, y: t2.y + 30 }); });
  }
  function hitChests(S, R, x, y, rad, ax, arc) {
    for (const c of R.chests) { if (c.open) continue; const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 16) continue; if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) continue; if (!losClear(R.map, x, y, c.x, c.y)) continue; openChest(S, R, c); } }
  // a secret's fake wall: its foot (q.x, q.y) is the middle of the opening on the host side. Blows land on a breakable wall,
  // a banner or a bookshelf in front of it if it is in reach and in the arc; a mechanism has to be found and worked instead
  const secretAt = (m, tx, ty) => (m.secrets || []).find((q) => !q.open && q.wall.some(([x, y]) => x === tx && y === ty));
  const kindOf = (q) => q.kind || 'crack';
  function hitSecrets(S, R, x, y, rad, ax, arc) {
    for (const q of R.map.secrets || []) { if (q.open) continue; const fy = q.y + (kindOf(q) === 'shelf' ? 22 : 0), dx = q.x - x, dy = fy - (y - 10), d = Math.hypot(dx, dy);
      if (d > rad + 26) continue; if (arc !== undefined && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.35) continue; if (!losClear(R.map, x, y, q.x, fy)) continue; hitSecret(S, R, q); } }
  function hitSecret(S, R, q) {
    if (S.t - (q.hitT ?? -9) < 0.2) return;
    q.hitT = S.t; if (kindOf(q) === 'lever') { ev(S, { k: 'hollow', x: q.x, y: q.y - 20 }); return; }
    if (kindOf(q) === 'banner') { openSecret(S, R, q); return; }
    q.hp--; R.trauma = Math.min(1, R.trauma + 0.2);
    if (q.hp > 0) { if (kindOf(q) === 'crack') ev(S, { k: 'wallhit', x: q.x, y: q.y - 20, i: R.map.secrets.indexOf(q) }); return; }
    openSecret(S, R, q);
  }
  function openSecret(S, R, q, quiet) {
    const m = R.map, i = m.secrets.indexOf(q), kind = kindOf(q); q.open = 1; q.openT = S.t; for (const [x, y] of q.wall) m.cells[y * m.W + x] = 1;
    if (quiet) { if (kind === 'shelf') shelfOf(m, i, false); return; }
    if (kind === 'crack') { for (let k = 0; k < 4; k++) m.decals.push({ x: q.x - 22 + k * 15, y: q.y - 6 - (k % 2) * 22, n: 'dc_rubble', f: k & 1, s: 0.8 + 0.1 * k }); R.trauma = Math.min(1, R.trauma + 0.45); R.freeze = Math.max(R.freeze, 0.06); }
    if (kind === 'shelf') { shelfOf(m, i, false);
      for (let k = 0; k < 3; k++) m.decals.push({ x: q.x - 30 + k * 30, y: q.y + 24 + (k % 2) * 8, n: k === 1 ? 'dc_straw' : 'dc_rubble', f: k & 1, s: 0.9 }); R.trauma = Math.min(1, R.trauma + 0.35); }
    if (kind === 'lever') R.trauma = Math.min(1, R.trauma + 0.3);
    fstat(R).sec++;
    ev(S, { k: 'secret', x: q.x, y: q.y - 20, i, kind }); R.msg = { s: 'Тайная комната!', t: S.t };
    giveShards(S, R, REWARD.secret, q.x, q.y - 20); checkFull(S, R);
  }
  // a secret's bookshelf standing (it blocks its cell) or broken (it does not)
  function shelfOf(m, i, stand) { const d = m.decor.find((o) => o.secret === i); if (!d) return; const k = Math.floor(d.y / TILE) * m.W + Math.floor(d.x / TILE);
    d.solid = stand ? 1 : 0; d.broken = stand ? 0 : 1; m.block = m.block.filter((b) => b !== k); if (stand) m.block.push(k); }
  // debug: open every secret of the floor without counting it; again, seal the ones it opened (a hero inside is put back in front)
  function debugSecrets(S, R) { const m = R.map, h = R.hero;
    if (!R.dbgOpen) { R.dbgOpen = []; m.secrets.forEach((q, i) => { if (!q.open) { openSecret(S, R, q, true); R.dbgOpen.push(i); } }); return; }
    const htx = Math.floor(h.x / TILE), hty = Math.floor(h.y / TILE);
    for (const i of R.dbgOpen) { const q = m.secrets[i], r = m.rooms[q.room]; q.open = 0; q.hp = 2; q.hitT = -9; delete q.openT; if (q.trig) delete q.trig.downT;
      for (const [x, y] of q.wall) m.cells[y * m.W + x] = 4; if (kindOf(q) === 'shelf') shelfOf(m, i, true);
      if (q.hide.includes(hty * m.W + htx) || (htx >= r.x && htx < r.x + r.w && hty >= r.y && hty < r.y + r.h)) { h.x = q.x - q.dx * 40 + (q.dy ? 0 : 0); h.y = q.y - q.dy * 40 + (kindOf(q) === 'shelf' ? 40 : 0); h.vx = h.vy = 0; } }
    R.dbgOpen = null; }
  // debug: every item of loot this floor still holds, where it is and whether the hero can get to it, and the books: what the
  // floor counted must equal what was picked up plus what still lies about plus what the closed chests hold
  function lootAudit(R) { const m = R.map, f = fstat(R), hid = secretMask(m), blk = new Set(m.block), h = R.hero;
    const seen = new Uint8Array(m.W * m.H), st = [Math.floor(h.y / TILE) * m.W + Math.floor(h.x / TILE)]; seen[st[0]] = 1;
    while (st.length) { const k = st.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d, c = m.cells[n]; if (!seen[n] && (c === 1 || c === 4 || c === 5) && !blk.has(n)) { seen[n] = 1; st.push(n); } } }
    const near = (x, y) => { const k = Math.floor(y / TILE) * m.W + Math.floor(x / TILE); return [k, k + 1, k - 1, k + m.W, k - m.W].some((n) => seen[n]); };
    const B = propBoxes(R), where = (x, y, item) => { const k = Math.floor(y / TILE) * m.W + Math.floor(x / TILE); return !near(x, y) || (item && behindProp(B, x, y)) ? 'stuck' : hid.has(k) || m.cells[k] === 4 ? 'secret' : 'open'; };
    const items = R.drops.filter((d) => d.loot && !d.got && d.kind === 'item').map((d) => ({ x: d.x, y: d.y, n: 1, at: where(d.x, d.y, d.rest === DROP_REST && !(d.fly > 0)), chest: 0 }));
    const chests = R.chests.filter((c) => !c.open && c.loot && c.loot.length).map((c) => ({ x: c.x, y: c.y, n: c.loot.length, at: where(c.x, c.y), chest: 1 }));
    const lying = items.length, boxed = chests.reduce((n, c) => n + c.n, 0);
    // a quest's keepsake (TASKS 1020) must be reachable as any loot, though it is no part of the floor's books
    const keeps = R.drops.filter((d) => d.kind === 'qitem' && !d.got).map((d) => ({ x: d.x, y: d.y, n: 1, at: where(d.x, d.y, d.rest === DROP_REST && !(d.fly > 0)), chest: 0, quest: 1 }))
      .concat(R.chests.filter((c) => !c.open && c.quest).map((c) => ({ x: c.x, y: c.y, n: 1, at: where(c.x, c.y), chest: 1, quest: 1 })));
    return { total: f.lootN, got: f.loot, lying, boxed, list: items.concat(chests, keeps), stuck: items.concat(chests, keeps).filter((o) => o.at === 'stuck').length, off: f.lootN - f.loot - lying - boxed }; }
  // a blow tears the webs in its reach (the feet of the hero's own web too), fire burns them
  function tearWebs(S, R, x, y, rad, ax, arc, fire) {
    for (const egg of R.eggs || []) if (egg.hp > 0 && Math.hypot(egg.x - x, egg.y - y) < rad + 15 && (!arc || Math.abs(angDiff(Math.atan2(egg.y - y, egg.x - x), ax)) < arc / 2) && losClear(R.map, x, y, egg.x, egg.y)) {
      egg.hp = 0; ev(S, { k: 'webburn', x: egg.x, y: egg.y });
    }

    (R.map.webs || []).forEach((w, i) => { if (w.torn) return; const dx = w.x - x, dy = w.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 20 * w.s) return; if (arc !== undefined && d > 24 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.35) return;
      w.torn = 1; w.tornT = S.t; ev(S, { k: fire ? 'webburn' : 'webtear', x: w.x, y: w.y, i }); }); }
  function springAmbush(S, R, P) {
    const m = R.map, h = R.hero, f = dep(R), room = m.rooms[P.room];
    if (!room || P.fired) return false;
    P.fired = 1;
    const roster = D.rosterAt(m.biome, R.floor).filter((t) => !D.BOSSES[t] && !ENEMIES[t].lurk && !ENEMIES[t].deep && ENEMIES[t].kind !== 'salamander');
    if (!roster.length) return false;
    const group = Array.from({ length: P.n }, () => pick(R, roster)), radius = Math.max(...group.map((t) => ENEMIES[t].r)), obstacles = solids(R), block = new Set(m.block || []);
    const inside = (x, y) => x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h;
    const walk = (x, y) => inside(x, y) && cell(m, x, y) === 1 && !block.has(y * m.W + x);
    const seen = new Set(), queue = [[Math.floor(h.x / TILE), Math.floor(h.y / TILE)]];
    while (queue.length) {
      const [x, y] = queue.pop(), k = y * m.W + x; if (seen.has(k) || !walk(x, y)) continue;
      seen.add(k); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push([x + dx, y + dy]);
    }
    const candidates = [];
    for (const k of seen) {
      const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE;
      if (Math.hypot(x - h.x, y - h.y) < 96 || hidden(m, { x, y })) continue;
      if ([-radius, 0, radius].some((dx) => [-radius, 0, radius].some((dy) => !walk(Math.floor((x + dx) / TILE), Math.floor((y + dy) / TILE))))) continue;
      if (obstacles.some((o) => Math.hypot(x - o.x, y - o.y) < radius + o.r + 4) || R.en.some((e) => e.deadT < 0 && Math.hypot(x - e.x, y - e.y) < radius + ENEMIES[e.type].r + 4)) continue;
      candidates.push({ x, y });
    }
    for (let i = candidates.length - 1; i > 0; i--) { const j = ri(R, 0, i); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
    const positions = [];
    for (const p of candidates) if (positions.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 2 * radius + 4)) { positions.push(p); if (positions.length === group.length) break; }
    if (positions.length !== group.length) return false;
    const sc = BAL.hp * dif(R, 'hp') * D.hpAt(f), dc = BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob;
    for (let i = 0; i < group.length; i++) {
      const { x, y } = positions[i], type = group[i], E = ENEMIES[type], hp = Math.round(E.hp * sc);
      R.en.push({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp, max: hp, dmg: E.dmg * dc, elite: 0, room: P.room, st: 'chase', t0: S.t, face: x < h.x ? 1 : -1, aimA: 0,
        cdT: S.t + 0.8, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: 'amb', spawnT: S.t, seenT: S.t, hx: x, hy: y, ft: -9 });
      ev(S, { k: 'summon', x, y });
    }
    P.downT = S.t; ev(S, { k: 'ambush', x: h.x, y: h.y });
    R.trauma = Math.min(1, R.trauma + 0.3); R.msg = { s: 'Засада!', t: S.t, d: 2, room: P.room }; return true;
  }
  // a door opens to a press of E or a blow (a kick, it flies open), unless it is locked: a key the hero carries opens the lock for
  // good, a lever opens every door of its lock at once
  const doorAt = (m, tx, ty) => (m.doors || []).find((d) => !d.open && d.cells.some(([x, y]) => x === tx && y === ty));
  const doorNear = (R, reach) => { const h = R.hero; return (R.map.doors || []).find((d) => !d.open && Math.hypot(d.x - h.x, d.y - h.y + 10) < reach); };
  function openDoor(S, R, d, kick) {
    const m = R.map, h = R.hero, L = doorLock(m, d), i = m.doors.indexOf(d);
    if (d.arena && R.arena && R.arena.active) return;
    if (L) { if (L.kind !== 'key' || !(R.keys > 0)) { if (S.t - (d.nopeT ?? -9) > 1) { d.nopeT = S.t; ev(S, { k: 'locked', x: d.x, y: d.y, i });
          ev(S, { k: 'nope', x: h.x, y: h.y, s: L.kind === 'key' ? 'Заперто. Нужен ключ' : 'Заперто. Где-то должен быть рычаг' }); } return; }
      R.keys--; L.open = 1; L.openT = S.t; ev(S, { k: 'unlatch', x: d.x, y: d.y, i }); R.msg = { s: 'Ключ подошёл', t: S.t }; }
    d.open = 1; d.openT = S.t; d.kick = kick ? 1 : 0; for (const [x, y] of d.cells) m.cells[y * m.W + x] = 1;
    if (kick) R.trauma = Math.min(1, R.trauma + 0.15);
    ev(S, { k: 'door', x: d.x, y: d.y, i, kick: d.kick });
  }
  function hitDoors(S, R, x, y, rad, ax, arc) {
    for (const d of R.map.doors || []) { if (d.open) continue; const dx = d.x - x, dy = d.y - (y - 10), dd = Math.hypot(dx, dy);
      if (dd > rad + 24) continue; if (arc !== undefined && dd > 20 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.35) continue; openDoor(S, R, d, 1); } }
  // a lever on a top wall, worked from in front of it like a sconce
  const leverNear = (R) => { const h = R.hero; return (R.map.locks || []).find((L) => L.kind === 'lever' && !L.open && Math.abs(h.x - L.lever.x) < 36 && h.y > L.lever.y && h.y - L.lever.y < 90); };
  function pullLever(S, R, L) {
    const m = R.map, li = m.locks.indexOf(L); L.open = 1; L.openT = S.t; R.trauma = Math.min(1, R.trauma + 0.25);
    ev(S, { k: 'lever', x: L.lever.x, y: L.lever.y, i: li });
    for (const d of m.doors) if (d.lock === li && !d.open) openDoor(S, R, d, 0);
    R.msg = { s: 'Где-то с лязгом открылась дверь', t: S.t };
  }
  // the secret a press of E works from where the hero stands: a banner to tear down, a sconce to pull
  function secretUnder(R) { const h = R.hero, m = R.map;
    return (m.secrets || []).find((q) => { if (q.open) return false;
      if (kindOf(q) === 'banner') return Math.abs(h.x - q.x) < 40 && h.y > q.y && h.y - q.y < 64;
      if (q.trig && q.trig.k === 'sconce') { const t = m.torches[q.trig.t]; return t && Math.abs(h.x - t.x) < 36 && h.y > t.y && h.y - t.y < 90; } return false; }); }
  function openChest(S, R, c) {
    if (c.open) return;
    const room = DG.roomAt(R.map, c.x, c.y), role = R.map.rooms[room];
    c.open = 1; c.openT = S.t; ev(S, { k: 'chest', x: c.x, y: c.y, tier: c.tier });
    // its items were rolled on entering the floor (they count toward the floor's loot from the start); a chest from an older save rolls now
    const pre = !!c.loot; for (const it of c.loot || chestLoot(R, c)) drop(R, c.x, c.y + 10, { kind: 'item', item: it, pre });
    c.loot = [];
    if (!c.ambushRolled) {
      c.ambushRolled = 1;
      if (role && (role.type === 'treasure' || role.type === 'secret') && rnd(R) < 0.05) springAmbush(S, R, { room, n: ri(R, 2, 4), x: c.x, y: c.y });
    }
    if (c.key !== undefined) drop(R, c.x, c.y + 10, { kind: 'key', lock: c.key });
    if (c.quest) drop(R, c.x, c.y + 10, { kind: 'qitem', quest: c.quest, ic: c.qic });
    drop(R, c.x, c.y + 10, { kind: 'gold', n: Math.round((10 + dep(R) * 6 + ri(R, 0, 10)) * c.tier) });
  }
  function chestLoot(R, c) { const LT = LOOT.chest[c.tier], out = [];
    for (let i = 0; i < LT.n; i++) out.push(rollItem(R, dep(R), i ? LT.q * 0.8 : LT.q));
    if (rnd(R) < POT.chest) out.push(potion('hp_potion')); if (rnd(R) < (R.viaTown ? POT.scrollTown : POT.scroll)) out.push(potion('scroll'));
    for (const it of out) it.id = R.nextId++; return out; }

  // ---------------- the world step (screen 'play') ----------------
  function stepPlay(S, inp, keys) {
    const R = S.run, h = R.hero, m = R.map, t = S.t; R.t = t; R.play = (R.play ?? (R.log ? R.log.fl.reduce((n, L) => n + L.time, 0) : 0)) + DT;   // saves from before the counter resume from the journal's per-floor time
    stepArena(S, R);
    const st = heroSt(S);
    if (R.log && h.deadT < 0) { const L = logFloor(R); L.time += DT; L.minHp = Math.min(L.minHp, h.hp / st.maxHp); L.minMp = Math.min(L.minMp, h.mp / st.maxMp); L.maxHp = st.maxHp; L.maxMp = st.maxMp; L.atk = st.atk; L.def = st.def; }
    // mouse → world aim
    const Z = zoomOf(R), mx = R.cam[0] + inp.px / Z, my = R.cam[1] + inp.py / Z;
    if (h.deadT >= 0) { if (t - h.deadT > 1.6) return endRun(S, 'dead'); stepMonsters(S, R, 0); stepDrops(S, R, false); camera(R, h, 0, 0); return; }
    // reactions keep running during hit-stop; the hero and camera hold, and so does every clock a player must react to: a wind-up,
    // a bolt's life, a lava warning, an egg's hatch; cooldowns run on, or every blow the hero lands slowed the monsters' attacks.
    // Keys pressed in it are kept for the first step after it (TASKS 227)
    if (R.freeze > 0) { R.freeze -= DT; R.frozen = 1; stepDrops(S, R, true); holdClocks(R); R.inbuf = Object.assign(R.inbuf || {}, keys); return; }
    R.frozen = 0; if (R.inbuf) { for (const k in R.inbuf) keys[k] = 1; R.inbuf = null; }
    // ---- input: 8-way run with accel / decel ----
    const ix = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), iy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0), il = Math.hypot(ix, iy) || 1;
    const spd = K.RUN * (1 + st.mspd / 100) * (t - h.atkT < 0.2 ? 0.55 : 1) * (inWater(m, h) ? WADE : 1) * (webAt(m, h) ? WEB.k : 1) * (gooAt(m, h) ? GOO.k : 1) * (soaked(S, h) ? ORB.slow : 1) * (S.t < (h.chillT ?? -9) ? MOD.frost.slow : 1);
    const app = (v, tg) => { const a = (Math.abs(tg) > Math.abs(v) ? K.ACC : K.DEC) * DT; return v < tg ? Math.min(tg, v + a) : Math.max(tg, v - a); };
    h.vx = app(h.vx, ix / il * spd); h.vy = app(h.vy, iy / il * spd);
    h.aim = Math.atan2(my - (h.y - RIG.shoulder + 8), mx - h.x);
    const busy = t - h.atkT < 0.22 || t - h.castT < 0.25;
    const wasBack = h.back, wasFace = h.face;
    if (busy) { h.face = Math.cos(h.aim) >= 0 ? 1 : -1; h.back = Math.sin(h.aim) < -0.5 ? 1 : 0; }
    else if (ix || iy) { if (ix) h.face = ix; h.back = iy < 0 ? 1 : iy > 0 ? 0 : h.back; }
    if (h.back !== wasBack) h.backT = t;
    if (h.face !== wasFace) h.faceT = t;
    // dash
    if (keys.Space && h.cd.dash <= t && !h.sunk) { const dx = ix || Math.cos(h.aim), dy = ix || iy ? iy : Math.sin(h.aim), d = Math.hypot(dx, dy) || 1;
      h.dashT = t; h.dashX = dx / d; h.dashY = dy / d; h.cd.dash = t + K.DASH_CD; ev(S, { k: 'dash', x: h.x, y: h.y, dx: h.dashX, dy: h.dashY });
      // the dash beats the flames out (TASKS 463: burning took the most hits and nothing put it out away from water)
      if (h.burn > t) { h.burn = 0; ev(S, { k: 'snuff', x: h.x, y: h.y, hero: 1 }); } }
    // a dash is a leap: spikes under it never bite, and one that would come down on a plate carries on until it is clear of it
    const onSpikes = m.traps.some((tr) => onPlate(h, tr)), leap = t - h.dashT < K.DASH_T;
    if (leap && onSpikes) h.leapT = h.dashT; else if (!onSpikes) h.leapT = -9;
    const dashing = leap || (h.leapT === h.dashT && t - h.dashT < K.DASH_T + K.LEAP);
    // under the lava (TASKS 484) he stays where he went in, then is up on the firm ground he last stood on
    if (h.sunk) { h.vx = h.vy = 0; if (t >= h.sunk.t + CRUST.sink) { h.x = h.sunk.bx; h.y = h.sunk.by; h.climbT = t; h.sunk = null; } }
    const held = h.sunk || (h.climbT !== undefined && t - h.climbT < 0.5);   // (climbing out over the lip, TASKS 1049, 1058: let go at 0.35 he glided off still 23 px under)
    const mvx = held ? 0 : dashing ? h.dashX * K.DASH : h.vx, mvy = held ? 0 : dashing ? h.dashY * K.DASH : h.vy;
    const ox = h.x, oy = h.y; const [bx, by] = move(m, h, mvx * DT, mvy * DT, K.R); if (bx) h.vx = 0; if (by) h.vy = 0;
    // a drowned's grab draws the hero a step toward it at an even pace
    if (h.pull) { const P = h.pull, sp = Math.min(P.n / P.T * DT, P.n - P.done); move(m, h, P.x * sp, P.y * sp, K.R); P.done += sp; if (P.done >= P.n - 0.01) h.pull = null; }
    shove(m, h, K.R, false, solids(R));
    { const w = webAt(m, h); if (w && h.web !== m.webs.indexOf(w)) ev(S, { k: 'web', x: w.x, y: w.y, i: m.webs.indexOf(w) }); h.web = w ? m.webs.indexOf(w) : -1; }
    { const g = gooAt(m, h); if (g && h.gooIn !== g.id) ev(S, { k: 'goo', x: h.x, y: h.y }); h.gooIn = g ? g.id : -1; }
    m.goo = (m.goo || []).filter((g) => t < g.t0 + g.T); for (const g of m.goo) g.rNow = g.r * Math.min(1, (g.t0 + g.T - t) / GOO.dry);
    const moved = Math.hypot(h.x - ox, h.y - oy);
    { const k = Math.floor(h.y / TILE) * m.W + Math.floor(h.x / TILE); if (m.cells[k] === 1) h.safe = [h.x, h.y]; }   // (firm ground to climb back onto, TASKS 476)
    if (moved > 0.02 && dashing) hitProps(S, R, h.x, h.y, K.R, undefined, undefined, true);
    if (moved > 0.02) {
      const hits = R.propHit || (R.propHit = {});
      m.decor.forEach((d, i) => {
        // (and in the magma caves, TASKS 466: a crack hisses and sparks underfoot, a charred skeleton shifts, a chain fence swings by)
        const fungus = /^shroom_[ab]$/.test(d.n), reach = fungus ? 25 : d.n === 'vent_mg' ? 22 : d.n === 'fence_mg' ? 34 : 30;
        if (!fungus && !['skel_cv', 'skel_mg', 'vent_mg', 'fence_mg'].includes(d.n)) return;
        const fx = d.n === 'fence_mg' ? Math.max(d.x, Math.min(d.x + d.len, h.x)) : d.x;
        if (hidden(m, d) || Math.hypot(fx - h.x, d.y - h.y) > reach || !losClear(m, h.x, h.y, fx, d.y)) return;
        const id = 'd' + i; if (S.t - (hits[id] ?? -9) < 0.65) return;
        hits[id] = S.t; ev(S, { k: 'prop', x: fx, y: d.y, i: id, n: d.n, mat: fungus ? 'fungus' : D.PROP_MAT[d.n] || 'bone', scale: d.s || 1, touch: 1, s: h.x < d.x ? 1 : -1 });
      });
    }
    if (moved > 0.02 && !dashing) { const b = Math.floor(h.gp / Math.PI); h.dist += moved; h.gp = (h.gp || 0) + moved / stepLen(Math.abs(h.x - ox) / moved) * Math.PI; if (Math.floor(h.gp / Math.PI) !== b) ev(S, { k: 'step', x: h.x, y: h.y, wet: inWater(m, h), mat: (m.crossings || []).some((c) => c.kind === 'bridge' && c.cells.includes(Math.floor(h.y / TILE) * m.W + Math.floor(h.x / TILE))) ? 'wood' : inWater(m, h) ? 'water' : 'stone' }); }
    // ---- melee: hold LMB ----
    if (inp.press && h.cd.atk <= t) {
      h.patkT = h.atkT; h.patkA = h.atkA; h.atkT = t; h.atkA = h.aim; h.atkHit = 0; h.atkN++; h.cd.atk = t + st.wcd / (1 + st.aspd / 100); if (h.face !== (h.face = Math.cos(h.aim) >= 0 ? 1 : -1)) h.faceT = t;
      ev(S, { k: 'swing', x: h.x, y: h.y, a: h.aim, n: h.atkN, f: h.face });
    }
    if (h.atkT >= 0 && !h.atkHit && t - h.atkT >= K.HIT) {     // the damage frame: the blade crosses the aim (scene.js swingPose)
      h.atkHit = 1; const arc = st.arc * Math.PI / 180, reach = st.reach;
      for (const e of R.en) { if (e.deadT >= 0) continue; const E = ENEMIES[e.type], dx = e.x - h.x, dy = (e.y - h.y) * 1.25, d = Math.hypot(dx, dy);
        if (d > reach + E.r + K.R) continue; if (d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), h.atkA)) > arc / 2) continue; if (!losClear(m, h.x, h.y, e.x, e.y)) continue;
        const c = rnd(R) * 100 < st.crit; heroHit(S, R, e, Math.max(1, Math.round(st.atk * (0.9 + 0.2 * rnd(R)) * (c ? 1.75 : 1) * (h.bless ? 1.2 : 1))), c, h.x, h.y, st.kb); }
      breakPots(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitProps(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitFolk(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitChests(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitSecrets(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitDoors(S, R, h.x, h.y, reach + 10, h.atkA, arc); tearWebs(S, R, h.x, h.y, reach + 10, h.atkA, arc);
    }
    // ---- abilities / potions / interact ----
    if (inp.slot >= 1 && inp.slot <= 3) castAbility(S, R, ABILITIES[inp.slot - 1].id, inp);
    // the scroll's hint (TASKS 1033), once for good: the first time a hero of a town run with a scroll in the bag falls low on health
    if (R.viaTown && !R.town && !S.meta.tipScroll && h.deadT < 0 && !S.demo && Math.floor(S.t * 4) !== Math.floor((S.t - DT) * 4) && h.bag.some((it) => it && it.b === 'scroll') && h.hp < 0.35 * heroSt(S).maxHp) {
      S.meta.tipScroll = 1; R.msg = { s: 'Здоровья мало: T — свиток возвращения, портал в город', t: S.t, d: 4.5, tip: 'scroll' }; ev(S, { k: 'tip', id: 'scroll', x: h.x, y: h.y }); }
    // the whirl's hint (TASKS 390), over no other message
    { const W = D.TIPS.whirl; if (h.ab.whirl && h.cd.whirl <= S.t && (S.meta.whirls || 0) < W.until && S.t - (R.tipT ?? -1e9) > W.every && !(R.msg && S.t - R.msg.t < (R.msg.d || 3.5))) {
      const r = D.abRank('whirl', h.ab.whirl).r; if (R.en.filter((e) => e.deadT < 0 && !under(e) && e.st !== 'idle' && e.st !== 'home' && Math.hypot(e.x - h.x, (e.y - h.y) * 1.3) < r + ENEMIES[e.type].r).length >= W.n) {
        R.tipT = S.t; R.msg = { s: W.s, t: S.t, d: 3, tip: 'whirl' }; ev(S, { k: 'tip', id: 'whirl', x: h.x, y: h.y }); } } }
    if (inp.rclick) castAbility(S, R, 'fireball', inp);
    if (keys.KeyQ) usePotion(S, R, 'hp_potion');
    // T reads the scroll of return (TASKS 1026: behind the bag alone, a novice never found it)
    if (keys.KeyT) { const i = h.bag.findIndex((it) => it && it.b === 'scroll'); if (i >= 0) useItem(S, R, i); else ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Нет свитков возвращения' }); }
    if (keys.KeyR) usePotion(S, R, 'mp_potion');
    if (keys.KeyE) interact(S, R);
    if (R.map !== m) return;
    if (h.read && R.hero === h) readStep(S, R, ix || iy ? 1 : 0, dashing);
    if (R.map !== m) return;
    // a loose flagstone sinks under the hero's step
    for (const q of m.secrets || []) if (!q.open && q.trig && q.trig.k === 'plate' && Math.abs(h.x - q.trig.x) < 13 && Math.abs(h.y - q.trig.y) < 13) { q.trig.downT = t; ev(S, { k: 'click', x: q.trig.x, y: q.trig.y }); openSecret(S, R, q); }
    // ---- status ----
    const rIn = reveal(R);
    if (R.msg && R.msg.room !== undefined && rIn !== R.msg.room && !R.msg.outT) R.msg.outT = t;   // a room's alarm is about that room only
    if (m.shop) { const d = Math.hypot(h.x - m.shop.x, h.y - m.shop.y); if (d < 230 && R.shop.away) { R.shop.away = 0; R.shop.greetT = t; } else if (d > 360) R.shop.away = 1; }
    if (R.town && m.town) stepFolk(S, R);
    if (m.way && !(R.ways || []).includes(R.floor) && Math.hypot(h.x - m.way.x, h.y - m.way.y) < 60) wake(S, R);
    if (rIn === m.start) h.mp = Math.min(st.maxMp, h.mp + st.maxMp * 0.08 * DT);
    if (st.regen && h.hp > 0) h.hp = Math.min(st.maxHp, h.hp + st.regen * DT);
    h.mp = Math.min(st.maxMp, h.mp + (1.2 + st.int * 0.12) * DT);
    // the poison's drain is reported every half second like the burn's, so the balance tools and the death screen see it (TASKS 227)
    if (h.poison > t) { const n = 2.5 * st.resist * DT; h.hp -= n; if (h.hp <= 1) h.hp = 1; if (R.log) add(logFloor(R).dmg, 'poison', n);
      h.poisonAcc = (h.poisonAcc || 0) + n; if (t - (h.poisonT ?? -9) >= 0.5) { h.poisonT = t; const k = Math.round(h.poisonAcc); if (k > 0) { h.poisonAcc -= k; ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n: k, src: 'poison' }); } } }
    // a fire hex sets the hero alight: a tick every 0.5 s for 3 s, past the invulnerability window like poison, never the killing blow
    // a burn's ticks run up one number on screen (`chain`: the burn's first tick, `sum`: so far), not a number each half second
    if (h.burn > t && t - (h.burnT ?? -9) >= 0.5) { if (t - (h.burnL ?? -9) > 0.75) { h.burnC = t; h.burnSum = 0; } h.burnT = h.burnL = t; const n = Math.max(1, Math.round((1.5 + 0.3 * dep(R)) * st.resist * dif(R, 'dmg'))); h.hp = Math.max(1, h.hp - n); h.burnSum = (h.burnSum || 0) + n;
      ev(S, { k: 'scorch', x: h.x, y: h.y }); ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n, src: 'burn', chain: h.burnC, sum: h.burnSum }); }
    if (h.shield > 0 && t > h.shieldUntil) h.shield = 0;
    // spikes: up for 0.7 s of every 2.4 s; a plate is 2×2 cells, feet a little inside its edge count
    for (const tr of m.traps) { const ph = ((t / 2.4 + tr.ph) % 1 + 1) % 1, up = ph < 0.29;
      if (up && onPlate(h, tr) && !dashing && t - h.spikeT > 0.7) { h.spikeT = t; hurtHero(S, R, heroSt(S).maxHp * BAL.spike, h.x, h.y - 20, 'spike'); ev(S, { k: 'spike', x: tr.x, y: tr.y }); }
      // the spikes don't care whose feet are on them: lure or knock monsters onto a plate
      if (up) for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && onPlate(e, tr) && t - (e.spikeT ?? -9) > 0.7) {
        e.spikeT = t; hitEnemy(S, R, e, Math.round(9 * (1 + 0.2 * (dep(R) - 1))), false, tr.x, tr.y, 0, 'spike'); ev(S, { k: 'spike', x: tr.x, y: tr.y }); } }
    if (m.hazards) stepHazards(S, R);
    if (R.pyres && R.pyres.length) stepPyres(S, R);
    if (R.fires && R.fires.length) stepFires(S, R);
    // water puts the fire out
    if (h.burn > t && inWater(m, h)) { h.burn = 0; ev(S, { k: 'douse', x: h.x, y: h.y }); }
    for (const e of R.en) if (e.deadT < 0 && e.burn > t && !ENEMIES[e.type].ghost && inWater(m, e)) { e.burn = 0; ev(S, { k: 'douse', x: e.x, y: e.y }); }
    // lava burns whoever stands in it, every half second
    const lavaDmg = () => 8 * (1 + 0.2 * (dep(R) - 1));
    if (onLava(m, h) && t - (h.lavaT ?? -9) >= 0.5) { h.lavaT = t; hurtHero(S, R, lavaDmg() * st.resist, h.x, h.y, undefined, 'lava'); ev(S, { k: 'scorch', x: h.x, y: h.y }); }
    for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && !ENEMIES[e.type].lava && onLava(m, e) && t - (e.lavaT ?? -9) >= 0.5) {
      if (m.cliff && !D.BOSSES[e.type]) { if (e.sinkT === undefined && e.fallT === undefined) { e.sinkT = t; e.burn = t + DOOM.sink + 0.5; e.burnT = t; e.kbx = e.kby = 0; ev(S, { k: 'sink', x: e.x, y: e.y, id: e.id, type: e.type }); } continue; }
      e.lavaT = t; hitEnemy(S, R, e, Math.round(lavaDmg() * 1.25), false, e.x, e.y, 0, 'fire'); ev(S, { k: 'scorch', x: e.x, y: e.y }); }
    if (crustSet(m)) stepCrust(S, R);
    stepProjectiles(S, R);
    stepMonsters(S, R, 1);
    for (const e of R.en) if (e.type === 'crab' && e.deadT < 0) {
      // not enumerable: the render-only trail stays out of the saved run (JSON) and starts afresh after a load
      if (!e.crabTrail) Object.defineProperty(e, 'crabTrail', { value: [], writable: true, enumerable: false });
      const trail = e.crabTrail;
      trail.push({ x: e.x, y: e.y, fa: faOf(e), dist: e.dist, vx: e.vx, vy: e.vy });
      if (trail.length > 180) trail.shift();
    }
    for (const e of R.en) {
      const moved = Math.hypot(e.x - (e.waterX ?? e.x), e.y - (e.waterY ?? e.y)); e.waterX = e.x; e.waterY = e.y;
      if (e.deadT < 0 && !ENEMIES[e.type].ghost && inWater(m, e) && moved < TILE) {
        e.waterStride = (e.waterStride || 0) + moved;
        if (e.waterStride >= 24) { e.waterStride %= 24; ev(S, { k: 'step', x: e.x, y: e.y, wet: true, id: e.id }); }
      } else e.waterStride = 0;
    }
    stepDrops(S, R, true);
    // ---- camera: follow + look toward the cursor, spring, clamped to the map ----
    camera(R, h, (inp.px / Z - WIN(R).W / 2) * 0.12, (inp.py / Z - WIN(R).H / 2) * 0.12);
    R.trauma = Math.max(0, R.trauma - 1.6 * DT);
    if (t - R.saveT > 30) { R.saveT = t; S.saveN++; }
  }
  function camera(R, h, lx, ly) { const w = WIN(R), tg = [h.x - w.W / 2 + lx, h.y - 30 - w.H / 2 + ly]; clampCam(R, tg);
    for (const i of [0, 1]) { R.camV[i] += (36 * (tg[i] - R.cam[i]) - 12 * R.camV[i]) * DT; R.cam[i] += R.camV[i] * DT; } }
  // ---------------- the townsfolk (R-17, TASKS 1015) ----------------
  // each townsperson's state: where it stands, its round (the walkers), the crate the porter carries, what it says. Walkers ease
  // in and out of their pace, step round each other and the hero (or wait), and stop to talk; a stop that stays blocked is skipped
  const FOLK_R = { child: 9, hen: 6 }, folkR = (f) => FOLK_R[f.role] || 12;
  const folkOf = (R) => R.folk || (R.folk = D.folkInit(R.map.town.npcs));
  const townOk = (m) => m.town.walkOk || Object.defineProperty(m.town, 'walkOk', { value: DG.townWalk(m), enumerable: false }).walkOk;
  const folkFree = (m, x, y, r) => { const ok = townOk(m); return [[0, 0], [-r, 0], [r, 0], [0, -0.6 * r], [0, 0.5 * r]].every(([dx, dy]) => ok[Math.floor((y + dy) / TILE) * m.W + Math.floor((x + dx) / TILE)]); };
  // a talk lasts FOLK_SAY s from its start, or ends when the hero walks off
  const folkTalk = (f, t) => f.near && t - f.sayT < D.FOLK_SAY;
  const folkPause = (f, stop) => (f.role === 'porter' ? (stop && stop.act ? 1.8 : 0) : D.FOLK[f.role].pause || 0);
  // a hen (TASKS 1032): scatters from the hero who comes close (and from a walker's feet), runs to the child's grain and pecks there, else wanders about its
  // place a few steps at a time. f.goal { x, y, v, k: the grain it came for }; f.next: when it may pick its next spot
  const henRnd = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
  function henGoal(R, f, n, t) {
    const h = R.hero, dh = Math.hypot(h.x - f.x, (h.y - f.y) * 1.25), w = R.folk.find((q) => q.go && q.spd > 4 && Math.hypot(q.x - f.x, (q.y - f.y) * 1.25) < 34), sc = h.deadT < 0 && dh < 58 ? h : w;
    if (sc) { const a = Math.atan2(f.y - sc.y, f.x - sc.x) + 0.6 * (henRnd(f.i, Math.floor(t)) - 0.5); f.next = t + 1 + henRnd(f.i, t); f.scareT = t;
      return (f.goal = { x: f.x + Math.cos(a) * 44, y: f.y + Math.sin(a) * 30, v: 80 }); }
    const gr = R.grain; if (gr && t - gr.t < 7 && Math.hypot(gr.x - f.x, gr.y - f.y) < 190 && (!f.goal || f.goal.k !== gr.t))
      f.goal = { x: gr.x + 18 * (henRnd(f.i, gr.t) - 0.5), y: gr.y + 10 * (henRnd(gr.t, f.i) - 0.5), v: 42, k: gr.t };
    if (f.goal && f.goal.k && t - f.goal.k > 7) f.goal = null;
    if (!f.goal && t >= (f.next || 0)) { const a = 2 * Math.PI * henRnd(f.i, t), r = 10 + 26 * henRnd(t, f.i);
      f.goal = { x: n.x + Math.cos(a) * r, y: n.y + Math.sin(a) * r * 0.6, v: 22 }; f.next = t + 2 + 3 * henRnd(f.i + 7, t); }
    return f.goal; }
  function stepFolk(S, R) {
    const m = R.map, h = R.hero, t = S.t, F = folkOf(R), alive = h.deadT < 0;
    for (const f of F) { const n = m.town.npcs[f.i], FD = D.FOLK[f.role], r = folkR(f);
      if (FD.lines) { const d = Math.hypot(h.x - f.x, (h.y - f.y) * 1.25);
        if (!f.near && alive && d < 72) { f.near = 1; f.sayT = t; f.sayN = (f.sayN + 1) % FD.lines.length; ev(S, { k: 'say', x: f.x, y: f.y, role: f.role }); }
        else if (f.near && (d > 130 || !alive)) { f.near = 0; f.byeT = t; } }
      // the loop's impact: the anvil rings on the smith's blow (not on his breather, not while he talks)
      if (f.role === 'smith' && !folkTalk(f, t)) { const a = D.folkClock('smith', f.i, t - DT), b = D.folkClock('smith', f.i, t);
        if ((a.n === b.n ? a.u < FD.hit && b.u >= FD.hit : b.u >= FD.hit) && b.n % FD.rest !== FD.rest - 1) ev(S, { k: 'anvil', x: f.x, y: f.y }); }
      const route = n.route;
      if (folkTalk(f, t)) f.face = h.x >= f.x ? 1 : -1;
      // the child's handful of grain lands ahead of him, toward the nearest hen: the hens come for it (TASKS 1032)
      if (f.role === 'child' && route && !f.go && f.way >= 0 && !folkTalk(f, t)) { const a = D.folkClock('child', f.i, t - DT), b = D.folkClock('child', f.i, t);
        if (a.n === b.n && a.u < 0.47 && b.u >= 0.47) { const hn = F.filter((q) => q.role === 'hen').sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y))[0], dir = hn && hn.x < f.x ? -1 : 1;
          R.grain = { x: f.x + dir * 55, y: f.y + 4, t }; } }
      let want = 0, ux = 0, uy = 0;
      if (f.role === 'hen') { const g = henGoal(R, f, n, t);
        if (g) { const dx = g.x - f.x, dy = g.y - f.y, d = Math.hypot(dx, dy); if (d > 2.5) { want = Math.min(g.v, d * 4 + 6); ux = dx / d; uy = dy / d; } else if (!g.k) f.goal = null; } }
      else if (!route) { f.spd = 0; continue; }
      if (route && !folkTalk(f, t) && !f.go && t >= f.t0 + folkPause(f, route[f.way])) { f.go = 1; f.way = (f.way + 1) % route.length; f.stuck = 0; f.lift = 0; }
      if (route && f.go && !folkTalk(f, t)) { const tg = route[f.way], dx = tg.x - f.x, dy = tg.y - f.y, d = Math.hypot(dx, dy);
        if (d < 1.5) { f.go = 0; f.t0 = t; f.x = tg.x; f.y = tg.y; f.spd = 0;
          // f.lift: what he did at this stop, for the render's bend; a pick-up with the crate in hand (a stop skipped) is no lift
          f.lift = tg.act === 'take' && !f.load || tg.act === 'drop' && f.load ? tg.act : 0; if (f.lift) { f.load = f.lift === 'take' ? 1 : 0; ev(S, { k: 'toss', x: f.x, y: f.y }); } }
        else { want = Math.min(FD.v, d * 3 + 8); ux = dx / d; uy = dy / d; } }
      f.spd += (want - f.spd) * Math.min(1, 7 * DT);
      if (f.spd < 0.5 && !want) { f.spd = 0; f.vx = f.vy = 0; continue; }
      if (!want) { ux = f.vx / (Math.hypot(f.vx, f.vy) || 1); uy = f.vy / (Math.hypot(f.vx, f.vy) || 1); }
      // round the others and the hero: try straight on, then wider and wider turns; nothing clear, it waits
      const step = f.spd * DT, near = (x, y) => F.some((o) => o !== f && Math.hypot(o.x - x, (o.y - y) * 1.4) < r + folkR(o) + 3 && Math.hypot(o.x - x, (o.y - y) * 1.4) < Math.hypot(o.x - f.x, (o.y - f.y) * 1.4))
        || (Math.hypot(h.x - x, (h.y - y) * 1.4) < r + K.R + 4 && Math.hypot(h.x - x, (h.y - y) * 1.4) < Math.hypot(h.x - f.x, (h.y - f.y) * 1.4));
      let moved = false;
      for (const a of [0, 0.6, -0.6, 1.2, -1.2]) { const c = Math.cos(a), sn = Math.sin(a), vx = ux * c - uy * sn, vy = ux * sn + uy * c, x = f.x + vx * step, y = f.y + vy * step;
        if (!folkFree(m, x, y, r) || near(x, y)) continue;
        f.x = x; f.y = y; f.vx = vx * f.spd; f.vy = vy * f.spd; f.dist += step; moved = true; break; }
      if (!moved) { f.vx = f.vy = 0; f.spd = 0; if (!route) { f.goal = null; continue; } if ((f.stuck += DT) > 4) { f.way = (f.way + 1) % route.length; f.stuck = 0; } } else f.stuck = 0;
      if (Math.abs(f.vx) > 3) f.face = f.vx > 0 ? 1 : -1; }
    // the merchant calls the hero over from across the yard, every so often
    if (m.shop && R.shop) { const d = Math.hypot(h.x - m.shop.x, h.y - m.shop.y);
      if (alive && d > 240 && d < 560 && t - (R.shop.callT ?? -99) > 11) { R.shop.callT = t; R.shop.callN = ((R.shop.callN ?? -1) + 1) % D.SHOP.calls.length; ev(S, { k: 'say', x: m.shop.x, y: m.shop.y, role: 'merchant' }); } }
  }
  const solids = (R) => { const out = []; for (const c of R.chests) out.push({ x: c.x, y: c.y, r: 16 }); for (const p of R.pots) if (p.hp > 0) out.push({ x: p.x, y: p.y, r: 11 });
    for (const t2 of R.map.torches) if (t2.kind !== 'wall') out.push({ x: t2.x, y: t2.y, r: t2.kind === 'fire' ? 20 : 12 }); for (const s of R.shrines) out.push({ x: s.x, y: s.y, r: 18 }); for (const d of R.map.decor) if (d.solid) out.push({ x: d.x, y: d.y, r: 18 });
    if (R.map.way) out.push({ x: R.map.way.x, y: R.map.way.y, r: 16 });
    for (const q of R.map.waterFeatures || []) if (q.kind === 'fountain') out.push({ x: q.x, y: q.y - 2, r: 34 });
    if (R.map.shop) for (const [x, y] of R.map.shop.solid) out.push({ x, y, r: 18 });
    for (const f of R.folk || []) out.push({ x: f.x, y: f.y, r: folkR(f) }); return out; };
  function interact(S, R) {
    const h = R.hero, m = R.map;
    const sq0 = secretUnder(R), c = R.chests.find((c2) => !c2.open && Math.hypot(c2.x - h.x, c2.y - h.y) < (sq0 ? 30 : 56)); if (c) { openChest(S, R, c); return; }
    if (atCounter(R)) { openShop(S, R); return; }
    const sh = R.shrines.find((s) => !s.used && Math.hypot(s.x - h.x, s.y - h.y) < 60);
    if (sh && !arenaSealed(R)) { openAltar(S, R, sh); return; }
    const sq = sq0; if (sq) { if (sq.trig) ev(S, { k: 'click', x: h.x, y: h.y }); openSecret(S, R, sq); return; }
    const lv = leverNear(R); if (lv) { pullLever(S, R, lv); return; }
    const dr = doorNear(R, 64); if (dr) { openDoor(S, R, dr, 0); return; }
    const dUp = m.up ? Math.hypot(m.up.x - h.x, m.up.y - h.y) : 1e9;
    if (dUp < 56 && dUp <= Math.hypot(m.exit.x - h.x, m.exit.y - h.y) && (!m.down || dUp <= Math.hypot(m.down.x - h.x, m.down.y - h.y))) { if (bossFight(R)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Не посреди боя с боссом' }); return; }
      ev(S, { k: 'stairs', x: h.x, y: h.y, floor: R.floor, up: 1 }); enterFloor(S, R, R.floor - 1, undefined, 'up'); return; }
    const gt = gateNear(R); if (gt) { R.portal = { f: R.floor, x: gt.x, y: gt.y + 40 }; enterFloor(S, R, 0, undefined, 'portal'); ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); return; }
    // the town's ring of stones: the end of a portal (TASKS 1007) and the gate to the waystones woken this run (1009); with one way
    // out it is taken at once, with more a window to choose
    const cw = atCraft(R); if (cw === 'forge' && questMark(R, 'smith')) { const sm = folkOf(R).find((q) => q.role === 'smith'); if (sm) { openTalk(S, R, sm); return; } }
    if (cw) { S.screen = 'craft'; S.craft = { kind: cw, sel: S.craft && S.craft.kind === cw ? S.craft.sel : null }; S.hover = ''; ev(S, { k: 'ui', x: h.x, y: h.y }); return; }
    if (atStash(R)) { S.screen = 'stash'; S.hover = ''; S.drag = null; stashOf(S); ev(S, { k: 'ui', x: R.map.town.svc.stash.x, y: R.map.town.svc.stash.y }); return; }
    if (atSoulAltar(R)) { S.screen = 'meta'; S.metaRun = 1; S.hover = ''; ev(S, { k: 'altar', x: R.map.town.svc.altar.x, y: R.map.town.svc.altar.y }); return; }
    if (atGate(R)) { const o = gateWays(R); if (o.length === 1) gateGo(S, R, o[0]); else { S.screen = 'gate'; S.hover = ''; ev(S, { k: 'ui', x: h.x, y: h.y }); } return; }
    if (atBoard(R)) { S.screen = 'board'; S.hover = ''; ev(S, { k: 'ui', x: h.x, y: h.y }); return; }
    // a townsman with something to say, once no service of the town is in reach (TASKS 1016, 1023)
    const fk = folkNear(R); if (fk) { openTalk(S, R, fk); return; }
    // the stairs on past the serpent (TASKS 354): shut till it falls; taking them wins the campaign there and then and the run goes on
    if (m.down && Math.hypot(m.down.x - h.x, m.down.y - h.y) < 60) { if (R.bossDead) descend(S, R); else ev(S, { k: 'nope', x: h.x, y: h.y, s: sealOf(R) }); return; }
    if (Math.hypot(m.exit.x - h.x, m.exit.y - h.y) < 60) {
      if (arenaSealed(R)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Сначала одолейте босса главы' }); return; }
      if (lastFloor(R) && R.mode !== 'endless') { if (R.bossDead) { endRun(S, 'win'); } else ev(S, { k: 'nope', x: h.x, y: h.y, s: sealOf(R) }); return; }
      ev(S, { k: 'stairs', x: h.x, y: h.y, floor: R.floor }); enterFloor(S, R, R.floor + 1); return; }
    const used = R.shrines.find((s) => s.used && Math.hypot(s.x - h.x, s.y - h.y) < 60);
    if (used && canDonate(R)) openAltar(S, R, used);
  }
  // ---------------- waystones (TASKS 1009) ----------------
  // touched once, a waystone stays awake for the rest of the run; the town's ring of stones then jumps to it
  function wake(S, R) { const w = R.map.way; R.ways = (R.ways || []).concat(R.floor).sort((a, b) => a - b);
    ev(S, { k: 'waystone', x: w.x, y: w.y }); R.msg = { s: 'Путевой камень пробуждён: из города можно вернуться на этаж ' + R.floor, t: S.t, d: 4 }; S.saveN++; }
  // the Altar of Souls on the town's square (TASKS 1011): the meta upgrades, paid from the same bank as everywhere
  const near = (R, k, r) => !!(R.town && R.map.town && Math.hypot(R.map.town.svc[k].x - R.hero.x, R.map.town.svc[k].y - R.hero.y) < r);
  const nearer = (R, a, b) => Math.hypot(R.map.town.svc[a].x - R.hero.x, R.map.town.svc[a].y - R.hero.y) <= Math.hypot(R.map.town.svc[b].x - R.hero.x, R.map.town.svc[b].y - R.hero.y);
  // the storage chest stands three cells right of the altar: between them the nearer one answers
  const atSoulAltar = (R) => near(R, 'altar', 70) && (!near(R, 'stash', 64) || nearer(R, 'altar', 'stash'));
  const atStash = (R) => near(R, 'stash', 64) && !atSoulAltar(R);
  // ---------------- the town's workshops (R-32, TASKS 1013) ----------------
  // the smith at his anvil reforges, the enchanter at her lectern enchants; the piece is chosen from the worn gear or the bag
  const atCraft = (R) => (near(R, 'anvil', 80) ? 'forge' : near(R, 'lectern', 80) ? 'enchant' : null);
  // the notice board (TASKS 1033): what every townsman has on offer, in one list; a quest is taken from it as from its giver
  const atBoard = (R) => near(R, 'board', 64);
  const boardOffers = (R) => D.QUEST_GIVE.from.map((role) => ({ role, of: offerOf(R, role) })).filter((o) => o.of);
  const craftItem = (S, R) => { const c = S.craft, h = R.hero; if (!c || !c.sel) return null; const [k, v] = c.sel.split(':'); const it = k === 'eq' ? h.eq[v] : h.bag[+v]; return it && BASES[it.b] ? it : null; };
  // what the work costs on this piece now: gold (and shards for an enchantment), the chance it fails
  function craftCost(S, R, it) { const C = D.CRAFT, p = D.itemPrice(it, tradeDepth(R));
    if (S.craft.kind === 'forge') return { gold: Math.max(10, Math.round(p * C.reforge)), shards: 0, fail: 0, can: RARITY[it.rar].affixes > 0, why: 'Нечего перековывать: у обычной вещи нет свойств' };
    const n = (it.ench || []).length, E = C.ench; return n >= E.max ? { gold: 0, shards: 0, fail: 0, can: false, why: 'Больше трёх чар вещь не держит' } : { gold: Math.max(10, Math.round(p * E.gold[n])), shards: E.shards[n], fail: E.fail[n], can: true }; }
  function craft(S, R) { const h = R.hero, it = craftItem(S, R), at = R.map.town.svc[S.craft.kind === 'forge' ? 'anvil' : 'lectern'];
    if (!it) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Выберите вещь' }); return; }
    const c = craftCost(S, R, it); if (!c.can) { ev(S, { k: 'nope', x: h.x, y: h.y, s: c.why }); return; }
    if (h.gold < c.gold) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Не хватает золота' }); return; }
    if (S.meta.shards < c.shards) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Не хватает осколков душ' }); return; }
    h.gold -= c.gold; S.meta.shards -= c.shards; let res, ok = 1;
    if (S.craft.kind === 'forge') { it.mods = {}; rollAffixes(R, it); res = 'Перековано: свойства собраны заново'; }
    else if (rnd(R) < c.fail) { ok = 0; const own = Object.keys(it.mods || {});
      if (rnd(R) < D.CRAFT.ench.strip || !own.length) { it.ench = []; res = 'Чары сорвались: все зачарования сняты'; }
      else { const k = own[Math.floor(rnd(R) * own.length)]; delete it.mods[k]; res = 'Вещь испорчена: пропало свойство «' + AFFIXES.find((a) => a.k === k).label.replace('{v}', '').replace(/^\+\s*/, '').trim() + '»'; } }
    else { const used = new Set((it.ench || []).map((e) => e.k)), pool = AFFIXES.filter((a) => !used.has(a.k)), a = pool[Math.floor(rnd(R) * pool.length)];
      const v = Math.max(1, Math.round((a.a + a.b * it.lvl) * (0.7 + 0.6 * rnd(R)) * (1 + 0.15 * it.rar)));
      it.ench = (it.ench || []).concat({ k: a.k, v }); res = 'Зачаровано: ' + a.label.replace('{v}', v); }
    const st = heroSt(S); h.hp = Math.min(h.hp, st.maxHp); h.mp = Math.min(h.mp, st.maxMp);
    S.craft.res = { s: res, ok, t: S.t }; S.saveN++; ev(S, { k: 'craft', x: at.x, y: at.y, kind: S.craft.kind, ok }); }
  // ---------------- quests (R-17, TASKS 1017–1022) ----------------
  // a quest of the run: R.quests [{ id, key, f, need, n, st: taken | done | turned, from, rw, ... }]; its progress comes off the event
  // bus (ev → questOn), it is done when n reaches need, turned in in the town for its reward; it goes with the hero
  const QUEST_EV = new Set(['kill', 'clear', 'floor', 'qitem', 'qevent']);
  function newQuest(R, key, f, from) { const Q = D.QUESTS[key]; return { id: R.nextId++, key, f, need: Q.need(f), n: 0, st: 'taken', from: from || null, rw: D.questReward(Q.rw, f, R.hero && R.hero.lvl) }; }
  function takeQuest(S, R, q) { (R.quests = R.quests || []).push(q); ev(S, { k: 'quest', x: R.hero.x, y: R.hero.y, s: 'take', id: q.id }); R.msg = { s: 'Новое задание: ' + D.QUESTS[q.key].name, t: S.t }; S.saveN++; questOn(S, R, { k: 'floor', f: R.floor }); return q; }
  // how much one event moves a quest on
  function questStep(R, q, e) { const Q = D.QUESTS[q.key], deep = R.floor >= q.f && !R.town;
    if (Q.type === 'kill') return e.k === 'kill' && deep && !e.boss && (!Q.elite || e.elite) ? 1 : 0;
    if (Q.type === 'clear') return e.k === 'clear' && deep ? 1 : 0;
    if (Q.type === 'reach') return e.k === 'floor' && (R.deepest || 0) >= q.f ? q.need : 0;
    if (Q.type === 'boss') return e.k === 'kill' && e.boss && R.floor === q.f ? 1 : 0;
    if (Q.type === 'named') return e.k === 'kill' && e.quest === q.id ? 1 : 0;
    if (Q.type === 'fetch') return e.k === 'qitem' && e.quest === q.id ? 1 : 0;
    // the marked room cleared, or (362, 363, 366, when they come) the room's event done: an event of the bus `qevent` with the room
    if (Q.type === 'room') return (e.k === 'clear' || e.k === 'qevent') && R.floor === q.f && !R.town && e.room === q.room ? 1 : 0;
    return 0; }
  function questOn(S, R, e) { for (const q of R.quests) { if (q.st !== 'taken') continue; const d = questStep(R, q, e); if (!d) continue;
      q.n = Math.min(q.need, q.n + d); if (q.n >= q.need) { q.st = 'done'; R.msg = { s: 'Задание выполнено: ' + D.QUESTS[q.key].name + ' — награда ждёт в городе', t: S.t, d: 4 }; S.ev.push({ k: 'quest', x: R.hero.x, y: R.hero.y, s: 'done', id: q.id, t: S.t }); } } }
  // the turn-in, in the town: gold, experience and the item go to the hero, the shards to the bank
  function turnIn(S, R, q) { if (!q || q.st !== 'done' || !R.town) return false; const h = R.hero, W = q.rw;
    if (W.xp) W.xp = D.questReward(['xp'], q.f, h.lvl).xp;
    if (W.scroll) { const sc = potion('scroll', W.scroll); if (!bagAdd(R, sc)) drop(R, h.x, h.y + 20, { kind: 'item', item: sc }); }
    if (W.gold) h.gold += W.gold; if (W.xp) gainXp(S, R, W.xp); if (W.shards) giveShards(S, R, W.shards, h.x, h.y, 'Награда за задание');
    if (W.item) { const it = rollItem(R, Math.max(1, q.f), 2, undefined, { min: D.QUESTS[q.key].item || 2 }); it.id = R.nextId++; if (!bagAdd(R, it)) drop(R, h.x, h.y + 20, { kind: 'item', item: it }); W.got = itemName(it); W.rar = it.rar; }
    q.st = 'turned'; ev(S, { k: 'quest', x: h.x, y: h.y, s: 'turn', id: q.id }); R.msg = { s: 'Задание сдано: ' + D.QUESTS[q.key].name, t: S.t }; S.saveN++; return true; }
  // ---- giving (TASKS 1018): the run's offers, drawn by its seed (not its RNG: looking does not change the run) ----
  const qhash = (a) => { a = Math.imul(a ^ (a >>> 16), 2246822519) >>> 0; a = Math.imul(a ^ (a >>> 13), 3266489917) >>> 0; return (a ^ (a >>> 16)) >>> 0; };
  // the first offer is one of the goals put on a floor (named, fetch, room), the rest from the whole pool, each from its own townsman
  // a batch more after each boss slain, as the merchant's shelf is stocked anew (TASKS 1026: 2–3 a run were all taken in the first
  // minute); a batch's givers are those with no offer still waiting
  function offersOf(R) { const G = D.QUEST_GIVE; R.offers = R.offers || []; if (R.offerB === undefined) R.offerB = R.offers.length ? 1 : 0;
    while (R.offerB < 1 + (R.bossN || 0)) { const b = R.offerB++; let a = qhash((R.seed >>> 0) + 0x51ed27 + b * 7919);
      const r = () => (a = qhash(a + 0x9e3779b9)) / 4294967296, pool = G.pool.slice(), from = G.from.filter((w) => !R.offers.some((o) => o.from === w && !o.q)), n = Math.min(from.length, G.n[0] + Math.floor(r() * (G.n[1] - G.n[0] + 1)));
      for (let i = 0; i < n; i++) { const key = pool.splice(Math.floor(r() * (i ? pool.length : 3)), 1)[0], who = from.splice(Math.floor(r() * from.length), 1)[0]; R.offers.push({ key, from: who, q: 0 }); } }
    return R.offers; }
  // the floor a quest taken now points at: past the deepest reached; a goal put on a floor wants one not yet built and no boss's
  function questFloor(R, key) { const Q = D.QUESTS[key], top = RUN(R).floors, d = R.deepest || 0;
    for (let f = Math.max(Q.from || 1, d + (Q.ahead || 1)); f <= top; f++) { if (Q.noBoss && STAGE(R, f).boss) continue; if (Q.fresh && R.memo && R.memo[f]) continue; return f; } return 0; }
  // the Keeper's chain (1022): its first step not yet behind the hero, while none of the chain is in hand
  function storyStep(R) { if (!R.viaTown || (R.quests || []).some((q) => D.QUESTS[q.key].kind === 'story' && q.st !== 'turned')) return null;
    return D.storyChain(R.mode).find((s) => (s.key === 'chapter' ? !(R.slain || []).includes(s.f) : (R.deepest || 0) < s.f)) || null; }
  // what a townsman offers now: the quest as it would be taken (its floor set, its foe's name or its keepsake drawn), or null
  function offerOf(R, role) { if (!R.viaTown) return null; let o = null, key, f, story = 0;
    const st = role === 'keeper' && storyStep(R); if (st) { key = st.key; f = st.f; story = 1; }
    else { o = offersOf(R).find((q) => q.from === role && !q.q && questFloor(R, q.key)); if (!o) return null; key = o.key; f = questFloor(R, key); }
    const Q = D.QUESTS[key], q = { id: 0, key, f, need: Q.need(f), n: 0, st: 'taken', from: role, rw: D.questReward(Q.rw, f, R.hero.lvl), story },
      k = qhash((R.seed >>> 0) * 31 + f * 977 + key.length * 131 + role.length);
    if (Q.type === 'named') q.title = D.NAMED.titles[k % D.NAMED.titles.length];
    if (Q.type === 'fetch') { q.thing = D.QUEST_SAY[role].thing; q.ic = D.QUEST_SAY[role].ic; }
    return { o, q }; }
  const questDone = (R, role) => (R.quests || []).find((q) => q.st === 'done' && q.from === role);
  // the mark over a townsman's head: ? a quest to turn in, ! one to take
  const questMark = (R, role) => (!R.town ? '' : questDone(R, role) ? '?' : offerOf(R, role) ? '!' : '');
  function giveQuest(S, R, role) { const of = offerOf(R, role); if (!of) return null; const q = Object.assign(of.q, { id: R.nextId++ }); delete q.story; if (of.o) of.o.q = q.id; return takeQuest(S, R, q); }
  // the words of a quest's business with a townsman: the turn-in first, then the offer; the last page carries its button
  const rwLine = (W) => [W.scroll && W.scroll + ' ' + D.plural(W.scroll, 'свиток возвращения', 'свитка возвращения', 'свитков возвращения'), W.gold && W.gold + ' золота', W.xp && W.xp + ' опыта', W.item && (W.got ? '«' + W.got + '»' : 'вещь'), W.shards && W.shards + ' ' + D.plural(W.shards, 'осколок', 'осколка', 'осколков')].filter(Boolean).join(' · ');
  function questTalk(R, role) { const SAY = D.QUEST_SAY[role]; if (!SAY) return null;
    const dn = questDone(R, role); if (dn) return { pages: ['«' + D.QUESTS[dn.key].name + '» — выполнено. ' + SAY.done], act: { k: 'turn', id: dn.id, rw: dn.rw } };
    const of = offerOf(R, role); if (!of) return null;
    return { pages: [of.q.story ? D.QUESTS[of.q.key].name + '. ' + SAY.ask : SAY.ask, D.QUESTS[of.q.key].text(of.q)], act: { k: 'take', key: of.q.key, rw: of.q.rw, name: D.QUESTS[of.q.key].name } }; }
  // the keepsake's icon a talk's quest is about (TASKS 1030): the one offered (its giver's keepsake), or the one being turned in
  function questIcon(R, role, a) { if (!a) return null; if (a.k === 'turn') { const q = (R.quests || []).find((o) => o.id === a.id); return (q && q.ic) || null; }
    return D.QUESTS[a.key] && D.QUESTS[a.key].type === 'fetch' && D.QUEST_SAY[role] ? D.QUEST_SAY[role].ic || null : null; }
  // the talk's button: take the quest (the talk closes), or turn it in (the thanks, then whatever else the townsman has)
  function talkAct(S, R, T) { const a = T.act; if (!a) return;
    if (a.k === 'take') { giveQuest(S, R, T.role); S.screen = 'play'; S.talk = null; return; }
    const q = (R.quests || []).find((o) => o.id === a.id); if (!turnIn(S, R, q)) return;
    const nx = questTalk(R, T.role); T.pages = [D.QUEST_SAY[T.role].thanks + ' Получено: ' + rwLine(q.rw) + '.'].concat(nx ? nx.pages : []); T.p = 0; T.act = nx ? nx.act : null; }
  // ---- the goals put on a floor when it is first built (1019–1021) ----
  // rooms a goal may take: fighting rooms off the start, the boss's and the merchant's, farthest from the spawn first
  function questRooms(R) { const m = R.map, sp = m.spawn;
    return m.rooms.filter((r) => (r.type === 'combat' || r.type === 'treasure') && !r.pocket && !r.isle && !(m.shop && m.shop.room === r.id)).sort((a, b) => Math.hypot(b.cx * TILE - sp.x, b.cy * TILE - sp.y) - Math.hypot(a.cx * TILE - sp.x, a.cy * TILE - sp.y)); }
  const plainFoe = (e) => e.deadT < 0 && counted(e) && !D.BOSSES[e.type] && !e.elite && !e.guard && !e.exit && !ENEMIES[e.type].lurk && !ENEMIES[e.type].deep && !ENEMIES[e.type].lake && e.room >= 0;
  function questPlace(S, R) { const f = R.floor, m = R.map;
    for (const q of R.quests || []) { const Q = D.QUESTS[q.key]; if (q.st !== 'taken' || q.f !== f || !Q.fresh || q.placed) continue; q.placed = 1; const rooms = questRooms(R);
      if (Q.type === 'named') { const r = rooms.find((r2) => R.en.some((e) => plainFoe(e) && e.room === r2.id)), e = r && R.en.find((o) => plainFoe(o) && o.room === r.id);
        if (!e) { q.lost = 1; continue; } const stg = STAGE(R, f), mob = stg.mob || 1;
        e.elite = 1; e.mods = rollMods(R, dep(R), e); e.hp = e.max = Math.round(e.max * eliteK(e, 'hp') * D.NAMED.hp); e.dmg = e.dmg / mob * eliteK(e, 'dmg'); if (has(e, 'ward')) e.ward = Math.round(e.max * MOD.ward.share); e.quest = q.id; e.title = q.title; q.room = e.room; }
      else if (Q.type === 'room') { const r = rooms.find((r2) => R.en.filter((e) => e.deadT < 0 && counted(e) && e.room === r2.id).length >= 3) || rooms.find((r2) => R.en.some((e) => e.deadT < 0 && counted(e) && e.room === r2.id));
        if (!r) { q.lost = 1; continue; } q.room = r.id; }
      else if (Q.type === 'fetch') { const roomOf = (c) => m.rooms[DG.roomAt(m, c.x, c.y)] || {}, free = R.chests.filter((c) => !c.open && !c.quest);
        const secret = free.filter((c) => roomOf(c).type === 'secret'), plain = free.filter((c) => roomOf(c).type !== 'secret'), u = qhash((R.seed >>> 0) * 7919 + f * 104729 + q.id) / 4294967296;
        const c = u < 0.35 && secret.length ? pick(R, secret) : u < 0.7 && plain.length ? pick(R, plain) : null;
        if (c) { c.quest = q.id; c.qic = q.ic; q.where = roomOf(c).type === 'secret' ? 'secret' : 'chest'; continue; }
        const r = rooms[Math.min(rooms.length - 1, Math.floor(rnd(R) * Math.min(3, rooms.length)))]; if (!r) { q.lost = 1; continue; }
        const [x, y] = standNear(R, r.cx * TILE + TILE / 2, r.cy * TILE + TILE / 2 + 20);
        R.drops.push({ id: R.nextId++, kind: 'qitem', quest: q.id, ic: q.ic, x, y, vx: 0, vy: 0, z: 0, vz: 0, t0: R.t }); q.where = 'floor'; } } }
  // the journal's order (TASKS 1023): done (to turn in) first, then those in hand, the story before the side, then the turned in
  const journalOf = (R) => (R.quests || []).filter((q) => q.id > 0).map((q, i) => [q, i]).sort(([a, i], [b, j]) => ({ done: 0, taken: 1, turned: 2 })[a.st] - ({ done: 0, taken: 1, turned: 2 })[b.st]
    || (D.QUESTS[a.key].kind === 'story' ? 0 : 1) - (D.QUESTS[b.key].kind === 'story' ? 0 : 1) || i - j).map(([q]) => q);
  // where a quest's goal is on this floor, for the map: the named foe (alive), the room to clear, the keepsake once seen
  function questMarks(R) { const out = []; if (R.town) return out;
    for (const q of R.quests || []) { if (q.st !== 'taken' || q.f !== R.floor) continue; const Q = D.QUESTS[q.key];
      if (Q.type === 'named') { const e = R.en.find((o) => o.quest === q.id && o.deadT < 0); if (e) out.push({ kind: 'named', x: e.x, y: e.y, q }); }
      if (Q.type === 'room' && q.room !== undefined) { const r = R.map.rooms[q.room]; out.push({ kind: 'room', x: r.cx * TILE + TILE / 2, y: r.cy * TILE + TILE / 2, r, q }); }
      if (Q.type === 'fetch') { const d = R.drops.find((o) => o.kind === 'qitem' && o.quest === q.id && !o.got); if (d && !hidden(R.map, d) && R.seen[Math.floor(d.y / TILE) * R.map.W + Math.floor(d.x / TILE)]) out.push({ kind: 'fetch', x: d.x, y: d.y, q }); } }
    return out; }
  // a quest's state in a few words, for the HUD's tracker
  function questLine(q, R) { const Q = D.QUESTS[q.key];
    if (q.st === 'done') return 'Выполнено — награда ждёт в городе';
    if (Q.type === 'kill' || Q.type === 'clear') return q.n + ' / ' + q.need + ' · с ' + q.f + '-го этажа';
    if (Q.type === 'named') return q.title + ' · ' + q.f + '-й этаж';
    if (Q.type === 'fetch') return '«' + q.thing + '» · ' + q.f + '-й этаж';
    if (Q.type === 'room') { const n = R && R.floor === q.f && q.room !== undefined ? R.en.filter((e) => e.room === q.room && e.deadT < 0 && counted(e)).length : 0; return (n ? 'Осталось врагов: ' + n : 'Отмечено на карте') + ' · ' + q.f + '-й этаж'; }
    if (Q.type === 'boss') return 'Хозяин ' + q.f + '-го этажа';
    return 'До ' + q.f + '-го этажа'; }
  // ---------------- a word with the townsfolk (TASKS 1016, 1023) ----------------
  // E by a townsman with something to say (not the smith or the enchanter, whose E is their workshop) opens the dialogue window
  const folkNear = (R) => { if (!R.town || !R.map.town) return null; let best = null, bd = 76;
    for (const f of folkOf(R)) { const FD = D.FOLK[f.role]; if (!FD.lines || f.role === 'smith' || f.role === 'enchanter') continue; const d = Math.hypot(f.x - R.hero.x, f.y - R.hero.y); if (d < bd) { bd = d; best = f; } }
    return best; };
  // the Keeper's pages: the end of the last hero (a first death, a death, a win), a chapter's boss slain, a legendary found, a long
  // time below; each told once; nothing new, his idle pair
  function keeperPages(S, R) { const K = D.KEEPER, T = R.keeperT || (R.keeperT = {}), M = S.meta, out = [];
    if (!M.keeperMet) { M.keeperMet = 1; out.push(...K.first); }
    if (!M.endTold && M.lastEnd) { M.endTold = 1; if (M.lastEnd === 'win') out.push(...K.win); else if (M.lastEnd === 'dead') out.push(...(M.deaths === 1 ? K.death1 : K.death)); }
    if (R.campaignWon && !T.won) { T.won = 1; out.push(...K.win); }
    if ((R.bossN || 0) > (T.boss || 0) && R.lastBoss) { T.boss = R.bossN; out.push(...K.boss(ENEMIES[R.lastBoss].name)); }
    if (R.legend && T.legend !== R.legend) { T.legend = R.legend; out.push(...K.rare(R.legend)); }
    if ((R.away || 0) >= 4 && T.away !== R.townDeep) { T.away = R.townDeep; out.push(...K.away); }
    return out; }
  // a quest's business (TASKS 1018) comes after the Keeper's news and instead of the idle lines; the smith's talk keeps a button
  // into his workshop
  function openTalk(S, R, f) { const FD = D.FOLK[f.role], qt = questTalk(R, f.role); let pages = f.role === 'keeper' ? keeperPages(S, R) : [];
    if (qt) pages = pages.concat(qt.pages);
    else if (!pages.length) { f.sayN = ((f.sayN ?? -1) + 1) % FD.lines.length; pages = FD.lines[f.sayN].slice(); }
    S.talk = Object.assign({ role: f.role, i: f.i, pages, p: 0, act: qt ? qt.act : null }, f.role === 'smith' ? { craft: 1 } : {}); S.screen = 'talk'; S.hover = ''; f.near = 1; f.sayT = -99; S.saveN++; ev(S, { k: 'say', x: f.x, y: f.y, role: f.role }); }
  // ---------------- the storage chest (R-33, TASKS 1012) ----------------
  // gear left in the town for the heroes to come: S.meta.stash, its cells D.STASH.cells(meta), its items under the item balance
  // they were made with (re-powered like a saved run's when that changes)
  function stashOf(S) { const T = S.meta.stash || (S.meta.stash = { v: D.ITEM_BAL.version, items: [] });
    if (T.v !== D.ITEM_BAL.version) { for (const it of T.items) if (it && BASES[it.b]) itemPower(it); T.v = D.ITEM_BAL.version; } return T; }
  function stashPut(S, R, i, j) { const T = stashOf(S), h = R.hero, it = h.bag[i], n = D.STASH.cells(S.meta);
    if (!it) return; if (isCons(it)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'В хранилище — только снаряжение' }); return; }
    if (j === undefined) { j = 0; while (j < n && T.items[j]) j++; }
    if (j >= n) { ev(S, { k: 'nope', x: h.x, y: h.y, s: n < D.STASH.max ? 'Хранилище полно · ячейки — «Сундук предков» на Алтаре душ' : 'Хранилище полно' }); return; }
    const was = T.items[j]; T.items[j] = it; h.bag[i] = was ? Object.assign(was, { id: R.nextId++ }) : null; S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); }
  function stashTake(S, R, j, i) { const T = stashOf(S), h = R.hero, it = T.items[j]; if (!it) return;
    if (i !== undefined && h.bag[i]) { if (isCons(h.bag[i])) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'В хранилище — только снаряжение' }); return; } const was = h.bag[i]; h.bag[i] = Object.assign(it, { id: R.nextId++ }); T.items[j] = was; S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); return; }
    if (i !== undefined) h.bag[i] = it; else if (!bagAdd(R, it)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Инвентарь полон' }); return; }
    it.id = R.nextId++; T.items[j] = null; S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); }
  const atGate = (R) => !!(R.town && R.map.town && gateWays(R).length && Math.hypot(R.map.town.svc.portal.x - R.hero.x, R.map.town.svc.portal.y - R.hero.y) < 64);
  const gateWays = (R) => (R.portal ? [{ k: 'portal', f: R.portal.f }] : []).concat((R.ways || []).map((f) => ({ k: 'way', f })));
  function gateGo(S, R, o) { const h = R.hero; S.screen = 'play';
    enterFloor(S, R, o.f, undefined, o.k); if (o.k === 'portal') R.portal = null; ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); }
  // ---------------- dungeon altars: one gift of each tier, paid from the meta bank; one gift per altar ----------------
  // the offer is rolled when the altar is first opened, so a run saved before altars had gifts still gets one
  function openAltar(S, R, sh) {
    if (!sh.gifts) sh.gifts = [1, 2, 3].map((tier) => ({ id: pick(R, D.GIFTS.filter((g) => g.tier === tier)).id, cost: D.giftCost(tier, dep(R)) }));
    for (const g of sh.gifts) if (g.id === 'greed') g.id = 'alert';
    R.altar = R.shrines.indexOf(sh); S.screen = 'altar'; S.hover = ''; ev(S, { k: 'altar', x: sh.x, y: sh.y });
  }
  function takeGift(S, R, sh, i, x, y) {
    if (sh.used) return;
    const o = sh.gifts[i], G = D.GIFTS.find((q) => q.id === o.id), h = R.hero;
    if (S.meta.shards < o.cost) { ev(S, { k: 'nope', x, y, s: 'Не хватает осколков душ' }); return; }
    S.meta.shards -= o.cost; sh.used = 1; sh.took = o.id;
    if (o.id === 'bless') h.bless = 1; else { h.perks = h.perks || {}; h.perks[o.id] = (h.perks[o.id] || 0) + 1; }
    const st = heroSt(S); h.hp = st.maxHp; h.mp = st.maxMp;
    ev(S, { k: 'bless', x: sh.x, y: sh.y, id: o.id, s: G.name, cost: o.cost }); R.msg = { s: G.name + ': ' + G.desc + (o.id === 'bless' ? ' до конца этажа' : ' до конца забега'), t: S.t };
    S.screen = 'play'; S.saveN++;
  }
  // a spent altar only answers while a donation can go through (TASKS 242)
  const canDonate = (R) => (R.donations || 0) < 10 && R.hero.gold >= 1000;
  function donate(S, R, x, y) {
    if ((R.donations || 0) >= 10) { ev(S, { k: 'nope', x, y, s: 'Лимит: 10 пожертвований за забег' }); return; }
    if (R.hero.gold < 1000) { ev(S, { k: 'nope', x, y, s: 'Не хватает золота' }); return; }
    R.hero.gold -= 1000; R.donations = (R.donations || 0) + 1;
    giveShards(S, R, 1, R.hero.x, R.hero.y, 'Пожертвование · +1 осколок души'); S.saveN++;
  }
  // ---------------- the merchant ----------------
  // his shelf for this floor: the gear first (the showpiece at least SHOP.best rarity), then potions and scrolls in stacks
  // kind: 'town' — the town's shelf, more potions and scrolls; 'wander' — the wandering merchant of a floor, his gear from deeper down
  // a deeper floor reached tops the town shelf's potions and scrolls up to its count there, its gear kept (TASKS 513: on the 10th–12th
  // the player drank a stock a trip)
  function restock(R, sh, f) { for (const [b, n] of D.SHOP.townCons(f)) { const g = sh.goods.find((q) => q.n && q.it.b === b), price = D.itemPrice({ b }, f);
    if (g) { g.n = Math.max(g.n, n); g.price = price; } else sh.goods.push({ it: Object.assign(potion(b, 1), { id: R.nextId++ }), price, n }); } }
  function stockShop(R, f, kind) {
    const goods = [], SH = D.SHOP, WD = SH.wander, g = kind === 'wander' ? f + WD.depth : f, q = SH.q(g) + (kind === 'wander' ? WD.q : 0), best = Math.min(4, SH.best(g) + (kind === 'wander' ? WD.best : 0));
    for (let i = 0; i < SH.gear(g); i++) { let it = rollItem(R, g, q, i === 0 ? 'weapon' : undefined);
      for (let k = 0; i === 0 && it.rar < best && k < 60; k++) it = rollItem(R, g, q + 1, 'weapon');
      it.id = R.nextId++; goods.push({ it, price: D.itemPrice(it, g) }); }
    for (const [b, n] of (kind === 'town' ? SH.townCons : SH.cons)(f)) goods.push({ it: Object.assign(potion(b, 1), { id: R.nextId++ }), price: D.itemPrice({ b }, f), n });
    return Object.assign({ goods, back: [], greetT: -9, tradeT: -9, away: 1, line: 0 }, kind === 'wander' ? { wander: 1 } : {});
  }
  // what the merchant pays and asks by: the floor's depth, in the town the deepest floor reached
  const tradeDepth = (R) => (R.town ? dep(R, Math.max(1, R.deepest || 0)) : dep(R));
  const atCounter = (R) => { const s = R.map.shop, h = R.hero; return !!s && Math.abs(h.x - s.front.x) < 64 && h.y > s.counter.y - 4 && h.y - s.front.y < 40; };
  function openShop(S, R) { S.screen = 'shop'; R.shop.line = Math.floor(rnd(R) * (R.shop.wander ? D.SHOP.wander.lines : D.SHOP.lines).length); R.shop.tradeT = S.t; S.hover = ''; ev(S, { k: 'shop', x: R.map.shop.x, y: R.map.shop.y }); }
  function buy(S, R, g, back) {
    const h = R.hero, sh = R.shop;
    if (h.gold < g.price) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Не хватает золота' }); return; }
    const it = g.n ? Object.assign(potion(g.it.b, 1), { id: R.nextId++ }) : g.it;
    if (!bagAdd(R, it)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Инвентарь полон' }); return; }
    h.gold -= g.price; sh.tradeT = S.t;
    if (g.n) { if (--g.n <= 0) sh.goods.splice(sh.goods.indexOf(g), 1); } else (back ? sh.back : sh.goods).splice((back ? sh.back : sh.goods).indexOf(g), 1);
    ev(S, { k: 'trade', x: R.map.shop.x, y: R.map.shop.y, n: -g.price, s: 'Куплено: ' + itemName(it), rar: it.rar });
  }
  // a sale goes onto the buy-back row at the price paid for it, so a slip of the mouse costs nothing
  function sell(S, R, i) {
    const h = R.hero, sh = R.shop, it = h.bag[i]; if (!it) return;
    const n = isCons(it) ? 1 : 0, price = D.sellPrice(it, tradeDepth(R)), one = n && it.n > 1 ? Object.assign({}, it, { id: R.nextId++, n: 1 }) : it;
    if (n && it.n > 1) it.n--; else h.bag[i] = null;
    h.gold += price; sh.tradeT = S.t; sh.back.push({ it: one, price }); if (sh.back.length > D.SHOP.buyback) sh.back.shift();
    ev(S, { k: 'trade', x: R.map.shop.x, y: R.map.shop.y, n: price, s: 'Продано: ' + itemName(one), rar: one.rar });
  }

  const projWall = (m, x0, y0, x1, y1, gz) => { const cx = Math.floor(x0 / TILE), cy = Math.floor((y0 + gz) / TILE), nx = Math.floor(x1 / TILE), ny = Math.floor((y1 + gz) / TILE), pc = cell(m, nx, ny);
    return pc === 0 || pc === 4 || pc === 5 || pinch(m, cx, cy, nx, ny); };
  const projCover = (m, x, y) => m.decor.some((d) => d.cover && !d.broken && Math.abs(x - d.x) < 26 && y > d.y - 75 && y < d.y + 8);
  // how far a shot fired now would fly before a wall or a cover stops it: the serpent's warnings end where its water really does
  function flightReach(m, x, y, a, speed, life, gz) { const vx = Math.cos(a) * speed * DT, vy = Math.sin(a) * speed * DT, n = Math.ceil(life / DT);
    for (let i = 1; i <= n; i++) { const x1 = x + vx, y1 = y + vy; if (projWall(m, x, y, x1, y1, gz) || projCover(m, x1, y1)) return (i - 1) * speed * DT; x = x1; y = y1; }
    return n * speed * DT; }
  function stepProjectiles(S, R) {
    const m = R.map, h = R.hero;
    for (const p of R.proj) { if (p.dead) continue;
      // gz: how far over its floor it flies (an eel's jet leaves its mouth high over the water)
      const gz = p.gz ?? 20, x0 = p.x, y0 = p.y;
      p.x += p.vx * DT; p.y += p.vy * DT; const age = S.t - p.t0;
      const pc = cell(m, Math.floor(p.x / TILE), Math.floor((p.y + gz) / TILE)), wall = projWall(m, x0, y0, p.x, p.y, gz);
      if (pc === 4 && p.own === 'hero') { const q = secretAt(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)); if (q && kindOf(q) === 'crack') hitSecret(S, R, q); }
      if (pc === 5 && p.own === 'hero') { const d = doorAt(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)); if (d) openDoor(S, R, d, 1); }
      let boom = wall || age > p.life || projCover(m, p.x, p.y);
      if (p.own === 'hero') { for (const e of R.en) if (e.deadT < 0 && !under(e) && Math.hypot(e.x - p.x, e.y - ENEMIES[e.type].h * 0.45 - p.y) < ENEMIES[e.type].r + p.r + 6) { boom = true; break; } }
      else if (h.deadT < 0 && Math.hypot(h.x - p.x, h.y - 38 - p.y) < (p.hitR || 20)) { if (!p.spent) hurtHero(S, R, p.dmg, p.x, p.y, p.kind || p.k, (p.who || '?') + ' снаряд', R.en.find((o) => o.id === (p.src || p.actorId))); if (p.vol) { R.volHit = p.vol; for (const q of R.proj) if (q.vol === p.vol) q.spent = 1; } struck(S, R, p.src && R.en.find((o) => o.id === p.src)); boom = true; p.onHero = 1; }
      if (boom) { p.dead = 1;
        // the blast spreads from the last open cell: the one it flew into may be the wall itself
        if (p.own === 'hero') { const bx = p.x - p.vx * DT, by = p.y + 20 - p.vy * DT;
          for (const e of R.en) if (e.deadT < 0 && Math.hypot(e.x - p.x, (e.y - ENEMIES[e.type].h * 0.4 - p.y) * 1.2) < 66 + ENEMIES[e.type].r && losClear(m, bx, by, e.x, e.y)) heroHit(S, R, e, p.dmg, false, p.x, p.y, 1.2, 'fire', p.x, p.y + ENEMIES[e.type].h * 0.45);
          breakPots(S, R, bx, by, 50); hitProps(S, R, bx, by, 50); tearWebs(S, R, bx, by - 20, 66, undefined, undefined, 1); ev(S, { k: 'boom', x: p.x, y: p.y, gx: bx, gy: by }); R.trauma = Math.min(1, R.trauma + 0.2); }
        else ev(S, { k: 'pop', x: p.x, y: p.y, c: p.k, hero: p.onHero || 0 }); } }
    R.proj = R.proj.filter((p) => !p.dead);
  }
  function stepMonsters(S, R, live) {
    const m = R.map, h = R.hero, t = S.t, htx = Math.floor(h.x / TILE), hty = Math.floor(h.y / TILE), F = flow(m, htx, hty), heroOk = live && h.deadT < 0;
    for (const e of R.en) {
      const E = ENEMIES[e.type];
      // (one blast at least BOOM_GAP after the last, TASKS 1051: a neighbour's set off by it burst at once, 3 in 1.3 s, 2 on one tick)
      if (e.deadT >= 0) { if (e.fuse && t >= e.fuse) { if (t >= (R.boomT ?? -9) && t - (R.boomT ?? -9) < BOOM_GAP) { e.fuse = R.boomT + BOOM_GAP; ev(S, { k: 'fuse', x: e.x, y: e.y, r: (ENEMIES[e.type].boom || MOD.explosive).r, d: e.fuse - t, id: e.id }); } else blast(S, R, e); } continue; }
      if (e.burn > t && t - e.burnT >= 0.5) { e.burnT = t; hitEnemy(S, R, e, Math.max(1, Math.round(2 + dep(R))), false, e.x, e.y, 0, 'burn'); if (e.deadT >= 0) continue; }
      // knockback decays
      if (e.kbx || e.kby) { move(m, e, e.kbx * DT, e.kby * DT, E.r, true, !E.ghost && (m.cliff && !D.BOSSES[e.type] ? 2 : true)); e.kbx *= Math.exp(-10 * DT); e.kby *= Math.exp(-10 * DT); if (Math.abs(e.kbx) + Math.abs(e.kby) < 4) e.kbx = e.kby = 0;
        if (e.fallT === undefined && chasm(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) { e.fallT = t; e.kbx = e.kby = 0; ev(S, { k: 'fall', x: e.x, y: e.y, id: e.id, type: e.type }); } }
      // a tug whose warning ran out lands now, whatever the elite is doing (a blow it began meanwhile put it off past the
      // warning, and the dash timed to the warning no longer slipped it); never once it is falling, sinking or the hero gone
      if (e.tugW && t >= e.tugW) { const M = MOD.tug, d = Math.hypot(h.x - e.x, h.y - e.y), n = Math.min(M.n, d - (E.r + K.R + 24)); e.tugW = 0; e.tugT = t + M.every;
        if (n > 0 && heroOk && e.fallT === undefined && e.sinkT === undefined && losClear(m, e.x, e.y - 10, h.x, h.y - 10) && !(t - h.dashT < BAL.dodge.t)) {
          h.pull = { x: (e.x - h.x) / d, y: (e.y - h.y) / d, n, T: M.T, done: 0 }; ev(S, { k: 'tug', x: h.x, y: h.y, tx: e.x, ty: e.y, id: e.id }); } }
      // knocked off a plateau (TASKS 401): into the chasm it falls, in the lava it burns; either way it is gone in a moment
      if (e.fallT !== undefined || e.sinkT !== undefined) { e.vx = e.vy = 0; if (t >= (e.fallT ?? e.sinkT) + (e.fallT !== undefined ? DOOM.fall : DOOM.sink)) killEnemy(S, R, e); continue; }
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy);
      if (e.face !== e.pf) { if (e.pf) e.ft = t; e.pf = e.face; }
      if (E.kind === 'eel') { eel(S, R, e, E, heroOk, d); continue; }
      if (E.kind === 'serpent') { serpent(S, R, e, heroOk); continue; }
      if (E.lake && (e.st === 'idle' || e.st === 'emerge' || e.st === 'wade')) { colossusRise(S, R, e); continue; }
      if (E.kind === 'bomber' && e.st === 'wind') { skid(m, e, E); if (t >= e.fuse) { if (t >= (R.boomT ?? -9) && t - (R.boomT ?? -9) < BOOM_GAP) { e.fuse = R.boomT + BOOM_GAP; ev(S, { k: 'fuse', x: e.x, y: e.y, r: E.boom ? E.boom.r : MOD.explosive.r, d: e.fuse - t, id: e.id, lit: 1 }); } else { e.blown = 1; blast(S, R, e); killEnemy(S, R, e); } } continue; }
      // (when it went into the lava or came out of it, for the render's ease between swimming and walking)
      if (E.kind === 'salamander') { const on = onLava(m, e) ? 1 : 0; if ((e.lv || 0) !== on) { e.lv = on; e.lvT = t; } }
      if (e.st === 'leap') { leapStep(S, R, e, E); continue; }
      if (e.st === 'soak') { soak(S, R, e, E); continue; }
      if (E.crust) golemCrust(S, R, e, E, d);   // (at its post too: a hero who walked away finds it whole again)
      // a drowned under the shallows stirs only for a hero close by; it stands up out of the water before it can do anything
      if (e.st === 'lurk') { e.vx = e.vy = 0; if (heroOk && d < E.sense && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) rise(S, R, e); continue; }
      if (e.st === 'rise') { e.vx = e.vy = 0; if (t - e.t0 < E.rise) continue; e.st = 'chase'; e.t0 = e.seenT = t; e.cdT = Math.max(e.cdT, t + 0.25); }
      if (e.st === 'idle' || e.st === 'home') {
        if (heroOk && (!D.BOSSES[e.type] || !m.bossType || R.arena) && !(e.calmT > t) && d < 330 && (DG.roomAt(m, h.x, h.y) === e.room || d < 170) && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) { aggroRoom(R, e); ev(S, { k: 'alert', x: e.x, y: e.y - E.h - 8, id: e.id }); if (e.type === 'boss') roar(S, R, e); }
        else { if (e.st === 'idle') idle(m, e, E, t); else goHome(m, e, E, t);
          // a crab at its post looks one way, then the other, at its own slow pace
          if (E.kind === 'crab') { const per = 6 + (e.id % 5), n = Math.floor((t + e.id * 2.3) / per); crabTurn(e, E, n % 2 ? 0.5 : Math.PI - 0.5, 0.5); }
          else if (E.kind === 'salamander' && Math.hypot(e.vx, e.vy) > 4) crabTurn(e, E, Math.atan2(e.vy, e.vx), 0.5);
          continue; } }
      if (!heroOk) { e.vx = e.vy = 0; continue; }
      // a committed attack keeps facing its aim: a lunge that carries past the hero must not mirror mid-strike; a hero straight above or below doesn't flip it every frame
      if (E.kind === 'crab') { if (e.st === 'chase' || (e.st === 'wind' && !e.rush)) { crabTurn(e, E, Math.atan2(dy, dx), e.st === 'wind' ? 0.5 : 1); if (e.st === 'wind') e.aimA = e.fa; } else crabTurn(e, E, faOf(e), 0); }
      else if (E.kind === 'salamander') { if (e.st !== 'chase') crabTurn(e, E, e.aimA, 1); }
      else e.face = e.st === 'wind' || e.st === 'strike' || e.st === 'bwind' ? (Math.cos(e.aimA) >= 0 ? 1 : -1) : Math.abs(dx) > 10 ? (dx > 0 ? 1 : -1) : e.face;
      // a hero out of sight for 4 s is lost: the monster walks back to its post
      if (e.st === 'chase' && E.kind !== 'boss' && e.hx !== undefined) {
        if (d < 420 && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) e.seenT = t;
        else if (t - e.seenT > 4) { e.st = 'home'; e.t0 = t; continue; }
        // under two cells of headway along the path in 2.5 s while short of the fight and the hero holds still (a corridor jammed by its own kind,
        // a wall in the way): it walks back to its post and stays deaf to the sight of the hero for a while, or it would turn round
        // at once and jam the corridor again. A hero on the move resets it: a chase is not a jam
        const near = d < (E.kind === 'caster' || E.kind === 'archer' || E.kind === 'imp' || E.kind === 'salamander' ? 300 : E.r + K.R + E.reach + 40), fv = F[Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE)], pd = fv >= 0 ? fv : d / TILE;
        if (near || e.stuckK !== e.t0 || pd <= e.aF - 2 || Math.hypot(h.x - e.ax, h.y - e.ay) > 48) { e.stuckK = e.t0; e.aF = pd; e.ax = h.x; e.ay = h.y; e.aT = t; }
        else if (t - e.aT > 2.5) { e.st = 'home'; e.t0 = t; e.calmT = t + 4; continue; } }
      if (e.st === 'chase' && has(e, 'blink')) { if (e.blinkT === undefined) e.blinkT = t + MOD.blink.every / 2; if (t >= e.blinkT) e.blinkT = t + (blink(S, R, e) ? MOD.blink.every : 1); }
      if (e.st === 'chase' && has(e, 'tug')) { const M = MOD.tug, clear = () => losClear(m, e.x, e.y - 10, h.x, h.y - 10); if (e.tugT === undefined) e.tugT = t + M.every / 2;
        if (!e.tugW && t >= e.tugT) { if (d >= M.min && d <= M.max && clear()) { e.tugW = t + M.warn; ev(S, { k: 'tug_warn', x: e.x, y: e.y, id: e.id, d: M.warn }); } else e.tugT = t + 1; }
      }
      if (e.st === 'chase' && has(e, 'summoner')) { if (e.sumT === undefined) e.sumT = t + 2; if (t >= e.sumT) { e.sumT = t + MOD.summoner.every; raise(S, R, e); } }
      if (e.st === 'chase') {
        const reach = E.r + K.R + E.reach;
        if (E.kind === 'boss') { bossThink(S, R, e, d); if (E.lake) colossusStep(S, R, e); continue; }
        if (E.kindle && t >= (e.kinT ?? (e.kinT = t + E.kindle.first)) && kinOf(R, e, E).length) { e.st = 'wind'; e.t0 = t; e.kin = 1; e.aimA = Math.atan2(h.y - 38 - (e.y - 44), h.x - e.x); continue; }
        if (E.kind === 'caster') { const los = losClear(m, e.x, e.y - 20, h.x, h.y - 20);
          if (d < (E.orb || E.pyre ? E.reach : 360) && los && t >= e.cdT) { e.st = 'wind'; e.t0 = t; e.aimA = Math.atan2(h.y - 38 - (e.y - 44), h.x - e.x); continue; }
          const c = E.behind && d > 120 ? cover(R, e, h) : null;
          if (!c || !toward(e, E, m, c[0], c[1])) { const want = d < 170 ? -1 : d > 280 || !los ? 1 : 0; steer(e, E, m, F, want, dx, dy, d); } }
        // the archer looses at the hero in sight within its reach; between shots it keeps its distance, backing off from one who comes on
        else if (E.kind === 'archer') { const los = losClear(m, e.x, e.y - ARROW_Y, h.x, h.y - 38);
          if (d < E.reach && los && t >= e.cdT) { e.st = 'wind'; e.t0 = t; aimArrow(m, e, E, h); continue; }
          steer(e, E, m, F, d < E.keep[0] ? -1 : d > E.keep[1] || !los ? 1 : 0, dx, dy, d, d < E.keep[0] ? 0.85 : 1); }
        // the crab pinches only what stands before its claws; one out to its side, not too close, it runs down sideways
        else if (E.kind === 'crab' && t >= e.cdT && d < reach && Math.abs(angDiff(Math.atan2(dy, dx), faOf(e))) < E.armor.arc * 0.8) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = faOf(e); e.rush = 0; continue; }
        else if (E.kind === 'crab' && t >= e.cdT && t >= (e.rushT ?? 0) && d > E.r + K.R + E.rush.near && d < E.r + K.R + E.rush.reach && Math.abs(Math.abs(angDiff(Math.atan2(dy, dx), faOf(e))) - Math.PI / 2) < 0.7
          && losClear(m, e.x, e.y - 6, h.x, h.y - 6)) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = Math.atan2(dy, dx); e.rush = 1; continue; }
        else if (E.kind === 'crab') steer(e, E, m, F, d < Math.max(reach * 0.8, E.r + K.R + 6) ? 0 : 1, dx, dy, d);
        else if (E.kind === 'bomber' && d < reach) { fuse(S, R, e); continue; }
        else if (E.kind === 'imp') { if (impThink(S, R, e, E, F, d, dx, dy)) continue; }
        else if (E.kind === 'salamander') { if (salamThink(S, R, e, E, d, dx, dy)) continue; }
        else if (d < reach && t >= e.cdT && (E.kind !== 'hop' || losClear(m, e.x, e.y - 6, h.x, h.y - 6))) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = Math.atan2(dy, dx); e.grab = 0; continue; }
        else if (E.grab && d < E.r + K.R + E.grab.reach && t >= e.cdT && t >= (e.grabT ?? 0) && losClear(m, e.x, e.y - 20, h.x, h.y - 20)) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = Math.atan2(dy, dx); e.grab = 1; continue; }
        else steer(e, E, m, F, d < Math.max(Math.min(reach, E.r + K.R + 46) * 0.8, E.r + K.R + 6) ? 0 : 1, dx, dy, d);
        move(m, e, e.vx * DT, e.vy * DT, E.r, true, E.lava && E.kind === 'salamander' ? true : undefined);
        const sp = Math.hypot(e.vx, e.vy); e.dist += sp * DT;
        // the salamander's belly burns a trail on land behind it
        if (E.trail && !onLava(m, e) && (e.trailD = (e.trailD || 0) + sp * DT) >= E.trail.every) { e.trailD = 0; addFire(R, S, e.x - Math.cos(faOf(e)) * E.r, e.y - Math.sin(faOf(e)) * E.r * 0.8, { src: e.id, who: who(e), r: E.trail.r, ry: E.trail.ry, t: E.trail.t, dmg: e.dmg * E.trail.dmg, per: E.trail.per, kind: 'trail' }); }
      } else if (e.st === 'wind') {
        skid(m, e, E); const w = windOf(e, e.grab ? E.grab.wind : e.rush ? E.rush.wind : e.kin ? E.kindle.wind : E.spark && !e.claw ? E.spark.wind : e.br ? E.breath.wind : E.wind);
        if (E.kind === 'archer' && t - e.t0 < w - E.arrow.lock) aimArrow(m, e, E, h);
        if (E.spark && !e.claw && t - e.t0 < w - E.spark.lock) { e.aimA = Math.atan2(h.y - 38 - (e.y - IMP_Y), h.x - e.x); e.face = Math.cos(e.aimA) >= 0 ? 1 : -1; }
        if (t - e.t0 >= w) { e.st = 'strike'; e.t0 = t;
          if (e.grab) { grab(S, R, e); continue; }
          if (E.kind === 'crab') { if (e.rush) { e.hitDone = 0; ev(S, { k: 'rush', x: e.x, y: e.y, a: e.aimA, id: e.id }); continue; }
            if (d < E.r + K.R + E.reach * 1.25 && Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)) < E.armor.arc && losClear(m, e.x, e.y, h.x, h.y)) { hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); }
            ev(S, { k: 'pinch', x: e.x + Math.cos(e.aimA) * (E.r + 14), y: e.y + Math.sin(e.aimA) * (E.r + 14) * 0.8, a: e.aimA, id: e.id }); continue; }
          if (E.kind === 'hop') { takeOff(R, e, E); continue; }
          if (E.kind === 'imp') { const a = e.aimA;
            if (e.claw) { if (d < E.r + K.R + E.reach * 1.25 && Math.abs(angDiff(Math.atan2(dy, dx), a)) < 1.3 && losClear(m, e.x, e.y, h.x, h.y)) { hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } ev(S, { k: 'eswing', x: e.x, y: e.y, a, id: e.id }); continue; }
            const Sp = E.spark, x0 = e.x + Math.cos(a) * 10, y0 = e.y - IMP_Y + Math.sin(a) * 10;
            R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: 'spark', kind: 'fire', x: x0, y: y0, vx: Math.cos(a) * Sp.spd, vy: Math.sin(a) * Sp.spd, t0: t, life: (Sp.reach + 60) / Sp.spd, dmg: e.dmg * Sp.dmg * eliteK(e, 'bolt'), own: 'en', r: Sp.r, gz: IMP_Y - 6 });
            ev(S, { k: 'flick', x: x0, y: y0, a, id: e.id }); continue; }
          if (E.kind === 'salamander') { if (e.br) { e.hitDone = 0; breathFire(S, R, e, E); ev(S, { k: 'breath', x: e.x, y: e.y, a: e.aimA, id: e.id }); continue; }
            if (d < E.r + K.R + E.reach * 1.25 && Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)) < 0.9 && losClear(m, e.x, e.y, h.x, h.y)) { hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); }
            ev(S, { k: 'snap', x: e.x + Math.cos(e.aimA) * (E.r + 10), y: e.y + Math.sin(e.aimA) * (E.r + 10) * 0.8, a: e.aimA, id: e.id }); continue; }
          if (E.kind === 'golem') { const G0 = E.slam, px = e.x + Math.cos(e.aimA) * G0.at, py = e.y + Math.sin(e.aimA) * G0.at * 0.8;
            if (Math.hypot(h.x - px, (h.y - py) / 0.7) < G0.r + K.R && losClear(m, e.x, e.y, h.x, h.y)) { hurtHero(S, R, e.dmg, px, py, undefined, who(e), e); struck(S, R, e); }
            ev(S, { k: 'slam', x: px, y: py, id: e.id, big: 1, r: G0.r }); R.trauma = Math.min(1, R.trauma + 0.5); continue; }
          if (E.kind === 'archer') { const a = e.aimA, A = E.arrow, x0 = e.x + Math.cos(a) * 16, y0 = e.y - ARROW_Y + Math.sin(a) * 16;
            R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: 'arrow', kind: has(e, 'fiery') ? 'fire' : 'arrow', x: x0, y: y0, vx: Math.cos(a) * A.spd, vy: Math.sin(a) * A.spd, t0: t, life: (E.reach + 60) / A.spd, dmg: e.dmg * eliteK(e, 'bolt'), own: 'en', r: A.r, gz: ARROW_Y - 10 });
            ev(S, { k: 'loose', x: x0, y: y0, a, id: e.id }); }
          else if (e.kin) kindle(S, R, e, E);
          else if (E.pyre) pyre(S, R, e, E);
          else if (E.orb) { const a = e.aimA, O = E.orb, x0 = e.x + Math.cos(a) * 22, y0 = e.y - 44;
            R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: 'orb', kind: 'water', x: x0, y: y0, vx: Math.cos(a) * O.spd, vy: Math.sin(a) * O.spd, t0: t, life: O.life, dmg: e.dmg * eliteK(e, 'bolt'), own: 'en', r: O.r, hitR: 20 + O.r });
            ev(S, { k: 'orb', x: x0, y: y0, id: e.id }); }
          else if (E.kind === 'caster') { const a = e.aimA, fire = R.map.biome === 'lava' || R.map.biome === 'magma' || has(e, 'fiery'); R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: fire ? 'fire' : 'hex', x: e.x + Math.cos(a) * 18, y: e.y - 44, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, t0: t, life: 2.2, dmg: e.dmg * (fire ? 1.25 : 1) * eliteK(e, 'bolt'), own: 'en', r: 6 });
            ev(S, { k: "eshoot", x: e.x, y: e.y - 44, id: e.id }); }
          else if (E.kind === 'slam') { if (d < 74 + K.R && losClear(m, e.x, e.y, h.x, h.y)) { hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } ev(S, { k: 'slam', x: e.x + e.face * 26, y: e.y, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.4); }
          else if (E.kind === 'melee') { const ad = Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)); if (d < E.r + K.R + E.reach * 1.25 && ad < 1.3 && losClear(m, e.x, e.y, h.x, h.y)) { hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } ev(S, { k: 'eswing', x: e.x, y: e.y, a: e.aimA, id: e.id }); } }
      } else if (e.st === 'strike') {
        // the lunge stops on contact and springs back for 0.1 s: carried on, the spider passed through the hero to land behind him
        if (E.kind === 'lunge' && t - e.t0 < 0.24) { const a = e.aimA; if (!(e.bncT > e.t0) && d <= E.r + K.R + 6.01) e.bncT = t;
          const v = e.bncT > e.t0 ? (t - e.bncT < 0.1 ? -150 : 0) : 330 * Math.min(1, (t - e.t0) / 0.05); { e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += v * DT;
            if (!e.hitDone && d < E.r + K.R + 8) { e.hitDone = 1; hurtHero(S, R, e.dmg, e.x, e.y, 'poison', who(e), e); struck(S, R, e); } } }
        // the crab's rush runs sideways, the shell still facing its way, stops on the hero and springs back off him
        else if (E.kind === 'crab' && e.rush && t - e.t0 < E.rush.t) { const a = e.aimA; if (!(e.bncT > e.t0) && d <= E.r + K.R + 6.01) e.bncT = t;
          const v = e.bncT > e.t0 ? (t - e.bncT < 0.1 ? -120 : 0) : E.rush.spd * Math.min(1, (t - e.t0) / 0.06); e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += Math.abs(v) * DT;
          if (!e.hitDone && d < E.r + K.R + 8) { e.hitDone = 1; hurtHero(S, R, e.dmg * E.rush.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } }
        // the breath: a hero in its cone at any moment of it is burnt once
        else if (E.kind === 'salamander' && e.br) { skid(m, e, E); const B = E.breath;
          if (!e.hitDone && t - e.t0 < B.t && d < E.r + B.reach + K.R && Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)) < B.arc && losClear(m, e.x, e.y - 6, h.x, h.y - 6)) { e.hitDone = 1; hurtHero(S, R, e.dmg * B.dmg, e.x, e.y, 'fire', who(e) + ' пламя', e); struck(S, R, e); } }
        else if (E.kind !== 'hop') skid(m, e, E);
        if (E.kind === 'hop') hop(S, R, e, E);
        if (t - e.t0 > (E.kind === 'lunge' ? 0.45 : E.kind === 'hop' ? E.jump.t + E.jump.land : e.grab ? E.grab.strike : e.rush ? E.rush.t + 0.2 : e.br ? E.breath.t : E.kind === 'golem' ? 0.55 : 0.32)) { if (e.grab) { e.st = 'chase'; e.grab = 0; e.cdT = t + 0.15; continue; }
          if (e.rush) { e.st = 'chase'; e.rush = 0; e.hitDone = 0; e.rushT = t + E.rush.cd; e.cdT = t + 0.5; continue; }
          if (e.br) { e.br = 0; e.brT = t + E.breath.cd * (0.8 + 0.4 * rnd(R)); } e.st = 'chase'; e.cdT = t + E.cd * (e.elite && !D.BOSSES[e.type] && e.type !== 'brute' && dep(R) <= BAL.early ? BAL.earlyCd : eliteK(e, 'cd')) * (0.8 + 0.4 * rnd(R)); e.hitDone = 0; }
      }
    }
    // separation: monsters don't stack
    const live2 = R.en.filter((e) => e.deadT < 0 && e.st !== 'idle' && e.st !== 'leap' && !ENEMIES[e.type].deep);
    for (let i = 0; i < live2.length; i++) for (let j = i + 1; j < live2.length; j++) { const a = live2[i], b = live2[j], ra = ENEMIES[a.type].r + ENEMIES[b.type].r + 4;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < ra && d > 0.01) { const p = (ra - d) * 0.5; move(m, a, -dx / d * p, -dy / d * p, ENEMIES[a.type].r, true); move(m, b, dx / d * p, dy / d * p, ENEMIES[b.type].r, true); } }
    // whatever moved them (walking, knockback, a lunge, the crowd), monsters stand clear of props; a ghost floats through
    const sol = solids(R);
    for (const e of R.en) if (e.deadT < 0 && e.st !== 'leap' && !ENEMIES[e.type].ghost && !ENEMIES[e.type].deep) shove(m, e, ENEMIES[e.type].r, true, sol);
    if (heroOk) for (const e of R.en) {
      const E = ENEMIES[e.type]; if (e.deadT >= 0 || !['melee', 'slam', 'lunge', 'hop', 'crab', 'bomber', 'imp', 'salamander', 'golem'].includes(E.kind) || e.st === 'lurk' || e.st === 'leap') continue;
      const dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy), stop = E.r + K.R + 6;
      if (d >= stop) continue;
      const angle = d > 0.01 ? Math.atan2(dy, dx) : e.face > 0 ? Math.PI : 0;
      for (let i = 0; i <= 24; i++) {
        const a = angle + Math.ceil(i / 2) * (i % 2 ? 1 : -1) * Math.PI / 12, trial = { x: e.x, y: e.y };
        move(m, trial, h.x + Math.cos(a) * stop - e.x, h.y + Math.sin(a) * stop - e.y, E.r, true, !E.ghost);
        if (Math.hypot(trial.x - h.x, trial.y - h.y) < stop - 0.01 || !E.ghost && sol.some((o) => Math.hypot(trial.x - o.x, (trial.y - o.y) * 1.6) < E.r + o.r - 0.01)) continue;
        e.x = trial.x; e.y = trial.y; break;
      }
    }
    // corpses are removed once they have faded
    R.en = R.en.filter((e) => e.deadT < 0 || t - e.deadT < 6);
  }
  // at its post a monster breathes (the rig), looks one way then the other, and now and then shifts a step around the spot
  function idle(m, e, E, t) {
    const per = 6 + (e.id % 5), u = (t + e.id * 2.3) % per, n = Math.floor((t + e.id * 2.3) / per);
    let vx = 0, vy = 0;
    if (u > 3.2 && u < 3.8 && e.hx !== undefined && !E.ghost) {
      const a = n * 2.4 + e.id, gx = e.hx + Math.cos(a) * 14 - e.x, gy = e.hy + Math.sin(a) * 8 - e.y, gd = Math.hypot(gx, gy);
      if (gd > 3) { vx = gx / gd * E.spd * 0.3; vy = gy / gd * E.spd * 0.3; } }
    const k = 1 - Math.exp(-12 * DT); e.vx += (vx - e.vx) * k; e.vy += (vy - e.vy) * k;
    const sp = Math.hypot(e.vx, e.vy); if (sp < 1) e.vx = e.vy = 0; else { move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += sp * DT; }
    if (u > 1.1 && u < 1.2) e.face = n % 2 ? 1 : -1; else if (u > 4.4 && u < 4.5) e.face = n % 2 ? -1 : 1;
    else if (sp > 4 && Math.abs(e.vx) > 2) e.face = e.vx > 0 ? 1 : -1;
  }
  function goHome(m, e, E, t) {
    const dx = e.hx - e.x, dy = e.hy - e.y, d = Math.hypot(dx, dy);
    // home, or walked for long enough without getting there (blocked): this is the post now
    if (d < 8 || t - e.t0 > 25) { e.st = E.lurk && inWater(m, e) ? 'lurk' : 'idle'; e.t0 = t; e.hx = e.x; e.hy = e.y; e.vx = e.vy = 0; return; }
    steer(e, E, m, homeFlow(m, Math.floor(e.hx / TILE), Math.floor(e.hy / TILE)), 1, dx, dy, d, 0.6);
    move(m, e, e.vx * DT, e.vy * DT, E.r, true, E.kind === 'salamander' ? true : undefined); e.dist += Math.hypot(e.vx, e.vy) * DT;
    if (Math.abs(e.vx) > 6) e.face = e.vx > 0 ? 1 : -1;
  }
  // a monster that stops to attack skids to a halt instead of freezing mid-stride (the rig's gait reads its speed and distance)
  // the archer's arrow leaves the bow ARROW_Y px over its feet; e.aimD is how far it would fly, to the first wall it would meet (no line is drawn since TASKS 338)
  const ARROW_Y = 46;
  function aimArrow(m, e, E, h) { const a = Math.atan2(h.y - 38 - (e.y - ARROW_Y), h.x - e.x), gz = ARROW_Y - 10, x0 = e.x, y0 = e.y - ARROW_Y + gz, n = Math.ceil((E.reach + 60) / 6);
    let cx = Math.floor(x0 / TILE), cy = Math.floor(y0 / TILE), dd = E.reach + 60; e.aimA = a;
    for (let i = 1; i <= n; i++) { const x = x0 + Math.cos(a) * i * 6, y = y0 + Math.sin(a) * i * 6, nx = Math.floor(x / TILE), ny = Math.floor(y / TILE);
      if (solidC(m, nx, ny) || pinch(m, cx, cy, nx, ny)) { dd = i * 6; break; } cx = nx; cy = ny; }
    e.aimD = dd; }
  // a mage's cover: the nearest monster of the fight standing between it and the hero; it keeps `behind` px past it, away from him
  function cover(R, e, h) { const E = ENEMIES[e.type], de = Math.hypot(h.x - e.x, h.y - e.y); let best = null, bd = 1e9;
    for (const o of R.en) { if (o === e || o.deadT >= 0 || o.st !== 'chase' && o.st !== 'wind' && o.st !== 'strike') continue; const K0 = ENEMIES[o.type];
      if (K0.kind === 'caster' || K0.kind === 'archer' || K0.kind === 'eel' || K0.kind === 'boss' || under(o)) continue;
      const dh = Math.hypot(h.x - o.x, h.y - o.y), dm = Math.hypot(o.x - e.x, o.y - e.y); if (dh >= de || dm > 320 || dm >= bd) continue; bd = dm; best = o; }
    if (!best) return null; const dh = Math.hypot(best.x - h.x, best.y - h.y) || 1;
    return [best.x + (best.x - h.x) / dh * E.behind, best.y + (best.y - h.y) / dh * E.behind]; }
  // walk straight to a spot in the open, slowing as it comes; false when a wall stands between
  function toward(e, E, m, gx, gy) { const dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy);
    if (!losClear(m, e.x, e.y - 6, gx, gy - 6)) return false;
    const sp = E.spd * eliteK(e, 'spd') * (inWater(m, e) ? WADE : 1) * SS01(Math.max(0, Math.min(1, (d - 6) / 34))), k = 1 - Math.exp(-9 * DT); e.vx += (dx / (d || 1) * sp - e.vx) * k; e.vy += (dy / (d || 1) * sp - e.vy) * k; return true; }
  function skid(m, e, E) { const k = Math.exp(-14 * DT); e.vx *= k; e.vy *= k; const v = Math.hypot(e.vx, e.vy); if (v < 1) { e.vx = e.vy = 0; return; } move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += v * DT; }
  function steer(e, E, m, F, want, dx, dy, d, kv = 1) {
    let vx = 0, vy = 0;
    if (want !== 0) {
      const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE), here = F[ty * m.W + tx];
      if (want > 0 && d < 140 && losClear(m, e.x, e.y - 6, e.x + dx, e.y + dy - 6)) { vx = dx / d; vy = dy / d; }
      else if (here >= 0) { let best = null;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const j = (ty + ay) * m.W + tx + ax, v = F[j];
          if (v < 0 || (ax && ay && (F[ty * m.W + tx + ax] < 0 || F[(ty + ay) * m.W + tx] < 0))) continue;
          const score = want > 0 ? v : -v; if (!best || score < best[0]) best = [score, ax, ay]; }
        if (best) { const gx = (tx + best[1]) * TILE + TILE / 2 - e.x, gy = (ty + best[2]) * TILE + TILE / 2 + 4 - e.y, gd = Math.hypot(gx, gy) || 1; vx = gx / gd; vy = gy / gd; } }
      // (off the floor, in lava where the way field has no say: to the nearest bank first; straight at the hero it stuck on a knob of
      // rock in the pool, TASKS 374)
      else if (cell(m, tx, ty) === 3 && !E.lava && !E.ghost) { const [lx, ly] = landOf(m, e.x, e.y), gx = lx - e.x, gy = ly - 6 - e.y, gd = Math.hypot(gx, gy) || 1; vx = gx / gd; vy = gy / gd; }
      else if (d > 0) { vx = dx / d * want; vy = dy / d * want; }
    }
    const sp = E.spd * eliteK(e, 'spd') * kv * (!E.ghost && inWater(m, e) ? WADE : 1) * (!E.ghost && !E.webImmune && webAt(m, e) ? WEB.mon : 1) * (!E.ghost && E.blood !== 'slime' && gooAt(m, e) ? GOO.mon : 1), k = 1 - Math.exp(-9 * DT);
    e.vx += (vx * sp - e.vx) * k; e.vy += (vy * sp - e.vy) * k;
  }
  function holdClocks(R) {
    for (const e of R.en) { if (e.deadT >= 0) continue;
      if (e.st === 'wind' || e.st === 'bwind' || e.st === 'strike' || e.st === 'rise') { e.t0 += DT; if (e.bncT > 0) e.bncT += DT; } }
    for (const p of R.proj) p.t0 += DT;
    for (const q of R.lavaPending || []) { q.t += DT; if (q.t0 !== undefined) q.t0 += DT; }
    for (const egg of R.eggs || []) egg.hatchT += DT;
    for (const q of R.rocks || []) { q.t0 += DT; q.t += DT; }
    for (const c of R.cracks || []) c.t0 += DT;
  }
  // a boss that closes a chapter pays as the finale did (20 shards, LOOT.boss); in the endless descent every pair ends its 'chapter',
  // so there only the chapters' end bosses (the demon lord, the serpent) pay so, the others as the campaign's chapter bosses (TASKS 350)
  const chapterEnd = (R, e) => STAGE(R).last && (!RUN(R).endless || D.RUNS.endless.big.includes(e.type));
  const arenaSealed = (R) => !!(R.map.bossType && R.en.some((e) => D.BOSSES[e.type] && e.deadT < 0));
  function stepArena(S, R) {
    const m = R.map, b = R.en.find((e) => D.BOSSES[e.type] && e.deadT < 0), h = R.hero;
    if (b && m.bossType && !R.arena) { const r = m.rooms[b.room], pad = K.R + 4;
      if (h.x > r.x * TILE + pad && h.x < (r.x + r.w) * TILE - pad && h.y > r.y * TILE + pad && h.y < (r.y + r.h) * TILE - pad) {
        R.arena = { active: 1, room: b.room, t0: S.t }; b.st = b.type === 'boss_serpent' ? 'deep' : ENEMIES[b.type].lake ? 'emerge' : 'chase'; b.cdT = S.t + 1; b.seenT = S.t; b.t0 = S.t;
        for (const d of m.doors) if (d.arena) { d.open = 0; d.openT = -9; for (const [x, y] of d.cells) m.cells[y * m.W + x] = 5; }
        m.arenaBox = [r.x, r.y, r.x + r.w, r.y + r.h];
        R.msg = { s: ENEMIES[b.type].name, t: S.t, d: 3 }; roar(S, R, b);
      }
    }
    for (const q of R.lavaPending || []) if (S.t >= q.t && m.cells[q.cell] === 1) { m.cells[q.cell] = 3; m.arenaLava = m.arenaLava || []; m.arenaLava.push(q.cell); m.lava++; m.geometry = (m.geometry || 0) + 1; }
    R.lavaPending = (R.lavaPending || []).filter((q) => S.t < q.t);
    if ((R.rocks && R.rocks.length) || (R.cracks && R.cracks.length)) colossusHazards(S, R);
    for (const egg of R.eggs || []) if (egg.hp > 0 && S.t >= egg.hatchT) { egg.hp = 0;
      const owner = R.en.find((e) => e.id === egg.owner && e.deadT < 0); if (owner) bossSummon(S, R, Object.assign({}, owner, { x: egg.x, y: egg.y }), Object.assign({}, D.BOSSES[owner.type].moves.eggs, { n: 1, r: 0 }));
    }
  }
  function finishArena(S, R, e) {
    if (R.arena) R.arena.active = 0;
    R.map.flood = null; R.map.arenaBox = null;
    if (R.map.arenaWater?.length) { const wet = new Set(R.map.arenaWater); R.map.water = R.map.water.filter((k) => !wet.has(k)); R.map.arenaWater = []; WET.delete(R.map); }
    for (const k of R.map.arenaLava || []) if (R.map.cells[k] === 3) { R.map.cells[k] = 1; R.map.lava--; }
    R.map.arenaLava = []; R.lavaPending = []; R.rocks = []; R.cracks = []; R.fires = (R.fires || []).filter((p) => p.src !== e.id); R.map.geometry = (R.map.geometry || 0) + 1;
    for (const d of R.map.doors || []) if (d.arena && !d.open) openDoor(S, R, d, 0);
    for (const o of R.en) if (o.summ === e.id && o.deadT < 0) { o.deadT = S.t; o.hp = 0; }
    for (const o of R.eggs || []) if (o.owner === e.id) o.hp = 0;
    if (!lastFloor(R) && R.viaTown && R.arena) R.arena.gate = bossGate(R, e);
    if (!lastFloor(R)) { R.msg = { s: ENEMIES[e.type].name + (R.arena && R.arena.gate ? ': победа! Портал в город, алтарь и лестница открыты' : ': победа! Алтарь и лестница открыты'), t: S.t }; if (!chapterEnd(R, e)) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), 2) }); }
  }
  // the portal home a chapter boss leaves (TASKS 383): in its hall, kept clear of the stairs and the altar so E never picks the wrong one
  function bossGate(R, e) { const r = R.map.rooms[e.room], cx = (r.x + r.w / 2) * TILE, cy = (r.y + r.h / 2) * TILE, far = [R.map.exit, ...R.shrines];
    let best = null, bd = -1;
    for (let i = 0; i < 9; i++) { const [x, y] = standNear(R, cx + ((i % 3) - 1) * r.w * TILE / 4, cy + (Math.floor(i / 3) - 1) * r.h * TILE / 4), d = Math.min(...far.map((o) => Math.hypot(o.x - x, o.y - y)));
      if (d > bd) { bd = d; best = { x: Math.round(x), y: Math.round(y) }; } if (i === 4 && d >= 160) break; }
    // its ring's gap faces the hall's middle, where the hero comes from (at the middle itself, east as the town's)
    if (best) best.open = Math.hypot(cx - best.x, cy - best.y) > 20 ? Math.atan2(cy - best.y, cx - best.x) : 0;
    return best; }
  const gateNear = (R) => { const g = R.arena && R.arena.gate, h = R.hero; return g && !R.town && Math.hypot(g.x - h.x, g.y - h.y) < 64 ? g : null; };
  function bossWebs(S, R, e, M) {
    const m = R.map, r = m.rooms[e.room];
    for (let i = 0; i < M.n; i++) { const a = e.aimA + i / M.n * Math.PI * 2, x = Math.max((r.x + 1) * TILE, Math.min((r.x + r.w - 1) * TILE, e.x + Math.cos(a) * M.r)),
      y = Math.max((r.y + 1) * TILE, Math.min((r.y + r.h - 1) * TILE, e.y + Math.sin(a) * M.r));
      if (cell(m, Math.floor(x / TILE), Math.floor(y / TILE)) !== 1) continue;
      const web = { x, y, v: i % 2, s: M.size, f: 0, torn: 0, boss: e.id };
      const old = m.webs.findIndex((w) => w.boss === e.id && (w.torn || Math.hypot(w.x - x, w.y - y) < M.spacing));
      if (old >= 0) m.webs[old] = web; else if (m.webs.filter((w) => w.boss === e.id).length < M.cap) m.webs.push(web);
    }
    ev(S, { k: 'summon', x: e.x, y: e.y });
  }
  function arenaPath(m, room, shut = new Set()) {
    const r = m.rooms[room], start = m.exit.ty * m.W + m.exit.tx, block = new Set(m.block), seen = new Set(), q = [start];
    const open = (k) => { const x = k % m.W, y = Math.floor(k / m.W); return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && m.cells[k] === 1 && !block.has(k) && !shut.has(k); };
    if (!open(start)) return false; seen.add(start);
    for (let i = 0; i < q.length; i++) for (const d of [1, -1, m.W, -m.W]) { const k = q[i] + d; if (open(k) && !seen.has(k)) { seen.add(k); q.push(k); } }
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * m.W + x; if (open(k) && !seen.has(k)) return false; }
    return true;
  }
  // the arena's lava runs in from a few points on its walls as tongues (TASKS 233): each new cell grows off lava already there or
  // warned, picked at random from that front, so the floor narrows to islands, never to a ring laid row by row along the walls
  function bossLava(S, R, e, M) {
    const m = R.map, r = m.rooms[e.room], block = new Set(m.block), keep = new Set();
    for (const o of [m.exit, ...R.shrines, ...solids(R), ...R.en.filter((o) => o.room === e.room && o.deadT < 0)]) {
      const tx = Math.floor(o.x / TILE), ty = Math.floor(o.y / TILE);
      for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) keep.add(y * m.W + x);
    }
    for (const d of m.doors || []) if (d.arena) for (const [x, y] of d.cells) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) keep.add((y + j) * m.W + x + i);
    const pending = new Set((R.lavaPending || []).map((o) => o.cell)), grown = new Set([...(m.arenaLava || []), ...pending]);
    const ok = (k) => { const x = k % m.W, y = Math.floor(k / m.W);
      return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && m.cells[k] === 1 && !keep.has(k) && !pending.has(k) && !block.has(k); };
    const seed = () => { const wall = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (Math.min(x - r.x, r.x + r.w - 1 - x, y - r.y, r.y + r.h - 1 - y) === 0 && ok(y * m.W + x)) wall.push(y * m.W + x);
      return wall.length ? wall[Math.floor(rnd(R) * wall.length)] : -1; };
    let left = Math.min(M.n, Math.floor(r.w * r.h * M.cover) - (m.arenaLava || []).length - pending.size);
    R.lavaPending = R.lavaPending || [];
    // a cell that would cut the floor off from the exit is kept dry for good
    const add = (k) => { pending.add(k); if (!arenaPath(m, e.room, pending)) { pending.delete(k); keep.add(k); return; }
      R.lavaPending.push({ cell: k, t0: S.t, t: S.t + M.warn, owner: e.id }); grown.add(k); left--; };
    for (let i = grown.size ? (rnd(R) < 0.5 ? 1 : 0) : 3; i > 0 && left > 0; i--) { const k = seed(); if (k >= 0) add(k); }
    for (let guard = 0; left > 0 && guard < 400; guard++) {
      const front = []; for (const k of grown) for (const d of [1, -1, m.W, -m.W]) if (ok(k + d)) front.push(k + d);
      const k = front.length ? front[Math.floor(rnd(R) * front.length)] : seed(); if (k < 0) break; add(k);
    }
    roar(S, R, e);
  }
  function bossBarrier(S, e, M) { e.shield = Math.round(e.max * M.hp); e.shieldUntil = S.t + M.time; e.shieldT = S.t; ev(S, { k: 'barrier', x: e.x, y: e.y, id: e.id }); }
  function bossRaise(S, R, e, M) {
    const corpses = R.en.filter((o) => o.deadT >= 0 && o.room === e.room && !D.BOSSES[o.type] && !o.raised);
    const n = Math.max(0, M.cap - R.en.filter((o) => o.summ === e.id && o.deadT < 0).length);
    for (const o of corpses.slice(0, Math.min(M.n, n))) {
      o.raised = 1; bossSummon(S, R, Object.assign({}, e, { x: o.x, y: o.y }), Object.assign({}, M, { n: 1, r: 0 }));
    }
  }
  function bossEggs(S, R, e, M) {
    R.eggs = (R.eggs || []).filter((o) => o.hp > 0);
    const own = R.eggs.filter((o) => o.owner === e.id).length + R.en.filter((o) => o.summ === e.id && o.deadT < 0).length;
    for (let i = 0; i < Math.min(M.n, M.cap - own); i++) { const a = e.aimA + (i + 1) * Math.PI, p = { x: e.x + Math.cos(a) * M.r, y: e.y + Math.sin(a) * M.r };
      if (!bossPoint(R, e, p, 15)) continue;
      R.eggs.push({ id: R.nextId++, owner: e.id, x: p.x, y: p.y, hp: M.eggHp, hatchT: S.t + M.hatch, t0: S.t });
      ev(S, { k: 'summon', x: p.x, y: p.y });
    }
  }
  function beginBossMove(S, R, e, mv) {
    // spd0 + its direction: the walk the plant cuts off — the render eases the gait down from it instead of snapping the feet (TASKS 333)
    e.st = 'bwind'; e.t0 = S.t; e.mv = mv; e.fired = 0; e.hitDone = 0; e.chain = 0;
    e.spd0 = Math.hypot(e.vx, e.vy); e.vxn0 = e.spd0 > 1 ? e.vx / e.spd0 : 1; e.vyn0 = e.spd0 > 1 ? e.vy / e.spd0 : 0;
    const M = D.bossMove(e);
    e.tx = R.hero.x; e.ty = R.hero.y;
    e.aimA = Math.atan2(R.hero.y - (M.target || 0) - e.y + (M.origin || 0), R.hero.x - e.x); e.vx = e.vy = 0;
    e.travel = 0; e.targetD = Math.hypot(R.hero.x - e.x, R.hero.y - e.y);
    ev(S, { k: 'bossmove', id: e.id, mv, phase: e.phase });
  }
  function bossThink(S, R, e, d) {
    const t = S.t, m = R.map, h = R.hero, E = ENEMIES[e.type], P = D.bossPhase(e);
    if (t < e.cdT && e.openUntil > t) { e.vx = e.vy = 0; return; }
    if (t < e.cdT) { const F = wideFlow(R, e, E) || flow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)); steer(e, E, m, F, d > E.reach ? 1 : 0, h.x - e.x, h.y - e.y, d);
      move(m, e, e.vx * DT * P.speed, e.vy * DT * P.speed, E.r, true); e.dist += Math.hypot(e.vx, e.vy) * DT * P.speed; return; }
    const nextPhase = E.lake && D.BOSSES[e.type].phases[(e.phase || 0) + 1];
    if (nextPhase && e.hp / e.max <= nextPhase.at && !e.nextMove && t >= (e.openUntil || 0) + 0.4) return;
    const mv = e.nextMove || P.moves[(e.moveI || 0) % P.moves.length];
    if (e.nextMove) e.nextMove = null; else e.moveI = (e.moveI || 0) + 1;
    beginBossMove(S, R, e, mv);
  }
  const roar = (S, R, e) => { ev(S, { k: 'roar', x: e.x, y: e.y - 70, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.6); };
  function bossPoint(R, e, p, radius) {
    const r = R.map.rooms[e.room];
    p.x = Math.max(r.x * TILE + radius + 1, Math.min((r.x + r.w) * TILE - radius - 1, p.x));
    p.y = Math.max(r.y * TILE + radius + 1, Math.min((r.y + r.h) * TILE - radius - 1, p.y));
    shove(R.map, p, radius, true, solids(R));
    return DG.roomAt(R.map, p.x, p.y) === e.room && !boxHit(R.map, p.x, p.y, radius, true, false);
  }
  function bossSummon(S, R, e, M) {
    const E = ENEMIES[M.type], own = R.en.filter((o) => o.summ === e.id && o.deadT < 0).length;
    for (let i = 0; i < Math.min(M.n, M.cap - own); i++) {
      const a = e.aimA + (i + 1) * Math.PI * 2 / (M.n + 1), p = { x: e.x + Math.cos(a) * M.r, y: e.y + Math.sin(a) * M.r };
      if (!bossPoint(R, e, p, E.r)) continue;
      const hp = E.hp * M.hp * BAL.hp * dif(R, 'hp');
      R.en.push({ id: R.nextId++, type: M.type, x: p.x, y: p.y, vx: 0, vy: 0, hp, max: hp, dmg: E.dmg * M.dmg * BAL.dmg, elite: 0, room: e.room, st: 'chase', t0: S.t, face: 1,
        aimA: 0, cdT: S.t + M.delay, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: e.id, spawnT: S.t });
      ev(S, { k: 'summon', x: p.x, y: p.y, fire: ENEMIES[M.type].lava ? 1 : 0 });
    }
  }
  // the colossus (TASKS 413) is too broad for the plain flow fields: they lead it on into gaps it doesn't fit (between a slab of cover
  // and the edge, onto the crossing) and it stuck there. Its own field runs over the cells its body clears
  const WIDE = new WeakMap();
  function wideClear(R, e, E) {
    const m = R.map, key = (m.geometry || 0) + ':' + doorKey(m) + ':' + E.r + ':' + e.room; let c = WIDE.get(m); if (c && c.key === key) return c;
    const a = new Uint8Array(m.W * m.H), blk = new Set(m.block), r = m.rooms[e.room], n = Math.ceil(E.r / TILE), open = (q) => m.cells[q] === 1 && !blk.has(q);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * m.W + x; if (!open(k)) continue;
      const px = (x + 0.5) * TILE, py = (y + 0.5) * TILE; let ok = true;
      for (let j = -n; j <= n && ok; j++) for (let i = -n; i <= n && ok; i++) { if (open((y + j) * m.W + x + i)) continue;
        const qx = Math.max((x + i) * TILE, Math.min((x + i + 1) * TILE, px)), qy = Math.max((y + j) * TILE, Math.min((y + j + 1) * TILE, py));
        if (Math.abs(qx - px) < E.r && qy - py > -E.r * 0.6 && qy - py < E.r * 0.4) ok = false; }
      if (ok) a[k] = 1; }
    c = { key, a, hk: '', d: null }; WIDE.set(m, c); return c;
  }
  // null when the colossus stands off its clear cells (a charge carried it there): the plain field takes it back out
  function wideFlow(R, e, E) {
    if (!E.lake) return null; const m = R.map, h = R.hero, c = wideClear(R, e, E), a = c.a, here = Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE);
    if (!a[here]) return null;
    const htx = Math.floor(h.x / TILE), hty = Math.floor(h.y / TILE), hk = htx + ',' + hty; if (c.hk === hk) return c.d;
    const r = m.rooms[e.room], d = new Int16Array(m.W * m.H).fill(-1), q = []; let best = 1e9;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (a[y * m.W + x]) best = Math.min(best, Math.abs(x - htx) + Math.abs(y - hty));
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (a[y * m.W + x] && Math.abs(x - htx) + Math.abs(y - hty) === best) { d[y * m.W + x] = 0; q.push(y * m.W + x); }
    for (let i = 0; i < q.length; i++) for (const o of [1, -1, m.W, -m.W]) { const k = q[i] + o; if (a[k] && d[k] < 0) { d[k] = d[q[i]] + 1; q.push(k); } }
    c.hk = hk; c.d = d; return d;
  }
  // up out of the lake, then ashore through the lava to the clear cell that is near it and on the hero's side
  function colossusRise(S, R, e) {
    const t = S.t, B = D.BOSSES[e.type];
    if (e.st === 'idle' || e.st === 'emerge') e.vx = e.vy = 0;
    if (e.st === 'idle') return;
    if (e.st === 'emerge') { if (t - e.t0 < B.rise) return; const m = R.map, h = R.hero, a = wideClear(R, e, ENEMIES[e.type]).a; let best = null;
      for (let k = 0; k < a.length; k++) if (a[k]) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE, sc = Math.hypot(x - e.x, y - e.y) + 0.4 * Math.hypot(x - h.x, y - h.y); if (!best || sc < best[0]) best = [sc, x, y]; }
      e.st = 'wade'; e.t0 = t; e.tx = best ? best[1] : e.x; e.ty = best ? best[2] : e.y; ev(S, { k: 'colrise', x: e.x, y: e.y, id: e.id }); }
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy), speed = B.wade * Math.min(1, (t - e.t0) / 0.2), v = speed * DT;
    if (d <= v) { e.x = e.tx; e.y = e.ty; e.dist += d; e.st = 'chase'; e.t0 = e.seenT = t; e.cdT = t + 0.6; ev(S, { k: 'slam', x: e.x, y: e.y, big: 1, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.5); return; }
    e.x += dx / d * v; e.y += dy / d * v; e.vx = dx / d * speed; e.vy = dy / d * speed; e.dist += v; if (Math.abs(dx) > 4) e.face = dx > 0 ? 1 : -1;
    colossusStep(S, R, e);
  }
  function colossusStep(S, R, e) {
    const stride = D.BOSSES[e.type].step, i = Math.floor(e.dist / stride);
    if (e.stepI !== undefined && i > e.stepI) {
      ev(S, { k: 'colstep', ...D.colossusStepAt(e, i), id: e.id });
      R.trauma = Math.min(1, R.trauma + 0.09);
    }
    e.stepI = i;
  }
  // a crack runs over the floor and the lava alike and stops at rock
  function colossusCrack(S, R, e, M) {
    const p = D.colossusContact(e), m = R.map, c = Math.cos(e.aimA), sn = Math.sin(e.aimA); let len = M.len;
    for (let l = E0; l <= M.len; l += 8) if (cell(m, Math.floor((p.x + c * l) / TILE), Math.floor((p.y + sn * l) / TILE)) !== 1 && cell(m, Math.floor((p.x + c * l) / TILE), Math.floor((p.y + sn * l) / TILE)) !== 3) { len = l; break; }
    (R.cracks = R.cracks || []).push({ id: R.nextId++, owner: e.id, who: who(e), x: p.x, y: p.y, a: e.aimA, len, w: M.w, speed: M.speed, linger: M.linger, t0: S.t, dmg: e.dmg * M.dmg, hit: 0 });
    ev(S, { k: 'colcrack', x: p.x, y: p.y, a: e.aimA, len, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.4);
  }
  const E0 = 30;
  // where a pool of lava may lie: on the arena's floor, off the lake's shore, off the ways in, the crossing and the other pools, so
  // pools never close the ring (the player's note on 413, 05.11.2026)
  function poolOk(R, e, M, x, y) {
    const m = R.map, r = m.rooms[e.room], P = M.pool, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < r.x || ty < r.y || tx >= r.x + r.w || ty >= r.y + r.h || m.cells[ty * m.W + tx] !== 1) return false;
    const n = Math.ceil((P.r + M.lakeGap) / TILE) + 1;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const k = (ty + j) * m.W + tx + i; if (m.cells[k] !== 3 || (m.arenaLava || []).includes(k)) continue;
      const qx = Math.max((tx + i) * TILE, Math.min((tx + i + 1) * TILE, x)), qy = Math.max((ty + j) * TILE, Math.min((ty + j + 1) * TILE, y)); if (Math.hypot(qx - x, (qy - y) / P.ry) < P.r + M.lakeGap) return false; }
    const way = M.wayGap * TILE, ends = [];
    for (const c of m.crossings || []) if (c.kind === 'slabs') for (const k of c.cells) ends.push([(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]);
    for (const d of m.doors || []) if (d.arena) for (const [cx, cy] of d.cells) ends.push([(cx + 0.5) * TILE, (cy + 0.5) * TILE]);
    if (ends.some(([px, py]) => Math.hypot(px - x, py - y) < way)) return false;
    return !(R.fires || []).some((p) => p.src === e.id && p.kind === 'pool' && Math.hypot(p.x - x, (p.y - y) / P.ry) < 2 * P.r + M.apart);
  }
  function colossusBoulder(S, R, e, M) {
    const h = R.hero; let x = h.x, y = h.y, pool = poolOk(R, e, M, x, y);
    // a point the pool may not take shifts to the nearest one within two cells that it may; no such one: the rock lands dry
    if (!pool) for (let rr = 8; rr <= 2 * TILE && !pool; rr += 8) for (let i = 0; i < 12 && !pool; i++) { const a = i / 12 * Math.PI * 2, px = h.x + Math.cos(a) * rr, py = h.y + Math.sin(a) * rr * 0.75;
      if (poolOk(R, e, M, px, py)) { x = px; y = py; pool = true; } }
    (R.rocks = R.rocks || []).push({ id: R.nextId++, owner: e.id, who: who(e), kind: 'boulder', x, y, sx: e.x + e.face * 0.3 * ENEMIES[e.type].h, gy: e.y, z: ENEMIES[e.type].h * 0.9, t0: S.t, t: S.t + M.fly, r: M.r, dmg: e.dmg * M.dmg, pool: pool ? 1 : 0 });
    ev(S, { k: 'throw', x: e.x, y: e.y, tx: x, ty: y, id: e.id });
  }
  // the ring's outer edge falls into lava (2nd phase), but never the cells the fight keeps: the ways in, the altar and the exit,
  // the slabs of cover; a cell whose fall would cut the floor off from the exit stays
  function colossusEdge(S, R, e, M) {
    const m = R.map, r = m.rooms[e.room], L = D.ARCH.plateau.arena, cx = (r.cx + 0.5) * TILE, cy = (r.cy + 0.5) * TILE, keep = new Set(), W = m.W;
    const near = (x, y, n) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) keep.add((ty + j) * W + tx + i); };
    near(m.exit.x ?? (m.exit.tx + 0.5) * TILE, m.exit.y ?? (m.exit.ty + 0.5) * TILE, 2); for (const sh of R.shrines) near(sh.x, sh.y, 2); for (const d of m.decor) if (d.cover) near(d.x, d.y, 1);
    for (const d of m.doors || []) if (d.arena) for (const [x, y] of d.cells) near((x + 0.5) * TILE, (y + 0.5) * TILE, 2);
    const lake = (k) => Math.hypot((((k % W) + 0.5) * TILE - cx) / L.lake[0], ((Math.floor(k / W) + 0.5) * TILE - cy) / L.lake[1]) < TILE * 1.25;
    const pending = new Set((R.lavaPending || []).map((q) => q.cell)), gone = new Set([...(m.arenaLava || []), ...pending]);
    for (let depth = 0; depth < M.edge; depth++) { const band = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * W + x; if (m.cells[k] !== 1 || keep.has(k) || gone.has(k) || lake(k)) continue;
        if ([1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].some((o) => (m.cells[k + o] !== 1 && !lake(k + o)) || gone.has(k + o))) band.push(k); }
      for (const k of band) { pending.add(k); if (!arenaPath(m, e.room, pending)) { pending.delete(k); continue; } gone.add(k);
        const d = Math.hypot((k % W + 0.5) * TILE - e.x, (Math.floor(k / W) + 0.5) * TILE - e.y);
        R.lavaPending.push({ cell: k, t0: S.t, t: S.t + M.warn + d / 900, owner: e.id }); } }
  }
  // the eruption's rain: rocks over the ring at random, a few aimed at the hero; none within the shelter of a slab of cover
  function colossusRain(S, R, e, M) {
    const m = R.map, r = m.rooms[e.room], cover = m.decor.filter((d) => d.cover && !d.broken), floor = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * m.W + x, px = (x + 0.5) * TILE, py = (y + 0.5) * TILE;
      if (m.cells[k] === 1 && !cover.some((d) => Math.hypot(px - d.x, py - d.y) < M.shelter)) floor.push([px, py]); }
    for (let i = 0; i < M.n; i++) { const t = S.t + M.warn + i / M.n * M.time, aim = i % Math.ceil(M.n / M.aimed) === Math.ceil(M.n / M.aimed) - 1, p = floor[Math.floor(rnd(R) * floor.length)];
      if (!aim && !p) continue; (R.rocks = R.rocks || []).push({ id: R.nextId++, owner: e.id, who: who(e), kind: 'rain', x: aim ? undefined : p[0] + (rnd(R) - 0.5) * 20, y: aim ? undefined : p[1] + (rnd(R) - 0.5) * 20, t0: t - M.warn, t, r: M.r, dmg: e.dmg * M.dmg, shelter: M.shelter }); }
    roar(S, R, e);
  }
  function colossusHazards(S, R) {
    const h = R.hero, t = S.t, m = R.map, alive = h.deadT < 0;
    for (const c of R.cracks) { if (c.hit || !alive) continue; const front = Math.min(c.len, (t - c.t0) * c.speed), rx = h.x - c.x, ry = h.y - c.y, al = rx * Math.cos(c.a) + ry * Math.sin(c.a), pe = Math.abs(-rx * Math.sin(c.a) + ry * Math.cos(c.a));
      if (al > E0 && al < front && pe < c.w / 2 + K.R * 0.5) { c.hit = 1; hurtHero(S, R, c.dmg, h.x - Math.cos(c.a) * 12, h.y - Math.sin(c.a) * 12, undefined, c.who, R.en.find((o) => o.id === c.owner)); } }
    R.cracks = R.cracks.filter((c) => t - c.t0 < c.len / c.speed + c.linger);
    for (const q of R.rocks) {
      // an aimed rock picks its spot as its shadow shows: where the hero is then, unless that is under a slab's shelter
      if (q.x === undefined && t >= q.t0) { const sh = m.decor.some((d) => d.cover && !d.broken && Math.hypot(h.x - d.x, h.y - d.y) < q.shelter); if (sh || !alive) { q.done = 1; continue; } q.x = h.x; q.y = h.y; }
      if (q.done || t < q.t) continue; q.done = 1;
      const owner = R.en.find((o) => o.id === q.owner);
      if (alive && Math.hypot(h.x - q.x, (h.y - q.y) / 0.75) < q.r + K.R * 0.5) hurtHero(S, R, q.dmg, q.x, q.y, undefined, q.who, owner);
      ev(S, { k: q.kind === 'boulder' ? 'boulder' : 'rock', x: q.x, y: q.y, r: q.r, id: q.id }); R.trauma = Math.min(1, R.trauma + (q.kind === 'boulder' ? 0.45 : 0.15));
      if (q.pool && owner) { const P = D.BOSSES[owner.type].moves.boulder, own = R.fires.filter((p) => p.src === owner.id && p.kind === 'pool');
        if (own.length < P.cap && poolOk(R, owner, P, q.x, q.y)) { addFire(R, S, q.x, q.y, { src: owner.id, who: q.who, r: P.pool.r, ry: P.pool.ry, t: P.pool.t, dmg: owner.dmg * P.pool.dmg, per: P.pool.per, kind: 'pool' });
          ev(S, { k: 'pool', x: q.x, y: q.y, r: P.pool.r, d: P.pool.t, id: owner.id }); } } }
    R.rocks = R.rocks.filter((q) => !q.done);
  }
  function stepBossMove(S, R) {
    if (R.hero.deadT >= 0) return;
    for (const e of R.en) { if (!D.BOSSES[e.type] || e.type === 'boss_serpent' || e.deadT >= 0 || e.st === 'idle') continue;
      const t = S.t, h = R.hero, m = R.map, B = D.BOSSES[e.type];
      if (e.bossVersion !== 1) { e.st = 'chase'; e.cdT = t; e.phase = Math.max(0, B.phases.findLastIndex((p) => e.hp / e.max <= p.at)); e.moveI = 0; e.nextMove = null; e.bossVersion = 1; }
      if ((e.phase || 0) + 1 < B.phases.length && e.hp / e.max <= B.phases[(e.phase || 0) + 1].at && (!D.bossPhase(e).finishMove || (e.st !== 'bwind' && !e.nextMove && t >= (e.openUntil || 0) + (e.type === 'boss_colossus' ? 0.4 : 0)))) {
        e.phase = (e.phase || 0) + 1; e.moveI = 0; e.nextMove = null;
        ev(S, { k: 'bossphase', id: e.id, phase: e.phase });
        if (D.bossPhase(e).enter) beginBossMove(S, R, e, D.bossPhase(e).enter);
      }
      if (e.st !== 'bwind') continue;
      const M = D.bossMove(e), w = M.wind, u = t - e.t0;
      let finished = u > w + (e.mv === 'charge' && M.next ? M.time : M.duration);
      if (e.mv === 'charge' && u > w && u < w + M.time) {
        const x = e.x, y = e.y, dist = Math.min(M.speed * DT, Math.max(0, e.targetD - M.stop - e.travel));
        move(m, e, Math.cos(e.aimA) * dist, Math.sin(e.aimA) * dist, ENEMIES[e.type].r, true);
        const moved = Math.hypot(e.x - x, e.y - y); e.dist += moved; e.travel += moved;
        if (e.type === 'boss_colossus') { e.vx = (e.x - x) / DT; e.vy = (e.y - y) / DT; }
        if (!e.hitDone && Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(m, e.x, e.y, h.x, h.y)) { e.hitDone = 1; hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e); }
        if (M.next && (e.hitDone || e.travel >= Math.max(0, e.targetD - M.stop) - 0.01 || moved < 0.01)) finished = true;
      }
      if (e.type === 'boss_colossus' && e.mv === 'charge' && (finished || u <= w || u >= w + M.time)) e.vx = e.vy = 0;
      if (e.mv === 'volley' && u >= w + (e.fired || 0) * M.gap && (e.fired || 0) < M.rings) {
        // both rings are one volley: it wounds once, so the second ring catches a hero who sidestepped the first instead of doubling
        // the blow past the boss's cap (TASKS 227)
        const ring = e.fired++, vol = ring ? e.vol : (e.vol = R.nextId);
        for (let i = 0; i < M.n; i++) { const a = e.aimA + (i + ring * M.offset) / M.n * Math.PI * 2;
          R.proj.push({ id: R.nextId++, vol, who: who(e), actorId: e.id, k: M.kind || 'fire', x: e.x, y: e.y - M.origin, vx: Math.cos(a) * M.speed, vy: Math.sin(a) * M.speed,
            t0: t, life: M.life, dmg: e.dmg * M.dmg, own: 'en', r: M.r, spent: R.volHit === vol ? 1 : 0 }); }
        roar(S, R, e);
      } else if (e.mv !== 'volley' && u >= w && !e.fired) { e.fired = 1;
        if (e.mv === 'slam') { if (Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(m, e.x, e.y, h.x, h.y)) hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e);
          ev(S, { k: 'slam', x: e.x, y: e.y, big: 1, id: e.id }); R.trauma = 1; }
        if (e.mv === 'roar') { roar(S, R, e); const d = Math.hypot(h.x - e.x, h.y - e.y) || 1;
          if (d < M.r && losClear(m, e.x, e.y, h.x, h.y)) move(m, h, (h.x - e.x) / d * M.push, (h.y - e.y) / d * M.push, K.R, true);
          if (M.summon) bossSummon(S, R, e, B.moves[M.summon]); }
        for (const fx of M.effects || []) { if (fx === 'weave') bossWebs(S, R, e, B.moves[fx]); if (fx === 'raise') bossRaise(S, R, e, B.moves[fx]); if (fx === 'lava') bossLava(S, R, e, B.moves[fx]); if (fx === 'barrier') bossBarrier(S, e, B.moves[fx]); }
        if (e.mv === 'lava') bossLava(S, R, e, M);
        if (e.mv === 'raise') bossRaise(S, R, e, M);
        if (e.mv === 'barrier') bossBarrier(S, e, M);
        if (e.mv === 'weave') bossWebs(S, R, e, M);
        if (e.mv === 'eggs') bossEggs(S, R, e, M);
        if (e.mv === 'summon') bossSummon(S, R, e, M);
        if (e.mv === 'imps') bossSummon(S, R, e, M);
        if (e.mv === 'fists') { if (Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(m, e.x, e.y, h.x, h.y)) hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e);
          ev(S, { k: 'slam', x: e.x, y: e.y, big: 1, id: e.id, r: M.r }); R.trauma = 1; }
        if (e.mv === 'crack') colossusCrack(S, R, e, M);
        if (e.mv === 'boulder') colossusBoulder(S, R, e, M);
        if (e.mv === 'shatter') { roar(S, R, e); colossusEdge(S, R, e, M); bossSummon(S, R, e, B.moves[M.summon]); ev(S, { k: 'shatter', x: e.x, y: e.y, id: e.id }); }
        if (e.mv === 'erupt') { roar(S, R, e); ev(S, { k: 'colerupt', x: e.x, y: e.y, id: e.id }); }
        if (e.mv === 'rain') colossusRain(S, R, e, M);
      }
      if (finished) {
        e.nextMove = null;
        // the linked slam follows only a charge the hero got out of: a charge that landed ends the link, one mistake costs one blow
        // (the player's call, TASKS 227: the slam 0.28 s after a landed charge could not be escaped and took 12 of 14 finale deaths)
        if (M.next && !e.hitDone) { beginBossMove(S, R, e, M.next); e.t0 = t + (M.rest || 0); e.chain = 1; }
        else { e.st = 'chase'; e.fired = 0; e.hitDone = 0; e.cdT = t + (M.next ? D.bossPhase(e).rest : M.rest ?? D.bossPhase(e).rest);
          if (M.stuck) { e.openUntil = t + M.stuck; e.cdT = e.openUntil + 0.4; ev(S, { k: 'stuck', x: e.x, y: e.y, id: e.id, d: M.stuck }); } }
      }
    }
  }
  // the sprite boxes of the solid props (half width, height, standing on the prop's foot): an item that lies behind one (above its
  // foot, so the prop draws after it) inside its box cannot be seen, so it hops to the nearest open spot instead
  function propBoxes(R) { const m = R.map, out = [], add = (x, y, n, k = 1) => { if (D.PROP_W[n]) out.push([x, y, D.PROP_W[n] * k / 2, D.PROP_H[n] * k]); };
    for (const c of R.chests) add(c.x, c.y, 'chest', c.tier >= 2 ? 1.15 : 1); for (const p of R.pots) if (p.hp > 0) add(p.x, p.y, p.kind);
    for (const d of m.decor) if (!d.wall && (d.solid || ['shroom_a', 'shroom_b', 'skel_cv'].includes(d.n))) add(d.x, d.y, d.n, d.s || 1); for (const t of m.torches) if (t.kind !== 'wall') add(t.x, t.y, 'brazier', t.kind === 'fire' ? 1.35 : 1);
    for (const s of R.shrines) add(s.x, s.y, 'altar');
    for (const q of m.waterFeatures || []) if (q.kind === 'fountain') out.push([q.x, q.y + 16, 46, 40]);
    // a shut door's leaf (scene.js) stands over the cells behind it: a bottom wall's over the room's last row, a top wall's arch over the corridor
    for (const d of m.doors || []) if (!d.open) { const side = d.dir === 'l' || d.dir === 'r';
      out.push(d.dir === 'u' ? [d.x, d.y, 58, 100] : side ? [d.x, d.y + TILE, 17, 103] : [d.x, d.y + TILE, 31, 80]); }
    return out; }
  const behindProp = (B, x, y) => B.some(([px, py, hw, h]) => Math.abs(x - px) < hw + 10 && y < py + 2 && y > py - h + 6);
  const DROP_REST = 4;   // bump when the resting rule changes: items saved under an older rule are checked again
  function settleDrop(R, p) { const m = R.map, hid = secretMask(m), k0 = Math.floor(p.y / TILE) * m.W + Math.floor(p.x / TILE); p.rest = DROP_REST;
    const B = propBoxes(R), blk = new Set(m.block), spot = (k) => [(k % m.W) * TILE + TILE / 2, Math.floor(k / m.W) * TILE + 20];
    // an item lying on another one hides it too: items keep their icons apart
    const items = p.kind === 'item' || p.kind === 'qitem' ? R.drops.filter((o) => o !== p && !o.got && (o.kind === 'item' || o.kind === 'qitem') && o.rest === DROP_REST) : [];
    const onItem = (x, y) => items.some((o) => Math.abs((o.fly > 0 ? o.tx : o.x) - x) < 22 && Math.abs((o.fly > 0 ? o.ty : o.y) - y) < 26);
    const seen0 = (k) => m.cells[k] === 1 && !blk.has(k) && !behindProp(B, ...spot(k)), ok = (k) => seen0(k) && !onItem(...spot(k));
    if (m.cells[k0] === 1 && !blk.has(k0) && !behindProp(B, p.x, p.y) && !onItem(p.x, p.y)) return;
    const taken = new Set(R.drops.filter((o) => o !== p && !o.got).map((o) => Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE))), seen = new Set([k0]), q = [k0];
    // a clear cell of its own if there is one; in a cramped room, a visible cell next to another item beats a hidden one
    let shared = null;
    while (q.length) { const k = q.shift(); if (ok(k) && !taken.has(k)) { shared = k; break; } if (shared === null && seen0(k)) shared = k;
      for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!seen.has(n) && (m.cells[n] === 1 || m.cells[k0] !== 1) && (!hid.has(n) || hid.has(k0)) && seen.size < 400) { seen.add(n); q.push(n); } } }
    if (shared === null) return; const [tx, ty] = spot(shared), j = taken.has(shared) ? 9 : 0;
    p.tx = tx + j * (rnd(R) - 0.5); p.ty = ty + j * 0.5 * (rnd(R) - 0.5); p.vx = (p.tx - p.x) / 0.3; p.vy = (p.ty - p.y) / 0.3; p.vz = 150; p.fly = 0.3; }
  function stepDrops(S, R, live) {
    const h = R.hero;
    for (const p of R.drops) { if (p.got) continue;
      if (p.fly > 0) { p.fly -= DT; p.x += p.vx * DT; p.y += p.vy * DT; p.z = Math.max(0, p.z + p.vz * DT); p.vz -= 900 * DT; if (p.fly <= 0) { p.vx = p.vy = p.vz = 0; p.z = 0; } continue; }
      // a drop in the air hits the walls like anything else and bounces back off them: thrown from a chest against a wall, it would
      // otherwise sail over it into the rock
      if (p.vz || p.z > 0) { p.vz -= 900 * DT; p.z = Math.max(0, p.z + p.vz * DT); const [bx, by] = move(R.map, p, p.vx * DT, p.vy * DT, 4, true); if (bx) p.vx *= -0.4; if (by) p.vy *= -0.4;
        if (p.z === 0) { p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; if (Math.abs(p.vx) < 5) p.vx = p.vy = 0; } }
      if (p.rest !== DROP_REST && !p.vz && !(p.z > 0) && !(p.fly > 0)) settleDrop(R, p);
      if (!live || h.deadT >= 0 || R.t - p.t0 < 0.45) continue;
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (p.tossed) { if (d > 70) p.tossed = 0; continue; }
      if (p.kind !== 'item' && d < 90) { p.x += (h.x - p.x) * Math.min(1, 8 * DT); p.y += (h.y - p.y) * Math.min(1, 8 * DT); }
      if (d < 26) {
        if (p.kind === 'gold') { const n = Math.round(p.n * heroSt(S).gold); h.gold += n; R.goldTot += n; p.got = 1; ev(S, { k: 'gold', x: p.x, y: p.y, n }); }
        else if (p.kind === 'shard') { R.shards += p.n; S.meta.shards += p.n; p.got = 1; ev(S, { k: 'shard', x: p.x, y: p.y, n: p.n, floor: R.floor }); }
        else if (p.kind === 'qitem') { p.got = 1; const q = (R.quests || []).find((o) => o.id === p.quest); ev(S, { k: 'qitem', x: p.x, y: p.y, quest: p.quest }); if (q) R.msg = { s: 'Найдено: «' + q.thing + '»', t: S.t }; }
        else if (p.kind === 'key') { R.keys = (R.keys || 0) + 1; p.got = 1; ev(S, { k: 'key', x: p.x, y: p.y }); R.msg = { s: 'Ключ! Он отпирает дверь на этом этаже', t: S.t }; }
        else if (wearIfFree(S, R, p.item)) { p.got = 1; if (p.item.rar === 4 && R.viaTown) R.legend = itemName(p.item); if (p.loot) { fstat(R).loot++; checkFull(S, R); } ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item), worn: 1 }); }
        else if (bagAdd(R, p.item)) { p.got = 1; if (p.item.rar === 4 && R.viaTown) R.legend = itemName(p.item); if (p.loot) { fstat(R).loot++; checkFull(S, R); } ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item) }); }
        else if (S.t - (R.fullT || -9) > 2.5) { R.fullT = S.t; ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Инвентарь полон' }); }
      } }
    R.drops = R.drops.filter((p) => !p.got);
  }

  // ---------------- run end / menus ----------------
  function endRun(S, how) {
    const R = S.run; if (!R) return;
    const W2 = runReward(R, how), bonus = W2.base + W2.bonus;
    S.meta.shards += bonus; S.meta.runs = (S.meta.runs || 0) + 1; if (how === 'win') S.meta.wins = (S.meta.wins || 0) + 1;
    // what the Keeper of the Fire will speak of to the next hero (TASKS 1016)
    if (how === 'dead' && !(R.log && R.log.abandon)) S.meta.deaths = (S.meta.deaths || 0) + 1; S.meta.lastEnd = R.log && R.log.abandon ? 'abandon' : how; S.meta.endTold = 0;
    if (RUN(R) === D.RUNS.campaign) S.meta.best = Math.max(S.meta.best || 0, R.floor);
    // the endless descent's record depth (TASKS 348): the deepest floor reached
    const deepBest = S.meta.bestEndless || 0; if (RUN(R).endless) S.meta.bestEndless = Math.max(deepBest, R.floor);
    S.result = { how, mode: R.mode, floor: R.floor, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, shards: R.shards + bonus, found: R.shards, base: W2.base, statBonus: W2.bonus, cap: W2.cap,
      C: W2.C, win: how === 'win' ? REWARD.win : 0, time: R.play || 0, donations: R.donations || 0,
      damage: (R.recentDamage || []).slice(-3), abandoned: !!(R.log && R.log.abandon), record: RUN(R).endless ? { best: S.meta.bestEndless, fresh: R.floor > deepBest } : undefined, campaignWon: R.campaignWon ? 1 : 0, town: R.viaTown ? 1 : 0, hero: JSON.parse(JSON.stringify(R.hero)), heroStats: heroSt(S) };
    if (R.log) { R.log.end = { how: R.log.abandon ? 'abandon' : how, time: R.play || 0, floor: R.floor, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, cause: how === 'dead' ? R.log.last || null : null, bag: potCount(R.hero), tail: R.log.tail || [], done: R.stats || {}, pct: W2.C.pct };   // done: per floor kills/foes, loot/lootN, sec/secN
      S.result.log = R.log; S.logN = (S.logN || 0) + 1; }
    S.run = null; S.saved = null; S.screen = how; S.saveN++;
  }
  // a hero who starts above level 1 opens on the hero screen, his points still to lay out
  // past the serpent, down the stairs (TASKS 354): the campaign is won on the spot — its reward (gold and the win's shards), a win,
  // its record — and the same run goes on as the endless descent from the 13th, the hero as he is; the descent's depth is its record
  function descend(S, R) {
    const W2 = runReward(R, 'win'); S.meta.shards += W2.base; S.meta.wins = (S.meta.wins || 0) + 1; S.meta.best = Math.max(S.meta.best || 0, R.floor);
    R.goldBanked = R.goldTot; R.campaignWon = 1; R.mode = RUN(R).then; S.saveN++;
    ev(S, { k: 'stairs', x: R.hero.x, y: R.hero.y, floor: R.floor }); enterFloor(S, R, R.floor + 1);
    R.msg = { s: 'Кампания пройдена! +' + W2.base + ' осколков душ. Спуск продолжается: этаж ' + R.floor + ' — ' + D.floorName(R.floor, R.mode, R.seed, FROM(R)), t: S.t, d: 5 }; }
  // the checks of the dungeon's own workings start from the menu as before and play its 1st floor laid out without the town (a
  // merchant on the floor, no stairs up), the run's seed kept (TASKS 1026: the campaign itself now starts in the town)
  const begin = (S) => { step(S, { keys: [], px: 960, py: 598, click: 1 }); if (S.run && S.run.town) { S.run = newRun(S, 'campaign', S.run.seed); S.screen = 'play'; } };
  // the campaign starts in the town (TASKS 1026); the test runs (the caves, the magma caves, the endless descent) as before
  function startRun(S, mode = 'campaign') { const seed = (S.seedBase + S.meta.runs * 7777 + Math.floor(S.t * 1000)) >>> 0, town = mode === 'town' || mode === 'campaign'; S.run = newRun(S, town ? 'campaign' : mode, seed, { town }); S.saved = null;
    S.screen = S.run.hero.pts > 0 && RUN(S.run).lvl > 1 ? 'inv' : 'play'; }

  // a saved run is dropped only on a second press of the same run's button
  const pressRun = (S, id, arm) => { if (!S.saved || arm === id) { S.resetT = undefined; startRun(S, id); } else { S.resetT = S.t; S.resetM = id; } };
  function stepUI(S, inp, keys) {
    const x = inp.px, y = inp.py, click = inp.click;
    if (S.screen === 'menu') {
      const arm = S.resetT !== undefined && S.t - S.resetT < 3 && S.resetM, b = D.hitUI(UI.menu(!!S.saved, S.meta.diff, arm, S.meta.zoom, S.saved && S.saved.town), x, y); S.hover = b ? b.id : '';
      if (click && b && b.on) {
        if (b.id === 'continue') { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; S.run.msg = { s: D.placeName(S.run.floor, S.run.mode, S.run.seed, FROM(S.run), S.run.map), t: S.t }; }
        if (D.RUNS[b.id]) pressRun(S, b.id, arm);
        if (b.id === 'tests') S.screen = 'tests';
        if (b.id === 'diff') { const o = D.DIFF_ORDER; S.meta.diff = o[(o.indexOf(S.meta.diff || 'normal') + 1) % o.length]; S.saveN++; }
        if (b.id === 'zoom') nextZoom(S);
        if (b.id === 'town') { if (S.saved) { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; S.run.msg = { s: D.placeName(S.run.floor, S.run.mode, S.run.seed, FROM(S.run), S.run.map), t: S.t }; } else startRun(S); }
        ev(S, { k: 'ui', x, y });
      }
      if (keys.Enter) { if (S.saved) { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; } else startRun(S); }
      return;
    }
    // the test runs' screen (TASKS 417): each starts its run as the main menu's buttons did; «Назад» or Escape go back
    if (S.screen === 'tests') {
      const arm = S.resetT !== undefined && S.t - S.resetT < 3 && S.resetM, b = D.hitUI(UI.tests(!!S.saved, arm), x, y); S.hover = b ? b.id : '';
      if ((click && b && b.id === 'back') || keys.Escape) { S.screen = 'menu'; S.hover = ''; if (click) ev(S, { k: 'ui', x, y }); return; }
      if (click && b && b.on) { pressRun(S, b.id, arm); ev(S, { k: 'ui', x, y }); }
      return;
    }
    if (S.screen === 'meta') {
      const bs = UI.meta(), b = D.hitUI(bs, x, y); S.hover = b ? b.id : '';
      if ((click && b && b.id === 'back') || keys.Escape || (S.metaRun && keys.KeyE)) { S.screen = S.metaRun && S.run ? 'play' : 'menu'; S.metaRun = 0; return; }
      if (click && b) { const M = META.find((q) => q.id === b.id); if (M) { const r = S.meta.up[M.id] || 0, c = M.cost(r);
        if (r < M.max && S.meta.shards >= c) { S.meta.shards -= c; S.meta.up[M.id] = r + 1; S.saveN++; ev(S, { k: 'buy', x, y, id: M.id }); } else ev(S, { k: 'nope', x, y, s: r >= M.max ? 'Максимум' : 'Не хватает осколков' }); } }
      return;
    }
    if (S.screen === 'pause') {
      const b = D.hitUI(UI.pause(S.meta.zoom), x, y); S.hover = b ? b.id : '';
      if (click && b && b.id === 'zoom') { nextZoom(S); S.run.zoom = S.meta.zoom; ev(S, { k: 'ui', x, y }); return; }
      if (keys.Escape || (click && b && b.id === 'resume')) { S.screen = 'play'; return; }
      if (click && b && b.id === 'save') { S.saved = S.run; S.run = null; S.screen = 'menu'; S.saveN++; return; }
      if (click && b && b.id === 'abandon') { if (S.run.log) S.run.log.abandon = 1; endRun(S, 'dead'); return; }
      return;
    }
    if (S.screen === 'dead' || S.screen === 'win') {
      const b = D.hitUI(UI.end(S.result && S.result.log, S.result && S.result.town), x, y); S.hover = b ? b.id : '';
      if (click && b && b.on) { if (b.id === 'log') { S.logReq = (S.logReq || 0) + 1; ev(S, { k: 'ui', x, y }); } else if (b.id === 'menu') S.screen = 'menu'; else startRun(S, S.result && S.result.town ? 'town' : S.result && !S.result.campaignWon && S.result.mode || 'campaign'); }
      return;
    }
    // the storage chest: a click moves an item across, a drag drops it on the cell under the pointer (a drop where it started, or
    // off any cell, moves it across as a click would)
    if (S.screen === 'talk') {
      const T = S.talk, b = T && D.hitUI(UI.talk(T).r, x, y); S.hover = b ? b.id : '';
      if (!T || !S.run || keys.Escape) { S.screen = 'play'; S.talk = null; return; }
      if (click && b && b.id === 'craft') { S.talk = null; S.screen = 'craft'; S.craft = { kind: 'forge', sel: S.craft && S.craft.kind === 'forge' ? S.craft.sel : null }; S.hover = ''; ev(S, { k: 'ui', x, y }); return; }
      // on a quest's last page E, the space or Enter press its button; «Дальше» / «Не сейчас» leave it
      const last = T.p + 1 >= T.pages.length;
      if (T.act && last && ((click && b && b.id === 'act') || keys.KeyE || keys.Space || keys.Enter)) { talkAct(S, S.run, T); return; }
      if ((click && b && b.id === 'next') || keys.KeyE || keys.Space || keys.Enter) { if (++T.p >= T.pages.length) { S.screen = 'play'; S.talk = null; } else ev(S, { k: 'ui', x, y }); }
      return;
    }
    if (S.screen === 'craft') {
      const R = S.run, U = UI.craft(), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
      if (!R || !S.craft || keys.Escape || keys.KeyE || keys.KeyI || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
      if (click && b && (b.id.startsWith('eq:') || b.id.startsWith('bag:'))) { const it = b.id.startsWith('eq:') ? R.hero.eq[b.slot] : R.hero.bag[b.i];
        if (it && BASES[it.b]) { S.craft.sel = b.id; S.craft.res = null; ev(S, { k: 'ui', x, y }); } else if (it) ev(S, { k: 'nope', x, y, s: 'Только снаряжение' }); }
      if (click && b && b.id === 'do') craft(S, R);
      return;
    }
    if (S.screen === 'stash') {
      const R = S.run, U = UI.stash(), b = D.hitUI(U.r, x, y), n = D.STASH.cells(S.meta); S.hover = b ? b.id : '';
      if (!R || keys.Escape || keys.KeyE || keys.KeyI || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; S.drag = null; return; }
      const T = stashOf(S);
      if (click && b && ((b.id.startsWith('bag:') && R.hero.bag[b.i]) || (b.id.startsWith('stash:') && T.items[b.i]))) S.drag = { from: b.id, x, y };
      if (S.drag && inp.press) { S.drag.x = x; S.drag.y = y; }
      else if (S.drag) { const from = S.drag.from, k = +from.split(':')[1], to = b && b.id !== from ? b : null; S.drag = null;
        if (from.startsWith('bag:')) stashPut(S, R, k, to && to.id.startsWith('stash:') && to.i < n ? to.i : undefined);
        else stashTake(S, R, k, to && to.id.startsWith('bag:') ? to.i : undefined); }
      return;
    }
    if (S.screen === 'gate') {
      const R = S.run, o = gateWays(R), U = UI.gate(o.length), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
      if (!o.length || keys.Escape || keys.KeyE || (click && b && b.id === 'leave')) { S.screen = 'play'; return; }
      if (click && b && b.id.startsWith('go:') && o[b.i]) gateGo(S, R, o[b.i]);
      return;
    }
    if (S.screen === 'altar') {
      const R = S.run, sh = R.shrines[R.altar], U = UI.altar(), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
      if (!sh || keys.Escape || keys.KeyE || (click && b && b.id === 'leave')) { S.screen = 'play'; return; }
      if (click && b && b.id.startsWith('gift:')) takeGift(S, R, sh, b.i, x, y);
      if (click && b && b.id === 'donate') donate(S, R, x, y);
      return;
    }
    if (S.screen === 'shop') {
      const R = S.run, sh = R.shop, U = UI.shop(sh.goods.length), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
      if (keys.Escape || keys.KeyE || keys.KeyI || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
      if (!click || !b) return;
      if (b.id.startsWith('buy:') && sh.goods[b.i]) buy(S, R, sh.goods[b.i], 0);
      if (b.id.startsWith('back:') && sh.back[b.i]) buy(S, R, sh.back[b.i], 1);
      if (b.id.startsWith('sell:')) sell(S, R, b.i);
      return;
    }
    // the notice board (TASKS 1033): E or Esc closes it, a row's button takes its quest
    if (S.screen === 'board') {
      const R = S.run, L0 = R ? boardOffers(R) : [], U = UI.board(L0.length), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
      if (!R || keys.Escape || keys.KeyE || keys.KeyJ || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
      if (click && b && b.id.startsWith('take:') && L0[b.i]) giveQuest(S, R, L0[b.i].role);
      return;
    }
    // the quest journal (TASKS 1023): J or Esc closes it, a click picks a quest to read
    if (S.screen === 'journal') {
      const R = S.run, L0 = R ? journalOf(R) : [], U = UI.journal(L0.length), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
      if (!R || keys.Escape || keys.KeyJ || keys.KeyI || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
      if (click && b && b.id.startsWith('q:') && L0[b.i]) { S.jsel = L0[b.i].id; ev(S, { k: 'ui', x, y }); }
      return;
    }
    if (S.screen === 'inv') {
      const R = S.run, h = R.hero, U = UI.inv(), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
      if (keys.Escape || keys.KeyI || keys.KeyC || keys.Tab || (click && b && b.id === 'close')) { S.screen = 'play'; return; }
      if (!b) return;
      if (click && b.id.startsWith('bag:')) useItem(S, R, b.i);
      if (click && b.id.startsWith('eq:')) { const it = h.eq[b.slot]; if (it && bagAdd(R, it)) { h.eq[b.slot] = null; const st = heroSt(S); h.hp = Math.min(h.hp, st.maxHp); h.mp = Math.min(h.mp, st.maxMp); ev(S, { k: 'unequip', x: h.x, y: h.y, slot: b.slot, off: gearName(it) }); } }
      if (inp.rclick && b.id.startsWith('bag:') && h.bag[b.i]) { const it = h.bag[b.i]; h.bag[b.i] = null; throwAway(R, h, it); ev(S, { k: 'toss', x: h.x, y: h.y }); }
      if (click && b.id.startsWith('stat:') && h.pts > 0) { h.base[b.k]++; h.pts--; if (b.k === 'vit') h.hp += 10; if (b.k === 'int') h.mp += 6; ev(S, { k: 'buy', x, y }); }
      if (click && b.id.startsWith('ab:') && h.sp > 0) { const A = ABILITIES.find((a) => a.id === b.ab); if (h.lvl >= A.unlock && (h.ab[b.ab] || 0) < D.AB_MAX) { h.ab[b.ab] = (h.ab[b.ab] || 0) + 1; h.sp--; ev(S, { k: 'buy', x, y }); } }
    }
  }

  // ---------------- top level ----------------
  function create() {
    // the attract demo: floor 1 of a fixed seed, a level-3 hero next to the first fight, driven by a scripted bot
    const S = base(); S.demo = 1; S.screen = 'play'; S.run = newRun(S, 'campaign', DEMO_SEED);
    const R = S.run, h = R.hero; h.lvl = 3; h.ab.fireball = 1; h.base.str += 4; const st = stats(h, S.meta); h.hp = st.maxHp; h.mp = st.maxMp;
    const room = R.map.rooms[R.map.start]; for (const e of R.en) e.hp = Math.min(e.hp, 40);
    R.msg = null; S.ev = []; S.saveN = 0; void room;
    return S;
  }
  function base() { return { t: 0, steps: 0, wt0: 0, ev: [], screen: 'menu', hover: '', meta: { shards: 0, up: {}, runs: 0, wins: 0, best: 0 }, run: null, saved: null,
    saveN: 0, result: null, demo: 0, seedBase: 1, prevKeys: {} }; }
  // play start: the menu, with the persisted meta progress and the saved run (index.html reads localStorage)
  const spawn = (worldT, persist = {}) => { const S = base(); S.wt0 = worldT; S.seedBase = (Math.floor(worldT * 1000) % 100000) + 1;
    if (persist.meta) S.meta = Object.assign(S.meta, persist.meta, { up: Object.assign({}, persist.meta.up || {}) }); if (persist.run && persist.run.map) { S.saved = persist.run; rebalanceRun(S.saved); S.t = Math.max(S.t, persist.run.t || 0) + DT; } return S; };
  const respawn = (S) => S;
  const outOfPlay = () => false;

  function step(S, inp = {}) {
    rebalanceRun(S.run); rebalanceRun(S.saved); if (S.run && S.run.map) fstat(S.run); if (S.run && !S.demo) S.run.zoom = S.meta.zoom;
    const t = S.t + DT; S.t = t;
    const keys = {}; for (const k of inp.keys || []) keys[k] = 1;
    if (S.screen === 'play' && S.run) {
      if (keys.Backquote && !S.demo) S.debug = !S.debug;
      const dbg = S.debug && !S.demo ? D.hitUI(UI.debug(S.run, S), inp.px, inp.py) : null; if (S.debug) S.hover = dbg ? dbg.id : '';
      if (dbg) { if (inp.click) { if (dbg.id === 'dbg_secrets') debugSecrets(S, S.run); else S.dbgLoot = !S.dbgLoot; ev(S, { k: 'ui', x: inp.px, y: inp.py }); } inp = Object.assign({}, inp, { press: 0, click: 0 }); }
      if (keys.Escape && !S.demo) { S.screen = 'pause'; }
      else if ((keys.KeyI || keys.KeyC || keys.Tab) && !S.demo) { S.screen = 'inv'; }
      else if (keys.KeyJ && !S.demo) { S.screen = 'journal'; S.hover = ''; ev(S, { k: 'ui', x: inp.px, y: inp.py }); }
      else { stepPlay(S, inp, keys); if (S.run && !S.run.frozen) stepBossMove(S, S.run); }
    } else stepUI(S, inp, keys);
    if (S.ev.length > 64) S.ev.splice(0, S.ev.length - 64);
    S.steps++; return S;
  }

  // ---------------- attract bot: walk to the nearest monster through the flow field, swing, throw fire ----------------
  function scriptInput(t, S) {
    const inp = { left: 0, right: 0, up: 0, down: 0, press: 0, click: 0, rclick: 0, px: 960, py: 540, keys: [], slot: 0 };
    const R = S.run; if (!R) return inp; const h = R.hero, m = R.map;
    let tg = null, td = 1e9; for (const e of R.en) { if (e.deadT >= 0) continue; const d = Math.hypot(e.x - h.x, e.y - h.y); if (d < td) { td = d; tg = e; } }
    if (!tg) return inp;
    Object.assign(inp, toPx(R, tg.x, tg.y - 30));
    const reach = 46 + ENEMIES[tg.type].r;
    if (td > reach - 6) {
      const F = flow(m, Math.floor(tg.x / TILE), Math.floor(tg.y / TILE), 1), tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
      let gx = tg.x - h.x, gy = tg.y - h.y;
      if (td > 120 || !losClear(m, h.x, h.y - 6, tg.x, tg.y - 6)) { let best = null;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = F[(ty + ay) * m.W + tx + ax]; if (v >= 0 && (!best || v < best[0])) best = [v, ax, ay]; }
        if (best) { gx = (tx + best[1]) * TILE + 16 - h.x; gy = (ty + best[2]) * TILE + 18 - h.y; } }
      if (Math.abs(gx) > 5) inp[gx > 0 ? 'right' : 'left'] = 1; if (Math.abs(gy) > 5) inp[gy > 0 ? 'down' : 'up'] = 1;
    } else inp.press = 1;
    if (td < 330 && td > 140 && h.cd.fireball <= S.t && h.mp > 30) { const [hx, hy] = hand(h); if (losClear(m, hx, hy + 20, tg.x, tg.y - 10)) inp.slot = 2; }
    if (h.hp < 40) inp.keys.push('KeyQ');
    if (doorNear(R, 60)) inp.keys.push('KeyE');
    return inp;
  }
  const demoCheck = (S) => S.run && S.run.kills >= 3 && S.run.hero.deadT < 0;
  let cache = null;
  function at(t) {
    const loop = Math.floor(t / L), q = t - loop * L, n = Math.round(q / DT);
    if (!cache || cache.loop !== loop || cache.S.steps > n) { const S0 = create(); S0.wt0 = loop * L; cache = { loop, S: S0 }; }
    const S = cache.S; while (S.steps < n) { const inp = scriptInput(S.t, S); step(S, inp); }
    return Object.assign({}, S, { loop, q });
  }
  const persist = (S) => ({ meta: S.meta, run: S.run || S.saved || null });

  root.SIM = { rebuildArrival, FOLK_OUCH, questIcon, atBoard, boardOffers, serpentMouth, flightReach, openSecret, debugSecrets, lootAudit, openChest, DT, ARROW_Y, L, K, VIEW, HINT, RIG, create, spawn, respawn, outOfPlay, step, at, scriptInput, demoCheck, persist,
    stepLen, stats, gift, itemName, hitSecret, hitProps, secretMask, hidden, fstat, completion, completionHints, damageName, canDonate, runCompletion, runReward, REWARD, LOOT, itemIcon, itemMods, typeMods, isCons, hand, losClear, rollItem, newRun, enterFloor, cell, flow, atCounter, newQuest, takeQuest, turnIn, questOn, offersOf, offerOf, questFloor, storyStep, questMark, questTalk, giveQuest, questMarks, questLine, questPlace, rwLine, journalOf, folkNear, keeperPages, atSoulAltar, atStash, stashOf, atCraft, craftItem, craftCost, tradeDepth, stockShopFor: (R, f, kind) => stockShop(R, dep(R, f), kind), atGate, gateWays, openDoor, pullLever, doorLock, doorNear, leverNear, springAmbush, crustAt, CRUST, DOOM, chasm, brinkOf, gateNear, killEnemy };
  // what the files after this one take from the sim's inside (ARCHITECTURE.md §4.1): sim_checks.js, Node only
  root.SIMX = {
    ABILITIES, ARROW_Y, BAL, BASES, CRUST, D, DG, DOOM, DT, ENEMIES, FROM, K, LOOT, MOD, RARITY, REWARD, STAGE, TILE, UI, WADE, addFire,
    aggroRoom, angDiff, arenaPath, arenaSealed, begin, beginBossMove, boardOffers, bossEggs, bossLava, bossRaise, bossThink, bossWebs,
    boxHit, brinkOf, castAbility, cell, colossusBoulder, colossusRain, completion, completionHints, counted, crustAt, damageName, deepBody,
    dep, descend, doorLock, dropCell, endRun, enterFloor, floorStat, flow, folkFree, folkOf, folkR, fstat, heroHit, heroSt, hidden,
    hitEnemy, hitFolk, hitProps, hitSecrets, hurtHero, inRoom1, inStart, inWater, interact, isCons, itemMods, itemPower, journalOf,
    killEnemy, kindOf, lastFloor, lootAudit, losClear, move, newQuest, newRun, offerOf, offersOf, onLava, openAltar, openChest, openDoor,
    openSecret, persist, poolOk, potion, questFloor, questMark, questMarks, rebalanceRun, reveal, rollAffixes, rollItem, runCompletion,
    runReward, scriptInput, secretMask, serpent, serpentMouth, shelfOf, solidAt, solidC, solids, spawn, springAmbush, startRun, stats,
    steer, step, stepArena, stepBossMove, stepDrops, stepProjectiles, stockShop, struck, takeQuest, tearWebs, throwAway, toPx, tradeDepth,
    turnIn, typeMods, under, useItem, usePotion, wearIfFree, who, wideClear };
  if (typeof module !== 'undefined') { require('./sim_checks.js'); module.exports = root.SIM; }
})(typeof window !== 'undefined' ? window : globalThis);
