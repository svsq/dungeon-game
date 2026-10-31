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
const browser=await chromium.launch({args:[...(process.platform==='darwin'?['--use-angle=metal']:[]),'--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(`http://127.0.0.1:${server.address().port}/live/index.html?render=1`);await page.waitForFunction(()=>window.__ready);
const result=await page.evaluate(()=>{
const S=SIM.spawn(0,{});S.seedBase=7;const start=DATA.UI.menu(false).find(b=>b.id==='cave');SIM.step(S,{keys:[],click:1,px:start.x+start.w/2,py:start.y+start.h/2});const shots=[],report={};
const capture=name=>{SCENE.state=S;SCENE.render(S.t+.01);shots.push({name:'ui_'+name,url:document.getElementById('c').toDataURL()});};
if(S.screen!=='play')SIM.step(S,{keys:['Escape']});SIM.step(S,{keys:[]});SIM.step(S,{keys:['KeyI']});capture('inventory_skills');report.inventory=S.screen;
const H=S.run.hero,clickInv=id=>{const q=DATA.UI.inv().r.find(b=>b.id===id);if(!q)throw Error(id);SIM.step(S,{keys:[],click:1,px:q.x+q.w/2,py:q.y+q.h/2});};
const pts=H.pts,str=H.base.str,sp=H.sp,rank=H.ab.fireball;
clickInv('stat:str');clickInv('ab:fireball');report.stat=H.pts===pts-1&&H.base.str===str+1;report.skill=H.sp===sp-1&&H.ab.fireball===rank+1;
const weapon=H.eq.weapon;clickInv('eq:weapon');report.unequip=!H.eq.weapon&&H.bag.includes(weapon);clickInv('bag:'+H.bag.indexOf(weapon));report.equip=H.eq.weapon===weapon;
const hpidx=H.bag.findIndex(it=>it?.b==='hp_potion'),mpidx=H.bag.findIndex(it=>it?.b==='mp_potion');H.hp=1;H.mp=0;const hpN=H.bag[hpidx].n,mpN=H.bag[mpidx].n;clickInv('bag:'+hpidx);clickInv('bag:'+mpidx);report.potion=H.hp>1&&H.mp>0&&H.bag[hpidx].n===hpN-1&&H.bag[mpidx].n===mpN-1;
const scrollIdx=H.bag.findIndex(it=>it===null);H.bag[scrollIdx]={b:'scroll',n:1,id:99999};const target=S.run.map.spawn;H.x+=64;clickInv('bag:'+scrollIdx);report.scroll=H.bag[scrollIdx]===null&&H.x===target.x&&H.y===target.y;capture('inventory_after_clicks');
SIM.step(S,{keys:['Escape']});SIM.step(S,{keys:[]});SIM.step(S,{keys:['Escape']});capture('pause');report.pause=S.screen;
const save=DATA.UI.pause(S.meta.zoom).find(b=>b.id==='save');SIM.step(S,{keys:[],click:1,px:save.x+save.w/2,py:save.y+save.h/2});report.saved=!!S.saved;capture('saved_menu');
let C=SIM.spawn(0,JSON.parse(JSON.stringify(SIM.persist(S))));const cont=DATA.UI.menu(true,C.meta.diff,false,C.meta.zoom).find(b=>b.id==='continue');SIM.step(C,{keys:[],click:1,px:cont.x+cont.w/2,py:cont.y+cont.h/2});report.continue=C.screen;report.mode=C.run.mode;
Object.assign(S,C);capture('continued');
const h=S.run.hero;h.ifr=0;h.hp=1;S.run.proj.push({id:S.run.nextId++,own:'en',src:999,who:'test',k:'jet',x:h.x,y:h.y-20,vx:0,vy:0,gz:20,life:10,t0:S.t,dmg:100000,r:30});for(let i=0;i<400;i++)SIM.step(S,{keys:[]});capture('death');report.death=S.screen;
const bite=structuredClone(SCENE.QA().states.find(([n])=>n==='serpent_bite_aim_0')[1]),b=bite.run.en.find(e=>e.type==='boss_serpent');for(let i=0;i<180;i++){SIM.step(bite,{keys:[]});if(i%20===0){SCENE.state=bite;SCENE.render(bite.t+.01);shots.push({name:'boss_bite_actual_'+i,url:document.getElementById('c').toDataURL()});}}report.biteEvents=[...new Set(bite.ev.map(e=>e.k))];return {shots,report};
});
for(const shot of result.shots){fs.writeFileSync(path.join(out,shot.name+'.png'),Buffer.from(shot.url.split(',')[1],'base64'));delete shot.url;}
fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.report));if(!['stat','skill','unequip','equip','potion','scroll'].every(k=>result.report[k])||result.report.inventory!=='inv'||result.report.pause!=='pause'||!result.report.saved||result.report.continue!=='play'||result.report.mode!=='cave'||result.report.death!=='dead'||!result.report.biteEvents.includes('bite'))throw Error('Incomplete cave UI');
fs.writeFileSync(path.join(out,'errors.json'),JSON.stringify(errors));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();server.close();}
