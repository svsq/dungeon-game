// live/sim_checks_powers.js — selfCheck's part for the powers (TASKS 356 and on). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, TILE, castAbility, hitEnemy, heroHit, hurtHero, killEnemy, newRun, spawn, usePotion } = SIMX;
  const stage = (cls = 'warrior', seed = 91) => { const S = spawn(0, {}), R = newRun(S, 'campaign', seed, { cls }); S.run = R; S.screen = 'play'; S.t = R.t = 10; const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 9; x <= cx + 9; x++) m.cells[y * m.W + x] = 1; h.x = cx * TILE + 16; h.y = cy * TILE + 18; R.en = []; R.proj = []; R.fires = []; h.hp = 1e4; for (const a of D.clsOf(h).abs) { h.ab[a.id] = 1; h.cd[a.id] = 0; } h.mp = 1e3; return { S, R, h }; };
  const foe = (R, h, dx = 60, dy = 0, type = 'skeleton') => { const e = { id: R.nextId++, type, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: 1e5, max: 1e5, dmg: 1, elite: 0, room: -1, st: 'chase', t0: 0, face: 1, aimA: 0, cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, phase: 0, summ: 0, hx: h.x, hy: h.y, seenT: 0, ft: -9 }; R.en.push(e); return e; };
  function grant(h, id, P) { D.POWERS[id] = P; (h.powers = h.powers || {})[id] = 1; }
  const hits = (S, id) => S.ev.filter((e) => e.k === 'power' && e.id === id).length;
  function checkPowerPack(out) {
    const T = 'POWERS', own = (c, id) => { (c.h.powers = c.h.powers || {})[id] = 1; };
    for (const [id, P] of Object.entries(D.POWERS)) { if (!P.name || !P.desc || P.name.startsWith(T) || P.desc.startsWith(T)) out.push(`power: ${id} has no words`);
      if (P.ab && !Object.values(D.CLASSES).some((C) => C.abilities.includes(P.ab))) out.push(`power: ${id} is for ${P.ab}, no class has it`); if (!SIMX.POWER_FX[P.fx]) out.push(`power: ${id} does ${P.fx}, no such effect`); }
    { const c = stage('warrior'); own(c, 'whirl_pull'); const e = foe(c.R, c.h, 70); castAbility(c.S, c.R, 'whirl', {}); if (!(e.kbx < 0)) out.push(`power: the whirl does not pull (kbx ${e.kbx})`); }
    { const c = stage('warrior'); own(c, 'whirl_ring'); castAbility(c.S, c.R, 'whirl', {}); if (c.R.fires.filter((f) => f.own === 'hero').length < 4) out.push('power: no ring of fire after the whirl'); }
    { const c = stage('mage'); own(c, 'fire_split'); castAbility(c.S, c.R, 'fireball', {}); if (c.R.proj.length !== 3) out.push(`power: the split ball is ${c.R.proj.length} balls`); }
    { const c = stage('mage'); own(c, 'fire_pierce'); castAbility(c.S, c.R, 'fireball', {}); if (c.R.proj[0].pierce !== 1) out.push('power: the ball does not pierce'); }
    { const c = stage('mage'); own(c, 'shield_burst'); const e = foe(c.R, c.h, 50), hp = e.hp; SIMX.firePowers(c.S, c.R, 'shieldEnd', { x: c.h.x, y: c.h.y, left: 40 }); if (hp - e.hp < 40) out.push(`power: the shield's end took ${hp - e.hp}`); }
    { const c = stage('mage'); own(c, 'shield_feed'); castAbility(c.S, c.R, 'shield', {}); const u = c.h.shieldUntil; killEnemy(c.S, c.R, foe(c.R, c.h)); if (Math.abs(c.h.shieldUntil - u - 1) > 1e-6) out.push('power: a kill does not feed the shield'); c.h.shield = 0; const u2 = c.h.shieldUntil; killEnemy(c.S, c.R, foe(c.R, c.h)); if (c.h.shieldUntil !== u2) out.push('power: a kill feeds a shield that is down'); }
    { const c = stage('archer'); own(c, 'volley_pierce'); castAbility(c.S, c.R, 'volley', {}); if (c.R.proj.length !== D.VOLLEY.n || c.R.proj.some((p) => p.pierce < 1)) out.push('power: the volley does not pierce'); }
    { const c = stage('archer'); own(c, 'trap_burst'); const a = foe(c.R, c.h, 30), b = foe(c.R, c.h, 70), hb = b.hp; c.R.htraps = [{ id: 9, x: a.x, y: a.y, t0: c.S.t - 1, dmg: 100, crit: 0 }]; SIMX.stepTraps(c.S, c.R); if (!(b.hp < hb)) out.push('power: the trap does not reach its neighbours'); }
    { const c = stage('archer'); own(c, 'leap_trap'); castAbility(c.S, c.R, 'leap', {}); if ((c.R.htraps || []).length !== 1) out.push('power: no trap left by the leap'); }
    { const c = stage(); own(c, 'dash_trail'); SIMX.firePowers(c.S, c.R, 'dash', { x: c.h.x, y: c.h.y, dx: 0, dy: 0, len: 100 }); if (!c.R.fires.some((f) => f.own === 'hero')) out.push('power: no fire behind the dash'); }
    { const c = stage(); own(c, 'dash_strike'); const e = foe(c.R, c.h, 5), hp = e.hp; c.h.dashT = c.S.t; SIMX.dashTouch(c.S, c.R); const h1 = e.hp; SIMX.dashTouch(c.S, c.R); if (!(h1 < hp) || e.hp !== h1) out.push(`power: the dash struck ${hp - e.hp}, once expected`); }
  }
  function checkPowers(out) {
    const T = '__t', drive = (trig, act, extra = {}) => { const c = stage(extra.cls); grant(c.h, T, Object.assign({ trig, fx: 'mana', v: 0 }, extra.p)); c.S.ev = []; act(c); const n = hits(c.S, T); delete D.POWERS[T]; return n; };
    const cases = {
      hit: ({ S, R, h }) => heroHit(S, R, foe(R, h), 1, false, h.x, h.y),
      crit: ({ S, R, h }) => heroHit(S, R, foe(R, h), 1, true, h.x, h.y),
      kill: ({ S, R, h }) => killEnemy(S, R, foe(R, h)),
      hurt: ({ S, R, h }) => { h.ifr = 0; h.dashT = -9; S.meta.up = {}; for (let i = 0; i < 40 && !S.ev.some((e) => e.k === 'hurt'); i++) hurtHero(S, R, 5, h.x + 9, h.y); },
      'cast:whirl': ({ S, R, h }) => castAbility(S, R, 'whirl', {}),
      potion: ({ S, R, h }) => usePotion(S, R, 'hp_potion'),
    };
    for (const [trig, act] of Object.entries(cases)) if (drive(trig, act) < 1) out.push(`power: ${trig} never fires`);
    if (drive('every:3', ({ S, R, h }) => { const e = foe(R, h); for (let i = 0; i < 7; i++) heroHit(S, R, e, 1, false, h.x, h.y); }) !== 2) out.push('power: every:3 is not each third blow');
    if (drive('hit', ({ S, R, h }) => { const e = foe(R, h); for (let i = 0; i < 5; i++) heroHit(S, R, e, 1, false, h.x, h.y); }, { p: { icd: 1 } }) !== 1) out.push('power: icd does not hold it back');
    if (drive('hit', ({ S, R, h }) => { const e = foe(R, h); hitEnemy(S, R, e, 1, false, h.x, h.y, 0, 'burn'); heroHit(S, R, e, 1, false, h.x, h.y, 0, 'burn'); }) !== 0) out.push('power: a burn\'s tick counts as a blow');
    if (drive('roomClear', ({ S, R, h }) => { const e = foe(R, h); e.room = 3; killEnemy(S, R, e); }) !== 1) out.push('power: roomClear never fires');
    if (drive('lowHp', ({ S, R, h }) => { h.hp = 1; SIMX.powersHurt(S, R, 1, 1000); SIMX.powersHurt(S, R, 1, 1000); }) !== 1) out.push('power: lowHp fires more than once on the way down');
    { const c = stage(); grant(c.h, T, { trig: 'hit', fx: 'nova', k: 1, r: 80 }); const e = foe(c.R, c.h, 40); e.hp = 1; heroHit(c.S, c.R, e, 5, false, c.h.x, c.h.y); delete D.POWERS[T]; if (c.R.kills !== 1) out.push(`power: a power's blow on the dying killed it ${c.R.kills} times`); }
    { const c = stage(), rs = c.R.rs; c.h.powers = {}; const e = foe(c.R, c.h); heroHit(c.S, c.R, e, 1, false, c.h.x, c.h.y); SIMX.firePowers(c.S, c.R, 'kill', {}); if (c.R.rs !== rs) out.push('power: a hero without powers spends the run\'s dice'); }
    { const c = stage(); grant(c.h, T, { trig: 'hit', fx: 'burnGround', k: 1, t: 2, per: 0.5 }); const e = foe(c.R, c.h, 0, 0), hp0 = e.hp; SIMX.firePowers(c.S, c.R, 'hit', { x: e.x, y: e.y }); delete D.POWERS[T]; const f = c.R.fires[0]; if (!f || f.own !== 'hero') out.push('power: ground fire not laid'); else { const hp1 = c.h.hp; c.S.t += 0.6; SIMX.stepFires(c.S, c.R); if (e.hp >= hp0) out.push('power: the hero\'s fire does not burn monsters'); if (c.h.hp !== hp1) out.push('power: the hero\'s fire burns the hero'); } }
    { const c = stage(), j = JSON.parse(JSON.stringify(c.R.hero)); j.powers = { a: 1 }; if (JSON.parse(JSON.stringify(j)).powers.a !== 1) out.push('power: not kept in the save'); }
    checkPowerPack(out);
  }
  Object.assign(SIMX, { checkPowers });
})(typeof window !== 'undefined' ? window : globalThis);
