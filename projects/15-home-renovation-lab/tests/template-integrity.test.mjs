import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makePlan,placement,validatePlan,walkable} from '../src/core.js';
import {doorApproaches,blockedDoorItems,entryPoint,walkingPath} from '../src/circulation.js';
const catalog=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8'));
for(const template of catalog.templates)test('essential furniture and usable access: '+template.id,()=>{
 const plan=makePlan(template,catalog);assert.ok(validatePlan(plan,catalog));
 assert.equal(plan.openings.filter(o=>o.type==='door').length,plan.rooms.length-1);
 for(const [index,room]of plan.rooms.entries()){
  const items=plan.items.filter(o=>o.roomId===room.id),counts=new Map();for(const item of items)counts.set(item.catalogId,(counts.get(item.catalogId)||0)+1);
  for(const id of template.requiredItems[index]){assert.ok(counts.get(id)>0,room.name+' missing '+id);counts.set(id,counts.get(id)-1);}
  for(const item of items)assert.ok(placement(plan,item,catalog),room.name+' invalid placement '+item.catalogId);
  const local={...plan,rooms:[room],items},entry=entryPoint(local,room,catalog);assert.ok(entry);
  for(const zone of doorApproaches(plan).filter(z=>z.roomId===room.id))assert.ok(walkingPath(local,entry,zone,catalog),room.name+' disconnected doorway');
  for(const item of items.filter(o=>['wardrobe','kitchen','fridge','vanity','bookcase','desk'].includes(o.catalogId))){const a=item.angle*Math.PI/180,front={x:item.x+Math.sin(a)*(item.d/2+.28),z:item.z+Math.cos(a)*(item.d/2+.28)};assert.ok(walkable(local,front.x,front.z,catalog),item.catalogId+' front blocked');assert.ok(walkingPath(local,entry,front,catalog),item.catalogId+' front unreachable');}
 }
 assert.equal(blockedDoorItems(plan,catalog).length,0);
 const start=entryPoint(plan,plan.rooms[0],catalog);for(const room of plan.rooms)assert.ok(walkingPath(plan,start,entryPoint(plan,room,catalog),catalog));
});
test('previous template revisions remain reproducible for conservative migration',()=>{for(const t of catalog.templates)for(const version of [true,'raw','previous'])assert.ok(validatePlan(makePlan(t,catalog,version),catalog));});
