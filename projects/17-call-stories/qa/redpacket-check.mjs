import {spawn} from 'node:child_process';import {mkdir,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=9342;
const child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${join(root,'qa/output/.redpacket-browser-profile')}`,'about:blank'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let ws,sequence=0;const pending=new Map(),report=[];
function command(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function until(expression){for(let i=0;i<140;i++){if(await evaluate(expression))return;await wait(100);}throw Error('Timed out: '+expression);}
async function assert(expression,message){if(!await evaluate(expression))throw Error(message);}
async function click(selector){await assert(`!!document.querySelector(${JSON.stringify(selector)})`,'Missing '+selector);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
async function change(selector,value){await evaluate(`(()=>{const t=document.querySelector(${JSON.stringify(selector)});if(!t)throw Error('Missing input');${typeof value==='boolean'?`t.checked=${value}`:`t.value=${JSON.stringify(value)}`};t.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function upload(selector,files){const {root:doc}=await command('DOM.getDocument');const {nodeId}=await command('DOM.querySelector',{nodeId:doc.nodeId,selector});await command('DOM.setFileInputFiles',{nodeId,files});await wait(100);}
try{await mkdir(join(root,'qa/profile'),{recursive:true});let target;for(let i=0;i<80;i++){try{target=(await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json())).find(x=>x.type==='page');if(target)break;}catch{}await wait(100);}if(!target)throw Error('Chrome unavailable');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.onmessage=event=>{const m=JSON.parse(event.data);const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);};await command('Page.enable');await command('Runtime.enable');
  await command('Page.addScriptToEvaluateOnNewDocument',{source:"window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)))"});
  await command('Page.navigate',{url:process.env.PREVIEW_URL||'http://127.0.0.1:4318'});await until("!!document.querySelector('.studio-hero')");


  const fixtures=[{kind:'redpacket',personId:'self',text:'恭喜发财，大吉大利',status:'pending'},{kind:'redpacket',personId:'self',text:'恭喜发财，大吉大利',status:'received'},{kind:'redpacket',personId:'basketball',text:'恭喜发财，大吉大利',status:'pending'},{kind:'redpacket',personId:'basketball',text:'恭喜发财，大吉大利',status:'received'}];
  for(const width of [375,390,430]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:2,mobile:true});await evaluate(`localStorage.setItem('call-stories:studio-v2',JSON.stringify({chat:{messages:${JSON.stringify(fixtures)}}}))`);await command('Page.reload',{ignoreCache:true});await until("!!document.querySelector('.studio-hero')");await evaluate("document.documentElement.style.setProperty('--safe-area-inset-top','24px')");await click('[data-tab=chat]');await click('[data-action=preview-chat]');
    await assert("document.querySelectorAll('.redpacket-card').length===4&&document.querySelectorAll('.redpacket-receipt').length===2",'Redpacket states/receipts missing');
    await assert("(()=>{const c=[...document.querySelectorAll('.redpacket-card')];return c.every(x=>Math.abs(x.getBoundingClientRect().height-84)<1)&&getComputedStyle(c[0]).backgroundColor==='rgb(255, 145, 0)'&&getComputedStyle(c[3]).backgroundColor==='rgb(255, 201, 143)'})()",'Redpacket dimensions or color do not match reference');
    await assert("document.querySelectorAll('.redpacket-icon.opened').length===1",'Own received packet should stay closed');
    if(width===390){const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(root,'qa/output/redpacket-preview-390.png'),Buffer.from(shot.data,'base64'));}
    await evaluate("window.saved=[];window.xhs={miniTool:{saveImageToPhotosAlbum:async o=>saved.push(o.filePath)}}");await click('[data-action=save-image]');await until("saved.length>0&&!document.querySelector('[data-action=save-image]').disabled");
    await assert("(()=>{const s=localStorage.getItem('call-stories:studio-v2');return s.includes('received')&&!s.includes('blob:')})()",'Redpacket draft invalid');
    if(width===390){const png=await evaluate("saved[0].split(',')[1]");await writeFile(join(root,'qa/output/redpacket-export-390.png'),Buffer.from(png,'base64'));}
    await assert("qaErrors.length===0",'Redpacket rendering caused errors');console.log('Redpacket reference checks passed '+width);
  }
}finally{ws?.close();child.kill();await wait(600);await rm(join(root,'qa/output/.redpacket-browser-profile'),{recursive:true,force:true,maxRetries:5,retryDelay:300});}
