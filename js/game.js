// cnation TD screen: 3D battlefield (three.js, fixed tilted top view), 2D overlay (bars, effects, ranges), dock, panels, saves.
// All rules live in sim.js; this file only sends commands to it and draws what it reports.
(function(){
const THREE=CNATION3D,D=TDData,M=TDModels,{createSim}=TDSim;
const GAME_VERSION='0.1.0',SAVE_KEY='cnation-td-save-v1',CLEAR_KEY='cnation-td-clear-v1';
const $=s=>document.querySelector(s),app=$('#app'),viewport=$('#viewport'),glc=$('#gl'),fxc=$('#fx'),ctx=fxc.getContext('2d');
const ELEV=58*Math.PI/180,SIN=Math.sin(ELEV),COS=Math.cos(ELEV),HIGH=.35;
const EL_COLOR={fire:'#ff8a3d',water:'#6fd0ff',ice:'#a9ecff',wind:'#a6f2c6',thunder:'#ffe66b',light:'#fff3b0',dark:'#c7a3ff'};
const ST_COLOR={burn:'#ff8a3d',freeze:'#a9ecff',slow:'#6fa8ff',stun:'#ffe66b',defdown:'#d79cff'};

let S=null,speed=1,paused=false,selCard=null,selUnit=null,aiming=null,hover=null,dragging=false,validTiles=null,modalOpen=false;
let vw=1,vh=1,pxU=40,tz=-.4,dpr=1;
const objs=new Map(),dying=[],fx=[];

// ── Renderer ──
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:glc,antialias:true,powerPreference:'high-performance'});}
catch(e){document.body.innerHTML='<p style="padding:24px">3D 화면을 열 수 없어요. WebGL이 지원되는 Safari 또는 Chrome에서 다시 열어 주세요.</p>';throw e;}
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-5,5,8,-8,.1,200);
scene.add(new THREE.HemisphereLight(0xe4f0ce,0x203844,2.05));const sun=new THREE.DirectionalLight(0xffedc7,2.5);sun.position.set(-5,12,6);scene.add(sun);
const terrainGroup=new THREE.Group(),unitGroup=new THREE.Group();scene.add(terrainGroup,unitGroup);let water=null;
const wx=x=>x-(S.map.w-1)/2,wz=y=>y-(S.map.h-1)/2;
const tileTop=t=>!t?0:t.terrain==='high'?HIGH:t.road?-.04:t.terrain==='water'?-.14:0;
const groundY=(x,y)=>tileTop(S.map.tile(Math.round(x),Math.round(y)));
// Orthographic camera → the projection is a straight formula (no raycasting needed).
const proj=(x,y,h=0)=>({x:vw/2+wx(x)*pxU,y:vh/2+((wz(y)-tz)*SIN-h*COS)*pxU});
const unproj=(sx,sy)=>({x:(sx-vw/2)/pxU+(S.map.w-1)/2,y:(sy-vh/2)/(pxU*SIN)+tz+(S.map.h-1)/2});
function resize(){const r=viewport.getBoundingClientRect();vw=Math.max(1,r.width);vh=Math.max(1,r.height);dpr=Math.min(2,window.devicePixelRatio||1);
 renderer.setPixelRatio(dpr);renderer.setSize(vw,vh,false);fxc.width=Math.round(vw*dpr);fxc.height=Math.round(vh*dpr);
 if(!S)return;pxU=Math.min(vw/(S.map.w+.25),vh/(S.map.h*SIN+1.5));const hw=vw/(2*pxU),hh=vh/(2*pxU);
 camera.left=-hw;camera.right=hw;camera.top=hh;camera.bottom=-hh;camera.position.set(0,60*SIN,tz+60*COS);camera.lookAt(0,0,tz);camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);

