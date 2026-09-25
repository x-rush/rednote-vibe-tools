/** Deterministic, render-only wind and reflected wave crests. No gameplay RNG. */
export interface Reeds {x:number;y:number;height:number;spread:number;count:number;lean:number;color:string;light:string;heads:boolean}
const TAU=Math.PI*2;
function seed(i:number){const n=Math.sin(i*127.1+19.7)*43758.5453;return n-Math.floor(n);}
export function wind(time:number,phase:number){return Math.sin(time*.63+phase)*.58+Math.sin(time*1.13+phase*.7)*.23+Math.sin(time*.21+phase*1.3)*.19;}
export function reeds(g:CanvasRenderingContext2D,w:number,h:number,time:number,patches:Reeds[],low:boolean,reduced:boolean){
 const t=time*(reduced?.22:1);g.save();
 for(const [group,p] of patches.entries())for(let i=0;i<p.count;i+=low?2:1){
  const n=seed(i+group*47),baseX=(p.x+(n-.5)*p.spread)*w,baseY=p.y*h+(seed(i+91)-.5)*h*.012,len=p.height*h*(.48+seed(i+14)*.52),lean=p.lean+(seed(i+7)-.5)*.38+wind(t,group*.9+n)*.09*(reduced?.3:1),tipX=baseX+len*lean,tipY=baseY-len,width=.3+len*.003;
  g.fillStyle=p.color;g.beginPath();g.moveTo(baseX-width,baseY);g.quadraticCurveTo(baseX+len*lean*.35-width,baseY-len*.6,tipX,tipY);g.quadraticCurveTo(baseX+len*lean*.35+width,baseY-len*.6,baseX+width,baseY);g.fill();
  g.strokeStyle=p.light;g.globalAlpha=.32+.12*Math.max(0,wind(t,n));g.lineWidth=.55;g.beginPath();g.moveTo(baseX,baseY);g.quadraticCurveTo(baseX+len*lean*.35,baseY-len*.6,tipX,tipY);g.stroke();g.globalAlpha=1;
  if(p.heads&&i%3===0){g.save();g.translate(tipX,tipY+len*.075);g.rotate(lean*.7);g.strokeStyle=p.light;g.lineWidth=.65;for(let j=0;j<13;j++){const a=j/13,span=Math.sin(a*Math.PI)*len*.035;g.globalAlpha=.38+seed(j+i)*.26;g.beginPath();g.moveTo(0,a*len*.12);g.lineTo((j%2?1:-1)*span,a*len*.12-len*.027);g.stroke();}g.restore();}
 }
 g.restore();
}
export function contactRings(g:CanvasRenderingContext2D,x:number,y:number,age:number,scale:number,strength=1){
 if(age<0||age>2.4)return;g.save();g.strokeStyle='#e0e7cf';g.lineWidth=.8;
 for(let k=0;k<2;k++){const u=age-k*.17;if(u<0)continue;g.globalAlpha=Math.max(0,(1-u/2.4)*.3*strength);g.beginPath();g.ellipse(x,y,(3+u*26)*scale,(1+u*7)*scale,0,0,TAU);g.stroke();}g.restore();
}
