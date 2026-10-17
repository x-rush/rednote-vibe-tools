import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const upstream=join(root,'.upstream');
const commit=execFileSync('git',['-C',upstream,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(commit,'5f210ca953b7b538c042ad8515d5c355b766a194','Upstream changed: review and explicitly pin a new version before importing.');
const read=path=>readFile(join(upstream,path),'utf8');
const readme=await read('README.md');
const paths=[...new Set([...readme.matchAll(/\]\((book\/[^)]+\.md)\)/g)].map(m=>m[1]))].sort();
const sections=[],unparsed=[],hashes={};
for(const path of paths){
  const markdown=await read(path);hashes[path]=createHash('sha256').update(markdown).digest('hex');
  let section=null,entry=null;
  for(const raw of markdown.split(/\r?\n/)){
    const line=raw.trimEnd();let m;
    if((m=/^#{1,2} (\d+)\. (.+)$/.exec(line))){section={n:m[1],title:m[2].trim(),path,intro:[],entries:[]};sections.push(section);entry=null;continue;}
    if(/^#{1,2} /.test(line)){section=null;entry=null;continue;}
    if(!section)continue;
    if((m=/^### (\d+)\. (.+)$/.exec(line))){
      entry={id:section.n+'-'+m[1],sec:section.n,n:m[1],title:m[2].trim(),cost:'',human:'',gain:'',grade:'',gradeText:'',src:'',note:'',money:'',time:'',will:'',level:'',lens:'',who:[]};section.entries.push(entry);continue;
    }
    if((m=/^<!--\s*成本标签:\s*(.*?)\s*-->/.exec(line))&&entry){
      const keys={'钱':'money','时间':'time','毅力':'will','收益':'level','口径':'lens'};
      for(const pair of m[1].split(/\s+/)){const [k,v]=pair.split('=');if(keys[k])entry[keys[k]]=v;else if(k==='人群')entry.who=v.split(',').map(g=>g.split('+'));else unparsed.push({path,line});}continue;
    }
    if(entry){
      const keys={'成本':'cost','说人话':'human','收益':'gain','证据等级':'gradeText','来源':'src','备注':'note'};
      if((m=/^- (成本|说人话|收益|证据等级|来源|备注)：(.*)$/.exec(line))){const k=keys[m[1]];assert.equal(entry[k],'','Duplicate field '+entry.id+' '+k);entry[k]=m[2];if(k==='gradeText')entry.grade=(/^\s*([ABC])/.exec(m[2])||[])[1]||'';}
      else if(line.trim()&&!/^---+$/.test(line.trim())&&!/^<!--.*-->$/.test(line.trim()))unparsed.push({path,entry:entry.id,line});
    }else if(line)section.intro.push(line);
  }
}
assert.equal(unparsed.length,0,JSON.stringify(unparsed.slice(0,10)));
const entries=sections.flatMap(s=>s.entries);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
const advertised=Number((/(\d+) 条建议/.exec(readme)||[])[1]);assert.equal(entries.length,advertised,'README count differs');
for(const e of entries)for(const k of ['title','cost','gain','grade','src'])assert.ok(e[k],e.id+' missing '+k);
const glossary=[];const glossaryBlock=(/^## 读懂数字[^\n]*\n([\s\S]*?)(?=^## )/m.exec(readme)||[])[1]||'';
for(const line of glossaryBlock.split(/\r?\n/)){const m=/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/.exec(line);if(!m||m[1]==='术语'||/^-+$/.test(m[1]))continue;for(const t of m[1].split('、'))glossary.push({term:t.trim(),meaning:m[2]});}
const docPaths=[...new Set([...readme.matchAll(/\]\((docs\/[^)#]+\.md)(?:#[^)]*)?\)/g)].map(m=>m[1]))].sort();
const documents=[];for(const path of docPaths){const markdown=await read(path);documents.push({path,title:(/^# (.+)$/m.exec(markdown)||[])[1]||path,markdown});hashes[path]=createHash('sha256').update(markdown).digest('hex');}
const updates=JSON.parse(await read('updates.json'));
const filters=[
  ['who','我的情况',[['怀孕','怀孕或备孕'],['婴幼儿','有 3 岁以下孩子'],['孩子','有 3–18 岁孩子'],['老人','家有老人'],['35岁','35 岁以上'],['60岁','60 岁以上'],['女性','女性'],['无','以上都不是']]],
  ['ratio','性价比',[['极高','极高'],['高','高'],['一般','一般']]],
  ['lens','换回什么',[['死亡率','寿命'],['金钱','钱'],['时间','时间精力'],['自由','人身自由']]],
  ['grade','证据等级',[['A','A 级'],['B','B 级'],['C','C 级']]],
  ['money','花钱',[['0','不花钱'],['少','少'],['多','多']]],
  ['time','花时间',[['少','顺手'],['中','几小时'],['多','每天占用']]],
  ['will','要毅力',[['否','不用'],['些','一点'],['是','很多']]],
  ['upd','最近更新',[['新增','新增'],['改过','改过']]],
  ['days','时间范围',[['7','7 天内'],['30','30 天内']]]
].map(([key,title,options])=>({key,title,options:options.map(([value,label])=>({value,label}))}));
const content={meta:{schemaVersion:1,appName:'小猫的生活指南',shortDescription:'陪你把日子过得更好',icon:'assets/app-icon.png',title:'高性价比人生指南',shortTitle:'人生指南',sourceUrl:'https://github.com/eternity4719/HowToLiveBetter',sourceCommit:commit,sourceDate:execFileSync('git',['-C',upstream,'show','-s','--format=%cs','HEAD'],{encoding:'utf8'}).trim(),entryCount:entries.length,sectionCount:sections.length,author:'eternity4719',license:'CC BY 4.0',adaptation:'本工具为移动端离线改编，重新排版并适配搜索与筛选。正文及原始出处保留。'},filters,sections,glossary,documents,updates,readme,licenses:{content:await read('LICENSE'),code:await read('LICENSE-CODE')}};
await mkdir(join(root,'src/content'),{recursive:true});await mkdir(join(root,'release'),{recursive:true});await mkdir(join(root,'reference'),{recursive:true});
await writeFile(join(root,'src/content/content.json'),JSON.stringify(content));
await copyFile(join(upstream,'LICENSE'),join(root,'reference/LICENSE'));await copyFile(join(upstream,'LICENSE-CODE'),join(root,'reference/LICENSE-CODE'));
const index=await read('index.html');
// Reviewed upstream parser is retained only for build-time parity tests; never executed by the tool.
const parser=index.slice(index.indexOf('function parseReadme(md){'),index.indexOf('/* ---------- 术语表'));
await writeFile(join(root,'reference/upstream-parser.js'),"// Upstream MIT; see LICENSE-CODE. Commit "+commit+"\nconst COST_W = { money:{'0':0,'少':1,'多':2}, time:{'少':0,'中':1,'多':2}, will:{'否':0,'些':1,'是':2} };\n"+parser);
const report={commit,sections:sections.length,entries:entries.length,documents:documents.length,glossary:glossary.length,updates:Object.keys(updates.items||{}).length,unparsed,hashes};
await writeFile(join(root,'release/import-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,hashes:undefined},null,2));
