// the playtest bot: plays campaigns headless through the same input a player has (keys, mouse, menus), as a player of a given
// skill. A profile sets what a player of that skill gets wrong: how late they see a wind-up or a bolt, how often they dash out
// of it, how far their aim drifts, how low they let HP go before a potion, how they spend mana. Between runs it buys meta ranks.
const SIM = require('../live/sim.js'), D = require('../live/data.js');
// the version of the game and the bot a result was played on: --check refuses results of mixed versions or resumed from a
// checkpoint, whose monsters were rescaled over a floor built by older data (TASKS 240)
const VERSION = (() => { const h = require('crypto').createHash('sha1'), fs = require('fs'), path = require('path');
  for (const f of ['live/data.js', 'live/sim.js', 'live/dungeon.js', 'tools/bot.cjs']) h.update(fs.readFileSync(path.join(__dirname, '..', f)));
  return h.digest('hex').slice(0, 12); })();
// what hurt the hero, in the groups the balance pass weighs against each other
const SRC = (k) => /снаряд/.test(k) ? 'bolt' : k === 'spike' || k === 'lava' ? 'trap' : k === 'burn' || k === 'poison' ? 'dot' : /элита|взрыв|boss/.test(k) ? 'elite' : 'mob';
const ZOOM = D.ZOOM || 1, BLK = new WeakMap(), T = 32, STUCK = 400, CHASE = 10, HR = 12, COUNT = ['whirl', 'cast', 'shield'];

// react: seconds before a wind-up or a bolt is noticed; dodge: chance to dash out of one noticed in time; aim: drift of the aim
// (rad); hp: potion below this share of HP; mp: drinks mana in a fight; whirl: monsters in reach to spin; fire: mana kept back
// before a fireball; shield: cast below this share of HP; focus: casters first; kite: backs off with low HP and no potion;
// gift: highest altar tier taken; step: walks back out of a wind-up's reach while the dash recharges; traps: keeps off a spike
// plate that is up or about to rise; flank: share of armoured crabs it walks round to strike off the armour (the rest it hacks at the front)
const PROFILES = {
  novice: { flank: 0.5, react: 0.45, dodge: 0.1, aim: 0.35, hp: 0.25, mp: 0, whirl: 4, fire: 60, shield: 0, focus: 0, kite: 0, gift: 1, stats: ['str', 'vit', 'agi', 'int'] },
  average: { flank: 1, react: 0.3, dodge: 0.4, aim: 0.15, hp: 0.4, mp: 1, whirl: 3, fire: 30, shield: 0.6, focus: 0, kite: 0, gift: 3, stats: ['str', 'vit', 'str', 'vit', 'agi'] },
  expert: { flank: 1, react: 0.15, dodge: 0.9, aim: 0.05, hp: 0.5, mp: 1, whirl: 2, fire: 12, shield: 0.7, focus: 1, kite: 1, gift: 3, step: 1, traps: 1, stats: ['str', 'vit', 'str', 'vit', 'agi'] },
  mage: { flank: 1, react: 0.3, dodge: 0.4, aim: 0.15, hp: 0.4, mp: 1, whirl: 3, fire: 12, shield: 0.6, focus: 0, kite: 0, gift: 3, stats: ['int', 'vit', 'int', 'vit', 'agi'] },
};

function rng(seed) { let a = seed >>> 0; const draw = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  draw.state = (value) => { if (value !== undefined) a = value; return a; }; return draw; }

const toPx = (R, x, y) => ({ px: (x - R.cam[0]) * ZOOM, py: (y - R.cam[1]) * ZOOM });
const click = (r) => ({ px: r.x + r.w / 2, py: r.y + r.h / 2, click: 1, keys: [] });
const val = (x) => x ? (x.atk || 0) * 2 + (x.def || 0) * 2 + x.rar * 3 + x.lvl : -1;
const gear = (it) => it && !SIM.isCons(it);
const held = (h, b) => h.bag.reduce((n, it) => n + (it && it.b === b ? it.n || 1 : 0), 0);
const metaNext = (S) => D.META.filter((M) => (S.meta.up[M.id] || 0) < M.max && S.meta.shards >= M.cost(S.meta.up[M.id] || 0))
  .sort((a, b) => a.cost(S.meta.up[a.id] || 0) - b.cost(S.meta.up[b.id] || 0))[0];
