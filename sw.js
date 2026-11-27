// cnation TD service worker: lets the game be added to the home screen and opened offline.
// Network first, so a new deploy shows up on the next open; the cache is only a fallback. Music is cache-first (large, never changes).
const VERSION='1.7.22',CACHE='cnation-td-'+VERSION;
const CORE=['./','index.html','manifest.webmanifest','vendor/three-r170.js','js/data.js','js/sim.js','js/models.js','js/game.js','fonts/stylish.woff2','fonts/gowun-dodum.woff2','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-64.png','revisions.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cnation-td-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
 if(req.headers.has('range'))return;   // audio range requests go straight to the network
 const music=/\/(bgm|sfx|art)\//.test(new URL(req.url).pathname);   // music, sounds and paintings never change under the same ?v=
 if(music){e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok&&res.status===200){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;})));return;}
 e.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;}).catch(()=>caches.match(req,{ignoreSearch:true}).then(hit=>hit||caches.match('index.html'))));});
