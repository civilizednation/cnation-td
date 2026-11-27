// Fits each chapter to the owner's targets (1.7.32): monster HP so the expert bot gets ★3 in TARGET3[ch] of runs, then monster attack so
// the novice bot wins in TARGETW[ch] of runs. Prints multipliers for diff[0] and diff[1].  node tools/tune.js [runs=16] [chapters]
const {execFile}=require('child_process'),path=require('path'),D=require('../js/data.js');
const TARGET3=[.80,.60,.55,.50,.45,.40,.35,.30,.25,.20],TARGETW=[.95,.85,.70,.60,.50,.45,.40,.35,.30,.25];
const EXPERT={ult:'expert'},NOVICE={ranged:'random',meleeFrac:.15,ult:'asap',element:'first',shard:'none',vantage:false,potion:'none'};
const runs=+(process.argv[2]||16),chapters=process.argv[3]?process.argv[3].split(',').map(Number):D.CHAPTERS.map((_,i)=>i);
const play=(ch,strat,diff,seed)=>new Promise(r=>execFile('node',[path.join(__dirname,'bot.js'),String(ch),String(runs)],{env:{...process.env,STRAT:JSON.stringify(strat),DIFF:JSON.stringify(diff),SEED0:String(seed)},maxBuffer:1e7},(e,out)=>{
 const line=(out||'').split('\n').find(l=>/클리어 ·/.test(l))||'';r([...line.matchAll(/승\(생명 (\d+)·★(\d)\)|패\(전투 (\d+)\)/g)].map(m=>m[1]!=null?{won:1,st:+m[2]}:{won:0,st:0}));}));
// three passes around the current diff: monster HP for the expert ★3 target, attack for the novice win target, HP again (★3 comes first)
async function bis(ch,strat,lo,hi,k,steps,measure,target,fixed){let seed=100+k*1000,x=1;
 for(let it=0;it<steps;it++){x=Math.sqrt(lo*hi);const d=fixed(x),r=await play(ch,strat,d,seed+=runs),p=measure(r);if(p>target)lo=x;else hi=x;}return Math.sqrt(lo*hi);}
async function fit(ch){const st3=r=>r.filter(v=>v.st===3).length/r.length,win=r=>r.filter(v=>v.won).length/r.length;let hp=1,atk=1;
 hp=await bis(ch,EXPERT,.7,1.45,1,4,st3,TARGET3[ch],x=>[x,atk,1]);
 atk=await bis(ch,NOVICE,.6,1.7,2,4,win,TARGETW[ch],x=>[hp,x,1]);
 hp=await bis(ch,EXPERT,hp/1.2,hp*1.2,3,4,st3,TARGET3[ch],x=>[x,atk,1]);
 const C=D.CHAPTERS[ch],d=[+(C.diff[0]*hp).toFixed(2),+(C.diff[1]*atk).toFixed(2),C.diff[2]];console.log(`${C.label}: hp×${hp.toFixed(3)} atk×${atk.toFixed(3)} → diff ${JSON.stringify(d)}`);return [ch,...d];}
(async()=>{const q=chapters.slice(),res=[];const worker=async()=>{while(q.length){const ch=q.shift();res.push(await fit(ch));}};
 await Promise.all([worker(),worker(),worker(),worker()]);res.sort((a,b)=>a[0]-b[0]);console.log('diff: '+JSON.stringify(res.map(r=>r.slice(1))));})();
