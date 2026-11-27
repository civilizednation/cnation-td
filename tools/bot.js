// Balance bot: plays chapters headless the way an ordinary player would and reports the result.
//   node tools/bot.js [chapter|all] [runs=4] [-v]            play
//   node tools/bot.js calibrate [chapter|all] [runs=4]        search the chapter HP multiplier (diff[0]) for the target
const {createSim}=require('../js/sim.js'),D=require('../js/data.js');
// DIFF='[hp,atk,boss]' multiplies every chapter's monster HP / attack / boss HP for experiments (tools/tune.js)
if(process.env.DIFF){const [h,a,b]=JSON.parse(process.env.DIFF);for(const C of D.CHAPTERS){C.bossScale*=b??1;for(const bt of C.battles){bt.tune[0]*=h??1;bt.tune[1]*=a??1;}}}
const ORDER=['kyle','hunter','ria','bran','sera','luna','militia','nero','apprentice','shield','acolyte','hunter','militia','apprentice'];
// Strategy knobs for experiments (tools/strategy.js): STRAT='{"meleeFrac":.45,"heroFrac":null,"soldierFrac":null,"ranged":"cover","ult":"smart","upgrade":"balanced","soldiers":true}'
const ST=Object.assign({meleeFrac:.45,heroFrac:null,soldierFrac:null,ranged:'cover',ult:'smart',upgrade:'balanced',soldiers:true,vantage:true,element:'best',shard:'smart'},process.env.STRAT?JSON.parse(process.env.STRAT):{});
const CHOICE={kyle:'wind',ria:'fire',bran:'wind',sera:'fire',luna:'fire',nero:'wind'};
function bestTile(S,def){const d=D.UNITS[def],map=S.map,roads=map.tiles.filter(t=>t.road);let best=null;
 for(const t of map.tiles){const err=S.canDeploy(def,t.c,t.r);if(err)continue;let score=0;
  if(d.melee){if(!t.road)continue;const at=Object.values(t.pd)[0],total=map.paths[Object.keys(t.pd)[0]].total,frac=at/total;
   for(const u of S.units)if(!D.UNITS[u.def].melee&&Math.hypot(u.x-t.c,u.y-t.r)<=u.range+.3)score+=2;
   for(const q of roads)if(q.terrain==='swamp'||q.terrain==='sand'){const qd=Object.values(q.pd)[0];if(qd<at&&at-qd<=2)score+=1.5;}
   score+=Object.keys(t.pd).length>1?3:0;const want=(d.kind==='hero'?ST.heroFrac:ST.soldierFrac)??ST.meleeFrac;score-=Math.abs(frac-want)*4;for(const u of S.units)if(D.UNITS[u.def].melee&&Math.hypot(u.x-t.c,u.y-t.r)<2.5)score-=3;}
  else if(def==='luna'||def==='acolyte'){for(const u of S.units)if(D.UNITS[u.def].melee&&Math.hypot(u.x-t.c,u.y-t.r)<=d.range+.3)score+=3;for(const u of S.units)if(Math.hypot(u.x-t.c,u.y-t.r)<=2)score+=.5;}
  else if(ST.ranged==='random'){score=Math.random();}
  else if(ST.ranged==='entrance'||ST.ranged==='exit'){let near=99,at=0;for(const q of roads){const dd=Math.hypot(q.c-t.c,q.r-t.r);if(dd<near){near=dd;at=Object.values(q.pd)[0]/map.paths[Object.keys(q.pd)[0]].total;}}score=(ST.ranged==='entrance'?1-at:at)*10-near;}
  else{const range=d.range+(t.terrain==='high'?.5:0)-(t.terrain==='forest'?.5:0);for(const q of roads){const dd=Math.hypot(q.c-t.c,q.r-t.r);if(dd<=range+.35&&dd>=(d.minRange||0))score+=1+(q.terrain==='swamp'||q.terrain==='sand'?.5:0);}
   for(const u of S.units)if(D.UNITS[u.def].melee&&Math.hypot(u.x-t.c,u.y-t.r)<=range)score+=1.5;}
  if(ST.vantage&&(ST.vantage!=='ranged'||!d.melee)&&(ST.vantage!=='melee'||d.melee)&&S.vantage.some(v=>v.c===t.c&&v.r===t.r))score+=d.melee?(ST.vw??1.2):(ST.vw??1.5);
  if(!best||score>best.score)best={t,score};}
 return best&&best.t;}
