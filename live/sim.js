// live/sim.js — deterministic dungeon-crawler simulation, fixed 120 Hz. Contract: create / step / at / spawn / respawn /
// outOfPlay / scriptInput (engine.md §6). Everything that happens lives here: menus, the run (procedural floors), the hero
// (stats, gear, abilities, levelling), monsters (FSM + flow-field chase), loot, traps, saves (S.saveN asks index.html to
// persist S.meta and the run), camera, and the event bus S.ev that drives every FX in the scene.
(function (root) {
  const D = root.DATA || require('./data.js'), DG = root.DUNGEON || require('./dungeon.js');
  const { TILE, ENEMIES, BAL, ELITE, BASES, CONSUMABLES, RARITY, AFFIXES, ABILITIES, META, UI } = D;
  const DT = 1 / 120, L = 26.0;
  const VIEW = { W: 1920, H: 1080 };
  const HINT = 'WASD — движение · ЛКМ — атака · 1 2 3 — способности · Пробел — рывок · Q/R — зелья · E — действие · I — герой · Esc — пауза';
  const K = { HIT: 0.13, RUN: 175, ACC: 1900, DEC: 2300, DASH: 640, DASH_T: 0.16, DASH_CD: 0.75, R: 12, IFR: 0.5, STEP: 20 };
  const DEMO_SEED = 4243;

  // ---------------- rng (state lives in the run: deterministic replay) ----------------
  const rnd = (R) => { R.rs = (R.rs + 0x6d2b79f5) | 0; let t = Math.imul(R.rs ^ (R.rs >>> 15), 1 | R.rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (R, a, b) => a + Math.floor(rnd(R) * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(rnd(R) * arr.length)];
  const ev = (S, e) => { e.t = S.t; S.ev.push(e); };
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
    const bk = pick(R, keys);
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
  const GIFT_V = Object.fromEntries(D.GIFTS.map((g) => [g.id, g.v]));
  const gift = (h, id) => ((h.perks || {})[id] || 0) * GIFT_V[id];
  function stats(h, meta) {
    const s = { str: h.base.str, agi: h.base.agi, int: h.base.int, vit: h.base.vit, atk: 0, def: 0, crit: 0, hp: 0, mp: 0, aspd: 0, mspd: 0, leech: 0, fire: 0, regen: 0, onhit: 0 };
    let wpn = null;
    for (const k in h.eq) { const it = h.eq[k]; if (!it) continue; if (k === 'weapon') wpn = it; s.def += it.def || 0; const mods = itemMods(it); for (const m in mods) s[m] = (s[m] || 0) + mods[m]; }
    const up = (meta && meta.up) || {}, W = wpn ? BASES[wpn.b] : { atk: 3, spd: 0.45, arc: 110, reach: 51 };
    const out = {
      str: s.str, agi: s.agi, int: s.int, vit: s.vit,
      maxHp: Math.round(80 + s.vit * 10 + (h.lvl - 1) * 6 + s.hp + 12 * (up.hp || 0) + gift(h, 'vigor')),
      maxMp: Math.round(40 + s.int * 6 + (h.lvl - 1) * 2 + s.mp + 10 * (up.mana || 0) + gift(h, 'wisdom')),
      atk: Math.round(((wpn ? wpn.atk : 3) + s.str * 1.6 + s.atk + (W.spell ? s.int * 0.8 : 0)) * (1 + 0.06 * (up.dmg || 0)) * (1 + gift(h, 'fury') / 100)),
      def: Math.round(s.def + s.vit * 0.3 + gift(h, 'ward')),
      crit: Math.min(60, 5 + s.agi * 0.5 + s.crit + gift(h, 'crit')),
      aspd: s.agi * 1.2 + s.aspd + gift(h, 'haste'), mspd: Math.min(40, s.agi * 0.4 + s.mspd + gift(h, 'swift')), leech: s.leech + gift(h, 'leech'),
      regen: s.regen + 0.5 * (up.regen || 0) + gift(h, 'life'), onhit: s.onhit,
      spell: (1 + s.int * 0.04) * (1 + (W.spell || 0)) * (1 + s.fire / 100) * (1 + 0.06 * (up.dmg || 0)) * (1 + gift(h, 'fury') / 100) * (1 + gift(h, 'arcane') / 100),
      resist: 1 - 0.15 * (up.resist || 0), gold: 1 + gift(h, 'greed') / 100,
      wcd: W.spd, arc: W.arc, reach: W.reach, kb: W.kb || 1, wtype: wpn ? wpn.b : 'fist',
    };
    return out;
  }

  // ---------------- run & floor ----------------
  function newHero(meta) {
    const up = meta.up || {};
    const h = { x: 0, y: 0, vx: 0, vy: 0, face: 1, back: 0, backT: -9, aim: 0, hp: 1, mp: 1, lvl: 1, xp: 0, pts: 2 * (up.stat || 0), sp: up.skill || 0, perks: {},
      base: { str: 5, agi: 4, int: 3, vit: 5 }, gold: 0, eq: {}, bag: new Array(24).fill(null), ab: { whirl: 1, fireball: 0, shield: 0 },
      cd: { whirl: 0, fireball: 0, shield: 0, dash: 0, atk: 0 }, atkT: -9, atkA: 0, patkT: -9, patkA: 0, atkHit: 0, atkN: 0, castT: -9, castK: '', whirlT: -9, dashT: -9, dashX: 0, dashY: 0,
      hurtT: -9, ifr: 0, shield: 0, shieldT: -9, shieldUntil: 0, poison: 0, burn: 0, burnT: -9, spikeT: -9, dist: 0, gp: 0, deadT: -1, regen: 0, bless: 0 };
    for (const k of D.SLOTS) h.eq[k] = null;
    return h;
  }
  function newRun(S, mode, seed) {
    const R = { mode, seed, itemBalance: D.ITEM_BAL.version, rs: seed | 0, floor: 1, t: 0, nextId: 1, kills: 0, goldTot: 0, shards: 0, hero: newHero(S.meta), cam: [0, 0], camV: [0, 0],
      freeze: 0, trauma: 0, map: null, en: [], proj: [], drops: [], chests: [], pots: [], shrines: [], seen: [], rseen: [], bossDead: 0, won: 0, saveT: 0, msg: null };
    const h = R.hero;
    const give = (it) => { it.id = R.nextId++; return it; };
    h.eq.weapon = give(Object.assign(rollItem(R, 1, 0, 'weapon'), { b: 'sword', rar: 0, mods: {}, atk: BASES.sword.atk }));
    h.eq.armor = give({ b: 'leather_armor', rar: 0, lvl: 1, mods: {}, def: BASES.leather_armor.def });
    const gr = (S.meta.up || {}).gear || 0; if (gr) for (const it of [h.eq.weapon, h.eq.armor]) { it.rar = gr; rollAffixes(R, itemPower(it)); }
    h.bag[0] = give(potion('hp_potion', 2 + ((S.meta.up || {}).potion || 0))); h.bag[1] = give(potion('mp_potion', 1));
    const st = stats(h, S.meta); h.hp = st.maxHp; h.mp = st.maxMp;
    enterFloor(S, R, 1);
    return R;
  }
  function enterFloor(S, R, f) {
    R.floor = f; R.propHit = {}; const m = DG.genFloor((R.seed * 31 + f * 1013) >>> 0, f, { endless: R.mode === 'endless' });
    R.map = m; R.en = []; R.proj = []; R.drops = [];
    const sc = BAL.hp * (1 + 0.5 * (f - 1)), dc = BAL.dmg * 1.35 * (1 + 0.3 * (f - 1));
    for (const e of m.enemies) { const E = ENEMIES[e.type], el = e.elite ? (e.type === 'boss' ? 1 : e.type === 'brute' ? ELITE.bruteHp : ELITE.hp) : 1;
      R.en.push({ id: R.nextId++, type: e.type, x: e.x, y: e.y, vx: 0, vy: 0, hp: Math.round(E.hp * sc * el), max: Math.round(E.hp * sc * el), dmg: E.dmg * dc * (!e.elite ? 1 : e.type === 'boss' ? 1.35 : ELITE.dmg),
        elite: e.elite, room: e.room, st: 'idle', t0: -9, face: rnd(R) < 0.5 ? -1 : 1, aimA: 0, cdT: 0, hitT: -9, deadT: -1, dist: rnd(R) * 50, kbx: 0, kby: 0, burn: 0, burnT: 0, tx: 0, ty: 0, phase: 0, summ: 0, hx: e.x, hy: e.y, seenT: 0, ft: -9 }); }
    R.shop = stockShop(R, f);
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
    R.cam = [h.x - VIEW.W / 2, h.y - VIEW.H / 2]; R.camV = [0, 0]; clampCam(R, R.cam);
    reveal(R); ev(S, { k: 'floor', x: h.x, y: h.y, f });
    R.msg = { s: 'Этаж ' + f + ' — ' + D.floorName(f), t: S.t };
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
  // the end-of-run reward: the base (gold brought back, a win) plus a bonus for thoroughness, 5 shards per floor visited at 100%
  const REWARD = { goldPer: 80, win: 30, perFloor: 5 };
  function runReward(R, how) {
    const C = runCompletion(R), base = Math.floor(R.goldTot / REWARD.goldPer) + (how === 'win' ? REWARD.win : 0);
    const cap = REWARD.perFloor * C.floors, bonus = Math.round(C.pct * cap);
    return { base, bonus, cap, C };
  }

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
  // the sanctuary and the merchant's warded shop (plus one cell): monsters never set foot in them, their bolts die at the line
  const inStart = (m, tx, ty) => inRoom1(m.rooms[m.start], tx, ty) || (!!m.shop && inRoom1(m.rooms[m.shop.room], tx, ty));
  // lava (3) can be entered — it burns — by the hero and by a monster knocked into it; a monster never walks into it on its own
  const solidAt = (m, x, y, mon, lavaOk) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), c = cell(m, tx, ty); return c === 3 ? !lavaOk : c !== 1 || (mon && inStart(m, tx, ty)); };
  const onLava = (m, o) => cell(m, Math.floor(o.x / TILE), Math.floor(o.y / TILE)) === 3;
  // feet box against the grid, axis by axis (slides along walls)
  const boxHit = (m, x, y, r, mon, lavaOk) => solidAt(m, x - r, y - r * 0.6, mon, lavaOk) || solidAt(m, x + r, y - r * 0.6, mon, lavaOk) || solidAt(m, x - r, y + r * 0.4, mon, lavaOk) || solidAt(m, x + r, y + r * 0.4, mon, lavaOk);
  function move(m, o, dx, dy, r, mon, lavaOk = !mon || onLava(m, o)) {
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
  const losClear = (m, x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10); for (let i = 1; i < n; i++) { const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
    const c = cell(m, Math.floor(x / TILE), Math.floor((y - 8) / TILE)); if (c === 0 || c === 4) return false; } return true; };
  // flow field from a target tile over open floor (monsters avoid the sanctuary): derived data, cached by key, never in the state
  const FLOW = { key: '', d: null };
  const FLOW2 = { key: '', d: null };
  function bfs(m, tx, ty, lim, sanct) {
    const d = new Int16Array(m.W * m.H).fill(-1), q = new Int32Array(m.W * m.H); let qh = 0, qt = 0;
    const blk = new Uint8Array(m.W * m.H); for (const i of m.block || []) blk[i] = 1;
    if (cell(m, tx, ty) === 1) { d[ty * m.W + tx] = 0; q[qt++] = ty * m.W + tx; }
    while (qh < qt) { const i = q[qh++], x = i % m.W, y = (i / m.W) | 0, dv = d[i]; if (dv > lim) continue;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay, j = ny * m.W + nx;
        if (nx < 0 || ny < 0 || nx >= m.W || ny >= m.H || d[j] >= 0 || m.cells[j] !== 1 || blk[j] || (!sanct && inStart(m, nx, ny))) continue; d[j] = dv + 1; q[qt++] = j; } }
    return d;
  }
  function flow(m, tx, ty, any) {
    const C = any ? FLOW2 : FLOW, key = m.seed + ':' + m.floor + ':' + tx + ',' + ty; if (C.key === key) return C.d;
    C.key = key; C.d = bfs(m, tx, ty, any ? 400 : 40, any); return C.d;
  }
  // a monster walking back to its post may be far from it: a whole-floor field per post, a few kept at once
  const HOME = new Map();
  function homeFlow(m, tx, ty) {
    const fk = m.seed + ':' + m.floor; if (HOME.fk !== fk) { HOME.clear(); HOME.fk = fk; }
    const key = ty * m.W + tx; let d = HOME.get(key);
    if (!d) { d = bfs(m, tx, ty, 400, false); if (HOME.size >= 24) HOME.delete(HOME.keys().next().value); }
    else HOME.delete(key);
    HOME.set(key, d); return d;
  }
  function reveal(R) {
    const m = R.map, h = R.hero, tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
    for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 8; x <= tx + 8; x++) if (x >= 0 && y >= 0 && x < m.W && y < m.H) R.seen[y * m.W + x] = 1;
    const ri2 = DG.roomAt(m, h.x, h.y);
    if (ri2 >= 0 && !R.rseen[ri2]) { R.rseen[ri2] = 1; const r = m.rooms[ri2];
      for (let y = r.y - 2; y <= r.y + r.h + 1; y++) for (let x = r.x - 2; x <= r.x + r.w + 1; x++) if (x >= 0 && y >= 0 && x < m.W && y < m.H) R.seen[y * m.W + x] = 1; }
    return ri2;
  }
  // the camera may leave the map by more than the HUD's width, so a room at the edge never sits under the minimap or the bars
  function clampCam(R, c) { const m = R.map; c[0] = clamp(c[0], -620, m.W * TILE - VIEW.W + 620); c[1] = clamp(c[1], -380, m.H * TILE - VIEW.H + 300); }

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
    const h = R.hero; h.xp += n;
    while (h.xp >= D.xpNeed(h.lvl)) { h.xp -= D.xpNeed(h.lvl); h.lvl++; h.pts += 3; h.sp += 1;
      for (const a of ABILITIES) if (a.unlock === h.lvl && !h.ab[a.id]) { h.ab[a.id] = 1; ev(S, { k: 'unlock', x: h.x, y: h.y, id: a.id }); }
      const st = heroSt(S); h.hp = st.maxHp; h.mp = st.maxMp; ev(S, { k: 'lvl', x: h.x, y: h.y, lvl: h.lvl }); }
  }
  function hurtHero(S, R, dmg, sx, sy, kind) {
    const h = R.hero; if (h.deadT >= 0 || S.t < h.ifr) return;
    const st = heroSt(S); dmg = Math.max(1, Math.round(dmg * 100 / (100 + st.def * 5)));
    if (h.shield > 0 && S.t < h.shieldUntil) { const a = Math.min(h.shield, dmg); h.shield -= a; dmg -= a; ev(S, { k: 'absorb', x: h.x, y: h.y, n: a }); if (dmg <= 0) return; }
    h.hp -= dmg; h.hurtT = S.t; h.hurtX = Math.abs(h.x - sx) < 4 ? 0 : h.x > sx ? 1 : -1; h.ifr = S.t + K.IFR; R.trauma = Math.min(1, R.trauma + 0.35); R.freeze = Math.max(R.freeze, 0.05);
    const dx = h.x - sx, dy = h.y - sy, d = Math.hypot(dx, dy) || 1; h.vx += dx / d * 260; h.vy += dy / d * 260;
    if (kind === 'poison') h.poison = S.t + 3;
    if (kind === 'fire') h.burn = S.t + 3;
    ev(S, { k: "hurt", x: h.x, y: h.y - 40, n: dmg });
    if (h.hp <= 0) { h.hp = 0; h.deadT = S.t; ev(S, { k: 'die', x: h.x, y: h.y }); }
  }
  function hitEnemy(S, R, e, dmg, crit, sx, sy, kb = 1, kind) {
    if (e.deadT >= 0) return;
    e.hp -= dmg; e.hitT = S.t; if (e.st === 'idle' || e.st === 'home') aggroRoom(R, e);
    const dx = e.x - sx, dy = e.y - sy, d = Math.hypot(dx, dy) || 1, heavy = e.type === 'brute' || e.type === 'boss' || ENEMIES[e.type].ghost;
    if (!heavy) { e.kbx += dx / d * 300 * kb; e.kby += dy / d * 300 * kb; }
    if (kind === 'fire') { e.burn = S.t + 3; e.burnT = S.t; }
    ev(S, { k: 'hit', x: e.x, y: e.y - ENEMIES[e.type].h * 0.5 - 6, n: dmg, crit: crit ? 1 : 0, id: e.id, fire: kind === 'fire' ? 1 : 0 });
    R.freeze = Math.max(R.freeze, crit ? 0.06 : 0.035); R.trauma = Math.min(1, R.trauma + (crit ? 0.22 : 0.12));
    const st = heroSt(S); if (kind !== 'burn') R.hero.hp = Math.min(st.maxHp, R.hero.hp + dmg * st.leech / 100 + st.onhit);
    if (e.hp <= 0) killEnemy(S, R, e);
  }
  function aggroRoom(R, e) { for (const o of R.en) if (o.deadT < 0 && (o === e || o.st === 'idle') && (o.room === e.room || Math.hypot(o.x - e.x, o.y - e.y) < 220)) { o.st = 'chase'; o.t0 = o.seenT = R.t; }
    if (e.st === 'home') { e.st = 'chase'; e.t0 = e.seenT = R.t; } }
  function killEnemy(S, R, e) {
    e.deadT = S.t; e.hp = 0; R.kills++; if (!e.summ) fstat(R).kills++; R.freeze = Math.max(R.freeze, 0.07); R.trauma = Math.min(1, R.trauma + 0.25);
    const E = ENEMIES[e.type]; gainXp(S, R, Math.round(E.xp * BAL.reward * (1 + 0.3 * (R.floor - 1)) * (e.elite ? 3 : 1)));
    ev(S, { k: 'kill', x: e.x, y: e.y, type: e.type, id: e.id });
    const gb = 1 + 0.15 * ((S.meta.up || {}).gold || 0);
    if (rnd(R) < 0.55 || e.elite) drop(R, e.x, e.y, { kind: 'gold', n: Math.round((3 + ri(R, 0, 6) + R.floor * 2) * (e.elite ? 4 : 1) * gb * BAL.reward) });
    const LT = e.type === 'brute' && e.elite ? LOOT.brute : e.elite ? LOOT.elite : LOOT.mob;
    if (e.type !== 'boss' && (e.elite || rnd(R) < LT.p * BAL.reward)) for (let i = 0, n = 1 + (rnd(R) < (LT.extra || 0) ? 1 : 0); i < n; i++) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, R.floor, LT.q, undefined, LT) });
    if (rnd(R) < 0.07 * BAL.reward) drop(R, e.x, e.y, { kind: 'item', item: potion(rnd(R) < 0.65 ? 'hp_potion' : 'mp_potion') });
    const sh = e.type === 'boss' ? 20 : e.elite ? 2 : rnd(R) < 0.05 * BAL.reward ? 1 : 0; if (sh) drop(R, e.x, e.y, { kind: 'shard', n: sh });
    if (e.type === 'boss') { R.bossDead = 1; R.msg = { s: 'Повелитель Демонов повержен! Портал наружу открыт', t: S.t }; for (const o of LOOT.boss) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, R.floor, o.q, undefined, o) }); }
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
  function drop(R, x, y, o) { const a = rnd(R) * Math.PI * 2, v = 60 + rnd(R) * 90; if (o.item && !o.item.id) o.item.id = R.nextId++;
    if (o.kind === 'item') { o.loot = 1; if (!o.pre) fstat(R).lootN++; delete o.pre; }
    R.drops.push(Object.assign({ id: R.nextId++, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 0, vz: 160 + rnd(R) * 80, t0: R.t }, o)); }

  // ---------------- actions ----------------
  function usePotion(S, R, b) {
    const h = R.hero, i = h.bag.findIndex((it) => it && it.b === b); if (i < 0) { ev(S, { k: 'nope', x: h.x, y: h.y, s: b === 'hp_potion' ? 'Нет зелий здоровья' : 'Нет зелий маны' }); return; }
    const st = heroSt(S), it = h.bag[i];
    if (b === 'hp_potion') h.hp = Math.min(st.maxHp, h.hp + st.maxHp * CONSUMABLES.hp_potion.heal); else h.mp = Math.min(st.maxMp, h.mp + st.maxMp * CONSUMABLES.mp_potion.mana);
    if (--it.n <= 0) h.bag[i] = null; ev(S, { k: 'drink', x: h.x, y: h.y, b });
  }
  // gear for an empty slot goes straight onto the hero instead of into the bag
  function wearIfFree(S, R, it) {
    const h = R.hero, b = BASES[it.b]; if (isCons(it) || !b || !b.slot || h.eq[b.slot]) return false;
    h.eq[b.slot] = it; ev(S, { k: 'equip', x: h.x, y: h.y, slot: b.slot }); return true;
  }
  function useItem(S, R, idx) {
    const h = R.hero, it = h.bag[idx]; if (!it) return;
    if (it.b === 'hp_potion' || it.b === 'mp_potion') { usePotion(S, R, it.b); return; }
    if (it.b === 'scroll') { const m = R.map, fx = h.x, fy = h.y; h.x = m.spawn.x; h.y = m.spawn.y; if (--it.n <= 0) h.bag[idx] = null; ev(S, { k: 'teleport', x: h.x, y: h.y, fx, fy }); return; }
    const slot = BASES[it.b].slot, old = h.eq[slot]; h.eq[slot] = it; h.bag[idx] = old || null; ev(S, { k: 'equip', x: h.x, y: h.y, slot });
    const st = heroSt(S); h.hp = Math.min(h.hp, st.maxHp); h.mp = Math.min(h.mp, st.maxMp);
  }
  function castAbility(S, R, id, inp) {
    const h = R.hero, A = ABILITIES.find((a) => a.id === id), rank = h.ab[id] || 0;
    if (!rank) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Откроется на ' + A.unlock + ' уровне' }); return; }
    if (h.cd[id] > S.t) return;
    if (h.mp < A.mp) { ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Не хватает маны' }); return; }
    const AR = D.abRank(id, rank); h.mp -= A.mp; h.cd[id] = S.t + A.cd * AR.cd; h.castT = S.t; h.castK = id;
    const st = heroSt(S);
    if (id === 'whirl') { h.whirlT = S.t; const dmgK = AR.k;
      for (const e of R.en) { if (e.deadT >= 0) continue; const d = Math.hypot(e.x - h.x, (e.y - h.y) * 1.3); if (d < 92 + ENEMIES[e.type].r && losClear(R.map, h.x, h.y, e.x, e.y)) { const c = rnd(R) * 100 < st.crit; hitEnemy(S, R, e, Math.round(st.atk * dmgK * (c ? 1.75 : 1)), c, h.x, h.y, 1.6); } }
      breakPots(S, R, h.x, h.y, 92); hitProps(S, R, h.x, h.y, 92); hitChests(S, R, h.x, h.y, 92); hitSecrets(S, R, h.x, h.y, 92); ev(S, { k: 'whirl', x: h.x, y: h.y }); }
    if (id === 'fireball') { const [hx, hy] = hand(h), a = h.aim, dmg = Math.round((14 + st.int * 2.6) * AR.k * st.spell);
      R.proj.push({ id: R.nextId++, k: 'fire', x: hx, y: hy, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, t0: S.t, life: 1.1, dmg, own: 'hero', r: 8 }); ev(S, { k: 'cast', x: hx, y: hy, a }); }
    if (id === 'shield') { h.shield = Math.round((30 + st.int * 4) * AR.k); h.shieldUntil = S.t + 5; h.shieldT = S.t; ev(S, { k: 'shield', x: h.x, y: h.y }); }
  }
  function breakPots(S, R, x, y, rad, ax, arc) {
    for (const p of R.pots) { if (p.hp <= 0) continue; const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 10) continue; if (arc !== undefined && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) continue; if (!losClear(R.map, x, y, p.x, p.y)) continue;
      p.hp = 0; p.brokeT = S.t; ev(S, { k: 'break', x: p.x, y: p.y, kind: p.kind });
      if (p.kind === 'gold') { for (let k = 0; k < 3; k++) drop(R, p.x, p.y, { kind: 'gold', n: ri(R, 4, 8) + R.floor * 2 }); }
      else if (rnd(R) < 0.6) drop(R, p.x, p.y, { kind: 'gold', n: ri(R, 2, 5) + R.floor }); else if (rnd(R) < 0.2) drop(R, p.x, p.y, { kind: 'item', item: potion(rnd(R) < 0.7 ? 'hp_potion' : 'mp_potion') }); }
  }
  // big props don't break: each blow rocks, rings or chips them (scene.js), with a pause per prop so one swing is one knock
  function hitProps(S, R, x, y, rad, ax, arc) {
    const m = R.map, hit = R.propHit || (R.propHit = {});
    const knock = (id, p, n) => { const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 18) return; if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) return; if (!losClear(m, x, y, p.x, p.y)) return;
      if (S.t - (hit[id] ?? -9) < 0.2) return; hit[id] = S.t; const mat = D.PROP_MAT[n] || 'stone';
      if (mat === 'stone' || mat === 'metal') R.trauma = Math.min(1, R.trauma + 0.06);
      ev(S, { k: 'prop', x: p.x, y: p.y, i: id, n, mat, s: dx >= 0 ? 1 : -1 }); };
    m.decor.forEach((d, i) => { if (d.solid && !d.wall) knock('d' + i, d, d.n); });
    m.torches.forEach((t2, i) => { if (t2.kind === 'brazier') knock('t' + i, t2, 'brazier'); });
  }
  function hitChests(S, R, x, y, rad, ax, arc) {
    for (const c of R.chests) { if (c.open) continue; const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 16) continue; if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) continue; if (!losClear(R.map, x, y, c.x, c.y)) continue; openChest(S, R, c); } }
  // a secret's fake wall: its foot (s.x, s.y) is the host room's top edge; the blow lands if the wall is in reach and in the arc
  const secretAt = (m, tx, ty) => (m.secrets || []).find((q) => !q.open && q.wall.some(([x, y]) => x === tx && y === ty));
  function hitSecrets(S, R, x, y, rad, ax, arc) {
    for (const q of R.map.secrets || []) { if (q.open) continue; const dx = q.x - x, dy = q.y - (y - 10), d = Math.hypot(dx, dy);
      if (d > rad + 26) continue; if (arc !== undefined && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.35) continue; hitSecret(S, R, q); } }
  function hitSecret(S, R, q) {
    if (S.t - (q.hitT ?? -9) < 0.2) return;
    q.hitT = S.t; q.hp--; R.trauma = Math.min(1, R.trauma + 0.2);
    if (q.hp > 0) { ev(S, { k: 'wallhit', x: q.x, y: q.y - 20, i: R.map.secrets.indexOf(q) }); return; }
    const m = R.map; q.open = 1; q.openT = S.t; for (const [x, y] of q.wall) m.cells[y * m.W + x] = 1;
    for (let i = 0; i < 4; i++) m.decals.push({ x: q.x - 22 + i * 15, y: q.y - 6 - (i % 2) * 22, n: 'dc_rubble', f: i & 1, s: 0.8 + 0.1 * i });
    fstat(R).sec++; R.trauma = Math.min(1, R.trauma + 0.45); R.freeze = Math.max(R.freeze, 0.06);
    ev(S, { k: 'secret', x: q.x, y: q.y - 20, i: m.secrets.indexOf(q) }); R.msg = { s: 'Тайная комната!', t: S.t };
  }
  function openChest(S, R, c) {
    c.open = 1; c.openT = S.t; ev(S, { k: 'chest', x: c.x, y: c.y, tier: c.tier });
    // its items were rolled on entering the floor (they count toward the floor's loot from the start); a chest from an older save rolls now
    const pre = !!c.loot; for (const it of c.loot || chestLoot(R, c)) drop(R, c.x, c.y + 10, { kind: 'item', item: it, pre });
    c.loot = [];
    drop(R, c.x, c.y + 10, { kind: 'gold', n: Math.round((10 + R.floor * 6 + ri(R, 0, 10)) * c.tier) });
  }
  function chestLoot(R, c) { const LT = LOOT.chest[c.tier], out = [];
    for (let i = 0; i < LT.n; i++) out.push(rollItem(R, R.floor, i ? LT.q * 0.8 : LT.q));
    if (rnd(R) < 0.5) out.push(potion('hp_potion')); if (rnd(R) < 0.25) out.push(potion('scroll'));
    for (const it of out) it.id = R.nextId++; return out; }

  // ---------------- the world step (screen 'play') ----------------
  function stepPlay(S, inp, keys) {
    const R = S.run, h = R.hero, m = R.map, t = S.t; R.t = t;
    const st = heroSt(S);
    // mouse → world aim
    const mx = R.cam[0] + inp.px, my = R.cam[1] + inp.py;
    if (h.deadT >= 0) { if (t - h.deadT > 1.6) return endRun(S, 'dead'); stepMonsters(S, R, 0); stepDrops(S, R, false); camera(R, h, 0, 0); return; }
    // reactions keep running during hit-stop; the hero and camera hold
    if (R.freeze > 0) { R.freeze -= DT; stepDrops(S, R, true); return; }
    // ---- input: 8-way run with accel / decel ----
    const ix = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), iy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0), il = Math.hypot(ix, iy) || 1;
    const spd = K.RUN * (1 + st.mspd / 100) * (t - h.atkT < 0.2 ? 0.55 : 1);
    const app = (v, tg) => { const a = (Math.abs(tg) > Math.abs(v) ? K.ACC : K.DEC) * DT; return v < tg ? Math.min(tg, v + a) : Math.max(tg, v - a); };
    h.vx = app(h.vx, ix / il * spd); h.vy = app(h.vy, iy / il * spd);
    h.aim = Math.atan2(my - (h.y - RIG.shoulder + 8), mx - h.x);
    const busy = t - h.atkT < 0.22 || t - h.castT < 0.25;
    const wasBack = h.back;
    if (busy) { h.face = Math.cos(h.aim) >= 0 ? 1 : -1; h.back = Math.sin(h.aim) < -0.5 ? 1 : 0; }
    else if (ix || iy) { if (ix) h.face = ix; h.back = iy < 0 ? 1 : iy > 0 ? 0 : h.back; }
    if (h.back !== wasBack) h.backT = t;
    // dash
    if (keys.Space && h.cd.dash <= t) { const dx = ix || Math.cos(h.aim), dy = ix || iy ? iy : Math.sin(h.aim), d = Math.hypot(dx, dy) || 1;
      h.dashT = t; h.dashX = dx / d; h.dashY = dy / d; h.cd.dash = t + K.DASH_CD; h.ifr = Math.max(h.ifr, t + 0.22); ev(S, { k: 'dash', x: h.x, y: h.y, dx: h.dashX, dy: h.dashY }); }
    const dashing = t - h.dashT < K.DASH_T;
    const mvx = dashing ? h.dashX * K.DASH : h.vx, mvy = dashing ? h.dashY * K.DASH : h.vy;
    const ox = h.x, oy = h.y; const [bx, by] = move(m, h, mvx * DT, mvy * DT, K.R); if (bx) h.vx = 0; if (by) h.vy = 0;
    shove(m, h, K.R, false, solids(R));
    const moved = Math.hypot(h.x - ox, h.y - oy);
    if (moved > 0.02 && !dashing) { const b = Math.floor(h.gp / Math.PI); h.dist += moved; h.gp = (h.gp || 0) + moved / stepLen(Math.abs(h.x - ox) / moved) * Math.PI; if (Math.floor(h.gp / Math.PI) !== b) ev(S, { k: 'step', x: h.x, y: h.y }); }
    // ---- melee: hold LMB ----
    if (inp.press && h.cd.atk <= t) {
      h.patkT = h.atkT; h.patkA = h.atkA; h.atkT = t; h.atkA = h.aim; h.atkHit = 0; h.atkN++; h.cd.atk = t + st.wcd / (1 + st.aspd / 100); h.face = Math.cos(h.aim) >= 0 ? 1 : -1;
      ev(S, { k: 'swing', x: h.x, y: h.y, a: h.aim, n: h.atkN, f: h.face });
    }
    if (h.atkT >= 0 && !h.atkHit && t - h.atkT >= K.HIT) {     // the damage frame: the blade crosses the aim (scene.js swingPose)
      h.atkHit = 1; const arc = st.arc * Math.PI / 180, reach = st.reach;
      for (const e of R.en) { if (e.deadT >= 0) continue; const E = ENEMIES[e.type], dx = e.x - h.x, dy = (e.y - h.y) * 1.25, d = Math.hypot(dx, dy);
        if (d > reach + E.r + K.R) continue; if (d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), h.atkA)) > arc / 2) continue; if (!losClear(m, h.x, h.y, e.x, e.y)) continue;
        const c = rnd(R) * 100 < st.crit; hitEnemy(S, R, e, Math.max(1, Math.round(st.atk * (0.9 + 0.2 * rnd(R)) * (c ? 1.75 : 1) * (h.bless ? 1.2 : 1))), c, h.x, h.y, st.kb); }
      breakPots(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitProps(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitChests(S, R, h.x, h.y, reach + 10, h.atkA, arc); hitSecrets(S, R, h.x, h.y, reach + 10, h.atkA, arc);
    }
    // ---- abilities / potions / interact ----
    if (inp.slot >= 1 && inp.slot <= 3) castAbility(S, R, ABILITIES[inp.slot - 1].id, inp);
    if (inp.rclick) castAbility(S, R, 'fireball', inp);
    if (keys.KeyQ) usePotion(S, R, 'hp_potion');
    if (keys.KeyR) usePotion(S, R, 'mp_potion');
    if (keys.KeyE) interact(S, R);
    // ---- status ----
    const rIn = reveal(R);
    if (m.shop) { const d = Math.hypot(h.x - m.shop.x, h.y - m.shop.y); if (d < 230 && R.shop.away) { R.shop.away = 0; R.shop.greetT = t; } else if (d > 360) R.shop.away = 1; }
    if (rIn === m.start) h.mp = Math.min(st.maxMp, h.mp + st.maxMp * 0.08 * DT);
    if (st.regen && h.hp > 0) h.hp = Math.min(st.maxHp, h.hp + st.regen * DT);
    h.mp = Math.min(st.maxMp, h.mp + (1.2 + st.int * 0.12) * DT);
    if (h.poison > t) { h.hp -= 2.5 * st.resist * DT; if (h.hp <= 1) h.hp = 1; }
    // a fire hex sets the hero alight: a tick every 0.5 s for 3 s, past the invulnerability window like poison, never the killing blow
    if (h.burn > t && t - (h.burnT ?? -9) >= 0.5) { h.burnT = t; const n = Math.max(1, Math.round((2 + 0.4 * R.floor) * st.resist)); h.hp = Math.max(1, h.hp - n); ev(S, { k: 'scorch', x: h.x, y: h.y }); ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n }); }
    if (h.shield > 0 && t > h.shieldUntil) h.shield = 0;
    // spikes: up for 0.7 s of every 2.4 s; a plate is 2×2 cells, feet a little inside its edge count
    const onPlate = (a, tr) => Math.abs(a.x - tr.x) < TILE - 4 && Math.abs(a.y - tr.y) < TILE - 6;
    for (const tr of m.traps) { const ph = ((t / 2.4 + tr.ph) % 1 + 1) % 1, up = ph < 0.29;
      if (up && onPlate(h, tr) && t - h.spikeT > 0.7) { h.spikeT = t; hurtHero(S, R, 9 * (1 + 0.2 * (R.floor - 1)), h.x, h.y - 20); ev(S, { k: 'spike', x: tr.x, y: tr.y }); }
      // the spikes don't care whose feet are on them: lure or knock monsters onto a plate
      if (up) for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && onPlate(e, tr) && t - (e.spikeT ?? -9) > 0.7) {
        e.spikeT = t; hitEnemy(S, R, e, Math.round(9 * (1 + 0.2 * (R.floor - 1))), false, tr.x, tr.y, 0, 'spike'); ev(S, { k: 'spike', x: tr.x, y: tr.y }); } }
    // lava burns whoever stands in it, every half second
    const lavaDmg = 8 * (1 + 0.2 * (R.floor - 1));
    if (onLava(m, h) && t - (h.lavaT ?? -9) >= 0.5) { h.lavaT = t; hurtHero(S, R, lavaDmg * st.resist, h.x, h.y); ev(S, { k: 'scorch', x: h.x, y: h.y }); }
    for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && onLava(m, e) && t - (e.lavaT ?? -9) >= 0.5) {
      e.lavaT = t; hitEnemy(S, R, e, Math.round(lavaDmg * 1.25), false, e.x, e.y, 0, 'fire'); ev(S, { k: 'scorch', x: e.x, y: e.y }); }
    stepProjectiles(S, R);
    stepMonsters(S, R, 1);
    stepDrops(S, R, true);
    // ---- camera: follow + look toward the cursor, spring, clamped to the map ----
    camera(R, h, (inp.px - VIEW.W / 2) * 0.12, (inp.py - VIEW.H / 2) * 0.12);
    R.trauma = Math.max(0, R.trauma - 1.6 * DT);
    if (t - R.saveT > 30) { R.saveT = t; S.saveN++; }
  }
  function camera(R, h, lx, ly) { const tg = [h.x - VIEW.W / 2 + lx, h.y - 30 - VIEW.H / 2 + ly]; clampCam(R, tg);
    for (const i of [0, 1]) { R.camV[i] += (36 * (tg[i] - R.cam[i]) - 12 * R.camV[i]) * DT; R.cam[i] += R.camV[i] * DT; } }
  const solids = (R) => { const out = []; for (const c of R.chests) out.push({ x: c.x, y: c.y, r: 16 }); for (const p of R.pots) if (p.hp > 0) out.push({ x: p.x, y: p.y, r: 11 });
    for (const t2 of R.map.torches) if (t2.kind !== 'wall') out.push({ x: t2.x, y: t2.y, r: t2.kind === 'fire' ? 20 : 12 }); for (const s of R.shrines) out.push({ x: s.x, y: s.y, r: 18 }); for (const d of R.map.decor) if (d.solid) out.push({ x: d.x, y: d.y, r: 18 });
    if (R.map.shop) for (const [x, y] of R.map.shop.solid) out.push({ x, y, r: 18 }); return out; };
  function interact(S, R) {
    const h = R.hero, m = R.map;
    const c = R.chests.find((c2) => !c2.open && Math.hypot(c2.x - h.x, c2.y - h.y) < 56); if (c) { openChest(S, R, c); return; }
    if (atCounter(R)) { openShop(S, R); return; }
    const sh = R.shrines.find((s) => !s.used && Math.hypot(s.x - h.x, s.y - h.y) < 60);
    if (sh) { openAltar(S, R, sh); return; }
    if (Math.hypot(m.exit.x - h.x, m.exit.y - h.y) < 60) {
      if (R.floor === D.FLOORS && R.mode !== 'endless') { if (R.bossDead) { endRun(S, 'win'); } else ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Сначала одолейте Повелителя Демонов' }); return; }
      R.shards += R.floor; S.meta.shards += R.floor; ev(S, { k: 'stairs', x: h.x, y: h.y, n: R.floor, floor: R.floor }); enterFloor(S, R, R.floor + 1); return; }
  }
  // ---------------- dungeon altars: one gift of each tier, paid from the meta bank; one gift per altar ----------------
  // the offer is rolled when the altar is first opened, so a run saved before altars had gifts still gets one
  function openAltar(S, R, sh) {
    if (!sh.gifts) sh.gifts = [1, 2, 3].map((tier) => ({ id: pick(R, D.GIFTS.filter((g) => g.tier === tier)).id, cost: D.giftCost(tier, R.floor) }));
    R.altar = R.shrines.indexOf(sh); S.screen = 'altar'; S.hover = ''; ev(S, { k: 'altar', x: sh.x, y: sh.y });
  }
  function takeGift(S, R, sh, i, x, y) {
    const o = sh.gifts[i], G = D.GIFTS.find((q) => q.id === o.id), h = R.hero;
    if (S.meta.shards < o.cost) { ev(S, { k: 'nope', x, y, s: 'Не хватает осколков душ' }); return; }
    S.meta.shards -= o.cost; sh.used = 1; sh.took = o.id;
    if (o.id === 'bless') h.bless = 1; else { h.perks = h.perks || {}; h.perks[o.id] = (h.perks[o.id] || 0) + 1; }
    const st = heroSt(S); h.hp = st.maxHp; h.mp = st.maxMp;
    ev(S, { k: 'bless', x: sh.x, y: sh.y, id: o.id }); R.msg = { s: G.name + ': ' + G.desc + (o.id === 'bless' ? ' до конца этажа' : ' до конца забега'), t: S.t };
    S.screen = 'play'; S.saveN++;
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
    const n = isCons(it) ? 1 : 0, price = D.sellPrice(it, R.floor), one = n && it.n > 1 ? Object.assign({}, it, { id: R.nextId++, n: 1 }) : it;
    if (n && it.n > 1) it.n--; else h.bag[i] = null;
    h.gold += price; sh.tradeT = S.t; sh.back.push({ it: one, price }); if (sh.back.length > D.SHOP.buyback) sh.back.shift();
    ev(S, { k: 'trade', x: R.map.shop.x, y: R.map.shop.y, n: price, s: 'Продано: ' + itemName(one), rar: one.rar });
  }

  function stepProjectiles(S, R) {
    const m = R.map, h = R.hero;
    for (const p of R.proj) { if (p.dead) continue;
      p.x += p.vx * DT; p.y += p.vy * DT; const age = S.t - p.t0;
      const pc = cell(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)), wall = pc === 0 || pc === 4;
      if (pc === 4 && p.own === 'hero') { const q = secretAt(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)); if (q) hitSecret(S, R, q); }
      let boom = wall || age > p.life;
      if (p.own === 'hero') { for (const e of R.en) if (e.deadT < 0 && Math.hypot(e.x - p.x, e.y - ENEMIES[e.type].h * 0.45 - p.y) < ENEMIES[e.type].r + p.r + 6) { boom = true; break; } }
      else if (inStart(m, Math.floor(p.x / TILE), Math.floor((p.y + 28) / TILE))) boom = true;
      else if (h.deadT < 0 && Math.hypot(h.x - p.x, h.y - 38 - p.y) < 20) { hurtHero(S, R, p.dmg, p.x, p.y, p.k); boom = true; p.onHero = 1; }
      if (boom) { p.dead = 1;
        // the blast spreads from the last open cell: the one it flew into may be the wall itself
        if (p.own === 'hero') { const bx = p.x - p.vx * DT, by = p.y + 20 - p.vy * DT;
          for (const e of R.en) if (e.deadT < 0 && Math.hypot(e.x - p.x, (e.y - ENEMIES[e.type].h * 0.4 - p.y) * 1.2) < 66 + ENEMIES[e.type].r && losClear(m, bx, by, e.x, e.y)) hitEnemy(S, R, e, p.dmg, false, p.x, p.y, 1.2, 'fire');
          breakPots(S, R, bx, by, 50); hitProps(S, R, bx, by, 50); ev(S, { k: 'boom', x: p.x, y: p.y }); R.trauma = Math.min(1, R.trauma + 0.2); }
        else ev(S, { k: 'pop', x: p.x, y: p.y, c: p.k, hero: p.onHero || 0 }); } }
    R.proj = R.proj.filter((p) => !p.dead);
  }
  function stepMonsters(S, R, live) {
    const m = R.map, h = R.hero, t = S.t, htx = Math.floor(h.x / TILE), hty = Math.floor(h.y / TILE), F = flow(m, htx, hty), heroOk = live && h.deadT < 0;
    for (const e of R.en) {
      const E = ENEMIES[e.type];
      if (e.deadT >= 0) continue;
      if (e.burn > t && t - e.burnT >= 0.5) { e.burnT = t; hitEnemy(S, R, e, Math.max(1, Math.round(2 + R.floor)), false, e.x, e.y, 0, 'burn'); if (e.deadT >= 0) continue; }
      // knockback decays
      if (e.kbx || e.kby) { move(m, e, e.kbx * DT, e.kby * DT, E.r, true, !E.ghost); e.kbx *= Math.exp(-10 * DT); e.kby *= Math.exp(-10 * DT); if (Math.abs(e.kbx) + Math.abs(e.kby) < 4) e.kbx = e.kby = 0; }
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy);
      if (e.face !== e.pf) { if (e.pf) e.ft = t; e.pf = e.face; }
      if (e.st === 'idle' || e.st === 'home') {
        if (heroOk && d < 330 && (DG.roomAt(m, h.x, h.y) === e.room || d < 170) && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) { aggroRoom(R, e); ev(S, { k: 'alert', x: e.x, y: e.y - E.h - 8, id: e.id }); if (e.type === 'boss') roar(S, R, e); }
        else { if (e.st === 'idle') idle(m, e, E, t); else goHome(m, e, E, t); continue; } }
      if (!heroOk) { e.vx = e.vy = 0; continue; }
      const inSanct = inStart(m, htx, hty);
      // a committed attack keeps facing its aim: a lunge that carries past the hero must not mirror mid-strike; a hero straight above or below doesn't flip it every frame
      e.face = e.st === 'wind' || e.st === 'strike' ? (Math.cos(e.aimA) >= 0 ? 1 : -1) : Math.abs(dx) > 10 ? (dx > 0 ? 1 : -1) : e.face;
      // a hero out of sight (or behind the sanctuary line) for 4 s is lost: the monster walks back to its post
      if (e.st === 'chase' && E.kind !== 'boss' && e.hx !== undefined) {
        if (d < 420 && !inSanct && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) e.seenT = t;
        else if (t - e.seenT > 4) { e.st = 'home'; e.t0 = t; continue; } }
      if (e.st === 'chase') {
        const reach = E.r + K.R + E.reach;
        if (E.kind === 'boss') { bossThink(S, R, e, d); continue; }
        if (E.kind === 'caster') { const los = losClear(m, e.x, e.y - 20, h.x, h.y - 20);
          if (d < 360 && los && t >= e.cdT && !inSanct) { e.st = 'wind'; e.t0 = t; e.aimA = Math.atan2(h.y - 38 - (e.y - 44), h.x - e.x); continue; }
          const want = d < 170 ? -1 : d > 280 || !los ? 1 : 0; steer(e, E, m, F, want, dx, dy, d, inSanct); }
        else if (d < reach && t >= e.cdT && !inSanct) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = Math.atan2(dy, dx); continue; }
        else steer(e, E, m, F, d < reach * 0.8 ? 0 : 1, dx, dy, d, inSanct);
        move(m, e, e.vx * DT, e.vy * DT, E.r, true);
        const sp = Math.hypot(e.vx, e.vy); e.dist += sp * DT;
      } else if (e.st === 'wind') {
        skid(m, e, E); const w = E.wind * (e.elite ? 0.85 : 1);
        if (t - e.t0 >= w) { e.st = 'strike'; e.t0 = t;
          if (E.kind === 'caster') { const a = e.aimA, fire = R.map.biome === 'lava'; R.proj.push({ id: R.nextId++, k: fire ? 'fire' : 'hex', x: e.x + Math.cos(a) * 18, y: e.y - 44, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, t0: t, life: 2.2, dmg: e.dmg * (fire ? 1.25 : 1), own: 'en', r: 6 });
            ev(S, { k: "eshoot", x: e.x, y: e.y - 44, id: e.id }); }
          else if (E.kind === 'slam') { if (d < 74 + K.R && losClear(m, e.x, e.y, h.x, h.y)) hurtHero(S, R, e.dmg, e.x, e.y); ev(S, { k: 'slam', x: e.x + e.face * 26, y: e.y, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.4); }
          else if (E.kind === 'melee') { const ad = Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)); if (d < E.r + K.R + E.reach * 1.25 && ad < 1.3 && losClear(m, e.x, e.y, h.x, h.y)) hurtHero(S, R, e.dmg, e.x, e.y); ev(S, { k: 'eswing', x: e.x, y: e.y, a: e.aimA, id: e.id }); } }
      } else if (e.st === 'strike') {
        if (E.kind === 'lunge' && t - e.t0 < 0.24) { const a = e.aimA, v = 330 * Math.min(1, (t - e.t0) / 0.05); { e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += v * DT;
            if (!e.hitDone && d < E.r + K.R + 8) { e.hitDone = 1; hurtHero(S, R, e.dmg, e.x, e.y, 'poison'); } } } else skid(m, e, E);
        if (t - e.t0 > (E.kind === 'lunge' ? 0.45 : 0.32)) { e.st = 'chase'; e.cdT = t + E.cd * (0.8 + 0.4 * rnd(R)); e.hitDone = 0; }
      }
    }
    // separation: monsters don't stack
    const live2 = R.en.filter((e) => e.deadT < 0 && e.st !== 'idle');
    for (let i = 0; i < live2.length; i++) for (let j = i + 1; j < live2.length; j++) { const a = live2[i], b = live2[j], ra = ENEMIES[a.type].r + ENEMIES[b.type].r + 4;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < ra && d > 0.01) { const p = (ra - d) * 0.5; move(m, a, -dx / d * p, -dy / d * p, ENEMIES[a.type].r, true); move(m, b, dx / d * p, dy / d * p, ENEMIES[b.type].r, true); } }
    // whatever moved them (walking, knockback, a lunge, the crowd), monsters stand clear of props; a ghost floats through
    { const sol = solids(R); for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost) shove(m, e, ENEMIES[e.type].r, true, sol); }
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
    steer(e, E, m, homeFlow(m, Math.floor(e.hx / TILE), Math.floor(e.hy / TILE)), 1, dx, dy, d, false, 0.6);
    move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += Math.hypot(e.vx, e.vy) * DT;
    if (Math.abs(e.vx) > 6) e.face = e.vx > 0 ? 1 : -1;
  }
  // a monster that stops to attack skids to a halt instead of freezing mid-stride (the rig's gait reads its speed and distance)
  function skid(m, e, E) { const k = Math.exp(-14 * DT); e.vx *= k; e.vy *= k; const v = Math.hypot(e.vx, e.vy); if (v < 1) { e.vx = e.vy = 0; return; } move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += v * DT; }
  function steer(e, E, m, F, want, dx, dy, d, inSanct, kv = 1) {
    let vx = 0, vy = 0;
    if (want !== 0) {
      const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE), here = F[ty * m.W + tx];
      if (want > 0 && d < 140 && losClear(m, e.x, e.y - 6, e.x + dx, e.y + dy - 6) && !inSanct) { vx = dx / d; vy = dy / d; }
      else if (here >= 0) { let best = null;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const j = (ty + ay) * m.W + tx + ax, v = F[j];
          if (v < 0 || (ax && ay && (F[ty * m.W + tx + ax] < 0 || F[(ty + ay) * m.W + tx] < 0))) continue;
          const score = want > 0 ? v : -v; if (!best || score < best[0]) best = [score, ax, ay]; }
        if (best) { const gx = (tx + best[1]) * TILE + TILE / 2 - e.x, gy = (ty + best[2]) * TILE + TILE / 2 + 4 - e.y, gd = Math.hypot(gx, gy) || 1; vx = gx / gd; vy = gy / gd; } }
      else if (d > 0) { vx = dx / d * want; vy = dy / d * want; }
    }
    const sp = E.spd * (e.elite ? 1.1 : 1) * kv, k = 1 - Math.exp(-9 * DT);
    e.vx += (vx * sp - e.vx) * k; e.vy += (vy * sp - e.vy) * k;
  }
  function bossThink(S, R, e, d) {
    const t = S.t, m = R.map, h = R.hero, E = ENEMIES.boss, rage = e.hp < e.max * 0.5;
    if (t < e.cdT) { const F = flow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)); steer(e, E, m, F, d > 80 ? 1 : 0, h.x - e.x, h.y - e.y, d, false); move(m, e, e.vx * DT * (rage ? 1.3 : 1), e.vy * DT * (rage ? 1.3 : 1), E.r, true); e.dist += Math.hypot(e.vx, e.vy) * DT; return; }
    const moves = d < 120 ? ['slam', 'slam', 'volley', 'summon'] : ['volley', 'charge', 'summon', 'volley'];
    e.phase = (e.phase + 1) % 997; const mv = moves[(e.phase * 7 + Math.floor(t)) % moves.length];
    if (mv === 'summon' && R.en.filter((o) => o.summ && o.deadT < 0).length >= 4) { e.cdT = t + 0.5; return; }
    e.st = 'bwind'; e.t0 = t; e.mv = mv; e.aimA = Math.atan2(h.y - e.y, h.x - e.x);
  }
  const roar = (S, R, e) => { ev(S, { k: 'roar', x: e.x, y: e.y - 70, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.6); };
  function stepBossMove(S, R) {
    for (const e of R.en) { if (e.type !== 'boss' || e.deadT >= 0 || e.st !== 'bwind') continue;
      const t = S.t, h = R.hero, m = R.map, rage = e.hp < e.max * 0.5, w = rage ? 0.55 : 0.8, u = t - e.t0;
      if (e.mv === 'charge' && u > w && u < w + 0.6) { move(m, e, Math.cos(e.aimA) * 520 * DT, Math.sin(e.aimA) * 520 * DT, 26, true); if (!e.hitDone && Math.hypot(h.x - e.x, h.y - e.y) < 50) { e.hitDone = 1; hurtHero(S, R, e.dmg * 1.2, e.x, e.y); } }
      if (u >= w && !e.fired) { e.fired = 1;
        if (e.mv === 'slam') { if (Math.hypot(h.x - e.x, h.y - e.y) < 130 && losClear(R.map, e.x, e.y, h.x, h.y)) hurtHero(S, R, e.dmg * 1.3, e.x, e.y); ev(S, { k: 'slam', x: e.x, y: e.y, big: 1, id: e.id }); R.trauma = 1; }
        if (e.mv === 'volley') { const n = rage ? 14 : 10; for (let i = 0; i < n; i++) { const a = e.aimA + (i / n) * Math.PI * 2;
          R.proj.push({ id: R.nextId++, k: 'fire', x: e.x, y: e.y - 60, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, t0: t, life: 2.6, dmg: e.dmg * 0.7, own: 'en', r: 9 }); } roar(S, R, e); }
        if (e.mv === 'summon') { for (let i = 0; i < 2; i++) { const a = rnd(R) * 6.28, x = e.x + Math.cos(a) * 90, y = e.y + Math.sin(a) * 60;
          if (solidAt(m, x, y, true)) continue; const E2 = ENEMIES.skeleton;
          R.en.push({ id: R.nextId++, type: 'skeleton', x, y, vx: 0, vy: 0, hp: E2.hp * 4 * BAL.hp, max: E2.hp * 4 * BAL.hp, dmg: E2.dmg * 2 * BAL.dmg, elite: 0, room: e.room, st: 'chase', t0: t, face: 1, aimA: 0, cdT: t + 1, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: 1, spawnT: t });
          ev(S, { k: 'summon', x, y }); } } }
      if (u > w + (e.mv === 'charge' ? 0.7 : 0.4)) { e.st = 'chase'; e.fired = 0; e.hitDone = 0; e.cdT = t + (rage ? 0.9 : 1.5); } }
  }
  function stepDrops(S, R, live) {
    const h = R.hero;
    for (const p of R.drops) { if (p.got) continue;
      if (p.fly > 0) { p.fly -= DT; p.x += p.vx * DT; p.y += p.vy * DT; p.z = Math.max(0, p.z + p.vz * DT); p.vz -= 900 * DT; if (p.fly <= 0) { p.vx = p.vy = p.vz = 0; p.z = 0; } continue; }
      if (p.vz || p.z > 0) { p.vz -= 900 * DT; p.z = Math.max(0, p.z + p.vz * DT); p.x += p.vx * DT; p.y += p.vy * DT; if (p.z === 0) { p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; if (Math.abs(p.vx) < 5) p.vx = p.vy = 0; } move(R.map, p, 0, 0, 4); }
      if (!live || h.deadT >= 0 || R.t - p.t0 < 0.45) continue;
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (p.tossed) { if (d > 70) p.tossed = 0; continue; }
      if (p.kind !== 'item' && d < 90) { p.x += (h.x - p.x) * Math.min(1, 8 * DT); p.y += (h.y - p.y) * Math.min(1, 8 * DT); }
      if (d < 26) {
        if (p.kind === 'gold') { const n = Math.round(p.n * heroSt(S).gold); h.gold += n; R.goldTot += n; p.got = 1; ev(S, { k: 'gold', x: p.x, y: p.y, n }); }
        else if (p.kind === 'shard') { R.shards += p.n; S.meta.shards += p.n; p.got = 1; ev(S, { k: 'shard', x: p.x, y: p.y, n: p.n, floor: R.floor }); }
        else if (wearIfFree(S, R, p.item)) { p.got = 1; if (p.loot) fstat(R).loot++; ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item), worn: 1 }); }
        else if (bagAdd(R, p.item)) { p.got = 1; if (p.loot) fstat(R).loot++; ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item) }); }
        else if (S.t - (R.fullT || -9) > 2.5) { R.fullT = S.t; ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Инвентарь полон' }); }
      } }
    R.drops = R.drops.filter((p) => !p.got);
  }

  // ---------------- run end / menus ----------------
  function endRun(S, how) {
    const R = S.run; if (!R) return;
    const W2 = runReward(R, how), bonus = W2.base + W2.bonus;
    S.meta.shards += bonus; S.meta.runs = (S.meta.runs || 0) + 1; if (how === 'win') S.meta.wins = (S.meta.wins || 0) + 1;
    S.meta.best = Math.max(S.meta.best || 0, R.floor);
    S.result = { how, floor: R.floor, lvl: R.hero.lvl, kills: R.kills, gold: R.goldTot, shards: R.shards + bonus, found: R.shards, base: W2.base, statBonus: W2.bonus, cap: W2.cap,
      C: W2.C, win: how === 'win' ? REWARD.win : 0, time: R.t };
    S.run = null; S.saved = null; S.screen = how; S.saveN++;
  }
  function startCampaign(S) { const seed = (S.seedBase + S.meta.runs * 7777 + Math.floor(S.t * 1000)) >>> 0; S.run = newRun(S, 'campaign', seed); S.saved = null; S.screen = 'play'; }

  function stepUI(S, inp, keys) {
    const x = inp.px, y = inp.py, click = inp.click;
    if (S.screen === 'menu') {
      const b = D.hitUI(UI.menu(!!S.saved), x, y); S.hover = b ? b.id : '';
      if (click && b && b.on) {
        if (b.id === 'continue') { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; S.run.msg = { s: 'Этаж ' + S.run.floor + ' — ' + D.floorName(S.run.floor), t: S.t }; }
        if (b.id === 'campaign') startCampaign(S);
        if (b.id === 'meta') S.screen = 'meta';
        ev(S, { k: 'ui', x, y });
      }
      if (keys.Enter) { if (S.saved) { S.t = Math.max(S.t, S.saved.t || 0) + DT; S.run = S.saved; S.screen = 'play'; } else startCampaign(S); }
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
      const b = D.hitUI(UI.pause(), x, y); S.hover = b ? b.id : '';
      if (keys.Escape || (click && b && b.id === 'resume')) { S.screen = 'play'; return; }
      if (click && b && b.id === 'save') { S.saved = S.run; S.run = null; S.screen = 'menu'; S.saveN++; return; }
      if (click && b && b.id === 'abandon') { endRun(S, 'dead'); return; }
      return;
    }
    if (S.screen === 'dead' || S.screen === 'win') {
      const b = D.hitUI(UI.end(), x, y); S.hover = b ? b.id : '';
      if (click && b) { if (b.id === 'menu') S.screen = 'menu'; else startCampaign(S); }
      return;
    }
    if (S.screen === 'altar') {
      const R = S.run, sh = R.shrines[R.altar], U = UI.altar(), b = D.hitUI(U.r, x, y); S.hover = b ? b.id : '';
      if (!sh || sh.used || keys.Escape || keys.KeyE || (click && b && b.id === 'leave')) { S.screen = 'play'; return; }
      if (click && b && b.id.startsWith('gift:')) takeGift(S, R, sh, b.i, x, y);
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
      if (click && b.id.startsWith('eq:')) { const it = h.eq[b.slot]; if (it && bagAdd(R, it)) { h.eq[b.slot] = null; const st = heroSt(S); h.hp = Math.min(h.hp, st.maxHp); h.mp = Math.min(h.mp, st.maxMp); } }
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
    rebalanceRun(S.run); rebalanceRun(S.saved); if (S.run && S.run.map) fstat(S.run);
    const t = S.t + DT; S.t = t;
    const keys = {}; for (const k of inp.keys || []) keys[k] = 1;
    if (S.screen === 'play' && S.run) {
      if (keys.Escape && !S.demo) { S.screen = 'pause'; }
      else if ((keys.KeyI || keys.KeyC || keys.Tab) && !S.demo) { S.screen = 'inv'; }
      else { stepPlay(S, inp, keys); if (S.run) stepBossMove(S, S.run); }
    } else stepUI(S, inp, keys);
    if (S.ev.length > 64) S.ev.splice(0, S.ev.length - 64);
    S.steps++; return S;
  }

  // ---------------- attract bot: walk to the nearest monster through the flow field, swing, throw fire ----------------
  function scriptInput(t, S) {
    const inp = { left: 0, right: 0, up: 0, down: 0, press: 0, click: 0, rclick: 0, px: VIEW.W / 2, py: VIEW.H / 2, keys: [], slot: 0 };
    const R = S.run; if (!R) return inp; const h = R.hero, m = R.map;
    let tg = null, td = 1e9; for (const e of R.en) { if (e.deadT >= 0) continue; const d = Math.hypot(e.x - h.x, e.y - h.y); if (d < td) { td = d; tg = e; } }
    if (!tg) return inp;
    inp.px = tg.x - R.cam[0]; inp.py = tg.y - 30 - R.cam[1];
    const reach = 46 + ENEMIES[tg.type].r;
    if (td > reach - 6) {
      const F = flow(m, Math.floor(tg.x / TILE), Math.floor(tg.y / TILE), 1), tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
      let gx = tg.x - h.x, gy = tg.y - h.y;
      if (td > 120 || !losClear(m, h.x, h.y - 6, tg.x, tg.y - 6)) { let best = null;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = F[(ty + ay) * m.W + tx + ax]; if (v >= 0 && (!best || v < best[0])) best = [v, ax, ay]; }
        if (best) { gx = (tx + best[1]) * TILE + 16 - h.x; gy = (ty + best[2]) * TILE + 18 - h.y; } }
      if (Math.abs(gx) > 5) inp[gx > 0 ? 'right' : 'left'] = 1; if (Math.abs(gy) > 5) inp[gy > 0 ? 'down' : 'up'] = 1;
    } else inp.press = 1;
    if (td < 330 && td > 140 && h.cd.fireball <= S.t && h.mp > 30) inp.slot = 2;
    if (h.hp < 40) inp.keys.push('KeyQ');
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
  // level data checks for tune.cjs: every floor of several seeds — spawns on open floor and outside the sanctuary, exit reachable
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
      for (let lvl = 1; lvl <= D.FLOORS; lvl++) for (let i = 0; i < 100; i++) {
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
    for (const seed of [1, 77, 4242, 90001]) for (let f = 1; f <= D.FLOORS; f++) { const m = DG.genFloor(seed * 31 + f * 1013, f);
      const F = flow(m, Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE));
      const reachH = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return cell(m, tx, ty) === 1; };
      if (!reachH(m.spawn.x, m.spawn.y)) out.push(`seed ${seed} f${f}: spawn blocked`);
      for (const e of m.enemies) { if (!reachH(e.x, e.y)) out.push(`seed ${seed} f${f}: ${e.type} spawns in rock`); if (inStart(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) out.push(`seed ${seed} f${f}: ${e.type} in the sanctuary`); }
      for (const c of m.chests) if (!reachH(c.x, c.y)) out.push(`seed ${seed} f${f}: chest in rock`);
      // bulky props (chests, tables, coffins, statues…) read wider than their cell: two of them never share a cell edge or corner
      { const big = m.chests.map((c) => [c.x, c.y, 'chest']).concat(m.decor.filter((d) => (d.solid || d.n === 'table') && !d.wall).map((d) => [d.x, d.y, d.n]), m.torches.filter((t) => t.kind === 'brazier').map((t) => [t.x, t.y, 'brazier']), m.shrines.map((t) => [t.x, t.y, 'altar']));
        // the shop is one built piece: its shelves, sacks and barrel close the space behind the counter on purpose
        for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) { const [ax, ay, an] = big[i], [bx, by, bn] = big[j]; if (an.startsWith('shop_') && bn.startsWith('shop_')) continue;
          if (Math.abs(Math.floor(ax / TILE) - Math.floor(bx / TILE)) <= 1 && Math.abs(Math.floor(ay / TILE) - Math.floor(by / TILE)) <= 1) out.push(`seed ${seed} f${f}: ${an} crowds ${bn}`); }
        for (const r of m.rooms) { const n = m.chests.filter((c) => DG.roomAt(m, c.x, c.y) === r.id).length; if (n > 1 + Math.floor(r.w * r.h / 30)) out.push(`seed ${seed} f${f}: ${n} chests in a ${r.w}×${r.h} room`); } }
      // decor never wears an interactive object's sprite: a dead altar or chest reads as one already used
      for (const d of m.decor) if (['altar', 'chest', 'chest_open', 'pot', 'stairs', 'treasure'].includes(d.n)) out.push(`seed ${seed} f${f}: decor uses the ${d.n} sprite`);
      // spike plates (2×2 cells) keep clear of corridor mouths and never wall off floor: walking around every plate reaches
      // everything walking over them would
      { const tc = new Set(); for (const tr of m.traps) for (let j = -1; j <= 0; j++) for (let i = -1; i <= 0; i++) tc.add((Math.floor(tr.y / TILE) + j) * m.W + Math.floor(tr.x / TILE) + i);
        const inR = (x, y) => m.rooms.some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
        for (const k of tc) { const x = k % m.W, y = Math.floor(k / m.W); if (cell(m, x, y) !== 1) out.push(`seed ${seed} f${f}: spike plate off the floor`);
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, x + i, y + j) === 1 && !inR(x + i, y + j)) out.push(`seed ${seed} f${f}: spike plate at a corridor mouth`); }
        const fill = (skip) => { const seen = new Uint8Array(m.W * m.H), st = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; seen[st[0]] = 1;
          while (st.length) { const k = st.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!seen[n] && cell(m, n % m.W, Math.floor(n / m.W)) === 1 && !m.block.includes(n) && !skip.has(n)) { seen[n] = 1; st.push(n); } } } return seen; };
        for (const e of m.enemies) if (tc.has(Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE))) out.push(`seed ${seed} f${f}: ${e.type} posted on a spike plate`);
        const a = fill(new Set()), b = fill(tc); for (let k = 0; k < a.length; k++) if (a[k] && !b[k] && !tc.has(k)) { out.push(`seed ${seed} f${f}: spike plates cut off floor`); break; } }
      const ex = DG.genFloor; void ex; void F;
      // exit reachable from the spawn over floor (ignoring the sanctuary rule, which only binds monsters)
      const seen = new Uint8Array(m.W * m.H), st = [[Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE)]]; let ok = false;
      while (st.length) { const [x, y] = st.pop(); if (x === m.exit.tx && y === m.exit.ty) { ok = true; break; }
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (cell(m, nx, ny) === 1 && !seen[ny * m.W + nx]) { seen[ny * m.W + nx] = 1; st.push([nx, ny]); } } }
      if (!ok) out.push(`seed ${seed} f${f}: exit unreachable`);
      // a merchant on every floor: his counter's front is reachable on foot, his room holds no monster post
      if (!m.shop) out.push(`seed ${seed} f${f}: no merchant`);
      else { const fx = Math.floor(m.shop.front.x / TILE), fy = Math.floor(m.shop.front.y / TILE), sn = new Uint8Array(m.W * m.H), q2 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)];
        while (q2.length) { const k = q2.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sn[n] && cell(m, n % m.W, Math.floor(n / m.W)) === 1 && !m.block.includes(n)) { sn[n] = 1; q2.push(n); } } }
        if (!sn[fy * m.W + fx]) out.push(`seed ${seed} f${f}: the merchant's counter can't be reached`);
        for (const e of m.enemies) if (e.room === m.shop.room || inStart(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) out.push(`seed ${seed} f${f}: ${e.type} posted in a ward`);
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
      if ((!m.secrets.length && f !== D.FLOORS) || m.secrets.length > 10) out.push(`seed ${seed} f${f}: ${m.secrets.length} secret rooms`);
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
          if (m.torches.some((t) => t.r === r.id && t.sec !== i)) out.push(`seed ${seed} f${f}: a torch lights secret ${i} before it is found`); }); }
      // every floor cell of every room lies within reach of a light: a torch, a brazier, candles, a crystal, an altar, the bonfire or a shop lamp
      { const LR = DG.LIGHT_R, lights = m.torches.map((t) => [t.x, t.y, LR[t.kind]]).concat(m.decor.filter((d) => LR[d.n]).map((d) => [d.x, d.y, LR[d.n]]),
          m.shrines.map((s) => [s.x, s.y, LR.shrine]), m.shop.lanterns.map((q) => [q.x, q.y, LR.wall]), [[m.shop.x, m.shop.y, LR.fire]]);
        for (const r of m.rooms) { let dark = 0;
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (cell(m, x, y) === 1 && !lights.some(([lx, ly, lr]) => Math.hypot(lx - (x + 0.5) * TILE, (ly - (y + 0.5) * TILE - 6) / 0.8) <= lr * TILE)) dark++;
          if (dark) out.push(`seed ${seed} f${f}: ${dark} dark cells in ${r.type} room ${r.id} (${r.w}×${r.h})`); } } }
    // a saved run loaded into a fresh session must play at once (cooldowns and timers are absolute times)
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 120 * 40; i++) step(S, scriptInput(S.t, S));
      const T = spawn(0, { run: JSON.parse(JSON.stringify(S.run)) }); T.screen = 'play'; T.run = T.saved; for (let i = 0; i < 240; i++) step(T, { press: 1, px: 1000, py: 500, keys: [] });
      if (!T.ev.some((e) => e.k === 'swing')) out.push('a loaded save cannot attack (clock behind the saved timers)'); }
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
      const R = S.run, h = R.hero, m = R.map, e = R.en.find((o) => o.type !== 'boss' && !ENEMIES[o.type].ghost && ENEMIES[o.type].kind !== 'caster'); R.en = [e];
      for (let i = 0; i < 120 * 20; i++) step(S, { keys: [] });
      if (Math.hypot(e.x - e.hx, e.y - e.hy) > 24) out.push('an idle monster wandered off its post');
      const hx = e.hx, hy = e.hy; h.ifr = 1e9; h.x = e.x + 60; h.y = e.y; aggroRoom(R, e); h.x = m.spawn.x; h.y = m.spawn.y;
      let gaveUp = 0; for (let i = 0; i < 120 * 45 && e.st !== 'idle'; i++) { if (e.st === 'chase' && i % 60 === 0) { h.x = m.spawn.x; h.y = m.spawn.y; } step(S, { keys: [] }); gaveUp |= e.st === 'home'; }
      if (!gaveUp) out.push('a monster never gives up a hero hiding in the sanctuary');
      else if (e.st !== 'idle' || Math.hypot(e.x - hx, e.y - hy) > 16) out.push(`a monster that lost the hero did not walk back to its post (${e.st}, ${Math.round(Math.hypot(e.x - hx, e.y - hy))} px off)`); }
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
      const R = S.run; enterFloor(S, R, D.FLOORS); const b = R.en.find((e) => e.type === 'boss'), h = R.hero; R.en = [b]; h.x = b.x; h.y = b.y + 160; h.ifr = 1e9;
      for (let i = 0; i < 60; i++) step(S, { keys: [] }); if (!S.ev.some((e) => e.k === 'roar')) out.push('the boss does not roar when he first sees the hero'); }
    // hero blows stop at walls: across a thin wall a monster takes no damage from a swing, the whirl or a fireball's blast,
    // and the same setup with the wall dug out does hit (so the check really reaches it)
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero; let spot = null;
      for (let f = 1; f <= D.FLOORS && !spot; f++) { enterFloor(S, R, f); const m = R.map;
        for (let ty = 1; ty < m.H - 4 && !spot; ty++) for (let tx = 1; tx < m.W - 1 && !spot; tx++) for (const k of [1, 2]) {
          const below = ty + k + 1, ok = (x, y) => cell(m, x, y) === 1 && !inStart(m, x, y);
          if (ok(tx, ty) && ok(tx - 1, ty) && ok(tx + 1, ty) && ok(tx, below) && ok(tx - 1, below) && ok(tx + 1, below) && [...Array(k)].every((_, i) => cell(m, tx, ty + 1 + i) === 0)) { spot = { tx, ty, k, below }; break; } } }
      if (!spot) out.push('wall check: no thin wall between two floors');
      else { const m = R.map, cells = m.cells.slice(), dig = (on) => { for (let i = 0; i < spot.k; i++) m.cells[(spot.ty + 1 + i) * m.W + spot.tx] = on ? 1 : cells[(spot.ty + 1 + i) * m.W + spot.tx]; };
        const type = Object.keys(ENEMIES).find((q) => ENEMIES[q].kind === 'melee' && !ENEMIES[q].ghost);
        const trial = (how, open) => { dig(open); R.proj = []; R.pots = []; R.chests = []; R.drops = [];
          const e = { id: R.nextId++, type, x: (spot.tx + 0.5) * TILE, y: spot.below * TILE + 6, hp: 1e6, max: 1e6, dmg: 0, st: 'idle', deadT: -1, room: -1, t0: S.t, kbx: 0, kby: 0 };
          R.en = [e]; h.x = (spot.tx + 0.5) * TILE; h.y = (spot.ty + 1) * TILE - 6; h.vx = h.vy = 0; h.mp = 999; h.ab.fireball = 1; h.ifr = 1e9;
          for (const k in h.cd) h.cd[k] = 0; h.atkT = -9; const aim = () => ({ keys: [], px: e.x - R.cam[0], py: e.y - 30 - R.cam[1] });
          step(S, aim()); if (how === 'whirl') castAbility(S, R, 'whirl', {}); if (how === 'fire') step(S, Object.assign(aim(), { rclick: 1 }));
          for (let i = 0; i < 120; i++) { e.x = (spot.tx + 0.5) * TILE; e.y = spot.below * TILE + 6; e.st = 'idle'; h.x = (spot.tx + 0.5) * TILE; h.y = (spot.ty + 1) * TILE - 6; step(S, Object.assign(aim(), { press: how === 'swing' && i < 30 ? 1 : 0 })); }
          dig(false); return e.hp < e.max; };
        for (const how of ['swing', 'whirl', 'fire']) { const open = trial(how, true), shut = trial(how, false);
          if (shut) out.push(`a hero ${how} hits a monster through a wall`); else if (!open && how !== 'swing') out.push(`wall check: the ${how} misses even with the wall dug out`); } } }
    // monsters stand clear of solid props: at every post, and when knocked into a chest or chasing the hero straight across one
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, m = R.map, inside = (e) => !ENEMIES[e.type].ghost && e.deadT < 0 && solids(R).some((o) => Math.hypot(e.x - o.x, (e.y - o.y) * 1.6) < o.r + ENEMIES[e.type].r - 1);
      for (let f = 1; f <= D.FLOORS; f++) { enterFloor(S, R, f); const e = R.en.find(inside); if (e) { out.push(`floor ${f}: a ${e.type} is posted inside a prop`); break; } }
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
    // the shop is warded like the sanctuary: a monster chasing the hero stops at its line
    { const S = spawn(0, {}); step(S, { keys: [], px: 960, py: 598, click: 1 }); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, m = R.map, r = m.rooms[m.shop.room], e = R.en.find((o) => !ENEMIES[o.type].ghost && ENEMIES[o.type].kind === 'melee');
      const mouth = []; for (let y = r.y - 2; y <= r.y + r.h + 1; y++) for (let x = r.x - 2; x <= r.x + r.w + 1; x++) if (cell(m, x, y) === 1 && !inRoom1(r, x, y) && DG.roomAt(m, x * TILE, y * TILE) < 0) mouth.push([x, y]);
      R.en = [e]; Object.assign(e, { x: mouth[0][0] * TILE + 16, y: mouth[0][1] * TILE + 18, hp: 1e4, max: 1e4, dmg: 0, st: 'idle' }); h.ifr = 1e9;
      h.x = m.shop.front.x; h.y = m.shop.front.y + 20; aggroRoom(R, e); let inside = 0;
      for (let i = 0; i < 120 * 6; i++) { h.x = m.shop.front.x; h.y = m.shop.front.y + 20; step(S, { keys: [] }); if (DG.roomAt(m, e.x, e.y) === r.id) inside = 1; }
      if (inside) out.push('a monster walked into the warded shop'); }
    return out.concat(secretCheck(), propCheck());
  }
  // a table stops the hero walking into it; a blow on it (or on a brazier) knocks once per swing and carries its material
  function propCheck() {
    const out = []; let S = null, d = null, di = -1;
    for (let sd = 1; sd < 80 && !d; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', 7000 + sd); const m = S.run.map;
      di = m.decor.findIndex((o) => { const x = Math.floor(o.x / TILE), y = Math.floor(o.y / TILE); return o.n === 'table' && [1, 2].every((k) => cell(m, x - k, y) === 1 && !m.block.includes(y * m.W + x - k)); }); d = m.decor[di]; }
    if (!d) return ['prop check: no table with open floor on its left in 80 seeds'];
    S.screen = 'play'; const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9;
    if (!d.solid) out.push('prop check: a table is not solid');
    const A = () => ({ px: d.x - R.cam[0], py: d.y - 30 - R.cam[1] });
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
  // a run snapshot for localStorage (the whole run is plain JSON)
  // secrets, loot tables and completion stats, played through the sim
  function secretCheck() {
    const out = [];
    // every side a secret can sit on: two blows from the floor in front of it open it, once; its chest's items count as loot
    // only once picked up, and an item thrown away and picked up again never counts twice
    for (const dir of ['u', 'd', 'l', 'r']) { let S = null, q = null;
      for (let sd = 1; sd < 80 && !q; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', 5000 + sd); q = S.run.map.secrets.find((o) => o.dir === dir); }
      if (!q) { out.push(`secret check: no secret on the ${dir} side in 80 seeds`); continue; }
      S.screen = 'play'; const R = S.run, m = R.map, h = R.hero, qi = m.secrets.indexOf(q), hp = q.hp; R.en = []; R.stats[1] = floorStat(R);
      const at0 = () => { h.x = q.x - q.dx * 40; h.y = q.y - q.dy * 40 + (q.dx ? 0 : 0); h.vx = h.vy = 0; }, aim = { px: q.x + q.dx * 30 - R.cam[0], py: q.y + q.dy * 30 - 30 - R.cam[1] };
      h.ifr = 1e9; const swing = () => { at0(); h.cd.atk = 0; const A = { px: q.x + q.dx * 30 - R.cam[0], py: q.y + q.dy * 30 - 30 - R.cam[1] };
        step(S, Object.assign({ press: 1, keys: [] }, A)); for (let k = 0; k < 40; k++) { at0(); step(S, Object.assign({ keys: [] }, { px: q.x + q.dx * 30 - R.cam[0], py: q.y + q.dy * 30 - 30 - R.cam[1] })); } };
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
      if (W2.cap !== REWARD.perFloor * 2 || W2.bonus !== Math.round(W2.C.pct * W2.cap)) out.push('completion: bonus not explained by its formula');
      const L2 = spawn(0, {}); L2.saved = JSON.parse(JSON.stringify(R)); delete L2.saved.stats; L2.run = L2.saved; L2.screen = 'play'; step(L2, { keys: [] });
      if (!L2.run.stats || L2.run.stats[2].foes !== L2.run.en.filter((o) => !o.summ).length) out.push('completion: an old save gets no stats for its floor'); }
    // altars: E offers one gift per tier at rising prices; too few shards refuse and take nothing; a gift takes its price, lands
    // on the hero, heals, closes the screen and darkens the altar for good, and survives save/load
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero;
      for (let f = 1; !R.shrines.length && f < D.FLOORS; ) enterFloor(S, R, ++f);
      if (!R.shrines.length) out.push('altar: no altar on any floor of seed 777');
      else { const sh = R.shrines[0], tier = (o) => D.GIFTS.find((q) => q.id === o.id).tier; R.en = []; h.x = sh.x; h.y = sh.y + 40; step(S, { keys: ['KeyE'] });
        if (S.screen !== 'altar' || !sh.gifts || sh.gifts.map(tier).join() !== '1,2,3' || !(sh.gifts[0].cost < sh.gifts[1].cost && sh.gifts[1].cost < sh.gifts[2].cost)) out.push('altar: E does not offer one gift per tier at rising prices');
        const U = UI.altar(), at = (i) => ({ px: U.r[i].x + 5, py: U.r[i].y + 5, click: 1, keys: [] }), o = sh.gifts[2];
        o.id = 'fury'; S.meta.shards = o.cost - 1; const a0 = heroSt(S).atk; step(S, at(2));
        if (S.meta.shards !== o.cost - 1 || sh.used || S.screen !== 'altar') out.push('altar: a gift went through without enough shards');
        S.meta.shards = o.cost + 3; h.hp = 1; step(S, at(2));
        if (S.meta.shards !== 3 || !sh.used || S.screen !== 'play' || heroSt(S).atk <= a0 || h.hp !== heroSt(S).maxHp) out.push('altar: a gift did not take its price, apply, heal or close');
        step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); if (S.screen === 'altar') out.push('altar: a used altar opens again');
        const T = spawn(0, { meta: S.meta, run: JSON.parse(JSON.stringify(R)) }); if (stats(T.saved.hero, T.meta).atk !== heroSt(S).atk) out.push('altar: a gift is lost on save/load');
        const old = spawn(0, { meta: S.meta, run: JSON.parse(JSON.stringify(R)) }); delete old.saved.hero.perks; if (!(stats(old.saved.hero, old.meta).atk > 0)) out.push('altar: a save without gifts breaks the stats'); } }
    // the new meta perks reach a new hero: heirloom gear a rarity up with its affixes, skill points, mana, regeneration, resistance
    { const up = { gear: 2, skill: 2, mana: 3, regen: 2, resist: 3 }, S = spawn(0, { meta: { shards: 0, up } }), R = newRun(S, 'campaign', 777), h = R.hero, st = stats(h, S.meta);
      const R0 = newRun(spawn(0, {}), 'campaign', 777), st0 = stats(h, { up: {} });
      if (h.eq.weapon.rar !== 2 || h.eq.armor.rar !== 2 || h.eq.weapon.atk <= R0.hero.eq.weapon.atk || Object.keys(h.eq.armor.mods).length !== RARITY[2].affixes) out.push('meta: heirloom gear is not a rarity up');
      if (h.sp !== 2 || st.maxMp !== st0.maxMp + 30 || st.regen !== st0.regen + 1 || Math.abs(st.resist - 0.55) > 1e-9) out.push('meta: skill, mana, regen or resist perk does not apply'); }
    return out;
  }
  const persist = (S) => ({ meta: S.meta, run: S.run || S.saved || null });

  root.SIM = { DT, L, K, VIEW, HINT, RIG, create, spawn, respawn, outOfPlay, step, at, scriptInput, demoCheck, selfCheck, persist,
    stepLen, stats, gift, itemName, hitSecret, hitProps, secretMask, hidden, fstat, completion, runCompletion, runReward, REWARD, LOOT, itemIcon, itemMods, typeMods, isCons, hand, rollItem, newRun, enterFloor, cell, flow, atCounter };
  if (typeof module !== 'undefined') module.exports = root.SIM;
})(typeof window !== 'undefined' ? window : globalThis);
