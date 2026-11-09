// live/sim_world.js — actions on the world: potions, items, abilities, props, secrets, doors, levers, chests, webs, ambushes.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const {
    BAL, BASES, CONSUMABLES, D, DG, DROP_REST, ENEMIES, K, LOOT, POT, REWARD, STAGE, TILE, angDiff, behindProp, cell, checkFull,
    dep, dif, doorLock, drop, enterFloor, ev, fstat, gearName, gift, giveShards, hand, heroHit, heroSt, hidden, isCons, losClear, pick,
    potion, propBoxes, ri, rnd, rollItem, secretMask, under } = SIMX;
  // ---------------- actions ----------------
  function usePotion(S, R, b) {
    const h = R.hero, i = h.bag.findIndex((it) => it && it.b === b); if (i < 0) { ev(S, { k: 'nope', x: h.x, y: h.y, s: b === 'hp_potion' ? TXT('sim_world.usePotion.s') : TXT('sim_world.usePotion.s.2') }); return; }
    const st = heroSt(S), it = h.bag[i];
    if (b === 'mp_potion' && D.clsOf(h).res === 'rage') { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_world.usePotion.rage') }); return; }
    const brew = 1 + gift(h, 'thrift') / 100;
    if (b === 'hp_potion') h.hp = Math.min(st.maxHp, h.hp + st.maxHp * CONSUMABLES.hp_potion.heal * brew); else h.mp = Math.min(st.maxMp, h.mp + st.maxMp * CONSUMABLES.mp_potion.mana * brew);
    if (--it.n <= 0) h.bag[i] = null; ev(S, { k: 'drink', x: h.x, y: h.y, b }); SIMX.firePowers(S, R, 'potion', { x: h.x, y: h.y, b });
  }
  // gear for an empty slot goes straight onto the hero instead of into the bag
  function wearIfFree(S, R, it) {
    const h = R.hero, b = BASES[it.b]; if (isCons(it) || !b || !b.slot || h.eq[b.slot] || h.lvl < D.reqLvl(it) || !D.wears(D.clsOf(h).id, it.b)) return false;
    h.eq[b.slot] = it; ev(S, { k: 'equip', x: h.x, y: h.y, slot: b.slot, on: gearName(it) }); return true;
  }
  const READ_T = 1.6, bossFight = (R) => !!(R.map.bossType && R.en.some((e) => D.BOSSES[e.type] && e.deadT < 0 && e.st !== 'idle'));
  // the scroll being read: a step, a dash or a blow breaks it off (the scroll is kept); read through, the portal opens where the hero
  // stands and takes him to the town's ring of stones; its pair in the town brings him back to that spot (and closes)
  // its flash only where he comes out: one where he left lit the new floor at the old one's coordinates (TASKS 1025)
  function readStep(S, R, moved, dashing) { const h = R.hero, q = h.read;
    if (moved || dashing || h.deadT >= 0 || h.atkT > q.t0 || (h.castT ?? -9) > q.t0) { h.read = null; ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_world.readStep.s') }); return; }
    if (S.t - q.t0 < READ_T) return;
    const it = h.bag[q.i]; h.read = null; if (!it || it.b !== 'scroll') return; if (--it.n <= 0) h.bag[q.i] = null; SIMX.firePowers(S, R, 'scroll', { x: h.x, y: h.y });
    R.portal = { f: R.floor, x: h.x, y: h.y }; enterFloor(S, R, 0, undefined, 'portal'); ev(S, { k: 'teleport', x: h.x, y: h.y, fx: h.x, fy: h.y }); }
  function useItem(S, R, idx) {
    const h = R.hero, it = h.bag[idx]; if (!it) return;
    if (it.b === 'hp_potion' || it.b === 'mp_potion') { usePotion(S, R, it.b); return; }
    // in a run through the town (TASKS 1007) the scroll is read on the spot, READ_T s standing still, and opens a portal home
    if (it.b === 'scroll' && R.viaTown) { S.screen = 'play';
      if (R.town) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_world.useItem.s') }); return; }
      if (bossFight(R)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_world.useItem.s.2') }); return; }
      h.read = { t0: S.t, i: idx }; h.vx = h.vy = 0; ev(S, { k: 'read', x: h.x, y: h.y }); return; }
    if (it.b === 'scroll') { const m = R.map, fx = h.x, fy = h.y; h.x = m.spawn.x; h.y = m.spawn.y; if (--it.n <= 0) h.bag[idx] = null; ev(S, { k: 'teleport', x: h.x, y: h.y, fx, fy }); return; }
    // gear above the hero's level stays in the bag (TASKS 1028)
    if (h.lvl < D.reqLvl(it)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_world.useItem.s.3', { p1: D.reqLvl(it) }) }); return; }
    // another class's gear stays in the bag (TASKS 1102): sold, stashed or reforged, never worn
    if (!D.wears(D.clsOf(h).id, it.b)) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_world.useItem.cls', { p1: D.clsNames(it.b) }) }); return; }
    const slot = BASES[it.b].slot, old = h.eq[slot]; h.eq[slot] = it; h.bag[idx] = old || null; ev(S, { k: 'equip', x: h.x, y: h.y, slot, on: gearName(it), off: gearName(old) });
    const st = heroSt(S); h.hp = Math.min(h.hp, st.maxHp); h.mp = Math.min(h.mp, st.maxMp);
  }
  // a hero's single shot (the staff's bolt, a bow's arrow; TASKS 1110, 1120): from the weapon's tip down the aim, it strikes the one
  // it touches (sim_enemies: single)
  // (W: the weapon's base, its own arrow, TASKS 1163)
  function heroShot(R, h, a, dmg, crit, kind = 'bolt', W = {}) { const B = D.SHOTS[kind], [hx0, hy0] = hand(h), hx = hx0 + Math.cos(a) * B.tip, hy = hy0 + Math.sin(a) * B.tip, v = B.spd * (W.shotV || 1);
    const p = { id: R.nextId++, k: B.k, single: 1, x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: R.t, life: B.life * (W.shotL || 1), own: 'hero', r: B.r, kb: B.kb * (W.shotKb || 1), crit: crit ? 1 : 0, dmg, gz: 20, pierce: W.pierce || 0 };
    R.proj.push(p); return p; }
  function castAbility(S, R, id, inp) {
    const h = R.hero, A = D.clsOf(h).abs.find((a) => a.id === id), rank = h.ab[id] || 0;
    if (!rank) { ev(S, { k: 'nope', x: h.x, y: h.y, s: TXT('sim_world.castAbility.s', { unlock: A.unlock }) }); return; }
    if (h.cd[id] > S.t) return;
    if (h.mp < A.mp) { ev(S, { k: 'nope', x: h.x, y: h.y, s: D.clsOf(h).res === 'rage' ? TXT('sim_world.castAbility.s.3') : TXT('sim_world.castAbility.s.2') }); return; }
    const AR = D.abRank(id, rank); h.mp -= A.mp; h.cd[id] = S.t + A.cd * AR.cd; h.castT = S.t; h.castK = id;
    const st = heroSt(S), fired = {};
    if (id === 'whirl') { fired.r = AR.r; h.whirlT = S.t; h.whirlA = h.aim; const dmgK = AR.k; S.meta.whirls = (S.meta.whirls || 0) + 1;
      const wr = AR.r; for (const e of R.en) { if (e.deadT >= 0) continue; const d = Math.hypot(e.x - h.x, (e.y - h.y) * 1.3); if (d < wr + ENEMIES[e.type].r && losClear(R.map, h.x, h.y, e.x, e.y)) { const c = rnd(R) * 100 < st.crit; heroHit(S, R, e, Math.round(st.atk * dmgK * (c ? st.critK : 1)), c, h.x, h.y, 1.6); } }
      breakPots(S, R, h.x, h.y, wr); hitProps(S, R, h.x, h.y, wr); hitFolk(S, R, h.x, h.y, wr); hitChests(S, R, h.x, h.y, wr); hitSecrets(S, R, h.x, h.y, wr); hitDoors(S, R, h.x, h.y, wr); tearWebs(S, R, h.x, h.y, wr); ev(S, { k: 'whirl', x: h.x, y: h.y, a: h.aim, r: wr, rar: h.eq.weapon ? h.eq.weapon.rar : 0 }); }
    if (id === 'fireball') { const [hx, hy] = hand(h), a = h.aim, c = rnd(R) * 100 < st.crit, dmg = Math.round(D.fireDmg(st.spellBase, AR.k, st.spell) * (c ? st.critK : 1));
      const p = { id: R.nextId++, k: 'fire', x: hx, y: hy, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, t0: S.t, life: 1.1, dmg, crit: c ? 1 : 0, own: 'hero', r: 8 }; R.proj.push(p); fired.projs = [p]; ev(S, { k: 'cast', x: hx, y: hy, a }); }
    // the ice wave (TASKS 1110): everyone in the cone before the mage, in his sight, is hurt and chilled (sim_enemies: slowK)
    if (id === 'frost') { const F = D.FROST, wr = AR.r, half = F.arc / 2 * Math.PI / 180, dmg = D.frostDmg(st.spellBase, AR.k, st.spell);
      for (const e of R.en) { if (e.deadT >= 0 || under(e)) continue; const dx = e.x - h.x, dy = (e.y - h.y) * 1.3, d = Math.hypot(dx, dy);
        if (d > wr + ENEMIES[e.type].r || (d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), h.aim)) > half) || !losClear(R.map, h.x, h.y, e.x, e.y)) continue;
        SIMX.chill(S, e, F.t, F.slow); const c = rnd(R) * 100 < st.crit; heroHit(S, R, e, c ? Math.round(dmg * st.critK) : dmg, c, h.x, h.y, 0.5, 'frost'); }
      tearWebs(S, R, h.x, h.y, wr, h.aim, F.arc * Math.PI / 180); ev(S, { k: 'frost', x: h.x, y: h.y, a: h.aim, r: wr, arc: F.arc }); }
    // the warrior's (TASKS 1130): the charge (a long dash down the aim, sim_hero strikes and stuns the first monster it meets); the war
    // cry (monsters within reach weakened, the warrior's blows harder, CRY.t s)
    if (id === 'charge') { h.charge = 1; h.chargeK = D.CHARGE.k * AR.k; h.dashT = S.t + D.CHARGE.prep; h.dashX = Math.cos(h.aim); h.dashY = Math.sin(h.aim); fired.dx = h.dashX; fired.dy = h.dashY; fired.len = D.CHARGE.spd * D.CHARGE.t; ev(S, { k: 'charge', x: h.x, y: h.y, dx: h.dashX, dy: h.dashY }); SIMX.firePowers(S, R, 'dash', { x: h.x, y: h.y, dx: h.dashX, dy: h.dashY, len: D.CHARGE.spd * D.CHARGE.t }); }
    if (id === 'cry') { const C = D.CRY; h.cryJolt = S.t + 0.15; h.cryT = S.t + AR.t; for (const e of R.en) if (e.deadT < 0 && !under(e) && Math.hypot(e.x - h.x, (e.y - h.y) * 1.3) < C.r + ENEMIES[e.type].r) e.weakT = S.t + AR.t;
      ev(S, { k: 'cry', x: h.x, y: h.y, r: C.r }); }
    // the archer's (TASKS 1120, 1161): a fan of arrows closing on the cursor; a trap at the cursor (stepTraps springs it); a leap back
    // as a dash with a shot down the aim; each arrow, trap and leap shot may crit
    const shot = () => { const c = rnd(R) * 100 < st.crit; return [Math.max(1, Math.round(st.atk * (0.9 + 0.2 * rnd(R)) * (c ? st.critK : 1) * (h.bless ? 1.2 : 1))), c]; };
    const [ox, oy] = hand(h), far = Math.hypot((h.mx ?? ox + Math.cos(h.aim) * 200) - ox, (h.my ?? oy + Math.sin(h.aim) * 200) - oy);
    if (id === 'volley') { const V = D.VOLLEY, arc = Math.max(V.min, Math.min(V.arc, 2 * Math.atan2(V.w / 2, far) * 180 / Math.PI)); fired.projs = [];
      for (let i = 0; i < V.n; i++) { const [d, c] = shot(); fired.projs.push(heroShot(R, h, h.aim + (i / (V.n - 1) - 0.5) * arc * Math.PI / 180, Math.round(d * V.k * AR.k), c, 'arrow', BASES[st.wtype])); }
      ev(S, { k: 'volley', x: h.x, y: h.y, a: h.aim }); }
    if (id === 'trap') { const T = D.TRAP;
      const gx = h.mx ?? h.x, gy = (h.my ?? h.y) + 30, n = Math.min(T.far, Math.hypot(gx - h.x, gy - h.y)), ux = (gx - h.x) / (Math.hypot(gx - h.x, gy - h.y) || 1), uy = (gy - h.y) / (Math.hypot(gx - h.x, gy - h.y) || 1);
      let tx = h.x, ty = h.y + 4; for (let d = n; d > 0; d -= 8) { const x = h.x + ux * d, y = h.y + uy * d; if (cell(R.map, Math.floor(x / TILE), Math.floor(y / TILE)) === 1 && losClear(R.map, h.x, h.y, x, y)) { tx = x; ty = y; break; } }
      const [d, c] = shot(); setTrap(S, R, tx, ty, h.x, h.y + 4, Math.round(d * T.k * AR.k), c); }
    if (id === 'leap') { h.dashT = S.t; h.leapV = [S.t, D.LEAP.spd]; h.dashX = -Math.cos(h.aim); h.dashY = -Math.sin(h.aim); const [d, c] = shot(); heroShot(R, h, h.aim, Math.round(d * D.LEAP.k * AR.k), c, 'arrow', BASES[st.wtype]);
      ev(S, { k: 'hleap', x: h.x, y: h.y, dx: h.dashX, dy: h.dashY }); SIMX.firePowers(S, R, 'dash', { x: h.x, y: h.y, dx: h.dashX, dy: h.dashY, len: D.LEAP.spd * K.DASH_T }); }
    if (id === 'shield') { h.shield = D.shieldHp(st.int, rank, dep(R)); h.shieldUntil = S.t + D.SHIELD_T; h.shieldT = S.t; ev(S, { k: 'shield', x: h.x, y: h.y }); }
    SIMX.firePowers(S, R, 'cast:' + id, Object.assign({ x: h.x, y: h.y, a: h.aim }, fired));
  }
  function setTrap(S, R, x, y, fx, fy, dmg, crit) { const own = (R.htraps = (R.htraps || []).filter((q) => !q.done)); if (own.length >= D.TRAP.max) own.shift(); own.push({ id: R.nextId++, x, y, fx, fy, t0: S.t, dmg, crit }); ev(S, { k: 'trapset', x, y }); }
  // the archer's traps (TASKS 1120, 1161): armed after TRAP.arm s, the first monster on one is struck and held, its blow put off as
  // the charge's stun (sim_enemies: rootT → slowK 0), a boss briefly; gone after TRAP.life s
  function stepTraps(S, R) { const T = D.TRAP, t = S.t;
    for (const q of R.htraps) { if (q.done) continue; if (t - q.t0 > T.life) { q.done = 1; continue; } if (t - q.t0 < T.arm) continue;
      const e = R.en.find((o) => o.deadT < 0 && !under(o) && !ENEMIES[o.type].ghost && Math.hypot(o.x - q.x, (o.y - q.y) * 1.3) < T.r + ENEMIES[o.type].r * 0.6); if (!e) continue;
      const hold = D.BOSSES[e.type] ? T.boss : T.root; q.done = 1; e.rootT = t + hold; e.slowK = 0; e.cdT = Math.max(e.cdT || 0, t + hold); if (e.st === 'wind') { e.st = 'chase'; e.t0 = t; }
      heroHit(S, R, e, q.dmg, !!q.crit, q.x, q.y, 0); ev(S, { k: 'trapsnap', x: q.x, y: q.y, id: e.id }); SIMX.firePowers(S, R, 'trapsnap', { x: q.x, y: q.y, e, dmg: q.dmg }); }
    R.htraps = R.htraps.filter((q) => !q.done); }
  function breakPots(S, R, x, y, rad, ax, arc) {
    for (const p of R.pots) { if (p.hp <= 0) continue; const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 10) continue; if (arc !== undefined && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) continue; if (!losClear(R.map, x, y, p.x, p.y)) continue;
      p.hp = 0; p.brokeT = S.t; ev(S, { k: 'break', x: p.x, y: p.y, kind: p.kind });
      if (p.kind === 'gold' || p.kind === 'goldpile') { for (let k = 0; k < (p.rich ? 6 : p.kind === 'goldpile' ? 2 : 3); k++) drop(R, p.x, p.y, { kind: 'gold', n: ri(R, 4, 8) + dep(R) * 2 }); }
      else if (p.kind.startsWith('vase')) { drop(R, p.x, p.y, { kind: 'gold', n: ri(R, 4, 9) + dep(R) * 2 }); if (rnd(R) < POT.vase) SIMX.dropPotion(R, p.x, p.y, 0.7); }
      else if (rnd(R) < 0.6) drop(R, p.x, p.y, { kind: 'gold', n: ri(R, 2, 5) + dep(R) }); else if (rnd(R) < POT.pot) SIMX.dropPotion(R, p.x, p.y, 0.7); }
  }
  // big props don't break: each blow rocks, rings or chips them (scene.js), with a pause per prop so one swing is one knock
  // the townsfolk and hens in the way of a blow (TASKS 1033): it harms none of them, but each answers it: a townsman flinches and
  // says so (f.hitT, f.ouch), a hen flicks its tail and runs (the hero is close, so it flees him anyway)
  const FOLK_OUCH = [TXT('FOLK_OUCH'), TXT('FOLK_OUCH.2'), TXT('FOLK_OUCH.3'), TXT('FOLK_OUCH.4')];
  function hitFolk(S, R, x, y, rad, ax, arc) { if (!R.town || !R.folk) return;
    for (const f of R.folk) { const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy); if (d > rad + 12) continue;
      if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) continue; if (S.t - (f.hitT ?? -9) < 0.6) continue;
      f.hitT = S.t; if (f.role === 'hen') { f.scareT = S.t; f.goal = null; ev(S, { k: 'hen', x: f.x, y: f.y }); continue; }
      f.ouch = ((f.ouch ?? -1) + 1) % FOLK_OUCH.length; ev(S, { k: 'say', x: f.x, y: f.y, role: f.role, ouch: 1 }); } }
  function hitProps(S, R, x, y, rad, ax, arc, bonesOnly = false) {
    const m = R.map, hit = R.propHit || (R.propHit = {});
    // things on a wall are struck at their foot on the floor (the wall cell blocks the line), the event stays at the thing
    const knock = (id, p, n, mat = D.PROP_MAT[n] || 'stone', foot = p) => { const dx = foot.x - x, dy = foot.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 18) return false; if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) return false; if (!losClear(m, x, y, foot.x, foot.y)) return false;
      if (S.t - (hit[id] ?? -9) < 0.2) return false; hit[id] = S.t;
      if (mat === 'stone' || mat === 'metal') R.trauma = Math.min(1, R.trauma + 0.06);
      if (n !== 'merchant') ev(S, { k: 'prop', x: p.x, y: p.y, i: id, n, mat, scale: p.s || 1, s: dx >= 0 ? 1 : -1 }); return true; };
    m.decor.forEach((d, i) => { if (hidden(m, d)) return;
      if (d.n === 'bones' || d.n === 'skel_cv' || d.n === 'skel_mg') knock('d' + i, d, d.n);
      else if (bonesOnly) return;
      // the magma caves' dead things answer a blow too (TASKS 466): a crack spits embers, a chain fence clinks and swings
      else if (d.n === 'vent_mg') knock('d' + i, d, d.n);
      else if (d.n === 'fence_mg') { const f = { x: Math.max(d.x, Math.min(d.x + d.len, x)), y: d.y }; knock('d' + i, f, d.n, 'chain', f); }
      else if (d.n === 'candles' && !d.lift && (d.outUntil || 0) <= S.t) {
        if (knock('d' + i, d, d.n, 'wax')) { d.outUntil = S.t + 3; ev(S, { k: 'snuff', x: d.x, y: d.y }); } }
      else if (/^shroom_[ab]$/.test(d.n)) knock('d' + i, d, d.n, 'fungus');
      else if (d.wall && d.n === 'shop_sign') knock('d' + i, d, d.n, 'wood', { x: d.x, y: d.y + 30 });
      else if (d.n === 'coffin') { if (knock('d' + i, d, d.n)) coffinWakes(S, R, d); }
      else if (d.n === 'wreck_cv') { if (!d.broken && knock('d' + i, d, d.n)) hitWreck(S, R, d); }
      else if (d.solid && !d.wall) knock('d' + i, d, d.n);
      else if (d.wall && d.n === 'banner' && d.secret === undefined && !hidden(m, d)) knock('d' + i, d, 'banner', 'cloth', { x: d.x, y: d.y + 30 }); });
    if (bonesOnly) return;
    if (m.shop && R.shop && S.t - (R.shop.hitT ?? -9) >= 0.7 && knock('merchant', m.shop, 'merchant', 'cloth')) {
      R.shop.hitT = S.t; R.shop.hitLine = ((R.shop.hitLine ?? -1) + 1) % D.SHOP.hitLines.length;
      ev(S, { k: 'merchantHit', x: m.shop.x, y: m.shop.y }); }
    m.torches.forEach((t2, i) => { if (hidden(m, t2)) return; if (t2.kind !== 'wall') knock('t' + i, t2, 'brazier', D.PROP_MAT[t2.kind] || D.PROP_MAT.brazier);
      else knock('t' + i, t2, 'torch_sconce', 'metal', t2.side ? t2 : { x: t2.x, y: t2.y + 30 }); });
  }
  // what is summoned stays out of the 100 % count, so on a cleared floor (TASKS 1344, 1686) nothing is let out of a coffin, a wreck or a chest
  const cleared = (R) => { const f = fstat(R); return f.kills >= f.foes; };
  // the first blow on a coffin rolls for its tenant; a room lets out one at most (TASKS 1353)
  function coffinWakes(S, R, d) { const m = R.map; if (d.rolled) return; d.rolled = 1; if (cleared(R)) return; m.coffinR = m.coffinR || {}; const room = d.r ?? DG.roomAt(m, d.x, d.y); if (m.coffinR[room] || rnd(R) >= D.COFFIN.p(dep(R))) return;
    const x = d.x, y = [d.y + 30, d.y - 26, d.y + 42].find((v) => !SIMX.solidAt(m, x, v, true)); if (y === undefined) return; m.coffinR[room] = 1; const E = ENEMIES.skeleton, f = dep(R), hp = Math.round(E.hp * BAL.hp * dif(R, 'hp') * D.hpAt(f));
    R.en.push({ id: R.nextId++, type: 'skeleton', x, y, vx: 0, vy: 0, hp, max: hp, dmg: E.dmg * BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob, elite: 0, room, st: 'rise', t0: S.t, riseD: D.COFFIN.rise, coffinT: S.t, coffX: d.x, coffY: d.y, face: R.hero.x >= x ? 1 : -1, aimA: 0, cdT: S.t + D.COFFIN.rise + 0.3, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: 'amb', spawnT: S.t, seenT: S.t, hx: x, hy: y, ft: -9 });
    d.openT = S.t; ev(S, { k: 'summon', x: d.x, y: d.y - 14 }); R.msg = { s: TXT('sim_world.coffin.msg'), t: S.t, d: 2 }; }
  // a wreck gives way to its third blow (TASKS 1361): what was left aboard, or who was
  function hitWreck(S, R, d) { const m = R.map, W0 = D.WRECK; d.hits = (d.hits || 0) + 1; if (d.hits < W0.hp) return;
    d.broken = 1; d.brokeT = S.t; d.solid = 0; const k = Math.floor(d.y / TILE) * m.W + Math.floor(d.x / TILE); m.block = m.block.filter((b) => b !== k); ev(S, { k: 'break', x: d.x, y: d.y, kind: 'crate' }); R.trauma = Math.min(1, R.trauma + 0.3);
    if (rnd(R) < W0.loot) { drop(R, d.x, d.y + 10, { kind: 'item', item: rollItem(R, dep(R), W0.q, undefined, W0) }); drop(R, d.x, d.y + 10, { kind: 'gold', n: ri(R, 8, 16) + dep(R) * 2 }); return; }
    if (cleared(R)) return;
    const E = ENEMIES.ghost, f = dep(R), n = ri(R, W0.ghosts[0], W0.ghosts[1]), hp = Math.round(E.hp * BAL.hp * dif(R, 'hp') * D.hpAt(f)), room = DG.roomAt(m, d.x, d.y);
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + rnd(R), x = d.x + Math.cos(a) * 56, y = d.y + 10 + Math.sin(a) * 40; R.en.push({ id: R.nextId++, type: 'ghost', x, y, vx: 0, vy: 0, hp, max: hp, dmg: E.dmg * BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob, elite: 0, room, st: 'chase', t0: S.t, face: R.hero.x >= x ? 1 : -1, aimA: 0, cdT: S.t + 0.9, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: 'amb', spawnT: S.t, seenT: S.t, hx: x, hy: y, ft: -9 }); ev(S, { k: 'summon', x, y }); }
    R.msg = { s: TXT('sim_world.wreck.msg'), t: S.t, d: 2 }; }
  function hitChests(S, R, x, y, rad, ax, arc) {
    for (const c of R.chests) { if (c.open || c.sealed) continue; const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 16) continue; if (arc !== undefined && d > 14 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.3) continue; if (!losClear(R.map, x, y, c.x, c.y)) continue; openChest(S, R, c); } }
  // a secret's fake wall: its foot (q.x, q.y) is the middle of the opening on the host side. Blows land on a breakable wall,
  // a banner or a bookshelf in front of it if it is in reach and in the arc; a mechanism has to be found and worked instead
  const secretAt = (m, tx, ty) => (m.secrets || []).find((q) => !q.open && q.wall.some(([x, y]) => x === tx && y === ty));
  const kindOf = (q) => q.kind || 'crack';
  function hitSecrets(S, R, x, y, rad, ax, arc) {
    for (const q of R.map.secrets || []) { if (q.open) continue; const fy = q.y + (kindOf(q) === 'shelf' || kindOf(q) === 'statue' ? 22 : 0), dx = q.x - x, dy = fy - (y - 10), d = Math.hypot(dx, dy);
      if (d > rad + 26) continue; if (arc !== undefined && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.35) continue; if (!losClear(R.map, x, y, q.x, fy)) continue; hitSecret(S, R, q); } }
  function hitSecret(S, R, q) {
    if (S.t - (q.hitT ?? -9) < 0.2) return;
    q.hitT = S.t; if (kindOf(q) === 'lever') { ev(S, { k: 'hollow', x: q.x, y: q.y - 20 }); return; }
    if (kindOf(q) === 'banner') { openSecret(S, R, q); return; }
    if (kindOf(q) === 'statue') { ev(S, { k: 'hollow', x: q.x, y: q.y - 20 }); return; }
    q.hp--; R.trauma = Math.min(1, R.trauma + 0.2);
    if (q.hp > 0) { if (kindOf(q) === 'crack') ev(S, { k: 'wallhit', x: q.x, y: q.y - 20, i: R.map.secrets.indexOf(q) }); return; }
    openSecret(S, R, q);
  }
  function openSecret(S, R, q, quiet) {
    const m = R.map, i = m.secrets.indexOf(q), kind = kindOf(q); q.open = 1; q.openT = S.t; for (const [x, y] of q.wall) m.cells[y * m.W + x] = 1;
    if (quiet) { if (kind === 'shelf') shelfOf(m, i, false); if (kind === 'statue') statueOf(m, i, q, false); return; }
    if (kind === 'statue') { statueOf(m, i, q, false); R.trauma = Math.min(1, R.trauma + 0.25); }
    if (kind === 'crack') { for (let k = 0; k < 4; k++) m.decals.push({ x: q.x - 22 + k * 15, y: q.y - 6 - (k % 2) * 22, n: 'dc_rubble', f: k & 1, s: 0.8 + 0.1 * k }); R.trauma = Math.min(1, R.trauma + 0.45); R.freeze = Math.max(R.freeze, 0.06); }
    if (kind === 'shelf') { shelfOf(m, i, false);
      for (let k = 0; k < 3; k++) m.decals.push({ x: q.x - 30 + k * 30, y: q.y + 24 + (k % 2) * 8, n: k === 1 ? 'dc_straw' : 'dc_rubble', f: k & 1, s: 0.9 }); R.trauma = Math.min(1, R.trauma + 0.35); }
    if (kind === 'lever') R.trauma = Math.min(1, R.trauma + 0.3);
    fstat(R).sec++;
    ev(S, { k: 'secret', x: q.x, y: q.y - 20, i, kind }); R.msg = { s: TXT('sim_world.openSecret.msg.s'), t: S.t };
    giveShards(S, R, REWARD.secret, q.x, q.y - 20); checkFull(S, R);
  }
  // a secret's bookshelf standing (it blocks its cell) or broken (it does not)
  function shelfOf(m, i, stand) { const d = m.decor.find((o) => o.secret === i); if (!d) return; const k = Math.floor(d.y / TILE) * m.W + Math.floor(d.x / TILE);
    d.solid = stand ? 1 : 0; d.broken = stand ? 0 : 1; m.block = m.block.filter((b) => b !== k); if (stand) m.block.push(k); }
  // a secret's statue on its plinth over the opening or slid aside: only ever one of the two cells is blocked
  function statueOf(m, i, q, stand) { const d = m.decor.find((o) => o.secret === i); if (!d) return; const cellOf = (o) => Math.floor(d.y / TILE) * m.W + Math.floor(o / TILE), at0 = stand ? q.x + q.slide : q.x, at1 = stand ? q.x : q.x + q.slide;
    m.block = m.block.filter((b) => b !== cellOf(at0)); d.x = at1; if (!m.block.includes(cellOf(at1))) m.block.push(cellOf(at1)); }
  // debug: open every secret of the floor without counting it; again, seal the ones it opened (a hero inside is put back in front)
  function debugSecrets(S, R) { const m = R.map, h = R.hero;
    if (!R.dbgOpen) { R.dbgOpen = []; m.secrets.forEach((q, i) => { if (!q.open) { openSecret(S, R, q, true); R.dbgOpen.push(i); } }); return; }
    const htx = Math.floor(h.x / TILE), hty = Math.floor(h.y / TILE);
    for (const i of R.dbgOpen) { const q = m.secrets[i], r = m.rooms[q.room]; q.open = 0; q.hp = 2; q.hitT = -9; delete q.openT; if (q.trig) delete q.trig.downT;
      for (const [x, y] of q.wall) m.cells[y * m.W + x] = 4; if (kindOf(q) === 'shelf') shelfOf(m, i, true); if (kindOf(q) === 'statue') statueOf(m, i, q, true);
      if (q.hide.includes(hty * m.W + htx) || (htx >= r.x && htx < r.x + r.w && hty >= r.y && hty < r.y + r.h)) { h.x = q.x - q.dx * 40 + (q.dy ? 0 : 0); h.y = q.y - q.dy * 40 + (kindOf(q) === 'shelf' ? 40 : 0); h.vx = h.vy = 0; } }
    R.dbgOpen = null; }
  // debug: every item of loot this floor still holds, where it is and whether the hero can get to it, and the books: what the
  // floor counted must equal what was picked up plus what still lies about plus what the closed chests hold
  function lootAudit(R) { const m = R.map, f = fstat(R), hid = secretMask(m), blk = new Set(m.block), h = R.hero;
    const seen = new Uint8Array(m.W * m.H), st = [Math.floor(h.y / TILE) * m.W + Math.floor(h.x / TILE)]; seen[st[0]] = 1;
    while (st.length) { const k = st.pop(); for (const d of [1, -1, m.W, -m.W]) { const n = k + d, c = m.cells[n]; if (!seen[n] && (c === 1 || c === 4 || c === 5) && !blk.has(n)) { seen[n] = 1; st.push(n); } } }
    const near = (x, y) => { const k = Math.floor(y / TILE) * m.W + Math.floor(x / TILE); return [k, k + 1, k - 1, k + m.W, k - m.W].some((n) => seen[n]); };
    const B = propBoxes(R), where = (x, y, item) => { const k = Math.floor(y / TILE) * m.W + Math.floor(x / TILE); return !near(x, y) || (item && behindProp(B, x, y)) ? 'stuck' : hid.has(k) || m.cells[k] === 4 ? 'secret' : 'open'; };
    const items = R.drops.filter((d) => d.loot && !d.got && d.kind === 'item').map((d) => ({ x: d.x, y: d.y, n: 1, at: where(d.x, d.y, d.rest === DROP_REST && !(d.fly > 0)), chest: 0 }));
    const chests = R.chests.filter((c) => (!c.open || c.woke) && c.loot && c.loot.length).map((c) => ({ x: c.x, y: c.y, n: c.loot.length, at: where(c.x, c.y), chest: 1 }));
    const lying = items.length, boxed = chests.reduce((n, c) => n + c.n, 0);
    // a quest's keepsake (TASKS 1020) must be reachable as any loot, though it is no part of the floor's books
    const keeps = R.drops.filter((d) => d.kind === 'qitem' && !d.got).map((d) => ({ x: d.x, y: d.y, n: 1, at: where(d.x, d.y, d.rest === DROP_REST && !(d.fly > 0)), chest: 0, quest: 1 }))
      .concat(R.chests.filter((c) => !c.open && c.quest).map((c) => ({ x: c.x, y: c.y, n: 1, at: where(c.x, c.y), chest: 1, quest: 1 })));
    return { total: f.lootN, got: f.loot, lying, boxed, list: items.concat(chests, keeps), stuck: items.concat(chests, keeps).filter((o) => o.at === 'stuck').length, off: f.lootN - f.loot - lying - boxed }; }
  // a blow tears the webs in its reach (the feet of the hero's own web too), fire burns them
  function tearWebs(S, R, x, y, rad, ax, arc, fire) {
    for (const egg of R.eggs || []) if (egg.hp > 0 && Math.hypot(egg.x - x, egg.y - y) < rad + 15 && (!arc || Math.abs(angDiff(Math.atan2(egg.y - y, egg.x - x), ax)) < arc / 2) && losClear(R.map, x, y, egg.x, egg.y)) {
      egg.hp = 0; ev(S, { k: 'webburn', x: egg.x, y: egg.y });
    }

    (R.map.webs || []).forEach((w, i) => { if (w.torn) return; const dx = w.x - x, dy = w.y - y, d = Math.hypot(dx, dy);
      if (d > rad + 20 * w.s) return; if (arc !== undefined && d > 24 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.35) return;
      tearWeb(S, w, i, fire); }); }
  const tearWeb = (S, w, i, fire) => { w.torn = 1; w.tornT = S.t; ev(S, { k: fire ? 'webburn' : 'webtear', x: w.x, y: w.y, i }); };
  // an arrow tears every web its flight crosses, over the web's own ellipse (the shot's step is shorter than the web, so the point
  // under it each step is enough), and flies on (TASKS 1693)
  function arrowWebs(S, R, x, y) { const WEB = SIMX.WEB; (R.map.webs || []).forEach((w, i) => { if (!w.torn && Math.abs(x - w.x) < WEB.rx * w.s && Math.abs(y - w.y) < WEB.ry * w.s) tearWeb(S, w, i); }); }
  function springAmbush(S, R, P) {
    const m = R.map, h = R.hero, f = dep(R), room = m.rooms[P.room];
    if (!room || P.fired) return false;
    P.fired = 1;
    const roster = D.rosterAt(m.biome, R.floor).filter((t) => !D.BOSSES[t] && !ENEMIES[t].lurk && !ENEMIES[t].deep && ENEMIES[t].kind !== 'salamander');
    if (!roster.length) return false;
    const group = Array.from({ length: P.n }, () => pick(R, roster)), radius = Math.max(...group.map((t) => ENEMIES[t].r)), obstacles = SIMX.solids(R), block = new Set(m.block || []);
    const inside = (x, y) => x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h;
    const walk = (x, y) => inside(x, y) && cell(m, x, y) === 1 && !block.has(y * m.W + x);
    const seen = new Set(), queue = [[Math.floor(h.x / TILE), Math.floor(h.y / TILE)]];
    while (queue.length) {
      const [x, y] = queue.pop(), k = y * m.W + x; if (seen.has(k) || !walk(x, y)) continue;
      seen.add(k); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push([x + dx, y + dy]);
    }
    const candidates = [];
    for (const k of seen) {
      const x = (k % m.W + 0.5) * TILE, y = (Math.floor(k / m.W) + 0.5) * TILE;
      if (Math.hypot(x - h.x, y - h.y) < 96 || hidden(m, { x, y })) continue;
      if ([-radius, 0, radius].some((dx) => [-radius, 0, radius].some((dy) => !walk(Math.floor((x + dx) / TILE), Math.floor((y + dy) / TILE))))) continue;
      if (obstacles.some((o) => Math.hypot(x - o.x, y - o.y) < radius + o.r + 4) || R.en.some((e) => e.deadT < 0 && Math.hypot(x - e.x, y - e.y) < radius + ENEMIES[e.type].r + 4)) continue;
      candidates.push({ x, y });
    }
    for (let i = candidates.length - 1; i > 0; i--) { const j = ri(R, 0, i); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
    const positions = [];
    for (const p of candidates) if (positions.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 2 * radius + 4)) { positions.push(p); if (positions.length === group.length) break; }
    if (positions.length !== group.length) return false;
    const sc = BAL.hp * dif(R, 'hp') * D.hpAt(f), dc = BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob;
    for (let i = 0; i < group.length; i++) {
      const { x, y } = positions[i], type = group[i], E = ENEMIES[type], hp = Math.round(E.hp * sc);
      R.en.push({ id: R.nextId++, type, x, y, vx: 0, vy: 0, hp, max: hp, dmg: E.dmg * dc, elite: 0, room: P.room, st: 'chase', t0: S.t, face: x < h.x ? 1 : -1, aimA: 0,
        cdT: S.t + 0.8, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: 'amb', spawnT: S.t, seenT: S.t, hx: x, hy: y, ft: -9 });
      ev(S, { k: 'summon', x, y });
    }
    P.downT = S.t; ev(S, { k: 'ambush', x: h.x, y: h.y });
    R.trauma = Math.min(1, R.trauma + 0.3); R.msg = { s: TXT('sim_world.springAmbush.msg.s'), t: S.t, d: 2, room: P.room }; return true;
  }
  // a door opens to a press of E or a blow (a kick, it flies open), unless it is locked: a key the hero carries opens the lock for
  // good, a lever opens every door of its lock at once
  const doorAt = (m, tx, ty) => (m.doors || []).find((d) => !d.open && d.cells.some(([x, y]) => x === tx && y === ty));
  const doorNear = (R, reach) => { const h = R.hero; return (R.map.doors || []).find((d) => !d.open && Math.hypot(d.x - h.x, d.y - h.y + 10) < reach); };
  // an open door's leaf stands on its hinge side and keeps the cells it is drawn over: a top or bottom wall's, edge-on, the left one of the two
  // door cells; a side wall's, ajar at ~60° from the gap's upper end, the upper cell of the door and the corridor cell beyond it
  // (the boss arena's doors stand open from the start and have no leaf)
  const leafCells = (d) => { if (d.arena) return []; const [x, y] = d.cells[0]; return d.dir === 'l' ? [[x, y], [x - 1, y]] : d.dir === 'r' ? [[x, y], [x + 1, y]] : [[x, y]]; };
  function openDoor(S, R, d, kick) {
    const m = R.map, h = R.hero, L = doorLock(m, d), i = m.doors.indexOf(d);
    if (d.arena && R.arena && R.arena.active) return;
    if (L) { if (L.kind !== 'key' || !(R.keys > 0)) { if (S.t - (d.nopeT ?? -9) > 1) { d.nopeT = S.t; ev(S, { k: 'locked', x: d.x, y: d.y, i });
          ev(S, { k: 'nope', x: h.x, y: h.y, s: L.kind === 'key' ? TXT('sim_world.openDoor.s') : TXT('sim_world.openDoor.s.2') }); } return; }
      R.keys--; L.open = 1; L.openT = S.t; ev(S, { k: 'unlatch', x: d.x, y: d.y, i }); R.msg = { s: TXT('sim_world.openDoor.msg.s'), t: S.t }; }
    d.open = 1; d.openT = S.t; d.kick = kick ? 1 : 0; for (const [x, y] of d.cells) m.cells[y * m.W + x] = 1;
    for (const [x, y] of leafCells(d)) if (!m.block.includes(y * m.W + x)) m.block.push(y * m.W + x);
    if (kick) R.trauma = Math.min(1, R.trauma + 0.15);
    ev(S, { k: 'door', x: d.x, y: d.y, i, kick: d.kick });
  }
  function hitDoors(S, R, x, y, rad, ax, arc) {
    for (const d of R.map.doors || []) { if (d.open) continue; const dx = d.x - x, dy = d.y - (y - 10), dd = Math.hypot(dx, dy);
      if (dd > rad + 24) continue; if (arc !== undefined && dd > 20 && Math.abs(angDiff(Math.atan2(dy, dx), ax)) > arc / 2 + 0.35) continue; openDoor(S, R, d, 1); } }
  // a lever on a top wall, worked from in front of it like a sconce
  const leverNear = (R) => { const h = R.hero; return (R.map.locks || []).find((L) => L.kind === 'lever' && !L.open && Math.abs(h.x - L.lever.x) < 36 && h.y > L.lever.y && h.y - L.lever.y < 90); };
  function pullLever(S, R, L) {
    const m = R.map, li = m.locks.indexOf(L); L.open = 1; L.openT = S.t; R.trauma = Math.min(1, R.trauma + 0.25);
    ev(S, { k: 'lever', x: L.lever.x, y: L.lever.y, i: li });
    for (const d of m.doors) if (d.lock === li && !d.open) openDoor(S, R, d, 0);
    R.msg = { s: TXT('sim_world.pullLever.msg.s'), t: S.t };
  }
  // the secret a press of E works from where the hero stands: a banner to tear down, a sconce to pull
  function secretUnder(R) { const h = R.hero, m = R.map;
    return (m.secrets || []).find((q) => { if (q.open) return false;
      if (kindOf(q) === 'banner') return Math.abs(h.x - q.x) < 40 && h.y > q.y && h.y - q.y < 64;
      if (kindOf(q) === 'statue') return Math.abs(h.x - q.x) < 56 && h.y > q.y && h.y - q.y < 104;
      if (q.trig && q.trig.k === 'sconce') { const t = m.torches[q.trig.t]; return t && Math.abs(h.x - t.x) < 36 && h.y > t.y && h.y - t.y < 90; } return false; }); }
  function openChest(S, R, c) {
    if (c.open) return;
    if (c.mimic) { wakeMimic(S, R, c); return; }
    if (c.sealed) { if (S.t - (c.nopeT ?? -9) > 1) { c.nopeT = S.t; ev(S, { k: 'nope', x: R.hero.x, y: R.hero.y, s: TXT('sim_world.openChest.sealed') }); } return; }
    const room = DG.roomAt(R.map, c.x, c.y), role = R.map.rooms[room];
    c.open = 1; c.openT = S.t; ev(S, { k: 'chest', x: c.x, y: c.y, tier: c.tier, boss: c.boss ? 1 : 0 }); R.trauma = Math.min(1, R.trauma + (c.boss ? 0.3 : c.tier === 3 ? 0.12 : 0));
    if (c.trap) { c.fuseT = S.t + D.CHEST_TRAP.fuse; ev(S, { k: 'trapfuse', x: c.x, y: c.y, d: D.CHEST_TRAP.fuse }); }
    // its items were rolled on entering the floor (they count toward the floor's loot from the start); a chest from an older save rolls now
    const pre = !!c.loot; for (const it of c.loot || chestLoot(R, c)) drop(R, c.x, c.y + 10, { kind: 'item', item: it, pre });
    c.loot = [];
    if (!c.ambushRolled) {
      c.ambushRolled = 1;
      if (role && (role.type === 'treasure' || role.type === 'secret') && !cleared(R) && rnd(R) < 0.05 * ((D.FLOOR_MODS[R.map.mod] || {}).ambush || 1)) springAmbush(S, R, { room, n: ri(R, 2, 4), x: c.x, y: c.y });
    }
    if (c.key !== undefined) drop(R, c.x, c.y + 10, { kind: 'key', lock: c.key });
    if (c.quest && (R.quests || []).some((q) => q.id === c.quest)) drop(R, c.x, c.y + 10, { kind: 'qitem', quest: c.quest, ic: c.qic });
    const pay = c.boss ? c.pay || 0 : c.tier; if (pay) drop(R, c.x, c.y + 10, { kind: 'gold', n: Math.round((10 + dep(R) * 6 + ri(R, 0, 10)) * pay) });
  }
  // a mimic gets up off its chest's place; the chest stays in the list, loot and all, until the mimic dies
  function wakeMimic(S, R, c) { const E = ENEMIES.mimic, f = dep(R), h = R.hero, hp = Math.round(E.hp * BAL.hp * dif(R, 'hp') * D.hpAt(f)), id = R.nextId++;
    c.open = 1; c.openT = S.t; c.woke = id; c.ambushRolled = 1;
    R.en.push({ id, type: 'mimic', tier: c.tier, x: c.x, y: c.y, vx: 0, vy: 0, hp, max: hp, dmg: E.dmg * BAL.dmg * 1.35 * D.dmgAt(f) * STAGE(R).mob, elite: 0, room: DG.roomAt(R.map, c.x, c.y), st: 'rise', t0: S.t, face: h.x >= c.x ? 1 : -1, aimA: 0, cdT: S.t + E.rise + 0.25, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, summ: 'mimic', spawnT: S.t, seenT: S.t, hx: c.x, hy: c.y, ft: -9 });
    ev(S, { k: 'mimicwake', x: c.x, y: c.y, id }); R.trauma = Math.min(1, R.trauma + 0.3); R.msg = { s: TXT('sim_world.mimic.msg'), t: S.t, d: 2 }; }
  function mimicLoot(S, R, e) { const c = R.chests.find((o) => o.woke === e.id); if (!c) return;
    for (const it of c.loot || []) drop(R, e.x, e.y, { kind: 'item', item: it, pre: true }); c.loot = [];
    drop(R, e.x, e.y, { kind: 'gold', n: Math.round((10 + dep(R) * 6 + ri(R, 0, 10)) * 3) }); }
  // a trapped chest's blast, its fuse lit by the opening: it hurts, but it does not end a run on its own
  function stepChestTraps(S, R) { const h = R.hero, T = D.CHEST_TRAP;
    for (const c of R.chests) { if (!c.fuseT || S.t < c.fuseT) continue; c.fuseT = 0; c.bangT = S.t; ev(S, { k: 'trapbang', x: c.x, y: c.y, r: T.r }); ev(S, { k: 'boom', x: c.x, y: c.y - 20, big: 1, r: T.r }); R.trauma = Math.min(1, R.trauma + 0.5);
      if (Math.hypot(h.x - c.x, h.y - c.y) < T.r && h.hp > 1) { SIMX.hurtHero(S, R, Math.min(SIMX.heroSt(S).maxHp * T.hp, h.hp - 1), c.x, c.y - 10, 'spike'); if (S.t === h.hurtT) R.msg = { s: TXT('sim_world.chestTrap.msg'), t: S.t }; } } }
  // a boss's own chest holds what the boss used to drop (TASKS 1356): the same items in a better place, no new loot
  // rolled at the win, when the boss's own drop used to be, so the run's random stream keeps its order
  function bossLoot(R, b) { const its = SIMX.chapterEnd(R, b) ? LOOT.boss.map((o) => rollItem(R, dep(R), o.q, undefined, o)) : LOOT.mini.items.map((o) => rollItem(R, dep(R), o.q, undefined, o)); for (const it of its) it.id = R.nextId++; return its; }
  function chestLoot(R, c) { if (c.boss) return [];
    const LT = c.mimic ? Object.assign({}, LOOT.chest[3], { n: LOOT.chest[c.tier].n }) : LOOT.chest[c.tier], out = [], Y = c.hall && D.MAGMA_HALLS.kinds[c.hall] ? D.MAGMA_HALLS.kinds[c.hall].pay : {};
    // (a magma hall's own pay, TASKS 1054: the forge's arms, the prison's stash)
    if (Y.forge) for (let i = 0; i < Y.forge.n; i++) out.push(rollItem(R, dep(R), LT.q, Y.forge.slots[Math.floor(rnd(R) * Y.forge.slots.length)], Object.assign({}, LT, { min: Y.forge.min })));
    else if (LT.p === undefined || rnd(R) < LT.p) for (let i = 0; i < LT.n; i++) out.push(rollItem(R, dep(R), i ? LT.q * 0.8 : LT.q, undefined, LT));
    if (Y.stash) for (const [b, n] of Object.entries(Y.stash)) if (!SIMX.useless(R, b)) out.push(potion(b, n));
    if (rnd(R) < POT.chest) out.push(potion('hp_potion')); if (rnd(R) < (R.viaTown ? POT.scrollTown : POT.scroll)) out.push(potion('scroll'));
    for (const it of out) it.id = R.nextId++; return out; }

  Object.assign(SIMX, { setTrap,
    usePotion, wearIfFree, bossFight, readStep, useItem, castAbility, heroShot, stepTraps, breakPots, FOLK_OUCH, hitFolk, hitProps, hitChests, secretAt, kindOf,
    hitSecrets, hitSecret, openSecret, shelfOf, statueOf, debugSecrets, lootAudit, tearWebs, arrowWebs, springAmbush, doorAt, doorNear, openDoor, hitDoors, leafCells,
    leverNear, pullLever, secretUnder, openChest, chestLoot, bossLoot, stepChestTraps, mimicLoot, hitWreck, coffinWakes });
})(typeof window !== 'undefined' ? window : globalThis);
