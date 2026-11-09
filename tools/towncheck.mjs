// node tools/towncheck.mjs [--seeds 3,77,5,17,2026] [--floors 2,5,9] [--only state,...] [--out frames/towncheck] [--sim-only] — the town (R-17, TASKS 1025).
// Sim, headless in Node: on each seed's town the hero walks on foot from the spawn (arrow input, the sim's own collisions) to every
// service and every townsman who speaks, and E there must open what it stands for; the portal round trip: down to floor N, a scroll
// read through from the inventory in a hall away from the spawn, the town reached, the run saved and loaded, a walk to the merchant
// and the fire and back to the ring, E: the hero must land at the very spot with the floor as it was left.
// Browser: the town's QA states render with no page error, the same frame twice, the state untouched; at each spot the walk reached,
// the prompt on screen must name what E then opens. Exit 2 on any failure.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url), live = path.join(process.cwd(), 'live');
const SIM = req(path.join(live, 'sim.js')), D = req(path.join(live, 'data.js')), DG = req(path.join(live, 'dungeon.js'));
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const seeds = opt('--seeds', '3,77,5,17,2026').split(',').map(Number), floors = opt('--floors', '2,5,9').split(',').map(Number), out = opt('--out', 'frames/towncheck');
fs.mkdirSync(out, { recursive: true });
const TILE = D.TILE, errors = [], report = { walks: [], trips: [] };
// a flash of the trip must be where the hero is now: one left at the old map's coordinates lights a random spot of the new one
const strayFlash = (S) => S.ev.filter((e) => e.k === 'teleport' && S.t - e.t < 0.5).some((e) => Math.hypot(e.x - S.run.hero.x, e.y - S.run.hero.y) > 80 || Math.hypot((e.fx ?? e.x) - S.run.hero.x, (e.fy ?? e.y) - S.run.hero.y) > 80);
const stepIn = (S, inp) => SIM.step(S, Object.assign({ keys: [], px: 960, py: 540 }, inp));
const townRun = (seed) => { const S = SIM.spawn(0, {}); S.run = SIM.newRun(S, 'campaign', seed, { town: 1 }); S.screen = 'play'; stepIn(S); S.run.msg = null; return S; };

