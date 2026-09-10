import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileVerse} from '../src/verse-chart.mjs';
import {RhythmEngine} from '../src/engine.mjs';
const c=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url)));
const flow=c.verseFlow,rap=c.notes.filter(n=>n.time>=flow.start&&n.time<flow.end);
test('historical v9 concentration changed only lanes and preserved its hand sequence',()=>{
 const historical=c.chartPlan.gestureRevision.baselineNotes;
 const before=c.chartPlan.laneRevision.baselineNotes;
 assert.equal(historical.length,before.length);
 for(let i=0;i<before.length;i++){
  const {lane:oldLane,...oldNote}=before[i],{lane,...note}=historical[i];
  assert.deepEqual(note,oldNote);
  if(note.time<flow.start||note.time>=flow.end)assert.equal(lane,oldLane);
  else {
   assert.equal(lane<2,oldLane<2);
   if(!flow.lockedNotes.some(n=>n.id===note.id))assert.ok([1,2].includes(lane));
  }
 }
 assert.deepEqual(historical.filter(n=>['greeting','where'].includes(n.phraseId)).map(n=>n.lane),[1,2,1,2,1,2,1,2]);
});
test('compiled verse is the single source for full game and comparison; other music and approved calls stay unchanged',()=>{
 assert.deepEqual(rap,compileVerse(flow));
 const outside=ns=>ns.filter(n=>n.time<flow.start||n.time>=flow.end);
 assert.deepEqual(outside(c.notes).filter(n=>!c.playability.extraNotes.some(e=>e.id===n.id)),outside(c.chartPlan.flowRevision.baselineNotes));
 for(const n of flow.lockedNotes)assert.deepEqual(rap.find(a=>a.id===n.id),n);
 assert.deepEqual(c.verseLab.versions[1].notes,rap.filter(n=>n.time<c.verseLab.start+c.verseLab.duration).map(n=>({time:Number((n.time-c.verseLab.start).toFixed(4)),lane:n.lane,...(n.label?{label:n.label}:{})})));
});
test('repeated syllables have even rhythm and greetings contain all eight distinct attacks',()=>{
 for(const id of ['qing','enyuan']){
  const ns=rap.filter(n=>n.phraseId===id);assert.equal(ns.length,4);
  assert.deepEqual(ns.map(n=>n.lane),[1,1,2,2]);
  for(let i=1;i<ns.length;i++)assert.ok(Math.abs(ns[i].time-ns[i-1].time-.25)<1e-6);
 }
 assert.equal(rap.filter(n=>['greeting','where'].includes(n.phraseId)).map(n=>n.label).join(''),'好久不见你去何处');
 const groups=['smile','cry'].map(id=>rap.filter(n=>n.phraseId===id));
 assert.deepEqual(groups[0].map(n=>n.time-groups[0][0].time),groups[1].map(n=>n.time-groups[1][0].time));
});
test('fast verse remains playable with early and late inputs, without enlarging judgment windows',()=>{
 for(const offset of [-.06,.06]){
  const engine=new RhythmEngine(rap,c.rules);
  for(const n of rap){engine.update(n.time+offset);engine.hit(n.lane,n.time+offset);engine.release(n.lane,n.time+offset+.03);}
  engine.update(flow.end+1);assert.equal(engine.counts.perfect,rap.length);assert.equal(engine.counts.miss,0);
 }
 // A lane may have overlapping good windows; the fast stream must not require
 // two simultaneous contacts from the same thumb at opposite keys.
 for(let i=1;i<rap.length;i++)if(rap[i].time-rap[i-1].time<.18)assert.notEqual(rap[i].lane<2,rap[i-1].lane<2);
});
test('compiler rejects bad musical positions, missing locks and invalid lanes',()=>{
 for(const mutate of [f=>f.phrases[0].events[1].beat=0,f=>f.phrases[0].events[0].lane=9,f=>f.phrases[0].events[0].lockedId='missing',f=>f.bpm=0]){
  const bad=structuredClone(flow);mutate(bad);assert.throws(()=>compileVerse(bad));
 }
});
