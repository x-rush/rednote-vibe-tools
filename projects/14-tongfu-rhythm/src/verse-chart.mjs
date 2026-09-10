// Compile authored musical phrases. Audio/ASR analysis never creates notes here.
export function compileVerse(flow) {
  const result=[];
  if (!Number.isFinite(flow.bpm)||flow.bpm<=0) throw Error('Invalid verse tempo');
  const ids=new Set();
  for (const phrase of flow.phrases) {
    if (ids.has(phrase.id)) throw Error('Duplicate phrase');
    ids.add(phrase.id);
    if (!Number.isFinite(phrase.start)||!phrase.events.length) throw Error('Invalid phrase');
    let previous=-Infinity;
    phrase.events.forEach((event,index)=>{
      if (!Number.isFinite(event.beat)||event.beat<0||event.beat<=previous) throw Error('Unordered musical positions');
      previous=event.beat;
      if (!Number.isInteger(event.lane)||event.lane<0||event.lane>3) throw Error('Invalid verse lane');
      if (event.lockedId) {
        const locked=flow.lockedNotes.find(n=>n.id===event.lockedId);
        if (!locked) throw Error('Missing approved note');
        result.push({...locked});
      } else {
        result.push({id:event.id||`v8-${phrase.id}-${index}`,time:Number((phrase.start+event.beat*60/flow.bpm).toFixed(4)),lane:event.lane,duration:event.duration||0,source:'vocal',phraseId:phrase.id,...(event.label?{label:event.label}:{})});
      }
    });
  }
  result.sort((a,b)=>a.time-b.time||a.lane-b.lane);
  if(new Set(result.map(n=>n.id)).size!==result.length)throw Error('Duplicate verse note');
  for(const n of result)if(n.time<flow.start||n.time>=flow.end)throw Error('Verse note outside range');
  return result;
}
