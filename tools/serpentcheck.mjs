import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const out = 'frames/serpentcheck'; fs.mkdirSync(out, { recursive: true });
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
  const names = await page.evaluate(() => {
    const Q = SCENE.QA(); window.serpentQA = Q;
    const frames = Q.states.filter(([n]) => n.startsWith('serpent')).map(([, s]) => s).concat(...Object.entries(Q.transitions).filter(([n]) => n.startsWith('serpent')).map(([, s]) => s));
    if (frames.some((s) => !s.run.cam.every(Number.isFinite))) throw new Error('serpent QA has a non-finite camera');
    return Q.states.filter(([n]) => n.startsWith('serpent')).map(([n]) => n);
  });
  const report = {};
  for (const name of names) {
    const result = await page.evaluate((name) => {
      const S = window.serpentQA.states.find(([n]) => n === name)[1]; SCENE.state = S; SCENE.render(S.t + 0.01);
      return { anchors: window.__ANCHORS, url: document.getElementById('c').toDataURL('image/png') };
    }, name);
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(result.url.split(',')[1], 'base64'));
    report[name] = result.anchors;
    const anchor = name === 'serpent_emit_wave' ? 'serpent_wave' : name.startsWith('serpent_emit') ? 'serpent_mouth' : name.startsWith('serpent_bite_aim') ? 'serpent_bite' : null;
    if (anchor && !result.anchors.some((a) => a.name === anchor)) errors.push(name + ': missing ' + anchor);
    for (const a of result.anchors) if (!Number.isFinite(a.d) || a.d > a.tol) errors.push(`${name}: ${a.name} misses by ${a.d.toFixed(1)} px`);
  }
  const motion = await page.evaluate(() => {
    const trace = (S) => {
      LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const joint = LIB.TRACE.en990; LIB.TRACE = null;
      return joint && Object.fromEntries(Object.entries(joint).map(([n, p]) => [n, [p[0] - joint.ground[0], p[1] - joint.ground[1]]]));
    };
    const idle = window.serpentQA.loops.serpent_idle, death = window.serpentQA.transitions.serpent_death;
    if (!idle || idle.length < 271 || !death || death.length < 7) throw new Error('incomplete serpent idle/death trace');
    const first = trace(idle[0]), last = trace(idle[idle.length - 1]), dying = trace(death[0]), moved = trace(death[6]);
    if (!first || !last || !dying || !moved) throw new Error('missing serpent joints');
    const deathStartJump = {};
    for (const mv of ['bite', 'tail', 'wave', 'fan']) {
      const S = structuredClone(window.serpentQA.states.find(([n]) => n === 'serpent_warn_' + mv)[1]), before = trace(S);
      S.run.en[0].deadT = S.t; S.run.en[0].hp = 0; const after = trace(S);
      deathStartJump[mv] = Math.hypot(before.head[0] - after.head[0], before.head[1] - after.head[1]);
    }
    return { deathStartJump, period: idle[idle.length - 1].t - idle[0].t, idleHeadSeam: Math.hypot(first.head[0] - last.head[0], first.head[1] - last.head[1]), deathFirstTenth: Math.hypot(dying.head[0] - moved.head[0], dying.head[1] - moved.head[1]) };
  });
  if (Math.abs(motion.period - 4.5) > 0.001 || motion.idleHeadSeam > 0.1) errors.push('serpent_idle: open loop ' + JSON.stringify(motion));
  if (motion.deathFirstTenth < 1) errors.push('serpent_death: no immediate response ' + JSON.stringify(motion));
  for (const [mv, jump] of Object.entries(motion.deathStartJump)) if (jump > 168 * 0.06) errors.push(mv + ': death pose jumps ' + jump);
  report.motion = motion;
  for (const mv of ['bite', 'tail', 'wave', 'fan']) {
    const r = await page.evaluate((mv) => {
      const S = window.serpentQA.states.find(([n]) => n === 'serpent_warn_' + mv)[1], cv = document.getElementById('c'), Mv = DATA.BOSSES.boss_serpent.moves[mv];
      const shot = (st) => { const C = structuredClone(S); C.run.en[0].st = st; SCENE.state = C; SCENE.render(C.t + 0.01); const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height;
        const x = g.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0); return x.getImageData(0, 0, g.width, g.height).data; };
      const on = shot('bwind'), off = shot('recover'), R = S.run, e = R.en[0], z = R.zoom || DATA.ZOOM || 1, X = (e.x - R.cam[0]) * z, Y = (e.y - R.cam[1]) * z;
      let n = 0; for (let i = 0; i < on.length; i += 4) { const px = (i / 4) % cv.width, py = Math.floor(i / 4 / cv.width);
        if (Math.abs(px - X) < 100 * z && py > Y - 260 * z && py < Y - 10 * z) continue;
        if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) > 45) n++; }
      const area = mv === 'bite' ? Mv.arc * Mv.r * Mv.r : mv === 'tail' ? Math.PI * Mv.r * Mv.r : mv === 'wave' ? 68 * Mv.reach : Mv.n * 44 * Mv.reach;
      return { n, area: area * z * z };
    }, mv);
    if (r.n < r.area * 0.3) errors.push(`serpent_warn_${mv}: the telegraph covers ${r.n} px of the ${Math.round(r.area)} px a blow hits (at least 30 % expected)`);
  }
  for (const name of ['serpent_tail', 'serpent_bite', 'serpent_death', 'serpent_flood']) {
    const url = await page.evaluate((name) => {
      const frames = window.serpentQA.transitions[name], sheet = document.createElement('canvas'); sheet.width = 1600; sheet.height = 900;
      const ctx = sheet.getContext('2d'); ctx.imageSmoothingEnabled = false;
      (name === 'serpent_flood' ? [0, 15, 30, 45, 60, 80, 100, 130, 150, 175, 200, 239] : name === 'serpent_death' ? [0, 2, 6, 12, 20, 30, 42, 54, 66, 78, 90, 94] : [0, 20, 36, 44, 52, 60, 68, 76, 84, 96, 116, 154]).forEach((index, i) => {
        const S = frames[Math.min(index, frames.length - 1)], R = S.run, e = R.en[0], z = R.zoom || DATA.ZOOM || 1; SCENE.state = S; SCENE.render(S.t + 0.01);
        if (name === 'serpent_flood') { ctx.drawImage(document.getElementById('c'), (e.x - R.cam[0]) * z - 330, (e.y - R.cam[1]) * z - 260, 660, 495, (i % 4) * 400, Math.floor(i / 4) * 300, 400, 300); return; }
        ctx.drawImage(document.getElementById('c'), (e.x - R.cam[0]) * z - 210, (e.y - R.cam[1]) * z - 240, 420, 320, (i % 4) * 400, Math.floor(i / 4) * 300, 400, 300);
      });
      return sheet.toDataURL('image/png');
    }, name);
    fs.writeFileSync(path.join(out, name + '_strip.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  report.flood = await page.evaluate(() => {
    const frames = window.serpentQA.transitions.serpent_flood, front = frames.filter((S) => S.run.map.flood).map((S) => S.run.map.flood.n);
    const last = frames[frames.length - 1], total = last.run.map.floodCells.length;
    if (!front.some((n) => n > 0 && n < total) || !front.includes(total) || front.some((n,i) => i && n < front[i-1])) throw new Error('flood has no complete advancing front');
    return {total, steps:[...new Set(front)], phase:last.run.en[0].phase};
  });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ errors, states: report }, null, 2));
  console.log(errors.length ? errors.join('\n') : `serpentcheck: ok (${names.length} states, finite cameras, fan emitters and eight bite directions)`);
  if (errors.length) process.exitCode = 2;
} finally {
  await browser.close(); server.close();
}
