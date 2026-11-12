// the HUD's top-left zone, where world labels (elites' plates, prompts, damage names) are not put, covers every row of the effects
// under the level's bar, the second and third as well as the first (review of PR 63); quest marks in the town keep off every part of the HUD,
// off bodies and off each other, and hide when walled in
//   node tools/hudzone.mjs        exit 2 on failure
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let fails = [];
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  fails = await page.evaluate(() => {
    const st = (SCENE.QA().states.find((q) => q[0] === 'buffs') || [])[1]; if (!st) return ['no QA state buffs'];
    SCENE.state = st; SCENE.render(st.t + 0.01);
    const chips = (window.__UI || []).filter((q) => /^bfv?_/.test(q.id || '')), out = [], rows = new Set(chips.map((q) => q.y >> 6));
    if (rows.size < 2) out.push(`the buffs state shows ${rows.size} row of effects, the check needs two`);
    for (const q of chips) for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h]])
      if (!HUD.underHud(x, y)) { out.push(`${q.id} at ${Math.round(x)},${Math.round(y)} lies outside the HUD's zone`); break; }
    // TASKS 1025 by the same zone: a quest giver whose mark would sit on each part of the HUD (the effects' rows, the stats sheet, the
    // top bar, the minimap, the tracker, the bottom panel, the key hints) has it moved off every part, onto no body and no other mark,
    // and no farther than the part's nearest free side asks (review of PR 63)
    const tq = (SCENE.QA().states.find((q) => q[0] === 'town_quest_marks') || [])[1]; if (!tq) return out.concat('no QA state town_quest_marks');
    const R = tq.run, h = R.hero, Z = window.SCX.Z, W = SIM.VIEW.W, Hh = SIM.VIEW.H, SZ = (n) => window.SIZES[n] || [0, 0];
    const givers = R.folk.filter((f) => SIM.Q.questMark(R, f.role)); if (givers.length < 2) return out.concat(`town_quest_marks has ${givers.length} quest givers, the check needs two`);
    const render = () => { SCENE.state = tq; SCENE.render(tq.t + 0.01); }, zone = (n) => HUD.zones().find((z) => z[4] === n), inZ = (z, x, y) => x > z[0] && x < z[2] && y > z[1] && y < z[3];
    const mid = (z) => [(Math.max(z[0], 0) + Math.min(z[2], W)) / 2, (Math.max(z[1], 0) + Math.min(z[3], Hh)) / 2];
    const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const sx = (x) => (x - R.cam[0]) * Z, sy = (y) => (y - R.cam[1]) * Z;
    const stand = (f, x, y) => { const sh = SZ('town_' + f.role)[1]; f.x = R.cam[0] + x / Z; f.y = R.cam[1] + Math.min(Hh - 4, y + 30 + sh * Z) / Z; return sy(f.y) - sh * Z - 30; };
    // the hero stands well clear of the spot, so his body is never the reason a mark moves or hides
    const heroAt = (x, y) => { h.x = R.cam[0] + x / Z; h.y = R.cam[1] + y / Z; };
    const away = (x, y) => { const p = [[260, 700], [960, 600], [1660, 700]].sort((a, b) => Math.hypot(b[0] - x, b[1] - y) - Math.hypot(a[0] - x, a[1] - y))[0]; heroAt(...p); };
    const bodies = () => R.folk.map((f) => { const [w, hh] = SZ(f.role === 'hen' ? 'town_hen_white' : 'town_' + f.role); return { who: f.role, x: sx(f.x) - w * Z / 2, y: sy(f.y) - hh * Z, w: w * Z, h: hh * Z }; })
      .concat({ who: 'hero', x: sx(h.x) - 30 * Z, y: sy(h.y) - 84 * Z, w: 60 * Z, h: 90 * Z });
    // the limit is the part's nearest free side, not a fixed reach, so a mark sent the long way round fails
    const esc = (z, x, y) => Math.min(z[0] - 48 >= 0 ? x + 24 - z[0] : Infinity, z[2] + 48 <= W ? z[2] + 24 - x : Infinity, z[1] - 64 >= 0 ? y + 32 - z[1] : Infinity, z[3] + 64 <= Hh ? z[3] + 32 - y : Infinity);
    const check = (n, x, y) => { render(); const z = zone(n); if (!z) { out.push(`town_quest_marks shows no ${n}`); return; }
      givers.forEach((g) => { g.x = R.cam[0] - 4000; });
      const [f, g] = givers, ny = stand(f, x, y); stand(g, x + 12, y); away(x, ny); render();
      if (!inZ(z, x, ny)) { out.push(`the ${n} part: the mark's own spot ${Math.round(x)},${Math.round(ny)} is not on it`); return; }
      const M = HUD.marks(), mk = givers.slice(0, 2).map((q) => M.find((b) => b.i === q.i));
      if (!mk[0] || !mk[1]) { out.push(`the ${n} part: giver ${(mk[0] ? g : f).role} shows no mark`); return; }
      if (!(window.__UI || []).some((u) => u.id === 'qmk' + f.i)) out.push(`the ${n} part: the mark of ${f.role} is placed but not drawn`);
      if (overlaps(mk[0], mk[1])) out.push(`the ${n} part: the two givers' marks lie on each other`);
      const lim = esc(z, x, ny) + 100;
      mk.forEach((b, i) => { const who = givers[i].role;
        const pts = []; for (let a = 0; a <= 4; a++) for (let c = 0; c <= 4; c++) pts.push([b.x + 1 + (b.w - 2) * a / 4, b.y + 1 + (b.h - 2) * c / 4]);
        const p = pts.find(([px, py]) => HUD.underHud(px, py)); if (p) out.push(`the ${n} part: ${who}'s mark at ${Math.round(p[0])},${Math.round(p[1])} lies under the HUD`);
        const on = bodies().find((o) => overlaps(b, o)); if (on) out.push(`the ${n} part: ${who}'s mark lies on the ${on.who}`);
        const d = Math.hypot(b.x + 20 - x, b.y + 28 - ny); if (d > lim) out.push(`the ${n} part: ${who}'s mark went ${Math.round(d)} px from its giver, the part asks ${Math.round(lim - 100)}`); }); };
    // the stats sheet with one row of effects, so the point under it is under no row; then every row lit for the rest
    render(); { const e = zone('effects'), st = zone('stats'); if (e[3] + 16 > st[3]) out.push(`one row of effects reaches ${e[3]}, the stats sheet ${st[3]}`); else check('stats', st[2] / 2, (e[3] + st[3]) / 2); }
    h.perks = Object.fromEntries(window.DATA.GIFTS.map((g) => [g.id, 2])); Object.assign(h, { bless: 1, shield: 99999, shieldUntil: tq.t + 4, burn: tq.t + 0.4, poison: tq.t + 2.2 });
    render(); { const e = zone('effects'), st = zone('stats'); check('effects', (st[2] + 500) / 2, e[3] - 30); }
    for (const n of ['top', 'minimap', 'tracker', 'panel', 'keys']) { const z = zone(n); if (!z) { out.push(`town_quest_marks shows no ${n}`); continue; } check(n, ...mid(z)); }
    // muted, the crossed-out speaker by the key hints is a part too
    tq.meta.mute = 1; render(); { const z = zone('mute'); if (!z) out.push('muted, town_quest_marks shows no speaker zone'); else check('mute', ...mid(z)); } tq.meta.mute = 0;
    // on the pause the key hints are not drawn, so their zone is gone
    tq.screen = 'pause'; render(); if (zone('keys')) out.push('on the pause the key hints keep their zone, though they are not drawn'); tq.screen = 'play';
    // a giver walled in by townsfolk on every side within the mark's reach shows no mark
    { const f = givers[0], src = R.folk.find((q) => q.role !== 'hen' && !SIM.Q.questMark(R, q.role)), keep = R.folk.slice();
      if (!src) out.push('town_quest_marks has no townsman without a quest to wall a giver in with');
      else { givers.forEach((g) => { g.x = R.cam[0] - 4000; }); const ny = stand(f, 960, 420); heroAt(200, 980);
        const [w, hh] = SZ('town_' + src.role), dx = Math.max(8, w * Z - 12), dy = Math.max(8, hh * Z - 16);
        for (let y = ny - 340; y <= ny + 340 + hh * Z; y += dy) for (let x = 960 - 400; x <= 960 + 400; x += dx) R.folk.push(Object.assign({}, src, { x: R.cam[0] + x / Z, y: R.cam[1] + y / Z }));
        render(); if (HUD.marks().some((b) => b.i === f.i)) out.push(`a giver walled in by ${R.folk.length - keep.length} townsfolk still shows a mark`);
        R.folk.length = 0; keep.forEach((q) => R.folk.push(q)); } }
    return out; });
  fs.mkdirSync('frames/hudzone', { recursive: true }); await page.screenshot({ path: 'frames/hudzone/town_marks.png' });
} finally { await browser.close(); server.close(); }
if (errors.length) fails.push('page errors: ' + errors.slice(0, 3).join(' | '));
console.log(fails.length ? 'FAIL\n  ' + fails.slice(0, 8).join('\n  ') : 'ok: the HUD zone covers every row of effects, quest marks keep off every part of the HUD');
process.exit(fails.length ? 2 : 0);
