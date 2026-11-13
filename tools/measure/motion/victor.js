const Q=SCENE.QA();const base=Q.states.find(q=>q[0]==='win')[1];const S=structuredClone(typeof base==='function'?base():base);
const sp=LIB.sprite;let body=null;LIB.sprite=(n,x,y,o)=>{if(/^hero_\w*_body/.test(n)&&o&&o.m)body=[o.m[4],o.m[5]];return sp(n,x,y,o);};
let prev=null,maxJ=0,jumps=0,maxOff=0;
try{for(let i=0;i<1200;i++){const t=10+i/60;S.t=t;LIB.TRACE={};body=null;SCENE.state=S;SCENE.render(t);const j=LIB.TRACE.victor;if(!j||!body)return{none:1,ids:Object.keys(LIB.TRACE)};
const d=[body[0]-j.hip[0],body[1]-j.hip[1]];maxOff=Math.max(maxOff,Math.hypot(d[0],d[1]));if(prev){const a=Math.hypot(d[0]-prev[0],d[1]-prev[1]);maxJ=Math.max(maxJ,a);if(a>1)jumps++;}prev=d;}}finally{LIB.sprite=sp;}
return{frames:1200,bodyOffLegsMax:+maxOff.toFixed(2),maxStep:+maxJ.toFixed(2),jumpsOver1px:jumps};
