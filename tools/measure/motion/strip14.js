const Q=SCENE.QA(),png={};
const grid=(name,idx,cols,scale,box,cy,tag)=>{const list=Q.cycles[name]||Q.transitions[name]||Q.loops[name];const id=Q.subject[name]||'en990';const c2=document.createElement('canvas');c2.width=cols*box*scale;c2.height=Math.ceil(idx.length/cols)*box*scale;const g=c2.getContext('2d');g.imageSmoothingEnabled=false;
let c0=null;idx.forEach((i,k)=>{const S=list[i];LIB.TRACE={};SCENE.state=S;SCENE.render(S.t+0.01);const j=LIB.TRACE[id]||{};const c=c0||(c0=j.hip||[960,540]);g.drawImage(document.getElementById('c'),c[0]-box/2,c[1]-box*cy,box,box,(k%cols)*box*scale,Math.floor(k/cols)*box*scale,box*scale,box*scale);g.fillStyle='#fff';g.font='14px monospace';g.fillText(String(i),(k%cols)*box*scale+4,Math.floor(k/cols)*box*scale+14);});
png[(tag||name)]=c2.toDataURL('image/png');};
grid('colossus_stomp',[28,30,31,32,33,34,35,36,37,38,40,44],6,1,300,0.6,'stomp_crouch');
grid('colossus_crack',[178,180,181,182,183,184,185,186,187,188,190,194],6,1,300,0.6,'crack_end');
grid('colossus_stomp',[0,6,12,18,24,28,37,46,56,64,90,118],6,1,300,0.6,'stomp_all');
return {png};
