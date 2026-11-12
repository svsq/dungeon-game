const path=require('path').resolve(process.env.ROOT||require('path').join(__dirname,'../../..'))+'/live/';
global.window=undefined; const SIM=require(path+'sim.js');
for (const seed of [20,101,1515,4,77]) { const S=SIM.spawn(0,{}); S.meta.shards=9999; SIM.step(S,{keys:[]}); S.run=SIM.newRun(S,'campaign',seed,{town:1}); S.screen='play'; const R=S.run; SIM.enterFloor(S,R,13); for(let i=0;i<90;i++) SIM.step(S,{px:960,py:540,keys:[]});
 const m=R.map,W=m.W,H=m.H,h=R.hero,cx=h.x/32,cy=h.y/32; let tot=0,best=1e9,win=0,seen=0; for(let y=0;y<H;y++)for(let x=0;x<W;x++) if(SIM.Q.cell(m,x,y)===3){tot++;const d=Math.hypot(x+.5-cx,y+.5-cy);best=Math.min(best,d); if(Math.abs((x+.5)*32-h.x)<480&&Math.abs((y+.5)*32-h.y)<270)win++; if(R.seen[y*W+x])seen++;}
 console.log(seed,'lava total',tot,'nearest cells',best.toFixed(1),'in 960x540 window',win,'seen',seen,'up',m.up&&[m.up.x,m.up.y],'hero',h.x,h.y); }