function play(chapter,seed,verbose,noBoss){
 const legacy=process.env.NO_LEGACY?{}:D.typicalLegacy(chapter,seed);if(ST.extraLegacy)legacy[ST.extraLegacy]=(legacy[ST.extraLegacy]||0)+1;const S=createSim({chapter,seed,legacy}),plan=ORDER.filter(id=>S.chapter.roster.includes(id)&&(ST.soldiers||D.UNITS[id].kind==='hero')),log=[];let ults=0,last=-1,guard=0,think=0;
 const spend=()=>{
  for(const id in S.hero){const h=S.hero[id];if(!h.keep||h.cd>0||!h.home)continue;let t=S.canDeploy(id,h.home[0],h.home[1])?bestTile(S,id):{c:h.home[0],r:h.home[1]};if(t)S.deploy(id,t.c,t.r);}
  // Each time it can afford something it takes the better deal: one more character, or a rank for one already out.
  for(let n=0;n<10;n++){
   while(plan.length&&(D.UNITS[plan[0]].kind==='hero'?(S.units.some(u=>u.def===plan[0])||S.hero[plan[0]].cd>0||S.hero[plan[0]].keep):!S.slotFree(plan[0])))plan.shift();
   if(ST.soldiers&&!plan.length&&S.slotFree('militia'))plan.push(['hunter','militia','apprentice'][S.soldierCount()%3]);
   const place=plan.length?{cost:S.deployCost(plan[0])*(ST.upgrade==='spreadFirst'?0:1+S.units.length*.1)}:null;
   const up=S.units.map(u=>({u,cost:S.rankCost(u)})).filter(v=>v.cost!=null).filter(v=>ST.upgrade!=='heroesOnly'||S.defOf(v.u).kind==='hero').map(v=>({...v,w:v.cost*(S.defOf(v.u).kind==='hero'?1:1.6)})).sort((a,b)=>a.w-b.w)[0];
   if(place&&(!up||place.cost<=up.w)){if(S.gold<S.deployCost(plan[0]))return;const t=bestTile(S,plan[0]);if(t)S.deploy(plan[0],t.c,t.r);plan.shift();}
   else if(up){if(S.gold<up.cost)return;if(S.rankUp(up.u.id,S.needsChoice(up.u)?CHOICE[up.u.def]:undefined))return;}
   else return;}
 };
 while(S.phase!=='won'&&S.phase!=='lost'&&guard++<6e6){
  if(noBoss&&S.battle===S.chapter.battles.length-1)return {won:true,battle:S.battle+1,life:S.life,max:S.maxLife};
  for(const u of S.units)if(S.hero[u.def])S.hero[u.def].home=[u.c,u.r];
  if(S.phase==='bless'){if(ST.bless){S.offer=[ST.bless];}S.chooseBlessing(S.offer[0]);continue;}   // STRAT bless:id forces that blessing (reward survey)
  if((think-=1)<=0){think=30;spend();}       // looks at the field about once a second
  if(S.phase==='prep'){spend();if(S.battle!==last){last=S.battle;log.push({b:S.battle+1,gold0:S.gold,life0:S.life,units:S.units.map(u=>u.def.slice(0,2)+u.rank).join(' ')});}S.startBattle();}
  if(S.phase==='battle'&&think===15&&ST.ult!=='never'){const bossOn=S.enemies.some(e=>e.boss);for(const u of S.units)if(u.ult&&u.ultCd<=0&&(ST.ult!=='boss'||bossOn||!S.chapter.battles[S.battle].boss&&false)){const s=D.SKILLS[u.ult];let go=false,x,y;
    if(s.aim){const t=S.enemies.slice().sort((a,b)=>b.dist-a.dist)[Math.min(2,S.enemies.length-1)];if(t&&S.enemies.length>=4){go=true;x=t.x;y=t.y;}}
    else if(s.type==='fortress')go=S.units.some(a=>a.hp<a.maxHp*.5);else if(s.type==='heal')go=S.units.filter(a=>a.hp<a.maxHp*.6).length>=2;
    else if(s.pick)go=S.enemies.some(e=>e.boss||e.elite)||S.enemies.length>6;else go=S.enemies.filter(e=>Math.hypot(e.x-u.x,e.y-u.y)<s.area).length>=3;
    // expert (1.7.32): aim the meteor at the densest cluster, hold damage 필살기 for a crowd, an elite/boss or a leak threat, and fire
    // several together to chain them (+15%/+30%)
    if(ST.ult==='expert'&&S.enemies.length&&s.type!=='heal'&&s.type!=='fortress'){const far=e=>{const p=S.map.paths[e.path];return p?e.dist/p.total:0;},W=e=>(e.boss?4:e.elite?2:1)+(e.elite&&far(e)>.55?4:0)+(far(e)>.8?2:0),ready=S.units.filter(v=>v.ult&&v.ultCd<=0&&!['heal','fortress'].includes(D.SKILLS[v.ult].type)).length,
      danger=S.enemies.some(e=>{const p=S.map.paths[e.path];return p&&e.dist>p.total*.82;}),chain=S.time-S.lastUlt<=2.6;let val=0;
     if(s.aim){let best=null;for(const c of S.enemies){const v=S.enemies.filter(e=>Math.hypot(e.x-c.x,e.y-c.y)<=s.area+.2).reduce((a,e)=>a+W(e),0);if(!best||v>best.v)best={v,c};}val=best.v;x=best.c.x;y=best.c.y;}
     else if(s.pick)val=S.enemies.some(e=>e.boss||e.elite)?5:S.enemies.length>=5?4:1;
     else val=S.enemies.filter(e=>Math.hypot(e.x-u.x,e.y-u.y)<s.area+.2).reduce((a,e)=>a+W(e),0);
     go=val>=5||(val>=3&&(danger||chain||ready>=2))||(val>=1&&S.enemies.some(e=>e.boss));}
    if(ST.ult==='asap'&&S.enemies.length){const t=S.enemies.slice().sort((a,b)=>b.dist-a.dist)[0];go=true;if(s.aim){x=t.x;y=t.y;}}
    let el;const els=S.ultElements(u);if(go&&els.length>1&&ST.element==='best'){const cx=x??u.x,cy=y??u.y,near=S.enemies.filter(e=>Math.hypot(e.x-cx,e.y-cy)<3);
     el=els.map(k=>({k,v:near.reduce((a,e)=>a+S.affinity(k,e.element)*(e.boss?4:1),0)})).sort((a,b)=>b.v-a.v)[0].k;}
    if(go&&!S.ult(u.id,x,y,el))ults++;}}
  if(S.phase==='battle'&&think===15&&ST.potion!=='none'&&S.potions>0)for(const u of S.units)if(S.defOf(u).kind==='hero'&&u.hp<u.maxHp*.3&&!S.usePotion(u.id))break;
  if(S.shard&&ST.shard==='smart'){const h=S.units.filter(u=>u.ult&&!u.shardT).sort((a,b)=>b.ultCd-a.ultCd)[0];S.giveShard(h?h.id:null);}
  S.tick(1/30);
  for(const e of S.drain()){if(e.t==='leak')(log.leaks=log.leaks||[]).push(`${S.battle+1}:${e.name}`);if(e.t==='down')(log.downs=log.downs||[]).push(`${S.battle+1}:${e.def}`);if(e.t==='cleared'){const l=log[log.length-1];l.leaks=S.leaks;l.time=Math.round(S.battleTime);}}
 }
 if(verbose){console.log('  유산',JSON.stringify(legacy));for(const l of log)console.log(`  전투 ${String(l.b).padStart(2)}  골드 ${String(l.gold0).padStart(4)}  생명 ${String(l.life0).padStart(2)}  누수 ${l.leaks??'패배'}  ${l.time??'-'}초  [${l.units}]`);console.log('  누수',(log.leaks||[]).slice(-14).join(', '));console.log('  쓰러짐',(log.downs||[]).length,(log.downs||[]).slice(-12).join(', '));console.log('  피해량',JSON.stringify(S.stats.dealt),'회복',Math.round(S.stats.healed),'궁극기',ults);}
 const won=S.phase==='won',stars=!won?0:S.leaksTotal===0?3:S.life>=Math.ceil(S.chapter.life*.75)?2:1;   // same rule as the clear screen
 return {won,battle:S.battle+1,life:S.life,max:S.maxLife,leaks:S.leaksTotal,stars};
}
function run(ch,runs,verbose,noBoss){const res=[];for(let i=0;i<runs;i++)res.push(play(ch,1000+((+process.env.SEED0||0)+i)*37,verbose&&i===(+process.env.BOT_RUN||0),noBoss));return {wins:res.filter(r=>r.won).length,life:res.reduce((s,r)=>s+(r.won?r.life:0),0)/runs,res};}
const args=process.argv.slice(2),verbose=args.includes('-v'),pos=args.filter(a=>a!=='-v');
if(pos[0]==='calibrate'){const list=pos[1]==null||pos[1]==='all'?D.CHAPTERS.map((_,i)=>i):[+pos[1]],runs=+(pos[2]||4),out=[];
 for(const ch of list){const C=D.CHAPTERS[ch],base=C.battles.map(b=>b.tune[0]/C.diff[0]);let lo=.2,hi=4,k=C.diff[0];
  // Step 1 — ordinary battles: reach the boss with 13–17 life (a few leaks).  Step 2 — boss: 70% of the toughest boss the bot still beats every run.
  for(let it=0;it<9;it++){k=Math.sqrt(lo*hi);C.battles.forEach((b,i)=>{b.tune[0]=base[i]*k;});const r=run(ch,runs,false,true);if(r.wins<runs||r.life<13)hi=k;else if(r.life>17)lo=k;else break;}
  C.battles.forEach((b,i)=>{b.tune[0]=base[i]*k;});let bl=.15,bh=8;for(let it=0;it<8;it++){const m=Math.sqrt(bl*bh);C.bossScale=m;if(run(ch,runs).wins===runs)bl=m;else bh=m;}
  C.bossScale=+(bl*.6).toFixed(2);const r=run(ch,runs);out.push([+k.toFixed(2),C.diff[1],C.bossScale]);console.log(`${C.label}: diff ${k.toFixed(2)}, boss ${C.bossScale} → ${r.wins}/${runs} 클리어, 평균 생명 ${r.life.toFixed(1)}`);}
 console.log('diff:',JSON.stringify(out));
}else{const list=pos[0]==null||pos[0]==='all'?D.CHAPTERS.map((_,i)=>i):[+pos[0]],runs=+(pos[1]||4);
 // Report (owner's standing request): wins, life left (mean / min–max over wins), stars (mean and ★3/★2/★1/fail counts) per chapter + total.
 const all=[],stat=res=>{const w=res.filter(v=>v.won),lives=w.map(v=>v.life),avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,cnt=k=>res.filter(v=>v.stars===k).length;
  return `승 ${w.length}/${res.length} (${Math.round(w.length/res.length*100)}%) · 생명 평균 ${avg(lives).toFixed(1)}${lives.length?` (${Math.min(...lives)}~${Math.max(...lives)})`:''} · 별 평균 ${avg(res.map(v=>v.stars)).toFixed(2)} [★3 ${cnt(3)} · ★2 ${cnt(2)} · ★1 ${cnt(1)} · 패 ${cnt(0)}]`;};
 for(const ch of list){const r=run(ch,runs,verbose);all.push(...r.res);console.log(`${D.CHAPTERS[ch].label}: ${r.wins}/${runs} 클리어 · `+r.res.map(v=>v.won?`승(생명 ${v.life}·★${v.stars})`:`패(전투 ${v.battle})`).join(', '));console.log(`  └ ${stat(r.res)}`);}
 if(list.length>1)console.log(`합계: ${stat(all)}`);}