function disposeGroup(g){for(const c of [...g.children]){g.remove(c);c.traverse(o=>{if(o.geometry&&!o.userData.shared)o.geometry.dispose();if(o.material&&o.material!==M.sharedMat&&o.material!==M.ghostMat&&!o.userData.shared)o.material.dispose?.();});}}
function buildTerrain(){disposeGroup(terrainGroup);const map=S.map,sc=map.scene,rand=(seed=>()=>{seed=seed*1664525+1013904223|0;return ((seed>>>0)%10000)/10000;})(map.w*977+map.h);
 scene.background=new THREE.Color(sc.sky);
 // Playable tiles plus a scenery apron so the field never ends in a hard edge.
 const cells=[],padX=4,padTop=6,padBottom=5,first=map.path[0],last=map.path[map.path.length-1];
 for(let r=-padTop;r<map.h+padBottom;r++)for(let c=-padX;c<map.w+padX;c++){const t=map.tile(c,r);let terrain=t?t.terrain:'grass',apron=!t;
  if(apron){if((c===first[0]&&r<0)||(c===last[0]&&r>=map.h))terrain='road';else if(rand()<.34)terrain='forest';}
  cells.push({c,r,terrain,apron,road:t?t.road:terrain==='road'});}
 const colors={grass:sc.land,high:sc.high,forest:sc.forest,water:sc.water,road:sc.road,swamp:sc.swamp,rock:0x9bafa7};
 const geom=new THREE.BoxGeometry(.975,1,.975),ca=new Float32Array(geom.attributes.position.count*3);
 for(let i=0;i<geom.attributes.position.count;i++){const f=geom.attributes.normal.getY(i)>.5?1:.64;ca.set([f,f,f],i*3);}geom.setAttribute('color',new THREE.BufferAttribute(ca,3));
 const mesh=new THREE.InstancedMesh(geom,new THREE.MeshLambertMaterial({vertexColors:true}),cells.length),dummy=new THREE.Object3D(),col=new THREE.Color(),waterPlaces=[],trees=[],props=[];
 cells.forEach((t,i)=>{const top=t.terrain==='high'?HIGH:t.road?-.04:t.terrain==='water'?-.14:0,height=1+top;dummy.position.set(wx(t.c),top-height/2,wz(t.r));dummy.scale.set(1,height,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  col.set(colors[t.terrain]||sc.land);if(t.apron)col.multiplyScalar(.9);else if((t.c+t.r)%2&&!t.road&&t.terrain!=='water')col.multiplyScalar(.965);mesh.setColorAt(i,col);
  const x=wx(t.c),z=wz(t.r);
  if(t.terrain==='water')waterPlaces.push(new THREE.Vector3(x,0,z));
  else if(t.terrain==='forest'){const s=t.apron?1.15:1;trees.push(['cyl',[x-.2,.23,z-.2],[.055,.48,.055],0x756c4d]);trees.push(['cone',[x-.2,.65*s,z-.2],[.32*s,.72*s,.32*s],0x3a6f5d]);trees.push(['cone',[x-.2,.92*s,z-.2],[.24*s,.5*s,.24*s],0x5d9270]);
   if(t.apron&&rand()<.6){trees.push(['cyl',[x+.25,.2,z+.22],[.05,.4,.05],0x756c4d]);trees.push(['cone',[x+.25,.6,z+.22],[.27,.62,.27],0x4a7d63]);}}
  else if(t.terrain==='swamp'){props.push(['cyl',[x-.08,-.03,z+.04],[.32,.018,.32],0x476d68]);for(const [a,b] of [[-.31,-.26],[.25,-.1],[.32,.28]])props.push(['cyl',[x+a,.11,z+b],[.012,.28,.012],0x9ebc7b]);}
  else if(t.terrain==='high'){for(const [a,b] of [[-.4,-.4],[.4,-.4],[-.4,.4],[.4,.4]])props.push(['rock',[x+a,HIGH+.02,z+b],[.09,.07,.09],0xd9dcc6]);}
  else if(t.terrain==='grass'&&!t.road&&rand()<.1)props.push(['rock',[x-.3,.05,z-.28],[.1,.1,.11],0xa6b3a0]);});
 mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;terrainGroup.add(mesh);
 // Ruined gate where the monsters come in, the Arca crystal they must not reach.
 const gx=wx(first[0]),gz=wz(-1.2);for(const s of [-1,1]){props.push(['box',[gx+s*.62,.75,gz],[.3,1.5,.3],0xcfc9b0]);props.push(['rock',[gx+s*.62,1.6,gz],[.2,.18,.2],0xb9b39c]);}props.push(['box',[gx,1.42,gz],[1.5,.2,.3],0xd9d3ba]);
 const cx=wx(last[0]),cz=wz(map.h+.1);props.push(['cyl',[cx,.08,cz],[.62,.16,.62],0xcfd6cb]);props.push(['rock',[cx,.75,cz],[.3,.6,.3],0x8be1bf]);props.push(['rock',[cx,.8,cz],[.2,.44,.2],0xdffcf0]);for(const s of [-1,1])props.push(['rock',[cx+s*.5,.3,cz+.1],[.13,.26,.13],0x9be6d2]);
 if(trees.length)terrainGroup.add(new THREE.Mesh(M.bake(trees),M.sharedMat));terrainGroup.add(new THREE.Mesh(M.bake(props),M.sharedMat));
 water=M.makeWaterSurface(waterPlaces.map(p=>({x:p.x,y:-.065,z:p.z})));if(water)terrainGroup.add(water);}

// ── Models ──
const protoCache=new Map();
function modelFor(key,spec){let p=protoCache.get(key);if(!p){p=M.figure(spec);p.traverse(o=>{o.userData.shared=true;});protoCache.set(key,p);}const g=p.clone();g.userData.body=g.children[0];return g;}
const unitSpec=def=>({...D.UNITS[def].model,team:'ally',name:D.UNITS[def].name});
const enemySpec=e=>({model:e.model,color:e.color,name:D.MONSTERS[e.kind].name,elite:e.elite,team:'enemy',scale:e.scale||(e.elite?1.3:null)});
function clearObjects(){for(const o of objs.values())unitGroup.remove(o.g);objs.clear();for(const d of dying)unitGroup.remove(d.g);dying.length=0;fx.length=0;}
const portraits={};
function makePortraits(){const size=160,pr=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});pr.setSize(size,size,false);pr.outputColorSpace=THREE.SRGBColorSpace;
 const ps=new THREE.Scene(),pc=new THREE.OrthographicCamera(-.62,.62,.62,-.62,.1,20);ps.add(new THREE.HemisphereLight(0xe4f0ce,0x203844,2.4));const l=new THREE.DirectionalLight(0xffedc7,3);l.position.set(-3,6,4);ps.add(l);
 for(const id in D.UNITS){const g=M.figure(unitSpec(id));g.children.slice(1).forEach(c=>{c.visible=false;});g.rotation.y=.35;ps.add(g);pc.position.set(0,1.05,5);pc.lookAt(0,.72,0);pr.render(ps,pc);portraits[id]=pr.domElement.toDataURL('image/png');ps.remove(g);}
 pr.dispose();pr.forceContextLoss?.();}

