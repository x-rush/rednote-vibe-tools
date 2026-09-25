import {readFile,writeFile,mkdir,copyFile,readdir,stat} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import vm from 'node:vm';
const root=fileURLToPath(new URL('.',import.meta.url));
const allowed=new Set(['.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff']);
const command=process.argv[2];
async function files(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())result.push(...await files(p));else result.push(p);}return result;}
async function lint(){
  const c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
  if(!c.nodes[c.start])throw Error('Missing start');
  for(const f of ['src/engine.js','src/storage.js','src/audio.js','src/app.js']){
    const text=await readFile(join(root,f),'utf8');new vm.Script(text,{filename:f});
    if(/\bfetch\s*\(|XMLHttpRequest|WebSocket|eval\s*\(|new Function|navigator\.clipboard|serviceWorker|requestFullscreen|\.replaceAll\(|\?\.|\?\?|\bimport\s|\bexport\s/.test(text))throw Error('Unsupported runtime API or syntax: '+f);
  }
  const html=await readFile(join(root,'index.html'),'utf8');
  if(/type=["']module|<script>(?!\s*<)|\son\w+=|<iframe|<base\s|https?:\/\//.test(html))throw Error('HTML violates offline contract');
  for(const [id,n] of Object.entries(c.nodes)){
    if(!n.choices.length||!n.title||!n.paragraphs.length)throw Error('Incomplete node '+id);
    if(new Set(n.choices.map(x=>x.id)).size!==n.choices.length)throw Error('Duplicate choices '+id);
    for(const ch of n.choices){for(const dest of ch.to?[ch.to]:(ch.routes||[]).map(x=>x.to)){if(!c.nodes[dest]&&!c.endings[dest])throw Error('Broken destination '+dest);}}
  }
  for(const n of [...Object.values(c.nodes),...Object.values(c.endings)]){
    if(n.music&&!c.audio.files[n.music])throw Error('Unknown music '+n.music);
    for(const b of n.beats||n.epilogue||[])if(b.audio&&(!c.audio.files[b.audio.id]||!c.characters[b.audio.character]))throw Error('Invalid voice cue '+b.id);
  }
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
else if(command==='build'){
  await lint();await mkdir(join(root,'dist/assets'),{recursive:true});await mkdir(join(root,'release'),{recursive:true});
  for(const [from,to] of [['index.html','index.html'],['src/style.css','style.css'],['src/engine.js','engine.js'],['src/storage.js','storage.js'],['src/audio.js','audio.js'],['src/app.js','app.js'],['assets/courtyard.webp','assets/courtyard.webp']])await copyFile(join(root,from),join(root,'dist',to));
  const c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));await writeFile(join(root,'dist/content.js'),'window.STORY_CONTENT='+JSON.stringify(c).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';');
  for(const art of Object.values(c.art))await copyFile(join(root,art),join(root,'dist',art));
  const audio={};
  for(const [id,a] of Object.entries(c.audio.files)){
    const path=resolve(root,a.file);if(!path.startsWith(resolve(root,'assets/audio/runtime')+sep))throw Error('Invalid audio path');
    const bytes=await readFile(path);if(bytes.length>1024*1024)throw Error('Audio exceeds 1 MiB: '+id);
    if(bytes.length>102400)console.warn('Audio exceeds 100 KiB: '+id);
    audio[id]=bytes.toString('base64');
  }
  await writeFile(join(root,'dist/audio-data.js'),'window.STORY_AUDIO='+JSON.stringify(audio)+';');
  await zipStore(join(root,'dist'),join(root,'release',c.title+'.zip'));
}else if(command==='preview'){
  const base=join(root,'dist'),port=Number(process.env.PORT||4326);
  createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=resolve(base,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!p.startsWith(base+sep))throw Error('Invalid path');const b=await readFile(p);res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp'}[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);}catch{res.writeHead(404);res.end();}}).listen(port,'127.0.0.1',()=>console.log('http://127.0.0.1:'+port));
}else throw Error('Unknown command');
