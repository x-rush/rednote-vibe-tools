import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
const root=fileURLToPath(new URL('.',import.meta.url));
const workspace=resolve(root,'../..');
const compiler=join(workspace,'node_modules/.pnpm/rolldown@1.2.5/node_modules/rolldown/dist/index.mjs');
const tsc=join(workspace,'node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/bin/tsc');
const allowed=new Set(['.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff']);
async function bundle(input,file,format){const {rolldown}=await import(pathToFileURL(compiler).href);const result=await rolldown({input:join(root,input),transform:{target:'chrome61'}});await result.write({file:join(root,file),format,name:'CreekGold',sourcemap:false});await result.close();}
async function build(){await mkdir(join(root,'dist'),{recursive:true});await bundle('src/app.ts','dist/app.js','iife');const config=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));const bank={};for(const asset of config.audio.assets){const bytes=await readFile(join(root,asset.file));if(bytes.length>1048576)throw Error('Audio exceeds 1 MiB');if(bytes.length>102400)console.warn('Audio over 100 KiB: '+asset.id);bank[asset.id]=bytes.toString('base64');}await writeFile(join(root,'dist/audio-data.js'),'window.CREEK_AUDIO='+JSON.stringify(bank)+';');await copyFile(join(root,'index.html'),join(root,'dist/index.html'));await copyFile(join(root,'src/style.css'),join(root,'dist/style.css'));await mkdir(join(root,'dist/assets'),{recursive:true});for(const name of ['specimens.webp','creek-thumbnails.webp','creek-light.webp','creek-crevice.webp','creek-bend.webp','creek-pool.webp','creek-moss.webp','creek-rain.webp','worn-pan.webp','wet-sand.webp'])await copyFile(join(root,'assets',name),join(root,'dist/assets',name));await audit(join(root,'dist'));console.log('Build passed: offline classic JS, local assets, whitelist validated');}
async function audit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await audit(p);else if(!allowed.has(extname(p)))throw Error('Unsupported artifact '+p);}const code=await readFile(join(root,'dist/app.js'),'utf8');for(const pattern of [/\bfetch\s*\(/,/new Worker\s*\(/,/new Function\s*\(/,/\beval\s*\(/,/WebAssembly\./,/import\s*\(/])if(pattern.test(code))throw Error('Forbidden runtime '+pattern);}
async function lint(){const r=spawnSync(process.execPath,[tsc,'--project',join(root,'tsconfig.json')],{stdio:'inherit'});if(r.status)process.exit(r.status);JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));for(const file of ['tools.mjs','qa/browser-check.mjs']){try{await readFile(join(root,file));}catch{continue;}const r=spawnSync(process.execPath,['--check',join(root,file)],{stdio:'inherit'});if(r.status)process.exit(r.status);}console.log('Lint passed: strict TypeScript, JSON, tool syntax');}
async function test(){await mkdir(join(root,'.cache'),{recursive:true});await bundle('src/model.ts','.cache/model.mjs','es');const r=spawnSync(process.execPath,['--test','tests/model.test.mjs'],{cwd:root,stdio:'inherit'});if(r.status)process.exit(r.status);}
async function serve(){const base=resolve(root,process.env.PREVIEW_DIR||'dist'),port=Number(process.env.PORT||4322);const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=resolve(base,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(p!==base&&!p.startsWith(base+sep)){res.writeHead(403);res.end();return;}const b=await readFile(p);res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);}catch{res.writeHead(404);res.end();}});server.listen(port,'127.0.0.1',()=>console.log('Preview http://127.0.0.1:'+port));}
const cmd=process.argv[2];if(cmd==='lint')await lint();else if(cmd==='test')await test();else if(cmd==='build')await build();else if(cmd==='dev'){await build();await serve();}else if(cmd==='preview')await serve();else throw Error('Unknown command');





