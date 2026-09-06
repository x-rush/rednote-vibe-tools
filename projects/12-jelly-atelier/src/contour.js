export const polygonArea=points=>points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.z-q.x*p.z},0)/2;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function intersects(a,b,c,d){const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);if(Math.max(a.x,b.x)<Math.min(c.x,d.x)-1e-8||Math.max(c.x,d.x)<Math.min(a.x,b.x)-1e-8||Math.max(a.z,b.z)<Math.min(c.z,d.z)-1e-8||Math.max(c.z,d.z)<Math.min(a.z,b.z)-1e-8)return false;return ab1*ab2<=1e-12&&cd1*cd2<=1e-12;}
export function crossingEdges(points){for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++){if(i===0&&j===points.length-1)continue;if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return [i,j]}return null;}
export function insideOutline(point,points,margin=0){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.z>point.z)!==(b.z>point.z)&&point.x<(b.x-a.x)*(point.z-a.z)/(b.z-a.z)+a.x)inside=!inside;if(margin){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(point.x-a.x-t*dx,point.z-a.z-t*dz)<margin)return false;}}return inside;}
function resample(points,count){const lengths=points.map((p,i)=>distance(p,points[(i+1)%points.length])),total=lengths.reduce((a,b)=>a+b,0);let edge=0,offset=0;return Array.from({length:count},(_,i)=>{const target=total*i/count;while(edge<lengths.length-1&&offset+lengths[edge]<target){offset+=lengths[edge++]}const a=points[edge],b=points[(edge+1)%points.length],t=(target-offset)/(lengths[edge]||1);return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}})}
export function prepareOutline(raw,rules,{explicitClose=false}={}){
  if(!Array.isArray(raw)||raw.length>rules.maxInput||raw.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)))return {ok:false,error:'invalid'};
  let points=raw.filter((p,i)=>!i||distance(p,raw[i-1])>.008).map(({x,z})=>({x,z}));
  if(points.length<3)return {ok:false,error:'few'};
  if(!explicitClose&&distance(points[0],points.at(-1))>rules.closeDistance)return {ok:false,error:'open'};
  if(distance(points[0],points.at(-1))<.025)points.pop();
  if(points.length<3)return {ok:false,error:'few'};
  const crossing=crossingEdges(points);if(crossing)return {ok:false,error:'cross',crossing};
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...zs)-Math.min(...zs),span=Math.max(w,h);
  if(span<rules.minSpan||Math.abs(polygonArea(points))<span*span*rules.minAreaRatio)return {ok:false,error:'thin'};
  points=resample(points,rules.points/4);
  let softened=points.flatMap((p,i)=>{const q=points[(i+1)%points.length];return [{x:.75*p.x+.25*q.x,z:.75*p.z+.25*q.z},{x:.25*p.x+.75*q.x,z:.25*p.z+.75*q.z}]});
  softened=softened.flatMap((p,i)=>{const q=softened[(i+1)%softened.length];return [{x:.75*p.x+.25*q.x,z:.75*p.z+.25*q.z},{x:.25*p.x+.75*q.x,z:.25*p.z+.75*q.z}]});
  points=crossingEdges(softened)?resample(points,rules.points):softened;
  const centerX=(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,centerZ=(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2;
  const radius=Math.max(...points.map(p=>Math.max(Math.abs(p.x-centerX),Math.abs(p.z-centerZ))));
  points=points.map(p=>({x:Number(((p.x-centerX)/radius).toFixed(6)),z:Number(((p.z-centerZ)/radius).toFixed(6))}));
  if(polygonArea(points)<0)points.reverse();
  if(crossingEdges(points))return {ok:false,error:'thin'};
  return {ok:true,outline:points};
}
export function validSavedOutline(raw,rules){if(!Array.isArray(raw)||raw.length<3||raw.length>rules.points||raw.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.max(Math.abs(p.x),Math.abs(p.z))>1.001))return null;const points=raw.map(({x,z})=>({x,z}));if(polygonArea(points)<rules.minAreaRatio||crossingEdges(points))return null;return points;}
export const customScale=h=>1.08-.2*h+.025*Math.sin(Math.PI*h);
export function toppingFits(recipe,point,content){if(recipe.mold!=='custom')return Math.hypot(point.x,point.z)<=content.craft.toppingRadius+1e-6;return insideOutline({x:point.x/customScale(1),z:point.z/customScale(1)},recipe.outline,content.customRules.toppingMargin);}
export function interiorSpot(outline,index=0){const candidates=[];for(let z=-.9;z<=.9;z+=.075)for(let x=-.9;x<=.9;x+=.075)if(insideOutline({x,z},outline,.14))candidates.push({x:x*customScale(1),z:z*customScale(1)});if(!candidates.length){for(let z=-.95;z<=.95;z+=.035)for(let x=-.95;x<=.95;x+=.035)if(insideOutline({x,z},outline,.04))candidates.push({x:x*customScale(1),z:z*customScale(1)});}candidates.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));return candidates.length?candidates[(index*37)%candidates.length]:null;}
