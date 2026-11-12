const Q=SCENE.QA(),png={};
const grid=(name,idx,cols,scale,box,cy)=>{const list=Q.cycles[name]||Q.transitions[name]||Q.loops[name];const id=Q.subject[name]||'en990';const c2=document.createElement('canvas');c2.width=cols*box*scale;c2.height=Math.ceil(idx.length/cols)*box*scale;const g=c2.getContext('2d');g.imageSmoothingEnabled=false;
idx.forEach((i,k)=>{const S=list[i];LIB.TRACE={};SCENE.state=S;SCENE.render(S.t+0.01);const j=LIB.TRACE[id]||{};const c=j.hip||[960,540];g.drawImage(document.getElementById('c'),c[0]-box/2,c[1]-box*cy,box,box,(k%cols)*box*scale,Math.floor(k/cols)*box*scale,box*scale,box*scale);});
png[name+'_strip']=c2.toDataURL('image/png');};
grid('golem_crust_regrow',[128,130,132,134,136,138,140,142],4,3,150,0.72);
grid('imp_leap',[30,40,50,54,56,58,60,64],4,5,80,0.55);
return {png};
