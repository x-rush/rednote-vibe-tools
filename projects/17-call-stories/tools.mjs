import {readFile,writeFile,mkdir,copyFile,readdir,rm} from 'node:fs/promises';
import {join,resolve,extname,sep} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
const sourceFiles=['index.html','src/app.mjs','src/model.mjs','src/call-player.mjs','src/export-image.mjs','src/audio-bank.mjs','src/style.css','src/content/content.json'];
async function build(){
  const out=resolve(root,'dist');
  if(out!==join(root,'dist')||!out.startsWith(root+sep))throw Error('Invalid build directory');
  await rm(out,{recursive:true,force:true});
  await mkdir(join(out,'src'),{recursive:true});await copyFile(join(root,'index.html'),join(out,'index.html'));await copyFile(join(root,'src/style.css'),join(out,'src/style.css'));
  const audioFiles=(await readdir(join(root,'assets/audio'))).filter(f=>/^[a-z0-9-]+\.mp3$/i.test(f));
  const content=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));content.audioFiles=audioFiles;
  const audioData={};for(const file of audioFiles){const bytes=await readFile(join(root,'assets/audio',file));if(bytes.length>1024*1024)throw Error('Embedded audio exceeds 1 MiB: '+file);audioData[file]=bytes.toString('base64');}
  const modules=resolve(root,'../../node_modules/.pnpm');const compiler=(await readdir(modules)).find(name=>name.startsWith('rolldown@'));
  if(!compiler)throw Error('Workspace rolldown build tool unavailable');
  const {rolldown}=await import(pathToFileURL(join(modules,compiler,'node_modules/rolldown/dist/index.mjs')).href);
  const bundle=await rolldown({input:join(root,'src/app.mjs'),transform:{target:'chrome61'},plugins:[{name:'local-content',resolveId(id){if(id==='embedded-audio')return '\0embedded-audio';},load(id){if(id==='\0embedded-audio')return 'export default '+JSON.stringify(audioData)+';';if(id.endsWith('content.json'))return JSON.stringify(content);}}]});
  await bundle.write({file:join(out,'app.js'),format:'iife',name:'PhoneStories',sourcemap:false});await bundle.close();
  await mkdir(join(out,'assets'),{recursive:true});await copyFile(join(root,'assets/logo.svg'),join(out,'assets/logo.svg'));
  for(const folder of ['avatars']){await mkdir(join(out,'assets',folder),{recursive:true});for(const file of await readdir(join(root,'assets',folder))){if(!file.endsWith('.svg'))continue;await copyFile(join(root,'assets',folder,file),join(out,'assets',folder,file));}}
  const allowed=new Set(['.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff']);async function validate(folder){for(const item of await readdir(folder,{withFileTypes:true})){const path=join(folder,item.name);if(item.isDirectory())await validate(path);else if(!allowed.has(extname(item.name).toLowerCase()))throw Error('Unsupported package file: '+path);}}await validate(out);
  console.log('Static build ready: dist/; upload file types validated');
}
async function lint(){
  const scripts=['src/app.mjs','src/model.mjs','src/call-player.mjs','src/export-image.mjs','tools.mjs','qa/browser-check.mjs',...(await readdir(join(root,'tests'))).filter(x=>x.endsWith('.mjs')).map(x=>'tests/'+x)];
  for(const file of scripts){const check=spawnSync(process.execPath,['--check',join(root,file)],{encoding:'utf8'});if(check.status!==0)throw Error(file+': '+check.stderr);}
  const content=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
  if(!content.people.length||!content.callScripts.length||new Set(content.people.map(x=>x.id)).size!==content.people.length)throw Error('Invalid people library');
  for(const script of content.callScripts)if(!script.prompt||!script.segments.length||script.segments.some(s=>!s.text||!s.file))throw Error('Incomplete audio script');
  for(const file of sourceFiles.filter(x=>/\.(mjs|css)$/.test(x))){const text=await readFile(join(root,file),'utf8');if(/serviceWorker|speechSynthesis|readAsDataURL/.test(text))throw Error('Runtime policy violation: '+file);}
  console.log('Lint passed');
}
async function serve(port=4317){
  const base=resolve(root,'dist'),mime={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
  const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(base,'.'+(path==='/'?'/index.html':path));if(file!==base&&!file.startsWith(base+sep)){res.writeHead(403);res.end();return;}const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
  await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',yes);});console.log('Preview: http://127.0.0.1:'+server.address().port);
}
const command=process.argv[2];if(command==='build')await build();else if(command==='lint')await lint();else if(command==='dev'||command==='preview'){if(command==='dev')await build();await serve(Number(process.env.PORT||4317));}

