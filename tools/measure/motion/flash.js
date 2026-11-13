const Q=SCENE.QA();const cv=document.getElementById('c');const o=document.createElement('canvas');o.width=o.height=160;const g=o.getContext('2d',{willReadFrequently:true});const R={};
for(const name of ['golem_crust_off','golem_crust_off_clear','hit_golem_crust','golem_crust_regrow']){const list=Q.transitions[name],id=Q.subject[name]||'en990';const rows=[];
for(let i=0;i<list.length;i++){const S=list[i];LIB.TRACE={};SCENE.state=S;SCENE.render(S.t+0.01);const j=LIB.TRACE[id]||{};const c=j.hip||[960,540];g.clearRect(0,0,160,160);g.drawImage(cv,c[0]-80,c[1]-110,160,160,0,0,160,160);const d=g.getImageData(0,0,160,160).data;let n=0;for(let k=0;k<d.length;k+=4){if(d[k]>200&&d[k+1]>175&&d[k+2]>160)n++;}rows.push(n);}
const e=list.map(S=>(S.ev||[]).filter(v=>v.t>S.t-1/60-1e-6).map(v=>v.k).join('+'));R[name]={rows,ev:e.map((x,i)=>x?i+':'+x:'').filter(Boolean)};}
return R;
