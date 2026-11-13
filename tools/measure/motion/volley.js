const NAMES=['hero_archer_volley_r'];const Q=SCENE.QA(),out={};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],len=(v)=>Math.hypot(v[0],v[1]),deg=(v)=>Math.atan2(v[1],v[0])*180/Math.PI;
for(const nm of NAMES){const fr=[],rows=[];
for(const st of Q.transitions[nm]){LIB.TRACE={};SCENE.state=st;SCENE.render(st.t+0.01);const j=Object.assign({},LIB.TRACE.hero||{}),h=st.run.hero;fr.push(j);
rows.push({castT:h.castK==='volley'?+(st.t-h.castT).toFixed(3):null,bowDeg:j.grip&&j.tip?+deg(sub(j.tip,j.grip)).toFixed(0):null,loosed:(st.ev||[]).some((e)=>e.k==='volley')?1:0});}
LIB.TRACE=null;const H=len(sub(fr[0].top,fr[0].ground));let jump=0,at='';
for(let i=2;i<fr.length;i++)for(const k of Object.keys(fr[i])){if(k.startsWith('target')||k==='tip'||!fr[i-1][k]||!fr[i-2][k])continue;const r=(f)=>sub(f[k],f.ground),d=len(sub(sub(r(fr[i]),r(fr[i-1])),sub(r(fr[i-1]),r(fr[i-2]))));if(d>jump){jump=d;at=k+' @'+i;}}
const first=rows.findIndex((r)=>r.loosed),up=rows.findIndex((r)=>r.castT!==null&&r.bowDeg!==null&&Math.abs(r.bowDeg)<5);
out[nm]={H:+H.toFixed(1),pop:+jump.toFixed(1),popOfH:+(jump/H).toFixed(3),popAt:at,looseFrame:first,looseCastT:first>=0?rows[first].castT:null,bowUpFrame:up,bowUpCastT:up>=0?rows[up].castT:null,bowDegAtLoose:first>=0?rows[first].bowDeg:null,rows:rows.slice(3,20)};}
return out;
