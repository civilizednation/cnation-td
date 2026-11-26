// cnation TD screen: 3D battlefield (three.js, fixed tilted top view), 2D overlay (bars, effects, ranges), dock, panels, music, saves.
// All rules live in sim.js; this file only sends commands to it and draws what it reports.
(function(){
const THREE=CNATION3D,D=TDData,M=TDModels,{createSim,TERRAIN_NAME}=TDSim;
const GAME_VERSION='1.7.1',SAVE_KEY='cnation-td-save-v2',LEGACY_KEY='cnation-td-legacy-v1',SLOT_KEY='cnation-td-slots-v1',CLEAR_KEY='cnation-td-clear-v1',SET_KEY='cnation-td-settings-v1',SLOTS=3;
const $=s=>document.querySelector(s),app=$('#app'),viewport=$('#viewport'),glc=$('#gl'),fxc=$('#fx'),ctx=fxc.getContext('2d');
const ELEV=54*Math.PI/180,SIN=Math.sin(ELEV),COS=Math.cos(ELEV);
const EL_COLOR={fire:'#ff8a3d',water:'#6fd0ff',ice:'#a9ecff',wind:'#a6f2c6',thunder:'#ffe66b',light:'#fff3b0',dark:'#c7a3ff'};
const ST_COLOR={burn:'#ff8a3d',freeze:'#a9ecff',slow:'#6fa8ff',stun:'#ffe66b',defdown:'#d79cff',poison:'#9be25a',sleep:'#c0a2f0',silence:'#ec81c0',root:'#c9a36a'};
const EL_NAME={fire:'불',water:'물',ice:'얼음',wind:'바람',thunder:'번개',light:'빛',dark:'어둠'},ULT_FX_NOTE={fire:'화상',ice:'빙결',water:'빙결',wind:'둔화',thunder:'기절',dark:'독',light:'추가 피해 +20%'};
const ST_NAME={burn:'화상',freeze:'빙결',slow:'둔화',stun:'기절',defdown:'방어↓',poison:'독',sleep:'수면',silence:'침묵',root:'속박'};
const FONT='"Stylish",system-ui,sans-serif';

let pickEl=null,aimEl,shardUi=null,shakeT=0,hitStop=0,ultImpact=0,spacedTiles=[],ultSeen=new Set(),S=null,speed=1,paused=false,selCard=null,selUnit=null,aiming=null,hover=null,dragging=false,validTiles=null,modalOpen=false,devMode=false,lastSnap=null;
let vw=1,vh=1,pxU=40,tz=.25,dpr=1;
const objs=new Map(),dying=[],fx=[],warns=new Map();
const loadJSON=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??d;}catch(e){return d;}},saveJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const settings=Object.assign({bgm:.5,sfxVol:1},loadJSON(SET_KEY,{}));
if('sfx' in settings){if(!('sfxVol' in loadJSON(SET_KEY,{})))settings.sfxVol=settings.sfx===false?0:1;delete settings.sfx;saveJSON(SET_KEY,settings);}   // was an on/off switch
if('sfxPick' in settings||'sfxPickReset' in settings){delete settings.sfxPick;delete settings.sfxPickReset;saveJSON(SET_KEY,settings);}   // left over from the beta candidate picker

// ── Renderer ──
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:glc,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setClearColor(0,0);}
catch(e){document.body.innerHTML='<p style="padding:24px">3D 화면을 열 수 없어요. WebGL이 지원되는 Safari 또는 Chrome에서 다시 열어 주세요.</p>';throw e;}
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-5,5,8,-8,.1,200);
scene.add(new THREE.HemisphereLight(0xe4f0ce,0x203844,1.75));const sun=new THREE.DirectionalLight(0xffedc7,2.9);sun.position.set(-7,13,5);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:13,bottom:-13,near:1,far:50});sun.shadow.bias=-.0012;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
const terrainGroup=new THREE.Group(),unitGroup=new THREE.Group();scene.add(terrainGroup,unitGroup);let water=null,animated=[];
const wx=x=>x-(S.map.w-1)/2,wz=y=>y-(S.map.h-1)/2;
const tileTop=t=>t?t.h:0;
const groundY=(x,y)=>tileTop(S.map.tile(Math.round(x),Math.round(y)));
// Orthographic camera → the projection is a straight formula (no raycasting needed).
const proj=(x,y,h=0)=>({x:vw/2+wx(x)*pxU,y:vh/2+((wz(y)-tz)*SIN-h*COS)*pxU});
const unproj=(sx,sy)=>({x:(sx-vw/2)/pxU+(S.map.w-1)/2,y:(sy-vh/2)/(pxU*SIN)+tz+(S.map.h-1)/2});
// Guide frame for painted backgrounds: map width + 1 tile across, 9:16, centred on the screen centre (see MAP_ART in data.js).
const artFrame=map=>{const fw=map.w+1;return {fw,fh:fw*16/9};};
const artImg=$('#art'),artBlur=$('#artBlur');let art=null;
// The painted battlefield comes first: until it is downloaded and decoded, the 3D canvas, the effects, the HUD, the dock and the
// title menu stay hidden (#app.artwait), then everything fades in on top of it. onArt(fn) runs fn once the painting is up.
// 「데이터 불러오는 중…」: shown whenever something the next screen needs (painting, music) is still downloading.
// loading.begin(key)/end(key) can overlap; the overlay appears after 120 ms so instant loads never flash it.
// The overlay is in index.html and visible from the first paint ('boot' key) until the first painting is up.
const loading=(()=>{const el=$('#loading');
 const keys=new Set(['boot']);let timer=0,slow=0;
 const sync=()=>{clearTimeout(timer);clearTimeout(slow);if(keys.size){timer=setTimeout(()=>{el.hidden=false;},120);slow=setTimeout(()=>{el.querySelector('small').textContent='네트워크가 느립니다 · 조금만 기다려 주세요';},6000);}else{el.hidden=true;el.querySelector('small').textContent='';}};
 return {begin(k){keys.add(k);sync();},end(k){keys.delete(k);sync();},
  // wait for a promise (at most `cap` ms) under the overlay
  wait(k,p,cap=10000){keys.add(k);sync();return Promise.race([Promise.resolve(p).catch(()=>{}),new Promise(r=>setTimeout(r,cap))]).then(v=>{keys.delete(k);sync();return v;});}};})();
// Decoded image promise (cached), so the next painting can be fully ready before the screen switches to it.
const imgCache=new Map();function loadImg(src){if(!imgCache.has(src))imgCache.set(src,new Promise(ok=>{const im=new Image();im.onload=()=>{(im.decode?im.decode():Promise.resolve()).catch(()=>{}).then(()=>ok(true));};im.onerror=()=>ok(false);im.src=src;}));return imgCache.get(src);}
let artOK=true,artWaiters=[],artToken=0;
function onArt(fn){if(artOK)fn();else artWaiters.push(fn);}
function artDone(){loading.end('boot');artOK=true;app.classList.remove('artwait');const w=artWaiters;artWaiters=[];for(const f of w)f();preloadArt();}
// No timeout: nothing is drawn on a missing painting (a slow network shows the loading message instead).
function waitArt(src){const token=++artToken;artOK=false;app.classList.add('artwait');loading.begin('art');const done=()=>{if(token!==artToken)return;loading.end('art');artDone();};
 artImg.onload=()=>{(artImg.decode?artImg.decode():Promise.resolve()).catch(()=>{}).then(done);};artImg.onerror=done;artImg.src=src;}
// Once the first painting is up, fetch the others quietly so later maps, the world map and the altar open at once.
let preloaded=false;function preloadArt(){if(preloaded)return;preloaded=true;setTimeout(()=>{const files=[...Object.values(D.MAP_ART).map(a=>a.file),D.WORLD_MAP.file,D.ALTAR&&D.ALTAR.file].filter(Boolean);
 files.forEach((f,i)=>setTimeout(()=>{loadImg(f+'?v='+GAME_VERSION);},i*250));},1200);}
function placeArt(){if(!art||!S)return;const {fw,fh}=artFrame(S.map),[u0,v0,u1,v1]=art.rect||[0,0,1,1],w=fw*pxU/(u1-u0),h=fh*pxU/(v1-v0);
 Object.assign(artImg.style,{width:w+'px',height:h+'px',left:(vw/2-fw*pxU/2-u0*w)+'px',top:(vh/2-fh*pxU/2-v0*h)+'px'});}
const standalone=()=>navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
// With an opaque status bar (status-bar-style "black") iOS sizes the page itself, so #app just fills the viewport (top/bottom 0).
function fitApp(){app.style.height='';app.style.bottom='';}
function resize(){fitApp();const r=viewport.getBoundingClientRect();vw=Math.max(1,r.width);vh=Math.max(1,r.height);dpr=Math.min(2,window.devicePixelRatio||1);
 renderer.setPixelRatio(dpr);renderer.setSize(vw,vh,false);fxc.width=Math.round(vw*dpr);fxc.height=Math.round(vh*dpr);
 const w=S?S.map.w:9,h=S?S.map.h:14,land=matchMedia('(orientation:landscape) and (min-width:640px)').matches;pxU=Math.min(vw/(w+.25),vh/(h*SIN+(land?3.4:2.6)));const hw=vw/(2*pxU),hh=vh/(2*pxU);
 camera.left=-hw;camera.right=hw;camera.top=hh;camera.bottom=-hh;camera.position.set(0,60*SIN,tz+60*COS);camera.lookAt(0,0,tz);camera.updateProjectionMatrix();placeArt();}
window.addEventListener('resize',resize);
// iOS home-screen apps can leave the page scrolled or offset by the status bar after returning from the background,
// rotating or closing the keyboard, which pushes the bottom of the game off screen. Keep the page at 0,0 and re-measure.
const pinPage=()=>{if(window.scrollX||window.scrollY)window.scrollTo(0,0);if(document.scrollingElement)document.scrollingElement.scrollTop=0;};
const settle=()=>{pinPage();resize();setTimeout(()=>{pinPage();resize();},350);};
window.addEventListener('scroll',pinPage,{passive:true});window.addEventListener('orientationchange',settle);window.addEventListener('pageshow',settle);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)settle();});
if(window.visualViewport)window.visualViewport.addEventListener('resize',()=>{pinPage();resize();});

function disposeGroup(g){for(const c of [...g.children]){g.remove(c);c.traverse(o=>{if(o.userData.shared)return;if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==M.sharedMat&&o.material!==M.ghostMat)o.material.dispose?.();});}}
// Scenery pieces. Each returns bake() parts placed at world x,z on ground height y.
function propParts(kind,x,y,z,v,sc){const p=[],a=sc.accent;
 if(kind==='ruin'){p.push(['cyl',[x-.2,y+.45,z],[.16,.9,.16],0xcfc9b0],['cyl',[x+.24,y+.25,z+.1],[.16,.5,.16],0xbdb79e],['box',[x-.2,y+.95,z],[.42,.1,.42],0xd9d3ba],['rock',[x+.1,y+.08,z-.25],[.16,.1,.14],0xb9b39c]);}
 else if(kind==='fort'){p.push(['box',[x,y+.5,z],[.62,1,.62],0x8a6a45],['box',[x,y+1.05,z],[.76,.12,.76],0x6e5336],['cone',[x,y+1.4,z],[.56,.6,.56],0x9c4b3c]);for(const s of [-.3,.3])p.push(['box',[x+s,y+.5,z+.32],[.06,1,.04],0x6e5336]);}
 else if(kind==='rockspire'){p.push(['cone',[x,y+.75,z],[.42,1.5,.42],0x7f949b],['cone',[x+.28,y+.4,z+.15],[.24,.8,.24],0x93a8ae],['rock',[x-.25,y+.12,z-.2],[.2,.16,.2],0xa9b6ba],['cone',[x,y+1.35,z],[.16,.32,.16],0xeef4f6]);}
 else if(kind==='bigtree'){p.push(['cyl',[x,y+.55,z],[.16,1.1,.16],0x6b5a3e],['cone',[x,y+1.25,z],[.62,1,.62],0x2f5f4a],['cone',[x,y+1.75,z],[.46,.8,.46],0x3f7a59],['cone',[x,y+2.15,z],[.3,.6,.3],0x5d9a6c]);}
 else if(kind==='house'){const roof=[0x9c4b3c,0x6f7fa6,0x8a6a45,0x7a5f8f][Math.floor(v*4)];p.push(['box',[x,y+.38,z],[.72,.76,.66],0xe3d9c3],['cone',[x,y+1.02,z],[.66,.6,.6],roof,0,0,Math.PI/4],['box',[x,y+.22,z+.34],[.18,.38,.03],0x6e5336],['box',[x+.22,y+.5,z+.34],[.13,.13,.03],0x9bd0e0]);}
 else if(kind==='tent'){p.push(['cone',[x,y+.45,z],[.52,.9,.52],[0xd9c9a0,0xc98d5c,0x9db0c4][Math.floor(v*3)]],['cyl',[x,y+1,z],[.02,.4,.02],0x6e5336],['box',[x+.1,y+1.12,z],[.2,.12,.02],0xc0563f],['box',[x-.38,y+.14,z+.3],[.24,.24,.24],0x8a6a45]);}
 else if(kind==='crystal'){p.push(['rock',[x,y+.55,z],[.26,.6,.26],a],['rock',[x+.28,y+.3,z+.12],[.16,.36,.16],0xdffcf0],['rock',[x-.26,y+.24,z-.1],[.14,.3,.14],a],['cyl',[x,y+.04,z],[.46,.08,.46],0x9db5ad]);}
 else if(kind==='spire'){p.push(['cyl',[x,y+.8,z],[.24,1.6,.24],0x4f5367],['cyl',[x,y+1.62,z],[.32,.1,.32],0x6a6f88],['cone',[x,y+2.05,z],[.26,.8,.26],0x3a3d52],['rock',[x,y+1.2,z+.24],[.07,.1,.04],a]);}
 return p;}
function buildTerrain(noArt){disposeGroup(terrainGroup);animated=[];const map=S.map,sc=map.scene,rand=D.seeded(map.seed*31+7),W=map.w,H=map.h;
 art=noArt?null:D.MAP_ART[S.chapter.map]||null;const sky='#'+new THREE.Color(sc.sky).getHexString();
 scene.background=art?null:new THREE.Color(sc.sky);viewport.style.background=art?.bg||sky;
 if(art){if(artImg.dataset.file!==art.file){artImg.dataset.file=art.file;waitArt(art.file+'?v='+GAME_VERSION);artBlur.src=art.file+'?v='+GAME_VERSION;}placeArt();}else{artImg.removeAttribute('src');artBlur.removeAttribute('src');delete artImg.dataset.file;artDone();}
 const first=map.paths.map(p=>p.wp[0]),last=map.paths[0].wp[map.paths[0].wp.length-1],cells=[],padX=4,padTop=7,padBottom=5;
 const lead=(c,r)=>first.some(([fc,fr])=>(fc===c&&fr<0&&r<0)||(fr===r&&fc<0&&c<0)||(fr===r&&fc>=W&&c>=W))||(last[0]===c&&last[1]>=H&&r>=H);
 for(let r=-padTop;r<H+padBottom;r++)for(let c=-padX;c<W+padX;c++){const t=map.tile(c,r);if(t){cells.push({c,r,terrain:t.terrain,h:t.h,alt:t.alt,v:t.v,road:t.road});continue;}
  const out=Math.max(-c,c-(W-1),-r,r-(H-1)),road=lead(c,r);cells.push({c,r,apron:true,road,terrain:road?'road':rand()<.4?'forest':rand()<.12?'rock':'grass',h:road?-.07:.06+out*.2+rand()*.22,v:rand(),alt:rand()<.3});}
 const col=new THREE.Color(),tint=t=>{const base=t.terrain==='road'?sc.road:t.terrain==='high'?sc.high:t.terrain==='water'||t.terrain==='bridge'?sc.water:t.terrain==='swamp'||t.terrain==='sand'?sc.slow:t.terrain==='cliff'?sc.cliff:t.alt?sc.alt:sc.land;col.set(base);
  if(t.apron)col.multiplyScalar(.86-.02*Math.min(4,t.h*3));else if(t.road)col.multiplyScalar(.97+t.v*.06);else col.multiplyScalar(.95+t.v*.1);return col;};
 const geom=new THREE.BoxGeometry(.985,1,.985),ca=new Float32Array(geom.attributes.position.count*3);
 for(let i=0;i<geom.attributes.position.count;i++){const f=geom.attributes.normal.getY(i)>.5?1:.6;ca.set([f,f,f],i*3);}geom.setAttribute('color',new THREE.BufferAttribute(ca,3));
 const mesh=new THREE.InstancedMesh(geom,new THREE.MeshLambertMaterial({vertexColors:true}),cells.length),dummy=new THREE.Object3D(),waterPlaces=[],parts=[];
 cells.forEach((t,i)=>{const height=t.h+1.4,x=wx(t.c),z=wz(t.r),y=t.h;dummy.position.set(x,t.h-height/2,z);dummy.scale.set(1,height,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,tint(t));
  const T=t.terrain;
  if(T==='water')waterPlaces.push({x,y:t.h+.07,z});
  else if(T==='bridge'){waterPlaces.push({x,y:-.13,z});const along=!(map.tile(t.c-1,t.r)?.road||map.tile(t.c+1,t.r)?.road);for(const o of [-.33,0,.33])parts.push(['box',[x+(along?0:o),y+.03,z+(along?o:0)],along?[.9,.06,.28]:[.28,.06,.9],0xcdb48a]);for(const s of [-.45,.45]){parts.push(['box',[x+(along?s:0),y+.2,z+(along?0:s)],along?[.06,.06,.98]:[.98,.06,.06],0x8a6a45]);for(const e of [-.4,.4])parts.push(['cyl',[x+(along?s:e),y+.12,z+(along?e:s)],[.04,.26,.04],0x6e5336]);}}
  else if(T==='forest'){const s=(t.apron?1.15:1)*(.85+t.v*.35),[d,l]=sc.tree,ox=-.18+t.v*.2;if(sc.prop==='crystal'&&t.v>.55){parts.push(['rock',[x+ox,y+.4,z-.1],[.2,.5,.2],sc.accent],['rock',[x+ox+.3,y+.22,z+.2],[.12,.28,.12],0xdffcf0]);}
   else{parts.push(['cyl',[x+ox,y+.23,z-.15],[.06,.48,.06],0x756c4d],['cone',[x+ox,y+.65*s,z-.15],[.34*s,.74*s,.34*s],d],['cone',[x+ox,y+.95*s,z-.15],[.25*s,.52*s,.25*s],l]);if(t.v>.35){parts.push(['cyl',[x+.26,y+.18,z+.24],[.05,.36,.05],0x756c4d],['cone',[x+.26,y+.52,z+.24],[.25,.56,.25],l]);}if(t.v<.3)parts.push(['ball',[x-.3,y+.1,z+.28],[.16,.12,.16],d]);}}
  else if(T==='swamp'){parts.push(['cyl',[x-.08,y+.01,z+.04],[.34,.02,.34],0x476d68]);for(const [a,b] of [[-.31,-.26],[.25,-.1],[.32,.28],[-.2,.3]])parts.push(['cyl',[x+a,y+.14,z+b],[.014,.28,.014],0x9ebc7b]);}
  else if(T==='sand'){for(const [a,b] of [[-.25,.2],[.18,-.2],[.3,.3]])parts.push(['rock',[x+a,y+.02,z+b],[.16,.035,.11],0xf0d8a3]);}
  else if(T==='high'){for(const [a,b] of [[-.42,-.42],[.42,-.42],[-.42,.42],[.42,.42]])parts.push(['box',[x+a,y+.05,z+b],[.12,.1,.12],0xd8dcc6]);if(t.v>.6)parts.push(['cone',[x+.3,y+.08,z-.3],[.06,.14,.06],sc.tree[1]]);}
  else if(T==='cliff'){parts.push(['rock',[x-.1,y+.1,z],[.42,.3,.4],sc.rock],['rock',[x+.25,y+.06,z+.2],[.2,.18,.2],sc.cliff]);if(t.v>.5)parts.push(['cone',[x+.1,y+.4,z-.15],[.2,.5,.2],sc.rock]);}
  else if(T==='prop')parts.push(...propParts(sc.prop,x,y,z,t.v,sc));
  else if(T==='rock'){parts.push(['rock',[x-.12,y+.16,z-.05],[.3,.26,.28],sc.rock],['rock',[x+.24,y+.09,z+.2],[.17,.14,.16],sc.rock]);if(t.v>.5)parts.push(['rock',[x-.28,y+.07,z+.28],[.12,.1,.12],sc.cliff]);}
  else if(T==='grass'){if(t.v<.16)parts.push(['rock',[x-.3,y+.04,z-.28],[.1,.08,.11],sc.rock]);else if(t.v>.84){for(const [a,b] of [[-.2,.22],[.24,-.18]])parts.push(['cone',[x+a,y+.08,z+b],[.07,.16,.07],sc.tree[1]]);}
   if(t.apron&&t.h>.7&&t.v>.5)parts.push(['cone',[x,y+.5,z],[.36,1,.36],sc.cliff]);}
  else if(T==='road'&&!t.apron&&t.v>.8)parts.push(['rock',[x+.34,y+.02,z-.3],[.07,.04,.07],sc.rock]);});
 mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.receiveShadow=true;mesh.castShadow=!art;
 // With a painting the tiles stay as invisible ground that only shows the characters' shadows.
 if(art){// only the tile tops catch shadows (box sides would darken whole neighbouring tiles)
  const top=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.ShadowMaterial({opacity:.3}),cells.length);
  cells.forEach((t,i)=>{dummy.position.set(wx(t.c),t.h,wz(t.r));dummy.scale.set(1,1,1);dummy.updateMatrix();top.setMatrixAt(i,dummy.matrix);});
  top.instanceMatrix.needsUpdate=true;top.receiveShadow=true;mesh.geometry.dispose();mesh.material.dispose();terrainGroup.add(top);}
 else terrainGroup.add(mesh);
 // Monster gates: a dark stone arch with red banners and a glowing rift, one per road.
 const basic=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});
 map.paths.forEach((path,pi)=>{if(first.findIndex(f=>f[0]===path.wp[0][0]&&f[1]===path.wp[0][1])!==pi)return;const [fc,fr]=path.wp[0],seg=path.segs[0],g=new THREE.Group(),gp=[];
  for(const s of [-1,1]){gp.push(['box',[s*.62,.85,0],[.34,1.7,.4],0x4a4652],['rock',[s*.62,1.8,0],[.24,.22,.24],0x38343f],['cone',[s*.62,2.1,0],[.12,.4,.12],0xb5332e],['box',[s*.62,1.05,.22],[.2,.7,.03],0xc0362f],['cone',[s*.62,.62,.22],[.1,.2,.02],0xc0362f,Math.PI]);}
  gp.push(['box',[0,1.82,0],[1.7,.28,.42],0x4a4652],['rock',[0,2.08,0],[.2,.2,.2],0xd94a3d],['cone',[-.3,2.05,0],[.08,.3,.08],0x38343f],['cone',[.3,2.05,0],[.08,.3,.08],0x38343f]);
  const arch=new THREE.Mesh(M.bake(gp),M.sharedMat);arch.castShadow=true;if(!art)g.add(arch);const rift=new THREE.Mesh(new THREE.PlaneGeometry(.95,1.55),basic(0xff3b2f,.6));rift.position.set(0,.85,0);g.add(rift);
  const glow=new THREE.Mesh(new THREE.CircleGeometry(.75,24),basic(0xff5a3c,.35));glow.rotation.x=-Math.PI/2;glow.position.set(0,.03,.45);g.add(glow);
  const side=fc<0||fc>=W,off=side?.72:.35;g.position.set(wx(fc)+seg.dx*off,-.07,wz(fr)+seg.dy*off);g.rotation.y=Math.atan2(seg.dx,seg.dy);terrainGroup.add(g);animated.push(t=>{rift.material.opacity=.45+.25*Math.sin(t*3+pi);glow.material.opacity=.22+.16*Math.sin(t*3+pi);});});
 // The Arca crystal: stepped dais, a big floating crystal, a pillar of light.
 {const [lc,lr]=last,inside=!!map.tile(lc,lr),x=wx(lc),z=inside?wz(lr):wz(H-1)+.62,g=new THREE.Group(),dp=[['cyl',[0,.06,0],[.78,.12,.78],0xdfe6dc],['cyl',[0,.18,0],[.6,.12,.6],0xcfd8cd],['cyl',[0,.3,0],[.42,.12,.42],0xeef4ea]];
  for(let i=0;i<4;i++){const an=i*Math.PI/2+Math.PI/4;dp.push(['rock',[Math.cos(an)*.62,.34,Math.sin(an)*.62],[.1,.24,.1],0x9be6d2]);}
  const dais=new THREE.Mesh(M.bake(dp),M.sharedMat);dais.castShadow=true;dais.receiveShadow=true;if(!art)g.add(dais);
  const gem=new THREE.Mesh(M.bake([['rock',[0,0,0],[.34,.62,.34],0x7ff0d2],['rock',[0,0,0],[.22,.46,.22],0xe8fff6]]),M.sharedMat);gem.position.y=1.15;gem.castShadow=true;if(!art)g.add(gem);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.3,.42,4.2,16,1,true),basic(0x9ffbe0,.22));beam.position.y=2.3;g.add(beam);
  const halo=new THREE.Mesh(new THREE.RingGeometry(.8,.98,32),basic(0x7ff0d2,.6));halo.rotation.x=-Math.PI/2;halo.position.y=.035;g.add(halo);
  g.position.set(x,inside?-.07:0,z);terrainGroup.add(g);animated.push(t=>{gem.rotation.y=t*.9;gem.position.y=1.15+Math.sin(t*2)*.08;beam.material.opacity=.16+.08*Math.sin(t*2.4);const s=1+.12*Math.sin(t*2.4);halo.scale.set(s,s,1);});}
 // Road curbs: a raised dark stone edge wherever the road meets other ground, so the route reads at a glance.
 {const isRoad=new Set(cells.filter(t=>t.road).map(t=>t.c+','+t.r)),edge=new THREE.Color(sc.road).multiplyScalar(.4).getHex(),lip=new THREE.Color(sc.road).multiplyScalar(.66).getHex(),T=.2;
  for(const t of cells){if(!t.road||t.terrain==='bridge')continue;const x=wx(t.c),z=wz(t.r),y=t.h;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){if(isRoad.has((t.c+dx)+','+(t.r+dz)))continue;const n=map.tile(t.c+dx,t.r+dz);if(n&&n.terrain==='water')continue;
    const ex=x+dx*(.5-T/2),ez=z+dz*(.5-T/2),size=dx?[T,.15,1.0]:[1.0,.15,T];parts.push(['box',[ex,y+.055,ez],size,edge]);
    parts.push(['box',[x+dx*(.5-T-.025),y+.005,z+dz*(.5-T-.025)],dx?[.07,.02,.98]:[.98,.02,.07],lip]);}}}
 if(art){water=null;return;}
 const deco=new THREE.Mesh(M.bake(parts),M.sharedMat);deco.castShadow=true;deco.receiveShadow=true;terrainGroup.add(deco);
 water=M.makeWaterSurface(waterPlaces);if(water)terrainGroup.add(water);}
