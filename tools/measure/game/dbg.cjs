const L=require('./lib.cjs'),{SIM,T}=L,{mkT}=require('./survey.cjs');
const [sd,f]=process.argv.slice(2).map(Number);const S=mkT(sd,f),R=S.run,m=R.map,h=R.hero,W=m.W;for(let i=0;i<12;i++)SIM.step(S,{keys:[]});
const cr=new Set(m.crust||[]),cu=new Set(m.chasmUnder||[]),hx=Math.floor(h.x/T),hy=Math.floor(h.y/T);
console.log(m.ftype,m.ftype2,'hero',hx,hy,'up',m.up&&[m.up.tx,m.up.ty]);
for(let y=hy-12;y<=hy+12;y++){let s='';for(let x=hx-24;x<=hx+24;x++){const k=y*W+x,c=m.cells[k];s+=(x===hx&&y===hy)?'@':cr.has(k)?'c':cu.has(k)?'=':c===3?(R.seen[k]?'L':'l'):c===1?(R.seen[k]?'.':','):c===0?(m.cliff&&y>=m.cliff[x]?' ':'#'):String(c);}console.log(s);}
