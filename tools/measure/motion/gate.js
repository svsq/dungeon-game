const Q=SCENE.QA();const base=Q.states.find(q=>q[0]==='magma_vent_warn')[1];const out=[];let found=null;
for(let sd=1;sd<=30&&!found;sd++){const S=structuredClone(base);S.run=SIM.newRun(S,'campaign',sd*7,{town:true});S.screen='play';for(let f=2;f<=16&&!found;f++){SIM.enterFloor(S,S.run,f);const m=S.run.map;const g=(m.hazards||[]).filter(z=>z.gate);if(g.length)found={S,g,f,sd};if(g.length)out.push({sd:sd*7,f,biome:m.biome,gates:g.map(z=>({x:z.x,y:z.y,k:z.k,per:z.per,ph:z.ph,gate:z.gate}))});}}
if(!found)return{out,none:1};
const {S,g}=found,R=S.run,D=DATA,H=D.HAZ.vent;const cx=g.reduce((a,z)=>a+z.x,0)/g.length,cy=g.reduce((a,z)=>a+z.y,0)/g.length;
const png={};const box=720,sc=1;const ph=[['rest',0.45],['w0',null],['w50',null],['w90',null],['burst',0.12],['post',0.6]];
const per=g[0].per;const c2=document.createElement('canvas');c2.width=box*3;c2.height=(box*0.72|0)*2;const gc=c2.getContext('2d');
ph.forEach(([n,v],k)=>{let c=v!==null?(n==='rest'?per*0.45:v):(per-H.warn+H.warn*(n==='w0'?0.02:n==='w50'?0.5:0.9));const z=g[0];const t=(((c/per-z.ph)%1+1)%1+20)*per;S.t=R.t=t;S.ev=[];R.en=[];R.seen=R.seen.map(()=>1);R.msg=null;R.hero.x=cx;R.hero.y=cy+260;R.cam=[cx-SCX.VW/2,cy-SCX.VH/2];if(n==='burst')for(const z of g)S.ev.push({k:'erupt',t:t-0.12,x:z.x,y:z.y,i:R.map.hazards.indexOf(z)});SCENE.state=S;SCENE.render(t+0.01);gc.drawImage(document.getElementById('c'),960-box/2,540-box*0.36,box,box*0.72,(k%3)*box,Math.floor(k/3)*(box*0.72|0),box,box*0.72);});
png.gate=c2.toDataURL('image/png');
out.push({clocks:g.map(z=>D.hazClock(z,R.t)),warn:H.warn,burst:H.burst,cam:R.cam,pos:g.map(z=>[z.x,z.y])});
out.push({states:Object.keys(Q).join(), hazarr:g.length});
return{out,png};
