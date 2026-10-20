// the playtest bot: plays campaigns headless through the same input a player has (keys, mouse, menus), as a player of a given
// skill. A profile sets what a player of that skill gets wrong: how late they see a wind-up or a bolt, how often they dash out
// of it, how far their aim drifts, how low they let HP go before a potion, how they spend mana. Between runs it buys meta ranks.
const SIM = require('../live/sim.js'), D = require('../live/data.js');
const ZOOM = D.ZOOM || 1, BLK = new WeakMap(), T = 32, STUCK = 400, CHASE = 10, HR = 12, COUNT = ['whirl', 'cast', 'shield', 'hurt'];

// react: seconds before a wind-up or a bolt is noticed; dodge: chance to dash out of one noticed in time; aim: drift of the aim
// (rad); hp: potion below this share of HP; mp: drinks mana in a fight; whirl: monsters in reach to spin; fire: mana kept back
// before a fireball; shield: cast below this share of HP; focus: casters first; kite: backs off with low HP and no potion;
// gift: highest altar tier taken
const PROFILES = {
  novice: { react: 0.45, dodge: 0.1, aim: 0.35, hp: 0.25, mp: 0, whirl: 4, fire: 60, shield: 0, focus: 0, kite: 0, gift: 1, stats: ['str', 'vit', 'agi', 'int'] },
  average: { react: 0.3, dodge: 0.4, aim: 0.15, hp: 0.4, mp: 1, whirl: 3, fire: 30, shield: 0.6, focus: 0, kite: 0, gift: 3, stats: ['str', 'vit', 'str', 'vit', 'agi'] },
  expert: { react: 0.2, dodge: 0.8, aim: 0.05, hp: 0.5, mp: 1, whirl: 2, fire: 12, shield: 0.7, focus: 1, kite: 1, gift: 3, stats: ['str', 'vit', 'str', 'vit', 'agi'] },
};

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const toPx = (R, x, y) => ({ px: (x - R.cam[0]) * ZOOM, py: (y - R.cam[1]) * ZOOM });
const click = (r) => ({ px: r.x + r.w / 2, py: r.y + r.h / 2, click: 1, keys: [] });
const val = (x) => x ? (x.atk || 0) * 2 + (x.def || 0) * 2 + x.rar * 3 + x.lvl : -1;
const gear = (it) => it && !SIM.isCons(it);
const held = (h, b) => h.bag.reduce((n, it) => n + (it && it.b === b ? it.n || 1 : 0), 0);
const metaNext = (S) => D.META.filter((M) => (S.meta.up[M.id] || 0) < M.max && S.meta.shards >= M.cost(S.meta.up[M.id] || 0))
  .sort((a, b) => a.cost(S.meta.up[a.id] || 0) - b.cost(S.meta.up[b.id] || 0))[0];
const shrineGift = (S, R, P) => [3, 2, 1].find((tier) => tier <= P.gift && S.meta.shards >= D.giftCost(tier, R.floor));

