import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const out = 'frames/serpent_warnings'; fs.mkdirSync(out, { recursive: true });
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
  const result = await page.evaluate(() => {
    const Q = SCENE.QA(), cv = document.getElementById('c'), read = document.createElement('canvas'); read.width = cv.width; read.height = cv.height;
    const ctx = read.getContext('2d', {willReadFrequently:true}), report = {}, sheets = {};
    const pixels = (S, skip) => {
      const draw = G.draw;
      if (skip) G.draw = (p,u,...args) => skip(p,u) ? undefined : draw(p,u,...args);
      try { SCENE.state = S; SCENE.render(S.t+.01); ctx.drawImage(cv,0,0); return ctx.getImageData(0,0,cv.width,cv.height).data; }
      finally { G.draw = draw; }
    };
    const changed = (a,b,threshold) => {let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>=threshold)n++;return n;};
    for (const mv of ['bite','tail','wave','fan']) {
      const S = structuredClone(Q.states.find(([n]) => n === 'serpent_warn_'+mv)[1]), e=S.run.en[0], M=DATA.BOSSES.boss_serpent.moves[mv], z=S.run.zoom||DATA.ZOOM||1;
      const area=(mv==='bite'?M.arc*M.r*M.r:mv==='tail'?Math.PI*M.r*M.r:mv==='wave'?68*M.reach:M.n*44*M.reach)*z*z;
      const samples=[];
      for(let i=0;i<=Math.ceil(M.wind*60);i++) {
        const u=Math.min(M.wind,i/60);e.t0=S.t-u;
        const on=pixels(S),off=pixels(S,(p)=>p===LIB.P.serptele), faint=changed(on,off,12),strong=changed(on,off,45);
        samples.push({u,faint,strong});
        if(faint<area*.3)throw new Error(mv+' @'+u+': warning absent or too small '+faint+'/'+area);
        if(u>=M.wind*.9&&strong<area*.3)throw new Error(mv+' @'+u+': final warning too weak '+strong+'/'+area);
      }
      report[mv]={area,samples};
    }
    const S=structuredClone(Q.states.find(([n])=>n==='serpent_emerge_warning')[1]),e=S.run.en[0],tex=G.tex('serpent__body'),B=DATA.BOSSES.boss_serpent;
    e.st='stir';const samples=[],sheet=document.createElement('canvas');sheet.width=1280;sheet.height=480;const sc=sheet.getContext('2d');
    for(let i=0;i<=60;i++) {
      e.t0=S.t-B.warn*i/60;
      const on=pixels(S),off=pixels(S,(_,u)=>u.u_tex===tex),n=changed(on,off,6);
      if(n<64)throw new Error('emerge @'+i+': submerged silhouette invisible '+n);
      samples.push(n);
      if(i%5===0&&i<60){pixels(S);const r=S.run,z=r.zoom||DATA.ZOOM||1,j=i/5;sc.drawImage(cv,(e.x-r.cam[0])*z-160,(e.y-r.cam[1])*z-80,320,160,j%4*320,Math.floor(j/4)*160,320,160);}
    }
    report.emerge={samples,min:Math.min(...samples)};sheets.emerge=sheet.toDataURL();
    return {report,sheets};
  });
  for(const [name,url] of Object.entries(result.sheets))fs.writeFileSync(out+'/'+name+'.png',Buffer.from(url.split(',')[1],'base64'));
  fs.writeFileSync(out+'/report.json',JSON.stringify(result.report,null,2));
  console.log('serpentwarncheck: ok (60 FPS whole wind-ups, four areas, whole emerge silhouette)');
} finally { await browser.close(); server.close(); }
