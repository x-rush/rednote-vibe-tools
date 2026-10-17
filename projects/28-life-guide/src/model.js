(function(global){
  'use strict';
  var DIMS=['sec','ratio','lens','grade','money','time','will','who','upd','days'];
  var COST={money:{'0':0,'少':1,'多':2},time:{'少':0,'中':1,'多':2},will:{'否':0,'些':1,'是':2}};
  function empty(){var s={q:'',dispute:false,todo:false};DIMS.forEach(function(k){s[k]=[];});return s;}
  function clone(s){return JSON.parse(JSON.stringify(s));}
  function normalize(input,content){
    var s=empty(),v=input&&typeof input==='object'?input:{};
    s.q=typeof v.q==='string'?v.q.slice(0,240):'';s.dispute=v.dispute===true;s.todo=v.todo===true;
    DIMS.forEach(function(k){var f=content.filters.filter(function(f){return f.key===k;})[0],allowed=k==='sec'?content.sections.map(function(x){return x.n;}):f.options.map(function(x){return x.value;});s[k]=Array.isArray(v[k])?v[k].filter(function(x,i,a){return typeof x==='string'&&allowed.indexOf(x)!==-1&&a.indexOf(x)===i;}):[];});
    s.sec=s.sec.slice(0,1);s.days=s.days.slice(0,1);if(s.who.indexOf('无')!==-1)s.who=['无'];return s;
  }
  function dateDay(date){return Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());}
  function prepare(content){
    var list=[];content.sections.forEach(function(s){s.entries.forEach(function(raw){
      var e=Object.assign({},raw),score=0;['money','time','will'].forEach(function(k){score+=COST[k][e[k]]||0;});
      e.ratio=e.level==='大'?(score===0?'极高':score<=2?'高':'一般'):e.level==='中'?(score===0?'高':'一般'):'一般';
      e.dispute=/^争议/.test(e.note);e.todo=/待核实|TODO/.test(e.src+e.gain+e.note+e.cost);
      e.hay=[e.title,e.human,e.cost,e.gain,e.note,e.src,e.grade].join('\n').replace(/\*\*/g,'').replace(/\\([*_])/g,'$1').toLowerCase();
      var u=(content.updates.items||{})[e.id];e.update=u?(u.added?{kind:'新增',date:u.added}:{kind:'改过',date:u.changed,fields:u.fields}):null;list.push(e);
    });});return list;
  }
  function terms(q){return q.toLowerCase().split(/\s+/).filter(Boolean);}
  function fits(e,s,now,ignoreSection){
    var simple=['ratio','lens','grade','money','time','will'];
    if(simple.some(function(k){return s[k].length&&s[k].indexOf(e[k])===-1;}))return false;
    if(!ignoreSection&&s.sec.length&&s.sec.indexOf(e.sec)===-1)return false;
    if(s.who.length&&e.who.length&&!e.who.some(function(g){return g.every(function(v){return s.who.indexOf(v)!==-1||(v==='35岁'&&s.who.indexOf('60岁')!==-1);});}))return false;
    if(s.upd.length||s.days.length){
      if(!e.update)return false;if(s.upd.length&&s.upd.indexOf(e.update.kind)===-1)return false;
      var age=(dateDay(now||new Date())-Date.parse(e.update.date))/86400000;
      if(s.days.length&&age>Number(s.days[0]))return false;
    }
    if(s.dispute&&!e.dispute||s.todo&&!e.todo)return false;
    return terms(s.q).every(function(t){return e.hay.indexOf(t)!==-1;});
  }
  function query(list,s,now){var all=list.filter(function(e){return fits(e,s,now,true);}),counts={};all.forEach(function(e){counts[e.sec]=(counts[e.sec]||0)+1;});return {entries:all.filter(function(e){return !s.sec.length||s.sec.indexOf(e.sec)!==-1;}),counts:counts,total:all.length};}
  function readerView(list,s,sections,preferred,now){
    var match=query(list,s,now),ids=sections.map(function(sec){return sec.n;}),available=ids.filter(function(id){return (!s.sec.length||s.sec.indexOf(id)!==-1)&&!!match.counts[id];});
    var current=available.indexOf(preferred)!==-1?preferred:available[0]||(ids.indexOf(preferred)!==-1?preferred:ids[0]);
    var index=available.indexOf(current);
    return {chapter:current,chapters:available,index:index,previous:index>0?available[index-1]:null,next:index!==-1&&index<available.length-1?available[index+1]:null,total:match.entries.length,counts:match.counts,entries:match.entries.filter(function(e){return e.sec===current;})};
  }
  function toggle(s,k,value){var a=s[k],i=a.indexOf(value);if(k==='sec'){s.sec=value?[value]:[];return;}if(k==='days'){s.days=i===-1?[value]:[];return;}if(k==='who'){if(value==='无'){s.who=i===-1?['无']:[];return;}s.who=a.filter(function(x){return x!=='无';});a=s.who;i=a.indexOf(value);}if(i===-1)a.push(value);else a.splice(i,1);}
  function stored(raw,content){
    var out={schemaVersion:1,contentVersion:content.meta.sourceCommit,chapterId:content.sections[0].n,readerView:'home',filters:empty(),reading:null,preferences:{theme:'light',fontSize:16}};
    if(!raw||raw.schemaVersion!==1)return out;
    out.filters=normalize(raw.filters,content);
    if(raw.preferences){if(['light','dark','system'].indexOf(raw.preferences.theme)!==-1)out.preferences.theme=raw.preferences.theme;if([16,18,20].indexOf(raw.preferences.fontSize)!==-1)out.preferences.fontSize=raw.preferences.fontSize;}
    if(raw.contentVersion===content.meta.sourceCommit&&raw.reading&&content.sections.some(function(s){return s.entries.some(function(e){return e.id===raw.reading.entryId;});})){
      out.reading={entryId:raw.reading.entryId,offsetWithinEntry:Math.max(0,Math.min(100000,Number(raw.reading.offsetWithinEntry)||0)),textOffset:Math.max(0,Math.min(1000000,Math.floor(Number(raw.reading.textOffset)||0)))};
      if(raw.reading.readerMode==='chapter-scroll'){out.reading.readerMode='chapter-scroll';out.reading.scrollY=Math.max(0,Math.min(1000000,Number(raw.reading.scrollY)||0));out.reading.scrollLayout=String(raw.reading.scrollLayout||'').slice(0,100);}
      if(Number.isFinite(raw.reading.pageIndex))out.reading.pageIndex=Math.max(0,Math.min(100000,Math.floor(raw.reading.pageIndex)));
      if(typeof raw.reading.pageLayout==='string')out.reading.pageLayout=raw.reading.pageLayout.slice(0,100);
    }
    var preferred=raw.chapterId||(out.reading&&out.reading.entryId.split('-')[0])||out.filters.sec[0];
    if(content.sections.some(function(s){return s.n===preferred;}))out.chapterId=preferred;
    // Before the reader upgrade, directory navigation was stored as a chapter filter.
    if(typeof raw.chapterId!=='string')out.filters.sec=[];
    if(raw.readerView==='reading'||raw.readerView!=='home'&&out.reading&&(out.reading.scrollY>0||out.reading.offsetWithinEntry>0||out.reading.textOffset>0))out.readerView='reading';
    return out;
  }
  global.LifeModel={dims:DIMS,empty:empty,clone:clone,normalize:normalize,prepare:prepare,terms:terms,fits:fits,query:query,readerView:readerView,toggle:toggle,stored:stored};
})(window);
