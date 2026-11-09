// live/sim_town.js — the town: townsfolk, waystones, workshops, quests, talk, the storage chest, altars, the merchant.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const {
    AFFIXES, BASES, D, DG, DT, ENEMIES, K, MOD, RARITY, RUN, STAGE, TILE, arenaSealed, bagAdd, bossFight, counted, dep, doorNear, drop,
    eliteK, enterFloor, ev, gainXp, gateNear, giveShards, has, heroSt, hidden, isCons, itemName, itemPower, lastFloor, exitKind, campaignDone, leverNear,
    openChest, openDoor, openSecret, pick, potion, pullLever, rnd, rollAffixes, rollItem, rollMods, sealOf, secretUnder, standNear } = SIMX;
  // ---------------- the townsfolk (R-17, TASKS 1015) ----------------
  // each townsperson's state: where it stands, its round (the walkers), the crate the porter carries, what it says. Walkers ease
  // in and out of their pace, step round each other and the hero (or wait), and stop to talk; a stop that stays blocked is skipped
  const FOLK_R = { child: 9, hen: 6 }, folkR = (f) => FOLK_R[f.role] || 12;
  const folkOf = (R) => R.folk || (R.folk = folkHere(R, D.folkInit(R.map.town.npcs)));
  const townOk = (m) => m.town.walkOk || Object.defineProperty(m.town, 'walkOk', { value: DG.townWalk(m), enumerable: false }).walkOk;
  const folkFree = (m, x, y, r) => { const ok = townOk(m); return [[0, 0], [-r, 0], [r, 0], [0, -0.6 * r], [0, 0.5 * r]].every(([dx, dy]) => ok[Math.floor((y + dy) / TILE) * m.W + Math.floor((x + dx) / TILE)]); };
  // a talk lasts FOLK_SAY s from its start, or ends when the hero walks off
  const folkTalk = (f, t) => f.near && t - f.sayT < D.FOLK_SAY;
  const folkPause = (f, stop) => (f.role === 'porter' || f.role === 'mason' ? (stop && stop.act ? 1.8 : 0) : D.FOLK[f.role].pause || 0);
  // a hen (TASKS 1032): scatters from the hero who comes close (and from a walker's feet), runs to the child's grain and pecks there, else wanders about its
  // place a few steps at a time. f.goal { x, y, v, k: the grain it came for }; f.next: when it may pick its next spot
  const henRnd = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
  function henGoal(R, f, n, t) {
    const h = R.hero, dh = Math.hypot(h.x - f.x, (h.y - f.y) * 1.25), w = R.folk.find((q) => q.go && q.spd > 4 && Math.hypot(q.x - f.x, (q.y - f.y) * 1.25) < 34), sc = h.deadT < 0 && dh < 58 ? h : w;
    if (sc) { const a = Math.atan2(f.y - sc.y, f.x - sc.x) + 0.6 * (henRnd(f.i, Math.floor(t)) - 0.5); f.next = t + 1 + henRnd(f.i, t); if (t - (f.scareL ?? -9) > 0.6) f.scareT = t; f.scareL = t;
      return (f.goal = { x: f.x + Math.cos(a) * 44, y: f.y + Math.sin(a) * 30, v: 80 }); }
    const gr = R.grain; if (gr && t - gr.t < 7 && Math.hypot(gr.x - f.x, gr.y - f.y) < 190 && (!f.goal || f.goal.k !== gr.t))
      f.goal = { x: gr.x + 16 * Math.cos(f.i * 2.1), y: gr.y + 9 * Math.sin(f.i * 2.1), v: 42, k: gr.t };
    if (f.goal && f.goal.k && t - f.goal.k > 7) f.goal = null;
    if (!f.goal && t >= (f.next || 0)) { const a = 2 * Math.PI * henRnd(f.i, t), r = 10 + 26 * henRnd(t, f.i);
      f.goal = { x: n.x + Math.cos(a) * r, y: n.y + Math.sin(a) * r * 0.6, v: 22 }; f.next = t + 2 + 3 * henRnd(f.i + 7, t); }
    return f.goal; }
  // the mine's cart comes down the rails on the winch's rope to the mason and is hauled back once he has emptied it
  const CART_V = 52, CART_LOAD = 3, railLen = (m) => { const T = m.town; if (T.railLen) return T.railLen; let d = 0; T.rails.forEach((k, i) => { if (i) { const p = T.rails[i - 1]; d += Math.hypot(k % m.W - p % m.W, Math.floor(k / m.W) - Math.floor(p / m.W)) * TILE; } });
    Object.defineProperty(T, 'railLen', { value: d, enumerable: false }); return d; };
  const railAt = (m, s) => { const T = m.town, c = (k) => [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]; let d = s; for (let i = 1; i < T.rails.length; i++) { const [ax, ay] = c(T.rails[i - 1]), [bx, by] = c(T.rails[i]), l = Math.hypot(bx - ax, by - ay); if (d <= l) return [ax + (bx - ax) * d / l, ay + (by - ay) * d / l]; d -= l; } return c(T.rails[T.rails.length - 1]); };
  const cartOf = (R) => R.cart || (R.cart = { s: railLen(R.map), st: 'at', load: CART_LOAD, t: 0 });
  function stepCart(S, R, C, t) { const L = railLen(R.map), [cx, cy] = railAt(R.map, C.s), h = R.hero, sgn = C.st === 'down' ? 1 : -1, [nx, ny] = railAt(R.map, Math.max(0, Math.min(L, C.s + sgn * 4))), dl = Math.hypot(nx - cx, ny - cy) || 1, dx = (nx - cx) / dl, dy = (ny - cy) / dl, ahead = (h.x - cx) * dx + (h.y - cy) * dy, off = (h.y - cy) * dx - (h.x - cx) * dy, near = (C.st === 'down' || C.st === 'up') && h.deadT < 0 && ahead >= 0 && ahead <= 48 && Math.abs(off) < 18, rolling = t < (C.pushT || 0), block = near && !rolling;
    // it waits for a hero on the rails, but no longer than a moment: he must not be able to hold up the yard, and once it has made up its mind it rolls on
    if (near && rolling) { const side = off >= 0 ? 1 : -1; SIMX.move(R.map, h, -dy * side * 120 * DT, dx * side * 120 * DT, K.R); }
    if (block && !C.held) ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.cart') });
    C.held = block ? (C.held || 0) + DT : 0; if (C.held >= 3) { C.held = 0; C.pushT = t + 5; }
    const v = block ? 0 : CART_V * Math.min(1, 0.2 + Math.min(C.s, L - C.s) / 44);
    if (C.st === 'down') { C.s = Math.min(L, C.s + v * DT); if (C.s >= L) { C.st = 'at'; C.atT = t; } }
    else if (C.st === 'at') { if (C.load <= 0 && t >= C.t) C.st = 'up'; }
    else if (C.st === 'up') { C.s = Math.max(0, C.s - v * DT); if (C.s <= 0) { C.st = 'in'; C.t = t + 6; C.load = CART_LOAD; } }
    else if (t >= C.t) C.st = 'down'; }
  function stepFolk(S, R) {
    const m = R.map, h = R.hero, t = S.t, F = folkOf(R), alive = h.deadT < 0, C = cartOf(R);
    stepCart(S, R, C, t);
    for (const f of F) { const n = m.town.npcs[f.i], FD = D.FOLK[f.role], r = folkR(f);
      if (FD.lines) { const d = Math.hypot(h.x - f.x, (h.y - f.y) * 1.25);
        if (!f.near && alive && d < 72) { f.near = 1; f.sayT = t; f.sayN = (f.sayN + 1) % FD.lines.length; ev(S, { k: 'say', x: f.x, y: f.y, role: f.role }); }
        else if (f.near && (d > 130 || !alive)) { f.near = 0; f.byeT = t; } }
      // the loop's impact: the anvil rings on the smith's blow (not on his breather, not while he talks)
      if (f.role === 'smith' && !folkTalk(f, t)) { const a = D.folkClock('smith', f.i, t - DT), b = D.folkClock('smith', f.i, t);
        if ((a.n === b.n ? a.u < FD.hit && b.u >= FD.hit : b.u >= FD.hit) && b.n % FD.rest !== FD.rest - 1) ev(S, { k: 'anvil', x: f.x, y: f.y }); }
      const route = n.route;
      if (folkTalk(f, t)) { const nf = h.x >= f.x ? 1 : -1; if (route && f.face && nf !== f.face) f.turnT = t; f.face = nf; }
      // the child's handful of grain lands ahead of him, toward the nearest hen: the hens come for it (TASKS 1032)
      if (f.role === 'child' && route && !f.go && f.way >= 0 && !folkTalk(f, t)) { const a = D.folkClock('child', f.i, t - DT), b = D.folkClock('child', f.i, t);
        if (a.n === b.n && a.u < 0.47 && b.u >= 0.47) { const hn = F.filter((q) => q.role === 'hen').sort((p, q) => Math.hypot(p.x - f.x, p.y - f.y) - Math.hypot(q.x - f.x, q.y - f.y))[0], dir = hn && hn.x < f.x ? -1 : 1;
          R.grain = { x: f.x + dir * 55, y: f.y + 4, t }; } }
      // the block he dresses uses up the bin one stone at a time: nothing else ever empties it (town_motion_r6 2)
      if (f.role === 'mason' && route && !f.go && !f.load && f.lift !== 'take' && C.bin > 0 && t - f.t0 >= 1.7 && !folkTalk(f, t)) { const a = D.folkClock('mason', f.i, t - DT), b = D.folkClock('mason', f.i, t); if (a.n !== b.n && b.n % 5 === 0) { C.bin--; C.binT = t; } }
      let want = 0, ux = 0, uy = 0;
      if (f.role === 'hen') { const g = henGoal(R, f, n, t);
        if (g) { const dx = g.x - f.x, dy = g.y - f.y, d = Math.hypot(dx, dy); if (d > 2.5) { want = Math.min(g.v, d * 4 + 6); ux = dx / d; uy = dy / d; } else if (!g.k) f.goal = null; } }
      else if (!route) { f.spd = 0; continue; }
      if (route && !folkTalk(f, t) && !f.go && t >= f.t0 + folkPause(f, route[f.way]) && !(f.role === 'mason' && route[(f.way + 1) % route.length].act === 'take' && !(C.st === 'at' && C.load > 0 && t >= (C.atT ?? -9) + 0.6))) { f.go = 1; f.way = (f.way + 1) % route.length; f.stuck = 0; f.lift = 0; }
      if (route && f.go && !folkTalk(f, t)) { const tg = route[f.way], dx = tg.x - f.x, dy = tg.y - f.y, d = Math.hypot(dx, dy);
        if (d < 1.5) { f.go = 0; f.t0 = t; f.x = tg.x; f.y = tg.y; f.spd = 0;
          // f.lift: what he did at this stop, for the render's bend; a pick-up with the crate in hand (a stop skipped) is no lift
          f.lift = tg.act === 'take' && !f.load || tg.act === 'drop' && f.load ? tg.act : 0; if (f.lift) { f.load = f.lift === 'take' ? 1 : 0; ev(S, { k: 'toss', x: f.x, y: f.y }); if (f.role === 'mason' && f.lift === 'take') { C.takeT = t; if (--C.load <= 0) C.t = t + 2.5; } if (f.role === 'mason' && f.lift === 'drop') C.bin = (C.bin || 0) + 1; } }
        else { want = Math.min(FD.v, d * 3 + 3); ux = dx / d; uy = dy / d; } }
      f.spd += (want - f.spd) * Math.min(1, 7 * DT);
      if (f.spd < 0.5 && !want) { f.spd = 0; f.vx = f.vy = 0; continue; }
      if (!want) { ux = f.vx / (Math.hypot(f.vx, f.vy) || 1); uy = f.vy / (Math.hypot(f.vx, f.vy) || 1); }
      // round the others and the hero: try straight on, then wider and wider turns; nothing clear, it waits
      const step = f.spd * DT, near = (x, y) => F.some((o) => o !== f && Math.hypot(o.x - x, (o.y - y) * 1.4) < r + folkR(o) + 3 && Math.hypot(o.x - x, (o.y - y) * 1.4) < Math.hypot(o.x - f.x, (o.y - f.y) * 1.4))
        || (Math.hypot(h.x - x, (h.y - y) * 1.4) < r + K.R + 4 && Math.hypot(h.x - x, (h.y - y) * 1.4) < Math.hypot(h.x - f.x, (h.y - f.y) * 1.4));
      let moved = false;
      for (const a of [0, 0.6, -0.6, 1.2, -1.2]) { const c = Math.cos(a), sn = Math.sin(a), vx = ux * c - uy * sn, vy = ux * sn + uy * c, x = f.x + vx * step, y = f.y + vy * step;
        if (!folkFree(m, x, y, r) || near(x, y)) continue;
        f.x = x; f.y = y; f.vx = vx * f.spd; f.vy = vy * f.spd; f.dist += step; moved = true; break; }
      if (!moved) { f.vx = f.vy = 0; f.spd = 0; if (!route) { f.goal = null; continue; } if ((f.stuck += DT) > 4) { f.way = (f.way + 1) % route.length; f.stuck = 0; } } else f.stuck = 0;
      if (Math.abs(f.vx) > (f.role === 'hen' ? 12 : 3)) { const nf = f.vx > 0 ? 1 : -1; if (f.role !== 'hen' || nf === f.face || t - (f.turnT ?? -9) > 1.1) { if (nf !== f.face && f.walked) f.turnT = t; f.face = nf; f.walked = 1; } } }
    // the merchant calls the hero over from across the yard, every so often
    if (m.shop && R.shop && !shopShut(R)) { const d = Math.hypot(h.x - m.shop.x, h.y - m.shop.y);
      if (alive && h.gold > 0 && d > 240 && d < 560 && t - (R.shop.callT ?? -99) > 30 && !(R.msg && t < R.msg.t + (R.msg.d || 3.5))) { R.shop.callT = t; R.shop.callN = ((R.shop.callN ?? -1) + 1) % D.SHOP.calls.length; ev(S, { k: 'say', x: m.shop.x, y: m.shop.y, role: 'merchant' }); } }
  }
  const solids = (R) => { const out = []; for (const c of R.chests) out.push({ x: c.x, y: c.y, r: 16 }); for (const p of R.pots) if (p.hp > 0) out.push({ x: p.x, y: p.y, r: 11 });
    for (const t2 of R.map.torches) if (t2.kind !== 'wall') out.push({ x: t2.x, y: t2.y, r: t2.kind === 'fire' ? 20 : 12 }); for (const s of R.shrines) out.push({ x: s.x, y: s.y, r: 18 }); for (const d of R.map.decor) if (d.solid || d.role === 'bench') out.push({ x: d.x, y: d.y, r: 18 });
    for (const C of Object.values(R.captives || {})) if (C.x !== undefined && !R.town && D.CAPTIVES[C.who].f === R.floor) for (const dx of [-34, 0, 34]) out.push({ x: C.x + dx, y: C.y - 8, r: 20 });
    if (R.map.town) for (const p of R.map.town.yardSolid || []) out.push({ x: p.x, y: p.y, r: 18 });
    if (R.map.town && R.cart && R.cart.st !== 'in') { const [x, y] = railAt(R.map, R.cart.s); out.push({ x, y, r: 16 }); }
    if (R.map.way) out.push({ x: R.map.way.x, y: R.map.way.y, r: 16 });
    for (const q of R.map.waterFeatures || []) if (q.kind === 'fountain') out.push({ x: q.x, y: q.y - 2, r: 34 });
    if (R.map.shop) for (const [x, y] of R.map.shop.solid) out.push({ x, y, r: 18 });
    for (const f of R.folk || []) out.push({ x: f.x, y: f.y, r: folkR(f) }); return out; };
  // a first visit with empty pockets: the service says what it wants, instead of a page of prices the hero cannot pay (TASKS 1613)
  const broke = (S, R) => { const h = R.hero; if (!h.gold) ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.broke') }); };
  function interact(S, R) {
    const h = R.hero, m = R.map;
    const capN = captiveNear(R); if (capN) { freeCaptive(S, R, capN); return; }
    const nt = noteNear(R); if (nt) { openNote(S, R, nt); return; }
    const sq0 = secretUnder(R), c = R.chests.find((c2) => !c2.open && Math.hypot(c2.x - h.x, c2.y - h.y) < (sq0 ? 30 : 56) && !SIMX.overLava(m, h.x, h.y, c2.x, c2.y)); if (c) { openChest(S, R, c); return; }
    if (atCounter(R)) { if (shopShut(R)) ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.shopShut') }); else openShop(S, R); return; }
    const sh = R.shrines.find((s) => !s.used && Math.hypot(s.x - h.x, s.y - h.y) < 60);
    if (sh && !arenaSealed(R)) { openAltar(S, R, sh); return; }
    const sq = sq0; if (sq) { if (sq.kind === 'statue' && SIMX.heroOnPath(R, sq)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.statueBlocked') }); return; } if (sq.trig) ev(S, { k: 'click', x: h.x, y: h.y }); openSecret(S, R, sq); return; }
    const pz = SIMX.puzzleNear(R); if (pz) { SIMX.usePuzzle(S, R, pz.q, pz.i); return; }
    const lv = leverNear(R); if (lv) { pullLever(S, R, lv); return; }
    const dr = doorNear(R, 64); if (dr) { openDoor(S, R, dr, 0); return; }
    const dUp = m.up ? Math.hypot(m.up.x - h.x, m.up.y - h.y) : 1e9;
    const fresh = S.t - (R.enteredT ?? -9) < 0.3;
    if (dUp < 56 && !fresh && dUp <= Math.hypot(m.exit.x - h.x, m.exit.y - h.y) && (!m.down || dUp <= Math.hypot(m.down.x - h.x, m.down.y - h.y))) { if (bossFight(R)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.interact.s') }); return; }
      ev(S, { k: 'stairs', x: h.x, y: h.y, floor: R.floor, up: 1 }); enterFloor(S, R, R.floor - 1, undefined, 'up'); return; }
    const gt = gateNear(R); if (gt) { R.portal = { f: R.floor, x: gt.x, y: gt.y + 40 }; enterFloor(S, R, 0, undefined, 'portal'); ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); return; }
    // the town's ring of stones: the end of a portal (TASKS 1007) and the gate to the waystones woken this run (1009); with one way
    // out it is taken at once, with more a window to choose
    const cs = craftShut(R); if (cs) { ev(S, { k: 'nope', x: h.x, y: h.y, s: D.CAPTIVES[cs].shut }); return; }
    const cw = atCraft(R);
    if (cw) { S.screen = 'craft'; S.craft = { kind: cw, sel: S.craft && S.craft.kind === cw ? S.craft.sel : null }; S.hover = ''; broke(S, R); ev(S, { k: 'ui', x: h.x, y: h.y }); return; }
    if (atStash(R)) { S.screen = 'stash'; S.hover = ''; S.drag = null; stashOf(S); ev(S, { k: 'ui', x: R.map.town.svc.stash.x, y: R.map.town.svc.stash.y }); return; }
    if (atSoulAltar(R)) { S.screen = 'meta'; S.metaRun = 1; S.hover = ''; if (!S.meta.shards) broke(S, R); ev(S, { k: 'altar', x: R.map.town.svc.altar.x, y: R.map.town.svc.altar.y }); return; }
    if (atExitGate(R)) { S.screen = 'leave'; S.hover = ''; ev(S, { k: 'ui', x: h.x, y: h.y }); return; }
    if (atGate(R)) { const o = gateWays(R); if (o.length === 1) gateGo(S, R, o[0]); else { S.screen = 'gate'; S.hover = ''; ev(S, { k: 'ui', x: h.x, y: h.y }); } return; }
    if (atBoard(R)) { S.screen = 'board'; S.hover = ''; ev(S, { k: 'ui', x: h.x, y: h.y }); return; }
    // a townsman with something to say, once no service of the town is in reach (TASKS 1016, 1023)
    // the prompt shows the way out when one is in reach, so E takes it (TASKS 1600)
    const fk = folkNear(R), way = (m.down && Math.hypot(m.down.x - h.x, m.down.y - h.y) < 60) || (exitKind(R) && Math.hypot(m.exit.x - h.x, m.exit.y - h.y) < 60); if (fk && !way) { openTalk(S, R, fk); return; }
    // the stairs on past the serpent (TASKS 354): shut till it falls; taking them wins the campaign there and then and the run goes on
    if (m.down && Math.hypot(m.down.x - h.x, m.down.y - h.y) < 60) { if (R.campaignWon) { ev(S, { k: 'stairs', x: h.x, y: h.y, floor: R.floor }); enterFloor(S, R, R.floor + 1); } else if (R.bossDead) SIMX.descend(S, R); else ev(S, { k: 'nope', x: h.x, y: h.y, s: sealOf(R) }); return; }
    if (exitKind(R) && Math.hypot(m.exit.x - h.x, m.exit.y - h.y) < 60) {
      if (arenaSealed(R)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.interact.s.2') }); return; }
      if (exitKind(R) === 'portal') { if (R.campaignWon) return; if (R.bossDead) { SIMX.endRun(S, 'win'); } else ev(S, { k: 'nope', x: h.x, y: h.y, s: sealOf(R) }); return; }
      ev(S, { k: 'stairs', x: h.x, y: h.y, floor: R.floor }); if ((RUN(R).chapters || []).some((c) => c.from === R.floor + 1) && !(R.chapSeen || {})[R.floor + 1]) R.leaving = 0.45; else enterFloor(S, R, R.floor + 1); return; }
    const used = R.shrines.find((s) => s.used && Math.hypot(s.x - h.x, s.y - h.y) < 60);
    if (used && canDonate(R)) openAltar(S, R, used);
  }
  // ---------------- waystones (TASKS 1009) ----------------
  // touched once, a waystone stays awake for the rest of the run; the town's ring of stones then jumps to it
  function wake(S, R) { const w = R.map.way; R.ways = (R.ways || []).concat(R.floor).sort((a, b) => a - b);
    ev(S, { k: 'waystone', x: w.x, y: w.y }); R.msg = { s: TXT('sim_town.wake.msg.s', { floor: R.floor }), t: S.t, d: 4 }; S.saveN++; }
  // the Altar of Souls on the town's square (TASKS 1011): the meta upgrades, paid from the same bank as everywhere
  const near = (R, k, r) => !!(R.town && R.map.town && Math.hypot(R.map.town.svc[k].x - R.hero.x, R.map.town.svc[k].y - R.hero.y) < r);
  const nearer = (R, a, b) => Math.hypot(R.map.town.svc[a].x - R.hero.x, R.map.town.svc[a].y - R.hero.y) <= Math.hypot(R.map.town.svc[b].x - R.hero.x, R.map.town.svc[b].y - R.hero.y);
  // the storage chest stands three cells right of the altar: between them the nearer one answers
  const atSoulAltar = (R) => near(R, 'altar', 70) && (!near(R, 'stash', 64) || nearer(R, 'altar', 'stash'));
  const atStash = (R) => near(R, 'stash', 64) && !atSoulAltar(R);
  // ---------------- the town's workshops (R-32, TASKS 1013) ----------------
  // the smith at his anvil reforges, the enchanter at her lectern enchants; the piece is chosen from the worn gear or the bag
  const atCraft = (R) => (craftShut(R) ? null : near(R, 'anvil', 80) ? 'forge' : near(R, 'lectern', 80) ? 'enchant' : null);
  // the notice board (TASKS 1033): what every townsman has on offer, in one list; a quest is taken from it as from its giver
  const atBoard = (R) => near(R, 'board', 64);
  const boardOffers = (R) => D.QUEST_GIVE.from.map((role) => ({ role, of: offerOf(R, role) })).filter((o) => o.of);
  const craftItem = (S, R) => { const c = S.craft, h = R.hero; if (!c || !c.sel) return null; const [k, v] = c.sel.split(':'); const it = k === 'eq' ? h.eq[v] : h.bag[+v]; return it && BASES[it.b] ? it : null; };
  // what the work costs on this piece now: gold (and shards for an enchantment), the chance it fails
  function craftCost(S, R, it) { const C = D.CRAFT, p = D.itemPrice(it, tradeDepth(R));
    if (S.craft.kind === 'forge') return { gold: Math.max(10, Math.round(p * C.reforge)), shards: 0, fail: 0, can: RARITY[it.rar].affixes > 0, why: TXT('sim_town.craftCost.why') };
    const n = (it.ench || []).length, E = C.ench; return n >= E.max ? { gold: 0, shards: 0, fail: 0, can: false, why: TXT('sim_town.craftCost.why.2') } : { gold: Math.max(10, Math.round(p * E.gold[n])), shards: E.shards[n], fail: E.fail[n], can: true }; }
  function craft(S, R) { const h = R.hero, it = craftItem(S, R), at = R.map.town.svc[S.craft.kind === 'forge' ? 'anvil' : 'lectern'];
    if (!it) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.craft.s') }); return; }
    const c = craftCost(S, R, it); if (!c.can) { ev(S, { k: 'nope', x: h.x, y: h.y, s: c.why }); return; }
    if (h.gold < c.gold) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.craft.s.2') }); return; }
    if (S.meta.shards < c.shards) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.craft.s.3') }); return; }
    h.gold -= c.gold; S.meta.shards -= c.shards; let res, ok = 1;
    if (S.craft.kind === 'forge') { it.mods = {}; rollAffixes(R, it); res = TXT('sim_town.craft'); }
    else if (rnd(R) < c.fail) { ok = 0;
      it.ench = []; it.mods = {}; res = TXT('sim_town.craft.2'); }
    else { const used = new Set((it.ench || []).map((e) => e.k)), pool = D.liveFor(h, 'mods', AFFIXES, (q) => q.k).filter((a) => !used.has(a.k)), a = pool[Math.floor(rnd(R) * pool.length)];
      const v = Math.max(1, Math.round((a.a + a.b * it.lvl) * (0.7 + 0.6 * rnd(R)) * (1 + 0.15 * it.rar)));
      it.ench = (it.ench || []).concat({ k: a.k, v }); res = TXT('sim_town.craft.4', { p1: a.label.replace('{v}', v) }); }
    const st = heroSt(S); h.hp = Math.min(h.hp, st.maxHp); h.mp = Math.min(h.mp, st.maxMp);
    S.craft.res = { s: res, ok, t: S.t }; S.saveN++; ev(S, { k: 'craft', x: at.x, y: at.y, kind: S.craft.kind, ok }); }
  // ---------------- quests (R-17, TASKS 1017–1022) ----------------
  // a quest of the run: R.quests [{ id, key, f, need, n, st: taken | done | turned, from, rw, ... }]; its progress comes off the event
  // bus (ev → questOn), it is done when n reaches need, turned in in the town for its reward; it goes with the hero
  const QUEST_EV = new Set(['kill', 'clear', 'floor', 'qitem', 'qevent']);
  function newQuest(R, key, f, from) { const Q = D.QUESTS[key]; return { id: R.nextId++, key, f, need: Q.need(f), n: 0, st: 'taken', from: from || null, rw: D.questReward(Q.rw, f, R.hero && R.hero.lvl) }; }
  function takeQuest(S, R, q) { (R.quests = R.quests || []).push(q); ev(S, { k: 'quest', x: R.hero.x, y: R.hero.y, s: 'take', id: q.id }); R.msg = { s: TXT('sim_town.takeQuest.msg.s', { name: D.QUESTS[q.key].name }), t: S.t }; S.saveN++; questOn(S, R, { k: 'floor', f: R.floor }); return q; }
  // how much one event moves a quest on
  function questStep(R, q, e) { const Q = D.QUESTS[q.key], deep = R.floor >= q.f && !R.town;
    if (Q.type === 'kill') return e.k === 'kill' && deep && !e.boss && (!Q.elite || e.elite) ? 1 : 0;
    if (Q.type === 'clear') return e.k === 'clear' && deep ? 1 : 0;
    if (Q.type === 'reach') return e.k === 'floor' && (R.deepest || 0) >= q.f ? q.need : 0;
    if (Q.type === 'boss') return e.k === 'kill' && e.boss && R.floor === q.f ? 1 : 0;
    if (Q.type === 'named') return e.k === 'kill' && e.quest === q.id ? 1 : 0;
    if (Q.type === 'free') return e.k === 'qevent' && e.free === Q.who ? 1 : 0;
    if (Q.type === 'fetch') return e.k === 'qitem' && e.quest === q.id ? 1 : 0;
    // the marked room cleared, or (362, 363, 366, when they come) the room's event done: an event of the bus `qevent` with the room
    if (Q.type === 'room') return (e.k === 'clear' || e.k === 'qevent') && R.floor === q.f && !R.town && e.room === q.room ? 1 : 0;
    return 0; }
  function questOn(S, R, e) { for (const q of R.quests) { if (q.st !== 'taken') continue; const d = questStep(R, q, e); if (!d) continue;
      q.n = Math.min(q.need, q.n + d); if (q.n >= q.need) { q.st = 'done'; const M = { s: TXT('sim_town.questOn.msg.s', { name: D.QUESTS[q.key].name }), t: S.t, d: 4 }; if (R.msg && R.msg.chapter && S.t < R.msg.t + R.msg.d) M.t = R.msg.t + R.msg.d, R.msgNext = M; else R.msg = M; S.ev.push({ k: 'quest', x: R.hero.x, y: R.hero.y, s: 'done', id: q.id, t: S.t }); } } }
  // a quest given up in the journal (TASKS 1633): its offer waits on the board again, its keepsake is gone from wherever it lay
  function abandonQuest(S, R, q) { if (!q || q.st !== 'taken') return; R.quests.splice(R.quests.indexOf(q), 1); const o = (R.offers || []).find((v) => v.q === q.id); if (o) o.q = 0;
    const left = (d) => !(d.kind === 'qitem' && d.quest === q.id); for (const c of R.chests) if (c.quest === q.id) delete c.quest; for (const e of R.en) if (e.quest === q.id) delete e.quest;
    R.drops = R.drops.filter(left); for (const M of Object.values(R.memo || {})) if (M.drops) M.drops = M.drops.filter(left);
    ev(S, { k: 'ui', x: R.hero.x, y: R.hero.y }); S.saveN++; }
  // the turn-in, in the town: gold, experience and the item go to the hero, the shards to the bank
  function turnIn(S, R, q) { if (!q || q.st !== 'done' || !R.town) return false; const h = R.hero, W = q.rw;
    if (W.xp) W.xp = D.questReward(['xp'], q.f, h.lvl).xp;
    if (W.scroll) { const sc = potion('scroll', W.scroll); if (!bagAdd(R, sc)) drop(R, h.x, h.y + 20, { kind: 'item', item: sc }); }
    if (W.gold) h.gold += W.gold; if (W.xp) gainXp(S, R, W.xp); if (W.shards) giveShards(S, R, W.shards, h.x, h.y, TXT('sim_town.turnIn'));
    if (W.item) { const it = rollItem(R, Math.max(1, q.f), 2, undefined, { min: D.QUESTS[q.key].item || 2, own: 1 }); it.id = R.nextId++; if (!bagAdd(R, it)) drop(R, h.x, h.y + 20, { kind: 'item', item: it }); W.got = itemName(it); W.rar = it.rar; }
    q.st = 'turned'; ev(S, { k: 'quest', x: h.x, y: h.y, s: 'turn', id: q.id }); R.msg = { s: TXT('sim_town.turnIn.msg.s', { name: D.QUESTS[q.key].name }), t: S.t }; S.saveN++; return true; }
  // ---- giving (TASKS 1018): the run's offers, drawn by its seed (not its RNG: looking does not change the run) ----
  const qhash = (a) => { a = Math.imul(a ^ (a >>> 16), 2246822519) >>> 0; a = Math.imul(a ^ (a >>> 13), 3266489917) >>> 0; return (a ^ (a >>> 16)) >>> 0; };
  // the first offer is one of the goals put on a floor (named, fetch, room), the rest from the whole pool, each from its own townsman
  // a batch more after each boss slain, as the merchant's shelf is stocked anew (TASKS 1026: 2–3 a run were all taken in the first
  // minute); a batch's givers are those with no offer still waiting
  function offersOf(R) { const G = D.QUEST_GIVE; R.offers = R.offers || []; if (R.offerB === undefined) R.offerB = R.offers.length ? 1 : 0;
    while (R.offerB < 1 + (R.bossN || 0)) { const b = R.offerB++; let a = qhash((R.seed >>> 0) + 0x51ed27 + b * 7919);
      const r = () => (a = qhash(a + 0x9e3779b9)) / 4294967296, pool = G.pool.slice(), from = G.from.filter((w) => !R.offers.some((o) => o.from === w && !o.q)), n = Math.min(from.length, G.n[0] + Math.floor(r() * (G.n[1] - G.n[0] + 1)));
      for (let i = 0; i < n; i++) { const key = pool.splice(Math.floor(r() * (i ? pool.length : 3)), 1)[0], who = from.splice(Math.floor(r() * from.length), 1)[0]; R.offers.push({ key, from: who, q: 0 }); } }
    return R.offers; }
  // the floor a quest taken now points at: past the deepest reached; a goal put on a floor wants one not yet built and no boss's
  function questFloor(R, key) { const Q = D.QUESTS[key], top = RUN(R).floors, d = R.deepest || 0;
    for (let f = Math.max(Q.from || 1, d + (Q.ahead || 1)); f <= top; f++) { if (Q.noBoss && STAGE(R, f).boss) continue; if (Q.fresh && R.memo && R.memo[f]) continue; return f; } return 0; }
  // the Keeper's chain (1022): its first step not yet behind the hero, while none of the chain is in hand
  // a note's series is told in order, a boss's notes only on its floors; picked by the run's seed so the sim's own random is untouched
  function notePlace(R) { const f = R.floor, m = R.map, done = R.notesDone || (R.notesDone = {}), era = D.NOTES.era[m.biome]; if (!R.viaTown || R.mode !== 'campaign' || R.town || done[f] || !era) return; done[f] = 1;
    let a = qhash((R.seed >>> 0) * 131 + f * 7877); const r = () => (a = qhash(a + 0x9e3779b9)) / 4294967296, shuffle = (L) => { const o = L.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
    const used = R.notesUsed || (R.notesUsed = []), step = R.noteChain || (R.noteChain = {}), fits = (n) => !used.includes(n.id) && (!n.chain || (step[n.chain] || 0) === n.part - 1), ofEra = (n) => n.id.split('_')[0] === era || (n.id.startsWith('pilot') && era === 'cellar');
    const put = (n, rm, sec) => { used.push(n.id); if (n.chain) step[n.chain] = n.part; const [x, y] = standNear(R, rm.cx * TILE + TILE / 2 + (sec === undefined ? Math.floor(r() * 90) - 45 : 22), rm.cy * TILE + TILE / 2 + (sec === undefined ? Math.floor(r() * 70) - 20 : 26)); R.drops.push(Object.assign({ id: R.nextId++, kind: 'note', note: n.id, x, y, vx: 0, vy: 0, z: 0, vz: 0, t0: -9, rest: 4 }, sec === undefined ? {} : { sec })); };
    const rooms = shuffle(questRooms(R)), n = Math.max(D.NOTES.n[0], Math.min(D.NOTES.n[1], Math.round(rooms.length / 3))), L = shuffle(D.NOTES.list), boss = L.find((o) => o.kind === 'boss' && f >= o.floors[0] && f <= o.floors[1] && fits(o)), out = boss ? [boss] : [];
    for (const o of L) { if (out.length >= n) break; if (o.kind === 'note' && ofEra(o) && fits(o)) out.push(o); }
    out.forEach((o, i) => { if (rooms.length) put(o, rooms[i % rooms.length]); });
    (m.secrets || []).forEach((q, i) => { const o = L.find((v) => v.kind === 'secret' && ofEra(v) && fits(v)); if (o && r() < 0.6) put(o, m.rooms[q.room], i); });
    const hosted = (m.secrets || []).filter((q) => m.rooms[q.host]), hq = hosted.length && r() < 0.7 ? hosted[Math.floor(r() * hosted.length)] : null, hn = hq && L.find((v) => v.kind === 'hint' && v.how === SIMX.secretHow(hq) && fits(v)); if (hn) put(hn, m.rooms[hq.host], hq.parent); }
  function nameElites(R) { for (const e of R.en) { const G = D.ELITE_NAMES[D.ELITE_GROUP[e.type]]; if (!e.elite || e.title || e.nm || D.BOSSES[e.type] || !G) continue; let a = qhash((R.seed >>> 0) * 257 + (e.id || 0) * 2654435 + R.floor * 811); const n = G.names[a % G.names.length]; a = qhash(a + 0x9e3779b9); const w = G.adj[a % G.adj.length]; e.nm = n[0] + ' ' + w[n[1] === 'f' ? 1 : 0]; } }
  const noteNear = (R) => (R.town ? null : R.drops.find((p) => p.kind === 'note' && !p.got && !hidden(R.map, p) && Math.hypot(p.x - R.hero.x, p.y - R.hero.y) < 56) || null);
  function openNote(S, R, p) { p.got = 1; const M = S.meta.notes || (S.meta.notes = []); if (!M.includes(p.note)) M.push(p.note); S.note = { id: p.note }; S.screen = 'note'; S.hover = ''; S.saveN++; ev(S, { k: 'ui', x: p.x, y: p.y }); }
  const isFree = (R, w) => !!(R.freed && R.freed[w]), capOf = (R, w) => (R.captives || {})[w];
  const townShut = (R, w) => !!R.town && !!capOf(R, w) && !isFree(R, w), shopShut = (R) => townShut(R, 'merchant');
  const folkHere = (R, list) => list.filter((f) => !capOf(R, f.role) || isFree(R, f.role));
  const craftShut = (R) => (!R.town ? null : near(R, 'anvil', 80) && townShut(R, 'smith') ? 'smith' : near(R, 'lectern', 80) && townShut(R, 'enchanter') ? 'enchanter' : null);
  const captiveNear = (R) => { if (R.town) return null; for (const C of Object.values(R.captives || {})) if (C.x !== undefined && D.CAPTIVES[C.who].f === R.floor && !isFree(R, C.who) && Math.hypot(C.x - R.hero.x, C.y - R.hero.y) < 100) return C; return null; };
  const cageCells = (m, C) => { const tx = Math.floor(C.x / TILE), ty = Math.floor(C.y / TILE), out = []; for (let y = ty - 1; y <= ty; y++) for (let x = tx - 1; x <= tx + 1; x++) out.push(y * m.W + x); return out; };
  // the cage is three cells wide: a spot with a clear cell all round it, so it stands on open floor and never shuts a way through
  function cageSpot(R, rooms0) { const m = R.map, blk = new Set(m.block), wet = new Set(m.water || []), bad = [...m.decor, ...R.chests, ...R.shrines, ...R.pots, ...R.drops].map((d) => [Math.floor(d.x / TILE), Math.floor(d.y / TILE)]);
    // the strictest test that any room passes: clear of traps too, then a clear cell round it, then just its own cells
    const clear = (tx, ty, lv) => { if (lv < 1 && (m.traps || []).some((t) => Math.abs(t.x / TILE - tx) < 5 && Math.abs(t.y / TILE - ty) < 5)) return false; const a = lv < 2 ? 2 : 1, b = lv < 2 ? 1 : 0; for (let y = ty - a; y <= ty + b; y++) for (let x = tx - a; x <= tx + a; x++) { const k = y * m.W + x; if (x < 0 || y < 0 || x >= m.W || y >= m.H || m.cells[k] !== 1 || blk.has(k) || wet.has(k) || bad.some(([bx, by]) => bx === x && by === y)) return false; } return true; };
    for (let lv = 0; lv < 3; lv++) for (const r of rooms0 || questRooms(R)) { const spots = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (clear(x, y, lv)) spots.push([x, y, Math.hypot(x - r.cx, y - r.cy)]);
      if (spots.length) { spots.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]); const [x, y] = spots[0]; return { x: x * TILE + TILE / 2, y: y * TILE + TILE - 2, room: r.id, lv }; } }
    return null; }
  // no room for the cage must not leave the shop shut for the whole run
  function captivePut(R, C, rooms) { const at = cageSpot(R, rooms); if (!at) { R.freed = Object.assign(R.freed || {}, { [C.who]: 1 }); return; } Object.assign(C, at); }
  function captivePlace(R) { const m = R.map; for (const C of Object.values(R.captives || {})) { const D0 = D.CAPTIVES[C.who]; if (D0.f !== R.floor || isFree(R, C.who)) continue; if (C.x === undefined && !D0.boss) captivePut(R, C); if (C.x !== undefined) for (const k of cageCells(m, C)) if (!m.block.includes(k)) m.block.push(k); } }
  function captiveBoss(R, e) { for (const C of Object.values(R.captives || {})) if (D.CAPTIVES[C.who].boss && D.CAPTIVES[C.who].f === R.floor && C.x === undefined && !isFree(R, C.who)) { captivePut(R, C, [R.map.rooms[e.room]]); captivePlace(R); } }
  function freeCaptive(S, R, C) { R.freed = Object.assign(R.freed || {}, { [C.who]: 1 }); ev(S, { k: 'click', x: C.x, y: C.y }); const was = R.msg; ev(S, { k: 'qevent', free: C.who, x: C.x, y: C.y }); if (R.msg !== was) { R.msg.t = S.t + 5; R.msgNext = R.msg; } R.msg = { s: D.CAPTIVES[C.who].free, t: S.t, d: 5 }; S.saveN++; }
  function storyStep(R) { if (!R.viaTown || (R.quests || []).some((q) => D.QUESTS[q.key].kind === 'story' && q.st !== 'turned')) return null;
    return D.storyChain(R.mode).find((s) => (D.QUESTS[s.key].type === 'free' ? !!capOf(R, D.QUESTS[s.key].who) && !isFree(R, D.QUESTS[s.key].who) : s.key === 'chapter' ? !(R.slain || []).includes(s.f) : (R.deepest || 0) < s.f)) || null; }
  // what a townsman offers now: the quest as it would be taken (its floor set, its foe's name or its keepsake drawn), or null
  function offerOf(R, role) { if (!R.viaTown || (capOf(R, role) && !isFree(R, role))) return null; let o = null, key, f, story = 0;
    const st = role === 'keeper' && storyStep(R); if (st) { key = st.key; f = st.f; story = 1; }
    else { o = offersOf(R).find((q) => q.from === role && !q.q && questFloor(R, q.key)); if (!o) return null; key = o.key; f = questFloor(R, key); }
    const Q = D.QUESTS[key], q = { id: 0, key, f, need: Q.need(f), n: 0, st: 'taken', from: role, rw: D.questReward(Q.rw, f, R.hero.lvl), story },
      k = qhash((R.seed >>> 0) * 31 + f * 977 + key.length * 131 + role.length);
    if (Q.type === 'named') q.title = D.NAMED.titles[k % D.NAMED.titles.length];
    if (Q.type === 'fetch') { q.thing = D.QUEST_SAY[role].thing; q.ic = D.QUEST_SAY[role].ic; }
    return { o, q }; }
  const questDone = (R, role) => (R.quests || []).find((q) => q.st === 'done' && q.from === role);
  // the mark over a townsman's head: ? a quest to turn in, ! one to take
  // (past the campaign's last boss the Keeper's own offers wait behind the end of the run, PR 29 review: no «!» over him for them)
  const questMark = (R, role) => (!R.town ? '' : questDone(R, role) ? '?' : offerOf(R, role) && !(role === 'keeper' && campaignDone(R)) ? '!' : '');
  function giveQuest(S, R, role) { const of = offerOf(R, role); if (!of) return null; const q = Object.assign(of.q, { id: R.nextId++ }); delete q.story; if (of.o) of.o.q = q.id; return takeQuest(S, R, q); }
  // the words of a quest's business with a townsman: the turn-in first, then the offer; the last page carries its button
  const rwLine = (W) => [W.scroll && W.scroll + ' ' + TXT.n('sim_town.rwLine', W.scroll), W.gold && TXT('sim_town.rwLine.2', { gold: W.gold }), W.xp && TXT('sim_town.rwLine.3', { xp: W.xp }), W.item && (W.got ? '«' + W.got + '»' : TXT('sim_town.rwLine.4')), W.shards && W.shards + ' ' + TXT.n('sim_town.rwLine.5', W.shards)].filter(Boolean).join(' · ');
  function questTalk(R, role) { const SAY = D.QUEST_SAY[role]; if (!SAY) return null;
    const dn = questDone(R, role); if (dn) return { pages: [TXT('sim_town.questTalk.pages', { name: D.QUESTS[dn.key].name, done: SAY.done[(dn.id || 0) % SAY.done.length] })], act: { k: 'turn', id: dn.id, rw: dn.rw } };
    const of = offerOf(R, role); if (!of) return null;
    const q = of.q, Q = D.QUESTS[q.key], pick = (L) => L[(q.f * 7 + q.key.length) % L.length], story = q.story && (Q.type === 'free' ? [Q.ask] : q.key === 'chapter' ? D.STORY.boss[D.stageOf('campaign', q.f).boss] : D.STORY.depths[q.f]);
    const say = story || [R.bossN && R.lastBoss && q.f % 2 === 0 ? pick(SAY.boss).replace('{boss}', ENEMIES[R.lastBoss].name) : pick(SAY.asks[Q.type] || SAY.asks.kill)];
    return { pages: [...say, Q.text(q)], act: { k: 'take', key: q.key, rw: q.rw, name: Q.name } }; }
  // the keepsake's icon a talk's quest is about (TASKS 1030): the one offered (its giver's keepsake), or the one being turned in
  function questIcon(R, role, a) { if (!a) return null; if (a.k === 'turn') { const q = (R.quests || []).find((o) => o.id === a.id); return (q && q.ic) || null; }
    return D.QUESTS[a.key] && D.QUESTS[a.key].type === 'fetch' && D.QUEST_SAY[role] ? D.QUEST_SAY[role].ic || null : null; }
  // past the campaign's last boss the Keeper asks, after any quest's business, whether the run ends here, won, or goes on down (TASKS 1148)
  const keeperEnd = (R) => ({ pages: R.campaignWon ? D.KEEPER.endDeep.slice() : D.KEEPER.end.slice(), act: { k: 'finish', rw: { shards: SIMX.runReward(R, 'win').base } } });
  // a quest to turn in comes first; a new offer does not hide the choice (PR 29 review: a side quest offered after the descent took
  // its place on every talk until it was taken): the Keeper's offers wait, the notice board has them too
  const talkOf = (R, role) => { const qt = questTalk(R, role); return role === 'keeper' && campaignDone(R) && (!qt || qt.act.k !== 'turn') ? keeperEnd(R) : qt; };
  // the talk's button: take the quest (the talk closes), or turn it in (the thanks, then whatever else the townsman has)
  function talkAct(S, R, T) { const a = T.act; if (!a) return;
    if (a.k === 'finish') { SIMX.finishRun(S); return; }
    if (a.k === 'take') { giveQuest(S, R, T.role); S.screen = 'play'; S.talk = null; return; }
    const q = (R.quests || []).find((o) => o.id === a.id); if (!turnIn(S, R, q)) return;
    const nx = talkOf(R, T.role); T.pages = [TXT('sim_town.talkAct.pages', { thanks: q.key === 'rescue' ? D.STORY.rescueThanks.join(' ') : D.QUESTS[q.key].thanks ? D.QUESTS[q.key].thanks : D.QUEST_SAY[T.role].thanks[(q.id || 0) % D.QUEST_SAY[T.role].thanks.length], p2: rwLine(q.rw) })].concat(nx ? nx.pages : []); T.p = 0; T.act = nx ? nx.act : null; }
  // ---- the goals put on a floor when it is first built (1019–1021) ----
  // rooms a goal may take: fighting rooms off the start, the boss's and the merchant's, farthest from the spawn first
  function questRooms(R) { const m = R.map, sp = m.spawn;
    return m.rooms.filter((r) => r.type === 'combat' && !r.pocket && !r.isle && !(m.shop && m.shop.room === r.id)).sort((a, b) => Math.hypot(b.cx * TILE - sp.x, b.cy * TILE - sp.y) - Math.hypot(a.cx * TILE - sp.x, a.cy * TILE - sp.y)); }
  const plainFoe = (e) => e.deadT < 0 && counted(e) && !D.BOSSES[e.type] && !e.elite && !e.guard && !e.exit && !ENEMIES[e.type].lurk && !ENEMIES[e.type].deep && !ENEMIES[e.type].lake && e.room >= 0;
  function questPlace(S, R) { const f = R.floor, m = R.map;
    for (const q of R.quests || []) { const Q = D.QUESTS[q.key]; if (q.st !== 'taken' || q.f !== f || !Q.fresh || q.placed) continue; q.placed = 1; const rooms = questRooms(R);
      if (Q.type === 'named') { const r = rooms.find((r2) => R.en.some((e) => plainFoe(e) && e.room === r2.id)), e = r && R.en.find((o) => plainFoe(o) && o.room === r.id);
        if (!e) { q.lost = 1; continue; } const stg = STAGE(R, f), mob = stg.mob || 1;
        e.elite = 1; e.mods = rollMods(R, dep(R), e); e.hp = e.max = Math.round(e.max * eliteK(e, 'hp') * D.NAMED.hp); e.dmg = e.dmg / mob * eliteK(e, 'dmg'); if (has(e, 'ward')) e.ward = Math.round(e.max * MOD.ward.share); e.quest = q.id; e.title = q.title; q.room = e.room; }
      else if (Q.type === 'room') { const r = rooms.find((r2) => R.en.filter((e) => e.deadT < 0 && counted(e) && e.room === r2.id).length >= 3) || rooms.find((r2) => R.en.some((e) => e.deadT < 0 && counted(e) && e.room === r2.id));
        if (!r) { q.lost = 1; continue; } q.room = r.id; }
      else if (Q.type === 'fetch') { const roomOf = (c) => m.rooms[DG.roomAt(m, c.x, c.y)] || {}, free = R.chests.filter((c) => !c.open && !c.quest);
        const secret = free.filter((c) => roomOf(c).type === 'secret'), plain = free.filter((c) => roomOf(c).type !== 'secret'), u = qhash((R.seed >>> 0) * 7919 + f * 104729 + q.id) / 4294967296;
        const c = u < 0.35 && secret.length ? pick(R, secret) : u < 0.7 && plain.length ? pick(R, plain) : null;
        if (c) { c.quest = q.id; c.qic = q.ic; q.where = roomOf(c).type === 'secret' ? 'secret' : 'chest'; continue; }
        const r = rooms[Math.min(rooms.length - 1, Math.floor(rnd(R) * Math.min(3, rooms.length)))]; if (!r) { q.lost = 1; continue; }
        const [x, y] = standNear(R, r.cx * TILE + TILE / 2, r.cy * TILE + TILE / 2 + 20);
        R.drops.push({ id: R.nextId++, kind: 'qitem', quest: q.id, ic: q.ic, x, y, vx: 0, vy: 0, z: 0, vz: 0, t0: R.t }); q.where = 'floor'; } } }
  // the journal's order (TASKS 1023): done (to turn in) first, then those in hand, the story before the side, then the turned in
  const journalOf = (R) => (R.quests || []).filter((q) => q.id > 0).map((q, i) => [q, i]).sort(([a, i], [b, j]) => ({ done: 0, taken: 1, turned: 2 })[a.st] - ({ done: 0, taken: 1, turned: 2 })[b.st]
    || (D.QUESTS[a.key].kind === 'story' ? 0 : 1) - (D.QUESTS[b.key].kind === 'story' ? 0 : 1) || i - j).map(([q]) => q);
  // where a quest's goal is on this floor, for the map: the named foe (alive), the room to clear, the keepsake once seen
  function questMarks(R) { const out = []; if (R.town) return out;
    for (const q of R.quests || []) { if (q.st !== 'taken' || q.f !== R.floor) continue; const Q = D.QUESTS[q.key];
      if (Q.type === 'named') { const e = R.en.find((o) => o.quest === q.id && o.deadT < 0); if (e) out.push({ kind: 'named', x: e.x, y: e.y, q }); }
      if (Q.type === 'free' && capOf(R, Q.who) && capOf(R, Q.who).room !== undefined && R.floor === q.f) { const r = R.map.rooms[capOf(R, Q.who).room]; out.push({ kind: 'room', x: r.cx * TILE + TILE / 2, y: r.cy * TILE + TILE / 2, r, q }); }
      if (Q.type === 'room' && q.room !== undefined) { const r = R.map.rooms[q.room]; out.push({ kind: 'room', x: r.cx * TILE + TILE / 2, y: r.cy * TILE + TILE / 2, r, q }); }
      if (Q.type === 'fetch') { const seenAt = (o) => !hidden(R.map, o) && R.seen[Math.floor(o.y / TILE) * R.map.W + Math.floor(o.x / TILE)], d = R.drops.find((o) => o.kind === 'qitem' && o.quest === q.id && !o.got), c = R.chests.find((o) => o.quest === q.id && !o.open);
        if (d && seenAt(d)) out.push({ kind: 'fetch', x: d.x, y: d.y, q }); else if (c && seenAt(c)) out.push({ kind: 'fetch', x: c.x, y: c.y, q }); } }
    return out; }
  // a quest's state in a few words, for the HUD's tracker
  function questLine(q, R) { const Q = D.QUESTS[q.key];
    if (q.st === 'done') return D.FOLK[q.from] ? TXT('sim_town.questLine.who', { p1: D.FOLK[q.from].name }) : TXT('sim_town.questLine');
    if (Q.type === 'kill' || Q.type === 'clear') return TXT('sim_town.questLine.2', { n: q.n, need: q.need, f: q.f });
    if (Q.type === 'named') return TXT('sim_town.questLine.3', { title: q.title, f: q.f });
    if (Q.type === 'fetch') return TXT('sim_town.questLine.4', { thing: q.thing, f: q.f }) + (q.where === 'chest' ? TXT('sim_town.questLine.chest') : q.where === 'secret' ? TXT('sim_town.questLine.secret') : q.where === 'floor' ? TXT('sim_town.questLine.floor') : '');
    if (Q.type === 'free') return TXT('sim_town.questLine.free', { f: q.f });
    if (Q.type === 'room') { const n = R && R.floor === q.f && q.room !== undefined ? R.en.filter((e) => e.room === q.room && e.deadT < 0 && counted(e)).length : 0; return TXT('sim_town.questLine.5', { p1: n ? TXT('sim_town.questLine.6', { n }) : TXT('sim_town.questLine.7'), f: q.f }); }
    if (Q.type === 'boss') return TXT('sim_town.questLine.8', { f: q.f, boss: ENEMIES[D.stageOf('campaign', q.f).boss].name });
    return TXT('sim_town.questLine.9', { f: q.f }); }
  // ---------------- a word with the townsfolk (TASKS 1016, 1023) ----------------
  // E by a townsman with something to say (not the smith or the enchanter, whose E is their workshop) opens the dialogue window
  const folkNear = (R) => { if (!R.town || !R.map.town) return null; let best = null, bd = 76;
    for (const f of folkOf(R)) { const FD = D.FOLK[f.role]; if (!FD.lines || f.role === 'smith' || f.role === 'enchanter') continue; const d = Math.hypot(f.x - R.hero.x, f.y - R.hero.y); if (d < bd) { bd = d; best = f; } }
    return best; };
  // the Keeper's pages: the end of the last hero (a first death, a death, a win), a chapter's boss slain, a legendary found, a long
  // time below; each told once; nothing new, his idle pair
  function keeperPages(S, R) { const K = D.KEEPER, T = R.keeperT || (R.keeperT = {}), M = S.meta, out = [];
    if (!M.keeperMet) { M.keeperMet = 1; out.push(...K.first); }
    if (!M.endTold && M.lastEnd) { M.endTold = 1; if (M.lastEnd === 'dead') out.push(...(M.deaths === 1 ? K.death1 : K.death)); if (M.lastCls && D.CLASSES[M.lastCls] && (M.lastEnd === 'win' || M.lastEnd === 'dead')) out.push(K.cls(D.CLASSES[M.lastCls].name.toLowerCase())); }
    if (R.campaignWon && !T.won) { T.won = 1; out.push(...K.win); }
    if ((R.bossN || 0) > (T.boss || 0) && R.lastBoss) { T.boss = R.bossN; out.push(...K.boss(ENEMIES[R.lastBoss].name)); }
    if (R.legend && T.legend !== R.legend) { T.legend = R.legend; out.push(...K.rare(R.legend)); }
    if ((R.away || 0) >= 4 && T.away !== R.townDeep) { T.away = R.townDeep; out.push(...K.away); }
    return out; }
  // a quest's business (TASKS 1018) comes after the Keeper's news and instead of the idle lines; the smith's talk keeps a button
  // into his workshop
  function openTalk(S, R, f) { const FD = D.FOLK[f.role], qt = talkOf(R, f.role); let pages = f.role === 'keeper' ? keeperPages(S, R) : [], act = qt ? qt.act : null;
    if (qt) pages = pages.concat(qt.pages);
    else if (!pages.length) { f.sayN = ((f.sayN ?? -1) + 1) % FD.lines.length; pages = FD.lines[f.sayN].slice(); }
    S.talk = Object.assign({ role: f.role, i: f.i, pages, p: 0, act, origin: FD.origin }, f.role === 'smith' ? { craft: 1 } : {}); S.screen = 'talk'; S.hover = ''; f.near = 1; f.sayT = -99; S.saveN++; ev(S, { k: 'say', x: f.x, y: f.y, role: f.role }); }
  // ---------------- the storage chest (R-33, TASKS 1012) ----------------
  // anything left in the town for the heroes to come: S.meta.stash, D.STASH.cells of it, its items under the item balance
  // they were made with (re-powered like a saved run's when that changes)
  function stashOf(S) { const T = S.meta.stash || (S.meta.stash = { v: D.ITEM_BAL.version, items: [] });
    // the «Сундук предков» upgrade is gone (TASKS 1617): what was paid for it comes back
    if (S.meta.up && S.meta.up.vault) { S.meta.shards += [0, 40, 100][S.meta.up.vault] || 0; delete S.meta.up.vault; }
    if (T.v !== D.ITEM_BAL.version) { for (const it of T.items) if (it && BASES[it.b]) itemPower(it); T.v = D.ITEM_BAL.version; } return T; }
  const mergeStack = (a, b) => { if (!b || !isCons(a) || b.b !== a.b) return 0; const m1 = Math.min(a.n, D.CONSUMABLES[a.b].stack - b.n); if (m1 <= 0) return 0; b.n += m1; a.n -= m1; return m1; };
  function stashPut(S, R, i, j) { const T = stashOf(S), h = R.hero, it = h.bag[i], n = D.STASH.cells;
    if (!it) return;
    if (j !== undefined && mergeStack(it, T.items[j])) { if (!it.n) h.bag[i] = null; S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); return; }
    // a stack joins the stacks already in the chest (TASKS 1423)
    let joined = 0; if (j === undefined) for (const q of T.items) { if (!mergeStack(it, q)) continue; joined = 1; if (!it.n) { h.bag[i] = null; S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); return; } }
    if (j === undefined) { j = 0; while (j < n && T.items[j]) j++; }
    if (j >= n) { if (joined) { S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); } else ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.stashPut.s.3') }); return; }
    const was = T.items[j]; T.items[j] = it; h.bag[i] = was ? Object.assign(was, { id: R.nextId++ }) : null; S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); }
  function stashTake(S, R, j, i) { const T = stashOf(S), h = R.hero, it = T.items[j]; if (!it) return;
    if (i !== undefined && mergeStack(it, h.bag[i])) { if (!it.n) T.items[j] = null; S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); return; }
    if (i !== undefined && h.bag[i]) { const was = h.bag[i]; h.bag[i] = Object.assign(it, { id: R.nextId++ }); T.items[j] = was; S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); return; }
    if (i !== undefined) h.bag[i] = it; else if (!bagAdd(R, it)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.stashTake.s.2') }); return; }
    it.id = R.nextId++; T.items[j] = null; S.saveN++; ev(S, { k: 'equip', x: h.x, y: h.y }); }
  // the town's gate out (TASKS 1149): the run given up there, or ended won past the campaign's last boss
  const atExitGate = (R) => !!(R.town && R.map.town && R.map.town.svc.exitGate && Math.hypot(R.map.town.svc.exitGate.x - R.hero.x, R.map.town.svc.exitGate.y - R.hero.y) < 60);
  const atGate = (R) => !!(R.town && R.map.town && gateWays(R).length && Math.hypot(R.map.town.svc.portal.x - R.hero.x, R.map.town.svc.portal.y - R.hero.y) < 64);
  const gateWays = (R) => (R.portal ? [{ k: 'portal', f: R.portal.f }] : []).concat((R.ways || []).filter(D.wayFloor).map((f) => ({ k: 'way', f })));
  function gateGo(S, R, o) { const h = R.hero; S.screen = 'play';
    enterFloor(S, R, o.f, undefined, o.k); if (o.k === 'portal') R.portal = null; ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); }
  // ---------------- dungeon altars: one gift of each tier, paid from the meta bank; one gift per altar ----------------
  // the offer is rolled when the altar is first opened, so a run saved before altars had gifts still gets one
  function openAltar(S, R, sh) {
    if (!sh.gifts) sh.gifts = [1, 2, 3].map((tier) => ({ id: pick(R, D.liveFor(R.hero, 'gifts', D.GIFTS).filter((g) => g.tier === tier)).id, cost: D.giftCost(tier, dep(R)) }));
    for (const g of sh.gifts) if (g.id === 'greed') g.id = 'alert';
    R.altar = R.shrines.indexOf(sh); S.screen = 'altar'; S.hover = ''; ev(S, { k: 'altar', x: sh.x, y: sh.y });
  }
  function takeGift(S, R, sh, i, x, y) {
    if (sh.used) return;
    const o = sh.gifts[i], G = D.GIFTS.find((q) => q.id === o.id), h = R.hero;
    if (S.meta.shards < o.cost) { ev(S, { k: 'nope', x, y, s: TXT('sim_town.takeGift.s') }); return; }
    S.meta.shards -= o.cost; sh.used = 1; sh.took = o.id;
    if (o.id === 'bless') { if (!h.bless) h.blessTo = 0; h.bless = 1; } else { h.perks = h.perks || {}; h.perks[o.id] = (h.perks[o.id] || 0) + 1; }
    const st = heroSt(S); h.hp = st.maxHp; h.mp = st.maxMp;
    ev(S, { k: 'bless', x: sh.x, y: sh.y, id: o.id, s: G.name, cost: o.cost }); R.msg = { s: G.name + ': ' + G.desc + (o.id === 'bless' ? TXT('sim_town.takeGift.msg.s') : TXT('sim_town.takeGift.msg.s.2')), t: S.t };
    S.screen = 'play'; S.saveN++;
  }
  // a spent altar only answers while a donation can go through (TASKS 242)
  const canDonate = (R) => (R.donations || 0) < 10 && R.hero.gold >= 1000;
  function donate(S, R, x, y) {
    if ((R.donations || 0) >= 10) { ev(S, { k: 'nope', x, y, s: TXT('sim_town.donate.s') }); return; }
    if (R.hero.gold < 1000) { ev(S, { k: 'nope', x, y, s: TXT('sim_town.donate.s.2') }); return; }
    R.hero.gold -= 1000; R.donations = (R.donations || 0) + 1;
    giveShards(S, R, 1, R.hero.x, R.hero.y, TXT('sim_town.donate')); S.saveN++;
  }
  // ---------------- the merchant ----------------
  // his shelf for this floor: the gear first (the showpiece at least SHOP.best rarity), then potions and scrolls in stacks
  // kind: 'town' — the town's shelf, more potions and scrolls; 'wander' — the wandering merchant of a floor, his gear from deeper down
  // a deeper floor reached tops the town shelf's potions and scrolls up to its count there, its gear kept (TASKS 513: on the 10th–12th
  // the player drank a stock a trip)
  function restock(R, sh, f) { for (const [b, n] of D.SHOP.townCons(f)) { if (SIMX.useless(R, b)) continue; const g = sh.goods.find((q) => q.n && q.it.b === b), price = D.itemPrice({ b }, f);
    if (g) { g.n = Math.max(g.n, n); g.price = price; } else sh.goods.push({ it: Object.assign(potion(b, 1), { id: R.nextId++ }), price, n }); } }
  function stockShop(R, f, kind) {
    const goods = [], SH = D.SHOP, WD = SH.wander, g = kind === 'wander' ? f + WD.depth : f, q = SH.q(g) + (kind === 'wander' ? WD.q : 0), best = Math.min(4, SH.best(g) + (kind === 'wander' ? WD.best : 0));
    for (let i = 0; i < SH.gear(g); i++) { let it = rollItem(R, g, q, i === 0 ? 'weapon' : undefined, { own: 1 });
      for (let k = 0; i === 0 && it.rar < best && k < 60; k++) it = rollItem(R, g, q + 1, 'weapon', { own: 1 });
      it.id = R.nextId++; goods.push({ it, price: D.itemPrice(it, g) }); }
    for (const [b, n] of (kind === 'town' ? SH.townCons : SH.cons)(f)) if (!SIMX.useless(R, b)) goods.push({ it: Object.assign(potion(b, 1), { id: R.nextId++ }), price: D.itemPrice({ b }, f), n });
    return Object.assign({ goods, back: [], greetT: -9, tradeT: -9, away: 1, line: 0 }, kind === 'wander' ? { wander: 1 } : {});
  }
  // what the merchant pays and asks by: the floor's depth, in the town the deepest floor reached
  const tradeDepth = (R) => (R.town ? dep(R, Math.max(1, R.deepest || 0)) : dep(R));
  const atCounter = (R) => { const s = R.map.shop, h = R.hero; return !!s && Math.abs(h.x - s.front.x) < 64 && h.y > s.counter.y - 4 && h.y - s.front.y < 40; };
  function openShop(S, R) { S.screen = 'shop'; if (R.town) broke(S, R); R.shop.line = Math.floor(rnd(R) * (R.shop.wander ? D.SHOP.wander.lines : D.SHOP.lines).length); R.shop.tradeT = S.t; S.hover = ''; ev(S, { k: 'shop', x: R.map.shop.x, y: R.map.shop.y }); }
  function buy(S, R, g, back) {
    const h = R.hero, sh = R.shop;
    if (h.gold < g.price) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.buy.s') }); return; }
    const it = g.n ? Object.assign(potion(g.it.b, 1), { id: R.nextId++ }) : g.it;
    if (!bagAdd(R, it)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_town.buy.s.2') }); return; }
    h.gold -= g.price; sh.tradeT = S.t;
    if (g.n) { if (--g.n <= 0) sh.goods.splice(sh.goods.indexOf(g), 1); } else (back ? sh.back : sh.goods).splice((back ? sh.back : sh.goods).indexOf(g), 1);
    ev(S, { k: 'trade', x: R.map.shop.x, y: R.map.shop.y, n: -g.price, s: TXT('sim_town.buy.s.3', { p1: itemName(it) }), rar: it.rar });
  }
  // a sale goes onto the buy-back row at the price paid for it, so a slip of the mouse costs nothing
  function sell(S, R, i) {
    const h = R.hero, sh = R.shop, it = h.bag[i]; if (!it) return;
    const n = isCons(it) ? 1 : 0, price = D.sellPrice(it, tradeDepth(R)), one = n && it.n > 1 ? Object.assign({}, it, { id: R.nextId++, n: 1 }) : it;
    if (n && it.n > 1) it.n--; else h.bag[i] = null;
    h.gold += price; sh.tradeT = S.t; sh.back.push({ it: one, price }); if (sh.back.length > D.SHOP.buyback) sh.back.shift();
    ev(S, { k: 'trade', x: R.map.shop.x, y: R.map.shop.y, n: price, s: TXT('sim_town.sell.s', { p1: itemName(one) }), rar: one.rar });
  }

  Object.assign(SIMX, {
    folkR, folkOf, folkFree, stepFolk, solids, interact, atExitGate, wake, atSoulAltar, atStash, atCraft, atBoard, boardOffers, craftItem, craftCost,
    craft, QUEST_EV, newQuest, takeQuest, questOn, turnIn, abandonQuest, offersOf, questFloor, storyStep, offerOf, questMark, giveQuest, rwLine,
    nameElites, notePlace, noteNear, captivePlace, captiveBoss, captiveNear, shopShut, craftShut, folkHere, questTalk, questIcon, talkAct, openTalk, questRooms, plainFoe, questPlace, journalOf, questMarks, questLine, folkNear, keeperPages, stashOf,
    stashPut, stashTake, atGate, gateWays, gateGo, openAltar, takeGift, canDonate, donate, restock, stockShop, tradeDepth, atCounter, buy,
    sell });
})(typeof window !== 'undefined' ? window : globalThis);
