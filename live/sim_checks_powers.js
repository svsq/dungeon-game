// live/sim_checks_powers.js — selfCheck's part for the powers (TASKS 356 and on). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, TILE, castAbility, hitEnemy, heroHit, hurtHero, killEnemy, newRun, spawn, usePotion } = SIMX;
  const allOpen = () => Object.fromEntries(D.UNLOCKS.map((U) => [U.id, 1]));
  const stage = (cls = 'warrior', seed = 91) => { const S = spawn(0, {}), R = newRun(S, 'campaign', seed, { cls }); S.run = R; S.screen = 'play'; S.t = R.t = 10; S.meta.open = allOpen(); const h = R.hero, m = R.map, cx = m.W >> 1, cy = m.H >> 1; for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 9; x <= cx + 9; x++) m.cells[y * m.W + x] = 1; h.x = cx * TILE + 16; h.y = cy * TILE + 18; R.en = []; R.proj = []; R.fires = []; h.hp = 1e4; for (const a of D.clsOf(h).abs) { h.ab[a.id] = 1; h.cd[a.id] = 0; } h.mp = 1e3; return { S, R, h }; };
  const foe = (R, h, dx = 60, dy = 0, type = 'skeleton') => { const e = { id: R.nextId++, type, x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, hp: 1e5, max: 1e5, dmg: 1, elite: 0, room: -1, st: 'chase', t0: 0, face: 1, aimA: 0, cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, phase: 0, summ: 0, hx: h.x, hy: h.y, seenT: 0, ft: -9 }; R.en.push(e); return e; };
  function grant(h, id, P) { D.POWERS[id] = P; (h.powers = h.powers || {})[id] = 1; }
  // a fireball thrown right into a pack of eight: every ball, blast and shard flies out and the damage the pack took is summed
  const crowdFire = (ids) => { const c = stage('mage'), h = c.h; h.powers = Object.fromEntries(ids.map((i) => [i, 1])); h.aim = 0; const pack = [];
    for (let i = 0; i < 8; i++) pack.push(foe(c.R, h, 90 + (i >> 1) * 45, (i & 1 ? 1 : -1) * 22 + 20));
    c.S.ev = []; castAbility(c.S, c.R, 'fireball', {}); for (let i = 0; i < 120 && c.R.proj.length; i++) { c.S.t += SIMX.DT; SIMX.stepProjectiles(c.S, c.R); }
    return { dmg: pack.reduce((n, e) => n + e.max - e.hp, 0), shards: c.S.ev.filter((e) => e.k === 'boom' && e.vr).length }; };
  const hits = (S, id) => S.ev.filter((e) => e.k === 'power' && e.id === id).length;
  function checkPowerGifts(out) {
    for (const cl of ['warrior', 'mage', 'archer']) { const c = stage(cl), C = D.CLASSES[cl], seen = new Set();
      for (const a of C.abs) c.h.ab[a.id] = 1;
      for (let i = 0; i < 300; i++) { const sh = { x: 0, y: 0 }; c.R.shrines.push(sh); c.R.altar = c.R.shrines.length - 1; SIMX.openAltar(c.S, c.R, sh); c.S.screen = 'play'; for (const o of sh.gifts) { seen.add(o.id); const g = D.GIFTS.find((q) => q.id === o.id); if (g.power && ((g.ab && !C.abilities.includes(g.ab)) || (g.cls && g.cls !== cl))) out.push(`gift: a ${cl}'s altar offers ${o.id}`); } }
      for (const g of D.GIFTS) if (g.power && !g.needs && (!g.ab || C.abilities.includes(g.ab)) && (!g.cls || g.cls === cl) && g.tier < 4 && !seen.has(g.id)) out.push(`gift: a ${cl} never gets offered ${g.id}`);
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
  // the charge's, the cry's and the ice wave's powers (TASKS 1819)
  function checkAbilityPowers(out) {
    const own = (c, ...ids) => { c.h.powers = Object.fromEntries(ids.map((i) => [i, 1])); };
    { const c = stage('warrior'); own(c, 'charge_quake'); const a = foe(c.R, c.h, 60), b = foe(c.R, c.h, 100), far = foe(c.R, c.h, 400); SIMX.firePowers(c.S, c.R, 'chargeHit', { e: a, x: a.x, y: a.y }); if (!(b.rootT > c.S.t) || far.rootT > c.S.t) out.push('power: the charge\'s blow does not stun its neighbours alone');
      a.rootT = c.S.t + D.CHARGE.stun; SIMX.firePowers(c.S, c.R, 'chargeHit', { e: a, x: a.x, y: a.y }); if (a.rootT < c.S.t + D.CHARGE.stun) out.push(`power: the quake cuts its charge's own stun to ${(a.rootT - c.S.t).toFixed(2)} s`);
      const fz = foe(c.R, c.h, 0, 80); fz.rootT = c.S.t + 5; SIMX.firePowers(c.S, c.R, 'chargeHit', { e: fz, x: fz.x, y: fz.y }); if (fz.rootT < c.S.t + 5) out.push('power: a stun from a power cuts a longer one short'); }
    { const c = stage('warrior'); own(c, 'ev_ram'); const a = foe(c.R, c.h, 60), b = foe(c.R, c.h, 120), hp = b.hp; SIMX.firePowers(c.S, c.R, 'chargeHit', { e: a, x: a.x, y: a.y }); if (!(b.hp < hp)) out.push('evo: the ram does not strike around its target'); }
    { const c = stage('warrior'); own(c, 'cry_mirror'); c.h.aim = 0; const e = foe(c.R, c.h, 160), hp = e.hp, hurts = () => c.S.ev.filter((q) => q.k === 'hurt').length; castAbility(c.S, c.R, 'cry', {}); c.S.ev = [];
      c.R.proj.push({ id: c.R.nextId++, src: e.id, who: 'x', k: 'arrow', x: c.h.x + 30, y: c.h.y - 38, vx: -400, vy: 0, t0: c.S.t, life: 2, dmg: 50, own: 'en' });
      for (let i = 0; i < 120 && c.R.proj.length; i++) { c.S.t += SIMX.DT; SIMX.stepProjectiles(c.S, c.R); }
      if (hurts() || !(e.hp < hp)) out.push(`power: the cry's mirror let ${hurts()} through and sent ${hp - e.hp} back`);
      c.S.t += 4; c.R.proj.push({ id: c.R.nextId++, src: e.id, who: 'x', k: 'arrow', x: c.h.x + 10, y: c.h.y - 38, vx: -400, vy: 0, t0: c.S.t, life: 2, dmg: 50, own: 'en' }); c.h.ifr = 0; c.h.dashT = -9; for (let i = 0; i < 20 && c.R.proj.length; i++) { c.S.t += SIMX.DT; SIMX.stepProjectiles(c.S, c.R); } if (!hurts()) out.push('power: the cry\'s mirror outlives its time'); }
    { const c = stage('warrior'); own(c, 'cry_push'); const e = foe(c.R, c.h, 70); castAbility(c.S, c.R, 'cry', {}); if (!(e.kbx > 0)) out.push('power: the cry does not push'); }
    { const c = stage('mage'); own(c, 'frost_freeze'); c.h.aim = 0; const a = foe(c.R, c.h, 80, -20), b = foe(c.R, c.h, 80, 20); SIMX.chill(c.S, a, 2, 0.6); castAbility(c.S, c.R, 'frost', {}); if (!(a.rootT > c.S.t) || b.rootT > c.S.t) out.push('power: the wave freezes the wrong ones'); }
    for (const id of ['frost_brittle', 'ev_glacier']) { const c = stage('mage'); own(c, id); const look = (b) => (id === 'frost_brittle' ? b.chillT > c.S.t : b.hp < b.max);
      const a = foe(c.R, c.h, 200), b = foe(c.R, c.h, 240); killEnemy(c.S, c.R, a); if (look(b)) out.push(`power: ${id} fires on a warm death`);
      const a2 = foe(c.R, c.h, 200, 100), b2 = foe(c.R, c.h, 240, 100); SIMX.chill(c.S, a2, 2, 0.6); killEnemy(c.S, c.R, a2); if (!look(b2)) out.push(`power: ${id} does not fire on a cold death`); }
  }
  function checkEvolutions(out) {
    for (const g of D.GIFTS.filter((q) => q.needs)) { const c = stage('warrior'); if (D.giftPool(c.h, 3).some((q) => q.id === g.id)) out.push(`evo: ${g.id} is in the plain pool`); for (const n of g.needs) if (!D.POWERS[n]) out.push(`evo: ${g.id} needs ${n}, no such power`);
      const ab = D.POWERS[g.needs[0]].ab; if (ab && g.needs.some((n) => D.POWERS[n].ab && !Object.values(D.CLASSES).find((C) => C.abilities.includes(ab)).abilities.includes(D.POWERS[n].ab))) out.push(`evo: ${g.id} needs two classes' powers`);
      if (g.ab !== undefined && !Object.values(D.CLASSES).some((C) => C.abilities.includes(g.ab))) out.push(`evo: ${g.id} has no class`);
      c.h.powers = { [g.needs[0]]: 1 }; if (D.evosReady(c.h).some((q) => q.id === g.id)) out.push(`evo: ${g.id} ready with one of two`); c.h.powers[g.needs[1]] = 1; if (!D.evosReady(c.h).some((q) => q.id === g.id)) out.push(`evo: ${g.id} not ready with both`);
      const sh = { x: 0, y: 0 }; c.R.shrines.push(sh); SIMX.openAltar(c.S, c.R, sh); c.S.screen = 'play'; if (sh.gifts[2].id !== g.id) out.push(`evo: the altar's dear card is ${sh.gifts[2].id}, not ${g.id}`);
      c.h.powers[g.id] = 1; if (D.evosReady(c.h).some((q) => q.id === g.id)) out.push(`evo: ${g.id} offered twice`); }
    { const c = stage('mage'); c.h.powers = { fire_split: 1, fire_pierce: 1, ev_comet: 1 }; castAbility(c.S, c.R, 'fireball', {}); if (c.R.proj.length !== 3 || c.R.proj.some((p) => !p.frag || p.frag.n !== 5)) out.push(`evo: the comet is ${c.R.proj.length} balls of ${c.R.proj.map((p) => p.frag && p.frag.n)} shards`);
      const one = crowdFire(['fire_pierce', 'ev_comet']); if (one.shards !== 5) out.push(`evo: the comet's ball broke into ${one.shards} shards`); }
  }
  function checkAltarExtras(out) {
    { const c = stage('warrior'), sh = { x: 0, y: 0 }; c.R.shrines.push(sh); SIMX.openAltar(c.S, c.R, sh); c.S.screen = 'play'; c.S.meta.shards = 100; const c0 = D.rerollCost(0, 1), c1 = D.rerollCost(1, 1); if (c1 <= c0) out.push('reroll: not dearer the second time');
      SIMX.rerollAltar(c.S, c.R, sh, 0, 0); if (c.S.meta.shards !== 100 - c0 || sh.rolls !== 1 || !sh.gifts.length) out.push('reroll: did not charge and change'); SIMX.rerollAltar(c.S, c.R, sh, 0, 0); if (c.S.meta.shards !== 100 - c0 - c1) out.push('reroll: the second price is wrong');
      const j = JSON.parse(JSON.stringify(sh)); if (j.rolls !== 2) out.push('reroll: the count is lost in the save'); c.S.meta.shards = 1; const g = sh.gifts; SIMX.rerollAltar(c.S, c.R, sh, 0, 0); if (sh.gifts !== g || c.S.meta.shards !== 1) out.push('reroll: a poor hero changed the gifts'); c.S.meta.shards = 99; sh.used = 1; SIMX.rerollAltar(c.S, c.R, sh, 0, 0); if (sh.gifts !== g) out.push('reroll: a spent altar changed its gifts'); }
    { const c = stage(); const sh = { x: 0, y: 0, gifts: [{ id: 'fury', cost: 1 }] }; c.R.shrines.push(sh); c.h.perks = { fury: 1 }; c.S.meta.shards = 5; SIMX.takeGift(c.S, c.R, sh, 0, 0, 0); if (c.h.perks.fury !== 2) out.push('rank: a gift held does not stack'); }
  }
  function checkKits(out) {
    for (const cl of Object.keys(D.CLASSES)) { const list = D.kitsOf(cl); if (list.length < 2) out.push(`kit: ${cl} has ${list.length}`); if (list[0].power) out.push(`kit: ${cl}'s plain kit has a passive`);
      for (const k of list) { if (!D.wears(cl, k.weapon) || D.BASES[k.weapon].slot !== 'weapon') out.push(`kit: ${k.id}'s weapon is not a ${cl}'s`); if (k.power && !D.POWERS[k.power]) out.push(`kit: ${k.id} has no power ${k.power}`);
        const S = spawn(0, {}); S.meta.open = allOpen(); S.meta.kit = { [cl]: k.id }; const R = newRun(S, 'campaign', 92, { cls: cl }); if (R.hero.eq.weapon.b !== k.weapon) out.push(`kit: ${k.id} starts with ${R.hero.eq.weapon.b}`); if (k.power ? !D.hasPower(R.hero, k.power) : Object.keys(R.hero.powers || {}).some((q) => !q.startsWith('th_'))) out.push(`kit: ${k.id} starts with powers ${JSON.stringify(R.hero.powers)}`); }
      const S = spawn(0, {}), R = newRun(S, 'campaign', 93, { cls: cl }); if (R.hero.kit !== D.kitsOf(cl)[0].id || R.hero.eq.weapon.b !== D.CLASSES[cl].start.weapon) out.push(`kit: an unchosen ${cl} starts differently`); S.meta.kit = { [cl]: 'nope' }; if (D.kitOf(S.meta, cl).id !== list[0].id) out.push(`kit: a stale saved kit of a ${cl} is taken`); }
    { const S = spawn(0, {}); S.meta.open = allOpen(); S.screen = 'classes'; S.pendingMode = 'campaign'; S.meta.cls = 'warrior'; const b = D.UI.classes(S.meta).find((q) => q.id === 'kit:warrior'); if (b) { SIMX.step(S, { keys: [], px: b.x + 5, py: b.y + 5, click: 1 }); if (D.kitOf(S.meta, 'warrior').id !== 'w_axe') out.push(`kit: the button chose ${D.kitOf(S.meta, 'warrior').id}`); } else out.push('kit: no button'); }
  }
  function checkUnlocks(out) {
    for (const U of D.UNLOCKS) { if (U.kind === 'gift' ? !D.GIFTS.some((g) => g.id === U.ref) : !D.KITS.some((k) => k.id === U.ref)) out.push(`unlock: ${U.id} names nothing`); if (!U.cost && !D.ACHIEVE.some((a) => a.id === U.ach)) out.push(`unlock: ${U.id} has no way to open`); }
    { const c = stage('warrior'); c.S.meta.open = {}; const has = () => D.giftPool(c.h, 3, c.S.meta).some((g) => g.id === 'whirl_ring'); if (has()) out.push('unlock: a closed gift is in the pool'); const U = D.UNLOCKS.find((q) => q.ref === 'whirl_ring'); c.S.meta.shards = U.cost - 1; SIMX.buyUnlock(c.S, U, 0, 0); if (has()) out.push('unlock: bought without the shards'); c.S.meta.shards = U.cost; SIMX.buyUnlock(c.S, U, 0, 0); if (!has() || c.S.meta.shards !== 0) out.push('unlock: not bought for its price'); SIMX.buyUnlock(c.S, U, 0, 0); if (c.S.meta.shards !== 0) out.push('unlock: bought twice'); }
    { const c = stage('warrior'); c.S.meta.open = {}; if (D.kitsOf('warrior', c.S.meta).length !== 1) out.push('unlock: a closed kit is on the screen'); }
    { const c = stage('warrior'); c.S.meta.open = {}; c.S.run = c.R; const U = D.UNLOCKS.find((q) => q.ach === 'a_elites'); for (let i = 0; i < 24; i++) SIMX.metaEvent(c.S, { k: 'kill', elite: 1, type: 'brute' }); if (c.S.meta.open[U.id]) out.push('unlock: the deed paid early'); SIMX.metaEvent(c.S, { k: 'kill', elite: 0, type: 'brute' }); if (c.S.meta.open[U.id]) out.push('unlock: a plain kill counted'); SIMX.metaEvent(c.S, { k: 'kill', elite: 1, type: 'brute' }); if (!c.S.meta.open[U.id]) out.push('unlock: the deed never paid'); SIMX.buyUnlock(c.S, U, 0, 0); }
    { const c = stage('warrior'); c.S.meta.open = { g_rl_pyre: 1 }; const j = JSON.parse(JSON.stringify(SIMX.persist(c.S))); if (!j.meta.open.g_rl_pyre) out.push('unlock: not in the save'); }
    { const c = stage('warrior'); c.S.meta.open = {}; const n = D.UI.meta('warrior', 'open').filter((b) => b.un !== undefined).length; if (n !== D.UNLOCKS.length) out.push(`unlock: ${n} rows of ${D.UNLOCKS.length}`); for (const b of D.UI.unlocks()) if (b.y + b.h > 890 || b.x + b.w > 1920) out.push('unlock: a row runs off the screen'); }
  }
  function checkCodex(out) {
    for (const t of D.CODEX_TABS) { if (!D.codexList(t).length) out.push(`codex: tab ${t} is empty`); for (let p = 0; ; p++) { const U = D.UI.codex(t, p); for (const b of U.r) if (b.x + b.w > 1920 || b.y + b.h > 1080) out.push('codex: a row runs off the screen'); if (U.page !== p || p >= U.pages - 1) break; } }
    const c = stage('warrior'); c.S.meta.codex = {}; c.S.demo = 0; SIMX.metaEvent(c.S, { k: 'hit', type: 'skeleton', id: 1, x: 0, y: 0 }); SIMX.metaEvent(c.S, { k: 'pickup', b: 'sword' }); SIMX.metaEvent(c.S, { k: 'bless', id: 'whirl_pull' }); SIMX.metaEvent(c.S, { k: 'bless', id: 'fury' });
    if (!c.S.meta.codex.m.skeleton || !c.S.meta.codex.it.sword || !c.S.meta.codex.p.whirl_pull || c.S.meta.codex.p.fury) out.push('codex: meetings are not written down');
    { const S = spawn(0, {}); S.demo = 1; S.ev = []; SIMX.ev(S, { k: 'kill', type: 'skeleton', x: 0, y: 0 }); if (S.meta.codex) out.push('codex: the attract demo writes in it'); }
    { const S = spawn(0, {}); S.screen = 'meta'; const b = D.UI.meta('warrior').find((q) => q.id === 'codex'); SIMX.step(S, { keys: [], px: b.x + 5, py: b.y + 5, click: 1 }); if (S.screen !== 'codex') out.push('codex: the button does not open it'); SIMX.step(S, { keys: ['Escape'] }); if (S.screen !== 'meta') out.push('codex: Escape does not lead back'); }
  }
  function checkForks(out) {
    for (const cl of Object.keys(D.CLASSES)) for (const ab of D.CLASSES[cl].abilities) { if (!D.FORKS[ab]) { out.push(`fork: ${ab} has none`); continue; } for (const rank of D.FORK_RANKS) { const pair = D.FORKS[ab][rank]; if (!pair || pair.length !== 2) out.push(`fork: ${ab}@${rank} is not two ways`); for (const id of pair || []) { const P = D.POWERS[id]; if (!P || !P.name || !P.desc || !SIMX.POWER_FX[P.fx]) out.push(`fork: ${id} is broken`); } } }
    { const c = stage('mage'), h = c.h; h.ab = { fireball: 2, shield: 1, frost: 0 }; if (D.forkPending(h)) out.push('fork: owed before its rank'); h.ab.fireball = 3; const p = D.forkPending(h); if (!p || p.ab !== 'fireball' || p.rank !== 3) out.push('fork: not owed at rank 3'); SIMX.chooseFork(c.S, c.R, 1); if (D.forkPending(h) || !D.hasPower(h, 'f_fireball_3b') || D.hasPower(h, 'f_fireball_3a')) out.push('fork: the choice did not take'); }
    { const c = stage('mage'), h = c.h; h.ab = { fireball: 2, shield: 1, frost: 0 }; h.sp = 1; c.S.screen = 'inv'; const b = D.UI.inv(D.clsOf(h).abs).r.find((q) => q.id === 'ab:fireball'); SIMX.step(c.S, { keys: [], px: b.x + 5, py: b.y + 5, click: 1 }); if (c.S.screen !== 'fork') out.push(`fork: the rank up leads to ${c.S.screen}`); SIMX.step(c.S, { keys: ['Escape'] }); if (c.S.screen !== 'inv') out.push('fork: Escape does not put it off'); h.sp = 1; const r = h.ab.fireball; SIMX.step(c.S, { keys: [], px: b.x + 5, py: b.y + 5, click: 1 }); if (c.S.screen !== 'fork' || h.ab.fireball !== r) out.push('fork: a rank went past a choice owed'); const u = D.UI.fork()[0], v = D.UI.fork()[1], press = (q) => SIMX.step(c.S, { keys: [], px: q.x + 5, py: q.y + 5, click: 1 });
      press(u); if (c.S.screen !== 'fork' || D.hasPower(h, 'f_fireball_3a') || c.S.forkSel !== 0) out.push('fork: one press chooses, or does not light the card');
      SIMX.step(c.S, { keys: ['Escape'] }); if (c.S.screen !== 'fork' || c.S.forkSel != null) out.push('fork: Escape does not let the lit card go first');
      press(u); SIMX.step(c.S, { keys: [], px: 5, py: 5, click: 1 }); if (c.S.forkSel != null || D.forkPending(h) === null) out.push('fork: a press elsewhere does not let the lit card go');
      press(u); press(v); if (c.S.forkSel !== 1 || D.hasPower(h, 'f_fireball_3a') || D.hasPower(h, 'f_fireball_3b')) out.push('fork: a press on the other card chooses instead of lighting it');
      press(u); press(u); if (c.S.screen !== 'inv' || !D.hasPower(h, 'f_fireball_3a') || c.S.forkSel != null) out.push('fork: the second press on the card did not choose'); }
    // a visit's points are a draft (TASKS 1857): the reset takes them back to the point, closing the page keeps them, a save between
    // keeps them as put in, and nothing can be taken back on a later visit
    { const c = stage('warrior'), h = c.h, S = c.S, U = D.UI.inv(D.clsOf(h).abs), at = (id) => { const q = U.r.find((b) => b.id === id); SIMX.step(S, { keys: [], px: q.x + 5, py: q.y + 5, click: 1 }); };
      h.pts = 3; h.sp = 2; h.lvl = 4; h.ab = { whirl: 1, charge: 1, cry: 1 }; h.hp = 50; h.mp = 10; S.screen = 'inv'; const b0 = JSON.stringify(h.base), hp0 = h.hp, mp0 = h.mp, ab0 = JSON.stringify(h.ab);
      at('stat:vit'); at('stat:vit'); at('stat:str'); at('ab:charge'); at('ab:whirl');
      if (h.pts || h.sp || h.base.vit !== JSON.parse(b0).vit + 2 || h.ab.whirl !== 2 || h.ab.charge !== 2) out.push('draft: points do not go in while the page is open');
      at('reset:st'); if (JSON.stringify(h.base) !== b0 || h.pts !== 3 || h.hp !== hp0 || h.mp !== mp0 || h.ab.whirl !== 2) out.push(`draft: the reset does not give the stat points back (${h.pts}, ${h.hp}/${hp0})`);
      at('reset:ab'); if (JSON.stringify(h.ab) !== ab0 || h.sp !== 2 || h.draft) out.push('draft: the reset does not give the ranks back, or the draft stays');
      at('stat:agi'); const kept = JSON.parse(JSON.stringify(c.R)); at('close');
      if (S.screen !== 'play' || h.draft || h.pts !== 2 || h.base.agi !== JSON.parse(b0).agi + 1) out.push('draft: closing the page does not keep the points');
      S.screen = 'inv'; at('reset:st'); if (h.pts !== 2) out.push('draft: points of a closed visit are taken back');
      S.run = kept; S.screen = 'play'; SIMX.step(S, { keys: [] }); if (kept.hero.draft || kept.hero.pts !== 2 || kept.hero.base.agi !== JSON.parse(b0).agi + 1) out.push('draft: a run saved mid-draft loads with its draft or without its points');
      const f = stage('mage'), fh = f.h; fh.ab = { fireball: 2, shield: 1 }; fh.sp = 1; fh.lvl = 9; f.S.screen = 'inv'; const fb = D.UI.inv(D.clsOf(fh).abs).r.find((q) => q.id === 'ab:fireball');
      SIMX.step(f.S, { keys: [], px: fb.x + 5, py: fb.y + 5, click: 1 }); const u = D.UI.fork()[1]; for (let i = 0; i < 2; i++) SIMX.step(f.S, { keys: [], px: u.x + 5, py: u.y + 5, click: 1 });
      if (f.S.screen !== 'inv' || fh.draft || !D.hasPower(fh, 'f_fireball_3b')) out.push('draft: a fork taken does not keep the rank under it'); }
    { const c = stage('mage'); c.h.powers = { f_fireball_3a: 1 }; const d0 = 100; const p = { dmg: d0, vx: 10, vy: 0, life: 1, pierce: 0 }; SIMX.firePowers(c.S, c.R, 'cast:fireball', { projs: [p] }); if (p.dmg !== 125 || Math.abs(p.vx - 8) > 1e-9) out.push(`fork: the heavy ball is ${p.dmg}, ${p.vx}`); }
    { const c = stage('mage'); c.h.powers = { f_shield_3a: 1 }; c.h.ab.shield = 1; castAbility(c.S, c.R, 'shield', {}); const n = D.shieldHp(SIMX.heroSt(c.S).int, 1, 1); if (c.h.shield !== Math.round(n * 1.3)) out.push(`fork: the shield holds ${c.h.shield}, not ${Math.round(n * 1.3)}`); }
    { const c = stage('mage'); c.h.powers = { th_mage: 1 }; c.h.base.int = 1; castAbility(c.S, c.R, 'fireball', {}); if (c.R.proj[0].frag) out.push('threshold: the ball shatters below INT 25'); const d = stage('mage'); d.h.powers = { th_mage: 1 }; d.h.base.int = 30; castAbility(d.S, d.R, 'fireball', {}); if (!d.R.proj[0].frag) out.push('threshold: no shatter at INT 25'); }
    { const c = stage('archer'), h = c.h; h.base.agi = 30; h.cd.dash = 0; SIMX.step(c.S, { keys: ['Space'], px: 960, py: 540 }); const d1 = h.cd.dash; if (!(d1 > c.S.t)) out.push('threshold: the dash did not spend'); h.dashT = -9; SIMX.step(c.S, { keys: ['Space'], px: 960, py: 540 }); if (!(h.cd.dash2 > c.S.t)) out.push('threshold: no second dash at AGI 20'); }
    { const c = stage('archer'), h = c.h; h.base.agi = 1; h.cd.dash = 1e9; h.dashT = -9; SIMX.step(c.S, { keys: ['Space'], px: 960, py: 540 }); if (h.dashT >= 0) out.push('threshold: a second dash below AGI 20'); }
    { const c = stage('warrior'); c.h.base.str = 30; c.h.thTip = 0; SIMX.thresholdTip(c.S, c.R); if (!c.R.msg || !c.h.thTip) out.push('threshold: no word of it'); }
  }
  function checkStale(out) {
    const buy = (c, id) => { const sh = { x: 0, y: 0, gifts: [{ id, cost: 1 }] }; c.R.shrines.push(sh); c.S.meta.shards = 5; c.S.ev = []; SIMX.takeGift(c.S, c.R, sh, 0, 0, 0); return sh; };
    { const c = stage('warrior'); c.h.powers = { rl_fifth: 1, rl_scroll: 1, rl_pyre: 1 }; const sh = buy(c, 'rl_maelstrom'); if (D.relicsOf(c.h) !== D.RELIC_MAX || sh.used || c.S.meta.shards !== 5 || !c.S.ev.some((e) => e.k === 'nope')) out.push(`stale: an altar opened early gave relic ${D.relicsOf(c.h)}`); }
    { const c = stage('warrior'); c.h.powers = { whirl_pull: 1 }; const sh = buy(c, 'whirl_pull'); if (sh.used || c.S.meta.shards !== 5) out.push('stale: shards taken for a power already held'); }
    { const c = stage('warrior'); c.h.powers = { rl_fifth: 1, rl_scroll: 1 }; const sh = buy(c, 'rl_pyre'); if (!sh.used || !D.hasPower(c.h, 'rl_pyre')) out.push('stale: the third relic is refused'); }
    for (const [cl, id] of [['warrior', 'th_warrior'], ['mage', 'th_mage']]) { const S = spawn(0, {}), R = newRun(S, 'campaign', 94, { cls: cl }); delete R.hero.powers; const J = JSON.parse(JSON.stringify(R)); SIMX.migrateAbilities(J); if (!D.hasPower(J.hero, id)) out.push(`save: an old ${cl} gets no threshold power`); J.hero.powers.whirl_pull = 1; const n = JSON.stringify(J.hero.powers); SIMX.migrateAbilities(J); if (JSON.stringify(J.hero.powers) !== n) out.push(`save: migrating an old ${cl} twice changes the powers`); }
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 95, { cls: 'archer' }); SIMX.migrateAbilities(R); if (R.hero.powers) out.push('save: an archer gets a power from the threshold migration'); }
  }
  function checkPr48(out) {
    const hit = (c, n) => { c.h.ifr = 0; c.h.dashT = -9; c.S.ev = []; for (let i = 0; i < 80 && !c.S.ev.some((e) => e.k === 'absorb'); i++) hurtHero(c.S, c.R, n, c.h.x + 9, c.h.y); };
    { const c = stage('mage'); c.h.powers = { f_shield_6a: 1 }; const e = foe(c.R, c.h, 40), hp = e.hp; c.h.shield = 1e4; c.h.shieldUntil = c.S.t + 9; hit(c, 5); if (!(e.hp < hp)) out.push('shield hit: a blow the shield took whole gets no answer'); }
    { const c = stage('mage'); c.h.powers = { f_shield_6a: 1 }; const e = foe(c.R, c.h, 40), hp = e.hp; c.h.shield = 1; c.h.shieldUntil = c.S.t + 9; hit(c, 500); if (!(e.hp < hp)) out.push('shield hit: the blow that breaks the shield gets no answer'); }
    { const c = stage('mage'); c.h.powers = { f_shield_6a: 1 }; const e = foe(c.R, c.h, 40), hp = e.hp; c.h.ifr = 0; c.h.dashT = -9; for (let i = 0; i < 20; i++) hurtHero(c.S, c.R, 1, c.h.x + 9, c.h.y); if (e.hp !== hp) out.push('shield hit: answered with no shield up'); }
    { const c = stage('mage'), e = foe(c.R, c.h, 200); c.h.powers = { f_frost_3a: 1, kit_long: 1 }; e.cdT = 1e9; SIMX.firePowers(c.S, c.R, 'cast:frost', { x: e.x, y: e.y }); for (let i = 0; i < 5; i++) SIMX.step(c.S, { keys: [], px: 960, py: 540 }); if (e.slowK !== 0.45) out.push(`slow: the deep frost slows to ${e.slowK} a step on`);
      SIMX.POWER_FX.slow(c.S, c.R, D.POWERS.kit_long, { e }); for (let i = 0; i < 5; i++) SIMX.step(c.S, { keys: [], px: 960, py: 540 }); if (e.slowK !== 0.45) out.push(`slow: a weaker chill thinned a stronger one to ${e.slowK}`);
      e.chillT = c.S.t; for (let i = 0; i < 5; i++) SIMX.step(c.S, { keys: [], px: 960, py: 540 }); if (e.slowK !== 1) out.push(`slow: the chill does not thaw (${e.slowK})`); }
    const cast = (ids) => { const c = stage('mage'); c.h.powers = Object.fromEntries(ids.map((i) => [i, 1])); castAbility(c.S, c.R, 'fireball', {}); return c.R.proj.map((p) => [p.dmg, p.pierce || 0, p.frag ? p.frag.n : 0, Math.round(p.vx * 1e3), Math.round(p.vy * 1e3), Math.round(p.life * 1e3)].join()).sort().join(' '); };
    for (const pair of [['fire_split', 'fire_pierce'], ['fire_split', 'f_fireball_3a'], ['ev_comet', 'f_fireball_3b'], ['fire_split', 'ev_comet']]) { const A = cast(pair), B = cast(pair.slice().reverse()); if (A !== B) out.push(`order: ${pair} gives ${A}, the other way ${B}`); }
    { const c = stage('mage'); c.h.powers = { fire_split: 1, fire_pierce: 1 }; castAbility(c.S, c.R, 'fireball', {}); if (c.R.proj.some((p) => !p.frag)) out.push('order: a side ball does not shatter'); }
  }
  function checkPowerPack(out) {
    const T = 'POWERS', own = (c, id) => { (c.h.powers = c.h.powers || {})[id] = 1; };
    for (const [id, P] of Object.entries(D.POWERS)) { if (!/^(kit|th)_/.test(id) && (!P.name || !P.desc || P.name.startsWith(T) || P.desc.startsWith(T))) out.push(`power: ${id} has no words`);
      if (P.ab && !Object.values(D.CLASSES).some((C) => C.abilities.includes(P.ab))) out.push(`power: ${id} is for ${P.ab}, no class has it`); if (!SIMX.POWER_FX[P.fx]) out.push(`power: ${id} does ${P.fx}, no such effect`); }
    { const c = stage('warrior'); own(c, 'whirl_pull'); const e = foe(c.R, c.h, 70); castAbility(c.S, c.R, 'whirl', {}); if (!(e.kbx < 0)) out.push(`power: the whirl does not pull (kbx ${e.kbx})`); }
    { const c = stage('warrior'); own(c, 'whirl_ring'); castAbility(c.S, c.R, 'whirl', {}); if (c.R.fires.filter((f) => f.own === 'hero').length < 4) out.push('power: no ring of fire after the whirl'); }
    { const c = stage('mage'); own(c, 'fire_split'); castAbility(c.S, c.R, 'fireball', {}); if (c.R.proj.length !== 3) out.push(`power: the split ball is ${c.R.proj.length} balls`); }
    { const c = stage('mage'); own(c, 'fire_pierce'); castAbility(c.S, c.R, 'fireball', {}); if (!c.R.proj[0].frag) out.push('power: the ball does not shatter'); }
    // TASKS 1982: the pierce once traded the blast for a pass through and did less against a pack than the plain ball
    { const plain = crowdFire([]), shat = crowdFire(['fire_pierce']); if (shat.shards !== D.SHARDS.n) out.push(`power: the ball broke into ${shat.shards} shards, not ${D.SHARDS.n}`);
      if (!(plain.dmg > 0) || shat.dmg < plain.dmg) out.push(`power: the shattering ball dealt the pack ${shat.dmg}, the plain one ${plain.dmg}`);
      const S2 = crowdFire(['fire_split', 'fire_pierce']); if (S2.shards > 3 * D.SHARDS.n) out.push(`power: shards shatter again (${S2.shards} from three balls)`);
      const c = stage('mage'), m = c.R.map, e = foe(c.R, c.h, 60), wx = Math.floor(e.x / TILE) + 1, cy = Math.floor(c.h.y / TILE); for (let y = cy - 7; y <= cy + 7; y++) m.cells[y * m.W + wx] = 0;
      own(c, 'fire_pierce'); c.h.aim = 0; c.S.ev = []; const hit0 = SIMX.heroHit; let n = 0; SIMX.heroHit = (...a) => { if (a[2] === e) n++; return hit0(...a); };
      try { castAbility(c.S, c.R, 'fireball', {}); for (let i = 0; i < 120 && c.R.proj.length; i++) { c.S.t += SIMX.DT; SIMX.stepProjectiles(c.S, c.R); } } finally { SIMX.heroHit = hit0; }
      const sb = c.S.ev.filter((q) => q.k === 'boom' && q.vr).length; if (!sb || n !== 1) out.push(`power: a shard bursting at the wall behind the first foe struck it again (${n} blows, ${sb} shard blasts)`); }
    { const c = stage('mage'); own(c, 'shield_burst'); const e = foe(c.R, c.h, 50), hp = e.hp; SIMX.firePowers(c.S, c.R, 'shieldEnd', { x: c.h.x, y: c.h.y, left: 40 }); if (hp - e.hp < 40) out.push(`power: the shield's end took ${hp - e.hp}`); }
    { const c = stage('mage'); own(c, 'shield_feed'); castAbility(c.S, c.R, 'shield', {}); const u = c.h.shieldUntil; killEnemy(c.S, c.R, foe(c.R, c.h)); if (Math.abs(c.h.shieldUntil - u - 1) > 1e-6) out.push('power: a kill does not feed the shield'); c.h.shield = 0; const u2 = c.h.shieldUntil; killEnemy(c.S, c.R, foe(c.R, c.h)); if (c.h.shieldUntil !== u2) out.push('power: a kill feeds a shield that is down'); }
    { const c = stage('archer'); own(c, 'volley_pierce'); castAbility(c.S, c.R, 'volley', {}); if (c.R.proj.length !== D.VOLLEY.n || c.R.proj.some((p) => p.pierce !== 1)) out.push(`power: the volley's arrows pierce ${c.R.proj.map((p) => p.pierce)}, not the first one as its line says`); }
    { const c = stage('archer'); own(c, 'trap_burst'); const a = foe(c.R, c.h, 30), b = foe(c.R, c.h, 70), hb = b.hp; c.R.htraps = [{ id: 9, x: a.x, y: a.y, t0: c.S.t - 1, dmg: 100, crit: 0 }]; SIMX.stepTraps(c.S, c.R); if (!(b.hp < hb)) out.push('power: the trap does not reach its neighbours'); }
    { const c = stage('archer'); own(c, 'leap_trap'); castAbility(c.S, c.R, 'leap', {}); if ((c.R.htraps || []).length !== 1) out.push('power: no trap left by the leap'); }
    { const c = stage(); own(c, 'dash_trail'); SIMX.firePowers(c.S, c.R, 'dash', { x: c.h.x, y: c.h.y, dx: 0, dy: 0, len: 100 }); if (!c.R.fires.some((f) => f.own === 'hero')) out.push('power: no fire behind the dash'); }
    { const c = stage(); own(c, 'dash_strike'); const e = foe(c.R, c.h, 5), hp = e.hp; c.h.dashT = c.S.t; SIMX.dashTouch(c.S, c.R); const h1 = e.hp; SIMX.dashTouch(c.S, c.R); if (!(h1 < hp) || e.hp !== h1) out.push(`power: the dash struck ${hp - e.hp}, once expected`); }
  }
  // the second pack (TASKS 2000): each power changes what its blow or ability does, and the warrior's blow is his alone
  function checkSecondPack(out) {
    const own = (c, ...ids) => { c.h.powers = Object.fromEntries(ids.map((i) => [i, 1])); c.h.powerN = {}; c.h.powerT = {}; };
    const step = (c, n = 120) => { for (let i = 0; i < n && c.R.proj.length; i++) { c.S.t += SIMX.DT; SIMX.stepProjectiles(c.S, c.R); } };
    const arrow = (c, e, dx) => c.R.proj.push({ id: c.R.nextId++, src: e.id, who: 'x', k: 'arrow', x: c.h.x + dx, y: c.h.y - 38, vx: -400, vy: 0, t0: c.S.t, life: 2, dmg: 50, own: 'en' });
    const hurts = (c) => c.S.ev.filter((q) => q.k === 'hurt').length;
    const P2 = ['blow_echo', 'blow_cinder', 'blow_reap', 'blow_finisher', 'whirl_parry', 'charge_again', 'cry_call', 'fire_blaze', 'shield_mirror', 'frost_step', 'volley_chill', 'volley_bounce', 'trap_lure', 'trap_chain', 'leap_fan', 'leap_pierce'];
    for (const id of P2) { const g = D.GIFTS.find((q) => q.id === id); if (!g || !g.power || !(g.tier === 2 || g.tier === 3) || !D.POWERS[id].name || !D.POWERS[id].desc) out.push(`pack2: ${id} is no altar gift with a text`); }
    for (const cl of ['mage', 'archer']) { const c = stage(cl); for (const t of [2, 3]) if (D.giftPool(c.h, t).some((g) => g.cls === 'warrior')) out.push(`pack2: a ${cl} is offered the warrior's blow`); }
    { const c = stage('warrior'); if (!D.giftPool(c.h, 3).some((g) => g.id === 'blow_echo')) out.push('pack2: the warrior is not offered his blow');
      own(c, 'blow_echo'); const a = foe(c.R, c.h, 40), b = foe(c.R, c.h, 120), far = foe(c.R, c.h, 400); for (let i = 0; i < 2; i++) heroHit(c.S, c.R, a, 1, false, c.h.x, c.h.y);
      if (b.hp < b.max) out.push('pack2: the echo came before the third blow'); heroHit(c.S, c.R, a, 1, false, c.h.x, c.h.y); if (!(b.hp < b.max) || far.hp < far.max) out.push('pack2: the third blow does not echo to its neighbour alone'); }
    { const c = stage('warrior'); own(c, 'blow_cinder'); const e = foe(c.R, c.h, 40); heroHit(c.S, c.R, e, 1, false, c.h.x, c.h.y); if (c.R.fires.length) out.push('pack2: a plain blow set the floor alight');
      heroHit(c.S, c.R, e, 1, true, c.h.x, c.h.y); if (!c.R.fires.some((f) => f.own === 'hero')) out.push('pack2: a crit set no fire'); }
    { const c = stage('warrior'); own(c, 'blow_reap'); const a = foe(c.R, c.h, 40), b = foe(c.R, c.h, 160); killEnemy(c.S, c.R, a); if (!(b.kbx < 0)) out.push('pack2: the fallen draws no neighbour to his place'); }
    { const c = stage('warrior'); own(c, 'blow_finisher'); const e = foe(c.R, c.h, 40), hp = e.hp; heroHit(c.S, c.R, e, 1, false, c.h.x, c.h.y); const plain = hp - e.hp; e.rootT = c.S.t + 1; const h1 = e.hp; heroHit(c.S, c.R, e, 1, false, c.h.x, c.h.y);
      if (!(h1 - e.hp > plain)) out.push(`pack2: a stunned foe takes ${h1 - e.hp}, a free one ${plain}`); }
    for (const [cl, id, ab, live] of [['warrior', 'whirl_parry', 'whirl', 0.6], ['mage', 'shield_mirror', 'shield', 2]]) { const c = stage(cl); own(c, id); const e = foe(c.R, c.h, 160), hp = e.hp; castAbility(c.S, c.R, ab, {}); c.h.shield = 0; c.S.ev = [];
      arrow(c, e, 30); step(c); if (hurts(c) || !(e.hp < hp)) out.push(`pack2: ${id} let ${hurts(c)} through and sent ${hp - e.hp} back`);
      c.S.t += live + 0.5; c.h.ifr = 0; c.h.dashT = -9; arrow(c, e, 10); step(c, 20); if (!hurts(c)) out.push(`pack2: ${id} outlives its time`); }
    { const c = stage('warrior'); own(c, 'charge_again'); const e = foe(c.R, c.h, 60); c.h.cd.charge = c.S.t + 8; SIMX.firePowers(c.S, c.R, 'chargeHit', { e, x: e.x, y: e.y }); if (c.h.cd.charge <= c.S.t) out.push('pack2: the charge came back with its target alive');
      killEnemy(c.S, c.R, e); SIMX.firePowers(c.S, c.R, 'chargeHit', { e, x: e.x, y: e.y }); if (c.h.cd.charge > c.S.t) out.push('pack2: the charge did not come back on a kill'); }
    { const c = stage('warrior'); own(c, 'cry_call'); const e = foe(c.R, c.h, 240); castAbility(c.S, c.R, 'cry', {}); if (!(e.kbx < 0)) out.push('pack2: the cry calls no one over'); }
    { const c = stage('mage'); own(c, 'fire_blaze'); c.h.aim = 0; foe(c.R, c.h, 120, 20); castAbility(c.S, c.R, 'fireball', {}); step(c); if (!c.R.fires.some((f) => f.own === 'hero')) out.push('pack2: the ball left no fire where it burst');
      const d = stage('mage'); own(d); d.h.aim = 0; foe(d.R, d.h, 120, 20); castAbility(d.S, d.R, 'fireball', {}); step(d); if (d.R.fires.length) out.push('pack2: a plain ball set the floor alight'); }
    { const c = stage('mage'); own(c, 'frost_step'); c.h.aim = 0; castAbility(c.S, c.R, 'frost', {}); if (c.h.dashT !== c.S.t || !(c.h.dashX < -0.9)) out.push('pack2: the wave does not step the mage back'); }
    { const c = stage('archer'); own(c, 'volley_chill'); c.h.aim = 0; c.h.mx = c.h.x + 150; c.h.my = c.h.y - 30; const e = foe(c.R, c.h, 150, 0); castAbility(c.S, c.R, 'volley', {}); step(c); if (!(e.chillT > c.S.t)) out.push('pack2: the volley chills no one');
      const d = stage('archer'); own(d); d.h.aim = 0; d.h.mx = d.h.x + 150; d.h.my = d.h.y - 30; const f = foe(d.R, d.h, 150, 0); castAbility(d.S, d.R, 'volley', {}); step(d); if (f.chillT > d.S.t) out.push('pack2: a plain volley chills'); }
    { const c = stage('archer'); own(c, 'volley_bounce'); c.h.aim = 0; c.h.mx = c.h.x + 300; c.h.my = c.h.y - 30; castAbility(c.S, c.R, 'volley', {}); let back = 0; for (let i = 0; i < 150 && c.R.proj.length; i++) { c.S.t += SIMX.DT; SIMX.stepProjectiles(c.S, c.R); if (c.R.proj.some((p) => p.vx < 0)) back = 1; }
      if (!back) out.push('pack2: no arrow of the volley came back off the wall'); }
    { const c = stage('archer'); own(c, 'trap_lure'); const a = foe(c.R, c.h, 40), b = foe(c.R, c.h, 180); SIMX.firePowers(c.S, c.R, 'trapsnap', { e: a, x: a.x, y: a.y, dmg: 10 }); if (!(b.kbx < 0)) out.push('pack2: the trap lures no one'); }
    { const c = stage('archer'); own(c, 'trap_chain'); const a = foe(c.R, c.h, 40), bs = [80, 120, 160, 400].map((dx) => foe(c.R, c.h, dx)); SIMX.firePowers(c.S, c.R, 'trapsnap', { e: a, x: a.x, y: a.y, dmg: 10 });
      if (bs.slice(0, 3).some((b) => !(b.hp < b.max)) || bs[3].hp < bs[3].max || a.hp < a.max) out.push('pack2: the tripwire lashes the wrong ones'); }
    { const c = stage('archer'); own(c, 'leap_fan', 'leap_pierce'); c.h.aim = 0; castAbility(c.S, c.R, 'leap', {}); if (c.R.proj.length !== 3 || c.R.proj.some((p) => p.pierce < 5)) out.push(`pack2: the leap shot ${c.R.proj.length} arrows piercing ${c.R.proj.map((p) => p.pierce)}`); }
  }
  // TASKS 1818: each chapter boss holds a unique for each class, drops it every time, and its power works only while it is worn
  function checkUniques(out) {
    const BOSS = ['boss_spider', 'boss_necro', 'boss_forge', 'boss', 'boss_serpent', 'boss_colossus'];
    for (const U of Object.values(D.UNIQUES)) { const P = D.POWERS[U.power], C = D.CLASSES[U.cls];
      if (!D.BASES[U.b] || !D.wears(U.cls, U.b)) out.push(`unique ${U.id}: a ${U.cls} cannot wear its ${U.b}`);
      if (!P || !P.name || !P.desc) out.push(`unique ${U.id}: power ${U.power} has no name or text`);
      else if (P.ab && !C.abs.some((a) => a.id === P.ab)) out.push(`unique ${U.id}: its power is for ${P.ab}, not a ${U.cls}'s`);
      else if (P.cls && P.cls !== U.cls) out.push(`unique ${U.id}: its power is a ${P.cls}'s, not a ${U.cls}'s`);
      if (!U.name || !U.lore || /[{}]/.test(U.name + U.lore)) out.push(`unique ${U.id}: name or lore missing or unfilled`); }
    for (const cl of ['warrior', 'mage', 'archer']) for (const type of BOSS) {
      if (!D.bossUniques(type, cl).length) { out.push(`unique: ${type} has none for a ${cl}`); continue; }
      const c = stage(cl), its = SIMX.bossLoot(c.R, { type, x: c.h.x, y: c.h.y }), u = its.find((it) => it.u);
      if (!u || D.UNIQUES[u.u].boss !== type || D.UNIQUES[u.u].cls !== cl || u.rar !== 4 || SIMX.itemName(u) !== D.UNIQUES[u.u].name) out.push(`unique: ${type}'s chest holds no ${cl} unique`); }
    { const c = stage('warrior'), h = c.h, e = foe(c.R, h), blows = () => { c.S.ev = []; for (let i = 0; i < 4; i++) heroHit(c.S, c.R, e, 1, false, h.x, h.y); return hits(c.S, 'kit_hammer'); };
      h.powers = {}; h.powerN = {}; h.eq.weapon = SIMX.uniqueItem(c.R, 'u_forge_w', 5);
      if (blows() !== 1 || (h.powers || {}).kit_hammer) out.push('unique: a worn unique\'s power does not fire, or becomes the hero\'s own');
      h.eq.weapon = SIMX.rollItem(c.R, 5, 0, 'weapon'); if (blows() !== 0) out.push('unique: its power stays after it is taken off'); }
    // TASKS 358: the floors hold one unique for each class in each slot, each with a power no other unique has, and every legendary found is one
    const floor = Object.values(D.UNIQUES).filter((U) => !U.boss), seen = {};
    if (floor.length !== 24) out.push(`unique: ${floor.length} found on the floors, not 24`);
    for (const U of Object.values(D.UNIQUES)) { if (seen[U.power]) out.push(`unique: ${U.id} and ${seen[U.power]} share ${U.power}`); seen[U.power] = U.id; }
    for (const U of floor) if (D.BASES[U.b].minF) out.push(`unique ${U.id}: its ${U.b} is not found above floor ${D.BASES[U.b].minF}, a legendary rolled there could not become it`);
    for (const cl of ['warrior', 'mage', 'archer']) { for (const slot of D.SLOTS) if (floor.filter((U) => U.cls === cl && D.BASES[U.b].slot === slot).length !== 1) out.push(`unique: not one ${slot} for a ${cl} on the floors`);
      const c = stage(cl);
      for (let i = 0; i < 40; i++) { const slot = D.SLOTS[i % D.SLOTS.length], it = SIMX.rollItem(c.R, 1 + (i % 12), 0, slot, { min: 4 }), U = D.UNIQUES[it.u];
        if (!U || U.boss || it.rar !== 4 || D.BASES[it.b].slot !== slot || it.b !== U.b || !D.wears(U.cls, it.b) || SIMX.itemName(it) !== U.name) { out.push(`unique: a ${cl}'s legendary ${slot} is no floor unique`); break; }
        const back = JSON.parse(JSON.stringify(it)); if (back.u !== it.u || SIMX.itemName(back) !== U.name) { out.push('unique: a saved unique comes back without its name'); break; } }
      const R0 = JSON.parse(JSON.stringify(c.R)), it1 = SIMX.rollItem(c.R, 6, 0, undefined, { min: 4, lo: 1, hi: 1, lag: 2 }), f0 = D.floorUnique;
      D.floorUnique = () => null; const it0 = SIMX.rollItem(R0, 6, 0, undefined, { min: 4, lo: 1, hi: 1, lag: 2 }); D.floorUnique = f0;
      if (R0.rs !== c.R.rs || it0.lvl !== it1.lvl || D.BASES[it0.b].slot !== D.BASES[it1.b].slot) out.push(`unique: a ${cl}'s legendary takes other draws than a plain one`); }
  }
  // TASKS 359: a found epic may hold one weak power of its class's altar pool, likelier deeper, and never moves a roll after it
  function checkEpicPowers(out) {
    const all = new Set(); for (const cl of ['warrior', 'mage', 'archer']) { const L = D.epicPool(cl); L.forEach((id) => all.add(id));
      if (L.length < 8) out.push(`epic: a ${cl}'s pool holds only ${L.length} powers`);
      for (const id of L) { const P = D.POWERS[id], g = D.GIFTS.find((q) => q.id === id); if (!P.name || !P.desc || !g || g.relic || g.evo || (P.cls && P.cls !== cl) || (P.ab && !D.CLASSES[cl].abilities.includes(P.ab))) out.push(`epic: ${id} in a ${cl}'s pool is no altar power of his`); } }
    if (all.size < 20 || all.size > 32) out.push(`epic: ${all.size} powers in the pools, not 20–32`);
    if (!(D.EPIC_POWER.k > 0 && D.EPIC_POWER.k < 1) || !(D.EPIC_POWER.p(1) < D.EPIC_POWER.p(15))) out.push('epic: a weak power is not weaker, or its odds do not grow with the floor');
    for (const cl of ['warrior', 'mage', 'archer']) { const c = stage(cl), n = [0, 0];
      for (const [k, f] of [[0, 1], [1, 18]]) for (let i = 0; i < 300; i++) { const it = SIMX.rollItem(c.R, f, 0, undefined, { min: 3, max: 3 }); if (!it.pw) continue; n[k]++;
        const own = D.BASES[it.b].cls ? (D.BASES[it.b].cls.includes(cl) ? cl : D.BASES[it.b].cls[0]) : cl;
        if (it.u || it.rar !== 3 || !D.epicPool(own).includes(it.pw)) { out.push(`epic: a ${cl}'s epic holds ${it.pw}, not one power of its class`); break; }
        const back = JSON.parse(JSON.stringify(it)); if (back.pw !== it.pw) out.push('epic: a saved epic loses its power'); }
      if (!n[0] || !(n[1] > n[0] * 2)) out.push(`epic: a ${cl}'s epics hold a power ${n[0]} times on the 1st floor, ${n[1]} on the 18th`);
      for (let i = 0; i < 100; i++) { if (SIMX.rollItem(c.R, 18, 0, undefined, { min: 3, max: 3, own: 1 }).pw) { out.push('epic: the merchant sells a power'); break; } if (SIMX.rollItem(c.R, 18, 0, undefined, { min: 4 }).pw) { out.push('epic: a legendary holds a weak power too'); break; } }
      const R0 = JSON.parse(JSON.stringify(c.R)), it1 = SIMX.rollItem(c.R, 18, 0, undefined, { min: 3, max: 3, lo: 1, hi: 1, lag: 2 }), p0 = D.EPIC_POWER.p;
      D.EPIC_POWER.p = () => 0; const it0 = SIMX.rollItem(R0, 18, 0, undefined, { min: 3, max: 3, lo: 1, hi: 1, lag: 2 }); D.EPIC_POWER.p = p0;
      if (R0.rs !== c.R.rs || it0.lvl !== it1.lvl || it0.b !== it1.b || JSON.stringify(it0.mods) !== JSON.stringify(it1.mods)) out.push(`epic: a ${cl}'s epic with a power takes other draws than one without`); }
    { const c = stage('warrior'), h = c.h, e = foe(c.R, h), blows = () => { c.S.ev = []; h.powerN = {}; for (let i = 0; i < 400; i++) heroHit(c.S, c.R, e, 1, false, h.x, h.y); return hits(c.S, 'kit_hammer'); };
      h.powers = {}; h.eq.weapon = Object.assign(SIMX.rollItem(c.R, 5, 0, 'weapon', { min: 3, max: 3 }), { pw: 'kit_hammer' });
      const weak = blows(); if (weak < 30 || weak > 70 || (h.powers || {}).kit_hammer) out.push(`epic: a worn epic's power fired ${weak} of 100 times, or became the hero's own`);
      h.powers = { kit_hammer: 1 }; if (blows() !== 100) out.push('epic: a power held in full is weakened by an epic holding it too');
      h.powers = {}; delete h.eq.weapon.pw; if (blows() !== 0) out.push('epic: its power stays once the epic has none'); }
  }
  function checkPowers(out) {
    const T = '__t', drive = (trig, act, extra = {}) => { const c = stage(extra.cls); grant(c.h, T, Object.assign({ trig, fx: 'mana', v: 0 }, extra.p)); c.S.ev = []; act(c); const n = hits(c.S, T); delete D.POWERS[T]; return n; };
    const cases = {
      hit: ({ S, R, h }) => heroHit(S, R, foe(R, h), 1, false, h.x, h.y),
      crit: ({ S, R, h }) => heroHit(S, R, foe(R, h), 1, true, h.x, h.y),
      kill: ({ S, R, h }) => killEnemy(S, R, foe(R, h)),
      hurt: ({ S, R, h }) => { h.ifr = 0; h.dashT = -9; S.meta.up = {}; for (let i = 0; i < 40 && !S.ev.some((e) => e.k === 'hurt'); i++) hurtHero(S, R, 5, h.x + 9, h.y); },
      'cast:whirl': ({ S, R, h }) => castAbility(S, R, 'whirl', {}),
      // pressed twice: the staged hero is at full health, and a full pool drinks for a power only on the second press (TASKS 1881)
      potion: ({ S, R, h }) => { usePotion(S, R, 'hp_potion'); usePotion(S, R, 'hp_potion'); },
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
    checkPowerPack(out); checkPowerGifts(out); checkRelics(out); checkEvolutions(out); checkAbilityPowers(out); checkSecondPack(out); checkAltarExtras(out); checkKits(out); checkUnlocks(out); checkCodex(out); checkForks(out); checkPr48(out); checkStale(out); checkUniques(out); checkEpicPowers(out);
  }
  Object.assign(SIMX, { checkPowers });
})(typeof window !== 'undefined' ? window : globalThis);
