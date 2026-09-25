import content from "./content/content.json";
export interface Stone {id:string;name:string;hint:string;flatness:number;retention:number;mass:number;size?:number;color:string[];shape:number;ratio:number}
export interface Physics {gravity:number;minSpeed:number;maxSpeed:number;drag:number;minBounceSpeed:number;minLift:number;maxTime:number;step:number;referenceMass:number;handMass:number;sweetMin:number;sweetMax:number;releaseSupportFloor:number;spinRate:number;spinDrag:number;spinImpactLoss:number;spinSupport:number;plateAngle:number;entryLimit:number;launchAngleScale:number;reboundDecay:number}
export interface Hit {x:number;z:number;time:number;strength:number;splash:number;bounce:boolean;index:number}
export interface Flight {x:number;y:number;z:number;vx:number;vy:number;vz:number;time:number;jumps:number;distance:number;firstZ:number|null;done:boolean;angle:number;support:number;reason:string;hits:Hit[];stone:Stone;power:number;heading:number;spin:number;rotation:number;stability:number;plateAngle:number;lastLift:number}
export const clamp=(n:number,a:number,b:number):number=>Math.max(a,Math.min(b,n));
export interface ShorePoint {x:number;y:number;radius:number;rotation:number}
export function createFlight(stone:Stone,power:number,angle:number,heading:number,physics:Physics):Flight{
 const p=clamp(Number.isFinite(power)?power:.5,0,1),a=clamp(Number.isFinite(angle)?angle:18,8,35),h=clamp(Number.isFinite(heading)?heading:0,-.55,.55);
 const plateAngle=physics.plateAngle+(1-releaseQuality(p,physics))*8;
 const load=clamp(stone.mass/physics.referenceMass,.2,40);
 const speed=(physics.minSpeed+(physics.maxSpeed-physics.minSpeed)*p)*Math.min(1.25,Math.sqrt((physics.handMass+physics.referenceMass)/(physics.handMass+stone.mass)));
 return {x:0,y:.72,z:0,vx:Math.sin(h)*speed,vy:speed*Math.sin((2+(a-8)*physics.launchAngleScale)*Math.PI/180),vz:Math.cos(h)*speed,time:0,jumps:0,distance:0,firstZ:null,done:false,angle:a,support:(physics.releaseSupportFloor+(1-physics.releaseSupportFloor)*releaseQuality(p,physics))*stone.flatness*Math.exp(-Math.pow((plateAngle-physics.plateAngle)/15,2))/Math.max(.9,Math.pow(load,1/3)),reason:"",hits:[],stone,power:p,heading:h,spin:physics.spinRate*(.65+.35*releaseQuality(p,physics))/Math.sqrt(Math.max(.7,load)),rotation:0,stability:1,lastLift:0,plateAngle};
}
export function stepFlight(f:Flight,dt:number,p:Physics):Hit|null{
 if(f.done)return null;
 const oldY=f.y,oldX=f.x,oldZ=f.z;
 f.spin*=Math.exp(-p.spinDrag*dt);f.rotation+=f.spin*dt;f.stability=clamp(f.spin/(f.spin+4),0,1);
 f.time+=dt;f.vx*=Math.exp(-p.drag*dt);f.vz*=Math.exp(-p.drag*dt);f.vy-=p.gravity*dt;
 f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;
 if(f.firstZ!==null)f.distance+=Math.hypot(f.x-oldX,f.z-oldZ);
 let event:Hit|null=null;
 if(f.y<=0&&oldY>=0&&f.vy<0){
  const portion=oldY/(oldY-f.y||1),hx=oldX+(f.x-oldX)*portion,hz=oldZ+(f.z-oldZ)*portion;
  if(f.firstZ===null){f.firstZ=hz;f.distance=0;}else f.distance=Math.max(0,f.distance-Math.hypot(f.x-hx,f.z-hz));
  f.x=hx;f.z=hz;
  const horizontal=Math.hypot(f.vx,f.vz),impact=Math.abs(f.vy),incidence=Math.atan2(impact,horizontal);
  const support=f.support*Math.exp(-Math.pow(incidence/p.entryLimit,4))*(1-p.spinSupport+p.spinSupport*f.stability);
  const retention=clamp(f.stone.retention-.045*(1-support)-.035*(1-f.stability),.68,.91);
  const nextH=horizontal*retention;
  const energyBudget=Math.sqrt(Math.max(0,(horizontal*horizontal+impact*impact)*.94-nextH*nextH));
  const lift=Math.min(energyBudget,Math.max(0,nextH*.145*support-.08),f.jumps?f.lastLift*p.reboundDecay:Infinity);
  const bounce=horizontal>p.minBounceSpeed&&lift>p.minLift&&support>.24&&f.jumps<40;
  event={x:hx,z:hz,time:f.time,strength:impact,splash:clamp(Math.sqrt(f.stone.mass/p.referenceMass)*impact/4,.45,3.5),bounce,index:f.hits.length};
  f.hits.push(event);
  if(bounce){f.lastLift=lift;f.spin*=p.spinImpactLoss;f.vx*=retention;f.vz*=retention;f.vy=lift;f.y=.002;f.jumps++;}
  else{f.done=true;f.y=0;f.reason=f.stone.mass>p.referenceMass*5?"heavy":support<=.24?"steep":f.stability<.65?"unstable":"slow";}
 }
 if(f.time>=p.maxTime){f.done=true;f.y=Math.max(0,f.y);f.reason="slow";}
 return event;
}
export function simulate(stone:Stone,power:number,angle:number,heading:number,p:Physics):Flight{
 const f=createFlight(stone,power,angle,heading,p);while(!f.done)stepFlight(f,p.step,p);return f;
}
export interface ThrowRecord {stone:Stone;power:number;angle:number;heading:number;jumps:number;distance:number;}
export interface PersonalRecord {version:number;best:number;jumps:number;throws:number;ids:string[];history:ThrowRecord[];learned:number[];}
export function readRecord(raw:string|null):PersonalRecord{
 const empty:PersonalRecord={version:1,best:0,jumps:0,throws:0,ids:[],history:[],learned:[]};
 try{const v=JSON.parse(raw||"null");if(!v||v.version!==1)return empty;
 const history:ThrowRecord[]=Array.isArray(v.history)?v.history.filter((r:ThrowRecord)=>r&&r.stone&&typeof r.stone.id==='string'&&typeof r.stone.name==='string'&&typeof r.stone.hint==='string'&&Array.isArray(r.stone.color)&&r.stone.color.length===3&&r.stone.color.every(x=>typeof x==='string')&&Number.isFinite(r.stone.mass+r.stone.flatness+r.stone.retention+r.stone.ratio+r.stone.shape+r.power+r.angle+r.heading+r.jumps+r.distance)&&r.stone.mass>0&&r.stone.mass<20&&r.power>=0&&r.power<=1&&r.angle>=8&&r.angle<=35&&r.distance>=0&&r.distance<10000).slice(0,20):[];
 return {version:1,best:clamp(Number(v.best)||0,0,10000),jumps:clamp(Number(v.jumps)||0,0,40),throws:clamp(Number(v.throws)||0,0,100000),ids:Array.isArray(v.ids)?v.ids.filter((x:unknown)=>typeof x==='string').slice(-20):[],history,learned:Array.isArray(v.learned)?v.learned.filter((i:number)=>Number.isInteger(i)&&i>=0&&i<content.practiceGoals.length):[]};}catch{return empty;}
}
export function commitRecord(record:PersonalRecord,id:string,f:Flight):PersonalRecord{
 if(!f.done||record.ids.indexOf(id)>=0)return record;
 const learned=record.learned.slice();for(const goal of content.practiceGoals)if((f.stone.id===goal.stone||f.stone.id.startsWith(goal.stone+'-'))&&f.jumps>=goal.jumps&&f.distance>=goal.distance&&!learned.includes(goal.id))learned.push(goal.id);
 return {version:1,best:Math.max(record.best,f.distance),jumps:Math.max(record.jumps,f.jumps),throws:Math.min(100000,record.throws+1),ids:record.ids.concat(id).slice(-20),history:[{stone:{...f.stone},power:f.power,angle:f.angle,heading:f.heading,jumps:f.jumps,distance:f.distance},...record.history].slice(0,20),learned};
}

