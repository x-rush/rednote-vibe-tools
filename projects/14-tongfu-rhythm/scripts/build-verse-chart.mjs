import {readFile,writeFile} from 'node:fs/promises';
import {compileVerse} from '../src/verse-chart.mjs';
import {validateChart} from '../src/engine.mjs';
import {auditGestures} from '../src/gesture-audit.mjs';
const path='src/content/content.json',c=JSON.parse(await readFile(path,'utf8'));
const flow=c.verseFlow,verse=compileVerse(flow);
const outside=c.chartPlan.flowRevision.baselineNotes.filter(n=>n.time<flow.start||n.time>=flow.end);
const notes=[...outside,...verse,...(c.playability?.extraNotes||[])].sort((a,b)=>a.time-b.time||a.lane-b.lane);
const errors=validateChart(notes,c.track.duration);
const gestureAudit=flow.gestureDesign?auditGestures(verse,flow.gestureDesign.constraints):null;
if(gestureAudit)errors.push(...gestureAudit.errors);
// Character intervals cover the full song. Never reject a musical note to reserve
// empty time for an animation; settlement waits for its own notes independently.
for(let i=1;i<c.phrases.length;i++)if(Math.abs(c.phrases[i-1].end-c.phrases[i].start)>1e-6)errors.push('Character score intervals must be contiguous');
if(errors.length)throw Error(errors.join('\n'));
c.notes=notes;
c.practiceNotes=notes.filter(n=>n.time>=c.practiceRange.start&&n.time+n.duration<c.practiceRange.end);
// The small comparison page and the full game share the compiled phrase timings.
c.verseLab.versions[1]={label:c.verseLab.versions[1].label,notes:verse.filter(n=>n.time<c.verseLab.start+c.verseLab.duration).map(n=>({time:Number((n.time-c.verseLab.start).toFixed(4)),lane:n.lane,...(n.label?{label:n.label}:{})}))};
await writeFile(path,JSON.stringify(c,null,2)+'\n');
await writeFile('design/verse-flow-report.json',JSON.stringify({revision:flow.revision,total:notes.length,verseNotes:verse.length,phrases:flow.phrases.length,range:[flow.start,flow.end],minInterval:Math.min(...verse.slice(1).map((n,i)=>n.time-verse[i].time)),humanListeningApproved:false,method:'Authored phrase rhythm without waveform snapping; explicit continuity fills, short hold tails and two tap chords.',originalOutsideRapNotesPreserved:true,extraOutsideRapNotes:(c.playability?.extraNotes||[]).length},null,2)+'\n');
console.log({total:notes.length,verse:verse.length,phrases:flow.phrases.length});
if(gestureAudit){
 const before=c.chartPlan.gestureRevision.baselineNotes.filter(n=>n.time>=flow.start&&n.time<flow.end);
 await writeFile('design/gesture-review.json',JSON.stringify({revision:flow.revision,before:auditGestures(before,flow.gestureDesign.constraints),after:gestureAudit,humanListeningApproved:false},null,2)+'\n');
}
