// live/sim_checks.js — the sim's self-checks for tune.cjs: SIM.selfCheck() → [failure strings] (engine.md §6). Node only:
// sim.js requires it, the page never loads it (ARCHITECTURE.md §4.2). It reads the sim's inside through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  if (typeof module !== 'undefined') { require('./sim_checks_powers.js'); require('./sim_checks_ui.js'); }
  const {
    ABILITIES, ARROW_Y, BAL, BASES, CRUST, D, DG, DOOM, DT, ENEMIES, FROM, K, LOOT, MOD, RARITY, REWARD, STAGE, TILE, UI, WADE, addFire,
    aggroRoom, angDiff, bagAdd, arenaPath, arenaSealed, begin, beginBossMove, boardOffers, bossEggs, bossLava, bossRaise, bossThink, bossWebs,
    boxHit, brinkOf, castAbility, cell, colossusBoulder, colossusRain, completion, completionHints, counted, crustAt, damageName, deepBody,
    dep, descend, doorLock, dropCell, endRun, enterFloor, floorStat, flow, folkFree, folkOf, folkR, fstat, heroHit, heroSt, hidden,
    hitEnemy, hitFolk, hitProps, hurtHero, inRoom1, inStart, inWater, interact, isCons, itemMods, itemPower, journalOf,
    campaignDone, exitKind, killEnemy, lastFloor, lootAudit, losClear, move, newQuest, newRun, offerOf, offersOf, onLava, openAltar, openChest, openDoor,
    openSecret, persist, poolOk, potion, questFloor, questMark, questMarks, rebalanceRun, reveal, rnd, rollAffixes, rollItem, runCompletion,
    runReward, scriptInput, secretMask, serpent, serpentMouth, secretUnder, shelfOf, solidAt, solidC, solids, spawn, springAmbush, startRun, stats,
    stashOf, steer, step, stepArena, stepBossMove, stepDrops, stepProjectiles, stockShop, struck, takeQuest, tearWebs, throwAway, toPx, tradeDepth,
    turnIn, typeMods, heroShot, under, useItem, usePotion, wearIfFree, who, wideClear } = root.SIMX;
  // the checks that start a game from the menu for something else skip the Keeper's welcome (TASKS 1849), which holds the hero
  const noWelcome = (S) => { if (S.run && S.run.greet === 1) S.run.greet = 'done'; };
  // level data checks for tune.cjs: every floor of several seeds — spawns on open floor and outside the start room, exit reachable
  function menuCheck() {
    const out = [];
    { const T = spawn(0, { meta: { zoom: 2, up: {} } }), at = (rs, id) => { const b = rs.find((q) => q.id === id); return { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }; };
      if (T.meta.zoom !== 1.5) out.push('settings: a saved ×2 does not become ×1,5');
      step(T, at(UI.menu(false, T.meta.diff, 0), 'settings')); step(T, { keys: ['ArrowLeft'] });
      if (T.screen !== 'settings' || T.meta.zoom !== 1.25) out.push('settings: the menu does not open them, or ← does not step the zoom');
      const r = UI.settings().r.find((q) => q.id === 'zoom'); step(T, { keys: [], click: 1, press: 1, px: r.x, py: r.y + r.h / 2 });
      if (T.meta.zoom !== D.ZOOMS[0]) out.push('settings: a click at the slider\'s left end does not set ×0,5');
      step(T, { keys: [], press: 0 }); step(T, { keys: ['ArrowDown'] }); step(T, { keys: ['ArrowRight'] }); if (T.meta.bright !== 1.2) out.push('settings: → on the brightness row does not brighten one step');
      step(T, { keys: ['ArrowDown'] }); step(T, { keys: ['ArrowLeft'] }); if (T.meta.vol !== 0.75) out.push(`settings: ← on the volume row does not step it down (${T.meta.vol})`);
      // TASKS 1864: the fullscreen row is a checkbox, a click or Enter on it flips the wish kept in the meta
      const fr = UI.settings().r.find((q) => q.id === 'full'), n1 = T.saveN; step(T, { keys: [], press: 0 }); step(T, { keys: [], click: 1, press: 1, px: fr.x + fr.w / 2, py: fr.y + fr.h / 2 }); step(T, { keys: [], press: 0 });
      if (T.meta.full !== 1 || T.saveN === n1) out.push('settings: a click on «Полный экран» does not ask for the full screen, or the wish is not kept');
      step(T, { keys: ['Enter'] }); if (T.meta.full !== 0 || T.screen !== 'settings') out.push('settings: Enter on «Полный экран» does not turn it off');
      step(T, { keys: ['Escape'] }); if (T.screen !== 'menu') out.push('settings: Escape does not go back to the menu');
      // TASKS 1863 а: M mutes from any screen and says so, a second M gives the sound back
      const n0 = T.saveN; step(T, { keys: ['KeyM'] }); if (!T.meta.mute || T.muteT !== T.t || T.saveN === n0) out.push('mute: M does not mute, or the mute is not kept');
      step(T, { keys: ['KeyM'] }); if (T.meta.mute) out.push('mute: a second M does not give the sound back'); }
    // TASKS 1784: a zoom changed from the pause moves the camera at once, the world behind the pause framed as play will frame it
    { const T = spawn(0, { meta: { zoom: 1, up: {} } }); T.run = newRun(T, 'campaign', 31); T.screen = 'play'; for (let i = 0; i < 20; i++) step(T, { keys: [] });
      const R = T.run, h = R.hero; T.screen = 'pause'; step(T, { keys: [], click: 1, px: UI.pause(T.meta.zoom).find((q) => q.id === 'settings').x + 10, py: UI.pause(T.meta.zoom).find((q) => q.id === 'settings').y + 10 });
      step(T, { keys: ['ArrowLeft'] }); const z = R.zoom, cw = SIMX.WIN(R), mid = [R.cam[0] + cw.W / 2, R.cam[1] + cw.H / 2], c0 = [R.cam[0], R.cam[1]]; SIMX.snapCam(R);
      if (T.screen !== 'settings' || z === 1 || Math.hypot(R.cam[0] - c0[0], R.cam[1] - c0[1]) > 1 || Math.hypot(mid[0] - h.x, mid[1] - h.y) > cw.W / 2) out.push('settings: a zoom changed from the pause leaves the camera where the old zoom had it'); }
    // TASKS 1861: in a 16:10 view the windows' frame moves down, the menu's to the bottom edge and the rest to the middle, and a
    // click lands where the frame drew the button
    { const h0 = SIMX.VIEW.H; SIMX.setView(1200);
      try { const T = spawn(0, { meta: { up: {} } }), at = (scr, rs, id) => { const b = rs.find((q) => q.id === id); return { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 + SIMX.uiDy(scr) }; };
        if (SIMX.uiDy('menu') !== 120 || SIMX.uiDy('settings') !== 60 || SIMX.uiDy('play') !== 0) out.push(`view 16:10: the frame's shift is ${SIMX.uiDy('menu')} / ${SIMX.uiDy('settings')}, not 120 / 60`);
        step(T, at('menu', UI.menu(false, T.meta.diff, 0), 'settings')); if (T.screen !== 'settings') out.push('view 16:10: a click on «Настройки» misses');
        step(T, at('settings', UI.settings().r, 'back')); if (T.screen !== 'menu') out.push('view 16:10: a click on the settings\' «Назад» misses');
        const R = SIMX.newRun(T, 'campaign', 5); T.run = R; T.screen = 'play'; R.cam = [0, 1e6]; SIMX.clampCam(R, R.cam);
        if (R.cam[1] + 1200 / SIMX.zoomOf(R) > R.map.H * D.TILE + 300 + 1) out.push('view 16:10: the camera\'s clamp keeps the 1080 window');
      } finally { SIMX.setView(h0); } }
    { const T = spawn(0, { meta: { up: {} } }), at = (rs, id) => { const b = rs.find((q) => q.id === id); return { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }; };
      if (UI.menu(false).some((q) => q.id === 'diff')) out.push('start: the menu still has its difficulty item');
      step(T, at(UI.menu(false), 'campaign')); if (T.screen !== 'classes') out.push('start: «Старт» does not open the difficulty and class screen');
      step(T, { keys: ['ArrowUp'] }); step(T, { keys: ['ArrowRight'] }); if (T.meta.diff !== 'hard') out.push('start: ↑ then → do not pick the hard difficulty');
      step(T, { keys: ['ArrowDown'] }); step(T, { keys: ['ArrowRight'] }); if (T.meta.cls !== D.classesReady()[1]) out.push('start: ↓ then → do not pick the next class');
      step(T, at(UI.classes(T.meta), 'dif:easy')); if (T.meta.diff !== 'easy') out.push('start: a click on a tab does not pick its difficulty');
      step(T, { keys: ['Escape'] }); step(T, at(UI.menu(false), 'campaign')); if (T.meta.diff !== 'easy' || T.meta.cls !== D.classesReady()[1]) out.push('start: the chosen difficulty and class are not kept');
      step(T, { keys: ['Enter'] }); if (!T.run || T.run.diff !== 'easy' || T.run.hero.cls !== D.classesReady()[1]) out.push('start: Enter does not start the run with the chosen difficulty and class'); }
    { const T = spawn(0, { meta: { runs: 5, wins: 1, up: {} } }), F = spawn(0, {}), key = (k) => step(T, { keys: [k] });
      if (T.meta.stats.from !== 5 || F.meta.stats.from !== 0) out.push('stats: the counters do not note the runs finished before them');
      T.run = newRun(T, 'campaign', 7, { cls: 'mage' }); T.screen = 'play'; const R = T.run;
      for (let i = 0; i < 120; i++) step(T, { keys: [] });
      const foe = R.en.find((e) => !D.BOSSES[e.type]); foe.elite = 1; killEnemy(T, R, foe); SIMX.giveShards(T, R, 3, R.hero.x, R.hero.y, ''); endRun(T, 'dead');
      const A = T.meta.stats.all, M = T.meta.stats.cls.mage || {};
      if (A.kills !== 1 || A.elites !== 1 || A.bosses || A.deaths !== 1 || A.runs !== 1 || M.runs !== 1 || M.kills !== 1 || !(A.time > 0.9) || !(A.shards >= 3) || A.shards !== M.shards) out.push('stats: a run\'s kill, elite, death, time or shards are not counted, or not for its class');
      if (T.meta.runs !== 6) out.push('stats: the meta\'s run count changed its rule');
      const L2 = spawn(1, JSON.parse(JSON.stringify(persist(T)))); if (L2.meta.stats.from !== 5 || L2.meta.stats.all.kills !== 1) out.push('stats: the counters are lost or restarted on load');
      const D0 = SIMX.spawn(0, {}); D0.demo = 1; D0.run = newRun(D0, 'campaign', 7); D0.screen = 'play'; for (let i = 0; i < 60; i++) step(D0, { keys: [] }); if (D0.meta.stats.all.time) out.push('stats: the attract demo counts into the player\'s time');
      T.screen = 'menu'; step(T, (() => { const b = UI.menu(false).find((q) => q.id === 'stats'); return { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }; })());
      if (T.screen !== 'stats' || T.statTab !== 'all') out.push('stats: the menu does not open the statistics');
      step(T, { keys: [], press: 0 }); key('ArrowRight'); if (T.statTab !== D.classesReady()[0] || T.focus !== 'tab:' + T.statTab) out.push('stats: → does not open the first class\'s tab');
      key('ArrowDown'); if (T.focus !== 'back') out.push('stats: ↓ does not reach «Назад»');
      key('Enter'); if (T.screen !== 'menu') out.push('stats: Enter on «Назад» does not go back to the menu'); }
    { const { slotRun, isFull } = SIMX, key = (S, k) => step(S, { keys: [k] }), J = (o) => JSON.parse(JSON.stringify(o));
      const at = (S, rs, id) => { const b = rs.find((q) => q.id === id); step(S, { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }); step(S, { keys: [], press: 0 }); };
      { const d = D.dateOf(1794182340000); if (d.d !== 8 || d.m !== 11 || d.y !== 2026 || d.h !== 23 || d.mi !== 59) out.push('saves: dateOf does not read 08.11.2026 23:59'); }
      const S0 = spawn(0, {}), old = J(newRun(S0, 'campaign', 21));
      const T = spawn(0, { meta: { up: {} }, run: old });
      if (!T.saved || T.slot !== 0 || T.saves.length !== D.SAVE_SLOTS || T.saves.some(Boolean) || slotRun(T, 0) !== T.saved) out.push('saves: a save from before the slots does not land in the first slot');
      T.screen = 'menu'; at(T, UI.menu(true), 'campaign'); if (T.screen !== 'classes') out.push('saves: with free slots a new run still asks to drop the saved one');
      key(T, 'Enter'); const fresh = T.run;
      if (!fresh || T.slot !== 1 || T.saves[0] !== old && (!T.saves[0] || T.saves[0].seed !== old.seed)) out.push('saves: a new run does not take a free slot, or the old run leaves its slot');
      T.screen = 'play'; step(T, { keys: [], now: 1794182340000 }); if (fresh.at !== 1794182340000) out.push('saves: the run in play does not keep the page\'s wall clock');
      T.screen = 'pause'; T.focus = 'dif:easy'; at(T, UI.pause(T.meta.zoom), 'save'); if (T.screen !== 'menu' || T.saved !== fresh) out.push('saves: «Сохранить и выйти» does not keep the run in its slot');
      if (T.focus) out.push('saves: back in the menu after «Сохранить и выйти» the focus is left from another screen (TASKS 1860)');
      const L2 = spawn(1, J(persist(T))); if (L2.slot !== 1 || !L2.saved || L2.saved.at !== 1794182340000 || !L2.saves[0] || L2.saves[0].seed !== old.seed || L2.saves.filter(Boolean).length !== 1) out.push('saves: the slots are not kept through save and load');
      at(L2, UI.menu(true), 'load'); if (L2.screen !== 'load' || L2.loadSel !== 1) out.push('saves: «Загрузить игру» does not open the list on the saved run');
      key(L2, 'ArrowUp'); key(L2, 'Enter'); if (L2.screen !== 'play' || !L2.run || L2.run.seed !== old.seed || L2.slot !== 0 || !L2.saves[1] || L2.saves[1].at !== 1794182340000) out.push('saves: ↑ and Enter do not load the first slot and keep the other');
      L2.screen = 'pause'; at(L2, UI.pause(L2.meta.zoom), 'save'); at(L2, UI.menu(true), 'load'); key(L2, 'ArrowDown');
      key(L2, 'Delete'); if (L2.delAsk !== 1 || L2.focus !== 'no') out.push('saves: Delete does not ask about the chosen slot with «Нет» first');
      key(L2, 'Enter'); if (L2.delAsk !== undefined || !L2.saves[1]) out.push('saves: «Нет» deletes the save or keeps asking');
      key(L2, 'Delete'); { const b = UI.load().yes.find((q) => q.id === 'yes'); step(L2, { keys: [], px: b.x + b.w / 2, py: b.y + b.h / 2 }); }
      if (L2.focus !== 'yes') out.push('saves: the pointer moved over «Да» does not take the focus, two buttons light (TASKS 1754)'); key(L2, 'Escape');
      key(L2, 'Delete'); key(L2, 'ArrowLeft'); key(L2, 'Enter'); if (L2.saves[1] || L2.delAsk !== undefined || !L2.saved) out.push('saves: «Да» does not delete the slot, or deletes another');
      key(L2, 'ArrowUp'); key(L2, 'Delete'); at(L2, UI.load().yes, 'yes'); if (L2.saved || slotRun(L2, 0)) out.push('saves: deleting the saved run by pointer does not empty its slot');
      key(L2, 'Escape'); if (L2.screen !== 'menu') out.push('saves: Escape does not go back to the menu');
      const F = spawn(0, {}); for (let i = 0; i < D.SAVE_SLOTS; i++) F.saves[i] = J(newRun(F, 'campaign', 30 + i)); F.saved = F.saves[2]; F.saves[2] = null; F.slot = 2;
      if (!isFull(F)) out.push('saves: five runs do not fill the slots');
      // TASKS 1785: with every slot taken a new run asks on the question sheet («Нет» first) and takes the place of the run played
      // longest ago, the saved one under «Продолжить» only when it is that run
      F.saves.forEach((r, i) => { if (r) r.at = 100 + i; }); F.saved.at = 102; F.saves[3].at = 50;
      if (SIMX.oldestSlot(F) !== 3) out.push('saves: the oldest slot is not the run played longest ago');
      at(F, UI.menu(true, F.meta.diff, F.meta.zoom, true), 'campaign'); if (F.screen !== 'menu' || F.newAsk !== 'campaign' || F.focus !== 'no' || F.run) out.push('saves: with every slot taken one press starts a run, or asks with «Да» first');
      key(F, 'Enter'); if (F.newAsk || F.run || F.screen !== 'menu') out.push('saves: Enter on «Нет» starts the run or keeps asking');
      at(F, UI.menu(true, F.meta.diff, F.meta.zoom, true), 'campaign'); key(F, 'ArrowLeft'); key(F, 'Enter'); key(F, 'Enter');
      if (!F.run || F.slot !== 3 || F.saves.filter(Boolean).length !== 4 || !F.saves.some((r) => r && r.seed === 32) || F.saves.some((r) => r && r.seed === 33)) out.push('saves: a new run over five taken slots does not take the oldest one\'s place, or loses the saved run');
      { const G = spawn(0, {}); for (let i = 0; i < D.SAVE_SLOTS; i++) { G.saves[i] = J(newRun(G, 'campaign', 60 + i)); G.saves[i].at = 100 + i; } G.saved = G.saves[1]; G.saves[1] = null; G.slot = 1; G.saved.at = 10;
        at(G, UI.menu(true, G.meta.diff, G.meta.zoom, true), 'campaign'); at(G, UI.newAsk().r, 'yes'); key(G, 'Enter');
        if (!G.run || G.slot !== 1 || G.saves.filter(Boolean).length !== 4 || G.saves.some((r) => r && r.seed === 61)) out.push('saves: a new run does not take the place of the saved run when it is the oldest'); }
      const E = spawn(0, {}); E.saves[3] = J(newRun(E, 'campaign', 41)); E.saves[3].at = 5; E.saves[1] = J(newRun(E, 'campaign', 42)); E.saves[1].at = 9;
      E.run = newRun(E, 'campaign', 43); E.slot = 0; E.screen = 'play'; endRun(E, 'dead'); E.screen = 'menu';
      if (!E.saved || E.saved.seed !== 42 || E.slot !== 1 || E.saves[1] || !E.saves[3] || !UI.menu(!!E.saved).some((b) => b.id === 'continue')) out.push('saves: after a death «Продолжить» does not name the latest run of the other slots');
      at(E, UI.menu(true, E.meta.diff, E.meta.zoom, isFull(E)), 'continue'); if (E.screen !== 'play' || !E.run || E.run.seed !== 42) out.push('saves: «Продолжить» after a death does not load the other slot\'s run');
      const E2 = spawn(0, {}); E2.run = newRun(E2, 'campaign', 44); E2.screen = 'play'; endRun(E2, 'dead'); E2.screen = 'menu';
      if (E2.saved || UI.menu(!!E2.saved).some((b) => b.id === 'continue') || spawn(1, J(persist(E2))).saved) out.push('saves: «Продолжить» shows with no run in any slot');
      // TASKS 1812: «Продолжить» gives the hero a moment under the floor's name: the monsters wait, then go on
      { const C = spawn(0, {}); C.run = newRun(C, 'campaign', 37); C.screen = 'play'; noWelcome(C); for (let i = 0; i < 20; i++) step(C, { keys: [] });
        const R = C.run, h = R.hero, e = R.en.find((q) => q.deadT < 0); R.en = [e]; Object.assign(e, { x: h.x + 44, y: h.y, st: 'chase', t0: C.t, seenT: C.t, cdT: 0, kbx: 0, kby: 0 });
        C.screen = 'pause'; at(C, UI.pause(C.meta.zoom), 'save'); at(C, UI.menu(true), 'continue');
        const hp = h.hp, p0 = [e.x, e.y]; for (let i = 0; i < 110; i++) step(C, { keys: [] });
        if (C.run !== R || h.hp < hp || Math.hypot(e.x - p0[0], e.y - p0[1]) > 1) out.push('continue: the monsters act at once on «Продолжить»');
        for (let i = 0; i < 360; i++) step(C, { keys: [] }); if (h.hp >= hp && Math.hypot(e.x - p0[0], e.y - p0[1]) < 1) out.push('continue: the monsters still wait long after «Продолжить»'); }
      // TASKS 1815: a locked ability pressed again and again keeps one refusal plate, refreshed, not a stack of copies
      { const Z = spawn(0, {}); Z.run = newRun(Z, 'campaign', 38); const R = Z.run, A = D.clsOf(R.hero).abs.find((q) => !R.hero.ab[q.id]);
        if (!A) out.push('nope: a new hero has no locked ability to press');
        else { for (let i = 0; i < 3; i++) { castAbility(Z, R, A.id, {}); Z.t += 0.3; } const n = D.feedOf(Z.ev, Z.t).filter((q) => q.k === 'nope'), last = n.at(-1);
          if (n.length !== 1 || !last || Math.abs(last.t - (Z.t - 0.3)) > 1e-9) out.push(`nope: a locked ability pressed three times leaves ${n.length} plates, or an old one`);
          // the bus itself keeps every refusal, for whoever listens to it (review of PR 57), and two refusals without words stay two
          if (Z.ev.filter((q) => q.k === 'nope').length !== 3) out.push('nope: the event bus drops a refusal said again');
          SIMX.ev(Z, { k: 'nope' }); SIMX.ev(Z, { k: 'nope' }); if (Z.ev.filter((q) => q.k === 'nope' && !q.s).length !== 2) out.push('nope: two refusals without words come out of the bus as one'); } }
      const E3 = spawn(1, J({ meta: E.meta, run: null, slot: 0, saves: [null, null, Object.assign(J(old), { at: 3 }), null, null] })); if (!E3.saved || E3.slot !== 2) out.push('saves: a load with no named run does not name the run in the slots');
      const k2 = (S, k) => { step(S, { keys: [k] }); step(S, { keys: [] }); }, K = spawn(0, {}); K.saved = J(newRun(K, 'campaign', 45)); K.screen = 'menu'; K.focus = '';
      k2(K, 'ArrowDown'); if (K.focus !== 'campaign') out.push('menu: the first ↓ does not step past the item already sealed (TASKS 1887 г)');
      k2(K, 'ArrowDown'); k2(K, 'Enter'); if (K.screen !== 'load') out.push('menu: Enter on the focused «Загрузить игру» does not open it');
      key(K, 'Escape'); step(K, { keys: [] }); if (K.screen !== 'menu' || K.focus !== 'load') out.push('menu: back from «Загрузить игру» the focus is not on it (TASKS 1860)');
      for (const id of ['stats', 'settings']) { K.focus = id; k2(K, 'Enter'); k2(K, 'Escape'); if (K.screen !== 'menu' || K.focus !== id) out.push('menu: back from ' + id + ' by Escape the focus is not on it (TASKS 1860)'); }
      K.focus = 'settings'; k2(K, 'ArrowDown'); k2(K, 'Enter'); if (K.screen !== 'news') out.push('menu: ↓ Enter after coming back does not go on from the item left');
      K.screen = 'menu'; K.uiWas = 'menu'; K.focus = ''; k2(K, 'ArrowUp'); if (K.focus !== 'news') out.push('menu: ↑ from no focus does not reach «Что нового»');
      k2(K, 'Enter'); if (K.screen !== 'news') out.push('menu: Enter on «Что нового» does not open it');
      // TASKS 1873: the link to the whole changelog lies on the version's sheet, under its main lines, and is the menu's last stop
      { const F = UI.newsFrame(), nl = UI.menu(true).at(-1), P = F && F.P, last = F && F.rows.at(-1);
        if (!F || nl.id !== 'news' || nl.x < P.x || nl.y < P.y || nl.x + nl.w > P.x + P.w || nl.y + nl.h > P.y + P.h || (last && nl.y < last.y)) out.push('menu: the link to «Что нового» is not the last stop under the version sheet\'s lines');
        const E = UI.newsFrame([]); if (!E || E.rows.length || !(E.link.y > E.P.y)) out.push('menu: with no main lines the version sheet does not keep its heading and link'); }
      // TASKS 1877: «Выход» only where the page can close its window; ↑↓ reach it, and a press saves a run in play and asks the page to quit
      { if (UI.menu(true).some((b) => b.id === 'quit')) out.push('menu: «Выход» shows where the page cannot close its window');
        const Q = spawn(0, {}); Q.screen = 'menu'; Q.focus = ''; step(Q, { keys: [], quit: 1 }); const ids = UI.menu(false, 0, 0, false, true).map((b) => b.id);
        if (!Q.canQuit || ids.at(-2) !== 'quit') out.push('menu: the desktop page\'s menu has no «Выход» before the version\'s link');
        k2(Q, 'ArrowUp'); k2(Q, 'ArrowUp'); if (Q.focus !== 'quit') out.push('menu: ↑ does not reach «Выход»');
        const R = Q.run = newRun(Q, 'campaign', 46); k2(Q, 'Enter'); if (Q.quitReq !== 1 || Q.run || Q.saved !== R) out.push('menu: «Выход» does not save the run in play and ask the page to quit');
        const B = spawn(0, {}); B.screen = 'menu'; B.focus = 'quit'; step(B, { keys: ['Enter'] }); if (B.quitReq) out.push('menu: «Выход» asks to quit where the page cannot'); }
      K.screen = 'menu'; K.uiWas = 'menu'; K.focus = ''; k2(K, 'Enter'); if (K.screen !== 'play' || !K.run || K.run.seed !== 45) out.push('menu: Enter with no focus does not continue the saved run'); }
    { const { loadSlot, slotRun } = SIMX, J = (o) => JSON.parse(JSON.stringify(o)), play = (S, n) => { S.screen = 'play'; for (let i = 0; i < n; i++) step(S, { keys: [] }); };
      const save = (S) => { const b = UI.pause(S.meta.zoom).find((q) => q.id === 'save'); S.screen = 'pause'; step(S, { keys: [], click: 1, press: 1, px: b.x + b.w / 2, py: b.y + b.h / 2 }); step(S, { keys: [], press: 0 }); };
      const mage = (S, n) => { S.meta.cls = 'mage'; startRun(S, 'campaign'); play(S, n); const h = S.run.hero; h.ab.shield = 1; h.mp = 1e3; castAbility(S, S.run, 'shield', {}); play(S, 30);
        return { R: S.run, slot: S.slot, sh: h.shield, left: h.shieldUntil - S.t, cd: h.cd.shield - S.t }; };
      const kept = (S, A, tag) => { if (!loadSlot(S, A.slot) || S.run !== A.R) { out.push(`saves: ${tag}: the slot does not load its run`); return; } play(S, 1);
        const h = A.R.hero, left = h.shieldUntil - S.t, cd = h.cd.shield - S.t;
        if (!(A.sh > 0 && A.left > 5 && A.cd > 1)) out.push(`saves: ${tag}: the mage's shield or cooldown did not start (${A.sh}, ${A.left.toFixed(2)}, ${A.cd.toFixed(2)})`);
        else if (h.shield !== A.sh || Math.abs(left - A.left) > 0.1 || Math.abs(cd - A.cd) > 0.1) out.push(`saves: ${tag}: the shield ${A.sh} with ${A.left.toFixed(2)}s left and the ${A.cd.toFixed(2)}s cooldown come back as ${h.shield}, ${left.toFixed(2)}s, ${cd.toFixed(2)}s`);
        if (S.ev.some((e) => e.t > S.t)) out.push(`saves: ${tag}: the loaded run sees events from the future of another run`); };
      const S1 = spawn(0, {}), A1 = mage(S1, 60); save(S1); startRun(S1, 'campaign'); play(S1, 2400); save(S1); kept(S1, A1, 'B played longer');
      const S2 = spawn(0, {}), A2 = mage(S2, 2400); save(S2); const B2 = mage(S2, 60); save(S2); kept(S2, A2, 'A played longer'); save(S2); kept(S2, B2, 'back to the shorter B');
      const L = spawn(1, J(persist(S2))), A3 = { R: slotRun(L, A2.slot), slot: A2.slot, sh: A2.sh, left: A2.left, cd: A2.cd }; kept(L, A3, 'after a reload'); }
    for (let lvl = 1; lvl <= 32; lvl++) for (const slot of D.SLOTS) {
      const bases = Object.keys(BASES).filter((b) => BASES[b].slot === slot);
      for (const b of bases) for (let rar = 0; rar < RARITY.length; rar++) {
        const it = itemPower({ b, lvl, rar, mods: {} }), next = itemPower({ b, lvl: lvl + 1, rar, mods: {} });
        for (const k of ['atk', 'def']) if (it[k]) {
          if (next[k] < it[k]) out.push(`${b} r${rar} lvl${lvl}: ${k} falls with level`);
          if (rar < RARITY.length - 1) for (const other of bases) {
            const higher = itemPower({ b: other, lvl, rar: rar + 1, mods: {} });
            if (higher[k] < it[k]) out.push(`${other} r${rar + 1} lvl${lvl}: ${k} below ${b} r${rar}`);
          }
        }
      }
    }
    for (const seed of [1, 77, 4242]) {
      const R = { rs: seed };
      for (let lvl = 1; lvl <= D.RUNS.campaign.floors; lvl++) for (let i = 0; i < 100; i++) {
        const it = rollItem(R, lvl, i % 4), expected = itemPower({ b: it.b, rar: it.rar, lvl, mods: {} });
        if (it.atk !== expected.atk || it.def !== expected.def) out.push(`seed ${seed} lvl${lvl}: rolled item has wrong power`);
        if (Object.keys(it.mods).length !== RARITY[it.rar].affixes) out.push(`seed ${seed} lvl${lvl}: wrong affix count`);
      }
    }
    {
      const S = spawn(0, {}), R = newRun(S, 'campaign', 81), h = R.hero;
      const make = (b, lvl, rar, def) => ({ id: R.nextId++, b, lvl, rar, def, mods: { vit: 3 } });
      h.eq.armor = make('leather_armor', 8, 4, 11); h.bag[2] = make('plate_armor', 6, 3, 16);
      R.drops.push({ kind: 'item', item: make('cloak', 8, 4, 7) });
      R.shop.goods[0].it = make('knight_helm', 6, 3, 8); R.shop.back.push({ it: make('leather_helm', 8, 4, 2), price: 50 });
      delete R.itemBalance;
      const T = spawn(0, { run: JSON.parse(JSON.stringify(R)) }), saved = T.saved;
      const items = [saved.hero.eq.armor, saved.hero.bag[2], saved.drops.at(-1).item, saved.shop.goods[0].it, saved.shop.back[0].it];
      for (const it of items) {
        if (it.def !== itemPower({ b: it.b, lvl: it.lvl, rar: it.rar }).def || it.mods.vit !== 3) out.push('saved equipment was not rebalanced without changing affixes');
      }
      if (items[0].def <= items[1].def) out.push('legendary lvl8 leather armor still loses to epic lvl6 plate');
      const speed = typeMods(items[0]).mspd;
      if (!(speed > typeMods({ b: 'leather_armor', lvl: 1, rar: 0 }).mspd) || itemMods(items[0]).mspd !== speed || itemMods(items[0]).vit !== 3) out.push('item type bonuses missing or not scaled');
      const before = JSON.stringify(saved); rebalanceRun(saved);
      if (JSON.stringify(saved) !== before) out.push('item rebalance is not idempotent');
      const H = JSON.parse(JSON.stringify(saved.hero)); H.eq.armor = null;
      if (Math.abs(stats(saved.hero, S.meta).mspd - stats(H, S.meta).mspd - speed) > 1e-6) out.push('leather armor speed bonus not applied');
      S.run = R; S.screen = 'play'; step(S, { keys: [] });
      if (R.itemBalance !== D.ITEM_BAL.version || h.eq.armor.def !== items[0].def) out.push('live reload equipment was not rebalanced');
    }
    return out;
  }
  function genCheck() {
    const out = [];
    // the water caves' floors (TASKS 301) are held to the campaign's rules
    // (the campaign's 9th–12th are cave floors, TASKS 339: held to the caves' rules, kind 'cave')
    // (seed 7: its 3rd and 7th floors are tombs, TASKS 378)
    const GEN = [1, 77, 4242, 90001, 7].flatMap((sd) => Array.from({ length: D.RUNS.campaign.floors }, (_, i) => ['campaign', sd, i + 1]))
      .concat([1, 77, 4242, 90001, 5, 12, 33, 2024].flatMap((sd) => Array.from({ length: D.RUNS.cave.floors }, (_, i) => ['cave', sd, i + 1])))
      // the magma caves' plateaus (TASKS 400): held to the caves' rules but the water's, and to their own
      .concat([1, 77, 4242, 5, 12, 33].flatMap((sd) => Array.from({ length: D.RUNS.magma.floors }, (_, i) => ['magma', sd, i + 1])))
      // a 5×5 cave pocket for a start room with no clear spot by the fire: the hero arrived inside the rock (run seed 93, TASKS 335)
      .concat([['campaign', 101, 9]]);
    const caveKinds = {}, shapes = {};
    for (const [run, sd, f] of GEN) { const ST = D.stageOf(run, f), mode = ST.arch === 'cave' || ST.arch === 'plateau' ? 'cave' : 'campaign', plat = ST.arch === 'plateau', lf = ST.lf, seed = (run === 'campaign' ? '' : run + ' ') + sd, m = DG.genFloor(sd * 31 + f * 1013, f, { mode: run, ...(run === 'campaign' ? { runSeed: sd } : {}) });
      const F = flow(m, Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE));
      const reachH = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return cell(m, tx, ty) === 1; };
      if (!reachH(m.spawn.x, m.spawn.y)) out.push(`seed ${seed} f${f}: spawn blocked`);
      for (const e of m.enemies) { if (!reachH(e.x, e.y) && !(ENEMIES[e.type].deep && cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 6) && !((ENEMIES[e.type].kind === 'salamander' || ENEMIES[e.type].lake) && cell(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 3)) out.push(`seed ${seed} f${f}: ${e.type} spawns in rock`); if (inStart(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) out.push(`seed ${seed} f${f}: ${e.type} in the start room`); }
      for (const c of m.chests) if (!reachH(c.x, c.y)) out.push(`seed ${seed} f${f}: chest in rock`);
      // a boss hall is shut by its doors alone (TASKS 505): no floor or lava runs up to its box past them
      { const b = m.rooms.find((q) => q.type === 'boss'), dc = new Set(m.doors.filter((d) => d.arena).flatMap((d) => d.cells.map(([x, y]) => y * m.W + x)));
        if (b && !plat && ST.arch !== 'cave') for (const [a, bb, c, d] of DG.rectsOf(b)) for (let y = bb - 1; y <= bb + d; y++) for (let x = a - 1; x <= a + c; x++) {
          if (DG.inRm(b, x, y) || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => DG.inRm(b, x + u, y + v)) || dc.has(y * m.W + x)) continue; const v = cell(m, x, y); if (v === 1 || v === 3) { out.push(`seed ${seed} f${f}: the boss hall's wall is open at ${x},${y}`); break; } } }
      if (mode === 'campaign') {
        // the rooms' shapes (TASKS 374): a wing is floor joined to its room; a pit is deep cells inside its room's box with two cells
        // of floor round it (three at the top), nothing stands on it, and no stream runs through a shaped room
        // a floor's layout (TASKS 379): all four come up over the floors checked; a catacomb's chambers are one size on its grid
        if (m.lay) shapes['lay:' + m.lay] = 1;
        // a bridge over a rift of lava and a trapped corridor (TASKS 377): the deck is floor with lava under it and beside it; the plates
        // of a run go down one line three cells apart
        for (const c of m.crossings.filter((q) => q.rift)) { shapes.rift = 1; const lu = new Set(m.lavaUnder), hor = c.axis === 'x';
          if (c.cells.some((k) => m.cells[k] !== 1 || !lu.has(k))) out.push(`seed ${seed} f${f}: a rift bridge's deck is not floor over lava`);
          if (!c.cells.some((k) => [hor ? -m.W : -1, hor ? m.W : 1].some((o) => m.cells[k + o] === 3))) out.push(`seed ${seed} f${f}: a rift bridge with no lava beside it`); }
        const runs = {}; for (const t of m.traps) if (t.run !== undefined) (runs[t.run] = runs[t.run] || []).push(t);
        for (const ps of Object.values(runs)) { shapes.gauntlet = 1; const xs = new Set(ps.map((t) => t.x)), ys = new Set(ps.map((t) => t.y)), st = (xs.size > 1 ? [...xs] : [...ys]).sort((a, b) => a - b);
          if ((xs.size > 1) === (ys.size > 1) || ps.length < 2 || st.some((v, i) => i && v - st[i - 1] !== 3 * TILE)) out.push(`seed ${seed} f${f}: a trapped corridor's plates are not in a line three cells apart`); }
        // a fortress (TASKS 380): the court is reached by its gates only, the start and the stairs lie outside its ring, and it holds
        // the altar or an elite
        // a tomb (TASKS 378) has no corridor: a floor cell outside every room is a way through a wall, a room a cell or two off it
        // on two opposite sides (secret caches aside)
        if (m.lay === 'tomb') { const rm = (x, y) => DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) >= 0, hid = secretMask(m); let loose = 0;
          for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 1; x++) { const k = y * m.W + x; if (m.cells[k] !== 1 || rm(x, y) || hid.has(k) || m.secrets.some((q) => q.front.some(([fx, fy]) => fx === x && fy === y))) continue;
            const two = (dx, dy) => [1, 2].some((d) => rm(x + dx * d, y + dy * d)) && [1, 2].some((d) => rm(x - dx * d, y - dy * d));
            if (!two(1, 0) && !two(0, 1)) loose++; }
          if (loose) out.push(`seed ${seed} f${f}: a tomb with ${loose} cells of corridor`); }
        const ct = m.rooms.find((r) => r.court);
        if (ct) { const [x0, y0, x1, y1] = ct.ring, inRing = (o) => { const x = Math.floor(o.x / TILE), y = Math.floor(o.y / TILE); return x >= x0 && x <= x1 && y >= y0 && y <= y1; };
          const mouth = []; for (let y = ct.y - 1; y <= ct.y + ct.h; y++) for (let x = ct.x - 1; x <= ct.x + ct.w; x++) if (!DG.inRm(ct, x, y) && cell(m, x, y) === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => DG.inRm(ct, x + dx, y + dy))) mouth.push([x, y]);
          let ways = 0; const seen = new Set(); for (const q of mouth) { if (seen.has(q.join())) continue; ways++; const st = [q]; seen.add(q.join()); while (st.length) { const [x, y] = st.pop(); for (const o of mouth) if (!seen.has(o.join()) && Math.abs(o[0] - x) <= 1 && Math.abs(o[1] - y) <= 1) { seen.add(o.join()); st.push(o); } } }
          if (ways !== ct.gates.length) out.push(`seed ${seed} f${f}: the fortress's court has ${ways} ways in, not its ${ct.gates.length} gates`);
          if (inRing(m.spawn) || inRing(m.exit)) out.push(`seed ${seed} f${f}: the start or the stairs inside the fortress's ring`);
          if (ct.type !== 'shrine' && !m.enemies.some((e) => e.elite && e.room === ct.id)) out.push(`seed ${seed} f${f}: the fortress's court holds neither the altar nor an elite`); }
        if (m.lay === 'catacomb') { const ch = m.rooms.filter((r) => !r.pocket && r.type !== 'secret'), [cw, cH] = D.ARCH.catacomb.grid.cell, [sx, sy] = D.ARCH.catacomb.grid.step;
          if (ch.some((r) => r.w !== cw || r.h !== cH || (r.x - ch[0].x) % sx || (r.y - ch[0].y) % sy)) out.push(`seed ${seed} f${f}: a catacomb chamber off its grid or size`); }
        for (const r of m.rooms) { if (r.shape) shapes[r.shape + (r.pit ? '*' : '')] = 1;
          for (const [a, b, c, d] of r.wings || []) for (let y = b; y < b + d; y++) for (let x = a; x < a + c; x++) if (cell(m, x, y) !== 1 && cell(m, x, y) !== 3) out.push(`seed ${seed} f${f}: room ${r.id}'s wing is not floor at ${x},${y}`);
          if (r.pit) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const inner = x >= r.x + 2 && x < r.x + r.w - 2 && y >= r.y + 3 && y < r.y + r.h - 2;
            if (inner !== (cell(m, x, y) === 6)) { out.push(`seed ${seed} f${f}: pit room ${r.id} is not a pit ringed with floor at ${x},${y}`); break; } } }
        for (const k of m.pits) if (m.cells[k] !== 6) out.push(`seed ${seed} f${f}: a pit cell is not deep`);
        // a two-level hall (TASKS 375): its drop two rows of deep cells the room's width but the steps' gap, the gap floor, both levels
        // reached on foot from the spawn, a railing along the drop
        for (const r of m.rooms) if (r.tier) { const { y: ly, sx } = r.tier;
          for (let y = ly; y <= ly + 1; y++) for (let x = r.x; x < r.x + r.w; x++) if ((x === sx || x === sx + 1) !== (cell(m, x, y) === 1) || (x !== sx && x !== sx + 1 && cell(m, x, y) !== 6)) { out.push(`seed ${seed} f${f}: two-level room ${r.id}'s drop or steps broken at ${x},${y}`); y = 1e9; break; }
          if (!m.__walk) { const d = new Uint8Array(m.W * m.H), q = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; d[q[0]] = 1;
            for (let i = 0; i < q.length; i++) for (const o of [1, -1, m.W, -m.W]) { const n = q[i] + o; if (!d[n] && m.cells[n] === 1) { d[n] = 1; q.push(n); } } m.__walk = d; }
          const reach = (y) => { for (let x = r.x; x < r.x + r.w; x++) if (m.__walk[y * m.W + x]) return true; return false; };
          if (!reach(ly - 1) || !reach(ly + 2)) out.push(`seed ${seed} f${f}: a level of two-level room ${r.id} is out of reach`);
          if (!m.decor.some((d) => d.n === 'balustrade' && d.r === r.id) || !m.decor.some((d) => d.steps && d.r === r.id)) out.push(`seed ${seed} f${f}: two-level room ${r.id} without its railing or its steps`); }
        // a nook (TASKS 376) is a dead end: one way in, no wider than a corridor; and some corridor runs three cells wide
        for (const r of m.rooms) if (r.pocket) { const mouth = []; for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (!DG.inRm(r, x, y) && cell(m, x, y) === 1 && DG.roomAt(m, (x + 0.5) * TILE, (y + 0.5) * TILE) < 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => DG.inRm(r, x + dx, y + dy))) mouth.push([x, y]);
          // (one way: the cells by its mouth meet each other within six cells of it without passing through it)
          const near = (x, y) => x >= r.x - 6 && x < r.x + r.w + 6 && y >= r.y - 6 && y < r.y + r.h + 6, got = new Set(mouth.length ? [mouth[0].join()] : []), st = mouth.slice(0, 1);
          while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (!got.has(X + ',' + Y) && near(X, Y) && !DG.inRm(r, X, Y) && cell(m, X, Y) === 1) { got.add(X + ',' + Y); st.push([X, Y]); } } }
          if (r.type === 'start' || r.type === 'exit' || !mouth.length || mouth.some((q) => !got.has(q.join())) || mouth.length > 6) out.push(`seed ${seed} f${f}: nook ${r.id} is no dead end (${r.type}, ${mouth.length} cells by it)`); }
        for (let k = m.W; k < m.cells.length - 2 * m.W && !shapes.wide; k++) if ([0, 1, 2].every((j) => [0, 1, 2].every((i) => m.cells[k + j * m.W + i] === 1 && DG.roomAt(m, ((k + i) % m.W + 0.5) * TILE, (Math.floor(k / m.W) + j + 0.5) * TILE) < 0))) shapes.wide = 1;
        for (const o of [...m.chests, ...m.pots, ...m.decor, ...m.torches.filter((q) => q.kind !== 'wall'), ...m.traps]) if (m.pits.includes(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE))) out.push(`seed ${seed} f${f}: a ${o.n || o.kind || 'thing'} in a pit`);
        for (const q of m.waterFeatures) if (m.rooms[q.room].wings || m.rooms[q.room].pit) out.push(`seed ${seed} f${f}: a stream through a shaped room`);
        const wet = new Set(m.water), bridge = new Set(m.waterBridges);
        for (const k of wet) if (m.cells[k] !== 1 || !Number.isInteger(m.waterFlow[k]) || m.waterFlow[k] < 0 || m.waterFlow[k] > 3) out.push(`seed ${seed} f${f}: water off floor or without flow`);
        for (const k of bridge) if (m.cells[k] !== 1 || wet.has(k) || m.block.includes(k)) out.push(`seed ${seed} f${f}: water crossing is wet or blocked`);
        for (const o of [...m.chests, ...m.pots, ...m.enemies, ...m.decor.filter((d) => d.solid), ...m.torches.filter((q) => q.kind !== 'wall')]) {
          if (wet.has(Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE))) out.push(`seed ${seed} f${f}: post or prop in stream`);
        }
        for (const q of m.waterFeatures) {
          const r = m.rooms[q.room];
          if (['start', 'shop', 'secret', 'boss'].includes(r.type)) out.push(`seed ${seed} f${f}: water in protected room`);
          {
            const path = new Set(q.cells), seen = new Set([q.source]), todo = [q.source];
            for (let i = 0; i < todo.length; i++) for (const d of [-1, 1, -m.W, m.W]) if (path.has(todo[i] + d) && !seen.has(todo[i] + d)) { seen.add(todo[i] + d); todo.push(todo[i] + d); }
            if (!seen.has(q.drain) || seen.size !== path.size || !q.bridge.length || q.width < 1 || q.width > 3) out.push(`seed ${seed} f${f}: stream or crossing disconnected`);
            if (cell(m, Math.floor(q.x / TILE), r.y - 1) !== 0) out.push(`seed ${seed} f${f}: spring not attached to wall`);
          }
        }
      }
      // the cave's water (TASKS 302): deep water (6) never meets dry floor, every deep pool has shallows on its shore, every floor
      // cell is reached on foot over shallows and crossings, the water keeps its share of the floor (secret caches left out), nothing
      // stands in it, a crossing lies over deep water, and every source is on a wall over its water
      if (mode === 'cave') { const W = m.W, wet = new Set(m.water), over = new Set(m.crossings.flatMap((c) => (c.kind === 'neck' ? [] : c.cells))), hid = new Set(m.secrets.flatMap((q) => q.hide));
        for (const r of m.rooms) if (r.type === 'secret') for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) hid.add(y * W + x);
        const D8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1], dry = (k) => m.cells[k] === 1 && !wet.has(k) && !over.has(k), deepAt = (k) => m.cells[k] === 6;
        let open = 0, nDeep = 0, bad = 0; const seenD = new Uint8Array(W * m.H);
        for (let k = 0; k < W * m.H; k++) { const c = m.cells[k]; if ((c === 1 || c === 6) && !hid.has(k)) open++; if (c !== 6) continue; nDeep++;
          if (D8.some((d) => dry(k + d)) && !bad++) out.push(`seed ${seed} f${f}: deep water on dry floor at ${k % W},${Math.floor(k / W)}`);
          if (seenD[k]) continue; const st = [k]; seenD[k] = 1; let shore = false;
          while (st.length) { const j = st.pop(); for (const d of D8) { const n = j + d; if (deepAt(n) && !seenD[n]) { seenD[n] = 1; st.push(n); } else if (wet.has(n)) shore = true; } }
          if (!shore) out.push(`seed ${seed} f${f}: deep water at ${k % W},${Math.floor(k / W)} without a shore of shallows`); }
        const share = (m.water.length + nDeep + over.size) / open;
        if (!plat && (share < 0.15 || share > 0.35)) out.push(`seed ${seed} f${f}: water is ${Math.round(share * 100)} % of the floor`);
        { const seen = new Uint8Array(W * m.H), s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), st = [s0]; seen[s0] = 1;
          // (a hoard's islet, TASKS 476, is reached over its thin crust only)
          const thinS = new Set(m.thin || []); while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && (m.cells[n] === 1 || m.cells[n] === 4 || thinS.has(n))) { seen[n] = 1; st.push(n); } } }
          const cut = m.cells.findIndex((c, k) => c === 1 && !seen[k]); if (cut >= 0) out.push(`seed ${seed} f${f}: floor at ${cut % W},${Math.floor(cut / W)} cut off by water`);
          for (const r of m.rooms) if (!seen[r.cy * W + r.cx] && m.cells[r.cy * W + r.cx] === 1) out.push(`seed ${seed} f${f}: the ${r.type} hall ${r.id} cut off by water`); }
        const inW = (k) => wet.has(k) || over.has(k) || deepAt(k), cellOf = (o) => Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE);
        // a drowned lies in the shallows (TASKS 307), off the crossings; every other monster stands dry
        for (const o of m.enemies) if (ENEMIES[o.type].lurk && (!wet.has(cellOf(o)) || over.has(cellOf(o)) || deepAt(cellOf(o)))) out.push(`seed ${seed} f${f}: a drowned out of the shallows at ${Math.round(o.x)},${Math.round(o.y)}`);
        // an eel (TASKS 310) has its post in deep water
        for (const o of m.enemies) if (ENEMIES[o.type].deep && m.cells[cellOf(o)] !== 6) out.push(`seed ${seed} f${f}: an eel out of the deep water at ${Math.round(o.x)},${Math.round(o.y)}`);
        for (const [n, list] of [['monster', m.enemies.filter((o) => !ENEMIES[o.type].lurk && !ENEMIES[o.type].deep)], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((d) => !d.wall && !d.lift)], ['fire', m.torches.filter((q) => q.kind !== 'wall')], ['altar', m.shrines], ['web', m.webs], ['ambush', m.ambush]])
          for (const o of list) if (inW(cellOf(o))) out.push(`seed ${seed} f${f}: a ${n} in the water at ${Math.round(o.x)},${Math.round(o.y)}`);
        for (const tr of m.traps) for (const [i, j] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (inW((tr.y / TILE + j) * W + tr.x / TILE + i)) out.push(`seed ${seed} f${f}: a spike plate in the water`);
        for (const c of m.crossings) { if (c.lava || c.chasm) continue; caveKinds[c.kind] = (caveKinds[c.kind] || 0) + 1;
          if (c.cells.some((k) => m.cells[k] !== 1 || (c.kind !== 'neck' && wet.has(k)))) out.push(`seed ${seed} f${f}: a ${c.kind} off the floor or wading`);
          if (c.kind !== 'neck' && !c.cells.some((k) => [1, -1, W, -W].some((d) => deepAt(k + d)))) out.push(`seed ${seed} f${f}: a ${c.kind} over no deep water`); }
        for (const q of m.waterFeatures) { caveKinds[q.kind] = (caveKinds[q.kind] || 0) + 1; const back = { u: -W, d: W, l: -1, r: 1 }[q.dir];
          if (!['waterfall', 'breach', 'spring'].includes(q.kind) || !(wet.has(q.cell) || deepAt(q.cell) || over.has(q.cell)) || m.cells[q.cell + back] !== 0) out.push(`seed ${seed} f${f}: a ${q.kind} off its wall or its water`); }
        for (const k in m.waterFlow) if (!(wet.has(+k) || deepAt(+k)) || !(m.waterFlow[k] >= 0 && m.waterFlow[k] <= 3)) out.push(`seed ${seed} f${f}: a stream's flow off its water`);
        // the cave's dressing (TASKS 306): no solid prop cuts a way, lilies and weed grow in the water, moss hangs from a rock face
        { const blocked = new Set(m.block.concat(m.pots.map(cellOf))), seen = new Uint8Array(W * m.H), s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), st = [s0]; seen[s0] = 1;
          const thinS = new Set(m.thin || []); while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!seen[n] && (m.cells[n] === 1 || m.cells[n] === 4 || thinS.has(n)) && !blocked.has(n)) { seen[n] = 1; st.push(n); } } }
          // the space behind the merchant's counter is closed on purpose (the shop is one built piece)
          const sh = m.rooms.find((r) => r.type === 'shop'), inShop = (k) => sh && k % W >= sh.x && k % W < sh.x + sh.w && Math.floor(k / W) >= sh.y && Math.floor(k / W) < sh.y + sh.h;
          const cut = m.cells.findIndex((c, k) => c === 1 && !seen[k] && !blocked.has(k) && !inShop(k) && !hid.has(k)); if (cut >= 0) out.push(`seed ${seed} f${f}: floor at ${cut % W},${Math.floor(cut / W)} cut off by the props`); }
        for (const o of m.flora) { const k = cellOf(o), up = Math.floor(o.y / TILE - 1) * W + Math.floor(o.x / TILE);
          if (o.n === 'moss' ? m.cells[up] !== 0 : !inW(k)) out.push(`seed ${seed} f${f}: ${o.n} off its ${o.n === 'moss' ? 'rock face' : 'water'} at ${Math.round(o.x)},${Math.round(o.y)}`); } }
      // the fire depths (TASKS 186): two rivers at least, and nothing stands in lava or a cell from its shore (but the plateaus' chain
      // fences, railings on the very edge that block and hide nothing: TASKS 405)
      if (D.BIOMES[m.biome].lava && !(ST.last && ST.boss) && (m.streams || []).filter((q) => q.kind === 'river' && q.n >= 8).length < 2) out.push(`seed ${seed} f${f}: fewer than two lava rivers`);
      { const shore = (o) => { const tx = Math.floor(o.x / TILE), ty = Math.floor((o.y - 1) / TILE); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, tx + i, ty + j) === 3) return true; return false; };
        for (const [k, list] of [['monster', m.enemies.filter((e) => (!ENEMIES[e.type].lava || ENEMIES[e.type].kind !== 'salamander') && !ENEMIES[e.type].lake)], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((d) => !d.wall && !d.lift && d.n !== 'fence_mg')], ['brazier', m.torches.filter((t) => t.kind !== 'wall')]]) for (const o of list) if (shore(o)) out.push(`seed ${seed} f${f}: a ${k} by lava at ${Math.round(o.x)},${Math.round(o.y)}`); }
      // a secret's fake wall counts as broken: rock one cell thick between two floors would hang in the floor as a bare wall face (TASKS 178)
      for (let y = 1; y < m.H - 1; y++) for (let x = 0; x < m.W; x++) if (!cell(m, x, y) && cell(m, x, y - 1) && cell(m, x, y + 1)) out.push(`seed ${seed} f${f}: one-cell wall between floors at ${x},${y}`);
      // bulky props (chests, tables, coffins, statues…) read wider than their cell: two of them never share a cell edge or corner
      { const big = m.chests.map((c) => [c.x, c.y, 'chest']).concat(m.decor.filter((d) => (d.solid || d.n === 'table') && !d.wall).map((d) => [d.x, d.y, d.n]), m.torches.filter((t) => t.kind === 'brazier').map((t) => [t.x, t.y, 'brazier']), m.shrines.map((t) => [t.x, t.y, 'altar']),
          m.pots.map((p) => [p.x, p.y, p.kind, p.stack]));
        // the shop is one built piece: its shelves, sacks and barrel close the space behind the counter on purpose. Elsewhere no two
        // props draw over each other: in the same row or the next one, their drawn widths (PROP_W) never meet
        const w2 = (n) => (D.PROP_W[n] || 0) / 2;
        for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) { const [ax, ay, an, as] = big[i], [bx, by, bn, bs] = big[j]; if (an.startsWith('shop_') || bn.startsWith('shop_') || (as && as === bs)) continue;   // a corner stack of barrels and crates is one pile
          if (Math.abs(Math.floor(ay / TILE) - Math.floor(by / TILE)) <= 1 && Math.abs(ax - bx) < w2(an) + w2(bn) + 4) out.push(`seed ${seed} f${f}: ${an} draws over ${bn} at ${Math.round(ax)},${Math.round(ay)}`); }
        for (const d of m.decor) if (d.n === 'bookshelf' && d.r !== undefined) { const cy = Math.floor(d.y / TILE) - 1, c0 = Math.floor((d.x - 51) / TILE), c1 = Math.floor((d.x + 51) / TILE); for (let cx = c0; cx <= c1; cx++) if (m.cells[cy * m.W + cx] !== 0) out.push(`seed ${seed} f${f}: a bookshelf sticks into the passage at ${cx},${cy}`); }
        // nothing hung on a top wall (torch, sconce, banner, sign) hides behind a tall prop standing against that wall
        const hung = m.torches.filter((t) => t.kind === 'wall' && !t.side).map((t) => [t.x, Math.round((t.y + 26) / TILE), 14, t.lever !== undefined ? 'sconce' : 'torch'])
          .concat(m.decor.filter((d) => d.n === 'banner' || d.n === 'shop_sign').map((d) => [d.x, Math.round((d.y + (d.n === 'banner' ? 2 : 34)) / TILE), d.n === 'banner' ? 18 : 22, d.n]));
        for (const d of m.decor) { if (!d.solid || (d.y - 22) % TILE) continue; const ry = (d.y - 22) / TILE;
          for (const [hx, hy, hw, hn] of hung) if (hy === ry && Math.abs(hx - d.x) < hw + (D.PROP_W[d.n] || 53) / 2) out.push(`seed ${seed} f${f}: ${d.n} hides a ${hn} on the wall at ${Math.round(hx)},${hy * TILE}`); }
        for (const p of m.pots) { const r = m.rooms[DG.roomAt(m, p.x, p.y)] || {}; if (p.kind === 'gold' && r.type !== 'secret' && !r.locked) out.push(`seed ${seed} f${f}: a heap of gold outside a secret or locked room`); }
        for (const r of m.rooms) { const n = m.chests.filter((c) => DG.roomAt(m, c.x, c.y) === r.id).length; if (n > Math.min(2, 1 + Math.floor(r.w * r.h / 30))) out.push(`seed ${seed} f${f}: ${n} chests in a ${r.w}×${r.h} room`); } }
      // a cobweb hangs on the back wall's upper face in a room's top corner, its spun corner at the wall's top edge against the side wall (mirrored on the right)
      for (const d of m.decals) if (d.n === 'dc_web') { const w = 40 * d.s, cx = d.f ? d.x + w / 2 : d.x - w / 2, tx = Math.round(cx / TILE) - (d.f ? 1 : 0), ty = Math.round((d.y - w / 2 - 4) / TILE) + 2, ox = d.f ? -1 : 1, sx = d.f ? 1 : -1;
        if (cell(m, tx, ty) !== 1 || cell(m, tx + sx, ty) !== 0 || [0, ox].some((o) => cell(m, tx + o, ty - 1) !== 0 || cell(m, tx + o, ty - 2) !== 0) || Math.abs(cx - Math.round(cx / TILE) * TILE) > 1 || Math.abs(d.y - w / 2 - 4 - (ty - 2) * TILE) > 1) out.push(`seed ${seed} f${f}: a cobweb away from a corner at ${Math.round(d.x)},${Math.round(d.y)}`); }
      // a floor decal's drawn square (40·s px) lies on open floor: nothing climbs a wall (the corner cobwebs hang there on purpose)
      for (const d of m.decals) { if (d.n === 'dc_web') continue; const h = 20 * d.s;
        for (const [px, py] of [[d.x - h, d.y - h], [d.x + h - 0.01, d.y - h], [d.x - h, d.y + h - 0.01], [d.x + h - 0.01, d.y + h - 0.01]]) if (cell(m, Math.floor(px / TILE), Math.floor(py / TILE)) !== 1) { out.push(`seed ${seed} f${f}: decal ${d.n} on a wall at ${Math.round(d.x)},${Math.round(d.y)}`); break; } }
      // decor never wears an interactive object's sprite: a dead altar or chest reads as one already used
      for (const d of m.decor) if (['altar', 'chest', 'chest_open', 'pot', 'stairs', 'treasure'].includes(d.n)) out.push(`seed ${seed} f${f}: decor uses the ${d.n} sprite`);
      // spike plates (2×2 cells) keep clear of corridor mouths and never wall off floor: walking around every plate reaches
      // everything walking over them would
      // webs lie on the floor of a room spiders keep; ambush plates are gone (TASKS 320)
      for (const w of m.webs) { const ri = DG.roomAt(m, w.x, w.y); if (ri < 0 || !m.enemies.some((e) => e.room === ri && e.type === 'spider') || cell(m, Math.floor(w.x / TILE), Math.floor(w.y / TILE)) !== 1) out.push(`seed ${seed} f${f}: a web off a spiders' room`); }
      for (const P of m.ambush) { const r = m.rooms[P.room], k = P.cy * m.W + P.cx;
        if (!r || !(r.type === 'combat' || r.type === 'exit' || r.locked) || cell(m, P.cx, P.cy) !== 1 || m.block.includes(k) || DG.roomAt(m, P.x, P.y) !== P.room) out.push(`seed ${seed} f${f}: an ambush off a fighting room's open floor`);
        if (m.traps.some((t) => Math.abs(t.x / TILE - P.cx - 0.5) < 1.5 && Math.abs(t.y / TILE - P.cy - 0.5) < 1.5)) out.push(`seed ${seed} f${f}: an ambush on a spike plate`); }
      // a corridor's plate (TASKS 76) fills a straight two-cell stretch with rock both sides, three cells and more from any room or door
      // (a trapped corridor's plates, TASKS 377, a cell off a room and two off a door)
      { const roomNear = (x, y, pad) => m.rooms.some((q) => DG.inRm(q, x, y, pad));
        for (const tr of m.traps) { if (!tr.cor) continue; const x0 = tr.x / TILE - 1, y0 = tr.y / TILE - 1, cs = [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]], pr = tr.run !== undefined ? 1 : 3, pd = tr.run !== undefined ? 2 : 3;
          if (cs.some(([x, y]) => cell(m, x, y) !== 1 || roomNear(x, y, pr) || m.doors.some((d) => d.cells.some(([dx, dy]) => Math.abs(dx - x) <= pd && Math.abs(dy - y) <= pd)))) out.push(`seed ${seed} f${f}: corridor spike plate near a room or a door`);
          const runX = [0, 1].every((i) => cell(m, x0 + i, y0 - 1) === 0 && cell(m, x0 + i, y0 + 2) === 0), runY = [0, 1].every((j) => cell(m, x0 - 1, y0 + j) === 0 && cell(m, x0 + 2, y0 + j) === 0);
          if (!runX && !runY) out.push(`seed ${seed} f${f}: corridor spike plate off a straight stretch`); } }
      { const tc = new Set(); for (const tr of m.traps) if (!tr.cor) for (let j = -1; j <= 0; j++) for (let i = -1; i <= 0; i++) tc.add((Math.floor(tr.y / TILE) + j) * m.W + Math.floor(tr.x / TILE) + i);
        const inR = (x, y) => m.rooms.some((q) => DG.inRm(q, x, y));
        for (const k of tc) { const x = k % m.W, y = Math.floor(k / m.W); if (cell(m, x, y) !== 1) out.push(`seed ${seed} f${f}: spike plate off the floor`);
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (cell(m, x + i, y + j) === 1 && !inR(x + i, y + j)) out.push(`seed ${seed} f${f}: spike plate at a corridor mouth`); }
        const fill = (skip) => { const seen = new Uint8Array(m.W * m.H), st = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; seen[st[0]] = 1;
          while (st.length) { const k = st.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!seen[n] && cell(m, n % m.W, Math.floor(n / m.W)) === 1 && !m.block.includes(n) && !skip.has(n)) { seen[n] = 1; st.push(n); } } } return seen; };
        for (const e of m.enemies) if (tc.has(Math.floor(e.y / TILE) * m.W + Math.floor(e.x / TILE))) out.push(`seed ${seed} f${f}: ${e.type} posted on a spike plate`);
        for (const p of m.chests.concat(m.torches.filter((t) => t.kind === 'brazier'), m.shrines, m.decor.filter((d) => (d.solid || d.n === 'table') && !d.wall))) {
          const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE); let hit = false;
          for (let j = -1; j <= 1 && !hit; j++) for (let i = -1; i <= 1; i++) if (tc.has((y + j) * m.W + x + i)) hit = true;
          if (hit) out.push(`seed ${seed} f${f}: ${p.n || p.kind || 'chest'} right beside a spike plate at ${p.x},${p.y}`); }
        const a = fill(new Set()), b = fill(tc); for (let k = 0; k < a.length; k++) if (a[k] && !b[k] && !tc.has(k)) { out.push(`seed ${seed} f${f}: spike plates cut off floor`); break; } }
      const ex = DG.genFloor; void ex; void F;
      // exit reachable from the spawn over floor
      const seen = new Uint8Array(m.W * m.H), st = [[Math.floor(m.spawn.x / TILE), Math.floor(m.spawn.y / TILE)]]; let ok = false;
      while (st.length) { const [x, y] = st.pop(); if (x === m.exit.tx && y === m.exit.ty) { ok = true; break; }
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (cell(m, nx, ny) === 1 && !seen[ny * m.W + nx]) { seen[ny * m.W + nx] = 1; st.push([nx, ny]); } } }
      if (!ok) out.push(`seed ${seed} f${f}: exit unreachable`);
      // a cave (TASKS 301): its floor's size, no doors and no masonry streams, pockets that lead nowhere, and no straight stretch of
      // wall over four cells but the merchant's back wall and the secret caches
      if (mode === 'cave') { const [w0, h0] = ST.size || ST.N.size[lf - 1], sh = m.rooms.find((r) => r.type === 'shop'), hid = new Set(m.secrets.flatMap((q) => q.hide));
        if (m.W !== w0 || m.H !== h0) out.push(`seed ${seed} f${f}: the cave is ${m.W}×${m.H}, not ${w0}×${h0}`);
        if (m.doors.some((d) => !d.arena)) out.push(`seed ${seed} f${f}: non-arena doors in the cave`);
        for (const r of m.rooms) if (r.pocket && m.edges.filter((e) => e.includes(r.id)).length !== 1) out.push(`seed ${seed} f${f}: pocket ${r.id} is not a dead end`);
        const chU = new Set(m.chasmUnder || []), skip = (x, y) => (Math.abs(x - sh.cx) <= 5 && y >= sh.y - 2 && y <= sh.y + 5) || hid.has(y * m.W + x) || chU.has(y * m.W + x) || m.rooms.some((r) => r.type === 'secret' && x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h);
        for (const q of DG.straightRuns(m.cells, m.W, m.H, skip)) out.push(`seed ${seed} f${f}: a straight cave wall ${q.n} cells long at ${q.x},${q.y}`); }
      // the plateaus (TASKS 400): a body two cells wide walks from the spawn to every plateau and ledge (a ridge never narrows to one
      // cell), the walk to the stairs is held to ARCH.plateau.path, the rock wall stands at the top only and no lava lies in it, and
      // the floor has lava
      if (plat) { const W = m.W, A = D.ARCH.plateau, s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE);
        // (a lava cave, TASKS 431, is the water caves' layout: its tunnels may narrow, its rock is all wall)
        const thinC = m.cells.slice(); for (const k of m.thin || []) thinC[k] = 1;   // (an islet's thin crust is its way, TASKS 476)
        const lc = m.ftype === 'cave', lost = lc ? [] : DG.narrowTo(thinC, W, m.H, s0, m.rooms.filter((r) => r.type !== 'secret').map((r) => r.cy * W + r.cx));
        for (const k of lost) out.push(`seed ${seed} f${f}: plateau or ledge at ${k % W},${Math.floor(k / W)} out of reach of a body two cells wide`);
        const d = new Int32Array(W * m.H).fill(-1), q = [s0]; d[s0] = 0;
        for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && m.cells[n] === 1) { d[n] = d[q[i]] + 1; q.push(n); } }
        const pth = (((m.ftype && A[m.ftype]) || A).path || A.path).map((q) => q * (m.ftype2 ? A.blend.pathKeep : 1)), walk = d[m.exit.ty * W + m.exit.tx]; if (walk !== m.walk || walk < pth[lf - 1] * (m.loose ? 0.9 : 1)) out.push(`seed ${seed} f${f}: the walk to the stairs is ${walk} cells (${m.walk} counted, ${pth[lf - 1]} at least)`);
        if (!m.cliff || m.cliff.length !== W) out.push(`seed ${seed} f${f}: a plateau floor without its wall rows`);
        else if (!lc) for (let x = 0; x < W; x++) for (let y = 0; y < m.cliff[x]; y++) if (m.cells[y * W + x] === 3) { out.push(`seed ${seed} f${f}: lava in the wall at ${x},${y}`); x = W; break; }
        if (!m.lava) out.push(`seed ${seed} f${f}: a plateau floor without lava`);
        // a cache hides in the top wall (TASKS 425): its room and passage in the wall's rows, the wall over it on each side, never a
        // block of dark in the lava
        for (const [i, q] of m.secrets.entries()) { const r = m.rooms[q.room], ks = q.hide.slice(); for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) ks.push(y * W + x);
          if (ks.some((k) => Math.floor(k / W) >= m.cliff[k % W])) out.push(`seed ${seed} f${f}: secret ${i} is not in the top wall`); }
        // the lava (TASKS 401): its share of floor and lava in AR.lava.share, lakes and sources, every crossing a walk over lava, the crust
        // on lava by the floor and no way shorter over it, and nothing stands in the lava, on the crust or a cell from either
        const L = A.lava, under = new Set(m.lavaUnder), crustS = new Set(m.crust), fl = m.cells.filter((c) => c === 1).length, share = m.lava / (fl + m.lava);
        const sh = m.shareOf || L.share;
        if (share < sh[0] || share > sh[1]) out.push(`seed ${seed} f${f}: lava is ${Math.round(share * 100)} % of floor and lava (${m.ftype})`);
        if (!m.lavaBodies.some((b) => b.kind === 'lake') || !m.lavaFeatures.length) out.push(`seed ${seed} f${f}: no lake or no source of lava`);
        for (const q of m.lavaFeatures) if (m.cells[q.cell] !== 3) out.push(`seed ${seed} f${f}: a lava ${q.kind} off its lava`);
        // (a chain bridge over the chasm, TASKS 429: on floor walked over the dark, the dark beside it, never over lava)
        const chU = new Set(m.chasmUnder || []);
        for (const c of m.crossings) if (c.chasm ? c.kind !== 'bridge' || c.cells.some((k) => m.cells[k] !== 1 || !chU.has(k) || under.has(k)) || !c.cells.some((k) => [1, -1, W, -W].some((o) => m.cells[k + o] === 0)) : !c.lava || c.cells.some((k) => m.cells[k] !== 1 || !under.has(k)) || !c.cells.some((k) => [1, -1, W, -W].some((o) => m.cells[k + o] === 3))) out.push(`seed ${seed} f${f}: a ${c.kind} that is no crossing over ${c.chasm ? 'the chasm' : 'lava'}`);
        for (const k of crustS) if (m.cells[k] !== 3 || (![1, -1, W, -W].some((o) => m.cells[k + o] === 1) && !(m.thin || []).includes(k))) out.push(`seed ${seed} f${f}: crust off a bank at ${k % W},${Math.floor(k / W)}`);
        // a hoard's islet (TASKS 476): its chest on it, no monster on it, out of reach but over its thin crust
        for (const r of m.rooms.filter((q) => q.islet)) { const inR = (o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= r.y * TILE && o.y < (r.y + r.h) * TILE, thinS = new Set(m.thin || []);
          const walk = (u) => { const d = new Uint8Array(W * m.H), q = [s0]; d[s0] = 1; for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const k = q[i] + o; if (!d[k] && (m.cells[k] === 1 || (u && thinS.has(k)))) { d[k] = 1; q.push(k); } } return d[r.cy * W + r.cx]; };
          if (!m.chests.some(inR)) out.push(`seed ${seed} f${f}: an islet without its hoard`); if (m.enemies.some((e) => e.room === r.id || inR(e))) out.push(`seed ${seed} f${f}: a monster on an islet`);
          if (walk(false) || !walk(true)) out.push(`seed ${seed} f${f}: an islet reached otherwise than over its thin crust`); }
        // (the floor round each crust cell joins up on foot within a few steps: a crust cell never takes anyone over the lava; an islet's
        // thin crust, TASKS 476, is its one way on purpose)
        const thinK = new Set(m.thin || []);
        for (const k of crustS) { if (thinK.has(k)) continue; const fl8 = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].map((o) => k + o).filter((n) => m.cells[n] === 1); if (fl8.length < 2) continue;
          const dl = new Map([[fl8[0], 0]]), ql = [fl8[0]]; for (let i = 0; i < ql.length; i++) { const c = ql[i]; if (dl.get(c) >= 6) continue; for (const o of [1, -1, W, -W]) { const n = c + o; if (!dl.has(n) && m.cells[n] === 1) { dl.set(n, dl.get(c) + 1); ql.push(n); } } }
          if (fl8.some((n) => !dl.has(n))) { out.push(`seed ${seed} f${f}: the crust is a short cut at ${k % W},${Math.floor(k / W)}`); break; } }
        const hot = new Set(); for (let k = 0; k < W * m.H; k++) if (m.cells[k] === 3) for (const o of [0, 1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) hot.add(k + o);
        const onHot = (o) => hot.has(Math.floor(o.y / TILE) * W + Math.floor(o.x / TILE));
        for (const [n, list] of [['monster', m.enemies.filter((e) => ENEMIES[e.type].kind !== 'salamander' && !ENEMIES[e.type].lake)], ['chest', m.chests], ['pot', m.pots], ['prop', m.decor.filter((q) => !q.wall && !q.lift && q.n !== 'fence_mg')], ['fire', m.torches.filter((q) => q.kind !== 'wall')]])
          for (const o of list) if (onHot(o)) { out.push(`seed ${seed} f${f}: a ${n} in the lava or a cell from it at ${Math.round(o.x)},${Math.round(o.y)}`); break; } }
      // doors: two corridor cells just past a room's edge, every way into a doored room has one; a locked room is never the way to
      // the exit or to anything else, and its key or lever lies on this side of its doors
      { const inR = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, any = (x, y) => m.rooms.some((r) => inR(r, x, y));
        for (const d of m.doors) { const r = m.rooms[d.room];
          if ((!d.arena && d.cells.length !== 2) || d.cells.some(([x, y]) => cell(m, x, y) !== 1 || any(x, y) || !inRoom1(r, x, y))) out.push(`seed ${seed} f${f}: door ${d.dir} of room ${d.room} off its mouth`);
          if (['start', 'shop', 'boss', 'secret'].includes(r.type) && !d.arena) out.push(`seed ${seed} f${f}: a door to the ${r.type} room`); }
        for (const r of m.rooms) if (r.doors) for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++)
          if (!inR(r, x, y) && (x >= r.x && x < r.x + r.w || y >= r.y && y < r.y + r.h) && cell(m, x, y) === 1 && !any(x, y) && !m.doors.some((d) => d.room === r.id && d.cells.some(([cx, cy]) => cx === x && cy === y))) { out.push(`seed ${seed} f${f}: room ${r.id} has a way in without a door`); y = 1e9; break; }
        m.locks.forEach((L, li) => { const ds = m.doors.filter((d) => d.lock === li); if (!ds.length) return; const r = m.rooms[L.room], shut = new Set(ds.flatMap((d) => d.cells.map(([x, y]) => y * m.W + x)));
          const walk = (skip) => { const sv = new Uint8Array(m.W * m.H), q3 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; sv[q3[0]] = 1;
            while (q3.length) { const k = q3.pop(); for (const dd of [1, -1, m.W, -m.W]) { const n = k + dd; if (!sv[n] && m.cells[n] === 1 && !skip.has(n)) { sv[n] = 1; q3.push(n); } } } return sv; };
          const all = walk(new Set()), cut = walk(shut), at0 = (x, y) => cut[Math.floor(y / TILE) * m.W + Math.floor(x / TILE)], tag = `seed ${seed} f${f}: locked room ${L.room}`;
          if (!at0(m.exit.x, m.exit.y)) out.push(`${tag} shuts the way to the exit`);
          for (let k = 0; k < all.length; k++) if (all[k] && !cut[k] && !shut.has(k) && !inR(r, k % m.W, Math.floor(k / m.W))) { out.push(`${tag} cuts off floor beyond it`); break; }
          const holders = m.chests.filter((c) => c.key === li).concat(m.enemies.filter((e) => e.key === li));
          if (L.kind === 'key' && (holders.length !== 1 || !at0(holders[0].x, holders[0].y) || inR(r, Math.floor(holders[0].x / TILE), Math.floor(holders[0].y / TILE)))) out.push(`${tag}: its key is not on this side`);
          if (holders.some((o) => D.BOSSES[o.type])) out.push(`${tag}: its key is on a boss behind a sealed arena`);
          if (L.kind === 'lever' && (!L.lever || !at0(L.lever.x, L.lever.y + 40))) out.push(`${tag}: its lever is out of reach`);
          if (L.kind !== 'key' && L.kind !== 'lever') out.push(`${tag} has no key and no lever`); }); }
      // a merchant on every floor: his counter's front is reachable on foot, his room holds no monster post
      if (!m.shop) out.push(`seed ${seed} f${f}: no merchant`);
      else { const fx = Math.floor(m.shop.front.x / TILE), fy = Math.floor(m.shop.front.y / TILE), sn = new Uint8Array(m.W * m.H), q2 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)];
        while (q2.length) { const k = q2.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sn[n] && cell(m, n % m.W, Math.floor(n / m.W)) === 1 && !m.block.includes(n)) { sn[n] = 1; q2.push(n); } } }
        if (!sn[fy * m.W + fx]) out.push(`seed ${seed} f${f}: the merchant's counter can't be reached`);
        for (const e of m.enemies) if (e.room === m.shop.room || inStart(m, Math.floor(e.x / TILE), Math.floor(e.y / TILE))) out.push(`seed ${seed} f${f}: ${e.type} posted in the start room or the shop`);
        // the shop's loose props stand against a wall and keep off its ways in; every open cell of the room is reachable from
        // the counter (only the merchant's nook behind it is closed on purpose)
        const r = m.rooms[m.shop.room], inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, blk = new Set(m.block);
        const mouths = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (cell(m, x + dx, y + dy) === 1 && !inR(x + dx, y + dy)) mouths.push([x, y]);
        for (const d of m.decor) if (d.r === r.id && ['shop_armor', 'shop_weapons', 'shop_gold', 'shop_crate'].includes(d.n)) { const x = Math.floor(d.x / TILE), y = Math.floor((d.y - 6) / TILE);
          if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cell(m, x + dx, y + dy) === 0)) out.push(`seed ${seed} f${f}: ${d.n} stands in the middle of the shop`);
          if (mouths.some(([mx, my]) => Math.max(Math.abs(mx - x), Math.abs(my - y)) <= 2)) out.push(`seed ${seed} f${f}: ${d.n} by a way into the shop`); }
        // (a cell of its box the counter reaches only round the outside of the box, by a plateau's ridge along its edge, is the floor's
        // shape, not the props': it counts only if the box's bare floor joins it to the counter)
        const nook = (x, y) => y <= r.y + 1 && Math.abs(x - r.cx) <= 1, bare = (x, y) => inR(x, y) && cell(m, x, y) === 1 && !nook(x, y), go = (x, y) => bare(x, y) && !blk.has(y * m.W + x);
        const fill = (ok) => { const sv = new Set([fy * m.W + fx]), q3 = [[fx, fy]]; while (q3.length) { const [x, y] = q3.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
          if (ok(nx, ny) && !sv.has(ny * m.W + nx)) { sv.add(ny * m.W + nx); q3.push([nx, ny]); } } } return sv; };
        const sv = fill(go), sv0 = fill(bare);
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (go(x, y) && sv0.has(y * m.W + x) && !sv.has(y * m.W + x)) { out.push(`seed ${seed} f${f}: shop props wall off floor`); y = 1e9; break; } }
      // fire floors always show lava, and no pool cuts floor off from the rest
      if (D.BIOMES[m.biome].lava && !m.lava) out.push(`seed ${seed} f${f}: a fire floor without lava`);
      { const sv = new Uint8Array(m.W * m.H), q3 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; sv[q3[0]] = 1;
        const thinS = new Set(m.thin || []); while (q3.length) { const k = q3.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sv[n] && (m.cells[n] === 1 || m.cells[n] === 4 || thinS.has(n))) { sv[n] = 1; q3.push(n); } } }
        if (m.cells.some((c, k) => c === 1 && !sv[k])) out.push(`seed ${seed} f${f}: lava cuts floor off`); }
      // secret rooms: sealed off by their fake wall (walking never gets in), reached once it breaks, one top-tier chest, no monsters
      if ((!m.secrets.length && !m.bossType) || m.secrets.length > 10) out.push(`seed ${seed} f${f}: ${m.secrets.length} secret rooms`);
      { const walk = (pass) => { const sv = new Uint8Array(m.W * m.H), q3 = [Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE)]; sv[q3[0]] = 1;
          while (q3.length) { const k = q3.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d; if (!sv[n] && (m.cells[n] === 1 || (pass && m.cells[n] === 4)) && !m.block.includes(n)) { sv[n] = 1; q3.push(n); } } } return sv; };
        const shut = walk(0), open = walk(1);
        m.secrets.forEach((q, i) => { const r = m.rooms[q.room], ch = m.chests.filter((c) => c.sec === i);
          if (q.wall.length !== 4 || q.wall.some(([x, y]) => cell(m, x, y) !== 4)) out.push(`seed ${seed} f${f}: secret ${i} has no fake wall`);
          if (q.front.some(([x, y]) => inRoom1(m.rooms[m.shop.room], x, y))) out.push(`seed ${seed} f${f}: secret off the shop`);
          if (ch.length !== 1 || ch[0].tier !== (q.pz || q.inner ? 5 : 4)) out.push(`seed ${seed} f${f}: secret ${i} holds ${ch.length} chests`);
          for (const c of ch) { const k = Math.floor(c.y / TILE) * m.W + Math.floor(c.x / TILE), nb = [1, -1, m.W, -m.W].map((d) => k + d);
            if (nb.some((n) => shut[n])) out.push(`seed ${seed} f${f}: secret ${i} reachable without breaking the wall`);
            if (!nb.some((n) => open[n])) out.push(`seed ${seed} f${f}: secret ${i} chest unreachable after the wall breaks`); }
          if (m.enemies.some((e) => e.room === r.id)) out.push(`seed ${seed} f${f}: monsters in secret ${i}`);
          if (m.torches.some((t) => t.r === r.id && t.sec !== i)) out.push(`seed ${seed} f${f}: a torch lights secret ${i} before it is found`);
          // each secret has its cover or its mechanism, and a mechanism is found and worked from the open floor
          for (const e of cacheIssues(m, q, i, shut)) out.push(`seed ${seed} f${f}: secret ${i} (${q.kind}) ${e}`); }); }
      // every floor cell of every room lies within reach of a light: a torch, a brazier, candles, a crystal, an altar, the bonfire or a shop lamp
      { const LR = DG.LIGHT_R, lights = m.torches.map((t) => [t.x, t.y, LR[t.kind]]).concat(m.decor.filter((d) => LR[d.n]).map((d) => [d.x, d.y, LR[d.n]]),
          m.shrines.map((s) => [s.x, s.y, LR.shrine]), m.shop.lanterns.map((q) => [q.x, q.y, LR.wall]), [[m.shop.x, m.shop.y, LR.fire]]);
        for (let k = 0; k < m.cells.length; k++) if (m.cells[k] === 3) lights.push([(k % m.W + 0.5) * TILE, (Math.floor(k / m.W) + 0.5) * TILE + 6, LR.lava]);   // lava glows
        for (const r of m.rooms) { let dark = 0;
          for (const [bx, by, bw, bh] of DG.rectsOf(r)) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (cell(m, x, y) === 1 && !lights.some(([lx, ly, lr]) => Math.hypot(lx - (x + 0.5) * TILE, (ly - (y + 0.5) * TILE - 6) / 0.8) <= lr * TILE)) dark++;
          if (dark) out.push(`seed ${seed} f${f}: ${dark} dark cells in ${r.type} room ${r.id} (${r.w}×${r.h})`); } } }
    // the cave's water comes in every kind over the floors checked: falls, breaches, springs, isthmuses, fords and bridges
    for (const k of ['waterfall', 'breach', 'spring', 'neck', 'ford', 'bridge']) if (!caveKinds[k]) out.push(`cave: no ${k} on any of the floors checked`);
    for (const k of Object.keys(D.ROOM_SHAPES)) if (!shapes[k] && !shapes[k + '*']) out.push(`rooms: no ${k} room on any of the floors checked`);
    if (!shapes['pit*']) out.push('rooms: no pit dug on any of the floors checked');
    if (!shapes.wide) out.push('rooms: no corridor three cells wide on any of the floors checked');
    if (!shapes.rift) out.push('rooms: no bridge over a rift of lava on any of the floors checked');
    if (!shapes.gauntlet) out.push('rooms: no trapped corridor on any of the floors checked');
    for (const k of ['rooms', 'maze', 'hall', 'catacomb', 'fortress', 'tomb']) if (!shapes['lay:' + k]) out.push(`rooms: no ${k} layout on any of the floors checked`);
    return out;
  }
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
        // TASKS 1863 г, в, д: a legendary goes on a second press, the right button sells as the left does, I leaves the shop open
        h.bag[0] = Object.assign(rollItem(R, 1, 0), { id: 71000, rar: 4 }); const g0 = h.gold; step(S, at('sell:0')); if (!h.bag[0] || h.gold !== g0) out.push('shop: a legendary is sold on one press');
        step(S, at('sell:0')); if (h.bag[0] && h.bag[0].id === 71000) out.push('shop: a second press does not sell the legendary');
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
  // a run of its own (the caves, the magma caves) finds, is sold and is given items at about its hero's level on its first floor:
  // the magma caves' loot over their depth once made them 10 levels over him and the run a walk (TASKS 424)
  function lootLevelCheck() {
    const out = [];
    for (const mode of Object.keys(D.RUNS)) { const M = D.RUNS[mode]; if (!M.lvl || M.lvl < 2 || M.endless) continue;
      const S = spawn(0, {}), R = newRun(S, mode, 7); enterFloor(S, R, 1); const lv = rollItem(R, dep(R)).lvl, sh = R.shop.goods.filter((g) => BASES[g.it.b]).map((g) => g.it.lvl);
      if (Math.abs(lv - M.lvl) > 3) out.push(`${mode}: a 1st floor's item is level ${lv} for a hero of level ${M.lvl}`);
      if (sh.some((l) => Math.abs(l - M.lvl) > 3)) out.push(`${mode}: the 1st floor's merchant sells items of level ${Math.min(...sh)}–${Math.max(...sh)} for a hero of level ${M.lvl}`); }
    return out; }
  // the magma floors' types (TASKS 426, 427): a run's floors never take one type twice running and every type turns up; a lake floor
  // has islands in its lake, a hoard on the big one, no start, stairs or merchant on one and no cache dug in the lake; a river floor
  // its island with the hoard, two to four ways over and packs by them
  function floorTypeCheck() {
    const out = [], seen = {}, AR = D.ARCH.plateau;
    let mixed = 0;
    for (let sd = 1; sd <= 10; sd++) { let prev = null, pm = false;
      for (let f = 1; f <= D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f} (${m.ftype})`; seen[m.ftype] = (seen[m.ftype] || 0) + 1;
        if (f < D.RUNS.magma.floors && m.ftype === prev) out.push(`${tag}: the same type as the floor before`); prev = m.ftype;
        if (m.ftype2) { mixed++; if (pm) out.push(`${tag}: a mixed floor after a mixed floor`); if (!AR.blend.over.includes(m.ftype)) out.push(`${tag}: ${m.ftype} mixed with ${m.ftype2}`); } pm = !!m.ftype2;
        if (f === D.RUNS.magma.floors && m.ftype !== 'plain') out.push(`${tag}: the boss's floor is not the plain plateaus`);
        if (f === 1 && AR.first && m.ftype !== AR.first) out.push(`${tag}: the first floor is not ${AR.first}`);
        if (f > 1 && AR.first && m.ftype === AR.first) out.push(`${tag}: ${AR.first} again past the first floor`);
        if (f < D.RUNS.magma.floors && D.floorName(f, 'magma', sd, undefined, m) !== AR.names[m.ftype]) out.push(`${tag}: the title does not name the floor's type`);
        // a river (TASKS 428): one island; two to four places to cross, a pack waiting at them
        if (m.ftype === 'river') { const W = m.W, isles = m.rooms.filter((r) => r.isle), rc = m.crossings.filter((c) => c.river);
          if (isles.length !== 1) out.push(`${tag}: ${isles.length} islands on the river`);
          const xs = rc.map((c) => c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length).sort((a, b) => a - b); let places = 0, last = -99; for (const x of xs) { if (x - last > 8) places++; last = x; }
          if (places < 2 || places > 4) out.push(`${tag}: ${places} places to cross the river`);
          const mx = (c) => c.cells.reduce((a, k) => a + (k % W), 0) / c.cells.length, held = rc.filter((c) => { const own = new Set(c.cells), ends = c.cells.flatMap((k) => [1, -1, W, -W].map((o) => k + o)).filter((k) => m.cells[k] === 1 && !own.has(k));
            return m.enemies.some((e) => ends.some((k) => Math.hypot(e.x / TILE - 0.5 - (k % W), e.y / TILE - 0.5 - Math.floor(k / W)) < 8)); });
          const bare = xs.filter((x, i) => (i === 0 || x - xs[i - 1] > 8) && !held.some((c) => Math.abs(mx(c) - x) <= 8 * 3)).length;
          if (bare > 1) out.push(`${tag}: ${bare} places to cross the river with no pack by them`);
          // the river's choice (TASKS 473), walked on the floor as laid: two ways over within AR.river.loose of each other, no walk
          // round it shorter, the shortest guarded at its far landing and a rock falling on the next
          const fig = new Uint8Array(W * m.H); if (m.riverBand) m.riverBand.forEach(([a, b], x) => { for (let y = Math.max(6, Math.floor(a)); y <= Math.min(m.H - 5, Math.ceil(b)); y++) if (y + 0.5 > a && y + 0.5 < b) fig[y * W + x] = 1; });
          const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e0 = m.exit.ty * W + m.exit.tx, Rw = DG.riverWays(m.cells, W, m.H, fig, s0, (c) => c === 1), ws = DG.riverAt(Rw, e0);
          // (TASKS 1160) the way with the guard has no aimed rocks of its own
          if (m.riverGuard) { const g = new Set(m.riverGuard); for (const z of m.hazards) if (z.k === 'fall' && z.aim && !z.tail && g.has(Math.floor(z.y / TILE) * W + Math.floor(z.x / TILE))) out.push(`${tag}: a run of rocks on the guarded crossing`); }
          if (!m.riverBand || !DG.riverOk(Rw, e0, AR.river.loose)) out.push(`${tag}: no choice of ways over the river (${ws.map((q) => q[0]).join('/')}, round its end ${Rw.dry[e0]})`);
          if (!m.enemies.some((e) => e.post === 'ford')) out.push(`${tag}: no guard at the river's shortest way over`);
          if (!m.hazards.some((z) => z.ford)) out.push(`${tag}: no rock falling on the river's second way over`); }
        // a chasm (TASKS 429): two chain bridges over the dark and more, packs waiting at them, the dark (not lava) round the plateaus
        if (m.ftype === 'chasm') { const W = m.W, br = m.crossings.filter((c) => c.chasm);
          // (TASKS 474) a rock falls on a bridge the walk to the stairs takes
          { const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e0 = m.exit.ty * W + m.exit.tx, from = new Int32Array(W * m.H).fill(-2), q = [s0]; from[s0] = -1;
            for (let i = 0; i < q.length && from[e0] === -2; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (from[n] === -2 && m.cells[n] === 1) { from[n] = q[i]; q.push(n); } }
            const way = new Set(); for (let k = e0; k >= 0 && from[e0] !== -2; k = from[k]) way.add(k);
            if (br.some((c) => c.cells.some((k) => way.has(k))) && !m.hazards.some((z) => z.span && br.some((c) => c.cells.some((k) => way.has(k) && D.hazIn(z, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE))))) out.push(`${tag}: no rock falling on a bridge of the walk to the stairs`); }
          if (br.length < 2) out.push(`${tag}: ${br.length} bridges over the chasm`);
          const held = br.filter((c) => m.enemies.some((e) => c.cells.some((k) => Math.hypot(e.x / TILE - 0.5 - (k % W), e.y / TILE - 0.5 - Math.floor(k / W)) < 9))).length;
          if (held < br.length / 2) out.push(`${tag}: ${held} of ${br.length} bridges with a pack by them`);
          let rim = 0, lav = 0; for (let k = 0; k < W * m.H; k++) if (m.cells[k] === 1 && [1, -1, W, -W].some((o) => m.cells[k + o] !== 1 && m.cells[k + o] !== 4)) { rim++; if ([1, -1, W, -W].some((o) => m.cells[k + o] === 3)) lav++; }
          if (lav > rim * 0.25) out.push(`${tag}: ${Math.round(lav / rim * 100)} % of the plateaus' edges by lava`); }
        // terraces (TASKS 430): three rows and more, the start on the first or the last and the stairs on the other, a lavafall down
        // the wall at the head of the river
        if (m.ftype === 'terrace') { const rows = Math.max(...m.rooms.map((r) => (r.row ?? -1))) + 1, s0 = m.rooms.find((r) => r.type === 'start'), e0 = m.rooms.find((r) => r.type === 'exit');
          if (rows < 3) out.push(`${tag}: ${rows} rows of terraces`);
          if (!s0 || !e0 || s0.row === undefined || e0.row === undefined || Math.min(s0.row, e0.row) !== 0 || Math.max(s0.row, e0.row) !== rows - 1) out.push(`${tag}: the start and the stairs are not the serpentine's two ends`);
          if (!m.lavaFeatures.some((q) => q.kind === 'fall')) out.push(`${tag}: no lavafall`); }
        // a lava cave (TASKS 431): its rock all wall (no chasm), streams of lava across its tunnels crossed twice and more, a source
        if (m.ftype === 'cave') { if (m.cliff.some((c) => c < m.H)) out.push(`${tag}: a lava cave with a chasm under its rock`);
          if (m.crossings.filter((c) => c.lava).length < 2) out.push(`${tag}: ${m.crossings.length} ways over its lava`);
          if (!m.lavaFeatures.length) out.push(`${tag}: no source of its lava`); }
        if (m.rooms.some((r) => r.isle && ['start', 'exit', 'boss', 'shop'].includes(r.type))) out.push(`${tag}: the start, the stairs or the merchant on an island`);
        if (m.ftype !== 'lake') continue; const isles = m.rooms.filter((r) => r.isle);
        if (isles.length < 2) out.push(`${tag}: ${isles.length} islands in the lake`);
        if (isles.some((r) => ['start', 'exit', 'boss', 'shop'].includes(r.type))) out.push(`${tag}: the start, the stairs or the merchant on an island`);
        // the lake's choice (TASKS 472), walked on the floor as laid: over the islands, and round them (their chain shut: the floor
        // reached from their middles within the lake's figure, its noise allowed for)
        if (!m.lakeAt) out.push(`${tag}: a lake without its figure`);
        else { const W = m.W, s0 = Math.floor(m.spawn.y / D.TILE) * W + Math.floor(m.spawn.x / D.TILE), e0 = m.exit.ty * W + m.exit.tx, shut = new Uint8Array(W * m.H), [cx, cy, rx, ry] = m.lakeAt;
          const inLake = (k) => Math.hypot((k % W + 0.5 - cx) / rx, (Math.floor(k / W) + 0.5 - cy) / ry) < 1.2, cq = isles.map((r) => r.cy * W + r.cx); for (const k of cq) shut[k] = 1;
          for (let i = 0; i < cq.length; i++) for (const o of [1, -1, W, -W]) { const n = cq[i] + o; if (!shut[n] && m.cells[n] === 1 && inLake(n) && !(m.rooms.some((r) => !r.isle && n % W >= r.x && n % W < r.x + r.w && Math.floor(n / W) >= r.y && Math.floor(n / W) < r.y + r.h))) { shut[n] = 1; cq.push(n); } }
          const walk = (ok) => { const d = new Int32Array(W * m.H).fill(-1), q = [s0]; d[s0] = 0; for (let i = 0; i < q.length; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (d[n] < 0 && m.cells[n] === 1 && ok(n)) { d[n] = d[q[i]] + 1; q.push(n); } } return d[e0]; };
          const a = walk(() => true), b = walk((n) => !shut[n]), L = AR.lake.loose;
          if (b < 0) out.push(`${tag}: no way round the lake`); else if (1 - a / b < L[0] || 1 - a / b > L[1]) out.push(`${tag}: the islands save ${Math.round(100 * (1 - a / b))} % of the way round (${a} against ${b})`); }
        // the lake is the floor's figure (the player's note on 427): a big island with the hoard and smaller ones, the plateaus on its
        // shore no bigger than the lake's own sizes, and no hole into the dark left in its lava
        if (new Set(isles.map((r) => r.w * r.h > 90 ? 'big' : r.w * r.h > 40 ? 'mid' : 'small')).size < 2) out.push(`${tag}: the islands are all of a size`);
        for (const r of m.rooms) if (!r.isle && !r.pocket && r.type !== 'secret' && r.type !== 'shop' && (r.w > (r.g || AR.lake.grow)[0] || r.h > (r.g || AR.lake.grow)[1])) out.push(`${tag}: a shore plateau of ${r.w}×${r.h}`);
        { const W = m.W, seen = new Uint8Array(W * m.H), wallAt = (k) => Math.floor(k / W) < m.cliff[k % W];
          for (let k0 = 0; k0 < W * m.H; k0++) { if (m.cells[k0] !== 0 || seen[k0] || wallAt(k0)) continue; const cs = [k0]; seen[k0] = 1; let shut = true;
            for (let i = 0; i < cs.length; i++) for (const o of [1, -1, W, -W]) { const n = cs[i] + o, x = n % W, y = Math.floor(n / W);
              if (x < 3 || y < 3 || x > W - 4 || y > m.H - 4) { shut = false; continue; } if (m.cells[n] === 3) continue; if (m.cells[n] !== 0 || wallAt(n)) { shut = false; continue; } if (!seen[n]) { seen[n] = 1; cs.push(n); } }
            if (shut) { out.push(`${tag}: a hole of ${cs.length} cells into the dark in the lava at ${k0 % W},${Math.floor(k0 / W)}`); break; } } }
        for (const q of m.secrets) { const r = m.rooms[q.room]; let lava = 0; for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (cell(m, x, y) === 3) lava++;
          if (lava > 2) out.push(`${tag}: a cache with ${lava} cells of lava round it`); } } }
    // terraces' steps and surge (TASKS 475), on 20 terrace floors of their own: most have a step down (the upper row's face onto the
    // lower), every one a surge the walk to the stairs crosses
    { let stepless = 0;
      for (let sd = 1; sd <= 10; sd++) for (const f of [2, 3]) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd, ftype: 'terrace' }), W = m.W, tag = `magma terrace ${sd} f${f}`;
        if (!(m.steps || []).length) stepless++; const z = (m.hazards || []).find((q) => q.k === 'surge'); if (!z) { out.push(`${tag}: no surge`); continue; }
        const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e0 = m.exit.ty * W + m.exit.tx, from = new Int32Array(W * m.H).fill(-2), q = [s0]; from[s0] = -1;
        for (let i = 0; i < q.length && from[e0] === -2; i++) for (const o of [1, -1, W, -W]) { const n = q[i] + o; if (from[n] === -2 && m.cells[n] === 1) { from[n] = q[i]; q.push(n); } }
        let on = false; for (let k = e0; k >= 0 && from[e0] !== -2; k = from[k]) if (D.hazIn(z, (k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE)) on = true;
        if (!on) out.push(`${tag}: the walk to the stairs misses the surge`);
        if (m.enemies.some((e) => D.hazIn(z, e.x, e.y))) out.push(`${tag}: a monster posted in the surge`); }
      if (stepless > 4) out.push(`magma terraces: ${stepless} of 20 floors with no step down`); }
    // the magma caves' halls (TASKS 434): one or two a floor but the boss's, each with its props, its reward and its own pack
    { const HL = D.MAGMA_HALLS, kinds = {}, inR = (r, o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= r.y * TILE && o.y < (r.y + r.h) * TILE;
      for (let sd = 1; sd <= 10; sd++) for (let f = 1; f <= D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f}`, hs = m.rooms.filter((r) => r.hall);
        if (f === D.RUNS.magma.floors ? hs.length : hs.length < HL.n[0] || hs.length > HL.n[1] + 1) out.push(`${tag}: ${hs.length} halls`);
        for (const r of hs) { kinds[r.hall] = 1; const K = HL.kinds[r.hall], lead = D.MAGMA_PACKS[K.pack].plan[0][0];
          const props = { sanctum: (m.circles || []).some((q) => q.r === r.id), forge: ['forge_mg', 'anvil_tw'].every((n) => m.decor.some((d) => d.n === n && inR(r, d))),
            nest: m.decor.filter((d) => d.n === 'skel_mg' && inR(r, d)).length >= 3, prison: m.decor.filter((d) => d.n === 'cage' && inR(r, d)).length >= 2 }[r.hall];
          if (!props) out.push(`${tag}: the ${r.hall} hall without its props`);
          if (!m.chests.some((c) => inR(r, c))) out.push(`${tag}: the ${r.hall} hall without its chest`);
          // (each kind its own pay, TASKS 1054)
          else if (!m.chests.some((c) => inR(r, c) && c.tier === K.pay.tier && (!(K.pay.forge || K.pay.stash) || c.hall === r.hall))) out.push(`${tag}: the ${r.hall} hall's chest not its own pay`);
          if (K.pay.bless && !(m.circles || []).some((q) => q.r === r.id && q.bless)) out.push(`${tag}: the sanctum's circle gives no blessing`);
          // (TASKS 1159) nothing that hurts or scars in the circle, and it blesses a floor still to be fought
          for (const q of (m.circles || []).filter((q) => q.r === r.id)) { if (m.traps.some((t) => Math.hypot(t.x - q.x, t.y - q.y) < 2.6 * TILE)) out.push(`${tag}: spikes in the sanctum's circle`); if ((m.decals || []).some((d) => Math.hypot(d.x - q.x, d.y - q.y) < 2.6 * TILE)) out.push(`${tag}: a decal in the sanctum's circle`); if (m.decor.some((d) => /^vent/.test(d.n) && Math.hypot(d.x - q.x, d.y - q.y) < 2.6 * TILE)) out.push(`${tag}: a vent in the sanctum's circle`); if (m.decor.some((d) => d.n === 'torch_stand' && Math.hypot(d.x - q.x, d.y - q.y) < 3.2 * TILE)) out.push(`${tag}: a torch in the sanctum's circle`); if (q.bless && Math.hypot(m.exit.x - q.x, m.exit.y - q.y) < HL.blessOff * TILE) out.push(`${tag}: the sanctum by the stairs`); }
          // (an early kind on the 1st floor, TASKS 488, has the floor's own pack: its monster comes later)
          if (!(f === 1 && K.early) && !m.enemies.some((e) => e.room === r.id && lead.includes(e.type))) out.push(`${tag}: the ${r.hall} hall without its pack`);
          if (f === 1 && K.early && !m.enemies.some((e) => e.room === r.id)) out.push(`${tag}: the ${r.hall} hall without a pack`); } }
      for (const k of Object.keys(HL.kinds)) if (!kinds[k]) out.push(`magma halls: no ${k} hall in 10 runs`); }
    // (TASKS 1054) a chasm floor's way over has another on half of them and more; a hoard's islet is a chest of the 3rd tier past a run of
    // rocks down its strip of crust
    { let n = 0, alt = 0, isl = 0; const walk = (m, ban) => { const W = m.W, s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), e0 = m.exit.ty * W + m.exit.tx, from = new Int32Array(W * m.H).fill(-2), q = [s0]; from[s0] = -1;
        for (let i = 0; i < q.length && from[e0] === -2; i++) for (const o of [1, -1, W, -W]) { const k = q[i] + o; if (from[k] === -2 && m.cells[k] === 1 && !ban.has(k)) { from[k] = q[i]; q.push(k); } }
        const way = new Set(); for (let k = e0; k >= 0 && from[e0] !== -2; k = from[k]) way.add(k); return way; };
      for (let sd = 1; sd <= 30; sd++) for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f}`;
        for (const r of m.rooms.filter((q) => q.islet)) { isl++; const inR = (o) => o.x >= r.x * TILE && o.x < (r.x + r.w) * TILE && o.y >= r.y * TILE && o.y < (r.y + r.h) * TILE;
          if (!m.chests.some((c) => inR(c) && c.tier === 3)) out.push(`${tag}: the islet's hoard not of the 3rd tier`);
          if (!m.hazards.some((z) => z.islet && !z.tail)) out.push(`${tag}: no rocks down the islet's strip`); }
        if (m.ftype !== 'chasm' || m.ftype2) continue; n++; const way = walk(m, new Set());
        if (m.crossings.some((c) => c.chasm && c.cells.some((k) => way.has(k)) && walk(m, new Set(c.cells)).size)) alt++;
        // (TASKS 1169) a walker to the stairs does not pass the second way's chest
        if (m.crossings.some((c) => c.alt)) for (const c of m.chests.filter((q) => q.round)) if (way.has(Math.floor(c.y / TILE) * m.W + Math.floor(c.x / TILE))) out.push(`${tag}: the second way's chest on the shortest walk`);
        // (TASKS 1158) the second way is no twin of the first
        for (const a of m.crossings.filter((c) => c.alt)) { const B = m.crossings.find((c) => !c.alt && c.cells.includes(a.of)); if (B && a.cells.some((k) => B.cells.some((j) => Math.max(Math.abs(k % m.W - j % m.W), Math.abs(Math.floor(k / m.W) - Math.floor(j / m.W))) < D.ARCH.plateau.chasm.alt.off))) out.push(`${tag}: the second bridge within ${D.ARCH.plateau.chasm.alt.off} cells of the first`); } }
      if (n && alt * 2 < n) out.push(`magma chasm: a way round a bridge of the walk on ${alt} of ${n} floors`);
      if (!isl) out.push('magma: no hoard\'s islet in 30 runs'); }
    for (const t of AR.types) if (!seen[t]) out.push(`floor type ${t} never turns up in 10 magma runs`);
    // the mix (TASKS 426): a lake, river or terrace floor over the chasm: it turns up in the runs, and on each figure a floor holds
    // the figure's own checks that the chasm could break (a walk to the stairs, a lava share, two bridges, every plateau in reach, the lake's islands)
    if (!mixed) out.push('no mixed floor in 10 magma runs');
    return out;
  }
  function floorBlendCheck() {
    const out = [], AR = D.ARCH.plateau;
    for (const ft of AR.blend.over) for (let sd = 1; sd <= 5; sd++) for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd, ftype: ft, ftype2: AR.blend.with }), tag = `mixed ${ft}+${m.ftype2} ${sd} f${f}`, W = m.W;
      if (m.ftype !== ft || m.ftype2 !== AR.blend.with) { out.push(`${tag}: came out as ${m.ftype}+${m.ftype2}`); continue; }
      const s0 = Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE), lost = DG.narrowTo(m.cells, W, m.H, s0, m.rooms.filter((r) => r.type !== 'secret').map((r) => r.cy * W + r.cx));
      if (lost.length) out.push(`${tag}: ${lost.length} plateau cells out of reach of a body two cells wide`);
      const pth = (AR[ft].path || AR.path)[f - 1] * AR.blend.pathKeep * 0.9; if (m.walk < pth)   // (0.9: tryGen's last attempts relax the walk to that share)
       out.push(`${tag}: the walk to the stairs is ${m.walk}, ${pth} at least`);
      const sh = m.lava / (m.cells.filter((c) => c === 1).length + m.lava); if (sh < m.shareOf[0] || sh > m.shareOf[1]) out.push(`${tag}: lava is ${Math.round(sh * 100)} % of floor and lava`);
      const br = m.crossings.filter((c) => c.chasm).length, need = ft === 'river' ? AR.blend.riverBridges : 2; if (br < need) out.push(`${tag}: ${br} bridges over the chasm`);
      if (!m.cells.some((c, k) => c === 0 && Math.floor(k / W) >= m.cliff[k % W] && [1, -1, W, -W].some((o) => m.cells[k + o] === 1))) out.push(`${tag}: no chasm by the plateaus`);
      if (ft === 'lake' && m.rooms.filter((r) => r.isle).length < 2) out.push(`${tag}: fewer than two islands in the lake`);
}
    // taking the stairs from every floor of a run onto the next, whatever its type (a step that read the floor it left crashed on a
    // floor with no crust)
    for (let sd = 1; sd <= 6; sd++) { const Z = spawn(0, {}); Z.run = newRun(Z, 'magma', sd); Z.screen = 'play'; const R2 = Z.run;
      try { for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = R2.map; R2.en = []; R2.hero.x = m.exit.x; R2.hero.y = m.exit.y; R2.msg = null;
          for (let i = 0; i < 30 && R2.floor === f; i++) step(Z, { keys: i % 10 === 0 ? ['KeyE'] : [] });
          if (R2.floor !== f + 1) { out.push(`magma run ${sd}: the stairs of floor ${f} (${m.ftype}) do not take the hero down`); break; }
          for (let i = 0; i < 60; i++) step(Z, { keys: [] }); } }
      catch (e) { out.push(`magma run ${sd}: taking the stairs threw ${e.message}`); } }
    // the magma caves' packs (TASKS 412): each floor brings its own kinds — none of the 2nd's on the 1st, none of the 3rd's on the 2nd
    const by = [{}, {}, {}]; for (let sd = 1; sd <= 10; sd++) for (let f = 1; f <= 3; f++) for (const e of DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }).enemies) if (!e.guard) by[f - 1][e.type] = 1;
    for (const [t, f0] of Object.entries(D.BIOMES.magma.from)) { if (f0 > 3) continue; if (!by[f0 - 1][t]) out.push(`magma: no ${t} on the ${f0}th floor it comes on`); if (f0 > 1 && by[f0 - 2][t]) out.push(`magma: a ${t} before the ${f0}th floor`); }
    return out; }
  // the magma caves' side ways (TASKS 433): on every floor but the boss's two dead ends off the way to the stairs and more, a ledge
  // always one, each holding a reward (a chest, an altar, an elite or a cache dug from it); no elite on the way but the stairs' own,
  // and two thirds of the floor's rewards and more off it
  function branchCheck() {
    const out = [];
    for (let sd = 1; sd <= 10; sd++) for (let f = 1; f < D.RUNS.magma.floors; f++) { const m = DG.genFloor(sd * 31 + f * 1013, f, { mode: 'magma', runSeed: sd }), tag = `magma run ${sd} f${f} (${m.ftype})`, q = DG.rewardsOf(m);
      const deg = m.rooms.map(() => 0); for (const [a, b] of m.edges) { deg[a]++; deg[b]++; }
      // (TASKS 1158: a chasm's second bridge joins up what were dead ends; its way round, with its chest, is the side way there)
      if (q.ends.length < 2 && !m.crossings.some((c) => c.alt)) out.push(`${tag}: ${q.ends.length} dead ends off the way`);
      for (const r of q.bare) out.push(`${tag}: a dead end off the way with no reward (room ${r.id})`);
      for (const r of m.rooms) if (r.kind === 'ledge' && deg[r.id] !== 1) out.push(`${tag}: a ledge on ${deg[r.id]} ways (room ${r.id})`);
      if (q.onWay * 3 > q.list.length) out.push(`${tag}: ${q.onWay} of ${q.list.length} rewards on the way`);
      const el = q.list.filter((w) => w.kind === 'elite' && q.way.has(w.room)).length; if (el) out.push(`${tag}: ${el} elites on the way`); }
    return out; }
  // the magma caves' hazards (TASKS 406): as many on each floor as HAZ.n has (more each floor to the 3rd), every one HAZ.clear cells
  // off the start's fire, the spawn, the stairs, chests, monsters' posts and the altar, a vent on 3×3 of floor a cell off the lava;
  // the warning comes HAZ.warn s before the burst, which hurts the hero (a vent sets him alight) and a monster in its ring once a
  // cycle, and nobody outside it
  // a run on a plain plateau floor for the checks of the plateaus' lava, chasm, crust and hazards (TASKS 426: a run's first floor
  // is a lava cave): run 3's first plain floor, else the next run's
  // the magma caves' new kinds (TASKS 407–409), by a river of lava on a plain floor: a bank, three cells of open lava, the far bank
  function magmaKindsCheck() {
    const out = [], Z = spawn(0, {}); Z.screen = 'play'; let sp = null, LW = 3;
    // the floor a bank cell reaches within eight cells round: a pocket of lava inside one plateau has its two sides joined
    const bankOf = (m, x0, y0) => { const W = m.W, got = new Set([y0 * W + x0]); for (const k of got) for (const o of [1, -1, W, -W]) { const n = k + o, x = n % W, y = Math.floor(n / W);
      if (Math.abs(x - x0) <= 8 && Math.abs(y - y0) <= 8 && cell(m, x, y) === 1) got.add(n); } return got; };
    // (the first magma floor with such a crossing, seed by seed)
    for (let sd = 3; sd < 40 && !sp; sd++) { Z.run = newRun(Z, 'magma', sd); for (let f = 1; f < D.RUNS.magma.floors && !sp; f++) { enterFloor(Z, Z.run, f); const m = Z.run.map, W = m.W; if (m.ftype2) continue;
      const lav = (x, y) => cell(m, x, y) === 3 && !crustAt(m, y * W + x), fl = (x, y) => cell(m, x, y) === 1;
      for (let k = 3; k >= 2 && !sp; k--) for (let y = 3; y < m.H - 3 && !sp; y++) for (let x = 3; x < W - 9 && !sp; x++)
        if ([-2, -1, 0].every((i) => [-1, 0, 1].every((j) => fl(x + i, y + j))) && Array.from({ length: k }, (_, i) => i + 1).every((i) => [-1, 0, 1].every((j) => lav(x + i, y + j))) && [k + 1, k + 2].every((i) => [-1, 0, 1].every((j) => fl(x + i, y + j))) && !bankOf(m, x, y).has(y * W + x + k + 1)) { sp = [x, y]; LW = k; } } }
    if (!sp) return ['magma kinds: no river two or three cells wide with banks on any magma floor'];
    const R = Z.run, m = R.map, h = R.hero, W = m.W, t = () => Z.t, lav = (x, y) => cell(m, x, y) === 3 && !crustAt(m, y * W + x); R.msg = null;
    const haz = m.hazards; m.hazards = []; m.traps = [];   // (no vent, rock or spike in the way of what is measured, and no blow dodged)
    const agi = h.base.agi; h.base.agi = 0; h.eq = Object.fromEntries(Object.keys(h.eq).map((k) => [k, null]));
    const X = (i) => (sp[0] + i + 0.5) * TILE, Y = (sp[1] + 0.5) * TILE + 4, steps = (s, f) => { for (let i = 0; i < 120 * s; i++) { step(Z, { keys: [] }); if (f && f()) return true; } return false; };
    const put = (hx = X(-1)) => { R.en = []; R.proj = []; R.fires = []; h.hp = heroSt(Z).maxHp; h.deadT = -1; h.burn = 0; h.ifr = 0; h.x = hx; h.y = Y; h.vx = h.vy = 0; h.dashT = -9; };
    const mk = (type, x, y, o) => { const E = ENEMIES[type], e = Object.assign({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp: E.hp * 3, max: E.hp * 3, dmg: 6, elite: 0, room: -1, st: 'chase', t0: t(), face: -1, aimA: Math.PI,
      cdT: 0, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: t(), hx: x, hy: y }, o); R.en.push(e); return e; };
    // the imp: a spark from range hurts and burns; one beside it leaps away; knocked into the lava it doesn't sink and leaps out;
    // on the hero's bank it leaps over the lava to the far one, where he can't walk to it
    { put(); const a = h.hp, i1 = mk('imp', X(-1) - 200, Y, { leapT: 1e9, lookT: 1e9 }); steps(3, () => h.hp < a);
      if (!(h.hp < a)) out.push('an imp in range never hurts the hero with its spark'); else if (!(h.burn > t())) out.push("an imp's spark does not set the hero burning"); void i1;
      put(); const i2 = mk('imp', X(-1) - 40, Y, { cdT: 1e9 }); let leapt = 0; steps(1.5, () => { if (i2.st === 'leap') leapt = 1; return leapt && i2.st === 'chase'; });
      if (!leapt) out.push('an imp beside the hero does not leap away'); else if (Math.hypot(i2.x - h.x, i2.y - h.y) < ENEMIES.imp.flee) out.push('an imp leaps away and lands still beside the hero');
      put(X(-3)); const i3 = mk('imp', X(Math.ceil(LW / 2)), Y, { cdT: 1e9 }); steps(1.5);
      if (i3.sinkT !== undefined || i3.deadT >= 0) out.push('an imp in the lava sinks or burns'); else if (cell(m, Math.floor(i3.x / TILE), Math.floor(i3.y / TILE)) !== 1) out.push('an imp in the lava stays in it');
      put(X(-2)); const i4 = mk('imp', X(-2) + 70, Y + 20, { cdT: 1e9, leapT: 0, lookT: 0 }); let over = 0; const F0 = () => flow(m, Math.floor(h.x / TILE), Math.floor(h.y / TILE));
      // (the far bank: floor the hero's bank doesn't reach within eight cells round; past a bend it lies lower down the river too)
      const near = bankOf(m, sp[0], sp[1]), far = () => { const x = Math.floor(i4.x / TILE), y = Math.floor(i4.y / TILE); return cell(m, x, y) === 1 && !near.has(y * W + x); };
      steps(4, () => { if (i4.st === 'leap' && lav(Math.floor(i4.x / TILE), Math.floor(i4.y / TILE))) over = 1; h.x = X(-2); h.y = Y; return over && i4.st === 'chase' && far(); }); void F0;
      if (!over) out.push('an imp on the hero\'s bank never leaps over the lava'); else if (!far()) out.push('an imp leaps out over the lava and does not land on the far bank'); }
    // the salamander: in the lava by the bank it comes for the hero and hurts him, never burning in it; its breath burns one in its
    // cone and spares one who stepped out of it; its fire on the floor burns; hurt, it swims back and heals, not while hit
    { put(X(-2)); const a = h.hp, s1 = mk('salamander', X(Math.ceil(LW / 2)), Y, { fa: Math.PI }); let out1 = 0; steps(6, () => { if (!onLava(m, s1)) out1 = 1; return h.hp < a; });
      if (s1.sinkT !== undefined || s1.hp < s1.max) out.push('a salamander burns in the lava'); if (!(h.hp < a)) out.push('a salamander by the bank never hurts the hero'); void out1;
      for (const stay of [1, 0]) { put(X(-2)); const B = ENEMIES.salamander.breath, s2 = mk('salamander', X(-2) - 110, Y, { fa: 0, aimA: 0, brT: 0 }); let lit = -1, a2 = h.hp, early = 0;
        // (out of the cone: off its side on whole floor, beyond its bite)
        const side = [[0, 120], [0, -120], [-40, 120], [-40, -120]].map(([dx, dy]) => [s2.x + dx, s2.y + dy]).find(([x, y]) => cell(m, Math.floor(x / TILE), Math.floor(y / TILE)) === 1 && cell(m, Math.floor(x / TILE), Math.floor((y - 20) / TILE)) === 1) || [s2.x, s2.y + 120];
        steps(2.5, () => { if (lit < 0 && s2.st === 'wind' && s2.br) lit = t(); if (!stay && lit >= 0) { h.x = side[0]; h.y = side[1]; h.vx = h.vy = 0; } if (lit >= 0 && t() - lit < B.wind - DT && h.hp < a2) early = 1; return lit >= 0 && t() > lit + B.wind + B.t; });
        if (lit < 0) { out.push('a salamander in reach never breathes fire'); break; }
        if (early) out.push("a salamander's breath burns before its wind-up is out");
        if (stay && !(h.hp < a2 && h.burn > t() - 0.5)) out.push("a salamander's breath does not burn the hero in its cone"); if (!stay && h.hp < a2) out.push("a salamander's breath burns a hero out of its cone"); }
      put(); const a3 = h.hp; addFire(R, Z, h.x, h.y, { src: 0, who: 'salamander', r: 30, ry: 0.6, t: 2.4, dmg: 5, per: 1, kind: 'trail' }); steps(0.2);
      if (!(h.hp < a3) || !(h.burn > t())) out.push("a salamander's fire on the floor does not burn the hero in it");
      put(X(-5)); const s3 = mk('salamander', X(-1), Y, { fa: 0 }); s3.hp = Math.round(s3.max * 0.4); const hp0 = s3.hp; let soaked = 0;
      steps(6, () => { h.x = X(-8); h.y = Y; if (s3.st === 'soak' && onLava(m, s3)) soaked = 1; return soaked && s3.hp > s3.max * 0.55; });
      if (!soaked) out.push('a salamander under half its health does not go back into the lava'); else if (!(s3.hp > hp0)) out.push('a salamander in the lava does not heal');
      if (soaked && s3.st === 'soak') { const v = s3.hp; hitEnemy(Z, R, s3, 1, false, s3.x, s3.y, 0); const v1 = s3.hp; steps(0.8, () => { h.x = X(-8); h.y = Y; }); if (s3.hp > v1 + 0.5) out.push('a salamander heals in the lava while it is being hit'); void v; } }
    // the golem: its first blows only take its crust off, then blows land whole; the crust grows back with the hero away and no blow
    // landing; its slam hurts the hero before it and spares one who stepped back; dead, its pool burns him
    { put(X(-6)); const C = ENEMIES.golem.crust, g = mk('golem', X(-6) - 60, Y, { cdT: 1e9, hp: 400, max: 400 }), took = [];
      for (let i = 0; i <= C.n; i++) { const v = g.hp; hitEnemy(Z, R, g, 40, false, h.x, h.y); took.push(v - g.hp); }
      if (took.slice(0, C.n).some((d) => d !== Math.round(40 * C.k)) || took[C.n] !== 40) out.push(`a golem's blows through its crust took ${took.join('/')}, not ${Math.round(40 * C.k)} × ${C.n} then 40`);
      // (calm at its post: one walking after the hero stepped on a spike plate, a blow all the same)
      put(X(-6)); R.en = [g]; Object.assign(g, { x: X(-2), y: Y, hx: X(-2), hy: Y, st: 'idle', calmT: 1e9 }); g.hitT = g.blowT = t(); let grew = 0; steps(C.calm + 3 * C.regrow, () => { h.x = g.x + 340; h.y = g.y; if ((g.crust ?? C.n) > 0) grew = 1; return grew; });
      if (!grew) out.push("a golem's crust never grows back with the hero away");
      for (const stay of [1, 0]) { put(X(0)); const g2 = mk('golem', X(-2), Y, { cdT: 0 }); let w = -1, a = h.hp;
        steps(3, () => { if (w < 0 && g2.st === 'wind') w = t(); if (!stay && w >= 0) { h.x = g2.x - 2 * TILE; h.y = g2.y - 3 * TILE; } else if (stay) { h.x = X(0); h.y = Y; } h.vx = h.vy = 0; return w >= 0 && g2.st === 'chase'; });
        if (w < 0) { out.push('a golem beside the hero never slams'); break; } if (stay && !(h.hp < a)) out.push("a golem's slam does not hurt the hero before it"); if (!stay && h.hp < a) out.push("a golem's slam hurts a hero who stepped back"); }
      put(X(-1)); const g3 = mk('golem', X(-1), Y, { cdT: 1e9, st: 'idle', calmT: 1e9 }); g3.hp = 1; g3.crust = 0; hitEnemy(Z, R, g3, 10, false, h.x - 30, h.y); const pool = (R.fires || []).find((p) => p.kind === 'pool');
      if (!pool) out.push('a golem falls without a pool of lava'); else { const a = h.hp; steps(ENEMIES.golem.pool.arm * 0.8); if (h.hp < a) out.push("a golem's pool burns its killer before he can step out");
        steps(ENEMIES.golem.pool.arm * 0.2 + 0.3); if (!(h.hp < a)) out.push("a golem's pool does not burn the hero in it");
        steps(ENEMIES.golem.pool.t); if (R.fires.includes(pool)) out.push("a golem's pool never cools"); } }
    // a burning hero beats the flames out with a dash (TASKS 463)
    { put(); h.burn = t() + 3; h.cd.dash = 0; Z.ev = []; step(Z, { keys: ['Space'] }); if (h.burn > t() || !Z.ev.some((e) => e.k === 'snuff')) out.push('a dash does not put out a burning hero'); }
    m.hazards = haz; h.base.agi = agi; return out;
  }
  const plainRun = (Z) => { for (let sd = 3; sd < 60; sd++) { Z.run = newRun(Z, 'magma', sd); for (let f = 2; f < D.RUNS.magma.floors; f++) { enterFloor(Z, Z.run, f); if (Z.run.map.ftype === 'plain') return Z.run; } } return Z.run; };
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
  // a table stops the hero walking into it; a blow on it (or on a brazier) knocks once per swing and carries its material
  function propCheck() {
    const out = []; let S = null, d = null, di = -1;
    for (let sd = 1; sd < 80 && !d; sd++) { S = spawn(0, {}); S.run = newRun(S, 'campaign', 7000 + sd); const m = S.run.map;
      di = m.decor.findIndex((o) => { const x = Math.floor(o.x / TILE), y = Math.floor(o.y / TILE); return o.n === 'table' && [1, 2].every((k) => cell(m, x - k, y) === 1 && !m.block.includes(y * m.W + x - k)); }); d = m.decor[di]; }
    if (!d) return ['prop check: no table with open floor on its left in 80 seeds'];
    S.screen = 'play'; const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9;
    if (!d.solid) out.push('prop check: a table is not solid');
    const A = () => ({ ...toPx(R, d.x, d.y - 30) });
    h.x = d.x - 50; h.y = d.y; let close = 99;
    for (let k = 0; k < 120; k++) { step(S, Object.assign({ right: 1, keys: [] }, A())); close = Math.min(close, d.x - h.x); }
    if (close < 18) out.push(`prop check: the hero walks ${(18 - close).toFixed(0)} px into a table`);
    const swing = () => { h.x = d.x - 40; h.y = d.y; h.cd.atk = 0; step(S, Object.assign({ press: 1, keys: [] }, A())); for (let k = 0; k < 40; k++) { h.x = d.x - 40; h.y = d.y; step(S, Object.assign({ keys: [] }, A())); } };
    S.ev = []; swing(); const hits = S.ev.filter((e) => e.k === 'prop' && e.i === 'd' + di);
    if (hits.length !== 1) out.push(`prop check: a swing at a table knocks it ${hits.length} times`);
    else if (hits[0].mat !== 'wood' || hits[0].s !== 1) out.push(`prop check: a table knocked from the left reads ${hits[0].mat} / ${hits[0].s}`);
    const m = R.map, bi = m.torches.findIndex((t2) => t2.kind === 'brazier');
    if (bi >= 0) { const b = m.torches[bi]; S.ev = []; hitProps(S, R, b.x + 30, b.y, 40);
      if (!S.ev.some((e) => e.k === 'prop' && e.i === 't' + bi && e.mat === 'metal' && e.s === -1)) out.push('prop check: a blow from the right does not knock the brazier'); }
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
      if (!e || e.st !== 'rise' || R.drops.length !== n0 || c.loot.length !== items) out.push('mimic: did not wake holding its loot'); if (solids(R).some((o) => o.x === c.x && o.y === c.y)) out.push('mimic: its chest still stands in the way');
      if (lootAudit(R).off !== A0) out.push('mimic: loot books off while it lives'); for (let k = 0; k < 300 && !R.en.some((o) => o.st === 'strike' && o.type === 'mimic'); k++) step(S, { keys: [] }); if (!R.en.some((o) => o.st === 'strike')) out.push('mimic: never bites');
      e.hp = 0; killEnemy(S, R, e); if (R.drops.filter((d) => d.kind === 'item').length < items || c.loot.length) out.push('mimic: its loot did not fall'); if (lootAudit(R).off !== A0) out.push('mimic: loot books off after it dies'); if (R.stats[f] && R.stats[f].kills > R.stats[f].foes + 1) out.push('mimic: counted among the floor\'s monsters'); }
    if (!mims) out.push('mimic: none on 80 seeds');
    return out; }
  // secrets, loot tables and completion stats, played through the sim
  // how each cache is opened, checked on the floor as laid: no way that needs a blow, every mechanism reached from the open floor (the outer floor, or the parent cache for one inside another)
  function cacheIssues(m, q, i, shut) { const out = [], W = m.W, reachC = (x, y) => shut[y * W + x] || (q.parent !== undefined && inRoom1(m.rooms[m.secrets[q.parent].room], x, y));
    if (!['banner', 'shelf', 'statue', 'lever', 'puzzle'].includes(q.kind) || q.hp !== undefined) out.push('has an old or missing kind');
    if (['banner', 'shelf', 'statue'].includes(q.kind) && q.dir !== 'u') out.push('is not on a top wall');
    if (q.kind === 'banner' && !m.decor.some((d) => d.secret === i && d.n === 'banner' && d.wall)) out.push('has no banner');
    if (q.kind === 'shelf' && (!m.decor.some((d) => d.secret === i && d.n === 'bookshelf' && d.solid) || q.slide)) out.push('has no bookshelf, or one that slides');
    if (q.kind === 'statue') { const d = m.decor.find((o) => o.secret === i && o.solid); if (!d || !q.slide || ![1, 2].includes(q.slide.n) || ![1, -1].includes(q.slide.s)) out.push('has no statue or slide');
      else { const fy = Math.floor(d.y / TILE), fc = Math.floor(q.x / TILE), tc = fc + q.slide.s * q.slide.n, tk = fy * W + tc, o0 = fy * W + fc, blk = new Set(m.block), flood = (b) => { const sv = new Set(), st = [Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE)]; sv.add(st[0]); while (st.length) { const k = st.pop(); for (const v of [1, -1, W, -W]) { const n = k + v; if (!sv.has(n) && m.cells[n] === 1 && !b.has(n)) { sv.add(n); st.push(n); } } } return sv; };
        for (let c = fc + q.slide.s; c !== tc + q.slide.s; c += q.slide.s) if (m.cells[fy * W + c] !== 1) out.push('slides into rock');
        const sA = flood(blk); blk.delete(o0); blk.add(tk); const sB = flood(blk); if (sB.size < sA.size) out.push('statue shuts a passage when moved'); } }
    if (q.kind !== 'lever' && q.trig) out.push('has a mechanism it should not');
    if (q.kind === 'lever') { const P = q.trig; if (!P) out.push('has no mechanism');
      else if (P.k === 'plate') { if (!reachC(P.cx, P.cy) || m.traps.some((t) => Math.abs(t.x / TILE - P.cx - 0.5) < 1.5 && Math.abs(t.y / TILE - P.cy - 0.5) < 1.5)) out.push('its flagstone is out of reach or on spikes'); }
      else if (P.k === 'sconce') { const t = m.torches[P.t]; if (!t || t.kind !== 'wall' || t.side || t.lever !== i || t.sec !== undefined) out.push('its sconce is missing or hidden'); }
      else if (P.k === 'lever') { const x = Math.floor(P.x / TILE), y = Math.floor((P.y + 48) / TILE); if (!reachC(x, y)) out.push('its lever is out of reach'); }
      else out.push('has an unknown mechanism'); }
    if (q.kind === 'puzzle') { const Z = q.pz, ns = (Z && Z.items || []).map((it) => it.n).sort(); if (!Z || ns.join() !== '1,2,3') out.push('has a broken puzzle');
      else for (const it of Z.items) { const x = Math.floor(it.x / TILE), y = Z.k === 'levers' ? Math.floor((it.y + 48) / TILE) : Math.floor(it.y / TILE); if (!reachC(x, y)) out.push(`a ${Z.k} piece is out of reach`); }
      if (Z && Z.k === 'candles' && m.decor.filter((d) => d.pz === i && d.n === 'candles').length !== 3) out.push('is missing its candles'); }
    return out; }
  // over many floors: caches open by honest means only, the floors keep no hoards, and the planned rooms and puzzles do turn up
  function cacheGenCheck() { const out = [], seen = {}, lib = { n: 0, shelf: 0 };
    for (let seed = 1; seed <= 30; seed++) for (let f = 1; f <= D.RUNS.campaign.floors; f++) { const s0 = (seed * 811 + f * 1303) >>> 0; let m; try { m = DG.genFloor(s0, f); } catch (e) { out.push(`gen ${s0} f${f}: ${e.message}`); continue; }
      if (m.rooms.some((r) => r.type === 'treasure')) out.push(`gen ${s0} f${f}: a treasure room`);
      if (m.secrets.some((q) => q.kind === 'crack')) out.push(`gen ${s0} f${f}: a crack secret`);
      const W = m.W, walk = (() => { const sv = new Uint8Array(W * m.H), st = [Math.floor(m.spawn.y / TILE) * W + Math.floor(m.spawn.x / TILE)]; sv[st[0]] = 1; while (st.length) { const k = st.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!sv[n] && m.cells[n] === 1 && !m.block.includes(n)) { sv[n] = 1; st.push(n); } } } return sv; })();
      m.secrets.forEach((q, i) => { for (const e of cacheIssues(m, q, i, walk)) out.push(`gen ${s0} f${f}: secret ${i} (${q.kind}) ${e}`); seen[q.kind] = 1; if (q.trig) seen[q.trig.k] = 1; if (q.pz) seen[q.pz.k] = 1; if (q.parent !== undefined) seen.inner = 1;
        const h = m.rooms[q.host]; if (h && h.plan && (q.kind === 'statue' || q.kind === 'shelf')) seen.planned = 1; if (h && h.plan === 'library' && q.dir === 'u') { lib.n++; if (q.kind === 'shelf') lib.shelf++; } }); }
    for (const k of ['banner', 'shelf', 'statue', 'sconce', 'plate', 'lever', 'levers', 'candles', 'inner', 'planned']) if (!seen[k]) out.push(`cache check: no ${k} cache on any of the floors checked`);
    // (TASKS 1852) a planned bookcase stays one, room along the wall or not: a library's wall caches keep their share of bookcases
    if (lib.shelf < lib.n * 0.12) out.push(`cache check: ${lib.shelf} of ${lib.n} library wall caches are bookcases (a planned bookcase turned into a lever or banner)`);
    return out; }
  const find = (f) => { for (let sd = 1; sd < 120; sd++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 5000 + sd); const q = S.run.map.secrets.find(f); if (q) return [S, q]; } return [null, null]; };
  const standAt = (R, q) => { const h = R.hero, P = q.trig, tc = P && P.k === 'sconce' ? R.map.torches[P.t] : null; Object.assign(h, { vx: 0, vy: 0 });
    if (q.kind === 'banner') { h.x = q.x; h.y = q.y + 34; } if (q.kind === 'shelf' || q.kind === 'statue') { h.x = q.x; h.y = q.y + 70; } if (tc) { h.x = tc.x; h.y = tc.y + 50; } if (P && P.k === 'lever') { h.x = P.x; h.y = P.y + 50; } if (P && P.k === 'plate') { h.x = P.x; h.y = P.y; } };
  const swing = (S, R, q) => { const h = R.hero; h.x = q.x; h.y = q.y + 34; h.vx = h.vy = 0; h.cd.atk = 0; const A = { ...toPx(R, q.x, q.y - 30) }; step(S, Object.assign({ press: 1, keys: [] }, A)); for (let j = 0; j < 40; j++) step(S, Object.assign({ keys: [] }, A)); };
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
    // puzzles (TASKS 1692): the right order opens the cache, any wrong piece puts everything back and hurts nobody
    for (const k of ['levers', 'candles']) { const [S, q] = find((o) => o.pz && o.pz.k === k); if (!q) { out.push(`secret check: no ${k} puzzle in 120 seeds`); continue; }
      S.screen = 'play'; const R = S.run, m = R.map, h = R.hero; R.en = []; R.stats[1] = floorStat(R); h.ifr = 1e9; const hp0 = h.hp, ord = [...q.pz.items.keys()].sort((a, b) => q.pz.items[a].n - q.pz.items[b].n);
      playItem(S, R, q, ord[1]); if (q.pz.step || q.pz.items.some((it) => it.on) || q.open) out.push(`puzzle ${k}: a wrong start does not reset`);
      playItem(S, R, q, ord[0]); if (q.pz.step !== 1 || q.open) out.push(`puzzle ${k}: the first piece does not hold`);
      playItem(S, R, q, ord[2]); if (q.pz.step || q.open) out.push(`puzzle ${k}: a wrong piece does not reset`);
      if (h.hp !== hp0) out.push(`puzzle ${k}: a wrong try costs health`);
      for (const j of ord) { playItem(S, R, q, j); } if (!q.open) out.push(`puzzle ${k}: the right order does not open it`);
      if (R.stats[1].sec !== 1) out.push(`puzzle ${k}: a solved puzzle is not counted`);
      if (k === 'candles' && m.decor.filter((d) => d.pz === m.secrets.indexOf(q)).some((d) => (d.outUntil || 0) > S.t)) out.push('puzzle candles: a solved puzzle left a candle dark'); }
    // every secret of two whole campaigns, opened by the way the game offers it; a cache behind another is reached once its parent is open
    for (const sd of [11, 222]) for (let f = 1; f <= D.RUNS.campaign.chapter; f++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play';
      const R = S.run, m = R.map, h = R.hero; R.en = []; h.ifr = 1e9;
      m.secrets.forEach((q, i) => { if (q.parent !== undefined && !m.secrets[q.parent].open) openSecret(S, R, m.secrets[q.parent], true);
        if (q.pz) { for (const j of [...q.pz.items.keys()].sort((a, b) => q.pz.items[a].n - q.pz.items[b].n)) playItem(S, R, q, j); }
        else if (q.kind === 'shelf') for (let k = 0; k <= D.SHELF_SECRET.hp && !q.open; k++) swing(S, R, q);
        else for (let k = 0; k < 4 && !q.open; k++) { standAt(R, q); if (q.trig && q.trig.k === 'plate') step(S, { keys: [], px: 960, py: 540 }); else pressE(S); }
        if (!q.open) out.push(`seed ${sd} f${f}: secret ${i} (${q.kind}${q.trig ? ' ' + q.trig.k : ''}, ${q.dir}) does not open by its way`); }); }
    // loot: open every chest of a few floors (secret ones too, each after its secret, as in play: TASKS 1868, the loot of a chest opened
    // in a shut 3×5 cache had no cell out of its props' shade), let the items fall and pick up half of them; the floor's books
    // balance at every stage and no item comes to rest where the hero cannot get to it
    for (const sd of [11, 222]) for (const f of [1, 4, 8]) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd); if (f > 1) enterFloor(S, S.run, f); S.screen = 'play';
      const R = S.run, h = R.hero; R.en = []; h.ifr = 1e9; const check = (when) => { const A = lootAudit(R); if (A.off) out.push(`seed ${sd} f${f}: loot books off by ${A.off} ${when}`); if (A.stuck) out.push(`seed ${sd} f${f}: ${A.stuck} loot out of reach ${when}`); };
      check('on arrival'); for (const c of R.chests) { const line = []; for (let q = c.sec !== undefined ? R.map.secrets[c.sec] : null; q; q = q.parent !== undefined ? R.map.secrets[q.parent] : null) line.unshift(q); for (const q of line) if (!q.open) openSecret(S, R, q, true); openChest(S, R, c); } h.x = R.map.spawn.x; h.y = R.map.spawn.y; for (let k = 0; k < 120; k++) step(S, { keys: [] }); check('with every chest open');
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
        { const e = crab({}); h.x = x0 + E.r + K.R + 14; let hurt = 0; for (let i = 0; i < 240 && !hurt; i++) { step(S, quiet); if (S.ev.some((v) => v.k === 'hurt' && v.t === S.t)) hurt = 1; h.hp = 1e4; h.x = x0 + E.r + K.R + 14; h.y = y0; }
          if (!hurt || !S.ev.some((v) => v.k === 'pinch' && v.id === e.id)) out.push('crab: never pinches a hero before it'); }
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
        step(U, { keys: ['Escape'] }); if (U.screen !== 'menu') out.push('news: Escape does not go back to the menu'); }
      toTests(U); const mg = UI.tests(true).find((b) => b.id === 'magma'); press(U, mg); step(U, { keys: [] });
      if (U.run || U.saved.mode !== 'campaign' || U.newAsk !== 'magma' || U.focus !== 'no') out.push('tests: one press over a saved run drops it or does not ask with «Нет» first');
      press(U, UI.newAsk().r.find((b) => b.id === 'yes')); if (U.screen === 'classes') press(U, UI.classes().find((b) => b.id === 'go')); noWelcome(U); if (!U.run || U.run.mode !== 'magma' || U.saved) out.push('tests: the second press does not start the test run'); }
    return out;
  }
  // the floor modifiers (TASKS 381): drawn only on the rooms floors 3, 5 and 7 of the campaign and the descent's rooms floors past the
  // 2nd that are no boss's, about half of them, each of the five, no flood on the fire floors; each one does what it says over the
  // same floor laid without it; the banner names it; gold and a hoard's ambush answer it in the sim
  function floorModCheck() {
    const out = [], ids = Object.keys(D.FLOOR_MODS), got = {}; let on = 0, may = 0;
    for (let sd = 1; sd <= 200; sd++) for (let f = 1; f <= D.RUNS.campaign.floors; f++) { const st = D.stageOf('campaign', f, sd);
      if (st.mod !== D.stageOf('campaign', f, sd).mod) out.push(`floor mod: campaign ${sd}/${f} draws another modifier the second time`);
      const can = f >= D.FLOOR_MOD.from && !st.boss && !st.arch && f <= D.RUNS.campaign.chapter;
      if (st.mod && !can) out.push(`floor mod: campaign ${sd}/${f} has «${st.mod}» on a floor that takes none`);
      if (st.mod && (D.FLOOR_MODS[st.mod].not || []).includes(st.biome)) out.push(`floor mod: campaign ${sd}/${f} has «${st.mod}» in ${st.biome}`);
      if (st.mod && (D.FLOOR_MODS[st.mod].notLay || []).includes(st.lay)) out.push(`floor mod: campaign ${sd}/${f} has «${st.mod}» on a ${st.lay} floor`);
      if (can) { may++; if (st.mod) { on++; got[st.mod] = 1; } } }
    if (on < may * 0.4 || on > may * 0.6) out.push(`floor mod: ${on} of ${may} campaign floors drew one, not about half`);
    for (const k of ids) if (!got[k]) out.push(`floor mod: «${k}» never drawn on 200 campaign runs`);
    for (let sd = 1; sd <= 40; sd++) for (let f = 1; f <= 24; f++) { const st = D.stageOf('endless', f, sd); if (st.mod && (st.boss || st.arch || f < D.FLOOR_MOD.from)) out.push(`floor mod: descent ${sd}/${f} has «${st.mod}» on a boss's, cave's or early floor`); }
    // the banner never names a modifier its floor lacks (PR 30: campaign 24/3 drew «flood» and laid no stream), and few floors lose theirs
    const held = { flood: (m) => m.waterFeatures.length > 0, lair: (m) => m.chests.some((c) => c.lair), cursed: (m) => m.traps.some((t) => t.run !== undefined) };
    { let drew = 0, lost = 0; for (let sd = 1; sd <= 60; sd++) for (const f of [3, 5, 7]) { const st = D.stageOf('campaign', f, sd); if (!st.mod) continue;
        const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd }); drew++; if (!m.mod) { lost++; continue; }
        if (m.mod !== st.mod || (held[m.mod] && !held[m.mod](m))) out.push(`floor mod: campaign ${sd}/${f} names «${m.mod}» and does not have it`); }
      if (lost > drew * 0.05) out.push(`floor mod: ${lost} of ${drew} campaign floors laid without their modifier`); }
    const gen = (sd, f, mod) => DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd, stage: { mod } });
    const sum = (mod, fn) => { let n = 0; for (let sd = 1; sd <= 6; sd++) for (const f of [3, 7]) n += fn(gen(sd, f, mod), sd, f); return n; };
    const walls = (m) => m.torches.filter((t) => t.kind === 'wall').length, rows = (m) => new Set(m.traps.filter((t) => t.run !== undefined).map((t) => t.run)).size;
    const elites = (m) => m.enemies.filter((e) => e.elite).length;
    if (sum('flood', (m) => m.waterFeatures.length) < 1.5 * sum(undefined, (m) => m.waterFeatures.length)) out.push('floor mod: a flooded floor has not half as many streams again');
    { const d = sum('dark', walls), b = sum(undefined, walls); if (d < 0.25 * b || d > 0.55 * b) out.push(`floor mod: a dark floor keeps ${d} of ${b} wall torches, not about 40 %`); }
    sum('lair', (m, sd, f) => { const b = gen(sd, f, undefined); if (elites(m) !== elites(b) + D.FLOOR_MODS.lair.elites) out.push(`floor mod: lair ${sd}/${f} has ${elites(m)} elites over ${elites(b)}`);
      if (!m.chests.some((c) => c.lair && c.tier === D.FLOOR_MODS.lair.chest)) out.push(`floor mod: lair ${sd}/${f} has no chest of the top tier`); return 0; });
    if (sum('cursed', rows) < 2 * Math.max(1, sum(undefined, rows))) out.push('floor mod: a cursed floor has not the plate rows of all its long corridors');
    if (sum('quiet', (m) => m.enemies.length) > 0.8 * sum(undefined, (m) => m.enemies.length)) out.push('floor mod: a quiet floor holds not about 30 % fewer monsters');
    { const m = gen(1, 3, 'quiet'); if (m.mod !== 'quiet' || !D.placeName(3, 'campaign', 1, 1, m).includes(D.FLOOR_MODS.quiet.name)) out.push('floor mod: the banner does not name the modifier'); }
    // gold picked up, and a hoard's chest springing its ambush on a draw between its plain chance and the doubled one
    const run = (mod) => { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77); S.screen = 'play'; const R = S.run; for (const e of R.en) { e.st = 'idle'; e.x += 5000; e.hx = e.x; } R.map.mod = mod; return [S, R]; };
    for (const mod of [undefined, 'cursed']) { const [S, R] = run(mod), h = R.hero, g0 = h.gold, want = Math.round(100 * heroSt(S).gold * ((D.FLOOR_MODS[mod] || {}).gold || 1));
      R.drops.push({ kind: 'gold', x: h.x, y: h.y, n: 100, id: R.nextId++ }); for (let i = 0; i < 5; i++) step(S, { keys: [] });
      if (h.gold - g0 !== want) out.push(`floor mod: gold picked up on a ${mod || 'plain'} floor is ${h.gold - g0}, not ${want}`); }
    for (const mod of [undefined, 'quiet']) { const [S, R] = run(mod), h = R.hero, room = DG.roomAt(R.map, h.x, h.y), was = R.map.rooms[room].type;
      let rs = 1; for (; rs < 1e6; rs++) { const v = rnd({ rs }); if (v > 0.06 && v < 0.09) break; }
      R.map.rooms[room].type = 'secret'; R.rs = rs; S.ev = []; openChest(S, R, { x: h.x, y: h.y, tier: 1, open: 0, loot: [] }); R.map.rooms[room].type = was;
      if (S.ev.some((e) => e.k === 'ambush') !== !!mod) out.push(`floor mod: a cache's chest on a ${mod || 'plain'} floor ${mod ? 'does not spring' : 'springs'} an ambush on a draw of 0.06–0.09`); }
    return out;
  }
  // the town (R-17, TASKS 1002): floor 0 of a run started from «Тесты», a safe zone where the hero walks, swings, opens the bag,
  // pauses and saves as on a floor, and whose stairs lead down to the 1st
  // TASKS 1015: the townsfolk over two minutes of a town with the hero out of the way: the walkers make their whole rounds on open
  // floor and never pass through each other, the porter lifts and sets down his crate, the anvil rings; walked up to, a townsperson
  // speaks a pair of lines, turns to the hero and a walker stops; every role's lines are pairs
  function folkCheck() {
    const out = [];
    for (const [role, F] of Object.entries(D.FOLK)) if (F.lines && !F.lines.every((p) => p.length === 2 && p.every((q) => typeof q === 'string' && q.length > 3 && q.length <= 64))) out.push(`folk: the ${role}'s lines are not pairs of short lines`);
    for (const sd of [3, 11, 29]) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero;
      h.x = m.town.svc.bin.x + TILE; h.y = m.town.svc.bin.y;
      const F = folkOf(R), stops = F.map(() => new Set()), loads = new Set(), stuck = F.map(() => 0), lifts = [], henWalk = F.map(() => 0); let close = 9, off = 0, rings = 0, empty = 0, fed = 0;
      for (let i = 0; i < 120 * 120; i++) { const t0 = S.t; step(S, { keys: [] }); rings += S.ev.filter((e) => e.k === 'anvil' && e.t > t0).length;
        for (const f of F) { if ((!f.go || f.role === 'porter') && f.way >= 0) stops[f.i].add(f.way); stuck[f.i] = Math.max(stuck[f.i], f.stuck); henWalk[f.i] = f.dist;
          if (f.role === 'hen' && R.grain && S.t - R.grain.t < 6 && Math.hypot(f.x - R.grain.x, f.y - R.grain.y) < 24) fed = 1;
          if (f.role === 'porter') { loads.add(f.load); if (f.lift && lifts[lifts.length - 1]?.t !== f.t0) lifts.push({ k: f.lift, t: f.t0 });
            const st = m.town.npcs[f.i].route[f.way]; if (!f.go && st.act && f.t0 === S.t && !f.lift) empty++; } if (m.town.npcs[f.i].route && !folkFree(m, f.x, f.y, folkR(f))) off++;
          for (const o of F) if (o.i > f.i) close = Math.min(close, Math.hypot(o.x - f.x, (o.y - f.y) * 1.4) / (folkR(o) + folkR(f))); } }
      for (const f of F) { const n = m.town.npcs[f.i]; if (n.route && stops[f.i].size < n.route.length) out.push(`folk ${sd}: the ${f.role} reaches ${stops[f.i].size} of ${n.route.length} stops in two minutes`); }
      if (close < 0.8) out.push(`folk ${sd}: two townsfolk pass through each other (${close.toFixed(2)} of their radii)`);
      if (off) out.push(`folk ${sd}: a walker steps off the open floor ${off} times`);
      if (loads.size < 2) out.push(`folk ${sd}: the porter never lifts or sets down his crate`);
      // TASKS 1031: the porter's first round as every other: the crate taken up first and within his first leg, every set-down after
      // a pick-up, no stop of his reached with nothing to do there; no walker stands blocked long enough to give up a stop
      if (!lifts.length || lifts[0].k !== 'take' || lifts[0].t > 15) out.push(`folk ${sd}: the porter's first round does not start with the pick-up (${lifts[0] ? lifts[0].k + ' at ' + lifts[0].t.toFixed(1) + ' s' : 'none'})`);
      if (lifts.some((q, j) => j && q.k === lifts[j - 1].k)) out.push(`folk ${sd}: the porter lifts or sets down twice running: a crate out of nowhere`);
      if (empty) out.push(`folk ${sd}: the porter comes to a pick-up or a set-down with nothing to do ${empty} times`);
      for (const f of F) if (stuck[f.i] > 2) out.push(`folk ${sd}: the ${f.role} stands blocked ${stuck[f.i].toFixed(1)} s`);
      // TASKS 1032: the hens walk about, come to the child's grain and scatter from the hero
      const hens = F.filter((f) => f.role === 'hen');
      for (const f of hens) if (henWalk[f.i] < 40) out.push(`folk ${sd}: a hen walks ${henWalk[f.i].toFixed(0)} px in two minutes`);
      if (!fed) out.push(`folk ${sd}: no hen comes to the child's grain`);
      { const q = hens[0], R0 = q.x; h.x = q.x - 40; h.y = q.y; for (let i = 0; i < 60; i++) step(S, { keys: [] }); if (q.x - R0 < 15) out.push(`folk ${sd}: a hen does not scatter from the hero`); h.x = m.town.svc.bin.x + TILE; h.y = m.town.svc.bin.y; }
      if (rings < 40) out.push(`folk ${sd}: the anvil rings ${rings} times in two minutes`);
      const smith = F.find((f) => f.role === 'smith'); h.x = smith.x - 50; h.y = smith.y + 10; const t0 = S.t; step(S, { keys: [] });
      if (smith.sayT !== t0 + DT && smith.sayT !== S.t || !S.ev.some((e) => e.k === 'say' && e.role === 'smith')) out.push(`folk ${sd}: the smith says nothing to the hero beside him`);
      if (smith.face !== -1) out.push(`folk ${sd}: the smith does not turn to the hero`);
      const P = F.find((f) => f.role === 'porter'); for (let i = 0; i < 2400 && !(P.go && P.spd > 20); i++) step(S, { keys: [] });
      h.x = P.x + 40; h.y = P.y; for (let i = 0; i < 120; i++) step(S, { keys: [] }); const px = P.x; for (let i = 0; i < 120; i++) step(S, { keys: [] });
      if (!P.near || Math.abs(P.x - px) > 0.5 || P.face !== 1) out.push(`folk ${sd}: the porter walks on past the hero who speaks to him`); }
    return out;
  }
  // TASKS 1007, 1008, 1027: in a run through the town every floor has its stairs up in the start room, reachable from the spawn
  // (and a run that is not through the town has none); a floor left and come back to is as it was left (a kill, an open chest, loot
  // on the floor, the explored cells), the floor above is reached at the foot of its stairs down and the town from the 1st at its
  // gate; a scroll read through takes the hero home and the town's portal back to the very spot, then closes; a step breaks the
  // reading off and keeps the scroll; it is not read in the town; the save stays small and a saved run comes back on a kept floor
  function climbCheck() {
    const out = [], E = (S) => { if (S.run) S.run.enteredT = -9; step(S, { keys: ['KeyE'] }); };
    // the steps are where a hero coming down arrives: on floor reached from the start with the caches and locked doors shut (PR 30: seed 1's 7th put them in a cache)
    for (const sd of [1, 4, 5, 7, 17, 32, 39]) for (let f = 1; f <= 16; f++) { const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd, town: 1 }); if (!m.up) continue;
      const W = m.W, shut = new Set(m.doors.filter((d) => d.lock >= 0).flatMap((d) => d.cells.map(([x, y]) => y * W + x))), r = m.rooms[m.start], open = new Uint8Array(W * m.H), go = [r.cy * W + r.cx]; open[go[0]] = 1;
      while (go.length) { const k = go.pop(); for (const d of [1, -1, W, -W]) { const n = k + d; if (!open[n] && (m.cells[n] === 1 || m.cells[n] === 5) && !shut.has(n)) { open[n] = 1; go.push(n); } } }
      if (!open[(m.up.ty + (m.up.free ? 0 : 1)) * W + m.up.tx]) out.push(`climb ${sd}/${f}: the stairs up are cut off from the start`); }
    for (const sd of [5, 17]) for (let f = 1; f <= 12; f++) { const m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd, town: 1 });
      if (!m.up) { out.push(`climb ${sd}/${f}: no stairs up`); continue; } const k = (m.up.ty + (m.up.free ? 0 : 1)) * m.W + m.up.tx, s0 = Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE);
      if (!m.up.free && [-1, 0, 1].some((i) => m.cells[m.up.ty * m.W + m.up.tx + i] !== 0)) out.push(`climb ${sd}/${f}: the stairs up are not in solid wall`);
      if (!m.up.free && (m.doors || []).some((d) => d.cells.some(([x, y]) => Math.abs(x - m.up.tx) < 3 && Math.abs(y - m.up.ty) < 3))) out.push(`climb ${sd}/${f}: a door beside the stairs up`);
      if (!m.up.free && f <= 8 && m.up.ty + 1 !== m.rooms[m.start].y && !m.rooms[m.start].wings) out.push(`climb ${sd}/${f}: the stairs up are not in the start room's top wall`);
      if (m.cells[k] !== 1 || m.walk[k] < 0 || Math.abs(m.walk[k] - m.walk[s0]) > 12) out.push(`climb ${sd}/${f}: the stairs up are off the floor or far from the spawn`);
      if (m.chests.some((c) => Math.hypot(c.x - m.up.x, c.y - m.up.y - 30) < 60)) out.push(`climb ${sd}/${f}: a chest by the stairs up takes the hero's E`);
      if (f === 3 && DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode: 'campaign', runSeed: sd }).up) out.push('climb: stairs up in a run not through the town'); }
    const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, at = (p, dy = 0) => { h.x = p.x; h.y = p.y + dy; };
    at(R.map.exit); E(S); if (R.floor !== 1) { out.push('climb: the crypt stairs do not lead down'); return out; }
    for (const e of R.en) { e.st = 'idle'; e.x += 5000; e.hx = e.x; }
    const e0 = R.en[0]; e0.hp = 0; e0.deadT = S.t; const c0 = R.chests[0]; c0.open = 1; R.seen[7] = 1; R.drops.push({ kind: 'gold', x: h.x, y: h.y, n: 77, id: R.nextId++ });
    at(R.map.exit); E(S); if (R.floor !== 2) { out.push('climb: no way down from the 1st'); return out; }
    if (Math.hypot(h.x - R.map.up.x, h.y - R.map.up.y) > 90) out.push('climb: down the stairs, the hero is not at the stairs up');
    at(R.map.up, 30); { const f0 = R.floor; R.enteredT = S.t; step(S, { keys: ['KeyE'] }); if (R.floor !== f0) out.push('climb: a tap of E right after arriving goes back up'); } E(S); if (R.floor !== 1) { out.push('climb: the stairs up do not lead to the floor above'); return out; }
    if (Math.hypot(h.x - R.map.exit.x, h.y - R.map.exit.y) > 80) out.push('climb: back up, the hero is not at the foot of the stairs down');
    const e1 = R.en.find((q) => q.id === e0.id), c1 = R.chests.find((q) => q.x === c0.x && q.y === c0.y);
    if (!e1 || e1.deadT < 0 || !c1 || !c1.open || R.seen[7] !== 1 || !R.drops.some((q) => q.kind === 'gold' && q.n === 77)) out.push('climb: the floor above is not as it was left');
    const T = spawn(1, JSON.parse(JSON.stringify(persist(S)))); T.run = T.saved; T.saved = null; T.screen = 'play'; at.call(null, T.run.map.exit);
    { const Q = T.run; Q.hero.x = Q.map.exit.x; Q.hero.y = Q.map.exit.y; E(T); Q.hero.x = Q.map.up.x; Q.hero.y = Q.map.up.y + 30; E(T); if (Q.floor !== 1 || !Q.en.find((q) => q.id === e0.id && q.deadT >= 0)) out.push('climb: a kept floor is lost in a saved run'); }
    h.bag[6] = { b: 'scroll', n: 2, id: R.nextId++ }; const px = h.x, py = h.y; step(S, { keys: [], click: 1, px: -999, py: -999 });
    h.read = { t0: S.t, i: 6 }; for (let i = 0; i < 30; i++) step(S, { right: 1, keys: [] }); if (h.read || h.bag[6].n !== 2) out.push('climb: walking does not break off the reading or the scroll is spent');
    h.read = { t0: S.t, i: 6 }; for (let i = 0; i < 240 && R.floor; i++) step(S, { keys: [] });
    if (R.floor !== 0 || !R.portal || R.portal.f !== 1 || h.bag[6].n !== 1) { out.push('climb: a scroll read through does not take the hero home'); return out; } void px; void py;
    const shelf0 = R.shop.goods.map((g) => g.it.id).join(), qx = R.portal.x, qy = R.portal.y; useItemCheck(S, R, 6, out);
    at(R.map.town.svc.portal, 30); E(S); if (R.floor !== 1 || R.portal || Math.hypot(h.x - qx, h.y - qy) > 2) out.push(`climb: the town's portal does not lead back to the spot (and close): floor ${R.floor}, ${Math.round(h.x - qx)},${Math.round(h.y - qy)}`);
    at(R.map.up, 30); E(S); if (R.floor !== 0 || !R.town || Math.hypot(h.x - R.map.exit.x, h.y - R.map.exit.y) > 80) out.push('climb: the 1st floor\'s stairs up do not lead to the town\'s gate');
    if (R.shop.goods.map((g) => g.it.id).join() !== shelf0) out.push('climb: the town shelf is re-rolled on a return with no deeper floor reached');
    const size = JSON.stringify(persist(S)).length; if (size > 120000) out.push(`climb: a run with two kept floors saves ${size} bytes`);
    // a floor kept by an older generator (a save from before R-18): its diff points past the monsters built now; the floor is built
    // anew with as many dead as died there, and stays so when left again
    // (two left of its own, ids M.id+2 and M.id+4: three bodies (ids M.id+0, 1, 3) cleared away and the first of the two lying dead: four; a hunt in hand there)
    { const M = R.memo[1]; delete M.gv; M.d = { p: { en: { n: 3, p: { 0: { p: { id: { v: M.id + 2 }, deadT: { v: 5 }, hp: { v: 0 } } }, 1: { p: { id: { v: M.id + 4 } } }, 2: { p: { id: { v: 99999 }, summ: { v: 7 } } }, 999: { p: { hp: { v: 1 } } } } } } };
      const q = newQuest(R, 'named', 1); (R.quests = R.quests || []).push(q); q.placed = 1;
      const dead = () => R.en.filter((e) => e.deadT >= 0).length, hunt = () => R.en.filter((e) => e.quest === q.id && e.deadT < 0).length;
      try { enterFloor(S, R, 1, undefined, 'up'); if (M.gv !== D.GEN_VERSION || dead() !== 4) out.push(`memo: an old generator's floor is not built anew with its dead, the cleared bodies too (${dead()}, not 4)`);
        if (hunt() !== 1) out.push('memo: a hunt in hand on an old generator\'s floor gets no quarry anew');
        enterFloor(S, R, 0, undefined, 'up'); enterFloor(S, R, 1); if (dead() !== 4 || hunt() !== 1) out.push('memo: an old generator\'s floor brings its dead back or loses its quarry once left again'); }
      catch (err) { out.push('memo: an old generator\'s floor fails to load: ' + err.message); }
      R.quests = R.quests.filter((o) => o !== q); }
    // an almost cleared old floor (more dead than the floor built now holds) still keeps a quarry for a hunt in hand
    { enterFloor(S, R, 0, undefined, 'up'); const M = R.memo[1]; delete M.gv; M.d = { p: { en: { n: 1, p: { 0: { p: { id: { v: M.id + 999 } } } } } } };
      const q = newQuest(R, 'named', 1); R.quests.push(q); q.placed = 1;
      try { enterFloor(S, R, 1); const live = R.en.filter((e) => e.deadT < 0 && !D.BOSSES[e.type]);
        if (live.length !== 1 || live[0].quest !== q.id) out.push(`memo: an almost cleared old floor leaves a hunt no quarry (${live.length} alive)`); }
      catch (err) { out.push('memo: an almost cleared old floor fails to load: ' + err.message); }
      R.quests = R.quests.filter((o) => o !== q); }
    // TASKS 383: a chapter boss falls and leaves the town's portal in its hall, clear of the stairs; it takes the hero home, the
    // town's portal brings him back beside it, and the stairs lead on
    for (const f of [2, 4, 6, 8]) { const T2 = spawn(0, {}); T2.run = newRun(T2, 'campaign', 31 + f, { town: 1, allFree: 1 }); T2.screen = 'play'; const Q = T2.run, hq = Q.hero; enterFloor(T2, Q, f);
      const b = Q.en.find((e) => D.BOSSES[e.type]); if (!b) { out.push(`gate f${f}: no boss`); continue; }
      Q.arena = { active: 1, room: b.room, t0: T2.t }; b.hp = 0; killEnemy(T2, Q, b); Q.en = Q.en.filter((e) => e === b); for (let i = 0; i < 200 && (Q.freeze > 0 || Q.inbuf); i++) step(T2, { keys: [] }); const g = Q.arena && Q.arena.gate;
      if (!g) { out.push(`gate f${f}: no portal home after the boss`); continue; }
      // (TASKS 1037) the ring's gap opens on floor a body can walk from the disc out past the stones
      for (let d = 0; d <= 2.6 * TILE; d += 8) if (boxHit(Q.map, g.x + Math.cos(g.open) * d, g.y + Math.sin(g.open) * d, K.R, false, false)) { out.push(`gate f${f}: the ring's gap is walled at ${d} px`); break; }
      if (Math.hypot(g.x - Q.map.exit.x, g.y - Q.map.exit.y) < 100) out.push(`gate f${f}: the portal stands by the stairs`);
      hq.x = g.x; hq.y = g.y + 30; E(T2); if (Q.floor !== 0 || !Q.portal || Q.portal.f !== f) { out.push(`gate f${f}: the portal does not take the hero home`); continue; }
      hq.x = Q.map.town.svc.portal.x; hq.y = Q.map.town.svc.portal.y + 30; E(T2);
      if (Q.floor !== f || Math.hypot(hq.x - g.x, hq.y - g.y) > 90 || !Q.arena || !Q.arena.gate) { out.push(`gate f${f}: the town's portal does not lead back beside the boss's`); continue; }
      hq.x = Q.map.exit.x; hq.y = Q.map.exit.y; E(T2); if (Q.leaving > 0) { Q.leaving = 0; SIMX.enterFloor(T2, Q, Q.floor + 1); } if (Q.floor !== f + 1) out.push(`gate f${f}: the stairs do not lead on after the portal`); }
    // past the colossus (TASKS 514): its hall keeps the town's portal and one stairs down; down them, back up from the descent's
    // 17th, the 16th is the campaign's again (PR 19 review: the descent's bag has no round before its first floor), the hero by the
    // stairs on, still one way down (its portal out no second stairs) and the portal home, and the stairs on take him to the 17th
    // with no second win
    try { const F = D.RUNS.campaign.floors, S2 = spawn(0, {}); S2.run = newRun(S2, 'campaign', 1, { town: 1, allFree: 1 }); S2.screen = 'play'; const R2 = S2.run, h2 = R2.hero; enterFloor(S2, R2, F);
      const b = R2.en.find((e) => e.type === 'boss_colossus'); R2.arena = { active: 1, room: b.room, t0: S2.t }; b.hp = 0; killEnemy(S2, R2, b); R2.en = R2.en.filter((e) => e === b);
      // (TASKS 515: no way out to the surface there, before the colossus falls or after: the run ends in the town)
      if (exitKind(R2) !== null) out.push('climb: the campaign\'s last floor of a run through the town has a way out'); else { h2.x = R2.map.exit.x; h2.y = R2.map.exit.y; E(S2); if (!S2.run || R2.floor !== F) out.push('climb: E at the last floor\'s old way out ends the run or leaves the floor'); }
      if (!R2.arena || !R2.arena.gate) out.push('climb: the colossus leaves no portal home');
      else if (R2.map.down && Math.hypot(R2.arena.gate.x - R2.map.down.x, R2.arena.gate.y - R2.map.down.y) < 100) out.push('climb: the colossus\'s portal home stands by the stairs on');
      // (PR 29 review) a run saved with the colossus slain before it left a portal, its body cleared away: the portal is set on load
      // and when the floor is entered again
      { const keep = R2.arena.gate, en = R2.en; delete R2.arena.gate; R2.en = []; const T3 = spawn(1, JSON.parse(JSON.stringify(persist(S2))));
        if (!T3.saved || !T3.saved.arena || !T3.saved.arena.gate) out.push('climb: a save with the colossus slain and no portal home gets none on load');
        delete R2.arena.gate; enterFloor(S2, R2, F - 1, undefined, 'up'); enterFloor(S2, R2, F); if (!R2.arena || !R2.arena.gate) out.push('climb: the colossus\'s floor kept with no portal home gets none when entered again');
        delete R2.arena.gate; enterFloor(S2, R2, 0); enterFloor(S2, R2, F); if (!R2.arena || !R2.arena.gate) out.push('climb: the colossus\'s floor kept with no portal home gets none when entered from the town');
        void keep; void en; }
      descend(S2, R2); const w0 = S2.meta.wins, s0 = S2.meta.shards;
      if (R2.floor !== F + 1 || R2.mode !== 'endless') out.push(`climb: the descent past the colossus does not start on the ${F + 1}th`);
      else { h2.x = R2.map.up.x; h2.y = R2.map.up.y + 30; E(S2); for (let i = 0; i < 60; i++) step(S2, { keys: [] }); const m2 = R2.map;
        if (R2.floor !== F || STAGE(R2).boss !== 'boss_colossus' || D.placeName(F, R2.mode, R2.seed, FROM(R2)) !== D.placeName(F, 'campaign', R2.seed)) out.push(`climb: back up from the ${F + 1}th, the ${F}th is not the campaign's`);
        else if (!m2.down || exitKind(R2) === 'stairs' || !R2.arena || !R2.arena.gate) out.push(`climb: back up on the ${F}th, not one stairs down and the portal home`);
        else { if (Math.hypot(h2.x - m2.down.x, h2.y - m2.down.y) > 80) out.push(`climb: back up on the ${F}th, the hero is not by the stairs on`);
          h2.x = R2.arena.gate.x; h2.y = R2.arena.gate.y + 30; E(S2); if (R2.floor !== 0) out.push(`climb: the ${F}th's portal home does not take the hero home after the descent`);
          else { h2.x = R2.map.town.svc.portal.x; h2.y = R2.map.town.svc.portal.y + 30; E(S2); if (R2.floor !== F) out.push(`climb: the town's portal does not lead back to the ${F}th`); }
          h2.x = m2.down.x; h2.y = m2.down.y + 20; E(S2); if (R2.floor !== F + 1 || S2.meta.wins !== w0 || S2.meta.shards !== s0) out.push(`climb: the ${F}th's stairs on, taken again, do not lead to the ${F + 1}th or win the campaign twice`); } } }
    catch (err) { out.push('climb: back up from the descent fails: ' + err.stack); }
    return out;
  }
  // TASKS 1009: in a run through the town a waystone stands by the start of every D.wayFloor, reachable and clear of the stairs
  // up (and nowhere else, nor in a run not through the town); touched, it wakes; the town's ring of stones then takes the hero to
  // it at once, or, with a portal open too, offers both in a window; the portal stays open when a waystone is taken
  function wayCheck() {
    const out = [], E = (S) => { if (S.run) S.run.enteredT = -9; step(S, { keys: ['KeyE'] }); };
    for (const sd of [5, 17]) for (let f = 1; f <= 16; f++) { const mode = f > D.RUNS.campaign.floors ? 'endless' : 'campaign', m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode, runSeed: sd, town: 1 });
      if (!!m.way !== D.wayFloor(f)) { out.push(`way ${sd}/${f}: ${m.way ? 'a waystone off its floors' : 'no waystone'}`); continue; } if (!m.way) continue;
      const k = m.way.ty * m.W + m.way.tx, s0 = Math.floor(m.spawn.y / TILE) * m.W + Math.floor(m.spawn.x / TILE);
      if (m.cells[k] !== 1 || m.walk[k] < 0 || Math.abs(m.walk[k] - m.walk[s0]) > 12) out.push(`way ${sd}/${f}: the waystone is off the floor or far from the spawn`);
      if (m.up && Math.max(Math.abs(m.up.tx - m.way.tx), Math.abs(m.up.ty - m.way.ty)) < 3) out.push(`way ${sd}/${f}: the waystone stands on the stairs up`);
      if (f === 4 && DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode, runSeed: sd }).way) out.push('way: a waystone in a run not through the town'); }
    if (!D.wayFloor(4)) return out;
    const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, at = (p, dy = 0) => { h.x = p.x; h.y = p.y + dy; };
    for (let f = 1; f <= 4; f++) enterFloor(S, R, f);
    for (const e of R.en) { e.st = 'idle'; e.x += 5000; e.hx = e.x; }
    for (let i = 0; i < 4; i++) step(S, { keys: [] }); if ((R.ways || []).length) out.push('way: the waystone wakes untouched');
    at(R.map.way, 44); step(S, { keys: [] }); if ((R.ways || []).join() !== '4' || !S.ev.some((e) => e.k === 'waystone')) { out.push('way: a touched waystone does not wake'); return out; }
    R.portal = { f: 4, x: R.map.spawn.x, y: R.map.spawn.y }; enterFloor(S, R, 0, undefined, 'portal');
    at(R.map.town.svc.portal, 30); E(S); if (S.screen !== 'gate') { out.push('way: the ring with a portal and a waystone opens no choice'); return out; }
    const b = UI.gate(2).r[1]; step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 });
    if (R.floor !== 4 || S.screen !== 'play' || !R.portal || Math.hypot(h.x - R.map.way.x, h.y - R.map.way.y) > 90) out.push(`way: the gate does not take the hero to the waystone (floor ${R.floor}, ${S.screen})`);
    R.portal = null; enterFloor(S, R, 0, undefined, 'portal'); at(R.map.town.svc.portal, 30); E(S); if (R.floor !== 4 || S.screen !== 'play') out.push('way: with one waystone and no portal the ring does not take the hero there');
    R.ways = []; enterFloor(S, R, 0, undefined, 'portal'); at(R.map.town.svc.portal, 30); E(S); if (R.floor !== 0 || S.screen !== 'play') out.push('way: the ring does something with no way out');
    return out;
  }
  // TASKS 1010: in a run through the town the merchant is on a floor only where D.wanderAt says, and there with gear from deeper
  // down and a better showpiece; the town's shelf is stocked as the town's (more potions and scrolls), kept while no boss falls,
  // restocked for the deepest floor after one does; in the town the merchant pays by the deepest floor reached
  function shopTownCheck() {
    const out = [];
    for (const sd of [5, 17, 29]) for (let f = 1; f <= 14; f++) { const mode = f > D.RUNS.campaign.floors ? 'endless' : 'campaign', m = DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode, runSeed: sd, town: 1 });
      if (!!m.shop !== D.wanderAt(sd, f) || !!m.wander !== !!m.shop) out.push(`shop ${sd}/${f}: the merchant ${m.shop ? 'stands where he should not' : 'is missing'}`);
      if (!m.shop && m.rooms.some((r) => r.type === 'shop')) out.push(`shop ${sd}/${f}: a merchant's room with no merchant`);
      if (f === 3 && !DG.genFloor((sd * 31 + f * 1013) >>> 0, f, { mode, runSeed: sd }).shop) out.push('shop: no merchant on a floor of a run not through the town'); }
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 7), lv = (sh) => sh.goods.filter((g) => BASES[g.it.b]).reduce((a, g) => a + g.it.lvl, 0) / sh.goods.filter((g) => BASES[g.it.b]).length;
      let a = 0, b = 0, ra = 0, rb = 0; for (let i = 0; i < 30; i++) { const n = stockShop(R, 5), w = stockShop(R, 5, 'wander'); a += lv(n); b += lv(w); ra += n.goods[0].it.rar; rb += w.goods[0].it.rar; }
      if (b <= a + 1 || rb <= ra) out.push(`shop: the wandering merchant's gear is no better (level ${(a / 30).toFixed(1)} → ${(b / 30).toFixed(1)}, showpiece ${(ra / 30).toFixed(1)} → ${(rb / 30).toFixed(1)})`); }
    const S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, n = (b) => (R.shop.goods.find((g) => g.it.b === b) || {}).n || 0;
    if (n('hp_potion') < 3 || n('scroll') < 2) out.push('shop: the town shelf is not the town\'s');
    const sh0 = R.shop.goods.map((g) => g.it.id).join();
    for (let f = 1; f <= 6; f++) enterFloor(S, R, f); enterFloor(S, R, 0, undefined, 'up');
    if (R.shop.goods.map((g) => g.it.id).join() !== sh0) out.push('shop: the town shelf is restocked with no boss slain');
    if (D.sellPrice({ b: 'hp_potion' }, tradeDepth(R)) <= D.sellPrice({ b: 'hp_potion' }, dep(R, 1))) out.push('shop: in the town the merchant pays by the 1st floor, not the deepest');
    { const hp = R.shop.goods.find((g) => g.n && g.it.b === 'hp_potion'); R.shop.goods = R.shop.goods.filter((g) => g !== hp); R.deepest = 7; enterFloor(S, R, 1); enterFloor(S, R, 0, undefined, 'up');
      const nw = R.shop.goods.find((g) => g.n && g.it.b === 'hp_potion'); if (!nw || nw.n !== D.SHOP.townCons(dep(R, 7))[0][1] || R.shop.at !== 7) out.push('shop: a deeper floor reached does not top the town shelf\'s potions up');
      R.deepest = 6; R.shop.at = 6; }
    R.bossN = 2; enterFloor(S, R, 1); enterFloor(S, R, 0, undefined, 'up');
    if (R.shop.goods.map((g) => g.it.id).join() === sh0 || R.shop.at !== 6 || R.shop.boss !== 2) out.push(`shop: a boss slain does not restock the town shelf for the deepest floor (${R.shop.at}, ${R.shop.boss})`);
    return out;
  }
  // TASKS 1011: E at the town's Altar of Souls opens the meta upgrades mid-run; a rank bought there is paid from the bank and
  // reaches the hero at once (health), E or Esc goes back to the town, not the menu; from the menu the screen still goes back to it
  function soulAltarCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, A = R.map.town.svc.altar;
    h.x = A.x; h.y = A.y + 40; step(S, { keys: ['KeyE'] }); if (S.screen !== 'meta') { out.push('altar: E at the town\'s Altar of Souls does not open the upgrades'); return out; }
    S.meta.shards = 1000; const hp0 = heroSt(S).maxHp, b = UI.meta().find((q) => q.id === 'hp'); step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 });
    if ((S.meta.up.hp || 0) !== 1 || S.meta.shards >= 1000 || heroSt(S).maxHp <= hp0) out.push('altar: a rank bought in the town is not paid or does not reach the hero');
    step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); if (S.screen !== 'play' || S.run !== R) out.push('altar: E does not take the hero back to the town');
    h.x = A.x + 400; step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); if (S.screen === 'meta') out.push('altar: the upgrades open far from the altar');
    const M = spawn(0, {}); M.screen = 'meta'; step(M, { keys: ['Escape'] }); if (M.screen !== 'menu') out.push('altar: the menu\'s Altar of Souls does not go back to the menu');
    return out;
  }
  // TASKS 1012: E at the storage chest opens it (and at the altar beside it still the altar); a click lays gear in, not a potion;
  // one cell till «Сундук предков» adds more; a drag lands on the cell under the pointer; the stash outlives the run and the save,
  // the next hero takes the piece with an id of his own; a stash from an older item balance is re-powered
  function stashCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, sv = R.map.town.svc, U = UI.stash();
    const at = (id, o = {}) => { const b = U.r.find((q) => q.id === id); return Object.assign({ keys: [], px: b.x + 10, py: b.y + 10 }, o); };
    const clickOn = (id) => { step(S, at(id, { click: 1 })); step(S, at(id)); };
    h.x = sv.altar.x; h.y = sv.altar.y + 40; step(S, { keys: ['KeyE'] }); if (S.screen !== 'meta') out.push('stash: the altar beside the chest no longer answers'); S.screen = 'play';
    h.x = sv.stash.x; h.y = sv.stash.y + 40; step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); if (S.screen !== 'stash') { out.push('stash: E at the chest does not open it'); return out; }
    const g1 = rollItem(R, 6, 2), g2 = rollItem(R, 6, 2); g1.id = R.nextId++; g2.id = R.nextId++; h.bag[3] = g1; h.bag[4] = g2;
    { const p = h.bag[0]; clickOn('bag:0'); if (h.bag[0] || S.meta.stash.items[0] !== p) out.push('stash: a potion does not go into the chest'); clickOn('stash:0'); if (S.meta.stash.items[0]) out.push('stash: a potion does not come back out'); }
    if (D.STASH.cells !== 24) out.push('stash: the chest is not 24 cells');
    clickOn('bag:3'); if (h.bag[3] || S.meta.stash.items[0] !== g1) out.push('stash: a click does not lay gear in');
    step(S, at('bag:4', { click: 1, press: 1 })); step(S, at('stash:1', { press: 1 })); step(S, at('stash:1'));
    if (h.bag[4] || S.meta.stash.items[1] !== g2) out.push('stash: a drag does not land on the cell under the pointer');
    step(S, at('stash:0', { click: 1, press: 1 })); step(S, at('bag:9', { press: 1 })); step(S, at('bag:9'));
    if (h.bag[9] !== g1 || S.meta.stash.items[0]) out.push('stash: a drag out does not land on the bag cell under the pointer');
    clickOn('bag:9'); step(S, { keys: ['Escape'] }); if (S.screen !== 'play') out.push('stash: Esc does not close the chest');
    const P = JSON.parse(JSON.stringify(persist(S))), T = spawn(1, P); if (JSON.stringify(P.meta.stash).length > 4000) out.push('stash: the chest bloats the save');
    T.meta.stash.v = 0; T.run = newRun(T, 'campaign', 78, { town: 1, allFree: 1 }); T.screen = 'play'; const Q = T.run; Q.hero.x = sv.stash.x; Q.hero.y = sv.stash.y + 40; step(T, { keys: [] }); step(T, { keys: ['KeyE'] });
    if (T.meta.stash.v !== D.ITEM_BAL.version || T.meta.stash.items.filter(Boolean).length !== 2) out.push('stash: the chest does not outlive the run or is not brought to the item balance');
    const b0 = U.r.find((q) => q.id === 'stash:0'); step(T, { keys: [], click: 1, px: b0.x + 10, py: b0.y + 10 }); step(T, { keys: [], px: b0.x + 10, py: b0.y + 10 });
    const got = Q.hero.bag.find((it) => it && it.b === g1.b && it.lvl === g1.lvl && !isCons(it)); if (!got || got.id < Q.nextId - 1 || T.meta.stash.items[0]) out.push('stash: the next hero does not take the piece out with an id of his own');
    return out;
  }
  // TASKS 1331, 1671: the bag is 24 cells with no altar upgrade, a hero from a save that had the 12-cell cap fills them all; a drag moves a piece
  // between cells, a click on the piece's own cell still uses it; the sort buttons order the cells and pack them to the front; the chest sorts too
  // TASKS 1349: ranks stop at AB_MAX, the points past every full rank turn into mastery and leave nothing in h.sp, a hero with a rank to
  // buy keeps his points, a save without the field loads as no mastery, and the rank-15 numbers stay sane
  function masteryCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 88); S.screen = 'inv'; const R = S.run, h = R.hero, abs = D.clsOf(h).abs, U = UI.inv(abs);
    const click = (id) => { const b = U.r.find((q) => q.id === id); for (const o of [{ click: 1 }, {}]) step(S, Object.assign({ keys: [], px: b.x + 10, py: b.y + 10 }, o)); };
    if (D.AB_MAX !== 15) out.push('mastery: the rank ceiling is not 15');
    h.lvl = 60; h.forks = {}; for (const a of abs) for (const r of D.FORK_RANKS) h.forks[D.forkKey(a.id, r)] = 0; const A = abs[0]; h.ab[A.id] = D.AB_MAX; h.sp = 1; click('ab:' + A.id); if (h.ab[A.id] !== D.AB_MAX) out.push('mastery: a rank went past the ceiling');
    if (h.sp !== 1 || h.mast) out.push('mastery: a point was taken while other ranks are open');
    for (const a of abs) h.ab[a.id] = D.AB_MAX; const st0 = stats(h, S.meta); h.ab[abs[2].id] = D.AB_MAX - 1; h.sp = 2; click('ab:' + abs[2].id);
    if (h.ab[abs[2].id] !== D.AB_MAX || h.sp !== 0 || h.mast !== 1) out.push(`mastery: the last rank left sp ${h.sp}, mastery ${h.mast}`);
    h.sp = 0; SIMX.gainXp(S, R, D.xpNeed(h.lvl) / 0.5); if (h.sp !== 0 || !(h.mast > 1)) out.push(`mastery: a level past the ceiling left sp ${h.sp}, mastery ${h.mast}`);
    h.mast = 40; h.lvl = 60; const st = stats(h, S.meta), lim = 1.21;
    if (!(st.atk > st0.atk) || !(st.maxHp > st0.maxHp) || st.atk > st0.atk * lim + 1 || st.maxHp > st0.maxHp * lim + 1) out.push(`mastery: 40 points turn atk ${st0.atk} into ${st.atk}, hp ${st0.maxHp} into ${st.maxHp}`);
    const old = JSON.parse(JSON.stringify(R)); delete old.hero.mast; old.hero.ab = Object.fromEntries(abs.map((a) => [a.id, 10])); old.hero.sp = 3;
    const T = spawn(1, JSON.parse(JSON.stringify(persist(Object.assign(spawn(0, {}), { run: old })))));
    if (!T.saved || T.saved.hero.sp !== 3 || T.saved.hero.mast) out.push('mastery: an old save at the old ceiling lost its points or gained mastery');
    for (const id of ['whirl', 'frost', 'cry', 'fireball', 'shield', 'volley']) { const a = D.abRank(id, 10), b = D.abRank(id, 15); if (!(b.cd >= 0.5) || b.cd > a.cd || (id !== 'cry' && !(b.k > a.k)) || (a.r && b.r !== a.r)) out.push(`mastery: ${id} at rank 15 is off`); }
    { const a = D.abRank('cry', 15); if (!(a.t < D.ABILITIES.find((q) => q.id === 'cry').cd * a.cd)) out.push('mastery: the cry at rank 15 outlasts its cooldown'); }
    return out;
  }
  // TASKS 1687: pouches bought at the Altar of souls, each a tab of its own: the buy, the bag grown in the run at once, a save and a
  // load, a tab's sort, a drag onto a tab (from the bag, from the worn gear, from the chest), a full tab refusing, the 1340 migration
  function pouchCheck() {
    const out = [], S = spawn(0, { meta: { shards: 1000, up: {} } }); S.run = newRun(S, 'campaign', 79); const R = S.run, h = R.hero, nopes = () => S.ev.filter((e) => e.k === 'nope').length;
    const cl = (rs, id, o = {}) => { const b = rs.find((q) => q.id === id); if (!b) { out.push('pouch: no ' + id + ' on ' + S.screen); return; } step(S, Object.assign({ keys: [], px: b.x + 10, py: b.y + 10, click: 1 }, o)); step(S, { keys: [], px: b.x + 10, py: b.y + 10 }); };
    const inv = () => UI.inv(D.clsOf(h).abs, h.bag.length, S.bagTab), drag = (from, to) => { const a = inv().r.find((q) => q.id === from), b = inv().r.find((q) => q.id === to); if (!a || !b) { out.push(`pouch: no ${from} or ${to}`); return; }
      step(S, { keys: [], px: a.x + 10, py: a.y + 10, click: 1, press: 1 }); step(S, { keys: [], px: b.x + 10, py: b.y + 10, press: 1 }); step(S, { keys: [], px: b.x + 10, py: b.y + 10 }); };
    if (h.bag.length !== 24 || UI.inv(D.clsOf(h).abs, 24, 0).r.filter((q) => q.tab !== undefined).length !== 1) out.push('pouch: a hero without pouches has more than the bag');
    S.screen = 'meta'; cl(UI.meta(S.meta.cls), 'pouch'); cl(UI.meta(S.meta.cls), 'pouch');
    if (S.meta.up.pouch !== 2 || S.meta.shards !== 1000 - D.META.find((m) => m.id === 'pouch').cost(0) - D.META.find((m) => m.id === 'pouch').cost(1)) out.push('pouch: two pouches are not bought at their prices');
    if (h.bag.length !== 24 + 2 * D.BAG.pouch) out.push(`pouch: the hero in the run has ${h.bag.length} cells after two pouches`);
    { let n = 0; h.bag.fill(null); for (let i = 0; i < 80; i++) if (bagAdd(R, Object.assign(rollItem(R, 3, 1), { id: 9000 + i }))) n++; if (n !== h.bag.length) out.push(`pouch: the bag and pouches take ${n} of ${h.bag.length}`); }
    { const it = h.bag[30], T = spawn(1, JSON.parse(JSON.stringify(persist(Object.assign(spawn(0, {}), { meta: S.meta, run: R })))));
      if (!T.saved || T.saved.hero.bag.length !== h.bag.length || !T.saved.hero.bag[30] || T.saved.hero.bag[30].id !== it.id) out.push('pouch: a piece in a pouch is lost over a save and a load'); }
    S.screen = 'inv'; h.bag.fill(null); const mix = [rollItem(R, 2, 1), rollItem(R, 9, 3), rollItem(R, 5, 4)]; mix.forEach((it, i) => { it.id = 9500 + i; h.bag[25 + i * 3] = it; });
    const keep = Object.assign(rollItem(R, 4, 0), { id: 9510 }); h.bag[5] = keep;
    cl(inv().r, 'btab:1'); if (S.bagTab !== 1 || !inv().r.some((q) => q.id === 'bag:24') || inv().r.some((q) => q.id === 'bag:0')) out.push('pouch: a tab does not open its pouch');
    cl(inv().r, 'sort:rar'); { const p = h.bag.slice(24, 40), f = p.filter(Boolean); if (f.length !== 3 || p.slice(3).some(Boolean) || f.some((it, i) => i && (f[i - 1].rar || 0) < (it.rar || 0)) || h.bag[5] !== keep) out.push('pouch: the sort does not order the open pouch alone'); }
    cl(inv().r, 'btab:0'); drag('bag:5', 'btab:2'); if (h.bag[5] || h.bag[40] !== keep) out.push('pouch: a piece dragged onto a tab does not go into that pouch');
    { const w = h.eq.weapon; drag('eq:weapon', 'btab:1'); if (h.eq.weapon || h.bag[27] !== w) out.push('pouch: a worn piece dragged onto a tab does not come off into it'); h.eq.weapon = w; h.bag[27] = null; }
    { for (let i = 40; i < 56; i++) h.bag[i] = h.bag[i] || Object.assign(rollItem(R, 2, 0), { id: 9600 + i }); const it = Object.assign(rollItem(R, 2, 0), { id: 9700 }); h.bag[7] = it; const n0 = nopes(); drag('bag:7', 'btab:2');
      if (h.bag[7] !== it || nopes() !== n0 + 1) out.push('pouch: a full pouch takes a piece or does not refuse it'); }
    // TASKS 1786: a piece dropped on its own pouch's tab stays and says so
    { cl(inv().r, 'btab:2'); const it = h.bag[41], n0 = nopes(); drag('bag:41', 'btab:2'); const e = S.ev.filter((q) => q.k === 'nope').at(-1);
      if (h.bag[41] !== it || nopes() !== n0 + 1 || !e || e.s !== TXT('sim_ui.inv.same')) out.push('pouch: a piece dropped on its own pouch\'s tab is not refused with a word'); cl(inv().r, 'btab:0'); }
    { const V = spawn(0, { meta: { up: { pouch: 1 } } }); V.run = newRun(V, 'campaign', 78, { town: 1 }); V.screen = 'stash'; const Hh = V.run.hero, T2 = stashOf(V), g = Object.assign(rollItem(V.run, 3, 2), { id: V.run.nextId++ });
      T2.items = [g]; const U2 = UI.stash(Hh.bag.length, 0), a = U2.r.find((q) => q.id === 'stash:0'), b = U2.r.find((q) => q.id === 'btab:1');
      step(V, { keys: [], px: a.x + 10, py: a.y + 10, click: 1, press: 1 }); step(V, { keys: [], px: b.x + 10, py: b.y + 10, press: 1 }); step(V, { keys: [], px: b.x + 10, py: b.y + 10 });
      if (T2.items[0] || !Hh.bag.slice(24).some((q) => q && q.b === g.b && q.lvl === g.lvl)) out.push('pouch: a piece dragged from the chest onto a tab does not go into that pouch'); }
    { const old = JSON.parse(JSON.stringify(R)); old.hero.bag = new Array(24).fill(null); old.hero.bag[20] = Object.assign(rollItem(R, 3, 1), { id: 9800 }); old.hero.cap = 15;
      const T = spawn(0, { meta: { shards: 5, up: { bag: 3, hp: 1 } }, run: old });
      if (T.meta.up.pouch !== 2 || T.meta.up.bag !== undefined || T.meta.up.hp !== 1) out.push('pouch: the 1340 bag ranks do not become pouches');
      if (!T.saved || T.saved.hero.bag.length !== 24 + 2 * D.BAG.pouch || !T.saved.hero.bag[20] || T.saved.hero.bag[20].id !== 9800) out.push('pouch: an old save does not get its pouches or loses a piece'); }
    return out;
  }
  function bagCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 77); S.screen = 'inv'; const R = S.run, h = R.hero, U = UI.inv(D.clsOf(h).abs);
    const at = (id, o = {}) => { const b = U.r.find((q) => q.id === id); return Object.assign({ keys: [], px: b.x + 10, py: b.y + 10 }, o); };
    if (D.BAG.start !== 24 || h.bag.length !== 24 || UI.meta(S.meta.cls).some((q) => q.id === 'bag')) out.push('bag: a fresh hero does not have 24 cells, or the altar still sells the bag');
    const had = h.bag.filter(Boolean).length; let added = 0; for (let i = 0; i < 30; i++) if (bagAdd(R, Object.assign(rollItem(R, 3 + (i % 5), i % 4), { id: 5000 + i }))) added++;
    if (h.bag.filter(Boolean).length !== 24 || added !== 24 - had) out.push('bag: the bag takes more or fewer than its 24 cells');
    const A = h.bag[3], B = h.bag[5];
    step(S, at('bag:3', { click: 1, press: 1 })); step(S, at('bag:5', { press: 1 })); step(S, at('bag:5'));
    if (h.bag[3] !== B || h.bag[5] !== A) out.push('bag: a drag does not swap two cells');
    { const w = Object.assign(rollItem(R, 1, 0, 'weapon'), { id: 6000 }); h.bag.fill(null); h.bag[2] = w; const old = h.eq.weapon;
      step(S, at('bag:2', { click: 1, press: 1 })); step(S, at('bag:2')); if (h.eq.weapon !== w || h.bag[2] !== old) out.push('bag: a click on the piece no longer wears it'); }
    { h.bag.fill(null); const e = h.eq.armor; step(S, at('eq:armor', { click: 1, press: 1 })); step(S, at('bag:7', { press: 1 })); step(S, at('bag:7'));
      if (h.eq.armor || h.bag[7] !== e) out.push('bag: a worn piece dragged to a cell does not come off into it'); }
    { const nopes = () => S.ev.filter((e) => e.k === 'nope').length, drag = (from, to, ev0 = {}) => { step(S, at(from, { click: 1, press: 1 })); step(S, at(to, { press: 1 })); step(S, at(to)); };
      h.bag.fill(null); h.eq.ring = null; const pot = potion('hp_potion', 3); pot.id = 6100; h.bag[1] = pot; let n0 = nopes(); drag('bag:1', 'eq:ring');
      if (h.bag[1] !== pot || pot.n !== 3 || h.eq.ring || nopes() !== n0 + 1) out.push('bag: a potion dropped on a worn slot is drunk, worn or goes unrefused');
      const bt = Object.assign(rollItem(R, 1, 0, 'boots'), { id: 6101 }); h.bag[2] = bt; n0 = nopes(); const wp = h.eq.weapon; drag('bag:2', 'eq:weapon');
      if (h.bag[2] !== bt || h.eq.weapon !== wp || nopes() !== n0 + 1) out.push('bag: a piece dropped on another piece\'s slot is worn or goes unrefused');
      const w2 = Object.assign(rollItem(R, 1, 0, 'weapon'), { id: 6102 }); h.bag.fill(null); h.bag[4] = w2; const w1 = h.eq.weapon; drag('eq:weapon', 'bag:4');
      if (h.eq.weapon !== w2 || h.bag[4] !== w1) out.push('bag: a worn piece dropped on a bag piece of its slot does not swap');
      h.bag.fill(null); const pot2 = potion('hp_potion', 2); pot2.id = 6103; h.bag[6] = pot2; n0 = nopes(); const w3 = h.eq.weapon; drag('eq:weapon', 'bag:6');
      if (h.eq.weapon !== w3 || h.bag[6] !== pot2 || pot2.n !== 2 || nopes() !== n0 + 1) out.push('bag: a worn piece dropped on a cell holding another slot\'s piece is not refused whole'); }
    h.bag.fill(null); const mix = [rollItem(R, 2, 1), rollItem(R, 9, 3), rollItem(R, 5, 3), rollItem(R, 7, 0), potion('hp_potion', 3)]; mix.forEach((it, i) => { it.id = 7000 + i; h.bag[i * 2] = it; });
    step(S, at('sort:rar', { click: 1 })); step(S, at('sort:rar'));
    const rs = h.bag.filter(Boolean); if (rs.length !== 5 || h.bag.slice(5).some(Boolean) || rs.some((it, i) => i && (rs[i - 1].rar || 0) < (it.rar || 0))) out.push('bag: the rarity sort does not order the cells or pack them to the front');
    step(S, at('sort:type', { click: 1 })); step(S, at('sort:type')); if (!isCons(h.bag[0])) out.push('bag: the type sort does not put consumables first');
    step(S, at('sort:lvl', { click: 1 })); step(S, at('sort:lvl')); { const ls = h.bag.filter(Boolean); if (ls.some((it, i) => i && (ls[i - 1].lvl || 0) < (it.lvl || 0))) out.push('bag: the level sort does not order the cells'); }
    const old = JSON.parse(JSON.stringify(R)); old.hero.cap = 12; old.hero.bag.fill(null); old.hero.bag[20] = Object.assign(rollItem(R, 3, 1), { id: 8000 });
    const T = spawn(1, JSON.parse(JSON.stringify(persist(Object.assign(spawn(0, {}), { run: old })))));
    if (!T.saved || !T.saved.hero.bag[20] || T.saved.hero.bag.length !== 24) out.push('bag: a run saved with the 12-cell cap loses its cells');
    else { let n = 0; while (n < 30 && bagAdd(T.saved, Object.assign(rollItem(T.saved, 3, 1), { id: 8100 + n }))) n++; if (n !== 23) out.push(`bag: a hero saved with the 12-cell cap fills ${n + 1} of 24 cells`); }
    { const Q = { rs: 71, hero: h, nextId: 1 }; let t1 = 0, t3 = 0, boss = 0; for (let i = 0; i < 400; i++) { const c = SIMX.chestLoot(Object.assign(Q, { floor: 5 }), { tier: 1 }); if (c.some((it) => !isCons(it))) t1++; if (SIMX.chestLoot(Q, { tier: 3 }).some((it) => !isCons(it))) t3++; }
      if (t1 < 40 || t1 > 130 || t3 !== 400) out.push(`chest loot: a plain chest holds gear in ${t1}/400, a top-tier one in ${t3}/400`); }
    const V = spawn(0, {}); V.run = newRun(V, 'campaign', 78, { town: 1 }); V.screen = 'stash'; const Hh = V.run.hero, Us = UI.stash(), T2 = stashOf(V);
    Hh.bag.fill(null); T2.items = [rollItem(V.run, 2, 1), rollItem(V.run, 8, 3), null, rollItem(V.run, 5, 2)]; for (const it of T2.items) if (it) it.id = V.run.nextId++;
    { const b = Us.r.find((q) => q.id === 'sortS:rar'); step(V, { keys: [], px: b.x + 10, py: b.y + 10, click: 1 }); step(V, { keys: [], px: b.x + 10, py: b.y + 10 }); }
    if (T2.items.length !== 3 || T2.items.some((it, i) => !it || (i && (T2.items[i - 1].rar || 0) < (it.rar || 0)))) out.push('bag: the chest sort does not order and pack its pieces');
    return out;
  }
  // TASKS 1013: E at the anvil opens the smith's reforging, at the lectern the enchanter's enchanting; a reforge re-rolls a piece's
  // own affixes for gold (not a common piece's, which has none), keeps its enchantments; the first enchantment never fails and
  // reaches the hero's stats; a failed one takes everything off the piece; a sixth is refused;
  // each is paid in gold and shards
  function craftCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 77, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, sv = R.map.town.svc, U = UI.craft(); noQuests(R);
    const click = (id) => { const b = U.r.find((q) => q.id === id); step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 }); };
    const throughTalk = () => { for (let i = 0; i < 12 && S.screen === 'talk'; i++) step(S, { keys: ['KeyE'] }); };
    h.x = sv.anvil.x; h.y = sv.anvil.y + 30; step(S, { keys: ['KeyE'] }); throughTalk(); if (S.screen !== 'craft' || S.craft.kind !== 'forge') { out.push('craft: E through the smith\'s talk does not open his workshop'); return out; }
    const it = Object.assign(rollItem(R, 6, 2, 'ring'), { id: R.nextId++, rar: 3 }); it.mods = {}; rollAffixes(R, it); h.bag[5] = it; h.gold = 100000;
    click('bag:0'); if (S.craft.sel) out.push('craft: a potion is chosen for the workshop');
    click('bag:5'); const m0 = JSON.stringify(it.mods), g0 = h.gold; it.ench = [{ k: 'str', v: 3 }]; click('do');
    if (h.gold >= g0 || JSON.stringify(it.mods) === m0 || Object.keys(it.mods).length !== RARITY[it.rar].affixes || it.ench.length !== 1) out.push('craft: a reforge does not re-roll the affixes for gold, or loses the enchantment');
    h.eq.weapon.rar = 0; h.eq.weapon.mods = {}; click('eq:weapon'); const g1 = h.gold; click('do'); if (h.gold !== g1) out.push('craft: a common piece is reforged');
    step(S, { keys: ['Escape'] }); if (S.screen !== 'play') out.push('craft: Esc does not leave the workshop');
    h.x = sv.lectern.x; h.y = sv.lectern.y + 30; step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); throughTalk(); if (S.screen !== 'craft' || S.craft.kind !== 'enchant') { out.push('craft: E through the enchanter\'s talk does not open her workshop'); return out; }
    it.ench = []; h.eq.ring = it; h.bag[5] = null; S.meta.shards = 1000; click('eq:ring'); const st0 = heroSt(S), sh0 = S.meta.shards; click('do');
    if (it.ench.length !== 1 || S.meta.shards !== sh0 - D.CRAFT.ench.shards[0]) out.push('craft: the first enchantment fails or is not paid in shards');
    else { const e = it.ench[0], st1 = heroSt(S), was = SIM_STAT[e.k]; if (was && st1[was] <= st0[was] && !(was === 'aspd' && st0.aspd >= st0.aspdMax)) out.push(`craft: the enchantment (${e.k}) does not reach the hero`); }
    // TASKS 1618: a failure is rare and takes everything off the piece, its own affixes too
    if (D.CRAFT.ench.max !== 5 || D.CRAFT.ench.fail.join() !== '0,0.01,0.02,0.05,0.1') out.push('craft: the enchantment is not 5 steps at 0, 1, 2, 5, 10 %');
    { const was = D.CRAFT.ench.fail; D.CRAFT.ench.fail = [1, 1, 1, 1, 1]; it.ench = [{ k: 'atk', v: 1 }]; rollAffixes(R, it); click('do'); D.CRAFT.ench.fail = was;
      if (!S.craft.res || S.craft.res.ok || it.ench.length || Object.keys(it.mods).length) out.push('craft: a failure does not take everything off the piece'); rollAffixes(R, it); }
    it.ench = D.AFFIXES.slice(0, 5).map((a) => ({ k: a.k, v: 1 })); const g2 = h.gold; click('do'); if (it.ench.length !== 5 || h.gold !== g2) out.push('craft: a fourth enchantment is laid on');
    return out;
  }
  const SIM_STAT = { str: 'atk', vit: 'maxHp', hp: 'maxHp', mp: 'maxMp', atk: 'atk', def: 'def', crit: 'crit', aspd: 'aspd', dodge: 'dodge', regen: 'regen', onhit: 'onhit' };
  // TASKS 1016, 1023: E by the Keeper of the Fire opens the dialogue with what is new, each told once: the first meeting, the last
  // hero's death (the first death its own words), a chapter's boss by name, a legendary by name, a long time below; with nothing
  // new his idle pair; E or a click turns the page, the last closes; a guard talks his own lines; the smith's E stays his workshop
  function talkCheck() {
    const out = [], S = spawn(0, {}), K = D.KEEPER, run = (sd) => { S.run = newRun(S, 'campaign', sd, { town: 1, allFree: 1 }); S.screen = 'play'; noQuests(S.run); return S.run; };
    const talkTo = (R, role) => { const f = folkOf(R).find((q) => q.role === role); R.hero.x = f.x + 44; R.hero.y = f.y + 12; step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); return S.talk; };
    const read = () => { const p = S.talk ? S.talk.pages.slice() : []; for (let i = 0; i < 60 && S.screen === 'talk'; i++) step(S, { keys: ['KeyE'] }); return p; };
    let R = run(31); talkTo(R, 'keeper'); if (S.screen !== 'talk') { out.push('talk: E by the Keeper opens no dialogue'); return out; }
    const p1 = read(); if (p1[0] !== K.first[0] || S.screen !== 'play') out.push('talk: no first meeting, or the last page does not close the dialogue');
    talkTo(R, 'keeper'); const p2 = read(); if (!D.FOLK.keeper.lines.some((l) => l[0] === p2[0])) out.push('talk: with nothing new the Keeper does not fall back on his idle lines');
    endRun(S, 'dead'); R = run(32); talkTo(R, 'keeper'); const p3 = read(); if (p3[0] !== K.death1[0]) out.push('talk: the first death is not spoken of');
    R.bossN = 1; R.lastBoss = 'boss_spider'; R.legend = 'Кольцо Бездны'; R.deepest = 6; enterFloor(S, R, 0, undefined, 'up'); talkTo(R, 'keeper'); const p4 = read();
    if (!p4.includes(K.boss(ENEMIES.boss_spider.name)[0]) || !p4.includes(K.rare('Кольцо Бездны')[0]) || !p4.includes(K.away[0])) out.push('talk: a boss, a legendary or a long time below is not spoken of');
    talkTo(R, 'keeper'); const p5 = read(); if (p5.includes(K.away[0]) || p5.includes(K.rare('Кольцо Бездны')[0])) out.push('talk: the Keeper tells the same news twice');
    endRun(S, 'dead'); R = run(33); talkTo(R, 'keeper'); const p6 = read(); if (p6[0] !== K.death[0]) out.push('talk: a later death is told as the first');
    for (const f of folkOf(R)) if (f.role !== 'guard') f.x += 2000; talkTo(R, 'guard'); const p7 = read(); for (const f of folkOf(R)) if (f.role !== 'guard') f.x -= 2000; if (!D.FOLK.guard.lines.some((l) => l[0] === p7[0])) out.push('talk: the guard does not speak his lines');
    // TASKS 1148: past the colossus the Keeper asks whether the run ends: «Завершить поход» (a click only, TASKS 1854) wins it with its reward, «Продолжить»
    // (Enter, E, Esc) leaves it going; after the descent past it the win is not counted again
    { const F = D.RUNS.campaign.floors, endAt = () => { for (let i = 0; i < 12 && S.talk && S.talk.p + 1 < S.talk.pages.length; i++) step(S, { keys: ['KeyE'] }); const a = D.UI.talk(S.talk).r.find((q) => q.id === 'act'); step(S, { px: a.x + a.w / 2, py: a.y + a.h / 2, click: 1, keys: [] }); }; R = run(34); talkTo(R, 'keeper'); const a0 = S.talk && S.talk.act; read(); if (a0 && a0.k === 'finish') out.push('talk: the Keeper offers to end the run before the colossus');
      R.slain = [F]; R.deepest = F; R.goldTot = 1000; talkTo(R, 'keeper'); const a1 = S.talk && S.talk.act;
      if (!a1 || a1.k !== 'finish' || S.talk.pages.slice(-K.end.length).join() !== K.end.join()) out.push('talk: past the colossus the Keeper does not tell the end and offer to end the run');
      else { step(S, { keys: ['Escape'] }); if (S.screen !== 'play' || S.run !== R) out.push('talk: «Продолжить» does not leave the run going');
        talkTo(R, 'keeper'); read(); if (S.screen !== 'play' || S.run !== R) out.push('talk: E run through the Keeper\'s pages ends the run');
        talkTo(R, 'keeper'); for (let i = 0; i < 12 && S.talk && S.talk.p + 1 < S.talk.pages.length; i++) step(S, { keys: ['KeyE'] }); step(S, { keys: ['Enter'] }); if (S.screen !== 'play' || S.run !== R || S.talk) out.push('talk: Enter on the Keeper\'s last page ends the run instead of going on (TASKS 1854)');
        const w0 = S.meta.wins || 0, s0 = S.meta.shards; talkTo(R, 'keeper'); endAt();
        if (S.screen !== 'win' || S.run || S.meta.wins !== w0 + 1 || S.meta.shards - s0 !== Math.floor(1000 / REWARD.goldPer) + REWARD.win || S.meta.best < F) out.push(`talk: «Завершить поход» does not win the run with its reward (${S.screen}, ${S.meta.wins - w0}, ${S.meta.shards - s0})`); }
      R = run(35); R.slain = [F]; R.deepest = F + 3; R.campaignWon = 1; R.mode = 'endless'; R.goldTot = R.goldBanked = 800; R.goldTot += 300; const w1 = S.meta.wins || 0; talkTo(R, 'keeper');
      if (!S.talk || !S.talk.act || S.talk.act.k !== 'finish' || !S.talk.pages.includes(K.endDeep[0])) out.push('talk: after the descent the Keeper does not offer to end the run');
      else { endAt(); if (S.screen !== 'win' || S.meta.wins !== w1 || S.result.base !== Math.floor(300 / REWARD.goldPer) || S.result.win || S.meta.bestEndless < F + 3) out.push('talk: a run ended at the Keeper after the descent wins the campaign twice or pays its gold again'); }
      // (PR 29 review) a side quest the Keeper offers after the descent does not hide the end of the run, nor shows its «!» over him
      R = run(38); R.slain = [F]; R.campaignWon = 1; R.mode = 'endless'; R.deepest = F + 2; R.offers = [{ key: 'cull', from: 'keeper' }];
      if (!offerOf(R, 'keeper')) out.push('talk: no side quest of the Keeper\'s to check the end of the run against');
      else { talkTo(R, 'keeper'); if (!S.talk || !S.talk.act || S.talk.act.k !== 'finish' || questMark(R, 'keeper') === '!') out.push('talk: a side quest on offer hides the Keeper\'s end of the run'); step(S, { keys: ['Escape'] }); }
      // TASKS 1150: the pause menu's «Сдаться» is «Завершить поход» past the colossus, a win
      // PR 49 review: the colossus slain is told by the end alone, not by the boss news that someone must go down again; Kip has his
      // words for it once a run, then his own lines again
      R = run(39); R.slain = [F]; R.deepest = F; R.bossN = 6; R.lastBoss = D.stageOf('campaign', F).boss; talkTo(R, 'keeper');
      if (!S.talk || S.talk.pages.includes(K.boss(ENEMIES[R.lastBoss].name)[0]) || !S.talk.pages.includes(K.end[0])) out.push('talk: the colossus slain is told by the boss news, or the end is not told'); step(S, { keys: ['Escape'] });
      for (const f of folkOf(R)) if (f.role !== 'child') f.x += 2000; talkTo(R, 'child'); const k1 = S.talk && S.talk.pages.slice(); read(); talkTo(R, 'child'); const k2 = S.talk && S.talk.pages.slice(); read(); for (const f of folkOf(R)) if (f.role !== 'child') f.x -= 2000;
      if (!k1 || k1.slice(0, D.FOLK.child.won.length).join() !== D.FOLK.child.won.join() || !k2 || k2.includes(D.FOLK.child.won[0])) out.push('talk: past the colossus Kip does not have his words once');
      R = run(36); const pz = () => UI.pause(S.meta.zoom, campaignDone(R)).map((b) => b.id);
      // TASKS 1853: «Сдаться» asks first, «Нет» in focus; Enter and Escape keep the run, ←→ then Enter gives it up
      { const ab = UI.pause(S.meta.zoom, false).find((b) => b.id === 'abandon'), hit = () => step(S, { keys: [], click: 1, px: ab.x + ab.w / 2, py: ab.y + ab.h / 2 }); S.screen = 'pause'; hit();
        if (S.screen !== 'pause' || !S.pauseAsk || S.focus !== 'no' || S.run !== R) out.push('pause: «Сдаться» gives the run up on one click, or asks with «Да» first');
        step(S, { keys: ['Escape'] }); if (S.screen !== 'pause' || S.pauseAsk || S.run !== R) out.push('pause: Escape on the question gives up or leaves the pause');
        hit(); step(S, { keys: ['Enter'] }); if (S.pauseAsk || S.run !== R) out.push('pause: Enter on the question gives the run up with «Нет» in focus');
        hit(); step(S, { keys: ['ArrowLeft'] }); step(S, { keys: ['Enter'] }); if (S.screen !== 'dead' || S.run || !S.result.abandoned) out.push('pause: «Да» on the question does not give the run up');
        R = run(36); }
      if (!pz().includes('abandon') || pz().includes('finish')) out.push('pause: «Завершить поход» before the colossus falls');
      R.slain = [F]; R.deepest = F; const w2 = S.meta.wins || 0, fb = UI.pause(S.meta.zoom, true).find((b) => b.id === 'finish');
      if (!fb || pz().includes('abandon')) out.push('pause: past the colossus the menu still gives up the run');
      else { const yb = UI.pauseAsk(true).r.find((b) => b.id === 'yes'); S.screen = 'pause'; step(S, { keys: [], click: 1, px: fb.x + fb.w / 2, py: fb.y + fb.h / 2 });
        if (S.screen !== 'pause' || !S.pauseAsk || S.focus !== 'no' || !S.run) out.push('pause: «Завершить поход» ends the run without asking, or asks with «Да» first');
        step(S, { keys: ['Enter'] }); if (S.screen !== 'pause' || S.pauseAsk || !S.run) out.push('pause: Enter on the finish question ends the run or keeps asking');
        step(S, { keys: [], click: 1, px: fb.x + fb.w / 2, py: fb.y + fb.h / 2 }); step(S, { keys: [], click: 1, px: yb.x + yb.w / 2, py: yb.y + yb.h / 2 });
        if (S.screen !== 'win' || S.run || S.meta.wins !== w2 + 1 || S.result.abandoned) out.push('pause: «Завершить поход» does not end the run won'); }
      R = run(37); }
    out.push(...masterTalkCheck(S, R));
    return out;
  }
  // PR 49 review: every townsman can be talked to. E at the anvil or the lectern, or by the smith or the enchanter, opens their talk
  // with «Поговорить» and the button into their workshop, which leads in; the workshop's «Поговорить» leads back; with a quest on
  // the last page every button (Дальше, the quest's, Мастерская, Поговорить) still fits the row, none on another or on the likeness
  function masterTalkCheck(S, R) {
    const out = [], sv = R.map.town.svc, h = R.hero, click = (U, id) => { const b = U.r.find((q) => q.id === id); if (b) step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 }); return !!b; };
    for (const [role, kind, at] of [['smith', 'forge', sv.anvil], ['enchanter', 'enchant', sv.lectern]]) {
      S.screen = 'play'; S.talk = null; h.x = at.x; h.y = at.y + 30; step(S, { keys: [] }); step(S, { keys: ['KeyE'] });
      if (S.screen !== 'talk' || S.talk.role !== role || S.talk.craft !== kind) { out.push(`talk: E at the ${role}'s workshop opens no talk with ${role}`); continue; }
      const ids = UI.talk(S.talk).r.map((b) => b.id); if (!ids.includes('talk') || !ids.includes('craft')) out.push(`talk: the ${role}'s first page has no «Поговорить» or no workshop button (${ids})`);
      click(UI.talk(S.talk), 'talk'); if (S.screen !== 'talk' || !S.talk.menu || S.talk.topics !== D.FOLK[role].topics) out.push(`talk: «Поговорить» does not open the ${role}'s topics`);
      step(S, { keys: ['Digit1'] }); if (S.talk.pages !== D.FOLK[role].topics[0].a) out.push(`talk: the ${role}'s first topic does not open`);
      step(S, { keys: ['Escape'] }); if (!S.talk || !S.talk.menu) out.push(`talk: Esc in the ${role}'s topic does not go back to the topics`); step(S, { keys: ['Escape'] }); h.x = at.x; h.y = at.y + 30; step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); click(UI.talk(S.talk), 'craft');
      if (S.screen !== 'craft' || S.craft.kind !== kind) { out.push(`talk: the ${role}'s workshop button does not lead in`); continue; }
      click(UI.craft(), 'talk'); if (S.screen !== 'talk' || S.talk.role !== role) out.push(`talk: the ${role}'s workshop «Поговорить» does not lead back`);
      S.screen = 'play'; S.talk = null; }
    for (const role of ['smith', 'enchanter']) { const f = folkOf(R).find((q) => q.role === role), x0 = f.x, y0 = f.y; f.x += 2600; h.x = f.x + 44; h.y = f.y + 12; S.screen = 'play'; step(S, { keys: [] }); step(S, { keys: ['KeyE'] });
      if (S.screen !== 'talk' || S.talk.role !== role) out.push(`talk: E by the ${role} away from the workshop opens no talk`); f.x = x0; f.y = y0; S.screen = 'play'; S.talk = null; }
    // TASKS 1848: a quest's offer opens without «Поговорить», its row then the quest's, Мастерская and Дальше
    const of0 = R.offers; R.offers = [{ key: 'cull', from: 'smith', q: 0 }]; S.screen = 'play'; S.talk = null; h.x = sv.anvil.x; h.y = sv.anvil.y + 30; step(S, { keys: [] }); step(S, { keys: ['KeyE'] });
    if (S.screen !== 'talk' || !S.talk.act || S.talk.topics || UI.talk(S.talk).r.some((b) => b.id === 'talk')) out.push('talk: the smith\'s quest offer shows «Поговорить» or no quest');
    R.offers = of0; S.screen = 'play'; S.talk = null;
    const T = { role: 'smith', i: 0, pages: ['a', 'b'], p: 1, act: { k: 'take', key: 'cull', rw: {} }, topics: D.FOLK.smith.topics, craft: 'forge' }, U = UI.talk(T), row = U.r.filter((b) => !b.id.startsWith('topic:'));
    if (row.map((b) => b.id).sort().join() !== 'act,craft,next,talk') out.push('talk: a full row by the smith lacks a button: ' + row.map((b) => b.id));
    if (row.some((b, i) => b.x < U.P.x + 300 || b.x + b.w > U.P.x + U.P.w || row.some((o, j) => j !== i && b.x < o.x + o.w && o.x < b.x + b.w))) out.push('talk: the buttons of a full row overlap or leave the window');
    T.p = 0; if (!UI.talk(T).r.some((b) => b.id === 'talk')) out.push('talk: «Поговорить» is missing before the last page');
    return out;
  }
  // PR 49 review: a captive sent home for want of room for its cage does its rescue quest in hand as freeing does, and the Keeper's
  // chain goes on past it
  function captiveFallbackCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 87, { town: 1 }); S.screen = 'play'; const R = S.run; R.offers = [];
    const st = SIMX.storyStep(R); if (!st || st.key !== 'rescue') { out.push('rescue: the Keeper\'s chain does not open with the merchant'); return out; }
    const q = takeQuest(S, R, newQuest(R, 'rescue', 1, 'keeper')); enterFloor(S, R, 1); const C = R.captives.merchant; for (const k of ['x', 'y', 'room', 'lv']) delete C[k];
    SIMX.captivePut(S, R, C, []); if (!R.freed || !R.freed.merchant || q.st !== 'done') out.push(`rescue: the merchant sent home without a cage leaves his quest ${q.st}`);
    enterFloor(S, R, 0, undefined, 'portal'); if (questMark(R, 'keeper') !== '?') out.push('rescue: no ? over the Keeper after the merchant came home without a cage');
    turnIn(S, R, q); const nx = SIMX.storyStep(R); if (!nx || nx.key === 'rescue') out.push('rescue: the Keeper\'s chain does not go on past a rescue without a cage');
    return out;
  }
  // PR 49 review: a note's series follows what the player has read, across runs. With nothing read only first parts lie about; a
  // part read brings the next one on the next floor of its era, a part left unread comes again; a new run goes on from the last
  // part read; no part ever lies about before the one ahead of it is read; reading every note of the cellars, each series ends
  // within a few runs of its start
  function noteChainCheck() {
    const out = [], S = spawn(0, {}), run = (sd) => { S.run = newRun(S, 'campaign', sd, { town: 1, allFree: 1 }); S.screen = 'play'; return S.run; };
    const placed = (R) => R.drops.filter((p) => p.kind === 'note').map((p) => D.NOTES.byId[p.note]), ids = D.NOTES.chains['cellar:chalk_line'];
    const go = (R, f) => { const read = new Set(S.meta.notes); enterFloor(S, R, f); if (placed(R).some((n) => n.chain && D.NOTES.chains[D.NOTES.chainOf(n)].slice(0, n.part - 1).some((id) => !read.has(id)))) out.push(`notes: on floor ${f} a part lies before the one ahead of it is read`); return placed(R); };
    const readAll = (R) => { for (const p of R.drops) if (p.kind === 'note') SIMX.openNote(S, R, p); S.screen = 'play'; };
    S.meta.notes = []; let R = run(83); if (go(R, 1).some((n) => n.chain && n.part !== 1)) out.push('notes: a later part lies about with nothing read');
    S.meta.notes = [ids[0]]; R = run(84); if (!go(R, 1).some((n) => n.id === ids[1])) out.push('notes: the part after one read does not come on the next floor');
    if (!go(R, 2).some((n) => n.id === ids[1])) out.push('notes: a part left unread does not come again on the next floor of its era');
    readAll(R); R = run(85); if (!go(R, 1).some((n) => n.id === ids[2])) out.push('notes: a new run does not go on from the last part read');
    readAll(R); if (!go(R, 2).some((n) => n.id === ids[3])) out.push('notes: the part after one read on an earlier floor does not come later in the run');
    readAll(R); R = run(86); if (go(R, 1).some((n) => ids.includes(n.id))) out.push('notes: a series read to the end comes again');
    S.meta.notes = []; const start = {}, end = {}, cellar = Object.keys(D.NOTES.chains).filter((k) => k.startsWith('cellar:') || k.startsWith('pilot:'));
    for (let i = 0; i < 16; i++) { R = run(200 + i); for (const f of [1, 2]) { go(R, f); readAll(R); }
      for (const k of cellar) { const got = D.NOTES.chains[k].filter((id) => S.meta.notes.includes(id)).length; if (got && start[k] === undefined) start[k] = i; if (got === D.NOTES.chains[k].length && end[k] === undefined) end[k] = i; } }
    for (const k of Object.keys(start)) if (end[k] === undefined || end[k] - start[k] > Math.ceil(D.NOTES.chains[k].length / 2) + 1) out.push(`notes: the series ${k} begun on run ${start[k]} ${end[k] === undefined ? 'is not done in 16 runs' : 'takes till run ' + end[k]}`);
    if (Object.keys(start).length < 3) out.push('notes: in 16 runs fewer than three series of the cellars are begun');
    return out;
  }
  // TASKS 1017: a quest taken in the town counts only what its goal names, from its floor down: monsters (not in the town nor
  // above its floor; elites only for an elite hunt; a boss is no monster), rooms cleared to the last foe, the floor reached, a
  // chapter's boss; done at its need, nothing counts past it; turned in only in the town and only once, for its reward (gold, XP,
  // an item in the bag, shards to the bank); the quests travel in the save and stay small
  // TASKS 1028: gear asks a hero's level a little under its own: a find of the floor the hero is on goes on at once (the lowest levels
  // the novice and average bots come to each campaign floor at, the test runs' starting heroes); a piece above the level is not
  // put on by a click (a refusal, it stays in the bag) nor by a pickup into an empty slot; the starting gear asks nothing
  function levelCheck() {
    const out = [], S = spawn(0, {}), at = [1, 3, 3, 5, 6, 7, 8, 9, 11, 12, 13, 15];
    at.forEach((l, i) => { if (D.reqLvl({ b: 'sword', lvl: i + 1 }) > l) out.push(`level: a ${i + 1}st-floor find asks more than level ${l}`); });
    for (const mode of ['cave', 'magma']) { const R0 = newRun(S, mode, 3), f4 = rollItem(R0, dep(R0, 4), 0); if (D.reqLvl(f4) > R0.hero.lvl) out.push(`level: a ${mode} run's last floor's find asks more than its starting hero's level`); }
    S.run = newRun(S, 'campaign', 5); S.screen = 'play'; const R = S.run, h = R.hero; if (Object.values(h.eq).some((it) => it && D.reqLvl(it) > 1)) out.push('level: the starting gear asks a level');
    let deep; do deep = Object.assign(rollItem(R, 12, 0, 'helm'), { id: R.nextId++ }); while (!D.wears(h.cls, deep.b)); h.eq.helm = null; h.bag[7] = deep; useItem(S, R, 7);
    if (h.eq.helm || h.bag[7] !== deep || !S.ev.some((e) => e.k === 'nope' && e.s === 'Требуется уровень ' + D.reqLvl(deep))) out.push('level: a piece above the level is put on by a click');
    h.bag[7] = null; if (wearIfFree(S, R, deep) || h.eq.helm) out.push('level: a piece above the level goes on at a pickup');
    h.lvl = D.reqLvl(deep); h.bag[7] = deep; useItem(S, R, 7); if (h.eq.helm !== deep) out.push('level: a piece at the level is not put on');
    return out;
  }
  // a run whose townsfolk have no quest business (no offers, the Keeper's chain in hand), for the checks of the talk and the workshops
  const noQuests = (R) => { R.offers = []; R.quests = [{ id: -1, key: 'chapter', f: 99, need: 1, n: 0, st: 'taken', from: 'keeper', rw: {} }]; };
  // TASKS 1018–1022: a run's offers are 2–3, each from its own townsman, the same for the same seed; ! over the giver, his talk ends
  // on the quest's page and E takes it; the named foe (on its floor, never a boss's; an elite with its name; marked on the map; kept
  // on the floor left and come back to), the keepsake (in a chest, a cache or on the floor, reachable, never in the bag), the marked
  // room (another room cleared does not count) each do their quest; ? over the giver, the talk turns it in and pays; the Keeper's
  // chain goes boss by boss and skips a boss slain before
  function questGiveCheck() {
    const out = [], S = spawn(0, {}), run = (sd) => { S.run = newRun(S, 'campaign', sd, { town: 1, allFree: 1 }); S.screen = 'play'; return S.run; };
    const talkTo = (R, role) => { const f = folkOf(R).find((q) => q.role === role); for (const o of folkOf(R)) if (o !== f) o.x += 3000; R.hero.x = f.x + 44; R.hero.y = f.y + 12; for (let i = 0; i < 20; i++) step(S, { keys: [] }); step(S, { keys: ['KeyE'] }); for (const o of folkOf(R)) if (o !== f) o.x -= 3000; return S.talk; };
    const finish = () => { for (let i = 0; i < 60 && S.screen === 'talk'; i++) { const T = S.talk, take = T.act && T.act.k === 'take' && T.p + 1 >= T.pages.length; step(S, { keys: [take ? 'Enter' : 'KeyE'] }); } };
    let R = run(41); const of = offersOf(R).map((o) => o.key + ':' + o.from).join();
    if (of !== offersOf(run(41)).map((o) => o.key + ':' + o.from).join()) out.push('quest give: the offers differ for the same seed');
    const seeds = [41, 42, 43, 44, 45, 46, 47, 48].map((sd) => offersOf(run(sd)));
    if (seeds.some((o) => o.length < 2 || o.length > 3 || new Set(o.map((q) => q.from)).size !== o.length || !['named', 'fetch', 'room'].includes(o[0].key))) out.push('quest give: a run has not 2–3 offers from as many townsmen, the first a goal on a floor');
    // each kind of goal on a run of its own: its offer moved to the guard, taken by talking to him
    const takeKind = (sd, key) => { const R2 = run(sd); R2.offers = [{ key, from: 'guard', q: 0 }]; R2.quests = [{ id: -1, key: 'chapter', f: 99, need: 1, n: 0, st: 'taken', from: 'keeper', rw: {} }];
      if (questMark(R2, 'guard') !== '!') out.push('quest give: no ! over the giver of ' + key);
      const T = talkTo(R2, 'guard'); if (!T || !T.act || T.act.k !== 'take') { out.push('quest give: the giver\'s talk has no quest of ' + key); return null; }
      for (let i = 0; i < 60 && S.screen === 'talk'; i++) step(S, { keys: ['KeyE'] }); if (R2.quests.some((o) => o.key === key)) out.push('quest give: E run through the pages takes ' + key);
      if (S.screen !== 'talk') out.push('quest give: E run through the pages drops the offer of ' + key); step(S, { keys: ['Escape'] });
      if (!talkTo(R2, 'guard')) { out.push('quest give: the talk does not reopen after Esc closed it'); return null; }
      finish(); const q = R2.quests.find((o) => o.key === key); if (!q || questMark(R2, 'guard') || S.screen !== 'play') { out.push('quest give: Enter on the quest\'s page does not take ' + key); return null; }
      if (q.f !== (D.QUESTS[key].from || 1) || (D.QUESTS[key].noBoss && STAGE(R2, q.f).boss)) out.push(`quest give: ${key} points at floor ${q.f}`); return q; };
    // the named foe
    { const q0 = takeKind(19, 'named'), R0 = S.run;
      if (q0) { for (let f = 1; f <= q0.f; f++) enterFloor(S, R0, f); const e0 = R0.en.find((o) => o.quest === q0.id), i0 = R0.en.indexOf(e0);
        if (e0 && i0 > 0) { const was = e0.was; if (!e0.mods || !e0.mods.length) out.push('quest abandon: the named foe on seed 19 has no elite mods to lose'); e0.hp = Math.round(e0.max / 2); R0.en.splice(0, 1); const maxOf = new Map(R0.en.filter((o) => o !== e0).map((o) => [o.id, o.max])); enterFloor(S, R0, 0, undefined, 'up'); SIMX.abandonQuest(S, R0, q0); enterFloor(S, R0, q0.f);
          const e1 = R0.en.find((o) => o.id === e0.id); if (!e1 || e1.quest !== undefined || e1.elite || e1.title || e1.mods !== undefined || e1.ward !== undefined || e1.max !== was.max || Math.abs(e1.hp - was.max / 2) > 2) out.push(`quest abandon: the named foe is not its plain self on a kept floor (${e1 ? e1.hp + '/' + e1.max + ', was ' + was.max : 'gone'})`);
          if (R0.en.some((o) => o !== e1 && maxOf.has(o.id) && o.max !== maxOf.get(o.id))) out.push('quest abandon: another foe took the named one\'s stats'); } else out.push('quest abandon: seed 19 has no named foe past the first in the list'); } }
    let q = takeKind(51, 'named'); R = S.run;
    if (q) { for (let f = 1; f <= q.f; f++) enterFloor(S, R, f); const e = R.en.find((o) => o.quest === q.id);
      if (!e || !e.elite || e.title !== q.title || D.BOSSES[e.type] || D.eliteName(e) !== q.title) out.push('quest named: no named elite on its floor');
      else { if (!questMarks(R).some((o) => o.kind === 'named')) out.push('quest named: the foe is not on the map');
        const hp = e.max; enterFloor(S, R, 0, undefined, 'up'); enterFloor(S, R, q.f); const e2 = R.en.find((o) => o.quest === q.id);
        if (!e2 || e2.max !== hp || R.en.filter((o) => o.quest === q.id).length !== 1) out.push('quest named: the foe is not kept on its floor (or comes twice)');
        if (e2) killEnemy(S, R, e2); if (q.st !== 'done') out.push('quest named: its death does not do the quest');
        enterFloor(S, R, 0, undefined, 'portal'); if (questMark(R, 'guard') !== '?') out.push('quest named: no ? over the giver once done');
        const g0 = scrolls(R.hero), T = talkTo(R, 'guard'); if (!T || !T.act || T.act.k !== 'turn') out.push('quest named: the talk does not offer the turn-in');
        finish(); if (q.st !== 'turned' || scrolls(R.hero) !== g0 + q.rw.scroll || !q.rw.got || q.rw.rar < 3) out.push('quest named: the turn-in does not pay (scrolls of return, an epic piece)'); } }
    // the named foe never on a boss's floor
    R = run(52); R.deepest = 1; if (questFloor(R, 'named') !== 3 || questFloor(R, 'cull') !== 2) out.push('quest give: a goal on a floor points at a boss\'s floor, or a hunt skips one');
    // the keepsake: three seeds should between them put it in a chest or cache and on the floor
    const where = new Set();
    for (const sd of [61, 62, 63, 64, 65, 66]) { q = takeKind(sd, 'fetch'); R = S.run; if (!q) continue; enterFloor(S, R, 1); where.add(q.where);
      const A = lootAudit(Object.assign(R, { hero: Object.assign(R.hero, { x: R.map.spawn.x, y: R.map.spawn.y }) })), k = A.list.filter((o) => o.quest);
      if (k.length !== 1 || k[0].at === 'stuck') { out.push(`quest fetch: seed ${sd}: the keepsake is not on its floor once, or out of reach (${k.map((o) => o.at)})`); continue; }
      for (const sq of R.map.secrets || []) openSecret(S, R, sq, true); for (const c of R.chests) if (c.quest) openChest(S, R, c);
      const d = R.drops.find((o) => o.kind === 'qitem'); const bag0 = R.hero.bag.filter(Boolean).length; R.hero.x = d.x; R.hero.y = d.y; d.t0 = -9; d.fly = 0; d.vz = 0; d.z = 0;
      for (let i = 0; i < 60 && !d.got; i++) step(S, { keys: [] });
      if (q.st !== 'done' || R.hero.bag.filter(Boolean).length !== bag0 || R.drops.some((o) => o.kind === 'qitem')) out.push(`quest fetch: seed ${sd}: picking it up does not do the quest, or it lands in the bag`); }
    if (where.size < 2) out.push('quest fetch: the keepsake always lies in the same kind of place: ' + [...where]);
    // the marked room: another room cleared does not count, the marked one does; the completion hints leave it to the quest's mark
    q = takeKind(71, 'room'); R = S.run;
    if (q) { enterFloor(S, R, 1); if (q.room === undefined || !questMarks(R).some((o) => o.kind === 'room')) out.push('quest room: no room marked');
      else { const other = R.en.find((e) => e.deadT < 0 && counted(e) && e.room >= 0 && e.room !== q.room); if (other) for (const e of R.en.filter((o) => o.room === other.room && o.deadT < 0 && counted(o))) killEnemy(S, R, e);
        if (q.n) out.push('quest room: another room cleared counts');
        for (const e of R.en.filter((o) => o.room === q.room && o.deadT < 0 && counted(o)).slice(1)) killEnemy(S, R, e);
        R.stats[1].kills = Math.ceil(R.stats[1].foes * 0.9); if (completionHints(R).some((o) => DG.roomAt(R.map, o.x, o.y) === q.room)) out.push('quest room: the completion hints mark the quest\'s room again');
        for (const e of R.en.filter((o) => o.room === q.room && o.deadT < 0 && counted(o))) killEnemy(S, R, e); if (q.st !== 'done') out.push('quest room: clearing the marked room does not do it'); } }
    // the Keeper's chain: the spider's floor first; the necromancer's after it; a boss slain before it is offered is skipped
    { const Z = S.run = newRun(S, 'campaign', 82, { town: 1 }), X = root.SIMX, Y = Object.assign({}, Z); S.screen = 'play'; delete Y.captives;
      if (!X.shopShut(Z)) out.push('rescue: the town shop is open before the merchant is freed');
      if (X.shopShut(Y)) out.push('rescue: a saved run from before the cage has its shop shut');
      if (Z.folk.some((f) => f.role === 'smith' || f.role === 'enchanter')) out.push('rescue: the smith or the enchanter stands in town before being freed');
      for (const [who, f] of [['merchant', 1], ['smith', 3]]) { enterFloor(S, Z, f); const C = Z.captives[who];
        if (C.x === undefined) { out.push('rescue: no cage for the ' + who); continue; }
        if (Z.map.decor.some((d) => Math.abs(d.x - C.x) < 40 && d.y < C.y + 8 && d.y > C.y - 60)) out.push('rescue: the cage stands on a prop');
        Z.en = []; Z.hero.x = C.x; Z.hero.y = C.y + 60; for (let i = 0; i < 120; i++) step(S, { up: 1, px: 960, py: 540, keys: [] }); if (Z.hero.y < C.y - 14) out.push('rescue: the hero walks through the cage of the ' + who);
        Z.en = []; Z.hero.x = C.x + 40; Z.hero.y = C.y + 30; X.interact(S, Z); S.screen = 'play'; if (!Z.freed || !Z.freed[who]) out.push('rescue: E at the cage does not free the ' + who); }
      enterFloor(S, Z, 0); if (X.shopShut(Z)) out.push('rescue: the town shop is shut after the merchant is freed'); if (!Z.folk.some((f) => f.role === 'smith')) out.push('rescue: the freed smith is not in town'); if (Z.folk.some((f) => f.role === 'enchanter')) out.push('rescue: the enchanter is in town though still caged'); }
    { const Z = run(83), plain = () => Z.drops.filter((p) => p.kind === 'note' && p.sec === undefined && D.NOTES.byId[p.note].kind !== 'hint');
      for (const f of [1, 3, 5, 7, 9, 13]) { enterFloor(S, Z, f); const P = plain(); if (P.length < 3 || P.length > 5) out.push('notes: floor ' + f + ' has ' + P.length); for (const p of P) { const n = D.NOTES.byId[p.note]; if (n.kind === 'boss' && (f < n.floors[0] || f > n.floors[1])) out.push('notes: ' + n.id + ' off its floors on ' + f); } }
      if (new Set(Z.notesUsed).size !== Z.notesUsed.length) out.push('notes: one repeated in a run');
      const P9 = Z.drops.filter((p) => p.kind === 'note'); if (P9.some((p, i) => P9.some((o, j) => j > i && Math.hypot(p.x - o.x, p.y - o.y) < 40))) out.push('notes: two lie on top of each other'); }
    R = run(81); R.freed = { merchant: 1 }; R.offers = []; let T = talkTo(R, 'keeper'); const st0 = T && T.act && T.act.k === 'take' ? T.act : null; finish();
    const sq = R.quests.find((o) => D.QUESTS[o.key].kind === 'story');
    if (!st0 || !sq || sq.key !== 'chapter' || sq.f !== 2 || sq.from !== 'keeper') out.push('quest story: the Keeper does not open the chain with the second floor\'s boss');
    else { enterFloor(S, R, 1); enterFloor(S, R, 2); const b = R.en.find((e) => D.BOSSES[e.type]); if (b) killEnemy(S, R, b); if (sq.st !== 'done') out.push('quest story: the boss slain does not do the step');
      enterFloor(S, R, 0, undefined, 'portal'); if (questMark(R, 'keeper') !== '?') out.push('quest story: no ? over the Keeper'); const sh = S.meta.shards; talkTo(R, 'keeper');
      for (let i = 0; i < 12 && S.screen === 'talk' && sq.st !== 'turned'; i++) step(S, { keys: ['KeyE'] });
      if (sq.st !== 'turned' || S.meta.shards <= sh) out.push('quest story: the step is not turned in for shards');
      // the thanks, then the next step's offer in the same talk
      const nt = S.talk && S.talk.act; if (!nt || nt.k !== 'take' || !D.QUEST_SAY.keeper.thanks.some((v) => S.talk.pages[1].startsWith(v))) out.push('quest story: no thanks and next offer after the turn-in');
      step(S, { keys: ['Escape'] }); const nx = offerOf(R, 'keeper'); if (!nx || nx.q.key !== 'chapter' || nx.q.f !== 4) out.push('quest story: the next step is not the fourth floor\'s boss');
      R.slain.push(4); R.deepest = 4; const nx2 = offerOf(R, 'keeper'); if (!nx2 || nx2.q.f !== 6) out.push('quest story: a boss slain before is offered again'); }
    // TASKS 1850: a quest to turn in waits behind an ordinary line with its button; its words, the thanks and the reward come once pressed
    // a quest's turn-in waits behind one of its giver's lines: every townsman with quests has them (PR 55 review 2)
    for (const role in D.QUEST_SAY) if (!D.FOLK[role] || !(D.FOLK[role].lines || []).length) out.push(`quest turn-in: the ${role} gives quests but has no lines`);
    // (PR 55 review 2) with the Keeper's news to tell, the news is the button's page and the reward is told once pressed
    for (const [role, key, news] of [['keeper', 'fetch'], ['smith', 'fetch'], ['porter', 'cull'], ['guard', 'named'], ['keeper', 'fetch', 1]]) { R = run(41); R.offers = []; R.quests = []; const q = takeQuest(S, R, newQuest(R, key, 2, role)); q.st = 'done'; q.n = q.need;
      const SAY = D.QUEST_SAY[role], W = [D.QUESTS[key].name, root.SIMX.rwLine(q.rw), D.QUESTS[key].thanks, ...SAY.done, ...SAY.thanks].filter(Boolean), said = () => S.talk.pages.some((p) => W.some((v) => p.includes(v)));
      const met = S.meta.keeperMet; if (news) { S.meta.keeperMet = 0; R.away = 5; R.townDeep = 3; }
      const T = talkTo(R, role); if (news) S.meta.keeperMet = met; if (!T || !T.act || T.act.k !== 'turn') { out.push('quest turn-in: the ' + role + '\'s talk does not offer it'); continue; }
      if (news && (T.pages[T.pages.length - 1] !== D.KEEPER.away[D.KEEPER.away.length - 1] || !T.pages.includes(D.KEEPER.first[0]))) out.push('quest turn-in: the Keeper\'s news is not what the button\'s page tells');
      for (let i = 0; i < 8 && S.screen === 'talk' && q.st !== 'turned'; i++) { if (said()) { out.push('quest turn-in: the ' + role + ' says it before the button'); break; } step(S, { keys: ['KeyE'] }); }
      if (q.st !== 'turned' || S.screen !== 'talk' || !said()) out.push('quest turn-in: the ' + role + ' does not say it once pressed');
      else if (!S.talk.pages.some((p) => p.includes(root.SIMX.rwLine(q.rw)))) out.push('quest turn-in: the ' + role + ' gives no reward once pressed' + (news ? ' (with news)' : '')); step(S, { keys: ['Escape'] }); }
    // TASKS 1026: a boss slain deals a batch of offers more, to townsmen with none waiting; T reads the scroll on a floor
    R = run(93); const o0 = offersOf(R).length; R.bossN = 1; const o1 = offersOf(R); if (o1.length <= o0 || o1.slice(o0).some((o) => o1.slice(0, o0).some((p) => p.from === o.from && !p.q))) out.push('quest give: no fresh batch of offers after a boss');
    enterFloor(S, R, 1); S.screen = 'play'; R.en = []; step(S, { keys: [] }); step(S, { keys: ['KeyT'] }); if (!R.hero.read) out.push('scroll: T does not read the scroll of return');
    // the journal (TASKS 1023): J opens it over play, lists the run's quests done first, a click picks one, J closes it
    R = run(91); R.quests = []; const a = takeQuest(S, R, newQuest(R, 'cull', 2, 'smith')), b2 = takeQuest(S, R, newQuest(R, 'descent', 3, 'porter')); b2.st = 'done';
    S.screen = 'play'; step(S, { keys: [] }); step(S, { keys: ['KeyJ'] }); if (S.screen !== 'journal') out.push('journal: J does not open it');
    else { const L0 = journalOf(R), r1 = UI.journal(L0.length).r[1]; if (L0[0] !== b2 || L0[1] !== a) out.push('journal: a done quest is not listed first');
      step(S, { keys: [], click: 1, px: r1.x + 10, py: r1.y + 10 }); if (S.jsel !== a.id) out.push('journal: a click does not pick a quest');
      step(S, { keys: ['KeyJ'] }); if (S.screen !== 'play') out.push('journal: J does not close it'); }
    return out;
  }
  const scrolls = (h) => h.bag.reduce((n, it) => n + (it && it.b === 'scroll' ? it.n : 0), 0);
  // TASKS 1033: the notice board lists what the townsfolk offer and a quest is taken from it; a blow at a townsman makes him answer
  // and a hen run, harming neither; the scroll's hint comes once, the first time a town run's hero falls low with a scroll in the bag
  function townLoopCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 5, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, m = R.map; step(S, { keys: [] });
    const B = boardOffers(R); if (!B.length) out.push('board: nothing on offer on a new run');
    h.x = m.town.svc.board.x; h.y = m.town.svc.board.y + 34; step(S, { keys: [] }); step(S, { keys: ['KeyE'] });
    if (S.screen !== 'board') out.push(`board: E at the notice board does not open it (${S.screen})`);
    else { const U = UI.board(B.length), b = U.r.find((q) => q.id === 'take:0'), n0 = (R.quests || []).length; step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 });
      if ((R.quests || []).length !== n0 + 1 || boardOffers(R).length !== B.length - 1) out.push('board: its button does not take the quest'); step(S, { keys: ['Escape'] }); if (S.screen !== 'play') out.push('board: Esc does not close it'); }
    const F = folkOf(R), g = F.find((f) => f.role === 'guard'), hen = F.find((f) => f.role === 'hen');
    for (const o of F) if (o !== g) o.x += 3000; h.x = g.x - 30; h.y = g.y; const hp0 = h.hp; S.ev = []; hitFolk(S, R, h.x, h.y, 60, 0, 2);
    if (g.hitT !== S.t || !S.ev.some((e) => e.k === 'say' && e.ouch)) out.push('folk: a townsman struck does not answer the blow');
    for (const o of F) if (o !== g) o.x -= 3000;
    for (const o of F) if (o !== hen) o.x += 3000; h.x = hen.x - 20; h.y = hen.y; S.ev = []; hitFolk(S, R, h.x, h.y, 60, 0, 2); const x0 = hen.x, y0 = hen.y;
    for (let i = 0; i < 60; i++) step(S, { keys: [] }); if (hen.scareT === undefined || Math.hypot(hen.x - x0, hen.y - y0) < 10 || h.hp !== hp0) out.push('folk: a hen struck does not run');
    for (const o of F) if (o !== hen) o.x -= 3000;
    const T = spawn(0, {}); T.run = newRun(T, 'campaign', 5, { town: 1, allFree: 1 }); T.screen = 'play'; const Q = T.run; enterFloor(T, Q, 1); Q.en = []; step(T, { keys: [] });
    if (!Q.hero.bag.some((it) => it && it.b === 'scroll')) Q.hero.bag[5] = { b: 'scroll', n: 1, id: Q.nextId++ };
    Q.hero.hp = 5; for (let i = 0; i < 30; i++) step(T, { keys: [] }); const tip = Q.msg && Q.msg.tip === 'scroll';
    Q.msg = null; for (let i = 0; i < 30; i++) step(T, { keys: [] }); if (!tip || !T.meta.tipScroll || (Q.msg && Q.msg.tip === 'scroll')) out.push('scroll: the hint at low health does not come once');
    return out; }
  function questCheck() {
    const out = [], S = spawn(0, {}); S.run = newRun(S, 'campaign', 91, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero;
    const cull = takeQuest(S, R, newQuest(R, 'cull', 2, 'smith')), eli = takeQuest(S, R, newQuest(R, 'elites', 1, 'guard')), sw = takeQuest(S, R, newQuest(R, 'sweep', 1, 'keeper')), dsc = takeQuest(S, R, newQuest(R, 'descent', 3, 'keeper'));
    enterFloor(S, R, 1); const foe = (o = {}) => { const e = R.en.find((q) => q.deadT < 0 && !D.BOSSES[q.type] && counted(q) && (o.elite === undefined || !!q.elite === o.elite)); if (e) killEnemy(S, R, e); return e; };
    foe(); if (cull.n) out.push('quest: a kill above the quest\'s floor counts');
    enterFloor(S, R, 2); const n0 = eli.n; foe({ elite: false }); if (cull.n !== 1 || eli.n !== n0) out.push(`quest: a kill counts wrong (cull ${cull.n}, elite hunt ${eli.n - n0})`);
    for (let i = 0; i < 40 && cull.st === 'taken'; i++) if (!foe()) break; if (cull.st !== 'done' || cull.n !== cull.need) out.push(`quest: the cull is not done at its need (${cull.n}/${cull.need})`);
    sw.n = 0; sw.st = 'taken'; const r0 = R.en.find((q) => q.deadT < 0 && counted(q) && q.room >= 0), s0 = sw.n; if (r0) for (const e of R.en.filter((q) => q.room === r0.room && q.deadT < 0 && counted(q))) killEnemy(S, R, e);
    if (r0 && sw.n !== s0 + 1) out.push('quest: a room cleared to the last foe does not count');
    enterFloor(S, R, 3); if (dsc.st !== 'done') out.push('quest: reaching the floor does not complete the descent');
    const g0 = scrolls(h); if (turnIn(S, R, cull)) out.push('quest: turned in outside the town');
    // TASKS 1033: scrolls of return in place of gold, and the experience of the hero's level at the turn-in
    enterFloor(S, R, 0, undefined, 'up'); const x0 = h.xp, l0 = h.lvl, sh0 = S.meta.shards; if (!turnIn(S, R, cull) || !cull.rw.scroll || scrolls(h) !== g0 + cull.rw.scroll || (h.xp === x0 && h.lvl === l0)) out.push('quest: the turn-in does not pay its scrolls and XP');
    if (cull.rw.xp !== D.questReward(['xp'], cull.f, l0).xp) out.push(`quest: the turn-in's XP is not of the hero's level (${cull.rw.xp})`);
    if (turnIn(S, R, cull) || scrolls(h) !== g0 + cull.rw.scroll) out.push('quest: a quest is turned in twice');
    if (!turnIn(S, R, dsc) || S.meta.shards !== sh0 + dsc.rw.shards) out.push('quest: the turn-in does not pay its shards');
    // PR 23 review: with no stack left to join, the reward's scrolls are a whole bag item (its rarity read by the bag's frame)
    h.bag = h.bag.map((b) => (b && b.b === 'scroll' ? null : b)); cull.st = 'done'; turnIn(S, R, cull);
    { const sc = h.bag.find((b) => b && b.b === 'scroll'); if (!sc || !D.RARITY[sc.rar] || !sc.id || !sc.mods) out.push('quest: the reward\'s scrolls in an empty bag are not a whole item'); }
    enterFloor(S, R, 4); eli.n = eli.need - 1; const el = R.en.find((q) => q.deadT < 0 && !D.BOSSES[q.type] && counted(q)); if (el) { el.elite = 1; killEnemy(S, R, el); }
    const bag0 = h.bag.filter(Boolean).length; if (eli.st === 'done') { enterFloor(S, R, 0, undefined, 'up'); turnIn(S, R, eli); if (h.bag.filter(Boolean).length !== bag0 + 1 || !eli.rw.got) out.push('quest: the reward item does not reach the bag'); } else out.push('quest: no elite to hunt');
    const P = JSON.parse(JSON.stringify(persist(S))); if (!P.run.quests || P.run.quests.length !== 4 || JSON.stringify(P.run.quests).length > 2000) out.push('quest: the quests do not travel in the save, or bloat it');
    return out;
  }
  function useItemCheck(S, R, i, out) { useItem(S, R, i); if (R.hero.read || !S.ev.some((e) => e.k === 'nope' && e.s === 'В городе свиток не нужен')) out.push('climb: a scroll is read in the town'); }
  function townCheck() {
    const out = [], press = (S, b) => step(S, { keys: [], click: 1, px: b.x + 10, py: b.y + 10 });
    for (let sd = 1; sd <= 8; sd++) { const m = DG.genTown(sd * 977), go = (k) => m.cells[k] === 1, at = (o) => Math.floor(o.y / TILE) * m.W + Math.floor(o.x / TILE);
      const seen = new Uint8Array(m.W * m.H), q = [at(m.spawn)]; seen[q[0]] = 1;
      for (let i = 0; i < q.length; i++) for (const d of [1, -1, m.W, -m.W]) { const n = q[i] + d; if (!seen[n] && go(n)) { seen[n] = 1; q.push(n); } }
      if (!go(at(m.spawn))) out.push(`town ${sd}: the hero spawns off the floor`);
      if (!seen[at(m.exit)]) out.push(`town ${sd}: the stairs down are out of reach`);
      if (m.enemies.length || m.traps.length || m.floor !== 0 || !m.town) out.push(`town ${sd}: not a safe floor 0`);
      // TASKS 1003: every service on the plan, a body two cells wide walks from the spawn to where each is used, the rails run from
      // the adit to the mason's yard, off the square and clear of the gate (TASKS 1151), every townsperson stands on open floor
      const ok = DG.townWalk(m), wc = ok.map((v) => (v ? 1 : 0)), use = Object.entries(m.town.use);
      for (const k of ['stairs', 'shop', 'altar', 'stash', 'anvil', 'lectern', 'board', 'portal', 'fire', 'exitGate']) if (!m.town.use[k]) out.push(`town ${sd}: no ${k} on the plan`);
      const far = DG.narrowTo(wc, m.W, m.H, at(m.spawn), use.map(([, [x, y]]) => y * m.W + x));
      for (const k of far) out.push(`town ${sd}: ${use.find(([, [x, y]]) => y * m.W + x === k)[0]} out of a two-cell-wide walk from the spawn`);
      if (m.town.rails.some((k) => m.cells[k] !== 1 || (Math.floor(k / m.W) < 26 && k % m.W < 42))) out.push(`town ${sd}: the rails leave the bottom wall or run into rock`);
      { const [rx, ry] = [m.town.rails[0] % m.W, Math.floor(m.town.rails[0] / m.W)], e = m.town.rails[m.town.rails.length - 1], g = DG.TOWN.exitGate[0];
        if (rx !== DG.TOWN.adit[0] || ry !== DG.TOWN.adit[1]) out.push(`town ${sd}: the rails do not start under the adit`);
        if (m.town.rails.some((k) => Math.abs(k % m.W - g) < 8)) out.push(`town ${sd}: the rails run by the gate`);
        if (!m.town.yardSolid.some((p) => Math.floor(p.y / TILE) === Math.floor(e / m.W) && Math.floor(p.x / TILE) === e % m.W - 1)) out.push(`town ${sd}: the rails end short of the mason's yard`); }
      for (const n of m.town.npcs) if (!ok[at(n)]) out.push(`town ${sd}: the ${n.role} stands off the open floor`);
      if (sd > 1 && JSON.stringify(m.decor) === JSON.stringify(DG.genTown(977).decor)) out.push('town: the seed does not vary the decor'); }
    // TASKS 1149: the town's gate out asks first (E and Esc stay), then gives the run up; past the colossus it ends it won
    { const G = spawn(0, {}); press(G, UI.menu(false).find((b) => b.id === 'campaign')); if (G.screen === 'classes') press(G, UI.classes().find((b) => b.id === 'go')); noWelcome(G); const Q = G.run, g = Q.map.town.svc.exitGate, go = UI.leave().r[0];
      const ask = () => { Q.hero.x = g.x; Q.hero.y = g.y; step(G, { keys: [] }); step(G, { keys: ['KeyE'] }); return G.screen === 'leave'; };
      if (!ask()) out.push('town gate: E at the gate opens no window');
      else { step(G, { keys: ['KeyE'] }); if (G.screen !== 'play' || G.run !== Q) out.push('town gate: E in its window ends the run');
        ask(); if (G.focus !== 'stay') out.push('town gate: the window opens with «Сдаться» in focus');
        step(G, { keys: ['Enter'] }); if (G.screen !== 'play' || G.run !== Q) out.push('town gate: Enter gives the run up with «Остаться» in focus (TASKS 1854)');
        ask(); step(G, { keys: [], click: 1, px: go.x + 10, py: go.y + 10 }); if (G.screen !== 'dead' || !G.result.abandoned) out.push('town gate: «Сдаться» does not give the run up'); }
      press(G, UI.end()[0]); if (G.screen === 'dead') G.screen = 'menu'; press(G, UI.menu(false).find((b) => b.id === 'campaign')); if (G.screen === 'classes') press(G, UI.classes().find((b) => b.id === 'go')); noWelcome(G); const Q2 = G.run;
      if (Q2) { Q2.slain = [D.RUNS.campaign.floors]; Q2.deepest = D.RUNS.campaign.floors; const w0 = G.meta.wins || 0; Q2.hero.x = g.x; Q2.hero.y = g.y; step(G, { keys: [] }); step(G, { keys: ['KeyE'] }); step(G, { keys: ['Enter'] });
        if (G.screen !== 'play' || G.run !== Q2) out.push('town gate: past the colossus Enter ends the run with «Остаться» in focus');
        step(G, { keys: ['KeyE'] }); step(G, { keys: ['ArrowLeft'] }); step(G, { keys: ['Enter'] });
        if (G.screen !== 'win' || G.meta.wins !== w0 + 1) out.push('town gate: past the colossus the gate does not end the run won'); } }
    // TASKS 1600, 1601: E at the stairs takes them with a townsman in earshot; a shot draws a townsman's reaction
    { const G = spawn(0, {}); press(G, UI.menu(false).find((b) => b.id === 'campaign')); if (G.screen === 'classes') press(G, UI.classes().find((b) => b.id === 'go')); noWelcome(G); const Q = G.run, h = Q.hero, e = Q.map.exit; step(G, { keys: [] }); const gd = Q.folk.find((f) => f.role === 'guard');
      h.x = gd.x - 100; h.y = gd.y; heroShot(Q, h, 0, 1, false, 'bolt'); for (let i = 0; i < 60 && (gd.hitT ?? -9) < 0; i++) step(G, { keys: [] }); if ((gd.hitT ?? -9) < 0) out.push('town: a shot goes through a townsman with no reaction');
      h.x = e.x; h.y = e.y + 40; gd.x = h.x + 30; gd.y = h.y; step(G, { keys: ['KeyE'] }); if (G.screen === 'talk' || G.run.floor !== 1) out.push(`town: E at the stairs does not go down (${G.screen}, floor ${G.run.floor})`); }
    // a run saved in the town before the yard loads, plays on, and gets the new town
    { const G = spawn(0, {}); press(G, UI.menu(false).find((b) => b.id === 'campaign')); if (G.screen === 'classes') press(G, UI.classes().find((b) => b.id === 'go')); noWelcome(G); step(G, { keys: [] }); G.saved = G.run; G.run = null; G.screen = 'menu';
      const P = JSON.parse(JSON.stringify(persist(G))); delete P.run.map.town.yardSolid; delete P.run.cart; const O = spawn(1, P), Q = O.saved; O.run = Q; O.saved = null; O.screen = 'play'; let threw = null;
      try { for (let i = 0; i < 30; i++) step(O, { keys: [] }); } catch (e) { threw = e; }
      if (threw) out.push(`town: an old save breaks on load (${threw.message})`); else if (!O.run.map.town.yardSolid || !O.run.folk.some((f) => f.role === 'mason')) out.push('town: an old save keeps the old town'); }
    // TASKS 1425, 1426: a hero on the rails is pushed once the wait is over and the cart keeps rolling; stacks dropped on a stack join it
    { const G = spawn(0, {}); press(G, UI.menu(false).find((b) => b.id === 'campaign')); if (G.screen === 'classes') press(G, UI.classes().find((b) => b.id === 'go')); noWelcome(G); const Q = G.run, h = Q.hero; step(G, { keys: [] }); Object.assign(Q.cart, { s: 200, st: 'down', load: 3 }); let s0 = Q.cart.s;
      for (let i = 0; i < 2400; i++) { const [x, y] = [h.x, h.y]; step(G, { keys: [] }); if (i < 500) { const T = Q.map.town, c = (k) => [(k % Q.map.W + 0.5) * TILE, (Math.floor(k / Q.map.W) + 0.5) * TILE]; let d = Q.cart.s, p = c(T.rails[0]); for (let j = 1; j < T.rails.length; j++) { const A = c(T.rails[j - 1]), B = c(T.rails[j]), l = Math.hypot(B[0] - A[0], B[1] - A[1]); if (d <= l) { p = [A[0] + (B[0] - A[0]) * d / l, A[1] + (B[1] - A[1]) * d / l]; break; } d -= l; p = B; } h.x = p[0] + 10; h.y = p[1]; } else { h.x = x; h.y = y; } if (Q.map.cells[Math.floor(h.y / TILE) * Q.map.W + Math.floor(h.x / TILE)] === 0) { out.push('town cart: pushed the hero into a wall'); break; } }
      if (Q.cart.st === 'down' && Q.cart.s - s0 < 150) out.push(`town cart: rolled only ${(Q.cart.s - s0).toFixed(0)} px past a hero on the rails`);
      const T = SIMX.stashOf(G), cap = D.CONSUMABLES.potion ? 'potion' : Object.keys(D.CONSUMABLES)[0], st = D.CONSUMABLES[cap].stack; T.items = Array(D.STASH.cells).fill(null); T.items[0] = { b: cap, n: 1, id: 900 }; h.bag[0] = { b: cap, n: 1, id: 901 }; SIMX.stashPut(G, Q, 0, 0); if (T.items[0].n !== 2 || h.bag[0]) out.push('stash: a stack dropped on a stack did not join it'); T.items = T.items.map((q, i) => ({ b: cap, n: st, id: 902 + i })); T.items[3].n = st - 1; h.bag[1] = { b: cap, n: 3, id: 903 }; G.ev = []; SIMX.stashPut(G, Q, 1); if (h.bag[1].n !== 2 || G.ev.some((e) => e.k === 'nope')) out.push('stash: a partial move reads as a full chest'); }
    // TASKS 1151: the mason empties the cart stone by stone, the rope hauls it into the adit, and it comes back full
    { const G = spawn(0, {}); press(G, UI.menu(false).find((b) => b.id === 'campaign')); if (G.screen === 'classes') press(G, UI.classes().find((b) => b.id === 'go')); noWelcome(G); const Q = G.run, seen = new Set(), loads = new Set(); Q.hero.x = Q.map.town.svc.portal.x; Q.hero.y = Q.map.town.svc.portal.y;
      step(G, { keys: [] }); let ds = 0; for (let i = 0; i < 9000 && G.screen === 'play'; i++) { const s0 = Q.cart.s; step(G, { keys: [] }); ds = Math.max(ds, Math.abs(Q.cart.s - s0)); seen.add(Q.cart.st); loads.add(Q.cart.load); }
      // TASKS 1616: the cart never leaps; the mason's stops reach what he takes from and drops into; no round runs through a standing torch
      if (ds > 1) out.push(`town cart: moves ${ds.toFixed(1)} px in a tick`);
      { const T = Q.map.town, M = T.npcs.find((n) => n.role === 'mason').route, e = T.rails[T.rails.length - 1], ex = (e % Q.map.W + 0.5) * TILE, ey = (Math.floor(e / Q.map.W) + 0.5) * TILE, tk = M.find((q) => q.act === 'take'), dp = M.find((q) => q.act === 'drop');
        if (Math.hypot(tk.x - ex, tk.y - ey) > 60) out.push('town: the mason stands out of reach of the cart'); if (Math.hypot(dp.x - T.svc.bin.x, dp.y - T.svc.bin.y) > 60) out.push('town: the mason stands out of reach of the bin');
        const torch = Q.map.decor.filter((d) => d.role === 'lamp'), off = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p.x - a.x - dx * k, p.y - a.y - dy * k); };
        for (const n of T.npcs) if (n.route) n.route.forEach((a, i) => { const b = n.route[(i + 1) % n.route.length]; for (const p of torch) if (off(p, a, b) < 22) out.push(`town: the ${n.role}'s round runs through the torch at ${Math.round(p.x)},${Math.round(p.y)}`); }); }
      for (const st of ['at', 'up', 'in', 'down']) if (!seen.has(st)) out.push(`town cart: never ${st}`);
      for (const n of [3, 2, 1, 0]) if (!loads.has(n)) out.push(`town cart: never holds ${n} stones`); }
    const S = spawn(0, {}); press(S, UI.menu(false).find((b) => b.id === 'campaign')); if (S.screen === 'classes') press(S, UI.classes().find((b) => b.id === 'go')); noWelcome(S);
    const R = S.run; if (!R || R.floor !== 0 || !R.town || R.mode !== 'campaign' || S.screen !== 'play') { out.push('town: «Кампания» does not start in the town'); return out; }
    const h = R.hero, hp = h.hp, x0 = h.x;
    if (R.en.length || R.msg.s !== TXT('data_runs.placeName')) out.push('town: monsters in the town or no title');
    if (R.seen.some((v) => !v)) out.push('town: fog of war over the town');
    hurtHero(S, R, 50, h.x, h.y); if (h.hp !== hp) out.push('town: the hero takes damage in the town');
    for (let i = 0; i < 60; i++) step(S, { right: 1, keys: [] }); if (h.x < x0 + 40) out.push('town: the hero does not walk');
    step(S, { press: 1, keys: [] }); for (let i = 0; i < 40; i++) step(S, { keys: [] }); if (h.atkN !== 1) out.push('town: the hero does not swing');
    step(S, { keys: ['KeyI'] }); if (S.screen !== 'inv') out.push('town: the bag does not open'); step(S, { keys: ['Escape'] });
    step(S, { keys: ['Escape'] }); if (S.screen !== 'pause') out.push('town: no pause');
    press(S, UI.pause().find((b) => b.id === 'save')); if (S.screen !== 'menu' || !(S.t - (S.savedT ?? -9) < 0.1)) out.push('save: «Сохранить и выйти» does not say on the menu that it saved (TASKS 1863 б)');
    const T = spawn(1, JSON.parse(JSON.stringify(persist(S))));
    press(T, UI.menu(true).find((b) => b.id === 'continue'));
    const R2 = T.run; if (!R2 || R2.floor !== 0 || !R2.town || !R2.map.town || T.screen !== 'play') { out.push('town: a run saved in the town does not go on there'); return out; }
    for (let i = 0; i < 30; i++) step(T, { keys: [] });
    R2.hero.x = R2.map.exit.x; R2.hero.y = R2.map.exit.y; interact(T, R2);
    if (R2.floor !== 1 || R2.town || R2.map.town || !R2.en.length) out.push('town: the stairs do not lead down to the 1st floor');
    if (runCompletion(R2).floors !== 1) out.push('town: the town counts as a floor of the run');
    // TASKS 1863 и: a death on the 1st floor has passed none, a step down passes the one above, a win passes the deepest too
    if (runCompletion(R2, 'dead').passed !== 0) out.push(`end: a death on the 1st floor counts ${runCompletion(R2, 'dead').passed} floors passed`);
    { const R3 = { stats: Object.assign({}, R2.stats, { 2: R2.stats[1] }) }; if (runCompletion(R3, 'dead').passed !== 1 || runCompletion(R3, 'win').passed !== 2) out.push('end: the floors passed do not count the ones left behind'); }
    // TASKS 1006: down the stairs the hero is as he left the town; a death and a win show their results and lead back to the town
    // with a new hero and the meta kept; a saved run in the town stays small
    { const S2 = spawn(0, {}); S2.meta.shards = 40; startRun(S2, 'town'); const Q = S2.run, h2 = Q.hero; h2.gold = 321; h2.bag[5] = Object.assign(rollItem(Q, 1, 0, 'ring'), { id: Q.nextId++ });
      const size = JSON.stringify(persist(S2)).length; if (size > 120000) out.push(`town: a run saved in the town takes ${size} bytes`);
      const want = JSON.stringify([h2.lvl, h2.gold, h2.eq, h2.bag]); h2.x = Q.map.exit.x; h2.y = Q.map.exit.y; interact(S2, Q);
      if (Q.floor !== 1 || JSON.stringify([h2.lvl, h2.gold, h2.eq, h2.bag]) !== want) out.push('town: the hero changes on the way down');
      for (const how of ['dead', 'win']) { const shards = S2.meta.shards; if (how === 'win') { startRun(S2, 'town'); const Q2 = S2.run; Q2.hero.x = Q2.map.exit.x; Q2.hero.y = Q2.map.exit.y; interact(S2, Q2); }
        endRun(S2, how); if (S2.screen !== how || !S2.result.town) { out.push(`town: no ${how} screen for a run through the town`); continue; }
        const b = UI.end(S2.result.log, S2.result.town).find((q) => q.id === 'again'); if (b.label !== TXT('UI.end.2')) out.push(`town: the ${how} screen does not offer the town`);
        press(S2, b); if (S2.screen === 'classes') press(S2, UI.classes().find((q) => q.id === 'go')); const Q3 = S2.run;
        if (!Q3 || Q3.floor !== 0 || !Q3.town || S2.screen !== 'play' || Q3.hero.lvl !== 1 || Q3.hero.gold !== 0 || Q3.hero.bag.filter(Boolean).length !== 2 || !Q3.hero.bag.some((it) => it && it.b === 'scroll')) out.push(`town: after a ${how} the hero does not start anew in the town`);
        if (S2.meta.shards < shards) out.push(`town: the meta loses shards after a ${how}`); } }
    return out;
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
      // onto it and lets it go, the leap carries him back from the aim, AGI (not STR) grows his bow's damage, a sword is not his
      { const { S, R, h, foe, ok } = arena('archer');
        if (h.eq.weapon.b !== 'shortbow' || h.eq.armor.b !== 'leather_armor' || D.clsOf(h).abs.map((a) => a.id).join() !== 'volley,trap,leap') out.push('class archer: not a short bow, leather and volley, trap, leap');
        if (ok) { const e = foe(200); let got = 0; h.mp = 0; for (let i = 0; i < 60; i++) { h.mp = 0; e.x = h.x + 200; e.y = h.y; e.st = 'idle'; step(S, { keys: [], press: i < 20 ? 1 : 0, ...toPx(R, e.x, e.y - 30) }); if (h.mp >= D.CLASSES.archer.hitMp.hit) got = 1; }
          if (!(e.hp < e.max)) out.push('class archer: his bow does not hit a foe out of reach');
          if (!got) out.push('class archer: his arrows that hit give no mana');
          R.en = []; R.proj = []; h.lvl = 4; h.ab.trap = 1; h.ab.leap = 1; h.mp = 500; h.aim = 0; for (const k in h.cd) h.cd[k] = 0;
          h.mx = h.x + 400; h.my = h.y - 30; castAbility(S, R, 'volley', {}); if (R.proj.filter((p) => p.k === 'arrow' && p.own === 'hero').length !== D.VOLLEY.n) out.push('class archer: the volley does not loose its fan');
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
        if (!(a1 > a0) || a2 !== a0) out.push('class archer: AGI does not grow his bow\'s damage or STR does');
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

  // TASKS 1881: a full pool keeps the potion and says why; with a power on the drink only a second press within a second drinks it
  function potionCheck() {
    const out = [], run = (cls) => { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 777, { cls }); S.screen = 'play'; S.t = S.run.t = 10; const R = S.run, h = R.hero, M = heroSt(S); h.hp = M.maxHp; h.mp = M.maxMp; h.bag.fill(null); h.bag[0] = potion('hp_potion', 3); h.bag[1] = potion('mp_potion', 3); S.ev = []; return { S, R, h }; };
    const left = (h, b) => h.bag.filter((it) => it && it.b === b).reduce((n, it) => n + it.n, 0), said = (S) => S.ev.filter((e) => e.k === 'nope' && e.s).length;
    for (const [cls, b] of [['warrior', 'hp_potion'], ['mage', 'mp_potion']]) { const { S, R, h } = run(cls); usePotion(S, R, b); usePotion(S, R, b);
      if (left(h, b) !== 3) out.push(`potion: a ${cls} at a full pool spent ${3 - left(h, b)} ${b}`); if (said(S) !== 2) out.push(`potion: a ${cls}'s ${b} at a full pool kept without a reason`); }
    { const { S, R, h } = run('warrior'); h.hp -= 10; usePotion(S, R, 'hp_potion'); if (left(h, 'hp_potion') !== 2) out.push('potion: a hurt hero cannot drink'); }
    const T = '__potion'; D.POWERS[T] = { trig: 'potion', fx: 'mana', v: 0 };
    try { const { S, R, h } = run('warrior'); h.powers = { [T]: 1 }; R.town = 0; usePotion(S, R, 'hp_potion');
      if (left(h, 'hp_potion') !== 3) out.push('potion: with a power on the drink the first press at full health drinks');
      S.t += 1.5; usePotion(S, R, 'hp_potion'); if (left(h, 'hp_potion') !== 3) out.push('potion: a press 1.5 s after the first still drinks for the power');
      S.t += 0.5; usePotion(S, R, 'hp_potion'); if (left(h, 'hp_potion') !== 2 || !S.ev.some((e) => e.k === 'power' && e.id === T)) out.push('potion: the second press within a second does not drink for the power'); }
    finally { delete D.POWERS[T]; }
    return out;
  }

  // TASKS 1882: the page's away flag (a lost window, a hidden tab) pauses a run as Esc does, and leaves other screens and the demo alone
  function awayCheck() {
    const out = [], play = () => { const S = spawn(0, {}); S.run = newRun(S, 'campaign', 5); S.screen = 'play'; S.t = S.run.t = 10; return S; };
    { const S = play(); step(S, { keys: [], away: 1 }); if (S.screen !== 'pause' || S.pauseAsk) out.push(`away: a run in play goes to ${S.screen}, not the pause`); }
    { const S = play(); step(S, { keys: [], away: 1 }); for (let i = 0; i < 60; i++) step(S, { keys: [] }); if (S.screen !== 'pause') out.push('away: the pause does not hold after the flag'); }
    { const S = play(); S.screen = 'inv'; step(S, { keys: [], away: 1 }); if (S.screen !== 'inv') out.push(`away: the hero's page turns into ${S.screen}`); }
    { const S = spawn(0, {}); step(S, { keys: [], away: 1 }); if (S.screen !== 'menu') out.push(`away: the menu turns into ${S.screen}`); }
    { const S = play(); S.demo = 1; step(S, { keys: [], away: 1 }); if (S.screen !== 'play') out.push('away: the attract demo pauses'); }
    return out;
  }

  const powerCheck = () => { const out = []; SIMX.checkPowers(out); return out; };
  const uiCheck = () => { const out = []; SIMX.checkReview57(out); return out; };
  const PARTS = { menuCheck, genCheck, playCheck, secretCheck, altarCheck, secretRestCheck, potionCheck, awayCheck, townCheck, folkCheck, climbCheck, wayCheck, shopTownCheck, soulAltarCheck, stashCheck, masteryCheck, bagCheck, pouchCheck, craftCheck, talkCheck, noteChainCheck, captiveFallbackCheck, questCheck, questGiveCheck, levelCheck, townLoopCheck, classCheck, powerCheck, uiCheck, floorModCheck, cacheGenCheck, propCheck, reactionCheck, meleeSpacingCheck, hazardCheck, floorTypeCheck, floorBlendCheck, branchCheck, lootLevelCheck, magmaKindsCheck, chestCheck };
  const selfCheck = (names = Object.keys(PARTS)) => names.flatMap((k) => PARTS[k]());
  Object.assign(root.SIM, { selfCheck, selfChecks: Object.keys(PARTS) });
})(typeof window !== 'undefined' ? window : globalThis);
