(() => { const G = window.DATA || (typeof DATA !== "undefined" ? DATA : LIB.DATA); const shots=[],info=[],T=32,VW=1920,VH=1080;
 const mk=(sd,f)=>{const S=SIM.spawn(0,{}); S.meta.shards=9999; SIM.step(S,{keys:[]}); S.run=SIM.newRun(S,'campaign',sd,{town:true}); S.screen='play'; SIM.enterFloor(S,S.run,f); return S;};
 const stepn=(S,n)=>{for(let i=0;i<n;i++) SIM.step(S,{px:960,py:540,keys:[]});};
 const walkTo=(S,tx,ty,stop)=>{const R=S.run,m=R.map,W=m.W,deck=new Set((m.crossings||[]).flatMap(c=>c.cells)),s=Math.floor(m.spawn.y/T)*W+Math.floor(m.spawn.x/T),e=Math.floor(ty/T)*W+Math.floor(tx/T),p=new Map([[s,-1]]),q=[s];
  for(let i=0;i<q.length&&!p.has(e);i++)for(const o of [1,-1,W,-W]){const n=q[i]+o;if(!p.has(n)&&(m.cells[n]===1||m.cells[n]===6||deck.has(n))){p.set(n,q[i]);q.push(n);}}
  if(!p.has(e))return null;const way=[];for(let k=e;k>=0;k=p.get(k))way.unshift(k);const cut=way.slice(0,Math.max(1,way.length-stop));R.en=[];
  for(const k of cut){R.hero.x=(k%W+.5)*T;R.hero.y=(Math.floor(k/W)+.5)*T;R.hero.hp=R.hero.hpMax||9999;SIM.step(S,{px:960,py:540,keys:[]});}R.msg=null;return way;};
 // gates
 for(const [sd,f,stop] of [[14,13,7],[14,14,7],[49,14,7],[35,13,5],[56,13,7],[91,14,7]]){
  const base=mk(sd,f),R0=base.run,g=R0.map.hazards.filter(z=>z.gate),mid=g[Math.min(1,g.length-1)]; if(!mid){console.log("nogate",sd,f);continue;} const way=walkTo(base,mid.x,mid.y,stop); if(!way){console.log('noway',sd,f);continue;} stepn(base,30); base.ev=[];
  const h=R0.hero; info.push; for(const ph of ['rest','warn0','warn','burst','burst2']){const S=structuredClone(base),R=S.run,z=R.map.hazards.find(q=>q.gate),H=G.HAZ.vent;
   const c=ph==='rest'?z.per*.4:ph==='warn0'?z.per-H.warn*.9:ph==='warn'?z.per-H.warn*.2:ph==='burst'?0.12:0.3; const t=(((c/z.per-z.ph)%1+1)%1+20)*z.per+0; S.t=R.t=t; S.ev=[]; if(ph.startsWith('burst'))R.map.hazards.forEach((q,i)=>{if(q.gate)S.ev.push({k:'erupt',t:t-c,x:q.x,y:q.y,i});});
   shots.push([`gate_${sd}f${f}_${ph}`,S]); info.push({per:z.per,hero:[h.x|0,h.y|0],gate:[mid.x,mid.y],cam:R.cam.map(v=>v|0),hz:G.HAZ.vent.r}); }
 }
 // arrival fog
 for(const [sd,f] of [[7,13],[14,14],[21,14],[7,14],[21,15],[35,14],[42,15],[7,15],[63,14]]){ for(const n of [2,50]){const S=mk(sd,f); S.run.en=S.run.en.filter(e=>Math.hypot(e.x-S.run.hero.x,e.y-S.run.hero.y)>600); stepn(S,n); shots.push([`arr_${sd}f${f}_n${n}`,S]); info.push({ft:S.run.map.ftype,ft2:S.run.map.ftype2});} }
 // lakes, all seen
 for(const [sd,f] of [[7,14],[14,15],[21,15],[28,15],[70,14],[84,15]]){const S=mk(sd,f),R=S.run,m=R.map,W=m.W;let b=[-1];for(let y=8;y<m.H-8;y+=2)for(let x=15;x<W-15;x+=2){let c=0;for(let j=-8;j<=8;j++)for(let i=-15;i<=15;i++)if(m.cells[(y+j)*W+x+i]===3)c++;if(c>b[0])b=[c,x,y];}
  const x=(b[1]+.5)*T,y=(b[2]+.5)*T; R.en=R.en.filter(e=>Math.hypot(e.x-x,e.y-y)>1200); R.seen=R.seen.map(()=>1); R.rseen=(R.rseen||[]).map(()=>1); R.msg=null; const r=m.rooms.find(q=>q.isle)||m.rooms[0]; R.hero.x=(r.cx+.5)*T;R.hero.y=(r.cy+.5)*T; stepn(S,2); R.cam=[x-VW/2,y-VH/2]; S.ev=[]; shots.push([`lake_${sd}f${f}`,S]); info.push({ft:m.ftype,lava:b}); }
 window.__SHOTS=shots; window.__INFO=info; })();
