// live/sim.js — deterministic dungeon-crawler simulation, fixed 120 Hz. Contract: create / step / at / spawn / respawn /
// outOfPlay (engine.md §6). Everything that happens lives here: menus, the run (procedural floors), the hero
// (stats, gear, abilities, levelling), monsters (FSM + flow-field chase), loot, traps, saves (S.saveN asks index.html to
// persist S.meta and the run), camera, and the event bus S.ev that drives every FX in the scene.
(function (root) {
  if (typeof module !== 'undefined') for (const f of require('./modules.js').parts.sim) require('./' + f);
  const SIMX = root.SIMX, {
    overLava, ARROW_Y, CRUST, D, DOOM, DT, FOLK_OUCH, K, REWARD, RIG, UI, VIEW, viewFor, setView, uiDy, atBoard, atCounter, atCraft,
    atExitGate, atGate, atSoulAltar, atStash, boardOffers, brinkOf, canDonate, cell, chasm, completionHints, craftCost, craftItem, crustAt,
    campaignDone, damageName, debugSecrets, dep, doorLock, exitKind, doorNear, enterFloor, ev, flightReach, flow, folkNear, fillStats, fstat, gateNear, gateWays,
    noteNear, captiveNear, shopShut, craftShut, giveQuest, hand, hidden, hitProps, isCons, itemIcon, itemMods, itemName, journalOf, killEnemy, leverNear,
    lootAudit, losClear, newRun, offersOf, openChest, openDoor, openSecret, pullLever, questIcon, questLine,
    questMark, questMarks, questTalk, rebalanceRun, rebuildArrival, rollItem, runCompletion, rwLine,
    secretMask, serpentMouth, stashOf, stats, stepBossMove, stepLen, stepPlay, stepUI, stockShop,
    tradeDepth, typeMods } = SIMX;
  // ---------------- top level ----------------
  function create() { const S = base(); SIMX.settleStash(S); return S; }
  function base() { return { t: 0, steps: 0, wt0: 0, ev: [], screen: 'menu', hover: '', meta: { shards: 0, up: {}, runs: 0, wins: 0, best: 0 }, run: null, saved: null, saves: Array(D.SAVE_SLOTS).fill(null), slot: 0,
    saveN: 0, result: null, seedBase: 1, prevKeys: {} }; }
  // play start: the menu, with the persisted meta progress and the saved run (index.html reads localStorage)
  const spawn = (worldT, persist = {}) => { const S = base(); S.wt0 = worldT; S.seedBase = (Math.floor(worldT * 1000) % 100000) + 1;
    if (persist.meta) S.meta = Object.assign(S.meta, persist.meta, { up: Object.assign({}, persist.meta.up || {}) });
    // the «Мешок» ranks of 1340 (+3 cells each) become pouches, one for every two ranks bought (TASKS 1687)
    if (S.meta.up.bag) { S.meta.up.pouch = Math.max(S.meta.up.pouch || 0, Math.min(D.BAG.max, Math.ceil(S.meta.up.bag / 2))); delete S.meta.up.bag; } if (S.meta.zoom !== undefined) S.meta.zoom = D.zoomFix(S.meta.zoom); SIMX.initStats(S); SIMX.settleStash(S); if (persist.run && persist.run.map) { S.saved = persist.run; rebalanceRun(S.saved); SIMX.migrateKept(S.saved, 'spawn'); SIMX.mendArches(S.saved); SIMX.regate(S.saved); S.t = Math.max(S.t, persist.run.t || 0) + DT; }
    SIMX.loadSaves(S, persist); fitBag(S, S.saved); return S; };
  // a run saved before a pouch was bought gets the pouch's empty cells on the end of its bag; nothing in it moves
  const fitBag = (S, R) => { const B = R && R.hero && R.hero.bag; if (!B) return; for (let n = D.bagLen(S.meta.up); B.length < n;) B.push(null); };
  const respawn = (S) => S;
  const outOfPlay = () => false;

  // one rule for L and the HUD's map (TASKS 1794): with two, L could fold a legend the HUD had already folded and open it instead
  const legShown = (S, R) => R.mapLeg === 1 || (R.legAuto && S.t - (R.enteredT ?? -1e9) < 5 && !((R.legCut ?? -1e9) >= (R.enteredT ?? -1e9)));
  const REPEATS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'PageUp', 'PageDown', 'Backspace']);
  function step(S, inp = {}) {
    if (!inp.press) S.eatPress = 0; else if (!S.pressWas && S.screen !== 'play') S.eatPress = 1;
    S.pressWas = !!inp.press;
    rebalanceRun(S.run); rebalanceRun(S.saved); fitBag(S, S.run); fitBag(S, S.saved); if (inp.now && S.run) S.run.at = inp.now; if (S.run && S.run.map) fillStats(S.run); if (S.run) S.run.zoom = S.meta.zoom;
    const t = S.t + DT; S.t = t;
    // only the page knows whether it can close its window (the desktop build's bridge, TASKS 1877): a browser tab cannot, so «Выход» waits for its word
    if (inp.quit !== undefined) S.canQuit = inp.quit ? 1 : 0;
    // the update's state (TASKS 1870) comes from the page as a new object on every change, its own count n; never saved
    if (inp.upd !== undefined && (inp.upd ? !S.upd || S.upd.n !== inp.upd.n : S.upd)) {
      S.upd = inp.upd ? Object.assign({}, inp.upd, { notes: (inp.upd.notes || []).slice(0, 8).map((r) => ({ v: String(r.v || ''), items: (r.items || []).slice(0, 5).map(String) })) }) : null;
      if (!S.upd || !['avail', 'down', 'ready'].includes(S.upd.st)) S.updGo = 0; }
    const keys = {}; for (const k of inp.keys || []) keys[k] = 1;
    // a held key's repeats only walk a list (review of PR 57): every other key acts once a press, or a held M or L flips on each repeat
    for (const k of inp.rep || []) if (REPEATS.has(k)) keys[k] = 1;
    // the pointer is followed in play too, or the first window after play takes a pointer at rest for one that moved. The page says
    // itself whether it moved (review of PR 57): a resize puts a still pointer on other view px, and that must not take the focus
    inp = Object.assign({}, inp, { moved: inp.moved !== undefined ? !!inp.moved : !S.ptr || S.ptr[0] !== inp.px || S.ptr[1] !== inp.py }); S.ptr = [inp.px, inp.py];
    // and once in the frame of the window it is over, for the window's hit tests and the HUD's notes alike
    S.uiPtr = [inp.px, inp.py - uiDy(S.screen)];
    // M mutes from any screen (TASKS 1863 а): kept in the meta so the HUD can say so and the settings' volume sits beside it
    if (keys.KeyM && !SIMX.typing(S)) { S.meta.mute = S.meta.mute ? 0 : 1; S.muteT = t; S.saveN++; }
    // the tracker's fold button (TASKS 1992): the page turns a click on it into this key, so the click swings at nothing
    if (keys.TrkFold && S.run && (S.screen === 'play' || S.screen === 'pause')) { S.meta.trkFold = S.meta.trkFold ? 0 : 1; S.saveN++; }
    // and its hide button and chip (TASKS 2110): the whole window folds to a chip with the count, the player's choice kept in the meta
    if (keys.TrkHide && S.run && (S.screen === 'play' || S.screen === 'pause')) { S.meta.trkHide = S.meta.trkHide ? 0 : 1; S.saveN++; }
    if (S.screen === 'play' && S.run) {
      // never a window's key (uiKey gives 'play:::'), so the first step of any window opened from play takes no pointer move
      S.uiWas = 'play'; S.uiKey = 'play'; SIMX.commitDraft(S);
      if (keys.Backquote) S.debug = !S.debug;
      const dbg = S.debug ? D.hitUI(UI.debug(S.run, S), inp.px, inp.py) : null; if (S.debug) S.hover = dbg ? dbg.id : '';
      if (dbg) { if (inp.click) { if (dbg.id === 'dbg_secrets') debugSecrets(S, S.run); else S.dbgLoot = !S.dbgLoot; ev(S, { k: 'ui', x: inp.px, y: inp.py }); } inp = Object.assign({}, inp, { press: 0, click: 0 }); }
      // L folds the map's legend or keeps it open (TASKS 1794); it opens by itself for 5 s (the player's decision 11.11.2026, TASKS 1934) once a run for the floors and once for the
      // town (TASKS 1887 и: opening on every floor got in the way), on its first such entry (legKnown)
      if (keys.KeyL) { const R = S.run, open = legShown(S, R); R.mapLeg = open ? 0 : 1; if (open) R.legCut = S.t; }
      if (keys.Escape || inp.away) { S.screen = 'pause'; S.pauseAsk = 0; }
      else if (keys.KeyI || keys.KeyC || keys.Tab) { S.screen = 'inv'; }
      else if (keys.KeyJ) { S.screen = 'journal'; S.hover = ''; ev(S, { k: 'ui', x: inp.px, y: inp.py }); }
      else { stepPlay(S, inp, keys); if (S.run && !S.run.frozen) stepBossMove(S, S.run); }
    } else stepUI(S, inp, keys);
    // a window opened in this step draws its notes in its own frame at once (review of PR 57: play → inv put the tip uiDy px off)
    S.uiPtr = [S.ptr[0], S.ptr[1] - uiDy(S.screen)];
    if (S.ev.length > 64) S.ev.splice(0, S.ev.length - 64);
    S.steps++; return S;
  }

  // the render's own state when the page gave it none (render.mjs): the menu as a new game opens it
  let idleS = null;
  const idle = () => idleS || (idleS = spawn(0, {}));
  // a class's hero as a new run starts him, for the menu's arch when no run is saved (TASKS 2146): built once, never stepped, and without a floor (2214)
  const fresh = {}, freshHero = (cls) => fresh[cls] || (fresh[cls] = newRun(spawn(0, {}), 'campaign', 1, { cls, bare: 1 }).hero);
  const persist = (S) => ({ meta: S.meta, run: S.run || S.saved || null, slot: S.slot, saves: S.saves });

  root.SIM = { campaignDone, exitKind, rebuildArrival, FOLK_OUCH, questIcon, atBoard, serpentMouth, flightReach, openSecret, debugSecrets, lootAudit, openChest, DT, ARROW_Y, K, VIEW, viewFor, setView, RIG, create, spawn, respawn, outOfPlay, step, persist,
    stepLen, stats, itemName, hitProps, secretMask, hidden, fstat, completionHints, damageName, canDonate, runCompletion, REWARD, itemIcon, itemMods, typeMods, isCons, hand, losClear, rollItem, newRun, enterFloor, cell, flow, atCounter, offersOf, questMark, questTalk, giveQuest, questMarks, questLine, rwLine, journalOf, folkNear, atSoulAltar, atStash, stashOf, atCraft, craftItem, craftCost, tradeDepth, stockShopFor: (R, f, kind) => stockShop(R, dep(R, f), kind), atGate, gateWays, openDoor, pullLever, doorLock, doorNear, leverNear, crustAt, CRUST, DOOM, chasm, brinkOf, gateNear, killEnemy };
  root.SIM.chooseFork = SIMX.chooseFork; root.SIM.uniqueItem = SIMX.uniqueItem; root.SIM.genApart = SIMX.genApart; root.SIM.migrateSecrets = SIMX.migrateSecrets; root.SIM.mapw = SIMX.mapw;
  // what the render may ask the sim (ARCHITECTURE.md §8): reads of the state, never a change to it. The render takes nothing else
  // from SIM but constants
  root.SIM.Q = {
    messageText: SIMX.messageText, depOf: dep, idle, freshHero, campaignDone, cell, attackShape: SIMX.attackShape, rev: SIMX.rev, waterSet: SIMX.waterSet, crossingOnStones: SIMX.crossingOnStones, deckAt: SIMX.deckAt, revKey: SIMX.revKey, cellsKey: SIMX.cellsKey, keyOf: SIMX.keyOf, hidden, itemIcon, stats, equipmentComparison: SIMX.equipmentComparison, shopLayout: SIMX.shopLayout, chasm, secretMask, mapCut: SIMX.mapCut, stepLen, serpentMouth, doorLock, doorTwin: SIMX.doorTwin, brinkOf, flightReach, atBoard, atCounter,
    noteNear, captiveNear, eventNear: SIMX.eventNear, eventSay: SIMX.eventSay, trialWaveOf: SIMX.trialWaveOf, darkMask: SIMX.darkMask, shopShut, craftShut, overLava, losClear: SIMX.losClear, atCraft, atExitGate, atGate, atSoulAltar, atStash, boardOffers, canDonate, completionHints, craftCost, craftItem, damageName, doorNear, folkNear, giverFirst: SIMX.giverFirst,
    exitKind, fstat, gateNear, gateWays, isCons, itemMods, itemName, journalOf, leverNear, secretUnder: SIMX.secretUnder, crackSpan: SIMX.crackSpan, puzzleNear: SIMX.puzzleNear, lootAudit, questIcon, questLine, questMark, questMarks,
    rwLine, greetHold: SIMX.greetHold, tossedNear: SIMX.tossedNear, stashOf, tradeDepth, typeMods, slotRun: SIMX.slotRun, typing: SIMX.typing, isFull: SIMX.isFull, oldestSlot: SIMX.oldestSlot, talkWalk: SIMX.talkWalk, talkFirst: SIMX.talkFirst, boardRows: SIMX.boardRows, legShown };
  Object.assign(SIMX, {
    spawn, step, persist });
  if (typeof module !== 'undefined') { require('./sim_checks.js'); module.exports = root.SIM; }
})(typeof window !== 'undefined' ? window : globalThis);
