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
const SRC = (k) => /снаряд/.test(k) ? 'bolt' : k === 'spike' || k === 'lava' ? 'trap' : k === 'burn' || k === 'poison' ? 'dot' : /элита|boss/.test(k) ? 'elite' : 'mob';
const ZOOM = D.ZOOM || 1, BLK = new WeakMap(), T = 32, STUCK = 400, IDLE = 120, CHASE = 10, FLANK = 8, HOLD = 3, HR = 12, COUNT = ['whirl', 'cast', 'shield'];

// react: seconds before a wind-up or a bolt is noticed; dodge: chance to dash out of one noticed in time; aim: drift of the aim
// (rad); hp: potion below this share of HP; mp: drinks mana in a fight; whirl: monsters in reach to spin; fire: mana kept back
// before a fireball; shield: cast below this share of HP; focus: casters first; kite: backs off with low HP and no potion;
// gift: highest altar tier taken; step: walks back out of a wind-up's reach while the dash recharges; traps: keeps off a spike
// plate that is up or about to rise; haz: steps out of a magma hazard's ring over its warning (TASKS 406: they are plain to see, the
// novice aside); water: reads the cave's water (TASKS 468): goes to the bank by an eel's bubbles to strike it as it comes up, and
// keeps off a drowned lying in the shallows on the way to another foe; flank: share of armoured crabs (and warded elites) it walks round to strike off
// the armour (the rest it hacks at the front); tips: reads the game's hints (TASKS 390): whirls on the whirl's hint once it has
// had time to read it, and from then on whirls a crowd of the hint's size;
// cast: the share of its damage this player means to deal with the fireball, as it weighs gear;
// simple: judges gear by its attack and defence numbers alone; skills: ranks one ability to the top before the next; caster: throws
// the fireball whenever it is ready and the target is in sight, close or far, and keeps more mana potions
// builder: the player's own run on hard (TASKS 245): a strength build that reads every property and gathers fire, INT and crit
// from its gear, ranks the fireball first and burns the bosses with it
// a run through the town (TASKS 1024): quests, how many side quests it takes at once (the Keeper's chain besides); home, whether it
// reads a scroll of return when its health potions run out; scrolls, how many it keeps for that
const TOWN = { novice: { quests: 1, home: 0, scrolls: 0 }, average: { quests: 2, home: 1, scrolls: 2 }, expert: { quests: 3, home: 1, scrolls: 2 }, mage: { quests: 2, home: 1, scrolls: 2 }, builder: { quests: 2, home: 1, scrolls: 2 } };
const PROFILES = {
  novice: { tips: 1, flank: 0.5, react: 0.45, dodge: 0.1, aim: 0.35, hp: 0.25, mp: 0, whirl: 4, fire: 60, shield: 0, focus: 0, kite: 0, gift: 1, simple: 1, stats: ['str', 'vit', 'agi', 'int'] },
  average: { haz: 1, water: 1, flank: 1, react: 0.3, dodge: 0.4, aim: 0.15, hp: 0.4, mp: 1, whirl: 3, fire: 30, shield: 0.6, focus: 0, kite: 0, gift: 3, stats: ['str', 'vit', 'str', 'vit', 'agi'] },
  expert: { haz: 1, water: 1, flank: 1, react: 0.15, dodge: 0.9, aim: 0.05, hp: 0.5, mp: 1, whirl: 2, fire: 12, shield: 0.7, focus: 1, kite: 1, gift: 3, step: 1, traps: 1, stats: ['str', 'vit', 'str', 'vit', 'agi'] },
  mage: { haz: 1, water: 1, flank: 1, react: 0.3, dodge: 0.4, aim: 0.15, hp: 0.4, mp: 1, whirl: 3, fire: 12, shield: 0.6, focus: 0, kite: 0, gift: 3, cast: 0.6, stats: ['int', 'vit', 'int', 'vit', 'agi'] },
  builder: { haz: 1, water: 1, flank: 1, react: 0.3, dodge: 0.4, aim: 0.15, hp: 0.4, mp: 1, whirl: 3, fire: 12, shield: 0.6, focus: 0, kite: 0, gift: 3, cast: 0.5, caster: 1, skills: ['fireball', 'whirl', 'shield'], stats: ['str', 'vit', 'str', 'vit', 'agi'] },
};

function rng(seed) { let a = seed >>> 0; const draw = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  draw.state = (value) => { if (value !== undefined) a = value; return a; }; return draw; }

const toPx = (R, x, y) => ({ px: (x - R.cam[0]) * ZOOM, py: (y - R.cam[1]) * ZOOM });
const click = (r) => ({ px: r.x + r.w / 2, py: r.y + r.h / 2, click: 1, keys: [] });
const val = (x) => x ? (x.atk || 0) * 2 + (x.def || 0) * 2 + x.rar * 3 + x.lvl : -1;
// what a piece of gear is worth to this player: the hero's stats with it worn in its slot (TASKS 245). Offence is a swing's damage
// with crits at the swing rate, and the fireball's at its own, mixed by the share the player casts; survival is the health through
// armour and dodge, with what regeneration and blows that heal add over a fight. Their product, so neither is given up for the other
const worth = (S, h, P, it, slot = it && D.BASES[it.b].slot) => { if (P.simple) return val(it);
  const st = SIM.stats(Object.assign({}, h, { eq: Object.assign({}, h.eq, { [slot]: it || null }) }), S.meta), KD = 20 + 12 * (S.run ? S.run.floor : 1);
  const swing = st.atk * (1 + st.crit / 100 * 0.75) * (1 + st.aspd / 100) / st.wcd, F = D.ABILITIES.find((a) => a.id === 'fireball');
  const fire = D.fireDmg(st.spellBase, D.abRank('fireball', Math.max(1, h.ab.fireball || 0)).k, st.spell) / F.cd * Math.min(1, st.maxMp / 200), c = P.cast || 0.15;
  return Math.log(swing * (1 - c) + fire * c) + Math.log((st.maxHp + 20 * st.regen + 10 * st.onhit) * (KD + st.def) / KD / (1 - st.dodge / 100)); };
const gear = (it) => it && !SIM.isCons(it);
// gear the hero is too low to wear (TASKS 1028) is not bought for wearing, nor put on
const wearable = (h, it) => h.lvl >= D.reqLvl(it);
const held = (h, b) => h.bag.reduce((n, it) => n + (it && it.b === b ? it.n || 1 : 0), 0);
// a town-only rank (the storage chest's cells) buys nothing in a run the bot plays
const metaNext = (S) => D.META.filter((M) => !M.town && (S.meta.up[M.id] || 0) < M.max && S.meta.shards >= M.cost(S.meta.up[M.id] || 0))
  .sort((a, b) => a.cost(S.meta.up[a.id] || 0) - b.cost(S.meta.up[b.id] || 0))[0];
const shrineGift = (S, R, P) => [3, 2, 1].find((tier) => tier <= P.gift && S.meta.shards >= D.giftCost(tier, R.floor));

// the hero's health, attack and armour on a floor's arrival, and without each source in turn: all gear, bought gear, altar gifts,
// meta ranks; the levels' share is what is left without gear, gifts and meta
const power = (S, h) => { const f = (hh, meta) => { const st = SIM.stats(hh, meta); return [st.maxHp, st.atk, st.def]; }, eq = (keep) => Object.fromEntries(Object.entries(h.eq).filter(([, it]) => it && keep(it)));
  return { all: f(h, S.meta), noGear: f(Object.assign({}, h, { eq: {} }), S.meta), noBought: f(Object.assign({}, h, { eq: eq((it) => !it.bought) }), S.meta),
    noGifts: f(Object.assign({}, h, { perks: {} }), S.meta), noMeta: f(h, { up: {} }), bare: f(Object.assign({}, h, { eq: {}, perks: {} }), { up: {} }) }; };
