// live/sim_checks_maprev.js — selfCheck's part for the map's revision (TASKS 2062): every write to a floor's cells, block, water or locks moves it, no file writes the map past sim_map.js, and what is cached by it is built anew after a write. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, TILE, flow, mapw, newRun, openSecret, rev, spawn } = SIMX, fs = require('fs'), path = require('path');
  const SEARCH = 200;
  const plain = (seed) => { const S = spawn(0, {}); S.run = newRun(S, 'campaign', seed); return S; };
  const reach = (F, from, to) => { for (let k = 0; k < F.length; k++) if (F[k] >= from && F[k] <= to) return k; return -1; };
  const target = (m) => [Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE)];
  // every way of writing the map there is, the cheapest arguments that change nothing the floor shows
  const OPS = {
    setCell: (m) => mapw.setCell(m, 0, m.cells[0]),
    fillCells: (m) => mapw.fillCells(m, [[0, 0]], m.cells[0]),
    blockPush: (m) => mapw.blockPush(m, 0),
    blockOnce: (m) => mapw.blockOnce(m, 1 + Math.max(0, ...m.block)),
    blockDrop: (m) => mapw.blockDrop(m, 0),
    addWater: (m) => mapw.addWater(m, []),
    dropWater: (m) => mapw.dropWater(m, []),
    unlatch: (m) => mapw.unlatch(m, {}, 0),
    put: (m) => mapw.put(m, 'block', m.block),
    touch: (m) => mapw.touch(m) };
  // what writes the map's arrays and counters, found by its receiver (`m`, `map`, `.map`) so a record's own `cells` is not one
  const RECV = String.raw`(?:\bm|\bmap|\.map)\.`;
  const DIRECT = [new RegExp(RECV + String.raw`cells\[[^\]]*\]\s*=[^=]`), new RegExp(RECV + String.raw`(?:cells|block|water)\s*=[^=]`),
    new RegExp(RECV + String.raw`(?:block|water)\.(?:push|splice|pop|shift|unshift|fill|sort|reverse)\b`), new RegExp(RECV + String.raw`(?:block|water)\[[^\]]*\]\s*=[^=]`),
    /\.geometry\b/, new RegExp(String.raw`(?:\bm|\.map)\.shut\b`)];
  // a water set of its own beside waterSet (the scene's WET)
  const OWN_WATER = [/\bWET\b/];
  const scan = (res) => { const dir = __dirname, files = fs.readdirSync(dir).filter((f) => /^(sim|scene|hud|ui|monsters)(_\w+)?\.js$/.test(f) && !/^sim_(checks|map)/.test(f)), found = [];
    for (const f of files) fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, i) => { const code = line.replace(/(^|\s)\/\/.*$/, ''); if (res.some((re) => re.test(code))) found.push(`${f}:${i + 1}`); });
    return found; };
  const written = () => scan(DIRECT);
  function mapRevCheck(out) {
    const m = plain(9).run.map, keys = Object.keys(m);
    for (const k of ['rev', 'geometry', 'shut']) if (keys.includes(k)) out.push(`maprev: the map holds ${k}, which a copy, a save and the map's print would carry`);
    const before = JSON.stringify(m); rev(m); if (JSON.stringify(m) !== before) out.push('maprev: reading the revision changes the map');
    for (const [name, op] of Object.entries(OPS)) { const r = rev(m); op(m); if (rev(m) === r) out.push(`maprev: ${name} leaves the revision where it was`); }
    const k = m.block[0]; if (k !== undefined) { const r = rev(m); mapw.blockOnce(m, k); if (rev(m) !== r) out.push('maprev: putting a cell in block that is there already moves the revision'); }
    const a = plain(9).run.map, b = plain(9).run.map, c = structuredClone(a);
    if (rev(a) !== rev(a)) out.push('maprev: a map has two revisions');
    if (rev(a) === rev(b)) out.push('maprev: two maps of one seed and floor share a revision');
    if (rev(a) === rev(c)) out.push('maprev: a copy of a map shares its revision');
    for (const at of written()) out.push(`maprev: ${at} writes the map past sim_map.js`);
  }
  // two maps of one seed and floor were one key (seed:floor) to every cache: a field made for one was handed to the other
  function twinCheck(out) {
    const A = plain(31).run.map, B = plain(31).run.map, [tx, ty] = target(A), FA = flow(A, tx, ty, 1), k = reach(FA, 4, 400);
    if (k < 0) { out.push('maprev: no cell of the first floor is more than 3 steps from its start'); return; }
    mapw.blockPush(B, k);
    const FB = flow(B, tx, ty, 1);
    if (FB[k] !== -1 || FA[k] < 4) out.push('maprev: the flow field of a twin floor is the cached one of the other');
  }
  // the defect: a statue's cell freed once its slide is over changes the floor with no door or secret changing, and the field stayed as it was
  function statueCheck(out) {
    let S = null, q = null;
    for (let sd = 1; sd <= SEARCH && !q; sd++) { S = plain(5000 + sd); q = S.run.map.secrets.find((o) => o.slide); }
    if (!q) { out.push('maprev: no floor with a statue secret in the seeds tried'); return; }
    const R = S.run, m = R.map, W = m.W, d = m.decor.find((o) => o.secret === m.secrets.indexOf(q)), k0 = Math.floor(d.y / TILE) * W + Math.floor(q.x / TILE);
    const at = [k0 + 1, k0 - 1, k0 + W, k0 - W].find((n) => m.cells[n] === 1 && !m.block.includes(n));
    if (at === undefined || m.cells[k0] !== 1) { out.push('maprev: the statue has no free cell beside its own'); return; }
    openSecret(S, R, q);
    const [tx, ty] = [at % W, Math.floor(at / W)], held = flow(m, tx, ty, 1)[k0];
    S.t = q.openT + D.STATUE_SECRET.slide + 0.01; SIMX.stepStatues(S, R);
    const freed = flow(m, tx, ty, 1)[k0];
    if (held !== -1) out.push('maprev: the cell a sliding statue holds is walked over');
    if (!q.open || freed < 0) out.push('maprev: the flow field still holds the statue\'s cell after its slide is over (the cached field, not a new one)');
  }
  // TASKS 2074: an arena's flood grows the water of a map whose set was already made, and the sim and the scene read the same set
  function waterCheck(out) {
    const m = plain(9).run.map, k = m.cells.findIndex((c, i) => c === 1 && !m.water.includes(i)), at = { x: (k % m.W + 0.5) * TILE, y: (Math.floor(k / m.W) + 0.5) * TILE };
    const before = SIMX.waterSet(m); if (before.has(k) || SIMX.inWater(m, at)) out.push('maprev: a dry floor cell reads as water');
    mapw.addWater(m, [k]);
    if (!SIMX.waterSet(m).has(k)) out.push('maprev: the water set stays as it was before the flood');
    if (!SIMX.inWater(m, at)) out.push('maprev: the sim does not wade in the flooded cell');
    mapw.dropWater(m, [k]); if (SIMX.waterSet(m).has(k)) out.push('maprev: the water set keeps a cell the arena drained');
    for (const at2 of scan(OWN_WATER)) out.push(`maprev: ${at2} keeps a water set of its own`);
  }
  SIMX.checks.add('mapRevCheck', mapRevCheck);
  SIMX.checks.add('mapWaterCheck', waterCheck);
  SIMX.checks.add('mapTwinCheck', twinCheck);
  SIMX.checks.add('mapStatueCheck', statueCheck, { slow: true });
})(typeof window !== 'undefined' ? window : globalThis);