function play({ seed = 1, profile = 'average', runs = 1, diff = 'normal', log = () => {} } = {}) {
  const P = PROFILES[profile], rand = rng(seed * 7919 + Object.keys(PROFILES).indexOf(profile));
  const S = SIM.spawn(0, {}); S.seedBase = seed; S.meta.diff = diff; SIM.step(S, { keys: [], px: 960, py: 598, click: 1 });
  const out = [], chased = new Map(), given = new Set(), seen = new Set(), counted = new WeakSet();
  let cur = null, focus = null, f0 = 0, tF = 0, lowT = -1, aimN = 0, aimT = -9, lx = 0, ly = 0, lt = 0, stuck = 0;
  const fresh = () => ({ floors: [], hp_potion: 0, mp_potion: 0, whirl: 0, cast: 0, shield: 0, dodges: 0, hurt: 0, gifts: 0, sold: 0, spent: 0, ups: 0, minhp: 1, minmp: 1 });
  const chase = (R, o) => { const t = (chased.get(o) || 0) + SIM.DT; chased.set(o, t); if (t > CHASE) given.add(o); return t <= CHASE; };
  // the way round a wall: a target close in a straight line can still be a long walk away
  const pathLen = (R, x, y) => { const m = R.map, h = R.hero, F = SIM.flow(m, Math.floor(x / T), Math.floor(y / T), 1), v = F[Math.floor(h.y / T) * m.W + Math.floor(h.x / T)]; return v < 0 ? 1e9 : v * T; };
  function walk(R, inp, x, y, round) {
    const m = R.map, h = R.hero, F = SIM.flow(m, Math.floor(x / T), Math.floor(y / T), 1), tx = Math.floor(h.x / T), ty = Math.floor(h.y / T);
    let gx = x - h.x, gy = y - h.y;
    if (round || Math.hypot(gx, gy) > 40) { let best = null;
      // standing in a prop's own cell (a chest against the wall), the way on may run straight through the prop: step out of the
      // cell away from it first
      let B = BLK.get(m); if (!B) BLK.set(m, B = new Set(m.block)); const inProp = B.has(ty * m.W + tx), ox = tx * T + 16 - h.x, oy = ty * T + 16 - h.y;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = F[(ty + ay) * m.W + tx + ax]; if (v >= 0 && (!inProp || ax * ox + ay * oy <= 0) && (!best || v < best[0])) best = [v, ax, ay]; }
      if (best) { gx = (tx + best[1]) * T + 16 - h.x; gy = (ty + best[2]) * T + 18 - h.y; } }
    if (Math.abs(gx) > 4) inp[gx > 0 ? 'right' : 'left'] = 1; if (Math.abs(gy) > 4) inp[gy > 0 ? 'down' : 'up'] = 1;
  }
  const steer = (inp, dx, dy) => { if (Math.abs(dx) > 0.38) inp[dx > 0 ? 'right' : 'left'] = 1; if (Math.abs(dy) > 0.38) inp[dy > 0 ? 'down' : 'up'] = 1; };
  // the dash goes along the held direction keys
  const dash = (inp, dx, dy) => { const d = Math.hypot(dx, dy) || 1; inp.left = inp.right = inp.up = inp.down = 0; steer(inp, dx / d, dy / d); inp.keys.push('Space'); cur.dodges++; };
  function dodge(S, R, inp, live) {
    const h = R.hero, t = S.t; if (h.cd.dash > t) return;
    for (const e of live) { if (e.st !== 'wind' && e.st !== 'bwind') continue;
      const E = D.ENEMIES[e.type], age = t - e.t0, key = e.id + ':' + e.t0; if (age < P.react || seen.has(key)) continue; seen.add(key);
      const w = e.st === 'bwind' ? (e.hp < e.max * 0.5 ? 0.55 : 0.8) : E.wind * D.eliteK(e, 'wind'), d = Math.hypot(h.x - e.x, h.y - e.y);
      if (age > w || E.kind === 'caster') continue;
      const range = e.st === 'bwind' ? (e.mv === 'slam' ? 150 : 1e9) : E.kind === 'slam' ? 74 + HR + 20 : E.r + HR + E.reach * 1.25 + 24;
      if (d > range || rand() >= P.dodge) continue;
      const ax = (h.x - e.x) / (d || 1), ay = (h.y - e.y) / (d || 1);
      if (e.st === 'bwind' && e.mv !== 'slam') dash(inp, -ay, ax); else dash(inp, ax, ay); return; }
    // an explosive elite's corpse: out of its reach before the fuse is out
    for (const e of R.en) { if (!e.fuse || t - e.deadT < P.react || seen.has('f' + e.id)) continue; seen.add('f' + e.id);
      const d = Math.hypot(h.x - e.x, h.y - e.y); if (d > 130 || rand() >= P.dodge) continue; dash(inp, (h.x - e.x) / (d || 1), (h.y - e.y) / (d || 1)); return; }
    for (const p of R.proj) { if (p.own !== 'en' || p.dead || t - p.t0 < P.react || seen.has('p' + p.id)) continue;
      const rx = h.x - p.x, ry = h.y - 38 - p.y, v2 = p.vx * p.vx + p.vy * p.vy, tc = (rx * p.vx + ry * p.vy) / v2;
      if (tc < 0 || tc > 0.7) continue; seen.add('p' + p.id);
      if (Math.hypot(rx - p.vx * tc, ry - p.vy * tc) > 28 || rand() >= P.dodge) continue;
      const s = (rx * p.vy - ry * p.vx) >= 0 ? 1 : -1; dash(inp, -p.vy * s, p.vx * s); return; }
  }
  function fight(S, R, inp, live, st) {
    const h = R.hero, dist = (e) => Math.hypot(e.x - h.x, e.y - h.y);
    let tg = live.reduce((a, e) => (!a || dist(e) < dist(a) ? e : a), null);
    // a caster once picked stays the target while it is within 400 px: a fixed 320 px line flips the target every step for one
    // standing on it, and the bot walks back and forth between two paths for good
    if (P.focus) { if (!(focus && focus.deadT < 0 && live.includes(focus) && dist(focus) < 400)) focus = live.filter((e) => D.ENEMIES[e.type].kind === 'caster' && dist(e) < 320).sort((a, b) => dist(a) - dist(b))[0] || null;
      if (focus) tg = focus; }
    if (S.t > aimT) { aimT = S.t + 0.4; aimN = (rand() + rand() + rand() - 1.5) * 2 * P.aim; }
    const E = D.ENEMIES[tg.type], td = dist(tg), ox = h.x, oy = h.y - SIM.RIG.shoulder + 8, a = Math.atan2(tg.y - 30 - oy, tg.x - ox) + aimN, r = Math.hypot(tg.y - 30 - oy, tg.x - ox);
    Object.assign(inp, toPx(R, ox + Math.cos(a) * r, oy + Math.sin(a) * r));
    const low = h.hp < st.maxHp * 0.3 && !held(h, 'hp_potion');
    if (P.kite && low && td < 160) { steer(inp, (h.x - tg.x) / td, (h.y - tg.y) / td); }
    else { const round = pathLen(R, tg.x, tg.y) > td + 64; // the sim measures a blow's reach with the floor's depth stretched by 1.25
      if (round || Math.hypot(tg.x - h.x, (tg.y - h.y) * 1.25) > st.reach + E.r + HR - 8) walk(R, inp, tg.x, tg.y, round); else inp.press = 1; }
    if (td > 140 && td < 330 && h.cd.fireball <= S.t && h.mp >= Math.max(P.fire, 12)) inp.slot = 2;
    if (h.cd.whirl <= S.t && live.filter((e) => dist(e) < 90 + D.ENEMIES[e.type].r).length >= P.whirl) inp.slot = 1;
    if (P.shield && h.ab.shield && h.cd.shield <= S.t && h.hp < st.maxHp * P.shield) inp.slot = 3;
    if (P.mp && h.mp < 12 && td < 330) inp.keys.push('KeyR');
  }
  // at the counter: sell every spare piece of gear, buy what beats the worn piece, then potions; one click a step
  function trade(R, h) {
    const U = D.UI.shop(R.shop.goods.length), at = (id) => click(U.r.find((q) => q.id === id));
    const i = h.bag.findIndex(gear); if (i >= 0) { cur.sold++; return at('sell:' + i); }
    const room = h.bag.includes(null), buy = (g) => { cur.spent += g.price; return at('buy:' + R.shop.goods.indexOf(g)); };
    const up = R.shop.goods.find((g) => !g.n && g.price <= h.gold && val(g.it) > val(h.eq[D.BASES[g.it.b].slot])); if (up && room) return buy(up);
    for (const [b, want] of [['hp_potion', 6], ['mp_potion', 3]]) { const g = R.shop.goods.find((q) => q.it.b === b && q.n);
      if (g && held(h, b) < want && g.price <= h.gold && (room || h.bag.some((it) => it && it.b === b && it.n < D.CONSUMABLES[b].stack))) return buy(g); }
    R.shopped = R.floor; return { keys: ['Escape'] };
  }
  function pray(S, R) {
    const sh = R.shrines[R.altar], tier = shrineGift(S, R, P), i = sh && sh.gifts ? sh.gifts.findIndex((g, j) => j + 1 === tier && S.meta.shards >= g.cost) : -1;
    if (i >= 0) { cur.gifts++; return click(D.UI.altar().r[i]); } return { keys: ['Escape'] };
  }
  const floorLine = (R, h) => { const s = R.stats[f0] || {}; return { floor: f0, time: Math.round(S.t - tF), lvl: h.lvl, hp: Math.round(h.hp), kills: R.kills, gold: h.gold, loot: s.loot || 0, lootN: s.lootN || 0, shards: R.shards, bank: S.meta.shards }; };
  for (let i = 0; i < 120 * 60 * 60 * runs && out.length < runs; i++) {
    if (!S.run) {
      if (S.screen === 'dead' || S.screen === 'win') { if (cur) { cur.result = S.result; out.push(cur); log(cur); cur = null; } SIM.step(S, click(D.UI.end()[0])); continue; }
      if (S.screen === 'meta') { const M = metaNext(S), r = D.UI.meta().find((q) => q.id === (M ? M.id : 'back')); SIM.step(S, click(r)); continue; }
      if (S.screen === 'menu') { SIM.step(S, click(D.UI.menu(false).find((q) => q.id === (metaNext(S) ? 'meta' : 'campaign')))); continue; }
      SIM.step(S, { keys: ['Escape'] }); continue;
    }
    const R = S.run, h = R.hero, m = R.map;
    if (!cur) { cur = fresh(); cur.meta = Object.assign({}, S.meta.up); f0 = 0; }
    if (R.floor !== f0) { if (f0) cur.floors.push(floorLine(R, h)); f0 = R.floor; tF = S.t; given.clear(); chased.clear(); seen.clear(); }
    if (S.t - tF > STUCK) { stuck = R.floor; break; }
    while (h.pts > 0) { const k = P.stats[h.pts % P.stats.length]; h.base[k]++; h.pts--; }
    for (const a of D.ABILITIES) if (h.sp > 0 && h.lvl >= a.unlock && (h.ab[a.id] || 0) < D.AB_MAX) { h.ab[a.id] = (h.ab[a.id] || 0) + 1; h.sp--; }
    h.bag.forEach((it, j) => { if (!gear(it)) return; const sl = D.BASES[it.b].slot, c = h.eq[sl]; if (val(it) > val(c)) { cur.ups++; h.eq[sl] = it; h.bag[j] = c || null; } });
    if (S.screen === 'shop') { SIM.step(S, trade(R, h)); continue; }
    if (S.screen === 'altar') { SIM.step(S, pray(S, R)); continue; }
    if (S.screen !== 'play') { SIM.step(S, { keys: ['Escape'] }); continue; }
    const st = SIM.stats(h, S.meta), inp = { left: 0, right: 0, up: 0, down: 0, press: 0, click: 0, px: 960, py: 540, keys: [], slot: 0 };
    const FH = SIM.flow(m, Math.floor(h.x / T), Math.floor(h.y / T), 1).slice(), reach = (o) => [0, 1, -1, m.W, -m.W].some((d) => FH[Math.floor(o.y / T) * m.W + Math.floor(o.x / T) + d] >= 0);
    // a monster behind a door still locked can't be fought
    const live = R.en.filter((e) => e.deadT < 0 && reach(e)), awake = live.filter((e) => e.st !== 'idle' && e.st !== 'home');
    const near = live.some((e) => Math.hypot(e.x - h.x, e.y - h.y) < 260), late = R.floor < D.FLOORS && S.t - tF > 200;
    const room = h.bag.includes(null), takes = (p) => p.kind !== 'item' || room || SIM.isCons(p.item) || !h.eq[D.BASES[p.item.b].slot];
    const dist = (o) => Math.hypot(o.x - h.x, o.y - h.y), first = (list) => list.filter((o) => !given.has(o)).sort((a, b) => dist(a) - dist(b))[0];
    // what lies behind a door still locked is out of reach until its key or lever is found
    const drop = first(R.drops.filter((p) => !p.got && !p.tossed && !(p.fly > 0) && takes(p) && reach(p)));
    const chest = first(R.chests.filter((c) => !c.open && (c.sec === undefined || m.secrets[c.sec].open) && reach(c)));
    const locked = R.keys > 0 ? first((m.doors || []).filter((d) => { const L = SIM.doorLock(m, d); return L && L.kind === 'key'; })) : null;
    const lever = first((m.locks || []).filter((L) => L.kind === 'lever' && !L.open && reach({ x: L.lever.x, y: L.lever.y + 50 })).map((L) => Object.assign({ L }, { x: L.lever.x, y: L.lever.y + 50 })));
    const shrine = first(R.shrines.filter((s) => !s.used && shrineGift(S, R, P)));
    const shop = m.shop && R.shopped !== R.floor && (h.bag.some(gear) || h.gold >= 60) && !given.has(m.shop) ? m.shop : null;
    if (!near && !late && drop && chase(R, drop)) walk(R, inp, drop.x, drop.y);
    else if (!near && !late && chest && chase(R, chest)) { walk(R, inp, chest.x, chest.y + 20); if (dist(chest) < 50) inp.keys.push('KeyE'); }
    else if (!near && !late && shrine && chase(R, shrine)) { walk(R, inp, shrine.x, shrine.y + 30); if (dist(shrine) < 55) inp.keys.push('KeyE'); }
    else if (!near && !late && locked && chase(R, locked)) { const dx = locked.dir === 'l' ? -1 : locked.dir === 'r' ? 1 : 0, dy = locked.dir === 'u' ? -1 : locked.dir === 'd' ? 1 : 0;
      walk(R, inp, locked.x + dx * 40, locked.y + dy * 40); if (Math.hypot(locked.x - h.x, locked.y - h.y + 10) < 60) inp.keys.push('KeyE'); }
    else if (!near && !late && lever && chase(R, lever.L)) { walk(R, inp, lever.x, lever.y); if (SIM.leverNear(R)) inp.keys.push('KeyE'); }
    else if (!near && shop && chase(R, shop)) { walk(R, inp, shop.front.x, shop.front.y); if (SIM.atCounter(R)) inp.keys.push('KeyE'); }
    else if (live.length && !late) fight(S, R, inp, live, st);
    else { walk(R, inp, m.exit.x, m.exit.y); if (dist(m.exit) < 55) inp.keys.push('KeyE'); }
    if (awake.length || R.en.some((e) => e.fuse)) dodge(S, R, inp, awake);
    // a shut door in the way: open it (a locked one only with the key, above)
    if (SIM.doorNear(R, 60) && !SIM.doorLock(m, SIM.doorNear(R, 60))) inp.keys.push('KeyE');
    // stuck against a prop for a second: swing in the walking direction (breaks barrels and pots)
    if (Math.hypot(h.x - lx, h.y - ly) > 20) { lx = h.x; ly = h.y; lt = S.t; }
    if (S.t - lt > 1) { const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); inp.press = 1;
      Object.assign(inp, toPx(R, h.x + dx * 40, h.y - SIM.RIG.shoulder + 8 + dy * 40)); if (S.t - lt > 3) { inp.keys.push('Space'); lt = S.t; } }
    // a potion once HP has sat under the line for the time it takes to notice
    if (h.hp < st.maxHp * P.hp) { if (lowT < 0) lowT = S.t; if (S.t - lowT >= P.react && held(h, 'hp_potion')) { inp.keys.push('KeyQ'); lowT = -1; } } else lowT = -1;
    cur.minhp = Math.min(cur.minhp, h.hp / st.maxHp); cur.minmp = Math.min(cur.minmp, h.mp / st.maxMp);
    SIM.step(S, inp);
    for (const e of S.ev) if (!counted.has(e)) { counted.add(e); if (e.k === 'drink') cur[e.b]++; else if (COUNT.includes(e.k)) cur[e.k]++; }
    if (!S.run && cur) cur.floors.push(floorLine(R, h));
  }
  if (cur && !cur.result) { cur.result = stuck ? { how: 'stuck', floor: stuck } : { how: 'timeout', floor: S.run ? S.run.floor : 0 }; out.push(cur); log(cur); }
  return out;
}

module.exports = { play, PROFILES };
