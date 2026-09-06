import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
for(const folder of ['src','scripts','tests'])for(const file of await readdir(folder))if(/\.(m?js)$/.test(file))execFileSync(process.execPath,['--check',`${folder}/${file}`]);
const content=JSON.parse(await readFile('src/content/content.json','utf8'));
if(new Set(content.flavors.map(x=>x.id)).size!==content.flavors.length)throw Error('Duplicate flavor ids');
for(const file of ['app.js','scene.js'])if(/https?:\/\//.test(await readFile(`src/${file}`,'utf8')))throw Error('Runtime remote URL');
console.log('Syntax, content and local runtime checks passed.');