// ── Sound (tiny synthesized blips; no files) ──
let ac=null,lastHit=0;
function sfx(kind){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();const now=ac.currentTime;if(kind==='hit'){if(now-lastHit<.07)return;lastHit=now;}
 const P={hit:[190,90,.05,.05,'triangle'],place:[330,520,.12,.12,'sine'],coin:[880,1320,.08,.05,'sine'],rank:[440,880,.22,.12,'triangle'],leak:[220,70,.4,.2,'sawtooth'],ult:[120,640,.5,.18,'sawtooth'],win:[523,1046,.6,.14,'triangle'],err:[160,120,.12,.1,'square'],tap:[600,500,.04,.05,'sine']}[kind];if(!P)return;
 const o=ac.createOscillator(),g=ac.createGain();o.type=P[4];o.frequency.setValueAtTime(P[0],now);o.frequency.exponentialRampToValueAtTime(P[1],now+P[2]);g.gain.setValueAtTime(P[3],now);g.gain.exponentialRampToValueAtTime(.001,now+P[2]);o.connect(g).connect(ac.destination);o.start(now);o.stop(now+P[2]+.02);}catch(e){}}

// ── HUD, strip, dock, panel ──
let toastTimer=0;function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),1800);}
let bannerTimer=0;function banner(small,strong){const b=$('#banner');b.children[0].textContent=small;b.children[1].textContent=strong;b.classList.add('on');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>b.classList.remove('on'),1700);}
const stars=n=>'★'.repeat(n)+'☆'.repeat(Math.max(0,5-n));
let hudKey='';
function updateHud(){const key=[S.life,S.gold,S.units.length,S.battle,S.phase,Math.ceil(S.prep),S.enemies.length+S.queue.length,speed,paused].join('|');if(key===hudKey)return;hudKey=key;
 $('#hudLife').textContent=S.life;$('#hudGold').textContent=S.gold;$('#hudUnits').textContent=`${S.units.length}/${S.chapter.command}`;
 const b=S.chapter.battles[S.battle];$('#hudBattle').textContent=`${S.battle+1}/${S.chapter.battles.length} ${b?b.name:''}`;
 $('#speedBtn').textContent='×'+speed;$('#pauseBtn').textContent=paused?'▶':'⏸';
 const start=$('#startBtn');if(S.phase==='prep'){start.hidden=false;const bonus=S.battle>0?Math.floor(S.prep):0;start.textContent=bonus>0?`전투 시작 +${bonus}💰`:'전투 시작';}else start.hidden=true;
 if(S.phase==='battle'){const left=S.enemies.length+S.queue.length,chips=$('#chips');chips.innerHTML=`<span class="chip">⚔ 전투 중 · 남은 적 <b>${left}</b></span>`+(S.blessings.length?`<span class="chip">✨ 축복 ${S.blessings.length}</span>`:'');}
 refreshDock();if(selUnit)refreshPanel();}
function showPreview(){const chips=$('#chips'),list=S.preview();chips.innerHTML=list.map(p=>`<span class="chip${p.elite?' elite':''}${p.boss?' boss':''}">${p.boss?'👑 ':''}${p.name} ×${p.count}${p.element?' '+D.ELEMENT_ICON[p.element]:''}${p.flying?' <i>비행</i>':''}</span>`).join('');chips.scrollLeft=0;}
function buildDock(){const dock=$('#dock');dock.innerHTML='';for(const id of S.chapter.roster){const d=D.UNITS[id],el=document.createElement('div');el.className='card';el.dataset.id=id;
  el.innerHTML=`<img alt="" src="${portraits[id]}">${d.kind==='hero'?'<span class="hero">★영웅</span>':''}<div class="nm">${d.name}</div><div class="ct"></div>`;
  el.addEventListener('pointerdown',e=>cardDown(e,id));dock.appendChild(el);}refreshDock();}
function refreshDock(){for(const el of $('#dock').children){const id=el.dataset.id,d=D.UNITS[id],hero=S.hero[id],out=d.kind==='hero'&&S.units.some(u=>u.def===id),cost=S.deployCost(id),cd=hero?Math.ceil(hero.cd):0;
  const off=!out&&(S.gold<cost||S.units.length>=S.chapter.command||cd>0);el.className='card'+(selCard===id?' sel':'')+(off?' off':'')+(out?' out':'');
  el.querySelector('.ct').textContent=out?'전장에 있음':hero&&hero.keep&&!cd?'복귀 가능':cost+'💰';
  let cool=el.querySelector('.cool');if(cd>0){if(!cool){cool=document.createElement('div');cool.className='cool';el.appendChild(cool);}cool.textContent=cd+'초';}else if(cool)cool.remove();}}
