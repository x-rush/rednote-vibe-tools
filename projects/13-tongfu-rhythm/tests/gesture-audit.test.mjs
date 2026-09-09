import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {auditGestures} from '../src/gesture-audit.mjs';
const c=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url))),flow=c.verseFlow;
const rap=ns=>ns.filter(n=>n.time>=flow.start&&n.time<flow.end),limits=flow.gestureDesign.constraints;
test('musical gesture revision keeps all timing and approved sounds while avoiding fast jacks and long alternation',()=>{
 const reviewed=c.playability.baselineNotes;
 const before=c.chartPlan.gestureRevision.baselineNotes;assert.equal(before.length,reviewed.length);
 before.forEach((n,i)=>{const {lane,...a}=n,{lane:afterLane,...b}=reviewed[i];assert.deepEqual(a,b);if(n.time<flow.start||n.time>=flow.end)assert.equal(afterLane,lane);});
 const result=auditGestures(rap(reviewed),limits);assert.deepEqual(result.errors,[]);
 assert.ok(result.laneCounts.every(n=>n>0));
 assert.ok(result.switches<auditGestures(rap(before),limits).switches);
 const shape=id=>rap(reviewed).filter(n=>n.phraseId===id).map(n=>n.lane);
 assert.deepEqual(shape('smile'),shape('cry'));assert.deepEqual(shape('response-a'),shape('response-b'));
 assert.notDeepEqual(shape('smile'),shape('response-a'));
});
test('gesture audit detects cross-phrase fast repeats and recognises a real recovery gap',()=>{
 const ns=(times,lanes)=>times.map((time,i)=>({id:String(i),time,lane:lanes[i],duration:0}));
 assert.ok(auditGestures(ns([0,.125],[0,1]),limits).errors.some(e=>e.includes('same-hand')));
 assert.ok(auditGestures(ns([0,.25,.5],[1,1,1]),limits).errors.some(e=>e.includes('Repeated lane')));
 assert.deepEqual(auditGestures(ns([0,.25,.625],[1,1,1]),limits).errors,[]);
 assert.ok(auditGestures(ns(Array.from({length:10},(_,i)=>i*.25),Array.from({length:10},(_,i)=>i%2?2:1)),limits).errors.some(e=>e.includes('alternation')));
});
