// live/sim_checks_looks.js — selfCheck's part for the hero's looks (TASKS 2148): three a class, picked on its card, kept in the meta and on
// the hero, drawn in the world, the arch, the portraits. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, { D, heroSt, newRun, persist, spawn, step, UI } = SIMX, SB = require('./sandbox.cjs');
  const J = (o) => JSON.parse(JSON.stringify(o)), mid = (S, b) => ({ px: b.x + b.w / 2, py: b.y + b.h / 2 + SIMX.uiDy(S.screen) });
  const press = (S, b) => { const p = mid(S, b); step(S, Object.assign({ keys: [], click: 1, press: 1 }, p)); step(S, Object.assign({ keys: [] }, p)); };
  const key = (S, k) => { step(S, { keys: [k] }); step(S, { keys: [] }); };
  const card = (S, id) => UI.classes(S.meta).find((q) => q.id === id);
  // the table: every class has the three looks; a look draws its own art or a look's that has its own (no chain); its rig and portrait exist
  function lookData(out, RIGS, ART) {
    for (const [cls, C] of Object.entries(D.CLASSES)) {
      const ids = Object.keys(C.looks || {}); if (ids.join() !== D.LOOK_IDS.join()) out.push(`look: ${cls} has the looks ${ids.join(', ')}, not ${D.LOOK_IDS.join(', ')}`);
      for (const id of D.LOOK_IDS) { const LK = D.LOOKS[cls][id], own = C.looks[id] || {};
        if (own.art && (!C.looks[own.art] || C.looks[own.art].art)) out.push(`look: ${cls} «${id}» draws «${own.art}», which has no art of its own`);
        if (LK.id !== id || LK.cls !== cls) out.push(`look: ${cls} «${id}» resolves as ${LK.cls} «${LK.id}»`);
        if (!RIGS[LK.rig] || !RIGS[LK.rig].parts) out.push(`look: ${cls} «${id}»: no rig ${LK.rig} in rigs.js`);
        if (!ART[LK.port]) out.push(`look: ${cls} «${id}»: no portrait ${LK.port} in assets.js`);
        else if (ART[LK.port].w !== ART[LK.port].h * UI.kit.PORT.art) out.push(`look: ${cls} «${id}»: the portrait ${LK.port} is ${ART[LK.port].w}×${ART[LK.port].h}, not of the frames' aspect`);
        if (!ART[LK.rig + '__body']) out.push(`look: ${cls} «${id}»: no ${LK.rig}__body`); } }
    const h = newRun(spawn(0, {}), 'campaign', 5, { cls: 'mage' }).hero;
    if (h.look !== 'a') out.push(`look: a hero with no look picked starts in «${h.look}», not «a»`);
    for (const v of [undefined, 'z', '', 7]) { const q = Object.assign({}, h, { look: v }); if (D.lookOf(q).id !== 'a') out.push(`look: a hero with look ${JSON.stringify(v)} is drawn in «${D.lookOf(q).id}», not «a»`); }
  }
  // every texture a look draws is in assets.js, and none of another look's rig: each outfit, each helm, each weapon and offhand, at rest,
  // on the run, from the back, in a swing and a cast, in the world and the arch
  function lookTex(out, RIGS, ART) {
    const { drawHero, L } = SB.heroBox(D, root.SIM, ART), slot = (s) => [''].concat(Object.keys(D.BASES).filter((k) => D.BASES[k].slot === s));
    const rigs = new Set(Object.values(D.LOOKS).flatMap((q) => Object.values(q).map((LK) => LK.rig))), T = 10, seen = new Set();
    const item = (b) => (b ? { id: 0, b, rar: 0, lvl: 1, mods: {}, atk: 6, def: 2 } : undefined);
    const base = { vx: 0, vy: 0, gp: 0, face: 1, aim: 0, atkA: 0, back: 0, backT: -9, faceT: -9, deadT: -1, hurtT: -9, dashT: -9, dashX: 0, atkT: -9, patkT: -9, castT: -9, whirlT: -9 };
    const ACTS = [{}, { vx: 150 }, { back: 1 }, { atkT: T - 0.15 }, { castT: T - 0.1 }];
    for (const cls of Object.keys(D.CLASSES)) for (const look of D.LOOK_IDS) {
      const LK = D.LOOKS[cls][look]; if (!RIGS[LK.rig]) continue;
      const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls, look }); S.run = R; const st = heroSt(S), names = new Set();
      L.sprite = (n) => { names.add(n); return { w: 10, h: 10 }; }; L.solid = () => {}; L.joint = () => {};
      const draw = (eq, acts) => { for (const k of ['armor', 'helm', 'weapon', 'offhand']) R.hero.eq[k] = item(eq[k]);
        for (const a of acts) for (const o of [{}, { menu: 1 }]) if (!(o.menu && a.vx)) drawHero(Object.assign({}, R.hero, base, a), 300, 300, T, st, o); };
      for (const armor of slot('armor')) for (const helm of slot('helm')) draw({ armor, helm, weapon: D.CLASSES[cls].start.weapon }, ACTS.slice(0, 3));
      for (const weapon of slot('weapon')) for (const offhand of slot('offhand')) draw({ weapon, offhand }, ACTS);
      for (const n of names) { const tag = `${cls} «${look}»: ${n}`; if (seen.has(tag)) continue; seen.add(tag);
        if (!ART[n]) out.push(`look tex: ${cls} «${look}» draws ${n}, which assets.js has not`);
        const rig = n.includes('__') ? n.slice(0, n.indexOf('__')) : null;
        if (rig && rigs.has(rig) && rig !== LK.rig) out.push(`look tex: ${cls} «${look}» (rig ${LK.rig}) draws ${n} of another look`); }
      if (![...names].some((n) => n.startsWith(LK.rig + '__body'))) out.push(`look tex: ${cls} «${look}» draws no ${LK.rig}__body`); }
  }
  // the card offers only the looks with art of their own and none while fewer than two have it (the author's order, 19.11.2026): with the
  // table as it is a class without two has no cells, no row between the class and the kit, and a stale look focus or a click where a cell
  // stood changes no look. `withArt` gives the archer two looks with art and the mage three for one block, the table put back after
  const owned = (cls) => D.LOOK_IDS.filter((id) => !D.CLASSES[cls].looks[id].art || D.CLASSES[cls].looks[id].art === id);
  const withArt = (fn) => { const keep = {}; for (const c of ['archer', 'mage']) keep[c] = D.CLASSES[c].looks;
    D.CLASSES.archer.looks = { a: {}, b: {}, c: { art: 'a' } }; D.CLASSES.mage.looks = { a: {}, b: {}, c: {} };
    try { fn(); } finally { Object.assign(D.CLASSES.archer, { looks: keep.archer }); Object.assign(D.CLASSES.mage, { looks: keep.mage }); } };
  const toStart = () => { const S = spawn(0, {}); press(S, UI.menu(false).find((b) => b.id === 'campaign')); return S; };
  function lookHidden(out) {
    for (const cls of D.classesReady()) { const S = toStart(), U = UI.classes(S.meta), cells = U.filter((q) => q.lcls === cls), want = owned(cls).length > 1 ? owned(cls).length : 0;
      if (D.looksShown(cls).length !== want || cells.length !== want) out.push(`look hide: the ${cls} has ${owned(cls).length} look(s) with art and ${cells.length} cell(s) on the card, not ${want}`);
      if (want) continue;
      const kit = U.some((q) => q.id === 'kit:' + cls), m0 = JSON.stringify(S.meta.look);
      S.meta.cls = cls; S.focus = 'cls:' + cls; key(S, 'ArrowDown');
      if (S.focus !== (kit ? 'kit:' + cls : 'name')) out.push(`look hide: ↓ from the ${cls}'s card goes to ${S.focus}, not ${kit ? 'its kit' : 'the name'}`);
      key(S, 'ArrowUp'); if (S.focus !== 'cls:' + cls) out.push(`look hide: ↑ back from under the ${cls}'s card goes to ${S.focus}, not the card`);
      S.focus = `look:${cls}:b`; key(S, 'ArrowRight'); key(S, 'ArrowLeft');
      const c = UI.classes(S.meta).find((q) => q.id === 'cls:' + cls); press(S, { x: c.x + 64, y: c.y + 38 + 68, w: 64, h: 64 });
      if (JSON.stringify(S.meta.look) !== m0) out.push(`look hide: the ${cls}'s look changed with no selector (${JSON.stringify(S.meta.look)})`); }
  }
  // the selector once looks have art: a click on a cell picks it and its class; the keyboard walks down from the class onto the looks' row
  // and ←→ go along it without wrapping; the run starts in it with the typed name and the hardcore tick; it is kept in the meta and on the hero
  function lookPick(out) {
    withArt(() => {
      { const S = toStart(), U = UI.classes(S.meta);
        if (U.some((q) => q.lcls === 'warrior') || U.some((q) => q.id === 'look:archer:c') || !U.some((q) => q.id === 'look:archer:b')) out.push(`look pick: with two looks of the archer's in, the card has the cells ${U.filter((q) => q.lcls).map((q) => q.id).join(', ')}`); }
      { const S = toStart(), b = card(S, 'look:mage:c'); if (S.screen !== 'classes' || !b) { out.push('look pick: no cell for the mage\'s «c» on the start screen'); return; }
        const n0 = S.saveN; press(S, b);
        if (D.lookPick(S.meta, 'mage') !== 'c' || S.meta.cls !== 'mage' || S.focus !== 'look:mage:c' || S.saveN === n0) out.push(`look pick: a click on the mage's «c» leaves ${JSON.stringify(S.meta.look)}, class ${S.meta.cls}, focus ${S.focus}`);
        if (D.lookPick(S.meta, 'warrior') !== 'a') out.push('look pick: the mage\'s look changed the warrior\'s'); }
      { const S = toStart(); S.meta.cls = 'archer'; S.focus = 'cls:archer'; key(S, 'ArrowDown');
        if (S.focus !== 'look:archer:a') out.push(`look pick: ↓ from the class does not go to its looks (${S.focus})`);
        key(S, 'ArrowLeft'); if (S.focus !== 'look:archer:a' || D.lookPick(S.meta, 'archer') !== 'a') out.push(`look pick: ← on «a» wraps or leaves (${S.focus})`);
        key(S, 'ArrowRight'); key(S, 'ArrowRight'); key(S, 'ArrowRight');
        if (S.focus !== 'look:archer:b' || D.lookPick(S.meta, 'archer') !== 'b') out.push(`look pick: → three times from «a» over two cells stands on ${S.focus}, ${JSON.stringify(S.meta.look)}`);
        key(S, 'ArrowLeft'); if (D.lookPick(S.meta, 'archer') !== 'a') out.push('look pick: ← from «b» does not pick «a»');
        key(S, 'ArrowRight'); key(S, 'ArrowUp'); if (S.focus !== 'cls:archer') out.push(`look pick: ↑ from the looks does not go back to the class (${S.focus})`);
        S.pendName = 'Ulf'; S.meta.deathMode = 'hard'; press(S, card(S, 'go'));
        const h = S.run && S.run.hero; if (!h || h.cls !== 'archer' || h.look !== 'b' || h.name !== 'Ulf' || S.run.deathMode !== 'hard') out.push(`look pick: the run starts as ${h && h.cls} «${h && h.look}» ${h && h.name} ${S.run && S.run.deathMode}, not the archer «b» Ulf hard`);
        if (!S.run) return;
        const P = spawn(0, J(persist(S)));
        if (D.lookPick(P.meta, 'archer') !== 'b') out.push(`look pick: the archer's «b» is not kept in the meta (${JSON.stringify(P.meta.look)})`);
        if (!P.saved || P.saved.hero.look !== 'b') out.push(`look pick: the saved hero comes back in «${P.saved && P.saved.hero.look}», not «b»`);
        P.screen = 'classes'; P.pendingMode = 'campaign'; P.meta.cls = 'archer'; press(P, card(P, 'go')); if (!P.run || P.run.hero.look !== 'b') out.push('look pick: the next archer does not start in the kept «b»'); } });
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'warrior', look: 'c' }), P = spawn(0, J(persist(Object.assign(S, { saved: R }))));
      if (!P.saved || P.saved.hero.look !== 'c' || D.lookOf(P.saved.hero) !== D.LOOKS.warrior.c) out.push('look pick: a hero saved in «c» does not come back in it'); }
    { const S = spawn(0, {}), R = newRun(S, 'campaign', 5, { cls: 'warrior', look: 'c' }); delete R.hero.look; S.saved = R; const P = spawn(0, J(persist(S)));
      if (!P.saved || D.lookOf(P.saved.hero) !== D.LOOKS.warrior.a) out.push('look pick: a hero saved before the looks does not come back in «a»'); }
  }
  // the portraits and the arch follow the hero's look: with each look given a portrait of its own for the check, the card shows the picked
  // one large and the offered ones in their cells (the picked sealed), a save slot and the hero screen show the hero's; the arch stands the saved hero in his
  // (behind the test runs' screen: the main menu's strap never ends on the sandbox's 10 px textures)
  function lookShow(out) {
    const page = SB.hudBox(D, root.SIM, SIMX.checks.kit.fontW), L = page.L, K = page.KIT, drawn = [], arch = [], sealed = [], seal = K.seal, cell = K.cell, keep = {};
    for (const [cls, q] of Object.entries(D.LOOKS)) for (const [id, LK] of Object.entries(q)) { keep[cls + id] = LK.port; LK.port = `probe_${cls}_${id}`; }
    L.sprite = (n) => { if (n.startsWith('probe_')) drawn.push(n); return { w: 10, h: 10 }; }; K.seal = (x, y, k) => { sealed.push([x, y]); return seal(x, y, k); };
    page.page.SCENE = { menuHero: (h) => arch.push(h) };
    const draw = (S) => { drawn.length = arch.length = sealed.length = 0; page.HUD.draw(S, S.t); }, n = (p) => drawn.filter((q) => q === p).length;
    try {
      const cardShows = (tag) => { const S = spawn(0, {}); S.screen = 'classes'; S.pendingMode = 'campaign'; S.meta.look = { warrior: 'b', mage: 'c', archer: 'b' }; draw(S);
        for (const cls of D.classesReady()) { const on = D.lookPick(S.meta, cls), cells = D.looksShown(cls);
          for (const id of D.LOOK_IDS) { const want = (id === on ? 1 : 0) + (cells.includes(id) ? 1 : 0), got = n(`probe_${cls}_${id}`); if (got !== want) out.push(`look show${tag}: the card of the ${cls} draws «${id}»'s portrait ${got} times, not ${want}`); }
          const c = card(S, `look:${cls}:${on}`); if (cells.includes(on) && !(c && sealed.some(([x, y]) => x > c.x && x <= c.x + c.w && y >= c.y && y < c.y + c.h))) out.push(`look show${tag}: the ${cls}'s «${on}» cell has no seal`); } };
      cardShows(''); withArt(() => cardShows(' with looks in'));
      { const S = spawn(0, {}); S.saves[1] = newRun(S, 'campaign', 6, { cls: 'archer', look: 'c' }); S.screen = 'load'; S.loadSel = 1; S.focus = 'slot:1'; draw(S);
        if (!n('probe_archer_c')) out.push('look show: the save slot of an archer in «c» does not show his portrait'); }
      { const S = spawn(0, {}); S.saved = newRun(S, 'campaign', 5, { cls: 'mage', look: 'b' }); S.screen = 'tests'; draw(S);
        if (!arch.length || arch[0].look !== 'b' || arch[0].cls !== 'mage') out.push(`look show: the arch stands ${arch[0] ? arch[0].cls + ' «' + arch[0].look + '»' : 'nobody'}, not the saved mage «b»`); }
      { const S = spawn(0, {}); press(S, UI.menu(false).find((b) => b.id === 'campaign')); S.meta.cls = 'warrior'; S.meta.look = { warrior: 'c' }; press(S, card(S, 'go'));
        if (!S.run) out.push('look show: no run from the start screen'); else { for (let i = 0; i < 5; i++) step(S, { keys: [] }); S.screen = 'inv'; draw(S); if (!n('probe_warrior_c')) out.push('look show: the hero screen of a warrior in «c» does not show his portrait'); } }
    } finally { for (const [cls, q] of Object.entries(D.LOOKS)) for (const [id, LK] of Object.entries(q)) LK.port = keep[cls + id]; K.seal = seal; K.cell = cell; }
  }
  // 2214: the menu's arch takes a class's hero from SIM.Q.freshHero: the hero as a run starts him, with no floor made for it
  function freshHeroCheck(out) { const R = newRun(spawn(0, {}), 'campaign', 1, { cls: 'mage', bare: 1 }), Q = root.SIM.Q.freshHero('mage'), W = root.SIM.Q.freshHero('warrior');
    if (R.map || R.en.length) out.push('look: a bare run made a floor');
    if (!Q || !W || Q === W || D.clsOf(Q).id !== 'mage' || D.clsOf(W).id !== 'warrior' || !Q.eq.weapon || !(Q.hp > 0) || root.SIM.Q.freshHero('mage') !== Q) out.push('look: the arch\'s fresh hero is not a class\'s own, built once'); }
  function lookCheck(out) { freshHeroCheck(out); const RIGS = SB.rigs(), ART = SB.assets(); lookData(out, RIGS, ART); lookTex(out, RIGS, ART); lookHidden(out); lookPick(out); lookShow(out); }
  SIMX.checks.add('lookCheck', lookCheck);
})(typeof window !== 'undefined' ? window : globalThis);
