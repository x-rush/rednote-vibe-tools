// Deterministic PCM synthesis shared by playback, tests and listening previews.
function randomSource(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function jellyImpact(rate,{land=false,seed=17}={}){
 const random=randomSource(seed),duration=land?.94:.78,out=new Float32Array(Math.ceil(rate*duration));let phase=0;const base=(land?145:185)*( .97+random()*.06);
 for(let i=0;i<out.length;i++){const t=i/rate,attack=1-Math.exp(-t/.025),tail=Math.pow(1-t/duration,2),wobble=Math.sin(2*Math.PI*7.2*t)*Math.exp(-t*4.8),pitch=base*(1+.28*Math.exp(-t*18)+.17*wobble);phase+=2*Math.PI*pitch/rate;const envelope=attack*tail*(.74+.26*Math.cos(2*Math.PI*7.2*t));out[i]=.72*envelope*(Math.sin(phase)+.25*Math.sin(phase*2.03)*Math.exp(-t*5)+.07*Math.sin(phase*3)*Math.exp(-t*12));}
 return out;
}
export function liquidStream(rate,{seconds=8,seed=41}={}){
 const random=randomSource(seed),out=new Float32Array(Math.ceil(rate*seconds));let low=0,body=0;const a=1-Math.exp(-2*Math.PI*1150/rate),b=1-Math.exp(-2*Math.PI*160/rate);
 for(let i=0;i<out.length;i++){const t=i/rate;low+=a*((random()*2-1)-low);body+=b*(low-body);const flow=.78+.13*Math.sin(t*5.3)+.09*Math.sin(t*11.7);out[i]=(low-body)*.48*flow;}
 // Small resonant pockets are part of the stream, not a regular sequence of beeps.
 for(let at=.10;at<seconds-.35;at+=.15+random()*.32){const length=.09+random()*.12,pitch=190+random()*300,level=.04+random()*.075;let phase=0;for(let j=0;j<rate*length;j++){const index=Math.floor(at*rate)+j;if(index>=out.length)break;const t=j/rate,u=t/length;phase+=2*Math.PI*pitch*(.8+.65*u)/rate;out[index]+=Math.sin(phase)*Math.sin(Math.PI*u)*Math.exp(-u*3)*level;}}
 // Smooth loop boundaries so a long hold never introduces a click.
 const edge=Math.floor(rate*.08);for(let i=0;i<edge;i++){const w=.5-.5*Math.cos(Math.PI*i/edge);out[i]*=w;out[out.length-1-i]*=w;}return out;
}
