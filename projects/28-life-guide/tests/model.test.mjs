import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const root=new URL('../',import.meta.url),content=JSON.parse(await readFile(new URL('src/content/content.json',root),'utf8'));
const ctx={window:{}};vm.runInNewContext(await readFile(new URL('src/model.js',root),'utf8'),ctx);const M=ctx.window.LifeModel,list=M.prepare(content),plain=v=>JSON.parse(JSON.stringify(v));
test('all imported entries equal original parser fields and computed metadata',async()=>{
  const original={};vm.createContext(original);vm.runInContext(await readFile(new URL('reference/upstream-parser.js',root),'utf8')+'\nthis.parse=parseReadme;',original);
  // The normalized source retains every upstream field; reconstructing Markdown also checks tag preservation.
  const markdown=content.sections.map(s=>'# '+s.n+'. '+s.title+'\n'+s.intro.join('\n')+'\n'+s.entries.map(e=>'### '+e.n+'. '+e.title+'\n<!-- 成本标签: 钱='+e.money+' 时间='+e.time+' 毅力='+e.will+' 收益='+e.level+' 口径='+e.lens+(e.who.length?' 人群='+e.who.map(g=>g.join('+')).join(','):'')+' -->\n'+[['成本',e.cost],['说人话',e.human],['收益',e.gain],['证据等级',e.gradeText],['来源',e.src],['备注',e.note]].map(([k,v])=>'- '+k+'：'+v).join('\n')).join('\n')).join('\n');
  const parsed=original.parse(markdown).flatMap(s=>s.entries);assert.equal(parsed.length,content.meta.entryCount);
  list.forEach((e,i)=>{for(const k of ['sec','n','title','cost','human','gain','grade','src','note','money','time','will','level','lens','who','ratio','dispute','todo','hay'])assert.deepEqual(plain(e[k]),plain(parsed[i][k]),e.id+' '+k);});
});
test('imported fields equal parser output on actual pinned upstream Markdown when checkout is present',async t=>{
  let source;try{source=await Promise.all(content.sections.map(s=>readFile(new URL('.upstream/'+s.path,root),'utf8')));}catch(error){if(error.code==='ENOENT'){t.skip('Optional pinned upstream checkout absent; offline canonical parser parity still runs.');return;}throw error;}
  const original={};vm.createContext(original);vm.runInContext(await readFile(new URL('reference/upstream-parser.js',root),'utf8')+'\nthis.parse=parseReadme;',original);const parsed=original.parse(source.join('\n\n')).flatMap(s=>s.entries);
  list.forEach((e,i)=>{for(const k of ['title','cost','human','gain','src','note','money','time','will','level','lens','who','ratio','hay'])assert.deepEqual(plain(e[k]),plain(parsed[i][k]),e.id+' '+k);});
});
test('filter combinations preserve upstream AND/OR and source search',()=>{
  let seed=17;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<180;i++){const s=M.empty();for(const f of content.filters)for(const o of f.options)if(random()<0.12)M.toggle(s,f.key,o.value);if(i%4===0)s.q=['安全','WHO','时间','A'][i%4];if(i%5===0)s.dispute=true;
    const has=v=>s.who.includes(v)||(v==='35岁'&&s.who.includes('60岁'));
    const expected=list.filter(e=>['sec','ratio','lens','grade','money','time','will'].every(k=>!s[k].length||s[k].includes(e[k]))&&(!s.who.length||!e.who.length||e.who.some(g=>g.every(has)))&&(!s.dispute||e.dispute)&&(!s.todo||e.todo)&&(!s.upd.length&&!s.days.length||(e.update&&(!s.upd.length||s.upd.includes(e.update.kind))&&(!s.days.length||(Date.UTC(2026,9,17)-Date.parse(e.update.date))/86400000<=Number(s.days[0]))))&&s.q.toLowerCase().split(/\s+/).filter(Boolean).every(t=>e.hay.includes(t))).map(e=>e.id);
    assert.deepEqual(plain(M.query(list,s,new Date(2026,9,17)).entries.map(e=>e.id)),plain(expected));
  }
});
test('audience combinations, inheritance and universal entries',()=>{const e={who:[['女性','35岁'],['老人']],hay:'',sec:'1'};let s=M.empty();s.who=['女性'];assert.equal(M.fits(e,s),false);s.who=['女性','60岁'];assert.equal(M.fits(e,s),true);s.who=['老人'];assert.equal(M.fits(e,s),true);s.who=['无'];assert.equal(M.fits(e,s),false);e.who=[];assert.equal(M.fits(e,s),true);});
test('chapter counts ignore selected chapter and search requires every term',()=>{const s=M.empty();s.sec=['1'];const r=M.query(list,s);assert.equal(r.total,list.length);assert.ok(r.counts['2']>0);s.q='系安全带 NHTSA';assert.ok(M.query(list,s).entries.some(e=>e.id==='1-1'));s.q+=' 不存在的词987';assert.equal(M.query(list,s).entries.length,0);});
test('normalize hostile storage, mismatched version and toggle exclusivity',()=>{const s=M.normalize({q:'x'.repeat(300),who:['无','女性'],days:['30','7'],sec:['1','2'],grade:['D','A'],todo:'true'},content);assert.equal(s.q.length,240);assert.deepEqual(plain(s.who),['无']);assert.deepEqual(plain(s.grade),['A']);assert.equal(s.todo,false);M.toggle(s,'who','女性');assert.deepEqual(plain(s.who),['女性']);M.toggle(s,'who','无');assert.deepEqual(plain(s.who),['无']);assert.equal(M.stored({schemaVersion:1,contentVersion:'old',reading:{entryId:'1-1'}},content).reading,null);});
