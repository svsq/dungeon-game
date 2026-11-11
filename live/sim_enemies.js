// live/sim_enemies.js — monsters: elite powers, the cave and magma kinds, eel and serpent, projectiles, stepMonsters and the AI.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const {
    BAL, D, DG, DT, EEL_MOUTH, ELITE_MODS, ENEMIES, GOO, K, STAGE, TILE, WADE, WEB, WET, angDiff, boxHit, cell, chasm, crustAt, dep, dif,
    doorKey, eliteK, ev, flow, gift, golemCrust, gooAt, homeFlow, inWater, kinOf, kindle, losClear, move, onLava, pinch, pyre, rnd, shove,
    solidAt, solidC, under, webAt, who, windOf } = SIMX;
  // ---------------- elite powers ----------------
  const MOD = Object.fromEntries(ELITE_MODS.map((m) => [m.id, m])), has = (e, id) => !!(e.mods && e.mods.includes(id));
  function rollMods(R, f, e) { const [a, b] = D.eliteMods(f), n = a + (b > a && rnd(R) < 0.5 ? 1 : 0), pool = D.modPool(R.mode, R.floor, ENEMIES[e.type].kind), out = [];
    while (out.length < n) out.push(pool.splice(Math.floor(rnd(R) * pool.length), 1)[0]); return out; }
  // what an elite's powers add to a blow of its that landed on the hero
  function struck(S, R, e) {
    const h = R.hero; if (!e || h.hurtT !== S.t) return;
    if (e.type === 'boss_serpent') { e.hitDone = 1; e.openUntil = 0; }
    // thorns: a share of a blow taken at close quarters goes back into whoever struck it (not into a caster's bolt)
    if (gift(h, 'thorns') && e.deadT < 0 && Math.hypot(e.x - h.x, e.y - h.y) < 150) SIMX.hitEnemy(S, R, e, Math.max(1, Math.round(h.lastHit * gift(h, 'thorns') / 100)), 0, h.x, h.y, 0, 'thorns');
    if (!e.mods) return;
    if (has(e, 'fiery')) { if (h.burn <= S.t) { h.burnT = S.t - 0.5; ev(S, { k: 'ignite', x: h.x, y: h.y }); } h.burn = Math.max(h.burn, S.t + MOD.fiery.burn); }   // a fresh blow only extends the fire, the ticks keep their pace
    if (has(e, 'frost')) { h.chillT = S.t + MOD.frost.t; ev(S, { k: 'chill', x: h.x, y: h.y - 40, id: e.id }); }
    if (has(e, 'curse')) { h.curseT = S.t + MOD.curse.t; ev(S, { k: 'curse', x: h.x, y: h.y - 40, id: e.id }); }
    if (has(e, 'vampire') && e.deadT < 0) { const n = Math.round(e.max * MOD.vampire.heal); e.hp = Math.min(e.max, e.hp + n);
      ev(S, { k: 'drain', x: h.x, y: h.y - 40, tx: e.x, ty: e.y - ENEMIES[e.type].h * 0.5, n, id: e.id }); }
  }
  // plain skeletons of the floor's strength around a summoner, never more than its cap of its own alive at once
  function raise(S, R, e) { const M = MOD.summoner, sk = ENEMIES.skeleton, f = dep(R), own = R.en.filter((o) => o.summ === e.id && o.deadT < 0).length;
    for (let i = 0; i < Math.min(M.n, M.cap - own); i++) { const a = rnd(R) * 6.28, x = e.x + Math.cos(a) * 70, y = e.y + Math.sin(a) * 50; if (solidAt(R.map, x, y, true)) continue;
      const hp = Math.round(sk.hp * BAL.hp * dif(R, 'hp') * D.hpAt(f));
      R.en.push({ id: R.nextId++, type: 'skeleton', x, y, vx: 0, vy: 0, hp, max: hp, dmg: sk.dmg * BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob, elite: 0, room: e.room, st: 'chase', t0: S.t, face: 1, aimA: 0,
        cdT: S.t + 1, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: e.id, spawnT: S.t, seenT: S.t });
      ev(S, { k: 'summon', x, y }); } }
  // a blinking elite (TASKS 387): to the hero's side facing it, onto open floor, with a puff where it left and where it lands
  function blink(S, R, e) { const M = MOD.blink, h = R.hero, E = ENEMIES[e.type], d = Math.hypot(h.x - e.x, h.y - e.y);
    if (d < M.min || d > M.max || !losClear(R.map, e.x, e.y - 10, h.x, h.y - 10)) return false;
    const a0 = Math.atan2(e.y - h.y, e.x - h.x);
    for (const da of [0, 0.6, -0.6, 1.2, -1.2]) { const x = h.x + Math.cos(a0 + da) * M.gap, y = h.y + Math.sin(a0 + da) * M.gap;
      if (boxHit(R.map, x, y, E.r, true, false) || !losClear(R.map, x, y - 10, h.x, h.y - 10)) continue;
      ev(S, { k: 'blink', x: e.x, y: e.y, tx: x, ty: y, id: e.id }); e.x = x; e.y = y; e.vx = e.vy = 0; e.face = h.x >= x ? 1 : -1; e.cdT = Math.max(e.cdT, S.t + M.calm); return true; }
    return false; }
  // ---------------- the cave's monsters (TASKS 307, 308) ----------------
  function rise(S, R, e) { e.st = 'rise'; e.t0 = S.t; e.face = R.hero.x >= e.x ? 1 : -1; ev(S, { k: 'rise', x: e.x, y: e.y, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.15); }
  // the grab's reach plays whatever it meets; a hero inside its reach and arc is drawn a step toward the drowned (a dash slips it)
  function grab(S, R, e) {
    const E = ENEMIES[e.type], G0 = E.grab, h = R.hero, dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy) || 1; e.grabT = S.t + G0.cd;
    ev(S, { k: 'grab', x: e.x, y: e.y, a: e.aimA, id: e.id });
    if (h.deadT >= 0 || d > E.r + K.R + G0.reach + 12 || Math.abs(angDiff(Math.atan2(-dy, -dx), e.aimA)) > G0.arc || !losClear(R.map, e.x, e.y - 20, h.x, h.y - 20)) return;
    if (S.t - h.dashT < BAL.dodge.t) { ev(S, { k: 'dodge', x: h.x, y: h.y, dash: 1 }); return; }
    const n = Math.min(G0.pull, d - (E.r + K.R + 4)); if (n <= 0) return;
    h.pull = { x: dx / d, y: dy / d, n, T: G0.t, done: 0 }; e.gotT = S.t; ev(S, { k: 'grabbed', x: h.x, y: h.y - 30, id: e.id });
  }
  // a hop lands against where the hero stood at take-off (body to body), no farther than its reach, eased out of the squat and into the landing
  // (the render's squash and stretch carry the jolt); the blow is on landing
  const SS01 = (q) => q * q * (3 - 2 * q);
  function takeOff(R, e, E) { const h = R.hero, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1, n = Math.max(0, Math.min(d - (E.r + K.R + 6), E.r + K.R + E.reach + 10));
    e.jx = e.x; e.jy = e.y; e.jtx = e.x + dx / d * n; e.jty = e.y + dy / d * n; e.aimA = Math.atan2(dy, dx); e.hitDone = 0; }
  function hop(S, R, e, E) { const u = S.t - e.t0, T = E.jump.t, h = R.hero;
    if (!e.hitDone) { const q = SS01(Math.min(1, u / T)), x = e.jx + (e.jtx - e.jx) * q, y = e.jy + (e.jty - e.jy) * q, ox = e.x, oy = e.y;
      move(R.map, e, x - e.x, y - e.y, E.r, true); e.vx = (e.jtx - e.jx) / T; e.vy = (e.jty - e.jy) / T; e.dist += Math.hypot(e.x - ox, e.y - oy);
      if (q >= 1) { e.hitDone = 1; e.vx = e.vy = 0; ev(S, { k: 'land', x: e.x, y: e.y, id: e.id, type: e.type });
        if (h.deadT < 0 && Math.hypot(h.x - e.x, h.y - e.y) < E.r + K.R + 8) { SIMX.hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } } }
    else skid(R.map, e, E); }
  // a slime bursts in two small ones flung apart from the killing blow; they join the fight at once
  function split(S, R, e, E) { const f = dep(R), Es = ENEMIES[E.split], hp = Math.round(Es.hp * BAL.hp * dif(R, 'hp') * D.hpAt(f)), a0 = e.dieA ?? 0;
    for (const sd of [-1, 1]) { const a = a0 + sd * 1.1, x = e.x + Math.cos(a) * 8, y = e.y + Math.sin(a) * 6;
      R.en.push({ id: R.nextId++, type: E.split, x, y, vx: 0, vy: 0, hp, max: hp, dmg: Es.dmg * BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob, elite: 0, room: e.room, st: 'chase', t0: S.t, face: Math.cos(a) >= 0 ? 1 : -1, aimA: a,
        cdT: S.t + 0.9, hitT: -9, deadT: -1, dist: 0, kbx: Math.cos(a) * 200, kby: Math.sin(a) * 140, burn: 0, burnT: 0, summ: e.id, spawnT: S.t, seenT: S.t, hx: x, hy: y, ft: -9 }); }
    ev(S, { k: 'split', x: e.x, y: e.y, id: e.id }); }
  // the crab (TASKS 309) faces its own way, fa, turning toward what it wants at no more than E.turn rad/s; a blow from within the
  // armour's arc of its front is blunted. Before its first turn it faces the way its rig was mirrored
  const faOf = (e) => e.fa ?? (e.face > 0 ? 0 : Math.PI);
  // a heavy body: the turn gathers pace and eases out onto its mark (faV, rad/s), no snap into the full rate
  function crabTurn(e, E, a, k) { const f = faOf(e), top = E.turn * eliteK(e, 'spd') * k, d = angDiff(a, f), want = Math.max(-top, Math.min(top, d * 5)), acc = 8 * DT;
    e.faV = (e.faV || 0) + Math.max(-acc, Math.min(acc, want - (e.faV || 0))); e.fa = angDiff(f + e.faV * DT, 0); e.face = Math.cos(e.fa) >= 0 ? 1 : -1; }
  const armored = (e, E, x, y) => !!E.armor && Math.hypot(x - e.x, y - e.y) > 1 && Math.abs(angDiff(Math.atan2(y - e.y, x - e.x), faOf(e))) < E.armor.arc;
  // ---------------- the eel from the deep (TASKS 310) ----------------
  // its water: the deep cells (6) joined to its post's, cached per map (deep water never changes)
  const DEEPW = new WeakMap();
  function deepBody(m, e) { let c = DEEPW.get(m); if (!c) DEEPW.set(m, c = new Map()); const k0 = Math.floor(e.hy / TILE) * m.W + Math.floor(e.hx / TILE);
    let b = c.get(k0); if (b) return b; b = [];
    if (m.cells[k0] === 6) { const seen = new Set([k0]), q = [k0]; while (q.length) { const k = q.pop(); b.push(k); for (const dd of [1, -1, m.W, -m.W]) { const n = k + dd; if (m.cells[n] === 6 && !seen.has(n)) { seen.add(n); q.push(n); } } } }
    c.set(k0, b); return b; }
  // where it comes up: a cell of its water by the hero, in sight of him, `apart` cells from the last spot (or, with none so far
  // off, any other); within a bite if it can, else among the nearest from which the jet reaches him
  function eelSpot(R, e, E, apart = E.apart) { const m = R.map, h = R.hero, bite = E.r + K.R + E.reach - 8, close = [], far = [];
    for (const k of deepBody(m, e)) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE, d = Math.hypot(h.x - x, h.y - y);
      if (d < E.r + K.R + 10 || d > E.spit.reach - 20 || (e.lx !== undefined && Math.hypot(x - e.lx, y - e.ly) < apart * TILE) || !losClear(m, x, y - 10, h.x, h.y - 10)) continue;
      (d <= bite ? close : far).push([x, y, d]); }
    if (close.length) return close[Math.floor(rnd(R) * close.length)];
    far.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]); return far.length ? far[Math.floor(rnd(R) * Math.min(3, far.length))] : apart > 1 ? eelSpot(R, e, E, 1) : null; }
  // deep → stir (bubbles and its shadow where it will come up) → rise → chase (up, turning to the hero) ⇄ wind → strike → dive → deep
  function eel(S, R, e, E, heroOk, d) {
    const m = R.map, h = R.hero, t = S.t, u = t - e.t0, dx = h.x - e.x, dy = h.y - e.y; e.vx = e.vy = 0;
    const hunt = heroOk && Math.hypot(h.x - e.hx, h.y - e.hy) < E.sense + 6 * TILE;
    if (e.st === 'deep') { if (!hunt || t < e.cdT) return;
      const p = eelSpot(R, e, E); if (!p) return; e.x = p[0]; e.y = p[1]; e.st = 'stir'; e.t0 = t; e.face = h.x >= e.x ? 1 : -1; ev(S, { k: 'stir', x: e.x, y: e.y, id: e.id }); return; }
    if (e.st === 'stir') { if (u >= windOf(e, E.warn)) { rise(S, R, e); e.bit = 0; } return; }
    if (e.st === 'dive') { if (u >= E.dive) { e.st = 'deep'; e.t0 = t; e.lx = e.x; e.ly = e.y; e.cdT = t + E.swim[0] + (E.swim[1] - E.swim[0]) * rnd(R); } return; }
    const dive = () => { e.st = 'dive'; e.t0 = t; ev(S, { k: 'dive', x: e.x, y: e.y, id: e.id }); };
    if (e.st === 'rise') { if (u < E.rise) return; e.st = 'chase'; e.t0 = e.upT = t; e.cdT = Math.max(e.cdT, t + 0.15); return; }
    if (!heroOk) { if (e.st === 'chase') dive(); return; }
    if (e.st === 'chase') { if (Math.abs(dx) > 10) e.face = dx > 0 ? 1 : -1;
      if (e.bit >= E.bites || t - e.upT > E.stay) { dive(); return; }
      if (t < e.cdT) return;
      const near = d < E.r + K.R + E.reach, los = losClear(m, e.x, e.y - 30, h.x, h.y - 30);
      if (near || (d < E.spit.reach && los)) { e.st = 'wind'; e.t0 = t; e.spit = near ? 0 : 1; e.tx = h.x; e.ty = h.y; e.face = dx >= 0 ? 1 : -1; e.aimA = e.spit ? Math.atan2(h.y - 38 - (e.y - EEL_MOUTH[1]), h.x - e.x - e.face * EEL_MOUTH[0]) : Math.atan2(dy, dx); }
      return; }
    if (e.st === 'wind') { if (u < windOf(e, e.spit ? E.spit.wind : E.wind)) return; e.st = 'strike'; e.t0 = t; e.bit++;
      if (e.spit) { const a = e.aimA, v = E.spit.spd;
        R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: 'jet', x: e.x + e.face * EEL_MOUTH[0], y: e.y - EEL_MOUTH[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: t, life: (E.spit.reach + 40) / v, dmg: e.dmg * E.spit.dmg * eliteK(e, 'bolt'), own: 'en', r: 7, gz: EEL_MOUTH[1] - 20 });
        ev(S, { k: 'spit', x: e.x + e.face * EEL_MOUTH[0], y: e.y - EEL_MOUTH[1], a, id: e.id }); return; }
      if (d < E.r + K.R + E.reach * 1.25 && Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)) < 1.0) { SIMX.hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); }
      ev(S, { k: 'bite', x: e.x + Math.cos(e.aimA) * (E.r + 26), y: e.y + Math.sin(e.aimA) * (E.r + 26) * 0.8, a: e.aimA, id: e.id }); return; }
    if (e.st === 'strike') { if (u < 0.4) return; e.st = 'chase'; e.t0 = t; e.cdT = t + E.cd * eliteK(e, 'cd') * (0.8 + 0.4 * rnd(R)); } }
  const SERPENT_MOUTH = [50, 92];
  const serpentMouth = (e) => [e.x + (e.face || 1) * SERPENT_MOUTH[0], e.y - SERPENT_MOUTH[1]];
  function serpentSurface(S, R, e) {
    const m = R.map, h = R.hero, old = e.pool ?? -1;
    let best = null;
    for (const [i, pool] of m.serpentPools.entries()) { if (i === old) continue;
      for (const k of pool) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE, d = Math.hypot(x - h.x, y - h.y);
        if (!best || d < best.d) best = { x, y, i, d }; } }
    if (!best) return;
    e.pool = best.i; e.x = best.x; e.y = best.y; e.face = h.x >= e.x ? 1 : -1; e.st = 'stir'; e.t0 = S.t; e.vx = e.vy = 0;
    ev(S, { k: 'stir', x: e.x, y: e.y, id: e.id });
  }
  // the shallows spread from the lakes over 1.6 s, the nearest shore first, so the flood has a front (TASKS 326)
  function floodStep(S, R) {
    const m = R.map, F = m.flood; if (!F || F.n >= F.cells.length) return;
    const n = Math.min(F.cells.length, 1 + Math.floor(F.cells.length * Math.min(1, (S.t - F.t0) / 1.6))); if (n === F.n) return;
    const add = F.cells.slice(F.n, n); F.n = n; m.water.push(...add); m.arenaWater.push(...add); WET.delete(m); m.geometry = (m.geometry || 0) + 1;
  }
  function serpentFlood(S, R, e) {
    const m = R.map, pools = m.serpentPools.flat(), near = (k) => Math.min(...pools.map((q) => Math.hypot(q % m.W - k % m.W, Math.floor(q / m.W) - Math.floor(k / m.W))));
    const cells = m.floodCells.filter((k) => m.cells[k] === 1 && !m.water.includes(k) && !m.block.includes(k)).map((k) => [near(k), k]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((q) => q[1]);
    m.arenaWater = []; m.flood = { cells, t0: S.t, n: 0 }; e.floodT = S.t;
    const r = m.rooms[e.room], sol = SIMX.solids(R), E = ENEMIES.drowned, spots = [];
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const p = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
      if (Math.hypot(p.x - R.hero.x, p.y - R.hero.y) >= 80 && !boxHit(m, p.x, p.y, E.r, true, false) && !sol.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < E.r + o.r)) spots.push(p);
    }
    spots.sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));
    const chosen = [];
    for (const p of spots) { if (chosen.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 64)) continue;
      SIMX.bossSummon(S, R, { ...e, x: p.x, y: p.y }, { type: 'drowned', n: 1, cap: 2, hp: 2.5, dmg: 2.2, r: 0, delay: 1 }); chosen.push(p); if (chosen.length === 2) break;
    }
    ev(S, { k: 'flood', x: e.x, y: e.y, id: e.id });
  }
  function serpent(S, R, e, heroOk) {
    if (!R.arena?.active || !heroOk) return;
    const B = D.BOSSES[e.type], t = S.t, h = R.hero, u = t - e.t0;
    e.vx = e.vy = 0;
    if (e.floodAt && t >= e.floodAt) { e.floodAt = 0; serpentFlood(S, R, e); }
    floodStep(S, R);
    if (!e.phase && e.hp <= e.max * B.phases[1].at && e.st !== 'bwind') {
      e.phase = 1; e.floodAt = t + 1.2; R.msg = { s: TXT('sim_enemies.serpent.msg.s'), t, d: 3 };
      R.trauma = Math.min(1, R.trauma + 0.28);
      ev(S, { k: 'bossphase', id: e.id, phase: 1 }); ev(S, { k: 'floodwarn', x: e.x, y: e.y });
    }
    if (e.st === 'deep') { if (t >= e.cdT) serpentSurface(S, R, e); return; }
    if (e.st === 'stir') { if (u >= B.warn) { e.st = 'rise'; e.t0 = t; ev(S, { k: 'rise', x: e.x, y: e.y, id: e.id }); } return; }
    if (e.st === 'rise') { if (u >= B.rise) { e.st = 'chase'; e.t0 = t; e.cdT = t + 0.35; e.bit = 0; } return; }
    if (e.st === 'dive') { if (u >= B.dive) { e.st = 'deep'; e.t0 = t; e.cdT = t + B.swim; } return; }
    if (e.st === 'recover') { if (t >= e.cdT) { if (e.bit >= 2) { e.st = 'dive'; e.t0 = t; ev(S, { k: 'dive', x: e.x, y: e.y, id: e.id }); }
        else { e.st = 'chase'; e.t0 = t; } } return; }
    if (e.st === 'chase') {
      if (t < e.cdT) return;
      const moves = D.bossPhase(e).moves; let mv = moves[(e.moveI || 0) % moves.length]; e.moveI = (e.moveI || 0) + 1;
      if (mv === 'bite' && Math.hypot(h.x - e.x, h.y - e.y) > B.moves.bite.r + 35) mv = 'wave';
      SIMX.beginBossMove(S, R, e, mv); e.face = h.x >= e.x ? 1 : -1;
      const [mx, my] = serpentMouth(e);
      if (mv === 'fan') e.aimA = Math.atan2(h.y - 38 - my, h.x - mx);
      return;
    }
    if (e.st !== 'bwind') return;
    const M = D.bossMove(e);
    if (!e.fired && u >= M.wind) {
      e.fired = 1; e.bit++; e.hitDone = 0;
      if (e.mv === 'wave' || e.mv === 'fan') {
        const fan = e.mv === 'fan', [mx, my] = fan ? serpentMouth(e) : [e.x, e.y - 38], n = fan ? M.n : 1;
        for (let i = 0; i < n; i++) { const a = e.aimA + (fan ? (i / (n - 1) - 0.5) * M.spread * 2 : 0);
          R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: fan ? 'jet' : 'wave', kind: 'water', x: mx, y: my, vx: Math.cos(a) * M.speed, vy: Math.sin(a) * M.speed,
            t0: t, life: M.reach / M.speed, dmg: e.dmg * M.dmg, own: 'en', r: fan ? 8 : M.r, hitR: fan ? 22 : 34, gz: fan ? SERPENT_MOUTH[1] - 10 : 28, vol: e.id + ':' + t }); }
        ev(S, { k: fan ? 'spit' : 'wave', x: mx, y: my, a: e.aimA, id: e.id });
      } else {
        const d = Math.hypot(h.x - e.x, h.y - e.y), inArc = e.mv === 'tail' || Math.abs(angDiff(Math.atan2(h.y - e.y, h.x - e.x), e.aimA)) < M.arc;
        if (d < M.r + K.R && inArc && losClear(R.map, e.x, e.y, h.x, h.y)) { SIMX.hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); }
        ev(S, { k: e.mv === 'bite' ? 'bite' : 'tail', x: e.x, y: e.y, a: e.aimA, id: e.id, r: M.r });
      }
    }
    if (u >= M.wind + M.duration) { e.st = 'recover'; e.t0 = t; e.cdT = t + D.bossPhase(e).rest + (e.hitDone ? 0 : 0.65); e.openUntil = e.hitDone ? 0 : e.cdT; }
  }
  // an explosive elite's corpse bursts once its fuse burns down: the hero and the monsters in reach are hit. A smouldering
  // skeleton's blast (TASKS 411) is its own: each monster in it loses a share of its own health, and another smouldering one in it lights up
  // (a fuse is set off no sooner than BOOM_GAP after the last one lit, its ring told its true length, TASKS 1057: held back at the burst,
  // 36 % of blasts came after their ring was gone)
  const PROP_R = 17, LEAF = 10, BOOM_GAP = 0.35, fuseEnd = (R, want) => { const t = Math.max(want, (R.fuseLast ?? -9) + BOOM_GAP); R.fuseLast = t; return t; };
  function blast(S, R, e) { const B = ENEMIES[e.type].boom, M = B || MOD.explosive, h = R.hero; e.fuse = 0; R.boomT = S.t;
    if (h.deadT < 0 && Math.hypot(h.x - e.x, h.y - e.y) < M.r && losClear(R.map, e.x, e.y - 6, h.x, h.y - 6)) SIMX.hurtHero(S, R, e.dmg * M.dmg, e.x, e.y, undefined, who(e) + ' blast', e);
    for (const o of R.en) if (o !== e && o.deadT < 0 && Math.hypot(o.x - e.x, o.y - e.y) < M.r + ENEMIES[o.type].r) { if (ENEMIES[o.type].boom) fuse(S, R, o);
      SIMX.hitEnemy(S, R, o, Math.max(1, Math.round(B ? o.max * B.mon : e.max * 0.25)), false, e.x, e.y, 1.5); }
    SIMX.breakPots(S, R, e.x, e.y, M.r); ev(S, { k: 'boom', x: e.x, y: e.y - 20, big: 1, r: M.r }); R.trauma = Math.min(1, R.trauma + 0.5); }
  // a smouldering skeleton lights its fuse: it stands hissing through the wind-up and bursts at its end (stepMonsters)
  function fuse(S, R, e) { const E = ENEMIES[e.type]; if (e.st === 'wind' || e.deadT >= 0) return; const d = windOf(e, E.wind);
    e.st = 'wind'; e.t0 = S.t; e.fuse = fuseEnd(R, S.t + d); e.aimA = Math.atan2(R.hero.y - e.y, R.hero.x - e.x); ev(S, { k: 'fuse', x: e.x, y: e.y, r: E.boom.r, d: e.fuse - S.t, id: e.id, lit: 1 }); }

  // ---------------- the imp (TASKS 407) ----------------
  // a spot to leap to: open floor (no crust) within its leap, in sight of the hero and away from him, free of the others and the vents.
  // across: the way round to it on foot is long or none (F, the hero's flow field), so he can't walk up to it
  function impSpot(R, e, E, F, flee) {
    const m = R.map, h = R.hero, L0 = E.leap, dh0 = Math.hypot(h.x - e.x, h.y - e.y), tx0 = Math.floor(e.x / TILE), ty0 = Math.floor(e.y / TILE), n = Math.ceil(L0.far / TILE), mid = (E.keep[0] + E.keep[1]) / 2, sol = SIMX.solids(R);
    let best = null;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const tx = tx0 + i, ty = ty0 + j, k = ty * m.W + tx;
      if (cell(m, tx, ty) !== 1) continue; const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE + 4, dl = Math.hypot(x - e.x, y - e.y);
      if (dl < L0.near || dl > L0.far) continue; const dh = Math.hypot(h.x - x, h.y - y);
      if (dh < E.flee + 30 || (flee && dh < dh0 + 50) || !losClear(m, e.x, e.y - 6, x, y - 6) || !losClear(m, x, y - 30, h.x, h.y - 30)) continue;
      if (R.en.some((o) => o !== e && o.deadT < 0 && Math.hypot((o.st === 'leap' ? o.ltx : o.x) - x, (o.st === 'leap' ? o.lty : o.y) - y) < 26) || (m.hazards || []).some((z) => D.hazIn(z, x, y))) continue;
      // (not into a prop: landed in a brazier, it was shoved out of it in one frame)
      if (sol.some((o) => Math.hypot(x - o.x, (y - o.y) * 1.6) < o.r + E.r + 4)) continue;
      const f = F[k], across = f < 0 || f * TILE > 1.6 * dh + 2 * TILE, sc = Math.abs(dh - mid) - (across ? 160 : 0) + 0.15 * dl + ((e.id * 7919 + k * 104729) % 97) / 5;
      if (!best || sc < best[0]) best = [sc, x, y, across]; }
    return best;
  }
  const acrossFrom = (R, e, F) => { const m = R.map, h = R.hero, f = F[Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE)]; return f < 0 || f * TILE > 1.6 * Math.hypot(h.x - e.x, h.y - e.y) + 2 * TILE; };
  // a leap: a crouch, the flight in a line over whatever lies between (its arc is the render's), a landing crouch
  // (the walk it springs from eases out in the render, spd0 as a boss's move cuts it: zeroed in a frame, the arms' swing snapped)
  function leap(S, R, e, E, x, y) { const d = Math.hypot(x - e.x, y - e.y), sp = Math.hypot(e.vx, e.vy); e.spd0 = sp; e.vxn0 = sp > 1 ? e.vx / sp : 1; e.vyn0 = sp > 1 ? e.vy / sp : 0; Object.assign(e, { st: 'leap', t0: S.t, lx: e.x, ly: e.y, ltx: x, lty: y, ld: 0.16 + d / E.leap.spd, vx: 0, vy: 0, kbx: 0, kby: 0 });
    // it springs back from the hero facing him, its eyes on him; elsewhere it faces where it leaps
    const h = R.hero, back = Math.hypot(h.x - x, h.y - y) > Math.hypot(h.x - e.lx, h.y - e.ly) && Math.hypot(h.x - e.lx, h.y - e.ly) < E.flee + 20;
    e.face = back ? (h.x >= e.x ? 1 : -1) : x >= e.x ? 1 : -1; e.aimA = Math.atan2(y - e.y, x - e.x); ev(S, { k: 'leap', x: e.x, y: e.y, id: e.id }); }
  // (a body in flight keeps its speed, TASKS 489: eased all along it, it went 2.7× faster at the middle than near the ends; its speed
  // ramps up over the first fifth and down over the last, so the take-off and the landing don't jolt)
  // (its first steps off the landing ease in from a standstill: spd0 0)
  const leapQ = (f) => (f < 0.2 ? 3.125 * f * f : f > 0.8 ? 1 - 3.125 * (1 - f) * (1 - f) : 0.125 + 1.25 * (f - 0.2));
  function leapStep(S, R, e, E) { const L0 = E.leap, u = S.t - e.t0, f = Math.max(0, Math.min(1, (u - L0.crouch) / e.ld)), q = leapQ(f);
    e.x = e.lx + (e.ltx - e.lx) * q; e.y = e.ly + (e.lty - e.ly) * q; e.vx = e.vy = e.kbx = e.kby = 0;
    if (q >= 1 && !e.landed) { e.landed = 1; ev(S, { k: 'land', x: e.x, y: e.y, id: e.id }); }
    if (u >= L0.crouch + e.ld + L0.land) { e.st = 'chase'; e.t0 = e.seenT = S.t; e.landed = 0; e.spd0 = 0; e.vxn0 = 1; e.vyn0 = 0; e.leapT = S.t + L0.cd * (0.8 + 0.4 * rnd(R)) / eliteK(e, 'spd'); } }
  // its turn in the chase: true when it began a leap or an attack
  function impThink(S, R, e, E, F, d, dx, dy) {
    const m = R.map, h = R.hero, t = S.t, ready = t >= (e.leapT ?? 0), k = Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE);
    if (cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) !== 1) { const [x, y] = SIMX.landOf(m, e.x, e.y); leap(S, R, e, E, x, y); return true; }   // knocked onto lava or crust
    if (d < E.flee && ready) { const s = impSpot(R, e, E, F, 1); if (s) { leap(S, R, e, E, s[1], s[2]); return true; } }
    if (d < E.r + K.R + E.reach && t >= e.cdT) { Object.assign(e, { st: 'wind', t0: t, claw: 1, tx: h.x, ty: h.y, aimA: Math.atan2(dy, dx) }); return true; }
    const los = losClear(m, e.x, e.y - 30, h.x, h.y - 30);
    if (los && d >= E.flee && d < E.spark.reach && t >= e.cdT) { Object.assign(e, { st: 'wind', t0: t, claw: 0, aimA: Math.atan2(h.y - 38 - (e.y - IMP_Y), h.x - e.x) }); return true; }
    // every few seconds it looks for a better spot: across from him, or in sight and in range when it has neither
    if (ready && t >= (e.lookT ?? 0)) { e.lookT = t + E.leap.look; const s = impSpot(R, e, E, F, 0), far = !los || d > E.keep[1] + 30;
      if (s && ((s[3] && !acrossFrom(R, e, F)) || far)) { leap(S, R, e, E, s[1], s[2]); return true; } }
    steer(e, E, m, F, d < E.keep[0] ? -1 : d > E.keep[1] || !los ? 1 : 0, dx, dy, d, d < E.keep[0] ? 0.9 : 1); void k;
    return false;
  }
  const IMP_Y = 32;   // the spark leaves its hand this far over its feet

  // ---------------- the lava salamander (TASKS 408) ----------------
  // the floor's lava and land as one field from a tile (the salamander's way to the hero: swimming is walking for it), cached as flow is
  const LFLOW = { key: '', d: null };
  function lavaFlow(m, tx, ty) {
    const key = m.seed + ':' + m.floor + ':' + tx + ',' + ty + ':' + doorKey(m); if (LFLOW.key === key) return LFLOW.d;
    const d = new Int16Array(m.W * m.H).fill(-1), q = [ty * m.W + tx]; d[q[0]] = 0; const blk = new Set(m.block || []);
    for (let i = 0; i < q.length; i++) { const k = q[i]; if (d[k] > 60) continue; for (const o of [1, -1, m.W, -m.W]) { const j = k + o; if (d[j] >= 0 || blk.has(j) || (m.cells[j] !== 1 && m.cells[j] !== 3)) continue; d[j] = d[k] + 1; q.push(j); } }
    LFLOW.key = key; LFLOW.d = d; return d;
  }
  // how many cells each floor cell lies from the lava, cached per map (lava doesn't move; crust counts as lava)
  const LDIST = new WeakMap();
  function lavaDist(m) { let d = LDIST.get(m); if (d) return d; d = new Int16Array(m.W * m.H).fill(-1); const q = [];
    for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 3) { d[k] = 0; q.push(k); }
    for (let i = 0; i < q.length; i++) { const k = q[i]; for (const o of [1, -1, m.W, -m.W]) { const j = k + o; if (j < 0 || j >= d.length || d[j] >= 0 || m.cells[j] !== 1) continue; d[j] = d[k] + 1; q.push(j); } }
    LDIST.set(m, d); return d; }
  const cellOf = (m, o) => Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE);
  // the open lava nearest it within n cells, its middle
  function lavaNear(m, e, n) { const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE); let best = null;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const x = tx + i, y = ty + j; if (cell(m, x, y) !== 3 || crustAt(m, y * m.W + x)) continue;
      let deep = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (cell(m, x + a, y + b) === 3) deep++;
      const dd = i * i + j * j - deep; if (!best || dd < best[2]) best = [(x + 0.5) * TILE, (y + 0.5) * TILE, dd]; }
    return best; }
  function salamThink(S, R, e, E, d, dx, dy) {
    const m = R.map, h = R.hero, t = S.t, B = E.breath, HL = E.heal, LD = lavaDist(m), here = LD[cellOf(m, e)], his = LD[cellOf(m, h)];
    crabTurn(e, E, Math.atan2(dy, dx), 1);
    if (e.hp < HL.at * e.max && t >= (e.healT ?? 0) && (e.heals || 0) < HL.times) { const p = lavaNear(m, e, 10); if (p) { Object.assign(e, { st: 'soak', t0: t, sx: p[0], sy: p[1], healT: t + HL.cd, soaked: 0, heals: (e.heals || 0) + 1 }); ev(S, { k: 'flee', x: e.x, y: e.y, id: e.id }); return true; } }
    const front = Math.abs(angDiff(Math.atan2(dy, dx), faOf(e)));
    if (d < E.r + K.R + E.reach && t >= e.cdT && front < 0.6) { Object.assign(e, { st: 'wind', t0: t, br: 0, tx: h.x, ty: h.y, aimA: faOf(e) }); return true; }
    if (d > E.r + K.R + B.near && d < B.reach + K.R && front < 0.35 && t >= e.cdT && t >= (e.brT ?? 0) && losClear(m, e.x, e.y - 6, h.x, h.y - 6)) { Object.assign(e, { st: 'wind', t0: t, br: 1, tx: h.x, ty: h.y, aimA: faOf(e) }); return true; }
    // on land it keeps within its tether of the lava: a hero farther in is breathed at from the edge
    const hold = here > 0 && his > E.tether && here >= E.tether - 1, F = lavaFlow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE));
    steer(e, E, m, F, hold || d < E.r + K.R + E.reach * 0.8 ? 0 : 1, dx, dy, d, onLava(m, e) ? E.swim : 1);
    return false;
  }
  // back into the lava to heal: it swims to the spot, then lies under, mending while nothing hurts it
  function soak(S, R, e, E) { const m = R.map, t = S.t, HL = E.heal, dx = e.sx - e.x, dy = e.sy - e.y, d = Math.hypot(dx, dy);
    crabTurn(e, E, d > 6 ? Math.atan2(dy, dx) : faOf(e), d > 6 ? 1 : 0.3);
    const sp = (d > 6 ? E.spd * (onLava(m, e) ? E.swim : 1) * eliteK(e, 'spd') * (e.slowK ?? 1) : 0) * SS01(Math.min(1, d / 24)), k = 1 - Math.exp(-9 * DT);
    e.vx += ((d > 0.01 ? dx / d : 0) * sp - e.vx) * k; e.vy += ((d > 0.01 ? dy / d : 0) * sp - e.vy) * k;
    move(m, e, e.vx * DT, e.vy * DT, E.r, true, true); e.dist += Math.hypot(e.vx, e.vy) * DT;
    if (!onLava(m, e)) { if (t - e.t0 > 5) { e.st = 'chase'; e.t0 = t; } return; }
    if (!e.soaked) { e.soaked = 1; e.soakT = t; ev(S, { k: 'submerge', x: e.x, y: e.y, id: e.id }); }
    if (t - e.hitT > HL.calm) e.hp = Math.min(e.max, e.hp + HL.rate * e.max * DT);
    if (e.hp >= HL.to * e.max || t - e.soakT > HL.most) { e.st = 'chase'; e.t0 = e.seenT = t; e.soaked = 0; e.cdT = t + 0.4; ev(S, { k: 'emerge', x: e.x, y: e.y, id: e.id }); } }
  // its fire on the floor: the trail of its belly on land and the patches its breath leaves, a golem's pool of lava (TASKS 409).
  // Each burns a hero in it once it is `arm` s old (at once by default) and again every `per` s, and sets him alight
  // a chill already on keeps the harder of the two and the later end: a light one must not thin the frost that is holding a monster
  function chill(S, e, T, k) { const on = e.chillT > S.t; e.chillK = on ? Math.min(e.chillK ?? D.FROST.slow, k) : k; e.chillT = Math.max(on ? e.chillT : 0, S.t + T); e.slowK = e.chillK; }
  function addFire(R, S, x, y, o) { (R.fires = R.fires || []).push(Object.assign({ id: R.nextId++, x, y, t0: S.t }, o)); }
  function stepFires(S, R) { const h = R.hero, t = S.t;
    for (const p of R.fires) { if (p.own === 'hero') { if (t - p.t0 < p.t && t >= (p.hitT ?? -9) + p.per) { p.hitT = t; for (const e of R.en) if (e.deadT < 0 && !under(e) && Math.hypot(e.x - p.x, (e.y - p.y) / p.ry) < p.r + ENEMIES[e.type].r * 0.6) SIMX.hitEnemy(S, R, e, p.dmg, false, p.x, p.y, 0, 'burn'); } continue; }
      if (t - p.t0 >= p.t || t - p.t0 < (p.arm || 0) || h.deadT >= 0 || Math.hypot(h.x - p.x, (h.y - p.y) / p.ry) >= p.r + K.R * 0.5 || t < (p.hitT ?? -9) + p.per) continue;
      if (t - h.dashT < BAL.dodge.t && p.kind !== 'pool') continue;
      p.hitT = t; SIMX.hurtHero(S, R, p.dmg, p.x, p.y - 6, 'fire', p.who + (p.kind === 'pool' ? ' pool' : ' fire'), R.en.find((o) => o.id === p.src)); }
    R.fires = R.fires.filter((p) => t - p.t0 < p.t); }
  function breathFire(S, R, e, E) { const B = E.breath, a = e.aimA;
    for (const q of [0.35, 0.65, 0.95]) { const x = e.x + Math.cos(a) * (E.r + B.reach * q), y = e.y + Math.sin(a) * (E.r + B.reach * q) * 0.8;
      if (cell(R.map, Math.floor(x / TILE), Math.floor(y / TILE)) === 1) addFire(R, S, x, y, { src: e.id, who: who(e), r: E.trail.r * (0.9 + 0.5 * q), ry: E.trail.ry, t: E.trail.t, dmg: e.dmg * E.trail.dmg, per: E.trail.per, kind: 'breath' }); } }

  const projWall = (m, x0, y0, x1, y1, gz) => { const cx = Math.floor(x0 / TILE), cy = Math.floor((y0 + gz) / TILE), nx = Math.floor(x1 / TILE), ny = Math.floor((y1 + gz) / TILE), pc = cell(m, nx, ny);
    return pc === 0 || pc === 4 || pc === 5 || pinch(m, cx, cy, nx, ny); };
  const projCover = (m, x, y) => m.decor.some((d) => d.cover && !d.broken && Math.abs(x - d.x) < 26 && y > d.y - 75 && y < d.y + 8);
  // how far a shot fired now would fly before a wall or a cover stops it: the serpent's warnings end where its water really does
  function flightReach(m, x, y, a, speed, life, gz) { const vx = Math.cos(a) * speed * DT, vy = Math.sin(a) * speed * DT, n = Math.ceil(life / DT);
    for (let i = 1; i <= n; i++) { const x1 = x + vx, y1 = y + vy; if (projWall(m, x, y, x1, y1, gz) || projCover(m, x1, y1)) return (i - 1) * speed * DT; x = x1; y = y1; }
    return n * speed * DT; }
  function stepProjectiles(S, R) {
    const m = R.map, h = R.hero;
    for (const p of R.proj) { if (p.dead) continue;
      // gz: how far over its floor it flies (an eel's jet leaves its mouth high over the water)
      const gz = p.gz ?? 20, x0 = p.x, y0 = p.y;
      p.x += p.vx * DT; p.y += p.vy * DT; const age = S.t - p.t0;
      const pc = cell(m, Math.floor(p.x / TILE), Math.floor((p.y + gz) / TILE)), wall = projWall(m, x0, y0, p.x, p.y, gz);
      if (p.own === 'hero' && p.k === 'arrow') SIMX.arrowWebs(S, R, p.x, p.y + gz);
      if (pc === 5 && p.own === 'hero') { const d = SIMX.doorAt(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)); if (d) SIMX.openDoor(S, R, d, 1); }
      let boom = wall || age > p.life || projCover(m, p.x, p.y);
      let touched = null;
      if (p.own === 'hero' && R.town) SIMX.hitFolk(S, R, p.x, p.y + gz, p.r + 6);
      if (p.own === 'hero') { for (const e of R.en) if (e.deadT < 0 && !under(e) && !(p.past && p.past.includes(e.id)) && Math.hypot(e.x - p.x, e.y - ENEMIES[e.type].h * 0.45 - p.y) < ENEMIES[e.type].r + p.r + 6) { boom = true; touched = e; break; } }
      else if (h.deadT < 0 && Math.hypot(h.x - p.x, h.y - 38 - p.y) < (p.hitR || 20)) { if (!p.spent) SIMX.hurtHero(S, R, p.dmg, p.x, p.y, p.kind || p.k, (p.who || '?') + ' bolt', R.en.find((o) => o.id === (p.src || p.actorId))); if (p.vol) { R.volHit = p.vol; for (const q of R.proj) if (q.vol === p.vol) q.spent = 1; } struck(S, R, p.src && R.en.find((o) => o.id === p.src)); boom = true; p.onHero = 1; }
      // a crossbow's bolt (TASKS 1163) goes through the first it strikes and on to the next
      if (touched && p.pierce > 0 && !wall && age <= p.life) { p.pierce--; (p.past = p.past || []).push(touched.id);
        SIMX.heroHit(S, R, touched, p.dmg, !!p.crit, p.x, p.y, p.kb ?? D.BOLT.kb, p.k === 'fire' ? 'fire' : undefined, p.x, p.y + ENEMIES[touched.type].h * 0.45);
        if (p.mpGain) R.hero.mp = Math.min(SIMX.heroSt(S).maxMp, R.hero.mp + p.mpGain); if (touched.deadT < 0) hush(S, R, touched); ev(S, { k: 'pop', x: p.x, y: p.y, c: p.k, hit: 1, mine: 1, thru: 1 }); touched = null; boom = projCover(m, p.x, p.y); }
      if (boom) { p.dead = 1;
        // the blast spreads from the last open cell: the one it flew into may be the wall itself
        // a staff's bolt (TASKS 1110) strikes the one it touched, no blast; at a wall it chips pots and props where it bursts
        if (p.own === 'hero' && p.single) { const bx = p.x - p.vx * DT, by = p.y + 20 - p.vy * DT;
          if (touched) SIMX.heroHit(S, R, touched, p.dmg, !!p.crit, p.x, p.y, p.kb ?? D.BOLT.kb, undefined, p.x, p.y + ENEMIES[touched.type].h * 0.45);
          if (touched && p.mpGain) R.hero.mp = Math.min(SIMX.heroSt(S).maxMp, R.hero.mp + p.mpGain);
          if (touched && touched.deadT < 0) hush(S, R, touched);
          else { SIMX.breakPots(S, R, bx, by, 24); SIMX.hitProps(S, R, bx, by, 24); }
          ev(S, { k: 'pop', x: p.x, y: p.y, c: p.k, hit: touched ? 1 : 0, mine: 1 }); }
        else if (p.own === 'hero') { const bx = p.x - p.vx * DT, by = p.y + 20 - p.vy * DT;
          for (const e of R.en) if (e.deadT < 0 && Math.hypot(e.x - p.x, (e.y - ENEMIES[e.type].h * 0.4 - p.y) * 1.2) < 66 + ENEMIES[e.type].r && losClear(m, bx, by, e.x, e.y)) SIMX.heroHit(S, R, e, p.dmg, !!p.crit, p.x, p.y, 1.2, 'fire', p.x, p.y + ENEMIES[e.type].h * 0.45);
          SIMX.breakPots(S, R, bx, by, 50); SIMX.hitProps(S, R, bx, by, 50); SIMX.tearWebs(S, R, bx, by - 20, 66, undefined, undefined, 1); ev(S, { k: 'boom', x: p.x, y: p.y, gx: bx, gy: by }); R.trauma = Math.min(1, R.trauma + 0.2); }
        else ev(S, { k: 'pop', x: p.x, y: p.y, c: p.k, hero: p.onHero || 0 }); } }
    R.proj = R.proj.filter((p) => !p.dead);
  }
  function hush(S, R, e) { const U = D.HUSH, t = S.t;
    if (e.st !== 'wind' || e.kin || e.grab || D.BOSSES[e.type] || !U.kinds.includes(ENEMIES[e.type].kind) || t < (e.hushT ?? 0)) return;
    e.st = 'chase'; e.t0 = t; e.cdT = Math.max(e.cdT || 0, t + U.cd); e.hushT = t + U.every; ev(S, { k: 'hush', x: e.x, y: e.y - ENEMIES[e.type].h * 0.8, id: e.id }); }
  function stepMonsters(S, R, live) {
    const m = R.map, h = R.hero, t = S.t, htx = Math.floor(h.x / TILE), hty = Math.floor(h.y / TILE), F = flow(m, htx, hty), heroOk = live && h.deadT < 0;
    for (const e of R.en) {
      const E = ENEMIES[e.type];
      // (one blast at least BOOM_GAP after the last, TASKS 1051: a neighbour's set off by it burst at once, 3 in 1.3 s, 2 on one tick)
      if (e.deadT >= 0) { if (e.fuse && t >= e.fuse) { if (t >= (R.boomT ?? -9) && t - (R.boomT ?? -9) < BOOM_GAP) { e.fuse = R.boomT + BOOM_GAP; ev(S, { k: 'fuse', x: e.x, y: e.y, r: (ENEMIES[e.type].boom || MOD.explosive).r, d: e.fuse - t, id: e.id }); } else blast(S, R, e); } continue; }
      // the ice wave's chill (TASKS 1110) slows its walk and run (toward, steer, soak) until it thaws
      // and the archer's trap holds it where it stands (TASKS 1120)
      if (e.chillT !== undefined || e.rootT !== undefined) e.slowK = e.rootT > t ? 0 : e.chillT > t ? e.chillK ?? D.FROST.slow : 1;
      // (and its blows, TASKS 1154: the wave only slowed the walk, a monster already at arm's length struck as often; a boss keeps its moves)
      if (e.chillT !== undefined && !D.BOSSES[e.type]) { const ck = e.chillK ?? D.FROST.slow; e.cold = e.chillT > t ? 1 / ck : 0; if (e.cold && e.cdT > t) e.cdT += DT * (1 - ck); }
      if (e.burn > t && t - e.burnT >= 0.5) { e.burnT = t; SIMX.hitEnemy(S, R, e, Math.max(1, Math.round(2 + dep(R))), false, e.x, e.y, 0, 'burn'); if (e.deadT >= 0) continue; }
      // knockback decays
      if (e.kbx || e.kby) { move(m, e, e.kbx * DT, e.kby * DT, E.r, true, !E.ghost && (m.cliff && !D.BOSSES[e.type] ? 2 : true)); e.kbx *= Math.exp(-10 * DT); e.kby *= Math.exp(-10 * DT); if (Math.abs(e.kbx) + Math.abs(e.kby) < 4) e.kbx = e.kby = 0;
        if (e.fallT === undefined && chasm(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) { e.fallT = t; e.kbx = e.kby = 0; ev(S, { k: 'fall', x: e.x, y: e.y, id: e.id, type: e.type }); } }
      // a tug whose warning ran out lands now, whatever the elite is doing (a blow it began meanwhile put it off past the
      // warning, and the dash timed to the warning no longer slipped it); never once it is falling, sinking or the hero gone
      if (e.tugW && t >= e.tugW) { const M = MOD.tug, d = Math.hypot(h.x - e.x, h.y - e.y), n = Math.min(M.n, d - (E.r + K.R + 24)); e.tugW = 0; e.tugT = t + M.every;
        if (n > 0 && heroOk && e.fallT === undefined && e.sinkT === undefined && losClear(m, e.x, e.y - 10, h.x, h.y - 10) && !(t - h.dashT < BAL.dodge.t)) {
          h.pull = { x: (e.x - h.x) / d, y: (e.y - h.y) / d, n, T: M.T, done: 0 }; ev(S, { k: 'tug', x: h.x, y: h.y, tx: e.x, ty: e.y, id: e.id }); } }
      // knocked off a plateau (TASKS 401): into the chasm it falls, in the lava it burns; either way it is gone in a moment
      if (e.fallT !== undefined || e.sinkT !== undefined) { e.vx = e.vy = 0; if (t >= (e.fallT ?? e.sinkT) + (e.fallT !== undefined ? SIMX.DOOM.fall : SIMX.DOOM.sink)) SIMX.killEnemy(S, R, e); continue; }
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy);
      if (e.face !== e.pf) { if (e.pf) e.ft = t; e.pf = e.face; }
      if (Math.hypot(e.vx, e.vy) < 4) e.d0 = e.dist;
      if (E.kind === 'eel') { eel(S, R, e, E, heroOk, d); continue; }
      if (E.kind === 'serpent') { serpent(S, R, e, heroOk); continue; }
      if (E.lake && (e.st === 'idle' || e.st === 'emerge' || e.st === 'wade')) { SIMX.colossusRise(S, R, e); continue; }
      if (E.kind === 'bomber' && e.st === 'wind') { skid(m, e, E); if (t >= e.fuse) { if (t >= (R.boomT ?? -9) && t - (R.boomT ?? -9) < BOOM_GAP) { e.fuse = R.boomT + BOOM_GAP; ev(S, { k: 'fuse', x: e.x, y: e.y, r: E.boom ? E.boom.r : MOD.explosive.r, d: e.fuse - t, id: e.id, lit: 1 }); } else { e.blown = 1; blast(S, R, e); SIMX.killEnemy(S, R, e); } } continue; }
      // (when it went into the lava or came out of it, for the render's ease between swimming and walking)
      if (E.kind === 'salamander') { const on = onLava(m, e) ? 1 : 0; if ((e.lv || 0) !== on) { e.lv = on; e.lvT = t; } }
      if (e.st === 'leap') { leapStep(S, R, e, E); continue; }
      if (e.st === 'soak') { soak(S, R, e, E); continue; }
      if (E.crust) golemCrust(S, R, e, E, d);   // (at its post too: a hero who walked away finds it whole again)
      // a drowned under the shallows stirs only for a hero close by; it stands up out of the water before it can do anything
      if (e.st === 'lurk') { e.vx = e.vy = 0; if (heroOk && d < E.sense && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) rise(S, R, e); continue; }
      if (e.st === 'rise') { e.vx = e.vy = 0; if (t - e.t0 < (e.riseD ?? E.rise)) continue; e.st = 'chase'; e.t0 = e.seenT = t; e.cdT = Math.max(e.cdT, t + 0.25); }
      if (e.st === 'idle' || e.st === 'home') {
        if (heroOk && (!D.BOSSES[e.type] || !m.bossType || R.arena) && !(e.calmT > t) && d < 330 && (DG.roomAt(m, h.x, h.y) === e.room || d < 170) && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) { SIMX.aggroRoom(R, e); ev(S, { k: 'alert', x: e.x, y: e.y - E.h - 8, id: e.id }); if (e.type === 'boss') SIMX.roar(S, R, e); }
        else { if (e.st === 'idle') idle(m, e, E, t); else goHome(m, e, E, t);
          // a crab at its post looks one way, then the other, at its own slow pace
          if (E.kind === 'crab') { const per = 6 + (e.id % 5), n = Math.floor((t + e.id * 2.3) / per); crabTurn(e, E, n % 2 ? 0.5 : Math.PI - 0.5, 0.5); }
          else if (E.kind === 'salamander' && Math.hypot(e.vx, e.vy) > 4) crabTurn(e, E, Math.atan2(e.vy, e.vx), 0.5);
          continue; } }
      if (!heroOk) { e.vx = e.vy = 0; continue; }
      // a committed attack keeps facing its aim: a lunge that carries past the hero must not mirror mid-strike; a hero straight above or below doesn't flip it every frame
      if (E.kind === 'crab') { if (e.st === 'chase' || (e.st === 'wind' && !e.rush)) { crabTurn(e, E, Math.atan2(dy, dx), e.st === 'wind' ? 0.5 : 1); if (e.st === 'wind') e.aimA = e.fa; } else crabTurn(e, E, faOf(e), 0); }
      else if (E.kind === 'salamander') { if (e.st !== 'chase') crabTurn(e, E, e.aimA, 1); }
      else e.face = e.st === 'wind' || e.st === 'strike' || e.st === 'bwind' ? (Math.cos(e.aimA) >= 0 ? 1 : -1) : Math.abs(dx) > 10 ? (dx > 0 ? 1 : -1) : e.face;
      // a hero out of sight for 4 s is lost: the monster walks back to its post
      if (e.st === 'chase' && E.kind !== 'boss' && e.hx !== undefined) {
        if (d < 420 && losClear(m, e.x, e.y - 10, h.x, h.y - 10)) e.seenT = t;
        else if (t - e.seenT > 4) { e.st = 'home'; e.t0 = t; continue; }
        // under two cells of headway along the path in 2.5 s while short of the fight and the hero holds still (a corridor jammed by its own kind,
        // a wall in the way): it walks back to its post and stays deaf to the sight of the hero for a while, or it would turn round
        // at once and jam the corridor again. A hero on the move resets it: a chase is not a jam
        const near = d < (E.kind === 'caster' || E.kind === 'archer' || E.kind === 'imp' || E.kind === 'salamander' ? 300 : E.r + K.R + E.reach + 40), fv = F[Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE)], pd = fv >= 0 ? fv : d / TILE;
        if (near || e.stuckK !== e.t0 || pd <= e.aF - 2 || Math.hypot(h.x - e.ax, h.y - e.ay) > 48) { e.stuckK = e.t0; e.aF = pd; e.ax = h.x; e.ay = h.y; e.aT = t; }
        else if (t - e.aT > 2.5) { e.st = 'home'; e.t0 = t; e.calmT = t + 4; continue; } }
      if (e.st === 'chase' && has(e, 'blink')) { if (e.blinkT === undefined) e.blinkT = t + MOD.blink.every / 2; if (t >= e.blinkT) e.blinkT = t + (blink(S, R, e) ? MOD.blink.every : 1); }
      if (e.st === 'chase' && has(e, 'tug')) { const M = MOD.tug, clear = () => losClear(m, e.x, e.y - 10, h.x, h.y - 10); if (e.tugT === undefined) e.tugT = t + M.every / 2;
        if (!e.tugW && t >= e.tugT) { if (d >= M.min && d <= M.max && clear()) { e.tugW = t + M.warn; ev(S, { k: 'tug_warn', x: e.x, y: e.y, id: e.id, d: M.warn }); } else e.tugT = t + 1; }
      }
      if (e.st === 'chase' && has(e, 'summoner')) { if (e.sumT === undefined) e.sumT = t + 2; if (t >= e.sumT) { e.sumT = t + MOD.summoner.every; raise(S, R, e); } }
      if (e.st === 'chase') {
        const reach = E.r + K.R + E.reach;
        if (E.kind === 'boss') { SIMX.bossThink(S, R, e, d); if (E.lake) SIMX.colossusStep(S, R, e); continue; }
        if (E.kindle && t >= (e.kinT ?? (e.kinT = t + E.kindle.first)) && kinOf(R, e, E).length) { e.st = 'wind'; e.t0 = t; e.kin = 1; e.aimA = Math.atan2(h.y - 38 - (e.y - 44), h.x - e.x); continue; }
        if (E.kind === 'caster') { const los = losClear(m, e.x, e.y - 20, h.x, h.y - 20);
          if (d < (E.orb || E.pyre ? E.reach : 360) && los && t >= e.cdT) { e.st = 'wind'; e.t0 = t; e.aimA = Math.atan2(h.y - 38 - (e.y - 44), h.x - e.x); continue; }
          const c = E.behind && d > 120 ? cover(R, e, h) : null;
          if (!c || !toward(e, E, m, c[0], c[1])) { const want = d < 170 ? -1 : d > 280 || !los ? 1 : 0; steer(e, E, m, F, want, dx, dy, d); } }
        // the archer looses at the hero in sight within its reach; between shots it keeps its distance, backing off from one who comes on
        else if (E.kind === 'archer') { const los = losClear(m, e.x, e.y - ARROW_Y, h.x, h.y - 38);
          if (d < E.reach && los && t >= e.cdT) { e.st = 'wind'; e.t0 = t; aimArrow(m, e, E, h); continue; }
          steer(e, E, m, F, d < E.keep[0] ? -1 : d > E.keep[1] || !los ? 1 : 0, dx, dy, d, d < E.keep[0] ? 0.85 : 1); }
        // the crab pinches only what stands before its claws; one out to its side, not too close, it runs down sideways
        else if (E.kind === 'crab' && t >= e.cdT && d < reach && Math.abs(angDiff(Math.atan2(dy, dx), faOf(e))) < E.armor.arc * 0.8) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = faOf(e); e.rush = 0; continue; }
        else if (E.kind === 'crab' && t >= e.cdT && t >= (e.rushT ?? 0) && d > E.r + K.R + E.rush.near && d < E.r + K.R + E.rush.reach && Math.abs(Math.abs(angDiff(Math.atan2(dy, dx), faOf(e))) - Math.PI / 2) < 0.7
          && losClear(m, e.x, e.y - 6, h.x, h.y - 6)) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = Math.atan2(dy, dx); e.rush = 1; continue; }
        else if (E.kind === 'crab') steer(e, E, m, F, d < Math.max(reach * 0.8, E.r + K.R + 6) ? 0 : 1, dx, dy, d);
        else if (E.kind === 'bomber' && d < reach) { fuse(S, R, e); continue; }
        else if (E.kind === 'imp') { if (impThink(S, R, e, E, F, d, dx, dy)) continue; }
        else if (E.kind === 'salamander') { if (salamThink(S, R, e, E, d, dx, dy)) continue; }
        else if (d < reach && t >= e.cdT && (E.kind !== 'hop' || losClear(m, e.x, e.y - 6, h.x, h.y - 6))) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = Math.atan2(dy, dx); e.grab = 0; continue; }
        else if (E.grab && d < E.r + K.R + E.grab.reach && t >= e.cdT && t >= (e.grabT ?? 0) && losClear(m, e.x, e.y - 20, h.x, h.y - 20)) { e.st = 'wind'; e.t0 = t; e.tx = h.x; e.ty = h.y; e.aimA = Math.atan2(dy, dx); e.grab = 1; continue; }
        else steer(e, E, m, F, d < Math.max(Math.min(reach, E.r + K.R + 46) * 0.8, E.r + K.R + 6) ? 0 : 1, dx, dy, d);
        move(m, e, e.vx * DT, e.vy * DT, E.r, true, E.lava && E.kind === 'salamander' ? true : undefined);
        const sp = Math.hypot(e.vx, e.vy); e.dist += sp * DT;
        // the salamander's belly burns a trail on land behind it
        if (E.trail && !onLava(m, e) && (e.trailD = (e.trailD || 0) + sp * DT) >= E.trail.every) { e.trailD = 0; addFire(R, S, e.x - Math.cos(faOf(e)) * E.r, e.y - Math.sin(faOf(e)) * E.r * 0.8, { src: e.id, who: who(e), r: E.trail.r, ry: E.trail.ry, t: E.trail.t, dmg: e.dmg * E.trail.dmg, per: E.trail.per, kind: 'trail' }); }
      } else if (e.st === 'wind') {
        skid(m, e, E); const w = windOf(e, e.grab ? E.grab.wind : e.rush ? E.rush.wind : e.kin ? E.kindle.wind : E.spark && !e.claw ? E.spark.wind : e.br ? E.breath.wind : E.wind);
        if (E.kind === 'archer' && t - e.t0 < w - E.arrow.lock) aimArrow(m, e, E, h);
        if (E.spark && !e.claw && t - e.t0 < w - E.spark.lock) { e.aimA = Math.atan2(h.y - 38 - (e.y - IMP_Y), h.x - e.x); e.face = Math.cos(e.aimA) >= 0 ? 1 : -1; }
        if (t - e.t0 >= w) { e.st = 'strike'; e.t0 = t;
          if (e.grab) { grab(S, R, e); continue; }
          if (E.kind === 'crab') { if (e.rush) { e.hitDone = 0; ev(S, { k: 'rush', x: e.x, y: e.y, a: e.aimA, id: e.id }); continue; }
            if (d < E.r + K.R + E.reach * 1.25 && Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)) < E.armor.arc && losClear(m, e.x, e.y, h.x, h.y)) { SIMX.hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); }
            ev(S, { k: 'pinch', x: e.x + Math.cos(e.aimA) * (E.r + 14), y: e.y + Math.sin(e.aimA) * (E.r + 14) * 0.8, a: e.aimA, id: e.id }); continue; }
          if (E.kind === 'hop') { takeOff(R, e, E); continue; }
          if (E.kind === 'imp') { const a = e.aimA;
            if (e.claw) { if (d < E.r + K.R + E.reach * 1.25 && Math.abs(angDiff(Math.atan2(dy, dx), a)) < 1.3 && losClear(m, e.x, e.y, h.x, h.y)) { SIMX.hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } ev(S, { k: 'eswing', x: e.x, y: e.y, a, id: e.id }); continue; }
            const Sp = E.spark, x0 = e.x + Math.cos(a) * 10, y0 = e.y - IMP_Y + Math.sin(a) * 10;
            R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: 'spark', kind: 'fire', x: x0, y: y0, vx: Math.cos(a) * Sp.spd, vy: Math.sin(a) * Sp.spd, t0: t, life: (Sp.reach + 60) / Sp.spd, dmg: e.dmg * Sp.dmg * eliteK(e, 'bolt'), own: 'en', r: Sp.r, gz: IMP_Y - 6 });
            ev(S, { k: 'flick', x: x0, y: y0, a, id: e.id }); continue; }
          if (E.kind === 'salamander') { if (e.br) { e.hitDone = 0; breathFire(S, R, e, E); ev(S, { k: 'breath', x: e.x, y: e.y, a: e.aimA, id: e.id }); continue; }
            if (d < E.r + K.R + E.reach * 1.25 && Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)) < 0.9 && losClear(m, e.x, e.y, h.x, h.y)) { SIMX.hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); }
            ev(S, { k: 'snap', x: e.x + Math.cos(e.aimA) * (E.r + 10), y: e.y + Math.sin(e.aimA) * (E.r + 10) * 0.8, a: e.aimA, id: e.id }); continue; }
          if (E.kind === 'golem') { const G0 = E.slam, px = e.x + Math.cos(e.aimA) * G0.at, py = e.y + Math.sin(e.aimA) * G0.at * 0.8;
            if (Math.hypot(h.x - px, (h.y - py) / 0.7) < G0.r + K.R && losClear(m, e.x, e.y, h.x, h.y)) { SIMX.hurtHero(S, R, e.dmg, px, py, undefined, who(e), e); struck(S, R, e); }
            ev(S, { k: 'slam', x: px, y: py, id: e.id, big: 1, r: G0.r }); R.trauma = Math.min(1, R.trauma + 0.5); continue; }
          if (E.kind === 'archer') { const a = e.aimA, A = E.arrow, x0 = e.x + Math.cos(a) * 16, y0 = e.y - ARROW_Y + Math.sin(a) * 16;
            R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: 'arrow', kind: has(e, 'fiery') ? 'fire' : 'arrow', x: x0, y: y0, vx: Math.cos(a) * A.spd, vy: Math.sin(a) * A.spd, t0: t, life: (E.reach + 60) / A.spd, dmg: e.dmg * eliteK(e, 'bolt'), own: 'en', r: A.r, gz: ARROW_Y - 10 });
            ev(S, { k: 'loose', x: x0, y: y0, a, id: e.id }); }
          else if (e.kin) kindle(S, R, e, E);
          else if (E.pyre) pyre(S, R, e, E);
          else if (E.orb) { const a = e.aimA, O = E.orb, x0 = e.x + Math.cos(a) * 22, y0 = e.y - 44;
            R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: 'orb', kind: 'water', x: x0, y: y0, vx: Math.cos(a) * O.spd, vy: Math.sin(a) * O.spd, t0: t, life: O.life, dmg: e.dmg * eliteK(e, 'bolt'), own: 'en', r: O.r, hitR: 20 + O.r });
            ev(S, { k: 'orb', x: x0, y: y0, id: e.id }); }
          else if (E.kind === 'caster') { const a = e.aimA, fire = R.map.biome === 'lava' || R.map.biome === 'magma' || has(e, 'fiery'); R.proj.push({ id: R.nextId++, src: e.id, who: who(e), k: fire ? 'fire' : 'hex', x: e.x + Math.cos(a) * 18, y: e.y - 44, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, t0: t, life: 2.2, dmg: e.dmg * (fire ? 1.25 : 1) * eliteK(e, 'bolt'), own: 'en', r: 6 });
            ev(S, { k: "eshoot", x: e.x, y: e.y - 44, id: e.id }); }
          else if (E.kind === 'slam') { if (d < 74 + K.R && losClear(m, e.x, e.y, h.x, h.y)) { SIMX.hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } ev(S, { k: 'slam', x: e.x + e.face * 26, y: e.y, id: e.id }); R.trauma = Math.min(1, R.trauma + 0.4); }
          else if (E.kind === 'melee') { const ad = Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)); if (d < E.r + K.R + E.reach * 1.25 && ad < 1.3 && losClear(m, e.x, e.y, h.x, h.y)) { SIMX.hurtHero(S, R, e.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } ev(S, { k: 'eswing', x: e.x, y: e.y, a: e.aimA, id: e.id }); } }
      } else if (e.st === 'strike') {
        // the lunge stops on contact and springs back for 0.1 s: carried on, the spider passed through the hero to land behind him
        if (E.kind === 'lunge' && t - e.t0 < 0.24) { const a = e.aimA; if (!(e.bncT > e.t0) && d <= E.r + K.R + 6.01) e.bncT = t;
          const v = e.bncT > e.t0 ? (t - e.bncT < 0.1 ? -150 : 0) : 330 * Math.min(1, (t - e.t0) / 0.05); { e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += v * DT;
            if (!e.hitDone && d < E.r + K.R + 8) { e.hitDone = 1; SIMX.hurtHero(S, R, e.dmg, e.x, e.y, 'poison', who(e), e); struck(S, R, e); } } }
        // the crab's rush runs sideways, the shell still facing its way, stops on the hero and springs back off him
        else if (E.kind === 'crab' && e.rush && t - e.t0 < E.rush.t) { const a = e.aimA; if (!(e.bncT > e.t0) && d <= E.r + K.R + 6.01) e.bncT = t;
          const v = e.bncT > e.t0 ? (t - e.bncT < 0.1 ? -120 : 0) : E.rush.spd * Math.min(1, (t - e.t0) / 0.06); e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += Math.abs(v) * DT;
          if (!e.hitDone && d < E.r + K.R + 8) { e.hitDone = 1; SIMX.hurtHero(S, R, e.dmg * E.rush.dmg, e.x, e.y, undefined, who(e), e); struck(S, R, e); } }
        // the breath: a hero in its cone at any moment of it is burnt once
        else if (E.kind === 'salamander' && e.br) { skid(m, e, E); const B = E.breath;
          if (!e.hitDone && t - e.t0 < B.t && d < E.r + B.reach + K.R && Math.abs(angDiff(Math.atan2(dy, dx), e.aimA)) < B.arc && losClear(m, e.x, e.y - 6, h.x, h.y - 6)) { e.hitDone = 1; SIMX.hurtHero(S, R, e.dmg * B.dmg, e.x, e.y, 'fire', who(e) + ' flame', e); struck(S, R, e); } }
        else if (E.kind !== 'hop') skid(m, e, E);
        if (E.kind === 'hop') hop(S, R, e, E);
        if (t - e.t0 > (E.kind === 'lunge' ? 0.45 : E.kind === 'hop' ? E.jump.t + E.jump.land : e.grab ? E.grab.strike : e.rush ? E.rush.t + 0.2 : e.br ? E.breath.t : E.kind === 'golem' ? 0.55 : 0.32)) { if (e.grab) { e.st = 'chase'; e.grab = 0; e.cdT = t + 0.15; continue; }
          if (e.rush) { e.st = 'chase'; e.rush = 0; e.hitDone = 0; e.rushT = t + E.rush.cd; e.cdT = t + 0.5; continue; }
          if (e.br) { e.br = 0; e.brT = t + E.breath.cd * (0.8 + 0.4 * rnd(R)); } e.st = 'chase'; e.cdT = t + E.cd * (e.elite && !D.BOSSES[e.type] && e.type !== 'brute' && dep(R) <= BAL.early ? BAL.earlyCd : eliteK(e, 'cd')) * (D.BOSSES[e.type] ? 1 : STAGE(R).cd || 1) * (0.8 + 0.4 * rnd(R)); e.hitDone = 0; }
      }
    }
    // separation: monsters don't stack
    const live2 = R.en.filter((e) => e.deadT < 0 && e.st !== 'idle' && e.st !== 'leap' && !ENEMIES[e.type].deep);
    for (let i = 0; i < live2.length; i++) for (let j = i + 1; j < live2.length; j++) { const a = live2[i], b = live2[j], ra = ENEMIES[a.type].r + ENEMIES[b.type].r + 4;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < ra && d > 0.01) { const p = (ra - d) * 0.5; move(m, a, -dx / d * p, -dy / d * p, ENEMIES[a.type].r, true); move(m, b, dx / d * p, dy / d * p, ENEMIES[b.type].r, true); } }
    // whatever moved them (walking, knockback, a lunge, the crowd), monsters stand clear of props; a ghost floats through
    // a top or bottom door's leaf stands edge-on against its left jamb: held to a strip LEAF wide there for monsters, so the brute (r 23) fits
    // the 54 px left beside it; the hero still keeps off the whole cell (TASKS 1351, 1783)
    const sol = SIMX.solids(R); for (let i = 0; i < sol.length; i++) if (sol[i].jamb !== undefined) sol[i] = { x: sol[i].jamb + LEAF / 2, y: sol[i].y, r: LEAF / 2 };
    // (a wide one, the brute or the golem, squeezes past braziers and the floor's props as if PROP_R wide: two of them a cell apart left
    // 40 px in a narrow room and it stuck before the door they led to, TASKS 1866; chests, pots, the shop and the walls still hold its whole body)
    const tight = new Map(), solOf = (r) => { if (r <= PROP_R) return sol; let q = tight.get(r); if (!q) tight.set(r, (q = sol.map((o) => (o.tight ? Object.assign({}, o, { r: o.r - (r - PROP_R) }) : o)))); return q; };
    for (const e of R.en) if (e.deadT < 0 && e.st !== 'leap' && !ENEMIES[e.type].ghost && !ENEMIES[e.type].deep) shove(m, e, ENEMIES[e.type].r, true, D.BOSSES[e.type] ? sol : solOf(ENEMIES[e.type].r));
    if (heroOk) for (const e of R.en) {
      const E = ENEMIES[e.type]; if (e.deadT >= 0 || !['melee', 'slam', 'lunge', 'hop', 'crab', 'bomber', 'imp', 'salamander', 'golem'].includes(E.kind) || e.st === 'lurk' || e.st === 'leap') continue;
      const dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy), stop = E.r + K.R + 6;
      if (d >= stop) continue;
      const angle = d > 0.01 ? Math.atan2(dy, dx) : e.face > 0 ? Math.PI : 0;
      for (let i = 0; i <= 24; i++) {
        const a = angle + Math.ceil(i / 2) * (i % 2 ? 1 : -1) * Math.PI / 12, trial = { x: e.x, y: e.y };
        move(m, trial, h.x + Math.cos(a) * stop - e.x, h.y + Math.sin(a) * stop - e.y, E.r, true, !E.ghost);
        if (Math.hypot(trial.x - h.x, trial.y - h.y) < stop - 0.01 || !E.ghost && sol.some((o) => Math.hypot(trial.x - o.x, (trial.y - o.y) * 1.6) < E.r + o.r - 0.01)) continue;
        e.x = trial.x; e.y = trial.y; break;
      }
    }
    // corpses are removed once they have faded
    R.en = R.en.filter((e) => e.deadT < 0 || t - e.deadT < 6);
  }
  // at its post a monster breathes (the rig), looks one way then the other, and now and then shifts a step around the spot
  function idle(m, e, E, t) {
    const per = 6 + (e.id % 5), u = (t + e.id * 2.3) % per, n = Math.floor((t + e.id * 2.3) / per);
    let vx = 0, vy = 0;
    if (u > 3.2 && u < 3.8 && e.hx !== undefined && !E.ghost) {
      const a = n * 2.4 + e.id, gx = e.hx + Math.cos(a) * 14 - e.x, gy = e.hy + Math.sin(a) * 8 - e.y, gd = Math.hypot(gx, gy);
      if (gd > 3) { vx = gx / gd * E.spd * 0.3; vy = gy / gd * E.spd * 0.3; } }
    const k = 1 - Math.exp(-12 * DT); e.vx += (vx - e.vx) * k; e.vy += (vy - e.vy) * k;
    const sp = Math.hypot(e.vx, e.vy); if (sp < 1) e.vx = e.vy = 0; else { move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += sp * DT; }
    if (u > 1.1 && u < 1.2) e.face = n % 2 ? 1 : -1; else if (u > 4.4 && u < 4.5) e.face = n % 2 ? -1 : 1;
    else if (sp > 4 && Math.abs(e.vx) > 2) e.face = e.vx > 0 ? 1 : -1;
  }
  function goHome(m, e, E, t) {
    const dx = e.hx - e.x, dy = e.hy - e.y, d = Math.hypot(dx, dy);
    // home, or walked for long enough without getting there (blocked): this is the post now
    if (d < 8 || t - e.t0 > 25) { e.st = E.lurk && inWater(m, e) ? 'lurk' : 'idle'; e.t0 = t; e.hx = e.x; e.hy = e.y; e.vx = e.vy = 0; return; }
    steer(e, E, m, homeFlow(m, Math.floor(e.hx / TILE), Math.floor(e.hy / TILE)), 1, dx, dy, d, 0.6);
    move(m, e, e.vx * DT, e.vy * DT, E.r, true, E.kind === 'salamander' ? true : undefined); e.dist += Math.hypot(e.vx, e.vy) * DT;
    if (Math.abs(e.vx) > 6) e.face = e.vx > 0 ? 1 : -1;
  }
  // a monster that stops to attack skids to a halt instead of freezing mid-stride (the rig's gait reads its speed and distance)
  // the archer's arrow leaves the bow ARROW_Y px over its feet; e.aimD is how far it would fly, to the first wall it would meet (no line is drawn since TASKS 338)
  const ARROW_Y = 46;
  function aimArrow(m, e, E, h) { const a = Math.atan2(h.y - 38 - (e.y - ARROW_Y), h.x - e.x), gz = ARROW_Y - 10, x0 = e.x, y0 = e.y - ARROW_Y + gz, n = Math.ceil((E.reach + 60) / 6);
    let cx = Math.floor(x0 / TILE), cy = Math.floor(y0 / TILE), dd = E.reach + 60; e.aimA = a;
    for (let i = 1; i <= n; i++) { const x = x0 + Math.cos(a) * i * 6, y = y0 + Math.sin(a) * i * 6, nx = Math.floor(x / TILE), ny = Math.floor(y / TILE);
      if (solidC(m, nx, ny) || pinch(m, cx, cy, nx, ny)) { dd = i * 6; break; } cx = nx; cy = ny; }
    e.aimD = dd; }
  // a mage's cover: the nearest monster of the fight standing between it and the hero; it keeps `behind` px past it, away from him
  function cover(R, e, h) { const E = ENEMIES[e.type], de = Math.hypot(h.x - e.x, h.y - e.y); let best = null, bd = 1e9;
    for (const o of R.en) { if (o === e || o.deadT >= 0 || o.st !== 'chase' && o.st !== 'wind' && o.st !== 'strike') continue; const K0 = ENEMIES[o.type];
      if (K0.kind === 'caster' || K0.kind === 'archer' || K0.kind === 'eel' || K0.kind === 'boss' || under(o)) continue;
      const dh = Math.hypot(h.x - o.x, h.y - o.y), dm = Math.hypot(o.x - e.x, o.y - e.y); if (dh >= de || dm > 320 || dm >= bd) continue; bd = dm; best = o; }
    if (!best) return null; const dh = Math.hypot(best.x - h.x, best.y - h.y) || 1;
    return [best.x + (best.x - h.x) / dh * E.behind, best.y + (best.y - h.y) / dh * E.behind]; }
  // walk straight to a spot in the open, slowing as it comes; false when a wall stands between
  function toward(e, E, m, gx, gy) { const dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy);
    if (!losClear(m, e.x, e.y - 6, gx, gy - 6)) return false;
    const sp = E.spd * eliteK(e, 'spd') * (e.slowK ?? 1) * (inWater(m, e) ? WADE : 1) * SS01(Math.max(0, Math.min(1, (d - 6) / 34))), k = 1 - Math.exp(-9 * DT); e.vx += (dx / (d || 1) * sp - e.vx) * k; e.vy += (dy / (d || 1) * sp - e.vy) * k; return true; }
  function skid(m, e, E) { const k = Math.exp(-14 * DT); e.vx *= k; e.vy *= k; const v = Math.hypot(e.vx, e.vy); if (v < 1) { e.vx = e.vy = 0; return; } move(m, e, e.vx * DT, e.vy * DT, E.r, true); e.dist += v * DT; }
  function steer(e, E, m, F, want, dx, dy, d, kv = 1) {
    let vx = 0, vy = 0;
    if (want !== 0) {
      const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE), here = F[ty * m.W + tx];
      if (want > 0 && d < 140 && losClear(m, e.x, e.y - 6, e.x + dx, e.y + dy - 6)) { vx = dx / d; vy = dy / d; }
      else if (here >= 0) { let best = null;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const j = (ty + ay) * m.W + tx + ax, v = F[j];
          if (v < 0 || (ax && ay && (F[ty * m.W + tx + ax] < 0 || F[(ty + ay) * m.W + tx] < 0))) continue;
          const score = want > 0 ? v : -v; if (!best || score < best[0]) best = [score, ax, ay]; }
        // through an open top or bottom door its free lane's middle, not the cell's: the brute (r 23) aimed at the cell's own wedged
        // against the far jamb (TASKS 1783); looked for only on a step up or down by a wall, as through a door; one along the wall passes it by
        const lane = best && best[2] && [-1, 0, 1].some((j) => cell(m, tx + best[1] + 1, ty + best[2] + j) === 0) && (m.doors || []).find((o) => o.open && !o.arena && (o.dir === 'u' || o.dir === 'd') && o.cells[1][0] === tx + best[1] && Math.abs(o.cells[1][1] - ty - best[2]) <= 1);
        if (best) { const gx = (lane ? lane.cells[0][0] * TILE + (LEAF + 2 * TILE) / 2 : (tx + best[1]) * TILE + TILE / 2) - e.x, gy = (ty + best[2]) * TILE + TILE / 2 + 4 - e.y, gd = Math.hypot(gx, gy) || 1; vx = gx / gd; vy = gy / gd; } }
      // (off the floor, in lava where the way field has no say: to the nearest bank first; straight at the hero it stuck on a knob of
      // rock in the pool, TASKS 374)
      else if (cell(m, tx, ty) === 3 && !E.lava && !E.ghost) { const [lx, ly] = SIMX.landOf(m, e.x, e.y), gx = lx - e.x, gy = ly - 6 - e.y, gd = Math.hypot(gx, gy) || 1; vx = gx / gd; vy = gy / gd; }
      else if (d > 0) { vx = dx / d * want; vy = dy / d * want; }
    }
    const sp = E.spd * eliteK(e, 'spd') * (e.slowK ?? 1) * kv * (!E.ghost && inWater(m, e) ? WADE : 1) * (!E.ghost && !E.webImmune && webAt(m, e) ? WEB.mon : 1) * (!E.ghost && E.blood !== 'slime' && gooAt(m, e) ? GOO.mon : 1), k = 1 - Math.exp(-9 * DT);
    e.vx += (vx * sp - e.vx) * k; e.vy += (vy * sp - e.vy) * k;
  }

  Object.assign(SIMX, {
    MOD, has, rollMods, struck, rise, split, faOf, armored, deepBody, serpentMouth, serpent, fuseEnd, chill, addFire, stepFires, flightReach,
    stepProjectiles, stepMonsters, ARROW_Y, steer });
})(typeof window !== 'undefined' ? window : globalThis);
