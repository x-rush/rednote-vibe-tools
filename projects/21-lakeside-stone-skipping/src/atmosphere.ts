/** Deterministic, render-only wind and reflected wave crests. No gameplay RNG. */
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