function skillNames(u){return u.skills.map(s=>D.SKILLS[s.id].name);}
function nextRankText(u){const d=S.defOf(u),k=d.ranks[u.rank];if(!k)return '최대 랭크에 도달했습니다.';const bits=['능력치 +25%'];if(k.skills)bits.push('스킬 '+k.skills.map(s=>D.SKILLS[s].name).join(', '));if(k.choice)bits.push('속성 각인 선택');if(k.aura)bits.push(`${k.auraName}(${k.desc})`);else if(k.desc)bits.push(k.desc);if(k.ult)bits.push('궁극기 '+D.SKILLS[k.ult].name);return `다음 ★${u.rank+1}: `+bits.join(' · ');}
let panelKey='';
function refreshPanel(force){const u=S.units.find(v=>v.id===selUnit);if(!u){closePanel();return;}const d=S.defOf(u),cost=S.rankCost(u),choice=S.needsChoice(u),ultReady=u.ult&&u.ultCd<=0;
 const key=[u.id,u.rank,cost,S.gold>=cost,Math.round(u.hp),Math.ceil(u.ultCd),aiming,choice].join('|');if(!force&&key===panelKey)return;panelKey=key;
 const kit=[...skillNames(u),u.aura?'용기의 맹세':null].filter(Boolean).join(', ');
 let btns='';
 if(choice&&cost!=null){const ch=d.ranks[u.rank].choice;btns+=Object.keys(ch).map(k=>`<button class="primary" data-act="rank" data-choice="${k}" ${S.gold<cost?'disabled':''}>${ch[k].label} ${cost}</button>`).join('');}
 else if(cost!=null)btns+=`<button class="primary" data-act="rank" ${S.gold<cost?'disabled':''}>랭크업 ${cost}💰</button>`;
 if(u.ult)btns+=`<button class="ult" data-act="ult" ${ultReady&&S.phase==='battle'?'':'disabled'}>${aiming===u.id?'위치 지정 중':ultReady?D.SKILLS[u.ult].name:D.SKILLS[u.ult].name+' '+Math.ceil(u.ultCd)+'초'}</button>`;
 btns+=`<button data-act="withdraw">철수 +${S.refundOf(u)}</button><button class="x" data-act="close">×</button>`;
 const line2=choice?'★3 속성 각인: '+Object.values(d.ranks[u.rank].choice).map(c=>c.label+' '+c.desc.split(':')[0]).join(' / '):nextRankText(u);
 $('#panel').innerHTML=`<img alt="" src="${portraits[u.def]}"><div class="info"><h3>${d.name} <span>${stars(u.rank).slice(0,d.maxRank)}</span> · HP ${Math.max(0,Math.round(u.hp))}/${u.maxHp}</h3><p>공격 ${Math.round((d.magic?u.mag:u.atk)*u.buff)} · 사거리 ${u.range}${u.block?' · 저지 '+u.block:''}${kit?' · '+kit:''}</p><p class="next">${line2}</p><div class="btns">${btns}</div></div>`;}
function openPanel(id){selUnit=id;selCard=null;aiming=null;validTiles=null;app.classList.add('unit-open');panelKey='';refreshPanel(true);}
function closePanel(){selUnit=null;aiming=null;$('#aimHint').style.display='none';app.classList.remove('unit-open');}
$('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const act=b.dataset.act,u=S.units.find(v=>v.id===selUnit);if(!u)return closePanel();
 if(act==='close'){sfx('tap');closePanel();}
 else if(act==='rank'){const err=S.rankUp(u.id,b.dataset.choice);if(err){toast(err);sfx('err');}else{sfx('rank');refreshPanel(true);}}
 else if(act==='withdraw'){S.withdraw(u.id);sfx('coin');closePanel();}
 else if(act==='ult'){const s=D.SKILLS[u.ult];if(s.aim){aiming=aiming===u.id?null:u.id;$('#aimHint').style.display=aiming?'block':'none';refreshPanel(true);}else{const err=S.ult(u.id);if(err){toast(err);sfx('err');}else closePanel();}}
 hudKey='';});

// ── Placing characters ──
function selectCard(id){if(S.units.some(u=>u.def===id&&D.UNITS[id].kind==='hero')){openPanel(S.units.find(u=>u.def===id).id);return;}closePanel();selCard=id;validTiles=S.map.tiles.filter(t=>{const e=S.canDeploy(id,t.c,t.r);return !e||e==='골드가 부족합니다';});refreshDock();}
function clearCard(){selCard=null;validTiles=null;hover=null;dragging=false;refreshDock();}
function tryDeploy(c,r){const id=selCard,err=S.deploy(id,c,r);if(err){toast(err);sfx('err');return false;}sfx('place');const d=D.UNITS[id];if(d.kind==='soldier'&&S.gold>=S.deployCost(id)&&S.units.length<S.chapter.command)selectCard(id);else clearCard();hudKey='';return true;}
const localPoint=e=>{const r=viewport.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top,inside:e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom};};
const tileAt=p=>{const w=unproj(p.x,p.y),c=Math.round(w.x),r=Math.round(w.y);return S.map.tile(c,r)?{c,r}:null;};
let down=null;
function cardDown(e,id){if(modalOpen||!S)return;e.preventDefault();sfx('tap');selectCard(id);if(selCard!==id)return;down={x:e.clientX,y:e.clientY,card:true};dragging=false;}
window.addEventListener('pointermove',e=>{if(!S||!selCard||!down||!down.card)return;if(!dragging&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10)dragging=true;if(dragging){const p=localPoint(e);hover=p.inside?tileAt({x:p.x,y:p.y-pxU*.6}):null;}});
window.addEventListener('pointerup',e=>{if(!S||!down||!down.card)return;const wasDrag=dragging;down=null;if(wasDrag&&selCard){dragging=false;const p=localPoint(e),t=p.inside?tileAt({x:p.x,y:p.y-pxU*.6}):null;hover=null;if(t)tryDeploy(t.c,t.r);}});
fxc.addEventListener('pointerdown',e=>{if(modalOpen||!S)return;const p=localPoint(e);
 if(aiming){const w=unproj(p.x,p.y),err=S.ult(aiming,w.x,w.y);if(err){toast(err);sfx('err');}aiming=null;$('#aimHint').style.display='none';closePanel();return;}
 if(selCard){const t=tileAt(p);if(t)tryDeploy(t.c,t.r);else clearCard();return;}
 // Tap a character: test the bodies first (they stand taller than their tile), then the tile.
 let best=null;for(const u of S.units){const s=proj(u.x,u.y,groundY(u.x,u.y)+.5),d=Math.hypot(s.x-p.x,s.y-p.y);if(d<pxU*.55&&(!best||d<best.d))best={u,d};}
 if(best){sfx('tap');openPanel(best.u.id);}else closePanel();});
