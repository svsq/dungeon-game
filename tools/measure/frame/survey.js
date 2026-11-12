(() => { const shots=[],info=[]; const T=32;
 for (let sd=1; sd<=14 && info.length<40; sd++){ const S=SIM.spawn(0,{}); S.meta.shards=9999; SIM.step(S,{keys:[]}); S.run=SIM.newRun(S,'campaign',sd*7,{town:true}); S.screen='play'; const R=S.run;
  for (let f=13;f<=15;f++){ SIM.enterFloor(S,R,f); const m=R.map, g=m.hazards.filter(z=>z.gate); info.push({sd:sd*7,f,biome:m.biome,ft:m.ftype,ft2:m.ftype2,gate:g.length,G:g.map(z=>[z.x,z.y]),haz:m.hazards.length,W:m.W,H:m.H}); } }
 console.log(JSON.stringify(info.map(i=>[i.sd,i.f,i.biome,i.ft,i.ft2,i.gate,i.G.flat().join('/')])));
 window.__SHOTS=[]; window.__INFO=[]; })();
