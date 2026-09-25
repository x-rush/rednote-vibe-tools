import content from "./content/content.json";
import {createFlight,stepFlight,readRecord,commitRecord,clamp,createBeach,rockOutline,beachCoast,aimGesture} from "./model";
import type {Flight,Stone} from "./model";
import {LakeRenderer} from "./render";
import type {Camera,RenderState} from "./render";
import {Sound} from "./audio";
const $=(id:string)=>document.getElementById(id)!;
const copy=content.copy,app=$("app"),panel=$("panel"),hint=$("hint"),live=$("live"),tools=$("tools");
let beach=createBeach(innerWidth,innerHeight,content.stones,content.beach);
let pickup:{index:number;start:number}|null=null;
let stage="pick",selected:Stone=content.stones[0],power=0,angle=18,heading=0,flight:Flight|null=null,worldTime=0,throwStart=0,endTime=0,paused=false,viewMode=0,drag:{x:number;y:number;id:number;dx:number;dy:number;start:number;cancel:boolean}|null=null;
let accumulator=0,last=0,raf=0,throwId="",newBest=false,newJumps=false,noticeTimer=0;
let frameTotal=0,frameCount=0,frameSeconds=0;
let record=readRecord(null);try{record=readRecord(localStorage.getItem(content.records.storageKey));}catch{}
const camera:Camera={x:0,y:1.85,z:-5,tx:0,ty:.25,tz:7,focal:content.camera.focal};
function notice(text:string):void{$("notice").textContent=text;$("notice").style.display="block";clearTimeout(noticeTimer);noticeTimer=window.setTimeout(()=>{$("notice").style.display="none";},3000);}
const sound=new Sound(content.audio.gain,()=>notice(copy.silent));
const renderer=new LakeRenderer($("water") as HTMLCanvasElement,$("scene") as HTMLCanvasElement,()=>notice(copy.fallback));
$("title").textContent=content.meta.title;$("eyebrow").textContent=content.meta.eyebrow;
function renderTools():void{
 tools.innerHTML='<button id="sound" type="button"></button><button id="view" type="button"></button><button id="records-button" type="button"></button><button id="pause-button" type="button"></button>';
 $("sound").textContent=sound.enabled?copy.soundOn:copy.soundOff;$("sound").setAttribute("aria-pressed",String(sound.enabled));$("view").textContent=[copy.follow,copy.sideView,copy.distant][viewMode];$("pause-button").textContent=copy.pause;
 $("sound").onclick=async()=>{await sound.toggle();renderTools();};
 $("view").onclick=()=>{viewMode=(viewMode+1)%3;renderTools();};
 $("pause-button").onclick=()=>setPause(true);$("records-button").textContent=copy.myRecords;$("records-button").onclick=()=>showRecords();
}
function render():void{
 app.dataset.stage=stage;panel.innerHTML="";hint.textContent="";live.textContent="";
 if(stage==="pick"){
  hint.innerHTML="<b></b><span></span>";hint.querySelector("b")!.textContent=copy.pick;hint.querySelector("span")!.textContent=copy.pickSub;
  const grid=document.createElement("div");grid.className="shore-targets";
  beach.forEach((p,i)=>{const s=p.stone;if(s.mass>content.physics.referenceMass*5){s.hint=copy.heavyHint;if(!s.name.startsWith(copy.heavyName))s.name=copy.heavyName+s.name;}const button=document.createElement("button");button.type="button";button.className="shore-stone";button.setAttribute("aria-label",s.name+"，"+s.hint);button.dataset.stone=s.id;
   button.onclick=()=>{if(paused||stage!=="pick")return;clearTimeout(noticeTimer);$("notice").style.display="none";selected=s;renderer.shoreCache=null;pickup={index:i,start:worldTime};stage="lifting";power=0;angle=18;render();};grid.appendChild(button);});panel.appendChild(grid);positionShoreTargets();
 }else if(stage==="lifting"){
  hint.innerHTML="<b></b><span></span>";hint.querySelector("b")!.textContent=selected.name;hint.querySelector("span")!.textContent=selected.hint;
 }else if(stage==="ready"){
  hint.innerHTML="<b></b><span></span>";hint.querySelector("b")!.textContent=selected.name;hint.querySelector("span")!.textContent=copy.drag;
  panel.innerHTML='<button class="secondary" id="choose" type="button"></button>';
  $("choose").textContent=copy.choose;$("choose").onclick=()=>reset(true);
 }else if(stage==="result"&&flight){
  panel.innerHTML='<div class="result"><span class="badge"></span><h2></h2><div class="numbers"><div><strong id="count"></strong><span id="count-label"></span></div><div><strong id="distance"></strong><span id="distance-label"></span></div></div><p></p><div class="actions"><button class="secondary" id="back" type="button"></button><button class="primary" id="again" type="button"></button></div></div>';
  panel.querySelector(".badge")!.textContent=newBest&&newJumps?copy.bothRecords:newBest?copy.record:newJumps?copy.newJumps:copy.best+" "+record.best.toFixed(1)+" "+copy.meter;
  panel.querySelector("h2")!.textContent=copy.result;$("count").textContent=String(flight.jumps);$("count-label").textContent=copy.skips;$("distance").textContent=flight.distance.toFixed(1);$("distance-label").textContent=copy.distance;
  panel.querySelector("p")!.textContent=flight.jumps>=5?copy.good:flight.reason==="heavy"?copy.heavy:flight.reason==="steep"?copy.steep:flight.reason==="unstable"?copy.unstable:copy.slow;
  $("back").textContent=copy.back;$("back").onclick=()=>reset(true);$("again").textContent=copy.again;$("again").onclick=()=>reset(false);
 }else{hint.textContent=stage==="ending"?copy.ending:copy.flight;}
 renderTools();
}
function positionShoreTargets():void{
 if(stage!=="pick")return;
 const coast=[];for(let x=0;x<=innerWidth+8;x+=8)coast.push(x+"px "+beachCoast(x,innerWidth,innerHeight)+"px");
 const grid=panel.querySelector<HTMLElement>(".shore-targets");if(grid)grid.style.clipPath="polygon("+coast.join(",")+",100% 100%,0 100%)";
 panel.querySelectorAll<HTMLElement>(".shore-stone").forEach((el,i)=>{const p=beach[i],r=p.radius*1.2,size=r*2;
 el.style.left=(p.x-r)+"px";el.style.top=(p.y-r)+"px";el.style.width=size+"px";el.style.height=size+"px";
 el.style.clipPath="polygon("+rockOutline(p).map(q=>((q.x-p.x+r)/size*100)+"% "+((q.y-p.y+r)/size*100)+"%").join(",")+")";
 });
}
function launch():void{
 if(stage!=="ready"||paused)return;drag=null;app.classList.remove("dragging");
 flight=createFlight(selected,power,angle,heading,content.physics);throwStart=worldTime;throwId=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);stage="flight";accumulator=0;render();
}
function reset(pick:boolean):void{
 renderer.shoreCache=null;sound.stop();stage=pick?"pick":"ready";flight=null;pickup=null;heading=0;power=0;angle=content.gesture.defaultAngle;drag=null;worldTime=0;accumulator=0;Object.assign(camera,{x:0,y:1.85,z:-5,tx:0,ty:.25,tz:7});render();
}
function setPause(value:boolean):void{
 if(paused===value)return;paused=value;app.classList.toggle("paused",value);drag=null;power=0;delete app.dataset.aim;if(stage==="ready"){const span=hint.querySelector("span");if(span)span.textContent=copy.drag;}app.classList.remove("dragging");sound.stop();
 const overlay=$("pause");overlay.classList.remove("record-sheet");overlay.removeAttribute("role");overlay.removeAttribute("aria-modal");overlay.hidden=!value;
 if(value){overlay.innerHTML="<h2></h2><button class='primary' id='resume' type='button'></button>";overlay.querySelector("h2")!.textContent=copy.paused;$("resume").textContent=copy.resume;$("resume").onclick=()=>setPause(false);}
 last=0;
 if(!value&&!document.hidden&&!raf)raf=requestAnimationFrame(tick);
}
function moveCamera(dt:number):void{
 let x=0,y=1.85,z=-5,tx=0,ty=.25,tz=7;
 if(stage==="ready"){y=viewMode===2?2.5:1.45;z=viewMode===2?-7:-5;x=viewMode===1?1.2:0;tx=Math.sin(heading*.3)*7;ty=.12;}
 if(flight&&(stage==="flight"||stage==="ending"||stage==="result")){
  const f=flight,dx=Math.sin(f.heading),dz=Math.cos(f.heading);
  if(viewMode<2){x=f.x-dx*content.camera.distance+content.camera.side;z=f.z-dz*content.camera.distance;y=viewMode===0?1.05:2.1;if(viewMode===1){x=f.x+dz*4-dx*2;z=f.z-dx*4-dz*2;}tx=f.x+dx*content.camera.lead;tz=f.z+dz*content.camera.lead;ty=.22;}
  else{y=3.5;z=-9;tx=f.x*.4;tz=Math.max(12,f.z*.5);ty=0;}
 }
 const k=1-Math.exp(-dt*14);
 camera.x+=(x-camera.x)*k;camera.y+=(y-camera.y)*k;camera.z+=(z-camera.z)*k;camera.tx+=(tx-camera.tx)*k;camera.ty+=(ty-camera.ty)*k;camera.tz+=(tz-camera.tz)*k;
}
function finish():void{
 if(!flight)return;newBest=flight.distance>record.best;newJumps=flight.jumps>record.jumps;record=commitRecord(record,throwId,flight);try{localStorage.setItem(content.records.storageKey,JSON.stringify(record));}catch{notice(copy.savedFail);}
 stage="ending";endTime=worldTime;render();
}
function tick(ms:number):void{
 raf=0;if(document.hidden)return;const raw=last?(ms-last)/1000:0;const dt=Math.min(.05,raw);last=ms;
 if(!paused&&raw>0&&raw<.25&&renderer.gl){frameTotal+=raw;frameCount++;frameSeconds+=raw;if(frameSeconds>=4){const average=frameTotal/frameCount;if(average>.04&&!renderer.low){renderer.low=true;renderer.resize(innerWidth,innerHeight);notice(copy.low);}else if(average>.055&&renderer.low)renderer.simplify();frameTotal=0;frameCount=0;frameSeconds=0;}}
 if(!paused){
  worldTime+=dt;
  if(drag&&stage==="ready")updateAim();
  if(stage==="lifting"&&pickup&&worldTime-pickup.start>=.48){pickup=null;stage="ready";render();}
  if(stage==="flight"&&flight){accumulator+=dt;while(accumulator>=content.physics.step&&!flight.done){const event=stepFlight(flight,content.physics.step,content.physics);accumulator-=content.physics.step;if(event)sound.hit(event.strength,flight.stone.mass,event.bounce,event.index);}if(flight.done)finish();}
  if(stage==="ending"&&worldTime-endTime>.9){stage="result";render();}
  moveCamera(dt);
  if(flight&&(stage==="flight"||stage==="ending"))live.innerHTML="<strong>"+flight.jumps+"</strong>"+copy.times+" · "+flight.distance.toFixed(1)+" "+copy.meter;
 }
 const hits=flight?flight.hits.map(hit=>Object.assign({},hit,{time:throwStart+hit.time})):[];
 const state:RenderState={feedback:content.feedback,physics:content.physics,charging:!!drag,cancelAim:!!drag?.cancel,stage,time:worldTime,flight,stone:selected,angle,power,heading,camera,hits,beach,pickup:pickup?{index:pickup.index,progress:clamp((worldTime-pickup.start)/.48,0,1)}:null};renderer.draw(state);
 if(!paused)raf=requestAnimationFrame(tick);
}
function canDrag(x:number,y:number,target:EventTarget|null):boolean{
 if(stage!=="ready"||paused||!(target instanceof Element)||target.closest("button,input,#panel,#tools"))return false;
 const reserve=content.layout.hostWidth+content.layout.hostOffset+content.layout.hostMargin;
 const top=content.layout.hostHeight+content.layout.hostOffset+content.layout.hostMargin+44;
 if(y<top&&(x<reserve||x>innerWidth-reserve))return false;
 const cx=innerWidth*.5+(heading/.55)*innerWidth*.10,cy=innerHeight>innerWidth?innerHeight*.55:innerHeight*.52;
 return Math.hypot(x-cx,y-cy)<Math.min(100,Math.min(innerWidth,innerHeight)*.24);
}
function updateAim():void{
 if(!drag)return;const aim=aimGesture(drag.dx,drag.dy,(performance.now()-drag.start)/1000,innerWidth,innerHeight,content.gesture);
 power=drag.cancel?0:aim.power;angle=aim.angle;heading=aim.heading;
 const message=drag.cancel?copy.cancelThrow:power>=content.physics.sweetMin&&power<=content.physics.sweetMax?copy.sweet:copy.charging;const span=hint.querySelector("span");if(span&&span.textContent!==message)span.textContent=message;
 app.dataset.aim=drag.cancel?"cancel":power>=content.physics.sweetMin&&power<=content.physics.sweetMax?"sweet":"charging";
}
function begin(x:number,y:number,id:number,target:EventTarget|null):void{
 if(!canDrag(x,y,target))return;drag={x,y,id,dx:0,dy:0,start:performance.now(),cancel:false};power=0;app.classList.add("dragging");updateAim();
}
function move(x:number,y:number,id:number):void{
 if(!drag||drag.id!==id)return;drag.dx=x-drag.x;drag.dy=y-drag.y;drag.cancel=y>innerHeight-content.gesture.cancelBottom||x<0||x>innerWidth||y<0;updateAim();
}
function end(id:number,cancel:boolean):void{
 if(!drag||drag.id!==id)return;updateAim();const aim=aimGesture(drag.dx,drag.dy,(performance.now()-drag.start)/1000,innerWidth,innerHeight,content.gesture),throwIt=!cancel&&!drag.cancel&&aim.canThrow;
 drag=null;app.classList.remove("dragging");delete app.dataset.aim;
 if(throwIt)launch();else{power=0;const span=hint.querySelector("span");if(span)span.textContent=copy.drag;}
}
if("PointerEvent" in window){
 app.addEventListener("pointerdown",e=>{if(e.button!==0)return;if(drag){end(drag.id,true);return;}begin(e.clientX,e.clientY,e.pointerId,e.target);if(drag){try{app.setPointerCapture(e.pointerId);}catch{/* Synthetic input or a cancelled native pointer has no capture target. */}}});
 app.addEventListener("pointermove",e=>move(e.clientX,e.clientY,e.pointerId));app.addEventListener("pointerup",e=>{move(e.clientX,e.clientY,e.pointerId);end(e.pointerId,false);});app.addEventListener("pointercancel",e=>end(e.pointerId,true));app.addEventListener("lostpointercapture",e=>end(e.pointerId,true));
}else{
 app.addEventListener("touchstart",e=>{if(e.touches.length!==1){if(drag)end(drag.id,true);return;}const t=e.touches[0];begin(t.clientX,t.clientY,t.identifier,e.target);},{passive:true});
 app.addEventListener("touchmove",e=>{if(drag){const t=e.touches[0];move(t.clientX,t.clientY,t.identifier);e.preventDefault();}},{passive:false});
 app.addEventListener("touchend",e=>{if(drag){const t=e.changedTouches[0];if(t)move(t.clientX,t.clientY,t.identifier);end(drag.id,false);}});app.addEventListener("touchcancel",()=>{if(drag)end(drag.id,true);});
}
window.addEventListener("resize",()=>{if(drag||stage==="flight"||stage==="lifting")setPause(true);renderer.resize(innerWidth,innerHeight);if(stage==="pick"){beach=createBeach(innerWidth,innerHeight,content.stones,content.beach);render();}if(paused)tick(performance.now());});
document.addEventListener("visibilitychange",()=>{if(document.hidden){setPause(true);if(raf)cancelAnimationFrame(raf);raf=0;}else{last=0;if(!raf)raf=requestAnimationFrame(tick);}});
window.addEventListener("pagehide",()=>{sound.stop();if(raf)cancelAnimationFrame(raf);raf=0;});
renderer.resize(innerWidth,innerHeight);render();raf=requestAnimationFrame(tick);
// Read-only instrumentation for local QA; no game control or alternative result path.
Object.defineProperty(window,"stoneSample",{get:()=>({stage,paused,angle,power,renderer:renderer.gl?"webgl":"canvas",camera:Object.assign({},camera),flight:flight?{x:flight.x,y:flight.y,z:flight.z,jumps:flight.jumps,distance:flight.distance,time:flight.time,done:flight.done}:null,audio:{enabled:sound.enabled,voices:sound.sources.size},record:Object.assign({},record)})});

