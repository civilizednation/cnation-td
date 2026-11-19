// Renders the guide pictures painters draw battlefield backgrounds over: node tools/make-guides.js [mapId ...]
// Writes art/guides/<map>.png (the 3D terrain from the game camera, 1080×1920, 9:16) and <map>.json (tiles, used by
// tools/fit-art.py) for every map, or only those named.
// The game shows a painting in exactly this frame (MAP_ART in js/data.js); see docs/ART.md.
const {chromium}=require('playwright'),{spawn}=require('child_process'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),port=8790+Math.floor(Math.random()*100);
(async()=>{const srv=spawn('python3',['-m','http.server',String(port)],{cwd:root,stdio:'ignore'});await new Promise(r=>setTimeout(r,800));
 try{const b=await chromium.launch(),p=await (await b.newContext({viewport:{width:390,height:780},serviceWorkers:'block'})).newPage();
  await p.goto(`http://localhost:${port}/`);await p.waitForFunction(()=>window.TD&&window.TDData);
  const chapters=await p.evaluate(()=>TDData.CHAPTERS.map(c=>c.map)),want=process.argv.slice(2);
  fs.mkdirSync(path.join(root,'art/guides'),{recursive:true});
  for(let i=0;i<chapters.length;i++){const id=chapters[i];if(want.length&&!want.includes(id))continue;
   const {url,info}=await p.evaluate(i=>TD.renderGuide(i),i);fs.writeFileSync(path.join(root,'art/guides',id+'.png'),Buffer.from(url.split(',')[1],'base64'));
   fs.writeFileSync(path.join(root,'art/guides',id+'.json'),JSON.stringify(info));console.log('art/guides/'+id+'.png');}
  await b.close();}finally{srv.kill();}})();
