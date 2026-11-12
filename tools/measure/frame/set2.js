(() => { const G=window.DATA; const shots=[],info=[],T=32;
 const mk=(sd,f)=>{const S=SIM.spawn(0,{}); S.meta.shards=9999; SIM.step(S,{keys:[]}); S.run=SIM.newRun(S,'campaign',sd,{town:true}); S.screen='play'; SIM.enterFloor(S,S.run,f); return S;};
 const stepn=(S,n)=>{for(let i=0;i<n;i++) SIM.step(S,{px:960,py:540,keys:[]});};
 for(const [sd,f] of [[14,14],[21,15]]) for(const n of [8,15,25,40,70,180]){const S=mk(sd,f);stepn(S,n);shots.push([`tl_${sd}f${f}_n${String(n).padStart(3,'0')}`,S]);info.push({t:n/60});}
 // arrival lava census
 let cnt=0; for(let sd=7;sd<=112&&cnt<24;sd+=7) for(const f of [14,15]){ const S=mk(sd,f); S.run.en=[]; stepn(S,180); S.run.msg=null; shots.push([`cs_${sd}f${f}`,S]); info.push({ft:S.run.map.ftype,ft2:S.run.map.ftype2}); cnt++; }
 // gate as a passage, area known
 for(const [sd,f,stop] of [[14,13,3],[35,13,3],[14,14,3],[49,14,3]]){const S=mk(sd,f),R=S.run,m=R.map,g=m.hazards.filter(z=>z.gate); R.en=[]; R.seen=R.seen.map(()=>1); R.rseen=(R.rseen||[]).map(()=>1); R.msg=null; stepn(S,2); if(!g.length)continue; const x=g[Math.min(1,g.length-1)].x,y=g[Math.min(1,g.length-1)].y; R.hero.x=x+90;R.hero.y=y+140; const z=g[0],H=G.HAZ.vent;const c=z.per*.4; R.cam=[x-960,y-540]; S.t=R.t=(((c/z.per-z.ph)%1+1)%1+20)*z.per; S.ev=[]; shots.push([`pg_${sd}f${f}`,S]);info.push({g:g.map(z=>[z.x,z.y])}); }
 window.__SHOTS=shots;window.__INFO=info;})();