// ---------------- on foot ----------------
// the route: cheapest over the cells a body can stand on (DUNGEON.townWalk in the town), dearer by walls, props and townsfolk so it
// keeps to the open; the goal is any cell whose centre already satisfies the predicate (tested with the hero put there and back)
function route(R, goal, banned) {
  const m = R.map, h = R.hero, W = m.W, ok = m.town ? DG.townWalk(m) : m.cells.map((c) => c === 1), hx = h.x, hy = h.y, folk = R.folk || [];
  if (m.town) for (const d of m.decor) if (d.role === 'bench') ok[Math.floor(d.y / TILE) * W + Math.floor(d.x / TILE)] = false;
  const free = (k) => ok[k] && !banned.has(k), at = (k) => { h.x = (k % W + 0.5) * TILE; h.y = (Math.floor(k / W) + 0.5) * TILE; return goal(R); };
  const near = (k) => { let n = 0; for (const d of [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) if (!ok[k + d]) n++; return n; };
  const by = (k) => folk.some((f) => Math.hypot(f.x - (k % W + 0.5) * TILE, f.y - (Math.floor(k / W) + 0.5) * TILE) < 30);
  const s = Math.floor(hy / TILE) * W + Math.floor(hx / TILE), cost = new Float64Array(ok.length).fill(Infinity), from = new Int32Array(ok.length).fill(-1), done = new Uint8Array(ok.length);
  cost[s] = 0; const open = [s]; let end = -1;
  try {
    while (open.length) { let bi = 0; for (let i = 1; i < open.length; i++) if (cost[open[i]] < cost[open[bi]]) bi = i; const k = open.splice(bi, 1)[0]; if (done[k]) continue; done[k] = 1;
      if (k !== s && at(k)) { end = k; break; }
      const x = k % W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { if ((x === 0 && dx < 0) || (x === W - 1 && dx > 0)) continue; const n = k + dy * W + dx;
        if (n < 0 || n >= ok.length || !free(n) || (dx && dy && (!free(k + dx) || !free(k + dy * W)))) continue;
        const c = cost[k] + (dx && dy ? 1.42 : 1) + 0.6 * near(n) + (by(n) ? 6 : 0); if (c < cost[n]) { cost[n] = c; from[n] = k; open.push(n); } } }
  } finally { h.x = hx; h.y = hy; }
  if (end < 0) return null; const p = []; for (let k = end; k !== s && k >= 0; k = from[k]) p.unshift(k); return p.map((k) => [(k % W + 0.5) * TILE, (Math.floor(k / W) + 0.5) * TILE]);
}
// arrow keys toward the next cell centre, a fresh route twice a second (the walkers move); a cell the hero stays stuck by is
// banned from the next routes; reached, he lets go of the keys and must still stand where the predicate holds
function walk(S, goal, maxT = 50) {
  const R = S.run, h = R.hero, t0 = S.t, banned = new Set(); let path = null, plan = -9, k = 0, best = Infinity, bestT = S.t, stuck = 0, dist = 0, wait = null;
  while (S.t - t0 < maxT) {
    if (goal(R)) { for (let i = 0; i < 40 && Math.hypot(h.vx, h.vy) > 1; i++) stepIn(S); if (goal(R)) return { ok: 1, t: +(S.t - t0).toFixed(2), dist: Math.round(dist), stuck }; }
    // a walker by a service has no cell beside him clear of the service's reach for a while: wait up to 4 s for him to walk on
    if (!path || S.t - plan > 0.5) { path = route(R, goal, banned); plan = S.t; k = 0; if (!path) { if (S.t - (wait ??= S.t) < 4) { stepIn(S); continue; } return { ok: 0, why: 'no route', at: [Math.round(h.x), Math.round(h.y)] }; } wait = null; best = Infinity; }
    while (k < path.length - 1 && Math.hypot(path[k][0] - h.x, path[k][1] - h.y) < 10) k++;
    const [wx, wy] = path[k] || [h.x, h.y], dx = wx - h.x, dy = wy - h.y, left = path.slice(k).length + Math.hypot(dx, dy) / TILE;
    if (left < best - 0.25) { best = left; bestT = S.t; }
    if (S.t - bestT > 2) { banned.add(Math.floor(wy / TILE) * R.map.W + Math.floor(wx / TILE)); stuck++; bestT = S.t; path = null; if (stuck > 6) return { ok: 0, why: 'stuck', at: [Math.round(h.x), Math.round(h.y)] }; }
    const x0 = h.x, y0 = h.y; stepIn(S, { right: dx > 3, left: dx < -3, down: dy > 3, up: dy < -3 }); dist += Math.hypot(h.x - x0, h.y - y0);
  }
  return { ok: 0, why: 'timeout', at: [Math.round(h.x), Math.round(h.y)] };
}
const dTo = (R, p) => Math.hypot(p.x - R.hero.x, p.y - R.hero.y);
const noSvc = (R) => !SIM.atCraft(R) && !SIM.atStash(R) && !SIM.atSoulAltar(R) && !SIM.atCounter(R) && !SIM.atGate(R);
const folkOf = (R, role) => (R.folk || []).find((f) => f.role === role);
// what each service is, where the hero is at it (the sim's own predicates) and what E there must open
const SERVICES = [
  ['altar', (R) => SIM.atSoulAltar(R), (S) => S.screen === 'meta'],
  ['stash', (R) => SIM.atStash(R), (S) => S.screen === 'stash'],
  ['anvil', (R) => SIM.atCraft(R) === 'forge', (S) => (S.screen === 'craft' && S.craft.kind === 'forge') || (S.screen === 'talk' && S.talk.role === 'smith' && S.talk.craft)],
  ['lectern', (R) => SIM.atCraft(R) === 'enchant', (S) => S.screen === 'craft' && S.craft.kind === 'enchant'],
  ['shop', (R) => SIM.atCounter(R), (S) => S.screen === 'shop'],
  ['crypt', (R) => dTo(R, R.map.exit) < 56 && noSvc(R), (S) => S.run.floor === 1 && !S.run.town && S.screen === 'play'],
  ['board', (R) => dTo(R, R.map.town.svc.board) < 60, null],
  ['fire', (R) => dTo(R, R.map.town.svc.fire) < 70, null],
];
const TALKERS = Object.keys(D.FOLK).filter((r) => D.FOLK[r].lines && r !== 'smith' && r !== 'enchanter');
const spots = [];
for (const seed of seeds) {
  const roles = TALKERS.filter((r) => folkOf(townRun(seed).run, r));
  for (const [name, goal, opens] of SERVICES.concat(roles.map((r) => ['folk_' + r, (R) => { const f = folkOf(R, r); return noSvc(R) && dTo(R, f) < 54 && SIM.folkNear(R) === f; },
    (S) => S.screen === 'talk' && S.talk.role === r]))) {
    const S = townRun(seed), R = S.run, from = [Math.round(R.hero.x), Math.round(R.hero.y)], w = walk(S, goal), row = Object.assign({ seed, name, from }, w);
    if (!w.ok) { errors.push(`walk ${seed}: ${name} not reached on foot from the spawn (${w.why} at ${w.at})`); report.walks.push(row); continue; }
    row.hero = [Math.round(R.hero.x), Math.round(R.hero.y)];
    if (opens) { const snap = JSON.stringify(S); stepIn(S, { keys: ['KeyE'] }); row.opened = S.run.floor ? 'floor ' + S.run.floor : S.screen + (S.screen === 'talk' ? ':' + S.talk.role : S.screen === 'craft' ? ':' + S.craft.kind : '');
      if (!opens(S)) errors.push(`walk ${seed}: E at the ${name} opens ${row.opened}`); spots.push({ seed, name, snap, opened: row.opened }); }
    report.walks.push(row);
  }
}

// ---------------- the portal round trip ----------------
const floorSnap = (R) => JSON.stringify({ en: R.en.map((e) => [e.id, e.type, e.deadT >= 0 ? 'dead' : Math.round(e.hp), Math.round(e.x), Math.round(e.y)]),
  chests: R.chests.map((c) => [Math.round(c.x), Math.round(c.y), !!c.open]), pots: R.pots.map((p) => [Math.round(p.x), Math.round(p.y), p.hp]), shrines: R.shrines.map((s) => !!s.used),
  drops: R.drops.filter((d) => !d.got).map((d) => [d.id, d.kind, Math.round(d.x), Math.round(d.y)]).sort((a, b) => a[0] - b[0]), seen: R.seen.join(''), secrets: (R.map.secrets || []).map((q) => !!q.open),
  doors: (R.map.doors || []).map((d) => !!d.open), keys: R.keys, bossDead: !!R.bossDead });
for (const seed of seeds) for (const N of floors) {
  const tag = `trip ${seed}/${N}`, row = { seed, floor: N }; report.trips.push(row);
  let S = townRun(seed), R = S.run, h = R.hero;
  if (!walk(S, SERVICES.find(([n]) => n === 'crypt')[1]).ok) { errors.push(tag + ': the crypt stairs not reached'); continue; }
  stepIn(S, { keys: ['KeyE'] }); for (let f = 2; f <= N; f++) SIM.enterFloor(S, R, f); if (R.floor !== N) { errors.push(`${tag}: not on floor ${N}`); continue; }
  // a hall away from the spawn, its monsters slain and the rest asleep; one chest opened, one kill, gold dropped, so the floor differs from fresh
  const rm = R.map.rooms.filter((q) => q.type !== 'start' && q.type !== 'secret' && q.type !== 'boss' && SIM.cell(R.map, q.cx, q.cy) === 1)
    .reduce((a, b) => (Math.hypot(b.cx * TILE - R.map.spawn.x, b.cy * TILE - R.map.spawn.y) > Math.hypot(a.cx * TILE - R.map.spawn.x, a.cy * TILE - R.map.spawn.y) ? b : a));
  h.x = (rm.cx + 0.5) * TILE; h.y = (rm.cy + 0.5) * TILE; h.ifr = 1e9;
  for (const e of R.en) if (Math.hypot(e.x - h.x, e.y - h.y) < 900) { e.hp = 0; e.deadT = S.t; } else { e.st = 'idle'; }
  // and the spikes round the spot taken out (a hall's spike row, tasks 377 and 507, struck through the reading on seed 3)
  R.map.traps = R.map.traps.filter((q) => Math.hypot(q.x - h.x, q.y - h.y) > 120);
  const c = R.chests.find((q) => !q.open); if (c) SIM.openChest(S, R, c);
  R.drops.push({ id: R.nextId++, kind: 'gold', x: h.x + 40, y: h.y, vx: 0, vy: 0, z: 0, vz: 0, n: 77, t0: S.t, rest: 4 });
  for (let i = 0; i < 120; i++) stepIn(S); h.ifr = 0;
  h.bag[6] = { b: 'scroll', n: 2, id: R.nextId++ }; const gold = h.gold, P0 = [h.x, h.y];
  stepIn(S, { keys: ['KeyI'] }); const b = D.UI.inv().r.find((q) => q.id === 'bag:6'); stepIn(S, { click: 1, px: b.x + 10, py: b.y + 10 });
  if (!h.read || S.screen !== 'play') { errors.push(`${tag}: a click on the scroll in the bag does not start the reading (${S.screen})`); continue; }
  let left = null; for (let i = 0; i < 400 && R.floor; i++) { left = floorSnap(R); stepIn(S); }
  if (R.floor !== 0 || !R.town || !R.portal || R.portal.f !== N || h.bag[6].n !== 1) { errors.push(`${tag}: a scroll read through does not take the hero to the town with a portal open (floor ${R.floor})`); continue; }
  row.portal = [Math.round(R.portal.x), Math.round(R.portal.y)]; row.read = [Math.round(P0[0]), Math.round(P0[1])];
  if (Math.hypot(R.portal.x - P0[0], R.portal.y - P0[1]) > 2) errors.push(`${tag}: the portal opens off the spot where the scroll was read`);
  if (!SIM.atGate(R)) errors.push(`${tag}: the hero does not come out at the town's ring`);
  if (strayFlash(S)) errors.push(`${tag}: a portal flash in the town away from the hero`);
  // saved in the town and loaded: the portal and the kept floor travel in the save
  const T = SIM.spawn(1, JSON.parse(JSON.stringify(SIM.persist(S)))); T.run = T.saved; T.saved = null; T.screen = 'play'; S = T; R = S.run; h = R.hero;
  if (!R.portal || R.portal.f !== N) { errors.push(`${tag}: the portal is lost in a saved run`); continue; }
  for (const [n, goal, opens] of [SERVICES.find(([q]) => q === 'shop'), SERVICES.find(([q]) => q === 'fire'), ['ring', (Q) => SIM.atGate(Q), null]]) {
    const w = walk(S, goal); if (!w.ok) { errors.push(`${tag}: the ${n} not reached on foot (${w.why} at ${w.at})`); break; }
    if (opens) { stepIn(S, { keys: ['KeyE'] }); if (!opens(S)) errors.push(`${tag}: E at the ${n} does not open it`); stepIn(S, { keys: ['Escape'] }); if (S.screen !== 'play') S.screen = 'play'; }
  }
  if (!SIM.atGate(R)) continue;
  if (SIM.gateWays(R).length !== 1 || SIM.gateWays(R)[0].k !== 'portal') errors.push(`${tag}: the ring offers ${JSON.stringify(SIM.gateWays(R))}`);
  const ring = JSON.stringify(S); stepIn(S, { keys: ['KeyE'] }); spots.push({ seed, name: 'ring_' + N, snap: ring, opened: R.town ? S.screen : 'floor ' + R.floor });
  const off = Math.hypot(h.x - row.portal[0], h.y - row.portal[1]); row.back = [Math.round(h.x), Math.round(h.y)]; row.off = +off.toFixed(2);
  if (R.floor !== N || R.town) { errors.push(`${tag}: the town's portal leads to floor ${R.floor}`); continue; }
  if (off > 4) errors.push(`${tag}: back ${off.toFixed(1)} px off the spot the portal opened at`);
  if (R.portal) errors.push(`${tag}: the portal stays open after it is taken back`);
  if (strayFlash(S)) errors.push(`${tag}: a portal flash on the floor away from the hero`);
  if (SIM.cell(R.map, Math.floor(h.x / TILE), Math.floor(h.y / TILE)) !== 1) errors.push(`${tag}: back off the floor`);
  if (h.gold !== gold) errors.push(`${tag}: the hero's gold changed on the trip (${gold} → ${h.gold})`);
  const now = floorSnap(R); row.kept = now === left;
  if (now !== left) { const A = JSON.parse(left), B = JSON.parse(now); errors.push(`${tag}: the floor is not as it was left (${Object.keys(A).filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k])).join(', ')})`); }
}

// ---------------- the browser ----------------
const REQUIRED = ['zone_town', 'town_services', 'town_npc', 'town_portal', 'town_quests'];
const townState = (n) => REQUIRED.includes(n) || /^(town_|quest_|journal|climb_|way_|merchant_|shop_wander|scroll_read|folk_)/.test(n);
// the promise of each prompt: the words on it and what E must then open
const PROMISE = [[/Алтарь душ/, 'meta'], [/сундук-хранилище/, 'stash'], [/кузнец/, 'craft:forge|talk:smith'], [/зачарователь/, 'craft:enchant'], [/торговать/, 'shop'],
  [/спуститься на 1-й этаж/, 'floor 1'], [/портал на этаж (\d+)/, 'floor $1'], [/врата/, 'gate']];
if (!args.includes('--sim-only')) {
  const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
  const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
  const server = http.createServer((q, r) => { const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
      r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); }); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), pageErr = []; page.on('pageerror', (e) => pageErr.push(e.message));
  const shot = (name, url) => fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
    if (pageErr.length) errors.push('page errors on load: ' + pageErr.splice(0).join(' | '));
    const all = await page.evaluate(() => { window.townQA = SCENE.QA(); return window.townQA.states.map(([n]) => n); });
    const only = opt('--only', null), names = all.filter(only ? (n) => only.split(',').includes(n) : townState); report.states = {};
    for (const n of only ? only.split(',') : REQUIRED) if (!all.includes(n)) errors.push('missing QA state ' + n);
    if (new Set(names).size !== names.length) errors.push('duplicate town QA state names');
    for (const name of names) {
      const r = await page.evaluate((name) => { const S = structuredClone(window.townQA.states.find(([n]) => n === name)[1]), before = JSON.stringify(S);
        SCENE.state = S; SCENE.render(S.t + 0.01); const cv = document.getElementById('c'), url = cv.toDataURL(); SCENE.render(S.t + 0.01);
        const R = S.run, h = R && R.hero, m = R && R.map, k = h && Math.floor(h.y / DATA.TILE) * m.W + Math.floor(h.x / DATA.TILE);
        const diff = (a, b, p, o) => { if (o.length > 5 || JSON.stringify(a) === JSON.stringify(b)) return o; if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || p.split('.').length > 5) { o.push(p); return o; }
          for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) diff(a[k], b[k], p + '.' + k, o); return o; };
        const pure = before === JSON.stringify(S);
        return { url, same: url === cv.toDataURL(), pure, changed: pure ? null : diff(JSON.parse(before), JSON.parse(JSON.stringify(S)), 'S', []), floor: R && R.floor, screen: S.screen, onFloor: h ? (m.town ? DUNGEON.townWalk(m)[k] : m.cells[k] === 1) : null,
          portal: R && R.portal, marks: R && R.town ? R.folk && R.folk.map((f) => SIM.questMark(R, f.role)).filter(Boolean).join('') : null, quests: R && (R.quests || []).map((q) => q.st) }; }, name);
      const e = pageErr.splice(0); shot(name, r.url); delete r.url; report.states[name] = r;
      if (e.length) errors.push(`${name}: page error ${e.join(' | ')}`);
      if (!r.same) errors.push(name + ': repeated frame changed');
      if (!r.pure) errors.push(name + ': render mutated simulation state (' + r.changed.join(', ') + ')');
      if (REQUIRED.includes(name) && r.onFloor === false) errors.push(name + ': hero off the walkable floor');
    }
    const st = report.states;
    if (st.town_portal && (st.town_portal.floor !== 0 || !st.town_portal.portal || st.town_portal.portal.f !== 3)) errors.push('town_portal: not in the town with the portal to the 3rd open');
    if (st.town_portal_back && (st.town_portal_back.floor !== 3 || st.town_portal_back.portal)) errors.push('town_portal_back: not back on the 3rd with the portal closed');
    if (st.town_quests && (!/\?/.test(st.town_quests.marks || '') || !/!/.test(st.town_quests.marks || '') || st.town_quests.quests.length !== 2)) errors.push(`town_quests: marks «${st.town_quests.marks}», quests ${st.town_quests.quests}`);
    // the prompt where the walk stopped, and what E opened there in the sim
    report.prompts = [];
    for (const sp of spots) {
      const r = await page.evaluate((snap) => { const S = JSON.parse(snap); SCENE.state = S; SCENE.render(S.t + 0.01); const url = document.getElementById('c').toDataURL();
        const p = (window.__UI || []).find((u) => u.id === 'prompt'); return { url, prompt: p ? p.s : null }; }, sp.snap);
      const e = pageErr.splice(0); shot(`walk_${sp.seed}_${sp.name}`, r.url); if (e.length) errors.push(`walk ${sp.seed} ${sp.name}: page error ${e.join(' | ')}`);
      let want = null; for (const [re, w] of PROMISE) { const mt = r.prompt && r.prompt.match(re); if (mt) { want = w.replace('$1', mt[1]); break; } }
      const talk = r.prompt && r.prompt.match(/(?:говорить|задание|сдать задание): (.+)$/); if (!want && talk) { const role = Object.keys(D.FOLK).find((q) => D.FOLK[q].name === talk[1]); want = 'talk:' + role; }
      report.prompts.push({ seed: sp.seed, name: sp.name, prompt: r.prompt, opened: sp.opened });
      if (!r.prompt) errors.push(`walk ${sp.seed}: no prompt at the ${sp.name}, where E opens ${sp.opened}`);
      else if (!want || !want.split('|').includes(sp.opened)) errors.push(`walk ${sp.seed}: the prompt «${r.prompt}» at the ${sp.name}, but E opens ${sp.opened}`);
    }
  } finally { await browser.close(); server.close(); }
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ report, errors }, null, 2));
const walks = report.walks.filter((w) => w.ok), trips = report.trips.filter((t) => t.kept);
console.log(`towncheck: ${walks.length}/${report.walks.length} walks (${seeds.length} towns), ${trips.length}/${report.trips.length} portal trips kept the floor` +
  (report.states ? `, ${Object.keys(report.states).length} QA states, ${report.prompts.length} prompts` : ''));
console.log(errors.length ? errors.join('\n') : 'towncheck: ok');
if (errors.length) process.exitCode = 2;
