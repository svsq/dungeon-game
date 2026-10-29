const assert=require('node:assert/strict'),fs=require('node:fs');
const SIM=require('../live/sim.js'),D=require('../live/data.js');
const out='frames/cave_actor_series';fs.mkdirSync(out,{recursive:true});const captures=[],report={};
for(const type of ['skel_archer','skel_mage','drowned','slime']) {
  const S=SIM.spawn(0,{});S.run=SIM.newRun(S,'cave',3);SIM.enterFloor(S,S.run,3);S.screen='play';S.t=10;
  const R=S.run,m=R.map,h=R.hero,clear=(x,y)=>[-14,0,14].every(dx=>[-14,0,14].every(dy=>SIM.cell(m,Math.floor((x+dx)/D.TILE),Math.floor((y+dy)/D.TILE))===1&&!m.block.includes(Math.floor((y+dy)/D.TILE)*m.W+Math.floor((x+dx)/D.TILE))));
  const line=(x,y,X,Y)=>Array.from({length:16},(_,i)=>i/15).every(q=>SIM.cell(m,Math.floor((x+(X-x)*q)/D.TILE),Math.floor((y+(Y-y)*q-20)/D.TILE))===1);
  let chosen;
  for(const e of R.en.filter(e=>e.type===type))for(let i=0;i<16&&!chosen;i++) {
    const a=i*Math.PI/8,ux=Math.cos(a),uy=Math.sin(a),x=e.x+ux*100,y=e.y+uy*100;
    if(clear(x,y)&&clear(e.x+ux*70,e.y+uy*70)&&(type!=='skel_mage'||clear(e.x-ux*70,e.y-uy*70))&&line(e.x,e.y,x,y))chosen={e,ux,uy,x,y};
  }
  assert.ok(chosen,'no open cave actor fixture '+type);const {e,ux,uy}=chosen;
  R.en=[e];R.chests=[];R.pots=[];R.msg=null;R.seen.fill(1);R.rseen.fill(1);R.freeze=0;S.ev=[];h.ifr=1e9;
  h.x=e.x+ux*(type==='drowned'?70:100);h.y=e.y+uy*(type==='drowned'?70:100);
  const origin={x:e.x,y:e.y},hp=1000;Object.assign(e,{hp,max:hp,dmg:1,st:type==='drowned'?'lurk':'idle',t0:type==='drowned'?S.t-2:S.t,elite:0,mods:[],calmT:1e9,cdT:S.t+1.2,hitT:-9,deadT:-1,vx:0,vy:0});
  const frames=[],seen=new Set(),events=new Set();let walked=0,hit=false,died=false,wetGrab=false;
  const blast=(dmg)=>R.proj.push({id:R.nextId++,own:'hero',k:'fire',x:e.x,y:e.y-20,vx:0,vy:0,gz:20,life:0,t0:S.t,dmg,r:8});
  for(let i=0;i<360;i++) {
    if(i===30&&type!=='drowned'){e.st='chase';e.t0=S.t;e.calmT=0;e.cdT=S.t+1.2;}
    if(i===25&&type==='drowned'){h.x=origin.x+ux*110;h.y=origin.y+uy*110;}
    if(i===180)blast(1);
    if(i===240){if(type==='slime')e.hp=1;else blast(2000);}
    R.cam=[(h.x+e.x)/2-960,(h.y+e.y)/2-540];
    frames.push(structuredClone(S));seen.add(e.st);if(Math.hypot(e.vx,e.vy)>4)walked++;
    if(e.hitT>=10)hit=true;if(e.deadT>=10)died=true;
    for(const v of S.ev){events.add(v.k);if(v.k==='grabbed'&&m.water.includes(Math.floor(e.y/D.TILE)*m.W+Math.floor(e.x/D.TILE)))wetGrab=true;}
    for(let j=0;j<2;j++)SIM.step(S,{keys:[],px:960,py:540});
  }
  assert.ok(hit&&died,type+': missing actual hit/death');
  if(type==='skel_mage'){assert.ok(walked>10,'mage does not walk');assert.ok(events.has('orb'),'mage never casts');}
  if(type==='skel_archer'){assert.ok(walked>10,'archer does not walk');assert.ok(events.has('loose'),'archer never shoots');}
  if(type==='drowned'){assert.ok(seen.has('rise')&&events.has('grabbed')&&wetGrab,'missing real shallow-water grab');}
  if(type==='slime'){assert.ok(events.has('split'),'missing actual split');const small=R.en.filter(e=>e.type==='slime_s');assert.equal(small.length,2);assert.ok(small.every(q=>q.summ===e.id&&!q.elite&&q.deadT<0));}
  fs.writeFileSync(out+'/'+type+'.json',JSON.stringify(frames));
  for(const i of [0,25,50,75,100,130,160,180,195,220,240,260,290,320,359])captures.push(['cave_actor_'+type+'_'+i,frames[i]]);
  report[type]={seed:3,floor:3,frames:frames.length,walked,states:[...seen],events:[...events],wetGrab,hit,died};
}
fs.writeFileSync(out+'/states.json',JSON.stringify(captures));fs.writeFileSync(out+'/simulation.json',JSON.stringify(report,null,2));
console.log('caveactorcheck: ok (four complete six-second cave series, actual casts/grab/hits/deaths/split)');
