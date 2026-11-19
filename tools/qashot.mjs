// renders chosen SCENE.QA() states whole and chosen cycles / transitions as contact sheets round their subject (TASKS 407–409)
//   node tools/qashot.mjs [--states a,b] [--sheets c,d] [--n 12] [--box 260] [--view 1280x720] [--out frames/qashot]
//   --view: the browser window size; the canvas is 1920 wide and as tall as the window's aspect asks (1080 at 16:9, 1200 at 16:10, up to
//   1248, TASKS 1861), scaled by the page as a player on that screen sees it; a text drawn off the view is reported
//   --states all: every state; a text wider than its own container (the smallest uiBox holding its centre, the rule of the skill's
//   qa.mjs) is reported and the run exits 2 (TASKS 2083: a quest card's line ran onto the journal's right page)
//   --zoom k: sheets (and --focus states) blown up k× with hard pixels; --focus id: a state cropped to a --box round that trace subject
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', 'frames/qashot'), ZOOM = +opt('zoom', 1), FOCUS = opt('focus', ''), tweak = opt('eval', ''), states = opt('states', '').split(',').filter(Boolean), sheets = opt('sheets', '').split(',').filter(Boolean), N = +opt('n', 12), F0 = +opt('from', -1), F1 = +opt('to', -1), BOX = +opt('box', 260);
fs.mkdirSync(out, { recursive: true });
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
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const all = await page.evaluate(() => { window.__Q = SCENE.QA(); return __Q.states.map((q) => q[0]); });
  let over = 0;
  for (const name of states[0] === 'all' ? all : states) {
    const ok = await page.evaluate(([name, tweak]) => { const st = (__Q.states.find((q) => q[0] === name) || [])[1]; if (!st) return false; if (tweak) new Function('S', tweak)(st); SCENE.state = st; SCENE.render(st.t + 0.01); return true; }, [name, tweak]);
    if (!ok) { console.log('no state', name); continue; }
    const off = await page.evaluate(() => (window.__UI || []).filter((q) => q.k === 'text' && (q.x < 0 || q.y < 0 || q.x + q.w > SIM.VIEW.W || q.y + q.h > SIM.VIEW.H)).map((q) => q.s));
    const wide = await page.evaluate(() => { const ui = (window.__UI || []).map((u, i) => Object.assign({ i }, u)), hits = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
      const covers = ui.filter((u) => u.k === 'cover'), boxes = ui.filter((u) => u.k === 'box'), out = [], bare = [];
      for (const t of ui.filter((u) => u.k === 'text' && !covers.some((c) => c.i > u.i && hits(u, c)))) { const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
        const b = boxes.filter((b) => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h && !covers.some((c) => c.i > b.i && c.i < t.i && hits(b, c))).sort((a, c) => a.w * a.h - c.w * c.h)[0];
        const px = b ? Math.max(b.x + b.pad - t.x, t.x + t.w - (b.x + b.w - b.pad), 0) : 0; if (px > 1) out.push(`"${t.s}" over ${b.id} by ${Math.round(px)} px`);
        // a text whose middle is in no container is not measured by any: it is a violation when it crosses a container's edge (it ran out
        // of its own, TASKS 2086), and otherwise a warning that nothing frames it
        if (!b) { const x = boxes.find((q) => hits(t, q) && !covers.some((c) => c.i > q.i && c.i < t.i && hits(q, c)) && (t.x < q.x || t.x + t.w > q.x + q.w || t.y < q.y || t.y + t.h > q.y + q.h));
          if (x) out.push(`"${t.s}" crosses the edge of ${x.id}`); else bare.push(t.s); } }
      return { out, bare }; });
    over += wide.out.length;
    if (FOCUS) { const url = await page.evaluate(([id, BOX, Z]) => { LIB.TRACE = {}; SCENE.render(SCENE.state.t + 0.01); const j = LIB.TRACE[id], c = j && j.ground ? j.ground : [960, 540], cv = document.createElement('canvas'); cv.width = cv.height = BOX * Z;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(document.getElementById('c'), c[0] - BOX / 2, c[1] - BOX * 0.7, BOX, BOX, 0, 0, BOX * Z, BOX * Z); return cv.toDataURL('image/png'); }, [FOCUS, BOX, ZOOM]);
      fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64')); }
    else await page.locator('#c').screenshot({ path: path.join(out, name + '.png') });
    console.log('state', name, off.length ? 'OFF VIEW: ' + off.slice(0, 3).join(' | ') : '', wide.out.length ? 'WIDER THAN ITS BOX: ' + wide.out.join(' | ') : '', wide.bare.length ? 'no box: ' + wide.bare.slice(0, 3).join(' | ') + (wide.bare.length > 3 ? ' (+' + (wide.bare.length - 3) + ')' : '') : '');
  }
  for (const name of sheets) {
    const url = await page.evaluate(([name, N, BOX, F0, F1, Z]) => {
      const list = __Q.cycles[name] || (__Q.transitions || {})[name] || (__Q.loops || {})[name]; if (!list) return null;
      const id = __Q.subject[name] || 'en990', cols = Math.min(N, 6), rows = Math.ceil(N / cols), sheet = document.createElement('canvas'); sheet.width = cols * BOX; sheet.height = rows * BOX;
      const g = sheet.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, sheet.width, sheet.height);
      for (let i = 0; i < N; i++) { const st = list[F0 >= 0 ? Math.min(list.length - 1, F0 + Math.round(i * (F1 - F0) / Math.max(1, N - 1))) : Math.min(list.length - 1, Math.round(i * (list.length - 1) / Math.max(1, N - 1)))]; LIB.TRACE = {}; SCENE.state = st; SCENE.render(st.t + 0.01);
        const j = LIB.TRACE[id], c = j && j.ground ? j.ground : [960, 540];
        g.drawImage(document.getElementById('c'), c[0] - BOX / 2, c[1] - BOX * 0.7, BOX, BOX, (i % cols) * BOX, Math.floor(i / cols) * BOX, BOX, BOX); }
      if (Z === 1) return sheet.toDataURL('image/png');
      const big = document.createElement('canvas'); big.width = sheet.width * Z; big.height = sheet.height * Z; const gb = big.getContext('2d'); gb.imageSmoothingEnabled = false; gb.drawImage(sheet, 0, 0, big.width, big.height); return big.toDataURL('image/png'); }, [name, N, BOX, F0, F1, ZOOM]);
    if (!url) { console.log('no sheet', name); continue; }
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64')); console.log('sheet', name);
  }
  if (over) process.exitCode = 2;
} finally { if (errors.length) console.log('errors:', errors.slice(0, 5).join(' | ')); await browser.close(); server.close(); }
