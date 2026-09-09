import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {parseChart,exportOsu} from '../src/chart-io.mjs';
const C=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url)));
test('osu export/import preserves every lane and hold to millisecond precision',()=>{
 const back=parseChart(exportOsu(C.notes,C.track,C.timingPoints),C.track);assert.equal(back.length,C.notes.length);
 for(let i=0;i<back.length;i++){assert.equal(back[i].lane,C.notes[i].lane);assert.ok(Math.abs(back[i].time-C.notes[i].time)<.001);assert.ok(Math.abs(back[i].duration-C.notes[i].duration)<.002);}
});
test('reject wrong recording and impossible/invalid imported notes',()=>{
 assert.throws(()=>parseChart(JSON.stringify({audioSha256:'wrong',notes:C.notes}),C.track));
 for(const notes of [[{time:2,lane:1,duration:NaN}],[{time:2,lane:8,duration:0}],[{time:2,lane:1,duration:3},{time:3,lane:1,duration:0}]])assert.throws(()=>parseChart(JSON.stringify(notes),C.track));
});
