// cnation TD screen: 3D battlefield (three.js, fixed tilted top view), 2D overlay (bars, effects, ranges), dock, panels, music, saves.
// All rules live in sim.js; this file only sends commands to it and draws what it reports.
(function(){
const THREE=CNATION3D,D=TDData,M=TDModels,{createSim,TERRAIN_NAME}=TDSim;
const GAME_VERSION='0.2.2',SAVE_KEY='cnation-td-save-v2',SLOT_KEY='cnation-td-slots-v1',CLEAR_KEY='cnation-td-clear-v1',SET_KEY='cnation-td-settings-v1',SLOTS=3;
const $=s=>document.querySelector(s),app=$('#app'),viewport=$('#viewport'),glc=$('#gl'),fxc=$('#fx'),ctx=fxc.getContext('2d');
const ELEV=54*Math.PI/180,SIN=Math.sin(ELEV),COS=Math.cos(ELEV);
const EL_COLOR={fire:'#ff8a3d',water:'#6fd0ff',ice:'#a9ecff',wind:'#a6f2c6',thunder:'#ffe66b',light:'#fff3b0',dark:'#c7a3ff'};
const ST_COLOR={burn:'#ff8a3d',freeze:'#a9ecff',slow:'#6fa8ff',stun:'#ffe66b',defdown:'#d79cff',poison:'#9be25a',sleep:'#c0a2f0',silence:'#ec81c0',root:'#c9a36a'};
const ST_NAME={burn:'화상',freeze:'빙결',slow:'둔화',stun:'기절',defdown:'방어↓',poison:'독',sleep:'수면',silence:'침묵',root:'속박'};
const FONT='"Stylish",system-ui,sans-serif';

let S=null,speed=1,paused=false,selCard=null,selUnit=null,aiming=null,hover=null,dragging=false,validTiles=null,modalOpen=false,devMode=false,lastSnap=null;
let vw=1,vh=1,pxU=40,tz=.25,dpr=1;
const objs=new Map(),dying=[],fx=[],warns=new Map();
const loadJSON=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??d;}catch(e){return d;}},saveJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const settings=Object.assign({bgm:.5,sfx:true},loadJSON(SET_KEY,{}));

// ── Renderer ──
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:glc,antialias:true,powerPreference:'high-performance'});}
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
function resize(){const r=viewport.getBoundingClientRect();vw=Math.max(1,r.width);vh=Math.max(1,r.height);dpr=Math.min(2,window.devicePixelRatio||1);
 renderer.setPixelRatio(dpr);renderer.setSize(vw,vh,false);fxc.width=Math.round(vw*dpr);fxc.height=Math.round(vh*dpr);
 const w=S?S.map.w:9,h=S?S.map.h:14;pxU=Math.min(vw/(w+.25),vh/(h*SIN+2.6));const hw=vw/(2*pxU),hh=vh/(2*pxU);
 camera.left=-hw;camera.right=hw;camera.top=hh;camera.bottom=-hh;camera.position.set(0,60*SIN,tz+60*COS);camera.lookAt(0,0,tz);camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);

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
function buildTerrain(){disposeGroup(terrainGroup);animated=[];const map=S.map,sc=map.scene,rand=D.seeded(map.seed*31+7),W=map.w,H=map.h;
 scene.background=new THREE.Color(sc.sky);
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
 mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.receiveShadow=true;mesh.castShadow=true;terrainGroup.add(mesh);
 // Monster gates: a dark stone arch with red banners and a glowing rift, one per road.
 const basic=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});
 map.paths.forEach((path,pi)=>{if(first.findIndex(f=>f[0]===path.wp[0][0]&&f[1]===path.wp[0][1])!==pi)return;const [fc,fr]=path.wp[0],seg=path.segs[0],g=new THREE.Group(),gp=[];
  for(const s of [-1,1]){gp.push(['box',[s*.62,.85,0],[.34,1.7,.4],0x4a4652],['rock',[s*.62,1.8,0],[.24,.22,.24],0x38343f],['cone',[s*.62,2.1,0],[.12,.4,.12],0xb5332e],['box',[s*.62,1.05,.22],[.2,.7,.03],0xc0362f],['cone',[s*.62,.62,.22],[.1,.2,.02],0xc0362f,Math.PI]);}
  gp.push(['box',[0,1.82,0],[1.7,.28,.42],0x4a4652],['rock',[0,2.08,0],[.2,.2,.2],0xd94a3d],['cone',[-.3,2.05,0],[.08,.3,.08],0x38343f],['cone',[.3,2.05,0],[.08,.3,.08],0x38343f]);
  const arch=new THREE.Mesh(M.bake(gp),M.sharedMat);arch.castShadow=true;g.add(arch);const rift=new THREE.Mesh(new THREE.PlaneGeometry(.95,1.55),basic(0xff3b2f,.6));rift.position.set(0,.85,0);g.add(rift);
  const glow=new THREE.Mesh(new THREE.CircleGeometry(.75,24),basic(0xff5a3c,.35));glow.rotation.x=-Math.PI/2;glow.position.set(0,.03,.45);g.add(glow);
  const side=fc<0||fc>=W,off=side?.72:.35;g.position.set(wx(fc)+seg.dx*off,-.07,wz(fr)+seg.dy*off);g.rotation.y=Math.atan2(seg.dx,seg.dy);terrainGroup.add(g);animated.push(t=>{rift.material.opacity=.45+.25*Math.sin(t*3+pi);glow.material.opacity=.22+.16*Math.sin(t*3+pi);});});
 // The Arca crystal: stepped dais, a big floating crystal, a pillar of light.
 {const [lc,lr]=last,inside=!!map.tile(lc,lr),x=wx(lc),z=inside?wz(lr):wz(H-1)+.62,g=new THREE.Group(),dp=[['cyl',[0,.06,0],[.78,.12,.78],0xdfe6dc],['cyl',[0,.18,0],[.6,.12,.6],0xcfd8cd],['cyl',[0,.3,0],[.42,.12,.42],0xeef4ea]];
  for(let i=0;i<4;i++){const an=i*Math.PI/2+Math.PI/4;dp.push(['rock',[Math.cos(an)*.62,.34,Math.sin(an)*.62],[.1,.24,.1],0x9be6d2]);}
  const dais=new THREE.Mesh(M.bake(dp),M.sharedMat);dais.castShadow=true;dais.receiveShadow=true;g.add(dais);
  const gem=new THREE.Mesh(M.bake([['rock',[0,0,0],[.34,.62,.34],0x7ff0d2],['rock',[0,0,0],[.22,.46,.22],0xe8fff6]]),M.sharedMat);gem.position.y=1.15;gem.castShadow=true;g.add(gem);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.3,.42,4.2,16,1,true),basic(0x9ffbe0,.22));beam.position.y=2.3;g.add(beam);
  const halo=new THREE.Mesh(new THREE.RingGeometry(.8,.98,32),basic(0x7ff0d2,.6));halo.rotation.x=-Math.PI/2;halo.position.y=.035;g.add(halo);
  g.position.set(x,inside?-.07:0,z);terrainGroup.add(g);animated.push(t=>{gem.rotation.y=t*.9;gem.position.y=1.15+Math.sin(t*2)*.08;beam.material.opacity=.16+.08*Math.sin(t*2.4);const s=1+.12*Math.sin(t*2.4);halo.scale.set(s,s,1);});}
 // Road curbs: a raised dark stone edge wherever the road meets other ground, so the route reads at a glance.
 {const isRoad=new Set(cells.filter(t=>t.road).map(t=>t.c+','+t.r)),edge=new THREE.Color(sc.road).multiplyScalar(.4).getHex(),lip=new THREE.Color(sc.road).multiplyScalar(.66).getHex(),T=.2;
  for(const t of cells){if(!t.road||t.terrain==='bridge')continue;const x=wx(t.c),z=wz(t.r),y=t.h;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){if(isRoad.has((t.c+dx)+','+(t.r+dz)))continue;const n=map.tile(t.c+dx,t.r+dz);if(n&&n.terrain==='water')continue;
    const ex=x+dx*(.5-T/2),ez=z+dz*(.5-T/2),size=dx?[T,.15,1.0]:[1.0,.15,T];parts.push(['box',[ex,y+.055,ez],size,edge]);
    parts.push(['box',[x+dx*(.5-T-.025),y+.005,z+dz*(.5-T-.025)],dx?[.07,.02,.98]:[.98,.02,.07],lip]);}}}
 const deco=new THREE.Mesh(M.bake(parts),M.sharedMat);deco.castShadow=true;deco.receiveShadow=true;terrainGroup.add(deco);
 water=M.makeWaterSurface(waterPlaces);if(water)terrainGroup.add(water);}

