// live/data_town.js — quests, crafting, the storage chest, the townsfolk and the keeper.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { runOf, stageOf, xpNeed } = D;
  const QUESTS = {
    cull: { kind: 'side', type: 'kill', count: (q) => q.need + ' ' + TXT.n('QUESTS.cull.text.2', q.need), name: TXT('QUESTS.cull.name'), need: (f) => 10 + 2 * f, text: (q) => TXT('QUESTS.cull.text', { need: q.need, p2: TXT.n('QUESTS.cull.text.2', q.need), f: q.f }), rw: ['scroll', 'xp'] },
    elites: { kind: 'side', type: 'kill', elite: 1, count: (q) => q.need + ' ' + TXT.n('QUESTS.elites.count', q.need), name: TXT('QUESTS.elites.name'), need: (f) => 2 + Math.floor(f / 4), text: (q) => TXT('QUESTS.elites.text', { need: q.need, p2: TXT.n('QUESTS.elites.text.2', q.need), f: q.f }), rw: ['scroll', 'item', 'xp'] },
    sweep: { kind: 'side', type: 'clear', count: (q) => q.need + ' ' + TXT.n('QUESTS.sweep.text.2', q.need), name: TXT('QUESTS.sweep.name'), need: (f) => 3 + Math.floor(f / 4), text: (q) => TXT('QUESTS.sweep.text', { need: q.need, p2: TXT.n('QUESTS.sweep.text.2', q.need), f: q.f }), rw: ['xp', 'shards'] },
    descent: { kind: 'side', type: 'reach', name: TXT('QUESTS.descent.name'), need: () => 1, ahead: 2, text: (q) => TXT('QUESTS.descent.text', { f: q.f }), rw: ['scroll', 'shards', 'xp'] },
    // the named foe from the 3rd floor (TASKS 1024: on the 1st it killed the bot's level-1 hero on two seeds in six)
    named: { kind: 'side', type: 'named', name: TXT('QUESTS.named.name'), need: () => 1, fresh: 1, noBoss: 1, from: 3, text: (q) => TXT('QUESTS.named.text', { f: q.f, title: q.title }), rw: ['scroll', 'item', 'xp'], item: 3 },
    fetch: { kind: 'side', type: 'fetch', name: TXT('QUESTS.fetch.name'), need: () => 1, fresh: 1, noBoss: 1, text: (q) => TXT('QUESTS.fetch.text', { thing: q.thing, f: q.f }), rw: ['scroll', 'xp'] },
    room: { kind: 'side', type: 'room', name: TXT('QUESTS.room.name'), need: () => 1, fresh: 1, noBoss: 1, text: (q) => TXT('QUESTS.room.text', { f: q.f }), rw: ['xp', 'shards'] },
    rescue_smith: { kind: 'story', type: 'free', who: 'smith', name: TXT('QUESTS.rescue_smith.name'), ask: TXT('QUESTS.rescue_smith.ask'), thanks: TXT('QUESTS.rescue_smith.thanks'), need: () => 1, text: (q) => TXT('QUESTS.rescue_smith.text', { f: q.f }), rw: ['xp', 'scroll'] },
    rescue_enchanter: { kind: 'story', type: 'free', who: 'enchanter', name: TXT('QUESTS.rescue_enchanter.name'), ask: TXT('QUESTS.rescue_enchanter.ask'), thanks: TXT('QUESTS.rescue_enchanter.thanks'), need: () => 1, text: (q) => TXT('QUESTS.rescue_enchanter.text', { f: q.f }), rw: ['xp', 'scroll'] },
    rescue: { kind: 'story', type: 'free', who: 'merchant', name: TXT('QUESTS.rescue.name'), ask: TXT('QUESTS.rescue.ask'), need: () => 1, text: (q) => TXT('QUESTS.rescue.text', { f: q.f }), rw: ['xp', 'scroll'] },
    chapter: { kind: 'story', type: 'boss', name: TXT('QUESTS.chapter.name'), need: () => 1, text: (q) => TXT('QUESTS.chapter.text', { f: q.f, boss: D.ENEMIES[stageOf('campaign', q.f).boss].name }), rw: ['shards', 'item'] },
    depths: { kind: 'story', type: 'reach', name: TXT('QUESTS.depths.name'), need: () => 1, text: (q) => TXT('QUESTS.depths.text', { f: q.f }), rw: ['shards', 'item'] },
  };
  // what a quest pointing at floor f gives on its turn-in (item: the reward piece's least rarity, 2 rare unless the template says)
  // (TASKS 1024: at 0.35 of a level's XP and 150 + 60·f gold the bot that turned in ~6 a run came to each floor a level up on the
  // campaign's hero, and the average went past the 8th in 83 % of runs against the campaign's 70 % on the same seeds)
  // (TASKS 1033) a reward is told by its kind, not its size: scrolls of return in place of gold (on the 1st floor 140 gold went to a
  // hero with thousands and nothing to buy), and the experience of the hero's own level, not the floor's (10 on the 1st floor read as
  // nothing): lvl is the hero's level when it is offered and again when it is turned in
  const questReward = (rw, f, lvl) => Object.fromEntries(rw.map((k) => [k, k === 'gold' ? 100 + 40 * f : k === 'scroll' ? 1 + (f >= 8 ? 1 : 0) : k === 'xp' ? Math.round(0.3 * xpNeed(Math.max(1, lvl || f))) : k === 'shards' ? 3 + Math.floor(f / 2) : 1]));
  // who gives the side quests (TASKS 1018): a run draws QUEST_GIVE.n of them by its seed from the pool, each from a townsman of
  // its own; the floor a quest points at is set when it is taken, `ahead` floors past the deepest reached (one, unless the template
  // says). The Keeper gives the story chain (1022) and may give a side quest too
  const QUEST_GIVE = { n: [2, 3], from: ['smith', 'porter', 'sweeper', 'child', 'guard', 'keeper'], pool: ['named', 'fetch', 'room', 'cull', 'elites', 'sweep', 'descent'] };
  // the townsfolk's words around a quest: the ask, the thanks on the turn-in, and the keepsake each would have back (1020)
  const SAY_OF = (r, ic) => { const T = TXT.talk(r); return { done: T.done, asks: T.asks, boss: T.boss, thanks: T.thanks, turnin: T.turnin, thing: T.thing || TXT('QUEST_SAY.keeper.thing'), ic }; };
  const QUEST_SAY = Object.fromEntries(Object.entries({'smith': 'qi_casket', 'porter': 'qi_casket', 'sweeper': 'qi_locket', 'child': 'qi_horse', 'guard': 'qi_casket', 'keeper': 'qi_locket'}).map(([r, ic]) => [r, SAY_OF(r, ic)]));
  const turnArgs = (q) => { const Q = QUESTS[q.key]; return { f: q.f, count: Q.count ? Q.count(q) : q.need, title: q.title, thing: q.thing, who: Q.who && FOLK[Q.who].name, boss: Q.type === 'boss' ? D.ENEMIES[stageOf('campaign', q.f).boss].name : undefined }; };
  const turnFill = (s, q) => { const A = turnArgs(q); return s.replace(/\{(\w+)\}/g, (m, k) => (A[k] != null ? String(A[k]) : m)); };
  // the named foes (1019): a name and what it is, drawn for the quest; it walks as a strong elite of its floor's kind

  // the Keeper's story chain (TASKS 1022, a stub for R-04): a run's chapters as quests in order — each boss of the run's floors
  // (`chapter`), and the first floor of each of its later chapters (`depths`); R-04 will give the steps their own words
  // who sits caged on which floor (TASKS 1328); boss: the cage stands in that floor's hall once its boss has fallen
  const CAPTIVES = { merchant: { f: 1, quest: 'rescue', caged: TXT.talk('merchant').caged, free: TXT('sim_town.captive.free'), shut: TXT('sim_town.shopShut') },
    smith: { f: 3, quest: 'rescue_smith', caged: TXT.talk('smith').caged, free: TXT('sim_town.captive.smith.free'), shut: TXT('sim_town.captive.smith.shut') },
    enchanter: { f: 4, boss: 1, quest: 'rescue_enchanter', caged: TXT.talk('enchanter').caged, free: TXT('sim_town.captive.enchanter.free'), shut: TXT('sim_town.captive.enchanter.shut') } };
  const storyChain = (mode) => { const M = runOf(mode), out = []; if (M.endless) return out; const caged = (f, late) => { if (mode === 'campaign') for (const c of Object.values(CAPTIVES)) if (c.f === f && !!c.boss === late) out.push({ key: c.quest, f }); };
    for (let f = 1; f <= M.floors; f++) { caged(f, false); if ((M.chapters || []).some((c) => c.from === f)) out.push({ key: 'depths', f }); if (stageOf(mode, f).boss) out.push({ key: 'chapter', f }); caged(f, true); }
    return out; };

  // the town's workshops (R-32, TASKS 1013), a sink for spare gold and shards (389): the smith reforges a piece's own affixes for a
  // share of its price; the enchanter lays on up to three more, each dearer and riskier: a failure strips every enchantment
  // (strip share of failures) or spoils the piece (it loses one affix of its own)
  const CRAFT = { reforge: 0.35, ench: { max: 5, gold: [0.3, 0.6, 1.2, 2.4, 4.8], shards: [3, 6, 12, 24, 48], fail: [0, 0.01, 0.02, 0.05, 0.1] } };
  // the storage chest (R-33, TASKS 1012, 1617): anything left for the heroes to come, kept in the meta save with the item balance it was made under
  const STASH = { cells: 24 };

  // the townsfolk (R-17, TASKS 1015): a pair of lines when the hero comes up (the next pair the next time), the clock of the work
  // loop (per s; hit: the loop's impact phase, rest: every rest-th loop is a breather) and, for those with a round, the walking
  // speed and the pause at each stop. The sim's events (the anvil's ring, the keeper's sparks) and the render share one clock
  const FOLK = {
    smith: { name: TXT('FOLK.smith.name'), job: TXT('FOLK.smith.job'), per: 1.45, hit: 0.6, rest: 4, lines: TXT.talk('smith').lines, topics: TXT.talk('smith').topics },
    enchanter: { name: TXT('FOLK.enchanter.name'), job: TXT('FOLK.enchanter.job'), per: 7.5, hit: 0.55, lines: TXT.talk('enchanter').lines, topics: TXT.talk('enchanter').topics },
    keeper: { name: TXT('FOLK.keeper.name'), job: TXT('FOLK.keeper.job'), per: 9, hit: 0.3, lines: TXT.talk('keeper').lines, topics: TXT.talk('keeper').topics },
    guard: { name: TXT('FOLK.guard.name'), job: TXT('FOLK.guard.job'), per: 8, lines: TXT.talk('guard').lines, topics: TXT.talk('guard').topics },
    porter: { name: TXT('FOLK.porter.name'), job: TXT('FOLK.porter.job'), per: 1.7, v: 34, lines: TXT.talk('porter').lines, topics: TXT.talk('porter').topics },
    sweeper: { name: TXT('FOLK.sweeper.name'), job: TXT('FOLK.sweeper.job'), per: 1.25, pause: 7, v: 26, lines: TXT.talk('sweeper').lines, topics: TXT.talk('sweeper').topics },
    child: { name: TXT('FOLK.child.name'), job: TXT('FOLK.child.job'), per: 2.3, pause: 6, v: 42, lines: TXT.talk('child').lines, topics: TXT.talk('child').topics, won: TXT.talk('child').won },
    mason: { name: TXT('FOLK.mason.name'), job: TXT('FOLK.mason.job'), per: 1.3, hit: 0.7, v: 34, lines: TXT.talk('mason').lines, topics: TXT.talk('mason').topics },
    merchant: { name: TXT('FOLK.merchant.name'), job: TXT('hud.shop.job'), topics: TXT.talk('merchant').topics },
    hen: { per: 2.2 },
  };
  // how long a pair of lines shows (each line half of it)
  const FOLK_SAY = 5;
  // the Keeper of the Fire (R-25, TASKS 1016): what he says when spoken to (E), by what has happened since he last spoke; each
  // event is a page of the dialogue, the most weighty first, each told once; with nothing new, a pair of his idle lines
  const KT = TXT.talk('keeper'), KE = KT.events, withName = (L) => (name) => L.map((p) => p.replace('{name}', name));
  const KEEPER = { first: KT.first, greet: KT.greet, death1: KE.death1, death: KE.death, win: KE.win, boss: withName(KE.boss), rare: withName(KE.rare), away: KE.away, end: KE.end, endDeep: KE.endDeep, cls: (cls) => KE.cls[0].replace('{cls}', cls) };
  const STORY = { boss: KT.story, depths: KT.depths, rescueThanks: KT.rescueThanks };
  // a townsperson's loop clock: its own rate and phase per instance, so no two move in sync
  const folkClock = (role, i, t) => { const per = FOLK[role].per * (1 + 0.12 * (((i * 0.618) % 1) - 0.5)), x = (t + i * 1.37) / per, n = Math.floor(x); return { n, u: x - n, per }; };

  // a walker starts standing at a stop of its round (the one it is placed on, give or take the seed's nudge, else the round's last): a first leg from off the round
  // ran into the forge's corner, and the porter skipped his pick-up and walked to the merchant empty-handed (TASKS 1031)
  const folkInit = (npcs) => npcs.map((n, i) => { const r = n.route, k = r ? r.findIndex((q) => Math.hypot(q.x - n.x, q.y - n.y) < 12) : -1, w = r ? (k >= 0 ? k : r.length - 1) : -1;
    return { i, role: n.role, x: r ? r[w].x : n.x, y: r ? r[w].y : n.y, face: 0, dist: 0, vx: 0, vy: 0, spd: 0, way: w, go: 0, t0: -i * 1.9, load: 0, lift: 0, stuck: 0, sayT: -9, byeT: -9, sayN: -1, near: 0 }; });

  const NOTE_LIST = (globalThis.TEXT || {}).notes || [];
  // a series by its era and name, its parts' ids in order
  const chainOf = (n) => n.id.split('_')[0] + ':' + n.chain, CHAINS = {};
  for (const n of NOTE_LIST) if (n.chain) (CHAINS[chainOf(n)] = CHAINS[chainOf(n)] || [])[n.part - 1] = n.id;
  const NOTES = { lift: { table: 36, bookshelf: 58 }, n: [3, 5], era: { dungeon: 'cellar', crypt: 'crypt', lava: 'forge', arcane: 'halls', cave: 'flooded', magma: 'magma' }, list: NOTE_LIST, byId: Object.fromEntries(NOTE_LIST.map((n) => [n.id, n])), chains: CHAINS, chainOf };
  // the rails' line through their cells, its corners rounded (two passes of corner-cutting, the ends kept): cut straight the stretches met with a kink (TASKS 1606)
  const railPts = (m) => { const TILE = D.TILE; let p = m.town.rails.map((k) => [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]);
    for (let n = 0; n < 2; n++) { const q = [p[0]]; for (let i = 1; i < p.length; i++) { const [ax, ay] = p[i - 1], [bx, by] = p[i]; q.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); } q.push(p[p.length - 1]); p = q; } return p; };
  // TASKS 1781, 2090: the cart has two paintings, the 3/4 view (its wheel line `diag` degrees up to the right on the screen, the rails'
  // own slope) and the front one (travel plumb into the screen); each is drawn as painted, never sheared, squashed or tipped, because
  // the floor is flat and a cart that leans along the rails' screen slope looks to be rolling downhill. The 3/4 one turns no more than
  // `trim` to take up what its painting's line lacks of the rails'; the front one takes over from `front` degrees of the rails' slope up
  // (one change of view, at the bend, the two paintings' bottoms on one line); the cart stops `stop` px short of the rails' end
  // `seat`: the point of each 3/4 painting that rides the rails' middle, off its bottom centre in parts of its size: the near wheels' contact
  // line, moved half the track's width away from the viewer (TASKS 2090: the three loads are one painting with the load changed, so their
  // wheels sit at the same place in the 1024 px canvas they were painted on, and the crops differ only in height)
  // `hubs`: the near side's two wheel hubs in each 3/4 painting, in parts of its size. The sprites' own wheels cannot turn, so a `lug`
  // (w x h px) runs round each hub on an ellipse of `rx` of the painting's width and `ry` of its height, the dark disc inside the rim,
  // by the distance rolled on a wheel of `roll` of the width; it moves no more than `step` px a frame at the cart's top speed (town_motion_r8 5)
  // `rope`: from the adit's winch, `winch` px over the rails' first point, to the cart's `hook` (parts of the painting's size: the far
  // end's rim in the 3/4 one, the top centre in the front one). It hangs `sag` px at the middle, less as it comes taut (`taut` of it at `far`
  // px of length) and none when short (under `near`); a plumb run bows `bow` px aside, towards where the rails turn, over `ramp` px from each
  // end, so it never lies on the rails' axis: cartCheck wants `gap` px from it, but for `ends` px at each end (town_motion_r8 6)
  // `wheelsF`: the front paintings' two edge-on wheel slabs (TASKS 2113: the round discs faced the viewer across the rails), measured from
  // the alpha by tools/measure/cart_f_wheels.py: `x` their centres across in parts of the width, `foot` their bottom in parts of the height;
  // sizes.js sets the heights so the slabs stand on the rails (RAIL.gauge) and `cartSeatF` puts their feet on the rails' line. `rim`: the near box from the wheels'
  // bottom up to its near rim, in parts of each painting's height, the one size both views share: cartCheck wants it no less than
  // `shrink` short of what the cart shows `ahead` px further along. `dusk`: the run (px) over which the cart comes out of the adit's dark
  const CART = { diag: 39, front: 67, trim: 7, stop: 22, floor: 0.68, reach: 14, dusk: [0, 20], shrink: 0.15, ahead: 6,
    wheelsF: { cart_tw_f: { x: [0.1293, 0.8707], foot: 0.9960 }, cart_tw_f_half: { x: [0.1294, 0.8717], foot: 0.9956 }, cart_tw_f_empty: { x: [0.1294, 0.8723], foot: 0.9954 } },
    rim: { cart_tw: 0.445, cart_tw_half: 0.49, cart_tw_empty: 0.49, cart_tw_f: 0.51, cart_tw_f_half: 0.6, cart_tw_f_empty: 0.6 },
    seat: { cart_tw: [0.130, -0.210], cart_tw_half: [0.131, -0.231], cart_tw_empty: [0.130, -0.234] },
    hubs: { cart_tw: [[0.595, 0.868], [0.946, 0.592]], cart_tw_half: [[0.596, 0.854], [0.948, 0.549]], cart_tw_empty: [[0.595, 0.851], [0.946, 0.547]] },
    lug: { rx: 0.055, ry: 0.08, roll: 0.09, w: 2, h: 1, col: [0.72, 0.62, 0.5], step: 1.5 },
    rope: { winch: 60, hook: { side: { cart_tw: [0.92, 0.31], cart_tw_half: [0.92, 0.24], cart_tw_empty: [0.92, 0.24] }, front: [0.5, 0] },
      sag: 7, taut: 0.5, far: 200, near: 40, bow: 5, ramp: 10, ends: 6, gap: 3, col: [0.22, 0.15, 0.09] } };
  // the track's painting (TASKS 2012, 2085, 2091): `per` one sleeper and the ballast after it and `at` the middle of the first gap between two
  // sleepers (where a period is cut, so it repeats without its ends), both in the painting's own pixels, `gauge` between the rails'
  // middles in it; the painting's size is not here, `railLay` takes it from the assets. It is seen from straight above and laid in floor
  // space for every stretch, the adit's plumb one too, so the sleepers keep one size and tone round the bend; the table's `gauge` (view px)
  // sizes it, as the cart's wheels were set on; `lift` brings its sleepers to a brown
  // a walker's turn: the rig's width runs from the old side to the new over `t` s and never narrower than `minW`; the hand and tool targets ride the unclamped width.
  // `load`: the turn with a load in both hands, a third of the height out in front: its hands cross 0.62 of the height, over 0.2 s 6.2 px a frame (TASKS 2116)
  const FOLK_TURN = { t: 0.2, load: 0.25, minW: 0.1 };
  const RAIL = { gauge: 18.6, h: { tex: 'rail_tw_h', at: 198, per: 160, gauge: 123.5, lift: 1.35 } };
  // the sprites that lay a track along `pts`, one period of the painting after another, the count carried round each bend: where each stands,
  // the way the stretch runs (dx, dy), its size in view px and the part of the painting it shows; `size` gives a painting's pixels by its texture's name
  const railLay = (pts, size) => { const K = CART.floor, out = [], P = RAIL.h, [tw, th] = size(P.tex), k = RAIL.gauge / P.gauge, per = P.per * k, cut = P.at / tw; let carry = 0;
    for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, (by - ay) / K);
      let d = carry; for (; d < len; d += per) out.push({ tex: P.tex, x: ax + (bx - ax) * d / len, y: ay + (by - ay) * d / len, dx: bx - ax, dy: by - ay, lift: P.lift,
        w: per + 0.5, h: th * k, src: [cut, 0, cut + P.per / tw, 1] });
      carry = d - len; }
    return out; };
  const railTot = (pts) => pts.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
  const railAt = (pts, d) => { d = Math.max(0, Math.min(railTot(pts), d)); for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay); if (d <= l || i === pts.length - 1) return [ax + (bx - ax) * d / l, ay + (by - ay) * d / l]; d -= l; } };
  // where the cart stands for the sim's distance `s` run: its distance `ds` along the rails (it stops `stop` px short of their end) and the point
  const cartAt = (pts, s) => { const tot = railTot(pts), ds = Math.min(s, tot) * (tot - CART.stop) / tot, [x, y] = railAt(pts, ds); return { x, y, ds }; };
  const cartView = (pts, s) => {
    const q0 = railAt(pts, s - CART.reach), q1 = railAt(pts, s + CART.reach), th = Math.atan2(Math.abs(q1[1] - q0[1]), Math.abs(q1[0] - q0[0])) * 180 / Math.PI;
    const run = Math.sign(q1[0] - q0[0]) || 1;
    return th < CART.front ? { th, run, side: 1, turn: 1, sx: 1, rot: Math.max(-CART.trim, Math.min(CART.trim, CART.diag - th)), tilt: 0 } : { th, run, side: 0, sx: 1, rot: 0, tilt: 0 };
  };
  // the lug's place on wheel `q` of the 3/4 painting `name` (w x h px) after `s` px rolled, from the painting's bottom centre; `run` is
  // the screen side (+1 right) the cart goes to as `s` grows, so the wheel's top turns that way (TASKS 2109: it turned against the travel)
  const cartLug = (name, q, w, h, s, run) => { const G = CART.lug, [hu, hv] = CART.hubs[name][q], a = run * s / (G.roll * w);
    return [(hu - 0.5) * w + Math.cos(a) * G.rx * w, (hv - 1) * h + Math.sin(a) * G.ry * h]; };
  // the front painting's point that rides the rails' middle, from its bottom centre (w x h px): midway between the slabs, at their feet
  const cartSeatF = (name, w, h) => { const F = CART.wheelsF[name]; return [((F.x[0] + F.x[1]) / 2 - 0.5) * w, (F.foot - 1) * h]; };
  const cartHook = (side, name, w, h) => { const [hu, hv] = side ? CART.rope.hook.side[name] : CART.rope.hook.front; return [(hu - 0.5) * w, (hv - 1) * h]; };
  const cartWinch = (pts) => [pts[0][0], pts[0][1] - CART.rope.winch];
  // the rope from the winch `W` to the hook `H` as points a pixel apart or less; `dir` (+1 or -1) is the side a plumb run bows to
  const cartRope = (W, H, dir) => { const P = CART.rope, dx = H[0] - W[0], dy = H[1] - W[1], len = Math.hypot(dx, dy), f = len ? Math.abs(dx) / len : 0, ramp = Math.min(P.ramp, len / 2),
      sag = P.sag * (1 - P.taut * Math.min(1, len / P.far)) * Math.min(1, len / P.near) * f, n = Math.max(2, Math.ceil(len + 2 * (P.bow + P.sag))), out = [];
    for (let i = 0; i <= n; i++) { const t = i / n, d = Math.min(t, 1 - t) * len, bow = ramp ? P.bow * (1 - f) * Math.sin(Math.PI / 2 * Math.min(1, d / ramp)) : 0;
      out.push([W[0] + dx * t + dir * bow, W[1] + dy * t + 4 * sag * t * (1 - t)]); }
    return out; };
  Object.assign(D, { CAPTIVES, NOTES, STORY, QUESTS, questReward, QUEST_GIVE, QUEST_SAY, turnFill, storyChain, CRAFT, STASH, FOLK, FOLK_SAY, KEEPER, folkClock, folkInit, FOLK_TURN, railPts, CART, cartView, cartAt, railAt, cartLug, cartSeatF, cartHook, cartWinch, cartRope, RAIL, railLay });
  // a giver's quest mark (TASKS 2105) stands over his head, centred on him; `gap` is the plate's foot above the head, `small` the scale of a
  // mark kept at the screen's edge when the giver's feet or head are off it, `margin` its distance from that edge, `box` the hit box of a full-size one
  const QMARK = { gap: 10, w: 34, h: 40, box: [40, 48], bob: 4, bobSmall: 0, small: 0.6, margin: 16, glow: 46, label: 34 };
  const questMarkAt = (gx, gy, spriteH, k, W, H, margin = QMARK.margin) => {
    const cy = gy - spriteH * k - QMARK.gap - QMARK.h / 2;
    if (gx >= 0 && gx <= W && gy >= 0 && gy <= H && cy - QMARK.h / 2 >= 0) return { x: gx, y: cy, small: false, edge: [0, 0] };
    const ex = QMARK.w * QMARK.small / 2 + margin, ey = QMARK.h * QMARK.small / 2 + margin, x = Math.max(ex, Math.min(W - ex, gx)), y = Math.max(ey, Math.min(H - ey, cy));
    return { x, y, small: true, edge: [Math.sign(gx - x), gy > H ? 1 : Math.sign(cy - y)] };
  };
  Object.assign(D, { QMARK, questMarkAt });
})(typeof window !== 'undefined' ? window : globalThis);