function showRecords():void{
 setPause(true);const overlay=$("pause");overlay.classList.add("record-sheet");overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label",copy.myRecords);
 overlay.innerHTML='<h2></h2><div class="record-grid"></div><p class="record-note"></p><button class="primary" id="close-records" type="button"></button>';
 overlay.querySelector("h2")!.textContent=copy.myRecords;
 const metrics=(target:Element,r:ReturnType<typeof readRecord>)=>{[[copy.recordDistance,r.best.toFixed(1)+" "+copy.meter],[copy.recordJumps,r.jumps+" "+copy.times],[copy.recordThrows,String(r.throws)]].forEach(([label,value])=>{const cell=document.createElement("div"),strong=document.createElement("strong"),span=document.createElement("span");strong.textContent=value;span.textContent=label;cell.appendChild(strong);cell.appendChild(span);target.appendChild(cell);});};
 metrics(overlay.querySelector(".record-grid")!,record);overlay.querySelector(".record-note")!.textContent=(record.throws?"":copy.recordEmpty+" ")+copy.recordNote;
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=copy.recentThrows;details.appendChild(summary);
 if(!record.history.length){const p=document.createElement('p');p.textContent=copy.historyEmpty;details.appendChild(p);}
 record.history.forEach(r=>{const b=document.createElement('button');b.className='history-throw';b.textContent=r.stone.name+' · '+r.jumps+' '+copy.times+' · '+r.distance.toFixed(1)+' '+copy.meter;const sub=document.createElement('span');sub.textContent=copy.powerLabel+' '+Math.round(r.power*100)+'% · '+copy.angleLabel+' '+r.angle.toFixed(1)+'° · '+copy.massLabel+' '+Math.round(r.stone.mass*1000)+'g · '+copy.retryRecord;b.appendChild(sub);b.onclick=()=>{selected={...r.stone};setPause(false);reset(false);};details.appendChild(b);});
 overlay.insertBefore(details,$('close-records'));const goals=document.createElement('details'),goalSummary=document.createElement('summary');goalSummary.textContent=copy.stoneNotes+' · '+copy.learned+' '+record.learned.length+'/'+content.practiceGoals.length;goals.appendChild(goalSummary);const clue=document.createElement('p');clue.textContent=copy.stoneClue;goals.appendChild(clue);content.practiceGoals.forEach(goal=>{const p=document.createElement('p');p.textContent=(record.learned.includes(goal.id)?'✓ ':'')+goal.name+' · '+(goal.jumps?goal.jumps+' '+copy.times:goal.distance+' '+copy.meter);goals.appendChild(p);});overlay.insertBefore(goals,$('close-records'));
 $("close-records").textContent=copy.closeRecords;$("close-records").onclick=()=>setPause(false);app.scrollTop=0;app.scrollLeft=0;$("close-records").focus();
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&paused)setPause(false);if(e.key==="Tab"&&paused){const items=Array.from($("pause").querySelectorAll<HTMLElement>('button,summary')).filter(v=>v.offsetWidth>0&&v.offsetHeight>0);if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||!$("pause").contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!$("pause").contains(document.activeElement))){e.preventDefault();first.focus();}}});
