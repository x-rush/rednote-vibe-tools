import {validateChart} from './engine.mjs';
export function checkedNotes(input,duration){
 if(!Array.isArray(input)||input.length===0||input.length>5000)throw Error('Invalid note count');
 if(input.some(n=>!n||typeof n.time!=='number'||typeof n.lane!=='number'||(n.duration!==undefined&&typeof n.duration!=='number')))throw Error('Invalid note fields');
 const notes=input.map((n,i)=>({id:typeof n.id==='string'?n.id:`edit-${i}`,time:n.time,lane:n.lane,duration:n.duration??0,...(typeof n.source==='string'?{source:n.source}:{})}));
 if(notes.some(n=>!Number.isFinite(n.duration)))throw Error('Invalid duration');
 const errors=validateChart(notes,duration);if(errors.length)throw Error([...new Set(errors)].join(', '));
 return notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);
}
export function parseChart(text,track){
 if(text.length>2_000_000)throw Error('File too large');
 if(text.trimStart().startsWith('{')||text.trimStart().startsWith('[')){
  const obj=JSON.parse(text);
  if(obj.audioSha256&&obj.audioSha256!==track.audioSha256)throw Error('Audio fingerprint mismatch');
  return checkedNotes(Array.isArray(obj)?obj:obj.notes,track.duration);
 }
 if(!/^osu file format v\d+/m.test(text))throw Error('Unknown chart format');
 const sections={};let section='';for(const row of text.split(/\r?\n/)){const line=row.trim();if(/^\[.*\]$/.test(line)){section=line.slice(1,-1);sections[section]=[];}else if(line&&!line.startsWith('//'))sections[section]?.push(line);}
 if(!sections.General?.some(s=>/^Mode\s*:\s*3$/.test(s))||!sections.Difficulty?.some(s=>/^CircleSize\s*:\s*4$/.test(s)))throw Error('Only four-key mania charts are supported');
 const notes=(sections.HitObjects||[]).map((row,i)=>{const [x,,ms,type,,params]=row.split(',');const flags=Number(type);if(!(flags&1)&&!(flags&128))throw Error('Unsupported object');return {id:`osu-${i}`,time:Number(ms)/1000,lane:Math.min(3,Math.floor(Number(x)/128)),duration:flags&128?(Number(params.split(':')[0])-Number(ms))/1000:0};});
 return checkedNotes(notes,track.duration);
}
export function exportOsu(notes,track,timing){
 checkedNotes(notes,track.duration);
 const header=`osu file format v14\n\n[General]\nAudioFilename: ${track.src.split('/').at(-1)}\nMode: 3\n\n[Metadata]\nTitle: ${track.title}\nArtist: ${track.artist}\nCreator: Tongfu\nVersion: 4K\n\n[Difficulty]\nCircleSize: 4\nOverallDifficulty: 5\nSliderMultiplier: 1\n\n[TimingPoints]\n`;
 return header+timing.map(t=>`${Math.round(t.time*1000)},${60000/t.bpm},4,2,0,50,1,0`).join('\n')+'\n\n[HitObjects]\n'+notes.map(n=>`${64+n.lane*128},192,${Math.round(n.time*1000)},${n.duration?128:1},0,${n.duration?Math.round((n.time+n.duration)*1000)+':':''}0:0:0:0:`).join('\n')+'\n';
}
