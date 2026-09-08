import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const store=resolve(project,'../../node_modules/.pnpm');
const installed=(await readdir(store)).find(x=>/^rolldown@/.test(x));
if(!installed)throw Error('Use the existing workspace Rolldown installation; do not add a dependency here.');
const {rolldown}=await import(pathToFileURL(resolve(store,installed,'node_modules/rolldown/dist/index.mjs')));
const dest=resolve(project,'release/package');await mkdir(resolve(dest,'assets'),{recursive:true});
const content=JSON.parse(await readFile(resolve(project,'src/content/content.json'),'utf8'));
if([...content.listing.description].length!==14)throw Error('Listing must have exactly 14 characters');
const {sources,...runtimeContent}=content;
const bundle=await rolldown({input:resolve(project,'src/app.js'),plugins:[{
  name:'offline-container',
  resolveId(id){if(id==='three')return resolve(project,'vendor/package/build/three.module.js');if(id.startsWith('three/addons/'))return resolve(project,'vendor/package/examples/jsm',id.slice(13));},
  transform(code,id){
    if(id.replaceAll('\\','/').endsWith('/src/app.js'))return code.replace(/const content=await fetch[^\n]+/,`const content=${JSON.stringify(runtimeContent)};`).replaceAll('./src/assets/logo.png','./assets/logo.png');
    if(id.replaceAll('\\','/').endsWith('/build/three.module.js')){
      // The app only renders ordinary WebGL. Remove the unused XR subsystem
      // at the build boundary, rather than shipping prohibited XR code.
      const start=code.indexOf('class WebXRManager extends EventDispatcher {');
      const end=code.indexOf('const _e1 =',start);
      if(start<0||end<0)throw Error('Three.js layout changed; review offline XR adapter');
      return code.slice(0,start)+`class WebXRManager extends EventDispatcher {constructor(){super();this.enabled=false;this.isPresenting=false;}getEnvironmentBlendMode(){return 'opaque';}setAnimationLoop(){}dispose(){}}\n`+code.slice(end);
    }
  }
}],treeshake:true});
const license=await readFile(resolve(project,'vendor/package/LICENSE'),'utf8');
await bundle.write({file:resolve(dest,'assets/app.js'),format:'iife',minify:true,banner:`/*! Three.js 0.180.0 — MIT License\n${license}\nOffline build: XR subsystem replaced by an inactive adapter. */`,sourcemap:false});await bundle.close();
let html=await readFile(resolve(project,'index.html'),'utf8');html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./src/app.js"></script>','<script src="./assets/app.js"></script>').replace('./src/style.css','./assets/style.css').replace('./src/polish.css','./assets/polish.css').replace('./src/assets/logo.png','./assets/logo.png');
await writeFile(resolve(dest,'index.html'),html);
const css=(await readFile(resolve(project,'src/style.css'),'utf8')).replace("@import url('./scene.css');",await readFile(resolve(project,'src/scene.css'),'utf8'));
await writeFile(resolve(dest,'assets/style.css'),css);
await copyFile(resolve(project,'src/polish.css'),resolve(dest,'assets/polish.css'));
await copyFile(resolve(project,'src/assets/logo.png'),resolve(dest,'assets/logo.png'));
await copyFile(resolve(project,'src/assets/logo.png'),resolve(project,'release/果冻慢慢-logo.png'));
await writeFile(resolve(project,'release/上架资料.json'),JSON.stringify({...content.listing,descriptionLength:14,logo:'果冻慢慢-logo.png',package:'guodong-manman-1.5.2.zip'},null,2));
await writeFile(resolve(dest,'assets/licenses.json'),JSON.stringify({three:{version:'0.180.0',license,modification:'Build removes unused WebXR subsystem; ordinary WebGL rendering retained.'}},null,2));
// Validate the exact output, not just source files.
const js=await readFile(resolve(dest,'assets/app.js'),'utf8');
const prohibited=[/\bfetch\s*\(/,/XMLHttpRequest/,/\b(?:eval|import)\s*\(/,/new\s+Function\s*\(/,/new\s+(?:Worker|SharedWorker|WebSocket|EventSource|RTCPeerConnection)\s*\(/,/WebAssembly\./,/navigator\.(?:xr|clipboard|geolocation|bluetooth|usb|hid|serial|serviceWorker|credentials|locks|connection)/,/\b(?:XRWebGLLayer|XRWebGLBinding)\b/];
for(const pattern of prohibited)if(pattern.test(js))throw Error(`Forbidden API remains: ${pattern}`);
if(/type=["'](?:module|importmap)|<script(?![^>]*\bsrc=)|<base\b|<iframe\b|\bon\w+=|javascript:/.test(html))throw Error('Invalid entry');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(!match[1].startsWith('./'))throw Error('Non-relative entry resource');await readFile(resolve(dest,match[1]));}
const allowed=new Set(['.html','.js','.css','.png','.jpg','.jpeg','.gif','.webp','.svg','.woff','.woff2','.json']);
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())await walk(p);else if(!allowed.has(extname(p)))throw Error(`Unsupported package file ${p}`);}}await walk(dest);
console.log('Offline IIFE build and capability checks passed:',dest);



