import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', 'frames/colossuscheck');
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
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__Q = SCENE.QA(); });
  const report = await page.evaluate(() => {
    const failures = [], results = {}, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const trace = (name) => { const fr = __Q.transitions[name].map((S) => {
      LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
      const e = S.run.en.find((e) => e.id === 990), j = LIB.TRACE.en990;
      return { S, e, j, t: S.t + 0.01 };
    });
      let pop = 0, at = '';
      if (fr.some((f) => !f.j)) throw new Error(name + ': missing trace ' + JSON.stringify(fr.filter((f) => !f.j).slice(0, 3).map((f) => ({ screen: f.S.screen, t: f.t, st: f.e.st, hp: f.S.run.hero.hp, x: f.e.x, y: f.e.y, cam: f.S.run.cam }))));
      for (let i = 2; i < fr.length; i++) {
        if (fr[i].e.face !== fr[i - 1].e.face || fr[i - 1].e.face !== fr[i - 2].e.face) continue;
        for (const k of Object.keys(fr[i].j)) {
          if (k === 'tip' || k.startsWith('target') || !fr[i - 1].j[k] || !fr[i - 2].j[k]) continue;
          const rel = (f) => [f.j[k][0] - f.j.ground[0], f.j[k][1] - f.j.ground[1]], a = rel(fr[i]), b = rel(fr[i - 1]), c = rel(fr[i - 2]);
          const d = Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1]);
          if (d > pop) { pop = d; at = k + '@' + i; }
        }
      }
      const H = DATA.ENEMIES.boss_colossus.h;
      if (pop > 0.06 * H) failures.push(name + ': ' + at + ' pops ' + pop.toFixed(2));
      results[name + '_pop'] = { px: +pop.toFixed(2), at };
      return fr;
    };
    for (const move of ['fists', 'crack']) {
      const fr = trace('colossus_' + move), M = DATA.BOSSES.boss_colossus.moves[move];
      const contact = fr.filter((f) => f.e.mv === move && f.t >= f.e.t0 + M.wind && (move === 'fists' ? f.t < (f.e.openUntil || f.e.t0 + M.wind + M.duration + M.stuck) : f.t < f.e.t0 + M.wind + M.duration));
      let gap = 0;
      for (const f of contact) for (const side of move === 'fists' ? ['L', 'R'] : ['R']) {
        if (f.j.hip[1] > f.j.ground[1] - 15 || f.j['elbow' + side][1] > f.j.ground[1]) failures.push(move + ': body or elbow below ground');
        const p = DATA.colossusContact(f.e, side), target = [f.j.ground[0] + p.x - f.e.x, f.j.ground[1] + p.y - f.e.y - 0.11 * DATA.ENEMIES.boss_colossus.h];
        gap = Math.max(gap, dist(f.j['hand' + side], target));
      }
      if (!contact.length || gap > 8) failures.push(move + ': fists miss contact by ' + gap.toFixed(2));
      const i = fr.findIndex((f) => f.t >= f.e.t0 + M.wind), down = fr[i].j.handR[1] - fr[i - 1].j.handR[1];
      if (down <= 0) failures.push(move + ': striking hand does not descend');
      if (move === 'crack') {
        const f = fr.find((f) => (f.S.run.cracks || []).length), q = f.S.run.cracks[0], p = DATA.colossusContact(f.e);
        if (Math.hypot(q.x - p.x, q.y - p.y) > 0.01) failures.push('crack starts away from fist');
      }
      results[move] = { contactFrames: contact.length, maxGap: +gap.toFixed(2), impactDown: +down.toFixed(2) };
    }
    {
      const fr = trace('colossus_boulder'), M = DATA.BOSSES.boss_colossus.moves.boulder;
      const release = fr.findIndex((f) => f.e.fired && f.e.mv === 'boulder');
      let gap = 0, pop = 0;
      for (let i = 1; i < fr.length; i++) {
        const f = fr[i];
        if (f.e.mv !== 'boulder' || f.t > f.e.t0 + M.wind + M.fly - 0.04) continue;
        if (!f.j.rock) { failures.push('boulder missing at frame ' + i); continue; }
        if (i === release) gap = dist(f.j.rock, fr[i - 1].j.rock);
        if (i > 1 && fr[i - 1].j.rock && fr[i - 2].j.rock) {
          const a = f.j.rock, b = fr[i - 1].j.rock, c = fr[i - 2].j.rock;
          pop = Math.max(pop, Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1]));
        }
      }
      const before = fr[release - 1], earlier = fr[release - 4];
      if ((before.j.rock[0] - earlier.j.rock[0]) * before.e.face <= 0 || before.j.rock[1] >= earlier.j.rock[1]) failures.push('boulder is not thrown forward and up');
      if (release < 1 || gap > 14 || pop > 14) failures.push('boulder release gap/pop ' + gap.toFixed(2) + '/' + pop.toFixed(2));
      results.boulder = { release, gap: +gap.toFixed(2), pop: +pop.toFixed(2) };
    }
    {
      const fr = trace('colossus_charge'), M = DATA.BOSSES.boss_colossus.moves.charge;
      const run = fr.filter((f) => f.e.mv === 'charge' && f.t > f.e.t0 + M.wind && f.t < f.e.t0 + M.wind + M.time);
      const travel = dist([run[0].e.x, run[0].e.y], [run.at(-1).e.x, run.at(-1).e.y]);
      let motion = 0;
      for (let i = 1; i < run.length; i++) {
        const a = run[i - 1], b = run[i];
        if (Math.hypot(b.e.x - a.e.x, b.e.y - a.e.y) < 1) continue;
        const delta = (f, side) => [f.j['ankle' + side][0] - f.j.ground[0], f.j['ankle' + side][1] - f.j.ground[1]];
        const step = Math.max(dist(delta(a, 'L'), delta(b, 'L')), dist(delta(a, 'R'), delta(b, 'R')));
        motion = Math.max(motion, step);
        if (step < 0.1) failures.push('charge slides with both ankles still at ' + i);
      }
      if (travel < 200 || motion < 2) failures.push('charge too short or rigid: ' + travel.toFixed(2));
      results.charge = { travel: +travel.toFixed(2), ankleMotion: +motion.toFixed(2) };
    }
    {
      const fr = trace('colossus_call').filter((f) => f.e.mv === 'imps' && f.t - f.e.t0 > 0.3 && f.t - f.e.t0 < 0.7);
      const motion = Math.max(...fr.map((f) => f.j.handL[1])) - Math.min(...fr.map((f) => f.j.handL[1]));
      if (motion < 3) failures.push('call pose is static');
      results.call = { handMotion: +motion.toFixed(2) };
    }
    {
      const rise = trace('colossus_emerge');
      const wade = rise.findIndex((f) => f.e.st === 'wade'), shore = rise.findIndex((f) => f.e.st === 'chase');
      if (wade < 0 || shore < 0) failures.push('emerge does not reach shore');
      if (shore > 0 && Math.hypot(rise[shore].e.vx, rise[shore].e.vy) < 50) failures.push('wade stops dead at shore');
      const steps = rise.at(-1).S.ev.filter((e) => e.k === 'colstep').length;
      const visibleAt = (f, hand) => {
        if (!f.j.top) return false;
        const u = f.S.t - f.e.t0, sub = 1 - 0.22 * LIB.SS(0.7, 1.2, u) - 0.5 * LIB.SS(1.4, 2.2, u);
        const surface = f.j.ground[1] - sub * DATA.ENEMIES.boss_colossus.h * 1.02;
        return hand ? Math.min(f.j.handL[1], f.j.handR[1]) - 0.11 * DATA.ENEMIES.boss_colossus.h < surface : f.j.top[1] < surface;
      };
      const handFirst = rise.findIndex((f) => f.e.st === 'emerge' && visibleAt(f, true)), crownFirst = rise.findIndex((f) => f.e.st === 'emerge' && visibleAt(f, false));
      if (handFirst < 0 || crownFirst < 0 || handFirst >= crownFirst) failures.push('crown emerges before fists');
      results.emerge = { wade, shore, steps, handFirst, crownFirst };
      for (const move of ['fists', 'boulder', 'call', 'charge']) {
        const fr = trace('colossus_death_' + move), d = fr.findIndex((f) => f.e.deadT >= 0);
        const f = fr[Math.min(fr.length - 1, d + 60)], height = f.j.ground[1] - f.j.hip[1];
        if (height < 20) failures.push('colossus collapses too fast on death: ' + move);
        const late = fr.at(-1), top = late.j.ground[1] - late.j.top[1];
        if (top > 85) failures.push('dead torso remains upright: ' + move);
        results['death_' + move] = { hipAboveFloorAtOneSecond: +height.toFixed(2), lateTop: +top.toFixed(2) };
      }
      const phase = trace('colossus_phase_stuck'), next = phase.find((f) => f.e.phase === 1);
      if (!next || next.t < (next.e.openUntil || 0) + 0.4) failures.push('phase interrupts stuck recovery');
      results.phase = { time: next && +next.t.toFixed(3) };
    }
    for (const dir of ['right', 'down']) {
      const frames = __Q.cycles['boss_colossus_' + dir]; let both = 0, error = 0;
      for (let i = 0; i < frames.length; i++) {
        const S = frames[i], e = S.run.en.find((e) => e.id === 990);
        LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01); const j = LIB.TRACE.en990;
        if (['L', 'R'].every((side) => Math.abs(j['toe' + side][1] - j['ground' + side][1]) < 2)) both++;
        if (i === 0 || i === frames.length / 2) {
          const side = i === 0 ? 'L' : 'R', p = DATA.colossusStepAt(e, i === 0 ? 0 : 1);
          const target = [j.ground[0] + p.x - e.x, j.ground[1] + p.y - e.y];
          const drawn = [(j['toe' + side][0] + j['heel' + side][0]) / 2, (j['toe' + side][1] + j['heel' + side][1]) / 2];
          error = Math.max(error, dist(target, drawn));
        }
      }
      if (both / frames.length < 0.1 || error > 6) failures.push('walk ' + dir + ': support/contact ' + both + '/' + error.toFixed(2));
      results['walk_' + dir] = { doubleSupport: +(both / frames.length).toFixed(2), stepSourceError: +error.toFixed(2) };
    }
    for (const face of [-1, 1]) {
      const star = LIB.star, h = DATA.ENEMIES.boss_colossus.h;
      let frames = 0, error = 0, radius = 0, travel = 0, previous = null;
      try {
        for (const source of __Q.transitions.colossus_fists) {
          const S = structuredClone(source), e = S.run.en.find((e) => e.id === 990), stars = [];
          e.face = e.pf = face; e.ft = -9;
          LIB.star = (x, y, r, color, alpha) => {
            if (color[0] === 1 && color[1] === 0.9 && color[2] === 0.55) stars.push([x, y]);
            return star(x, y, r, color, alpha);
          };
          LIB.TRACE = {}; SCENE.state = S; SCENE.render(S.t + 0.01);
          const j = LIB.TRACE.en990, active = e.openUntil > S.t;
          if (!active) { if (stars.length) failures.push('stun stars outside stuck window'); continue; }
          frames++;
          if (stars.length !== 3 || !j.stun) { failures.push('stun stars missing for face ' + face); continue; }
          const center = [stars.reduce((sum, p) => sum + p[0], 0) / 3, stars.reduce((sum, p) => sum + p[1], 0) / 3];
          error = Math.max(error, dist(center, [j.head[0], j.head[1] - 0.16 * h]), dist(center, j.stun));
          for (const p of stars) radius = Math.max(radius, dist(center, p));
          const orbit = [stars[0][0] - center[0], stars[0][1] - center[1]];
          if (previous) travel += dist(orbit, previous);
          previous = orbit;
          if (!(window.__ANCHORS || []).some((a) => a.name === 'colossus_stars' && a.d <= a.tol)) failures.push('stun QA anchor missing');
        }
      } finally { LIB.star = star; }
      if (frames < 60 || error > 1 || radius > 0.13 * h || travel < 30) failures.push('stun orbit detached or static for face ' + face);
      results['stun_' + face] = { frames, anchorError: +error.toFixed(2), radius: +radius.toFixed(2), travel: +travel.toFixed(2) };
    }
    LIB.TRACE = null;
    return { results, failures };
  });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 2;
} finally { if (errors.length) { console.log('errors:', errors.slice(0, 5).join(' | ')); process.exitCode = 2; } await browser.close(); server.close(); }