// Guide picture for painting a background (tools/make-guides.js): the map's 3D terrain without characters or markers,
// seen from the game camera over the artFrame, 1080×1920.
function renderGuide(index){S=createSim({chapter:index,seed:1});clearObjects();buildTerrain(true);const {fw,fh}=artFrame(S.map),W=1080,H=1920;
 const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.outputColorSpace=THREE.SRGBColorSpace;r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.setPixelRatio(1);r.setSize(W,H,false);
 const cam=new THREE.OrthographicCamera(-fw/2,fw/2,fh/2,-fh/2,.1,200);cam.position.set(0,60*SIN,tz+60*COS);cam.lookAt(0,0,tz);cam.updateProjectionMatrix();
 unitGroup.visible=false;for(const f of animated)f(0);r.render(scene,cam);unitGroup.visible=true;const url=r.domElement.toDataURL('image/png');r.dispose();
 const m=S.map,cells=[];for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){const t=m.tile(x,y);cells.push([x,y,t.terrain,+t.h.toFixed(3),t.road?1:0]);}
 const info={map:S.chapter.map,w:m.w,h:m.h,fw,fh,tz,SIN,COS,px:[W,H],gates:m.gates,crystal:m.paths[0].wp[m.paths[0].wp.length-1],cells};S=null;return {url,info};}

// ── Models ──
const protoCache=new Map();
function modelFor(key,spec){let p=protoCache.get(key);if(!p){p=M.figure(spec);p.traverse(o=>{o.userData.shared=true;if(o.isMesh&&o.material!==M.ghostMat)o.castShadow=o.geometry.type!=='RingGeometry'&&o.geometry.type!=='CircleGeometry';});if(p.children[2])p.children[2].visible=false;protoCache.set(key,p);}return p.clone();}
const unitSpec=def=>({...D.UNITS[def].model,team:'ally',name:D.UNITS[def].name});
const enemySpec=e=>({model:e.model,color:e.color,name:D.MONSTERS[e.kind].name,elite:e.elite,team:'enemy',scale:e.scale,boss:e.bossId!=null,bossId:e.bossId});
function clearObjects(){shardUi=null;if(typeof shardEl!=='undefined'){shardEl.hidden=true;shardEl.classList.remove('drag','picking');}if(typeof closeElPick==='function')closeElPick();for(const o of objs.values())unitGroup.remove(o.g);objs.clear();for(const d of dying)unitGroup.remove(d.g);dying.length=0;fx.length=0;warns.clear();}
const portraits={};
function makePortraits(){const size=160,pr=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});pr.setSize(size,size,false);pr.outputColorSpace=THREE.SRGBColorSpace;
 const ps=new THREE.Scene(),pc=new THREE.OrthographicCamera(-.62,.62,.62,-.62,.1,20);ps.add(new THREE.HemisphereLight(0xe4f0ce,0x203844,2.4));const l=new THREE.DirectionalLight(0xffedc7,3);l.position.set(-3,6,4);ps.add(l);
 for(const id in D.UNITS){const g=M.figure(unitSpec(id));g.children.slice(1).forEach(c=>{c.visible=false;});g.rotation.y=.35;ps.add(g);pc.position.set(0,1.05,5);pc.lookAt(0,.72,0);pr.render(ps,pc);portraits[id]=pr.domElement.toDataURL('image/png');ps.remove(g);}
 pr.dispose();pr.forceContextLoss?.();}

// ── Sound: effect sounds (sfx/<name>.mp3 once supplied, synthesized blips until then) and the cnation TACTICS soundtrack ──
// Everything goes through one Web Audio context so volumes also work on iPhone, where <audio>.volume is ignored.
let ac=null;
function audioCtx(){if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){ac=null;}}if(ac&&ac.state==='suspended')ac.resume().catch(()=>{});return ac;}
// Every effect has a recorded file sfx/<name>.mp3 (Suno takes, trimmed and levelled — see docs/SFX.md).
// The synthesized blips below are only a fallback while a file loads or if it fails.
const SFX_FILES=['hit_melee','hit_arrow','hit_magic','monster_die','die_slime','die_beast','die_soldier','die_spirit','die_stone','die_boss','skill_fire','skill_ice','skill_wind','skill_thunder','skill_light','skill_dark','heal','defeat','legacy','blessing','boss_attack','boss_appear','wave_clear','battle_start','ally_down','crystal_hit','ult_cast','ult_ready','ui_tap','ui_confirm','ui_error','place_unit','rank_up','coin','hit_holy'];
// Fallback blips: [start Hz, end Hz, seconds, gain, wave].
const SFX_SYNTH={ui_tap:[600,500,.04,.05,'sine'],ui_confirm:[520,780,.12,.08,'triangle'],ui_error:[160,120,.12,.1,'square'],place_unit:[330,520,.12,.12,'sine'],rank_up:[440,880,.22,.12,'triangle'],coin:[880,1320,.08,.04,'sine'],
 hit_melee:[190,90,.05,.05,'triangle'],hit_arrow:[420,260,.05,.035,'triangle'],hit_magic:[700,380,.07,.035,'sine'],monster_die:[300,120,.12,.05,'triangle'],
 skill_fire:[260,120,.2,.06,'sawtooth'],skill_ice:[1200,700,.18,.05,'sine'],skill_wind:[500,900,.2,.04,'triangle'],skill_thunder:[180,60,.18,.07,'square'],skill_light:[880,1320,.2,.05,'sine'],skill_dark:[200,90,.22,.06,'sawtooth'],
 hit_holy:[1100,820,.07,.035,'sine'],die_slime:[420,160,.12,.05,'sine'],die_beast:[520,180,.14,.05,'sawtooth'],die_soldier:[240,100,.14,.05,'square'],die_spirit:[900,300,.2,.04,'sine'],die_stone:[140,60,.2,.07,'square'],die_boss:[110,40,1.1,.2,'sawtooth'],
 heal:[660,990,.18,.06,'sine'],ult_ready:[740,1480,.28,.12,'triangle'],ult_cast:[120,640,.5,.16,'sawtooth'],ally_down:[220,70,.4,.16,'sawtooth'],crystal_hit:[220,70,.4,.2,'sawtooth'],
 battle_start:[440,880,.22,.12,'triangle'],wave_clear:[523,1046,.4,.12,'triangle'],boss_appear:[90,50,.7,.22,'sawtooth'],boss_attack:[110,55,.5,.18,'sawtooth'],blessing:[660,1320,.3,.1,'sine'],legacy:[392,1176,.5,.12,'triangle'],defeat:[330,110,.9,.14,'triangle']};
// Minimum seconds between two plays of the same sound (busy battles would otherwise stack dozens).
const SFX_GAP={hit_melee:.07,hit_arrow:.07,hit_magic:.07,hit_holy:.07,coin:.05,monster_die:.05,die_slime:.05,die_beast:.05,die_soldier:.05,die_spirit:.05,die_stone:.05,skill_fire:.15,skill_ice:.15,skill_wind:.15,skill_thunder:.15,skill_light:.15,skill_dark:.15};
// A sound without its own file borrows this one's file before falling back to its synth blip.
// Which death sound each monster body uses.
const DIE_SOUND={slime:'die_slime',wolf:'die_beast',spider:'die_beast',dragon:'die_beast',goblin:'die_soldier',knight:'die_soldier',archer:'die_soldier',ghost:'die_spirit',flameSpirit:'die_spirit',golem:'die_stone',treant:'die_stone',sentinel:'die_stone'};
const sfxBuf={},sfxLast={};
function loadSfx(){const c=audioCtx();if(!c)return;for(const n of SFX_FILES){if(sfxBuf[n])continue;const slot={};sfxBuf[n]=slot;
 fetch(`sfx/${n}.mp3?v=${GAME_VERSION}`).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(b=>new Promise((ok,no)=>c.decodeAudioData(b,ok,no))).then(buf=>{slot.buf=buf;}).catch(()=>{delete sfxBuf[n];});}}
// opt: {gain: volume multiplier, delay: seconds from now, force: ignore the repeat gap}. Hits and deaths vary their pitch slightly.
function sfx(kind,opt={}){if(!(settings.sfxVol>0)||(demo.on&&!/^ui_/.test(kind)))return;const c=audioCtx();if(!c)return;const now=c.currentTime,at=now+(opt.delay||0),vol=(opt.gain||1)*settings.sfxVol,rate=/^(hit_|die_|monster_die)/.test(kind)?.94+Math.random()*.12:1;if(!opt.force&&now-(sfxLast[kind]??-9)<(SFX_GAP[kind]??.03))return;sfxLast[kind]=now;
 try{const buf=sfxBuf[kind]?.buf;if(buf){const src=c.createBufferSource(),g=c.createGain();src.buffer=buf;src.playbackRate.value=rate;g.gain.value=.9*vol;src.connect(g).connect(c.destination);src.start(at);return;}
  const P=SFX_SYNTH[kind];if(!P)return;const o=c.createOscillator(),g=c.createGain();o.type=P[4];o.frequency.setValueAtTime(P[0]*rate,at);o.frequency.exponentialRampToValueAtTime(P[1]*rate,at+P[2]);g.gain.setValueAtTime(Math.min(.6,P[3]*2*vol),at);g.gain.exponentialRampToValueAtTime(.001,at+P[2]);o.connect(g).connect(c.destination);o.start(at);o.stop(at+P[2]+.02);}catch(e){}}
const BGM_FILES={1:'01. Title Theme',4:'04. Blades of the Young',5:'05. March of the Broken Banner',6:'06. When Kingdoms Fall',7:'07. Awakened Colossus',10:'10. Raise the Banner',12:'12. Where Our Journey Ends'};
const BGM_FADE=1;   // seconds of crossfade between tracks
// Music is decoded into memory and played through Web Audio (as in cnation TACTICS), so the volume setting works on every phone —
// iPhone Safari ignores <audio>.volume and does not always route <audio> through Web Audio. Tracks are kept as mono 22 kHz buffers
// (about 5 MB a minute), at most BGM_KEEP at once. WebM/Opus is tried first, then the AAC copy (.m4a). If neither decodes, that track
// falls back to an <audio> element routed through a gain node.
const BGM_RATE=22050,BGM_KEEP=3,BGM_SCALE=.6;   // music gain = setting × BGM_SCALE; at 50 the music sits ~7 dB under the effects
const bgm={buf:new Map(),loading:{},cur:null,want:null,unlocked:false,duck:1,node:null,pos:{},token:0,
 url(id,ext){return `bgm/${encodeURIComponent(BGM_FILES[id])}_64k.${ext}`;},
 decode(ab){return new Promise((ok,no)=>{let oc;try{oc=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,1,BGM_RATE);}catch(e){no(e);return;}
  try{const p=oc.decodeAudioData(ab,ok,no);if(p&&p.catch)p.catch(no);}catch(e){no(e);}});},
 mono(b){if(b.numberOfChannels===1)return b;const m=audioCtx().createBuffer(1,b.length,b.sampleRate),o=m.getChannelData(0),l=b.getChannelData(0),r=b.getChannelData(1);for(let i=0;i<o.length;i++)o[i]=(l[i]+r[i])*.5;return m;},
 // Resolves with the decoded track, or null when it cannot be decoded (then the <audio> fallback plays it).
 load(id){if(this.buf.has(id))return Promise.resolve(this.buf.get(id));if(this.loading[id])return this.loading[id];
  const get=ext=>fetch(this.url(id,ext)).then(r=>r.ok?r.arrayBuffer():Promise.reject(new Error(r.status))).then(ab=>this.decode(ab));
  return this.loading[id]=get('webm').catch(()=>get('m4a')).then(b=>this.mono(b),()=>null).then(b=>{delete this.loading[id];this.buf.set(id,b);this.trim(id);return b;});},
 trim(keep){for(const k of [...this.buf.keys()]){if(this.buf.size<=BGM_KEEP)break;if(k!==keep&&k!==this.cur&&this.buf.get(k))this.buf.delete(k);}},
 preload(id){if(this.unlocked&&BGM_FILES[id])this.load(id);},
 level(){return settings.bgm*BGM_SCALE*this.duck;},
 ramp(n,v,t){if(!n||!ac)return;const g=n.g.gain,now=ac.currentTime;g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);if(t>0)g.linearRampToValueAtTime(v,now+t);else g.setValueAtTime(v,now);if(n.raw)n.el.volume=Math.max(0,Math.min(1,v*4));},
 // Starts a decoded track (or the <audio> fallback) at zero volume and fades it in.
 start(id,b,loop){const c=audioCtx();if(!c)return;const g=c.createGain();g.gain.value=0;g.connect(c.destination);const n={id,g,loop};
  if(b){const s=c.createBufferSource(),off=id===1?(this.pos[1]||0)%b.duration:0;s.buffer=b;s.loop=loop;s.connect(g);n.src=s;n.dur=b.duration;n.t0=c.currentTime-off;s.start(0,off);
   if(!loop)s.onended=()=>{if(this.node===n)this.play(1);};}
  else{const el=new Audio(this.url(id,new Audio().canPlayType('audio/webm; codecs="opus"')?'webm':'m4a'));el.loop=loop;n.el=el;try{c.createMediaElementSource(el).connect(g);}catch(e){n.raw=true;}
   if(id===1&&this.pos[1])el.currentTime=this.pos[1];if(!loop)el.onended=()=>{if(this.node===n)this.play(1);};el.play().catch(()=>{});}
  this.node=n;this.ramp(n,this.level(),BGM_FADE);},
 fadeOut(n,t=BGM_FADE){if(!n||!ac)return;if(n.id===1)this.pos[1]=n.src?(ac.currentTime-n.t0)%n.dur:n.el.currentTime;this.ramp(n,0,t);
  setTimeout(()=>{try{if(n.src)n.src.stop();if(n.el)n.el.pause();n.g.disconnect();}catch(e){}},t*1000+80);},
 // Title music resumes where it stopped; battle and victory tracks start from the top.
 play(id,loop=true){this.want={id,loop};if(!this.unlocked||this.cur===id)return;this.cur=id;this.fadeOut(this.node);this.node=null;const token=++this.token;
  this.load(id).then(b=>{if(this.token===token&&this.cur===id)this.start(id,b,loop);});},
 stop(t=1.5){this.want=null;this.cur=null;this.token++;this.fadeOut(this.node,t);this.node=null;},
 setDuck(d){if(this.duck===d)return;this.duck=d;this.ramp(this.node,this.level(),.4);},
 unlock(){if(this.unlocked)return;this.unlocked=true;audioCtx();loadSfx();if(this.want)this.play(this.want.id,this.want.loop);},
 volume(){this.ramp(this.node,this.level(),.2);}};
window.addEventListener('pointerdown',()=>{bgm.unlock();audioCtx();},{capture:true});
document.addEventListener('visibilitychange',()=>{const el=bgm.node&&bgm.node.el;if(document.hidden){if(ac)ac.suspend().catch(()=>{});if(el)el.pause();}else{audioCtx();if(el)el.play().catch(()=>{});}if(document.hidden&&S&&S.phase==='battle'){paused=true;hudKey='';}});
const battleTrack=()=>S.chapter.battles[S.battle]?.boss?7:[4,5,6][(S.chapterIndex+Math.floor(S.battle/3))%3];

// ── HUD, strip, dock, panel ──
let toastTimer=0;function toast(text){if(demo.on)return;const t=$('#toast');t.textContent=text;t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),2000);}
let bannerTimer=0;function banner(small,strong){if(demo.on)return;const b=$('#banner');b.children[0].textContent=small;b.children[1].textContent=strong;b.classList.add('on');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>b.classList.remove('on'),1700);}
let hudKey='';
function updateHud(){const key=[S.units.map(u=>u.ult?Math.ceil(u.ultCd)+(ultReady(u)?'!':'')+(u.shardT>0?'s':'')+(u.vantage?'v':''):'').join(),S.life,S.gold,S.units.length,S.battle,S.phase,Math.ceil(S.prep),S.enemies.length+S.queue.length,speed,paused].join('|');if(key===hudKey)return;hudKey=key;
 $('#hudLife').textContent=S.life;$('#hudGold').textContent=S.gold;const heroes=Object.keys(S.hero).length;$('#hudHeroes').textContent=`${S.units.length-S.soldierCount()}/${heroes}`;$('#hudSoldiers').textContent=`${S.soldierCount()}/${S.soldierCap}`;
 const b=S.chapter.battles[S.battle];$('#hudBattle').textContent=`${S.battle+1}/${S.chapter.battles.length} ${b?b.name:''}`;
 $('#speedBtn').textContent='×'+speed;$('#pauseBtn').textContent=paused?'▶':'⏸';
 const start=$('#startBtn');if(S.phase==='prep'){start.hidden=false;const bonus=S.battle>0?Math.floor(S.prep):0;start.textContent=bonus>0?`전투 시작 +${bonus}💰`:'전투 시작';}else start.hidden=true;
 if(S.phase==='battle'){const left=S.enemies.length+S.queue.length;$('#chips').innerHTML=`<span class="chip">⚔ 전투 중 · 남은 적 <b>${left}</b></span>`+(S.blessings.length?`<span class="chip bless">✨ 축복 ${S.blessings.length} · 이번 장</span>`:'')+nextChip();}
 refreshDock();if(selUnit)refreshPanel();}
// During a battle: what the next battle brings (elements, elites, or the boss), so the player can prepare the matching elements.
function nextChip(){const nx=S.preview(S.battle+1);if(!nx.length)return '';const boss=nx.find(p=>p.boss);
 if(boss)return `<span class="chip next boss">다음 전투: 👑 ${boss.name}${boss.element?' '+D.ELEMENT_ICON[boss.element]+EL_NAME[boss.element]:''}</span>`;
 const els=[...new Set(nx.map(p=>p.element).filter(Boolean))],el=nx.filter(p=>p.elite).reduce((a,p)=>a+p.count,0);
 return `<span class="chip next">다음 전투: ${els.map(k=>D.ELEMENT_ICON[k]+EL_NAME[k]).join(' · ')||'무속성'}${el?` · 정예 ${el}`:''}</span>`;}
const chipText=p=>`${p.boss?'👑 ':''}${p.name} ×${p.count}${p.element?' '+D.ELEMENT_ICON[p.element]:''}${p.flying?' <i>비행</i>':''}${p.immunity==='physical'?' <i>물리↓</i>':p.immunity==='magic'?' <i>마법↓</i>':''}`;
function showPreview(){const chips=$('#chips');chips.innerHTML=`<span class="chip info">ⓘ 적 정보</span>`+S.preview().map(p=>`<span class="chip${p.elite?' elite':''}${p.boss?' boss':''}">${chipText(p)}</span>`).join('');chips.scrollLeft=0;}
$('#chips').addEventListener('click',()=>{if(!S||modalOpen||S.phase!=='prep')return;sfx('ui_tap');const m=modal(`<p class="sub">전투 ${S.battle+1} · ${S.chapter.battles[S.battle].name}</p><h2>이번에 오는 적</h2><ul class="foes">`+S.preview().map(p=>`<li><b>${chipText(p)}</b><br>${p.note}</li>`).join('')+`</ul><button class="primary">닫기</button>`);m.querySelector('button').onclick=closeModal;});
function buildDock(){const dock=$('#dock');dock.innerHTML='';const rows=[D.HERO_ORDER,D.SOLDIER_ORDER].map(order=>order.filter(id=>S.chapter.roster.includes(id)));
 for(const ids of rows){const row=document.createElement('div');row.className='row';for(const id of ids){const d=D.UNITS[id],el=document.createElement('div');el.className='card';el.dataset.id=id;
   el.innerHTML=`<img alt="" src="${portraits[id]}"><div class="nm">${d.name}</div><div class="ct"></div>`;el.addEventListener('pointerdown',e=>cardDown(e,id));row.appendChild(el);}dock.appendChild(row);}refreshDock();}
function refreshDock(){for(const el of document.querySelectorAll('#dock .card')){const id=el.dataset.id,d=D.UNITS[id],hero=S.hero[id],unit=d.kind==='hero'&&S.units.find(u=>u.def===id),out=!!unit,cost=S.deployCost(id),cd=hero?Math.ceil(hero.cd):0,ready=out&&ultReady(unit);
  const off=!out&&(S.gold<cost||!S.slotFree(id)||cd>0);el.className='card'+(d.kind==='hero'?' hero':'')+(selCard===id?' sel':'')+(off?' off':'')+(out?' out':'')+(ready?' ult':'')+(out&&unit.shardT>0?' shard':'')+(out&&unit.ult&&shardUi&&shardUi.phase!=='fall'?' take':'');
  let ub=el.querySelector('.ub');if(out&&unit.ult){if(!ub){ub=document.createElement('div');ub.className='ub';ub.innerHTML='<i></i>';el.appendChild(ub);}ub.firstChild.style.width=Math.round(100*(1-Math.min(1,unit.ultCd/S.ultTime(unit))))+'%';}else if(ub)ub.remove();
  el.querySelector('.ct').textContent=ready?'⚡ 필살기':out&&unit.ult&&S.phase==='battle'?Math.ceil(unit.ultCd)+'초':out?'출전 중':hero&&hero.keep&&!cd?'복귀':cost+'💰';
  let cool=el.querySelector('.cool');if(cd>0){if(!cool){cool=document.createElement('div');cool.className='cool';el.appendChild(cool);}cool.textContent=cd;}else if(cool)cool.remove();}}
function nextRankText(u){const d=S.defOf(u),k=d.ranks[u.rank];if(!k)return '최대 랭크입니다.';const bits=['능력치↑'];if(k.skills)bits.push(k.skills.map(s=>D.SKILLS[s].name).join(', '));if(k.choice)bits.push('각인 선택');if(k.desc)bits.push(k.desc);if(k.ult)bits.push('필살기 '+D.SKILLS[k.ult].name);return `다음 ★${u.rank+1}: `+bits.join(' · ');}
let panelKey='';
// Element matchups (same table as sim.affinity): fire > wind > water(+ice) > fire, light ↔ dark; thunder/none neutral.
const BAR_HOLD=.25,BAR_DRAIN=.25;
// Bar length follows the monster's max HP (square-root scale against an ordinary monster of this battle), so tougher monsters
// carry visibly longer bars: about ×0.8 for the weakest, ×1.5–1.8 for elites and big ones, up to ×2.4 for bosses.
// Big boss bar at the top of the battlefield: name, element, HP numbers, the same red bar with its pale trail.
const bossEl=(()=>{const el=document.createElement('div');el.id='bossBar';el.hidden=true;el.innerHTML='<div class="bb-top"><span class="bb-el"></span><b class="bb-name"></b><span class="bb-hp"></span></div><div class="bb-bar"><i class="bb-trail"></i><i class="bb-fill"></i></div>';$('#viewport').appendChild(el);return el;})();
let bossKey='';
function bossHud(b){const show=!!b&&!demo.on;if(bossEl.hidden===show)bossEl.hidden=!show;viewport.classList.toggle('has-boss',show);if(!show){bossKey='';return;}
 const e=b.e,pct=v=>Math.max(0,Math.min(100,v/e.maxHp*100)).toFixed(2)+'%',key=e.id+'|'+e.name;
 if(key!==bossKey){bossKey=key;bossEl.querySelector('.bb-name').textContent=e.name;const ic=bossEl.querySelector('.bb-el');ic.textContent=e.element?D.ELEMENT_ICON[e.element]:'👑';ic.style.borderColor=e.element?(EL_COLOR[e.element]||'#fff'):'#f2cf72';}
 bossEl.querySelector('.bb-fill').style.width=pct(b.shown);bossEl.querySelector('.bb-trail').style.width=pct(b.trail);
 bossEl.querySelector('.bb-hp').textContent=`${Math.max(0,Math.ceil(e.hp)).toLocaleString('ko-KR')} / ${Math.round(e.maxHp).toLocaleString('ko-KR')}`;
 bossEl.classList.toggle('hit',b.flash>0);}
const BAR_REF_HP=69;function hpBarScale(e){const b=S.chapter.battles[S.battle]||S.chapter.battles[0],ref=BAR_REF_HP*(b.tune?b.tune[0]:1);
 return Math.max(.75,Math.min(e.boss?2.4:1.8,Math.sqrt(e.maxHp/ref)));}   // monster HP bar trail: same short time for every hit
const ELF=e=>e==='ice'?'water':e,STRONG_VS={fire:'바람 적에게 강함',water:'불 적에게 강함',ice:'불 적에게 강함',wind:'물 적에게 강함',light:'어둠 적에게 강함',dark:'빛 적에게 강함',thunder:'상성 없음'};
function matchup(att,tgt){const a=ELF(att),b=ELF(tgt);if(!a||!b)return 1;if((a==='light'&&b==='dark')||(a==='dark'&&b==='light'))return 1.25;const adv={fire:'wind',wind:'water',water:'fire'};return !adv[a]||!adv[b]?1:adv[a]===b?1.25:adv[b]===a?.75:1;}
// The elements a character attacks with: basic attack, skills and 필살기.
function unitElements(u){const d=S.defOf(u),set=new Set();if(d.element)set.add(d.element);for(const s of u.skills){const e=D.SKILLS[s.id].element;if(e)set.add(e);}if(u.ult&&D.SKILLS[u.ult].element)set.add(D.SKILLS[u.ult].element);return [...set];}
function refreshPanel(force){const u=S.units.find(v=>v.id===selUnit);if(!u){closePanel();return;}const d=S.defOf(u),cost=S.rankCost(u),choice=S.needsChoice(u),ultReady=u.ult&&u.ultCd<=0;
 const key=[u.id,u.rank,cost,S.gold>=cost,Math.round(u.hp),Math.ceil(u.ultCd),aiming,choice,u.vantage,u.shardT>0,Object.keys(u.st).join()].join('|');if(!force&&key===panelKey)return;panelKey=key;
 const kit=u.skills.map(s=>D.SKILLS[s.id].name).join(', '),bad=Object.keys(u.st).map(k=>ST_NAME[k]).join('·');
 let btns='';
 let chRow='';if(choice&&cost!=null){const ch=d.ranks[u.rank].choice;chRow=`<div class="btns choices">${Object.keys(ch).map(k=>`<button class="primary" data-act="rank" data-choice="${k}" ${S.gold<cost?'disabled':''}>${ch[k].label} ${cost}💰<small>${STRONG_VS[k]||''}</small></button>`).join('')}</div>`;}
 else if(cost!=null)btns+=`<button class="primary" data-act="rank" ${S.gold<cost?'disabled':''}>랭크업 ${cost}💰</button>`;
 if(u.ult)btns+=`<button class="ult" data-act="ult" ${ultReady&&S.phase==='battle'?'':'disabled'}>${aiming===u.id?'위치 지정':ultReady?D.SKILLS[u.ult].name+' '+S.ultElements(u).map(k=>D.ELEMENT_ICON[k]||'').join(''):D.SKILLS[u.ult].name+' '+Math.ceil(u.ultCd)+'초'}</button>`;
 btns+=`<button data-act="withdraw">철수 +${S.refundOf(u)}</button><button class="x" data-act="close">×</button>`;
 const line2=choice?'★3 각인 · 기술 하나를 그 속성으로 배우거나 강화합니다':nextRankText(u);
 $('#panel').innerHTML=`<img alt="" src="${portraits[u.def]}"><div class="info"><h3>${d.name} <span>${'★'.repeat(u.rank)}${'☆'.repeat(d.maxRank-u.rank)}</span> HP ${Math.max(0,Math.round(u.hp))}/${u.maxHp}${bad?` <em>${bad}</em>`:''}</h3><p>${u.vantage?'<b class="vt">✦명당</b> ':''}${u.shardT>0?'<b class="sh">💎×2</b> ':''}공격 ${Math.round((d.magic?u.mag:u.atk)*u.buff)} · 사거리 ${u.range}${u.block?' · 붙잡기 '+u.block:''}${u.ult?' · 필살기 충전 '+Math.round(S.ultTime(u)/(u.vantage?1.5:1))+'초':''}${kit?' · '+kit:''}</p><p class="next">${line2}</p>${chRow}<div class="btns">${btns}</div></div>`;$('#panel').classList.toggle('choosing',!!chRow);}
