// Development-only audio preparation; never shipped in the static ZIP.
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const content=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
// Cuts lie inside measured silent intervals, retaining a short margin around speech.
const ranges={basketball:[[0,2.76],[2.76,5.46],[5.46,6.432]],dinner:[[0,2.55],[2.55,6.16],[6.16,8.256]],work:[[0,6.65],[6.65,12.75],[12.75,16.896]],'miss-you':[[0,5.28],[6.25,12.288]],downstairs:[[0,4.05],[4.05,8.01],[8.01,12.264]],company:[[0,3.6],[3.6,6.024]]};
const report=[];
for(const script of content.callScripts){const source=join(root,'assets/audio/doubao-source',script.id+'.mp3');
  const probe=JSON.parse(spawnSync('ffprobe',['-v','quiet','-show_format','-of','json',source],{encoding:'utf8'}).stdout);
  for(const [i,item] of script.segments.entries()){
    let [start,end]=ranges[script.id][i];if(i===script.segments.length-1)end=Number(probe.format.duration);
    const out=join(root,'assets/audio',item.file);
    const result=spawnSync('ffmpeg',['-y','-v','error','-i',source,'-ss',String(start),'-t',String(end-start),'-map_metadata','0','-codec:a','libmp3lame','-b:a','64k','-ar','24000','-ac','1',out],{encoding:'utf8'});
    if(result.status)throw Error(result.stderr);
    const bytes=(await stat(out)).size;if(bytes>100*1024)throw Error('Audio exceeds review threshold: '+item.file);
    const outputProbe=JSON.parse(spawnSync('ffprobe',['-v','quiet','-show_format','-of','json',out],{encoding:'utf8'}).stdout);
    if(outputProbe.format.tags.AIGC!==probe.format.tags.AIGC)throw Error('Source metadata lost');
    report.push({file:item.file,source:script.id+'.mp3',text:item.text,start,end,bytes,duration:Number(outputProbe.format.duration),pause:item.pause});
  }
}
await writeFile(join(root,'qa/output/audio-cuts.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({segments:report.length,bytes:report.reduce((s,x)=>s+x.bytes,0),maxBytes:Math.max(...report.map(x=>x.bytes))}));
