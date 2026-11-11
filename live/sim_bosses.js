// live/sim_bosses.js — arenas and bosses: gates, moves, summons, the colossus.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const {
    BAL, D, DG, DT, ENEMIES, K, LOOT, RUN, STAGE, TILE, WET, addFire, boxHit, cell, dep, dif, doorKey, drop, ev, flow, hurtHero, lastFloor,
    losClear, move, openDoor, rnd, rollItem, shove, standNear, steer, who } = SIMX;
  // a hit-stop holds only what the player must react to; the hold under the floor's name on «Продолжить» (TASKS 1812) is the whole
  // floor's and the hero's, as if those 1.2 s never were, so a save and a load dodge nothing (review of PR 57)
  function holdClocks(R, all) {
    if (all) return holdAll(R);
    for (const e of R.en) { if (e.deadT >= 0) continue;
      if (e.st === 'wind' || e.st === 'bwind' || e.st === 'strike' || e.st === 'rise') { if (e.t0 !== undefined) e.t0 += DT; if (e.bncT > 0) e.bncT += DT; } }
    for (const p of R.proj) p.t0 += DT;
    for (const q of R.lavaPending || []) { q.t += DT; if (q.t0 !== undefined) q.t0 += DT; }
    for (const egg of R.eggs || []) egg.hatchT += DT;
    for (const q of R.rocks || []) { q.t0 += DT; q.t += DT; }
    for (const c of R.cracks || []) c.t0 += DT;
  }
  // a mark is a clock by its name, and only a past or future moment (> 0) moves: 0, −9 and the like mean «never» and stay so
  // the colossus's nearT is seconds the hero has stood at its shins, not a moment: lagged, the hold would bring its stomp on
  const STAMP = /^(t0|ft|burn|fuse|poison|ifr|tugW|cryJolt|dashHalt|burnC|burnL)$|(T|Until|At)$/, SPAN = new Set(['nearT']);
  const lag = (o, ks) => { if (!o) return; for (const k of ks || Object.keys(o)) { const v = o[k];
    if (typeof v === 'number') { if (v > 0 && (ks || (STAMP.test(k) && !SPAN.has(k)))) o[k] += DT; } else if (!ks && v && typeof v === 'object' && !Array.isArray(v) && /T$/.test(k)) lag(v, Object.keys(v)); } };
  function holdAll(R) {
    const m = R.map, h = R.hero, each = (A, ks) => { for (const o of A || []) lag(o, ks); };
    for (const e of R.en) { e.vx = e.vy = 0; lag(e); }
    each(R.proj, ['t0']); each(R.lavaPending, ['t', 't0']); each(R.eggs, ['hatchT']); each(R.rocks, ['t0', 't']); each(R.cracks, ['t0']);
    each(R.pyres, ['t0']); each(R.fires, ['t0', 'hitT']); each(R.htraps, ['t0']); each(R.chests, ['openT', 'fuseT', 'bangT', 'hushT', 'nopeT']);
    each(m.doors, ['openT', 'nopeT']); each(m.locks, ['openT']); each(m.secrets, ['openT']); each(m.decor, ['openT', 'brokeT', 'outUntil']); each(m.goo, ['t0']);
    each(Object.values(m.melt || {}), ['crackT', 'meltT', 'setT']); lag(m.flood, ['t0']); lag(R.arena, ['t0']); lag(R.shop, ['greetT', 'tradeT', 'hitT', 'callT']); lag(R.msgNext, ['t']); lag(R, ['boomT', 'fuseLast']);
    for (const z of m.hazards || []) z.lag = (z.lag || 0) + DT;
    for (const tr of m.traps || []) tr.ph -= DT / 2.4;
    lag(h); lag(h.cd, Object.keys(h.cd)); lag(h.stag, ['t0', 't']); lag(h.sunk, ['t']); lag(h.read, ['t0']); lag(h.dashHit, ['t']); lag(h.leapV, [0]);
  }
  // a boss that closes a chapter pays as the finale did (20 shards, LOOT.boss); in the endless descent every pair ends its 'chapter',
  // so there only the chapters' end bosses (the demon lord, the serpent) pay so, the others as the campaign's chapter bosses (TASKS 350)
  const chapterEnd = (R, e) => STAGE(R).last && (!RUN(R).endless || D.RUNS.endless.big.includes(e.type));
  const arenaSealed = (R) => !!(R.map.bossType && R.en.some((e) => D.BOSSES[e.type] && e.deadT < 0));
  function stepArena(S, R) {
    const m = R.map, b = R.en.find((e) => D.BOSSES[e.type] && e.deadT < 0), h = R.hero;
    if (b && m.bossType && !R.arena) { const r = m.rooms[b.room], pad = K.R + 4;
      if (h.x > r.x * TILE + pad && h.x < (r.x + r.w) * TILE - pad && h.y > r.y * TILE + pad && h.y < (r.y + r.h) * TILE - pad) {
        R.arena = { active: 1, room: b.room, t0: S.t }; b.st = b.type === 'boss_serpent' ? 'deep' : ENEMIES[b.type].lake ? 'emerge' : 'chase'; b.cdT = S.t + 1; b.seenT = S.t; b.t0 = S.t;
        for (const d of m.doors) if (d.arena) { d.open = 0; d.openT = -9; for (const [x, y] of d.cells) m.cells[y * m.W + x] = 5; }
        m.arenaBox = [r.x, r.y, r.x + r.w, r.y + r.h];
        R.msg = { chapter: ENEMIES[b.type].name, s: ENEMIES[b.type].title, t: S.t, d: 3 }; roar(S, R, b);
      }
    }
    for (const q of R.lavaPending || []) if (S.t >= q.t && m.cells[q.cell] === 1) { m.cells[q.cell] = 3; m.arenaLava = m.arenaLava || []; m.arenaLava.push(q.cell); m.lava++; m.geometry = (m.geometry || 0) + 1; }
    R.lavaPending = (R.lavaPending || []).filter((q) => S.t < q.t);
    if ((R.rocks && R.rocks.length) || (R.cracks && R.cracks.length)) colossusHazards(S, R);
    for (const egg of R.eggs || []) if (egg.hp > 0 && S.t >= egg.hatchT) { egg.hp = 0;
      const owner = R.en.find((e) => e.id === egg.owner && e.deadT < 0); if (owner) bossSummon(S, R, Object.assign({}, owner, { x: egg.x, y: egg.y }), Object.assign({}, D.BOSSES[owner.type].moves.eggs, { n: 1, r: 0 }));
    }
  }
  function finishArena(S, R, e) {
    if (R.arena) R.arena.active = 0;
    for (const c of R.chests) if (c.sealed) { c.sealed = 0; c.loot = SIMX.bossLoot(R, e); c.pay = chapterEnd(R, e) ? 0 : LOOT.mini.gold; SIMX.fstat(R).lootN += c.loot.length; ev(S, { k: 'unseal', x: c.x, y: c.y }); }
    R.map.flood = null; R.map.arenaBox = null;
    if (R.map.arenaWater?.length) { const wet = new Set(R.map.arenaWater); R.map.water = R.map.water.filter((k) => !wet.has(k)); R.map.arenaWater = []; WET.delete(R.map); }
    for (const k of R.map.arenaLava || []) if (R.map.cells[k] === 3) { R.map.cells[k] = 1; R.map.lava--; }
    R.map.arenaLava = []; R.lavaPending = []; R.rocks = []; R.cracks = []; R.fires = (R.fires || []).filter((p) => p.src !== e.id); R.map.geometry = (R.map.geometry || 0) + 1;
    for (const d of R.map.doors || []) if (d.arena && !d.open) openDoor(S, R, d, 0);
    for (const o of R.en) if (o.summ === e.id && o.deadT < 0) { o.deadT = S.t; o.hp = 0; }
    for (const o of R.eggs || []) if (o.owner === e.id) o.hp = 0;
    // the campaign's last boss leaves one too (TASKS 514): a run through the town ends in the town
    if (R.viaTown && R.arena) R.arena.gate = bossGate(R, e);
    if (lastFloor(R) && R.arena && R.arena.gate) R.msg = { s: ENEMIES[e.type].name + TXT('sim_bosses.finishArena.msg.s'), t: S.t };
    if (!lastFloor(R)) { R.msg = { s: ENEMIES[e.type].name + (R.arena && R.arena.gate ? TXT('sim_bosses.finishArena.msg.s') : TXT('sim_bosses.finishArena.msg.s.2')), t: S.t }; if (!chapterEnd(R, e) && !R.chests.some((c) => c.boss)) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), 2) }); }
  }
  // the portal home a chapter boss leaves (TASKS 383): in its hall, kept clear of the stairs and the altar so E never picks the wrong one
  function bossGate(R, e) { const r = R.map.rooms[e.room], cx = (r.x + r.w / 2) * TILE, cy = (r.y + r.h / 2) * TILE, far = [R.map.exit, ...(R.map.down ? [R.map.down] : []), ...R.shrines];
    let best = null, bd = -1;
    for (let i = 0; i < 9; i++) { const [x, y] = standNear(R, cx + ((i % 3) - 1) * r.w * TILE / 4, cy + (Math.floor(i / 3) - 1) * r.h * TILE / 4), d = Math.min(...far.map((o) => Math.hypot(o.x - x, o.y - y)));
      if (d > bd) { bd = d; best = { x: Math.round(x), y: Math.round(y) }; } if (i === 4 && d >= 160) break; }
    // its ring's gap faces the hall's middle, where the hero comes from (at the middle itself, east as the town's)
    if (best) best.open = Math.hypot(cx - best.x, cy - best.y) > 20 ? Math.atan2(cy - best.y, cx - best.x) : 0;
    return best; }
  // a run through the town saved with its last boss slain before the colossus left a portal home (PR 29 review, TASKS 514): the
  // portal is set on load and when its floor is entered again; its old way out is gone (exitKind)
  function regate(R) { if (!R || !R.viaTown || R.town || !R.map || !R.bossDead || (R.arena && R.arena.gate)) return;
    // (its body may be cleared away: then its hall from the map)
    const k = R.map.rooms.findIndex((q) => q.type === 'boss'), b = (R.en || []).find((e) => D.BOSSES[e.type]) || (k >= 0 ? { room: k } : null); if (!b) return; R.arena = Object.assign(R.arena || { active: 0, room: b.room, t0: 0 }, { active: 0 }); R.arena.gate = bossGate(R, b); }
  const gateNear = (R) => { const g = R.arena && R.arena.gate, h = R.hero; return g && !R.town && Math.hypot(g.x - h.x, g.y - h.y) < 64 ? g : null; };
  function bossWebs(S, R, e, M) {
    const m = R.map, r = m.rooms[e.room];
    for (let i = 0; i < M.n; i++) { const a = e.aimA + i / M.n * Math.PI * 2, x = Math.max((r.x + 1) * TILE, Math.min((r.x + r.w - 1) * TILE, e.x + Math.cos(a) * M.r)),
      y = Math.max((r.y + 1) * TILE, Math.min((r.y + r.h - 1) * TILE, e.y + Math.sin(a) * M.r));
      if (cell(m, Math.floor(x / TILE), Math.floor(y / TILE)) !== 1) continue;
      const web = { x, y, v: i % 2, s: M.size, f: 0, torn: 0, boss: e.id };
      const old = m.webs.findIndex((w) => w.boss === e.id && (w.torn || Math.hypot(w.x - x, w.y - y) < M.spacing));
      if (old >= 0) m.webs[old] = web; else if (m.webs.filter((w) => w.boss === e.id).length < M.cap) m.webs.push(web);
    }
    ev(S, { k: 'summon', x: e.x, y: e.y });
  }
  function arenaPath(m, room, shut = new Set()) {
    const r = m.rooms[room], start = m.exit.ty * m.W + m.exit.tx, block = new Set(m.block), seen = new Set(), q = [start];
    const open = (k) => { const x = k % m.W, y = Math.floor(k / m.W); return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && m.cells[k] === 1 && !block.has(k) && !shut.has(k); };
    if (!open(start)) return false; seen.add(start);
    for (let i = 0; i < q.length; i++) for (const d of [1, -1, m.W, -m.W]) { const k = q[i] + d; if (open(k) && !seen.has(k)) { seen.add(k); q.push(k); } }
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * m.W + x; if (open(k) && !seen.has(k)) return false; }
    return true;
  }
  // the arena's lava runs in from a few points on its walls as tongues (TASKS 233): each new cell grows off lava already there or
  // warned, picked at random from that front, so the floor narrows to islands, never to a ring laid row by row along the walls
  function bossLava(S, R, e, M) {
    const m = R.map, r = m.rooms[e.room], block = new Set(m.block), keep = new Set();
    for (const o of [m.exit, ...R.shrines, ...SIMX.solids(R), ...R.en.filter((o) => o.room === e.room && o.deadT < 0)]) {
      const tx = Math.floor(o.x / TILE), ty = Math.floor(o.y / TILE);
      for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) keep.add(y * m.W + x);
    }
    for (const d of m.doors || []) if (d.arena) for (const [x, y] of d.cells) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) keep.add((y + j) * m.W + x + i);
    const pending = new Set((R.lavaPending || []).map((o) => o.cell)), grown = new Set([...(m.arenaLava || []), ...pending]);
    const ok = (k) => { const x = k % m.W, y = Math.floor(k / m.W);
      return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && m.cells[k] === 1 && !keep.has(k) && !pending.has(k) && !block.has(k); };
    const seed = () => { const wall = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (Math.min(x - r.x, r.x + r.w - 1 - x, y - r.y, r.y + r.h - 1 - y) === 0 && ok(y * m.W + x)) wall.push(y * m.W + x);
      return wall.length ? wall[Math.floor(rnd(R) * wall.length)] : -1; };
    let left = Math.min(M.n, Math.floor(r.w * r.h * M.cover) - (m.arenaLava || []).length - pending.size);
    R.lavaPending = R.lavaPending || [];
    // a cell that would cut the floor off from the exit is kept dry for good
    const add = (k) => { pending.add(k); if (!arenaPath(m, e.room, pending)) { pending.delete(k); keep.add(k); return; }
      R.lavaPending.push({ cell: k, t0: S.t, t: S.t + M.warn, owner: e.id }); grown.add(k); left--; };
    for (let i = grown.size ? (rnd(R) < 0.5 ? 1 : 0) : 3; i > 0 && left > 0; i--) { const k = seed(); if (k >= 0) add(k); }
    for (let guard = 0; left > 0 && guard < 400; guard++) {
      const front = []; for (const k of grown) for (const d of [1, -1, m.W, -m.W]) if (ok(k + d)) front.push(k + d);
      const k = front.length ? front[Math.floor(rnd(R) * front.length)] : seed(); if (k < 0) break; add(k);
    }
    roar(S, R, e);
  }
  function bossBarrier(S, e, M) { e.shield = Math.round(e.max * M.hp); e.shieldUntil = S.t + M.time; e.shieldT = S.t; ev(S, { k: 'barrier', x: e.x, y: e.y, id: e.id }); }
  function bossRaise(S, R, e, M) {
    const corpses = R.en.filter((o) => o.deadT >= 0 && o.room === e.room && !D.BOSSES[o.type] && !o.raised);
    const n = Math.max(0, M.cap - R.en.filter((o) => o.summ === e.id && o.deadT < 0).length);
    for (const o of corpses.slice(0, Math.min(M.n, n))) {
      o.raised = 1; bossSummon(S, R, Object.assign({}, e, { x: o.x, y: o.y }), Object.assign({}, M, { n: 1, r: 0 }));
    }
  }
  function bossEggs(S, R, e, M) {
    R.eggs = (R.eggs || []).filter((o) => o.hp > 0);
    const own = R.eggs.filter((o) => o.owner === e.id).length + R.en.filter((o) => o.summ === e.id && o.deadT < 0).length;
    for (let i = 0; i < Math.min(M.n, M.cap - own); i++) { const a = e.aimA + (i + 1) * Math.PI, p = { x: e.x + Math.cos(a) * M.r, y: e.y + Math.sin(a) * M.r };
      if (!bossPoint(R, e, p, 15)) continue;
      R.eggs.push({ id: R.nextId++, owner: e.id, x: p.x, y: p.y, hp: M.eggHp, hatchT: S.t + M.hatch, t0: S.t });
      ev(S, { k: 'summon', x: p.x, y: p.y });
    }
  }
  function beginBossMove(S, R, e, mv) {
    // spd0 + its direction: the walk the plant cuts off — the render eases the gait down from it instead of snapping the feet (TASKS 333)
    e.st = 'bwind'; e.t0 = S.t; e.mv = mv; e.fired = 0; e.hitDone = 0; e.chain = 0;
    e.spd0 = Math.hypot(e.vx, e.vy); e.vxn0 = e.spd0 > 1 ? e.vx / e.spd0 : 1; e.vyn0 = e.spd0 > 1 ? e.vy / e.spd0 : 0;
    const M = D.bossMove(e);
    e.tx = R.hero.x; e.ty = R.hero.y;
    e.aimA = Math.atan2(R.hero.y - (M.target || 0) - e.y + (M.origin || 0), R.hero.x - e.x); e.vx = e.vy = 0;
    e.travel = 0; e.targetD = Math.hypot(R.hero.x - e.x, R.hero.y - e.y);
    ev(S, { k: 'bossmove', id: e.id, mv, phase: e.phase });
  }
  function bossThink(S, R, e, d) {
    const t = S.t, m = R.map, h = R.hero, E = ENEMIES[e.type], P = D.bossPhase(e);
    if (t < e.cdT && e.openUntil > t) { e.vx = e.vy = 0; return; }
    if (t < e.cdT) { const F = wideFlow(R, e, E) || flow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)); steer(e, E, m, F, d > E.reach ? 1 : 0, h.x - e.x, h.y - e.y, d);
      move(m, e, e.vx * DT * P.speed, e.vy * DT * P.speed, E.r, true); e.dist += Math.hypot(e.vx, e.vy) * DT * P.speed; return; }
    const nextPhase = E.lake && D.BOSSES[e.type].phases[(e.phase || 0) + 1];
    if (nextPhase && e.hp / e.max <= nextPhase.at && !e.nextMove && t >= (e.openUntil || 0) + 0.4) return;
    const St = D.BOSSES[e.type].moves.stomp;
    if (St && !e.nextMove && (e.nearT || 0) >= St.hold && t >= (e.stompT ?? -1e9) + St.cd) { e.stompT = t; e.nearT = 0; beginBossMove(S, R, e, 'stomp'); return; }
    const mv = e.nextMove || P.moves[(e.moveI || 0) % P.moves.length];
    if (e.nextMove) e.nextMove = null; else e.moveI = (e.moveI || 0) + 1;
    beginBossMove(S, R, e, mv);
  }
  const roar = (S, R, e) => { ev(S, { k: 'roar', x: e.x, y: e.y - 70, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.6); };
  function bossPoint(R, e, p, radius) {
    const r = R.map.rooms[e.room];
    p.x = Math.max(r.x * TILE + radius + 1, Math.min((r.x + r.w) * TILE - radius - 1, p.x));
    p.y = Math.max(r.y * TILE + radius + 1, Math.min((r.y + r.h) * TILE - radius - 1, p.y));
    shove(R.map, p, radius, true, SIMX.solids(R));
    return DG.roomAt(R.map, p.x, p.y) === e.room && !boxHit(R.map, p.x, p.y, radius, true, false);
  }
  function bossSummon(S, R, e, M) {
    const E = ENEMIES[M.type], own = R.en.filter((o) => o.summ === e.id && o.deadT < 0).length;
    for (let i = 0; i < Math.min(M.n, M.cap - own); i++) {
      const a = e.aimA + (i + 1) * Math.PI * 2 / (M.n + 1), p = { x: e.x + Math.cos(a) * M.r, y: e.y + Math.sin(a) * M.r };
      if (!bossPoint(R, e, p, E.r)) continue;
      const hp = E.hp * M.hp * BAL.hp * dif(R, 'hp');
      R.en.push({ id: R.nextId++, type: M.type, x: p.x, y: p.y, vx: 0, vy: 0, hp, max: hp, dmg: E.dmg * M.dmg * BAL.dmg, elite: 0, room: e.room, st: 'chase', t0: S.t, face: 1,
        aimA: 0, cdT: S.t + M.delay, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: e.id, spawnT: S.t });
      ev(S, { k: 'summon', x: p.x, y: p.y, fire: ENEMIES[M.type].lava ? 1 : 0 });
    }
  }
  // the colossus (TASKS 413) is too broad for the plain flow fields: they lead it on into gaps it doesn't fit (between a slab of cover
  // and the edge, onto the crossing) and it stuck there. Its own field runs over the cells its body clears
  const WIDE = new WeakMap();
  function wideClear(R, e, E) {
    const m = R.map, key = (m.geometry || 0) + ':' + doorKey(m) + ':' + E.r + ':' + e.room; let c = WIDE.get(m); if (c && c.key === key) return c;
    const a = new Uint8Array(m.W * m.H), blk = new Set(m.block), r = m.rooms[e.room], n = Math.ceil(E.r / TILE), open = (q) => m.cells[q] === 1 && !blk.has(q);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * m.W + x; if (!open(k)) continue;
      const px = (x + 0.5) * TILE, py = (y + 0.5) * TILE; let ok = true;
      for (let j = -n; j <= n && ok; j++) for (let i = -n; i <= n && ok; i++) { if (open((y + j) * m.W + x + i)) continue;
        const qx = Math.max((x + i) * TILE, Math.min((x + i + 1) * TILE, px)), qy = Math.max((y + j) * TILE, Math.min((y + j + 1) * TILE, py));
        if (Math.abs(qx - px) < E.r && qy - py > -E.r * 0.6 && qy - py < E.r * 0.4) ok = false; }
      if (ok) a[k] = 1; }
    c = { key, a, hk: '', d: null }; WIDE.set(m, c); return c;
  }
  // null when the colossus stands off its clear cells (a charge carried it there): the plain field takes it back out
  function wideFlow(R, e, E) {
    if (!E.lake) return null; const m = R.map, h = R.hero, c = wideClear(R, e, E), a = c.a, here = Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE);
    if (!a[here]) return null;
    const htx = Math.floor(h.x / TILE), hty = Math.floor(h.y / TILE), hk = htx + ',' + hty; if (c.hk === hk) return c.d;
    const r = m.rooms[e.room], d = new Int16Array(m.W * m.H).fill(-1), q = []; let best = 1e9;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (a[y * m.W + x]) best = Math.min(best, Math.abs(x - htx) + Math.abs(y - hty));
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (a[y * m.W + x] && Math.abs(x - htx) + Math.abs(y - hty) === best) { d[y * m.W + x] = 0; q.push(y * m.W + x); }
    for (let i = 0; i < q.length; i++) for (const o of [1, -1, m.W, -m.W]) { const k = q[i] + o; if (a[k] && d[k] < 0) { d[k] = d[q[i]] + 1; q.push(k); } }
    c.hk = hk; c.d = d; return d;
  }
  // up out of the lake, then ashore through the lava to the clear cell that is near it and on the hero's side
  function colossusRise(S, R, e) {
    const t = S.t, B = D.BOSSES[e.type];
    if (e.st === 'idle' || e.st === 'emerge') e.vx = e.vy = 0;
    if (e.st === 'idle') return;
    if (e.st === 'emerge') { if (t - e.t0 < B.rise) return; const m = R.map, h = R.hero, a = wideClear(R, e, ENEMIES[e.type]).a; let best = null;
      for (let k = 0; k < a.length; k++) if (a[k]) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE, sc = Math.hypot(x - e.x, y - e.y) + 0.4 * Math.hypot(x - h.x, y - h.y); if (!best || sc < best[0]) best = [sc, x, y]; }
      e.st = 'wade'; e.t0 = t; e.tx = best ? best[1] : e.x; e.ty = best ? best[2] : e.y; ev(S, { k: 'colrise', x: e.x, y: e.y, id: e.id }); }
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy), speed = B.wade * Math.min(1, (t - e.t0) / 0.2), v = speed * DT;
    if (d <= v) { e.x = e.tx; e.y = e.ty; e.dist += d; e.st = 'chase'; e.t0 = e.seenT = t; e.cdT = t + 0.6; ev(S, { k: 'slam', x: e.x, y: e.y, big: 1, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.5); return; }
    e.x += dx / d * v; e.y += dy / d * v; e.vx = dx / d * speed; e.vy = dy / d * speed; e.dist += v; if (Math.abs(dx) > 4) e.face = dx > 0 ? 1 : -1;
    colossusStep(S, R, e);
  }
  function colossusStep(S, R, e) {
    const stride = D.BOSSES[e.type].step, i = Math.floor(e.dist / stride);
    if (e.stepI !== undefined && i > e.stepI) {
      ev(S, { k: 'colstep', ...D.colossusStepAt(e, i), id: e.id });
      R.trauma = Math.min(1, R.trauma + 0.09);
    }
    e.stepI = i;
  }
  // a crack runs over the floor and the lava alike and stops at rock
  function colossusCrack(S, R, e, M) {
    const p = D.colossusContact(e), m = R.map, c = Math.cos(e.aimA), sn = Math.sin(e.aimA); let len = M.len;
    for (let l = E0; l <= M.len; l += 8) if (cell(m, Math.floor((p.x + c * l) / TILE), Math.floor((p.y + sn * l) / TILE)) !== 1 && cell(m, Math.floor((p.x + c * l) / TILE), Math.floor((p.y + sn * l) / TILE)) !== 3) { len = l; break; }
    (R.cracks = R.cracks || []).push({ id: R.nextId++, owner: e.id, who: who(e), x: p.x, y: p.y, a: e.aimA, len, w: M.w, speed: M.speed, linger: M.linger, t0: S.t, dmg: e.dmg * M.dmg, hit: 0 });
    ev(S, { k: 'colcrack', x: p.x, y: p.y, a: e.aimA, len, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.4);
  }
  const E0 = 30;
  // where a pool of lava may lie: on the arena's floor, off the lake's shore, off the ways in, the crossing and the other pools, so
  // pools never close the ring (the player's note on 413, 05.11.2026)
  function poolOk(R, e, M, x, y) {
    const m = R.map, r = m.rooms[e.room], P = M.pool, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < r.x || ty < r.y || tx >= r.x + r.w || ty >= r.y + r.h || m.cells[ty * m.W + tx] !== 1) return false;
    const n = Math.ceil((P.r + M.lakeGap) / TILE) + 1;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const k = (ty + j) * m.W + tx + i; if (m.cells[k] !== 3 || (m.arenaLava || []).includes(k)) continue;
      const qx = Math.max((tx + i) * TILE, Math.min((tx + i + 1) * TILE, x)), qy = Math.max((ty + j) * TILE, Math.min((ty + j + 1) * TILE, y)); if (Math.hypot(qx - x, (qy - y) / P.ry) < P.r + M.lakeGap) return false; }
    const way = M.wayGap * TILE, ends = [];
    for (const c of m.crossings || []) if (c.kind === 'slabs') for (const k of c.cells) ends.push([(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]);
    for (const d of m.doors || []) if (d.arena) for (const [cx, cy] of d.cells) ends.push([(cx + 0.5) * TILE, (cy + 0.5) * TILE]);
    if (ends.some(([px, py]) => Math.hypot(px - x, py - y) < way)) return false;
    return !(R.fires || []).some((p) => p.src === e.id && p.kind === 'pool' && Math.hypot(p.x - x, (p.y - y) / P.ry) < 2 * P.r + M.apart);
  }
  function colossusBoulder(S, R, e, M) {
    const h = R.hero; let x = h.x, y = h.y, pool = poolOk(R, e, M, x, y);
    // a point the pool may not take shifts to the nearest one within two cells that it may; no such one: the rock lands dry
    if (!pool) for (let rr = 8; rr <= 2 * TILE && !pool; rr += 8) for (let i = 0; i < 12 && !pool; i++) { const a = i / 12 * Math.PI * 2, px = h.x + Math.cos(a) * rr, py = h.y + Math.sin(a) * rr * 0.75;
      if (poolOk(R, e, M, px, py)) { x = px; y = py; pool = true; } }
    (R.rocks = R.rocks || []).push({ id: R.nextId++, owner: e.id, who: who(e), kind: 'boulder', x, y, sx: e.x + e.face * 0.3 * ENEMIES[e.type].h, gy: e.y, z: ENEMIES[e.type].h * 0.9, t0: S.t, t: S.t + M.fly, r: M.r, dmg: e.dmg * M.dmg, pool: pool ? 1 : 0 });
    ev(S, { k: 'throw', x: e.x, y: e.y, tx: x, ty: y, id: e.id });
  }
  // the ring's outer edge falls into lava (2nd phase), but never the cells the fight keeps: the ways in, the altar and the exit,
  // the slabs of cover; a cell whose fall would cut the floor off from the exit stays
  function colossusEdge(S, R, e, M) {
    const m = R.map, r = m.rooms[e.room], L = D.ARCH.plateau.arena, cx = (r.cx + 0.5) * TILE, cy = (r.cy + 0.5) * TILE, keep = new Set(), W = m.W;
    const near = (x, y, n) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) keep.add((ty + j) * W + tx + i); };
    near(m.exit.x ?? (m.exit.tx + 0.5) * TILE, m.exit.y ?? (m.exit.ty + 0.5) * TILE, 2); for (const sh of R.shrines) near(sh.x, sh.y, 2); for (const d of m.decor) if (d.cover) near(d.x, d.y, 1);
    for (const d of m.doors || []) if (d.arena) for (const [x, y] of d.cells) near((x + 0.5) * TILE, (y + 0.5) * TILE, 2);
    const lake = (k) => Math.hypot((((k % W) + 0.5) * TILE - cx) / L.lake[0], ((Math.floor(k / W) + 0.5) * TILE - cy) / L.lake[1]) < TILE * 1.25;
    const pending = new Set((R.lavaPending || []).map((q) => q.cell)), gone = new Set([...(m.arenaLava || []), ...pending]);
    for (let depth = 0; depth < M.edge; depth++) { const band = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * W + x; if (m.cells[k] !== 1 || keep.has(k) || gone.has(k) || lake(k)) continue;
        if ([1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].some((o) => (m.cells[k + o] !== 1 && !lake(k + o)) || gone.has(k + o))) band.push(k); }
      for (const k of band) { pending.add(k); if (!arenaPath(m, e.room, pending)) { pending.delete(k); continue; } gone.add(k);
        const d = Math.hypot((k % W + 0.5) * TILE - e.x, (Math.floor(k / W) + 0.5) * TILE - e.y);
        R.lavaPending.push({ cell: k, t0: S.t, t: S.t + M.warn + d / 900, owner: e.id }); } }
  }
  // the eruption's rain: rocks over the ring at random, a few aimed at the hero; none within the shelter of a slab of cover
  function colossusRain(S, R, e, M) {
    const m = R.map, r = m.rooms[e.room], cover = m.decor.filter((d) => d.cover && !d.broken), floor = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const k = y * m.W + x, px = (x + 0.5) * TILE, py = (y + 0.5) * TILE;
      if (m.cells[k] === 1 && !cover.some((d) => Math.hypot(px - d.x, py - d.y) < M.shelter)) floor.push([px, py]); }
    for (let i = 0; i < M.n; i++) { const t = S.t + M.warn + i / M.n * M.time, aim = i % Math.ceil(M.n / M.aimed) === Math.ceil(M.n / M.aimed) - 1, p = floor[Math.floor(rnd(R) * floor.length)];
      if (!aim && !p) continue; (R.rocks = R.rocks || []).push({ id: R.nextId++, owner: e.id, who: who(e), kind: 'rain', x: aim ? undefined : p[0] + (rnd(R) - 0.5) * 20, y: aim ? undefined : p[1] + (rnd(R) - 0.5) * 20, t0: t - M.warn, t, r: M.r, dmg: e.dmg * M.dmg, shelter: M.shelter }); }
    roar(S, R, e);
  }
  function colossusHazards(S, R) {
    const h = R.hero, t = S.t, m = R.map, alive = h.deadT < 0;
    for (const c of R.cracks) { if (c.hit || !alive) continue; const front = Math.min(c.len, (t - c.t0) * c.speed), rx = h.x - c.x, ry = h.y - c.y, al = rx * Math.cos(c.a) + ry * Math.sin(c.a), pe = Math.abs(-rx * Math.sin(c.a) + ry * Math.cos(c.a));
      if (al > E0 && al < front && pe < c.w / 2 + K.R * 0.5) { c.hit = 1; hurtHero(S, R, c.dmg, h.x - Math.cos(c.a) * 12, h.y - Math.sin(c.a) * 12, undefined, c.who, R.en.find((o) => o.id === c.owner)); } }
    R.cracks = R.cracks.filter((c) => t - c.t0 < c.len / c.speed + c.linger);
    for (const q of R.rocks) {
      // an aimed rock picks its spot as its shadow shows: where the hero is then, unless that is under a slab's shelter
      if (q.x === undefined && t >= q.t0) { const sh = m.decor.some((d) => d.cover && !d.broken && Math.hypot(h.x - d.x, h.y - d.y) < q.shelter); if (sh || !alive) { q.done = 1; continue; } q.x = h.x; q.y = h.y; }
      if (q.done || t < q.t) continue; q.done = 1;
      const owner = R.en.find((o) => o.id === q.owner);
      if (alive && Math.hypot(h.x - q.x, (h.y - q.y) / 0.75) < q.r + K.R * 0.5) hurtHero(S, R, q.dmg, q.x, q.y, undefined, q.who, owner);
      ev(S, { k: q.kind === 'boulder' ? 'boulder' : 'rock', x: q.x, y: q.y, r: q.r, id: q.id }); R.trauma = Math.min(1, R.trauma + (q.kind === 'boulder' ? 0.45 : 0.15));
      if (q.pool && owner) { const P = D.BOSSES[owner.type].moves.boulder, own = R.fires.filter((p) => p.src === owner.id && p.kind === 'pool');
        if (own.length < P.cap && poolOk(R, owner, P, q.x, q.y)) { addFire(R, S, q.x, q.y, { src: owner.id, who: q.who, r: P.pool.r, ry: P.pool.ry, t: P.pool.t, dmg: owner.dmg * P.pool.dmg, per: P.pool.per, kind: 'pool' });
          ev(S, { k: 'pool', x: q.x, y: q.y, r: P.pool.r, d: P.pool.t, id: owner.id }); } } }
    R.rocks = R.rocks.filter((q) => !q.done);
  }
  function stepBossMove(S, R) {
    if (R.hero.deadT >= 0) return;
    for (const e of R.en) { if (!D.BOSSES[e.type] || e.type === 'boss_serpent' || e.deadT >= 0 || e.st === 'idle') continue;
      const t = S.t, h = R.hero, m = R.map, B = D.BOSSES[e.type];
      if (e.bossVersion !== 1) { e.st = 'chase'; e.cdT = t; e.phase = Math.max(0, B.phases.findLastIndex((p) => e.hp / e.max <= p.at)); e.moveI = 0; e.nextMove = null; e.bossVersion = 1; }
      if ((e.phase || 0) + 1 < B.phases.length && e.hp / e.max <= B.phases[(e.phase || 0) + 1].at && (!D.bossPhase(e).finishMove || (e.st !== 'bwind' && !e.nextMove && t >= (e.openUntil || 0) + (e.type === 'boss_colossus' ? 0.4 : 0)))) {
        e.phase = (e.phase || 0) + 1; e.moveI = 0; e.nextMove = null;
        ev(S, { k: 'bossphase', id: e.id, phase: e.phase });
        if (D.bossPhase(e).enter) beginBossMove(S, R, e, D.bossPhase(e).enter);
      }
      // its fists' stuck window stays the hero's to use: the hold toward the stomp starts over after it (review of PR 61)
      if (B.moves.stomp) { const d = Math.hypot(h.x - e.x, h.y - e.y);
        e.nearT = e.st === 'emerge' || e.st === 'wade' || e.openUntil > t ? 0 : d < B.moves.stomp.near ? (e.nearT || 0) + DT : d > B.moves.stomp.near * 1.3 ? 0 : e.nearT || 0; }
      if (e.st !== 'bwind') continue;
      const M = D.bossMove(e), w = M.wind, u = t - e.t0;
      let finished = u > w + (e.mv === 'charge' && M.next ? M.time : M.duration);
      if (e.mv === 'charge' && u > w && u < w + M.time) {
        const x = e.x, y = e.y, dist = Math.min(M.speed * DT, Math.max(0, e.targetD - M.stop - e.travel));
        move(m, e, Math.cos(e.aimA) * dist, Math.sin(e.aimA) * dist, ENEMIES[e.type].r, true);
        const moved = Math.hypot(e.x - x, e.y - y); e.dist += moved; e.travel += moved;
        if (e.type === 'boss_colossus') { e.vx = (e.x - x) / DT; e.vy = (e.y - y) / DT; }
        if (!e.hitDone && Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(m, e.x, e.y, h.x, h.y)) { e.hitDone = 1; hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e); }
        if (M.next && (e.hitDone || e.travel >= Math.max(0, e.targetD - M.stop) - 0.01 || moved < 0.01)) finished = true;
      }
      if (e.type === 'boss_colossus' && e.mv === 'charge' && (finished || u <= w || u >= w + M.time)) e.vx = e.vy = 0;
      if (e.mv === 'volley' && u >= w + (e.fired || 0) * M.gap && (e.fired || 0) < M.rings) {
        // both rings are one volley: it wounds once, so the second ring catches a hero who sidestepped the first instead of doubling
        // the blow past the boss's cap (TASKS 227)
        const ring = e.fired++, vol = ring ? e.vol : (e.vol = R.nextId);
        for (let i = 0; i < M.n; i++) { const a = e.aimA + (i + ring * M.offset) / M.n * Math.PI * 2;
          R.proj.push({ id: R.nextId++, vol, who: who(e), actorId: e.id, k: M.kind || 'fire', x: e.x, y: e.y - M.origin, vx: Math.cos(a) * M.speed, vy: Math.sin(a) * M.speed,
            t0: t, life: M.life, dmg: e.dmg * M.dmg, own: 'en', r: M.r, spent: R.volHit === vol ? 1 : 0 }); }
        roar(S, R, e);
      } else if (e.mv !== 'volley' && u >= w && !e.fired) { e.fired = 1;
        if (e.mv === 'slam') { if (Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(m, e.x, e.y, h.x, h.y)) hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e);
          ev(S, { k: 'slam', x: e.x, y: e.y, big: 1, id: e.id }); R.trauma = 1; }
        if (e.mv === 'roar') { roar(S, R, e); const d = Math.hypot(h.x - e.x, h.y - e.y) || 1;
          if (d < M.r && losClear(m, e.x, e.y, h.x, h.y)) move(m, h, (h.x - e.x) / d * M.push, (h.y - e.y) / d * M.push, K.R, true);
          if (M.summon) bossSummon(S, R, e, B.moves[M.summon]); }
        for (const fx of M.effects || []) { if (fx === 'weave') bossWebs(S, R, e, B.moves[fx]); if (fx === 'raise') bossRaise(S, R, e, B.moves[fx]); if (fx === 'lava') bossLava(S, R, e, B.moves[fx]); if (fx === 'barrier') bossBarrier(S, e, B.moves[fx]); }
        if (e.mv === 'lava') bossLava(S, R, e, M);
        if (e.mv === 'raise') bossRaise(S, R, e, M);
        if (e.mv === 'barrier') bossBarrier(S, e, M);
        if (e.mv === 'weave') bossWebs(S, R, e, M);
        if (e.mv === 'eggs') bossEggs(S, R, e, M);
        if (e.mv === 'summon') bossSummon(S, R, e, M);
        if (e.mv === 'imps') bossSummon(S, R, e, M);
        if (e.mv === 'fists') { if (Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(m, e.x, e.y, h.x, h.y)) hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e);
          ev(S, { k: 'slam', x: e.x, y: e.y, big: 1, id: e.id, r: M.r }); R.trauma = 1; }
        if (e.mv === 'crack') colossusCrack(S, R, e, M);
        if (e.mv === 'boulder') colossusBoulder(S, R, e, M);
        if (e.mv === 'shatter') { roar(S, R, e); colossusEdge(S, R, e, M); bossSummon(S, R, e, B.moves[M.summon]); ev(S, { k: 'shatter', x: e.x, y: e.y, id: e.id }); }
        if (e.mv === 'erupt') { roar(S, R, e); ev(S, { k: 'colerupt', x: e.x, y: e.y, id: e.id }); }
        if (e.mv === 'rain') colossusRain(S, R, e, M);
        if (e.mv === 'stomp') { const d = Math.hypot(h.x - e.x, h.y - e.y), los = losClear(m, e.x, e.y, h.x, h.y); e.shove = los && d < M.r + K.R ? 1 : 0;
          if (d < M.r && los) hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e);
          ev(S, { k: 'slam', x: e.x, y: e.y, big: 1, id: e.id, r: M.r }); R.trauma = Math.min(1, R.trauma + 0.8); }
      }
      // the stomp slides him out over its first `shove` s rather than jumping him, and never into the lava: a dodge keeps the hurt off, not the push
      if (e.mv === 'stomp' && e.shove && u >= w && u < w + M.shove) { const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1, v = M.push / M.shove * DT;
        move(m, h, dx / d * v, dy / d * v, K.R, true); }
      if (finished) {
        e.nextMove = null;
        // the linked slam follows only a charge the hero got out of: a charge that landed ends the link, one mistake costs one blow
        // (the player's call, TASKS 227: the slam 0.28 s after a landed charge could not be escaped and took 12 of 14 finale deaths)
        if (M.next && !e.hitDone) { beginBossMove(S, R, e, M.next); e.t0 = t + (M.rest || 0); e.chain = 1; }
        else { e.st = 'chase'; e.fired = 0; e.hitDone = 0; e.shove = 0; e.cdT = t + (M.next ? D.bossPhase(e).rest : M.rest ?? D.bossPhase(e).rest);
          if (M.stuck) { e.openUntil = t + M.stuck; e.cdT = e.openUntil + 0.4; ev(S, { k: 'stuck', x: e.x, y: e.y, id: e.id, d: M.stuck }); } }
      }
    }
  }
  // the sprite boxes of the solid props (half width, height, standing on the prop's foot): an item that lies behind one (above its
  // foot, so the prop draws after it) inside its box cannot be seen, so it hops to the nearest open spot instead

  Object.assign(SIMX, {
    holdClocks, chapterEnd, arenaSealed, stepArena, finishArena, bossGate, regate, gateNear, bossWebs, arenaPath, bossLava, bossRaise, bossEggs,
    beginBossMove, bossThink, roar, bossSummon, wideClear, colossusRise, colossusStep, poolOk, colossusBoulder, colossusRain, stepBossMove });
})(typeof window !== 'undefined' ? window : globalThis);
