const fs=require('fs'),path=require('path'),assert=require('assert');
const acorn=require('internal/deps/acorn/acorn/dist/acorn');
const root=path.resolve(process.argv[2]||'dist'),files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else files.push(p);}}
walk(root);const allowed=/\.(html|css|js|json|png|jpg|jpeg|svg|gif|webp|woff|woff2)$/i;
for(const p of files){assert(allowed.test(p),p);assert(!/[\\/](?:node_modules|\.git)[\\/]|\.map$/.test(p));if(p.endsWith('.js')){const s=fs.readFileSync(p,'utf8');acorn.parse(s,{ecmaVersion:2017});assert(!/\b(?:fetch|eval)\s*\(|XMLHttpRequest|new\s+(?:Function|Worker|SharedWorker|WebSocket|EventSource|RTCPeerConnection)|WebAssembly|navigator\.(?:geolocation|clipboard|bluetooth|usb|hid|serial|connection|getBattery|credentials|locks|serviceWorker)|requestFullscreen|\.at\s*\(|globalThis/.test(s),'Forbidden capability or unsupported API in '+p);}}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(!/<script(?![^>]*src=)[^>]*>|type=["']module|\son\w+=|<iframe|<object|<base|http-equiv=["']Content-Security-Policy/i.test(html));assert.equal(files.filter(p=>p.endsWith('.html')).length,1);
for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert(m[1].startsWith('./'));assert(fs.existsSync(path.join(root,m[1])));}
const audio=fs.readFileSync(path.join(root,'audio-data.js'),'utf8'),b64=JSON.parse(audio.slice(audio.indexOf('=')+1,-1)),bytes=Buffer.from(b64,'base64');assert(bytes.length<=1048576);
console.log(JSON.stringify({files:files.map(p=>path.relative(root,p)),es2017:'PASS',offlineResources:'PASS',forbiddenAPIs:'NONE',audioBytes:bytes.length,audioRisk:bytes.length>102400?'Base64 >100KiB; built-in Web Audio bytes; local preview only':'none',unpackedBytes:files.reduce((n,p)=>n+fs.statSync(p).size,0)},null,2));