// descend: past the serpent the bot takes the stairs on into the endless descent instead of the portal out (TASKS 354)
// a run from the main menu: a test run's button is behind «Тесты» (TASKS 417). The bot steps onto that screen without a sim step: the
// run's seed counts the clock, and one step more there would give every test run other floors than the ones measured before
function startRun(S, mode) {
  for (const [screen, id] of D.startPath(mode)) { const b = (screen === 'menu' ? D.UI.menu(false) : D.UI.tests(false)).find((q) => q.id === id);
    if (id === 'tests') S.screen = 'tests'; else SIM.step(S, click(b)); }
}

function play({ seed = 1, profile = 'average', runs = 1, diff = 'normal', mode = 'campaign', initial = null, checkpoint = null, log = () => {}, descend = false, stopAfter = 0, hours = 1, noTown = false } = {}) {
  const P = Object.assign({}, PROFILES[profile], noTown ? { quests: 0, home: 0, scrolls: 0, noTown: 1 } : TOWN[profile]), rand = rng(seed * 7919 + Object.keys(PROFILES).indexOf(profile));
  if (initial && (initial.seed !== seed || initial.profile !== profile || initial.diff !== diff || runs !== 1)) throw new Error('checkpoint parameters differ');
  const S = initial ? initial.S : SIM.spawn(0, {});
  if (!initial) { S.seedBase = seed; S.meta.diff = diff; startRun(S, mode); }

  const out = [], chased = new Map(), flanked = new Map(), given = new Set(), seen = new Set(), counted = new WeakSet(), been = new Set(), low = new Map();
  // the town: the roles that were told «not now» this visit, the floor last left for the town, a scroll wanted from the bag
  const declined = new Set(); let homeF = -1, readWant = 0, inTown = 0;
  let holdT = 0, poolHeld = 0, gearKey = '', unstick = 0, cur = null, fl = null, altarF = 0, backT = -9, backX = 0, backY = 0, focus = null, f0 = 0, tF = 0, lowT = -1, aimN = 0, aimT = -9, lx = 0, ly = 0, lt = 0, stuck = 0, goal = null, progT = 0, kills0 = 0, learned = 0;
  if (initial) {
    [cur, fl, altarF, backT, backX, backY, focus, f0, tF, lowT, aimN, aimT, lx, ly, lt, stuck, goal, progT = S.t, kills0 = S.run ? S.run.kills : 0, learned = 0] = initial.vars;
    rand.state(initial.rng); for (const event of S.ev) counted.add(event);
    const R = S.run, hp = D.DIFF[R.diff || 'normal'].hp, hpScale = hp > 1 ? 1 + (hp - 1) * Math.min(1, R.floor / 3) : hp;
    const ST = D.stageOf(R.mode, R.floor, R.seed, R.campaignWon ? D.RUNS.campaign.floors + 1 : 1), depth = ST.depth, sc = D.BAL.hp * hpScale * D.hpAt(depth), dc = D.BAL.dmg * 1.35 * D.dmgAt(depth);
    for (const e of R.en) {
      const E = D.ENEMIES[e.type], boss = !!D.BOSSES[e.type], guard = e.guard && ST.guard, gd = (typeof guard === 'object' ? guard.dmg : guard) || 1, gh = (typeof guard === 'object' ? guard.hp : guard) || 1;
      const bk = (boss && ST.bossK) || { hp: 1, dmg: 1 }, health = e.hp / e.max; e.max = Math.round(E.hp * sc * (e.elite && !boss ? D.eliteK(e, 'hp') : 1) * gh * bk.hp); e.hp = e.max * health;
      e.dmg = E.dmg * dc * (boss ? D.dmgAt(depth, 1) / D.dmgAt(depth) : 1) * (!e.elite ? ST.mob : boss ? 1.35 : D.eliteK(e, 'dmg')) * gd * bk.dmg;
    }
  }
  const fresh = () => ({ town: { visits: 0, taken: 0, turned: 0, scrolls: 0 }, seed, mode, ver: VERSION, resumed: initial ? 1 : 0, floors: [], hp_potion: 0, mp_potion: 0, whirl: 0, cast: 0, shield: 0, dodges: 0, hurt: 0, gifts: 0, altars: [], sold: 0, spent: 0, ups: 0, minhp: 1, minmp: 1 });
  const chase = (R, o) => { const t = (chased.get(o) || 0) + SIM.DT; chased.set(o, t); if (t > CHASE) given.add(o); return t <= CHASE; };
  // the way round a wall: a target close in a straight line can still be a long walk away
  const pathLen = (R, x, y) => { const m = R.map, h = R.hero, F = SIM.flow(m, Math.floor(x / T), Math.floor(y / T), 1), v = F[Math.floor(h.y / T) * m.W + Math.floor(h.x / T)]; return v < 0 ? 1e9 : v * T; };
  // a goal off the floor (a salamander in the lava by the bank, TASKS 413 seed 20) is walked to by its nearest floor cell: a field
  // from a lava cell is empty, and the bot stood still for good
  const goalCell = (m, x, y) => { const gx = Math.floor(x / T), gy = Math.floor(y / T); if (SIM.cell(m, gx, gy) === 1) return [gx, gy]; let best = null;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (SIM.cell(m, gx + i, gy + j) === 1) { const d = Math.hypot((gx + i + 0.5) * T - x, (gy + j + 0.5) * T - y); if (!best || d < best[0]) best = [d, gx + i, gy + j]; }
    return best ? [best[1], best[2]] : [gx, gy]; };
  function walk(R, inp, x, y, round) {
    const m = R.map, h = R.hero, [fx, fy] = goalCell(m, x, y), F = SIM.flow(m, fx, fy, 1), tx = Math.floor(h.x / T), ty = Math.floor(h.y / T);
    // in lava (a dash or a blow carried it in): out by the nearest floor first, or with no floor next to it it burns where it stands;
    // a floor the way on starts from, if there is one: the nearest may be the far bank, a pocket behind locked doors (seed 120, hard)
    if (SIM.cell(m, tx, ty) === 3) { const seen = new Set([ty * m.W + tx]), q = [[tx, ty]], banks = [];
      for (let i = 0; i < q.length; i++) { const [cx, cy] = q[i];
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + ax, ny = cy + ay, k = ny * m.W + nx; if (seen.has(k)) continue; seen.add(k);
          if (SIM.cell(m, nx, ny) === 1) banks.push([nx, ny]); else if (SIM.cell(m, nx, ny) === 3) q.push([nx, ny]); } }
      const bank = banks.find(([cx, cy]) => F[cy * m.W + cx] >= 0) || banks[0];
      if (bank) { const ex = bank[0] * T + 16 - h.x, ey = bank[1] * T + 18 - h.y; if (Math.abs(ex) > 4) inp[ex > 0 ? 'right' : 'left'] = 1; if (Math.abs(ey) > 4) inp[ey > 0 ? 'down' : 'up'] = 1; }
      return; }
    let gx = x - h.x, gy = y - h.y;
    if (round || Math.hypot(gx, gy) > 40) { let best = null;
      // standing in a prop's own cell (a chest against the wall), the way on may run straight through the prop: step out of the
      // cell away from it first
      let B = BLK.get(m); if (!B) BLK.set(m, B = new Set(m.block)); const inProp = B.has(ty * m.W + tx), ox = tx * T + 16 - h.x, oy = ty * T + 16 - h.y;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = F[(ty + ay) * m.W + tx + ax]; if (v >= 0 && (!inProp || ax * ox + ay * oy <= 0) && (!best || v < best[0])) best = [v, ax, ay]; }
      // the only way on may lead past the prop's middle (a merchant's shelf in a pocket of shelves, seed 64): take it, aimed past the
      // prop on the side the hero stands (straight at it he pushes into the prop for good, seed 202)
      let past = 0; if (!best && inProp) for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = F[(ty + ay) * m.W + tx + ax]; if (v >= 0 && (!best || v < best[0])) { best = [v, ax, ay]; past = 1; } }
      if (!best && inProp && S.t - lt > 1) {
        if (backT <= S.t) { const side = Math.sign(h.x - (tx + 0.5) * T) || 1;
          const [ax, ay] = [[side, 0], [-side, 0], [0, -1], [0, 1]].find(([dx, dy]) => SIM.cell(m, tx + dx, ty + dy) === 1 && !B.has((ty + dy) * m.W + tx + dx)) || [0, 0];
          backT = S.t + 0.7; backX = ax; backY = ay;
        }
        return;
      }
      if (best) { gx = (tx + best[1]) * T + 16 - h.x; gy = (ty + best[2]) * T + 18 - h.y;
        // the side is the hero's own unless a wall stands there (a stand by the wall, seed 202)
        if (past) { const [, ax, ay] = best, along = ax ? 1 : 0; let side = Math.sign(along ? -oy : -ox) || 1;
          const open = (q) => along ? SIM.cell(m, tx, ty + q) === 1 && SIM.cell(m, tx + ax, ty + q) === 1 : SIM.cell(m, tx + q, ty) === 1 && SIM.cell(m, tx + q, ty + ay) === 1;
          if (!open(side) && open(-side)) side = -side; if (along) gy = side * 24 - oy; else gx = side * 24 - ox; } } }
    if (Math.abs(gx) > 4) inp[gx > 0 ? 'right' : 'left'] = 1; if (Math.abs(gy) > 4) inp[gy > 0 ? 'down' : 'up'] = 1;
  }
  const steer = (inp, dx, dy) => { if (Math.abs(dx) > 0.38) inp[dx > 0 ? 'right' : 'left'] = 1; if (Math.abs(dy) > 0.38) inp[dy > 0 ? 'down' : 'up'] = 1; };
  // the dash goes along the held direction keys
  const dash = (inp, dx, dy) => { const d = Math.hypot(dx, dy) || 1; inp.left = inp.right = inp.up = inp.down = 0; steer(inp, dx / d, dy / d); inp.keys.push('Space'); cur.dodges++; };
  function dodge(S, R, inp, live) {
    const h = R.hero, t = S.t, ready = h.cd.dash <= t;
    // an archer's aim stops following the hero `arrow.lock` s before the loose (sim.js): one on its line then steps off it, a
    // walk across, not a dash, and the arrow flies past (TASKS 468); not with a foe at arm's length, who would strike the back turned to it
    const close = live.some((o) => { const K0 = D.ENEMIES[o.type].kind; return K0 !== 'archer' && K0 !== 'caster' && o.st !== 'lurk' && Math.hypot(o.x - h.x, o.y - h.y) < 70; });
    if (!close) for (const e of live) { const E = D.ENEMIES[e.type]; if (E.kind !== 'archer' || e.st !== 'wind') continue;
      const w = D.windOf(e, E.wind), age = t - e.t0, key = 'a' + e.id + ':' + e.t0; if (age < Math.max(P.react, w - E.arrow.lock) || age > w || seen.has(key)) continue; seen.add(key);
      const ux = Math.cos(e.aimA), uy = Math.sin(e.aimA), rx = h.x - e.x, ry = h.y - 38 - (e.y - SIM.ARROW_Y), cr = rx * uy - ry * ux;
      if (rx * ux + ry * uy < 0 || Math.abs(cr) > 30 || rand() >= P.dodge) continue;
      const sd = cr >= 0 ? 1 : -1; backT = t + w - age + 0.3; backX = uy * sd; backY = -ux * sd; }
    if (!ready && !P.step) return;
    for (const e of live) { if (e.st !== 'wind' && e.st !== 'bwind') continue;
      // a boss is dodged only on the moves that strike with its body (the volley is read bolt by bolt below); the slam that follows
      // a charge the hero got out of is a pattern a player learns, met without waiting to see it wind up (TASKS 227)
      if (e.st === 'bwind' && (!['slam', 'charge', 'bite', 'tail', 'wave', 'fists', 'crack'].includes(e.mv) || !(D.bossMove(e).dmg > 0))) continue;
      const E = D.ENEMIES[e.type], age = t - e.t0, key = e.id + ':' + e.t0; if (age < (e.chain ? 0 : P.react) || seen.has(key)) continue; seen.add(key);
      const w = e.st === 'bwind' ? D.bossMove(e).wind : D.windOf(e, E.wind), d = Math.hypot(h.x - e.x, h.y - e.y);
      if (age > w || E.kind === 'caster' || E.kind === 'archer' || e.spit) continue;
      const range = e.st === 'bwind' ? (['bite', 'tail', 'fists'].includes(e.mv) ? D.bossMove(e).r + HR : e.mv === 'slam' ? 150 : e.mv === 'crack' ? D.bossMove(e).len : 1e9) : E.boom ? E.boom.r + 20 : E.kind === 'slam' ? 74 + HR + 20 : e.rush ? E.r + HR + E.rush.reach + 20 : E.r + HR + E.reach * 1.25 + 24;
      if (d > range || rand() >= P.dodge) continue;
      const ax = (h.x - e.x) / (d || 1), ay = (h.y - e.y) / (d || 1);
      if (!ready) { if (e.st === 'wind' || e.chain) { backT = t + w - age + 0.12; backX = ax; backY = ay; } continue; }
      if ((e.st === 'bwind' && !['slam', 'tail', 'bite', 'fists'].includes(e.mv)) || e.rush) dash(inp, -ay, ax); else dash(inp, ax, ay); return; }
    if (!ready) return;
    // a tugging elite's warning (TASKS 477): a dash across its line before it draws the hero in
    // (late in it: a dash slips the tug only while under way, BAL.dodge.t)
    for (const e of live) { if (!e.tugW || e.tugW <= t || e.tugW - t > 0.15 || seen.has('t' + e.id + ':' + e.tugW) || D.ELITE_MODS.find((q) => q.id === 'tug').warn - (e.tugW - t) < P.react) continue;
      seen.add('t' + e.id + ':' + e.tugW); if (rand() >= P.dodge) continue; const d = Math.hypot(h.x - e.x, h.y - e.y) || 1; dash(inp, -(h.y - e.y) / d, (h.x - e.x) / d); return; }
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
  // the magma caves' hazards (TASKS 406, data.js HAZ) and a fire priest's rings (TASKS 410): out of a ring that will burst within its
  // warning (a dash when it is about to), and no step into one that bursts within the next 0.9 s; a ring keeps its pull a little past its edge
  const hazSoon = (t, z) => { const H = D.HAZ[z.k], c = D.hazClock(z, t); return c < H.burst ? 0 : z.per - c; };
  const rings = (S, R) => (R.map.hazards || []).map((z) => { const H = D.HAZ[z.k]; return { x: z.x, y: z.y, r: H.r, ry: H.ry, warn: H.warn, soon: hazSoon(S.t, z) }; })
    .concat((R.pyres || []).map((p) => { const P = D.ENEMIES.fire_priest.pyre; return { x: p.x, y: p.y, r: P.r, ry: P.ry, warn: P.warn, soon: Math.max(0, P.warn - (S.t - p.t0)) }; }))
    // a salamander's fire on the floor and a golem's pool (TASKS 408, 409) burn as long as they last: walked out of, not dashed out of
    .concat((R.fires || []).map((p) => ({ x: p.x, y: p.y, r: p.r, ry: p.ry, warn: 1, soon: 0.5, pool: p.kind === 'pool' && D.BOSSES[p.who] ? 1 : 0 })))
    // the colossus's boulder and its rain of rocks (TASKS 413) are rings on the floor until they land
    .concat((R.rocks || []).filter((q) => q.x !== undefined && S.t >= q.t0).map((q) => ({ x: q.x, y: q.y, r: q.r, ry: 0.75, warn: q.t - q.t0, soon: Math.max(0, q.t - S.t) })));
  // the colossus's eruption (TASKS 413): to the slab of cover nearest the hero, beside it on his side, while rocks fall
  const rainOn = (R, live) => (R.rocks || []).some((q) => q.kind === 'rain') || live.some((e) => e.st === 'bwind' && (e.mv === 'rain' || e.mv === 'erupt'));
  function shelter(R) { const m = R.map, h = R.hero; let best = null;
    for (const d of m.decor) { if (!d.cover || d.broken) continue; const tx = Math.floor(d.x / T), ty = Math.floor(d.y / T);
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (SIM.cell(m, tx + ax, ty + ay) !== 1) continue; const x = (tx + ax) * T + 16, y = (ty + ay) * T + 18, dd = Math.hypot(x - h.x, y - h.y); if (!best || dd < best[0]) best = [dd, x, y]; } }
    return best && { x: best[1], y: best[2] }; }
  const hazNear = (z, x, y, pad) => Math.hypot(x - z.x, (y - z.y) / z.ry) < z.r + pad;
  function avoidHazards(S, R, h, inp) {
    const hz = rings(S, R); if (!hz.length) return;
    const under = hz.find((z) => hazNear(z, h.x, h.y, 18) && z.soon < z.warn + 0.1);
    if (under) { const ax = h.x - under.x, ay = (h.y - under.y) / under.ry, d = Math.hypot(ax, ay) || 1;
      if (under.soon < 0.3 && h.cd.dash <= S.t && !inp.keys.includes('Space')) { dash(inp, ax / d || 1, ay / d); return; }
      inp.left = inp.right = inp.up = inp.down = 0; steer(inp, ax / d || 1, ay / d); return; }
    const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); if (!dx && !dy) return;
    const nx = h.x + dx * 30, ny = h.y + dy * 30;
    const stop = hz.find((z) => hazNear(z, nx, ny, 12) && !hazNear(z, h.x, h.y, 12) && z.soon < 0.9); if (stop) { inp.left = inp.right = inp.up = inp.down = 0; if (stop.pool) poolHeld = 1; }
  }
  // which way round a crab to go (+1 / −1) while the hero stands within its armour's arc (a little wider, it turns as he goes), else 0
  // a warded elite of the deep descent (TASKS 387) the same way: its shield takes the blows from its front half, one from behind breaks it
  const armFront = (e) => { const E = D.ENEMIES[e.type], arc = E.armor ? E.armor.arc : e.ward > 0 ? Math.PI / 2 : 0; if (!arc || !(P.flank > 0) || ((Math.imul(e.id + 1, 2654435761) ^ seed) >>> 0) % 1000 / 1000 >= P.flank) return 0;
    const h = S.run.hero, fa = e.fa ?? (e.face > 0 ? 0 : Math.PI); let r = Math.atan2(h.y - e.y, h.x - e.x) - fa; r = Math.atan2(Math.sin(r), Math.cos(r));
    return Math.abs(r) < arc + 0.35 ? (r >= 0 ? 1 : -1) : 0; };
  // a target in deep water is struck from the shore: the nearest floor cell within a blow of it (true once there)
  function toBank(R, inp, tg, st) { const h = R.hero, E = D.ENEMIES[tg.type];
    if (Math.hypot(tg.x - h.x, (tg.y - h.y) * 1.25) <= st.reach + E.r + HR - 8) return true;
    const m = R.map, F = SIM.flow(m, Math.floor(h.x / T), Math.floor(h.y / T), 1); let best = null;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const x = (Math.floor(tg.x / T) + i + 0.5) * T, y = (Math.floor(tg.y / T) + j + 0.5) * T, k = Math.floor(y / T) * m.W + Math.floor(x / T);
      if (F[k] < 0 || m.cells[k] !== 1 || Math.hypot(x - tg.x, (y - tg.y) * 1.25) > st.reach + E.r + HR - 12) continue;
      if (!best || F[k] < best.d) best = { x, y, d: F[k] }; }
    if (best) walk(R, inp, best.x, best.y); return false; }
  // the bubbles where an eel will come up (sim.js eel: 'stir', `warn` s) by the hero: to the bank by them, to strike it as it rises
  const EEL_STIR = 200;
  // on the way to a fight with others: no step into a lying drowned's sense (in a fight at arm's length the blows come first); held
  // back at most HOLD s on end
  function keepOff(S, R, h, inp, lurk) { const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); if (!dx && !dy) return;
    const nx = h.x + dx * 26, ny = h.y + dy * 26, E = D.ENEMIES.drowned;
    const bad = (x, y) => lurk.some((o) => Math.hypot(o.x - x, o.y - y) < E.sense + 14);
    if (!bad(nx, ny)) { holdT = 0; return; } if (bad(h.x, h.y)) return;
    if ((holdT += SIM.DT) > HOLD) return; inp.left = inp.right = inp.up = inp.down = 0; }
  function fight(S, R, inp, live, st, walkD) {
    const h = R.hero, dist = (e) => Math.hypot(e.x - h.x, e.y - h.y);
    // the nearest by the walk, not the crow: two foes about as far in a straight line but round a wall from each other swap
    // places as the nearest with each step, and the bot walks back and forth between their paths for good
    const far = (e) => Math.max(dist(e), walkD(e));
    let tg = live.reduce((a, e) => (!a || far(e) < far(a) ? e : a), null);
    // a caster once picked stays the target while it is within 400 px: a fixed 320 px line flips the target every step for one
    // standing on it, and the bot walks back and forth between two paths for good; by the walk too: a caster close through a wall
    // was picked and dropped on the way round, and the bot circled in the corridor (seed 193, TASKS 227)
    if (P.focus) { if (!(focus && focus.deadT < 0 && live.includes(focus) && far(focus) < 400)) focus = live.filter((e) => (D.ENEMIES[e.type].kind === 'caster' || D.ENEMIES[e.type].kind === 'archer') && far(e) < 320).sort((a, b) => far(a) - far(b))[0] || null;
      if (focus) tg = focus; }
    // a fire priest within reach is struck first by all but the novice: left alone it lights the whole pack's weapons (TASKS 410)
    if (P.haz) { const pr = live.filter((e) => e.type === 'fire_priest' && far(e) < 360).sort((a, b) => far(a) - far(b))[0]; if (pr) tg = pr; }
    if (S.t > aimT) { aimT = S.t + 0.4; aimN = (rand() + rand() + rand() - 1.5) * 2 * P.aim; }
    const E = D.ENEMIES[tg.type], td = dist(tg), ox = h.x, oy = h.y - SIM.RIG.shoulder + 8, a = Math.atan2(tg.y - 30 - oy, tg.x - ox) + aimN, r = Math.hypot(tg.y - 30 - oy, tg.x - ox);
    Object.assign(inp, toPx(R, ox + Math.cos(a) * r, oy + Math.sin(a) * r));
    const low = h.hp < st.maxHp * 0.3 && !held(h, 'hp_potion');
    if (P.kite && low && td < 160) { steer(inp, (h.x - tg.x) / td, (h.y - tg.y) / td); }
    else if (E.deep) { if (toBank(R, inp, tg, st)) inp.press = 1; }
    // blind: rock between them (a corner) stops the blow; a drowned lying in its shallows round a corner never rises to meet it and
    // the bot swung at the rock for good (TASKS 339): walk round to a clear line
    else { const blind = !SIM.losClear(R.map, h.x, h.y, tg.x, tg.y), round = blind || pathLen(R, tg.x, tg.y) > td + 64; // the sim measures a blow's reach with the floor's depth stretched by 1.25
      // a crab's armour faces the hero (TASKS 309): from before it, circle round it close, inside its rush and toward its back, and
      // strike only once off its armour; a blow on the armour does a fifth
      // a crab in a narrow way (deep water on one side, rock on the other) can't be walked round: the bot circled before its armour
      // for 300 s (run seed 129, the 12th, TASKS 335). The side with floor to stand on, else the other; with neither, or still before the armour
      // after `FLANK` s on end, it hacks at the front as a player would who sees there is no getting behind
      const Rc = E.r + HR + 16, ah = Math.atan2(h.y - tg.y, h.x - tg.x), spot = (side) => { const a2 = ah + side * 0.7, px = tg.x + Math.cos(a2) * Rc, py = tg.y + Math.sin(a2) * Rc;
        return SIM.cell(R.map, Math.floor(px / T), Math.floor(py / T)) === 1 ? [px, py] : null; };
      let fr = armFront(tg), sp = null; if (!fr) flanked.delete(tg.id);   // off the armour: the next stand before it counts afresh
      if (fr && !round && td < 260) { const ft = (flanked.get(tg.id) || 0) + SIM.DT; flanked.set(tg.id, ft); sp = ft <= FLANK && (spot(fr) || spot(-fr)); if (!sp) fr = 0; }
      if (fr && !round && td < 260) { const [px, py] = sp;
        steer(inp, (px - h.x) / (Math.hypot(px - h.x, py - h.y) || 1), (py - h.y) / (Math.hypot(px - h.x, py - h.y) || 1)); }
      else if (round || Math.hypot(tg.x - h.x, (tg.y - h.y) * 1.25) > st.reach + E.r + HR - 8) walk(R, inp, tg.x, tg.y, round); else inp.press = 1; }
    if (h.ab.fireball && !armFront(tg) && td > (P.caster ? 0 : 140) && td < (P.caster ? 380 : 330) && h.cd.fireball <= S.t && h.mp >= Math.max(P.fire, 12)
      && (!P.caster || SIM.losClear(R.map, ox, oy + 20, tg.x, tg.y - 10))) inp.slot = 2;
    const tip = P.tips && R.msg && R.msg.tip === 'whirl' && S.t - R.msg.t >= P.react && S.t - R.msg.t < R.msg.d; if (tip) learned = 1;
    if (h.cd.whirl <= S.t && (tip || live.filter((e) => dist(e) < 90 + D.ENEMIES[e.type].r).length >= (learned ? Math.min(P.whirl, D.TIPS.whirl.n) : P.whirl))) inp.slot = 1;
    if (P.shield && h.ab.shield && h.cd.shield <= S.t && h.mp >= D.ABILITIES.find((a) => a.id === 'shield').mp && h.hp < st.maxHp * P.shield) inp.slot = 3;
    if (P.mp && h.mp < 12 && td < 330 && held(h, 'mp_potion')) inp.keys.push('KeyR');
  }
  // at the counter: sell every spare piece of gear, buy what beats the worn piece, then potions; one click a step
  function trade(S, R, h) {
    const U = D.UI.shop(R.shop.goods.length), at = (id) => click(U.r.find((q) => q.id === id));
    const i = h.bag.findIndex(gear); if (i >= 0) { cur.sold++; return at('sell:' + i); }
    const room = h.bag.includes(null), buy = (g) => { cur.spent += g.price; return at('buy:' + R.shop.goods.indexOf(g)); };
    const up = R.shop.goods.find((g) => !g.n && g.price <= h.gold && wearable(h, g.it) && worth(S, h, P, g.it) > worth(S, h, P, h.eq[D.BASES[g.it.b].slot], D.BASES[g.it.b].slot) + 1e-6); if (up && room) return buy(up);
    for (const [b, want] of [['hp_potion', 6], ['mp_potion', P.caster ? 6 : 3]].concat(R.viaTown ? [['scroll', P.scrolls]] : [])) { const g = R.shop.goods.find((q) => q.it.b === b && q.n);
      if (g && held(h, b) < want && g.price <= h.gold && (room || h.bag.some((it) => it && it.b === b && it.n < D.CONSUMABLES[b].stack))) return buy(g); }
    R.shopped = R.floor; return { keys: ['Escape'] };
  }
  // a townsman's talk (TASKS 1024): pages turned with E; on the quest's page E takes it while the profile wants more (the Keeper's
  // chain always), turns a done one in; else «not now», and the townsman is left alone this visit
  function talkStep(S, R) { const T = S.talk; if (!T) return { keys: ['Escape'] }; if (T.p + 1 < T.pages.length) return { keys: ['KeyE'] };
    const side = (R.quests || []).filter((q) => q.id > 0 && q.st !== 'turned' && D.QUESTS[q.key].kind === 'side').length;
    if (T.act && (T.act.k === 'turn' || (P.quests && (D.QUESTS[T.act.key].kind === 'story' || side < P.quests)))) return { keys: ['KeyE'] };
    declined.add(T.role); return { keys: ['Escape'] }; }
  // in the town: turn in what is done, take what the profile wants, shop once a visit, then back down: through the open portal, else the crypt's stairs
  function townGoal(S, R, inp) { const h = R.hero, m = R.map, sv = m.town.svc, F = R.folk || [], dist = (o) => Math.hypot(o.x - h.x, o.y - h.y);
    // before the first way down: the upgrades the bank can buy, at the Altar of Souls
    if (!f0 && metaNext(S)) { walk(R, inp, sv.altar.x, sv.altar.y + 40); if (SIM.atSoulAltar(R)) inp.keys.push('KeyE'); goal = ['altar']; return; }
    const at = (f) => (f.role === 'smith' ? { x: sv.anvil.x, y: sv.anvil.y + 30 } : { x: f.x + 40, y: f.y + 10 });
    const who = !P.noTown && (F.find((f) => SIM.questMark(R, f.role) === '?') || (P.quests && F.find((f) => SIM.questMark(R, f.role) === '!' && !declined.has(f.role))));
    if (who) { const p = at(who); walk(R, inp, p.x, p.y); if (who.role === 'smith' ? SIM.atCraft(R) === 'forge' : SIM.folkNear(R) === who) inp.keys.push('KeyE'); goal = ['folk', who.role]; return; }
    if (!P.noTown && m.shop && R.shopped !== 0) { walk(R, inp, m.shop.front.x, m.shop.front.y); if (SIM.atCounter(R)) inp.keys.push('KeyE'); goal = ['shop']; return; }
    const out = R.portal ? { x: sv.portal.x + 10, y: sv.portal.y + 44 } : m.exit; walk(R, inp, out.x, out.y); goal = [R.portal ? 'portal' : 'exit'];
    if (R.portal ? SIM.atGate(R) : dist(out) < 55) inp.keys.push('KeyE'); }
  function pray(S, R) {
    if (R.shrines[R.altar] && R.shrines[R.altar].used) return { keys: ['Escape'] };
    const sh = R.shrines[R.altar], tier = shrineGift(S, R, P), i = sh && sh.gifts ? sh.gifts.findIndex((g, j) => j + 1 === tier && S.meta.shards >= g.cost) : -1;
    if (sh && sh.gifts && !sh.seen) { sh.seen = 1; cur.altars.push({ f: R.floor, bank: S.meta.shards, c2: sh.gifts[1].cost }); }
    if (i >= 0) { cur.gifts++; return click(D.UI.altar().r[i]); } return { keys: ['Escape'] };
  }
  const floorLine = (R, h) => { const s = R.stats[f0] || {}; return { floor: f0, time: Math.round(S.t - tF), full: [[s.kills, s.foes], [s.loot, s.lootN], [s.sec, s.secN]].filter(([k, n]) => n > 0 && k >= n).length, sec: s.sec || 0, secN: s.secN || 0, foes: s.foes || 0, killed: s.kills || 0, lvl: h.lvl, hp: Math.round(h.hp), maxHp: SIM.stats(h, S.meta).maxHp, kills: R.kills, gold: h.gold, loot: s.loot || 0, lootN: s.lootN || 0, shards: R.shards, bank: S.meta.shards, dodge: Math.round(SIM.stats(h, S.meta).dodge), dmg: fl.dmg, by: fl.by, dmgHp: fl.dmgHp, hits: fl.hits, minhp: fl.minhp, hpPot: fl.hp_potion, mpPot: fl.mp_potion, boss: fl.boss, bt: fl.bt, pw: fl.pw, blows: fl.blows }; };
  const freshFl = () => ({ dmg: {}, by: {}, dmgHp: 0, hits: 0, minhp: 1, hp_potion: 0, mp_potion: 0, blows: {} });
  for (let i = initial ? initial.i : 0; i < 120 * 60 * 60 * runs * hours && out.length < runs; i++) {
    if (!S.run) {
      if (S.screen === 'dead' || S.screen === 'win') { if (cur) { cur.result = S.result; out.push(cur); log(cur, S); cur = null; } SIM.step(S, click(D.UI.end()[0])); continue; }
      if (S.screen === 'meta') { const M = metaNext(S), r = D.UI.meta().find((q) => q.id === (M ? M.id : 'back')); SIM.step(S, click(r)); continue; }
      // the upgrades are bought at the Altar of Souls in the town (TASKS 1026); a test run without the town still buys them from the menu's screen
      if (S.screen === 'menu') { if (metaNext(S) && mode !== 'campaign' && mode !== 'town') { S.screen = 'meta'; S.metaRun = 0; } else startRun(S, mode); continue; }
      SIM.step(S, { keys: ['Escape'] }); continue;
    }
    const R = S.run, h = R.hero, m = R.map;
    if (!cur) { cur = fresh(); cur.meta = Object.assign({}, S.meta.up); f0 = 0; fl = fl || freshFl(); }
    cur.potLeft = held(h, 'hp_potion');
    // a visit to the town (TASKS 1024) is a pause of the floor it left: back through the portal, the floor's line goes on
    if (R.town && !inTown) { inTown = 1; declined.clear(); R.shopped = -1; if (f0) cur.town.visits++; } else if (!R.town) inTown = 0;
    if (R.floor !== f0 && !R.town) { if (f0) cur.floors.push(floorLine(R, h)); else cur.meta = Object.assign({}, S.meta.up);
      if (f0 && altarF === f0 && !cur.altars.some((q) => q.f === f0)) cur.altars.push({ f: f0, bank: S.meta.shards, c2: D.giftCost(2, f0) }); altarF = R.shrines.length ? R.floor : 0; fl = freshFl(); fl.pw = power(S, h); fl.bt = m.bossType; f0 = R.floor; tF = S.t; given.clear(); chased.clear(); flanked.clear(); seen.clear(); holdT = 0; been.clear(); low.clear(); progT = S.t;
      if (checkpoint && runs === 1) checkpoint({ S, seed, profile, diff, i, rng: rand.state(),
        vars: [cur, fl, altarF, backT, backX, backY, focus, f0, tF, lowT, aimN, aimT, lx, ly, lt, stuck, goal, progT, kills0, learned] });
    }
    // stopAfter: a replay from a checkpoint that only wants a floor or two ends once past it, as 'stopped' (tuning, TASKS 354)
    if (stopAfter && R.floor > stopAfter) { stuck = { how: 'stopped', floor: R.floor }; break; }
    // no progress for IDLE s (no new ground, kill or blow that takes a foe lower than before) ends the run as stuck long before the
    // floor's STUCK s: shut out of a sealed arena, the bot pushed at its gate for the rest of the 400 s (TASKS 397, 470)
    const kB = (Math.floor(h.x / (3 * T)) << 12) | Math.floor(h.y / (3 * T)); if (!been.has(kB)) { been.add(kB); progT = S.t; }
    if (R.kills !== kills0) { kills0 = R.kills; progT = S.t; }
    for (const e of R.en) if (e.deadT < 0 && e.hp < (low.get(e.id) ?? e.max)) { low.set(e.id, e.hp); progT = S.t; }
    const why = S.t - tF > STUCK ? 'floor' : S.t - progT > IDLE ? 'idle' : '';
    if (why) { stuck = { how: 'stuck', why, floor: R.floor, at: [Math.floor(h.x / T), Math.floor(h.y / T)], goal }; break; }
    // the points a run starts with are laid out on the hero screen, where each point of VIT or INT comes with its health or mana
    if (R.floor === 1 && S.t - tF < 1 && h.pts > 0) { while (h.pts > 0) { const k = P.stats[h.pts % P.stats.length]; h.base[k]++; h.pts--; } const s0 = SIM.stats(h, S.meta); h.hp = s0.maxHp; h.mp = s0.maxMp; }
    while (h.pts > 0) { const k = P.stats[h.pts % P.stats.length]; h.base[k]++; h.pts--; }
    if (P.skills) { const a = P.skills.map((id) => D.ABILITIES.find((q) => q.id === id)).find((q) => h.lvl >= q.unlock && (h.ab[q.id] || 0) < D.AB_MAX);
      if (a && h.sp > 0) { h.ab[a.id] = (h.ab[a.id] || 0) + 1; h.sp--; } }
    else for (const a of D.ABILITIES) if (h.sp > 0 && h.lvl >= a.unlock && (h.ab[a.id] || 0) < D.AB_MAX) { h.ab[a.id] = (h.ab[a.id] || 0) + 1; h.sp--; }
    // the gear is weighed again only when the bag, the worn set, the level or a rank changed
    const gk = h.bag.map((it) => it ? it.id : 0).join() + '|' + D.SLOTS.map((k) => h.eq[k] ? h.eq[k].id : 0).join() + '|' + h.lvl + '|' + h.ab.fireball + '|' + R.floor;
    if (gk !== gearKey) { gearKey = gk; h.bag.forEach((it, j) => { if (!gear(it) || !wearable(h, it)) return; const sl = D.BASES[it.b].slot, c = h.eq[sl]; if (worth(S, h, P, it) > worth(S, h, P, c, sl) + 1e-6) { cur.ups++; h.eq[sl] = it; h.bag[j] = c || null; } }); }
    if (S.screen === 'shop') { const had = new Set(h.bag.filter(Boolean).map((it) => it.id)), g = h.gold; SIM.step(S, trade(S, R, h));
      if (h.gold < g) for (const it of h.bag) if (it && it.b && !had.has(it.id)) it.bought = 1; continue; }
    if (S.screen === 'altar') { SIM.step(S, pray(S, R)); continue; }
    if (S.screen === 'talk') { SIM.step(S, talkStep(S, R)); continue; }
    if (S.screen === 'meta') { const M = metaNext(S); SIM.step(S, click(D.UI.meta().find((q) => q.id === (M ? M.id : 'back')))); continue; }
    if (S.screen === 'gate') { const o = SIM.gateWays(R), i = o.findIndex((q) => q.k === 'portal'); SIM.step(S, i >= 0 ? click(D.UI.gate(o.length).r[i]) : { keys: ['Escape'] }); continue; }
    if (S.screen === 'inv' && readWant) { const i = h.bag.findIndex((it) => it && it.b === 'scroll'); readWant = 0; if (i >= 0) { cur.town.scrolls++; SIM.step(S, click(D.UI.inv().r.find((q) => q.id === 'bag:' + i))); continue; } }
    if (S.screen !== 'play') { SIM.step(S, { keys: ['Escape'] }); continue; }
    const st = SIM.stats(h, S.meta), inp = { left: 0, right: 0, up: 0, down: 0, press: 0, click: 0, px: 960, py: 540, keys: [], slot: 0 };
    const FH = SIM.flow(m, Math.floor(h.x / T), Math.floor(h.y / T), 1).slice(), offsets = (o) => D.ENEMIES[o.type]?.deep ? [-2, -1, 0, 1, 2].flatMap((j) => [-2, -1, 0, 1, 2].map((i) => j * m.W + i)) : [0, 1, -1, m.W, -m.W];
    const reach = (o) => offsets(o).some((d) => FH[Math.floor(o.y / T) * m.W + Math.floor(o.x / T) + d] >= 0);
    const walkD = (o) => T * Math.min(...offsets(o).map((d) => FH[Math.floor(o.y / T) * m.W + Math.floor(o.x / T) + d]).filter((v) => v >= 0), 1e9);
    // near by the walk too: a foe close through a wall made the bot drop its loot for a fight with another, nearer by the walk, and
    // pick the loot up again once out of the first one's 260 px, back and forth for good (seed 281)
    // a monster behind a door still locked can't be fought, nor an eel under its water (TASKS 310)
    const live = R.en.filter((e) => e.deadT < 0 && !D.under(e) && reach(e)), awake = live.filter((e) => e.st !== 'idle' && e.st !== 'home');
    const near = live.some((e) => Math.hypot(e.x - h.x, e.y - h.y) < 260 && walkD(e) < 520), late = R.floor < D.runOf(R.mode).floors && S.t - tF > 200;
    const room = h.bag.includes(null), takes = (p) => p.kind !== 'item' || room || SIM.isCons(p.item) || (!h.eq[D.BASES[p.item.b].slot] && wearable(h, p.item));
    const dist = (o) => Math.hypot(o.x - h.x, o.y - h.y), first = (list) => list.filter((o) => !given.has(o)).sort((a, b) => dist(a) - dist(b))[0];
    // what lies behind a door still locked is out of reach until its key or lever is found
    const drop = first(R.drops.filter((p) => !p.got && !p.tossed && !(p.fly > 0) && takes(p) && reach(p)));
    const chest = first(R.chests.filter((c) => !c.open && (c.sec === undefined || m.secrets[c.sec].open) && reach(c)));
    const locked = R.keys > 0 ? first((m.doors || []).filter((d) => { const L = SIM.doorLock(m, d); return L && L.kind === 'key'; })) : null;
    const lever = first((m.locks || []).filter((L) => L.kind === 'lever' && !L.open && reach({ x: L.lever.x, y: L.lever.y + 50 })).map((L) => Object.assign({ L }, { x: L.lever.x, y: L.lever.y + 50 })));
    const shrine = first(R.shrines.filter((s) => !s.used && (!m.bossType || !R.en.some((e) => D.BOSSES[e.type] && e.deadT < 0)) && shrineGift(S, R, P)));
    const shop = m.shop && R.shopped !== R.floor && (h.bag.some(gear) || h.gold >= 60) && !given.has(m.shop) ? m.shop : null;
    const aim = (k, o) => { goal = o ? [k, Math.floor(o.x / T), Math.floor(o.y / T)] : [k]; return true; };
    // the cave's water (TASKS 468): an eel stirring by the hero is met on the bank with nothing else at arm's length; a drowned lying
    // in its shallows is kept off on the way to another foe
    const fightT = live.slice().sort((a, b) => Math.max(dist(a), walkD(a)) - Math.max(dist(b), walkD(b)))[0];
    const lurk = P.water ? live.filter((e) => e.st === 'lurk' && e !== fightT) : [], others = awake.filter((e) => e.type !== 'eel' && e.st !== 'lurk');
    const eel = P.water && !others.some((e) => dist(e) < 120) && R.en.find((e) => e.type === 'eel' && e.deadT < 0 && e.st === 'stir' && dist(e) < EEL_STIR && reach(e));
    // home (TASKS 1024): out of health potions, or with gold to spend, or a boss just slain (the town's shelf is stocked anew); a
    // scroll in the bag, nothing awake, no boss's fight; once a floor
    const bossOn = R.en.some((e) => D.BOSSES[e.type] && e.deadT < 0 && e.st !== 'idle');
    if (R.town) townGoal(S, R, inp);
    else if (R.viaTown && P.home && homeF !== R.floor && !awake.length && !near && !bossOn && !h.read && held(h, 'scroll') && h.gold >= 250 && (held(h, 'hp_potion') <= 1 || h.gold >= 300 + 150 * R.floor || R.bossDead)) { homeF = R.floor; readWant = 1; inp.keys.push('KeyI'); goal = ['home']; }
    else if (eel && aim('eel', eel)) toBank(R, inp, eel, st);
    else if (!near && !late && drop && chase(R, drop) && aim('drop', drop)) walk(R, inp, drop.x, drop.y);
    else if (!near && !late && chest && chase(R, chest) && aim('chest', chest)) { walk(R, inp, chest.x, chest.y + 20); if (dist(chest) < 50) inp.keys.push('KeyE'); }
    else if (!near && !late && shrine && chase(R, shrine) && aim('shrine', shrine)) { walk(R, inp, shrine.x, shrine.y + 30); if (dist(shrine) < 55) inp.keys.push('KeyE'); }
    else if (!near && !late && locked && chase(R, locked) && aim('door', locked)) { const dx = locked.dir === 'l' ? -1 : locked.dir === 'r' ? 1 : 0, dy = locked.dir === 'u' ? -1 : locked.dir === 'd' ? 1 : 0;
      walk(R, inp, locked.x + dx * 40, locked.y + dy * 40); if (Math.hypot(locked.x - h.x, locked.y - h.y + 10) < 60) inp.keys.push('KeyE'); }
    else if (!near && !late && lever && chase(R, lever.L) && aim('lever', lever)) { walk(R, inp, lever.x, lever.y); if (SIM.leverNear(R)) inp.keys.push('KeyE'); }
    else if (!near && shop && chase(R, shop) && aim('shop', shop.front)) { walk(R, inp, shop.front.x, shop.front.y); if (SIM.atCounter(R)) inp.keys.push('KeyE'); }
    // a sealed arena opens only on the boss's death: there is no running late past him to the stairs
    else if (live.length && (!late || (R.arena && R.arena.active)) && aim('fight', fightT)) fight(S, R, inp, live, st, walkD);
    else { const out = descend && m.down && R.bossDead ? m.down : m.exit; aim('exit', out); walk(R, inp, out.x, out.y); if (dist(out) < 55) inp.keys.push('KeyE'); }
    if (P.haz && R.arena && R.arena.active && rainOn(R, live)) { const c = shelter(R); if (c) { inp.left = inp.right = inp.up = inp.down = 0; walk(R, inp, c.x, c.y); } }
    if (awake.length || R.en.some((e) => e.fuse)) dodge(S, R, inp, awake);
    if (backT > S.t && !inp.keys.includes('Space')) { inp.left = inp.right = inp.up = inp.down = 0; inp.press = 0; steer(inp, backX, backY); }
    if (P.traps) avoidSpikes(S, R, h, inp);
    poolHeld = 0; if (P.haz) avoidHazards(S, R, h, inp);
    if (lurk.length && fightT && fightT.st !== 'lurk' && dist(fightT) > 120) keepOff(S, R, h, inp, lurk);
    // a shut door in the way: open it (a locked one only with the key, above)
    if (SIM.doorNear(R, 60) && !SIM.doorLock(m, SIM.doorNear(R, 60))) inp.keys.push('KeyE');
    // stuck against a prop for a second: swing in the walking direction (breaks barrels and pots)
    if (Math.hypot(h.x - lx, h.y - ly) > 20) { lx = h.x; ly = h.y; lt = S.t; }
    if (S.t - lt > 1) { const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); inp.press = 1;
      Object.assign(inp, toPx(R, h.x + dx * 40, h.y - SIM.RIG.shoulder + 8 + dy * 40));
      // still held after 3 s: a dash; walking into something, also a step each time in the next of the four ways, for a way the
      // cells do not show (a gap between the merchant's counter and his barrel led behind the counter, where the only way out the
      // field knows runs through it, seed 36). Not in a fight, where the hero stands and swings
      if (S.t - lt > 3) { inp.keys.push('Space'); lt = S.t; if (dx || dy) { [backX, backY] = [[1, 0], [0, -1], [-1, 0], [0, 1]][unstick++ % 4]; backT = S.t + 0.6; } } }
    // reading the scroll (1.6 s): a step or a blow breaks it off
    if (h.read) { inp.left = inp.right = inp.up = inp.down = inp.press = 0; inp.slot = 0; inp.keys = inp.keys.filter((k) => k === 'KeyQ'); }
    // a potion once HP has sat under the line for the time it takes to notice
    if (h.hp < st.maxHp * P.hp) { if (lowT < 0) lowT = S.t; if (S.t - lowT >= P.react && held(h, 'hp_potion')) { inp.keys.push('KeyQ'); lowT = -1; } } else lowT = -1;
    cur.minhp = Math.min(cur.minhp, h.hp / st.maxHp); fl.minhp = Math.min(fl.minhp, h.hp / st.maxHp); cur.minmp = Math.min(cur.minmp, h.mp / st.maxMp);
    const B = R.en.find((e) => D.BOSSES[e.type]);
    SIM.step(S, inp);
    // each blow's size before the shield, as a share of the max health, by source group; a plain demon's slam is a group of its
    // own, the heavy hitter (TASKS 225)
    for (const e of S.ev) if (!counted.has(e) && e.blow && (e.k === 'hurt' || (e.k === 'absorb' && e.n >= e.blow))) { const g = (D.ENEMIES[e.src] || {}).kind === 'slam' ? 'heavy' : SRC(e.src || ''); (fl.blows[g] = fl.blows[g] || []).push(+(e.blow / st.maxHp).toFixed(3)); }
    for (const e of S.ev) if (!counted.has(e)) { counted.add(e); if (e.k === 'drink') { cur[e.b]++; fl[e.b]++; } else if (e.k === 'quest' && e.s !== 'done') cur.town[e.s === 'take' ? 'taken' : 'turned']++; else if (e.k === 'pickup' && e.s === D.CONSUMABLES.scroll.name) cur.town.found = (cur.town.found || 0) + 1; else if (e.k === 'trade' && e.n < 0 && e.s === 'Куплено: ' + D.CONSUMABLES.scroll.name) cur.town.bought = (cur.town.bought || 0) + 1; else if (e.k === 'pickup' && e.s === D.CONSUMABLES.hp_potion.name) cur.potFound = (cur.potFound || 0) + 1; else if (e.k === 'trade' && e.n < 0 && e.s === 'Куплено: ' + D.CONSUMABLES.hp_potion.name) cur.potBought = (cur.potBought || 0) + 1; else if (e.k === 'hurt') { const g = SRC(e.src || ''), ty = (e.src || '?').split(' ')[0]; fl.dmg[g] = (fl.dmg[g] || 0) + e.n; fl.by[ty] = +((fl.by[ty] || 0) + e.n / st.maxHp).toFixed(3); if (h.hp <= 0 || h.deadT >= 0) cur.killer = e.src; fl.hits++; fl.dmgHp += e.n / st.maxHp; cur.hurt++; } else if (COUNT.includes(e.k)) cur[e.k]++; }
    if (B && !fl.boss && (B.hp < B.max || (R.arena && R.arena.active))) fl.boss = { t0: S.t, t: 0, dmg: 0, pot: 0, hp0: +(h.hp / st.maxHp).toFixed(3), bag: held(h, 'hp_potion'), minhp: 1, by: {} };
    if (fl.boss && !fl.boss.done) { const b = fl.boss; b.t = +(S.t - b.t0).toFixed(1);
      for (const e of S.ev) if (e.t === S.t) { if (e.k === 'hurt') { b.dmg += e.n / st.maxHp; const g = / снаряд$/.test(e.src || '') ? 'volley' : D.BOSSES[(e.src || '').split(' ')[0]] ? B && B.mv || 'boss' : (e.src || '?').split(' ')[0]; b.by[g] = +((b.by[g] || 0) + e.n / st.maxHp).toFixed(3); } else if (e.k === 'drink' && e.b === 'hp_potion') b.pot++; }
      b.minhp = +Math.min(b.minhp, h.hp / st.maxHp).toFixed(3);
      // held back by the colossus's pools of lava (TASKS 413): the seconds the bot wanted a way they shut
      if (poolHeld) b.cut = +((b.cut || 0) + SIM.DT).toFixed(3);
      if (!S.run || !B || B.deadT >= 0 || h.deadT >= 0) { b.done = 1; b.died = h.deadT >= 0 ? 1 : 0; } }
    if (!S.run && cur) cur.floors.push(floorLine(R, h));
  }
  if (cur && !cur.result) { cur.result = stuck ? stuck : { how: 'timeout', floor: S.run ? S.run.floor : 0 }; out.push(cur); log(cur, S); }
  return out;
}

module.exports = { play, PROFILES, VERSION };