// ── Models ──
const protoCache=new Map();
function modelFor(key,spec){let p=protoCache.get(key);if(!p){p=M.figure(spec);p.traverse(o=>{o.userData.shared=true;if(o.isMesh&&o.material!==M.ghostMat)o.castShadow=o.geometry.type!=='RingGeometry'&&o.geometry.type!=='CircleGeometry';});if(p.children[2])p.children[2].visible=false;protoCache.set(key,p);}return p.clone();}
const unitSpec=def=>({...D.UNITS[def].model,team:'ally',name:D.UNITS[def].name});
const enemySpec=e=>({model:e.model,color:e.color,name:D.MONSTERS[e.kind].name,elite:e.elite,team:'enemy',scale:e.scale,boss:e.bossId!=null,bossId:e.bossId});
function clearObjects(){for(const o of objs.values())unitGroup.remove(o.g);objs.clear();for(const d of dying)unitGroup.remove(d.g);dying.length=0;fx.length=0;warns.clear();}
const portraits={};
function makePortraits(){const size=160,pr=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});pr.setSize(size,size,false);pr.outputColorSpace=THREE.SRGBColorSpace;
 const ps=new THREE.Scene(),pc=new THREE.OrthographicCamera(-.62,.62,.62,-.62,.1,20);ps.add(new THREE.HemisphereLight(0xe4f0ce,0x203844,2.4));const l=new THREE.DirectionalLight(0xffedc7,3);l.position.set(-3,6,4);ps.add(l);
 for(const id in D.UNITS){const g=M.figure(unitSpec(id));g.children.slice(1).forEach(c=>{c.visible=false;});g.rotation.y=.35;ps.add(g);pc.position.set(0,1.05,5);pc.lookAt(0,.72,0);pr.render(ps,pc);portraits[id]=pr.domElement.toDataURL('image/png');ps.remove(g);}
 pr.dispose();pr.forceContextLoss?.();}

// ── Sound: synthesized effect blips, and the cnation TACTICS soundtrack ──
let ac=null,lastHit=0;
function sfx(kind){if(!settings.sfx)return;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();const now=ac.currentTime;if(kind==='hit'){if(now-lastHit<.07)return;lastHit=now;}
 const P={hit:[190,90,.05,.05,'triangle'],place:[330,520,.12,.12,'sine'],coin:[880,1320,.08,.04,'sine'],rank:[440,880,.22,.12,'triangle'],leak:[220,70,.4,.2,'sawtooth'],ult:[120,640,.5,.16,'sawtooth'],win:[523,1046,.6,.14,'triangle'],err:[160,120,.12,.1,'square'],tap:[600,500,.04,.05,'sine'],heal:[660,990,.18,.06,'sine'],boss:[90,50,.7,.22,'sawtooth']}[kind];if(!P)return;
 const o=ac.createOscillator(),g=ac.createGain();o.type=P[4];o.frequency.setValueAtTime(P[0],now);o.frequency.exponentialRampToValueAtTime(P[1],now+P[2]);g.gain.setValueAtTime(P[3],now);g.gain.exponentialRampToValueAtTime(.001,now+P[2]);o.connect(g).connect(ac.destination);o.start(now);o.stop(now+P[2]+.02);}catch(e){}}
const BGM_FILES={1:'01. Title Theme',4:'04. Blades of the Young',5:'05. March of the Broken Banner',6:'06. When Kingdoms Fall',7:'07. Awakened Colossus',10:'10. Raise the Banner',12:'12. Where Our Journey Ends'};
const bgm={els:{},cur:null,want:null,unlocked:false,
 el(id){return this.els[id]||(this.els[id]=Object.assign(new Audio(`bgm/${encodeURIComponent(BGM_FILES[id])}_64k.webm`),{preload:'auto'}));},
 // Title music resumes where it stopped; battle and victory tracks start from the top.
 play(id,loop=true){this.want={id,loop};if(!this.unlocked||this.cur===id)return;const old=this.cur&&this.els[this.cur];if(old)old.pause();this.cur=id;const a=this.el(id);a.loop=loop;a.volume=settings.bgm*.5;if(id!==1)a.currentTime=0;a.onended=loop?null:()=>{if(this.cur===id){this.cur=null;this.play(1);}};const p=a.play();if(p)p.catch(()=>{this.cur=null;});},
 unlock(){if(this.unlocked)return;this.unlocked=true;if(this.want)this.play(this.want.id,this.want.loop);},
 volume(){for(const k in this.els)this.els[k].volume=settings.bgm*.5;if(this.cur){const a=this.els[this.cur];if(settings.bgm<=0)a.pause();else if(a.paused)a.play().catch(()=>{});}}};
window.addEventListener('pointerdown',()=>bgm.unlock(),{capture:true});
document.addEventListener('visibilitychange',()=>{const a=bgm.cur&&bgm.els[bgm.cur];if(a){if(document.hidden)a.pause();else if(settings.bgm>0)a.play().catch(()=>{});}if(document.hidden&&S&&S.phase==='battle'){paused=true;hudKey='';}});
const battleTrack=()=>S.chapter.battles[S.battle]?.boss?7:[4,5,6][(S.chapterIndex+Math.floor(S.battle/3))%3];

// ── HUD, strip, dock, panel ──
let toastTimer=0;function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),2000);}
let bannerTimer=0;function banner(small,strong){const b=$('#banner');b.children[0].textContent=small;b.children[1].textContent=strong;b.classList.add('on');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>b.classList.remove('on'),1700);}
let hudKey='';
function updateHud(){const key=[S.life,S.gold,S.units.length,S.battle,S.phase,Math.ceil(S.prep),S.enemies.length+S.queue.length,speed,paused].join('|');if(key===hudKey)return;hudKey=key;
 $('#hudLife').textContent=S.life;$('#hudGold').textContent=S.gold;$('#hudUnits').textContent=`${S.units.length}/${S.chapter.command}`;
 const b=S.chapter.battles[S.battle];$('#hudBattle').textContent=`${S.battle+1}/${S.chapter.battles.length} ${b?b.name:''}`;
 $('#speedBtn').textContent='×'+speed;$('#pauseBtn').textContent=paused?'▶':'⏸';
 const start=$('#startBtn');if(S.phase==='prep'){start.hidden=false;const bonus=S.battle>0?Math.floor(S.prep):0;start.textContent=bonus>0?`전투 시작 +${bonus}💰`:'전투 시작';}else start.hidden=true;
 if(S.phase==='battle'){const left=S.enemies.length+S.queue.length;$('#chips').innerHTML=`<span class="chip">⚔ 전투 중 · 남은 적 <b>${left}</b></span>`+(S.blessings.length?`<span class="chip">✨ 축복 ${S.blessings.length}</span>`:'');}
 refreshDock();if(selUnit)refreshPanel();}
const chipText=p=>`${p.boss?'👑 ':''}${p.name} ×${p.count}${p.element?' '+D.ELEMENT_ICON[p.element]:''}${p.flying?' <i>비행</i>':''}${p.immunity==='physical'?' <i>물리↓</i>':p.immunity==='magic'?' <i>마법↓</i>':''}`;
function showPreview(){const chips=$('#chips');chips.innerHTML=`<span class="chip info">ⓘ 적 정보</span>`+S.preview().map(p=>`<span class="chip${p.elite?' elite':''}${p.boss?' boss':''}">${chipText(p)}</span>`).join('');chips.scrollLeft=0;}
$('#chips').addEventListener('click',()=>{if(!S||modalOpen||S.phase!=='prep')return;sfx('tap');const m=modal(`<p class="sub">전투 ${S.battle+1} · ${S.chapter.battles[S.battle].name}</p><h2>이번에 오는 적</h2><ul class="foes">`+S.preview().map(p=>`<li><b>${chipText(p)}</b><br>${p.note}</li>`).join('')+`</ul><button class="primary">닫기</button>`);m.querySelector('button').onclick=closeModal;});
function buildDock(){const dock=$('#dock');dock.innerHTML='';const rows=[D.HERO_ORDER,D.SOLDIER_ORDER].map(order=>order.filter(id=>S.chapter.roster.includes(id)));
 for(const ids of rows){const row=document.createElement('div');row.className='row';for(const id of ids){const d=D.UNITS[id],el=document.createElement('div');el.className='card';el.dataset.id=id;
   el.innerHTML=`<img alt="" src="${portraits[id]}"><div class="nm">${d.name}</div><div class="ct"></div>`;el.addEventListener('pointerdown',e=>cardDown(e,id));row.appendChild(el);}dock.appendChild(row);}refreshDock();}
function refreshDock(){for(const el of document.querySelectorAll('#dock .card')){const id=el.dataset.id,d=D.UNITS[id],hero=S.hero[id],out=d.kind==='hero'&&S.units.some(u=>u.def===id),cost=S.deployCost(id),cd=hero?Math.ceil(hero.cd):0;
  const off=!out&&(S.gold<cost||S.units.length>=S.chapter.command||cd>0);el.className='card'+(d.kind==='hero'?' hero':'')+(selCard===id?' sel':'')+(off?' off':'')+(out?' out':'');
  el.querySelector('.ct').textContent=out?'출전 중':hero&&hero.keep&&!cd?'복귀':cost+'💰';
  let cool=el.querySelector('.cool');if(cd>0){if(!cool){cool=document.createElement('div');cool.className='cool';el.appendChild(cool);}cool.textContent=cd;}else if(cool)cool.remove();}}
