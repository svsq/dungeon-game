// evalq.mjs body (town_motion_r10): frame strips of the smith turning back from the hero (folk_talk_back_out 27-35) and the cart at the view change (folk_cart_turn 9-17), fixed camera from the first frame
// node tools/measure/motion/evalq.mjs tools/measure/motion/strip_r10.js frames/critic_r10_motion/strip_r10.json
const Q=SCENE.QA(),png={};
const grid=(name,idx,cols,scale,box,cy,tag)=>{const list=Q.cycles[name]||Q.transitions[name]||Q.loops[name];const id=Q.subject[name]||'en990';const c2=document.createElement('canvas');c2.width=cols*box*scale;c2.height=Math.ceil(idx.length/cols)*box*scale;const g=c2.getContext('2d');g.imageSmoothingEnabled=false;
let c0=null;idx.forEach((i,k)=>{const S=list[i];LIB.TRACE={};SCENE.state=S;SCENE.render(S.t+0.01);const j=LIB.TRACE[id]||{};const c=c0||(c0=j.hip||[960,540]);g.drawImage(document.getElementById('c'),c[0]-box/2,c[1]-box*cy,box,box,(k%cols)*box*scale,Math.floor(k/cols)*box*scale,box*scale,box*scale);g.fillStyle='#fff';g.font='14px monospace';g.fillText(String(i),(k%cols)*box*scale+4,Math.floor(k/cols)*box*scale+14);});
png[(tag||name)]=c2.toDataURL('image/png');};
grid('folk_talk_back_out',[27,28,29,30,31,32,33,34,35],9,4,80,0.6,'talkout');
grid('folk_talk_back',[28,29,30,31,32,33,34,35,36],9,4,80,0.6,'talkback');
grid('folk_cart_turn',[9,10,11,12,13,14,15,16,17],9,4,80,0.6,'cartturn');
return {png};
