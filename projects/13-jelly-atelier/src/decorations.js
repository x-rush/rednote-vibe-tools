import {toppingFits} from './contour.js';
export function cleanDecoration(t,content){
  const out={kind:t.kind,x:t.x,z:t.z};
  if(Number.isFinite(t.rotation))out.rotation=((t.rotation%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
  if(Number.isFinite(t.scale))out.scale=Math.max(.6,Math.min(1.5,t.scale));
  if(Number.isSafeInteger(t.seed)&&t.seed>=0)out.seed=t.seed;
  if(content.studio.colors.includes(t.color))out.color=t.color;
  if(typeof t.digits==='string'&&/^\d{1,3}$/.test(t.digits))out.digits=t.digits;
  if(typeof t.lit==='boolean')out.lit=t.lit;
  return out;
}
export function decorationFits(recipe,item,content){
  if(!toppingFits(recipe,item,content))return false;
  const radius=(item.kind==='number'?.1*(item.digits||'0').length:.10)*(item.scale||1);
  return Array.from({length:8},(_,i)=>({x:item.x+Math.cos(i*Math.PI/4)*radius,z:item.z+Math.sin(i*Math.PI/4)*radius})).every(p=>toppingFits(recipe,p,content));
}
export function nextPhrase(index,length,random=Math.random){if(length<2)return 0;return (index+1+Math.floor(random()*(length-1)))%length;}

export function findDecorationSpot(recipe,draft,content){
  let best=null,bestScore=-Infinity;
  for(let i=0;i<625;i++){const point={x:((i%25)-12)*.065,z:(Math.floor(i/25)-12)*.065},item={...draft,...point};if(!decorationFits(recipe,item,content))continue;
    const score=recipe.toppings.length?Math.min(...recipe.toppings.map(t=>Math.hypot(point.x-t.x,point.z-t.z)-.1*(t.scale||1)*(t.kind==='number'?(t.digits||'0').length:1)))-Math.hypot(point.x,point.z)*.04:-Math.hypot(point.x,point.z);
    if(score>bestScore){bestScore=score;best=point;}
  }return best;
}
