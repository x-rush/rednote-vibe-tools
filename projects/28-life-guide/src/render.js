(function(global){
  'use strict';
  var content,terms=[],entries={},sections={},glossary=[];
  function node(tag,cls,text){var el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;}
  function button(text,action,value,cls){var b=node('button',cls,text);b.type='button';b.dataset.action=action;if(value!=null)b.dataset.value=value;return b;}
  function init(c,list){content=c;list.forEach(function(e){entries[e.id]=e;});c.sections.forEach(function(s){sections[s.n]=s;});glossary=c.glossary.slice().sort(function(a,b){return b.term.length-a.term.length;});}
  function highlight(el,text){
    var lower=text.toLowerCase(),pos=0;
    while(pos<text.length){var best=-1,len=0;terms.forEach(function(t){var k=lower.indexOf(t,pos);if(k!==-1&&(best===-1||k<best)){best=k;len=t.length;}});if(best===-1){el.appendChild(document.createTextNode(text.slice(pos)));break;}if(best>pos)el.appendChild(document.createTextNode(text.slice(pos,best)));el.appendChild(node('mark','',text.slice(best,best+len)));pos=best+len;}
  }
  function referenceKeys(sec,spec){var ns=[];String(spec).split('、').forEach(function(part){var m=/^\s*(\d+)\s*到\s*(\d+)\s*$/.exec(part);if(m){var a=+m[1],b=+m[2];if(b>=a&&b-a<=40)for(var n=a;n<=b;n++)ns.push(String(n));}else ns.push(part.trim());});return ns.map(function(n){return sec+'-'+n;}).filter(function(id){return !!entries[id];});}
  function text(el,str,sec){
    var rx=/第\s*(\d+)\s*节第\s*([\d、]+(?:\s*到\s*\d+)?)\s*条|本节第\s*([\d、]+(?:\s*到\s*\d+)?)\s*条|第\s*([\d、]+(?:\s*到\s*\d+)?)\s*条|第\s*([\d、]+)\s*节/g,pos=0,m;
    function words(s){var p=0;while(p<s.length){var best=-1,term=null;glossary.forEach(function(g){var i=s.indexOf(g.term,p);while(i!==-1&&/^[A-Za-z0-9%. ]+$/.test(g.term)&&(/[A-Za-z0-9]/.test(s[i-1]||'')||/[A-Za-z0-9]/.test(s[i+g.term.length]||'')))i=s.indexOf(g.term,i+1);if(i!==-1&&(best===-1||i<best)){best=i;term=g;}});if(best===-1){highlight(el,s.slice(p));break;}if(best>p)highlight(el,s.slice(p,best));var b=button(term.term,'term',term.term,'inline-term');b.setAttribute('aria-label',term.term+'，查看解释');el.appendChild(b);p=best+term.term.length;}}
    while((m=rx.exec(str))){var keys=m[5]?m[5].split('、').filter(function(n){return !!sections[n];}).map(function(n){return 's'+n;}):referenceKeys(m[1]||sec,m[2]||m[3]||m[4]);if(!keys.length)continue;words(str.slice(pos,m.index));el.appendChild(button(m[0],'xref',keys.join(','),'inline-ref'));pos=rx.lastIndex;}words(str.slice(pos));
  }
  function link(el,label,url,sec){
    var clean=url.replace(/^\.\//,'').replace(/^(\.\.\/)+/,'');try{clean=decodeURIComponent(clean);}catch(ignore){}
    var doc=content.documents.filter(function(d){return d.path===clean.split('#')[0];})[0];
    if(doc){el.appendChild(button(label,'document',doc.path,'inline-ref'));return;}
    var chapter=content.sections.filter(function(s){return s.path===clean.split('#')[0];})[0];
    if(chapter){el.appendChild(button(label,'goto','s'+chapter.n,'inline-ref'));return;}
    if(clean==='README.md'||clean==='../README.md'){el.appendChild(button(label,'about',null,'inline-ref'));return;}
    if(url[0]==='#'){el.appendChild(button(label,'anchor',url.slice(1),'inline-ref'));return;}
    if(/^https?:\/\//i.test(url)){el.appendChild(button(label,'source',url,'source-link'));return;}
    if(/\.md(?:#.*)?$/.test(clean)){var path=/^(book|docs)\//.test(clean)?clean:'docs/'+clean;el.appendChild(button(label,'source',content.meta.sourceUrl+'/blob/'+content.meta.sourceCommit+'/'+path,'source-link'));return;}
    text(el,label,sec);el.appendChild(node('span','source-path','（'+url+'）'));
  }
  function inline(el,raw,sec){
    var str=String(raw||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/!\[([^\]]*)\]\([^\n]*?\)/g,'$1').replace(/<img\b[^>]*>/gi,'').replace(/<\/?(?:div|span|sub|sup|table|tr|td|th|b|i|p|a|strong|em)\b[^>]*>/gi,'').replace(/\\([*_])/g,'$1');
    var rx=/\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(((?:[^()\n]|\([^()\n]*\))+)\)|<(https?:\/\/[^>]+)>|(https?:\/\/[^\s<>「」]+)/g,pos=0,m;
    while((m=rx.exec(str))){text(el,str.slice(pos,m.index),sec);if(m[1]){var strong=node('strong');text(strong,m[1],sec);el.appendChild(strong);}else if(m[2])el.appendChild(node('code','',m[2]));else link(el,m[3]||m[5]||m[6],m[4]||m[5]||m[6],sec);pos=rx.lastIndex;}text(el,str.slice(pos),sec);
  }
  function markdown(el,raw,sec){
    var lines=String(raw||'').replace(/<!--[^]*?-->/g,'').split(/\r?\n/),paragraph=[],table=null;
    function flush(){if(paragraph.length){var p=node('p');inline(p,paragraph.join('\n'),sec);el.appendChild(p);paragraph=[];}}
    lines.forEach(function(line){var m;if(!line.trim()){flush();table=null;return;}if(/^\|/.test(line.trim())){flush();if(/^\|?[\s:|-]+\|?$/.test(line.trim()))return;if(!table){table=node('div','md-table');el.appendChild(table);}var row=node('div','md-row');line.trim().replace(/^\||\|$/g,'').split('|').forEach(function(cell){var c=node('div','md-cell');inline(c,cell.trim(),sec);row.appendChild(c);});table.appendChild(row);return;}table=null;
      if((m=/^(#{1,6})\s+(.+)$/.exec(line))){flush();var h=node('h'+Math.min(5,m[1].length+1),'md-heading');h.id='doc-'+m[2].replace(/\s+/g,'-');inline(h,m[2],sec);el.appendChild(h);}
      else if((m=/^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line))){flush();var li=node('p','md-list');inline(li,m[1],sec);el.appendChild(li);}
      else if(/^\s*---+\s*$/.test(line)){flush();el.appendChild(node('hr'));}
      else if(/^\s*\[←/.test(line))return;
      else paragraph.push(line);
    });flush();
  }
  function article(e){
    var el=node('article','entry');el.id='e-'+e.id;el.dataset.entry=e.id;
    var h=node('h3');inline(h,e.n+'. '+e.title,e.sec);el.appendChild(h);
    var badges=node('div','badges');badges.appendChild(node('span','badge ratio',e.ratio+'性价比'));badges.appendChild(node('span','badge evidence',e.grade+' 级证据'));if(e.lens)badges.appendChild(node('span','badge lens',{'死亡率':'换寿命','金钱':'换钱','时间':'换时间精力','自由':'换人身自由'}[e.lens]||e.lens));if(e.dispute)badges.appendChild(node('span','badge warning','争议'));if(e.todo)badges.appendChild(node('span','badge warning','待核实'));if(e.update)badges.appendChild(node('span','badge update',e.update.kind+' '+e.update.date));el.appendChild(badges);
    [['说人话','human'],['成本','cost'],['收益','gain'],['备注','note']].forEach(function(pair){if(!e[pair[1]])return;var block=node('div','entry-field '+pair[1]);block.appendChild(node('h4','',pair[0]));var p=node('p');inline(p,e[pair[1]],e.sec);block.appendChild(p);el.appendChild(block);});
    if(e.gradeText.trim()!==e.grade){var evidence=node('div','entry-field note');evidence.appendChild(node('h4','','证据说明'));var description=node('p');inline(description,e.gradeText,e.sec);evidence.appendChild(description);el.appendChild(evidence);}
    var inBody=(e.title+e.human+e.cost+e.gain+e.note).toLowerCase();
    var source=button('来源与依据 ›','entry-sources',e.id,'source-open');
    if(terms.length&&terms.some(function(t){return e.src.toLowerCase().indexOf(t)!==-1;})&&!terms.some(function(t){return inBody.indexOf(t)!==-1;})){
      var hit=terms.filter(function(t){return e.src.toLowerCase().indexOf(t)!==-1;})[0],index=e.src.toLowerCase().indexOf(hit),excerpt=node('p','source-excerpt');inline(excerpt,'来源匹配：…'+e.src.slice(Math.max(0,index-50),index+100)+'…',e.sec);el.appendChild(excerpt);
    }
    el.appendChild(source);return el;
  }
  global.LifeRender={init:init,node:node,button:button,inline:inline,markdown:markdown,article:article,setTerms:function(t){terms=t;},referenceKeys:referenceKeys};
})(window);
