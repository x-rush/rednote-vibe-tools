import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {join,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {deflateRawSync} from 'node:zlib';
import vm from 'node:vm';
const root=fileURLToPath(new URL('.',import.meta.url));
const allowed=new Set(['.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff']);
async function files(dir){const a=[];for(const d of await readdir(dir,{withFileTypes:true})){if(d.isDirectory())a.push(...await files(join(dir,d.name)));else a.push(join(dir,d.name));}return a;}
async function lint(){
  const c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
  if(c.items.length!==33||c.combos.length!==8||c.tiers.length!==6)throw Error('Content incomplete');
  for(const f of ['src/engine.js','src/app.js']){const x=await readFile(join(root,f),'utf8');new vm.Script(x,{filename:f});if(/\bfetch\s*\(|XMLHttpRequest|WebSocket|eval\s*\(|new Function|navigator\.clipboard|serviceWorker|requestFullscreen|\.replaceAll\(|\?\.|\?\?|\bimport\s|\bexport\s/.test(x))throw Error('Unsupported runtime '+f);}
  const html=await readFile(join(root,'index.html'),'utf8');if(/type=["']module|<script>(?!\s*<)|\son\w+=|<iframe|<base\s|https?:\/\//.test(html))throw Error('Offline HTML failed');
  const css=await readFile(join(root,'src/style.css'),'utf8');if(/(?<![\w-])(gap|aspect-ratio|inset)\s*:|:has\(|clamp\(|color-mix\(/.test(css))throw Error('CSS baseline needs fallback');
  const ids=new Set(c.items.map(i=>i.id));if(ids.size!==33)throw Error('Duplicate IDs');
  for(const i of c.items)if(!c.tiers[i.tier-1]||!Number.isInteger(i.w)||i.w<1||i.w>3||i.h<1||i.h>4)throw Error('Invalid scenery');
  for(const x of c.combos)if(x.items.some(id=>!ids.has(id)))throw Error('Invalid combo');
  console.log('Lint: syntax, content references, offline APIs, HTML and CSS baseline passed.');
}
function crc32(data){let crc=0xffffffff;for(const b of data){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
async function zip(dir,out){const chunks=[],cent=[];let offset=0,count=0;for(const p of await files(dir)){
  if(!allowed.has(extname(p)))throw Error('Forbidden extension '+p);
  const name=Buffer.from(p.slice(dir.length+1).split(sep).join('/')),data=await readFile(p),compressed=deflateRawSync(data),crc=crc32(data),h=Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);chunks.push(h,name,compressed);
  const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x800,8);cd.writeUInt16LE(8,10);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(compressed.length,20);cd.writeUInt32LE(data.length,24);cd.writeUInt16LE(name.length,28);cd.writeUInt32LE(offset,42);cent.push(cd,name);offset+=h.length+name.length+compressed.length;count++;
  }const central=Buffer.concat(cent),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);await writeFile(out,Buffer.concat([...chunks,central,end]));
  const saved=await readFile(out);if(saved.length>10*1024*1024)throw Error('ZIP too large');let at=saved.readUInt32LE(saved.length-6),entries=[];for(let i=0;i<count;i++){if(saved.readUInt32LE(at)!==0x02014b50)throw Error('Bad ZIP');const len=saved.readUInt16LE(at+28),extra=saved.readUInt16LE(at+30),comment=saved.readUInt16LE(at+32),name=saved.subarray(at+46,at+46+len).toString();if(!allowed.has(extname(name)))throw Error('ZIP whitelist failed');entries.push(name);at+=46+len+extra+comment;}if(!entries.includes('index.html'))throw Error('Root index missing');console.log(JSON.stringify({zip:out,bytes:saved.length,entries},null,2));
}
const cmd=process.argv[2];
if(cmd==='lint')await lint();
else if(cmd==='build'){
  await lint();await mkdir(join(root,'dist/assets'),{recursive:true});await mkdir(join(root,'release'),{recursive:true});
  for(const [from,to] of [['index.html','index.html'],['src/style.css','style.css'],['src/engine.js','engine.js'],['src/app.js','app.js'],['assets/scenery.webp','assets/scenery.webp'],['assets/plants.webp','assets/plants.webp']])await copyFile(join(root,from),join(root,'dist',to));
  const c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));await writeFile(join(root,'dist/content.js'),'window.GARDEN_CONTENT='+JSON.stringify(c).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';');
  for(const name of ['estate-v6','lake-v6','mountain-v6','scenery-v6','lake-v7','harbor-v7'])await copyFile(join(root,'assets/'+name+'.webp'),join(root,'dist/assets/'+name+'.webp'));
  await zip(join(root,'dist'),join(root,'release',c.title+'.zip'));
}else if(cmd==='preview'){
  const base=join(root,'dist');createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=resolve(base,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!p.startsWith(base+sep))throw Error('Invalid path');const b=await readFile(p);res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp'}[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);}catch{res.writeHead(404);res.end();}}).listen(Number(process.env.PORT||4327),'127.0.0.1',()=>console.log('http://127.0.0.1:'+(process.env.PORT||4327)));
}else throw Error('Unknown command');
