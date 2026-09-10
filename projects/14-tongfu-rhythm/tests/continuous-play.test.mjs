import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {RhythmEngine,StageTimeline,validateChart} from '../src/engine.mjs';
const c=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url)));
const n=(id,time,lane,duration=0)=>({id,time,lane,duration});
test('all score intervals are contiguous and previously forbidden transitions now contain playable notes',()=>{
 for(let i=1;i<c.phrases.length;i++)assert.equal(c.phrases[i-1].end,c.phrases[i].start);
 assert.equal(c.phrases[0].start,0);assert.equal(c.phrases.at(-1).end,c.track.duration);
 assert.deepEqual(c.verseFlow.omittedForCharacterRests,[]);
 for(const [a,b] of [[47.3927,47.6764],[55.5192,56.0474],[62.9823,63.3109]])assert.ok(c.notes.some(n=>n.time>a&&n.time<b));
 for(const [a,b] of [[47.17,47.795],[53.67,54.295],[55.42,56.17],[62.42,63.42]]){
  const ns=c.notes.filter(n=>n.time>=a-1e-6&&n.time<=b+1e-6);assert.ok(ns.length>2);
  for(let i=1;i<ns.length;i++)assert.ok(ns[i].time-ns[i-1].time<=.375+1e-6);
 }
 assert.deepEqual(validateChart(c.notes,c.track.duration),[]);
});
test('a late hit and crossing hold settle independently while the next character notes remain playable',()=>{
 const ns=[n('hold',.8,0,.5),n('next',1.05,2),n('later',1.3,3)];
 const engine=new RhythmEngine(ns,c.rules),stage=new StageTimeline([{start:0,end:1},{start:1,end:2}],.24);
 stage.update(engine,0,0);engine.hit(0,.8);engine.update(1.1);stage.update(engine,1.1,1.1);
 assert.equal(stage.current,0);assert.equal(stage.settled.has(0),false);
 engine.hit(2,1.1);engine.update(1.3);engine.hit(3,1.3);stage.update(engine,1.3,1.3);
 assert.equal(stage.frozen,1);assert.equal(stage.current,0);
 stage.update(engine,1.55,1.55);assert.equal(stage.current,1);assert.equal(engine.counts.perfect,3);
 const late=new RhythmEngine([n('tail',.98,0)],c.rules),s=new StageTimeline([{start:0,end:1},{start:1,end:2}],.24);
 s.update(late,0,0);late.update(1.05);s.update(late,1.05,1.05);assert.equal(s.settled.has(0),false);
 late.hit(0,1.05);s.update(late,1.06,1.06);assert.equal(s.frozen,1);
});
test('tap chord scores each contact and gives one completion signal only after both contacts',()=>{
 const engine=new RhythmEngine([n('left',1,0),n('right',1,2)],c.rules);
 engine.hit(0,1);assert.equal(engine.score,100);assert.equal(engine.drain().some(e=>e.type==='double'),false);
 engine.hit(2,1.025);assert.equal(engine.score,200);assert.equal(engine.drain().filter(e=>e.type==='double'&&e.tap).length,1);
 engine.hit(2,1.03);assert.equal(engine.drain().length,0);assert.equal(engine.maxScore,200);
});
test('callout holds finish and early release loses sustain; no following note requires an occupied thumb',()=>{
 const heads=c.playability.holdCandidates.map(h=>c.notes.find(n=>n.id===h.id));assert.equal(heads.length,2);
 for(const head of heads){
  assert.ok(head.duration>=.3);
  const engine=new RhythmEngine([head],c.rules);engine.hit(head.lane,head.time);engine.update(head.time+head.duration);assert.equal(engine.accuracy,100);
  const broken=new RhythmEngine([head],c.rules);broken.hit(head.lane,head.time);broken.release(head.lane,head.time+.1);assert.ok(broken.accuracy<100);
 }
 for(const hold of c.notes.filter(n=>n.duration))for(const tap of c.notes.filter(n=>!n.duration))if(tap.time>hold.time&&tap.time<hold.time+hold.duration)assert.notEqual(tap.lane<2,hold.lane<2);
});
