// live/data_town.js — quests, crafting, the storage chest, the townsfolk and the keeper.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { runOf, stageOf, xpNeed } = D;
  // a boss quest's own name by its boss, so the campaign's six never share one; a boss without a line keeps the quest's plain name
  const BOSS_QUEST_NAME = { boss_spider: TXT('QUESTS.chapter.boss_spider'), boss_necro: TXT('QUESTS.chapter.boss_necro'), boss_forge: TXT('QUESTS.chapter.boss_forge'),
    boss: TXT('QUESTS.chapter.boss'), boss_serpent: TXT('QUESTS.chapter.boss_serpent'), boss_colossus: TXT('QUESTS.chapter.boss_colossus') };
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
    chapter: { kind: 'story', type: 'boss', name: TXT('QUESTS.chapter.name'), nameOf: (q) => BOSS_QUEST_NAME[stageOf('campaign', q.f).boss], need: () => 1, text: (q) => TXT('QUESTS.chapter.text', { f: q.f, boss: D.ENEMIES[stageOf('campaign', q.f).boss].name }), rw: ['shards', 'item'] },
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
  // a freed captive talks with the hero in the town's window, and once the talk is closed runs off toward the floor's way up: `cells`
  // cells of the way at `speed` view px a second; at its end he is gone in a puff of dust that lasts `puff` s
  const CAPTIVE_FLEE = { cells: 12, speed: 170, puff: 0.6 };
  // where a fleeing captive is `t` s into his run along his path (world points): his place, his heading and how far he has come;
  // past its end done, with `over` the seconds since he got there
  const captiveFleeAt = (flee, t) => { const P = flee.path, d = Math.max(0, t) * CAPTIVE_FLEE.speed; let left = d;
    for (let i = 1; i < P.length; i++) { const [ax, ay] = P[i - 1], [bx, by] = P[i], len = Math.hypot(bx - ax, by - ay) || 1;
      if (left <= len) { const u = left / len; return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, vx: (bx - ax) / len * CAPTIVE_FLEE.speed, vy: (by - ay) / len * CAPTIVE_FLEE.speed, dist: d, done: false, over: 0 }; }
      left -= len; }
    const [x, y] = P[P.length - 1] || [0, 0]; return { x, y, vx: 0, vy: 0, dist: d, done: true, over: left / CAPTIVE_FLEE.speed }; };
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
  // `stride`: the walker's stride against the biped's own (MON.rigStride): at 1 the porter and the child shuffled a step of 0.10 of the height,
  // the child 9 steps a second, the mason 0.14 (motioncheck cadence asks 0.15, TASKS 2118–2120)
  const FOLK = {
    smith: { name: TXT('FOLK.smith.name'), job: TXT('FOLK.smith.job'), per: 1.45, hit: 0.6, rest: 4, lines: TXT.talk('smith').lines, topics: TXT.talk('smith').topics },
    enchanter: { name: TXT('FOLK.enchanter.name'), job: TXT('FOLK.enchanter.job'), per: 7.5, hit: 0.55, lines: TXT.talk('enchanter').lines, topics: TXT.talk('enchanter').topics },
    keeper: { name: TXT('FOLK.keeper.name'), job: TXT('FOLK.keeper.job'), per: 9, hit: 0.3, lines: TXT.talk('keeper').lines, topics: TXT.talk('keeper').topics },
    guard: { name: TXT('FOLK.guard.name'), job: TXT('FOLK.guard.job'), per: 8, lines: TXT.talk('guard').lines, topics: TXT.talk('guard').topics },
    porter: { name: TXT('FOLK.porter.name'), job: TXT('FOLK.porter.job'), per: 1.7, v: 34, swing: 0.06, stride: 1.6, lines: TXT.talk('porter').lines, topics: TXT.talk('porter').topics },
    // walkSweep: walking, the broom's hand goes reach of the height to and fro once a step, the broom tilting tilt rad about rest
    sweeper: { name: TXT('FOLK.sweeper.name'), job: TXT('FOLK.sweeper.job'), per: 1.25, pause: 7, v: 26, walkSweep: { reach: 0.05, tilt: 0.16, rest: 0.8 }, lines: TXT.talk('sweeper').lines, topics: TXT.talk('sweeper').topics },
    child: { name: TXT('FOLK.child.name'), job: TXT('FOLK.child.job'), per: 2.3, pause: 6, v: 42, ease: 0.25, swing: 0.06, stride: 1.6, lines: TXT.talk('child').lines, topics: TXT.talk('child').topics, won: TXT.talk('child').won },
    mason: { name: TXT('FOLK.mason.name'), job: TXT('FOLK.mason.job'), per: 1.3, hit: 0.7, v: 34, swing: 0.06, stride: 1.15, lines: TXT.talk('mason').lines, topics: TXT.talk('mason').topics },
    merchant: { name: TXT('FOLK.merchant.name'), job: TXT('hud.shop.job'), topics: TXT.talk('merchant').topics },
    hen: { per: 2.2 },
  };
  // how long a pair of lines shows (each line half of it)
  const FOLK_SAY = 5;
  // a walker with a quest for the hero waits for him (town_game_r9 3): he stops once the hero within near px comes his way, over stop s,
  // and stays while the hero is within keep px, no longer than max s; a wait run out is followed by cool s of his round before the
  // next, so a hero standing by cannot hold the yard's work up (one the hero walked off from needs none: he waits again at once)
  const FOLK_HOLD = { near: 160, keep: 220, max: 6, cool: 8, stop: 0.25, toward: 0.3, heroV: 10, way: 110 };
  // E by a giver with a «!» or «?» and a service at once (TASKS 2128: the porter at the anvil, E opened the forge): the giver answers when
  // the hero is no farther from him than from the service, or within `both` px of each, else the service
  const FOLK_FIRST = { both: 48 };
  // the Keeper of the Fire (R-25, TASKS 1016): what he says when spoken to (E), by what has happened since he last spoke; each
  // event is a page of the dialogue, the most weighty first, each told once; with nothing new, a pair of his idle lines
  const KT = TXT.talk('keeper'), KE = KT.events, withName = (L) => (name) => L.map((p) => p.replace('{name}', name));
  const KEEPER = { first: KT.first, greet: KT.greet, death1: KE.death1, death: KE.death, win: KE.win, boss: withName(KE.boss), rare: withName(KE.rare), away: KE.away, end: KE.end, endDeep: KE.endDeep, cls: (cls) => KE.cls[0].replace('{cls}', cls) };
  const STORY = { boss: KT.story, depths: KT.depths, rescueThanks: KT.rescueThanks };
  // a townsperson's loop clock: its own rate and phase per instance, so no two move in sync
  const folkClock = (role, i, t) => { const per = FOLK[role].per * (1 + 0.12 * (((i * 0.618) % 1) - 0.5)), x = (t + i * 1.37) / per, n = Math.floor(x); return { n, u: x - n, per }; };

  // a walker starts standing at a stop of its round (the one it is placed on, give or take the seed's nudge, else the round's last): a first leg from off the round
  // ran into the forge's corner, and the porter skipped his pick-up and walked to the merchant empty-handed (TASKS 1031)
  // a hen starts facing the way it is drawn at rest (to the nearest child, as TOWN_FACE), so its first step turns it over FOLK_TURN-like
  // easing: from face 0 the sim set the side with no turn and the drawing flipped in a frame (town_motion_r9 7)
  // a townsperson's sprite (and size) name: the hens take three looks by their index, each with its wings' colour, the rest their role's
  const HEN_LOOKS = [{ sprite: 'town_hen_white', wing: [0.8, 0.77, 0.7] }, { sprite: 'town_hen_red', wing: [0.52, 0.24, 0.12] }, { sprite: 'town_hen_grey', wing: [0.46, 0.46, 0.5] }];
  const henLook = (f) => HEN_LOOKS[f.i % HEN_LOOKS.length], folkSprite = (f) => (f.role === 'hen' ? henLook(f).sprite : 'town_' + f.role);
  const henFace = (npcs, n) => { const c = npcs.filter((q) => q.role === 'child').sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0]; return !c || c.x >= n.x ? 1 : -1; };
  const folkInit = (npcs) => npcs.map((n, i) => { const r = n.route, k = r ? r.findIndex((q) => Math.hypot(q.x - n.x, q.y - n.y) < 12) : -1, w = r ? (k >= 0 ? k : r.length - 1) : -1, hen = n.role === 'hen';
    return { i, role: n.role, x: r ? r[w].x : n.x, y: r ? r[w].y : n.y, face: hen ? henFace(npcs, n) : 0, walked: hen ? 1 : 0, dist: 0, vx: 0, vy: 0, spd: 0, way: w, go: 0, t0: -i * 1.9, load: 0, lift: 0, stuck: 0, sayT: -9, byeT: -9, sayN: -1, near: 0 }; });

  const NOTE_LIST = (globalThis.TEXT || {}).notes || [];
  // a series by its era and name, its parts' ids in order
  const chainOf = (n) => n.id.split('_')[0] + ':' + n.chain, CHAINS = {};
  for (const n of NOTE_LIST) if (n.chain) (CHAINS[chainOf(n)] = CHAINS[chainOf(n)] || [])[n.part - 1] = n.id;
  const NOTES = { lift: { table: 36, bookshelf: 58 }, n: [3, 5], era: { dungeon: 'cellar', crypt: 'crypt', lava: 'forge', arcane: 'halls', cave: 'flooded', magma: 'magma' }, list: NOTE_LIST, byId: Object.fromEntries(NOTE_LIST.map((n) => [n.id, n])), chains: CHAINS, chainOf };
  // the rails' line through their cells, each corner rounded over `RAIL.bend.arc` px of either stretch (no more than half of it), the ends kept,
  // as points `RAIL.bend.pt` px apart (TASKS 2138: two passes of corner-cutting on the cells, 1606, turned the adit's bend inside one sleeper)
  const railPts = (m) => { const TILE = D.TILE, B = RAIL.bend, c = m.town.rails.map((k) => [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]);
    const p = c.filter((q, i) => i === 0 || i === c.length - 1 || (q[0] - c[i - 1][0]) * (c[i + 1][1] - q[1]) !== (q[1] - c[i - 1][1]) * (c[i + 1][0] - q[0]));
    const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]), cut = p.map((q, i) => (i && i < p.length - 1 ? Math.min(B.arc, len(p[i - 1], q) / 2, len(q, p[i + 1]) / 2) : 0));
    const toward = (a, b, d) => { const l = len(a, b); return [a[0] + (b[0] - a[0]) * d / l, a[1] + (b[1] - a[1]) * d / l]; }, out = [p[0]];
    const line = (a, b) => { const n = Math.max(1, Math.round(len(a, b) / B.pt)); for (let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); };
    let from = p[0];
    for (let i = 1; i < p.length; i++) { const q = p[i];
      if (i === p.length - 1) { line(from, q); break; }
      const e = toward(q, p[i - 1], cut[i]), x = toward(q, p[i + 1], cut[i]); line(from, e);
      const n = Math.max(2, Math.round((len(e, q) + len(q, x)) / B.pt));
      for (let j = 1; j <= n; j++) { const t = j / n, u = 1 - t; out.push([u * u * e[0] + 2 * u * t * q[0] + t * t * x[0], u * u * e[1] + 2 * u * t * q[1] + t * t * x[1]]); }
      from = x; }
    return out; };
  // TASKS 1781, 2090: the cart has two paintings, the 3/4 view (its near wheels' feet line `diag` degrees up to the right on the screen,
  // the rails' own slope; TASKS 2121: the hubs' line, 39, left the far wheel 2 px off the rail on the 45° diagonal) and the front one
  // (travel plumb into the screen); each is drawn as painted, never sheared, squashed or tipped, because
  // the floor is flat and a cart that leans along the rails' screen slope looks to be rolling downhill. The 3/4 one turns no more than
  // `trim` to take up what its painting's line lacks of the rails'; the front one takes over from `front` degrees of the rails' slope up
  // (one change of view, at the bend, the two paintings' bottoms on one line); the cart stops `stop` px short of the rails' end
  // `foot`: the near wheels' feet under their hubs in each 3/4 painting, in parts of its height (tools/measure/cart_f_wheels.py); `cartSeat`
  // stands them on the near rail. The three loads are one painting with the load changed, cropped to different heights (TASKS 2090), so
  // sizes.js sets the heights in the canvases' ratio and the box comes out one size (TASKS 2121: at one height it grew 54 -> 59 px unloading).
  // The painting's wheels sit on the box's sides, so its wheel track is the box's width, wider than the gauge: with them on the near rail
  // the box's foot hangs 8 px past the far rail on the 45° diagonal and none past the near one; centring it would set the near wheels
  // 3 px off their rail, and wheels on the rails are the author's call (TASKS 2113)
  // `hubs`: the near side's two wheel hubs in each 3/4 painting, in parts of its size. The sprites' own wheels cannot turn, so a `lug`
  // (w x h px) runs round each hub on an ellipse of `rx` of the painting's width and `ry` of its height, the dark disc inside the rim,
  // by the distance rolled on a wheel of `roll` of the hubs' distance (TASKS 2121: of the width, the phase jumped with the painting's crop);
  // it moves no more than `step` px a frame at the cart's top speed (town_motion_r8 5)
  // `rope`: from the adit's winch, `winch` px over the rails' first point, to the cart's `hook` (parts of the painting's size: the far
  // end's rim in the 3/4 one, the top centre in the front one). It hangs `sag` px at the middle, less as it comes taut (`taut` of it at `far`
  // px of length) and none when short (under `near`); a plumb run bows `bow` px aside, towards where the rails turn, over `ramp` px from each
  // end, so it never lies on the rails' axis: cartCheck wants `gap` px from it, but for `ends` px at each end (town_motion_r8 6)
  // `wheelsF`: the front paintings' two edge-on wheel slabs (TASKS 2113: the round discs faced the viewer across the rails), measured from
  // the alpha by tools/measure/cart_f_wheels.py: `x` their centres across in parts of the width, `foot` their bottom in parts of the height;
  // sizes.js sets the heights so the slabs stand on the rails (RAIL.gauge) and `cartSeatF` puts their feet on the rails' line. `rim`: the near box from the wheels'
  // bottom up to its near rim, in parts of each painting's height, the one size both views share: cartCheck wants it no less than
  // `shrink` short of what the cart shows `ahead` px further along. `dusk`: the run (px) over which the cart comes out of the adit's dark.
  // The front paintings carry the 3/4 ones' colour class by class (ore, ink, lit rims, wood, iron, wheels; tools/fix_cart_views_2140.py):
  // set for the adit's lamp (TASKS 2122, 2133) they were paler, greyer and pale-lined where the two views meet at the bend, and load 1's
  // one lump goes untinted in both views for the same reason. `front` 54 and `span` 12: the front painting's slabs stand within a pixel of the
  // rails down to 54° of their slope and the 3/4 one's near wheels from 54° (the chord of the near rail under them, `span` px of path
  // either side, sets its turn), so the change of view comes there and not at 67°, where the 3/4 wheels stood 4.9 px off the rail
  // (tools/measure/motion/cartrails.cjs); `fade` px of rails the cross-fade takes, 0.29 s at the top speed (TASKS 2140: at 0.19 s the
  // author saw the change as a jump). `face`: the end of the box the camera sees head-on in the front view and at the lower left in the
  // 3/4 one, top (the near rim, `rim` up from the feet) to bottom (its lowest opaque px), in parts of the height: the 3/4 end stands
  // 2.8-3.3 px taller (tools/measure/cart2140), so through the fade the 3/4 painting grows from the front one's end to its own (`cartGrow`)
  const CART = { diag: 43, front: 54, trim: 7, stop: 22, floor: 0.68, reach: 14, span: 12, fade: 14, dusk: [0, 20], shrink: 0.15, ahead: 6,
    face: { cart_tw: [0.551, 0.966], cart_tw_half: [0.505, 0.961], cart_tw_empty: [0.505, 0.957], cart_tw_f: [0.486, 0.905], cart_tw_f_half: [0.396, 0.889], cart_tw_f_empty: [0.396, 0.878] },
    wheelsF: { cart_tw_f: { x: [0.1293, 0.8707], foot: 0.9960 }, cart_tw_f_half: { x: [0.1294, 0.8717], foot: 0.9956 }, cart_tw_f_empty: { x: [0.1294, 0.8723], foot: 0.9954 } },
    rim: { cart_tw: 0.445, cart_tw_half: 0.49, cart_tw_empty: 0.49, cart_tw_f: 0.51, cart_tw_f_half: 0.6, cart_tw_f_empty: 0.6 },
    foot: { cart_tw: [0.9956, 0.6777], cart_tw_half: [0.9951, 0.6456], cart_tw_empty: [0.9951, 0.6419] },
    hubs: { cart_tw: [[0.595, 0.868], [0.946, 0.592]], cart_tw_half: [[0.596, 0.854], [0.948, 0.549]], cart_tw_empty: [[0.595, 0.851], [0.946, 0.547]] },
    lug: { rx: 0.055, ry: 0.08, roll: 0.2, w: 2, h: 1, col: [0.72, 0.62, 0.5], step: 1.5 },
    rope: { winch: 60, hook: { side: { cart_tw: [0.92, 0.31], cart_tw_half: [0.92, 0.24], cart_tw_empty: [0.92, 0.24] }, front: [0.5, 0] },
      sag: 7, taut: 0.5, far: 200, near: 40, bow: 5, ramp: 10, ends: 6, gap: 3, col: [0.22, 0.15, 0.09] } };
  // the track's painting (TASKS 2012, 2085, 2091): `per` one sleeper and the ballast after it and `at` the middle of the first gap between two
  // sleepers (where a period is cut, so it repeats without its ends), both in the painting's own pixels, `gauge` between the rails'
  // middles in it; the painting's size is not here, `railLay` takes it from the assets. It is seen from straight above and laid in floor
  // space for every stretch, the adit's plumb one too, so the sleepers keep one size and tone round the bend; the table's `gauge` (view px)
  // sizes it, as the cart's wheels were set on; `lift` brings its sleepers to a brown. `bend` (TASKS 2122): a period whose rails turn over its
  // length (over `flat` degrees) goes out in slices, no more than `most`, turning no more than `step` degrees from one to the next, each `lap`
  // px longer so the outer edge leaves no gap, the way read from `reach` px either side (the 24 px straight periods broke the adit's bend in two kinks of 15-19° while the cart turned smoothly)
  // a walker's turn: the rig's width runs from the old side to the new over `t` s and never narrower than `minW`; the hand and tool targets ride the unclamped width.
  // `minW` 0.28: at 0.1 the mid-turn frame drew the figure as a sliver, the mason gone, the porter a lone crate (town_motion_r9 1, TASKS 2123)
  // `load`: the turn with a load in both hands, a third of the height out in front: its hands cross 0.62 of the height, over 0.2 s 6.2 px a frame (TASKS 2116)
  const FOLK_TURN = { t: 0.2, load: 0.25, minW: 0.28 };
  // struck by the hero's blow: a flinch back from it over `time` s, knees giving, the head ducked; a robed figure has no knees to give
  // and cowers, its shoulders sinking by `shoulderDrop` rig px (the robed rig's lift is y down, so the drop adds to it)
  const FOLK_FLINCH = { time: 0.5, lean: 0.14, crouch: 8, headR: 0.12, shoulderDrop: 3 };
  const folkFlinchAt = (age) => { const F = FOLK_FLINCH, k = age >= 0 && age < F.time ? Math.sin(Math.PI * age / F.time) * (1 - age) : 0;
    return { k, lean: F.lean * k, crouch: F.crouch * k, headR: F.headR * k, shoulderDrop: F.shoulderDrop * k }; };
  // a robed figure's pose (the robed rig's lift, headR) as a flinch takes it
  const robeFlinched = (robe, fl) => Object.assign({}, robe, { headR: (robe.headR || 0) + fl.headR, lift: (robe.lift || 0) + fl.shoulderDrop });
  // a walking sweeper's broom on the robe's step phase: ahead (1) as each shoe plants, at its forward-most, back (-1) between
  const walkSweepAt = (stepPhase) => Math.cos(2 * stepPhase);
  const RAIL = { gauge: 18.6, bend: { reach: 6, step: 3, lap: 1, flat: 0.05, most: 16, arc: 28, pt: 8 }, h: { tex: 'rail_tw_h', at: 198, per: 160, gauge: 123.5, lift: 1.35 } };
  // the sprites that lay a track along `pts`, one period of the painting after another, the count carried round each bend: where each stands,
  // the way the stretch runs (dx, dy), its size in view px and the part of the painting it shows; `size` gives a painting's pixels by its texture's name
  const railLay = (pts, size) => { const K = CART.floor, out = [], P = RAIL.h, B = RAIL.bend, [tw, th] = size(P.tex), k = RAIL.gauge / P.gauge, per = P.per * k, cut = P.at / tw, pw = P.per / tw;
    const F = pts.map(([x, y]) => [x, y / K]), cum = [0]; for (let i = 1; i < F.length; i++) cum.push(cum[i - 1] + Math.hypot(F[i][0] - F[i - 1][0], F[i][1] - F[i - 1][1]));
    const at = (d) => { let i = 1; while (i < F.length - 1 && cum[i] < d) i++; const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1]); return [F[i - 1][0] + (F[i][0] - F[i - 1][0]) * t, F[i - 1][1] + (F[i][1] - F[i - 1][1]) * t, i]; };
    const dir = (d) => { const a = at(d - B.reach), b = at(d + B.reach); return Math.atan2(b[1] - a[1], b[0] - a[0]); }, turn = (a, b) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) * 180 / Math.PI;
    let last = null;
    for (let d = 0; d < cum[cum.length - 1]; d += per) { const [x, y, i] = at(d), r = { tex: P.tex, x, y: y * K, dx: pts[i][0] - pts[i - 1][0], dy: pts[i][1] - pts[i - 1][1], lift: P.lift, w: per + 0.5, h: th * k, src: [cut, 0, cut + pw, 1] };
      // round a bend the period goes out in slices, each along the rails' own way where it lies, as few as keep every turn under `step`
      if (turn(dir(d - per / 2), dir(d)) + turn(dir(d), dir(d + per / 2)) > B.flat) for (let n = 2; n <= B.most; n++) {
        const ph = Array.from({ length: n }, (_, j) => dir(d + per * ((j + 0.5) / n - 0.5)));
        if (n < B.most && [last ?? ph[0], ...ph].some((q, j, o) => j && turn(o[j - 1], q) > B.step)) continue;
        r.parts = ph.map((p, j) => { const dj = d + per * ((j + 0.5) / n - 0.5), [px, py] = at(dj), u = cut + pw * (j + 0.5) / n, hw = (per / n + B.lap) / 2 / k / tw;
          return { x: px, y: py * K, dx: Math.cos(p), dy: Math.sin(p) * K, w: per / n + B.lap, src: [u - hw, 0, u + hw, 1] }; });
        break; }
      last = r.parts ? Math.atan2(r.parts[r.parts.length - 1].dy / K, r.parts[r.parts.length - 1].dx) : Math.atan2(r.dy / K, r.dx);
      out.push(r); }
    return out; };
  // the two rails' axes of the laid track as view-px segments, one pair per laid sprite (`size` as railLay's)
  const railAxes = (pts, size) => { const K = CART.floor, g = RAIL.gauge / 2, out = [];
    for (const r of railLay(pts, size).flatMap((q) => q.parts || [q])) { const ph = Math.atan2(r.dy / K, r.dx), ux = Math.cos(ph), uy = Math.sin(ph), l = r.w / 2;
      for (const sd of [-1, 1]) { const nx = -uy * g * sd, ny = ux * g * sd; out.push([[r.x - ux * l + nx, r.y + (-uy * l + ny) * K], [r.x + ux * l + nx, r.y + (uy * l + ny) * K]]); } }
    return out; };
  const railTot = (pts) => pts.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
  const railAt = (pts, d) => { d = Math.max(0, Math.min(railTot(pts), d)); for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay); if (d <= l || i === pts.length - 1) return [ax + (bx - ax) * d / l, ay + (by - ay) * d / l]; d -= l; } };
  // where the cart stands for the sim's distance `s` run: its distance `ds` along the rails (it stops `stop` px short of their end), the point,
  // and `s` held to the rails' length, which the wheels' lug turns by, so a cart standing at the end has still wheels (town_motion_r9 6)
  const cartAt = (pts, s) => { const tot = railTot(pts), sr = Math.max(0, Math.min(s, tot)), ds = sr * (tot - CART.stop) / tot, [x, y] = railAt(pts, ds); return { x, y, ds, s: sr }; };
  const viewOf = (pts, s, side) => {
    const q0 = railAt(pts, s - CART.reach), q1 = railAt(pts, s + CART.reach), th = Math.atan2(Math.abs(q1[1] - q0[1]), Math.abs(q1[0] - q0[0])) * 180 / Math.PI;
    const run = Math.sign(q1[0] - q0[0]) || 1;
    if (!side) return { th, run, side: 0, sx: 1, rot: 0, tilt: 0 };
    const ph = Math.atan2((q1[1] - q0[1]) / CART.floor, q1[0] - q0[0]), g = Math.cos(ph) < 0 ? -RAIL.gauge / 2 : RAIL.gauge / 2;
    const rail = (d) => { const a = railAt(pts, d - 1), b = railAt(pts, d + 1), p = Math.atan2((b[1] - a[1]) / CART.floor, b[0] - a[0]), c = railAt(pts, d); return [c[0] - Math.sin(p) * g, c[1] + CART.floor * Math.cos(p) * g]; };
    const n0 = rail(s - CART.span), n1 = rail(s + CART.span), o = railAt(pts, s), tn = Math.atan2(Math.abs(n1[1] - n0[1]), Math.abs(n1[0] - n0[0])) * 180 / Math.PI;
    return { th, run, side: 1, turn: 1, sx: 1, rot: Math.max(-CART.trim, Math.min(CART.trim, CART.diag - tn)), tilt: 0, near: [(n0[0] + n1[0]) / 2 - o[0], (n0[1] + n1[1]) / 2 - o[1]] };
  };
  const cartView = (pts, s) => viewOf(pts, s, viewOf(pts, s, 0).th < CART.front ? 1 : 0);
  // the change of view, the first rails' distance the 3/4 view is shown at, and the cross-fade over `fade` px of rails about it: `a` is the
  // 3/4 painting's share, the front one's 1 - a (drawCart turns the shares into alphas), F and S their views (town_motion_r9 3: one frame swapped a 25 px box for a 54 px one)
  const cartSwap = (pts) => { let lo = 0, hi = railTot(pts); if (cartView(pts, lo).side) return lo;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (cartView(pts, mid).side) hi = mid; else lo = mid; } return hi; };
  const cartFade = (pts, s, at = cartSwap(pts)) => { const t = Math.max(0, Math.min(1, (s - at) / CART.fade + 0.5));
    return { a: t * t * (3 - 2 * t), F: viewOf(pts, s, 0), S: viewOf(pts, s, 1) }; };
  // where the painting's point (dx, dy from its bottom centre, w x h px) lands in the view for the cart at `v` (cartAt) on the view `V`
  // drawn `g` times its size about its near feet's midpoint (`cartFoot`), so they stay on the near rail as it grows
  const cartPut = (name, w, h, V, v, g = 1) => { const st = V.side ? cartSeat(name, w, h, V) : cartSeatF(name, w, h), r = V.rot * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), fm = V.side ? cartFoot(name, w, h, V) : [0, 0];
    return (dx, dy) => { const x = fm[0] + g * (dx - st[0] - fm[0]), y = fm[1] + g * (dy - st[1] - fm[1]); return [v.x + x * c - y * sn, v.y + x * sn + y * c]; }; };
  // the 3/4 painting's near feet's midpoint from its seat, in its own px
  const cartFoot = (name, w, h, V) => { const [[u0], [u1]] = CART.hubs[name], [f0, f1] = CART.foot[name], st = cartSeat(name, w, h, V); return [((u0 + u1) / 2 - 0.5) * w - st[0], ((f0 + f1) / 2 - 1) * h - st[1]]; };
  // the 3/4 painting's size through the fade at its share `a`: its end of the box (`face`) as tall as the front one's when it comes in, its own when the fade is done
  const cartGrow = (nmS, nmF, size, a) => { const f = (n) => (CART.face[n][1] - CART.face[n][0]) * size(n)[1], r = f(nmF) / f(nmS); return r + (1 - r) * a; };
  // the points the cart touches the rails with: the front painting's two slab feet, the 3/4 one's two near wheels' feet
  const cartFeet = (side, name, w, h, V, v, g = 1) => { const P = cartPut(name, w, h, V, v, g);
    return side ? CART.hubs[name].map(([u], q) => P((u - 0.5) * w, (CART.foot[name][q] - 1) * h)) : CART.wheelsF[name].x.map((u) => P((u - 0.5) * w, (CART.wheelsF[name].foot - 1) * h)); };
  // the lug's place on wheel `q` of the 3/4 painting `name` (w x h px) after `s` px rolled, from the painting's bottom centre; `run` is
  // the screen side (+1 right) the cart goes to as `s` grows, so the wheel's top turns that way (TASKS 2109: it turned against the travel)
  const cartHubs = (name, w, h) => { const [[u0, v0], [u1, v1]] = CART.hubs[name]; return Math.hypot((u1 - u0) * w, (v1 - v0) * h); };
  const cartLug = (name, q, w, h, s, run) => { const G = CART.lug, [hu, hv] = CART.hubs[name][q], a = run * s / (G.roll * cartHubs(name, w, h));
    return [(hu - 0.5) * w + Math.cos(a) * G.rx * w, (hv - 1) * h + Math.sin(a) * G.ry * h]; };
  // the 3/4 painting's point that rides the rails' middle, from its bottom centre (w x h px) on the view `V`: its near feet's midpoint, off by
  // the way to the near rail (`V.near`, view px, the rails' floor-space gauge squashed to the view) turned back into the painting by `V.rot`
  const cartSeat = (name, w, h, V) => { const [[u0], [u1]] = CART.hubs[name], [f0, f1] = CART.foot[name], r = -V.rot * Math.PI / 180, [nx, ny] = V.near;
    return [((u0 + u1) / 2 - 0.5) * w - (nx * Math.cos(r) - ny * Math.sin(r)), ((f0 + f1) / 2 - 1) * h - (nx * Math.sin(r) + ny * Math.cos(r))]; };
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
  // a quest's name as the player reads it: its template's, or its own (nameOf) where one template stands for several quests
  const questName = (q) => { const Q = QUESTS[q.key]; return (Q.nameOf && Q.nameOf(q)) || Q.name; };
  Object.assign(D, { CAPTIVES, CAPTIVE_FLEE, captiveFleeAt, NOTES, STORY, QUESTS, questName, BOSS_QUEST_NAME, questReward, QUEST_GIVE, QUEST_SAY, turnFill, storyChain, CRAFT, STASH, FOLK, FOLK_SAY, FOLK_HOLD, FOLK_FIRST, KEEPER, folkClock, folkInit, folkSprite, henLook, FOLK_TURN, FOLK_FLINCH, folkFlinchAt, robeFlinched, walkSweepAt, railPts, CART, cartView, cartSwap, cartFade, cartPut, cartFoot, cartGrow, cartFeet, railAxes, cartAt, railAt, railTot, cartLug, cartHubs, cartSeat, cartSeatF, cartHook, cartWinch, cartRope, RAIL, railLay });
  // a giver's quest mark (TASKS 2105) stands over his head, centred on him; `gap` is the plate's foot above the head, `small` the scale of a
  // mark kept at the screen's edge when the giver's feet or head are off it, `margin` its distance from that edge, `box` the hit box of a full-size one
  // `nudge` (town_game_r10 4): how far a full mark may slide across and down from over the head to clear the HUD before it goes small;
  // `headSmall`: the most of the givers with the head on the screen questMarkCheck lets show a small mark (19.5 % before the nudge)
  const QMARK = { gap: 10, w: 34, h: 40, box: [40, 48], bob: 4, bobSmall: 0, small: 0.6, margin: 16, glow: 46, label: 34, hudPad: 2, depth: 4, nudge: [40, 16], headSmall: 0.18 };
  // the mark's hit box at (x, y), full or small, as [x0, y0, x1, y1]
  const questMarkBox = (x, y, small) => { const s = small ? QMARK.small : 1, bw = QMARK.box[0] * s / 2, bh = QMARK.box[1] * s / 2; return [x - bw, y - bh, x + bw, y + bh]; };
  // the world draws the marks under the HUD (TASKS 2125): `hud` is its parts as [x0, y0, x1, y1] (HUD.markZones), and no mark box
  // may touch one. A full mark over a clear head stays there; one that would lie under a part and finds no room by it becomes small, and a small one slides
  // out of the parts to the free spot nearest where it would stand, so it keeps by its giver or along the edge toward him
  // A full mark that would touch a part first slides beside it or a little lower, within `nudge`, on the screen (town_game_r10 4: a
  // third of the marks went small for a mere touch of the tracker's corner): the free spot nearest over the head, or null
  const nudgeFull = (gx, cy, W, H, hits) => { const [nx, ny] = QMARK.nudge, b0 = questMarkBox(0, 0, false), pad = QMARK.hudPad, seen = new Set();
    const fit = (x, y) => [Math.max(-b0[0], Math.min(W - b0[2], x)), Math.max(-b0[1], Math.min(H - b0[3], y))], near = (p) => Math.abs(p[0] - gx) <= nx && p[1] >= cy && p[1] - cy <= ny;
    let best = null, bestD = Infinity, front = [fit(gx, cy)];
    for (let d = 0; d <= QMARK.depth && front.length; d++) { const next = [];
      for (const p of front) { const key = Math.round(p[0]) + ',' + Math.round(p[1]); if (seen.has(key) || !near(p)) continue; seen.add(key);
        const dist = Math.hypot(p[0] - gx, p[1] - cy); if (dist >= bestD) continue;
        const on = hits(questMarkBox(p[0], p[1], false)); if (!on.length) { best = p; bestD = dist; continue; }
        for (const z of on) next.push(fit(z[0] + b0[0] - pad, p[1]), fit(z[2] + b0[2] + pad, p[1]), fit(p[0], z[3] + b0[3] + pad)); }
      front = next; }
    return best; };
  const questMarkAt = (gx, gy, spriteH, k, W, H, hud = [], margin = QMARK.margin) => {
    const cy = gy - spriteH * k - QMARK.gap - QMARK.h / 2, hits = (b) => hud.filter((z) => b[0] < z[2] && b[2] > z[0] && b[1] < z[3] && b[3] > z[1]);
    if (gx >= 0 && gx <= W && gy >= 0 && gy <= H && cy - QMARK.h / 2 >= 0) { const f = nudgeFull(gx, cy, W, H, hits); if (f) return { x: f[0], y: f[1], small: false, edge: [0, 0] }; }
    const ex = QMARK.w * QMARK.small / 2 + margin, ey = QMARK.h * QMARK.small / 2 + margin, clamp = (x, y) => [Math.max(ex, Math.min(W - ex, x)), Math.max(ey, Math.min(H - ey, y))];
    const p0 = clamp(gx, cy), b0 = questMarkBox(0, 0, true), pad = QMARK.hudPad, seen = new Set();
    let best = null, bestD = Infinity, front = [p0];
    for (let d = 0; d <= QMARK.depth && front.length; d++) { const next = [];
      for (const p of front) { const key = Math.round(p[0]) + ',' + Math.round(p[1]); if (seen.has(key)) continue; seen.add(key);
        const dist = Math.hypot(p[0] - p0[0], p[1] - p0[1]); if (dist >= bestD) continue;
        const on = hits(questMarkBox(p[0], p[1], true)); if (!on.length) { best = p; bestD = dist; continue; }
        for (const z of on) next.push(clamp(z[0] + b0[0] - pad, p[1]), clamp(z[2] + b0[2] + pad, p[1]), clamp(p[0], z[1] + b0[1] - pad), clamp(p[0], z[3] + b0[3] + pad)); }
      front = next; }
    const [x, y] = best || p0;
    return { x, y, small: true, edge: [Math.sign(Math.round(gx - x)), gy > H ? 1 : Math.sign(Math.round(cy - y))], free: !!best };
  };
  Object.assign(D, { QMARK, questMarkAt, questMarkBox });
})(typeof window !== 'undefined' ? window : globalThis);
