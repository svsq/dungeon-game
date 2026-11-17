// node tools/measure/chars_assets/gearsheet.mjs [outDir] [--z 4] [--box 120]
// every outfit a class can wear (data_items bases with its cls or none), on that class's body, in the world: rest facing right,
// two run frames right, rest left, rest from behind, run down and up; one contact sheet per class (rows: outfits), hard pixels ×z.
// Also the menu's arch for each class in each armour and helm, and the joint trace of every frame to a json beside the sheets.
import { fileURLToPath } from 'node:url';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ROOT = process.env.ROOT || fileURLToPath(new URL('../../..', import.meta.url));
const OUT = path.resolve(ROOT, args[0] && !args[0].startsWith('--') ? args[0] : 'frames/critic_chars_r1_assets/gear'), Z = +opt('z', 4), BOX = +opt('box', 120);
fs.mkdirSync(OUT, { recursive: true });
const it = (b) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, def: 1 });
const W = { warrior: 'sword', mage: 'staff', archer: 'shortbow' };
const OUTFITS = {
  warrior: [['bare', {}], ['leather', { armor: 'leather_armor' }], ['plate', { armor: 'plate_armor' }], ['cloak', { armor: 'cloak' }],
    ['helm_le', { armor: 'leather_armor', helm: 'leather_helm' }], ['helm_kn', { armor: 'leather_armor', helm: 'knight_helm' }],
    ['full_plate', { armor: 'plate_armor', helm: 'knight_helm', gloves: 'gauntlets', boots: 'iron_boots', offhand: 'shield' }],
    ['cloak_le_gl', { armor: 'cloak', helm: 'leather_helm', gloves: 'leather_gloves', boots: 'boots', offhand: 'tower_shield' }],
    ['shirt_kn_pw', { helm: 'knight_helm', gloves: 'gauntlets', boots: 'iron_boots', offhand: 'buckler' }]],
  archer: [['bare', {}], ['leather', { armor: 'leather_armor' }], ['cloak', { armor: 'cloak' }], ['helm_le', { armor: 'leather_armor', helm: 'leather_helm' }],
    ['cloak_helm', { armor: 'cloak', helm: 'leather_helm', gloves: 'leather_gloves', boots: 'boots', offhand: 'quiver' }]],
  mage: [['bare', {}], ['robe', { armor: 'robe' }], ['leather', { armor: 'leather_armor' }], ['cloak', { armor: 'cloak' }], ['circlet', { armor: 'robe', helm: 'circlet' }],
    ['helm_le', { armor: 'robe', helm: 'leather_helm' }], ['orb', { armor: 'robe', offhand: 'orb' }], ['leather_ci_orb', { armor: 'leather_armor', helm: 'circlet', offhand: 'orb' }],
    ['cloak_ci', { armor: 'cloak', helm: 'circlet', gloves: 'leather_gloves', boots: 'boots' }]] };
const VIEWS = [['rest_r', 'rest', 'hero_right', 0], ['run_r0', 'cyc', 'hero_right', 0], ['run_r1', 'cyc', 'hero_right', 0.5], ['rest_l', 'rest', 'hero_left', 0],
  ['rest_back', 'rest', 'hero_up', 0], ['run_d', 'cyc', 'hero_down', 0.25], ['run_u', 'cyc', 'hero_up', 0.25]];
const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const server = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, b) => { if (err) { r.writeHead(404); r.end(); return; } r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); r.end(b); }); });
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const res = await page.evaluate(([OUTFITS, VIEWS, W, Z, BOX]) => { const Q = SCENE.QA(), out = { sheets: {}, trace: {}, arch: {} };
    const it = (b) => ({ id: 0, b, rar: 0, lvl: 1, mods: {}, def: 1 });
    const dress = (h, cls, eq) => { h.cls = cls; h.eq = { weapon: Object.assign(it(W[cls]), { atk: 6 }) }; for (const [k, b] of Object.entries(eq)) h.eq[k] = it(b); };
    for (const [cls, list] of Object.entries(OUTFITS)) {
      const sheet = document.createElement('canvas'); sheet.width = VIEWS.length * BOX * Z + 110; sheet.height = list.length * BOX * Z; const g = sheet.getContext('2d');
      g.imageSmoothingEnabled = false; g.fillStyle = '#202020'; g.fillRect(0, 0, sheet.width, sheet.height); out.trace[cls] = {};
      list.forEach(([name, eq], row) => { out.trace[cls][name] = {};
        VIEWS.forEach(([vn, kind, key, ph], col) => { let S;
          if (kind === 'rest') S = structuredClone(Q.rest[key]); else { const L = Q.cycles[key]; S = structuredClone(L[Math.floor(ph * L.length) % L.length]); }
          dress(S.run.hero, cls, eq); LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
          const j = LIB.TRACE.hero || {}, c = j.ground || [960, 540]; out.trace[cls][name][vn] = JSON.parse(JSON.stringify(j));
          g.drawImage(document.getElementById('c'), c[0] - BOX / 2, c[1] - BOX * 0.8, BOX, BOX, 110 + col * BOX * Z, row * BOX * Z, BOX * Z, BOX * Z); });
        g.fillStyle = '#fff'; g.font = '16px monospace'; g.fillText(name, 4, row * BOX * Z + 20); });
      VIEWS.forEach(([vn], col) => { g.fillStyle = '#ff0'; g.font = '14px monospace'; g.fillText(vn, 110 + col * BOX * Z + 4, 14); });
      out.sheets[cls] = sheet.toDataURL('image/png'); }
    // the arch: the saved hero of each class in each armour and helm on the main menu
    const base = (Q.states.find((q) => q[0] === 'menu_continue') || [])[1];
    if (base) for (const [cls, list] of Object.entries(OUTFITS)) for (const [name, eq] of list) {
      const S = structuredClone(base); S.saved = SIM.newRun(S, 'campaign', 5, { cls }); dress(S.saved.hero, cls, eq); LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
      out.arch[cls + '_' + name] = document.getElementById('c').toDataURL('image/png'); }
    return out; }, [OUTFITS, VIEWS, W, Z, BOX]);
  for (const [cls, url] of Object.entries(res.sheets)) fs.writeFileSync(path.join(OUT, `sheet_${cls}.png`), Buffer.from(url.split(',')[1], 'base64'));
  fs.mkdirSync(path.join(OUT, 'arch'), { recursive: true });
  for (const [n, url] of Object.entries(res.arch)) fs.writeFileSync(path.join(OUT, 'arch', `${n}.png`), Buffer.from(url.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'trace.json'), JSON.stringify(res.trace));
  console.log('sheets', Object.keys(res.sheets).join(' '), 'arch', Object.keys(res.arch).length);
} finally { if (errors.length) console.log('errors:', errors.slice(0, 3).join(' | ')); await browser.close(); server.close(); }
