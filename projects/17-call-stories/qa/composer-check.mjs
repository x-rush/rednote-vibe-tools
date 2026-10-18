import {spawn} from 'node:child_process';import {mkdir,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=9338;
const child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${join(root,'qa/output/.composer-browser-profile')}`,'about:blank'],{stdio:'ignore'});
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

  await evaluate("localStorage.removeItem('call-stories:studio-v2')");await command('Page.reload',{ignoreCache:true});await until("!!document.querySelector('.studio-hero')");await click('[data-tab=chat]');
  const snap=async name=>{const r=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(root,'qa/output',name+'.png'),Buffer.from(r.data,'base64'));};
  for(const width of [375,390,430,844]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:width===844?390:844,deviceScaleFactor:1,mobile:true});await evaluate("document.documentElement.style.setProperty('--safe-area-inset-top','24px');document.documentElement.style.setProperty('--safe-area-inset-bottom','16px')");
    await click('[data-action=preview-add-self]');await assert("document.querySelectorAll('[data-composer-kind]').length===9",'Missing type choices');
    if(width===390)await snap('composer-types-390');
    await assert("(()=>{const s=document.querySelector('.message-composer').getBoundingClientRect(),b=document.querySelector('.composer-close').getBoundingClientRect();return s.top>=72&&s.width<=innerWidth&&s.bottom<=innerHeight&&b.top>=72})()",'Sheet overlaps host control zone');
    await click('[data-composer-kind=voice]');await assert("!document.querySelector('.chat-body .chat-edit-card')&&!document.querySelector('.message-composer .studio-message')&&document.querySelectorAll('.message-composer .composer-person').length===1",'Legacy nested editor remains');
    await change('[data-composer-field=seconds]','8');if(width===390)await snap('composer-voice-390');
    await assert("(()=>{const f=document.querySelector('.composer-footer').getBoundingClientRect();return f.bottom<=innerHeight&&f.top>72&&document.documentElement.scrollWidth<=innerWidth})()",'Footer clipped or horizontal overflow');
    await click('[data-action=composer-cancel]');
  }
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  for(const side of ['self','other'])for(const kind of ['text','voice','image','location','transfer','redpacket','contact','narration']){
    const before=await evaluate("JSON.parse(localStorage.getItem('call-stories:studio-v2')||'null')?.chat.messages.length||3");await click(`[data-action=preview-add-${side}]`);await click(`[data-composer-kind=${kind}]`);
    if(kind==='text'||kind==='narration')await change('[data-composer-field=text]','新面板里的消息');
    if(kind==='voice'){await change('[data-composer-field=seconds]','6');await evaluate("document.querySelector('.composer-transcript').open=true");await change('[data-composer-field=transcript]','到门口了');await change('[data-composer-field=showTranscript]',true);}
    if(kind==='image'){await upload('[data-composer-upload]',[join(root,'assets/avatars/guest-01.svg')]);await until("!!document.querySelector('.composer-upload img')");}
    if(kind==='contact'){await click('[data-action=composer-contact]');await click('[data-composer-person=tea-lamp]');}
    await click('[data-action=chat-commit]');await assert("!document.querySelector('.message-composer')",'Editor failed to close');await assert("(JSON.parse(localStorage.getItem('call-stories:studio-v2')).chat.messages.at(-1).kind||'text')==="+JSON.stringify(kind),'Wrong message kind');
    await assert("JSON.parse(localStorage.getItem('call-stories:studio-v2')).chat.messages.length==="+(before+1),'Add did not append exactly once');
  }
  await evaluate("window.beforeCancel=localStorage.getItem('call-stories:studio-v2')");await click('[data-chat-edit="0"]');await change('[data-composer-field=text]','取消后不能保存');await click('[data-action=composer-cancel]');await assert("window.beforeCancel===localStorage.getItem('call-stories:studio-v2')",'Cancel changed the draft');
  await click('[data-action=preview-add-self]');await click('[data-composer-kind=image]');await upload('[data-composer-upload]',[join(root,'assets/avatars/guest-02.svg')]);await until("!!document.querySelector('.composer-upload img')");await click('[data-action=composer-types]');await click('[data-action=composer-cancel]');await assert("window.beforeCancel===localStorage.getItem('call-stories:studio-v2')",'Cancelled upload persisted');
  await assert("!localStorage.getItem('call-stories:studio-v2').includes('blob:')",'Media persisted');
  await click('[data-action=preview-chat]');await click('[data-action=save-image]');await until("!!document.querySelector('.image-result>img')");await assert("!document.querySelector('.export-surface .message-composer')",'Sheet leaked into PNG');await assert("qaErrors.length===0",'Browser errors');
  await writeFile(join(root,'qa/output/composer-report.json'),JSON.stringify({passed:true,widths:[375,390,430,844],checks:['all eight types on both sides','cancel preserves draft','upload and cancel','contact selection','host-safe sheet and footer','clean PNG'],nativeHostTested:false},null,2));console.log('Message composer checks passed');
}finally{ws?.close();child.kill();await wait(600);await rm(join(root,'qa/output/.composer-browser-profile'),{recursive:true,force:true,maxRetries:5,retryDelay:300});}
