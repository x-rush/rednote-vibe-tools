import {emptyJourney,readJourney} from './journey';
import type {Journey} from './journey';
export interface Location {id:string;name:string;hint:string;empty:number;mud:number;color:string;coarse?:number;leaves?:number;goldKinds?:number[]}
export interface Tuning {scoopTravel:number;tiltRate:number;settleRate:number;dangerSeconds:number;collectMud:number}
export interface Grain {id:number;kind:number;gold:boolean;x:number;y:number;size:number;weight:number;state:'pan'|'lost'|'bottle';warning:number;warned?:boolean}
export interface Sample {id:string;seed:number;location:number;practice:boolean;replay:boolean;point:number;amount:number;claimKey?:string;phase:'loading'|'immerse'|'wash'|'inspect';water:number;mud:number;settled:number;grains:Grain[];collected:boolean;washed:number;elapsed:number;cycles:number;wasTilting:boolean;maxTilt:number;maxSettled:number;coarse:number;initialCoarse:number;leaves:number;initialLeaves:number}
export interface Save {count:number;weight:number;pans:number;album:number[];ids:string[];active:Sample|null;claims:{[key:string]:number};journey:Journey;settings:{sound:boolean;reduced:boolean;assist:boolean}}
export const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function rng(seed:number):()=>number {let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};}
export function makeSample(seed:number,location:number,site:Location,practice:boolean,point=0,amount=1,replay=false):Sample {
 const random=rng((seed+point*7949)>>>0),count=practice?3:random()<site.empty?0:2+Math.floor(random()*6*amount),grains:Grain[]=[];
 for(let i=0;i<count+5;i++){const gold=i<count,kinds=site.goldKinds||[0,0,0,1,2,3,4,5,6,7],kind=gold?(practice?0:kinds[Math.floor(random()*kinds.length)]):8+Math.floor(random()*10),size=gold?(kind===0?.021:kind===7?.05:.032)+random()*.019:.04+random()*.04;grains.push({id:i,kind,gold,x:(random()-.5)*1.1,y:(random()-.5)*.8,size,weight:Math.round(size*size*10000)/100,state:'pan',warning:0});}
 const coarse=site.coarse||0,leaves=site.leaves||0;
 return{id:seed+'-'+location+'-'+point+'-'+Math.round(amount*100),seed,location,practice,replay,point,amount,phase:'wash',water:1,mud:1,settled:0,grains,collected:false,washed:0,elapsed:0,cycles:0,wasTilting:false,maxTilt:0,maxSettled:0,coarse,initialCoarse:coarse,leaves,initialLeaves:leaves};
}
export function immerse(s:Sample,dt:number,depth:number):void{if(s.collected||!Number.isFinite(dt)||dt<=0)return;s.water=clamp(s.water+Math.min(dt,.05)*clamp(Number.isFinite(depth)?depth:0,0,1)*1.2,0,1);}
export function wash(s:Sample,dt:number,motion:number,tilt:number,site:Location,t:Tuning):void{
 if(s.collected||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);motion=clamp(Number.isFinite(motion)?motion:0,0,1);tilt=clamp(Number.isFinite(tilt)?tilt:0,0,1);s.elapsed+=dt;s.maxTilt=Math.max(s.maxTilt,tilt);
 const wet=clamp(s.water*4,0,1);s.settled=clamp(s.settled+motion*wet*dt*t.settleRate,0,1);s.maxSettled=Math.max(s.maxSettled,s.settled);
 if(tilt>.12&&!s.wasTilting&&s.settled>.55)s.cycles++;s.wasTilting=tilt>.12;
 const drain=tilt*dt*.055; s.water=clamp(s.water-drain,0,1);
 const removed=tilt*t.tiltRate*(.05+.95*s.settled)*wet*dt/(site.mud*s.amount)*(s.coarse>.1?.45:1);s.settled=clamp(s.settled-removed*1.8,0,1);s.mud=clamp(s.mud-removed,0,1);s.washed+=removed;
 s.coarse=Math.max(0,s.coarse-(motion*.6+s.settled*.6)*tilt*wet*dt*.7);s.leaves=Math.max(0,s.leaves-tilt*wet*dt*1.5);
 for(const grain of s.grains){if(grain.state!=='pan')continue;grain.x+=Math.sin(grain.id*7+s.washed*15)*motion*wet*dt*.015;grain.y+=(tilt<=.92?((grain.gold?.12:.22)-grain.y)*dt*.075*wet*(motion+tilt):tilt*dt*.012);grain.x*=1-motion*dt*.04;
  if(tilt>.92&&s.mud<.35&&wet>0){grain.warning+=dt;grain.warned=true;if(grain.warning>t.dangerSeconds)grain.y+=dt*.65;}else grain.warning=Math.max(0,grain.warning-dt*3);
  if(Math.hypot(grain.x,grain.y)>1)grain.state='lost';
 }
}
export function emptySave():Save{return{count:0,weight:0,pans:0,album:[],ids:[],active:null,claims:{},journey:emptyJourney(),settings:{sound:false,reduced:false,assist:false}};}
export function isClean(s:Sample,t:Tuning):boolean{return s.mud<=t.collectMud&&s.coarse<.1&&s.leaves<.1;}
export function pickGrain(s:Sample,save:Save,id:number,t:Tuning):Grain|null{if(s.collected||(!s.replay&&save.ids.includes(s.id)))return null;const grain=s.grains.find(g=>g.id===id);if(!grain||!canPickGrain(s,grain,t))return null;grain.state='bottle';if(!s.replay){if(s.claimKey)save.claims[s.claimKey]=(save.claims[s.claimKey]||0)|(1<<Math.round((s.amount-.35)/.05));if(grain.gold){save.count++;save.weight+=grain.weight;}if(!save.album.includes(grain.kind))save.album.push(grain.kind);}return grain;}
export function finishPicked(s:Sample,save:Save,t:Tuning):boolean{if(s.collected||!isClean(s,t)||s.grains.some(g=>g.state==='pan')||(!s.replay&&save.ids.includes(s.id)))return false;s.collected=true;if(!s.replay){save.pans++;save.ids.push(s.id);save.ids=save.ids.slice(-60);}save.active=null;return true;}
export function readClaims(value:unknown):{[key:string]:number}{const result:{[key:string]:number}={};if(value&&typeof value==='object')for(const [key,n] of Object.entries(value).slice(-1200))if(/^(challenge:[0-9]+|daily:[0-9]{4}-[0-9]{2}-[0-9]{2}):[0-5]:[0-2]$/.test(key)&&Number.isInteger(n)&&n>0&&n<16384)result[key]=n;return result;}
export function readSave(raw:string|null):Save{try{const s=JSON.parse(raw||'null');if(!s||!Number.isInteger(s.count)||s.count<0||s.count>100000||!Number.isFinite(s.weight)||s.weight<0||!Number.isInteger(s.pans)||s.pans<0)return emptySave();const result:Save={count:s.count,weight:s.weight,pans:s.pans,album:Array.isArray(s.album)?s.album.filter((x:number)=>Number.isInteger(x)&&x>=0&&x<18):[],ids:Array.isArray(s.ids)?s.ids.filter((x:unknown)=>typeof x==='string').slice(-60):[],active:null,claims:readClaims(s.claims),journey:readJourney(s.journey),settings:{sound:!!s.settings?.sound,reduced:!!s.settings?.reduced,assist:!!s.settings?.assist}};const a=s.active;if(a&&typeof a.id==='string'&&Number.isInteger(a.seed)&&Number.isInteger(a.location)&&a.location>=0&&a.location<6&&Number.isFinite(a.mud)&&a.mud>=0&&a.mud<=1&&Number.isFinite(a.settled)&&Number.isFinite(a.washed)&&Array.isArray(a.grains)&&a.grains.length<=20&&!a.collected&&new Set(a.grains.map((g:Grain)=>g.id)).size===a.grains.length&&a.grains.every((g:Grain)=>Number.isInteger(g.id)&&Number.isInteger(g.kind)&&g.kind>=0&&g.kind<18&&g.gold===(g.kind<8)&&Number.isFinite(g.x)&&Math.abs(g.x)<3&&Number.isFinite(g.y)&&Math.abs(g.y)<3&&Number.isFinite(g.size)&&g.size>0&&g.size<.2&&Number.isFinite(g.weight)&&g.weight>=0&&Number.isFinite(g.warning)&&['pan','lost','bottle'].includes(g.state))&&(a.replay||!result.ids.includes(a.id))){const base=makeSample(a.seed,a.location,{id:'',name:'',hint:'',empty:0,mud:1,color:''},!!a.practice);for(const key of ['water','amount','point','elapsed','cycles','maxTilt','maxSettled','coarse','initialCoarse','leaves','initialLeaves'] as const){if(!Number.isFinite(a[key]))a[key]=base[key];}a.water=clamp(a.water,0,1);a.amount=clamp(a.amount,.35,1);a.point=Math.round(clamp(a.point,0,2));a.elapsed=clamp(a.elapsed,0,36000);a.cycles=clamp(a.cycles,0,10000);for(const key of ['maxTilt','maxSettled','settled'])a[key]=clamp(a[key],0,1);for(const key of ['coarse','initialCoarse','leaves','initialLeaves'])a[key]=clamp(a[key],0,6);if(!(typeof a.claimKey==='string'&&/^(challenge:[0-9]+|daily:[0-9]{4}-[0-9]{2}-[0-9]{2}):[0-5]:[0-2]$/.test(a.claimKey)))delete a.claimKey;a.replay=!!a.replay;a.wasTilting=false;a.phase=['loading','immerse','wash','inspect'].includes(a.phase)?a.phase:'wash';result.active=a;}return result;}catch{return emptySave();}}
export {makeSediment,stepSediment} from './sediment';
export {makeSlosh,stepSlosh} from './slosh';
export {makeOrbit,trackOrbit} from './orbit';
export {emptyJourney,localDay,dailySeed,makeRecord,challengeMet,recordJourney} from './journey';

export {AudioBank} from './audio-bank';

// Decide rim intent only after movement: a tangential start remains a circle.
export function rimIntent(dx:number,dy:number):'wash'|'rim'|null {if(Math.hypot(dx,dy)<8)return null;return dy>0&&dy>Math.abs(dx)*1.25?'rim':'wash';}
export function washGuide(s:Sample,tilt:number):'refill'|'pour'|'rinse'|'settle'|'recover' {return s.water<.18?'refill':tilt>.12?(s.settled<.3?'recover':'pour'):s.settled>=.6?'rinse':'settle';}


/** Exposed collectibles can be lifted out before the last film of sand is gone. */
export function canPickGrain(s:Sample,g:Grain,t:Tuning):boolean{return g.state==='pan'&&s.coarse<.1&&s.leaves<.1&&(isClean(s,t)||s.mud<=(g.gold?.16:.32));}
/** A long pull is required to tip beyond the ordinary rinsing range. */
export function tiltFromDrag(dy:number,r:number):number{const d=Math.max(0,(dy-8)/Math.max(1,r));return clamp(d<=.7?d:.7+(d-.7)*.45,0,1);}
