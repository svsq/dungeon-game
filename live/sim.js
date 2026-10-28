// live/sim.js — deterministic dungeon-crawler simulation, fixed 120 Hz. Contract: create / step / at / spawn / respawn /
// outOfPlay / scriptInput (engine.md §6). Everything that happens lives here: menus, the run (procedural floors), the hero
// (stats, gear, abilities, levelling), monsters (FSM + flow-field chase), loot, traps, saves (S.saveN asks index.html to
// persist S.meta and the run), camera, and the event bus S.ev that drives every FX in the scene.
(function (root) {
  const D = root.DATA || require('./data.js'), DG = root.DUNGEON || require('./dungeon.js');
  const { TILE, ENEMIES, BAL, ELITE, eliteK, ELITE_MODS, BASES, CONSUMABLES, RARITY, AFFIXES, ABILITIES, META, UI } = D;
  const DT = 1 / 120, L = 26.0;
  // VIEW is the screen (the pointer comes in its px); WIN the world window the camera shows on it, zoomed
  // the zoom lives on the run (R.zoom, copied from the player's setting every step) so camera and pointer follow a change at once
  const VIEW = { W: 1920, H: 1080 }, zoomOf = (R) => (R && R.zoom) || D.ZOOM || 1, WIN = (R) => ({ W: VIEW.W / zoomOf(R), H: VIEW.H / zoomOf(R) }),
    toPx = (R, x, y) => ({ px: (x - R.cam[0]) * zoomOf(R), py: (y - R.cam[1]) * zoomOf(R) });
  const nextZoom = (S) => { const o = D.ZOOMS, z = S.meta.zoom || D.ZOOM; S.meta.zoom = o[(o.indexOf(z) + 1) % o.length]; S.saveN++; };
  const HINT = 'WASD — движение · ЛКМ — атака · 1 2 3 — способности · Пробел — рывок · Q/R — зелья · E — действие · I — герой · Esc — пауза';
  const K = { HIT: 0.13, RUN: 175, ACC: 1900, DEC: 2300, DASH: 640, DASH_T: 0.16, DASH_CD: 0.75, LEAP: 0.14, R: 12, STEP: 20 };
  const DEMO_SEED = 4243;

  // ---------------- rng (state lives in the run: deterministic replay) ----------------
  const rnd = (R) => { R.rs = (R.rs + 0x6d2b79f5) | 0; let t = Math.imul(R.rs ^ (R.rs >>> 15), 1 | R.rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (R, a, b) => a + Math.floor(rnd(R) * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(rnd(R) * arr.length)];
  const ev = (S, e) => { e.t = S.t; S.ev.push(e); if (S.run && e.k === 'hurt') S.run.recentDamage = (S.run.recentDamage || []).concat({ t: e.t, src: e.src, n: e.n, actor: e.actor || null }).slice(-3);
    if (S.run && e.k === 'boom') S.run.scorches = (S.run.scorches || []).filter((s) => S.t - s.t < 4).concat({ ...e }).slice(-24); if (S.run && S.run.log && !S.demo) note(S, e); };
  // hard's extra damage and HP ramp in over floors 1-3: ×1.3 × ×1.25 from the first room killed a third of average players there (TASKS 200)
  // the run's description (data.js RUNS) and how deep a floor of it is in campaign floors: everything that grows as floors climb
  // reads the depth, the run's own floor numbers only place its bosses, guards and end
  const RUN = (R) => D.runOf(R.mode), dep = (R, f = R.floor) => (f || 1) + RUN(R).depth, lastFloor = (R) => R.floor === RUN(R).floors;
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
    return rollAffixes(R, itemPower({ id: 0, b: bk, rar, lvl: floor, mods: {} }));
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
      spell: (1 + s.int * 0.04) * (1 + (W.spell || 0)) * (1 + s.fire / 100) * (1 + 0.06 * (up.dmg || 0)) * (1 + gift(h, 'fury') / 100) * (1 + gift(h, 'arcane') / 100),
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
  function newRun(S, mode, seed) {
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
    enterFloor(S, R, 1);
    return R;
  }
  // ---------------- elite powers ----------------
  const MOD = Object.fromEntries(ELITE_MODS.map((m) => [m.id, m])), has = (e, id) => !!(e.mods && e.mods.includes(id));
  function rollMods(R, f) { const [a, b] = D.eliteMods(f), n = a + (b > a && rnd(R) < 0.5 ? 1 : 0), pool = ELITE_MODS.map((m) => m.id), out = [];
    while (out.length < n) out.push(pool.splice(Math.floor(rnd(R) * pool.length), 1)[0]); return out; }
  // what an elite's powers add to a blow of its that landed on the hero
  function struck(S, R, e) {
    const h = R.hero; if (!e || h.hurtT !== S.t) return;
    // thorns: a share of a blow taken at close quarters goes back into whoever struck it (not into a caster's bolt)
    if (gift(h, 'thorns') && e.deadT < 0 && Math.hypot(e.x - h.x, e.y - h.y) < 150) hitEnemy(S, R, e, Math.max(1, Math.round(h.lastHit * gift(h, 'thorns') / 100)), 0, h.x, h.y, 0, 'thorns');
    if (!e.mods) return;
    if (has(e, 'fiery')) { if (h.burn <= S.t) h.burnT = S.t - 0.5; h.burn = Math.max(h.burn, S.t + MOD.fiery.burn); }   // a fresh blow only extends the fire, the ticks keep their pace
    if (has(e, 'vampire') && e.deadT < 0) { const n = Math.round(e.max * MOD.vampire.heal); e.hp = Math.min(e.max, e.hp + n);
      ev(S, { k: 'drain', x: h.x, y: h.y - 40, tx: e.x, ty: e.y - ENEMIES[e.type].h * 0.5, n, id: e.id }); }
  }
  // plain skeletons of the floor's strength around a summoner, never more than its cap of its own alive at once
  function raise(S, R, e) { const M = MOD.summoner, sk = ENEMIES.skeleton, f = dep(R), own = R.en.filter((o) => o.summ === e.id && o.deadT < 0).length;
    for (let i = 0; i < Math.min(M.n, M.cap - own); i++) { const a = rnd(R) * 6.28, x = e.x + Math.cos(a) * 70, y = e.y + Math.sin(a) * 50; if (solidAt(R.map, x, y, true)) continue;
      const hp = Math.round(sk.hp * BAL.hp * dif(R, 'hp') * (1 + 0.5 * (f - 1)));
      R.en.push({ id: R.nextId++, type: 'skeleton', x, y, vx: 0, vy: 0, hp, max: hp, dmg: sk.dmg * BAL.dmg * 1.35 * D.dmgAt(f), elite: 0, room: e.room, st: 'chase', t0: S.t, face: 1, aimA: 0,
        cdT: S.t + 1, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: e.id, spawnT: S.t, seenT: S.t });
      ev(S, { k: 'summon', x, y }); } }
  // an explosive elite's corpse bursts once its fuse burns down: the hero and the monsters in reach are hit
  function blast(S, R, e) { const M = MOD.explosive, h = R.hero; e.fuse = 0;
    if (h.deadT < 0 && Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(R.map, e.x, e.y - 6, h.x, h.y - 6)) hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e) + ' взрыв', e);
    for (const o of R.en) if (o !== e && o.deadT < 0 && Math.hypot(o.x - e.x, o.y - e.y) < M.r + ENEMIES[o.type].r) hitEnemy(S, R, o, Math.round(e.max * 0.25), false, e.x, e.y, 1.5);
    breakPots(S, R, e.x, e.y, M.r); ev(S, { k: 'boom', x: e.x, y: e.y - 20, big: 1, r: M.r }); R.trauma = Math.min(1, R.trauma + 0.5); }
  function enterFloor(S, R, f, gen) {
    R.floor = f; R.propHit = {};
    if (R.log) R.log.fl.push({ f, bag: potCount(R.hero), eq: Object.fromEntries(Object.entries(R.hero.eq).filter(([, it]) => it).map(([k, it]) => [k, gearName(it)])), perks: Object.assign({}, R.hero.perks), time: 0, lvlIn: R.hero.lvl, lvl: R.hero.lvl, xp: 0, minHp: 1, minMp: 1, kills: {}, dmg: {}, hits: {}, pot: {}, ab: {}, gold: 0, buy: 0, sell: 0, buys: [] }); const m = DG.genFloor((R.seed * 31 + f * 1013) >>> 0, f, Object.assign({ endless: R.mode === 'endless', mode: R.mode }, gen));
    R.map = m; R.arena = null; R.eggs = []; R.lavaPending = []; R.en = []; R.proj = []; R.drops = []; R.scorches = [];
    const d = dep(R, f), sc = BAL.hp * dif(R, 'hp') * (1 + 0.5 * (d - 1)), dc = BAL.dmg * 1.35 * D.dmgAt(d);
    for (const e of m.enemies) { const E = ENEMIES[e.type], guard = e.guard ? RUN(R).guard[f] : e.exit && e.elite ? RUN(R).exit[f] : undefined, gk = (typeof guard === 'object' ? guard.hp : guard) || 1, gd = (typeof guard === 'object' ? guard.dmg : guard) || 1, el = (e.elite && !D.BOSSES[e.type] ? eliteK(e, 'hp') : 1) * gk;
      R.en.push({ id: R.nextId++, type: e.type, x: e.x, y: e.y, vx: 0, vy: 0, hp: Math.round(E.hp * sc * el), max: Math.round(E.hp * sc * el), dmg: E.dmg * dc * (D.BOSSES[e.type] ? D.dmgAt(d, 1) / D.dmgAt(d) : 1) * (!e.elite ? 1 : D.BOSSES[e.type] ? 1.35 : eliteK(e, 'dmg')) * gd,
        elite: e.elite, guard: e.guard || 0, room: e.room, st: 'idle', t0: -9, face: rnd(R) < 0.5 ? -1 : 1, aimA: 0, cdT: 0, hitT: -9, deadT: -1, dist: rnd(R) * 50, kbx: 0, kby: 0, burn: 0, burnT: 0, tx: 0, ty: 0, phase: 0, bossVersion: 1, summ: 0, hx: e.x, hy: e.y, seenT: 0, ft: -9 }); }
    m.enemies.forEach((e, i) => { if (e.key !== undefined) R.en[i].key = e.key; });
    for (const e of R.en) if (e.elite && !D.BOSSES[e.type]) e.mods = rollMods(R, d);
    // a closed door is a solid cell (5) that blocks sight like rock until it opens
    for (const d of m.doors || []) if (!d.open) for (const [x, y] of d.cells) m.cells[y * m.W + x] = 5;
    R.keys = 0;
    R.shop = stockShop(R, d);
    R.chests = m.chests.map((c) => Object.assign({}, c)); for (const c of R.chests) c.loot = chestLoot(R, c); R.pots = m.pots.map((p) => Object.assign({}, p)); R.shrines = m.shrines.map((s) => Object.assign({}, s));
    // a big monster's post can graze a prop: the post is where it can actually stand
    { const sol = solids(R), clear = (x, y, r) => !boxHit(m, x, y, r, true, false) && !sol.some((o) => Math.hypot(x - o.x, (y - o.y) * 1.6) < o.r + r);
      for (const e of R.en) { const r = ENEMIES[e.type].r; if (ENEMIES[e.type].ghost) continue; shove(m, e, r, true, sol);
        // squeezed between two props, the push only rocks it back and forth: take the nearest spot where it fits
        if (!clear(e.x, e.y, r)) find: for (let d = 4; d <= 96; d += 4) for (let a = 0; a < 16; a++) { const x = e.x + Math.cos(a * Math.PI / 8) * d, y = e.y + Math.sin(a * Math.PI / 8) * d;
          if (clear(x, y, r)) { e.x = x; e.y = y; break find; } }
        e.hx = e.x; e.hy = e.y; } }
    R.seen = new Array(m.W * m.H).fill(0); R.rseen = m.rooms.map(() => 0);
    R.stats = R.stats || {}; R.stats[f] = floorStat(R);
    const h = R.hero; h.x = m.spawn.x; h.y = m.spawn.y; h.vx = h.vy = 0; h.bless = 0;
    R.zoom = S.demo ? D.ZOOM : S.meta.zoom; R.cam = [h.x - WIN(R).W / 2, h.y - WIN(R).H / 2]; R.camV = [0, 0]; clampCam(R, R.cam);
    reveal(R); ev(S, { k: 'floor', x: h.x, y: h.y, f });
    R.msg = { s: 'Этаж ' + f + ' — ' + D.floorName(f, R.mode), t: S.t };
    S.saveN++;
  }

  // ---------------- completion: per floor, monsters (not summoned ones), loot, secrets ----------------
  // loot is items picked up out of all the items the floor has put out (its chests' contents from the start, then every drop as
  // it falls); a drop counts when first picked up, and an item thrown away or sold stays counted, while picking it up again
  // never counts twice (a thrown item is not a loot drop)
  function floorStat(R) { const m = R.map;
    return { foes: R.en.filter((e) => !e.summ).length, kills: R.en.filter((e) => !e.summ && e.deadT >= 0).length,
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
  const runCompletion = (R) => completion(Object.values(R.stats || {}));
  function completionHints(R) {
    const f = (R.stats || {})[R.floor]; if (!f) return [];
    const near = (k, n) => f[n] > 0 && f[k] < f[n] && f[k] / f[n] >= 0.85, out = [];
    const put = (o, kind) => { if (!hidden(R.map, o)) out.push({ x: o.x, y: o.y, kind }); };
    if (near('kills', 'foes')) for (const e of R.en) if (!e.summ && e.deadT < 0) put(e, 'foe');
    if (near('loot', 'lootN')) {
      for (const c of R.chests) if (!c.open && c.loot && c.loot.length) put(c, 'loot');
      for (const d of R.drops) if (d.loot && !d.got && d.kind === 'item') put(d, 'loot');
    }
    if (near('sec', 'secN') || near('loot', 'lootN') || near('kills', 'foes')) for (const q of R.map.secrets || []) if (!q.open) {
      const room = R.map.rooms[q.room], inside = (o) => inRoom0(room, Math.floor(o.x / TILE), Math.floor(o.y / TILE));
      if (near('sec', 'secN') || (near('loot', 'lootN') && R.chests.some((c) => !c.open && c.loot && c.loot.length && inside(c))) ||
        (near('kills', 'foes') && R.en.some((e) => !e.summ && e.deadT < 0 && inside(e)))) out.push({ x: q.x, y: q.y, kind: 'secret' });
    }
    return out;
  }
  function damageName(src) {
    const type = String(src || '').split(' ')[0], E = ENEMIES[type];
    if (E) return E.name + (src.includes('элита') ? ' (элита)' : '') + (src.endsWith('снаряд') ? ' · снаряд' : src.endsWith('взрыв') ? ' · взрыв' : '');
    return ({ spike: 'Шипы', lava: 'Лава', burn: 'Горение', poison: 'Яд', fire: 'Огонь' })[src] || 'Неизвестный источник';
  }
  // the end-of-run reward: gold brought back and a win. Thoroughness is paid on the floor itself, 10 shards for each of its kills,
  // loot and secrets at 100 % and 1 per secret found (TASKS 175); with the elites and the boss a thorough win brings ~120 shards,
  // so the altar's 1395 take some 20 runs
  const REWARD = { goldPer: 500, win: 30, full: 10, secret: 1 };
  function runReward(R, how) {
    const C = runCompletion(R), base = Math.floor(R.goldTot / REWARD.goldPer) + (how === 'win' ? REWARD.win : 0);
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
  // lava (3) can be entered — it burns — by the hero and by a monster knocked into it; a monster never walks into it on its own
  const solidAt = (m, x, y, mon, lavaOk) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), c = cell(m, tx, ty); return c === 3 ? !lavaOk : c !== 1; };
  const onLava = (m, o) => cell(m, Math.floor(o.x / TILE), Math.floor(o.y / TILE)) === 3;
  // shallow water (dungeon.js m.water) lies on floor cells: anyone wades through it slowed, and it puts out a burning one
  const WET = new WeakMap(), WADE = 0.75;
  const inWater = (m, o) => { if (!m.water || !m.water.length) return false; let w = WET.get(m); if (!w) WET.set(m, w = new Set(m.water));
    return w.has(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE)); };
  const onPlate = (a, tr) => Math.abs(a.x - tr.x) < TILE - 4 && Math.abs(a.y - tr.y) < TILE - 6;
  // a web on the floor (dungeon.js m.webs) holds whoever wades in, spiders aside, until it is torn
  const WEB = { k: 0.4, mon: 0.5, rx: 28, ry: 17 };
  const webAt = (m, o) => (m.webs || []).find((w) => !w.torn && Math.abs(o.x - w.x) < WEB.rx * w.s && Math.abs(o.y - w.y) < WEB.ry * w.s);
  // feet box against the grid, axis by axis (slides along walls); the middles of its front and back edges too, or a body wider
  // than a two-cell wall (the boss) straddles it with its corners on both sides
  const boxHit = (m, x, y, r, mon, lavaOk) => solidAt(m, x - r, y - r * 0.6, mon, lavaOk) || solidAt(m, x + r, y - r * 0.6, mon, lavaOk) || solidAt(m, x - r, y + r * 0.4, mon, lavaOk) || solidAt(m, x + r, y + r * 0.4, mon, lavaOk)
    || solidAt(m, x, y - r * 0.6, mon, lavaOk) || solidAt(m, x, y + r * 0.4, mon, lavaOk);
  function move(m, o, dx, dy, r, mon, lavaOk = !mon || onLava(m, o)) {
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
    for (const s of sol) { let dx = o.x - s.x, dy = (o.y - s.y) * 1.6, d = Math.hypot(dx, dy); const rr = s.r + r; if (d >= rr) continue;
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
  const FLOW = { key: '', d: null };
  const FLOW2 = { key: '', d: null };
  function bfs(m, tx, ty, lim, doors) {
    const d = new Int16Array(m.W * m.H).fill(-1), q = new Int32Array(m.W * m.H); let qh = 0, qt = 0;
    const blk = new Uint8Array(m.W * m.H); for (const i of m.block || []) blk[i] = 1;
    const thru = new Uint8Array(m.W * m.H); if (doors) for (const o of m.doors || []) if (!o.open && !o.arena && !doorLock(m, o)) for (const [x, y] of o.cells) thru[y * m.W + x] = 1;
    if (cell(m, tx, ty) === 1) { d[ty * m.W + tx] = 0; q[qt++] = ty * m.W + tx; }
    while (qh < qt) { const i = q[qh++], x = i % m.W, y = (i / m.W) | 0, dv = d[i]; if (dv > lim) continue;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay, j = ny * m.W + nx;
        if (nx < 0 || ny < 0 || nx >= m.W || ny >= m.H || d[j] >= 0 || (m.cells[j] !== 1 && !thru[j]) || blk[j]) continue; d[j] = dv + 1; q[qt++] = j; } }
    return d;
  }
  function flow(m, tx, ty, any) {
    const C = any ? FLOW2 : FLOW, key = m.seed + ':' + m.floor + ':' + tx + ',' + ty + ':' + doorKey(m); if (C.key === key) return C.d;
    C.key = key; C.d = bfs(m, tx, ty, any ? 400 : 40, any); return C.d;
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
    const rooms = new Set();
    for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 8; x <= tx + 8; x++) { if (!inMap(x, y) || !sight(x, y)) continue;
      if (opaque(x, y)) { wall(x, y); continue; }
      R.seen[y * W + x] = 1; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) wall(x + u, y + v);
      const ri = DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE); if (ri >= 0) rooms.add(ri); }
    for (const ri of rooms) { if (R.rseen[ri]) continue; R.rseen[ri] = 1; const r = m.rooms[ri];
      for (let y = r.y - 2; y <= r.y + r.h + 1; y++) for (let x = r.x - 2; x <= r.x + r.w + 1; x++) { if (!inMap(x, y)) continue;
        const own = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
        if (opaque(x, y)) wall(x, y); else if (own || DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) < 0) R.seen[y * W + x] = 1; } }
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
    const h = R.hero; if (h.deadT >= 0 || S.t < h.ifr) return;
    const dashing = S.t - h.dashT < BAL.dodge.t; if (dashing && (kind === 'spike' || src === 'lava')) return;
    if (kind !== 'spike' && src !== 'lava' && rnd(R) * 100 < heroSt(S).dodge + (dashing ? BAL.dodge.dash : 0)) { ev(S, { k: 'dodge', x: h.x, y: h.y, dash: dashing ? 1 : 0 }); return; }
    const st = heroSt(S), KD = 20 + 12 * dep(R); dmg *= dif(R, 'dmg'); dmg = kind === 'spike' ? Math.round(dmg) : Math.max(1, Math.round(dmg * KD / (KD + st.def)));   // armour's share falls as floors climb: deep monsters still bite
    if (src && src !== 'lava') dmg = Math.min(dmg, Math.round(st.maxHp * (/^boss/.test(src) ? BAL.cap.boss : BAL.cap.blow)));
    // blow: what landed before the shield took its part, for the balance tools' blow-size bands (TASKS 225)
    const blow = dmg;
    dmg = absorbShield(S, h, dmg, { blow, src: src || kind || '?' }); if (dmg <= 0) return;
    h.hp -= dmg; h.lastHit = dmg; h.hurtT = S.t; h.hurtX = Math.abs(h.x - sx) < 4 ? 0 : h.x > sx ? 1 : -1; R.trauma = Math.min(1, R.trauma + 0.35); R.freeze = Math.max(R.freeze, 0.05);
    const dx = h.x - sx, dy = h.y - sy, d = Math.hypot(dx, dy) || 1; h.vx += dx / d * 260; h.vy += dy / d * 260;
    if (kind === 'poison') h.poison = S.t + 3;
    if (kind === 'fire') h.burn = Math.max(h.burn, S.t + 3);
    ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n: dmg, blow, side: h.hurtX || -1, src: src || kind || '?',
      actor: actor ? { type: actor.type, elite: actor.elite, mods: (actor.mods || []).slice() } : null });
    // a second chance (a gift): the killing blow leaves half the health instead, once per gift taken
    if (h.hp <= 0 && (h.perks || {}).phoenix > (h.revived || 0)) { h.revived = (h.revived || 0) + 1; h.hp = Math.round(st.maxHp * GIFT_V.phoenix / 100); h.ifr = S.t + 1.2;
      ev(S, { k: 'bless', x: h.x, y: h.y, id: 'phoenix' }); R.msg = { s: 'Второй шанс!', t: S.t }; return; }
    if (h.hp <= 0) { h.hp = 0; h.deadT = S.t; ev(S, { k: 'die', x: h.x, y: h.y }); }
  }
  function hitEnemy(S, R, e, dmg, crit, sx, sy, kb = 1, kind) {
    if (e.deadT >= 0) return;
    if (R.map.bossType === e.type && !R.arena) { stepArena(S, R); if (!R.arena) return; }
    if (D.BOSSES[e.type] && e.st === 'bwind') dmg *= D.bossMove(e).vulnerable || 1;
    dmg = absorbShield(S, e, dmg, { id: e.id }); if (dmg <= 0) return;
    if (gift(R.hero, 'execute') && e.hp < 0.25 * e.max) dmg = Math.round(dmg * (1 + gift(R.hero, 'execute') / 100));
    e.hp -= dmg; e.hitP = e.hitT; e.hitT = S.t; if (e.st === 'idle' || e.st === 'home') aggroRoom(R, e);
    const dx = e.x - sx, dy = e.y - sy, d = Math.hypot(dx, dy) || 1, heavy = e.type === 'brute' || e.elite || ENEMIES[e.type].ghost;
    if (!heavy) { e.kbx += dx / d * 300 * kb; e.kby += dy / d * 300 * kb; }
    if (kind === 'fire') { e.burn = S.t + 3; e.burnT = S.t; }
    ev(S, { k: 'hit', x: e.x, y: e.y - ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: dmg, crit: crit ? 1 : 0, id: e.id, fire: kind === 'fire' ? 1 : 0 });
    R.freeze = Math.max(R.freeze, crit ? 0.06 : 0.035); R.trauma = Math.min(1, R.trauma + (crit ? 0.22 : 0.12));
    const st = heroSt(S); if (kind !== 'burn' && kind !== 'thorns') R.hero.hp = Math.min(st.maxHp, R.hero.hp + dmg * st.leech / 100 + st.onhit);
    if (e.hp <= 0) { e.dieA = Math.atan2(dy, dx); killEnemy(S, R, e); }   // the killing blow's direction: bones fly that way
  }
  function aggroRoom(R, e) { for (const o of R.en) if (o.deadT < 0 && (!D.BOSSES[o.type] || !R.map.bossType || R.arena) && (o === e || o.st === 'idle') && (o.room === e.room || (Math.hypot(o.x - e.x, o.y - e.y) < 220 && losClear(R.map, o.x, o.y - 10, e.x, e.y - 10)))) { o.st = 'chase'; o.t0 = o.seenT = R.t; }
    if (e.st === 'home') { e.st = 'chase'; e.t0 = e.seenT = R.t; } }
  function killEnemy(S, R, e) {
    e.deadT = S.t; e.hp = 0; R.kills++;
    if (gift(R.hero, 'feast') && R.hero.deadT < 0) { const st = heroSt(S); R.hero.hp = Math.min(st.maxHp, R.hero.hp + st.maxHp * gift(R.hero, 'feast') / 100); } if (!e.summ) { fstat(R).kills++; checkFull(S, R); } R.freeze = Math.max(R.freeze, 0.07); R.trauma = Math.min(1, R.trauma + 0.25);
    const E = ENEMIES[e.type]; const nm = e.mods ? e.mods.length : 0; gainXp(S, R, Math.round(E.xp * BAL.reward * (1 + 0.3 * (dep(R) - 1)) * (e.elite && !D.BOSSES[e.type] ? 3 + nm : 1)));
    if (has(e, 'explosive')) { e.fuse = S.t + MOD.explosive.fuse; ev(S, { k: 'fuse', x: e.x, y: e.y, r: MOD.explosive.r, d: MOD.explosive.fuse, id: e.id }); }
    ev(S, { k: 'kill', x: e.x, y: e.y, type: e.type, id: e.id });
    // a raised skeleton pays its XP but carries nothing: a summoner is not a gold mine
    if (e.summ) return;
    if (e.key !== undefined) drop(R, e.x, e.y, { kind: 'key', lock: e.key });
    const gb = 1 + 0.15 * ((S.meta.up || {}).gold || 0);
    if (rnd(R) < 0.55 || e.elite) drop(R, e.x, e.y, { kind: 'gold', n: Math.round((3 + ri(R, 0, 6) + dep(R) * 2) * (e.elite ? 4 + 2 * nm : 1) * gb * BAL.reward) });
    const LT = e.type === 'brute' && e.elite ? LOOT.brute : e.elite ? LOOT.elite : LOOT.mob;
    if (!D.BOSSES[e.type] && (e.elite || rnd(R) < LT.p * BAL.reward)) for (let i = 0, n = 1 + (rnd(R) < (LT.extra || 0) ? 1 : 0); i < n; i++) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), LT.q, undefined, LT) });
    if (rnd(R) < POT.kill * BAL.reward) drop(R, e.x, e.y, { kind: 'item', item: potion(rnd(R) < 0.65 ? 'hp_potion' : 'mp_potion') });
    // a chapter boss replaced an exit guard worth 1 shard: 3 for a sealed fight that is harder, far below the finale's 20 (TASKS 227)
    const fin = D.BOSSES[e.type] && lastFloor(R), sh = D.BOSSES[e.type] ? (fin ? 20 : 3) : e.elite ? 1 : 0; if (sh) drop(R, e.x, e.y, { kind: 'shard', n: sh });
    if (D.BOSSES[e.type]) finishArena(S, R, e);
    if (fin) { R.bossDead = 1; R.msg = { s: ENEMIES[e.type].name + ' повержен! Портал наружу открыт', t: S.t }; for (const o of LOOT.boss) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), o.q, undefined, o) }); }
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
  const POT = { chest: 0.085, vase: 0.07, pot: 0.055, kill: 0.007 };
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
    const h = R.hero, b = BASES[it.b]; if (isCons(it) || !b || !b.slot || h.eq[b.slot]) return false;
    h.eq[b.slot] = it; ev(S, { k: 'equip', x: h.x, y: h.y, slot: b.slot, on: gearName(it) }); return true;
  }
  function useItem(S, R, idx) {
    const h = R.hero, it = h.bag[idx]; if (!it) return;
    if (it.b === 'hp_potion' || it.b === 'mp_potion') { usePotion(S, R, it.b); return; }
    if (it.b === 'scroll') { const m = R.map, fx = h.x, fy = h.y; h.x = m.spawn.x; h.y = m.spawn.y; if (--it.n <= 0) h.bag[idx] = null; ev(S, { k: 'teleport', x: h.x, y: h.y, fx, fy }); return; }
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
    if (id === 'whirl') { h.whirlT = S.t; h.whirlA = h.aim; const dmgK = AR.k;
      const wr = AR.r; for (const e of R.en) { if (e.deadT >= 0) continue; const d = Math.hypot(e.x - h.x, (e.y - h.y) * 1.3); if (d < wr + ENEMIES[e.type].r && losClear(R.map, h.x, h.y, e.x, e.y)) { const c = rnd(R) * 100 < st.crit; hitEnemy(S, R, e, Math.round(st.atk * dmgK * (c ? 1.75 : 1)), c, h.x, h.y, 1.6); } }
      breakPots(S, R, h.x, h.y, wr); hitProps(S, R, h.x, h.y, wr); hitChests(S, R, h.x, h.y, wr); hitSecrets(S, R, h.x, h.y, wr); hitDoors(S, R, h.x, h.y, wr); tearWebs(S, R, h.x, h.y, wr); ev(S, { k: 'whirl', x: h.x, y: h.y, a: h.aim, r: wr, rar: h.eq.weapon ? h.eq.weapon.rar : 0 }); }
    if (id === 'fireball') { const [hx, hy] = hand(h), a = h.aim, dmg = D.fireDmg(st.int, AR.k, st.spell, dep(R));
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
  function hitProps(S, R, x, y, rad, ax, arc, bonesOnly = false) {
    const m = R.map, hit = R.propHit || (R.propHit = {});
    // things on a wall are struck at their foot on the floor (the wall cell blocks the line), the event stays at the thing
    const knock = (id, p, n, mat = D.PROP_MAT[n] || 'stone', foot = p) => { const dx = foot.x - x, dy = foot.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 18) return false; if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) return false; if (!losClear(m, x, y, foot.x, foot.y)) return false;
      if (S.t - (hit[id] ?? -9) < 0.2) return false; hit[id] = S.t;
      if (mat === 'stone' || mat === 'metal') R.trauma = Math.min(1, R.trauma + 0.06);
      if (n !== 'merchant') ev(S, { k: 'prop', x: p.x, y: p.y, i: id, n, mat, s: dx >= 0 ? 1 : -1 }); return true; };
    m.decor.forEach((d, i) => { if (hidden(m, d)) return;
      if (d.n === 'bones') knock('d' + i, d, d.n);
      else if (bonesOnly) return;
      else if (d.n === 'candles' && !d.lift && (d.outUntil || 0) <= S.t) {
        if (knock('d' + i, d, d.n, 'wax')) { d.outUntil = S.t + 3; ev(S, { k: 'snuff', x: d.x, y: d.y }); } }
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
    return { total: f.lootN, got: f.loot, lying, boxed, list: items.concat(chests), stuck: items.concat(chests).filter((o) => o.at === 'stuck').length, off: f.lootN - f.loot - lying - boxed }; }
  // a blow tears the webs in its reach (the feet of the hero's own web too), fire burns them
  function tearWebs(S, R, x, y, rad, ax, arc, fire) {
    for (const egg of R.eggs || []) if (egg.hp > 0 && Math.hypot(egg.x - x, egg.y - y) < rad + 15 && (!arc || Math.abs(angDiff(Math.atan2(egg.y - y, egg.x - x), ax)) < arc / 2) && losClear(R.map, x, y, egg.x, egg.y)) {
      egg.hp = 0; ev(S, { k: 'webburn', x: egg.x, y: egg.y });
    }

    (R.map.webs || []).forEach((w, i) => { if (w.torn) return; const dx = w.x - x, dy = w.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 20 * w.s) return; if (arc !== undefined && d > 24 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.35) return;
      w.torn = 1; w.tornT = S.t; ev(S, { k: fire ? 'webburn' : 'webtear', x: w.x, y: w.y, i }); }); }
  // an ambush's flagstone sinks under the hero and calls monsters of the floor out of the dark round the room, in a ring, at once
  // on the hunt; they pay their XP but carry nothing (like a summoner's), and nothing of the floor's completion hangs on them
  function springAmbush(S, R, P) {
    const m = R.map, h = R.hero, f = dep(R), roster = D.BIOMES[m.biome].roster.filter((t) => t !== 'brute' || f >= 3), r = m.rooms[P.room]; P.downT = S.t; P.fired = 1;
    ev(S, { k: 'click', x: P.x, y: P.y }); ev(S, { k: 'ambush', x: h.x, y: h.y });
    const sc = BAL.hp * dif(R, 'hp') * (1 + 0.5 * (f - 1)), dc = BAL.dmg * 1.35 * D.dmgAt(f);
    for (let i = 0, n = 0; i < 40 && n < P.n; i++) { const a = rnd(R) * 6.28, d = 130 + rnd(R) * 90, x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d * 0.8;
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (!r || tx < r.x || ty < r.y || tx >= r.x + r.w || ty >= r.y + r.h || solidAt(m, x, y, true) || (m.block || []).includes(ty * m.W + tx)) continue;
      const type = pick(R, roster), E = ENEMIES[type], hp = Math.round(E.hp * sc);
      R.en.push({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp, max: hp, dmg: E.dmg * dc, elite: 0, room: P.room, st: 'chase', t0: S.t, face: x < h.x ? 1 : -1, aimA: 0,
        cdT: S.t + 0.8, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: 'amb', spawnT: S.t, seenT: S.t, hx: x, hy: y, ft: -9 });
      ev(S, { k: 'summon', x, y }); n++; }
    R.trauma = Math.min(1, R.trauma + 0.3); R.msg = { s: 'Засада!', t: S.t, d: 2, room: P.room };
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
    c.open = 1; c.openT = S.t; ev(S, { k: 'chest', x: c.x, y: c.y, tier: c.tier });
    // its items were rolled on entering the floor (they count toward the floor's loot from the start); a chest from an older save rolls now
    const pre = !!c.loot; for (const it of c.loot || chestLoot(R, c)) drop(R, c.x, c.y + 10, { kind: 'item', item: it, pre });
    c.loot = [];
    if (c.key !== undefined) drop(R, c.x, c.y + 10, { kind: 'key', lock: c.key });
    drop(R, c.x, c.y + 10, { kind: 'gold', n: Math.round((10 + dep(R) * 6 + ri(R, 0, 10)) * c.tier) });
  }
  function chestLoot(R, c) { const LT = LOOT.chest[c.tier], out = [];
    for (let i = 0; i < LT.n; i++) out.push(rollItem(R, dep(R), i ? LT.q * 0.8 : LT.q));
    if (rnd(R) < POT.chest) out.push(potion('hp_potion')); if (rnd(R) < 0.25) out.push(potion('scroll'));
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
    const spd = K.RUN * (1 + st.mspd / 100) * (t - h.atkT < 0.2 ? 0.55 : 1) * (inWater(m, h) ? WADE : 1) * (webAt(m, h) ? WEB.k : 1);
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
    if (keys.Space && h.cd.dash <= t) { const dx = ix || Math.cos(h.aim), dy = ix || iy ? iy : Math.sin(h.aim), d = Math.hypot(dx, dy) || 1;
      h.dashT = t; h.dashX = dx / d; h.dashY = dy / d; h.cd.dash = t + K.DASH_CD; ev(S, { k: 'dash', x: h.x, y: h.y, dx: h.dashX, dy: h.dashY }); }
    // a dash is a leap: spikes under it never bite, and one that would come down on a plate carries on until it is clear of it
    const onSpikes = m.traps.some((tr) => onPlate(h, tr)), leap = t - h.dashT < K.DASH_T;
    if (leap && onSpikes) h.leapT = h.dashT; else if (!onSpikes) h.leapT = -9;
    const dashing = leap || (h.leapT === h.dashT && t - h.dashT < K.DASH_T + K.LEAP);
    const mvx = dashing ? h.dashX * K.DASH : h.vx, mvy = dashing ? h.dashY * K.DASH : h.vy;
    const ox = h.x, oy = h.y; const [bx, by] = move(m, h, mvx * DT, mvy * DT, K.R); if (bx) h.vx = 0; if (by) h.vy = 0;
    shove(m, h, K.R, false, solids(R));
    { const w = webAt(m, h); if (w && h.web !== m.webs.indexOf(w)) ev(S, { k: 'web', x: w.x, y: w.y, i: m.webs.indexOf(w) }); h.web = w ? m.webs.indexOf(w) : -1; }
    const moved = Math.hypot(h.x - ox, h.y - oy);
    if (moved > 0.02 && dashing) hitProps(S, R, h.x, h.y, K.R, undefined, undefined, true);
    if (moved > 0.02 && !dashing) { const b = Math.floor(h.gp / Math.PI); h.dist += moved; h.gp = (h.gp || 0) + moved / stepLen(Math.abs(h.x - ox) / moved) * Math.PI; if (Math.floor(h.gp / Math.PI) !== b) ev(S, { k: 'step', x: h.x, y: h.y, wet: inWater(m, h) }); }
    // ---- melee: hold LMB ----
    if (inp.press && h.cd.atk <= t) {
      h.patkT = h.atkT; h.patkA = h.atkA; h.atkT = t; h.atkA = h.aim; h.atkHit = 0; h.atkN++; h.cd.atk = t + st.wcd / (1 + st.aspd / 100); if (h.face !== (h.face = Math.cos(h.aim) >= 0 ? 1 : -1)) h.faceT = t;
      ev(S, { k: 'swing', x: h.x, y: h.y, a: h.aim, n: h.atkN, f: h.face });
    }
    if (h.atkT >= 0 && !h.atkHit && t - h.atkT >= K.HIT) {     // the damage frame: the blade crosses the aim (scene.js swingPose)
      h.atkHit = 1; const arc = st.arc * Math.PI / 180, reach = st.reach;
      for (const e of R.en) { if (e.deadT >= 0) continue; const E = ENEMIES[e.type], dx = e.x - h.x, dy = (e.y - h.y) * 1.25, d = Math.hypot(dx, dy);
        if (d > reach + E.r + K.R) continue; if (d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), h.atkA)) > arc / 2) continue; if (!losClear(m, h.x, h.y, e.x, e.y)) continue;
        const c = rnd(R) * 100 < st.crit; hitEnemy(S, R, e, Math.max(1, Math.round(st.atk * (0.9 + 0.2 * rnd(R)) * (c ? 1.75 : 1) * (h.bless ? 1.2 : 1))), c, h.x, h.y, st.kb); }
      breakPots(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitProps(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitChests(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitSecrets(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitDoors(S, R, h.x, h.y, reach + 10, h.atkA, arc); tearWebs(S, R, h.x, h.y, reach + 10, h.atkA, arc);
    }
    // ---- abilities / potions / interact ----
    if (inp.slot >= 1 && inp.slot <= 3) castAbility(S, R, ABILITIES[inp.slot - 1].id, inp);
    if (inp.rclick) castAbility(S, R, 'fireball', inp);
    if (keys.KeyQ) usePotion(S, R, 'hp_potion');
    if (keys.KeyR) usePotion(S, R, 'mp_potion');
    if (keys.KeyE) interact(S, R);
    // a loose flagstone sinks under the hero's step
    for (const q of m.secrets || []) if (!q.open && q.trig && q.trig.k === 'plate' && Math.abs(h.x - q.trig.x) < 13 && Math.abs(h.y - q.trig.y) < 13) { q.trig.downT = t; ev(S, { k: 'click', x: q.trig.x, y: q.trig.y }); openSecret(S, R, q); }
    for (const P of m.ambush || []) if (!P.fired && Math.abs(h.x - P.x) < 13 && Math.abs(h.y - P.y) < 13) springAmbush(S, R, P);
    // ---- status ----
    const rIn = reveal(R);
    if (R.msg && R.msg.room !== undefined && rIn !== R.msg.room && !R.msg.outT) R.msg.outT = t;   // a room's alarm is about that room only
    if (m.shop) { const d = Math.hypot(h.x - m.shop.x, h.y - m.shop.y); if (d < 230 && R.shop.away) { R.shop.away = 0; R.shop.greetT = t; } else if (d > 360) R.shop.away = 1; }
    if (rIn === m.start) h.mp = Math.min(st.maxMp, h.mp + st.maxMp * 0.08 * DT);
    if (st.regen && h.hp > 0) h.hp = Math.min(st.maxHp, h.hp + st.regen * DT);
    h.mp = Math.min(st.maxMp, h.mp + (1.2 + st.int * 0.12) * DT);
    // the poison's drain is reported every half second like the burn's, so the balance tools and the death screen see it (TASKS 227)
    if (h.poison > t) { const n = 2.5 * st.resist * DT; h.hp -= n; if (h.hp <= 1) h.hp = 1; if (R.log) add(logFloor(R).dmg, 'poison', n);
      h.poisonAcc = (h.poisonAcc || 0) + n; if (t - (h.poisonT ?? -9) >= 0.5) { h.poisonT = t; const k = Math.round(h.poisonAcc); if (k > 0) { h.poisonAcc -= k; ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n: k, src: 'poison' }); } } }
    // a fire hex sets the hero alight: a tick every 0.5 s for 3 s, past the invulnerability window like poison, never the killing blow
    if (h.burn > t && t - (h.burnT ?? -9) >= 0.5) { h.burnT = t; const n = Math.max(1, Math.round((1.5 + 0.3 * dep(R)) * st.resist * dif(R, 'dmg'))); h.hp = Math.max(1, h.hp - n); ev(S, { k: 'scorch', x: h.x, y: h.y }); ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n, src: 'burn' }); }
    if (h.shield > 0 && t > h.shieldUntil) h.shield = 0;
    // spikes: up for 0.7 s of every 2.4 s; a plate is 2×2 cells, feet a little inside its edge count
    for (const tr of m.traps) { const ph = ((t / 2.4 + tr.ph) % 1 + 1) % 1, up = ph < 0.29;
      if (up && onPlate(h, tr) && !dashing && t - h.spikeT > 0.7) { h.spikeT = t; hurtHero(S, R, heroSt(S).maxHp * BAL.spike, h.x, h.y - 20, 'spike'); ev(S, { k: 'spike', x: tr.x, y: tr.y }); }
      // the spikes don't care whose feet are on them: lure or knock monsters onto a plate
      if (up) for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && onPlate(e, tr) && t - (e.spikeT ?? -9) > 0.7) {
        e.spikeT = t; hitEnemy(S, R, e, Math.round(9 * (1 + 0.2 * (dep(R) - 1))), false, tr.x, tr.y, 0, 'spike'); ev(S, { k: 'spike', x: tr.x, y: tr.y }); } }
    // water puts the fire out
    if (h.burn > t && inWater(m, h)) { h.burn = 0; ev(S, { k: 'douse', x: h.x, y: h.y }); }
    for (const e of R.en) if (e.deadT < 0 && e.burn > t && !ENEMIES[e.type].ghost && inWater(m, e)) { e.burn = 0; ev(S, { k: 'douse', x: e.x, y: e.y }); }
    // lava burns whoever stands in it, every half second
    const lavaDmg = 8 * (1 + 0.2 * (dep(R) - 1));
    if (onLava(m, h) && t - (h.lavaT ?? -9) >= 0.5) { h.lavaT = t; hurtHero(S, R, lavaDmg * st.resist, h.x, h.y, undefined, 'lava'); ev(S, { k: 'scorch', x: h.x, y: h.y }); }
    for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && onLava(m, e) && t - (e.lavaT ?? -9) >= 0.5) {
      e.lavaT = t; hitEnemy(S, R, e, Math.round(lavaDmg * 1.25), false, e.x, e.y, 0, 'fire'); ev(S, { k: 'scorch', x: e.x, y: e.y }); }
    stepProjectiles(S, R);
    stepMonsters(S, R, 1);
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
  const solids = (R) => { const out = []; for (const c of R.chests) out.push({ x: c.x, y: c.y, r: 16 }); for (const p of R.pots) if (p.hp > 0) out.push({ x: p.x, y: p.y, r: 11 });
    for (const t2 of R.map.torches) if (t2.kind !== 'wall') out.push({ x: t2.x, y: t2.y, r: t2.kind === 'fire' ? 20 : 12 }); for (const s of R.shrines) out.push({ x: s.x, y: s.y, r: 18 }); for (const d of R.map.decor) if (d.solid) out.push({ x: d.x, y: d.y, r: 18 });
    for (const q of R.map.waterFeatures || []) if (q.kind === 'fountain') out.push({ x: q.x, y: q.y - 2, r: 34 });
    if (R.map.shop) for (const [x, y] of R.map.shop.solid) out.push({ x, y, r: 18 }); return out; };
  function interact(S, R) {
    const h = R.hero, m = R.map;
    const sq0 = secretUnder(R), c = R.chests.find((c2) => !c2.open && Math.hypot(c2.x - h.x, c2.y - h.y) < (sq0 ? 30 : 56)); if (c) { openChest(S, R, c); return; }
    if (atCounter(R)) { openShop(S, R); return; }
    const sh = R.shrines.find((s) => !s.used && Math.hypot(s.x - h.x, s.y - h.y) < 60);
    if (sh && !arenaSealed(R)) { openAltar(S, R, sh); return; }
    const sq = sq0; if (sq) { if (sq.trig) ev(S, { k: 'click', x: h.x, y: h.y }); openSecret(S, R, sq); return; }
    const lv = leverNear(R); if (lv) { pullLever(S, R, lv); return; }
    const dr = doorNear(R, 64); if (dr) { openDoor(S, R, dr, 0); return; }
    if (Math.hypot(m.exit.x - h.x, m.exit.y - h.y) < 60) {
      if (arenaSealed(R)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Сначала одолейте босса главы' }); return; }
      if (lastFloor(R) && R.mode !== 'endless') { if (R.bossDead) { endRun(S, 'win'); } else ev(S, { k: 'nope', x: h.x, y: h.y, s: RUN(R).seal }); return; }
      ev(S, { k: 'stairs', x: h.x, y: h.y, floor: R.floor }); enterFloor(S, R, R.floor + 1); return; }
    const used = R.shrines.find((s) => s.used && Math.hypot(s.x - h.x, s.y - h.y) < 60);
    if (used && canDonate(R)) openAltar(S, R, used);
  }
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
  function stockShop(R, f) {
    const goods = [], SH = D.SHOP;
    for (let i = 0; i < SH.gear(f); i++) { let it = rollItem(R, f, SH.q(f), i === 0 ? 'weapon' : undefined);
      for (let k = 0; i === 0 && it.rar < SH.best(f) && k < 60; k++) it = rollItem(R, f, SH.q(f) + 1, 'weapon');
      it.id = R.nextId++; goods.push({ it, price: D.itemPrice(it, f) }); }
    for (const [b, n] of SH.cons(f)) goods.push({ it: Object.assign(potion(b, 1), { id: R.nextId++ }), price: D.itemPrice({ b }, f), n });
    return { goods, back: [], greetT: -9, tradeT: -9, away: 1, line: 0 };
  }
  const atCounter = (R) => { const s = R.map.shop, h = R.hero; return !!s && Math.abs(h.x - s.front.x) < 64 && h.y > s.counter.y - 4 && h.y - s.front.y < 40; };
  function openShop(S, R) { S.screen = 'shop'; R.shop.line = Math.floor(rnd(R) * D.SHOP.lines.length); R.shop.tradeT = S.t; S.hover = ''; ev(S, { k: 'shop', x: R.map.shop.x, y: R.map.shop.y }); }
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
    const n = isCons(it) ? 1 : 0, price = D.sellPrice(it, dep(R)), one = n && it.n > 1 ? Object.assign({}, it, { id: R.nextId++, n: 1 }) : it;
    if (n && it.n > 1) it.n--; else h.bag[i] = null;
    h.gold += price; sh.tradeT = S.t; sh.back.push({ it: one, price }); if (sh.back.length > D.SHOP.buyback) sh.back.shift();
    ev(S, { k: 'trade', x: R.map.shop.x, y: R.map.shop.y, n: price, s: 'Продано: ' + itemName(one), rar: one.rar });
  }

  function stepProjectiles(S, R) {
    const m = R.map, h = R.hero;
    for (const p of R.proj) { if (p.dead) continue;
      const cx = Math.floor(p.x / TILE), cy = Math.floor((p.y + 20) / TILE);
      p.x += p.vx * DT; p.y += p.vy * DT; const age = S.t - p.t0;
      const pc = cell(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)), wall = pc === 0 || pc === 4 || pc === 5 || pinch(m, cx, cy, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE));
      if (pc === 4 && p.own === 'hero') { const q = secretAt(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)); if (q && kindOf(q) === 'crack') hitSecret(S, R, q); }
      if (pc === 5 && p.own === 'hero') { const d = doorAt(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)); if (d) openDoor(S, R, d, 1); }
      let boom = wall || age > p.life || m.decor.some((d) => d.cover && !d.broken && Math.abs(p.x - d.x) < 26 && p.y > d.y - 75 && p.y < d.y + 8);
      if (p.own === 'hero') { for (const e of R.en) if (e.deadT < 0 && Math.hypot(e.x - p.x, e.y - ENEMIES[e.type].h * 0.45 - p.y) < ENEMIES[e.type].r + p.r + 6) { boom = true; break; } }
      else if (h.deadT < 0 && Math.hypot(h.x - p.x, h.y - 38 - p.y) < 20) { if (!p.spent) hurtHero(S, R, p.dmg, p.x, p.y, p.k, (p.who || '?') + ' снаряд', R.en.find((o) => o.id === (p.src || p.actorId))); if (p.vol) { R.volHit = p.vol; for (const q of R.proj) if (q.vol === p.vol) q.spent = 1; } struck(S, R, p.src && R.en.find((o) => o.id === p.src)); boom = true; p.onHero = 1; }
      if (boom) { p.dead = 1;
        // the blast spreads from the last open cell: the one it flew into may be the wall itself
        if (p.own === 'hero') { const bx = p.x - p.vx * DT, by = p.y + 20 - p.vy * DT;
          for (const e of R.en) if (e.deadT < 0 && Math.hypot(e.x - p.x, (e.y - ENEMIES[e.type].h * 0.4 - p.y) * 1.2) < 66 + ENEMIES[e.type].r && losClear(m, bx, by, e.x, e.y)) hitEnemy(S, R, e, p.dmg, false, p.x, p.y, 1.2, 'fire');
          breakPots(S, R, bx, by, 50); hitProps(S, R, bx, by, 50); tearWebs(S, R, bx, by - 20, 66, undefined, undefined, 1); ev(S, { k: 'boom', x: p.x, y: p.y, gx: bx, gy: by }); R.trauma = Math.min(1, R.trauma + 0.2); }
        else ev(S, { k: 'pop', x: p.x, y: p.y, c: p.k, hero: p.onHero || 0 }); } }
    R.proj = R.proj.filter((p) => !p.dead);
  }
  function stepMonsters(S, R, live) {
    const m = R.map, h = R.hero, t = S.t, htx = Math.floor(h.x / TILE), hty = Math.floor(h.y / TILE), F = flow(m, htx, hty), heroOk = live && h.deadT < 0;
    for (const e of R.en) {
      const E = ENEMIES[e.type];
      if (e.deadT >= 0) { if (e.fuse && t >= e.fuse) blast(S, R, e); continue; }
      if (e.burn > t && t - e.burnT >= 0.5) { e.burnT = t; hitEnemy(S, R, e, Math.max(1, Math.round(2 + dep(R))), false, e.x, e.y, 0, 'burn'); if (e.deadT >= 0) continue; }
      // knockback decays
      if (e.kbx || e.kby) { move(m, e, e.kbx * DT, e.kby * DT, E.r, true, !E.ghost); e.kbx *= Math.exp(-10 * DT); e.kby *= Math.exp(-10 * DT); if (Math.abs(e.kbx) + Math.abs(e.kby) < 4) e.kbx = e.kby = 0; }
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy);
      if (e.face !== e.pf) { if (e.pf) e.ft = t; e.pf = e.face; }
      if (e.st === 'idle' || e.st === 'home') {
        if (heroOk && (!D.BOSSES[e.type] || !m.bossType || R.arena) && !(e.calmT > t) && d < 330 && (DG.roomAt(m, h.x, h.y) === e.room || d < 170) && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) { aggroRoom(R, e); ev(S, { k: 'alert', x: e.x, y: e.y - E.h - 8, id: e.id }); if (e.type === 'boss') roar(S, R, e); }
        else { if (e.st === 'idle') idle(m, e, E, t); else goHome(m, e, E, t); continue; } }
      if (!heroOk) { e.vx = e.vy = 0; continue; }
      // a committed attack keeps facing its aim: a lunge that carries past the hero must not mirror mid-strike; a hero straight above or below doesn't flip it every frame
      e.face = e.st === 'wind' || e.st === 'strike' || e.st === 'bwind' ? (Math.cos(e.aimA) >= 0 ? 1 : -1) : Math.abs(dx) > 10 ? (dx > 0 ? 1 : -1) : e.face;
      // a hero out of sight for 4 s is lost: the monster walks back to its post
      if (e.st === 'chase' && E.kind !== 'boss' && e.hx !== undefined) {
        if (d < 420 && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) e.seenT = t;
        else if (t - e.seenT > 4) { e.st = 'home'; e.t0 = t; continue; }
        // under two cells of headway along the path in 2.5 s while short of the fight and the hero holds still (a corridor jammed by its own kind,
        // a wall in the way): it walks back to its post and stays deaf to the sight of the hero for a while, or it would turn round
        // at once and jam the corridor again. A hero on the move resets it: a chase is not a jam
        const near = d < (E.kind === 'caster' ? 300 : E.r + K.R + E.reach + 40), fv = F[Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE)], pd = fv >= 0 ? fv : d / TILE;
        if (near || e.stuckK !== e.t0 || pd <= e.aF - 2 || Math.hypot(h.x - e.ax, h.y - e.ay) > 48) { e.stuckK = e.t0; e.aF = pd; e.ax = h.x; e.ay = h.y; e.aT = t; }
        else if (t - e.aT > 2.5) { e.st = 'home'; e.t0 = t; e.calmT = t + 4; continue; } }
      if (e.st === 'chase' && has(e, 'summoner')) { if (e.sumT === undefined) e.sumT = t + 2; if (t >= e.sumT) { e.sumT = t + MOD.summoner.every; raise(S, R, e); } }
      if (e.st === 'chase') {
        const reach = E.r + K.R + E.reach;
        if (E.kind === 'boss') { bossThink(S, R, e, d); continue; }
        if (E.kind === 'caster') { const los = losClear(m, e.x, e.y - 20, h.x, h.y - 20);
          if (d < 360 && los && t >= e.cdT) { e.st = 'wind'; e.t0 = t; e.aimA = Math.atan2(h.y - 38 - (e.y - 44), h.x - e.x); continue; }
          const want = d < 170 ? -1 : d > 280 || !los ? 1 : 0; steer(e, E, m, F, want, dx, dy, d); }
        else if (d < reach && t >= e.cdT) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = Math.atan2(dy, dx); continue; }
        else steer(e, E, m, F, d < Math.max(reach * 0.8, E.r + K.R + 6) ? 0 : 1, dx, dy, d);
        move(m, e, e.vx * DT, e.vy * DT, E.r, true);
        const sp = Math.hypot(e.vx, e.vy); e.dist += sp * DT;
      } else if (e.st === 'wind') {
        skid(m, e, E); const w = E.wind * eliteK(e, 'wind');
        if (t - e.t0 >= w) { e.st = 'strike'; e.t0 = t;
          if (E.kind === 'caster') { const a = e.aimA, fire = R.map.biome === 'lava' || has(e, 'fiery'); R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: fire ? 'fire' : 'hex', x: e.x + Math.cos(a) * 18, y: e.y - 44, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, t0: t, life: 2.2, dmg: e.dmg * (fire ? 1.25 : 1) * eliteK(e, 'bolt'), own: 'en', r: 6 });
            ev(S, { k: "eshoot", x: e.x, y: e.y - 44, id: e.id }); }
          else if (E.kind === 'slam') { if (d < 74 + K.R && losClear(m, e.x, e.y, h.x, h.y)) { hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } ev(S, { k: 'slam', x: e.x + e.face * 26, y: e.y, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.4); }
          else if (E.kind === 'melee') { const ad = Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)); if (d < E.r + K.R + E.reach * 1.25 && ad < 1.3 && losClear(m, e.x, e.y, h.x, h.y)) { hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } ev(S, { k: 'eswing', x: e.x, y: e.y, a: e.aimA, id: e.id }); } }
      } else if (e.st === 'strike') {
        // the lunge stops on contact and springs back for 0.1 s: carried on, the spider passed through the hero to land behind him
        if (E.kind === 'lunge' && t - e.t0 < 0.24) { const a = e.aimA; if (!(e.bncT > e.t0) && d <= E.r + K.R + 6.01) e.bncT = t;
          const v = e.bncT > e.t0 ? (t - e.bncT < 0.1 ? -150 : 0) : 330 * Math.min(1, (t - e.t0) / 0.05); { e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += v * DT;
            if (!e.hitDone && d < E.r + K.R + 8) { e.hitDone = 1; hurtHero(S, R, e.dmg, e.x, e.y, 'poison', who(e), e); struck(S, R, e); } } } else skid(m, e, E);
        if (t - e.t0 > (E.kind === 'lunge' ? 0.45 : 0.32)) { e.st = 'chase'; e.cdT = t + E.cd * (e.elite && !D.BOSSES[e.type] && e.type !== 'brute' && dep(R) <= BAL.early ? BAL.earlyCd : eliteK(e, 'cd')) * (0.8 + 0.4 * rnd(R)); e.hitDone = 0; }
      }
    }
    // separation: monsters don't stack
    const live2 = R.en.filter((e) => e.deadT < 0 && e.st !== 'idle');
    for (let i = 0; i < live2.length; i++) for (let j = i + 1; j < live2.length; j++) { const a = live2[i], b = live2[j], ra = ENEMIES[a.type].r + ENEMIES[b.type].r + 4;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < ra && d > 0.01) { const p = (ra - d) * 0.5; move(m, a, -dx / d * p, -dy / d * p, ENEMIES[a.type].r, true); move(m, b, dx / d * p, dy / d * p, ENEMIES[b.type].r, true); } }
    // whatever moved them (walking, knockback, a lunge, the crowd), monsters stand clear of props; a ghost floats through
    const sol = solids(R);
    for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost) shove(m, e, ENEMIES[e.type].r, true, sol);
    if (heroOk) for (const e of R.en) {
      const E = ENEMIES[e.type]; if (e.deadT >= 0 || !['melee', 'slam', 'lunge'].includes(E.kind)) continue;
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
    if (d < 8 || t - e.t0 > 25) { e.st = 'idle'; e.hx = e.x; e.hy = e.y; e.vx = e.vy = 0; return; }
    steer(e, E, m, homeFlow(m, Math.floor(e.hx / TILE), Math.floor(e.hy / TILE)), 1, dx, dy, d, 0.6);
    move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += Math.hypot(e.vx, e.vy) * DT;
    if (Math.abs(e.vx) > 6) e.face = e.vx > 0 ? 1 : -1;
  }
  // a monster that stops to attack skids to a halt instead of freezing mid-stride (the rig's gait reads its speed and distance)
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
      else if (d > 0) { vx = dx / d * want; vy = dy / d * want; }
    }
    const sp = E.spd * eliteK(e, 'spd') * kv * (!E.ghost && inWater(m, e) ? WADE : 1) * (!E.ghost && !E.webImmune && webAt(m, e) ? WEB.mon : 1), k = 1 - Math.exp(-9 * DT);
    e.vx += (vx * sp - e.vx) * k; e.vy += (vy * sp - e.vy) * k;
  }
  function holdClocks(R) {
    for (const e of R.en) { if (e.deadT >= 0) continue;
      if (e.st === 'wind' || e.st === 'bwind' || e.st === 'strike') { e.t0 += DT; if (e.bncT > 0) e.bncT += DT; } }
    for (const p of R.proj) p.t0 += DT;
    for (const q of R.lavaPending || []) { q.t += DT; if (q.t0 !== undefined) q.t0 += DT; }
    for (const egg of R.eggs || []) egg.hatchT += DT;
  }
  const arenaSealed = (R) => !!(R.map.bossType && R.en.some((e) => D.BOSSES[e.type] && e.deadT < 0));
  function stepArena(S, R) {
    const m = R.map, b = R.en.find((e) => D.BOSSES[e.type] && e.deadT < 0), h = R.hero;
    if (b && m.bossType && !R.arena) { const r = m.rooms[b.room], pad = K.R + 4;
      if (h.x > r.x * TILE + pad && h.x < (r.x + r.w) * TILE - pad && h.y > r.y * TILE + pad && h.y < (r.y + r.h) * TILE - pad) {
        R.arena = { active: 1, room: b.room, t0: S.t }; b.st = 'chase'; b.cdT = S.t + 1; b.seenT = S.t;
        for (const d of m.doors) if (d.arena) { d.open = 0; d.openT = -9; for (const [x, y] of d.cells) m.cells[y * m.W + x] = 5; }
        R.msg = { s: ENEMIES[b.type].name, t: S.t, d: 3 }; roar(S, R, b);
      }
    }
    for (const q of R.lavaPending || []) if (S.t >= q.t && m.cells[q.cell] === 1) { m.cells[q.cell] = 3; m.arenaLava = m.arenaLava || []; m.arenaLava.push(q.cell); m.lava++; m.geometry = (m.geometry || 0) + 1; }
    R.lavaPending = (R.lavaPending || []).filter((q) => S.t < q.t);
    for (const egg of R.eggs || []) if (egg.hp > 0 && S.t >= egg.hatchT) { egg.hp = 0;
      const owner = R.en.find((e) => e.id === egg.owner && e.deadT < 0); if (owner) bossSummon(S, R, Object.assign({}, owner, { x: egg.x, y: egg.y }), Object.assign({}, D.BOSSES[owner.type].moves.eggs, { n: 1, r: 0 }));
    }
  }
  function finishArena(S, R, e) {
    if (R.arena) R.arena.active = 0;
    for (const k of R.map.arenaLava || []) if (R.map.cells[k] === 3) { R.map.cells[k] = 1; R.map.lava--; }
    R.map.arenaLava = []; R.lavaPending = []; R.map.geometry = (R.map.geometry || 0) + 1;
    for (const d of R.map.doors || []) if (d.arena && !d.open) openDoor(S, R, d, 0);
    for (const o of R.en) if (o.summ === e.id && o.deadT < 0) { o.deadT = S.t; o.hp = 0; }
    for (const o of R.eggs || []) if (o.owner === e.id) o.hp = 0;
    if (!lastFloor(R)) { R.msg = { s: ENEMIES[e.type].name + ': победа! Алтарь и лестница открыты', t: S.t }; drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), 2) }); }
  }
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
    e.st = 'bwind'; e.t0 = S.t; e.mv = mv; e.fired = 0; e.hitDone = 0; e.chain = 0;
    const M = D.bossMove(e);
    e.tx = R.hero.x; e.ty = R.hero.y;
    e.aimA = Math.atan2(R.hero.y - (M.target || 0) - e.y + (M.origin || 0), R.hero.x - e.x); e.vx = e.vy = 0;
    e.travel = 0; e.targetD = Math.hypot(R.hero.x - e.x, R.hero.y - e.y);
    ev(S, { k: 'bossmove', id: e.id, mv, phase: e.phase });
  }
  function bossThink(S, R, e, d) {
    const t = S.t, m = R.map, h = R.hero, E = ENEMIES[e.type], P = D.bossPhase(e);
    if (t < e.cdT) { const F = flow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)); steer(e, E, m, F, d > E.reach ? 1 : 0, h.x - e.x, h.y - e.y, d);
      move(m, e, e.vx * DT * P.speed, e.vy * DT * P.speed, E.r, true); e.dist += Math.hypot(e.vx, e.vy) * DT * P.speed; return; }
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
      ev(S, { k: 'summon', x: p.x, y: p.y });
    }
  }
  function stepBossMove(S, R) {
    if (R.hero.deadT >= 0) return;
    for (const e of R.en) { if (!D.BOSSES[e.type] || e.deadT >= 0 || e.st === 'idle') continue;
      const t = S.t, h = R.hero, m = R.map, B = D.BOSSES[e.type];
      if (e.bossVersion !== 1) { e.st = 'chase'; e.cdT = t; e.phase = Math.max(0, B.phases.findLastIndex((p) => e.hp / e.max <= p.at)); e.moveI = 0; e.nextMove = null; e.bossVersion = 1; }
      if ((e.phase || 0) + 1 < B.phases.length && e.hp / e.max <= B.phases[(e.phase || 0) + 1].at && (!D.bossPhase(e).finishMove || (e.st !== 'bwind' && !e.nextMove))) {
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
        if (!e.hitDone && Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(m, e.x, e.y, h.x, h.y)) { e.hitDone = 1; hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e); }
        if (M.next && (e.hitDone || e.travel >= Math.max(0, e.targetD - M.stop) - 0.01 || moved < 0.01)) finished = true;
      }
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
      }
      if (finished) {
        e.nextMove = null;
        // the linked slam follows only a charge the hero got out of: a charge that landed ends the link, one mistake costs one blow
        // (the player's call, TASKS 227: the slam 0.28 s after a landed charge could not be escaped and took 12 of 14 finale deaths)
        if (M.next && !e.hitDone) { beginBossMove(S, R, e, M.next); e.t0 = t + (M.rest || 0); e.chain = 1; }
        else { e.st = 'chase'; e.fired = 0; e.hitDone = 0; e.cdT = t + (M.next ? D.bossPhase(e).rest : M.rest ?? D.bossPhase(e).rest); }
      }
    }
  }
  // the sprite boxes of the solid props (half width, height, standing on the prop's foot): an item that lies behind one (above its
  // foot, so the prop draws after it) inside its box cannot be seen, so it hops to the nearest open spot instead
  function propBoxes(R) { const m = R.map, out = [], add = (x, y, n, k = 1) => { if (D.PROP_W[n]) out.push([x, y, D.PROP_W[n] * k / 2, D.PROP_H[n] * k]); };
    for (const c of R.chests) add(c.x, c.y, 'chest', c.tier >= 2 ? 1.15 : 1); for (const p of R.pots) if (p.hp > 0) add(p.x, p.y, p.kind);
    for (const d of m.decor) if (d.solid && !d.wall) add(d.x, d.y, d.n); for (const t of m.torches) if (t.kind !== 'wall') add(t.x, t.y, 'brazier', t.kind === 'fire' ? 1.35 : 1);
    for (const s of R.shrines) add(s.x, s.y, 'altar');
    for (const q of m.waterFeatures || []) if (q.kind === 'fountain') out.push([q.x, q.y + 16, 46, 40]);
    // a shut door's leaf (scene.js) stands over the cells behind it: a bottom wall's over the room's last row, a top wall's arch over the corridor
    for (const d of m.doors || []) if (!d.open) { const side = d.dir === 'l' || d.dir === 'r';
      out.push(d.dir === 'u' ? [d.x, d.y, 58, 100] : side ? [d.x, d.y + TILE, 17, 103] : [d.x, d.y + TILE, 31, 80]); }
    return out; }
  const behindProp = (B, x, y) => B.some(([px, py, hw, h]) => Math.abs(x - px) < hw + 10 && y < py + 2 && y > py - h + 6);
  const DROP_REST = 3;   // bump when the resting rule changes: items saved under an older rule are checked again
  function settleDrop(R, p) { const m = R.map, hid = secretMask(m), k0 = Math.floor(p.y / TILE) * m.W + Math.floor(p.x / TILE); p.rest = DROP_REST;
    const B = propBoxes(R), blk = new Set(m.block), spot = (k) => [(k % m.W) * TILE + TILE / 2, Math.floor(k / m.W) * TILE + 20];
    // an item lying on another one hides it too: items keep their icons apart
    const items = p.kind === 'item' ? R.drops.filter((o) => o !== p && !o.got && o.kind === 'item' && o.rest === DROP_REST) : [];
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
        else if (p.kind === 'key') { R.keys = (R.keys || 0) + 1; p.got = 1; ev(S, { k: 'key', x: p.x, y: p.y }); R.msg = { s: 'Ключ! Он отпирает дверь на этом этаже', t: S.t }; }
        else if (wearIfFree(S, R, p.item)) { p.got = 1; if (p.loot) { fstat(R).loot++; checkFull(S, R); } ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item), worn: 1 }); }
        else if (bagAdd(R, p.item)) { p.got = 1; if (p.loot) { fstat(R).loot++; checkFull(S, R); } ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item) }); }
        else if (S.t - (R.fullT || -9) > 2.5) { R.fullT = S.t; ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Инвентарь полон' }); }
      } }
    R.drops = R.drops.filter((p) => !p.got);
  }

  // ---------------- run end / menus ----------------
  function endRun(S, how) {
    const R = S.run; if (!R) return;
    const W2 = runReward(R, how), bonus = W2.base + W2.bonus;
    S.meta.shards += bonus; S.meta.runs = (S.meta.runs || 0) + 1; if (how === 'win') S.meta.wins = (S.meta.wins || 0) + 1;
    if (RUN(R) === D.RUNS.campaign) S.meta.best = Math.max(S.meta.best || 0, R.floor);
    S.result = { how, mode: R.mode, floor: R.floor, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, shards: R.shards + bonus, found: R.shards, base: W2.base, statBonus: W2.bonus, cap: W2.cap,
      C: W2.C, win: how === 'win' ? REWARD.win : 0, time: R.play || 0, donations: R.donations || 0,
      damage: (R.recentDamage || []).slice(-3), abandoned: !!(R.log && R.log.abandon), hero: JSON.parse(JSON.stringify(R.hero)), heroStats: heroSt(S) };
    if (R.log) { R.log.end = { how: R.log.abandon ? 'abandon' : how, time: R.play || 0, floor: R.floor, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, cause: how === 'dead' ? R.log.last || null : null, bag: potCount(R.hero), tail: R.log.tail || [], done: R.stats || {}, pct: W2.C.pct };   // done: per floor kills/foes, loot/lootN, sec/secN
      S.result.log = R.log; S.logN = (S.logN || 0) + 1; }
    S.run = null; S.saved = null; S.screen = how; S.saveN++;
  }
  // a hero who starts above level 1 opens on the hero screen, his points still to lay out
  function startRun(S, mode = 'campaign') { const seed = (S.seedBase + S.meta.runs * 7777 + Math.floor(S.t * 1000)) >>> 0; S.run = newRun(S, mode, seed); S.saved = null;
    S.screen = S.run.hero.pts > 0 && RUN(S.run).lvl > 1 ? 'inv' : 'play'; }

  function stepUI(S, inp, keys) {
    const x = inp.px, y = inp.py, click = inp.click;
    if (S.screen === 'menu') {
      const arm = S.resetT !== undefined && S.t - S.resetT < 3 && S.resetM, b = D.hitUI(UI.menu(!!S.saved, S.meta.diff, arm, S.meta.zoom), x, y); S.hover = b ? b.id : '';
      if (click && b && b.on) {
        if (b.id === 'continue') { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; S.run.msg = { s: 'Этаж ' + S.run.floor + ' — ' + D.floorName(S.run.floor, S.run.mode), t: S.t }; }
        // a saved run is dropped only on a second press of the same run's button
        if (D.RUNS[b.id]) { if (!S.saved || arm === b.id) { S.resetT = undefined; startRun(S, b.id); } else { S.resetT = S.t; S.resetM = b.id; } }
        if (b.id === 'diff') { const o = D.DIFF_ORDER; S.meta.diff = o[(o.indexOf(S.meta.diff || 'normal') + 1) % o.length]; S.saveN++; }
        if (b.id === 'zoom') nextZoom(S);
        if (b.id === 'meta') S.screen = 'meta';
        ev(S, { k: 'ui', x, y });
      }
      if (keys.Enter) { if (S.saved) { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; } else startRun(S); }
      return;
    }
    if (S.screen === 'meta') {
      const bs = UI.meta(), b = D.hitUI(bs, x, y); S.hover = b ? b.id : '';
      if ((click && b && b.id === 'back') || keys.Escape) { S.screen = 'menu'; return; }
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
      const b = D.hitUI(UI.end(S.result && S.result.log), x, y); S.hover = b ? b.id : '';
      if (click && b && b.on) { if (b.id === 'log') { S.logReq = (S.logReq || 0) + 1; ev(S, { k: 'ui', x, y }); } else if (b.id === 'menu') S.screen = 'menu'; else startRun(S, (S.result && S.result.mode) || 'campaign'); }
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
  // level data checks for tune.cjs: every floor of several seeds — spawns on open floor and outside the start room, exit reachable
  function selfCheck() {
    const out = [];
    for (let lvl = 1; lvl <= 32; lvl++) for (const slot of D.SLOTS) {
      const bases = Object.keys(BASES).filter((b) => BASES[b].slot === slot);
      for (const b of bases) for (let rar = 0; rar < RARITY.length; rar++) {
        const it = itemPower({ b, lvl, rar, mods: {} }), next = itemPower({ b, lvl: lvl + 1, rar, mods: {} });
        for (const k of ['atk', 'def']) if (it[k]) {
          if (next[k] < it[k]) out.push(`${b} r${rar} lvl${lvl}: ${k} falls with level`);
          if (rar < RARITY.length - 1) for (const other of bases) {
            const higher = itemPower({ b: other, lvl, rar: rar + 1, mods: {} });
            if (higher[k] < it[k]) out.push(`${other} r${rar + 1} lvl${lvl}: ${k} below ${b} r${rar}`);
          }
        }
      }
    }
    for (const seed of [1, 77, 4242]) {
      const R = { rs: seed };
      for (let lvl = 1; lvl <= D.RUNS.campaign.floors; lvl++) for (let i = 0; i < 100; i++) {
        const it = rollItem(R, lvl, i % 4), expected = itemPower({ b: it.b, rar: it.rar, lvl, mods: {} });
        if (it.atk !== expected.atk || it.def !== expected.def) out.push(`seed ${seed} lvl${lvl}: rolled item has wrong power`);
        if (Object.keys(it.mods).length !== RARITY[it.rar].affixes) out.push(`seed ${seed} lvl${lvl}: wrong affix count`);
      }
    }
    {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 81), h = R.hero;
      const make = (b, lvl, rar, def) => ({ id: R.nextId++, b, lvl, rar, def, mods: { vit: 3 } });
      h.eq.armor = make('leather_armor', 8, 4, 11); h.bag[2] = make('plate_armor', 6, 3, 16);
      R.drops.push({ kind: 'item', item: make('cloak', 8, 4, 7) });
      R.shop.goods[0].it = make('knight_helm', 6, 3, 8); R.shop.back.push({ it: make('leather_helm', 8, 4, 2), price: 50 });
      delete R.itemBalance;
      const T = spawn(0, { run: JSON.parse(JSON.stringify(R)) }), saved = T.saved;
      const items = [saved.hero.eq.armor, saved.hero.bag[2], saved.drops.at(-1).item, saved.shop.goods[0].it, saved.shop.back[0].it];
      for (const it of items) {
        if (it.def !== itemPower({ b: it.b, lvl: it.lvl, rar: it.rar }).def || it.mods.vit !== 3) out.push('saved equipment was not rebalanced without changing affixes');
      }
      if (items[0].def <= items[1].def) out.push('legendary lvl8 leather armor still loses to epic lvl6 plate');
      const speed = typeMods(items[0]).mspd;
      if (!(speed > typeMods({ b: 'leather_armor', lvl: 1, rar: 0 }).mspd) || itemMods(items[0]).mspd !== speed || itemMods(items[0]).vit !== 3) out.push('item type bonuses missing or not scaled');
      const before = JSON.stringify(saved); rebalanceRun(saved);
      if (JSON.stringify(saved) !== before) out.push('item rebalance is not idempotent');
      const H = JSON.parse(JSON.stringify(saved.hero)); H.eq.armor = null;
      if (Math.abs(stats(saved.hero, S.meta).mspd - stats(H, S.meta).mspd - speed) > 1e-6) out.push('leather armor speed bonus not applied');
      S.run = R; S.screen = 'play'; step(S, { keys: [] });
      if (R.itemBalance !== D.ITEM_BAL.version || h.eq.armor.def !== items[0].def) out.push('live reload equipment was not rebalanced');
    }
    // the water caves' floors (TASKS 301) are held to the campaign's rules
    const GEN = [1, 77, 4242, 90001].flatMap((sd) => Array.from({ length: D.RUNS.campaign.floors }, (_, i) => ['campaign', sd, i + 1]))
      .concat([1, 77, 4242, 90001, 5, 12, 33, 2024].flatMap((sd) => Array.from({ length: D.RUNS.cave.floors }, (_, i) => ['cave', sd, i + 1])));
    const caveKinds = {};
    for (const [mode, sd, f] of GEN) { const seed = mode === 'campaign' ? sd : 'cave ' + sd, m = DG.genFloor(sd * 31 + f * 1013, f, { mode });
      const F = flow(m, Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE));
      const reachH = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return cell(m, tx, ty) === 1; };
      if (!reachH(m.spawn.x, m.spawn.y)) out.push(`seed ${seed} f${f}: spawn blocked`);
      for (const e of m.enemies) { if (!reachH(e.x, e.y)) out.push(`seed ${seed} f${f}: ${e.type} spawns in rock`); if (inStart(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) out.push(`seed ${seed} f${f}: ${e.type} in the start room`); }
      for (const c of m.chests) if (!reachH(c.x, c.y)) out.push(`seed ${seed} f${f}: chest in rock`);
      if (mode === 'campaign') {
        const wet = new Set(m.water), bridge = new Set(m.waterBridges);
        for (const k of wet) if (m.cells[k] !== 1 || !Number.isInteger(m.waterFlow[k]) || m.waterFlow[k] < 0 || m.waterFlow[k] > 3) out.push(`seed ${seed} f${f}: water off floor or without flow`);
        for (const k of bridge) if (m.cells[k] !== 1 || wet.has(k) || m.block.includes(k)) out.push(`seed ${seed} f${f}: water crossing is wet or blocked`);
        for (const o of [...m.chests, ...m.pots, ...m.enemies, ...m.decor.filter((d) => d.solid), ...m.torches.filter((q) => q.kind !== 'wall')]) {
          if (wet.has(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE))) out.push(`seed ${seed} f${f}: post or prop in stream`);
        }
        for (const q of m.waterFeatures) {
          const r = m.rooms[q.room];
          if (['start', 'shop', 'secret', 'boss'].includes(r.type)) out.push(`seed ${seed} f${f}: water in protected room`);
          {
            const path = new Set(q.cells), seen = new Set([q.source]), todo = [q.source];
            for (let i = 0; i < todo.length; i++) for (const d of [-1, 1, -m.W, m.W]) if (path.has(todo[i] + d) && !seen.has(todo[i] + d)) { seen.add(todo[i] + d); todo.push(todo[i] + d); }
            if (!seen.has(q.drain) || seen.size !== path.size || !q.bridge.length || q.width < 1 || q.width > 3) out.push(`seed ${seed} f${f}: stream or crossing disconnected`);
            if (cell(m, Math.floor(q.x / TILE), r.y - 1) !== 0) out.push(`seed ${seed} f${f}: spring not attached to wall`);
          }
        }
      }
      // the cave's water (TASKS 302): deep water (6) never meets dry floor, every deep pool has shallows on its shore, every floor
      // cell is reached on foot over shallows and crossings, the water keeps its share of the floor (secret caches left out), nothing
      // stands in it, a crossing lies over deep water, and every source is on a wall over its water
      if (mode === 'cave') { const W = m.W, wet = new Set(m.water), over = new Set(m.crossings.flatMap((c) => (c.kind === 'neck' ? [] : c.cells))), hid = new Set(m.secrets.flatMap((q) => q.hide));
        for (const r of m.rooms) if (r.type === 'secret') for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) hid.add(y * W + x);
        const D8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1], dry = (k) => m.cells[k] === 1 && !wet.has(k) && !over.has(k), deepAt = (k) => m.cells[k] === 6;
        let open = 0, nDeep = 0, bad = 0; const seenD = new Uint8Array(W * m.H);
        for (let k = 0; k < W * m.H; k++) { const c = m.cells[k]; if ((c === 1 || c === 6) && !hid.has(k)) open++; if (c !== 6) continue; nDeep++;
          if (D8.some((d) => dry(k + d)) && !bad++) out.push(`seed ${seed} f${f}: deep water on dry floor at ${k % W},${Math.floor(k / W)}`);
          if (seenD[k]) continue; const st = [k]; seenD[k] = 1; let shore = false;
          while (st.length) { const j = st.pop(); for (const d of D8) { const n = j + d; if (deepAt(n) && !seenD[n]) { seenD[n] = 1; st.push(n); } else if (wet.has(n)) shore = true; } }
          if (!shore) out.push(`seed ${seed} f${f}: deep water at ${k % W},${Math.floor(k / W)} without a shore of shallows`); }
        const share = (m.water.length + nDeep + over.size) / open;
        if (share < 0.15 || share > 0.35) out.push(`seed ${seed} f${f}: water is ${Math.round(share * 100)} % of the floor`);
        { const seen = new Uint8Array(W * m.H), s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), st = [s0]; seen[s0] = 1;
          while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && (m.cells[n] === 1 || m.cells[n] === 4)) { seen[n] = 1; st.push(n); } } }
          const cut = m.cells.findIndex((c, k) => c === 1 && !seen[k]); if (cut >= 0) out.push(`seed ${seed} f${f}: floor at ${cut % W},${Math.floor(cut / W)} cut off by water`);
          for (const r of m.rooms) if (!seen[r.cy * W + r.cx] && m.cells[r.cy * W + r.cx] === 1) out.push(`seed ${seed} f${f}: the ${r.type} hall ${r.id} cut off by water`); }
        const inW = (k) => wet.has(k) || over.has(k) || deepAt(k), cellOf = (o) => Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE);
        for (const [n, list] of [['monster', m.enemies], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((d) => !d.wall && !d.lift)], ['fire', m.torches.filter((q) => q.kind !== 'wall')], ['altar', m.shrines], ['web', m.webs], ['ambush', m.ambush]])
          for (const o of list) if (inW(cellOf(o))) out.push(`seed ${seed} f${f}: a ${n} in the water at ${Math.round(o.x)},${Math.round(o.y)}`);
        for (const tr of m.traps) for (const [i, j] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (inW((tr.y / TILE + j) * W + tr.x / TILE + i)) out.push(`seed ${seed} f${f}: a spike plate in the water`);
        for (const c of m.crossings) { caveKinds[c.kind] = (caveKinds[c.kind] || 0) + 1;
          if (c.cells.some((k) => m.cells[k] !== 1 || (c.kind !== 'neck' && wet.has(k)))) out.push(`seed ${seed} f${f}: a ${c.kind} off the floor or wading`);
          if (c.kind !== 'neck' && !c.cells.some((k) => [1, -1, W, -W].some((d) => deepAt(k + d)))) out.push(`seed ${seed} f${f}: a ${c.kind} over no deep water`); }
        for (const q of m.waterFeatures) { caveKinds[q.kind] = (caveKinds[q.kind] || 0) + 1; const back = { u: -W, d: W, l: -1, r: 1 }[q.dir];
          if (!['waterfall', 'breach', 'spring'].includes(q.kind) || !(wet.has(q.cell) || deepAt(q.cell) || over.has(q.cell)) || m.cells[q.cell + back] !== 0) out.push(`seed ${seed} f${f}: a ${q.kind} off its wall or its water`); }
        for (const k in m.waterFlow) if (!(wet.has(+k) || deepAt(+k)) || !(m.waterFlow[k] >= 0 && m.waterFlow[k] <= 3)) out.push(`seed ${seed} f${f}: a stream's flow off its water`);
        // the cave's dressing (TASKS 306): no solid prop cuts a way, lilies and weed grow in the water, moss hangs from a rock face
        { const blocked = new Set(m.block.concat(m.pots.map(cellOf))), seen = new Uint8Array(W * m.H), s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), st = [s0]; seen[s0] = 1;
          while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && (m.cells[n] === 1 || m.cells[n] === 4) && !blocked.has(n)) { seen[n] = 1; st.push(n); } } }
          // the space behind the merchant's counter is closed on purpose (the shop is one built piece)
          const sh = m.rooms.find((r) => r.type === 'shop'), inShop = (k) => sh && k % W >= sh.x && k % W < sh.x + sh.w && Math.floor(k / W) >= sh.y && Math.floor(k / W) < sh.y + sh.h;
          const cut = m.cells.findIndex((c, k) => c === 1 && !seen[k] && !blocked.has(k) && !inShop(k) && !hid.has(k)); if (cut >= 0) out.push(`seed ${seed} f${f}: floor at ${cut % W},${Math.floor(cut / W)} cut off by the props`); }
        for (const o of m.flora) { const k = cellOf(o), up = Math.floor(o.y / TILE - 1) * W + Math.floor(o.x / TILE);
          if (o.n === 'moss' ? m.cells[up] !== 0 : !inW(k)) out.push(`seed ${seed} f${f}: ${o.n} off its ${o.n === 'moss' ? 'rock face' : 'water'} at ${Math.round(o.x)},${Math.round(o.y)}`); } }
      // the fire depths (TASKS 186): two rivers at least, and nothing stands in lava or a cell from its shore
      if (D.BIOMES[m.biome].lava && f < D.RUNS.campaign.floors && (m.streams || []).filter((q) => q.kind === 'river' && q.n >= 8).length < 2) out.push(`seed ${seed} f${f}: fewer than two lava rivers`);
      { const shore = (o) => { const tx = Math.floor(o.x / TILE), ty = Math.floor((o.y - 1) / TILE); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, tx + i, ty + j) === 3) return true; return false; };
        for (const [k, list] of [['monster', m.enemies], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((d) => !d.wall && !d.lift)], ['brazier', m.torches.filter((t) => t.kind !== 'wall')]]) for (const o of list) if (shore(o)) out.push(`seed ${seed} f${f}: a ${k} by lava at ${Math.round(o.x)},${Math.round(o.y)}`); }
      // a secret's fake wall counts as broken: rock one cell thick between two floors would hang in the floor as a bare wall face (TASKS 178)
      for (let y = 1; y < m.H - 1; y++) for (let x = 0; x < m.W; x++) if (!cell(m, x, y) && cell(m, x, y - 1) && cell(m, x, y + 1)) out.push(`seed ${seed} f${f}: one-cell wall between floors at ${x},${y}`);
      // bulky props (chests, tables, coffins, statues…) read wider than their cell: two of them never share a cell edge or corner
      { const big = m.chests.map((c) => [c.x, c.y, 'chest']).concat(m.decor.filter((d) => (d.solid || d.n === 'table') && !d.wall).map((d) => [d.x, d.y, d.n]), m.torches.filter((t) => t.kind === 'brazier').map((t) => [t.x, t.y, 'brazier']), m.shrines.map((t) => [t.x, t.y, 'altar']),
          m.pots.map((p) => [p.x, p.y, p.kind, p.stack]));
        // the shop is one built piece: its shelves, sacks and barrel close the space behind the counter on purpose. Elsewhere no two
        // props draw over each other: in the same row or the next one, their drawn widths (PROP_W) never meet
        const w2 = (n) => (D.PROP_W[n] || 0) / 2;
        for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) { const [ax, ay, an, as] = big[i], [bx, by, bn, bs] = big[j]; if (an.startsWith('shop_') || bn.startsWith('shop_') || (as && as === bs)) continue;   // a corner stack of barrels and crates is one pile
          if (Math.abs(Math.floor(ay / TILE) - Math.floor(by / TILE)) <= 1 && Math.abs(ax - bx) < w2(an) + w2(bn) + 4) out.push(`seed ${seed} f${f}: ${an} draws over ${bn} at ${Math.round(ax)},${Math.round(ay)}`); }
        // nothing hung on a top wall (torch, sconce, banner, sign) hides behind a tall prop standing against that wall
        const hung = m.torches.filter((t) => t.kind === 'wall' && !t.side).map((t) => [t.x, Math.round((t.y + 26) / TILE), 14, t.lever !== undefined ? 'sconce' : 'torch'])
          .concat(m.decor.filter((d) => d.n === 'banner' || d.n === 'shop_sign').map((d) => [d.x, Math.round((d.y + (d.n === 'banner' ? 2 : 34)) / TILE), d.n === 'banner' ? 18 : 22, d.n]));
        for (const d of m.decor) { if (!d.solid || (d.y - 22) % TILE) continue; const ry = (d.y - 22) / TILE;
          for (const [hx, hy, hw, hn] of hung) if (hy === ry && Math.abs(hx - d.x) < hw + (D.PROP_W[d.n] || 53) / 2) out.push(`seed ${seed} f${f}: ${d.n} hides a ${hn} on the wall at ${Math.round(hx)},${hy * TILE}`); }
        for (const p of m.pots) { const r = m.rooms[DG.roomAt(m, p.x, p.y)] || {}; if (p.kind === 'gold' && r.type !== 'secret' && !r.locked) out.push(`seed ${seed} f${f}: a heap of gold outside a secret or locked room`); }
        for (const r of m.rooms) { const n = m.chests.filter((c) => DG.roomAt(m, c.x, c.y) === r.id).length; if (n > Math.min(2, 1 + Math.floor(r.w * r.h / 30))) out.push(`seed ${seed} f${f}: ${n} chests in a ${r.w}×${r.h} room`); } }
      // a cobweb hangs only in a room's top corner, its spun corner against the two walls (mirrored on the right)
      for (const d of m.decals) if (d.n === 'dc_web') { const w = 40 * d.s, cx = d.f ? d.x + w / 2 : d.x - w / 2, cy = d.y - w / 2, tx = Math.round(cx / TILE) - (d.f ? 1 : 0), ty = Math.round(cy / TILE);
        if (cell(m, tx, ty) !== 1 || cell(m, tx + (d.f ? 1 : -1), ty) !== 0 || cell(m, tx, ty - 1) !== 0 || Math.abs(cx - Math.round(cx / TILE) * TILE) > 1 || Math.abs(cy - ty * TILE) > 1) out.push(`seed ${seed} f${f}: a cobweb away from a corner at ${Math.round(d.x)},${Math.round(d.y)}`); }
      // a floor decal's drawn square (40·s px) lies on open floor: nothing climbs a wall (the corner cobwebs hang there on purpose)
      for (const d of m.decals) { if (d.n === 'dc_web') continue; const h = 20 * d.s;
        for (const [px, py] of [[d.x - h, d.y - h], [d.x + h - 0.01, d.y - h], [d.x - h, d.y + h - 0.01], [d.x + h - 0.01, d.y + h - 0.01]]) if (cell(m, Math.floor(px / TILE), Math.floor(py / TILE)) !== 1) { out.push(`seed ${seed} f${f}: decal ${d.n} on a wall at ${Math.round(d.x)},${Math.round(d.y)}`); break; } }
      // decor never wears an interactive object's sprite: a dead altar or chest reads as one already used
      for (const d of m.decor) if (['altar', 'chest', 'chest_open', 'pot', 'stairs', 'treasure'].includes(d.n)) out.push(`seed ${seed} f${f}: decor uses the ${d.n} sprite`);
      // spike plates (2×2 cells) keep clear of corridor mouths and never wall off floor: walking around every plate reaches
      // everything walking over them would
      // webs lie on the floor of a room spiders keep; an ambush's flagstone on open floor of a fighting or a locked room (TASKS 71)
      for (const w of m.webs) { const ri = DG.roomAt(m, w.x, w.y); if (ri < 0 || !m.enemies.some((e) => e.room === ri && e.type === 'spider') || cell(m, Math.floor(w.x / TILE), Math.floor(w.y / TILE)) !== 1) out.push(`seed ${seed} f${f}: a web off a spiders' room`); }
      for (const P of m.ambush) { const r = m.rooms[P.room], k = P.cy * m.W + P.cx;
        if (!r || !(r.type === 'combat' || r.type === 'exit' || r.locked) || cell(m, P.cx, P.cy) !== 1 || m.block.includes(k) || DG.roomAt(m, P.x, P.y) !== P.room) out.push(`seed ${seed} f${f}: an ambush off a fighting room's open floor`);
        if (m.traps.some((t) => Math.abs(t.x / TILE - P.cx - 0.5) < 1.5 && Math.abs(t.y / TILE - P.cy - 0.5) < 1.5)) out.push(`seed ${seed} f${f}: an ambush on a spike plate`); }
      // a corridor's plate (TASKS 76) fills a straight two-cell stretch with rock both sides, three cells and more from any room or door
      { const roomNear = (x, y, pad) => m.rooms.some((q) => x >= q.x - pad && x < q.x + q.w + pad && y >= q.y - pad && y < q.y + q.h + pad);
        for (const tr of m.traps) { if (!tr.cor) continue; const x0 = tr.x / TILE - 1, y0 = tr.y / TILE - 1, cs = [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]];
          if (cs.some(([x, y]) => cell(m, x, y) !== 1 || roomNear(x, y, 3) || m.doors.some((d) => d.cells.some(([dx, dy]) => Math.abs(dx - x) <= 3 && Math.abs(dy - y) <= 3)))) out.push(`seed ${seed} f${f}: corridor spike plate near a room or a door`);
          const runX = [0, 1].every((i) => cell(m, x0 + i, y0 - 1) === 0 && cell(m, x0 + i, y0 + 2) === 0), runY = [0, 1].every((j) => cell(m, x0 - 1, y0 + j) === 0 && cell(m, x0 + 2, y0 + j) === 0);
          if (!runX && !runY) out.push(`seed ${seed} f${f}: corridor spike plate off a straight stretch`); } }
      { const tc = new Set(); for (const tr of m.traps) if (!tr.cor) for (let j = -1; j <= 0; j++) for (let i = -1; i <= 0; i++) tc.add((Math.floor(tr.y / TILE) + j) * m.W + Math.floor(tr.x / TILE) + i);
        const inR = (x, y) => m.rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
        for (const k of tc) { const x = k % m.W, y = Math.floor(k / m.W); if (cell(m, x, y) !== 1) out.push(`seed ${seed} f${f}: spike plate off the floor`);
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, x + i, y + j) === 1 && !inR(x + i, y + j)) out.push(`seed ${seed} f${f}: spike plate at a corridor mouth`); }
        const fill = (skip) => { const seen = new Uint8Array(m.W * m.H), st = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; seen[st[0]] = 1;
          while (st.length) { const k = st.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!seen[n] && cell(m, n % m.W, Math.floor(n / m.W)) === 1 && !m.block.includes(n) && !skip.has(n)) { seen[n] = 1; st.push(n); } } } return seen; };
        for (const e of m.enemies) if (tc.has(Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE))) out.push(`seed ${seed} f${f}: ${e.type} posted on a spike plate`);
        for (const p of m.chests.concat(m.torches.filter((t) => t.kind === 'brazier'), m.shrines, m.decor.filter((d) => (d.solid || d.n === 'table') && !d.wall))) {
          const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE); let hit = false;
          for (let j = -1; j <= 1 && !hit; j++) for (let i = -1; i <= 1; i++) if (tc.has((y + j) * m.W + x + i)) hit = true;
          if (hit) out.push(`seed ${seed} f${f}: ${p.n || p.kind || 'chest'} right beside a spike plate at ${p.x},${p.y}`); }
        const a = fill(new Set()), b = fill(tc); for (let k = 0; k < a.length; k++) if (a[k] && !b[k] && !tc.has(k)) { out.push(`seed ${seed} f${f}: spike plates cut off floor`); break; } }
      const ex = DG.genFloor; void ex; void F;
      // exit reachable from the spawn over floor
      const seen = new Uint8Array(m.W * m.H), st = [[Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE)]]; let ok = false;
      while (st.length) { const [x, y] = st.pop(); if (x === m.exit.tx && y === m.exit.ty) { ok = true; break; }
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (cell(m, nx, ny) === 1 && !seen[ny * m.W + nx]) { seen[ny * m.W + nx] = 1; st.push([nx, ny]); } } }
      if (!ok) out.push(`seed ${seed} f${f}: exit unreachable`);
      // a cave (TASKS 301): its floor's size, no doors and no masonry streams, pockets that lead nowhere, and no straight stretch of
      // wall over four cells but the merchant's back wall and the secret caches
      if (mode === 'cave') { const [w0, h0] = D.RUNS.cave.size[f - 1], sh = m.rooms.find((r) => r.type === 'shop'), hid = new Set(m.secrets.flatMap((q) => q.hide));
        if (m.W !== w0 || m.H !== h0) out.push(`seed ${seed} f${f}: the cave is ${m.W}×${m.H}, not ${w0}×${h0}`);
        if (m.doors.length) out.push(`seed ${seed} f${f}: doors in the cave`);
        for (const r of m.rooms) if (r.pocket && m.edges.filter((e) => e.includes(r.id)).length !== 1) out.push(`seed ${seed} f${f}: pocket ${r.id} is not a dead end`);
        const skip = (x, y) => (Math.abs(x - sh.cx) <= 5 && y >= sh.y - 2 && y <= sh.y + 5) || hid.has(y * m.W + x) || m.rooms.some((r) => r.type === 'secret' && x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
        for (const q of DG.straightRuns(m.cells, m.W, m.H, skip)) out.push(`seed ${seed} f${f}: a straight cave wall ${q.n} cells long at ${q.x},${q.y}`); }
      // doors: two corridor cells just past a room's edge, every way into a doored room has one; a locked room is never the way to
      // the exit or to anything else, and its key or lever lies on this side of its doors
      { const inR = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, any = (x, y) => m.rooms.some((r) => inR(r, x, y));
        for (const d of m.doors) { const r = m.rooms[d.room];
          if ((!d.arena && d.cells.length !== 2) || d.cells.some(([x, y]) => cell(m, x, y) !== 1 || any(x, y) || !inRoom1(r, x, y))) out.push(`seed ${seed} f${f}: door ${d.dir} of room ${d.room} off its mouth`);
          if (['start', 'shop', 'boss', 'secret'].includes(r.type) && !d.arena) out.push(`seed ${seed} f${f}: a door to the ${r.type} room`); }
        for (const r of m.rooms) if (r.doors) for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++)
          if (!inR(r, x, y) && (x >= r.x && x < r.x + r.w || y >= r.y && y < r.y + r.h) && cell(m, x, y) === 1 && !any(x, y) && !m.doors.some((d) => d.room === r.id && d.cells.some(([cx, cy]) => cx === x && cy === y))) { out.push(`seed ${seed} f${f}: room ${r.id} has a way in without a door`); y = 1e9; break; }
        m.locks.forEach((L, li) => { const ds = m.doors.filter((d) => d.lock === li); if (!ds.length) return; const r = m.rooms[L.room], shut = new Set(ds.flatMap((d) => d.cells.map(([x, y]) => y * m.W + x)));
          const walk = (skip) => { const sv = new Uint8Array(m.W * m.H), q3 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; sv[q3[0]] = 1;
            while (q3.length) { const k = q3.pop(); for (const dd of [1, -1, m.W, -m.W]) { const n = k + dd; if (!sv[n] && m.cells[n] === 1 && !skip.has(n)) { sv[n] = 1; q3.push(n); } } } return sv; };
          const all = walk(new Set()), cut = walk(shut), at0 = (x, y) => cut[Math.floor(y / TILE) * m.W + Math.floor(x / TILE)], tag = `seed ${seed} f${f}: locked room ${L.room}`;
          if (!at0(m.exit.x, m.exit.y)) out.push(`${tag} shuts the way to the exit`);
          for (let k = 0; k < all.length; k++) if (all[k] && !cut[k] && !shut.has(k) && !inR(r, k % m.W, Math.floor(k / m.W))) { out.push(`${tag} cuts off floor beyond it`); break; }
          const holders = m.chests.filter((c) => c.key === li).concat(m.enemies.filter((e) => e.key === li));
          if (L.kind === 'key' && (holders.length !== 1 || !at0(holders[0].x, holders[0].y) || inR(r, Math.floor(holders[0].x / TILE), Math.floor(holders[0].y / TILE)))) out.push(`${tag}: its key is not on this side`);
          if (holders.some((o) => D.BOSSES[o.type])) out.push(`${tag}: its key is on a boss behind a sealed arena`);
          if (L.kind === 'lever' && (!L.lever || !at0(L.lever.x, L.lever.y + 40))) out.push(`${tag}: its lever is out of reach`);
          if (L.kind !== 'key' && L.kind !== 'lever') out.push(`${tag} has no key and no lever`); }); }
      // a merchant on every floor: his counter's front is reachable on foot, his room holds no monster post
      if (!m.shop) out.push(`seed ${seed} f${f}: no merchant`);
      else { const fx = Math.floor(m.shop.front.x / TILE), fy = Math.floor(m.shop.front.y / TILE), sn = new Uint8Array(m.W * m.H), q2 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)];
        while (q2.length) { const k = q2.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sn[n] && cell(m, n % m.W, Math.floor(n / m.W)) === 1 && !m.block.includes(n)) { sn[n] = 1; q2.push(n); } } }
        if (!sn[fy * m.W + fx]) out.push(`seed ${seed} f${f}: the merchant's counter can't be reached`);
        for (const e of m.enemies) if (e.room === m.shop.room || inStart(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) out.push(`seed ${seed} f${f}: ${e.type} posted in the start room or the shop`);
        // the shop's loose props stand against a wall and keep off its ways in; every open cell of the room is reachable from
        // the counter (only the merchant's nook behind it is closed on purpose)
        const r = m.rooms[m.shop.room], inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, blk = new Set(m.block);
        const mouths = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (cell(m, x + dx, y + dy) === 1 && !inR(x + dx, y + dy)) mouths.push([x, y]);
        for (const d of m.decor) if (d.r === r.id && ['shop_armor', 'shop_weapons', 'shop_gold', 'shop_crate'].includes(d.n)) { const x = Math.floor(d.x / TILE), y = Math.floor((d.y - 6) / TILE);
          if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cell(m, x + dx, y + dy) === 0)) out.push(`seed ${seed} f${f}: ${d.n} stands in the middle of the shop`);
          if (mouths.some(([mx, my]) => Math.max(Math.abs(mx - x), Math.abs(my - y)) <= 2)) out.push(`seed ${seed} f${f}: ${d.n} by a way into the shop`); }
        const nook = (x, y) => y <= r.y + 1 && Math.abs(x - r.cx) <= 1, go = (x, y) => inR(x, y) && cell(m, x, y) === 1 && !blk.has(y * m.W + x) && !nook(x, y);
        const sv = new Set([fy * m.W + fx]), q3 = [[fx, fy]]; while (q3.length) { const [x, y] = q3.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
          if (go(nx, ny) && !sv.has(ny * m.W + nx)) { sv.add(ny * m.W + nx); q3.push([nx, ny]); } } }
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (go(x, y) && !sv.has(y * m.W + x)) { out.push(`seed ${seed} f${f}: shop props wall off floor`); y = 1e9; break; } }
      // fire floors always show lava, and no pool cuts floor off from the rest
      if (D.BIOMES[m.biome].lava && !m.lava) out.push(`seed ${seed} f${f}: a fire floor without lava`);
      { const sv = new Uint8Array(m.W * m.H), q3 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; sv[q3[0]] = 1;
        while (q3.length) { const k = q3.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sv[n] && (m.cells[n] === 1 || m.cells[n] === 4)) { sv[n] = 1; q3.push(n); } } }
        if (m.cells.some((c, k) => c === 1 && !sv[k])) out.push(`seed ${seed} f${f}: lava cuts floor off`); }
      // secret rooms: sealed off by their fake wall (walking never gets in), reached once it breaks, one top-tier chest, no monsters
      if ((!m.secrets.length && !m.bossType) || m.secrets.length > 10) out.push(`seed ${seed} f${f}: ${m.secrets.length} secret rooms`);
      { const walk = (pass) => { const sv = new Uint8Array(m.W * m.H), q3 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; sv[q3[0]] = 1;
          while (q3.length) { const k = q3.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sv[n] && (m.cells[n] === 1 || (pass && m.cells[n] === 4)) && !m.block.includes(n)) { sv[n] = 1; q3.push(n); } } } return sv; };
        const shut = walk(0), open = walk(1);
        m.secrets.forEach((q, i) => { const r = m.rooms[q.room], ch = m.chests.filter((c) => c.sec === i);
          if (q.wall.length !== 4 || q.wall.some(([x, y]) => cell(m, x, y) !== 4)) out.push(`seed ${seed} f${f}: secret ${i} has no fake wall`);
          if (q.front.some(([x, y]) => inRoom1(m.rooms[m.shop.room], x, y))) out.push(`seed ${seed} f${f}: secret off the shop`);
          if (ch.length !== 1 || ch[0].tier !== 3) out.push(`seed ${seed} f${f}: secret ${i} holds ${ch.length} chests`);
          for (const c of ch) { const k = Math.floor(c.y / TILE) * m.W + Math.floor(c.x / TILE), nb = [1, -1, m.W, -m.W].map((d) => k + d);
            if (nb.some((n) => shut[n])) out.push(`seed ${seed} f${f}: secret ${i} reachable without breaking the wall`);
            if (!nb.some((n) => open[n])) out.push(`seed ${seed} f${f}: secret ${i} chest unreachable after the wall breaks`); }
          if (m.enemies.some((e) => e.room === r.id)) out.push(`seed ${seed} f${f}: monsters in secret ${i}`);
          if (m.torches.some((t) => t.r === r.id && t.sec !== i)) out.push(`seed ${seed} f${f}: a torch lights secret ${i} before it is found`);
          // each secret has its cover or its mechanism, and a mechanism is found and worked from the open floor
          const tag = `seed ${seed} f${f}: secret ${i} (${q.kind})`;
          if (!['crack', 'banner', 'shelf', 'lever'].includes(q.kind)) out.push(`${tag} has no kind`);
          if ((q.kind === 'banner' || q.kind === 'shelf') && q.dir !== 'u') out.push(`${tag} is not on a top wall`);
          if (q.kind === 'banner' && !m.decor.some((d) => d.secret === i && d.n === 'banner' && d.wall)) out.push(`${tag} has no banner`);
          if (q.kind === 'shelf' && !m.decor.some((d) => d.secret === i && d.n === 'bookshelf' && d.solid)) out.push(`${tag} has no bookshelf`);
          if (q.kind !== 'lever' && q.trig) out.push(`${tag} has a mechanism`);
          if (q.kind === 'lever') { const P = q.trig;
            if (!P) out.push(`${tag} has no mechanism`);
            else if (P.k === 'plate') { const k = P.cy * m.W + P.cx; if (!shut[k] || m.traps.some((tp) => Math.abs(tp.x / TILE - P.cx - 0.5) < 1.5 && Math.abs(tp.y / TILE - P.cy - 0.5) < 1.5)) out.push(`${tag}: its flagstone is out of reach or on a spike plate`); }
            else { const t = m.torches[P.t]; if (!t || t.kind !== 'wall' || t.side || t.lever !== i || t.sec !== undefined) out.push(`${tag}: its sconce is missing or hidden`); } } }); }
      // every floor cell of every room lies within reach of a light: a torch, a brazier, candles, a crystal, an altar, the bonfire or a shop lamp
      { const LR = DG.LIGHT_R, lights = m.torches.map((t) => [t.x, t.y, LR[t.kind]]).concat(m.decor.filter((d) => LR[d.n]).map((d) => [d.x, d.y, LR[d.n]]),
          m.shrines.map((s) => [s.x, s.y, LR.shrine]), m.shop.lanterns.map((q) => [q.x, q.y, LR.wall]), [[m.shop.x, m.shop.y, LR.fire]]);
        for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 3) lights.push([(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE + 6, LR.lava]);   // lava glows
        for (const r of m.rooms) { let dark = 0;
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (cell(m, x, y) === 1 && !lights.some(([lx, ly, lr]) => Math.hypot(lx - (x + 0.5) * TILE, (ly - (y + 0.5) * TILE - 6) / 0.8) <= lr * TILE)) dark++;
          if (dark) out.push(`seed ${seed} f${f}: ${dark} dark cells in ${r.type} room ${r.id} (${r.w}×${r.h})`); } } }
    // the cave's water comes in every kind over the floors checked: falls, breaches, springs, isthmuses, fords and bridges
    for (const k of ['waterfall', 'breach', 'spring', 'neck', 'ford', 'bridge']) if (!caveKinds[k]) out.push(`cave: no ${k} on any of the floors checked`);
    // a saved run loaded into a fresh session must play at once (cooldowns and timers are absolute times)
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); let snap = null;   // the last save of a living hero: the demo hero may fall before 40 s
      for (let i = 0; i < 120 * 40; i++) { step(S, scriptInput(S.t, S)); if (i % 120 === 0 && S.run && S.run.hero.hp > 0 && S.t > 10) snap = JSON.stringify(S.run); }
      if (!snap) out.push('save check: the demo hero never lives past 10 s');
      const T = spawn(0, { run: JSON.parse(snap || 'null') }); T.screen = 'play'; T.run = T.saved; if (T.run) T.run.hero.ifr = 1e9; for (let i = 0; i < 240; i++) step(T, { press: 1, px: 1000, py: 500, keys: [] });
      if (!T.ev.some((e) => e.k === 'swing')) out.push('a loaded save cannot attack (clock behind the saved timers)');
      const p0 = T.run.play; T.screen = 'pause'; for (let i = 0; i < 240; i++) step(T, { keys: [] }); T.screen = 'play'; step(T, { keys: [] });
      if (Math.abs(T.run.play - p0 - DT) > 1e-6) out.push(`run timer: 2 s on the pause screen added ${(T.run.play - p0).toFixed(2)} s of play`); }
    // a thrown-away item must not come straight back: it lands on another cell and is picked up only after the hero walks away and returns
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 60; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, it = rollItem(R, 1, 1); it.id = 99999; throwAway(R, h, it);
      for (let i = 0; i < 600; i++) step(S, { keys: [] });
      const p = R.drops.find((q) => q.item && q.item.id === 99999);
      if (!p) out.push('a thrown-away item was picked up again while the hero stood still');
      else { const hx = h.x, hy = h.y; h.x += 120; for (let i = 0; i < 10; i++) step(S, { keys: [] }); h.x = p.x; h.y = p.y; for (let i = 0; i < 30; i++) step(S, { keys: [] });
        if (!h.bag.some((b) => b && b.id === 99999) && !Object.values(h.eq).some((q) => q && q.id === 99999)) out.push('a thrown-away item cannot be picked up after walking away and back'); void hx; void hy; } }
    // hazards: spikes hurt a monster standing on a raised plate; lava burns the hero; a monster knocked into lava burns, and none walks in
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      let R = S.run; for (let f = 1; f <= 6 && !R.map.traps.length; f++) enterFloor(S, R, f);
      const tr = R.map.traps[0], E = ENEMIES.skeleton, mk = (x, y) => ({ id: 77000 + R.en.length, type: 'skeleton', x, y, vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'idle', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 });
      if (tr) { R.en = [mk(tr.x, tr.y)]; const e = R.en[0]; R.hero.x = tr.x + 400; for (let i = 0; i < 120 * 3; i++) { e.x = tr.x; e.y = tr.y; e.st = 'idle'; step(S, { keys: [] }); }
        if (e.hp >= 999) out.push('spikes never hurt a monster standing on them'); void E; } else out.push('hazard check: no spike trap on floors 1–6');
      enterFloor(S, R, 5);
      const m = R.map, lv = []; for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.cells[y * m.W + x] === 3) lv.push([x, y]);
      if (lv.length) { const [lx, ly] = lv[Math.floor(lv.length / 2)], h = R.hero; R.en = []; h.x = lx * TILE + 16; h.y = ly * TILE + 16; h.ifr = 0; const hp0 = h.hp = 1e4;
        for (let i = 0; i < 120 * 2; i++) { h.x = lx * TILE + 16; h.y = ly * TILE + 16; step(S, { keys: [] }); }
        if (h.hp >= hp0) out.push('standing in lava does not hurt the hero');
        h.x = lx * TILE + 400; const e = mk(lx * TILE + 16, ly * TILE + 16); R.en = [e]; for (let i = 0; i < 120 * 3; i++) step(S, { keys: [] });
        if (e.hp >= 999) out.push('a monster in lava does not burn');
        if (cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 3) out.push('a monster in lava does not walk out of it'); } else out.push('hazard check: no lava on floor 5'); }
    // gear for an empty slot is worn on pickup; for a taken slot it goes to the bag; potions always go to the bag
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 60; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, drop = (it) => R.drops.push({ id: R.nextId++, kind: 'item', item: it, x: h.x, y: h.y, vx: 0, vy: 0, z: 0, vz: 0, t0: R.t - 1 });
      const helm = Object.assign(rollItem(R, 1, 0, 'helm'), { id: 88801 }), sword = Object.assign(rollItem(R, 1, 0, 'weapon'), { id: 88802 }), pot = { id: 88803, b: 'hp_potion', n: 1, rar: 0, lvl: 1, mods: {} };
      h.eq.helm = null; drop(helm); drop(sword); drop(pot); for (let i = 0; i < 5; i++) step(S, { keys: [] });
      if (!h.eq.helm || h.eq.helm.id !== 88801) out.push('an item for an empty slot was not worn on pickup');
      if (h.eq.weapon.id === 88802 || !h.bag.some((b) => b && b.id === 88802)) out.push('an item for a taken slot did not go to the bag');
      if (Object.values(h.eq).some((q) => q && q.id === 88803)) out.push('a potion was worn'); }
    // a monster that loses the hero gives up and walks back to its post; idle, it shifts about the spot but stays on it
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, m = R.map, e = R.en.find((o) => o.type !== 'boss' && !ENEMIES[o.type].ghost && ENEMIES[o.type].kind !== 'caster'); R.en = [e]; m.traps = [];
      for (let i = 0; i < 120 * 20; i++) step(S, { keys: [] });
      if (Math.hypot(e.x - e.hx, e.y - e.hy) > 24) out.push('an idle monster wandered off its post');
      const hx = e.hx, hy = e.hy, far = m.rooms.reduce((a, q) => Math.hypot(q.cx * TILE - hx, q.cy * TILE - hy) > Math.hypot(a.cx * TILE - hx, a.cy * TILE - hy) ? q : a), hide = () => { h.x = far.cx * TILE + 16; h.y = far.cy * TILE + 16; };
      h.ifr = 1e9; h.x = e.x + 60; h.y = e.y; aggroRoom(R, e); hide();
      let gaveUp = 0; for (let i = 0; i < 120 * 45 && e.st !== 'idle'; i++) { if (e.st === 'chase' && i % 60 === 0) hide(); step(S, { keys: [] }); gaveUp |= e.st === 'home'; }
      if (!gaveUp) out.push('a monster never gives up a hero hiding in a far room');
      else if (e.st !== 'idle' || Math.hypot(e.x - hx, e.y - hy) > 16) out.push(`a monster that lost the hero did not walk back to its post (${e.st}, ${Math.round(Math.hypot(e.x - hx, e.y - hy))} px off)`); }
    // elites: a blow never knocks one back; a fiery one's landed blow sets the hero burning and a vampire's heals it; a summoner
    // raises skeletons up to its cap and no further; an explosive corpse bursts once its fuse is out, hurting a hero in reach only
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, rm = R.map.rooms.find((q) => q.id !== R.map.start && !q.trap && q.w >= 10 && q.h >= 5), cx = (rm.x + rm.w / 2) * TILE, cy = (rm.y + rm.h / 2) * TILE;   // off the spike plates
      const put = () => { R.en = []; R.proj = []; h.hp = heroSt(S).maxHp; h.deadT = -1; h.burn = 0; h.ifr = 0; h.x = cx; h.y = cy; h.vx = h.vy = 0; };
      const el = (mods, dx, o) => { const e = Object.assign({ id: R.nextId++, type: 'skeleton', x: h.x + dx, y: h.y, vx: 0, vy: 0, hp: 400, max: 400, dmg: 5, elite: 1, mods, room: rm.id, st: 'chase',
        t0: S.t, face: -1, aimA: Math.PI, cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: S.t }, o); R.en.push(e); return e; };
      put(); const kb = el([], 40); hitEnemy(S, R, kb, 1, false, h.x, h.y); if (kb.kbx || kb.kby) out.push('an elite is knocked back by a blow');
      put(); const fv = el(['fiery', 'vampire'], 30, { hp: 200 }); let hit = 0;
      for (let i = 0; i < 120 * 3 && !hit; i++) { const a = h.hp; step(S, { keys: [] }); hit = h.hp < a; }
      if (!hit) out.push('an elite next to the hero never strikes it');
      else { if (!(h.burn > S.t)) out.push("a fiery elite's blow does not set the hero burning"); if (fv.hp <= 200) out.push("a vampire elite's blow does not heal it"); }
      put(); h.ifr = 1e9; const sm = el(['summoner'], 140, { cdT: 1e9 }); sm.sumT = S.t; let most = 0;
      for (let i = 0; i < 120 * 30; i++) { step(S, { keys: [] }); most = Math.max(most, R.en.filter((o) => o.summ === sm.id && o.deadT < 0).length); }
      if (most < 1) out.push('a summoner elite raises nothing'); if (most > MOD.summoner.cap) out.push(`a summoner elite keeps ${most} skeletons up, over its cap`);
      for (const [dx, near] of [[60, 1], [MOD.explosive.r + 30, 0]]) { put(); const ex = el(['explosive'], dx, { cdT: 1e9, hp: 1 }); hitEnemy(S, R, ex, 5, false, h.x, h.y); const a = h.hp;
        for (let i = 0; i < 120 * MOD.explosive.fuse * 0.8; i++) step(S, { keys: [] }); if (h.hp < a) out.push('an explosive elite bursts before its fuse is out');
        for (let i = 0; i < 120 * 0.5; i++) step(S, { keys: [] });
        if ((h.hp < a) !== !!near) out.push(near ? "an explosive elite's corpse does not hurt the hero in reach" : "an explosive elite's corpse hurts the hero out of reach"); }
      // no blow takes more than its cap of the health: the real strike of an elite of every kind (a caster's bolt, the boss's moves)
      // and an explosive corpse's blast, on the first and the last floor
      const f0 = R.floor, first = (secs) => { const mx = heroSt(S).maxHp; let lost = 0;
        for (let i = 0; i < 120 * secs && !lost; i++) { const a = h.hp; step(S, { keys: [] }); lost = (a - h.hp) / mx; } return lost; };
      for (const f of [1, D.RUNS.campaign.floors]) { R.floor = f;
        for (const type in ENEMIES) { put(); el([], type === 'cultist' ? 120 : 40, { type, dmg: 1e5 }); const l = first(D.BOSSES[type] ? 12 : 6), cap = D.BOSSES[type] ? BAL.cap.boss : BAL.cap.blow;
          if (!l) out.push(`f${f}: an elite ${type} never strikes the hero`); else if (l > cap + 0.01) out.push(`f${f}: an elite ${type}'s blow takes ${Math.round(l * 100)}% of the health, over ${cap * 100}%`); }
        put(); const ex = el(['explosive'], 60, { cdT: 1e9, hp: 1, dmg: 1e5 }); hitEnemy(S, R, ex, 5, false, h.x, h.y); const l = first(MOD.explosive.fuse + 0.5);
        if (l > BAL.cap.blow + 0.01) out.push(`f${f}: an explosive corpse takes ${Math.round(l * 100)}% of the health, over the cap`); }
      R.floor = f0;
      // a volley wounds once, and a bolt of an earlier volley still in flight does not wound again after a later volley's bolt
      const bolt = (vol, dx) => { const p = { id: R.nextId++, vol, who: 'boss', k: 'fire', x: h.x + dx, y: h.y - 38, vx: 0, vy: 0, t0: S.t, life: 2, dmg: 10, own: 'en', r: 9 }; R.proj.push(p); return p; };
      const wounds = (n) => { let w = 0; for (let i = 0; i < n; i++) { step(S, { keys: [] }); w += S.ev.filter((q) => q.k === 'hurt' && q.t === S.t && q.src === 'boss снаряд').length; } return w; };
      put(); bolt(1e7, 0); bolt(1e7, 4); let w = wounds(12);
      if (w !== 1 && !S.ev.some((q) => q.k === 'dodge')) out.push(`two bolts of one boss volley wound the hero ${w} times, not once`);
      put(); bolt(2e7, 0); bolt(3e7, 0); const late = bolt(2e7, 100); w = wounds(12); late.x = h.x; late.y = h.y - 38; w += wounds(12);
      if (w !== 2 && !S.ev.some((q) => q.k === 'dodge')) out.push(`bolts of two interleaved volleys wound the hero ${w} times, not twice`); }
    // the hero and a monster side by side against the same wall above them still reach each other
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, m = R.map, h = R.hero, rm = m.rooms.find((q) => q.id !== m.start && q.w >= 6), y = rm.y * TILE + 5, x = (rm.x + 2) * TILE;
      if (!losClear(m, x, y, x + 40, y)) out.push('two actors against the same wall cannot reach each other along it');
      if (losClear(m, x, y, x, y - 3 * TILE)) out.push('a line straight up through the wall above a room is clear'); }
    // floors meeting only at a corner: the generator leaves none, and a line through such a corner is shut (TASKS 174)
    { const pm = { W: 4, H: 4, cells: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0] };
      if (losClear(pm, 1.5 * TILE, 1.5 * TILE, 2.5 * TILE, 2.5 * TILE)) out.push('a line through the corner of two walls is clear');
      for (let f = 1; f <= D.RUNS.campaign.floors; f++) for (let s = 1; s <= 8; s++) { const m = DG.genFloor(s * 131 + f, f), so = (x, y) => solidC(m, x, y); let n = 0;
        for (let y = 0; y < m.H - 1; y++) for (let x = 0; x < m.W - 1; x++) if (so(x, y) === so(x + 1, y + 1) && so(x + 1, y) === so(x, y + 1) && so(x, y) !== so(x + 1, y)) n++;
        if (n) out.push(`floor ${f} seed ${s * 131 + f}: ${n} floors meet only at a corner`); } }
    // a cultist's fire hex (lava floors) sets the hero burning for a few ticks; the plain hex does not
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, rm = R.map.rooms.find((q) => q.id !== R.map.start); R.en = []; h.hp = h.base.vit * 100; h.ifr = 0;
      h.x = (rm.x + rm.w / 2) * TILE; h.y = (rm.y + rm.h / 2) * TILE; h.vx = h.vy = 0;
      const shot = (k) => { R.proj = [{ id: R.nextId++, k, x: h.x, y: h.y - 38, vx: 0, vy: 0, t0: S.t, life: 1, dmg: 5, own: 'en', r: 6 }]; h.ifr = 0; step(S, { keys: [] }); };
      shot('hex'); const a0 = h.hp; for (let i = 0; i < 120 * 2; i++) step(S, { keys: [] }); if (h.hp < a0 || h.burn > S.t) out.push('a plain hex sets the hero burning');
      shot('fire'); const b0 = h.hp; for (let i = 0; i < 120 * 2; i++) step(S, { keys: [] }); if (h.hp >= b0) out.push('a fire hex does not set the hero burning');
      // the scene tells a bolt that struck the hero from one that hit a wall
      if (!S.ev.some((e) => e.k === 'pop' && e.hero)) out.push('a bolt hitting the hero is not marked on its pop event');
      // a scroll's pillar of light shows at both ends of the jump
      const fx = h.x, fy = h.y; h.bag[0] = { b: 'scroll', n: 1, id: 88001 }; useItem(S, R, 0); const tp = S.ev.find((e) => e.k === 'teleport');
      if (!tp || tp.fx !== fx || tp.fy !== fy) out.push('a teleport event does not carry where the hero left from'); }
    // the boss roars as he first sees the hero
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run; enterFloor(S, R, D.RUNS.campaign.floors); const b = R.en.find((e) => e.type === 'boss'), h = R.hero; R.en = [b]; h.x = b.x; h.y = b.y + 160; h.ifr = 1e9;
      for (let i = 0; i < 60; i++) step(S, { keys: [] }); if (!S.ev.some((e) => e.k === 'roar')) out.push('the boss does not roar when he first sees the hero'); }
    // shallow water: the hero wades slower, a burning hero stepping in is put out, and no prop, chest or monster post stands in it
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); const R = S.run, h = R.hero; let tested = false;
      for (let f = 1; f <= D.RUNS.campaign.floors && !tested; f++) { enterFloor(S, R, f); const m = R.map; if (!m.water.length) continue; tested = true; const wet = new Set(m.water), k0 = m.water[Math.floor(m.water.length / 2)], foe = structuredClone(R.en.find((e) => !ENEMIES[e.type].ghost));
        const on = (o) => wet.has(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE));
        for (const o of [...R.chests, ...R.pots, ...m.decor.filter((d) => d.solid), ...m.torches.filter((t) => t.kind !== 'wall'), ...R.en]) if (on(o)) out.push(`water check floor ${f}: ${o.type || o.kind || o.n || 'chest'} stands in the water`);
        const run = (x, y) => { R.en = []; h.vx = h.vy = 0; for (let i = 0; i < 60; i++) { h.x = x; h.y = y; step(S, { keys: [], right: 1 }); } return h.vx; };
        const sp = m.spawn; S.ev = []; const vDry = run(sp.x, sp.y);
        if (!S.ev.some((e) => e.k === 'step' && !e.wet)) out.push('water check: dry steps are missing');
        S.ev = []; const vWet = run((k0 % m.W + 0.5) * TILE, (Math.floor(k0 / m.W) + 0.5) * TILE);
        if (!S.ev.some((e) => e.k === 'step' && e.wet)) out.push('water check: wet steps are missing');
        if (!(vWet < vDry * 0.85)) out.push(`water check floor ${f}: wading ${Math.round(vWet)} px/s is not slower than ${Math.round(vDry)}`);
        h.burn = S.t + 3; S.ev = []; step(S, { keys: [] }); if (h.burn > S.t || !S.ev.some((e) => e.k === 'douse')) out.push(`water check floor ${f}: the water does not put out a burning hero`);
        S.ev = []; step(S, { keys: [] }); if (S.ev.some((e) => e.k === 'douse')) out.push('water check: extinguished hero keeps steaming');
        const vx = (wet, ghost = false) => {
          const e = { x: wet ? (k0 % m.W + 0.5) * TILE : sp.x, y: wet ? (Math.floor(k0 / m.W) + 0.5) * TILE : sp.y, vx: 0, vy: 0, type: ghost ? 'ghost' : 'skeleton' };
          for (let i = 0; i < 120; i++) steer(e, ENEMIES[e.type], m, [], 1, 100, 0, 100); return e.vx;
        };
        if (Math.abs(vx(true) / vx(false) - WADE) > 0.001) out.push('water check: monsters do not wade slower');
        if (Math.abs(vx(true, true) / vx(false, true) - 1) > 0.001) out.push('water check: floating ghosts wade');
        for (const k of m.waterBridges) if (inWater(m, { x: (k % m.W + 0.5) * TILE, y: (Math.floor(k / m.W) + 0.5) * TILE })) out.push('water check: a stone crossing slows walkers');
        const e = Object.assign(foe, { x: h.x, y: h.y, burn: S.t + 3, calmT: 1e9, st: 'idle' }); R.en = [e]; S.ev = [];
        step(S, { keys: [] }); if (e.burn > S.t || !S.ev.some((a) => a.k === 'douse')) out.push('water check: a burning monster is not extinguished');
      }
      if (!tested) out.push('water check: no floor with water'); }
    // a body wider than a two-cell wall (the boss, 72 px) walking at it stops at it: with only its corners tested it straddled
    // the wall and walked into the rock for good
    { const W = 12, H = 12, cells = new Array(W * H).fill(1); for (let y = 6; y < H; y++) { cells[y * W + 5] = cells[y * W + 6] = 0; }   // a wall's end
      const m = { W, H, cells, rooms: [{ x: -9, y: -9, w: 1, h: 1 }], start: 0, shop: null }, o = { x: 6 * TILE, y: 3 * TILE };
      for (let i = 0; i < 400; i++) move(m, o, 0, 1.5, ENEMIES.boss.r, true);
      if (cell(m, Math.floor(o.x / TILE), Math.floor(o.y / TILE)) !== 1) out.push(`a ${ENEMIES.boss.r * 2} px wide body walks down into the end of a two-cell wall (${Math.round(o.x)},${Math.round(o.y)})`); }
    // fog of war across a thin wall: a hero against the wall between two rooms with no passage sees all of his own room and none
    // of the floor behind the wall (TASKS 104)
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero; let tested = 0;
      for (let f = 1; f <= D.RUNS.campaign.floors && tested < 3; f++) { enterFloor(S, R, f); const m = R.map;
        for (const A of m.rooms) for (const B of m.rooms) for (const vert of [0, 1]) { if (A === B || A.type === 'secret' || B.type === 'secret' || tested >= 3) continue;
          const a0 = vert ? A.y : A.x, aw = vert ? A.h : A.w, b0 = vert ? B.y : B.x, gap = b0 - (a0 + aw); if (gap < 1 || gap > 2) continue;
          const o0 = Math.max(vert ? A.x : A.y, vert ? B.x : B.y), o1 = Math.min(vert ? A.x + A.w : A.y + A.h, vert ? B.x + B.w : B.y + B.h); if (o1 - o0 < 3) continue;
          const at = (u, v) => (vert ? cell(m, v, u) : cell(m, u, v)); let shut = true;
          for (let v = o0 - 1; v <= o1; v++) for (let u = a0 + aw; u < b0; u++) if (at(u, v) !== 0) shut = false;
          if (!shut) continue; tested++;
          const mid = Math.floor((o0 + o1) / 2), hx = vert ? mid : a0 + aw - 1, hy = vert ? a0 + aw - 1 : mid;
          R.seen = new Array(m.W * m.H).fill(0); R.rseen = m.rooms.map(() => 0); h.x = (hx + 0.5) * TILE; h.y = (hy + 0.5) * TILE; reveal(R);
          let leak = 0, own = 0; for (let v = o0; v < o1; v++) for (let u = b0; u < b0 + 2; u++) { const x = vert ? v : u, y = vert ? u : v; if (cell(m, x, y) === 1 && R.seen[y * m.W + x]) leak++; }
          for (let y = A.y; y < A.y + A.h; y++) for (let x = A.x; x < A.x + A.w; x++) if (cell(m, x, y) === 1 && !R.seen[y * m.W + x]) own++;
          if (leak) out.push(`fog check floor ${f}: ${leak} floor cells of room ${B.id} show through the wall from room ${A.id}`);
          if (own) out.push(`fog check floor ${f}: ${own} floor cells of the hero's own room ${A.id} stay dark`); } }
      if (!tested) out.push('fog check: no thin wall between two rooms found to test'); }
    // hero blows stop at walls: across a thin wall a monster takes no damage from a swing, the whirl or a fireball's blast,
    // and the same setup with the wall dug out does hit (so the check really reaches it)
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero; let spot = null;
      for (let f = 1; f <= D.RUNS.campaign.floors && !spot; f++) { enterFloor(S, R, f); const m = R.map;
        for (let ty = 1; ty < m.H - 4 && !spot; ty++) for (let tx = 1; tx < m.W - 1 && !spot; tx++) for (const k of [1, 2]) {
          const below = ty + k + 1, ok = (x, y) => cell(m, x, y) === 1 && !inStart(m, x, y);
          if (ok(tx, ty) && ok(tx - 1, ty) && ok(tx + 1, ty) && ok(tx, below) && ok(tx - 1, below) && ok(tx + 1, below) && [...Array(k)].every((_, i) => cell(m, tx, ty + 1 + i) === 0)) { spot = { tx, ty, k, below }; break; } } }
      if (!spot) out.push('wall check: no thin wall between two floors');
      else { const m = R.map, cells = m.cells.slice(), dig = (on) => { for (let i = 0; i < spot.k; i++) m.cells[(spot.ty + 1 + i) * m.W + spot.tx] = on ? 1 : cells[(spot.ty + 1 + i) * m.W + spot.tx]; };
        const type = Object.keys(ENEMIES).find((q) => ENEMIES[q].kind === 'melee' && !ENEMIES[q].ghost);
        const trial = (how, open) => { dig(open); R.proj = []; R.pots = []; R.chests = []; R.drops = [];
          const e = { id: R.nextId++, type, x: (spot.tx + 0.5) * TILE, y: spot.below * TILE + 6, hp: 1e6, max: 1e6, dmg: 0, st: 'idle', deadT: -1, room: -1, t0: S.t, kbx: 0, kby: 0 };
          R.en = [e]; h.x = (spot.tx + 0.5) * TILE; h.y = (spot.ty + 1) * TILE - 6; h.vx = h.vy = 0; h.mp = 999; h.ab.fireball = 1; h.ifr = 1e9;
          for (const k in h.cd) h.cd[k] = 0; h.atkT = -9; const aim = () => ({ keys: [], ...toPx(R, e.x, e.y - 30) });
          step(S, aim()); if (how === 'whirl') castAbility(S, R, 'whirl', {}); if (how === 'fire') step(S, Object.assign(aim(), { rclick: 1 }));
          for (let i = 0; i < 120; i++) { e.x = (spot.tx + 0.5) * TILE; e.y = spot.below * TILE + 6; e.st = 'idle'; h.x = (spot.tx + 0.5) * TILE; h.y = (spot.ty + 1) * TILE - 6; step(S, Object.assign(aim(), { press: how === 'swing' && i < 30 ? 1 : 0 })); }
          dig(false); return e.hp < e.max; };
        for (const how of ['swing', 'whirl', 'fire']) { const open = trial(how, true), shut = trial(how, false);
          if (shut) out.push(`a hero ${how} hits a monster through a wall`); else if (!open && how !== 'swing') out.push(`wall check: the ${how} misses even with the wall dug out`); } } }
    // monsters stand clear of solid props: at every post, and when knocked into a chest or chasing the hero straight across one
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, m = R.map, inside = (e) => !ENEMIES[e.type].ghost && e.deadT < 0 && solids(R).some((o) => Math.hypot(e.x - o.x, (e.y - o.y) * 1.6) < o.r + ENEMIES[e.type].r - 1);
      for (let f = 1; f <= D.RUNS.campaign.floors; f++) { enterFloor(S, R, f); const e = R.en.find(inside); if (e) { out.push(`floor ${f}: a ${e.type} is posted inside a prop`); break; } }
      enterFloor(S, R, 1); const c = R.chests.find((q) => cell(m, Math.floor((q.x - 64) / TILE), Math.floor(q.y / TILE)) === 1 && cell(R.map, Math.floor((q.x + 64) / TILE), Math.floor(q.y / TILE)) === 1);
      if (!c) out.push('prop check: no chest with floor on both sides on floor 1');
      else { const e = R.en.find((o) => !ENEMIES[o.type].ghost && ENEMIES[o.type].kind === 'melee'); R.en = [e]; Object.assign(e, { x: c.x - 40, y: c.y, kbx: 900, kby: 0, hp: 1e4, max: 1e4, dmg: 0, st: 'idle' });
        h.x = c.x + 300; h.y = c.y + 300; let hit = 0; for (let i = 0; i < 60; i++) { step(S, { keys: [] }); hit |= inside(e); }
        if (hit) out.push('a monster knocked into a chest passes through it');
        h.ifr = 1e9; h.x = c.x + 60; h.y = c.y; e.x = c.x - 60; e.y = c.y; aggroRoom(R, e); hit = 0;
        for (let i = 0; i < 120 * 3; i++) { h.x = c.x + 60; h.y = c.y; step(S, { keys: [] }); hit |= inside(e); }
        if (hit) out.push('a monster chasing the hero walks through a chest'); } }
    // trading: E at the counter opens the shop; a buy costs its price and lands in the bag, a sale pays a quarter and can be
    // bought back at that price; no gold or a full bag refuses without taking anything
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, sh = R.map.shop; R.en = []; h.x = sh.front.x; h.y = sh.front.y; step(S, { keys: ['KeyE'] });
      if (S.screen !== 'shop') out.push('E at the counter does not open the shop');
      else { const U = UI.shop(R.shop.goods.length), at = (id) => { const b = U.r.find((q) => q.id === id); return { px: b.x + 5, py: b.y + 5, click: 1, keys: [] }; };
        const g = R.shop.goods[0], n0 = R.shop.goods.length; h.gold = g.price - 1; step(S, at('buy:0'));
        if (R.shop.goods.length !== n0 || h.gold !== g.price - 1) out.push('a buy went through without enough gold');
        h.gold = g.price + 5; step(S, at('buy:0'));
        if (h.gold !== 5 || !h.bag.some((b) => b && b.id === g.it.id)) out.push('a buy did not take its price or did not land in the bag');
        const i = h.bag.findIndex((b) => b && b.id === g.it.id), pr = D.sellPrice(g.it, R.floor); step(S, at('sell:' + i));
        if (h.gold !== 5 + pr || h.bag[i] || !R.shop.back.some((q) => q.it.id === g.it.id && q.price === pr)) out.push('a sale did not pay or did not reach the buy-back row');
        step(S, at('back:0')); if (h.gold !== 5 || !h.bag.some((b) => b && b.id === g.it.id)) out.push('buying back a sold item failed');
        for (let k = 0; k < 24; k++) h.bag[k] = Object.assign(rollItem(R, 1, 0), { id: 70000 + k });
        const cg = R.shop.goods.find((q) => q.n); h.gold = 1e6; const c0 = cg.n; step(S, at('buy:' + R.shop.goods.indexOf(cg)));
        if (h.gold !== 1e6 || cg.n !== c0) out.push('a buy into a full bag took the gold');
        step(S, { keys: ['Escape'] }); if (S.screen !== 'play') out.push('Esc does not close the shop'); } }
    // a jam in a two-cell corridor (TASKS 151): monsters queued behind the ones at the hero don't stand still for long, they leave;
    // and the start room and the shop are open to a chasing monster (152)
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, m = R.map, corr = (x, y) => cell(m, x, y) === 1 && DG.roomAt(m, x * TILE + 16, y * TILE + 16) < 0;
      let lane = null;   // a straight corridor two cells wide and 14 long, rock on both sides: the hero at one end, ten monsters down it
      for (let y = 1; y < m.H - 2 && !lane; y++) for (let x = 1; x < m.W - 14 && !lane; x++) for (const v of [0, 1]) {
        const at = (i, k) => v ? [x + k, y + i] : [x + i, y + k];
        if ([...Array(14)].every((_, i) => { const [ax, ay] = at(i, 0), [bx, by] = at(i, 1), [cx, cy] = at(i, -1), [dx, dy] = at(i, 2);
          return corr(ax, ay) && corr(bx, by) && cell(m, cx, cy) === 0 && cell(m, dx, dy) === 0; })) {
          const c = (i, k) => { const [px, py] = at(i, k); return py * m.W + px; };
          lane = { at: c(0, 0), back: [...Array(10)].map((_, n) => c(4 + (n >> 1), n & 1)) }; break; } }
      if (!lane) out.push('jam check: no straight corridor long enough');
      else { const sk = ENEMIES.brute, reach = sk.r + K.R + sk.reach;
        h.ifr = 1e9; h.x = (lane.at % m.W) * TILE + 16; h.y = ((lane.at / m.W) | 0) * TILE + 18;
        R.en = lane.back.map((j) => { const x = (j % m.W) * TILE + 16, y = ((j / m.W) | 0) * TILE + 18;
          return { id: R.nextId++, type: 'brute', x, y, hx: x, hy: y, vx: 0, vy: 0, hp: 1e5, max: 1e5, dmg: 0, elite: 0, room: -1, st: 'chase', t0: S.t, face: 1, aimA: 0,
            cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: S.t }; });
        const wait = R.en.map(() => 0); let worst = 0;
        for (let i = 0; i < 120 * 12; i++) { h.x = (lane.at % m.W) * TILE + 16; h.y = ((lane.at / m.W) | 0) * TILE + 18; step(S, { keys: [] });
          R.en.forEach((e, k) => { wait[k] = e.st === 'chase' && Math.hypot(h.x - e.x, h.y - e.y) > reach + 40 ? wait[k] + DT : 0; worst = Math.max(worst, wait[k]); }); }
        if (worst > 5) out.push(`jam check: a monster queued in a corridor short of the fight for ${worst.toFixed(1)} s`); }
      const r = m.rooms[m.shop.room], e = R.en[0] || {}, mouth = [];
      for (let y = r.y - 2; y <= r.y + r.h + 1; y++) for (let x = r.x - 2; x <= r.x + r.w + 1; x++) if (cell(m, x, y) === 1 && !inRoom1(r, x, y) && DG.roomAt(m, x * TILE, y * TILE) < 0) mouth.push([x, y]);
      R.en = [Object.assign(e, { x: mouth[0][0] * TILE + 16, y: mouth[0][1] * TILE + 18, st: 'chase', t0: S.t, seenT: S.t, calmT: 0, kbx: 0, kby: 0 })];
      let inside = 0; for (let i = 0; i < 120 * 6 && !inside; i++) { h.x = m.shop.front.x; h.y = m.shop.front.y + 20; step(S, { keys: [] }); if (DG.roomAt(m, e.x, e.y) === r.id && e.st === 'wind') inside = 1; }
      if (lane && !inside) out.push('a monster chasing the hero does not follow it into the shop to strike'); }
    {
      const S = spawn(0, {}); S.run = newRun(S, 'campaign', 1234); S.screen = 'play';
      const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9;
      R.proj = [{ id: R.nextId++, k: 'fire', x: h.x, y: h.y - 20, vx: 0, vy: 0, t0: -2, life: 1.1, dmg: 0, own: 'hero', r: 8 }];
      step(S, { keys: [] });
      if (R.scorches.length !== 1 || !Number.isFinite(R.scorches[0].gx) || !Number.isFinite(R.scorches[0].gy)) out.push('a fireball leaves no scorch on the last open floor');
      for (let i = 0; i < 80; i++) S.ev.push({ k: 'step', x: h.x, y: h.y, t: S.t });
      step(S, { keys: [] });
      if (S.ev.some((e) => e.k === 'boom') || R.scorches.length !== 1) out.push('a busy event log erases the fireball scorch');
      const saved = spawn(0, { run: JSON.parse(JSON.stringify(R)) });
      if (!saved.saved.scorches || saved.saved.scorches.length !== 1) out.push('a save loses the fireball scorch');
      enterFloor(S, R, 2); if (R.scorches.length) out.push('a scorch follows the hero to another floor');
    }
    return out.concat(secretCheck(), propCheck(), reactionCheck(), meleeSpacingCheck());
  }
  function meleeSpacingCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 1234); S.screen = 'play';
    const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const x = (rm.x + rm.w / 2) * TILE, y = (rm.y + rm.h / 2) * TILE;
    R.pots = []; R.chests = []; m.decor = []; m.block = []; m.traps = []; m.water = []; R.shrines = [];
    for (let ty = Math.floor(y / TILE) - 5; ty <= Math.floor(y / TILE) + 5; ty++) for (let tx = Math.floor(x / TILE) - 5; tx <= Math.floor(x / TILE) + 5; tx++) m.cells[ty * m.W + tx] = 1;
    const mob = (type, dx, dy, id = 9000) => ({ id, type, x: x + dx, y: y + dy, vx: 0, vy: 0, hp: 1e6, max: 1e6, dmg: 10, elite: 0, room: rm.id,
      st: 'chase', t0: S.t, face: -1, aimA: Math.PI, cdT: S.t, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 });
    for (const type of ['goblin', 'skeleton', 'ghost', 'brute', 'spider']) for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const E = ENEMIES[type], e = mob(type, Math.cos(a) * 120, Math.sin(a) * 120), stop = E.r + K.R + 6;
      R.en = [e]; R.proj = []; R.freeze = 0; h.hp = 1e6; h.ifr = 0; h.poison = h.burn = 0; h.deadT = -1;
      let close = Infinity;
      for (let i = 0; i < 120 * 5; i++) {
        h.x = x; h.y = y; h.vx = h.vy = 0; step(S, { keys: [] });
        close = Math.min(close, Math.hypot(e.x - h.x, e.y - h.y));
      }
      if (close < stop - 0.1) out.push(`${type}: closes to ${close.toFixed(1)} px, below ${stop}`);
      if (h.hp >= 1e6) out.push(`${type}: cannot hit the hero from its stopping distance`);
      e.x = h.x; e.y = h.y; e.vx = e.vy = 0; R.freeze = 0; step(S, { keys: [] });
      if (Math.hypot(e.x - h.x, e.y - h.y) < stop - 0.1) out.push(`${type}: stays inside the hero after contact`);
    }
    R.en = [mob('goblin', 28, 0), mob('skeleton', 29, -6, 9001), mob('goblin', 29, 6, 9002)];
    h.ifr = 1e9; h.poison = h.burn = 0; R.freeze = 0;
    for (let i = 0; i < 240; i++) {
      h.x = x; h.y = y; step(S, { keys: [] });
      if (R.en.some((e) => Math.hypot(e.x - h.x, e.y - h.y) < ENEMIES[e.type].r + K.R + 5.9)) { out.push('the crowd pushes a monster inside the hero'); break; }
    }
    for (const kind of ['chest', 'wall']) {
      const wallX = (Math.floor(x / TILE) + 2) * TILE, heroX = kind === 'wall' ? wallX - 36 : x;
      const e = mob('goblin', kind === 'wall' ? wallX - 13 - x : 25, 0); R.en = [e]; R.freeze = 0; R.chests = kind === 'chest' ? [{ x: x + 48, y, open: 0 }] : [];
      if (kind === 'wall') for (let ty = Math.floor(y / TILE) - 5; ty <= Math.floor(y / TILE) + 5; ty++) m.cells[ty * m.W + Math.floor(x / TILE) + 2] = 0;
      for (let i = 0; i < 30; i++) {
        h.x = heroX; h.y = y; h.vx = h.vy = 0; step(S, { keys: [] });
        if (Math.hypot(e.x - h.x, e.y - h.y) < 27.9) { out.push(`a ${kind} prevents a monster standing clear of the hero`); break; }
        if (kind === 'chest' && Math.hypot(e.x - x - 48, (e.y - y) * 1.6) < 25.9) { out.push('hero contact pushes a monster into a chest'); break; }
        if (solidAt(m, e.x, e.y, true)) { out.push('hero contact pushes a monster into a wall'); break; }
      }
    }
    return out;
  }
  // a table stops the hero walking into it; a blow on it (or on a brazier) knocks once per swing and carries its material
  function propCheck() {
    const out = []; let S = null, d = null, di = -1;
    for (let sd = 1; sd < 80 && !d; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', 7000 + sd); const m = S.run.map;
      di = m.decor.findIndex((o) => { const x = Math.floor(o.x / TILE), y = Math.floor(o.y / TILE); return o.n === 'table' && [1, 2].every((k) => cell(m, x - k, y) === 1 && !m.block.includes(y * m.W + x - k)); }); d = m.decor[di]; }
    if (!d) return ['prop check: no table with open floor on its left in 80 seeds'];
    S.screen = 'play'; const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9;
    if (!d.solid) out.push('prop check: a table is not solid');
    const A = () => ({ ...toPx(R, d.x, d.y - 30) });
    h.x = d.x - 50; h.y = d.y; let close = 99;
    for (let k = 0; k < 120; k++) { step(S, Object.assign({ right: 1, keys: [] }, A())); close = Math.min(close, d.x - h.x); }
    if (close < 18) out.push(`prop check: the hero walks ${(18 - close).toFixed(0)} px into a table`);
    const swing = () => { h.x = d.x - 40; h.y = d.y; h.cd.atk = 0; step(S, Object.assign({ press: 1, keys: [] }, A())); for (let k = 0; k < 40; k++) { h.x = d.x - 40; h.y = d.y; step(S, Object.assign({ keys: [] }, A())); } };
    S.ev = []; swing(); const hits = S.ev.filter((e) => e.k === 'prop' && e.i === 'd' + di);
    if (hits.length !== 1) out.push(`prop check: a swing at a table knocks it ${hits.length} times`);
    else if (hits[0].mat !== 'wood' || hits[0].s !== 1) out.push(`prop check: a table knocked from the left reads ${hits[0].mat} / ${hits[0].s}`);
    const m = R.map, bi = m.torches.findIndex((t2) => t2.kind === 'brazier');
    if (bi >= 0) { const b = m.torches[bi]; S.ev = []; hitProps(S, R, b.x + 30, b.y, 40);
      if (!S.ev.some((e) => e.k === 'prop' && e.i === 't' + bi && e.mat === 'metal' && e.s === -1)) out.push('prop check: a blow from the right does not knock the brazier'); }
    return out;
  }
  function reactionCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 1234); S.screen = 'play';
    const R = S.run, m = R.map, h = R.hero, x = h.x, y = h.y;
    R.en = []; R.pots = []; R.chests = []; R.shrines = []; m.decor = []; m.torches = []; m.block = []; m.traps = []; m.webs = [];
    for (let ty = Math.floor(y / TILE) - 4; ty <= Math.floor(y / TILE) + 4; ty++) for (let tx = Math.floor(x / TILE) - 4; tx <= Math.floor(x / TILE) + 4; tx++) m.cells[ty * m.W + tx] = 1;
    const bones = { n: 'bones', x: x + 30, y }, candle = { n: 'candles', x, y: y + 30 }, tableCandle = { n: 'candles', x, y: y + 30, lift: 22 };
    m.decor = [bones, candle, tableCandle]; const rs = R.rs;
    hitProps(S, R, x, y, 45); hitProps(S, R, x, y, 45);
    if (S.ev.filter((e) => e.k === 'prop' && e.mat === 'bone').length !== 1) out.push('reaction check: bones must scatter once per strike');
    S.t += 0.44; hitProps(S, R, x, y, 45);
    if (S.ev.filter((e) => e.k === 'prop' && e.mat === 'bone').length !== 2) out.push('reaction check: bones ignore a second sword swing');
    if (candle.outUntil !== S.t - 0.44 + 3 || tableCandle.outUntil) out.push('reaction check: only floor candles go out for three seconds');
    if (S.ev.filter((e) => e.k === 'snuff').length !== 1) out.push('reaction check: snuff smoke missing or repeated');
    if (R.rs !== rs) out.push('reaction check: cosmetic reactions change gameplay RNG');
    S.ev = []; S.t += 1; h.x = x; h.y = y; h.vx = h.vy = 0;
    step(S, { right: 1, keys: ['Space'], ...toPx(R, x + 100, y) });
    if (!S.ev.some((e) => e.k === 'prop' && e.mat === 'bone')) out.push('reaction check: dash does not scatter bones');
    const saved = JSON.parse(JSON.stringify(persist(S))).run.map.decor[1];
    if (saved.outUntil !== candle.outUntil) out.push('reaction check: snuffed candle loses its timer in a save');
    S.ev = []; S.t = candle.outUntil - 0.01; hitProps(S, R, x, y, 45);
    if (S.ev.some((e) => e.k === 'snuff')) out.push('reaction check: unlit candle snuffs again');
    S.ev = []; S.t += 0.02; hitProps(S, R, x, y, 45);
    if (!S.ev.some((e) => e.k === 'snuff')) out.push('reaction check: candle cannot be snuffed after relighting');
    m.torches = [{ x, y, kind: 'fire' }]; S.t += 1; S.ev = []; hitProps(S, R, x - 30, y, 45);
    if (!S.ev.some((e) => e.k === 'prop' && e.mat === 'fire')) out.push('reaction check: campfire rings like metal');
    const sh = m.shop; h.x = sh.front.x; h.y = sh.front.y + 4; h.vx = h.vy = 0; h.cd.atk = 0; R.freeze = 0; S.ev = [];
    const aim = toPx(R, sh.x, sh.y - 35); step(S, { press: 1, keys: [], ...aim });
    for (let i = 0; i < 35; i++) step(S, { keys: [], ...aim });
    if (!S.ev.some((e) => e.k === 'merchantHit') || R.shop.hitLine !== 0) out.push('reaction check: merchant does not react to melee over his counter');
    m.secrets = [{ kind: 'lever', x: x + 64, y, hp: 2, open: 0, wall: [] }]; S.t += 1; S.ev = []; hitSecrets(S, R, x, y, 80, 0, 1);
    if (!S.ev.some((e) => e.k === 'hollow') || m.secrets[0].hp !== 2 || m.secrets[0].open) out.push('reaction check: mechanism wall must answer without breaking');
    for (const ty of [Math.floor(y / TILE), Math.floor((y - 8) / TILE)]) m.cells[ty * m.W + Math.floor((x + 32) / TILE)] = 0;
    S.t += 1; S.ev = []; hitSecrets(S, R, x, y, 80, 0, 1);
    if (S.ev.some((e) => e.k === 'hollow')) out.push('reaction check: hollow sound gives away a secret through rock');
    return out;
  }
  // a run snapshot for localStorage (the whole run is plain JSON)
  // secrets, loot tables and completion stats, played through the sim
  function secretCheck() {
    const out = [];
    // every way a secret opens, played from the floor in front of it: a breakable wall on each side takes two blows, a banner
    // tears at E or a blow, a bookshelf breaks at the second blow, a sconce pulls at E, a flagstone sinks underfoot; nothing
    // else opens them (E at a wall or a shelf, blows at a mechanism's wall). Each opens once and counts once; its chest's items
    // count as loot only once picked up, and an item thrown away and picked up again never counts twice
    const find = (f) => { for (let sd = 1; sd < 120; sd++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 5000 + sd); const q = S.run.map.secrets.find(f); if (q) return [S, q]; } return [null, null]; };
    for (const [name, f] of [['banner', (o) => o.kind === 'banner'], ['shelf', (o) => o.kind === 'shelf'], ['sconce', (o) => o.trig && o.trig.k === 'sconce'], ['plate', (o) => o.trig && o.trig.k === 'plate']]) {
      const [S, q] = find(f); if (!q) { out.push(`secret check: no ${name} secret in 120 seeds`); continue; }
      S.screen = 'play'; const R = S.run, m = R.map, h = R.hero; R.en = []; R.stats[1] = floorStat(R); h.ifr = 1e9;
      const stand = () => { h.x = q.x; h.y = q.y + (name === 'shelf' ? 70 : 34); h.vx = h.vy = 0; };
      const swing = () => { stand(); h.cd.atk = 0; const A = { ...toPx(R, q.x, q.y - 30) }; step(S, Object.assign({ press: 1, keys: [] }, A)); for (let k = 0; k < 40; k++) { stand(); step(S, Object.assign({ keys: [] }, A)); } };
      const press = () => { step(S, { keys: ['KeyE'] }); for (let k = 0; k < 10; k++) step(S, { keys: [] }); };
      if (name === 'banner') { stand(); press(); if (!q.open) out.push('secret check banner: E under it does not tear it'); }
      if (name === 'shelf') { stand(); press(); if (q.open) out.push('secret check shelf: E opens a bookshelf'); swing(); if (q.open) out.push('secret check shelf: one blow breaks it');
        swing(); if (!q.open) out.push('secret check shelf: two blows do not break it');
        const d = m.decor.find((o) => o.secret === m.secrets.indexOf(q)); if (!d || d.solid || m.block.includes(Math.floor(d.y / TILE) * m.W + Math.floor(d.x / TILE))) out.push('secret check shelf: the broken shelf still blocks the way'); }
      if (name === 'sconce') { swing(); swing(); if (q.open) out.push('secret check sconce: blows open a mechanism\'s wall'); if (!S.ev.some((e) => e.k === 'hollow')) out.push('secret check: mechanism wall does not sound hollow'); const t2 = m.torches[q.trig.t]; h.x = t2.x; h.y = t2.y + 50; press(); if (!q.open) out.push('secret check sconce: E under the sconce does not open it'); }
      if (name === 'plate') { swing(); swing(); if (q.open) out.push('secret check plate: blows open a mechanism\'s wall'); h.x = q.trig.x; h.y = q.trig.y; step(S, { keys: [] }); if (!q.open) out.push('secret check plate: stepping on the flagstone does not open it'); }
      if (q.wall.some(([x, y]) => cell(m, x, y) !== 1)) out.push(`secret check ${name}: the opened wall is still solid`);
      if (R.stats[1].sec !== 1) out.push(`secret check ${name}: a found secret is not counted`);
      press(); swing(); if (R.stats[1].sec !== 1) out.push(`secret check ${name}: a found secret counts twice`); }
    // every secret of a few whole campaigns, one by one: the hero is put where its tell is (in front of a wall, under a banner
    // or a sconce, below a shelf, on a flagstone), the collisions settle, and the action meant for it opens it
    for (const sd of [11, 222]) for (let f = 1; f <= D.RUNS.campaign.floors; f++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play';
      const R = S.run, m = R.map, h = R.hero; R.en = []; h.ifr = 1e9; const cells0 = m.cells.slice();
      m.secrets.forEach((q, i) => { const base = m.secrets.map((o) => o.open);
        if (secretMask(m).has(q.front[5][1] * m.W + q.front[5][0])) { m.secrets.forEach((o) => { if (o !== q && !o.open) openSecret(S, R, o, true); }); }
        const settle = (x, y) => { h.x = x; h.y = y; h.vx = h.vy = 0; for (let k = 0; k < 20; k++) step(S, { keys: [], px: 960, py: 540 }); };
        const swing = (tx, ty) => { const A = { ...toPx(R, tx, ty - 30) }; h.cd.atk = 0; step(S, Object.assign({ press: 1, keys: [] }, A)); for (let k = 0; k < 40; k++) step(S, Object.assign({ keys: [] }, A)); };
        const P = q.trig, tc = P && P.k === 'sconce' ? m.torches[P.t] : null;
        if (q.kind === 'crack') { settle(q.x - q.dx * 40, q.y - q.dy * 40); swing(q.x, q.y); swing(q.x, q.y); }
        if (q.kind === 'shelf') { settle(q.x, q.y + 70); swing(q.x, q.y + 22); swing(q.x, q.y + 22); }
        if (q.kind === 'banner') { settle(q.x, q.y + 34); step(S, { keys: ['KeyE'] }); }
        if (tc) { settle(tc.x, tc.y + 50); step(S, { keys: ['KeyE'] }); }
        if (P && P.k === 'plate') settle(P.x, P.y);
        if (!q.open) out.push(`seed ${sd} f${f}: secret ${i} (${q.kind}${P ? ' ' + P.k : ''}, ${q.dir}) does not open from its tell`);
        m.secrets.forEach((o, j) => { if (o.open && !base[j]) { o.open = 0; o.hp = 2; o.hitT = -9; if (kindOf(o) === 'shelf') shelfOf(m, j, true); } });
        for (let k = 0; k < cells0.length; k++) m.cells[k] = cells0[k];
        for (const c of R.chests) c.open = 0; }); }
    // loot: open every chest of a few floors (secret ones too), let the items fall and pick up half of them; the floor's books
    // balance at every stage and no item comes to rest where the hero cannot get to it
    for (const sd of [11, 222]) for (const f of [1, 4, 8]) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play';
      const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9; const check = (when) => { const A = lootAudit(R); if (A.off) out.push(`seed ${sd} f${f}: loot books off by ${A.off} ${when}`); if (A.stuck) out.push(`seed ${sd} f${f}: ${A.stuck} loot out of reach ${when}`); };
      check('on arrival'); for (const c of R.chests) openChest(S, R, c); h.x = R.map.spawn.x; h.y = R.map.spawn.y; for (let k = 0; k < 120; k++) step(S, { keys: [] }); check('with every chest open');
      const pick = R.drops.filter((o) => o.loot && !o.got).slice(0, 6); for (const d of pick) for (let k = 0; k < 3; k++) { h.x = d.x; h.y = d.y; step(S, { keys: [] }); }
      if (pick.some((d) => !d.got)) out.push(`seed ${sd} f${f}: loot could not be picked up`); check('after picking some up'); }
    // debug: the button opens every secret without counting it, and the second press seals exactly those again
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 5001); S.screen = 'play'; const R = S.run, m = R.map, cells0 = m.cells.join(''), block0 = m.block.slice().sort().join(); R.stats[1] = floorStat(R);
      const b = UI.debug(R)[0], click = () => step(S, { keys: [], click: 1, press: 1, px: b.x + 10, py: b.y + 10 });
      step(S, { keys: ['Backquote'] }); if (!S.debug) out.push('debug: ` does not turn debug mode on');
      click(); if (m.secrets.some((q) => !q.open) || m.cells.includes(4)) out.push('debug: not every secret opened'); if (R.stats[1].sec) out.push('debug: secrets opened by the button count as found');
      if (S.ev.some((e) => e.k === 'swing')) out.push('debug: clicking the button swings the sword');
      click(); if (m.secrets.some((q) => q.open) || m.cells.join('') !== cells0 || m.block.slice().sort().join() !== block0) out.push('debug: the second press does not seal the secrets as they were');
      step(S, { keys: ['Backquote'] }); if (S.debug) out.push('debug: ` does not turn debug mode off'); }
    for (const dir of ['u', 'd', 'l', 'r']) { const [S, q] = find((o) => o.dir === dir && o.kind === 'crack');
      if (!q) { out.push(`secret check: no breakable secret on the ${dir} side in 120 seeds`); continue; }
      S.screen = 'play'; const R = S.run, m = R.map, h = R.hero, qi = m.secrets.indexOf(q), hp = q.hp; R.en = []; R.stats[1] = floorStat(R);
      const at0 = () => { h.x = q.x - q.dx * 40; h.y = q.y - q.dy * 40 + (q.dx ? 0 : 0); h.vx = h.vy = 0; }, aim = { ...toPx(R, q.x + q.dx * 30, q.y + q.dy * 30 - 30) };
      h.ifr = 1e9; const swing = () => { at0(); h.cd.atk = 0; const A = { ...toPx(R, q.x + q.dx * 30, q.y + q.dy * 30 - 30) };
        step(S, Object.assign({ press: 1, keys: [] }, A)); for (let k = 0; k < 40; k++) { at0(); step(S, Object.assign({ keys: [] }, { ...toPx(R, q.x + q.dx * 30, q.y + q.dy * 30 - 30) })); } };
      void aim; swing(); if (q.hp !== hp - 1 || q.open) out.push(`secret check ${dir}: a swing at the fake wall does not crack it`);
      if (!S.ev.some((e) => e.k === 'wallhit')) out.push(`secret check ${dir}: no wallhit event`);
      swing(); if (!q.open) out.push(`secret check ${dir}: two swings do not open the secret`);
      if (q.wall.some(([x, y]) => cell(m, x, y) !== 1)) out.push(`secret check ${dir}: the broken wall is still solid`);
      if (R.stats[1].sec !== 1) out.push(`secret check ${dir}: a found secret is not counted`);
      swing(); if (R.stats[1].sec !== 1) out.push(`secret check ${dir}: a found secret counts twice`);
      if (dir !== 'u') continue;
      const c = R.chests.find((o) => o.sec === qi), n0 = R.stats[1].lootN, items = c.loot.length; h.x = c.x; h.y = c.y + 40; step(S, { keys: ['KeyE'] });
      if (!c.open || R.stats[1].lootN !== n0 || R.drops.filter((d) => d.kind === 'item').length !== items) out.push('loot check: a chest\'s items are not the ones counted on entering the floor');
      if (R.stats[1].loot !== 0) out.push('loot check: opening a chest counts as picking up');
      for (let k = 0; k < 120; k++) step(S, { keys: [] });
      for (const d of R.drops.filter((o) => o.kind === 'item')) { h.x = d.x; h.y = d.y; step(S, { keys: [] }); }
      if (R.stats[1].loot !== items) out.push(`loot check: ${R.stats[1].loot} of ${items} picked items counted`);
      const it = h.bag.find((b) => b && b.id === c.loot?.[0]?.id) || h.bag.find((b) => b && !isCons(b)) || Object.values(h.eq).find((e) => e && e.id > 2);
      if (it) { const i = h.bag.indexOf(it); if (i >= 0) h.bag[i] = null; throwAway(R, h, it); h.x += 200; for (let k = 0; k < 60; k++) step(S, { keys: [] }); h.x -= 200;
        for (let k = 0; k < 120; k++) { const d = R.drops.find((o) => o.item === it); if (d) { h.x = d.x; h.y = d.y; } step(S, { keys: [] }); } }
      if (R.stats[1].loot !== items || R.stats[1].lootN !== n0) out.push('loot check: an item thrown away and picked up again changed the loot count');
      const e = { id: 9e6, type: 'skeleton', x: h.x + 30, y: h.y, deadT: -1, hp: 1, elite: 1, st: 'idle', room: 0, kbx: 0, kby: 0 }; R.en.push(e); hitEnemy(S, R, e, 1e6, false, h.x, h.y);
      if (R.stats[1].lootN !== n0 + R.drops.filter((d) => d.loot && d.kind === 'item').length) out.push('loot check: a monster\'s drop is not added to the floor\'s loot');
    }
    { const R = { rs: 99 }, n = 4000, roll = (o) => { let top = 0, epic = 0; for (let i = 0; i < n; i++) { const it = rollItem(R, 5, o.q || 0, undefined, o); top = Math.max(top, it.rar); epic += it.rar >= 3; if (it.rar < (o.min || 0)) top = -9; } return { top, epic: epic / n }; };
      const mob = roll(LOOT.mob), elite = roll(LOOT.elite), chest = roll(LOOT.chest[1]), hoard = roll(LOOT.chest[2]), sec = roll(LOOT.chest[3]), lg = roll(LOOT.boss[0]);
      if (mob.top > 3) out.push('loot: a common monster dropped a legendary');
      if (elite.top < 0) out.push('loot: a minimum rarity was not kept');
      if (lg.top !== 4) out.push('loot: the boss has no guaranteed legendary');
      if (chest.top !== 4 || sec.top !== 4) out.push('loot: a chest roll is capped');
      if (!(mob.epic < chest.epic && chest.epic < hoard.epic && hoard.epic * 1.4 < sec.epic)) out.push(`loot: epic+ share mob ${mob.epic} chest ${chest.epic} treasure ${hoard.epic} secret ${sec.epic}`); }
    // completion: empty categories are left out, partial and full runs, a floor change, save/load, a one-time bonus
    { const C0 = completion([{ foes: 0, kills: 0, lootN: 0, loot: 0, secN: 0, sec: 0 }]); if (C0.pct !== 0) out.push('completion: an empty floor is not 0');
      const C1 = completion([{ foes: 10, kills: 5, lootN: 4, loot: 4, secN: 0, sec: 0 }]); if (Math.abs(C1.pct - 0.75) > 1e-9) out.push('completion: a floor without secrets counts them as 0%');
      const C2 = completion([{ foes: 10, kills: 10, lootN: 4, loot: 4, secN: 1, sec: 1 }, { foes: 6, kills: 6, lootN: 2, loot: 2, secN: 1, sec: 1 }]); if (C2.pct !== 1) out.push('completion: a full run is not 100%');
      const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run;
      const f1 = R.stats[1]; if (!f1 || f1.foes !== R.en.length || f1.lootN !== R.chests.reduce((n, c) => n + c.loot.length, 0) || f1.secN !== R.map.secrets.length) out.push('completion: floor 1 totals wrong');
      const e = R.en[0]; hitEnemy(S, R, e, 1e6, false, e.x, e.y); if (R.stats[1].kills !== 1) out.push('completion: a kill is not counted');
      R.en.push(Object.assign({}, e, { id: 9e6, deadT: -1, hp: 5, summ: 1 })); hitEnemy(S, R, R.en.at(-1), 1e6, false, e.x, e.y);
      if (R.stats[1].kills !== 1 || floorStat(R).foes !== R.stats[1].foes) out.push('completion: a summoned monster counts');
      enterFloor(S, R, 2); if (!R.stats[1] || R.stats[1].kills !== 1 || !R.stats[2] || R.stats[2].kills !== 0) out.push('completion: a floor change lost or mixed the stats');
      const T = spawn(0, { meta: S.meta, run: JSON.parse(JSON.stringify(R)) }); T.screen = 'play'; T.run = T.saved;
      if (JSON.stringify(T.run.stats) !== JSON.stringify(R.stats)) out.push('completion: stats lost on save/load');
      const before = T.meta.shards, W2 = runReward(T.run, 'dead'), found = T.run.shards; endRun(T, 'dead'); endRun(T, 'dead');
      if (T.meta.shards - before !== W2.base + W2.bonus || T.result.shards !== found + W2.base + W2.bonus) out.push('completion: the end bonus was not paid exactly once');
      if (W2.bonus) out.push('completion: an end-of-run thoroughness bonus is still paid');
      // the last kill of a floor pays its 10 shards once, on the spot (TASKS 175)
      { const S2 = spawn(0, {}); step(S2, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S2, { keys: [] }); const R2 = S2.run;
        const live = R2.en.filter((o) => !o.summ && o.deadT < 0), s0 = R2.shards; live.forEach((o, i) => { hitEnemy(S2, R2, o, 1e9, false, o.x, o.y); if (i === live.length - 2 && R2.shards !== s0) out.push('completion: the floor paid before its last kill'); });
        if (R2.shards - s0 !== REWARD.full || !fstat(R2).full.kills) out.push(`completion: the last kill paid ${R2.shards - s0} shards, not ${REWARD.full}`);
        R2.en.push(Object.assign({}, live[0], { id: 9e6 + 1, deadT: -1, hp: 5 })); fstat(R2).foes++; hitEnemy(S2, R2, R2.en.at(-1), 1e9, false, 0, 0);
        if (R2.shards - s0 !== REWARD.full) out.push('completion: a floor paid its kills twice'); }
      const L2 = spawn(0, {}); L2.saved = JSON.parse(JSON.stringify(R)); delete L2.saved.stats; L2.run = L2.saved; L2.screen = 'play'; step(L2, { keys: [] });
      if (!L2.run.stats || L2.run.stats[2].foes !== L2.run.en.filter((o) => !o.summ).length) out.push('completion: an old save gets no stats for its floor'); }
    // doors: shut, a doored room stays unseen and its monsters can't see the hero through the door; E opens it; a locked one holds
    // against E and blows until its key is picked up, which opens it for good; a lever opens every door of its lock
    { for (const kind of ['key', 'lever']) { let S = null, R = null, L = null;
        for (let sd = 1; sd < 60 && !L; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play'; R = S.run;
          for (let f = 1; f <= 3 && !L; f++) { if (f > 1) enterFloor(S, R, f); L = R.map.locks.find((q) => q.kind === kind && R.map.doors.some((d) => d.lock === R.map.locks.indexOf(q))) || null; } }
        if (!L) { out.push(`doors: no ${kind} lock on floors 1–3 of 60 seeds`); continue; }
        const m = R.map, h = R.hero, li = m.locks.indexOf(L), d = m.doors.find((o) => o.lock === li), r = m.rooms[d.room], tag = `doors (${kind}, seed ${R.seed}, floor ${R.floor})`;
        const holder = R.en.find((q) => q.key === li), c = R.chests.find((q) => q.key === li); R.en = R.en.filter((o) => o.room === r.id); const e = R.en[0];
        const [cx, cy] = d.cells[0], dx = d.dir === 'l' ? -1 : d.dir === 'r' ? 1 : 0, dy = d.dir === 'u' ? -1 : d.dir === 'd' ? 1 : 0;
        h.x = (cx + dx + 0.5 + (dx ? 0 : 0.5)) * TILE; h.y = (cy + dy + 0.5 + (dy ? 0 : 0.5)) * TILE + 4; h.vx = h.vy = 0; R.seen.fill(0); R.rseen.fill(0);
        for (let i = 0; i < 6; i++) step(S, { px: 960, py: 540, keys: [] });
        if (R.rseen[r.id] || R.seen[(r.cy) * m.W + r.cx]) out.push(`${tag}: the room shows through its shut door`);
        if (e && e.st !== 'idle' && e.st !== 'home') out.push(`${tag}: a monster sees the hero through the door`);
        step(S, { px: 960, py: 540, keys: ['KeyE'] }); if (d.open) out.push(`${tag}: E opens a locked door`);
        const ax = d.x - h.x, ay = d.y - (h.y - 10); h.atkT = -9; h.cd.atk = 0; step(S, { px: 960 + ax, py: 540 + ay - 40, press: 1, keys: [] }); for (let i = 0; i < 40; i++) step(S, { px: 960 + ax, py: 540 + ay - 40, keys: [] });
        if (d.open) out.push(`${tag}: a blow opens a locked door`);
        if (kind === 'key') { if (c) { h.x = c.x; h.y = c.y + 40; openChest(S, R, c); } else if (holder) { R.en.push(holder); hitEnemy(S, R, holder, 1e9, false, holder.x, holder.y); } else out.push(`${tag}: no key holder`);
          const k = R.drops.find((p) => p.kind === 'key'); if (!k) out.push(`${tag}: its holder gives no key`);
          if (k) { k.x = h.x; k.y = h.y; k.t0 = -9; k.z = k.vz = 0; for (let i = 0; i < 4; i++) step(S, { px: 960, py: 540, keys: [] }); if (R.keys !== 1) out.push(`${tag}: the key is not picked up`); }
          h.x = (cx + dx + 0.5 + (dx ? 0 : 0.5)) * TILE; h.y = (cy + dy + 0.5 + (dy ? 0 : 0.5)) * TILE + 4; R.freeze = 0; step(S, { px: 960, py: 540, keys: ['KeyE'] });
          if (!d.open || R.keys !== 0 || cell(m, cx, cy) !== 1) out.push(`${tag}: the key does not open the door`);
          for (const o of m.doors) if (o.lock === li && o !== d && o.open) out.push(`${tag}: a key opens more than one door`); }
        else { h.x = L.lever.x; h.y = L.lever.y + 50; step(S, { px: 960, py: 540, keys: ['KeyE'] });
          if (!L.open || m.doors.some((o) => o.lock === li && !o.open)) out.push(`${tag}: the lever does not open its doors`); } }
      // an unlocked door: E from in front of it opens it and frees its cells
      { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 5); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero, d = m.doors.find((o) => !doorLock(m, o));
        if (!d) out.push('doors: no plain door on seed 5, floor 1'); else { const [cx, cy] = d.cells[0]; R.en = [];
          if (cell(m, cx, cy) !== 5 || losClear(m, d.x - 40 * (d.dir === 'l' ? -1 : d.dir === 'r' ? 1 : 0), d.y + 40 * (d.dir === 'u' ? 1 : d.dir === 'd' ? -1 : 0), d.x + 40 * (d.dir === 'l' ? -1 : d.dir === 'r' ? 1 : 0), d.y - 40 * (d.dir === 'u' ? 1 : d.dir === 'd' ? -1 : 0))) out.push('doors: a shut door is not solid or lets sight through');
          h.x = d.x; h.y = d.y + (d.dir === 'u' ? 40 : d.dir === 'd' ? -30 : 20); h.x += d.dir === 'l' ? 30 : d.dir === 'r' ? -30 : 0; step(S, { px: 960, py: 540, keys: ['KeyE'] });
          if (!d.open || cell(m, cx, cy) !== 1) out.push('doors: E does not open a door'); } } }
    // loot thrown out of a chest against a wall lands on the room's floor, never in the rock behind it (a potion out of the start
    // room's chest sailed over the wall)
    { let bad = 0; for (let sd = 1; sd <= 25 && !bad; sd++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play'; const R = S.run, m = R.map; R.en = [];
        for (const c of R.chests) if (c.sec === undefined) openChest(S, R, c); for (let i = 0; i < 240; i++) stepDrops(S, R, false);
        for (const p of R.drops) if (m.cells[Math.floor(p.y / TILE) * m.W + Math.floor(p.x / TILE)] !== 1) { bad++; out.push(`loot: seed ${sd} drops a ${p.kind} into the rock at ${Math.round(p.x)},${Math.round(p.y)}`); break; } } }
    // a dash is a leap over spikes: dashed across a plate with its spikes up, or ending on one, the hero takes nothing; walking
    // onto it he is hurt
    { let S = null, R = null, m = null, h = null, tr = null;
      for (let sd = 1; sd < 40 && !tr; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play'; R = S.run; m = R.map; h = R.hero; tr = m.traps.find((o) => !o.cor && [-90, -40, 40, 90].every((d) => cell(m, Math.floor((o.x + d) / TILE), Math.floor(o.y / TILE)) === 1) && !m.traps.some((q) => q !== o && Math.hypot(q.x - o.x, q.y - o.y) < 200)); }
      if (!tr) out.push('dash: no lone spike plate on floor 1 of 40 seeds'); else { R.en = []; const up = (dt = 0) => { tr.ph = ((1 - (S.t / 2.4) % 1) + 0.02 - dt / 2.4 + 1) % 1; };
        const go = (x0, keys, dt) => { h.x = x0; h.y = tr.y; h.vx = h.vy = 0; h.ifr = 0; h.spikeT = -9; h.cd.dash = 0; h.hp = 1e4; up(dt); step(S, { right: 1, px: 960, py: 540, keys }); for (let i = 0; i < 60; i++) step(S, { px: 960, py: 540, keys: [] }); return 1e4 - h.hp; };
        if (go(tr.x - 70, ['Space'])) out.push('dash: a dash across raised spikes hurts');
        if (go(tr.x - 86, ['Space'], 0.3)) out.push('dash: a dash that would come down on a plate is hurt by the spikes rising under it');
        if (!go(tr.x - 4, [])) out.push('dash: standing on raised spikes does not hurt'); } }
    // traps (TASKS 71): a web holds the hero to WEB.k of his pace until a blow tears it; fire burns it; an ambush's flagstone calls
    // P.n monsters round the hero in its room, once, hunting at once, outside the floor's count of foes
    // the web chosen has open floor and no other web for the free run to its left, or the free run measures a wall or a web
    { let S = null, R = null, w = null; const clear = (m, o) => [-200, -150, -100, -50, 0].every((d) => cell(m, Math.floor((o.x + d) / TILE), Math.floor(o.y / TILE)) === 1)
      && !m.webs.some((q) => q !== o && Math.abs(q.y - o.y) < 48 && q.x > o.x - 240 && q.x < o.x);
      for (let sd = 1; sd < 80 && !R; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play';
        for (let f = 1; f <= 4; f++) { if (f > 1) enterFloor(S, S.run, f); const m = S.run.map; w = m.webs.find((o) => clear(m, o)); if (w && m.ambush.length) { R = S.run; break; } } }
      if (!R) out.push('traps: no floor of 80 seeds with webs and an ambush'); else { const m = R.map, h = R.hero; R.en = [];
        const run = (x, y) => { h.x = x; h.y = y; h.vx = h.vy = 0; const x0 = h.x; for (let i = 0; i < 30; i++) step(S, { right: 1, px: 960, py: 540, keys: [] }); return h.x - x0; };
        const free = run(w.x - 200, w.y), held = run(w.x - 12, w.y); if (!(held < free * 0.6)) out.push(`traps: a web does not hold the hero (${held.toFixed(0)} px against ${free.toFixed(0)})`);
        h.x = w.x - 40; h.y = w.y + 8; h.atkT = -9; h.cd.atk = 0; step(S, { px: 960 + 60, py: 540 - 30, press: 1, keys: [] }); for (let i = 0; i < 40; i++) step(S, { px: 1020, py: 510, keys: [] });
        if (!w.torn) out.push('traps: a blow does not tear a web');
        const w2 = m.webs.find((o) => !o.torn); if (w2) { tearWebs(S, R, w2.x, w2.y, 30, undefined, undefined, 1); if (!w2.torn || !S.ev.some((e) => e.k === 'webburn')) out.push('traps: fire does not burn a web'); }
        const P = m.ambush[0], foes = fstat(R).foes; h.x = P.x; h.y = P.y; R.en = []; step(S, { px: 960, py: 540, keys: [] });
        const got = R.en.filter((e) => e.summ === 'amb'); if (!P.fired || got.length !== P.n || got.some((e) => e.st !== 'chase' || DG.roomAt(m, e.x, e.y) !== P.room)) out.push(`traps: an ambush calls ${got.length} of ${P.n} monsters`);
        h.x = P.x + 40; step(S, { keys: [] }); h.x = P.x; step(S, { keys: [] }); if (R.en.filter((e) => e.summ === 'amb').length !== got.length) out.push('traps: an ambush springs twice');
        hitEnemy(S, R, got[0], 1e9, false, P.x, P.y); if (fstat(R).foes !== foes || fstat(R).kills !== 0 && floorStat(R).foes !== fstat(R).foes) out.push('traps: an ambush counts toward the floor'); } }
    // altars: E offers one gift per tier at rising prices; too few shards refuse and take nothing; a gift takes its price, lands
    // on the hero, heals, closes the screen and darkens the altar for good, and survives save/load
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero;
      for (let f = 1; !R.shrines.length && f < D.RUNS.campaign.floors; ) enterFloor(S, R, ++f);
      if (!R.shrines.length) out.push('altar: no altar on any floor of seed 777');
      else { const sh = R.shrines[0], tier = (o) => D.GIFTS.find((q) => q.id === o.id).tier; R.en = []; h.x = sh.x; h.y = sh.y + 40; step(S, { keys: ['KeyE'] });
        if (S.screen !== 'altar' || !sh.gifts || sh.gifts.map(tier).join() !== '1,2,3' || !(sh.gifts[0].cost < sh.gifts[1].cost && sh.gifts[1].cost < sh.gifts[2].cost)) out.push('altar: E does not offer one gift per tier at rising prices');
        const U = UI.altar(), at = (i) => ({ px: U.r[i].x + 5, py: U.r[i].y + 5, click: 1, keys: [] }), o = sh.gifts[2];
        o.id = 'fury'; S.meta.shards = o.cost - 1; const a0 = heroSt(S).atk; step(S, at(2));
        if (S.meta.shards !== o.cost - 1 || sh.used || S.screen !== 'altar') out.push('altar: a gift went through without enough shards');
        S.meta.shards = o.cost + 3; h.hp = 1; step(S, at(2));
        if (S.meta.shards !== 3 || !sh.used || S.screen !== 'play' || heroSt(S).atk <= a0 || h.hp !== heroSt(S).maxHp) out.push('altar: a gift did not take its price, apply, heal or close');
        h.gold = 0; step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); if (S.screen === 'altar') out.push('altar: a spent altar opens with nothing to donate');
        h.gold = 5000; step(S, { keys: [] }); step(S, { keys: ['KeyE'] });
        const bank = S.meta.shards, perks = JSON.stringify(h.perks); step(S, at(2));
        if (S.screen !== 'altar' || S.meta.shards !== bank || JSON.stringify(h.perks) !== perks) out.push('altar: a used altar refuses donations or sells a second gift');
        const T = spawn(0, { meta: S.meta, run: JSON.parse(JSON.stringify(R)) }); if (stats(T.saved.hero, T.meta).atk !== heroSt(S).atk) out.push('altar: a gift is lost on save/load');
        const old = spawn(0, { meta: S.meta, run: JSON.parse(JSON.stringify(R)) }); delete old.saved.hero.perks; if (!(stats(old.saved.hero, old.meta).atk > 0)) out.push('altar: a save without gifts breaks the stats'); } }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero;
      enterFloor(S, R, 6); const sh = R.shrines[0]; R.en = []; h.x = sh.x; h.y = sh.y + 40; openAltar(S, R, sh);
      const b = UI.altar().r.find((o) => o.id === 'donate'), click = { keys: [], click: 1, px: b.x + 5, py: b.y + 5 }, bank = S.meta.shards, found = R.shards;
      h.gold = 999; step(S, click); if (h.gold !== 999 || R.donations || S.meta.shards !== bank) out.push('donations: insufficient gold accepted');
      h.gold = 11000; for (let i = 0; i < 4; i++) step(S, click);
      if (sh.used || R.donations !== 4 || h.gold !== 7000 || R.shards !== found + 4 || S.meta.shards !== bank + 4 || S.screen !== 'altar') out.push('donations: wrong exchange or consumes the gift');
      sh.used = 1; step(S, click); const T = spawn(0, JSON.parse(JSON.stringify(persist(S)))); T.run = T.saved; T.saved = null; T.screen = 'play';
      const RR = T.run; enterFloor(T, RR, 7); openAltar(T, RR, RR.shrines[0]); for (let i = 0; i < 6; i++) step(T, click);
      if (RR.donations !== 10 || RR.hero.gold !== 1000 || T.meta.shards !== bank + 10 || RR.shards !== found + 10) out.push('donations: cap not shared across altars or save/load');
      RR.shrines[0].gifts[0].id = 'greed'; openAltar(T, RR, RR.shrines[0]);
      if (RR.shrines[0].gifts[0].id !== 'alert' || D.GIFTS.some((g) => g.id === 'greed')) out.push('donations: old gold gift still offered');
      RR.hero.perks = { greed: 1 }; if (stats(RR.hero, T.meta).gold !== 1.25) out.push('donations: old gold gift lost on load');
      RR.hero.perks = {}; const dodge = stats(RR.hero, T.meta).dodge; RR.hero.perks.alert = 1;
      if (stats(RR.hero, T.meta).dodge !== Math.min(BAL.dodge.cap, dodge + 5)) out.push('gift: alert grants no dodge'); }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero;
      const actor = { type: 'cultist', elite: 1, mods: ['explosive', 'fiery'] }; h.hp = 9999;
      for (const src of ['spike', 'lava', 'burn', 'cultist (элита) снаряд']) hurtHero(S, R, 4, h.x + 30, h.y, 'spike', src, src.startsWith('cultist') ? actor : null);
      const T = spawn(0, JSON.parse(JSON.stringify(persist(S)))); T.run = T.saved; T.saved = null; T.screen = 'play'; T.run.hero.hp = 1;
      hurtHero(T, T.run, 50, h.x + 30, h.y, 'spike', 'cultist (элита) взрыв', actor); actor.mods.length = 0; endRun(T, 'dead');
      const d = T.result.damage;
      if (d.length !== 3 || d[2].src !== 'cultist (элита) взрыв' || d[2].actor.mods.length !== 2 || d[2].n !== Math.min(50, Math.round(T.result.heroStats.maxHp * BAL.cap.blow)) || !T.result.heroStats || T.run) out.push('end: loses last hit, exact elite, history or hero across save/load');
      if (damageName('cultist (элита) снаряд') !== 'Культист (элита) · снаряд' || damageName('lava') !== 'Лава') out.push('end: damage source not translated'); }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run;
      enterFloor(S, R, 8); const e = R.en.find((o) => o.type === 'boss'), h = R.hero; R.en = [e]; R.proj = []; S.t = 5;
      e.st = 'bwind'; e.mv = 'volley'; e.t0 = 4; e.fired = 0; stepBossMove(S, R);
      const p = R.proj[0]; p.x = h.x; p.y = h.y - 38; p.vx = p.vy = 0; h.hp = 1; h.ifr = 0; h.dashT = -9;
      for (let i = 0; i < 100 && h.deadT < 0; i++) { p.dead = p.spent = 0; R.proj = [p]; stepProjectiles(S, R); }
      if (h.deadT < 0 || !R.recentDamage || !R.recentDamage.slice(-1)[0].actor || R.recentDamage.slice(-1)[0].actor.type !== 'boss') out.push('end: boss volley loses its killer portrait'); }
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 777), f = fstat(R), e = R.en.find((o) => !hidden(R.map, o));
      R.en = [e]; f.foes = 20; f.kills = 16; f.lootN = 20; f.loot = 16; f.secN = 20; f.sec = 0;
      if (completionHints(R).length) out.push('hints: enabled below 85%');
      f.kills = f.loot = 17; const c = R.chests.find((o) => !hidden(R.map, o)); R.chests = [c];
      R.drops = [{ x: e.x, y: e.y, kind: 'item', loot: 1, got: 0 }, { x: e.x, y: e.y, kind: 'item', loot: 0, got: 0 }];
      const hints = completionHints(R);
      if (hints.filter((o) => o.kind === 'foe').length !== 1 || hints.filter((o) => o.kind === 'loot').length !== 2) out.push('hints: misses live foe, chest or item at 85%');
      e.summ = 1; if (completionHints(R).some((o) => o.kind === 'foe')) out.push('hints: summoned enemy highlighted');
      f.kills = f.foes; f.loot = f.lootN; if (completionHints(R).length) out.push('hints: completed categories still highlighted'); }
    // an altar on every second floor and on no other (TASKS 137), the last on the floor before the boss's, none on his (TASKS 183)
    { const bad = [], want = (f) => (f < D.RUNS.campaign.floors && (f % 2 === 0 || f === D.RUNS.campaign.floors - 1) ? 1 : 0);
      for (let seed = 1; seed <= 40; seed++) for (let f = 1; f <= D.RUNS.campaign.floors; f++) { const n = DG.genFloor((seed * 31 + f * 1013) >>> 0, f).shrines.length;
        if (n !== want(f)) bad.push(`seed ${seed} floor ${f}: ${n}`); }
      if (bad.length) out.push(`altar: not one altar on floors 2, 4, 6 and 7 and none on the others (${bad.length}: ${bad.slice(0, 3).join(', ')})`); }
    // each gift does what it says: reach and swing width, potion strength, a kill's meal, thorns back into a close striker (not a far one),
    // one second chance per gift, more damage on a nearly dead monster
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero, give = (id) => { h.perks[id] = (h.perks[id] || 0) + 1; };
      const st0 = heroSt(S); give('reach'); give('cleave'); const st1 = heroSt(S);
      if (!(st1.reach > st0.reach * 1.1 && st1.arc === st0.arc + 25)) out.push('gift: reach or swing width did not grow');
      h.hp = 1; h.bag[0] = potion('hp_potion', 2); usePotion(S, R, 'hp_potion'); const plain = h.hp; give('thrift'); h.hp = 1; usePotion(S, R, 'hp_potion');
      if (!(h.hp > plain * 1.2)) out.push('gift: a stronger brew heals no more');
      const mob = (dx) => { const E = ENEMIES.goblin; const e = { id: 9001, type: 'goblin', x: h.x + dx, y: h.y, vx: 0, vy: 0, hp: 500, max: 500, dmg: 10, elite: 0, room: -1, st: 'chase', t0: 0, face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, r: E.r }; R.en = [e]; return e; };
      give('feast'); h.hp = 10; let e = mob(40); e.hp = 1; hitEnemy(S, R, e, 5, 0, h.x, h.y); if (!(h.hp > 10)) out.push('gift: a kill did not feed the hero');
      give('thorns'); e = mob(40); h.ifr = 0; h.hp = 100; hurtHero(S, R, 40, e.x, e.y, undefined, 'goblin'); struck(S, R, e); const near = 500 - e.hp;
      e = mob(400); h.ifr = 0; h.hurtT = -9; hurtHero(S, R, 40, e.x, e.y, undefined, 'cultist'); struck(S, R, e);
      if (!(near > 0) || e.hp !== 500) out.push(`gift: thorns hit a close striker ${near}, a far one ${500 - e.hp}`);
      give('execute'); e = mob(40); e.hp = 400; hitEnemy(S, R, e, 50, 0, h.x, h.y); const full = 400 - e.hp; e.hp = 100; hitEnemy(S, R, e, 50, 0, h.x, h.y);
      if (!(100 - e.hp > full * 1.4)) out.push('gift: a finishing blow is no stronger');
      give('phoenix'); R.en = []; h.ifr = 0; h.hp = 5; hurtHero(S, R, 9999, h.x + 30, h.y); const once = h.deadT < 0 && h.hp > 0; h.ifr = 0; hurtHero(S, R, 9999, h.x + 30, h.y);
      if (!once || h.deadT < 0) out.push('gift: the second chance did not save the hero once, or saved him twice'); }
    // dodge (BAL.dodge): a blow misses about as often as the hero's dodge says, a dash adds its share but never makes him immune,
    // and lava under a dash does not burn
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero; R.en = [];
      const rate = (dash) => { let miss = 0; for (let i = 0; i < 2000; i++) { h.hp = 1e6; h.dashT = dash ? S.t : -9; const hp0 = h.hp; hurtHero(S, R, 10, h.x + 20, h.y); if (h.hp === hp0) miss++; } return miss / 20; };
      const d0 = heroSt(S).dodge, plain = rate(false), dash = rate(true), want = Math.min(100, d0 + BAL.dodge.dash);
      if (Math.abs(plain - d0) > 2 || Math.abs(dash - want) > 4 || dash >= 99) out.push(`dodge: ${plain}% standing (want ${d0}%), ${dash}% dashing (want ${want}%, never all)`);
      h.hp = 1e6; h.dashT = S.t; hurtHero(S, R, 50, h.x, h.y, undefined, 'lava'); if (h.hp !== 1e6) out.push('dodge: lava burns a dashing hero'); h.dashT = -9; }
    // the new meta perks reach a new hero: heirloom gear a rarity up with its affixes, skill points, mana, regeneration, resistance
    { const up = { gear: 2, skill: 2, mana: 3, regen: 2, resist: 3 }, S = spawn(0, { meta: { shards: 0, up } }), R = newRun(S, 'campaign', 777), h = R.hero, st = stats(h, S.meta);
      const R0 = newRun(spawn(0, {}), 'campaign', 777), st0 = stats(h, { up: {} });
      if (h.eq.weapon.rar !== 2 || h.eq.armor.rar !== 2 || h.eq.weapon.atk <= R0.hero.eq.weapon.atk || Object.keys(h.eq.armor.mods).length !== RARITY[2].affixes) out.push('meta: heirloom gear is not a rarity up');
      if (h.sp !== 2 || st.maxMp !== st0.maxMp + 30 || st.regen !== st0.regen + 1 || Math.abs(st.resist - 0.55) > 1e-9) out.push('meta: skill, mana, regen or resist perk does not apply'); }
    for (const [type, f] of [['boss_spider', 2], ['boss_necro', 4], ['boss_forge', 6], ['boss', 8]]) {
      const S = spawn(0, {}); S.run = newRun(S, 'campaign', 71); S.screen = 'play'; const R = S.run;
      enterFloor(S, R, f); const m = R.map, h = R.hero, b = R.en.find((e) => e.type === type), B = D.BOSSES[type];
      aggroRoom(R, { x: b.x, y: b.y, room: b.room });
      if (b.st !== 'idle') out.push(`boss ${type}: nearby combat wakes the boss before the arena seals`);
      if (m.secrets.some((q) => q.front.some(([x, y]) => DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) === b.room))) out.push(`boss ${type}: secret bypasses sealed arena`);
      if (m.rooms[m.exitRoom].plan !== 'arena' || !m.doors.some((d) => d.arena) || m.enemies.some((e) => e.guard)) out.push(`boss ${type}: arena, gates or guard replacement missing`);
      h.x = b.x; h.y = b.y + 100; h.ifr = 1e9; stepArena(S, R);
      if (!R.arena || !R.arena.active || m.doors.some((d) => d.arena && d.open)) out.push(`boss ${type}: arena does not seal on entry`);
      for (const d of m.doors) if (d.arena) { openDoor(S, R, d, 1); if (d.open) out.push(`boss ${type}: sealed gate can be kicked open`); }
      const room = m.rooms[b.room];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        h.x = (room.x + room.w / 2) * TILE; h.y = (room.y + room.h / 2) * TILE;
        move(m, h, dx * room.w * TILE, dy * room.h * TILE, K.R, true);
        if (DG.roomAt(m, h.x, h.y) !== b.room || boxHit(m, h.x, h.y, K.R, true, false)) out.push(`boss ${type}: a long push crosses the sealed arena`);
      }
      const oldFloor = R.floor; h.x = m.exit.x; h.y = m.exit.y; interact(S, R);
      if (R.floor !== oldFloor) out.push(`boss ${type}: stairs bypass living boss`);
      for (let phase = 1; phase < B.phases.length; phase++) {
        b.st = 'chase'; b.nextMove = null;
        b.hp = b.max * (B.phases[phase].at + 0.001); stepBossMove(S, R); if (b.phase !== phase - 1) out.push(`boss ${type}: phase ${phase} starts too soon`);
        b.hp = b.max * B.phases[phase].at; stepBossMove(S, R); if (b.phase !== phase) out.push(`boss ${type}: phase ${phase} misses threshold`);
      }
      if (type === 'boss') { b.phase = 1; b.hp = b.max * 0.24; beginBossMove(S, R, b, 'volley'); const M = D.bossMove(b);
        S.t += M.wind / 2; stepBossMove(S, R); if (b.phase !== 1) out.push('boss: threshold interrupts committed volley');
        for (let i = 0; i < Math.ceil((M.wind + M.duration) / DT); i++) { S.t += DT; stepBossMove(S, R); }
        if (b.phase !== 2) out.push('boss: queued third phase never starts');
      }
      b.hp = b.max; b.phase = 0; b.st = 'chase'; b.cdT = 0; b.moveI = 0;
      const sequence = [];
      for (let i = 0; i < B.phases[0].moves.length; i++) { bossThink(S, R, b, 100); sequence.push(b.mv); b.st = 'chase'; b.cdT = 0; }
      if (sequence.join() !== B.phases[0].moves.join()) out.push(`boss ${type}: move order changes with time`);
      if (type === 'boss_spider') { const webs = m.webs; m.webs = []; b.vx = b.vy = 0; steer(b, ENEMIES[type], m, [], 1, 100, 0, 100); const vx = b.vx;
        m.webs = [{ x: b.x, y: b.y, s: 1, torn: 0 }]; b.vx = b.vy = 0; steer(b, ENEMIES[type], m, [], 1, 100, 0, 100);
        if (b.vx !== vx) out.push('queen: own webs slow the spider queen'); m.webs = webs;
      }
      if (B.moves.weave) { const n = m.webs.length; bossWebs(S, R, b, B.moves.weave); if (m.webs.length <= n) out.push(`boss ${type}: weave adds no webs`);
        tearWebs(S, R, b.x, b.y, 500, undefined, undefined, 1); if (m.webs.some((w) => w.boss === b.id && !w.torn)) out.push(`boss ${type}: fire leaves webs intact`); }
      if (B.moves.eggs) { bossEggs(S, R, b, B.moves.eggs); const egg = (R.eggs || []).find((o) => o.hp > 0); if (!egg) out.push('queen: no clutch'); else {
          S.t = egg.hatchT; stepArena(S, R); if (!R.en.some((o) => o.type === 'spider' && o.summ === b.id)) out.push('queen: eggs do not hatch');
          bossEggs(S, R, b, B.moves.eggs); const intact = R.eggs.find((o) => o.hp > 0); if (intact) { tearWebs(S, R, intact.x, intact.y, 30); if (intact.hp > 0) out.push('queen: attack does not break eggs'); }
        } }
      if (B.moves.raise) { const o = R.en.find((o) => o !== b && !D.BOSSES[o.type]); if (o) { o.deadT = S.t; o.hp = 0; bossRaise(S, R, b, B.moves.raise);
          if (!o.raised || !R.en.some((e) => e.summ === b.id && e.deadT < 0)) out.push(`boss ${type}: fallen cannot be raised`); } }
      if (B.moves.barrier) { beginBossMove(S, R, b, 'barrier'); S.t += B.moves.barrier.wind + DT; stepBossMove(S, R); const hp = b.hp;
        hitEnemy(S, R, b, 20, 0, b.x, b.y); if (b.hp !== hp || !(b.shield > 0)) out.push(`boss ${type}: barrier does not absorb damage`);
        S.t = b.shieldUntil + DT; hitEnemy(S, R, b, 20, 0, b.x, b.y); if (b.hp >= hp) out.push(`boss ${type}: expired barrier still absorbs damage`);
        if (type === 'boss_necro' && m.decor.filter((d) => d.cover).length < 2) out.push('necro: missing cover columns');
      }
      if (type === 'boss' && (D.bossMove({ type, mv: 'weave', phase: 2 }).vulnerable || 1) !== 1) out.push('boss: the finale opens up while weaving');
      if (B.moves.convergence) { b.shield = 0; beginBossMove(S, R, b, 'convergence'); S.t += B.moves.convergence.wind + DT; stepBossMove(S, R);
        if (!(b.shield > 0)) out.push('boss: third phase raises no barrier');
        if (!m.webs.some((w) => w.boss === b.id && !w.torn) || !R.en.some((o) => o.summ === b.id && o.deadT < 0) || !R.lavaPending.length) out.push('boss: third phase does not combine all chapter mechanics');
      }
      if (B.moves.lava) { for (let i = 0; i < 8; i++) { bossLava(S, R, b, B.moves.lava); S.t += B.moves.lava.warn + DT; stepArena(S, R);
          if (!arenaPath(m, b.room)) out.push(`boss ${type}: lava cuts off arena floor`); }
        if (!(m.arenaLava || []).length) out.push(`boss ${type}: lava does not spread`);
        const restored = JSON.parse(JSON.stringify(persist(S).run)); if (restored.map.arenaLava.length !== m.arenaLava.length) out.push(`boss ${type}: save loses lava`);
      }
      killEnemy(S, R, b); if (m.doors.some((d) => d.arena && !d.open) || arenaSealed(R) || (m.arenaLava || []).length) out.push(`boss ${type}: victory leaves gates or lava sealed`);
      if (f < 8 && (!R.shrines.some((o) => o.boss === type) || m.shrines.length !== 1)) out.push(`boss ${type}: missing exit altar`);
    }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 71); const R = S.run; enterFloor(S, R, 8); const b = R.en.find((e) => e.type === 'boss'); R.hero.ifr = 1e9;
      b.st = 'chase'; b.phase = 888; delete b.bossVersion; stepBossMove(S, R); if (b.phase !== 0) out.push('boss: old phase counter blocks new phases');
      const M = D.BOSSES.boss.moves.volley, old = { n: M.n, wind: M.wind, dmg: M.dmg }; Object.assign(M, { n: 3, wind: 1.9, dmg: 0.123 });
      beginBossMove(S, R, b, 'volley'); S.t += 1; stepBossMove(S, R); if (R.proj.length) out.push('boss: volley ignores data wind');
      S.t += 1; stepBossMove(S, R); if (R.proj.length !== 3 || R.proj.some((p) => p.dmg !== b.dmg * M.dmg)) out.push('boss: volley ignores data count or damage'); Object.assign(M, old);
      const h = R.hero; h.x = b.x + 90; h.y = b.y; h.ifr = 1e9; R.proj = []; beginBossMove(S, R, b, 'volley'); S.t += M.wind + DT; stepBossMove(S, R); const bolt = R.proj[0]; R.proj = [bolt];
      for (let i = 0; i < 70 && !bolt.dead; i++) { S.t += DT; stepProjectiles(S, R); }
      if (!bolt.onHero) out.push('boss: aimed volley misses a stationary hero at melee range');
      b.phase = 1; b.hp = b.max * 0.4; R.proj = []; beginBossMove(S, R, b, 'volley'); const rings = new Set();
      for (let i = 0; i < 200; i++) { S.t += DT; stepBossMove(S, R); for (const p of R.proj) rings.add(p); stepProjectiles(S, R); }
      if ([...rings].filter((p) => p.onHero).length !== 2) out.push('boss: a stationary melee target escapes the shifted double volley');
      h.ifr = 0; h.hp = 1e6; b.hp = b.max * 0.4; R.proj = []; const n0 = S.ev.length; beginBossMove(S, R, b, 'volley');
      for (let i = 0; i < 200; i++) { S.t += DT; h.ifr = 0; stepBossMove(S, R); stepProjectiles(S, R); }
      if (S.ev.slice(n0).filter((e) => e.k === 'hurt' && / снаряд$/.test(e.src)).length > 1) out.push('boss: both rings of one volley wound the hero');
      h.ifr = 1e9;
      // the link (TASKS 227): a charge that lands ends it; one the hero stepped out of is followed by the slam where it stopped
      const run = (aside) => { h.x = b.x + 90; h.y = b.y; h.ifr = 1e9; b.phase = 1; b.hp = b.max * 0.4; R.proj = []; beginBossMove(S, R, b, 'charge'); h.y += aside;
        let slam = null; for (let i = 0; i < 120; i++) { S.t += DT; stepBossMove(S, R); if (b.mv === 'slam' && b.fired) { slam = S.t; break; } if (b.st === 'chase') break; } return slam; };
      if (run(0) !== null) out.push('boss: a landed charge still chains the slam');
      if (run(70) === null) out.push('boss: a charge the hero stepped out of is not followed by the slam');
      h.x = b.x + 90; h.y = b.y; h.ifr = 0; h.hp = heroSt(S).maxHp; const safeHp = h.hp;
      beginBossMove(S, R, b, 'charge'); h.y += K.DASH * K.DASH_T;
      for (let i = 0; i < 240; i++) { S.t += DT;
        if (b.st === 'chase') bossThink(S, R, b, Math.hypot(h.x - b.x, h.y - b.y));
        stepBossMove(S, R); if (b.mv === 'slam' && b.fired) break;
      }
      if (h.hp !== safeHp) out.push('boss: a perpendicular charge dodge still gets caught by the linked slam');
    }
    // hit-stop holds what the player reacts to and keeps the keys pressed in it (TASKS 227)
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 71); S.screen = 'play'; const R = S.run; enterFloor(S, R, 8); const b = R.en.find((e) => e.type === 'boss'), h = R.hero;
      R.en = [b]; h.ifr = 1e9; h.x = b.x + 200; h.y = b.y; b.st = 'bwind'; b.mv = 'slam'; b.t0 = S.t; b.fired = 0; R.arena = { active: 1, room: b.room, t0: S.t };
      const u0 = S.t - b.t0; R.freeze = 0.05; h.cd.dash = 0; const d0 = h.dashT;
      step(S, { keys: ['Space'], px: 960, py: 540 }); for (let i = 0; i < 4; i++) step(S, { keys: [], px: 960, py: 540 });
      if (Math.abs((S.t - b.t0) - u0) > 1e-9 && R.freeze > 0) out.push('hit-stop: a boss wind-up runs on in the freeze');
      for (let i = 0; i < 8; i++) step(S, { keys: [], px: 960, py: 540 });
      if (h.dashT === d0) out.push('hit-stop: a dash pressed in the freeze is lost');
      // a plain monster's wind-up, a bolt's flight clock and a potion key pressed in the freeze
      const e = Object.assign({}, b, { id: R.nextId++, type: 'skeleton', st: 'wind', t0: S.t, hp: 50, max: 50, phase: 0 }); R.en = [b, e]; b.st = 'chase';
      R.proj = [{ id: R.nextId++, x: h.x + 600, y: h.y, vx: 0, vy: 0, t0: S.t, life: 9, dmg: 0, own: 'en', r: 9 }]; const p = R.proj[0];
      h.hp = 10; h.bag[0] = { b: 'hp_potion', n: 1, id: R.nextId++ }; const ue = S.t - e.t0, up = S.t - p.t0; R.freeze = 0.05;
      step(S, { keys: ['KeyQ'], px: 960, py: 540 }); for (let i = 0; i < 3 && R.freeze > 0; i++) step(S, { keys: [], px: 960, py: 540 });
      if (R.freeze > 0 && Math.abs((S.t - e.t0) - ue) > 1e-9) out.push('hit-stop: a monster wind-up runs on in the freeze');
      if (R.freeze > 0 && Math.abs((S.t - p.t0) - up) > 1e-9) out.push('hit-stop: a bolt ages in the freeze');
      for (let i = 0; i < 8; i++) step(S, { keys: [], px: 960, py: 540 });
      if (h.hp <= 10) out.push('hit-stop: a potion pressed in the freeze is lost'); }
    // the water caves as a run of their own (TASKS 300): the menu starts it on the hero screen with its level and kit, its floors
    // carry their run's boss, guard and altars, the boss's death opens the way out, and the campaign's record is left alone
    { const N = D.RUNS.cave, S = spawn(0, {}), r = UI.menu(false).find((q) => q.id === 'cave');
      step(S, { keys: [], click: 1, px: r.x + 10, py: r.y + 10 }); const R = S.run, h = R && R.hero;
      if (!R || R.mode !== 'cave' || S.screen !== 'inv') out.push('cave: the menu button does not start the cave run on the hero screen');
      else {
        if (h.lvl !== N.lvl || h.pts !== 3 * (N.lvl - 1) || h.sp !== N.lvl - 1) out.push(`cave: the hero starts at level ${h.lvl} with ${h.pts} points and ${h.sp} skill points`);
        if (N.kit.gear.some(([b]) => !h.eq[BASES[b].slot] || h.eq[BASES[b].slot].b !== b)) out.push('cave: the kit is not worn');
        if (ABILITIES.some((a) => a.unlock <= h.lvl && !h.ab[a.id])) out.push('cave: an ability of the hero\'s level is still locked');
        for (let f = 1; f <= N.floors; f++) { if (f > 1) enterFloor(S, R, f); const m = R.map, guards = m.enemies.filter((e) => e.guard).length;
          if ((m.bossType || undefined) !== N.boss(f)) out.push(`cave f${f}: boss ${m.bossType} where the run has ${N.boss(f)}`);
          if (!!N.guard[f] !== guards > 0 && !N.boss(f)) out.push(`cave f${f}: ${guards} exit guard(s)`);
          if (m.shrines.length !== ((f % 2 === 0 || f === N.floors - 1) && !N.boss(f) ? 1 : 0)) out.push(`cave f${f}: ${m.shrines.length} altar(s)`);
          if (f === 1 && R.en.some((e) => !D.BOSSES[e.type] && e.max < Math.round(D.ENEMIES[e.type].hp * BAL.hp * (1 + 0.5 * N.depth)))) out.push('cave f1: a monster weaker than the run\'s depth'); }
        const b = R.en.find((e) => D.BOSSES[e.type]); S.screen = 'play'; h.ifr = 1e9; h.x = R.map.exit.x; h.y = R.map.exit.y; interact(S, R);
        if (!S.run) out.push('cave: the way out opens before the boss dies');
        else { const best = S.meta.best; killEnemy(S, R, b); if (!R.bossDead) out.push('cave: the boss\'s death does not open the way out');
          h.x = R.map.exit.x; h.y = R.map.exit.y; interact(S, R);
          if (S.screen !== 'win' || (S.result || {}).mode !== 'cave') out.push('cave: leaving after the boss is not a win of the cave run');
          if (S.meta.best !== best) out.push('cave: the cave run moved the campaign\'s floor record'); } }
      // the cave's water on foot (TASKS 302): the hero wades the shallows slower and neither walks nor dashes into deep water, a
      // monster knocked at deep water stops on the shore, a bolt flies on over it, and the monsters' way round goes over no deep cell
      { const Z = spawn(0, {}); Z.run = newRun(Z, 'cave', 3); Z.screen = 'play'; const R2 = Z.run, m = R2.map, h = R2.hero, W = m.W, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        // a dry cell with three cells of deep water beyond it, in a straight line
        let at0 = null; for (let k = 0; k < m.cells.length && !at0; k++) if (m.cells[k] === 1 && !m.water.includes(k)) for (const [dx, dy] of DIRS) if ([1, 2, 3].every((i) => m.cells[k + i * (dx + dy * W)] === 6)) { at0 = [k, dx, dy]; break; }
        if (!at0) out.push('cave water: no shore with deep water beyond it on floor 1'); else {
          const [k, dx, dy] = at0, x0 = (k % W + 0.5) * TILE, y0 = (Math.floor(k / W) + 0.5) * TILE, deepOn = (o) => cell(m, Math.floor(o.x / TILE), Math.floor(o.y / TILE)) === 6;
          R2.en = []; R2.msg = null; h.ifr = 1e9; h.x = x0; h.y = y0; let inDeep = false;
          const go = { right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0, keys: [] };
          for (let i = 0; i < 120; i++) { step(Z, Object.assign({}, go, { keys: i % 40 === 0 ? ['Space'] : [] })); if (deepOn(h)) inDeep = true; }
          if (inDeep) out.push('cave water: the hero walks or dashes into deep water');
          const E = ENEMIES.skeleton, e = { id: 78000, type: 'skeleton', x: x0, y: y0, vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'idle', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 };
          h.x = x0 - dx * 6 * TILE - dy * 6 * TILE; h.y = y0 - dy * 6 * TILE + dx * 6 * TILE; R2.en = [e]; inDeep = false; void E;
          for (let i = 0; i < 120; i++) { if (i % 20 === 0) { e.kbx = dx * 900; e.kby = dy * 900; } step(Z, { keys: [] }); if (deepOn(e)) inDeep = true; }
          if (inDeep) out.push('cave water: a monster is knocked into deep water');
          R2.en = []; R2.proj = [{ id: R2.nextId++, x: x0, y: y0 - 20, vx: dx * 250, vy: dy * 250, t0: Z.t, life: 3, dmg: 0, own: 'en', r: 6, k: 'hex' }]; const p = R2.proj[0]; let over = false;
          for (let i = 0; i < 60; i++) { step(Z, { keys: [] }); if (cell(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)) === 6 && !p.dead) over = true; }
          if (!over || p.dead) out.push('cave water: a bolt stops at deep water');
          const F = flow(m, k % W, Math.floor(k / W), 1); if (F.some((v, j) => v >= 0 && m.cells[j] === 6)) out.push('cave water: the monsters\' way runs over deep water'); }
        // shallows slow the hero as they do in the campaign's streams
        if (!m.water.length || !inWater(m, { x: (m.water[0] % W + 0.5) * TILE, y: (Math.floor(m.water[0] / W) + 0.5) * TILE })) out.push('cave water: its shallows are not wading water'); }
      // a saved run is dropped only by a second press of the same button
      const T = spawn(0, {}); T.saved = newRun(T, 'campaign', 5); const c = UI.menu(true).find((q) => q.id === 'campaign'), v = UI.menu(true).find((q) => q.id === 'cave');
      step(T, { keys: [], click: 1, px: c.x + 10, py: c.y + 10 }); step(T, { keys: [] }); step(T, { keys: [], click: 1, px: v.x + 10, py: v.y + 10 });
      if (T.run) out.push('cave: a press on another run\'s button drops the saved run'); }
    return out;
  }
  const persist = (S) => ({ meta: S.meta, run: S.run || S.saved || null });

  root.SIM = { openSecret, debugSecrets, lootAudit, openChest, DT, L, K, VIEW, HINT, RIG, create, spawn, respawn, outOfPlay, step, at, scriptInput, demoCheck, selfCheck, persist,
    stepLen, stats, gift, itemName, hitSecret, hitProps, secretMask, hidden, fstat, completion, completionHints, damageName, canDonate, runCompletion, runReward, REWARD, LOOT, itemIcon, itemMods, typeMods, isCons, hand, rollItem, newRun, enterFloor, cell, flow, atCounter, openDoor, pullLever, doorLock, doorNear, leverNear, springAmbush };
  if (typeof module !== 'undefined') module.exports = root.SIM;
})(typeof window !== 'undefined' ? window : globalThis);
