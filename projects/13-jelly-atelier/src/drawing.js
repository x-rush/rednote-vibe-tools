const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function simplifyStroke(points,tolerance=.012){
  if(points.length<3)return points.slice();
  const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
  while(stack.length){const [start,end]=stack.pop(),a=points[start],b=points[end],dx=b.x-a.x,dz=b.z-a.z;let best=tolerance,index=-1;
    for(let i=start+1;i<end;i++){const p=points[i],t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1))),d=Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);if(d>best){best=d;index=i;}}
    if(index>=0){keep.add(index);stack.push([start,index],[index,end]);}
  }
  return [...keep].sort((a,b)=>a-b).map(i=>({...points[i]}));
}
export function appendDrawingPoint(points,point,limit){
  if(points.length&&distance(points.at(-1),point)<=.008)return points;
  let next=points;
  if(next.length>=limit){next=simplifyStroke(next,.008);if(next.length>=limit)next=next.filter((_,i)=>i===0||i===next.length-1||i%2===0);}
  return [...next,{...point}];
}
export function tidyStroke(points){
  let next=simplifyStroke(points);
  // Remove only tiny local retracing loops, not real overlapping lobes.
  for(let i=0;i<next.length-2;i++){let length=0;for(let j=i+1;j<Math.min(next.length,i+8);j++){length+=distance(next[j-1],next[j]);if(length>.14)break;if(j>i+1&&distance(next[i],next[j])<.025){next=[...next.slice(0,i+1),...next.slice(j+1)];i=Math.max(-1,i-1);break;}}}
  return next;
}
