import {EnvironmentMotion} from './environment-motion';
import {lineControl,loadedTip} from './tackle';
import {drawNet} from './net';
import {shimmer,reeds} from './atmosphere';
import {drawRod} from './rod';
import C from './content/content.json';
import {surge,castFlight,castLanding,type Run} from './model';
const ponds=new Image(),fish=new Image();ponds.src=C.visuals.ponds;fish.src=C.visuals.fish;
export function drawFish(c:CanvasRenderingContext2D,kind:number,x:number,y:number,w:number,h:number){if(!fish.complete||!fish.naturalWidth)return;const [sx,sy,sw,sh]=C.fish[kind].frame,scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;c.drawImage(fish,sx,sy,sw,sh,x-dw/2,y-dh/2,dw,dh);}
export class Scene{environment=new EnvironmentMotion();c:CanvasRenderingContext2D;w=1;h=1;low=false;scale=1;ox=0;oy=0;k=1;time=0;reduced=false;zoom=1;cx=.5;cy=.5;cameraTime=0;constructor(public canvas:HTMLCanvasElement){this.c=canvas.getContext('2d')!;this.resize();}
 resize(){this.w=innerWidth;this.h=innerHeight;const d=Math.min(devicePixelRatio||1,this.low?1:1.5,Math.sqrt((this.low?800000:1500000)/(this.w*this.h)));this.canvas.width=this.w*d;this.canvas.height=this.h*d;this.c.setTransform(d,0,0,d,0,0);this.k=Math.min(this.w*(this.w>this.h?.6:.94),this.h*.85);this.ox=(this.w>this.h?this.w*.32:this.w*.5)-this.k/2;this.oy=this.h*.54-this.k*.5;}
 point(x:number,y:number){return{x:((x-this.ox)/this.k-.5)/this.zoom+this.cx,y:((y-this.oy)/this.k-.5)/this.zoom+this.cy};}
 screen(x:number,y:number){return{x:this.ox+((x-this.cx)*this.zoom+.5)*this.k,y:this.oy+((y-this.cy)*this.zoom+.5)*this.k};}
 draw(r:Run,t:number,cursor:{x:number;y:number}|null,reeling:boolean,power:number){const c=this.c,w=this.w,h=this.h;this.time=t;const watching=['wait','nibble','bite'].includes(r.phase),landing=r.phase==='net',z=this.reduced?1:watching?1.22:landing?1.12:1,cx=watching?r.targetX:.5,cy=watching?r.targetY+.07:landing?.64:.5,a=1-Math.exp(-Math.min(.1,Math.max(0,t-this.cameraTime))*2.6);this.cameraTime=t;this.zoom+=(z-this.zoom)*a;this.cx+=((this.reduced?.5:cx)-this.cx)*a;this.cy+=((this.reduced?.5:cy)-this.cy)*a;const mx=(this.zoom-1)*w/(2*this.k*this.zoom),my=(this.zoom-1)*h/(2*this.k*this.zoom);this.cx=Math.max(.5-mx,Math.min(.5+mx,this.cx));this.cy=Math.max(.5-my,Math.min(.5+my,this.cy));c.fillStyle='#435d51';c.fillRect(0,0,w,h);
 if(ponds.complete&&ponds.naturalWidth){c.save();const anchor=this.screen(.5,.5);c.translate(anchor.x,anchor.y);c.scale(this.zoom,this.zoom);c.translate(-(this.ox+this.k*.5),-(this.oy+this.k*.5));const sw=ponds.width/3,sh=ponds.height/2,sx=r.spot%3*sw,sy=Math.floor(r.spot/3)*sh,ratio=Math.max(w/sw,h/sh),cw=w/ratio,ch=h/ratio;const live=this.environment.draw(ponds,{x:sx,y:sy,w:sw,h:sh},C.environmentMotion[r.spot],t,this.low,this.reduced);if(this.canvas.dataset.environment!==this.environment.mode)this.canvas.dataset.environment=this.environment.mode;if(live)c.drawImage(live,(sw-cw)/2/sw*live.width,(sh-ch)/2/sh*live.height,cw/sw*live.width,ch/sh*live.height,0,0,w,h);else c.drawImage(ponds,sx+(sw-cw)/2,sy+(sh-ch)/2,cw,ch,0,0,w,h);
 // Water-only polygon keeps reeds, banks and distant mountains fixed.
 const water=C.water[r.spot],map=(x:number,y:number)=>({x:(x*sw-(sw-cw)/2)*ratio,y:(y*sh-(sh-ch)/2)*ratio});c.save();c.beginPath();water.edge.forEach(([x,y],i)=>{const q=map(x,y);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.closePath();c.clip();const horizon=map(0,water.edge[0][1]).y,start=Math.max(0,horizon),speed=this.reduced?.4:1,clock=t*speed;
 const sun=map(water.sun,0).x;shimmer(c,w,h,start,sun,clock,water.strength,water.warm,this.low);
 c.restore();c.restore();}
 reeds(c,w,h,t,C.atmosphere.reeds,this.low,this.reduced);
 const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(12,28,20,.13)');shade.addColorStop(.5,'rgba(12,28,20,0)');shade.addColorStop(1,'rgba(7,18,13,.52)');c.fillStyle=shade;c.fillRect(0,0,w,h);
 const p=this.screen(r.x,r.y),handle={x:this.screen(.68,1).x,y:h+20},fight=r.phase==='fight'||r.phase==='net',nibble=r.phase==='nibble',bite=r.phase==='bite';
 const airborne=r.phase==='cast'?castFlight(r.time/1.05,handle,p,this.k*.45):p;
 const dip=bite?Math.min(34,r.time*40):nibble?Math.sin(r.time*8)*5:Math.sin(t*2)*1.6;
 if(r.phase!=='ready'&&r.phase!=='miss'&&r.phase!=='caught'){
  let px=p.x+(nibble&&C.fish[r.kind].family===1?Math.sin(r.time*1.8)*12:0),py=p.y+dip;if(r.phase==='cast'){px=airborne.x;py=airborne.y;}
  c.strokeStyle='rgba(252,231,183,.42)';c.lineWidth=1;for(let i=0;i<(r.phase==='cast'?0:3);i++){const a=(t*.6+i*.33)%1;c.globalAlpha=(1-a)*.5;c.beginPath();c.ellipse(p.x,p.y+4,8+a*32,2+a*8,0,0,Math.PI*2);c.stroke();}c.globalAlpha=1;
  if(!fight){c.fillStyle='#2c352d';c.fillRect(px-2,py-28,4,31);for(let i=0;i<4;i++){c.fillStyle=i%2?'#f3e5b6':'#e46d32';c.fillRect(px-2,py-27+i*6,4,5);}c.save();c.globalAlpha=.25;c.translate(px,py+5);c.scale(1,-.4);c.fillStyle='#d9a366';c.fillRect(-2,-25,4,25);c.restore();}
  else {c.save();c.globalAlpha=r.phase==='net'?.88:.2;c.translate(p.x,p.y);c.rotate(Math.sin(t*2)*.08);c.scale(Math.tanh(Math.cos(r.time*C.families[C.fish[r.kind].family].sway)*3),1);drawFish(c,r.kind,0,0,48+r.size*65,(48+r.size*65)*.67);c.restore();if(surge(r)&&r.phase==='fight'){c.strokeStyle='rgba(235,244,223,.6)';c.beginPath();c.ellipse(p.x,p.y,27,6,Math.sin(t)*.2,0,Math.PI*2);c.stroke();}}
 }
 if(r.phase==='wait'&&r.time<.8){const u=r.time/.8;c.strokeStyle='rgba(246,238,202,'+((1-u)*.75)+')';c.lineWidth=1.5;c.beginPath();c.ellipse(p.x,p.y,5+u*48,2+u*13,0,0,Math.PI*2);c.stroke();for(let i=0;i<9;i++){const a=i*2.399;c.fillStyle='rgba(239,234,203,'+(1-u)+')';c.beginPath();c.ellipse(p.x+Math.cos(a)*u*28,p.y-Math.sin(u*Math.PI)*18+Math.sin(a)*u*8,1,1.6,0,0,6.28);c.fill();}}
 if(r.phase==='caught'||r.phase==='release'){const u=r.phase==='release'?Math.min(1,r.time/1.1):0,at=this.screen(.5,.57-u*.16),size=Math.min(w*.62,240)*(1-u*.58);c.save();c.fillStyle='rgba(13,29,24,'+((1-u)*.15)+')';c.fillRect(0,0,w,h);c.globalAlpha=(1-u)*.18;c.fillStyle='#142d25';c.beginPath();c.ellipse(at.x,at.y+size*.31,size*.4,size*.065,0,0,6.28);c.fill();c.globalAlpha=1-u*.85;drawFish(c,r.kind,at.x+u*35,at.y,size,size*.67);c.restore();if(u>0){c.strokeStyle='rgba(237,237,211,'+((1-u)*.5)+')';c.lineWidth=1;c.beginPath();c.ellipse(at.x,at.y+6,35+u*45,8+u*12,0,0,6.28);c.stroke();}return;}

 const loaded=r.phase==='cast'?r.castPower*Math.exp(-r.time*14):power,lift=r.phase==='fight'?Math.exp(-r.time*7)*.18:0,castKick=r.phase==='cast'?Math.sin(Math.min(1,r.time/.45)*Math.PI)*.2:0,bend=fight?r.tension:loaded*.5,restTip=this.screen(.39-r.steer*.18-castKick*.4,.46+bend*.19+loaded*.12-lift-castKick),tip=fight?loadedTip(restTip,p,r.tension):restTip;drawRod(c,handle,tip,bend,t,reeling,this.k);
 if(r.phase!=='ready'&&r.phase!=='miss'){c.strokeStyle='rgba(229,229,204,.8)';c.lineWidth=.8;c.beginPath();c.moveTo(tip.x,tip.y);const end=r.phase==='cast'?airborne:{x:p.x,y:p.y+dip},slack=fight?70:r.phase==='cast'?Math.sin(Math.min(1,r.time/1.05)*Math.PI)*65:24,control=lineControl(tip,end,fight?r.tension:0,slack);c.quadraticCurveTo(control.x,control.y,end.x,end.y);c.stroke();}
 if(r.phase==='ready'){const home=this.screen(C.spots[r.spot].target[0],C.spots[r.spot].target[1]);c.strokeStyle='rgba(237,235,201,.45)';c.lineWidth=1;for(let i=0;i<2;i++){c.beginPath();c.ellipse(home.x,home.y,14+i*13+Math.sin(t)*3,3+i*3,0,0,6.28);c.stroke();}const a=this.screen(r.targetX,power>.01?castLanding(r.targetY,power):r.targetY);if(power>.01){c.save();c.setLineDash([3,7]);c.globalAlpha=.45;c.beginPath();c.moveTo(tip.x,tip.y);c.quadraticCurveTo((tip.x+a.x)/2,a.y-this.k*.2,a.x,a.y);c.stroke();c.restore();}c.strokeStyle='rgba(245,225,168,.65)';c.lineWidth=1;c.beginPath();c.ellipse(a.x,a.y,18+power*24,5+power*7,0,0,6.28);c.stroke();}
 if(r.phase==='net'){const n=cursor?this.screen(cursor.x,cursor.y):this.screen(.28,.84);drawNet(c,n.x,n.y,h);}
 if(r.phase==='fight'){c.save();c.font='11px sans-serif';c.textAlign='center';c.fillStyle='rgba(239,228,194,.78)';c.shadowColor='#183126';c.shadowBlur=6;c.fillText(C.copy.reelGesture,w*(w>h?.32:.5),h*.81);c.restore();}
 if(fight){const q=this.screen(.5,.93);c.lineWidth=3;c.strokeStyle='rgba(21,32,24,.6)';c.beginPath();c.arc(q.x,q.y,26,Math.PI,Math.PI*2);c.stroke();c.strokeStyle=r.tension>.85?'#d9976d':'#d1d6ad';c.beginPath();c.arc(q.x,q.y,26,Math.PI,Math.PI+Math.PI*Math.min(1,r.tension));c.stroke();}
 }
}

export function whenFishReady(draw:()=>void){if(fish.complete&&fish.naturalWidth)draw();else fish.addEventListener('load',draw,{once:true});}
