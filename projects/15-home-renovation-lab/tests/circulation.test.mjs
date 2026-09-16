import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makePlan,itemFrom,canWalk,validatePlan} from '../src/core.js';
import {blockedDoorItems,doorApproaches,entryPoint,walkingPath} from '../src/circulation.js';
const catalog=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url),'utf8'));
for(const template of catalog.templates)test('walkthrough circulation: '+template.id,()=>{
 const plan=makePlan(template,catalog);assert.equal(blockedDoorItems(plan,catalog).length,0,'template must not block either door face');assert.ok(validatePlan(plan,catalog));
 const source=entryPoint(plan,plan.rooms[0],catalog);assert.ok(source);const destinations=[];
 for(const room of plan.rooms){const destination=entryPoint(plan,room,catalog);assert.ok(destination,'safe landing '+room.name);const path=walkingPath(plan,source,destination,catalog);assert.ok(path,'connected walkthrough route to '+room.name);let previous=source;for(const point of path){assert.ok(canWalk(plan,previous,point,catalog),'path cannot cross furniture or a solid wall');previous=point;}destinations.push({room:room.name,segments:path.length});}
 console.log(JSON.stringify({template:template.id,rooms:plan.rooms.length,furniture:plan.items.length,clearDoorApproaches:doorApproaches(plan).length,destinations}));
});
test('walkthrough routes around an obstacle without changing the saved plan',()=>{
 const plan=makePlan({name:'QA',rooms:[['Room',0,0,5,5,'empty']]},catalog);plan.items=[];plan.openings=[];plan.items.push(itemFrom(catalog.furniture.find(f=>f.id==='sofa'),plan.rooms[0],2.5,2.5));const before=JSON.stringify(plan),start={x:2.5,z:1},end={x:2.5,z:4};assert.equal(canWalk(plan,start,end,catalog),false);const path=walkingPath(plan,start,end,catalog);assert.ok(path&&path.length>1);let previous=start;for(const point of path){assert.ok(canWalk(plan,previous,point,catalog));previous=point;}assert.equal(JSON.stringify(plan),before);
});
test('solid walls are never bypassed by the route planner',()=>{
 const plan=makePlan({name:'QA',rooms:[['A',0,0,4,4,'empty'],['B',4,0,4,4,'empty']]},catalog);plan.items=[];plan.openings=[];assert.equal(walkingPath(plan,{x:2,z:2},{x:6,z:2},catalog),null);
});
