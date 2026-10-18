const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),fs=require('node:fs')
let browser
;(async()=>{
 const out='design/tail-2026-10-18',tags=process.argv.slice(2),records=[]
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const tag of tags){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2})
  await page.route('**/__qa_visual',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0}canvas{display:block;width:390px;height:844px}</style><canvas></canvas>'}))
  await page.goto('http://127.0.0.1:4110/__qa_visual')
  await page.evaluate(()=>{const native=requestAnimationFrame;let n=0;window.__captures=[];window.requestAnimationFrame=cb=>native(now=>{n++;if([60,90,120,180].includes(n)){const canvas=document.querySelector('canvas'),bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let hash=2166136261;for(const value of bytes)hash=Math.imul(hash^value,16777619);window.__captures.push({frame:n,hash:hash>>>0,png:canvas.toDataURL('image/png')})}cb(now)})})
  await page.addScriptTag({content:fs.readFileSync(out+'/bundle-'+tag+'.js.txt','utf8')})
  await page.evaluate(()=>window.battle({count:120,frames:180,catchUp:false,mature:true}))
  const captures=await page.evaluate(()=>window.__captures)
  for(const capture of captures){fs.writeFileSync(out+'/visual-'+tag+'-'+capture.frame+'.png',Buffer.from(capture.png.split(',')[1],'base64'));delete capture.png}
  records.push({tag,captures});await page.close()
 }
 await browser.close();fs.writeFileSync(out+'/visual-comparison.json',JSON.stringify(records,null,2));console.log(JSON.stringify(records))
 if(records.length===2&&records[0].captures.some((c,i)=>c.hash!==records[1].captures[i].hash))throw Error('Pixel equality failed')
})().catch(async e=>{await browser?.close();console.error(e);process.exitCode=1})