$('#startBtn').addEventListener('click',()=>{if(S.phase!=='prep')return;if(!S.units.length){toast('먼저 동료를 한 명 이상 배치하세요');sfx('err');return;}S.startBattle();sfx('rank');});
$('#speedBtn').addEventListener('click',()=>{speed=speed%3+1;hudKey='';sfx('tap');});
$('#pauseBtn').addEventListener('click',()=>{paused=!paused;hudKey='';sfx('tap');});

// ── Modals ──
function modal(html,cls){const m=$('#modal');m.className=cls||'';m.innerHTML=`<div class="sheet">${html}</div>`;m.hidden=false;modalOpen=true;return m;}
function closeModal(){$('#modal').hidden=true;modalOpen=false;}
function dialogue(lines,done){let i=0;const show=()=>{const [who,text]=lines[i],m=modal(`<p class="sub">${S.chapter.label} · ${S.chapter.name}</p><p class="who">${who}</p><p class="line">${text}</p><button class="primary">${i<lines.length-1?'다음':'확인'}</button><button data-skip>건너뛰기</button>`);
  m.querySelector('.primary').onclick=()=>{sfx('tap');if(++i<lines.length)show();else{closeModal();done&&done();}};m.querySelector('[data-skip]').onclick=()=>{closeModal();done&&done();};};show();}
function blessingModal(){const m=modal(`<p class="sub">에테르 축복</p><h2>하나를 고르세요</h2>`+S.offer.map(id=>{const b=D.BLESSINGS.find(v=>v.id===id);return `<button data-id="${id}">✨ ${b.name}<small>${b.desc}</small></button>`;}).join(''));
 m.querySelectorAll('button').forEach(b=>b.onclick=()=>{S.chooseBlessing(b.dataset.id);sfx('rank');closeModal();hudKey='';});}
function resultModal(won){const ch=S.chapter;if(won){const n=S.leaksTotal===0?3:S.life>=Math.ceil(ch.life*.75)?2:1;try{const best=JSON.parse(localStorage.getItem(CLEAR_KEY)||'{}');best[ch.id]=Math.max(best[ch.id]||0,n);localStorage.setItem(CLEAR_KEY,JSON.stringify(best));localStorage.removeItem(SAVE_KEY);}catch(e){}
  const m=modal(`<p class="sub">${ch.label} CLEAR</p><h2>${ch.name}</h2><p class="stars">${'★'.repeat(n)}${'☆'.repeat(3-n)}</p><p>남은 생명 ${S.life} · 놓친 적 ${S.leaksTotal} · 처치 ${S.kills}</p><p>다음 장 「국경의 불꽃」은 준비 중입니다.</p><button class="primary">타이틀로</button>`);m.querySelector('button').onclick=()=>{closeModal();showTitle();};sfx('win');}
 else{const m=modal(`<p class="sub">DEFEAT</p><h2>수정이 깨졌습니다</h2><p>전투 ${S.battle+1} 「${ch.battles[S.battle].name}」에서 막지 못했습니다.</p><button class="primary" data-a="retry">이 전투 다시 하기<small>전투를 시작했던 배치 그대로</small></button><button data-a="restart">장 처음부터</button><button data-a="title">타이틀로</button>`);
  m.querySelector('[data-a=retry]').onclick=()=>{closeModal();const s=loadSave();startChapter(S.chapterIndex,s);};m.querySelector('[data-a=restart]').onclick=()=>{closeModal();startChapter(S.chapterIndex,null);};m.querySelector('[data-a=title]').onclick=()=>{closeModal();showTitle();};}}
function showTitle(){S=null;clearObjects();const save=loadSave();let best={};try{best=JSON.parse(localStorage.getItem(CLEAR_KEY)||'{}');}catch(e){}
 const ch=D.CHAPTERS[0],st=best[ch.id]?' '+'★'.repeat(best[ch.id]):'';
 const m=modal(`<p class="sub">ARCA CHRONICLE</p><h1>cnation <em>TD</em></h1><p>아르카 방어전</p><p>탑을 짓지 않는다. 동료를 세운다.</p>${save?`<button class="primary" data-a="continue">이어하기<small>${D.CHAPTERS[save.chapter].label} · 전투 ${save.battle+1}</small></button>`:''}<button ${save?'':'class="primary"'} data-a="new">${ch.label} · ${ch.name}${st}<small>${ch.place}</small></button><button data-a="help">게임 방법</button><p class="ver">ver.${GAME_VERSION}</p>`,'title');
 m.querySelector('[data-a=new]').onclick=()=>{closeModal();startChapter(0,null);};const c=m.querySelector('[data-a=continue]');if(c)c.onclick=()=>{closeModal();startChapter(save.chapter,save);};
 m.querySelector('[data-a=help]').onclick=()=>{const h=modal(`<h2>게임 방법</h2><ul><li>아래 초상화를 <b>끌어서</b> 전장에 놓거나, 누른 뒤 초록 칸을 누르면 배치됩니다.</li><li><b>근접</b> 캐릭터는 길 위에 서서 몬스터를 붙잡습니다(저지). 맞아서 쓰러질 수 있습니다.</li><li><b>원거리</b> 캐릭터는 길 옆에 섭니다. 밝은 <b>고지대</b>에서는 사거리가 늘어납니다.</li><li>늪을 지나는 몬스터는 느려집니다. 그 끝에 벽을 세워 보세요.</li><li>배치한 캐릭터를 누르면 <b>랭크업</b>·철수·궁극기를 쓸 수 있습니다.</li><li>★3에서 속성을 고릅니다. 🔥불 &gt; 🪽바람 &gt; 💧물 &gt; 🔥불 순으로 강합니다.</li><li>영웅은 한 명뿐입니다. 쓰러지면 30초 뒤 랭크를 유지한 채 돌아옵니다.</li><li>몬스터가 수정에 닿으면 생명이 줄고, 0이 되면 패배합니다.</li></ul><button class="primary">닫기</button>`);h.querySelector('button').onclick=()=>showTitle();};}

