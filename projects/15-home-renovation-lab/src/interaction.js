import {round,validRoom,corners,placement} from './core.js';
export function adjacentRoom(room,side,w=3,d=3){
  if(side==='north')return{x:room.x,z:round(room.z-d)};
  if(side==='south')return{x:room.x,z:round(room.z+room.d)};
  if(side==='west')return{x:round(room.x-w),z:room.z};
  return{x:round(room.x+room.w),z:room.z};
}
export function snapRoom(plan,candidate,original,threshold=.18){
  const xs=[candidate.x],zs=[candidate.z],widths=[candidate.w],depths=[candidate.d];
  const resizing=candidate.w!==original.w||candidate.d!==original.d;
  for(const r of plan.rooms){if(r.id===candidate.id)continue;
    for(const x of [r.x,r.x+r.w]){if(resizing){const w=round(x-candidate.x);if(Math.abs(w-candidate.w)<=threshold)widths.push(w);}else for(const v of [x,x-candidate.w])if(Math.abs(v-candidate.x)<=threshold)xs.push(round(v));}
    for(const z of [r.z,r.z+r.d]){if(resizing){const d=round(z-candidate.z);if(Math.abs(d-candidate.d)<=threshold)depths.push(d);}else for(const v of [z,z-candidate.d])if(Math.abs(v-candidate.z)<=threshold)zs.push(round(v));}
  }
  for(const x of xs.slice().reverse())for(const z of zs.slice().reverse())for(const w of widths.slice().reverse())for(const d of depths.slice().reverse()){const n={...candidate,x,z,w,d};if(validRoom(plan,n))return n;}
  return candidate;
}
export function snapFurniture(plan,candidate,catalog,threshold=.16){
  const room=plan.rooms.find(r=>r.id===candidate.roomId);if(!room)return candidate;
  const points=corners(candidate),left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.z)),bottom=Math.max(...points.map(p=>p.z));
  const xs=[0],zs=[0];for(const dx of [room.x+.05-left,room.x+room.w-.05-right])if(Math.abs(dx)<=threshold)xs.push(dx);for(const dz of [room.z+.05-top,room.z+room.d-.05-bottom])if(Math.abs(dz)<=threshold)zs.push(dz);
  for(const dx of xs.slice().reverse())for(const dz of zs.slice().reverse()){const n={...candidate,x:round(candidate.x+dx),z:round(candidate.z+dz)};if(placement(plan,n,catalog))return n;}return candidate;
}

export function snapRoomEdge(plan,candidate,side,threshold=.18){
  const horizontal=side==='east'||side==='west',coordinate=side==='east'?candidate.x+candidate.w:side==='west'?candidate.x:side==='south'?candidate.z+candidate.d:candidate.z;
  const edges=plan.rooms.filter(r=>r.id!==candidate.id).flatMap(r=>horizontal?[r.x,r.x+r.w]:[r.z,r.z+r.d]).filter(v=>Math.abs(v-coordinate)<=threshold).sort((a,b)=>Math.abs(a-coordinate)-Math.abs(b-coordinate));
  for(const edge of edges){const n={...candidate};if(side==='east')n.w=round(edge-n.x);if(side==='south')n.d=round(edge-n.z);if(side==='west'){n.w=round(n.x+n.w-edge);n.x=round(edge);}if(side==='north'){n.d=round(n.z+n.d-edge);n.z=round(edge);}if(validRoom(plan,n))return n;}return candidate;
}
