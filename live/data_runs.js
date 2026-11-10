// live/data_runs.js — the runs (campaign, caves, magma, endless descent): their floors, stages, biomes and place names.
// One of the DATA files (ARCHITECTURE.md §4.2): pure data and pure helpers, no state; data.js checks the set.
(function (root) {
  const D = root.DATA || (root.DATA = {});
  const { ARCH, BAL, BIOMES, BOSSES, ELITE, FLOOR_MOD, FLOOR_MODS, SHOP, mix32 } = D;
  const RUNS = {
    // pop: monsters a room by floor over the plain count (TASKS 505: the 2nd and 4th, the bosses' floors of 56×42 and 64×48, came easier than the floors before them); elite: the share of elites by floor (the 4th's nine rooms held half the 3rd's elites)
    campaign: { name: TXT('RUNS.campaign.name'), floors: 16, chapter: 8, depth: 0, lvl: 1, pop: [1, 1.35, 1, 1.3, 1, 1, 1, 1], elite: [0.04, 0.04, 0.04, 0.08, 0.04, 0.04, 0.04, 0.04], size: [[56, 42], [56, 42], [64, 48], [64, 48], [72, 54], [72, 54], [80, 60], [84, 64]], rooms: [[9, 11], [9, 11], [12, 14], [12, 14], [14, 17], [14, 17], [18, 22], [18, 22]], biome: (f) => (f <= 2 ? 'dungeon' : f <= 4 ? 'crypt' : f <= 6 ? 'lava' : 'arcane'),
      boss: (f) => (f === 8 ? 'boss' : Object.keys(BOSSES).find((k) => BOSSES[k].floor === f)), guard: { 7: { hp: 2.2, dmg: 1 } }, exit: { 1: { hp: 0.85, dmg: 0.85 } },
      // (the magma caves' chapter, TASKS 416: their 1st–4th as the campaign's 13th–16th after the serpent, at their own depth 13–16,
      // with the packs and elites of their own run; the colossus closes the campaign; seal: a chapter's own, by its boss)
      // (shift 2, pops and elites over the magma's own run, TASKS 416: the hero comes down from the serpent at level 18, three over the
      // magma run's own kit, and the town's quests had dressed him; at depth 13–16 not one average bot of 95 died on the 13th–15th)
      // (13th 1.6 and 15th 2: after 414's bot and 1054's halls the 13th cost 0.7 potions and the 15th 1.2, under their bands; the 16th
      // stays 1.2, its elites 0.2: at 1.3 or 0.24 its fights ran past the floor's 400 s)
      chapters: [{ from: 9, run: 'cave', pop: [1.5, 1.4, 1.3, 1.3], elite: [0.12, 0.16, 0.20, 0.22], mob: 0.87, early: 1 }, { from: 13, run: 'magma', shift: 2, pop: [1.6, 1.7, 2, 1.2], elite: [0.14, 0.22, 0.26, 0.2] }], names: { 8: TXT('RUNS.campaign.names.8') }, seal: TXT('RUNS.campaign.seal'), then: 'endless' },
    cave: { name: TXT('RUNS.cave.name'), won: TXT('RUNS.cave.won'), wonText: TXT('RUNS.cave.wonText'), floors: 4, depth: 6, lvl: 10, arch: 'cave', size: [[72, 54], [80, 60], [88, 66], [88, 66]], biome: () => 'cave', boss: (f) => (f === 4 ? 'boss_serpent' : undefined), guard: { 3: { hp: 2.2, dmg: 1 } }, exit: {}, title: TXT('RUNS.cave.title'), loot: 3, pop: [1.25, 1.4, 1.3, 1.2], elite: [0.07, 0.13, 0.18, 0.22], mob: 0.87,
      kit: { lvl: 6, gear: [['longsword', 3], ['shield', 3], ['knight_helm', 3], ['plate_armor', 3], ['gauntlets', 3], ['iron_boots', 2], ['ring', 2], ['amulet', 3]], hp: 5, mp: 2, gold: 400 }, seal: TXT('RUNS.cave.seal') },
    // the magma caves (R-36, TASKS 399): after the campaign's 12th, so worth its 13th–16th in depth and loot, the hero at the level and
    // with the gold and potions the average bot leaves the 12th with (40 seeds: level 15, 14–16; gold 8900–10200; 9 potions); laid out as plateaus
    // (TASKS 400) on maps a size up from the caves', the 4th a plateau floor of the 3rd caves' size with the forge lord until his arena (413)
    // loot: +2 over the depth (13–16) puts its items at the hero's level, as the caves' +3 does (TASKS 424: +12 made them level 25–28,
    // a legendary of 25 on the 1st floor, and the run a walk)
    // (won: the victory's line, TASKS 490: the magma's win said the campaign's «Глубины покорены»)
    magma: { name: TXT('RUNS.magma.name'), won: TXT('RUNS.magma.won'), wonText: TXT('RUNS.magma.wonText'), floors: 4, depth: 12, lvl: 15, arch: 'plateau', size: [[88, 66], [96, 72], [104, 78], [88, 66]], biome: () => 'magma', boss: (f) => (f === 4 ? 'boss_colossus' : undefined), guard: { 3: { hp: 2.2, dmg: 1 } }, exit: {}, title: TXT('RUNS.magma.title'), loot: 2, pop: [1.4, 1.7, 1.8, 1], elite: [0.14, 0.22, 0.26, 0.2],
      kit: { lvl: 12, gear: [['longsword', 3], ['shield', 3], ['knight_helm', 3], ['plate_armor', 3], ['gauntlets', 3], ['iron_boots', 3], ['ring', 3], ['amulet', 3]], hp: 8, mp: 3, gold: 9000 }, seal: TXT('RUNS.magma.seal') },
  };
  // the endless descent (R-05, TASKS 348–349; a test button in the menu for now, after the serpent later, TASKS 354): no last floor.
  // Floors come in pairs, each pair one biome drawn from the run's seed (repeats allowed, the caves among them); the second floor of
  // a pair ends it, by turns with an elite brute guarding the exit (pairs 1, 3, …) and with the biome's boss (pairs 2, 4, …). A floor
  // is worth its own number in depth (monsters, loot, prices) and its map grows from `size.from` to `size.to` over `size.floors`
  // floors, then stays; rooms: one to `size.cells` cells of the map (13–17 on the campaign's 72×54). The hero starts as in the campaign
  RUNS.endless = { name: TXT('data_runs.endless.name'), floors: Infinity, depth: 0, lvl: 1, endless: 1, biome: () => 'dungeon', boss: () => undefined, guard: {}, exit: {},
    pool: ['dungeon', 'crypt', 'lava', 'arcane', 'cave', 'magma'], bosses: { dungeon: 'boss_spider', crypt: 'boss_necro', lava: 'boss_forge', arcane: 'boss', cave: 'boss_serpent', magma: 'boss_colossus' },
    pairGuard: { hp: 2.2, dmg: 1 }, big: ['boss', 'boss_serpent', 'boss_colossus'], bigFrom: 8, guardFrom: 6,
    // a boss past the campaign's last floor (the descent after the serpent): its health and blows over the depth's, so its fight holds
    // the campaign's boss bands (20–90 s, 150–250 % of the hero's health; TASKS 354: at ×1 the 16th's and 20th's took 14–21 s, 60–100 %; at ×1.6 the average's
    // took 22 and 31 s, 149 and 211 %, the expert's 24 s, 123–136 %, 40 seeds)
    deepBoss: { hp: 1.6, dmg: 1.6 }, size: { from: [48, 36], to: [88, 66], cave: [64, 48], floors: 16, cells: 270, rooms: 9 }, seal: '' };
  const runOf = (mode) => RUNS[mode] || RUNS.campaign;
  // whether the wandering merchant (TASKS 1010) is on floor f of a run through the town: fixed by the run's seed
  const wanderAt = (runSeed, f) => f >= SHOP.wander.from && mix32((Math.imul(runSeed >>> 0, 2654435761) + f * 40503) >>> 0) / 4294967296 < SHOP.wander.chance;
  // waystones (TASKS 1009) in a run through the town: every fourth floor of the campaign, every second of the descent past it
  // off by the player's call (TASKS 1359): the arena portals are enough for now
  const WAYSTONES = false, wayFloor = (f) => WAYSTONES && f > 0 && (f <= RUNS.campaign.floors ? f % 4 === 0 : (f - RUNS.campaign.floors) % 2 === 0);

  // two bags, each shuffled per block of pool-length draws and never the same twice across a block's seam (TASKS 386): the boss pairs
  // (1, 3, …) draw their boss, each of the five once a round, and take its biome (a single bag repeated the spider on the 20th and the
  // 24th, seed 3); the guard pairs (0, 2, …) draw their biome. A plain draw left run 104062 without caves for 7 pairs (floors 13-25).
  // A big boss in the first round goes to a place no sooner than `bigFrom`
  const BAGS = new Map();
  const bagOrder = (seed, kind, b) => { const key = seed + ':' + kind + ':' + b; let P = BAGS.get(key); if (P) return P;
    const M = RUNS.endless, n = M.pool.length; P = M.pool.map((_, i) => i);
    let a = mix32((mix32(seed >>> 0) + Math.imul(b + 1, 0x9e3779b9) + (kind === 'boss' ? 0x5bd1e995 : 0)) >>> 0);
    for (let i = n - 1; i > 0; i--) { a = mix32(a + 0x9e3779b9); const j = a % (i + 1); [P[i], P[j]] = [P[j], P[i]]; }
    const big = (i) => M.big.includes(M.bosses[M.pool[i]]);
    if (kind === 'boss' && !b) for (let q = 0; 4 * q + 4 < M.bigFrom && q < n; q++) if (big(P[q])) { const j = P.findIndex((x, k) => k > q && !big(x)); if (j > 0) [P[q], P[j]] = [P[j], P[q]]; }
    if (b && P[0] === bagOrder(seed, kind, b - 1)[n - 1]) [P[0], P[1]] = [P[1], P[0]];
    if (BAGS.size > 4096) BAGS.clear(); BAGS.set(key, P); return P; };
  // from: the descent's first floor (the 13th past the serpent): the rounds count from its first pair, or the campaign's floors
  // spent three of the first round's bosses on floors no one played (sixteenth to 28th repeated the necromancer, seed 1)
  const pairBiome = (seed, p) => { const M = RUNS.endless, n = M.pool.length, i = Math.floor(p / 2); return M.pool[bagOrder(seed, p % 2 ? 'boss' : 'guard', Math.floor(i / n))[i % n]]; };
  // floor f of the endless descent: lf is its place in its pair (a cave pair is laid out as the caves' 3rd and 4th, with all their
  // kinds, lakes and eels); size: its map in cells, growing with f to the cap; altar: on a guard pair's second floor and before a boss
  // big: the chapters' end bosses (the demon lord, the serpent) come no sooner than `bigFrom` (the player's call 02.11.2026): an arcane
  // or cave boss pair before it ends as a guard pair. The exit's guard (the campaign 7th's brute, 2.2 times an elite's health) stands
  // from `guardFrom`: on the 2nd it killed a hero of level 3 on five seeds in eight; before it a pair ends with the exit room's elite
  // (the magma caves as the caves are, TASKS 416: their own description's last two floors on their plateaus)
  const endlessBase = (f, seed, start = 1) => { const M = RUNS.endless, p = Math.floor((f - 1) / 2), pos = (f - 1) % 2, biome = pairBiome(seed, p - Math.floor((start - 1) / 2)), cave = biome === 'cave', magma = biome === 'magma', sub = cave ? RUNS.cave : magma ? RUNS.magma : null, end = pos === 1;
    const bossPair = p % 2 === 1 && !(M.big.includes(M.bosses[biome]) && 2 * p + 2 < M.bigFrom);
    // (the magma's own sizes: its 3rd floor's plateaus want 104×78)
    const Z = M.size, k = Math.min(1, (f - 1) / (Z.floors - 1)), from = cave ? Z.cave : Z.from, size = magma ? RUNS.magma.size[2 + pos] : [0, 1].map((i) => 2 * Math.round((from[i] + (Z.to[i] - from[i]) * k) / 2));
    return { N: sub || M, lf: sub ? 3 + pos : 1 + pos, n: sub ? 4 : 2, depth: f, last: end, fin: false, biome, boss: bossPair && end ? M.bosses[biome] : undefined, arch: sub ? sub.arch : undefined,
      guard: !bossPair && end && f >= M.guardFrom ? M.pairGuard : undefined, exit: f === 1 ? RUNS.campaign.exit[1] : undefined, pop: D.deepAxis(f, 'pop'), early: 0, elite: D.deepAxis(f, 'elite'), cd: D.deepAxis(f, 'cd'), mob: 1, size, rooms: sub ? undefined : Math.max(Z.rooms, Math.round(size[0] * size[1] / Z.cells)), altar: bossPair ? !end : end, pair: p, bossK: f > RUNS.campaign.floors ? M.deepBoss : undefined }; };
  // floor f's modifier (TASKS 381), by the run's seed, so a floor kept or climbed back to has the one it had: none on a boss's floor,
  // a cave's or a plateau's, or a campaign chapter's past its first
  const modOf = (seed, f, q) => { if (q.arch || q.boss || q.chap || f < FLOOR_MOD.from) return undefined;
    const a = mix32((mix32(seed >>> 0) + Math.imul(f, 0x2c1b3c6d) + 0x6a09e667) >>> 0);
    if (a / 4294967296 >= FLOOR_MOD.chance) return undefined;
    const W = Object.entries(FLOOR_MODS).filter(([, o]) => !(o.not || []).includes(q.biome) && !(o.notLay || []).includes(q.lay));
    let t = (mix32(a + 0x9e3779b9) / 4294967296) * W.reduce((s, [, o]) => s + o.w, 0);
    for (const [k, o] of W) { t -= o.w; if (t < 0) return k; } return W.length ? W[W.length - 1][0] : undefined; };
  // (its rooms floors take the layouts as the campaign's do, TASKS 379, the chain over the descent's own floors)
  // (a floor above the descent's start is no link of its chain: the campaign's, laid by its own)
  const endlessStage = (f, seed, start = 1) => { const o = endlessBase(f, seed, start); if (!o.arch) o.lay = layOf(seed, f, (g) => (g === f ? o : g < start ? null : endlessBase(g, seed, start))); o.mod = modOf(seed, f, o); return o; };
  // floor f of a run: N, the description that lays it out (the run's own or its chapter's), lf, its place among N's floors, n, how
  // many floors N lays out, depth, the campaign floor it is worth; last: the end of its chapter (layout: no river, no altar before
  // the boss), fin: the run's own last floor (the way out, the victory); biome and boss: its biome and its boss, if any; pop and
  // early: its chapter's monsters a hall and how many floors sooner its kinds come (RUNS chapters); elite: the share of its
  // monsters (from the campaign's 3rd floor) that come as elites, ELITE.share unless its chapter sets one for the floor; mob: its plain
  // monsters' blows over the depth's (a boss's and an elite's keep theirs)
  // the layout of a run's rooms-and-corridors floor f (TASKS 379): a chain from its 1st floor, each floor drawn by its own seed from its
  // biome's weights less the floor before's, so a floor's layout is the same however the run reaches it
  const layOf = (seed, f, at) => { let prev = 'rooms', got = 'rooms';
    for (let g = 1; g <= f; g++) { const q = at(g); if (!q || q.arch || g === 1 || q.boss) { got = 'rooms'; prev = got; continue; }
      const W = Object.entries(ARCH.lay[q.biome] || { rooms: 1 }).filter(([k]) => k !== prev && (ARCH.layFrom[k] || 1) <= q.depth && (!ARCH[k].minW || (q.size && q.size[0] >= ARCH[k].minW)));
      let t = (mix32((mix32(seed >>> 0) + Math.imul(g, 0x379f1)) >>> 0) / 4294967296) * W.reduce((a, [, w]) => a + w, 0); got = W.length ? W[0][0] : 'rooms';
      for (const [k, w] of W) { t -= w; if (t < 0) { got = k; break; } } prev = got; }
    return got; };
  // (a floor above the descent's start is the campaign's: back up the stairs from the 13th, a run through the town stands on the
  // serpent's 12th again, still in the descent's mode)
  const stageOf = (mode, f, seed = 0, from = 1) => { if (runOf(mode).endless) return f < from ? stageOf('campaign', f, seed) : endlessStage(f, seed, from); const M = runOf(mode), c = (M.chapters || []).filter((q) => f >= q.from).pop(), N = c ? RUNS[c.run] : M, lf = c ? f - c.from + 1 : f,
    n = c ? N.floors : M.chapter || M.floors, biome = N.biome(lf), boss = N.boss(lf),
    lay = N.arch ? undefined : layOf(seed, f, (g) => { const cg = (M.chapters || []).filter((q) => g >= q.from).pop(), Ng = cg ? RUNS[cg.run] : M, lg = cg ? g - cg.from + 1 : g; return { arch: Ng.arch, biome: Ng.biome(lg), boss: Ng.boss(lg), depth: g + M.depth, size: Ng.size && Ng.size[lg - 1] }; });
    return { N, lf, n, mod: modOf(seed, f, { arch: N.arch, boss, chap: !!c, biome, lay }), depth: f + M.depth + ((c && c.shift) || 0), last: lf === n, fin: f === M.floors, biome, boss, arch: N.arch, guard: N.guard[lf], exit: N.exit[lf], pop: (c && c.pop && c.pop[lf - 1]) || (!c && M.pop && M.pop[lf - 1]) || 1, early: (c && c.early) || 0,
      elite: (c && c.elite && c.elite[lf - 1]) ?? (!c && M.elite && M.elite[lf - 1]) ?? ELITE.share, mob: (c && c.mob) || (!c && M.mob) || 1,
      lay,
      ...(!N.arch && N.size && N.size[lf - 1] ? { size: N.size[lf - 1], rooms: N.rooms[lf - 1], secretK: N.size[lf - 1][0] * N.size[lf - 1][1] / (72 * 54) } : {}) }; };
  const rosterAt = (biome, f) => BIOMES[biome].roster.filter((t) => ((BIOMES[biome].from || {})[t] || 1) <= f);

  // where the hero is, for the minimap's title, the floor's banner and the saved run's line: the town (floor 0) or a floor
  // (a floor's modifier, TASKS 381, after its name: «Этаж 3 — Крипты · Затопленный»)
  const placeName = (f, mode, seed, from, m) => (f === 0 ? TXT('data_runs.placeName') : m && m.mod && FLOOR_MODS[m.mod] ? TXT('data_runs.placeName.3', { f, p2: floorName(f, mode, seed, from, m), mod: FLOOR_MODS[m.mod].name })
    : TXT('data_runs.placeName.2', { f, p2: floorName(f, mode, seed, from, m) }));
  // m: the floor's map, whose type (TASKS 471) names it in the magma caves
  const floorName = (f, mode, seed, from, m) => { const M = runOf(mode), st = stageOf(mode, f, seed, from), T = m && m.ftype && !m.bossType && ARCH.plateau.names[m.ftype];
    return (M.names || {})[f] || T || st.N.title || BIOMES[st.biome].name; };
  // (the powers agree with a feminine monster, TASKS 1045: «Кровожадный призывающий лавовая саламандра»)

  Object.assign(D, { RUNS, runOf, wanderAt, wayFloor, stageOf, rosterAt, placeName, floorName });
})(typeof window !== 'undefined' ? window : globalThis);
