import {shimmer} from './atmosphere';
import content from "./content/content.json";
import {beachCoast,createFlight,stoneFrame} from "./model";
import type {Flight,Stone,Hit,BeachStone,Physics} from "./model";
export interface Camera {x:number;y:number;z:number;tx:number;ty:number;tz:number;focal:number}
export interface RenderState {feedback:{releaseSeconds:number;heavyReleaseSeconds:number;sinkSeconds:number};physics:Physics;charging:boolean;cancelAim:boolean;time:number;stage:string;flight:Flight|null;stone:Stone|null;angle:number;power:number;heading:number;camera:Camera;hits:Hit[];beach:BeachStone[];pickup:{index:number;progress:number}|null}
const vertex=`attribute vec2 a;varying vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
const fragment=`
precision highp float;
varying vec2 uv;
uniform vec2 resolution;
uniform float time;
uniform vec3 cam,fw,rt,up;
uniform float focal;
uniform sampler2D environment;
uniform float environmentReady;
uniform vec4 clouds;
uniform vec4 hits[16];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+12.7;a*=.5;}return n;}
vec3 sky(vec3 d,float reflectionMode){
 float h=max(0.,d.y);
 vec3 col=mix(vec3(.94,.62,.41),vec3(.53,.53,.65),smoothstep(0.,.55,h));
 col=mix(col,vec3(.29,.39,.53),smoothstep(.3,1.,h)*.72);
 vec3 sun=normalize(vec3(.157,.103,1.));
 float sd=max(0.,dot(d,sun));
 col+=vec3(1.,.55,.18)*pow(sd,20.)*.24;
 col=mix(col,vec3(1.,.89,.60),smoothstep(.99969,.99984,sd)*(1.-reflectionMode));
 vec2 cloudp=vec2(d.x/(d.y+.38),1./(d.y+.38))*2.7;
 float cloud=smoothstep(.45,.77,fbm(cloudp+vec2(time*.002,0.)))*smoothstep(.01,.14,h)*(1.-smoothstep(.22,.50,h));
 col=mix(col,vec3(.80,.52,.48),cloud*.55);
 float az=atan(d.x,d.z);
 float ridge=.025+.019*sin(az*7.+1.)+.013*sin(az*17.)+.008*sin(az*37.);
 float blur=.002+reflectionMode*.035;
 col=mix(col,mix(vec3(.47,.46,.53),vec3(.63,.49,.47),.35),1.-smoothstep(ridge-blur,ridge+blur,d.y));
 float ridge2=.013+.012*sin(az*6.-1.)+.008*sin(az*21.+3.);
 col=mix(col,vec3(.31,.40,.45),1.-smoothstep(ridge2-blur,ridge2+blur,d.y));
 vec2 photoUv=vec2(clamp(.5+az*.92,.001,.999),clamp(.49+atan(d.y)*1.4,.49,.999));
 float skyMask=smoothstep(clouds.w,clouds.w+.10,photoUv.y);
 photoUv+=vec2(sin(time*clouds.x+photoUv.y*3.)*clouds.y+sin(time*clouds.x*.72+photoUv.y*8.)*(photoUv.x-.5)*clouds.z,sin(time*.035+photoUv.x*5.)*.003)*skyMask;
 vec3 photographed=texture2D(environment,clamp(photoUv,.001,.999)).rgb;
 return mix(col,photographed,environmentReady*(1.-smoothstep(.43,.60,abs(az))));
}
void main(){
 vec2 p=uv*2.-1.;p.x*=resolution.x/resolution.y;
 vec3 d=normalize(fw*focal+rt*p.x+up*p.y);
 vec3 color;
 if(d.y>=-.001){color=sky(d,0.);}
 else{
 float dist=-cam.y/d.y;
 vec3 q=cam+d*dist;
 vec2 w=q.xz;
 float footprint=dist*dist/(max(.2,cam.y)*resolution.y*focal);
 float fine=exp(-footprint*3.5);
 float detail=(1.-smoothstep(25.,100.,dist))*fine;
 float warp=sin(w.x*.73-w.y*.49+time*.23)*.65+sin(w.y*.91+time*.31)*.3;
 vec2 drift=vec2(time*.17,-time*.12);
 float nx=(fbm(w*2.3+drift)-.5)*.105+sin(w.x*1.7+w.y*.8+time*.65+warp)*.012;
 float nz=(fbm(w.yx*2.7-drift+18.4)-.5)*.105+sin(w.x*1.1-w.y*.9+time*.53+warp)*.014;
 nx+=(noise(w*7.+drift*2.)-.5)*.03*detail;
 nz+=(noise(w.yx*8.-drift*1.7)-.5)*.03*detail;
 float waveVisibility=1.-smoothstep(25.,150.,dist)*.78;
 float resolved=exp(-footprint*.85);
 nx*=waveVisibility*resolved;nz*=waveVisibility*resolved;
 float foam=0.;
 for(int i=0;i<16;i++){
  vec4 hit=hits[i];float age=time-hit.z;
  if(age>=0.&&age<3.8&&hit.w>0.){
   vec2 delta=w-hit.xy;float radius=length(delta),front=age*(1.3+hit.w*.4);
   float envelope=exp(-abs(radius-front)*8.)*exp(-age*1.05);
   float wave=sin((radius-front)*20.)*envelope*.12*hit.w;
   nx+=delta.x/(radius+.1)*wave;nz+=delta.y/(radius+.1)*wave;
   foam+=envelope*.1*hit.w;
  }
 }
 vec3 n=normalize(vec3(nx,1.,nz));
 vec3 refl=reflect(d,n);
 float fres=.06+.94*pow(1.-max(0.,dot(-d,n)),4.);
 vec3 deep=mix(vec3(.07,.22,.24),vec3(.18,.32,.32),smoothstep(0.,35.,dist));
 vec3 water=mix(deep,sky(normalize(vec3(refl.x,max(.007,refl.y),refl.z)),1.),fres*.80+.12);
 vec3 sun=normalize(vec3(.157,.103,1.));
 vec3 halfV=normalize(sun-d);
 float alignment=max(0.,dot(n,halfV));
 float glitter=pow(alignment,mix(75.,340.,fine))*(.15+.75*fine)+pow(alignment,85.)*.14;
 water+=vec3(1.,.70,.31)*glitter*(.75+detail*.7);
 float sunPath=pow(max(0.,dot(normalize(vec3(refl.x,0.,refl.z)),normalize(vec3(sun.x,0.,sun.z)))),130.);
 water+=vec3(.53,.26,.08)*sunPath*.12*(.85+.15*sin(w.y*5.+nx*12.)*fine);
 float swell=sin(w.y*1.7+sin(w.x*.7-time*.19)-time*.54)*sin(w.x*2.3+w.y*.3+time*.27);
 water+=vec3(.025,.035,.03)*swell*detail;
 water+=foam*vec3(.45,.57,.52);
 color=mix(water,vec3(.57,.52,.51),smoothstep(70.,400.,dist)*.65);
 }
 float vignette=1.-.18*dot(uv-.5,uv-.5);
 color*=vignette;
 color+=vec3((hash(gl_FragCoord.xy)-.5)/255.);
 gl_FragColor=vec4(color,1.);
}`;
function normalize(a:number[]):number[]{const m=Math.hypot(a[0],a[1],a[2])||1;return a.map(x=>x/m);}
function cross(a:number[],b:number[]):number[]{return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
export function basis(c:Camera):{f:number[];r:number[];u:number[]}{const f=normalize([c.tx-c.x,c.ty-c.y,c.tz-c.z]),r=normalize(cross(f,[0,1,0])).map(x=>-x),u=cross(f,r);return{f,r,u};}
export function project(c:Camera,x:number,y:number,z:number,w:number,h:number):{x:number;y:number;scale:number}|null{
 const b=basis(c),v=[x-c.x,y-c.y,z-c.z],depth=v.reduce((s,n,i)=>s+n*b.f[i],0);if(depth<=.05)return null;
 const k=h*.5*c.focal/depth;return {x:w*.5+v.reduce((s,n,i)=>s+n*b.r[i],0)*k,y:h*.5-v.reduce((s,n,i)=>s+n*b.u[i],0)*k,scale:k};
}
function heldRadius(s:Stone):number{return 34*Math.min(2.25,Math.max(.7,s.size||1));}
const rockAtlas=new Image();rockAtlas.src=content.visuals.stoneAtlas;
const environmentImage=new Image();environmentImage.src=content.visuals.environment;
const rockFinishes=new Map<string,HTMLCanvasElement>();
function finishedRock(s:Stone):HTMLCanvasElement{
 const f=stoneFrame(s),variant=Math.abs(Math.floor(s.shape*17.3))%content.stoneFinish.tints.length,key=f.x+':'+f.y+':'+variant,cached=rockFinishes.get(key);if(cached)return cached;
 const tile=document.createElement('canvas');tile.width=content.stoneFinish.tileSize;tile.height=Math.round(tile.width*f.h/f.w);const g=tile.getContext('2d')!;g.drawImage(rockAtlas,f.x,f.y,f.w,f.h,0,0,tile.width,tile.height);g.globalCompositeOperation='source-atop';g.fillStyle=content.stoneFinish.tints[variant];g.fillRect(0,0,tile.width,tile.height);
 const wash=g.createLinearGradient(0,0,tile.width,tile.height);wash.addColorStop(0,'rgba(220,212,181,.025)');wash.addColorStop(.45,'rgba(14,27,29,0)');wash.addColorStop(1,'rgba(14,27,29,'+(.04+variant*.018)+')');g.fillStyle=wash;g.fillRect(0,0,tile.width,tile.height);rockFinishes.set(key,tile);return tile;
}
export function drawRock(g:CanvasRenderingContext2D,s:Stone,x:number,y:number,r:number,rot:number):void{
 g.save();g.translate(x,y);g.rotate(rot);g.scale(1,1/s.ratio);
 if(rockAtlas.complete&&rockAtlas.naturalWidth){g.drawImage(finishedRock(s),-r,-r*.68,r*2,r*1.36);}
 else{g.fillStyle=s.color[1];g.beginPath();g.ellipse(0,0,r,r*.68,0,0,Math.PI*2);g.fill();}
 g.restore();
}
export class LakeRenderer {
 gl:WebGLRenderingContext|null=null;program:WebGLProgram|null=null;buffer:WebGLBuffer|null=null;
 ctx:CanvasRenderingContext2D;fallback:CanvasRenderingContext2D|null=null;width=1;height=1;dpr=1;low=false;restores=0;
 locations:Record<string,WebGLUniformLocation|null>={};hitData=new Float32Array(64);
 shoreCache:HTMLCanvasElement|null=null;environmentTexture:WebGLTexture|null=null;environmentReady=false;
 constructor(public water:HTMLCanvasElement,public canvas:HTMLCanvasElement,public onFallback:()=>void){
  this.ctx=canvas.getContext("2d")!;rockAtlas.addEventListener("load",()=>{this.shoreCache=null;});this.init();environmentImage.addEventListener("load",()=>this.uploadEnvironment());
  water.addEventListener("webglcontextlost",e=>{e.preventDefault();this.gl=null;water.style.display="none";this.onFallback();});
  water.addEventListener("webglcontextrestored",()=>{if(this.restores++<1){this.init();this.resize(this.width,this.height);}else this.gl=null;});
 }
 init():void{
  try{
   const gl=this.water.getContext("webgl",{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:false});if(!gl)throw Error("WebGL unavailable");
   const compile=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||"shader");return s;};
   const frag=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT)?.precision?fragment:fragment.replace("precision highp","precision mediump");
   const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,frag),p=gl.createProgram()!;
   gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)||"link");
   this.gl=gl;this.program=p;gl.useProgram(p);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const a=gl.getAttribLocation(p,"a");gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
   for(const name of ["resolution","time","cam","fw","rt","up","focal","hits[0]","environment","environmentReady","clouds"])this.locations[name]=gl.getUniformLocation(p,name);
   this.environmentTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.environmentTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([130,130,145,255]));this.environmentReady=false;this.uploadEnvironment();
   this.water.style.display="block";
  }catch{this.gl=null;this.water.style.display="none";this.onFallback();}
 }
 uploadEnvironment():void{const gl=this.gl;if(!gl||!this.environmentTexture||!environmentImage.complete||!environmentImage.naturalWidth)return;gl.bindTexture(gl.TEXTURE_2D,this.environmentTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,environmentImage);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);this.environmentReady=true;}
 resize(w:number,h:number):void{this.width=w;this.height=h;this.dpr=Math.min(devicePixelRatio||1,this.low?1:1.5,Math.sqrt(1400000/(w*h)));for(const c of [this.water,this.canvas]){c.width=Math.round(w*this.dpr);c.height=Math.round(h*this.dpr);}if(this.gl)this.gl.viewport(0,0,this.water.width,this.water.height);}
 simplify():void{if(this.gl){if(this.environmentTexture)this.gl.deleteTexture(this.environmentTexture);if(this.buffer)this.gl.deleteBuffer(this.buffer);if(this.program)this.gl.deleteProgram(this.program);}this.gl=null;this.water.style.display="none";this.onFallback();}
 draw(s:RenderState):void{
  const w=this.width,h=this.height,g=this.ctx,c=s.camera;
  g.setTransform(this.dpr,0,0,this.dpr,0,0);g.clearRect(0,0,w,h);
  if(this.gl&&this.program){
   const gl=this.gl,b=basis(c),l=this.locations;gl.useProgram(this.program);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.environmentTexture);gl.uniform1i(l.environment,0);gl.uniform1f(l.environmentReady,this.environmentReady?1:0);const cloud=content.environmentMotion;gl.uniform4f(l.clouds,cloud.cloudSpeed,cloud.cloudDrift,cloud.cloudStretch,cloud.skyStart);
   gl.uniform2f(l.resolution,this.water.width,this.water.height);gl.uniform1f(l.time,s.time);gl.uniform3f(l.cam,c.x,c.y,c.z);
   gl.uniform3fv(l.fw,b.f);gl.uniform3fv(l.rt,b.r);gl.uniform3fv(l.up,b.u);gl.uniform1f(l.focal,c.focal);
   this.hitData.fill(0);s.hits.slice(-16).forEach((hit,i)=>{this.hitData[i*4]=hit.x;this.hitData[i*4+1]=hit.z;this.hitData[i*4+2]=hit.time;this.hitData[i*4+3]=hit.splash;});gl.uniform4fv(l["hits[0]"],this.hitData);gl.drawArrays(gl.TRIANGLES,0,6);
  }else this.drawFallback(g,s);
  this.drawRings(g,s);
  if(s.stage==="pick"||s.stage==="lifting"){
   g.save();g.globalAlpha=s.pickup?1-s.pickup.progress:1;this.drawShore(g,s);
   const positions=s.beach;g.restore();
   if(s.pickup&&s.stone){const p=positions[s.pickup.index],t=s.pickup.progress,e=1-Math.pow(1-t,3),x=p.x+(w*.5-p.x)*e,y=p.y+((h>w?h*.55:h*.52)-p.y)*e-Math.sin(t*Math.PI)*25;
    g.save();g.shadowColor="#13252e77";g.shadowBlur=8+16*e;g.shadowOffsetY=8+12*e;drawRock(g,s.stone,x,y,p.radius+(heldRadius(s.stone)-p.radius)*e,p.rotation*(1-e));g.restore();}
  }
  if(s.stage==="ready"&&s.stone){
   const x=w*.5+(s.heading/.55)*w*.10,y=(h> w?h*.55:h*.52)+(s.charging?s.power*(8+Math.min(18,s.stone.mass*15)):0);
   g.save();g.shadowColor="#152e39aa";g.shadowBlur=20;g.shadowOffsetY=14;drawRock(g,s.stone,x,y,heldRadius(s.stone),((s.angle-18)/40));g.restore();
   // Aim guide is projected in the same world and camera as the actual throw.
   const shot=createFlight(s.stone,s.power,s.angle,s.heading,s.physics),landing=(shot.vy+Math.sqrt(shot.vy*shot.vy+2*s.physics.gravity*shot.y))/s.physics.gravity;
   g.strokeStyle="rgba(247,224,178,.5)";g.lineWidth=1.4;g.setLineDash([3,7]);g.beginPath();let started=false;
   for(let i=0;i<=24;i++){const t=landing*i/24,p=project(c,shot.vx*t,Math.max(0,shot.y+shot.vy*t-s.physics.gravity*t*t*.5),shot.vz*t,w,h);if(p){if(!started){g.moveTo(p.x,p.y);started=true;}else g.lineTo(p.x,p.y);}}g.stroke();g.setLineDash([]);
   const target=project(c,shot.vx*landing,0,shot.vz*landing,w,h);if(target){g.strokeStyle="rgba(248,228,189,.6)";g.beginPath();g.ellipse(target.x,target.y,9,3,0,0,Math.PI*2);g.stroke();}
   const r=heldRadius(s.stone)+18,start=-Math.PI*.5,inBand=s.power>=s.physics.sweetMin&&s.power<=s.physics.sweetMax;
   g.lineWidth=3;g.strokeStyle="rgba(238,222,194,.18)";g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();
   g.lineWidth=6;g.strokeStyle="rgba(246,204,115,.85)";g.beginPath();g.arc(x,y,r,start+Math.PI*2*s.physics.sweetMin,start+Math.PI*2*s.physics.sweetMax);g.stroke();
   if(s.charging){g.lineWidth=2;g.strokeStyle=s.cancelAim?"#d89b87":inBand?"#ffe5a3":"#d4e8e0";g.beginPath();g.arc(x,y,r,start,start+Math.PI*2*s.power);g.stroke();const a=start+Math.PI*2*s.power;g.fillStyle=g.strokeStyle;g.shadowColor="#f6cc73";g.shadowBlur=inBand?12:0;g.beginPath();g.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,inBand?5:3.5,0,Math.PI*2);g.fill();g.shadowBlur=0;}

  }
  if(s.flight){
   const f=s.flight,last=s.hits[s.hits.length-1],sink=f.done&&last?Math.max(0,s.time-last.time):0;
   if(!f.done||sink<s.feedback.sinkSeconds){
    const sinking=f.done,depth=sinking?sink*(.45+Math.min(.9,f.stone.mass)):0;
    const pos=project(c,f.x,-depth+(sinking?0:f.y),f.z,w,h),shadow=project(c,f.x,0,f.z,w,h);
    const releaseDuration=s.feedback.releaseSeconds+s.feedback.heavyReleaseSeconds*Math.min(2,f.stone.mass),release=Math.min(1,f.time/releaseDuration);
    if(shadow&&!sinking){g.save();g.translate(shadow.x,shadow.y);g.scale(1,.25);g.fillStyle="rgba(17,32,36,.22)";g.beginPath();g.arc(0,0,Math.max(3,shadow.scale*.07*(f.stone.size||1)),0,Math.PI*2);g.fill();g.restore();}
    if(pos){const rr=Math.max(3,Math.min(38,pos.scale*.07*(f.stone.size||1))),e=1-Math.pow(1-release,3),startX=w*.5+(f.heading/.55)*w*.1,startY=(h>w?h*.55:h*.52)+f.power*(8+Math.min(18,f.stone.mass*15));
     g.save();g.globalAlpha=sinking?Math.max(0,1-sink/s.feedback.sinkSeconds):1;
     drawRock(g,f.stone,startX+(pos.x-startX)*e,startY+(pos.y-startY)*e,heldRadius(f.stone)+(rr-heldRadius(f.stone))*e,f.rotation+(1-f.stability)*Math.sin(f.rotation*1.7)*.25);g.restore();
    }
   }
  }

 }
 drawShore(g:CanvasRenderingContext2D,s:RenderState):void{
  if(!this.shoreCache||this.shoreCache.width!==this.width||this.shoreCache.height!==this.height){this.shoreCache=document.createElement("canvas");this.shoreCache.width=this.width;this.shoreCache.height=this.height;this.paintShore(this.shoreCache.getContext("2d")!,s);}
  g.drawImage(this.shoreCache,0,0);
  const w=this.width,h=this.height,t=s.time;
  // Thin sheets advance and recede independently along the irregular shoreline.
  for(let band=0;band<3;band++){const pulse=(Math.sin(t*.7+band*2.1)+1)*.5,reach=3+pulse*13;g.save();g.beginPath();for(let x=0;x<=w+6;x+=6){const y=beachCoast(x,w,h)+reach+Math.sin(x*.027+t*.45+band)*3;if(x===0)g.moveTo(x,y);else g.lineTo(x,y);}for(let x=w+6;x>=0;x-=6)g.lineTo(x,beachCoast(x,w,h)-4);g.closePath();g.fillStyle='rgba(116,157,158,'+(.035+pulse*.04)+')';g.fill();g.strokeStyle='rgba(244,222,181,'+(.025+pulse*.065)+')';g.lineWidth=.6;g.stroke();g.restore();}

 }
 paintShore(g:CanvasRenderingContext2D,s:RenderState):void{
  const w=this.width,h=this.height,edge=h*(w>h?.36:.48);
  const rand=(i:number,k:number)=>{const v=Math.sin(i*k+12.7)*43758.5453;return v-Math.floor(v);};
  const coast=(x:number)=>beachCoast(x,w,h);
  g.save();g.beginPath();g.moveTo(0,coast(0));for(let x=0;x<=w+8;x+=8)g.lineTo(x,coast(x));g.lineTo(w,h);g.lineTo(0,h);g.closePath();g.clip();
  g.fillStyle="#343735";g.fillRect(0,edge-20,w,h);
  for(let i=0;i<2600;i++){const x=rand(i,17.2)*w,y=edge+rand(i,42.6)*(h-edge),depth=(y-edge)/(h-edge);g.fillStyle=i%3?"rgba(145,141,119,.2)":"rgba(12,23,26,.25)";g.beginPath();g.ellipse(x,y,.4+depth*1.7,.35+depth,rand(i,8.1)*3.14,0,6.28);g.fill();}
  // The rendered and selectable stones share one ordered scene list.
  s.beach.forEach((p,i)=>{if(s.pickup?.index===i)return;
   g.save();g.shadowColor="rgba(7,13,17,.8)";g.shadowBlur=p.radius*.1;g.shadowOffsetX=-p.radius*.055;g.shadowOffsetY=p.radius*.09;
   drawRock(g,p.stone,p.x,p.y,p.radius,p.rotation);g.restore();
  });
  const wash=g.createLinearGradient(0,edge,0,edge+85);wash.addColorStop(0,"rgba(27,64,67,.75)");wash.addColorStop(.5,"rgba(29,58,60,.3)");wash.addColorStop(1,"rgba(29,58,60,0)");g.fillStyle=wash;g.fillRect(0,edge-20,w,105);
  g.restore();
  // Narrow foam breaks around the wet stones instead of outlining the whole beach.
  for(let i=0;i<100;i++){const x=rand(i,53.1)*w,y=coast(x)+rand(i,15.1)*8;g.fillStyle="rgba(220,229,211,"+(.12+rand(i,71.2)*.3)+")";g.beginPath();g.ellipse(x,y,1+rand(i,27.1)*4,.6,0,0,Math.PI*2);g.fill();}
 }

 drawRings(g:CanvasRenderingContext2D,s:RenderState):void{
  for(const hit of s.hits){const age=s.time-hit.time;if(age<0||age>3.8)continue;
   const alpha=Math.exp(-age*1.3)*.45,rad=.05+age*(1.3+hit.splash*.4);g.strokeStyle="rgba(248,210,157,"+alpha+")";g.lineWidth=.8;g.beginPath();
   for(let j=0;j<=40;j++){const a=j/40*Math.PI*2,p=project(s.camera,hit.x+Math.cos(a)*rad,0,hit.z+Math.sin(a)*rad,this.width,this.height);if(p){if(j===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}}g.stroke();
   if(hit.bounce&&age<.9&&s.flight){const heading=s.flight.heading,dx=Math.sin(heading),dz=Math.cos(heading);g.save();g.strokeStyle='rgba(240,227,188,'+((1-age/.9)*.28)+')';g.lineWidth=1;for(const side of [-1,1]){g.beginPath();for(let k=0;k<=12;k++){const u=k/12,along=age*(.8+u*2.2),width=u*age*.55,p=project(s.camera,hit.x+dx*along+dz*width*side,0,hit.z+dz*along-dx*width*side,this.width,this.height);if(p){if(k)g.lineTo(p.x,p.y);else g.moveTo(p.x,p.y);}}g.stroke();}g.restore();}
   if(!hit.bounce&&age<.55){const center=project(s.camera,hit.x,0,hit.z,this.width,this.height);if(center){const radius=center.scale*(.08+age*.5)*hit.splash;g.save();g.globalAlpha=(1-age/.55)*.65;g.fillStyle="#183b3e";g.beginPath();g.ellipse(center.x,center.y,radius,radius*.28,0,0,Math.PI*2);g.fill();g.strokeStyle="#d2dfd4";g.lineWidth=Math.max(1,hit.splash);g.beginPath();for(let j=0;j<=32;j++){const a=j/32*Math.PI*2,x=center.x+Math.cos(a)*radius,y=center.y+Math.sin(a)*radius*.28-Math.sin(age/.55*Math.PI)*hit.splash*8*(.65+.35*Math.sin(j*3.1));if(j===0)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();g.restore();}}
   if(age<.65){for(let j=0;j<(this.low?9:24);j++){const a=j*2.4,k=(.5+(j%5)*.18)*Math.sqrt(hit.splash),px=hit.x+Math.cos(a)*age*k,py=Math.max(0,age*(1.8+(j%4)*.3)*Math.sqrt(hit.splash)-4.9*age*age),pz=hit.z+Math.sin(a)*age*k;const p=project(s.camera,px,py,pz,this.width,this.height);if(p&&py>0){g.fillStyle="rgba(255,234,196,"+((1-age/.65)*.8)+")";g.beginPath();g.ellipse(p.x,p.y,1.1*Math.sqrt(hit.splash),2.1*Math.sqrt(hit.splash),-a,0,Math.PI*2);g.fill();}}}
  }
 }
 drawFallback(g:CanvasRenderingContext2D,s:RenderState):void{
  const w=this.width,h=this.height,horizon=h*.32;
  const sky=g.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#8b879e");sky.addColorStop(1,"#e9ad86");g.fillStyle=sky;g.fillRect(0,0,w,horizon);
  g.fillStyle="#59666e";g.beginPath();g.moveTo(0,horizon);for(let i=0;i<=w;i+=8)g.lineTo(i,horizon-12-Math.sin(i/w*11)*8-Math.sin(i/w*28)*6);g.lineTo(w,horizon);g.fill();
  g.fillStyle="#ffe4ad";g.beginPath();g.arc(w*.72,h*.22,13,0,Math.PI*2);g.fill();
  const water=g.createLinearGradient(0,horizon,0,h);water.addColorStop(0,"#b59482");water.addColorStop(.4,"#677e7c");water.addColorStop(1,"#254b50");g.fillStyle=water;g.fillRect(0,horizon,w,h);if(environmentImage.complete&&environmentImage.naturalWidth){g.drawImage(environmentImage,0,0,environmentImage.width,environmentImage.height*.51,0,0,w,horizon);const limit=horizon*.56;for(let y=0;y<limit;y+=2){const bh=Math.min(2,limit-y),mask=Math.pow(1-y/limit,2),dx=Math.sin(s.time*content.environmentMotion.cloudSpeed+y/limit*3)*w*content.environmentMotion.cloudDrift*mask;g.drawImage(environmentImage,0,y/horizon*environmentImage.height*.51,environmentImage.width,bh/horizon*environmentImage.height*.51,dx-20*mask,y,w+40*mask,bh);}}
  shimmer(g,w,h,horizon,w*.72,s.time,content.atmosphere.glitter,true,this.low);
  g.save();g.strokeStyle='rgba(166,188,177,.11)';g.lineWidth=.7;for(let i=0;i<32;i++){const d=i/32,y=horizon+d*d*(h-horizon);g.beginPath();for(let j=0;j<=30;j++){const x=j/30*w,yy=y+Math.sin(x*.029+s.time*.8+i)*d*2;if(j)g.lineTo(x,yy);else g.moveTo(x,yy);}g.stroke();}g.restore();
 }
}
