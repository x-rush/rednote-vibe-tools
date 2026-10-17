import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const content=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8'));
const context={window:{}};vm.runInNewContext(await readFile(new URL('../src/model.js',import.meta.url),'utf8'),context);const M=context.window.LifeModel,list=M.prepare(content),plain=v=>JSON.parse(JSON.stringify(v));
test('reader defaults to one complete chapter and has real previous/next boundaries',()=>{
  const first=M.readerView(list,M.empty(),content.sections,'1');assert.equal(first.chapter,'1');assert.equal(first.previous,null);assert.equal(first.next,'2');assert.equal(first.total,765);assert.equal(first.entries.length,content.sections[0].entries.length);assert.ok(first.entries.every(e=>e.sec==='1'));
  const last=M.readerView(list,M.empty(),content.sections,'34');assert.equal(last.next,null);assert.equal(last.previous,'33');assert.ok(last.entries.every(e=>e.sec==='34'));
});
test('filtered chapters retain all matching entries once and skip empty chapters',()=>{
  const state=M.empty();state.q='NHTSA';const expected=M.query(list,state).entries,chapters=content.sections.map(s=>s.n).filter(id=>expected.some(e=>e.sec===id));assert.deepEqual(chapters,['1','20']);let ids=[];
  for(let i=0;i<chapters.length;i++){const view=M.readerView(list,state,content.sections,chapters[i]);assert.equal(view.previous,chapters[i-1]||null);assert.equal(view.next,chapters[i+1]||null);ids.push(...view.entries.map(e=>e.id));assert.equal(view.total,expected.length);}
  assert.deepEqual(ids,plain(expected.map(e=>e.id)));const fallback=M.readerView(list,state,content.sections,'34');assert.equal(fallback.chapter,chapters[0]);
});
test('chapter restriction is independent of current reading chapter and empty query is navigable',()=>{
  const s=M.empty();s.sec=['9'];let view=M.readerView(list,s,content.sections,'1');assert.equal(view.chapter,'9');assert.equal(view.previous,null);assert.equal(view.next,null);s.q='不存在的词987654';view=M.readerView(list,s,content.sections,'9');assert.equal(view.chapter,'9');assert.equal(view.entries.length,0);assert.equal(view.next,null);
});
test('reading chapter survives reload and old storage migrates from entry/section',()=>{
  const same={schemaVersion:1,contentVersion:content.meta.sourceCommit,chapterId:'34',reading:{entryId:'34-1',offsetWithinEntry:30}};assert.equal(M.stored(same,content).chapterId,'34');
  delete same.chapterId;assert.equal(M.stored(same,content).chapterId,'34');same.reading=null;same.filters={sec:['6']};assert.equal(M.stored(same,content).chapterId,'6');assert.deepEqual(plain(M.stored(same,content).filters.sec),[],'Legacy directory selection must not disable next chapter');same.chapterId='6';assert.deepEqual(plain(M.stored(same,content).filters.sec),['6'],'New explicit chapter filter must stay');same.chapterId='999';same.filters={};assert.equal(M.stored(same,content).chapterId,'1');
});
test('screen checkpoint stores page and text anchor but discards hostile values',()=>{
  const raw={schemaVersion:1,contentVersion:content.meta.sourceCommit,chapterId:'2',reading:{entryId:'2-1',pageIndex:9,pageLayout:'354x509:16px',textOffset:125}};let s=M.stored(raw,content);assert.equal(s.reading.pageIndex,9);assert.equal(s.reading.textOffset,125);assert.equal(s.reading.pageLayout,'354x509:16px');raw.reading.pageIndex=Infinity;raw.reading.textOffset=-10;s=M.stored(raw,content);assert.equal(s.reading.pageIndex,undefined);assert.equal(s.reading.textOffset,0);
});

test('chapter scroll checkpoint retains exact local offset with a layout key',()=>{
  const raw={schemaVersion:1,contentVersion:content.meta.sourceCommit,chapterId:'6',reading:{entryId:'6-2',readerMode:'chapter-scroll',scrollY:2088,scrollLayout:'390:16px:151',textOffset:120}};
  let s=M.stored(raw,content);assert.equal(s.reading.scrollY,2088);assert.equal(s.reading.scrollLayout,'390:16px:151');assert.equal(s.reading.readerMode,'chapter-scroll');assert.equal(s.reading.textOffset,120);
  raw.reading.scrollY=-10;raw.reading.scrollLayout='a'.repeat(200);s=M.stored(raw,content);assert.equal(s.reading.scrollY,0);assert.equal(s.reading.scrollLayout.length,100);
});

test('reading view survives reentry while explicit home keeps the full cover',()=>{
  const raw={schemaVersion:1,contentVersion:content.meta.sourceCommit,chapterId:'2',readerView:'reading',reading:{entryId:'2-1',readerMode:'chapter-scroll',scrollY:12,textOffset:0}};
  assert.equal(M.stored(raw,content).readerView,'reading');raw.readerView='home';assert.equal(M.stored(raw,content).readerView,'home');delete raw.readerView;assert.equal(M.stored(raw,content).readerView,'reading');raw.contentVersion='old';assert.equal(M.stored(raw,content).readerView,'home');assert.equal(M.stored(null,content).readerView,'home');
});

test('first visit and a legacy chapter-start placeholder stay on the home banner',()=>{
  assert.equal(M.hasReadingProgress(M.stored(null,content),content),false);
  const raw={schemaVersion:1,contentVersion:content.meta.sourceCommit,chapterId:'1',reading:{entryId:'1-1',offsetWithinEntry:0}};
  assert.equal(M.hasReadingProgress(M.stored(raw,content),content),false);
  raw.reading.offsetWithinEntry=90;assert.equal(M.hasReadingProgress(M.stored(raw,content),content),true);
  raw.readerView='reading';raw.reading.offsetWithinEntry=0;assert.equal(M.hasReadingProgress(M.stored(raw,content),content),true);
  raw.readerView='home';raw.reading.readerMode='chapter-scroll';raw.reading.scrollY=0;assert.equal(M.hasReadingProgress(M.stored(raw,content),content),false);
  raw.reading.scrollY=600;assert.equal(M.hasReadingProgress(M.stored(raw,content),content),true);
});
