(function(){
  'use strict';
  var C=window.LIFE_CONTENT,M=window.LifeModel,R=window.LifeRender,S=window.LifeStorage;
  var $=function(id){return document.getElementById(id);},list=M.prepare(C),entryById={},sectionById={},state=M.empty(),saved,results=[],chapterId=C.sections[0].n,view=null;
  var draft=null,panel=null,panelStack=[],focusBefore=null,trail=[],loading=false,restoring=true,searchTimer,toastTimer,writingWarned=false,composing=false,resizeTimer;
  var reader=new window.LifeChapterReader($('reader-content'),$('toolbar')),scrollFrame=false,saveTimer,readingView=false;
  if(window.history&&'scrollRestoration' in window.history)window.history.scrollRestoration='manual';
  document.querySelectorAll('button,input').forEach(function(el){el.disabled=true;});
  list.forEach(function(e){entryById[e.id]=e;});C.sections.forEach(function(s){sectionById[s.n]=s;});R.init(C,list);
  function make(tag,cls,text){return R.node(tag,cls,text);}
  function btn(text,action,value,cls){return R.button(text,action,value,cls);}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').hidden=true;},4200);}
  function settings(){var p=saved.preferences,dark=p.theme==='dark'||(p.theme==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',!!dark);document.documentElement.style.setProperty('--font-size',p.fontSize+'px');}
  function currentPosition(){return results.length?reader.snapshot():null;}
  function persist(position){if(!saved||loading)return;saved.filters=M.clone(state);saved.chapterId=chapterId;saved.readerView=readingView?'reading':'home';saved.savedAt=Date.now();if(position)saved.reading=position;S.write(saved).then(function(ok){if(!ok&&!writingWarned){writingWarned=true;toast('设置未能保存在本机，本次阅读与筛选仍可正常使用。');}});}
  function filterBadges(){
    var target=$('active-filters');target.textContent='';var count=0;
    C.filters.forEach(function(f){state[f.key].forEach(function(v){var option=f.options.filter(function(o){return o.value===v;})[0];if(option){var b=btn(option.label+' ×','remove-filter',f.key+':'+v);b.setAttribute('aria-label','移除筛选：'+option.label);target.appendChild(b);count++;}});});
    ['dispute','todo'].forEach(function(k){if(state[k]){target.appendChild(btn((k==='dispute'?'有争议':'待核实')+' ×','remove-flag',k));count++;}});
    if(state.sec.length){target.appendChild(btn('仅第 '+state.sec[0]+' 章 ×','remove-filter','sec:'+state.sec[0]));count++;}
    $('filter-count').textContent=String(count);$('filter-count').hidden=!count;$('reset-all').hidden=!count&&!state.q;
    $('chapter-label').textContent='第 '+chapterId+' 章 · '+sectionById[chapterId].title;$('search').value=state.q;$('clear-search').hidden=!state.q;
  }
  function chapterHead(sec){
    var s=sectionById[sec],el=make('section','chapter');el.id='sec-'+sec;var h=make('h2','chapter-title');h.appendChild(make('span','chapter-number',String(sec).padStart(2,'0')));h.appendChild(make('span','',s.title));el.appendChild(h);
    if(s.intro.length)el.appendChild(btn('本章导读 ›','chapter-intro',sec,'chapter-intro-open'));return el;
  }
  function updateReaderProgress(){
    if(!view)return;var percent=results.length?reader.progress():0;
    $('chapter-progress').value=percent;$('reader-location').textContent='第 '+chapterId+' 章 · 已读 '+percent+'%';
    var previous=document.querySelector('.reader-actions [data-action="previous-chapter"]'),next=document.querySelector('.reader-actions [data-action="next-chapter"]');
    previous.disabled=!results.length||!view.previous;next.disabled=!results.length||!view.next;
    previous.setAttribute('aria-label',view.previous?'上一章：'+sectionById[view.previous].title:'已经是第一章');next.setAttribute('aria-label',view.next?'下一章：'+sectionById[view.next].title:'已经是最后一章');
  }
  function chapterNavigation(){
    var end=$('end-note');end.textContent='';end.appendChild(make('p','chapter-end-label','本章阅读完毕'));
    if(view.next){var next=btn('下一章','next-chapter',null,'chapter-next');next.appendChild(make('span','',sectionById[view.next].n+'. '+sectionById[view.next].title));end.appendChild(next);}else end.appendChild(make('p','chapter-finished',view.total===list.length?'你已读到全书最后一章。':'已读到当前筛选结果的最后一章。'));
    var row=make('div','chapter-end-actions');if(view.previous)row.appendChild(btn('‹ 上一章','previous-chapter',null,'outline-button'));row.appendChild(btn('打开目录','chapters',null,'outline-button'));end.appendChild(row);
  }
  function replaceResults(){
    loading=true;R.setTerms(M.terms(state.q));view=M.readerView(list,state,C.sections,chapterId);chapterId=view.chapter;results=view.entries;$('list').textContent='';$('result-count').textContent='匹配 '+view.total+' 条 · 本章 '+results.length+' 条';$('empty').hidden=results.length!==0;$('reader-viewport').hidden=!results.length;filterBadges();chapterNavigation();$('end-note').hidden=!results.length;
    if(results.length){var section=chapterHead(chapterId);results.forEach(function(e){section.appendChild(R.article(e));});$('list').appendChild(section);}layoutReader();loading=false;updateReaderProgress();
  }
  function apply(next){state=M.normalize(next,C);saved.reading=null;replaceResults();if(readingView)chapterStart();else{window.scrollTo(0,0);updateReaderProgress();}persist(currentPosition());}
  function reset(){trail=[];$('reading-notice').hidden=true;apply(M.empty());}
  function layoutReader(position){document.documentElement.style.setProperty('--reader-nav-height',document.querySelector('.bottom-nav').offsetHeight+'px');if(results.length&&position)reader.restore(position);updateReaderProgress();}
  async function positionAt(position){if(!position||!$('e-'+position.entryId))return false;reader.restore(position);updateReaderProgress();return true;}
  function setReading(value){readingView=!!value;document.body.classList.toggle('reading-view',readingView);$('reader-home').hidden=!readingView;}
  function chapterStart(){setReading(true);var title=$('list').querySelector('.chapter-title');window.scrollTo(0,title?Math.max(0,title.getBoundingClientRect().top+window.pageYOffset-reader.top()):0);updateReaderProgress();}
  function goHome(){closeAll();setReading(false);window.scrollTo(0,0);updateReaderProgress();persist(currentPosition());}
  function selectChapter(id){
    if(id&&!sectionById[id])return;var next=M.clone(state);next.sec=[];
    var target=id||M.readerView(list,next,C.sections,C.sections[0].n).chapter;
    if(!M.query(list,next).counts[target]){next=M.empty();toast('本章没有匹配条目，已清空条件并打开完整章节。');}
    state=next;chapterId=target;trail=[];closeAll();trailNotice();replaceResults();saved.reading=null;chapterStart();persist(currentPosition());
  }
  function turnChapter(direction){var target=direction==='next'?view.next:view.previous;if(!target)return;chapterId=target;trail=[];trailNotice();saved.reading=null;replaceResults();chapterStart();persist(currentPosition());}
  function trailNotice(){var el=$('reading-notice');el.textContent='';el.hidden=!trail.length;if(trail.length){el.appendChild(document.createTextNode('正在查看引用的内容。 '));el.appendChild(btn('返回原阅读位置','return-reading',null,'text-button'));}}
  async function gotoTarget(key){
    var sec=key[0]==='s'?key.slice(1):entryById[key]&&entryById[key].sec;if(!sectionById[sec])return;
    trail.push({state:M.clone(state),chapterId:chapterId,readingView:readingView,position:currentPosition()});closeAll();setReading(true);var id=key[0]==='s'?sectionById[sec].entries[0].id:key;
    if(!M.fits(entryById[id],state,new Date())){state=M.empty();toast('目标在当前筛选之外，已临时切换到完整章节。');}
    chapterId=sec;
    replaceResults();trailNotice();layoutReader();if(await positionAt({entryId:id,textOffset:0}))persist(currentPosition());
  }
  async function returnReading(){var previous=trail.pop();if(!previous)return;state=previous.state;chapterId=previous.chapterId;setReading(previous.readingView);replaceResults();trailNotice();layoutReader();if(await positionAt(previous.position))persist(currentPosition());}
  function drawPanel(){
    $('sheet-title').textContent=panel.title;$('sheet-subtitle').textContent=panel.subtitle||'';$('sheet-body').textContent='';$('sheet-body').className='sheet-body'+(panel.reading?' reading-body':'');$('sheet-footer').textContent='';panel.fill($('sheet-body'));if(panel.footer)panel.footer($('sheet-footer'));else $('sheet-footer').appendChild(btn(panelStack.length?'返回上一页':'关闭，继续阅读','close',null,'footer-close'));$('sheet-body').scrollTop=panel.scroll||0;
  }
  function openPanel(p){if(panel){panel.scroll=$('sheet-body').scrollTop;panelStack.push(panel);}else{focusBefore=document.activeElement;panelStack=[];}panel=p;$('overlay').hidden=false;document.body.classList.add('locked');drawPanel();$('sheet').focus();}
  function closeAll(){panel=null;panelStack=[];$('overlay').hidden=true;document.body.classList.remove('locked');if(focusBefore&&document.contains(focusBefore))focusBefore.focus({preventScroll:true});}
  function closePanel(){if(panelStack.length){panel=panelStack.pop();drawPanel();}else closeAll();}
  function buildFilterGroup(target,f){
    var group=make('section','filter-group');group.appendChild(make('h3','',f.title));
    var hints={who:'未选择时不限制；60 岁以上同时符合 35 岁以上。',ratio:'沿用原作者判断，同一收益口径内可比。',lens:'不同收益口径不互相换算。',grade:'A：荟萃分析 / RCT；B：有研究；C：共识。',upd:'只读包内更新记录，不会联网同步。',days:'按今天计算，内容截至 '+C.meta.sourceDate+'。'};
    if(hints[f.key])group.appendChild(make('p','filter-hint',hints[f.key]));var opts=make('div','filter-options');
    f.options.forEach(function(o){var b=btn(o.label,'filter-option',f.key+':'+o.value,'filter-option');b.setAttribute('aria-pressed',String(draft[f.key].indexOf(o.value)!==-1));opts.appendChild(b);});group.appendChild(opts);target.appendChild(group);
  }
  function updateDraftCount(){var n=M.query(list,draft).entries.length;$('apply-filters').textContent='查看结果 · '+n+' 条';}
  function openFilters(){
    draft=M.clone(state);openPanel({title:'完整筛选',subtitle:'同组可多选，不同条件同时满足',fill:function(body){
      var search=make('input','panel-search');search.type='search';search.id='panel-search';search.value=draft.q;search.placeholder='搜索条目、正文、来源';search.setAttribute('aria-label','搜索条目、正文、来源');body.appendChild(search);
      var scope=make('section','filter-group');scope.appendChild(make('h3','','查找范围'));var select=make('select','chapter-scope');select.id='filter-chapter-range';select.setAttribute('aria-label','筛选章节范围');var all=make('option','','全书章节');all.value='';select.appendChild(all);C.sections.forEach(function(s){var option=make('option','',s.n+'. '+s.title);option.value=s.n;select.appendChild(option);});select.value=draft.sec[0]||'';scope.appendChild(select);body.appendChild(scope);
      C.filters.forEach(function(f){buildFilterGroup(body,f);});
      ['dispute','todo'].forEach(function(k){var label=make('label','flag-row'),input=make('input');input.type='checkbox';input.checked=draft[k];input.dataset.flag=k;label.appendChild(input);label.appendChild(document.createTextNode(k==='dispute'?'只看标了争议的':'只看有待核实的'));body.appendChild(label);});
    },footer:function(foot){var row=make('div','footer-actions');row.appendChild(btn('重置','reset-draft',null,'secondary-button'));var applyButton=btn('查看结果','apply-filters',null,'primary-button');applyButton.id='apply-filters';row.appendChild(applyButton);foot.appendChild(row);foot.appendChild(btn('收起筛选，保留原条件','close',null,'footer-close'));updateDraftCount();}});
  }
  function openChapters(){
    var r=M.query(list,state);openPanel({title:'章节目录',subtitle:'点章节开始阅读，点箭头展开条目',fill:function(body){
      var all=btn('从第一章开始 · 全书 '+C.sections.length+' 章','select-chapter','','chapter-choice');body.appendChild(all);
      C.sections.forEach(function(s){var row=make('div','chapter-row'),choose=btn(s.n+'. '+s.title,'select-chapter',s.n,'chapter-choice');choose.setAttribute('aria-pressed',String(chapterId===s.n));choose.appendChild(make('span','chapter-total',(chapterId===s.n?'正在读 · ':'')+(r.counts[s.n]||0)+' 条'));row.appendChild(choose);var fold=btn('⌄','fold-chapter',s.n,'chapter-fold');fold.setAttribute('aria-label','展开第 '+s.n+' 章条目');fold.setAttribute('aria-expanded','false');row.appendChild(fold);body.appendChild(row);var sub=make('div','toc-entries');sub.id='toc-'+s.n;sub.hidden=true;body.appendChild(sub);});
    }});
  }
  function openSettings(){openPanel({title:'阅读设置',subtitle:'偏好与阅读进度保存在本机',fill:function(body){
    var groups=[['正文大小','size',[[16,'标准'],[18,'大字'],[20,'特大']]],['显示主题','theme',[['light','浅色'],['dark','深色'],['system','跟随系统']]]];
    groups.forEach(function(g){var section=make('section','settings-group');section.appendChild(make('h3','',g[0]));var opts=make('div','filter-options');g[2].forEach(function(o){var b=btn(o[1],g[1],o[0],'filter-option'),selected=g[1]==='size'?saved.preferences.fontSize===o[0]:saved.preferences.theme===o[0];b.setAttribute('aria-pressed',String(selected));opts.appendChild(b);});section.appendChild(opts);body.appendChild(section);});
    var section=make('section','settings-group');section.appendChild(make('h3','','阅读与进度'));section.appendChild(make('p','','一章在同一页内上下阅读，读完后点击下一章，直接定位新章标题。每章顶部都保留完整 banner 和小猫插画，向上滑或点击首页即可看到。自动保存章节与章内位置，下次进入继续阅读；回到章首只定位本章标题。'));section.appendChild(btn('回到本章开头','chapter-start',null,'text-button'));body.appendChild(section);
  }});}
  function openAbout(){openPanel({title:'指南说明',subtitle:'完整内容 · 离线查阅 · 本机保存',reading:true,fill:function(body){
    body.appendChild(make('p','','正文来源：'+C.meta.author+' / HowToLiveBetter。'+C.meta.adaptation));body.appendChild(make('p','version',C.meta.sectionCount+' 章 · '+C.meta.entryCount+' 条 · '+C.documents.length+' 篇附文 · 内容版本 '+C.meta.sourceCommit.slice(0,7)+'（'+C.meta.sourceDate+'）'));
    body.appendChild(btn('查看原项目地址','source',C.meta.sourceUrl,'text-button'));body.appendChild(make('p','','包内内容不会自动更新。医疗、法律、政策等信息可能变化，请留意原文适用条件和当地执行情况。'));
    var buttons=make('div','filter-options');buttons.appendChild(btn('术语表','glossary',null,'filter-option'));buttons.appendChild(btn('许可与改编','licenses',null,'filter-option'));body.appendChild(buttons);
    var h=make('h3','','附加长文');body.appendChild(h);C.documents.forEach(function(d){body.appendChild(btn(d.title,'document',d.path,'toc-entry'));});
    var original=make('details','sources');original.appendChild(make('summary','','原项目完整说明（README）'));var originalBody=make('div');original.appendChild(originalBody);original.addEventListener('toggle',function(){if(original.open&&!originalBody.childNodes.length)R.markdown(originalBody,C.readme,'');});body.appendChild(original);
  }});}
  function openDocument(path){var doc=C.documents.filter(function(d){return d.path===path;})[0];if(doc)openPanel({title:doc.title,subtitle:'原项目附文 · 完整离线阅读',reading:true,fill:function(body){R.markdown(body,doc.markdown,'');}});}
  function openSource(url){openPanel({title:'来源地址',subtitle:'容器内不跳转外部网页',reading:true,fill:function(body){body.appendChild(make('p','','原始地址保留如下，可选中文字记录地址，在浏览器中查阅。正文和引用说明已保存在本工具内。'));var area=make('textarea','url-field');area.readOnly=true;area.value=url;area.setAttribute('aria-label','原始来源地址');body.appendChild(area);}});}
  function openXref(value){var keys=value.split(',');openPanel({title:'引用预览',subtitle:'查看引用后可跳转，也可关闭继续阅读',reading:true,fill:function(body){keys.forEach(function(key){if(key[0]==='s'){var s=sectionById[key.slice(1)];if(s){body.appendChild(make('h3','',s.n+'. '+s.title));body.appendChild(make('p','','本章共 '+s.entries.length+' 条。'));body.appendChild(btn('阅读这一章','goto',key,'primary-button'));}}else{var e=entryById[key];if(e){body.appendChild(make('h3','','第 '+e.sec+' 章第 '+e.n+' 条 · '+e.title));var p=make('p');R.inline(p,e.human||e.cost,e.sec);body.appendChild(p);body.appendChild(btn('跳到这一条','goto',key,'primary-button'));}}});}});}
  function selectedChange(k,v){var position=currentPosition();if(k==='size')saved.preferences.fontSize=Number(v);else saved.preferences.theme=v;settings();layoutReader(position);persist(currentPosition());drawPanel();}
  document.addEventListener('click',function(event){
    var b=event.target.closest('[data-action]');if(!b)return;var a=b.dataset.action,v=b.dataset.value;
    if(a==='close')closePanel();else if(a==='chapters')openChapters();else if(a==='settings')openSettings();else if(a==='about')openAbout();
    else if(a==='filter-option'){var parts=v.split(':');M.toggle(draft,parts[0],parts[1]);$('sheet-body').querySelectorAll('[data-action="filter-option"]').forEach(function(el){var p=el.dataset.value.split(':');el.setAttribute('aria-pressed',String(draft[p[0]].indexOf(p[1])!==-1));});updateDraftCount();}
    else if(a==='reset-draft'){draft=M.empty();draft.q=state.q;drawPanel();}
    else if(a==='apply-filters'){closeAll();apply(draft);}
    else if(a==='remove-filter'){var bits=v.split(':');var next=M.clone(state);next[bits[0]]=next[bits[0]].filter(function(x){return x!==bits[1];});apply(next);}
    else if(a==='remove-flag'){var nextState=M.clone(state);nextState[v]=false;apply(nextState);}
    else if(a==='select-chapter')selectChapter(v);
    else if(a==='previous-chapter')turnChapter('previous');else if(a==='next-chapter')turnChapter('next');else if(a==='home')goHome();else if(a==='chapter-start'){closeAll();chapterStart();persist(currentPosition());}
    else if(a==='chapter-intro'){var intro=sectionById[v];openPanel({title:'本章导读',subtitle:intro.title,reading:true,fill:function(body){R.markdown(body,intro.intro.join('\n\n'),v);}});}
    else if(a==='entry-sources'){var entry=entryById[v];openPanel({title:'来源与依据',subtitle:entry.title,reading:true,fill:function(body){R.inline(body,entry.src,entry.sec);}});}
    else if(a==='fold-chapter'){var sub=$('toc-'+v);sub.hidden=!sub.hidden;b.setAttribute('aria-expanded',String(!sub.hidden));if(!sub.childNodes.length){var match=M.query(list,state).counts[v]||0;sectionById[v].entries.forEach(function(raw){if(M.fits(entryById[raw.id],state,new Date(),true))sub.appendChild(btn(raw.n+'. '+raw.title,'goto',raw.id,'toc-entry'));});if(!match)sub.appendChild(make('p','filter-hint','没有符合当前筛选的条目'));}}
    else if(a==='goto')gotoTarget(v).catch(function(){toast('暂时无法定位，请从章节目录重试。');});else if(a==='return-reading')returnReading();
    else if(a==='xref')openXref(v);else if(a==='document')openDocument(v);else if(a==='source')openSource(v);
    else if(a==='term'){var term=C.glossary.filter(function(t){return t.term===v;})[0];if(term)openPanel({title:term.term,subtitle:'读懂数字 · 术语解释',reading:true,fill:function(body){R.markdown(body,term.meaning,'');}});}
    else if(a==='glossary')openPanel({title:'读懂数字',subtitle:C.glossary.length+' 个术语',reading:true,fill:function(body){C.glossary.forEach(function(t){body.appendChild(make('h3','',t.term));var p=make('p');R.inline(p,t.meaning,'');body.appendChild(p);});}});
    else if(a==='licenses')openPanel({title:'许可与改编',subtitle:'正文 CC BY 4.0 · 原代码 MIT',reading:true,fill:function(body){body.appendChild(make('p','',C.meta.adaptation));body.appendChild(make('h3','','内容许可'));body.appendChild(make('p','',C.licenses.content));body.appendChild(make('h3','','原代码许可'));body.appendChild(make('p','',C.licenses.code));}});
    else if(a==='size'||a==='theme')selectedChange(a,v);else if(a==='to-top'){closeAll();window.scrollTo(0,0);persist();}
    else if(a==='anchor'){var target=document.getElementById('doc-'+v);if(target&&$('sheet-body').contains(target))target.scrollIntoView();else toast('相关目录请在当前文档中继续查阅。');}
  });
  $('sheet-body').addEventListener('change',function(e){if(e.target.dataset.flag){draft[e.target.dataset.flag]=e.target.checked;updateDraftCount();}else if(e.target.id==='filter-chapter-range'){draft.sec=e.target.value?[e.target.value]:[];updateDraftCount();}});
  $('sheet-body').addEventListener('input',function(e){if(e.target.id==='panel-search'){draft.q=e.target.value.slice(0,240);updateDraftCount();}});
  $('overlay').addEventListener('click',function(e){if(e.target===$('overlay'))closePanel();});
  document.addEventListener('keydown',function(e){
    if(e.key==='Tab')document.documentElement.classList.add('keyboard-focus');
    if(e.key==='Escape'&&panel){e.preventDefault();closePanel();}if(e.key==='Tab'&&panel){var focusables=Array.prototype.filter.call($('sheet').querySelectorAll('button,input,textarea,select,summary,[tabindex="0"]'),function(el){return el.offsetWidth||el.offsetHeight;});var first=focusables[0],last=focusables[focusables.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('sheet'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  ['pointerdown','mousedown','touchstart'].forEach(function(type){document.addEventListener(type,function(){document.documentElement.classList.remove('keyboard-focus');},{passive:true,capture:true});});
  $('filters').addEventListener('click',openFilters);$('chapters').addEventListener('click',openChapters);$('reset-all').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
  function doSearch(){clearTimeout(searchTimer);var next=M.clone(state);next.q=$('search').value;apply(next);}
  $('search').addEventListener('compositionstart',function(){composing=true;});$('search').addEventListener('compositionend',function(){composing=false;doSearch();});$('search').addEventListener('input',function(){if(!composing){clearTimeout(searchTimer);searchTimer=setTimeout(doSearch,180);}});$('search').addEventListener('search',doSearch);$('clear-search').addEventListener('click',function(){$('search').value='';doSearch();$('search').focus();});
  window.addEventListener('scroll',function(){if(!saved||restoring||loading||panel)return;if(!scrollFrame){scrollFrame=true;requestAnimationFrame(function(){scrollFrame=false;updateReaderProgress();});}clearTimeout(saveTimer);saveTimer=setTimeout(function(){persist(currentPosition());},150);},{passive:true});
  window.addEventListener('resize',function(){clearTimeout(resizeTimer);var position=saved&&saved.reading;resizeTimer=setTimeout(function(){if(saved&&!loading){layoutReader(position);persist(currentPosition());}},120);});
  document.addEventListener('DOMContentLoaded',function(){if(saved&&!loading){layoutReader(saved.reading);persist(currentPosition());}});
  document.addEventListener('visibilitychange',function(){if(document.hidden&&!restoring)persist(currentPosition());});
  window.addEventListener('pagehide',function(){if(saved){saved.filters=M.clone(state);saved.chapterId=chapterId;saved.readerView=readingView?'reading':'home';saved.reading=currentPosition()||saved.reading;saved.savedAt=Date.now();try{localStorage.setItem('life-guide:v1',JSON.stringify(saved));}catch(ignore){}}});
  async function init(){
    if(document.readyState==='loading')await new Promise(function(resolve){document.addEventListener('DOMContentLoaded',resolve,{once:true});});
    saved=M.stored(await S.read(),C);state=saved.filters;chapterId=saved.chapterId;setReading(saved.readerView==='reading');settings();document.querySelectorAll('button,input').forEach(function(el){el.disabled=false;});$('book-stat').textContent=C.meta.sectionCount+' 章 · '+C.meta.entryCount+' 条 · 一章一页';
    try{var p=new URLSearchParams(location.search);if(p.has('q')||M.dims.some(function(k){return p.has(k);})){var fromUrl=M.empty();fromUrl.q=p.get('q')||'';M.dims.forEach(function(k){fromUrl[k]=(p.get(k)||'').split(',');});fromUrl.dispute=p.get('dispute')==='1';fromUrl.todo=p.get('todo')==='1';state=M.normalize(fromUrl,C);saved.reading=null;}}catch(ignore){}
    var position=saved.reading;replaceResults();var hash=/^#e-(\d+-\d+)$/.exec(location.hash);if(hash&&entryById[hash[1]])await gotoTarget(hash[1]);else if(position)await positionAt(position);restoring=false;updateReaderProgress();persist(currentPosition());
  }
  init().catch(function(){restoring=false;$('list').textContent='';$('list').appendChild(make('p','reading-notice','打开指南时遇到了问题，请重新进入工具。'));});
})();