function openPanel(id){selUnit=id;selCard=null;aiming=null;validTiles=null;app.classList.add('unit-open');panelKey='';refreshPanel(true);}
function closePanel(){selUnit=null;aiming=null;$('#aimHint').style.display='none';app.classList.remove('unit-open');}
$('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const act=b.dataset.act,u=S.units.find(v=>v.id===selUnit);if(!u)return closePanel();
 if(act==='close'){sfx('ui_tap');closePanel();}
 else if(act==='rank'){const err=S.rankUp(u.id,b.dataset.choice);if(err){toast(err);sfx('ui_error');}else{sfx('rank_up');refreshPanel(true);}}
 else if(act==='withdraw'){S.withdraw(u.id);sfx('coin');closePanel();}
 else if(act==='ult'){if(aiming===u.id){aiming=null;$('#aimHint').style.display='none';refreshPanel(true);}else castUlt(u);}
 hudKey='';});

// ── Placing characters ──
const ultReady=u=>!!(u&&u.ult&&u.ultCd<=0&&S.phase==='battle'&&!u.st.freeze&&!u.st.stun&&!u.st.silence);
// Casts a hero's 필살기 at once (메테오 asks where to drop it first).
// With more than one learned element the player picks which one the 필살기 carries (each adds its own side effect).
function castUlt(u){const els=S.ultElements(u);if(els.length>1){openElPick(u,els);return;}fireUlt(u,els[0]);}
function fireUlt(u,el){closeElPick();if(D.SKILLS[u.ult].aim){openPanel(u.id);aiming=u.id;aimEl=el;$('#aimHint').style.display='block';refreshPanel(true);return;}
 const err=S.ult(u.id,undefined,undefined,el);if(err){toast(err);sfx('ui_error');}else closePanel();hudKey='';}
const elPickEl=(()=>{const el=document.createElement('div');el.id='elPick';el.hidden=true;$('#viewport').appendChild(el);return el;})();
function openElPick(u,els){sfx('ui_tap');closePanel();clearCard();pickEl=u.id;const s=D.SKILLS[u.ult],weak=k=>S.enemies.filter(e=>matchup(k,e.element)>1).length,res=k=>S.enemies.filter(e=>matchup(k,e.element)<1).length;
 const score=k=>weak(k)-res(k),best=els.slice().sort((a,b)=>score(b)-score(a))[0];
 elPickEl.innerHTML=`<div class="ep-t"><b>${D.UNITS[u.def].name} · ${s.name}</b><span>속성을 고르세요</span></div><div class="ep-b">${els.map(k=>{const w=weak(k),r=res(k);
  return `<button data-el="${k??''}" class="${k===best&&score(k)>0?'best':''}" style="--c:${EL_COLOR[k]||'#fff'}"><i>${D.ELEMENT_ICON[k]||'⚔'}</i><b>${EL_NAME[k]||'무속성'}</b><small>${ULT_FX_NOTE[k]||''}</small><em class="${w?'good':r?'bad':''}">${w?`약점 ${w}`:r?`저항 ${r}`:'보통'}</em></button>`;}).join('')}<button class="x" data-el="x">×</button></div>`;
 elPickEl.hidden=false;}
function closeElPick(){pickEl=null;elPickEl.hidden=true;}
elPickEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const u=S&&S.units.find(v=>v.id===pickEl);if(b.dataset.el==='x'||!u||!ultReady(u)){sfx('ui_tap');closeElPick();return;}fireUlt(u,b.dataset.el||null);});
function selectCard(id){const out=D.UNITS[id].kind==='hero'&&S.units.find(u=>u.def===id);if(out){if(ultReady(out))castUlt(out);else openPanel(out.id);return;}closePanel();selCard=id;
 validTiles=S.map.tiles.filter(t=>{const e=S.canDeploy(id,t.c,t.r);return !e||e==='골드가 부족합니다';});
 // Road tiles a melee card may not use because another melee character stands too close.
 spacedTiles=D.UNITS[id].melee?S.map.tiles.filter(t=>t.road&&/떨어져야|적 출현 문/.test(S.canDeploy(id,t.c,t.r)||'')):[];refreshDock();}
function clearCard(){selCard=null;validTiles=null;spacedTiles=[];hover=null;dragging=false;refreshDock();}
function tryDeploy(c,r){const id=selCard,err=S.deploy(id,c,r);if(err){toast(err);sfx('ui_error');return false;}sfx('place_unit');const d=D.UNITS[id];if(d.kind==='soldier'&&S.gold>=S.deployCost(id)&&S.slotFree(id))selectCard(id);else clearCard();hudKey='';return true;}
const localPoint=e=>{const r=viewport.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top,inside:e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom};};
const tileAt=p=>{const w=unproj(p.x,p.y),c=Math.round(w.x),r=Math.round(w.y);return S.map.tile(c,r)?{c,r}:null;};
let down=null;
function cardDown(e,id){if(modalOpen||!S)return;e.preventDefault();sfx('ui_tap');if(shardPicking()){const u=S.units.find(v=>v.def===id&&v.ult);if(u){giveShardTo(u.id);return;}}selectCard(id);if(selCard!==id)return;down={x:e.clientX,y:e.clientY,card:true};dragging=false;}
window.addEventListener('pointermove',e=>{if(!S||!selCard||!down||!down.card)return;if(!dragging&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10)dragging=true;if(dragging){const p=localPoint(e);hover=p.inside?tileAt({x:p.x,y:p.y-pxU*.6}):null;}});
window.addEventListener('pointerup',e=>{if(!S||!down||!down.card)return;const wasDrag=dragging;down=null;if(wasDrag&&selCard){dragging=false;const p=localPoint(e),t=p.inside?tileAt({x:p.x,y:p.y-pxU*.6}):null;hover=null;if(t)tryDeploy(t.c,t.r);}});
fxc.addEventListener('pointerdown',e=>{if(modalOpen||!S)return;const p=localPoint(e);if(shardPicking()){const u=heroAt(e.clientX,e.clientY);if(u){giveShardTo(u.id);return;}}
 if(aiming){const w=unproj(p.x,p.y),err=S.ult(aiming,w.x,w.y,aimEl);if(err){toast(err);sfx('ui_error');}aiming=null;$('#aimHint').style.display='none';closePanel();return;}
 if(selCard){const t=tileAt(p);if(t)tryDeploy(t.c,t.r);else clearCard();return;}
 // Tap a character: test the bodies first (they stand taller than their tile). Otherwise a monster, otherwise the tile.
 let best=null;for(const u of S.units){const s=proj(u.x,u.y,groundY(u.x,u.y)+.5),d=Math.hypot(s.x-p.x,s.y-p.y);if(d<pxU*.55&&(!best||d<best.d))best={u,d};}
 if(best){sfx('ui_tap');openPanel(best.u.id);return;}closePanel();
 let foe=null;for(const en of S.enemies){const s=proj(en.x,en.y,.4*(en.scale||1)),d=Math.hypot(s.x-p.x,s.y-p.y);if(d<pxU*.5*(en.scale||1)&&(!foe||d<foe.d))foe={e:en,d};}
 if(foe){const en=foe.e,m=D.MONSTERS[en.kind],note=en.boss?S.chapter.boss.hint:(D.MODEL_TRAITS[en.model]||{}).note||'';toast(`${en.name} HP ${Math.ceil(en.hp)}/${Math.round(en.maxHp)}${en.element?' '+D.ELEMENT_ICON[en.element]:''} · ${note}`);return;}
 const t=tileAt(p),tt=t&&S.map.tile(t.c,t.r);if(tt&&tt.terrain!=='grass'&&tt.terrain!=='road')toast({high:'고지대: 원거리 사거리 +0.5칸',forest:'수풀: 사거리 −0.5칸, 적의 화살을 잘 피함',swamp:'늪: 지나는 몬스터가 30% 느려짐',sand:'모래: 지나는 몬스터가 18% 느려짐',bridge:'다리: 근접 캐릭터가 설 수 있는 길목',water:'물: 배치 불가',cliff:'절벽: 배치 불가',prop:'구조물: 배치 불가',rock:'바위: 배치 불가'}[tt.terrain]||TERRAIN_NAME[tt.terrain]);});
$('#startBtn').addEventListener('click',()=>{if(S.phase!=='prep')return;if(!S.units.length){toast('먼저 동료를 한 명 이상 배치하세요');sfx('ui_error');return;}S.startBattle();});
$('#speedBtn').addEventListener('click',()=>{speed=speed%3+1;hudKey='';sfx('ui_tap');});
$('#pauseBtn').addEventListener('click',()=>{paused=!paused;hudKey='';sfx('ui_tap');});
$('#menuBtn').addEventListener('click',()=>{if(S&&!modalOpen){sfx('ui_tap');gameMenu();}});

// ── Modals ──
function modal(html,cls){const m=$('#modal');m.className=cls||'';m.innerHTML=`<div class="sheet">${html}</div>`;m.hidden=false;modalOpen=true;return m;}
function closeModal(){$('#modal').hidden=true;modalOpen=false;}
function dialogue(lines,done){let i=0;const show=()=>{const [who,text]=lines[i],m=modal(`<p class="sub">${S.chapter.label} · ${S.chapter.name}</p><p class="who">${who}</p><p class="line">${text}</p><button class="primary">${i<lines.length-1?'다음':'확인'}</button><button data-skip>건너뛰기</button>`);
  m.querySelector('.primary').onclick=()=>{sfx('ui_tap');if(++i<lines.length)show();else{closeModal();done&&done();}};m.querySelector('[data-skip]').onclick=()=>{closeModal();done&&done();};};show();}
function blessingModal(){const m=modal(`<p class="sub">에테르 축복</p><h2>하나를 고르세요</h2><p class="scope now">⏳ 이번 장에서만 효력 · 장이 끝나면 사라집니다</p>`+S.offer.map(id=>{const b=D.BLESSINGS.find(v=>v.id===id);return `<button data-id="${id}">✨ ${b.name}<small>${b.desc} (이번 장에서만)</small></button>`;}).join(''),'bless');
 m.querySelectorAll('button').forEach(b=>b.onclick=()=>{S.chooseBlessing(b.dataset.id);sfx('blessing');closeModal();hudKey='';});}
const cleared=()=>loadJSON(CLEAR_KEY,{});
// ── Arca legacies: permanent, one slot per chapter (picked after a clear; a replay may swap that chapter's pick) ──
const legacyPicks=()=>loadJSON(LEGACY_KEY,{picks:{}}).picks||{};
const legacyNow=()=>D.legacyCounts(legacyPicks());
const legacyInfo=id=>D.LEGACIES.find(l=>l.id===id);
function legacyListHTML(picks){const rows=D.CHAPTERS.map((c,i)=>{const l=picks[i]&&legacyInfo(picks[i]);return `<tr><td>${c.label}</td><td>${l?`${l.icon} <b>${l.name}</b><br><small>${l.desc}</small>`:'<small>아직 없음</small>'}</td></tr>`;}).join('');
 const counts=D.legacyCounts(picks),sum=Object.keys(counts).map(id=>{const l=legacyInfo(id);return l?`<li>${l.icon} ${l.name}${counts[id]>1?' ×'+counts[id]:''} — ${l.desc}${counts[id]>1?` (${counts[id]}번 누적)`:''}</li>`:'';}).join('');
 return `<div class="tip"><table>${rows}</table>${sum?`<p><b>지금 적용 중인 효과</b></p><ul>${sum}</ul>`:''}</div>`;}
function legacyModal(index,done,dots){const picks=legacyPicks(),current=picks[index],others={...picks};delete others[index];
 const offer=D.legacyOffer(D.legacyCounts(others),index,Math.random);if(current&&!offer.includes(current))offer.push(current);
 const m=modal(`${dots||''}<p class="sub">${D.CHAPTERS[index].label} CLEAR</p><h2>아르카의 유산</h2><p class="scope keep">♾ 영구 효과 · 다음 장부터 계속 누적됩니다</p><p>이 장을 지켜낸 보답으로 하나를 고르세요.${current?`<br><small>이미 이 장의 유산이 있습니다. 다른 것을 고르면 바뀝니다.</small>`:''}</p>`+offer.map(id=>{const l=legacyInfo(id),n=D.legacyCounts(others)[id]||0;return `<button data-id="${id}" class="${id===current?'cur':''}">${l.icon} ${l.name}${id===current?' (현재)':''}<small>${l.desc}${n?` · 이미 ${n}번 보유 → ${n+1}번째`:''}${l.max>1?` · 최대 ${l.max}번`:''}</small></button>`;}).join(''),'legacy');
 m.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{const all=loadJSON(LEGACY_KEY,{picks:{}});all.picks=all.picks||{};all.picks[index]=b.dataset.id;saveJSON(LEGACY_KEY,all);sfx('legacy');done(legacyInfo(b.dataset.id));});}
// With the altar painting the legacy view is a full screen: ten sockets hold the legacies, the totals sit on the floor below.
const altarEl=$('#altar');
function closeAltar(){if(!altarEl.hidden)modalOpen=false;altarEl.hidden=true;altarEl.innerHTML='';}
function legacyView(back){if(D.ALTAR&&D.ALTAR.file)return altarView(back);const picks=legacyPicks(),counts=D.legacyCounts(picks),n=Object.values(picks).filter(Boolean).length;
 const totals=Object.keys(counts).map(id=>{const l=legacyInfo(id);return l?`<li>${l.icon} ${D.legacyTotal(id,counts[id])}${counts[id]>1?` <small>(${l.name} ×${counts[id]})</small>`:''}</li>`:'';}).join('');
 const slotsHTML=D.CHAPTERS.map((c,i)=>{const l=picks[i]&&legacyInfo(picks[i]);return `<div class="lslot${l?' got':''}"><b>${l?l.icon:'🔒'}</b><span>${l?l.name:(c.id==='prologue'?'프롤로그':c.id==='final'?'FINAL':(+c.id.slice(1))+'장')}</span><small>${l?(c.id==='prologue'?'프롤로그':c.id==='final'?'FINAL':(+c.id.slice(1))+'장'):'아직 없음'}</small></div>`;}).join('');
 const m=modal(`<p class="sub">ARCA LEGACY</p><h2>아르카의 유산 <span class="cnt">${n}/${D.CHAPTERS.length}</span></h2><p class="scope keep">♾ 영구 효과 · 장을 클리어할 때마다 하나씩, 모든 장에 적용</p>
  <h3 class="sec">지금 적용 중인 효과</h3>${totals?`<ul class="totals">${totals}</ul>`:'<p class="small">아직 없습니다. 장을 클리어하면 하나씩 얻습니다.</p>'}
  <h3 class="sec">장별 유산 <small>클리어한 장을 다시 깨면 그 장의 유산을 바꿀 수 있습니다</small></h3><div class="lslots">${slotsHTML}</div>
  <button class="primary" data-a="back">돌아가기</button><button class="dev" data-a="reset">유산 모두 초기화</button>`,'help legacyview');
 m.querySelector('[data-a=back]').onclick=back;m.querySelector('[data-a=reset]').onclick=()=>{const c=modal(`<h2>유산 초기화</h2><p>모아 둔 아르카의 유산을 모두 지웁니다. 되돌릴 수 없습니다.</p><button class="primary" data-a="n">취소</button><button class="dev" data-a="y">모두 지우기</button>`);c.querySelector('[data-a=n]').onclick=()=>legacyView(back);c.querySelector('[data-a=y]').onclick=()=>{saveJSON(LEGACY_KEY,{picks:{}});legacyView(back);};};}
// ── Chapter clear: four pages, one after another — 1 결산 · 2 아르카의 유산 · 3 다음 장 준비(능력치 변화) · 4 마무리 ──
const RECORD_KEY='cnation-td-records-v1';
const fmtTime=t=>`${Math.floor(t/60)}분 ${String(Math.floor(t%60)).padStart(2,'0')}초`;
const pageDots=(i,n)=>`<p class="dots">${Array.from({length:n},(_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</p>`;
function countUp(root){root.querySelectorAll('[data-count]').forEach((el,i)=>{const to=+el.dataset.count,fmt=el.dataset.fmt,t0=performance.now()+i*90,dur=700;
 const draw=v=>{el.textContent=fmt==='time'?fmtTime(v):Math.round(v).toLocaleString('ko-KR');};draw(0);
 const tick=now=>{const k=Math.min(1,Math.max(0,(now-t0)/dur));draw(to*(1-Math.pow(1-k,3)));if(k<1&&!root.hidden)requestAnimationFrame(tick);};requestAnimationFrame(tick);});}
function clearFlow(index){const ch=S.chapter,next=D.CHAPTERS[index+1],pages=next?4:3,st=S.stats,lifeGoal=Math.ceil(ch.life*.75);
 const n=S.leaksTotal===0?3:S.life>=lifeGoal?2:1,best=cleared(),prevStars=best[ch.id]||0;best[ch.id]=Math.max(prevStars,n);saveJSON(CLEAR_KEY,best);try{localStorage.removeItem(SAVE_KEY);}catch(e){}
 const recs=loadJSON(RECORD_KEY,{}),old=recs[ch.id],rec={stars:n,life:S.life,time:Math.round(st.time),kills:S.kills};
 const better=old?(n>old.stars||(n===old.stars&&(S.life>old.life||(S.life===old.life&&rec.time<old.time)))):false;if(!old||better){recs[ch.id]=rec;saveJSON(RECORD_KEY,recs);}
 const before=legacyNow();
 // Page 1 — 결산
 const dealt=Object.entries(st.dealt).sort((a,b)=>b[1]-a[1]),healed=Object.entries(st.healedBy||{}).sort((a,b)=>b[1]-a[1]),top=dealt[0]&&dealt[0][1]||1;
 const mvp=dealt[0]&&dealt[0][0],medic=healed[0]&&healed[0][1]>0?healed[0]:null;
 const conds=[['장 클리어',true],[`생명 ${lifeGoal} 이상 남기기`,S.life>=lifeGoal],['적을 하나도 놓치지 않기',S.leaksTotal===0]];
 const p1=()=>{const m=modal(`${pageDots(0,pages)}<p class="sub">${ch.label} CLEAR</p><h2>${ch.name}</h2>
  <p class="stars big">${[0,1,2].map(i=>`<span class="${i<n?'got':''}" style="animation-delay:${.25+i*.35}s">${i<n?'★':'☆'}</span>`).join('')}</p>
  <ul class="conds">${conds.map(([t,ok],i)=>`<li class="${ok?'ok':''}">${'★'.repeat(i+1)} ${t} <b>${ok?'✔':'✘'}</b></li>`).join('')}</ul>
  ${better?'<p class="record">🏆 최고 기록 갱신!</p>':old?`<p class="small">최고 기록 ★${old.stars} · 생명 ${old.life} · ${fmtTime(old.time)}</p>`:''}
  <div class="tally">${[['처치',S.kills],['남은 생명',S.life],['놓친 적',S.leaksTotal],['전투 시간',Math.round(st.time),'time'],['번 골드',st.goldEarned],['쓴 골드',st.goldSpent],['필살기',st.ults],['회복량',Math.round(st.healed)]].map(([k,v,f])=>`<div><small>${k}</small><b data-count="${v}"${f?` data-fmt="${f}"`:''}>0</b></div>`).join('')}</div>
  ${mvp?`<div class="mvp"><img alt="" src="${portraits[mvp]}"><div><small>MVP</small><b>${D.UNITS[mvp].name}</b><span>피해 ${Math.round(dealt[0][1]).toLocaleString('ko-KR')}</span>${medic?`<em>든든한 지원 · ${D.UNITS[medic[0]].name} 회복 ${Math.round(medic[1]).toLocaleString('ko-KR')}</em>`:''}</div></div>`:''}
  <div class="bars">${dealt.slice(0,8).map(([id,v])=>`<div><span>${D.UNITS[id].name}</span><i style="--w:${Math.max(3,v/top*100)}%"></i><small>${Math.round(v).toLocaleString('ko-KR')}</small></div>`).join('')}</div>
  <button class="primary" data-a="go">다음<small>아르카의 유산 받기</small></button>`,'clear');countUp(m);
  m.querySelector('[data-a=go]').onclick=()=>{sfx('ui_confirm');legacyModal(index,gained=>{const after=legacyNow();next?p3(gained,after):p4(gained);},pageDots(1,pages));};};
 // Page 3 — 다음 장 준비: legacy effect on the next chapter's heroes, new companions, other changes
 const p3=(gained,after)=>{const joinNew=next.roster.filter(id=>!ch.roster.includes(id)),heroes=D.HERO_ORDER.filter(id=>next.roster.includes(id)),soldiers=D.SOLDIER_ORDER.filter(id=>next.roster.includes(id));
  const stat=(a,b,label)=>{const ra=Math.round(a),rb=Math.round(b);return `<span class="st">${label} ${rb>ra?`${ra} → <b class="up">${rb}</b>`:rb}</span>`;};
  const card=id=>{const d=D.UNITS[id],a=D.unitStats(id,before),b=D.unitStats(id,after),magic=d.mag>d.atk;
   return `<div class="ucard${joinNew.includes(id)?' new':''}"><img alt="" src="${portraits[id]}"><div><b>${d.name}${joinNew.includes(id)?' <em>NEW</em>':''}</b>${stat(a.hp,b.hp,'HP')}${magic?stat(a.mag,b.mag,'마법'):stat(a.atk,b.atk,'공격')}</div></div>`;};
  const v=(k,base,per,L)=>base+per*((L[k])||0),diff=[['시작 골드',v('startGold',next.startGold,60,before),v('startGold',next.startGold,60,after)],['수정 생명',v('life',next.life,3,before),v('life',next.life,3,after)],['병사 자리',v('command',next.soldiers,1,before),v('command',next.soldiers,1,after)]];
  const changed=Object.keys(after).some(k=>after[k]!==(before[k]||0))||Object.keys(before).some(k=>before[k]!==(after[k]||0));
  const m=modal(`${pageDots(2,pages)}<p class="sub">NEXT · ${next.label}</p><h2>다음 장 준비</h2>
   ${gained?`<p class="scope keep">♾ ${gained.icon} ${gained.name} — ${gained.desc}</p>`:''}${changed?'':'<p class="small">이 장의 유산이 그대로라 능력치 변화는 없습니다.</p>'}
   <h3 class="sec">영웅 · ★1 기준</h3><div class="ucards">${heroes.map(card).join('')}</div>
   <h3 class="sec">병사</h3><div class="ucards">${soldiers.map(card).join('')}</div>
   <div class="nextinfo">${diff.map(([k,a,b])=>`<span>${k} ${b!==a?`${a} → <b class="up">${b}</b>`:b}</span>`).join('')}${after.starter?`<span>${before.starter?'':'<b class="up">NEW</b> '}영웅 첫 배치 ★2</span>`:''}${after.rankDisc?`<span>랭크업 비용 −${8*after.rankDisc}%</span>`:''}${after.ultCdr?`<span>필살기 재사용 −${15*after.ultCdr}%</span>`:''}</div>
   ${joinNew.length?`<p class="small">✨ 새로 합류: ${joinNew.map(id=>D.UNITS[id].name).join(' · ')}</p>`:''}
   <button class="primary" data-a="go">다음</button>`,'clear');
  m.querySelector('[data-a=go]').onclick=()=>{sfx('ui_confirm');p4(gained);};};
 // Page 4 (3 on the last chapter) — 마무리
 const p4=gained=>{const m=modal(`${pageDots(pages-1,pages)}<p class="sub">${ch.label} CLEAR</p><h2>${ch.name}</h2><p class="stars">${'★'.repeat(n)}${'☆'.repeat(3-n)}</p>
  ${gained?`<p class="scope keep">♾ 얻은 유산: ${gained.icon} ${gained.name} — ${gained.desc}</p>`:''}
  ${next?`<button class="primary" data-a="next">다음 장으로<small>${next.label} · ${next.name}</small></button>`:`<p class="line">아르카 연대기 · 방어전<br>모든 장을 지켜냈습니다. 함께해 주셔서 고맙습니다.</p>`}<button data-a="map">지도로</button>`);
  if(next)m.querySelector('[data-a=next]').onclick=()=>{closeModal();startChapter(index+1,null);};m.querySelector('[data-a=map]').onclick=()=>{sfx('ui_tap');toWorld();};};
 p1();}
