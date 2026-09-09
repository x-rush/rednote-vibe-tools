import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {RhythmEngine,validateChart} from '../src/engine.mjs';
import {createHash} from 'node:crypto';
const C=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url)));const rules=C.rules;
const note=(id,time,lane,duration=0)=>({id,time,lane,duration});
test('whole-chart review preserves approved calls, holds, lanes and unmoved notes',()=>{
 const review=JSON.parse(readFileSync(new URL('../design/all-onsets-review.json',import.meta.url)));
 const reviewed=C.chartPlan.verseRefactor.baselineNotes;const changed=new Set(review.changes.map(n=>n.id));
 assert.equal(reviewed.length,review.baselineNotes.length);
 for(const before of review.baselineNotes){const after=reviewed.find(n=>n.id===before.id);assert.ok(after);assert.equal(after.lane,before.lane);assert.equal(after.duration,before.duration);if(!changed.has(before.id))assert.deepEqual(after,before);else{assert.equal(after.source,'vocal');assert.equal(after.duration,0);assert.ok(before.time-after.time>=.04&&before.time-after.time<=.16);}}
 for(const id of C.chartPlan.onsetReview.approvedCalloutsLocked)assert.ok(!changed.has(id));
});
test('both callouts have two playable taps at the reviewed vocal attacks',()=>{
 const first=C.notes.filter(n=>n.time>=48.48&&n.time<49),second=C.notes.filter(n=>n.time>=50.48&&n.time<51);
 assert.equal(first.length,2);assert.equal(second.length,2);
 assert.deepEqual(first.map(n=>n.lane),second.map(n=>n.lane));
 const e=new RhythmEngine([...first,...second],rules);
 [48.52,48.76,50.53,50.76].forEach((t,i)=>{const n=[...first,...second][i];assert.ok(Math.abs(n.time-t)<.04);e.update(t);e.hit(n.lane,t);e.release(n.lane,t+.04);});
 assert.equal(e.counts.perfect,4);assert.equal(e.counts.miss,0);
});
test('historical vocal evidence belongs to this recording; practice selects the current chart',()=>{
 const a=JSON.parse(readFileSync(new URL('../design/vocal-chart-report.json',import.meta.url)));
 assert.equal(createHash('sha256').update(readFileSync(new URL('../public/'+C.track.src,import.meta.url))).digest('hex'),a.audioSha256);
 for(const n of C.chartPlan.flowRevision.baselineNotes.filter(n=>n.source!=='drum'))assert.ok(a.vocalEvidence.some(e=>Math.abs(e.time-n.time)<.001&&e.amplitude>.008),`missing isolated vocal evidence: ${n.id}`);
 assert.ok(C.notes.filter(n=>n.time>32.7&&n.time<64.7).every(n=>n.source==='vocal'));
 assert.deepEqual(C.practiceNotes,C.notes.filter(n=>n.time>=C.practiceRange.start&&n.time+n.duration<C.practiceRange.end));
 assert.equal(C.practiceRange.end-C.practiceRange.start,20);
});
test('real chart has legal time, lanes and no impossible same-lane overlap',()=>{assert.deepEqual(validateChart(C.notes,C.track.duration),[]);assert.ok(C.notes.length>100);assert.equal(C.track.bpm,120);assert.ok(C.track.duration>98);});
test('20-second tutorial contains valid single taps and paired holds',()=>{assert.deepEqual(validateChart(C.practiceNotes,C.practiceRange.end),[]);assert.ok(C.practiceNotes.some(n=>!n.duration));const holds=C.practiceNotes.filter(n=>n.duration);assert.ok(holds.some(n=>holds.some(p=>p.id!==n.id&&p.time===n.time)));});
test('early camping does not hit and late replay cannot score twice',()=>{const e=new RhythmEngine([note('a',1,0)],rules);assert.equal(e.hit(0,0),null);assert.equal(e.score,0);e.hit(0,1);e.hit(0,1.01);assert.equal(e.score,100);assert.equal(e.combo,1);});
test('timing windows distinguish perfect, good and miss',()=>{const e=new RhythmEngine([note('a',1,0),note('b',2,0),note('c',3,0)],rules);e.hit(0,1.05);e.hit(0,2.13);e.update(3.2);assert.deepEqual(e.counts,{perfect:1,good:1,miss:1});assert.equal(e.score,160);assert.equal(e.combo,0);assert.equal(e.maxCombo,2);});
test('hold scores by elapsed audio time regardless of frame frequency and stops at tail',()=>{const run=steps=>{const e=new RhythmEngine([note('a',1,0,2)],rules);e.hit(0,1);for(const t of steps)e.update(t);e.update(50);return e;};const a=run([1.5,2,3]),b=run(Array.from({length:120},(_,i)=>1+i/60));assert.ok(Math.abs(a.score-b.score)<1e-8);assert.equal(a.score,250);assert.equal(a.accuracy,100);});
test('early hold head earns no sustain before scheduled head',()=>{const e=new RhythmEngine([note('a',1,0,2)],rules);e.hit(0,.95);e.update(.98);assert.equal(e.score,100);e.update(1.5);assert.equal(e.score,125);});
test('release breaks sustain permanently, keeps already earned points',()=>{const e=new RhythmEngine([note('a',1,0,2)],rules);e.hit(0,1);e.release(0,1.5);assert.equal(e.score,125);e.hit(0,2);e.update(8);assert.equal(e.score,125);assert.equal(e.notes[0].status,'broken');});
test('two simultaneous holds are independent, both completed get one pair bonus',()=>{const e=new RhythmEngine([note('a',1,1,2),note('b',1,2,2)],rules);e.hit(1,1);e.hit(2,1);e.update(3);assert.equal(e.score,600);e.update(4);assert.equal(e.score,600);assert.equal(e.maxScore,600);assert.equal(e.combo,2);});
test('one released finger does not stop the other or earn double bonus',()=>{const e=new RhythmEngine([note('a',1,1,2),note('b',1,2,2)],rules);e.hit(1,1);e.hit(2,1);e.release(1,2);e.update(3);assert.equal(e.score,400);assert.equal(e.doubleAwarded.size,0);});
test('paused sustain requires re-press and cannot score while suspended',()=>{const e=new RhythmEngine([note('a',1,1,3)],rules);e.hit(1,1);e.update(2);const n=e.notes[0];n.status='suspended';n.resumeDeadline=2.35;e.update(2.2);assert.equal(e.score,150);e.hit(1,2.2);e.update(4);assert.equal(Math.round(e.score),290);});
test('not re-pressing after pause breaks hold',()=>{const e=new RhythmEngine([note('a',1,1,3)],rules);e.hit(1,1);e.update(2);e.notes[0].status='suspended';e.notes[0].resumeDeadline=2.35;e.update(2.36);e.update(5);assert.equal(e.notes[0].status,'broken');assert.equal(e.score,150);});
test('perfect simulation of full song yields 100%, with all holds and pairs',()=>{const e=new RhythmEngine(C.notes,rules);const events=C.notes.flatMap(n=>[{t:n.time,kind:'hit',n},...(n.duration?[{t:n.time+n.duration,kind:'end',n}]:[])]).sort((a,b)=>a.t-b.t);for(const ev of events){e.update(ev.t);if(ev.kind==='hit')e.hit(ev.n.lane,ev.t);}e.update(C.track.duration);assert.equal(e.counts.miss,0);assert.ok(Math.abs(e.accuracy-100)<.00001);assert.equal(e.notes.filter(n=>n.status==='done').length,C.notes.length);});
test('all 12 character exits leave a gap after sustained notes',()=>{for(const p of C.phrases){for(const n of C.notes.filter(n=>n.time>=p.start&&n.time<p.end))assert.ok(n.time+n.duration<=p.end,`${n.id} crosses exit`);}});
test('historical character gaps remain recorded for regression comparison',()=>{const ps=C.playability.baselinePhrases;for(let i=1;i<ps.length;i++)assert.ok(ps[i].start-ps[i-1].end>=.2);});
test('pausing accrues to the pause instant and never creates early sustain points',()=>{const e=new RhythmEngine([note('a',1,0,2)],rules);e.hit(0,.95);e.suspend(.98);assert.equal(e.score,100);assert.equal(e.notes[0].last,1);e.notes[0].resumeDeadline=1.33;e.hit(0,.99);e.update(1.5);e.suspend(1.51);assert.ok(Math.abs(e.score-125.5)<1e-8);});
test('three or four simultaneous holds have an attainable maximum with one group bonus',()=>{for(const count of [3,4]){const e=new RhythmEngine(Array.from({length:count},(_,i)=>note(String(i),1,i,2)),rules);for(let i=0;i<count;i++)e.hit(i,1);e.update(3);assert.equal(e.score,e.maxScore);assert.equal(e.accuracy,100);assert.equal(e.doubleAwarded.size,1);}});
test('reconnecting a paused hold emits resume without counting another hit',()=>{const e=new RhythmEngine([note('a',1,0,2)],rules);e.hit(0,1);e.suspend(1.2);e.drain();e.notes[0].resumeDeadline=1.55;e.hit(0,1.21);assert.equal(e.drain()[0].type,'resume');assert.deepEqual(e.counts,{perfect:1,good:0,miss:0});assert.equal(e.combo,1);});
test('Rap revision has playable sentence groups and every note belongs to a character phrase',()=>{const rap=C.notes.filter(n=>n.time>=C.rapPracticeRange.start&&n.time<C.rapPracticeRange.end);assert.equal(C.rapPracticeRange.end-C.rapPracticeRange.start,32);assert.ok(rap.length>0);assert.ok(rap.every(n=>n.source==='vocal'&&(n.duration===0||C.playability.holdCandidates.some(h=>h.id===n.id))));for(const n of C.notes)assert.equal(C.phrases.filter(p=>p.start<=n.time&&n.time<p.end).length,1,`unsettled note ${n.id}`);for(let i=1;i<rap.length;i++)assert.ok(rap[i].time-rap[i-1].time>=.125-1e-6);});
