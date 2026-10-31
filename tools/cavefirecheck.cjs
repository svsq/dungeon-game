const assert = require('node:assert/strict');
const fs = require('node:fs');
const SIM = require('../live/sim.js'), D = require('../live/data.js');
const out='frames/cave_fire_cases';fs.mkdirSync(out,{recursive:true});
const states=[],report=[];
const base=(seed,f)=>{const S=SIM.spawn(0,{});S.run=SIM.newRun(S,'cave',seed);SIM.enterFloor(S,S.run,f);S.screen='play';const R=S.run,h=R.hero;R.en=[];R.pots=[];R.chests=[];R.msg=null;R.seen.fill(1);R.rseen.fill(1);h.ab.fireball=1;h.cd.fireball=0;h.mp=999;h.ifr=1e9;S.t=10;R.t=10;S.ev=[];return S;};
const cast=(S,a)=>{const R=S.run,h=R.hero;h.aim=a;h.face=Math.cos(a)>=0?1:-1;R.cam=[h.x-960,h.y-540];const hand=SIM.hand(h);const inp={keys:[],px:hand[0]-R.cam[0]+Math.cos(a)*400,py:hand[1]-R.cam[1]+Math.sin(a)*400};SIM.step(S,{...inp,rclick:1});return inp;};
let bridge=false;
for(const seed of [3,7,1])for(let f=1;f<=4&&!bridge;f++) {
  const S=base(seed,f),R=S.run,m=R.map,h=R.hero;
  for(const c of m.crossings.filter((c)=>c.kind==='bridge'))for(const post of c.posts) {
    if(bridge)break;
    const C=structuredClone(S),A=C.run,H=A.hero;
    H.x=post.x-120;H.y=post.y+SIM.RIG.shoulder-28;
    if(SIM.cell(m,Math.floor(H.x/D.TILE),Math.floor(H.y/D.TILE))!==1)continue;
    const inp=cast(C,0),shots=[],crossed=[];let passed=false;
    for(let i=0;i<90;i++) {
      const p=A.proj.find((p)=>p.own==='hero');if(!p)break;
      const dx=p.x-post.x;
      if(dx>-30&&dx<60&&shots.length<3&&i%4===0)shots.push(['cave_fireball_bridge_'+shots.length,structuredClone(C)]);
      crossed.push(SIM.cell(A.map,Math.floor(p.x/D.TILE),Math.floor((p.y+20)/D.TILE)));
      if(dx>60){passed=true;break;}
      SIM.step(C,inp);
    }
    if(passed&&shots.length===3){bridge=true;states.push(...shots);report.push({kind:'bridge',seed,f,post,cells:[...new Set(crossed)]});}
  }
}
assert.ok(bridge,'no actual bridge-post crossing');
let drowned=false;
for(const seed of [1,3,7])for(let f=1;f<=4&&!drowned;f++) {
  const S=base(seed,f),R=S.run,m=R.map,h=R.hero,W=m.W;
  for(const k of m.water) {
    if(drowned||m.cells[k]!==1)continue;
    const x=(k%W+.5)*D.TILE,y=(Math.floor(k/W)+.5)*D.TILE;
    const hy=y+SIM.RIG.shoulder-28;
    if(!Array.from({length:7},(_,i)=>SIM.cell(m,Math.floor((x-200+i*32)/D.TILE),Math.floor(y/D.TILE))).every(c=>c===1||c===6))continue;
    if(SIM.cell(m,Math.floor((x-200)/D.TILE),Math.floor(hy/D.TILE))!==1)continue;
    const C=structuredClone(S),A=C.run,H=A.hero,E=D.ENEMIES.drowned;
    const e={id:990,type:'drowned',x,y,hx:x,hy:y,vx:0,vy:0,hp:10000,max:10000,dmg:1,elite:0,room:-1,st:'lurk',t0:-9,face:-1,aimA:Math.PI,cdT:99,hitT:-9,deadT:-1,dist:0,kbx:0,kby:0,burn:0,burnT:0};
    A.en=[e];H.x=x-200;H.y=hy;const inp=cast(C,0),shots=[];
    for(let i=0;i<100;i++) {
      const p=A.proj.find((p)=>p.own==='hero');
      if(p&&shots.length<2&&p.x>x-120+shots.length*50)shots.push(['cave_fireball_drowned_'+shots.length,structuredClone(C)]);
      if(e.hp<10000){shots.push(['cave_fireball_drowned_hit',structuredClone(C)]);break;}
      if(!p)break;SIM.step(C,inp);
    }
    if(e.hp<10000&&e.st==='rise'&&shots.length===3){drowned=true;states.push(...shots);report.push({kind:'drowned',seed,f,start:'lurk',end:e.st,damage:10000-e.hp});}
  }
}
assert.ok(drowned,'no real hit on lying drowned in shallows');
fs.writeFileSync(out+'/states.json',JSON.stringify(states));fs.writeFileSync(out+'/simulation.json',JSON.stringify(report,null,2));
console.log('cavefirecheck: ok (real casts across bridge post and into lying drowned, actual maps)');
