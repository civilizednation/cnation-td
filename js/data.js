// cnation TD data tables. Numbers come from cnation TACTICS (HEROES / SKILLS / MONSTERS) wherever one exists.
// Loaded as a plain script in the browser (window.TDData) and with require() by the balance bot.
(function(root){
// ── Skills ──────────────────────────────────────────────────────────────────────────────────────────
// type: physical | magic. range 0 = the unit's own range. area = blast radius in tiles (0 = one target).
// cd = seconds between automatic casts (TACTICS MP cost → 2.5 + mp × 0.4). ult:true = cast by the player.
const SKILLS={
 flame:{name:'화염검',type:'physical',power:1.3,element:'fire',status:'burn',chance:.6,cd:5.3,fx:'slash'},
 flame2:{name:'화염검·열화',type:'physical',power:1.6,element:'fire',status:'burn',chance:1,cd:5.3,fx:'slash'},
 break:{name:'갑옷 가르기',type:'physical',power:1.4,status:'defdown',chance:1,cd:6.1,fx:'slash'},
 iceblade:{name:'얼음 베기',type:'physical',power:1.35,element:'water',status:'slow',chance:1,cd:5.7,fx:'slash'},
 stormblade:{name:'폭풍 베기',type:'physical',power:1.45,area:1.2,element:'wind',knockback:.9,cd:7.3,fx:'slash'},
 arcaslash:{name:'아르카 참격',type:'physical',power:2.2,area:3,self:true,element:'light',cd:30,ult:true,fx:'nova'},
 fire:{name:'파이어',type:'magic',power:1.25,area:1.1,element:'fire',status:'burn',chance:.3,cd:5.7,fx:'blast'},
 ice:{name:'프로스트',type:'magic',power:1.15,area:1.1,element:'ice',status:'freeze',chance:.45,cd:6.5,fx:'blast'},
 ice2:{name:'프로스트·빙옥',type:'magic',power:1.25,area:1.5,element:'ice',status:'freeze',chance:.8,cd:6.5,fx:'blast'},
 storm:{name:'파이어 스톰',type:'magic',power:1.35,area:1.9,element:'fire',status:'burn',chance:.5,cd:12,fx:'blast'},
 whirlwind:{name:'회오리 폭풍',type:'magic',power:1.2,area:1.9,element:'wind',status:'slow',chance:1,cd:11,fx:'blast'},
 thunder:{name:'썬더',type:'magic',power:1.6,range:3.5,element:'thunder',status:'stun',chance:.4,cd:7.7,fx:'bolt'},
 meteor:{name:'메테오',type:'magic',power:1.98,area:2.1,element:'fire',status:'burn',chance:1,cd:35,ult:true,aim:true,fx:'meteor'}
};

// ── Deployable characters ───────────────────────────────────────────────────────────────────────────
// ranks[n] = what rank n+1 adds. choice = the ★3 element engraving (one of three).
const UNITS={
 kyle:{name:'카일',job:'검사',icon:'⚔',kind:'hero',melee:true,block:2,cost:100,maxRank:5,
  hp:108,atk:25,def:16,mag:10,res:12,spd:12,crit:.10,range:1,
  model:{heroId:'kyle',hair:0x855537},
  ranks:[{skills:['flame']},{skills:['break']},
   {choice:{fire:{label:'🔥 불',swap:['flame','flame2'],desc:'화염검이 반드시 화상을 입히고 더 강해집니다.'},
            water:{label:'💧 물',skills:['iceblade'],desc:'얼음 베기: 맞은 적이 느려집니다.'},
            wind:{label:'🪽 바람',skills:['stormblade'],desc:'폭풍 베기: 주변 적을 함께 베고 밀어냅니다.'}}},
   {aura:{stat:'atk',mult:1.25,radius:2},auraName:'용기의 맹세',desc:'주변 2칸 아군 공격 +25%'},
   {ult:'arcaslash'}],
  role:'길 위에서 적을 막는 근접 검사. 화상과 방어 깎기로 화력을 끌어올립니다.'},
 ria:{name:'리아',job:'마도사',icon:'✦',kind:'hero',melee:false,block:0,cost:140,maxRank:5,magic:true,
  hp:74,atk:10,def:8,mag:30,res:22,spd:11,crit:.10,range:2.5,
  model:{heroId:'ria',hair:0xe4e4ee},
  ranks:[{skills:['fire']},{skills:['ice']},
   {choice:{fire:{label:'🔥 불',skills:['storm'],desc:'파이어 스톰: 넓은 범위를 불태웁니다.'},
            water:{label:'💧 물',swap:['ice','ice2'],desc:'프로스트가 더 넓어지고 더 자주 얼립니다.'},
            wind:{label:'🪽 바람',skills:['whirlwind'],desc:'회오리 폭풍: 넓은 범위를 느리게 만듭니다.'}}},
   {skills:['thunder']},
   {ult:'meteor'}],
  role:'넓은 범위를 공격하는 마도사. 무리 지은 적과 비행하는 적에게 강합니다.'},
 militia:{name:'민병',job:'연합군',icon:'🛡',kind:'soldier',melee:true,block:1,cost:50,maxRank:3,
  hp:72,atk:15,def:10,mag:5,res:8,spd:11,crit:.05,range:1,
  model:{heroId:'kyle',hair:0x5b4a3a,hpal:[0x8a7a5c,0x5a4b3a,0xb9b39c],scale:.86},
  ranks:[{},{},{blockBonus:1,desc:'저지 +1'}],
  role:'싸고 튼튼한 근접 병사. 빈 길목을 메웁니다.'},
 hunter:{name:'사냥꾼',job:'연합군',icon:'🏹',kind:'soldier',melee:false,block:0,cost:60,maxRank:3,
  hp:55,atk:17,def:6,mag:5,res:8,spd:13,crit:.08,range:3,
  model:{heroId:'sera',hair:0x7a5a3c,hpal:[0x7d8a5a,0x5d4a36,0xb9a26a],scale:.86},
  ranks:[{},{},{haste:.25,desc:'공격 속도 +25%'}],
  role:'멀리서 한 마리씩 쏘는 궁수. 비행하는 적을 맞힐 수 있습니다.'},
 apprentice:{name:'수습 마도사',job:'연합군',icon:'✧',kind:'soldier',melee:false,block:0,cost:80,maxRank:3,magic:true,
  hp:50,atk:5,def:5,mag:17,res:12,spd:10,crit:.05,range:2.5,
  model:{heroId:'ria',hair:0x6b4a3a,hpal:[0x6f88b5,0x3f4f78,0xcdbb7a],scale:.86},
  ranks:[{},{},{splash:.8,desc:'공격이 주변으로 퍼짐'}],
  role:'마법 피해를 주는 병사. 갑옷이 두꺼운 적에게 좋습니다.'}
};
const RANK_COST=[1,.8,1.2,1.8,2.5];      // × deploy cost, index = rank reached − 1
const RANK_STAT=.25,RANK_GUARD=.15;      // per rank: +25% HP/ATK/MAG, +15% DEF/RES
const REFUND=.7,WITHDRAW_CD=20,DOWN_CD=30;

// ── Monsters (TACTICS MONSTERS, same index) ─────────────────────────────────────────────────────────
const MONSTERS={
 0:{name:'이끼 슬라임',model:'slime',color:0x8cc87d,hp:44,atk:14,def:7,mag:9,res:8,range:1,move:3,element:'wind'},
 1:{name:'고블린',model:'goblin',color:0xb4ab62,hp:63,atk:19,def:9,mag:7,res:7,range:1,move:4},
 2:{name:'서리 늑대',model:'wolf',color:0xafc9d3,hp:60,atk:21,def:9,mag:8,res:10,range:1,move:5,element:'water'},
 10:{name:'붉은 진흙 슬라임',model:'slime',color:0xb98255,hp:57,atk:17,def:11,mag:8,res:8,range:1,move:3,element:'fire'},
 11:{name:'모래 약탈자',model:'goblin',color:0xc3975f,hp:69,atk:23,def:10,mag:8,res:9,range:1,move:4},
 12:{name:'회오리 매',model:'dragon',color:0x9cbea9,hp:54,atk:22,def:8,mag:19,res:13,range:2,move:5,element:'wind',flying:true}
};
// What each model does on the road.
const MODEL_TRAITS={
 slime:{split:true,note:'죽으면 둘로 갈라집니다'},
 goblin:{note:'평범한 무리'},
 wolf:{note:'빠르게 돌파합니다'},
 dragon:{note:'비행: 막을 수 없고 근접 공격이 닿지 않습니다'}
};
const MOVE_SPEED=.22;                    // tiles per second per MOVE point
const ELEMENT_ICON={fire:'🔥',water:'💧',ice:'❄',wind:'🪽',thunder:'⚡',light:'✨',dark:'🌑'};

// ── Maps ───────────────────────────────────────────────────────────────────────────────────────────
// rows: '.' 평지  '^' 고지대  'f' 숲  'w' 물  'x' 바위. The road is laid over them from `path` (tile waypoints).
const MAPS={
 prologue:{w:9,h:14,
  rows:['..f...f..',
        '.........',
        '..^...^.f',
        'f...^....',
        '.........',
        '..^....f.',
        'f...^....',
        '.........',
        '...^..^..',
        'f.....f..',
        '.........',
        '.f..^...w',
        '......fww',
        '......www'],
  path:[[1,-1],[1,1],[7,1],[7,4],[1,4],[1,7],[7,7],[7,10],[3,10],[3,14]],
  swamp:[[3,4],[4,4],[5,4]],
  scene:{land:0x85b08b,high:0xa9b79a,road:0xcbb998,swamp:0x677f77,forest:0x669a7b,water:0x20576a,sky:0xc9dfc9}}
};

// ── Chapters ───────────────────────────────────────────────────────────────────────────────────────
// battles[n].waves = [monsterId, count, gap seconds, start delay, flags]. flags: 'elite' | 'boss'.
// tune = [hp multiplier, attack multiplier] for that battle.
const CHAPTERS=[
 {id:'prologue',label:'PROLOGUE',name:'깨어난 빛',place:'국경 마을 에린',map:'prologue',
  roster:['kyle','ria','militia','hunter','apprentice'],command:6,startGold:220,life:20,
  intro:[['카일','이런 곳에 사람이… 괜찮아? 내 목소리 들려?'],['리아','리아… 내 이름은 리아. 그 외에는 아무것도 기억나지 않아.'],['카일','뒤에서 뭔가 움직여. 내 곁에 있어. 마을까지는 한 마리도 못 지나가게 하자.']],
  outro:[['리아','끝났어…? 저 수정이 무사해.'],['카일','응. 하지만 이건 시작일 뿐이야. 남문 쪽에서 연기가 올라오고 있어.']],
  bossIntro:[['리아','땅이 울려… 엄청나게 큰 게 오고 있어!'],['카일','갈라지기 전에 한꺼번에 태워야 해. 리아, 네 마법이 필요해.']],
  battles:[
   {name:'유적의 문',tune:[1,1],waves:[[0,9,1.6,0]]},
   {name:'숲길의 소란',tune:[1.15,1],waves:[[0,7,1.4,0],[1,6,1.5,7]]},
   {name:'고블린 정찰대',tune:[1.35,1.05],waves:[[1,11,1.2,0],[0,6,1.1,9]]},
   {name:'붉은 진흙',tune:[1.6,1.1],waves:[[10,9,1.3,0],[1,8,1.1,7],[2,4,1.1,15]]},
   {name:'서리 늑대 떼',tune:[1.9,1.15],waves:[[2,9,.9,0],[1,8,1.1,6],[1,1,0,15,'elite'],[2,5,.8,20]]},
   {name:'넘쳐나는 슬라임',tune:[2.3,1.2],waves:[[0,16,.65,0],[11,8,1.2,8],[10,8,.85,16],[11,1,0,24,'elite']]},
   {name:'하늘의 그림자',tune:[2.7,1.25],waves:[[11,9,1.1,0],[12,6,1.4,5],[2,7,.85,14],[12,4,1.2,22]]},
   {name:'약탈자 본대',tune:[3.2,1.3],waves:[[10,11,.85,0],[11,10,1,6],[12,5,1.3,10],[2,2,2,18,'elite'],[11,6,.9,24]]},
   {name:'마을로 돌아가는 길',tune:[3.8,1.4],waves:[[2,9,.75,0],[11,11,.95,5],[0,14,.55,12],[12,6,1.1,16],[11,2,3,22,'elite'],[2,6,.7,30]]},
   {name:'거대 이끼 슬라임',tune:[4.4,1.5],boss:true,waves:[[1,9,1,0],[10,9,.85,6],[0,1,0,12,'boss'],[2,7,.9,20],[12,5,1.3,26],[11,6,1,34]]}
  ]}
];
// Prologue boss (new for TD): a huge moss slime that keeps splitting — giant → big → normal → tiny.
const BOSSES={prologue:{base:0,name:'거대 이끼 슬라임',hp:32,atk:1.6,scale:2.3,move:2,gold:60}};

// ── Blessings (pick 1 of 3 after battles 3, 6 and 9) ────────────────────────────────────────────────
const BLESSING_AFTER=[3,6,9];
const BLESSINGS=[
 {id:'ember',name:'꺼지지 않는 불씨',desc:'화상 피해 +50%',mod:{burn:.5}},
 {id:'recruit',name:'연합의 지원',desc:'병사 배치·랭크업 비용 −20%',mod:{soldierCost:.2}},
 {id:'crystal',name:'수정의 가호',desc:'수정 생명 +5',life:5},
 {id:'guard',name:'굳건한 발',desc:'카일 저지 +1',mod:{kyleBlock:1}},
 {id:'bounty',name:'현상금',desc:'처치 골드 +20%',mod:{bounty:.2}},
 {id:'tempo',name:'전장의 박자',desc:'모든 아군 공격 속도 +12%',mod:{haste:.12}},
 {id:'sight',name:'매의 눈',desc:'원거리 아군 사거리 +0.5칸',mod:{range:.5}},
 {id:'focus',name:'에테르 순환',desc:'스킬·궁극기 재사용 시간 −20%',mod:{cdr:.2}},
 {id:'purse',name:'숨겨둔 금화',desc:'즉시 골드 +120',gold:120},
 {id:'drill',name:'실전 훈련',desc:'랭크업 비용 −15%',mod:{rankCost:.15}}
];

const TDData={SKILLS,UNITS,RANK_COST,RANK_STAT,RANK_GUARD,REFUND,WITHDRAW_CD,DOWN_CD,MONSTERS,MODEL_TRAITS,MOVE_SPEED,ELEMENT_ICON,MAPS,CHAPTERS,BOSSES,BLESSING_AFTER,BLESSINGS};
if(typeof module!=='undefined'&&module.exports)module.exports=TDData;else root.TDData=TDData;
})(typeof window!=='undefined'?window:globalThis);
