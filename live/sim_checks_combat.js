// live/sim_checks_combat.js — selfCheck's parts for fights: the play loop, melee, reactions, hazards, the hero's death and attack speed. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    aggroRoom, arenaSealed, BAL, BASES, begin, boxHit, brinkOf, castAbility, cell, D, DG, DOOM, dropCell, DT, endRun, ENEMIES, enterFloor, heroHit,
    heroSt, hitEnemy, hitProps, hurtHero, inRoom1, inStart, interact, inWater, isCons, itemPower, K, killEnemy, lastFloor, LOOT, losClear, MOD, move,
    newRun, persist, reveal, REWARD, rollItem, scriptInput, solidAt, solidC, solids, spawn, stats, steer, step, stepArena, throwAway, TILE, toPx, UI,
    useItem, WADE, who } = SIMX;
  const { plainRun } = SIMX.checks.kit;
  function playCheck() {
    const out = [];
    // a saved run loaded into a fresh session must play at once (cooldowns and timers are absolute times)
    { const S = spawn(0, {}); begin(S); let snap = null;   // the last save of a living hero: the demo hero may fall before 40 s
      for (let i = 0; i < 120 * 40; i++) { step(S, scriptInput(S.t, S)); if (i % 120 === 0 && S.run && S.run.hero.hp > 0 && S.t > 10) snap = JSON.stringify(S.run); }
      if (!snap) out.push('save check: the demo hero never lives past 10 s');
      const T = spawn(0, { run: JSON.parse(snap || 'null') }); T.screen = 'play'; T.run = T.saved; if (T.run) T.run.hero.ifr = 1e9; for (let i = 0; i < 240; i++) step(T, { press: 1, px: 1000, py: 500, keys: [] });
      if (!T.ev.some((e) => e.k === 'swing')) out.push('a loaded save cannot attack (clock behind the saved timers)');
      const p0 = T.run.play; T.screen = 'pause'; for (let i = 0; i < 240; i++) step(T, { keys: [] }); T.screen = 'play'; step(T, { keys: [] });
      if (Math.abs(T.run.play - p0 - DT) > 1e-6) out.push(`run timer: 2 s on the pause screen added ${(T.run.play - p0).toFixed(2)} s of play`); }
    // a thrown-away item must not come straight back: it lands on another cell and is picked up only after the hero walks away and returns
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 60; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, it = rollItem(R, 1, 1); it.id = 99999; throwAway(R, h, it);
      for (let i = 0; i < 600; i++) step(S, { keys: [] });
      const p = R.drops.find((q) => q.item && q.item.id === 99999);
      if (!p) out.push('a thrown-away item was picked up again while the hero stood still');
      else { const hx = h.x, hy = h.y; h.x += 120; for (let i = 0; i < 10; i++) step(S, { keys: [] }); h.x = p.x; h.y = p.y; for (let i = 0; i < 30; i++) step(S, { keys: [] });
        if (!h.bag.some((b) => b && b.id === 99999) && !Object.values(h.eq).some((q) => q && q.id === 99999)) out.push('a thrown-away item cannot be picked up after walking away and back'); void hx; void hy; }
      // TASKS 1863 в, ж: the right button in the bag throws a piece away on its second press only, and E by it takes it back at once
      const k = h.bag.findIndex((b) => !b); h.bag[k] = Object.assign(rollItem(R, 1, 1), { id: 99998 }); S.screen = 'inv'; S.bagTab = 0;
      const c = UI.inv(D.clsOf(h).abs, h.bag.length, 0).r.find((q) => q.id === 'bag:' + k), rc = { keys: [], rclick: 1, px: c.x + 5, py: c.y + 5 };
      step(S, rc); if (!h.bag[k]) out.push('bag: the right button throws a piece away on one press'); step(S, rc);
      const tp = R.drops.find((q) => q.item && q.item.id === 99998); if (h.bag[k] || !tp) out.push('bag: a second right press does not throw it away');
      step(S, { keys: ['Escape'] }); for (let i = 0; i < 120; i++) step(S, { keys: [] }); step(S, { keys: ['KeyE'] });
      if (!h.bag.some((b) => b && b.id === 99998) && !Object.values(h.eq).some((q) => q && q.id === 99998)) out.push('a thrown-away item is not taken back by E beside it'); }
    // hazards: spikes hurt a monster standing on a raised plate; lava burns the hero; a monster knocked into lava burns, and none walks in
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      let R = S.run; for (let f = 1; f <= 6 && !R.map.traps.length; f++) enterFloor(S, R, f);
      const tr = R.map.traps[0], E = ENEMIES.skeleton, mk = (x, y) => ({ id: 77000 + R.en.length, type: 'skeleton', x, y, vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'idle', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 });
      if (tr) { R.en = [mk(tr.x, tr.y)]; const e = R.en[0]; R.hero.x = tr.x + 400; for (let i = 0; i < 120 * 3; i++) { e.x = tr.x; e.y = tr.y; e.st = 'idle'; step(S, { keys: [] }); }
        if (e.hp >= 999) out.push('spikes never hurt a monster standing on them'); void E; } else out.push('hazard check: no spike trap on floors 1–6');
      enterFloor(S, R, 5);
      const m = R.map, lv = []; for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.cells[y * m.W + x] === 3 && [1, -1, m.W, -m.W].some((d) => m.cells[y * m.W + x + d] === 1)) lv.push([x, y]);
      if (lv.length) { const [lx, ly] = lv[Math.floor(lv.length / 2)], h = R.hero; R.en = []; h.x = lx * TILE + 16; h.y = ly * TILE + 16; h.ifr = 0; const hp0 = h.hp = 1e4;
        for (let i = 0; i < 120 * 2; i++) { h.x = lx * TILE + 16; h.y = ly * TILE + 16; step(S, { keys: [] }); }
        if (h.hp >= hp0) out.push('standing in lava does not hurt the hero');
        h.x = lx * TILE + 400; const e = mk(lx * TILE + 16, ly * TILE + 16); R.en = [e]; for (let i = 0; i < 120 * 3; i++) step(S, { keys: [] });
        if (e.hp >= 999) out.push('a monster in lava does not burn');
        if (cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 3) out.push('a monster in lava does not walk out of it'); } else out.push('hazard check: no lava on floor 5'); }
    // gear for an empty slot is worn on pickup; for a taken slot it goes to the bag; potions always go to the bag
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 60; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, drop = (it) => R.drops.push({ id: R.nextId++, kind: 'item', item: it, x: h.x, y: h.y, vx: 0, vy: 0, z: 0, vz: 0, t0: R.t - 1 });
      const helm = Object.assign(rollItem(R, 1, 0, 'helm', { own: 1 }), { id: 88801 }), sword = Object.assign(rollItem(R, 1, 0, 'weapon'), { id: 88802 }), pot = { id: 88803, b: 'hp_potion', n: 1, rar: 0, lvl: 1, mods: {} };
      h.eq.helm = null; drop(helm); drop(sword); drop(pot); for (let i = 0; i < 5; i++) step(S, { keys: [] });
      if (!h.eq.helm || h.eq.helm.id !== 88801) out.push('an item for an empty slot was not worn on pickup');
      if (h.eq.weapon.id === 88802 || !h.bag.some((b) => b && b.id === 88802)) out.push('an item for a taken slot did not go to the bag');
      if (Object.values(h.eq).some((q) => q && q.id === 88803)) out.push('a potion was worn'); }
    // a monster that loses the hero gives up and walks back to its post; idle, it shifts about the spot but stays on it
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, m = R.map, e = R.en.find((o) => o.type !== 'boss' && !ENEMIES[o.type].ghost && ENEMIES[o.type].kind !== 'caster'); R.en = [e]; m.traps = [];
      for (let i = 0; i < 120 * 20; i++) step(S, { keys: [] });
      if (Math.hypot(e.x - e.hx, e.y - e.hy) > 24) out.push('an idle monster wandered off its post');
      const hx = e.hx, hy = e.hy, far = m.rooms.reduce((a, q) => Math.hypot(q.cx * TILE - hx, q.cy * TILE - hy) > Math.hypot(a.cx * TILE - hx, a.cy * TILE - hy) ? q : a), hide = () => { h.x = far.cx * TILE + 16; h.y = far.cy * TILE + 16; };
      h.ifr = 1e9; h.x = e.x + 60; h.y = e.y; aggroRoom(R, e); hide();
      let gaveUp = 0; for (let i = 0; i < 120 * 45 && e.st !== 'idle'; i++) { if (e.st === 'chase' && i % 60 === 0) hide(); step(S, { keys: [] }); gaveUp |= e.st === 'home'; }
      if (!gaveUp) out.push('a monster never gives up a hero hiding in a far room');
      else if (e.st !== 'idle' || Math.hypot(e.x - hx, e.y - hy) > 16) out.push(`a monster that lost the hero did not walk back to its post (${e.st}, ${Math.round(Math.hypot(e.x - hx, e.y - hy))} px off)`); }
    // elites: a blow never knocks one back; a fiery one's landed blow sets the hero burning and a vampire's heals it; a summoner
    // raises skeletons up to its cap and no further; an explosive corpse bursts once its fuse is out, hurting a hero in reach only
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, rm = R.map.rooms.filter((q) => q.type === 'combat' && !q.trap).sort((a, b) => b.w - a.w)[0], cx = (rm.x + rm.w / 2) * TILE, cy = (rm.y + rm.h / 2) * TILE;   // off the spike plates
      // (the 1st floor's rooms are 6–11 cells wide, TASKS 373: a fire priest 220 px off stood in the rock)
      { const m = R.map, X = Math.floor(cx / TILE), Y = Math.floor(cy / TILE), near = (o) => Math.abs(o.x / TILE - X) < 10 && Math.abs(o.y / TILE - Y) < 5;
        for (let y = Y - 4; y <= Y + 4; y++) for (let x = X - 9; x <= X + 9; x++) if (x > 1 && y > 2 && x < m.W - 2 && y < m.H - 2) m.cells[y * m.W + x] = 1;
        m.decor = m.decor.filter((o) => !near(o)); m.torches = m.torches.filter((o) => o.kind === 'wall' || !near(o)); m.webs = m.webs.filter((o) => !near(o)); m.traps = m.traps.filter((o) => !near(o)); m.block = []; R.chests = R.chests.filter((o) => !near(o)); R.pots = R.pots.filter((o) => !near(o)); }
      const put = () => { R.en = []; R.proj = []; h.hp = heroSt(S).maxHp; h.deadT = -1; h.burn = 0; h.ifr = 0; h.x = cx; h.y = cy; h.vx = h.vy = 0; h.pull = null; h.chillT = h.curseT = -9; };
      const el = (mods, dx, o) => { const e = Object.assign({ id: R.nextId++, type: 'skeleton', x: h.x + dx, y: h.y, vx: 0, vy: 0, hp: 400, max: 400, dmg: 5, elite: 1, mods, room: rm.id, st: 'chase',
        t0: S.t, face: -1, aimA: Math.PI, cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: S.t }, o); R.en.push(e); return e; };
      put(); const kb = el([], 40); hitEnemy(S, R, kb, 1, false, h.x, h.y); if (kb.kbx || kb.kby) out.push('an elite is knocked back by a blow');
      put(); const fv = el(['fiery', 'vampire'], 30, { hp: 200 }); let hit = 0;
      for (let i = 0; i < 120 * 3 && !hit; i++) { const a = h.hp; step(S, { keys: [] }); hit = h.hp < a; }
      if (!hit) out.push('an elite next to the hero never strikes it');
      else { if (!(h.burn > S.t)) out.push("a fiery elite's blow does not set the hero burning"); if (fv.hp <= 200) out.push("a vampire elite's blow does not heal it"); }
      put(); h.ifr = 1e9; const sm = el(['summoner'], 140, { cdT: 1e9 }); sm.sumT = S.t; let most = 0;
      for (let i = 0; i < 120 * 30; i++) { step(S, { keys: [] }); most = Math.max(most, R.en.filter((o) => o.summ === sm.id && o.deadT < 0).length); }
      if (most < 1) out.push('a summoner elite raises nothing'); if (most > MOD.summoner.cap) out.push(`a summoner elite keeps ${most} skeletons up, over its cap`);
      for (const [dx, near] of [[60, 1], [MOD.explosive.r + 30, 0]]) { put(); const ex = el(['explosive'], dx, { cdT: 1e9, hp: 1 }); hitEnemy(S, R, ex, 5, false, h.x, h.y); const a = h.hp;
        for (let i = 0; i < 120 * MOD.explosive.fuse * 0.8; i++) step(S, { keys: [] }); if (h.hp < a) out.push('an explosive elite bursts before its fuse is out');
        for (let i = 0; i < 120 * 0.5; i++) step(S, { keys: [] });
        if ((h.hp < a) !== !!near) out.push(near ? "an explosive elite's corpse does not hurt the hero in reach" : "an explosive elite's corpse hurts the hero out of reach"); }
      // the descent's deep powers (TASKS 387): a reflecting elite returns a tenth of the hero's blow and never his last point of
      // health; a warded one's shield takes a blow from before it and breaks under one from behind; a cursing one's blow cuts the
      // hero's blows for its time; a blinking one steps up to the hero from afar and holds its blow a moment
      put(); const rf = el(['reflect'], 40, { cdT: 1e9, hp: 4000, max: 4000 }); let a0 = h.hp; h.mp = 0, heroHit(S, R, rf, 300, false, h.x, h.y);
      if (a0 - h.hp !== Math.round(300 * MOD.reflect.k) || rf.hp !== 3700) out.push(`a reflecting elite returns ${a0 - h.hp} of a 300 blow`);
      h.hp = 5; h.mp = 0, heroHit(S, R, rf, 1000, false, h.x, h.y); if (h.hp !== 1) out.push('a reflecting elite kills the hero');
      put(); hitEnemy(S, R, el(['reflect'], 40, { cdT: 1e9, hp: 4000, max: 4000 }), 300, false, h.x, h.y); if (h.hp < heroSt(S).maxHp) out.push('a reflecting elite answers a blow that is not the hero\'s');
      put(); const wd = el(['ward'], 40, { cdT: 1e9, face: -1, ward: 100 }); h.mp = 0, heroHit(S, R, wd, 60, false, h.x, h.y);
      if (wd.hp !== 400 || wd.ward !== 40) out.push(`a ward does not take a blow from before (hp ${wd.hp}, ward ${wd.ward})`);
      h.mp = 0, heroHit(S, R, wd, 60, false, wd.x + 40, wd.y); if (wd.ward !== 0 || wd.hp !== 340) out.push(`a blow from behind does not break the ward (hp ${wd.hp}, ward ${wd.ward})`);
      put(); const cu = el(['curse'], 30, { hp: 4000, max: 4000 }); let cursed = 0;
      for (let i = 0; i < 120 * 3 && !cursed; i++) { step(S, { keys: [] }); cursed = h.curseT > S.t; }
      if (!cursed) out.push("a cursing elite's blow does not curse the hero");
      else { const c0 = cu.hp; cu.cdT = 1e9; h.mp = 0, heroHit(S, R, cu, 100, false, h.x, h.y); if (c0 - cu.hp !== Math.round(100 * MOD.curse.k)) out.push(`a cursed hero's blow of 100 does ${c0 - cu.hp}`);
        S.t = h.curseT + 0.01; const c1 = cu.hp; h.mp = 0, heroHit(S, R, cu, 100, false, h.x, h.y); if (c1 - cu.hp !== 100) out.push('a curse outlasts its time'); }
      put(); h.ifr = 1e9; const bd = [200, -200, 170, -170].find((dx) => losClear(R.map, h.x + dx, h.y - 10, h.x, h.y - 10)) || 200, bl = el(['blink'], bd, { cdT: 0, blinkT: S.t }); let jumped = 0;
      for (let i = 0; i < 120 * MOD.blink.every && !jumped; i++) { const bx = bl.x; step(S, { keys: [] }); jumped = Math.abs(bl.x - bx) > 40; }
      if (!jumped) out.push('a blinking elite never steps up to the hero');
      else if (Math.hypot(bl.x - h.x, bl.y - h.y) > MOD.blink.gap + 30 || bl.cdT < S.t + MOD.blink.calm - 0.05 || boxHit(R.map, bl.x, bl.y, ENEMIES.skeleton.r, true, false)) out.push('a blinking elite lands off the hero, in rock or striking at once');
      // frost and tug (TASKS 477): a frost elite's blow slows the hero for its time; a tugging one warns, then draws him in to short of
      // its reach, never through it; a dash under way at the tug slips it
      put(); const fr = el(['frost'], 30, { hp: 4000, max: 4000 }); let chilled = 0; for (let i = 0; i < 120 * 3 && !chilled; i++) { step(S, { keys: [] }); chilled = h.chillT > S.t; }
      if (!chilled) out.push("a frost elite's blow does not chill the hero");
      else { R.en = []; const t1 = h.chillT - S.t, walk = (chill) => { h.x = cx - 100; h.y = cy; h.vx = h.vy = 0; h.burn = 0; h.poison = 0; h.hurtT = -9; h.slowT = -9; h.chillT = chill ? S.t + t1 : -9;
          const x0 = h.x; for (let i = 0; i < 60; i++) step(S, { right: 1, px: 1400, py: 540, keys: [] }); return h.x - x0; };
        const slow = walk(1), fast = walk(0);
        if (!(slow < fast * (MOD.frost.slow + 0.1) && slow > fast * (MOD.frost.slow - 0.1))) out.push(`a chilled hero walks ${Math.round(slow)} px against ${Math.round(fast)}`); }
      const tugAt = (dash) => { put(); h.ifr = 1e9; const dx = [220, -220, 180, -180].find((q) => losClear(R.map, h.x + q, h.y - 10, h.x, h.y - 10)) || 220, tg = el(['tug'], dx, { cdT: 1e9, tugT: S.t }), x0 = h.x;
        let warned = 0, pulled = 0; for (let i = 0; i < 120 * 1.5 && !pulled; i++) { if (dash && tg.tugW && tg.tugW - S.t < 0.1 && h.dashT < S.t - 1) h.dashT = S.t; step(S, { keys: [] }); warned ||= !!tg.tugW; pulled = !!h.pull; tg.x = x0 + dx; }
        for (let i = 0; i < 120; i++) { step(S, { keys: [] }); tg.x = x0 + dx; } return { warned, pulled, moved: Math.abs(h.x - x0), gap: Math.abs(tg.x - h.x) }; };
      const tg1 = tugAt(false), tg2 = tugAt(true);
      if (!tg1.warned || !tg1.pulled || tg1.moved < 40 || tg1.gap < ENEMIES.skeleton.r + K.R) out.push(`a tugging elite does not warn and draw the hero in short of itself (${JSON.stringify(tg1)})`);
      if (tg2.pulled) out.push('a dash does not slip the tug');
      { put(); h.ifr = 1e9; const dx = [220, -220, 180, -180].find((q) => losClear(R.map, h.x + q, h.y - 10, h.x, h.y - 10)) || 220, tg = el(['tug'], dx, { cdT: 1e9, tugT: S.t }), x0 = h.x;
        for (let i = 0; i < 120 && !tg.tugW; i++) { step(S, { keys: [] }); tg.x = x0 + dx; }
        const due = tg.tugW; tg.st = 'wind'; tg.t0 = S.t; let at = 0; for (let i = 0; i < 120 && !at; i++) { step(S, { keys: [] }); tg.x = x0 + dx; if (h.pull) at = S.t; }
        if (!due || !at || at > due + 2 * DT) out.push(`a tug put off by a blow begun in its warning (due ${due && due.toFixed(2)}, landed ${at && at.toFixed(2)})`); }
      // the whirl's hint (TASKS 390): shown by a crowd with the whirl ready, not once the player has whirled enough
      const tipped = (n) => { put(); S.meta.whirls = n; R.tipT = undefined; R.msg = null; h.ab.whirl = h.ab.whirl || 1; h.cd.whirl = 0; h.ifr = 1e9;
        for (const [dx, dy] of [[40, 0], [-40, 0], [0, 30]]) el([], dx, { y: h.y + dy, cdT: 1e9 }); step(S, { keys: [] }); return !!(R.msg && R.msg.tip === 'whirl'); };
      if (!tipped(0)) out.push('no whirl hint by a crowd'); if (tipped(D.TIPS.whirl.until)) out.push('the whirl hint shows to a player who has whirled enough');
      { const t0 = R.test; R.test = 1; R.whirls = D.TIPS.whirl.until; if (tipped(0)) out.push('the whirl hint keeps coming back on a test run that has whirled enough'); R.test = t0; R.whirls = 0; }
      const sw = S.meta.whirls; castAbility(S, R, 'whirl', {}); if (S.meta.whirls !== sw + 1) out.push('a whirl is not counted for the hint');
      // a test run's whirls stop its hint by the run's own count, the meta's untouched (review of PR 63)
      { const t0 = R.test, rw = R.whirls || 0; R.test = 1; h.cd.whirl = 0; h.mp = 1e9; castAbility(S, R, 'whirl', {});
        if (R.whirls !== rw + 1 || S.meta.whirls !== sw + 1) out.push(`a test run's whirl is not counted by the run, or is by the meta (${R.whirls}, ${S.meta.whirls})`); R.test = t0; R.whirls = 0; }
      // the deep powers come up only in the endless descent past ELITE.deepFrom, and a caster or archer never blinks
      const deep = D.ELITE_MODS.filter((q) => q.deep).map((q) => q.id);
      if (D.modPool('campaign', 12, 'melee').some((id) => deep.includes(id)) || D.modPool('endless', D.ELITE.deepFrom, 'melee').some((id) => deep.includes(id)) || !deep.every((id) => D.modPool('endless', D.ELITE.deepFrom + 1, 'melee').includes(id))
        || D.modPool('endless', 20, 'caster').includes('blink')) out.push('the deep elite powers come up off the deep descent, or a caster blinks');
      // the smouldering skeleton (TASKS 411): beside the hero it lights its fuse, stands, and bursts at its end; killed short of him its
      // bones burst all the same once the fuse is out; its blast takes a share of each monster's health within reach, none beyond,
      // and sets off another smouldering one in it
      { const B = ENEMIES.skel_ember.boom, W = ENEMIES.skel_ember.wind, sk = (dx, o) => el([], dx, Object.assign({ type: 'skel_ember', elite: 0, hp: 18, max: 18, dmg: 5 }, o));
        put(); const a1 = sk(40); let litT = -1, x0 = 0, a = h.hp;
        for (let i = 0; i < 120 * 2 && a1.deadT < 0; i++) { step(S, { keys: [] }); if (litT < 0 && a1.st === 'wind') { litT = S.t; x0 = a1.x; } if (litT < 0 && h.hp < a) break; }
        if (litT < 0) out.push('a smouldering skeleton beside the hero never lights its fuse');
        else { if (a1.deadT < 0 || Math.abs(a1.deadT - litT - W) > 2 * DT) out.push(`a smouldering skeleton bursts ${a1.deadT < 0 ? 'never' : (a1.deadT - litT).toFixed(2) + ' s'} after lighting, not ${W} s`);
          if (Math.abs(a1.x - x0) > 6) out.push('a smouldering skeleton walks on with its fuse lit'); if (!(h.hp < a)) out.push("a smouldering skeleton's burst does not hurt the hero beside it"); }
        put(); const a2 = sk(60, { st: 'idle' }); a = h.hp; hitEnemy(S, R, a2, 100, false, h.x, h.y); const dx2 = a2.x - h.x;
        if (!(a2.fuse > S.t)) out.push('a smouldering skeleton killed lights no fuse');
        for (let i = 0; i < 120 * B.fuse * 0.8; i++) { step(S, { keys: [] }); h.x = a2.x - dx2; h.vx = h.vy = 0; } if (h.hp < a) out.push("a smouldering skeleton's bones burst before the fuse is out");
        for (let i = 0; i < 120 * 0.4; i++) { step(S, { keys: [] }); h.x = a2.x - dx2; h.vx = h.vy = 0; } if (!(h.hp < a)) out.push("a smouldering skeleton's bones never burst by the hero");
        put(); h.ifr = 1e9; R.boomT = -9; const a3 = sk(0, { st: 'wind', t0: S.t, fuse: S.t + 0.05 }), mk = (dy, type) => el([], 0, { type, elite: 0, hp: 200, max: 200, dmg: 1, y: h.y + dy, st: 'idle', cdT: 1e9 });
        const nearM = mk(B.r - 20, 'goblin'), farM = mk(-(B.r + 40), 'goblin'), a4 = mk(-(B.r - 30), 'skel_ember');
        for (let i = 0; i < 12; i++) step(S, { keys: [] });
        if (a3.deadT < 0) out.push("a smouldering skeleton's lit fuse never runs out");
        if (Math.abs(nearM.max - nearM.hp - Math.round(nearM.max * B.mon)) > 1) out.push(`a smouldering skeleton's blast takes ${nearM.max - nearM.hp} of a monster's ${nearM.max} in reach, not ${B.mon * 100}%`);
        if (farM.hp < farM.max) out.push("a smouldering skeleton's blast hurts a monster out of reach");
        if (!(a4.fuse > S.t - 0.1)) out.push("a smouldering skeleton's blast does not set off another in reach");
        // (TASKS 1865) one lit and sinking in the lava bursts at its ring's end, not never
        put(); R.boomT = -9; const fz = S.t + 0.3, a5 = sk(140, { st: 'wind', t0: S.t, fuse: fz, sinkT: S.t });
        for (let i = 0; i < 120 * 0.6 && a5.deadT < 0; i++) step(S, { keys: [] });
        if (!a5.blown || Math.abs(a5.deadT - fz) > 2 * DT) out.push(`a lit smouldering skeleton sinking in the lava ${a5.blown ? 'bursts ' + (a5.deadT - fz).toFixed(2) + ' s off its ring' : 'never bursts'}`);
        // (PR 79 review) one lit and falling into the chasm is gone with the fall, its fuse not held back by a blast just before its end
        put(); R.boomT = -9; const fz6 = S.t + DOOM.fall + 0.2, a6 = sk(140, { st: 'wind', t0: S.t, fuse: fz6, fallT: S.t }); let boom6 = -1;
        for (let i = 0; i < 120 * (DOOM.fall + 0.5) && boom6 < 0; i++) { if (Math.abs(S.t - (fz6 - 0.1)) < DT / 2) R.boomT = S.t; step(S, { keys: [] }); if (!(a6.fuse > 0)) boom6 = S.t; }
        if (a6.deadT < 0 || a6.deadT > a6.fallT + DOOM.fall + 2 * DT) out.push('a lit smouldering skeleton falling into the chasm stays in the fight past the fall');
        if (boom6 < 0 || Math.abs(boom6 - fz6) > 2 * DT) out.push(`a lit smouldering skeleton falling into the chasm ${boom6 < 0 ? 'never bursts' : 'bursts ' + (boom6 - fz6).toFixed(2) + ' s off its ring'}`);
        // (PR 79 review) an explosive elite fallen into the chasm keeps BOOM_GAP after a blast put off by the hit-stop (TASKS 1051)
        put(); R.boomT = -9; const fz7 = S.t + 0.2, a7 = el(['explosive'], 140, { deadT: S.t, fallT: S.t - DOOM.fall, fuse: fz7 }); let boom7 = -1, late7 = -1;
        for (let i = 0; i < 120 && boom7 < 0; i++) { if (late7 < 0 && S.t >= fz7 - 0.1) late7 = R.boomT = S.t; step(S, { keys: [] }); if (!(a7.fuse > 0)) boom7 = S.t; }
        if (boom7 < 0 || boom7 - late7 < 0.35 - DT / 2) out.push(`an explosive elite fallen into the chasm ${boom7 < 0 ? 'never bursts' : 'bursts ' + (boom7 - late7).toFixed(2) + ' s after another blast, under BOOM_GAP'}`);
        h.ifr = 0; }
      // the fire priest (TASKS 410): its ring falls where the hero stood, hurts him only after its warning and only if he stays, and
      // sets him alight; it sets alight the weapon of an ally in the fight near it, whose blows then hit harder and set the hero burning
      { const P = ENEMIES.fire_priest.pyre, pr = (o) => el([], 220, Object.assign({ type: 'fire_priest', elite: 0, hp: 100, max: 100, dmg: 10, cdT: 0, kinT: 1e9 }, o));
        for (const stay of [1, 0]) { put(); const p = pr(); let a = h.hp, at = -1, early = 0;
          for (let i = 0; i < 120 * 3 && h.hp === a; i++) { step(S, { keys: [] }); if (at < 0 && R.pyres.length) { at = S.t; if (!stay) h.x -= 3 * P.r; }
            if (at >= 0 && S.t - at < P.warn - DT && h.hp < a) early = 1; if (p.st === 'chase' && at >= 0) p.cdT = 1e9; }
          if (at < 0) { out.push('a fire priest in reach never casts its ring'); break; }
          if (early) out.push("a fire priest's ring burns before its warning is out");
          if (stay && !(h.hp < a)) out.push("a fire priest's ring does not hurt the hero standing in it");
          if (stay && !(h.burn > S.t)) out.push("a fire priest's ring does not set the hero burning");
          if (!stay && h.hp < a) out.push("a fire priest's ring hurts a hero who stepped out of it"); }
        put(); h.ifr = 1e9; const p2 = pr({ kinT: S.t, cdT: 1e9 }), ally = el([], 120, { elite: 0, hp: 100, max: 100, dmg: 10, cdT: 1e9, x: p2.x - 60, y: h.y + 40 });
        for (let i = 0; i < 120 * 2 && !(ally.fireT > S.t); i++) step(S, { keys: [] });
        if (!(ally.fireT > S.t)) out.push("a fire priest never sets alight an ally's weapon");
        else { h.ifr = 0; let hurt = [0, 0], burnt = 0;
          for (const lit of [0, 1]) for (let k = 0; k < 20 && !hurt[lit]; k++) { const keep = ally.fireT; if (!lit) ally.fireT = 0; h.hp = heroSt(S).maxHp; h.burn = 0; h.ifr = 0; h.mp = 0;
            hurtHero(S, R, 40, ally.x, ally.y, undefined, who(ally), ally); hurt[lit] = heroSt(S).maxHp - h.hp; if (lit) burnt = h.burn > S.t; ally.fireT = keep; }
          if (!(hurt[1] > hurt[0] * 1.15)) out.push(`a blow of an ally with its weapon alight is no harder (${hurt[0]} → ${hurt[1]})`);
          if (!burnt) out.push("a blow of an ally with its weapon alight does not set the hero burning"); }
        h.ifr = 0; R.pyres = []; }
      // no blow takes more than its cap of the health: the real strike of an elite of every kind (a caster's bolt, the boss's moves)
      // and an explosive corpse's blast, on the first and the last floor
      const f0 = R.floor, first = (secs) => { const mx = heroSt(S).maxHp; let lost = 0;
        for (let i = 0; i < 120 * secs && !lost; i++) { const a = h.hp; step(S, { keys: [] }); lost = (a - h.hp) / mx; } return lost; };
      for (const f of [1, D.RUNS.campaign.floors]) { R.floor = f;
        for (const type in ENEMIES) { if (type === 'boss_serpent') continue; put(); el([], type === 'cultist' ? 120 : 40, { type, dmg: 1e5 }); const l = first(D.BOSSES[type] ? 12 : 6), cap = D.BOSSES[type] ? BAL.cap.boss : BAL.cap.blow;
          if (!l) out.push(`f${f}: an elite ${type} never strikes the hero`); else if (l > cap + 0.01) out.push(`f${f}: an elite ${type}'s blow takes ${Math.round(l * 100)}% of the health, over ${cap * 100}%`); }
        put(); const ex = el(['explosive'], 60, { cdT: 1e9, hp: 1, dmg: 1e5 }); hitEnemy(S, R, ex, 5, false, h.x, h.y); const l = first(MOD.explosive.fuse + 0.5);
        if (l > BAL.cap.blow + 0.01) out.push(`f${f}: an explosive corpse takes ${Math.round(l * 100)}% of the health, over the cap`); }
      R.floor = f0;
      // a volley wounds once, and a bolt of an earlier volley still in flight does not wound again after a later volley's bolt
      const bolt = (vol, dx) => { const p = { id: R.nextId++, vol, who: 'boss', k: 'fire', x: h.x + dx, y: h.y - 38, vx: 0, vy: 0, t0: S.t, life: 2, dmg: 10, own: 'en', r: 9 }; R.proj.push(p); return p; };
      const wounds = (n) => { let w = 0; for (let i = 0; i < n; i++) { step(S, { keys: [] }); w += S.ev.filter((q) => q.k === 'hurt' && q.t === S.t && q.src === 'boss bolt').length; } return w; };
      put(); bolt(1e7, 0); bolt(1e7, 4); let w = wounds(12);
      if (w !== 1 && !S.ev.some((q) => q.k === 'dodge')) out.push(`two bolts of one boss volley wound the hero ${w} times, not once`);
      put(); bolt(2e7, 0); bolt(3e7, 0); const late = bolt(2e7, 100); w = wounds(12); late.x = h.x; late.y = h.y - 38; w += wounds(12);
      if (w !== 2 && !S.ev.some((q) => q.k === 'dodge')) out.push(`bolts of two interleaved volleys wound the hero ${w} times, not twice`); }
    // the hero and a monster side by side against the same wall above them still reach each other
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, m = R.map, h = R.hero, rm = m.rooms.find((q) => q.id !== m.start && q.w >= 6 && [1, 2, 3].every((d) => cell(m, q.x + 2, q.y - d) === 0)), y = rm.y * TILE + 5, x = (rm.x + 2) * TILE;
      if (!losClear(m, x, y, x + 40, y)) out.push('two actors against the same wall cannot reach each other along it');
      if (losClear(m, x, y, x, y - 3 * TILE)) out.push('a line straight up through the wall above a room is clear'); }
    // floors meeting only at a corner: the generator leaves none, and a line through such a corner is shut (TASKS 174)
    { const pm = { W: 4, H: 4, cells: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0] };
      if (losClear(pm, 1.5 * TILE, 1.5 * TILE, 2.5 * TILE, 2.5 * TILE)) out.push('a line through the corner of two walls is clear');
      for (let f = 1; f <= D.RUNS.campaign.chapter; f++) for (let s = 1; s <= 8; s++) { const m = DG.genFloor(s * 131 + f, f), so = (x, y) => solidC(m, x, y); let n = 0;
        for (let y = 0; y < m.H - 1; y++) for (let x = 0; x < m.W - 1; x++) if (so(x, y) === so(x + 1, y + 1) && so(x + 1, y) === so(x, y + 1) && so(x, y) !== so(x + 1, y)) n++;
        if (n) out.push(`floor ${f} seed ${s * 131 + f}: ${n} floors meet only at a corner`); } }
    // a cultist's fire hex (lava floors) sets the hero burning for a few ticks; the plain hex does not
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, rm = R.map.rooms.find((q) => q.id !== R.map.start); R.en = []; h.hp = h.base.vit * 100; h.ifr = 0;
      h.x = (rm.x + rm.w / 2) * TILE; h.y = (rm.y + rm.h / 2) * TILE; h.vx = h.vy = 0;
      const shot = (k) => { R.proj = [{ id: R.nextId++, k, x: h.x, y: h.y - 38, vx: 0, vy: 0, t0: S.t, life: 1, dmg: 5, own: 'en', r: 6 }]; h.ifr = 0; step(S, { keys: [] }); };
      shot('hex'); const a0 = h.hp; for (let i = 0; i < 120 * 2; i++) step(S, { keys: [] }); if (h.hp < a0 || h.burn > S.t) out.push('a plain hex sets the hero burning');
      shot('fire'); const b0 = h.hp; for (let i = 0; i < 120 * 2; i++) step(S, { keys: [] }); if (h.hp >= b0) out.push('a fire hex does not set the hero burning');
      // the scene tells a bolt that struck the hero from one that hit a wall
      if (!S.ev.some((e) => e.k === 'pop' && e.hero)) out.push('a bolt hitting the hero is not marked on its pop event');
      // a scroll's pillar of light shows at both ends of the jump
      const fx = h.x, fy = h.y; h.bag[0] = { b: 'scroll', n: 1, id: 88001 }; useItem(S, R, 0); const tp = S.ev.find((e) => e.k === 'teleport');
      if (!tp || tp.fx !== fx || tp.fy !== fy) out.push('a teleport event does not carry where the hero left from'); }
    // the boss roars as he first sees the hero
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run; enterFloor(S, R, D.RUNS.campaign.chapter); const b = R.en.find((e) => e.type === 'boss'), h = R.hero; R.en = [b]; h.x = b.x; h.y = b.y + 160; h.ifr = 1e9;
      for (let i = 0; i < 60; i++) step(S, { keys: [] }); if (!S.ev.some((e) => e.k === 'roar')) out.push('the boss does not roar when he first sees the hero'); }
    // shallow water: the hero wades slower, a burning hero stepping in is put out, and no prop, chest or monster post stands in it
    { const S = spawn(0, {}); begin(S); const R = S.run, h = R.hero; let tested = false;
      for (let f = 1; f <= D.RUNS.campaign.chapter && !tested; f++) { enterFloor(S, R, f); const m = R.map; if (!m.water.length) continue; tested = true; const wet = new Set(m.water), k0 = m.water[Math.floor(m.water.length / 2)], foe = structuredClone(R.en.find((e) => !ENEMIES[e.type].ghost));
        const on = (o) => wet.has(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE));
        for (const o of [...R.chests, ...R.pots, ...m.decor.filter((d) => d.solid), ...m.torches.filter((t) => t.kind !== 'wall'), ...R.en]) if (on(o)) out.push(`water check floor ${f}: ${o.type || o.kind || o.n || 'chest'} stands in the water`);
        const run = (x, y) => { R.en = []; h.vx = h.vy = 0; for (let i = 0; i < 60; i++) { h.x = x; h.y = y; step(S, { keys: [], right: 1 }); } return h.vx; };
        const sp = m.spawn; S.ev = []; const vDry = run(sp.x, sp.y);
        if (!S.ev.some((e) => e.k === 'step' && !e.wet)) out.push('water check: dry steps are missing');
        S.ev = []; const vWet = run((k0 % m.W + 0.5) * TILE, (Math.floor(k0 / m.W) + 0.5) * TILE);
        if (!S.ev.some((e) => e.k === 'step' && e.wet)) out.push('water check: wet steps are missing');
        if (!(vWet < vDry * 0.85)) out.push(`water check floor ${f}: wading ${Math.round(vWet)} px/s is not slower than ${Math.round(vDry)}`);
        h.burn = S.t + 3; S.ev = []; step(S, { keys: [] }); if (h.burn > S.t || !S.ev.some((e) => e.k === 'douse')) out.push(`water check floor ${f}: the water does not put out a burning hero`);
        S.ev = []; step(S, { keys: [] }); if (S.ev.some((e) => e.k === 'douse')) out.push('water check: extinguished hero keeps steaming');
        const vx = (wet, ghost = false) => {
          const e = { x: wet ? (k0 % m.W + 0.5) * TILE : sp.x, y: wet ? (Math.floor(k0 / m.W) + 0.5) * TILE : sp.y, vx: 0, vy: 0, type: ghost ? 'ghost' : 'skeleton' };
          for (let i = 0; i < 120; i++) steer(e, ENEMIES[e.type], m, [], 1, 100, 0, 100); return e.vx;
        };
        if (Math.abs(vx(true) / vx(false) - WADE) > 0.001) out.push('water check: monsters do not wade slower');
        if (Math.abs(vx(true, true) / vx(false, true) - 1) > 0.001) out.push('water check: floating ghosts wade');
        for (const k of m.waterBridges) if (inWater(m, { x: (k % m.W + 0.5) * TILE, y: (Math.floor(k / m.W) + 0.5) * TILE })) out.push('water check: a stone crossing slows walkers');
        const e = Object.assign(foe, { x: h.x, y: h.y, burn: S.t + 3, calmT: 1e9, st: 'idle' }); R.en = [e]; S.ev = [];
        step(S, { keys: [] }); if (e.burn > S.t || !S.ev.some((a) => a.k === 'douse')) out.push('water check: a burning monster is not extinguished');
      }
      if (!tested) out.push('water check: no floor with water'); }
    // a body wider than a two-cell wall (the boss, 72 px) walking at it stops at it: with only its corners tested it straddled
    // the wall and walked into the rock for good
    { const W = 12, H = 12, cells = new Array(W * H).fill(1); for (let y = 6; y < H; y++) { cells[y * W + 5] = cells[y * W + 6] = 0; }   // a wall's end
      const m = { W, H, cells, rooms: [{ x: -9, y: -9, w: 1, h: 1 }], start: 0, shop: null }, o = { x: 6 * TILE, y: 3 * TILE };
      for (let i = 0; i < 400; i++) move(m, o, 0, 1.5, ENEMIES.boss.r, true);
      if (cell(m, Math.floor(o.x / TILE), Math.floor(o.y / TILE)) !== 1) out.push(`a ${ENEMIES.boss.r * 2} px wide body walks down into the end of a two-cell wall (${Math.round(o.x)},${Math.round(o.y)})`); }
    // fog of war across a thin wall: a hero against the wall between two rooms with no passage sees all of his own room and none
    // of the floor behind the wall (TASKS 104)
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      // (the smaller early floors, TASKS 373, leave a run's eight with no shut thin wall now and then: the next run's are tried)
      let tested = 0;
      for (let sd = 0; sd < 12 && tested < 3; sd++) { const R = sd ? (S.run = newRun(S, 'campaign', 7000 + sd)) : S.run, h = R.hero;
      for (let f = 1; f <= D.RUNS.campaign.chapter && tested < 3; f++) { enterFloor(S, R, f); const m = R.map;
        for (const A of m.rooms) for (const B of m.rooms) for (const vert of [0, 1]) { if (A === B || A.type === 'secret' || B.type === 'secret' || tested >= 3) continue;
          const a0 = vert ? A.y : A.x, aw = vert ? A.h : A.w, b0 = vert ? B.y : B.x, gap = b0 - (a0 + aw); if (gap < 1 || gap > 2) continue;
          const o0 = Math.max(vert ? A.x : A.y, vert ? B.x : B.y), o1 = Math.min(vert ? A.x + A.w : A.y + A.h, vert ? B.x + B.w : B.y + B.h); if (o1 - o0 < 3) continue;
          const at = (u, v) => (vert ? cell(m, v, u) : cell(m, u, v)); let shut = true;
          for (let v = o0 - 1; v <= o1; v++) for (let u = a0 + aw; u < b0; u++) if (at(u, v) !== 0) shut = false;
          if (!shut) continue; tested++;
          const mid = Math.floor((o0 + o1) / 2), hx = vert ? mid : a0 + aw - 1, hy = vert ? a0 + aw - 1 : mid;
          R.seen = new Array(m.W * m.H).fill(0); R.rseen = m.rooms.map(() => 0); h.x = (hx + 0.5) * TILE; h.y = (hy + 0.5) * TILE; reveal(R);
          let leak = 0, own = 0; for (let v = o0; v < o1; v++) for (let u = b0; u < b0 + 2; u++) { const x = vert ? v : u, y = vert ? u : v; if (cell(m, x, y) === 1 && R.seen[y * m.W + x]) leak++; }
          for (let y = A.y; y < A.y + A.h; y++) for (let x = A.x; x < A.x + A.w; x++) if (cell(m, x, y) === 1 && !R.seen[y * m.W + x]) own++;
          if (leak) out.push(`fog check floor ${f}: ${leak} floor cells of room ${B.id} show through the wall from room ${A.id}`);
          if (own) out.push(`fog check floor ${f}: ${own} floor cells of the hero's own room ${A.id} stay dark`); } } }
      if (!tested) out.push('fog check: no thin wall between two rooms found to test'); }
    // hero blows stop at walls: across a thin wall a monster takes no damage from a swing, the whirl or a fireball's blast,
    // and the same setup with the wall dug out does hit (so the check really reaches it)
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero; let spot = null;
      for (let f = 1; f <= D.RUNS.campaign.chapter && !spot; f++) { R.camLook = null; enterFloor(S, R, f); const m = R.map;
        for (let ty = 1; ty < m.H - 4 && !spot; ty++) for (let tx = 1; tx < m.W - 1 && !spot; tx++) for (const k of [1, 2]) {
          const below = ty + k + 1, ok = (x, y) => cell(m, x, y) === 1 && !inStart(m, x, y);
          if (ok(tx, ty) && ok(tx - 1, ty) && ok(tx + 1, ty) && ok(tx, below) && ok(tx - 1, below) && ok(tx + 1, below) && [...Array(k)].every((_, i) => cell(m, tx, ty + 1 + i) === 0)) { spot = { tx, ty, k, below }; break; } } }
      if (!spot) out.push('wall check: no thin wall between two floors');
      else { const m = R.map, cells = m.cells.slice(), dig = (on) => { for (let i = 0; i < spot.k; i++) m.cells[(spot.ty + 1 + i) * m.W + spot.tx] = on ? 1 : cells[(spot.ty + 1 + i) * m.W + spot.tx]; };
        const type = Object.keys(ENEMIES).find((q) => ENEMIES[q].kind === 'melee' && !ENEMIES[q].ghost);
        const trial = (how, open) => { dig(open); R.proj = []; R.pots = []; R.chests = []; R.drops = [];
          const e = { id: R.nextId++, type, x: (spot.tx + 0.5) * TILE, y: spot.below * TILE + 6, hp: 1e6, max: 1e6, dmg: 0, st: 'idle', deadT: -1, room: -1, t0: S.t, kbx: 0, kby: 0 };
          R.en = [e]; h.x = (spot.tx + 0.5) * TILE; h.y = (spot.ty + 1) * TILE - 6; h.vx = h.vy = 0; h.mp = 999; h.ab.fireball = 1; h.ifr = 1e9; h.cls = how === 'fire' ? 'mage' : 'warrior';
          for (const k in h.cd) h.cd[k] = 0; h.atkT = -9; const aim = () => ({ keys: [], ...toPx(R, e.x, e.y - 30) });
          step(S, aim()); if (how === 'whirl') castAbility(S, R, 'whirl', {}); if (how === 'fire') step(S, Object.assign(aim(), { rclick: 1 }));
          for (let i = 0; i < 120; i++) { e.x = (spot.tx + 0.5) * TILE; e.y = spot.below * TILE + 6; e.st = 'idle'; h.x = (spot.tx + 0.5) * TILE; h.y = (spot.ty + 1) * TILE - 6; step(S, Object.assign(aim(), { press: how === 'swing' && i < 30 ? 1 : 0 })); }
          dig(false); return e.hp < e.max; };
        for (const how of ['swing', 'whirl', 'fire']) { const open = trial(how, true), shut = trial(how, false);
          if (shut) out.push(`a hero ${how} hits a monster through a wall`); else if (!open && how !== 'swing') out.push(`wall check: the ${how} misses even with the wall dug out`); } } }
    // monsters stand clear of solid props: at every post, and when knocked into a chest or chasing the hero straight across one
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, m = R.map, inside = (e) => !ENEMIES[e.type].ghost && e.deadT < 0 && solids(R).some((o) => Math.hypot(e.x - o.x, (e.y - o.y) * 1.6) < o.r + ENEMIES[e.type].r - 1);
      for (let f = 1; f <= D.RUNS.campaign.chapter; f++) { enterFloor(S, R, f); const e = R.en.find(inside); if (e) { out.push(`floor ${f}: a ${e.type} is posted inside a prop`); break; } }
      let c = null; for (let f = 1; f <= D.RUNS.campaign.chapter && !c; f++) { enterFloor(S, R, f); c = R.chests.find((q) => cell(R.map, Math.floor((q.x - 64) / TILE), Math.floor(q.y / TILE)) === 1 && cell(R.map, Math.floor((q.x + 64) / TILE), Math.floor(q.y / TILE)) === 1 && q.sec === undefined); }
      if (!c) out.push('prop check: no chest with floor on both sides in the chapter');
      else { const e = R.en.find((o) => !ENEMIES[o.type].ghost && ENEMIES[o.type].kind === 'melee'); R.en = [e]; Object.assign(e, { x: c.x - 40, y: c.y, kbx: 900, kby: 0, hp: 1e4, max: 1e4, dmg: 0, st: 'idle' });
        h.x = c.x + 300; h.y = c.y + 300; let hit = 0; for (let i = 0; i < 60; i++) { step(S, { keys: [] }); hit |= inside(e); }
        if (hit) out.push('a monster knocked into a chest passes through it');
        h.ifr = 1e9; h.x = c.x + 60; h.y = c.y; e.x = c.x - 60; e.y = c.y; aggroRoom(R, e); hit = 0;
        for (let i = 0; i < 120 * 3; i++) { h.x = c.x + 60; h.y = c.y; step(S, { keys: [] }); hit |= inside(e); }
        if (hit) out.push('a monster chasing the hero walks through a chest'); } }
    // trading: E at the counter opens the shop; a buy costs its price and lands in the bag, a sale pays a quarter and can be
    // bought back at that price; no gold or a full bag refuses without taking anything
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      const R = S.run, h = R.hero, sh = R.map.shop; R.en = []; h.x = sh.front.x; h.y = sh.front.y; step(S, { keys: ['KeyE'] });
      if (S.screen !== 'shop') out.push('E at the counter does not open the shop');
      else { const U = UI.shop(R.shop.goods.length), at = (id) => { const b = U.r.find((q) => q.id === id); return { px: b.x + 5, py: b.y + 5, click: 1, keys: [] }; };
        const g = R.shop.goods[0], n0 = R.shop.goods.length; h.gold = g.price - 1; step(S, at('buy:0'));
        if (R.shop.goods.length !== n0 || h.gold !== g.price - 1) out.push('a buy went through without enough gold');
        h.gold = g.price + 5; step(S, at('buy:0'));
        if (h.gold !== 5 || !h.bag.some((b) => b && b.id === g.it.id)) out.push('a buy did not take its price or did not land in the bag');
        const i = h.bag.findIndex((b) => b && b.id === g.it.id), pr = D.sellPrice(g.it, R.floor); step(S, at('sell:' + i));
        if (h.gold !== 5 + pr || h.bag[i] || !R.shop.back.some((q) => q.it.id === g.it.id && q.price === pr)) out.push('a sale did not pay or did not reach the buy-back row');
        step(S, at('back:0')); if (h.gold !== 5 || !h.bag.some((b) => b && b.id === g.it.id)) out.push('buying back a sold item failed');
        for (let k = 0; k < 24; k++) h.bag[k] = Object.assign(rollItem(R, 1, 0), { id: 70000 + k });
        const cg = R.shop.goods.find((q) => q.n); h.gold = 1e6; const c0 = cg.n; step(S, at('buy:' + R.shop.goods.indexOf(cg)));
        if (h.gold !== 1e6 || cg.n !== c0) out.push('a buy into a full bag took the gold');
        // TASKS 1863 г, в, д, 1978: a legendary asks first; «Оставить» and Esc keep it with the shop open, «Продать» sells it; the right
        // button sells as the left does, I leaves the shop open
        const SA = UI.sellAsk(), sa = (id) => { const b = SA.r.find((q) => q.id === id); return { px: b.x + 5, py: b.y + 5, click: 1, keys: [] }; };
        h.bag[0] = Object.assign(rollItem(R, 1, 0), { id: 71000, rar: 4 }); const g0 = h.gold; step(S, at('sell:0')); if (!h.bag[0] || h.gold !== g0) out.push('shop: a legendary is sold on one press');
        if (!S.sellAsk) out.push('shop: a legendary\'s sale does not ask');
        step(S, sa('sellNo')); if (S.sellAsk || !h.bag[0] || h.gold !== g0) out.push('shop: «Оставить» does not keep the legendary');
        step(S, at('sell:0')); step(S, { keys: ['Escape'] }); if (S.sellAsk || S.screen !== 'shop' || !h.bag[0]) out.push('shop: Esc on the sale\'s question does not just close the question');
        step(S, at('sell:0')); step(S, sa('sellYes')); if (S.sellAsk || (h.bag[0] && h.bag[0].id === 71000)) out.push('shop: «Продать» does not sell the legendary');
        { const U2 = UI.shop(R.shop.goods.length, h.bag.length), A = SA.A, inA = (b) => b.x >= A.x && b.y >= A.y && b.x + b.w <= A.x + A.w && b.y + b.h <= A.y + A.h;
          const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y), parts = [SA.cell, SA.q, ...SA.r];
          if (!parts.every(inA)) out.push('shop: the sale\'s question leaves its sheet');
          if (parts.some((a, i) => parts.some((b, j) => j > i && hit(a, b)))) out.push('shop: the sale\'s question, its cell or its buttons overlap');
          if (U2.r.some((b) => (b.id === 'talk' || b.id === 'close') && hit(b, A))) out.push('shop: the sale\'s question sits over the merchant\'s buttons'); }
        h.bag[1] = Object.assign(rollItem(R, 1, 0), { id: 71001, rar: 1 }); step(S, Object.assign(at('sell:1'), { click: 0, rclick: 1 })); if (h.bag[1]) out.push('shop: the right button does not sell');
        step(S, { keys: ['KeyI'] }); if (S.screen !== 'shop') out.push('shop: I closes it, only E and Esc should');
        step(S, { keys: ['Escape'] }); if (S.screen !== 'play') out.push('Esc does not close the shop'); } }
    // a jam in a two-cell corridor (TASKS 151): monsters queued behind the ones at the hero don't stand still for long, they leave;
    // and the start room and the shop are open to a chasing monster (152)
    { const S = spawn(0, {}); begin(S); for (let i = 0; i < 30; i++) step(S, { keys: [] });
      let R = S.run, h = R.hero, lane = null, m = R.map;   // a straight corridor two cells wide and 14 long, rock on both sides: the hero at one end, ten monsters down it
      const corr = (x, y) => cell(m, x, y) === 1 && DG.roomAt(m, x * TILE + 16, y * TILE + 16) < 0;
      // (the smaller floors' shorter corridors, TASKS 373, may have none in a run: its floors, then the next runs', are tried)
      for (let sd = 0; sd < 12 && !lane; sd++) { if (sd) { R = S.run = newRun(S, 'campaign', 7100 + sd); h = R.hero; }
      for (let f = 1; f <= D.RUNS.campaign.chapter && !lane; f++) { if (f > 1) enterFloor(S, R, f); m = R.map;
      for (let y = 1; y < m.H - 2 && !lane; y++) for (let x = 1; x < m.W - 14 && !lane; x++) for (const v of [0, 1]) {
        const at = (i, k) => v ? [x + k, y + i] : [x + i, y + k];
        if ([...Array(14)].every((_, i) => { const [ax, ay] = at(i, 0), [bx, by] = at(i, 1), [cx, cy] = at(i, -1), [dx, dy] = at(i, 2);
          return corr(ax, ay) && corr(bx, by) && cell(m, cx, cy) === 0 && cell(m, dx, dy) === 0; })) {
          const c = (i, k) => { const [px, py] = at(i, k); return py * m.W + px; };
          lane = { at: c(0, 0), back: [...Array(10)].map((_, n) => c(4 + (n >> 1), n & 1)) }; break; } } } }
      if (!lane) out.push('jam check: no straight corridor long enough');
      else { const sk = ENEMIES.brute, reach = sk.r + K.R + sk.reach;
        h.ifr = 1e9; h.x = (lane.at % m.W) * TILE + 16; h.y = ((lane.at / m.W) | 0) * TILE + 18;
        R.en = lane.back.map((j) => { const x = (j % m.W) * TILE + 16, y = ((j / m.W) | 0) * TILE + 18;
          return { id: R.nextId++, type: 'brute', x, y, hx: x, hy: y, vx: 0, vy: 0, hp: 1e5, max: 1e5, dmg: 0, elite: 0, room: -1, st: 'chase', t0: S.t, face: 1, aimA: 0,
            cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: S.t }; });
        const wait = R.en.map(() => 0); let worst = 0;
        for (let i = 0; i < 120 * 12; i++) { h.x = (lane.at % m.W) * TILE + 16; h.y = ((lane.at / m.W) | 0) * TILE + 18; step(S, { keys: [] });
          R.en.forEach((e, k) => { wait[k] = e.st === 'chase' && Math.hypot(h.x - e.x, h.y - e.y) > reach + 40 ? wait[k] + DT : 0; worst = Math.max(worst, wait[k]); }); }
        if (worst > 5) out.push(`jam check: a monster queued in a corridor short of the fight for ${worst.toFixed(1)} s`); }
      const r = m.rooms[m.shop.room], e = R.en[0] || {}, mouth = [];
      for (let y = r.y - 2; y <= r.y + r.h + 1; y++) for (let x = r.x - 2; x <= r.x + r.w + 1; x++) if (cell(m, x, y) === 1 && !inRoom1(r, x, y) && DG.roomAt(m, x * TILE, y * TILE) < 0) mouth.push([x, y]);
      R.en = [Object.assign(e, { x: mouth[0][0] * TILE + 16, y: mouth[0][1] * TILE + 18, st: 'chase', t0: S.t, seenT: S.t, calmT: 0, kbx: 0, kby: 0 })];
      let inside = 0; for (let i = 0; i < 120 * 6 && !inside; i++) { h.x = m.shop.front.x; h.y = m.shop.front.y + 20; step(S, { keys: [] }); if (DG.roomAt(m, e.x, e.y) === r.id && e.st === 'wind') inside = 1; }
      if (lane && !inside) out.push('a monster chasing the hero does not follow it into the shop to strike'); }
    {
      const S = spawn(0, {}); S.run = newRun(S, 'campaign', 1234); S.screen = 'play';
      const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9;
      R.proj = [{ id: R.nextId++, k: 'fire', x: h.x, y: h.y - 20, vx: 0, vy: 0, t0: -2, life: 1.1, dmg: 0, own: 'hero', r: 8 }];
      step(S, { keys: [] });
      if (R.scorches.length !== 1 || !Number.isFinite(R.scorches[0].gx) || !Number.isFinite(R.scorches[0].gy)) out.push('a fireball leaves no scorch on the last open floor');
      for (let i = 0; i < 80; i++) S.ev.push({ k: 'step', x: h.x, y: h.y, t: S.t });
      step(S, { keys: [] });
      if (S.ev.some((e) => e.k === 'boom') || R.scorches.length !== 1) out.push('a busy event log erases the fireball scorch');
      const saved = spawn(0, { run: JSON.parse(JSON.stringify(R)) });
      if (!saved.saved.scorches || saved.saved.scorches.length !== 1) out.push('a save loses the fireball scorch');
      enterFloor(S, R, 2); if (R.scorches.length) out.push('a scorch follows the hero to another floor');
    }
    return out;
  }
  function meleeSpacingCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 1234); S.screen = 'play';
    const R = S.run, m = R.map, h = R.hero, rm = m.rooms.filter((r) => r.type === 'combat').sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const x = (rm.x + rm.w / 2) * TILE, y = (rm.y + rm.h / 2) * TILE;
    R.pots = []; R.chests = []; m.decor = []; m.block = []; m.traps = []; m.water = []; R.shrines = []; m.webs = []; m.torches = m.torches.filter((t) => t.kind === 'wall');
    for (let ty = Math.floor(y / TILE) - 5; ty <= Math.floor(y / TILE) + 5; ty++) for (let tx = Math.floor(x / TILE) - 5; tx <= Math.floor(x / TILE) + 5; tx++) m.cells[ty * m.W + tx] = 1;
    const mob = (type, dx, dy, id = 9000) => ({ id, type, x: x + dx, y: y + dy, vx: 0, vy: 0, hp: 1e6, max: 1e6, dmg: 10, elite: 0, room: rm.id,
      st: 'chase', t0: S.t, face: -1, aimA: Math.PI, cdT: S.t, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0 });
    for (const type of ['goblin', 'skeleton', 'ghost', 'brute', 'spider']) for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const E = ENEMIES[type], e = mob(type, Math.cos(a) * 120, Math.sin(a) * 120), stop = E.r + K.R + 6;
      R.en = [e]; R.proj = []; R.freeze = 0; h.hp = 1e6; h.ifr = 0; h.poison = h.burn = 0; h.deadT = -1;
      let close = Infinity;
      for (let i = 0; i < 120 * 5; i++) {
        h.x = x; h.y = y; h.vx = h.vy = 0; step(S, { keys: [] });
        close = Math.min(close, Math.hypot(e.x - h.x, e.y - h.y));
      }
      if (close < stop - 0.1) out.push(`${type}: closes to ${close.toFixed(1)} px, below ${stop}`);
      if (h.hp >= 1e6) out.push(`${type}: cannot hit the hero from its stopping distance`);
      e.x = h.x; e.y = h.y; e.vx = e.vy = 0; R.freeze = 0; step(S, { keys: [] });
      if (Math.hypot(e.x - h.x, e.y - h.y) < stop - 0.1) out.push(`${type}: stays inside the hero after contact`);
    }
    R.en = [mob('goblin', 28, 0), mob('skeleton', 29, -6, 9001), mob('goblin', 29, 6, 9002)];
    h.ifr = 1e9; h.poison = h.burn = 0; R.freeze = 0;
    for (let i = 0; i < 240; i++) {
      h.x = x; h.y = y; step(S, { keys: [] });
      if (R.en.some((e) => Math.hypot(e.x - h.x, e.y - h.y) < ENEMIES[e.type].r + K.R + 5.9)) { out.push('the crowd pushes a monster inside the hero'); break; }
    }
    for (const kind of ['chest', 'wall']) {
      const wallX = (Math.floor(x / TILE) + 2) * TILE, heroX = kind === 'wall' ? wallX - 36 : x;
      const e = mob('goblin', kind === 'wall' ? wallX - 13 - x : 25, 0); R.en = [e]; R.freeze = 0; R.chests = kind === 'chest' ? [{ x: x + 48, y, open: 0 }] : [];
      if (kind === 'wall') for (let ty = Math.floor(y / TILE) - 5; ty <= Math.floor(y / TILE) + 5; ty++) m.cells[ty * m.W + Math.floor(x / TILE) + 2] = 0;
      for (let i = 0; i < 30; i++) {
        h.x = heroX; h.y = y; h.vx = h.vy = 0; step(S, { keys: [] });
        if (Math.hypot(e.x - h.x, e.y - h.y) < 27.9) { out.push(`a ${kind} prevents a monster standing clear of the hero`); break; }
        if (kind === 'chest' && Math.hypot(e.x - x - 48, (e.y - y) * 1.6) < 25.9) { out.push('hero contact pushes a monster into a chest'); break; }
        if (solidAt(m, e.x, e.y, true)) { out.push('hero contact pushes a monster into a wall'); break; }
      }
    }
    // the endless descent (TASKS 348–349): a pair is one biome drawn from the run's seed, the same for the same seed; every biome
    // comes up; a pair ends by turns with the exit's elite guard and the biome's boss; maps grow to the cap and no further; floors
    // generate with the hero on open floor; a run goes on past the 12th and its depth is the record; no demon lord nor serpent before
    // the 8th
    // TASKS 388: past the campaign a floor holds no more than the descent's cap of monsters, its map no bigger than size.to (but the magma's plateaus),
    // and the cut takes no lock's key with its bearer
    for (const sd of [3, 11]) for (let f = 17; f <= 32; f += 3) { const ST = D.stageOf('endless', f, sd, 17), m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'endless', runSeed: sd, from: 17, town: 1 });
      if (m.enemies.length > D.RUNS.endless.cap) out.push(`descent seed ${sd} f${f}: ${m.enemies.length} monsters, over the cap ${D.RUNS.endless.cap}`);
      (m.locks || []).forEach((L, li) => { if (L.kind === 'key' && !m.enemies.some((e) => e.key === li) && !m.chests.some((c) => c.key === li)) out.push(`descent seed ${sd} f${f}: lock ${li} with no key on the floor`); });
      if (ST.biome !== 'magma' && (m.W > D.RUNS.endless.size.to[0] || m.H > D.RUNS.endless.size.to[1])) out.push(`descent seed ${sd} f${f}: a ${m.W}×${m.H} map over ${D.RUNS.endless.size.to.join('×')}`); }
    // TASKS 1871: the clearing round the stairs spares a key's bearer on the campaign's floors, through the town or not, as the cut does
    for (const town of [0, 1]) for (const sd of [1, 77, 4242]) for (let f = 1; f <= D.RUNS.campaign.floors; f++) { const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd, from: 1, town });
      (m.locks || []).forEach((L, li) => { if (L.kind === 'key' && m.enemies.filter((e) => e.key === li).length + m.chests.filter((c) => c.key === li).length !== 1) out.push(`campaign${town ? ' via town' : ''} seed ${sd} f${f}: lock ${li} without its one key`); }); }
    { const end = BAL.deep.end, top = [D.hpAt(end), D.dmgAt(end), D.dmgAt(end, 1)], st = (f) => D.stageOf('endless', f, 7, 17);
      for (const f of [end + 1, end + 2, 100, 1000, 1e6, 1e12]) { if ([D.hpAt(f), D.dmgAt(f), D.dmgAt(f, 1)].some((v, i) => v !== top[i] || !Number.isFinite(v))) out.push(`deep f${f}: monsters grow past the end of the growth`);
        if (f > 1000) continue; const a = st(f), b = st(end); if (a.elite !== b.elite || a.pop !== b.pop || a.cd !== b.cd || D.deepAxis(f, 'blow') !== D.deepAxis(end, 'blow')) out.push(`deep f${f}: an axis grows past the end of the growth`);
        if (D.eliteMods(f).join() !== D.eliteMods(end).join()) out.push(`deep f${f}: elites gain modifiers past the end of the growth`); }
      if (!(D.deepAxis(1e6, 'blow') < 0.5)) out.push('deep: two blows could kill from full health');
      for (let f = BAL.deep.past + 1; f <= end; f++) if (!(D.hpAt(f) > D.hpAt(f - 1)) || !(D.dmgAt(f) > D.dmgAt(f - 1))) out.push(`deep f${f}: no growth`);
      for (let d = 1; d <= BAL.deep.past; d++) { const old = (1 + 0.5 * (d - 1)) * Math.pow(1.1, Math.max(0, d - 12)); if (Math.abs(D.hpAt(d) - old) > 1e-9 || D.deepAxis(d, 'blow') !== BAL.cap.blow) out.push(`deep: the campaign's depth ${d} changed`); } }
    { const E = D.RUNS.endless, seen = new Set();
      for (let sd = 1; sd <= 40; sd++) for (let f = 1; f <= 20; f++) { const a = D.stageOf('endless', f, sd), b = D.stageOf('endless', f, sd); seen.add(a.biome);
        if (a.biome !== b.biome || a.biome !== D.stageOf('endless', f % 2 ? f + 1 : f - 1, sd).biome) { out.push(`endless seed ${sd} f${f}: a pair's biome not fixed by the seed`); break; }
        const p = Math.floor((f - 1) / 2), end = f % 2 === 0;
        const big = E.big.includes(E.bosses[a.biome]) && f < E.bigFrom;
        if ((end && f >= E.guardFrom) !== !!(a.boss || a.guard) && !(end && a.boss) || (end && (p % 2 === 1 && !big) !== !!a.boss) || (a.boss && a.boss !== E.bosses[a.biome])) { out.push(`endless seed ${sd} f${f}: wrong end of the pair`); break; } }
      for (const b of E.pool) if (!seen.has(b)) out.push(`endless: biome ${b} never comes up on 40 seeds`);
      // the bosses from their own bag (TASKS 386): all five in each round of five boss pairs, never the same twice running
      for (let sd = 1; sd <= 40; sd++) { const seq = []; for (let f = 4; f <= 84; f += 4) seq.push(D.stageOf('endless', f, sd).boss);
        const nb = E.pool.length, wins = Array.from({ length: Math.floor(seq.length / nb) }, (_, j) => j * nb);   // (six since the magma, TASKS 416)
        if (seq.some((b, i) => !b || b === seq[i - 1]) || wins.some((i) => new Set(seq.slice(i, i + nb)).size !== nb)) { out.push(`endless seed ${sd}: a boss again before all ${nb} came up (${seq.join(' ')})`); break; }
        // past the serpent the descent's rounds start at its own first boss (the 16th)
        const from = D.RUNS.campaign.floors + 1, deep = []; for (let f = from + 3; f <= from + 83; f += 4) deep.push(D.stageOf('endless', f, sd, from).boss);
        if (deep.some((b, i) => !b || b === deep[i - 1]) || wins.some((i) => new Set(deep.slice(i, i + nb)).size !== nb)) { out.push(`descent seed ${sd}: a boss again before all ${nb} came up (${deep.join(' ')})`); break; } }
      for (let sd = 1; sd <= 5; sd++) { let last = {};   // within each kind of map (rooms, caves) apart: a cave starts larger
        for (let f = 1; f <= 40; f++) { const st = D.stageOf('endless', f, sd), k = st.arch || 'rooms', a = st.size[0] * st.size[1]; if (k === 'plateau') continue;   // (the magma's plateaus keep their own run's sizes, TASKS 416)
          if (a < (last[k] || 0) || a > E.size.to[0] * E.size.to[1] || (f >= E.size.floors && a !== E.size.to[0] * E.size.to[1])) { out.push(`endless seed ${sd} f${f}: the map does not grow to its cap and stop`); break; } last[k] = a; } }
      for (const [sd, f] of [[3, 1], [3, 2], [3, 4], [5, 7], [5, 8], [11, 14], [2, 23], [7, 30]]) { const st = D.stageOf('endless', f, sd), m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'endless', runSeed: sd });
        if (m.W !== st.size[0] || cell(m, Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE)) !== 1) out.push(`endless seed ${sd} f${f}: map size or spawn wrong`);
        if (st.boss && !m.enemies.some((e) => e.type === st.boss)) out.push(`endless seed ${sd} f${f}: no ${st.boss}`);
        if (st.guard && !m.enemies.some((e) => e.guard)) out.push(`endless seed ${sd} f${f}: no exit guard`); }
      const S = spawn(0, {}); S.run = newRun(S, 'endless', 9); S.screen = 'play'; const R = S.run; enterFloor(S, R, 13);
      if (R.floor !== 13 || lastFloor(R) || !R.map) out.push('endless: a run does not go on past the 12th');
      // saved on the 13th and taken up again (the menu's «Продолжить»): the same floor, its pair's biome, the map, and on down
      { const T = spawn(0, { run: JSON.parse(JSON.stringify(R)) }); T.screen = 'menu'; { const b = UI.menu(true, T.meta.diff, 0, T.meta.zoom).find((q) => q.id === 'continue'); step(T, { px: b.x + b.w / 2, py: b.y + b.h / 2, click: 1, keys: [] }); }
        const Q = T.run; if (!Q || Q.mode !== 'endless' || Q.floor !== 13 || Q.map.W !== R.map.W || D.floorName(Q.floor, Q.mode, Q.seed) !== D.floorName(13, 'endless', 9)) out.push('endless: a saved run does not continue as it was');
        else { enterFloor(T, Q, 14); if (D.stageOf('endless', 14, Q.seed).biome !== D.stageOf('endless', 13, 9).biome) out.push('endless: a continued run loses its pair\'s biome'); } }
      // past the colossus (TASKS 354, 416: the serpent's choice moved to the 16th): the stairs beside the portal stay shut while it lives; taken after, they win the campaign there
      // (a win, the record 16, the win's shards and the gold's so far) and the same run, the hero as he was, goes on from the 17th;
      // the gold paid at the stairs is not paid again at the end
      { const T = spawn(0, {}); T.run = newRun(T, 'campaign', 21); T.screen = 'play'; const Q = T.run, hq = Q.hero; enterFloor(T, Q, 16); const md = Q.map, lvl = 19; hq.lvl = lvl; Q.goldTot = 4000;
        if (!md.down) out.push('campaign f16: no stairs on past the colossus');
        else { hq.x = md.down.x; hq.y = md.down.y + 20; interact(T, Q);
          if (Q.floor !== 16) out.push('campaign f16: the stairs on open before the colossus falls');
          const b = Q.en.find((e) => e.type === 'boss_colossus'); b.hp = 0; killEnemy(T, Q, b); const w0 = T.meta.wins || 0, s0 = T.meta.shards, id = hq.eq.weapon.id;
          hq.x = md.down.x; hq.y = md.down.y + 20; interact(T, Q);
          if (Q.floor !== 17 || Q.mode !== 'endless' || T.meta.wins !== w0 + 1 || T.meta.best !== 16 || T.meta.shards - s0 !== Math.floor(4000 / REWARD.goldPer) + REWARD.win || hq.lvl !== lvl || hq.eq.weapon.id !== id)
            out.push('campaign f16: the stairs on do not win the campaign and go on to the 17th with the same hero');
          // (back up to the 16th and given up there, TASKS 516: the record is the 17th reached, not the 16th left on)
          enterFloor(T, Q, 16, undefined, 'up'); Q.goldTot += 500; endRun(T, 'dead'); if (T.result.base !== Math.floor(500 / REWARD.goldPer) || T.meta.bestEndless !== 17 || !T.result.record.fresh || T.result.deepest !== 17 || !T.result.campaignWon) out.push('campaign f16: the descent pays the campaign\'s gold twice or keeps no depth, or the record takes the floor left on'); } }
      endRun(S, 'dead'); if (S.meta.bestEndless !== 13 || S.result.mode !== 'endless' || !S.result.record || !S.result.record.fresh) out.push('endless: the record depth is not kept');
      // each of the five bosses at the end of an endless pair (TASKS 350): its arena seals when the hero walks in and opens at its
      // death; a chapter's end boss pays as the finale (20 shards, LOOT.boss), the others as a mid-chapter boss (3 shards and LOOT.mini);
      // its floor keeps an altar, and the stairs lead on to the next pair
      for (const type of Object.values(E.bosses)) { let found = null;
        for (let sd = 1; sd <= 80 && !found; sd++) for (let f = 8; f <= 24 && !found; f += 4) if (D.stageOf('endless', f, sd).boss === type) found = [sd, f];
        if (!found) { out.push(`endless: no ${type} on floors 8–24 of seeds 1–80`); continue; }
        const T = spawn(0, {}); T.run = newRun(T, 'endless', found[0]); T.screen = 'play'; const Q = T.run; enterFloor(T, Q, found[1]); const m2 = Q.map, b = Q.en.find((e) => e.type === type), r = m2.rooms[b.room];
        Q.hero.x = (r.x + r.w / 2) * TILE; Q.hero.y = (r.y + r.h / 2) * TILE; stepArena(T, Q);
        if (!Q.arena || !Q.arena.active || !arenaSealed(Q)) { out.push(`endless ${type}: the arena does not seal`); continue; }
        Q.drops = []; b.hp = 0; killEnemy(T, Q, b); const big = E.big.includes(type), shards = Q.drops.filter((d) => d.kind === 'shard').reduce((n, d) => n + d.n, 0), items = Q.drops.filter((d) => d.kind === 'item' && !isCons(d.item)).length + Q.chests.filter((c) => c.boss).reduce((n, c) => n + c.loot.length, 0);
        if (arenaSealed(Q) || Q.arena.active || (m2.doors || []).some((d) => d.arena && !d.open)) out.push(`endless ${type}: the arena stays shut after its death`);
        if (shards !== (big ? 20 : 3) || items < (big ? LOOT.boss : LOOT.mini.items).length || (!big && items > LOOT.mini.items.length)) out.push(`endless ${type}: pays ${shards} shards and ${items} items`);
        if (!m2.shrines.some((q) => q.boss)) out.push(`endless ${type}: no altar on its floor`);
        enterFloor(T, Q, found[1] + 1); if (Q.floor !== found[1] + 1 || D.stageOf('endless', Q.floor, found[0]).pair !== found[1] / 2) out.push(`endless ${type}: the stairs do not lead on`); } }
    return out;
  }
  function reactionCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 1234); S.screen = 'play';
    const R = S.run, m = R.map, h = R.hero, x = h.x, y = h.y;
    R.en = []; R.pots = []; R.chests = []; R.shrines = []; m.decor = []; m.torches = []; m.block = []; m.traps = []; m.webs = [];
    for (let ty = Math.floor(y / TILE) - 4; ty <= Math.floor(y / TILE) + 4; ty++) for (let tx = Math.floor(x / TILE) - 4; tx <= Math.floor(x / TILE) + 4; tx++) m.cells[ty * m.W + tx] = 1;
    const bones = { n: 'bones', x: x + 30, y }, candle = { n: 'candles', x, y: y + 30 }, tableCandle = { n: 'candles', x, y: y + 30, lift: 22 };
    m.decor = [bones, candle, tableCandle]; const rs = R.rs;
    hitProps(S, R, x, y, 45); hitProps(S, R, x, y, 45);
    if (S.ev.filter((e) => e.k === 'prop' && e.mat === 'bone').length !== 1) out.push('reaction check: bones must scatter once per strike');
    S.t += 0.44; hitProps(S, R, x, y, 45);
    if (S.ev.filter((e) => e.k === 'prop' && e.mat === 'bone').length !== 2) out.push('reaction check: bones ignore a second sword swing');
    if (candle.outUntil !== S.t - 0.44 + 3 || tableCandle.outUntil) out.push('reaction check: only floor candles go out for three seconds');
    if (S.ev.filter((e) => e.k === 'snuff').length !== 1) out.push('reaction check: snuff smoke missing or repeated');
    if (R.rs !== rs) out.push('reaction check: cosmetic reactions change gameplay RNG');
    S.ev = []; S.t += 1; h.x = x; h.y = y; h.vx = h.vy = 0;
    step(S, { right: 1, keys: ['Space'], ...toPx(R, x + 100, y) });
    if (!S.ev.some((e) => e.k === 'prop' && e.mat === 'bone')) out.push('reaction check: dash does not scatter bones');
    const saved = JSON.parse(JSON.stringify(persist(S))).run.map.decor[1];
    if (saved.outUntil !== candle.outUntil) out.push('reaction check: snuffed candle loses its timer in a save');
    S.ev = []; S.t = candle.outUntil - 0.01; hitProps(S, R, x, y, 45);
    if (S.ev.some((e) => e.k === 'snuff')) out.push('reaction check: unlit candle snuffs again');
    S.ev = []; S.t += 0.02; hitProps(S, R, x, y, 45);
    if (!S.ev.some((e) => e.k === 'snuff')) out.push('reaction check: candle cannot be snuffed after relighting');
    m.torches = [{ x, y, kind: 'fire' }]; S.t += 1; S.ev = []; hitProps(S, R, x - 30, y, 45);
    if (!S.ev.some((e) => e.k === 'prop' && e.mat === 'fire')) out.push('reaction check: campfire rings like metal');
    const sh = m.shop; h.x = sh.front.x; h.y = sh.front.y + 4; h.vx = h.vy = 0; h.cd.atk = 0; R.freeze = 0; S.ev = [];
    const aim = toPx(R, sh.x, sh.y - 35); step(S, { press: 1, keys: [], ...aim });
    for (let i = 0; i < 35; i++) step(S, { keys: [], ...aim });
    if (!S.ev.some((e) => e.k === 'merchantHit') || R.shop.hitLine !== 0) out.push('reaction check: merchant does not react to melee over his counter');
    return out;
  }
  function hazardCheck() {
    const out = [], HZ = D.HAZ, cnt = { vent: [0, 0, 0, 0], fall: [0, 0, 0, 0] };
    // (counted on the plain plateaus: the floor types' figures leave each its own room for them)
    for (const sd of [1, 77, 4242, 5, 12, 33]) for (let f = 1; f <= D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', ftype: 'plain' }), W = m.W, tag = `magma ${sd} f${f}`;
      const keepOff = [[m.spawn.x, m.spawn.y], [m.exit.x, m.exit.y], ...m.chests.map((c) => [c.x, c.y]), ...m.enemies.map((e) => [e.x, e.y]), ...m.shrines.map((q) => [q.x, q.y])];
      const st = m.rooms.find((r) => r.type === 'start'); keepOff.push([(st.cx + 0.5) * TILE, (st.cy + 0.5) * TILE + 6]);
      for (const z of m.hazards || []) { const tx = Math.floor(z.x / TILE), ty = Math.floor(z.y / TILE);
        // (a hoard islet's rocks fall on its strip of thin crust, by its chest by design, TASKS 1054)
        if (z.islet) { if (!(m.thin || []).includes(ty * W + tx)) out.push(`${tag}: an islet's rock off its strip at ${tx},${ty}`); continue; }
        if (!z.tail) cnt[z.k][f - 1]++;
        if (keepOff.some(([x, y]) => Math.hypot(x - z.x, y - z.y) < HZ.clear * TILE)) out.push(`${tag}: a ${z.k} within ${HZ.clear} cells of the start, the spawn, the stairs, a chest, a monster or the altar at ${tx},${ty}`);
        if (cell(m, tx, ty) !== 1) out.push(`${tag}: a ${z.k} off the floor at ${tx},${ty}`);
        if (z.k === 'vent') for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, tx + i, ty + j) !== 1) { out.push(`${tag}: a vent without 3×3 of floor at ${tx},${ty}`); j = i = 9; }
        if (z.k === 'vent') for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.max(Math.abs(i), Math.abs(j)) <= 2 && m.cells[(ty + j) * W + tx + i] === 3 && Math.max(Math.abs(i), Math.abs(j)) <= 1) out.push(`${tag}: a vent by the lava at ${tx},${ty}`); }
      // an aimed run's rocks fall HZ.fall.gap apart on one clock (TASKS 485): its head's phase was moved first and the rest taken from it,
      // 0.2 / 0.2 / 0.6 / 0.2 s (PR #26 review)
      const runs = new Map(); for (const z of (m.hazards || []).filter((q) => q.k === 'fall' && q.aim)) runs.set(z.per, (runs.get(z.per) || []).concat(z));
      for (const [per, l] of runs) { if (l.length < 2) continue; const t = l.map((z) => z.ph * per).sort((a, b) => a - b), d = t.map((v, i) => ((t[(i + 1) % t.length] - v) % per + per) % per);
        if (d.filter((v) => Math.abs(v - HZ.fall.gap) < 1e-6).length < l.length - 1) out.push(`${tag}: an aimed rock run's rocks fall ${d.map((v) => v.toFixed(2)).join(' / ')} s apart, not ${HZ.fall.gap}`); } }
    for (const k of ['vent', 'fall']) { const c = cnt[k]; if (!(c[0] > 0 && c[0] < c[1] && c[1] < c[2] && c[3] < c[2])) out.push(`magma hazards: ${k}s by floor ${c.join('/')} (six seeds) do not grow to the 3rd`); }
    // (TASKS 461) on every floor but the boss's two rings at least stand on the walk from the spawn to the stairs: laid at random
    // a third of the floors had none on it
    for (const sd of [1, 7, 33, 128]) for (const ft of ['plain', 'lake', 'river', 'terrace', 'chasm']) for (let f = 1; f < D.RUNS.magma.floors; f++) {
      const m = DG.genFloor(sd * 37 + f * 1013, f, { mode: 'magma', ftype: ft }); if (!m || !m.hazards) continue; const W = m.W;
      const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e = m.exit.ty * W + m.exit.tx, from = new Int32Array(W * m.H).fill(-2), q = [s0]; from[s0] = -1;
      const guarded = new Set(m.riverGuard || []);   // (TASKS 1160: a river's rocks run down the way without the guard)
      for (let i = 0; i < q.length && from[e] === -2; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (from[n] === -2 && m.cells[n] === 1 && !guarded.has(n)) { from[n] = q[i]; q.push(n); } }
      const way = []; for (let k = e; k >= 0 && from[e] !== -2; k = from[k]) way.push(k);
      const on = m.hazards.filter((z) => way.some((k) => D.hazIn(z, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE))).length;
      if (on < 2) out.push(`magma ${ft} ${sd} f${f}: ${on} hazard ring(s) on the walk to the stairs, 2 at least`);
      const gate = m.hazards.filter((z) => z.gate);
      if (gate.length) { const deck = new Set((m.crossings || []).flatMap((c) => c.cells)), s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), seen = new Uint8Array(W * m.H), g = [s0]; seen[s0] = 1;
        for (let i = 0; i < g.length; i++) for (const o of [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) { const n = g[i] + o; if (n >= 0 && n < W * m.H && !seen[n] && (m.cells[n] === 1 || m.cells[n] === 6 || deck.has(n)) && !gate.some((z) => D.hazIn(z, (n % W + 0.5) * TILE, (Math.floor(n / W) + 0.5) * TILE))) { seen[n] = 1; g.push(n); } }
        if (seen[e]) out.push(`magma ${ft} ${sd} f${f}: a way round the vent gate to the stairs`); } }
    // the burst: the hero in the ring is hurt once (his regeneration over the run aside) and, by a vent, set alight; a monster in it
    // is hurt, the hero out of it is not
    for (const k of ['vent', 'fall']) { const Z = spawn(0, {}); plainRun(Z); Z.screen = 'play'; const R2 = Z.run, m = R2.map, h = R2.hero, H = HZ[k];
      const z = (m.hazards || []).find((q) => q.k === k && !q.gate); if (!z) { out.push(`magma hazards: no ${k} on the first plain floor of seed 3`); continue; }
      const at = (c) => (((c / z.per - z.ph) % 1 + 1) % 1 + Math.ceil(Z.t / z.per + 2)) * z.per, mob = { id: R2.nextId++, type: 'skeleton', x: z.x - 12, y: z.y + 4, vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'idle', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: -9 };
      const run = (hx, hy) => { R2.en = [Object.assign({}, mob, { haz: {} })]; h.x = hx; h.y = hy; h.haz = {}; h.ifr = 0; h.burn = 0; h.dashT = -9; const st0 = stats(h, Z.meta); h.hp = st0.maxHp;
        Z.t = R2.t = at(z.per - H.warn - 0.1); Z.ev = []; const hp0 = h.hp; let warnT = -1, burstT = -1;
        for (let i = 0; i < Math.round((H.warn + 0.6) * 120); i++) { h.x = hx; h.y = hy; h.vx = h.vy = 0; R2.en[0].x = mob.x; R2.en[0].y = mob.y; step(Z, { keys: [] });
          for (const e of Z.ev) { if (e.k === 'hazwarn' && e.i === m.hazards.indexOf(z) && warnT < 0) warnT = e.t; if ((e.k === 'erupt' || e.k === 'rockfall') && e.i === m.hazards.indexOf(z) && burstT < 0) burstT = e.t; } Z.ev = []; }
        return { lost: hp0 - h.hp, burn: h.burn > Z.t - 0.6, mob: 999 - R2.en[0].hp, lead: burstT - warnT }; };
      // (the spot out of the ring is the first side of it on whole floor, two cells from any lava and out of every other hazard's
      // reach: a fixed one fell in the lava once the plateaus' sizes varied, TASKS 432)
      const clear = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (cell(m, tx + i, ty + j) !== 1) return false;
        return !m.traps.some((t) => Math.hypot(t.x - x, t.y - y) < 70) && m.hazards.every((q) => q === z || Math.hypot(q.x - x, q.y - y) > HZ[q.k].r + 60); };
      // (further round it and further out when the four sides are not clear: the packs of TASKS 407 shifted the floor seed 3 draws)
      const off = [40, 70, 100].flatMap((g) => Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * (H.r + g), Math.sin(i * Math.PI / 4) * (H.r * 0.6 + g)])).find(([dx, dy]) => clear(z.x + dx, z.y + dy)) || [H.r + 40, 0];
      const inside = run(z.x + 8, z.y), outside = run(z.x + off[0], z.y + off[1]);
      if (!(Math.abs(inside.lead - H.warn) < 0.05)) out.push(`magma hazards: a ${k}'s warning comes ${inside.lead.toFixed(2)} s before its burst, not ${H.warn}`);
      if (inside.lost < stats(h, Z.meta).maxHp * H.hp * 0.75 || inside.lost > stats(h, Z.meta).maxHp * H.hp * 2.5) out.push(`magma hazards: a ${k} in its ring takes ${inside.lost} health from the hero`);
      if (H.burn && !inside.burn) out.push(`magma hazards: a vent does not set the hero alight`);
      if (inside.mob <= 0) out.push(`magma hazards: a ${k} does not hurt a monster in its ring`);
      if (outside.lost > 0) out.push(`magma hazards: a ${k} hurts the hero out of its ring`); }
    // a terrace's surge (TASKS 475): it creeps up over its warning and floods its band HAZ.surge.warn later; the hero on it is hurt
    // once and set alight, a monster on it hurt, the hero a few cells off it not
    { const Z = spawn(0, {}); Z.screen = 'play'; let z = null;
      for (let sd = 3; sd < 60 && !z; sd++) { Z.run = newRun(Z, 'magma', sd); for (let f = 2; f < D.RUNS.magma.floors && !z; f++) { enterFloor(Z, Z.run, f); const m0 = Z.run.map; if (m0.ftype === 'terrace' && !m0.ftype2) z = (m0.hazards || []).find((q) => q.k === 'surge'); } }
      if (!z) out.push('magma hazards: no surge on a terrace floor of 57 runs');
      else { const R2 = Z.run, m = R2.map, h = R2.hero, H = HZ.surge, W = m.W, i0 = m.hazards.indexOf(z), at = (c) => (((c / z.per - z.ph) % 1 + 1) % 1 + Math.ceil(Z.t / z.per + 2)) * z.per;
        const cx = (k) => (k % W + 0.5) * TILE, cy = (k) => (Math.floor(k / W) + 0.5) * TILE, k0 = z.cells[z.lv.indexOf(Math.max(...z.lv))], cd = (a, b) => Math.max(Math.abs(a % W - b % W), Math.abs(Math.floor(a / W) - Math.floor(b / W)));
        let k1 = -1; for (let k = 0; k < W * m.H && k1 < 0; k++) if (m.cells[k] === 1 && cd(k, k0) <= 9 && z.cells.every((q) => cd(q, k) >= 4) && [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].every((o) => m.cells[k + o] === 1)) k1 = k;
        const mob = { id: R2.nextId++, type: 'skeleton', x: cx(k0), y: cy(k0), vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'idle', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: -9 };
        const run = (k) => { R2.en = [Object.assign({}, mob, { haz: {} })]; h.haz = {}; h.ifr = 0; h.burn = 0; h.dashT = -9; h.hp = stats(h, Z.meta).maxHp;
          Z.t = R2.t = at(z.per - H.warn - 0.1); Z.ev = []; const hp0 = h.hp; let warnT = -1, burstT = -1, creep = 0;
          for (let i = 0; i < Math.round((H.warn + 0.6) * 120); i++) { h.x = cx(k); h.y = cy(k); h.vx = h.vy = 0; R2.en[0].x = mob.x; R2.en[0].y = mob.y; step(Z, { keys: [] });
            for (const e of Z.ev) { if (e.k === 'hazwarn' && e.i === i0 && warnT < 0) warnT = e.t; if (e.k === 'surge' && e.i === i0 && burstT < 0) burstT = e.t; } Z.ev = [];
            if (warnT >= 0 && burstT < 0) creep = Math.max(creep, D.surgeLevel(z, Z.t)); }
          return { lost: hp0 - h.hp, burn: h.burn > Z.t - 0.6, mob: 999 - R2.en[0].hp, lead: burstT - warnT, creep }; };
        const inside = run(k0), outside = k1 >= 0 ? run(k1) : null;
        if (!(Math.abs(inside.lead - H.warn) < 0.05)) out.push(`magma hazards: a surge's warning comes ${inside.lead.toFixed(2)} s before its flood, not ${H.warn}`);
        if (!(inside.creep > H.creep * 0.8 && inside.creep <= H.creep)) out.push(`magma hazards: a surge creeps up to ${inside.creep.toFixed(2)} of its band over its warning, not ${H.creep}`);
        if (inside.lost < stats(h, Z.meta).maxHp * H.hp * 0.75 || inside.lost > stats(h, Z.meta).maxHp * H.hp * 2.5) out.push(`magma hazards: a surge takes ${inside.lost} health from the hero on its band`);
        if (!inside.burn) out.push('magma hazards: a surge does not set the hero alight');
        if (inside.mob <= 0) out.push('magma hazards: a surge does not hurt a monster on its band');
        if (!outside) out.push('magma hazards: no floor off the surge to stand on by it');
        else if (outside.lost > 0) out.push('magma hazards: a surge hurts the hero off its band'); } }
    // the brink (TASKS 476): a skeleton a cell off the lava is marked by it; a blow toward the lava drives it BRINK.kb times as far
    // as a blow away from it
    { const Z = spawn(0, {}); plainRun(Z); Z.screen = 'play'; const R2 = Z.run, m = R2.map, W = m.W; let k0 = -1;
      for (let k = W * 4; k < W * (m.H - 4) && k0 < 0; k++) if (m.cells[k] === 1 && dropCell(m, (k + 1) % W, Math.floor((k + 1) / W)) && dropCell(m, (k + 2) % W, Math.floor((k + 2) / W)) && [-1, -2, -3, -W, W, -W - 1, W - 1].every((o) => m.cells[k + o] === 1)) k0 = k;
      if (k0 < 0) out.push('magma brink: no floor by the lava on the first plain floor');
      else { const x = (k0 % W + 0.75) * TILE, y = (Math.floor(k0 / W) + 0.5) * TILE, mk = () => ({ id: R2.nextId++, type: 'skeleton', x, y, vx: 0, vy: 0, hp: 999, max: 999, dmg: 0, elite: 0, room: -1, st: 'chase', t0: 0, face: 1, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: -9 });
        const e1 = mk(), e2 = mk(); R2.en = [e1, e2]; if (!brinkOf(m, e1)) out.push('magma brink: a skeleton a step off the lava is not marked');
        hitEnemy(Z, R2, e1, 1, false, x - 40, y); hitEnemy(Z, R2, e2, 1, false, x + 40, y);
        if (!(Math.abs(e1.kbx) > Math.abs(e2.kbx) * D.BRINK.kb * 0.95)) out.push(`magma brink: a blow toward the lava drives ${Math.round(e1.kbx)} against ${Math.round(e2.kbx)} away from it`); } }
    // (TASKS 486) on a lake's or a river's floor the stairs' room shows as the hero first stands by the water on his side of it
    for (const ft of ['lake', 'river']) { let Y = null; for (let sd = 1; sd < 30 && !Y; sd++) { const Q = spawn(0, {}); Q.run = newRun(Q, 'magma', sd); Q.screen = 'play';
        for (let f = 1; f <= 3 && !Y; f++) { enterFloor(Q, Q.run, f); if (Q.run.map.ftype === ft && !Q.run.map.ftype2) Y = Q; } }
      if (!Y) { out.push(`magma choice: no ${ft} floor in 29 runs`); continue; } const R3 = Y.run, m3 = R3.map, e3 = m3.exit.ty * m3.W + m3.exit.tx;
      if (!m3.choice) { out.push(`magma choice: a ${ft} floor without its choice shown`); continue; }
      if (R3.seen[e3]) out.push(`magma choice: the stairs of a ${ft} floor seen from the start`);
      const k = m3.choice.at[0]; R3.hero.x = (k % m3.W + 0.5) * TILE; R3.hero.y = (Math.floor(k / m3.W) + 0.5) * TILE; step(Y, { keys: [] });
      if (!R3.seen[e3]) out.push(`magma choice: the stairs of a ${ft} floor do not show from its first bank`); }
    // (and on each such floor of a run, not the first alone: the flag was the run's, PR #26 review, seed 3's 3rd stayed dark after its 2nd)
    { let Y = null; for (let sd = 1; sd < 30 && !Y; sd++) { const Q = spawn(0, {}); Q.run = newRun(Q, 'magma', sd); Q.screen = 'play'; let n = 0;
        for (let f = 1; f <= 3; f++) { enterFloor(Q, Q.run, f); if (Q.run.map.choice) n++; } if (n >= 2) Y = [Q, sd]; }
      if (!Y) out.push('magma choice: no run with two floors of a choice in 29'); else { const [Q, sd] = Y; Q.run = newRun(Q, 'magma', sd); Q.screen = 'play';
        for (let f = 1; f <= 3; f++) { enterFloor(Q, Q.run, f); const R4 = Q.run, m4 = R4.map; if (!m4.choice) continue; const k = m4.choice.at[0];
          R4.hero.x = (k % m4.W + 0.5) * TILE; R4.hero.y = (Math.floor(k / m4.W) + 0.5) * TILE; step(Q, { keys: [] });
          if (!R4.seen[m4.exit.ty * m4.W + m4.exit.tx]) out.push(`magma choice: run seed ${sd} f${f}: the stairs do not show from its first bank after an earlier floor's choice`); } } }
    // (TASKS 1037) a walk of 60 cells toward the stairs leaves no closed pocket of unseen open cells by its way
    for (const [ft, sd] of [['lake', 2], ['terrace', 5], ['lake', 9]]) { let Y = null; for (let s2 = sd; s2 < sd + 20 && !Y; s2++) { const Q = spawn(0, {}); Q.run = newRun(Q, 'magma', s2); Q.screen = 'play';
        for (let f = 1; f <= 3 && !Y; f++) { enterFloor(Q, Q.run, f); if (Q.run.map.ftype === ft && !Q.run.map.ftype2) Y = Q; } }
      if (!Y) continue; const R4 = Y.run, m4 = R4.map, W4 = m4.W, h4 = R4.hero, s4 = Math.floor(h4.y / TILE) * W4 + Math.floor(h4.x / TILE), e4 = m4.exit.ty * W4 + m4.exit.tx, prev = new Map([[s4, -1]]), qq = [s4];
      for (let i = 0; i < qq.length && !prev.has(e4); i++) for (const o of [1, -1, W4, -W4]) { const n = qq[i] + o; if (!prev.has(n) && (m4.cells[n] === 1 || m4.cells[n] === 6)) { prev.set(n, qq[i]); qq.push(n); } }
      const way = []; for (let k = prev.has(e4) ? e4 : -1; k >= 0; k = prev.get(k)) way.unshift(k); R4.en = [];
      for (const k of way.slice(0, 60)) { h4.x = (k % W4 + 0.5) * TILE; h4.y = (Math.floor(k / W4) + 0.5) * TILE; step(Y, { keys: [] }); }
      const near = new Set(); for (const k of way.slice(0, 60)) for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) near.add(k + j * W4 + i);
      const got = new Set(); let pockets = 0;
      for (const k0 of near) { const x0 = k0 % W4, y0 = Math.floor(k0 / W4); if (x0 <= 0 || y0 <= 0 || x0 >= W4 - 1 || y0 >= m4.H - 1 || R4.seen[k0] || got.has(k0) || (m4.cells[k0] !== 1 && m4.cells[k0] !== 3)) continue;
        const q = [k0]; got.add(k0); let closed = true;
        for (let i = 0; i < q.length && closed; i++) { const qx = q[i] % W4, qy = Math.floor(q[i] / W4); if (qx <= 0 || qy <= 0 || qx >= W4 - 1 || qy >= m4.H - 1 || q.length > 40) { closed = false; break; }
          for (const o of [1, -1, W4, -W4]) { const n = q[i] + o; if (R4.seen[n] || got.has(n)) continue; if (m4.cells[n] !== 1 && m4.cells[n] !== 3) { closed = false; break; } got.add(n); q.push(n); } }
        if (closed) pockets++; }
      if (pockets) out.push(`magma fog: ${pockets} closed unseen pocket(s) by the walk on a ${ft} floor`); }
    return out;
  }

  function heroDeathCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 777); S.screen = 'play'; const R = S.run, h = R.hero;
    const put = (perk) => { R.en = []; S.ev.length = 0; h.hp = heroSt(S).maxHp; h.deadT = -1; h.ifr = 0; h.dashT = -9; h.revived = 0; h.perks = perk ? { [perk]: 1 } : {}; };
    const dies = () => S.ev.filter((e) => e.k === 'die').length;
    put(); hurtHero(S, R, 1e5, h.x + 30, h.y, 'spike');
    if (!(h.deadT >= 0 && h.hp === 0 && dies() === 1)) out.push(`hero death: a lethal blow leaves deadT ${h.deadT}, hp ${h.hp}, ${dies()} die events`);
    const t0 = h.deadT; S.t += 1; SIMX.killHero(S, R); if (h.deadT !== t0 || dies() !== 1) out.push('hero death: a second kill restarts the death or doubles the die event');
    put(); S.t = 0.3; S.t -= 0.8; SIMX.killHero(S, R); S.t += 0.8; SIMX.killHero(S, R);
    if (dies() !== 1) out.push('hero death: a kill with a negative deadT is let through twice');
    put('phoenix'); hurtHero(S, R, 1e5, h.x + 30, h.y, 'spike'); if (h.deadT >= 0 || dies()) out.push('hero death: a phoenix gift does not save the hero from the first lethal blow');
    const ran = () => Math.hypot(h.deadRun[0], h.deadRun[1]) > 0.5 * K.RUN;
    put(); h.vx = h.vy = 0; hurtHero(S, R, 1e5, h.x + 30, h.y, 'spike');
    if (!(Math.hypot(h.vx, h.vy) > 0.5 * K.RUN) || ran()) out.push(`hero death: killed standing he falls as from a run (shove ${Math.hypot(h.vx, h.vy).toFixed(0)}, deadRun ${h.deadRun})`);
    put(); h.vx = K.RUN; h.vy = 0; hurtHero(S, R, 1e5, h.x + 30, h.y, 'spike');
    if (!ran() || h.deadRun[0] !== K.RUN) out.push(`hero death: killed running into the blow he does not fall as from a run (deadRun ${h.deadRun})`);
    return out;
  }

  // TASKS 1977: attack speed per floor of the campaign, the hero a level ahead of it in rare gear of his level: the typical kit (attack speed on
  // the weapon and the gloves at a mid roll, the leather pieces' own, a haste gift from floor 4) never passes the cap and nears it only by the
  // campaign's end; a stacked one (the best roll on every slot, three haste gifts, every point in agility) is held at the cap
  function aspdCheck() {
    const out = [], cap = D.ASPD.cap, A = D.AFFIXES.find((a) => a.k === 'aspd'), N = D.RUNS.campaign.floors;
    for (const cls of ['warrior', 'mage', 'archer']) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 7, { cls }); const h = S.run.hero, C = D.CLASSES[cls], top = {};
      const slots = {}; for (const k in BASES) if (BASES[k].slot && D.wears(cls, k)) (slots[BASES[k].slot] = slots[BASES[k].slot] || []).push(k);
      const kit = (f, build) => { const lvl = f + 1, stack = build === 'stack', rar = stack ? 3 : 2, main = build === 'main' ? (cls === 'archer' ? 'agi' : cls === 'mage' ? 'int' : 'str') : 'agi';
        h.lvl = lvl; h.perks = { haste: stack ? 3 : f >= 4 ? 1 : 0 }; h.base = Object.assign({}, C.base); h.base[main] += (lvl - 1) * C.grow.pts;
        for (const sl in h.eq) { const ks = slots[sl] || [], bk = ks.find((k) => (BASES[k].typed || {}).aspd) || ks[0]; if (!bk) { h.eq[sl] = null; continue; }
          const roll = stack ? 1.3 : sl === 'weapon' || sl === 'gloves' ? 1 : 0;
          h.eq[sl] = itemPower({ id: 1, b: bk, rar, lvl, mods: roll ? { aspd: Math.max(1, Math.round((A.a + A.b * lvl) * roll * (1 + 0.15 * rar))) } : {} }); }
        return stats(h, S.meta); };
      for (let f = 1; f <= N; f++) for (const build of ['main', 'agi', 'stack']) { const st = kit(f, build);
        if (st.aspd > cap + 1e-9) out.push(`aspd: a ${cls} (${build}) on floor ${f} swings ${st.aspd.toFixed(1)} % faster, over the ${cap} % cap`);
        if (build !== 'stack') { top[build] = st.aspd; if (f <= N / 2 && st.aspd >= 0.75 * cap) out.push(`aspd: a ${cls} (${build}) is at ${st.aspd.toFixed(1)} % by floor ${f}, the cap is near half way down`);
          if (f <= N - 5 && st.aspd >= cap) out.push(`aspd: a ${cls} (${build}) reaches the cap on floor ${f}`); } }
      if (!(Math.max(top.main, top.agi) >= 0.8 * cap)) out.push(`aspd: a ${cls} ends the campaign at ${Math.max(top.main, top.agi).toFixed(1)} %, far from the ${cap} % cap`); }
    return out;
  }
  SIMX.checks.add('playCheck', playCheck, { slow: true });
  SIMX.checks.add('meleeSpacingCheck', meleeSpacingCheck);
  SIMX.checks.add('reactionCheck', reactionCheck);
  SIMX.checks.add('hazardCheck', hazardCheck, { slow: true });
  SIMX.checks.add('heroDeathCheck', heroDeathCheck);
  SIMX.checks.add('aspdCheck', aspdCheck);
})(typeof window !== 'undefined' ? window : globalThis);
