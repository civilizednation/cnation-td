// cnation TD battle simulation. No DOM and no rendering: the game screen and the balance bot both drive it.
// Deterministic for a given seed and the same sequence of commands. Positions are in tiles (x = column, y = row).
(function(root){
const D=(typeof module!=='undefined'&&module.exports)?require('./data.js'):root.TDData;
const STEP=1/30,PREP_TIME=30,ZONE_BACK=.8,ZONE_FRONT=.5;
// 1.7.0 필살기 카드: chain window, shard timing, vantage bonuses, element side effects of a 필살기.
const POTIONS=5,POTION_HEAL=.5,POTION_CD=10,FLIGHT={meteor:.5,bolt:.12,blast:.14,shot:.14},SHOT_FLIGHT=.17,CHAIN_WINDOW=3,SHARD_EVERY=40,SHARD_FIRST=18,SHARD_TIME=20,SHARD_RATE=2,SHARD_WAIT=20,VANTAGE_DMG=1.25,VANTAGE_RATE=1.5;
const ULT_STATUS={fire:'burn',ice:'freeze',water:'freeze',wind:'slow',thunder:'stun',dark:'poison'};
const seeded=D.seeded;
const elementFamily=e=>e==='ice'?'water':e;
// TACTICS rule: fire > wind > water > fire (×1.25 / ×0.75), light ↔ dark ×1.25 both ways.
function affinity(attack,target){const a=elementFamily(attack),b=elementFamily(target);if(!a||!b)return 1;if((a==='light'&&b==='dark')||(a==='dark'&&b==='light'))return 1.25;const adv={fire:'wind',wind:'water',water:'fire'};return !adv[a]||!adv[b]?1:adv[a]===b?1.25:adv[b]===a?.75:1;}

// Lays the roads, then grows rivers, lakes, high ground, cliffs, buildings and woods around them from the map's seed.
function buildMap(id){
 const spec=D.MAPS[id],rand=seeded(spec.seed*7919),tiles=[],W=spec.w||9,H=spec.h||14;
 for(let r=0;r<H;r++)for(let c=0;c<W;c++)tiles.push({c,r,terrain:'grass',road:false,pd:{},h:0,alt:false});
 const tile=(c,r)=>c<0||r<0||c>=W||r>=H?null:tiles[r*W+c];
 const paths=spec.paths.map((wp,p)=>{const segs=[];let total=0;
  for(let i=0;i<wp.length-1;i++){const [ax,ay]=wp[i],[bx,by]=wp[i+1],len=Math.abs(bx-ax)+Math.abs(by-ay),dx=Math.sign(bx-ax),dy=Math.sign(by-ay);segs.push({ax,ay,dx,dy,len,start:total});
   for(let k=0;k<=len;k++){const t=tile(ax+dx*k,ay+dy*k);if(t){t.road=true;t.terrain='road';if(t.pd[p]==null)t.pd[p]=total+k;}}total+=len;}
  return {wp,segs,total};});
 function posAt(p,dist,lane=0){const path=paths[p],d=Math.max(0,Math.min(path.total,dist));let s=path.segs[path.segs.length-1];for(const g of path.segs)if(d<=g.start+g.len){s=g;break;}const k=d-s.start;return {x:s.ax+s.dx*k-s.dy*lane,y:s.ay+s.dy*k+s.dx*lane,dx:s.dx,dy:s.dy};}
 const wet=t=>{if(!t)return;if(t.road)t.terrain='bridge';else t.terrain='water';};
 for(const rv of spec.rivers||[])for(let k=rv.from;k<=rv.to;k++)wet(rv.row!=null?tile(k,rv.row):tile(rv.col,k));
 for(const [lc,lr,rad] of spec.lakes||[])for(const t of tiles)if(!t.road&&Math.hypot(t.c-lc,t.r-lr)<=rad+(rand()-.5)*.5)t.terrain='water';
 for(const s of spec.slow||[])for(const t of tiles)if(t.road&&t.terrain==='road'&&t.pd[s.path]!=null&&t.pd[s.path]>=s.from&&t.pd[s.path]<=s.to)t.terrain=s.type;
 const roads=tiles.filter(t=>t.road);
 for(const t of tiles)t.rd=Math.min(...roads.map(q=>Math.max(Math.abs(q.c-t.c),Math.abs(q.r-t.r))));
 const free=()=>tiles.filter(t=>t.terrain==='grass');
 // High ground goes where it overlooks the most road, never two side by side.
  // High ground (the only places for ranged characters): tiles overlooking the most road, beside it first, never two sharing an edge.
 const chosen=[];for(const t of free().filter(t=>t.rd<=2).map(t=>({t,s:roads.filter(q=>Math.hypot(q.c-t.c,q.r-t.r)<=2.6).length+(t.rd===1?4:0)+rand()*2})).sort((a,b)=>b.s-a.s)){if(chosen.length>=spec.high)break;if(chosen.some(q=>Math.abs(q.c-t.t.c)+Math.abs(q.r-t.t.r)<=1))continue;t.t.terrain='high';chosen.push(t.t);}
 const scatter=(n,terrain,minRd)=>{const pool=free().filter(t=>t.rd>=minRd);for(let i=0;i<n&&pool.length;i++)pool.splice(Math.floor(rand()*pool.length),1)[0].terrain=terrain;};
 scatter(spec.cliff||0,'cliff',2);scatter(spec.prop||0,'prop',2);scatter(spec.rock||0,'rock',2);scatter(spec.forest||0,'forest',1);
 for(const t of tiles){t.alt=t.terrain==='grass'&&rand()<.3;t.h=t.terrain==='high'?.45:t.terrain==='cliff'?.85+rand()*.5:t.terrain==='water'?-.2:t.terrain==='bridge'?-.02:t.road?-.07:t.terrain==='prop'||t.terrain==='rock'?.04:rand()*.07;t.v=rand();}
 // A painted background can hide a cell (e.g. behind the crystal): turn it into plain ground after everything else is grown, so the rest stays the same.
 for(const [c,r] of spec.noHigh||[]){const t=tiles.find(q=>q.c===c&&q.r===r);if(t&&t.terrain==='high'){t.terrain='grass';t.h=.03;}}
 // highAt: the pedestals placed by hand (spread over the whole field, 1.7.2); every grown high cell becomes grass first
 if(spec.highAt){for(const t of tiles)if(t.terrain==='high'){t.terrain='grass';t.h=.03;}for(const [c,r] of spec.highAt){const t=tiles.find(q=>q.c===c&&q.r===r);if(t&&!t.road){t.terrain='high';t.h=.45;}}}
 // Where each road enters the field: the gate tile, clamped inside.
 const gates=paths.map(p=>({x:Math.max(0,Math.min(W-1,p.wp[0][0])),y:Math.max(0,Math.min(H-1,p.wp[0][1]))}));
 return {id,w:W,h:H,tiles,tile,paths,posAt,gates,scene:D.SCENES[spec.scene],sceneId:spec.scene,seed:spec.seed};
}
const BLOCKED={water:1,rock:1,cliff:1,prop:1};
const TERRAIN_NAME={grass:'평지',road:'길',high:'고지대',forest:'수풀',water:'물',rock:'바위',cliff:'절벽',prop:'구조물',swamp:'늪',sand:'모래',bridge:'다리'};

function createSim(opts){
 const chapter=D.CHAPTERS[opts.chapter||0],map=buildMap(chapter.map),snap=opts.snapshot||null;
 // Arca legacies: permanent bonuses earned by clearing chapters ({id: times taken}).
 const legacy=opts.legacy||{},L=k=>legacy[k]||0,freshLife=chapter.life+2*L('life');
 const S={chapter,chapterIndex:opts.chapter||0,map,time:0,phase:'prep',prep:0,battle:snap?snap.battle:0,gold:snap?snap.gold:chapter.startGold+60*L('startGold'),life:snap?snap.life:freshLife,maxLife:snap?snap.maxLife:freshLife,legacy,soldierCap:chapter.soldiers+L('command'),
  units:[],enemies:[],queue:[],events:[],mods:{burn:0,soldierCost:0,heroBlock:0,bounty:0,haste:0,range:0,cdr:0,rankCost:0,armor:0,grip:0},blessings:snap?snap.blessings.slice():[],offer:null,fortress:0,
  hero:{},nextId:1,leaks:0,leaksTotal:snap?snap.leaksTotal:0,kills:snap?snap.kills||0:0,rand:seeded((opts.seed??20261117)+(snap?snap.battle*7919:0)),acc:0,pending:[],potions:snap&&snap.potions!=null?snap.potions:POTIONS,lastUlt:-99,chain:0,vantage:[],shard:null,shardIn:SHARD_FIRST,stats:snap&&snap.stats?JSON.parse(JSON.stringify(snap.stats)):{dealt:{},healed:0,healedBy:{},ults:0,goldEarned:0,goldSpent:0,time:0}};
 // Chapter record for the clear summary (kept in the snapshot so a resumed chapter keeps it).
 for(const [k,v] of Object.entries({dealt:{},healed:0,healedBy:{},ults:0,goldEarned:0,goldSpent:0,time:0}))if(S.stats[k]==null)S.stats[k]=v;
 S.mods.rankCost+=.08*L('rankDisc');S.mods.bounty+=.1*L('bounty');
 for(const id of S.blessings){const b=D.BLESSINGS.find(v=>v.id===id);if(b?.mod)for(const k in b.mod)S.mods[k]+=b.mod[k];}
 for(const id of chapter.roster)if(D.UNITS[id].kind==='hero')S.hero[id]={cd:0,keep:null};
 const emit=e=>{S.events.push(e);};
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

 // ── Characters ──
 const defOf=u=>D.UNITS[u.def];
 function kitOf(def,rank,choice){const k={list:[],ult:def.ult||null,ultBoost:false,auras:[],block:def.block,haste:0,splash:0,eva:0,counter:0};
  const take=e=>{if(e.skills)k.list.push(...e.skills);if(e.ult)k.ult=e.ult;if(e.ultBoost)k.ultBoost=true;if(e.aura)k.auras.push(e.aura);if(e.swap){const j=k.list.indexOf(e.swap[0]);if(j>=0)k.list[j]=e.swap[1];}
   const p=e.props;if(p){if(p.blockBonus)k.block+=p.blockBonus;if(p.haste)k.haste+=p.haste;if(p.splash)k.splash=p.splash;if(p.eva)k.eva=p.eva;if(p.counter)k.counter=p.counter;}};
  for(let i=0;i<rank;i++){const e=def.ranks[i];if(!e)continue;take(e);if(e.choice&&choice&&e.choice[choice])take(e.choice[choice]);}
  return k;}
 function refresh(u){const def=defOf(u),m=1+D.RANK_STAT*(u.rank-1),g=1+D.RANK_GUARD*(u.rank-1),kit=kitOf(def,u.rank,u.choice),t=map.tile(u.c,u.r),oldMax=u.maxHp||0;
  const {pw,hpm}=D.legacyScale(u.def,legacy);
  u.maxHp=Math.round(def.hp*m*hpm);u.hp=oldMax?Math.min(u.maxHp,u.hp+(u.maxHp-oldMax)):u.maxHp;u.atk=def.atk*m*pw;u.mag=def.mag*m*pw;u.arm=def.def*g;u.res=def.res*g;
  u.interval=(1.6-def.spd*.03)*(def.melee?D.MELEE_INTERVAL:D.RANGED_INTERVAL)/(1+S.mods.haste+kit.haste);u.block=t.road?kit.block+(def.kind==='hero'&&def.melee?S.mods.heroBlock:0):0;u.splash=kit.splash;u.auras=kit.auras;u.ult=kit.ult;u.ultBoost=kit.ultBoost;u.eva=kit.eva;u.counter=kit.counter;
  u.onHigh=t.terrain==='high';u.vantage=!!(S.vantage&&S.vantage.some(v=>v.c===u.c&&v.r===u.r));u.range=def.range+(def.melee?0:(u.onHigh?.5:0)-(t.terrain==='forest'?.5:0)+S.mods.range+(u.vantage?.5:0));if(u.vantage&&def.melee&&u.block)u.block+=1;
  const old=u.skills||[];u.skills=kit.list.map(id=>old.find(s=>s.id===id)||{id,cd:1.5});}
 function roadGap(a,b){if(a===b)return 0;let best=Infinity;for(const p in a.pd)if(b.pd[p]!=null)best=Math.min(best,Math.abs(a.pd[p]-b.pd[p]));if(best<Infinity)return best;
  const seen=new Map([[a,0]]),q=[a];while(q.length){const t=q.shift(),dd=seen.get(t);if(t===b)return dd;for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=map.tile(t.c+dc,t.r+dr);if(n&&n.road&&!seen.has(n)){seen.set(n,dd+1);q.push(n);}}}return Infinity;}
 const costOf=(def,mult)=>{const d=D.UNITS[def];return Math.round(d.cost*mult*(1-(d.kind==='soldier'?S.mods.soldierCost:0)));};
 const deployCost=def=>S.hero[def]?.keep?0:costOf(def,D.RANK_COST[0]);
 function rankCost(u){const d=defOf(u);return u.rank>=d.maxRank?null:Math.round(costOf(u.def,D.RANK_COST[u.rank])*(d.kind==='soldier'?.92:1)*(1-S.mods.rankCost));}
 // Heroes: every joined hero may stand on the field. Soldiers: limited slots per chapter.
 const soldierCount=()=>S.units.filter(u=>defOf(u).kind==='soldier').length;
 const slotFree=def=>D.UNITS[def]?.kind!=='soldier'||soldierCount()<S.soldierCap;
 function canDeploy(def,c,r){const d=D.UNITS[def],t=map.tile(c,r);if(!d||!t)return '배치할 수 없는 곳입니다';
  if(S.phase!=='prep'&&S.phase!=='battle')return '지금은 배치할 수 없습니다';
  if(BLOCKED[t.terrain])return `${TERRAIN_NAME[t.terrain]}에는 배치할 수 없습니다`;
  if(S.units.some(u=>u.c===c&&u.r===r))return '이미 다른 동료가 있습니다';
  if(!d.melee&&t.terrain!=='high')return '원거리 캐릭터는 올라온 발판(고지대)에만 설 수 있습니다';
  if(t.terrain==='high'&&d.melee)return '고지대에는 원거리 캐릭터만 설 수 있습니다';
  // No melee on the road right by a monster gate, so monsters are not held the moment they appear.
  if(d.melee&&t.road&&map.gates.some(g=>Math.hypot(g.x-c,g.y-r)<D.GATE_GAP))return `적 출현 문 ${D.GATE_GAP}칸 안에는 근접 캐릭터를 세울 수 없습니다`;
  // Melee characters on the road must keep their distance, so monsters cannot be held in one spot by a crowd.
  // Counted ALONG the road (1.7.5), not in a straight line: two bends of the road side by side do not block each other.
  if(d.melee&&t.road&&S.units.some(u=>defOf(u).melee&&map.tile(u.c,u.r).road&&roadGap(map.tile(u.c,u.r),t)<D.MELEE_GAP))return `길 위의 근접 캐릭터끼리는 길을 따라 ${D.MELEE_GAP}칸 이상 떨어져야 합니다`;
  if(t.road)for(const p in t.pd){const first=map.paths[p].wp[0],inside=first[0]>=0&&first[1]>=0&&first[0]<map.w&&first[1]<map.h;if(t.pd[p]<(inside?1:2)||t.pd[p]>map.paths[p].total-1)return '적 출현 문과 수정 바로 앞은 비워 둬야 합니다';}
  if(d.kind==='hero'){if(S.units.some(u=>u.def===def))return `${d.name}은(는) 이미 전장에 있습니다`;if(S.hero[def].cd>0)return `${d.name} 재배치 대기 중`;}
  if(!slotFree(def))return `병사 자리(${S.soldierCap}칸)가 모두 찼습니다`;
  if(S.gold<deployCost(def))return '골드가 부족합니다';
  return null;}
 function makeUnit(def,c,r,keep,cost){const u={id:S.nextId++,def,c,r,x:c,y:r,rank:keep?keep.rank:1,choice:keep?keep.choice:null,invested:keep?keep.invested:cost,cd:.4,ultCd:0,engaged:[],hp:0,maxHp:0,buff:1,defBuff:1,hasteBuff:1,st:{},taunt:0,calm:0,face:{dx:0,dy:1},faceT:-9};refresh(u);if(u.ult)u.ultCd=keep&&keep.ultCd!=null?Math.min(keep.ultCd,ultTime(u)):ultTime(u);u.hp=u.maxHp;S.units.push(u);return u;}
 // Full charge time of a unit's 필살기 (seconds of battle).
 function ultTime(u){return u.ult?D.SKILLS[u.ult].cd*(1-.15*L('ultCdr'))*(u.ultBoost?.85:1):0;}
 // Elements a hero can give its 필살기: its own skills', its basic attack's and the 필살기's own.
 function ultElements(u){if(!u.ult)return [];const s=D.SKILLS[u.ult];if(s.type==='heal'||s.type==='fortress')return [];const set=[];const add=e=>{if(e&&!set.includes(e))set.push(e);};add(s.element);add(defOf(u).element);for(const k of u.skills)add(D.SKILLS[k.id].element);return set.length?set:[null];}
 function deploy(def,c,r){const err=canDeploy(def,c,r);if(err)return err;const keep=S.hero[def]?.keep,cost=deployCost(def);S.gold-=cost;S.stats.goldSpent+=cost;const u=makeUnit(def,c,r,keep,cost);if(!keep&&S.hero[def]&&L('starter')&&u.rank<2){u.rank=2;refresh(u);u.hp=u.maxHp;}if(S.hero[def])S.hero[def].keep=null;emit({t:'deploy',id:u.id});return null;}
 const needsChoice=u=>{const k=defOf(u).ranks[u.rank];return !!(k&&k.choice);};
 function rankUp(id,choice){const u=S.units.find(v=>v.id===id);if(!u)return '없는 캐릭터입니다';const cost=rankCost(u);if(cost==null)return '최대 랭크입니다';if(S.gold<cost)return '골드가 부족합니다';
  if(needsChoice(u)){if(!defOf(u).ranks[u.rank].choice[choice])return '각인을 선택하세요';u.choice=choice;}
  S.gold-=cost;S.stats.goldSpent+=cost;u.invested+=cost;u.rank++;refresh(u);emit({t:'rank',id:u.id});return null;}
 function release(u){for(const e of S.enemies)if(e.engagedBy===u.id)e.engagedBy=null;u.engaged.length=0;}
 function withdraw(id){const i=S.units.findIndex(v=>v.id===id);if(i<0)return '없는 캐릭터입니다';const u=S.units[i],back=Math.round(u.invested*D.REFUND);S.gold+=back;release(u);S.units.splice(i,1);
  if(S.hero[u.def]){S.hero[u.def].cd=(defOf(u).cooldown||D.WITHDRAW_CD)*(1-.25*L('redeploy'));S.hero[u.def].keep=null;}emit({t:'withdraw',id:u.id,gold:back});return null;}
 function down(u){release(u);S.units.splice(S.units.indexOf(u),1);u.gone=true;if(S.hero[u.def]){S.hero[u.def].cd=Math.round((defOf(u).cooldown?15:D.DOWN_CD)*(1-.25*L('redeploy')));S.hero[u.def].keep={rank:u.rank,choice:u.choice,invested:u.invested,ultCd:u.ult?ultTime(u)-(ultTime(u)-u.ultCd)/2:null};}emit({t:'down',id:u.id,def:u.def,x:u.x,y:u.y,cd:S.hero[u.def]?.cd});}
 function allyStatus(u,status){if(S.fortress>0||u.gone)return;u.st[status]={burn:3,poison:5,freeze:2.5,stun:1.5,silence:5}[status]||3;emit({t:'ustatus',unit:u.id,status,x:u.x,y:u.y});}
 // Damage to a character. src = attacking monster (for counters).
 function hurt(u,raw,magic,src,melee){if(u.gone)return;if(u.eva&&S.rand()<u.eva){emit({t:'dodge',x:u.x,y:u.y});return;}
  const guard=(magic?u.res:u.arm)*u.defBuff;let dmg=Math.max(raw-guard*.5,raw*.2)*(1-S.mods.armor)*(S.fortress>0?.4:1);dmg=Math.max(1,Math.round(dmg));u.hp-=dmg;u.calm=4;emit({t:'hurt',unit:u.id,from:src?.id,x:u.x,y:u.y,v:dmg});
  if(u.counter&&melee&&src&&!src.dead)hit(u,src,{type:'physical',power:u.counter,element:'fire',skill:true});
  if(u.hp<=0)down(u);}

 // ── Monsters ──
 function spawn(o){const b=chapter.battles[S.battle],[hpT,atkT]=b.tune,cfg=o.flags==='boss'?chapter.boss:null,clone=o.flags==='clone',kind=cfg?cfg.base:clone?o.parent.kind:o.kind,base=D.MONSTERS[kind],elite=o.flags==='elite',trait=D.MODEL_TRAITS[base.model]||{},parent=o.parent||null;
  let hp=base.hp*hpT*(elite?4:1),gold=Math.max(2,Math.round(base.hp*.2))*(elite?4:1),speed=base.move*D.MOVE_SPEED,gen=0,lifeCost=elite?2:1,name=(elite?'정예 ':'')+base.name,scale=elite?1.3:null,canSplit=!!trait.split;
  if(cfg){hp=(900+240*chapter.index)*cfg.hp*chapter.bossScale*hpT/2;speed=cfg.move*D.MOVE_SPEED;gold=60+chapter.index*15;name=cfg.name;scale=cfg.scale;lifeCost=99;canSplit=!!cfg.split;}
  if(clone){hp=parent.maxHp*parent.cfg.clones.hp;speed=parent.speed*1.1;gold=25;name=parent.name+'의 분신';scale=parent.scale*.75;lifeCost=5;canSplit=false;}
  else if(parent&&o.split){gen=parent.gen+1;hp=parent.maxHp*(parent.bossKin?.3:.35);gold=parent.bossKin?Math.max(2,Math.round(parent.gold*.2)):1;speed=base.move*D.MOVE_SPEED*(parent.bossKin&&gen<3?.9:1.15);
   if(parent.bossKin){scale=gen===1?1.5:gen===2?1:.72;lifeCost=gen===1?3:1;name=gen===1?'큰 '+base.name:gen===2?base.name:'꼬마 '+base.name;canSplit=gen<3;}else{scale=.72;name='꼬마 '+base.name;canSplit=false;}}
  if(o.minion)gold=Math.max(1,Math.round(gold*.4));
  const model=clone?parent.model:cfg&&cfg.model?cfg.model:base.model,bossy=!!cfg;
  const e={id:S.nextId++,kind,name,model,color:clone?parent.color:base.color,element:(cfg&&cfg.element)||(clone?parent.element:base.element)||null,immunity:cfg?cfg.immunity||null:clone?null:base.immunity||null,
   flying:bossy||clone?false:!!trait.flying,ghost:bossy?!!cfg.ghost:clone?false:!!trait.ghost,ranged:!bossy&&!clone&&!!trait.ranged,magic:!!base.magic,inflict:bossy||clone?null:trait.inflict||base.status||null,
   regen:bossy?cfg.regen||0:clone?0:trait.regen||0,shield:bossy?cfg.shield||0:clone?0:trait.shield||0,eva:base.eva||0,
   hp,maxHp:hp,atk:(base.magic?base.mag:base.atk)*atkT*(elite?1.4:1)*(cfg?cfg.atk:clone?1.5:1),def:base.def*(cfg?1.15:1),res:base.res*(cfg?1.15:1),range:base.range*.8,speed,gold,elite,boss:bossy,bossId:cfg?cfg.bossId:clone?parent.bossId:null,bossKin:bossy||!!(parent&&parent.bossKin&&o.split),cfg,gen,scale,lifeCost,
   canSplit,slots:bossy?2:trait.slots||1,path:o.path||0,dist:o.at??0,lane:(S.rand()-.5)*.44,engagedBy:null,cd:.6+S.rand()*.6,rcd:1+S.rand()*1.5,st:{},poison:0,x:0,y:0,dx:0,dy:1,timers:{wave:4,summon:6,beam:5,fly:0},phase:0,cloned:false};
  if(bossy&&cfg.fly){e.flying=true;e.timers.fly=cfg.fly.air;}
  const p=map.posAt(e.path,e.dist,e.lane);e.x=p.x;e.y=p.y;e.dx=p.dx;e.dy=p.dy;S.enemies.push(e);emit({t:'spawn',id:e.id,boss:bossy});return e;}
 function killEnemy(e,by){e.hp=0;e.dead=true;const steal=by&&defOf(by).steal?defOf(by).steal:0,gold=Math.round(e.gold*(1+S.mods.bounty+steal));S.gold+=gold;S.stats.goldEarned+=gold;S.kills++;emit({t:'die',id:e.id,x:e.x,y:e.y,gold,boss:e.boss,model:e.model,steal:!!steal});
  if(e.canSplit)for(const off of [-.25,.2])spawn({kind:e.kind,path:e.path,at:Math.max(0,e.dist+off),parent:e,split:true});}
 function addStatus(e,status){const tough=e.boss||(e.bossKin&&e.gen===1);
  if(status==='burn')e.st.burn=4;
  else if(status==='poison'){e.st.poison=6;e.poison=Math.min(3,e.poison+1);}
  else if(status==='freeze'){if(tough)e.st.slow=Math.max(e.st.slow||0,2);else e.st.freeze=1.5;}
  else if(status==='stun')e.st.stun=tough?.5:1.2;
  else if(status==='sleep'){if(tough)e.st.slow=Math.max(e.st.slow||0,2);else e.st.sleep=4;}
  else if(status==='slow')e.st.slow=Math.max(e.st.slow||0,3);
  else if(status==='silence')e.st.silence=tough?2.5:6;
  else if(status==='defdown')e.st.defdown=6;
  else if(status==='root')e.st.root=tough?.6:e.st.root||0;
  emit({t:'status',id:e.id,status});}
 // One hit on a monster. o = {type,power,element,skill,ignore}. Returns the damage dealt.
 function hit(src,e,o){if(e.dead)return 0;const magic=o.type==='magic',sd=defOf(src);
  if(!magic&&!o.skill&&e.eva&&S.rand()<e.eva){emit({t:'dmg',id:e.id,x:e.x,y:e.y,v:0,tag:'miss'});return 0;}
  const A=(magic?src.mag:src.atk)*(src.buff||1),Dv=(magic?e.res:e.def)*(1-(o.ignore||0)),raw=A*(o.power||1);let dmg=Math.max(raw-Dv*.5,raw*.2),tag=null;
  const aff=affinity(o.element,e.element),affM=aff>1?aff+.1*L('affinity'):aff;dmg*=affM;if(aff>1)tag='weak';else if(aff<1)tag='resist';if(src.vantage)dmg*=VANTAGE_DMG;
  if(e.immunity==='physical'&&!magic){dmg*=o.element?.6:.35;tag='resist';}else if(e.immunity==='magic'&&magic){dmg*=e.boss?.5:.35;tag='resist';}
  if(e.st.defdown&&!magic)dmg*=1.25;if(e.shielded)dmg*=1-e.shielded;
  if(sd.highDmg&&src.onHigh)dmg*=1+sd.highDmg;
  let combo=null;
  if(sd.behind){const t=map.tile(src.c,src.r),at=t.pd[e.path];if(at!=null&&e.dist>at+.05){dmg*=1+sd.behind;combo='암습';}}
  if(o.skill&&!magic&&(e.st.freeze||e.st.slow)){dmg*=1.3;combo='파쇄';}
  if(e.st.sleep){dmg*=2;delete e.st.sleep;combo='기습';}
  const crit=S.rand()<(sd.crit||0);if(crit)dmg*=1.5;
  dmg=Math.max(1,Math.round(dmg));e.hp-=dmg;S.stats.dealt[src.def]=(S.stats.dealt[src.def]||0)+dmg;emit({t:'dmg',id:e.id,x:e.x,y:e.y,v:dmg,crit,tag,combo,skill:!!o.skill,ult:!!o.ult,pct:Math.min(1,dmg/e.maxHp),aff:affM!==1?Math.round(dmg-dmg/affM):0,element:o.element||null,chain:o.chain||0});
  if(e.hp<=0)killEnemy(e,src);return dmg;}
 function pickTarget(u,range,canFly,strong,element){let best=null;const reach=range+.35,min=defOf(u).minRange||0;
  for(const e of S.enemies){if(e.dead)continue;if(e.flying&&!canFly)continue;const d=dist(u,e);if(e.engagedBy!==u.id&&d>reach)continue;if(d<min&&e.engagedBy!==u.id)continue;const aff=element?affinity(element,e.element):1,score=(strong?e.hp:(e.engagedBy===u.id?1000:0)+(e.boss?400:0)+(e.st.sleep?-500:0)+e.dist)+(aff>1?300:aff<1?-300:0);if(!best||score>best.score)best={e,score};}
  return best?.e||null;}
 function heal(u,target,power){const amount=Math.round(u.mag*power*(u.buff||1)),before=target.hp;target.hp=Math.min(target.maxHp,target.hp+amount);S.stats.healed+=target.hp-before;S.stats.healedBy[u.def]=(S.stats.healedBy[u.def]||0)+target.hp-before;emit({t:'heal',unit:target.id,x:target.x,y:target.y,v:Math.round(target.hp-before)});}
 // Tries to cast one skill; returns true if it was used.
 function tryCast(u,sk,point,forced){const s=D.SKILLS[sk.id],def=defOf(u),pm=sk.ult&&u.ultBoost?1.3:1,range=sk.ult&&!def.melee?99:s.range?s.range+(u.range-def.range):u.range,done=()=>{sk.cd=s.cd*(1-S.mods.cdr);return true;},fx=(x,y,extra)=>emit({t:'skill',unit:u.id,skill:sk.id,name:s.name,x,y,area:s.area||0,element:s.element,fx:s.fx,from:{x:u.x,y:u.y},...extra});
  if(s.type==='heal'){if(s.all){fx(u.x,u.y,{area:3});for(const a of S.units){heal(u,a,s.power*pm);if(s.cleanse)a.st={};}return done();}
   let best=null;for(const a of S.units){if(dist(u,a)>range+.35)continue;const ratio=a.hp/a.maxHp;if(ratio<.85&&(!best||ratio<best.hp/best.maxHp))best=a;}if(!best)return false;fx(best.x,best.y);heal(u,best,s.power);return done();}
  if(s.type==='cleanse'){const a=S.units.find(v=>dist(u,v)<=range+.35&&Object.keys(v.st).length);if(!a)return false;a.st={};fx(a.x,a.y);emit({t:'cleanse',unit:a.id,x:a.x,y:a.y});return done();}
  if(s.type==='taunt'){const near=S.enemies.filter(e=>!e.dead&&!e.flying&&dist(u,e)<=s.area+.2);if(!near.length)return false;fx(u.x,u.y);u.taunt=4;for(const e of near){e.st.root=s.hold;addStatus(e,'root');}return done();}
  if(s.type==='fortress'){fx(u.x,u.y);S.fortress=s.dur*pm;for(const a of S.units)a.st={};for(const e of S.enemies)if(!e.dead&&!e.flying&&dist(u,e)<=s.area+.2)addStatus(e,'stun');return done();}
  const target=s.self||point?null:pickTarget(u,range,s.type==='magic'||!def.melee||!!s.range,s.pick==='strong',sk.element||s.element);
  if(!s.self&&!point&&!target)return false;
  if(s.self&&!forced&&!S.enemies.some(e=>!e.dead&&dist(u,e)<=s.area+.2&&(!e.flying||s.ult)))return false;
  const el=sk.element!==undefined?sk.element:s.element,status=sk.ult&&sk.element!==undefined?ULT_STATUS[el]||null:s.status,chain=sk.chain||0,
   centre=s.self?{x:u.x,y:u.y}:point||{x:target.x,y:target.y},o={type:s.type,power:s.power*pm*(1+.15*Math.min(2,chain))*(sk.ult&&el==='light'&&sk.element!==undefined?1.2:1),element:el,skill:true,ignore:s.ignore,ult:!!s.ult,chain};
  fx(centre.x,centre.y,{element:el,chain});
  // 1.7.12: damage lands when the spell arrives (meteor falls 0.5 s, bolts/blasts fly ~0.12–0.14 s), not when it is cast
  later(FLIGHT[s.fx]||0,()=>{
  const victims=s.area?S.enemies.filter(e=>!e.dead&&Math.hypot(e.x-centre.x,e.y-centre.y)<=s.area+.2&&(s.type==='magic'||!e.flying||s.ult||!def.melee)):target&&!target.dead?[target]:[];
  for(const e of victims){const burning=!!e.st.burn;hit(u,e,o);if(e.dead)continue;
   if(status&&(sk.ult||S.rand()<(s.chance??1)))addStatus(e,status);
   if(s.knockback&&!e.boss)e.dist=Math.max(0,e.dist-s.knockback);
   // Combo 확산: a wind skill fans the flames to neighbours.
   if(burning&&s.element==='wind'){let spread=0;for(const n of S.enemies)if(!n.dead&&n!==e&&!n.st.burn&&dist(n,e)<=1.3){addStatus(n,'burn');spread++;}if(spread)emit({t:'combo',x:e.x,y:e.y,name:'확산'});}}});
  if(!s.self){u.face={dx:centre.x-u.x,dy:centre.y-u.y};u.faceT=S.time;}return done();}
 function ult(id,x,y,element){const u=S.units.find(v=>v.id===id);if(!u||!u.ult)return '필살기가 없습니다';if(u.ultCd>0)return '아직 준비되지 않았습니다';if(S.phase!=='battle')return '전투 중에만 쓸 수 있습니다';if(u.st.freeze||u.st.stun||u.st.silence)return '지금은 쓸 수 없는 상태입니다';
  const s=D.SKILLS[u.ult];if(s.aim&&(x==null||y==null))return '위치를 지정하세요';const els=ultElements(u);if(element===undefined||!els.includes(element))element=els[0];
  // 연계: another 필살기 within CHAIN_WINDOW seconds of the last one is stronger (+15%, then +30%).
  const chain=S.time-S.lastUlt<=CHAIN_WINDOW?S.chain+1:0;
  const holder={id:u.ult,cd:0,ult:true,chain};if(els.length&&s.type!=='heal'&&s.type!=='fortress')holder.element=element;if(!tryCast(u,holder,s.aim?{x,y}:null,true))return '사거리 안에 적이 없습니다';
  u.ultCd=ultTime(u);S.lastUlt=S.time;S.chain=chain;S.stats.ults++;emit({t:'ult',unit:u.id,name:s.name,element:holder.element??null,chain});return null;}
 // ── 명당 (vantage spots): each battle one high-ground tile and one road tile shine; a character standing there deals +20%, charges its
 // 필살기 ×1.5 and gets range +0.5 (ranged) or holds one more monster (melee). Picked at random from the better half of the candidates.
 function pickVantage(){const roads=map.tiles.filter(t=>t.road),cover=t=>roads.filter(q=>Math.hypot(q.c-t.c,q.r-t.r)<=3.6).length,
   // 1.7.2: away from where the characters already stand, so the spot pulls the line apart instead of piling it up
   room=(t,melee)=>{const us=S.units.filter(u=>!melee||defOf(u).melee);return us.length?Math.min(4,Math.min(...us.map(u=>Math.hypot(u.c-t.c,u.r-t.r))))*2:0;},
   highs=map.tiles.filter(t=>t.terrain==='high');
  // 1.7.4: first the better half by road cover only, then among those the ones farthest from the characters already placed
  const pickFrom=list=>{if(!list.length)return null;list.sort((a,b)=>b.s-a.s);let top=list.slice(0,Math.max(2,Math.ceil(list.length/3)));top.sort((a,b)=>room(b.t,b.melee)-room(a.t,a.melee));top=top.slice(0,Math.max(1,Math.ceil(top.length/2)));return top[Math.floor(S.rand()*top.length)].t;};
  const high=pickFrom(map.tiles.filter(t=>t.terrain==='high').map(t=>({t,s:cover(t)})));
  const melee=pickFrom(roads.filter(t=>t.terrain!=='bridge'&&!map.gates.some(g=>Math.hypot(g.x-t.c,g.y-t.r)<D.GATE_GAP)).filter(t=>{for(const p in t.pd){const tot=map.paths[p].total,f=t.pd[p]/tot;if(f<.3||f>.62)return false;}return true;})
   .map(t=>({t,melee:true,s:Object.keys(t.pd).length*3+highs.filter(h=>Math.hypot(h.c-t.c,h.r-t.r)<=2.9).length*2+(t.terrain==='swamp'||t.terrain==='sand'?1:0)})));
  S.vantage=[high,melee].filter(Boolean).map(t=>({c:t.c,r:t.r,kind:t.terrain==='high'?'ranged':'melee'}));for(const u of S.units)refresh(u);emit({t:'vantage',spots:S.vantage});}
 // ── 수정 조각 (crystal shard): every SHARD_EVERY s of battle a shard falls; the player gives it to a hero (giveShard), who then charges
 // its 필살기 ×2 for SHARD_TIME s. The screen gives a hero at random after 5 s; the sim does so itself after SHARD_WAIT s (bot, safety).
 // 체력 물약 (1.7.17): POTIONS per chapter, in battle only; heals half of max HP and clears bad states; one ally at most every POTION_CD s.
 function usePotion(id){if(S.phase!=='battle')return '전투 중에만 쓸 수 있습니다';if(S.potions<=0)return '물약이 없습니다';const u=S.units.find(v=>v.id===id);if(!u)return '없는 동료입니다';
  if(u.potionAt!=null&&S.time-u.potionAt<POTION_CD)return `${Math.ceil(POTION_CD-(S.time-u.potionAt))}초 뒤에 다시 쓸 수 있습니다`;if(u.hp>=u.maxHp-.5&&!Object.keys(u.st).length)return '체력이 가득합니다';
  const before=u.hp;u.hp=Math.min(u.maxHp,u.hp+u.maxHp*POTION_HEAL);u.st={};u.potionAt=S.time;S.potions--;emit({t:'potion',unit:u.id,x:u.x,y:u.y,v:Math.round(u.hp-before),left:S.potions});return null;}
 function giveShard(id){if(!S.shard)return '수정 조각이 없습니다';let u=id!=null?S.units.find(v=>v.id===id&&v.ult):null;
  if(!u){const list=S.units.filter(v=>v.ult);if(!list.length){S.shard=null;return null;}u=list[Math.floor(S.rand()*list.length)];}
  u.shardT=SHARD_TIME;S.shard=null;emit({t:'shardGiven',unit:u.id,x:u.x,y:u.y});return null;}

 // ── Battle flow ──
 function loadBattle(){const b=chapter.battles[S.battle];S.queue=[];for(const [kind,count,gap,delay,flags,path] of b.waves)for(let i=0;i<count;i++)S.queue.push({t:delay+i*gap,kind,flags:flags||null,path:path||0});S.queue.sort((a,b2)=>a.t-b2.t);S.battleTime=0;S.leaks=0;S.fortress=0;}
 function preview(i=S.battle){const b=chapter.battles[i];if(!b)return [];const out=[];for(const [kind,count,,,flags] of b.waves){const boss=flags==='boss'?chapter.boss:null,m=D.MONSTERS[boss?boss.base:kind],trait=D.MODEL_TRAITS[m.model]||{};
   const same=out.find(o=>!boss&&o.kind===kind&&o.elite===(flags==='elite'));if(same){same.count+=count;continue;}
   out.push({kind,name:boss?boss.name:(flags==='elite'?'정예 ':'')+m.name,count,element:(boss&&boss.element)||m.element||null,flying:boss?!!boss.fly:!!trait.flying,immunity:boss?boss.immunity||null:m.immunity||null,elite:flags==='elite',boss:!!boss,note:boss?boss.hint:trait.note||''});}return out;}
 function startBattle(){if(S.phase!=='prep')return;const bonus=S.battle>0?Math.floor(S.prep):0;if(bonus>0){S.gold+=bonus;S.stats.goldEarned+=bonus;emit({t:'bonus',gold:bonus,why:'조기 출발'});}S.phase='battle';loadBattle();emit({t:'battleStart',battle:S.battle});}
 function enterPrep(){S.pending=[];S.phase='prep';S.prep=PREP_TIME;S.shard=null;for(const u of S.units){u.hp=u.maxHp;u.st={};release(u);}emit({t:'prep',battle:S.battle});}  // 명당 stays for the whole chapter (1.7.20)
 function finishBattle(){const n=S.battle+1,clean=S.leaks===0,bonus=Math.round((30+n*8)*(clean?1.5:1));S.gold+=bonus;S.stats.goldEarned+=bonus;S.leaksTotal+=S.leaks;emit({t:'cleared',battle:S.battle,gold:bonus,clean});
  if(n>=chapter.battles.length){S.phase='won';emit({t:'won'});return;}
  S.battle=n;
  if(chapter.bless.includes(n)){const pool=D.BLESSINGS.filter(b=>!S.blessings.includes(b.id)),pick=[];while(pick.length<3+L('blessChoices')&&pool.length)pick.push(pool.splice(Math.floor(S.rand()*pool.length),1)[0].id);S.offer=pick;S.phase='bless';emit({t:'bless',offer:pick});}
  else enterPrep();}
 function chooseBlessing(id){if(S.phase!=='bless'||!S.offer.includes(id))return '선택할 수 없습니다';const b=D.BLESSINGS.find(v=>v.id===id);S.blessings.push(id);if(b.mod)for(const k in b.mod)S.mods[k]+=b.mod[k];if(b.life){S.life+=b.life;S.maxLife+=b.life;}if(b.gold)S.gold+=b.gold;
  for(const u of S.units)refresh(u);S.offer=null;enterPrep();return null;}

 function bossTick(e,dt){const c=e.cfg,T=e.timers,quiet=e.st.stun||e.st.freeze;
  if(c.regen)e.hp=Math.min(e.maxHp,e.hp+e.maxHp*c.regen*dt*(e.st.silence?0:1));
  if(c.fly){T.fly-=dt;if(T.fly<=0){e.flying=!e.flying;T.fly=e.flying?c.fly.air:c.fly.ground;emit({t:'bossFly',id:e.id,flying:e.flying,x:e.x,y:e.y});}}
  if(c.wave&&!quiet){T.wave-=dt;if(T.wave<=0){T.wave=c.wave.every;emit({t:'bossWave',id:e.id,x:e.x,y:e.y,r:c.wave.radius,name:c.wave.name,element:e.element});
    for(const u of S.units.slice())if(dist(u,e)<=c.wave.radius+.2){hurt(u,e.atk*c.wave.power*.45,true,e,false);if(!u.gone&&c.wave.status)allyStatus(u,c.wave.status);}}}
  if(c.summon){T.summon-=dt;if(T.summon<=0){T.summon=c.summon.every*(1-.2*e.phase);const kinds=[].concat(c.summon.kind);for(let i=0;i<Math.ceil(c.summon.count/2)+e.phase;i++)spawn({kind:kinds[Math.floor(S.rand()*kinds.length)],path:e.path,at:Math.max(0,e.dist-.5-i*.45),minion:true});emit({t:'bossSummon',id:e.id,x:e.x,y:e.y});}}
  if(c.beam){T.beam-=dt;if(!e.beamAt&&T.beam<=0&&S.units.length){const target=S.units.slice().sort((a,b)=>b.rank-a.rank||b.invested-a.invested)[0];e.beamAt={id:target.id,t:c.beam.delay};emit({t:'beamWarn',id:e.id,unit:target.id,name:c.beam.name,delay:c.beam.delay});}
   if(e.beamAt){e.beamAt.t-=dt;if(e.beamAt.t<=0){const u=S.units.find(v=>v.id===e.beamAt.id);emit({t:'beam',id:e.id,unit:e.beamAt.id,from:{x:e.x,y:e.y},to:u?{x:u.x,y:u.y}:null});if(u){hurt(u,e.atk*c.beam.power*.6,true,e,false);if(!u.gone)allyStatus(u,c.beam.status);}e.beamAt=null;T.beam=c.beam.every;}}}
  if(c.clones&&!e.cloned&&e.hp<=e.maxHp*c.clones.at){e.cloned=true;for(let i=0;i<c.clones.count;i++)spawn({flags:'clone',parent:e,path:e.path,at:Math.max(0,e.dist-.6-i*.5)});emit({t:'bossPhase',id:e.id,x:e.x,y:e.y,name:'분신'});}
  if(c.phases&&e.phase<c.phases.length&&e.hp<=e.maxHp*c.phases[e.phase]){e.phase++;e.speed*=1.2;T.summon=0;T.wave=Math.min(T.wave,1.5);emit({t:'bossPhase',id:e.id,x:e.x,y:e.y,name:`${e.phase+1}단계`});}}

 function later(delay,fn){if(delay<=0)fn();else S.pending.push({t:S.time+delay,fn});}
 function tick(dt){S.time+=dt;if(S.pending.length){const due=S.pending.filter(p=>p.t<=S.time);if(due.length){S.pending=S.pending.filter(p=>p.t>S.time);for(const p of due)p.fn();}}if(S.phase==='battle')S.stats.time+=dt;
  for(const id in S.hero)if(S.hero[id].cd>0)S.hero[id].cd=Math.max(0,S.hero[id].cd-dt);
  if(S.phase==='prep'){if(S.battle>0){S.prep-=dt;if(S.prep<=0){S.prep=0;startBattle();}}return;}
  if(S.phase!=='battle')return;
  if(S.fortress>0)S.fortress=Math.max(0,S.fortress-dt);
  if(S.shard){S.shard.wait-=dt;if(S.shard.wait<=0)giveShard(null);}else if((S.shardIn-=dt)<=0){S.shardIn=SHARD_EVERY;if(S.units.some(v=>v.ult)){S.shard={wait:SHARD_WAIT};emit({t:'shard'});}}
  S.battleTime+=dt;while(S.queue.length&&S.queue[0].t<=S.battleTime){const q=S.queue.shift();spawn({kind:q.kind,flags:q.flags,path:q.path});}
  // Auras from characters
  for(const u of S.units){u.buff=1;u.defBuff=1;u.hasteBuff=1;}
  for(const a of S.units)for(const au of a.auras)for(const u of S.units)if(Math.hypot(u.x-a.x,u.y-a.y)<=au.radius+.01){const k=au.stat==='atk'?'buff':au.stat==='def'?'defBuff':'hasteBuff';u[k]=Math.max(u[k],au.mult);}
  // Auras from monsters (shield, regrowth). Silence turns them off.
  for(const e of S.enemies)e.shielded=0;
  for(const a of S.enemies){if(a.dead||a.st.silence)continue;if(a.shield)for(const e of S.enemies)if(e!==a&&!e.boss&&dist(a,e)<=1.7)e.shielded=Math.max(e.shielded,a.shield);
   if(a.regen&&!a.boss)for(const e of S.enemies)if(!e.dead&&!e.boss&&dist(a,e)<=1.7&&e.hp<e.maxHp)e.hp=Math.min(e.maxHp,e.hp+e.maxHp*a.regen*dt);}
  // Who is holding whom: a melee character on the road slows up to `block` monsters walking through its tile.
  const alive=new Map(S.enemies.map(e=>[e.id,e])),inZone=(u,e)=>{const at=map.tile(u.c,u.r).pd[e.path];return at!=null&&e.dist>=at-ZONE_BACK&&e.dist<=at+ZONE_FRONT;};
  for(const u of S.units){if(!u.block){u.engaged.length=0;continue;}u.engaged=u.engaged.filter(id=>{const e=alive.get(id);if(e&&!e.dead&&!e.flying&&!e.ghost&&inZone(u,e))return true;if(e)e.engagedBy=null;return false;});}
  for(const e of S.enemies){if(e.dead||e.flying||e.ghost||e.engagedBy)continue;for(const u of S.units){if(!u.block||u.st.freeze||u.st.stun)continue;const used=u.engaged.reduce((n,id)=>n+(alive.get(id)?.slots||1),0);if(used+e.slots<=u.block&&inZone(u,e)){u.engaged.push(e.id);e.engagedBy=u.id;break;}}}
  // Monsters: statuses, movement, attacks
  for(const e of S.enemies.slice()){if(e.dead)continue;const st=e.st;
   if(st.burn){st.burn-=dt;const rate=(e.boss?.005:e.bossKin&&e.gen===1?.01:.02)*(1+S.mods.burn);e.hp-=e.maxHp*rate*dt;if(st.burn<=0)delete st.burn;}
   if(st.poison){st.poison-=dt;const rate=(e.boss?.003:.012)*e.poison*(1+S.mods.burn);e.hp-=e.maxHp*rate*dt;if(st.poison<=0){delete st.poison;e.poison=0;}}
   if(e.hp<=0){killEnemy(e,null);continue;}
   if(st.freeze){st.freeze-=dt;if(st.freeze<=0){delete st.freeze;st.slow=Math.max(st.slow||0,3);}}
   for(const k of ['stun','slow','defdown','sleep','silence','root'])if(st[k]){st[k]-=dt;if(st[k]<=0)delete st[k];}
   if(e.boss)bossTick(e,dt);if(e.dead)continue;
   const out=st.freeze||st.stun||st.sleep,holder=e.engagedBy?S.units.find(v=>v.id===e.engagedBy):null;
   if(holder&&!out){e.cd-=dt;if(e.cd<=0){e.cd=1.6;emit({t:'eattack',id:e.id,unit:holder.id});hurt(holder,e.atk*.5,e.magic,e,true);if(!holder.gone&&e.inflict&&S.rand()<.4)allyStatus(holder,e.inflict);}}
   if(e.ranged&&!out&&!(st.silence&&e.magic)){e.rcd-=dt;if(e.rcd<=0){let target=null,bd=1e9;for(const u of S.units){const d=dist(u,e);if(d>e.range+.3)continue;const score=u.taunt>0?d-100:d+(map.tile(u.c,u.r).terrain==='forest'?2:0);if(score<bd){bd=score;target=u;}}
     if(target){e.rcd=3;emit({t:'eshot',id:e.id,from:{x:e.x,y:e.y},to:{x:target.x,y:target.y},magic:e.magic,element:e.element});const dodge=map.tile(target.c,target.r).terrain==='forest'&&S.rand()<.3,roll=S.rand(),atk=e.atk;later(.2,()=>{if(target.gone||!S.units.includes(target))return;if(!dodge){hurt(target,atk*.2,e.magic,e.dead?null:e,false);if(!target.gone&&e.inflict&&roll<.25)allyStatus(target,e.inflict);}else emit({t:'dodge',x:target.x,y:target.y});});}else e.rcd=.4;}}
   if(!out&&!st.root){const t=map.tile(Math.round(e.x),Math.round(e.y)),ground=!e.flying&&t?(t.terrain==='swamp'?.7:t.terrain==='sand'?.82:1):1,held=holder?(e.boss?.55:D.ENGAGE_SLOW)*(1-S.mods.grip):1;
    e.dist+=e.speed*(st.slow?.65:1)*ground*held*dt;
    if(e.dist>=map.paths[e.path].total){e.dead=true;e.leaked=true;S.life-=e.lifeCost;S.leaks++;emit({t:'leak',id:e.id,cost:e.lifeCost,boss:e.boss,name:e.name});if(S.life<=0){S.life=0;S.phase='lost';emit({t:'lost'});return;}continue;}}
   const p=map.posAt(e.path,e.dist,e.lane);e.x=p.x;e.y=p.y;e.dx=p.dx;e.dy=p.dy;}
  S.enemies=S.enemies.filter(e=>!e.dead);
  // Characters: statuses, skills, then the basic attack
  for(const u of S.units.slice()){if(u.gone)continue;const def=defOf(u),st=u.st;if(u.taunt>0)u.taunt-=dt;
   if(st.burn){u.hp-=u.maxHp*.03*dt;}if(st.poison){u.hp-=u.maxHp*.02*dt;}
   // Catching their breath: characters slowly recover when nothing has hit them for a while.
   if(u.calm>0)u.calm-=dt;else if(u.hp<u.maxHp)u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.025*dt);
   for(const k in st){st[k]-=dt;if(st[k]<=0)delete st[k];}
   if(u.hp<=0){down(u);continue;}
   if(u.shardT>0)u.shardT=Math.max(0,u.shardT-dt);
   if(u.ultCd>0)u.ultCd=Math.max(0,u.ultCd-dt*(u.vantage?VANTAGE_RATE:1)*(u.shardT>0?SHARD_RATE:1));if(st.freeze||st.stun)continue;
   u.cd-=dt*u.hasteBuff;let cast=false;
   for(const sk of u.skills){if(sk.cd>0){sk.cd-=dt;continue;}if(cast||u.cd>.25||st.silence)continue;if(tryCast(u,sk)){u.cd=Math.max(u.cd,.45);cast=true;}else sk.cd=.3;}
   if(cast||u.cd>0)continue;const target=pickTarget(u,u.range,!def.melee);if(!target)continue;
   u.cd=u.interval;u.face={dx:target.x-u.x,dy:target.y-u.y};u.faceT=S.time;const o={type:def.magic?'magic':'physical',power:(def.basic||1)*(def.melee?D.MELEE_POWER:D.RANGED_POWER),element:def.element};emit({t:'attack',unit:u.id,target:target.id,from:{x:u.x,y:u.y},to:{x:target.x,y:target.y},melee:def.melee,magic:!!def.magic});
   const strike=()=>{if(u.splash){const c={x:target.x,y:target.y};for(const e of S.enemies.slice())if(!e.dead&&Math.hypot(e.x-c.x,e.y-c.y)<=u.splash)hit(u,e,e===target?o:{...o,power:.5});}else if(!target.dead)hit(u,target,o);};
   if(def.melee)strike();else later(SHOT_FLIGHT,strike);}
  S.enemies=S.enemies.filter(e=>!e.dead);
  if(!S.queue.length&&!S.enemies.length&&!S.pending.length&&S.phase==='battle')finishBattle();}
 function step(dt){S.acc+=dt;let n=0;while(S.acc>=STEP&&n<12){tick(STEP);S.acc-=STEP;n++;}if(n>=12)S.acc=0;}

 function snapshot(){return {v:2,potions:S.potions,vantage:(S.vantage||[]).map(v=>({...v})),chapter:S.chapterIndex,battle:S.battle,gold:S.gold,life:S.life,maxLife:S.maxLife,blessings:S.blessings.slice(),leaksTotal:S.leaksTotal,kills:S.kills,stats:JSON.parse(JSON.stringify(S.stats)),
  units:S.units.map(u=>({def:u.def,c:u.c,r:u.r,rank:u.rank,choice:u.choice,invested:u.invested,ultCd:u.ultCd})),hero:Object.fromEntries(Object.entries(S.hero).map(([k,v])=>[k,{keep:v.keep}]))};}
 if(snap){for(const s of snap.units)if(D.UNITS[s.def]&&map.tile(s.c,s.r))makeUnit(s.def,s.c,s.r,{rank:s.rank,choice:s.choice,invested:s.invested,ultCd:s.ultCd},0);
  for(const k in snap.hero||{})if(S.hero[k])S.hero[k].keep=snap.hero[k].keep;}
 S.prep=PREP_TIME;
 // a resumed battle keeps the 명당 it was saved with (1.7.9); a fresh chapter or an old save picks them
 if(snap&&snap.vantage&&snap.vantage.length&&snap.vantage.every(v=>map.tile(v.c,v.r))){S.vantage=snap.vantage.map(v=>({...v}));for(const u of S.units)refresh(u);}else pickVantage();S.events.length=0;
 return Object.assign(S,{usePotion,POTION_CD,affinity,ultElements,ultTime,giveShard,pickVantage,step,tick,deploy,canDeploy,slotFree,soldierCount,deployCost,rankUp,rankCost,needsChoice,withdraw,ult,startBattle,chooseBlessing,preview,snapshot,defOf,
  refundOf:u=>Math.round(u.invested*D.REFUND),drain(){const e=S.events;S.events=[];return e;}});
}
const TDSim={createSim,affinity,buildMap,STEP,TERRAIN_NAME,BLOCKED};
if(typeof module!=='undefined'&&module.exports)module.exports=TDSim;else root.TDSim=TDSim;
})(typeof window!=='undefined'?window:globalThis);
