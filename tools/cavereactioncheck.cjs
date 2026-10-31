const assert = require('node:assert/strict');
const fs = require('node:fs');
const SIM = require('../live/sim.js');
const D = require('../live/data.js');
const out = 'frames/cave_reactions'; fs.mkdirSync(out, {recursive:true});
const events = [], counts = {wood:0,water:0,stone:0,sign:0};
for (const seed of [1,3,7]) {
  const S = SIM.spawn(0,{}); S.run = SIM.newRun(S,'cave',seed); S.screen = 'play';
  for (let f=1;f<=4;f++) {
    SIM.enterFloor(S,S.run,f); const R=S.run,m=R.map,h=R.hero;
    R.en=[];R.chests=[];R.pots=[];h.ifr=1e9;
    const check = (k,mat) => {
      h.x=(k%m.W+.5)*D.TILE;h.y=(Math.floor(k/m.W)+.5)*D.TILE;h.vx=h.vy=0;h.gp=Math.PI-.001;R.freeze=0;S.ev=[];
      SIM.step(S,{keys:[],right:1,px:960,py:540});
      const e=S.ev.find((e)=>e.k==='step');assert.ok(e,'no step on '+mat);assert.equal(e.mat,mat);
      if(mat==='water')assert.ok(e.wet);
      counts[mat]++;if(!events.some((q)=>q.k==='step'&&q.mat===mat))events.push(e);
    };
    for(const c of m.crossings) if(c.kind==='bridge'||c.kind==='ford') {
      const k=c.cells.find((k)=>m.cells[k]===1&&!m.block.includes(k));if(k!==undefined)check(k,c.kind==='bridge'?'wood':'stone');
    }
    const wet=new Set(m.water),cross=new Set(m.crossings.flatMap((c)=>c.cells));
    const k=m.cells.findIndex((c,k)=>c===1&&!wet.has(k)&&!cross.has(k)&&!m.block.includes(k));assert.ok(k>=0);check(k,'stone');
    const shallow=m.water.find((k)=>m.cells[k]===1&&!m.block.includes(k));if(shallow!==undefined)check(shallow,'water');
    const sign=m.decor.find((d)=>d.n==='shop_sign');assert.ok(sign);
    const x=sign.x,y=sign.y+50;S.t+=1;S.ev=[];R.propHit={};SIM.hitProps(S,R,x,y,100);
    const got=S.ev.filter((e)=>e.k==='prop'&&e.n==='shop_sign');assert.equal(got.length,1,'sign ignores floor-side hit');assert.equal(got[0].mat,'wood');counts.sign++;
    SIM.hitProps(S,R,x,y,100);assert.equal(S.ev.filter((e)=>e.k==='prop'&&e.n==='shop_sign').length,1);
    if(!events.some((e)=>e.n==='shop_sign'))events.push(got[0]);
    S.t+=1;S.ev=[];const cell=Math.floor((y+sign.y+30)/2/D.TILE)*m.W+Math.floor(x/D.TILE),old=m.cells[cell];m.cells[cell]=0;
    SIM.hitProps(S,R,x,y+32,100);m.cells[cell]=old;
    assert.ok(!S.ev.some((e)=>e.k==='prop'&&e.n==='shop_sign'),'sign hit through rock');
    for(const n of ['shroom_a','skel_cv']) {
      const d=m.decor.find((d)=>d.n===n);if(!d)continue;S.t+=1;S.ev=[];R.propHit={};SIM.hitProps(S,R,d.x,d.y,20);
      const e=S.ev.find((e)=>e.k==='prop'&&e.n===n);assert.ok(e,n+' ignores hit');if(!events.some((e)=>e.n===n))events.push(e);
    }
  }
}
for(const n of ['wood','water','stone','sign'])assert.ok(counts[n]>0,n+' not exercised');
fs.writeFileSync(out+'/events.json',JSON.stringify(events,null,2));fs.writeFileSync(out+'/simulation.json',JSON.stringify(counts,null,2));
console.log('cavereactioncheck: ok '+JSON.stringify(counts));
