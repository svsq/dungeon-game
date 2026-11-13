// live/sim_powers.js — the powers (R-21, TASKS 356): firePowers and the effects of data_powers.js.
// One of the sim's files (ARCHITECTURE.md §4.2): names from earlier files come from SIMX at load, calls into later ones go through SIMX.
(function (root) {
  const SIMX = root.SIMX;
  const { D, ENEMIES, K, TILE, addFire, cell, ev, heroSt, hitEnemy, losClear, rnd, under } = SIMX;
  const targets = (R, x, y, r) => R.en.filter((e) => e.deadT < 0 && !under(e) && Math.hypot(e.x - x, (e.y - y) * 1.3) < r + ENEMIES[e.type].r && losClear(R.map, x, y, e.x, e.y));
  const atk = (S, P, ctx) => { const st = heroSt(S); return Math.max(1, Math.round((ctx.dmg ?? (P.spell ? st.spellBase * st.spell : st.atk)) * P.k)); };
  const pos = (R, ctx) => [ctx.x ?? R.hero.x, ctx.y ?? R.hero.y];
  const heavy = (e) => ENEMIES[e.type].heavy || e.elite || ENEMIES[e.type].ghost || ENEMIES[e.type].deep || D.BOSSES[e.type];
  function patch(S, R, P, x, y, dmg) { if (cell(R.map, Math.floor(x / TILE), Math.floor(y / TILE)) !== 1) return false;
    addFire(R, S, x, y, { own: 'hero', who: 'hero', r: P.fr || 26, ry: P.ry || 0.7, t: P.t, dmg, per: P.per || 0.5, kind: 'flame' }); return true; }
  function burst(S, R, x, y, r, dmg, kb, kind) { for (const e of targets(R, x, y, r)) hitEnemy(S, R, e, dmg, false, x, y, kb, kind); }
  function boom(S, R, x, y) { ev(S, { k: 'boom', x, y: y - 20, gx: x, gy: y }); R.trauma = Math.min(1, R.trauma + 0.15); }
  const FX = {
    nova(S, R, P, ctx) { const [x, y] = pos(R, ctx); burst(S, R, x, y, P.r, atk(S, P, ctx), P.kb ?? 0.8, P.fire ? 'fire' : 'thorns'); boom(S, R, x, y); },
    bolt(S, R, P, ctx) { const [x, y] = pos(R, ctx), e = targets(R, x, y, P.r).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0]; if (!e) return;
      const a = Math.atan2(e.y - y, e.x - x), B = D.SHOTS[P.shot || 'bolt']; R.proj.push({ id: R.nextId++, k: B.k, single: 1, x, y: y - 40, vx: Math.cos(a) * B.spd, vy: Math.sin(a) * B.spd, t0: S.t, life: B.life, own: 'hero', r: B.r, kb: B.kb, crit: 0, dmg: atk(S, P, ctx), gz: 20, pierce: 0 }); },
    split(S, R, P, ctx) { for (const p of (ctx.projs || []).slice()) for (const s of [-1, 1]) { const a = Math.atan2(p.vy, p.vx) + s * P.a, v = Math.hypot(p.vx, p.vy);
      R.proj.push(Object.assign({}, p, { id: R.nextId++, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dmg: Math.max(1, Math.round(p.dmg * P.k)) })); } },
    pierce(S, R, P, ctx) { for (const p of ctx.projs || []) p.pierce = (p.pierce || 0) + P.n; },
    // the most shards of all it holds, so the comet over the plain shatter gives the same ball whatever order they were taken in
    shatter(S, R, P, ctx) { for (const p of ctx.projs || []) if (!p.frag || p.frag.n < P.n) p.frag = { n: P.n, a: P.a, k: P.k, first: P.first, life: P.life }; },
    chain(S, R, P, ctx) { let c = ctx.e; const dmg = atk(S, P, ctx), done = new Set(c ? [c.id] : []); for (let i = 0; c && i < P.n; i++) { const n = targets(R, c.x, c.y, P.r).filter((e) => !done.has(e.id)).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0]; if (!n) return;
      done.add(n.id); hitEnemy(S, R, n, dmg, false, c.x, c.y, 0.3, 'thorns'); ev(S, { k: 'pop', x: n.x, y: n.y - ENEMIES[n.type].h * 0.5, c: 'bolt', hit: 1, mine: 1 }); c = n; } },
    burnGround(S, R, P, ctx) { const [x, y] = pos(R, ctx), dmg = atk(S, P, ctx);
      if (P.shape === 'ring') { const r = (ctx.r || 100) * 0.85; for (let i = 0; i < P.n; i++) { const a = i / P.n * Math.PI * 2; patch(S, R, P, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, dmg); } }
      else if (P.shape === 'line') { const n = Math.max(1, Math.round((ctx.len || 0) / P.gap)); for (let i = 0; i <= n; i++) if (!patch(S, R, P, x + ctx.dx * i * P.gap, y + ctx.dy * i * P.gap, dmg)) break; }
      else patch(S, R, P, x, y, dmg); },
    pull(S, R, P, ctx) { const [x, y] = pos(R, ctx); for (const e of targets(R, x, y, P.r)) { if (heavy(e)) continue; const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy) || 1, go = Math.max(0, d - P.to); e.kbx = dx / d * go * 10; e.kby = dy / d * go * 10; } },
    heal(S, R, P) { const h = R.hero, st = heroSt(S); h.hp = Math.min(st.maxHp, h.hp + st.maxHp * P.v); },
    mana(S, R, P) { const h = R.hero, st = heroSt(S); h.mp = Math.min(st.maxMp, h.mp + st.maxMp * P.v); },
    slow(S, R, P, ctx) { const [x, y] = pos(R, ctx); for (const e of ctx.e && !P.r ? [ctx.e] : targets(R, x, y, P.r)) SIMX.chill(S, e, P.t, P.slow); },
    stun(S, R, P, ctx) { const [x, y] = pos(R, ctx); for (const e of ctx.e && !P.r ? [ctx.e] : targets(R, x, y, P.r)) { const hold = D.BOSSES[e.type] ? P.boss : P.t; e.rootT = S.t + hold; e.cdT = Math.max(e.cdT || 0, S.t + hold); if (e.st === 'wind') { e.st = 'chase'; e.t0 = S.t; } } },
    shieldBurst(S, R, P, ctx) { const [x, y] = pos(R, ctx); if (P.k) burst(S, R, x, y, P.r, Math.max(1, Math.round((ctx.left || 0) * P.k)), P.kb ?? 1, 'thorns'); else for (const e of targets(R, x, y, P.r)) { if (heavy(e)) continue; const d = Math.hypot(e.x - x, e.y - y) || 1; e.kbx = (e.x - x) / d * 300 * P.kb; e.kby = (e.y - y) / d * 300 * P.kb; } boom(S, R, x, y); },
    shieldMore(S, R, P) { R.hero.shieldUntil += P.t; },
    shieldAdd(S, R, P) { R.hero.shield = Math.round(R.hero.shield * (1 + P.k)); },
    proj(S, R, P, ctx) { for (const p of ctx.projs || []) { if (P.dmg) p.dmg = Math.max(1, Math.round(p.dmg * P.dmg)); if (P.spd) { p.vx *= P.spd; p.vy *= P.spd; p.life /= P.spd; } if (P.kb) p.kb = (p.kb ?? 1) * P.kb; } },
    strike(S, R, P, ctx) { if (ctx.e) hitEnemy(S, R, ctx.e, atk(S, P, ctx), false, R.hero.x, R.hero.y, P.kb ?? 0.5, 'thorns'); },
    dropTrap(S, R, P, ctx) { const [x, y] = pos(R, ctx); SIMX.setTrap(S, R, x, y + 4, x, y + 4, atk(S, P, ctx), false); },
  };
  const IFS = { shield: (S, h) => h.shield > 0 && S.t < h.shieldUntil, str25: (S) => heroSt(S).str >= 25, int25: (S) => heroSt(S).int >= 25 };
  const onOf = (P) => (P.trig.startsWith('every:') ? 'hit' : P.trig);
  const every = (P) => (P.trig.startsWith('every:') ? +P.trig.slice(6) : P.each || 0);
  // what changes a shot goes before what copies it, so the side balls of a split carry every change whatever order the powers were taken in
  const order = (own, trig) => { const ids = Object.keys(own).filter((id) => D.POWERS[id] && onOf(D.POWERS[id]) === trig); return ids.filter((id) => D.POWERS[id].fx !== 'split').concat(ids.filter((id) => D.POWERS[id].fx === 'split')); };
  let depth = 0;
  function firePowers(S, R, trig, ctx = {}) { const h = R.hero, own = h.powers;
    if (!own || R.town || depth > (trig === 'kill' ? 2 : 0)) return;
    for (const id of order(own, trig)) { const P = D.POWERS[id]; if (P.if && !IFS[P.if](S, h)) continue;
      const N = every(P); if (N && ((h.powerN = h.powerN || {})[id] = (h.powerN[id] || 0) + 1) % N) continue;
      if (P.icd && S.t < ((h.powerT || {})[id] ?? -1e9) + P.icd) continue;
      if (P.p !== undefined && rnd(R) >= P.p) continue;
      (h.powerT = h.powerT || {})[id] = S.t; depth++; try { FX[P.fx](S, R, P, ctx, own[id]); } finally { depth--; }
      ev(S, { k: 'power', id, fx: P.fx, x: ctx.x ?? h.x, y: ctx.y ?? h.y }); } }
  const hasOn = (h, trig) => { for (const id in h.powers || {}) if (D.POWERS[id] && onOf(D.POWERS[id]) === trig) return true; return false; };
  const drinkFires = (S, R) => !R.town && hasOn(R.hero, 'potion');
  function powersHurt(S, R, dmg, maxHp) { const h = R.hero; firePowers(S, R, 'hurt', { x: h.x, y: h.y, dmg }); const low = h.hp < maxHp * 0.35; if (low && !h.lowOn) firePowers(S, R, 'lowHp', { x: h.x, y: h.y }); h.lowOn = low; }
  function dashTouch(S, R) { const h = R.hero; if (!hasOn(h, 'dashTouch')) return; if (!h.dashHit || h.dashHit.t !== h.dashT) h.dashHit = { t: h.dashT, ids: [] };
    for (const e of R.en) if (e.deadT < 0 && !under(e) && !h.dashHit.ids.includes(e.id) && Math.hypot(e.x - h.x, (e.y - h.y) * 1.25) < ENEMIES[e.type].r + K.R + 10) { h.dashHit.ids.push(e.id); firePowers(S, R, 'dashTouch', { e, x: e.x, y: e.y }); } }
  function chooseFork(S, R, i) { const h = R.hero, P = D.forkPending(h); if (!P) return; (h.forks = h.forks || {})[D.forkKey(P.ab, P.rank)] = i; (h.powers = h.powers || {})[D.FORKS[P.ab][P.rank][i]] = 1; S.saveN++; }
  function thresholdTip(S, R) { const h = R.hero, T = D.THRESHOLD[D.clsOf(h).id]; if (T && !h.thTip && heroSt(S)[T[0]] >= T[1]) { h.thTip = 1; R.msg = { s: T[2], t: S.t, d: 4 }; } }
  Object.assign(SIMX, { drinkFires, chooseFork, thresholdTip, firePowers, powersHurt, dashTouch, POWER_FX: FX });
})(typeof window !== 'undefined' ? window : globalThis);
