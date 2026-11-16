// live/sim_checks_town.js — selfCheck's parts for the town: folk, services, talks, notes, the cart and the town loop. Node only, like sim_checks.js.
(function (root) {
  const SIMX = root.SIMX, {
    BASES, boardOffers, campaignDone, CART_V, D, dep, DG, DT, endRun, ENEMIES, enterFloor, folkFree, folkOf, folkR, heroShot, heroSt, hitFolk, hurtHero,
    interact, K, newQuest, newRun, offerOf, persist, questMark, railLen, REWARD, rollItem, runCompletion, spawn, startRun, stats, step, stockShop, takeQuest,
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
        // TASKS 2090 cut the rails' flat last cell, so the yard's stone stands one free cell past the diagonal's end
        const YARD_GAP = 2;
        if (!m.town.yardSolid.some((p) => Math.floor(p.y / TILE) === Math.floor(e / m.W) && e % m.W - Math.floor(p.x / TILE) === YARD_GAP)) out.push(`town ${sd}: the rails end short of the mason's yard`); }
      for (const n of m.town.npcs) if (!ok[at(n)]) out.push(`town ${sd}: the ${n.role} stands off the open floor`);
      if (sd > 1 && JSON.stringify(m.decor) === JSON.stringify(DG.genTown(977).decor)) out.push('town: the seed does not vary the decor'); }
    // TASKS 2100: the sweeper's round (its legs too) keeps clear of the hero's straight lines from the spawn to each service and from the stairs to the gate
    { const T = DG.TOWN, G = T.use.exitGate, lines = Object.values(T.use).map((u) => [T.spawn, u]).concat([[T.use.stairs, G]]), R = T.routes.sweeper, SAMPLES = 40;
      const away = (p, [a, b]) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
      R.forEach((a, i) => { const b = R[(i + 1) % R.length]; for (let k = 0; k <= SAMPLES; k++) { const p = [a[0] + (b[0] - a[0]) * k / SAMPLES, a[1] + (b[1] - a[1]) * k / SAMPLES];
        if (lines.some((l) => away(p, l) < T.routeClear)) { out.push(`town: the sweeper's round leg ${i} comes within ${T.routeClear} cells of a straight line of the hero's`); break; } } }); }
    // TASKS 2085, 2091: the track's table holds no painting sizes, they come from the assets: a painting twice as large lays sprites twice as
    // deep, as many of them, each a period cut from half the painting's share; the whole track is one painting, one sleeper size and tone, and
    // the sleepers go one period apart along the rails' length in floor space, round each bend too, so a bend leaves no gap or overlap
    { const R = D.RAIL, pts = D.railPts(DG.genTown(977)), at = (k) => (n) => (n === 'rail_tw_h' ? [100 * k, 40 * k] : [1, 1]), K = D.CART.floor;
      if (Object.keys(R).some((n) => n !== 'gauge' && n !== 'bend' && ('w' in R[n] || 'h' in R[n] || 'width' in R[n] || 'height' in R[n]))) out.push('rails: the table names a painting\'s size');
      if (Object.keys(R).filter((n) => n !== 'gauge' && n !== 'bend').join() !== 'h') out.push('rails: the table holds more than one painting');
      const a = D.railLay(pts, at(1)), b = D.railLay(pts, at(2));
      if (!a.length || a.length !== b.length) out.push('rails: a painting of another size lays another number of sprites');
      else if (Math.abs(b[0].h - 2 * a[0].h) > 1e-6 || Math.abs(b[0].src[2] - b[0].src[0] - (a[0].src[2] - a[0].src[0]) / 2) > 1e-6) out.push('rails: a painting\'s size does not reach the laid sprites');
      const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], (q[1] - pts[i][1]) / K));
      const arc = (r) => { let acc = 0; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], ex = bx - ax, ey = (by - ay) / K, t = ((r.x - ax) * ex + (r.y - ay) / K * ey) / (seg[i - 1] ** 2);
        if (t > -1e-6 && t < 1 + 1e-6 && Math.hypot(r.x - ax - t * (bx - ax), (r.y - ay - t * (by - ay)) / K) < 1e-3) return acc + t * seg[i - 1]; acc += seg[i - 1]; } return -1; };
      const per = R.h.per * R.gauge / R.h.gauge, s = a.map(arc);
      if (a.some((r) => r.tex !== R.h.tex || r.lift !== R.h.lift || Math.abs(r.w - per - 0.5) > 1e-6 || Math.abs(r.h - a[0].h) > 1e-6)) out.push('rails: the track is not one painting at one size and tone');
      else if (s.some((v) => v < 0)) out.push('rails: a sleeper stands off the rails\' line');
      else if (s.some((v, i) => i && Math.abs(v - s[i - 1] - per) > 1)) out.push('rails: the sleepers leave a gap or an overlap of over 1 px along the track');
      // TASKS 2122: round the adit's bend a period goes out in slices that make up its length and painting, each turned no more than
      // R.bend.step from the next, so the rails curve; the straight stretches stay whole periods
      const cut = a.filter((r) => r.parts), ang = (q) => Math.atan2(q.dy / K, q.dx) * 180 / Math.PI, flat = a.flatMap((r) => r.parts || [r]);
      if (!cut.length) out.push('rails: no period round the bend is laid in slices');
      for (const r of cut) { const len = r.parts.reduce((o, q) => o + q.w - R.bend.lap, 0), src = r.parts.reduce((o, q) => o + q.src[2] - q.src[0], 0) * per / (per + R.bend.lap * r.parts.length);
        if (Math.abs(len - per) > 1e-6 || Math.abs(src - (r.src[2] - r.src[0])) > 1e-6) { out.push('rails: a bend\'s slices do not make up their period'); break; } }
      const kink = Math.max(...flat.slice(1).map((q, i) => Math.abs(ang(q) - ang(flat[i])))); if (kink > R.bend.step + 1e-6) out.push(`rails: the track turns ${kink.toFixed(1)}° from one sprite to the next`); }
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
    // TASKS 2128: every giver with a «!» over him, the hero at each of the spots round him where he is the nearest townsman, out of the way's
    // reach and no farther from him than from a service in reach: the first E opens his talk (the porter at the anvil opened the forge)
    { const SPOTS = [[0, 30], [0, 40], [30, 10], [-30, 10], [0, -30], [40, 30], [-40, 30]], EVERY = 0.5, OVER = 40; let byService = 0;
      for (let sd = 1; sd <= 24; sd++) { const S = spawn(0, {}); S.run = newRun(S, 'campaign', sd, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, h = R.hero, home = [h.x, h.y];
        R.quests = []; R.offers = D.QUEST_GIVE.from.filter((r) => folkOf(R).some((f) => f.role === r)).map((r) => ({ key: 'fetch', from: r, q: 0 }));
        const bad = new Set();
        for (let k = 0; k * EVERY < OVER; k++) { for (let i = 0, n = Math.round(EVERY / DT); i < n; i++) step(S, { keys: [] });
          for (const f of folkOf(R)) { if (!questMark(R, f.role) || bad.has(f.role)) continue;
            for (const [dx, dy] of SPOTS) { h.x = f.x + dx; h.y = f.y + dy; if (SIMX.folkNear(R) !== f || SIMX.wayNear(R)) continue;
              const p = SIMX.svcAt(S, R); if (p && Math.hypot(p.x - h.x, p.y - h.y) < Math.hypot(f.x - h.x, f.y - h.y)) continue; if (p) byService++;
              interact(S, R); const got = S.screen === 'talk' ? S.talk && S.talk.role : S.screen;
              if (got !== f.role) { bad.add(f.role); out.push(`town ${sd}: E by the ${f.role} with a «${questMark(R, f.role)}» at ${(k * EVERY).toFixed(1)} s (${dx}, ${dy}) opens ${got}`); }
              S.screen = 'play'; S.talk = null; S.craft = null; if (bad.has(f.role)) break; } }
          h.x = home[0]; h.y = home[1]; } }
      if (!byService) out.push('town: no giver with a mark ever stood by a service, the E order goes unchecked'); }
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
  // TASKS 2126: a walker with an offer for the hero stops for him as he comes his way (D.FOLK_HOLD), within FOLK_HOLD.stop s, waits while
  // he stands near, no longer than FOLK_HOLD.max, and walks on; one with nothing for the hero walks on past him
  function folkHoldCheck() { const out = [], H = D.FOLK_HOLD, steps = (sec, o = {}) => { for (let i = 0, n = Math.round(sec / DT); i < n; i++) step(S, Object.assign({ keys: [] }, o)); };
    let S, walkN = 0;
    for (const offer of [1, 0]) { S = spawn(0, {}); S.run = newRun(S, 'campaign', 3, { town: 1, allFree: 1 }); S.screen = 'play'; const R = S.run, m = R.map, h = R.hero, f = folkOf(R).find((q) => q.role === 'sweeper'), FD = D.FOLK.sweeper;
      R.offers = offer ? [{ key: 'fetch', from: 'sweeper', q: 0 }] : []; R.quests = []; if (offer && questMark(R, 'sweeper') !== '!') { out.push('folk hold: the sweeper shows no «!» for his offer'); continue; }
      h.x = m.town.svc.bin.x + TILE; h.y = m.town.svc.bin.y;
      const clear = () => [m.down, m.exit].every((q) => !q || Math.hypot(q.x - f.x, q.y - f.y) > H.way + H.near);
      for (let i = 0; i < 120 * 90 && !(f.go && f.spd > 0.9 * FD.v && clear()); i++) step(S, { keys: [] });
      if (!(f.go && f.spd > 0.9 * FD.v)) { out.push('folk hold: the sweeper never walks his round'); continue; }
      const v = Math.hypot(f.vx, f.vy), ux = f.vx / v, uy = f.vy / v; h.x = f.x - ux * (H.near - 20); h.y = f.y - uy * (H.near - 20); h.vx = h.vy = 0;
      const toward = () => ({ keys: [], left: f.x < h.x - 3, right: f.x > h.x + 3, up: f.y < h.y - 3, down: f.y > h.y + 3 });
      // the walker with nothing for the hero is come at for as long as the one with an offer took to stop, short of the talk's reach
      for (let i = 0; i < (offer ? 30 : walkN) && f.holdA == null; i++) { step(S, toward()); if (offer) walkN = i + 1; }
      if (!offer) { steps(H.stop + 0.1); if (f.holdA != null || !(f.spd > 0.5 * FD.v)) out.push(`folk hold: the sweeper with nothing for the hero stops for him (spd ${f.spd.toFixed(1)})`); continue; }
      if (f.holdA == null) { out.push(`folk hold: the sweeper with an offer does not stop for the hero coming his way from ${Math.round(Math.hypot(f.x - h.x, f.y - h.y))} px`); continue; }
      const a = S.t; steps(H.stop + 0.1); if (f.spd > 0) out.push(`folk hold: the sweeper still walks at ${f.spd.toFixed(1)} ${(S.t - a).toFixed(2)} s after he stopped for the hero`);
      const x0 = f.x, y0 = f.y, off = () => Math.hypot(f.x - x0, f.y - y0); steps(H.max - H.stop - 0.6); if (off() > 0.5) out.push('folk hold: the sweeper walks off before his wait for the hero is out');
      steps(1.5); if (off() < 2 || f.holdA != null) out.push(`folk hold: the sweeper still waits ${(S.t - a).toFixed(1)} s on for a hero who only stands by`); }
    return out; }
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
  // TASKS 1781, 2090: the floor is flat, so a cart is never sheared, squashed or tipped by the rails' slope: the 3/4 painting turns no more than
  // CART.trim, the front one not at all, one change of view along the whole rail, and the bend's change keeps the rails' slope under CART.front
  function cartCheck() {
    const fs = require('fs'), path = require('path'), out = [], C = D.CART, m = DG.genTown(31), pts = D.railPts(m);
    let prev = null, swaps = 0;
    for (let s = 0; s <= 400; s++) { const v = D.cartView(pts, s);
      if (v.tilt || v.sx !== 1) out.push(`cart: the view at ${s} px is sheared ${v.tilt} or narrowed to ${v.sx}`);
      if (v.side && (Math.abs(v.rot) > C.trim + 1e-6 || v.th >= C.front)) out.push(`cart: the 3/4 view at ${s} px is turned ${v.rot.toFixed(0)}° on rails at ${v.th.toFixed(0)}°`);
      if (!v.side && (v.rot || v.th < C.front)) out.push(`cart: the front view at ${s} px (rails ${v.th.toFixed(0)}°) is turned ${v.rot}°`);
      if (prev && prev.side !== v.side) swaps++;
      prev = v; if (out.length > 4) break; }
    if (swaps !== 1) out.push(`cart: the view changes ${swaps} times along the rails, not once at the bend`);
    const end = D.cartView(pts, D.cartAt(pts, 1e4).ds), th0 = end.th; if (th0 < C.diag - C.trim - 1 || th0 > C.diag + C.trim + 1) out.push(`cart: at the rails' end the slope is ${th0.toFixed(0)}°, not the 3/4 painting's`);
    // TASKS 2090: the wheels' lug moves no more than CART.lug.step px a frame at the top speed, and the rope on the plumb run keeps CART.rope.gap px
    // off the rails' axis (the winch's plumb line down to the cart) but at its two ends; the sizes are the paintings' pixels at the sprites' height
    const sizes = fs.readFileSync(path.join(__dirname, 'sizes.js'), 'utf8'), size = (n) => { const b = fs.readFileSync(path.join(__dirname, 'assets', n + '.png')), hh = +new RegExp('\\b' + n + ': (\\d+)').exec(sizes)[1];
      return [Math.round(hh * b.readUInt32BE(16) / b.readUInt32BE(20)), hh]; };
    for (const n of Object.keys(C.hubs)) { const [w, h] = size(n); let worst = 0;
      for (let s = 0; s <= 400; s++) for (const q of [0, 1]) { const a = D.cartLug(n, q, w, h, s, 1), b = D.cartLug(n, q, w, h, s + CART_V / 60, 1); worst = Math.max(worst, Math.hypot(b[0] - a[0], b[1] - a[1])); }
      if (worst > C.lug.step) out.push(`cart: the lug on ${n} moves ${worst.toFixed(2)} px a frame at the top speed, over ${C.lug.step}`); }
    const axis = [D.cartWinch(pts), ...pts], dir = Math.sign(pts[pts.length - 1][0] - pts[0][0]) || 1, away = (p) => Math.min(...axis.slice(1).map((b, i) => { const a = axis[i], l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2,
      t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * (b[0] - a[0]), p[1] - a[1] - t * (b[1] - a[1])); }));
    for (const f of ['cart_tw_f', 'cart_tw_f_half', 'cart_tw_f_empty']) { const [w, h] = size(f); let near = 1e9, at = 0;
      for (let s = 0; s <= 400; s += 2) { const v = D.cartAt(pts, s); if (D.cartView(pts, v.ds).side) continue; const hk = D.cartHook(0, f, w, h), rope = D.cartRope(D.cartWinch(pts), [v.x + hk[0], v.y + hk[1]], dir);
        let run = 0; for (let i = 1; i < rope.length; i++) { run += Math.hypot(rope[i][0] - rope[i - 1][0], rope[i][1] - rope[i - 1][1]); rope[i].run = run; }
        for (const p of rope) { if (p.run === undefined || (run - p.run) < C.rope.ends || p.run < C.rope.ends) continue; const g = away(p); if (g < near) { near = g; at = s; } } }
      if (near < C.rope.gap) out.push(`cart: the rope of ${f} comes ${near.toFixed(1)} px to the rails' axis at ${at} px, under ${C.rope.gap}`); }
    // TASKS 2109: the lug turns round its hub so the wheel's top goes the way the cart goes on the screen; the near box (CART.rim) never
    // shows more than CART.shrink smaller than CART.ahead px further on (the front view came out of the adit at half the 3/4 one's size);
    // TASKS 2113: the front view's edge-on wheel slabs stand on the two rails, their feet on the rails' line, within a pixel at every s of
    // the plumb run, all three loads on one gauge; nothing on them turns (no lug: CART.hubs names only 3/4 paintings)
    for (const n of Object.keys(C.hubs)) { const [w, h] = size(n); let wrong = null;
      for (let s = 1; s <= 400 && !wrong; s += 3) { const v = D.cartAt(pts, s), u = D.cartAt(pts, s + 1), V = D.cartView(pts, v.ds); if (!V.side || u.x === v.x) continue;
        for (const q of [0, 1]) { const [hu, hv] = C.hubs[n][q], c = [(hu - 0.5) * w, (hv - 1) * h], p = D.cartLug(n, q, w, h, s, V.run), p2 = D.cartLug(n, q, w, h, s + 1, V.run),
            turn = (p[0] - c[0]) * (p2[1] - p[1]) - (p[1] - c[1]) * (p2[0] - p[0]);
          if (Math.sign(turn) !== Math.sign(u.x - v.x)) wrong = [s, q]; } }
      if (wrong) out.push(`cart: the wheel ${wrong[1]} of ${n} turns against the travel at ${wrong[0]} px`); }
    const LOADS = [['cart_tw', 'cart_tw_f'], ['cart_tw_half', 'cart_tw_f_half'], ['cart_tw_empty', 'cart_tw_f_empty']];
    const spans = [];
    for (const [nmS, nmF] of LOADS) { const show = (s) => { const nm = D.cartView(pts, D.cartAt(pts, s).ds).side ? nmS : nmF; return C.rim[nm] * size(nm)[1]; };
      const [w, h] = size(nmF), F = C.wheelsF[nmF], st = D.cartSeatF(nmF, w, h), piv = [w / 2 + st[0], h + st[1]], g = D.RAIL.gauge / 2;
      if (C.hubs[nmF]) out.push(`cart: ${nmF} has wheel hubs, the front view's wheels are edge-on and must not turn`);
      spans.push((F.x[1] - F.x[0]) * w);
      let off = null, plumb = 0;
      for (let s = 0; s <= 400 && !off; s++) { const v = D.cartAt(pts, s), a = D.railAt(pts, v.ds - 1), b = D.railAt(pts, v.ds + 1);
        if (D.cartView(pts, v.ds).side || Math.abs(b[0] - a[0]) > 1e-6) continue; plumb++;
        const rails = [[v.x - g, v.y], [v.x + g, v.y]];
        for (const q of [0, 1]) { const at = [v.x + F.x[q] * w - piv[0], v.y + F.foot * h - piv[1]], d = Math.hypot(at[0] - rails[q][0], at[1] - rails[q][1]);
          if (d > 1) off = [s, q, d]; } }
      if (!plumb) out.push(`cart: ${nmF} is never shown on a plumb run of the rails`);
      if (off) out.push(`cart: the wheel ${off[1]} of ${nmF} stands ${off[2].toFixed(2)} px off its rail at ${off[0]} px`);
      let bad = null; for (let s = 0; s + C.ahead <= 400 && !bad; s += 3) { const a = show(s), b = show(s + C.ahead); if (a < (1 - C.shrink) * b) bad = [s, a, b]; }
      if (bad) out.push(`cart: ${nmS} shows its near box ${bad[1].toFixed(1)} px high at ${bad[0]} px and ${bad[2].toFixed(1)} px ${C.ahead} px on`); }
    if (Math.max(...spans) - Math.min(...spans) > 1) out.push(`cart: the front paintings' wheels stand ${spans.map((x) => x.toFixed(1)).join(', ')} px apart, not on one gauge`);
    // TASKS 2121: the three 3/4 loads are one box: where the load changes (the cart at rest at the rails' end) their width, near box, hubs
    // and lugs agree within a pixel; on the straight diagonal both near wheels' feet stand on the near rail within a pixel at every s
    const put = (n, s) => { const [w, h] = size(n), v = D.cartAt(pts, s), V = D.cartView(pts, v.ds), st = D.cartSeat(n, w, h, V), r = V.rot * Math.PI / 180;
      return (dx, dy) => { const x = dx - st[0], y = dy - st[1]; return [v.x + x * Math.cos(r) - y * Math.sin(r), v.y + x * Math.sin(r) + y * Math.cos(r)]; }; };
    const SIDE = LOADS.map(([n]) => n), rest = railLen(m), spread = (f) => { const vs = SIDE.map(f); return Math.max(...vs.map((p, i) => Math.max(...vs.map((q) => Math.hypot(...p.map((c, j) => c - q[j])))))); };
    const restV = D.cartView(pts, D.cartAt(pts, rest).ds), parts = { width: (n) => [size(n)[0]], 'near box': (n) => [C.rim[n] * size(n)[1]] };
    for (const q of [0, 1]) { parts['hub ' + q] = (n) => { const [w, h] = size(n), [hu, hv] = C.hubs[n][q]; return put(n, rest)((hu - 0.5) * w, (hv - 1) * h); };
      parts['lug ' + q] = (n) => { const [w, h] = size(n); return put(n, rest)(...D.cartLug(n, q, w, h, rest, restV.run)); }; }
    for (const [k, f] of Object.entries(parts)) { const d = spread(f); if (d > 1) out.push(`cart: the 3/4 loads' ${k} differ by ${d.toFixed(2)} px at the rails' end`); }
    for (const n of SIDE) { const [w, h] = size(n); let worst = 0, on = 0;
      for (const s of [...Array(401).keys(), rest]) { const v = D.cartAt(pts, s), V = D.cartView(pts, v.ds), a = D.railAt(pts, v.ds - 1), b = D.railAt(pts, v.ds + 1);
        if (!V.side) continue; const q0 = D.railAt(pts, v.ds - C.reach), q1 = D.railAt(pts, v.ds + C.reach), u = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...u);
        if (Math.abs(u[0] * (q1[1] - q0[1]) - u[1] * (q1[0] - q0[0])) > 1e-6 * l * Math.hypot(q1[0] - q0[0], q1[1] - q0[1])) continue; on++;
        for (const q of [0, 1]) { const f = put(n, s)((C.hubs[n][q][0] - 0.5) * w, (C.foot[n][q] - 1) * h), r = [f[0] - v.x - V.near[0], f[1] - v.y - V.near[1]];
          worst = Math.max(worst, Math.abs(r[0] * u[1] - r[1] * u[0]) / l); } }
      if (!on) out.push(`cart: ${n} is never shown on a straight diagonal of the rails`);
      if (worst > 1) out.push(`cart: a near wheel of ${n} stands ${worst.toFixed(2)} px off the near rail on the diagonal`); }
    // TASKS 2122: the change of view is a cross-fade of C.fade px of rails, 0.15-0.2 s at the top speed; at every s of the run the view more
    // than half shown has its wheels (the front one's slabs, the 3/4 one's near wheels) within a pixel of a drawn rail's axis; across the
    // fade the track's middle its wheels stand over, by each painting's alpha, moves no more than 3 px a 3 px step of s (the travel itself
    // is 2.8) and the box's top over the ground no more than 4 px a 1 px step (one frame threw it 13 px aside)
    const png = (n) => { const b = fs.readFileSync(path.join(__dirname, 'assets', n + '.png')); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    const axes = D.railAxes(pts, png), offRail = (p) => Math.min(...axes.map(([a, b]) => { const ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey)));
      return Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey); })), swap = D.cartSwap(pts), secs = C.fade / (CART_V * (railLen(m) - C.stop) / railLen(m));
    if (secs < 0.15 || secs > 0.2) out.push(`cart: the change of view fades over ${secs.toFixed(2)} s at the top speed, not 0.15-0.2`);
    for (const [nmS, nmF] of LOADS) { let worst = [0], jump = [0], top = [0], last = null, lastTop = null;
      for (let s = 0; s <= rest; s++) { const v = D.cartAt(pts, s), F = D.cartFade(pts, v.ds, swap), [nm, V] = F.a >= 0.5 ? [nmS, F.S] : [nmF, F.F], [w, h] = size(nm);
        for (const p of D.cartFeet(V.side, nm, w, h, V, v)) { const d = offRail(p); if (d > worst[0]) worst = [d, s, nm]; }
        const each = [[nmF, F.F, 1 - F.a], [nmS, F.S, F.a]].map(([n, U, a]) => { const [ww, hh] = size(n), P = D.cartPut(n, ww, hh, U, v), f = D.cartFeet(U.side, n, ww, hh, U, v),
          mid = U.side ? [(f[0][0] + f[1][0]) / 2 - U.near[0], (f[0][1] + f[1][1]) / 2 - U.near[1]] : [(f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2], t = P(0, -hh); return [mid, [t[0] - v.x, t[1] - v.y], a]; });
        const blend = (i) => [0, 1].map((j) => each[0][i][j] * each[0][2] + each[1][i][j] * each[1][2]), mid = blend(0), tp = blend(1);
        if (lastTop) { const d = Math.hypot(tp[0] - lastTop[0], tp[1] - lastTop[1]); if (d > top[0]) top = [d, s]; } lastTop = tp;
        if (s % 3 === 0) { if (last) { const d = Math.hypot(mid[0] - last[0], mid[1] - last[1]); if (d > jump[0]) jump = [d, s]; } last = mid; } }
      if (worst[0] > 1) out.push(`cart: a wheel of ${worst[2]} stands ${worst[0].toFixed(2)} px off the drawn rails at ${worst[1]} px`);
      if (jump[0] > 3) out.push(`cart: the ${nmS} pair's wheels jump ${jump[0].toFixed(2)} px over the 3 px of s to ${jump[1]}`);
      if (top[0] > 4) out.push(`cart: the ${nmS} pair's box top jumps ${top[0].toFixed(2)} px over the 1 px of s to ${top[1]}`); }
    return out;
  }
  // TASKS 2104: hardcore's death ends the run; the normal mode's wakes the hero in the town with a share of his level's experience
  // gone, his level, gear and floors kept, and a boss fight he fell in called off; a boss slain opens its hall in the meta, the hall
  // outlives the run, the ring of a new normal run offers it beside the way down from the first floor and leads to the boss's floor,
  // a hardcore run's ring offers none; the counters go by mode, and a run saved before the modes plays as hardcore
  function deathModeCheck() { const out = [], LVL = 3, XP = 50;
    const fresh = (mode, S = spawn(0, {})) => { const R = newRun(S, 'campaign', 11, { town: 1, deathMode: mode }); S.run = R; S.screen = 'play'; return [S, R]; };
    const die = (S, R) => { R.hero.ifr = 0; SIMX.killHero(S, R); for (let i = 0; i < 400 && S.run === R && R.hero.deadT >= 0; i++) step(S, { keys: [] }); };
    const bossF = Array.from({ length: D.RUNS.campaign.floors }, (_, i) => i + 1).find((f) => D.stageOf('campaign', f).boss);
    { const [S, R] = fresh('hard'); enterFloor(S, R, 1); die(S, R);
      if (S.run || S.screen !== 'dead') out.push(`death mode: a hardcore death leaves the screen ${S.screen} and the run ${!!S.run}`);
      if (!S.result || S.result.deathMode !== 'hard') out.push(`death mode: a hardcore run's result records the mode ${S.result && S.result.deathMode}`);
      const M = S.meta.stats.mode || {}; if (!(M.hard && M.hard.deaths === 1) || (M.normal && M.normal.deaths)) out.push(`death mode: a hardcore death is counted ${JSON.stringify(M)}`); }
    { const [S, R] = fresh('normal'), h = R.hero; enterFloor(S, R, 1); h.lvl = LVL; h.xp = XP; const gold = h.gold = 77, wpn = h.eq.weapon.id, lost = Math.min(XP, Math.round(D.xpNeed(LVL) * D.BAL.deathXpLoss)); die(S, R);
      if (S.run !== R || S.screen !== 'play' || !R.town) out.push(`death mode: a normal death does not wake the hero in the town (screen ${S.screen}, floor ${R.floor})`);
      if (h.deadT !== -1 || h.hp !== heroSt(S).maxHp) out.push('death mode: the hero wakes in the town still dead or hurt');
      if (h.lvl !== LVL || h.xp !== XP - lost) out.push(`death mode: a normal death leaves level ${h.lvl} and ${h.xp} xp, not ${LVL} and ${XP - lost}`);
      if (h.gold !== gold || !h.eq.weapon || h.eq.weapon.id !== wpn) out.push('death mode: a normal death takes the gold or the gear');
      if (!R.memo || !R.memo[1]) out.push('death mode: a normal death drops the floor it happened on');
      const M = S.meta.stats.mode || {}; if (!(M.normal && M.normal.deaths === 1) || (M.hard && M.hard.deaths)) out.push(`death mode: a normal death is counted ${JSON.stringify(M)}`); }
    if (!SIMX.hardcore({ viaTown: 1 })) out.push('death mode: a run saved before the modes is not hardcore');
    // TASKS 2108: the start screen's checkbox turns hardcore on and off by a click and by Space, and the run started takes its choice
    { const S = spawn(0, {}); S.screen = 'classes'; S.pendingMode = 'campaign'; const b = D.UI.classes(S.meta).find((q) => q.id === 'hard');
      if (!b || D.deathPick(S.meta) !== 'normal') out.push(`death mode: the start screen has no hardcore checkbox, or it starts ticked (${D.deathPick(S.meta)})`);
      else { step(S, { keys: [], px: b.x + 5, py: b.y + 5, click: 1 }); const on = D.deathPick(S.meta);
        step(S, { keys: [] }); step(S, { keys: ['Space'] }); const off = D.deathPick(S.meta);
        step(S, { keys: [] }); step(S, { keys: ['ArrowRight'] }); const ar = D.deathPick(S.meta); step(S, { keys: [] }); step(S, { keys: ['Enter'] });
        if (on !== 'hard' || off !== 'normal' || ar !== 'hard' || D.deathPick(S.meta) !== 'normal' || S.focus !== 'hard') out.push(`death mode: the checkbox gives ${on} on a click, ${off} on Space, ${ar} on →, ${D.deathPick(S.meta)} on Enter, the focus on ${S.focus}`);
        step(S, { keys: [] }); S.focus = 'go'; step(S, { keys: ['Enter'] });
        if (!S.run || S.run.deathMode !== 'normal') out.push(`death mode: the run started after the checkbox plays ${S.run && S.run.deathMode}`); } }
    if (!bossF) { out.push('death mode: the campaign has no boss floor'); return out; }
    { const [S, R] = fresh('normal'); enterFloor(S, R, bossF); const b = R.en.find((e) => D.BOSSES[e.type]);
      R.arena = { active: 1, room: b.room, t0: S.t }; b.hp = 1; die(S, R); enterFloor(S, R, bossF); const b2 = R.en.find((e) => D.BOSSES[e.type]);
      if ((R.arena && R.arena.active) || !b2 || b2.hp !== b2.max || b2.deadT >= 0) out.push('death mode: a boss fight the hero fell in is still on, or the boss not whole, when he comes back'); }
    const [S, R] = fresh('hard'); enterFloor(S, R, bossF); const b = R.en.find((e) => D.BOSSES[e.type]); R.arena = { active: 1, room: b.room, t0: S.t }; b.hp = 0; SIMX.killEnemy(S, R, b);
    if (!(S.meta.portals || []).includes(bossF)) { out.push(`death mode: the boss of floor ${bossF} opens no hall in the meta (${JSON.stringify(S.meta.portals)})`); return out; }
    const S2 = spawn(0, JSON.parse(JSON.stringify(root.SIM.persist(S))));
    if (!(S2.meta.portals || []).includes(bossF)) out.push('death mode: the opened hall does not outlive the save');
    const [, R2] = fresh('normal', S2), o = SIMX.gateWays(R2, S2), go = o.find((q) => q.k === 'boss' && q.f === bossF);
    if (!go || o.some((q) => q.k !== 'boss')) out.push(`death mode: a new normal run's ring offers ${JSON.stringify(o)}`);
    // TASKS 2111: a portal keeps its origin for its label (none in an old save = the scroll's); one left by an open hall's gate is
    // that hall's way twice, so the ring hides it, and going by the hall closes it
    { const way = (P) => { R2.portal = P; return SIMX.gateWays(R2, S2).find((q) => q.k === 'portal'); }, other = bossF + 1;
      const old = way({ f: bossF, x: 0, y: 0 }), scroll = way({ f: bossF, x: 0, y: 0, from: 'scroll' }), shut = way({ f: bossF, x: 0, y: 0, from: 'gate' }), far = way({ f: other, x: 0, y: 0, from: 'gate' });
      if (!old || old.from !== 'scroll' || !scroll || scroll.from !== 'scroll' || shut || !far || far.from !== 'gate') out.push(`death mode: the ring's portal by origin: old save ${JSON.stringify(old)}, scroll ${JSON.stringify(scroll)}, open hall's gate ${JSON.stringify(shut)}, a shut hall's gate ${JSON.stringify(far)}`);
      // TASKS 2126: the toast after a normal death names the deepest way the ring opens, else the mine from the first floor
      const fell = (P) => { R2.portal = P; return SIMX.fellWay(S2, R2); }, pf = bossF + 2, ps = S2.meta.portals, hall = fell(null), deep = fell({ f: pf, x: 0, y: 0, from: 'scroll' });
      S2.meta.portals = []; const none = fell(null); S2.meta.portals = ps;
      if (hall !== TXT('sim_ui.fell.way.boss', { f: bossF }) || deep !== TXT('sim_ui.fell.way.portal', { f: pf }) || none !== TXT('sim_ui.fell.way.first')) out.push(`death mode: the death toast's way down reads «${hall}» with the hall of floor ${bossF}, «${deep}» with a portal to ${pf} too, «${none}» with neither`);
      R2.portal = { f: bossF, x: 0, y: 0, from: 'gate' }; }
    if (go) { SIMX.gateGo(S2, R2, go); const g = SIMX.hallGate(R2);
      if (R2.portal) out.push(`death mode: going by the hall of floor ${bossF} leaves its gate's portal open ${JSON.stringify(R2.portal)}`);
      if (R2.floor !== bossF || !g || Math.hypot(R2.hero.x - g.x, R2.hero.y - g.y) > 2 * TILE) out.push(`death mode: the hall's portal leads to floor ${R2.floor}, ${g ? Math.round(Math.hypot(R2.hero.x - g.x, R2.hero.y - g.y)) : '?'} px from its portal`); }
    { const [S3, R3] = fresh('hard', S2); if (SIMX.gateWays(R3, S3).length) out.push(`death mode: a hardcore run's ring offers ${JSON.stringify(SIMX.gateWays(R3, S3))}`); }
    return out;
  }
  SIMX.checks.add('townCheck', townCheck);
  SIMX.checks.add('deathModeCheck', deathModeCheck);
  SIMX.checks.add('folkHoldCheck', folkHoldCheck);
  SIMX.checks.add('cartCheck', cartCheck);
  SIMX.checks.add('folkCheck', folkCheck);
  SIMX.checks.add('shopTownCheck', shopTownCheck);
  SIMX.checks.add('soulAltarCheck', soulAltarCheck);
  SIMX.checks.add('talkCheck', talkCheck);
  SIMX.checks.add('noteChainCheck', noteChainCheck);
  SIMX.checks.add('captiveFallbackCheck', captiveFallbackCheck);
  SIMX.checks.add('townLoopCheck', townLoopCheck);
})(typeof window !== 'undefined' ? window : globalThis);
