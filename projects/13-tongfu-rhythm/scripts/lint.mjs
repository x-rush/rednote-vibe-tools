import {readdir,readFile,access} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
let fail=false;for(const dir of ['src','scripts','tests'])for(const file of await readdir(dir)){if(file.endsWith('.mjs')){const r=spawnSync(process.execPath,['--check',`${dir}/${file}`],{encoding:'utf8'});if(r.status){console.error(r.stderr);fail=true;}}}
const content=JSON.parse(await readFile('src/content/content.json'));if(!content.notes.length)fail=true;const app=await readFile('src/app.mjs','utf8');if(/https?:\/\//.test(app))throw Error('Runtime remote endpoint prohibited');if(fail)process.exit(1);console.log('Syntax, content and offline-runtime checks passed');
for(const asset of [content.track.src,content.art.background,...content.cast.flatMap(c=>[c.art,c.homeMask]),...Object.values(content.stems||{})])await access(`public/${asset}`);
if(/[\p{Script=Han}]/u.test(app))throw Error('Business text must live in content.json');