const shrineGift = (S, R, P) => [3, 2, 1].find((tier) => tier <= P.gift && S.meta.shards >= D.giftCost(tier, R.floor));

// the hero's health, attack and armour on a floor's arrival, and without each source in turn: all gear, bought gear, altar gifts,
// meta ranks; the levels' share is what is left without gear, gifts and meta
const power = (S, h) => { const f = (hh, meta) => { const st = SIM.stats(hh, meta); return [st.maxHp, st.atk, st.def]; }, eq = (keep) => Object.fromEntries(Object.entries(h.eq).filter(([, it]) => it && keep(it)));
  return { all: f(h, S.meta), noGear: f(Object.assign({}, h, { eq: {} }), S.meta), noBought: f(Object.assign({}, h, { eq: eq((it) => !it.bought) }), S.meta),
    noGifts: f(Object.assign({}, h, { perks: {} }), S.meta), noMeta: f(h, { up: {} }), bare: f(Object.assign({}, h, { eq: {}, perks: {} }), { up: {} }) }; };
function play({ seed = 1, profile = 'average', runs = 1, diff = 'normal', mode = 'campaign', initial = null, checkpoint = null, log = () => {} } = {}) {
  const P = PROFILES[profile], rand = rng(seed * 7919 + Object.keys(PROFILES).indexOf(profile));
  if (initial && (initial.seed !== seed || initial.profile !== profile || initial.diff !== diff || runs !== 1)) throw new Error('checkpoint parameters differ');
  const S = initial ? initial.S : SIM.spawn(0, {});
  if (!initial) { S.seedBase = seed; S.meta.diff = diff; SIM.step(S, click(D.UI.menu(false).find((q) => q.id === mode))); }

  const out = [], chased = new Map(), given = new Set(), seen = new Set(), counted = new WeakSet();
  let cur = null, fl = null, altarF = 0, backT = -9, backX = 0, backY = 0, focus = null, f0 = 0, tF = 0, lowT = -1, aimN = 0, aimT = -9, lx = 0, ly = 0, lt = 0, stuck = 0, goal = null;
  if (initial) {
    [cur, fl, altarF, backT, backX, backY, focus, f0, tF, lowT, aimN, aimT, lx, ly, lt, stuck, goal] = initial.vars;
    rand.state(initial.rng); for (const event of S.ev) counted.add(event);
    const R = S.run, hp = D.DIFF[R.diff || 'normal'].hp, hpScale = hp > 1 ? 1 + (hp - 1) * Math.min(1, R.floor / 3) : hp;
    const sc = D.BAL.hp * hpScale * (1 + 0.5 * (R.floor - 1)), dc = D.BAL.dmg * 1.35 * D.dmgAt(R.floor);
    for (const e of R.en) {
      const E = D.ENEMIES[e.type], boss = !!D.BOSSES[e.type], guard = e.guard && D.runOf(R.mode).guard[R.floor], gd = (typeof guard === 'object' ? guard.dmg : guard) || 1, gh = (typeof guard === 'object' ? guard.hp : guard) || 1;
      const health = e.hp / e.max; e.max = Math.round(E.hp * sc * (e.elite && !boss ? D.eliteK(e, 'hp') : 1) * gh); e.hp = e.max * health;
      e.dmg = E.dmg * dc * (boss ? D.dmgAt(R.floor, 1) / D.dmgAt(R.floor) : 1) * (!e.elite ? 1 : boss ? 1.35 : D.eliteK(e, 'dmg')) * gd;
    }
  }
  const fresh = () => ({ seed, mode, ver: VERSION, resumed: initial ? 1 : 0, floors: [], hp_potion: 0, mp_potion: 0, whirl: 0, cast: 0, shield: 0, dodges: 0, hurt: 0, gifts: 0, altars: [], sold: 0, spent: 0, ups: 0, minhp: 1, minmp: 1 });
  const chase = (R, o) => { const t = (chased.get(o) || 0) + SIM.DT; chased.set(o, t); if (t > CHASE) given.add(o); return t <= CHASE; };
  // the way round a wall: a target close in a straight line can still be a long walk away
  const pathLen = (R, x, y) => { const m = R.map, h = R.hero, F = SIM.flow(m, Math.floor(x / T), Math.floor(y / T), 1), v = F[Math.floor(h.y / T) * m.W + Math.floor(h.x / T)]; return v < 0 ? 1e9 : v * T; };
  function walk(R, inp, x, y, round) {
    const m = R.map, h = R.hero, F = SIM.flow(m, Math.floor(x / T), Math.floor(y / T), 1), tx = Math.floor(h.x / T), ty = Math.floor(h.y / T);
    // in lava (a dash or a blow carried it in): out by the nearest floor first, or with no floor next to it it burns where it stands
    if (SIM.cell(m, tx, ty) === 3) { const seen = new Set([ty * m.W + tx]), q = [[tx, ty]];
      for (let i = 0; i < q.length; i++) { const [cx, cy] = q[i]; if (SIM.cell(m, cx, cy) === 1) { const ex = cx * T + 16 - h.x, ey = cy * T + 18 - h.y;
          if (Math.abs(ex) > 4) inp[ex > 0 ? 'right' : 'left'] = 1; if (Math.abs(ey) > 4) inp[ey > 0 ? 'down' : 'up'] = 1; return; }
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + ax, ny = cy + ay, k = ny * m.W + nx; if (!seen.has(k) && (SIM.cell(m, nx, ny) === 1 || SIM.cell(m, nx, ny) === 3)) { seen.add(k); q.push([nx, ny]); } } } }
    let gx = x - h.x, gy = y - h.y;
    if (round || Math.hypot(gx, gy) > 40) { let best = null;
      // standing in a prop's own cell (a chest against the wall), the way on may run straight through the prop: step out of the
      // cell away from it first
      let B = BLK.get(m); if (!B) BLK.set(m, B = new Set(m.block)); const inProp = B.has(ty * m.W + tx), ox = tx * T + 16 - h.x, oy = ty * T + 16 - h.y;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = F[(ty + ay) * m.W + tx + ax]; if (v >= 0 && (!inProp || ax * ox + ay * oy <= 0) && (!best || v < best[0])) best = [v, ax, ay]; }
      if (!best && inProp && S.t - lt > 1) {
        if (backT <= S.t) { const side = Math.sign(h.x - (tx + 0.5) * T) || 1;
          const [ax, ay] = [[side, 0], [-side, 0], [0, -1], [0, 1]].find(([dx, dy]) => SIM.cell(m, tx + dx, ty + dy) === 1 && !B.has((ty + dy) * m.W + tx + dx)) || [0, 0];
          backT = S.t + 0.7; backX = ax; backY = ay;
        }
        return;
      }
      if (best) { gx = (tx + best[1]) * T + 16 - h.x; gy = (ty + best[2]) * T + 18 - h.y; } }
    if (Math.abs(gx) > 4) inp[gx > 0 ? 'right' : 'left'] = 1; if (Math.abs(gy) > 4) inp[gy > 0 ? 'down' : 'up'] = 1;
  }
  const steer = (inp, dx, dy) => { if (Math.abs(dx) > 0.38) inp[dx > 0 ? 'right' : 'left'] = 1; if (Math.abs(dy) > 0.38) inp[dy > 0 ? 'down' : 'up'] = 1; };
  // the dash goes along the held direction keys
  const dash = (inp, dx, dy) => { const d = Math.hypot(dx, dy) || 1; inp.left = inp.right = inp.up = inp.down = 0; steer(inp, dx / d, dy / d); inp.keys.push('Space'); cur.dodges++; };
  function dodge(S, R, inp, live) {
    const h = R.hero, t = S.t, ready = h.cd.dash <= t; if (!ready && !P.step) return;
    for (const e of live) { if (e.st !== 'wind' && e.st !== 'bwind') continue;
      // a boss is dodged only on the moves that strike with its body (the volley is read bolt by bolt below); the slam that follows
      // a charge the hero got out of is a pattern a player learns, met without waiting to see it wind up (TASKS 227)
      if (e.st === 'bwind' && (!['slam', 'charge'].includes(e.mv) || !(D.bossMove(e).dmg > 0))) continue;
      const E = D.ENEMIES[e.type], age = t - e.t0, key = e.id + ':' + e.t0; if (age < (e.chain ? 0 : P.react) || seen.has(key)) continue; seen.add(key);
      const w = e.st === 'bwind' ? D.bossMove(e).wind : E.wind * D.eliteK(e, 'wind'), d = Math.hypot(h.x - e.x, h.y - e.y);
      if (age > w || E.kind === 'caster') continue;
      const range = e.st === 'bwind' ? (e.mv === 'slam' ? 150 : 1e9) : E.kind === 'slam' ? 74 + HR + 20 : e.rush ? E.r + HR + E.rush.reach + 20 : E.r + HR + E.reach * 1.25 + 24;
      if (d > range || rand() >= P.dodge) continue;
      const ax = (h.x - e.x) / (d || 1), ay = (h.y - e.y) / (d || 1);
      if (!ready) { if (e.st === 'wind' || e.chain) { backT = t + w - age + 0.12; backX = ax; backY = ay; } continue; }
      if ((e.st === 'bwind' && e.mv !== 'slam') || e.rush) dash(inp, -ay, ax); else dash(inp, ax, ay); return; }
    if (!ready) return;
    // an explosive elite's corpse: out of its reach before the fuse is out
    for (const e of R.en) { if (!e.fuse || t - e.deadT < P.react || seen.has('f' + e.id)) continue; seen.add('f' + e.id);
      const d = Math.hypot(h.x - e.x, h.y - e.y); if (d > 130 || rand() >= P.dodge) continue; dash(inp, (h.x - e.x) / (d || 1), (h.y - e.y) / (d || 1)); return; }
    for (const p of R.proj) { if (p.own !== 'en' || p.dead || t - p.t0 < P.react || seen.has('p' + p.id)) continue;
      const rx = h.x - p.x, ry = h.y - 38 - p.y, v2 = p.vx * p.vx + p.vy * p.vy, tc = (rx * p.vx + ry * p.vy) / v2;
      if (tc < 0 || tc > 0.7) continue; seen.add('p' + p.id);
      if (Math.hypot(rx - p.vx * tc, ry - p.vy * tc) > 28 || rand() >= P.dodge) continue;
      const s = (rx * p.vy - ry * p.vx) >= 0 ? 1 : -1; dash(inp, -p.vy * s, p.vx * s); return; }
  }
  // spikes are up for 0.7 s of every 2.4 s (sim.js): hold back from a plate that is up or rises within the next step, and dash
  // off one that is about to rise under the feet (a dash leaps them)
  const SPK = 2.4, UP = 0.29, onPl = (x, y, tr) => Math.abs(x - tr.x) < T - 4 && Math.abs(y - tr.y) < T - 6;
  const spikeSoon = (t, tr, ahead) => { const ph = ((t / SPK + tr.ph) % 1 + 1) % 1; return ph < UP || ph > 1 - ahead / SPK; };
  function avoidSpikes(S, R, h, inp) {
    const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0), traps = R.map.traps || [];
    const under = traps.find((tr) => onPl(h.x, h.y, tr) && spikeSoon(S.t, tr, 0.2));
    if (under) { if (h.cd.dash <= S.t && !inp.keys.includes('Space')) { const ax = dx || Math.sign(h.x - under.x) || 1, ay = dy; dash(inp, ax, ay); } return; }
    if (!dx && !dy) return; const nx = h.x + dx * 28, ny = h.y + dy * 28;
    if (traps.some((tr) => onPl(nx, ny, tr) && !onPl(h.x, h.y, tr) && spikeSoon(S.t, tr, 0.45))) inp.left = inp.right = inp.up = inp.down = 0;
  }
  // which way round a crab to go (+1 / −1) while the hero stands within its armour's arc (a little wider, it turns as he goes), else 0
  const armFront = (e) => { const E = D.ENEMIES[e.type]; if (!E.armor || !(P.flank > 0) || ((Math.imul(e.id + 1, 2654435761) ^ seed) >>> 0) % 1000 / 1000 >= P.flank) return 0;
    const h = S.run.hero, fa = e.fa ?? (e.face > 0 ? 0 : Math.PI); let r = Math.atan2(h.y - e.y, h.x - e.x) - fa; r = Math.atan2(Math.sin(r), Math.cos(r));
    return Math.abs(r) < E.armor.arc + 0.35 ? (r >= 0 ? 1 : -1) : 0; };
  function fight(S, R, inp, live, st, walkD) {
    const h = R.hero, dist = (e) => Math.hypot(e.x - h.x, e.y - h.y);
    // the nearest by the walk, not the crow: two foes about as far in a straight line but round a wall from each other swap
    // places as the nearest with each step, and the bot walks back and forth between their paths for good
    const far = (e) => Math.max(dist(e), walkD(e));
    let tg = live.reduce((a, e) => (!a || far(e) < far(a) ? e : a), null);
    // a caster once picked stays the target while it is within 400 px: a fixed 320 px line flips the target every step for one
    // standing on it, and the bot walks back and forth between two paths for good; by the walk too: a caster close through a wall
    // was picked and dropped on the way round, and the bot circled in the corridor (seed 193, TASKS 227)
    if (P.focus) { if (!(focus && focus.deadT < 0 && live.includes(focus) && far(focus) < 400)) focus = live.filter((e) => D.ENEMIES[e.type].kind === 'caster' && far(e) < 320).sort((a, b) => far(a) - far(b))[0] || null;
      if (focus) tg = focus; }
    if (S.t > aimT) { aimT = S.t + 0.4; aimN = (rand() + rand() + rand() - 1.5) * 2 * P.aim; }
    const E = D.ENEMIES[tg.type], td = dist(tg), ox = h.x, oy = h.y - SIM.RIG.shoulder + 8, a = Math.atan2(tg.y - 30 - oy, tg.x - ox) + aimN, r = Math.hypot(tg.y - 30 - oy, tg.x - ox);
    Object.assign(inp, toPx(R, ox + Math.cos(a) * r, oy + Math.sin(a) * r));
    const low = h.hp < st.maxHp * 0.3 && !held(h, 'hp_potion');
    if (P.kite && low && td < 160) { steer(inp, (h.x - tg.x) / td, (h.y - tg.y) / td); }
    else { const round = pathLen(R, tg.x, tg.y) > td + 64; // the sim measures a blow's reach with the floor's depth stretched by 1.25
      // a crab's armour faces the hero (TASKS 309): from before it, circle round it close, inside its rush and toward its back, and
      // strike only once off its armour; a blow on the armour does a fifth
      const fr = armFront(tg);
      if (fr && !round && td < 260) { const ah = Math.atan2(h.y - tg.y, h.x - tg.x), Rc = E.r + HR + 16, a2 = ah + fr * 0.7, px = tg.x + Math.cos(a2) * Rc, py = tg.y + Math.sin(a2) * Rc;
        steer(inp, (px - h.x) / (Math.hypot(px - h.x, py - h.y) || 1), (py - h.y) / (Math.hypot(px - h.x, py - h.y) || 1)); }
      else if (round || Math.hypot(tg.x - h.x, (tg.y - h.y) * 1.25) > st.reach + E.r + HR - 8) walk(R, inp, tg.x, tg.y, round); else inp.press = 1; }
    if (h.ab.fireball && !armFront(tg) && td > 140 && td < 330 && h.cd.fireball <= S.t && h.mp >= Math.max(P.fire, 12)) inp.slot = 2;
    if (h.cd.whirl <= S.t && live.filter((e) => dist(e) < 90 + D.ENEMIES[e.type].r).length >= P.whirl) inp.slot = 1;
    if (P.shield && h.ab.shield && h.cd.shield <= S.t && h.mp >= D.ABILITIES.find((a) => a.id === 'shield').mp && h.hp < st.maxHp * P.shield) inp.slot = 3;
    if (P.mp && h.mp < 12 && td < 330 && held(h, 'mp_potion')) inp.keys.push('KeyR');
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
    if (R.shrines[R.altar] && R.shrines[R.altar].used) return { keys: ['Escape'] };
    const sh = R.shrines[R.altar], tier = shrineGift(S, R, P), i = sh && sh.gifts ? sh.gifts.findIndex((g, j) => j + 1 === tier && S.meta.shards >= g.cost) : -1;
    if (sh && sh.gifts && !sh.seen) { sh.seen = 1; cur.altars.push({ f: R.floor, bank: S.meta.shards, c2: sh.gifts[1].cost }); }
    if (i >= 0) { cur.gifts++; return click(D.UI.altar().r[i]); } return { keys: ['Escape'] };
  }
  const floorLine = (R, h) => { const s = R.stats[f0] || {}; return { floor: f0, time: Math.round(S.t - tF), full: [[s.kills, s.foes], [s.loot, s.lootN], [s.sec, s.secN]].filter(([k, n]) => n > 0 && k >= n).length, sec: s.sec || 0, secN: s.secN || 0, foes: s.foes || 0, killed: s.kills || 0, lvl: h.lvl, hp: Math.round(h.hp), maxHp: SIM.stats(h, S.meta).maxHp, kills: R.kills, gold: h.gold, loot: s.loot || 0, lootN: s.lootN || 0, shards: R.shards, bank: S.meta.shards, dodge: Math.round(SIM.stats(h, S.meta).dodge), dmg: fl.dmg, dmgHp: fl.dmgHp, hits: fl.hits, minhp: fl.minhp, hpPot: fl.hp_potion, mpPot: fl.mp_potion, boss: fl.boss, pw: fl.pw, blows: fl.blows }; };
  const freshFl = () => ({ dmg: {}, dmgHp: 0, hits: 0, minhp: 1, hp_potion: 0, mp_potion: 0, blows: {} });
  for (let i = initial ? initial.i : 0; i < 120 * 60 * 60 * runs && out.length < runs; i++) {
    if (!S.run) {
      if (S.screen === 'dead' || S.screen === 'win') { if (cur) { cur.result = S.result; out.push(cur); log(cur, S); cur = null; } SIM.step(S, click(D.UI.end()[0])); continue; }
      if (S.screen === 'meta') { const M = metaNext(S), r = D.UI.meta().find((q) => q.id === (M ? M.id : 'back')); SIM.step(S, click(r)); continue; }
      if (S.screen === 'menu') { SIM.step(S, click(D.UI.menu(false).find((q) => q.id === (metaNext(S) ? 'meta' : mode)))); continue; }
      SIM.step(S, { keys: ['Escape'] }); continue;
    }
    const R = S.run, h = R.hero, m = R.map;
    if (!cur) { cur = fresh(); cur.meta = Object.assign({}, S.meta.up); f0 = 0; }
    cur.potLeft = held(h, 'hp_potion');
    if (R.floor !== f0) { if (f0) cur.floors.push(floorLine(R, h));
      if (f0 && altarF === f0 && !cur.altars.some((q) => q.f === f0)) cur.altars.push({ f: f0, bank: S.meta.shards, c2: D.giftCost(2, f0) }); altarF = R.shrines.length ? R.floor : 0; fl = freshFl(); fl.pw = power(S, h); f0 = R.floor; tF = S.t; given.clear(); chased.clear(); seen.clear();
      if (checkpoint && runs === 1) checkpoint({ S, seed, profile, diff, i, rng: rand.state(),
        vars: [cur, fl, altarF, backT, backX, backY, focus, f0, tF, lowT, aimN, aimT, lx, ly, lt, stuck, goal] });
    }
    if (S.t - tF > STUCK) { stuck = { how: 'stuck', floor: R.floor, at: [Math.floor(h.x / T), Math.floor(h.y / T)], goal }; break; }
    // the points a run starts with are laid out on the hero screen, where each point of VIT or INT comes with its health or mana
    if (R.floor === 1 && S.t - tF < 1 && h.pts > 0) { while (h.pts > 0) { const k = P.stats[h.pts % P.stats.length]; h.base[k]++; h.pts--; } const s0 = SIM.stats(h, S.meta); h.hp = s0.maxHp; h.mp = s0.maxMp; }
    while (h.pts > 0) { const k = P.stats[h.pts % P.stats.length]; h.base[k]++; h.pts--; }
    for (const a of D.ABILITIES) if (h.sp > 0 && h.lvl >= a.unlock && (h.ab[a.id] || 0) < D.AB_MAX) { h.ab[a.id] = (h.ab[a.id] || 0) + 1; h.sp--; }
    h.bag.forEach((it, j) => { if (!gear(it)) return; const sl = D.BASES[it.b].slot, c = h.eq[sl]; if (val(it) > val(c)) { cur.ups++; h.eq[sl] = it; h.bag[j] = c || null; } });
    if (S.screen === 'shop') { const had = new Set(h.bag.filter(Boolean).map((it) => it.id)), g = h.gold; SIM.step(S, trade(R, h));
      if (h.gold < g) for (const it of h.bag) if (it && it.b && !had.has(it.id)) it.bought = 1; continue; }
    if (S.screen === 'altar') { SIM.step(S, pray(S, R)); continue; }
    if (S.screen !== 'play') { SIM.step(S, { keys: ['Escape'] }); continue; }
    const st = SIM.stats(h, S.meta), inp = { left: 0, right: 0, up: 0, down: 0, press: 0, click: 0, px: 960, py: 540, keys: [], slot: 0 };
    const FH = SIM.flow(m, Math.floor(h.x / T), Math.floor(h.y / T), 1).slice(), reach = (o) => [0, 1, -1, m.W, -m.W].some((d) => FH[Math.floor(o.y / T) * m.W + Math.floor(o.x / T) + d] >= 0);
    const walkD = (o) => T * Math.min(...[0, 1, -1, m.W, -m.W].map((d) => FH[Math.floor(o.y / T) * m.W + Math.floor(o.x / T) + d]).filter((v) => v >= 0), 1e9);
    // a monster behind a door still locked can't be fought
    const live = R.en.filter((e) => e.deadT < 0 && reach(e)), awake = live.filter((e) => e.st !== 'idle' && e.st !== 'home');
    const near = live.some((e) => Math.hypot(e.x - h.x, e.y - h.y) < 260), late = R.floor < D.runOf(R.mode).floors && S.t - tF > 200;
    const room = h.bag.includes(null), takes = (p) => p.kind !== 'item' || room || SIM.isCons(p.item) || !h.eq[D.BASES[p.item.b].slot];
    const dist = (o) => Math.hypot(o.x - h.x, o.y - h.y), first = (list) => list.filter((o) => !given.has(o)).sort((a, b) => dist(a) - dist(b))[0];
    // what lies behind a door still locked is out of reach until its key or lever is found
    const drop = first(R.drops.filter((p) => !p.got && !p.tossed && !(p.fly > 0) && takes(p) && reach(p)));
    const chest = first(R.chests.filter((c) => !c.open && (c.sec === undefined || m.secrets[c.sec].open) && reach(c)));
    const locked = R.keys > 0 ? first((m.doors || []).filter((d) => { const L = SIM.doorLock(m, d); return L && L.kind === 'key'; })) : null;
    const lever = first((m.locks || []).filter((L) => L.kind === 'lever' && !L.open && reach({ x: L.lever.x, y: L.lever.y + 50 })).map((L) => Object.assign({ L }, { x: L.lever.x, y: L.lever.y + 50 })));
    const shrine = first(R.shrines.filter((s) => !s.used && (!m.bossType || !R.en.some((e) => D.BOSSES[e.type] && e.deadT < 0)) && shrineGift(S, R, P)));
    const shop = m.shop && R.shopped !== R.floor && (h.bag.some(gear) || h.gold >= 60) && !given.has(m.shop) ? m.shop : null;
    const aim = (k, o) => { goal = o ? [k, Math.floor(o.x / T), Math.floor(o.y / T)] : [k]; return true; };
    if (!near && !late && drop && chase(R, drop) && aim('drop', drop)) walk(R, inp, drop.x, drop.y);
    else if (!near && !late && chest && chase(R, chest) && aim('chest', chest)) { walk(R, inp, chest.x, chest.y + 20); if (dist(chest) < 50) inp.keys.push('KeyE'); }
    else if (!near && !late && shrine && chase(R, shrine) && aim('shrine', shrine)) { walk(R, inp, shrine.x, shrine.y + 30); if (dist(shrine) < 55) inp.keys.push('KeyE'); }
    else if (!near && !late && locked && chase(R, locked) && aim('door', locked)) { const dx = locked.dir === 'l' ? -1 : locked.dir === 'r' ? 1 : 0, dy = locked.dir === 'u' ? -1 : locked.dir === 'd' ? 1 : 0;
      walk(R, inp, locked.x + dx * 40, locked.y + dy * 40); if (Math.hypot(locked.x - h.x, locked.y - h.y + 10) < 60) inp.keys.push('KeyE'); }
    else if (!near && !late && lever && chase(R, lever.L) && aim('lever', lever)) { walk(R, inp, lever.x, lever.y); if (SIM.leverNear(R)) inp.keys.push('KeyE'); }
    else if (!near && shop && chase(R, shop) && aim('shop', shop.front)) { walk(R, inp, shop.front.x, shop.front.y); if (SIM.atCounter(R)) inp.keys.push('KeyE'); }
    // a sealed arena opens only on the boss's death: there is no running late past him to the stairs
    else if (live.length && (!late || (R.arena && R.arena.active)) && aim('fight', live.slice().sort((a, b) => Math.max(dist(a), walkD(a)) - Math.max(dist(b), walkD(b)))[0])) fight(S, R, inp, live, st, walkD);
    else { aim('exit', m.exit); walk(R, inp, m.exit.x, m.exit.y); if (dist(m.exit) < 55) inp.keys.push('KeyE'); }
    if (awake.length || R.en.some((e) => e.fuse)) dodge(S, R, inp, awake);
    if (backT > S.t && !inp.keys.includes('Space')) { inp.left = inp.right = inp.up = inp.down = 0; inp.press = 0; steer(inp, backX, backY); }
    if (P.traps) avoidSpikes(S, R, h, inp);
    // a shut door in the way: open it (a locked one only with the key, above)
    if (SIM.doorNear(R, 60) && !SIM.doorLock(m, SIM.doorNear(R, 60))) inp.keys.push('KeyE');
    // stuck against a prop for a second: swing in the walking direction (breaks barrels and pots)
    if (Math.hypot(h.x - lx, h.y - ly) > 20) { lx = h.x; ly = h.y; lt = S.t; }
    if (S.t - lt > 1) { const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); inp.press = 1;
      Object.assign(inp, toPx(R, h.x + dx * 40, h.y - SIM.RIG.shoulder + 8 + dy * 40)); if (S.t - lt > 3) { inp.keys.push('Space'); lt = S.t; } }
    // a potion once HP has sat under the line for the time it takes to notice
    if (h.hp < st.maxHp * P.hp) { if (lowT < 0) lowT = S.t; if (S.t - lowT >= P.react && held(h, 'hp_potion')) { inp.keys.push('KeyQ'); lowT = -1; } } else lowT = -1;
    cur.minhp = Math.min(cur.minhp, h.hp / st.maxHp); fl.minhp = Math.min(fl.minhp, h.hp / st.maxHp); cur.minmp = Math.min(cur.minmp, h.mp / st.maxMp);
    const B = R.en.find((e) => D.BOSSES[e.type]);
    SIM.step(S, inp);
    // each blow's size before the shield, as a share of the max health, by source group; a plain demon's slam is a group of its
    // own, the heavy hitter (TASKS 225)
    for (const e of S.ev) if (!counted.has(e) && e.blow && (e.k === 'hurt' || (e.k === 'absorb' && e.n >= e.blow))) { const g = (D.ENEMIES[e.src] || {}).kind === 'slam' ? 'heavy' : SRC(e.src || ''); (fl.blows[g] = fl.blows[g] || []).push(+(e.blow / st.maxHp).toFixed(3)); }
    for (const e of S.ev) if (!counted.has(e)) { counted.add(e); if (e.k === 'drink') { cur[e.b]++; fl[e.b]++; } else if (e.k === 'pickup' && e.s === D.CONSUMABLES.hp_potion.name) cur.potFound = (cur.potFound || 0) + 1; else if (e.k === 'trade' && e.n < 0 && e.s === 'Куплено: ' + D.CONSUMABLES.hp_potion.name) cur.potBought = (cur.potBought || 0) + 1; else if (e.k === 'hurt') { const g = SRC(e.src || ''); fl.dmg[g] = (fl.dmg[g] || 0) + e.n; fl.hits++; fl.dmgHp += e.n / st.maxHp; cur.hurt++; } else if (COUNT.includes(e.k)) cur[e.k]++; }
    if (B && !fl.boss && (B.hp < B.max || (R.arena && R.arena.active))) fl.boss = { t0: S.t, t: 0, dmg: 0, pot: 0, hp0: +(h.hp / st.maxHp).toFixed(3), bag: held(h, 'hp_potion'), minhp: 1, by: {} };
    if (fl.boss && !fl.boss.done) { const b = fl.boss; b.t = +(S.t - b.t0).toFixed(1);
      for (const e of S.ev) if (e.t === S.t) { if (e.k === 'hurt') { b.dmg += e.n / st.maxHp; const g = / снаряд$/.test(e.src || '') ? 'volley' : D.BOSSES[(e.src || '').split(' ')[0]] ? B && B.mv || 'boss' : (e.src || '?').split(' ')[0]; b.by[g] = +((b.by[g] || 0) + e.n / st.maxHp).toFixed(3); } else if (e.k === 'drink' && e.b === 'hp_potion') b.pot++; }
      b.minhp = +Math.min(b.minhp, h.hp / st.maxHp).toFixed(3);
      if (!S.run || !B || B.deadT >= 0 || h.deadT >= 0) { b.done = 1; b.died = h.deadT >= 0 ? 1 : 0; } }
    if (!S.run && cur) cur.floors.push(floorLine(R, h));
  }
  if (cur && !cur.result) { cur.result = stuck ? stuck : { how: 'timeout', floor: S.run ? S.run.floor : 0 }; out.push(cur); log(cur, S); }
  return out;
}

module.exports = { play, PROFILES, VERSION };
