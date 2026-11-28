// 1.7.45: fits only monster HP (diff[0]) per chapter so the expert bot gets ★3 in TARGET3[ch] of runs, with attack (diff[1]) and
// boss HP (diff[2]) held fixed. Prints the new diff list.  node tools/tune-hp.js [runs=20] [chapters] [steps=5]
const {execFile}=require('child_process'),path=require('path'),D=require('../js/data.js');
const TARGET3=[.65,.45,.40,.36,.32,.28,.24,.20,.15,.10],EXPERT={ult:'expert'};
const runs=+(process.argv[2]||20),chapters=process.argv[3]?process.argv[3].split(',').map(Number):D.CHAPTERS.map((_,i)=>i),steps=+(process.argv[4]||5);
const play=(ch,diff,seed)=>new Promise(r=>execFile('node',[path.join(__dirname,'bot.js'),String(ch),String(runs)],{env:{...process.env,STRAT:JSON.stringify(EXPERT),DIFF:JSON.stringify(diff),SEED0:String(seed)},maxBuffer:1e7},(e,out)=>{
 const line=(out||'').split('\n').find(l=>/클리어 ·/.test(l))||'';r([...line.matchAll(/승\(생명 (\d+)·★(\d)\)|패\(전투 (\d+)\)/g)].map(m=>m[1]!=null?{won:1,st:+m[2]}:{won:0,st:0}));}));
// three passes: boss HP (diff[2]) so the expert wins WIN of runs (a boss that reaches the crystal ends the chapter), monster HP (diff[0])
// for the ★3 target, boss HP again. Boss HP also scales with monster HP (hpT), so the passes are alternated.
const WIN=+(process.env.WIN||.92);
async function bis(ch,lo,hi,measure,target,mk,tag){let seed=100+Math.floor(Math.random()*1e4);for(let it=0;it<steps;it++){const x=Math.sqrt(lo*hi),r=await play(ch,mk(x),seed+=runs),p=measure(r);
  console.log(`${D.CHAPTERS[ch].label} ${tag}×${x.toFixed(3)} ★3 ${(r.filter(v=>v.st===3).length/r.length*100).toFixed(0)}% 승 ${(r.filter(v=>v.won).length/r.length*100).toFixed(0)}%`);if(p>target)lo=x;else hi=x;}return Math.sqrt(lo*hi);}
async function fit(ch){const st3=r=>r.filter(v=>v.st===3).length/r.length,win=r=>r.filter(v=>v.won).length/r.length;let h=1,b=1;
 if(process.env.MODE==='boss'){b=await bis(ch,.25,1.3,win,WIN,x=>[1,1,x],'boss');const C=D.CHAPTERS[ch];return [ch,C.diff[0],C.diff[1],+(C.diff[2]*b).toFixed(2)];}   // MODE=boss: only boss HP, for the expert win rate WIN
 if(process.env.MODE==='hp'){h=await bis(ch,+(process.env.LO||.55),+(process.env.HI||1.6),st3,TARGET3[ch],x=>[x,1,1/x],'hp');const C=D.CHAPTERS[ch];return [ch,+(C.diff[0]*h).toFixed(2),C.diff[1],+(C.diff[2]/h).toFixed(2)];}   // MODE=hp: boss HP held absolute
 b=await bis(ch,.3,1.5,win,WIN,x=>[h,1,x],'boss');
 h=await bis(ch,.6,1.6,st3,TARGET3[ch],x=>[x,1,b/x],'hp');   // boss HP held while monster HP moves
 b=await bis(ch,b/1.6,b*1.25,win,WIN,x=>[h,1,x/h],"boss");b=b/h;
 const C=D.CHAPTERS[ch];return [ch,+(C.diff[0]*h).toFixed(2),C.diff[1],+(C.diff[2]*b).toFixed(2)];}
(async()=>{const q=chapters.slice(),res=[];const worker=async()=>{while(q.length)res.push(await fit(q.shift()));};
 await Promise.all([worker(),worker(),worker(),worker()]);res.sort((a,b)=>a[0]-b[0]);console.log('diff: '+JSON.stringify(res.map(r=>r.slice(1))));})();
