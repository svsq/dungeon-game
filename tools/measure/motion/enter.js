const Q=SCENE.QA();const base=Q.states.find(q=>q[0]==='magma_gate_rest')[1];const S0=typeof base==='function'?base():base;const png={};const info=[];
const cv=document.getElementById('c');
for(const [sd,f] of [[3,13],[5,14]]){const S=structuredClone(S0);S.run=SIM.newRun(S,'campaign',sd*7,{town:true});S.screen='play';SIM.enterFloor(S,S.run,f-1);SIM.enterFloor(S,S.run,f);
 const R=S.run;const c2=document.createElement('canvas');const W=480,H=270;c2.width=W*4;c2.height=H*3;const g=c2.getContext('2d');
 const near=R.en.filter(e=>Math.hypot(e.x-R.hero.x,e.y-R.hero.y)<9*48).length;
 let k=0;const marks=[0,6,12,18,24,30,36,48,54,60,90,150];let fr=0;
 for(let i=0;i<=150;i++){if(marks.includes(i)){SCENE.state=S;SCENE.render(S.t);g.drawImage(cv,0,0,cv.width,cv.height,(k%4)*W,Math.floor(k/4)*H,W,H);k++;}
  SIM.step(S,{px:960,py:540,keys:[]});SIM.step(S,{px:960,py:540,keys:[]});}
 png['enter_'+sd+'_'+f]=c2.toDataURL();info.push({sd:sd*7,f,biome:R.map.biome,near,en:R.en.length});}
return{info,png};
