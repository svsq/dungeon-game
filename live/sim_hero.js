// live/sim_hero.js — the hero: damage, xp, shield, blows on monsters, deaths; the play step: input, melee, abilities, status, camera.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const {
    BAL, BASES, CONSUMABLES, CRUST, D, DT, ENEMIES, GIFT_V, GOO, K, LOOT, MOD, ORB, TILE, WADE, WEB, WIN, add, addFire, angDiff,
    armored, atBrink, cell, checkFull, clampCam, counted, crustOf, crustSet, dep, dif, ev, faOf, fstat, fuseEnd, gift, gooAt, has, hidden,
    inWater, isCons, lastFloor, logFloor, losClear, move, onLava, onPlate, potion, pushable, reveal, ri, rise, rnd, rollItem, shove,
    soaked, split, stats, tally, stepDrops, stepFires, stepHazards, stepMonsters, stepProjectiles, stepPyres, thinSet, under, webAt, who, zoomOf } = SIMX;
  // ---------------- hero helpers ----------------
  const heroSt = (S) => stats(S.run.hero, S.meta);
  // where the hero's weapon hand / spells come from (shared with the rig: SIM.RIG.shoulder above the feet)
  const RIG = { shoulder: 51, arm: 28 };
  // one step's travel: shorter when walking toward / away from the camera, so planted feet keep pace with the ground
  const stepLen = (ux) => K.STEP * (0.9 + 0.1 * Math.min(1, ux));   // (TASKS 1802: at 0.82 walking down he stepped 10.7 times a second)
  const hand = (h) => [h.x + Math.cos(h.aim) * 23, h.y - RIG.shoulder + 8 + Math.sin(h.aim) * 15];
  function bagAdd(R, it) {
    const h = R.hero;
    if (isCons(it)) { let n = it.n || 1; const cap = CONSUMABLES[it.b].stack; for (const st of h.bag) { if (!st || st.b !== it.b || st.n >= cap) continue; const q = Math.min(n, cap - st.n); st.n += q; n -= q; if (!n) return true; }
      for (let j; n > cap && (j = h.bag.indexOf(null)) >= 0; n -= cap) h.bag[j] = Object.assign({}, it, { id: R.nextId++, n: cap }); it.n = n; if (n > cap) return false; }
    const i = h.bag.indexOf(null); if (i < 0) return false; if (!it.id) it.id = R.nextId++; h.bag[i] = it; return true;
  }
  function gainXp(S, R, n) {
    const h = R.hero; n = Math.round(n * dif(R, 'xp')); h.xp += n; if (R.log) logFloor(R).xp += n;
    while (h.xp >= D.xpNeed(h.lvl)) { h.xp -= D.xpNeed(h.lvl); h.lvl++; const C = D.clsOf(h); h.pts += C.grow.pts; h.sp += C.grow.sp;
      for (const a of C.abs) if (a.unlock === h.lvl && !h.ab[a.id]) { h.ab[a.id] = 1; ev(S, { k: 'unlock', x: h.x, y: h.y, id: a.id }); }
      const st = heroSt(S); h.hp = st.maxHp; if (C.res !== 'rage') h.mp = st.maxMp; ev(S, { k: 'lvl', x: h.x, y: h.y, lvl: h.lvl }); }
    const had = h.mast; D.masteryTake(h); if (!had && h.mast) R.msg = { s: TXT('sim_hero.mastery.msg.s'), t: S.t, d: 4.5 };
  }
  // no invulnerability after a blow (the balance was tuned without it). A dash leaps spikes and lava; against a monster's blow, bolt
  // or blast it only adds to the chance to dodge (BAL.dodge), it never makes the hero immune. No single monster blow takes more
  // than BAL.cap of the health (the boss's more), so an unlucky stack of elite multipliers cannot kill through a potion
  function absorbShield(S, o, dmg, extra = {}) {
    if (!(o.shield > 0 && S.t < o.shieldUntil)) return dmg;
    const n = Math.min(o.shield, dmg); o.shield -= n; ev(S, Object.assign({ k: 'absorb', x: o.x, y: o.y, n }, extra)); if (o.shield <= 0) ev(S, { k: 'shield_break', x: o.x, y: o.y }); return dmg - n;
  }
  // (deadT is -1 while alive and may go negative when a QA state kills at S.t - 0.8, so only -1 itself means alive)
  function killHero(S, R) { const h = R.hero; if (h.deadT !== -1) return; h.hp = 0; h.deadT = S.t; ev(S, { k: 'die', x: h.x, y: h.y }); }
  function hurtHero(S, R, dmg, sx, sy, kind, src, actor) {
    const h = R.hero; if (h.deadT >= 0 || S.t < h.ifr || R.town) return;
    const dashing = S.t - h.dashT < BAL.dodge.t; if (dashing && (kind === 'spike' || src === 'lava')) return;
    if (kind !== 'spike' && src !== 'lava' && rnd(R) * 100 < heroSt(S).dodge + (dashing ? BAL.dodge.dash : 0)) { ev(S, { k: 'dodge', x: h.x, y: h.y, dash: dashing ? 1 : 0 }); return; }
    if (h.read) { h.read = null; ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_hero.hurtHero.s') }); }
    // a weapon a fire priest set alight (TASKS 410): a harder blow that sets the hero burning
    if (actor && actor.fireT > S.t && kind === undefined && !/ (bolt|blast|pillar)$/.test(src || '')) { dmg *= ENEMIES.fire_priest.kindle.dmg; kind = 'fire'; }
    // a monster the war cry shook hits softer (TASKS 1130)
    if (actor && actor.weakT > S.t) dmg *= D.CRY.weak;
    const st = heroSt(S), KD = 20 + 12 * D.deepEnd(dep(R)); dmg *= dif(R, 'dmg'); dmg = kind === 'spike' ? Math.round(dmg) : Math.max(1, Math.round(dmg * KD / (KD + st.def)));   // armour's share falls as floors climb: deep monsters still bite
    if (kind !== 'spike' && src !== 'lava' && D.clsOf(h).res === 'rage') dmg = Math.max(1, Math.round(dmg * (1 - h.mp / D.RAGE.max * D.RAGE.guard)));
    if (src && src !== 'lava') dmg = Math.min(dmg, Math.round(st.maxHp * (/^boss/.test(src) ? BAL.cap.boss : D.deepAxis(dep(R), 'blow'))));
    // a nest's chain of blasts took 68 % of the health in its worst 1.5 s, over half in 37 of 48 nests (TASKS 1647): together they
    // take no more than BAL.cap.blast of it in any such window, so one wrong step in a nest costs a potion, not the run (the smouldering
    // dead's alone, `capped` in their blast's data: a boss's or an explosive elite's is a blow of its own, held by BAL.cap; what a
    // shield takes is no part of it)
    const capped = actor && ((ENEMIES[actor.type] || {}).boom || {}).capped && / blast$/.test(src || '');
    if (capped) { const C = BAL.cap.blast, win = (R.blastWin || []).filter(([t]) => S.t - t < C.t), room = Math.round(st.maxHp * C.share) - win.reduce((n, [, v]) => n + v, 0);
      dmg = Math.min(dmg, room); R.blastWin = win; if (dmg <= 0) { const dx = h.x - sx, dy = h.y - sy, d = Math.hypot(dx, dy) || 1; h.vx += dx / d * 260; h.vy += dy / d * 260; R.trauma = Math.min(1, R.trauma + 0.35); return; } }   // (a blast past the cap still throws and shakes: no action without an answer)
    // blow: what landed before the shield took its part, for the balance tools' blow-size bands (TASKS 225)
    const blow = dmg;
    const shielded = h.shield > 0 && S.t < h.shieldUntil; dmg = absorbShield(S, h, dmg, { blow, src: src || kind || '?' }); if (shielded) SIMX.firePowers(S, R, 'shieldHit', { x: h.x, y: h.y }); if (shielded && h.shield <= 0) SIMX.firePowers(S, R, 'shieldBreak', { x: h.x, y: h.y }); if (capped && dmg > 0) R.blastWin.push([S.t, dmg]); if (dmg <= 0) return;
    if (D.clsOf(h).res === 'rage') { h.mp = Math.min(D.RAGE.max, h.mp + dmg / st.maxHp * 100 * D.RAGE.hurt); h.fightT = S.t; }
    h.hp -= dmg; h.lastHit = dmg; h.hurtT = S.t; h.hurtX = Math.abs(h.x - sx) < 4 ? 0 : h.x > sx ? 1 : -1; R.trauma = Math.min(1, R.trauma + 0.35); R.freeze = Math.max(R.freeze, 0.05);
    const dx = h.x - sx, dy = h.y - sy, d = Math.hypot(dx, dy) || 1; h.vx += dx / d * 260; h.vy += dy / d * 260;
    if (kind === 'poison') h.poison = S.t + 3;
    if (kind === 'fire') { if (h.burn <= S.t) ev(S, { k: 'ignite', x: h.x, y: h.y }); h.burn = Math.max(h.burn, S.t + 3); }
    if (kind === 'water') { h.slowT = S.t + ORB.t; ev(S, { k: 'soak', x: h.x, y: h.y - 38 }); }
    ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n: dmg, blow, side: h.hurtX || -1, src: src || kind || '?',
      actor: actor ? { type: actor.type, elite: actor.elite, mods: (actor.mods || []).slice() } : null });
    if (h.hp > 0 && h.powers) SIMX.powersHurt(S, R, dmg, st.maxHp);
    // a second chance (a gift): the killing blow leaves half the health instead, once per gift taken
    if (h.hp <= 0 && (h.perks || {}).phoenix > (h.revived || 0)) { h.revived = (h.revived || 0) + 1; h.hp = Math.round(st.maxHp * GIFT_V.phoenix / 100); h.ifr = S.t + 1.2;
      ev(S, { k: 'bless', x: h.x, y: h.y, id: 'phoenix' }); R.msg = { s: TXT('sim_hero.hurtHero.msg.s'), t: S.t }; return; }
    if (h.hp <= 0) killHero(S, R);
  }
  // (ax, ay): where the blow came from on the floor, when not its source (a bolt bursts at the height of the body it hit)
  // the hero's own blows (a swing, the whirl, a fireball's burst): what a reflecting or cursing elite answers (TASKS 387)
  let byHero = 0;
  const heroHit = (...a) => { byHero = 1; try { hitEnemy(...a); } finally { byHero = 0; } };
  function hitEnemy(S, R, e, dmg, crit, sx, sy, kb = 1, kind, ax = sx, ay = sy) {
    const fromHero = byHero; byHero = 0;
    if (e.deadT >= 0 || under(e) || R.town) return;
    if (fromHero && D.clsOf(R.hero).dmgK) dmg = Math.max(1, Math.round(dmg * D.clsOf(R.hero).dmgK));
    if (fromHero && R.hero.curseT > S.t) dmg = Math.max(1, Math.round(dmg * MOD.curse.k));
    // the war cry's buff and a blow's rage (TASKS 1130)
    if (fromHero && R.hero.cryT > S.t) dmg = Math.round(dmg * D.CRY.buff);
    if (fromHero && D.clsOf(R.hero).res === 'rage') { const h = R.hero; dmg = Math.round(dmg * (1 + h.mp / 10 * D.RAGE.dmg)); h.mp = Math.min(D.RAGE.max, h.mp + D.RAGE.hit); h.fightT = S.t; }
    if (R.map.bossType === e.type && !R.arena) { SIMX.stepArena(S, R); if (!R.arena) return; }
    if (D.BOSSES[e.type] && e.st === 'bwind') dmg *= D.bossMove(e).vulnerable || 1;
    if (D.BOSSES[e.type] && e.openUntil > S.t) dmg *= e.type === 'boss_serpent' ? 1.4 : D.BOSSES[e.type].moves.fists.open;
    let arm = armored(e, ENEMIES[e.type], ax, ay); if (arm) { dmg = Math.max(1, Math.round(dmg * ((e.elite && ENEMIES[e.type].armor.elite) || ENEMIES[e.type].armor.k))); e.armT = S.t; }
    // a golem's crust takes the blow and a plate of it comes off (TASKS 409); its fire doesn't
    const CR0 = ENEMIES[e.type].crust; if (CR0 && kind !== 'burn' && kind !== 'thorns' && crustOf(e, ENEMIES[e.type]) > 0) { dmg = Math.max(1, Math.round(dmg * CR0.k)); const n0 = crustOf(e, ENEMIES[e.type]); e.crust = n0 - 1; e.growT = S.t; e.armT = S.t; arm = true;
      (e.plateT = e.plateT || {})[n0] = S.t; (e.plateA = e.plateA || {})[n0] = Math.atan2(e.y - sy, e.x - sx); }   // (which plate went when, and which way: the render throws it off)
    dmg = absorbShield(S, e, dmg, { id: e.id }); if (dmg <= 0) return;
    if (e.ward > 0 && kind !== 'burn') { const back = Math.hypot(ax - e.x, ay - e.y) > 1 && Math.abs(angDiff(Math.atan2(ay - e.y, ax - e.x), faOf(e))) > Math.PI / 2;
      if (back) { e.ward = 0; ev(S, { k: 'ward_break', x: e.x, y: e.y - ENEMIES[e.type].h * 0.5, id: e.id }); }
      else { const n = Math.min(e.ward, dmg); e.ward -= n; dmg -= n; ev(S, { k: 'absorb', x: e.x, y: e.y, n, id: e.id, ward: 1 }); if (e.ward <= 0) ev(S, { k: 'ward_break', x: e.x, y: e.y - ENEMIES[e.type].h * 0.5, id: e.id }); if (e.st === 'idle' || e.st === 'home') aggroRoom(R, e); if (dmg <= 0) return; } }
    if (gift(R.hero, 'execute') && e.hp < 0.25 * e.max) dmg = Math.round(dmg * (1 + gift(R.hero, 'execute') / 100));
    // blowT: a blow, not a burn's tick (a golem's crust grows back once the blows stop, TASKS 409)
    e.hp -= dmg; e.hitP = e.hitT; e.hitT = S.t; if (kind !== 'burn' && kind !== 'thorns') e.blowT = S.t; if (e.st === 'idle' || e.st === 'home') aggroRoom(R, e); if (e.st === 'lurk') rise(S, R, e);
    const dx = e.x - sx, dy = e.y - sy, d = Math.hypot(dx, dy) || 1, heavy = e.type === 'brute' || ENEMIES[e.type].heavy || e.elite || ENEMIES[e.type].ghost || ENEMIES[e.type].deep || e.st === 'rise' || e.st === 'leap';
    if (!heavy && !arm) { const kk = kb > 0 && R.map.cliff && pushable(e) && atBrink(R.map, e, sx, sy) ? kb * D.BRINK.kb : kb; e.kbx += dx / d * 300 * kk; e.kby += dy / d * 300 * kk; }
    if (kind === 'fire' && !ENEMIES[e.type].lava) { e.burn = S.t + 3; e.burnT = S.t; }
    ev(S, Object.assign({ k: 'hit', x: e.x, y: e.y - ENEMIES[e.type].h * 0.5 - 6, type: e.type, n: dmg, crit: crit ? 1 : 0, id: e.id, fire: kind === 'fire' ? 1 : 0 }, arm ? { arm: 1, a: Math.atan2(ay - e.y, ax - e.x) } : {}));
    R.freeze = Math.max(R.freeze, crit ? 0.06 : 0.035); R.trauma = Math.min(1, R.trauma + (crit ? 0.22 : 0.12));
    const st = heroSt(S); if (kind !== 'burn' && kind !== 'thorns') R.hero.hp = Math.min(st.maxHp, R.hero.hp + dmg * st.leech / 100 + st.onhit);
    if (fromHero && has(e, 'reflect') && kind !== 'burn' && !(e.reflT > S.t - MOD.reflect.gap)) { const h = R.hero, n = Math.min(Math.round(dmg * MOD.reflect.k), Math.round(st.maxHp * MOD.reflect.cap), Math.max(0, Math.ceil(h.hp) - 1));
      if (n > 0 && h.deadT < 0) { h.hp -= n; e.reflT = S.t; ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n, blow: n, side: h.x > e.x ? 1 : -1, src: e.type + ' reflect', reflect: 1 }); } }
    if (fromHero && R.hero.powers && kind !== 'burn' && kind !== 'thorns') { const ctx = { e, x: e.x, y: e.y, hit: dmg }; SIMX.firePowers(S, R, 'hit', ctx); if (crit) SIMX.firePowers(S, R, 'crit', ctx); }
    if (e.hp <= 0 && e.deadT < 0) { e.dieA = Math.atan2(dy, dx); killEnemy(S, R, e); }   // the killing blow's direction: bones fly that way
  }
  function aggroRoom(R, e) { for (const o of R.en) if (o.deadT < 0 && (!D.BOSSES[o.type] || !R.map.bossType || R.arena) && (o === e || o.st === 'idle') && (o.room === e.room || (Math.hypot(o.x - e.x, o.y - e.y) < 220 && losClear(R.map, o.x, o.y - 10, e.x, e.y - 10)))) { o.st = 'chase'; o.t0 = o.seenT = R.t; }
    if (e.st === 'home') { e.st = 'chase'; e.t0 = e.seenT = R.t; } }
  // how long a monster knocked off a plateau takes to go: falling into the chasm, sinking burning in the lava (TASKS 401)
  const DOOM = { fall: 0.7, sink: 1.5 };
  // the crust under the hero or a monster knocked onto it: standing CRUST.stand s cracks it and its crusted neighbours (light, a
  // crack), CRUST.crack s on they are lava for CRUST.hot s, then they set again; stepping off before it cracks lets it be
  function stepCrust(S, R) {
    const m = R.map, t = S.t, cs = crustSet(m); if (!cs) return; const M = m.melt || (m.melt = {}), on = new Set();
    for (const o of [R.hero].concat(R.en)) { if (o.deadT >= 0 || (o !== R.hero && ENEMIES[o.type].ghost)) continue; const k = Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE); if (cs.has(k)) on.add(k); }
    for (const k of on) { const q = M[k] || (M[k] = { on: 0 }); if (q.crackT !== undefined) continue; q.on += DT; if (q.on < (thinSet(m).has(k) ? CRUST.thin : CRUST.stand)) continue;
      for (const n of [k, k + 1, k - 1, k + m.W, k - m.W]) if (cs.has(n) && (!M[n] || M[n].crackT === undefined)) M[n] = { on: CRUST.stand, crackT: t };
      ev(S, { k: 'crack', x: (k % m.W + 0.5) * TILE, y: (Math.floor(k / m.W) + 0.5) * TILE }); }
    for (const key in M) { const q = M[key], k = +key, x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE;
      // (a thin crust keeps the time stood on it, TASKS 484: there and back at a walk it holds, a pause on it on either way does not)
      if (q.crackT === undefined) { if (!on.has(k) && !thinSet(m).has(k) && (q.on -= 2 * DT) <= 0) delete M[key]; continue; }
      if (!q.hot && q.meltT === undefined && t >= q.crackT + CRUST.crack) { q.hot = 1; q.meltT = t; ev(S, { k: 'melt', x, y });
        // (only a hoard's thin crust drops him in, TASKS 484: a bank's, looking a firm stone path, did in a fight 4 seeds out of 4 and
        // the colossus's 3 times in 12 s; there it is lava again, burning as lava does, to be stepped off)
        const h = R.hero; if (h.hp > 0 && thinSet(m).has(k) && Math.floor(h.y / TILE) * m.W + Math.floor(h.x / TILE) === k) lavaFall(S, R, h); }
      else if (q.hot && t >= q.meltT + CRUST.hot) { q.hot = 0; q.setT = t; ev(S, { k: 'set', x, y }); }
      else if (!q.hot && q.setT !== undefined && t >= q.setT + CRUST.set) delete M[key]; }
  }
  // the hero falls through the crust into the lava (TASKS 476): hurt and alight, he climbs out where he last stood on firm ground
  function lavaFall(S, R, h) { const fx = h.x, fy = h.y, back = h.safe || landOf(R.map, h.x, h.y);
    // (a second fall straight after a first costs nothing more, TASKS 1057: the climb's hold put it past his grace, 70 % for two)
    if (S.t - (h.lavaFallT ?? -9) > 3) hurtHero(S, R, heroSt(S).maxHp * CRUST.fall, fx, fy - 10, 'spike', 'lava'); h.lavaFallT = S.t; if (h.hp <= 0) return;
    if (h.burn <= S.t) { h.burnT = S.t - 0.5; ev(S, { k: 'ignite', x: h.x, y: h.y }); } h.burn = Math.max(h.burn, S.t + CRUST.burn);
    h.sunk = { t: S.t, x: fx, y: fy, bx: back[0], by: back[1] }; h.vx = h.vy = 0; h.dashT = -9; h.ifr = Math.max(h.ifr || 0, S.t + CRUST.sink + 1); R.trauma = Math.min(1, R.trauma + 0.35);
    ev(S, { k: 'lavafall', x: fx, y: fy, tx: back[0], ty: back[1] }); }
  // the floor nearest a spot off it (a monster gone into the lava or the chasm drops its loot on the bank)
  function landOf(m, x, y) { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (cell(m, tx, ty) === 1) return [x, y];
    for (let r = 1; r <= 8; r++) { let best = null; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (Math.max(Math.abs(i), Math.abs(j)) === r && cell(m, tx + i, ty + j) === 1) { const d = i * i + j * j; if (!best || d < best[2]) best = [tx + i, ty + j, d]; }
      if (best) return [(best[0] + 0.5) * TILE, (best[1] + 0.5) * TILE + 6]; } return [x, y]; }
  function killEnemy(S, R, e) {
    if (e.type === 'boss_colossus') e.deathPose = { ...e };
    e.deadT = S.t; e.hp = 0; R.kills++; tally(S, R, 'kills'); if (D.BOSSES[e.type]) tally(S, R, 'bosses'); else if (e.elite) tally(S, R, 'elites');
    if (gift(R.hero, 'feast') && R.hero.deadT < 0) { const st = heroSt(S); R.hero.hp = Math.min(st.maxHp, R.hero.hp + st.maxHp * gift(R.hero, 'feast') / 100); } if (counted(e)) { fstat(R).kills++; checkFull(S, R); } R.freeze = Math.max(R.freeze, 0.07); R.trauma = Math.min(1, R.trauma + 0.25);
    const E = ENEMIES[e.type]; const nm = e.mods ? e.mods.length : 0; gainXp(S, R, Math.round(E.xp * BAL.reward * (1 + 0.3 * (dep(R) - 1)) * (e.elite && !D.BOSSES[e.type] ? 3 + nm : 1)));
    if (E.puddle) (R.map.goo = R.map.goo || []).push({ id: R.nextId++, x: e.x, y: e.y, t0: S.t, T: E.puddle.t, r: E.puddle.r, rNow: E.puddle.r });
    if (E.split) split(S, R, e, E);
    // a golem falls apart into a pool of lava (TASKS 409)
    if (E.pool && e.sinkT === undefined && e.fallT === undefined) { addFire(R, S, e.x, e.y, { src: e.id, who: who(e), r: E.pool.r, ry: E.pool.ry, t: E.pool.t, dmg: e.dmg * E.pool.dmg, per: E.pool.per, arm: E.pool.arm, kind: 'pool' }); ev(S, { k: 'pool', x: e.x, y: e.y, r: E.pool.r, d: E.pool.t, id: e.id }); }
    // a smouldering skeleton killed bursts too, unless it went off itself or into the lava or the chasm; one already lit keeps its fuse
    if (E.boom) { if (e.blown || e.fallT !== undefined || e.sinkT !== undefined) e.fuse = 0; else if (!(e.fuse > S.t)) { e.fuse = fuseEnd(R, S.t + E.boom.fuse); ev(S, { k: 'fuse', x: e.x, y: e.y, r: E.boom.r, d: e.fuse - S.t, id: e.id }); } }
    else if (has(e, 'explosive')) { e.fuse = fuseEnd(R, S.t + MOD.explosive.fuse); ev(S, { k: 'fuse', x: e.x, y: e.y, r: MOD.explosive.r, d: e.fuse - S.t, id: e.id }); }
    ev(S, Object.assign({ k: 'kill', x: e.x, y: e.y, type: e.type, id: e.id, elite: e.elite && !D.BOSSES[e.type] ? 1 : 0, boss: D.BOSSES[e.type] ? 1 : 0 }, e.quest ? { quest: e.quest } : {}, e.sinkT !== undefined || e.fallT !== undefined ? { gone: 1 } : {}));
    // the last monster of a room down: the room is cleared (TASKS 1017, a quest's goal)
    if (counted(e) && e.room !== undefined && e.room >= 0 && !R.en.some((o) => o !== e && o.room === e.room && o.deadT < 0 && counted(o))) ev(S, { k: 'clear', x: e.x, y: e.y, room: e.room });
    if (R.hero.powers && R.hero.deadT < 0) { SIMX.firePowers(S, R, 'kill', { e, x: e.x, y: e.y }); if (counted(e) && e.room !== undefined && e.room >= 0 && !R.en.some((o) => o !== e && o.room === e.room && o.deadT < 0 && counted(o))) SIMX.firePowers(S, R, 'roomClear', { x: e.x, y: e.y }); }
    // a raised skeleton pays its XP but carries nothing: a summoner is not a gold mine
    if (e.type === 'mimic') SIMX.mimicLoot(S, R, e);
    if (e.summ) return;
    const [lx, ly] = landOf(R.map, e.x, e.y), ox = e.x, oy = e.y; e.x = lx; e.y = ly;
    if (e.key !== undefined) drop(R, e.x, e.y, { kind: 'key', lock: e.key });
    const gb = 1 + 0.15 * ((S.meta.up || {}).gold || 0);
    if (rnd(R) < 0.55 || e.elite) drop(R, e.x, e.y, { kind: 'gold', n: Math.round((3 + ri(R, 0, 6) + dep(R) * 2) * (e.elite ? 4 + 2 * nm : 1) * gb * BAL.reward) });
    const LT = e.type === 'brute' && e.elite ? LOOT.brute : e.elite ? LOOT.elite : LOOT.mob;
    if (!D.BOSSES[e.type] && (e.elite ? rnd(R) < (LT.p ?? 1) : rnd(R) < LT.p * BAL.reward * LOOT.thin(dep(R)))) for (let i = 0, n = 1 + (rnd(R) < (LT.extra || 0) ? 1 : 0); i < n; i++) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), LT.q, undefined, LT) });
    if (rnd(R) < POT.kill * BAL.reward) dropPotion(R, e.x, e.y, 0.65);
    // a chapter boss replaced an exit guard worth 1 shard: 3 for a sealed fight that is harder, far below the finale's 20 (TASKS 227)
    // the boss closing a chapter (the demon lord on the campaign's 8th, TASKS 339) pays as the finale did: its shards and its loot
    const fin = D.BOSSES[e.type] && lastFloor(R), big = D.BOSSES[e.type] && (fin || SIMX.chapterEnd(R, e)), sh = D.BOSSES[e.type] ? (big ? 20 : 3) : e.elite ? 1 : 0; if (sh) drop(R, e.x, e.y, { kind: 'shard', n: sh });
    if (D.BOSSES[e.type]) { SIMX.captiveBoss(S, R, e); SIMX.finishArena(S, R, e); if (R.viaTown) { R.bossN = (R.bossN || 0) + 1; R.lastBoss = e.type; (R.slain = R.slain || []).push(R.floor); } }
    if (big && !R.chests.some((c) => c.boss)) for (const o of LOOT.boss) drop(R, e.x, e.y, { kind: 'item', item: rollItem(R, dep(R), o.q, undefined, o) });
    if (fin) { R.bossDead = 1; R.msg = { s: TXT('sim_hero.killEnemy.msg.s', { name: ENEMIES[e.type].name }), t: S.t }; }
    e.x = ox; e.y = oy;
  }
  // a thrown-away item lands on a free neighbouring cell and stays put until the hero has walked away from it and comes back
  function throwAway(R, h, it) {
    const m = R.map, tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE), taken = (x, y) => R.drops.some((p) => Math.floor(p.x / TILE) === x && Math.floor(p.y / TILE) === y);
    let best = null;
    for (let r = 1; r <= 3 && !best; r++) for (let j = -r; j <= r && !best; j++) for (let i = -r; i <= r; i++) { if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      const x = tx + i, y = ty + j; if (cell(m, x, y) === 1 && !taken(x, y) && !SIMX.solids(R).some((o) => Math.hypot(o.x - (x * TILE + 16), o.y - (y * TILE + 18)) < o.r + 8)) { best = [x, y]; break; } }
    const [x, y] = best || [tx, ty];
    if (!it.id) it.id = R.nextId++;
    R.drops.push({ id: R.nextId++, kind: 'item', item: it, x: h.x, y: h.y - 10, vx: (x * TILE + 16 - h.x) / 0.45, vy: (y * TILE + 20 - h.y) / 0.45, z: 0, vz: 200, t0: R.t, tossed: 1, fly: 0.45 });
  }
  // potion drops: a floor cleared whole gives ~2.5 health potions (it gave ~9, and a player drank 4 in a whole run, TASKS 154)
  // scroll: a chest's scroll of return; in a run through the town it is the way home and back (TASKS 1024): at a chest's quarter the bot
  // found 14 a run, went home ten times and the potions never ran out (the average past the 8th in 83 % of runs, the campaign's 70 %)
  const POT = { chest: 0.085, vase: 0.07, pot: 0.055, kill: 0.007, scroll: 0.25, scrollTown: 0.07 };
  // the warrior's share of mana potions simply does not drop: he never drank them, so more health potions in their place would be a free buff
  function dropPotion(R, x, y, hp) { const b = rnd(R) < hp ? 'hp_potion' : 'mp_potion'; if (!SIMX.useless(R, b)) drop(R, x, y, { kind: 'item', item: potion(b) }); }
  function drop(R, x, y, o) { const a = rnd(R) * Math.PI * 2, v = 60 + rnd(R) * 90; if (o.item && !o.item.id) o.item.id = R.nextId++;
    if (o.kind === 'item') { o.loot = 1; if (!o.pre) fstat(R).lootN++; delete o.pre; }
    R.drops.push(Object.assign({ id: R.nextId++, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 0, vz: 160 + rnd(R) * 80, t0: R.t }, o)); }

  // ---------------- the world step (screen 'play') ----------------
  function stepPlay(S, inp, keys) {
    const R = S.run, h = R.hero, m = R.map, t = S.t; R.t = t; R.play = (R.play ?? (R.log ? R.log.fl.reduce((n, L) => n + L.time, 0) : 0)) + DT; tally(S, R, 'time', DT);   // saves from before the counter resume from the journal's per-floor time
    SIMX.stepArena(S, R);
    const st = heroSt(S);
    if (R.log && h.deadT < 0) { const L = logFloor(R); L.time += DT; L.minHp = Math.min(L.minHp, h.hp / st.maxHp); L.minMp = Math.min(L.minMp, h.mp / st.maxMp); L.maxHp = st.maxHp; L.maxMp = st.maxMp; L.atk = st.atk; L.def = st.def; }
    // mouse → world aim
    const Z = zoomOf(R), mx = R.cam[0] + inp.px / Z, my = R.cam[1] + inp.py / Z;
    if (h.deadT >= 0) { if (t - h.deadT > 1.6) return SIMX.endRun(S, 'dead'); stepMonsters(S, R, 0); stepDrops(S, R, false); camera(R, h, 0, 0); return; }
    // reactions keep running during hit-stop; the hero and camera hold, and so does every clock a player must react to: a wind-up,
    // a bolt's life, a lava warning, an egg's hatch; cooldowns run on, or every blow the hero lands slowed the monsters' attacks.
    // Keys pressed in it, or in the hold on «Продолжить», are kept for the first step after it (TASKS 227, review of PR 57)
    if (R.leaving > 0) { R.leaving -= DT; SIMX.holdClocks(R);
      { const q = R.map.exit, dx = q.x - h.x, dy = q.y - h.y, d = Math.hypot(dx, dy) || 1, sp = Math.max(0, d - 24) / Math.max(DT, R.leaving + DT), go = sp * DT; h.vx = sp * dx / d; h.vy = sp * dy / d; if (go > 0) { h.x += dx / d * go; h.y += dy / d * go; h.dist += go; h.gp = (h.gp || 0) + go / stepLen(Math.abs(dx) / d) * Math.PI; if (dx) h.face = dx > 0 ? 1 : -1; } }
      if (R.leaving <= 0) { R.leaving = 0; SIMX.enterFloor(S, R, R.floor + 1); } return; }
    const hold = R.freeze > 0 ? 'freeze' : t < (R.holdT ?? -1) ? 'all' : '';
    if (hold) { if (hold === 'freeze') R.freeze -= DT; else h.vx = h.vy = 0; R.frozen = 1; stepDrops(S, R, true); SIMX.holdClocks(R, hold === 'all');
      R.inbuf = Object.assign(R.inbuf || {}, keys); if (inp.slot) R.inslot = inp.slot; return; }
    R.frozen = 0; if (R.inbuf) { for (const k in R.inbuf) keys[k] = 1; R.inbuf = null; } if (R.inslot) { if (!inp.slot) inp = Object.assign({}, inp, { slot: R.inslot }); R.inslot = 0; }
    if (SIMX.greetHold(R)) { inp = { px: inp.px, py: inp.py }; for (const k in keys) delete keys[k]; }
    // ---- input: 8-way run with accel / decel ----
    const ix = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), iy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0), il = Math.hypot(ix, iy) || 1;
    const spd = K.RUN * (1 + st.mspd / 100) * (t - h.atkT < (h.atkSlow ?? 0.2) ? 0.55 : 1) * (inWater(m, h) ? WADE : 1) * (webAt(m, h) ? WEB.k : 1) * (gooAt(m, h) ? GOO.k : 1) * (soaked(S, h) ? ORB.slow : 1) * (S.t < (h.chillT ?? -9) ? MOD.frost.slow : 1);
    const app = (v, tg) => { const a = (Math.abs(tg) > Math.abs(v) ? K.ACC : K.DEC) * DT; return v < tg ? Math.min(tg, v + a) : Math.max(tg, v - a); };
    h.vx = app(h.vx, ix / il * spd); h.vy = app(h.vy, iy / il * spd);
    h.aim = Math.atan2(my - (h.y - RIG.shoulder + 8), mx - h.x); h.mx = mx; h.my = my;
    const busy = t - h.atkT < 0.22 || t - h.castT < 0.25;
    const wasBack = h.back, wasFace = h.face;
    // a shooter faces the shot being loosed: turned by the live pointer in the wind-up he fired over his own shoulder (critic r3)
    const held0 = (D.clsOf(h).shoots || []).includes(st.wtype) && t - h.atkT < D.SHOTS[(BASES[st.wtype] || {}).shot || 'bolt'].t, aimF = held0 ? h.atkA : h.aim;
    if (busy) { h.face = Math.cos(aimF) >= 0 ? 1 : -1; h.back = Math.sin(aimF) < -0.5 ? 1 : 0; }
    else if (ix || iy) { if (ix) h.face = ix; h.back = iy < 0 ? 1 : iy > 0 ? 0 : h.back; }
    if (h.back !== wasBack) h.backT = t;
    if (h.face !== wasFace) h.faceT = t;
    // dash
    const spareDash = D.clsOf(h).id === 'archer' && st.agi >= D.THRESHOLD.archer[1] && (h.cd.dash2 ?? 0) <= t;
    if (keys.Space && (h.cd.dash <= t || spareDash) && !h.sunk && !(h.stag && t < h.stag.t)) { const dx = ix || Math.cos(h.aim), dy = ix || iy ? iy : Math.sin(h.aim), d = Math.hypot(dx, dy) || 1;
      h.dashT = t; h.dashX = dx / d; h.dashY = dy / d; if (h.cd.dash <= t) h.cd.dash = t + K.DASH_CD; else h.cd.dash2 = t + K.DASH_CD * 2; ev(S, { k: 'dash', x: h.x, y: h.y, dx: h.dashX, dy: h.dashY });
      SIMX.firePowers(S, R, 'dash', { x: h.x, y: h.y, dx: h.dashX, dy: h.dashY, len: K.DASH * K.DASH_T });
      // the dash beats the flames out (TASKS 463: burning took the most hits and nothing put it out away from water)
      if (h.burn > t) { h.burn = 0; ev(S, { k: 'snuff', x: h.x, y: h.y, hero: 1 }); } }
    // a dash is a leap: spikes under it never bite, and one that would come down on a plate carries on until it is clear of it
    // the warrior's charge (TASKS 1130) is a longer, faster dash that strikes the first monster it meets and stops on it
    if (h.cryJolt && t >= h.cryJolt) { h.cryJolt = 0; R.trauma = Math.min(1, R.trauma + 0.25); }
    if (h.leapV && h.leapV[0] === h.dashT && !h.leapV[2] && t - h.dashT >= K.DASH_T) { h.leapV[2] = 1; ev(S, { k: 'hland', x: h.x, y: h.y }); }
    const CH = D.CHARGE, charging = h.charge && t >= h.dashT && t - h.dashT < CH.t;
    const onSpikes = m.traps.some((tr) => onPlate(h, tr)), leap = t >= h.dashT && t - h.dashT < (charging ? CH.t : K.DASH_T);
    if (leap && onSpikes) h.leapT = h.dashT; else if (!onSpikes) h.leapT = -9;
    const dashing = leap || (h.leapT === h.dashT && t - h.dashT < K.DASH_T + K.LEAP);
    // under the lava (TASKS 484) he stays where he went in, then is up on the firm ground he last stood on
    if (h.sunk) { h.vx = h.vy = 0; if (t >= h.sunk.t + CRUST.sink) { h.x = h.sunk.bx; h.y = h.sunk.by; h.fx = h.fy = null; h.climbT = t; h.sunk = null; } }
    const held = h.sunk || (h.climbT !== undefined && t - h.climbT < 0.5), stag = h.stag && t < h.stag.t ? h.stag : null;   // (climbing out over the lip, TASKS 1049, 1058: let go at 0.35 he glided off still 23 px under)
    // (a charge that struck stops on its monster, but its dash runs out, so the lean and the cape ease back, TASKS 1134 critic)
    const halted = h.dashHalt === h.dashT, dashV = charging ? CH.spd : h.leapV && h.leapV[0] === h.dashT ? h.leapV[1] : K.DASH, slide = stag ? 1 - (t - stag.t0) / (stag.t - stag.t0) : 0, mvx = held || (dashing && halted) ? 0 : stag ? stag.vx * slide : dashing ? h.dashX * dashV : h.vx, mvy = held || (dashing && halted) ? 0 : stag ? stag.vy * slide : dashing ? h.dashY * dashV : h.vy;
    if (charging) { const e = R.en.find((o) => o.deadT < 0 && !under(o) && !ENEMIES[o.type].ghost && Math.hypot(o.x - h.x, (o.y - h.y) * 1.25) < ENEMIES[o.type].r + K.R + 18);
      if (e) { const boss = !!D.BOSSES[e.type], stun = boss ? CH.boss : CH.stun; h.charge = null; h.mp = Math.min(D.RAGE.max, h.mp + D.RAGE.charge); h.dashHalt = h.dashT; R.freeze = Math.max(R.freeze, 0.06); R.trauma = Math.min(1, R.trauma + 0.3);
        e.rootT = t + stun; e.cdT = Math.max(e.cdT || 0, t + stun); if (e.st === 'wind') { e.st = 'chase'; e.t0 = t; }
        heroHit(S, R, e, Math.max(1, Math.round(st.atk * h.chargeK)), false, h.x, h.y, 1.5); ev(S, { k: 'chargehit', x: e.x, y: e.y, id: e.id }); } }
    else if (h.charge && t - h.dashT >= CH.t) { h.charge = null; h.cd.charge = Math.min(h.cd.charge, t + CH.miss); ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_hero.charge.miss') }); }
    if (leap && h.powers) SIMX.dashTouch(S, R);
    // (the throw never carries him onto the lava: a knock-back shoves monsters in, the hero never, TASKS 406)
    if (stag && onLava(m, { x: h.x + mvx * DT * 3, y: h.y + mvy * DT * 3 })) stag.vx = stag.vy = 0;
    // a hero whose box the ground closed over (a railed bank's edge under his heels, TASKS 1833) could not take a step any way: back to
    // where he last stood free, else the nearest free spot he can walk to in a line (a blind nudge could pass a thin wall, PR 56 review)
    const lk = !m.cliff || onLava(m, h), shut = (x, y) => SIMX.boxHit(m, x, y, K.R, undefined, lk);
    if (!held && shut(h.x, h.y)) { const fits = (x, y) => !shut(x, y) && losClear(m, h.x, h.y, x, y) && (lk || !SIMX.overLava(m, h.x, h.y, x, y));
      if (h.fx != null && Math.hypot(h.fx - h.x, h.fy - h.y) <= 20 && fits(h.fx, h.fy)) { h.x = h.fx; h.y = h.fy; }
      else for (let k = 2, done = 0; k <= 20 && !done; k += 2) for (let i = 0; i < 8 && !done; i++) { const x = h.x + Math.cos(i * Math.PI / 4) * k, y = h.y + Math.sin(i * Math.PI / 4) * k; if (fits(x, y)) { h.x = x; h.y = y; done = 1; } } }
    const stop = stag && !stag.vx && !stag.vy, ox = h.x, oy = h.y; const [bx, by] = move(m, h, stop ? 0 : mvx * DT, stop ? 0 : mvy * DT, K.R); if (bx) h.vx = 0; if (by) h.vy = 0;
    // a drowned's grab draws the hero a step toward it at an even pace
    if (h.pull) { const P = h.pull, sp = Math.min(P.n / P.T * DT, P.n - P.done); move(m, h, P.x * sp, P.y * sp, K.R); P.done += sp; if (P.done >= P.n - 0.01) h.pull = null; }
    shove(m, h, K.R, false, SIMX.solids(R));
    // (only firm ground on foot: a spot taken mid-dash or mid-leap could be over the chasm or the lava, PR 56 review 2)
    if (!dashing && !held && !h.sunk && !onLava(m, h) && !SIMX.chasm(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)) && !SIMX.boxHit(m, h.x, h.y, K.R, undefined, !m.cliff)) { h.fx = h.x; h.fy = h.y; }
    { const w = webAt(m, h); if (w && h.web !== m.webs.indexOf(w)) ev(S, { k: 'web', x: w.x, y: w.y, i: m.webs.indexOf(w) }); h.web = w ? m.webs.indexOf(w) : -1; }
    { const g = gooAt(m, h); if (g && h.gooIn !== g.id) ev(S, { k: 'goo', x: h.x, y: h.y }); h.gooIn = g ? g.id : -1; }
    m.goo = (m.goo || []).filter((g) => t < g.t0 + g.T); for (const g of m.goo) g.rNow = g.r * Math.min(1, (g.t0 + g.T - t) / GOO.dry);
    const moved = Math.hypot(h.x - ox, h.y - oy);
    { const k = Math.floor(h.y / TILE) * m.W + Math.floor(h.x / TILE); if (m.cells[k] === 1) h.safe = [h.x, h.y]; }   // (firm ground to climb back onto, TASKS 476)
    if (moved > 0.02 && dashing) SIMX.hitProps(S, R, h.x, h.y, K.R, undefined, undefined, true);
    if (moved > 0.02) {
      const hits = R.propHit || (R.propHit = {});
      m.decor.forEach((d, i) => {
        // (and in the magma caves, TASKS 466: a crack hisses and sparks underfoot, a charred skeleton shifts, a chain fence swings by)
        const fungus = /^shroom_[ab]$/.test(d.n), reach = fungus ? 25 : d.n === 'vent_mg' ? 22 : d.n === 'fence_mg' ? 34 : 30;
        if (!fungus && !['skel_cv', 'skel_mg', 'vent_mg', 'fence_mg'].includes(d.n)) return;
        const fx = d.n === 'fence_mg' ? Math.max(d.x, Math.min(d.x + d.len, h.x)) : d.x;
        if (hidden(m, d) || Math.hypot(fx - h.x, d.y - h.y) > reach || !losClear(m, h.x, h.y, fx, d.y)) return;
        const id = 'd' + i; if (S.t - (hits[id] ?? -9) < 0.65) return;
        hits[id] = S.t; ev(S, { k: 'prop', x: fx, y: d.y, i: id, n: d.n, mat: fungus ? 'fungus' : D.PROP_MAT[d.n] || 'bone', scale: d.s || 1, touch: 1, s: h.x < d.x ? 1 : -1 });
      });
    }
    if (moved > 0.02 && !dashing) { const b = Math.floor(h.gp / Math.PI); h.dist += moved; h.gp = (h.gp || 0) + moved / stepLen(Math.abs(h.x - ox) / moved) * Math.PI; if (Math.floor(h.gp / Math.PI) !== b) ev(S, { k: 'step', x: h.x, y: h.y, wet: inWater(m, h), mat: (m.crossings || []).some((c) => c.kind === 'bridge' && c.cells.includes(Math.floor(h.y / TILE) * m.W + Math.floor(h.x / TILE))) ? 'wood' : inWater(m, h) ? 'water' : 'stone' }); }
    // ---- melee: hold LMB ----
    // a swing faster than its own damage frame was cut off by the next one before it landed: past 224 % attack speed a warrior hit nothing (TASKS 1833)
    const frame = SIMX.hitFrame(h, st.wtype);
    if (inp.press && !S.eatPress && h.cd.atk <= t) {
      h.patkT = h.atkT; h.patkA = h.atkA; h.atkT = t; h.atkA = h.aim; h.atkHit = 0; h.atkN++; h.cd.atk = t + Math.max(frame + DT, st.wcd / (1 + st.aspd / 100)); h.atkSlow = Math.min(0.2, (D.clsOf(h).slow || 1) * st.wcd / (1 + st.aspd / 100)); if (h.face !== (h.face = Math.cos(h.aim) >= 0 ? 1 : -1)) h.faceT = t;
      ev(S, Object.assign({ k: 'swing', x: h.x, y: h.y, a: h.aim, n: h.atkN, f: h.face }, (D.clsOf(h).shoots || []).includes(st.wtype) ? { shot: 1 } : {}));
    }
    if (h.atkT >= 0 && !h.atkHit && t - h.atkT >= frame) {     // the damage frame: the blade crosses the aim (scene.js swingPose)
      h.atkHit = 1; const arc = st.arc * Math.PI / 180, reach = st.reach, Cl = D.clsOf(h);
      // a class that shoots from this weapon (the mage's staff, TASKS 1110) sends a bolt down the aim instead of the blade's arc
      if ((Cl.shoots || []).includes(st.wtype)) { const a = h.atkA, c = rnd(R) * 100 < st.crit;
        const p = SIMX.heroShot(R, h, a, Math.max(1, Math.round(st.atk * (0.9 + 0.2 * rnd(R)) * (c ? st.critK : 1) * (h.bless ? 1.2 : 1))), c, BASES[st.wtype].shot || 'bolt', BASES[st.wtype]);
        if (Cl.hitMp) p.mpGain = c ? Cl.hitMp.crit : Cl.hitMp.hit;
        ev(S, { k: p.k === 'arrow' ? 'hloose' : 'bolt', x: p.x, y: p.y, a });
        // the staff's sweep still knocks what stands in its arc (TASKS 1116: a pot in a corridor stopped the mage for good, the bolt is
        // born past it): pots, props, doors, chests, secrets and webs, as a swing does; monsters only by the bolt
        SIMX.breakPots(S, R, h.x, h.y, reach + 10, h.atkA, arc); SIMX.hitProps(S, R, h.x, h.y, reach + 10, h.atkA, arc); SIMX.hitChests(S, R, h.x, h.y, reach + 10, h.atkA, arc); SIMX.hitDoors(S, R, h.x, h.y, reach + 10, h.atkA, arc); SIMX.tearWebs(S, R, h.x, h.y, reach + 10, h.atkA, arc); } else {
      for (const e of R.en) { if (e.deadT >= 0) continue; const E = ENEMIES[e.type], dx = e.x - h.x, dy = (e.y - h.y) * 1.25, d = Math.hypot(dx, dy);
        if (d > reach + E.r + K.R) continue; if (d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), h.atkA)) > arc / 2) continue; if (!losClear(m, h.x, h.y, e.x, e.y)) continue;
        const c = rnd(R) * 100 < st.crit; heroHit(S, R, e, Math.max(1, Math.round(st.atk * (0.9 + 0.2 * rnd(R)) * (c ? st.critK : 1) * (h.bless ? 1.2 : 1))), c, h.x, h.y, st.kb); }
      SIMX.breakPots(S, R, h.x, h.y, reach + 10, h.atkA, arc); SIMX.hitProps(S, R, h.x, h.y, reach + 10, h.atkA, arc); SIMX.hitFolk(S, R, h.x, h.y, reach + 10, h.atkA, arc); SIMX.hitChests(S, R, h.x, h.y, reach + 10, h.atkA, arc); SIMX.hitDoors(S, R, h.x, h.y, reach + 10, h.atkA, arc); SIMX.tearWebs(S, R, h.x, h.y, reach + 10, h.atkA, arc); }
    }
    // ---- abilities / potions / interact ----
    if (inp.slot >= 1 && inp.slot <= 3) SIMX.castAbility(S, R, D.clsOf(h).abs[inp.slot - 1].id, inp);
    // the scroll's hint (TASKS 1033), once for good: the first time a hero of a town run with a scroll in the bag falls low on health
    if (R.viaTown && !R.town && !S.meta.tipScroll && h.deadT < 0 && !S.demo && Math.floor(S.t * 4) !== Math.floor((S.t - DT) * 4) && h.bag.some((it) => it && it.b === 'scroll') && h.hp < 0.35 * heroSt(S).maxHp) {
      S.meta.tipScroll = 1; R.msg = { s: TXT('sim_hero.stepPlay.msg.s'), t: S.t, d: 4.5, tip: 'scroll' }; ev(S, { k: 'tip', id: 'scroll', x: h.x, y: h.y }); }
    // the whirl's hint (TASKS 390), over no other message; a test run counts its whirls in no meta, so its own count stops the hint too (review of PR 63)
    { const W = D.TIPS.whirl; if (h.ab.whirl && h.cd.whirl <= S.t && Math.max(S.meta.whirls || 0, R.whirls || 0) < W.until && S.t - (R.tipT ?? -1e9) > W.every && !(R.msg && S.t - R.msg.t < (R.msg.d || 3.5))) {
      const r = D.abRank('whirl', h.ab.whirl).r; if (R.en.filter((e) => e.deadT < 0 && !under(e) && e.st !== 'idle' && e.st !== 'home' && Math.hypot(e.x - h.x, (e.y - h.y) * 1.3) < r + ENEMIES[e.type].r).length >= W.n) {
        R.tipT = S.t; R.msg = { s: W.s, t: S.t, d: 3, tip: 'whirl' }; ev(S, { k: 'tip', id: 'whirl', x: h.x, y: h.y }); } } }
    if (inp.rclick) SIMX.castAbility(S, R, D.clsOf(h).rclick, inp);
    if (keys.KeyQ) SIMX.usePotion(S, R, 'hp_potion');
    // T reads the scroll of return (TASKS 1026: behind the bag alone, a novice never found it)
    if (keys.KeyT) { const i = h.bag.findIndex((it) => it && it.b === 'scroll'); if (i >= 0) SIMX.useItem(S, R, i); else ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_hero.stepPlay.s') }); }
    if (keys.KeyR) SIMX.usePotion(S, R, 'mp_potion');
    if (R.msgNext && S.t >= R.msgNext.t) { R.msg = R.msgNext; R.msgNext = null; }
    if (keys.KeyE) SIMX.interact(S, R);
    if (R.map !== m) return;
    if (h.read && R.hero === h) SIMX.readStep(S, R, ix || iy ? 1 : 0, dashing);
    if (R.map !== m) return;
    // a loose flagstone sinks under the hero's step
    for (const q of m.secrets || []) if (!q.open && q.trig && q.trig.k === 'plate' && Math.abs(h.x - q.trig.x) < 13 && Math.abs(h.y - q.trig.y) < 13) { q.trig.downT = t; ev(S, { k: 'click', x: q.trig.x, y: q.trig.y }); SIMX.openSecret(S, R, q); }
    // ---- status ----
    const rIn = reveal(R);
    if (R.msg && R.msg.room !== undefined && rIn !== R.msg.room && !R.msg.outT) R.msg.outT = t;   // a room's alarm is about that room only
    if (m.shop) { const d = Math.hypot(h.x - m.shop.x, h.y - m.shop.y); if (d < 230 && R.shop.away) { R.shop.away = 0; R.shop.greetT = t; } else if (d > 360) R.shop.away = 1; }
    if (R.town && m.town) SIMX.stepFolk(S, R);
    if (m.way && !(R.ways || []).includes(R.floor) && Math.hypot(h.x - m.way.x, h.y - m.way.y) < 60) SIMX.wake(S, R);
    if (st.regen && h.hp > 0) h.hp = Math.min(st.maxHp, h.hp + st.regen * DT);
    // rage (TASKS 1130) is not mana: no refill in the start room, no regeneration; it drains once the fight is over
    if (D.clsOf(h).res === 'rage') { if (t - (h.fightT ?? -9) > D.RAGE.calm) h.mp = Math.max(0, h.mp - D.RAGE.decay * DT); }
    else { if (rIn === m.start) h.mp = Math.min(st.maxMp, h.mp + st.maxMp * 0.08 * DT); h.mp = Math.min(st.maxMp, h.mp + (1.2 + st.int * 0.12) * DT); }
    // the poison's drain is reported every half second like the burn's, so the balance tools and the death screen see it (TASKS 227)
    if (h.poison > t) { const n = 2.5 * st.resist * DT; h.hp -= n; if (h.hp <= 1) h.hp = 1; if (R.log) add(logFloor(R).dmg, 'poison', n);
      h.poisonAcc = (h.poisonAcc || 0) + n; if (t - (h.poisonT ?? -9) >= 0.5) { h.poisonT = t; const k = Math.round(h.poisonAcc); if (k > 0) { h.poisonAcc -= k; ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n: k, src: 'poison' }); } } }
    // a fire hex sets the hero alight: a tick every 0.5 s for 3 s, past the invulnerability window like poison, never the killing blow
    // a burn's ticks run up one number on screen (`chain`: the burn's first tick, `sum`: so far), not a number each half second
    if (h.burn > t && t - (h.burnT ?? -9) >= 0.5) { if (t - (h.burnL ?? -9) > 0.75) { h.burnC = t; h.burnSum = 0; } h.burnT = h.burnL = t; const n = Math.max(1, Math.round((1.5 + 0.3 * dep(R)) * st.resist * dif(R, 'dmg'))); h.hp = Math.max(1, h.hp - n); h.burnSum = (h.burnSum || 0) + n;
      ev(S, { k: 'scorch', x: h.x, y: h.y }); ev(S, { k: 'hurt', x: h.x, y: h.y - 40, n, src: 'burn', chain: h.burnC, sum: h.burnSum }); }
    if (h.shield > 0 && t > h.shieldUntil) { const left = h.shield; h.shield = 0; SIMX.firePowers(S, R, 'shieldEnd', { x: h.x, y: h.y, left }); }
    // spikes: up for 0.7 s of every 2.4 s; a plate is 2×2 cells, feet a little inside its edge count
    for (const tr of m.traps) { const ph = ((t / 2.4 + tr.ph) % 1 + 1) % 1, up = ph < 0.29;
      if (up && onPlate(h, tr) && !dashing && t - h.spikeT > 0.7) { h.spikeT = t; hurtHero(S, R, heroSt(S).maxHp * (m.biome === 'magma' ? D.ARCH.plateau.guard.hit : BAL.spike), h.x, h.y - 20, 'spike'); ev(S, { k: 'spike', x: tr.x, y: tr.y }); }
      // the spikes don't care whose feet are on them: lure or knock monsters onto a plate
      if (up) for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && onPlate(e, tr) && t - (e.spikeT ?? -9) > 0.7) {
        e.spikeT = t; hitEnemy(S, R, e, Math.round(9 * (1 + 0.2 * (dep(R) - 1))), false, tr.x, tr.y, 0, 'spike'); ev(S, { k: 'spike', x: tr.x, y: tr.y }); } }
    if (m.hazards) stepHazards(S, R);
    // a magma sanctum's circle (TASKS 1054, MAGMA_HALLS.pay.bless): once none of its hall's monsters lives, the hero stepping into it
    // is blessed for the floor, as by the altar's gift, and the circle goes dark
    for (const q of m.circles || []) if (q.bless && !q.used && h.hp > 0 && Math.hypot(h.x - q.x, (h.y - q.y) * 1.6) < 1.6 * TILE && !R.en.some((e) => e.deadT < 0 && e.room === q.r)) {
      q.used = 1; h.bless = 1; h.blessTo = R.floor + 1; ev(S, { k: 'bless', x: q.x, y: q.y, id: 'bless', s: D.GIFTS.find((g) => g.id === 'bless').name, cost: 0 }); R.msg = { s: TXT('sim_hero.sanctum.msg'), t: S.t }; }
    if (R.pyres && R.pyres.length) stepPyres(S, R);
    if (R.htraps && R.htraps.length) SIMX.stepTraps(S, R);
    if (R.chests.length) SIMX.stepChestTraps(S, R);
    SIMX.stepStatues(S, R); SIMX.stepLeaves(S, R);
    if (R.fires && R.fires.length) stepFires(S, R);
    // water puts the fire out
    if (h.burn > t && inWater(m, h)) { h.burn = 0; ev(S, { k: 'douse', x: h.x, y: h.y }); }
    for (const e of R.en) if (e.deadT < 0 && e.burn > t && !ENEMIES[e.type].ghost && inWater(m, e)) { e.burn = 0; ev(S, { k: 'douse', x: e.x, y: e.y }); }
    // lava burns whoever stands in it, every half second
    const lavaDmg = () => 8 * (1 + 0.2 * (dep(R) - 1));
    if (onLava(m, h) && t - (h.lavaT ?? -9) >= 0.5) { h.lavaT = t; hurtHero(S, R, lavaDmg() * st.resist, h.x, h.y, undefined, 'lava'); ev(S, { k: 'scorch', x: h.x, y: h.y }); }
    for (const e of R.en) if (e.deadT < 0 && !ENEMIES[e.type].ghost && !ENEMIES[e.type].lava && onLava(m, e) && t - (e.lavaT ?? -9) >= 0.5) {
      if (m.cliff && !D.BOSSES[e.type]) { if (e.sinkT === undefined && e.fallT === undefined) { e.sinkT = t; e.burn = t + DOOM.sink + 0.5; e.burnT = t; e.kbx = e.kby = 0; ev(S, { k: 'sink', x: e.x, y: e.y, id: e.id, type: e.type }); } continue; }
      e.lavaT = t; hitEnemy(S, R, e, Math.round(lavaDmg() * 1.25), false, e.x, e.y, 0, 'fire'); ev(S, { k: 'scorch', x: e.x, y: e.y }); }
    if (crustSet(m)) stepCrust(S, R);
    stepProjectiles(S, R);
    stepMonsters(S, R, 1);
    for (const e of R.en) if (e.type === 'crab' && e.deadT < 0) {
      // not enumerable: the render-only trail stays out of the saved run (JSON) and starts afresh after a load
      if (!e.crabTrail) Object.defineProperty(e, 'crabTrail', { value: [], writable: true, enumerable: false });
      const trail = e.crabTrail;
      trail.push({ x: e.x, y: e.y, fa: faOf(e), dist: e.dist, vx: e.vx, vy: e.vy });
      if (trail.length > 180) trail.shift();
    }
    for (const e of R.en) {
      const moved = Math.hypot(e.x - (e.waterX ?? e.x), e.y - (e.waterY ?? e.y)); e.waterX = e.x; e.waterY = e.y;
      if (e.deadT < 0 && !ENEMIES[e.type].ghost && inWater(m, e) && moved < TILE) {
        e.waterStride = (e.waterStride || 0) + moved;
        if (e.waterStride >= 24) { e.waterStride %= 24; ev(S, { k: 'step', x: e.x, y: e.y, wet: true, id: e.id }); }
      } else e.waterStride = 0;
    }
    stepDrops(S, R, true);
    // ---- camera: follow + look toward the cursor, spring, clamped to the map ----
    camera(R, h, (inp.px / Z - WIN(R).W / 2) * 0.12, (inp.py / Z - WIN(R).H / 2) * 0.12);
    R.trauma = Math.max(0, R.trauma - 1.6 * DT);
    if (t - R.saveT > 30) { R.saveT = t; S.saveN++; }
  }
  function camera(R, h, lx, ly) { R.camLook = [lx, ly]; const w = WIN(R), tg = [h.x - w.W / 2 + lx, h.y - 30 - w.H / 2 + ly]; clampCam(R, tg);
    for (const i of [0, 1]) { R.camV[i] += (36 * (tg[i] - R.cam[i]) - 12 * R.camV[i]) * DT; R.cam[i] += R.camV[i] * DT; } }

  Object.assign(SIMX, {
    heroSt, RIG, stepLen, hand, bagAdd, gainXp, hurtHero, killHero, heroHit, hitEnemy, aggroRoom, DOOM, landOf, killEnemy, throwAway, POT, drop, dropPotion,
    stepPlay });
})(typeof window !== 'undefined' ? window : globalThis);
