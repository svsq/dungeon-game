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
        if (p.kind === 'gold') { const n = Math.round(p.n * SIMX.heroSt(S).gold); h.gold += n; R.goldTot += n; p.got = 1; ev(S, { k: 'gold', x: p.x, y: p.y, n }); }
        else if (p.kind === 'shard') { R.shards += p.n; S.meta.shards += p.n; p.got = 1; ev(S, { k: 'shard', x: p.x, y: p.y, n: p.n, floor: R.floor }); }
        else if (p.kind === 'qitem') { p.got = 1; const q = (R.quests || []).find((o) => o.id === p.quest); ev(S, { k: 'qitem', x: p.x, y: p.y, quest: p.quest }); if (q) R.msg = { s: 'Найдено: «' + q.thing + '»', t: S.t }; }
        else if (p.kind === 'key') { R.keys = (R.keys || 0) + 1; p.got = 1; ev(S, { k: 'key', x: p.x, y: p.y }); R.msg = { s: 'Ключ! Он отпирает дверь на этом этаже', t: S.t }; }
        else if (SIMX.wearIfFree(S, R, p.item)) { p.got = 1; if (p.item.rar === 4 && R.viaTown) R.legend = itemName(p.item); if (p.loot) { SIMX.fstat(R).loot++; SIMX.checkFull(S, R); } ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item), worn: 1 }); }
        else if (SIMX.bagAdd(R, p.item)) { p.got = 1; if (p.item.rar === 4 && R.viaTown) R.legend = itemName(p.item); if (p.loot) { SIMX.fstat(R).loot++; SIMX.checkFull(S, R); } ev(S, { k: 'pickup', x: p.x, y: p.y, rar: p.item.rar, s: itemName(p.item) }); }
        else if (S.t - (R.fullT || -9) > 2.5) { R.fullT = S.t; ev(S, { k: 'nope', x: h.x, y: h.y, s: 'Инвентарь полон' }); }
      } }
    R.drops = R.drops.filter((p) => !p.got);
  }

  Object.assign(SIMX, {
    itemPower, typeMods, itemMods, rebalanceRun, rollItem, rollAffixes, potion, isCons, itemName, gearName, itemIcon, LOOT, GIFT_V, gift,
    stats, propBoxes, behindProp, DROP_REST, stepDrops });
})(typeof window !== 'undefined' ? window : globalThis);
