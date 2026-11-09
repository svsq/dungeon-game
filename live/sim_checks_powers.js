// live/sim_checks_powers.js — selfCheck's part for the powers (TASKS 356 and on). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, TILE, castAbility, hitEnemy, heroHit, hurtHero, killEnemy, newRun, spawn, usePotion } = SIMX;
  const stage = (cls = 'warrior', seed = 91) => { const S = spawn(0, {}), R = newRun(S, 'campaign', seed, { cls }); S.run = R; S.screen = 'play'; S.t = R.t = 10; const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 9; x <= cx + 9; x++) m.cells[y * m.W + x] = 1; h.x = cx * TILE + 16; h.y = cy * TILE + 18; R.en = []; R.proj = []; R.fires = []; h.hp = 1e4; for (const a of D.clsOf(h).abs) { h.ab[a.id] = 1; h.cd[a.id] = 0; } h.mp = 1e3; return { S, R, h }; };
  const foe = (R, h, dx = 60, dy = 0, type = 'skeleton') => { const e = { id: R.nextId++, type, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: 1e5, max: 1e5, dmg: 1, elite: 0, room: -1, st: 'chase', t0: 0, face: 1, aimA: 0, cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, phase: 0, summ: 0, hx: h.x, hy: h.y, seenT: 0, ft: -9 }; R.en.push(e); return e; };
  function grant(h, id, P) { D.POWERS[id] = P; (h.powers = h.powers || {})[id] = 1; }
  const hits = (S, id) => S.ev.filter((e) => e.k === 'power' && e.id === id).length;
  function checkPowerGifts(out) {
    for (const cl of ['warrior', 'mage', 'archer']) { const c = stage(cl), C = D.CLASSES[cl], seen = new Set();
      for (const a of C.abs) c.h.ab[a.id] = 1;
      for (let i = 0; i < 300; i++) { const sh = { x: 0, y: 0 }; c.R.shrines.push(sh); c.R.altar = c.R.shrines.length - 1; SIMX.openAltar(c.S, c.R, sh); c.S.screen = 'play'; for (const o of sh.gifts) { seen.add(o.id); const g = D.GIFTS.find((q) => q.id === o.id); if (g.power && g.ab && !C.abilities.includes(g.ab)) out.push(`gift: a ${cl}'s altar offers ${o.id}`); } }
      for (const g of D.GIFTS) if (g.power && !g.needs && (!g.ab || C.abilities.includes(g.ab)) && g.tier < 4 && !seen.has(g.id)) out.push(`gift: a ${cl} never gets offered ${g.id}`);
      const h = c.h; h.ab = Object.fromEntries(C.abs.map((a) => [a.id, 0])); const p = D.giftPool(h, 2); if (p.some((g) => g.power && g.ab)) out.push(`gift: a ${cl} is offered a power for an ability not yet open`); }
    { const c = stage('mage'); c.h.powers = { fire_pierce: 1 }; let line = 0; const N = 400; for (let i = 0; i < N; i++) { const sh = { x: 0, y: 0 }; c.R.shrines.push(sh); SIMX.openAltar(c.S, c.R, sh); c.S.screen = 'play'; if (sh.gifts.some((o) => o.id === 'fire_pierce')) out.push('gift: a power already held is offered again'); if (sh.gifts[2].id === 'fire_split') line++; } if (line / N < 0.4) out.push(`gift: the ball's line came up ${line} of ${N}`); }
    { const c = stage('warrior'); const sh = { x: 0, y: 0, gifts: [{ id: 'whirl_pull', cost: 1 }] }; c.R.shrines.push(sh); c.S.meta.shards = 5; SIMX.takeGift(c.S, c.R, sh, 0, 0, 0); if (!D.hasPower(c.h, 'whirl_pull') || c.h.perks.whirl_pull || c.S.meta.shards !== 4 || !sh.used) out.push('gift: a power is not given as a gift'); const j = JSON.parse(JSON.stringify(c.R)); if (!D.hasPower(j.hero, 'whirl_pull')) out.push('gift: a taken power is lost in the save'); }
  }
  function checkRelics(out) {
    for (const cl of ['warrior', 'mage', 'archer']) { const c = stage(cl), C = D.CLASSES[cl]; for (const a of C.abs) c.h.ab[a.id] = 1; const seen = new Set();
      for (let i = 0; i < 200; i++) { const sh = { x: 0, y: 0 }; c.R.shrines.push(sh); SIMX.openAltar(c.S, c.R, sh); c.S.screen = 'play'; if (sh.gifts.length !== 4) { out.push(`relic: a ${cl}'s altar has ${sh.gifts.length} offers`); break; } seen.add(sh.gifts[3].id); }
      const want = D.GIFTS.filter((g) => g.relic && (!g.ab || C.abilities.includes(g.ab))); if (want.length < 4 || want.some((g) => !seen.has(g.id))) out.push(`relic: a ${cl} gets ${[...seen]} of ${want.map((g) => g.id)}`);
      c.h.powers = Object.fromEntries(want.slice(0, D.RELIC_MAX).map((g) => [g.id, 1])); const sh = { x: 0, y: 0 }; c.R.shrines.push(sh); SIMX.openAltar(c.S, c.R, sh); c.S.screen = 'play'; if (sh.gifts.length !== 3) out.push(`relic: a ${cl} with ${D.RELIC_MAX} relics is offered another`); }
    { const c = stage(); c.h.powers = { rl_fifth: 1 }; const b = foe(c.R, c.h, 80), hp = b.hp; for (let i = 0; i < 4; i++) { const e = foe(c.R, c.h, 30); killEnemy(c.S, c.R, e); } if (b.hp !== hp) out.push('relic: the fifth death came early'); killEnemy(c.S, c.R, foe(c.R, c.h, 30)); if (!(b.hp < hp)) out.push('relic: the fifth death did not blow'); }
    { const c = stage(); c.h.powers = { rl_scroll: 1 }; c.h.hp = 1; SIMX.firePowers(c.S, c.R, 'scroll', {}); if (c.h.hp !== SIMX.heroSt(c.S).maxHp) out.push(`relic: the scroll healed to ${c.h.hp}`); }
    { const c = stage('mage'); c.h.powers = { rl_phalanx: 1 }; const e = foe(c.R, c.h, 60); c.h.shield = 1; c.h.shieldUntil = c.S.t + 5; c.h.ifr = 0; c.h.dashT = -9; for (let i = 0; i < 40 && c.h.shield > 0; i++) hurtHero(c.S, c.R, 50, c.h.x + 9, c.h.y); if (!(e.kbx > 0)) out.push('relic: the broken shield threw no one'); }
    { const c = stage('archer'); c.h.powers = { rl_quiver: 1 }; const e = foe(c.R, c.h, 100); for (let i = 0; i < 4; i++) heroHit(c.S, c.R, e, 1, false, c.h.x, c.h.y); if (!c.R.proj.some((p) => p.k === 'arrow')) out.push('relic: the fourth arrow called no other'); }
    if (D.giftCost(4, 1) <= 2 * D.giftCost(3, 1)) out.push('relic: not dear');
  }
  function checkEvolutions(out) {
    for (const g of D.GIFTS.filter((q) => q.needs)) { const c = stage('warrior'); if (D.giftPool(c.h, 3).some((q) => q.id === g.id)) out.push(`evo: ${g.id} is in the plain pool`); for (const n of g.needs) if (!D.POWERS[n]) out.push(`evo: ${g.id} needs ${n}, no such power`);
      const ab = D.POWERS[g.needs[0]].ab; if (ab && g.needs.some((n) => D.POWERS[n].ab && !Object.values(D.CLASSES).find((C) => C.abilities.includes(ab)).abilities.includes(D.POWERS[n].ab))) out.push(`evo: ${g.id} needs two classes' powers`);
      if (g.ab !== undefined && !Object.values(D.CLASSES).some((C) => C.abilities.includes(g.ab))) out.push(`evo: ${g.id} has no class`);
      c.h.powers = { [g.needs[0]]: 1 }; if (D.evosReady(c.h).some((q) => q.id === g.id)) out.push(`evo: ${g.id} ready with one of two`); c.h.powers[g.needs[1]] = 1; if (!D.evosReady(c.h).some((q) => q.id === g.id)) out.push(`evo: ${g.id} not ready with both`);
      const sh = { x: 0, y: 0 }; c.R.shrines.push(sh); SIMX.openAltar(c.S, c.R, sh); c.S.screen = 'play'; if (sh.gifts[2].id !== g.id) out.push(`evo: the altar's dear card is ${sh.gifts[2].id}, not ${g.id}`);
      c.h.powers[g.id] = 1; if (D.evosReady(c.h).some((q) => q.id === g.id)) out.push(`evo: ${g.id} offered twice`); }
    { const c = stage('mage'); c.h.powers = { fire_split: 1, ev_comet: 1 }; castAbility(c.S, c.R, 'fireball', {}); if (c.R.proj.length !== 5) out.push(`evo: the comet is ${c.R.proj.length} balls`); }
  }
  function checkAltarExtras(out) {
    { const c = stage('warrior'), sh = { x: 0, y: 0 }; c.R.shrines.push(sh); SIMX.openAltar(c.S, c.R, sh); c.S.screen = 'play'; c.S.meta.shards = 100; const c0 = D.rerollCost(0, 1), c1 = D.rerollCost(1, 1); if (c1 <= c0) out.push('reroll: not dearer the second time');
      SIMX.rerollAltar(c.S, c.R, sh, 0, 0); if (c.S.meta.shards !== 100 - c0 || sh.rolls !== 1 || !sh.gifts.length) out.push('reroll: did not charge and change'); SIMX.rerollAltar(c.S, c.R, sh, 0, 0); if (c.S.meta.shards !== 100 - c0 - c1) out.push('reroll: the second price is wrong');
      const j = JSON.parse(JSON.stringify(sh)); if (j.rolls !== 2) out.push('reroll: the count is lost in the save'); c.S.meta.shards = 1; const g = sh.gifts; SIMX.rerollAltar(c.S, c.R, sh, 0, 0); if (sh.gifts !== g || c.S.meta.shards !== 1) out.push('reroll: a poor hero changed the gifts'); c.S.meta.shards = 99; sh.used = 1; SIMX.rerollAltar(c.S, c.R, sh, 0, 0); if (sh.gifts !== g) out.push('reroll: a spent altar changed its gifts'); }
    { const c = stage(); const sh = { x: 0, y: 0, gifts: [{ id: 'fury', cost: 1 }] }; c.R.shrines.push(sh); c.h.perks = { fury: 1 }; c.S.meta.shards = 5; SIMX.takeGift(c.S, c.R, sh, 0, 0, 0); if (c.h.perks.fury !== 2) out.push('rank: a gift held does not stack'); }
  }
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
    checkPowerPack(out); checkPowerGifts(out); checkRelics(out); checkEvolutions(out); checkAltarExtras(out);
  }
  Object.assign(SIMX, { checkPowers });
})(typeof window !== 'undefined' ? window : globalThis);
