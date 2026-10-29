import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const out = 'frames/cave_mapcheck'; fs.mkdirSync(out, { recursive: true });
let revision = 0, scenePolls = 0;
const server = http.createServer((q, r) => {
  const file = path.join(process.cwd(), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(file, (err, bytes) => {
    if (err) { r.writeHead(404); r.end(); return; }
    if (q.url.includes('scene.js?poll=')) scenePolls++;
    r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html');
    r.setHeader('Content-Length', bytes.length);
    r.setHeader('Last-Modified', file.endsWith('scene.js') && revision ? 'Thu, 29 Oct 2026 12:00:01 GMT' : 'Thu, 29 Oct 2026 12:00:00 GMT');
    r.end(q.method === 'HEAD' ? undefined : bytes);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const url = `http://127.0.0.1:${server.address().port}/live/index.html`;
try {
  await page.goto(url + '?render=1'); await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(() => {
    const Q = SCENE.QA(), S = structuredClone(Q.states.find(([n]) => n === 'cave_known_boundary')[1]);
    const read = (name) => {
      const gl = G.gl, tex = G.tex(name), old = gl.getParameter(gl.FRAMEBUFFER_BINDING), fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('incomplete ' + name);
      const bytes = new Uint8Array(tex.w * tex.h * 4); gl.readPixels(0, 0, tex.w, tex.h, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      gl.bindFramebuffer(gl.FRAMEBUFFER, old); gl.deleteFramebuffer(fb); return bytes;
    };
    const draw = (S) => { SCENE.state = S; SCENE.render(S.t + .01); return document.getElementById('c').toDataURL(); };
    const a = draw(S), fogA = read('seen'), mapA = read('minimap'), count = S.run.seen.reduce((a,b) => a+b,0);
    const swap = structuredClone(S); swap.run.seen.reverse(); draw(swap);
    if (swap.run.seen.reduce((a,b) => a+b,0) !== count) throw new Error('fixture changes explored count');
    if (!read('seen').some((v,i) => v !== fogA[i])) throw new Error('seen texture stale at equal count');
    if (!read('minimap').some((v,i) => v !== mapA[i])) throw new Error('minimap stale at equal count');
    draw(S);
    const seen = JSON.stringify(S.run.seen), rseen = JSON.stringify(S.run.rseen);
    S.screen = 'pause'; const save = DATA.UI.pause(S.meta.zoom).find((b) => b.id === 'save');
    SIM.step(S, {keys:[],click:1,px:save.x+10,py:save.y+10});
    const T = SIM.spawn(0, JSON.parse(JSON.stringify(SIM.persist(S))));
    const resume = DATA.UI.menu(true).find((b) => b.id === 'continue');
    SIM.step(T,{keys:[],click:1,px:resume.x+10,py:resume.y+10});
    if (T.screen !== 'play' || JSON.stringify(T.run.seen) !== seen || JSON.stringify(T.run.rseen) !== rseen) throw new Error('save/continue loses exploration');
    draw(T);
    if (!read('seen').every((v,i) => v === fogA[i]) || !read('minimap').every((v,i) => v === mapA[i])) throw new Error('restored exploration differs on GPU');
    const shots = { boundary_1: a };
    for (const name of ['cave_known_dark', 'cave_known_boundary', 'cave_map_left', 'cave_map_right', 'cave_map_top', 'cave_map_bottom']) {
      const C = structuredClone(Q.states.find(([n]) => n === name)[1]); C.run.zoom = C.meta.zoom = 1.5;
      const cam = C.run.cam; cam[0] += (1920 - 1920 / 1.5) / 2; cam[1] += (1080 - 1080 / 1.5) / 2;
      const first = draw(C); if (first !== draw(C)) throw new Error(name + ': nondeterministic zoom 1.5');
      shots[name + '_1_5'] = first;
    }
    T.meta.zoom = T.run.zoom = 1.5; T.saveN++;
    sessionStorage.setItem('live2', JSON.stringify({ simT:T.t+.01,speed:1,paused:true,play:T }));
    localStorage.setItem('dc2_meta', JSON.stringify(T.meta)); localStorage.setItem('dc2_run', JSON.stringify(T.run));
    return { shots, seen, rseen, seed:T.run.map.seed, floor:T.run.floor, t:T.t, count };
  });
  for (const [name, image] of Object.entries(result.shots)) fs.writeFileSync(out + '/' + name + '.png', Buffer.from(image.split(',')[1], 'base64'));
  delete result.shots;
  await page.goto(url); await page.waitForFunction(() => window.__ready && SCENE.state && document.getElementById('dev').textContent.includes('PAUSED'));
  while (!scenePolls) await page.waitForResponse((r) => r.url().includes('scene.js?poll='));
  const navigation = page.waitForNavigation({waitUntil:'load'}); revision++;
  await navigation; await page.waitForFunction(() => window.__ready && SCENE.state && document.getElementById('dev').textContent.includes('PAUSED'));
  const restored = await page.evaluate(() => { const S = SCENE.state; return {seen:JSON.stringify(S.run.seen),rseen:JSON.stringify(S.run.rseen),seed:S.run.map.seed,floor:S.run.floor,t:S.t,zoom:S.run.zoom}; });
  for (const k of ['seen','rseen','seed','floor','t']) if (result[k] !== restored[k]) errors.push('hot reload lost ' + k);
  if (restored.zoom !== 1.5) errors.push('hot reload lost zoom');
  await page.screenshot({path:out+'/hot_reload.png'});
  fs.writeFileSync(out+'/report.json',JSON.stringify({count:result.count,scenePolls,restored:{...restored,seen:undefined,rseen:undefined},errors},null,2));
} finally { await browser.close(); server.close(); }
console.log(errors.length ? errors.join('\n') : 'cavemapcheck: ok (GPU cache, save/continue, actual hot reload, zoom 1.5)');
if (errors.length) process.exitCode = 2;
