const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../live/data.js'),DG=require('../live/dungeon.js'),source=fs.readFileSync('live/dungeon.js','utf8');
const a=source.indexOf('    if (cave) {\n      const mushrooms ='),b=source.indexOf('    if (cave) for (const d of decor)',a);assert.ok(a>=0&&b>a);
const context={DATA:D,module:{exports:{}},require};vm.runInNewContext(source.slice(0,a)+source.slice(b),context);const baseline=context.module.exports;
const report=[];let before=0,after=0;const sizes=new Set();
for(const seed of [1,3,7,26837])for(let f=1;f<=4;f++) {
 const sd=(seed*31+f*1013)>>>0,A=baseline.genFloor(sd,f,{mode:'cave'}),B=DG.genFloor(sd,f,{mode:'cave'});
 for(const k of ['cells','enemies','chests','shrines','pots'])assert.equal(JSON.stringify(A[k]),JSON.stringify(B[k]),k+' changed while pruning');
 const old=A.decor.filter(d=>/^shroom_[ab]$/.test(d.n)),now=B.decor.filter(d=>/^shroom_[ab]$/.test(d.n));assert.ok(now.length<=old.length);now.forEach(d=>sizes.add(d.s||1));
 before+=old.length;after+=now.length;report.push({seed,f,before:old.length,after:now.length,torchesBefore:A.torches.length,torches:B.torches.length,moss:B.decals.filter(d=>d.n==='dc_moss').length});
}
assert.deepEqual([...sizes].sort(),[.6,.8,1]);console.log({before,after,reduction:1-after/before});assert.ok(after<before*.85,'less than 15% pruning');
fs.mkdirSync('frames/cave_density',{recursive:true});fs.writeFileSync('frames/cave_density/report.json',JSON.stringify({before,after,reduction:1-after/before,sizes:[...sizes],floors:report},null,2));
console.log('cavedensitycheck: ok '+before+' → '+after+' mushrooms, sizes .6/.8/1, actor/geometry RNG unchanged');
