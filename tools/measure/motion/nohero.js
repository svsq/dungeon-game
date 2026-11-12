const Q=SCENE.QA(),png={};
const grid=(name,idx,cols,scale,box)=>{const list=Q.cycles[name]||Q.transitions[name]||Q.loops[name];const id=Q.subject[name]||'en990';const c2=document.createElement('canvas');c2.width=cols*box*scale;c2.height=Math.ceil(idx.length/cols)*box*scale;const g=c2.getContext('2d');g.imageSmoothingEnabled=false;
idx.forEach((i,k)=>{const S=structuredClone(list[i]);if(S.run&&S.run.hero){S.run.hero.x+=600;}LIB.TRACE={};SCENE.state=S;SCENE.render(S.t+0.01);const j=LIB.TRACE[id]||{};const c=j.hip||[960,540];g.drawImage(document.getElementById('c'),c[0]-box/2,c[1]-box*0.55,box,box,(k%cols)*box*scale,Math.floor(k/cols)*box*scale,box*scale,box*scale);});
png[name+'_nh']=c2.toDataURL('image/png');};
grid('imp_claw',[0,2,4,6,10,18,20,22,24,28,32,36],4,5,80);
grid('imp_attack',[0,4,8,14,20,26,28,30,32,36,42,48],4,5,80);
grid('imp_idle',[30,60,90,119],4,6,80);
grid('imp_right',[0,3,6,9],4,6,80);
return {png};