function nextRankText(u){const d=S.defOf(u),k=d.ranks[u.rank];if(!k)return '최대 랭크입니다.';const bits=['능력치↑'];if(k.skills)bits.push(k.skills.map(s=>D.SKILLS[s].name).join(', '));if(k.choice)bits.push('각인 선택');if(k.desc)bits.push(k.desc);if(k.ult)bits.push('궁극기 '+D.SKILLS[k.ult].name);return `다음 ★${u.rank+1}: `+bits.join(' · ');}
let panelKey='';
function refreshPanel(force){const u=S.units.find(v=>v.id===selUnit);if(!u){closePanel();return;}const d=S.defOf(u),cost=S.rankCost(u),choice=S.needsChoice(u),ultReady=u.ult&&u.ultCd<=0;
 const key=[u.id,u.rank,cost,S.gold>=cost,Math.round(u.hp),Math.ceil(u.ultCd),aiming,choice,Object.keys(u.st).join()].join('|');if(!force&&key===panelKey)return;panelKey=key;
 const kit=u.skills.map(s=>D.SKILLS[s.id].name).join(', '),bad=Object.keys(u.st).map(k=>ST_NAME[k]).join('·');
 let btns='';
 if(choice&&cost!=null){const ch=d.ranks[u.rank].choice;btns+=Object.keys(ch).map(k=>`<button class="primary" data-act="rank" data-choice="${k}" ${S.gold<cost?'disabled':''}>${ch[k].label} ${cost}</button>`).join('');}
 else if(cost!=null)btns+=`<button class="primary" data-act="rank" ${S.gold<cost?'disabled':''}>랭크업 ${cost}💰</button>`;
 if(u.ult)btns+=`<button class="ult" data-act="ult" ${ultReady&&S.phase==='battle'?'':'disabled'}>${aiming===u.id?'위치 지정':ultReady?D.SKILLS[u.ult].name:D.SKILLS[u.ult].name+' '+Math.ceil(u.ultCd)}</button>`;
 btns+=`<button data-act="withdraw">철수 +${S.refundOf(u)}</button><button class="x" data-act="close">×</button>`;
 const line2=choice?Object.values(d.ranks[u.rank].choice).map(c=>c.desc.split(':')[0].split('.')[0]).join(' / '):nextRankText(u);
 $('#panel').innerHTML=`<img alt="" src="${portraits[u.def]}"><div class="info"><h3>${d.name} <span>${'★'.repeat(u.rank)}${'☆'.repeat(d.maxRank-u.rank)}</span> HP ${Math.max(0,Math.round(u.hp))}/${u.maxHp}${bad?` <em>${bad}</em>`:''}</h3><p>공격 ${Math.round((d.magic?u.mag:u.atk)*u.buff)} · 사거리 ${u.range}${u.block?' · 붙잡기 '+u.block:''}${kit?' · '+kit:''}</p><p class="next">${line2}</p><div class="btns">${btns}</div></div>`;}
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
 // Tap a character: test the bodies first (they stand taller than their tile). Otherwise a monster, otherwise the tile.
 let best=null;for(const u of S.units){const s=proj(u.x,u.y,groundY(u.x,u.y)+.5),d=Math.hypot(s.x-p.x,s.y-p.y);if(d<pxU*.55&&(!best||d<best.d))best={u,d};}
 if(best){sfx('tap');openPanel(best.u.id);return;}closePanel();
 let foe=null;for(const en of S.enemies){const s=proj(en.x,en.y,.4*(en.scale||1)),d=Math.hypot(s.x-p.x,s.y-p.y);if(d<pxU*.5*(en.scale||1)&&(!foe||d<foe.d))foe={e:en,d};}
 if(foe){const en=foe.e,m=D.MONSTERS[en.kind],note=en.boss?S.chapter.boss.hint:(D.MODEL_TRAITS[en.model]||{}).note||'';toast(`${en.name} HP ${Math.ceil(en.hp)}/${Math.round(en.maxHp)}${en.element?' '+D.ELEMENT_ICON[en.element]:''} · ${note}`);return;}
 const t=tileAt(p),tt=t&&S.map.tile(t.c,t.r);if(tt&&tt.terrain!=='grass'&&tt.terrain!=='road')toast({high:'고지대: 원거리 사거리 +0.5칸',forest:'수풀: 사거리 −0.5칸, 적의 화살을 잘 피함',swamp:'늪: 지나는 몬스터가 30% 느려짐',sand:'모래: 지나는 몬스터가 18% 느려짐',bridge:'다리: 근접 캐릭터가 설 수 있는 길목',water:'물: 배치 불가',cliff:'절벽: 배치 불가',prop:'구조물: 배치 불가',rock:'바위: 배치 불가'}[tt.terrain]||TERRAIN_NAME[tt.terrain]);});
$('#startBtn').addEventListener('click',()=>{if(S.phase!=='prep')return;if(!S.units.length){toast('먼저 동료를 한 명 이상 배치하세요');sfx('err');return;}S.startBattle();sfx('rank');});
$('#speedBtn').addEventListener('click',()=>{speed=speed%3+1;hudKey='';sfx('tap');});
$('#pauseBtn').addEventListener('click',()=>{paused=!paused;hudKey='';sfx('tap');});
$('#menuBtn').addEventListener('click',()=>{if(S&&!modalOpen){sfx('tap');gameMenu();}});

// ── Modals ──
function modal(html,cls){const m=$('#modal');m.className=cls||'';m.innerHTML=`<div class="sheet">${html}</div>`;m.hidden=false;modalOpen=true;return m;}
function closeModal(){$('#modal').hidden=true;modalOpen=false;}
function dialogue(lines,done){let i=0;const show=()=>{const [who,text]=lines[i],m=modal(`<p class="sub">${S.chapter.label} · ${S.chapter.name}</p><p class="who">${who}</p><p class="line">${text}</p><button class="primary">${i<lines.length-1?'다음':'확인'}</button><button data-skip>건너뛰기</button>`);
  m.querySelector('.primary').onclick=()=>{sfx('tap');if(++i<lines.length)show();else{closeModal();done&&done();}};m.querySelector('[data-skip]').onclick=()=>{closeModal();done&&done();};};show();}
function blessingModal(){const m=modal(`<p class="sub">에테르 축복</p><h2>하나를 고르세요</h2>`+S.offer.map(id=>{const b=D.BLESSINGS.find(v=>v.id===id);return `<button data-id="${id}">✨ ${b.name}<small>${b.desc}</small></button>`;}).join(''));
 m.querySelectorAll('button').forEach(b=>b.onclick=()=>{S.chooseBlessing(b.dataset.id);sfx('rank');closeModal();hudKey='';});}
const cleared=()=>loadJSON(CLEAR_KEY,{});
function resultModal(won){const ch=S.chapter,index=S.chapterIndex;if(won){const n=S.leaksTotal===0?3:S.life>=Math.ceil(ch.life*.75)?2:1,best=cleared();best[ch.id]=Math.max(best[ch.id]||0,n);saveJSON(CLEAR_KEY,best);try{localStorage.removeItem(SAVE_KEY);}catch(e){}
  const next=D.CHAPTERS[index+1];bgm.play(next?10:12,!next);sfx('win');
  const m=modal(`<p class="sub">${ch.label} CLEAR</p><h2>${ch.name}</h2><p class="stars">${'★'.repeat(n)}${'☆'.repeat(3-n)}</p><p>남은 생명 ${S.life} · 놓친 적 ${S.leaksTotal} · 처치 ${S.kills}</p>${next?`<button class="primary" data-a="next">다음 장으로<small>${next.label} · ${next.name}</small></button>`:`<p class="line">아르카 연대기 · 방어전<br>모든 장을 지켜냈습니다. 함께해 주셔서 고맙습니다.</p>`}<button data-a="title">타이틀로</button>`);
  if(next)m.querySelector('[data-a=next]').onclick=()=>{closeModal();startChapter(index+1,null);};m.querySelector('[data-a=title]').onclick=()=>{closeModal();showTitle();};}
 else{const m=modal(`<p class="sub">DEFEAT</p><h2>수정이 깨졌습니다</h2><p>전투 ${S.battle+1} 「${ch.battles[S.battle].name}」에서 막지 못했습니다.</p><button class="primary" data-a="retry">이 전투 다시 하기<small>전투를 시작했던 배치 그대로</small></button><button data-a="restart">장 처음부터</button><button data-a="title">타이틀로</button>`);
  m.querySelector('[data-a=retry]').onclick=()=>{closeModal();startChapter(index,lastSnap);};m.querySelector('[data-a=restart]').onclick=()=>{closeModal();startChapter(index,null);};m.querySelector('[data-a=title]').onclick=()=>{closeModal();showTitle();};}}
const HELP=`<h2>게임 방법</h2><ul><li>아래 초상화를 <b>끌어서</b> 전장에 놓거나, 누른 뒤 색이 칠해진 칸을 누르면 배치됩니다.</li><li>몬스터는 <b>붉은 문</b>에서 나와 길을 따라 <b>아르카 수정</b>으로 갑니다. 닿으면 생명이 줄어듭니다.</li><li><b>근접</b> 캐릭터를 길 위에 세우면 지나가는 몬스터를 붙잡아 <b>속도를 3분의 1</b>로 늦춥니다. 한 번에 붙잡는 수는 캐릭터마다 다릅니다.</li><li><b>원거리</b> 캐릭터는 길 옆에 섭니다. 밝은 <b>고지대</b>에서는 사거리가 늘어납니다.</li><li>늪·모래를 지나는 몬스터는 느려집니다. 그 근처에 화력을 모으세요.</li><li>배치한 캐릭터를 누르면 <b>랭크업</b>·철수·궁극기를 쓸 수 있습니다. ★3에서 각인을 고릅니다.</li><li>🔥불 &gt; 🪽바람 &gt; 💧물 &gt; 🔥불 순으로 강하고, ✨빛과 🌑암흑은 서로에게 강합니다.</li><li>유령은 물리, 골렘은 마법이 잘 안 먹힙니다. 「ⓘ 적 정보」에서 미리 확인하세요.</li><li>영웅은 한 명뿐입니다. 쓰러지면 잠시 뒤 랭크를 유지한 채 돌아옵니다.</li></ul>`;
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
 b.push(s.ult?`궁극기 · 재사용 ${s.cd}초`:`${s.cd}초마다 자동`);
 return `<b>${s.name}</b> — ${b.join(' · ')}`;}
