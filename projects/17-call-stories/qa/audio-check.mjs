// Production audio QA against the local app only; excluded from release.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),profile=join(root,'qa/output/.audio-browser');
const content=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
const files=[content.ringtone.file,...content.callScripts.flatMap(s=>s.segments.map(x=>x.file))];
const data=Object.fromEntries(await Promise.all(files.map(async f=>[f,(await readFile(join(root,'assets/audio',f))).toString('base64')])));
const bank=(await readFile(join(root,'src/audio-bank.mjs'),'utf8')).replace('export function','function');
const player=(await readFile(join(root,'src/call-player.mjs'),'utf8')).replace('export function','function');
await mkdir(profile,{recursive:true});
const child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9329',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let ws,id=0;const pending=new Map();
function command(method,params={}){return new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
try{
  let target;for(let i=0;i<80;i++){try{target=(await fetch('http://127.0.0.1:9329/json/list').then(r=>r.json())).find(t=>t.type==='page');if(target)break;}catch{}await wait(100);}
  if(!target)throw Error('Chrome unavailable');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
  await command('Page.navigate',{url:'http://127.0.0.1:4317'});await wait(500);
  const result=await evaluate(`(async()=>{
    ${bank}\n${player}
    const data=${JSON.stringify(data)},scripts=${JSON.stringify(content.callScripts)};
    const ctx=new AudioContext(),decoded=[];const nativeDecode=ctx.decodeAudioData.bind(ctx);
    ctx.decodeAudioData=(bytes,ok,fail)=>nativeDecode(bytes,b=>{decoded.push({duration:b.duration,channels:b.numberOfChannels,bytes:b.length*b.numberOfChannels*4});ok(b)},fail);
    const bank=createAudioBank(data,()=>ctx),played=[];
    for(const file of Object.keys(data)){const a=bank.create(file);await a.play();if(a.paused)throw Error('Did not start '+file);a.muted=true;a.pause();if(!a.paused)throw Error('Did not stop '+file);played.push(file);}
    const cancelled=bank.create(scripts[0].segments[0].file);const pending=cancelled.play();cancelled.pause();await pending;if(!cancelled.paused)throw Error('Decode cancellation failed');
    let missing=false;try{await bank.create('missing.mp3').play()}catch{missing=true}if(!missing)throw Error('Missing audio accepted');
    const events=[],p=createCallPlayer({audioFactory:file=>bank.create(file)});
    await new Promise((resolve,reject)=>{p.start({script:scripts[0],mode:'full',pause:0,available:Object.keys(data),onSegment:i=>events.push({i,time:ctx.currentTime}),onError:()=>reject(Error('Playback fallback')),onEnd:resolve});});
    if(events.length!==3)throw Error('Sequence incomplete');p.stop();
    await new Promise((resolve,reject)=>{p.start({script:scripts.find(s=>s.id==='miss-you'),mode:'intro',available:Object.keys(data),onWaiting:resolve,onError:()=>reject(Error('Intro fallback')),onEnd:()=>reject(Error('Intro unexpectedly ended'))});});p.stop();
        const companyEvents=[];let companyWaits=0;
    await new Promise((resolve,reject)=>{p.start({script:scripts.find(s=>s.id==='company'),mode:'full',pause:0,available:Object.keys(data),onSegment:i=>companyEvents.push({i,time:ctx.currentTime}),onWaiting:()=>{if(++companyWaits===2)setTimeout(resolve,500)},onError:()=>reject(Error('Company fallback')),onEnd:()=>reject(Error('Company should stay connected'))});});
    if(companyEvents.length!==2||Math.abs(companyEvents[1].time-companyEvents[0].time-6.6)>0.3)throw Error('Company pause incorrect');p.stop();
bank.clear();await ctx.close();return {passed:true,played,decoded,events,companyEvents,decodedTotalBytes:decoded.reduce((sum,x)=>sum+x.bytes,0),notes:['Real MP3 byte decoding and BufferSource playback; not a human assessment of vocal performance.','Full basketball sequence and intro-only miss-you verified.']};
  })()`);
  const failurePrompt=await evaluate("(async()=>{AudioContext.prototype.resume=()=>Promise.reject(Error('QA unavailable'));document.querySelector('[data-action=edit-call]').click();document.querySelector('[data-action=start]').click();document.querySelector('[data-action=accept]').click();await new Promise(r=>setTimeout(r,100));const text=document.querySelector('.toast')?.textContent;if(!text?.includes('无声体验'))throw Error('Missing audio failure prompt');document.querySelector('[data-action=hangup]').click();return text;})()");result.failurePrompt=failurePrompt;await writeFile(join(root,'qa/output/audio-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{ws?.close();child.kill();await wait(500);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
