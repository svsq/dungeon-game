// node tools/cover.mjs [--out docs/cover.png] [--mode cave|magma] [--seed N] [--floor N] [--at col,row] [--cls warrior|archer|mage]
//   [--zoom Z] [--row 0..1] [--foes type:dx:dy,...] [--chest dx,dy] [--pose idle|swing] [--aim degrees] [--brightness B]
// The README cover: a flooded-cave floor rendered by the game with its own menu title lettering (the HUD's label of the main menu).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || path.join(os.homedir(), '.claude/skills/ref2game/scripts/node_modules/playwright'));
const args = process.argv.slice(2), option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;

const COVER = { width: 1320, height: 660 };
const VIEW = { width: 1920, height: 1080 };
const SETTLE_STEPS = 700;
const SETTLE_INPUT = { px: VIEW.width / 2, py: VIEW.height / 2, keys: [] };
const TITLE_BAND = { title: { y: 205, size: 100 }, subtitle: { y: 275, size: 42 } };
const TITLE_STYLE = { titleOutline: '#2a0d06', subtitleColor: '#e8c890' };
const SWING_PHASE = 0.03;
const FOE_FIELDS = { vx: 0, vy: 0, dmg: 1, elite: 0, room: -1, st: 'chase', t0: 0, aimA: 0, cdT: 99, hitT: -9, deadT: -1, dist: 0, kbx: 0, kby: 0, burn: 0, burnT: 0, seenT: 0 };
const DECALS_REMOVED = '^dc_(blood2?|coins)$';
const CLEAR_RADIUS_TILES = 14;
const AIM_REACH = 300;
const CANVAS_CROP_TOP = 0.5;
const CHEST_TIER = 2;
const CHEST_CLEAR_TILES = 1.8;
const CHEST_OPEN_AGE = 3;

const mode = option('--mode', 'cave'), seed = Number(option('--seed', '8')), floor = Number(option('--floor', '4'));
const heroCell = option('--at', '47,54').split(',').map(Number);
const heroClass = option('--cls', 'warrior'), zoom = Number(option('--zoom', '2.1')), heroRow = Number(option('--row', '0.7'));
const foes = option('--foes', 'skeleton:-3:0.3,crab:-5.4:1.8').split(',').filter(Boolean).map((spec) => { const [type, dx, dy] = spec.split(':'); return { type, dx: Number(dx), dy: Number(dy) }; });
const chest = option('--chest', '2.6,1.6').split(',').filter(Boolean).map(Number);
const pose = option('--pose', 'swing'), aim = Number(option('--aim', '170')), brightness = Number(option('--brightness', '1.12'));
const out = option('--out', 'docs/cover.png');