function unitTips(id){const d=D.UNITS[id],extra=[];
 if(d.melee)extra.push(`근접 · 길 위에서 적 ${d.block}마리 붙잡기`);else extra.push(`원거리 · 사거리 ${d.range}칸${d.magic?' · 마법 공격':''}`);
 if(d.minRange)extra.push('바로 옆 칸의 적은 쏘지 못함');if(d.highDmg)extra.push(`고지대에서 피해 +${pct(d.highDmg)}`);
 if(d.behind)extra.push(`자신을 지나친 적에게 피해 +${pct(d.behind)}(암습)`);if(d.steal)extra.push(`막타 골드 +${pct(d.steal)}`);
 if(d.cooldown)extra.push(`철수 후 ${d.cooldown}초, 쓰러지면 15초 만에 복귀`);if(d.basic&&d.element)extra.push(`기본 공격은 ✨빛 ${pct(d.basic)}`);
 const ranks=d.ranks.map((k,i)=>{const bits=[];if(k.skills)bits.push(...k.skills.map(skillDesc));if(k.ult)bits.push(skillDesc(k.ult));if(k.desc&&!k.choice)bits.push(k.desc);
  if(k.choice)bits.push('각인 선택: '+Object.values(k.choice).map(c=>`${c.label} ${c.desc}`).join(' / '));if(!bits.length)bits.push('능력치 상승');return `<li><span class="rk">★${i+1}</span> ${bits.join('<br>')}</li>`;}).join('');
 return `<div class="unit"><p class="uh"><b>${d.name}</b> ${d.job} · ${d.cost}💰 · HP ${d.hp} · 공격 ${d.magic?d.mag:d.atk}</p><p>${d.role}<br><small>${extra.join(' · ')}</small></p><ul class="ranks">${ranks}</ul></div>`;}
function helpTips(){const sec=(title,body)=>`<details><summary>${title}</summary><div class="tip">${body}</div></details>`;
 const byModel={};for(const m of D.MONSTERS)(byModel[m.model]=byModel[m.model]||[]).push(m.name+(m.element?D.ELEMENT_ICON[m.element]:''));
 const MODEL_NAME={slime:'슬라임',goblin:'고블린',wolf:'늑대',knight:'기사',archer:'궁수',ghost:'유령',golem:'골렘',flameSpirit:'임프',spider:'거미',dragon:'비룡',treant:'덩굴·고목',sentinel:'파수꾼'};
 const MODEL_TIP={slime:'리아의 범위 마법으로 갈라진 것까지 한꺼번에',goblin:'무엇이든',wolf:'붙잡기와 둔화로 속도를 꺾으세요',knight:'마법이나 갑옷 가르기',archer:'수풀에 서거나 브란의 도발로 받아내기',ghost:'마법 또는 속성이 실린 물리 스킬',golem:'물리 화력과 갑옷 가르기',flameSpirit:'루나의 정화로 화상을 지우기',spider:'정화와 회복, 범위 공격',dragon:'세라·사냥꾼·마법 캐릭터',treant:'먼저 처치하거나 네로의 침묵',sentinel:'네로의 침묵으로 보호막 끄기'};
 return `<h3 class="tips-h">상세 팁</h3>
${sec('⚔ 속성 상성',`<table><tr><th>공격</th><th>강함 ×1.25</th><th>약함 ×0.75</th></tr><tr><td>🔥 불</td><td>🪽 바람</td><td>💧 물</td></tr><tr><td>🪽 바람</td><td>💧 물</td><td>🔥 불</td></tr><tr><td>💧 물·❄ 냉기</td><td>🔥 불</td><td>🪽 바람</td></tr><tr><td>✨ 빛</td><td>🌑 암흑</td><td>–</td></tr><tr><td>🌑 암흑</td><td>✨ 빛</td><td>–</td></tr></table>
<ul><li>⚡번개와 무속성 공격은 상성이 없습니다.</li><li>적의 속성은 「ⓘ 적 정보」와 몬스터 칩의 아이콘으로 미리 볼 수 있습니다. 숫자가 <b class="y">노란색</b>이면 상성이 맞은 것, <b class="g">회색</b>이면 덜 들어간 것입니다.</li><li>★3 각인에서 다음 전투의 적 속성에 맞춰 속성을 고르세요. 한 장 안에서도 적 구성이 바뀌니, 영웅마다 서로 다른 속성을 고르면 대응이 쉬워집니다.</li></ul>`)}
${sec('🛡 물리·마법과 면역',`<ul><li>피해 = 공격력 × 배율 − 상대 방어 × 0.5 (최소 공격력의 20%). 물리는 방어(DEF), 마법은 마법 방어(RES)로 줄어듭니다.</li><li><b>유령</b>은 물리 피해를 35%만 받습니다. 속성이 실린 물리 스킬은 60%까지 들어갑니다.</li><li><b>골렘</b>은 마법 피해를 35%만 받습니다(보스는 50%).</li><li>마법 캐릭터: 리아·루나·수습 마도사·수습 사제. 나머지는 물리입니다. 두 가지를 섞어 두어야 어떤 적이 와도 막힙니다.</li><li>치명타는 피해 ×1.5입니다. 네로(18%)와 세라(12%)가 가장 잘 터뜨립니다.</li><li>방어↓(갑옷 가르기)가 걸린 적은 물리 피해를 25% 더 받습니다.</li></ul>`)}
${sec('🗺 지형',`<table><tr><th>지형</th><th>효과</th></tr><tr><td>길</td><td>근접 캐릭터만 설 수 있고, 지나가는 적을 붙잡습니다</td></tr><tr><td>평지</td><td>누구나 설 수 있습니다. 근접 캐릭터가 서면 공격만 하고 붙잡지는 못합니다</td></tr><tr><td>고지대</td><td>원거리 캐릭터만 · 사거리 +0.5칸 · 세라는 피해 +15%</td></tr><tr><td>수풀</td><td>사거리 −0.5칸 · 적의 원거리 공격을 30% 확률로 피하고, 적이 덜 노립니다</td></tr><tr><td>늪</td><td>지나는 적 이동 속도 −30%</td></tr><tr><td>모래</td><td>지나는 적 이동 속도 −18%</td></tr><tr><td>다리</td><td>강을 건너는 길목. 근접 캐릭터를 세우기 좋습니다</td></tr><tr><td>물·절벽·바위·구조물</td><td>배치할 수 없습니다</td></tr></table><ul><li>적 출현 문과 수정 바로 앞 칸은 비워 둬야 합니다.</li><li>지형 칸을 누르면 효과가 표시됩니다.</li></ul>`)}
${sec('⛓ 근접 캐릭터의 붙잡기',`<ul><li>길 위의 근접 캐릭터는 자기 칸을 지나는 적을 붙잡아 <b>속도를 1/3</b>로 늦춥니다(보스는 55%). 적은 막히지 않고 천천히 스쳐 지나갑니다.</li><li>한 번에 붙잡는 수: 브란 3 · 카일 2 · 방패병 2 · 네로 1 · 민병 1. 민병·방패병은 ★3에서 +1. 골렘과 보스는 두 자리를 차지합니다.</li><li>붙잡힌 적은 1.6초마다 그 캐릭터를 때립니다. 4초 동안 맞지 않으면 캐릭터 체력이 초당 2.5%씩 회복됩니다.</li><li><b>비행</b>(비룡·매)과 <b>유령</b>은 붙잡을 수 없습니다.</li><li>붙잡힌 적 위에는 ⛓ 표시가 뜹니다. 근접 캐릭터를 여러 칸에 나눠 세우면 늦춰지는 구간이 길어집니다.</li></ul>`)}
${sec('👑 영웅 6명',D.HERO_ORDER.map(unitTips).join('')+`<p><small>영웅은 한 명씩만 출전합니다. 철수하면 20초, 쓰러지면 30초 뒤 다시 배치할 수 있고, 쓰러진 영웅은 랭크와 각인을 그대로 가지고 공짜로 돌아옵니다.</small></p>`)}
${sec('🪖 연합군 병사 5종',D.SOLDIER_ORDER.map(unitTips).join('')+`<p><small>병사는 여러 명 배치할 수 있고 ★3까지 오릅니다. 쓰러지면 사라지니 다시 고용해야 합니다.</small></p>`)}
${sec('📈 랭크업과 철수',`<table><tr><th>랭크</th><th>비용(배치가 대비)</th></tr><tr><td>★2</td><td>×0.8</td></tr><tr><td>★3</td><td>×1.2 · 각인 선택</td></tr><tr><td>★4</td><td>×1.8</td></tr><tr><td>★5</td><td>×2.5 · 궁극기</td></tr></table><ul><li>랭크마다 HP·공격·마법 +25%, 방어·마법 방어 +15%.</li><li>★2는 가장 싸고 효과가 큽니다. 초반에는 새로 배치하기보다 핵심 캐릭터의 ★2를 먼저 올려 보세요.</li><li>★4의 오라(용기의 맹세·수호의 진·빛의 축복)는 주변 2칸 아군 모두에게 걸립니다. 화력 캐릭터를 오라 범위 안에 모으세요.</li><li>궁극기는 ★5가 되면 8초 뒤 처음 쓸 수 있습니다. 준비되면 캐릭터 발밑이 주황색으로 빛납니다.</li><li>철수하면 쓴 골드의 70%를 돌려받습니다. 길 모양이 바뀌는 장에서는 자리를 옮기는 데 쓰세요.</li></ul>`)}
${sec('💫 상태이상',`<table><tr><th>상태</th><th>적에게</th></tr><tr><td>🔥 화상</td><td>4초간 초당 최대 체력 2% (보스 0.5%)</td></tr><tr><td>☠ 독</td><td>6초간 초당 최대 체력 1.2%, 3번까지 겹침</td></tr><tr><td>❄ 빙결</td><td>1.5초 멈춘 뒤 3초 둔화 (보스는 둔화만)</td></tr><tr><td>⚡ 기절</td><td>1.2초 멈춤 (보스 0.5초)</td></tr><tr><td>💤 수면</td><td>4초 멈춤, 맞으면 깨지만 그 공격은 피해 2배 (보스는 둔화)</td></tr><tr><td>🐌 둔화</td><td>3초간 이동 속도 −35%</td></tr><tr><td>🔇 침묵</td><td>6초간 특수 능력 봉인 — 재생·보호막·원거리 마법·보스 회복 (보스 2.5초)</td></tr><tr><td>🛡↓ 방어↓</td><td>6초간 받는 물리 피해 +25%</td></tr><tr><td>⛓ 속박</td><td>도발에 걸려 1.8초 멈춤</td></tr></table><ul><li>아군도 화상·독·빙결·기절·침묵에 걸립니다. 빙결·기절이면 행동하지 못하고, 침묵이면 스킬을 못 씁니다. 루나의 <b>정화</b>와 브란의 <b>철벽의 성채</b>로 지울 수 있습니다.</li><li>상태 아이콘은 체력 막대 위의 작은 점 색으로 표시됩니다.</li></ul>`)}
${sec('✨ 콤보',`<table><tr><th>콤보</th><th>조건</th><th>효과</th></tr><tr><td>파쇄</td><td>빙결·둔화된 적에게 물리 스킬</td><td>피해 +30%</td></tr><tr><td>확산</td><td>화상 중인 적에게 🪽바람 스킬</td><td>1.3칸 안의 다른 적에게 화상이 옮겨 붙음</td></tr><tr><td>기습</td><td>잠든 적을 공격</td><td>피해 2배</td></tr><tr><td>암습</td><td>네로가 자신을 지나친 적을 공격</td><td>피해 +25%</td></tr></table><ul><li>예) 리아 프로스트(빙결) → 카일 얼음 베기·세라 관통 사격으로 파쇄.</li><li>예) 카일 화염검·리아 파이어로 불을 붙이고 → 리아 회오리 폭풍·카일 폭풍 베기로 확산.</li><li>예) 네로 수면 단검 → 세라 매의 심판으로 기습. 아군은 잠든 적을 마지막에 노립니다.</li></ul>`)}
${sec('👾 몬스터 유형',`<table><tr><th>유형</th><th>특징 · 대응</th></tr>`+Object.keys(byModel).map(k=>`<tr><td>${MODEL_NAME[k]||k}</td><td>${(D.MODEL_TRAITS[k]||{}).note||''} · <i>${MODEL_TIP[k]||''}</i><br><small>${byModel[k].join(', ')}</small></td></tr>`).join('')+`</table><ul><li><b>정예</b>(이름 앞 「정예」, 크기가 큼): 체력 ×4, 공격 ×1.4, 수정에 닿으면 생명 −2. 노란 체력 막대로 표시됩니다.</li><li>슬라임이 갈라진 「꼬마」는 빠르지만 약합니다.</li><li>몬스터를 누르면 체력·속성·특징이 표시됩니다.</li></ul>`)}
${sec('🐉 장별 보스',D.CHAPTERS.map(c=>{const b=c.boss;return `<p><b>${c.label} · ${b.name}</b>${b.element?' '+D.ELEMENT_ICON[b.element]:''}${b.immunity==='magic'?' · 마법↓':b.immunity==='physical'?' · 물리↓':''}${b.fly?' · 비행':''}<br><small>${b.hint}${b.wave?` 주기적으로 「${b.wave.name}」: 주변 ${b.wave.radius}칸 동료를 공격하고 ${ST_NAME[b.wave.status]} 상태로 만듭니다.`:''}${b.summon?' 부하를 불러냅니다.':''}</small></p>`;}).join('')+`<p><small>보스가 수정에 닿으면 생명과 관계없이 바로 패배합니다. 궁극기는 보스가 나올 때까지 아껴 두세요.</small></p>`)}
${sec('💰 골드와 진행',`<ul><li>처치 골드는 몬스터 체력에 비례합니다. 정예는 4배, 보스는 큰 보너스를 줍니다.</li><li>전투 승리 보너스: 30 + 전투 번호 × 8. 한 마리도 놓치지 않으면 1.5배.</li><li><b>조기 출발</b>: 준비 시간이 남았을 때 「전투 시작」을 누르면 남은 초만큼 골드를 받습니다.</li><li>네로가 마무리하면 골드 +30%. 네로를 적이 많이 지나가는 길목 뒤쪽에 세우세요.</li><li>몇 전투마다 <b>에테르 축복</b> 3개 중 하나를 고릅니다: ${D.BLESSINGS.map(b=>`${b.name}(${b.desc})`).join(', ')}.</li><li>별 평가: 클리어 ★ · 생명 75% 이상 ★★ · 한 마리도 놓치지 않으면 ★★★.</li></ul>`)}
${sec('🎯 배치 공략',`<ul><li><b>굽이 안쪽이 명당</b>: 길이 꺾이는 안쪽 칸은 길 두세 구간을 동시에 사거리에 넣습니다. 리아·세라를 세우세요.</li><li><b>늦추고 → 모으고 → 터뜨린다</b>: 브란이 붙잡아 적이 뭉치면 리아의 범위 마법이 여러 마리를 한꺼번에 맞힙니다.</li><li><b>늪·모래 끝에 근접 캐릭터</b>: 느려진 구간과 붙잡기가 겹치면 적이 머무는 시간이 크게 늘어납니다.</li><li><b>네로는 벽 뒤에</b>: 브란을 지나친 적은 네로에게 등을 보여 암습 피해를 받고, 흘린 적도 마무리합니다.</li><li><b>세라는 길에서 한 칸 떨어진 고지대</b>: 바로 옆 칸을 쏘지 못하니 한 칸 띄우고, 고지대에서 사거리와 피해를 모두 챙기세요.</li><li><b>루나는 전선과 화력 사이</b>: 회복 사거리에 근접 캐릭터, 오라 범위에 화력 캐릭터가 함께 들어오는 칸이 좋습니다.</li><li><b>입구가 두 개인 장</b>(4장·8장): 두 길이 합쳐지는 곳에 화력을 모으면 한 번에 막을 수 있습니다.</li><li>배치나 캐릭터 메뉴를 여는 동안에는 시간이 1/4로 느려집니다. 급할 때는 일시정지(⏸)를 쓰세요.</li></ul>`)}`;}
function settingsModal(back){const vols=[0,.25,.5,.75,1],m=modal(`<h2>소리 설정</h2><p>배경 음악</p><div class="seg">${vols.map(v=>`<button data-v="${v}" class="${settings.bgm===v?'primary':''}">${v?Math.round(v*100):'끔'}</button>`).join('')}</div><p>효과음</p><div class="seg"><button data-s="1" class="${settings.sfx?'primary':''}">켬</button><button data-s="0" class="${settings.sfx?'':'primary'}">끔</button></div><button class="primary" data-a="back">확인</button>`);
 m.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{settings.bgm=+b.dataset.v;saveJSON(SET_KEY,settings);bgm.volume();settingsModal(back);});m.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{settings.sfx=b.dataset.s==='1';saveJSON(SET_KEY,settings);sfx('tap');settingsModal(back);});m.querySelector('[data-a=back]').onclick=back;}