// ── Saves ──
function saveGame(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(S.snapshot()));}catch(e){}}
function loadSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return s&&s.v===1&&D.CHAPTERS[s.chapter]?s:null;}catch(e){return null;}}
function startChapter(index,snapshot){clearObjects();closePanel();selCard=null;validTiles=null;S=createSim({chapter:index,snapshot,seed:(Date.now()&0xffff)+index*101});speed=1;paused=false;hudKey='';
 resize();buildTerrain();buildDock();showPreview();
 if(!snapshot)dialogue(S.chapter.intro,()=>toast('동료를 배치하고 「전투 시작」을 누르세요'));else toast(`전투 ${S.battle+1} 준비`);}

// ── Effects (2D overlay) ──
function addFx(o){if(fx.length>140)fx.shift();o.t=0;fx.push(o);}
function handleEvents(){for(const e of S.drain()){
 if(e.t==='attack'){const o=objs.get('u'+e.unit);if(o)o.lunge=1;if(e.melee)addFx({k:'slash',x:e.to.x,y:e.to.y,dur:.18,color:'#fff',r:.32});else addFx({k:'shot',from:e.from,to:e.to,dur:.13,color:e.magic?'#d6b3ff':'#f3e3b0',magic:e.magic});sfx('hit');}
 else if(e.t==='skill'){const o=objs.get('u'+e.unit);if(o)o.lunge=1.4;const color=EL_COLOR[e.element]||'#fff';addFx({k:'label',x:e.from.x,y:e.from.y,h:1.5,text:e.name,color,dur:.9});
  if(e.fx==='slash')addFx({k:'slash',x:e.x,y:e.y,dur:.3,color,r:e.area?e.area:.55});else if(e.fx==='bolt'){addFx({k:'bolt',x:e.x,y:e.y,dur:.28,color});}
  else if(e.fx==='meteor'){addFx({k:'meteor',x:e.x,y:e.y,dur:.45,color,r:e.area});}else addFx({k:'ring',x:e.x,y:e.y,dur:.42,color,r:e.area||.6,fill:true});
  if(e.fx!=='slash'&&e.fx!=='nova')addFx({k:'shot',from:e.from,to:{x:e.x,y:e.y},dur:.14,color,magic:true});}
 else if(e.t==='dmg'){const big=e.crit||e.tag==='weak'||e.combo;addFx({k:'num',x:e.x+(Math.random()-.5)*.3,y:e.y,h:.9,text:(e.combo?e.combo+' ':'')+e.v+(e.crit?'!':''),color:e.tag==='weak'?'#ffd257':e.tag==='resist'?'#9fb0b6':e.crit?'#ffb199':'#fff',size:big?15:11,dur:.6});const o=objs.get('e'+e.id);if(o)o.flash=.12;}
 else if(e.t==='combo')addFx({k:'num',x:e.x,y:e.y,h:1.3,text:e.name,color:'#ffd257',size:15,dur:.8});
 else if(e.t==='hurt'){addFx({k:'num',x:e.x,y:e.y,h:1.3,text:'-'+e.v,color:'#ff9d8a',size:12,dur:.6});const a=objs.get('e'+e.from);if(a)a.lunge=1;}
 else if(e.t==='die'){const o=objs.get('e'+e.id);if(o){objs.delete('e'+e.id);dying.push({g:o.g,t:0});}addFx({k:'num',x:e.x,y:e.y,h:.5,text:'+'+e.gold,color:'#f2cf72',size:12,dur:.7});sfx('coin');if(e.boss)banner('BOSS','갈라졌다!');}
 else if(e.t==='leak'){sfx('leak');addFx({k:'flash',dur:.35});toast(`수정이 공격받았습니다 · 생명 −${Math.min(e.cost,20)}`);}
 else if(e.t==='down'){const o=objs.get('u'+e.id);if(o){objs.delete('u'+e.id);dying.push({g:o.g,t:0});}toast(`${D.UNITS[e.def].name} 쓰러짐${S.hero[e.def]?' · 30초 뒤 복귀 가능':''}`);sfx('leak');if(selUnit===e.id)closePanel();}
 else if(e.t==='withdraw'){const o=objs.get('u'+e.id);if(o){objs.delete('u'+e.id);unitGroup.remove(o.g);}}
 else if(e.t==='ult'){sfx('ult');banner('궁극기',e.name);}
 else if(e.t==='bonus')toast(`${e.why} 보너스 +${e.gold}💰`);
 else if(e.t==='battleStart'){saveGame();const b=S.chapter.battles[e.battle];banner(`전투 ${e.battle+1}`,b.name);clearCard();if(b.boss&&S.chapter.bossIntro){paused=true;dialogue(S.chapter.bossIntro,()=>{paused=false;hudKey='';});}}
 else if(e.t==='cleared'){toast(`전투 ${e.battle+1} 승리 +${e.gold}💰${e.clean?' (무누수 보너스)':''}`);}
 else if(e.t==='prep'){saveGame();showPreview();}
 else if(e.t==='bless')blessingModal();
 else if(e.t==='won'){const end=()=>resultModal(true);if(S.chapter.outro)dialogue(S.chapter.outro,end);else end();}
 else if(e.t==='lost')resultModal(false);
 hudKey='';}}
