import C from './content/content.json';
export type Stage='ready'|'cast'|'wait'|'nibble'|'bite'|'fight'|'net'|'caught'|'miss'|'release';
export interface Run {id:string;seed:number;spot:number;bait:number;kind:number;length:number;size:number;phase:Stage;time:number;elapsed:number;wait:number;bite:number;x:number;y:number;targetX:number;targetY:number;line:number;tension:number;stamina:number;strain:number;slack:number;safe:number;steer:number;surges:number;netTime:number;reason:string;submitted:boolean;mode:'free'|'daily'|'practice'|'challenge';challenge:number;date:string;accuracy:number;peakTension:number;strikeLag:number;netMisses:number;castPower:number;}
export interface Record {kind:number;count:number;max:number;spots:number[];}
export interface Save {version:number;rulesVersion:number;run:Run;records:Record[];completed:number[];history:{seed:number;spot:number;bait:number;kind:number;length:number}[];claims:string[];settings:{sound:boolean;assist:boolean;reduced:boolean};}
export const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
export function castLanding(y:number,power:number){return clamp(.73-clamp(power)*.38+(y-.5)*.2,.35,.68);}
export function castFlight(u:number,from:{x:number;y:number},to:{x:number;y:number},height:number){u=clamp(u);const travel=1-Math.pow(1-u,1.4);return{x:from.x+(to.x-from.x)*travel,y:from.y+(to.y-from.y)*travel-Math.sin(u*Math.PI)*height};}
export function random(seed:number){let s=seed>>>0;s=Math.imul(s^(s>>>16),0x21f0aaad);s=Math.imul(s^(s>>>15),0x735a2d97);s=(s^(s>>>15))>>>0;return()=>((s=Math.imul(s,1664525)+1013904223)>>>0)/4294967296;}
export function localDay(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
export function daySeed(day=localDay()){let n=2166136261;for(let i=0;i<day.length;i++)n=Math.imul(n^day.charCodeAt(i),16777619);return n>>>0;}
export function createRun(seed:number,spot=0,bait=0,mode:Run['mode']='free',challenge=-1):Run {const rand=random(seed+spot*7919+bait*389),pool=C.spots[spot].pool,weighted=pool.reduce<number[]>((a,k)=>a.concat(Array(C.baitPreferences[bait].includes(k)?3:1).fill(k)),[]),kind=weighted[Math.floor(rand()*weighted.length)],size=rand(),fish=C.fish[kind];return{id:seed+':'+spot+':'+bait,seed,spot,bait,kind,length:Math.round((fish.min+(fish.max-fish.min)*size)*10)/10,size,phase:'ready',time:0,elapsed:0,wait:8+rand()*10,bite:1.1+rand()*.3,x:.5,y:.5,targetX:.5,targetY:.48,line:1,tension:.4,stamina:1,strain:0,slack:0,safe:0,steer:0,surges:0,netTime:0,reason:'',submitted:false,mode,challenge,date:localDay(),accuracy:0,peakTension:0,strikeLag:0,netMisses:0,castPower:0};}
export function newSave(seed=Date.now()>>>0):Save{return{version:1,rulesVersion:2,run:createRun(seed),records:[],completed:[],history:[],claims:[],settings:{sound:false,assist:false,reduced:false}};}
export function cast(r:Run,x:number,y:number,power:number){if(r.phase!=='ready'||power<.12||!Number.isFinite(x+y+power))return false;r.targetX=clamp(x,.18,.82);r.targetY=castLanding(y,power);r.castPower=clamp(power);const target=C.spots[r.spot].target;r.accuracy=clamp(1-Math.hypot(r.targetX-target[0],r.targetY-target[1])/.4);r.wait*=1.7-r.accuracy*.9;r.bite*=.8+r.accuracy*.25;r.x=r.targetX;r.y=r.targetY;r.line=.7+clamp(power)*.5;r.phase='cast';r.time=0;return true;}
function phase(r:Run,p:Stage){r.phase=p;r.time=0;}
export function strike(r:Run){if(r.phase==='bite'){r.strikeLag=r.time;phase(r,'fight');r.tension=.42;return true;}if(r.phase==='wait'||r.phase==='nibble'){r.reason='early';phase(r,'miss');}return false;}
export function surge(r:Run){const f=C.families[C.fish[r.kind].family],cycle=f.rest+f.burst;return r.time%cycle>f.rest;}
export function step(r:Run,dt:number,reel=false,steer=0,assist=false){dt=clamp(dt,0,.05);r.time+=dt;r.elapsed+=dt;
 if(r.phase==='cast'&&r.time>=1.05)phase(r,'wait');
 else if(r.phase==='wait'&&r.time>=r.wait)phase(r,'nibble');
 else if(r.phase==='nibble'&&r.time>=2.5+(r.seed%3)*.35)phase(r,'bite');
 else if(r.phase==='bite'&&r.time>r.bite+(assist?.8:0)){r.reason='late';phase(r,'miss');}
 else if(r.phase==='fight'){
  if(r.time<.4)return;
  const family=C.families[C.fish[r.kind].family],rush=surge(r),previous=r.steer;r.steer+=(clamp(steer,-1,1)-r.steer)*(1-Math.exp(-dt*10));
  const pull=(rush?family.force:.22)+r.size*.12,target=clamp(pull+(reel?.36:-.18)+Math.abs(r.steer)*.025,.04,1.18);
  r.tension+=(target-r.tension)*(1-Math.exp(-dt*3.5));r.peakTension=Math.max(r.peakTension,r.tension);r.strain=r.tension>.9?r.strain+dt:Math.max(0,r.strain-dt*2);r.slack=r.tension<.1?r.slack+dt:0;
  if(r.tension>=.3&&r.tension<=.78){r.safe+=dt;r.stamina=Math.max(0,r.stamina-dt*(.023+(reel?.012:0))/(.8+r.size*.5));}
  r.line=clamp(r.line+dt*(rush?.016:0)-dt*(reel&&r.tension<.9?.034:0),.08,1.4);
  const nextX=clamp(r.targetX+Math.sin(r.time*family.sway)*(.055+(rush?.09:0))-r.steer*.08,.16,.84),nextY=clamp(.77-r.line*.3,.35,.75);r.x+=(nextX-r.x)*(1-Math.exp(-dt*5));r.y+=(nextY-r.y)*(1-Math.exp(-dt*5));
  if(previous!==r.steer&&Math.abs(r.steer)>.5)r.surges=1;
  if(r.strain>.7){r.reason='break';phase(r,'miss');}else if(r.slack>1.2&&rush){r.reason='slack';phase(r,'miss');}
  else if(r.line<=.18&&r.stamina<=.16)phase(r,'net');
 }
}
export function net(r:Run,x:number,y:number,dt:number){if(r.phase!=='net')return false;if(Math.hypot(r.x-x,r.y-y)>=.095&&r.netTime>0)r.netMisses++;r.netTime=Math.hypot(r.x-x,r.y-y)<.095?r.netTime+clamp(dt,0,.05):0;if(r.netTime>=.3){phase(r,'caught');return true;}return false;}
export function challengeMet(r:Run,index:number){if(r.phase!=='caught'||r.spot!==Math.floor(index/4))return false;switch(C.challenges[index].rule){case 'landing':return r.accuracy>=.7;case 'timing':return r.strikeLag<=.6;case 'steady':return r.peakTension<=.9;case 'net':return r.netMisses===0;case 'far':return r.castPower>=.7;case 'safe':return r.safe>=20;case 'steered':return r.surges>0;case 'efficient':return r.elapsed<=120;default:return false;}}
export function commit(s:Save){const r=s.run;if(r.phase!=='caught'||r.submitted)return false;r.submitted=true;if(r.mode==='practice'||s.claims.includes(r.id))return false;
 let record=s.records.find(v=>v.kind===r.kind);if(!record){record={kind:r.kind,count:0,max:0,spots:[]};s.records.push(record);}record.count=Math.min(999999,record.count+1);record.max=Math.max(record.max,r.length);if(!record.spots.includes(r.spot))record.spots.push(r.spot);
 if(r.mode==='daily'||r.mode==='challenge')s.claims.push(r.id);s.claims=s.claims.slice(-256);
 if(r.mode==='challenge'&&challengeMet(r,r.challenge)&&!s.completed.includes(r.challenge))s.completed.push(r.challenge);
 s.history=[{seed:r.seed,spot:r.spot,bait:r.bait,kind:r.kind,length:r.length},...s.history.filter(v=>v.seed!==r.seed)].slice(0,20);return true;
}
export function readSave(raw:string|null):Save|null{try{const s=JSON.parse(raw||'null') as Save;if(!s||s.version!==1||!s.settings||!s.run||!Array.isArray(s.records)||s.records.length>18||!Array.isArray(s.history)||s.history.length>20||!Array.isArray(s.claims)||s.claims.length>256||!Array.isArray(s.completed)||s.completed.some(i=>!Number.isInteger(i)||i<0||i>23))return null;if(s.rulesVersion!==2){s.completed=[];s.rulesVersion=2;}const r=s.run;for(const key of ['accuracy','peakTension','strikeLag','netMisses','castPower'] as const){if(r[key]===undefined)r[key]=0;if(!Number.isFinite(r[key])||r[key]<0)return null;}
 for(const key of ['seed','spot','bait','kind','length','size','time','elapsed','wait','bite','x','y','targetX','targetY','line','tension','stamina','strain','slack','safe','steer','surges','netTime','challenge'] as const)if(!Number.isFinite(r[key]))return null;
 if(!Number.isInteger(r.kind)||r.kind<0||r.kind>17||!Number.isInteger(r.spot)||r.spot<0||r.spot>5||!Number.isInteger(r.bait)||r.bait<0||r.bait>3||!['ready','cast','wait','nibble','bite','fight','net','caught','miss','release'].includes(r.phase)||!['free','daily','practice','challenge'].includes(r.mode)||typeof r.submitted!=='boolean')return null;
 if((['sound','assist','reduced'] as const).some(k=>typeof s.settings[k]!=='boolean')||s.claims.some(v=>typeof v!=='string'||v.length>100)||new Set(s.records.map(v=>v.kind)).size!==s.records.length||typeof r.id!=='string'||typeof r.date!=='string')return null;for(const v of s.history)if(!Number.isInteger(v.seed)||!Number.isInteger(v.spot)||v.spot<0||v.spot>5||!Number.isInteger(v.bait)||v.bait<0||v.bait>3||!Number.isInteger(v.kind)||v.kind<0||v.kind>17||!Number.isFinite(v.length))return null;for(const v of s.records)if(!Number.isInteger(v.kind)||v.kind<0||v.kind>17||!Number.isInteger(v.count)||v.count<1||!Number.isFinite(v.max)||!Array.isArray(v.spots)||v.spots.some(i=>!Number.isInteger(i)||i<0||i>5))return null;return s;
 }catch{return null;}}
