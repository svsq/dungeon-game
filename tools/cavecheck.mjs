import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/cavecheck'; fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => { if (err) { r.writeHead(404); r.end(); return; }
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(bytes);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready);
  let names;
  if (args.includes('--input')) {
    const states = JSON.parse(fs.readFileSync(args[args.indexOf('--input') + 1], 'utf8'));
    names = await page.evaluate((states) => { window.caveQA = { states }; return states.map(([n]) => n); }, states);
  } else names = await page.evaluate(() => {
    window.caveQA = SCENE.QA();
    return window.caveQA.states.map(([n]) => n);
  });
  if (args.includes('--only')) names = names.filter((n) => args[args.indexOf('--only') + 1].split(',').includes(n));
  else if (!args.includes('--input')) names = names.filter((n) => n.startsWith('cave_') || n.startsWith('serpent_') || n.startsWith('magma_') || ['zone_cave', 'zone_magma', 'completion_85', 'win_cave', 'win_cave_worst', 'crab_facings', 'skel_ranged', 'eel_states'].includes(n));
  if (new Set(names).size !== names.length) errors.push('duplicate QA state names');
  if (!names.length) errors.push('no requested QA states found');
  if (args.includes('--only')) for (const name of args[args.indexOf('--only') + 1].split(',')) if (!names.includes(name)) errors.push('missing requested QA state ' + name);
  for (const required of ['zone_magma', 'magma_fog', 'magma_fog_walk', 'magma_surge_unseen', 'magma_surge_unseen_none', 'magma_islet', 'magma_crustfall', 'magma_crustclimb', 'magma_hall_sanctum', 'magma_hall_forge', 'magma_hall_nest', 'magma_hall_prison', 'magma_vent_rest', 'magma_react', 'magma_brink', 'magma_terrace_step', 'magma_surge_warn', 'magma_surge_front', 'magma_surge_flood', 'magma_hall', 'magma_crossing', 'magma_lava', 'magma_fall', 'magma_light', 'magma_props', 'magma_camp', 'cave_spring', 'cave_breach', 'cave_hall', 'cave_crossing', 'zone_cave', 'win_cave', 'cave_known_dark', 'cave_known_boundary', 'cave_monsters', 'eel_states', 'skel_ranged', 'cave_flood_complete', 'cave_phase2_attack', 'cave_fireball_deep_0', 'cave_fireball_deep_1', 'cave_fireball_deep_2']) if (!args.includes('--only') && !args.includes('--input') && !names.includes(required)) errors.push('missing state ' + required);
  const report = {};
  for (const name of names) {
    const result = await page.evaluate((name) => {
      const S = structuredClone(window.caveQA.states.find(([n]) => n === name)[1]);
      const before = JSON.stringify(S);
      SCENE.state = S; SCENE.render(S.t + 0.01);
      const canvas = document.getElementById('c'), url = canvas.toDataURL();
      SCENE.render(S.t + 0.01);
      const repeatUrl = canvas.toDataURL(), deterministic = url === repeatUrl;
      const damageText = name.startsWith('cave_fraction_') ? window.__UI.filter((u) => u.k === 'text' && /^(dn|hu|ab)\d+$/.test(u.id)).map((u) => u.s) : null;
      let actorVisible = null, actorCalls = [];
      if (name.startsWith('win_cave') || name === 'crab_facings' || (name.startsWith('cave_fireball_') && !name.endsWith('_hit'))) {
        const draw = G.draw, textures = Object.keys(ASSETS).filter((n) => n.startsWith(name.startsWith('win_cave') ? 'serpent__' : 'crab__')).map((n) => G.tex(n));
        G.draw = (p, u, xf, ...args) => { if ((name.startsWith('cave_fireball_') && !name.endsWith('_hit')) ? p === LIB.P.fireball : textures.includes(u.u_tex)) { actorCalls.push({ texture: Object.keys(ASSETS).find((n) => G.tex(n) === u.u_tex), alpha: u.u_alpha, grade: u.u_grade, tint: u.u_tint, snap: u.u_snap, bone0: u.u_bone0, src: u.u_src, cut: u.u_cut, xf }); return; } return draw(p, u, xf, ...args); };
        try { SCENE.render(S.t + 0.01); actorVisible = url !== canvas.toDataURL(); } finally { G.draw = draw; }
      }
      const R = S.run, m = R && R.map, h = R && R.hero;
      const exitValid = name === 'cave_arena_exit' ? R.bossDead && R.en.filter((e) => DATA.BOSSES[e.type]).every((e) => e.deadT >= 0) && !window.__UI.some((u) => u.id === 'bossbar') : null;
      return { url, damageText, exitValid, pure: before === JSON.stringify(S), repeatUrl: deterministic ? null : repeatUrl, actorVisible, actorCalls, deterministic, seed: m && m.seed, floor: R && R.floor, t: S.t, cam: R && R.cam,
        hero: h && [h.x, h.y], heroCell: h && SIM.cell(m, Math.floor(h.x / DATA.TILE), Math.floor(h.y / DATA.TILE)), hints: R && SIM.completionHints(R).map((o) => o.kind),
        // the staged magma kinds (TASKS 454: an imp put off screen by doubled coordinates, another left standing in the lava)
        actors: /^magma_(imp|golem|salamander|ember|priest)$/.test(name) ? R.en.filter((e) => e.deadT < 0).map((e) => { const Z = R.zoom || DATA.ZOOM || 1, vw = 1920 / Z, vh = 1080 / Z;
          return { id: e.id, type: e.type, st: e.st, on: e.x > R.cam[0] + 20 && e.x < R.cam[0] + vw - 20 && e.y > R.cam[1] + 40 && e.y < R.cam[1] + vh, cell: SIM.cell(m, Math.floor(e.x / DATA.TILE), Math.floor(e.y / DATA.TILE)) }; }) : null };
    }, name);
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(result.url.split(',')[1], 'base64'));
    if (result.repeatUrl) fs.writeFileSync(path.join(out, name + '_repeat.png'), Buffer.from(result.repeatUrl.split(',')[1], 'base64'));
    delete result.url; delete result.repeatUrl; report[name] = result;
    if (result.damageText && JSON.stringify(result.damageText) !== JSON.stringify([name.endsWith('_hit') ? '17' : name.endsWith('_hurt') ? '-17' : 'щит 17'])) errors.push(name + ': fractional damage text ' + result.damageText);
    if (result.actorVisible === false) errors.push(name + ': actor body invisible');
    if (!result.deterministic) errors.push(name + ': repeated frame changed');
    if (!result.pure) errors.push(name + ': render mutated simulation state');
    if (result.exitValid === false) errors.push(name + ': exit fixture has a living boss or boss HUD');
    if (['cave_spring', 'cave_breach'].includes(name) && result.heroCell !== 1) errors.push(name + ': hero off walkable floor');
    if (result.hints && result.hints.includes('secret')) errors.push(name + ': secret hint remains');
    for (const a of result.actors || []) { if (!a.on) errors.push(`${name}: ${a.type} ${a.id} off screen`);
      if (a.cell === 3 && a.type !== 'salamander' && a.st !== 'leap') errors.push(`${name}: ${a.type} ${a.id} stands in the lava`);
      if (a.cell !== 1 && a.cell !== 3) errors.push(`${name}: ${a.type} ${a.id} off the floor (cell ${a.cell})`); }
  }
  // (a surge over unexplored floor draws nothing: the frame is the frame without it, TASKS 475 review)
  { const a = path.join(out, 'magma_surge_unseen.png'), b = path.join(out, 'magma_surge_unseen_none.png');
    if (fs.existsSync(a) && fs.existsSync(b) && !fs.readFileSync(a).equals(fs.readFileSync(b))) errors.push('magma_surge_unseen: the surge shows over unexplored floor'); }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ states: report, errors }, null, 2));
} finally { await browser.close(); server.close(); }
console.log(errors.length ? errors.join('\n') : 'cavecheck: ok');
if (errors.length) process.exitCode = 2;