function resultModal(won,gained){const ch=S.chapter,index=S.chapterIndex;if(won){const n=S.leaksTotal===0?3:S.life>=Math.ceil(ch.life*.75)?2:1,best=cleared();best[ch.id]=Math.max(best[ch.id]||0,n);saveJSON(CLEAR_KEY,best);try{localStorage.removeItem(SAVE_KEY);}catch(e){}
  const next=D.CHAPTERS[index+1];
  const m=modal(`<p class="sub">${ch.label} CLEAR</p><h2>${ch.name}</h2><p class="stars">${'★'.repeat(n)}${'☆'.repeat(3-n)}</p><p>남은 생명 ${S.life} · 놓친 적 ${S.leaksTotal} · 처치 ${S.kills}</p>${gained?`<p class="scope keep">♾ 얻은 유산: ${gained.icon} ${gained.name} — ${gained.desc}</p>`:''}${next?`<button class="primary" data-a="next">다음 장으로<small>${next.label} · ${next.name}</small></button>`:`<p class="line">아르카 연대기 · 방어전<br>모든 장을 지켜냈습니다. 함께해 주셔서 고맙습니다.</p>`}<button data-a="title">타이틀로</button>`);
  if(next)m.querySelector('[data-a=next]').onclick=()=>{closeModal();startChapter(index+1,null);};m.querySelector('[data-a=title]').onclick=()=>{closeModal();showTitle();};}
 else{const m=modal(`<p class="sub">DEFEAT</p><h2>수정이 깨졌습니다</h2><p>전투 ${S.battle+1} 「${ch.battles[S.battle].name}」에서 막지 못했습니다.</p><button class="primary" data-a="retry">이 전투 다시 하기<small>전투를 시작했던 배치 그대로</small></button><button data-a="restart">장 처음부터</button><button data-a="map">지도로</button><button data-a="title">타이틀로</button>`);
  m.querySelector('[data-a=retry]').onclick=()=>{closeModal();startChapter(index,lastSnap);};m.querySelector('[data-a=restart]').onclick=()=>{closeModal();startChapter(index,null);};m.querySelector('[data-a=map]').onclick=()=>toWorld();m.querySelector('[data-a=title]').onclick=()=>{closeModal();showTitle();};}}
const HELP=`<h2>게임 방법</h2><ul><li>아래 초상화를 <b>끌어서</b> 전장에 놓거나, 누른 뒤 색이 칠해진 칸을 누르면 배치됩니다.</li><li>몬스터는 <b>붉은 문</b>에서 나와 길을 따라 <b>아르카 수정</b>으로 갑니다. 닿으면 생명이 줄어듭니다.</li><li><b>근접</b> 캐릭터를 길 위에 세우면 지나가는 몬스터를 붙잡아 <b>속도를 3분의 2</b>로 늦춥니다. 한 번에 붙잡는 수는 캐릭터마다 다르고, 길 위의 근접 캐릭터끼리는 3칸 이상 떨어져 서야 하고, 적 출현 문 3칸 안에는 세울 수 없습니다.</li><li><b>원거리</b> 캐릭터는 길 옆의 <b>올라온 발판(고지대)</b>에만 설 수 있고, 그 위에서 사거리가 0.5칸 늘어납니다.</li><li>늪·모래를 지나는 몬스터는 느려집니다. 그 근처에 화력을 모으세요.</li><li>배치한 캐릭터를 누르면 <b>랭크업</b>·철수·필살기를 쓸 수 있습니다. ★3에서 각인을 고릅니다.</li><li><b>필살기</b>가 핵심입니다. 출전한 영웅의 필살기는 <b>전투 중에만</b> 차오르고, 다 차면 카드가 빛납니다. 누르면 배운 속성 중 하나를 골라 씁니다. 3초 안에 다른 필살기를 이어 쓰면 <b>연계</b>로 더 강해집니다.</li><li>금색으로 빛나는 <b>명당</b>(원거리 1칸·근접 1칸)에 서면 피해 +20%, 필살기 충전 ×1.5입니다.</li><li>하늘에서 <b>수정 조각</b>이 떨어지면 영웅에게 끌어다 놓으세요(또는 조각 → 영웅 순서로 누르기). 20초 동안 필살기 충전 ×2. 5초 안에 고르지 않으면 아무에게나 갑니다.</li><li>🔥불 &gt; 🪽바람 &gt; 💧물 &gt; 🔥불 순으로 강하고, ✨빛과 🌑암흑은 서로에게 강합니다.</li><li>유령은 물리, 골렘은 마법이 잘 안 먹힙니다. 「ⓘ 적 정보」에서 미리 확인하세요.</li><li>영웅은 한 명뿐입니다. 쓰러지면 잠시 뒤 랭크를 유지한 채 돌아옵니다.</li></ul>`;
// Detailed tips under 「게임 방법」. Hero, soldier, skill, monster and boss parts are built from the data tables so they stay in step with the rules.
const pct=v=>Math.round(v*100)+'%';
function skillDesc(id){const s=D.SKILLS[id],b=[];
 if(s.type==='physical'||s.type==='magic')b.push(`${s.type==='magic'?'마법':'물리'} ${pct(s.power)}`);
 if(s.type==='heal')b.push(s.all?`아군 전원 회복(마법력 ${pct(s.power)})`:`가장 다친 아군 회복(마법력 ${pct(s.power)})`);
 if(s.type==='cleanse'||s.cleanse)b.push('나쁜 상태 해제');
 if(s.type==='taunt')b.push(`주변 ${s.area}칸 적을 ${s.hold}초 붙들고, 적 원거리 공격을 자신에게 끌어옴`);
 if(s.type==='fortress')b.push(`${s.dur}초간 아군이 받는 피해 60% 감소 · 나쁜 상태 해제 · 주변 적 기절`);
 if(s.element)b.push(D.ELEMENT_ICON[s.element]+({fire:'불',water:'물',ice:'냉기',wind:'바람',thunder:'번개',light:'빛',dark:'암흑'})[s.element]);
 if(s.area&&s.type!=='taunt'&&s.type!=='fortress')b.push(`${s.self?'주변':'범위'} ${s.area}칸`);
 if(s.range)b.push(`사거리 ${s.range}칸`);
 if(s.status)b.push(`${ST_NAME[s.status]}${(s.chance??1)<1?' '+pct(s.chance):''}`);
 if(s.ignore)b.push(`방어 ${pct(s.ignore)} 무시`);
 if(s.knockback)b.push('뒤로 밀어냄');
 if(s.pick==='strong')b.push('체력이 가장 많은 적을 노림');
 if(s.aim)b.push('떨어뜨릴 위치를 직접 지정');
 b.push(s.ult?`필살기 · 충전 ${s.cd}초`:`${s.cd}초마다 자동`);
 return `<b>${s.name}</b> — ${b.join(' · ')}`;}
function unitTips(id){const d=D.UNITS[id],extra=[];
 if(d.melee)extra.push(`근접 · 길 위에서 적 ${d.block}마리 붙잡기`);else extra.push(`원거리 · 사거리 ${d.range}칸${d.magic?' · 마법 공격':''}`);
 if(d.minRange)extra.push('바로 옆 칸의 적은 쏘지 못함');if(d.highDmg)extra.push(`고지대에서 피해 +${pct(d.highDmg)}`);
 if(d.behind)extra.push(`자신을 지나친 적에게 피해 +${pct(d.behind)}(암습)`);if(d.steal)extra.push(`막타 골드 +${pct(d.steal)}`);
 if(d.cooldown)extra.push(`철수 후 ${d.cooldown}초, 쓰러지면 15초 만에 복귀`);if(d.basic&&d.element)extra.push(`기본 공격은 ✨빛 ${pct(d.basic)}`);
 const ranks=d.ranks.map((k,i)=>{const bits=[];if(k.skills)bits.push(...k.skills.map(skillDesc));if(k.ult)bits.push(skillDesc(k.ult));if(k.desc&&!k.choice)bits.push(k.desc);
  if(k.choice)bits.push('각인 선택: '+Object.values(k.choice).map(c=>`${c.label} ${c.desc}`).join(' / '));if(!bits.length)bits.push('능력치 상승');return `<li><span class="rk">★${i+1}</span> ${bits.join('<br>')}</li>`;}).join('');
 return `<div class="unit"><p class="uh"><b>${d.name}</b> ${d.job} · ${d.cost}💰 · HP ${d.hp} · 공격 ${d.magic?d.mag:d.atk}</p><p>${d.role}<br><small>${extra.join(' · ')}</small></p>${d.ult?`<p>⚡ 필살기 ${skillDesc(d.ult)}</p>`:''}<ul class="ranks">${ranks}</ul></div>`;}
function helpTips(){const sec=(title,body)=>`<details><summary>${title}</summary><div class="tip">${body}</div></details>`;
 const byModel={};for(const m of D.MONSTERS)(byModel[m.model]=byModel[m.model]||[]).push(m.name+(m.element?D.ELEMENT_ICON[m.element]:''));
 const MODEL_NAME={slime:'슬라임',goblin:'고블린',wolf:'늑대',knight:'기사',archer:'궁수',ghost:'유령',golem:'골렘',flameSpirit:'임프',spider:'거미',dragon:'비룡',treant:'덩굴·고목',sentinel:'파수꾼'};
 const MODEL_TIP={slime:'리아의 범위 마법으로 갈라진 것까지 한꺼번에',goblin:'무엇이든',wolf:'붙잡기와 둔화로 속도를 꺾으세요',knight:'마법이나 갑옷 가르기',archer:'수풀에 서거나 브란의 도발로 받아내기',ghost:'마법 또는 속성이 실린 물리 스킬',golem:'물리 화력과 갑옷 가르기',flameSpirit:'루나의 정화로 화상을 지우기',spider:'정화와 회복, 범위 공격',dragon:'세라·사냥꾼·마법 캐릭터',treant:'먼저 처치하거나 네로의 침묵',sentinel:'네로의 침묵으로 보호막 끄기'};
 return `<h3 class="tips-h">상세 팁</h3>
${sec('⚔ 속성 상성',`<table><tr><th>공격</th><th>강함 ×1.25</th><th>약함 ×0.75</th></tr><tr><td>🔥 불</td><td>🪽 바람</td><td>💧 물</td></tr><tr><td>🪽 바람</td><td>💧 물</td><td>🔥 불</td></tr><tr><td>💧 물·❄ 냉기</td><td>🔥 불</td><td>🪽 바람</td></tr><tr><td>✨ 빛</td><td>🌑 암흑</td><td>–</td></tr><tr><td>🌑 암흑</td><td>✨ 빛</td><td>–</td></tr></table>
<ul><li>⚡번개와 무속성 공격은 상성이 없습니다.</li><li>적의 속성은 「ⓘ 적 정보」와 몬스터 칩의 아이콘으로 미리 볼 수 있습니다. 숫자가 <b class="y">노란색</b>이면 상성이 맞은 것, <b class="g">회색</b>이면 덜 들어간 것입니다.</li><li>★3 각인에서 다음 전투의 적 속성에 맞춰 속성을 고르세요. 한 장 안에서도 적 구성이 바뀌니, 영웅마다 서로 다른 속성을 고르면 대응이 쉬워집니다.</li></ul>`)}
${sec('⚡ 필살기 · 명당 · 수정 조각',`<ul><li>필살기는 출전한 영웅마다 하나씩, ★1부터 있습니다. 충전 시간: 세라 32초 · 카일 38초 · 네로 40초 · 리아 45초 · 브란·루나 48초. ★5는 −15%.</li><li>충전은 <b>전투 중에만</b> 차오릅니다. 다음 전투로 그대로 이어지고, 장이 바뀌면 처음부터입니다. <b>철수하면 0</b>으로, 쓰러지면 절반이 날아갑니다.</li><li>쓸 때 영웅이 배운 속성 중 하나를 고릅니다: 🔥불 화상 · ❄얼음·💧물 빙결 · 🪽바람 둔화 · ⚡번개 기절 · 🌑어둠 독 · ✨빛 피해 +20%. 상성이 맞으면 ×1.25, 반대면 ×0.75 — 숫자 아래 「+상성」/「상성 불리」로 따로 표시됩니다. 브란(수호)과 루나(치유)는 속성 없이 씁니다.</li><li><b>연계</b>: 필살기를 쓴 뒤 3초 안에 다른 필살기를 쓰면 +15%, 세 번째는 +30%. 화면 위 금색 막대가 남은 시간입니다. 여러 영웅의 필살기를 모아 두었다가 이어 쓰는 것이 가장 강합니다.</li><li><b>명당</b>: 전투마다 원거리 발판 1칸과 근접 길 1칸이 금색으로 빛납니다. 그 자리의 캐릭터는 피해 +20%, 필살기 충전 ×1.5, 원거리는 사거리 +0.5, 근접은 붙잡기 +1. 전투가 끝나면 자리가 바뀌니 옮겨 설지 판단하세요(철수하면 충전이 0이 됩니다).</li><li><b>수정 조각</b>: 전투 중 약 40초마다 떨어집니다. 고르는 동안 시간이 느려집니다. 필살기가 가장 덜 찬 영웅에게 주는 것이 보통 이득입니다.</li><li>전투 중 위쪽 칩 「다음 전투」에서 다음 적의 속성과 보스를 미리 볼 수 있습니다.</li></ul>`)}
${sec('🛡 물리·마법과 면역',`<ul><li>피해 = 공격력 × 배율 − 상대 방어 × 0.5 (최소 공격력의 20%). 물리는 방어(DEF), 마법은 마법 방어(RES)로 줄어듭니다.</li><li><b>유령</b>은 물리 피해를 35%만 받습니다. 속성이 실린 물리 스킬은 60%까지 들어갑니다.</li><li><b>골렘</b>은 마법 피해를 35%만 받습니다(보스는 50%).</li><li>마법 캐릭터: 리아·루나·수습 마도사·수습 사제. 나머지는 물리입니다. 두 가지를 섞어 두어야 어떤 적이 와도 막힙니다.</li><li>치명타는 피해 ×1.5입니다. 네로(18%)와 세라(12%)가 가장 잘 터뜨립니다.</li><li>방어↓(갑옷 가르기)가 걸린 적은 물리 피해를 25% 더 받습니다.</li></ul>`)}
${sec('🗺 지형',`<table><tr><th>지형</th><th>효과</th></tr><tr><td>길</td><td>근접 캐릭터만 설 수 있고, 지나가는 적을 붙잡습니다</td></tr><tr><td>평지</td><td>근접 캐릭터만 설 수 있습니다. 공격만 하고 붙잡지는 못합니다</td></tr><tr><td>고지대 (올라온 발판)</td><td>원거리 캐릭터만 설 수 있는 자리 · 사거리 +0.5칸 · 세라는 피해 +15%</td></tr><tr><td>수풀</td><td>근접 캐릭터만 · 적의 원거리 공격을 30% 확률로 피하고, 적이 덜 노립니다</td></tr><tr><td>늪</td><td>지나는 적 이동 속도 −30%</td></tr><tr><td>모래</td><td>지나는 적 이동 속도 −18%</td></tr><tr><td>다리</td><td>강을 건너는 길목. 근접 캐릭터를 세우기 좋습니다</td></tr><tr><td>물·절벽·바위·구조물</td><td>배치할 수 없습니다</td></tr></table><ul><li>적 출현 문과 수정 바로 앞 칸은 비워 둬야 합니다.</li><li>지형 칸을 누르면 효과가 표시됩니다.</li></ul>`)}
${sec('⛓ 근접 캐릭터의 붙잡기',`<ul><li>길 위의 근접 캐릭터는 자기 칸을 지나는 적을 붙잡아 <b>속도를 3분의 2</b>로 늦춥니다(보스는 55%). 적은 막히지 않고 천천히 스쳐 지나갑니다.</li><li>한 번에 붙잡는 수: 브란 3 · 카일 2 · 방패병 2 · 네로 1 · 민병 1. 민병·방패병은 ★3에서 +1. 골렘과 보스는 두 자리를 차지합니다.</li><li>붙잡힌 적은 1.6초마다 그 캐릭터를 때립니다. 4초 동안 맞지 않으면 캐릭터 체력이 초당 2.5%씩 회복됩니다.</li><li><b>비행</b>(비룡·매)과 <b>유령</b>은 붙잡을 수 없습니다.</li><li>길 위의 근접 캐릭터끼리는 <b>3칸 이상</b> 떨어져야 합니다. 근접 캐릭터를 고르면 기존 근접 캐릭터 둘레의 배치 금지 범위가 붉게 표시됩니다. 한곳에 몰아 세우지 말고 길 여러 곳에 나눠 세우세요.</li><li>적 출현 문에서 <b>3칸 안</b>의 길에는 근접 캐릭터를 세울 수 없습니다(나오자마자 붙잡는 배치 방지). 근접 캐릭터를 고르면 문 둘레도 붉게 표시됩니다.</li><li>붙잡힌 적 위에는 ⛓ 표시가 뜹니다. 근접 캐릭터를 여러 칸에 나눠 세우면 늦춰지는 구간이 길어집니다.</li></ul>`)}
${sec('👑 영웅 6명',D.HERO_ORDER.map(unitTips).join('')+`<p><small>합류한 영웅은 모두 함께 출전할 수 있습니다(같은 영웅은 한 명씩). 철수하면 20초, 쓰러지면 30초 뒤 다시 배치할 수 있고, 쓰러진 영웅은 랭크와 각인을 그대로 가지고 공짜로 돌아옵니다.</small></p>`)}
${sec('🪖 연합군 병사 5종',D.SOLDIER_ORDER.map(unitTips).join('')+`<p><small>병사는 장마다 정해진 <b>병사 자리</b>만큼만 배치할 수 있습니다(프롤로그·1장 3칸, 2·3장 2칸, 4장부터 1칸 · 유산 「지휘관의 위엄」마다 +1). 화면 위 🪖 숫자가 남은 자리입니다. ★3까지 오릅니다. 쓰러지면 사라지니 다시 고용해야 합니다.</small></p>`)}
${sec('📈 랭크업과 철수',`<table><tr><th>랭크</th><th>비용(배치가 대비)</th></tr><tr><td>★2</td><td>×0.8</td></tr><tr><td>★3</td><td>×1.2 · 각인 선택</td></tr><tr><td>★4</td><td>×1.8</td></tr><tr><td>★5</td><td>×2.5 · 필살기 강화</td></tr></table><ul><li>랭크마다 HP·공격·마법 +25%, 방어·마법 방어 +15%.</li><li>★2는 가장 싸고 효과가 큽니다. 초반에는 새로 배치하기보다 핵심 캐릭터의 ★2를 먼저 올려 보세요.</li><li>★4의 오라(용기의 맹세·수호의 진·빛의 축복)는 주변 2칸 아군 모두에게 걸립니다. 화력 캐릭터를 오라 범위 안에 모으세요.</li><li>영웅 6명은 배치하자마자 <b>필살기</b>를 가지고 있습니다. 배치 후 재사용 시간의 절반이 지나면 처음 쓸 수 있고, 영웅마다 약 18~24초에 한 번 다시 찹니다.</li><li>준비되면 하단 초상화가 주황색으로 빛나며 「⚡ 필살기」로 바뀌고, 전장의 영웅 머리 위에도 ⚡가 뜹니다. 그 초상화를 누르면 바로 발동합니다(메테오는 떨어뜨릴 곳을 누름).</li><li>★5는 필살기 강화(위력 +30%, 재사용 −15%)입니다.</li><li>철수하면 쓴 골드의 70%를 돌려받습니다. 길 모양이 바뀌는 장에서는 자리를 옮기는 데 쓰세요.</li></ul>`)}
${sec('💫 상태이상',`<table><tr><th>상태</th><th>적에게</th></tr><tr><td>🔥 화상</td><td>4초간 초당 최대 체력 2% (보스 0.5%)</td></tr><tr><td>☠ 독</td><td>6초간 초당 최대 체력 1.2%, 3번까지 겹침</td></tr><tr><td>❄ 빙결</td><td>1.5초 멈춘 뒤 3초 둔화 (보스는 둔화만)</td></tr><tr><td>⚡ 기절</td><td>1.2초 멈춤 (보스 0.5초)</td></tr><tr><td>💤 수면</td><td>4초 멈춤, 맞으면 깨지만 그 공격은 피해 2배 (보스는 둔화)</td></tr><tr><td>🐌 둔화</td><td>3초간 이동 속도 −35%</td></tr><tr><td>🔇 침묵</td><td>6초간 특수 능력 봉인 — 재생·보호막·원거리 마법·보스 회복 (보스 2.5초)</td></tr><tr><td>🛡↓ 방어↓</td><td>6초간 받는 물리 피해 +25%</td></tr><tr><td>⛓ 속박</td><td>도발에 걸려 1.8초 멈춤</td></tr></table><ul><li>아군도 화상·독·빙결·기절·침묵에 걸립니다. 빙결·기절이면 행동하지 못하고, 침묵이면 스킬을 못 씁니다. 루나의 <b>정화</b>와 브란의 <b>철벽의 성채</b>로 지울 수 있습니다.</li><li>상태 아이콘은 체력 막대 위의 작은 점 색으로 표시됩니다.</li></ul>`)}
${sec('✨ 콤보',`<table><tr><th>콤보</th><th>조건</th><th>효과</th></tr><tr><td>파쇄</td><td>빙결·둔화된 적에게 물리 스킬</td><td>피해 +30%</td></tr><tr><td>확산</td><td>화상 중인 적에게 🪽바람 스킬</td><td>1.3칸 안의 다른 적에게 화상이 옮겨 붙음</td></tr><tr><td>기습</td><td>잠든 적을 공격</td><td>피해 2배</td></tr><tr><td>암습</td><td>네로가 자신을 지나친 적을 공격</td><td>피해 +25%</td></tr></table><ul><li>예) 리아 프로스트(빙결) → 카일 얼음 베기·세라 관통 사격으로 파쇄.</li><li>예) 카일 화염검·리아 파이어로 불을 붙이고 → 리아 회오리 폭풍·카일 폭풍 베기로 확산.</li><li>예) 네로 수면 단검 → 세라 매의 심판으로 기습. 아군은 잠든 적을 마지막에 노립니다.</li></ul>`)}
${sec('👾 몬스터 유형',`<table><tr><th>유형</th><th>특징 · 대응</th></tr>`+Object.keys(byModel).map(k=>`<tr><td>${MODEL_NAME[k]||k}</td><td>${(D.MODEL_TRAITS[k]||{}).note||''} · <i>${MODEL_TIP[k]||''}</i><br><small>${byModel[k].join(', ')}</small></td></tr>`).join('')+`</table><ul><li><b>정예</b>(이름 앞 「정예」, 크기가 큼): 체력 ×4, 공격 ×1.4, 수정에 닿으면 생명 −2. 노란 체력 막대로 표시됩니다.</li><li>슬라임이 갈라진 「꼬마」는 빠르지만 약합니다.</li><li>몬스터를 누르면 체력·속성·특징이 표시됩니다.</li></ul>`)}
${sec('🐉 장별 보스',D.CHAPTERS.map(c=>{const b=c.boss;return `<p><b>${c.label} · ${b.name}</b>${b.element?' '+D.ELEMENT_ICON[b.element]:''}${b.immunity==='magic'?' · 마법↓':b.immunity==='physical'?' · 물리↓':''}${b.fly?' · 비행':''}<br><small>${b.hint}${b.wave?` 주기적으로 「${b.wave.name}」: 주변 ${b.wave.radius}칸 동료를 공격하고 ${ST_NAME[b.wave.status]} 상태로 만듭니다.`:''}${b.summon?' 부하를 불러냅니다.':''}</small></p>`;}).join('')+`<p><small>보스가 수정에 닿으면 생명과 관계없이 바로 패배합니다. 필살기는 보스가 나올 때까지 아껴 두세요.</small></p>`)}
${sec('💰 골드와 진행',`<ul><li>처치 골드는 몬스터 체력에 비례합니다. 정예는 4배, 보스는 큰 보너스를 줍니다.</li><li>전투 승리 보너스: 30 + 전투 번호 × 8. 한 마리도 놓치지 않으면 1.5배.</li><li><b>조기 출발</b>: 준비 시간이 남았을 때 「전투 시작」을 누르면 남은 초만큼 골드를 받습니다.</li><li>네로가 마무리하면 골드 +30%. 네로를 적이 많이 지나가는 길목 뒤쪽에 세우세요.</li><li>몇 전투마다 <b>에테르 축복</b> 3개 중 하나를 고릅니다. <b>이번 장에서만</b> 효력이 있고 장이 끝나면 사라집니다: ${D.BLESSINGS.map(b=>`${b.name}(${b.desc})`).join(', ')}.</li><li>장을 클리어하면 <b>아르카의 유산</b> 3개 중 하나를 고릅니다. 유산은 <b>영구 효과</b>로 다음 장부터 계속 쌓입니다(아래 「아르카의 유산」 참고).</li><li>별 평가: 클리어 ★ · 생명 75% 이상 ★★ · 한 마리도 놓치지 않으면 ★★★.</li></ul>`)}
${sec('♾ 아르카의 유산 (영구 효과)',`<ul><li>장을 클리어할 때마다 3개 중 하나를 고르고, 그 효과는 <b>이후 모든 장에 계속 적용</b>됩니다. 에테르 축복(이번 장에서만)과 다릅니다.</li><li>장마다 유산 칸이 하나 있어 최대 10개까지 모입니다. 같은 장을 다시 클리어하면 그 장의 유산을 다른 것으로 바꿀 수 있습니다.</li><li>같은 유산을 여러 장에서 고르면 효과가 겹칩니다(유산마다 최대 횟수가 있습니다).</li><li>타이틀의 「아르카의 유산」에서 모은 유산을 볼 수 있습니다.</li></ul><table><tr><th>유산</th><th>효과 · 최대</th></tr>`+D.LEGACIES.map(l=>`<tr><td>${l.icon} ${l.name}</td><td>${l.desc} · 최대 ${l.max}번${l.hero?` <small>(${D.UNITS[l.hero].name} 합류 후)</small>`:''}</td></tr>`).join('')+`</table><p><small>장 난이도는 앞 장들에서 유산을 모아 온 것을 기준으로 맞춰져 있습니다.</small></p>`)}
${sec('🎯 배치 공략',`<ul><li><b>굽이 안쪽이 명당</b>: 길이 꺾이는 안쪽 칸은 길 두세 구간을 동시에 사거리에 넣습니다. 리아·세라를 세우세요.</li><li><b>늦추고 → 모으고 → 터뜨린다</b>: 브란이 붙잡아 적이 뭉치면 리아의 범위 마법이 여러 마리를 한꺼번에 맞힙니다.</li><li><b>늪·모래 끝에 근접 캐릭터</b>: 느려진 구간과 붙잡기가 겹치면 적이 머무는 시간이 크게 늘어납니다.</li><li><b>네로는 벽 뒤에</b>: 브란을 지나친 적은 네로에게 등을 보여 암습 피해를 받고, 흘린 적도 마무리합니다.</li><li><b>세라는 길에서 조금 떨어진 발판</b>: 바로 옆 칸을 쏘지 못하니 한 칸 띄우고, 고지대에서 사거리와 피해를 모두 챙기세요.</li><li><b>루나는 전선과 화력 사이</b>: 회복 사거리에 근접 캐릭터, 오라 범위에 화력 캐릭터가 함께 들어오는 칸이 좋습니다.</li><li><b>입구가 두 개인 장</b>(4장·8장): 두 길이 합쳐지는 곳에 화력을 모으면 한 번에 막을 수 있습니다.</li><li>배치나 캐릭터 메뉴를 여는 동안에는 시간이 1/4로 느려집니다. 급할 때는 일시정지(⏸)를 쓰세요.</li></ul>`)}`;}
function settingsModal(back){const vols=[0,.25,.5,.75,1],m=modal(`<h2>소리 설정</h2><p>배경 음악</p><div class="seg">${vols.map(v=>`<button data-v="${v}" class="${settings.bgm===v?'primary':''}">${v?Math.round(v*100):'끔'}</button>`).join('')}</div><p>효과음</p><div class="seg">${vols.map(v=>`<button data-e="${v}" class="${settings.sfxVol===v?'primary':''}">${v?Math.round(v*100):'끔'}</button>`).join('')}</div><button class="primary" data-a="back">확인</button>`);
 m.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{settings.bgm=+b.dataset.v;saveJSON(SET_KEY,settings);bgm.volume();settingsModal(back);});m.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{settings.sfxVol=+b.dataset.e;saveJSON(SET_KEY,settings);sfx('ui_confirm');settingsModal(back);});m.querySelector('[data-a=back]').onclick=back;}
