import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const skill=path.join(os.homedir(),'.claude/skills/ref2game/scripts');
const {chromium}=createRequire(path.join(skill,'qa.mjs'))(path.join(skill,'node_modules/playwright'));
const out='frames/cave_full_play';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((q,r)=>fs.readFile(path.join(process.cwd(),decodeURIComponent(q.url.split('?')[0])),(e,b)=>{r.writeHead(e?404:200,{'Content-Type':q.url.includes('.js')?'application/javascript':q.url.includes('.png')?'image/png':'text/html'});r.end(b);}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);await page.waitForFunction(()=>window.__ready);
let source=fs.readFileSync('tools/bot.cjs','utf8');
source=source.replace(/const VERSION = \(\(\) => \{[\s\S]*?\}\)\(\);/,"const VERSION='browser-full-review';");
await page.evaluate(source=>{window.botModule={exports:{}};new Function('require','module',source)(p=>p.includes('sim.js')?SIM:DATA,window.botModule);},source);
for (const seed of [7,12,3]) {
const result=await page.evaluate(seed=>{
 const step=SIM.step,seen=new Set(),events={},actors={},floors={},shots=[],screens={},visited={};let n=0,last='',screenshotN=0;
 const capture=(S,tag)=>{if(shots.length>=140)return;SCENE.state=S;SCENE.render(S.t+.01);shots.push({name:`s${seed}_${String(screenshotN++).padStart(3,'0')}_${tag.replace(/[^a-z0-9_]/gi,'_')}`,t:S.t,floor:S.run?.floor,url:document.getElementById('c').toDataURL()});};
 SIM.step=(S,inp)=>{const pre=S.screen;step(S,inp);n++;screens[S.screen]=(screens[S.screen]||0)+1;const R=S.run;
 if(R){floors[R.floor]=true;const h=R.hero,m=R.map,room=m.rooms.findIndex(q=>h.x>=q.x*32&&h.x<(q.x+q.w)*32&&h.y>=q.y*32&&h.y<(q.y+q.h)*32);visited[`${R.floor}:${room}`]=true;
 for(const e of R.en){const key=`${e.type}:${e.st}:${e.mv||''}:${e.phase||''}`;actors[key]=(actors[key]||0)+1;}
 if(n%600===0||last!==`${R.floor}:${room}:${S.screen}`){const key=`${R.floor}:${room}:${S.screen}`;if(!seen.has(key)){seen.add(key);capture(S,`f${R.floor}_room${room}_${S.screen}`);}last=key;}
 for(const e of S.ev){if(e.t!==S.t)continue;events[e.k]=(events[e.k]||0)+1;if(['flood','win','death','grabbed','split','altar','trade'].includes(e.k)&&!seen.has('ev'+e.k)){seen.add('ev'+e.k);capture(S,'event_'+e.k);}}
 }if(pre!==S.screen&&!seen.has('screen'+S.screen)){seen.add('screen'+S.screen);capture(S,'screen_'+S.screen);}
 };
 let runs;try{runs=window.botModule.exports.play({seed,profile:'expert',runs:1,mode:'cave'});}finally{SIM.step=step;}
 return {seed,steps:n,runs,events,actors,floors,screens,visited,shots};
},seed);
for(const s of result.shots){fs.writeFileSync(path.join(out,s.name+'.png'),Buffer.from(s.url.split(',')[1],'base64'));delete s.url;}
fs.writeFileSync(path.join(out,`seed${seed}.json`),JSON.stringify(result,null,2));if(Object.keys(result.floors).length!==4||result.runs[0]?.result.how!=='win')throw Error('Incomplete cave route '+seed);console.log(JSON.stringify({seed,steps:result.steps,floors:result.floors,result:result.runs.map(r=>r.result),shots:result.shots.length}));
}
fs.writeFileSync(path.join(out,'errors.json'),JSON.stringify(errors));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();server.close();}
