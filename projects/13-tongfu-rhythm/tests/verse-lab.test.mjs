import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const C=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url))),v=C.verseLab;
test('verse candidate represents the full production phrase and two same-key repeated pairs',()=>{
 const ns=v.previousPatternVersion.notes,group=ns.filter(n=>n.time+v.start>=37.6&&n.time+v.start<38.5);
 assert.equal(group.length,4);assert.deepEqual(group.map(n=>n.lane),[0,0,2,2]);
 assert.deepEqual(ns,C.chartPlan.flowRevision.baselineNotes.filter(n=>n.time>=v.start&&n.time<v.start+v.duration).map(n=>({time:Number((n.time-v.start).toFixed(4)),lane:n.lane})));
 assert.deepEqual(v.versions[0].notes,C.chartPlan.verseRefactor.baselineNotes.filter(n=>n.time>=v.start&&n.time<v.start+v.duration).map(n=>({time:Number((n.time-v.start).toFixed(4)),lane:n.lane})));
 assert.ok(ns.every(n=>n.time>=0&&n.time<v.duration));
});
