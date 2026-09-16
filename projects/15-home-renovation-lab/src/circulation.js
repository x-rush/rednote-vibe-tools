import {walls,wallOpenings,overlap,placement,validOpening,walkable,canWalk,round,roomAt} from './core.js';

// A single opening reserves approach space on both faces of a shared wall.
export function doorApproaches(plan){
  const result=[];
  for(const wall of walls(plan))for(const opening of wallOpenings(plan,wall)){if(opening.type!=='door')continue;
    wall.rooms.forEach((id,index)=>{const room=plan.rooms.find(r=>r.id===id),side=wall.sides[index],horizontal=wall.axis==='x',depth=.95;
      const x=horizontal?opening.center:side==='west'?room.x+depth/2:room.x+room.w-depth/2,z=horizontal?(side==='north'?room.z+depth/2:room.z+room.d-depth/2):opening.center;
      result.push({openingId:opening.id,roomId:id,side,x,z,w:horizontal?opening.w+.16:depth,d:horizontal?depth:opening.w+.16,angle:0});
    });
  }return result;
}
export function blockedDoorItems(plan,catalog){const zones=doorApproaches(plan);return plan.items.filter(o=>!catalog.furniture.find(f=>f.id===o.catalogId)?.overlay&&zones.some(zone=>zone.roomId===o.roomId&&overlap(o,zone)));}
function corridor(a,b,width=.78){const dx=b.x-a.x,dz=b.z-a.z;return{x:(a.x+b.x)/2,z:(a.z+b.z)/2,w:Math.hypot(dx,dz)+width,d:width,angle:-Math.atan2(dz,dx)*180/Math.PI};}
export function improveTemplate(plan,catalog){
  const solid=o=>!catalog.furniture.find(f=>f.id===o.catalogId)?.overlay;
  // Prefer a clear stretch of shared wall over placing every door at its midpoint.
  for(const opening of plan.openings){if(opening.type!=='door')continue;const wall=walls(plan).find(w=>wallOpenings({...plan,openings:[opening]},w).length);if(!wall)continue;const origin=wall.origins[wall.rooms.indexOf(opening.roomId)],initial=opening.offset;let best={...opening},score=Infinity;
    for(let center=wall.start+opening.w/2+.12;center<=wall.end-opening.w/2-.12;center+=.2){const candidate={...opening,offset:round(center-origin)};if(!validOpening(plan,candidate))continue;const trial={...plan,openings:plan.openings.map(o=>o.id===opening.id?candidate:o)},zones=doorApproaches(trial).filter(z=>z.openingId===opening.id),hits=plan.items.filter(o=>solid(o)&&zones.some(z=>z.roomId===o.roomId&&overlap(o,z))),cost=hits.reduce((sum,o)=>sum+1+o.w*o.d*3,0)+Math.abs(candidate.offset-initial)*.02;if(cost<score){score=cost;best=candidate;}}
    Object.assign(opening,best);
  }
  const approaches=doorApproaches(plan),reserved=[];
  for(const room of plan.rooms){const doors=approaches.filter(z=>z.roomId===room.id),objects=plan.items.filter(o=>o.roomId===room.id&&solid(o));let best=null,bestScore=Infinity;
    for(let x=room.x+.5;x<=room.x+room.w-.5;x+=.4)for(let z=room.z+.5;z<=room.z+room.d-.5;z+=.4){const point={x,z},routes=[{...point,w:.8,d:.8,angle:0},...doors,...doors.map(door=>corridor(door,point))],hits=objects.filter(o=>routes.some(route=>overlap(o,route))),cost=hits.reduce((sum,o)=>sum+1+o.w*o.d*4,0)+Math.hypot(x-room.x-room.w/2,z-room.z-room.d/2)*.01;if(cost<bestScore){bestScore=cost;best=routes;}}
    if(best)reserved.push(...best.map(route=>({...route,roomId:room.id})));
  }
  const obstructs=o=>solid(o)&&reserved.some(zone=>zone.roomId===o.roomId&&overlap(o,zone)),displaced=plan.items.filter(obstructs).sort((a,b)=>b.w*b.d-a.w*a.d);plan.items=plan.items.filter(o=>!obstructs(o));
  for(const original of displaced){const room=plan.rooms.find(r=>r.id===original.roomId);let best=null,score=Infinity;for(const angle of [original.angle,(original.angle+90)%360])for(let x=room.x+.2;x<room.x+room.w-.15;x+=.22)for(let z=room.z+.2;z<room.z+room.d-.15;z+=.22){const o={...original,x:round(x),z:round(z),angle};if(obstructs(o)||!placement(plan,o,catalog))continue;const distance=Math.hypot(x-original.x,z-original.z);if(distance<score){best=o;score=distance;}}if(best)plan.items.push(best);}
  return plan;
}
export function entryPoint(plan,room,catalog,corner=false){
  const candidates=doorApproaches(plan).filter(z=>z.roomId===room.id).map(z=>({x:z.x,z:z.z}));
  for(let x=room.x+.45;x<room.x+room.w-.4;x+=.35)for(let z=room.z+.45;z<room.z+room.d-.4;z+=.35)candidates.push({x,z});
  let best=null,score=-Infinity;for(const point of candidates){if(!walkable(plan,point.x,point.z,catalog))continue;let clearance=Math.min(point.x-room.x,room.x+room.w-point.x,point.z-room.z,room.z+room.d-point.z);
    for(const o of plan.items){if(o.roomId!==room.id||catalog.furniture.find(f=>f.id===o.catalogId)?.overlay)continue;const a=o.angle*Math.PI/180,dx=point.x-o.x,dz=point.z-o.z,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a);clearance=Math.min(clearance,Math.hypot(Math.max(0,Math.abs(lx)-o.w/2),Math.max(0,Math.abs(lz)-o.d/2)));}
    const desired={x:room.x+room.w*(corner?.25:.5),z:room.z+room.d*.76},value=Math.min(clearance,.8)*4-Math.hypot(point.x-desired.x,point.z-desired.z)*.3;if(value>score){score=value;best=point;}}
  return best;
}
function roomPath(plan,room,start,end,catalog){
  const local={...plan,rooms:[room],items:plan.items.filter(o=>o.roomId===room.id)},clear=(a,b)=>canWalk(local,a,b,catalog);if(!walkable(local,end.x,end.z,catalog))return null;if(clear(start,end))return[{x:end.x,z:end.z}];
  const cols=Math.ceil((room.w-.4)/.28)+1,rows=Math.ceil((room.d-.4)/.28)+1,sx=(room.w-.4)/(cols-1),sz=(room.d-.4)/(rows-1),point=i=>({x:room.x+.2+(i%cols)*sx,z:room.z+.2+Math.floor(i/cols)*sz}),cache=new Map(),available=i=>{if(!cache.has(i)){const p=point(i);cache.set(i,walkable(local,p.x,p.z,catalog));}return cache.get(i);};
  const open=[],cost=new Map(),parent=new Map(),closed=new Set(),startX=Math.round((start.x-room.x-.2)/sx),startZ=Math.round((start.z-room.z-.2)/sz);
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const x=startX+dx,z=startZ+dz;if(x<0||z<0||x>=cols||z>=rows)continue;const i=z*cols+x,p=point(i);if(available(i)&&clear(start,p)){cost.set(i,Math.hypot(p.x-start.x,p.z-start.z));parent.set(i,-1);open.push(i);}}
  let found=-1;for(let visit=0;open.length&&visit<4096;visit++){let at=0,value=Infinity;for(let j=0;j<open.length;j++){const p=point(open[j]),v=cost.get(open[j])+Math.hypot(p.x-end.x,p.z-end.z);if(v<value){at=j;value=v;}}const id=open.splice(at,1)[0];if(closed.has(id))continue;closed.add(id);const p=point(id);if(Math.hypot(p.x-end.x,p.z-end.z)<.7&&clear(p,end)){found=id;break;}
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=id%cols+dx,z=Math.floor(id/cols)+dz;if(x<0||z<0||x>=cols||z>=rows)continue;const next=z*cols+x;if(closed.has(next)||!available(next))continue;const q=point(next),g=cost.get(id)+Math.hypot(q.x-p.x,q.z-p.z);if(g>=(cost.get(next)??Infinity)||!clear(p,q))continue;cost.set(next,g);parent.set(next,id);open.push(next);}}
  if(found<0)return null;const path=[{x:end.x,z:end.z}];for(let i=found;i!==-1;i=parent.get(i))path.unshift(point(i));const simplified=[];let origin=start;for(let i=0;i<path.length;){let j=path.length-1;while(j>i&&!clear(origin,path[j]))j--;simplified.push(path[j]);origin=path[j];i=j+1;}return simplified;
}
export function walkingPath(plan,start,end,catalog){
  const source=roomAt(plan,start.x,start.z),target=roomAt(plan,end.x,end.z);if(!source||!target||!walkable(plan,end.x,end.z,catalog))return null;
  const zones=doorApproaches(plan),queue=[{room:source,point:{x:start.x,z:start.z},path:[]}],seen=new Set();
  for(let i=0;i<queue.length&&i<201;i++){const state=queue[i];if(state.room.id===target.id){const final=roomPath(plan,state.room,state.point,end,catalog);if(final)return[...state.path,...final];}
    for(const exit of zones.filter(z=>z.roomId===state.room.id)){const other=zones.find(z=>z.openingId===exit.openingId&&z.roomId!==exit.roomId);if(!other)continue;const key=other.roomId+':'+other.openingId;if(seen.has(key)||!canWalk(plan,exit,other,catalog))continue;const route=roomPath(plan,state.room,state.point,exit,catalog);if(!route)continue;seen.add(key);queue.push({room:plan.rooms.find(r=>r.id===other.roomId),point:{x:other.x,z:other.z},path:[...state.path,...route,{x:other.x,z:other.z}]});}}
  return null;
}
