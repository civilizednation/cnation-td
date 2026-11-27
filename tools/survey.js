// Difficulty survey: runs the expert bot and the novice bot N times on every chapter (4 processes in parallel) and prints wins,
// life (mean, min–max) and stars (mean, ★3/★2/★1/fail).  node tools/survey.js [runs=30] [chapters=all]
const {execFile}=require('child_process'),path=require('path'),D=require('../js/data.js');
const runs=+(process.argv[2]||30),chapters=process.argv[3]?process.argv[3].split(',').map(Number):D.CHAPTERS.map((_,i)=>i);
const ALLBOTS={'고수':{ult:'expert'},'중수':{ult:'asap',element:'first',vantage:false,shard:'none'},'초보':{ranged:'random',meleeFrac:.15,ult:'asap',element:'first',shard:'none',vantage:false,potion:'none'}},BOTS=Object.fromEntries(Object.entries(ALLBOTS).filter(([k])=>!process.env.BOTS||process.env.BOTS.split(',').includes(k)));
const jobs=[];for(const b in BOTS)for(const ch of chapters)for(let k=0;k<runs;k+=10)jobs.push({b,ch,n:Math.min(10,runs-k),seed:k});
const res={};let next=0,active=0;
function go(){while(active<4&&next<jobs.length){const j=jobs[next++];active++;
 execFile('node',[path.join(__dirname,'bot.js'),String(j.ch),String(j.n)],{env:{...process.env,STRAT:JSON.stringify(BOTS[j.b]),SEED0:String(j.seed)},maxBuffer:1e7},(e,out)=>{active--;
  const line=(out||'').split('\n').find(l=>/클리어 ·/.test(l))||'';const r=[...line.matchAll(/승\(생명 (\d+)·★(\d)\)|패\(전투 (\d+)\)/g)].map(m=>m[1]!=null?{won:1,life:+m[1],st:+m[2]}:{won:0,st:0,battle:+m[3]});
  const k=j.b+'|'+j.ch;(res[k]=res[k]||[]).push(...r);if(next>=jobs.length&&!active)report();else go();});}}
function stat(a){const w=a.filter(v=>v.won),l=w.map(v=>v.life),avg=x=>x.length?x.reduce((p,q)=>p+q,0)/x.length:0,c=s=>a.filter(v=>v.st===s).length;
 return `${String(w.length).padStart(2)}/${a.length} ${String(Math.round(w.length/a.length*100)).padStart(3)}% | 생명 ${avg(l).toFixed(1).padStart(4)} (${l.length?Math.min(...l)+'~'+Math.max(...l):'-'}) | 별 ${avg(a.map(v=>v.st)).toFixed(2)} | ★3 ${String(c(3)).padStart(2)} ★2 ${String(c(2)).padStart(2)} ★1 ${String(c(1)).padStart(2)} 패 ${String(c(0)).padStart(2)} | ★3률 ${Math.round(c(3)/a.length*100)}%`;}
function report(){for(const b in BOTS){console.log(`== ${b} 봇 (${JSON.stringify(BOTS[b])})`);const all=[];for(const ch of chapters){const a=res[b+'|'+ch]||[];all.push(...a);console.log(`${D.CHAPTERS[ch].label.padEnd(10)} ${stat(a)}`);}console.log(`${'합계'.padEnd(10)} ${stat(all)}`);}}
go();