// Save slots: each keeps the state at the start of a battle, like the automatic save.
const slots=()=>{const a=loadJSON(SLOT_KEY,[]);return Array.from({length:SLOTS},(_,i)=>a[i]||null);};
const slotLabel=s=>{const c=D.CHAPTERS[s.snap.chapter];return `${c.label} · 전투 ${s.snap.battle+1}/${c.battles.length}<small>${new Date(s.time).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} · 생명 ${s.snap.life} · 골드 ${s.snap.gold} · 동료 ${s.snap.units.length}명</small>`;};
function slotModal(mode,back){const list=slots(),auto=mode==='load'?loadSave():null;
 const m=modal(`<h2>${mode==='save'?'저장하기':'불러오기'}</h2>${mode==='save'?`<p>전투 ${lastSnap.battle+1}을 시작하는 시점의 상태가 저장됩니다.</p>`:''}${auto?`<button data-auto>자동 저장 · ${slotLabel({snap:auto,time:auto.time||Date.now()})}</button>`:''}`+list.map((s,i)=>`<button data-i="${i}" ${mode==='load'&&!s?'disabled':''}>슬롯 ${i+1} · ${s?slotLabel(s):'비어 있음'}</button>`).join('')+`<button class="primary" data-a="back">돌아가기</button>`);
 m.querySelector('[data-a=back]').onclick=back;const a=m.querySelector('[data-auto]');if(a)a.onclick=()=>{closeModal();startChapter(auto.chapter,auto);};
 m.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;if(mode==='save'){const go=()=>{const all=slots();all[i]={snap:lastSnap,time:Date.now()};saveJSON(SLOT_KEY,all);sfx('rank');slotModal('save',back);toast(`슬롯 ${i+1}에 저장했습니다`);};
   if(list[i]){const c=modal(`<h2>슬롯 ${i+1} 덮어쓰기</h2><p>이미 저장된 내용이 있습니다. 덮어쓸까요?</p><button class="primary" data-a="y">덮어쓰기</button><button data-a="n">취소</button>`);c.querySelector('[data-a=y]').onclick=go;c.querySelector('[data-a=n]').onclick=()=>slotModal('save',back);}else go();}
  else if(list[i]){closeModal();startChapter(list[i].snap.chapter,list[i].snap);}});}
