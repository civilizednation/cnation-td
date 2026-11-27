// Reward survey (1.7.32): expert bot on chapters 4 and 7, N runs each, with (a) every 에테르 축복 forced at each blessing pick,
// (b) one extra copy of every 아르카의 유산. Prints ★3 rate, life and win rate against the baseline.  node tools/rewards.js [runs=20]
const {execFile}=require('child_process'),path=require('path'),D=require('../js/data.js');
const runs=+(process.argv[2]||20),CH=[4,7],base={ult:'expert'};
const V=[['기준',{}],...D.BLESSINGS.map(b=>['축복 '+b.name,{bless:b.id}]),...D.LEGACIES.filter(l=>!l.hero).map(l=>['유산 '+l.name,{extraLegacy:l.id}]),['유산 리아의 각성',{extraLegacy:'hero_ria'}],['유산 카일의 각성',{extraLegacy:'hero_kyle'}]];
const jobs=[];for(const [n,st] of V)for(const ch of CH)jobs.push({n,st,ch});const res={};let next=0,active=0;
function go(){while(active<4&&next<jobs.length){const j=jobs[next++];active++;
 execFile('node',[path.join(__dirname,'bot.js'),String(j.ch),String(runs)],{env:{...process.env,STRAT:JSON.stringify({...base,...j.st})},maxBuffer:1e7},(e,out)=>{active--;
  const line=(out||'').split('\n').find(l=>/클리어 ·/.test(l))||'';(res[j.n]=res[j.n]||[]).push(...[...line.matchAll(/승\(생명 (\d+)·★(\d)\)|패\(전투 (\d+)\)/g)].map(m=>m[1]!=null?{won:1,life:+m[1],st:+m[2]}:{won:0,life:0,st:0}));
  if(next>=jobs.length&&!active)report();else go();});}}
function report(){const f=a=>({s3:a.filter(v=>v.st===3).length/a.length*100,life:a.reduce((p,v)=>p+v.life,0)/a.length,win:a.filter(v=>v.won).length/a.length*100});const b=f(res['기준']);
 console.log('보상'.padEnd(18),'★3률','(기준대비)','생명(패=0)','(기준대비)','승률');
 for(const [n] of V){const r=f(res[n]);console.log(n.padEnd(18),r.s3.toFixed(0).padStart(4)+'%',((r.s3-b.s3>=0?'+':'')+(r.s3-b.s3).toFixed(0)).padStart(5),r.life.toFixed(1).padStart(6),((r.life-b.life>=0?'+':'')+(r.life-b.life).toFixed(1)).padStart(6),r.win.toFixed(0).padStart(4)+'%');}}
go();
