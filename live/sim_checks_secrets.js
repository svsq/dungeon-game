// live/sim_checks_secrets.js — selfCheck's parts for secrets, doors, traps, altars, chests and the rest of the run's rooms. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    aggroRoom, angDiff, arenaPath, arenaSealed, ARROW_Y, BAL, BASES, begin, beginBossMove, bossEggs, bossLava, bossRaise, bossThink, bossWebs,
    boxHit, cell, colossusBoulder, colossusRain, completion, completionHints, counted, CRUST, crustAt, D, damageName, deepBody, dep, DG, DOOM,
    doorLock, DT, endRun, ENEMIES, enterFloor, floorStat, flow, fstat, heroSt, hidden, hitEnemy, hitProps, hurtHero, interact, inWater, isCons, K,
    killEnemy, LOOT, lootAudit, losClear, move, newRun, onLava, openAltar, openChest, openDoor, openSecret, persist, poolOk, potion, RARITY, REWARD,
    rollAffixes, rollItem, runReward, secretUnder, serpent, serpentMouth, solidAt, solids, spawn, springAmbush, startRun, stats, steer, step,
    stepArena, stepBossMove, stepDrops, stepProjectiles, struck, tearWebs, throwAway, TILE, toPx, UI, under, usePotion, wearIfFree, wideClear } = SIMX;
  const { noWelcome, plainRun, swing } = SIMX.checks.kit;
  const find = (f) => { for (let sd = 1; sd < 120; sd++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 5000 + sd); const q = S.run.map.secrets.find(f); if (q) return [S, q]; } return [null, null]; };
  const standAt = (R, q) => { const h = R.hero, P = q.trig, tc = P && P.k === 'sconce' ? R.map.torches[P.t] : null; Object.assign(h, { vx: 0, vy: 0 });
    if (q.kind === 'banner') { h.x = q.x; h.y = q.y + 34; } if (q.kind === 'shelf' || q.kind === 'statue') { h.x = q.x; h.y = q.y + 70; } if (tc) { h.x = tc.x; h.y = tc.y + 50; } if (P && P.k === 'lever') { h.x = P.x; h.y = P.y + 50; } if (P && P.k === 'plate') { h.x = P.x; h.y = P.y; } };
  const pressE = (S) => { step(S, { keys: ['KeyE'], px: 960, py: 540 }); for (let k = 0; k < 6; k++) step(S, { keys: [], px: 960, py: 540 }); };
  const playItem = (S, R, q, j) => { const it = q.pz.items[j], h = R.hero, st0 = q.pz.step; for (let k = 0; k < 3 && !it.on && q.pz.step === st0 && !q.open; k++) { if (q.pz.k === 'levers') { h.x = it.x; h.y = it.y + 50; } else { h.x = it.x + 20; h.y = it.y + 6; } h.vx = h.vy = 0; pressE(S); } };
  function secretCheck() {
    const out = [];
    // every kind of cover and mechanism, played from the floor: blows at it open nothing; E (a flagstone: a step) opens it, and it counts once
    for (const [name, f] of [['banner', (o) => o.kind === 'banner'], ['statue', (o) => o.kind === 'statue'], ['sconce', (o) => o.trig && o.trig.k === 'sconce' && o.dir === 'u'], ['plate', (o) => o.trig && o.trig.k === 'plate' && o.dir === 'u' && o.parent === undefined], ['lever', (o) => o.trig && o.trig.k === 'lever']]) {
      const [S, q] = find(f); if (!q) { out.push(`secret check: no ${name} secret in 120 seeds`); continue; }
      S.screen = 'play'; const R = S.run, m = R.map, h = R.hero, qi = m.secrets.indexOf(q); R.en = []; R.stats[1] = floorStat(R); h.ifr = 1e9;
      const k0 = q.slide ? Math.floor((q.y + 22) / TILE) * m.W + Math.floor(q.x / TILE) : -1, d0 = q.slide ? m.decor.find((o) => o.secret === qi).x : 0;
      for (let k = 0; k < 2; k++) { h.x = q.x; h.y = q.y + 34; h.vx = h.vy = 0; h.cd.atk = 0; const A = { ...toPx(R, q.x, q.y - 30) }; step(S, Object.assign({ press: 1, keys: [] }, A)); for (let j = 0; j < 40; j++) step(S, Object.assign({ keys: [] }, A)); }
      if (q.open) out.push(`secret check ${name}: blows open it`);
      if (S.ev.some((e) => e.k === 'wallhit' || e.k === 'hollow')) out.push(`secret check ${name}: a wall still answers a blow`);
      standAt(R, q); if (name === 'plate') step(S, { keys: [] }); else for (let k = 0; k < 3 && !q.open; k++) { standAt(R, q); pressE(S); }
      if (!q.open) out.push(`secret check ${name}: its way does not open it`);
      if (q.wall.some(([x, y]) => cell(m, x, y) !== 1)) out.push(`secret check ${name}: the opened wall is still solid`);
      if (R.stats[1].sec !== 1) out.push(`secret check ${name}: a found secret is not counted (${R.stats[1].sec})`);
      if (name === 'statue') { const d = m.decor.find((o) => o.secret === qi), k1 = k0 + q.slide.s * q.slide.n, t1 = S.t + D.STATUE_SECRET.slide + 0.05; while (S.t < t1) step(S, { keys: [] }); if (d.x === d0 || m.block.includes(k0) || !m.block.includes(k1)) out.push(`secret check ${name}: it has not moved, or its block has not`);
        if (Math.abs(d.x - d0) !== q.slide.n * TILE || ![1, 2].includes(q.slide.n)) out.push(`secret check ${name}: it slid the wrong distance`); }
      standAt(R, q); pressE(S); if (R.stats[1].sec !== 1) out.push(`secret check ${name}: a found secret counts twice`); }
    // a statue never closes on the hero: with him on its way it stays put
    for (const kind of ['statue']) { const [S, q] = find((o) => o.kind === kind); if (q) { S.screen = 'play'; const R = S.run, fy = Math.floor((q.y + 22) / TILE); R.en = []; Object.assign(R.hero, { x: (Math.floor(q.x / TILE) + q.slide.s + 0.5) * TILE, y: fy * TILE + 16, vx: 0, vy: 0 });
        if (secretUnder(R) !== q) out.push(`secret check ${kind}: the hero beside it cannot reach it`); else { interact(S, R); if (q.open) out.push(`secret check ${kind}: it slid onto the hero`); } } }
    // (TASKS 1852) a false bookcase breaks on its third blow, as before 0.3.0: E does nothing to it, the first two blows rock it, the
    // third leaves planks, frees its cell, opens the cache and counts it once; a bolt or a blast counts as a blow
    { const shelfAt = () => { const [S, q] = find((o) => o.kind === 'shelf'); if (!q) return []; S.screen = 'play'; const R = S.run, m = R.map, qi = m.secrets.indexOf(q), d = m.decor.find((o) => o.secret === qi);
        R.en = []; R.stats[1] = floorStat(R); R.hero.ifr = 1e9; return [S, R, m, q, d, Math.floor(d.y / TILE) * m.W + Math.floor(q.x / TILE)]; };
      const opened = (R, m, q, d, k0) => q.open && d.broken && !d.solid && !m.block.includes(k0) && q.wall.every(([x, y]) => cell(m, x, y) === 1);
      { const [S, R, m, q, d, k0] = shelfAt(); if (!q) out.push('secret check shelf: no bookcase cache in 120 seeds');
        else { standAt(R, q); pressE(S); if (q.open) out.push('secret check shelf: E opens a bookcase');
          for (let k = 1; k < D.SHELF_SECRET.hp; k++) { swing(S, R, q); if (q.open || !d.solid || !m.block.includes(k0)) out.push(`secret check shelf: it breaks on blow ${k}`); }
          if ((q.hits || 0) !== D.SHELF_SECRET.hp - 1) out.push(`secret check shelf: ${q.hits || 0} of its ${D.SHELF_SECRET.hp - 1} blows counted`);
          S.ev = []; swing(S, R, q); if (!opened(R, m, q, d, k0)) out.push(`secret check shelf: blow ${D.SHELF_SECRET.hp} does not break it open`);
          if (!S.ev.some((e) => e.k === 'break') || !S.ev.some((e) => e.k === 'secret')) out.push('secret check shelf: no break or secret event');
          if (R.stats[1].sec !== 1) out.push(`secret check shelf: a broken bookcase is not counted once (${R.stats[1].sec})`);
          swing(S, R, q); if (R.stats[1].sec !== 1) out.push('secret check shelf: a broken bookcase counts again'); } }
      { const [S, R, m, q, d, k0] = shelfAt(); if (q) { for (let k = 0; k < D.SHELF_SECRET.hp; k++) { S.t += 0.5; hitProps(S, R, d.x, d.y + 12, 24); } if (!opened(R, m, q, d, k0)) out.push('secret check shelf: bolts at its foot do not break it'); } }
      // old saves: one open on its hinge (0.3.0) or slid along the wall (a build of 1851) loads broken at its own place, its cells
      // free; a shut one (of either) loads whole and still breaks
      const old = (open, slid) => { const [S, R, m, q, d, k0] = shelfAt(); if (!q) return []; m.block = m.block.filter((b) => b !== k0);
        if (open) { q.open = 1; q.openT = S.t - 5; for (const [x, y] of q.wall) m.cells[y * m.W + x] = 1; }
        if (slid) { q.slide = { s: 1, n: 3 }; if (open) { d.x = q.x + 3 * TILE; m.block.push(k0 + 3); } else m.block.push(k0); } else if (open) { q.hinge = 1; d.solid = 0; d.broken = 1; } else m.block.push(k0);
        S.run = JSON.parse(JSON.stringify(R)); SIMX.migrateSecrets(S.run); const R2 = S.run, m2 = R2.map, q2 = m2.secrets[m.secrets.indexOf(q)]; return [S, R2, m2, q2, m2.decor.find((o) => o.secret === m2.secrets.indexOf(q2)), k0]; };
      for (const slid of [0, 1]) { const tag = slid ? 'slid (1851)' : 'on its hinge (0.3.0)';
        { const [, , m, q, d, k0] = old(1, slid); if (q && (!opened(null, m, q, d, k0) || d.x !== q.x || q.slide || q.hinge || (slid && m.block.includes(k0 + 3)) || d.brokeT === undefined)) out.push(`secret check shelf: an old save's bookcase open ${tag} does not load broken in its place`); }
        { const [S, R, m, q, d, k0] = old(0, slid); if (q) { if (q.slide || !d.solid || d.broken || d.x !== q.x || !m.block.includes(k0)) out.push(`secret check shelf: an old save's shut bookcase ${tag} does not load whole`);
          for (let k = 0; k < D.SHELF_SECRET.hp; k++) { S.t += 0.5; hitProps(S, R, d.x, d.y + 12, 24); } if (!opened(R, m, q, d, k0)) out.push(`secret check shelf: an old save's shut bookcase ${tag} does not break`); } } } }
    // puzzles (TASKS 1692, 1989): the right order opens the cache; a wrong one is caught at the difficulty's check point (easy at the
    // first piece, normal at the second, hard at the last), puts everything back at once and hurts nobody; before that every piece takes
    for (const k of ['levers', 'candles']) { const [S0, q0] = find((o) => o.pz && o.pz.k === k); if (!q0) { out.push(`secret check: no ${k} puzzle in 120 seeds`); continue; }
      const seed = S0.run.seed, qi = S0.run.map.secrets.indexOf(q0); for (const diff of D.DIFF_ORDER) {
      const fresh = () => { const S = spawn(0, {}); S.meta.diff = diff; S.run = newRun(S, 'campaign', seed); S.screen = 'play'; const R = S.run; R.en = []; R.stats[1] = floorStat(R); R.hero.ifr = 1e9; return [S, R, R.map.secrets[qi]]; };
      const tag = `puzzle ${k} (${diff})`, lit = (R, q) => q.pz.items.filter((it) => it.on).length, dark = (S, R, q) => R.map.decor.filter((d) => d.pz === R.map.secrets.indexOf(q) && (d.outUntil || 0) > S.t).length;
      const at = diff === 'easy' ? 1 : diff === 'normal' ? 2 : q0.pz.items.length;
      for (const wrong of [[1, 0, 2], [0, 2, 1], [2, 1, 0]]) { const [S, R, q] = fresh(), hp0 = R.hero.hp, ord = [...q.pz.items.keys()].sort((a, b) => q.pz.items[a].n - q.pz.items[b].n);
        const miss = wrong.findIndex((w, j) => w !== j), stop = Math.max(miss + 1, at);
        for (let j = 0; j < wrong.length; j++) { playItem(S, R, q, ord[wrong[j]]);
          if (j + 1 < stop) { if (lit(R, q) !== j + 1 || q.open) out.push(`${tag}: order ${wrong} is judged before its check point (piece ${j + 1})`); if (k === 'candles' && dark(S, R, q) !== q.pz.items.length - j - 1) out.push(`${tag}: a candle went out before the check point`); }
          else if (j + 1 === stop) { if (lit(R, q) || q.pz.step || q.open) out.push(`${tag}: order ${wrong} does not reset at piece ${j + 1}`); if (k === 'candles' && dark(S, R, q) !== q.pz.items.length) out.push(`${tag}: a wrong order left a candle lit`);
            if (!S.ev.some((e) => e.k === 'nope' && e.s === TXT('sim_world.pz.nope'))) out.push(`${tag}: a wrong order does not say «${TXT('sim_world.pz.nope')}»`); break; } }
        if (q.open) out.push(`${tag}: a wrong order opens it`); if (R.hero.hp !== hp0) out.push(`${tag}: a wrong try costs health`);
        for (const j of ord) playItem(S, R, q, j); if (!q.open) out.push(`${tag}: the right order after a wrong one does not open it`);
        if (R.stats[1].sec !== 1) out.push(`${tag}: a solved puzzle is not counted`);
        if (k === 'candles' && dark(S, R, q)) out.push(`${tag}: a solved puzzle left a candle dark`); } } }
    // every secret of two whole campaigns, opened by the way the game offers it; a cache behind another is reached once its parent is open
    for (const sd of [11, 222]) for (let f = 1; f <= D.RUNS.campaign.chapter; f++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play';
      const R = S.run, m = R.map, h = R.hero; R.en = []; h.ifr = 1e9;
      m.secrets.forEach((q, i) => { if (q.parent !== undefined && !m.secrets[q.parent].open) openSecret(S, R, m.secrets[q.parent], true);
        if (q.pz) { for (const j of [...q.pz.items.keys()].sort((a, b) => q.pz.items[a].n - q.pz.items[b].n)) playItem(S, R, q, j); }
        else if (q.kind === 'shelf') for (let k = 0; k <= D.SHELF_SECRET.hp && !q.open; k++) swing(S, R, q);
        else for (let k = 0; k < 4 && !q.open; k++) { standAt(R, q); if (q.trig && q.trig.k === 'plate') step(S, { keys: [], px: 960, py: 540 }); else pressE(S); }
        if (!q.open) out.push(`seed ${sd} f${f}: secret ${i} (${q.kind}${q.trig ? ' ' + q.trig.k : ''}, ${q.dir}) does not open by its way`); }); }
    // loot: open every chest of a few floors (secret ones too, each after its secret, as in play: TASKS 1868, the loot of a chest opened
    // in a shut 3×5 cache had no cell out of its props' shade; a cursed chest as if its question had been answered «yes», TASKS 364), let the items fall and pick up half of them; the floor's books
    // balance at every stage and no item comes to rest where the hero cannot get to it
    for (const sd of [11, 222]) for (const f of [1, 4, 8]) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play';
      const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9; const check = (when) => { const A = lootAudit(R); if (A.off) out.push(`seed ${sd} f${f}: loot books off by ${A.off} ${when}`); if (A.stuck) out.push(`seed ${sd} f${f}: ${A.stuck} loot out of reach ${when}`); };
      check('on arrival'); for (const c of R.chests) { if (c.hex !== undefined) c.hexOk = 1; const line = []; for (let q = c.sec !== undefined ? R.map.secrets[c.sec] : null; q; q = q.parent !== undefined ? R.map.secrets[q.parent] : null) line.unshift(q); for (const q of line) if (!q.open) openSecret(S, R, q, true); openChest(S, R, c); } h.x = R.map.spawn.x; h.y = R.map.spawn.y; for (let k = 0; k < 120; k++) step(S, { keys: [] }); check('with every chest open');
      const pick = R.drops.filter((o) => o.loot && !o.got).slice(0, 6); for (const d of pick) for (let k = 0; k < 3; k++) { h.x = d.x; h.y = d.y; step(S, { keys: [] }); }
      if (pick.some((d) => !d.got)) out.push(`seed ${sd} f${f}: loot could not be picked up`); check('after picking some up'); }
    // debug: the button opens every secret without counting it, and the second press seals exactly those again
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 5001); S.screen = 'play'; const R = S.run, m = R.map, cells0 = m.cells.join(''), block0 = m.block.slice().sort().join(); R.stats[1] = floorStat(R);
      const b = UI.debug(R)[0], click = () => step(S, { keys: [], click: 1, press: 1, px: b.x + 10, py: b.y + 10 });
      step(S, { keys: ['Backquote'] }); if (!S.debug) out.push('debug: ` does not turn debug mode on');
      click(); if (m.secrets.some((q) => !q.open) || m.cells.includes(4)) out.push('debug: not every secret opened'); if (R.stats[1].sec) out.push('debug: secrets opened by the button count as found');
      if (S.ev.some((e) => e.k === 'swing')) out.push('debug: clicking the button swings the sword');
      click(); if (m.secrets.some((q) => q.open) || m.cells.join('') !== cells0 || m.block.slice().sort().join() !== block0) out.push('debug: the second press does not seal the secrets as they were');
      step(S, { keys: ['Backquote'] }); if (S.debug) out.push('debug: ` does not turn debug mode off'); }
    { const [S, q] = find((o) => o.kind === 'banner'); if (!q) out.push('secret check: no banner cache for the loot check'); else {
      S.screen = 'play'; const R = S.run, m = R.map, h = R.hero, qi = m.secrets.indexOf(q); R.en = []; R.stats[1] = floorStat(R); h.ifr = 1e9; standAt(R, q); pressE(S); void m;
      const c = R.chests.find((o) => o.sec === qi), n0 = R.stats[1].lootN, items = c.loot.length; h.x = c.x; h.y = c.y + 40; step(S, { keys: ['KeyE'] });
      if (!c.open || R.stats[1].lootN !== n0 || R.drops.filter((d) => d.kind === 'item').length !== items) out.push('loot check: a chest\'s items are not the ones counted on entering the floor');
      if (R.stats[1].loot !== 0) out.push('loot check: opening a chest counts as picking up');
      for (let k = 0; k < 120; k++) step(S, { keys: [] });
      for (const d of R.drops.filter((o) => o.kind === 'item')) { h.x = d.x; h.y = d.y; step(S, { keys: [] }); }
      if (R.stats[1].loot !== items) out.push(`loot check: ${R.stats[1].loot} of ${items} picked items counted`);
      const it = h.bag.find((b) => b && b.id === c.loot?.[0]?.id) || h.bag.find((b) => b && !isCons(b)) || Object.values(h.eq).find((e) => e && e.id > 2);
      if (it) { const i = h.bag.indexOf(it); if (i >= 0) h.bag[i] = null; throwAway(R, h, it); h.x += 200; for (let k = 0; k < 60; k++) step(S, { keys: [] }); h.x -= 200;
        for (let k = 0; k < 120; k++) { const d = R.drops.find((o) => o.item === it); if (d) { h.x = d.x; h.y = d.y; } step(S, { keys: [] }); } }
      if (R.stats[1].loot !== items || R.stats[1].lootN !== n0) out.push('loot check: an item thrown away and picked up again changed the loot count');
      const e = { id: 9e6, type: 'skeleton', x: h.x + 30, y: h.y, deadT: -1, hp: 1, elite: 1, st: 'idle', room: 0, kbx: 0, kby: 0 }; R.en.push(e); hitEnemy(S, R, e, 1e6, false, h.x, h.y);
      if (R.stats[1].lootN !== n0 + R.drops.filter((d) => d.loot && d.kind === 'item').length) out.push('loot check: a monster\'s drop is not added to the floor\'s loot'); } }
    { const R = { rs: 99 }, n = 4000, roll = (o) => { let top = 0, epic = 0, leg = 0; for (let i = 0; i < n; i++) { const it = rollItem(R, 5, o.q || 0, undefined, o); top = Math.max(top, it.rar); epic += it.rar >= 3; if (it.rar < (o.min || 0)) top = -9; leg += it.rar === 4; } return { top, epic: epic / n, leg: leg / n }; };
      const mob = roll(LOOT.mob), elite = roll(LOOT.elite), chest = roll(LOOT.chest[1]), hoard = roll(LOOT.chest[2]), sec = roll(LOOT.chest[4]), lg = roll(LOOT.boss[0]), brute = roll(LOOT.brute);
      if (mob.top > 3) out.push('loot: a common monster dropped a legendary');
      if (elite.top < 0) out.push('loot: a minimum rarity was not kept');
      if (lg.top !== 4) out.push('loot: the boss has no guaranteed legendary');
      if (chest.top > 3 || hoard.top > 3) out.push('loot: a plain chest held a legendary');
      if (sec.top !== 4) out.push('loot: a secret room\'s chest is capped');
      if (!(elite.leg > 0 && brute.leg > 0 && elite.leg < sec.leg)) out.push(`loot: legendary share elite ${elite.leg} brute ${brute.leg} secret ${sec.leg}`);
      if (!(LOOT.thin(21) < LOOT.thin(1) && LOOT.thin(99) >= 0.6)) out.push('loot: a common monster\'s chance does not thin with depth');
      if (!(mob.epic < chest.epic && chest.epic < hoard.epic && hoard.epic * 1.4 < sec.epic)) out.push(`loot: epic+ share mob ${mob.epic} chest ${chest.epic} treasure ${hoard.epic} secret ${sec.epic}`); }
    // TASKS 1344: a floor with every counted monster dead springs no chest ambush
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 411); S.run = R; S.screen = 'play'; const m = R.map, rm = m.rooms.filter((r) => r.type === 'combat').sort((p, q) => q.w * q.h - p.w * p.h)[0], mod = m.mod; rm.type = 'secret'; R.en = [];
      D.FLOOR_MODS.__t = { ambush: 1e3 }; m.mod = '__t'; R.hero.x = (rm.x + 1.5) * TILE; R.hero.y = (rm.y + 1.5) * TILE;
      const open = () => { const c = { x: (rm.x + rm.w / 2) * TILE, y: (rm.y + rm.h / 2) * TILE, tier: 1, open: 0, loot: [] }, n = R.en.length; R.chests.push(c); openChest(S, R, c); return R.en.length - n; }, f = fstat(R);
      f.foes = 10; f.kills = 9; if (open() <= 0) out.push('ambush: a chest does not spring it while monsters live');
      f.kills = 10; R.en = []; if (open() > 0) out.push('ambush: a chest springs it on a cleared floor');
      delete D.FLOOR_MODS.__t; m.mod = mod; }
    // TASKS 1341: a slot's own properties come up more often than the others, the number of them stays the rarity's
    { const R = { rs: 1341 }, n = 3000, share = (b, k) => { let c = 0; for (let i = 0; i < n; i++) { const it = rollAffixes(R, { b, rar: 2, lvl: 8, mods: {} }); if (Object.keys(it.mods).length !== RARITY[2].affixes) out.push(`affix: ${b} rolled the wrong number`); c += k in it.mods; } return c / n; };
      if (!(share('sword', 'atk') > 2 * share('sword', 'def'))) out.push('affix: a weapon does not favour attack over defence');
      if (!(share('plate_armor', 'def') > 2 * share('plate_armor', 'atk'))) out.push('affix: armour does not favour defence over attack');
      if (!(share('boots', 'mspd') > 2 * share('boots', 'crit'))) out.push('affix: boots do not favour speed'); }
    // TASKS 1345: a find's level follows a hero who has outgrown the floor, spreads, keeps to the source's floor under him; the seed repeats it
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 1345); R.hero.lvl = 25; const lv = (o) => Array.from({ length: 600 }, () => rollItem(R, 21, 0, undefined, o).lvl), low = (a) => Math.min(...a);
      const mob = lv(LOOT.mob), chest = lv(LOOT.chest[1]), boss = lv(LOOT.boss[2]);
      if (low(mob) < 22 || low(chest) < 23 || low(boss) < 24) out.push(`loot level: under the floor: mob ${low(mob)} chest ${low(chest)} boss ${low(boss)}`);
      if (new Set(mob).size < 2 || new Set(boss).size < 2) out.push('loot level: no spread');
      // TASKS 1673: the mimic's chest, a wreck and a mid-chapter boss's chest spread as the rest do
      const mim = Array.from({ length: 300 }, () => root.SIMX.chestLoot(R, { mimic: 1, tier: 2 })).flat().filter((it) => !isCons(it)).map((it) => it.lvl);
      if (new Set(mim).size < 2 || new Set(lv(D.WRECK)).size < 2 || LOOT.mini.items.some((o) => new Set(lv(o)).size < 2)) out.push('loot level: a mimic, a wreck or a mid-chapter boss chest has no spread');
      if (rollItem(R, 21, 0).lvl !== 21) out.push('loot level: a roll that names no source left the floor\'s level');
      const seq = (sd) => { const Q = { rs: sd, hero: R.hero }; return Array.from({ length: 50 }, () => rollItem(Q, 21, 0, undefined, LOOT.mob).lvl).join(); }; if (seq(5) !== seq(5)) out.push('loot level: the seed does not repeat it'); }
    // TASKS 1347: a find above the usual range is likelier for a hero ahead of his level, and its bonus is capped
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 1347), top = 15 + LOOT.mob.hi, roll = (lvl) => { R.hero.lvl = lvl; return Array.from({ length: 3000 }, () => rollItem(R, 15, 0, undefined, LOOT.mob).lvl); }, over = (a) => a.filter((v) => v > top).length;
      const ahead = roll(5), even = roll(15); if (!(over(ahead) > 2 * over(even))) out.push(`over-level: ahead ${over(ahead)}, even ${over(even)}`); if (!over(even)) out.push('over-level: a hero at the floor\'s level never finds one');
      if (Math.max(...ahead) > top + D.LOOT_OVER.up) out.push(`over-level: a bonus past the cap, ${Math.max(...ahead)}`); }
    // TASKS 1348: a piece above the hero's level is not put on by itself and still sells
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 1348), h = R.hero; S.run = R; h.lvl = 3; h.eq.helm = null; const it = { id: R.nextId++, b: 'knight_helm', rar: 1, lvl: 20, mods: {}, def: 5 };
      if (wearIfFree(S, R, it) || h.eq.helm) out.push('over-level: a piece above the hero goes on an empty slot'); if (!(D.sellPrice(it, 1) > 0)) out.push('over-level: a piece above the hero does not sell'); }
    // TASKS 1342: the crit-damage property raises the one multiplier, up to its cap
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 1342), h = R.hero, ring = (v) => { h.eq.ring = { id: 1, b: 'ring', rar: 1, lvl: 1, mods: { critd: v } }; return stats(h, S.meta).critK; }; h.eq.ring = null;
      if (stats(h, S.meta).critK !== D.CRIT.k) out.push('crit: the base multiplier is not CRIT.k');
      if (Math.abs(ring(50) - (D.CRIT.k + 0.5)) > 1e-9) out.push('crit: the property does not add to the multiplier');
      if (ring(1000) !== D.CRIT.cap) out.push('crit: the multiplier passes its cap'); h.eq.ring = null; }
    // completion: empty categories are left out, partial and full runs, a floor change, save/load, a one-time bonus
    { const C0 = completion([{ foes: 0, kills: 0, lootN: 0, loot: 0, secN: 0, sec: 0 }]); if (C0.pct !== 0) out.push('completion: an empty floor is not 0');
      const C1 = completion([{ foes: 10, kills: 5, lootN: 4, loot: 4, secN: 0, sec: 0 }]); if (Math.abs(C1.pct - 0.75) > 1e-9) out.push('completion: a floor without secrets counts them as 0%');
      const C2 = completion([{ foes: 10, kills: 10, lootN: 4, loot: 4, secN: 1, sec: 1 }, { foes: 6, kills: 6, lootN: 2, loot: 2, secN: 1, sec: 1 }]); if (C2.pct !== 1) out.push('completion: a full run is not 100%');
      const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run;
      const f1 = R.stats[1]; if (!f1 || f1.foes !== R.en.length || f1.lootN !== R.chests.reduce((n, c) => n + c.loot.length, 0) || f1.secN !== R.map.secrets.length) out.push('completion: floor 1 totals wrong');
      const e = R.en[0]; hitEnemy(S, R, e, 1e6, false, e.x, e.y); if (R.stats[1].kills !== 1) out.push('completion: a kill is not counted');
      R.en.push(Object.assign({}, e, { id: 9e6, deadT: -1, hp: 5, summ: 1 })); hitEnemy(S, R, R.en.at(-1), 1e6, false, e.x, e.y);
      if (R.stats[1].kills !== 1 || floorStat(R).foes !== R.stats[1].foes) out.push('completion: a summoned monster counts');
      enterFloor(S, R, 2); if (!R.stats[1] || R.stats[1].kills !== 1 || !R.stats[2] || R.stats[2].kills !== 0) out.push('completion: a floor change lost or mixed the stats');
      const T = spawn(0, { meta: S.meta, run: JSON.parse(JSON.stringify(R)) }); T.screen = 'play'; T.run = T.saved;
      if (JSON.stringify(T.run.stats) !== JSON.stringify(R.stats)) out.push('completion: stats lost on save/load');
      const before = T.meta.shards, W2 = runReward(T.run, 'dead'), found = T.run.shards; endRun(T, 'dead'); endRun(T, 'dead');
      if (T.meta.shards - before !== W2.base + W2.bonus || T.result.shards !== found + W2.base + W2.bonus) out.push('completion: the end bonus was not paid exactly once');
      if (W2.bonus) out.push('completion: an end-of-run thoroughness bonus is still paid');
      // the last kill of a floor pays its 10 shards once, on the spot (TASKS 175)
      { const S2 = spawn(0, {}); begin(S2); for (let i = 0; i < 30; i++) step(S2, { keys: [] }); const R2 = S2.run;
        const live = R2.en.filter((o) => !o.summ && o.deadT < 0), s0 = R2.shards; live.forEach((o, i) => { hitEnemy(S2, R2, o, 1e9, false, o.x, o.y); if (i === live.length - 2 && R2.shards !== s0) out.push('completion: the floor paid before its last kill'); });
        if (R2.shards - s0 !== REWARD.full || !fstat(R2).full.kills) out.push(`completion: the last kill paid ${R2.shards - s0} shards, not ${REWARD.full}`);
        R2.en.push(Object.assign({}, live[0], { id: 9e6 + 1, deadT: -1, hp: 5 })); fstat(R2).foes++; hitEnemy(S2, R2, R2.en.at(-1), 1e9, false, 0, 0);
        if (R2.shards - s0 !== REWARD.full) out.push('completion: a floor paid its kills twice'); }
      // TASKS 1979: a reward that fell to the town's floor and is picked up later is no floor's loot to complete
      { const S3 = spawn(0, {}); startRun(S3, 'town'); const R3 = S3.run, f3 = fstat(R3), s0 = R3.shards, m0 = S3.meta.shards; f3.lootN = 1;
        const it = Object.assign(rollItem(R3, 1, 0, 'ring'), { id: R3.nextId++ }); root.SIMX.takeItem(S3, R3, { item: it, loot: 1, x: R3.hero.x, y: R3.hero.y });
        if (R3.shards !== s0 || S3.meta.shards !== m0) out.push('completion: a reward picked up in the town paid floor shards'); }
      const L2 = spawn(0, {}); L2.saved = JSON.parse(JSON.stringify(R)); delete L2.saved.stats; L2.run = L2.saved; L2.screen = 'play'; step(L2, { keys: [] });
      if (!L2.run.stats || L2.run.stats[2].foes !== L2.run.en.filter(counted).length) out.push('completion: an old save gets no stats for its floor'); }
    // doors: shut, a doored room stays unseen and its monsters can't see the hero through the door; E opens it; a locked one holds
    // against E and blows until its key is picked up, which opens it for good; a lever opens every door of its lock
    { for (const kind of ['key', 'lever']) { let S = null, R = null, L = null;
        for (let sd = 1; sd < 60 && !L; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play'; R = S.run;
          for (let f = 1; f <= 3 && !L; f++) { if (f > 1) enterFloor(S, R, f); L = R.map.locks.find((q) => q.kind === kind && R.map.doors.some((d) => d.lock === R.map.locks.indexOf(q))) || null; } }
        if (!L) { out.push(`doors: no ${kind} lock on floors 1–3 of 60 seeds`); continue; }
        const m = R.map, h = R.hero, li = m.locks.indexOf(L), d = m.doors.find((o) => o.lock === li), r = m.rooms[d.room], tag = `doors (${kind}, seed ${R.seed}, floor ${R.floor})`;
        const holder = R.en.find((q) => q.key === li), c = R.chests.find((q) => q.key === li); R.en = R.en.filter((o) => o.room === r.id); const e = R.en[0];
        const [cx, cy] = d.cells[0], dx = d.dir === 'l' ? -1 : d.dir === 'r' ? 1 : 0, dy = d.dir === 'u' ? -1 : d.dir === 'd' ? 1 : 0;
        h.x = (cx + dx + 0.5 + (dx ? 0 : 0.5)) * TILE; h.y = (cy + dy + 0.5 + (dy ? 0 : 0.5)) * TILE + 4; h.vx = h.vy = 0; R.seen.fill(0); R.rseen.fill(0);
        for (let i = 0; i < 6; i++) step(S, { px: 960, py: 540, keys: [] });
        if (R.rseen[r.id] || R.seen[(r.cy) * m.W + r.cx]) out.push(`${tag}: the room shows through its shut door`);
        if (e && e.st !== 'idle' && e.st !== 'home') out.push(`${tag}: a monster sees the hero through the door`);
        step(S, { px: 960, py: 540, keys: ['KeyE'] }); if (d.open) out.push(`${tag}: E opens a locked door`);
        const ax = d.x - h.x, ay = d.y - (h.y - 10); h.atkT = -9; h.cd.atk = 0; step(S, { px: 960 + ax, py: 540 + ay - 40, press: 1, keys: [] }); for (let i = 0; i < 40; i++) step(S, { px: 960 + ax, py: 540 + ay - 40, keys: [] });
        if (d.open) out.push(`${tag}: a blow opens a locked door`);
        if (kind === 'key') { if (c) { h.x = c.x; h.y = c.y + 40; openChest(S, R, c); } else if (holder) { R.en.push(holder); hitEnemy(S, R, holder, 1e9, false, holder.x, holder.y); } else out.push(`${tag}: no key holder`);
          const k = R.drops.find((p) => p.kind === 'key'); if (!k) out.push(`${tag}: its holder gives no key`);
          if (k) { k.x = h.x; k.y = h.y; k.t0 = -9; k.z = k.vz = 0; for (let i = 0; i < 4; i++) step(S, { px: 960, py: 540, keys: [] }); if (R.keys !== 1) out.push(`${tag}: the key is not picked up`); }
          h.x = (cx + dx + 0.5 + (dx ? 0 : 0.5)) * TILE; h.y = (cy + dy + 0.5 + (dy ? 0 : 0.5)) * TILE + 4; R.freeze = 0; step(S, { px: 960, py: 540, keys: ['KeyE'] });
          if (!d.open || R.keys !== 0 || cell(m, cx, cy) !== 1) out.push(`${tag}: the key does not open the door`);
          for (const o of m.doors) if (o.lock === li && o !== d && o.open) out.push(`${tag}: a key opens more than one door`); }
        else { h.x = L.lever.x; h.y = L.lever.y + 50; step(S, { px: 960, py: 540, keys: ['KeyE'] });
          if (!L.open || m.doors.some((o) => o.lock === li && !o.open)) out.push(`${tag}: the lever does not open its doors`); } }
      // an unlocked door: E from in front of it opens it and frees its cells
      // (the 1st floor's shaped rooms have no doors, TASKS 374: the first seed from 5 with a plain door there)
      { let S = null; for (let sd = 5; sd < 40 && !(S && S.run.map.doors.some((o) => !doorLock(S.run.map, o))); sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); }
        S.screen = 'play'; const R = S.run, m = R.map, h = R.hero, d = m.doors.find((o) => !doorLock(m, o));
        if (!d) out.push('doors: no plain door on the 1st floor of seeds 5–39'); else { const [cx, cy] = d.cells[0]; R.en = [];
          if (cell(m, cx, cy) !== 5 || losClear(m, d.x - 40 * (d.dir === 'l' ? -1 : d.dir === 'r' ? 1 : 0), d.y + 40 * (d.dir === 'u' ? 1 : d.dir === 'd' ? -1 : 0), d.x + 40 * (d.dir === 'l' ? -1 : d.dir === 'r' ? 1 : 0), d.y - 40 * (d.dir === 'u' ? 1 : d.dir === 'd' ? -1 : 0))) out.push('doors: a shut door is not solid or lets sight through');
          h.x = d.x; h.y = d.y + (d.dir === 'u' ? 40 : d.dir === 'd' ? -30 : 20); h.x += d.dir === 'l' ? 30 : d.dir === 'r' ? -30 : 0; step(S, { px: 960, py: 540, keys: ['KeyE'] });
          if (!d.open || cell(m, cx, cy) !== 1) out.push('doors: E does not open a door'); } } }
    // TASKS 1351: an open door's leaf keeps the cells it is drawn over (the hinge side's): nobody stands or walks behind it, the paths route round it,
    // and the other lane of the doorway still carries the hero through
    { const V = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }, seenDir = new Set(), bruteRan = new Set();
      for (let sd = 5; sd < 90 && seenDir.size < 4; sd++) for (let f = 1; f <= 4 && seenDir.size < 4; f++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play'; if (f > 1) enterFloor(S, S.run, f); const R = S.run, m = R.map, h = R.hero;
        for (const d of m.doors) { if (d.arena || doorLock(m, d) || seenDir.has(d.dir)) continue; seenDir.add(d.dir); const [vx, vy] = V[d.dir], tag = `doors: ${d.dir} door of seed ${sd} f${f}`; R.en = []; R.pots = []; R.chests = [];
          openDoor(S, R, d, 0); const leaf = SIMX.leafCells(d), centre = ([x, y]) => [(x + 0.5) * TILE, (y + 0.5) * TILE];
          if (!leaf.length || leaf.some(([x, y]) => !m.block.includes(y * m.W + x) || cell(m, x, y) !== 1)) out.push(`${tag}: its leaf's cells are not kept`);
          if (!leaf.every((c) => solids(R).some((o) => Math.hypot(o.x - centre(c)[0], o.y - centre(c)[1]) < 1))) out.push(`${tag}: its leaf is not solid`);
          for (const lane of [0, 1]) { const [cx, cy] = centre(d.cells[lane]), p0 = [cx - vx * 2.5 * TILE, cy - vy * 2.5 * TILE]; let inside = false;
            h.x = p0[0]; h.y = p0[1]; h.vx = h.vy = 0; if (boxHit(m, h.x, h.y, 10, false, false)) continue;
            for (let i = 0; i < 160; i++) { step(S, { left: vx < 0, right: vx > 0, up: vy < 0, down: vy > 0, px: 960, py: 540, keys: [] }); if (leaf.some((c) => Math.abs(h.x - centre(c)[0]) < 12 && Math.abs(h.y - centre(c)[1]) < 12)) inside = true; }
            const along = (h.x - d.x) * vx + (h.y - d.y) * vy;
            if (inside) out.push(`${tag}: the hero stands behind the leaf (lane ${lane})`);
            if (lane === 1 && along < 1.5 * TILE) out.push(`${tag}: the free lane does not carry the hero through (${along.toFixed(0)} px)`); }
          // TASKS 1783: the brute, the widest walker, follows the hero through it within 8 s
          { const [cx, cy] = centre(d.cells[1]), at = (k) => [cx + vx * k * TILE, cy + vy * k * TILE], [hx, hy] = at(3), [bx, by] = at(-4), E = ENEMIES.brute;
            if (!boxHit(m, hx, hy, 12, false, false) && !boxHit(m, bx, by, E.r, false, false)) { bruteRan.add(d.dir); h.x = hx; h.y = hy; h.vx = h.vy = 0; h.hp = 1e9;
              R.en = [{ id: R.nextId++, type: 'brute', x: bx, y: by, vx: 0, vy: 0, hp: 1e6, max: 1e6, dmg: 0, elite: 0, room: DG.roomAt(m, bx, by), st: 'chase', t0: S.t, face: 1, aimA: 0, cdT: S.t + 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: S.t, hx: bx, hy: by, ft: -9 }];
              const b = R.en[0], past = () => (b.x - d.x) * vx + (b.y - d.y) * vy >= TILE; for (let i = 0; i < 480 && !past(); i++) step(S, { px: 960, py: 540, keys: [] });
              if (!past()) out.push(`${tag}: the brute does not follow the hero through it`); } } } }
      for (const dir of ['u', 'd', 'l', 'r']) if (!seenDir.has(dir)) out.push(`doors: no plain ${dir} door on floors 1–4 of 85 seeds`);
      for (const dir of ['u', 'd']) if (!bruteRan.has(dir)) out.push(`doors: the brute was tried at no ${dir} door (no room for it and the hero by any)`); }
    // TASKS 1683: a side door opened by a hero standing in the corridor in its leaf's row does not shove him; the cell takes hold once he is off it
    { let got = 0; for (let sd = 5; sd < 90 && got < 2; sd++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero;
        const d = m.doors.find((o) => !o.arena && !doorLock(m, o) && (o.dir === 'l' || o.dir === 'r') && (got ? o.dir === 'r' : o.dir === 'l')); if (!d) continue; got++; R.en = []; R.pots = []; R.chests = [];
        const c = SIMX.leafCells(d)[1], vx = d.dir === 'l' ? -1 : 1; h.x = (c[0] + 0.5) * TILE; h.y = (c[1] + 0.5) * TILE; h.vx = h.vy = 0;
        if (boxHit(m, h.x, h.y, 10, false, false)) { got--; continue; } step(S, { px: 960, py: 540, keys: ['KeyE'] }); if (!d.open) { out.push(`doors: E from the corridor does not open the ${d.dir} door of seed ${sd}`); continue; }
        const x0 = h.x, y0 = h.y; for (let i = 0; i < 20; i++) step(S, { px: 960, py: 540, keys: [] });
        if (Math.hypot(h.x - x0, h.y - y0) > 3) out.push(`doors: opening the ${d.dir} door of seed ${sd} from the corridor shoves the hero ${Math.hypot(h.x - x0, h.y - y0).toFixed(0)} px`);
        for (let i = 0; i < 60; i++) step(S, { left: vx < 0, right: vx > 0, px: 960, py: 540, keys: [] });
        if (!m.block.includes(c[1] * m.W + c[0]) || (d.wait || []).length) out.push(`doors: the ${d.dir} door's leaf of seed ${sd} never takes its corridor cell once the hero is off it`); }
      if (got < 2) out.push('doors: no plain l and r doors to open from the corridor on seeds 5–89'); }
    // loot thrown out of a chest against a wall lands on the room's floor, never in the rock behind it (a potion out of the start
    // room's chest sailed over the wall)
    { let bad = 0; for (let sd = 1; sd <= 25 && !bad; sd++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play'; const R = S.run, m = R.map; R.en = [];
        for (const c of R.chests) if (c.sec === undefined) openChest(S, R, c); for (let i = 0; i < 240; i++) stepDrops(S, R, false);
        for (const p of R.drops) if (m.cells[Math.floor(p.y / TILE) * m.W + Math.floor(p.x / TILE)] !== 1) { bad++; out.push(`loot: seed ${sd} drops a ${p.kind} into the rock at ${Math.round(p.x)},${Math.round(p.y)}`); break; } } }
    // a dash is a leap over spikes: dashed across a plate with its spikes up, or ending on one, the hero takes nothing; walking
    // onto it he is hurt
    { let S = null, R = null, m = null, h = null, tr = null;
      for (let sd = 1; sd < 40 && !tr; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play'; R = S.run; m = R.map; h = R.hero; tr = m.traps.find((o) => !o.cor && [-90, -40, 40, 90].every((d) => cell(m, Math.floor((o.x + d) / TILE), Math.floor(o.y / TILE)) === 1) && !m.traps.some((q) => q !== o && Math.hypot(q.x - o.x, q.y - o.y) < 200)); }
      if (!tr) out.push('dash: no lone spike plate on floor 1 of 40 seeds'); else { R.en = []; const up = (dt = 0) => { tr.ph = ((1 - (S.t / 2.4) % 1) + 0.02 - dt / 2.4 + 1) % 1; };
        const go = (x0, keys, dt) => { h.x = x0; h.y = tr.y; h.vx = h.vy = 0; h.ifr = 0; h.spikeT = -9; h.cd.dash = 0; h.hp = 1e4; up(dt); step(S, { right: 1, px: 960, py: 540, keys }); for (let i = 0; i < 60; i++) step(S, { px: 960, py: 540, keys: [] }); return 1e4 - h.hp; };
        if (go(tr.x - 70, ['Space'])) out.push('dash: a dash across raised spikes hurts');
        if (go(tr.x - 86, ['Space'], 0.3)) out.push('dash: a dash that would come down on a plate is hurt by the spikes rising under it');
        if (!go(tr.x - 4, [])) out.push('dash: standing on raised spikes does not hurt'); } }
    // traps (TASKS 71): a web holds the hero to WEB.k of his pace until a blow tears it; fire burns it; an ambush's flagstone calls
    // P.n monsters round the hero in its room, once, hunting at once, outside the floor's count of foes
    // the web chosen has open floor and no other web for the free run to its left, or the free run measures a wall or a web
    { let S = null, R = null, w = null; const clear = (m, o) => [-200, -150, -100, -50, 0].every((d) => cell(m, Math.floor((o.x + d) / TILE), Math.floor(o.y / TILE)) === 1)
      && !m.webs.some((q) => q !== o && Math.abs(q.y - o.y) < 48 && q.x > o.x - 240 && q.x < o.x);
      for (let sd = 1; sd < 80 && !R; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); S.screen = 'play';
        for (let f = 1; f <= 4; f++) { if (f > 1) enterFloor(S, S.run, f); const m = S.run.map; w = m.webs.find((o) => clear(m, o)); if (w) { R = S.run; break; } } }
      if (!R) out.push('traps: no floor of 80 seeds with webs'); else { const m = R.map, h = R.hero; R.en = [];
        const run = (x, y) => { h.x = x; h.y = y; h.vx = h.vy = 0; const x0 = h.x; for (let i = 0; i < 60; i++) step(S, { right: 1, px: 960, py: 540, keys: [] }); return h.x - x0; };
        const free = run(w.x - 200, w.y), held = run(w.x - 12, w.y); if (!(held < free * 0.6)) out.push(`traps: a web does not hold the hero (${held.toFixed(0)} px against ${free.toFixed(0)})`);
        // (aimed through the camera: on a small map, TASKS 373, it stops at the map's edge and the hero is off the screen's middle)
        const aim = () => toPx(R, h.x + 60, h.y - 30);
        h.x = w.x - 40; h.y = w.y + 8; h.atkT = -9; h.cd.atk = 0; step(S, { ...aim(), press: 1, keys: [] }); for (let i = 0; i < 40; i++) step(S, { ...aim(), keys: [] });
        if (!w.torn) out.push('traps: a blow does not tear a web');
        const w2 = m.webs.find((o) => !o.torn); if (w2) { tearWebs(S, R, w2.x, w2.y, 30, undefined, undefined, 1); if (!w2.torn || !S.ev.some((e) => e.k === 'webburn')) out.push('traps: fire does not burn a web'); }
        // (TASKS 1706) a player's arrow, a shot or one of a volley's, tears the webs across its flight and flies on at its own speed with its damage
        { const cy = (Math.floor(w.y / TILE) + 0.5) * TILE, mk = (x) => { const q = { ...w, x, y: cy, torn: 0 }; delete q.tornT; m.webs.push(q); return q; }, webs = [mk(w.x - 160), mk(w.x - 110), mk(w.x - 60)], sh = (a, y) => ({ id: R.nextId++, k: 'arrow', single: 1, own: 'hero', x: w.x - 200, y: y - 20, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, t0: S.t, life: 0.6, r: 6, kb: 0.4, dmg: 7, gz: 20, pierce: 0 });
          for (const [name, arrows] of [['a shot', [sh(0, cy)]], ['a volley', [sh(0, cy - 4), sh(0, cy), sh(0, cy + 4)]]]) { for (const q of webs) { q.torn = 0; delete q.tornT; } R.en = []; R.proj = arrows; const x0 = arrows.map((p) => p.x); S.ev = [];
            for (let i = 0; i < 30; i++) step(S, { keys: [] });
            if (webs.some((q) => !q.torn) || S.ev.filter((e) => e.k === 'webtear').length !== 3) out.push(`traps: ${name} does not tear every web across its flight`);
            if (arrows.some((p, k) => p.dead || p.dmg !== 7 || Math.abs(Math.hypot(p.vx, p.vy) - 760) > 1e-6 || Math.abs(p.x - x0[k] - p.vx * 30 / 120) > 0.01)) out.push(`traps: ${name} is held or slowed by a web`); } }
      } }
    {
      const S = spawn(0, {}); S.run = newRun(S, 'cave', 26837); S.screen = 'play'; const R = S.run, m = R.map;
      if (m.ambush.length) out.push('ambush: generated pressure plate');
      const room = m.rooms.filter((r) => r.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0];
      if (!room) out.push('ambush: no room to spring it in'); else {
        R.hero.x = (room.cx + 0.5) * TILE; R.hero.y = (room.cy + 0.5) * TILE;
        const before = R.en.length; S.ev = []; const P = { room: room.id, n: 4 };
        const ok = springAmbush(S, R, P), got = R.en.slice(before);
        if (ok ? got.length !== 4 || got.some((e) => e.elite || e.room !== room.id) : got.length || S.ev.some((e) => e.k === 'ambush')) out.push('ambush: partial or elite group / false announcement');
        springAmbush(S, R, P); if (R.en.length !== before + got.length) out.push('ambush: group repeats');
        const c = R.chests[0]; S.ev = []; const n = R.en.length; c.open = 0; openChest(S, R, c); openChest(S, R, c);
        if (S.ev.filter((e) => e.k === 'chest').length !== 1) out.push('ambush: chest opens twice');
        const T = spawn(0, JSON.parse(JSON.stringify(persist(S)))); if (T.saved && !T.saved.chests.find((q) => q.x === c.x && q.y === c.y).ambushRolled) out.push('ambush: roll lost on save');
        const small = { room: room.id, n: 4 }; R.hero.x = m.spawn.x; R.hero.y = m.spawn.y; S.ev = []; const count = R.en.length;
        if (springAmbush(S, R, small) || R.en.length !== count || S.ev.some((e) => e.k === 'ambush')) out.push('ambush: spawns with hero outside room');
      }
    }
    // the cave's monsters (TASKS 307, 308): the run places drowned in the shallows and slimes; a drowned lies still until the hero
    // comes within its sense, rises and only then hunts; its grab draws the hero a step in; a slime's hop lands against the hero and
    // hurts him; a slime splits in two small ones that carry nothing and stay out of the floor's count, the small ones never split,
    // and a puddle is left that slows the hero
    { const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); S.screen = 'play'; const R = S.run, h = R.hero, quiet = { px: 960, py: 540, keys: [] };
      let nDr = 0, nSl = 0; for (let f = 1; f <= 3; f++) { enterFloor(S, R, f); nDr += R.en.filter((e) => e.type === 'drowned').length; nSl += R.en.filter((e) => e.type === 'slime').length; }
      if (!nDr || !nSl) out.push(`cave monsters: ${nDr} drowned and ${nSl} slimes on floors 1-3 of seed 3`);
      let m, sol, wet, spot = null; for (let fl = 1; fl <= 4 && !spot; fl++) { enterFloor(S, R, fl); m = R.map; sol = solids(R); wet = new Set(m.water);
      const open = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -6; i <= 6; i++) { const k = (y + j) * m.W + x + i; if (m.cells[k] !== 1 || wet.has(k)) return false; }
        return !sol.some((o) => Math.abs(o.x - (x + 0.5) * TILE) < 7 * TILE && Math.abs(o.y - (y + 0.5) * TILE) < 2 * TILE); };
      for (let k = 0; k < m.W * m.H && !spot; k++) if (open(k % m.W, Math.floor(k / m.W))) spot = [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]; }
      const mob = (type, x, y, o) => { const E = ENEMIES[type]; const e = Object.assign({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp: E.hp, max: E.hp, dmg: 5, elite: 0, room: -1, st: 'chase', t0: S.t, face: -1, aimA: Math.PI,
        cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, hx: x, hy: y, seenT: S.t, ft: -9 }, o); R.en.push(e); return e; };
      if (!spot) out.push('cave monsters: no open dry floor on floor 1 of seed 3'); else { const [x0, y0] = spot, E = ENEMIES.drowned, reset = () => { R.en = []; h.x = x0; h.y = y0; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0; h.pull = null; h.dashT = -9; };
        reset(); const d = mob('drowned', x0 + E.sense + 40, y0, { st: 'lurk', t0: -9 }); for (let i = 0; i < 120; i++) step(S, quiet);
        if (d.st !== 'lurk' || Math.hypot(d.x - x0 - E.sense - 40, d.y - y0) > 0.01) out.push(`cave monsters: a lurking drowned stirs with the hero out of its sense (${d.st})`);
        h.x = d.x - E.sense + 20; step(S, quiet); if (d.st !== 'rise') out.push('cave monsters: a drowned does not rise for a hero within its sense');
        const t0 = S.t; while (d.st === 'rise' && S.t - t0 < 3) step(S, quiet); if (d.st === 'rise' || Math.abs(S.t - t0 - E.rise) > 0.05) out.push(`cave monsters: a drowned rises in ${(S.t - t0).toFixed(2)} s, not ${E.rise}`);
        // the grab: from out of the blow's reach, nothing in hand; the hero must end a step nearer, and never inside it
        reset(); const g = mob('drowned', x0 + E.r + K.R + 90, y0, { cdT: 0, grabT: 0 }); let pulled = 0;
        for (let i = 0; i < 240 && !pulled; i++) { const hx = h.x; step(S, quiet); h.hp = 1e4; if (S.ev.some((e) => e.k === 'grabbed' && e.id === g.id && e.t === S.t)) pulled = 1; else if (h.x - hx > 0.01 && !h.pull) h.x = hx; }
        if (!pulled) out.push('cave monsters: a drowned never grabs a hero within its reach'); else { const hx = h.x; for (let i = 0; i < 40; i++) step(S, quiet);
          if (h.x - hx < E.grab.pull * 0.6) out.push(`cave monsters: a grab draws the hero only ${(h.x - hx).toFixed(1)} px`); if (g.x - h.x < E.r + K.R) out.push('cave monsters: a grab draws the hero into the drowned'); }
        // the hop
        reset(); const sl = mob('slime', x0 + 90, y0, { cdT: 0 }); let landed = 0; for (let i = 0; i < 240 && !landed; i++) { step(S, quiet); if (S.ev.some((e) => e.k === 'land' && e.id === sl.id && e.t === S.t)) landed = 1; }
        if (!landed || h.hp >= 1e4 && !S.ev.some((e) => e.k === 'dodge')) out.push(`cave monsters: a slime's hop ${landed ? 'lands without a blow' : 'never lands'}`);
        if (landed && Math.hypot(sl.x - h.x, sl.y - h.y) > ENEMIES.slime.r + K.R + 10) out.push('cave monsters: a slime lands away from the hero');
        // the split, the puddle and the small ones
        reset(); const f0 = fstat(R).foes, k0 = fstat(R).kills, big = mob('slime', x0 + 120, y0, { cdT: 99 }); m.goo = []; const drops0 = R.drops.length; hitEnemy(S, R, big, 1e9, false, x0, y0);
        const small = R.en.filter((e) => e.type === 'slime_s'); if (small.length !== 2 || small.some((e) => e.summ !== big.id || e.st !== 'chase')) out.push(`cave monsters: a slime splits in ${small.length} small ones`);
        if (m.goo.length !== 1) out.push('cave monsters: a slime leaves no puddle'); if (fstat(R).foes !== f0 || fstat(R).kills !== k0 + 1) out.push('cave monsters: the small slimes count toward the floor');
        const dr = R.drops.length; for (const e of small) hitEnemy(S, R, e, 1e9, false, x0, y0);
        if (R.en.filter((e) => e.type === 'slime_s').length !== 2 || R.drops.length !== dr) out.push('cave monsters: a small slime splits again or drops loot');
        if (drops0 > dr) out.push('cave monsters: drops vanish');
        // the puddle slows the hero: his run across it against the same run on dry floor
        const run = (x) => { R.en = []; R.freeze = 0; h.x = x; h.y = y0; h.vx = h.vy = 0; const x1 = h.x; for (let i = 0; i < 24; i++) step(S, { right: 1, px: 960, py: 540, keys: [] }); return h.x - x1; };
        m.goo = []; const dry = run(x0 - 5 * TILE); m.goo = [{ id: 1, x: x0, y: y0, t0: S.t, T: 60, r: 60, rNow: 60 }]; const held = run(x0 - 50);
        if (!(held < dry * 0.75)) out.push(`cave monsters: a puddle does not slow the hero (${held.toFixed(0)} px against ${dry.toFixed(0)})`); } }
    // the caves' packs (TASKS 312): each floor brings its own kinds (data.js BIOMES.cave.from); in a hall with a crab and archers the
    // crab stands nearer the way the hero comes in; eels come up in the lakes between the halls too.
    { const S = spawn(0, {}), seen = [null, new Set(), new Set(), new Set(), new Set()]; let lakes = 0, lines = 0;
      for (const sd of [3, 5, 8]) { S.run = newRun(S, 'cave', sd); const R = S.run;
        for (let f = 1; f <= 4; f++) { enterFloor(S, R, f); const m = R.map; for (const e of R.en) seen[f].add(e.type); lakes += R.en.filter((e) => e.type === 'eel' && e.room < 0).length;
          const st = m.rooms[m.start], W = m.W, F = new Int32Array(W * m.H).fill(-1), q = [st.cy * W + st.cx], fv = (e) => F[Math.floor(e.y / TILE) * W + Math.floor(e.x / TILE)]; F[q[0]] = 0;
          for (let i = 0; i < q.length; i++) for (const d of [1, -1, W, -W]) { const n = q[i] + d; if (F[n] < 0 && m.cells[n] === 1) { F[n] = F[q[i]] + 1; q.push(n); } }
          for (const r of m.rooms) { const cr = R.en.filter((e) => e.room === r.id && e.type === 'crab'), ar = R.en.filter((e) => e.room === r.id && e.type === 'skel_archer'); if (!cr.length || !ar.length) continue; lines++;
            if (Math.min(...cr.map(fv)) > Math.min(...ar.map(fv))) out.push(`cave packs: seed ${sd} f${f} room ${r.id}: the archers stand nearer the way in than the crab`); } } }
      const D0 = D.BIOMES.cave.from;
      for (let f = 1; f <= 4; f++) for (const t of D.BIOMES.cave.roster) { const due = (D0[t] || 1) <= f; if (!due && seen[f].has(t)) out.push(`cave packs: a ${t} on floor ${f}, before its floor ${D0[t]}`); }
      for (const t of ['crab', 'skel_archer']) if (!seen[2].has(t)) out.push(`cave packs: no ${t} on floor 2`);
      for (const t of ['eel', 'skel_mage']) if (!seen[3].has(t)) out.push(`cave packs: no ${t} on floor 3`);
      if (!lakes) out.push('cave packs: no eel in a lake between halls on floors 3-4 of seeds 3, 5, 8'); if (!lines) out.push('cave packs: no hall with a crab before archers');
    }
    // the skeleton archer and mage (TASKS 311): the archer backs off from a hero who comes close; its aim follows him until the lock
    // and then holds; the arrow flies straight down it and hits a hero who stood still, not one who stepped aside after the lock.
    // The mage's ball flies at orb.spd and slows the hero it soaks; with a monster between it and the hero it keeps behind that one
    { const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); S.screen = 'play'; const R = S.run, h = R.hero, quiet = { px: 960, py: 540, keys: [] }; let m, sol, wet, spot = null; for (let fl = 1; fl <= 4 && !spot; fl++) { enterFloor(S, R, fl); m = R.map; sol = solids(R); wet = new Set(m.water);
      const open = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -6; i <= 6; i++) { const k = (y + j) * m.W + x + i; if (m.cells[k] !== 1 || wet.has(k)) return false; }
        return !sol.some((o) => Math.abs(o.x - (x + 0.5) * TILE) < 7 * TILE && Math.abs(o.y - (y + 0.5) * TILE) < 2 * TILE); };
      for (let k = 0; k < m.W * m.H && !spot; k++) if (open(k % m.W, Math.floor(k / m.W))) spot = [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]; }
      const mob = (type, x, y, o) => { const E = ENEMIES[type]; const e = Object.assign({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp: 1e4, max: 1e4, dmg: 5, elite: 0, room: -1, st: 'chase', t0: S.t, face: -1, aimA: Math.PI,
        cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, hx: x, hy: y, seenT: S.t, ft: -9 }, o); R.en.push(e); return e; };
      if (!spot) out.push('skeleton archer: no open dry floor on floor 1 of seed 3'); else { const [x0, y0] = spot, A = ENEMIES.skel_archer, O = ENEMIES.skel_mage.orb;
        const reset = () => { R.en = []; R.proj = []; m.decor = m.decor.filter((d) => Math.hypot(d.x - x0, d.y - y0) > 9 * TILE); h.x = x0 - 4 * TILE; h.y = y0; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0; h.slowT = -9; h.dashT = -9; S.ev = []; };
        const hits = () => S.ev.filter((q) => (q.k === 'hurt' && / bolt$/.test(q.src)) || q.k === 'dodge').length;
        reset(); const b = mob('skel_archer', h.x + 110, y0, { cdT: 99 }), d0 = Math.hypot(b.x - h.x, b.y - h.y); for (let i = 0; i < 120; i++) step(S, quiet);
        if (!(Math.hypot(b.x - h.x, b.y - h.y) > d0 + 20)) out.push(`skeleton archer: it does not back off from a hero at ${Math.round(d0)} px`);
        for (const side of [0, 1]) { reset(); const a = mob('skel_archer', x0 + 4 * TILE, y0); let n = 0; while (a.st !== 'wind' && n++ < 10) step(S, quiet);
          if (a.st !== 'wind') { out.push('skeleton archer: it does not draw at a hero in sight and reach'); break; }
          const w = D.windOf(a, A.wind); h.y = y0 - 16; while (S.t - a.t0 < w - A.arrow.lock - 0.05) step(S, quiet);
          const a1 = a.aimA, want = Math.atan2(h.y - 38 - (a.y - ARROW_Y), h.x - a.x); if (Math.abs(angDiff(a1, want)) > 0.02) out.push('skeleton archer: its aim does not follow the hero before the lock');
          while (S.t - a.t0 < w - A.arrow.lock + 0.03) step(S, quiet); const lk = a.aimA; if (side) h.y += 40; step(S, quiet);
          if (Math.abs(a.aimA - lk) > 1e-9 && a.st === 'wind') out.push('skeleton archer: its aim moves after the lock');
          while (a.st === 'wind') step(S, quiet); const p = R.proj.find((q) => q.k === 'arrow'); if (!p) { out.push('skeleton archer: no arrow on the loose'); break; }
          const v0 = [p.vx, p.vy]; for (let i = 0; i < 90 && !p.dead; i++) { step(S, quiet); if (p.vx !== v0[0] || p.vy !== v0[1]) { out.push('skeleton archer: the arrow turns in flight'); break; } }
          if (Math.abs(Math.atan2(v0[1], v0[0]) - lk) > 1e-9) out.push('skeleton archer: the arrow leaves off its aim line');
          if (!side && !hits()) out.push('skeleton archer: the arrow misses a hero who stood still'); if (side && hits()) out.push('skeleton archer: the arrow hits a hero who stepped aside after the lock'); }
        reset(); const g = mob('skel_mage', x0 + 4 * TILE, y0); let n = 0; while (!R.proj.some((q) => q.k === 'orb') && n++ < 400) step(S, quiet);
        const o = R.proj.find((q) => q.k === 'orb'); if (!o) out.push('skeleton mage: no ball of water thrown'); else { if (Math.abs(Math.hypot(o.vx, o.vy) - O.spd) > 1e-6) out.push('skeleton mage: the ball does not fly at orb.spd');
          n = 0; while (!o.dead && n++ < 600) step(S, quiet); if (!(h.slowT > S.t) && !S.ev.some((q) => q.k === 'dodge')) out.push('skeleton mage: the ball does not soak the hero it hits');
          const run = (slow) => { R.en = []; R.proj = []; R.freeze = 0; h.x = x0 - 4 * TILE; h.y = y0; h.vx = h.vy = 0; h.slowT = slow ? S.t + 9 : -9; const x1 = h.x; for (let i = 0; i < 24; i++) step(S, { right: 1, px: 960, py: 540, keys: [] }); return h.x - x1; };
          const dry = run(0), wetR = run(1); if (!(wetR < dry * (O.slow + 0.1))) out.push(`skeleton mage: a soaked hero is not slowed (${wetR.toFixed(0)} px against ${dry.toFixed(0)})`); }
        reset(); const c = mob('skeleton', x0 - 1 * TILE, y0, { cdT: 99 }), q = mob('skel_mage', x0 + 4 * TILE, y0 + 16, { cdT: 99 });
        for (let i = 0; i < 240; i++) { step(S, quiet); c.x = x0 - TILE; c.y = y0; c.st = 'chase'; }
        if (!(q.x > c.x + ENEMIES.skel_mage.behind * 0.6 && Math.abs(q.y - c.y) < 40)) out.push(`skeleton mage: it does not keep behind the skeleton (at ${Math.round(q.x - c.x)}, ${Math.round(q.y - c.y)} from it)`); } }
    // the crab (TASKS 309): a blow, a bolt or a blast from its front does armor.k of its damage, from its side or back all of it; it
    // turns no faster than its turn rate; it pinches a hero before it and never one behind it; a hero at its side is run down
    // sideways, the shell still facing its way
    { const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); S.screen = 'play'; const R = S.run, h = R.hero, quiet = { px: 960, py: 540, keys: [] }, E = ENEMIES.crab;
      let n = 0; for (let f = 1; f <= 4; f++) { enterFloor(S, R, f); n += R.en.filter((e) => e.type === 'crab').length; } if (!n) out.push('crab: none on floors 1-4 of seed 3');
      let m, wet, sol, spot = null; for (let f = 1; f <= 4 && !spot; f++) { R.seed = 8; enterFloor(S, R, 1 + (f - 1) % 4); m = R.map; wet = new Set(m.water); sol = solids(R);
      const open = (x, y) => { for (let j = -1; j <= 4; j++) for (let i = -5; i <= 5; i++) { const k = (y + j) * m.W + x + i; if (m.cells[k] !== 1 || wet.has(k)) return false; }
        return !sol.some((o) => Math.abs(o.x - (x + 0.5) * TILE) < 6 * TILE && o.y - (y + 0.5) * TILE > -2 * TILE && o.y - (y + 0.5) * TILE < 5 * TILE); };
      for (let k = 0; k < m.W * m.H && !spot; k++) if (open(k % m.W, Math.floor(k / m.W))) spot = [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE]; }
      if (!spot) out.push('crab: no open dry floor on floors 1-4 of seed 3'); else { const [x0, y0] = spot;
        const crab = (o) => { R.en = []; R.proj = []; h.x = x0 - 140; h.y = y0; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0; h.dashT = -9; h.pull = null;
          const e = Object.assign({ id: R.nextId++, type: 'crab', x: x0, y: y0, vx: 0, vy: 0, hp: 1e4, max: 1e4, dmg: 5, elite: 0, room: -1, st: 'chase', t0: S.t, face: 1, fa: 0, aimA: 0,
            cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, hx: x0, hy: y0, seenT: S.t, ft: -9 }, o); R.en.push(e); return e; };
        for (const [nm, a, k] of [['front', 0, E.armor.k], ['front-side', E.armor.arc - 0.1, E.armor.k], ['side', Math.PI / 2, 1], ['back', Math.PI, 1]]) {
          const e = crab({}); hitEnemy(S, R, e, 100, false, x0 + Math.cos(a) * 40, y0 + Math.sin(a) * 40);
          if (Math.abs(1e4 - e.hp - 100 * k) > 1) out.push(`crab: a blow from its ${nm} does ${1e4 - e.hp}, not ${100 * k}`); }
        { const e = crab({ elite: 1 }); hitEnemy(S, R, e, 100, false, x0 + 40, y0); if (Math.abs(1e4 - e.hp - 100 * E.armor.elite) > 1) out.push(`crab: an elite's shell lets ${1e4 - e.hp} of 100 through, not ${100 * E.armor.elite}`); }
        if (D.modPool('campaign', 10, 'crab').includes('vampire') || D.eliteK({ elite: 1, type: 'crab' }, 'hp') !== D.ELITE.crab.hp) out.push('crab: an elite one drinks blood or takes the full elite health');
        for (const [nm, a, k] of [['front', 0, E.armor.k], ['back', Math.PI, 1]]) { const e = crab({ cdT: 99 }), v = 400;
          R.proj.push({ id: R.nextId++, k: 'fire', x: x0 + Math.cos(a) * 140, y: y0 - 20, vx: -Math.cos(a) * v, vy: 0, t0: S.t, life: 2, dmg: 100, own: 'hero', r: 6 });
          for (let i = 0; i < 120 && R.proj.length; i++) { step(S, quiet); h.hp = 1e4; }
          if (Math.abs(1e4 - e.hp - 100 * k) > 1) out.push(`crab: a bolt from its ${nm} does ${1e4 - e.hp}, not ${100 * k}`); }
        // the turn: the hero behind it, half a second
        { const e = crab({ cdT: 99, rushT: 99 }); h.x = x0 - 120; for (let i = 0; i < 60; i++) step(S, quiet); const turned = Math.abs(e.fa);
          if (!(turned > 0.2 && turned <= E.turn * 0.5 + 0.02)) out.push(`crab: turns ${turned.toFixed(2)} rad in 0.5 s, not up to ${E.turn * 0.5}`); }
        // the pinch: a hero before it is hurt; one behind it is not, for the second it takes to turn even half way
        // (no dodge: the run's stream decides one, and TASKS 362 moved it so the first pinch was dodged; held at no chance, the check
        // reads the hurt itself on any seed, TASKS 2027)
        { const e = crab({}), agi = h.base.agi, eq = Object.assign({}, h.eq); h.base.agi = 0; for (const k in h.eq) h.eq[k] = null; h.x = x0 + E.r + K.R + 14; let hurt = 0;
          if (heroSt(S).dodge > 0) out.push(`crab: the pinch check's hero still dodges ${heroSt(S).dodge} %`);
          for (let i = 0; i < 240 && !hurt; i++) { step(S, quiet); if (S.ev.some((v) => v.k === 'hurt' && v.t === S.t)) hurt = 1; h.hp = 1e4; h.x = x0 + E.r + K.R + 14; h.y = y0; }
          h.base.agi = agi; Object.assign(h.eq, eq); if (!hurt || !S.ev.some((v) => v.k === 'pinch' && v.id === e.id)) out.push('crab: never pinches a hero before it'); }
        { const e = crab({ rushT: 99 }); h.x = x0 - E.r - K.R - 14; let hurt = 0; for (let i = 0; i < 120; i++) { step(S, quiet); if (S.ev.some((v) => v.k === 'hurt' && v.t === S.t)) hurt = 1; h.hp = 1e4; h.x = x0 - E.r - K.R - 14; h.y = y0; e.x = x0; e.y = y0; }
          if (hurt) out.push('crab: pinches a hero behind it'); }
        // the rush: a hero 100 px off its side; it runs at him and hurts him, still facing its way
        // (no dodge: a dodged blow, a roll of the run's stream, would read as no rush at all)
        { const e = crab({ rushT: 0 }); h.base.agi = 0; for (const k in h.eq) h.eq[k] = null; h.x = x0; h.y = y0 + 100; let hurt = 0; for (let i = 0; i < 240 && !hurt; i++) { step(S, quiet); if (S.ev.some((v) => v.k === 'hurt' && v.t === S.t)) hurt = 1; h.hp = 1e4; if (!hurt) { h.x = x0; h.y = y0 + 100; } }
          if (!hurt || !S.ev.some((v) => v.k === 'rush' && v.id === e.id)) out.push('crab: never rushes a hero at its side');
          if (Math.abs(angDiff(e.fa, 0)) > 0.6) out.push(`crab: the rush turned its shell to ${e.fa.toFixed(2)}`);
          if (e.y - y0 < 40) out.push(`crab: the rush carries it only ${(e.y - y0).toFixed(0)} px sideways`); } } }
    // the eel (TASKS 310): it lies in deep water on the cave's floors and is no part of their count; under the water no blow touches it
    // and bolts fly over it; with the hero on its shore it shows where it will come up, comes up there in deep water by him, bites
    // him there and spits at him farther off, is hurt only while up, dives within its stay and comes up again `apart` cells away
    { const S = spawn(0, {}), quiet = { px: 960, py: 540, keys: [] }, E = ENEMIES.eel; let R, h, n = 0, spot = null;
      for (let sd = 1; sd <= 6 && !spot; sd++) { S.run = newRun(S, 'cave', sd); S.screen = 'play'; R = S.run; h = R.hero;
      for (let f = 1; f <= 4; f++) { enterFloor(S, R, f); const eels = R.en.filter((e) => e.type === 'eel'); n += eels.length;
        if (R.stats[f].foes !== R.en.filter((e) => !e.summ && e.type !== 'eel').length) out.push(`eel: floor ${f} counts its eels among its foes`);
        if (eels.some((e) => e.st !== 'deep' || R.map.cells[Math.floor(e.y / TILE) * R.map.W + Math.floor(e.x / TILE)] !== 6)) out.push(`eel: floor ${f} has an eel out of its deep water`);
        // a shore: the shallows by a deep water of an eel's body
        if (!spot) for (const e of eels) { const m = R.map, body = new Set(deepBody(m, e)); if (body.size < 12) continue;
          for (const k of body) { const s0 = [k - m.W, k + m.W, k - 1, k + 1].find((j) => m.cells[j] === 1);
            if (s0 !== undefined) { spot = { f, id: e.id, x: (s0 % m.W + 0.5) * TILE, y: (Math.floor(s0 / m.W) + 0.5) * TILE }; break; } } if (spot) break; } } }
      if (!n) out.push('eel: none on floors 1-4 of seeds 1-6'); if (!spot) out.push('eel: no shore by a deep water of 12 cells on floors 1-4 of seeds 1-6');
      else { enterFloor(S, R, spot.f); const m = R.map, e = R.en.find((o) => o.type === 'eel'), body = new Set(deepBody(m, e)), cellOf = (o) => Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE);
        R.en = [e]; Object.assign(e, { hp: 1e4, max: 1e4, dmg: 5, st: 'deep', cdT: 99 }); const reset = (x, y) => { h.x = x; h.y = y; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0; h.dashT = -9; R.proj = []; };
        // under: a blow and a bolt do nothing; the bolt flies on over the water
        reset(e.x - 200, e.y); hitEnemy(S, R, e, 100, false, e.x - 20, e.y); if (e.hp !== 1e4) out.push('eel: a blow hurts it under the water');
        R.proj.push({ id: R.nextId++, k: 'fire', x: e.x - 30, y: e.y - E.h * 0.45, vx: 400, vy: 0, t0: S.t, life: 2, dmg: 100, own: 'hero', r: 6 });
        step(S, { px: 960, py: 540, keys: [] }); for (let i = 0; i < 12; i++) step(S, quiet); if (e.hp !== 1e4) out.push('eel: a bolt hurts it under the water');
        // the hunt, 20 s with the hero on its shore: stir → rise → up, in its own deep water each time, a fresh spot each time up
        reset(spot.x, spot.y); Object.assign(e, { st: 'deep', cdT: 0 }); const seen = [], ups = []; let hurt = 0, jet = 0, off = 0, stirT = -1, hitUp = 0, last = e.st;
        for (let i = 0; i < 120 * 20; i++) { step(S, quiet); h.x = spot.x; h.y = spot.y; h.vx = h.vy = 0; h.hp = 1e4; h.ifr = 0;
          if (S.ev.some((v) => v.k === 'hurt' && v.t === S.t)) hurt++; if (R.proj.some((p) => p.k === 'jet')) jet = 1;
          if (e.st !== last) { seen.push(e.st); if (e.st === 'stir') stirT = S.t; if (e.st === 'rise') { if (Math.abs(S.t - stirT - E.warn) > 0.02) out.push(`eel: comes up ${(S.t - stirT).toFixed(2)} s after it stirs, not ${E.warn}`); ups.push([e.x, e.y]); } last = e.st; }
          if (!body.has(cellOf(e))) off = 1;
          if (e.st === 'chase' && !hitUp) { const hp = e.hp; hitEnemy(S, R, e, 10, false, h.x, h.y); hitUp = hp - e.hp; } }
        if (off) out.push('eel: leaves its deep water'); if (ups.length < 3) out.push(`eel: comes up only ${ups.length} times in 20 s by the hero`);
        for (const st of ['stir', 'rise', 'chase', 'wind', 'strike', 'dive', 'deep']) if (!seen.includes(st)) out.push(`eel: never goes ${st} in 20 s by the hero`);
        for (let i = 1; i < ups.length; i++) if (Math.hypot(ups[i][0] - ups[i - 1][0], ups[i][1] - ups[i - 1][1]) < E.apart * TILE - 0.01) out.push(`eel: comes up ${(Math.hypot(ups[i][0] - ups[i - 1][0], ups[i][1] - ups[i - 1][1]) / TILE).toFixed(1)} cells from its last spot`);
        if (!hurt) out.push('eel: never hurts a hero on its shore'); if (hitUp !== 10) out.push(`eel: a blow while it is up does ${hitUp}, not 10`);
        // the jet: a hero on the shore out of its bite (spit) — it shows up in the hunt from a spot farther off, or from a fresh one here
        if (!jet) { const cc = (k) => [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE], sees = ([sx0, sy0]) => [...body].map(cc).some(([x, y]) => { const d = Math.hypot(x - sx0, y - sy0); return d > E.r + K.R + E.reach + 20 && d < E.spit.reach - 40 && losClear(m, x, y - 30, sx0, sy0 - 30); }), alt = [...body].flatMap((k) => [k - m.W, k + m.W, k - 1, k + 1].filter((j) => m.cells[j] === 1)).map(cc).find(sees); if (alt) { spot.x = alt[0]; spot.y = alt[1]; } }
        if (!jet) { reset(spot.x, spot.y); Object.assign(e, { st: 'chase', t0: S.t, upT: S.t, cdT: 0, bit: 0 }); const far = [...body].map((k) => [(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE])
            .find(([x, y]) => Math.hypot(x - h.x, y - h.y) > E.r + K.R + E.reach + 20 && Math.hypot(x - h.x, y - h.y) < E.spit.reach - 40 && losClear(m, x, y - 30, h.x, h.y - 30));
          if (far) { e.x = far[0]; e.y = far[1]; for (let i = 0; i < 240 && !jet; i++) { step(S, quiet); h.x = spot.x; h.y = spot.y; if (R.proj.some((p) => p.k === 'jet')) jet = 1; } } }
        if (!jet) out.push('eel: never spits at a hero out of its bite');
        // up for no longer than its stay, then under: a blow does nothing again
        Object.assign(e, { st: 'chase', t0: S.t, upT: S.t, cdT: 99, bit: 0 }); let t1 = -1; for (let i = 0; i < 120 * 4 && t1 < 0; i++) { step(S, quiet); if (e.st === 'dive') t1 = S.t; }
        if (t1 < 0 || t1 - e.upT > E.stay + 0.02) out.push(`eel: stays up ${(t1 - e.upT).toFixed(2)} s, not up to ${E.stay}`);
        for (let i = 0; i < 120 * E.dive + 2; i++) step(S, quiet); const hp = e.hp; hitEnemy(S, R, e, 10, false, h.x, h.y); if (e.st !== 'deep' || e.hp !== hp) out.push(`eel: a blow after its dive does ${hp - e.hp} (${e.st})`); } }
    // altars: E offers one gift per tier at rising prices; too few shards refuse and take nothing; a gift takes its price, lands
    // on the hero, heals, closes the screen and darkens the altar for good, and survives save/load
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero; enterFloor(S, R, 2); R.en = []; h.bag[0] = { b: 'scroll', n: 2 }; S.screen = 'inv'; const b = UI.inv().r.find((q) => q.id === 'bag:0'), inp = { px: b.x + 5, py: b.y + 5, press: 1, keys: [] }, n0 = h.atkN;
      step(S, Object.assign({ click: 1 }, inp)); step(S, Object.assign({}, inp, { press: 0 })); if (!h.read) out.push('scroll: a click in the bag does not start reading'); for (let i = 0; i < 10; i++) step(S, Object.assign({}, inp, { press: 0 })); if (h.atkN !== n0) out.push('scroll: the click that reads it also swings the weapon'); if (!h.read) out.push('scroll: the click breaks the reading'); }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero;
      for (let f = 1; !R.shrines.length && f < D.RUNS.campaign.chapter; ) enterFloor(S, R, ++f);
      if (!R.shrines.length) out.push('altar: no altar on any floor of seed 777');
      else { const sh = R.shrines[0], tier = (o) => D.GIFTS.find((q) => q.id === o.id).tier; R.en = []; h.x = sh.x; h.y = sh.y + 40; step(S, { keys: ['KeyE'] });
        if (S.screen !== 'altar' || !sh.gifts || sh.gifts.map(tier).join() !== '1,2,3,4' || !(sh.gifts[0].cost < sh.gifts[1].cost && sh.gifts[1].cost < sh.gifts[2].cost)) out.push('altar: E does not offer one gift per tier at rising prices');
        const U = UI.altar(sh.gifts.length), at = (i) => ({ px: U.r[i].x + 5, py: U.r[i].y + 5, click: 1, keys: [] }), o = sh.gifts[2];
        o.id = 'fury'; S.meta.shards = o.cost - 1; const a0 = heroSt(S).atk; step(S, at(2));
        if (S.meta.shards !== o.cost - 1 || sh.used || S.screen !== 'altar') out.push('altar: a gift went through without enough shards');
        S.meta.shards = o.cost + 3; h.hp = 1; step(S, at(2));
        if (S.meta.shards !== 3 || !sh.used || S.screen !== 'play' || heroSt(S).atk <= a0 || h.hp !== heroSt(S).maxHp) out.push('altar: a gift did not take its price, apply, heal or close');
        h.gold = 0; step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); if (S.screen === 'altar') out.push('altar: a spent altar opens with nothing to donate');
        h.gold = 5000; step(S, { keys: [] }); step(S, { keys: ['KeyE'] });
        const bank = S.meta.shards, perks = JSON.stringify(h.perks); step(S, at(2));
        if (S.screen !== 'altar' || S.meta.shards !== bank || JSON.stringify(h.perks) !== perks) out.push('altar: a used altar refuses donations or sells a second gift');
        const T = spawn(0, { meta: S.meta, run: JSON.parse(JSON.stringify(R)) }); if (stats(T.saved.hero, T.meta).atk !== heroSt(S).atk) out.push('altar: a gift is lost on save/load');
        const old = spawn(0, { meta: S.meta, run: JSON.parse(JSON.stringify(R)) }); delete old.saved.hero.perks; if (!(stats(old.saved.hero, old.meta).atk > 0)) out.push('altar: a save without gifts breaks the stats'); } }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero;
      enterFloor(S, R, 6); const sh = R.shrines[0]; R.en = []; h.x = sh.x; h.y = sh.y + 40; openAltar(S, R, sh);
      const b = UI.altar().r.find((o) => o.id === 'donate'), click = { keys: [], click: 1, px: b.x + 5, py: b.y + 5 }, bank = S.meta.shards, found = R.shards;
      h.gold = 999; step(S, click); if (h.gold !== 999 || R.donations || S.meta.shards !== bank) out.push('donations: insufficient gold accepted');
      h.gold = 11000; for (let i = 0; i < 4; i++) step(S, click);
      if (sh.used || R.donations !== 4 || h.gold !== 7000 || R.shards !== found + 4 || S.meta.shards !== bank + 4 || S.screen !== 'altar') out.push('donations: wrong exchange or consumes the gift');
      sh.used = 1; step(S, click); const T = spawn(0, JSON.parse(JSON.stringify(persist(S)))); T.run = T.saved; T.saved = null; T.screen = 'play';
      const RR = T.run; enterFloor(T, RR, 7); openAltar(T, RR, RR.shrines[0]); for (let i = 0; i < 6; i++) step(T, click);
      if (RR.donations !== 10 || RR.hero.gold !== 1000 || T.meta.shards !== bank + 10 || RR.shards !== found + 10) out.push('donations: cap not shared across altars or save/load');
      RR.shrines[0].gifts[0].id = 'greed'; openAltar(T, RR, RR.shrines[0]);
      if (RR.shrines[0].gifts[0].id !== 'alert' || D.GIFTS.some((g) => g.id === 'greed')) out.push('donations: old gold gift still offered');
      RR.hero.perks = { greed: 1 }; if (stats(RR.hero, T.meta).gold !== 1.25) out.push('donations: old gold gift lost on load');
      RR.hero.perks = {}; const dodge = stats(RR.hero, T.meta).dodge; RR.hero.perks.alert = 1;
      if (stats(RR.hero, T.meta).dodge !== Math.min(BAL.dodge.cap, dodge + 5)) out.push('gift: alert grants no dodge'); }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero;
      const actor = { type: 'cultist', elite: 1, mods: ['explosive', 'fiery'] }; h.hp = 9999;
      for (const src of ['spike', 'lava', 'burn', 'cultist elite bolt']) hurtHero(S, R, 4, h.x + 30, h.y, 'spike', src, src.startsWith('cultist') ? actor : null);
      const T = spawn(0, JSON.parse(JSON.stringify(persist(S)))); T.run = T.saved; T.saved = null; T.screen = 'play'; T.run.hero.hp = 1;
      hurtHero(T, T.run, 50, h.x + 30, h.y, 'spike', 'cultist elite blast', actor); actor.mods.length = 0; endRun(T, 'dead');
      const d = T.result.damage;
      if (d.length !== 3 || d[2].src !== 'cultist elite blast' || d[2].actor.mods.length !== 2 || d[2].n !== Math.min(50, Math.round(T.result.heroStats.maxHp * BAL.cap.blow)) || !T.result.heroStats || T.run) out.push('end: loses last hit, exact elite, history or hero across save/load');
      if (damageName('cultist reflect') !== 'Культист' || damageName('cultist отражение') !== 'Культист' || damageName('cultist elite bolt') !== 'Культист (элита) · снаряд' || damageName('cultist (элита) снаряд') !== 'Культист (элита) · снаряд' || damageName('lava') !== 'Лава') out.push('end: damage source not translated'); }
    // TASKS 1647: a chain of blasts takes no more than BAL.cap.blast of the health over its window; once the window has passed, a blast lands again
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero, max = heroSt(S).maxHp, C = BAL.cap.blast;
      h.base.agi = 0; h.perks = {}; if (heroSt(S).dodge > 0) out.push('blasts: the hero still dodges, the check leans on its rolls');
      h.hp = max * 10; for (let i = 0; i < 6; i++) { hurtHero(S, R, 1e5, h.x + 30, h.y, undefined, 'skel_ember blast', { type: 'skel_ember' }); S.t += C.t / 8; }
      const took = max * 10 - h.hp; hurtHero(S, R, 1e5, h.x + 30, h.y, undefined, 'boss blast', { type: 'boss' }); if (!(max * 10 - h.hp > took)) out.push('blasts: a boss blast held by the smouldering dead\'s cap');
      const took2 = max * 10 - h.hp; S.t += C.t; hurtHero(S, R, 1e5, h.x + 30, h.y, undefined, 'skel_ember blast', { type: 'skel_ember' });
      if (took > max * C.share + 1 || took < max * C.share - 1) out.push(`blasts: a chain took ${Math.round(100 * took / max)} % of the health in ${C.t} s, the cap is ${100 * C.share} %`);
      if (!(max * 10 - h.hp > took2)) out.push('blasts: no blast lands once the window has passed');
      S.t += C.t; R.blastWin = []; h.hp = max * 10; h.shield = max * 5; h.shieldUntil = S.t + 9; for (let i = 0; i < 3; i++) hurtHero(S, R, 1e5, h.x + 30, h.y, undefined, 'skel_ember blast', { type: 'skel_ember' });
      h.shield = 0; hurtHero(S, R, 1e5, h.x + 30, h.y, undefined, 'skel_ember blast', { type: 'skel_ember' }); if (!(h.hp < max * 10)) out.push('blasts: what a shield took counts against the cap'); }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run;
      enterFloor(S, R, 8); const e = R.en.find((o) => o.type === 'boss'), h = R.hero; R.en = [e]; R.proj = []; S.t = 5;
      e.st = 'bwind'; e.mv = 'volley'; e.t0 = 4; e.fired = 0; stepBossMove(S, R);
      const p = R.proj[0]; p.x = h.x; p.y = h.y - 38; p.vx = p.vy = 0; h.hp = 1; h.ifr = 0; h.dashT = -9;
      for (let i = 0; i < 100 && h.deadT < 0; i++) { p.dead = p.spent = 0; R.proj = [p]; stepProjectiles(S, R); }
      if (h.deadT < 0 || !R.recentDamage || !R.recentDamage.slice(-1)[0].actor || R.recentDamage.slice(-1)[0].actor.type !== 'boss') out.push('end: boss volley loses its killer portrait'); }
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 777), f = fstat(R), e = R.en.find((o) => !hidden(R.map, o));
      R.en = [e]; f.foes = 20; f.kills = 16; f.lootN = 20; f.loot = 16; f.secN = 20; f.sec = 0;
      if (completionHints(R).length) out.push('hints: enabled below 85%');
      f.kills = f.loot = 17; const c = R.chests.find((o) => !hidden(R.map, o)); R.chests = [c];
      R.drops = [{ x: e.x, y: e.y, kind: 'item', loot: 1, got: 0 }, { x: e.x, y: e.y, kind: 'item', loot: 0, got: 0 }];
      const hints = completionHints(R);
      if (hints.filter((o) => o.kind === 'foe').length !== 1 || hints.filter((o) => o.kind === 'loot').length !== 2) out.push('hints: misses live foe, chest or item at 85%');
      f.sec = 17; if (completionHints(R).some((o) => o.kind === 'secret')) out.push('hints: secret location highlighted');
      e.summ = 1; if (completionHints(R).some((o) => o.kind === 'foe')) out.push('hints: summoned enemy highlighted');
      f.kills = f.foes; f.loot = f.lootN; if (completionHints(R).length) out.push('hints: completed categories still highlighted'); }
    {
      const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); S.screen = 'play'; const R = S.run, h = R.hero, m = R.map;
      R.en = []; m.decor = [{ n: 'shroom_a', x: h.x + 10, y: h.y, s: 0.6 }, { n: 'skel_cv', x: h.x + 12, y: h.y }];
      S.ev = []; hitProps(S, R, h.x, h.y, 30); const n = S.ev.filter((e) => e.k === 'prop' && (e.n === 'shroom_a' || e.n === 'skel_cv')).length;
      if (n !== 2) out.push('cave reactions: mushroom or skeleton ignores a blow');
      hitProps(S, R, h.x, h.y, 30); if (S.ev.filter((e) => e.k === 'prop' && (e.n === 'shroom_a' || e.n === 'skel_cv')).length !== n) out.push('cave reactions: repeated blow bypasses cooldown');
      S.t += 1; const x = Math.floor((h.x + 6) / TILE), y = Math.floor(h.y / TILE), k = y * m.W + x, saved = m.cells[k];
      m.cells[k] = 0; hitProps(S, R, h.x - TILE, h.y, 80); m.cells[k] = saved;
      if (S.ev.filter((e) => e.k === 'prop' && (e.n === 'shroom_a' || e.n === 'skel_cv')).length !== n) out.push('cave reactions: response through rock');
      S.ev = []; for (let i = 0; i < 120; i++) step(S, { keys: [] });
      if (S.ev.some((e) => e.k === 'prop' && (e.n === 'shroom_a' || e.n === 'skel_cv'))) out.push('cave reactions: stationary hero retriggers decor');
    }
    // the magma caves' dead things (TASKS 466): a crack, a charred skeleton and a chain fence answer a blow, and a step by them
    {
      const S = spawn(0, {}); S.run = newRun(S, 'magma', 3); S.screen = 'play'; const R = S.run, h = R.hero, m = R.map, ns = ['vent_mg', 'skel_mg', 'fence_mg'];
      R.en = []; m.decor = [{ n: 'vent_mg', x: h.x + 10, y: h.y }, { n: 'skel_mg', x: h.x - 12, y: h.y }, { n: 'fence_mg', x: h.x - 40, y: h.y + 6, len: 80 }];
      S.ev = []; hitProps(S, R, h.x, h.y, 30); const got = new Set(S.ev.filter((e) => e.k === 'prop').map((e) => e.n));
      for (const n of ns) if (!got.has(n)) out.push(`magma reactions: ${n} ignores a blow`);
      S.t += 1; S.ev = []; const x0 = h.x; for (let i = 0; i < 60; i++) { step(S, { keys: [], right: 1 }); if (h.x - x0 > 30) break; }
      const touched = new Set(S.ev.filter((e) => e.k === 'prop' && e.touch).map((e) => e.n)); for (const n of ns) if (!touched.has(n)) out.push(`magma reactions: ${n} ignores a step by it`);
    }
    {
      const S = spawn(0, {}); S.run = newRun(S, 'cave', 3); const R = S.run, m = R.map, h = R.hero, tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
      m.decor = []; R.en = []; R.chests = []; R.pots = [];
      for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 1; x <= tx + 7; x++) m.cells[y * m.W + x] = x >= tx + 1 && x <= tx + 3 ? 6 : 1;
      const fire = () => ({ id: R.nextId++, k: 'fire', own: 'hero', x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE - 20, gz: 20, vx: 300, vy: 0, t0: S.t, life: 2, r: 6, dmg: 100 });
      const p = fire(); R.proj = [p]; for (let i = 0; i < 50; i++) { S.t += DT; stepProjectiles(S, R); }
      if (p.dead || p.x < (tx + 4) * TILE) out.push('hero fireball: dies over deep water');
      const target = { id: R.nextId++, type: 'skeleton', x: (tx + 5.5) * TILE, y: p.y + ENEMIES.skeleton.h * 0.45, hp: 500, max: 500, deadT: -1, elite: 0, room: -1, st: 'idle', hitT: -9, kbx: 0, kby: 0, burn: 0, burnT: 0 };
      R.en = [target]; for (let i = 0; i < 40 && !p.dead; i++) { S.t += DT; stepProjectiles(S, R); }
      if (target.hp >= 500) out.push('hero fireball: no damage after deep water');
      m.cells[ty * m.W + tx + 2] = 0; const q = fire(); R.proj = [q]; for (let i = 0; i < 50 && !q.dead; i++) { S.t += DT; stepProjectiles(S, R); }
      if (!q.dead || q.x >= (tx + 3) * TILE) out.push('hero fireball: passes through rock above water');
    }
    return out;
  }
  function altarCheck() {
    const out = [];
    // an altar on every second floor of a chapter and on no other (TASKS 137), the last on the floor before the chapter's boss, one past
    // him if the run goes on (the demon lord's 8th, TASKS 339), none on the run's last floor (TASKS 183): 2, 4, 6, 7, 8, 10, 11
    { const bad = [], want = (f) => { const st = D.stageOf('campaign', f); return !st.fin && (st.lf % 2 === 0 || st.lf === st.n - 1) ? 1 : 0; };
      for (let seed = 1; seed <= 40; seed++) for (let f = 1; f <= D.RUNS.campaign.floors; f++) { const n = DG.genFloor((seed * 31 + f * 1013) >>> 0, f).shrines.length;
        if (n !== want(f)) bad.push(`seed ${seed} floor ${f}: ${n}`); }
      if (bad.length) out.push(`altar: not one altar on floors 2, 4, 6, 7, 8, 10 and 11 and none on the others (${bad.length}: ${bad.slice(0, 3).join(', ')})`); }
    return out;
  }
  function secretRestCheck() {
    const out = [];
    // each gift does what it says: reach and swing width, potion strength, a kill's meal, thorns back into a close striker (not a far one),
    // one second chance per gift, more damage on a nearly dead monster
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero, give = (id) => { h.perks[id] = (h.perks[id] || 0) + 1; };
      const st0 = heroSt(S); give('reach'); give('cleave'); const st1 = heroSt(S);
      if (!(st1.reach > st0.reach * 1.1 && st1.arc === st0.arc + 25)) out.push('gift: reach or swing width did not grow');
      h.hp = 1; h.bag[0] = potion('hp_potion', 2); usePotion(S, R, 'hp_potion'); const plain = h.hp; give('thrift'); h.hp = 1; usePotion(S, R, 'hp_potion');
      if (!(h.hp > plain * 1.2)) out.push('gift: a stronger brew heals no more');
      const mob = (dx) => { const E = ENEMIES.goblin; const e = { id: 9001, type: 'goblin', x: h.x + dx, y: h.y, vx: 0, vy: 0, hp: 500, max: 500, dmg: 10, elite: 0, room: -1, st: 'chase', t0: 0, face: -1, aimA: Math.PI, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, r: E.r }; R.en = [e]; return e; };
      give('feast'); h.hp = 10; let e = mob(40); e.hp = 1; hitEnemy(S, R, e, 5, 0, h.x, h.y); if (!(h.hp > 10)) out.push('gift: a kill did not feed the hero');
      give('thorns'); e = mob(40); h.ifr = 0; h.hp = 100; hurtHero(S, R, 40, e.x, e.y, undefined, 'goblin'); struck(S, R, e); const near = 500 - e.hp;
      e = mob(400); h.ifr = 0; h.hurtT = -9; hurtHero(S, R, 40, e.x, e.y, undefined, 'cultist'); struck(S, R, e);
      if (!(near > 0) || e.hp !== 500) out.push(`gift: thorns hit a close striker ${near}, a far one ${500 - e.hp}`);
      give('execute'); e = mob(40); e.hp = 400; hitEnemy(S, R, e, 50, 0, h.x, h.y); const full = 400 - e.hp; e.hp = 100; hitEnemy(S, R, e, 50, 0, h.x, h.y);
      if (!(100 - e.hp > full * 1.4)) out.push('gift: a finishing blow is no stronger');
      give('phoenix'); R.en = []; h.ifr = 0; h.hp = 5; hurtHero(S, R, 9999, h.x + 30, h.y); const once = h.deadT < 0 && h.hp > 0; h.ifr = 0; hurtHero(S, R, 9999, h.x + 30, h.y);
      if (!once || h.deadT < 0) out.push('gift: the second chance did not save the hero once, or saved him twice'); }
    // dodge (BAL.dodge): a blow misses about as often as the hero's dodge says, a dash adds its share but never makes him immune,
    // and lava under a dash does not burn
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero; R.en = [];
      const rate = (dash) => { let miss = 0; for (let i = 0; i < 2000; i++) { h.hp = 1e6; h.dashT = dash ? S.t : -9; const hp0 = h.hp; hurtHero(S, R, 10, h.x + 20, h.y); if (h.hp === hp0) miss++; } return miss / 20; };
      const d0 = heroSt(S).dodge, plain = rate(false), dash = rate(true), want = Math.min(100, d0 + BAL.dodge.dash);
      if (Math.abs(plain - d0) > 2 || Math.abs(dash - want) > 4 || dash >= 99) out.push(`dodge: ${plain}% standing (want ${d0}%), ${dash}% dashing (want ${want}%, never all)`);
      h.hp = 1e6; h.dashT = S.t; hurtHero(S, R, 50, h.x, h.y, undefined, 'lava'); if (h.hp !== 1e6) out.push('dodge: lava burns a dashing hero'); h.dashT = -9; }
    // the new meta perks reach a new hero: heirloom gear a rarity up with its affixes, skill points, mana, regeneration, resistance
    // (on a mage: the warrior's rage has no mana for the perk, TASKS 1130)
    { const up = { gear: 2, skill: 2, mana: 3, regen: 2, resist: 3 }, S = spawn(0, { meta: { shards: 0, up } }), R = newRun(S, 'campaign', 777, { cls: 'mage' }), h = R.hero, st = stats(h, S.meta);
      const R0 = newRun(spawn(0, {}), 'campaign', 777, { cls: 'mage' }), st0 = stats(h, { up: {} });
      if (h.eq.weapon.rar !== 2 || h.eq.armor.rar !== 2 || h.eq.weapon.atk <= R0.hero.eq.weapon.atk || Object.keys(h.eq.armor.mods).length !== RARITY[2].affixes) out.push('meta: heirloom gear is not a rarity up');
      if (h.sp !== 2 || st.maxMp !== st0.maxMp + 30 || st.regen !== st0.regen + 1 || Math.abs(st.resist - 0.55) > 1e-9) out.push('meta: skill, mana, regen or resist perk does not apply'); }
    {
      const S = spawn(0, {}); S.run = newRun(S, 'cave', 71); S.screen = 'play'; const R = S.run;
      enterFloor(S, R, 4); const m = R.map, h = R.hero, b = R.en.find((e) => e.type === 'boss_serpent'), B = D.BOSSES.boss_serpent, r = m.rooms[b.room]; R.en = [b];
      if (m.serpentPools.length !== 3 || m.serpentPools.some((p) => p.length < 2 || p.some((k) => m.cells[k] !== 6))) out.push('serpent: missing deep lakes');
      if (b.st !== 'idle' || !counted(b) || !under(b) || !arenaSealed(R)) out.push('serpent: initial seal, hidden state or completion count missing');
      h.x = (r.cx + 0.5) * TILE; h.y = (r.cy + 0.5) * TILE; h.ifr = 1e9; stepArena(S, R);
      if (!R.arena?.active || !m.doors.some((d) => d.arena) || m.doors.some((d) => d.arena && d.open)) out.push('serpent: arena not sealed');
      const outside = flow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE));
      if (outside[Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)] >= 0) out.push('serpent: a path bypasses arena gates');
      const hp = b.hp; hitEnemy(S, R, b, 100, false, h.x, h.y); if (b.hp !== hp) out.push('serpent: hurt while submerged');
      const pools = [], states = new Set(), moves = new Set(); let stirT = 0;
      for (let i = 0; i < 120 * 38; i++) { const last = b.st; step(S, { px: 960, py: 540, keys: [] }); states.add(b.st); if (b.mv) moves.add(b.mv);
        if (b.st === 'stir' && last !== b.st) { pools.push(b.pool); stirT = S.t; }
        if (b.st === 'rise' && last !== b.st && Math.abs(S.t - stirT - B.warn) > 0.02) out.push('serpent: emergence warning too short');
        if (m.cells[Math.floor(b.y / TILE) * m.W + Math.floor(b.x / TILE)] !== 6) { out.push('serpent: leaves deep water'); break; }
      }
      for (const st of ['stir', 'rise', 'bwind', 'recover', 'dive', 'deep']) if (!states.has(st)) out.push(`serpent: missing state ${st}`);
      if (pools.length < 3 || pools.some((p, i) => i && p === pools[i - 1])) out.push('serpent: does not change lakes');
      for (const mv of Object.keys(B.moves)) {
        b.st = 'chase'; b.cdT = 1e9; b.openUntil = 0; R.proj = []; h.ifr = 1e9; h.x = b.x + 90; h.y = b.y; beginBossMove(S, R, b, mv);
        S.t += B.moves[mv].wind - DT; serpent(S, R, b, true); if (b.fired || R.proj.length) out.push(`serpent ${mv}: fires before wind-up`);
        S.t += 2 * DT; serpent(S, R, b, true); if (!b.fired) out.push(`serpent ${mv}: does not fire`);
        if (mv === 'wave' || mv === 'fan') { const n = mv === 'wave' ? 1 : B.moves.fan.n;
          if (R.proj.length !== n || R.proj.some((p) => p.own !== 'en' || p.dmg !== b.dmg * B.moves[mv].dmg)) out.push(`serpent ${mv}: wrong projectiles`);
        }
        S.t += B.moves[mv].duration; serpent(S, R, b, true);
        if (b.st !== 'recover' || b.openUntil <= S.t) out.push(`serpent ${mv}: no punish window after miss`);
      }
      const hp1 = b.hp; b.st = 'recover'; b.openUntil = S.t + 1; hitEnemy(S, R, b, 100, false, h.x, h.y); if (Math.abs(hp1 - b.hp - 140) > 0.01) out.push('serpent: no extra damage in punish window');
      b.openUntil = 0; b.st = 'chase'; b.cdT = 1e9; b.hp = b.max * 0.5; serpent(S, R, b, true);
      const water = m.water.length, cells = m.cells.slice(); if (b.phase !== 1 || !(b.floodAt > S.t)) out.push('serpent: phase two has no flood warning');
      S.t += 1.21; serpent(S, R, b, true);
      if (m.water.length <= water || !m.arenaWater.length || m.cells.some((c, k) => c !== cells[k]) || !arenaPath(m, b.room)) out.push('serpent: flood changes collision or cuts off the arena');
      if (R.en.filter((e) => e.summ === b.id && e.type === 'drowned').length !== 2) out.push('serpent: flood must raise two drowned');
      if (m.flood.cells.length > 4 && m.flood.n >= m.flood.cells.length) out.push('serpent: the flood has no front');
      S.t += 0.8; serpent(S, R, b, true); const mid = m.flood.n; S.t += 1; serpent(S, R, b, true);
      if (!(mid > 1 && mid < m.flood.cells.length) || m.flood.n !== m.flood.cells.length || new Set(m.arenaWater).size !== m.flood.cells.length) out.push('serpent: the flood does not spread over 1.6 s to every shore cell');
      b.st = 'bwind'; b.mv = 'tail'; b.fired = 0; b.t0 = S.t; b.dmg = 1e6; h.ifr = 0; h.hp = 1e6; h.x = b.x + 80; h.y = b.y;
      let lost = 0;
      for (let i = 0; i < 12 && !lost; i++) { b.fired = 0; b.t0 = S.t; h.ifr = 0; const hp2 = h.hp;
        S.t += B.moves.tail.wind + DT; serpent(S, R, b, true); lost = hp2 - h.hp;
      }
      if (!lost || lost / heroSt(S).maxHp > BAL.cap.boss + 0.01) out.push('serpent: tail misses or exceeds the boss damage cap');
      const projectile = (mv, side) => {
        b.st = 'chase'; b.openUntil = 0; R.proj = []; b.dmg = 100; b.face = 1; h.ifr = 0; h.hp = 1e6; h.shield = 0;
        h.x = (r.cx + 0.5) * TILE; h.y = (r.cy + 0.5) * TILE; const hx = h.x, hy = h.y;
        beginBossMove(S, R, b, mv);
        if (mv === 'fan') { const [x, y] = serpentMouth(b); b.aimA = Math.atan2(h.y - 38 - y, h.x - x); }
        S.t += B.moves[mv].wind + DT; serpent(S, R, b, true); const bolts = R.proj.slice(), a = b.aimA;
        if (side) { h.x = hx - Math.sin(a) * 80; h.y = hy + Math.cos(a) * 80; }
        const hp0 = h.hp;
        for (let i = 0; i < 360; i++) { S.t += DT; h.ifr = 0; stepProjectiles(S, R); }
        return { hits: bolts.filter((p) => p.onHero).length, lost: hp0 - h.hp };
      };
      if (!projectile('wave', 0).hits || projectile('wave', 1).hits) out.push('serpent: wave misses a still target or catches a sidestep');
      const fan = projectile('fan', 0);
      if (!fan.hits || fan.lost > heroSt(S).maxHp * BAL.cap.boss + 0.01) out.push('serpent: fan misses or wounds more than once');
      b.st = 'recover'; b.hp = 1; killEnemy(S, R, b);
      if (!R.bossDead || R.arena.active || m.doors.some((d) => d.arena && !d.open) || m.arenaWater.length || R.en.some((e) => e.summ === b.id && e.deadT < 0) || !R.drops.some((d) => d.kind === 'shard' && d.n === 20)) out.push('serpent: death leaves arena sealed, flood, summons or no reward');
      for (let i = 0; i < 180; i++) stepDrops(S, R, false);
      if (R.drops.some((d) => m.cells[Math.floor(d.y / TILE) * m.W + Math.floor(d.x / TILE)] !== 1)) out.push('serpent: reward stranded in deep water');
      endRun(S, 'win'); if (S.screen !== 'win' || S.result.mode !== 'cave' || S.result.win !== REWARD.win) out.push('serpent: wrong victory screen or reward');
    }
    // TASKS 470: a lava river through the wall of run 1's floor-6 arena; sealed, the hero's walkable cells stay in the room (the
    // generator keeps lava off a boss hall's wall since TASKS 505, so the river is cut here: from the hall's side out into the rock)
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 1); S.screen = 'play'; const R = S.run; enterFloor(S, R, 6);
      const m = R.map, b = R.en.find((e) => e.type === 'boss_forge'), r = m.rooms[b.room], W = m.W, walk = (k) => !solidAt(m, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE, false, true);
      const flood = () => { const seen = new Set([Math.floor(b.y / TILE) * W + Math.floor(b.x / TILE)]), q = [...seen]; let out = 0;
        for (let i = 0; i < q.length; i++) { const k = q[i], x = k % W, y = Math.floor(k / W); if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) out++;
          for (const n of [k + 1, k - 1, k + W, k - W]) if (!seen.has(n) && walk(n)) { seen.add(n); q.push(n); } } return out; };
      for (const d of m.doors) if (d.arena) for (const [x, y] of d.cells) m.cells[y * W + x] = 5;
      if (!flood()) { const y = r.y + (r.h >> 1); for (let x = r.x + r.w - 1; x <= r.x + r.w + 3; x++) { if (m.cells[y * W + x] !== 3) m.lava++; m.cells[y * W + x] = 3; } m.geometry = (m.geometry || 0) + 1; }
      if (!flood()) out.push('arena lava: the river cut through run 1 floor 6\'s arena wall leads nowhere');
      R.hero.x = b.x; R.hero.y = b.y + 100; stepArena(S, R);
      if (flood()) out.push('arena lava: the hero walks out of the sealed arena over lava'); }
    for (const [type, f] of [['boss_spider', 2], ['boss_necro', 4], ['boss_forge', 6], ['boss', 8]]) {
      const S = spawn(0, {}); S.run = newRun(S, 'campaign', 71); S.screen = 'play'; const R = S.run;
      enterFloor(S, R, f); const m = R.map, h = R.hero, b = R.en.find((e) => e.type === type), B = D.BOSSES[type];
      aggroRoom(R, { x: b.x, y: b.y, room: b.room });
      if (b.st !== 'idle') out.push(`boss ${type}: nearby combat wakes the boss before the arena seals`);
      if (m.secrets.some((q) => q.front.some(([x, y]) => DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) === b.room))) out.push(`boss ${type}: secret bypasses sealed arena`);
      if (m.rooms[m.exitRoom].plan !== 'arena' || !m.doors.some((d) => d.arena) || m.enemies.some((e) => e.guard)) out.push(`boss ${type}: arena, gates or guard replacement missing`);
      h.x = b.x; h.y = b.y + 100; h.ifr = 1e9; stepArena(S, R);
      if (!R.arena || !R.arena.active || m.doors.some((d) => d.arena && d.open)) out.push(`boss ${type}: arena does not seal on entry`);
      for (const d of m.doors) if (d.arena) { openDoor(S, R, d, 1); if (d.open) out.push(`boss ${type}: sealed gate can be kicked open`); }
      const room = m.rooms[b.room];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        h.x = (room.x + room.w / 2) * TILE; h.y = (room.y + room.h / 2) * TILE;
        move(m, h, dx * room.w * TILE, dy * room.h * TILE, K.R, true);
        if (DG.roomAt(m, h.x, h.y) !== b.room || boxHit(m, h.x, h.y, K.R, true, false)) out.push(`boss ${type}: a long push crosses the sealed arena`);
      }
      const oldFloor = R.floor; h.x = m.exit.x; h.y = m.exit.y; interact(S, R);
      if (R.floor !== oldFloor) out.push(`boss ${type}: stairs bypass living boss`);
      for (let phase = 1; phase < B.phases.length; phase++) {
        b.st = 'chase'; b.nextMove = null;
        b.hp = b.max * (B.phases[phase].at + 0.001); stepBossMove(S, R); if (b.phase !== phase - 1) out.push(`boss ${type}: phase ${phase} starts too soon`);
        b.hp = b.max * B.phases[phase].at; stepBossMove(S, R); if (b.phase !== phase) out.push(`boss ${type}: phase ${phase} misses threshold`);
      }
      if (type === 'boss') { b.phase = 1; b.hp = b.max * 0.24; beginBossMove(S, R, b, 'volley'); const M = D.bossMove(b);
        S.t += M.wind / 2; stepBossMove(S, R); if (b.phase !== 1) out.push('boss: threshold interrupts committed volley');
        for (let i = 0; i < Math.ceil((M.wind + M.duration) / DT); i++) { S.t += DT; stepBossMove(S, R); }
        if (b.phase !== 2) out.push('boss: queued third phase never starts');
      }
      b.hp = b.max; b.phase = 0; b.st = 'chase'; b.cdT = 0; b.moveI = 0;
      const sequence = [];
      for (let i = 0; i < B.phases[0].moves.length; i++) { bossThink(S, R, b, 100); sequence.push(b.mv); b.st = 'chase'; b.cdT = 0; }
      if (sequence.join() !== B.phases[0].moves.join()) out.push(`boss ${type}: move order changes with time`);
      if (type === 'boss_spider') { const webs = m.webs; m.webs = []; b.vx = b.vy = 0; steer(b, ENEMIES[type], m, [], 1, 100, 0, 100); const vx = b.vx;
        m.webs = [{ x: b.x, y: b.y, s: 1, torn: 0 }]; b.vx = b.vy = 0; steer(b, ENEMIES[type], m, [], 1, 100, 0, 100);
        if (b.vx !== vx) out.push('queen: own webs slow the spider queen'); m.webs = webs;
      }
      if (B.moves.weave) { const n = m.webs.length; bossWebs(S, R, b, B.moves.weave); if (m.webs.length <= n) out.push(`boss ${type}: weave adds no webs`);
        tearWebs(S, R, b.x, b.y, 500, undefined, undefined, 1); if (m.webs.some((w) => w.boss === b.id && !w.torn)) out.push(`boss ${type}: fire leaves webs intact`); }
      if (B.moves.eggs) { bossEggs(S, R, b, B.moves.eggs); const egg = (R.eggs || []).find((o) => o.hp > 0); if (!egg) out.push('queen: no clutch'); else {
          S.t = egg.hatchT; stepArena(S, R); if (!R.en.some((o) => o.type === 'spider' && o.summ === b.id)) out.push('queen: eggs do not hatch');
          bossEggs(S, R, b, B.moves.eggs); const intact = R.eggs.find((o) => o.hp > 0); if (intact) { tearWebs(S, R, intact.x, intact.y, 30); if (intact.hp > 0) out.push('queen: attack does not break eggs'); }
        } }
      if (B.moves.raise) { const o = R.en.find((o) => o !== b && !D.BOSSES[o.type]); if (o) { o.deadT = S.t; o.hp = 0; bossRaise(S, R, b, B.moves.raise);
          if (!o.raised || !R.en.some((e) => e.summ === b.id && e.deadT < 0)) out.push(`boss ${type}: fallen cannot be raised`); } }
      if (B.moves.barrier) { beginBossMove(S, R, b, 'barrier'); S.t += B.moves.barrier.wind + DT; stepBossMove(S, R); const hp = b.hp;
        hitEnemy(S, R, b, 20, 0, b.x, b.y); if (b.hp !== hp || !(b.shield > 0)) out.push(`boss ${type}: barrier does not absorb damage`);
        S.t = b.shieldUntil + DT; hitEnemy(S, R, b, 20, 0, b.x, b.y); if (b.hp >= hp) out.push(`boss ${type}: expired barrier still absorbs damage`);
        if (type === 'boss_necro' && m.decor.filter((d) => d.cover).length < 2) out.push('necro: missing cover columns');
      }
      if (type === 'boss' && (D.bossMove({ type, mv: 'weave', phase: 2 }).vulnerable || 1) !== 1) out.push('boss: the finale opens up while weaving');
      if (B.moves.convergence) { b.shield = 0; beginBossMove(S, R, b, 'convergence'); S.t += B.moves.convergence.wind + DT; stepBossMove(S, R);
        if (!(b.shield > 0)) out.push('boss: third phase raises no barrier');
        if (!m.webs.some((w) => w.boss === b.id && !w.torn) || !R.en.some((o) => o.summ === b.id && o.deadT < 0) || !R.lavaPending.length) out.push('boss: third phase does not combine all chapter mechanics');
      }
      if (B.moves.lava) { for (let i = 0; i < 8; i++) { bossLava(S, R, b, B.moves.lava); S.t += B.moves.lava.warn + DT; stepArena(S, R);
          if (!arenaPath(m, b.room)) out.push(`boss ${type}: lava cuts off arena floor`); }
        if (!(m.arenaLava || []).length) out.push(`boss ${type}: lava does not spread`);
        const restored = JSON.parse(JSON.stringify(persist(S).run)); if (restored.map.arenaLava.length !== m.arenaLava.length) out.push(`boss ${type}: save loses lava`);
      }
      killEnemy(S, R, b); if (m.doors.some((d) => d.arena && !d.open) || arenaSealed(R) || (m.arenaLava || []).length) out.push(`boss ${type}: victory leaves gates or lava sealed`);
      if (f < 8 && (!R.shrines.some((o) => o.boss === type) || m.shrines.length !== 1)) out.push(`boss ${type}: missing exit altar`);
    }
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 71); const R = S.run; enterFloor(S, R, 8); const b = R.en.find((e) => e.type === 'boss'); R.hero.ifr = 1e9;
      b.st = 'chase'; b.phase = 888; delete b.bossVersion; stepBossMove(S, R); if (b.phase !== 0) out.push('boss: old phase counter blocks new phases');
      const M = D.BOSSES.boss.moves.volley, old = { n: M.n, wind: M.wind, dmg: M.dmg }; Object.assign(M, { n: 3, wind: 1.9, dmg: 0.123 });
      beginBossMove(S, R, b, 'volley'); S.t += 1; stepBossMove(S, R); if (R.proj.length) out.push('boss: volley ignores data wind');
      S.t += 1; stepBossMove(S, R); if (R.proj.length !== 3 || R.proj.some((p) => p.dmg !== b.dmg * M.dmg)) out.push('boss: volley ignores data count or damage'); Object.assign(M, old);
      const h = R.hero; h.x = b.x + 90; h.y = b.y; h.ifr = 1e9; R.proj = []; beginBossMove(S, R, b, 'volley'); S.t += M.wind + DT; stepBossMove(S, R); const bolt = R.proj[0]; R.proj = [bolt];
      for (let i = 0; i < 70 && !bolt.dead; i++) { S.t += DT; stepProjectiles(S, R); }
      if (!bolt.onHero) out.push('boss: aimed volley misses a stationary hero at melee range');
      b.phase = 1; b.hp = b.max * 0.4; R.proj = []; beginBossMove(S, R, b, 'volley'); const rings = new Set();
      for (let i = 0; i < 200; i++) { S.t += DT; stepBossMove(S, R); for (const p of R.proj) rings.add(p); stepProjectiles(S, R); }
      if ([...rings].filter((p) => p.onHero).length !== 2) out.push('boss: a stationary melee target escapes the shifted double volley');
      h.ifr = 0; h.hp = 1e6; b.hp = b.max * 0.4; R.proj = []; const n0 = S.ev.length; beginBossMove(S, R, b, 'volley');
      for (let i = 0; i < 200; i++) { S.t += DT; h.ifr = 0; stepBossMove(S, R); stepProjectiles(S, R); }
      if (S.ev.slice(n0).filter((e) => e.k === 'hurt' && / bolt$/.test(e.src)).length > 1) out.push('boss: both rings of one volley wound the hero');
      h.ifr = 1e9;
      // the link (TASKS 227): a charge that lands ends it; one the hero stepped out of is followed by the slam where it stopped
      const run = (aside) => { h.x = b.x + 90; h.y = b.y; h.ifr = 1e9; b.phase = 1; b.hp = b.max * 0.4; R.proj = []; beginBossMove(S, R, b, 'charge'); h.y += aside;
        let slam = null; for (let i = 0; i < 120; i++) { S.t += DT; stepBossMove(S, R); if (b.mv === 'slam' && b.fired) { slam = S.t; break; } if (b.st === 'chase') break; } return slam; };
      if (run(0) !== null) out.push('boss: a landed charge still chains the slam');
      if (run(70) === null) out.push('boss: a charge the hero stepped out of is not followed by the slam');
      h.x = b.x + 90; h.y = b.y; h.ifr = 0; h.hp = heroSt(S).maxHp; const safeHp = h.hp;
      beginBossMove(S, R, b, 'charge'); h.y += K.DASH * K.DASH_T;
      for (let i = 0; i < 240; i++) { S.t += DT;
        if (b.st === 'chase') bossThink(S, R, b, Math.hypot(h.x - b.x, h.y - b.y));
        stepBossMove(S, R); if (b.mv === 'slam' && b.fired) break;
      }
      if (h.hp !== safeHp) out.push('boss: a perpendicular charge dodge still gets caught by the linked slam');
    }
    // hit-stop holds what the player reacts to and keeps the keys pressed in it (TASKS 227)
    { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 71); S.screen = 'play'; const R = S.run; enterFloor(S, R, 8); const b = R.en.find((e) => e.type === 'boss'), h = R.hero;
      R.en = [b]; h.ifr = 1e9; h.x = b.x + 200; h.y = b.y; b.st = 'bwind'; b.mv = 'slam'; b.t0 = S.t; b.fired = 0; R.arena = { active: 1, room: b.room, t0: S.t };
      const u0 = S.t - b.t0; R.freeze = 0.05; h.cd.dash = 0; const d0 = h.dashT;
      step(S, { keys: ['Space'], px: 960, py: 540 }); for (let i = 0; i < 4; i++) step(S, { keys: [], px: 960, py: 540 });
      if (Math.abs((S.t - b.t0) - u0) > 1e-9 && R.freeze > 0) out.push('hit-stop: a boss wind-up runs on in the freeze');
      for (let i = 0; i < 8; i++) step(S, { keys: [], px: 960, py: 540 });
      if (h.dashT === d0) out.push('hit-stop: a dash pressed in the freeze is lost');
      // a plain monster's wind-up, a bolt's flight clock and a potion key pressed in the freeze
      const e = Object.assign({}, b, { id: R.nextId++, type: 'skeleton', st: 'wind', t0: S.t, hp: 50, max: 50, phase: 0 }); R.en = [b, e]; b.st = 'chase';
      R.proj = [{ id: R.nextId++, x: h.x + 600, y: h.y, vx: 0, vy: 0, t0: S.t, life: 9, dmg: 0, own: 'en', r: 9 }]; const p = R.proj[0];
      h.hp = 10; h.bag[0] = { b: 'hp_potion', n: 1, id: R.nextId++ }; const ue = S.t - e.t0, up = S.t - p.t0; R.freeze = 0.05;
      step(S, { keys: ['KeyQ'], px: 960, py: 540 }); for (let i = 0; i < 3 && R.freeze > 0; i++) step(S, { keys: [], px: 960, py: 540 });
      if (R.freeze > 0 && Math.abs((S.t - e.t0) - ue) > 1e-9) out.push('hit-stop: a monster wind-up runs on in the freeze');
      if (R.freeze > 0 && Math.abs((S.t - p.t0) - up) > 1e-9) out.push('hit-stop: a bolt ages in the freeze');
      for (let i = 0; i < 8; i++) step(S, { keys: [], px: 960, py: 540 });
      if (h.hp <= 10) out.push('hit-stop: a potion pressed in the freeze is lost'); }
    // the water caves and the magma caves as runs of their own (TASKS 300, 399): the menu starts each on the hero screen with its level and kit, its floors
    // carry their run's boss, guard and altars, the boss's death opens the way out, and the campaign's record is left alone
    for (const RID of ['cave', 'magma']) { const N = D.RUNS[RID], S = spawn(0, {});
      for (const [scr, id] of D.startPath(RID)) { if (id === 'tests') { step(S, { keys: ['Backquote'] }); continue; } const r = D.uiAt(scr).find((q) => q.id === id); step(S, { keys: [], click: 1, px: r.x + 10, py: r.y + 10 }); }
      const R = S.run, h = R && R.hero;
      if (!R || R.mode !== RID || S.screen !== 'inv') out.push(RID + ': the menu button does not start the run on the hero screen');
      else {
        if (h.lvl !== N.lvl || h.pts !== D.clsOf(h).grow.pts * (N.lvl - 1) || h.sp !== N.lvl - 1) out.push(`${RID}: the hero starts at level ${h.lvl} with ${h.pts} points and ${h.sp} skill points`);
        if (N.kit.gear.some(([b]) => !h.eq[BASES[b].slot] || h.eq[BASES[b].slot].b !== b)) out.push(RID + ': the kit is not worn');
        if (D.clsOf(h).abs.some((a) => a.unlock <= h.lvl && !h.ab[a.id])) out.push(RID + ': an ability of the hero\'s level is still locked');
        for (let f = 1; f <= N.floors; f++) { if (f > 1) enterFloor(S, R, f); const m = R.map, guards = m.enemies.filter((e) => e.guard).length;
          if ((m.bossType || undefined) !== N.boss(f)) out.push(`${RID} f${f}: boss ${m.bossType} where the run has ${N.boss(f)}`);
          if (!!N.guard[f] !== guards > 0 && !N.boss(f)) out.push(`${RID} f${f}: ${guards} exit guard(s)`);
          if (m.shrines.length !== ((f % 2 === 0 || f === N.floors - 1) && !N.boss(f) ? 1 : 0)) out.push(`${RID} f${f}: ${m.shrines.length} altar(s)`);
          if (f === 1 && R.en.some((e) => !D.BOSSES[e.type] && e.max < Math.round(D.ENEMIES[e.type].hp * BAL.hp * (1 + 0.5 * N.depth)))) out.push(RID + ' f1: a monster weaker than the run\'s depth'); }
        const b = R.en.find((e) => D.BOSSES[e.type]); S.screen = 'play'; h.ifr = 1e9; h.x = R.map.exit.x; h.y = R.map.exit.y; interact(S, R);
        if (!S.run) out.push(RID + ': the way out opens before the boss dies');
        else { const best = S.meta.best; killEnemy(S, R, b); if (!R.bossDead) out.push(RID + ': the boss\'s death does not open the way out');
          h.x = R.map.exit.x; h.y = R.map.exit.y; interact(S, R);
          if (S.screen !== 'win' || (S.result || {}).mode !== RID) out.push(RID + ': leaving after the boss is not a win of the run');
          if (S.meta.best !== best) out.push(RID + ': the run moved the campaign\'s floor record'); } }
      // the cave's water on foot (TASKS 302): the hero wades the shallows slower and neither walks nor dashes into deep water, a
      // monster knocked at deep water stops on the shore, a bolt flies on over it, and the monsters' way round goes over no deep cell
      { const Z = spawn(0, {}); Z.run = newRun(Z, 'cave', 3); Z.screen = 'play'; const R2 = Z.run, m = R2.map, h = R2.hero, W = m.W, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        // a dry cell with three cells of deep water beyond it, in a straight line
        let at0 = null; for (let k = 0; k < m.cells.length && !at0; k++) if (m.cells[k] === 1 && !m.water.includes(k)) for (const [dx, dy] of DIRS) if ([1, 2, 3].every((i) => m.cells[k + i * (dx + dy * W)] === 6)) { at0 = [k, dx, dy]; break; }
        if (!at0) out.push('cave water: no shore with deep water beyond it on floor 1'); else {
          const [k, dx, dy] = at0, x0 = (k % W + 0.5) * TILE, y0 = (Math.floor(k / W) + 0.5) * TILE, deepOn = (o) => cell(m, Math.floor(o.x / TILE), Math.floor(o.y / TILE)) === 6;
          R2.en = []; R2.msg = null; h.ifr = 1e9; h.x = x0; h.y = y0; let inDeep = false;
          const go = { right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0, keys: [] };
          for (let i = 0; i < 120; i++) { step(Z, Object.assign({}, go, { keys: i % 40 === 0 ? ['Space'] : [] })); if (deepOn(h)) inDeep = true; }
          if (inDeep) out.push('cave water: the hero walks or dashes into deep water');
          const E = ENEMIES.skeleton, e = { id: 78000, type: 'skeleton', x: x0, y: y0, vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'idle', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 };
          h.x = x0 - dx * 6 * TILE - dy * 6 * TILE; h.y = y0 - dy * 6 * TILE + dx * 6 * TILE; R2.en = [e]; inDeep = false; void E;
          for (let i = 0; i < 120; i++) { if (i % 20 === 0) { e.kbx = dx * 900; e.kby = dy * 900; } step(Z, { keys: [] }); if (deepOn(e)) inDeep = true; }
          if (inDeep) out.push('cave water: a monster is knocked into deep water');
          R2.en = []; R2.proj = [{ id: R2.nextId++, x: x0, y: y0 - 20, vx: dx * 250, vy: dy * 250, t0: Z.t, life: 3, dmg: 0, own: 'en', r: 6, k: 'hex' }]; const p = R2.proj[0]; let over = false;
          for (let i = 0; i < 60; i++) { step(Z, { keys: [] }); if (cell(m, Math.floor(p.x / TILE), Math.floor((p.y + 20) / TILE)) === 6 && !p.dead) over = true; }
          if (!over || p.dead) out.push('cave water: a bolt stops at deep water');
          const F = flow(m, k % W, Math.floor(k / W), 1); if (F.some((v, j) => v >= 0 && m.cells[j] === 6)) out.push('cave water: the monsters\' way runs over deep water'); }
        // shallows slow the hero as they do in the campaign's streams
        if (!m.water.length || !inWater(m, { x: (m.water[0] % W + 0.5) * TILE, y: (Math.floor(m.water[0] / W) + 0.5) * TILE })) out.push('cave water: its shallows are not wading water'); }
      // the magma caves' lava on foot (TASKS 401): the hero neither walks nor is knocked into it, a monster knocked into it burns away
      // and one knocked into the chasm falls, their loot lands on the bank; the crust bears the hero a while, cracks, melts under him
      // (it burns) and sets again; the monsters' way round never goes over lava or crust
      { const Z = spawn(0, {}); plainRun(Z); Z.screen = 'play'; const R2 = Z.run, m = R2.map, h = R2.hero, W = m.W, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const crustS = new Set(m.crust), lavaOn = (o) => cell(m, Math.floor(o.x / TILE), Math.floor(o.y / TILE)) === 3;
        // (five cells of lava ahead: a narrower channel between two floors is flown over by the knock)
        const bank = (pred, n = 3) => { for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 1) for (const [dx, dy] of DIRS) if (Array.from({ length: n }, (_, i) => i + 1).every((i) => pred(k + i * (dx + dy * W)))) return [k, dx, dy]; return null; };
        const mob = (x, y) => ({ id: R2.nextId++, type: 'skeleton', x, y, vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'idle', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 });
        const L0 = bank((k) => m.cells[k] === 3 && !crustS.has(k), 5), C0 = bank((k) => !!m.cliff && m.cells[k] === 0 && Math.floor(k / W) >= m.cliff[k % W]);
        if (!L0 || !C0) out.push('magma lava: no bank of lava or of the chasm on the first plain floor'); else {
          for (const [what, [k, dx, dy]] of [['lava', L0], ['chasm', C0]]) { const x0 = (k % W + 0.5) * TILE, y0 = (Math.floor(k / W) + 0.5) * TILE;
            R2.en = []; R2.msg = null; R2.drops = []; h.ifr = 1e9; h.x = x0; h.y = y0; h.kbx = h.kby = 0; let off = false;
            const go = { right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0 };
            for (let i = 0; i < 120; i++) { step(Z, Object.assign({}, go, { keys: i % 40 === 0 ? ['Space'] : [] })); if (cell(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)) !== 1) off = true; }
            if (off) out.push(`magma lava: the hero walks or dashes into the ${what}`);
            h.x = x0; h.y = y0; hurtHero(Z, R2, 1, x0 - dx * 30, y0 - dy * 30); for (let i = 0; i < 60; i++) step(Z, { keys: [] });
            if (cell(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE)) !== 1) out.push(`magma lava: a blow knocks the hero into the ${what}`);
            const e = mob(x0, y0); h.x = x0 - dx * 6 * TILE - dy * 6 * TILE; h.y = y0 - dy * 6 * TILE + dx * 6 * TILE; R2.en = [e]; const k0 = R2.kills;
            e.kbx = dx * 900; e.kby = dy * 900; for (let i = 0; i < 120 * 2.2; i++) step(Z, { keys: [] });
            if (e.deadT < 0 || R2.kills !== k0 + 1) out.push(`magma lava: a monster knocked into the ${what} is not gone in ${what === 'lava' ? DOOM.sink : DOOM.fall} s`);
            if (R2.drops.some((p) => cell(m, Math.floor(p.x / TILE), Math.floor(p.y / TILE)) !== 1)) out.push(`magma lava: a monster gone into the ${what} drops its loot off the floor`); } }
        const ck = m.crust.find((k) => [1, -1, W, -W].some((o) => m.cells[k + o] === 1 && m.cells[k + 2 * o] === 1));
        if (ck === undefined) out.push('magma lava: no crust by a wide bank on the first plain floor'); else {
          const x0 = (ck % W + 0.5) * TILE, y0 = (Math.floor(ck / W) + 0.5) * TILE, t0 = Z.t, hp0 = h.hp; R2.en = []; h.ifr = 0; h.x = x0; h.y = y0; m.melt = {}; let crackT = -1, meltT = -1, setT = -1, hpMin = hp0;
          for (let i = 0; i < 120 * 6; i++) { const q = m.melt[ck]; if (i < 120 * 1.7) { h.x = x0; h.y = y0; } else if (i === Math.round(120 * 1.7)) { const o = [1, -1, W, -W].find((d) => m.cells[ck + d] === 1); h.x = x0 + (o === 1 ? 2 : o === -1 ? -2 : 0) * TILE; h.y = y0 + (o === W ? 2 : o === -W ? -2 : 0) * TILE; }
            step(Z, { keys: [] }); h.ifr = 0; hpMin = Math.min(hpMin, h.hp);
            if (q && q.crackT !== undefined && crackT < 0) crackT = Z.t - t0; if (q && q.hot && meltT < 0) meltT = Z.t - t0; if (meltT > 0 && setT < 0 && !(m.melt[ck] && m.melt[ck].hot)) setT = Z.t - t0; }
          if (Math.abs(crackT - CRUST.stand) > 0.05 || Math.abs(meltT - CRUST.stand - CRUST.crack) > 0.05 || Math.abs(setT - meltT - CRUST.hot) > 0.05) out.push(`magma lava: the crust cracks at ${crackT.toFixed(2)} s, melts at ${meltT.toFixed(2)}, sets ${(setT - meltT).toFixed(2)} s later`);
          // (the lowest he comes to: a hero at full health with regeneration is back to it before the crust sets)
          if (hpMin >= hp0) out.push('magma lava: the crust melting under the hero does not burn him');
          if (!crustAt(m, ck)) out.push('magma lava: the crust does not bear the hero again once it sets');
          // (TASKS 484) a bank's crust melting under him leaves him in the lava to step out of, it does not drop him in
          if (Z.ev.some((e) => e.k === 'lavafall')) out.push('magma lava: a bank\'s crust drops the hero into the lava');
          // (TASKS 476) a hoard's thin crust melting under him drops him in: hurt by CRUST.fall of his health, alight, under CRUST.sink s,
          // then back on the firm ground he last stood on
          let Y = null; for (let sd = 1; sd < 40 && !Y; sd++) { const Q = spawn(0, {}); Q.run = newRun(Q, 'magma', sd); Q.screen = 'play';
            for (let f = 1; f <= 3 && !Y; f++) { enterFloor(Q, Q.run, f); const mq = Q.run.map, k = (mq.thin || []).find((n) => [1, -1, mq.W, -mq.W].some((o) => mq.cells[n + o] === 1)); if (k !== undefined) Y = [Q, k]; } }
          if (!Y) out.push('magma lava: no thin crust by a bank in 39 runs'); else { const [Q, k] = Y, R3 = Q.run, m3 = R3.map, h3 = R3.hero, W3 = m3.W, o = [1, -1, W3, -W3].find((d) => m3.cells[k + d] === 1);
            const x0 = (k % W3 + 0.5) * TILE, y0 = (Math.floor(k / W3) + 0.5) * TILE, sx0 = x0 + (o === 1 ? 1 : o === -1 ? -1 : 0) * TILE, sy0 = y0 + (o === W3 ? 1 : o === -W3 ? -1 : 0) * TILE;
            R3.en = []; m3.melt = {}; h3.hp = stats(h3, Q.meta).maxHp; h3.burn = 0; h3.safe = [sx0, sy0]; Q.ev = []; let fell = null, hp1 = h3.hp;
            for (let i = 0; i < 120 * 2 && !fell; i++) { h3.x = x0; h3.y = y0; h3.vx = h3.vy = 0; hp1 = h3.hp; step(Q, { keys: [] }); h3.ifr = 0; fell = Q.ev.find((e) => e.k === 'lavafall'); }
            if (!fell) out.push('magma lava: the hero does not fall through a thin crust melting under him');
            else { const lost = hp1 - h3.hp; if (lost < stats(h3, Q.meta).maxHp * CRUST.fall * 0.7) out.push(`magma lava: a fall into the lava takes only ${Math.round(lost)} health`);
              if (Math.hypot(h3.x - x0, h3.y - y0) > 2) out.push('magma lava: a fallen hero is moved at once, not under the lava a while');
              for (let i = 0; i < 120 * (CRUST.sink - 0.05); i++) step(Q, { keys: [], right: true });
              if (Math.hypot(h3.x - x0, h3.y - y0) > 2) out.push('magma lava: a fallen hero walks off under the lava');
              for (let i = 0; i < 120 * 0.1; i++) step(Q, { keys: [] });
              if (cell(m3, Math.floor(h3.x / TILE), Math.floor(h3.y / TILE)) !== 1 || Math.hypot(h3.x - sx0, h3.y - sy0) > 2) out.push('magma lava: after a fall the hero is not back on the firm ground he last stood on');
              if (!(h3.burn > Q.t)) out.push('magma lava: a fall into the lava does not set the hero alight'); } } }
        const F = flow(m, Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE), 1); if (F.some((v, j) => v >= 0 && m.cells[j] === 3)) out.push('magma lava: the monsters\' way runs over lava or crust'); }
      // the magma colossus (TASKS 413): it lies hidden in its lake, rises and wades ashore once the hero is in; the ring round the
      // lake is one way round for its body, before the 2nd phase's edge falls into lava and after; its pools keep their limits; the
      // fists leave it stuck and open; no rock of the rain falls in a slab's shelter; its death takes everything it left on the floor
      for (const sd of [3, 11, 23, 41]) { const Z = spawn(0, {}); Z.run = newRun(Z, 'magma', sd); Z.screen = 'play'; enterFloor(Z, Z.run, 4); const R2 = Z.run, m = R2.map, h = R2.hero, W = m.W, tag = `colossus seed ${sd}`;
        const b = R2.en.find((e) => e.type === 'boss_colossus'), E = ENEMIES.boss_colossus, B = D.BOSSES.boss_colossus, r = m.rooms[b ? b.room : 0];
        if (!b) { out.push(`${tag}: no colossus on the 4th`); continue; }
        if (cell(m, Math.floor(b.x / TILE), Math.floor(b.y / TILE)) !== 3 || !under(b)) out.push(`${tag}: it does not lie hidden in its lake`);
        const lake = (k) => Math.hypot(((k % W) + 0.5 - (r.cx + 0.5)) / D.ARCH.plateau.arena.lake[0], (Math.floor(k / W) + 0.5 - (r.cy + 0.5)) / D.ARCH.plateau.arena.lake[1]) < 1.15;
        // its clear cells hold one ring round the lake: the biggest piece reaches past the lake on all four sides
        const ring = () => { const a = wideClear(R2, b, E).a, seen = new Set(); let best = [];
          for (let k = 0; k < a.length; k++) if (a[k] && !seen.has(k)) { const q = [k]; seen.add(k); for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (a[n] && !seen.has(n)) { seen.add(n); q.push(n); } } if (q.length > best.length) best = q; }
          const xs = best.map((k) => k % W), ys = best.map((k) => Math.floor(k / W)), L = D.ARCH.plateau.arena.lake, cx = r.cx + 0.5, cy = r.cy + 0.5;
          const side = (f) => best.some((k) => f(k % W + 0.5 - cx, Math.floor(k / W) + 0.5 - cy));
          return side((x, y) => y < -L[1] && Math.abs(x) < 2) && side((x, y) => y > L[1] && Math.abs(x) < 2) && side((x, y) => x < -L[0] && Math.abs(y) < 2) && side((x, y) => x > L[0] && Math.abs(y) < 2) && xs.length > 0 && ys.length > 0; };
        if (!ring()) out.push(`${tag}: its body has no way round the lake`);
        h.ifr = 1e9; h.x = (r.cx + 0.5) * TILE; h.y = (r.y + r.h - 2.5) * TILE; R2.en = [b]; let t0 = -1, shore = -1;
        for (let i = 0; i < 120 * 12 && shore < 0; i++) { step(Z, { keys: [] }); if (t0 < 0 && b.st === 'emerge') t0 = Z.t; if (b.st !== 'idle' && b.st !== 'emerge' && b.st !== 'wade') shore = Z.t; }
        if (t0 < 0) out.push(`${tag}: it never rises when the hero walks into the arena`); else if (shore < 0 || shore - t0 > B.rise + 6) out.push(`${tag}: it does not come ashore (${shore < 0 ? 'never' : (shore - t0).toFixed(1) + ' s'})`);
        else if (!wideClear(R2, b, E).a[Math.floor(b.y / TILE) * W + Math.floor(b.x / TILE)] || onLava(m, b)) out.push(`${tag}: it comes ashore where it does not fit`);
        // the edge's fall keeps the ring whole, the ways in, the altar and the cover, and leaves the hero his way to the exit
        b.phase = 1; beginBossMove(Z, R2, b, 'shatter'); b.cdT = 1e9; for (let i = 0; i < 120 * 4; i++) { step(Z, { keys: [] }); h.ifr = 1e9; h.hp = 1e6; }
        if (!(m.arenaLava || []).length) out.push(`${tag}: the 2nd phase's edge does not fall into lava`);
        if (!ring()) out.push(`${tag}: after the edge falls its body has no way round the lake`);
        if (!arenaPath(m, b.room)) out.push(`${tag}: the edge's fall cuts the floor off from the exit`);
        if ((m.arenaLava || []).some((k) => m.decor.some((d) => d.cover && Math.abs(Math.floor(d.x / TILE) - k % W) <= 1 && Math.abs(Math.floor(d.y / TILE) - Math.floor(k / W)) <= 1))) out.push(`${tag}: the edge falls under a slab of cover`);
        if ((m.arenaLava || []).some(lake)) out.push(`${tag}: the edge's fall reaches the lake's shore`);
        // pools: none by the lake's shore, the ways in or the crossing, never more than the cap at once
        const M = B.moves.boulder; let near = 0;
        for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 1 && DG.roomAt(m, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE) === b.room && poolOk(R2, b, M, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE)) {
          if ([1, -1, W, -W].some((o) => m.cells[k + o] === 3 && !(m.arenaLava || []).includes(k + o) && lake(k + o))) near++; }
        if (near) out.push(`${tag}: a pool may lie on the lake's shore (${near} cells)`);
        R2.fires = []; b.st = 'chase'; for (let i = 0; i < 8; i++) { h.x = b.x + 120 + (i % 3) * 40; h.y = b.y + 60; colossusBoulder(Z, R2, b, M); for (let j = 0; j < 120; j++) { step(Z, { keys: [] }); h.ifr = 1e9; } b.cdT = 1e9; b.st = 'chase'; }
        if (R2.fires.filter((p) => p.src === b.id && p.kind === 'pool').length > M.cap) out.push(`${tag}: more pools than ${M.cap} at once`);
        // stuck after its fists and open to blows
        R2.fires = []; R2.rocks = []; h.x = b.x + 100; h.y = b.y; beginBossMove(Z, R2, b, 'fists'); for (let i = 0; i < 120 * (B.moves.fists.wind + B.moves.fists.duration + 0.05); i++) { step(Z, { keys: [] }); h.ifr = 1e9; }
        if (!(b.openUntil > Z.t)) out.push(`${tag}: its fists leave it no stuck window`); else { const x0 = b.x, y0 = b.y, hp0 = b.hp; h.x = b.x + 400; for (let i = 0; i < 60; i++) step(Z, { keys: [] });
          if (Math.hypot(b.x - x0, b.y - y0) > 3) out.push(`${tag}: it walks while stuck`);   // (a couple of pixels is its body settling off a wall, not a step)
          hitEnemy(Z, R2, b, 100, false, b.x + 50, b.y); if (Math.abs(hp0 - b.hp - 100 * B.moves.fists.open) > 0.6) out.push(`${tag}: no extra damage while it is stuck`);
          b.phase = 0; b.hp = b.max * 0.59; stepBossMove(Z, R2);
          if (b.phase !== 0) out.push(`${tag}: phase interrupts stuck window`); }
        // the rain: no rock in a slab's shelter
        b.phase = 2; R2.rocks = []; colossusRain(Z, R2, b, B.moves.rain); h.x = -999; h.y = -999;
        const cov = m.decor.filter((d) => d.cover); if (!cov.length) out.push(`${tag}: the arena has no slabs of cover`);
        if (R2.rocks.some((q) => q.x !== undefined && cov.some((d) => Math.hypot(q.x - d.x, q.y - d.y) < B.moves.rain.shelter - 15))) out.push(`${tag}: a rock of the rain falls in a slab's shelter`);
        // its death clears the floor
        colossusBoulder(Z, R2, b, M); R2.cracks.push({ id: 1, owner: b.id, x: b.x, y: b.y, a: 0, len: 100, w: 30, speed: 900, linger: 1, t0: Z.t, dmg: 0, hit: 1 }); b.hp = 1; killEnemy(Z, R2, b);
        if (!b.deathPose || b.deathPose.deadT >= 0 || b.deathPose.t0 !== b.t0 || b.deathPose.dist !== b.dist) out.push(`${tag}: death loses its live pose`);
        if ((R2.rocks || []).length || (R2.cracks || []).length || (m.arenaLava || []).length || R2.fires.some((p) => p.src === b.id)) out.push(`${tag}: its death leaves rocks, cracks, pools or lava on the floor`); }
      // the caves as the campaign's 9th–12th (TASKS 339): the demon lord on the 8th pays as a finale but opens the stairs, the 9th is
      // the caves' 1st at the campaign's depth with the same hero (level, kit, gold, bag), the 11th keeps the caves' exit guard and the
      // 10th and 11th their altars, the serpent holds the 12th and only his death wins the campaign; a run saved in the caves goes on there
      { const S2 = spawn(0, {}); S2.run = newRun(S2, 'campaign', 7); S2.screen = 'play'; const R2 = S2.run, h2 = R2.hero, NC = D.RUNS.cave;
        enterFloor(S2, R2, 8); h2.ifr = 1e9; h2.lvl = 11; h2.gold = 777; R2.drops = [];
        const lord = R2.en.find((e) => e.type === 'boss'); let want = '';
        if (!lord) out.push('campaign f8: no demon lord'); else {
          killEnemy(S2, R2, lord);
          if (R2.bossDead) out.push('campaign f8: the demon lord\'s death opens the way out of the campaign');
          if (R2.drops.filter((d) => d.kind === 'shard').reduce((n, d) => n + d.n, 0) !== 20) out.push('campaign f8: the demon lord does not pay the finale\'s 20 shards');
          if (R2.drops.filter((d) => d.kind === 'item').length + R2.chests.filter((c) => c.boss).reduce((n, c) => n + c.loot.length, 0) < LOOT.boss.length) out.push('campaign f8: the demon lord does not drop the finale\'s loot');
          if (!R2.map.shrines.length) out.push('campaign f8: no altar past the demon lord');
          R2.drops = []; want = JSON.stringify([h2.lvl, h2.xp, h2.gold, h2.eq, h2.bag, h2.perks, h2.ab]); h2.x = R2.map.exit.x; h2.y = R2.map.exit.y; interact(S2, R2);
          if (R2.leaving > 0) { R2.leaving = 0; SIMX.enterFloor(S2, R2, R2.floor + 1); }
          if (!S2.run || R2.floor !== 9) out.push(`campaign: the stairs past the demon lord lead to ${S2.run ? 'floor ' + R2.floor : 'the end of the run'}, not the 9th`);
          else {
            const m = R2.map;
            if (m.biome !== 'cave' || m.W !== NC.size[0][0] || m.H !== NC.size[0][1] || !m.crossings) out.push('campaign f9: not the caves\' first floor');
            if (JSON.stringify([h2.lvl, h2.xp, h2.gold, h2.eq, h2.bag, h2.perks, h2.ab]) !== want) out.push('campaign f9: the hero changed on the way down');
            if (dep(R2) !== 9) out.push(`campaign f9: depth ${dep(R2)}, not 9`);
            if (R2.en.some((e) => !D.BOSSES[e.type] && e.max < Math.round(D.ENEMIES[e.type].hp * BAL.hp * (1 + 0.5 * 8)))) out.push('campaign f9: a monster weaker than the 9th floor');
            if (!R2.msg || !R2.msg.s.includes('Этаж 9') || !(R2.msg.s + (R2.msg.chapter || '')).includes(NC.title)) out.push(`campaign f9: the floor's title is "${R2.msg && R2.msg.s}"`);
            for (let f = 10; f <= 12; f++) { enterFloor(S2, R2, f); const mf = R2.map, lf = f - 8;
              if ((mf.bossType || undefined) !== NC.boss(lf)) out.push(`campaign f${f}: boss ${mf.bossType}, the caves' ${lf}th has ${NC.boss(lf)}`);
              if (!NC.boss(lf) && !!NC.guard[lf] !== mf.enemies.some((e) => e.guard)) out.push(`campaign f${f}: exit guard does not match the caves' ${lf}th`);
              if (mf.shrines.length !== 1) out.push(`campaign f${f}: ${mf.shrines.length} altar(s)`);   // (the 12th a chapter's end as the 8th since the magma, TASKS 416)
              if (f === 11) { // a run saved here, through the browser's storage, goes on in the caves
                S2.saved = S2.run; S2.run = null; S2.screen = 'menu'; const S3 = spawn(1, JSON.parse(JSON.stringify(persist(S2)))), cb = UI.menu(true).find((q) => q.id === 'continue');
                step(S3, { keys: [], click: 1, px: cb.x + 10, py: cb.y + 10 });
                if (!S3.run || S3.run.floor !== 11 || S3.run.mode !== 'campaign' || S3.run.map.biome !== 'cave' || S3.screen !== 'play') out.push('campaign f11: a run saved in the caves does not go on there');
                else { for (let i = 0; i < 30; i++) step(S3, { keys: [] }); if (!S3.run || dep(S3.run) !== 11) out.push('campaign f11: the continued run breaks'); }
                S2.run = R2; S2.saved = null; S2.screen = 'play'; } }
            // (TASKS 416) the serpent closes its chapter as the demon lord does: the finale's pay and the stairs on to the magma caves,
            // the 13th their 1st at the campaign's depth with the same hero; the colossus holds the 16th and only its death wins
            const sp = R2.en.find((e) => e.type === 'boss_serpent'), best = S2.meta.best; h2.ifr = 1e9;
            if (!sp) out.push('campaign f12: no serpent');
            else { killEnemy(S2, R2, sp); if (R2.bossDead) out.push('campaign f12: the serpent\'s death opens the way out of the campaign');
              if (R2.drops.filter((d) => d.kind === 'shard').reduce((n, d) => n + d.n, 0) !== 20) out.push('campaign f12: the serpent does not pay the finale\'s 20 shards');
              if (R2.drops.filter((d) => d.kind === 'item').length + R2.chests.filter((c) => c.boss).reduce((n, c) => n + c.loot.length, 0) < LOOT.boss.length) out.push('campaign f12: the serpent does not drop the finale\'s loot');
              R2.drops = []; const want2 = JSON.stringify([h2.lvl, h2.xp, h2.gold, h2.eq, h2.perks, h2.ab]); h2.x = R2.map.exit.x; h2.y = R2.map.exit.y; interact(S2, R2);
              if (!(R2.leaving > 0)) out.push('campaign: no fade out on the stairs into the magma chapter'); R2.leaving = 0; SIMX.enterFloor(S2, R2, R2.floor + 1);
              if (!R2.msg || R2.msg.chapter !== D.RUNS.magma.name) out.push('campaign: no chapter banner on the 13th');
              if (!S2.run || R2.floor !== 13) out.push(`campaign: the stairs past the serpent lead to ${S2.run ? 'floor ' + R2.floor : 'the end of the run'}, not the 13th`);
              else { const NM = D.RUNS.magma;
                if (R2.map.biome !== 'magma' || R2.map.W !== NM.size[0][0] || dep(R2) !== 13 + (D.RUNS.campaign.chapters.find((c) => c.run === 'magma').shift || 0)) out.push(`campaign f13: not the magma caves' 1st at its depth (${R2.map.biome} ${R2.map.W} depth ${dep(R2)})`);
                if (JSON.stringify([h2.lvl, h2.xp, h2.gold, h2.eq, h2.perks, h2.ab]) !== want2) out.push('campaign f13: the hero changed on the way down');
                enterFloor(S2, R2, 16); const co = R2.en.find((e) => e.type === 'boss_colossus'); h2.x = R2.map.exit.x; h2.y = R2.map.exit.y; interact(S2, R2);
                if (!S2.run) out.push('campaign f16: the way out opens before the colossus dies');
                else if (!co) out.push('campaign f16: no colossus');
                else { killEnemy(S2, R2, co); if (!R2.bossDead) out.push('campaign f16: the colossus\'s death does not open the way out');
                  h2.x = R2.map.exit.x; h2.y = R2.map.exit.y; interact(S2, R2);
                  if (S2.screen !== 'win' || (S2.result || {}).mode !== 'campaign' || S2.result.floor !== 16) out.push('campaign: leaving after the colossus is not a campaign win');
                  if (S2.meta.best !== Math.max(best || 0, 16)) out.push('campaign: the win does not set the floor record to 16'); } } } } } }
      // the campaign's caves bring their kinds a floor sooner and more monsters to their first two floors (data.js RUNS chapters);
      // the caves' own run keeps its floors as they were
      { const kinds = (mode, f) => { const c = {}; let n = 0; for (let sd = 1; sd <= 12; sd++) for (const e of DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode }).enemies) { c[e.type] = 1; n++; } return [c, n / 12]; };
        const [c9, n9] = kinds('campaign', 9), [c1, n1] = kinds('cave', 1), [c10] = kinds('campaign', 10);
        if (!c9.crab || !c9.skel_archer || c9.skel_mage || !c10.skel_mage) out.push('campaign caves: the 9th does not bring crabs and archers, or the 10th its mages');
        if (c1.crab || c1.skel_archer) out.push('cave run: crabs or archers on its 1st floor');
        if (n9 < n1 * 1.3) out.push(`campaign f9: ${n9.toFixed(1)} monsters, the caves' 1st ${n1.toFixed(1)}: not denser`); }
      // a saved run is dropped only by a second press of the same button
      const fill = (S) => { for (let i = 1; i < D.SAVE_SLOTS; i++) S.saves[i] = newRun(S, 'cave', 40 + i); };
      const T = spawn(0, {}); T.saved = newRun(T, 'campaign', 5); fill(T); const c = UI.menu(true).find((q) => q.id === 'campaign'), v = UI.tests(true).find((q) => q.id === 'cave');
      const press = (S, b) => step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 }), toTests = (S) => { step(S, { keys: ['Backquote'] }); step(S, { keys: [] }); };
      press(T, c); step(T, { keys: [] }); toTests(T); press(T, v);
      if (T.run) out.push('cave: a press on another run\'s button drops the saved run');
      // the test runs' screen (TASKS 417, 1878): the main menu has neither a test run nor «Тесты», ` on the menu opens their screen,
      // «Назад» and Escape go back, and over a saved run a test run's button asks again before it drops the save
      const ids = UI.menu(true, 0, 0, true, true).map((b) => b.id); if (D.TEST_RUNS.some(([id]) => ids.includes(id)) || ids.includes('tests')) out.push('tests: the main menu still holds the test runs or «Тесты»');
      if (D.TEST_RUNS.some(([id]) => (!D.RUNS[id] && id !== 'town') || !UI.tests(false).some((b) => b.id === id))) out.push('tests: a test run missing from its screen');
      const U = spawn(0, {}); U.saved = newRun(U, 'campaign', 5); fill(U); toTests(U); if (U.screen !== 'tests') out.push('tests: ` on the menu does not open the test runs');
      press(U, UI.tests(true).find((b) => b.id === 'back')); if (U.screen !== 'menu') out.push('tests: «Назад» does not go back to the menu');
      toTests(U); step(U, { keys: ['Escape'] }); if (U.screen !== 'menu') out.push('tests: Escape does not go back to the menu');
      // TASKS 1878: a test run counts in no statistic and leaves no run journal, the campaign still does
      { const W = spawn(0, {}); W.screen = 'menu'; toTests(W); press(W, UI.tests(false).find((b) => b.id === 'cave')); if (W.screen === 'classes') press(W, UI.classes(W.meta).find((b) => b.id === 'go'));
        const R = W.run, m0 = JSON.stringify([W.meta.runs, W.meta.wins, W.meta.deaths, W.meta.best, W.meta.bestEndless, W.meta.stats]), l0 = W.logN || 0;
        if (!R || !R.test) out.push('tests: a run from the tests\' screen is not marked a test');
        else { W.screen = 'play'; for (let i = 0; i < 240; i++) step(W, { keys: [] }); R.kills += 3; SIMX.endRun(W, 'dead');
          if (JSON.stringify([W.meta.runs, W.meta.wins, W.meta.deaths, W.meta.best, W.meta.bestEndless, W.meta.stats]) !== m0) out.push('tests: a test run changes the statistics');
          if ((W.logN || 0) !== l0 || (W.result && W.result.log)) out.push('tests: a test run leaves a run journal'); }
        const C = spawn(0, {}); C.screen = 'menu'; press(C, UI.menu(false).find((b) => b.id === 'campaign')); if (C.screen === 'classes') press(C, UI.classes(C.meta).find((b) => b.id === 'go'));
        if (!C.run || C.run.test) out.push('tests: a campaign run is marked a test'); else { const r0 = C.meta.runs || 0; SIMX.endRun(C, 'dead'); if ((C.meta.runs || 0) !== r0 + 1 || !C.result.log) out.push('tests: a campaign run no longer counts or keeps its journal'); } }
      // «Что нового» (TASKS 1038): the changelog's top entry is the game's version, the screen scrolls to its end and no further, Escape leaves
      { if (!D.CHANGES.length || D.CHANGES[0].v !== D.VERSION) out.push('news: the changelog\'s top entry is not DATA.VERSION');
        const nb = UI.menu(true).find((b) => b.id === 'news'); press(U, nb); if (U.screen !== 'news') out.push('news: «Что нового» does not open its screen');
        const mx = UI.news(0).max; step(U, { keys: ['End'] }); step(U, { keys: ['ArrowDown'], wheel: 1 }); if (U.newsTop !== mx) out.push(`news: End scrolls to ${U.newsTop}, not ${mx}`);
        { const E = UI.news(mx); if (E.top + E.rows.length !== E.n) out.push('news: the end of the list does not show its last row'); }
        step(U, { keys: ['Home'] }); if (U.newsTop !== 0) out.push('news: Home does not go back to the top');
        // TASKS 1971: only the newest version opens unfolded, a press on a folded header unfolds it, the thumb drags the scroll, a
        // press on the track below the thumb scrolls down, and a second opening forgets what was unfolded
        { const at = (b, o = {}) => Object.assign({ keys: [], px: b.x + b.w / 2, py: b.y + b.h / 2 + SIMX.uiDy('news') }, o), rs = D.newsRows(U.newsOpen), vs = rs.filter((r) => r.k === 'ver');
          if (vs.length !== D.CHANGES.length || !vs[0].open || vs.slice(1).some((r) => r.open) || rs[1].k === 'ver' || rs[rs.length - 1].k !== 'ver') out.push('news: the list does not open with only the newest version unfolded');
          step(U, { keys: ['End'] }); const h1 = UI.news(U.newsTop, U.newsOpen).heads.find((h) => !U.newsOpen[h.v]);
          if (!h1 && D.CHANGES.length > 1) out.push('news: no folded version\'s header is shown at the end of the list');
          if (h1) { const n0 = rs.length; step(U, at(h1, { click: 1, press: 1 })); step(U, at(h1));
            if (!(U.newsOpen || {})[h1.v] || D.newsRows(U.newsOpen).length <= n0) out.push('news: a press on a folded version\'s header does not unfold it'); }
          step(U, { keys: ['Home'] }); const B = UI.news(0, U.newsOpen).bar;
          if (!B) out.push('news: the list has no scroll thumb');
          else { const T = B.thumb, gy = T.y + T.h / 2 + SIMX.uiDy('news'), gx = T.x + T.w / 2;
            step(U, { keys: [], px: gx, py: gy, click: 1, press: 1 }); for (let k = 1; k <= 4; k++) step(U, { keys: [], px: gx, py: gy + k * 60, press: 1 });
            const dr = U.newsTop; step(U, { keys: [], px: gx, py: gy + 240 });
            if (!(dr > 0)) out.push('news: dragging the scroll thumb does not scroll the list');
            step(U, { keys: ['Home'] }); const ty = B.track.y + B.track.h - 4 + SIMX.uiDy('news');
            step(U, { keys: [], px: gx, py: ty, click: 1, press: 1 }); step(U, { keys: [], px: gx, py: ty });
            if (U.newsTop !== UI.news(0, U.newsOpen).max) out.push(`news: a press at the track's end scrolls to ${U.newsTop}, not to the end`);
            step(U, { keys: ['Home'] }); step(U, { keys: [], px: gx, py: gy }); if (U.hover !== 'track') out.push(`news: the pointer over the scroll track does not light it (${U.hover})`);
            const N0 = UI.news(0, U.newsOpen), hv = N0.heads[0], o0 = JSON.stringify(U.newsOpen);
            if (N0.heads.some((h) => h.x + h.w > B.track.x)) out.push('news: a version header\'s press zone runs under the scroll track');
            if (hv) { const hy = hv.y + hv.h / 2 + SIMX.uiDy('news'); step(U, { keys: [], px: B.track.x + 2, py: hy, click: 1, press: 1 }); const grab = U.newsDrag != null; step(U, { keys: [], px: B.track.x + 2, py: hy });
              if (!grab || JSON.stringify(U.newsOpen) !== o0) out.push('news: a press on the track beside a version header folds the version instead of taking the thumb'); } }
          step(U, { keys: ['Escape'] }); press(U, UI.menu(true).find((b) => b.id === 'news'));
          if (Object.keys(U.newsOpen || {}).length !== 1 || U.newsTop) out.push('news: a second opening keeps what was unfolded or scrolled'); }
        step(U, { keys: ['Escape'] }); if (U.screen !== 'menu') out.push('news: Escape does not go back to the menu'); }
      toTests(U); const mg = UI.tests(true).find((b) => b.id === 'magma'); press(U, mg); step(U, { keys: [] });
      if (U.run || U.saved.mode !== 'campaign' || U.newAsk !== 'magma' || U.focus !== 'no') out.push('tests: one press over a saved run drops it or does not ask with «Нет» first');
      press(U, UI.newAsk().r.find((b) => b.id === 'yes')); if (U.screen === 'classes') press(U, UI.classes().find((b) => b.id === 'go')); noWelcome(U); if (!U.run || U.run.mode !== 'magma' || U.saved) out.push('tests: the second press does not start the test run'); }
    return out;
  }
  // a run snapshot for localStorage (the whole run is plain JSON)
  function chestCheck() { const out = [], { chapterEnd, finishArena } = root.SIMX; let bosses = 0;
    for (const sd of [31, 77]) for (let f = 1; f <= 8; f++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play';
      const R = S.run, c = R.chests.find((o) => o.boss), b = R.en.find((e) => D.BOSSES[e.type]); if (!b || !c) continue; bosses++;
      if (!c.sealed) out.push(`boss chest ${sd}/${f}: not sealed`);
      openChest(S, R, c); if (c.open) out.push(`boss chest ${sd}/${f}: opens with its boss alive`);
      const n = R.drops.length; finishArena(S, R, b); if (c.sealed) out.push(`boss chest ${sd}/${f}: still sealed after the win`); if (R.drops.length !== n) out.push(`boss chest ${sd}/${f}: the boss dropped its loot as well`);
      if (c.loot.length !== (chapterEnd(R, b) ? LOOT.boss : LOOT.mini.items).length) out.push(`boss chest ${sd}/${f}: holds ${c.loot.length} items`);
      R.drops = []; openChest(S, R, c); if (!c.open) out.push(`boss chest ${sd}/${f}: does not open after the win`);
      if (R.drops.some((d) => d.kind === 'gold') === chapterEnd(R, b)) out.push(`boss chest ${sd}/${f}: gold ${chapterEnd(R, b) ? 'in a finale\'s' : 'missing from a mid-chapter'} chest`); }
    if (bosses < 4) out.push(`boss chest: only ${bosses} boss floors had one`);
    let traps = 0;
    for (let sd = 1; sd <= 40 && !traps; sd++) for (let f = 2; f <= 8 && !traps; f++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 1357 + sd); enterFloor(S, S.run, f); S.screen = 'play'; const R = S.run, c = R.chests.find((o) => o.trap && o.sec === undefined); if (!c) continue; traps++;
      R.en = []; const h = R.hero, n = R.drops.length; h.x = c.x; h.y = c.y + 30; h.vx = h.vy = 0; h.ifr = 0; const hp0 = h.hp; openChest(S, R, c);
      if (!c.fuseT || R.drops.length === n) out.push('trap chest: no fuse or no loot on opening'); if (h.hp !== hp0) out.push('trap chest: hurts before its fuse');
      for (let k = 0; k < 90; k++) step(S, { keys: [] }); if (h.hp >= hp0) out.push('trap chest: the blast did not hurt the hero beside it'); if (c.fuseT) out.push('trap chest: fuse never ends');
      c.fuseT = S.t - 1; h.hp = 1; h.ifr = 0; h.x = c.x; h.y = c.y + 20; for (let k = 0; k < 4; k++) step(S, { keys: [] }); if (h.deadT >= 0) out.push('trap chest: killed the hero'); }
    if (!traps) out.push('trap chest: none on 40 seeds');
    { let coffins = 0; const p0 = D.COFFIN.p; D.COFFIN.p = () => 1;
      for (let sd = 1; sd <= 80 && !coffins; sd++) for (let f = 1; f <= 8 && !coffins; f++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 1353 + sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play'; const R = S.run, m = R.map, byR = {}; for (const d of m.decor) if (d.n === 'coffin' && d.r !== undefined) (byR[d.r] = byR[d.r] || []).push(d);
        const pair = Object.values(byR).find((l) => l.length >= 2); if (!pair) continue; coffins++; R.en = []; for (const d of pair) { S.t += 1; root.SIMX.coffinWakes(S, R, d); root.SIMX.coffinWakes(S, R, d); }
        if (R.en.length !== 1 || R.en[0].st !== 'rise' || R.en[0].type !== 'skeleton') out.push(`coffin: ${R.en.length} skeletons from one room`); const e = R.en[0]; if (e) { for (let k = 0; k < 150; k++) step(S, { keys: [] }); if (e.st === 'rise') out.push('coffin: its skeleton never finished rising'); }
        // TASKS 1686: a cleared floor lets nothing out of a coffin or a wreck
        { const st = root.SIMX.fstat(R), w0 = D.WRECK.loot; st.kills = st.foes; R.en = []; m.coffinR = {}; for (const d of pair) { d.rolled = 0; root.SIMX.coffinWakes(S, R, d); }
          D.WRECK.loot = 0; root.SIMX.hitWreck(S, R, { x: R.hero.x, y: R.hero.y, hits: D.WRECK.hp - 1 }); D.WRECK.loot = w0;
          if (R.en.length) out.push(`coffin: ${R.en.length} monsters let out on a cleared floor`); } }
      D.COFFIN.p = p0; if (!coffins) out.push('coffin: no room with two on 80 seeds'); }
    { let st = 0; for (let sd = 1; sd <= 200 && !st; sd++) for (const f of [1, 3, 5]) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 13540 + sd); if (f > 1) enterFloor(S, S.run, f); const R = S.run, m = R.map, i = m.secrets.findIndex((o) => o.kind === 'statue'); if (i < 0) continue; st = 1; S.screen = 'play'; const q = m.secrets[i], d = m.decor.find((o) => o.secret === i), x0 = d.x, h = R.hero; R.en = []; h.x = q.x; h.y = q.y + 70; h.vx = h.vy = 0; for (let k = 0; k < 10; k++) step(S, { keys: [] });
        step(S, { keys: ['KeyE'] }); if (!q.open || d.x !== x0 + q.slide.s * q.slide.n * TILE) out.push('statue: E does not slide it off its secret'); const to = Math.floor(d.y / TILE) * m.W + Math.floor(d.x / TILE), from = Math.floor(d.y / TILE) * m.W + Math.floor(x0 / TILE);
        if (!m.block.includes(from)) out.push('statue: its cell opens before the stone has slid off it'); const t1 = S.t + D.STATUE_SECRET.slide + 0.05; while (S.t < t1) step(S, { keys: [] }); if (!m.block.includes(to) || m.block.includes(from)) out.push('statue: the block did not move with it'); break; }
      if (!st) out.push('statue: no statue secret on 200 seeds'); }
    { let hosted = 0, alike = 0; for (let sd = 1; sd <= 16; sd++) for (const f of [1, 3, 5, 7]) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 13550 + sd); if (f > 1) enterFloor(S, S.run, f); const m = S.run.map; for (const q of m.secrets) { if (q.dir !== 'u') continue; const r = m.rooms.find((o) => o.id === q.host); if (!r) continue; hosted++; if (D.STATUE_SECRET.plans.includes(r.plan)) alike++; } }
      if (hosted && alike < hosted * 0.25) out.push(`dressed rooms: only ${alike} of ${hosted} top-wall secrets are in rooms dressed alike`); }
    for (const mode of ['campaign', 'cave']) for (let sd = 1; sd <= 16; sd++) for (const f of [1, 2, 4]) { const S = spawn(0, {}); S.run = newRun(S, mode, 13600 + sd); if (f > 1) enterFloor(S, S.run, f); const m = S.run.map;
      m.secrets.forEach((q, i) => { const P = q.trig; if (!P) return; const t = P.k === 'sconce' ? m.torches[P.t] : null, foot = t ? [Math.floor(t.x / TILE), Math.floor((t.y + 40) / TILE)] : P.k === 'lever' ? [Math.floor(P.x / TILE), Math.floor((P.y + 48) / TILE)] : [P.cx, P.cy], [fx, fy] = q.front[5], seen = new Map([[fy * m.W + fx, 0]]), st = [[fx, fy]]; let d = -1;
        while (st.length && d < 0) { const [x, y] = st.shift(), g = seen.get(y * m.W + x); if (x === foot[0] && y === foot[1]) { d = g; break; } if (g >= 12) continue; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (y + b) * m.W + x + a, c = cell(m, x + a, y + b); if ((c === 1 || c === 5) && !seen.has(k)) { seen.set(k, g + 1); st.push([x + a, y + b]); } } }
        if (d < 0) out.push(`secret ${mode} ${13600 + sd} f${f}#${i}: its ${P.k} is more than 12 steps from the wall it opens`); }); }
    let wrecks = 0;
    for (let sd = 1; sd <= 60 && !wrecks; sd++) for (let f = 1; f <= 4 && !wrecks; f++) { const S = spawn(0, {}); S.run = newRun(S, 'cave', 1361 + sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play'; const R = S.run, m = R.map, d = m.decor.find((o) => o.n === 'wreck_cv' && o.solid); if (!d) continue; wrecks++;
      R.en = []; R.drops = []; const n0 = R.en.length, k = Math.floor(d.y / TILE) * m.W + Math.floor(d.x / TILE); for (let i = 0; i < D.WRECK.hp; i++) { S.t += 1; root.SIMX.hitWreck(S, R, d); }
      if (!d.broken || d.solid) out.push('wreck: did not break on its last blow'); if (m.block.includes(k)) out.push('wreck: still blocks its cell');
      const items = R.drops.filter((o) => o.kind === 'item').length, ghosts = R.en.slice(n0).filter((e) => e.type === 'ghost'); if (!items && (ghosts.length < D.WRECK.ghosts[0] || ghosts.some((e) => e.elite))) out.push('wreck: gave neither loot nor a plain pack of ghosts'); }
    if (!wrecks) out.push('wreck: none on 60 seeds');
    let mims = 0;
    for (let sd = 1; sd <= 80 && !mims; sd++) for (let f = 3; f <= 8 && !mims; f++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 3670 + sd); enterFloor(S, S.run, f); S.screen = 'play'; const R = S.run, c = R.chests.find((o) => o.mimic); if (!c) continue; mims++;
      R.en = []; const h = R.hero, spot = [[0, 80], [80, 0], [-80, 0], [0, -80], [60, 60], [-60, 60]].find(([dx, dy]) => cell(R.map, Math.floor((c.x + dx) / TILE), Math.floor((c.y + dy) / TILE)) === 1 && losClear(R.map, c.x, c.y - 6, c.x + dx, c.y + dy - 6)); if (!spot) { mims--; continue; } h.x = c.x + spot[0]; h.y = c.y + spot[1]; h.ifr = 1e9; const items = c.loot.length, n0 = R.drops.length, A0 = lootAudit(R).off; openChest(S, R, c); const e = R.en.find((o) => o.type === 'mimic');
      if (!e || e.st !== 'rise' || R.drops.length !== n0 || c.loot.length !== items) out.push('mimic: did not wake holding its loot'); else { const hp0 = e.hp; hitEnemy(S, R, e, 100, false, h.x, h.y); if (hp0 - e.hp !== Math.round(100 * ENEMIES.mimic.riseGuard)) out.push(`mimic: a blow while it rises takes ${hp0 - e.hp} of 100, not ${100 * ENEMIES.mimic.riseGuard}`); e.hp = hp0; } if (solids(R).some((o) => o.x === c.x && o.y === c.y)) out.push('mimic: its chest still stands in the way');
      if (lootAudit(R).off !== A0) out.push('mimic: loot books off while it lives'); for (let k = 0; k < 300 && !R.en.some((o) => o.st === 'strike' && o.type === 'mimic'); k++) step(S, { keys: [] }); if (!R.en.some((o) => o.st === 'strike')) out.push('mimic: never bites');
      e.hp = 0; killEnemy(S, R, e); if (R.drops.filter((d) => d.kind === 'item').length < items || c.loot.length) out.push('mimic: its loot did not fall'); if (lootAudit(R).off !== A0) out.push('mimic: loot books off after it dies'); if (R.stats[f] && R.stats[f].kills > R.stats[f].foes + 1) out.push('mimic: counted among the floor\'s monsters'); }
    if (!mims) out.push('mimic: none on 80 seeds');
    return out; }
  SIMX.checks.add('secretCheck', secretCheck);
  SIMX.checks.add('altarCheck', altarCheck, { slow: true });
  SIMX.checks.add('secretRestCheck', secretRestCheck, { slow: true });
  SIMX.checks.add('chestCheck', chestCheck, { slow: true });
})(typeof window !== 'undefined' ? window : globalThis);
