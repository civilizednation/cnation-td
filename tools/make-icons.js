// Writes icons/*.png from tools/icon.html. Run from the repository root while `python3 -m http.server 8765` serves it:
//   node tools/make-icons.js
const {chromium}=require('playwright'),fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}),p=await b.newPage();
 await p.goto('http://localhost:8765/tools/icon.html');await p.waitForFunction(()=>window.ICON);
 const sizes={'icons/icon-512.png':[512,0],'icons/icon-192.png':[192,0],'icons/apple-touch-icon.png':[180,0],'icons/icon-maskable-512.png':[512,.1],'icons/favicon-64.png':[64,0]};
 for(const [file,[size,pad]] of Object.entries(sizes)){const data=await p.evaluate(([size,pad])=>new Promise(res=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');x.fillStyle='#0e2328';x.fillRect(0,0,size,size);const m=size*pad;x.imageSmoothingQuality='high';x.drawImage(img,m,m,size-2*m,size-2*m);res(c.toDataURL('image/png').split(',')[1]);};img.src=window.ICON;}),[size,pad]);
  fs.writeFileSync(file,Buffer.from(data,'base64'));console.log(file,size);}
 await b.close();})();