// Save slots: each keeps the state at the start of a battle, like the automatic save.
const slots=()=>{const a=loadJSON(SLOT_KEY,[]);return Array.from({length:SLOTS},(_,i)=>a[i]||null);};
const slotLabel=s=>{const c=D.CHAPTERS[s.snap.chapter];return `${c.label} · 전투 ${s.snap.battle+1}/${c.battles.length}<small>${new Date(s.time).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} · 생명 ${s.snap.life} · 골드 ${s.snap.gold} · 동료 ${s.snap.units.length}명</small>`;};
function slotModal(mode,back){const list=slots(),auto=mode==='load'?loadSave():null;
 const m=modal(`<h2>${mode==='save'?'저장하기':'불러오기'}</h2>${mode==='save'?`<p>전투 ${lastSnap.battle+1}을 시작하는 시점의 상태가 저장됩니다.</p>`:''}${auto?`<button data-auto>자동 저장 · ${slotLabel({snap:auto,time:auto.time||Date.now()})}</button>`:''}`+list.map((s,i)=>`<button data-i="${i}" ${mode==='load'&&!s?'disabled':''}>슬롯 ${i+1} · ${s?slotLabel(s):'비어 있음'}</button>`).join('')+`<button class="primary" data-a="back">돌아가기</button>`);
 m.querySelector('[data-a=back]').onclick=back;const a=m.querySelector('[data-auto]');if(a)a.onclick=()=>{closeModal();startChapter(auto.chapter,auto);};
 m.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;if(mode==='save'){const go=()=>{const all=slots();all[i]={snap:lastSnap,time:Date.now()};saveJSON(SLOT_KEY,all);sfx('ui_confirm');slotModal('save',back);toast(`슬롯 ${i+1}에 저장했습니다`);};
   if(list[i]){const c=modal(`<h2>슬롯 ${i+1} 덮어쓰기</h2><p>이미 저장된 내용이 있습니다. 덮어쓸까요?</p><button class="primary" data-a="y">덮어쓰기</button><button data-a="n">취소</button>`);c.querySelector('[data-a=y]').onclick=go;c.querySelector('[data-a=n]').onclick=()=>slotModal('save',back);}else go();}
  else if(list[i]){closeModal();startChapter(list[i].snap.chapter,list[i].snap);}});}
function gameMenu(){const m=modal(`<p class="sub">${S.chapter.label} · 전투 ${S.battle+1}</p><h2>메뉴</h2><button class="primary" data-a="resume">계속하기</button><button data-a="save">저장하기</button><button data-a="load">불러오기</button><button data-a="sound">소리 설정</button><button data-a="legacy">아르카의 유산 보기</button><button data-a="help">게임 방법</button>${devMode?'<button data-a="skip">[개발자] 이 전투 즉시 승리</button><button data-a="gold">[개발자] 골드 +500</button>':''}<button data-a="map">지도로<small>자동 저장된 전투부터 이어할 수 있습니다</small></button><button data-a="title">타이틀로</button>`);
 const on=(a,f)=>{const b=m.querySelector(`[data-a=${a}]`);if(b)b.onclick=f;};on('resume',closeModal);on('legacy',()=>legacyView(gameMenu));on('save',()=>slotModal('save',gameMenu));on('load',()=>slotModal('load',gameMenu));on('sound',()=>settingsModal(gameMenu));
 on('help',()=>{const h=modal(HELP+helpTips()+`<button class="primary">닫기</button>`,'help');h.querySelector('button').onclick=gameMenu;});on('title',()=>{closeModal();showTitle();});on('map',toWorld);
 on('gold',()=>{S.gold+=500;hudKey='';closeModal();});on('skip',()=>{closeModal();if(S.phase==='prep')S.startBattle();S.queue.length=0;for(const e of S.enemies){e.canSplit=false;e.hp=0;e.st.burn=1;}});}
function chapterList(dev){const best=cleared(),m=modal(`<h2>${dev?'개발자 모드 · 장 바로 시작':'장 선택'}</h2>${dev?'<p>테스트용 메뉴입니다. 어느 장이든 바로 시작합니다.</p>':''}`+D.CHAPTERS.map((c,i)=>{const open=dev||i===0||best[D.CHAPTERS[i-1].id];return `<button data-i="${i}" ${open?'':'disabled'}>${c.label} · ${c.name}${best[c.id]?' '+'★'.repeat(best[c.id]):''}<small>${open?`${c.place} · 전투 ${c.battles.length}회 · 보스 ${c.boss.name}`:'이전 장을 클리어하면 열립니다'}</small></button>`;}).join('')+`<button class="primary" data-a="back">돌아가기</button>`);
 m.querySelector('[data-a=back]').onclick=showTitle;m.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{closeModal();devMode=dev;startChapter(+b.dataset.i,null);});}
// ── World map: chapter select drawn as a journey (WORLD_MAP in data.js) ──
const worldEl=$('#world');
// World map / altar: hide the stops and sockets until the painting has loaded.
function paintFirst(root){const im=root.querySelector('.wart');if(!im||(im.complete&&im.naturalWidth))return;root.classList.add('wloading');loading.begin('paint');const done=()=>{root.classList.remove('wloading');loading.end('paint');};im.addEventListener('load',()=>{(im.decode?im.decode():Promise.resolve()).catch(()=>{}).then(done);},{once:true});im.addEventListener('error',done,{once:true});}
function closeWorld(){worldEl.hidden=true;worldEl.innerHTML='';window.removeEventListener('resize',fitWorld);}
function fitWorld(){for(const wrap of document.querySelectorAll('.wmapwrap')){const map=wrap.querySelector('.wmap');if(!map)continue;const W=wrap.clientWidth,H=wrap.clientHeight,w=Math.min(W,H*9/16);map.style.width=w+'px';map.style.height=w*16/9+'px';}}
function altarView(back){closeModal();modalOpen=true;const A=D.ALTAR,picks=legacyPicks(),counts=D.legacyCounts(picks),n=Object.values(picks).filter(Boolean).length,short=c=>c.id==='prologue'?'프롤로그':c.id==='final'?'FINAL':(+c.id.slice(1))+'장';
 const totals=Object.keys(counts).map(id=>{const l=legacyInfo(id);return l?`<li>${l.icon} ${D.legacyTotal(id,counts[id])}${counts[id]>1?` <small>(${l.name} ×${counts[id]})</small>`:''}</li>`:'';}).join('');
 altarEl.innerHTML=`<header class="whead"><button data-a="back" aria-label="뒤로">←</button><b>아르카의 유산</b><span class="wstars">♾ ${n}/${D.CHAPTERS.length}</span></header>
  <div class="wmapwrap"><img class="wblur" alt="" src="${A.file}?v=${GAME_VERSION}"><div class="wmap"><img class="wart" alt="" src="${A.file}?v=${GAME_VERSION}">
   ${D.CHAPTERS.map((c,i)=>{const [x,y]=A.sockets[i],l=picks[i]&&legacyInfo(picks[i]);return `<div class="asock${l?' got':''}" style="left:${x}%;top:${y}%;width:${A.size}%" title="${l?l.name+' — '+l.desc:''}">${l?`<b>${l.icon}</b>`:''}<span>${l?l.name:short(c)}</span></div>`;}).join('')}
   <div class="afloor"><p class="scope keep">♾ 영구 효과 · 장을 클리어할 때마다 하나씩, 모든 장에 적용</p><h3 class="sec">지금 적용 중인 효과</h3>${totals?`<ul class="totals">${totals}</ul>`:'<p class="small">아직 없습니다. 장을 클리어하면 제단에 하나씩 채워집니다.</p>'}
    <p class="small">클리어한 장을 다시 깨면 그 장의 유산을 바꿀 수 있습니다.</p><button class="dev" data-a="reset">유산 모두 초기화</button></div>
  </div></div>`;
 altarEl.hidden=false;paintFirst(altarEl);fitWorld();window.addEventListener('resize',fitWorld);
 altarEl.querySelector('[data-a=back]').onclick=()=>{sfx('ui_tap');closeAltar();back();};
 altarEl.querySelector('[data-a=reset]').onclick=()=>{const c=modal(`<h2>유산 초기화</h2><p>모아 둔 아르카의 유산을 모두 지웁니다. 되돌릴 수 없습니다.</p><button class="primary" data-a="n">취소</button><button class="dev" data-a="y">모두 지우기</button>`);c.querySelector('[data-a=n]').onclick=closeModal;c.querySelector('[data-a=y]').onclick=()=>{saveJSON(LEGACY_KEY,{picks:{}});closeModal();altarView(back);};};}
// ── Title attract mode: a real battle plays by itself behind the title (same camera, painted map and models as the game).
// No sounds, toasts, saves or result screens; when it ends it starts again on another map.
const DEMO_SKIP=new Set(['shard','shardGiven','leak','down','withdraw','ult','bonus','battleStart','cleared','prep','bless','won','lost','deploy','rank','bossWave','bossPhase']);
const demo=(()=>{let on=false,think=0,ultT=0,round=0,gen=0,busy=false;
 function pickTile(def){const d=D.UNITS[def],map=S.map,roads=map.tiles.filter(t=>t.road);let best=null;
  for(const t of map.tiles){if(S.canDeploy(def,t.c,t.r))continue;let score=Math.random()*.5;
   if(d.melee){if(!t.road)continue;const at=Object.values(t.pd)[0],total=map.paths[Object.keys(t.pd)[0]].total;score-=Math.abs(at/total-.45)*4;for(const u of S.units)if(D.UNITS[u.def].melee&&Math.hypot(u.x-t.c,u.y-t.r)<2.5)score-=3;}
   else{const range=d.range+(t.terrain==='high'?.5:0);for(const q of roads)if(Math.hypot(q.c-t.c,q.r-t.r)<=range+.35)score+=1;}
   if(!best||score>best.score)best={t,score};}return best&&best.t;}
 function setup(){const best=cleared(),open=D.CHAPTERS.map((c,i)=>i===0||!!best[D.CHAPTERS[i-1].id]),choices=D.CHAPTERS.map((c,i)=>i).filter(i=>open[i]&&D.MAP_ART[D.CHAPTERS[i].map]),
   index=choices[(round++ +Math.floor(Math.random()*choices.length))%choices.length]||0,a=D.MAP_ART[D.CHAPTERS[index].map];
  // the next map's painting is fully loaded before the battle switches to it (the first time under the loading message)
  const go=++gen;busy=true;loading.wait('demo',a?loadImg(a.file+'?v='+GAME_VERSION):null,60000).then(()=>{busy=false;if(!on||go!==gen)return;build(index);});}
 function build(index){
  clearObjects();S=createSim({chapter:index,seed:Math.floor(Math.random()*1e6),legacy:D.typicalLegacy(index)});S.gold=1e6;S.life=S.maxLife=999;
  resize();buildTerrain();
  const heroes=D.HERO_ORDER.filter(id=>S.chapter.roster.includes(id)),soldiers=D.SOLDIER_ORDER.filter(id=>S.chapter.roster.includes(id));
  for(const id of [...heroes,...soldiers.slice(0,S.soldierCap)]){const t=pickTile(id);if(t)S.deploy(id,t.c,t.r);}
  for(const u of S.units){let k=0;while(k++<4&&u.rank<Math.min(D.UNITS[u.def].maxRank,3)){const ch=S.needsChoice(u)?Object.keys(D.UNITS[u.def].ranks[u.rank].choice)[0]:undefined;if(S.rankUp(u.id,ch))break;}}
  S.battle=Math.floor(Math.random()*Math.max(1,S.chapter.battles.length-1));S.startBattle();for(const u of S.units)if(u.ult)u.ultCd=Math.random()*6;S.drain();}
 return {get on(){return on;},start(){on=true;round=Math.floor(Math.random()*10);if(!S)app.classList.add('artwait');setup();},stop(){if(!on)return;on=false;gen++;busy=false;loading.end('demo');clearObjects();S=null;},
  // called every frame while the title is up: keep the battle going, cast 필살기 now and then, restart when it ends
  tick(dt){if(!on||!S||busy)return;if(S.phase==='bless')S.chooseBlessing(S.offer[0]);if(S.shard)S.giveShard(null);if(S.phase==='prep')S.startBattle();
   if(S.phase==='won'||S.phase==='lost'||(S.phase==='battle'&&!S.enemies.length&&!S.queue.length&&(think+=dt)>2)){think=0;setup();return;}
   if((ultT-=dt)<=0){ultT=2.5+Math.random()*2.5;const ready=S.units.filter(u=>u.ult&&u.ultCd<=0&&D.SKILLS[u.ult].type!=='heal'&&D.SKILLS[u.ult].type!=='fortress');
    const u=ready[Math.floor(Math.random()*ready.length)];if(u&&S.enemies.length>=2){const e=S.enemies.slice().sort((a,b)=>b.dist-a.dist)[0];S.ult(u.id,e.x,e.y);}}}};})();
function toWorld(){closeModal();showTitle();showWorld();}
function showWorld(){closeModal();const W=D.WORLD_MAP,best=cleared(),picks=legacyPicks(),stars=Object.values(best).reduce((a,b)=>a+b,0),nLeg=Object.values(picks).filter(Boolean).length;
 const open=i=>i===0||!!best[D.CHAPTERS[i-1].id];let cur=D.CHAPTERS.findIndex((c,i)=>open(i)&&!best[c.id]);if(cur<0)cur=D.CHAPTERS.length-1;
 const pts=W.stops.map(([x,y])=>`${x},${y*16/9}`),seg=(a,b)=>`<line x1="${W.stops[a][0]}" y1="${W.stops[a][1]*16/9}" x2="${W.stops[b][0]}" y2="${W.stops[b][1]*16/9}"/>`;
 const done=W.stops.slice(1).map((_,i)=>best[D.CHAPTERS[i].id]?seg(i,i+1):'').join('');
 const bg=W.file?`<img class="wart" alt="" src="${W.file}?v=${GAME_VERSION}">`:`<div class="wph" style="background:linear-gradient(to top,${W.tint.map((c,i)=>`${c} ${4+i*10}%`).join(',')})"></div>`;
 const short=c=>c.id==='prologue'?'P':c.id==='final'?'F':String(+c.id.slice(1));
 worldEl.innerHTML=`<header class="whead"><button data-a="back" aria-label="뒤로">←</button><b>장 선택</b><span class="wstars">★ ${stars}/${D.CHAPTERS.length*3}</span><button data-a="legacy" class="wleg">♾ 유산 ${nLeg}/${D.CHAPTERS.length}</button></header>
  <div class="wmapwrap">${W.file?`<img class="wblur" alt="" src="${W.file}?v=${GAME_VERSION}">`:''}<div class="wmap">${bg}
   <svg class="wpath" viewBox="0 0 100 177.78" preserveAspectRatio="none">${W.file?'':`<polyline class="all" points="${pts.join(' ')}"/>`}<g class="done">${W.file?'':done}</g></svg>
   ${D.CHAPTERS.map((c,i)=>{const [x,y]=W.stops[i],st=best[c.id]||0,ok=open(i),l=picks[i]&&legacyInfo(picks[i]);
    return `<button class="wstop${ok?'':' locked'}${st?' clear':''}${i===cur?' cur':''}${W.file?' painted':''}" data-i="${i}" style="left:${x}%;top:${y}%;--ink:${(W.ink||[])[i]||'#fff3c4'}">${i===cur?`<img class="wme" alt="" src="${portraits.kyle}">`:''}
     <span class="wnum">${ok?short(c):W.file?'':'🔒'}</span>${l?`<span class="wbadge" title="${l.name}">${l.icon}</span>`:''}<span class="wst">${ok&&st?(W.file?'★'.repeat(st)+`<i>${'★'.repeat(3-st)}</i>`:'★'.repeat(st)+'☆'.repeat(3-st)):''}</span><span class="wname">${c.name}</span></button>`;}).join('')}
  </div></div>`;
 worldEl.hidden=false;paintFirst(worldEl);fitWorld();window.addEventListener('resize',fitWorld);
 worldEl.querySelector('[data-a=back]').onclick=()=>{sfx('ui_tap');closeWorld();showTitle();};
 worldEl.querySelector('[data-a=legacy]').onclick=()=>{sfx('ui_tap');legacyView(()=>{});};
 worldEl.querySelectorAll('.wstop').forEach(b=>b.onclick=()=>{sfx('ui_tap');chapterInfo(+b.dataset.i,open(+b.dataset.i));});}
function chapterInfo(i,ok){const c=D.CHAPTERS[i],st=cleared()[c.id]||0,rec=loadJSON(RECORD_KEY,{})[c.id],l=legacyPicks()[i]&&legacyInfo(legacyPicks()[i]);
 const m=modal(`<p class="sub">${c.label}</p><h2>${c.name}</h2><p class="stars">${'★'.repeat(st)}${'☆'.repeat(3-st)}</p><p>${c.place} · 전투 ${c.battles.length}회 · 보스 ${c.boss.name}</p>
  ${rec?`<p class="small">최고 기록 · 남은 생명 ${rec.life} · ${fmtTime(rec.time)} · 처치 ${rec.kills}</p>`:''}
  ${l?`<p class="scope keep">♾ 이 장의 유산: ${l.icon} ${l.name} — ${l.desc}<br><small>다시 클리어하면 바꿀 수 있습니다</small></p>`:''}
  ${ok&&loadSave()&&loadSave().chapter===i?`<button class="primary" data-a="resume">▶ 전투 계속하기<small>전투 ${loadSave().battle+1}/${c.battles.length}부터</small></button>`:''}${ok?`<button class="${loadSave()&&loadSave().chapter===i?'':'primary'}" data-a="go">${loadSave()&&loadSave().chapter===i?'처음부터 다시':st?'다시 도전':'출발'}<small>병사 자리 ${c.soldiers+(legacyNow().command||0)}칸 · 시작 골드 ${c.startGold+60*(legacyNow().startGold||0)}</small></button>`:'<p class="small">🔒 이전 장을 클리어하면 열립니다</p>'}<button data-a="close">닫기</button>`);
 const rs=m.querySelector('[data-a=resume]');if(rs)rs.onclick=()=>{const sv=loadSave();closeModal();closeWorld();devMode=false;startChapter(i,sv);};if(ok)m.querySelector('[data-a=go]').onclick=()=>{closeModal();closeWorld();devMode=false;startChapter(i,null);};m.querySelector('[data-a=close]').onclick=closeModal;}
function showTitle(){closeWorld();closeAltar();demo.stop();S=null;clearObjects();closePanel();disposeGroup(terrainGroup);water=null;animated=[];art=null;artImg.removeAttribute('src');artBlur.removeAttribute('src');delete artImg.dataset.file;app.classList.add('title');bgm.play(1);demo.start();const save=loadSave(),any=save||slots().some(Boolean);
 const best=cleared(),stars=Object.values(best).reduce((a,b)=>a+b,0),next=D.CHAPTERS.find((c,i)=>(i===0||best[D.CHAPTERS[i-1].id])&&!best[c.id]),
  ICON={load:'<path d="M3 7h6l2 2h10v10H3z"/>',sound:'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',help:'<path d="M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4z"/><path d="M20 5h-4a2 2 0 0 0-2 2"/><path d="M20 5v13h-6"/>'},
  icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
 const m=modal(`<div class="logo"><p class="sub">ARCA CHRONICLE</p><h1>cnation <em>TD</em></h1><p class="tag">아르카 방어전</p></div>
  <div class="tmenu">${(()=>{const fresh=!save&&!stars&&!Object.keys(legacyPicks()).length,map=`🗺 모험 지도<small>${next?`다음 · ${next.label} ${next.name}`:'모든 장 클리어'}${stars?` · ★ ${stars}/${D.CHAPTERS.length*3}`:''}</small>`;
     return save?`<button class="tbtn main" data-a="continue">▶ 전투 계속하기<small>${D.CHAPTERS[save.chapter].label} ${D.CHAPTERS[save.chapter].name} · 전투 ${save.battle+1}/${D.CHAPTERS[save.chapter].battles.length}부터</small></button><button class="tbtn alt" data-a="start">${map}</button>`
      :fresh?`<button class="tbtn main" data-a="first">⚔ 모험 시작<small>PROLOGUE · ${D.CHAPTERS[0].name}</small></button>`:`<button class="tbtn main" data-a="start">${map}</button>`;})()}
   <div class="trow"><button data-a="load" ${any?'':'disabled'}>${icon('load')}<span>저장 슬롯</span></button><button data-a="sound">${icon('sound')}<span>소리</span></button><button data-a="help">${icon('help')}<span>게임 방법</span></button></div>
   <div class="tfoot"><button class="dev" data-a="dev">개발자 모드</button><span class="verbar">ver.${GAME_VERSION} (<a href="revisions.html">rev. history</a>)</span></div></div>`,'title');const rv=m.querySelector('.verbar a');if(rv)rv.onclick=e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();sfx('ui_tap');showRevisions();};
 const on=(a,f)=>{const b=m.querySelector(`[data-a=${a}]`);if(b)b.onclick=()=>{sfx('ui_tap');f();};};
 on('start',showWorld);on('first',()=>{closeModal();devMode=false;startChapter(0,null);});on('continue',()=>{closeModal();startChapter(save.chapter,save);});on('dev',()=>chapterList(true));
 on('load',()=>slotModal('load',showTitle));on('sound',()=>settingsModal(showTitle));on('help',()=>{const h=modal(HELP+helpTips()+`<button class="primary">닫기</button>`,'help');h.querySelector('button').onclick=showTitle;});}

// ── Saves ──
function saveGame(){lastSnap=S.snapshot();lastSnap.time=Date.now();saveJSON(SAVE_KEY,lastSnap);}
function loadSave(){const s=loadJSON(SAVE_KEY,null);return s&&s.v===2&&D.CHAPTERS[s.chapter]?s:null;}
function startChapter(index,snapshot){demo.stop();clearObjects();closePanel();app.classList.remove('title');selCard=null;validTiles=null;const legacy=devMode?D.typicalLegacy(index):legacyNow();S=createSim({chapter:index,snapshot,seed:(Date.now()&0xffff)+index*101,legacy});ultSeen=new Set();speed=1;paused=false;hudKey='';
 resize();buildTerrain();buildDock();showPreview();saveGame();if(bgm.unlocked)loading.wait('music',bgm.load(battleTrack()),8000);bgm.play(battleTrack());
 onArt(()=>{if(!snapshot){banner(S.chapter.label,S.chapter.name);setTimeout(()=>toast('동료를 배치하고 「전투 시작」을 누르세요'),1200);}else toast(`${S.chapter.label} · 전투 ${S.battle+1} 준비`);});
 if(devMode){const n=Object.values(legacy).reduce((a,b)=>a+b,0);setTimeout(()=>toast(`개발자 모드 · 평균 유산 ${n}개 적용`),2200);}}

// ── Effects (2D overlay) ──
function addFx(o){if(o.delay&&(o.k==='label'||o.k==='num')){const d=o.delay;delete o.delay;setTimeout(()=>{if(S)addFx(o);},d*1000);return;}if(fx.length>160)fx.shift();if(o.delay&&!o.life)o.life=o.dur+o.delay;o.t=0;if(o.k==='ultblast')o.life=o.dur+(o.delay||0);fx.push(o);}
// A small visual knock-back for monsters hit in melee (the rules are untouched).
function shove(id,power){const o=objs.get('e'+id);if(o)o.push=Math.min(1.8,Math.max(o.push||0,power));}
// Several monsters falling in the same frame (an area spell): each kind of death sound plays once, louder the more fell,
// up to three kinds staggered by 45 ms, with a single coin sound. Saves dozens of overlapping copies.
let deaths=[];
function playDeaths(){if(!deaths.length)return;const count={};for(const k of deaths)count[k]=(count[k]||0)+1;
 Object.keys(count).sort((a,b)=>(b==='die_boss')-(a==='die_boss')||count[b]-count[a]).slice(0,3).forEach((k,i)=>sfx(k,{force:true,delay:i*.045,gain:Math.min(1.5,1+.15*(count[k]-1))}));
 sfx('coin',{force:true,gain:Math.min(1.4,1+.1*(deaths.length-1))});deaths=[];}
