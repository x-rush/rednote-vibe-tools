import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve('.'),out=join(root,'minitool-dist');
const manifest=JSON.parse(await readFile(join(root,'release/package-manifest.json'),'utf8'));
const allowed=new Set(['.html','.css','.js','.json','.png','.jpg','.jpeg','.webp','.gif','.svg','.woff','.woff2']);
async function list(dir,prefix=''){
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const name=prefix+entry.name;
    if(entry.isDirectory())result.push(...await list(join(dir,entry.name),name+'/'));else result.push(name);
  }
  return result.sort();
}
const names=await list(out),contents=new Map(),refs=new Set();let base64Count=0,maxBase64Bytes=0;
for(const name of names){
  assert(allowed.has(extname(name)),`Unsupported file: ${name}`);
  assert(!/(^|\/)(node_modules|\.git)(\/|$)|\.map$|(?:vite|webpack)\.config/.test(name),`Development file: ${name}`);
  const data=await readFile(join(out,name));contents.set(name,data);
  if(!/\.(html|js|css|json)$/.test(name))continue;
  const text=data.toString('utf8');
  for(const match of text.matchAll(/data:[^\s'"<>;,]+;base64,([A-Za-z0-9+/=]+)/g)){
    const bytes=Buffer.from(match[1],'base64').length;base64Count++;maxBase64Bytes=Math.max(maxBase64Bytes,bytes);assert(bytes<=1024*1024,`Oversized Base64 in ${name}`);
  }
  for(const match of text.matchAll(/(?:src|href)=["'](\.\/[^"'<>]+)["']/g))refs.add(match[1].slice(2));
  assert(!/(?:src|href)=["']https?:\/\/|url\(["']?https?:\/\//i.test(text),`External resource in ${name}`);
}
assert(names.includes('index.html'),'Missing root index.html');
for(const name of refs)assert(contents.has(name),`Missing referenced file: ${name}`);
const html=contents.get('index.html').toString();
assert(/viewport-fit=cover/.test(html));assert(!/<script(?![^>]*\bsrc=)[^>]*>\s*\S|type=["']module|<base\b|<iframe\b|<object\b|http-equiv=["']Content-Security-Policy/i.test(html));
const app=contents.get('assets/app.js').toString();
for(const rule of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\bnew\s+(?:Worker|SharedWorker|WebSocket|EventSource|RTCPeerConnection)\s*\(/,/\beval\s*\(/,/\bnew\s+Function\s*\(/,/\bWebAssembly\b/,/navigator\.(?:clipboard|geolocation|bluetooth|usb|hid|serial|serviceWorker|credentials|locks|connection)/,/\b(?:requestFullscreen|webkitRequestFullscreen)\s*\(/,/\bwindow\.(?:open|prompt)\s*\(/,/\.download\s*=/,/\bimport\s*\(/])assert(!rule.test(app),`Forbidden capability: ${rule}`);
const badge=contents.get('assets/xhs-renovation-badge.png');assert(badge&&badge.readUInt32BE(0)===0x89504e47&&badge[25]===6,'Badge must be RGBA PNG');
const zip=await readFile(manifest.zip);assert(zip.length<=10*1024*1024);
let end=zip.length-22;while(end>=0&&zip.readUInt32LE(end)!==0x06054b50)end--;assert(end>=0,'Missing ZIP directory');
let cursor=zip.readUInt32LE(end+16);const count=zip.readUInt16LE(end+10),zipNames=[];
for(let i=0;i<count;i++){
  assert.equal(zip.readUInt32LE(cursor),0x02014b50);
  const method=zip.readUInt16LE(cursor+10),packedSize=zip.readUInt32LE(cursor+20),size=zip.readUInt32LE(cursor+24),nameSize=zip.readUInt16LE(cursor+28),extra=zip.readUInt16LE(cursor+30),comment=zip.readUInt16LE(cursor+32),offset=zip.readUInt32LE(cursor+42);
  const name=zip.subarray(cursor+46,cursor+46+nameSize).toString();assert(allowed.has(extname(name)));assert(!name.includes('..')&&!name.startsWith('/'));
  const start=offset+30+zip.readUInt16LE(offset+26)+zip.readUInt16LE(offset+28),packed=zip.subarray(start,start+packedSize),data=method===8?inflateRawSync(packed):packed;
  assert.equal(data.length,size);assert(contents.has(name)&&data.equals(contents.get(name)),`ZIP differs from audited artifact: ${name}`);zipNames.push(name);cursor+=46+nameSize+extra+comment;
}
assert.deepEqual(zipNames.sort(),names);
const report={passed:true,skill:'minitool-zip-builder 1.8.0',date:'2026-10-16',zip:manifest.zip,bytes:zip.length,sha256:createHash('sha256').update(zip).digest('hex'),files:names,checks:{rootEntry:true,extensions:true,zipMatchesDirectory:true,localReferences:true,classicScripts:true,forbiddenCapabilitiesAbsent:true,badgeRgba:true,base64:{count:base64Count,maxDecodedBytes:maxBase64Bytes}},pending:['Platform simulator acceptance','Android native acceptance','iOS native acceptance','Chrome 61 runtime/CSS acceptance','Physical device performance and native bridge acceptance']};
await writeFile(join(root,'release/package-audit-20261016.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
