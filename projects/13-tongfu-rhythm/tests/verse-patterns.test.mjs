import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {RhythmEngine,validateChart} from '../src/engine.mjs';
const C=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url)));
const n=(id,time,duration=0)=>({id,time,lane:0,duration});
test('short isolated repeats do not permit fast triples, accidental doubles or hold overlaps',()=>{
 assert.deepEqual(validateChart([n('a',1),n('b',1.13)],3),[]);
 for(const ns of [[n('a',1),n('b',1.11)],[n('a',1),n('b',1.13),n('c',1.26)],[n('a',1,.1),n('b',1.13)]])assert.ok(validateChart(ns,3).length);
 const e=new RhythmEngine([n('a',1),n('b',1.13)],C.rules);e.hit(0,1);e.release(0,1.05);e.hit(0,1.13);assert.equal(e.counts.perfect,2);assert.equal(e.score,200);
});
test('verse refactor locks approved calls and non-verse notes and only changes declared qing times',()=>{
 for(const old of C.chartPlan.verseRefactor.baselineNotes){const after=C.chartPlan.flowRevision.baselineNotes.find(n=>n.id===old.id);
  if(old.id==='v4-rap-2-2'){assert.equal(after,undefined);continue;}
  assert.ok(after);assert.equal(after.time,old.time);assert.equal(after.duration,old.duration);
  if(old.time<32.7||old.time>=64.7||C.chartPlan.verseRefactor.lockedCallouts.includes(old.id))assert.deepEqual(after,old);
 }
 const groups=C.chartPlan.verseRefactor.groups;assert.deepEqual(groups[0].lanes,groups[1].lanes);assert.deepEqual(groups[7].lanes,[1,1,3,3]);
 const grouped=groups.flatMap(g=>g.notes);assert.equal(new Set(grouped).size,grouped.length);assert.deepEqual([...grouped].sort(),C.chartPlan.flowRevision.baselineNotes.filter(n=>n.time>=32.7&&n.time<64.7).map(n=>n.id).sort());
 assert.deepEqual(validateChart(C.notes,C.track.duration),[]);
});
