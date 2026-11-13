// live/data_town.js — quests, crafting, the storage chest, the townsfolk and the keeper.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { plural, runOf, stageOf, xpNeed } = D;
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
  // TASKS 1781: the cart has two paintings, the 3/4 view (its wheel line 23 degrees up to the right) and the front one (travel
  // plumb into the screen), and no view between. A sprite turned in the screen's plane tips over, so the 3/4 one turns no more than
  // `roll` and narrows to the front one's width (`squash`, its long side foreshortening as it turns away) to keep its wheels on the
  // bend; the front one never turns: its uprights stay plumb and only its axle tilts (a shear) to lie square to the rails on the
  // floor squashed to the view's depth (`floor`, as the floor discs). One painting at a time: a cross-fade showed both carts at once
  const CART = { side: 23, front: 58, straight: 45, roll: 30, squash: 0.8, floor: 0.68, reach: 14 };
  const cartView = (pts, s) => {
    const tot = pts.reduce((a, q, i) => a + (i ? Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0),
      at = (d) => { d = Math.max(0, Math.min(tot, d)); for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay); if (d <= l || i === pts.length - 1) return [ax + (bx - ax) * d / l, ay + (by - ay) * d / l]; d -= l; } },
      q0 = at(s - CART.reach), q1 = at(s + CART.reach), th = Math.atan2(Math.abs(q1[1] - q0[1]), Math.abs(q1[0] - q0[0])) * 180 / Math.PI, R2D = 180 / Math.PI;
    if (th < CART.front) { const k = Math.max(0, Math.min(1, (th - CART.straight) / (CART.front - CART.straight))), sx = 1 - (1 - CART.squash) * k;
      return { th, side: 1, sx, rot: -(th - Math.atan(Math.tan(CART.side / R2D) / sx) * R2D), tilt: 0 }; }
    return { th, side: 0, sx: 1, rot: 0, tilt: Math.atan(CART.floor * CART.floor / Math.tan(th / R2D)) * R2D };
  };
  Object.assign(D, { CAPTIVES, NOTES, STORY, QUESTS, questReward, QUEST_GIVE, QUEST_SAY, turnFill, storyChain, CRAFT, STASH, FOLK, FOLK_SAY, KEEPER, folkClock, folkInit, railPts, CART, cartView });
})(typeof window !== 'undefined' ? window : globalThis);
