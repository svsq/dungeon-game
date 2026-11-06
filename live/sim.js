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
  const ev = (S, e) => { e.t = S.t; S.ev.push(e); if (S.run && e.k === 'hurt') S.run.recentDamage = (S.run.recentDamage || []).concat({ t: e.t, src: e.src, n: e.n, actor: e.actor || null }).slice(-3);
    if (S.run && e.k === 'boom') S.run.scorches = (S.run.scorches || []).filter((s) => S.t - s.t < 4).concat({ ...e }).slice(-24); if (S.run && S.run.log && !S.demo) note(S, e); };
  // hard's extra damage and HP ramp in over floors 1-3: ×1.3 × ×1.25 from the first room killed a third of average players there (TASKS 200)
  // the run's description (data.js RUNS) and how deep a floor of it is in campaign floors: everything that grows as floors climb
  // reads the depth, the run's own floor numbers only place its bosses, guards and end
  const RUN = (R) => D.runOf(R.mode), STAGE = (R, f = R.floor) => D.stageOf(R.mode, f || 1, R.seed), dep = (R, f = R.floor) => STAGE(R, f).depth, lastFloor = (R) => R.floor === RUN(R).floors;
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
    if (o.town) R.viaTown = 1;
    enterFloor(S, R, o.town ? 0 : 1);
    return R;
  }
  // ---------------- elite powers ----------------
  const MOD = Object.fromEntries(ELITE_MODS.map((m) => [m.id, m])), has = (e, id) => !!(e.mods && e.mods.includes(id));
  function rollMods(R, f) { const [a, b] = D.eliteMods(f), n = a + (b > a && rnd(R) < 0.5 ? 1 : 0), pool = ELITE_MODS.map((m) => m.id), out = [];
    while (out.length < n) out.push(pool.splice(Math.floor(rnd(R) * pool.length), 1)[0]); return out; }
  // what an elite's powers add to a blow of its that landed on the hero
  function struck(S, R, e) {
    const h = R.hero; if (!e || h.hurtT !== S.t) return;
    if (e.type === 'boss_serpent') { e.hitDone = 1; e.openUntil = 0; }
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
      const hp = Math.round(sk.hp * BAL.hp * dif(R, 'hp') * D.hpAt(f));
      R.en.push({ id: R.nextId++, type: 'skeleton', x, y, vx: 0, vy: 0, hp, max: hp, dmg: sk.dmg * BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob, elite: 0, room: e.room, st: 'chase', t0: S.t, face: 1, aimA: 0,
        cdT: S.t + 1, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: e.id, spawnT: S.t, seenT: S.t });
      ev(S, { k: 'summon', x, y }); } }
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
  function blast(S, R, e) { const B = ENEMIES[e.type].boom, M = B || MOD.explosive, h = R.hero; e.fuse = 0;
    if (h.deadT < 0 && Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(R.map, e.x, e.y - 6, h.x, h.y - 6)) hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e) + ' взрыв', e);
    for (const o of R.en) if (o !== e && o.deadT < 0 && Math.hypot(o.x - e.x, o.y - e.y) < M.r + ENEMIES[o.type].r) { if (ENEMIES[o.type].boom) fuse(S, R, o);
      hitEnemy(S, R, o, Math.max(1, Math.round(B ? o.max * B.mon : e.max * 0.25)), false, e.x, e.y, 1.5); }
    breakPots(S, R, e.x, e.y, M.r); ev(S, { k: 'boom', x: e.x, y: e.y - 20, big: 1, r: M.r }); R.trauma = Math.min(1, R.trauma + 0.5); }
  // a smouldering skeleton lights its fuse: it stands hissing through the wind-up and bursts at its end (stepMonsters)
  function fuse(S, R, e) { const E = ENEMIES[e.type]; if (e.st === 'wind' || e.deadT >= 0) return; const d = windOf(e, E.wind);
    e.st = 'wind'; e.t0 = S.t; e.fuse = S.t + d; e.aimA = Math.atan2(R.hero.y - e.y, R.hero.x - e.x); ev(S, { k: 'fuse', x: e.x, y: e.y, r: E.boom.r, d, id: e.id, lit: 1 }); }
  // a floor as it is first entered: the map from its seed, its monsters, chests, pots, altars and merchant rolled off the run's
  // RNG; deterministic from R.rs and R.nextId, so a floor kept as a diff (TASKS 1008) is rebuilt and patched, not stored whole
  function buildFloor(R, f, gen) {
    R.bossDead = 0;
    const m = f === 0 ? DG.genTown((R.seed * 31) >>> 0) : DG.genFloor((R.seed * 31 + f * 1013) >>> 0, f, Object.assign({ mode: R.mode, runSeed: R.seed, town: R.viaTown ? 1 : 0 }, gen)); R.town = f === 0 ? 1 : 0; R.folk = null;
    R.map = m; R.arena = null; R.eggs = []; R.lavaPending = []; R.rocks = []; R.cracks = []; R.en = []; R.proj = []; R.pyres = []; R.fires = []; R.drops = []; R.scorches = []; m.goo = [];
    const stg = STAGE(R, f), d = stg.depth, sc = BAL.hp * dif(R, 'hp') * D.hpAt(d), dc = BAL.dmg * 1.35 * D.dmgAt(d);
    for (const e of m.enemies) { const E = ENEMIES[e.type], guard = e.guard ? stg.guard : e.exit && e.elite ? stg.exit : undefined, gk = (typeof guard === 'object' ? guard.hp : guard) || 1, gd = (typeof guard === 'object' ? guard.dmg : guard) || 1, el = (e.elite && !D.BOSSES[e.type] ? eliteK(e, 'hp') : 1) * gk, bk = (D.BOSSES[e.type] && stg.bossK) || { hp: 1, dmg: 1 };
      R.en.push({ id: R.nextId++, type: e.type, x: e.x, y: e.y, vx: 0, vy: 0, hp: Math.round(E.hp * sc * el * bk.hp), max: Math.round(E.hp * sc * el * bk.hp), dmg: E.dmg * dc * (D.BOSSES[e.type] ? D.dmgAt(d, 1) / D.dmgAt(d) : 1) * (!e.elite ? stg.mob : D.BOSSES[e.type] ? 1.35 : eliteK(e, 'dmg')) * gd * bk.dmg,
        elite: e.elite, guard: e.guard || 0, room: e.room, st: D.BOSSES[e.type] ? 'idle' : E.lurk ? 'lurk' : E.deep ? 'deep' : 'idle', t0: -9, face: rnd(R) < 0.5 ? -1 : 1, aimA: 0, cdT: 0, hitT: -9, deadT: -1, dist: rnd(R) * 50, kbx: 0, kby: 0, burn: 0, burnT: 0, tx: 0, ty: 0, phase: 0, bossVersion: 1, summ: 0, hx: e.x, hy: e.y, seenT: 0, ft: -9 }); }
    for (const e of R.en) if (e.type === 'crab') e.fa = faOf(e);
    m.enemies.forEach((e, i) => { if (e.key !== undefined) R.en[i].key = e.key; });
    for (const e of R.en) if (e.elite && !D.BOSSES[e.type]) e.mods = rollMods(R, d);
    // a closed door is a solid cell (5) that blocks sight like rock until it opens
    for (const d of m.doors || []) if (!d.open) for (const [x, y] of d.cells) m.cells[y * m.W + x] = 5;
    R.keys = 0;
    R.shop = stockShop(R, d);
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
  function restoreFloor(R, f, M) { const B = freshFloor(R, f, M); if (!BASE.has(M)) BASE.set(M, snapFloor(B)); if (M.d) fpatch(B, M.d); for (const k of FLOOR_KEYS) R[k] = B[k];
    R.arena = R.arena || null; R.eggs = R.eggs || []; R.lavaPending = []; R.rocks = []; R.cracks = []; R.proj = []; R.pyres = []; R.fires = []; R.scorches = [];
    R.drops = jclone(M.drops || []); R.seen = M.seen ? unrle(M.seen) : new Array(R.map.W * R.map.H).fill(0); R.rseen = M.rseen ? M.rseen.slice() : R.map.rooms.map(() => 0); }
  function standNear(R, x, y) { const m = R.map, sol = solids(R), ok = (px, py) => !boxHit(m, px, py, K.R, false, false) && !sol.some((o) => Math.hypot(px - o.x, (py - o.y) * 1.6) < o.r + K.R);
    if (ok(x, y)) return [x, y]; for (let d = 6; d <= 160; d += 6) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a * Math.PI / 8 + Math.PI / 2) * d, py = y + Math.sin(a * Math.PI / 8 + Math.PI / 2) * d; if (ok(px, py)) return [px, py]; }
    return [x, y]; }
  function enterFloor(S, R, f, gen, how = 'down') {
    if (R.map && R.viaTown) stashFloor(R);
    if (R.map && R.town && R.shop) R.townShop = R.shop;
    R.floor = f; if (f > 0) R.deepest = Math.max(R.deepest || 0, f); R.propHit = {};   // only the last floor's boss opens the way out: a save from when the 8th was the last carries the lord's
    if (R.log) R.log.fl.push({ f, bag: potCount(R.hero), eq: Object.fromEntries(Object.entries(R.hero.eq).filter(([, it]) => it).map(([k, it]) => [k, gearName(it)])), perks: Object.assign({}, R.hero.perks), time: 0, lvlIn: R.hero.lvl, lvl: R.hero.lvl, xp: 0, minHp: 1, minMp: 1, kills: {}, dmg: {}, hits: {}, pot: {}, ab: {}, gold: 0, buy: 0, sell: 0, buys: [] });
    const M = f > 0 && R.memo && R.memo[f];
    if (M) { restoreFloor(R, f, M); R.town = 0; R.folk = null; }
    else { if (f > 0 && R.viaTown) (R.memo = R.memo || {})[f] = { rs: R.rs, id: R.nextId, mode: R.mode, gen: gen || null }; buildFloor(R, f, gen); if (f > 0 && R.viaTown) BASE.set(R.memo[f], snapFloor(R)); }
    // the town's shelf grows with the deepest floor reached and is restocked only when that has grown, so going back and forth is no free
    // re-roll; the buy-back row goes on across a restock
    if (f === 0) { const dd = R.deepest || 0, old = R.townShop; R.townShop = null;
      if (old && (old.at || 0) === dd) R.shop = old;
      else { if (dd > 0) R.shop = stockShop(R, STAGE(R, dd).depth); R.shop.at = dd; if (old) R.shop.back = old.back; } }
    const m = R.map;
    R.stats = R.stats || {}; if (!M || !R.stats[f]) R.stats[f] = floorStat(R);
    const h = R.hero; let [hx, hy] = [m.spawn.x, m.spawn.y];
    if (how === 'up') [hx, hy] = standNear(R, m.exit.x, m.exit.y + 46);
    else if (how === 'portal') { const P = m.town ? m.town.svc.portal : R.portal; [hx, hy] = standNear(R, P.x, P.y + (m.town ? 40 : 0)); }
    h.x = hx; h.y = hy; h.vx = h.vy = 0; h.bless = 0; h.pull = null; h.read = null;
    // up the stairs or through a portal he may come out by a floor's guard: a second to see where he is
    if (how !== 'down') h.ifr = Math.max(h.ifr || 0, S.t + 1);
    R.zoom = S.demo ? D.ZOOM : S.meta.zoom; R.cam = [h.x - WIN(R).W / 2, h.y - WIN(R).H / 2]; R.camV = [0, 0]; clampCam(R, R.cam);
    reveal(R); ev(S, { k: 'floor', x: h.x, y: h.y, f });
    R.msg = { s: D.placeName(f, R.mode, R.seed), t: S.t };
    S.saveN++;
  }

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
    if (near('kills', 'foes')) for (const e of R.en) if (counted(e) && e.deadT < 0) put(e, 'foe');
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
      if (c < c0) { ev(S, { k: z.k === 'vent' ? 'erupt' : 'rockfall', x: z.x, y: z.y, i }); if (Math.hypot(h.x - z.x, h.y - z.y) < 420) R.trauma = Math.min(1, R.trauma + (z.k === 'vent' ? 0.25 : 0.15)); }
      if (c >= H.burst) return;
      if (h.hp > 0 && D.hazIn(z, h.x, h.y) && !dashing && (h.haz || (h.haz = {}))[tag] !== n) { h.haz[tag] = n;
        hurtHero(S, R, heroSt(S).maxHp * H.hp, z.x, z.y - 10, 'spike', z.k === 'vent' ? 'vent' : 'rock');
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
  // (eased along its line, as its arc is in the render: at full speed from the first frame the take-off and the landing jolted)
  // (its first steps off the landing ease in from a standstill: spd0 0)
  function leapStep(S, R, e, E) { const L0 = E.leap, u = S.t - e.t0, f = Math.max(0, Math.min(1, (u - L0.crouch) / e.ld)), q = f * f * (3 - 2 * f);
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
    return ({ spike: 'Шипы', lava: 'Лава', burn: 'Горение', poison: 'Яд', fire: 'Огонь', vent: 'Жерло', rock: 'Обвал' })[src] || 'Неизвестный источник';
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
  const CRUST = { stand: 1, crack: 0.5, hot: 3.5, set: 0.8 }, CRS = new WeakMap();
  const crustSet = (m) => { if (!m.crust || !m.crust.length) return null; let s = CRS.get(m); if (!s) CRS.set(m, s = new Set(m.crust)); return s; };
  const crustAt = (m, k) => { const s = crustSet(m); return !!s && s.has(k) && !(m.melt && m.melt[k] && m.melt[k].hot); };
  // the plateaus' chasm (TASKS 400): the rock below the top wall, which only a blow knocks a monster into (TASKS 401)
  const chasm = (m, tx, ty) => !!m.cliff && tx > 0 && ty > 0 && tx < m.W - 1 && ty < m.H - 1 && ty >= m.cliff[tx] && m.cells[ty * m.W + tx] === 0;
  // lava (3) can be entered — it burns — by the hero (not on the plateaus, where it stops him at the bank as deep water does, TASKS
  // 401, but for a boss's tongues of it, which he must be able to cross) and by a monster knocked into it; a monster never walks into it on its own. lavaOk 2: a blow carries a monster into the chasm
  const solidAt = (m, x, y, mon, lavaOk) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), c = cell(m, tx, ty);
    if (c === 3) { const k = ty * m.W + tx; if (crustAt(m, k)) return !!mon && !lavaOk; return !lavaOk && !(!mon && m.arenaLava && m.arenaLava.includes(k)); } if (c === 0 && lavaOk === 2 && chasm(m, tx, ty)) return false; return c !== 1; };
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
    // on the plateaus (TASKS 453) the window is an ellipse, not its 17×13 box: over open lava nothing stops the sight, and the box's
    // straight sides showed as a rectangle of lava in the dark
    const rooms = new Set(), oval = !!m.cliff;
    for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 8; x <= tx + 8; x++) { if (!inMap(x, y) || (oval && ((x + 0.5 - fx) / 8.5) ** 2 + ((y + 0.5 - fy) / 6.5) ** 2 > 1) || !sight(x, y)) continue;
      if (opaque(x, y)) { wall(x, y); continue; }
      R.seen[y * W + x] = 1; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) wall(x + u, y + v);
      const ri = DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE); if (ri >= 0) rooms.add(ri); }
    // a room shows whole once seen; a plateau's box is mostly lava, so there only its floor and the lava within two cells of it
    // (TASKS 453: the whole box was a rectangle of lava cut out of the dark)
    const nearFloor = (x, y, r) => { for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) { const X = x + u, Y = y + v;
      if (X >= r.x - 1 && X <= r.x + r.w && Y >= r.y - 1 && Y <= r.y + r.h && inMap(X, Y) && m.cells[Y * W + X] === 1) return true; } return false; };
    for (const ri of rooms) { if (R.rseen[ri]) continue; R.rseen[ri] = 1; const r = m.rooms[ri];
      for (const [bx, by, bw, bh] of DG.rectsOf(r)) for (let y = by - 2; y <= by + bh + 1; y++) for (let x = bx - 2; x <= bx + bw + 1; x++) { if (!inMap(x, y)) continue;
        const own = DG.inRm(r, x, y);
        if (oval && m.cells[y * W + x] !== 1 && !nearFloor(x, y, r)) continue;
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
  function hitEnemy(S, R, e, dmg, crit, sx, sy, kb = 1, kind, ax = sx, ay = sy) {
    if (e.deadT >= 0 || under(e) || R.town) return;
    if (R.map.bossType === e.type && !R.arena) { stepArena(S, R); if (!R.arena) return; }
    if (D.BOSSES[e.type] && e.st === 'bwind') dmg *= D.bossMove(e).vulnerable || 1;
    if (D.BOSSES[e.type] && e.openUntil > S.t) dmg *= e.type === 'boss_serpent' ? 1.4 : D.BOSSES[e.type].moves.fists.open;
    let arm = armored(e, ENEMIES[e.type], ax, ay); if (arm) { dmg = Math.max(1, Math.round(dmg * ENEMIES[e.type].armor.k)); e.armT = S.t; }
    // a golem's crust takes the blow and a plate of it comes off (TASKS 409); its fire doesn't
    const CR0 = ENEMIES[e.type].crust; if (CR0 && kind !== 'burn' && kind !== 'thorns' && crustOf(e, ENEMIES[e.type]) > 0) { dmg = Math.max(1, Math.round(dmg * CR0.k)); const n0 = crustOf(e, ENEMIES[e.type]); e.crust = n0 - 1; e.growT = S.t; e.armT = S.t; arm = true;
      (e.plateT = e.plateT || {})[n0] = S.t; (e.plateA = e.plateA || {})[n0] = Math.atan2(e.y - sy, e.x - sx); }   // (which plate went when, and which way: the render throws it off)
    dmg = absorbShield(S, e, dmg, { id: e.id }); if (dmg <= 0) return;
    if (gift(R.hero, 'execute') && e.hp < 0.25 * e.max) dmg = Math.round(dmg * (1 + gift(R.hero, 'execute') / 100));
    // blowT: a blow, not a burn's tick (a golem's crust grows back once the blows stop, TASKS 409)
    e.hp -= dmg; e.hitP = e.hitT; e.hitT = S.t; if (kind !== 'burn' && kind !== 'thorns') e.blowT = S.t; if (e.st === 'idle' || e.st === 'home') aggroRoom(R, e); if (e.st === 'lurk') rise(S, R, e);
    const dx = e.x - sx, dy = e.y - sy, d = Math.hypot(dx, dy) || 1, heavy = e.type === 'brute' || ENEMIES[e.type].heavy || e.elite || ENEMIES[e.type].ghost || ENEMIES[e.type].deep || e.st === 'rise' || e.st === 'leap';
    if (!heavy && !arm) { e.kbx += dx / d * 300 * kb; e.kby += dy / d * 300 * kb; }
    if (kind === 'fire' && !ENEMIES[e.type].lava) { e.burn = S.t + 3; e.burnT = S.t; }
    ev(S, Object.assign({ k: 'hit', x: e.x, y: e.y - ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: dmg, crit: crit ? 1 : 0, id: e.id, fire: kind === 'fire' ? 1 : 0 }, arm ? { arm: 1, a: Math.atan2(ay - e.y, ax - e.x) } : {}));
    R.freeze = Math.max(R.freeze, crit ? 0.06 : 0.035); R.trauma = Math.min(1, R.trauma + (crit ? 0.22 : 0.12));
    const st = heroSt(S); if (kind !== 'burn' && kind !== 'thorns') R.hero.hp = Math.min(st.maxHp, R.hero.hp + dmg * st.leech / 100 + st.onhit);
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
    for (const k of on) { const q = M[k] || (M[k] = { on: 0 }); if (q.crackT !== undefined) continue; q.on += DT; if (q.on < CRUST.stand) continue;
      for (const n of [k, k + 1, k - 1, k + m.W, k - m.W]) if (cs.has(n) && (!M[n] || M[n].crackT === undefined)) M[n] = { on: CRUST.stand, crackT: t };
      ev(S, { k: 'crack', x: (k % m.W + 0.5) * TILE, y: (Math.floor(k / m.W) + 0.5) * TILE }); }
    for (const key in M) { const q = M[key], k = +key, x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE;
      if (q.crackT === undefined) { if (!on.has(k) && (q.on -= 2 * DT) <= 0) delete M[key]; continue; }
      if (!q.hot && q.meltT === undefined && t >= q.crackT + CRUST.crack) { q.hot = 1; q.meltT = t; ev(S, { k: 'melt', x, y }); }
      else if (q.hot && t >= q.meltT + CRUST.hot) { q.hot = 0; q.setT = t; ev(S, { k: 'set', x, y }); }
      else if (!q.hot && q.setT !== undefined && t >= q.setT + CRUST.set) delete M[key]; }
  }
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
    if (E.boom) { if (e.blown || e.fallT !== undefined || e.sinkT !== undefined) e.fuse = 0; else if (!(e.fuse > S.t)) { e.fuse = S.t + E.boom.fuse; ev(S, { k: 'fuse', x: e.x, y: e.y, r: E.boom.r, d: E.boom.fuse, id: e.id }); } }
    else if (has(e, 'explosive')) { e.fuse = S.t + MOD.explosive.fuse; ev(S, { k: 'fuse', x: e.x, y: e.y, r: MOD.explosive.r, d: MOD.explosive.fuse, id: e.id }); }
    ev(S, Object.assign({ k: 'kill', x: e.x, y: e.y, type: e.type, id: e.id }, e.sinkT !== undefined || e.fallT !== undefined ? { gone: 1 } : {}));
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
    if (D.BOSSES[e.type]) finishArena(S, R, e);
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
  const READ_T = 1.6, bossFight = (R) => !!(R.map.bossType && R.en.some((e) => D.BOSSES[e.type] && e.deadT < 0 && e.st !== 'idle'));
  // the scroll being read: a step, a dash or a blow breaks it off (the scroll is kept); read through, the portal opens where the hero
  // stands and takes him to the town's ring of stones; its pair in the town brings him back to that spot (and closes)
  function readStep(S, R, moved, dashing) { const h = R.hero, q = h.read;
    if (moved || dashing || h.deadT >= 0 || h.atkT > q.t0 || (h.castT ?? -9) > q.t0) { h.read = null; ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Чтение прервано' }); return; }
    if (S.t - q.t0 < READ_T) return;
    const it = h.bag[q.i]; h.read = null; if (!it || it.b !== 'scroll') return; if (--it.n <= 0) h.bag[q.i] = null;
    R.portal = { f: R.floor, x: h.x, y: h.y }; ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); enterFloor(S, R, 0, undefined, 'portal'); ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); }
  function useItem(S, R, idx) {
    const h = R.hero, it = h.bag[idx]; if (!it) return;
    if (it.b === 'hp_potion' || it.b === 'mp_potion') { usePotion(S, R, it.b); return; }
    // in a run through the town (TASKS 1007) the scroll is read on the spot, READ_T s standing still, and opens a portal home
    if (it.b === 'scroll' && R.viaTown) { S.screen = 'play';
      if (R.town) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'В городе свиток не нужен' }); return; }
      if (bossFight(R)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Не посреди боя с боссом' }); return; }
      h.read = { t0: S.t, i: idx }; h.vx = h.vy = 0; ev(S, { k: 'read', x: h.x, y: h.y }); return; }
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
  function hitProps(S, R, x, y, rad, ax, arc, bonesOnly = false) {
    const m = R.map, hit = R.propHit || (R.propHit = {});
    // things on a wall are struck at their foot on the floor (the wall cell blocks the line), the event stays at the thing
    const knock = (id, p, n, mat = D.PROP_MAT[n] || 'stone', foot = p) => { const dx = foot.x - x, dy = foot.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 18) return false; if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) return false; if (!losClear(m, x, y, foot.x, foot.y)) return false;
      if (S.t - (hit[id] ?? -9) < 0.2) return false; hit[id] = S.t;
      if (mat === 'stone' || mat === 'metal') R.trauma = Math.min(1, R.trauma + 0.06);
      if (n !== 'merchant') ev(S, { k: 'prop', x: p.x, y: p.y, i: id, n, mat, scale: p.s || 1, s: dx >= 0 ? 1 : -1 }); return true; };
    m.decor.forEach((d, i) => { if (hidden(m, d)) return;
      if (d.n === 'bones' || d.n === 'skel_cv') knock('d' + i, d, d.n);
      else if (bonesOnly) return;
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
    return { total: f.lootN, got: f.loot, lying, boxed, list: items.concat(chests), stuck: items.concat(chests).filter((o) => o.at === 'stuck').length, off: f.lootN - f.loot - lying - boxed }; }
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
    const spd = K.RUN * (1 + st.mspd / 100) * (t - h.atkT < 0.2 ? 0.55 : 1) * (inWater(m, h) ? WADE : 1) * (webAt(m, h) ? WEB.k : 1) * (gooAt(m, h) ? GOO.k : 1) * (soaked(S, h) ? ORB.slow : 1);
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
      h.dashT = t; h.dashX = dx / d; h.dashY = dy / d; h.cd.dash = t + K.DASH_CD; ev(S, { k: 'dash', x: h.x, y: h.y, dx: h.dashX, dy: h.dashY });
      // the dash beats the flames out (TASKS 463: burning took the most hits and nothing put it out away from water)
      if (h.burn > t) { h.burn = 0; ev(S, { k: 'snuff', x: h.x, y: h.y, hero: 1 }); } }
    // a dash is a leap: spikes under it never bite, and one that would come down on a plate carries on until it is clear of it
    const onSpikes = m.traps.some((tr) => onPlate(h, tr)), leap = t - h.dashT < K.DASH_T;
    if (leap && onSpikes) h.leapT = h.dashT; else if (!onSpikes) h.leapT = -9;
    const dashing = leap || (h.leapT === h.dashT && t - h.dashT < K.DASH_T + K.LEAP);
    const mvx = dashing ? h.dashX * K.DASH : h.vx, mvy = dashing ? h.dashY * K.DASH : h.vy;
    const ox = h.x, oy = h.y; const [bx, by] = move(m, h, mvx * DT, mvy * DT, K.R); if (bx) h.vx = 0; if (by) h.vy = 0;
    // a drowned's grab draws the hero a step toward it at an even pace
    if (h.pull) { const P = h.pull, sp = Math.min(P.n / P.T * DT, P.n - P.done); move(m, h, P.x * sp, P.y * sp, K.R); P.done += sp; if (P.done >= P.n - 0.01) h.pull = null; }
    shove(m, h, K.R, false, solids(R));
    { const w = webAt(m, h); if (w && h.web !== m.webs.indexOf(w)) ev(S, { k: 'web', x: w.x, y: w.y, i: m.webs.indexOf(w) }); h.web = w ? m.webs.indexOf(w) : -1; }
    { const g = gooAt(m, h); if (g && h.gooIn !== g.id) ev(S, { k: 'goo', x: h.x, y: h.y }); h.gooIn = g ? g.id : -1; }
    m.goo = (m.goo || []).filter((g) => t < g.t0 + g.T); for (const g of m.goo) g.rNow = g.r * Math.min(1, (g.t0 + g.T - t) / GOO.dry);
    const moved = Math.hypot(h.x - ox, h.y - oy);
    if (moved > 0.02 && dashing) hitProps(S, R, h.x, h.y, K.R, undefined, undefined, true);
    if (moved > 0.02) {
      const hits = R.propHit || (R.propHit = {});
      m.decor.forEach((d, i) => {
        const fungus = /^shroom_[ab]$/.test(d.n); if (!fungus && d.n !== 'skel_cv') return;
        if (hidden(m, d) || Math.hypot(d.x - h.x, d.y - h.y) > (fungus ? 25 : 30) || !losClear(m, h.x, h.y, d.x, d.y)) return;
        const id = 'd' + i; if (S.t - (hits[id] ?? -9) < 0.65) return;
        hits[id] = S.t; ev(S, { k: 'prop', x: d.x, y: d.y, i: id, n: d.n, mat: fungus ? 'fungus' : 'bone', scale: d.s || 1, touch: 1, s: h.x < d.x ? 1 : -1 });
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
        const c = rnd(R) * 100 < st.crit; hitEnemy(S, R, e, Math.max(1, Math.round(st.atk * (0.9 + 0.2 * rnd(R)) * (c ? 1.75 : 1) * (h.bless ? 1.2 : 1))), c, h.x, h.y, st.kb); }
      breakPots(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitProps(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitChests(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitSecrets(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitDoors(S, R, h.x, h.y, reach + 10, h.atkA, arc); tearWebs(S, R, h.x, h.y, reach + 10, h.atkA, arc);
    }
    // ---- abilities / potions / interact ----
    if (inp.slot >= 1 && inp.slot <= 3) castAbility(S, R, ABILITIES[inp.slot - 1].id, inp);
    if (inp.rclick) castAbility(S, R, 'fireball', inp);
    if (keys.KeyQ) usePotion(S, R, 'hp_potion');
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
      if (!route) { f.spd = 0; continue; }
      let want = 0, ux = 0, uy = 0;
      if (!folkTalk(f, t) && !f.go && t >= f.t0 + folkPause(f, route[f.way])) { f.go = 1; f.way = (f.way + 1) % route.length; f.stuck = 0; }
      if (f.go && !folkTalk(f, t)) { const tg = route[f.way], dx = tg.x - f.x, dy = tg.y - f.y, d = Math.hypot(dx, dy);
        if (d < 1.5) { f.go = 0; f.t0 = t; f.x = tg.x; f.y = tg.y; f.spd = 0;
          if (tg.act === 'take') f.load = 1; else if (tg.act === 'drop') f.load = 0; if (tg.act) ev(S, { k: 'toss', x: f.x, y: f.y }); }
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
      if (!moved) { f.vx = f.vy = 0; f.spd = 0; if ((f.stuck += DT) > 4) { f.way = (f.way + 1) % route.length; f.stuck = 0; } } else f.stuck = 0;
      if (Math.abs(f.vx) > 3) f.face = f.vx > 0 ? 1 : -1; }
    // the merchant calls the hero over from across the yard, every so often
    if (m.shop && R.shop) { const d = Math.hypot(h.x - m.shop.x, h.y - m.shop.y);
      if (alive && d > 240 && d < 560 && t - (R.shop.callT ?? -99) > 11) { R.shop.callT = t; R.shop.callN = ((R.shop.callN ?? -1) + 1) % D.SHOP.calls.length; ev(S, { k: 'say', x: m.shop.x, y: m.shop.y, role: 'merchant' }); } }
  }
  const solids = (R) => { const out = []; for (const c of R.chests) out.push({ x: c.x, y: c.y, r: 16 }); for (const p of R.pots) if (p.hp > 0) out.push({ x: p.x, y: p.y, r: 11 });
    for (const t2 of R.map.torches) if (t2.kind !== 'wall') out.push({ x: t2.x, y: t2.y, r: t2.kind === 'fire' ? 20 : 12 }); for (const s of R.shrines) out.push({ x: s.x, y: s.y, r: 18 }); for (const d of R.map.decor) if (d.solid) out.push({ x: d.x, y: d.y, r: 18 });
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
    // the town's end of a portal (TASKS 1007): back to where the scroll was read; the portal closes behind the hero
    if (R.town && R.portal && m.town && Math.hypot(m.town.svc.portal.x - h.x, m.town.svc.portal.y - h.y) < 64) { const P = R.portal;
      ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); enterFloor(S, R, P.f, undefined, 'portal'); R.portal = null; ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); return; }
    // the stairs on past the serpent (TASKS 354): shut till it falls; taking them wins the campaign there and then and the run goes on
    if (m.down && Math.hypot(m.down.x - h.x, m.down.y - h.y) < 60) { if (R.bossDead) descend(S, R); else ev(S, { k: 'nope', x: h.x, y: h.y, s: RUN(R).seal }); return; }
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
          for (const e of R.en) if (e.deadT < 0 && Math.hypot(e.x - p.x, (e.y - ENEMIES[e.type].h * 0.4 - p.y) * 1.2) < 66 + ENEMIES[e.type].r && losClear(m, bx, by, e.x, e.y)) hitEnemy(S, R, e, p.dmg, false, p.x, p.y, 1.2, 'fire', p.x, p.y + ENEMIES[e.type].h * 0.45);
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
      if (e.kbx || e.kby) { move(m, e, e.kbx * DT, e.kby * DT, E.r, true, !E.ghost && (m.cliff && !D.BOSSES[e.type] ? 2 : true)); e.kbx *= Math.exp(-10 * DT); e.kby *= Math.exp(-10 * DT); if (Math.abs(e.kbx) + Math.abs(e.kby) < 4) e.kbx = e.kby = 0;
        if (e.fallT === undefined && chasm(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) { e.fallT = t; e.kbx = e.kby = 0; ev(S, { k: 'fall', x: e.x, y: e.y, id: e.id, type: e.type }); } }
      // knocked off a plateau (TASKS 401): into the chasm it falls, in the lava it burns; either way it is gone in a moment
      if (e.fallT !== undefined || e.sinkT !== undefined) { e.vx = e.vy = 0; if (t >= (e.fallT ?? e.sinkT) + (e.fallT !== undefined ? DOOM.fall : DOOM.sink)) killEnemy(S, R, e); continue; }
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy);
      if (e.face !== e.pf) { if (e.pf) e.ft = t; e.pf = e.face; }
      if (E.kind === 'eel') { eel(S, R, e, E, heroOk, d); continue; }
      if (E.kind === 'serpent') { serpent(S, R, e, heroOk); continue; }
      if (E.lake && (e.st === 'idle' || e.st === 'emerge' || e.st === 'wade')) { colossusRise(S, R, e); continue; }
      if (E.kind === 'bomber' && e.st === 'wind') { skid(m, e, E); if (t >= e.fuse) { e.blown = 1; blast(S, R, e); killEnemy(S, R, e); } continue; }
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
    R.map.flood = null;
    if (R.map.arenaWater?.length) { const wet = new Set(R.map.arenaWater); R.map.water = R.map.water.filter((k) => !wet.has(k)); R.map.arenaWater = []; WET.delete(R.map); }
    for (const k of R.map.arenaLava || []) if (R.map.cells[k] === 3) { R.map.cells[k] = 1; R.map.lava--; }
    R.map.arenaLava = []; R.lavaPending = []; R.rocks = []; R.cracks = []; R.fires = (R.fires || []).filter((p) => p.src !== e.id); R.map.geometry = (R.map.geometry || 0) + 1;
    for (const d of R.map.doors || []) if (d.arena && !d.open) openDoor(S, R, d, 0);
    for (const o of R.en) if (o.summ === e.id && o.deadT < 0) { o.deadT = S.t; o.hp = 0; }
    for (const o of R.eggs || []) if (o.owner === e.id) o.hp = 0;
    if (!lastFloor(R)) { R.msg = { s: ENEMIES[e.type].name + ': победа! Алтарь и лестница открыты', t: S.t }; if (!chapterEnd(R, e)) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), 2) }); }
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
    R.msg = { s: 'Кампания пройдена! +' + W2.base + ' осколков душ. Спуск продолжается: этаж ' + R.floor + ' — ' + D.floorName(R.floor, R.mode, R.seed), t: S.t, d: 5 }; }
  function startRun(S, mode = 'campaign') { const seed = (S.seedBase + S.meta.runs * 7777 + Math.floor(S.t * 1000)) >>> 0, town = mode === 'town'; S.run = newRun(S, town ? 'campaign' : mode, seed, { town }); S.saved = null;
    S.screen = S.run.hero.pts > 0 && RUN(S.run).lvl > 1 ? 'inv' : 'play'; }

  // a saved run is dropped only on a second press of the same run's button
  const pressRun = (S, id, arm) => { if (!S.saved || arm === id) { S.resetT = undefined; startRun(S, id); } else { S.resetT = S.t; S.resetM = id; } };
  function stepUI(S, inp, keys) {
    const x = inp.px, y = inp.py, click = inp.click;
    if (S.screen === 'menu') {
      const arm = S.resetT !== undefined && S.t - S.resetT < 3 && S.resetM, b = D.hitUI(UI.menu(!!S.saved, S.meta.diff, arm, S.meta.zoom), x, y); S.hover = b ? b.id : '';
      if (click && b && b.on) {
        if (b.id === 'continue') { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; S.run.msg = { s: D.placeName(S.run.floor, S.run.mode, S.run.seed), t: S.t }; }
        if (D.RUNS[b.id]) pressRun(S, b.id, arm);
        if (b.id === 'tests') S.screen = 'tests';
        if (b.id === 'diff') { const o = D.DIFF_ORDER; S.meta.diff = o[(o.indexOf(S.meta.diff || 'normal') + 1) % o.length]; S.saveN++; }
        if (b.id === 'zoom') nextZoom(S);
        if (b.id === 'meta') S.screen = 'meta';
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
      const b = D.hitUI(UI.end(S.result && S.result.log, S.result && S.result.town), x, y); S.hover = b ? b.id : '';
      if (click && b && b.on) { if (b.id === 'log') { S.logReq = (S.logReq || 0) + 1; ev(S, { k: 'ui', x, y }); } else if (b.id === 'menu') S.screen = 'menu'; else startRun(S, S.result && S.result.town ? 'town' : S.result && !S.result.campaignWon && S.result.mode || 'campaign'); }
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
    // (the campaign's 9th–12th are cave floors, TASKS 339: held to the caves' rules, kind 'cave')
    const GEN = [1, 77, 4242, 90001].flatMap((sd) => Array.from({ length: D.RUNS.campaign.floors }, (_, i) => ['campaign', sd, i + 1]))
      .concat([1, 77, 4242, 90001, 5, 12, 33, 2024].flatMap((sd) => Array.from({ length: D.RUNS.cave.floors }, (_, i) => ['cave', sd, i + 1])))
      // the magma caves' plateaus (TASKS 400): held to the caves' rules but the water's, and to their own
      .concat([1, 77, 4242, 5, 12, 33].flatMap((sd) => Array.from({ length: D.RUNS.magma.floors }, (_, i) => ['magma', sd, i + 1])))
      // a 5×5 cave pocket for a start room with no clear spot by the fire: the hero arrived inside the rock (run seed 93, TASKS 335)
      .concat([['campaign', 101, 9]]);
    const caveKinds = {}, shapes = {};
    for (const [run, sd, f] of GEN) { const ST = D.stageOf(run, f), mode = ST.arch === 'cave' || ST.arch === 'plateau' ? 'cave' : 'campaign', plat = ST.arch === 'plateau', lf = ST.lf, seed = (run === 'campaign' ? '' : run + ' ') + sd, m = DG.genFloor(sd * 31 + f * 1013, f, { mode: run, ...(run === 'campaign' ? { runSeed: sd } : {}) });
      const F = flow(m, Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE));
      const reachH = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return cell(m, tx, ty) === 1; };
      if (!reachH(m.spawn.x, m.spawn.y)) out.push(`seed ${seed} f${f}: spawn blocked`);
      for (const e of m.enemies) { if (!reachH(e.x, e.y) && !(ENEMIES[e.type].deep && cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 6) && !((ENEMIES[e.type].kind === 'salamander' || ENEMIES[e.type].lake) && cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 3)) out.push(`seed ${seed} f${f}: ${e.type} spawns in rock`); if (inStart(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) out.push(`seed ${seed} f${f}: ${e.type} in the start room`); }
      for (const c of m.chests) if (!reachH(c.x, c.y)) out.push(`seed ${seed} f${f}: chest in rock`);
      if (mode === 'campaign') {
        // the rooms' shapes (TASKS 374): a wing is floor joined to its room; a pit is deep cells inside its room's box with two cells
        // of floor round it (three at the top), nothing stands on it, and no stream runs through a shaped room
        // a floor's layout (TASKS 379): all four come up over the floors checked; a catacomb's chambers are one size on its grid
        if (m.lay) shapes['lay:' + m.lay] = 1;
        // a fortress (TASKS 380): the court is reached by its gates only, the start and the stairs lie outside its ring, and it holds
        // the altar or an elite
        const ct = m.rooms.find((r) => r.court);
        if (ct) { const [x0, y0, x1, y1] = ct.ring, inRing = (o) => { const x = Math.floor(o.x / TILE), y = Math.floor(o.y / TILE); return x >= x0 && x <= x1 && y >= y0 && y <= y1; };
          const mouth = []; for (let y = ct.y - 1; y <= ct.y + ct.h; y++) for (let x = ct.x - 1; x <= ct.x + ct.w; x++) if (!DG.inRm(ct, x, y) && cell(m, x, y) === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => DG.inRm(ct, x + dx, y + dy))) mouth.push([x, y]);
          let ways = 0; const seen = new Set(); for (const q of mouth) { if (seen.has(q.join())) continue; ways++; const st = [q]; seen.add(q.join()); while (st.length) { const [x, y] = st.pop(); for (const o of mouth) if (!seen.has(o.join()) && Math.abs(o[0] - x) <= 1 && Math.abs(o[1] - y) <= 1) { seen.add(o.join()); st.push(o); } } }
          if (ways !== ct.gates.length) out.push(`seed ${seed} f${f}: the fortress's court has ${ways} ways in, not its ${ct.gates.length} gates`);
          if (inRing(m.spawn) || inRing(m.exit)) out.push(`seed ${seed} f${f}: the start or the stairs inside the fortress's ring`);
          if (ct.type !== 'shrine' && !m.enemies.some((e) => e.elite && e.room === ct.id)) out.push(`seed ${seed} f${f}: the fortress's court holds neither the altar nor an elite`); }
        if (m.lay === 'catacomb') { const ch = m.rooms.filter((r) => !r.pocket && r.type !== 'secret'), [cw, cH] = D.ARCH.catacomb.grid.cell, [sx, sy] = D.ARCH.catacomb.grid.step;
          if (ch.some((r) => r.w !== cw || r.h !== cH || (r.x - ch[0].x) % sx || (r.y - ch[0].y) % sy)) out.push(`seed ${seed} f${f}: a catacomb chamber off its grid or size`); }
        for (const r of m.rooms) { if (r.shape) shapes[r.shape + (r.pit ? '*' : '')] = 1;
          for (const [a, b, c, d] of r.wings || []) for (let y = b; y < b + d; y++) for (let x = a; x < a + c; x++) if (cell(m, x, y) !== 1 && cell(m, x, y) !== 3) out.push(`seed ${seed} f${f}: room ${r.id}'s wing is not floor at ${x},${y}`);
          if (r.pit) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const inner = x >= r.x + 2 && x < r.x + r.w - 2 && y >= r.y + 3 && y < r.y + r.h - 2;
            if (inner !== (cell(m, x, y) === 6)) { out.push(`seed ${seed} f${f}: pit room ${r.id} is not a pit ringed with floor at ${x},${y}`); break; } } }
        for (const k of m.pits) if (m.cells[k] !== 6) out.push(`seed ${seed} f${f}: a pit cell is not deep`);
        // a nook (TASKS 376) is a dead end: one way in, no wider than a corridor; and some corridor runs three cells wide
        for (const r of m.rooms) if (r.pocket) { const mouth = []; for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (!DG.inRm(r, x, y) && cell(m, x, y) === 1 && DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) < 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => DG.inRm(r, x + dx, y + dy))) mouth.push([x, y]);
          // (one way: the cells by its mouth meet each other within six cells of it without passing through it)
          const near = (x, y) => x >= r.x - 6 && x < r.x + r.w + 6 && y >= r.y - 6 && y < r.y + r.h + 6, got = new Set(mouth.length ? [mouth[0].join()] : []), st = mouth.slice(0, 1);
          while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (!got.has(X + ',' + Y) && near(X, Y) && !DG.inRm(r, X, Y) && cell(m, X, Y) === 1) { got.add(X + ',' + Y); st.push([X, Y]); } } }
          if (r.type === 'start' || r.type === 'exit' || !mouth.length || mouth.some((q) => !got.has(q.join())) || mouth.length > 6) out.push(`seed ${seed} f${f}: nook ${r.id} is no dead end (${r.type}, ${mouth.length} cells by it)`); }
        for (let k = m.W; k < m.cells.length - 2 * m.W && !shapes.wide; k++) if ([0, 1, 2].every((j) => [0, 1, 2].every((i) => m.cells[k + j * m.W + i] === 1 && DG.roomAt(m, ((k + i) % m.W + 0.5) * TILE, (Math.floor(k / m.W) + j + 0.5) * TILE) < 0))) shapes.wide = 1;
        for (const o of [...m.chests, ...m.pots, ...m.decor, ...m.torches.filter((q) => q.kind !== 'wall'), ...m.traps]) if (m.pits.includes(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE))) out.push(`seed ${seed} f${f}: a ${o.n || o.kind || 'thing'} in a pit`);
        for (const q of m.waterFeatures) if (m.rooms[q.room].wings || m.rooms[q.room].pit) out.push(`seed ${seed} f${f}: a stream through a shaped room`);
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
        if (!plat && (share < 0.15 || share > 0.35)) out.push(`seed ${seed} f${f}: water is ${Math.round(share * 100)} % of the floor`);
        { const seen = new Uint8Array(W * m.H), s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), st = [s0]; seen[s0] = 1;
          while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && (m.cells[n] === 1 || m.cells[n] === 4)) { seen[n] = 1; st.push(n); } } }
          const cut = m.cells.findIndex((c, k) => c === 1 && !seen[k]); if (cut >= 0) out.push(`seed ${seed} f${f}: floor at ${cut % W},${Math.floor(cut / W)} cut off by water`);
          for (const r of m.rooms) if (!seen[r.cy * W + r.cx] && m.cells[r.cy * W + r.cx] === 1) out.push(`seed ${seed} f${f}: the ${r.type} hall ${r.id} cut off by water`); }
        const inW = (k) => wet.has(k) || over.has(k) || deepAt(k), cellOf = (o) => Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE);
        // a drowned lies in the shallows (TASKS 307), off the crossings; every other monster stands dry
        for (const o of m.enemies) if (ENEMIES[o.type].lurk && (!wet.has(cellOf(o)) || over.has(cellOf(o)) || deepAt(cellOf(o)))) out.push(`seed ${seed} f${f}: a drowned out of the shallows at ${Math.round(o.x)},${Math.round(o.y)}`);
        // an eel (TASKS 310) has its post in deep water
        for (const o of m.enemies) if (ENEMIES[o.type].deep && m.cells[cellOf(o)] !== 6) out.push(`seed ${seed} f${f}: an eel out of the deep water at ${Math.round(o.x)},${Math.round(o.y)}`);
        for (const [n, list] of [['monster', m.enemies.filter((o) => !ENEMIES[o.type].lurk && !ENEMIES[o.type].deep)], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((d) => !d.wall && !d.lift)], ['fire', m.torches.filter((q) => q.kind !== 'wall')], ['altar', m.shrines], ['web', m.webs], ['ambush', m.ambush]])
          for (const o of list) if (inW(cellOf(o))) out.push(`seed ${seed} f${f}: a ${n} in the water at ${Math.round(o.x)},${Math.round(o.y)}`);
        for (const tr of m.traps) for (const [i, j] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (inW((tr.y / TILE + j) * W + tr.x / TILE + i)) out.push(`seed ${seed} f${f}: a spike plate in the water`);
        for (const c of m.crossings) { if (c.lava || c.chasm) continue; caveKinds[c.kind] = (caveKinds[c.kind] || 0) + 1;
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
      // the fire depths (TASKS 186): two rivers at least, and nothing stands in lava or a cell from its shore (but the plateaus' chain
      // fences, railings on the very edge that block and hide nothing: TASKS 405)
      if (D.BIOMES[m.biome].lava && !(ST.last && ST.boss) && (m.streams || []).filter((q) => q.kind === 'river' && q.n >= 8).length < 2) out.push(`seed ${seed} f${f}: fewer than two lava rivers`);
      { const shore = (o) => { const tx = Math.floor(o.x / TILE), ty = Math.floor((o.y - 1) / TILE); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, tx + i, ty + j) === 3) return true; return false; };
        for (const [k, list] of [['monster', m.enemies.filter((e) => (!ENEMIES[e.type].lava || ENEMIES[e.type].kind !== 'salamander') && !ENEMIES[e.type].lake)], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((d) => !d.wall && !d.lift && d.n !== 'fence_mg')], ['brazier', m.torches.filter((t) => t.kind !== 'wall')]]) for (const o of list) if (shore(o)) out.push(`seed ${seed} f${f}: a ${k} by lava at ${Math.round(o.x)},${Math.round(o.y)}`); }
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
      // webs lie on the floor of a room spiders keep; ambush plates are gone (TASKS 320)
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
        const inR = (x, y) => m.rooms.some((q) => DG.inRm(q, x, y));
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
      if (mode === 'cave') { const [w0, h0] = ST.N.size[lf - 1], sh = m.rooms.find((r) => r.type === 'shop'), hid = new Set(m.secrets.flatMap((q) => q.hide));
        if (m.W !== w0 || m.H !== h0) out.push(`seed ${seed} f${f}: the cave is ${m.W}×${m.H}, not ${w0}×${h0}`);
        if (m.doors.some((d) => !d.arena)) out.push(`seed ${seed} f${f}: non-arena doors in the cave`);
        for (const r of m.rooms) if (r.pocket && m.edges.filter((e) => e.includes(r.id)).length !== 1) out.push(`seed ${seed} f${f}: pocket ${r.id} is not a dead end`);
        const chU = new Set(m.chasmUnder || []), skip = (x, y) => (Math.abs(x - sh.cx) <= 5 && y >= sh.y - 2 && y <= sh.y + 5) || hid.has(y * m.W + x) || chU.has(y * m.W + x) || m.rooms.some((r) => r.type === 'secret' && x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
        for (const q of DG.straightRuns(m.cells, m.W, m.H, skip)) out.push(`seed ${seed} f${f}: a straight cave wall ${q.n} cells long at ${q.x},${q.y}`); }
      // the plateaus (TASKS 400): a body two cells wide walks from the spawn to every plateau and ledge (a ridge never narrows to one
      // cell), the walk to the stairs is held to ARCH.plateau.path, the rock wall stands at the top only and no lava lies in it, and
      // the floor has lava
      if (plat) { const W = m.W, A = D.ARCH.plateau, s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE);
        // (a lava cave, TASKS 431, is the water caves' layout: its tunnels may narrow, its rock is all wall)
        const lc = m.ftype === 'cave', lost = lc ? [] : DG.narrowTo(m.cells, W, m.H, s0, m.rooms.filter((r) => r.type !== 'secret').map((r) => r.cy * W + r.cx));
        for (const k of lost) out.push(`seed ${seed} f${f}: plateau or ledge at ${k % W},${Math.floor(k / W)} out of reach of a body two cells wide`);
        const d = new Int32Array(W * m.H).fill(-1), q = [s0]; d[s0] = 0;
        for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && m.cells[n] === 1) { d[n] = d[q[i]] + 1; q.push(n); } }
        const pth = (((m.ftype && A[m.ftype]) || A).path || A.path).map((q) => q * (m.ftype2 ? A.blend.pathKeep : 1)), walk = d[m.exit.ty * W + m.exit.tx]; if (walk !== m.walk || walk < pth[lf - 1]) out.push(`seed ${seed} f${f}: the walk to the stairs is ${walk} cells (${m.walk} counted, ${pth[lf - 1]} at least)`);
        if (!m.cliff || m.cliff.length !== W) out.push(`seed ${seed} f${f}: a plateau floor without its wall rows`);
        else if (!lc) for (let x = 0; x < W; x++) for (let y = 0; y < m.cliff[x]; y++) if (m.cells[y * W + x] === 3) { out.push(`seed ${seed} f${f}: lava in the wall at ${x},${y}`); x = W; break; }
        if (!m.lava) out.push(`seed ${seed} f${f}: a plateau floor without lava`);
        // a cache hides in the top wall (TASKS 425): its room and passage in the wall's rows, the wall over it on each side, never a
        // block of dark in the lava
        for (const [i, q] of m.secrets.entries()) { const r = m.rooms[q.room], ks = q.hide.slice(); for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) ks.push(y * W + x);
          if (ks.some((k) => Math.floor(k / W) >= m.cliff[k % W])) out.push(`seed ${seed} f${f}: secret ${i} is not in the top wall`); }
        // the lava (TASKS 401): its share of floor and lava in AR.lava.share, lakes and sources, every crossing a walk over lava, the crust
        // on lava by the floor and no way shorter over it, and nothing stands in the lava, on the crust or a cell from either
        const L = A.lava, under = new Set(m.lavaUnder), crustS = new Set(m.crust), fl = m.cells.filter((c) => c === 1).length, share = m.lava / (fl + m.lava);
        const sh = m.shareOf || L.share;
        if (share < sh[0] || share > sh[1]) out.push(`seed ${seed} f${f}: lava is ${Math.round(share * 100)} % of floor and lava (${m.ftype})`);
        if (!m.lavaBodies.some((b) => b.kind === 'lake') || !m.lavaFeatures.length) out.push(`seed ${seed} f${f}: no lake or no source of lava`);
        for (const q of m.lavaFeatures) if (m.cells[q.cell] !== 3) out.push(`seed ${seed} f${f}: a lava ${q.kind} off its lava`);
        // (a chain bridge over the chasm, TASKS 429: on floor walked over the dark, the dark beside it, never over lava)
        const chU = new Set(m.chasmUnder || []);
        for (const c of m.crossings) if (c.chasm ? c.kind !== 'bridge' || c.cells.some((k) => m.cells[k] !== 1 || !chU.has(k) || under.has(k)) || !c.cells.some((k) => [1, -1, W, -W].some((o) => m.cells[k + o] === 0)) : !c.lava || c.cells.some((k) => m.cells[k] !== 1 || !under.has(k)) || !c.cells.some((k) => [1, -1, W, -W].some((o) => m.cells[k + o] === 3))) out.push(`seed ${seed} f${f}: a ${c.kind} that is no crossing over ${c.chasm ? 'the chasm' : 'lava'}`);
        for (const k of crustS) if (m.cells[k] !== 3 || ![1, -1, W, -W].some((o) => m.cells[k + o] === 1)) out.push(`seed ${seed} f${f}: crust off a bank at ${k % W},${Math.floor(k / W)}`);
        // (the floor round each crust cell joins up on foot within a few steps: a crust cell never takes anyone over the lava)
        for (const k of crustS) { const fl8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].map((o) => k + o).filter((n) => m.cells[n] === 1); if (fl8.length < 2) continue;
          const dl = new Map([[fl8[0], 0]]), ql = [fl8[0]]; for (let i = 0; i < ql.length; i++) { const c = ql[i]; if (dl.get(c) >= 6) continue; for (const o of [1, -1, W, -W]) { const n = c + o; if (!dl.has(n) && m.cells[n] === 1) { dl.set(n, dl.get(c) + 1); ql.push(n); } } }
          if (fl8.some((n) => !dl.has(n))) { out.push(`seed ${seed} f${f}: the crust is a short cut at ${k % W},${Math.floor(k / W)}`); break; } }
        const hot = new Set(); for (let k = 0; k < W * m.H; k++) if (m.cells[k] === 3) for (const o of [0, 1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) hot.add(k + o);
        const onHot = (o) => hot.has(Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE));
        for (const [n, list] of [['monster', m.enemies.filter((e) => ENEMIES[e.type].kind !== 'salamander' && !ENEMIES[e.type].lake)], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((q) => !q.wall && !q.lift && q.n !== 'fence_mg')], ['fire', m.torches.filter((q) => q.kind !== 'wall')]])
          for (const o of list) if (onHot(o)) { out.push(`seed ${seed} f${f}: a ${n} in the lava or a cell from it at ${Math.round(o.x)},${Math.round(o.y)}`); break; } }
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
        // (a cell of its box the counter reaches only round the outside of the box, by a plateau's ridge along its edge, is the floor's
        // shape, not the props': it counts only if the box's bare floor joins it to the counter)
        const nook = (x, y) => y <= r.y + 1 && Math.abs(x - r.cx) <= 1, bare = (x, y) => inR(x, y) && cell(m, x, y) === 1 && !nook(x, y), go = (x, y) => bare(x, y) && !blk.has(y * m.W + x);
        const fill = (ok) => { const sv = new Set([fy * m.W + fx]), q3 = [[fx, fy]]; while (q3.length) { const [x, y] = q3.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
          if (ok(nx, ny) && !sv.has(ny * m.W + nx)) { sv.add(ny * m.W + nx); q3.push([nx, ny]); } } } return sv; };
        const sv = fill(go), sv0 = fill(bare);
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (go(x, y) && sv0.has(y * m.W + x) && !sv.has(y * m.W + x)) { out.push(`seed ${seed} f${f}: shop props wall off floor`); y = 1e9; break; } }
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
          for (const [bx, by, bw, bh] of DG.rectsOf(r)) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (cell(m, x, y) === 1 && !lights.some(([lx, ly, lr]) => Math.hypot(lx - (x + 0.5) * TILE, (ly - (y + 0.5) * TILE - 6) / 0.8) <= lr * TILE)) dark++;
          if (dark) out.push(`seed ${seed} f${f}: ${dark} dark cells in ${r.type} room ${r.id} (${r.w}×${r.h})`); } } }
    // the cave's water comes in every kind over the floors checked: falls, breaches, springs, isthmuses, fords and bridges
    for (const k of ['waterfall', 'breach', 'spring', 'neck', 'ford', 'bridge']) if (!caveKinds[k]) out.push(`cave: no ${k} on any of the floors checked`);
    for (const k of Object.keys(D.ROOM_SHAPES)) if (!shapes[k] && !shapes[k + '*']) out.push(`rooms: no ${k} room on any of the floors checked`);
    if (!shapes['pit*']) out.push('rooms: no pit dug on any of the floors checked');
    if (!shapes.wide) out.push('rooms: no corridor three cells wide on any of the floors checked');
    for (const k of ['rooms', 'maze', 'hall', 'catacomb', 'fortress']) if (!shapes['lay:' + k]) out.push(`rooms: no ${k} layout on any of the floors checked`);
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
      const m = R.map, lv = []; for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.cells[y * m.W + x] === 3 && [1, -1, m.W, -m.W].some((d) => m.cells[y * m.W + x + d] === 1)) lv.push([x, y]);
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
      const R = S.run, h = R.hero, rm = R.map.rooms.filter((q) => q.type === 'combat' && !q.trap).sort((a, b) => b.w - a.w)[0], cx = (rm.x + rm.w / 2) * TILE, cy = (rm.y + rm.h / 2) * TILE;   // off the spike plates
      // (the 1st floor's rooms are 6–11 cells wide, TASKS 373: a fire priest 220 px off stood in the rock)
      { const m = R.map, X = Math.floor(cx / TILE), Y = Math.floor(cy / TILE), near = (o) => Math.abs(o.x / TILE - X) < 10 && Math.abs(o.y / TILE - Y) < 5;
        for (let y = Y - 4; y <= Y + 4; y++) for (let x = X - 9; x <= X + 9; x++) if (x > 1 && y > 2 && x < m.W - 2 && y < m.H - 2) m.cells[y * m.W + x] = 1;
        m.decor = m.decor.filter((o) => !near(o)); m.torches = m.torches.filter((o) => o.kind === 'wall' || !near(o)); m.webs = m.webs.filter((o) => !near(o)); m.traps = m.traps.filter((o) => !near(o)); m.block = []; R.chests = R.chests.filter((o) => !near(o)); R.pots = R.pots.filter((o) => !near(o)); }
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
      // the smouldering skeleton (TASKS 411): beside the hero it lights its fuse, stands, and bursts at its end; killed short of him its
      // bones burst all the same once the fuse is out; its blast takes a share of each monster's health within reach, none beyond,
      // and sets off another smouldering one in it
      { const B = ENEMIES.skel_ember.boom, W = ENEMIES.skel_ember.wind, sk = (dx, o) => el([], dx, Object.assign({ type: 'skel_ember', elite: 0, hp: 18, max: 18, dmg: 5 }, o));
        put(); const a1 = sk(40); let litT = -1, x0 = 0, a = h.hp;
        for (let i = 0; i < 120 * 2 && a1.deadT < 0; i++) { step(S, { keys: [] }); if (litT < 0 && a1.st === 'wind') { litT = S.t; x0 = a1.x; } if (litT < 0 && h.hp < a) break; }
        if (litT < 0) out.push('a smouldering skeleton beside the hero never lights its fuse');
        else { if (a1.deadT < 0 || Math.abs(a1.deadT - litT - W) > 2 * DT) out.push(`a smouldering skeleton bursts ${a1.deadT < 0 ? 'never' : (a1.deadT - litT).toFixed(2) + ' s'} after lighting, not ${W} s`);
          if (Math.abs(a1.x - x0) > 6) out.push('a smouldering skeleton walks on with its fuse lit'); if (!(h.hp < a)) out.push("a smouldering skeleton's burst does not hurt the hero beside it"); }
        put(); const a2 = sk(60, { st: 'idle' }); a = h.hp; hitEnemy(S, R, a2, 100, false, h.x, h.y); const dx2 = a2.x - h.x;
        if (!(a2.fuse > S.t)) out.push('a smouldering skeleton killed lights no fuse');
        for (let i = 0; i < 120 * B.fuse * 0.8; i++) { step(S, { keys: [] }); h.x = a2.x - dx2; h.vx = h.vy = 0; } if (h.hp < a) out.push("a smouldering skeleton's bones burst before the fuse is out");
        for (let i = 0; i < 120 * 0.4; i++) { step(S, { keys: [] }); h.x = a2.x - dx2; h.vx = h.vy = 0; } if (!(h.hp < a)) out.push("a smouldering skeleton's bones never burst by the hero");
        put(); h.ifr = 1e9; const a3 = sk(0, { st: 'wind', t0: S.t, fuse: S.t + 0.05 }), mk = (dy, type) => el([], 0, { type, elite: 0, hp: 200, max: 200, dmg: 1, y: h.y + dy, st: 'idle', cdT: 1e9 });
        const nearM = mk(B.r - 20, 'goblin'), farM = mk(-(B.r + 40), 'goblin'), a4 = mk(-(B.r - 30), 'skel_ember');
        for (let i = 0; i < 12; i++) step(S, { keys: [] });
        if (a3.deadT < 0) out.push("a smouldering skeleton's lit fuse never runs out");
        if (Math.abs(nearM.max - nearM.hp - Math.round(nearM.max * B.mon)) > 1) out.push(`a smouldering skeleton's blast takes ${nearM.max - nearM.hp} of a monster's ${nearM.max} in reach, not ${B.mon * 100}%`);
        if (farM.hp < farM.max) out.push("a smouldering skeleton's blast hurts a monster out of reach");
        if (!(a4.fuse > S.t - 0.1)) out.push("a smouldering skeleton's blast does not set off another in reach");
        h.ifr = 0; }
      // the fire priest (TASKS 410): its ring falls where the hero stood, hurts him only after its warning and only if he stays, and
      // sets him alight; it sets alight the weapon of an ally in the fight near it, whose blows then hit harder and set the hero burning
      { const P = ENEMIES.fire_priest.pyre, pr = (o) => el([], 220, Object.assign({ type: 'fire_priest', elite: 0, hp: 100, max: 100, dmg: 10, cdT: 0, kinT: 1e9 }, o));
        for (const stay of [1, 0]) { put(); const p = pr(); let a = h.hp, at = -1, early = 0;
          for (let i = 0; i < 120 * 3 && h.hp === a; i++) { step(S, { keys: [] }); if (at < 0 && R.pyres.length) { at = S.t; if (!stay) h.x -= 3 * P.r; }
            if (at >= 0 && S.t - at < P.warn - DT && h.hp < a) early = 1; if (p.st === 'chase' && at >= 0) p.cdT = 1e9; }
          if (at < 0) { out.push('a fire priest in reach never casts its ring'); break; }
          if (early) out.push("a fire priest's ring burns before its warning is out");
          if (stay && !(h.hp < a)) out.push("a fire priest's ring does not hurt the hero standing in it");
          if (stay && !(h.burn > S.t)) out.push("a fire priest's ring does not set the hero burning");
          if (!stay && h.hp < a) out.push("a fire priest's ring hurts a hero who stepped out of it"); }
        put(); h.ifr = 1e9; const p2 = pr({ kinT: S.t, cdT: 1e9 }), ally = el([], 120, { elite: 0, hp: 100, max: 100, dmg: 10, cdT: 1e9, x: p2.x - 60, y: h.y + 40 });
        for (let i = 0; i < 120 * 2 && !(ally.fireT > S.t); i++) step(S, { keys: [] });
        if (!(ally.fireT > S.t)) out.push("a fire priest never sets alight an ally's weapon");
        else { h.ifr = 0; let hurt = [0, 0], burnt = 0;
          for (const lit of [0, 1]) for (let k = 0; k < 20 && !hurt[lit]; k++) { const keep = ally.fireT; if (!lit) ally.fireT = 0; h.hp = heroSt(S).maxHp; h.burn = 0; h.ifr = 0;
            hurtHero(S, R, 40, ally.x, ally.y, undefined, who(ally), ally); hurt[lit] = heroSt(S).maxHp - h.hp; if (lit) burnt = h.burn > S.t; ally.fireT = keep; }
          if (!(hurt[1] > hurt[0] * 1.15)) out.push(`a blow of an ally with its weapon alight is no harder (${hurt[0]} → ${hurt[1]})`);
          if (!burnt) out.push("a blow of an ally with its weapon alight does not set the hero burning"); }
        h.ifr = 0; R.pyres = []; }
      // no blow takes more than its cap of the health: the real strike of an elite of every kind (a caster's bolt, the boss's moves)
      // and an explosive corpse's blast, on the first and the last floor
      const f0 = R.floor, first = (secs) => { const mx = heroSt(S).maxHp; let lost = 0;
        for (let i = 0; i < 120 * secs && !lost; i++) { const a = h.hp; step(S, { keys: [] }); lost = (a - h.hp) / mx; } return lost; };
      for (const f of [1, D.RUNS.campaign.floors]) { R.floor = f;
        for (const type in ENEMIES) { if (type === 'boss_serpent') continue; put(); el([], type === 'cultist' ? 120 : 40, { type, dmg: 1e5 }); const l = first(D.BOSSES[type] ? 12 : 6), cap = D.BOSSES[type] ? BAL.cap.boss : BAL.cap.blow;
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
      const R = S.run, m = R.map, h = R.hero, rm = m.rooms.find((q) => q.id !== m.start && q.w >= 6 && [1, 2, 3].every((d) => cell(m, q.x + 2, q.y - d) === 0)), y = rm.y * TILE + 5, x = (rm.x + 2) * TILE;
      if (!losClear(m, x, y, x + 40, y)) out.push('two actors against the same wall cannot reach each other along it');
      if (losClear(m, x, y, x, y - 3 * TILE)) out.push('a line straight up through the wall above a room is clear'); }
    // floors meeting only at a corner: the generator leaves none, and a line through such a corner is shut (TASKS 174)
    { const pm = { W: 4, H: 4, cells: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0] };
      if (losClear(pm, 1.5 * TILE, 1.5 * TILE, 2.5 * TILE, 2.5 * TILE)) out.push('a line through the corner of two walls is clear');
      for (let f = 1; f <= D.RUNS.campaign.chapter; f++) for (let s = 1; s <= 8; s++) { const m = DG.genFloor(s * 131 + f, f), so = (x, y) => solidC(m, x, y); let n = 0;
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
      const R = S.run; enterFloor(S, R, D.RUNS.campaign.chapter); const b = R.en.find((e) => e.type === 'boss'), h = R.hero; R.en = [b]; h.x = b.x; h.y = b.y + 160; h.ifr = 1e9;
      for (let i = 0; i < 60; i++) step(S, { keys: [] }); if (!S.ev.some((e) => e.k === 'roar')) out.push('the boss does not roar when he first sees the hero'); }
    // shallow water: the hero wades slower, a burning hero stepping in is put out, and no prop, chest or monster post stands in it
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); const R = S.run, h = R.hero; let tested = false;
      for (let f = 1; f <= D.RUNS.campaign.chapter && !tested; f++) { enterFloor(S, R, f); const m = R.map; if (!m.water.length) continue; tested = true; const wet = new Set(m.water), k0 = m.water[Math.floor(m.water.length / 2)], foe = structuredClone(R.en.find((e) => !ENEMIES[e.type].ghost));
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
      // (the smaller early floors, TASKS 373, leave a run's eight with no shut thin wall now and then: the next run's are tried)
      let tested = 0;
      for (let sd = 0; sd < 12 && tested < 3; sd++) { const R = sd ? (S.run = newRun(S, 'campaign', 7000 + sd)) : S.run, h = R.hero;
      for (let f = 1; f <= D.RUNS.campaign.chapter && tested < 3; f++) { enterFloor(S, R, f); const m = R.map;
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
          if (own) out.push(`fog check floor ${f}: ${own} floor cells of the hero's own room ${A.id} stay dark`); } } }
      if (!tested) out.push('fog check: no thin wall between two rooms found to test'); }
    // hero blows stop at walls: across a thin wall a monster takes no damage from a swing, the whirl or a fireball's blast,
    // and the same setup with the wall dug out does hit (so the check really reaches it)
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero; let spot = null;
      for (let f = 1; f <= D.RUNS.campaign.chapter && !spot; f++) { enterFloor(S, R, f); const m = R.map;
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
      for (let f = 1; f <= D.RUNS.campaign.chapter; f++) { enterFloor(S, R, f); const e = R.en.find(inside); if (e) { out.push(`floor ${f}: a ${e.type} is posted inside a prop`); break; } }
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
      let R = S.run, h = R.hero, lane = null, m = R.map;   // a straight corridor two cells wide and 14 long, rock on both sides: the hero at one end, ten monsters down it
      const corr = (x, y) => cell(m, x, y) === 1 && DG.roomAt(m, x * TILE + 16, y * TILE + 16) < 0;
      // (the smaller floors' shorter corridors, TASKS 373, may have none in a run: its floors, then the next runs', are tried)
      for (let sd = 0; sd < 12 && !lane; sd++) { if (sd) { R = S.run = newRun(S, 'campaign', 7100 + sd); h = R.hero; }
      for (let f = 1; f <= D.RUNS.campaign.chapter && !lane; f++) { if (f > 1) enterFloor(S, R, f); m = R.map;
      for (let y = 1; y < m.H - 2 && !lane; y++) for (let x = 1; x < m.W - 14 && !lane; x++) for (const v of [0, 1]) {
        const at = (i, k) => v ? [x + k, y + i] : [x + i, y + k];
        if ([...Array(14)].every((_, i) => { const [ax, ay] = at(i, 0), [bx, by] = at(i, 1), [cx, cy] = at(i, -1), [dx, dy] = at(i, 2);
          return corr(ax, ay) && corr(bx, by) && cell(m, cx, cy) === 0 && cell(m, dx, dy) === 0; })) {
          const c = (i, k) => { const [px, py] = at(i, k); return py * m.W + px; };
          lane = { at: c(0, 0), back: [...Array(10)].map((_, n) => c(4 + (n >> 1), n & 1)) }; break; } } } }
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
    return out.concat(secretCheck(), propCheck(), reactionCheck(), meleeSpacingCheck(), hazardCheck(), floorTypeCheck(), branchCheck(), lootLevelCheck(), magmaKindsCheck());
  }
  // a run of its own (the caves, the magma caves) finds, is sold and is given items at about its hero's level on its first floor:
  // the magma caves' loot over their depth once made them 10 levels over him and the run a walk (TASKS 424)
  function lootLevelCheck() {
    const out = [];
    for (const mode of Object.keys(D.RUNS)) { const M = D.RUNS[mode]; if (!M.lvl || M.lvl < 2 || M.endless) continue;
      const S = spawn(0, {}), R = newRun(S, mode, 7); enterFloor(S, R, 1); const lv = rollItem(R, dep(R)).lvl, sh = R.shop.goods.filter((g) => BASES[g.it.b]).map((g) => g.it.lvl);
      if (Math.abs(lv - M.lvl) > 3) out.push(`${mode}: a 1st floor's item is level ${lv} for a hero of level ${M.lvl}`);
      if (sh.some((l) => Math.abs(l - M.lvl) > 3)) out.push(`${mode}: the 1st floor's merchant sells items of level ${Math.min(...sh)}–${Math.max(...sh)} for a hero of level ${M.lvl}`); }
    return out; }
  // the magma floors' types (TASKS 426, 427): a run's floors never take one type twice running and every type turns up; a lake floor
  // has islands in its lake, a hoard on the big one, no start, stairs or merchant on one and no cache dug in the lake; a river floor
  // its island with the hoard, two to four ways over and packs by them
  function floorTypeCheck() {
    const out = [], seen = {}, AR = D.ARCH.plateau;
    let mixed = 0;
    for (let sd = 1; sd <= 10; sd++) { let prev = null, pm = false;
      for (let f = 1; f <= D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f} (${m.ftype})`; seen[m.ftype] = (seen[m.ftype] || 0) + 1;
        if (f < D.RUNS.magma.floors && m.ftype === prev) out.push(`${tag}: the same type as the floor before`); prev = m.ftype;
        if (m.ftype2) { mixed++; if (pm) out.push(`${tag}: a mixed floor after a mixed floor`); if (!AR.blend.over.includes(m.ftype)) out.push(`${tag}: ${m.ftype} mixed with ${m.ftype2}`); } pm = !!m.ftype2;
        if (f === D.RUNS.magma.floors && m.ftype !== 'plain') out.push(`${tag}: the boss's floor is not the plain plateaus`);
        if (f === 1 && AR.first && m.ftype !== AR.first) out.push(`${tag}: the first floor is not ${AR.first}`);
        // a river (TASKS 428): one island, the hoard on it; two to four places to cross, a pack waiting at them
        if (m.ftype === 'river') { const W = m.W, isles = m.rooms.filter((r) => r.isle), rc = m.crossings.filter((c) => c.river);
          if (isles.length !== 1 || isles[0].type !== 'treasure') out.push(`${tag}: the river's island holds no hoard`);
          const xs = rc.map((c) => c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length).sort((a, b) => a - b); let places = 0, last = -99; for (const x of xs) { if (x - last > 8) places++; last = x; }
          if (places < 2 || places > 4) out.push(`${tag}: ${places} places to cross the river`);
          const mx = (c) => c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length, held = rc.filter((c) => { const own = new Set(c.cells), ends = c.cells.flatMap((k) => [1, -1, W, -W].map((o) => k + o)).filter((k) => m.cells[k] === 1 && !own.has(k));
            return m.enemies.some((e) => ends.some((k) => Math.hypot(e.x / TILE - 0.5 - (k % W), e.y / TILE - 0.5 - Math.floor(k / W)) < 8)); });
          const bare = xs.filter((x, i) => (i === 0 || x - xs[i - 1] > 8) && !held.some((c) => Math.abs(mx(c) - x) <= 8 * 3)).length;
          if (bare > 1) out.push(`${tag}: ${bare} places to cross the river with no pack by them`); }
        // a chasm (TASKS 429): two chain bridges over the dark and more, packs waiting at them, the dark (not lava) round the plateaus
        if (m.ftype === 'chasm') { const W = m.W, br = m.crossings.filter((c) => c.chasm);
          if (br.length < 2) out.push(`${tag}: ${br.length} bridges over the chasm`);
          const held = br.filter((c) => m.enemies.some((e) => c.cells.some((k) => Math.hypot(e.x / TILE - 0.5 - (k % W), e.y / TILE - 0.5 - Math.floor(k / W)) < 9))).length;
          if (held < br.length / 2) out.push(`${tag}: ${held} of ${br.length} bridges with a pack by them`);
          let rim = 0, lav = 0; for (let k = 0; k < W * m.H; k++) if (m.cells[k] === 1 && [1, -1, W, -W].some((o) => m.cells[k + o] !== 1 && m.cells[k + o] !== 4)) { rim++; if ([1, -1, W, -W].some((o) => m.cells[k + o] === 3)) lav++; }
          if (lav > rim * 0.25) out.push(`${tag}: ${Math.round(lav / rim * 100)} % of the plateaus' edges by lava`); }
        // terraces (TASKS 430): three rows and more, the start on the first or the last and the stairs on the other, a lavafall down
        // the wall at the head of the river
        if (m.ftype === 'terrace') { const rows = Math.max(...m.rooms.map((r) => (r.row ?? -1))) + 1, s0 = m.rooms.find((r) => r.type === 'start'), e0 = m.rooms.find((r) => r.type === 'exit');
          if (rows < 3) out.push(`${tag}: ${rows} rows of terraces`);
          if (!s0 || !e0 || s0.row === undefined || e0.row === undefined || Math.min(s0.row, e0.row) !== 0 || Math.max(s0.row, e0.row) !== rows - 1) out.push(`${tag}: the start and the stairs are not the serpentine's two ends`);
          if (!m.lavaFeatures.some((q) => q.kind === 'fall')) out.push(`${tag}: no lavafall`); }
        // a lava cave (TASKS 431): its rock all wall (no chasm), streams of lava across its tunnels crossed twice and more, a source
        if (m.ftype === 'cave') { if (m.cliff.some((c) => c < m.H)) out.push(`${tag}: a lava cave with a chasm under its rock`);
          if (m.crossings.filter((c) => c.lava).length < 2) out.push(`${tag}: ${m.crossings.length} ways over its lava`);
          if (!m.lavaFeatures.length) out.push(`${tag}: no source of its lava`); }
        if (m.rooms.some((r) => r.isle && ['start', 'exit', 'boss', 'shop'].includes(r.type))) out.push(`${tag}: the start, the stairs or the merchant on an island`);
        if (m.ftype !== 'lake') continue; const isles = m.rooms.filter((r) => r.isle);
        if (isles.length < 2) out.push(`${tag}: ${isles.length} islands in the lake`);
        if (isles.some((r) => ['start', 'exit', 'boss', 'shop'].includes(r.type))) out.push(`${tag}: the start, the stairs or the merchant on an island`);
        if (!isles.some((r) => r.type === 'treasure')) out.push(`${tag}: no hoard on an island`);
        // the lake is the floor's figure (the player's note on 427): a big island with the hoard and smaller ones, the plateaus on its
        // shore no bigger than the lake's own sizes, and no hole into the dark left in its lava
        if (!isles.some((r) => r.isle === 2 && r.type === 'treasure')) out.push(`${tag}: the hoard is not on the big island`);
        if (new Set(isles.map((r) => r.w * r.h > 90 ? 'big' : r.w * r.h > 40 ? 'mid' : 'small')).size < 2) out.push(`${tag}: the islands are all of a size`);
        for (const r of m.rooms) if (!r.isle && !r.pocket && r.type !== 'secret' && r.type !== 'shop' && (r.w > (r.g || AR.lake.grow)[0] || r.h > (r.g || AR.lake.grow)[1])) out.push(`${tag}: a shore plateau of ${r.w}×${r.h}`);
        { const W = m.W, seen = new Uint8Array(W * m.H), wallAt = (k) => Math.floor(k / W) < m.cliff[k % W];
          for (let k0 = 0; k0 < W * m.H; k0++) { if (m.cells[k0] !== 0 || seen[k0] || wallAt(k0)) continue; const cs = [k0]; seen[k0] = 1; let shut = true;
            for (let i = 0; i < cs.length; i++) for (const o of [1, -1, W, -W]) { const n = cs[i] + o, x = n % W, y = Math.floor(n / W);
              if (x < 3 || y < 3 || x > W - 4 || y > m.H - 4) { shut = false; continue; } if (m.cells[n] === 3) continue; if (m.cells[n] !== 0 || wallAt(n)) { shut = false; continue; } if (!seen[n]) { seen[n] = 1; cs.push(n); } }
            if (shut) { out.push(`${tag}: a hole of ${cs.length} cells into the dark in the lava at ${k0 % W},${Math.floor(k0 / W)}`); break; } } }
        for (const q of m.secrets) { const r = m.rooms[q.room]; let lava = 0; for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (cell(m, x, y) === 3) lava++;
          if (lava > 2) out.push(`${tag}: a cache with ${lava} cells of lava round it`); } } }
    for (const t of AR.types) if (!seen[t]) out.push(`floor type ${t} never turns up in 10 magma runs`);
    // the mix (TASKS 426): a lake, river or terrace floor over the chasm: it turns up in the runs, and on each figure a floor holds
    // the figure's own checks that the chasm could break (a walk to the stairs, a lava share, two bridges, every plateau in reach, the lake's islands)
    if (!mixed) out.push('no mixed floor in 10 magma runs');
    for (const ft of AR.blend.over) for (let sd = 1; sd <= 5; sd++) for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd, ftype: ft, ftype2: AR.blend.with }), tag = `mixed ${ft}+${m.ftype2} ${sd} f${f}`, W = m.W;
      if (m.ftype !== ft || m.ftype2 !== AR.blend.with) { out.push(`${tag}: came out as ${m.ftype}+${m.ftype2}`); continue; }
      const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), lost = DG.narrowTo(m.cells, W, m.H, s0, m.rooms.filter((r) => r.type !== 'secret').map((r) => r.cy * W + r.cx));
      if (lost.length) out.push(`${tag}: ${lost.length} plateau cells out of reach of a body two cells wide`);
      const pth = (AR[ft].path || AR.path)[f - 1] * AR.blend.pathKeep * 0.9; if (m.walk < pth)   // (0.9: tryGen's last attempts relax the walk to that share)
       out.push(`${tag}: the walk to the stairs is ${m.walk}, ${pth} at least`);
      const sh = m.lava / (m.cells.filter((c) => c === 1).length + m.lava); if (sh < m.shareOf[0] || sh > m.shareOf[1]) out.push(`${tag}: lava is ${Math.round(sh * 100)} % of floor and lava`);
      const br = m.crossings.filter((c) => c.chasm).length, need = ft === 'river' ? AR.blend.riverBridges : 2; if (br < need) out.push(`${tag}: ${br} bridges over the chasm`);
      if (!m.cells.some((c, k) => c === 0 && Math.floor(k / W) >= m.cliff[k % W] && [1, -1, W, -W].some((o) => m.cells[k + o] === 1))) out.push(`${tag}: no chasm by the plateaus`);
      if (ft === 'lake' && m.rooms.filter((r) => r.isle).length < 2) out.push(`${tag}: fewer than two islands in the lake`);
      if (!m.rooms.some((r) => r.type === 'treasure')) out.push(`${tag}: no hoard`); }
    // taking the stairs from every floor of a run onto the next, whatever its type (a step that read the floor it left crashed on a
    // floor with no crust)
    for (let sd = 1; sd <= 6; sd++) { const Z = spawn(0, {}); Z.run = newRun(Z, 'magma', sd); Z.screen = 'play'; const R2 = Z.run;
      try { for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = R2.map; R2.en = []; R2.hero.x = m.exit.x; R2.hero.y = m.exit.y; R2.msg = null;
          for (let i = 0; i < 30 && R2.floor === f; i++) step(Z, { keys: i % 10 === 0 ? ['KeyE'] : [] });
          if (R2.floor !== f + 1) { out.push(`magma run ${sd}: the stairs of floor ${f} (${m.ftype}) do not take the hero down`); break; }
          for (let i = 0; i < 60; i++) step(Z, { keys: [] }); } }
      catch (e) { out.push(`magma run ${sd}: taking the stairs threw ${e.message}`); } }
    // the magma caves' packs (TASKS 412): each floor brings its own kinds — none of the 2nd's on the 1st, none of the 3rd's on the 2nd
    const by = [{}, {}, {}]; for (let sd = 1; sd <= 10; sd++) for (let f = 1; f <= 3; f++) for (const e of DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }).enemies) if (!e.guard) by[f - 1][e.type] = 1;
    for (const [t, f0] of Object.entries(D.BIOMES.magma.from)) { if (f0 > 3) continue; if (!by[f0 - 1][t]) out.push(`magma: no ${t} on the ${f0}th floor it comes on`); if (f0 > 1 && by[f0 - 2][t]) out.push(`magma: a ${t} before the ${f0}th floor`); }
    return out; }
  // the magma caves' side ways (TASKS 433): on every floor but the boss's two dead ends off the way to the stairs and more, a ledge
  // always one, each holding a reward (a chest, an altar, an elite or a cache dug from it); no elite on the way but the stairs' own,
  // and two thirds of the floor's rewards and more off it
  function branchCheck() {
    const out = [];
    for (let sd = 1; sd <= 10; sd++) for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f} (${m.ftype})`, q = DG.rewardsOf(m);
      const deg = m.rooms.map(() => 0); for (const [a, b] of m.edges) { deg[a]++; deg[b]++; }
      if (q.ends.length < 2) out.push(`${tag}: ${q.ends.length} dead ends off the way`);
      for (const r of q.bare) out.push(`${tag}: a dead end off the way with no reward (room ${r.id})`);
      for (const r of m.rooms) if (r.kind === 'ledge' && deg[r.id] !== 1) out.push(`${tag}: a ledge on ${deg[r.id]} ways (room ${r.id})`);
      if (q.onWay * 3 > q.list.length) out.push(`${tag}: ${q.onWay} of ${q.list.length} rewards on the way`);
      const el = q.list.filter((w) => w.kind === 'elite' && q.way.has(w.room)).length; if (el) out.push(`${tag}: ${el} elites on the way`); }
    return out; }
  // the magma caves' hazards (TASKS 406): as many on each floor as HAZ.n has (more each floor to the 3rd), every one HAZ.clear cells
  // off the start's fire, the spawn, the stairs, chests, monsters' posts and the altar, a vent on 3×3 of floor a cell off the lava;
  // the warning comes HAZ.warn s before the burst, which hurts the hero (a vent sets him alight) and a monster in its ring once a
  // cycle, and nobody outside it
  // a run on a plain plateau floor for the checks of the plateaus' lava, chasm, crust and hazards (TASKS 426: a run's first floor
  // is a lava cave): run 3's first plain floor, else the next run's
  // the magma caves' new kinds (TASKS 407–409), by a river of lava on a plain floor: a bank, three cells of open lava, the far bank
  function magmaKindsCheck() {
    const out = [], Z = spawn(0, {}); Z.screen = 'play'; let sp = null, LW = 3;
    // the floor a bank cell reaches within eight cells round: a pocket of lava inside one plateau has its two sides joined
    const bankOf = (m, x0, y0) => { const W = m.W, got = new Set([y0 * W + x0]); for (const k of got) for (const o of [1, -1, W, -W]) { const n = k + o, x = n % W, y = Math.floor(n / W);
      if (Math.abs(x - x0) <= 8 && Math.abs(y - y0) <= 8 && cell(m, x, y) === 1) got.add(n); } return got; };
    // (the first magma floor with such a crossing, seed by seed)
    for (let sd = 3; sd < 40 && !sp; sd++) { Z.run = newRun(Z, 'magma', sd); for (let f = 1; f < D.RUNS.magma.floors && !sp; f++) { enterFloor(Z, Z.run, f); const m = Z.run.map, W = m.W; if (m.ftype2) continue;
      const lav = (x, y) => cell(m, x, y) === 3 && !crustAt(m, y * W + x), fl = (x, y) => cell(m, x, y) === 1;
      for (let k = 3; k >= 2 && !sp; k--) for (let y = 3; y < m.H - 3 && !sp; y++) for (let x = 3; x < W - 9 && !sp; x++)
        if ([-2, -1, 0].every((i) => [-1, 0, 1].every((j) => fl(x + i, y + j))) && Array.from({ length: k }, (_, i) => i + 1).every((i) => [-1, 0, 1].every((j) => lav(x + i, y + j))) && [k + 1, k + 2].every((i) => [-1, 0, 1].every((j) => fl(x + i, y + j))) && !bankOf(m, x, y).has(y * W + x + k + 1)) { sp = [x, y]; LW = k; } } }
    if (!sp) return ['magma kinds: no river two or three cells wide with banks on any magma floor'];
    const R = Z.run, m = R.map, h = R.hero, W = m.W, t = () => Z.t, lav = (x, y) => cell(m, x, y) === 3 && !crustAt(m, y * W + x); R.msg = null;
    const haz = m.hazards; m.hazards = [];   // (no vent or rock in the way of what is measured, and no blow dodged)
    const agi = h.base.agi; h.base.agi = 0; h.eq = Object.fromEntries(Object.keys(h.eq).map((k) => [k, null]));
    const X = (i) => (sp[0] + i + 0.5) * TILE, Y = (sp[1] + 0.5) * TILE + 4, steps = (s, f) => { for (let i = 0; i < 120 * s; i++) { step(Z, { keys: [] }); if (f && f()) return true; } return false; };
    const put = (hx = X(-1)) => { R.en = []; R.proj = []; R.fires = []; h.hp = heroSt(Z).maxHp; h.deadT = -1; h.burn = 0; h.ifr = 0; h.x = hx; h.y = Y; h.vx = h.vy = 0; h.dashT = -9; };
    const mk = (type, x, y, o) => { const E = ENEMIES[type], e = Object.assign({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp: E.hp * 3, max: E.hp * 3, dmg: 6, elite: 0, room: -1, st: 'chase', t0: t(), face: -1, aimA: Math.PI,
      cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: t(), hx: x, hy: y }, o); R.en.push(e); return e; };
    // the imp: a spark from range hurts and burns; one beside it leaps away; knocked into the lava it doesn't sink and leaps out;
    // on the hero's bank it leaps over the lava to the far one, where he can't walk to it
    { put(); const a = h.hp, i1 = mk('imp', X(-1) - 200, Y, { leapT: 1e9, lookT: 1e9 }); steps(3, () => h.hp < a);
      if (!(h.hp < a)) out.push('an imp in range never hurts the hero with its spark'); else if (!(h.burn > t())) out.push("an imp's spark does not set the hero burning"); void i1;
      put(); const i2 = mk('imp', X(-1) - 40, Y, { cdT: 1e9 }); let leapt = 0; steps(1.5, () => { if (i2.st === 'leap') leapt = 1; return leapt && i2.st === 'chase'; });
      if (!leapt) out.push('an imp beside the hero does not leap away'); else if (Math.hypot(i2.x - h.x, i2.y - h.y) < ENEMIES.imp.flee) out.push('an imp leaps away and lands still beside the hero');
      put(X(-3)); const i3 = mk('imp', X(Math.ceil(LW / 2)), Y, { cdT: 1e9 }); steps(1.5);
      if (i3.sinkT !== undefined || i3.deadT >= 0) out.push('an imp in the lava sinks or burns'); else if (cell(m, Math.floor(i3.x / TILE), Math.floor(i3.y / TILE)) !== 1) out.push('an imp in the lava stays in it');
      put(X(-2)); const i4 = mk('imp', X(-2) + 70, Y + 20, { cdT: 1e9, leapT: 0, lookT: 0 }); let over = 0; const F0 = () => flow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE));
      // (the far bank: floor the hero's bank doesn't reach within eight cells round; past a bend it lies lower down the river too)
      const near = bankOf(m, sp[0], sp[1]), far = () => { const x = Math.floor(i4.x / TILE), y = Math.floor(i4.y / TILE); return cell(m, x, y) === 1 && !near.has(y * W + x); };
      steps(4, () => { if (i4.st === 'leap' && lav(Math.floor(i4.x / TILE), Math.floor(i4.y / TILE))) over = 1; h.x = X(-2); h.y = Y; return over && i4.st === 'chase' && far(); }); void F0;
      if (!over) out.push('an imp on the hero\'s bank never leaps over the lava'); else if (!far()) out.push('an imp leaps out over the lava and does not land on the far bank'); }
    // the salamander: in the lava by the bank it comes for the hero and hurts him, never burning in it; its breath burns one in its
    // cone and spares one who stepped out of it; its fire on the floor burns; hurt, it swims back and heals, not while hit
    { put(X(-2)); const a = h.hp, s1 = mk('salamander', X(Math.ceil(LW / 2)), Y, { fa: Math.PI }); let out1 = 0; steps(6, () => { if (!onLava(m, s1)) out1 = 1; return h.hp < a; });
      if (s1.sinkT !== undefined || s1.hp < s1.max) out.push('a salamander burns in the lava'); if (!(h.hp < a)) out.push('a salamander by the bank never hurts the hero'); void out1;
      for (const stay of [1, 0]) { put(X(-2)); const B = ENEMIES.salamander.breath, s2 = mk('salamander', X(-2) - 110, Y, { fa: 0, aimA: 0, brT: 0 }); let lit = -1, a2 = h.hp, early = 0;
        // (out of the cone: off its side on whole floor, beyond its bite)
        const side = [[0, 120], [0, -120], [-40, 120], [-40, -120]].map(([dx, dy]) => [s2.x + dx, s2.y + dy]).find(([x, y]) => cell(m, Math.floor(x / TILE), Math.floor(y / TILE)) === 1 && cell(m, Math.floor(x / TILE), Math.floor((y - 20) / TILE)) === 1) || [s2.x, s2.y + 120];
        steps(2.5, () => { if (lit < 0 && s2.st === 'wind' && s2.br) lit = t(); if (!stay && lit >= 0) { h.x = side[0]; h.y = side[1]; h.vx = h.vy = 0; } if (lit >= 0 && t() - lit < B.wind - DT && h.hp < a2) early = 1; return lit >= 0 && t() > lit + B.wind + B.t; });
        if (lit < 0) { out.push('a salamander in reach never breathes fire'); break; }
        if (early) out.push("a salamander's breath burns before its wind-up is out");
        if (stay && !(h.hp < a2 && h.burn > t() - 0.5)) out.push("a salamander's breath does not burn the hero in its cone"); if (!stay && h.hp < a2) out.push("a salamander's breath burns a hero out of its cone"); }
      put(); const a3 = h.hp; addFire(R, Z, h.x, h.y, { src: 0, who: 'salamander', r: 30, ry: 0.6, t: 2.4, dmg: 5, per: 1, kind: 'trail' }); steps(0.2);
      if (!(h.hp < a3) || !(h.burn > t())) out.push("a salamander's fire on the floor does not burn the hero in it");
      put(X(-5)); const s3 = mk('salamander', X(-1), Y, { fa: 0 }); s3.hp = Math.round(s3.max * 0.4); const hp0 = s3.hp; let soaked = 0;
      steps(6, () => { h.x = X(-8); h.y = Y; if (s3.st === 'soak' && onLava(m, s3)) soaked = 1; return soaked && s3.hp > s3.max * 0.55; });
      if (!soaked) out.push('a salamander under half its health does not go back into the lava'); else if (!(s3.hp > hp0)) out.push('a salamander in the lava does not heal');
      if (soaked && s3.st === 'soak') { const v = s3.hp; hitEnemy(Z, R, s3, 1, false, s3.x, s3.y, 0); const v1 = s3.hp; steps(0.8, () => { h.x = X(-8); h.y = Y; }); if (s3.hp > v1 + 0.5) out.push('a salamander heals in the lava while it is being hit'); void v; } }
    // the golem: its first blows only take its crust off, then blows land whole; the crust grows back with the hero away and no blow
    // landing; its slam hurts the hero before it and spares one who stepped back; dead, its pool burns him
    { put(X(-6)); const C = ENEMIES.golem.crust, g = mk('golem', X(-6) - 60, Y, { cdT: 1e9, hp: 400, max: 400 }), took = [];
      for (let i = 0; i <= C.n; i++) { const v = g.hp; hitEnemy(Z, R, g, 40, false, h.x, h.y); took.push(v - g.hp); }
      if (took.slice(0, C.n).some((d) => d !== Math.round(40 * C.k)) || took[C.n] !== 40) out.push(`a golem's blows through its crust took ${took.join('/')}, not ${Math.round(40 * C.k)} × ${C.n} then 40`);
      // (calm at its post: one walking after the hero stepped on a spike plate, a blow all the same)
      put(X(-6)); R.en = [g]; Object.assign(g, { x: X(-2), y: Y, hx: X(-2), hy: Y, st: 'idle', calmT: 1e9 }); g.hitT = g.blowT = t(); let grew = 0; steps(C.calm + 3 * C.regrow, () => { h.x = g.x + 340; h.y = g.y; if ((g.crust ?? C.n) > 0) grew = 1; return grew; });
      if (!grew) out.push("a golem's crust never grows back with the hero away");
      for (const stay of [1, 0]) { put(X(0)); const g2 = mk('golem', X(-2), Y, { cdT: 0 }); let w = -1, a = h.hp;
        steps(3, () => { if (w < 0 && g2.st === 'wind') w = t(); if (!stay && w >= 0) { h.x = g2.x - 2 * TILE; h.y = g2.y - 3 * TILE; } else if (stay) { h.x = X(0); h.y = Y; } h.vx = h.vy = 0; return w >= 0 && g2.st === 'chase'; });
        if (w < 0) { out.push('a golem beside the hero never slams'); break; } if (stay && !(h.hp < a)) out.push("a golem's slam does not hurt the hero before it"); if (!stay && h.hp < a) out.push("a golem's slam hurts a hero who stepped back"); }
      put(X(-1)); const g3 = mk('golem', X(-1), Y, { cdT: 1e9, st: 'idle', calmT: 1e9 }); g3.hp = 1; g3.crust = 0; hitEnemy(Z, R, g3, 10, false, h.x - 30, h.y); const pool = (R.fires || []).find((p) => p.kind === 'pool');
      if (!pool) out.push('a golem falls without a pool of lava'); else { const a = h.hp; steps(ENEMIES.golem.pool.arm * 0.8); if (h.hp < a) out.push("a golem's pool burns its killer before he can step out");
        steps(ENEMIES.golem.pool.arm * 0.2 + 0.3); if (!(h.hp < a)) out.push("a golem's pool does not burn the hero in it");
        steps(ENEMIES.golem.pool.t); if (R.fires.includes(pool)) out.push("a golem's pool never cools"); } }
    // a burning hero beats the flames out with a dash (TASKS 463)
    { put(); h.burn = t() + 3; h.cd.dash = 0; Z.ev = []; step(Z, { keys: ['Space'] }); if (h.burn > t() || !Z.ev.some((e) => e.k === 'snuff')) out.push('a dash does not put out a burning hero'); }
    m.hazards = haz; h.base.agi = agi; return out;
  }
  const plainRun = (Z) => { for (let sd = 3; sd < 60; sd++) { Z.run = newRun(Z, 'magma', sd); for (let f = 2; f < D.RUNS.magma.floors; f++) { enterFloor(Z, Z.run, f); if (Z.run.map.ftype === 'plain') return Z.run; } } return Z.run; };
  function hazardCheck() {
    const out = [], HZ = D.HAZ, cnt = { vent: [0, 0, 0, 0], fall: [0, 0, 0, 0] };
    // (counted on the plain plateaus: the floor types' figures leave each its own room for them)
    for (const sd of [1, 77, 4242, 5, 12, 33]) for (let f = 1; f <= D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', ftype: 'plain' }), W = m.W, tag = `magma ${sd} f${f}`;
      const keepOff = [[m.spawn.x, m.spawn.y], [m.exit.x, m.exit.y], ...m.chests.map((c) => [c.x, c.y]), ...m.enemies.map((e) => [e.x, e.y]), ...m.shrines.map((q) => [q.x, q.y])];
      const st = m.rooms.find((r) => r.type === 'start'); keepOff.push([(st.cx + 0.5) * TILE, (st.cy + 0.5) * TILE + 6]);
      for (const z of m.hazards || []) { cnt[z.k][f - 1]++; const tx = Math.floor(z.x / TILE), ty = Math.floor(z.y / TILE);
        if (keepOff.some(([x, y]) => Math.hypot(x - z.x, y - z.y) < HZ.clear * TILE)) out.push(`${tag}: a ${z.k} within ${HZ.clear} cells of the start, the spawn, the stairs, a chest, a monster or the altar at ${tx},${ty}`);
        if (cell(m, tx, ty) !== 1) out.push(`${tag}: a ${z.k} off the floor at ${tx},${ty}`);
        if (z.k === 'vent') for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, tx + i, ty + j) !== 1) { out.push(`${tag}: a vent without 3×3 of floor at ${tx},${ty}`); j = i = 9; }
        if (z.k === 'vent') for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.max(Math.abs(i), Math.abs(j)) <= 2 && m.cells[(ty + j) * W + tx + i] === 3 && Math.max(Math.abs(i), Math.abs(j)) <= 1) out.push(`${tag}: a vent by the lava at ${tx},${ty}`); } }
    for (const k of ['vent', 'fall']) { const c = cnt[k]; if (!(c[0] > 0 && c[0] < c[1] && c[1] < c[2] && c[3] < c[2])) out.push(`magma hazards: ${k}s by floor ${c.join('/')} (six seeds) do not grow to the 3rd`); }
    // (TASKS 461) on every floor but the boss's two rings at least stand on the walk from the spawn to the stairs: laid at random
    // a third of the floors had none on it
    for (const sd of [1, 7, 33, 128]) for (const ft of ['plain', 'lake', 'river', 'terrace', 'chasm']) for (let f = 1; f < D.RUNS.magma.floors; f++) {
      const m = DG.genFloor(sd * 37 + f * 1013, f, { mode: 'magma', ftype: ft }); if (!m || !m.hazards) continue; const W = m.W;
      const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e = m.exit.ty * W + m.exit.tx, from = new Int32Array(W * m.H).fill(-2), q = [s0]; from[s0] = -1;
      for (let i = 0; i < q.length && from[e] === -2; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (from[n] === -2 && m.cells[n] === 1) { from[n] = q[i]; q.push(n); } }
      const way = []; for (let k = e; k >= 0 && from[e] !== -2; k = from[k]) way.push(k);
      const on = m.hazards.filter((z) => way.some((k) => D.hazIn(z, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE))).length;
      if (on < 2) out.push(`magma ${ft} ${sd} f${f}: ${on} hazard ring(s) on the walk to the stairs, 2 at least`); }
    // the burst: the hero in the ring is hurt once (his regeneration over the run aside) and, by a vent, set alight; a monster in it
    // is hurt, the hero out of it is not
    for (const k of ['vent', 'fall']) { const Z = spawn(0, {}); plainRun(Z); Z.screen = 'play'; const R2 = Z.run, m = R2.map, h = R2.hero, H = HZ[k];
      const z = (m.hazards || []).find((q) => q.k === k); if (!z) { out.push(`magma hazards: no ${k} on the first plain floor of seed 3`); continue; }
      const at = (c) => (((c / z.per - z.ph) % 1 + 1) % 1 + Math.ceil(Z.t / z.per + 2)) * z.per, mob = { id: R2.nextId++, type: 'skeleton', x: z.x - 12, y: z.y + 4, vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'idle', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: -9 };
      const run = (hx, hy) => { R2.en = [Object.assign({}, mob, { haz: {} })]; h.x = hx; h.y = hy; h.haz = {}; h.ifr = 0; h.burn = 0; h.dashT = -9; const st0 = stats(h, Z.meta); h.hp = st0.maxHp;
        Z.t = R2.t = at(z.per - H.warn - 0.1); Z.ev = []; const hp0 = h.hp; let warnT = -1, burstT = -1;
        for (let i = 0; i < Math.round((H.warn + 0.6) * 120); i++) { h.x = hx; h.y = hy; h.vx = h.vy = 0; R2.en[0].x = mob.x; R2.en[0].y = mob.y; step(Z, { keys: [] });
          for (const e of Z.ev) { if (e.k === 'hazwarn' && e.i === m.hazards.indexOf(z) && warnT < 0) warnT = e.t; if ((e.k === 'erupt' || e.k === 'rockfall') && e.i === m.hazards.indexOf(z) && burstT < 0) burstT = e.t; } Z.ev = []; }
        return { lost: hp0 - h.hp, burn: h.burn > Z.t - 0.6, mob: 999 - R2.en[0].hp, lead: burstT - warnT }; };
      // (the spot out of the ring is the first side of it on whole floor, two cells from any lava and out of every other hazard's
      // reach: a fixed one fell in the lava once the plateaus' sizes varied, TASKS 432)
      const clear = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (cell(m, tx + i, ty + j) !== 1) return false;
        return m.hazards.every((q) => q === z || Math.hypot(q.x - x, q.y - y) > HZ[q.k].r + 60); };
      // (further round it and further out when the four sides are not clear: the packs of TASKS 407 shifted the floor seed 3 draws)
      const off = [40, 70, 100].flatMap((g) => Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * (H.r + g), Math.sin(i * Math.PI / 4) * (H.r * 0.6 + g)])).find(([dx, dy]) => clear(z.x + dx, z.y + dy)) || [H.r + 40, 0];
      const inside = run(z.x + 8, z.y), outside = run(z.x + off[0], z.y + off[1]);
      if (!(Math.abs(inside.lead - H.warn) < 0.05)) out.push(`magma hazards: a ${k}'s warning comes ${inside.lead.toFixed(2)} s before its burst, not ${H.warn}`);
      if (inside.lost < stats(h, Z.meta).maxHp * H.hp * 0.75 || inside.lost > stats(h, Z.meta).maxHp * H.hp * 2.5) out.push(`magma hazards: a ${k} in its ring takes ${inside.lost} health from the hero`);
      if (H.burn && !inside.burn) out.push(`magma hazards: a vent does not set the hero alight`);
      if (inside.mob <= 0) out.push(`magma hazards: a ${k} does not hurt a monster in its ring`);
      if (outside.lost > 0) out.push(`magma hazards: a ${k} hurts the hero out of its ring`); }
    return out;
  }
  function meleeSpacingCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 1234); S.screen = 'play';
    const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const x = (rm.x + rm.w / 2) * TILE, y = (rm.y + rm.h / 2) * TILE;
    R.pots = []; R.chests = []; m.decor = []; m.block = []; m.traps = []; m.water = []; R.shrines = []; m.webs = []; m.torches = m.torches.filter((t) => t.kind === 'wall');
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
    // the endless descent (TASKS 348–349): a pair is one biome drawn from the run's seed, the same for the same seed; every biome
    // comes up; a pair ends by turns with the exit's elite guard and the biome's boss; maps grow to the cap and no further; floors
    // generate with the hero on open floor; a run goes on past the 12th and its depth is the record; no demon lord nor serpent before
    // the 8th
    { const E = D.RUNS.endless, seen = new Set();
      for (let sd = 1; sd <= 40; sd++) for (let f = 1; f <= 20; f++) { const a = D.stageOf('endless', f, sd), b = D.stageOf('endless', f, sd); seen.add(a.biome);
        if (a.biome !== b.biome || a.biome !== D.stageOf('endless', f % 2 ? f + 1 : f - 1, sd).biome) { out.push(`endless seed ${sd} f${f}: a pair's biome not fixed by the seed`); break; }
        const p = Math.floor((f - 1) / 2), end = f % 2 === 0;
        const big = E.big.includes(E.bosses[a.biome]) && f < E.bigFrom;
        if ((end && f >= E.guardFrom) !== !!(a.boss || a.guard) && !(end && a.boss) || (end && (p % 2 === 1 && !big) !== !!a.boss) || (a.boss && a.boss !== E.bosses[a.biome])) { out.push(`endless seed ${sd} f${f}: wrong end of the pair`); break; } }
      for (const b of E.pool) if (!seen.has(b)) out.push(`endless: biome ${b} never comes up on 40 seeds`);
      for (let sd = 1; sd <= 5; sd++) { let last = {};   // within each kind of map (rooms, caves) apart: a cave starts larger
        for (let f = 1; f <= 40; f++) { const st = D.stageOf('endless', f, sd), k = st.arch || 'rooms', a = st.size[0] * st.size[1];
          if (a < (last[k] || 0) || a > E.size.to[0] * E.size.to[1] || (f >= E.size.floors && a !== E.size.to[0] * E.size.to[1])) { out.push(`endless seed ${sd} f${f}: the map does not grow to its cap and stop`); break; } last[k] = a; } }
      for (const [sd, f] of [[3, 1], [3, 2], [3, 4], [5, 7], [5, 8], [11, 14], [2, 23], [7, 30]]) { const st = D.stageOf('endless', f, sd), m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'endless', runSeed: sd });
        if (m.W !== st.size[0] || cell(m, Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE)) !== 1) out.push(`endless seed ${sd} f${f}: map size or spawn wrong`);
        if (st.boss && !m.enemies.some((e) => e.type === st.boss)) out.push(`endless seed ${sd} f${f}: no ${st.boss}`);
        if (st.guard && !m.enemies.some((e) => e.guard)) out.push(`endless seed ${sd} f${f}: no exit guard`); }
      const S = spawn(0, {}); S.run = newRun(S, 'endless', 9); S.screen = 'play'; const R = S.run; enterFloor(S, R, 13);
      if (R.floor !== 13 || lastFloor(R) || !R.map) out.push('endless: a run does not go on past the 12th');
      // saved on the 13th and taken up again (the menu's «Продолжить»): the same floor, its pair's biome, the map, and on down
      { const T = spawn(0, { run: JSON.parse(JSON.stringify(R)) }); T.screen = 'menu'; { const b = UI.menu(true, T.meta.diff, 0, T.meta.zoom).find((q) => q.id === 'continue'); step(T, { px: b.x + b.w / 2, py: b.y + b.h / 2, click: 1, keys: [] }); }
        const Q = T.run; if (!Q || Q.mode !== 'endless' || Q.floor !== 13 || Q.map.W !== R.map.W || D.floorName(Q.floor, Q.mode, Q.seed) !== D.floorName(13, 'endless', 9)) out.push('endless: a saved run does not continue as it was');
        else { enterFloor(T, Q, 14); if (D.stageOf('endless', 14, Q.seed).biome !== D.stageOf('endless', 13, 9).biome) out.push('endless: a continued run loses its pair\'s biome'); } }
      // past the serpent (TASKS 354): the stairs beside the portal stay shut while it lives; taken after, they win the campaign there
      // (a win, the record 12, the win's shards and the gold's so far) and the same run, the hero as he was, goes on from the 13th;
      // the gold paid at the stairs is not paid again at the end
      { const T = spawn(0, {}); T.run = newRun(T, 'campaign', 21); T.screen = 'play'; const Q = T.run, hq = Q.hero; enterFloor(T, Q, 12); const md = Q.map, lvl = 17; hq.lvl = lvl; Q.goldTot = 4000;
        if (!md.down) out.push('campaign f12: no stairs on past the serpent');
        else { hq.x = md.down.x; hq.y = md.down.y + 20; interact(T, Q);
          if (Q.floor !== 12) out.push('campaign f12: the stairs on open before the serpent falls');
          const b = Q.en.find((e) => e.type === 'boss_serpent'); b.hp = 0; killEnemy(T, Q, b); const w0 = T.meta.wins || 0, s0 = T.meta.shards, id = hq.eq.weapon.id;
          hq.x = md.down.x; hq.y = md.down.y + 20; interact(T, Q);
          if (Q.floor !== 13 || Q.mode !== 'endless' || T.meta.wins !== w0 + 1 || T.meta.best !== 12 || T.meta.shards - s0 !== Math.floor(4000 / REWARD.goldPer) + REWARD.win || hq.lvl !== lvl || hq.eq.weapon.id !== id)
            out.push('campaign f12: the stairs on do not win the campaign and go on to the 13th with the same hero');
          Q.goldTot += 500; endRun(T, 'dead'); if (T.result.base !== Math.floor(500 / REWARD.goldPer) || T.meta.bestEndless !== 13 || !T.result.campaignWon) out.push('campaign f12: the descent pays the campaign\'s gold twice or keeps no depth'); } }
      endRun(S, 'dead'); if (S.meta.bestEndless !== 13 || S.result.mode !== 'endless' || !S.result.record || !S.result.record.fresh) out.push('endless: the record depth is not kept');
      // each of the five bosses at the end of an endless pair (TASKS 350): its arena seals when the hero walks in and opens at its
      // death; a chapter's end boss pays as the finale (20 shards, LOOT.boss), the others as a chapter boss (3 shards and an item);
      // its floor keeps an altar, and the stairs lead on to the next pair
      for (const type of Object.values(E.bosses)) { let found = null;
        for (let sd = 1; sd <= 80 && !found; sd++) for (let f = 8; f <= 24 && !found; f += 4) if (D.stageOf('endless', f, sd).boss === type) found = [sd, f];
        if (!found) { out.push(`endless: no ${type} on floors 8–24 of seeds 1–80`); continue; }
        const T = spawn(0, {}); T.run = newRun(T, 'endless', found[0]); T.screen = 'play'; const Q = T.run; enterFloor(T, Q, found[1]); const m2 = Q.map, b = Q.en.find((e) => e.type === type), r = m2.rooms[b.room];
        Q.hero.x = (r.x + r.w / 2) * TILE; Q.hero.y = (r.y + r.h / 2) * TILE; stepArena(T, Q);
        if (!Q.arena || !Q.arena.active || !arenaSealed(Q)) { out.push(`endless ${type}: the arena does not seal`); continue; }
        Q.drops = []; b.hp = 0; killEnemy(T, Q, b); const big = E.big.includes(type), shards = Q.drops.filter((d) => d.kind === 'shard').reduce((n, d) => n + d.n, 0), items = Q.drops.filter((d) => d.kind === 'item' && !isCons(d.item)).length;
        if (arenaSealed(Q) || Q.arena.active || (m2.doors || []).some((d) => d.arena && !d.open)) out.push(`endless ${type}: the arena stays shut after its death`);
        if (shards !== (big ? 20 : 3) || items < (big ? LOOT.boss.length : 1) || (!big && items > 1)) out.push(`endless ${type}: pays ${shards} shards and ${items} items`);
        if (!m2.shrines.some((q) => q.boss)) out.push(`endless ${type}: no altar on its floor`);
        enterFloor(T, Q, found[1] + 1); if (Q.floor !== found[1] + 1 || D.stageOf('endless', Q.floor, found[0]).pair !== found[1] / 2) out.push(`endless ${type}: the stairs do not lead on`); } }
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
    for (const [name, f] of [['banner', (o) => o.kind === 'banner'], ['shelf', (o) => o.kind === 'shelf'], ['sconce', (o) => o.trig && o.trig.k === 'sconce' && o.dir === 'u'], ['plate', (o) => o.trig && o.trig.k === 'plate' && o.dir === 'u']]) {
      const [S, q] = find(f); if (!q) { out.push(`secret check: no ${name} secret in 120 seeds`); continue; }
      S.screen = 'play'; const R = S.run, m = R.map, h = R.hero; R.en = []; R.stats[1] = floorStat(R); h.ifr = 1e9;
      // (below the wall's foot: a mechanism's wall in a room's top wall, as the first seeds had it before TASKS 373 moved them)
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
    for (const sd of [11, 222]) for (let f = 1; f <= D.RUNS.campaign.chapter; f++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play';
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
      if (!L2.run.stats || L2.run.stats[2].foes !== L2.run.en.filter(counted).length) out.push('completion: an old save gets no stats for its floor'); }
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
      // (the 1st floor's shaped rooms have no doors, TASKS 374: the first seed from 5 with a plain door there)
      { let S = null; for (let sd = 5; sd < 40 && !(S && S.run.map.doors.some((o) => !doorLock(S.run.map, o))); sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); }
        S.screen = 'play'; const R = S.run, m = R.map, h = R.hero, d = m.doors.find((o) => !doorLock(m, o));
        if (!d) out.push('doors: no plain door on the 1st floor of seeds 5–39'); else { const [cx, cy] = d.cells[0]; R.en = [];
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
        for (let f = 1; f <= 4; f++) { if (f > 1) enterFloor(S, S.run, f); const m = S.run.map; w = m.webs.find((o) => clear(m, o)); if (w) { R = S.run; break; } } }
      if (!R) out.push('traps: no floor of 80 seeds with webs'); else { const m = R.map, h = R.hero; R.en = [];
        const run = (x, y) => { h.x = x; h.y = y; h.vx = h.vy = 0; const x0 = h.x; for (let i = 0; i < 30; i++) step(S, { right: 1, px: 960, py: 540, keys: [] }); return h.x - x0; };
        const free = run(w.x - 200, w.y), held = run(w.x - 12, w.y); if (!(held < free * 0.6)) out.push(`traps: a web does not hold the hero (${held.toFixed(0)} px against ${free.toFixed(0)})`);
        // (aimed through the camera: on a small map, TASKS 373, it stops at the map's edge and the hero is off the screen's middle)
        const aim = () => toPx(R, h.x + 60, h.y - 30);
        h.x = w.x - 40; h.y = w.y + 8; h.atkT = -9; h.cd.atk = 0; step(S, { ...aim(), press: 1, keys: [] }); for (let i = 0; i < 40; i++) step(S, { ...aim(), keys: [] });
        if (!w.torn) out.push('traps: a blow does not tear a web');
        const w2 = m.webs.find((o) => !o.torn); if (w2) { tearWebs(S, R, w2.x, w2.y, 30, undefined, undefined, 1); if (!w2.torn || !S.ev.some((e) => e.k === 'webburn')) out.push('traps: fire does not burn a web'); }
      } }
    {
      const S = spawn(0, {}); S.run = newRun(S, 'cave', 26837); S.screen = 'play'; const R = S.run, m = R.map;
      if (m.ambush.length) out.push('ambush: generated pressure plate');
      const room = m.rooms.filter((r) => r.type === 'treasure').sort((a, b) => b.w * b.h - a.w * a.h)[0];
      if (!room) out.push('ambush: no treasure fixture'); else {
        R.hero.x = (room.cx + 0.5) * TILE; R.hero.y = (room.cy + 0.5) * TILE;
        const before = R.en.length; S.ev = []; const P = { room: room.id, n: 4 };
        const ok = springAmbush(S, R, P), got = R.en.slice(before);
        if (ok ? got.length !== 4 || got.some((e) => e.elite || e.room !== room.id) : got.length || S.ev.some((e) => e.k === 'ambush')) out.push('ambush: partial or elite group / false announcement');
        springAmbush(S, R, P); if (R.en.length !== before + got.length) out.push('ambush: group repeats');
        const c = R.chests[0]; S.ev = []; const n = R.en.length; c.open = 0; openChest(S, R, c); openChest(S, R, c);
        if (S.ev.filter((e) => e.k === 'chest').length !== 1) out.push('ambush: chest opens twice');
        const T = spawn(0, JSON.parse(JSON.stringify(persist(S)))); if (T.saved && !T.saved.chests.find((q) => q.x === c.x && q.y === c.y).ambushRolled) out.push('ambush: roll lost on save');
        const small = { room: room.id, n: 4 }; R.hero.x = m.spawn.x; R.hero.y = m.spawn.y; S.ev = []; const count = R.en.length;
        if (springAmbush(S, R, small) || R.en.length !== count || S.ev.some((e) => e.k === 'ambush')) out.push('ambush: spawns with hero outside room');
      }
    }
    // the cave's monsters (TASKS 307, 308): the run places drowned in the shallows and slimes; a drowned lies still until the hero
    // comes within its sense, rises and only then hunts; its grab draws the hero a step in; a slime's hop lands against the hero and
    // hurts him; a slime splits in two small ones that carry nothing and stay out of the floor's count, the small ones never split,
    // and a puddle is left that slows the hero
    { const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); S.screen = 'play'; const R = S.run, h = R.hero, quiet = { px: 960, py: 540, keys: [] };
      let nDr = 0, nSl = 0; for (let f = 1; f <= 3; f++) { enterFloor(S, R, f); nDr += R.en.filter((e) => e.type === 'drowned').length; nSl += R.en.filter((e) => e.type === 'slime').length; }
      if (!nDr || !nSl) out.push(`cave monsters: ${nDr} drowned and ${nSl} slimes on floors 1-3 of seed 3`);
      enterFloor(S, R, 1); const m = R.map, sol = solids(R), wet = new Set(m.water);
      const open = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -6; i <= 6; i++) { const k = (y + j) * m.W + x + i; if (m.cells[k] !== 1 || wet.has(k)) return false; }
        return !sol.some((o) => Math.abs(o.x - (x + 0.5) * TILE) < 7 * TILE && Math.abs(o.y - (y + 0.5) * TILE) < 2 * TILE); };
      let spot = null; for (let k = 0; k < m.W * m.H && !spot; k++) if (open(k % m.W, Math.floor(k / m.W))) spot = [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE];
      const mob = (type, x, y, o) => { const E = ENEMIES[type]; const e = Object.assign({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 5, elite: 0, room: -1, st: 'chase', t0: S.t, face: -1, aimA: Math.PI,
        cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, hx: x, hy: y, seenT: S.t, ft: -9 }, o); R.en.push(e); return e; };
      if (!spot) out.push('cave monsters: no open dry floor on floor 1 of seed 3'); else { const [x0, y0] = spot, E = ENEMIES.drowned, reset = () => { R.en = []; h.x = x0; h.y = y0; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0; h.pull = null; h.dashT = -9; };
        reset(); const d = mob('drowned', x0 + E.sense + 40, y0, { st: 'lurk', t0: -9 }); for (let i = 0; i < 120; i++) step(S, quiet);
        if (d.st !== 'lurk' || Math.hypot(d.x - x0 - E.sense - 40, d.y - y0) > 0.01) out.push(`cave monsters: a lurking drowned stirs with the hero out of its sense (${d.st})`);
        h.x = d.x - E.sense + 20; step(S, quiet); if (d.st !== 'rise') out.push('cave monsters: a drowned does not rise for a hero within its sense');
        const t0 = S.t; while (d.st === 'rise' && S.t - t0 < 3) step(S, quiet); if (d.st === 'rise' || Math.abs(S.t - t0 - E.rise) > 0.05) out.push(`cave monsters: a drowned rises in ${(S.t - t0).toFixed(2)} s, not ${E.rise}`);
        // the grab: from out of the blow's reach, nothing in hand; the hero must end a step nearer, and never inside it
        reset(); const g = mob('drowned', x0 + E.r + K.R + 90, y0, { cdT: 0, grabT: 0 }); let pulled = 0;
        for (let i = 0; i < 240 && !pulled; i++) { const hx = h.x; step(S, quiet); h.hp = 1e4; if (S.ev.some((e) => e.k === 'grabbed' && e.id === g.id && e.t === S.t)) pulled = 1; else if (h.x - hx > 0.01 && !h.pull) h.x = hx; }
        if (!pulled) out.push('cave monsters: a drowned never grabs a hero within its reach'); else { const hx = h.x; for (let i = 0; i < 40; i++) step(S, quiet);
          if (h.x - hx < E.grab.pull * 0.6) out.push(`cave monsters: a grab draws the hero only ${(h.x - hx).toFixed(1)} px`); if (g.x - h.x < E.r + K.R) out.push('cave monsters: a grab draws the hero into the drowned'); }
        // the hop
        reset(); const sl = mob('slime', x0 + 90, y0, { cdT: 0 }); let landed = 0; for (let i = 0; i < 240 && !landed; i++) { step(S, quiet); if (S.ev.some((e) => e.k === 'land' && e.id === sl.id && e.t === S.t)) landed = 1; }
        if (!landed || h.hp >= 1e4 && !S.ev.some((e) => e.k === 'dodge')) out.push(`cave monsters: a slime's hop ${landed ? 'lands without a blow' : 'never lands'}`);
        if (landed && Math.hypot(sl.x - h.x, sl.y - h.y) > ENEMIES.slime.r + K.R + 10) out.push('cave monsters: a slime lands away from the hero');
        // the split, the puddle and the small ones
        reset(); const f0 = fstat(R).foes, k0 = fstat(R).kills, big = mob('slime', x0 + 120, y0, { cdT: 99 }); m.goo = []; const drops0 = R.drops.length; hitEnemy(S, R, big, 1e9, false, x0, y0);
        const small = R.en.filter((e) => e.type === 'slime_s'); if (small.length !== 2 || small.some((e) => e.summ !== big.id || e.st !== 'chase')) out.push(`cave monsters: a slime splits in ${small.length} small ones`);
        if (m.goo.length !== 1) out.push('cave monsters: a slime leaves no puddle'); if (fstat(R).foes !== f0 || fstat(R).kills !== k0 + 1) out.push('cave monsters: the small slimes count toward the floor');
        const dr = R.drops.length; for (const e of small) hitEnemy(S, R, e, 1e9, false, x0, y0);
        if (R.en.filter((e) => e.type === 'slime_s').length !== 2 || R.drops.length !== dr) out.push('cave monsters: a small slime splits again or drops loot');
        if (drops0 > dr) out.push('cave monsters: drops vanish');
        // the puddle slows the hero: his run across it against the same run on dry floor
        const run = (x) => { R.en = []; R.freeze = 0; h.x = x; h.y = y0; h.vx = h.vy = 0; const x1 = h.x; for (let i = 0; i < 24; i++) step(S, { right: 1, px: 960, py: 540, keys: [] }); return h.x - x1; };
        m.goo = []; const dry = run(x0 - 5 * TILE); m.goo = [{ id: 1, x: x0, y: y0, t0: S.t, T: 60, r: 60, rNow: 60 }]; const held = run(x0 - 50);
        if (!(held < dry * 0.75)) out.push(`cave monsters: a puddle does not slow the hero (${held.toFixed(0)} px against ${dry.toFixed(0)})`); } }
    // the caves' packs (TASKS 312): each floor brings its own kinds (data.js BIOMES.cave.from); in a hall with a crab and archers the
    // crab stands nearer the way the hero comes in; eels come up in the lakes between the halls too.
    { const S = spawn(0, {}), seen = [null, new Set(), new Set(), new Set(), new Set()]; let lakes = 0, lines = 0;
      for (const sd of [3, 5, 8]) { S.run = newRun(S, 'cave', sd); const R = S.run;
        for (let f = 1; f <= 4; f++) { enterFloor(S, R, f); const m = R.map; for (const e of R.en) seen[f].add(e.type); lakes += R.en.filter((e) => e.type === 'eel' && e.room < 0).length;
          const st = m.rooms[m.start], W = m.W, F = new Int32Array(W * m.H).fill(-1), q = [st.cy * W + st.cx], fv = (e) => F[Math.floor(e.y / TILE) * W + Math.floor(e.x / TILE)]; F[q[0]] = 0;
          for (let i = 0; i < q.length; i++) for (const d of [1, -1, W, -W]) { const n = q[i] + d; if (F[n] < 0 && m.cells[n] === 1) { F[n] = F[q[i]] + 1; q.push(n); } }
          for (const r of m.rooms) { const cr = R.en.filter((e) => e.room === r.id && e.type === 'crab'), ar = R.en.filter((e) => e.room === r.id && e.type === 'skel_archer'); if (!cr.length || !ar.length) continue; lines++;
            if (Math.min(...cr.map(fv)) > Math.min(...ar.map(fv))) out.push(`cave packs: seed ${sd} f${f} room ${r.id}: the archers stand nearer the way in than the crab`); } } }
      const D0 = D.BIOMES.cave.from;
      for (let f = 1; f <= 4; f++) for (const t of D.BIOMES.cave.roster) { const due = (D0[t] || 1) <= f; if (!due && seen[f].has(t)) out.push(`cave packs: a ${t} on floor ${f}, before its floor ${D0[t]}`); }
      for (const t of ['crab', 'skel_archer']) if (!seen[2].has(t)) out.push(`cave packs: no ${t} on floor 2`);
      for (const t of ['eel', 'skel_mage']) if (!seen[3].has(t)) out.push(`cave packs: no ${t} on floor 3`);
      if (!lakes) out.push('cave packs: no eel in a lake between halls on floors 3-4 of seeds 3, 5, 8'); if (!lines) out.push('cave packs: no hall with a crab before archers');
    }
    // the skeleton archer and mage (TASKS 311): the archer backs off from a hero who comes close; its aim follows him until the lock
    // and then holds; the arrow flies straight down it and hits a hero who stood still, not one who stepped aside after the lock.
    // The mage's ball flies at orb.spd and slows the hero it soaks; with a monster between it and the hero it keeps behind that one
    { const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); S.screen = 'play'; const R = S.run, h = R.hero, quiet = { px: 960, py: 540, keys: [] }; enterFloor(S, R, 1);
      const m = R.map, sol = solids(R), wet = new Set(m.water);
      const open = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -6; i <= 6; i++) { const k = (y + j) * m.W + x + i; if (m.cells[k] !== 1 || wet.has(k)) return false; }
        return !sol.some((o) => Math.abs(o.x - (x + 0.5) * TILE) < 7 * TILE && Math.abs(o.y - (y + 0.5) * TILE) < 2 * TILE); };
      let spot = null; for (let k = 0; k < m.W * m.H && !spot; k++) if (open(k % m.W, Math.floor(k / m.W))) spot = [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE];
      const mob = (type, x, y, o) => { const E = ENEMIES[type]; const e = Object.assign({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp: 1e4, max: 1e4, dmg: 5, elite: 0, room: -1, st: 'chase', t0: S.t, face: -1, aimA: Math.PI,
        cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, hx: x, hy: y, seenT: S.t, ft: -9 }, o); R.en.push(e); return e; };
      if (!spot) out.push('skeleton archer: no open dry floor on floor 1 of seed 3'); else { const [x0, y0] = spot, A = ENEMIES.skel_archer, O = ENEMIES.skel_mage.orb;
        const reset = () => { R.en = []; R.proj = []; m.decor = m.decor.filter((d) => Math.hypot(d.x - x0, d.y - y0) > 9 * TILE); h.x = x0 - 4 * TILE; h.y = y0; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0; h.slowT = -9; h.dashT = -9; S.ev = []; };
        const hits = () => S.ev.filter((q) => (q.k === 'hurt' && /снаряд/.test(q.src)) || q.k === 'dodge').length;
        reset(); const b = mob('skel_archer', h.x + 110, y0, { cdT: 99 }), d0 = Math.hypot(b.x - h.x, b.y - h.y); for (let i = 0; i < 120; i++) step(S, quiet);
        if (!(Math.hypot(b.x - h.x, b.y - h.y) > d0 + 20)) out.push(`skeleton archer: it does not back off from a hero at ${Math.round(d0)} px`);
        for (const side of [0, 1]) { reset(); const a = mob('skel_archer', x0 + 4 * TILE, y0); let n = 0; while (a.st !== 'wind' && n++ < 10) step(S, quiet);
          if (a.st !== 'wind') { out.push('skeleton archer: it does not draw at a hero in sight and reach'); break; }
          const w = D.windOf(a, A.wind); h.y = y0 - 16; while (S.t - a.t0 < w - A.arrow.lock - 0.05) step(S, quiet);
          const a1 = a.aimA, want = Math.atan2(h.y - 38 - (a.y - ARROW_Y), h.x - a.x); if (Math.abs(angDiff(a1, want)) > 0.02) out.push('skeleton archer: its aim does not follow the hero before the lock');
          while (S.t - a.t0 < w - A.arrow.lock + 0.03) step(S, quiet); const lk = a.aimA; if (side) h.y += 40; step(S, quiet);
          if (Math.abs(a.aimA - lk) > 1e-9 && a.st === 'wind') out.push('skeleton archer: its aim moves after the lock');
          while (a.st === 'wind') step(S, quiet); const p = R.proj.find((q) => q.k === 'arrow'); if (!p) { out.push('skeleton archer: no arrow on the loose'); break; }
          const v0 = [p.vx, p.vy]; for (let i = 0; i < 90 && !p.dead; i++) { step(S, quiet); if (p.vx !== v0[0] || p.vy !== v0[1]) { out.push('skeleton archer: the arrow turns in flight'); break; } }
          if (Math.abs(Math.atan2(v0[1], v0[0]) - lk) > 1e-9) out.push('skeleton archer: the arrow leaves off its aim line');
          if (!side && !hits()) out.push('skeleton archer: the arrow misses a hero who stood still'); if (side && hits()) out.push('skeleton archer: the arrow hits a hero who stepped aside after the lock'); }
        reset(); const g = mob('skel_mage', x0 + 4 * TILE, y0); let n = 0; while (!R.proj.some((q) => q.k === 'orb') && n++ < 400) step(S, quiet);
        const o = R.proj.find((q) => q.k === 'orb'); if (!o) out.push('skeleton mage: no ball of water thrown'); else { if (Math.abs(Math.hypot(o.vx, o.vy) - O.spd) > 1e-6) out.push('skeleton mage: the ball does not fly at orb.spd');
          n = 0; while (!o.dead && n++ < 600) step(S, quiet); if (!(h.slowT > S.t) && !S.ev.some((q) => q.k === 'dodge')) out.push('skeleton mage: the ball does not soak the hero it hits');
          const run = (slow) => { R.en = []; R.proj = []; R.freeze = 0; h.x = x0 - 4 * TILE; h.y = y0; h.vx = h.vy = 0; h.slowT = slow ? S.t + 9 : -9; const x1 = h.x; for (let i = 0; i < 24; i++) step(S, { right: 1, px: 960, py: 540, keys: [] }); return h.x - x1; };
          const dry = run(0), wetR = run(1); if (!(wetR < dry * (O.slow + 0.1))) out.push(`skeleton mage: a soaked hero is not slowed (${wetR.toFixed(0)} px against ${dry.toFixed(0)})`); }
        reset(); const c = mob('skeleton', x0 - 1 * TILE, y0, { cdT: 99 }), q = mob('skel_mage', x0 + 4 * TILE, y0 + 16, { cdT: 99 });
        for (let i = 0; i < 240; i++) { step(S, quiet); c.x = x0 - TILE; c.y = y0; c.st = 'chase'; }
        if (!(q.x > c.x + ENEMIES.skel_mage.behind * 0.6 && Math.abs(q.y - c.y) < 40)) out.push(`skeleton mage: it does not keep behind the skeleton (at ${Math.round(q.x - c.x)}, ${Math.round(q.y - c.y)} from it)`); } }
    // the crab (TASKS 309): a blow, a bolt or a blast from its front does armor.k of its damage, from its side or back all of it; it
    // turns no faster than its turn rate; it pinches a hero before it and never one behind it; a hero at its side is run down
    // sideways, the shell still facing its way
    { const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); S.screen = 'play'; const R = S.run, h = R.hero, quiet = { px: 960, py: 540, keys: [] }, E = ENEMIES.crab;
      let n = 0; for (let f = 1; f <= 4; f++) { enterFloor(S, R, f); n += R.en.filter((e) => e.type === 'crab').length; } if (!n) out.push('crab: none on floors 1-4 of seed 3');
      let m, wet, sol, spot = null; for (let f = 1; f <= 4 && !spot; f++) { R.seed = 8; enterFloor(S, R, 1 + (f - 1) % 4); m = R.map; wet = new Set(m.water); sol = solids(R);
      const open = (x, y) => { for (let j = -1; j <= 4; j++) for (let i = -5; i <= 5; i++) { const k = (y + j) * m.W + x + i; if (m.cells[k] !== 1 || wet.has(k)) return false; }
        return !sol.some((o) => Math.abs(o.x - (x + 0.5) * TILE) < 6 * TILE && o.y - (y + 0.5) * TILE > -2 * TILE && o.y - (y + 0.5) * TILE < 5 * TILE); };
      for (let k = 0; k < m.W * m.H && !spot; k++) if (open(k % m.W, Math.floor(k / m.W))) spot = [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]; }
      if (!spot) out.push('crab: no open dry floor on floors 1-4 of seed 3'); else { const [x0, y0] = spot;
        const crab = (o) => { R.en = []; R.proj = []; h.x = x0 - 140; h.y = y0; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0; h.dashT = -9; h.pull = null;
          const e = Object.assign({ id: R.nextId++, type: 'crab', x: x0, y: y0, vx: 0, vy: 0, hp: 1e4, max: 1e4, dmg: 5, elite: 0, room: -1, st: 'chase', t0: S.t, face: 1, fa: 0, aimA: 0,
            cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, hx: x0, hy: y0, seenT: S.t, ft: -9 }, o); R.en.push(e); return e; };
        for (const [nm, a, k] of [['front', 0, E.armor.k], ['front-side', E.armor.arc - 0.1, E.armor.k], ['side', Math.PI / 2, 1], ['back', Math.PI, 1]]) {
          const e = crab({}); hitEnemy(S, R, e, 100, false, x0 + Math.cos(a) * 40, y0 + Math.sin(a) * 40);
          if (Math.abs(1e4 - e.hp - 100 * k) > 1) out.push(`crab: a blow from its ${nm} does ${1e4 - e.hp}, not ${100 * k}`); }
        for (const [nm, a, k] of [['front', 0, E.armor.k], ['back', Math.PI, 1]]) { const e = crab({ cdT: 99 }), v = 400;
          R.proj.push({ id: R.nextId++, k: 'fire', x: x0 + Math.cos(a) * 140, y: y0 - 20, vx: -Math.cos(a) * v, vy: 0, t0: S.t, life: 2, dmg: 100, own: 'hero', r: 6 });
          for (let i = 0; i < 120 && R.proj.length; i++) { step(S, quiet); h.hp = 1e4; }
          if (Math.abs(1e4 - e.hp - 100 * k) > 1) out.push(`crab: a bolt from its ${nm} does ${1e4 - e.hp}, not ${100 * k}`); }
        // the turn: the hero behind it, half a second
        { const e = crab({ cdT: 99, rushT: 99 }); h.x = x0 - 120; for (let i = 0; i < 60; i++) step(S, quiet); const turned = Math.abs(e.fa);
          if (!(turned > 0.2 && turned <= E.turn * 0.5 + 0.02)) out.push(`crab: turns ${turned.toFixed(2)} rad in 0.5 s, not up to ${E.turn * 0.5}`); }
        // the pinch: a hero before it is hurt; one behind it is not, for the second it takes to turn even half way
        { const e = crab({}); h.x = x0 + E.r + K.R + 14; let hurt = 0; for (let i = 0; i < 240 && !hurt; i++) { step(S, quiet); if (S.ev.some((v) => v.k === 'hurt' && v.t === S.t)) hurt = 1; h.hp = 1e4; h.x = x0 + E.r + K.R + 14; h.y = y0; }
          if (!hurt || !S.ev.some((v) => v.k === 'pinch' && v.id === e.id)) out.push('crab: never pinches a hero before it'); }
        { const e = crab({ rushT: 99 }); h.x = x0 - E.r - K.R - 14; let hurt = 0; for (let i = 0; i < 120; i++) { step(S, quiet); if (S.ev.some((v) => v.k === 'hurt' && v.t === S.t)) hurt = 1; h.hp = 1e4; h.x = x0 - E.r - K.R - 14; h.y = y0; e.x = x0; e.y = y0; }
          if (hurt) out.push('crab: pinches a hero behind it'); }
        // the rush: a hero 100 px off its side; it runs at him and hurts him, still facing its way
        { const e = crab({ rushT: 0 }); h.x = x0; h.y = y0 + 100; let hurt = 0; for (let i = 0; i < 240 && !hurt; i++) { step(S, quiet); if (S.ev.some((v) => v.k === 'hurt' && v.t === S.t)) hurt = 1; h.hp = 1e4; if (!hurt) { h.x = x0; h.y = y0 + 100; } }
          if (!hurt || !S.ev.some((v) => v.k === 'rush' && v.id === e.id)) out.push('crab: never rushes a hero at its side');
          if (Math.abs(angDiff(e.fa, 0)) > 0.6) out.push(`crab: the rush turned its shell to ${e.fa.toFixed(2)}`);
          if (e.y - y0 < 40) out.push(`crab: the rush carries it only ${(e.y - y0).toFixed(0)} px sideways`); } } }
    // the eel (TASKS 310): it lies in deep water on the cave's floors and is no part of their count; under the water no blow touches it
    // and bolts fly over it; with the hero on its shore it shows where it will come up, comes up there in deep water by him, bites
    // him there and spits at him farther off, is hurt only while up, dives within its stay and comes up again `apart` cells away
    { const S = spawn(0, {}), quiet = { px: 960, py: 540, keys: [] }, E = ENEMIES.eel; let R, h, n = 0, spot = null;
      for (let sd = 1; sd <= 6 && !spot; sd++) { S.run = newRun(S, 'cave', sd); S.screen = 'play'; R = S.run; h = R.hero;
      for (let f = 1; f <= 4; f++) { enterFloor(S, R, f); const eels = R.en.filter((e) => e.type === 'eel'); n += eels.length;
        if (R.stats[f].foes !== R.en.filter((e) => !e.summ && e.type !== 'eel').length) out.push(`eel: floor ${f} counts its eels among its foes`);
        if (eels.some((e) => e.st !== 'deep' || R.map.cells[Math.floor(e.y / TILE) * R.map.W + Math.floor(e.x / TILE)] !== 6)) out.push(`eel: floor ${f} has an eel out of its deep water`);
        // a shore: the shallows by a deep water of an eel's body
        if (!spot) for (const e of eels) { const m = R.map, body = new Set(deepBody(m, e)); if (body.size < 12) continue;
          for (const k of body) { const s0 = [k - m.W, k + m.W, k - 1, k + 1].find((j) => m.cells[j] === 1);
            if (s0 !== undefined) { spot = { f, id: e.id, x: (s0 % m.W + 0.5) * TILE, y: (Math.floor(s0 / m.W) + 0.5) * TILE }; break; } } if (spot) break; } } }
      if (!n) out.push('eel: none on floors 1-4 of seeds 1-6'); if (!spot) out.push('eel: no shore by a deep water of 12 cells on floors 1-4 of seeds 1-6');
      else { enterFloor(S, R, spot.f); const m = R.map, e = R.en.find((o) => o.type === 'eel'), body = new Set(deepBody(m, e)), cellOf = (o) => Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE);
        R.en = [e]; Object.assign(e, { hp: 1e4, max: 1e4, dmg: 5, st: 'deep', cdT: 99 }); const reset = (x, y) => { h.x = x; h.y = y; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0; h.dashT = -9; R.proj = []; };
        // under: a blow and a bolt do nothing; the bolt flies on over the water
        reset(e.x - 200, e.y); hitEnemy(S, R, e, 100, false, e.x - 20, e.y); if (e.hp !== 1e4) out.push('eel: a blow hurts it under the water');
        R.proj.push({ id: R.nextId++, k: 'fire', x: e.x - 30, y: e.y - E.h * 0.45, vx: 400, vy: 0, t0: S.t, life: 2, dmg: 100, own: 'hero', r: 6 });
        step(S, { px: 960, py: 540, keys: [] }); for (let i = 0; i < 12; i++) step(S, quiet); if (e.hp !== 1e4) out.push('eel: a bolt hurts it under the water');
        // the hunt, 20 s with the hero on its shore: stir → rise → up, in its own deep water each time, a fresh spot each time up
        reset(spot.x, spot.y); Object.assign(e, { st: 'deep', cdT: 0 }); const seen = [], ups = []; let hurt = 0, jet = 0, off = 0, stirT = -1, hitUp = 0, last = e.st;
        for (let i = 0; i < 120 * 20; i++) { step(S, quiet); h.x = spot.x; h.y = spot.y; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0;
          if (S.ev.some((v) => v.k === 'hurt' && v.t === S.t)) hurt++; if (R.proj.some((p) => p.k === 'jet')) jet = 1;
          if (e.st !== last) { seen.push(e.st); if (e.st === 'stir') stirT = S.t; if (e.st === 'rise') { if (Math.abs(S.t - stirT - E.warn) > 0.02) out.push(`eel: comes up ${(S.t - stirT).toFixed(2)} s after it stirs, not ${E.warn}`); ups.push([e.x, e.y]); } last = e.st; }
          if (!body.has(cellOf(e))) off = 1;
          if (e.st === 'chase' && !hitUp) { const hp = e.hp; hitEnemy(S, R, e, 10, false, h.x, h.y); hitUp = hp - e.hp; } }
        if (off) out.push('eel: leaves its deep water'); if (ups.length < 3) out.push(`eel: comes up only ${ups.length} times in 20 s by the hero`);
        for (const st of ['stir', 'rise', 'chase', 'wind', 'strike', 'dive', 'deep']) if (!seen.includes(st)) out.push(`eel: never goes ${st} in 20 s by the hero`);
        for (let i = 1; i < ups.length; i++) if (Math.hypot(ups[i][0] - ups[i - 1][0], ups[i][1] - ups[i - 1][1]) < E.apart * TILE - 0.01) out.push(`eel: comes up ${(Math.hypot(ups[i][0] - ups[i - 1][0], ups[i][1] - ups[i - 1][1]) / TILE).toFixed(1)} cells from its last spot`);
        if (!hurt) out.push('eel: never hurts a hero on its shore'); if (hitUp !== 10) out.push(`eel: a blow while it is up does ${hitUp}, not 10`);
        // the jet: a hero on the shore out of its bite (spit) — it shows up in the hunt from a spot farther off, or from a fresh one here
        if (!jet) { reset(spot.x, spot.y); Object.assign(e, { st: 'chase', t0: S.t, upT: S.t, cdT: 0, bit: 0 }); const far = [...body].map((k) => [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE])
            .find(([x, y]) => Math.hypot(x - h.x, y - h.y) > E.r + K.R + E.reach + 20 && Math.hypot(x - h.x, y - h.y) < E.spit.reach - 40 && losClear(m, x, y - 30, h.x, h.y - 30));
          if (far) { e.x = far[0]; e.y = far[1]; for (let i = 0; i < 240 && !jet; i++) { step(S, quiet); h.x = spot.x; h.y = spot.y; if (R.proj.some((p) => p.k === 'jet')) jet = 1; } } }
        if (!jet) out.push('eel: never spits at a hero out of its bite');
        // up for no longer than its stay, then under: a blow does nothing again
        Object.assign(e, { st: 'chase', t0: S.t, upT: S.t, cdT: 99, bit: 0 }); let t1 = -1; for (let i = 0; i < 120 * 4 && t1 < 0; i++) { step(S, quiet); if (e.st === 'dive') t1 = S.t; }
        if (t1 < 0 || t1 - e.upT > E.stay + 0.02) out.push(`eel: stays up ${(t1 - e.upT).toFixed(2)} s, not up to ${E.stay}`);
        for (let i = 0; i < 120 * E.dive + 2; i++) step(S, quiet); const hp = e.hp; hitEnemy(S, R, e, 10, false, h.x, h.y); if (e.st !== 'deep' || e.hp !== hp) out.push(`eel: a blow after its dive does ${hp - e.hp} (${e.st})`); } }
    // altars: E offers one gift per tier at rising prices; too few shards refuse and take nothing; a gift takes its price, lands
    // on the hero, heals, closes the screen and darkens the altar for good, and survives save/load
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero;
      for (let f = 1; !R.shrines.length && f < D.RUNS.campaign.chapter; ) enterFloor(S, R, ++f);
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
      f.sec = 17; if (completionHints(R).some((o) => o.kind === 'secret')) out.push('hints: secret location highlighted');
      e.summ = 1; if (completionHints(R).some((o) => o.kind === 'foe')) out.push('hints: summoned enemy highlighted');
      f.kills = f.foes; f.loot = f.lootN; if (completionHints(R).length) out.push('hints: completed categories still highlighted'); }
    {
      const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); S.screen = 'play'; const R = S.run, h = R.hero, m = R.map;
      R.en = []; m.decor = [{ n: 'shroom_a', x: h.x + 10, y: h.y, s: 0.6 }, { n: 'skel_cv', x: h.x + 12, y: h.y }];
      S.ev = []; hitProps(S, R, h.x, h.y, 30); const n = S.ev.filter((e) => e.k === 'prop' && (e.n === 'shroom_a' || e.n === 'skel_cv')).length;
      if (n !== 2) out.push('cave reactions: mushroom or skeleton ignores a blow');
      hitProps(S, R, h.x, h.y, 30); if (S.ev.filter((e) => e.k === 'prop' && (e.n === 'shroom_a' || e.n === 'skel_cv')).length !== n) out.push('cave reactions: repeated blow bypasses cooldown');
      S.t += 1; const x = Math.floor((h.x + 6) / TILE), y = Math.floor(h.y / TILE), k = y * m.W + x, saved = m.cells[k];
      m.cells[k] = 0; hitProps(S, R, h.x - TILE, h.y, 80); m.cells[k] = saved;
      if (S.ev.filter((e) => e.k === 'prop' && (e.n === 'shroom_a' || e.n === 'skel_cv')).length !== n) out.push('cave reactions: response through rock');
      S.ev = []; for (let i = 0; i < 120; i++) step(S, { keys: [] });
      if (S.ev.some((e) => e.k === 'prop' && (e.n === 'shroom_a' || e.n === 'skel_cv'))) out.push('cave reactions: stationary hero retriggers decor');
    }
    {
      const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); const R = S.run, m = R.map, h = R.hero, tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
      m.decor = []; R.en = []; R.chests = []; R.pots = [];
      for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 1; x <= tx + 7; x++) m.cells[y * m.W + x] = x >= tx + 1 && x <= tx + 3 ? 6 : 1;
      const fire = () => ({ id: R.nextId++, k: 'fire', own: 'hero', x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE - 20, gz: 20, vx: 300, vy: 0, t0: S.t, life: 2, r: 6, dmg: 100 });
      const p = fire(); R.proj = [p]; for (let i = 0; i < 50; i++) { S.t += DT; stepProjectiles(S, R); }
      if (p.dead || p.x < (tx + 4) * TILE) out.push('hero fireball: dies over deep water');
      const target = { id: R.nextId++, type: 'skeleton', x: (tx + 5.5) * TILE, y: p.y + ENEMIES.skeleton.h * 0.45, hp: 500, max: 500, deadT: -1, elite: 0, room: -1, st: 'idle', hitT: -9, kbx: 0, kby: 0, burn: 0, burnT: 0 };
      R.en = [target]; for (let i = 0; i < 40 && !p.dead; i++) { S.t += DT; stepProjectiles(S, R); }
      if (target.hp >= 500) out.push('hero fireball: no damage after deep water');
      m.cells[ty * m.W + tx + 2] = 0; const q = fire(); R.proj = [q]; for (let i = 0; i < 50 && !q.dead; i++) { S.t += DT; stepProjectiles(S, R); }
      if (!q.dead || q.x >= (tx + 3) * TILE) out.push('hero fireball: passes through rock above water');
    }
    // an altar on every second floor of a chapter and on no other (TASKS 137), the last on the floor before the chapter's boss, one past
    // him if the run goes on (the demon lord's 8th, TASKS 339), none on the run's last floor (TASKS 183): 2, 4, 6, 7, 8, 10, 11
    { const bad = [], want = (f) => { const st = D.stageOf('campaign', f); return !st.fin && (st.lf % 2 === 0 || st.lf === st.n - 1) ? 1 : 0; };
      for (let seed = 1; seed <= 40; seed++) for (let f = 1; f <= D.RUNS.campaign.floors; f++) { const n = DG.genFloor((seed * 31 + f * 1013) >>> 0, f).shrines.length;
        if (n !== want(f)) bad.push(`seed ${seed} floor ${f}: ${n}`); }
      if (bad.length) out.push(`altar: not one altar on floors 2, 4, 6, 7, 8, 10 and 11 and none on the others (${bad.length}: ${bad.slice(0, 3).join(', ')})`); }
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
    {
      const S = spawn(0, {}); S.run = newRun(S, 'cave', 71); S.screen = 'play'; const R = S.run;
      enterFloor(S, R, 4); const m = R.map, h = R.hero, b = R.en.find((e) => e.type === 'boss_serpent'), B = D.BOSSES.boss_serpent, r = m.rooms[b.room]; R.en = [b];
      if (m.serpentPools.length !== 3 || m.serpentPools.some((p) => p.length < 2 || p.some((k) => m.cells[k] !== 6))) out.push('serpent: missing deep lakes');
      if (b.st !== 'idle' || !counted(b) || !under(b) || !arenaSealed(R)) out.push('serpent: initial seal, hidden state or completion count missing');
      h.x = (r.cx + 0.5) * TILE; h.y = (r.cy + 0.5) * TILE; h.ifr = 1e9; stepArena(S, R);
      if (!R.arena?.active || !m.doors.some((d) => d.arena) || m.doors.some((d) => d.arena && d.open)) out.push('serpent: arena not sealed');
      const outside = flow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE));
      if (outside[Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)] >= 0) out.push('serpent: a path bypasses arena gates');
      const hp = b.hp; hitEnemy(S, R, b, 100, false, h.x, h.y); if (b.hp !== hp) out.push('serpent: hurt while submerged');
      const pools = [], states = new Set(), moves = new Set(); let stirT = 0;
      for (let i = 0; i < 120 * 38; i++) { const last = b.st; step(S, { px: 960, py: 540, keys: [] }); states.add(b.st); if (b.mv) moves.add(b.mv);
        if (b.st === 'stir' && last !== b.st) { pools.push(b.pool); stirT = S.t; }
        if (b.st === 'rise' && last !== b.st && Math.abs(S.t - stirT - B.warn) > 0.02) out.push('serpent: emergence warning too short');
        if (m.cells[Math.floor(b.y / TILE) * m.W + Math.floor(b.x / TILE)] !== 6) { out.push('serpent: leaves deep water'); break; }
      }
      for (const st of ['stir', 'rise', 'bwind', 'recover', 'dive', 'deep']) if (!states.has(st)) out.push(`serpent: missing state ${st}`);
      if (pools.length < 3 || pools.some((p, i) => i && p === pools[i - 1])) out.push('serpent: does not change lakes');
      for (const mv of Object.keys(B.moves)) {
        b.st = 'chase'; b.cdT = 1e9; b.openUntil = 0; R.proj = []; h.ifr = 1e9; h.x = b.x + 90; h.y = b.y; beginBossMove(S, R, b, mv);
        S.t += B.moves[mv].wind - DT; serpent(S, R, b, true); if (b.fired || R.proj.length) out.push(`serpent ${mv}: fires before wind-up`);
        S.t += 2 * DT; serpent(S, R, b, true); if (!b.fired) out.push(`serpent ${mv}: does not fire`);
        if (mv === 'wave' || mv === 'fan') { const n = mv === 'wave' ? 1 : B.moves.fan.n;
          if (R.proj.length !== n || R.proj.some((p) => p.own !== 'en' || p.dmg !== b.dmg * B.moves[mv].dmg)) out.push(`serpent ${mv}: wrong projectiles`);
        }
        S.t += B.moves[mv].duration; serpent(S, R, b, true);
        if (b.st !== 'recover' || b.openUntil <= S.t) out.push(`serpent ${mv}: no punish window after miss`);
      }
      const hp1 = b.hp; b.st = 'recover'; b.openUntil = S.t + 1; hitEnemy(S, R, b, 100, false, h.x, h.y); if (Math.abs(hp1 - b.hp - 140) > 0.01) out.push('serpent: no extra damage in punish window');
      b.openUntil = 0; b.st = 'chase'; b.cdT = 1e9; b.hp = b.max * 0.5; serpent(S, R, b, true);
      const water = m.water.length, cells = m.cells.slice(); if (b.phase !== 1 || !(b.floodAt > S.t)) out.push('serpent: phase two has no flood warning');
      S.t += 1.21; serpent(S, R, b, true);
      if (m.water.length <= water || !m.arenaWater.length || m.cells.some((c, k) => c !== cells[k]) || !arenaPath(m, b.room)) out.push('serpent: flood changes collision or cuts off the arena');
      if (R.en.filter((e) => e.summ === b.id && e.type === 'drowned').length !== 2) out.push('serpent: flood must raise two drowned');
      if (m.flood.cells.length > 4 && m.flood.n >= m.flood.cells.length) out.push('serpent: the flood has no front');
      S.t += 0.8; serpent(S, R, b, true); const mid = m.flood.n; S.t += 1; serpent(S, R, b, true);
      if (!(mid > 1 && mid < m.flood.cells.length) || m.flood.n !== m.flood.cells.length || new Set(m.arenaWater).size !== m.flood.cells.length) out.push('serpent: the flood does not spread over 1.6 s to every shore cell');
      b.st = 'bwind'; b.mv = 'tail'; b.fired = 0; b.t0 = S.t; b.dmg = 1e6; h.ifr = 0; h.hp = 1e6; h.x = b.x + 80; h.y = b.y;
      let lost = 0;
      for (let i = 0; i < 12 && !lost; i++) { b.fired = 0; b.t0 = S.t; h.ifr = 0; const hp2 = h.hp;
        S.t += B.moves.tail.wind + DT; serpent(S, R, b, true); lost = hp2 - h.hp;
      }
      if (!lost || lost / heroSt(S).maxHp > BAL.cap.boss + 0.01) out.push('serpent: tail misses or exceeds the boss damage cap');
      const projectile = (mv, side) => {
        b.st = 'chase'; b.openUntil = 0; R.proj = []; b.dmg = 100; b.face = 1; h.ifr = 0; h.hp = 1e6; h.shield = 0;
        h.x = (r.cx + 0.5) * TILE; h.y = (r.cy + 0.5) * TILE; const hx = h.x, hy = h.y;
        beginBossMove(S, R, b, mv);
        if (mv === 'fan') { const [x, y] = serpentMouth(b); b.aimA = Math.atan2(h.y - 38 - y, h.x - x); }
        S.t += B.moves[mv].wind + DT; serpent(S, R, b, true); const bolts = R.proj.slice(), a = b.aimA;
        if (side) { h.x = hx - Math.sin(a) * 80; h.y = hy + Math.cos(a) * 80; }
        const hp0 = h.hp;
        for (let i = 0; i < 360; i++) { S.t += DT; h.ifr = 0; stepProjectiles(S, R); }
        return { hits: bolts.filter((p) => p.onHero).length, lost: hp0 - h.hp };
      };
      if (!projectile('wave', 0).hits || projectile('wave', 1).hits) out.push('serpent: wave misses a still target or catches a sidestep');
      const fan = projectile('fan', 0);
      if (!fan.hits || fan.lost > heroSt(S).maxHp * BAL.cap.boss + 0.01) out.push('serpent: fan misses or wounds more than once');
      b.st = 'recover'; b.hp = 1; killEnemy(S, R, b);
      if (!R.bossDead || R.arena.active || m.doors.some((d) => d.arena && !d.open) || m.arenaWater.length || R.en.some((e) => e.summ === b.id && e.deadT < 0) || !R.drops.some((d) => d.kind === 'shard' && d.n === 20)) out.push('serpent: death leaves arena sealed, flood, summons or no reward');
      for (let i = 0; i < 180; i++) stepDrops(S, R, false);
      if (R.drops.some((d) => m.cells[Math.floor(d.y / TILE) * m.W + Math.floor(d.x / TILE)] !== 1)) out.push('serpent: reward stranded in deep water');
      endRun(S, 'win'); if (S.screen !== 'win' || S.result.mode !== 'cave' || S.result.win !== REWARD.win) out.push('serpent: wrong victory screen or reward');
    }
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
    // the water caves and the magma caves as runs of their own (TASKS 300, 399): the menu starts each on the hero screen with its level and kit, its floors
    // carry their run's boss, guard and altars, the boss's death opens the way out, and the campaign's record is left alone
    for (const RID of ['cave', 'magma']) { const N = D.RUNS[RID], S = spawn(0, {});
      for (const [scr, id] of D.startPath(RID)) { const r = (scr === 'menu' ? UI.menu(false) : UI.tests(false)).find((q) => q.id === id); step(S, { keys: [], click: 1, px: r.x + 10, py: r.y + 10 }); }
      const R = S.run, h = R && R.hero;
      if (!R || R.mode !== RID || S.screen !== 'inv') out.push(RID + ': the menu button does not start the run on the hero screen');
      else {
        if (h.lvl !== N.lvl || h.pts !== 3 * (N.lvl - 1) || h.sp !== N.lvl - 1) out.push(`${RID}: the hero starts at level ${h.lvl} with ${h.pts} points and ${h.sp} skill points`);
        if (N.kit.gear.some(([b]) => !h.eq[BASES[b].slot] || h.eq[BASES[b].slot].b !== b)) out.push(RID + ': the kit is not worn');
        if (ABILITIES.some((a) => a.unlock <= h.lvl && !h.ab[a.id])) out.push(RID + ': an ability of the hero\'s level is still locked');
        for (let f = 1; f <= N.floors; f++) { if (f > 1) enterFloor(S, R, f); const m = R.map, guards = m.enemies.filter((e) => e.guard).length;
          if ((m.bossType || undefined) !== N.boss(f)) out.push(`${RID} f${f}: boss ${m.bossType} where the run has ${N.boss(f)}`);
          if (!!N.guard[f] !== guards > 0 && !N.boss(f)) out.push(`${RID} f${f}: ${guards} exit guard(s)`);
          if (m.shrines.length !== ((f % 2 === 0 || f === N.floors - 1) && !N.boss(f) ? 1 : 0)) out.push(`${RID} f${f}: ${m.shrines.length} altar(s)`);
          if (f === 1 && R.en.some((e) => !D.BOSSES[e.type] && e.max < Math.round(D.ENEMIES[e.type].hp * BAL.hp * (1 + 0.5 * N.depth)))) out.push(RID + ' f1: a monster weaker than the run\'s depth'); }
        const b = R.en.find((e) => D.BOSSES[e.type]); S.screen = 'play'; h.ifr = 1e9; h.x = R.map.exit.x; h.y = R.map.exit.y; interact(S, R);
        if (!S.run) out.push(RID + ': the way out opens before the boss dies');
        else { const best = S.meta.best; killEnemy(S, R, b); if (!R.bossDead) out.push(RID + ': the boss\'s death does not open the way out');
          h.x = R.map.exit.x; h.y = R.map.exit.y; interact(S, R);
          if (S.screen !== 'win' || (S.result || {}).mode !== RID) out.push(RID + ': leaving after the boss is not a win of the run');
          if (S.meta.best !== best) out.push(RID + ': the run moved the campaign\'s floor record'); } }
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
      // the magma caves' lava on foot (TASKS 401): the hero neither walks nor is knocked into it, a monster knocked into it burns away
      // and one knocked into the chasm falls, their loot lands on the bank; the crust bears the hero a while, cracks, melts under him
      // (it burns) and sets again; the monsters' way round never goes over lava or crust
      { const Z = spawn(0, {}); plainRun(Z); Z.screen = 'play'; const R2 = Z.run, m = R2.map, h = R2.hero, W = m.W, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const crustS = new Set(m.crust), lavaOn = (o) => cell(m, Math.floor(o.x / TILE), Math.floor(o.y / TILE)) === 3;
        // (five cells of lava ahead: a narrower channel between two floors is flown over by the knock)
        const bank = (pred, n = 3) => { for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 1) for (const [dx, dy] of DIRS) if (Array.from({ length: n }, (_, i) => i + 1).every((i) => pred(k + i * (dx + dy * W)))) return [k, dx, dy]; return null; };
        const mob = (x, y) => ({ id: R2.nextId++, type: 'skeleton', x, y, vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'idle', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 });
        const L0 = bank((k) => m.cells[k] === 3 && !crustS.has(k), 5), C0 = bank((k) => !!m.cliff && m.cells[k] === 0 && Math.floor(k / W) >= m.cliff[k % W]);
        if (!L0 || !C0) out.push('magma lava: no bank of lava or of the chasm on the first plain floor'); else {
          for (const [what, [k, dx, dy]] of [['lava', L0], ['chasm', C0]]) { const x0 = (k % W + 0.5) * TILE, y0 = (Math.floor(k / W) + 0.5) * TILE;
            R2.en = []; R2.msg = null; R2.drops = []; h.ifr = 1e9; h.x = x0; h.y = y0; h.kbx = h.kby = 0; let off = false;
            const go = { right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0 };
            for (let i = 0; i < 120; i++) { step(Z, Object.assign({}, go, { keys: i % 40 === 0 ? ['Space'] : [] })); if (cell(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)) !== 1) off = true; }
            if (off) out.push(`magma lava: the hero walks or dashes into the ${what}`);
            h.x = x0; h.y = y0; hurtHero(Z, R2, 1, x0 - dx * 30, y0 - dy * 30); for (let i = 0; i < 60; i++) step(Z, { keys: [] });
            if (cell(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)) !== 1) out.push(`magma lava: a blow knocks the hero into the ${what}`);
            const e = mob(x0, y0); h.x = x0 - dx * 6 * TILE - dy * 6 * TILE; h.y = y0 - dy * 6 * TILE + dx * 6 * TILE; R2.en = [e]; const k0 = R2.kills;
            e.kbx = dx * 900; e.kby = dy * 900; for (let i = 0; i < 120 * 2.2; i++) step(Z, { keys: [] });
            if (e.deadT < 0 || R2.kills !== k0 + 1) out.push(`magma lava: a monster knocked into the ${what} is not gone in ${what === 'lava' ? DOOM.sink : DOOM.fall} s`);
            if (R2.drops.some((p) => cell(m, Math.floor(p.x / TILE), Math.floor(p.y / TILE)) !== 1)) out.push(`magma lava: a monster gone into the ${what} drops its loot off the floor`); } }
        const ck = m.crust.find((k) => [1, -1, W, -W].some((o) => m.cells[k + o] === 1 && m.cells[k + 2 * o] === 1));
        if (ck === undefined) out.push('magma lava: no crust by a wide bank on the first plain floor'); else {
          const x0 = (ck % W + 0.5) * TILE, y0 = (Math.floor(ck / W) + 0.5) * TILE, t0 = Z.t, hp0 = h.hp; R2.en = []; h.ifr = 0; h.x = x0; h.y = y0; m.melt = {}; let crackT = -1, meltT = -1, setT = -1, hpMin = hp0;
          for (let i = 0; i < 120 * 6; i++) { const q = m.melt[ck]; if (i < 120 * 1.7) { h.x = x0; h.y = y0; } else if (i === Math.round(120 * 1.7)) { const o = [1, -1, W, -W].find((d) => m.cells[ck + d] === 1); h.x = x0 + (o === 1 ? 2 : o === -1 ? -2 : 0) * TILE; h.y = y0 + (o === W ? 2 : o === -W ? -2 : 0) * TILE; }
            step(Z, { keys: [] }); h.ifr = 0; hpMin = Math.min(hpMin, h.hp);
            if (q && q.crackT !== undefined && crackT < 0) crackT = Z.t - t0; if (q && q.hot && meltT < 0) meltT = Z.t - t0; if (meltT > 0 && setT < 0 && !(m.melt[ck] && m.melt[ck].hot)) setT = Z.t - t0; }
          if (Math.abs(crackT - CRUST.stand) > 0.05 || Math.abs(meltT - CRUST.stand - CRUST.crack) > 0.05 || Math.abs(setT - meltT - CRUST.hot) > 0.05) out.push(`magma lava: the crust cracks at ${crackT.toFixed(2)} s, melts at ${meltT.toFixed(2)}, sets ${(setT - meltT).toFixed(2)} s later`);
          // (the lowest he comes to: a hero at full health with regeneration is back to it before the crust sets)
          if (hpMin >= hp0) out.push('magma lava: the crust melting under the hero does not burn him');
          if (!crustAt(m, ck)) out.push('magma lava: the crust does not bear the hero again once it sets'); }
        const F = flow(m, Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE), 1); if (F.some((v, j) => v >= 0 && m.cells[j] === 3)) out.push('magma lava: the monsters\' way runs over lava or crust'); }
      // the magma colossus (TASKS 413): it lies hidden in its lake, rises and wades ashore once the hero is in; the ring round the
      // lake is one way round for its body, before the 2nd phase's edge falls into lava and after; its pools keep their limits; the
      // fists leave it stuck and open; no rock of the rain falls in a slab's shelter; its death takes everything it left on the floor
      for (const sd of [3, 11, 23, 41]) { const Z = spawn(0, {}); Z.run = newRun(Z, 'magma', sd); Z.screen = 'play'; enterFloor(Z, Z.run, 4); const R2 = Z.run, m = R2.map, h = R2.hero, W = m.W, tag = `colossus seed ${sd}`;
        const b = R2.en.find((e) => e.type === 'boss_colossus'), E = ENEMIES.boss_colossus, B = D.BOSSES.boss_colossus, r = m.rooms[b ? b.room : 0];
        if (!b) { out.push(`${tag}: no colossus on the 4th`); continue; }
        if (cell(m, Math.floor(b.x / TILE), Math.floor(b.y / TILE)) !== 3 || !under(b)) out.push(`${tag}: it does not lie hidden in its lake`);
        const lake = (k) => Math.hypot(((k % W) + 0.5 - (r.cx + 0.5)) / D.ARCH.plateau.arena.lake[0], (Math.floor(k / W) + 0.5 - (r.cy + 0.5)) / D.ARCH.plateau.arena.lake[1]) < 1.15;
        // its clear cells hold one ring round the lake: the biggest piece reaches past the lake on all four sides
        const ring = () => { const a = wideClear(R2, b, E).a, seen = new Set(); let best = [];
          for (let k = 0; k < a.length; k++) if (a[k] && !seen.has(k)) { const q = [k]; seen.add(k); for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (a[n] && !seen.has(n)) { seen.add(n); q.push(n); } } if (q.length > best.length) best = q; }
          const xs = best.map((k) => k % W), ys = best.map((k) => Math.floor(k / W)), L = D.ARCH.plateau.arena.lake, cx = r.cx + 0.5, cy = r.cy + 0.5;
          const side = (f) => best.some((k) => f(k % W + 0.5 - cx, Math.floor(k / W) + 0.5 - cy));
          return side((x, y) => y < -L[1] && Math.abs(x) < 2) && side((x, y) => y > L[1] && Math.abs(x) < 2) && side((x, y) => x < -L[0] && Math.abs(y) < 2) && side((x, y) => x > L[0] && Math.abs(y) < 2) && xs.length > 0 && ys.length > 0; };
        if (!ring()) out.push(`${tag}: its body has no way round the lake`);
        h.ifr = 1e9; h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 2.5) * TILE; R2.en = [b]; let t0 = -1, shore = -1;
        for (let i = 0; i < 120 * 12 && shore < 0; i++) { step(Z, { keys: [] }); if (t0 < 0 && b.st === 'emerge') t0 = Z.t; if (b.st !== 'idle' && b.st !== 'emerge' && b.st !== 'wade') shore = Z.t; }
        if (t0 < 0) out.push(`${tag}: it never rises when the hero walks into the arena`); else if (shore < 0 || shore - t0 > B.rise + 6) out.push(`${tag}: it does not come ashore (${shore < 0 ? 'never' : (shore - t0).toFixed(1) + ' s'})`);
        else if (!wideClear(R2, b, E).a[Math.floor(b.y / TILE) * W + Math.floor(b.x / TILE)] || onLava(m, b)) out.push(`${tag}: it comes ashore where it does not fit`);
        // the edge's fall keeps the ring whole, the ways in, the altar and the cover, and leaves the hero his way to the exit
        b.phase = 1; beginBossMove(Z, R2, b, 'shatter'); b.cdT = 1e9; for (let i = 0; i < 120 * 4; i++) { step(Z, { keys: [] }); h.ifr = 1e9; h.hp = 1e6; }
        if (!(m.arenaLava || []).length) out.push(`${tag}: the 2nd phase's edge does not fall into lava`);
        if (!ring()) out.push(`${tag}: after the edge falls its body has no way round the lake`);
        if (!arenaPath(m, b.room)) out.push(`${tag}: the edge's fall cuts the floor off from the exit`);
        if ((m.arenaLava || []).some((k) => m.decor.some((d) => d.cover && Math.abs(Math.floor(d.x / TILE) - k % W) <= 1 && Math.abs(Math.floor(d.y / TILE) - Math.floor(k / W)) <= 1))) out.push(`${tag}: the edge falls under a slab of cover`);
        if ((m.arenaLava || []).some(lake)) out.push(`${tag}: the edge's fall reaches the lake's shore`);
        // pools: none by the lake's shore, the ways in or the crossing, never more than the cap at once
        const M = B.moves.boulder; let near = 0;
        for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 1 && DG.roomAt(m, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE) === b.room && poolOk(R2, b, M, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE)) {
          if ([1, -1, W, -W].some((o) => m.cells[k + o] === 3 && !(m.arenaLava || []).includes(k + o) && lake(k + o))) near++; }
        if (near) out.push(`${tag}: a pool may lie on the lake's shore (${near} cells)`);
        R2.fires = []; b.st = 'chase'; for (let i = 0; i < 8; i++) { h.x = b.x + 120 + (i % 3) * 40; h.y = b.y + 60; colossusBoulder(Z, R2, b, M); for (let j = 0; j < 120; j++) { step(Z, { keys: [] }); h.ifr = 1e9; } b.cdT = 1e9; b.st = 'chase'; }
        if (R2.fires.filter((p) => p.src === b.id && p.kind === 'pool').length > M.cap) out.push(`${tag}: more pools than ${M.cap} at once`);
        // stuck after its fists and open to blows
        R2.fires = []; R2.rocks = []; h.x = b.x + 100; h.y = b.y; beginBossMove(Z, R2, b, 'fists'); for (let i = 0; i < 120 * (B.moves.fists.wind + B.moves.fists.duration + 0.05); i++) { step(Z, { keys: [] }); h.ifr = 1e9; }
        if (!(b.openUntil > Z.t)) out.push(`${tag}: its fists leave it no stuck window`); else { const x0 = b.x, y0 = b.y, hp0 = b.hp; h.x = b.x + 400; for (let i = 0; i < 60; i++) step(Z, { keys: [] });
          if (Math.hypot(b.x - x0, b.y - y0) > 1) out.push(`${tag}: it walks while stuck`); hitEnemy(Z, R2, b, 100, false, b.x + 50, b.y); if (Math.abs(hp0 - b.hp - 100 * B.moves.fists.open) > 0.6) out.push(`${tag}: no extra damage while it is stuck`);
          b.phase = 0; b.hp = b.max * 0.59; stepBossMove(Z, R2);
          if (b.phase !== 0) out.push(`${tag}: phase interrupts stuck window`); }
        // the rain: no rock in a slab's shelter
        b.phase = 2; R2.rocks = []; colossusRain(Z, R2, b, B.moves.rain); h.x = -999; h.y = -999;
        const cov = m.decor.filter((d) => d.cover); if (!cov.length) out.push(`${tag}: the arena has no slabs of cover`);
        if (R2.rocks.some((q) => q.x !== undefined && cov.some((d) => Math.hypot(q.x - d.x, q.y - d.y) < B.moves.rain.shelter - 15))) out.push(`${tag}: a rock of the rain falls in a slab's shelter`);
        // its death clears the floor
        colossusBoulder(Z, R2, b, M); R2.cracks.push({ id: 1, owner: b.id, x: b.x, y: b.y, a: 0, len: 100, w: 30, speed: 900, linger: 1, t0: Z.t, dmg: 0, hit: 1 }); b.hp = 1; killEnemy(Z, R2, b);
        if (!b.deathPose || b.deathPose.deadT >= 0 || b.deathPose.t0 !== b.t0 || b.deathPose.dist !== b.dist) out.push(`${tag}: death loses its live pose`);
        if ((R2.rocks || []).length || (R2.cracks || []).length || (m.arenaLava || []).length || R2.fires.some((p) => p.src === b.id)) out.push(`${tag}: its death leaves rocks, cracks, pools or lava on the floor`); }
      // the caves as the campaign's 9th–12th (TASKS 339): the demon lord on the 8th pays as a finale but opens the stairs, the 9th is
      // the caves' 1st at the campaign's depth with the same hero (level, kit, gold, bag), the 11th keeps the caves' exit guard and the
      // 10th and 11th their altars, the serpent holds the 12th and only his death wins the campaign; a run saved in the caves goes on there
      { const S2 = spawn(0, {}); S2.run = newRun(S2, 'campaign', 7); S2.screen = 'play'; const R2 = S2.run, h2 = R2.hero, NC = D.RUNS.cave;
        enterFloor(S2, R2, 8); h2.ifr = 1e9; h2.lvl = 11; h2.gold = 777; R2.drops = [];
        const lord = R2.en.find((e) => e.type === 'boss'); let want = '';
        if (!lord) out.push('campaign f8: no demon lord'); else {
          killEnemy(S2, R2, lord);
          if (R2.bossDead) out.push('campaign f8: the demon lord\'s death opens the way out of the campaign');
          if (R2.drops.filter((d) => d.kind === 'shard').reduce((n, d) => n + d.n, 0) !== 20) out.push('campaign f8: the demon lord does not pay the finale\'s 20 shards');
          if (R2.drops.filter((d) => d.kind === 'item').length < LOOT.boss.length) out.push('campaign f8: the demon lord does not drop the finale\'s loot');
          if (!R2.map.shrines.length) out.push('campaign f8: no altar past the demon lord');
          R2.drops = []; want = JSON.stringify([h2.lvl, h2.xp, h2.gold, h2.eq, h2.bag, h2.perks, h2.ab]); h2.x = R2.map.exit.x; h2.y = R2.map.exit.y; interact(S2, R2);
          if (!S2.run || R2.floor !== 9) out.push(`campaign: the stairs past the demon lord lead to ${S2.run ? 'floor ' + R2.floor : 'the end of the run'}, not the 9th`);
          else {
            const m = R2.map;
            if (m.biome !== 'cave' || m.W !== NC.size[0][0] || m.H !== NC.size[0][1] || !m.crossings) out.push('campaign f9: not the caves\' first floor');
            if (JSON.stringify([h2.lvl, h2.xp, h2.gold, h2.eq, h2.bag, h2.perks, h2.ab]) !== want) out.push('campaign f9: the hero changed on the way down');
            if (dep(R2) !== 9) out.push(`campaign f9: depth ${dep(R2)}, not 9`);
            if (R2.en.some((e) => !D.BOSSES[e.type] && e.max < Math.round(D.ENEMIES[e.type].hp * BAL.hp * (1 + 0.5 * 8)))) out.push('campaign f9: a monster weaker than the 9th floor');
            if (!R2.msg || !R2.msg.s.includes('Этаж 9') || !R2.msg.s.includes(NC.title)) out.push(`campaign f9: the floor's title is "${R2.msg && R2.msg.s}"`);
            for (let f = 10; f <= 12; f++) { enterFloor(S2, R2, f); const mf = R2.map, lf = f - 8;
              if ((mf.bossType || undefined) !== NC.boss(lf)) out.push(`campaign f${f}: boss ${mf.bossType}, the caves' ${lf}th has ${NC.boss(lf)}`);
              if (!NC.boss(lf) && !!NC.guard[lf] !== mf.enemies.some((e) => e.guard)) out.push(`campaign f${f}: exit guard does not match the caves' ${lf}th`);
              if (mf.shrines.length !== (f === 10 || f === 11 ? 1 : 0)) out.push(`campaign f${f}: ${mf.shrines.length} altar(s)`);
              if (f === 11) { // a run saved here, through the browser's storage, goes on in the caves
                S2.saved = S2.run; S2.run = null; S2.screen = 'menu'; const S3 = spawn(1, JSON.parse(JSON.stringify(persist(S2)))), cb = UI.menu(true).find((q) => q.id === 'continue');
                step(S3, { keys: [], click: 1, px: cb.x + 10, py: cb.y + 10 });
                if (!S3.run || S3.run.floor !== 11 || S3.run.mode !== 'campaign' || S3.run.map.biome !== 'cave' || S3.screen !== 'play') out.push('campaign f11: a run saved in the caves does not go on there');
                else { for (let i = 0; i < 30; i++) step(S3, { keys: [] }); if (!S3.run || dep(S3.run) !== 11) out.push('campaign f11: the continued run breaks'); }
                S2.run = R2; S2.saved = null; S2.screen = 'play'; } }
            const sp = R2.en.find((e) => e.type === 'boss_serpent'), best = S2.meta.best; h2.ifr = 1e9; h2.x = R2.map.exit.x; h2.y = R2.map.exit.y; interact(S2, R2);
            if (!S2.run) out.push('campaign f12: the way out opens before the serpent dies');
            else if (!sp) out.push('campaign f12: no serpent');
            else { killEnemy(S2, R2, sp); if (!R2.bossDead) out.push('campaign f12: the serpent\'s death does not open the way out');
              if (R2.drops.filter((d) => d.kind === 'shard').reduce((n, d) => n + d.n, 0) !== 20) out.push('campaign f12: the serpent does not pay the finale\'s 20 shards');
              if (R2.drops.filter((d) => d.kind === 'item').length < LOOT.boss.length) out.push('campaign f12: the serpent does not drop the finale\'s loot');
              h2.x = R2.map.exit.x; h2.y = R2.map.exit.y; interact(S2, R2);
              if (S2.screen !== 'win' || (S2.result || {}).mode !== 'campaign' || S2.result.floor !== 12) out.push('campaign: leaving after the serpent is not a campaign win');
              if (S2.meta.best !== Math.max(best || 0, 12)) out.push('campaign: the win does not set the floor record to 12'); } } } }
      // the campaign's caves bring their kinds a floor sooner and more monsters to their first two floors (data.js RUNS chapters);
      // the caves' own run keeps its floors as they were
      { const kinds = (mode, f) => { const c = {}; let n = 0; for (let sd = 1; sd <= 12; sd++) for (const e of DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode }).enemies) { c[e.type] = 1; n++; } return [c, n / 12]; };
        const [c9, n9] = kinds('campaign', 9), [c1, n1] = kinds('cave', 1), [c10] = kinds('campaign', 10);
        if (!c9.crab || !c9.skel_archer || c9.skel_mage || !c10.skel_mage) out.push('campaign caves: the 9th does not bring crabs and archers, or the 10th its mages');
        if (c1.crab || c1.skel_archer) out.push('cave run: crabs or archers on its 1st floor');
        if (n9 < n1 * 1.3) out.push(`campaign f9: ${n9.toFixed(1)} monsters, the caves' 1st ${n1.toFixed(1)}: not denser`); }
      // a saved run is dropped only by a second press of the same button
      const T = spawn(0, {}); T.saved = newRun(T, 'campaign', 5); const c = UI.menu(true).find((q) => q.id === 'campaign'), ts = UI.menu(true).find((q) => q.id === 'tests'), v = UI.tests(true).find((q) => q.id === 'cave');
      const press = (S, b) => step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 });
      press(T, c); step(T, { keys: [] }); press(T, ts); press(T, v);
      if (T.run) out.push('cave: a press on another run\'s button drops the saved run');
      // the test runs' screen (TASKS 417): the main menu has no test run of its own, «Тесты» opens their screen, «Назад» and Escape go
      // back, and over a saved run a test run's button asks again before it drops the save
      const ids = UI.menu(true).map((b) => b.id); if (D.TEST_RUNS.some(([id]) => ids.includes(id)) || !ids.includes('tests')) out.push('tests: the main menu still holds the test runs or lacks «Тесты»');
      if (D.TEST_RUNS.some(([id]) => (!D.RUNS[id] && id !== 'town') || !UI.tests(false).some((b) => b.id === id))) out.push('tests: a test run missing from its screen');
      const U = spawn(0, {}); U.saved = newRun(U, 'campaign', 5); press(U, ts); if (U.screen !== 'tests') out.push('tests: «Тесты» does not open the test runs');
      press(U, UI.tests(true).find((b) => b.id === 'back')); if (U.screen !== 'menu') out.push('tests: «Назад» does not go back to the menu');
      press(U, ts); step(U, { keys: ['Escape'] }); if (U.screen !== 'menu') out.push('tests: Escape does not go back to the menu');
      press(U, ts); const mg = UI.tests(true).find((b) => b.id === 'magma'); press(U, mg); step(U, { keys: [] });
      if (U.run || U.saved.mode !== 'campaign' || UI.tests(true, U.resetM).find((b) => b.id === 'magma').label !== 'Точно сбросить забег?') out.push('tests: one press over a saved run drops it or does not ask');
      press(U, mg); if (!U.run || U.run.mode !== 'magma' || U.saved) out.push('tests: the second press does not start the test run'); }
    out.push(...townCheck(), ...folkCheck(), ...climbCheck());
    return out;
  }
  // the town (R-17, TASKS 1002): floor 0 of a run started from «Тесты», a safe zone where the hero walks, swings, opens the bag,
  // pauses and saves as on a floor, and whose stairs lead down to the 1st
  // TASKS 1015: the townsfolk over two minutes of a town with the hero out of the way: the walkers make their whole rounds on open
  // floor and never pass through each other, the porter lifts and sets down his crate, the anvil rings; walked up to, a townsperson
  // speaks a pair of lines, turns to the hero and a walker stops; every role's lines are pairs
  function folkCheck() {
    const out = [];
    for (const [role, F] of Object.entries(D.FOLK)) if (F.lines && !F.lines.every((p) => p.length === 2 && p.every((q) => typeof q === 'string' && q.length > 3 && q.length <= 34))) out.push(`folk: the ${role}'s lines are not pairs of short lines`);
    for (const sd of [3, 11, 29]) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd, { town: 1 }); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero;
      h.x = m.town.svc.bin.x + TILE; h.y = m.town.svc.bin.y;
      const F = folkOf(R), stops = F.map(() => new Set()), loads = new Set(); let close = 9, off = 0, rings = 0;
      for (let i = 0; i < 120 * 120; i++) { const t0 = S.t; step(S, { keys: [] }); rings += S.ev.filter((e) => e.k === 'anvil' && e.t > t0).length;
        for (const f of F) { if (!f.go && f.way >= 0) stops[f.i].add(f.way); if (f.role === 'porter') loads.add(f.load); if (m.town.npcs[f.i].route && !folkFree(m, f.x, f.y, folkR(f))) off++;
          for (const o of F) if (o.i > f.i) close = Math.min(close, Math.hypot(o.x - f.x, (o.y - f.y) * 1.4) / (folkR(o) + folkR(f))); } }
      for (const f of F) { const n = m.town.npcs[f.i]; if (n.route && stops[f.i].size < n.route.length) out.push(`folk ${sd}: the ${f.role} reaches ${stops[f.i].size} of ${n.route.length} stops in two minutes`); }
      if (close < 0.8) out.push(`folk ${sd}: two townsfolk pass through each other (${close.toFixed(2)} of their radii)`);
      if (off) out.push(`folk ${sd}: a walker steps off the open floor ${off} times`);
      if (loads.size < 2) out.push(`folk ${sd}: the porter never lifts or sets down his crate`);
      if (rings < 40) out.push(`folk ${sd}: the anvil rings ${rings} times in two minutes`);
      const smith = F.find((f) => f.role === 'smith'); h.x = smith.x - 50; h.y = smith.y + 10; const t0 = S.t; step(S, { keys: [] });
      if (smith.sayT !== t0 + DT && smith.sayT !== S.t || !S.ev.some((e) => e.k === 'say' && e.role === 'smith')) out.push(`folk ${sd}: the smith says nothing to the hero beside him`);
      if (smith.face !== -1) out.push(`folk ${sd}: the smith does not turn to the hero`);
      const P = F.find((f) => f.role === 'porter'); for (let i = 0; i < 2400 && !(P.go && P.spd > 20); i++) step(S, { keys: [] });
      h.x = P.x + 40; h.y = P.y; for (let i = 0; i < 120; i++) step(S, { keys: [] }); const px = P.x; for (let i = 0; i < 120; i++) step(S, { keys: [] });
      if (!P.near || Math.abs(P.x - px) > 0.5 || P.face !== 1) out.push(`folk ${sd}: the porter walks on past the hero who speaks to him`); }
    return out;
  }
  // TASKS 1007, 1008, 1027: in a run through the town every floor has its stairs up in the start room, reachable from the spawn
  // (and a run that is not through the town has none); a floor left and come back to is as it was left (a kill, an open chest, loot
  // on the floor, the explored cells), the floor above is reached at the foot of its stairs down and the town from the 1st at its
  // gate; a scroll read through takes the hero home and the town's portal back to the very spot, then closes; a step breaks the
  // reading off and keeps the scroll; it is not read in the town; the save stays small and a saved run comes back on a kept floor
  function climbCheck() {
    const out = [], E = (S) => step(S, { keys: ['KeyE'] });
    for (const sd of [5, 17]) for (let f = 1; f <= 12; f++) { const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd, town: 1 });
      if (!m.up) { out.push(`climb ${sd}/${f}: no stairs up`); continue; } const k = m.up.ty * m.W + m.up.tx, s0 = Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE);
      if (m.cells[k] !== 1 || m.walk[k] < 0 || Math.abs(m.walk[k] - m.walk[s0]) > 12) out.push(`climb ${sd}/${f}: the stairs up are off the floor or far from the spawn`);
      if (m.chests.some((c) => Math.hypot(c.x - m.up.x, c.y - m.up.y - 30) < 60)) out.push(`climb ${sd}/${f}: a chest by the stairs up takes the hero's E`);
      if (f === 3 && DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd }).up) out.push('climb: stairs up in a run not through the town'); }
    const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, at = (p, dy = 0) => { h.x = p.x; h.y = p.y + dy; };
    at(R.map.exit); E(S); if (R.floor !== 1) { out.push('climb: the crypt stairs do not lead down'); return out; }
    for (const e of R.en) { e.st = 'idle'; e.x += 5000; e.hx = e.x; }
    const e0 = R.en[0]; e0.hp = 0; e0.deadT = S.t; const c0 = R.chests[0]; c0.open = 1; R.seen[7] = 1; R.drops.push({ kind: 'gold', x: h.x, y: h.y, n: 77, id: R.nextId++ });
    at(R.map.exit); E(S); if (R.floor !== 2) { out.push('climb: no way down from the 1st'); return out; }
    at(R.map.up, 30); E(S); if (R.floor !== 1) { out.push('climb: the stairs up do not lead to the floor above'); return out; }
    if (Math.hypot(h.x - R.map.exit.x, h.y - R.map.exit.y) > 80) out.push('climb: back up, the hero is not at the foot of the stairs down');
    const e1 = R.en.find((q) => q.id === e0.id), c1 = R.chests.find((q) => q.x === c0.x && q.y === c0.y);
    if (!e1 || e1.deadT < 0 || !c1 || !c1.open || R.seen[7] !== 1 || !R.drops.some((q) => q.kind === 'gold' && q.n === 77)) out.push('climb: the floor above is not as it was left');
    const T = spawn(1, JSON.parse(JSON.stringify(persist(S)))); T.run = T.saved; T.saved = null; T.screen = 'play'; at.call(null, T.run.map.exit);
    { const Q = T.run; Q.hero.x = Q.map.exit.x; Q.hero.y = Q.map.exit.y; E(T); Q.hero.x = Q.map.up.x; Q.hero.y = Q.map.up.y + 30; E(T); if (Q.floor !== 1 || !Q.en.find((q) => q.id === e0.id && q.deadT >= 0)) out.push('climb: a kept floor is lost in a saved run'); }
    h.bag[6] = { b: 'scroll', n: 2, id: R.nextId++ }; const px = h.x, py = h.y; step(S, { keys: [], click: 1, px: -999, py: -999 });
    h.read = { t0: S.t, i: 6 }; for (let i = 0; i < 30; i++) step(S, { right: 1, keys: [] }); if (h.read || h.bag[6].n !== 2) out.push('climb: walking does not break off the reading or the scroll is spent');
    h.read = { t0: S.t, i: 6 }; for (let i = 0; i < 240 && R.floor; i++) step(S, { keys: [] });
    if (R.floor !== 0 || !R.portal || R.portal.f !== 1 || h.bag[6].n !== 1) { out.push('climb: a scroll read through does not take the hero home'); return out; } void px; void py;
    if (R.shop.at !== R.deepest || R.deepest < 2) out.push(`climb: the town's shelf is not stocked for the deepest floor (${R.shop.at} of ${R.deepest})`);
    const shelf0 = R.shop.goods.map((g) => g.it.id).join(), qx = R.portal.x, qy = R.portal.y; useItemCheck(S, R, 6, out);
    at(R.map.town.svc.portal, 30); E(S); if (R.floor !== 1 || R.portal || Math.hypot(h.x - qx, h.y - qy) > 2) out.push(`climb: the town's portal does not lead back to the spot (and close): floor ${R.floor}, ${Math.round(h.x - qx)},${Math.round(h.y - qy)}`);
    at(R.map.up, 30); E(S); if (R.floor !== 0 || !R.town || Math.hypot(h.x - R.map.exit.x, h.y - R.map.exit.y) > 80) out.push('climb: the 1st floor\'s stairs up do not lead to the town\'s gate');
    if (R.shop.goods.map((g) => g.it.id).join() !== shelf0) out.push('climb: the town shelf is re-rolled on a return with no deeper floor reached');
    const size = JSON.stringify(persist(S)).length; if (size > 120000) out.push(`climb: a run with two kept floors saves ${size} bytes`);
    return out;
  }
  function useItemCheck(S, R, i, out) { useItem(S, R, i); if (R.hero.read || !S.ev.some((e) => e.k === 'nope' && e.s === 'В городе свиток не нужен')) out.push('climb: a scroll is read in the town'); }
  function townCheck() {
    const out = [], press = (S, b) => step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 });
    for (let sd = 1; sd <= 8; sd++) { const m = DG.genTown(sd * 977), go = (k) => m.cells[k] === 1, at = (o) => Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE);
      const seen = new Uint8Array(m.W * m.H), q = [at(m.spawn)]; seen[q[0]] = 1;
      for (let i = 0; i < q.length; i++) for (const d of [1, -1, m.W, -m.W]) { const n = q[i] + d; if (!seen[n] && go(n)) { seen[n] = 1; q.push(n); } }
      if (!go(at(m.spawn))) out.push(`town ${sd}: the hero spawns off the floor`);
      if (!seen[at(m.exit)]) out.push(`town ${sd}: the stairs down are out of reach`);
      if (m.enemies.length || m.traps.length || m.floor !== 0 || !m.town) out.push(`town ${sd}: not a safe floor 0`);
      // TASKS 1003: every service on the plan, a body two cells wide walks from the spawn to where each is used, the rails keep
      // off the square and the paths to the services (they run only along the bottom wall), every townsperson stands on open floor
      const ok = DG.townWalk(m), wc = ok.map((v) => (v ? 1 : 0)), use = Object.entries(m.town.use);
      for (const k of ['stairs', 'shop', 'altar', 'stash', 'anvil', 'lectern', 'board', 'portal', 'fire']) if (!m.town.use[k]) out.push(`town ${sd}: no ${k} on the plan`);
      const far = DG.narrowTo(wc, m.W, m.H, at(m.spawn), use.map(([, [x, y]]) => y * m.W + x));
      for (const k of far) out.push(`town ${sd}: ${use.find(([, [x, y]]) => y * m.W + x === k)[0]} out of a two-cell-wide walk from the spawn`);
      if (m.town.rails.some((k) => m.cells[k] !== 1 || (Math.floor(k / m.W) < 26 && k % m.W < 42))) out.push(`town ${sd}: the rails leave the bottom wall or run into rock`);
      for (const n of m.town.npcs) if (!ok[at(n)]) out.push(`town ${sd}: the ${n.role} stands off the open floor`);
      if (sd > 1 && JSON.stringify(m.decor) === JSON.stringify(DG.genTown(977).decor)) out.push('town: the seed does not vary the decor'); }
    const S = spawn(0, {}); press(S, UI.menu(false).find((b) => b.id === 'tests')); press(S, UI.tests(false).find((b) => b.id === 'town'));
    const R = S.run; if (!R || R.floor !== 0 || !R.town || R.mode !== 'campaign' || S.screen !== 'play') { out.push('town: «Город» does not start the campaign in the town'); return out; }
    const h = R.hero, hp = h.hp, x0 = h.x;
    if (R.en.length || R.msg.s !== 'Город') out.push('town: monsters in the town or no title');
    if (R.seen.some((v) => !v)) out.push('town: fog of war over the town');
    hurtHero(S, R, 50, h.x, h.y); if (h.hp !== hp) out.push('town: the hero takes damage in the town');
    for (let i = 0; i < 60; i++) step(S, { right: 1, keys: [] }); if (h.x < x0 + 40) out.push('town: the hero does not walk');
    step(S, { press: 1, keys: [] }); for (let i = 0; i < 40; i++) step(S, { keys: [] }); if (h.atkN !== 1) out.push('town: the hero does not swing');
    step(S, { keys: ['KeyI'] }); if (S.screen !== 'inv') out.push('town: the bag does not open'); step(S, { keys: ['Escape'] });
    step(S, { keys: ['Escape'] }); if (S.screen !== 'pause') out.push('town: no pause');
    press(S, UI.pause().find((b) => b.id === 'save')); const T = spawn(1, JSON.parse(JSON.stringify(persist(S))));
    press(T, UI.menu(true).find((b) => b.id === 'continue'));
    const R2 = T.run; if (!R2 || R2.floor !== 0 || !R2.town || !R2.map.town || T.screen !== 'play') { out.push('town: a run saved in the town does not go on there'); return out; }
    for (let i = 0; i < 30; i++) step(T, { keys: [] });
    R2.hero.x = R2.map.exit.x; R2.hero.y = R2.map.exit.y; interact(T, R2);
    if (R2.floor !== 1 || R2.town || R2.map.town || !R2.en.length) out.push('town: the stairs do not lead down to the 1st floor');
    if (runCompletion(R2).floors !== 1) out.push('town: the town counts as a floor of the run');
    // TASKS 1006: down the stairs the hero is as he left the town; a death and a win show their results and lead back to the town
    // with a new hero and the meta kept; a saved run in the town stays small
    { const S2 = spawn(0, {}); S2.meta.shards = 40; startRun(S2, 'town'); const Q = S2.run, h2 = Q.hero; h2.gold = 321; h2.bag[5] = Object.assign(rollItem(Q, 1, 0, 'ring'), { id: Q.nextId++ });
      const size = JSON.stringify(persist(S2)).length; if (size > 120000) out.push(`town: a run saved in the town takes ${size} bytes`);
      const want = JSON.stringify([h2.lvl, h2.gold, h2.eq, h2.bag]); h2.x = Q.map.exit.x; h2.y = Q.map.exit.y; interact(S2, Q);
      if (Q.floor !== 1 || JSON.stringify([h2.lvl, h2.gold, h2.eq, h2.bag]) !== want) out.push('town: the hero changes on the way down');
      for (const how of ['dead', 'win']) { const shards = S2.meta.shards; if (how === 'win') { startRun(S2, 'town'); const Q2 = S2.run; Q2.hero.x = Q2.map.exit.x; Q2.hero.y = Q2.map.exit.y; interact(S2, Q2); }
        endRun(S2, how); if (S2.screen !== how || !S2.result.town) { out.push(`town: no ${how} screen for a run through the town`); continue; }
        const b = UI.end(S2.result.log, S2.result.town).find((q) => q.id === 'again'); if (b.label !== 'Вернуться в город') out.push(`town: the ${how} screen does not offer the town`);
        press(S2, b); const Q3 = S2.run;
        if (!Q3 || Q3.floor !== 0 || !Q3.town || S2.screen !== 'play' || Q3.hero.lvl !== 1 || Q3.hero.gold !== 0 || Q3.hero.bag.filter(Boolean).length !== 2) out.push(`town: after a ${how} the hero does not start anew in the town`);
        if (S2.meta.shards < shards) out.push(`town: the meta loses shards after a ${how}`); } }
    return out;
  }
  const persist = (S) => ({ meta: S.meta, run: S.run || S.saved || null });

  root.SIM = { serpentMouth, flightReach, openSecret, debugSecrets, lootAudit, openChest, DT, ARROW_Y, L, K, VIEW, HINT, RIG, create, spawn, respawn, outOfPlay, step, at, scriptInput, demoCheck, selfCheck, persist,
    stepLen, stats, gift, itemName, hitSecret, hitProps, secretMask, hidden, fstat, completion, completionHints, damageName, canDonate, runCompletion, runReward, REWARD, LOOT, itemIcon, itemMods, typeMods, isCons, hand, losClear, rollItem, newRun, enterFloor, cell, flow, atCounter, openDoor, pullLever, doorLock, doorNear, leverNear, springAmbush, crustAt, CRUST, DOOM, chasm };
  if (typeof module !== 'undefined') module.exports = root.SIM;
})(typeof window !== 'undefined' ? window : globalThis);
