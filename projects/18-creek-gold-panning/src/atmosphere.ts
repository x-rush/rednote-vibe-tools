/** Deterministic, render-only wind and reflected wave crests. No gameplay RNG. */
export interface Reeds {x:number;y:number;height:number;spread:number;count:number;lean:number;color:string;light:string;heads:boolean}
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
/** Call inside the actual water mask. Sparse short crests follow one coherent wave field. */
export function shimmer(g:CanvasRenderingContext2D,w:number,h:number,top:number,sun:number,time:number,strength:number,warm:boolean,low:boolean){
 const span=Math.max(1,h-top);g.save();g.globalCompositeOperation='screen';g.strokeStyle=warm?'#ffe9b3':'#d5e7dc';g.lineCap='round';
 for(let i=0;i<(low?100:260);i++){
  const d=seed(i+31),depth=.05+d*.95,y=top+depth*span,spread=.055+depth*.45,x=sun+(seed(i+173)-.5)*w*spread*2;
  const phase=x*.037+y*.055-time*.95,crest=Math.pow(Math.max(0,Math.sin(phase+Math.sin(x*.011-y*.024+time*.41)*1.4)),9),fade=Math.sin(d*Math.PI)*(.35+depth*.65),a=crest*fade*strength;
  if(a<.013)continue;const length=(.6+depth*7)*( .4+seed(i+19)),drift=wind(time*.7,i*.1)*(1+depth*2);
  g.globalAlpha=a;g.lineWidth=.45+depth*.9;g.beginPath();g.moveTo(x-length+drift,y);g.quadraticCurveTo(x+drift,y-.5-depth,x+length+drift,y);g.stroke();
  if(a>.38){g.globalAlpha=a*.22;g.lineWidth=2.5+depth*2;g.stroke();}
 }
 g.restore();
}
