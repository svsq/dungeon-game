// live/sim_core.js — the sim's base: constants, rng, the event bus S.ev and the run's log, run and stage lookups, map queries (cells, collisions, water, lava, webs, flow fields, sight) and the camera clamp.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = (root.SIMX = {});
  const D = root.DATA || require('./data.js'), DG = root.DUNGEON || require('./dungeon.js');
  const { TILE, ENEMIES, BAL, ELITE, eliteK, windOf, under, ELITE_MODS, BASES, CONSUMABLES, RARITY, AFFIXES, ABILITIES, META, UI } = D;
  const DT = 1 / 120, L = 26.0;
  // VIEW is the screen (the pointer comes in its px); WIN the world window the camera shows on it, zoomed
  // the zoom lives on the run (R.zoom, copied from the player's setting every step) so camera and pointer follow a change at once
  // the view is 1920 wide and as tall as the window's aspect asks, from 1080 (16:9) past 1200 (16:10) to 1248 (a MacBook's 1512×982)
  // on an 8 px step, so the 2×2 world grid and the blur targets stay whole (TASKS 1861); the page sets it, Node keeps 16:9. A window
  // wider than 16:9 keeps 1080 and shows bars at its sides: a wider world window would show more of a floor than its light and fog
  // were tuned for, and the HUD's right column would drift from its windows
  const VIEW = { W: 1920, H: 1080 }, VIEW_H = D.VIEW_H, viewFor = (w, h) => Math.max(VIEW_H[0], Math.min(VIEW_H[1], Math.round(VIEW.W * h / w / 8) * 8)),
    setView = (h) => { VIEW.H = Math.max(VIEW_H[0], Math.min(VIEW_H[1], Math.round(h / 8) * 8)); return VIEW.H; }, uiDy = (scr) => D.uiDy(scr, VIEW.H),
    zoomOf = (R) => (R && R.zoom) || D.ZOOM || 1, WIN = (R) => ({ W: VIEW.W / zoomOf(R), H: VIEW.H / zoomOf(R) }),
    toPx = (R, x, y) => ({ px: (x - R.cam[0]) * zoomOf(R), py: (y - R.cam[1]) * zoomOf(R) });
  const HINT = TXT('HINT');
  // STEP: a step's length at a run (TASKS 1802: 20 px stepped 8.7 times a second at a quarter of his height; 26 broke his gait's bob and his knees walking down)
  const K = { HIT: 0.13, RUN: 175, ACC: 1900, DEC: 2300, DASH: 640, DASH_T: 0.16, DASH_CD: 0.75, LEAP: 0.14, R: 12, STEP: 22 };
  const DEMO_SEED = 4247, CAM_FEET = 18;
  const EEL_MOUTH = [44, 56];   // where the eel's mouth is when it is up: ahead of it and over the water (view px; the scene draws it there)

  // ---------------- rng (state lives in the run: deterministic replay) ----------------
  const rnd = (R) => { R.rs = (R.rs + 0x6d2b79f5) | 0; let t = Math.imul(R.rs ^ (R.rs >>> 15), 1 | R.rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (R, a, b) => a + Math.floor(rnd(R) * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(rnd(R) * arr.length)];
  const ev = (S, e) => { e.t = S.t;
    S.ev.push(e); if (!S.demo && !(S.run && S.run.test) && SIMX.META_EV.has(e.k)) SIMX.metaEvent(S, e); if (S.run && S.run.quests && SIMX.QUEST_EV.has(e.k)) SIMX.questOn(S, S.run, e); if (S.run && e.k === 'hurt') S.run.recentDamage = (S.run.recentDamage || []).concat({ t: e.t, src: e.src, n: e.n, actor: e.actor || null }).slice(-3);
    if (S.run && e.k === 'boom') S.run.scorches = (S.run.scorches || []).filter((s) => S.t - s.t < 4).concat({ ...e }).slice(-24); if (S.run && S.run.log && !S.demo) note(S, e); };
  // hard's extra damage and HP ramp in over floors 1-3: ×1.3 × ×1.25 from the first room killed a third of average players there (TASKS 200)
  // the run's description (data.js RUNS) and how deep a floor of it is in campaign floors: everything that grows as floors climb
  // reads the depth, the run's own floor numbers only place its bosses, guards and end
  // the endless descent's first floor: past the serpent it goes on from the 13th (TASKS 386)
  const FROM = (R) => (R.campaignWon ? D.RUNS.campaign.floors + 1 : 1);
  // what the stairs say before a floor's boss is beaten: its chapter's own words (TASKS 416), the run's for its own floors
  const sealOf = (R) => { const N = D.stageOf(R.mode, R.floor, R.seed, FROM(R)).N; return (N && N !== RUN(R) && N.seal) || RUN(R).seal; };
  const RUN = (R) => D.runOf(R.mode), STAGE = (R, f = R.floor) => D.stageOf(R.mode, f || 1, R.seed, FROM(R)), dep = (R, f = R.floor) => STAGE(R, f).depth, lastFloor = (R) => R.floor === RUN(R).floors;
  // the campaign's last floor stays its last past the descent (TASKS 514: the run's mode is then the descent's, which has none, and
  // the 16th's portal out was drawn and taken as a second stairs down); its exit is the portal out, its own stairs on are m.down;
  // in a run through the town it has none: that run ends in the town, at the Keeper (TASKS 515, 1148), its boss's portal leads there
  const finalFloor = (R, f = R.floor) => f === RUN(R).floors || (!!R.campaignWon && f === D.RUNS.campaign.floors);
  // a run through the town that has slain the campaign's last boss (TASKS 1148): it may end in the town, won, or go on down
  const campaignDone = (R) => !!R.viaTown && (!!R.campaignWon || (R.slain || []).includes(D.RUNS.campaign.floors));
  const exitKind = (R, f = R.floor) => (!finalFloor(R, f) ? 'stairs' : R.viaTown ? null : 'portal');
  const dif = (R, k) => { const v = (D.DIFF[R.diff] || D.DIFF.normal)[k]; return v > 1 && (k === 'dmg' || k === 'hp') ? 1 + (v - 1) * Math.min(1, dep(R) / 3) : v; };
  const who = (e) => e ? e.type + (e.elite && !D.BOSSES[e.type] ? ' elite' : '') : '?';
  // the statistics (TASKS 1309): `from` is the number of runs finished before these counters existed, so the screen can say they
  // started late instead of passing a short count off as the whole history
  const statsOf = (S) => S.meta.stats || (S.meta.stats = { from: S.meta.runs || 0, all: {}, cls: {} });
  const tally = (S, R, k, n = 1, max) => { if (S.demo || !R || !n || R.test) return; const T = statsOf(S), id = D.clsOf(R.hero).id, C = T.cls[id] || (T.cls[id] = {});
    for (const o of [T.all, C]) o[k] = max ? Math.max(o[k] || 0, n) : (o[k] || 0) + n; };
  // the run's log for balance analysis (index.html downloads it when the run ends): one record per floor, filled from the events
  const logFloor = (R) => R.log.fl[R.log.fl.length - 1];
  const add = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  const potCount = (h) => { const n = {}; for (const it of h.bag) if (it && /potion/.test(it.b)) add(n, it.b, it.n || 1); return n; };
  function note(S, e) { const R = S.run, L = logFloor(R); if (!L) return;
    if (e.k === 'hurt') { add(L.dmg, e.src, e.n); add(L.hits, e.src); R.log.last = e.src;
      const tail = R.log.tail = R.log.tail || []; tail.push([+e.t.toFixed(2), e.src, e.n, Math.round(R.hero.hp)]); if (tail.length > 12) tail.shift(); }   // the blows before a death
    else if (e.k === 'drink') add(L.pot, e.b);
    else if (e.k === 'kill') add(L.kills, who(R.en.find((o) => o.id === e.id) || { type: e.type }));
    else if (e.k === 'lvl') L.lvl = e.lvl;
    else if (e.k === 'gold') L.gold += e.n || 0;
    else if (e.k === 'shard') add(L, 'shards', e.n);
    else if (e.k === 'trade') { if (e.n < 0) { L.buy -= e.n; L.buys.push(e.s); } else L.sell += e.n; }
    else if (e.k === 'cast' || e.k === 'whirl' || e.k === 'shield') add(L.ab, e.k === 'cast' ? 'fireball' : e.k);
    if (e.k === 'equip' || e.k === 'unequip') { const st = SIMX.heroSt(S); (L.gear = L.gear || []).push({ t: +e.t.toFixed(2), slot: e.slot, on: e.on || null, off: e.off || null, maxHp: st.maxHp, def: st.def, atk: st.atk }); }
    if (e.k === 'bless') { const st = SIMX.heroSt(S); (L.gifts = L.gifts || []).push(e.cost == null ? { t: +e.t.toFixed(2), id: e.id, revive: 1 } : { t: +e.t.toFixed(2), id: e.id, name: e.s, cost: e.cost, maxHp: st.maxHp, def: st.def, atk: st.atk }); } }
  SIMX.META_EV = new Set(['kill', 'hit', 'pickup', 'bless']);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  // ---------------- map queries ----------------
  const cell = (m, tx, ty) => (tx < 0 || ty < 0 || tx >= m.W || ty >= m.H ? 0 : m.cells[ty * m.W + tx]);
  const inRoom1 = (r, tx, ty) => tx >= r.x - 1 && tx <= r.x + r.w && ty >= r.y - 1 && ty <= r.y + r.h;
  // the start room and the merchant's shop (plus one cell): the generator posts no monster there; they are not warded (TASKS 152)
  const inRoom0 = (r, tx, ty) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  const inStart = (m, tx, ty) => inRoom0(m.rooms[m.start], tx, ty) || (!!m.shop && inRoom1(m.rooms[m.shop.room], tx, ty));
  // the magma caves' crust (dungeon.js m.crust, TASKS 401): lava gone hard along the banks. The hero walks it, a monster keeps off it as
  // off lava; under one standing on it CRUST.stand s it cracks, CRUST.crack s on it is lava again (m.melt[k].hot) for CRUST.hot s
  // (TASKS 476) thin: the crust of a way out to a hoard's islet (m.thin) cracks after `thin` s standing, so it is crossed at a walk and
  // never stood on; fall: a hero the crust melts under falls into the lava, losing that share of his health past armour and set
  // alight for `burn` s, and climbs out where he last stood on firm ground
  // (sink: how long a fallen hero is under before he climbs out, TASKS 484: at once he was moved back up to ~290 px in a frame)
  const CRUST = { stand: 1, crack: 0.5, hot: 3.5, set: 0.8, thin: 0.35, fall: 0.3, burn: 3, sink: 0.6 }, CRS = new WeakMap(), THIN = new WeakMap();
  const thinSet = (m) => { let s = THIN.get(m); if (!s) THIN.set(m, s = new Set(m.thin || [])); return s; };
  const crustSet = (m) => { if (!m.crust || !m.crust.length) return null; let s = CRS.get(m); if (!s) CRS.set(m, s = new Set(m.crust)); return s; };
  const crustAt = (m, k) => { const s = crustSet(m); return !!s && s.has(k) && !(m.melt && m.melt[k] && m.melt[k].hot); };
  // the plateaus' chasm (TASKS 400): the rock below the top wall, which only a blow knocks a monster into (TASKS 401)
  const chasm = (m, tx, ty) => !!m.cliff && tx > 0 && ty > 0 && tx < m.W - 1 && ty < m.H - 1 && ty >= m.cliff[tx] && m.cells[ty * m.W + tx] === 0 && !(m.stub && m.stub.includes(ty * m.W + tx));
  // lava (3) can be entered — it burns — by the hero (not on the plateaus, where it stops him at the bank as deep water does, TASKS
  // 401, but for a boss's tongues of it, which he must be able to cross) and by a monster knocked into it; a monster never walks into it on its own. lavaOk 2: a blow carries a monster into the chasm
  // a sealed arena's lava is no way out for the hero: a river of the fire biome runs through its wall in about one floor-6 arena in
  // five, and out by it he was shut out of the room with the stairs (TASKS 470); m.arenaBox is the room's box while sealed
  const sealedOut = (m, tx, ty) => { const A = m.arenaBox; return !!A && (tx < A[0] || ty < A[1] || tx >= A[2] || ty >= A[3]); };
  // a lava bridge's rope rails stand on the lava cells along both sides of its deck: nobody walks off the deck into the fire (derived from m.crossings, cached)
  const RAIL = new WeakMap();
  const railed = (m, k) => { let r = RAIL.get(m);
    if (!r) { RAIL.set(m, r = new Set());
      for (const c of m.crossings || []) { if (c.kind !== 'bridge' || !c.span) continue; const [u0, u1, v0] = c.span, hor = c.axis === 'x';
        for (let u = u0; u <= u1; u++) for (const v of [v0 - 1, v0 + 2]) { const q = (hor ? v : u) * m.W + (hor ? u : v); if (m.cells[q] === 3) r.add(q); } } }
    return r.has(k); };
  const solidAt = (m, x, y, mon, lavaOk) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), c = cell(m, tx, ty);
    if (c === 3) { const k = ty * m.W + tx; if (railed(m, k)) return true; if (!mon && sealedOut(m, tx, ty)) return true; if (crustAt(m, k)) return !!mon && !lavaOk; return !lavaOk && !(!mon && m.arenaLava && m.arenaLava.includes(k)); } if (c === 0 && lavaOk === 2 && chasm(m, tx, ty)) return false; return c !== 1; };
  // the brink (TASKS 476, data.js BRINK): a cell a monster sinks or falls in; whether one can be pushed off at all; the drop cell
  // within `near` of it, if any (nearest first); whether a blow from (sx, sy) drives it at a drop
  const dropCell = (m, tx, ty) => (cell(m, tx, ty) === 3 && !crustAt(m, ty * m.W + tx)) || chasm(m, tx, ty);
  const pushable = (e) => { const E = ENEMIES[e.type]; return e.deadT < 0 && !E.ghost && !E.lava && !E.heavy && !E.deep && !e.elite && e.type !== 'brute' && !D.BOSSES[e.type] && e.sinkT === undefined && e.fallT === undefined; };
  const brinkOf = (m, e) => { if (!m.cliff || !pushable(e)) return null; const tx0 = Math.floor(e.x / TILE), ty0 = Math.floor(e.y / TILE); let best = null;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const tx = tx0 + i, ty = ty0 + j; if (!dropCell(m, tx, ty)) continue;
      const x = Math.max(tx * TILE, Math.min((tx + 1) * TILE, e.x)), y = Math.max(ty * TILE, Math.min((ty + 1) * TILE, e.y)), d = Math.hypot(x - e.x, y - e.y);
      if (d <= D.BRINK.near && (!best || d < best.d)) best = { x, y, d, tx, ty }; } return best; };
  const atBrink = (m, e, sx, sy) => { const dx = e.x - sx, dy = e.y - sy, d = Math.hypot(dx, dy) || 1;
    return D.BRINK.reach.some((r) => dropCell(m, Math.floor((e.x + dx / d * r) / TILE), Math.floor((e.y + dy / d * r) / TILE))); };
  const onLava = (m, o) => { const tx = Math.floor(o.x / TILE), ty = Math.floor(o.y / TILE); return cell(m, tx, ty) === 3 && !crustAt(m, ty * m.W + tx); };
  // shallow water (dungeon.js m.water) lies on floor cells: anyone wades through it slowed, and it puts out a burning one
  const WET = new WeakMap(), WADE = 0.75;
  const inWater = (m, o) => { if (!m.water || !m.water.length) return false; let w = WET.get(m); if (!w) WET.set(m, w = new Set(m.water));
    return w.has(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE)); };
  const onPlate = (a, tr) => Math.abs(a.x - tr.x) < TILE - 4 && Math.abs(a.y - tr.y) < TILE - 6;
  // a web on the floor (dungeon.js m.webs) holds whoever wades in, spiders aside, until it is torn
  const WEB = { k: 0.4, mon: 0.5, rx: 28, ry: 17 };
  const webAt = (m, o) => (m.webs || []).find((w) => !w.torn && Math.abs(o.x - w.x) < WEB.rx * w.s && Math.abs(o.y - w.y) < WEB.ry * w.s);
  // a slime's puddle (TASKS 308) slows whoever wades in, slimes and ghosts aside, until it dries; it shrinks over its last GOO.dry s
  // (m.goo; its radius now, rNow, is kept by the sim's step)
  const GOO = { k: 0.55, mon: 0.6, dry: 2 };
  // a skeleton mage's ball of water (TASKS 311) slows the hero it soaks for a while
  const ORB = ENEMIES.skel_mage.orb, soaked = (S, h) => S.t < (h.slowT ?? -9);
  const gooAt = (m, o) => (m.goo || []).find((g) => g.rNow > 4 && Math.abs(o.x - g.x) < g.rNow && Math.abs(o.y - g.y) < g.rNow * 0.6);
  // feet box against the grid, axis by axis (slides along walls); the middles of its front and back edges too, or a body wider
  // than a two-cell wall (the boss) straddles it with its corners on both sides
  const boxHit = (m, x, y, r, mon, lavaOk) => solidAt(m, x - r, y - r * 0.6, mon, lavaOk) || solidAt(m, x + r, y - r * 0.6, mon, lavaOk) || solidAt(m, x - r, y + r * 0.4, mon, lavaOk) || solidAt(m, x + r, y + r * 0.4, mon, lavaOk)
    || solidAt(m, x, y - r * 0.6, mon, lavaOk) || solidAt(m, x, y + r * 0.4, mon, lavaOk);
  function move(m, o, dx, dy, r, mon, lavaOk = (!mon && !m.cliff) || onLava(m, o)) {
    // steps of at most 8 px: the boss's roar shoved the hero 150 px in one move, through a shut door (TASKS 219)
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8);
    if (steps > 1) { let bx = false, by = false;
      for (let i = 0; i < steps; i++) { const hit = move(m, o, dx / steps, dy / steps, r, mon, lavaOk); bx ||= hit[0]; by ||= hit[1]; }
      return [bx, by];
    }
    const hit = (x, y) => boxHit(m, x, y, r, mon, lavaOk);
    let bx = false, by = false;
    // blocked on one axis by a corner it almost clears: slide sideways (up to 12 px) toward the opening
    const nudge = (ax) => { for (let k = 1; k <= 12; k += 1) for (const sg of [1, -1]) {
      if (ax === 'x' && !hit(o.x + dx, o.y + sg * k) && !hit(o.x, o.y + sg * k)) { o.y += sg * Math.min(k, Math.abs(dx) + 1); return true; }
      if (ax === 'y' && !hit(o.x + sg * k, o.y + dy) && !hit(o.x + sg * k, o.y)) { o.x += sg * Math.min(k, Math.abs(dy) + 1); return true; } } return false; };
    if (dx) { if (!hit(o.x + dx, o.y)) o.x += dx; else { bx = true; if (!dy && !mon) nudge('x'); } }
    if (dy) { if (!hit(o.x, o.y + dy)) o.y += dy; else { by = true; if (!dx && !mon) nudge('y'); } }
    if (hit(o.x, o.y)) {                                   // started inside a blocked cell (spawned or knocked there): step out
      for (let k = 1; k < 6; k++) for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!hit(o.x + ax * k * 4, o.y + ay * k * 4)) { o.x += ax * k * 4; o.y += ay * k * 4; return [bx, by]; } }
    return [bx, by];
  }
  // out of solid props (feet ellipse against each prop's circle), through move() so the push never lands in a wall
  function shove(m, o, r, mon, sol) {
    for (const s of sol) { const rr = s.r + r; let dx = o.x - s.x; if (dx >= rr || dx <= -rr) continue; let dy = (o.y - s.y) * 1.6; if (dy >= rr || dy <= -rr) continue; let d = Math.hypot(dx, dy); if (d >= rr) continue;
      if (d < 0.01) { dx = 0; dy = d = 1; }
      move(m, o, s.x + dx / d * rr - o.x, s.y + dy / d * rr / 1.6 - o.y, r, mon); }
  }
  // a point blocks the line only if the wall is there both at it and 8 px up: two actors hugging the same wall can still reach
  // each other along its face, and a line through a wall still crosses a whole blocked cell
  // a step from one cell to its diagonal neighbour between two walls slips through their shared corner: that corner is shut too
  const solidC = (m, tx, ty) => { const c = cell(m, tx, ty); return c === 0 || c === 4 || c === 5; };
  const pinch = (m, cx, cy, nx, ny) => cx !== nx && cy !== ny && solidC(m, nx, cy) && solidC(m, cx, ny);
  const overLava = (m, x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8); for (let i = 0; i <= n; i++) { const x = Math.floor((x0 + (x1 - x0) * i / n) / TILE), y = Math.floor((y0 + (y1 - y0) * i / n) / TILE), k = y * m.W + x; if (m.cells[k] === 3 && !crustAt(m, k)) return true; } return false; };
  const losClear = (m, x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10), wall = (x, y) => solidC(m, Math.floor(x / TILE), Math.floor(y / TILE));
    let cx = Math.floor(x0 / TILE), cy = Math.floor(y0 / TILE);
    for (let i = 1; i <= n; i++) { const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, nx = Math.floor(x / TILE), ny = Math.floor(y / TILE);
      if (pinch(m, cx, cy, nx, ny)) return false; cx = nx; cy = ny; if (i < n && wall(x, y - 8) && wall(x, y)) return false; } return true; };
  // doors (dungeon.js m.doors, m.locks): a door shut by a lock that is not open yet; the doors' state for the caches' keys
  const doorLock = (m, d) => { const L = d.lock >= 0 && m.locks ? m.locks[d.lock] : null; return L && !L.open ? L : null; };
  const doorKey = (m) => (m.doors || []).map((d) => (d.open ? 'o' : doorLock(m, d) ? 'l' : 'c')).join('') + ':' + (m.geometry || 0);
  // flow field from a target tile over open floor: derived data, cached by key, never in the state
  // a field per target, a few kept: the bot asks for its own fields between the monsters' each step, and one slot was rebuilt
  // every time (TASKS 467); a secret opened changes the floor without the doors' key
  const FLOW = new Map(), FLOW2 = new Map(), secKey = (m) => (m.secrets || []).map((q) => (q.open ? 1 : 0)).join('');
  let BQ = new Int32Array(0);
  function bfs(m, tx, ty, lim, doors) {
    const W = m.W, H = m.H, N = W * H, d = new Int16Array(N).fill(-1), cs = m.cells, pass = new Uint8Array(N); if (BQ.length < N) BQ = new Int32Array(N);
    const q = BQ; let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) if (cs[i] === 1) pass[i] = 1;
    if (doors) for (const o of m.doors || []) if (!o.open && !o.arena && !doorLock(m, o)) for (const [x, y] of o.cells) pass[y * W + x] = 1;
    for (const i of m.block || []) pass[i] = 0;
    if (cell(m, tx, ty) === 1) { d[ty * W + tx] = 0; q[qt++] = ty * W + tx; }
    while (qh < qt) { const i = q[qh++], dv = d[i]; if (dv > lim) continue; const x = i % W, y = (i / W) | 0, nd = dv + 1; let j;
      if (x + 1 < W) { j = i + 1; if (d[j] < 0 && pass[j]) { d[j] = nd; q[qt++] = j; } }
      if (x > 0) { j = i - 1; if (d[j] < 0 && pass[j]) { d[j] = nd; q[qt++] = j; } }
      if (y + 1 < H) { j = i + W; if (d[j] < 0 && pass[j]) { d[j] = nd; q[qt++] = j; } }
      if (y > 0) { j = i - W; if (d[j] < 0 && pass[j]) { d[j] = nd; q[qt++] = j; } } }
    return d;
  }
  function flow(m, tx, ty, any) {
    const C = any ? FLOW2 : FLOW, key = m.seed + ':' + m.floor + ':' + tx + ',' + ty + ':' + doorKey(m) + ':' + secKey(m); let d = C.get(key);
    if (d) { C.delete(key); C.set(key, d); return d; }
    d = bfs(m, tx, ty, any ? 400 : 40, any); if (C.size >= 16) C.delete(C.keys().next().value); C.set(key, d); return d;
  }
  // a monster walking back to its post may be far from it: a whole-floor field per post, a few kept at once
  const HOME = new Map();
  function homeFlow(m, tx, ty) {
    const fk = m.seed + ':' + m.floor + ':' + (m.geometry || 0) + ':' + doorKey(m); if (HOME.fk !== fk) { HOME.clear(); HOME.fk = fk; }
    const key = ty * m.W + tx; let d = HOME.get(key);
    if (!d) { d = bfs(m, tx, ty, 400); if (HOME.size >= 24) HOME.delete(HOME.keys().next().value); }
    else HOME.delete(key);
    HOME.set(key, d); return d;
  }
  // fog of war: a cell opens when the hero has a line of sight to it (rock and fake walls block it, lava and deep water don't) within 8×6 cells;
  // the wall cells around what is seen open with it, and two more above each, so the 3/4 facades show whole. A room opens whole
  // as soon as any of its floor is in sight, its own ring of wall too, but never the floor of a room behind a thin wall (TASKS 104)
  const REV = { arr: null, k: '' };
  const CHOICE = new WeakMap();
  function reveal(R, arrive) {
    const m = R.map, h = R.hero, W = m.W, tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE), ri2 = DG.roomAt(m, h.x, h.y);
    const k = tx + ':' + ty + ':' + (m.secrets || []).map((q) => q.open).join('') + ':' + doorKey(m);
    if (REV.arr === R.seen && REV.k === k) return ri2;
    REV.arr = R.seen; REV.k = k;
    const hid = SIMX.secretMask(m), inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < m.H;
    const opaque = (x, y) => { if (!inMap(x, y)) return true; const n = y * W + x, c = m.cells[n]; return (c !== 1 && c !== 3 && c !== 6) || hid.has(n); };
    const wall = (x, y) => { if (!inMap(x, y) || !opaque(x, y)) return; for (let d = 0; d <= 2 && inMap(x, y - d) && opaque(x, y - d); d++) R.seen[(y - d) * W + x] = 1; };
    const fx = h.x / TILE, fy = h.y / TILE;
    const sight = (x, y) => { const dx = x + 0.5 - fx, dy = y + 0.5 - fy, n = Math.ceil(Math.hypot(dx, dy) * 3);
      for (let i = 1; i < n; i++) { const cx = Math.floor(fx + dx * i / n), cy = Math.floor(fy + dy * i / n); if (cx === x && cy === y) break; if (opaque(cx, cy)) return false; } return true; };
    // on the plateaus (TASKS 453) the window is an ellipse, not its 17×13 box: over open lava nothing stops the sight, and the box's
    // straight sides showed as a rectangle of lava in the dark
    // (its rim varies cell by cell, TASKS 482: a walk along a straight way swept the ellipse's edge into a straight line)
    // (a smooth noise over 3 cells, TASKS 1037: hashed cell by cell it left single cells revealed out in the fog, crumbs of lava)
    // (and ±0.1 cell by cell on the rim, TASKS 1048, 1056: smooth alone, the edge ran straight along the lava again)
    const { fogHash: hh, fogNoise: h01 } = DG;
    // (arriving on a magma floor the oval opens past the rock too, the player's decision on 1636; never onto a secret)
    const rooms = new Set(), oval = !!m.cliff, wide = oval && arrive ? DG.FOG_ARRIVE : 1, ry = Math.ceil(6 * wide), rx = Math.ceil(8 * wide);
    for (let y = ty - ry; y <= ty + ry; y++) for (let x = tx - rx; x <= tx + rx; x++) { if (!inMap(x, y) || (oval && !DG.inFogOval(x, y, fx, fy, wide)) || (wide > 1 ? hid.has(y * W + x) : !sight(x, y))) continue;
      if (opaque(x, y)) { wall(x, y); continue; }
      R.seen[y * W + x] = 1; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) wall(x + u, y + v);
      const ri = DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE); if (ri >= 0) rooms.add(ri); }
    // a room shows whole once seen; a plateau's box is mostly lava, so there only its floor and the lava within two cells of it
    // (TASKS 453: the whole box was a rectangle of lava cut out of the dark)
    // (by distance, with a reach of 1.6–3.2 cells that varies cell by cell, TASKS 482: within a 5×5 square the edge ran ruler-straight
    // along the floor's own rows for 6–18 cells)
    const nearFloor = (x, y, r) => { const rr = DG.fogReach(x, y); for (let v = -3; v <= 3; v++) for (let u = -3; u <= 3; u++) { const X = x + u, Y = y + v;
      if (u * u + v * v <= rr * rr && X >= r.x - 1 && X <= r.x + r.w && Y >= r.y - 1 && Y <= r.y + r.h && inMap(X, Y) && m.cells[Y * W + X] === 1) return true; } return false; };
    for (const ri of rooms) { if (R.rseen[ri]) continue; R.rseen[ri] = 1; const r = m.rooms[ri];
      for (const [bx, by, bw, bh] of DG.rectsOf(r)) for (let y = by - 2; y <= by + bh + 1; y++) for (let x = bx - 2; x <= bx + bw + 1; x++) { if (!inMap(x, y)) continue;
        const own = DG.inRm(r, x, y);
        if (oval && m.cells[y * W + x] !== 1 && !nearFloor(x, y, r)) continue;
        if (opaque(x, y)) wall(x, y); else if (own || DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) < 0) R.seen[y * W + x] = 1; } }
    // a lake's or a river's choice (dungeon.js m.choice, TASKS 486): every way over and the stairs show from the first bank
    if (m.choice && R.choiceShown !== R.floor) { let A = CHOICE.get(m); if (!A) CHOICE.set(m, A = new Set(m.choice.at));
      // (each way as a lane of the cells within two of it, TASKS 1037: its floor alone showed as crumbs scattered in the fog)
      // (TASKS 1048: grown out from what is seen, each lane joined to it; laid whole, a lane hung in the fog, a loose piece of lava;
      // the stairs' room shows apart, as the goal)
      if (A.has(ty * W + tx)) { R.choiceShown = R.floor; const lane = new Set(), ex = m.exit.tx, ey = m.exit.ty;
        for (const k of m.choice.show) { const x = k % W, y = Math.floor(k / W); if (Math.abs(x - ex) <= 5 && Math.abs(y - ey) <= 5) { R.seen[k] = 1; continue; }
          for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) if (u * u + v * v <= 2.5 + 5 * hh(x + u + 3, y + v + 61) && inMap(x + u, y + v)) lane.add((y + v) * W + x + u); }   // (ragged, TASKS 1056: an even lane ran straight beside a straight way)
        const q = [...lane].filter((k) => !R.seen[k] && [1, -1, W, -W].some((o) => R.seen[k + o] && !opaque((k + o) % W, Math.floor((k + o) / W))));
        for (let i = 0; i < q.length; i++) { const k = q[i]; if (R.seen[k]) continue; const x = k % W, y = Math.floor(k / W); if (opaque(x, y)) { wall(x, y); continue; } R.seen[k] = 1;
          for (const o of [1, -1, W, -W]) if (lane.has(k + o) && !R.seen[k + o]) q.push(k + o); } } }
    // an open cell the reveal's edges left unseen in the middle of seen ones shows (TASKS 482: black holes inside the open lava)
    if (oval) for (let y = ty - 14; y <= ty + 14; y++) for (let x = tx - 18; x <= tx + 18; x++) { if (!inMap(x, y) || R.seen[y * W + x] || opaque(x, y)) continue;
      let n = 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if ((u || v) && inMap(x + u, y + v) && R.seen[(y + v) * W + x + u]) n++;
      if (n >= 6) R.seen[y * W + x] = 1; }
    // and a closed pocket of up to 40 unseen open cells, seen cells all round it and off the map's edge, shows whole (TASKS 1037: the
    // rule above closed single cells only; pockets of 3–29 stayed black inside the open lava)
    if (oval) { const got = new Set(); for (let y = ty - 12; y <= ty + 12; y++) for (let x = tx - 16; x <= tx + 16; x++) { const k0 = y * W + x; if (!inMap(x, y) || R.seen[k0] || opaque(x, y) || got.has(k0)) continue;
        const q = [k0]; got.add(k0); let closed = true;
        for (let i = 0; i < q.length && closed; i++) { const qx = q[i] % W, qy = Math.floor(q[i] / W); if (qx <= 0 || qy <= 0 || qx >= W - 1 || qy >= m.H - 1 || q.length > 40) { closed = false; break; }
          for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = qx + u, ny = qy + v, nk = ny * W + nx; if (R.seen[nk] || got.has(nk)) continue; if (opaque(nx, ny)) { closed = false; break; } got.add(nk); q.push(nk); } }
        if (closed) for (const k of q) R.seen[k] = 1; } }
    // (a lone cell of lava seen with nothing seen round it is a crumb in the fog, not a view: it goes back under it)
    if (oval) for (let y = ty - 12; y <= ty + 12; y++) for (let x = tx - 16; x <= tx + 16; x++) { const k = y * W + x; if (!inMap(x, y) || !R.seen[k] || m.cells[k] !== 3) continue;
      let n = 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if ((u || v) && inMap(x + u, y + v) && R.seen[(y + v) * W + x + u]) n++; if (n === 0) R.seen[k] = 0; }
    // a door once seen shows whole: its leaf stands over the cells behind it (a top wall's over the corridor, a bottom wall's over the room)
    for (const d of m.doors || []) { if (!d.cells.some(([x, y]) => R.seen[y * W + x])) continue; const up = d.dir === 'u' ? [1, 2] : d.dir === 'd' ? [-1] : [];
      for (const [x, y] of d.cells) { R.seen[y * W + x] = 1; for (const k of up) if (inMap(x, y - k)) R.seen[(y - k) * W + x] = 1; } }
    return ri2;
  }
  // the camera may leave the map by more than the HUD's width, so a room at the edge never sits under the minimap or the bars
  function clampCam(R, c) { const m = R.map, w = WIN(R);
    const fit = (v, a, b, s) => (b - a <= s ? (a + b - s) / 2 : clamp(v, a, b - s));
    // the window's foot may drop below its bound as far as it takes to keep the hero's feet over the bottom panel (TASKS 1911)
    const foot = (b) => Math.max(b, R.hero ? R.hero.y + CAM_FEET + (UI.bp.h + UI.bp.foot) / zoomOf(R) : b);
    // the town is one fixed courtyard: past its ruins there is only void, so the view stays on it (TASKS 1612)
    if (m.town) { c[0] = fit(c[0], 2 * TILE, 54 * TILE, w.W); c[1] = fit(c[1], 2 * TILE, foot(35 * TILE), w.H); return; }
    // at ×0,5 the window can be wider than a small floor and its margins: the floor then sits in its middle (TASKS 1302)
    c[0] = fit(c[0], -620, m.W * TILE + 620, w.W); c[1] = fit(c[1], -380, foot(m.H * TILE + 300), w.H); }
  function snapCam(R) { const h = R.hero, lk = R.camLook || [0, 0], w = WIN(R); R.cam = [h.x - w.W / 2 + lk[0], h.y - 30 - w.H / 2 + lk[1]]; R.camV = [0, 0]; clampCam(R, R.cam); }

  Object.assign(SIMX, {
    D, DG, TILE, ENEMIES, BAL, eliteK, windOf, under, ELITE_MODS, BASES, CONSUMABLES, RARITY, AFFIXES, ABILITIES, META, UI, DT, L, VIEW, VIEW_H, viewFor, setView, uiDy,
    zoomOf, WIN, toPx, HINT, K, DEMO_SEED, EEL_MOUTH, rnd, ri, pick, ev, FROM, sealOf, RUN, STAGE, dep, lastFloor, finalFloor, exitKind, campaignDone, dif, who, statsOf, tally,
    logFloor, add, potCount, angDiff, cell, inRoom1, inStart, CRUST, thinSet, crustSet, crustAt, chasm, solidAt, dropCell, pushable,
    brinkOf, atBrink, onLava, WET, WADE, inWater, onPlate, WEB, webAt, GOO, ORB, soaked, gooAt, boxHit, move, shove, solidC, pinch,
    losClear, overLava, doorLock, doorKey, flow, homeFlow, reveal, clampCam, snapCam, CAM_FEET });
})(typeof window !== 'undefined' ? window : globalThis);
