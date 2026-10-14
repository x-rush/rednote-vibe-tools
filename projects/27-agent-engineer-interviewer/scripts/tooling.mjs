import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {zip,auditZip} from './archive.mjs';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const readContent=()=>JSON.parse(readFileSync(join(root,'src/content/content.json'),'utf8'));
export function validate(c){
const errors=[],check=(yes,msg)=>{if(!yes)errors.push(msg);},ids=Array.from({length:8},(_,i)=>'E0'+(i+1));
check(c.productName==='Agent 工程师面试官'&&c.contentVersion==='2.1.0','产品/版本不匹配');
check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.skillName)&&c.skillName.length<=64,'Skill名称无效');
check(c.skill.description&&c.skill.description.length<=1024&&!/[<>]/.test(c.skill.description),'描述无效');
check(c.questions.length===30&&new Set(c.questions.map(q=>q.id)).size===30,'题号重复或数量不符');
check(JSON.stringify(c.groups.map(g=>g.id))===JSON.stringify(ids),'八能力不完整');
check(JSON.stringify(c.modes.map(m=>m.id))===JSON.stringify(['teaching','formal','project']),'三模式不完整');
for(const id of ids)check(c.questions.filter(q=>q.capabilityId===id).length>=3,`能力覆盖不足${id}`);
for(const q of c.questions){
check(/^Q\d{2}$/.test(q.id)&&ids.includes(q.capabilityId)&&q.group===q.capabilityId,`题号/能力映射错误${q.id}`);
check(q.context&&q.question&&q.prerequisites&&q.minimumAnswer,`场景/最低合格缺失${q.id}`);
check(q.referenceAnswer?.text?.length>=350,`参考解法缺失${q.id}`);
check(q.acceptableAlternatives?.length&&q.wrongAnswers?.length&&q.wrongAnswers.every(x=>x.answer&&x.why),`替代/错误解释缺失${q.id}`);
check(q.followups?.length>=2&&q.followups.every(x=>x.when&&x.ask&&x.expectedEvidence),`条件追问缺失${q.id}`);
check(c.levels.every(l=>q.anchors[l]),`锚点缺失${q.id}`);
check(q.practice.capabilityId===q.capabilityId&&q.practice.moduleId===q.capabilityId&&q.practice.task&&q.practice.acceptance,`补练映射错误${q.id}`);
for(const s of [...(q.referenceAnswer?.sourceIds||[]),...(q.correction?.sourceIds||[])])check(c.sources.some(x=>x.id===s&&x.capabilityIds.includes(q.capabilityId)&&x.checkedAt),`来源映射失效${q.id}:${s}`);
check(q.variants?.length>=1&&q.variants.every(v=>v.id.startsWith(q.id+'-')&&v.question!==q.question&&v.expectedEvidence),`变式失效${q.id}`);
check(q.examples?.length>=1&&q.examples.every(e=>e.status==='illustrative_not_executed'&&e.body),`示例证据状态错误${q.id}`);
}
for(const s of c.sources)check(s.url.startsWith('https://')&&s.checkedAt&&s.capabilityIds.every(id=>ids.includes(id)),`来源无效${s.id}`);
check(c.interface.input.schema==='agent-engineer-learning-summary/1'&&c.interface.output.schema==='agent-engineer-interview-report/1','摘要协议错误');
check(c.blueprints.plans.every(p=>p.ids.every(id=>c.questions.some(q=>q.id===id))),'蓝图含未知题号');
if(errors.length)throw Error(errors.join('\n'));return ids;
}
export function inspectSummary(raw){
const issues=[],known=new Set(Array.from({length:8},(_,i)=>'E0'+(i+1))),modules=[];
if(!raw||raw.schema!=='agent-engineer-learning-summary/1')return {accepted:false,issues:['请重新导出当前摘要'],modules:[],projects:[]};
for(const x of Array.isArray(raw.modules)?raw.modules:[]){
if(!known.has(x?.capabilityId)){issues.push('未知能力ID');continue;}
const m={capabilityId:x.capabilityId,source:'self_report'};if(typeof x.read==='boolean')m.read=x.read;
const q=x.quiz;if(q&&Number.isInteger(q.attempted)&&Number.isInteger(q.correct)&&q.attempted>=0&&q.correct>=0&&q.correct<=q.attempted)m.quiz={attempted:q.attempted,correct:q.correct};else if(q)issues.push('题量无效');
const e=x.experiments;if(e&&['independent','assisted'].every(k=>Number.isInteger(e[k])&&e[k]>=0))m.experiments={independent:e.independent,assisted:e.assisted};else if(e)issues.push('实验记录无效');modules.push(m);
}
const text=x=>typeof x==='string'?x.slice(0,2000):'';
const textList=x=>(Array.isArray(x)?x:typeof x==='string'&&x.trim()?[x]:[]).slice(0,30).map(text);
const projects=(Array.isArray(raw.projects)?raw.projects:[]).slice(0,10).filter(p=>p&&typeof p==='object').map(p=>({id:text(p.id),title:text(p.title),evidenceStatus:'self_report',features:textList(p.features),failures:textList(p.failures),evaluation:text(p.evaluation),limitations:text(p.limitations)}));
const training={};
if(raw.training&&typeof raw.training==='object')for(const kind of ['diagnostics','workflows','execution']){
const fields=kind==='diagnostics'?['correct','reviewed','assisted']:kind==='workflows'?['completed','assisted']:['completed'];
training[kind]=(Array.isArray(raw.training[kind])?raw.training[kind]:[]).slice(0,100).flatMap(x=>{
if(!x||typeof x.id!=='string')return [];
if(kind!=='execution'&&!known.has(x.capabilityId)){issues.push('训练记录未知能力ID');return [];}
const entry={id:text(x.id),source:'self_report',evidenceType:'teaching_simulation'};
if(kind!=='execution')entry.capabilityId=x.capabilityId;
for(const k of fields)if(typeof x[k]==='boolean')entry[k]=x[k];
return [entry];});}
return {accepted:true,contentVersion:text(raw.contentVersion),source:'self_report',modules,framework:text(raw.framework),projects,training,weaknesses:(Array.isArray(raw.weaknesses)?raw.weaknesses:[]).filter(x=>known.has(x?.capabilityId)).map(x=>({capabilityId:x.capabilityId,note:text(x.note||x.recommendation)})),issues};
}
const bullets=a=>a.map(x=>'- '+x).join('\n');
export function render(c){
validate(c);const f={},links=ids=>ids.map(id=>{const s=c.sources.find(s=>s.id===id);return `[${s.title}](${s.url})（核验 ${s.checkedAt}）`;}).join('、');
f['SKILL.md']=`---\nname: ${c.skillName}\ndescription: ${c.skill.description}\n---\n\n# ${c.productName}\n\n内容版本 ${c.contentVersion}；目标 ${c.audience}。\n\n${c.skill.instructions.map((x,i)=>`${i+1}. ${x}`).join('\n\n')}\n\n通用SKILL.md标准包；尚未验证小红书导入，没有安装或发布。\n`;
f['references/protocol.md']=`# 模式与会话控制\n\n${c.modes.map(m=>`## ${m.title}\n\n预计主问题${m.targetQuestions}；${m.rule}`).join('\n\n')}\n\n## 选题\n\n${c.protocol.selection}\n\n## 项目\n\n${c.protocol.project}\n\n## 控制\n\n${c.protocol.controls.map(x=>`- ${x.command}：${x.effect}`).join('\n')}\n\n## 证据\n\n${c.protocol.evidence}\n\n## 教学解答\n\n${c.protocol.answering}\n`;
for(const g of c.groups){const qs=c.questions.filter(q=>q.capabilityId===g.id);
f[`references/questions-${g.id}.md`]=`# ${g.id} ${g.title}\n\n正式提问仅展示场景和问题，锚点用于内部校准。\n\n`+qs.map(q=>`## ${q.id} ${q.title}\n\n能力 ${q.capabilityId}；前提：${q.prerequisites}\n\n场景：${q.context}\n\n问题：${q.question}\n\n${q.followups.map(x=>`- 若${x.when}：${x.ask}\n  - 期待证据：${x.expectedEvidence}`).join('\n')}\n\n最低合格：${q.minimumAnswer}\n\n${c.levels.map(l=>`- ${l}：${q.anchors[l]}`).join('\n')}\n\n${q.variants.map(v=>`### ${v.id}\n\n${v.context}\n\n${v.question}\n\n期待证据：${v.expectedEvidence}`).join('\n\n')}\n\n课程补练 ${q.practice.moduleId}：${q.practice.task}\n\n验收：${q.practice.acceptance}\n\n来源：${links(q.correction.sourceIds)}\n\n讲解读[解法](answers-${g.id}.md)。\n`).join('\n');
f[`references/answers-${g.id}.md`]=`# ${g.id} 解法与教学示例\n\n`+qs.map(q=>`## ${q.id} ${q.title}\n\n${q.context}\n\n### 最低合格\n\n${q.minimumAnswer}\n\n### 完整参考解法\n\n${q.referenceAnswer.text}\n\n### 关键点\n\n${bullets(q.keyPoints)}\n\n### 可接受替代\n\n${bullets(q.acceptableAlternatives)}\n\n### 常见错误\n\n${q.wrongAnswers.map(w=>`- ${w.answer}\n  - 原因：${w.why}`).join('\n')}\n\n### 未运行示例\n\n${q.examples.map(e=>`\`\`\`${e.type==='text'?'':e.type}\n${e.body}\n\`\`\`\n\n状态 ${e.status}`).join('\n\n')}\n\n### 来源\n\n${links(q.referenceAnswer.sourceIds)}。解法为原创综合，不是公司真题或官方逐字答案。\n`).join('\n');
}
f['references/rubric.md']=c.rubricDocument;
f['references/interface.md']=`# 学习摘要与补练协议\n\n${bullets(c.interface.rules)}\n\n## 输入示例（虚构）\n\n\`\`\`json\n${JSON.stringify(c.interface.input,null,2)}\n\`\`\`\n\n## 报告模板\n\n\`\`\`json\n${JSON.stringify(c.interface.output,null,2)}\n\`\`\`\n\n## 提示后未答\n\n\`\`\`json\n${JSON.stringify(c.interface.hintOnlyExample,null,2)}\n\`\`\`\n\n## 可复制补练文本\n\n${c.interface.practiceText}\n\n## 课程映射\n\n${c.groups.map(g=>`- ${g.id}：${g.title}`).join('\n')}\n`;
f['references/blueprints.md']=`# 岗位画像与选题蓝图\n\n${c.researchBoundary}\n\n${c.blueprints.roleProfiles.map(p=>`## ${p.name}\n\n${p.focus}\n\n${p.expected}`).join('\n\n')}\n\n${c.blueprints.plans.map(p=>`## ${p.name}\n\n${p.ids.map((id,i)=>`- ${id}：${p.types[i]}`).join('\n')}\n\n${p.followup}`).join('\n\n')}\n\n${c.blueprints.instruction}\n`;
f['references/stack-routes.md']=`# 技术路线\n\n学习推荐不是全球使用率排名或录用门槛。\n\n${c.stackRoutes.map(r=>`## ${r.name}\n\n${r.role}\n\n${links(r.sourceIds)}`).join('\n\n')}\n`;
f['references/research.md']=`# 来源与适用边界\n\n${c.researchBoundary}\n\n${c.recruitmentSamples.map(s=>`- [${s.title}](${s.url})；发布 ${s.publishedAt||'未注明'}；核查 ${s.checkedAt}。${s.summary}`).join('\n\n')}\n\n${c.sources.map(s=>`- ${s.id}：[${s.title}](${s.url})；核验 ${s.checkedAt}；能力 ${s.capabilityIds.join('、')||'技术路线'}。${s.note}`).join('\n\n')}\n\n版本性结论运行时核实；无工具说明未核实。\n`;
f['PRD.md']=`# ${c.productName}\n\n${c.prd.goal}\n\n版本 ${c.contentVersion}\n\n${c.modes.map(m=>`- ${m.title}：${m.rule}`).join('\n')}\n\n验收：\n\n${bullets(c.prd.acceptance)}\n`;
f['RESEARCH.md']=f['references/research.md'];f['VALIDATION.md']=`# 验证与交付状态\n\n${c.validation.scope}\n\n命令和试跑见QA-BEHAVIOR.md及validation-results.json。只生成标准技能包；未安装、未发布、未通过小红书导入验证。\n\n${bullets(c.validation.limitations)}\n`;return f;
}
export function build(){
const c=readContent(),f=render(c),pack=Object.fromEntries(Object.entries(f).filter(([p])=>p==='SKILL.md'||p.startsWith('references/'))),ref=join(root,'references');mkdirSync(ref,{recursive:true});
for(const p of readdirSync(ref))if(p.endsWith('.md')&&!f['references/'+p])rmSync(join(ref,p));
const distRoot=resolve(root,'dist/agent-engineer-interviewer'),contained=relative(root,distRoot);if(!contained||contained.startsWith('..')||isAbsolute(contained))throw Error('Unsafe build target');if(existsSync(distRoot))rmSync(distRoot,{recursive:true});
for(const [p,body]of Object.entries(f)){const targets=p==='SKILL.md'||p.startsWith('references/')?[join(root,p),join(distRoot,p)]:[join(root,p)];for(const t of targets){mkdirSync(dirname(t),{recursive:true});writeFileSync(t,body);}}
pack['manifest.json']=JSON.stringify({productName:c.productName,contentVersion:c.contentVersion,format:'generic-SKILL.md',platformVerified:false,files:Object.keys(pack)},null,2);writeFileSync(join(distRoot,'manifest.json'),pack['manifest.json']);const bytes=zip(pack);auditZip(bytes);
for(const p of readdirSync(join(root,'dist')))if(/^agent-engineer-interviewer-.*\.zip$/.test(p))rmSync(join(root,'dist',p));writeFileSync(join(root,`dist/agent-engineer-interviewer-${c.contentVersion}.zip`),bytes);console.log(`Built ${Object.keys(f).length} documents; audited ${Object.keys(pack).length} entries (${bytes.length} bytes). Generic skill only.`);
}
export function lint(){const f=render(readContent());for(const [p,body]of Object.entries(f))for(const m of body.matchAll(/\]\(([^)]+)\)/g)){if(m[1].startsWith('https://'))continue;const target=resolve(dirname(join(root,p)),m[1]);if(!existsSync(target)&&!Object.keys(f).some(k=>join(root,k)===target))throw Error('Broken reference '+p+': '+m[1]);}console.log('Lint: 30 scenarios, 8 abilities, 3 modes, answers, sources and local links valid.');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv[2]==='build')build();else if(process.argv[2]==='lint')lint();else throw Error('Expected lint or build');}
