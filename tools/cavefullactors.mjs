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
const result=await page.evaluate(()=>{
 const shots=[],report={};
 for(const label of ['eel','eel_spit','crab','crab_rush'])for(const sd of [7]){
  const type=label.split('_')[0];const S=SIM.spawn(0,{});S.run=SIM.newRun(S,'cave',sd);SIM.enterFloor(S,S.run,3);S.screen='play';S.t=10;
  const R=S.run,m=R.map,h=R.hero,e=R.en.find(e=>e.type===type);if(!e)throw Error('missing '+type);
  const shore=m.cells.flatMap((c,k)=>c===1&&!m.block.includes(k)?[{x:(k%m.W+.5)*32,y:(Math.floor(k/m.W)+.5)*32}]:[]).sort((a,b)=>Math.abs(Math.hypot(a.x-e.x,a.y-e.y)-(label.includes('_')?180:0))-Math.abs(Math.hypot(b.x-e.x,b.y-e.y)-(label.includes('_')?180:0)))[0];
  h.x=shore.x;h.y=shore.y;h.ifr=1e9;R.en=[e];R.freeze=0;R.seen.fill(1);R.rseen.fill(1);S.ev=[];e.cdT=S.t;e.calmT=0;if(label==='crab_rush')e.fa=Math.atan2(h.y-e.y,h.x-e.x)+Math.PI/2;
  const seen=new Set(),ev=new Set();let prev='',n=0;
  for(let i=0;i<2400;i++){
   const tag=e.deadT>=0?'dead':e.st+(e.spit?'_spit':'')+(e.rush?'_rush':'');seen.add(tag);
   R.cam=[(h.x+e.x)/2-960,(h.y+e.y)/2-540];
   if((tag!==prev||i%120===0)&&n<70){SCENE.state=S;SCENE.render(S.t+.01);shots.push({name:`${label}_${String(n++).padStart(3,'0')}_${tag}`,t:S.t,url:document.getElementById('c').toDataURL()});prev=tag;}
   if(i===1900||i===2000){R.proj.push({id:R.nextId++,own:'hero',k:'fire',x:e.x,y:e.y-20,vx:0,vy:0,gz:20,life:0,t0:S.t,dmg:i===1900?1:100000,r:8});}
   SIM.step(S,{keys:[],px:960,py:540});for(const v of S.ev)if(v.t===S.t)ev.add(v.k);
  }
  report[label]={states:[...seen],events:[...ev],dead:e.deadT>=0};
 }
 return {shots,report};
});
for(const shot of result.shots){fs.writeFileSync(path.join(out,shot.name+'.png'),Buffer.from(shot.url.split(',')[1],'base64'));delete shot.url;}
fs.writeFileSync(path.join(out,'extra.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.report));for(const [label,r] of Object.entries(result.report)){if(!r.dead||!r.events.includes(label==='eel_spit'?'spit':label==='eel'?'bite':label==='crab_rush'?'rush':'pinch'))throw Error('Incomplete actor '+label);}
fs.writeFileSync(path.join(out,'errors.json'),JSON.stringify(errors));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();server.close();}
