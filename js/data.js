// cnation TD data tables. Numbers come from cnation TACTICS (HEROES / SKILLS / MONSTERS / BOSS_PROFILES) wherever one exists.
// Loaded as a plain script in the browser (window.TDData) and with require() by the balance bot.
(function(root){
function seeded(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}

// ── Skills ──────────────────────────────────────────────────────────────────────────────────────────
// type: physical | magic | heal | cleanse | taunt | fortress. range 0 = the unit's own range. area = blast radius in tiles.
// cd = seconds between automatic casts (TACTICS MP cost → about 2.5 + mp × 0.4). ult:true = the hero's 필살기, cast by the player (every hero has one from ★1, about every 20 s).
const SKILLS={
 // 카일
 flame:{name:'화염검',type:'physical',power:1.3,element:'fire',status:'burn',chance:.6,cd:5.3,fx:'slash'},
 flame2:{name:'화염검·열화',type:'physical',power:1.6,element:'fire',status:'burn',chance:1,cd:5.3,fx:'slash'},
 break:{name:'갑옷 가르기',type:'physical',power:1.4,status:'defdown',chance:1,cd:6.1,fx:'slash'},
 iceblade:{name:'얼음 베기',type:'physical',power:1.35,element:'water',status:'slow',chance:1,cd:5.7,fx:'slash'},
 stormblade:{name:'폭풍 베기',type:'physical',power:1.45,area:1.2,element:'wind',knockback:.9,cd:7.3,fx:'slash'},
 arcaslash:{name:'아르카 참격',type:'physical',power:1.6,area:2.6,self:true,element:'light',cd:18,ult:true,fx:'nova'},
 // 리아
 fire:{name:'파이어',type:'magic',power:1.25,area:1.1,element:'fire',status:'burn',chance:.3,cd:5.7,fx:'blast'},
 ice:{name:'프로스트',type:'magic',power:1.15,area:1.1,element:'ice',status:'freeze',chance:.45,cd:6.5,fx:'blast'},
 ice2:{name:'프로스트·빙옥',type:'magic',power:1.25,area:1.5,element:'ice',status:'freeze',chance:.8,cd:6.5,fx:'blast'},
 storm:{name:'파이어 스톰',type:'magic',power:1.35,area:1.9,element:'fire',status:'burn',chance:.5,cd:12,fx:'blast'},
 whirlwind:{name:'회오리 폭풍',type:'magic',power:1.2,area:1.9,element:'wind',status:'slow',chance:1,cd:11,fx:'blast'},
 thunder:{name:'썬더',type:'magic',power:1.6,range:3.5,element:'thunder',status:'stun',chance:.4,cd:7.7,fx:'bolt'},
 meteor:{name:'메테오',type:'magic',power:1.45,area:1.9,element:'fire',status:'burn',chance:1,cd:22,ult:true,aim:true,fx:'meteor'},
 // 브란
 bash:{name:'실드 배시',type:'physical',power:1.1,status:'stun',chance:.6,cd:4.9,fx:'slash'},
 taunt:{name:'도발',type:'taunt',area:1.9,self:true,hold:1.8,cd:7.5,fx:'nova'},
 icebash:{name:'빙벽 강타',type:'physical',power:1.3,element:'water',status:'slow',chance:1,cd:6.1,fx:'slash'},
 quake:{name:'대지 충격',type:'physical',power:1.4,area:1.4,self:true,status:'stun',chance:.3,cd:8.9,fx:'nova'},
 fortress:{name:'철벽의 성채',type:'fortress',dur:5,area:1.9,self:true,cd:24,ult:true,fx:'nova',element:'light'},
 // 세라
 pierce:{name:'관통 사격',type:'physical',power:1.4,ignore:.5,cd:5.3,fx:'bolt'},
 poison:{name:'독화살',type:'physical',power:1.1,status:'poison',chance:1,cd:5.7,fx:'shot'},
 flamearrow:{name:'화염 화살',type:'physical',power:1.3,element:'fire',status:'burn',chance:.75,cd:4.9,fx:'shot'},
 icearrow:{name:'얼음 화살',type:'physical',power:1.25,element:'water',status:'slow',chance:1,cd:4.9,fx:'shot'},
 galearrow:{name:'질풍 화살',type:'physical',power:1.3,range:5.5,element:'wind',cd:6.5,fx:'shot'},
 volley:{name:'화살비',type:'physical',power:1.1,area:1.4,cd:8.1,fx:'blast'},
 hawk:{name:'매의 심판',type:'physical',power:3.5,range:7,ignore:.7,pick:'strong',cd:18,ult:true,fx:'bolt'},
 // 루나
 heal:{name:'힐',type:'heal',power:1.6,cd:4.6,element:'light',fx:'heal'},
 purify:{name:'정화',type:'cleanse',cd:5,element:'light',fx:'heal'},
 holy:{name:'홀리',type:'magic',power:1.5,area:1.2,element:'light',cd:8.1,fx:'blast'},
 waterwave:{name:'정화의 물결',type:'magic',power:1.2,area:1.3,element:'water',status:'slow',chance:.5,cd:7.3,fx:'blast'},
 miracle:{name:'생명의 기적',type:'heal',power:1.3,all:true,cleanse:true,cd:24,ult:true,element:'light',fx:'nova'},
 mend:{name:'응급 치료',type:'heal',power:1.1,cd:6,element:'light',fx:'heal'},
 // 네로
 backstab:{name:'그림자 찌르기',type:'physical',power:1.5,ignore:.3,cd:5.3,fx:'slash'},
 sleep:{name:'수면 단검',type:'physical',power:1,range:2,status:'sleep',chance:.7,cd:6.1,fx:'shot'},
 firecurse:{name:'화염 저주',type:'physical',power:1.25,range:3,element:'fire',status:'burn',chance:1,cd:6.5,fx:'shot'},
 iceprison:{name:'얼음 감옥',type:'physical',power:1.15,range:3,element:'water',status:'stun',chance:1,cd:7.3,fx:'shot'},
 silence:{name:'침묵의 표식',type:'physical',power:1.25,range:3,element:'dark',status:'silence',chance:1,cd:6.5,fx:'shot'},
 eclipse:{name:'월식',type:'physical',power:2.2,area:2,self:true,element:'dark',status:'poison',chance:1,cd:20,ult:true,fx:'nova'}
};

// ── Deployable characters ───────────────────────────────────────────────────────────────────────────
// ranks[n] = what rank n+1 adds. choice = the ★3 engraving (one of three). props are merged into the unit.
const UNITS={
 kyle:{name:'카일',job:'검사',kind:'hero',ult:'arcaslash',melee:true,block:2,cost:100,maxRank:5,
  hp:108,atk:25,def:16,mag:10,res:12,spd:12,crit:.10,range:1,model:{heroId:'kyle',hair:0x855537},
  ranks:[{skills:['flame']},{skills:['break']},
   {choice:{fire:{label:'🔥 불',swap:['flame','flame2'],desc:'화염검이 반드시 화상을 입히고 더 강해집니다.'},
            water:{label:'💧 물',skills:['iceblade'],desc:'얼음 베기: 맞은 적이 느려집니다.'},
            wind:{label:'🪽 바람',skills:['stormblade'],desc:'폭풍 베기: 주변 적을 함께 베고 밀어냅니다.'}}},
   {aura:{stat:'atk',mult:1.25,radius:2},desc:'용기의 맹세: 주변 2칸 아군 공격 +25%'},
   {ultBoost:true,desc:'필살기 강화: 위력 +30% · 재사용 −15%'}],
  role:'적을 붙잡아 늦추는 근접 검사. 화상과 방어 깎기로 화력을 끌어올립니다.'},
 ria:{name:'리아',job:'마도사',kind:'hero',ult:'meteor',melee:false,block:0,cost:140,maxRank:5,magic:true,
  hp:74,atk:10,def:8,mag:30,res:22,spd:11,crit:.10,range:2.5,model:{heroId:'ria',hair:0xe4e4ee},
  ranks:[{skills:['fire']},{skills:['ice']},
   {choice:{fire:{label:'🔥 불',skills:['storm'],desc:'파이어 스톰: 넓은 범위를 불태웁니다.'},
            water:{label:'💧 물',swap:['ice','ice2'],desc:'프로스트가 더 넓어지고 더 자주 얼립니다.'},
            wind:{label:'🪽 바람',skills:['whirlwind'],desc:'회오리 폭풍: 넓은 범위를 느리게 만듭니다.'}}},
   {skills:['thunder']},{ultBoost:true,desc:'필살기 강화: 위력 +30% · 재사용 −15%'}],
  role:'넓은 범위를 공격하는 마도사. 무리 지은 적과 물리에 강한 적에게 좋습니다.'},
 bran:{name:'브란',job:'전사',kind:'hero',ult:'fortress',melee:true,block:3,cost:120,maxRank:5,
  hp:150,atk:24,def:26,mag:9,res:15,spd:8,crit:.10,range:1,model:{heroId:'bran',hair:0x66492e},
  ranks:[{skills:['bash']},{skills:['taunt']},
   {choice:{fire:{label:'🔥 불',props:{counter:.6},desc:'화염 방패: 자신을 때린 적에게 화염 반격.'},
            water:{label:'💧 물',skills:['icebash'],desc:'빙벽 강타: 맞은 적이 느려집니다.'},
            wind:{label:'🪨 대지',skills:['quake'],desc:'대지 충격: 주변 적을 모두 때리고 기절시킵니다.'}}},
   {aura:{stat:'def',mult:1.35,radius:2},desc:'수호의 진: 주변 2칸 아군 방어 +35%'},
   {ultBoost:true,desc:'필살기 강화: 위력 +30% · 재사용 −15%'}],
  role:'가장 많은 적을 붙잡는 방패. 기절과 도발로 길목을 지킵니다.'},
 sera:{name:'세라',job:'궁수',kind:'hero',ult:'hawk',melee:false,block:0,cost:110,maxRank:5,
  hp:88,atk:26,def:11,mag:13,res:13,spd:16,crit:.12,range:4,minRange:1.2,highDmg:.15,model:{heroId:'sera',hair:0xe2bc69},
  ranks:[{skills:['pierce']},{skills:['poison']},
   {choice:{fire:{label:'🔥 불',skills:['flamearrow'],desc:'화염 화살: 화상을 입힙니다.'},
            water:{label:'💧 물',skills:['icearrow'],desc:'얼음 화살: 맞은 적이 느려집니다.'},
            wind:{label:'🪽 바람',skills:['galearrow'],desc:'질풍 화살: 아주 먼 적까지 맞힙니다.'}}},
   {skills:['volley']},{ultBoost:true,desc:'필살기 강화: 위력 +30% · 재사용 −15%'}],
  role:'가장 멀리 쏘는 궁수. 바로 옆 칸은 쏘지 못하고, 고지대에서 더 강합니다.'},
 luna:{name:'루나',job:'사제',kind:'hero',ult:'miracle',melee:false,block:0,cost:130,maxRank:5,magic:true,
  hp:82,atk:12,def:12,mag:26,res:25,spd:10,crit:.10,range:2.5,basic:.7,element:'light',model:{heroId:'luna',hair:0xcf8d85},
  ranks:[{skills:['heal']},{skills:['purify']},
   {choice:{fire:{label:'✨ 빛',skills:['holy'],desc:'홀리: 빛의 범위 공격. 암흑 적에게 강합니다.'},
            water:{label:'💧 물',skills:['waterwave'],desc:'정화의 물결: 물 범위 공격과 둔화.'},
            wind:{label:'🪽 바람',aura:{stat:'haste',mult:1.2,radius:2},desc:'바람의 축복: 주변 아군 공격 속도 +20%.'}}},
   {aura:{stat:'atk',mult:1.25,radius:2},desc:'빛의 축복: 주변 2칸 아군 공격 +25%'},
   {ultBoost:true,desc:'필살기 강화: 위력 +30% · 재사용 −15%'}],
  role:'다친 동료를 치료하고 나쁜 상태를 지워 주는 사제.'},
 nero:{name:'네로',job:'도적',kind:'hero',ult:'eclipse',melee:true,block:1,cost:110,maxRank:5,
  hp:90,atk:28,def:10,mag:15,res:14,spd:22,crit:.18,range:1,behind:.25,steal:.3,cooldown:8,model:{heroId:'nero',hair:0x33394d},
  ranks:[{skills:['backstab']},{skills:['sleep']},
   {choice:{fire:{label:'🔥 불',skills:['firecurse'],desc:'화염 저주: 멀리 있는 적을 반드시 불태웁니다.'},
            water:{label:'💧 물',skills:['iceprison'],desc:'얼음 감옥: 멀리 있는 적을 기절시킵니다.'},
            wind:{label:'🌑 암흑',skills:['silence'],desc:'침묵의 표식: 적의 특수 능력을 봉인합니다.'}}},
   {props:{eva:.3},desc:'잔상: 적의 공격을 30% 확률로 피함'},
   {ultBoost:true,desc:'필살기 강화: 위력 +30% · 재사용 −15%'}],
  role:'가장 빠른 암살자. 자신을 지나친 적에게 더 강하고, 처치하면 골드를 더 얻습니다.'},
 militia:{name:'민병',job:'연합군',kind:'soldier',melee:true,block:1,cost:50,maxRank:3,
  hp:72,atk:15,def:10,mag:5,res:8,spd:11,crit:.05,range:1,model:{heroId:'kyle',hair:0x5b4a3a,hpal:[0x8a7a5c,0x5a4b3a,0xb9b39c],scale:.86},
  ranks:[{},{},{props:{blockBonus:1},desc:'저지 +1'}],role:'싸고 튼튼한 근접 병사.'},
 shield:{name:'방패병',job:'연합군',kind:'soldier',melee:true,block:2,cost:70,maxRank:3,
  hp:112,atk:11,def:19,mag:5,res:11,spd:8,crit:.05,range:1,model:{heroId:'bran',hair:0x4a3a2c,hpal:[0x6f7f93,0x4c5868,0xbfc7cf],scale:.84},
  ranks:[{},{},{props:{blockBonus:1},desc:'저지 +1'}],role:'여러 적을 붙잡는 방패 병사.'},
 hunter:{name:'사냥꾼',job:'연합군',kind:'soldier',melee:false,block:0,cost:60,maxRank:3,
  hp:55,atk:17,def:6,mag:5,res:8,spd:13,crit:.08,range:3,model:{heroId:'sera',hair:0x7a5a3c,hpal:[0x7d8a5a,0x5d4a36,0xb9a26a],scale:.86},
  ranks:[{},{},{props:{haste:.25},desc:'공격 속도 +25%'}],role:'멀리서 한 마리씩 쏘는 궁수.'},
 apprentice:{name:'수습 마도사',job:'연합군',kind:'soldier',melee:false,block:0,cost:80,maxRank:3,magic:true,
  hp:50,atk:5,def:5,mag:17,res:12,spd:10,crit:.05,range:2.5,model:{heroId:'ria',hair:0x6b4a3a,hpal:[0x6f88b5,0x3f4f78,0xcdbb7a],scale:.86},
  ranks:[{},{},{props:{splash:.8},desc:'공격이 주변으로 퍼짐'}],role:'마법 피해를 주는 병사.'},
 acolyte:{name:'수습 사제',job:'연합군',kind:'soldier',melee:false,block:0,cost:90,maxRank:3,magic:true,
  hp:52,atk:5,def:6,mag:14,res:14,spd:10,crit:.05,range:2.5,basic:.6,element:'light',model:{heroId:'luna',hair:0x6a4f3f,hpal:[0xd9d2bd,0xa9a08a,0x9aa7b8],scale:.86},
  ranks:[{skills:['mend']},{},{props:{haste:.25},desc:'치료·공격 속도 +25%'}],role:'가까운 동료를 치료하는 병사.'}
};
const HERO_ORDER=['kyle','ria','bran','sera','luna','nero'],SOLDIER_ORDER=['militia','shield','hunter','apprentice','acolyte'];
const RANK_COST=[1,.8,1.2,1.8,2.5];      // × deploy cost, index = rank reached − 1
const RANK_STAT=.25,RANK_GUARD=.15;      // per rank: +25% HP/ATK/MAG, +15% DEF/RES
const REFUND=.7,WITHDRAW_CD=20,DOWN_CD=30;
const ENGAGE_SLOW=2/3;
// Basic attack timing against the base numbers (skills, 필살기 and heals unchanged): ranged fire at 1.2× the base interval
// for 0.3× power, melee at 0.7× the interval for 0.7× power.
const RANGED_INTERVAL=1.2,RANGED_POWER=.3,MELEE_INTERVAL=.7,MELEE_POWER=.7;                   // a monster held by a melee character walks past at a third of its speed

// ── Monsters (TACTICS MONSTERS, same order) ─────────────────────────────────────────────────────────
const MONSTERS=[
{name:'이끼 슬라임',model:'slime',color:0x8cc87d,hp:44,atk:14,def:7,mag:9,res:8,range:1,move:3,element:'wind'},
{name:'고블린',model:'goblin',color:0xb4ab62,hp:63,atk:19,def:9,mag:7,res:7,range:1,move:4},
{name:'서리 늑대',model:'wolf',color:0xafc9d3,hp:60,atk:21,def:9,mag:8,res:10,range:1,move:5,element:'water'},
{name:'제국 보병',model:'knight',color:0x9d7370,hp:78,atk:22,def:16,mag:8,res:10,range:1,move:3},
{name:'제국 석궁병',model:'archer',color:0x807b95,hp:56,atk:23,def:9,mag:8,res:10,range:4,move:3},
{name:'에테르 망령',model:'ghost',color:0xaaa5df,hp:54,atk:14,def:7,mag:24,res:20,range:3,move:3,magic:true,element:'wind',immunity:'physical'},
{name:'수호 골렘',model:'golem',color:0x8e9e93,hp:115,atk:26,def:22,mag:14,res:8,range:1,move:2,immunity:'magic'},
{name:'화염 임프',model:'flameSpirit',color:0xe4a26c,hp:61,atk:15,def:7,mag:26,res:22,range:3,move:3,magic:true,element:'fire'},
{name:'독거미',model:'spider',color:0x9a76ad,hp:57,atk:20,def:11,mag:12,res:12,range:1,move:5,status:'poison'},
{name:'아르카 비룡',model:'dragon',color:0x6da9a4,hp:110,atk:28,def:17,mag:25,res:20,range:2,move:4,element:'wind'},
{name:'붉은 진흙 슬라임',model:'slime',color:0xb98255,hp:57,atk:17,def:11,mag:8,res:8,range:1,move:3,element:'fire'},
{name:'모래 약탈자',model:'goblin',color:0xc3975f,hp:69,atk:23,def:10,mag:8,res:9,range:1,move:4},
{name:'회오리 매',model:'dragon',color:0x9cbea9,hp:54,atk:22,def:8,mag:19,res:13,range:2,move:5,element:'wind'},
{name:'늪지 사냥꾼',model:'spider',color:0x62866d,hp:65,atk:21,def:12,mag:12,res:13,range:1,move:4,status:'poison',element:'water'},
{name:'잿불 임프',model:'flameSpirit',color:0xd9684b,hp:72,atk:16,def:8,mag:29,res:21,range:3,move:3,magic:true,element:'fire'},
{name:'강철 척후병',model:'knight',color:0x6b8290,hp:83,atk:25,def:18,mag:9,res:11,range:1,move:4},
{name:'사막 궁수',model:'archer',color:0xc49d68,hp:61,atk:26,def:9,mag:9,res:10,range:4,move:3},
{name:'물안개 유령',model:'ghost',color:0x83bac4,hp:61,atk:14,def:8,mag:26,res:20,range:3,move:3,magic:true,element:'water',immunity:'physical'},
{name:'사암 골렘',model:'golem',color:0xc4a478,hp:126,atk:29,def:23,mag:12,res:8,range:1,move:2,immunity:'magic'},
{name:'가시 덩굴병',model:'treant',color:0x79965a,hp:91,atk:25,def:15,mag:16,res:15,range:2,move:2,element:'wind'},
{name:'황혼의 추적자',model:'wolf',color:0x78687e,hp:78,atk:30,def:11,mag:13,res:14,range:1,move:5},
{name:'화염 포격병',model:'archer',color:0xab6656,hp:73,atk:24,def:12,mag:29,res:17,range:4,move:3,magic:true,element:'fire'},
{name:'심연의 파수꾼',model:'sentinel',color:0x587b88,hp:102,atk:29,def:20,mag:23,res:19,range:2,move:3,element:'water'},
{name:'검은 숲 고목',model:'treant',color:0x526c62,hp:94,atk:23,def:16,mag:27,res:18,range:3,move:2,magic:true,element:'wind'},
{name:'화염 늑대',model:'wolf',color:0xe05a35,hp:70,atk:25,def:9,mag:8,res:10,range:1,move:6,element:'fire'},
{name:'잿불 궁수',model:'archer',color:0xc45b3a,hp:58,atk:24,def:8,mag:10,res:11,range:4,move:3,element:'fire'},
{name:'빙결 골렘',model:'golem',color:0x8fc9e8,hp:140,atk:25,def:30,mag:10,res:18,range:1,move:2,element:'water',immunity:'magic'},
{name:'물안개 독거미',model:'spider',color:0x5fa6c9,hp:65,atk:26,def:10,mag:12,res:14,range:1,move:6,eva:.18,element:'water',status:'poison'},
{name:'폭풍 늑대',model:'wolf',color:0xa9d8e8,hp:72,atk:27,def:10,mag:10,res:12,range:1,move:6,element:'wind'},
{name:'바람 정령',model:'ghost',color:0x9de0d5,hp:65,atk:12,def:8,mag:30,res:28,range:3,move:4,magic:true,element:'wind',immunity:'physical'}];
// What each model does on the road.
const MODEL_TRAITS={
 slime:{split:true,note:'죽으면 둘로 갈라집니다'},
 goblin:{note:'평범한 무리'},
 wolf:{note:'빠르게 돌파합니다'},
 knight:{note:'갑옷이 두꺼워 물리 공격이 덜 먹힙니다'},
 archer:{ranged:true,note:'걸어가며 동료를 쏩니다'},
 ghost:{ranged:true,ghost:true,note:'물리 피해 35%만 받고, 붙잡을 수 없습니다'},
 golem:{slots:2,note:'마법 피해 35%만 받고, 두 자리를 차지합니다'},
 flameSpirit:{ranged:true,inflict:'burn',note:'마법으로 동료를 불태웁니다'},
 spider:{note:'빠르고, 붙잡은 동료를 중독시킵니다'},
 dragon:{flying:true,note:'비행: 붙잡을 수 없고 근접 공격이 닿지 않습니다'},
 treant:{regen:.025,note:'주변 몬스터의 체력을 회복시킵니다'},
 sentinel:{shield:.3,note:'주변 몬스터가 받는 피해를 줄입니다'}
};
const MOVE_SPEED=.22;                    // tiles per second per MOVE point
const ELEMENT_ICON={fire:'🔥',water:'💧',ice:'❄',wind:'🪽',thunder:'⚡',light:'✨',dark:'🌑'};

// ── Maps ───────────────────────────────────────────────────────────────────────────────────────────
// w × h tiles (early chapters are smaller and grow to 9 × 14). paths = tile waypoints (the first and last may lie just outside the field).
// Terrain is grown around the road by sim.buildMap from these counts, with the map's own seed.
const SCENES={
 ruin:{land:0x7eaa83,alt:0x8fb47f,high:0xb7bea0,road:0xcbb998,tree:[0x3a6f5d,0x5d9270],water:0x20576a,sky:0xc9dfc9,rock:0xa6b3a0,cliff:0x93a394,accent:0x8be1bf,prop:'ruin',slow:0x677f77},
 fort:{land:0xb59a72,alt:0xa58c63,high:0xd0bd92,road:0xdccaa2,tree:[0x7d8a4f,0x9aa55f],water:0x2b6072,sky:0xe2cbb0,rock:0xbda87d,cliff:0x9c8562,accent:0xe2a16d,prop:'fort',slow:0xe0c58c},
 river:{land:0x86a3a7,alt:0x7b9aa0,high:0xbac8c4,road:0xd8cfb7,tree:[0x3f6f72,0x639a94],water:0x1f5a78,sky:0xc9dce1,rock:0xa9b6ba,cliff:0x7f949b,accent:0x9ddce9,prop:'rockspire',slow:0x6f8a8a},
 forest:{land:0x628c69,alt:0x567f5f,high:0x9db089,road:0xb9a987,tree:[0x2f5f4a,0x4d8560],water:0x1d5560,sky:0xb6d2b7,rock:0x8fa48f,cliff:0x577a62,accent:0xb3e185,prop:'bigtree',slow:0x4f6f62},
 city:{land:0x92899b,alt:0x857c90,high:0xbdb6c4,road:0xc7b5ac,tree:[0x586f6a,0x7a958c],water:0x2a4f73,sky:0xd2cbdc,rock:0xaaa2b2,cliff:0x756d83,accent:0xc8a6e8,prop:'house',slow:0x7a7286},
 camp:{land:0xa49370,alt:0x948562,high:0xc8ba93,road:0xc7b89c,tree:[0x74804f,0x93a062],water:0x2b6072,sky:0xd8cdb2,rock:0xb3a583,cliff:0x857a5e,accent:0xe6bc72,prop:'tent',slow:0xd8c08a},
 crystal:{land:0x829a94,alt:0x748d88,high:0xb4c8c0,road:0xb9c7bb,tree:[0x4f8f8a,0x86d6cc],water:0x1c6470,sky:0xc0d9d2,rock:0x9db5ad,cliff:0x64817f,accent:0x8be3dd,prop:'crystal',slow:0x5f8580},
 tower:{land:0x6d7180,alt:0x626676,high:0x9a9eae,road:0xa7a5ab,tree:[0x474d66,0x6a7092],water:0x23365f,sky:0xb6bacc,rock:0x8a8e9e,cliff:0x4f5367,accent:0xb698df,prop:'spire',slow:0x56596b},
 wall:{land:0xa4a19a,alt:0x97948d,high:0xcdcac0,road:0xddd0b1,tree:[0x6f7d6c,0x8fa08a],water:0x2a5a6e,sky:0xd5d3ca,rock:0xb8b5ac,cliff:0x7c7f7d,accent:0xe5c391,prop:'house',slow:0x8f8c84},
 core:{land:0x698e8d,alt:0x5c8281,high:0xa2c2bc,road:0xa9c4bd,tree:[0x3f8f96,0x8ff0e0],water:0x135a66,sky:0xb4dad5,rock:0x8fb3ae,cliff:0x456b75,accent:0xb3f3df,prop:'crystal',slow:0x4d7a7c}
};
const MAPS={
 prologue:{scene:'ruin',seed:11,w:9,h:9,paths:[[[1,-1],[1,1],[7,1],[7,4],[1,4],[1,7],[5,7],[5,9]]],
  slow:[{path:0,from:12,to:14,type:'swamp'}],lakes:[[8,7.6,1.3]],high:6,forest:6,cliff:1,prop:2,rock:3},
 fort:{scene:'fort',seed:23,w:9,h:10,paths:[[[9,1],[1,1],[1,4],[7,4],[7,7],[2,7],[2,10]]],
  slow:[{path:0,from:13,to:16,type:'sand'}],lakes:[[8,9,1.2]],high:6,forest:4,cliff:3,prop:3,rock:4},
 river:{scene:'river',seed:37,w:9,h:11,paths:[[[4,-1],[4,1],[1,1],[1,4],[7,4],[7,7],[2,7],[2,9],[6,9],[6,11]]],
  rivers:[{row:5,from:3,to:8}],lakes:[[0,9.5,1.2]],high:7,forest:5,cliff:4,prop:2,rock:4},
 forest:{scene:'forest',seed:41,w:9,h:12,paths:[[[7,-1],[7,2],[1,2],[1,5],[5,5],[5,8],[1,8],[1,10],[6,10],[6,12]]],
  slow:[{path:0,from:5,to:8,type:'swamp'},{path:0,from:19,to:21,type:'swamp'}],lakes:[[7,7,1.3]],high:7,forest:12,cliff:2,prop:4,rock:3},
 city:{scene:'city',seed:53,paths:[[[1,-1],[1,3],[4,3],[4,6],[1,6],[1,9],[7,9],[7,12],[3,12],[3,14]],[[7,-1],[7,3],[4,3],[4,6],[1,6],[1,9],[7,9],[7,12],[3,12],[3,14]]],
  rivers:[{col:8,from:5,to:7}],high:8,forest:4,cliff:2,prop:8,rock:3},
 plain:{scene:'camp',seed:67,paths:[[[-1,1],[6,1],[6,4],[2,4],[2,7],[7,7],[7,10],[1,10],[1,12],[5,12],[5,14]]],
  slow:[{path:0,from:22,to:25,type:'sand'}],lakes:[[0,5,1.4],[8,13,1.2]],high:8,forest:6,cliff:2,prop:5,rock:5},
 ruins:{scene:'crystal',seed:79,paths:[[[4,-1],[4,2],[7,2],[7,5],[1,5],[1,8],[4,8],[4,10],[7,10],[7,12],[2,12],[2,14]]],
  rivers:[{row:6,from:0,to:5},{row:11,from:5,to:8}],high:8,forest:6,cliff:3,prop:6,rock:4},
 tower:{scene:'tower',seed:83,paths:[[[-1,1],[7,1],[7,12],[1,12],[1,4],[5,4],[5,9],[3,9],[3,6]]],
  slow:[{path:0,from:26,to:29,type:'swamp'}],high:8,forest:4,cliff:3,prop:4,rock:4},
 capital:{scene:'wall',seed:97,paths:[[[0,-1],[0,3],[3,3],[3,6],[6,6],[6,9],[2,9],[2,12],[6,12],[6,14]],[[8,-1],[8,3],[6,3],[6,6],[6,9],[2,9],[2,12],[6,12],[6,14]]],
  rivers:[{row:10,from:4,to:8}],high:8,forest:4,cliff:3,prop:7,rock:3},
 core:{scene:'core',seed:101,paths:[[[4,-1],[4,1],[1,1],[1,3],[7,3],[7,6],[1,6],[1,9],[7,9],[7,12],[4,12],[4,14]]],
  slow:[{path:0,from:16,to:19,type:'swamp'}],lakes:[[4,7.6,1.1],[8,0,1.2]],high:8,forest:7,cliff:3,prop:7,rock:3}
};

// ── Bosses (battle 10 of each chapter) ──────────────────────────────────────────────────────────────
// base = monster index for the body stats. hp scales the chapter's boss HP (900 + 240 × chapter), atk the body's attack. wave = area attack on characters around the boss.
const BOSSES=[
 {name:'거대 이끼 슬라임',base:0,hp:0.9,atk:1.6,scale:2.3,move:2,split:true,hint:'갈라질수록 수가 늘어납니다. 범위 공격으로 한꺼번에 태우세요.'},
 {name:'제국의 집행관',base:3,bossId:1,hp:1,atk:1.9,scale:1.6,move:2.2,element:'fire',wave:{name:'집행의 화염',every:7,radius:2.1,power:.9,status:'burn'},summon:{every:11,kind:3,count:3},hint:'주변 동료를 불태우고 보병을 부릅니다. 물 속성 공격이 잘 먹힙니다.'},
 {name:'산맥의 폭군',base:6,bossId:2,hp:1,atk:2,scale:1.7,move:1.8,element:'ice',immunity:'magic',wave:{name:'빙벽 붕괴',every:9,radius:2.2,power:.8,status:'freeze'},summon:{every:13,kind:2,count:3},hint:'주변 동료를 얼립니다. 마법이 잘 안 먹히니 물리 화력을 모으고, 동료를 흩어 세우세요.'},
 {name:'타락한 수호목',base:19,bossId:3,hp:0.9,atk:1.8,scale:1.7,move:1.6,element:'wind',regen:.004,wave:{name:'독성 포자',every:7,radius:2.4,power:.6,status:'poison'},summon:{every:9,kind:19,count:2},hint:'스스로 회복하고 독을 퍼뜨립니다. 불 속성과 침묵, 루나의 정화가 답입니다.'},
 {name:'그림자 재상',base:5,bossId:4,hp:0.8,atk:2,scale:1.6,move:2.2,element:'dark',immunity:'physical',ghost:true,wave:{name:'침묵의 장막',every:8,radius:2.5,power:.9,status:'silence'},summon:{every:11,kind:5,count:2},hint:'붙잡을 수 없고 물리 공격이 잘 안 먹힙니다. 마법과 빛 속성으로 잡으세요.'},
 {name:'전쟁의 골렘',base:18,bossId:5,hp:1,atk:2.1,scale:1.8,move:1.7,element:'thunder',immunity:'magic',wave:{name:'전쟁 포격',every:9,radius:3,power:1,status:'stun'},summon:{every:12,kind:15,count:3},hint:'멀리까지 포격해 동료를 기절시킵니다. 물리 화력과 방어 깎기가 필요합니다.'},
 {name:'아르카 감시자',base:22,bossId:6,hp:1,atk:2.2,scale:1.7,move:2,element:'thunder',beam:{name:'감시 광선',every:9,delay:2.5,power:3.2,status:'silence'},shield:.3,summon:{every:12,kind:22,count:2},hint:'가장 랭크가 높은 동료를 조준합니다. 경고가 뜨면 철수하거나 버틸 준비를 하세요.'},
 {name:'검은 대공',base:9,bossId:7,hp:0.9,atk:2.2,scale:1.8,move:2,element:'dark',fly:{air:7,ground:6},wave:{name:'암흑 숨결',every:8,radius:2.5,power:1,status:'poison'},summon:{every:12,kind:12,count:3},hint:'날아다니다 내려앉습니다. 날 때는 원거리만 닿고, 내려앉았을 때 근접으로 몰아치세요.'},
 {name:'황제의 잔영',base:15,bossId:8,hp:1,atk:2.6,scale:1.7,move:2.2,element:'light',clones:{at:.5,count:2,hp:.22},wave:{name:'왕권의 섬광',every:8,radius:2.2,power:1.1,status:'stun'},summon:{every:13,kind:15,count:3},hint:'체력이 절반이 되면 분신을 만듭니다. 암흑 속성과 범위 공격을 아껴 두세요.'},
 {name:'아르카 코어',base:22,bossId:9,model:'arcacore',hp:1.2,atk:2.4,scale:1.8,move:1.7,element:'light',phases:[.66,.33],wave:{name:'아르카 공명',every:8,radius:3,power:1,status:'stun'},summon:{every:9,kind:[6,14,9,21,22],count:3},hint:'체력이 줄 때마다 빨라지고 온갖 몬스터를 부릅니다. 모든 것을 쏟아부으세요.'}
];

// ── Chapters ───────────────────────────────────────────────────────────────────────────────────────
// Early chapters are short because the party is small. diff = [monster HP, monster attack, boss HP] for the whole chapter,
// set with the balance bot (node tools/bot.js calibrate).
const POOLS=[[0,1,2,10,11,12],[1,3,4,10,11,15],[2,11,12,16,18,20],[0,8,13,19,20,22],[3,4,5,15,17,20,8],[11,15,16,18,20,21,24,26],[6,7,17,18,21,22,25,27],[5,15,17,20,21,22,28,29],[3,4,7,15,20,21,24,26,28],[6,7,9,17,21,22,25,27,29]];
const CHAPTER_DEFS=[
 {id:'prologue',label:'PROLOGUE',name:'깨어난 빛',place:'국경 마을 에린',map:'prologue',battles:5,soldiers:3,bless:[2,4],diff:[.2,1,2.2],
  names:['유적의 문','잠든 소녀','숲길의 소란','마을로 돌아가는 길'],
  intro:[['카일','이런 곳에 사람이… 괜찮아? 내 목소리 들려?'],['리아','리아… 내 이름은 리아. 그 외에는 아무것도 기억나지 않아.'],['카일','뒤에서 뭔가 움직여. 내 곁에 있어. 마을까지는 한 마리도 못 지나가게 하자.']],
  outro:[['리아','끝났어…? 저 수정이 무사해.'],['카일','응. 하지만 이건 시작일 뿐이야. 남문 쪽에서 연기가 올라오고 있어.']]},
 {id:'c1',label:'CHAPTER 01',name:'국경의 불꽃',place:'에린 남문',map:'fort',battles:6,soldiers:3,bless:[2,4],diff:[.72,1,.27],
  names:['불타는 파수대','잿더미의 약속','남문의 방패','남문의 잔불','국경을 넘어서'],
  intro:[['브란','제국군이 마을을 포위했다. 퇴로는 내가 열겠다.'],['리아','저 병기들… 나를 찾고 있는 것 같아.'],['카일','누구에게도 넘기지 않아. 모두 살아서 나간다.']],
  outro:[['브란','집행관이 쓰러졌다. 지금이다, 국경을 넘어라!'],['카일','브란, 당신도 같이 가는 거야.']]},
 {id:'c2',label:'CHAPTER 02',name:'도망자',place:'회색 산맥',map:'river',battles:7,soldiers:2,bless:[3,5],diff:[.58,1,.63],
  names:['산길의 매복','바람길 정찰','바람의 궁수','협곡의 피난민','흔들리는 다리','설산의 문턱'],
  intro:[['세라','그 길은 막혔어. 살아서 산을 넘고 싶다면 따라와.'],['카일','우릴 왜 도와주는 거지?'],['세라','제국이 태운 마을이 너희 마을뿐인 줄 알아?']],
  outro:[['세라','폭군이 무너졌어. 이제 숲까지는 내리막이야.'],['리아','숲에서… 누군가 부르는 소리가 들려.']]},
 {id:'c3',label:'CHAPTER 03',name:'고대의 숲',place:'엘렌 숲',map:'forest',battles:8,soldiers:2,bless:[3,6],diff:[.85,1,.45],
  names:['정령의 속삭임','오염된 뿌리','오염된 샘','숲의 샘을 지켜라','가시 덩굴 길','늪의 사냥꾼','숲의 심장'],
  intro:[['루나','정령들이 울고 있어요. 에테르의 흐름이 뒤틀렸어요.'],['리아','이 숲의 노래… 어디선가 들었어.'],['루나','당신을 두려워하는 게 아니에요. 기다리고 있었던 거예요.']],
  outro:[['루나','수호목이 잠들었어요. 숲이 다시 숨을 쉬어요.'],['카일','다음은 왕도야. 답을 아는 사람이 거기 있어.']]},
 {id:'c4',label:'CHAPTER 04',name:'왕도의 그림자',place:'왕도 레온',map:'city',battles:10,soldiers:1,bless:[3,6,9],diff:[.89,1,.28],
  names:['지붕 위의 추적','그림자 문서','밤의 연락망','봉인된 기록','골목의 석궁','지하 서고','망령의 회랑','왕의 침묵','재상의 호위대'],
  intro:[['네로','왕궁 기록에 네 이름이 있더라. 백 년 전 문서에.'],['리아','내가… 백 년 전에?'],['네로','답을 원하면 지하 서고로 와. 경비병들은 알아서 피하고.']],
  outro:[['네로','재상은 그림자였어. 진짜는 북쪽에 있다.'],['브란','두 왕국이 움직이기 전에 평원으로 가야 한다.']]},
 {id:'c5',label:'CHAPTER 05',name:'두 왕국',place:'벨른 평원',map:'plain',battles:10,soldiers:1,bless:[3,6,9],diff:[1.43,1,.12],
  names:['갈라진 깃발','갈라진 전선','약탈자의 길','연합의 방어선','모래바람','황혼의 추적','포격 진지','강철의 행군','새벽의 진군'],
  intro:[['브란','두 왕국이 등을 돌린 사이 제국은 코어를 깨우고 있다.'],['세라','왕들이 못 정하면 우리가 길을 열면 돼.'],['카일','사람들을 지키자. 어느 깃발 아래에 있든.']],
  outro:[['세라','골렘이 멈췄어. 저 안에… 아르카의 문양이 있어.'],['리아','유적으로 가야 해. 내가 무엇이었는지 거기 있어.']]},
 {id:'c6',label:'CHAPTER 06',name:'아르카 유적',place:'아르카 외곽',map:'ruins',battles:10,soldiers:1,bless:[3,6,9],diff:[.85,1,.16],
  names:['강철의 기억','무너진 수로','에테르 수로','불씨의 통로','물안개 회랑','잠든 골렘','파수꾼의 길','수정 정원','봉인의 문'],
  intro:[['리아','나는 병기가 아니야. 병기를 멈추기 위한 열쇠였어.'],['루나','그렇다면 이번에도 멈출 수 있어요.'],['카일','과거가 널 정하게 두지 마. 지금의 선택은 네 거야.']],
  outro:[['리아','감시자가 꺼졌어. 문이 열려.'],['네로','그리고 나쁜 소식. 우리 좌표가 새고 있었어.']]},
 {id:'c7',label:'CHAPTER 07',name:'배신자',place:'검은 첨탑',map:'tower',battles:10,soldiers:1,bless:[3,6,9],diff:[1.18,1,.17],
  names:['부서진 맹세','배신자의 흔적','거짓된 명령','나선 계단','폭풍의 층','망령의 층','검은 숲의 그림자','첨탑의 진실','대공의 날개'],
  intro:[['네로','연합군의 좌표를 넘긴 건 왕의 고문이었어.'],['브란','우리를 미끼로 썼다는 건가.'],['리아','코어가 모든 전장의 에테르를 흡수하고 있어. 전쟁 자체가 함정이야.']],
  outro:[['카일','대공이 떨어졌다. 남은 건 수도뿐이야.'],['세라','성문이 보여. 이젠 물러설 곳이 없어.']]},
 {id:'c8',label:'CHAPTER 08',name:'제국 수도',place:'북부 제국 아스켈',map:'capital',battles:10,soldiers:1,bless:[3,6,9],diff:[.89,1,.28],
  names:['제국의 성문','수도의 피난길','불타는 거리','황혼의 광장','근위 석궁대','화염 포격','강철 근위대','왕좌의 계단','왕좌 너머'],
  intro:[['세라','성문이 열렸어. 이젠 물러설 곳이 없어.'],['카일','우린 제국을 무너뜨리러 온 게 아니야. 전쟁을 끝내러 왔어.'],['리아','코어의 목소리가 가까워지고 있어. 서둘러야 해.']],
  outro:[['카일','황제는 이미 오래전에 코어의 그림자였어.'],['리아','아래로 내려가는 길이 열렸어. 마지막이야.']]},
 {id:'final',label:'FINAL',name:'마지막 아르카',place:'코어의 심층',map:'core',battles:10,soldiers:1,bless:[3,6,9],diff:[1.02,1,.1],
  names:['기억의 회랑','마지막 에테르','수정의 파도','불과 물의 방','바람의 방','골렘의 무덤','비룡의 둥지','여섯 개의 빛','심층의 문'],
  intro:[['리아','다시 나를 봉인하면 모든 걸 멈출 수 있어.'],['카일','그건 백 년 전의 답이야. 이번에는 혼자가 아니잖아.'],['리아','응. 이번에는… 모두 함께 돌아가자.']],
  outro:[['리아','코어가 잠들었어. 이번에는… 나도 여기 있어.'],['카일','돌아가자. 모두 함께.']]}
];
const JOIN=['kyle','ria','militia','hunter','apprentice'],JOIN_AT={1:['bran','shield'],2:['sera'],3:['luna','acolyte'],4:['nero']};
// Battle tuning by battle number (0-based): monster HP, attack and the size of the wave (in base-HP points).
const tuneHp=i=>1+.28*i+.011*i*i,tuneAtk=i=>1+.045*i,waveBudget=i=>300+240*i+12*i*i;
function buildChapter(def,index){
 const roster=JOIN.slice();for(let c=1;c<=index;c++)if(JOIN_AT[c])roster.push(...JOIN_AT[c]);
 const rand=seeded(index*7919+101),pool=POOLS[index].slice().sort((a,b)=>MONSTERS[a].hp*MONSTERS[a].move-MONSTERS[b].hp*MONSTERS[b].move),paths=MAPS[def.map].paths.length,battles=[];
 for(let i=0;i<def.battles;i++){const boss=i===def.battles-1,frac=def.battles>1?i/(def.battles-1):1,avail=pool.slice(0,Math.min(pool.length,2+Math.ceil(frac*(pool.length-2)))),groups=2+Math.min(3,Math.round(frac*3)),budget=waveBudget(i)*(boss?.75:1),waves=[];
  for(let j=0;j<groups;j++){const kind=j===groups-1?avail[avail.length-1]:avail[Math.floor(rand()*avail.length)],m=MONSTERS[kind],count=Math.max(2,Math.round(budget/groups/m.hp/2)),gap=+((.55+1.9/m.move*(.8+rand()*.4))*1.7).toFixed(2);
   waves.push([kind,count,gap,+(j*6.5+rand()*2).toFixed(1),null,j%paths]);}
  if(!boss&&i>=2&&(i%2===0||frac>.6)){const kind=avail[Math.max(0,avail.length-1-Math.floor(rand()*2))];waves.push([kind,frac>.7?2:1,3,+(groups*4+rand()*3).toFixed(1),'elite',Math.floor(rand()*paths)]);}
  if(boss)waves.push([0,1,0,10,'boss',0]);
  battles.push({name:boss?BOSSES[index].name:def.names[i]||`전투 ${i+1}`,boss,tune:[+(tuneHp(i)*def.diff[0]*2).toFixed(3),+(tuneAtk(i)*def.diff[1]*(1+.06*index)).toFixed(3)],waves});}
 const b=BOSSES[index];
 return {...def,index,roster,bossScale:def.diff[2]??1,startGold:220+20*index,life:20,battles,boss:b,bossIntro:[['리아',`${b.name}… 엄청난 기운이야!`],['카일',b.hint]]};
}
const CHAPTERS=CHAPTER_DEFS.map(buildChapter);

// ── Blessings (pick 1 of 3 between battles) ─────────────────────────────────────────────────────────
const BLESSINGS=[
 {id:'ember',name:'꺼지지 않는 불씨',desc:'화상·독 피해 +50%',mod:{burn:.5}},
 {id:'recruit',name:'연합의 지원',desc:'병사 배치·랭크업 비용 −20%',mod:{soldierCost:.2}},
 {id:'crystal',name:'수정의 가호',desc:'수정 생명 +5',life:5},
 {id:'guard',name:'굳건한 발',desc:'근접 영웅이 붙잡는 적 +1',mod:{heroBlock:1}},
 {id:'bounty',name:'현상금',desc:'처치 골드 +20%',mod:{bounty:.2}},
 {id:'tempo',name:'전장의 박자',desc:'모든 아군 공격 속도 +12%',mod:{haste:.12}},
 {id:'sight',name:'매의 눈',desc:'원거리 아군 사거리 +0.5칸',mod:{range:.5}},
 {id:'focus',name:'에테르 순환',desc:'스킬·필살기 재사용 시간 −20%',mod:{cdr:.2}},
 {id:'purse',name:'숨겨둔 금화',desc:'즉시 골드 +120',gold:120},
 {id:'drill',name:'실전 훈련',desc:'랭크업 비용 −15%',mod:{rankCost:.15}},
 {id:'armor',name:'단단한 갑옷',desc:'아군이 받는 피해 −15%',mod:{armor:.15}},
 {id:'mire',name:'끈적한 발밑',desc:'붙잡힌 적이 20% 더 느려짐',mod:{grip:.2}}
];

// ── Arca legacies (permanent) ───────────────────────────────────────────────────────────────────────
// Picked 1 of 3 after clearing a chapter and kept for every later chapter. Each chapter holds one legacy slot:
// clearing a chapter again lets the player swap that slot's pick, so the total never exceeds one per chapter.
// max = how many times the same legacy can stack across chapters. hero:'x' entries appear once that hero has joined.
const LEGACIES=[
 {id:'heroPower',icon:'⚔',name:'영웅의 단련',desc:'모든 영웅 공격·마법 +8%',max:3},
 {id:'heroHp',icon:'❤',name:'강철 의지',desc:'모든 영웅 최대 HP +12%',max:3},
 {id:'soldierPower',icon:'🪖',name:'연합군 훈련',desc:'병사 공격·마법·HP +12%',max:3},
 {id:'startGold',icon:'💰',name:'전쟁 자금',desc:'장 시작 골드 +60',max:3},
 {id:'life',icon:'💎',name:'수정 강화',desc:'수정 생명 +3',max:3},
 {id:'command',icon:'🪖',name:'지휘관의 위엄',desc:'병사 자리 +1',max:2},
 {id:'rankDisc',icon:'⭐',name:'숙련의 비결',desc:'랭크업 비용 −8%',max:3},
 {id:'redeploy',icon:'⏱',name:'신속한 전개',desc:'영웅 재배치 대기 시간 −25%',max:2},
 {id:'starter',icon:'🌟',name:'준비된 영웅',desc:'영웅을 처음 배치하면 ★2로 시작',max:1},
 {id:'blessChoices',icon:'✨',name:'에테르 친화',desc:'에테르 축복 선택지 4개',max:1},
 {id:'ultCdr',icon:'💥',name:'필살기 각성',desc:'필살기 재사용 시간 −15%',max:2},
 {id:'affinity',icon:'🔥',name:'원소 숙련',desc:'상성이 맞을 때 피해 ×1.25 → ×1.35',max:2},
 {id:'bounty',icon:'🪙',name:'약탈 본능',desc:'처치 골드 +10%',max:3},
 ...['kyle','ria','bran','sera','luna','nero'].map(id=>({id:'hero_'+id,hero:id,icon:'👑',name:`${UNITS[id].name}의 각성`,desc:`${UNITS[id].name} 공격·마법·HP +15%`,max:2}))
];
// Three (or `n`) legacies to offer after clearing chapter `index`, never one already at its cap. counts = {id: times taken}.
function legacyOffer(counts,index,rand,n=3){const roster=CHAPTERS[index].roster,pool=LEGACIES.filter(l=>(counts[l.id]||0)<l.max&&(!l.hero||roster.includes(l.hero))),pick=[];
 while(pick.length<n&&pool.length)pick.push(pool.splice(Math.floor(rand()*pool.length),1)[0].id);return pick;}
// The legacies an ordinary player would hold on reaching `chapter`: one per earlier chapter, taking the first of each
// offer in this order of preference. Used by the balance bot and by developer mode.
const LEGACY_PREF=['heroPower','command','heroHp','startGold','soldierPower','life','rankDisc','hero_kyle','hero_ria','bounty','affinity','ultCdr','redeploy','starter','blessChoices'];
function typicalLegacy(chapter,seed=1){const rand=seeded(seed*31+7),picks={};for(let c=0;c<chapter;c++){const offer=legacyOffer(legacyCounts(picks),c,rand);picks[c]=offer.slice().sort((a,b)=>{const ia=LEGACY_PREF.indexOf(a),ib=LEGACY_PREF.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib);})[0];}return legacyCounts(picks);}
const legacyCounts=picks=>{const c={};for(const k in picks||{})if(picks[k])c[picks[k]]=(c[picks[k]]||0)+1;return c;};

// Painted battlefield backgrounds (art/<map>.webp). Each is drawn over the guide picture from tools/make-guides.js:
// a 9:16 frame (map width + 1 tile across, centred on the field) seen from the game camera. rect = where that frame lies
// inside the painting, as fractions [left, top, right, bottom] (tools/fit-art.py measures it). bg = colour beyond the painting.
// Maps without a painting keep the three.js terrain.
const MAP_ART={
 prologue:{file:'art/prologue.webp',rect:[0.0000,-0.0023,1.0000,0.9982],bg:'#66832b'},
 fort:{file:'art/fort.webp',rect:[-0.0083,0.0023,1.0017,1.0129],bg:'#618048'},
 river:{file:'art/river.webp',rect:[-0.0042,0.0000,0.9958,1.0005],bg:'#8ea0bf'},
 forest:{file:'art/forest.webp',rect:[-0.0125,-0.0352,0.9975,0.9450],bg:'#314720'},
 city:{file:'art/city.webp',rect:[-0.0042,0.0023,0.9958,0.9929],bg:'#a5562e'}
};
const TDData={MAP_ART,RANGED_INTERVAL,RANGED_POWER,MELEE_INTERVAL,MELEE_POWER,GATE_GAP:3,seeded,LEGACIES,legacyOffer,legacyCounts,typicalLegacy,MELEE_GAP:3,SKILLS,UNITS,HERO_ORDER,SOLDIER_ORDER,RANK_COST,RANK_STAT,RANK_GUARD,REFUND,WITHDRAW_CD,DOWN_CD,ENGAGE_SLOW,MONSTERS,MODEL_TRAITS,MOVE_SPEED,ELEMENT_ICON,SCENES,MAPS,CHAPTERS,BOSSES,BLESSINGS};
if(typeof module!=='undefined'&&module.exports)module.exports=TDData;else root.TDData=TDData;
})(typeof window!=='undefined'?window:globalThis);
