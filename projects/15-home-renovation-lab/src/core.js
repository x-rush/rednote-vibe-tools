import {improveTemplate} from './circulation.js';
export const clone = value => JSON.parse(JSON.stringify(value));
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function bounds(rooms) {
  const x=Math.min(...rooms.map(r=>r.x)),z=Math.min(...rooms.map(r=>r.z)),right=Math.max(...rooms.map(r=>r.x+r.w)),bottom=Math.max(...rooms.map(r=>r.z+r.d));
  return {x,z,w:right-x,d:bottom-z,cx:(x+right)/2,cz:(z+bottom)/2};
}
export function roomAt(plan,x,z,margin=0){return plan.rooms.find(r=>x>=r.x+margin&&z>=r.z+margin&&x<=r.x+r.w-margin&&z<=r.z+r.d-margin);}
export function validRoom(plan,room){return [room.x,room.z,room.w,room.d].every(Number.isFinite)&&Math.abs(room.x)<=60&&Math.abs(room.z)<=60&&room.w>=1.5&&room.d>=1.5&&room.w<=16&&room.d<=16&&!plan.rooms.some(r=>r.id!==room.id&&room.x<r.x+r.w-0.01&&room.x+room.w>r.x+0.01&&room.z<r.z+r.d-0.01&&room.z+room.d>r.z+0.01);}
export function corners(o,pad=0){const a=o.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:o.x+x*(o.w/2+pad)*c+z*(o.d/2+pad)*s,z:o.z-x*(o.w/2+pad)*s+z*(o.d/2+pad)*c}));}
export function overlap(a,b){
  const A=corners(a,-0.025),B=corners(b,-0.025);
  for(const poly of [A,B])for(let i=0;i<2;i++){const edge={x:poly[i+1].x-poly[i].x,z:poly[i+1].z-poly[i].z},axis={x:-edge.z,z:edge.x},pa=A.map(v=>v.x*axis.x+v.z*axis.z),pb=B.map(v=>v.x*axis.x+v.z*axis.z);if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false;}return true;
}
export function placement(plan,item,catalog){
  const r=roomAt(plan,item.x,item.z);if(!r||!corners(item).every(p=>p.x>=r.x+0.04&&p.x<=r.x+r.w-0.04&&p.z>=r.z+0.04&&p.z<=r.z+r.d-0.04))return null;
  const def=catalog.furniture.find(f=>f.id===item.catalogId);if(!def?.overlay&&plan.items.some(o=>o.id!==item.id&&!catalog.furniture.find(f=>f.id===o.catalogId)?.overlay&&overlap(item,o)))return null;return r;
}
export function itemFrom(def,room,x,z,angle=0){return{id:uid(),catalogId:def.id,roomId:room.id,x,z,w:def.w,d:def.d,h:def.h,color:def.color,angle};}
export function findSpot(plan,def,room,catalog){for(let z=room.z+def.d/2+0.12;z<room.z+room.d-def.d/2;z+=0.22)for(let x=room.x+def.w/2+0.12;x<room.x+room.w-def.w/2;x+=0.22){const o=itemFrom(def,room,round(x),round(z));if(placement(plan,o,catalog))return o;}return null;}
export function makePlan(template,catalog,legacy=false){
  const plan={schemaVersion:1,id:uid(),name:template.name,mode:'beginner',wallHeight:2.65,wallHeightMeasured:false,wallThickness:0.14,buildingArea:null,rooms:[],items:[],openings:[],prices:{},style:'natural',updatedAt:Date.now()};
  plan.rooms=template.rooms.map(([name,x,z,w,d,kind])=>({id:uid(),name,x,z,w,d,kind,measured:false,floor:['bath','kitchen'].includes(kind)?'tile':'oak',wall:'cream',textureScale:1,textureAngle:0}));
  const add=(id,r,x,z,angle=0)=>{const def=catalog.furniture.find(f=>f.id===id),o=itemFrom(def,r,r.x+x,r.z+z,angle);if(placement(plan,o,catalog))plan.items.push(o);};
  for(const r of plan.rooms){const w=r.w,d=r.d;
    if(['living','studio'].includes(r.kind)){add('rug',r,w/2,d/2+0.1);add('sofa',r,1.7,0.65);add('coffee',r,1.7,1.8);add('armchair',r,w-0.65,2,270);add('tv',r,1.5,d-0.32);add('plant',r,w-0.45,0.5);add('lamp',r,0.4,0.65);add('art',r,w-0.85,d-0.22);if(r.kind==='studio')add('singlebed',r,w-0.8,d-1.15);}
    else if(r.kind==='bedroom'){add('bed',r,w/2,1.2);add('nightstand',r,0.4,0.65);add('lamp',r,w-0.4,0.5);add('wardrobe',r,w/2,d-0.4);add('plant',r,w-0.4,d-0.45);}
    else if(r.kind==='kitchen'){add('kitchen',r,w/2,0.45);add('fridge',r,w-0.45,d-0.45);add('plant',r,0.4,d-0.4);}
    else if(r.kind==='bath'){add('shower',r,0.58,0.58);add('toilet',r,w-0.38,0.6);add('vanity',r,w/2,d-0.38);}
    else if(r.kind==='dining'){add('dining',r,w/2,d/2);add('chair',r,w/2,d/2-0.85);add('chair',r,w/2,d/2+0.85,180);add('plant',r,w-0.4,0.45);}
    else if(r.kind==='study'){add('desk',r,w/2,0.45);add('chair',r,w/2,1.1);add('bookcase',r,w/2,d-0.35);add('plant',r,w-0.4,0.4);}
    else{add('bench',r,w/2,0.4);add('plant',r,0.42,d-0.45);add('plant',r,w-0.42,d-0.45);add('roundtable',r,w/2,d-0.5);}
  }
 
 if(!legacy&&Array.isArray(template.furnishings)){
  plan.items=[];
  plan.rooms.forEach((r,index)=>{
   for(const [id,a,b,anchor,angle=0] of template.furnishings[index]||[]){
    let x=r.w*a,z=b;
    if(anchor==='south')z=r.d-b;
    else if(anchor==='center'){x=r.w*a;z=r.d*b;}
    else if(anchor==='center-north')z=r.d/2-b;
    else if(anchor==='center-south')z=r.d/2+b;
    else if(anchor==='west'){x=a;z=b;}
    else if(anchor==='northwest'){x=a;z=b;}
    else if(anchor==='northeast'){x=r.w-a;z=b;}
    else if(anchor==='southeast'){x=r.w-a;z=r.d-b;}
    add(id,r,x,z,angle);
   }
  });
 }
 for(const wall of walls(plan)){
    if(wall.rooms.length===2&&wall.length>1.15)plan.openings.push({id:uid(),roomId:wall.rooms[0],side:wall.sides[0],offset:round((wall.start+wall.end)/2-wall.origin),w:0.9,h:2.15,sill:0,type:'door'});
    else if(wall.rooms.length===1&&wall.length>2.4&&['north','west'].includes(wall.sides[0]))plan.openings.push({id:uid(),roomId:wall.rooms[0],side:wall.sides[0],offset:round((wall.start+wall.end)/2-wall.origin),w:Math.min(1.65,wall.length-0.7),h:1.15,sill:1,type:'window'});
  }return legacy==='raw'?plan:improveTemplate(plan,catalog);
}
export function walls(plan){
  const raw=[];
  for(const r of plan.rooms)for(const [side,axis,line,start,end]of[['north','x',r.z,r.x,r.x+r.w],['south','x',r.z+r.d,r.x,r.x+r.w],['west','z',r.x,r.z,r.z+r.d],['east','z',r.x+r.w,r.z,r.z+r.d]])raw.push({side,axis,line:round(line,3),start:round(start,3),end:round(end,3),roomId:r.id,origin:start});
  const groups=[],opposite={north:'south',south:'north',west:'east',east:'west'},tolerance=(plan.wallThickness||.14)+.001;
  for(const a of raw){
    const group=groups.find(list=>list[0].axis===a.axis&&list.every(b=>Math.abs(a.line-b.line)<=tolerance)&&list.some(b=>Math.abs(a.line-b.line)<.001||(b.roomId!==a.roomId&&opposite[b.side]===a.side&&Math.min(a.end,b.end)>Math.max(a.start,b.start)&&(['south','east'].includes(b.side)?a.line>=b.line-.011:a.line<=b.line+.011))));
    if(group)group.push(a);else groups.push([a]);
  }
  const result=[];
  for(const list of groups){const points=[...new Set(list.flatMap(a=>[a.start,a.end]))].sort((a,b)=>a-b);
    for(let i=0;i<points.length-1;i++){const start=points[i],end=points[i+1],mid=(start+end)/2,cover=list.filter(a=>a.start<mid&&a.end>mid);if(!cover.length)continue;
      const lo=Math.min(...cover.map(a=>a.line)),hi=Math.max(...cover.map(a=>a.line));
      result.push({axis:cover[0].axis,line:(lo+hi)/2,thickness:(plan.wallThickness||.14)+hi-lo,start,end,length:end-start,rooms:cover.map(a=>a.roomId),sides:cover.map(a=>a.side),origins:cover.map(a=>a.origin),origin:cover[0].origin});
    }
  }return result;
}
export function wallOpenings(plan,wall){
  return plan.openings.flatMap(o=>{const i=wall.rooms.findIndex((id,j)=>id===o.roomId&&wall.sides[j]===o.side);if(i<0)return[];const center=wall.origins[i]+o.offset;return center-o.w/2>=wall.start-.001&&center+o.w/2<=wall.end+.001?[{...o,center}]:[];});
}
export function outsideItems(plan){return plan.items.filter(o=>{const r=plan.rooms.find(r=>r.id===o.roomId);return !r||!corners(o).every(p=>p.x>=r.x+.04&&p.x<=r.x+r.w-.04&&p.z>=r.z+.04&&p.z<=r.z+r.d-.04);});}
export function removeRoom(plan,id){
  const segments=walls(plan);
  plan.openings=plan.openings.flatMap(o=>{if(o.roomId!==id)return[o];const wall=segments.find(w=>w.rooms.some(r=>r!==id)&&wallOpenings({...plan,openings:[o]},w).length);if(!wall)return[];const i=wall.rooms.findIndex(r=>r!==id),center=wallOpenings({...plan,openings:[o]},wall)[0].center;return[{...o,roomId:wall.rooms[i],side:wall.sides[i],offset:round(center-wall.origins[i],3)}];});
  plan.rooms=plan.rooms.filter(r=>r.id!==id);plan.items=plan.items.filter(o=>o.roomId!==id);plan.openings=plan.openings.filter(o=>validOpening(plan,o));
}
export function validOpening(plan,o){
  if(!plan.rooms.some(r=>r.id===o.roomId)||!['north','south','west','east'].includes(o.side)||!['door','window'].includes(o.type)||![o.offset,o.w,o.h,o.sill].every(Number.isFinite)||o.w<0.4||o.h<0.3||o.sill<0||o.sill+o.h>plan.wallHeight-0.05)return false;
  const segment=walls(plan).find(w=>wallOpenings({...plan,openings:[o]},w).length);if(!segment)return false;const candidate=wallOpenings({...plan,openings:[o]},segment)[0];return !wallOpenings(plan,segment).some(other=>other.id!==o.id&&Math.abs(other.center-candidate.center)<(other.w+candidate.w)/2+0.08);
}
export function inventory(plan,catalog){
  const furniture=new Map(),materials=new Map();for(const o of plan.items){const def=catalog.furniture.find(f=>f.id===o.catalogId),key=`${o.catalogId}:${o.w}:${o.d}:${o.h}:${o.color}`;if(!furniture.has(key))furniture.set(key,{key,name:def.name,size:`${o.w} × ${o.d} × ${o.h}`,color:o.color,quantity:0,rooms:new Set()});const row=furniture.get(key);row.quantity++;row.rooms.add(plan.rooms.find(r=>r.id===o.roomId)?.name||'');}
  const segments=walls(plan);for(const r of plan.rooms)for(const surface of ['floor','wall']){const key=`${surface}:${r[surface]}`,def=catalog.materials.find(m=>m.id===r[surface]);if(!materials.has(key))materials.set(key,{key,name:def.name,surface,quantity:0,unknown:false,rooms:[]});const row=materials.get(key);row.rooms.push(r.name);if(!r.measured||(surface==='wall'&&!plan.wallHeightMeasured))row.unknown=true;else if(surface==='floor')row.quantity+=r.w*r.d;else{let area=2*(r.w+r.d)*plan.wallHeight;for(const wall of segments.filter(w=>w.rooms.includes(r.id)))for(const o of wallOpenings(plan,wall))area-=o.w*o.h;row.quantity+=Math.max(0,area);}}
  return{furniture:[...furniture.values()].map(r=>({...r,rooms:[...r.rooms]})),materials:[...materials.values()].map(r=>({...r,quantity:round(r.quantity)})),area:round(plan.rooms.filter(r=>r.measured).reduce((s,r)=>s+r.w*r.d,0)),measured:plan.rooms.filter(r=>r.measured).length};
}
export class History{constructor(){this.past=[];this.future=[];}record(plan){this.past.push(clone(plan));if(this.past.length>60)this.past.shift();this.future=[];}undo(plan){if(!this.past.length)return plan;this.future.push(clone(plan));return this.past.pop();}redo(plan){if(!this.future.length)return plan;this.past.push(clone(plan));return this.future.pop();}}
export function validatePlan(value,catalog){
  const p=clone(value),fail=()=>{throw new Error('Invalid plan');};if(p.schemaVersion!==1||!Array.isArray(p.rooms)||!Array.isArray(p.items)||!Array.isArray(p.openings)||p.rooms.length<1||p.rooms.length>20||p.items.length>160||p.openings.length>100)fail();
  const text=v=>typeof v==='string'&&v.length>0&&v.length<=100;if(!text(p.id)||!text(p.name)||!['beginner','advanced'].includes(p.mode)||!Number.isFinite(p.wallHeight)||p.wallHeight<2.2||p.wallHeight>4.5||!Number.isFinite(p.wallThickness)||p.wallThickness<0.08||p.wallThickness>0.4)fail();
  const ids=new Set();for(const o of [...p.rooms,...p.items,...p.openings]){if(!text(o.id)||ids.has(o.id))fail();ids.add(o.id);}
  for(const r of p.rooms)if(!text(r.name)||!validRoom(p,r)||typeof r.measured!=='boolean'||!catalog.materials.some(m=>m.id===r.floor)||!catalog.materials.some(m=>m.id===r.wall)||!Number.isFinite(r.textureScale)||r.textureScale<0.25||r.textureScale>4||!Number.isFinite(r.textureAngle))fail();
  for(const o of p.items)if(!catalog.furniture.some(f=>f.id===o.catalogId)||!p.rooms.some(r=>r.id===o.roomId)||![o.x,o.z,o.w,o.d,o.h,o.angle].every(Number.isFinite)||Math.abs(o.x)>90||Math.abs(o.z)>90||o.w<0.1||o.d<0.1||o.h<0.01||o.w>8||o.d>8||o.h>4||!/^#[0-9a-f]{6}$/i.test(o.color))fail();
  for(const o of p.openings)if(!validOpening(p,o))fail();if(p.buildingArea!==null&&(!Number.isFinite(p.buildingArea)||p.buildingArea<=0||p.buildingArea>10000))fail();if(!p.prices||typeof p.prices!=='object'||Array.isArray(p.prices)||Object.values(p.prices).some(v=>!Number.isFinite(v)||v<0||v>10000000))fail();
  // Persist only known structural fields; imported media or arbitrary payloads are discarded.
  const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(o,k)).map(k=>[k,o[k]]));
  const result=pick(p,['schemaVersion','id','name','mode','wallHeight','wallThickness','buildingArea','updatedAt']);result.wallHeightMeasured=p.wallHeightMeasured===true;
  result.style=catalog.styles.some(s=>s.id===p.style)?p.style:'natural';
  result.rooms=p.rooms.map(r=>({...pick(r,['id','name','x','z','w','d','measured','floor','wall','textureScale','textureAngle']),kind:['living','studio','bedroom','kitchen','bath','dining','study','balcony','empty'].includes(r.kind)?r.kind:'empty'}));
  result.items=p.items.map(o=>pick(o,['id','catalogId','roomId','x','z','w','d','h','color','angle']));result.openings=p.openings.map(o=>pick(o,['id','roomId','side','offset','w','h','sill','type']));
  const priceKeys=new Set([...inventory(result,catalog).furniture,...inventory(result,catalog).materials].map(r=>r.key));result.prices=Object.fromEntries(Object.entries(p.prices).filter(([key])=>priceKeys.has(key)));return result;
}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function walkable(plan,x,z,catalog){const r=roomAt(plan,x,z,0.12);if(!r)return false;const avatar={x,z,w:0.28,d:0.28,angle:0};return !plan.items.some(o=>!catalog.furniture.find(f=>f.id===o.catalogId)?.overlay&&overlap(avatar,o));}
export function canWalk(plan,from,to,catalog){
  const dx=to.x-from.x,dz=to.z-from.z,steps=Math.ceil(Math.hypot(dx,dz)/0.06);let previous=roomAt(plan,from.x,from.z);
  for(let i=1;i<=steps;i++){const x=from.x+dx*i/steps,z=from.z+dz*i/steps;let r=roomAt(plan,x,z);
    if(!r){const bridge=walls(plan).find(w=>w.rooms.length>1&&Math.abs((w.axis==='x'?z:x)-w.line)<=w.thickness/2&&wallOpenings(plan,w).some(o=>o.type==='door'&&Math.abs((w.axis==='x'?x:z)-o.center)<o.w/2-.14));if(!bridge)return false;r=plan.rooms.find(room=>room.id===(bridge.rooms.includes(previous?.id)?previous.id:bridge.rooms[0]));}const avatar={x,z,w:0.25,d:0.25,angle:0};if(plan.items.some(o=>!catalog.furniture.find(f=>f.id===o.catalogId)?.overlay&&overlap(avatar,o)))return false;
    if(previous&&r.id!==previous.id){const shared=walls(plan).filter(w=>w.rooms.includes(r.id)&&w.rooms.includes(previous.id));if(!shared.some(w=>wallOpenings(plan,w).some(o=>o.type==='door'&&Math.abs((w.axis==='x'?x:z)-o.center)<o.w/2-0.14)))return false;}previous=r;
  }return walkable(plan,to.x,to.z,catalog);
}
