// live/data_town.js — quests, crafting, the storage chest, the townsfolk and the keeper.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { plural, runOf, stageOf, xpNeed } = D;
  const QUESTS = {
    cull: { kind: 'side', type: 'kill', name: TXT('QUESTS.cull.name'), need: (f) => 10 + 2 * f, text: (q) => TXT('QUESTS.cull.text', { need: q.need, p2: TXT.n('QUESTS.cull.text.2', q.need), f: q.f }), rw: ['scroll', 'xp'] },
    elites: { kind: 'side', type: 'kill', elite: 1, name: TXT('QUESTS.elites.name'), need: (f) => 2 + Math.floor(f / 4), text: (q) => TXT('QUESTS.elites.text', { need: q.need, p2: TXT.n('QUESTS.elites.text.2', q.need), f: q.f }), rw: ['scroll', 'item'] },
    sweep: { kind: 'side', type: 'clear', name: TXT('QUESTS.sweep.name'), need: (f) => 3 + Math.floor(f / 4), text: (q) => TXT('QUESTS.sweep.text', { need: q.need, p2: TXT.n('QUESTS.sweep.text.2', q.need), f: q.f }), rw: ['xp', 'shards'] },
    descent: { kind: 'side', type: 'reach', name: TXT('QUESTS.descent.name'), need: () => 1, ahead: 2, text: (q) => TXT('QUESTS.descent.text', { f: q.f }), rw: ['scroll', 'shards'] },
    // the named foe from the 3rd floor (TASKS 1024: on the 1st it killed the bot's level-1 hero on two seeds in six)
    named: { kind: 'side', type: 'named', name: TXT('QUESTS.named.name'), need: () => 1, fresh: 1, noBoss: 1, from: 3, text: (q) => TXT('QUESTS.named.text', { f: q.f, title: q.title }), rw: ['scroll', 'item'], item: 3 },
    fetch: { kind: 'side', type: 'fetch', name: TXT('QUESTS.fetch.name'), need: () => 1, fresh: 1, noBoss: 1, text: (q) => TXT('QUESTS.fetch.text', { thing: q.thing, f: q.f }), rw: ['scroll', 'xp'] },
    room: { kind: 'side', type: 'room', name: TXT('QUESTS.room.name'), need: () => 1, fresh: 1, noBoss: 1, text: (q) => TXT('QUESTS.room.text', { f: q.f }), rw: ['xp', 'shards'] },
    chapter: { kind: 'story', type: 'boss', name: TXT('QUESTS.chapter.name'), need: () => 1, text: (q) => TXT('QUESTS.chapter.text', { f: q.f }), rw: ['shards', 'item'] },
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
  const QUEST_SAY = {
    smith: { done: TXT('QUEST_SAY.smith.done'), ask: TXT('QUEST_SAY.smith.ask'), thanks: TXT('QUEST_SAY.smith.thanks'), thing: TXT('QUEST_SAY.smith.thing'), ic: 'qi_casket' },
    porter: { done: TXT('QUEST_SAY.porter.done'), ask: TXT('QUEST_SAY.porter.ask'), thanks: TXT('QUEST_SAY.porter.thanks'), thing: TXT('QUEST_SAY.porter.thing'), ic: 'qi_casket' },
    sweeper: { done: TXT('QUEST_SAY.sweeper.done'), ask: TXT('QUEST_SAY.sweeper.ask'), thanks: TXT('QUEST_SAY.sweeper.thanks'), thing: TXT('QUEST_SAY.sweeper.thing'), ic: 'qi_locket' },
    child: { done: TXT('QUEST_SAY.child.done'), ask: TXT('QUEST_SAY.child.ask'), thanks: TXT('QUEST_SAY.child.thanks'), thing: TXT('QUEST_SAY.child.thing'), ic: 'qi_horse' },
    guard: { done: TXT('QUEST_SAY.guard.done'), ask: TXT('QUEST_SAY.guard.ask'), thanks: TXT('QUEST_SAY.guard.thanks'), thing: TXT('QUEST_SAY.guard.thing'), ic: 'qi_casket' },
    keeper: { done: TXT('QUEST_SAY.keeper.done'), ask: TXT('QUEST_SAY.keeper.ask'), thanks: TXT('QUEST_SAY.keeper.thanks'), thing: TXT('QUEST_SAY.keeper.thing'), ic: 'qi_locket' },
  };
  // the named foes (1019): a name and what it is, drawn for the quest; it walks as a strong elite of its floor's kind

  // the Keeper's story chain (TASKS 1022, a stub for R-04): a run's chapters as quests in order — each boss of the run's floors
  // (`chapter`), and the first floor of each of its later chapters (`depths`); R-04 will give the steps their own words
  const storyChain = (mode) => { const M = runOf(mode), out = []; if (M.endless) return out;
    for (let f = 1; f <= M.floors; f++) { if ((M.chapters || []).some((c) => c.from === f)) out.push({ key: 'depths', f }); if (stageOf(mode, f).boss) out.push({ key: 'chapter', f }); }
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
    smith: { name: TXT('FOLK.smith.name'), per: 1.45, hit: 0.6, rest: 4, lines: [[TXT('FOLK.smith.lines'), TXT('FOLK.smith.lines.2')],
      [TXT('FOLK.smith.lines.3'), TXT('FOLK.smith.lines.4')], [TXT('FOLK.smith.lines.5'), TXT('FOLK.smith.lines.6')]] },
    enchanter: { name: TXT('FOLK.enchanter.name'), per: 7.5, hit: 0.55, lines: [[TXT('FOLK.enchanter.lines'), TXT('FOLK.enchanter.lines.2')],
      [TXT('FOLK.enchanter.lines.3'), TXT('FOLK.enchanter.lines.4')], [TXT('FOLK.enchanter.lines.5'), TXT('FOLK.enchanter.lines.6')]] },
    keeper: { name: TXT('FOLK.keeper.name'), per: 9, hit: 0.3, lines: [[TXT('FOLK.keeper.lines'), TXT('FOLK.keeper.lines.2')],
      [TXT('FOLK.keeper.lines.3'), TXT('FOLK.keeper.lines.4')], [TXT('FOLK.keeper.lines.5'), TXT('FOLK.keeper.lines.6')]] },
    guard: { name: TXT('FOLK.guard.name'), per: 8, lines: [[TXT('FOLK.guard.lines'), TXT('FOLK.guard.lines.2')], [TXT('FOLK.guard.lines.3'), TXT('FOLK.guard.lines.4')],
      [TXT('FOLK.guard.lines.5'), TXT('FOLK.guard.lines.6')]] },
    porter: { name: TXT('FOLK.porter.name'), per: 1.7, v: 34, lines: [[TXT('FOLK.porter.lines'), TXT('FOLK.porter.lines.2')],
      [TXT('FOLK.porter.lines.3'), TXT('FOLK.porter.lines.4')], [TXT('FOLK.porter.lines.5'), TXT('FOLK.porter.lines.6')]] },
    sweeper: { name: TXT('FOLK.sweeper.name'), per: 1.25, pause: 7, v: 20, lines: [[TXT('FOLK.sweeper.lines'), TXT('FOLK.sweeper.lines.2')],
      [TXT('FOLK.sweeper.lines.3'), TXT('FOLK.sweeper.lines.4')], [TXT('FOLK.sweeper.lines.5'), TXT('FOLK.sweeper.lines.6')]] },
    child: { name: TXT('FOLK.child.name'), per: 2.3, pause: 6, v: 42, lines: [[TXT('FOLK.child.lines'), TXT('FOLK.child.lines.2')],
      [TXT('FOLK.child.lines.3'), TXT('FOLK.child.lines.4')], [TXT('FOLK.child.lines.5'), TXT('FOLK.child.lines.6')]] },
    mason: { name: TXT('FOLK.mason.name'), per: 1.3, hit: 0.55, v: 34, lines: [[TXT('FOLK.mason.lines'), TXT('FOLK.mason.lines.2')],
      [TXT('FOLK.mason.lines.3'), TXT('FOLK.mason.lines.4')], [TXT('FOLK.mason.lines.5'), TXT('FOLK.mason.lines.6')]] },
    hen: { per: 2.2 },
  };
  // how long a pair of lines shows (each line half of it)
  const FOLK_SAY = 5;
  // the Keeper of the Fire (R-25, TASKS 1016): what he says when spoken to (E), by what has happened since he last spoke; each
  // event is a page of the dialogue, the most weighty first, each told once; with nothing new, a pair of his idle lines
  const KEEPER = {
    first: [TXT('KEEPER.first'), TXT('KEEPER.first.2'),
      TXT('KEEPER.first.3')],
    death1: [TXT('KEEPER.death1'), TXT('KEEPER.death1.2')],
    death: [TXT('KEEPER.death'), TXT('KEEPER.death.2')],
    win: [TXT('KEEPER.win'), TXT('KEEPER.win.2')],
    boss: (name) => [TXT('KEEPER.boss', { name }), TXT('KEEPER.boss.2')],
    rare: (name) => [TXT('KEEPER.rare', { name }), TXT('KEEPER.rare.2')],
    away: [TXT('KEEPER.away'), TXT('KEEPER.away.2')],
    end: [TXT('KEEPER.end')], endDeep: [TXT('KEEPER.endDeep')],
  };
  // a townsperson's loop clock: its own rate and phase per instance, so no two move in sync
  const folkClock = (role, i, t) => { const per = FOLK[role].per * (1 + 0.12 * (((i * 0.618) % 1) - 0.5)), x = (t + i * 1.37) / per, n = Math.floor(x); return { n, u: x - n, per }; };

  // a walker starts standing at a stop of its round (the one it is placed on, give or take the seed's nudge, else the round's last): a first leg from off the round
  // ran into the forge's corner, and the porter skipped his pick-up and walked to the merchant empty-handed (TASKS 1031)
  const folkInit = (npcs) => npcs.map((n, i) => { const r = n.route, k = r ? r.findIndex((q) => Math.hypot(q.x - n.x, q.y - n.y) < 12) : -1, w = r ? (k >= 0 ? k : r.length - 1) : -1;
    return { i, role: n.role, x: r ? r[w].x : n.x, y: r ? r[w].y : n.y, face: 0, dist: 0, vx: 0, vy: 0, spd: 0, way: w, go: 0, t0: -i * 1.9, load: 0, lift: 0, stuck: 0, sayT: -9, byeT: -9, sayN: -1, near: 0 }; });

  Object.assign(D, { QUESTS, questReward, QUEST_GIVE, QUEST_SAY, storyChain, CRAFT, STASH, FOLK, FOLK_SAY, KEEPER, folkClock, folkInit });
})(typeof window !== 'undefined' ? window : globalThis);
