const Q=SCENE.QA(),png={},base=Q.states.find((q)=>q[0]==='coffin_rise_a')[1],S0=structuredClone(typeof base==='function'?base():base),e0=S0.run.en.find((e)=>e.id===991),t0=e0.coffinT;
const at=(age)=>{const S=structuredClone(S0);S.t=t0+age;const e=S.run.en[0];if(age>=1){e.st='chase';e.t0=t0+1;}LIB.TRACE={};SCENE.state=S;SCENE.render(S.t);return Object.assign({},LIB.TRACE.en991||{});};
const rows=[];let prev=null,pv=null,maxAcc=0,accAt=0;
for(let i=0;i<=84;i++){const age=i/60,j=at(age);if(!j.ground||!j.ankleL)continue;const foot=Math.max(j.ankleL?j.ankleL[1]:-1e9,j.ankleR?j.ankleR[1]:-1e9),g=j.ground[1],hip=j.hip?j.hip[1]:null;
if(prev!==null){const v=hip-prev;if(pv!==null){const a=Math.abs(v-pv);if(a>maxAcc){maxAcc=a;accAt=+age.toFixed(3);}}pv=v;}prev=hip;rows.push([+age.toFixed(3),+g.toFixed(1),+foot.toFixed(1),hip&&+hip.toFixed(1)]);}
const c2=document.createElement('canvas'),box=200,sc=2,ages=[0.1,0.2,0.3,0.4,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1.0,1.1];c2.width=8*box*sc;c2.height=2*box*sc;const g=c2.getContext('2d');g.imageSmoothingEnabled=false;
const c=at(1.3).ground;ages.forEach((a,k)=>{at(a);g.drawImage(document.getElementById('c'),c[0]-box/2,c[1]-box*0.8,box,box,(k%8)*box*sc,Math.floor(k/8)*box*sc,box*sc,box*sc);g.fillStyle='#fff';g.font='20px monospace';g.fillText(a.toFixed(2),(k%8)*box*sc+4,Math.floor(k/8)*box*sc+20);});
png.coffin=c2.toDataURL('image/png');
let maxStep=0,stepAt=0;for(let i=1;i<rows.length;i++){const d=Math.abs(rows[i][1]-rows[i-1][1]);if(d>maxStep){maxStep=d;stepAt=rows[i][0];}}
return {png,groundStepMax:+maxStep.toFixed(1),groundStepAt:stepAt,hipAccMax:+maxAcc.toFixed(1),hipAccAt:accAt,rows:rows.filter((r,i)=>i%3===0)};