function ellipse(x,y,r,h=0){const p=proj(x,y,h);ctx.beginPath();ctx.ellipse(p.x,p.y,r*pxU,r*pxU*SIN,0,0,Math.PI*2);}
function tileQuad(c,r,h){const a=proj(c-.5,r-.5,h),b=proj(c+.5,r+.5,h);ctx.beginPath();ctx.rect(a.x+1,a.y+1,b.x-a.x-2,b.y-a.y-2);}
function drawOverlay(dt,time){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,vw,vh);ctx.textAlign='center';ctx.lineJoin='round';
 // Where the selected card may go
 if(selCard&&validTiles){const d=D.UNITS[selCard];for(const t of validTiles){tileQuad(t.c,t.r,tileTop(t));ctx.fillStyle=t.road?'rgba(255,190,70,.5)':t.terrain==='high'?'rgba(90,215,255,.5)':'rgba(60,220,130,.34)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.5;ctx.stroke();}
  if(hover){const t=S.map.tile(hover.c,hover.r),ok=validTiles.includes(t),range=d.range+(d.melee?0:(t.terrain==='high'?.5:0)-(t.terrain==='forest'?.5:0)+S.mods.range);ellipse(hover.c,hover.r,range+.35);ctx.fillStyle=ok?'rgba(255,255,255,.16)':'rgba(240,120,100,.2)';ctx.fill();ctx.strokeStyle=ok?'#fff':'#f08f7c';ctx.lineWidth=2;ctx.stroke();tileQuad(hover.c,hover.r,tileTop(t));ctx.strokeStyle=ok?'#fff':'#f08f7c';ctx.lineWidth=3;ctx.stroke();}}
 const su=selUnit&&S.units.find(u=>u.id===selUnit);
 if(su){ellipse(su.x,su.y,su.range+.35);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;ctx.stroke();if(su.aura){ellipse(su.x,su.y,su.aura.radius+.4);ctx.setLineDash([6,5]);ctx.strokeStyle='#f2cf72';ctx.stroke();ctx.setLineDash([]);}}
 // Monster bars and status pips
 for(const e of S.enemies){const big=e.boss?1.9:e.scale>1.2?1.3:1,p=proj(e.x,e.y,(e.flying?1.75:1.2)*(e.scale||1)+(e.boss?.2:0)),w=pxU*.62*big;
  if(e.hp<e.maxHp||e.boss||e.elite){ctx.fillStyle='rgba(12,22,26,.75)';ctx.fillRect(p.x-w/2-1,p.y-1,w+2,e.boss?8:6);ctx.fillStyle=e.boss?'#ff7361':e.elite?'#f2cf72':'#ee6f5c';ctx.fillRect(p.x-w/2,p.y,w*Math.max(0,e.hp/e.maxHp),e.boss?6:4);}
  let i=0;for(const k in e.st){ctx.fillStyle=ST_COLOR[k]||'#fff';ctx.beginPath();ctx.arc(p.x-w/2+4+i*8,p.y-6,3,0,7);ctx.fill();i++;}}
 // Character bars, rank, ultimate glow
 for(const u of S.units){const p=proj(u.x,u.y,groundY(u.x,u.y)+1.45),w=pxU*.7;ctx.fillStyle='rgba(12,22,26,.75)';ctx.fillRect(p.x-w/2-1,p.y-1,w+2,7);ctx.fillStyle=u.hp/u.maxHp>.35?'#7fe0a6':'#ffb35c';ctx.fillRect(p.x-w/2,p.y,w*Math.max(0,u.hp/u.maxHp),5);
  ctx.font='700 10px system-ui';ctx.fillStyle='#f2cf72';ctx.strokeStyle='rgba(12,22,26,.9)';ctx.lineWidth=3;const s='★'.repeat(u.rank);ctx.strokeText(s,p.x,p.y-3);ctx.fillText(s,p.x,p.y-3);
  if(u.ult&&u.ultCd<=0&&S.phase==='battle'){const g=proj(u.x,u.y,groundY(u.x,u.y));ctx.beginPath();ctx.ellipse(g.x,g.y,pxU*.5,pxU*.5*SIN,0,0,7);ctx.strokeStyle=`rgba(255,160,110,${.55+.4*Math.sin(time*6)})`;ctx.lineWidth=3;ctx.stroke();}
  if(u.buff>1){const g=proj(u.x,u.y,groundY(u.x,u.y)+1.75);ctx.font='700 11px system-ui';ctx.fillStyle='#f2cf72';ctx.fillText('⚔↑',g.x,g.y);}}
 if(aiming){const s=D.SKILLS[S.units.find(u=>u.id===aiming)?.ult];if(s&&hover){ellipse(hover.x,hover.y,s.area);ctx.strokeStyle='#ff8a3d';ctx.lineWidth=2;ctx.stroke();}}
 // Effects
 for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.t+=dt;const k=Math.min(1,f.t/f.dur);if(f.t>=f.dur){fx.splice(i,1);continue;}
  if(f.k==='shot'){const a=proj(f.from.x,f.from.y,1),b=proj(f.to.x,f.to.y,.6),x=a.x+(b.x-a.x)*k,y=a.y+(b.y-a.y)*k;ctx.strokeStyle=f.color;ctx.lineWidth=f.magic?4:2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-(b.x-a.x)*.12,y-(b.y-a.y)*.12);ctx.lineTo(x,y);ctx.stroke();}
  else if(f.k==='slash'){const p=proj(f.x,f.y,.55);ctx.strokeStyle=f.color;ctx.globalAlpha=1-k;ctx.lineWidth=3+f.r*3;ctx.beginPath();ctx.ellipse(p.x,p.y,f.r*pxU*(.6+k*.5),f.r*pxU*.5*(.6+k*.5),-.5,Math.PI*(1.1+k*.6),Math.PI*(1.9+k*.6));ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='ring'){ellipse(f.x,f.y,f.r*(.35+.65*k));ctx.globalAlpha=(1-k)*.9;if(f.fill){ctx.fillStyle=f.color;ctx.globalAlpha=(1-k)*.38;ctx.fill();ctx.globalAlpha=(1-k)*.9;}ctx.strokeStyle=f.color;ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='bolt'){const p=proj(f.x,f.y,.2);ctx.strokeStyle=f.color;ctx.globalAlpha=1-k;ctx.lineWidth=4;ctx.beginPath();let x=p.x,y=p.y-pxU*3.2;ctx.moveTo(x,y);for(let j=1;j<=5;j++){x=p.x+(j<5?(Math.sin(j*7.3+f.x*5)*pxU*.25):0);y=p.y-pxU*3.2*(1-j/5);ctx.lineTo(x,y);}ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='meteor'){if(k<.6){const q=k/.6,p=proj(f.x,f.y,6*(1-q));ctx.fillStyle='#ffb35c';ctx.beginPath();ctx.arc(p.x+pxU*1.5*(1-q),p.y,pxU*.34,0,7);ctx.fill();}else{const q=(k-.6)/.4;ellipse(f.x,f.y,f.r*(.4+.6*q));ctx.fillStyle=f.color;ctx.globalAlpha=(1-q)*.6;ctx.fill();ctx.globalAlpha=1;}}
  else if(f.k==='num'||f.k==='label'){const p=proj(f.x,f.y,(f.h||1)+k*.5);ctx.font=`800 ${f.size||13}px system-ui`;ctx.globalAlpha=k<.7?1:1-(k-.7)/.3;ctx.strokeStyle='rgba(12,22,26,.9)';ctx.lineWidth=3;ctx.strokeText(f.text,p.x,p.y);ctx.fillStyle=f.color;ctx.fillText(f.text,p.x,p.y);ctx.globalAlpha=1;}
  else if(f.k==='flash'){ctx.fillStyle=`rgba(240,90,70,${(1-k)*.3})`;ctx.fillRect(0,0,vw,vh);}}}
