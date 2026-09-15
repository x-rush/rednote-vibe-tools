import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {join,resolve,extname,relative} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {root,publicContent} from '../tools.mjs';
const require=createRequire(import.meta.url);
const workspace=resolve(root,'../..');
const runtime=process.env.FLOWER_TOOL_MODULES;
if(!runtime)throw Error('Set FLOWER_TOOL_MODULES to the existing bundled Node modules directory');
const ts=require(join(workspace,'node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js'));
const postcss=require(join(workspace,'node_modules/.pnpm/postcss@8.5.26/node_modules/postcss'));
const JSZip=require(join(runtime,'jszip'));
const release=join(root,'release'),out=join(release,'minitool');
await mkdir(join(out,'assets/portraits'),{recursive:true});
await mkdir(join(out,'assets/logo'),{recursive:true});
const change=(s,pattern,value)=>{
  const next=s.replace(pattern,value);
  if(next===s)throw Error('Packaging source anchor missing: '+String(pattern));
  return next;
};
let engine=await readFile(join(root,'src/engine.mjs'),'utf8');
engine=engine.replace(/export /g,'').replace('structuredClone(value)','JSON.parse(JSON.stringify(value))');
let app=await readFile(join(root,'src/app.mjs'),'utf8');
app=change(app,/^import[^\n]+\n/,'');
app=change(app,/const response=await fetch\('\.\/content\.json'\);\s*if\(!response\.ok\)throw new Error\('content-load'\);\s*content=await response\.json\(\);/,'content=window.FLOWER_CONTENT;');
app=change(app,'crypto.getRandomValues(new Uint32Array(1))[0]',"(typeof crypto!=='undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random()*4294967296))");
app=change(app,'<button onclick="location.reload()">Reload</button>','');
app=change(app,'function render() {','function renderBase() {');
const compat=`
if(!Object.fromEntries)Object.fromEntries=function(entries){var out={};Array.from(entries).forEach(function(pair){out[pair[0]]=pair[1];});return out;};
if(!Array.prototype.at)Object.defineProperty(Array.prototype,'at',{value:function(index){index=Math.trunc(index)||0;return this[index<0?this.length+index:index];},configurable:true,writable:true});
var supportsEnv=window.CSS && CSS.supports && CSS.supports('padding-top','env(safe-area-inset-top)');
['top','bottom'].forEach(function(side){var prop='--safe-area-inset-'+side;if(!supportsEnv&&!getComputedStyle(document.documentElement).getPropertyValue(prop))document.documentElement.style.setProperty(prop,'0px');});
var probe=document.createElement('div');probe.style.cssText='position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px';probe.appendChild(document.createElement('div'));probe.appendChild(document.createElement('div'));document.body.appendChild(probe);
var flexGap=probe.scrollHeight===1&&!window.FLOWER_FORCE_LEGACY;probe.parentNode.removeChild(probe);
function legacyLayout(){
  if(flexGap)return;
  Array.from(document.querySelectorAll('#app *')).forEach(function(node){
    var style=getComputedStyle(node);if(style.display!=='flex'&&style.display!=='inline-flex')return;
    var gap=style.getPropertyValue('--legacy-gap').trim();if(!gap||gap==='0px')return;
    var parts=gap.split(/\\s+/),vertical=style.flexDirection.indexOf('column')===0;
    node.style.gap='0px';Array.from(node.children).forEach(function(child,index){child.style[vertical?'marginTop':'marginLeft']=index?(vertical?parts[0]:(parts[1]||parts[0])):'0px';});
  });
}
if(!(window.CSS&&CSS.supports&&CSS.supports('scroll-margin-top','1px'))||window.FLOWER_FORCE_LEGACY){
  Element.prototype.scrollIntoView=function(){var header=document.querySelector('.masthead');window.scrollTo(0,Math.max(0,window.pageYOffset+this.getBoundingClientRect().top-(header?header.getBoundingClientRect().height:0)-16));};
}
function render(){renderBase();legacyLayout();}
`;
const compiled=ts.transpileModule('(function(){\n'+compat+'\n'+engine+'\n'+app+'\n})();',{
  compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.None,ignoreDeprecations:'6.0',removeComments:true},reportDiagnostics:true
});
const errors=(compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
if(errors.length)throw Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>root,getCanonicalFileName:x=>x,getNewLine:()=> '\n'}));
const js=compiled.outputText;
for(const pattern of [/\bfetch\s*\(/,/XMLHttpRequest/,/\bimport\s/,/\bexport\s/,/onclick\s*=/,/target="_blank"/,/\beval\s*\(/,/new Function\s*\(/,/new Worker\s*\(/,/window\.open\s*\(/,/navigator\.clipboard/,/\?\./,/\?\?/])if(pattern.test(js))throw Error('Forbidden package pattern: '+pattern);
await writeFile(join(out,'app.js'),js);
const data=await publicContent();
data.ui.original+=' 离线版保留出处文字，不打开站外网页。';
await writeFile(join(out,'content.js'),'window.FLOWER_CONTENT='+JSON.stringify(data)+';\n');
let css=postcss.parse(await readFile(join(root,'src/style.css'),'utf8'));
const buckets={base:[],components:[],responsive:[]};
css.walkAtRules('layer',rule=>{if(rule.nodes){if(!buckets[rule.params])throw Error('Unknown layer');buckets[rule.params].push(...rule.nodes.map(n=>n.clone()));}rule.remove();});
const flattened=postcss.root();
for(const key of ['base','components','responsive'])flattened.append(buckets[key]);
flattened.append(css.nodes.map(n=>n.clone()));css=flattened;
const declarations=[];css.walkDecls(d=>declarations.push(d));
for(const d of declarations){
  d.value=d.value.replace(/#([\da-f]{8}|[\da-f]{4})(?![\da-f])/gi,(_,hex)=>{
    if(hex.length===4)hex=hex.split('').map(x=>x+x).join('');
    return 'rgba('+[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+(parseInt(hex.slice(6),16)/255).toFixed(4)+')';
  });
  if(d.prop==='gap'){d.cloneBefore({prop:'grid-gap'});d.cloneBefore({prop:'--legacy-gap'});}
  if(/\d+dvh/.test(d.value))d.cloneBefore({value:d.value.replace(/dvh/g,'vh')});
  if(d.value==='clip' && d.prop==='overflow')d.cloneBefore({value:'hidden'});
  if(d.value.startsWith('clamp('))d.cloneBefore({value:d.value.slice(6).split(',')[0]});
  if(d.value.startsWith('min(')){
    const m=d.value.match(/^min\((\d+px),\s*(.*)\)$/);if(!m)throw Error('Missing min() fallback: '+d.toString());
    d.cloneBefore({value:m[2]});if(d.prop==='width')d.cloneBefore({prop:'max-width',value:m[1]});
  }
  if(d.value.includes('max(')&&!d.value.includes('minmax(')){
    if(d.prop!=='padding')throw Error('Missing max() fallback: '+d.toString());
    d.cloneBefore({value:'calc(16px + var(--safe)) 40px 16px'});
  }
  if(d.prop==='inset')for(const side of ['top','right','bottom','left'])d.cloneBefore({prop:side});
  if(['user-select','appearance','backdrop-filter'].includes(d.prop))d.cloneBefore({prop:'-webkit-'+d.prop});
}
css.walkRules(rule=>{if(rule.selector.includes(':focus-visible'))rule.cloneBefore({selector:rule.selector.replace(/:focus-visible/g,':focus')});});
const baseline='*{--legacy-gap:0px}html{touch-action:manipulation}body{-webkit-touch-callout:none}button:focus,a:focus{outline:2px solid #246356;outline-offset:3px}img{max-width:100%}.cast-image img{width:100%}.source-url{word-break:break-all;user-select:text;-webkit-user-select:text;padding:12px;background:#edf0e2;border-radius:8px}';
await writeFile(join(out,'style.css'),baseline+'\n'+css.toString());
let html=await readFile(join(root,'index.html'),'utf8');
html=change(html,'./src/style.css','./style.css');
html=change(html,/<script type="module" src="\.\/src\/app\.mjs"><\/script>/,'<script src="./content.js"></script><script src="./app.js"></script>');
await writeFile(join(out,'index.html'),html);
for(const ch of data.characters)await copyFile(join(root,ch.portrait),join(out,ch.portrait));
for(const size of [32,128,512])await copyFile(join(root,'assets/logo/flower-wolf-'+size+'.png'),join(out,'assets/logo/flower-wolf-'+size+'.png'));
const audit=join(workspace,'.codex/scripts/audit_artifact.mjs');
function runAudit(path){const result=spawnSync(process.execPath,[audit,path],{encoding:'utf8'});if(result.status!==0)throw Error(result.stdout+'\n'+result.stderr);return result.stdout;}
const directoryAudit=runAudit(out);
const zip=new JSZip(),files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const file=join(dir,entry.name);if(entry.isDirectory()){await walk(file);continue;}
  const name=relative(out,file).replaceAll('\\','/');
  if(!['.html','.js','.css','.png','.webp','.svg','.json'].includes(extname(name)))throw Error('Unexpected file: '+name);
  const bytes=await readFile(file);files.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});zip.file(name,bytes);
}}
await walk(out);
const zipName='flower-werewolf-xiaohongshu-v1.1.0.zip';
const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}});
await writeFile(join(release,zipName),bytes);
const zipAudit=runAudit(join(release,zipName));
await writeFile(join(release,'package-manifest.json'),JSON.stringify({title:data.product.workingTitle,skill:'minitool-zip-builder 1.6.0',zip:zipName,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),entry:'index.html',compiler:'Existing workspace TypeScript, ES2017 classic IIFE',files,limitations:['Chrome 61 / Android 8.1 not tested on physical device','Optional source URLs are displayed as text only','Runtime performance on physical devices not measured']},null,2));
await writeFile(join(release,'skill-audit.txt'),directoryAudit+'\n'+zipAudit);
console.log(JSON.stringify({zip:join(release,zipName),bytes:bytes.length,files:files.length,skillAudit:'passed'},null,2));
