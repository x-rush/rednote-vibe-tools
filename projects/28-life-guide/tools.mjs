import {readFile,writeFile,mkdir,copyFile,readdir,rm,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve,sep,extname} from 'node:path';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('./',import.meta.url)),command=process.argv[2];
const runtime=['model.js','render.js','storage.js','reader.js','app.js'];
const allowed=new Set(['.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff']);
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())result.push(...await walk(p));else result.push(p);}return result.sort();}
async function lint(){
  const c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));assert.equal(c.sections.length,c.meta.sectionCount);const entries=c.sections.flatMap(s=>s.entries);assert.equal(entries.length,c.meta.entryCount);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);assert.ok(c.meta.appName&&Array.from(c.meta.shortDescription).length<=14,'App name and short description');const icon=await readFile(join(root,c.meta.icon));assert.equal(icon.readUInt32BE(16),512);assert.equal(icon.readUInt32BE(20),512);
  const vocab={money:['0','少','多'],time:['少','中','多'],will:['否','些','是'],level:['大','中','小'],lens:['死亡率','金钱','时间','自由'],grade:['A','B','C']};
  for(const e of entries){for(const k of ['title','cost','gain','src','grade'])assert.ok(typeof e[k]==='string'&&e[k],e.id+' '+k);for(const [k,values]of Object.entries(vocab))assert.ok(values.includes(e[k]),e.id+' invalid '+k+': '+e[k]);for(const group of e.who)assert.ok(Array.isArray(group)&&group.length);}
  for(const file of runtime){const source=await readFile(join(root,'src',file),'utf8');new vm.Script(source,{filename:file});assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|eval\s*\(|new Function|navigator\.clipboard|serviceWorker|requestFullscreen|window\.open\(|\.replaceAll\(|\.flatMap\(|Object\.fromEntries|\?\.|\?\?|\(\?<|\bimport\s|\bexport\s/.test(source),'Unsupported API/syntax '+file);}
  const html=await readFile(join(root,'index.html'),'utf8');assert.ok(!/type=["']module|<script\s*>|\son\w+=|<iframe|<object|<base\s|https?:\/\//.test(html),'HTML offline contract');assert.ok(html.includes('viewport-fit=cover'));
  const css=await readFile(join(root,'src/style.css'),'utf8');assert.ok(!/url\(\s*['"]?https?:/.test(css));assert.ok(css.includes('--safe-area-inset-top')&&css.includes('--host-clearance'));
  console.log('PASS: full content schema, classic JS syntax/API rules, relative resources and safe-area contract.');
}
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
async function zip(dir,out){
  const chunks=[],central=[],inventory=[];let offset=0;
  for(const p of await walk(dir)){
    assert.ok(allowed.has(extname(p)),'Rejected extension '+p);const name=Buffer.from(p.slice(dir.length+1).split(sep).join('/')),raw=await readFile(p),data=deflateRawSync(raw,{level:9}),crc=crc32(raw),h=Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(name.length,26);chunks.push(h,name,data);
    const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x800,8);cd.writeUInt16LE(8,10);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(data.length,20);cd.writeUInt32LE(raw.length,24);cd.writeUInt16LE(name.length,28);cd.writeUInt32LE(offset,42);central.push(cd,name);offset+=h.length+name.length+data.length;
    inventory.push({path:name.toString(),bytes:raw.length,compressed:data.length,sha256:createHash('sha256').update(raw).digest('hex')});
  }
  const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(inventory.length,8);end.writeUInt16LE(inventory.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);await writeFile(out,Buffer.concat([...chunks,cd,end]));
  const saved=await readFile(out);assert.ok(saved.length<=10*1024*1024,'ZIP >10MiB');let cursor=saved.readUInt32LE(saved.length-6),count=saved.readUInt16LE(saved.length-12);const names=[];
  while(count--){assert.equal(saved.readUInt32LE(cursor),0x02014b50);const nameLen=saved.readUInt16LE(cursor+28),name=saved.subarray(cursor+46,cursor+46+nameLen).toString(),size=saved.readUInt32LE(cursor+20),start=saved.readUInt32LE(cursor+42);assert.ok(allowed.has(extname(name))&&!name.includes('..')&&!name.startsWith('/'));const body=start+30+saved.readUInt16LE(start+26)+saved.readUInt16LE(start+28),raw=inflateRawSync(saved.subarray(body,body+size));assert.equal(crc32(raw),saved.readUInt32LE(cursor+16));assert.equal(raw.length,saved.readUInt32LE(cursor+24));names.push(name);cursor+=46+nameLen+saved.readUInt16LE(cursor+30)+saved.readUInt16LE(cursor+32);}
  assert.ok(names.includes('index.html'));return {bytes:saved.length,sha256:createHash('sha256').update(saved).digest('hex'),files:inventory};
}
async function build(){
  await lint();const dist=resolve(root,'dist');assert.ok(dist.startsWith(resolve(root)+sep));await rm(dist,{force:true,recursive:true});await mkdir(join(dist,'assets'),{recursive:true});await mkdir(join(root,'release'),{recursive:true});
  await copyFile(join(root,'index.html'),join(dist,'index.html'));await copyFile(join(root,'src/style.css'),join(dist,'style.css'));for(const file of runtime)await copyFile(join(root,'src',file),join(dist,file));await copyFile(join(root,'assets/cat-reading.webp'),join(dist,'assets/cat-reading.webp'));await copyFile(join(root,'assets/app-icon.png'),join(dist,'assets/app-icon.png'));
  const content=await readFile(join(root,'src/content/content.json'),'utf8');await writeFile(join(dist,'content.js'),'window.LIFE_CONTENT='+content.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n');
  const version=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
  const meta=JSON.parse(content).meta;const manifest=await zip(dist,join(root,'release/'+meta.appName+'-'+version+'-小红书小工具.zip'));manifest.appName=meta.appName;manifest.shortDescription=meta.shortDescription;manifest.icon=meta.icon;manifest.version=version;manifest.sourceCommit=JSON.parse(content).meta.sourceCommit;manifest.warnings=manifest.files.filter(f=>f.bytes>2*1024*1024).map(f=>f.path+' exceeds 2MiB: full offline text explicitly requested; only the current complete chapter is rendered.');await writeFile(join(root,'release/package-manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
}
if(command==='lint')await lint();else if(command==='build')await build();else if(command==='preview'){
  const base=resolve(root,'dist'),port=Number(process.env.PORT||4328);createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),p=resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!p.startsWith(base+sep))throw Error('path');const bytes=await readFile(p);res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp'}[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch(ignore){res.writeHead(404);res.end();}}).listen(port,'127.0.0.1',()=>console.log('http://127.0.0.1:'+port));
}else throw Error('Unknown command '+command);
