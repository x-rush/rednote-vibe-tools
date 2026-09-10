// Ergonomic limits are project budgets, not evidence of musical accuracy.
export function auditGestures(notes,limits){
 const ordered=[...notes].sort((a,b)=>a.time-b.time),errors=[];
 const laneCounts=[0,0,0,0];let switches=0,repeated=1,alternating=1,maxRepeated=1,maxAlternating=1;
 for(let i=0;i<ordered.length;i++){
  const n=ordered[i];laneCounts[n.lane]++;
  if(!i)continue;
  const prev=ordered[i-1],gap=n.time-prev.time,sameLane=n.lane===prev.lane,sameHand=(n.lane<2)===(prev.lane<2);
  if(!sameHand)switches++;
  const continuous=gap<limits.continuousRunBreakSeconds-1e-6;
  repeated=continuous&&sameLane?repeated+1:1;
  alternating=continuous&&!sameHand?alternating+1:1;
  maxRepeated=Math.max(maxRepeated,repeated);maxAlternating=Math.max(maxAlternating,alternating);
  if(sameHand&&gap<limits.fastAlternationBelowSeconds-1e-6)errors.push(`Fast same-hand transition: ${prev.id} -> ${n.id}`);
  if(sameLane&&gap<limits.sameLaneRepeatMinimumSeconds-1e-6)errors.push(`Fast repeat: ${prev.id} -> ${n.id}`);
  if(repeated>limits.maxContinuousSameLane)errors.push(`Repeated lane run: ${n.id}`);
  if(alternating>limits.maxContinuousAlternation)errors.push(`Unbroken alternation: ${n.id}`);
 }
 return {notes:ordered.length,switches,transitions:Math.max(0,ordered.length-1),laneCounts,maxRepeated,maxAlternating,errors};
}
