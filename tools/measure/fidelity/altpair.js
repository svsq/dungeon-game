(()=>{const out=[]; for(let sd=1;sd<=30;sd++){ const S2=SIM.spawn(0,{}); SIM.step(S2,{keys:[]}); S2.run=SIM.newRun(S2,'magma',sd);
 for(let f=1;f<=4;f++){ SIM.enterFloor(S2,S2.run,f); const m=S2.run.map; if(m.ftype!=='chasm') continue; const W=m.W; const a=m.crossings.find(c=>c.alt); if(!a){out.push([sd,f,'no alt']);continue;}
  const box=c=>{const xs=c.cells.map(k=>k%W), ys=c.cells.map(k=>Math.floor(k/W)); return [Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)]};
  const A=box(a); let best=null; for(const c of m.crossings.filter(c=>c.chasm&&!c.alt&&c.axis===a.axis)){const B=box(c); const par=a.axis==='y'?[Math.abs(A[0]-B[0]),Math.min(A[3],B[3])-Math.max(A[2],B[2])+1,A[3]-A[2]+1]:[Math.abs(A[2]-B[2]),Math.min(A[1],B[1])-Math.max(A[0],B[0])+1,A[1]-A[0]+1]; if(!best||par[0]<best[0]) best=par;}
  out.push([sd,f,a.cells.length/2,best]); } } return out;})()
