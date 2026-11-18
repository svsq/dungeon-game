// live/sim_checks_classes.js — selfCheck's parts for the classes and their powers (TASKS 356 and on). Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    ABILITIES, BASES, begin, castAbility, cell, counted, D, DT, endRun, ENEMIES, enterFloor, folkFree, folkOf, fstat, heroHit, heroShot, heroSt,
    hitEnemy, hurtHero, K, killEnemy, losClear, newRun, offerOf, rollItem, spawn, startRun, stats, step, stockShop, TILE, toPx, UI, useItem,
    usePotion, wearIfFree } = SIMX;
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
    const c = stage('warrior'); c.S.meta.codex = {}; SIMX.metaEvent(c.S, { k: 'hit', type: 'skeleton', id: 1, x: 0, y: 0 }); SIMX.metaEvent(c.S, { k: 'pickup', b: 'sword' }); SIMX.metaEvent(c.S, { k: 'bless', id: 'whirl_pull' }); SIMX.metaEvent(c.S, { k: 'bless', id: 'fury' });
    if (!c.S.meta.codex.m.skeleton || !c.S.meta.codex.it.sword || !c.S.meta.codex.p.whirl_pull || c.S.meta.codex.p.fury) out.push('codex: meetings are not written down');
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
    { const c = stage('archer'); own(c, 'volley_pierce'); castAbility(c.S, c.R, 'volley', {}); SIMX.looseVolley(c.S, c.R); if (c.R.proj.length !== D.VOLLEY.n || c.R.proj.some((p) => p.pierce !== 1)) out.push(`power: the volley's arrows pierce ${c.R.proj.map((p) => p.pierce)}, not the first one as its line says`); }
    { const c = stage('archer'); own(c, 'trap_burst'); const a = foe(c.R, c.h, 30), b = foe(c.R, c.h, 70), hb = b.hp; c.R.htraps = [{ id: 9, x: a.x, y: a.y, t0: c.S.t - 1, dmg: 100, crit: 0 }]; SIMX.stepTraps(c.S, c.R); if (!(b.hp < hb)) out.push('power: the trap does not reach its neighbours'); }
    { const c = stage('archer'); own(c, 'leap_trap'); castAbility(c.S, c.R, 'leap', {}); if ((c.R.htraps || []).length !== 1) out.push('power: no trap left by the leap'); }
    { const c = stage(); own(c, 'dash_trail'); SIMX.firePowers(c.S, c.R, 'dash', { x: c.h.x, y: c.h.y, dx: 0, dy: 0, len: 100 }); if (!c.R.fires.some((f) => f.own === 'hero')) out.push('power: no fire behind the dash'); }
    { const c = stage(); own(c, 'dash_strike'); const e = foe(c.R, c.h, 5), hp = e.hp; c.h.dashT = c.S.t; SIMX.dashTouch(c.S, c.R); const h1 = e.hp; SIMX.dashTouch(c.S, c.R); if (!(h1 < hp) || e.hp !== h1) out.push(`power: the dash struck ${hp - e.hp}, once expected`); }
  }
  // the second pack (TASKS 2019): each power changes what its blow or ability does, and the warrior's blow is his alone
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
    { const c = stage('archer'); own(c, 'volley_chill'); c.h.aim = 0; c.h.mx = c.h.x + 150; c.h.my = c.h.y - 30; const e = foe(c.R, c.h, 150, 0); castAbility(c.S, c.R, 'volley', {}); SIMX.looseVolley(c.S, c.R); step(c); if (!(e.chillT > c.S.t)) out.push('pack2: the volley chills no one');
      const d = stage('archer'); own(d); d.h.aim = 0; d.h.mx = d.h.x + 150; d.h.my = d.h.y - 30; const f = foe(d.R, d.h, 150, 0); castAbility(d.S, d.R, 'volley', {}); SIMX.looseVolley(d.S, d.R); step(d); if (f.chillT > d.S.t) out.push('pack2: a plain volley chills'); }
    { const c = stage('archer'); own(c, 'volley_bounce'); c.h.aim = 0; c.h.mx = c.h.x + 300; c.h.my = c.h.y - 30; castAbility(c.S, c.R, 'volley', {}); SIMX.looseVolley(c.S, c.R); let back = 0; for (let i = 0; i < 150 && c.R.proj.length; i++) { c.S.t += SIMX.DT; SIMX.stepProjectiles(c.S, c.R); if (c.R.proj.some((p) => p.vx < 0)) back = 1; }
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
    // TASKS 358, 2029: every base holds one floors' unique for each class a legendary of it may be for, each with a power no other unique
    // has, and every legendary found is the unique of the base it rolled
    const floor = Object.values(D.UNIQUES).filter((U) => !U.boss), seen = {}, CL = ['warrior', 'mage', 'archer'];
    const forCls = (b) => (D.BASES[b].cls ? [D.BASES[b].cls[0]] : CL), want = Object.keys(D.BASES).reduce((n, b) => n + forCls(b).length, 0);
    if (floor.length !== want) out.push(`unique: ${floor.length} found on the floors, not ${want}`);
    for (const U of Object.values(D.UNIQUES)) { if (seen[U.power]) out.push(`unique: ${U.id} and ${seen[U.power]} share ${U.power}`); seen[U.power] = U.id; }
    for (const b in D.BASES) for (const cl of forCls(b)) if (floor.filter((U) => U.cls === cl && U.b === b).length !== 1) out.push(`unique: not one ${b} for a ${cl} on the floors`);
    for (const cl of CL) { const c = stage(cl), got = {};
      for (let i = 0; i < 400; i++) { const it = SIMX.rollItem(c.R, 1 + (i % 18), 0, D.SLOTS[i % D.SLOTS.length], { min: 4 }), U = D.UNIQUES[it.u]; got[it.b] = 1;
        if (!U || U.boss || it.rar !== 4 || it.b !== U.b || U !== D.floorUnique(it.b, D.BASES[it.b].cls ? D.BASES[it.b].cls[0] : cl) || SIMX.itemName(it) !== U.name) { out.push(`unique: a ${cl}'s legendary ${it.b} is no floor unique of its base`); break; }
        const back = JSON.parse(JSON.stringify(it)); if (back.u !== it.u || SIMX.itemName(back) !== U.name) { out.push('unique: a saved unique comes back without its name'); break; } }
      const miss = Object.keys(D.BASES).filter((b) => D.wears(cl, b) && !got[b]); if (miss.length) out.push(`unique: a ${cl} never found a legendary ${miss.join(', ')}`);
      const R0 = JSON.parse(JSON.stringify(c.R)), it1 = SIMX.rollItem(c.R, 6, 0, undefined, { min: 4, lo: 1, hi: 1, lag: 2 }), f0 = D.floorUnique;
      D.floorUnique = () => null; const it0 = SIMX.rollItem(R0, 6, 0, undefined, { min: 4, lo: 1, hi: 1, lag: 2 }); D.floorUnique = f0;
      if (R0.rs !== c.R.rs || it0.lvl !== it1.lvl || it0.b !== it1.b) out.push(`unique: a ${cl}'s legendary takes other draws than a plain one`); }
    // a save from before 2029 may hold a unique on another base than its own: it loads, is named and powers the hero as before
    { const c = stage('warrior'), old = JSON.parse(JSON.stringify(Object.assign(SIMX.uniqueItem(c.R, 'u_w_weapon', 5), { b: 'axe' })));
      try { c.h.eq.weapon = old; delete c.R.itemBalance; SIMX.rebalanceRun(c.R); if (SIMX.itemName(old) !== D.UNIQUES.u_w_weapon.names.axe || !(SIMX.heroPowers(c.h) || {})[D.UNIQUES.u_w_weapon.power]) out.push('unique: an old unique on another base loses its name or power'); }
      catch (e) { out.push(`unique: an old unique on another base breaks the load: ${e.message}`); } }
    // TASKS 2185: a unique on a base of its slot that is not its own is named by that base, never by its own
    for (const U of Object.values(D.UNIQUES)) { const slot = D.BASES[U.b].slot;
      if (D.uniqueName(U, U.b) !== U.name) out.push(`unique ${U.id}: its own base does not keep its name`);
      for (const b of Object.keys(D.BASES)) { if (b === U.b || D.BASES[b].slot !== slot) continue;
        const nm = D.uniqueName(U, b), want = (U.names && U.names[b]) || D.LEGEND_NAMES[b] || D.LEGEND_NAMES[slot];
        if (nm !== want || nm === U.name) out.push(`unique ${U.id}: on ${b} it is named ${nm}, not by its base`);
        if (SIMX.itemName({ b, rar: 4, u: U.id, lvl: 1, mods: {} }) !== nm) out.push(`unique ${U.id}: itemName on ${b} differs from the name by base`); } }
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

  // the classes (TASKS 1100): every field, abilities and bases that exist, a new hero of each built from its class, an old save a warrior
  function classCheck() {
    const out = [], has = (o, ks) => ks.every((k) => typeof (o || {})[k] === 'number');
    for (const [id, C] of Object.entries(D.CLASSES)) {
      if (!C.name || !has(C.base, D.STATS.map((q) => q.k)) || !has(C.grow, ['hp', 'mp', 'pts', 'sp']) || !C.look || !C.look.rig) out.push(`class ${id}: a field is missing`);
      if (C.abilities.length !== 3 || C.unlock.length !== 3 || C.abs.some((a) => !a.id || !a.name)) out.push(`class ${id}: not three abilities that exist`);
      if (!C.unlock.includes(1)) out.push(`class ${id}: no ability at level 1`);
      if (!ABILITIES.some((a) => a.id === C.rclick)) out.push(`class ${id}: the right click's ability does not exist`);
      for (const [slot, b] of Object.entries(C.start)) if (!BASES[b] || BASES[b].slot !== slot) out.push(`class ${id}: starting ${slot} ${b} is no such base`);
      const S = spawn(0, {}), R = newRun(S, 'campaign', 81, { cls: id }), h = R.hero;
      if (h.cls !== id || h.eq.weapon.b !== C.start.weapon || h.eq.armor.b !== C.start.armor) out.push(`class ${id}: a new hero is not of its class`);
      if (Object.keys(h.ab).join() !== C.abilities.join() || C.abs.some((a, i) => (h.ab[a.id] > 0) !== (C.unlock[i] <= 1))) out.push(`class ${id}: a new hero's abilities are not its class's`);
      if (D.STATS.some((q) => h.base[q.k] !== C.base[q.k])) out.push(`class ${id}: a new hero's base stats are not its class's`);
      for (const slot of D.SLOTS) if (!Object.keys(BASES).some((k) => BASES[k].slot === slot && D.wears(id, k))) out.push(`class ${id}: nothing to wear in the ${slot} slot`);
      for (const k of Object.keys(BASES)) for (const c of BASES[k].cls || []) if (!D.CLASSES[c]) out.push(`base ${k}: no class ${c}`);
    }
    // the mage's start and growth (TASKS 1111, 1112): staff and robe; at level 8 with the same gear more mana and spell power than a warrior
    { const S = spawn(0, {}), M = newRun(S, 'campaign', 83, { cls: 'mage' }).hero, W = newRun(S, 'campaign', 83).hero;
      for (const h of [M, W]) h.lvl = 8; W.eq = M.eq; const m = stats(M, S.meta), w = stats(W, S.meta);
      if (M.eq.weapon.b !== 'staff' || M.eq.armor.b !== 'robe') out.push('class mage: does not start with a staff and a robe');
      if (!(m.maxMp > w.maxMp && m.spellBase > w.spellBase)) out.push('class mage: no more mana and spell power than a warrior'); }
    // the mage's abilities (TASKS 1110): the ice wave hurts and chills the one before him, not the one behind, and the chill thaws;
    // his staff hits a monster three reaches away with no mana at all, a warrior's staff does not
    { const arena = (cls) => { const S = spawn(0, {}); S.meta.cls = cls; begin(S); if (S.run.hero.cls !== cls) { S.run = newRun(S, 'campaign', S.run.seed, { cls }); S.screen = 'play'; } for (let i = 0; i < 30; i++) step(S, { keys: [] });
        const R = S.run, h = R.hero, m = R.map, type = Object.keys(ENEMIES).find((q) => ENEMIES[q].kind === 'melee' && !ENEMIES[q].ghost);
        R.en = []; R.proj = []; R.pots = []; R.chests = []; R.drops = []; h.ifr = 1e9; h.vx = h.vy = 0; for (const k in h.cd) h.cd[k] = 0;
        const foe = (dx) => { const e = { id: R.nextId++, type, x: h.x + dx, y: h.y, hp: 1e6, max: 1e6, dmg: 0, st: 'idle', deadT: -1, room: -1, t0: S.t, kbx: 0, kby: 0 }; R.en.push(e); return e; };
        const open = (x, y, dx) => cell(m, Math.floor((x + dx) / TILE), Math.floor(y / TILE)) === 1 && losClear(m, x, y, x + dx, y);
        let ok = false; for (let k = 0; k < m.W * m.H && !ok; k++) { const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE;
          if (cell(m, k % m.W, Math.floor(k / m.W)) === 1 && open(x, y - TILE, 200) && open(x, y - TILE, -120) && open(x, y, 200) && open(x, y, -120)) { h.x = x; h.y = y; ok = true; } }
        R.cam = [h.x - 600, h.y - 340]; R.camV = [0, 0];   // (steps without a pointer leave the camera NaN)
        return { S, R, h, foe, ok }; };
      { const { S, R, h, foe, ok } = arena('mage');
        if (h.cls !== 'mage' || D.clsOf(h).abs.map((a) => a.id).join() !== 'fireball,shield,frost') out.push('class mage: not fireball, shield and ice wave');
        if (!ok) out.push('class mage: no open floor beside the start to test the ice wave');
        else { const a = foe(120), b = foe(-120); h.lvl = 4; h.ab.frost = 1; h.mp = 500; h.aim = 0; castAbility(S, R, 'frost', {});
          if (!(a.hp < a.max && a.chillT > S.t) || b.hp < b.max || b.chillT) out.push('class mage: the ice wave misses the foe before him or hits the one behind');
          if (h.mp !== 500 - D.ABILITIES.find((q) => q.id === 'frost').mp) out.push('class mage: the ice wave costs the wrong mana');
          for (let i = 0; i < 20; i++) step(S, { keys: [] }); if (a.slowK !== D.FROST.slow) out.push('class mage: a chilled foe is not slowed');
          a.chillT = S.t; for (let i = 0; i < 20; i++) step(S, { keys: [] }); if (a.slowK !== 1) out.push('class mage: the chill does not thaw');
          // TASKS 1685: the ice wave and the fireball can crit
          h.eq.weapon.mods.crit = 500; h.ab.fireball = 1; h.aim = 0; const crits = { frost: 0, fireball: 0 };
          for (const id of ['frost', 'fireball']) for (let n = 0; n < 24; n++) { h.mp = 500; h.cd[id] = 0; h.aim = 0; a.hp = a.max = 1e6; a.x = h.x + 120; a.y = h.y; S.ev = []; castAbility(S, R, id, {}); let got = S.ev.some((q) => q.k === 'hit' && q.crit); for (let i = 0; i < 40 && !got; i++) { step(S, { keys: [] }); got = S.ev.some((q) => q.k === 'hit' && q.crit); } if (got) crits[id]++; }
          if (!crits.frost || !crits.fireball) out.push(`class mage: ${!crits.frost ? 'the ice wave' : 'the fireball'} never crits at the cap (${crits.frost}, ${crits.fireball})`); } }
      for (const cls of ['mage', 'warrior']) { const { S, R, h, foe, ok } = arena(cls); if (!ok) continue;
        if (cls === 'warrior') { h.eq.weapon.b = 'staff'; }
        const e = foe(200); h.mp = 0; for (let i = 0; i < 60; i++) { h.mp = 0; e.x = h.x + 200; e.y = h.y; e.st = 'idle'; step(S, { keys: [], press: i < 20 ? 1 : 0, ...toPx(R, e.x, e.y - 30) }); }
        if (cls === 'mage' && !(e.hp < e.max)) out.push('class mage: his staff does not shoot a foe out of reach');
        if (cls === 'warrior' && e.hp < e.max) out.push('class warrior: a staff shoots for a warrior'); }
      // the archer (TASKS 1120–1122): his bow hits at range with no mana, the volley looses its fan, a trap holds a monster that walks
      // onto it and lets it go, the leap carries him back from the aim, AGI (and a little STR, TASKS 1913) grows his bow's damage, a sword is not his
      { const { S, R, h, foe, ok } = arena('archer');
        if (h.eq.weapon.b !== 'shortbow' || h.eq.armor.b !== 'leather_armor' || D.clsOf(h).abs.map((a) => a.id).join() !== 'volley,trap,leap') out.push('class archer: not a short bow, leather and volley, trap, leap');
        if (ok) { const e = foe(200); let got = 0; h.mp = 0; for (let i = 0; i < 60; i++) { h.mp = 0; e.x = h.x + 200; e.y = h.y; e.st = 'idle'; step(S, { keys: [], press: i < 20 ? 1 : 0, ...toPx(R, e.x, e.y - 30) }); if (h.mp >= D.CLASSES.archer.hitMp.hit) got = 1; }
          if (!(e.hp < e.max)) out.push('class archer: his bow does not hit a foe out of reach');
          if (!got) out.push('class archer: his arrows that hit give no mana');
          R.en = []; R.proj = []; h.lvl = 4; h.ab.trap = 1; h.ab.leap = 1; h.mp = 500; h.aim = 0; for (const k in h.cd) h.cd[k] = 0;
          // (TASKS 1744) the fan leaves at the loose, D.VOLLEY.loose s after the key, when the scene has the bow up
          const arrows = () => R.proj.filter((p) => p.k === 'arrow' && p.own === 'hero').length, aimAt = toPx(R, h.x + 400, h.y - 30);
          h.mx = h.x + 400; h.my = h.y - 30; castAbility(S, R, 'volley', {}); const t0 = S.t; if (arrows()) out.push('class archer: the volley flies on the key, before the bow is up');
          for (let i = 0; i < 120 && !arrows(); i++) step(S, { keys: [], ...aimAt }); const lt = S.t - t0;
          if (lt < D.VOLLEY.loose - 1e-9 || lt > D.VOLLEY.loose + 2 * DT) out.push(`class archer: the volley leaves ${lt.toFixed(3)} s after the key, not at the loose (${D.VOLLEY.loose} s)`);
          if (arrows() !== D.VOLLEY.n) out.push('class archer: the volley does not loose its fan');
          // (TASKS 1161) at a cursor far off the fan closes: the arrows' spread there is within VOLLEY.w
          { const vs = R.proj.filter((p) => p.k === 'arrow'), ys = vs.map((p) => p.y + p.vy / p.vx * (h.x + 400 - p.x)); if (Math.max(...ys) - Math.min(...ys) > D.VOLLEY.w + 4) out.push('class archer: the volley does not close on a far cursor'); }
          R.proj = []; h.mx = h.x + 150; h.my = h.y - 30; castAbility(S, R, 'trap', {}); const q = R.htraps[0], w = foe(0);
          if (Math.abs(q.x - (h.x + 150)) > 10) out.push('class archer: the trap is not set at the cursor'); h.x -= 120; w.x = q.x + 60; w.y = q.y; w.st = 'idle'; w.calmT = 1e9;
          for (let i = 0; i < 120; i++) { step(S, { keys: [] }); if (w.rootT) break; if (i > 55) w.x -= 2; }
          if (!(w.rootT > S.t) || w.hp >= w.max) out.push('class archer: a trap does not hold the monster that walks onto it');
          if (!(w.cdT >= w.rootT)) out.push('class archer: a trapped monster\'s blow is not held');
          w.rootT = S.t; for (let i = 0; i < 20; i++) step(S, { keys: [] }); if (w.slowK !== 1) out.push('class archer: a trapped monster is not let go');
          h.x += 120; const x0 = h.x; h.aim = 0; h.cd.leap = 0; castAbility(S, R, 'leap', {}); for (let i = 0; i < 30; i++) step(S, { keys: [], ...toPx(R, h.x + 300, h.y - 30) });
          if (!(h.x < x0 - D.LEAP.spd * 0.16 * 0.8)) out.push('class archer: the leap does not carry him back from the aim its length'); }
        const a0 = stats(h, S.meta).atk; h.base.agi += 10; const a1 = stats(h, S.meta).atk; h.base.agi -= 10; h.base.str += 10; const a2 = stats(h, S.meta).atk; h.base.str -= 10;
        if (!(a1 > a0) || !(a2 > a0) || a2 - a0 >= a1 - a0) out.push('class archer: AGI does not grow his bow\'s damage more than STR (TASKS 1913: STR adds a little)');
        if (D.wears('archer', 'sword')) out.push('class archer: he wears a sword');
        // (TASKS 1155) an arrow into a cultist's wind-up breaks it off; a second at once does not
        if (ok) { R.en = []; R.proj = []; R.cam = [h.x - 600, h.y - 340]; R.camV = [0, 0]; h.vx = h.vy = 0; const aimed = () => ({ keys: [], ...toPx(R, h.x + 300, h.y - 30) }); const c = foe(150); Object.assign(c, { type: 'cultist', st: 'wind', t0: S.t, cdT: 0 }); h.aim = 0;
          heroShot(R, h, Math.atan2(c.y - ENEMIES.cultist.h * 0.45 - root.SIMX.hand(h)[1], c.x - root.SIMX.hand(h)[0]), 1, false, 'arrow'); for (let i = 0; i < 40 && c.st === 'wind'; i++) step(S, aimed());
          if (c.st === 'wind' || !(c.hushT > S.t)) out.push('class archer: an arrow does not break off a caster\'s wind-up');
          Object.assign(c, { st: 'wind', t0: S.t }); heroShot(R, h, Math.atan2(c.y - ENEMIES.cultist.h * 0.45 - root.SIMX.hand(h)[1], c.x - root.SIMX.hand(h)[0]), 1, false, 'arrow'); for (let i = 0; i < 30; i++) { step(S, aimed()); c.t0 = S.t; }
          if (c.st !== 'wind') out.push('class archer: a caster is broken off twice in a row');
          // (TASKS 1163) a crossbow's bolt strikes two in a line, a short bow's arrow one; the long bow's flies farther
          for (const b of ['crossbow', 'shortbow']) { R.en = []; R.proj = []; const f1 = foe(120), f2 = foe(180); const [hx, hy] = root.SIMX.hand(h);
            heroShot(R, h, Math.atan2(f1.y - ENEMIES[f1.type].h * 0.45 - hy, f1.x - hx), 5, false, 'arrow', BASES[b]); for (let i = 0; i < 60; i++) { step(S, aimed()); f1.x = h.x + 120; f2.x = h.x + 180; f1.y = f2.y = h.y; }
            if ((f2.hp < f2.max) !== (b === 'crossbow') || !(f1.hp < f1.max)) out.push(`class archer: a ${b}'s arrow strikes ${f2.hp < f2.max ? 'two' : 'one'} in a line`); }
          { R.en = []; R.proj = []; const lo = heroShot(R, h, 0, 1, false, 'arrow', BASES.longbow), sh = heroShot(R, h, 0, 1, false, 'arrow', BASES.shortbow);
            if (!(Math.hypot(lo.vx, lo.vy) * lo.life > Math.hypot(sh.vx, sh.vy) * sh.life * 1.2)) out.push('class archer: the long bow\'s arrow does not fly farther'); R.proj = []; }
          { const dps = (b) => { h.eq.weapon = Object.assign({}, h.eq.weapon, { b, atk: BASES[b].atk }); h.base.agi = 30; const q = stats(h, S.meta); return q.atk / q.wcd; }, d0 = dps('shortbow');
            for (const b of ['longbow', 'crossbow']) if (dps(b) < d0 * 0.97) out.push(`class archer: a ${b} is weaker than a short bow at AGI 30`); } } }
      // (review of PR 75) a volley cast just before the stairs or a death does not loose on the next floor or from the dead
      { const { S, R, h } = arena('archer'), arrows = () => R.proj.filter((p) => p.k === 'arrow' && p.own === 'hero').length;
        const armed = () => { for (const k in h.cd) h.cd[k] = 0; h.mp = 500; castAbility(S, R, 'volley', {}); if (h.volleyT == null) out.push('class archer: the volley is not cast, so its reset goes unchecked'); };
        armed(); enterFloor(S, R, R.floor + 1); R.proj = []; for (let i = 0; i < 20; i++) step(S, { keys: [] }); if (arrows()) out.push('class archer: a volley cast before the stairs looses on the next floor');
        h.ifr = 1e9; armed(); root.SIMX.killHero(S, R); if (h.volleyT != null) out.push('class archer: a volley outlives the archer\'s death'); }
      // the warrior (TASKS 1130): rage from his blows and ones he takes, draining once the fight is over; the charge strikes and stuns a
      // monster in its way; the war cry weakens those about him and hardens his blows; mana potions are not his
      { const { S, R, h, foe, ok } = arena('warrior');
        if (D.clsOf(h).abs.map((a) => a.id).join() !== 'whirl,charge,cry' || D.clsOf(h).res !== 'rage' || h.mp !== 0 || stats(h, S.meta).maxMp !== D.RAGE.max) out.push('class warrior: not whirl, charge, cry on rage from 0');
        if (ok) { h.lvl = 4; h.ab.charge = 1; h.ab.cry = 1; for (const k in h.cd) h.cd[k] = 0;
          const e = foe(150); e.st = 'idle'; e.calmT = 1e9; h.mp = 50; h.aim = 0; castAbility(S, R, 'charge', {});
          for (let i = 0; i < 40 && !(e.rootT > S.t); i++) step(S, { keys: [], ...toPx(R, e.x, e.y - 30) });
          if (!(e.rootT > S.t) || e.hp >= e.max) out.push('class warrior: the charge does not strike and stun the monster in its way');
          if (!(h.mp > 50 - D.ABILITIES.find((q) => q.id === 'charge').mp)) out.push('class warrior: his blow gives no rage');
          // TASKS 1184: the charge is free and pays rage on a hit, a miss comes back soon; what is held hits harder; the cry's ranks last longer
          if (D.ABILITIES.find((q) => q.id === 'charge').mp !== 0) out.push('class warrior: the charge costs rage');
          { const hit = (mp) => { const q = foe(40); q.max = q.hp = 1e6; q.st = 'idle'; h.mp = mp; h.cryT = 0; heroHit(S, R, q, 1000, false, h.x, h.y); const v = 1e6 - q.hp; q.deadT = S.t; return v; }, a = hit(0), b = hit(100);
            if (!(b > a * 1.1)) out.push(`class warrior: 100 rage hits for ${b} against ${a} at none`); }
          { const took = (mp) => { h.mp = mp; h.hp = heroSt(S).maxHp; h.ifr = 0; h.shield = 0; let n = 0; for (let k = 0; k < 20 && !n; k++) { h.mp = mp; hurtHero(S, R, 40, h.x + 30, h.y, undefined, 'skeleton'); n = heroSt(S).maxHp - h.hp; h.ifr = 0; } return n; }, a = took(0), b = took(100);
            if (!(b > 0 && b < a * (1 - D.RAGE.guard / 2))) out.push(`class warrior: full rage takes ${b} of a blow against ${a} at none`); }
          { const keep = R.en; R.en = []; h.cd.charge = 0; h.mp = 0; castAbility(S, R, 'charge', {}); for (let i = 0; i < 40; i++) step(S, { keys: [], ...toPx(R, h.x + 100, h.y) });
            if (!(h.cd.charge - S.t <= D.CHARGE.miss)) out.push('class warrior: a missed charge keeps its whole cooldown'); R.en = keep; h.charge = null; }
          if (!(D.abRank('cry', 5).t > D.abRank('cry', 1).t)) out.push('class warrior: the cry\'s ranks add no time');
          h.mp = 60; h.cd.cry = 0; castAbility(S, R, 'cry', {}); if (!(e.weakT > S.t) || !(h.cryT > S.t)) out.push('class warrior: the war cry does not weaken the monster near him');
          R.en = []; h.fightT = S.t; const m0 = h.mp; for (let i = 0; i < 120 * (D.RAGE.calm + 1); i++) step(S, { keys: [], ...toPx(R, h.x + 100, h.y) });
          if (!(h.mp < m0)) out.push('class warrior: rage does not drain out of a fight'); }
        const b = h.bag.findIndex((it) => it && it.b === 'mp_potion'); if (b >= 0) { const n = h.bag[b].n; h.mp = 0; S.screen = 'play'; step(S, { keys: ['KeyR'] }); if (!h.bag[b] || h.bag[b].n !== n) out.push('class warrior: he drinks a mana potion'); } } }
    // the class screen (TASKS 1103): «Кампания» asks for the class, a card picks it and the meta keeps it, «В путь» starts that hero,
    // Escape goes back; the Keeper names the last hero's class
    { const S = spawn(0, {}), at = (b) => step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 }), ready = D.classesReady();
      if (ready.length > 1) { at(UI.menu(false).find((b) => b.id === 'campaign'));
        if (S.screen !== 'classes' || S.run) out.push('class screen: «Кампания» does not ask for the class');
        step(S, { keys: ['Escape'] }); if (S.screen !== 'menu') out.push('class screen: Escape does not go back to the menu');
        at(UI.menu(false).find((b) => b.id === 'campaign')); at(UI.classes().find((b) => b.cls === 'mage'));
        if (S.meta.cls !== 'mage') out.push('class screen: a card does not pick its class');
        at(UI.classes().find((b) => b.id === 'go')); if (!S.run || S.run.hero.cls !== 'mage' || !S.run.town) out.push('class screen: «В путь» does not start a mage in the town');
        if (UI.classes().some((b) => b.cls && !D.CLASSES[b.cls].look.ready)) out.push('class screen: a class without its own look is offered');
        endRun(S, 'dead'); if (S.meta.lastCls !== 'mage') out.push('class screen: the last hero\'s class is not kept');
        const T = spawn(0, { meta: S.meta }); startRun(T, 'town'); const pages = root.SIMX.keeperPages(T, T.run);
        if (!pages.some((p) => /маг/.test(p))) out.push('class screen: the Keeper does not name the last hero\'s class'); } }
    // the Keeper's welcome (TASKS 1849): a new game's first steps in the town bring him from the fire to the hero, held meanwhile, and
    // open the first talk with the quest about Horatio; Esc leaves the offer his; it is never played again: not on a second visit,
    // not in a run saved before it (or past it)
    { const S = spawn(0, {}); startRun(S, 'town'); const R = S.run, h = R.hero, F = folkOf(R), k = F.find((q) => q.role === 'keeper'), x0 = h.x, y0 = h.y, kx = k.x, ky = k.y;
      if (R.greet !== 1) out.push('welcome: a new game does not arm it');
      let n = 0, walked = 0, said = 0; while (S.screen === 'play' && n++ < 120 * 16) { step(S, { keys: n % 40 === 0 ? ['KeyE', 'Space'] : [], left: 1, up: 1 }); walked = Math.max(walked, Math.hypot(k.x - kx, k.y - ky)); if (k.sayS) said = 1; }
      if (Math.hypot(h.x - x0, h.y - y0) > 2) out.push(`welcome: the hero walked ${Math.round(Math.hypot(h.x - x0, h.y - y0))} px while held`);
      if (S.screen !== 'talk' || !S.talk || S.talk.role !== 'keeper') out.push(`welcome: no talk with the Keeper in ${(n / 120).toFixed(1)} s (screen ${S.screen})`);
      else { const of = offerOf(R, 'keeper');
        if (!S.talk.act || S.talk.act.k !== 'take' || !of || S.talk.act.key !== of.q.key || of.q.key !== 'rescue') out.push(`welcome: the talk does not offer the quest about Horatio (${JSON.stringify(S.talk.act)})`);
        if (n / 120 > 9) out.push(`welcome: the talk opens only after ${(n / 120).toFixed(1)} s`); }
      if (walked < 100 || Math.hypot(k.x - h.x, k.y - h.y) > 70) out.push(`welcome: the Keeper did not come up to the hero (walked ${Math.round(walked)} px, ${Math.round(Math.hypot(k.x - h.x, k.y - h.y))} px off)`);
      if (!said) out.push('welcome: the Keeper says nothing on the way');
      step(S, { keys: ['Escape'] }); if (S.screen !== 'play') out.push('welcome: Esc does not close the talk');
      const back = (rs) => { for (let i = 0; i < 120 * 12 && R.greet !== 'done'; i++) step(S, { keys: [] }); return R.greet === 'done'; };
      if (!back()) out.push('welcome: the Keeper does not go back to the fire');
      else if (Math.hypot(k.x - kx, k.y - ky) > 3) out.push(`welcome: the Keeper stops ${Math.round(Math.hypot(k.x - kx, k.y - ky))} px off his place`);
      if (!offerOf(R, 'keeper') || (R.quests || []).some((q) => q.key === 'rescue')) out.push('welcome: Esc lost or took the quest');
      h.x = k.x + 44; h.y = k.y + 12; step(S, { keys: [] }); step(S, { keys: ['KeyE'] });
      if (S.screen !== 'talk' || !S.talk.act || S.talk.act.k !== 'take') out.push('welcome: after Esc the Keeper does not offer the quest again');
      S.screen = 'play'; S.talk = null; const hx = h.x; for (let i = 0; i < 60; i++) step(S, { keys: [], right: 1 }); if (h.x - hx < 20) out.push('welcome: the hero is still held after it');
      enterFloor(S, R, 1); enterFloor(S, R, 0); const k2 = folkOf(R).find((q) => q.role === 'keeper'), k2x = k2.x; let held = 0;
      for (let i = 0; i < 120 * 4; i++) { step(S, { keys: [], down: i < 30 ? 1 : 0 }); if (root.SIMX.greetHold(R)) held = 1; }
      if (held || S.screen !== 'play' || Math.abs(k2.x - k2x) > 3 || R.greet !== 'done') out.push('welcome: a second visit plays it again');
      const O = spawn(0, {}); O.run = newRun(O, 'campaign', 91, { town: 1 }); O.screen = 'play'; O.run = JSON.parse(JSON.stringify(O.run)); const oh = O.run.hero, ox = oh.x;
      for (let i = 0; i < 120 * 4; i++) step(O, { keys: [], right: i < 40 ? 1 : 0 }); if (O.run.greet || O.screen !== 'play' || oh.x - ox < 20) out.push('welcome: a run saved before it is greeted'); }
    // TASKS 1859: the Keeper meets the hero a step off, not in his sprite; on the offer's page E and the space never drop it, and his
    // first story quest is taken by E once the page has been up a breath; Esc in a topic goes back to the topics, on them it leaves
    { const S = spawn(0, {}); startRun(S, 'town'); const R = S.run, has = () => (R.quests || []).some((q) => q.key === 'rescue'); let n = 0; while (S.screen === 'play' && n++ < 120 * 16) step(S, { keys: [] });
      const k = folkOf(R).find((q) => q.role === 'keeper'), off = Math.hypot(k.x - R.hero.x, k.y - R.hero.y), T = S.talk;
      if (off < 56) out.push(`talk: the Keeper meets the hero ${Math.round(off)} px off, in his sprite`);
      if (!T || !T.act || !T.act.first) out.push('talk: the Keeper\'s first story quest is not offered as the first');
      else { for (let i = 0; i < 12 && T.p + 1 < T.pages.length; i++) step(S, { keys: ['KeyE'] }); step(S, { keys: ['KeyE'] }); step(S, { keys: ['Space'] });
        if (S.screen !== 'talk' || has()) out.push('talk: E or the space mashed onto the story offer closes the talk or takes it at once');
        if (S.focus !== 'act') out.push('talk: a deaf E or space on the offer\'s page lights nothing (TASKS 2099)');
        for (let i = 0; i < 70; i++) step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); if (S.screen !== 'play' || !has()) out.push('talk: E does not take the Keeper\'s first story quest'); }
      const O = spawn(0, {}); O.run = newRun(O, 'campaign', 37, { town: 1 }); O.screen = 'talk'; O.talk = { role: 'keeper', i: 0, pages: [''], p: 0, act: null, topics: D.FOLK.keeper.topics, menu: 1 };
      step(O, { keys: ['Digit1'] }); step(O, { keys: [] }); step(O, { keys: ['Escape'] }); if (O.screen !== 'talk' || !O.talk || !O.talk.menu) out.push('talk: Esc in a topic does not go back to the topics');
      step(O, { keys: [] }); step(O, { keys: ['Escape'] }); if (O.screen !== 'play') out.push('talk: Esc on the topics does not close the talk'); }
    // PR 55 review: the welcome never throws or stalls: a hero by the Keeper's side (his spot in his own cell), a way back that stays
    // blocked, the townsfolk made anew while he is in the talk
    { const play = (setup, cut) => { const S = spawn(0, {}); startRun(S, 'town'); const R = S.run, k = folkOf(R).find((q) => q.role === 'keeper'), kx = k.x, ky = k.y; setup(S, R, k); let threw = null;
        try { let n = 0; while (S.screen === 'play' && n++ < 120 * 16) step(S, { keys: [] }); step(S, { keys: ['Escape'] }); step(S, { keys: [] }); cut(S, R, k); for (let i = 0; i < 120 * 20 && R.greet !== 'done'; i++) step(S, { keys: [] }); } catch (e) { threw = e; }
        const kn = (R.folk || []).find((q) => q.role === 'keeper');
        return threw ? `throws (${threw.message})` : R.greet !== 'done' ? `stays in '${R.greet.st}'` : !kn || Math.hypot(kn.x - kx, kn.y - ky) > 3 ? 'ends off his place' : ''; };
      const a = play((S, R, k) => { R.hero.x = k.x - 46; R.hero.y = k.y - 2; }, () => {}); if (a) out.push(`welcome: with the hero right by the Keeper it ${a}`);
      const b = play(() => {}, (S, R, k) => { k.path = [{ x: -400, y: -400 }]; }); if (b) out.push(`welcome: a way back that stays blocked ${b}`);
      const c = play(() => {}, (S, R) => { R.greet.st = 'home'; R.folk = null; }); if (c) out.push(`welcome: with the townsfolk made anew after the talk it ${c}`);
      const d = play(() => {}, (S, R, k) => { delete R.greet.t3; k.path = [{ x: -400, y: -400 }]; }); if (d) out.push(`welcome: a way back saved without its start (t3) that stays blocked ${d}`); }
    // PR 55 review 2: the hero is held no longer than the Keeper's walk and a breath (a hen sat on his spot), the spot is never a
    // bench, and townsfolk made anew mid-walk (a load) bring him over again; each time he talks from beside the hero
    { const greet = (setup, mid) => { const S = spawn(0, {}); startRun(S, 'town'); const R = S.run; setup(S, R); let n = 0, k = folkOf(R).find((q) => q.role === 'keeper');
        while (S.screen === 'play' && n++ < 120 * 20) { if (mid) mid(S, R, n); step(S, { keys: [] }); } k = folkOf(R).find((q) => q.role === 'keeper');
        return { R, k, t: n / 120, off: Math.hypot(k.x - R.hero.x, k.y - R.hero.y), talk: S.screen === 'talk' }; };
      const base = greet(() => {}), say = (r, what) => { if (!r.talk || r.off > 70) out.push(`welcome: ${what}, he talks ${Math.round(r.off)} px off the hero (screen talk: ${r.talk})`); };
      const a = greet(() => {}, (S, R) => { const G = R.greet, hen = folkOf(R).find((q) => q.role === 'hen'); if (G.st !== 'walk' || !G.sp) return; hen.x = G.sp.x; hen.y = G.sp.y; hen.goal = { x: G.sp.x, y: G.sp.y, v: 0 }; });
      say(a, 'with a hen on his spot'); if (a.t > base.t + 1.8) out.push(`welcome: a hen on his spot holds the hero ${a.t.toFixed(1)} s, his walk takes ${base.t.toFixed(1)} s`);
      let bn = null; const b = greet((S, R) => { const m = R.map, k = folkOf(R).find((q) => q.role === 'keeper'), at = (d) => d.x - (k.x >= d.x - 46 ? 1 : -1) * 46; bn = m.decor.filter((d) => d.role === 'bench').find((d) => folkFree(m, at(d), d.y - 2, K.R));
        if (bn) { R.hero.x = at(bn); R.hero.y = bn.y - 2; } });
      const bc = (o) => Math.floor(o.y / TILE) * b.R.map.W + Math.floor(o.x / TILE); if (bn && bc(b.k) === bc(bn)) out.push('welcome: the Keeper meets the hero on a bench'); say(b, 'with a bench beside the hero');
      const c = greet(() => {}, (S, R, n) => { if (n === 240) R.folk = null; }); say(c, 'with the townsfolk made anew mid-walk'); }
    // gear of another class (TASKS 1102): the staff made the mage's alone for the check, a warrior neither wears it nor finds it often
    { const keep = BASES.staff.cls; BASES.staff.cls = ['mage'];
      const S = spawn(0, {}), R = newRun(S, 'campaign', 82), h = R.hero, n = 4000; let st = 0, mg = 0;
      for (let i = 0; i < n; i++) if (rollItem(R, 3, 0, 'weapon').b === 'staff') st++;
      const S2 = spawn(0, {}), R2 = newRun(S2, 'campaign', 82, { cls: 'mage' }); for (let i = 0; i < n; i++) if (rollItem(R2, 3, 0, 'weapon').b === 'staff') mg++;
      const fair = n / Object.keys(BASES).filter((k) => BASES[k].slot === 'weapon').length;
      if (Math.abs(st / (fair * D.CLASS_LOOT.foreign) - 1) > 0.25) out.push(`class: a warrior finds the mage's staff ${st} times in ${n}, not about ${Math.round(fair * D.CLASS_LOOT.foreign)}`);
      if (mg < fair * 0.8) out.push(`class: a mage finds his staff ${mg} times in ${n}, below ${Math.round(fair)}`);
      // TASKS 1156: the fire on a mage's gear and the arcane gift reach his bolt; TASKS 1154: the chill slows a monster's wind-up and its cooldown
      { const S5 = spawn(0, {}), R5 = newRun(S5, 'campaign', 84, { cls: 'mage' }), h5 = R5.hero; S5.run = R5; S5.screen = 'play'; const a0 = stats(h5, S5.meta).atk; h5.perks = { arcane: 1 };
        if (!(stats(h5, S5.meta).atk > a0)) out.push('class mage: the arcane gift does not reach the bolt'); h5.perks = {};
        const e = { id: R5.nextId++, type: 'skeleton', x: h5.x + 800, y: h5.y, hp: 1e6, max: 1e6, dmg: 0, st: 'idle', deadT: -1, room: -1, t0: S5.t, kbx: 0, kby: 0, cdT: S5.t + 9, chillT: S5.t + 3 }; R5.en = [e];
        const cd0 = e.cdT, n5 = 60; for (let i = 0; i < n5; i++) step(S5, { keys: [], ...toPx(R5, h5.x + 100, h5.y) });
        if (!(D.windOf(e, 1) > 1)) out.push('class mage: a chilled monster winds up as fast as ever'); if (!(e.cdT > cd0 + 0.1)) out.push('class mage: a chilled monster\'s cooldown runs as fast as ever'); }
      // PR 36 review: a deep run's kit is the class's own; a save from before the classes is given its abilities back; a set trap stays on its floor
      for (const mode of ['cave', 'magma']) for (const cl of ['warrior', 'mage', 'archer']) { const S6 = spawn(0, {}), R6 = newRun(S6, mode, 85, { cls: cl }), w = Object.values(R6.hero.eq).filter((it) => it && BASES[it.b] && !D.wears(cl, it.b)).map((it) => it.b);
        if (w.length) out.push(`class: a ${cl} starts the ${mode} run in ${w}`); if (cl !== 'warrior' && !(D.CLASSES[cl].shoots || []).includes(R6.hero.eq.weapon.b)) out.push(`class: a ${cl}'s ${mode} kit has no weapon of his`); }
      { const S7 = spawn(0, {}), R7 = newRun(S7, 'campaign', 86), h7 = R7.hero; delete h7.cls; h7.lvl = 5; h7.sp = 1; h7.ab = { whirl: 2, fireball: 3, shield: 2 }; SIMX.migrateAbilities(R7);
        if (h7.ab.fireball || h7.ab.shield || !(h7.ab.charge >= 1) || !(h7.ab.cry >= 1) || h7.ab.whirl !== 2 || h7.sp !== 4) out.push(`class: an old save migrates to ${JSON.stringify(h7.ab)}, ${h7.sp} points`);
        const sp0 = h7.sp; SIMX.migrateAbilities(R7); if (h7.sp !== sp0) out.push('class: migrating an old save twice pays twice');
        R7.htraps = [{ x: 1, y: 1, t0: S7.t }]; enterFloor(S7, R7, 2); if (R7.htraps.length) out.push('class: a set trap follows the hero to the next floor'); }
      // TASKS 1185: what does nothing for a class is not offered to it
      for (const cl of ['warrior', 'mage', 'archer']) { const S4 = spawn(0, {}), R4 = newRun(S4, 'campaign', 83, { cls: cl }), no = D.CLASSES[cl].dead;
        for (const [k, list, key] of [['gifts', D.GIFTS, 'id'], ['meta', D.META, 'id'], ['mods', D.AFFIXES, 'k']]) for (const id of no[k]) if (!list.some((q) => q[key] === id)) out.push(`class: ${cl}'s dead ${k} names «${id}», no such thing`);
        for (let i = 0; i < 400; i++) { const bad = Object.keys(rollItem(R4, 9, 3).mods).filter((m) => no.mods.includes(m)); if (bad.length) { out.push(`class: a ${cl}'s item rolled ${bad}`); break; } }
        for (let i = 0; i < 60; i++) { const sh = { x: 0, y: 0 }; R4.shrines.push(sh); SIMX.openAltar(S4, R4, sh); S4.screen = 'play'; const g = sh.gifts.find((q) => no.gifts.includes(q.id)); if (g) { out.push(`class: a ${cl}'s altar offers «${g.id}»`); break; } }
        const m = D.UI.meta(cl).map((b) => b.id); for (const id of no.meta) if (m.includes(id)) out.push(`class: a ${cl}'s altar sells rank «${id}»`);
        for (const b of no.cons) { if (R4.hero.bag.some((it) => it && it.b === b)) out.push(`class: a ${cl} starts with ${b}`); if (['town', 'wander'].some((kind) => stockShop(R4, 5, kind).goods.some((g) => g.it.b === b))) out.push(`class: a ${cl}'s shelf sells ${b}`); }
        if (cl === 'mage' && !R4.hero.bag.some((it) => it && it.b === 'mp_potion')) out.push('class: the mage starts without a mana potion'); }
      for (const cl of ['warrior', 'mage', 'archer']) { const S3 = spawn(0, {}), R3 = newRun(S3, 'campaign', 82, { cls: cl }), bad = (it) => BASES[it.b] && !D.wears(cl, it.b); let got = 0;
        for (let f = 1; f <= 16; f++) for (const kind of ['town', 'wander']) got += stockShop(R3, f, kind).goods.filter((g) => bad(g.it)).length;
        for (let i = 0; i < 800; i++) if (bad(rollItem(R3, 5, 2, undefined, { own: 1 }))) got++;
        if (got) out.push(`class: ${got} foreign pieces on a ${cl}'s shelves and quest rewards`); }
      const it = Object.assign(rollItem(R, 1, 0, 'weapon'), { b: 'staff', id: R.nextId++ }); h.eq.weapon = null; h.bag[5] = it; S.run = R; S.screen = 'play';
      if (wearIfFree(S, R, it) || h.eq.weapon) out.push('class: a warrior puts on the mage\'s staff by picking it up');
      useItem(S, R, 5); if (h.eq.weapon || h.bag[5] !== it) out.push('class: a warrior equips the mage\'s staff');
      BASES.staff.cls = keep; }
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 81), h = R.hero, H = JSON.parse(JSON.stringify(h)); delete H.cls; H.lvl = 5;
      if (h.cls !== 'warrior' || D.clsOf(H) !== D.CLASSES.warrior || JSON.stringify(stats(H, S.meta)) !== JSON.stringify(stats(Object.assign({}, H, { cls: 'warrior' }), S.meta))) out.push('class: a hero saved without a class is not a warrior'); }
    // TASKS 1363: a lava bridge's rope rails hold: pressed against either side of the deck the hero stays on it, and the deck still carries him bank to bank
    { let n = 0; for (let sd = 1; sd <= 14 && n < 6; sd++) for (const f of [5, 6]) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play'; enterFloor(S, S.run, f); const R = S.run, m = R.map, h = R.hero; R.en = [];
        for (const c of m.crossings.filter((q) => q.kind === 'bridge' && q.lava && !q.chasm)) { n++; const [u0, u1, v0] = c.span, hor = c.axis === 'x', P = (u, v) => [(hor ? u : v) * TILE, (hor ? v : u) * TILE], tag = `rails: seed ${sd} f${f} bridge at ${u0},${v0}`;
          for (const side of [-1, 1]) { const [x, y] = P((u0 + u1 + 1) / 2, v0 + 1); h.x = x; h.y = y; h.vx = h.vy = 0;
            for (let i = 0; i < 90; i++) step(S, hor ? { up: side < 0, down: side > 0, px: 960, py: 540, keys: [] } : { left: side < 0, right: side > 0, px: 960, py: 540, keys: [] });
            const v = hor ? h.y : h.x; if (cell(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)) !== 1 || v < v0 * TILE || v > (v0 + 2) * TILE) out.push(`${tag}: the hero walks off its ${side < 0 ? 'near' : 'far'} side`); }
          for (const dir of [-1, 1]) { const [x, y] = P(dir < 0 ? u1 + 1.5 : u0 - 0.5, v0 + 1); h.x = x; h.y = y; h.vx = h.vy = 0;
            for (let i = 0; i < 400; i++) step(S, hor ? { left: dir < 0, right: dir > 0, px: 960, py: 540, keys: [] } : { up: dir < 0, down: dir > 0, px: 960, py: 540, keys: [] });
            const a = hor ? h.x : h.y; if (dir < 0 ? a > u0 * TILE : a < (u1 + 1) * TILE) out.push(`${tag}: the deck does not carry the hero across`); } } }
      if (n < 4) out.push(`rails: only ${n} lava bridges in 14 seeds`); }
    // TASKS 1808: the stairs show through the fog once half the floor's foes are slain, not a kill sooner; never in the town
    for (const [mode, f] of [['campaign', 3], ['campaign', 10], ['campaign', 14]]) { const S = spawn(0, {}); S.run = newRun(S, mode, 7); S.screen = 'play'; enterFloor(S, S.run, f);
      const R = S.run, m = R.map, at = m.exit.ty * m.W + m.exit.tx, F = fstat(R), foes = R.en.filter((e) => counted(e) && e.deadT < 0 && !D.BOSSES[e.type]), need = Math.ceil(F.foes / 2), tag = `stairs: ${mode} f${f}`;
      R.seen[at] = 0; for (const e of foes.slice(0, need - 1)) { e.hp = 0; killEnemy(S, R, e); }
      if (R.seen[at]) out.push(`${tag}: shown before half the foes fell`);
      if (foes[need - 1]) { foes[need - 1].hp = 0; killEnemy(S, R, foes[need - 1]); } if (!R.seen[at]) out.push(`${tag}: not shown with half the foes slain`); }
    return out;
  }
  // a number moved in its table moves what it sets (TASKS 2080): before, the blessing's 1.2 and the thresholds' 25 were copies of the data
  function dataLinkCheck(out) {
    const with_ = (obj, field, v, f) => { const was = obj[field]; obj[field] = v; try { return f(); } finally { obj[field] = was; } };
    // the blow is rounded to a whole point, so at 1000 attack its share is off by under a thousandth
    { const c = stage('warrior'), st = { atk: 1000, crit: 0, critK: 1 }, B = D.GIFTS.find((g) => g.id === 'bless'), rs = c.R.rs, ROUND = 1e-3; c.h.bless = 1;
      const roll = () => { c.R.rs = rs; return SIMX.heroRoll(c.R, c.h, st)[0]; }, base = with_(c.h, 'bless', 0, roll), now = roll(), more = with_(B, 'v', B.v * 2, roll);
      if (Math.abs(now / base - (1 + B.v / 100)) > 2 * ROUND || Math.abs(more / base - (1 + 2 * B.v / 100)) > 2 * ROUND) out.push(`bless: a blessed blow is ${now}, at twice GIFTS.bless.v ${more}, unblessed ${base}`); }
    { const T = D.THRESHOLD.warrior, fires = (v) => with_(T, 'v', v, () => { const c = stage('warrior'), e = foe(c.R, c.h); c.h.powers = { th_warrior: 1 }; c.S.ev = []; SIMX.firePowers(c.S, c.R, 'hit', { e, x: e.x, y: e.y }); return hits(c.S, 'th_warrior'); });
      const str = SIMX.heroSt(stage('warrior').S).str;
      if (!fires(str) || fires(str + 1)) out.push(`threshold: th_warrior does not follow THRESHOLD.warrior.v (fires at ${str}: ${fires(str)}, at ${str + 1}: ${fires(str + 1)})`);
      const tip = (v) => with_(T, 'v', v, () => { const c = stage('warrior'); c.h.thTip = 0; c.R.msg = null; SIMX.thresholdTip(c.S, c.R); return c.R.msg && c.R.msg.s; });
      if (tip(str + 1) || !String(tip(str)).includes(String(str))) out.push(`threshold: the tip does not follow THRESHOLD.warrior.v («${tip(str)}» at ${str}, «${tip(str + 1)}» above it)`); }
  }
  // the held weapons in the hand that holds them (TASKS 2142, 2144, 2145), drawn in a sandbox at the textures' real sizes, standing and
  // running, either way round, at three moments of the idle: the grip on the near hand, the mage's orb on his far palm, the bowstring
  // across the bow on both sides of the grip, and the cape under the far arm (laid over it, it hid that arm and what it held)
  function heroGripCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), GRIP = 3, STRING = [15, 45], SPAN = 0.35;
    // (TASKS 2146) the orb only when worn: none on a bare staff, in the open far palm (its world texture is orb_held)
    const KITS = [['warrior', 'sword'], ['mage', 'staff', 'orb'], ['mage', 'staff'], ['mage', 'wand', 'orb'], ['archer', 'shortbow'], ['archer', 'longbow']], d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const ORB = 'orb_held', PALM = 14;
    const STRING_COL = '0.5,0.48,0.45', seen = new Set();
    for (const [cls, wb, ob] of KITS) for (const face of [1, -1]) for (const vx of [0, 150]) for (const GT of [10, 11.3, 12.7]) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      if (ob) R.hero.eq.offhand = { id: 0, b: ob, rar: 0, lvl: 1, mods: {}, def: 2 };
      const h = Object.assign({}, R.hero, { vx, vy: 0, gp: GT * 4, face, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 });
      const J = {}, spr = [], sol = [], tag = `${cls} ${wb} face ${face}${vx ? ' running' : ''} at ${GT}`;
      L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = (x, y, w, hh, col) => sol.push({ p: [x, y], col: String(col) });
      drawHero(h, 300, 300, GT, heroSt(S), {});
      const say = (s) => { if (!seen.has(s)) { seen.add(s); out.push(`hero grip: ${tag}: ${s}`); } };
      if (!(d(J.grip, J.handR) <= GRIP)) say(`the weapon is held ${d(J.grip, J.handR).toFixed(1)} px from the hand`);
      const pn = D.CLASSES[cls].look.rig + '__', cape = spr.findIndex((q) => q.n === pn + 'cape'), farArm = spr.findIndex((q) => q.n.startsWith(pn + 'uarmL'));
      if (cape >= 0 && farArm >= 0 && cape > farArm) say('the cape is drawn over the far arm');
      const orbs = spr.filter((q) => q.n === ORB);
      if (!ob && orbs.length) say(`the orb is drawn ${orbs.length} times with no orb worn`);
      // (TASKS 2170) the orb rests on the far palm beside the staff too, as on mage_a_v4 (it sat on the staff's head)
      if (ob === 'orb') { if (orbs.length !== 1) say(`the orb is drawn ${orbs.length} times`); else if (d([orbs[0].o.m[4], orbs[0].o.m[5]], J.handL) > PALM) say(`the orb sits ${d([orbs[0].o.m[4], orbs[0].o.m[5]], J.handL).toFixed(1)} px from the far palm`); }
      if (wb.endsWith('bow')) { const ends = [J.nockA, J.nockB].filter(Boolean), g = J.grip;
        if (!sol.some((q) => q.col === STRING_COL)) { say('the string is not drawn'); continue; }
        if (ends.length !== 2) { say('the string\'s nocks are not traced'); continue; }
        const [a, b] = ends, span = d(a, b), cross = (a[0] - g[0]) * (b[0] - g[0]) + (a[1] - g[1]) * (b[1] - g[1]), u = Math.max(0, Math.min(1, ((g[0] - a[0]) * (b[0] - a[0]) + (g[1] - a[1]) * (b[1] - a[1])) / (span * span)));
        const near = d(g, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
        if (cross >= 0 || [a, b].some((e) => d(e, g) < STRING[0] || d(e, g) > STRING[1]) || near > SPAN * span) say(`the string does not span the bow about the grip (ends ${d(a, g).toFixed(0)} and ${d(b, g).toFixed(0)} px out, ${near.toFixed(0)} px off it)`); }
    }
  }
  // (TASKS 2156) a shot, a cast or a frost loosed behind him, and a plain turn, go through the back view: the drawn facing flips only while
  // the back view is up, nothing held jumps across the body on the flip, and a bow is in one hand or the other in every frame
  function heroTurnCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), BACK = 0.9, FLIP_JUMP = 10, GRIP = 3, T0 = 10, FPS = 60, N = 30, TURN_N = 12;
    // (TASKS 2162) UP: aimed up and back over the turn, the mirror of the up-left QA cases; the whirl's free hand jumped 31 px on that flip
    const UP = -0.84, KITS = [['archer', 'shortbow', '', 'shot'], ['archer', 'shortbow', '', 'turn'], ['mage', 'staff', '', 'shot'], ['mage', 'staff', '', 'fireball'], ['mage', 'staff', '', 'frost'],
      ['mage', 'wand', 'orb', 'shot'], ['mage', 'staff', 'orb', 'turn'], ['warrior', 'sword', 'shield', 'turn'],
      ['archer', 'shortbow', '', 'shot', UP], ['mage', 'staff', '', 'shot', UP], ['mage', 'staff', '', 'frost', UP], ['warrior', 'sword', '', 'whirl', UP], ['warrior', 'sword', 'shield', 'whirl', UP]], d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (const [cls, wb, ob, act, aim = 0] of KITS) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      if (ob) R.hero.eq.offhand = { id: 0, b: ob, rar: 0, lvl: 1, mods: {}, def: 2 };
      const cast = act === 'fireball' || act === 'frost' || act === 'whirl', h = Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face: 1, aim, back: 0, backT: -9, faceT: T0, deadT: -1, hurtT: -9, dashT: -9,
        atkT: act === 'shot' ? T0 : -9, atkA: aim, patkT: -9, castT: cast ? T0 : -9, castK: cast ? act : '', whirlT: act === 'whirl' ? T0 : -9, whirlA: aim }), tag = `${cls} ${wb}${ob ? ' and ' + ob : ''}, ${act} behind him${aim ? ' aimed up' : ''}`, st = heroSt(S);
      const rows = [];
      for (let k = 0; k <= N; k++) { const J = {}, V = {}; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; if (id === 'hero_view') V[n] = p; }; L.sprite = () => ({ w: 10, h: 10 }); L.solid = () => {};
        drawHero(h, 300, 300, T0 + k / FPS, st, {}); rows.push({ J, back: V.back[0], face: V.face[0] }); }
      const flips = rows.map((r, k) => (k && r.face !== rows[k - 1].face ? k : -1)).filter((k) => k > 0);
      if (flips.length !== 1) { out.push(`hero turn: ${tag}: the drawn facing flips ${flips.length} times`); continue; }
      const mixed = act === 'whirl' ? 0 : rows.filter((r) => r.back > 0.02 && r.back < 0.98).length;
      if (mixed > 1) out.push(`hero turn: ${tag}: ${mixed} frames cross-fade the front and back views (the face shows twice)`);
      const k = flips[0], a = rows[k - 1], b = rows[k];
      if (Math.min(a.back, b.back) < BACK) out.push(`hero turn: ${tag}: the facing flips at back view ${Math.min(a.back, b.back).toFixed(2)}`);
      for (const p of ['grip', 'shield', 'orb', 'handL', 'handR']) if (a.J[p] && b.J[p] && d(a.J[p], b.J[p]) > FLIP_JUMP) out.push(`hero turn: ${tag}: the ${p} jumps ${d(a.J[p], b.J[p]).toFixed(1)} px on the flip`);
      if (wb.endsWith('bow')) { const far = rows.map((r) => Math.min(d(r.J.grip, r.J.handR), d(r.J.grip, r.J.handL))), m = Math.max(...far);
        if (m > GRIP) out.push(`hero turn: ${tag}: the bow is ${m.toFixed(1)} px from either hand at frame ${far.indexOf(m)}`); }
    }
    // (TASKS 2192) the warrior's lowered weapon stays in sight through a plain turn: at least SEEN px of it on top in every frame (pointed
    // away from the camera and shortened to a tenth it was gone under the back view for 3 frames)
    const SEEN = 20;
    for (const wb of ['sword', 'longsword', 'axe', 'hammer']) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'warrior' }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      const st = heroSt(S), seen = [];
      for (let k = 0; k <= TURN_N; k++) { const J = {}, spr = []; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
        drawHero(Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face: -1, aim: 0, back: 0, backT: -9, faceT: T0, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), 300, 300, T0 + k / FPS, st, {});
        const c = SIMX.heroLayers.compose(spr, [J.ground[0] - 50, J.ground[1] - 100, J.ground[0] + 50, J.ground[1] + 4]); let n = 0;
        for (const i of c.top) if (i >= 0 && /^it_/.test(spr[i].n)) n++;
        seen.push(n); }
      const m = Math.min(...seen);
      if (m < SEEN) out.push(`hero turn: warrior ${wb}, a plain turn: ${m} px of it in sight at frame ${seen.indexOf(m)} (at least ${SEEN})`);
    }
  }
  // (TASKS 2162) the held weapon on the run, in all four directions: from one frame to the next its tip moves no more than a step's
  // swing (from behind the lowered sword tipped off the soles to one side or the other, 30 px a frame twice a stride)
  function heroRunCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), TIP_STEP = 8, T0 = 10, FPS = 60, N = 30, RUN = root.SIM.K.RUN;
    const KITS = [['warrior', 'sword'], ['warrior', 'sword', 'shield'], ['mage', 'staff'], ['archer', 'shortbow']], d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (const [cls, wb, ob] of KITS) for (const [dn, dx, dy] of [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]]) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      if (ob) R.hero.eq.offhand = { id: 0, b: ob, rar: 0, lvl: 1, mods: {}, def: 2 };
      const h = Object.assign({}, R.hero, { vx: dx * RUN, vy: dy * RUN, face: dx < 0 ? -1 : 1, back: dy < 0 ? 1 : 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), st = heroSt(S);
      const rate = RUN / root.SIM.Q.stepLen(Math.abs(dx)) * Math.PI, tips = [];
      for (let k = 0; k <= N; k++) { const J = {}; L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = () => ({ w: 10, h: 10 }); L.solid = () => {};
        h.gp = 1 + rate * k / FPS; drawHero(h, 300, 300, T0 + k / FPS, st, {}); tips.push(J.tip); }
      const steps = tips.slice(1).map((p, k) => d(p, tips[k])), m = Math.max(...steps);
      if (m > TIP_STEP) out.push(`hero run: ${cls} ${wb}${ob ? ' and ' + ob : ''} running ${dn}: the weapon's tip moves ${m.toFixed(1)} px in a frame at frame ${steps.indexOf(m) + 1}`);
    }
  }
  // (TASKS 2160) the standing hero of each class, either way round, in the world and in the arch: the cape-side arm's hand hangs in
  // front of its elbow (the elbow does not bend backwards), the feet stand apart with a gap between the cape-side toe and the near heel,
  // the other foot a little further back (toe to heel on one line they read as one leg behind the other), the knees near straight, the cape is drawn before every leg part, and the limbs of both
  // sides are graded alike (the far ones were darker)
  function heroPoseCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), TOE_GAP = 2, DEPTH = 0.015, KNEE = 25, H = 84, FOOT = 0.14;
    // (TASKS 2164) each class against its own sheet: the warrior's 0.145 H, the others' 0.17–0.18; the shins near plumb as on the refs
    // (the cape-side one splayed out 14–17°, the near one leaned in up to 11°, the refs: both 2–8° out), SHIN: degrees out from the body
    const SPREAD = { warrior: 0.145 }, SPREAD0 = 0.16, SHIN = { L: [-6, 10], R: [-4, 12] };
    const KITS = [['warrior', 'sword'], ['mage', 'staff'], ['archer', 'shortbow']], seen = new Set();
    for (const [cls, wb] of KITS) for (const face of [1, -1]) for (const menu of [0, 1]) for (const GT of [10, 11.3, 12.7]) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      const h = Object.assign({}, R.hero, { vx: 0, vy: 0, gp: 0, face, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 });
      const J = {}, spr = [], tag = `${cls} face ${face}${menu ? ' in the arch' : ''} at ${GT}`, say = (m) => { if (!seen.has(cls + m)) { seen.add(cls + m); out.push(`hero pose: ${tag}: ${m}`); } };
      L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
      drawHero(h, 300, 300, GT, heroSt(S), menu ? { menu: 1 } : {});
      if ((J.handL[0] - J.elbowL[0]) * face < 0) say(`the cape-side hand hangs ${Math.abs(J.handL[0] - J.elbowL[0]).toFixed(1)} px behind its elbow`);
      const gap = (J.heelR[0] - J.toeL[0]) * face, spread = Math.abs(J.ankleR[0] - J.ankleL[0]) / H;
      if (gap < TOE_GAP) say(`the cape-side toe is ${gap.toFixed(1)} px from the near heel: the feet stand toe to heel on one line`);
      for (const k of ['L', 'R']) { const fl = Math.abs(J['toe' + k][0] - J['heel' + k][0]) / H; if (fl > FOOT) say(`the ${k} foot is ${fl.toFixed(3)} of the height heel to toe: in profile, not 3/4`); }
      if (spread < (SPREAD[cls] ?? SPREAD0)) say(`the ankles are ${(spread * 100).toFixed(1)} % of the height apart`);
      for (const k of ['L', 'R']) { const out = Math.atan2(J['ankle' + k][0] - J['knee' + k][0], J['ankle' + k][1] - J['knee' + k][1]) * 180 / Math.PI * face * (k === 'L' ? -1 : 1);
        if (out < SHIN[k][0] || out > SHIN[k][1]) say(`the ${k} shin leans ${out.toFixed(0)}° out from the body (${SHIN[k].join('..')})`); }
      if (J.ankleL[1] - J.ankleR[1] < DEPTH * H) say(`the other foot stands ${(J.ankleL[1] - J.ankleR[1]).toFixed(1)} px behind the cape-side one: both on one line`);
      for (const k of ['L', 'R']) { const a = Math.atan2(J['knee' + k][1] - J['hip' + k][1], J['knee' + k][0] - J['hip' + k][0]) - Math.atan2(J['ankle' + k][1] - J['knee' + k][1], J['ankle' + k][0] - J['knee' + k][0]), deg = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI;
        if (deg > KNEE) say(`the ${k} knee is bent ${deg.toFixed(0)}° at ease`); }
      const pn = D.CLASSES[cls].look.rig + '__', idx = (re) => spr.map((q, i) => (re.test(q.n.slice(pn.length)) && q.n.startsWith(pn) ? i : -1)).filter((i) => i >= 0);
      const cape = idx(/^cape/), legs = idx(/^(thigh|shin|foot)[LR]/);
      if (cape.length && legs.some((i) => i < Math.max(...cape))) say('the cape is drawn over a leg');
      const grade = (re) => spr.filter((q) => q.n.startsWith(pn) && re.test(q.n.slice(pn.length))).map((q) => String(q.o.u.grade));
      for (const k of ['uarm', 'farm', 'thigh', 'shin', 'foot']) { const l = grade(new RegExp('^' + k + 'L')), r = grade(new RegExp('^' + k + 'R'));
        if (l.length && r.length && l[0] !== r[0]) say(`${k}L is graded ${l[0]}, ${k}R ${r[0]}`); }
    }
    heroArmPose(out, drawHero, L);
  }
  // (TASKS 2181) the arms against the class sheets, in shares of the height (soles to the top), as tools/measure/chars_ref/reach.py counts
  // them: at ease the near (cape-side) hand hangs at least OUT outside its shoulder and its forearm is drawn over the body unless a shield
  // rides it (under the body the warrior's hand lay behind the belt pouch, 0.004 H out); the far fist of the weapon arm stands in its class's
  // band FIST with the forearm at most FORE degrees off plumb (2177 bent it 51–58° out from behind the torso; the sheets: warrior 5°, archer
  // 36°), the mage's at his chest; the orb's palm out beside the body (it lay on the chest, 0.12 H inside); on the run no hand reaches more
  // than RUN_REACH from its shoulder nor drops under RUN_HAND (0.337 and 0.450 before)
  function heroArmPose(out, drawHero, L) {
    const OUT = 0.03, FIST = { warrior: [0.45, 0.5], archer: [0.46, 0.52], mage: [0.62, 0.72] }, FORE = { warrior: 25, archer: 42 }, ORB = { out: 0.03, h: [0.58, 0.66] }, RUN_REACH = 0.33, RUN_HAND = 0.46, FPS = 60, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const KITS = [['warrior', 'sword'], ['archer', 'shortbow'], ['mage', 'staff'], ['mage', 'staff', 'orb'], ['warrior', 'sword', 'shield']], seen = new Set();
    for (const [cls, wb, ob] of KITS) for (const face of [1, -1]) for (const menu of [0, 1]) for (const run of [0, 1]) {
      if (menu && run) continue;
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      if (ob) R.hero.eq.offhand = { id: 0, b: ob, rar: 0, lvl: 1, mods: {}, def: 2 };
      const st = heroSt(S), pn = D.CLASSES[cls].look.rig + '__', tag = `${cls}${ob ? ' and ' + ob : ''} ${run ? 'running' : 'at ease'} face ${face}${menu ? ' in the arch' : ''}`;
      const say = (m) => { const k = cls + (ob || '') + run + m.replace(/[\d.-]+/g, ''); if (!seen.has(k)) { seen.add(k); out.push(`hero arm pose: ${tag}: ${m}`); } };
      const rate = root.SIM.K.RUN / root.SIM.Q.stepLen(1) * Math.PI;
      for (let k = 0; k < (run ? 40 : 1); k++) { const J = {}, spr = [];
        L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n) => { spr.push(n); return { w: 10, h: 10 }; }; L.solid = () => {};
        drawHero(Object.assign({}, R.hero, { vx: run ? root.SIM.K.RUN * face : 0, vy: 0, gp: run ? 1 + rate * k / FPS : 0, face, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: -9, whirlT: -9 }), 300, 300, 10 + k / FPS, st, menu ? { menu: 1 } : {});
        const H = J.ground[1] - J.top[1], hh = (s) => (J.ground[1] - J['hand' + s][1]) / H, dx = (s) => (s === 'L' ? -1 : 1) * face * (J['hand' + s][0] - J['sh' + s][0]) / H;
        if (run) { for (const s of ob === 'orb' ? ['R'] : ['L', 'R']) { const r = d(J['sh' + s], J['hand' + s]) / H;
          if (r > RUN_REACH) say(`the ${s} hand reaches ${r.toFixed(3)} of the height from its shoulder (at most ${RUN_REACH})`);
          if (hh(s) < RUN_HAND && !(cls === 'mage' && s === 'R')) say(`the ${s} hand drops to ${hh(s).toFixed(3)} of the height (at least ${RUN_HAND})`); }
          continue; }
        if (ob === 'orb') { if (dx('L') < ORB.out || hh('L') < ORB.h[0] || hh('L') > ORB.h[1]) say(`the orb's palm is ${dx('L').toFixed(3)} out of the shoulder at ${hh('L').toFixed(3)} of the height (out ${ORB.out}, ${ORB.h.join('..')})`); }
        else { if (dx('L') < OUT) say(`the near hand hangs ${dx('L').toFixed(3)} of the height out of its shoulder (at least ${OUT})`);
          const body = spr.findIndex((n) => n.startsWith(pn + 'body')), fa = spr.findIndex((n) => n.startsWith(pn + 'farmL') && !n.includes('_sock'));
          if (!ob && fa < body) say('the near forearm is drawn under the body'); }
        if (hh('R') < FIST[cls][0] || hh('R') > FIST[cls][1]) say(`the weapon fist stands at ${hh('R').toFixed(3)} of the height (${FIST[cls].join('..')})`);
        const fore = Math.atan2(Math.abs(J.handR[0] - J.elbowR[0]), J.handR[1] - J.elbowR[1]) * 180 / Math.PI;
        if (FORE[cls] !== undefined && fore > FORE[cls]) say(`the weapon forearm stands ${fore.toFixed(0)}° off plumb (at most ${FORE[cls]}°)`); }
    }
  }
  // (TASKS 2165, 2170) the mage's hands hold what they hold, counted on the textures' own pixels: the staff's or the wand's axis runs
  // through the near fist's centre, the fist's pixels lie over the shaft (drawn after it) and the shaft shows on both sides of the fist;
  // the orb rests above the far palm, the forearm under it near level, standing and running, either way round, in the world and the arch
  // (TASKS 2187) the fist closes on the crooked shaft itself: the staff's own pixels just above and below it sit on the fist's middle
  // (on the hand it sat 2 px off, the shaft along the fist's edge as if tied to the wrist); the orb lies in the cup (mage__cupL) drawn over
  // it, the forearm a cuff (cuffL)
  // (TASKS 2190) the cup's skin against mage_a_v4, counted in the cup's own frame (its up) in radii r of the orb's rim: none of it on the
  // orb's face inside FACE r (the sheet has none; the 2187 cup had 44 ‰ of it there), its highest texel at least TIP_LOW r under the centre
  // (2187: 0.08 r; the sheet's fingertips 0.77 r and more), at least TIPS texels of fingers round the lower outer rim, a palm under the
  // centre, the wrist rising outward from the under-sleeve to the palm by WRIST degrees (2187: a level bar); and it turns with the forearm,
  // its turn off rest the forearm's within TURN_TOL rad up to TURN (it stood upright while the forearm went down on a cast)
  function heroFistCheck(out) {
    const SB = require('./sandbox.cjs'), { drawHero, L } = SB.heroBox(D, root.SIM, SB.assets()), fs = require('fs'), zlib = require('zlib'), path = require('path');
    const AXIS = 2, OVER = 4, PAST = 2, GRIP = 2.5, SHAFT = 0.75, BAND = 3, LEVEL = 50, HAND = 0.5, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const RIM = 0.85, FACE = 0.85, TIP_LOW = 0.6, TIPS = 6, RIM_OUT = 1.35, PALM = [0.9, 2.2], WRIST = [5, 45], TURN = 0.44, TURN_TOL = 0.12;
    const alphaCache = {}, alpha = (n) => alphaCache[n] || (alphaCache[n] = (() => {
      const buf = fs.readFileSync(path.join(__dirname, 'assets', n + '.png')), W = buf.readUInt32BE(16), H = buf.readUInt32BE(20), ct = buf[25], bpp = { 6: 4, 2: 3, 4: 2, 0: 1 }[ct];
      if (buf[24] !== 8 || !bpp) throw new Error(n + ': only 8-bit PNGs are read');
      const idat = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8); if (type === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
      const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(W * H * bpp), st = W * bpp;
      for (let y = 0; y < H; y++) { const f = raw[y * (st + 1)], r = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)), o = y * st;
        for (let x = 0; x < st; x++) { const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - st + x] : 0, c = x >= bpp && y ? px[o - st + x - bpp] : 0, p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          px[o + x] = (r[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
      const A = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) A[i] = bpp === 4 ? px[i * 4 + 3] : bpp === 2 ? px[i * 2 + 1] : 255; return { W, H, A, px, bpp }; })());
    const rgb = (t, x, y) => { const i = (y * t.W + x) * t.bpp; return t.bpp >= 3 ? [t.px[i], t.px[i + 1], t.px[i + 2]] : [t.px[i], t.px[i], t.px[i]]; };
    const skinTx = (x, y, t) => { const [r, g, b] = rgb(t, x, y); return r > g && g > b && r - b > 40; };
    const creamTx = (x, y, t) => { const [r, g, b] = rgb(t, x, y); return r > 110 && b >= r - 10 && Math.abs(r - g) < 40; };
    const rest = {}, wrapPi = (a) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
    // a drawn sprite's opaque texels on the screen: (u w − pivot) through its matrix, one point per texel
    const texels = (q, keep = () => true) => { const t = alpha(q.n), o = q.o, pts = [];
      for (let y = 0; y < t.H; y++) for (let x = 0; x < t.W; x++) if (t.A[y * t.W + x] > 127 && keep(x, y, t)) pts.push(L.M.ap(o.m, [(x + 0.5) / t.W * o.w - o.pivot[0], (y + 0.5) / t.H * o.h - o.pivot[1]]));
      return pts; };
    const seen = new Set();
    for (const [wb, ob] of [['staff'], ['wand'], ['staff', 'orb'], ['wand', 'orb']]) for (const face of [1, -1]) for (const menu of [0, 1]) for (const [act, vx, GT] of [['rest', 0, 10], ['rest', 0, 11.3], ['run', 150, 10], ['run', 150, 11.3], ['cast', 0, 10.3]]) {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'mage' }); S.run = R; R.hero.eq.weapon = { id: 0, b: wb, rar: 0, lvl: 1, mods: {}, atk: 6 };
      if (ob) R.hero.eq.offhand = { id: 0, b: ob, rar: 0, lvl: 1, mods: {}, def: 2 };
      const h = Object.assign({}, R.hero, { vx, vy: 0, gp: GT * 4, face, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, atkT: -9, patkT: -9, castT: act === 'cast' ? 10 : -9, castK: act === 'cast' ? 'frost' : '', whirlT: -9 });
      const J = {}, spr = [], tag = `mage ${wb}${ob ? ' and orb' : ''} ${act} face ${face}${menu ? ' in the arch' : ''} at ${GT}`, say = (m) => { const k = wb + (ob || '') + m.replace(/[\d.]+/g, ''); if (!seen.has(k)) { seen.add(k); out.push(`hero fist: ${tag}: ${m}`); } };
      L.joint = (id, n, p) => { if (id === 'hero') J[n] = p; }; L.sprite = (n, x, y, o) => { spr.push({ n, o }); return { w: 10, h: 10 }; }; L.solid = () => {};
      drawHero(h, 300, 300, GT, heroSt(S), menu ? { menu: 1 } : {});
      // (TASKS 2177) the fist is its own sprite (mage__fistR), closed over the shaft at the hand
      const fi = spr.findIndex((q) => /^mage__fistR/.test(q.n)), wi = spr.findIndex((q) => /^it_(staff|wand)/.test(q.n));
      if (fi < 0 || wi < 0) { say(`the fist or the ${wb} is not drawn`); continue; }
      const F = spr[fi], at = [F.o.m[4], F.o.m[5]];
      if (d(at, J.handR) > GRIP) { say(`the fist sits ${d(at, J.handR).toFixed(1)} px from the hand`); continue; }
      if (fi < wi) say(`the ${wb} is drawn over the fist`);
      const fist = texels(F), wpn = texels(spr[wi]);
      const c = fist.reduce((a, p) => [a[0] + p[0] / fist.length, a[1] + p[1] / fist.length], [0, 0]), g = J.grip, t = J.tip, len = d(g, t), u = [(t[0] - g[0]) / len, (t[1] - g[1]) / len];
      const off = Math.abs((c[0] - g[0]) * u[1] - (c[1] - g[1]) * u[0]);
      if (off > AXIS) say(`the ${wb}'s axis passes ${off.toFixed(1)} px from the fist's centre`);
      const cell = (p) => Math.round(p[0]) + ',' + Math.round(p[1]), fc = new Set(fist.map(cell)), over = new Set(wpn.map(cell).filter((k) => fc.has(k))).size;
      if (over < OVER) say(`the fist lies over ${over} px of the ${wb}`);
      const along = (p) => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1], fa = fist.map(along), lo = Math.min(...fa), hi = Math.max(...fa), wa = wpn.filter((p) => !fc.has(cell(p))).map(along);
      if (!wa.some((a) => a > hi + PAST) || !wa.some((a) => a < lo - PAST)) say(`the ${wb} does not show on both sides of the fist`);
      const across = (p) => (p[0] - c[0]) * u[1] - (p[1] - c[1]) * u[0], mid = (b) => { const x = b.map(across); return x.length ? (Math.min(...x) + Math.max(...x)) / 2 : 0; };
      if (wb === 'staff' && act === 'rest') for (const [nm, b] of [['above', wpn.filter((p) => along(p) > hi && along(p) < hi + BAND)], ['below', wpn.filter((p) => along(p) < lo && along(p) > lo - BAND)]])
        if (Math.abs(mid(b)) > SHAFT) say(`the shaft ${nm} the fist runs ${mid(b).toFixed(2)} px off its middle`);
      if (!ob) continue;
      const orb = spr.find((q) => /^orb_held/.test(q.n)), oc = orb && [orb.o.m[4], orb.o.m[5]];
      if (!orb) { say('the orb is not drawn'); continue; }
      const ci = spr.findIndex((q) => /^mage__cupL/.test(q.n)), cuff = spr.findIndex((q) => /^mage__cuffL/.test(q.n));
      if (ci < spr.indexOf(orb) || cuff < 0 || cuff > ci || spr.some((q) => /^mage__farmL/.test(q.n))) { say('the orb is not lying in the cup over the cuff'); continue; }
      const Cq = spr[ci], up0 = L.M.ap(Cq.o.m, [0, -1]), c0 = L.M.ap(Cq.o.m, [0, 0]), ul = d(up0, c0), up = [(up0[0] - c0[0]) / ul, (up0[1] - c0[1]) / ul];
      const r = orb.o.h / 2 * RIM, out1 = -face, sx = -up[1] * out1 > 0 ? 1 : -1, ox = [-up[1] * sx, up[0] * sx];
      const loc = (p) => { const v = [p[0] - oc[0], p[1] - oc[1]]; return [v[0] * ox[0] + v[1] * ox[1], -(v[0] * up[0] + v[1] * up[1])]; };
      const skin = texels(Cq, skinTx).map(loc), cream = texels(Cq, creamTx).map(loc), hyp = (q) => Math.hypot(q[0], q[1]);
      const onFace = skin.filter((q) => hyp(q) < FACE * r).length, top = Math.min(...skin.map((q) => q[1])) / r;
      if (onFace > 0) say(`${onFace} px of the cup's skin lie on the orb's face (inside ${FACE} of its radius)`);
      if (top < TIP_LOW) say(`the cup's highest skin is ${top.toFixed(2)} of the orb's radius under its centre (at least ${TIP_LOW})`);
      const tips = skin.filter((q) => hyp(q) >= FACE * r && hyp(q) < RIM_OUT * r && q[0] > 0 && q[1] > 0).length;
      if (tips < TIPS) say(`${tips} px of fingers lie round the orb's lower outer rim`);
      const palmQ = skin.filter((q) => Math.abs(q[0]) < r / 2 && q[1] > PALM[0] * r && q[1] < PALM[1] * r);
      if (!palmQ.length) say('no palm under the orb\'s centre');
      const mean = (a) => a.reduce((m, q) => [m[0] + q[0] / a.length, m[1] + q[1] / a.length], [0, 0]);
      if (act === 'rest' && cream.length && palmQ.length) { const a = mean(cream), b = mean(skin.filter((q) => q[1] > PALM[0] * r)), w = Math.atan2(a[1] - b[1], b[0] - a[0]) * 180 / Math.PI;
        if (w < WRIST[0] || w > WRIST[1]) say(`the wrist rises ${w.toFixed(0)}° from the under-sleeve to the palm (${WRIST.join('..')})`); }
      const key = wb + face + menu, ang = Math.atan2(up[1], up[0]), fore = Math.atan2(J.handL[1] - J.elbowL[1], J.handL[0] - J.elbowL[0]);
      if (act === 'rest' && !rest[key]) rest[key] = { ang, fore };
      else if (act === 'cast' && rest[key]) { const df = wrapPi(fore - rest[key].fore), dc = wrapPi(ang - rest[key].ang), want = Math.max(-TURN, Math.min(TURN, df));
        if (Math.abs(dc - want) > TURN_TOL) say(`the cup turns ${dc.toFixed(2)} rad while the forearm turns ${df.toFixed(2)} (it should follow up to ${TURN})`); }
      if (act !== 'cast') { const lv = Math.abs(Math.atan2(J.handL[1] - J.elbowL[1], Math.abs(J.handL[0] - J.elbowL[0]))) * 180 / Math.PI, hy = (J.ground[1] - J.handL[1]) / (J.ground[1] - J.top[1]);
        if (lv > LEVEL) say(`the forearm under the orb is ${lv.toFixed(0)}° off level`);
        if (hy < HAND) say(`the orb's palm is ${hy.toFixed(2)} of the height over the soles`); }
    }
  }
  SIMX.checks.add('heroPoseCheck', heroPoseCheck);
  SIMX.checks.add('heroFistCheck', heroFistCheck);
  SIMX.checks.add('classCheck', classCheck);
  SIMX.checks.add('heroGripCheck', heroGripCheck);
  SIMX.checks.add('heroTurnCheck', heroTurnCheck);
  SIMX.checks.add('heroRunCheck', heroRunCheck);
  SIMX.checks.add('powerCheck', checkPowers);
  SIMX.checks.add('dataLinkCheck', dataLinkCheck);
})(typeof window !== 'undefined' ? window : globalThis);
