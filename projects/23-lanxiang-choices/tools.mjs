import {readFile,writeFile,mkdir,copyFile,readdir,stat,rm} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import vm from 'node:vm';
const root=fileURLToPath(new URL('.',import.meta.url));
const allowed=new Set(['.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff']);
const command=process.argv[2];
async function files(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())result.push(...await files(p));else result.push(p);}return result;}
function contentFor(raw,single){
  const full={...raw};delete full.singleStory;
  if(!single)return full;
  if(!raw.singleStory)throw Error('Missing single story');
  const one=raw.singleStory;
  return {...full,...one,ui:{...full.ui,...one.ui}};
}
// Sprites and scene backdrops must stay class-driven: some host pipelines rewrite stylesheet asset URLs but drop inline style attributes, which blanks inline-background sprites.
function dynamicStyles(c){
  const emotions=new Set(['neutral']),scenes=new Set();
  const scan=frames=>{for(const b of frames||[]){if(b.expression)emotions.add(b.expression);for(const v of Object.values(b.reactions||{}))emotions.add(v);if(b.background)scenes.add(b.background);}};
  for(const n of Object.values(c.nodes)){scenes.add(n.background||'courtyard');scan(n.beats);}
  for(const e of Object.values(c.endings)){scenes.add(e.background||'courtyard');scan(e.epilogue);}
  let css='';
  for(const key of scenes){const art=c.art[key];if(art)css+='body[data-scene="'+key+'"] .scenery{background-image:url(\''+art+'\')}';}
  for(const [id,p] of Object.entries(c.characters)){
    const columns=p.columns||4,pos=Math.round(p.column*100/((columns-1)||1)*1000)/1000;
    for(const e of emotions){
      const art=c.art[p.atlas||e]||c.art.neutral;
      if(!art)continue;
      css+='.sprite[data-character="'+id+'"].emotion-'+e+'{background-image:url(\''+art+'\');background-size:'+(columns*100)+'% 100%;background-position:'+pos+'% 0}';
    }
  }
  return css;
}
function lintStory(c){
  if(!c.nodes[c.start])throw Error('Missing start');
  if(!c.chapters.some(ch=>ch.id===c.defaultChapter&&c.nodes[ch.start]))throw Error('Missing default chapter');
  for(const [id,n] of Object.entries(c.nodes)){
    if(!n.choices.length||!n.title||!n.paragraphs.length||!n.beats?.length)throw Error('Incomplete node '+id);
    if(new Set(n.choices.map(x=>x.id)).size!==n.choices.length)throw Error('Duplicate choices '+id);
    for(const ch of n.choices){for(const dest of ch.to?[ch.to]:(ch.routes||[]).map(x=>x.to)){if(!c.nodes[dest]&&!c.endings[dest])throw Error('Broken destination '+dest);}}
  }
  for(const n of [...Object.values(c.nodes),...Object.values(c.endings)]){
    if(n.music&&!c.audio.files[n.music])throw Error('Unknown music '+n.music);
    for(const b of n.beats||n.epilogue||[])if(b.audio&&(!c.audio.files[b.audio.id]||!c.characters[b.audio.character]))throw Error('Invalid voice cue '+b.id);
  }
}
async function lint(){
  const raw=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
  lintStory(contentFor(raw,false));lintStory(contentFor(raw,true));
  for(const f of ['src/engine.js','src/storage.js','src/audio.js','src/app.js']){
    const text=await readFile(join(root,f),'utf8');new vm.Script(text,{filename:f});
    if(/\bfetch\s*\(|XMLHttpRequest|WebSocket|eval\s*\(|new Function|navigator\.clipboard|serviceWorker|requestFullscreen|\.replaceAll\(|\?\.|\?\?|\bimport\s|\bexport\s/.test(text))throw Error('Unsupported runtime API or syntax: '+f);
  }
  const html=await readFile(join(root,'index.html'),'utf8');
  if(/type=["']module|<script>(?!\s*<)|\son\w+=|<iframe|<base\s|https?:\/\//.test(html))throw Error('HTML violates offline contract');
  console.log('JS syntax, offline API rules, HTML and story references passed.');
}
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
async function zipStore(dir,out){
  const chunks=[],central=[];let offset=0;const inventory=[];
  for(const p of await files(dir)){
    if(!allowed.has(extname(p)))throw Error('Forbidden artifact extension '+p);
    const name=Buffer.from(p.slice(dir.length+1).split(sep).join('/')),data=await readFile(p),crc=crc32(data),h=Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);
    chunks.push(h,name,data);const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x800,8);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(data.length,20);cd.writeUInt32LE(data.length,24);cd.writeUInt16LE(name.length,28);cd.writeUInt32LE(offset,42);central.push(cd,name);offset+=30+name.length+data.length;inventory.push(name.toString());
  }
  if(!inventory.includes('index.html'))throw Error('Missing root entry');
  const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(inventory.length,8);end.writeUInt16LE(inventory.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
  const zip=Buffer.concat([...chunks,cd,end]);if(zip.length>10*1024*1024)throw Error('ZIP over 10 MiB');await writeFile(out,zip);
  // Validate the actual written ZIP central directory, not merely the input list.
  const saved=await readFile(out);let cursor=saved.readUInt32LE(saved.length-6),count=saved.readUInt16LE(saved.length-12);const entries=[];
  while(count--){if(saved.readUInt32LE(cursor)!==0x02014b50)throw Error('ZIP corrupt');const len=saved.readUInt16LE(cursor+28),extra=saved.readUInt16LE(cursor+30),comment=saved.readUInt16LE(cursor+32),name=saved.subarray(cursor+46,cursor+46+len).toString();if(!allowed.has(extname(name)))throw Error('ZIP extension rejected');entries.push(name);cursor+=46+len+extra+comment;}
  if(!entries.includes('index.html'))throw Error('ZIP root missing');console.log(JSON.stringify({zip:out,bytes:saved.length,entries},null,2));
}
if(command==='lint')await lint();
else if(command==='build'||command==='build-single'){
  await lint();
  const single=command==='build-single',distDir=join(root,single?'dist-single':'dist');
  if(!distDir.startsWith(resolve(root)+sep))throw Error('Build directory outside project');
  await rm(distDir,{recursive:true,force:true});await mkdir(join(distDir,'assets'),{recursive:true});await mkdir(join(root,'release'),{recursive:true});
  for(const [from,to] of [['index.html','index.html'],['src/engine.js','engine.js'],['src/storage.js','storage.js'],['src/audio.js','audio.js'],['src/app.js','app.js']])await copyFile(join(root,from),join(distDir,to));
  const stylesheet=await readFile(join(root,'src/style.css'),'utf8');
  // The single-story atlas has two square cells; rendering it in the full game's tall sprite boxes stretches faces and bodies.
  const singleStyles=stylesheet.replace(/\.sprite-lanxiang\{[^}]*\}|\.sprite-xiaolian,\.sprite-lin,\.sprite-zhao\{[^}]*\}|\.emotion-intense\{[^}]*\}/g,'').replace(/assets\/cast-neutral\.webp/g,'assets/single-cast.webp').replace(/assets\/courtyard\.webp/g,'assets/single-street.webp')+
    '\n.scenery:after{background:linear-gradient(180deg,rgba(10,20,31,.48),rgba(12,23,35,.19) 38%,rgba(13,23,34,.95) 87%)}.home-title,.vn-heading,.safe-head{text-shadow:0 2px 8px rgba(5,14,22,.9)}.home-title .volume,.brand-tagline,.vn-heading .scene-place{color:#f7ecda}\n'+
    '.vn-stage{height:250px}.vn-stage .sprite{width:225px;height:225px;bottom:-5px}.vn-stage .sprite:first-child:nth-last-child(2){width:280px;height:280px;bottom:-30px}.gallery-portrait{height:165px}.gallery-portrait .sprite{width:155px;height:155px;bottom:-5px}\n'+
    '@media(max-width:390px){.vn-stage .sprite{width:210px;height:210px}}\n'+
    '@media(min-width:760px) and (min-height:551px){.vn-stage{height:330px}.vn-stage .sprite{width:310px;height:310px}.vn-stage .sprite:first-child:nth-last-child(2){width:360px;height:360px;bottom:-30px}}\n'+
    '@media(orientation:landscape) and (max-height:550px){.vn-stage{height:205px}.vn-stage .sprite{width:180px;height:180px}.vn-stage .sprite:first-child:nth-last-child(2){width:210px;height:210px;bottom:-10px}.gallery-portrait{height:150px}.gallery-portrait .sprite{width:145px;height:145px}}\n';
  const raw=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8')),c=contentFor(raw,single);
  await writeFile(join(distDir,'style.css'),(single?singleStyles:stylesheet)+dynamicStyles(c));
  await writeFile(join(distDir,'content.js'),'window.STORY_CONTENT='+JSON.stringify(c).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';');
  for(const art of new Set(Object.values(c.art)))await copyFile(join(root,art),join(distDir,art));
  const audio={};
  for(const [id,a] of Object.entries(c.audio.files)){
    const path=resolve(root,a.file);if(!path.startsWith(resolve(root,'assets/audio/runtime')+sep))throw Error('Invalid audio path');
    const bytes=await readFile(path);if(bytes.length>1024*1024)throw Error('Audio exceeds 1 MiB: '+id);
    if(bytes.length>102400)console.warn('Audio exceeds 100 KiB: '+id);
    audio[id]=bytes.toString('base64');
  }
  await writeFile(join(distDir,'audio-data.js'),'window.STORY_AUDIO='+JSON.stringify(audio)+';');
  await zipStore(distDir,join(root,'release',c.title+(single?'-单线试投':'')+'.zip'));
}else if(command==='preview'){
  const base=join(root,'dist'),port=Number(process.env.PORT||4326);
  createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=resolve(base,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!p.startsWith(base+sep))throw Error('Invalid path');const b=await readFile(p);res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp'}[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);}catch{res.writeHead(404);res.end();}}).listen(port,'127.0.0.1',()=>console.log('http://127.0.0.1:'+port));
}else throw Error('Unknown command');