fxc.addEventListener('pointermove',e=>{if(!S)return;const p=localPoint(e);if(aiming)hover=unproj(p.x,p.y);else if(selCard&&!dragging)hover=tileAt(p);});

// ── 3D objects follow the simulation ──
function syncObjects(dt,time){
 for(const u of S.units){const key='u'+u.id;let o=objs.get(key);if(!o){o={g:modelFor('u:'+u.def,unitSpec(u.def)),lunge:0};unitGroup.add(o.g);objs.set(key,o);}
  const gy=groundY(u.x,u.y);o.lunge=Math.max(0,o.lunge-dt*6);const len=Math.hypot(u.face.dx,u.face.dy)||1,l=Math.sin(o.lunge*Math.PI)*.16;
  o.g.position.set(wx(u.x)+u.face.dx/len*l,gy,wz(u.y)+u.face.dy/len*l);const want=Math.atan2(u.face.dx,u.face.dy);let d=want-o.g.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));o.g.rotation.y+=d*Math.min(1,dt*14);}
 for(const e of S.enemies){const key='e'+e.id;let o=objs.get(key);if(!o){o={g:modelFor(`e:${e.kind}:${e.elite?1:0}:${e.scale||0}`,enemySpec(e)),lunge:0,flash:0,seed:e.id*1.7};unitGroup.add(o.g);objs.set(key,o);}
  const moving=!e.blockedBy&&!e.st.freeze&&!e.st.stun;o.lunge=Math.max(0,o.lunge-dt*6);const hop=moving?Math.abs(Math.sin(time*7+o.seed))*.07:0,l=Math.sin(o.lunge*Math.PI)*.14;
  o.g.position.set(wx(e.x)+e.dx*l,(e.flying?.75+Math.sin(time*3+o.seed)*.08:hop)-.04,wz(e.y)+e.dy*l);o.g.rotation.y=Math.atan2(e.dx,e.dy);
  if(o.flash>0){o.flash-=dt;const s=1+o.flash*1.2;o.g.scale.set(s,1/s,s);}else o.g.scale.setScalar(1);}
 for(const [key,o] of objs){const id=+key.slice(1),alive=key[0]==='u'?S.units.some(u=>u.id===id):S.enemies.some(e=>e.id===id);if(!alive){objs.delete(key);unitGroup.remove(o.g);}}
 for(let i=dying.length-1;i>=0;i--){const d=dying[i];d.t+=dt;const k=1-d.t/.25;if(k<=0){unitGroup.remove(d.g);dying.splice(i,1);}else d.g.scale.setScalar(Math.max(.01,k));}}

let lastTime=0;
function frame(now){requestAnimationFrame(frame);const real=Math.min(.05,(now-lastTime)/1000||0);lastTime=now;if(!S){renderer.render(scene,camera);return;}
 const busy=S.phase==='battle'&&(selCard||selUnit||aiming),scale=paused||modalOpen?0:speed*(busy?.25:1);
 if(scale>0)S.step(real*scale);handleEvents();if(!S)return;
 const t=now/1000;syncObjects(real*(scale>0?Math.max(1,scale):1),t);if(water)water.material.uniforms.uTime.value=t;
 renderer.render(scene,camera);drawOverlay(real*(scale>0?Math.max(.5,scale):.5),t);updateHud();}

document.addEventListener('visibilitychange',()=>{if(document.hidden&&S&&S.phase==='battle'){paused=true;hudKey='';}});
makePortraits();resize();showTitle();requestAnimationFrame(frame);
window.TD={get sim(){return S;},startChapter,version:GAME_VERSION};
})();
