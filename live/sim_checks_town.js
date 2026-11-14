// live/sim_checks_town.js — selfCheck's parts for the town: folk, services, talks, notes, the cart and the town loop. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    BASES, boardOffers, campaignDone, D, dep, DG, DT, endRun, ENEMIES, enterFloor, folkFree, folkOf, folkR, heroShot, heroSt, hitFolk, hurtHero,
    interact, K, newQuest, newRun, offerOf, persist, questMark, REWARD, rollItem, runCompletion, spawn, startRun, stats, step, stockShop, takeQuest,
    TILE, tradeDepth, turnIn, UI } = SIMX;
  const { noWelcome, noQuests } = SIMX.checks.kit;
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
  // TASKS 1781: along the whole rail the cart shows one painting, kept upright: the 3/4 one turned no more than CART.roll with its
  // wheel line on the rails, the front one never turned and its axle tilted no more than 18 degrees; one change of view at the bend
  function cartCheck() {
    const out = [], C = D.CART, R2D = 180 / Math.PI, m = DG.genTown(31), pts = D.railPts(m);
    let prev = null, swaps = 0;
    for (let s = 0; s <= 400; s++) { const v = D.cartView(pts, s);
      if (v.side) { const line = Math.atan(Math.tan(C.side / R2D) / v.sx) * R2D - v.rot;
        if (Math.abs(v.rot) > C.roll + 0.5 || v.sx < C.squash - 1e-6 || v.sx > 1) out.push(`cart: the 3/4 view at ${s} px is turned ${v.rot.toFixed(0)}° or narrowed to ${v.sx.toFixed(2)}`);
        if (Math.abs(line - v.th) > 1) out.push(`cart: the 3/4 view's wheel line at ${s} px runs ${line.toFixed(0)}° on rails at ${v.th.toFixed(0)}°`); }
      else if (v.rot || v.sx !== 1 || Math.abs(v.tilt) > 18 || v.th < 55) out.push(`cart: the front view at ${s} px (rails ${v.th.toFixed(0)}°) is turned ${v.rot}° or its axle tilts ${v.tilt.toFixed(0)}°`);
      if (prev && prev.side !== v.side) swaps++;
      else if (prev && (Math.abs(prev.rot - v.rot) > 2 || Math.abs(prev.tilt - v.tilt) > 2 || Math.abs(prev.sx - v.sx) > 0.02)) out.push(`cart: the view jumps at ${s} px`);
      prev = v; if (out.length > 4) break; }
    if (swaps !== 1) out.push(`cart: the view changes ${swaps} times along the rails, not once at the bend`);
    return out;
  }
  SIMX.checks.add('townCheck', townCheck);
  SIMX.checks.add('cartCheck', cartCheck);
  SIMX.checks.add('folkCheck', folkCheck);
  SIMX.checks.add('wayCheck', wayCheck);
  SIMX.checks.add('shopTownCheck', shopTownCheck);
  SIMX.checks.add('soulAltarCheck', soulAltarCheck);
  SIMX.checks.add('talkCheck', talkCheck);
  SIMX.checks.add('noteChainCheck', noteChainCheck);
  SIMX.checks.add('captiveFallbackCheck', captiveFallbackCheck);
  SIMX.checks.add('townLoopCheck', townLoopCheck);
})(typeof window !== 'undefined' ? window : globalThis);