function gameMenu(){const m=modal(`<p class="sub">${S.chapter.label} · 전투 ${S.battle+1}</p><h2>메뉴</h2><button class="primary" data-a="resume">계속하기</button><button data-a="save">저장하기</button><button data-a="load">불러오기</button><button data-a="sound">소리 설정</button><button data-a="help">게임 방법</button>${devMode?'<button data-a="skip">[개발자] 이 전투 즉시 승리</button><button data-a="gold">[개발자] 골드 +500</button>':''}<button data-a="title">타이틀로<small>자동 저장된 전투부터 이어할 수 있습니다</small></button>`);
 const on=(a,f)=>{const b=m.querySelector(`[data-a=${a}]`);if(b)b.onclick=f;};on('resume',closeModal);on('save',()=>slotModal('save',gameMenu));on('load',()=>slotModal('load',gameMenu));on('sound',()=>settingsModal(gameMenu));
 on('help',()=>{const h=modal(HELP+helpTips()+`<button class="primary">닫기</button>`,'help');h.querySelector('button').onclick=gameMenu;});on('title',()=>{closeModal();showTitle();});
 on('gold',()=>{S.gold+=500;hudKey='';closeModal();});on('skip',()=>{closeModal();if(S.phase==='prep')S.startBattle();S.queue.length=0;for(const e of S.enemies){e.canSplit=false;e.hp=0;e.st.burn=1;}});}
function chapterList(dev){const best=cleared(),m=modal(`<h2>${dev?'개발자 모드 · 장 바로 시작':'장 선택'}</h2>${dev?'<p>베타 테스트용 메뉴입니다. 어느 장이든 바로 시작합니다.</p>':''}`+D.CHAPTERS.map((c,i)=>{const open=dev||i===0||best[D.CHAPTERS[i-1].id];return `<button data-i="${i}" ${open?'':'disabled'}>${c.label} · ${c.name}${best[c.id]?' '+'★'.repeat(best[c.id]):''}<small>${open?`${c.place} · 전투 ${c.battles.length}회 · 보스 ${c.boss.name}`:'이전 장을 클리어하면 열립니다'}</small></button>`;}).join('')+`<button class="primary" data-a="back">돌아가기</button>`);
 m.querySelector('[data-a=back]').onclick=showTitle;m.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{closeModal();devMode=dev;startChapter(+b.dataset.i,null);});}
function showTitle(){S=null;clearObjects();closePanel();disposeGroup(terrainGroup);water=null;animated=[];app.classList.add('title');bgm.play(1);const save=loadSave(),any=save||slots().some(Boolean);
 const m=modal(`<p class="sub">ARCA CHRONICLE</p><h1>cnation <em>TD</em></h1><p class="tag">아르카 방어전</p><p>탑을 짓지 않는다. 동료를 세운다.</p>${save?`<button class="primary" data-a="continue">이어하기<small>${D.CHAPTERS[save.chapter].label} · 전투 ${save.battle+1}</small></button>`:''}<button ${save?'':'class="primary"'} data-a="new">새 게임<small>PROLOGUE · 깨어난 빛</small></button><button data-a="chapters">장 선택</button><button data-a="load" ${any?'':'disabled'}>불러오기</button><button data-a="sound">소리 설정</button><button data-a="help">게임 방법</button><button class="dev" data-a="dev">개발자 모드 (베타 전용)</button><p class="ver">ver.${GAME_VERSION} beta</p>`,'title');
 const on=(a,f)=>{const b=m.querySelector(`[data-a=${a}]`);if(b)b.onclick=()=>{sfx('tap');f();};};
 on('new',()=>{closeModal();devMode=false;startChapter(0,null);});on('continue',()=>{closeModal();startChapter(save.chapter,save);});on('chapters',()=>chapterList(false));on('dev',()=>chapterList(true));
 on('load',()=>slotModal('load',showTitle));on('sound',()=>settingsModal(showTitle));on('help',()=>{const h=modal(HELP+helpTips()+`<button class="primary">닫기</button>`,'help');h.querySelector('button').onclick=showTitle;});}

// ── Saves ──
function saveGame(){lastSnap=S.snapshot();lastSnap.time=Date.now();saveJSON(SAVE_KEY,lastSnap);}
function loadSave(){const s=loadJSON(SAVE_KEY,null);return s&&s.v===2&&D.CHAPTERS[s.chapter]?s:null;}
function startChapter(index,snapshot){clearObjects();closePanel();app.classList.remove('title');selCard=null;validTiles=null;S=createSim({chapter:index,snapshot,seed:(Date.now()&0xffff)+index*101});speed=1;paused=false;hudKey='';
 resize();buildTerrain();buildDock();showPreview();saveGame();bgm.play(battleTrack());
 if(!snapshot)dialogue(S.chapter.intro,()=>toast('동료를 배치하고 「전투 시작」을 누르세요'));else toast(`${S.chapter.label} · 전투 ${S.battle+1} 준비`);}

// ── Effects (2D overlay) ──
function addFx(o){if(fx.length>160)fx.shift();o.t=0;fx.push(o);}
function handleEvents(){for(const e of S.drain()){
 if(e.t==='attack'){const o=objs.get('u'+e.unit);if(o)o.lunge=1;if(e.melee)addFx({k:'slash',x:e.to.x,y:e.to.y,dur:.18,color:'#fff',r:.32});else addFx({k:'shot',from:e.from,to:e.to,dur:.13,color:e.magic?'#d6b3ff':'#f3e3b0',magic:e.magic});sfx('hit');}
 else if(e.t==='skill'){const o=objs.get('u'+e.unit);if(o)o.lunge=1.4;const color=EL_COLOR[e.element]||'#fff';addFx({k:'label',x:e.from.x,y:e.from.y,h:1.5,text:e.name,color,dur:.9,size:13});
  if(e.fx==='slash')addFx({k:'slash',x:e.x,y:e.y,dur:.3,color,r:e.area?e.area:.55});else if(e.fx==='bolt'){addFx({k:'bolt',x:e.x,y:e.y,dur:.28,color});}
  else if(e.fx==='meteor'){addFx({k:'meteor',x:e.x,y:e.y,dur:.45,color,r:e.area});}else if(e.fx==='heal'){addFx({k:'ring',x:e.x,y:e.y,dur:.5,color:'#8fe5b4',r:.6,fill:true});sfx('heal');}else addFx({k:'ring',x:e.x,y:e.y,dur:.42,color,r:e.area||.6,fill:true});
  if(e.fx==='blast'||e.fx==='shot'||e.fx==='bolt')addFx({k:'shot',from:e.from,to:{x:e.x,y:e.y},dur:.14,color,magic:true});}
 else if(e.t==='dmg'){if(e.tag==='miss'){addFx({k:'num',x:e.x,y:e.y,h:.9,text:'빗나감',color:'#9fb0b6',size:11,dur:.6});continue;}const big=e.crit||e.tag==='weak'||e.combo;addFx({k:'num',x:e.x+(Math.random()-.5)*.3,y:e.y,h:.9,text:(e.combo?e.combo+' ':'')+e.v+(e.crit?'!':''),color:e.tag==='weak'?'#ffd257':e.tag==='resist'?'#9fb0b6':e.crit?'#ffb199':'#fff',size:big?15:11,dur:.6});const o=objs.get('e'+e.id);if(o)o.flash=.12;}
 else if(e.t==='combo')addFx({k:'num',x:e.x,y:e.y,h:1.3,text:e.name,color:'#ffd257',size:15,dur:.8});
 else if(e.t==='hurt'){addFx({k:'num',x:e.x,y:e.y,h:1.3,text:'-'+e.v,color:'#ff9d8a',size:12,dur:.6});}
 else if(e.t==='eattack'){const a=objs.get('e'+e.id);if(a)a.lunge=1;}
 else if(e.t==='eshot')addFx({k:'shot',from:e.from,to:e.to,dur:.2,color:e.magic?(EL_COLOR[e.element]||'#ff9d8a'):'#ffb3a3',magic:e.magic,foe:true});
 else if(e.t==='heal'){if(e.v>0)addFx({k:'num',x:e.x,y:e.y,h:1.4,text:'+'+e.v,color:'#8fe5b4',size:13,dur:.7});}
 else if(e.t==='cleanse')addFx({k:'num',x:e.x,y:e.y,h:1.6,text:'정화',color:'#fff3b0',size:13,dur:.8});
 else if(e.t==='dodge')addFx({k:'num',x:e.x,y:e.y,h:1.4,text:'회피',color:'#cfe3ff',size:12,dur:.6});
 else if(e.t==='ustatus')addFx({k:'num',x:e.x,y:e.y,h:1.7,text:ST_NAME[e.status],color:ST_COLOR[e.status],size:13,dur:.9});
 else if(e.t==='die'){const o=objs.get('e'+e.id);if(o){objs.delete('e'+e.id);dying.push({g:o.g,t:0});}addFx({k:'num',x:e.x,y:e.y,h:.5,text:'+'+e.gold+(e.steal?'↑':''),color:'#f2cf72',size:12,dur:.7});sfx('coin');if(e.boss)banner('BOSS',S.chapter.boss.split?'갈라졌다!':'쓰러졌다!');}
 else if(e.t==='leak'){sfx('leak');addFx({k:'flash',dur:.35});toast(e.boss?'보스가 수정에 닿았습니다':`수정이 공격받았습니다 · 생명 −${e.cost}`);}
 else if(e.t==='down'){const o=objs.get('u'+e.id);if(o){objs.delete('u'+e.id);dying.push({g:o.g,t:0});}toast(`${D.UNITS[e.def].name} 쓰러짐${e.cd?` · ${e.cd}초 뒤 복귀 가능`:''}`);sfx('leak');if(selUnit===e.id)closePanel();}
 else if(e.t==='withdraw'){const o=objs.get('u'+e.id);if(o){objs.delete('u'+e.id);unitGroup.remove(o.g);}}
 else if(e.t==='ult'){sfx('ult');banner('궁극기',e.name);}
 else if(e.t==='bossWave'){addFx({k:'ring',x:e.x,y:e.y,dur:.7,color:EL_COLOR[e.element]||'#ff6b5a',r:e.r,fill:true});addFx({k:'label',x:e.x,y:e.y,h:2.4,text:e.name,color:'#ff9d8a',dur:1.1,size:15});sfx('boss');}
 else if(e.t==='bossSummon')addFx({k:'label',x:e.x,y:e.y,h:2.2,text:'소환!',color:'#ffb3a3',dur:.9,size:14});
 else if(e.t==='bossPhase'){banner('BOSS',e.name);sfx('boss');addFx({k:'ring',x:e.x,y:e.y,dur:.8,color:'#fff3b0',r:3,fill:false});}
 else if(e.t==='bossFly'){addFx({k:'label',x:e.x,y:e.y,h:2.4,text:e.flying?'날아오른다':'내려앉았다!',color:'#c7a3ff',dur:1.1,size:15});}
 else if(e.t==='beamWarn'){warns.set(e.unit,{t:e.delay,boss:e.id});toast(`${e.name}: 조준당한 동료를 지키거나 철수하세요`);sfx('boss');}
 else if(e.t==='beam'){warns.delete(e.unit);if(e.to)addFx({k:'beam',from:e.from,to:e.to,dur:.35});}
 else if(e.t==='bonus')toast(`${e.why} 보너스 +${e.gold}💰`);
 else if(e.t==='battleStart'){saveGame();const b=S.chapter.battles[e.battle];banner(`전투 ${e.battle+1}`,b.name);clearCard();bgm.play(battleTrack());if(b.boss){paused=true;sfx('boss');dialogue(S.chapter.bossIntro,()=>{paused=false;hudKey='';});}}
 else if(e.t==='cleared'){toast(`전투 ${e.battle+1} 승리 +${e.gold}💰${e.clean?' (무누수 보너스)':''}`);}
 else if(e.t==='prep'){saveGame();showPreview();}
 else if(e.t==='bless')blessingModal();
 else if(e.t==='won'){const end=()=>resultModal(true);if(S.chapter.outro)dialogue(S.chapter.outro,end);else end();}
 else if(e.t==='lost')resultModal(false);
 hudKey='';}}
