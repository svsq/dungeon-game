// live/sim_floor.js — a new run and floor: building, floors kept as they were left, arrival, completion, hazards and pyres, rewards and secrets.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const {
    ABILITIES, BAL, BASES, D, DG, DT, ENEMIES, FROM, K, RUN, STAGE, WIN, boxHit, clampCam, dep, dif, eliteK, ev, gearName, itemPower,
    lastFloor, potCount, potion, reveal, rnd, rollAffixes, rollItem, shove, stats, who } = SIMX;
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
    for (const e of R.en) if (e.type === 'crab') e.fa = SIMX.faOf(e);
    m.enemies.forEach((e, i) => { if (e.key !== undefined) R.en[i].key = e.key; });
    for (const e of R.en) if (e.elite && !D.BOSSES[e.type]) { e.mods = SIMX.rollMods(R, d, e); if (SIMX.has(e, 'ward')) e.ward = Math.round(e.max * SIMX.MOD.ward.share); }
    // a closed door is a solid cell (5) that blocks sight like rock until it opens
    for (const d of m.doors || []) if (!d.open) for (const [x, y] of d.cells) m.cells[y * m.W + x] = 5;
    R.keys = 0;
    R.shop = !m.shop ? null : SIMX.stockShop(R, d, m.wander ? 'wander' : undefined);
    R.chests = m.chests.map((c) => Object.assign({}, c)); for (const c of R.chests) c.loot = SIMX.chestLoot(R, c); R.pots = m.pots.map((p) => Object.assign({}, p)); R.shrines = m.shrines.map((s) => Object.assign({}, s));
    // a big monster's post can graze a prop: the post is where it can actually stand
    { const sol = SIMX.solids(R), clear = (x, y, r) => !boxHit(m, x, y, r, true, false) && !sol.some((o) => Math.hypot(x - o.x, (y - o.y) * 1.6) < o.r + r);
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
    const qr = new Set(SIMX.questRooms({ map: B.map }).map((r) => r.id));
    for (const q of R.quests || []) { const T = q.st === 'taken' && q.f === f && D.QUESTS[q.key].type; if (T !== 'named' && T !== 'room') continue;
      const e = B.en.filter((o) => !spare.has(o) && qr.has(o.room) && (T === 'named' ? SIMX.plainFoe(o) : o.deadT < 0 && counted(o) && !D.BOSSES[o.type])).sort(far).pop(); if (e) spare.add(e); }
    const mobs = B.en.filter((e) => !D.BOSSES[e.type] && !spare.has(e)).sort(far);
    for (const e of mobs.slice(0, oldDead(R, f, M, P.en))) { e.hp = 0; e.deadT = 0; }
    for (const k of FLOOR_KEYS) R[k] = B[k];
    const boss = slain && R.en.find((e) => D.BOSSES[e.type]);
    if (boss) { boss.hp = 0; boss.deadT = 0; R.bossDead = 1; R.arena = { active: 0, room: boss.room, t0: 0 }; if (R.viaTown) R.arena.gate = SIMX.bossGate(R, boss); }
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
  function standNear(R, x, y) { const m = R.map, sol = SIMX.solids(R), ok = (px, py) => !boxHit(m, px, py, K.R, false, false) && !sol.some((o) => Math.hypot(px - o.x, (py - o.y) * 1.6) < o.r + K.R);
    if (ok(x, y)) return [x, y]; for (let d = 6; d <= 160; d += 6) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a * Math.PI / 8 + Math.PI / 2) * d, py = y + Math.sin(a * Math.PI / 8 + Math.PI / 2) * d; if (ok(px, py)) return [px, py]; }
    return [x, y]; }
  function enterFloor(S, R, f, gen, how = 'down') {
    if (R.map && R.viaTown) stashFloor(R);
    if (R.map && R.town && R.shop) R.townShop = R.shop;
    R.floor = f; if (f > 0) R.deepest = Math.max(R.deepest || 0, f); R.propHit = {};   // only the last floor's boss opens the way out: a save from when the 8th was the last carries the lord's
    if (R.log) R.log.fl.push({ f, bag: potCount(R.hero), eq: Object.fromEntries(Object.entries(R.hero.eq).filter(([, it]) => it).map(([k, it]) => [k, gearName(it)])), perks: Object.assign({}, R.hero.perks), time: 0, lvlIn: R.hero.lvl, lvl: R.hero.lvl, xp: 0, minHp: 1, minMp: 1, kills: {}, dmg: {}, hits: {}, pot: {}, ab: {}, gold: 0, buy: 0, sell: 0, buys: [] });
    const M = f > 0 && R.memo && R.memo[f];
    if (M) { const mig = restoreFloor(R, f, M); R.town = 0; R.folk = null; SIMX.regate(R); if (mig) SIMX.questPlace(S, R); }
    else { if (f > 0 && R.viaTown) (R.memo = R.memo || {})[f] = { rs: R.rs, id: R.nextId, mode: R.mode, gen: gen || null, gv: D.GEN_VERSION }; buildFloor(R, f, gen); if (f > 0 && R.viaTown) { BASE.set(R.memo[f], snapFloor(R)); SIMX.questPlace(S, R); } }
    // the town's shelf (TASKS 1010) is stocked once a run and again after each boss slain, for the deepest floor reached by then, so
    // going back and forth is no free re-roll; the buy-back row goes on across a restock
    // the offers (and in buildFloor the townsfolk) are made on arrival, not on first ask: the HUD asks too, and a render must not
    // write the state (TASKS 1025)
    if (f === 0) { SIMX.offersOf(R); R.away = (R.deepest || 0) - (R.townDeep || 0); R.townDeep = R.deepest || 0;
      const bn = R.bossN || 0, old = R.townShop; R.townShop = null;
      if (old && (old.boss || 0) === bn) { R.shop = old; if ((old.at || 0) < (R.deepest || 0)) { SIMX.restock(R, R.shop, SIMX.tradeDepth(R)); R.shop.at = R.deepest; } }
      else { R.shop = SIMX.stockShop(R, SIMX.tradeDepth(R), 'town'); R.shop.at = R.deepest || 0; R.shop.boss = bn; if (old) R.shop.back = old.back; } }
    const m = R.map;
    R.stats = R.stats || {}; if (!M || !R.stats[f]) R.stats[f] = floorStat(R);
    arrive(S, R, how); R.arrived = M ? '' : how;
    ev(S, { k: 'floor', x: R.hero.x, y: R.hero.y, f });
    S.saveN++;
  }
  function arrive(S, R, how) { const m = R.map, h = R.hero; let [hx, hy] = [m.spawn.x, m.spawn.y];
    // up from below the campaign's last floor: by its own stairs on (TASKS 514), not its portal out
    if (how === 'up') { const st = m.down || m.exit; [hx, hy] = standNear(R, st.x, st.y + 46); }
    else if (how === 'down' && m.up) [hx, hy] = standNear(R, m.up.x, m.up.y + 46);
    else if (how === 'portal') { const P = m.town ? m.town.svc.portal : R.portal; [hx, hy] = standNear(R, P.x, P.y + (m.town ? 40 : 0)); }
    else if (how === 'way' && m.way) [hx, hy] = standNear(R, m.way.x, m.way.y + 40);
    h.x = hx; h.y = hy; h.vx = h.vy = 0; h.bless = 0; h.pull = null; h.read = null;
    // up the stairs or through a portal he may come out by a floor's guard: a second to see where he is
    if (how !== 'down') h.ifr = Math.max(h.ifr || 0, S.t + 1);
    R.zoom = S.demo ? D.ZOOM : S.meta.zoom; R.cam = [h.x - WIN(R).W / 2, h.y - WIN(R).H / 2]; R.camV = [0, 0]; clampCam(R, R.cam);
    // (the floor's name gone by 2 s, TASKS 1054: at 3.5 s its ghost still lay over the way ahead)
    reveal(R); R.msg = { s: D.placeName(R.floor, R.mode, R.seed, FROM(R), m), t: S.t, d: 2 };
  }
  // a run picked up on its arrival at a floor first built there (the bot's checkpoints, TASKS 467): the floor is built again by this
  // version of the game from the RNG and ids it was first built with, so a change to the deep floors is measured without playing
  // the floors before them again
  function rebuildArrival(S) { const R = S.run, f = R.floor, M = R.memo && R.memo[f]; if (!M || !R.arrived) return false;
    R.rs = M.rs; R.nextId = M.id; M.gv = D.GEN_VERSION; buildFloor(R, f, M.gen || undefined); BASE.set(M, snapFloor(R));
    for (const q of R.quests || []) if (q.st === 'taken' && q.f === f && D.QUESTS[q.key].fresh) { q.placed = 0; delete q.lost; delete q.room; delete q.where; }
    SIMX.questPlace(S, R); R.stats[f] = floorStat(R); arrive(S, R, R.arrived); return true; }

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
        SIMX.hurtHero(S, R, SIMX.heroSt(S).maxHp * H.hp, z.k === 'surge' ? h.x : z.x, (z.k === 'surge' ? h.y : z.y) - 10, 'spike', z.k === 'vent' ? 'vent' : z.k === 'surge' ? 'surge' : 'rock');
        if (H.burn && h.hp > 0) { if (h.burn <= t) h.burnT = t - 0.5; h.burn = Math.max(h.burn, t + H.burn); } }
      for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && !D.BOSSES[e.type] && D.hazIn(z, e.x, e.y) && (e.haz || (e.haz = {}))[tag] !== n) { e.haz[tag] = n;
        SIMX.hitEnemy(S, R, e, Math.round(H.mon * (1 + 0.2 * (dep(R) - 1))), false, z.x, z.y, H.kb, H.burn ? 'fire' : undefined); } });
  }
  // a fire priest's ring (TASKS 410): it glows over its warning, then the pillar of fire stands for its burst and hurts a hero within
  // it once; it cares for no one else
  function stepPyres(S, R) { const h = R.hero, t = S.t, P = ENEMIES.fire_priest.pyre;
    for (const p of R.pyres) { const u = t - p.t0; if (u < P.warn) continue;
      if (!p.lit) { p.lit = 1; ev(S, { k: 'pillar', x: p.x, y: p.y, r: P.r, id: p.id }); R.trauma = Math.min(1, R.trauma + 0.15); }
      if (!p.hit && h.deadT < 0 && Math.hypot(h.x - p.x, (h.y - p.y) / P.ry) < P.r) { p.hit = 1; SIMX.hurtHero(S, R, p.dmg, p.x, p.y - 10, 'fire', TXT('sim_floor.stepPyres', { who: p.who }), R.en.find((o) => o.id === p.src)); } }
    R.pyres = R.pyres.filter((p) => t - p.t0 < P.warn + P.burst); }
  // a fire priest's cast: a ring under the hero, or (kin) fire on the weapons of the allies nearest it
  function pyre(S, R, e, E) { e.kinS = 0; const h = R.hero, p = { id: R.nextId++, src: e.id, who: who(e), x: h.x, y: h.y, t0: S.t, dmg: e.dmg * E.pyre.dmg * eliteK(e, 'bolt') };
    (R.pyres = R.pyres || []).push(p); ev(S, { k: 'pyre', x: p.x, y: p.y, r: E.pyre.r, d: E.pyre.warn, id: p.id, src: e.id }); }
  const kinOf = (R, e, E) => R.en.filter((o) => o !== e && o.deadT < 0 && !o.summ && !D.BOSSES[o.type] && E.kindle.kinds.includes(ENEMIES[o.type].kind) && o.st !== 'idle' && o.st !== 'lurk'
    && Math.hypot(o.x - e.x, o.y - e.y) < E.kindle.r).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, E.kindle.n);
  function kindle(S, R, e, E) { const K = E.kindle, to = kinOf(R, e, E); e.kin = 0; e.kinS = 1; e.kinT = S.t + K.every;
    for (const o of to) o.fireT = S.t + K.t; ev(S, { k: 'kindle', x: e.x, y: e.y - 44, id: e.id, to: to.map((o) => o.id) }); }

  // ---------------- the magma golem (TASKS 409) ----------------
  const crustOf = (e, E) => e.crust ?? E.crust.n;
  function golemCrust(S, R, e, E, d) { const C = E.crust, t = S.t, n = crustOf(e, E);
    if (n >= C.n || t - (e.blowT ?? -9) < C.calm || d < C.far) { e.growT = t; return; }
    if (t - (e.growT ?? t) >= C.regrow) { e.crust = n + 1; e.growT = t; (e.plateG = e.plateG || {})[e.crust] = t; ev(S, { k: 'regrow', x: e.x, y: e.y - E.h * 0.55, id: e.id, n: e.crust }); } }
  function damageName(src) {
    const type = String(src || '').split(' ')[0], E = ENEMIES[type];
    if (E) return E.name + (src.includes(TXT('sim_floor.damageName')) ? TXT('sim_floor.damageName.2') : '') + (src.endsWith(TXT('sim_floor.damageName.3')) ? TXT('sim_floor.damageName.4') : src.endsWith(TXT('sim_floor.damageName.5')) ? TXT('sim_floor.damageName.6') : src.endsWith(TXT('sim_floor.damageName.7')) ? TXT('sim_floor.damageName.8') : '');
    return ({ spike: TXT('sim_floor.damageName.spike'), lava: TXT('sim_floor.damageName.lava'), burn: TXT('sim_floor.damageName.burn'), poison: TXT('sim_floor.damageName.poison'), fire: TXT('sim_floor.damageName.fire'), vent: TXT('sim_floor.damageName.vent'), rock: TXT('sim_floor.damageName.rock'), surge: TXT('sim_floor.damageName.surge') })[src] || TXT('sim_floor.damageName.9');
  }
  // the end-of-run reward: gold brought back and a win. Thoroughness is paid on the floor itself, 10 shards for each of its kills,
  // loot and secrets at 100 % and 1 per secret found (TASKS 175); with the elites and the boss a thorough win brings ~120 shards,
  // so the altar's 1395 take some 20 runs
  const REWARD = { goldPer: 500, win: 30, full: 10, secret: 1 };
  function runReward(R, how) {
    // the gold of a campaign won on the way down was paid at the stairs (descend): only the gold since counts at the end, and its
    // win is not paid again when the run is ended alive later (TASKS 1148)
    const C = runCompletion(R), base = Math.floor((R.goldTot - (R.goldBanked || 0)) / REWARD.goldPer) + (how === 'win' && !R.campaignWon ? REWARD.win : 0);
    return { base, bonus: 0, cap: 0, C };
  }
  const FULL = [['kills', 'foes', TXT('FULL')], ['loot', 'lootN', TXT('FULL.2')], ['sec', 'secN', TXT('FULL.3')]];
  function giveShards(S, R, n, x, y, s) { R.shards += n; S.meta.shards += n; ev(S, { k: 'shard', x, y, n, floor: R.floor, s }); }
  // a floor's kills, loot or secrets brought to 100 % pay once, on the spot
  function checkFull(S, R) { const f = fstat(R), h = R.hero; f.full = f.full || {};
    for (const [k, n, s] of FULL) if (!f.full[k] && f[n] > 0 && f[k] >= f[n]) { f.full[k] = 1; giveShards(S, R, REWARD.full, h.x, h.y, TXT('sim_floor.checkFull', { s, full: REWARD.full })); } }

  // cells of the secret rooms not found yet (the room, its passage and the fake wall): render and minimap show them as rock
  const MASK = { key: '', set: null };
  function secretMask(m) { const key = m.seed + ':' + m.floor + ':' + (m.secrets || []).map((q) => q.open).join('');
    if (MASK.key === key) return MASK.set; const set = new Set();
    for (const q of m.secrets || []) { if (q.open) continue; const r = m.rooms[q.room];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set.add(y * m.W + x);
      for (const k of q.hide) set.add(k); }
    MASK.key = key; MASK.set = set; return set; }
  const hidden = (m, o) => o.sec !== undefined && !!m.secrets && !m.secrets[o.sec].open;

  Object.assign(SIMX, {
    newRun, standNear, enterFloor, rebuildArrival, counted, floorStat, fstat, completion, runCompletion, completionHints, stepHazards,
    stepPyres, pyre, kinOf, kindle, crustOf, golemCrust, damageName, REWARD, runReward, giveShards, checkFull, secretMask, hidden });
})(typeof window !== 'undefined' ? window : globalThis);
