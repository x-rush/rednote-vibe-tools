/** Deterministic, render-only wind and reflected wave crests. No gameplay RNG. */
const TAU=Math.PI*2;
function seed(i:number){const n=Math.sin(i*127.1+19.7)*43758.5453;return n-Math.floor(n);}
export function wind(time:number,phase:number){return Math.sin(time*.63+phase)*.58+Math.sin(time*1.13+phase*.7)*.23+Math.sin(time*.21+phase*1.3)*.19;}
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
export function contactRings(g:CanvasRenderingContext2D,x:number,y:number,age:number,scale:number,strength=1){
 if(age<0||age>2.4)return;g.save();g.strokeStyle='#e0e7cf';g.lineWidth=.8;
 for(let k=0;k<2;k++){const u=age-k*.17;if(u<0)continue;g.globalAlpha=Math.max(0,(1-u/2.4)*.3*strength);g.beginPath();g.ellipse(x,y,(3+u*26)*scale,(1+u*7)*scale,0,0,TAU);g.stroke();}g.restore();
}
