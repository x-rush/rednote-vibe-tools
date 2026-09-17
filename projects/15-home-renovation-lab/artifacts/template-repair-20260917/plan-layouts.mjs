import {readFile,writeFile} from 'node:fs/promises';
import {makePlan,itemFrom,placement,overlap,validOpening,walkable,round} from '../../src/core.js';
import {doorApproaches,entryPoint,walkingPath,blockedDoorItems} from '../../src/circulation.js';
const catalog=JSON.parse(await readFile('src/content/content.json','utf8'));
const doorSpecs={one:[[0,'east',3.4],[0,'south',.8],[0,'south',3.8],[1,'south',1.2]],studio:[[0,'east',1.7]],two:[[0,'east',3.6],[0,'south',.8],[0,'south',3.8],[1,'south',1]],dining:[[0,'east',3.6],[0,'south',.8],[2,'east',2.6],[1,'south',2.8],[1,'east',3.5]],family:[[0,'east',3.7],[0,'south',.8],[3,'east',2.6],[1,'south',1.8],[1,'east',3.7],[2,'south',2.2]],ell:[[0,'east',3.6],[0,'south',.8],[0,'south',3.8],[2,'south',.8]]};
const essentials={living:['sofa','tv','coffee'],studio:['singlebed','loveseat','wardrobe','coffee'],bedroom:['bed','wardrobe'],kitchen:['kitchen','fridge'],bath:['shower','toilet','vanity'],dining:['dining','chair','chair'],study:['desk','chair','bookcase'],balcony:['bench']};
const layouts={};
for(const t of catalog.templates){
 const p=makePlan(t,catalog,'raw');p.items=[];p.openings=p.openings.filter(o=>o.type==='window');
 for(const [i,side,offset]of doorSpecs[t.id]){const o={id:'door-'+i+'-'+side+'-'+offset,roomId:p.rooms[i].id,side,offset,w:.9,h:2.15,sill:0,type:'door'};if(!validOpening(p,o))throw Error(t.id+' invalid door '+JSON.stringify(o));p.openings.push(o);}
 const zones=doorApproaches(p),items=[];
 for(const [ri,r]of p.rooms.entries()){
  const required=essentials[r.kind].map(id=>id==='bed'&&/次卧|儿童/.test(r.name)?'singlebed':id),roomZones=zones.filter(z=>z.roomId===r.id),defs=required.map(id=>catalog.furniture.find(f=>f.id===id));
  const local=()=>({...p,rooms:[r],items:p.items.filter(o=>o.roomId===r.id),openings:p.openings.filter(o=>o.roomId===r.id)});
  function connected(){const q=local(),entry=entryPoint(q,r,catalog);if(!walkable(q,entry.x,entry.z,catalog))return false;for(const z of roomZones)if(!walkingPath(q,entry,z,catalog))return false;for(const o of q.items){if(catalog.furniture.find(f=>f.id===o.catalogId).overlay)continue;const rad=o.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);const pts=[[0,o.d/2+.28],[0,-o.d/2-.28],[o.w/2+.28,0],[-o.w/2-.28,0]].map(([x,z])=>({x:o.x+x*c+z*s,z:o.z-x*s+z*c}));const access=['wardrobe','kitchen','fridge','vanity','bookcase','desk'].includes(o.catalogId)?pts.slice(0,1):pts;if(!access.some(pt=>walkable(q,pt.x,pt.z,catalog)&&walkingPath(q,entry,pt,catalog)))return false;}return true;}
  function candidates(def,index){const list=[];for(const angle of [0,90,180,270]){const horizontal=angle%180===0,w=horizontal?def.w:def.d,d=horizontal?def.d:def.w;for(let x=w/2+.08;x<=r.w-w/2-.06;x+=.2)for(let z=d/2+.08;z<=r.d-d/2-.06;z+=.2){const o=itemFrom(def,r,round(r.x+x),round(r.z+z),angle);if(roomZones.some(zone=>overlap(o,zone)))continue;const edge=Math.min(x-w/2,r.w-x-w/2,z-d/2,r.d-z-d/2),corner=Math.min(x-w/2,r.w-x-w/2)+Math.min(z-d/2,r.d-z-d/2);let score=edge*5+Math.hypot(x-r.w/2,z-def.d/2-.1)*.2;
   if(['shower','fridge'].includes(def.id))score=corner*5;
   if(['bed','singlebed','sofa','loveseat','kitchen','desk','tv','wardrobe','bookcase','vanity','bench','toilet'].includes(def.id)){const back=angle===0?z-d/2:angle===90?x-w/2:angle===180?r.d-z-d/2:r.w-x-w/2;score+=back*8;}
   if(['coffee','dining'].includes(def.id))score=Math.hypot(x-r.w/2,z-r.d/2)*3;
   const sofa=p.items.find(o=>o.roomId===r.id&&['sofa','loveseat'].includes(o.catalogId));
   if(sofa&&def.id==='tv'){const rad=sofa.angle*Math.PI/180,dx=o.x-sofa.x,dz=o.z-sofa.z;score+=Math.abs(dx*Math.cos(rad)-dz*Math.sin(rad))*8+(dx*Math.sin(rad)+dz*Math.cos(rad)<1.8?40:0)+(angle!==(sofa.angle+180)%360?30:0);}
   if(sofa&&def.id==='coffee'){const rad=sofa.angle*Math.PI/180,distance=sofa.d/2+def.d/2+.45;score=Math.hypot(o.x-sofa.x-Math.sin(rad)*distance,o.z-sofa.z-Math.cos(rad)*distance)*8;}

   if(def.id==='chair'){const table=p.items.find(o=>o.roomId===r.id&&['dining','desk'].includes(o.catalogId));if(table){const dx=table.x-o.x,dz=table.z-o.z,distance=Math.hypot(dx,dz),rad=angle*Math.PI/180;score=Math.abs(distance-.85)*8+(1-(dx*Math.sin(rad)+dz*Math.cos(rad))/distance)*12+Math.min(Math.abs(dx),Math.abs(dz))*5;}}
   list.push({o,score});}}
   return list.sort((a,b)=>a.score-b.score).slice(0,420).map(e=>e.o);
  }
  let attempts=0;function solve(index){if(index===defs.length)return connected();const opts=candidates(defs[index],index);for(const o of opts){if(++attempts>45000)return false;if(!placement(p,o,catalog))continue;p.items.push(o);if(solve(index+1))return true;p.items.pop();}return false;}
  if(!solve(0))throw Error(t.id+' '+r.name+' essential layout unsatisfied '+attempts);
  for(const id of (['living','bedroom','studio'].includes(r.kind)?['plant','lamp']:r.kind==='balcony'?['plant']:[])){const def=catalog.furniture.find(f=>f.id===id);for(const o of candidates(def,0)){if(!placement(p,o,catalog))continue;p.items.push(o);if(connected())break;p.items.pop();}}
  if(['living','studio'].includes(r.kind)){const def=catalog.furniture.find(f=>f.id==='rug'),o=itemFrom(def,r,r.x+r.w/2,r.z+r.d/2);if(placement(p,o,catalog))p.items.push(o);}
  items.push(p.items.filter(o=>o.roomId===r.id).map(o=>[o.catalogId,round(o.x-r.x),round(o.z-r.z),o.angle]));
  console.log(JSON.stringify({template:t.id,room:r.name,attempts,items:items.at(-1).map(o=>o[0])}));
 }
 if(blockedDoorItems(p,catalog).length)throw Error(t.id+' blocked doors');const start=entryPoint(p,p.rooms[0],catalog);for(const r of p.rooms)if(!walkingPath(p,start,entryPoint(p,r,catalog),catalog))throw Error(t.id+' unreachable '+r.name);
 layouts[t.id]={doors:doorSpecs[t.id],items};
}
await writeFile('artifacts/template-repair-20260917/candidate-layouts.json',JSON.stringify(layouts,null,2));console.log('All six candidate layouts preserve essentials and connected circulation.');