function handleEvents(){deaths=[];for(const e of S.drain()){if(demo.on&&DEMO_SKIP.has(e.t))continue;
 if(e.t==='attack'){const o=objs.get('u'+e.unit);if(o)o.lunge=1;if(e.melee){shove(e.target,1);meleeSwing(e,o);}else addFx({k:'shot',from:e.from,to:e.to,dur:.17,color:e.magic?'#e2c4ff':'#fff1c4',glow:e.magic?'#a66bff':'#ffb347',magic:e.magic});sfx(e.melee?'hit_melee':!e.magic?'hit_arrow':D.UNITS[S.units.find(v=>v.id===e.unit)?.def]?.element==='light'?'hit_holy':'hit_magic');}
 else if(e.t==='skill'&&D.SKILLS[e.skill]?.ult){const s=D.SKILLS[e.skill],color=EL_COLOR[e.element]||'#fff3b0',area=e.area||s.area||.8,heal=s.type==='heal',delay=e.fx==='meteor'?.5:e.fx==='bolt'?.12:0;ultImpact=delay;
  if(!heal){const R=e.fx==='bolt'?.75:area+.2;addFx({k:'target',real:true,x:e.x,y:e.y,dur:Math.max(.35,delay+.1),color,r:R});
   addFx({k:'impact',real:true,x:e.x,y:e.y,dur:.75,delay,color,r:R,seed:Math.random()*6,life:delay+.75});
   setTimeout(()=>{if(!S)return;hitStop=.16;addFx({k:'flash2',real:true,dur:.28,color});},delay*1000);}
  const o=objs.get('u'+e.unit);if(o)o.lunge=1.6;addFx({k:'label',real:true,x:e.from.x,y:e.from.y,h:2,text:e.name,color,dur:1.4,size:18});
  if(e.fx==='meteor')addFx({k:'meteor',real:true,x:e.x,y:e.y,dur:.5,color,r:area,fallOnly:true});else if(e.fx==='bolt')addFx({k:'bolt',x:e.x,y:e.y,dur:.5,color,wide:true});else if(e.fx!=='nova')addFx({k:'shot',from:e.from,to:{x:e.x,y:e.y},dur:.2,color,glow:color,magic:true});
  addFx({k:'ultblast',real:true,x:e.x,y:e.y,dur:1.2,delay,color:heal?'#9ff0c2':color,r:area*2,seed:Math.random()*6});
  if(!heal){const reach=(e.fx==='bolt'?.6:area)+.4;setTimeout(()=>{if(!S)return;for(const en of S.enemies)if(Math.hypot(en.x-e.x,en.y-e.y)<=reach){const ob=objs.get('e'+en.id);if(ob)ob.tremble=.5;}},delay*1000);}
  if(!heal){addFx({k:'elemfx',real:true,x:e.x,y:e.y,el:e.element,color,r:area+.2,dur:1.25,delay,seed:Math.random()*6,life:delay+1.25});
   if(e.element&&ULT_FX_NOTE[e.element])addFx({k:'label',real:true,x:e.x,y:e.y,h:2.6,text:`${D.ELEMENT_ICON[e.element]} ${ULT_FX_NOTE[e.element]}`,color,dur:1.3,size:16,delay});}
  if(!heal)setTimeout(()=>{shakeT=.6+.2*(e.chain||0);},delay*1000);}
 else if(e.t==='skill'){if(e.fx!=='heal')sfx('skill_'+({ice:'ice',water:'ice',fire:'fire',wind:'wind',thunder:'thunder',light:'light',dark:'dark'}[e.element]||'fire'));if(e.fx==='slash'||e.fx==='nova'){const r=(e.area||.6)+.35;for(const en of S.enemies)if(Math.hypot(en.x-e.x,en.y-e.y)<=r)shove(en.id,e.fx==='nova'?1.6:1.3);}const o=objs.get('u'+e.unit);if(o)o.lunge=1.4;const color=EL_COLOR[e.element]||'#fff';addFx({k:'label',x:e.from.x,y:e.from.y,h:1.5,text:e.name,color,dur:.9,size:13});
  if(e.fx==='slash')addFx({k:'slash',x:e.x,y:e.y,dur:.3,color,r:e.area?e.area:.55});else if(e.fx==='bolt'){addFx({k:'bolt',x:e.x,y:e.y,dur:.28,color});}
  else if(e.fx==='meteor'){addFx({k:'meteor',x:e.x,y:e.y,dur:.45,color,r:e.area});}else if(e.fx==='heal'){addFx({k:'ring',x:e.x,y:e.y,dur:.5,color:'#8fe5b4',r:.6,fill:true});sfx('heal');}else addFx({k:'ring',x:e.x,y:e.y,dur:.42,color,r:e.area||.6,fill:true});
  if(e.fx==='blast'||e.fx==='shot'||e.fx==='bolt')addFx({k:'shot',from:e.from,to:{x:e.x,y:e.y},dur:.14,color,magic:true});}
 else if(e.t==='dmg'&&e.ult&&e.v>0){{const hb=objs.get('e'+e.id);if(hb&&ultImpact>0){if(hb.shown==null){const en=S.enemies.find(x=>x.id===e.id);hb.shown=hb.trail=(en?en.hp:0)+e.v;}hb.hold=ultImpact;}}const ev=e,go=()=>{if(!S)return;const o=objs.get('e'+ev.id);const heavy=ev.pct>=.35;
   addFx({k:'burst',real:true,x:ev.x,y:ev.y,dur:.5,color:ev.tag==='weak'?'#ffd257':'#fff2c9',seed:Math.random()*6,big:heavy});
   const jx=(Math.random()-.5)*.25;addFx({k:'num',real:true,pop:true,glow:ev.tag==='weak'?'#ffb020':null,x:ev.x+jx,y:ev.y,h:1.15,text:ev.v+(ev.crit?'!!':'!'),color:ev.tag==='resist'?'#cfd8da':heavy?'#ffcf4a':'#ffe9a8',size:heavy?30:23,dur:1.25});
   if(ev.aff)addFx({k:'num',real:true,pop:true,x:ev.x+jx,y:ev.y,h:.62,text:ev.aff>0?`+${ev.aff} ${D.ELEMENT_ICON[ev.element]||''}상성`:`−${-ev.aff} 상성 불리`,color:ev.aff>0?'#ffd257':'#a9b6ba',size:14,dur:1.25});
   if(o){o.flash=.32;o.tremble=Math.max(o.tremble||0,.75);o.push=1.8;}};ultImpact>0?setTimeout(go,ultImpact*1000):go();continue;}
 else if(e.t==='dmg'){if(e.combo==='암습')addFx({k:'xmark',x:e.x,y:e.y,dur:.45});if(e.tag==='miss'){addFx({k:'num',x:e.x,y:e.y,h:.9,text:'빗나감',color:'#9fb0b6',size:11,dur:.6});continue;}const big=e.crit||e.tag==='weak'||e.combo;if(e.v>0&&fx.length<120)addFx({k:'hit',x:e.x,y:e.y,dur:.16,color:e.tag==='weak'?'#ffd257':'#ffffff'});addFx({k:'num',x:e.x+(Math.random()-.5)*.3,y:e.y,h:.9,text:(e.combo?e.combo+' ':'')+e.v+(e.crit?'!':''),color:e.tag==='weak'?'#ffd257':e.tag==='resist'?'#9fb0b6':e.crit?'#ffb199':'#fff',size:big?15:11,dur:.6});const o=objs.get('e'+e.id);if(o)o.flash=.12;}
 else if(e.t==='combo')addFx({k:'num',x:e.x,y:e.y,h:1.3,text:e.name,color:'#ffd257',size:15,dur:.8});
 else if(e.t==='hurt'){addFx({k:'num',x:e.x,y:e.y,h:1.3,text:'-'+e.v,color:'#ff9d8a',size:12,dur:.6});}
 else if(e.t==='eattack'){const a=objs.get('e'+e.id);if(a)a.lunge=1;}
 else if(e.t==='eshot')addFx({k:'shot',from:e.from,to:e.to,dur:.2,color:e.magic?(EL_COLOR[e.element]||'#ff9d8a'):'#ffb3a3',magic:e.magic,foe:true});
 else if(e.t==='heal'){if(e.v>0)addFx({k:'num',x:e.x,y:e.y,h:1.4,text:'+'+e.v,color:'#8fe5b4',size:13,dur:.7});}
 else if(e.t==='cleanse')addFx({k:'num',x:e.x,y:e.y,h:1.6,text:'정화',color:'#fff3b0',size:13,dur:.8});
 else if(e.t==='dodge')addFx({k:'num',x:e.x,y:e.y,h:1.4,text:'회피',color:'#cfe3ff',size:12,dur:.6});
 else if(e.t==='ustatus')addFx({k:'num',x:e.x,y:e.y,h:1.7,text:ST_NAME[e.status],color:ST_COLOR[e.status],size:13,dur:.9});
 else if(e.t==='die'){const o=objs.get('e'+e.id);if(o){objs.delete('e'+e.id);dying.push({g:o.g,t:0});}addFx({k:'num',x:e.x,y:e.y,h:.5,text:'+'+e.gold+(e.steal?'↑':''),color:'#f2cf72',size:12,dur:.7});deaths.push(e.boss?'die_boss':DIE_SOUND[e.model]||'monster_die');if(e.boss)banner('BOSS',S.chapter.boss.split?'갈라졌다!':'쓰러졌다!');}
 else if(e.t==='leak'){sfx('crystal_hit');addFx({k:'flash',dur:.35});toast(e.boss?'보스가 수정에 닿았습니다':`수정이 공격받았습니다 · 생명 −${e.cost}`);}
 else if(e.t==='down'){const o=objs.get('u'+e.id);if(o){objs.delete('u'+e.id);dying.push({g:o.g,t:0});}toast(`${D.UNITS[e.def].name} 쓰러짐${e.cd?` · ${e.cd}초 뒤 복귀 가능`:''}`);sfx('ally_down');if(selUnit===e.id)closePanel();}
 else if(e.t==='withdraw'){const o=objs.get('u'+e.id);if(o){objs.delete('u'+e.id);unitGroup.remove(o.g);}}
 else if(e.t==='ult'){sfx('ult_cast');banner('필살기',e.name);if(e.chain>0){addFx({k:'chainpop',real:true,dur:1.4,n:e.chain+1,pct:15*Math.min(2,e.chain)});sfx('ult_ready',{force:true});}}
 else if(e.t==='shard'){shardUi={phase:'fall',t:0,left:SHARD_SECONDS};sfx('skill_light',{force:true});}
 else if(e.t==='shardGiven'){shardGiven(e);}
 else if(e.t==='bossWave'){addFx({k:'ring',x:e.x,y:e.y,dur:.7,color:EL_COLOR[e.element]||'#ff6b5a',r:e.r,fill:true});addFx({k:'label',x:e.x,y:e.y,h:2.4,text:e.name,color:'#ff9d8a',dur:1.1,size:15});sfx('boss_attack');}
 else if(e.t==='bossSummon')addFx({k:'label',x:e.x,y:e.y,h:2.2,text:'소환!',color:'#ffb3a3',dur:.9,size:14});
 else if(e.t==='bossPhase'){banner('BOSS',e.name);sfx('boss_appear');addFx({k:'ring',x:e.x,y:e.y,dur:.8,color:'#fff3b0',r:3,fill:false});}
 else if(e.t==='bossFly'){addFx({k:'label',x:e.x,y:e.y,h:2.4,text:e.flying?'날아오른다':'내려앉았다!',color:'#c7a3ff',dur:1.1,size:15});}
 else if(e.t==='beamWarn'){warns.set(e.unit,{t:e.delay,boss:e.id});toast(`${e.name}: 조준당한 동료를 지키거나 철수하세요`);sfx('boss_attack');}
 else if(e.t==='beam'){warns.delete(e.unit);if(e.to)addFx({k:'beam',from:e.from,to:e.to,dur:.35});}
 else if(e.t==='bonus')toast(`${e.why} 보너스 +${e.gold}💰`);
 else if(e.t==='battleStart'){saveGame();const b=S.chapter.battles[e.battle];if(S.chapter.battles[e.battle+1]?.boss)bgm.preload(7);if(b.boss)bgm.preload(D.CHAPTERS[S.chapterIndex+1]?10:12);banner(`전투 ${e.battle+1}`,b.name);clearCard();bgm.play(battleTrack());sfx(b.boss?'boss_appear':'battle_start');if(b.boss)setTimeout(()=>{if(S)toast(`👑 ${S.chapter.boss.name} · ${S.chapter.boss.hint||''}`);},1800);}
 else if(e.t==='cleared'){if(S.phase!=='won')sfx('wave_clear');toast(`전투 ${e.battle+1} 승리 +${e.gold}💰${e.clean?' (무누수 보너스)':''}`);}
 else if(e.t==='prep'){saveGame();showPreview();}
 else if(e.t==='bless')blessingModal();
 else if(e.t==='won'){bgm.play(D.CHAPTERS[S.chapterIndex+1]?10:12,!D.CHAPTERS[S.chapterIndex+1]);const index=S.chapterIndex;clearFlow(index);}
 else if(e.t==='lost'){bgm.stop(1.5);sfx('defeat');resultModal(false);}
 hudKey='';}
 playDeaths();}
function ellipse(x,y,r,h=0){const p=proj(x,y,h);ctx.beginPath();ctx.ellipse(p.x,p.y,r*pxU,r*pxU*SIN,0,0,Math.PI*2);}
function tileQuad(c,r,h){const a=proj(c-.5,r-.5,h),b=proj(c+.5,r+.5,h);ctx.beginPath();ctx.rect(a.x+1,a.y+1,b.x-a.x-2,b.y-a.y-2);}
function pill(x,y,text,bg,fg){ctx.font=`400 13px ${FONT}`;const w=ctx.measureText(text).width+16;x=Math.max(w/2+4,Math.min(vw-w/2-4,x));y=Math.max(14,Math.min(vh-14,y));ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(x-w/2,y-11,w,22,11);ctx.fill();ctx.fillStyle=fg;ctx.fillText(text,x,y+4.5);}
function chevron(x,y,dx,dy,size,color,alpha){const p=proj(x,y,-.05),ax=dx,ay=dy*SIN,n=Math.hypot(ax,ay)||1,ux=ax/n,uy=ay/n,s=size*pxU;ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=Math.max(3,pxU*.09);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-ux*s-uy*s,p.y-uy*s+ux*s);ctx.lineTo(p.x,p.y);ctx.lineTo(p.x-ux*s+uy*s,p.y-uy*s-ux*s);ctx.stroke();ctx.globalAlpha=1;}
function drawMarkers(time){const map=S.map,prep=S.phase==='prep';
 map.paths.forEach((path,pi)=>{const flow=(time*1.2)%1;
  // Red arrows pour out of each gate; during preparation they run the whole road so the route is easy to read.
  const upto=prep?path.total-1.2:3.2;for(let d=.2+flow;d<upto;d+=prep?1.5:1){const p=map.posAt(pi,d),fade=prep?(d<3.2?.9:.38):Math.max(0,.95-d/3.6);chevron(p.x,p.y,p.dx,p.dy,.2,d<3.2?'#ff5a45':'#fff',fade);}
  const [fc,fr]=path.wp[0],seg=path.segs[0],g=proj(fc+seg.dx*.5,fr+seg.dy*.5,2.5);if(pi===0||path.wp[0][0]!==map.paths[0].wp[0][0]||path.wp[0][1]!==map.paths[0].wp[0][1])if(!demo.on)pill(g.x,g.y,map.paths.length>1?`▼ 적 출현 ${pi+1}`:'▼ 적 출현','rgba(170,40,30,.92)','#fff');
  for(let d=path.total-2.6+flow*.8;d<path.total-.5;d+=.8){const p=map.posAt(pi,d);chevron(p.x,p.y,p.dx,p.dy,.18,'#7ff0d2',.75);}});
 const last=map.paths[0].wp[map.paths[0].wp.length-1],c=proj(last[0],Math.min(last[1],S.map.h-1)+.6,2.6),low=S.life<=S.maxLife*.35;if(!demo.on)pill(c.x,c.y,`아르카 수정 ♥${S.life}`,low?'rgba(170,40,30,.92)':'rgba(20,90,80,.92)','#fff');}
