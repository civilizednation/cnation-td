// cnation TD battle simulation. No DOM and no rendering: the game screen and the balance bot both drive it.
// Deterministic for a given seed and the same sequence of commands. Positions are in tiles (x = column, y = row).
(function(root){
const D=(typeof module!=='undefined'&&module.exports)?require('./data.js'):root.TDData;
const STEP=1/30,BLOCK_GAP=.48,PREP_TIME=30;

function seeded(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const elementFamily=e=>e==='ice'?'water':e;
// TACTICS rule: fire > wind > water > fire (×1.25 / ×0.75), light ↔ dark ×1.25 both ways.
function affinity(attack,target){const a=elementFamily(attack),b=elementFamily(target);if(!a||!b)return 1;if((a==='light'&&b==='dark')||(a==='dark'&&b==='light'))return 1.25;const adv={fire:'wind',wind:'water',water:'fire'};return !adv[a]||!adv[b]?1:adv[a]===b?1.25:adv[b]===a?.75:1;}

function buildMap(id){
 const m=D.MAPS[id],tiles=[];
 for(let r=0;r<m.h;r++)for(let c=0;c<m.w;c++){const ch=m.rows[r][c];tiles.push({c,r,terrain:ch==='^'?'high':ch==='f'?'forest':ch==='w'?'water':ch==='x'?'rock':'grass',road:false,pathDist:null});}
 const tile=(c,r)=>c<0||r<0||c>=m.w||r>=m.h?null:tiles[r*m.w+c];
 const segs=[];let total=0;
 for(let i=0;i<m.path.length-1;i++){const [ax,ay]=m.path[i],[bx,by]=m.path[i+1],len=Math.abs(bx-ax)+Math.abs(by-ay),dx=Math.sign(bx-ax),dy=Math.sign(by-ay);segs.push({ax,ay,dx,dy,len,start:total});
  for(let k=0;k<=len;k++){const t=tile(ax+dx*k,ay+dy*k);if(t&&!t.road){t.road=true;t.terrain='road';t.pathDist=total+k;}}total+=len;}
 for(const [c,r] of m.swamp||[]){const t=tile(c,r);if(t&&t.road)t.terrain='swamp';}
 function posAt(dist,lane=0){const d=Math.max(0,Math.min(total,dist));let s=segs[segs.length-1];for(const g of segs)if(d<=g.start+g.len){s=g;break;}const k=d-s.start;return {x:s.ax+s.dx*k-s.dy*lane,y:s.ay+s.dy*k+s.dx*lane,dx:s.dx,dy:s.dy};}
 return {id,w:m.w,h:m.h,tiles,tile,segs,total,posAt,scene:m.scene,path:m.path};
}

function createSim(opts){
 const chapter=D.CHAPTERS[opts.chapter||0],map=buildMap(chapter.map),snap=opts.snapshot||null;
 const S={chapter,chapterIndex:opts.chapter||0,map,time:0,phase:'prep',prep:0,battle:snap?snap.battle:0,gold:snap?snap.gold:chapter.startGold,life:snap?snap.life:chapter.life,maxLife:snap?snap.maxLife:chapter.life,
  units:[],enemies:[],queue:[],events:[],mods:{burn:0,soldierCost:0,kyleBlock:0,bounty:0,haste:0,range:0,cdr:0,rankCost:0},blessings:snap?snap.blessings.slice():[],offer:null,
  hero:{},nextId:1,leaks:0,leaksTotal:snap?snap.leaksTotal:0,kills:0,rand:seeded((opts.seed??20261117)+(snap?snap.battle*7919:0)),acc:0,stats:{dealt:{}}};
 for(const id of S.blessings){const b=D.BLESSINGS.find(v=>v.id===id);if(b?.mod)for(const k in b.mod)S.mods[k]+=b.mod[k];}
 for(const id of chapter.roster)if(D.UNITS[id].kind==='hero')S.hero[id]={cd:0,keep:null};
 const emit=e=>{S.events.push(e);};

 // ── Characters ──
 const defOf=u=>D.UNITS[u.def];
 function unitSkills(def,rank,choice){const list=[];let ult=null,aura=null,block=def.block,haste=0,splash=0;
  for(let i=0;i<rank;i++){const k=def.ranks[i];if(!k)continue;if(k.skills)list.push(...k.skills);if(k.ult)ult=k.ult;if(k.aura)aura=k.aura;if(k.blockBonus)block+=k.blockBonus;if(k.haste)haste+=k.haste;if(k.splash)splash=k.splash;
   if(k.choice&&choice){const c=k.choice[choice];if(c.skills)list.push(...c.skills);if(c.swap){const j=list.indexOf(c.swap[0]);if(j>=0)list[j]=c.swap[1];}}}
  return {list,ult,aura,block,haste,splash};}
 function refresh(u){const def=defOf(u),m=1+D.RANK_STAT*(u.rank-1),g=1+D.RANK_GUARD*(u.rank-1),kit=unitSkills(def,u.rank,u.choice),t=map.tile(u.c,u.r),oldMax=u.maxHp||0;
  u.maxHp=Math.round(def.hp*m);u.hp=oldMax?Math.min(u.maxHp,u.hp+(u.maxHp-oldMax)):u.maxHp;u.atk=def.atk*m;u.mag=def.mag*m;u.arm=def.def*g;u.res=def.res*g;
  u.interval=(1.6-def.spd*.03)/(1+S.mods.haste+kit.haste);u.block=kit.block+(u.def==='kyle'?S.mods.kyleBlock:0);u.splash=kit.splash;u.aura=kit.aura;u.ult=kit.ult;
  u.range=def.range+(def.melee?0:(t.terrain==='high'?.5:0)-(t.terrain==='forest'?.5:0)+S.mods.range);
  const old=u.skills||[];u.skills=kit.list.map(id=>old.find(s=>s.id===id)||{id,cd:1.5});}
 const costOf=(def,mult)=>{const d=D.UNITS[def];return Math.round(d.cost*mult*(1-(d.kind==='soldier'?S.mods.soldierCost:0)));};
 const deployCost=def=>S.hero[def]?.keep?0:costOf(def,D.RANK_COST[0]);
 function rankCost(u){const d=defOf(u);return u.rank>=d.maxRank?null:Math.round(costOf(u.def,D.RANK_COST[u.rank])*(1-S.mods.rankCost));}
 function canDeploy(def,c,r){const d=D.UNITS[def],t=map.tile(c,r);if(!d||!t)return '배치할 수 없는 곳입니다';
  if(S.phase!=='prep'&&S.phase!=='battle')return '지금은 배치할 수 없습니다';
  if(t.terrain==='water'||t.terrain==='rock')return '배치할 수 없는 지형입니다';
  if(S.units.some(u=>u.c===c&&u.r===r))return '이미 다른 동료가 있습니다';
  if(t.road&&!d.melee)return '길 위에는 근접 캐릭터만 설 수 있습니다';
  if(t.terrain==='high'&&d.melee)return '고지대에는 원거리 캐릭터만 설 수 있습니다';
  if(t.road&&(t.pathDist<1||t.pathDist>map.total-1))return '입구와 수정 바로 앞은 비워 둬야 합니다';
  if(d.kind==='hero'){if(S.units.some(u=>u.def===def))return `${d.name}은(는) 이미 전장에 있습니다`;if(S.hero[def].cd>0)return `${d.name} 재배치 대기 중`;}
  if(S.units.length>=chapter.command)return `지휘력 한도(${chapter.command}명)입니다`;
  if(S.gold<deployCost(def))return '골드가 부족합니다';
  return null;}
 function deploy(def,c,r){const err=canDeploy(def,c,r);if(err)return err;const d=D.UNITS[def],keep=S.hero[def]?.keep,cost=deployCost(def);S.gold-=cost;
  const u={id:S.nextId++,def,c,r,x:c,y:r,rank:keep?keep.rank:1,choice:keep?keep.choice:null,invested:keep?keep.invested:cost,cd:.4,ultCd:keep?12:0,blocking:[],hp:0,maxHp:0,buff:1,face:{dx:0,dy:1}};
  if(S.hero[def])S.hero[def].keep=null;refresh(u);u.hp=u.maxHp;S.units.push(u);emit({t:'deploy',id:u.id});return null;}
 const needsChoice=u=>{const k=defOf(u).ranks[u.rank];return !!(k&&k.choice);};
 function rankUp(id,choice){const u=S.units.find(v=>v.id===id);if(!u)return '없는 캐릭터입니다';const cost=rankCost(u);if(cost==null)return '최대 랭크입니다';if(S.gold<cost)return '골드가 부족합니다';
  if(needsChoice(u)){if(!defOf(u).ranks[u.rank].choice[choice])return '속성을 선택하세요';u.choice=choice;}
  S.gold-=cost;u.invested+=cost;u.rank++;refresh(u);if(u.ult&&u.rank===defOf(u).maxRank)u.ultCd=8;emit({t:'rank',id:u.id});return null;}
 function release(u){for(const e of S.enemies)if(e.blockedBy===u.id)e.blockedBy=null;u.blocking.length=0;}
 function withdraw(id){const i=S.units.findIndex(v=>v.id===id);if(i<0)return '없는 캐릭터입니다';const u=S.units[i],back=Math.round(u.invested*D.REFUND);S.gold+=back;release(u);S.units.splice(i,1);
  if(S.hero[u.def]){S.hero[u.def].cd=D.WITHDRAW_CD;S.hero[u.def].keep=null;}emit({t:'withdraw',id:u.id,gold:back});return null;}
 function down(u){release(u);S.units.splice(S.units.indexOf(u),1);if(S.hero[u.def]){S.hero[u.def].cd=D.DOWN_CD;S.hero[u.def].keep={rank:u.rank,choice:u.choice,invested:u.invested};}emit({t:'down',id:u.id,def:u.def,x:u.x,y:u.y});}

 // ── Monsters ──
 function spawn(kind,flags,at,parent){const boss=flags==='boss'?D.BOSSES[chapter.id]:null,base=D.MONSTERS[boss?boss.base:kind],b=chapter.battles[S.battle],[hpT,atkT]=b.tune,elite=flags==='elite',trait=D.MODEL_TRAITS[base.model]||{};
  let hp=base.hp*hpT*(elite?4:1),size=elite?'elite':null,gold=Math.max(2,Math.round(base.hp*.1))*(elite?4:1),speed=base.move*D.MOVE_SPEED,gen=0,lifeCost=elite?2:1,name=(elite?'정예 ':'')+base.name,scale=null;
  if(boss){hp=base.hp*hpT*boss.hp;speed=boss.move*D.MOVE_SPEED;gold=boss.gold;name=boss.name;scale=boss.scale;lifeCost=99;}
  if(parent){gen=parent.gen+1;hp=parent.maxHp*(parent.bossKin?.3:.35);gold=parent.bossKin?Math.max(2,Math.round(parent.gold*.2)):1;speed=base.move*D.MOVE_SPEED*(parent.bossKin&&gen<3?.9:1.15);
   if(parent.bossKin){scale=gen===1?1.5:gen===2?1:.72;lifeCost=gen===1?3:1;name=gen===1?'큰 이끼 슬라임':gen===2?base.name:'꼬마 '+base.name;}else{size='tiny';scale=.72;name='꼬마 '+base.name;}}
  const e={id:S.nextId++,kind:boss?boss.base:kind,name,model:base.model,color:base.color,element:base.element||null,immunity:base.immunity||null,flying:!!base.flying,magic:!!base.magic,
   hp,maxHp:hp,atk:(base.magic?base.mag:base.atk)*atkT*(elite?1.4:1)*(boss?boss.atk:1),def:base.def,res:base.res,range:base.range,speed,gold,elite,boss:!!boss,bossKin:!!boss||!!(parent&&parent.bossKin),gen,size,scale,lifeCost,
   canSplit:!!trait.split&&(boss||parent?.bossKin?gen<3:!parent),slots:1,dist:at??0,lane:(S.rand()-.5)*.44,blockedBy:null,cd:.6+S.rand()*.6,st:{},x:0,y:0,dx:0,dy:1};
  const p=map.posAt(e.dist,e.lane);e.x=p.x;e.y=p.y;S.enemies.push(e);emit({t:'spawn',id:e.id});return e;}
 function killEnemy(e,by){e.hp=0;e.dead=true;if(e.blockedBy){const u=S.units.find(v=>v.id===e.blockedBy);if(u)u.blocking=u.blocking.filter(i=>i!==e.id);}
  const gold=Math.round(e.gold*(1+S.mods.bounty));S.gold+=gold;S.kills++;emit({t:'die',id:e.id,x:e.x,y:e.y,gold,boss:e.boss});
  if(e.canSplit)for(const off of [-.25,.2])spawn(e.kind,null,Math.max(0,e.dist+off),e);}
 function addStatus(e,status){const boss=e.boss||(e.bossKin&&e.gen===1);
  if(status==='burn')e.st.burn=4;
  else if(status==='freeze'){if(boss)e.st.slow=Math.max(e.st.slow||0,2);else{e.st.freeze=1.5;}}
  else if(status==='stun')e.st.stun=boss?.5:1.2;
  else if(status==='slow')e.st.slow=Math.max(e.st.slow||0,3);
  else if(status==='defdown')e.st.defdown=6;
  emit({t:'status',id:e.id,status});}
 // One hit. o = {type,power,element,skill}. Returns the damage dealt.
 function hit(src,e,o){if(e.dead)return 0;const magic=o.type==='magic',A=(magic?src.mag:src.atk)*(src.buff||1),Dv=magic?e.res:e.def,raw=A*(o.power||1);let dmg=Math.max(raw-Dv*.5,raw*.2),tag=null;
  const aff=affinity(o.element,e.element);dmg*=aff;if(aff>1)tag='weak';else if(aff<1)tag='resist';
  if(e.immunity==='physical'&&!magic){dmg*=o.element?.6:.35;tag='resist';}else if(e.immunity==='magic'&&magic){dmg*=.35;tag='resist';}
  if(e.st.defdown&&!magic)dmg*=1.25;
  let combo=null;if(o.skill&&!magic&&(e.st.freeze||e.st.slow)){dmg*=1.3;combo='파쇄';}
  const crit=S.rand()<(defOf(src).crit||0);if(crit)dmg*=1.5;
  dmg=Math.max(1,Math.round(dmg));e.hp-=dmg;S.stats.dealt[src.def]=(S.stats.dealt[src.def]||0)+dmg;emit({t:'dmg',id:e.id,x:e.x,y:e.y,v:dmg,crit,tag,combo});
  if(e.hp<=0)killEnemy(e,src);return dmg;}
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function pickTarget(u,range,canFly){let best=null;const reach=range+.35;
  for(const e of S.enemies){if(e.dead)continue;if(e.flying&&!canFly)continue;if(e.blockedBy!==u.id&&dist(u,e)>reach)continue;const score=(e.blockedBy===u.id?1000:0)+e.dist;if(!best||score>best.score)best={e,score};}
  return best?.e||null;}
 function castSkill(u,sk,target,point){const s=D.SKILLS[sk.id],o={type:s.type,power:s.power,element:s.element,skill:true};
  const centre=s.self?{x:u.x,y:u.y}:point||{x:target.x,y:target.y};
  const victims=s.area?S.enemies.filter(e=>!e.dead&&Math.hypot(e.x-centre.x,e.y-centre.y)<=s.area+.2&&(s.type==='magic'||!e.flying||s.ult)):[target];
  emit({t:'skill',unit:u.id,skill:sk.id,name:s.name,x:centre.x,y:centre.y,area:s.area||0,element:s.element,fx:s.fx,from:{x:u.x,y:u.y}});
  for(const e of victims){const burning=!!e.st.burn;hit(u,e,o);if(e.dead)continue;
   if(s.status&&S.rand()<(s.chance??1))addStatus(e,s.status);
   if(s.knockback&&!e.boss&&!e.blockedBy){e.dist=Math.max(0,e.dist-s.knockback);}
   // Combo 확산: a wind skill fans the flames to neighbours.
   if(burning&&s.element==='wind'){let spread=0;for(const n of S.enemies)if(!n.dead&&n!==e&&!n.st.burn&&dist(n,e)<=1.3){addStatus(n,'burn');spread++;}if(spread)emit({t:'combo',x:e.x,y:e.y,name:'확산'});}}
  sk.cd=s.cd*(1-S.mods.cdr);if(target||point){const t=target||point;u.face={dx:t.x-u.x,dy:t.y-u.y};}}
 function ult(id,x,y){const u=S.units.find(v=>v.id===id);if(!u||!u.ult)return '궁극기가 없습니다';if(u.ultCd>0)return '아직 준비되지 않았습니다';if(S.phase!=='battle')return '전투 중에만 쓸 수 있습니다';
  const s=D.SKILLS[u.ult];if(s.aim&&(x==null||y==null))return '위치를 지정하세요';const holder={id:u.ult,cd:0};castSkill(u,holder,null,s.aim?{x,y}:null);u.ultCd=holder.cd;emit({t:'ult',unit:u.id,name:s.name});return null;}

 // ── Battle flow ──
 function loadBattle(){const b=chapter.battles[S.battle];S.queue=[];for(const [kind,count,gap,delay,flags] of b.waves)for(let i=0;i<count;i++)S.queue.push({t:delay+i*gap,kind,flags:flags||null});S.queue.sort((a,b2)=>a.t-b2.t);S.battleTime=0;S.leaks=0;}
 function preview(i=S.battle){const b=chapter.battles[i];if(!b)return [];const out=[];for(const [kind,count,,,flags] of b.waves){const boss=flags==='boss'?D.BOSSES[chapter.id]:null,m=D.MONSTERS[boss?boss.base:kind];out.push({kind,name:boss?boss.name:(flags==='elite'?'정예 ':'')+m.name,count,element:m.element||null,flying:!!m.flying,immunity:m.immunity||null,elite:flags==='elite',boss:!!boss,note:(D.MODEL_TRAITS[m.model]||{}).note||''});}return out;}
 function startBattle(){if(S.phase!=='prep')return;const bonus=S.battle>0?Math.floor(S.prep):0;if(bonus>0){S.gold+=bonus;emit({t:'bonus',gold:bonus,why:'조기 출발'});}S.phase='battle';loadBattle();emit({t:'battleStart',battle:S.battle});}
 function enterPrep(){S.phase='prep';S.prep=PREP_TIME;for(const u of S.units){u.hp=u.maxHp;}emit({t:'prep',battle:S.battle});}
 function finishBattle(){const n=S.battle+1,clean=S.leaks===0,bonus=Math.round((30+n*8)*(clean?1.5:1));S.gold+=bonus;S.leaksTotal+=S.leaks;emit({t:'cleared',battle:S.battle,gold:bonus,clean});
  if(n>=chapter.battles.length){S.phase='won';emit({t:'won'});return;}
  S.battle=n;
  if(D.BLESSING_AFTER.includes(n)){const pool=D.BLESSINGS.filter(b=>!S.blessings.includes(b.id)&&(b.id!=='guard'||chapter.roster.includes('kyle'))),pick=[];while(pick.length<3&&pool.length)pick.push(pool.splice(Math.floor(S.rand()*pool.length),1)[0].id);S.offer=pick;S.phase='bless';emit({t:'bless',offer:pick});}
  else enterPrep();}
 function chooseBlessing(id){if(S.phase!=='bless'||!S.offer.includes(id))return '선택할 수 없습니다';const b=D.BLESSINGS.find(v=>v.id===id);S.blessings.push(id);if(b.mod)for(const k in b.mod)S.mods[k]+=b.mod[k];if(b.life){S.life+=b.life;S.maxLife+=b.life;}if(b.gold)S.gold+=b.gold;
  for(const u of S.units)refresh(u);S.offer=null;enterPrep();return null;}

 function tick(dt){S.time+=dt;
  for(const id in S.hero)if(S.hero[id].cd>0)S.hero[id].cd=Math.max(0,S.hero[id].cd-dt);
  if(S.phase==='prep'){if(S.battle>0){S.prep-=dt;if(S.prep<=0){S.prep=0;startBattle();}}return;}
  if(S.phase!=='battle')return;
  S.battleTime+=dt;while(S.queue.length&&S.queue[0].t<=S.battleTime){const q=S.queue.shift();spawn(q.kind,q.flags);}
  // Auras
  for(const u of S.units)u.buff=1;
  for(const a of S.units)if(a.aura)for(const u of S.units)if(Math.hypot(u.x-a.x,u.y-a.y)<=a.aura.radius+.01)u.buff=Math.max(u.buff,a.aura.mult);
  // Monsters: statuses, movement, blocking, attacks
  for(const e of S.enemies){if(e.dead)continue;const st=e.st;
   if(st.burn){st.burn-=dt;const rate=(e.boss?.005:e.bossKin&&e.gen===1?.01:.02)*(1+S.mods.burn);e.hp-=e.maxHp*rate*dt;if(st.burn<=0)delete st.burn;if(e.hp<=0){killEnemy(e,null);continue;}}
   if(st.freeze){st.freeze-=dt;if(st.freeze<=0){delete st.freeze;st.slow=Math.max(st.slow||0,3);}}
   for(const k of ['stun','slow','defdown'])if(st[k]){st[k]-=dt;if(st[k]<=0)delete st[k];}
   const stopped=st.freeze||st.stun;
   if(e.blockedBy){const u=S.units.find(v=>v.id===e.blockedBy);if(!u){e.blockedBy=null;}else if(!stopped){e.cd-=dt;if(e.cd<=0){e.cd=1.6;const raw=e.atk,dmg=Math.max(1,Math.round(Math.max(raw-(e.magic?u.res:u.arm)*.5,raw*.2)));u.hp-=dmg;emit({t:'hurt',unit:u.id,from:e.id,x:u.x,y:u.y,v:dmg});if(u.hp<=0){down(u);}}}}
   if(!e.blockedBy&&!stopped){const t=map.tile(Math.round(e.x),Math.round(e.y));let sp=e.speed*(st.slow?.65:1)*(t&&t.terrain==='swamp'&&!e.flying?.7:1),next=e.dist+sp*dt;
    if(!e.flying){for(const u of S.units){const tu=map.tile(u.c,u.r);if(!tu.road||u.block<=0)continue;const stopAt=tu.pathDist-BLOCK_GAP;if(e.dist<=stopAt+.02&&next>=stopAt&&u.blocking.length+e.slots<=u.block){e.blockedBy=u.id;u.blocking.push(e.id);next=stopAt;break;}}}
    e.dist=next;
    if(e.dist>=map.total){e.dead=true;e.leaked=true;S.life-=e.lifeCost;S.leaks++;emit({t:'leak',id:e.id,cost:e.lifeCost});if(S.life<=0){S.life=0;S.phase='lost';emit({t:'lost'});return;}continue;}}
   const p=map.posAt(e.dist,e.lane);e.x=p.x;e.y=p.y;e.dx=p.dx;e.dy=p.dy;}
  S.enemies=S.enemies.filter(e=>!e.dead);
  // Characters: skills first, then the basic attack
  for(const u of S.units.slice()){if(u.hp<=0)continue;const def=defOf(u);if(u.ultCd>0)u.ultCd=Math.max(0,u.ultCd-dt);u.cd-=dt;let cast=false;
   for(const sk of u.skills){if(sk.cd>0){sk.cd-=dt;continue;}if(cast||u.cd>.25)continue;const s=D.SKILLS[sk.id],range=s.range?s.range+(u.range-def.range):u.range,target=pickTarget(u,range,s.type==='magic'||!def.melee);if(!target)continue;castSkill(u,sk,target);u.cd=Math.max(u.cd,.45);cast=true;}
   if(cast||u.cd>0)continue;const target=pickTarget(u,u.range,!def.melee);if(!target)continue;
   u.cd=u.interval;u.face={dx:target.x-u.x,dy:target.y-u.y};const o={type:def.magic?'magic':'physical',power:1};emit({t:'attack',unit:u.id,target:target.id,from:{x:u.x,y:u.y},to:{x:target.x,y:target.y},melee:def.melee,magic:!!def.magic});
   if(u.splash){const c={x:target.x,y:target.y};for(const e of S.enemies.slice())if(!e.dead&&Math.hypot(e.x-c.x,e.y-c.y)<=u.splash)hit(u,e,e===target?o:{...o,power:.5});}else hit(u,target,o);}
  S.enemies=S.enemies.filter(e=>!e.dead);
  if(!S.queue.length&&!S.enemies.length&&S.phase==='battle')finishBattle();}
 function step(dt){S.acc+=dt;let n=0;while(S.acc>=STEP&&n<12){tick(STEP);S.acc-=STEP;n++;}if(n>=12)S.acc=0;}

 function snapshot(){return {v:1,chapter:S.chapterIndex,battle:S.battle,gold:S.gold,life:S.life,maxLife:S.maxLife,blessings:S.blessings.slice(),leaksTotal:S.leaksTotal,
  units:S.units.map(u=>({def:u.def,c:u.c,r:u.r,rank:u.rank,choice:u.choice,invested:u.invested})),hero:Object.fromEntries(Object.entries(S.hero).map(([k,v])=>[k,{keep:v.keep}]))};}
 if(snap){for(const s of snap.units){const u={id:S.nextId++,def:s.def,c:s.c,r:s.r,x:s.c,y:s.r,rank:s.rank,choice:s.choice,invested:s.invested,cd:.4,ultCd:0,blocking:[],hp:0,maxHp:0,buff:1,face:{dx:0,dy:1}};refresh(u);u.hp=u.maxHp;S.units.push(u);}
  for(const k in snap.hero||{})if(S.hero[k])S.hero[k].keep=snap.hero[k].keep;}
 S.prep=PREP_TIME;
 return Object.assign(S,{step,tick,deploy,canDeploy,deployCost,rankUp,rankCost,needsChoice,withdraw,ult,startBattle,chooseBlessing,preview,snapshot,defOf,
  refundOf:u=>Math.round(u.invested*D.REFUND),drain(){const e=S.events;S.events=[];return e;}});
}
const TDSim={createSim,affinity,buildMap,STEP};
if(typeof module!=='undefined'&&module.exports)module.exports=TDSim;else root.TDSim=TDSim;
})(typeof window!=='undefined'?window:globalThis);
