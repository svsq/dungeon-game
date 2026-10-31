import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || path.join(os.homedir(), '.claude/skills/ref2game/scripts/node_modules/playwright'));
const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'frames/water';
fs.mkdirSync(out, { recursive: true });
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const failures = [], samples = [];
let browser;
try {
  browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => failures.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const names = await p.evaluate(() => {
    window.__WATER = SCENE.QA().states.filter(([name]) => /^water_(fountain|stream)_/.test(name) || ['water_crossing', 'cave_water', 'cave_waterfall'].includes(name));
    return window.__WATER.map(([name]) => name);
  });
  if (names.length !== 9) failures.push(`expected nine water states, got ${names.length}`);
  for (const name of names) {
    const result = await p.evaluate((name) => {
      const base = window.__WATER.find(([key]) => key === name)[1], canvas = document.getElementById('c'), draw = G.draw;
      // a room's pool keeps its box as the camera moves and passes the same fires; a cave's water box follows the view, so each fire
      // it passes inside both views (a margin in) must be passed again, unchanged
      let calls = {}, cave = null;
      G.draw = (program, uniforms, xf, ...rest) => {
        if (program === LIB.P.pool) calls[uniforms.u_box.join(',')] = JSON.stringify([uniforms.u_fire, uniforms.u_fireCol]);
        if (program === LIB.P.cavewater) { const f = uniforms.u_fire, c = uniforms.u_fireCol; cave = { box: uniforms.u_box, fires: [] };
          for (let i = 0; i < f.length / 4; i++) if (f[i * 4 + 3]) cave.fires.push(JSON.stringify([f.slice(i * 4, i * 4 + 4), c.slice(i * 3, i * 3 + 3)])); }
        return draw(program, uniforms, xf, ...rest);
      };
      const inside = (fire, box) => { const [x, y] = JSON.parse(fire)[0]; return x > box[0] + 160 && x < box[0] + box[2] - 160 && y > box[1] + 120 && y < box[1] + box[3] - 160; };
      try {
        SCENE.state = structuredClone(base); SCENE.render(base.t + 0.01);
        const first = canvas.toDataURL(), reference = calls, caveRef = cave;
        calls = {}; SCENE.render(base.t + 0.01);
        const deterministic = first === canvas.toDataURL(); let shifts = 0, changes = 0;
        for (const [dx, dy] of [[-64, 0], [-32, 0], [32, 0], [64, 0], [0, -32], [0, 32]]) {
          SCENE.state = structuredClone(base); SCENE.state.run.cam[0] += dx; SCENE.state.run.cam[1] += dy; calls = {}; cave = null; SCENE.render(base.t + 0.01);
          for (const [key, value] of Object.entries(calls)) if (reference[key]) { shifts++; if (reference[key] !== value) changes++; }
          if (caveRef && cave) for (const fire of caveRef.fires) if (inside(fire, caveRef.box) && inside(fire, cave.box)) { shifts++; if (!cave.fires.includes(fire)) changes++; }
        }
        return { url: first, deterministic, shifts, changes };
      } finally { G.draw = draw; }
    }, name);
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(result.url.split(',')[1], 'base64'));
    if (!result.deterministic) failures.push(name + ': repeated render changed');
    if (!result.shifts || result.changes) failures.push(name + ': reflections changed with the camera');
    samples.push({ name, deterministic: result.deterministic, shifts: result.shifts, changes: result.changes });
  }
  for (const name of ['water_fountain_dungeon', 'water_stream_dungeon', 'cave_water']) {
    const fps = await p.evaluate(async (name) => {
      const base = window.__WATER.find(([key]) => key === name)[1]; SCENE.state = structuredClone(base);
      return await new Promise((resolve) => {
        let n = 0, start = 0;
        const frame = (time) => {
          if (n === 20) start = time;
          SCENE.render(base.t + n / 60 + 0.01);
          if (++n === 141) resolve(120000 / (time - start)); else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    }, name);
    if (fps < 55) failures.push(`${name}: ${fps.toFixed(1)} fps`);
    samples.push({ name, fps });
  }
  await p.evaluate(() => {
    window.__audioConnections = [];
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (target, ...args) { window.__audioConnections.push([this, target]); return connect.call(this, target, ...args); };
  });
  await p.keyboard.press('z');
  await p.waitForFunction(() => AUDIO.state === 'running', null, { timeout: 5000 });
  // the page's own loop feeds AUDIO its state every frame too: the test state is fed just as often, or the two race (TASKS 242)
  const hold = (ms) => p.evaluate((ms) => new Promise((done) => { const id = setInterval(() => AUDIO.update(window.__waterAudioState), 8); setTimeout(() => { clearInterval(id); done(); }, ms); }), ms);
  await p.evaluate(() => {
    const S = structuredClone(window.__WATER.find(([name]) => name === 'water_fountain_dungeon')[1]), R = S.run;
    const q = R.map.waterFeatures.find((q) => q.kind === 'fountain'); R.hero.x = q.x; R.hero.y = q.y + 32;
    R.seen.fill(1); S.demo = false; window.__waterAudioState = S;
  });
  await hold(800);
  const near = await p.evaluate(() => {
    const pair = window.__audioConnections.find(([from]) => from instanceof BiquadFilterNode && from.type === 'bandpass' && Math.abs(from.Q.value - 0.45) < 1e-3);
    window.__waterGain = pair?.[1]; return window.__waterGain?.gain.value || 0;
  });
  await p.evaluate(() => { const S = window.__waterAudioState; S.run.hero.x += 1000; S.t += 1; });
  await hold(1500);
  const far = await p.evaluate(() => window.__waterGain?.gain.value || 0);
  const audio = await p.evaluate(() => ({ state: AUDIO.state, connections: window.__audioConnections.length,
    waterChannel: !!window.__waterGain, contextState: window.__waterGain?.context.state, time: window.__waterGain?.context.currentTime }));
  if (!(near > 0.01 && far < near * 0.05)) failures.push(`water sound does not fade with distance: ${near} → ${far}`);
  samples.push({ sound: { near, far, ...audio } });
  // a cave's fall roars further and louder than a fountain, panned to its side (TASKS 304)
  await p.evaluate(() => { const S = structuredClone(window.__WATER.find(([name]) => name === 'cave_waterfall')[1]), R = S.run, q = R.map.waterFeatures.find((q) => q.kind === 'waterfall');
    R.hero.x = q.x + 200; R.hero.y = q.y + 32; R.seen.fill(1); S.demo = false; window.__waterAudioState = S; });
  await hold(1500);
  const fall = await p.evaluate(() => window.__waterGain?.gain.value || 0);
  // away from every source on the floor, not just this one
  await p.evaluate(() => { const S = window.__waterAudioState; S.run.hero.x = -4000; S.t += 1; });
  await hold(1500);
  const fallFar = await p.evaluate(() => window.__waterGain?.gain.value || 0);
  if (!(fall > near * 0.5 && fallFar < fall * 0.05)) failures.push(`the cave's fall is not heard 200 px off or does not fade: ${fall} → ${fallFar} (fountain at 32 px ${near})`);
  samples.push({ fall: { at200: fall, far: fallFar } });
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ failures, samples }, null, 2));
for (const f of failures) console.log('FAIL', f);
console.log(`watercheck: ${failures.length ? failures.length + ' failure(s)' : 'ok'} (9 states, reflections, fps, sound)`);
process.exitCode = failures.length ? 2 : 0;
