// live/sim_items.js — items: power, affixes, names, icons, the hero's stats from base + gear + meta + gifts; loot dropped on the floor.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const {
    AFFIXES, BAL, BASES, CONSUMABLES, D, DT, RARITY, RUN, TILE, ev, move, rnd } = SIMX;
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
  // a run saved before the classes (TASKS 1100): its hero is a warrior holding the old fireball and shield ranks. What he put into abilities
  // he no longer has comes back as points, and his own open at the level he has reached (PR 36 review: a level-up would never give them)
  function migrateAbilities(R) { const h = R && R.hero; if (!h || !h.ab) return; const C = D.clsOf(h), own = new Set(C.abs.map((a) => a.id));
    for (const id of Object.keys(h.ab)) if (!own.has(id)) { h.sp = (h.sp || 0) + Math.max(0, h.ab[id] - 1); delete h.ab[id]; }
    for (const a of C.abs) if (a.unlock <= h.lvl && !h.ab[a.id]) h.ab[a.id] = 1;
    D.masteryTake(h);
    if (C.res === 'rage') h.mp = Math.min(h.mp || 0, D.RAGE.max); }
  function rebalanceRun(R) {
    if (R) SIMX.migrateTown(R);
    migrateAbilities(R);
    if (!R || R.itemBalance === D.ITEM_BAL.version) return;
    const items = Object.values(R.hero.eq).concat(R.hero.bag, (R.drops || []).map((d) => d.item),
      R.shop ? R.shop.goods.concat(R.shop.back).map((g) => g.it) : []);
    for (const it of items) if (it && BASES[it.b]) itemPower(it);
    R.itemBalance = D.ITEM_BAL.version;
  }
  // o.own: only the hero's class, for what he is sold or handed (TASKS 1158); a find keeps the foreign share
  function rollItem(R, floor, q = 0, slotOnly, o = {}) {
    const lo = o.min || 0, hi = o.max ?? 4, w = [60, 26, 10, 3.5, 0.5].map((v, i) => (i < lo || i > hi ? 0 : v * (i ? Math.pow(1 + 0.22 * floor + 0.6 * q, i * 0.9) : 1) * (i === 4 ? o.leg ?? 1 : 1)));
    let s = w.reduce((a, b) => a + b, 0) * rnd(R), rar = lo; while (rar < hi && (s -= w[rar]) > 0) rar++;
    const keys = Object.keys(BASES).filter((k) => (!BASES[k].minF || floor >= BASES[k].minF) && (!slotOnly || BASES[k].slot === slotOnly));
    const pick = (ks) => { let s2 = ks.reduce((a, k) => a + (BASES[k].w ?? 1), 0) * rnd(R), bk = ks[ks.length - 1];
      for (const k of ks) if ((s2 -= BASES[k].w ?? 1) < 0) { bk = k; break; } return bk; };
    let bk = pick(keys);
    // most of what a hero finds is of his class (TASKS 1102): a foreign base is kept at CLASS_LOOT.foreign, else rolled among his own
    const cls = R.hero && D.clsOf(R.hero).id;
    if (cls && !D.wears(cls, bk) && (o.own || rnd(R) >= D.CLASS_LOOT.foreign)) { const own = keys.filter((k) => D.wears(cls, k)); if (own.length) bk = pick(own); }
    return rollAffixes(R, itemPower({ id: 0, b: bk, rar, lvl: lootLvl(R, floor + (R.mode ? RUN(R).loot || 0 : 0), o), mods: {} }));
  }
  // a find's level (the player's note 5.10, TASKS 1345): half way from the floor to a hero who has outgrown it, spread by the source's lo/hi,
  // and never more than the source's `lag` under him; shop stock and rewards name no spread and stay at the floor's own level
  function lootLvl(R, base, o) { if (o.hi === undefined) return base; const h = R.hero, a = base + (h ? Math.round(0.5 * Math.max(0, h.lvl - base)) : 0);
    const lvl = Math.max(1, a - o.lo + Math.floor(rnd(R) * (o.lo + o.hi + 1)), h ? h.lvl - o.lag : 1); if (!h) return lvl;
    // a find above the hero (the player's note 5.7, TASKS 1347): likelier the further he runs ahead of his level, its bonus capped at `up`
    const O = D.LOOT_OVER, gap = Math.max(0, base - h.lvl); if (rnd(R) >= Math.min(O.cap, O.base + O.per * gap)) return lvl;
    return Math.max(lvl, h.lvl) + 1 + Math.floor(rnd(R) * Math.min(O.up, 2 + gap)); }
  function rollAffixes(R, it) {
    const pool = D.liveFor(R.hero, 'mods', AFFIXES, (a) => a.k), W = D.AFFIX_W[BASES[it.b].slot] || {}, wt = (a) => W[a.k] ?? 1;
    for (let i = 0; i < RARITY[it.rar].affixes && pool.length; i++) { let s = pool.reduce((n, a) => n + wt(a), 0) * rnd(R), j = pool.length - 1;
      for (let q = 0; q < pool.length; q++) if ((s -= wt(pool[q])) < 0) { j = q; break; }
      const a = pool.splice(j, 1)[0];
      it.mods[a.k] = Math.max(1, Math.round((a.a + a.b * it.lvl) * (0.7 + 0.6 * rnd(R)) * (1 + 0.15 * it.rar))); }
    return it;
  }
  const useless = (R, b) => D.clsOf(R.hero).dead.cons.includes(b);
  const potion = (b, n = 1) => ({ id: 0, b, n, rar: 0, lvl: 1, mods: {} });
  const isCons = (it) => !!CONSUMABLES[it.b];
  const itemName = (it) => (isCons(it) ? CONSUMABLES[it.b].name : it.rar === 4 ? (D.LEGEND_NAMES[it.b] || D.LEGEND_NAMES[BASES[it.b].slot]) : BASES[it.b].name);
  const gearName = (it) => it ? TXT('sim_items.gearName', { p1: itemName(it), name: RARITY[it.rar].name, lvl: it.lvl }) : null;
  const itemIcon = (it) => (isCons(it) ? CONSUMABLES[it.b].icon : BASES[it.b].icon);

  // the good gear comes from the strong: common monsters drop little and never a legendary; elites, the exit room's brute and
  // the boss drop better; a chest's roll is open, but a secret room's chest rolls with a far higher epic/legendary chance
  const LOOT = {
    // fewer finds and better ones (the player's notes 5.9, 5.10, TASKS 1346): `thin` lowers a common monster's chance with depth, where the bag filled
    // fastest; p: an elite's chance of any drop; leg: the legendary's odds at this source, an elite's below a secret room's. Plain chests stop at epic
    thin: (f) => Math.max(0.6, 1 - 0.02 * (f - 1)),
    mob: { p: 0.05, q: 0.3, max: 3, lo: 2, hi: 1, lag: 3 },
    elite: { p: 0.75, q: 2, min: 1, leg: 0.35, lo: 1, hi: 2, lag: 2 },
    brute: { q: 2.8, min: 2, extra: 0.3, leg: 0.5, lo: 1, hi: 2, lag: 2 },
    boss: [{ q: 3, min: 4, lo: 0, hi: 3, lag: 1 }, { q: 3, min: 3, lo: 0, hi: 3, lag: 1 }, { q: 3, min: 2, lo: 0, hi: 3, lag: 1 }],
    // chest p (TASKS 1671): a plain or hoard chest may hold only its gold, so with the monsters' drops a floor fills the 24 cells at most about once;
    // the top tier always pays, as a secret room or a key was its price
    chest: [null, { q: 0.6, n: 1, p: 0.2, max: 3, lo: 1, hi: 2, lag: 2 }, { q: 1.3, n: 1, p: 0.4, max: 3, lo: 1, hi: 2, lag: 2 }, { q: 3, n: 1, lo: 0, hi: 3, lag: 1 }],
  };

  // ---------------- hero stats (base + gear + meta + the altars' gifts) ----------------
  const GIFT_V = Object.assign({ greed: 25 }, Object.fromEntries(D.GIFTS.map((g) => [g.id, g.v])));
  const gift = (h, id) => ((h.perks || {})[id] || 0) * GIFT_V[id];
  function stats(h, meta) {
    const s = { str: h.base.str, agi: h.base.agi, int: h.base.int, vit: h.base.vit, atk: 0, def: 0, crit: 0, critd: 0, hp: 0, mp: 0, aspd: 0, mspd: 0, leech: 0, fire: 0, regen: 0, onhit: 0, dodge: 0 };
    let wpn = null;
    for (const k in h.eq) { const it = h.eq[k]; if (!it) continue; if (k === 'weapon') wpn = it; s.def += it.def || 0; const mods = itemMods(it); for (const m in mods) s[m] = (s[m] || 0) + mods[m]; }
    const up = (meta && meta.up) || {}, G = D.clsOf(h).grow, IK = D.clsOf(h).intK || { spell: 0, hp: 0 }, W = wpn ? BASES[wpn.b] : { atk: 3, spd: 0.45, arc: 110, reach: 51 };
    const out = {
      str: s.str, agi: s.agi, int: s.int, vit: s.vit,
      maxHp: Math.round((80 + s.vit * 10 + (h.lvl - 1) * G.hp + s.int * IK.hp + s.hp + 12 * (up.hp || 0) + gift(h, 'vigor')) * (1 + D.masteryK(h))),
      maxMp: D.clsOf(h).res === 'rage' ? D.RAGE.max : Math.round(40 + s.int * 6 + (h.lvl - 1) * G.mp + s.mp + 10 * (up.mana || 0) + gift(h, 'wisdom')),
      atk: Math.round(((wpn ? wpn.atk : 3) + (W.dex ? s.agi * W.dex : W.spell ? s.int * D.MAGE_ATK : s.str) * 1.6 + s.atk) * (1 + 0.06 * (up.dmg || 0)) * (1 + gift(h, 'fury') / 100) * (1 + D.masteryK(h)) * (W.spell ? 1 + D.MAGE_SPELL * (s.fire + gift(h, 'arcane')) / 100 : 1)),
      def: Math.round(s.def + s.vit * 0.3 + gift(h, 'ward')),
      crit: Math.min(60, 5 + s.agi * 0.5 + s.crit + gift(h, 'crit')), critK: Math.min(D.CRIT.cap, D.CRIT.k + s.critd / 100), dodge: Math.min(BAL.dodge.cap, s.agi * BAL.dodge.agi + s.dodge + gift(h, 'alert')),
      aspd: s.agi * 1.2 + s.aspd + gift(h, 'haste'), mspd: Math.min(40, s.agi * 0.4 + s.mspd + gift(h, 'swift')), leech: s.leech + gift(h, 'leech'),
      regen: s.regen + 0.5 * (up.regen || 0) + gift(h, 'life'), onhit: s.onhit,
      spellBase: (wpn ? wpn.atk : 3) + s.int * 1.6, spell: 1 + (W.spell || 0) + s.fire / 100 + 0.06 * (up.dmg || 0) + gift(h, 'fury') / 100 + gift(h, 'arcane') / 100 + s.int * IK.spell + D.masteryK(h),
      resist: 1 - 0.15 * (up.resist || 0), gold: 1 + gift(h, 'greed') / 100,
      wcd: W.spd, arc: W.arc + gift(h, 'cleave'), reach: W.reach * (1 + gift(h, 'reach') / 100), kb: W.kb || 1, wtype: wpn ? wpn.b : 'fist',
    };
    return out;
  }

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
  function settleDrop(R, p) { const m = R.map, hid = SIMX.secretMask(m), k0 = Math.floor(p.y / TILE) * m.W + Math.floor(p.x / TILE); p.rest = DROP_REST;
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
        if (p.kind === 'gold') { const n = Math.round(p.n * SIMX.heroSt(S).gold * ((D.FLOOR_MODS[R.map.mod] || {}).gold || 1)); h.gold += n; R.goldTot += n; p.got = 1; ev(S, { k: 'gold', x: p.x, y: p.y, n }); }
        else if (p.kind === 'shard') { R.shards += p.n; S.meta.shards += p.n; p.got = 1; ev(S, { k: 'shard', x: p.x, y: p.y, n: p.n, floor: R.floor }); }
        else if (p.kind === 'qitem') { p.got = 1; const q = (R.quests || []).find((o) => o.id === p.quest); ev(S, { k: 'qitem', x: p.x, y: p.y, quest: p.quest }); if (q) R.msg = { s: TXT('sim_items.stepDrops.msg.s', { thing: q.thing }), t: S.t }; }
        else if (p.kind === 'key') { R.keys = (R.keys || 0) + 1; p.got = 1; ev(S, { k: 'key', x: p.x, y: p.y }); R.msg = { s: TXT('sim_items.stepDrops.msg.s.2'), t: S.t }; }
        else if (SIMX.wearIfFree(S, R, p.item)) { p.got = 1; if (p.item.rar === 4 && R.viaTown) R.legend = itemName(p.item); if (p.loot) { SIMX.fstat(R).loot++; SIMX.checkFull(S, R); } ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item), worn: 1 }); }
        else if (SIMX.bagAdd(R, p.item)) { p.got = 1; if (p.item.rar === 4 && R.viaTown) R.legend = itemName(p.item); if (p.loot) { SIMX.fstat(R).loot++; SIMX.checkFull(S, R); } ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item) }); }
        else if (S.t - (R.fullT || -9) > 2.5) { R.fullT = S.t; ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_items.stepDrops.s') }); }
      } }
    R.drops = R.drops.filter((p) => !p.got);
  }

  // the first n cells of a list put in order and packed to its front: gear by slot (consumables ahead of it), then rarity, then level;
  // the other two orders lead with rarity or level. pad: the freed cells stay as null cells (the bag), else the list just shortens
  function sortItems(arr, n, mode, pad) {
    const slot = (it) => (isCons(it) ? -1 : D.SLOTS.indexOf(BASES[it.b].slot)), r = (it) => -(it.rar || 0), l = (it) => -(it.lvl || 0), key = {
      type: (it) => [slot(it), r(it), l(it)], rar: (it) => [r(it), slot(it), l(it)], lvl: (it) => [l(it), r(it), slot(it)] }[mode];
    if (!key) return;
    const out = arr.slice(0, n).filter(Boolean).map((it) => [key(it).concat(it.b), it]).sort((a, b) => { for (let i = 0; i < a[0].length; i++) { if (a[0][i] < b[0][i]) return -1; if (a[0][i] > b[0][i]) return 1; } return 0; }).map((q) => q[1]);
    if (pad) while (out.length < n) out.push(null);
    arr.splice(0, n, ...out);
  }

  Object.assign(SIMX, {
    sortItems, itemPower, typeMods, itemMods, migrateAbilities, rebalanceRun, rollItem, rollAffixes, potion, useless, isCons, itemName, gearName, itemIcon, LOOT, GIFT_V, gift,
    stats, propBoxes, behindProp, DROP_REST, stepDrops });
})(typeof window !== 'undefined' ? window : globalThis);