function ellipse(x,y,r,h=0){const p=proj(x,y,h);ctx.beginPath();ctx.ellipse(p.x,p.y,r*pxU,r*pxU*SIN,0,0,Math.PI*2);}
function tileQuad(c,r,h){const a=proj(c-.5,r-.5,h),b=proj(c+.5,r+.5,h);ctx.beginPath();ctx.rect(a.x+1,a.y+1,b.x-a.x-2,b.y-a.y-2);}
function pill(x,y,text,bg,fg){ctx.font=`400 13px ${FONT}`;const w=ctx.measureText(text).width+16;x=Math.max(w/2+4,Math.min(vw-w/2-4,x));y=Math.max(14,Math.min(vh-14,y));ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(x-w/2,y-11,w,22,11);ctx.fill();ctx.fillStyle=fg;ctx.fillText(text,x,y+4.5);}
function chevron(x,y,dx,dy,size,color,alpha){const p=proj(x,y,-.05),ax=dx,ay=dy*SIN,n=Math.hypot(ax,ay)||1,ux=ax/n,uy=ay/n,s=size*pxU;ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=Math.max(3,pxU*.09);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-ux*s-uy*s,p.y-uy*s+ux*s);ctx.lineTo(p.x,p.y);ctx.lineTo(p.x-ux*s+uy*s,p.y-uy*s-ux*s);ctx.stroke();ctx.globalAlpha=1;}
function drawMarkers(time){const map=S.map,prep=S.phase==='prep';
 map.paths.forEach((path,pi)=>{const flow=(time*1.2)%1;
  // Red arrows pour out of each gate; during preparation they run the whole road so the route is easy to read.
  const upto=prep?path.total-1.2:3.2;for(let d=.2+flow;d<upto;d+=prep?1.5:1){const p=map.posAt(pi,d),fade=prep?(d<3.2?.9:.38):Math.max(0,.95-d/3.6);chevron(p.x,p.y,p.dx,p.dy,.2,d<3.2?'#ff5a45':'#fff',fade);}
  const [fc,fr]=path.wp[0],seg=path.segs[0],g=proj(fc+seg.dx*.5,fr+seg.dy*.5,2.5);if(pi===0||path.wp[0][0]!==map.paths[0].wp[0][0]||path.wp[0][1]!==map.paths[0].wp[0][1])pill(g.x,g.y,map.paths.length>1?`▼ 적 출현 ${pi+1}`:'▼ 적 출현','rgba(170,40,30,.92)','#fff');
  for(let d=path.total-2.6+flow*.8;d<path.total-.5;d+=.8){const p=map.posAt(pi,d);chevron(p.x,p.y,p.dx,p.dy,.18,'#7ff0d2',.75);}});
 const last=map.paths[0].wp[map.paths[0].wp.length-1],c=proj(last[0],Math.min(last[1],S.map.h-1)+.6,2.6),low=S.life<=S.maxLife*.35;pill(c.x,c.y,`아르카 수정 ♥${S.life}`,low?'rgba(170,40,30,.92)':'rgba(20,90,80,.92)','#fff');}