function drawOverlay(dt,time,realDt=dt){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,vw,vh);ctx.textAlign='center';ctx.lineJoin='round';
 drawMarkers(time);drawVantage(time);
 // Where the selected card may go
 if(selCard&&validTiles){const d=D.UNITS[selCard];for(const t of validTiles){tileQuad(t.c,t.r,tileTop(t));ctx.fillStyle=t.road?'rgba(255,190,70,.5)':t.terrain==='high'?'rgba(90,215,255,.5)':'rgba(60,220,130,.34)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.5;ctx.stroke();}
  if(hover&&hover.c!=null){const t=S.map.tile(hover.c,hover.r),ok=validTiles.includes(t),range=d.range+(d.melee?0:(t.terrain==='high'?.5:0)-(t.terrain==='forest'?.5:0)+S.mods.range);ellipse(hover.c,hover.r,range+.35);ctx.fillStyle=ok?'rgba(255,255,255,.16)':'rgba(240,120,100,.2)';ctx.fill();ctx.strokeStyle=ok?'#fff':'#f08f7c';ctx.lineWidth=2;ctx.stroke();tileQuad(hover.c,hover.r,tileTop(t));ctx.strokeStyle=ok?'#fff':'#f08f7c';ctx.lineWidth=3;ctx.stroke();}}
 if(selCard&&D.UNITS[selCard].melee){for(const g of S.map.gates){ellipse(g.x,g.y,D.GATE_GAP-.05,tileTop(S.map.tile(g.x,g.y)));ctx.fillStyle='rgba(235,70,50,.13)';ctx.fill();ctx.setLineDash([7,6]);ctx.strokeStyle='rgba(255,110,90,.95)';ctx.lineWidth=2.5;ctx.stroke();ctx.setLineDash([]);const q=proj(g.x,g.y+1.2,1.4);pill(q.x,q.y,`입구 ${D.GATE_GAP}칸 근접 금지`,'rgba(170,40,30,.9)','#fff');}
  for(const u of S.units){if(!S.defOf(u).melee||!S.map.tile(u.c,u.r).road)continue;ellipse(u.x,u.y,D.MELEE_GAP-.05,tileTop(S.map.tile(u.c,u.r)));ctx.fillStyle='rgba(235,70,50,.13)';ctx.fill();ctx.setLineDash([7,6]);ctx.strokeStyle='rgba(255,110,90,.95)';ctx.lineWidth=2.5;ctx.stroke();ctx.setLineDash([]);}
  for(const t of spacedTiles){tileQuad(t.c,t.r,tileTop(t));ctx.fillStyle='rgba(225,60,45,.42)';ctx.fill();const m=proj(t.c,t.r,tileTop(t)),q=pxU*.16;ctx.strokeStyle='rgba(255,235,230,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m.x-q,m.y-q*SIN);ctx.lineTo(m.x+q,m.y+q*SIN);ctx.moveTo(m.x+q,m.y-q*SIN);ctx.lineTo(m.x-q,m.y+q*SIN);ctx.stroke();}
  if(spacedTiles.length){const u=S.units.find(v=>S.defOf(v).melee&&S.map.tile(v.c,v.r).road);if(u){const g=proj(u.x,u.y,2.1);pill(g.x,g.y,`근접 배치 금지 ${D.MELEE_GAP}칸`,'rgba(170,40,30,.9)','#fff');}}}
 const su=selUnit&&S.units.find(u=>u.id===selUnit);
 // While aiming a 필살기 (meteor), no range circles: it can land anywhere, and a circle would suggest otherwise.
 if(su&&aiming!==su.id){ellipse(su.x,su.y,su.range+.35);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;ctx.stroke();if(S.defOf(su).melee&&S.map.tile(su.c,su.r).road){ellipse(su.x,su.y,D.MELEE_GAP-.05);ctx.setLineDash([4,6]);ctx.strokeStyle='rgba(255,110,90,.7)';ctx.lineWidth=1.5;ctx.stroke();ctx.setLineDash([]);}for(const au of su.auras){ellipse(su.x,su.y,au.radius+.4);ctx.setLineDash([6,5]);ctx.strokeStyle='#f2cf72';ctx.stroke();ctx.setLineDash([]);}}
 // Monster bars and status pips (the boss gets the big bar at the top instead, see bossHud)
 let bossShown=null;
 for(const e of S.enemies){const sc=e.scale||1,p=proj(e.x,e.y,(e.flying?1.95:1.25)*Math.max(1,sc*.92)),w=pxU*.72*hpBarScale(e);
  // HP bar: the lost part stays as a bright "trail" for a moment and then drains, so every hit visibly bites into the bar.
  // A 필살기 holds the bar until its impact lands (meteor falls first). The bar flashes white on a hit.
  const ob=objs.get('e'+e.id);let shown=e.hp,trail=e.hp,flash=0;
  if(ob){if(ob.shown==null){ob.shown=e.hp;ob.trail=e.hp;}if((ob.hold||0)>0)ob.hold-=realDt;else if(e.hp<ob.shown-.01){ob.from=Math.max(ob.trail,ob.shown);ob.trail=ob.from;ob.shown=e.hp;ob.age=0;ob.barFlash=.18;}else if(e.hp>ob.shown)ob.shown=ob.trail=e.hp;
   // every trail looks the same: held BAR_HOLD, then shrinks to the bar over BAR_DRAIN, whatever the monster's size or the hit
   if(ob.trail>ob.shown){ob.age=(ob.age||0)+realDt;const k=Math.max(0,Math.min(1,(ob.age-BAR_HOLD)/BAR_DRAIN));ob.trail=ob.from+(ob.shown-ob.from)*k;}ob.barFlash=Math.max(0,(ob.barFlash||0)-realDt);shown=ob.shown;trail=ob.trail;flash=ob.barFlash;}
  // Element badge left of the bar (TACTICS style). With a character selected: monsters it is strong against glow, weak ones dim.
  if(e.element){const r=e.boss?8:6.5,bx=p.x-w/2-r-2,by=p.y+3;let m=1;if(selUnit){const su=S.units.find(v=>v.id===selUnit);if(su){const ms=unitElements(su).map(x=>matchup(x,e.element));m=ms.length?Math.max(...ms):1;}}
   ctx.save();if(selUnit&&m<1)ctx.globalAlpha=.4;if(selUnit&&m>1){ctx.shadowColor=EL_COLOR[e.element]||'#fff';ctx.shadowBlur=10+4*Math.sin(time*6);}
   ctx.fillStyle='rgba(12,22,26,.85)';ctx.beginPath();ctx.arc(bx,by,r,0,7);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=EL_COLOR[e.element]||'#fff';ctx.stroke();ctx.shadowBlur=0;
   ctx.font=`${Math.round(r*1.35)}px sans-serif`;ctx.textBaseline='middle';ctx.fillText(D.ELEMENT_ICON[e.element]||'',bx,by+.5);ctx.textBaseline='alphabetic';
   if(selUnit&&m>1){ctx.font=`400 10px ${FONT}`;ctx.fillStyle='#ffd257';ctx.strokeStyle='rgba(12,22,26,.9)';ctx.lineWidth=3;ctx.strokeText('▲',bx,by-r-4);ctx.fillText('▲',bx,by-r-4);}ctx.restore();}
  if(e.boss&&!bossShown)bossShown={e,shown,trail,flash};
  if(!e.boss&&(e.hp<e.maxHp||e.elite)){const bh=e.boss?8:6,f=v=>w*Math.max(0,Math.min(1,v/e.maxHp));ctx.fillStyle='rgba(12,22,26,.8)';ctx.fillRect(p.x-w/2-1,p.y-1,w+2,bh+2);
   ctx.fillStyle='#fff2c9';ctx.fillRect(p.x-w/2+f(shown),p.y,f(trail)-f(shown),bh);
   ctx.fillStyle='#ee4f3f';ctx.fillRect(p.x-w/2,p.y,f(shown),bh);
   if(flash>0){ctx.strokeStyle=`rgba(255,255,255,${flash/.18})`;ctx.lineWidth=1.5;ctx.strokeRect(p.x-w/2-1.5,p.y-1.5,w+3,bh+3);}}
  let i=0;for(const k in e.st){ctx.fillStyle=ST_COLOR[k]||'#fff';ctx.beginPath();ctx.arc(p.x-w/2+4+i*8,p.y-6,3,0,7);ctx.fill();i++;}
  if(e.engagedBy){ctx.fillStyle='#fff';ctx.font=`400 10px ${FONT}`;ctx.fillText('⛓',p.x+w/2+5,p.y+5);}
  if(e.shielded){const g=proj(e.x,e.y,.5);ctx.beginPath();ctx.arc(g.x,g.y,pxU*.4,0,7);ctx.strokeStyle='rgba(140,230,230,.7)';ctx.lineWidth=2;ctx.stroke();}}
 // Character bars, rank, ultimate glow
 bossHud(bossShown);
 for(const u of S.units){const gy=groundY(u.x,u.y),p=proj(u.x,u.y,gy+1.45),w=pxU*.7;ctx.fillStyle='rgba(12,22,26,.75)';ctx.fillRect(p.x-w/2-1,p.y-1,w+2,7);ctx.fillStyle=u.hp/u.maxHp>.35?'#7fe0a6':'#ffb35c';ctx.fillRect(p.x-w/2,p.y,w*Math.max(0,u.hp/u.maxHp),5);
  ctx.font=`400 10px ${FONT}`;ctx.fillStyle='#f2cf72';ctx.strokeStyle='rgba(12,22,26,.9)';ctx.lineWidth=3;const s='★'.repeat(u.rank);ctx.strokeText(s,p.x,p.y-3);ctx.fillText(s,p.x,p.y-3);
  if(ultReady(u)){drawReady(u,gy,time);if(!ultSeen.has(u.id)){ultSeen.add(u.id);sfx('ult_ready');addFx({k:'readyburst',real:true,x:u.x,y:u.y,h:gy,color:heroColor(u),dur:.9});}}else ultSeen.delete(u.id);
  if(u.shardT>0){const g=proj(u.x,u.y,gy),rot=time*2.4;ctx.save();ctx.shadowColor='#7ff3ff';ctx.shadowBlur=12;ctx.strokeStyle=`rgba(140,245,255,${.7+.3*Math.sin(time*8)})`;ctx.lineWidth=3;ctx.setLineDash([pxU*.18,pxU*.1]);ctx.lineDashOffset=-rot*pxU;
   ctx.beginPath();ctx.ellipse(g.x,g.y,pxU*.62,pxU*.62*SIN,0,0,7);ctx.stroke();ctx.setLineDash([]);for(let j=0;j<4;j++){const ph=(time*.9+j/4)%1,an=rot+j*1.57,q=proj(u.x+Math.cos(an)*.5,u.y+Math.sin(an)*.5,gy+ph*1.6);ctx.globalAlpha=1-ph;ctx.fillStyle='#bdf8ff';ctx.beginPath();ctx.arc(q.x,q.y,2.6,0,7);ctx.fill();}ctx.restore();
   const b=proj(u.x,u.y,gy+1.75);ctx.font=`400 11px ${FONT}`;ctx.lineWidth=3;ctx.strokeStyle='rgba(8,30,40,.9)';ctx.strokeText('💎×2',b.x+pxU*.42,b.y);ctx.fillStyle='#bdf8ff';ctx.fillText('💎×2',b.x+pxU*.42,b.y);}
  if(S.fortress>0){const g=proj(u.x,u.y,gy+.6);ctx.beginPath();ctx.arc(g.x,g.y,pxU*.55,0,7);ctx.strokeStyle='rgba(255,243,176,.8)';ctx.lineWidth=2.5;ctx.stroke();}
  let i=0;for(const k in u.st){ctx.fillStyle=ST_COLOR[k]||'#fff';ctx.beginPath();ctx.arc(p.x-w/2+4+i*8,p.y+11,3.5,0,7);ctx.fill();i++;}
  if(u.buff>1||u.defBuff>1||u.hasteBuff>1){const g=proj(u.x,u.y,gy+1.78);ctx.font=`400 11px ${FONT}`;ctx.fillStyle='#f2cf72';ctx.fillText((u.buff>1?'⚔':'')+(u.defBuff>1?'🛡':'')+(u.hasteBuff>1?'»':''),g.x,g.y);}
  const wn=warns.get(u.id);if(wn){wn.t-=dt;const g=proj(u.x,u.y,gy+.6),boss=S.enemies.find(en=>en.id===wn.boss);ctx.strokeStyle=`rgba(255,80,60,${.5+.5*Math.sin(time*16)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(g.x,g.y,pxU*.6,0,7);ctx.stroke();if(boss){const b=proj(boss.x,boss.y,1.2);ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(g.x,g.y);ctx.stroke();ctx.setLineDash([]);}if(wn.t<-1)warns.delete(u.id);}}
 if(aiming){const s=D.SKILLS[S.units.find(u=>u.id===aiming)?.ult];if(s&&hover&&hover.x!=null){ellipse(hover.x,hover.y,s.area);ctx.strokeStyle='#ff8a3d';ctx.lineWidth=2;ctx.stroke();}}
 // Effects
 for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.t+=f.real?realDt:dt;const k=Math.min(1,f.t/f.dur);if(f.t>=(f.life||f.dur)){fx.splice(i,1);continue;}
  if(f.k==='shot'){const a=proj(f.from.x,f.from.y,f.foe?.7:1),b=proj(f.to.x,f.to.y,f.foe?1:.6),x=a.x+(b.x-a.x)*k,y=a.y+(b.y-a.y)*k,tx=x-(b.x-a.x)*.28,ty=y-(b.y-a.y)*.28;ctx.lineCap='round';
   if(f.glow){ctx.shadowColor=f.glow;ctx.shadowBlur=10;}ctx.strokeStyle=f.glow||f.color;ctx.globalAlpha=.55;ctx.lineWidth=f.magic?8:5;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(x,y);ctx.stroke();ctx.globalAlpha=1;ctx.strokeStyle=f.color;ctx.lineWidth=f.magic?4:2.5;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(x,y);ctx.stroke();
   ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(x,y,f.magic?5:3.5,0,7);ctx.fill();ctx.shadowBlur=0;}
  else if(f.k==='beam'){const a=proj(f.from.x,f.from.y,1.2),b=proj(f.to.x,f.to.y,.7);ctx.globalAlpha=1-k;ctx.strokeStyle='#ffe66b';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='slash'){const p=proj(f.x,f.y,.55),arc=()=>{ctx.beginPath();ctx.ellipse(p.x,p.y,f.r*pxU*(.6+k*.5),f.r*pxU*.5*(.6+k*.5),-.5,Math.PI*(1.05+k*.6),Math.PI*(1.95+k*.6));ctx.stroke();};ctx.lineCap='round';ctx.globalAlpha=1-k*k;
   if(f.glow){ctx.shadowColor=f.glow;ctx.shadowBlur=12;ctx.strokeStyle=f.glow;ctx.lineWidth=7+f.r*6;arc();}ctx.strokeStyle=f.color;ctx.lineWidth=3+f.r*3;arc();ctx.shadowBlur=0;ctx.globalAlpha=1;}
  else if(f.k==='ultblast'){if(f.t<(f.delay||0))continue;const q=Math.min(1,(f.t-(f.delay||0))/f.dur);if(q>=1){fx.splice(i,1);continue;}const ease=1-Math.pow(1-q,3),R=f.r*ease;ctx.save();ctx.shadowColor=f.color;ctx.shadowBlur=22;
   if(q<.35){const a=1-q/.35;ellipse(f.x,f.y,f.r*.55*(.4+q));ctx.fillStyle='#ffffff';ctx.globalAlpha=a*.85;ctx.fill();}
   ellipse(f.x,f.y,R);ctx.fillStyle=f.color;ctx.globalAlpha=(1-q)*.32;ctx.fill();
   ctx.globalAlpha=(1-q)*.95;ctx.strokeStyle=f.color;ctx.lineWidth=10*(1-q)+3;ctx.stroke();
   ellipse(f.x,f.y,R*.62);ctx.globalAlpha=(1-q)*.8;ctx.strokeStyle='#fff';ctx.lineWidth=4*(1-q)+1.5;ctx.stroke();
   const c=proj(f.x,f.y,.3);ctx.globalAlpha=(1-q);ctx.strokeStyle=f.color;ctx.lineWidth=3;ctx.lineCap='round';for(let j=0;j<14;j++){const an=f.seed+j*Math.PI*2/14,r1=R*pxU*.55,r2=R*pxU*(.75+.25*Math.sin(j*3.1+f.seed));ctx.beginPath();ctx.moveTo(c.x+Math.cos(an)*r1,c.y+Math.sin(an)*r1*SIN);ctx.lineTo(c.x+Math.cos(an)*r2,c.y+Math.sin(an)*r2*SIN-pxU*.5*(1-q));ctx.stroke();}
   ctx.restore();ctx.globalAlpha=1;continue;}
  else if(f.k==='spark'){const p=proj(f.x,f.y,.6);ctx.strokeStyle=f.color;ctx.lineWidth=2.5;ctx.globalAlpha=1-k;ctx.lineCap='round';for(let j=0;j<6;j++){const an=j*Math.PI/3+.4,r1=pxU*(.12+k*.25),r2=pxU*(.22+k*.45);ctx.beginPath();ctx.moveTo(p.x+Math.cos(an)*r1,p.y+Math.sin(an)*r1*.8);ctx.lineTo(p.x+Math.cos(an)*r2,p.y+Math.sin(an)*r2*.8);ctx.stroke();}ctx.globalAlpha=1;}
  else if(f.k==='hit'){const p=proj(f.x,f.y,.6);ctx.globalAlpha=(1-k)*.85;ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(p.x,p.y,pxU*(.12+k*.22),0,7);ctx.fill();ctx.globalAlpha=1;}
  else if(f.k==='ring'){ellipse(f.x,f.y,f.r*(.35+.65*k));ctx.globalAlpha=(1-k)*.9;if(f.fill){ctx.fillStyle=f.color;ctx.globalAlpha=(1-k)*.38;ctx.fill();ctx.globalAlpha=(1-k)*.9;}ctx.strokeStyle=f.color;ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='bolt'){const p=proj(f.x,f.y,.2);ctx.strokeStyle=f.color;ctx.globalAlpha=1-k;ctx.lineWidth=f.wide?9:4;if(f.wide){ctx.shadowColor=f.color;ctx.shadowBlur=16;}ctx.beginPath();let x=p.x,y=p.y-pxU*3.2;ctx.moveTo(x,y);for(let j=1;j<=5;j++){x=p.x+(j<5?(Math.sin(j*7.3+f.x*5)*pxU*.25):0);y=p.y-pxU*3.2*(1-j/5);ctx.lineTo(x,y);}ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='meteor'&&f.fallOnly){const p=proj(f.x,f.y,7*(1-k)),q=pxU*(.32+.12*k);ctx.shadowColor=f.color;ctx.shadowBlur=18;ctx.fillStyle='#ffd27a';ctx.beginPath();ctx.arc(p.x+pxU*1.8*(1-k),p.y,q,0,7);ctx.fill();ctx.strokeStyle='rgba(255,140,60,.7)';ctx.lineWidth=q*.9;ctx.beginPath();ctx.moveTo(p.x+pxU*1.8*(1-k),p.y);ctx.lineTo(p.x+pxU*1.8*(1-k)+pxU*.9,p.y-pxU*1.4);ctx.stroke();ctx.shadowBlur=0;}
  else if(f.k==='meteor'){if(k<.6){const q=k/.6,p=proj(f.x,f.y,6*(1-q));ctx.fillStyle='#ffb35c';ctx.beginPath();ctx.arc(p.x+pxU*1.5*(1-q),p.y,pxU*.34,0,7);ctx.fill();}else{const q=(k-.6)/.4;ellipse(f.x,f.y,f.r*(.4+.6*q));ctx.fillStyle=f.color;ctx.globalAlpha=(1-q)*.6;ctx.fill();ctx.globalAlpha=1;}}
  else if(f.k==='num'||f.k==='label'){const p=proj(f.x,f.y,(f.h||1)+k*.5),pop=f.pop?(k<.12?.6+k/.12*.9:k<.25?1.5-(k-.12)/.13*.5:1):1;ctx.font=`400 ${Math.round(((f.size||13)+2)*pop)}px ${FONT}`;ctx.globalAlpha=k<.7?1:1-(k-.7)/.3;if(f.k==='label'){const hw=ctx.measureText(f.text).width/2+4;p.x=Math.max(hw,Math.min(vw-hw,p.x));}ctx.strokeStyle='rgba(12,22,26,.9)';ctx.lineWidth=f.pop?4:3;if(f.glow){ctx.shadowColor=f.glow;ctx.shadowBlur=14;}ctx.strokeText(f.text,p.x,p.y);ctx.shadowBlur=0;ctx.fillStyle=f.color;ctx.fillText(f.text,p.x,p.y);ctx.globalAlpha=1;}
  else if(f.k==='flash'){ctx.fillStyle=`rgba(240,90,70,${(1-k)*.3})`;ctx.fillRect(0,0,vw,vh);}
  else if(f.k==='flash2'){ctx.globalAlpha=(1-k)*.32;ctx.fillStyle=f.color;ctx.fillRect(0,0,vw,vh);ctx.globalAlpha=1;}
  else if(drawFx2(f,k))continue;
  // Where the 필살기 will land: a pulsing reticle that closes in until the impact.
  else if(f.k==='target'){const q=k,R=f.r*(1.35-.35*q),p=proj(f.x,f.y,0);ctx.save();ctx.globalAlpha=.55+.45*Math.sin(f.t*28)*.5;ellipse(f.x,f.y,R);ctx.fillStyle=f.color;ctx.globalAlpha*=.18;ctx.fill();ctx.globalAlpha=.9*(1-q*.3);
   ctx.setLineDash([pxU*.22,pxU*.14]);ctx.lineDashOffset=-f.t*pxU*2;ctx.lineWidth=3;ctx.strokeStyle=f.color;ellipse(f.x,f.y,R);ctx.stroke();ctx.setLineDash([]);
   ctx.lineWidth=2;ctx.strokeStyle='#fff';for(const a of [0,1,2,3]){const an=a*Math.PI/2+f.t*3,x=Math.cos(an)*R*pxU,y=Math.sin(an)*R*pxU*SIN;ctx.beginPath();ctx.moveTo(p.x+x*.7,p.y+y*.7);ctx.lineTo(p.x+x*1.08,p.y+y*1.08);ctx.stroke();}ctx.restore();}
  // The moment it lands: white core flash, a ground shock ring, cracks and flying debris.
  else if(f.k==='impact'){if(f.t<(f.delay||0))continue;const q=Math.min(1,(f.t-(f.delay||0))/f.dur),p=proj(f.x,f.y,0),R=f.r*pxU;ctx.save();
   if(q<.25){const c=1-q/.25;ctx.globalAlpha=c;const g=ctx.createRadialGradient(p.x,p.y-pxU*.3,0,p.x,p.y-pxU*.3,R*1.2);g.addColorStop(0,'#ffffff');g.addColorStop(.4,f.color);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y-pxU*.3,R*1.2,0,7);ctx.fill();}
   ctx.globalAlpha=(1-q)*.9;ctx.lineWidth=5*(1-q)+1;ctx.strokeStyle='#fff';ellipse(f.x,f.y,f.r*(.3+1.1*q));ctx.stroke();
   ctx.globalAlpha=(1-q)*.8;ctx.strokeStyle='rgba(30,20,15,.85)';ctx.lineWidth=2.2;for(let i=0;i<7;i++){const an=f.seed+i*.9,len=R*(.55+.35*Math.sin(i*2.3+f.seed));ctx.beginPath();ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x+Math.cos(an)*len*.5+Math.sin(i)*4,p.y+Math.sin(an)*len*.5*SIN);ctx.lineTo(p.x+Math.cos(an)*len,p.y+Math.sin(an)*len*SIN);ctx.stroke();}
   ctx.globalAlpha=1-q;for(let i=0;i<14;i++){const an=f.seed*3+i*.45,sp=.6+((i*37)%10)/10,d=R*sp*q*1.2,up=pxU*(1.3*sp)*Math.sin(Math.min(1,q*1.6)*Math.PI);ctx.fillStyle=i%3?f.color:'#fff';
    ctx.fillRect(p.x+Math.cos(an)*d-2,p.y+Math.sin(an)*d*SIN-up-2,4+(i%3),4+(i%3));}ctx.restore();}
  // A monster struck by a 필살기: rays and sparks bursting from it.
  else if(f.k==='burst'){const p=proj(f.x,f.y,.6),R=pxU*(f.big?.95:.7)*(.35+.65*(1-Math.pow(1-k,3)));ctx.save();ctx.globalAlpha=1-k;ctx.strokeStyle=f.color;ctx.lineWidth=f.big?4:3;ctx.lineCap='round';
   for(let i=0;i<8;i++){const an=f.seed+i*Math.PI/4;ctx.beginPath();ctx.moveTo(p.x+Math.cos(an)*R*.35,p.y+Math.sin(an)*R*.35);ctx.lineTo(p.x+Math.cos(an)*R,p.y+Math.sin(an)*R);ctx.stroke();}
   ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,pxU*.2*(1-k),0,7);ctx.fill();ctx.restore();}}}
fxc.addEventListener('pointermove',e=>{if(!S)return;const p=localPoint(e);if(aiming)hover=unproj(p.x,p.y);else if(selCard&&!dragging)hover=tileAt(p);});

// ── 3D objects follow the simulation ──
// Where a character looks. Just after attacking: its target. Melee on the road: back up the road, where monsters come from
// (or at a monster right beside it). Ranged: the nearest monster anywhere on the field, or the monster gate while it is empty.
function nearestFoe(u,max){let best=null,bd=max;for(const e of S.enemies){const d=Math.hypot(e.x-u.x,e.y-u.y);if(d<bd){bd=d;best=e;}}return best;}
function gateOf(u){let best=null,bd=1e9;for(const p of S.map.paths){const [gc,gr]=p.wp[0],x=Math.max(0,Math.min(S.map.w-1,gc)),y=Math.max(0,Math.min(S.map.h-1,gr)),d=Math.hypot(x-u.x,y-u.y);if(d<bd){bd=d;best={x,y};}}return best||{x:u.x,y:u.y-1};}
function lookOf(u){if(S.time-u.faceT<.9)return u.face;const def=S.defOf(u),t=S.map.tile(u.c,u.r),to=p=>({dx:p.x-u.x,dy:p.y-u.y});
 if(def.melee){const e=nearestFoe(u,t.road?1.6:2.6);if(e)return to(e);if(t.road){const p=+Object.keys(t.pd)[0],q=S.map.posAt(p,Math.max(0,t.pd[p]-.5));return {dx:-q.dx,dy:-q.dy};}return to(gateOf(u));}
 const e=nearestFoe(u,99);return e?to(e):to(gateOf(u));}
function syncObjects(dt,time){
 for(const u of S.units){const key='u'+u.id;let o=objs.get(key);if(!o){o={g:modelFor('u:'+u.def,unitSpec(u.def)),lunge:0};unitGroup.add(o.g);objs.set(key,o);}
  const gy=groundY(u.x,u.y);o.lunge=Math.max(0,o.lunge-dt*6);const len=Math.hypot(u.face.dx,u.face.dy)||1;let l=Math.sin(o.lunge*Math.PI)*.16,lift=0,lean=0,sq=0;
  // melee strike (no rig): dash forward and back, lean into it, squash on contact; Bran hops and slams down
  if(o.strike!=null){o.strike+=dt/(o.heavy?.42:.3);const k=o.strike;if(k>=1)o.strike=null;else{const f=k<.35?k/.35:1-(k-.35)/.65,ease=f*f*(3-2*f);
   if(o.heavy){lift=k<.35?Math.sin(k/.35*Math.PI*.5)*.32:Math.max(0,.32*(1-(k-.35)/.12));lean=k<.3?-.25*(k/.3):.45*ease;l=Math.max(l,.22*ease);sq=k>.35&&k<.6?1-(k-.35)/.25:0;}
   else{l=Math.max(l,.36*ease);lean=.38*ease;sq=k>.3&&k<.55?1-(k-.3)/.25:0;}}}
  o.g.position.set(wx(u.x)+u.face.dx/len*l,gy+lift,wz(u.y)+u.face.dy/len*l);o.g.rotation.order='YXZ';o.g.rotation.x=lean;o.g.scale.set(1+.08*sq,1-.14*sq,1+.08*sq);
  readyGlow(u,o,time);const f=lookOf(u),want=Math.atan2(f.dx,f.dy);let d=want-o.g.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));o.g.rotation.y+=d*Math.min(1,dt*14);}
 for(const e of S.enemies){const key='e'+e.id;let o=objs.get(key);if(!o){o={g:modelFor(`e:${e.kind}:${e.model}:${e.elite?1:0}:${e.scale||0}:${e.bossId??''}`,enemySpec(e)),lunge:0,flash:0,seed:e.id*1.7,air:e.flying?1:0};unitGroup.add(o.g);objs.set(key,o);}
  const moving=!e.st.freeze&&!e.st.stun&&!e.st.sleep&&!e.st.root;o.lunge=Math.max(0,o.lunge-dt*6);o.push=Math.max(0,(o.push||0)-dt*5.5);const kb=e.flying?0:Math.sin(Math.min(1,o.push)*Math.PI/2)*.17*(o.push>1?o.push:1)/(e.boss?2.2:1);o.air+=((e.flying?1:0)-o.air)*Math.min(1,dt*3);
  // Walking: the step bob follows the distance actually walked (about 2.4 steps per tile), so slow and held monsters step slowly
  // and nothing slides. Bigger bodies bob higher; each step also rolls the body a little to the side. Slimes bounce and squash.
  // Ghosts and flame spirits float instead, and flyers keep their flight motion.
  const floaty=e.model==='ghost'||e.model==='flameSpirit',size=Math.min(1.6,e.scale||1),walked=o.px==null?0:Math.hypot(e.x-o.px,e.y-o.py);o.px=e.x;o.py=e.y;
  if(walked<.5)o.ph=(o.ph||o.seed)+walked*Math.PI*2.4;o.amp=(o.amp||0)+((moving&&walked>1e-4?1:0)-(o.amp||0))*Math.min(1,dt*8);
  const slime=e.model==='slime',step=Math.abs(Math.sin(o.ph||0)),hop=e.flying?0:floaty?.22+Math.sin(time*2.2+o.seed)*.07:step*o.amp*(slime?.17:.12)*size,l=Math.sin(o.lunge*Math.PI)*.14;
  o.g.rotation.z=e.flying||slime?0:floaty?Math.sin(time*1.6+o.seed)*.05:Math.sin(o.ph||0)*.09*o.amp;
  o.tremble=Math.max(0,(o.tremble||0)-dt);const tr=o.tremble>0?o.tremble*.14:0,jx=tr?Math.sin(time*95+o.seed)*tr:0,jz=tr?Math.cos(time*83+o.seed)*tr:0;
  o.g.position.set(wx(e.x)+e.dx*(l-kb)+jx,groundY(e.x,e.y)+.02+hop*(1-o.air)+o.air*(.8+Math.sin(time*3+o.seed)*.08),wz(e.y)+e.dy*(l-kb)+jz);{const want=Math.atan2(e.dx,e.dy);let d=want-o.g.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));o.g.rotation.y+=d*Math.min(1,dt*9);}
  if(o.flash>0){o.flash-=dt;const s=1+o.flash*1.2;o.g.scale.set(s,1/s,s);}else if(slime&&o.amp>.05){const q=1+(1-step)*.14*o.amp;o.g.scale.set(Math.sqrt(q),1/q,Math.sqrt(q));}else o.g.scale.setScalar(1);}
 for(const [key,o] of objs){const id=+key.slice(1),alive=key[0]==='u'?S.units.some(u=>u.id===id):S.enemies.some(e=>e.id===id);if(!alive){objs.delete(key);unitGroup.remove(o.g);}}
 for(let i=dying.length-1;i>=0;i--){const d=dying[i];d.t+=dt;const k=1-d.t/.25;if(k<=0){unitGroup.remove(d.g);dying.splice(i,1);}else d.g.scale.setScalar(Math.max(.01,k));}}

// ── 1.7.1: melee swings drawn as effects, and the 필살기-ready look ──
const HERO_COLOR={kyle:'#ffd257',sera:'#7fe08a',ria:'#ff5a6e',nero:'#b07cff',bran:'#ff9a3c',luna:'#f4f6ff'};
const heroColor=u=>HERO_COLOR[u.def]||'#ffd257';
// One swing per melee basic attack, starting at the attacker and reaching the target. The colour follows the ★3 imprint element.
function meleeSwing(e,o){const u=S.units.find(v=>v.id===e.unit);if(!u)return;const def=u.def,el=u.choice&&EL_COLOR[u.choice],n=o?(o.swings=(o.swings||0)+1):1;
 if(o){o.strike=0;o.heavy=def==='bran';}
 const base={from:e.from,to:e.to,seed:Math.random()*6};
 if(def==='kyle'){if(n%3===0){addFx({...base,k:'mcross',dur:.3,color:el||'#fff6c8',glow:el||'#ffd257'});}else addFx({...base,k:'mslash',dur:.22,color:'#fffbe6',glow:el||'#ffd257',flip:n%2?1:-1,wide:1.25});}
 else if(def==='bran'){addFx({...base,k:'msmash',dur:.5,color:'#fff1d6',glow:el||'#ff9a3c'});}
 else if(def==='nero'){addFx({...base,k:'mstab',dur:.2,color:'#f3e8ff',glow:el||'#9b5cff',off:-.12});addFx({...base,k:'mstab',dur:.2,delay:.07,color:'#f3e8ff',glow:el||'#9b5cff',off:.12,life:.27});}
 else if(def==='shield'){addFx({...base,k:'mslash',dur:.2,color:'#e9f3ff',glow:'#8fb8ff',flip:1,wide:.75});addFx({k:'ring',x:e.to.x,y:e.to.y,dur:.3,color:'#cfe3ff',r:.45});}
 else addFx({...base,k:'mstab',dur:.18,color:'#fff6dc',glow:el||'#ffcf7a',off:0,spear:true});
 addFx({k:'spark',x:e.to.x,y:e.to.y,dur:.22,color:'#fff3b0'});}
// a tapered arc: thin faded tail, thick bright head
function taperArc(cx,cy,R,ry,a0,a1,w,color,alpha){const N=12;for(let i=0;i<N;i++){const t0=i/N,t1=(i+1)/N;ctx.globalAlpha=alpha*(.15+.85*t1);ctx.lineWidth=w*(.25+.75*t1);ctx.strokeStyle=color;ctx.beginPath();ctx.ellipse(cx,cy,R,ry,0,a0+(a1-a0)*t0,a0+(a1-a0)*t1+(a1>a0?.02:-.02),a1<a0);ctx.stroke();}}
function drawFx3(f,k){
 if(f.k==='mslash'){const a=proj(f.from.x,f.from.y,.65),b=proj(f.to.x,f.to.y,.6),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,ang=Math.atan2(dy,dx),R=Math.max(d*.7,pxU*.55)*f.wide,cx=a.x+dx*.35,cy=a.y+dy*.35,span=1.25,
   head=ang-f.flip*span+f.flip*2*span*Math.min(1,k/.6),tail=head-f.flip*1.5*Math.min(1,k/.6+.2),fade=k<.6?1:1-(k-.6)/.4;ctx.save();ctx.lineCap='round';ctx.shadowColor=f.glow;ctx.shadowBlur=16;
  taperArc(cx,cy,R,R*.62,tail,head,pxU*.26,f.glow,fade*.75);ctx.shadowBlur=0;taperArc(cx,cy,R,R*.62,tail,head,pxU*.1,f.color,fade);ctx.restore();ctx.globalAlpha=1;return true;}
 if(f.k==='mcross'){const b=proj(f.to.x,f.to.y,.6),L=pxU*.75,g=Math.min(1,k/.35),fade=k<.5?1:1-(k-.5)/.5;ctx.save();ctx.lineCap='round';ctx.shadowColor=f.glow;ctx.shadowBlur=18;
  for(const [s,dl] of [[1,0],[-1,.12]]){const q=Math.max(0,Math.min(1,(k-dl)/.3));if(!q)continue;const x0=b.x-L*s,y0=b.y-L*.8,x1=x0+2*L*s*q,y1=y0+1.6*L*q;ctx.globalAlpha=fade;ctx.strokeStyle=f.glow;ctx.lineWidth=pxU*.22;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();ctx.strokeStyle=f.color;ctx.lineWidth=pxU*.08;ctx.stroke();}
  if(k>.3){const q=(k-.3)/.7;ctx.globalAlpha=(1-q);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x,b.y,pxU*.3*(1-q)+2,0,7);ctx.fill();}ctx.restore();ctx.globalAlpha=1;return true;}
 if(f.k==='msmash'){const b=proj(f.to.x,f.to.y,.3),top=proj(f.to.x,f.to.y,2.2),hit=.35;ctx.save();ctx.lineCap='round';
  if(k<hit+.15){const q=Math.min(1,k/hit),R=(b.y-top.y)*.55,cx=(b.x+top.x)/2+pxU*.35,cy=(b.y+top.y)/2,a1=-Math.PI*.9+Math.PI*1.05*q*q;ctx.shadowColor=f.glow;ctx.shadowBlur=18;taperArc(cx,cy,R*.8,R,a1-1.3,a1,pxU*.3,f.glow,.8);ctx.shadowBlur=0;taperArc(cx,cy,R*.8,R,a1-1.3,a1,pxU*.11,f.color,1);}
  if(k>=hit){const q=(k-hit)/(1-hit);ctx.globalAlpha=1-q;ctx.strokeStyle=f.glow;ctx.lineWidth=5*(1-q)+1;ellipse(f.to.x,f.to.y,.25+.85*q,.02);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2;ellipse(f.to.x,f.to.y,.15+.6*q,.02);ctx.stroke();
   for(let i=0;i<9;i++){const an=f.seed+i*.7,d=pxU*(.2+.75*q)*(.6+(i%3)*.25),up=pxU*.5*Math.sin(Math.min(1,q*1.5)*Math.PI);ctx.globalAlpha=(1-q)*.8;ctx.fillStyle=i%2?'rgba(170,140,100,.9)':'rgba(220,200,160,.9)';ctx.beginPath();ctx.arc(b.x+Math.cos(an)*d,b.y+Math.sin(an)*d*SIN-up*(i%2?1:.5),3+(i%3),0,7);ctx.fill();}}
  ctx.restore();ctx.globalAlpha=1;return true;}
 if(f.k==='mstab'){if(f.t<(f.delay||0))return true;const q=Math.min(1,(f.t-(f.delay||0))/f.dur),a=proj(f.from.x,f.from.y,.65),b=proj(f.to.x,f.to.y,.6),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d,o=f.off*pxU,
   reach=Math.min(1,q/.45),x0=a.x+dx*.15+nx*o,y0=a.y+dy*.15+ny*o,x1=a.x+dx*(.15+1.05*reach)+nx*o,y1=a.y+dy*(.15+1.05*reach)+ny*o,fade=q<.5?1:1-(q-.5)/.5;
  ctx.save();ctx.lineCap='round';ctx.globalAlpha=fade*.55;ctx.strokeStyle=f.glow;ctx.lineWidth=pxU*(f.spear?.2:.14);ctx.shadowColor=f.glow;ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
  ctx.globalAlpha=fade;ctx.strokeStyle=f.color;ctx.lineWidth=pxU*(f.spear?.07:.045);ctx.beginPath();ctx.moveTo(x0+(x1-x0)*.3,y0+(y1-y0)*.3);ctx.lineTo(x1,y1);ctx.stroke();
  if(reach>=1){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x1,y1,pxU*.09*fade+1,0,7);ctx.fill();}ctx.restore();ctx.globalAlpha=1;return true;}
 if(f.k==='xmark'){const b=proj(f.x,f.y,.9),L=pxU*.32*(k<.2?k/.2:1);ctx.save();ctx.globalAlpha=k<.6?1:1-(k-.6)/.4;ctx.lineCap='round';ctx.strokeStyle='#ff3b3b';ctx.shadowColor='#ff0000';ctx.shadowBlur=12;ctx.lineWidth=5;
  ctx.beginPath();ctx.moveTo(b.x-L,b.y-L);ctx.lineTo(b.x+L,b.y+L);ctx.moveTo(b.x+L,b.y-L);ctx.lineTo(b.x-L,b.y+L);ctx.stroke();ctx.restore();ctx.globalAlpha=1;return true;}
 // the moment a 필살기 is charged: a beam drops onto the hero and a ring of light spreads from its feet, once
 if(f.k==='readyburst'){const g=proj(f.x,f.y,f.h),top=-10;ctx.save();ctx.globalCompositeOperation='lighter';
  if(k<.45){const q=k/.45,w=pxU*(.55-.35*q),gr=ctx.createLinearGradient(0,top,0,g.y);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.75,f.color);gr.addColorStop(1,'#ffffff');ctx.globalAlpha=1-q;ctx.fillStyle=gr;ctx.fillRect(g.x-w/2,top,w,g.y-top);}
  const q=Math.min(1,k/.8);ctx.globalAlpha=(1-q)*.9;ctx.strokeStyle=f.color;ctx.lineWidth=4*(1-q)+1;ellipse(f.x,f.y,.2+1.1*q,f.h);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#fff';ellipse(f.x,f.y,.1+.75*q,f.h);ctx.stroke();
  for(let i=0;i<10;i++){const an=i*.63,d=pxU*(.3+.9*q),p=proj(f.x,f.y,f.h+q*1.4*(.5+(i%3)*.3));ctx.globalAlpha=1-q;ctx.fillStyle=i%2?'#fff':f.color;ctx.beginPath();ctx.arc(p.x+Math.cos(an)*d*.6,p.y+Math.sin(an)*d*.2,2.4,0,7);ctx.fill();}
  ctx.restore();ctx.globalAlpha=1;return true;}
 return false;}
// A charged hero: a soft halo and motes rising around the body in the hero's colour, and a small crest over the head (no ring).
function drawReady(u,gy,time){const c=heroColor(u),body=proj(u.x,u.y,gy+.75),pulse=.5+.5*Math.sin(time*3+u.id);ctx.save();ctx.globalCompositeOperation='lighter';
 const R=pxU*(.62+.06*pulse),g=ctx.createRadialGradient(body.x,body.y,0,body.x,body.y,R);g.addColorStop(0,c+'55');g.addColorStop(.55,c+'26');g.addColorStop(1,c+'00');ctx.fillStyle=g;ctx.globalAlpha=.75+.25*pulse;ctx.beginPath();ctx.ellipse(body.x,body.y,R*.8,R,0,0,7);ctx.fill();
 for(let j=0;j<9;j++){const ph=(time*.7+j/9+u.id*.13)%1,an=j*2.4+time*1.3,r=.22+.12*Math.sin(j*1.7),p=proj(u.x+Math.cos(an)*r,u.y+Math.sin(an)*r,gy+.05+ph*1.7);ctx.globalAlpha=Math.sin(ph*Math.PI)*.95;ctx.fillStyle=j%3?c:'#ffffff';ctx.beginPath();ctx.arc(p.x,p.y,1.6+1.4*(1-ph),0,7);ctx.fill();}
 ctx.restore();
 // crest: a small diamond with a glint sweeping across it every couple of seconds
 const b=proj(u.x,u.y,gy+2.3),bob=Math.sin(time*2.6+u.id)*2.5,x=b.x,y=b.y+bob,h=9,w=6.5;ctx.save();ctx.shadowColor=c;ctx.shadowBlur=10+6*pulse;ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+w,y);ctx.lineTo(x,y+h);ctx.lineTo(x-w,y);ctx.closePath();
 const gg=ctx.createLinearGradient(x-w,y-h,x+w,y+h);gg.addColorStop(0,'#ffffff');gg.addColorStop(.45,c);gg.addColorStop(1,'rgba(40,30,20,.9)');ctx.fillStyle=gg;ctx.fill();ctx.shadowBlur=0;ctx.lineWidth=1.2;ctx.strokeStyle='rgba(20,14,8,.85)';ctx.stroke();
 const sw=((time+u.id*.37)%2.2)/.5;if(sw<1){ctx.clip();ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=3;const sx=x-w*1.6+sw*w*3.2;ctx.beginPath();ctx.moveTo(sx-4,y+h);ctx.lineTo(sx+4,y-h);ctx.stroke();}ctx.restore();}
// A charged hero's body glows: its toon material gets a pulsing emissive in the hero's colour (a per-unit copy of the shared material).
function readyGlow(u,o,time){const on=ultReady(u);if(!on&&!o.glowing)return;
 if(!o.glowMat){o.glowMat=M.sharedMat.clone();o.glowMeshes=[];o.g.traverse(m=>{if(m.isMesh&&m.material===M.sharedMat)o.glowMeshes.push(m);});}
 if(on){if(!o.glowing){for(const m of o.glowMeshes)m.material=o.glowMat;o.glowing=true;}const k=.22+.16*(.5+.5*Math.sin(time*3+u.id));o.glowMat.emissive.set(heroColor(u)).multiplyScalar(k);}
 else{for(const m of o.glowMeshes)m.material=M.sharedMat;o.glowing=false;}}

// ── 1.7.0: 명당, 연계, 수정 조각 and the element flourishes of 필살기 ──
const SHARD_SECONDS=5,CHAIN_SECONDS=3;
// 명당: one high-ground tile and one road tile per battle shine gold; rising motes, and a label while preparing/placing.
function drawVantage(time){if(demo.on||!S.vantage)return;for(const v of S.vantage){const t=S.map.tile(v.c,v.r);if(!t)continue;const h=tileTop(t),pulse=.5+.5*Math.sin(time*3),occ=S.units.find(u=>u.c===v.c&&u.r===v.r),want=selCard&&(D.UNITS[selCard].melee?v.kind==='melee':v.kind==='ranged');
  ctx.save();ctx.shadowColor='#ffcc55';ctx.shadowBlur=want?22:12;tileQuad(v.c,v.r,h);ctx.fillStyle=`rgba(255,205,90,${(want?.32:.16)+.14*pulse})`;ctx.fill();ctx.strokeStyle=`rgba(255,225,130,${.6+.4*pulse})`;ctx.lineWidth=want?4:2.5;ctx.stroke();ctx.restore();
  for(let j=0;j<6;j++){const ph=(time*.55+j/6)%1,ox=Math.sin(j*2.4+v.c)*.34,oy=Math.cos(j*1.7+v.r)*.34,p=proj(v.c+ox,v.r+oy,h+ph*1.4);ctx.globalAlpha=(1-ph)*.95;ctx.fillStyle=j%2?'#fff3c4':'#ffd76a';ctx.beginPath();ctx.arc(p.x,p.y,2.4,0,7);ctx.fill();}ctx.globalAlpha=1;
  if(!occ&&(S.phase==='prep'||want)){const g=proj(v.c,v.r,h+1);pill(g.x,g.y,v.kind==='ranged'?'✦ 명당 · 원거리':'✦ 명당 · 근접','rgba(120,85,10,.92)','#ffe9a8');}}}
// 연계: after a 필살기 the next one within 3 s is stronger. A gold bar counts the window down; ready cards flash gold.
const chainEl=(()=>{const el=document.createElement('div');el.id='chainBar';el.hidden=true;el.innerHTML='<b></b><div><i></i></div>';$('#viewport').appendChild(el);return el;})();
function chainTick(){const left=!demo.on&&S.phase==='battle'?CHAIN_SECONDS-(S.time-S.lastUlt):0,on=left>0&&S.units.some(u=>ultReady(u));if(chainEl.hidden===on)chainEl.hidden=!on;
 for(const c of document.querySelectorAll('#dock .card'))c.classList.toggle('chain',on&&c.classList.contains('ult'));
 if(on){const n=S.chain+2,t=`⛓ ${n} 연계 · 지금 필살기 +${15*Math.min(2,S.chain+1)}%`;if(chainEl.firstChild.textContent!==t)chainEl.firstChild.textContent=t;chainEl.lastChild.firstChild.style.width=(left/CHAIN_SECONDS*100).toFixed(1)+'%';}}
// 수정 조각: falls from the sky in a pillar of light, then floats above the dock. Drag it onto a hero (card or on the field), or tap it
// and then tap a hero. The game runs at quarter speed meanwhile; after 5 s it goes to a hero at random.
const shardEl=(()=>{const el=document.createElement('div');el.id='shard';el.hidden=true;el.innerHTML='<div class="gem"></div><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/></svg><b>5</b><span>영웅에게 끌어다 놓기</span>';app.appendChild(el);return el;})();
function placeShard(cx,cy){const a=app.getBoundingClientRect();shardEl.style.left=(cx-a.left)+'px';shardEl.style.top=(cy-a.top)+'px';}
let shardDrag=null;
function shardRest(){const r=viewport.getBoundingClientRect();return {x:vw/2,y:vh-58,cx:r.left+vw/2,cy:r.top+vh-58};}
function shardTick(real,hold){if(!shardUi)return;if(shardUi.phase==='fly'){shardUi.t+=real;if(shardUi.t>.5)shardUi=null;return;}
 if(!S.shard&&shardUi.phase!=='fall'){shardUi=null;shardEl.hidden=true;shardEl.classList.remove('drag','picking');hudKey='';return;}
 if(shardUi.phase==='fall'){shardUi.t+=real;if(shardUi.t>=1.15){shardUi.phase='wait';const rr=shardRest();placeShard(rr.cx,rr.cy);shardEl.hidden=false;shardEl.classList.remove('drag','picking');sfx('blessing',{force:true});addFx({k:'sring',real:true,x:0,y:0,screen:shardRest(),dur:.5,color:'#9ff5ff',r:1});hudKey='';}return;}
 if(!hold)shardUi.left-=real;const n=Math.max(0,Math.ceil(shardUi.left));const b=shardEl.querySelector('b');if(b.textContent!==String(n))b.textContent=n;
 shardEl.querySelector('circle').style.strokeDashoffset=(119.4*(1-Math.max(0,shardUi.left)/SHARD_SECONDS)).toFixed(1);
 if(shardUi.left<=0)S.giveShard(null);}
function giveShardTo(id){if(!S||!S.shard)return;const err=S.giveShard(id);if(err){toast(err);sfx('ui_error');}}
function shardGiven(e){const from=shardDrag?.at||shardRest();shardDrag=null;shardEl.hidden=true;shardEl.classList.remove('drag','picking');const u=S.units.find(v=>v.id===e.unit);
 shardUi={phase:'fly',t:0};hudKey='';if(!u)return;addFx({k:'shardfly',real:true,from:{x:from.x,y:from.y},x:u.x,y:u.y,dur:.45});
 setTimeout(()=>{if(!S)return;addFx({k:'ultblast',real:true,x:u.x,y:u.y,dur:.8,color:'#8ff3ff',r:1.3,seed:Math.random()*6});addFx({k:'label',real:true,x:u.x,y:u.y,h:2.3,text:`💎 ${D.UNITS[u.def].name} 필살기 충전 ×2`,color:'#bdf8ff',dur:1.5,size:16});sfx('legacy',{force:true});},450);}
// hero under a screen point (field) or under a dock card
function heroAt(cx,cy){const el=document.elementFromPoint(cx,cy),card=el&&el.closest&&el.closest('#dock .card');if(card){const u=S.units.find(v=>v.def===card.dataset.id&&v.ult);return u||null;}
 const r=viewport.getBoundingClientRect(),x=cx-r.left,y=cy-r.top;let best=null;for(const u of S.units){if(!u.ult)continue;const s=proj(u.x,u.y,groundY(u.x,u.y)+.5),d=Math.hypot(s.x-x,s.y-y);if(d<pxU*.8&&(!best||d<best.d))best={u,d};}return best&&best.u;}
shardEl.addEventListener('pointerdown',e=>{if(!shardUi||shardUi.phase==='fall'||modalOpen)return;e.preventDefault();e.stopPropagation();sfx('ui_tap');shardDrag={x:e.clientX,y:e.clientY,moved:false};try{shardEl.setPointerCapture(e.pointerId);}catch(_){} });
shardEl.addEventListener('pointermove',e=>{if(!shardDrag)return;if(!shardDrag.moved&&Math.hypot(e.clientX-shardDrag.x,e.clientY-shardDrag.y)>8){shardDrag.moved=true;shardEl.classList.add('drag');shardEl.classList.remove('picking');}
 if(shardDrag.moved){const r=viewport.getBoundingClientRect();placeShard(e.clientX,e.clientY);shardDrag.at={x:e.clientX-r.left,y:e.clientY-r.top};
  const u=heroAt(e.clientX,e.clientY);for(const c of document.querySelectorAll('#dock .card'))c.classList.toggle('drop',!!u&&c.dataset.id===u.def);shardDrag.over=u?u.id:null;}});
shardEl.addEventListener('pointerup',e=>{if(!shardDrag)return;const d=shardDrag;for(const c of document.querySelectorAll('#dock .card'))c.classList.remove('drop');
 if(d.moved){const rr=shardRest();placeShard(rr.cx,rr.cy);shardEl.classList.remove('drag');const u=heroAt(e.clientX,e.clientY);if(u){giveShardTo(u.id);return;}shardDrag=null;return;}
 shardDrag=null;shardEl.classList.toggle('picking');if(shardEl.classList.contains('picking'))toast('수정 조각을 줄 영웅을 누르세요');});
// two-tap: shard selected, then a hero card or a hero on the field
function shardPicking(){return !!(shardUi&&shardEl.classList.contains('picking')&&S.shard);}
// Element flourishes of a 필살기 (drawn on top of the shared impact) and the other 1.7.0 effects. Returns true when it drew f.
function drawFx2(f,k){
 if(f.k==='elemfx'){if(f.t<(f.delay||0))return true;const q=Math.min(1,(f.t-(f.delay||0))/f.dur),p=proj(f.x,f.y,0),R=f.r*pxU,el=f.el;ctx.save();ctx.lineCap='round';
  if(el==='fire'){for(let i=0;i<18;i++){const a=f.seed+i*2.39,d=((i*53)%17)/17,x=p.x+Math.cos(a)*R*d,y=p.y+Math.sin(a)*R*d*SIN,rise=pxU*(.4+1.4*q)*(.6+((i*7)%5)/8),sz=pxU*(.22+.12*Math.sin(i))*(1-q*.7);
    const g=ctx.createRadialGradient(x,y-rise,0,x,y-rise,sz*1.6);g.addColorStop(0,'rgba(255,250,200,'+(1-q)+')');g.addColorStop(.4,'rgba(255,140,40,'+(.9*(1-q))+')');g.addColorStop(1,'rgba(200,40,10,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y-rise,sz,sz*1.7,0,0,7);ctx.fill();}}
  else if(el==='ice'||el==='water'){const grow=Math.min(1,q*4),fade=q<.6?1:1-(q-.6)/.4;for(let i=0;i<11;i++){const a=f.seed+i*2.1,d=.15+((i*31)%11)/13,x=p.x+Math.cos(a)*R*d,y=p.y+Math.sin(a)*R*d*SIN,h=pxU*(.6+((i*13)%7)/8)*grow,w=pxU*.13;
    ctx.globalAlpha=fade;ctx.fillStyle=el==='ice'?'rgba(200,245,255,.92)':'rgba(120,205,255,.9)';ctx.beginPath();ctx.moveTo(x-w,y);ctx.lineTo(x+Math.sin(i)*w*.6,y-h);ctx.lineTo(x+w,y);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}
   ctx.globalAlpha=fade*.35;ctx.fillStyle='#d8f7ff';ctx.beginPath();ctx.ellipse(p.x,p.y,R,R*SIN,0,0,7);ctx.fill();}
  else if(el==='wind'){for(let j=0;j<3;j++){ctx.globalAlpha=(1-q)*.9;ctx.strokeStyle=j%2?'#ffffff':'#a6f2c6';ctx.lineWidth=4-j;ctx.beginPath();for(let s=0;s<=40;s++){const a=f.seed+j*2.1+s*.22+q*9,rr=R*(.15+s/40*.95)*(.6+.4*q);const x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*SIN-pxU*(s/40)*1.2*(1-q*.4);s?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}}
  else if(el==='thunder'){if(q<.55)for(let j=0;j<5;j++){if(((f.t*30+j*3)|0)%3===0)continue;const a=f.seed+j*1.3,d=((j*29)%7)/7,x=p.x+Math.cos(a)*R*d,y=p.y+Math.sin(a)*R*d*SIN;ctx.globalAlpha=1-q/.55;ctx.shadowColor='#ffe66b';ctx.shadowBlur=18;ctx.strokeStyle=j%2?'#fffbe0':'#ffe66b';ctx.lineWidth=j%2?3:5;
    ctx.beginPath();let yy=y-pxU*4;ctx.moveTo(x,yy);for(let s=1;s<=6;s++){yy=y-pxU*4*(1-s/6);ctx.lineTo(x+(s<6?Math.sin(s*5.1+j+f.t*40)*pxU*.3:0),yy);}ctx.stroke();}}
  else if(el==='dark'){ctx.globalAlpha=(1-q)*.55;const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,R*1.1);g.addColorStop(0,'rgba(20,0,40,.95)');g.addColorStop(1,'rgba(90,40,160,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,R*1.1,R*1.1*SIN,0,0,7);ctx.fill();
   for(let j=0;j<4;j++){ctx.globalAlpha=(1-q)*.9;ctx.strokeStyle=j%2?'#c7a3ff':'#7a3cff';ctx.lineWidth=3;const rr=R*(1-((q*1.4+j/4)%1));ctx.beginPath();ctx.ellipse(p.x,p.y,rr,rr*SIN,f.seed+q*6+j,0,4.2);ctx.stroke();}}
  else if(el==='light'){const top=-20;for(let j=0;j<5;j++){const a=f.seed+j*1.25,d=j?((j*37)%9)/9:0,x=p.x+Math.cos(a)*R*d*.8,w=pxU*(j?.22:.55)*(1-q*.6);ctx.globalAlpha=(1-q)*(j?.55:.75);const g=ctx.createLinearGradient(0,top,0,p.y);g.addColorStop(0,'rgba(255,250,220,0)');g.addColorStop(.7,'rgba(255,246,200,.85)');g.addColorStop(1,'#ffffff');ctx.fillStyle=g;ctx.fillRect(x-w/2,top,w,p.y-top);}}
  else{for(let j=0;j<10;j++){const a=f.seed+j*.63;ctx.globalAlpha=1-q;ctx.strokeStyle='#ffe9a8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*R*.3*q,p.y+Math.sin(a)*R*.3*q*SIN);ctx.lineTo(p.x+Math.cos(a)*R*(.4+q),p.y+Math.sin(a)*R*(.4+q)*SIN);ctx.stroke();}}
  ctx.restore();ctx.globalAlpha=1;return true;}
 if(drawFx3(f,k))return true;
 if(f.k==='chainpop'){const pop=k<.15?.5+k/.15*.8:k<.3?1.3-(k-.15)/.15*.3:1,a=k<.75?1:1-(k-.75)/.25,x=vw/2,y=vh*.36;ctx.save();ctx.globalAlpha=a;ctx.textBaseline='middle';
  ctx.font=`400 ${Math.round(44*pop)}px ${FONT}`;ctx.shadowColor='#ffb020';ctx.shadowBlur=26;ctx.lineWidth=7;ctx.strokeStyle='rgba(60,25,0,.95)';const t=`${f.n} 연계!`;ctx.strokeText(t,x,y);ctx.fillStyle='#ffd257';ctx.fillText(t,x,y);
  ctx.shadowBlur=0;ctx.font=`400 ${Math.round(20*pop)}px ${FONT}`;ctx.lineWidth=5;ctx.strokeText(`필살기 위력 +${f.pct}%`,x,y+38*pop);ctx.fillStyle='#fff3c4';ctx.fillText(`필살기 위력 +${f.pct}%`,x,y+38*pop);
  ctx.globalAlpha=a*(1-k);ctx.strokeStyle='#ffd257';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(x,y,90+k*160,(90+k*160)*.35,0,0,7);ctx.stroke();ctx.restore();ctx.textBaseline='alphabetic';return true;}
 if(f.k==='shardfly'){const b=proj(f.x,f.y,groundY(f.x,f.y)+.8),e=1-Math.pow(1-k,2),x=f.from.x+(b.x-f.from.x)*e,y=f.from.y+(b.y-f.from.y)*e-Math.sin(k*Math.PI)*60;ctx.save();ctx.shadowColor='#7ff3ff';ctx.shadowBlur=20;ctx.fillStyle='#d8fbff';
  ctx.beginPath();ctx.moveTo(x,y-14);ctx.lineTo(x+9,y);ctx.lineTo(x,y+14);ctx.lineTo(x-9,y);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(140,245,255,.6)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(f.from.x+(x-f.from.x)*.6,f.from.y+(y-f.from.y)*.6);ctx.stroke();ctx.restore();return true;}
 if(f.k==='sring'){const p=f.screen,R=40+k*90;ctx.globalAlpha=1-k;ctx.strokeStyle=f.color;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(p.x,p.y,R,R*.5,0,0,7);ctx.stroke();ctx.globalAlpha=1;return true;}
 return false;}
// The shard's fall: a pillar of light from the top of the battlefield, the crystal riding down it, a flash where it lands.
function drawShardFall(){if(!shardUi||shardUi.phase!=='fall')return;const t=shardUi.t,k=Math.min(1,t/1.15),{x,y}=shardRest(),gy=-30+(y+30)*Math.pow(k,2.2);ctx.save();
 const w=26+40*Math.sin(Math.min(1,k*1.4)*Math.PI*.5),g=ctx.createLinearGradient(0,0,0,y);g.addColorStop(0,'rgba(160,245,255,0)');g.addColorStop(.5,'rgba(170,245,255,.35)');g.addColorStop(1,'rgba(230,255,255,.75)');ctx.globalAlpha=.5+.5*Math.sin(k*Math.PI);ctx.fillStyle=g;ctx.fillRect(x-w/2,0,w,y);
 ctx.globalAlpha=1;ctx.shadowColor='#7ff3ff';ctx.shadowBlur=30;const s=16+6*k,rot=t*6;ctx.translate(x,gy);ctx.rotate(Math.sin(rot)*.25);const gg=ctx.createLinearGradient(-s,-s*1.5,s,s*1.5);gg.addColorStop(0,'#ffffff');gg.addColorStop(.5,'#8ff3ff');gg.addColorStop(1,'#2aa7d8');ctx.fillStyle=gg;
 ctx.beginPath();ctx.moveTo(0,-s*1.6);ctx.lineTo(s,0);ctx.lineTo(0,s*1.6);ctx.lineTo(-s,0);ctx.closePath();ctx.fill();ctx.setTransform(dpr,0,0,dpr,0,0);
 for(let i=0;i<14;i++){const ph=(t*1.6+i/14)%1,sx=x+Math.sin(i*2.7)*(14+30*ph),sy=gy-ph*120+20;ctx.globalAlpha=(1-ph)*.9;ctx.fillStyle=i%2?'#ffffff':'#9ff5ff';ctx.beginPath();ctx.arc(sx,sy,2.2,0,7);ctx.fill();}
 if(k>.85){const q=(k-.85)/.15;ctx.globalAlpha=1-q;ctx.fillStyle='rgba(220,255,255,.5)';ctx.fillRect(0,0,vw,vh);}ctx.restore();ctx.globalAlpha=1;}

let lastTime=0;
function frame(now){requestAnimationFrame(frame);const real=Math.min(.05,(now-lastTime)/1000||0);lastTime=now;if(!S){bgm.setDuck(1);ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,fxc.width,fxc.height);renderer.render(scene,camera);return;}
 if(hitStop>0)hitStop=Math.max(0,hitStop-real);const busy=S.phase==='battle'&&(selCard||selUnit||aiming||pickEl!=null||(shardUi&&shardUi.phase!=='fly')),scale=demo.on?(hitStop>0?.12:1):paused||modalOpen?0:speed*(busy?.25:1)*(hitStop>0?.12:1);if(demo.on)demo.tick(real);if(!S)return;
 bgm.setDuck(!demo.on&&(S.phase==='prep'||S.phase==='battle'||S.phase==='bless')&&(paused||modalOpen)?.4:1);
 if(scale>0)S.step(real*scale);handleEvents();if(!S)return;shardTick(real,paused||modalOpen);chainTick();if(pickEl!=null&&!ultReady(S.units.find(v=>v.id===pickEl)))closeElPick();
 const t=now/1000;syncObjects(real*(scale>0?Math.max(1,scale):1),t);if(water)water.material.uniforms.uTime.value=t;for(const f of animated)f(t);
 if(shakeT>0){shakeT=Math.max(0,shakeT-real);const m=shakeT*14;viewport.style.transform=`translate(${(Math.random()-.5)*m}px,${(Math.random()-.5)*m}px)`;}else if(viewport.style.transform)viewport.style.transform='';
 renderer.render(scene,camera);drawOverlay(real*(scale>0?Math.max(.5,scale):.5),t,real);if(!demo.on)drawShardFall();updateHud();}

makePortraits();resize();showTitle();requestAnimationFrame(frame);
if(document.fonts&&document.fonts.load){document.fonts.load('16px "Stylish"');document.fonts.load('16px "Gowun Dodum"');}
// Revision history opens inside the game (iframe), so the page and the music keep playing.
function showRevisions(){if($('#revisionsView'))return;const view=document.createElement('div');view.id='revisionsView';view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');
 view.innerHTML=`<iframe src="revisions.html?v=${GAME_VERSION}" title="Revision History"></iframe><button id="closeRevisions" aria-label="닫기">×</button>`;app.append(view);
 const close=()=>{view.remove();window.removeEventListener('message',onMessage);document.removeEventListener('keydown',onKey);},onKey=e=>{if(e.key==='Escape')close();},
  onMessage=e=>{if(e.origin===location.origin&&e.data==='td:close-revisions')close();};
 document.addEventListener('keydown',onKey);window.addEventListener('message',onMessage);$('#closeRevisions').onclick=close;}
window.TD={bgm,closeModal,get sim(){return S;},get objs(){return objs;},startChapter,renderGuide,version:GAME_VERSION,proj:(x,y,h)=>proj(x,y,h)};
})();
