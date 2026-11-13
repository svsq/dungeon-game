(() => { const G=window.DATA,T=32,out=[];
 const mk=(sd,f)=>{const S=SIM.spawn(0,{}); S.meta.shards=9999; SIM.step(S,{keys:[]}); S.run=SIM.newRun(S,'campaign',sd,{town:true}); S.screen='play'; SIM.enterFloor(S,S.run,f); return S;};
 let floors=0,gates=0;
 for(let sd=7;sd<=280;sd+=7){for(const f of [13,14,15]){const S=mk(sd,f),m=S.run.map,g=m.hazards.filter(z=>z.gate);floors++;if(!g.length)continue;gates++;
  let on=0,tot=0;for(const z of g)for(let a=0;a<48;a++){const r=G.HAZ.vent.r*(z.s||1),x=z.x+Math.cos(a/48*6.283)*r,y=z.y+Math.sin(a/48*6.283)*r*G.HAZ.vent.ry;const c=Math.floor(y/T)*m.W+Math.floor(x/T);tot++;if(m.cells[c]===1||m.cells[c]===6)on++;}
  const hor=g.length<2||g[0].y===g[1].y;out.push([sd,f,m.ftype,hor?'h':'v',Math.round(100*(1-on/tot))]);}}
 console.log(JSON.stringify({floors,gates,out,ven:G.HAZ.vent.r})); window.__SHOTS=[];window.__INFO=[];})();
