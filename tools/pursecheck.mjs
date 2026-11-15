// every count of gold, soul shards or a floor's key looks one way on every screen (TASKS 2084): the screens that show them are rendered and
// the plates the HUD records (L.UI, k 'purse') are compared, not pixels. Fails when a screen's currency is not drawn by the purse (a copy
// of its own), when two plates differ in height, icon, parchment, ink or font, when one group's plates differ in width, or when a
// number sits off its plate's middle.
//   node tools/pursecheck.mjs [--states a,b] [--view 1920x1080]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
// the screens with a currency on them and what each must show
const SCREENS = {
  purse_hud: ['gold', 'shards', 'key'], play_worst: ['gold', 'shards'], town_services: ['gold', 'shards'], inv: ['gold', 'shards'],
  shop_screen: ['gold'], town_forge: ['gold'], town_enchant: ['gold', 'shards'], altar_screen: ['gold', 'shards'],
};
// values no other text on these screens holds, so a count drawn outside the purse shows up by its digits
const MARK = { gold: 73519, shards: 64287 };
// the ink's centre may stand this far off the plate's middle (the font's whole-pixel grid)
const CENTRE_TOL = 2;
const only = opt('states', '').split(',').filter(Boolean), names = only.length ? only : Object.keys(SCREENS);
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes); });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const [VW, VH] = opt('view', '1920x1080').split('x').map(Number), page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = [], fails = [], looks = [];
page.on('pageerror', (e) => errors.push(e.message));
const style = (p, t) => JSON.stringify({ h: p.h, icon: p.icon.slice(1), plate: p.plate, col: p.col, font: t && Math.round(t.h) });
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__Q = SCENE.QA(); });
  for (const name of names) {
    const want = SCREENS[name] || [];
    const shot = (mark) => page.evaluate(([name, mark]) => { const st = (__Q.states.find((q) => q[0] === name) || [])[1]; if (!st) return null;
      const S = st, was = S.run && [S.run.hero.gold, S.meta.shards];
      if (mark && was) { S.run.hero.gold = mark.gold; S.meta.shards = mark.shards; }
      SCENE.state = S; SCENE.render(S.t + 0.01); const ui = (window.__UI || []).map((q) => Object.assign({}, q));
      if (mark && was) [S.run.hero.gold, S.meta.shards] = was;
      return ui; }, [name, mark]);
    const ui = await shot(null);
    if (!ui) { fails.push(`${name}: no such QA state`); continue; }
    const P = ui.filter((q) => q.k === 'purse'), T = new Map(ui.filter((q) => q.k === 'text').map((q) => [q.id, q]));
    for (const k of want) if (!P.some((p) => p.res === k)) fails.push(`${name}: its ${k} is not drawn as a purse (a count of its own, not the shared look)`);
    for (const p of P) { const t = T.get(p.id);
      if (!t) { fails.push(`${name}: ${p.id} has no number on its plate`); continue; }
      const dx = t.x + t.w / 2 - (p.x + p.w / 2), dy = t.y + t.h / 2 - (p.y + p.h / 2);
      if (Math.abs(dx) > CENTRE_TOL || Math.abs(dy) > CENTRE_TOL) fails.push(`${name}: ${p.id}'s number stands ${dx.toFixed(1)}, ${dy.toFixed(1)} px off its plate's middle`);
      if (t.x < p.x || t.x + t.w > p.x + p.w) fails.push(`${name}: ${p.id}'s number runs out of its plate`);
      looks.push([name + ' ' + p.id, style(p, t)]); }
    const groups = new Map(); for (const p of P) groups.set(p.group, (groups.get(p.group) || []).concat(p));
    for (const [g, ps] of groups) if (new Set(ps.map((p) => p.w)).size > 1) fails.push(`${name}: the ${g} plates differ in width (${ps.map((p) => p.res + ' ' + p.w).join(', ')})`);
    const marked = await shot(MARK);
    if (marked) { const ids = new Set(marked.filter((q) => q.k === 'purse').map((q) => q.id));
      for (const q of marked) if (q.k === 'text' && !ids.has(q.id) && Object.values(MARK).some((v) => new RegExp(`(^|\\D)${v}(\\D|$)`).test(q.s))) fails.push(`${name}: «${q.s}» (${q.id}) shows a currency's count outside the purse`); }
    console.log(name, P.map((p) => `${p.res} ${p.w}×${p.h}`).join(', ') || '-');
  }
  const kinds = new Map(); for (const [at, s] of looks) kinds.set(s, (kinds.get(s) || []).concat(at));
  if (kinds.size > 1) fails.push('the purses have ' + kinds.size + ' looks: ' + [...kinds].map(([s, at]) => `${s} at ${at.slice(0, 3).join(', ')}${at.length > 3 ? '…' : ''}`).join(' | '));
} finally { await browser.close(); server.close(); }
if (errors.length) fails.push('page errors: ' + errors.slice(0, 3).join(' | '));
for (const f of fails) console.log('FAIL', f);
console.log(fails.length ? `pursecheck: ${fails.length} failures` : 'pursecheck: ok');
process.exit(fails.length ? 1 : 0);
