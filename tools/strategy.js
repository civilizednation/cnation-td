// Strategy experiment: plays the same chapters and seeds with different placement / upgrade / 필살기 habits (tools/bot.js STRAT knobs)
// and compares wins and life left.  node tools/strategy.js [chapters=2,4,6,8] [runs=4]
const {execFile}=require('child_process'),path=require('path');
const chapters=(process.argv[2]||'2,4,6,8').split(',').map(Number),runs=+(process.argv[3]||4);
const V=[['기준 (근접 길 중간 · 원거리 길 많이 보는 곳 · 필살기 상황 판단 · 영웅 우선 랭크업)',{}],
 ['근접 전부 입구 쪽',{meleeFrac:.15}],['근접 전부 출구 쪽',{meleeFrac:.8}],
 ['근접 영웅 입구 · 근접 병사 출구',{heroFrac:.15,soldierFrac:.85}],['근접 영웅 출구 · 근접 병사 입구',{heroFrac:.85,soldierFrac:.15}],
 ['원거리 아무 발판',{ranged:'random'}],['원거리 입구 쪽 발판',{ranged:'entrance'}],['원거리 출구 쪽 발판',{ranged:'exit'}],
 ['필살기 안 씀',{ult:'never'}],['필살기 준비되면 바로',{ult:'asap'}],['필살기 보스전에만',{ult:'boss'}],
 ['명당 무시',{vantage:false}],['필살기 속성 고르지 않음',{element:'first'}],['수정 조각 방치(무작위 영웅)',{shard:'none'}],
 ['초보 습관 모두 (원거리 아무 곳 · 근접 입구 · 필살기 바로 · 속성/명당/조각 무시)',{ranged:'random',meleeFrac:.15,ult:'asap',element:'first',shard:'none',vantage:false}],
 ['병사 랭크업 안 함',{upgrade:'heroesOnly'}],['병사 안 씀',{soldiers:false}],['먼저 전원 배치 후 랭크업',{upgrade:'spreadFirst'}]];
const jobs=[];for(const [name,st] of V)for(const ch of chapters)jobs.push({name,st,ch});
const res={};let next=0,active=0;
function run(){while(active<4&&next<jobs.length){const j=jobs[next++];active++;
 execFile('node',[path.join(__dirname,'bot.js'),String(j.ch),String(runs)],{env:{...process.env,STRAT:JSON.stringify(j.st)},maxBuffer:1e7},(err,out)=>{active--;
  const line=(out||'').trim().split('\n').pop()||'',lives=[...line.matchAll(/승\(생명 (\d+)\)|패\(전투 (\d+)\)/g)].map(m=>m[1]!=null?{won:true,life:+m[1]}:{won:false,battle:+m[2]});
  (res[j.name]=res[j.name]||[]).push(...lives);if(next>=jobs.length&&!active)report();else run();});}}
function report(){const base=res[V[0][0]];const avg=a=>a.reduce((s,x)=>s+(x.won?x.life:0),0)/a.length;
 console.log('전략'.padEnd(40),'승률','평균 남은 생명(패배=0)','기준 대비');
 for(const [name] of V){const a=res[name];console.log(name.padEnd(40),`${a.filter(x=>x.won).length}/${a.length}`.padEnd(6),avg(a).toFixed(1).padStart(6),(avg(a)-avg(base)>=0?'+':'')+(avg(a)-avg(base)).toFixed(1));}}
run();
