import {cp,mkdir,readFile,writeFile,access} from 'node:fs/promises';
const dir='.cache/environment-preview';await mkdir(dir,{recursive:true});await cp('dist',dir,{recursive:true});let html=await readFile(dir+'/index.html','utf8');
for(const file of ['environment-check.js','environment-mode.js','full-cast-check.js','interaction-check.js','environment-live.js']){try{await access('qa/'+file);}catch{continue;}await cp('qa/'+file,dir+'/'+file);if(file==='environment-mode.js')html=html.replace('<head>','<head><script src="./'+file+'"></script>');else html=html.replace('</body>','<script src="./'+file+'"></script></body>');}
await writeFile(dir+'/index.html',html);console.log('Isolated environment preview ready. No QA scripts in dist.');
