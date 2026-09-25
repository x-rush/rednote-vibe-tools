import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
for(const [id,a] of Object.entries(c.audio.files)){
  const dest=join(root,a.file);await mkdir(dirname(dest),{recursive:true});
  const filters=`${a.gain},afade=t=in:d=${a.fade},afade=t=out:st=${a.seconds-a.fade}:d=${a.fade}`;
  const result=spawnSync('ffmpeg',['-v','error','-y','-ss',String(a.start),'-i',join(root,a.source),'-t',String(a.seconds),'-af',filters,'-ac','1','-ar',String(a.sampleRate),'-codec:a','libmp3lame','-b:a',String(a.bitrate),dest],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr||String(result.error));
  const bytes=(await readFile(dest)).length;if(bytes>102400)throw Error('Audio exceeds 100 KiB preparation budget: '+id);
  console.log(id,bytes,'bytes');
}
