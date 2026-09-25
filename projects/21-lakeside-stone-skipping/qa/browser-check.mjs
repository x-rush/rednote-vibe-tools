import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'qa/output');await mkdir(out,{recursive:true});
const port=9331;const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+port,'--user-data-dir='+join(out,'browser-profile'),'about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,sequence=0;const pending=new Map(),errors=[],report=[];
const visual=process.argv.includes('--visual');
function command(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await sleep(70);}throw Error('Timeout '+expression);}
async function shot(name){await evaluate(`(()=>{for(const side of ['left','right']){const d=document.createElement('div');d.className='qa-host';d.textContent=side==='left'?'‹':'•••';d.style.cssText='position:fixed;top:44px;'+side+':16px;width:72px;height:44px;border-radius:24px;background:#24313a88;color:white;display:grid;place-items:center;z-index:99999;pointer-events:none;font:24px sans-serif';document.body.appendChild(d);}})()`);const r=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));await evaluate("document.querySelectorAll('.qa-host').forEach(x=>x.remove())");}
async function pickStone(){await evaluate(`(()=>{for(const e of document.querySelectorAll('.shore-stone')){const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(x>40&&x<innerWidth-40&&y>innerHeight*.6&&y<innerHeight-100&&document.elementFromPoint(x,y)===e){e.click();return;}}throw Error('No exposed stone');})()`);await until("window.stoneSample.stage==='ready'");}
async function throwStone(){const [x,y]=await evaluate('[innerWidth*.5,innerHeight>innerWidth?innerHeight*.55:innerHeight*.52]');await command('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await sleep(1100);await command('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}
async function click(id){await evaluate('document.getElementById('+JSON.stringify(id)+').click()');}
async function check(name,w){const r=await evaluate(`(()=>{const host=[{l:0,r:124,t:0,b:156},{l:innerWidth-124,r:innerWidth,t:0,b:156}],bad=[];for(const el of document.querySelectorAll('button:not(.shore-stone),#identity')){const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;if(r.top<0||r.left<0||r.right>innerWidth+1||r.bottom>innerHeight+1)bad.push('offscreen '+(el.id||el.textContent));if(host.some(h=>r.left<h.r&&r.right>h.l&&r.top<h.b&&r.bottom>h.t))bad.push('host '+(el.id||el.textContent));}return{width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,bad,renderer:window.stoneSample.renderer};})()`);if(r.width!==w||r.overflow||r.bad.length)throw Error(name+' '+JSON.stringify(r));report.push({name,...r});}
try{
 let target;for(let i=0;i<80;i++){try{target=(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(x=>x.type==='page');if(target)break;}catch{}await sleep(100);}if(!target)throw Error('Chrome unavailable');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);};
 await command('Page.enable');await command('Runtime.enable');
 for(const [w,h] of (visual?[[390,844]]:[[375,812],[390,844],[430,932],[667,375],[844,390],[932,430]])){
  await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});
  await command('Page.navigate',{url:'http://127.0.0.1:4321'});await until('!!window.stoneSample');await evaluate("document.documentElement.style.setProperty('--safe-area-inset-top','44px');document.documentElement.style.setProperty('--safe-area-inset-bottom','34px')");
  await sleep(250);await check('pick-'+w,w);if(w===390)await shot('pick-390');
  await pickStone();await until("window.stoneSample.stage==='ready'");await check('ready-'+w,w);if(w===390)await shot('ready-390');
  await throwStone();await until("window.stoneSample.stage==='flight'");await check('flight-'+w,w);if(w===390)await shot('follow-390');
  await click('pause-button');const before=await evaluate('window.stoneSample.flight.time');await sleep(150);if(await evaluate('window.stoneSample.flight.time')!==before)throw Error('pause does not freeze');await check('pause-'+w,w);await click('resume');
  await until("window.stoneSample.stage==='result'");await check('result-'+w,w);if(w===390)await shot('result-390');
  await click('again');await until("window.stoneSample.stage==='ready'");await click('view');await throwStone();await until("window.stoneSample.stage==='result'");await click('back');await check('return-'+w,w);
 }
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await command('Page.navigate',{url:'http://127.0.0.1:4321'});await until('!!window.stoneSample');await click('sound');
 if(!await evaluate('window.stoneSample.audio.enabled'))throw Error('Audio did not unlock');
 await pickStone();await until("window.stoneSample.stage==='ready'");
 await throwStone();
 await until('window.stoneSample.flight && window.stoneSample.flight.time>0');await click('sound');if(await evaluate('window.stoneSample.audio.voices')!==0)throw Error('Mute leaves source voices');
 await until("window.stoneSample.stage==='result'");
 await evaluate("document.getElementById('water').getContext('webgl').getExtension('WEBGL_lose_context').loseContext()");await until("window.stoneSample.renderer==='canvas'");await click('again');await throwStone();await until("window.stoneSample.stage==='result'");await shot('fallback-390');
 if(errors.length)throw Error('Browser errors '+errors.join(','));
 await writeFile(join(out,visual?'visual-report.json':'report.json'),JSON.stringify({passed:true,checks:report,exceptions:errors,notes:['Desktop headless Chrome with software WebGL; not phone GPU performance evidence.','44px top/34px bottom safe area and conservative host rectangles checked.','Real-device Xiaohongshu and Chrome61 remain unverified.']},null,2));console.log(JSON.stringify({passed:true,checks:report.length,errors}));
}finally{if(ws)ws.close();chrome.kill();}