function drawOverlay(dt,time){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,vw,vh);ctx.textAlign='center';ctx.lineJoin='round';
 drawMarkers(time);
 // Where the selected card may go
 if(selCard&&validTiles){const d=D.UNITS[selCard];for(const t of validTiles){tileQuad(t.c,t.r,tileTop(t));ctx.fillStyle=t.road?'rgba(255,190,70,.5)':t.terrain==='high'?'rgba(90,215,255,.5)':'rgba(60,220,130,.34)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.5;ctx.stroke();}
  if(hover&&hover.c!=null){const t=S.map.tile(hover.c,hover.r),ok=validTiles.includes(t),range=d.range+(d.melee?0:(t.terrain==='high'?.5:0)-(t.terrain==='forest'?.5:0)+S.mods.range);ellipse(hover.c,hover.r,range+.35);ctx.fillStyle=ok?'rgba(255,255,255,.16)':'rgba(240,120,100,.2)';ctx.fill();ctx.strokeStyle=ok?'#fff':'#f08f7c';ctx.lineWidth=2;ctx.stroke();tileQuad(hover.c,hover.r,tileTop(t));ctx.strokeStyle=ok?'#fff':'#f08f7c';ctx.lineWidth=3;ctx.stroke();}}
 const su=selUnit&&S.units.find(u=>u.id===selUnit);
 if(su){ellipse(su.x,su.y,su.range+.35);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;ctx.stroke();for(const au of su.auras){ellipse(su.x,su.y,au.radius+.4);ctx.setLineDash([6,5]);ctx.strokeStyle='#f2cf72';ctx.stroke();ctx.setLineDash([]);}}
 // Monster bars and status pips
 for(const e of S.enemies){const sc=e.scale||1,p=proj(e.x,e.y,(e.flying?1.95:1.25)*Math.max(1,sc*.92)),w=pxU*.62*(e.boss?1.9:sc>1.2?1.3:1);
  if(e.hp<e.maxHp||e.boss||e.elite){ctx.fillStyle='rgba(12,22,26,.75)';ctx.fillRect(p.x-w/2-1,p.y-1,w+2,e.boss?8:6);ctx.fillStyle=e.boss?'#ff7361':e.elite?'#f2cf72':'#ee6f5c';ctx.fillRect(p.x-w/2,p.y,w*Math.max(0,e.hp/e.maxHp),e.boss?6:4);}
  let i=0;for(const k in e.st){ctx.fillStyle=ST_COLOR[k]||'#fff';ctx.beginPath();ctx.arc(p.x-w/2+4+i*8,p.y-6,3,0,7);ctx.fill();i++;}
  if(e.engagedBy){ctx.fillStyle='#fff';ctx.font=`400 10px ${FONT}`;ctx.fillText('⛓',p.x+w/2+5,p.y+5);}
  if(e.shielded){const g=proj(e.x,e.y,.5);ctx.beginPath();ctx.arc(g.x,g.y,pxU*.4,0,7);ctx.strokeStyle='rgba(140,230,230,.7)';ctx.lineWidth=2;ctx.stroke();}}
 // Character bars, rank, ultimate glow
 for(const u of S.units){const gy=groundY(u.x,u.y),p=proj(u.x,u.y,gy+1.45),w=pxU*.7;ctx.fillStyle='rgba(12,22,26,.75)';ctx.fillRect(p.x-w/2-1,p.y-1,w+2,7);ctx.fillStyle=u.hp/u.maxHp>.35?'#7fe0a6':'#ffb35c';ctx.fillRect(p.x-w/2,p.y,w*Math.max(0,u.hp/u.maxHp),5);
  ctx.font=`400 10px ${FONT}`;ctx.fillStyle='#f2cf72';ctx.strokeStyle='rgba(12,22,26,.9)';ctx.lineWidth=3;const s='★'.repeat(u.rank);ctx.strokeText(s,p.x,p.y-3);ctx.fillText(s,p.x,p.y-3);
  if(u.ult&&u.ultCd<=0&&S.phase==='battle'){const g=proj(u.x,u.y,gy);ctx.beginPath();ctx.ellipse(g.x,g.y,pxU*.5,pxU*.5*SIN,0,0,7);ctx.strokeStyle=`rgba(255,160,110,${.55+.4*Math.sin(time*6)})`;ctx.lineWidth=3;ctx.stroke();}
  if(S.fortress>0){const g=proj(u.x,u.y,gy+.6);ctx.beginPath();ctx.arc(g.x,g.y,pxU*.55,0,7);ctx.strokeStyle='rgba(255,243,176,.8)';ctx.lineWidth=2.5;ctx.stroke();}
  let i=0;for(const k in u.st){ctx.fillStyle=ST_COLOR[k]||'#fff';ctx.beginPath();ctx.arc(p.x-w/2+4+i*8,p.y+11,3.5,0,7);ctx.fill();i++;}
  if(u.buff>1||u.defBuff>1||u.hasteBuff>1){const g=proj(u.x,u.y,gy+1.78);ctx.font=`400 11px ${FONT}`;ctx.fillStyle='#f2cf72';ctx.fillText((u.buff>1?'⚔':'')+(u.defBuff>1?'🛡':'')+(u.hasteBuff>1?'»':''),g.x,g.y);}
  const wn=warns.get(u.id);if(wn){wn.t-=dt;const g=proj(u.x,u.y,gy+.6),boss=S.enemies.find(en=>en.id===wn.boss);ctx.strokeStyle=`rgba(255,80,60,${.5+.5*Math.sin(time*16)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(g.x,g.y,pxU*.6,0,7);ctx.stroke();if(boss){const b=proj(boss.x,boss.y,1.2);ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(g.x,g.y);ctx.stroke();ctx.setLineDash([]);}if(wn.t<-1)warns.delete(u.id);}}
 if(aiming){const s=D.SKILLS[S.units.find(u=>u.id===aiming)?.ult];if(s&&hover&&hover.x!=null){ellipse(hover.x,hover.y,s.area);ctx.strokeStyle='#ff8a3d';ctx.lineWidth=2;ctx.stroke();}}
 // Effects
 for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.t+=dt;const k=Math.min(1,f.t/f.dur);if(f.t>=f.dur){fx.splice(i,1);continue;}
  if(f.k==='shot'){const a=proj(f.from.x,f.from.y,f.foe?.7:1),b=proj(f.to.x,f.to.y,f.foe?1:.6),x=a.x+(b.x-a.x)*k,y=a.y+(b.y-a.y)*k;ctx.strokeStyle=f.color;ctx.lineWidth=f.magic?4:2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-(b.x-a.x)*.12,y-(b.y-a.y)*.12);ctx.lineTo(x,y);ctx.stroke();}
  else if(f.k==='beam'){const a=proj(f.from.x,f.from.y,1.2),b=proj(f.to.x,f.to.y,.7);ctx.globalAlpha=1-k;ctx.strokeStyle='#ffe66b';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='slash'){const p=proj(f.x,f.y,.55);ctx.strokeStyle=f.color;ctx.globalAlpha=1-k;ctx.lineWidth=3+f.r*3;ctx.beginPath();ctx.ellipse(p.x,p.y,f.r*pxU*(.6+k*.5),f.r*pxU*.5*(.6+k*.5),-.5,Math.PI*(1.1+k*.6),Math.PI*(1.9+k*.6));ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='ring'){ellipse(f.x,f.y,f.r*(.35+.65*k));ctx.globalAlpha=(1-k)*.9;if(f.fill){ctx.fillStyle=f.color;ctx.globalAlpha=(1-k)*.38;ctx.fill();ctx.globalAlpha=(1-k)*.9;}ctx.strokeStyle=f.color;ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='bolt'){const p=proj(f.x,f.y,.2);ctx.strokeStyle=f.color;ctx.globalAlpha=1-k;ctx.lineWidth=4;ctx.beginPath();let x=p.x,y=p.y-pxU*3.2;ctx.moveTo(x,y);for(let j=1;j<=5;j++){x=p.x+(j<5?(Math.sin(j*7.3+f.x*5)*pxU*.25):0);y=p.y-pxU*3.2*(1-j/5);ctx.lineTo(x,y);}ctx.stroke();ctx.globalAlpha=1;}
  else if(f.k==='meteor'){if(k<.6){const q=k/.6,p=proj(f.x,f.y,6*(1-q));ctx.fillStyle='#ffb35c';ctx.beginPath();ctx.arc(p.x+pxU*1.5*(1-q),p.y,pxU*.34,0,7);ctx.fill();}else{const q=(k-.6)/.4;ellipse(f.x,f.y,f.r*(.4+.6*q));ctx.fillStyle=f.color;ctx.globalAlpha=(1-q)*.6;ctx.fill();ctx.globalAlpha=1;}}
  else if(f.k==='num'||f.k==='label'){const p=proj(f.x,f.y,(f.h||1)+k*.5);ctx.font=`400 ${(f.size||13)+2}px ${FONT}`;ctx.globalAlpha=k<.7?1:1-(k-.7)/.3;ctx.strokeStyle='rgba(12,22,26,.9)';ctx.lineWidth=3;ctx.strokeText(f.text,p.x,p.y);ctx.fillStyle=f.color;ctx.fillText(f.text,p.x,p.y);ctx.globalAlpha=1;}
  else if(f.k==='flash'){ctx.fillStyle=`rgba(240,90,70,${(1-k)*.3})`;ctx.fillRect(0,0,vw,vh);}}}
fxc.addEventListener('pointermove',e=>{if(!S)return;const p=localPoint(e);if(aiming)hover=unproj(p.x,p.y);else if(selCard&&!dragging)hover=tileAt(p);});

// ── 3D objects follow the simulation ──
function syncObjects(dt,time){
 for(const u of S.units){const key='u'+u.id;let o=objs.get(key);if(!o){o={g:modelFor('u:'+u.def,unitSpec(u.def)),lunge:0};unitGroup.add(o.g);objs.set(key,o);}
  const gy=groundY(u.x,u.y);o.lunge=Math.max(0,o.lunge-dt*6);const len=Math.hypot(u.face.dx,u.face.dy)||1,l=Math.sin(o.lunge*Math.PI)*.16;
  o.g.position.set(wx(u.x)+u.face.dx/len*l,gy,wz(u.y)+u.face.dy/len*l);const want=Math.atan2(u.face.dx,u.face.dy);let d=want-o.g.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));o.g.rotation.y+=d*Math.min(1,dt*14);}
 for(const e of S.enemies){const key='e'+e.id;let o=objs.get(key);if(!o){o={g:modelFor(`e:${e.kind}:${e.model}:${e.elite?1:0}:${e.scale||0}:${e.bossId??''}`,enemySpec(e)),lunge:0,flash:0,seed:e.id*1.7,air:e.flying?1:0};unitGroup.add(o.g);objs.set(key,o);}
  const moving=!e.st.freeze&&!e.st.stun&&!e.st.sleep&&!e.st.root;o.lunge=Math.max(0,o.lunge-dt*6);o.air+=((e.flying?1:0)-o.air)*Math.min(1,dt*3);
  const hop=moving?Math.abs(Math.sin(time*(e.engagedBy?3.5:7)+o.seed))*.07:0,l=Math.sin(o.lunge*Math.PI)*.14;
  o.g.position.set(wx(e.x)+e.dx*l,groundY(e.x,e.y)+.02+hop*(1-o.air)+o.air*(.8+Math.sin(time*3+o.seed)*.08),wz(e.y)+e.dy*l);o.g.rotation.y=Math.atan2(e.dx,e.dy);
  if(o.flash>0){o.flash-=dt;const s=1+o.flash*1.2;o.g.scale.set(s,1/s,s);}else o.g.scale.setScalar(1);}
 for(const [key,o] of objs){const id=+key.slice(1),alive=key[0]==='u'?S.units.some(u=>u.id===id):S.enemies.some(e=>e.id===id);if(!alive){objs.delete(key);unitGroup.remove(o.g);}}
 for(let i=dying.length-1;i>=0;i--){const d=dying[i];d.t+=dt;const k=1-d.t/.25;if(k<=0){unitGroup.remove(d.g);dying.splice(i,1);}else d.g.scale.setScalar(Math.max(.01,k));}}

let lastTime=0;
function frame(now){requestAnimationFrame(frame);const real=Math.min(.05,(now-lastTime)/1000||0);lastTime=now;if(!S){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,fxc.width,fxc.height);renderer.render(scene,camera);return;}
 const busy=S.phase==='battle'&&(selCard||selUnit||aiming),scale=paused||modalOpen?0:speed*(busy?.25:1);
 if(scale>0)S.step(real*scale);handleEvents();if(!S)return;
 const t=now/1000;syncObjects(real*(scale>0?Math.max(1,scale):1),t);if(water)water.material.uniforms.uTime.value=t;for(const f of animated)f(t);
 renderer.render(scene,camera);drawOverlay(real*(scale>0?Math.max(.5,scale):.5),t);updateHud();}

makePortraits();resize();showTitle();requestAnimationFrame(frame);
if(document.fonts&&document.fonts.load){document.fonts.load('16px "Stylish"');document.fonts.load('16px "Gowun Dodum"');}
window.TD={get sim(){return S;},startChapter,version:GAME_VERSION,proj:(x,y,h)=>proj(x,y,h)};
})();