export interface BeachStone extends ShorePoint {stone:Stone;}
export interface BeachConfig {sizeMin:number;sizeRange:number;boulderChance:number;boulderSize:number}
export function beachCoast(x:number,w:number,h:number):number{return h*(w>h?.36:.48)+12+Math.sin(x/w*5.4)*13+Math.sin(x/w*12)*4;}
export function createBeach(w:number,h:number,stones:Stone[],config:BeachConfig):BeachStone[]{
 const edge=h*(w>h?.36:.48),result:BeachStone[]=[];
 const rand=(i:number,k:number)=>{const v=Math.sin(i*k+12.7)*43758.5453;return v-Math.floor(v);};
 let row=0;
 for(let y=edge-5;y<h+65;){const depth=Math.max(0,(y-edge)/(h-edge)),radius=7+Math.pow(depth,1.3)*25;
  for(let x=-radius;x<w+radius;x+=radius*1.55){const id=row*157+Math.round(x/radius)*7,base=stones[Math.floor(rand(id,19.7)*stones.length)],size=depth>.5&&rand(id,91.3)<config.boulderChance?config.boulderSize:config.sizeMin+rand(id,72.1)*config.sizeRange;
   result.push({x:x+(rand(id,31.9)-.5)*radius*1.45,y:y+(rand(id,22.8)-.5)*radius*1.15,radius:radius*size,rotation:(rand(id,63.2)-.5)*1.65,
    stone:{...base,id:base.id+"-"+result.length,ratio:.82+rand(id,43.7)*.55,shape:base.shape+id*.17,mass:base.mass*Math.pow(size,3),size,flatness:clamp(base.flatness*(.85+rand(id,21.4)*.3),.25,1),retention:clamp(base.retention+(1-size)*.06,.68,.91)}});
  }y+=radius*(.82+rand(row,39.4)*.24);row++;
 }if(!result.some(p=>p.stone.size===config.boulderSize)){const p=result.reduce((a,b)=>Math.hypot(b.x-w*.82,b.y-h*.82)<Math.hypot(a.x-w*.82,a.y-h*.82)?b:a),factor=config.boulderSize/(p.stone.size||1);p.radius*=factor;p.stone.mass*=factor*factor*factor;p.stone.size=config.boulderSize;}return result;
}
export function stoneFrame(s:Stone){return content.visuals.frames[Math.abs(Math.floor(s.shape*7))%content.visuals.frames.length];}
export function rockOutline(p:BeachStone):{x:number;y:number}[]{
 return stoneFrame(p.stone).outline.map(([nx,ny])=>{const x=nx*p.radius,y=ny*p.radius*.68/p.stone.ratio;return{x:p.x+x*Math.cos(p.rotation)-y*Math.sin(p.rotation),y:p.y+x*Math.sin(p.rotation)+y*Math.cos(p.rotation)};});
}

export interface GestureConfig {cycleSeconds:number;minimumHoldSeconds:number;angleMin:number;angleMax:number;defaultAngle:number;headingMax:number;horizontalTravel:number;verticalTravel:number;cancelBottom:number}
export function aimGesture(dx:number,dy:number,seconds:number,w:number,h:number,c:GestureConfig):{power:number;angle:number;heading:number;canThrow:boolean}{
 const duration=Math.max(0,seconds),scale=Math.max(1,Math.min(w,h));
 return {power:(1-Math.cos(2*Math.PI*(duration%c.cycleSeconds)/c.cycleSeconds))*.5,angle:clamp(c.defaultAngle-dy/(scale*c.verticalTravel)*(c.angleMax-c.angleMin),c.angleMin,c.angleMax),heading:clamp(dx/(scale*c.horizontalTravel)*c.headingMax,-c.headingMax,c.headingMax),canThrow:duration>=c.minimumHoldSeconds};
}

export function releaseQuality(power:number,p:Physics):number{if(power>=p.sweetMin&&power<=p.sweetMax)return 1;const distance=power<p.sweetMin?p.sweetMin-power:power-p.sweetMax;return clamp(1-distance/.2,0,1);}
