(function(global){
  'use strict';
  function Reader(content,toolbar){this.content=content;this.toolbar=toolbar;}
  Reader.prototype.top=function(){return (parseFloat(getComputedStyle(this.toolbar).top)||0)+this.toolbar.offsetHeight+12;};
  Reader.prototype.key=function(){return global.innerWidth+':'+getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim()+':'+this.top()+':'+(document.body.classList.contains('reading-view')?'reading':'home')+':cover';};
  Reader.prototype.progress=function(){var start=this.content.getBoundingClientRect().top+global.pageYOffset-this.top(),end=this.content.getBoundingClientRect().bottom+global.pageYOffset-(global.innerHeight-document.querySelector('.bottom-nav').offsetHeight);return Math.round(Math.max(0,Math.min(1,(global.pageYOffset-start)/Math.max(1,end-start)))*100);};
  Reader.prototype.snapshot=function(){
    var entries=this.content.querySelectorAll('.entry'),top=this.top(),entry=null,i;
    for(i=0;i<entries.length;i++){entry=entries[i];if(entry.getBoundingClientRect().bottom>top)break;}
    if(!entry)return null;
    var walker=document.createTreeWalker(entry,NodeFilter.SHOW_TEXT),node,range=document.createRange(),offset=0;
    while((node=walker.nextNode())){
      range.selectNodeContents(node);if(!node.length||range.getBoundingClientRect().bottom<=top){offset+=node.length;continue;}
      var lo=0,hi=node.length;while(lo<hi){var mid=Math.floor((lo+hi)/2);range.setStart(node,mid);range.setEnd(node,Math.min(node.length,mid+1));if(range.getBoundingClientRect().bottom>top)hi=mid;else lo=mid+1;}offset+=lo;break;
    }
    return {entryId:entry.dataset.entry,textOffset:offset,offsetWithinEntry:Math.max(0,top-entry.getBoundingClientRect().top),readerMode:'chapter-scroll',scrollY:global.pageYOffset,scrollLayout:this.key()};
  };
  Reader.prototype.restore=function(position){
    var entry=this.content.querySelector('[data-entry="'+position.entryId+'"]');if(!entry)return;
    if(position.readerMode==='chapter-scroll'&&(position.scrollLayout===this.key()||position.scrollY===0&&(String(position.scrollLayout).indexOf(':cover')!==-1||!document.body.classList.contains('reading-view')))&&typeof position.scrollY==='number'){global.scrollTo(0,position.scrollY);return;}
    var y=entry.getBoundingClientRect().top+global.pageYOffset;
    if(!position.textOffset&&!position.offsetWithinEntry&&entry===this.content.querySelector('.entry')){var title=this.content.querySelector('.chapter-title');if(title)y=title.getBoundingClientRect().top+global.pageYOffset;}
    if(position.textOffset){var walker=document.createTreeWalker(entry,NodeFilter.SHOW_TEXT),node,remaining=position.textOffset,range=document.createRange();while((node=walker.nextNode())){if(remaining<node.length){range.setStart(node,remaining);range.setEnd(node,remaining+1);y=range.getBoundingClientRect().top+global.pageYOffset;break;}remaining-=node.length;}}
    else y+=position.offsetWithinEntry||0;
    global.scrollTo(0,Math.max(0,y-this.top()));
  };
  global.LifeChapterReader=Reader;
})(window);
