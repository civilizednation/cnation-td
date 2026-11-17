// Balance bot: plays a chapter headless with an ordinary build order and reports each battle.
//   node tools/bot.js [chapter=0] [runs=5] [--skill=0..1]   skill = how promptly it spends gold (1 = at once)
const {createSim}=require('../js/sim.js'),D=require('../js/data.js');
const args=process.argv.slice(2),chapter=+(args.find(a=>!a.startsWith('--'))||0),runs=+(args.filter(a=>!a.startsWith('--'))[1]||5);
// Ordinary player plan for each map: where each character goes, in the order they are bought.
const PLANS={prologue:[['kyle',2,4],['hunter',4,3],['militia',5,7],['ria',2,5],['hunter',4,6],['apprentice',3,8]]};
function play(seed,verbose){
 const S=createSim({chapter,seed}),plan=PLANS[S.chapter.map].slice(),log=[];let ults=0,last=-1,guard=0;
 const spend=()=>{
  while(plan.length){const [d,c,r]=plan[0];if(S.hero[d]&&S.hero[d].cd>0)break;if(S.units.length>=S.chapter.command){plan.length=0;break;}if(S.gold<S.deployCost(d))break;const err=S.deploy(d,c,r);if(err){plan.shift();continue;}plan.shift();}
  // Fallen heroes come back to their old tile as soon as they can.
  for(const id in S.hero){const h=S.hero[id];if(h.keep&&h.cd<=0&&h.home)S.deploy(id,h.home[0],h.home[1]);}
  if(plan.length)return;
  // Then rank up: heroes first, cheapest step first.
  for(let n=0;n<8;n++){const c=S.units.map(u=>({u,cost:S.rankCost(u)})).filter(v=>v.cost!=null&&v.cost<=S.gold).sort((a,b)=>(S.defOf(b.u).kind==='hero')-(S.defOf(a.u).kind==='hero')||a.cost-b.cost)[0];if(!c)break;
   const choice=S.needsChoice(c.u)?(c.u.def==='ria'?'fire':'wind'):undefined;if(S.rankUp(c.u.id,choice))break;}
 };
 while(S.phase!=='won'&&S.phase!=='lost'&&guard++<4e6){
  for(const u of S.units)if(S.hero[u.def])S.hero[u.def].home=[u.c,u.r];
  if(S.phase==='bless'){S.chooseBlessing(S.offer[0]);continue;}
  spend();
  if(S.phase==='prep'){if(S.battle!==last){last=S.battle;log.push({b:S.battle+1,gold0:S.gold,life0:S.life,units:S.units.map(u=>u.def[0]+u.rank).join(' ')});}S.startBattle();}
  if(S.phase==='battle'){for(const u of S.units)if(u.ult&&u.ultCd<=0){const s=D.SKILLS[u.ult];if(s.aim){const t=S.enemies.slice().sort((a,b)=>b.dist-a.dist)[Math.min(2,S.enemies.length-1)];if(t&&S.enemies.length>=4){S.ult(u.id,t.x,t.y);ults++;}}else if(S.enemies.filter(e=>Math.hypot(e.x-u.x,e.y-u.y)<3).length>=3){S.ult(u.id);ults++;}}}
  S.tick(1/30);
  for(const e of S.drain()){if(e.t==='cleared'){const l=log[log.length-1];l.leaks=S.leaks;l.time=Math.round(S.battleTime);l.life=S.life;}}
 }
 if(verbose){for(const l of log)console.log(`  전투 ${String(l.b).padStart(2)}  골드 ${String(l.gold0).padStart(4)}  생명 ${String(l.life0).padStart(2)}  누수 ${l.leaks??'-'}  ${l.time??'-'}초  [${l.units}]`);console.log('  피해량',JSON.stringify(S.stats.dealt),'궁극기',ults);}
 return {won:S.phase==='won',battle:S.battle+1,life:S.life,leaks:S.leaksTotal};
}
let wins=0;const res=[];
for(let i=0;i<runs;i++){const r=play(1000+i*37,i===0);res.push(r);if(r.won)wins++;}
console.log(`${D.CHAPTERS[chapter].label}: ${wins}/${runs} 클리어 · `+res.map(r=>r.won?`승(생명 ${r.life})`:`패(전투 ${r.battle})`).join(', '));