fs.mkdirSync(path.dirname(out), { recursive: true });
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let browser;
const errors = [];
try {
  browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await browser.newPage({ viewport: COVER, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const report = await p.evaluate((o) => {
    const TILE = DATA.TILE, S = SIM.spawn(0, {});
    SIM.step(S, { keys: [] });
    S.run = SIM.newRun(S, o.mode, o.seed, { cls: o.heroClass }); S.screen = 'play';
    if (o.floor > 1) SIM.enterFloor(S, S.run, o.floor);
    for (let i = 0; i < o.settle; i++) SIM.step(S, o.input);
    const R = S.run, m = R.map, h = R.hero, around = (x, y) => Math.hypot(x - h.x, y - h.y) < o.clear * TILE;
    h.x = (o.cell[0] + 0.5) * TILE; h.y = (o.cell[1] + 0.5) * TILE;
    R.msg = null; R.seen = R.seen.map(() => 1); S.ev = [];
    const frame = () => { R.zoom = o.zoom; R.cam = [h.x - o.view.width / o.zoom * 0.5, h.y - o.view.height / o.zoom * o.row]; };
    R.en = [];
    frame();
    const aimAngle = o.aim * Math.PI / 180, heroScreen = [o.view.width * 0.5, o.view.height * o.row];
    for (let i = 0; i < o.settle / 10; i++) { frame(); SIM.step(S, { px: heroScreen[0] + Math.cos(aimAngle) * o.aimReach, py: heroScreen[1] + Math.sin(aimAngle) * o.aimReach, keys: [] }); }
    frame(); S.ev = [];
    R.drops = R.drops.filter((d) => !around(d.x, d.y)); R.pots = R.pots.filter((q) => !around(q.x, q.y));
    R.chests = R.chests.filter((c) => !around(c.x, c.y)); m.decals = m.decals.filter((d) => !(new RegExp(o.decals).test(d.n) && around(d.x, d.y)));
    if (o.chest.length === 2) { const cx = h.x + o.chest[0] * TILE, cy = h.y + o.chest[1] * TILE; m.decor = m.decor.filter((d) => Math.hypot(d.x - cx, d.y - cy) > o.chestClear * TILE); }
    if (o.chest.length === 2) R.chests.push({ x: h.x + o.chest[0] * TILE, y: h.y + o.chest[1] * TILE, tier: o.chestTier, gold: 1, open: 1, openT: S.t - o.chestOpenAge });
    m.traps = m.traps.filter((q) => !around(q.x, q.y));
    R.en = o.foes.map((f, i) => { const E = DATA.ENEMIES[f.type], x = h.x + f.dx * TILE, y = h.y + f.dy * TILE;
      return Object.assign({ id: 900 + i, type: f.type, x, y, hp: E.hp, max: E.hp, face: f.dx > 0 ? -1 : 1 }, o.foeFields); });
    if (o.pose === 'swing') { const age = SIM.K.HIT + o.swingPhase; h.atkT = S.t - age; h.atkA = h.aim; S.ev.push({ k: 'swing', t: S.t - age, x: h.x, y: h.y, a: h.aim, f: h.face }); }
    frame();
    HUD.draw = () => {
      const label = (slot, text, y, size, col, outline, bold) => LIB.label(slot, text, o.view.width / 2, y, { size, al: 0.5, col, out: outline, bold });
      label('cover_title', TXT('hud.menu'), o.band.title.y, o.band.title.size, '#ffd76a', o.style.titleOutline, true);
      label('cover_subtitle', TXT('hud.menu.sub'), o.band.subtitle.y, o.band.subtitle.size, o.style.subtitleColor, o.style.titleOutline, false);
    };
    SCENE.state = S; SCENE.render(S.t + 0.01);
    document.body.innerHTML = '<main id="cover"></main>';
    const cover = document.getElementById('cover'); cover.appendChild(G.gl.canvas);
    const scaledHeight = o.cover.width * o.view.height / o.view.width;
    const style = document.createElement('style');
    style.textContent = `
      html, body { margin: 0; width: ${o.cover.width}px; height: ${o.cover.height}px; overflow: hidden; background: #050406; }
      #cover { position: relative; width: ${o.cover.width}px; height: ${o.cover.height}px; overflow: hidden; }
      #cover canvas { position: absolute; display: block; width: ${o.cover.width}px; height: ${scaledHeight}px; left: 0; top: ${-(scaledHeight - o.cover.height) * o.titleCrop}px; image-rendering: pixelated; filter: brightness(${o.brightness}) saturate(1.08); }
    `;
    document.head.appendChild(style);
    return { foes: R.en.map((e) => e.type), heroCell: o.cell, chests: R.chests.length, deadHero: h.deadT >= 0 };
  }, { mode, seed, floor, cell: heroCell, heroClass, zoom, row: heroRow, foes, chest, pose, aim, brightness, settle: SETTLE_STEPS, input: SETTLE_INPUT, clear: CLEAR_RADIUS_TILES,
    decals: DECALS_REMOVED, foeFields: FOE_FIELDS, swingPhase: SWING_PHASE, aimReach: AIM_REACH, chestTier: CHEST_TIER, chestClear: CHEST_CLEAR_TILES, chestOpenAge: CHEST_OPEN_AGE, view: VIEW, cover: COVER, band: TITLE_BAND, style: TITLE_STYLE, titleCrop: CANVAS_CROP_TOP });
  if (errors.length) throw new Error(errors.join('\n'));
  await p.screenshot({ path: out, animations: 'disabled' });
  console.log(JSON.stringify({ out, ...COVER, mode, seed, floor, heroClass, ...report }));
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
