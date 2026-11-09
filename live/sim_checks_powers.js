// live/sim_checks_powers.js — selfCheck's part for the powers (TASKS 356 and on). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, castAbility, hitEnemy, heroHit, hurtHero, killEnemy, newRun, spawn, usePotion } = SIMX;
  const stage = (cls = 'warrior', seed = 91) => { const S = spawn(0, {}), R = newRun(S, 'campaign', seed, { cls }); S.run = R; S.screen = 'play'; S.t = R.t = 10; const h = R.hero; R.en = []; R.proj = []; R.fires = []; h.hp = 1e4; for (const a of D.clsOf(h).abs) { h.ab[a.id] = 1; h.cd[a.id] = 0; } h.mp = 1e3; return { S, R, h }; };
  const foe = (R, h, dx = 60, dy = 0, type = 'skeleton') => { const e = { id: R.nextId++, type, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: 1e5, max: 1e5, dmg: 1, elite: 0, room: -1, st: 'chase', t0: 0, face: 1, aimA: 0, cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, phase: 0, summ: 0, hx: h.x, hy: h.y, seenT: 0, ft: -9 }; R.en.push(e); return e; };
  function grant(h, id, P) { D.POWERS[id] = P; (h.powers = h.powers || {})[id] = 1; }
  const hits = (S, id) => S.ev.filter((e) => e.k === 'power' && e.id === id).length;
  function checkPowerPack() {}
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
