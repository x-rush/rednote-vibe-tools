import {readFile,writeFile} from 'node:fs/promises';
import {parseChart} from '../src/chart-io.mjs';
import {validateChart} from '../src/engine.mjs';
const root=new URL('../',import.meta.url),path=new URL('src/content/content.json',root);
const content=JSON.parse(await readFile(path));
// Automatic onset extraction is no longer allowed to overwrite the published map.
// An explicit edited JSON / .osu file can be imported; otherwise validate only.
if(process.argv[2]){const text=await readFile(process.argv[2],'utf8');content.notes=parseChart(text,content.track);content.practiceNotes=content.notes.filter(n=>n.time>=content.practiceRange.start&&n.time+n.duration<content.practiceRange.end);content.track.chartRevision++;content.track.chartStatus=content.studio.imported;await writeFile(path,JSON.stringify(content,null,2)+'\n');}
const errors=validateChart(content.notes,content.track.duration);if(errors.length)throw Error(errors.join(', '));
console.log(`${content.notes.length} published notes validated; no automatic template generation.`);
