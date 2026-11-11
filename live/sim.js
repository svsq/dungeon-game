// live/sim.js — deterministic dungeon-crawler simulation, fixed 120 Hz. Contract: create / step / at / spawn / respawn /
// outOfPlay / scriptInput (engine.md §6). Everything that happens lives here: menus, the run (procedural floors), the hero
// (stats, gear, abilities, levelling), monsters (FSM + flow-field chase), loot, traps, saves (S.saveN asks index.html to
// persist S.meta and the run), camera, and the event bus S.ev that drives every FX in the scene.
(function (root) {
  if (typeof module !== 'undefined') for (const f of require('./modules.js').parts.sim) require('./' + f);
  const SIMX = root.SIMX, {
    overLava, ARROW_Y, CRUST, D, DEMO_SEED, DOOM, DT, ENEMIES, FOLK_OUCH, HINT, K, L, LOOT, REWARD, RIG, TILE, UI, VIEW, VIEW_H, viewFor, setView, uiDy, atBoard, atCounter, atCraft,
    atExitGate, atGate, atSoulAltar, atStash, boardOffers, brinkOf, canDonate, cell, chasm, completion, completionHints, craftCost, craftItem, crustAt,
    campaignDone, damageName, debugSecrets, dep, doorLock, exitKind, doorNear, enterFloor, ev, flightReach, flow, folkNear, fstat, gateNear, gateWays, gift,
    noteNear, captiveNear, shopShut, craftShut, giveQuest, hand, hidden, hitProps, isCons, itemIcon, itemMods, itemName, journalOf, keeperPages, killEnemy, leverNear,
    lootAudit, losClear, newQuest, newRun, offerOf, offersOf, openChest, openDoor, openSecret, pullLever, questFloor, questIcon, questLine,
    questMark, questMarks, questOn, questPlace, questTalk, rebalanceRun, rebuildArrival, rollItem, runCompletion, runReward, rwLine,
    secretMask, serpentMouth, springAmbush, stashOf, stats, stepBossMove, stepLen, stepPlay, stepUI, stockShop, storyStep, takeQuest, toPx,
    tradeDepth, turnIn, typeMods } = SIMX;
  // ---------------- top level ----------------
  function create() {
    // the attract demo: floor 1 of a fixed seed, a level-3 hero next to the first fight, driven by a scripted bot
    const S = base(); S.demo = 1; S.screen = 'play'; S.run = newRun(S, 'campaign', DEMO_SEED);
    const R = S.run, h = R.hero; h.lvl = 3; h.ab.fireball = 1; h.base.str += 4; const st = stats(h, S.meta); h.hp = st.maxHp; h.mp = st.maxMp;
    const room = R.map.rooms[R.map.start]; for (const e of R.en) e.hp = Math.min(e.hp, 40);
    R.msg = null; S.ev = []; S.saveN = 0; void room;
    return S;
  }
  function base() { return { t: 0, steps: 0, wt0: 0, ev: [], screen: 'menu', hover: '', meta: { shards: 0, up: {}, runs: 0, wins: 0, best: 0 }, run: null, saved: null, saves: Array(D.SAVE_SLOTS).fill(null), slot: 0,
    saveN: 0, result: null, demo: 0, seedBase: 1, prevKeys: {} }; }
  // play start: the menu, with the persisted meta progress and the saved run (index.html reads localStorage)
  const spawn = (worldT, persist = {}) => { const S = base(); S.wt0 = worldT; S.seedBase = (Math.floor(worldT * 1000) % 100000) + 1;
    if (persist.meta) S.meta = Object.assign(S.meta, persist.meta, { up: Object.assign({}, persist.meta.up || {}) });
    // the «Мешок» ranks of 1340 (+3 cells each) become pouches, one for every two ranks bought (TASKS 1687)
    if (S.meta.up.bag) { S.meta.up.pouch = Math.max(S.meta.up.pouch || 0, Math.min(D.BAG.max, Math.ceil(S.meta.up.bag / 2))); delete S.meta.up.bag; } if (S.meta.zoom !== undefined) S.meta.zoom = D.zoomFix(S.meta.zoom); SIMX.statsOf(S); if (persist.run && persist.run.map) { S.saved = persist.run; rebalanceRun(S.saved); SIMX.migrateSecrets(S.saved); SIMX.regate(S.saved); S.t = Math.max(S.t, persist.run.t || 0) + DT; }
    SIMX.loadSaves(S, persist); fitBag(S, S.saved); return S; };
  // a run saved before a pouch was bought gets the pouch's empty cells on the end of its bag; nothing in it moves
  const fitBag = (S, R) => { const B = R && R.hero && R.hero.bag; if (!B) return; for (let n = D.bagLen(S.meta.up); B.length < n;) B.push(null); };
  const respawn = (S) => S;
  const outOfPlay = () => false;

  const REPEATS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'PageUp', 'PageDown']);
  function step(S, inp = {}) {
    if (!inp.press) S.eatPress = 0; else if (!S.pressWas && S.screen !== 'play') S.eatPress = 1;
    S.pressWas = !!inp.press;
    rebalanceRun(S.run); rebalanceRun(S.saved); fitBag(S, S.run); fitBag(S, S.saved); if (inp.now && S.run && !S.demo) S.run.at = inp.now; if (S.run && S.run.map) fstat(S.run); if (S.run && !S.demo) S.run.zoom = S.meta.zoom;
    const t = S.t + DT; S.t = t;
    const keys = {}; for (const k of inp.keys || []) keys[k] = 1;
    // a held key's repeats only walk a list (review of PR 57): every other key acts once a press, or a held M or L flips on each repeat
    for (const k of inp.rep || []) if (REPEATS.has(k)) keys[k] = 1;
    // the pointer is followed in play too, or the first window after play takes a pointer at rest for one that moved. The page says
    // itself whether it moved (review of PR 57): a resize puts a still pointer on other view px, and that must not take the focus
    inp = Object.assign({}, inp, { moved: inp.moved !== undefined ? !!inp.moved : !S.ptr || S.ptr[0] !== inp.px || S.ptr[1] !== inp.py }); S.ptr = [inp.px, inp.py];
    // and once in the frame of the window it is over, for the window's hit tests and the HUD's notes alike
    S.uiPtr = [inp.px, inp.py - uiDy(S.screen)];
    // M mutes from any screen (TASKS 1853 а): kept in the meta so the HUD can say so and the settings' volume sits beside it
    if (keys.KeyM && !S.demo) { S.meta.mute = S.meta.mute ? 0 : 1; S.muteT = t; S.saveN++; }
    if (S.screen === 'play' && S.run) {
      S.uiWas = 'play'; S.uiKey = 'play'; SIMX.commitDraft(S);
      if (keys.Backquote && !S.demo) S.debug = !S.debug;
      const dbg = S.debug && !S.demo ? D.hitUI(UI.debug(S.run, S), inp.px, inp.py) : null; if (S.debug) S.hover = dbg ? dbg.id : '';
      if (dbg) { if (inp.click) { if (dbg.id === 'dbg_secrets') debugSecrets(S, S.run); else S.dbgLoot = !S.dbgLoot; ev(S, { k: 'ui', x: inp.px, y: inp.py }); } inp = Object.assign({}, inp, { press: 0, click: 0 }); }
      // L folds the map's legend or keeps it open (TASKS 1794); it opens by itself for the first 10 s on a floor
      if (keys.KeyL && !S.demo) { const R = S.run, open = R.mapLeg === 1 || (S.t - (R.enteredT ?? -1e9) < 10 && !((R.legCut ?? -1e9) >= (R.enteredT ?? -1e9))); R.mapLeg = open ? 0 : 1; if (open) R.legCut = S.t; }
      if (keys.Escape && !S.demo) { S.screen = 'pause'; S.pauseAsk = 0; }
      else if ((keys.KeyI || keys.KeyC || keys.Tab) && !S.demo) { S.screen = 'inv'; }
      else if (keys.KeyJ && !S.demo) { S.screen = 'journal'; S.hover = ''; ev(S, { k: 'ui', x: inp.px, y: inp.py }); }
      else { stepPlay(S, inp, keys); if (S.run && !S.run.frozen) stepBossMove(S, S.run); }
    } else stepUI(S, inp, keys);
    // a window opened in this step draws its notes in its own frame at once (review of PR 57: play → inv put the tip uiDy px off)
    S.uiPtr = [S.ptr[0], S.ptr[1] - uiDy(S.screen)];
    if (S.ev.length > 64) S.ev.splice(0, S.ev.length - 64);
    S.steps++; return S;
  }

  // ---------------- attract bot: walk to the nearest monster through the flow field, swing, throw fire ----------------
  function scriptInput(t, S) {
    const inp = { left: 0, right: 0, up: 0, down: 0, press: 0, click: 0, rclick: 0, px: 960, py: 540, keys: [], slot: 0 };
    const R = S.run; if (!R) return inp; const h = R.hero, m = R.map;
    let tg = null, td = 1e9; for (const e of R.en) { if (e.deadT >= 0) continue; const d = Math.hypot(e.x - h.x, e.y - h.y); if (d < td) { td = d; tg = e; } }
    if (!tg) return inp;
    Object.assign(inp, toPx(R, tg.x, tg.y - 30));
    const reach = 46 + ENEMIES[tg.type].r;
    if (td > reach - 6) {
      const F = flow(m, Math.floor(tg.x / TILE), Math.floor(tg.y / TILE), 1), tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
      let gx = tg.x - h.x, gy = tg.y - h.y;
      if (td > 120 || !losClear(m, h.x, h.y - 6, tg.x, tg.y - 6)) { let best = null;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = F[(ty + ay) * m.W + tx + ax]; if (v >= 0 && (!best || v < best[0])) best = [v, ax, ay]; }
        if (best) { gx = (tx + best[1]) * TILE + 16 - h.x; gy = (ty + best[2]) * TILE + 18 - h.y; } }
      if (Math.abs(gx) > 5) inp[gx > 0 ? 'right' : 'left'] = 1; if (Math.abs(gy) > 5) inp[gy > 0 ? 'down' : 'up'] = 1;
    } else inp.press = 1;
    if (td < 330 && td > 140 && h.cd.fireball <= S.t && h.mp > 30) { const [hx, hy] = hand(h); if (losClear(m, hx, hy + 20, tg.x, tg.y - 10)) inp.slot = 2; }
    if (h.hp < 40) inp.keys.push('KeyQ');
    if (doorNear(R, 60)) inp.keys.push('KeyE');
    return inp;
  }
  const demoCheck = (S) => S.run && S.run.kills >= 3 && S.run.hero.deadT < 0;
  let cache = null;
  function at(t) {
    const loop = Math.floor(t / L), q = t - loop * L, n = Math.round(q / DT);
    if (!cache || cache.loop !== loop || cache.S.steps > n) { const S0 = create(); S0.wt0 = loop * L; cache = { loop, S: S0 }; }
    const S = cache.S; while (S.steps < n) { const inp = scriptInput(S.t, S); step(S, inp); }
    return Object.assign({}, S, { loop, q });
  }
  const persist = (S) => ({ meta: S.meta, run: S.run || S.saved || null, slot: S.slot, saves: S.saves });

  root.SIM = { campaignDone, exitKind, rebuildArrival, FOLK_OUCH, questIcon, atBoard, boardOffers, serpentMouth, flightReach, openSecret, debugSecrets, lootAudit, openChest, DT, ARROW_Y, L, K, VIEW, VIEW_H, viewFor, setView, uiDy, HINT, RIG, create, spawn, respawn, outOfPlay, step, at, scriptInput, demoCheck, persist,
    stepLen, stats, gift, itemName, hitProps, secretMask, hidden, fstat, completion, completionHints, damageName, canDonate, runCompletion, runReward, REWARD, LOOT, itemIcon, itemMods, typeMods, isCons, hand, losClear, rollItem, newRun, enterFloor, cell, flow, atCounter, newQuest, takeQuest, turnIn, questOn, offersOf, offerOf, questFloor, storyStep, questMark, questTalk, giveQuest, questMarks, questLine, questPlace, rwLine, journalOf, folkNear, keeperPages, atSoulAltar, atStash, stashOf, atCraft, craftItem, craftCost, tradeDepth, stockShopFor: (R, f, kind) => stockShop(R, dep(R, f), kind), atGate, gateWays, openDoor, pullLever, doorLock, doorNear, leverNear, springAmbush, crustAt, CRUST, DOOM, chasm, brinkOf, gateNear, killEnemy };
  // what the render may ask the sim (ARCHITECTURE.md §8): reads of the state, never a change to it (fstat fills a memo the step
  // has already filled; at replays the attract demo into its own cache). The render takes nothing else from SIM but constants
  root.SIM.chooseFork = SIMX.chooseFork;
  root.SIM.Q = {
    depOf: dep, at, campaignDone, cell, hidden, itemIcon, stats, chasm, secretMask, mapCut: SIMX.mapCut, stepLen, serpentMouth, doorLock, brinkOf, flightReach, atBoard, atCounter,
    noteNear, captiveNear, shopShut, craftShut, overLava, losClear: SIMX.losClear, atCraft, atExitGate, atGate, atSoulAltar, atStash, boardOffers, canDonate, completionHints, craftCost, craftItem, damageName, doorNear, folkNear,
    exitKind, fstat, gateNear, gateWays, isCons, itemMods, itemName, journalOf, leverNear, secretUnder: SIMX.secretUnder, puzzleNear: SIMX.puzzleNear, lootAudit, questIcon, questLine, questMark, questMarks,
    rwLine, greetHold: SIMX.greetHold, tossedNear: SIMX.tossedNear, stashOf, tradeDepth, typeMods, slotRun: SIMX.slotRun, isFull: SIMX.isFull, oldestSlot: SIMX.oldestSlot };
  Object.assign(SIMX, {
    spawn, step, scriptInput, persist });
  if (typeof module !== 'undefined') { require('./sim_checks.js'); module.exports = root.SIM; }
})(typeof window !== 'undefined' ? window : globalThis);
