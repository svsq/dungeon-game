import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const skill = path.join(os.homedir(), '.claude/skills/ref2game/scripts');
const { chromium } = createRequire(path.join(skill, 'qa.mjs'))(path.join(skill, 'node_modules/playwright'));
const source = fs.readFileSync('live/audio.js','utf8'), events = JSON.parse(fs.readFileSync('frames/cave_reactions/events.json','utf8'));
const browser = await chromium.launch(); const page = await browser.newPage();
try {
  const result = await page.evaluate(async ({source,events}) => {
    const result = {};
    const cases = {stone:events.find((e)=>e.k==='step'&&e.mat==='stone'),wood:events.find((e)=>e.k==='step'&&e.mat==='wood'),water:events.find((e)=>e.k==='step'&&e.mat==='water'),sign:events.find((e)=>e.n==='shop_sign'),fungus:events.find((e)=>e.mat==='fungus'),bone:events.find((e)=>e.mat==='bone')};
    for(const [name,event] of Object.entries(cases)) {
      if(!event)throw new Error('missing actual event '+name);
      const sr=24000,ctx=new OfflineAudioContext(2,sr,sr),listeners={},W={AudioContext:function(){return ctx;}},M=Object.create(Math);let seed=645;
      M.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
      new Function('window','localStorage','addEventListener','Math',source)(W,{getItem:()=>null,setItem(){}},(n,cb)=>{listeners[n]=cb;},M);
      listeners.pointerdown();W.AUDIO.update({t:1,screen:'menu',run:null,ev:[{...event,t:1}]});
      if(W.AUDIO.played!==1)throw new Error(name+': actual sound not dispatched');
      const buffer=await ctx.startRendering(),a=buffer.getChannelData(0),b=buffer.getChannelData(1),samples=Array.from(a,(v,i)=>(v+b[i])/2);
      const peak=Math.max(...samples.map(Math.abs)),rms=Math.sqrt(samples.reduce((a,v)=>a+v*v,0)/samples.length);
      if(rms<1e-5||peak>=.99)throw new Error(name+': silent or clipping');
      result[name]={sr,samples,peak,rms};
    }
    for(const name of ['wood','water']) {
      const a=result.stone.samples,b=result[name].samples;
      const diff=Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);
      if(diff<result.stone.rms*.2)throw new Error(name+': same sound as stone');result[name].differenceFromStone=diff;
    }
    return result;
  },{source,events});
  const report={};for(const [name,c] of Object.entries(result)) {
    const wav=Buffer.alloc(44+c.samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(c.sr,24);wav.writeUInt32LE(c.sr*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(c.samples.length*2,40);
    c.samples.forEach((v,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));fs.writeFileSync('frames/cave_reactions/'+name+'.wav',wav);report[name]={...c,samples:undefined};
  }
  fs.writeFileSync('frames/cave_reactions/audio.json',JSON.stringify(report,null,2));console.log('cavereactionaudio: ok (six actual events, non-silent unclipped PCM, wood/water differ from stone)');
} finally {await browser.close();}
