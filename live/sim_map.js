// live/sim_map.js — the one place a floor's map is written once it is built (TASKS 2062): its cells, the cells solid props hold (block), its water and the locks' latches.
// One of the sim's files (ARCHITECTURE.md §4.2), loaded before sim_core.js. Every write moves the map's revision, and each cache of what the map holds (the flow fields,
// the secrets' mask, the minimap's cut, the scene's baked masks) is keyed by it, so no cache can miss a change or be cleared by hand.
(function (root) {
  const SIMX = (root.SIMX = root.SIMX || {});
  // the revision lives outside the map: a map is cloned, kept in a save and compared by its JSON (samecheck, mapPrint, the floor's diff), and none of them may see a counter.
  // A number is never handed out twice, so two maps of one seed and floor (two runs, a clone) never share a key
  const REVS = new WeakMap();
  let last = 0;
  const rev = (m) => { let r = REVS.get(m); if (r === undefined) REVS.set(m, r = ++last); return r; };
  const touch = (m) => { REVS.set(m, ++last); };
  // the cells' own revision (TASKS 2087): the minimap draws nothing but the cells, so a write to the water, the block or a lock (a flood's
  // every step) leaves its picture, and the cache of it, as they were; any write to the cells moves both revisions
  const CREVS = new WeakMap();
  const cellsRev = (m) => { let r = CREVS.get(m); if (r === undefined) CREVS.set(m, r = ++last); return r; };
  const touchCells = (m) => { CREVS.set(m, ++last); touch(m); };
  const setCell = (m, k, v) => { m.cells[k] = v; touchCells(m); };
  const fillCells = (m, xys, v) => { for (const [x, y] of xys) m.cells[y * m.W + x] = v; touchCells(m); };
  const blockPush = (m, k) => { m.block.push(k); touch(m); };
  const blockOnce = (m, k) => { if (!m.block.includes(k)) blockPush(m, k); };
  const blockDrop = (m, ...ks) => { m.block = m.block.filter((b) => !ks.includes(b)); touch(m); };
  const addWater = (m, ks) => { m.water.push(...ks); touch(m); };
  const dropWater = (m, ks) => { const gone = new Set(ks); m.water = m.water.filter((k) => !gone.has(k)); touch(m); };
  // a lock opens without its door's cells changing: a monster passes a door whose lock is open, so the flow fields change with it
  const unlatch = (m, L, t) => { L.open = 1; L.openT = t; touch(m); };
  // a whole field laid anew (a floor put back from a save, a QA state's own floor)
  const put = (m, field, v) => { m[field] = v; if (field === 'cells') touchCells(m); else touch(m); };
  // the water's cells as a set, one for the sim's wading and the scene's rings alike (TASKS 2074): a flood grows m.water under both
  const WATER = new WeakMap();
  const waterSet = (m) => { let w = WATER.get(m); if (!w || w.rev !== rev(m)) WATER.set(m, w = { rev: rev(m), cells: new Set(m.water || []) }); return w.cells; };
  // a cache's key as text (TASKS 2081); one of a map's own starts from its revision, which no other map ever shares, never from its seed and floor
  const keyOf = (...parts) => parts.join(':');
  const revKey = (m, ...parts) => keyOf(rev(m), ...parts);
  const cellsKey = (m, ...parts) => keyOf(cellsRev(m), ...parts);
  // a bridge drawn as stepping stones (no landings at its ends over water) carries no deck, posts or torches; one answer per map revision for the sim's step sound, the rockfall's dust and the scene's lights and drawing
  const DECKS = new WeakMap();
  const deckKinds = (m) => { const cached = DECKS.get(m); if (cached && cached.rev === rev(m) && cached.crossings === m.crossings) return cached;
    const dungeon = root.DUNGEON || require('./dungeon.js'), wet = waterSet(m), crossings = m.crossings || [];
    const dry = new Set(crossings.filter((c) => c.kind === 'bridge' || c.kind === 'ford').flatMap((c) => c.cells));
    const stones = new Set(crossings.filter((c) => c.look === 'stones' || (c.kind === 'bridge' && !c.lava && !c.chasm && !dungeon.bridgeLands(m, c, wet, dry))));
    const deckCells = new Set(crossings.filter((c) => c.kind === 'bridge' && !stones.has(c)).flatMap((c) => c.cells));
    const entry = { rev: rev(m), crossings: m.crossings, stones, deckCells }; DECKS.set(m, entry); return entry; };
  const crossingOnStones = (m, c) => deckKinds(m).stones.has(c);
  const deckAt = (m, cell) => deckKinds(m).deckCells.has(cell);
  const mapw = { rev, touch, touchCells, setCell, fillCells, blockPush, blockOnce, blockDrop, addWater, dropWater, unlatch, put };
  Object.assign(SIMX, { mapw, rev, cellsRev, waterSet, crossingOnStones, deckAt, keyOf, revKey, cellsKey });
})(typeof window !== 'undefined' ? window : globalThis);
