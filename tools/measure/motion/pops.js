const NAMES=['mimic_wake_bite'];const Q=SCENE.QA(),out={};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],len=(v)=>Math.hypot(v[0],v[1]);
for(const nm of NAMES){const id=(Q.subject||{})[nm],fr=[],meta=[];if(!Q.transitions[nm]){out[nm]={missing:1};continue;}
for(const st of Q.transitions[nm]){LIB.TRACE={};SCENE.state=st;SCENE.render(st.t+0.01);fr.push(LIB.TRACE[id]?Object.assign({},LIB.TRACE[id]):null);const e=(st.run.en||[]).find((q)=>'en'+q.id===id);meta.push(e?[e.st,+(st.t-e.t0).toFixed(3)]:null);}
LIB.TRACE=null;const H=Math.max(...Object.values(fr[0]||{}).map((p)=>p[1]))-Math.min(...Object.values(fr[0]||{}).map((p)=>p[1]))||100;
let jump=0,at=-1,jk='';const per=[];
for(let i=2;i<fr.length;i++){let m=0,mk='';if(fr[i]&&fr[i-1]&&fr[i-2])for(const k of Object.keys(fr[i])){if(k.startsWith('target')||k==='tip'||!fr[i-1][k]||!fr[i-2][k])continue;
const r=(f)=>sub(f[k],f.ground),d=len(sub(sub(r(fr[i]),r(fr[i-1])),sub(r(fr[i-1]),r(fr[i-2]))));if(d>m){m=d;mk=k;}}
per.push([i,+m.toFixed(1),mk]);if(m>jump){jump=m;at=i;jk=mk;}}
const w=[];for(let i=Math.max(0,at-4);i<Math.min(fr.length,at+3);i++)w.push([i,meta[i],fr[i]&&fr[i][jk]&&fr[i][jk].map((v)=>+v.toFixed(1))]);
out[nm]={frames:fr.length,H:+H.toFixed(1),pop:+jump.toFixed(1),popOfH:+(jump/H).toFixed(3),at,joint:jk,around:w,over6pct:per.filter((p)=>p[1]>0.06*H)};}
return out;
