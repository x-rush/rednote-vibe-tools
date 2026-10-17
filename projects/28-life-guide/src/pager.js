(function(global){
  'use strict';
  function clamp(value,count){return Math.max(0,Math.min(Math.max(0,count-1),Math.floor(Number(value)||0)));}
  function swipe(dx,dy){return Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.25?(dx<0?1:-1):0;}
  function Pager(viewport,content,onChange){this.viewport=viewport;this.content=content;this.onChange=onChange;this.pageIndex=0;this.pageCount=1;this.width=1;this.height=1;this.gap=32;this.layoutKey='';}
  Pager.prototype.layout=function(){
    var v=this.viewport,c=this.content;this.width=Math.max(1,v.clientWidth);this.height=Math.max(1,v.clientHeight);this.pageIndex=0;
    c.style.transform='translateX(0px)';c.style.width=this.width+'px';c.style.height=this.height+'px';c.style.columnWidth=this.width+'px';c.style.columnGap=this.gap+'px';c.style.columnFill='auto';
    this.pageCount=Math.max(1,Math.ceil((c.scrollWidth+this.gap-1)/(this.width+this.gap)));
    this.layoutKey=this.width+'x'+this.height+':'+getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim();
    this.go(0,false);
  };
  Pager.prototype.go=function(index,notify){this.pageIndex=clamp(index,this.pageCount);this.content.style.transform='translateX('+(-this.pageIndex*(this.width+this.gap))+'px)';if(notify!==false&&this.onChange)this.onChange();};
  Pager.prototype.step=function(direction){var next=this.pageIndex+direction;if(next<0||next>=this.pageCount)return false;this.go(next);return true;};
  Pager.prototype.pageFor=function(element,offset){
    if(!element)return 0;var walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),text,remaining=Math.max(0,Number(offset)||0),range=document.createRange();
    while((text=walker.nextNode())){if(remaining<text.length){range.setStart(text,remaining);range.setEnd(text,Math.min(text.length,remaining+1));break;}remaining-=text.length;}
    if(!text)range.selectNodeContents(element);
    var rects=range.getClientRects(),r=rects.length?rects[0]:element.getBoundingClientRect(),left=this.viewport.getBoundingClientRect().left;
    return clamp(Math.floor((r.left-left+this.pageIndex*(this.width+this.gap)+1)/(this.width+this.gap)),this.pageCount);
  };
  Pager.prototype.snapshot=function(){
    var bounds=this.viewport.getBoundingClientRect(),walker=document.createTreeWalker(this.content,NodeFilter.SHOW_TEXT),node,range=document.createRange(),found=null,offset=0;
    while((node=walker.nextNode())){
      if(!node.textContent.trim())continue;range.selectNodeContents(node);var rects=range.getClientRects(),visible=false;
      for(var i=0;i<rects.length;i++){var r=rects[i];if(r.right>bounds.left+.5&&r.left<bounds.right-.5&&r.bottom>bounds.top+.5&&r.top<bounds.bottom-.5){visible=true;break;}}
      if(!visible)continue;
      var lo=0,hi=node.length;
      while(lo<hi){var mid=Math.floor((lo+hi)/2);range.setStart(node,mid);range.setEnd(node,Math.min(node.length,mid+1));if(range.getBoundingClientRect().right>bounds.left+.5)hi=mid;else lo=mid+1;}
      found=node;offset=lo;break;
    }
    var entry=found&&found.parentElement.closest('.entry'),first=this.content.querySelector('.entry'),atEnd=found&&found.parentElement.closest('#end-note'),all;
    if(!entry&&atEnd){all=this.content.querySelectorAll('.entry');entry=all[all.length-1];}
    var id=entry?entry.dataset.entry:first&&first.dataset.entry,textOffset=0;
    if(entry){walker=document.createTreeWalker(entry,NodeFilter.SHOW_TEXT);while((node=walker.nextNode())){if(node===found){textOffset+=offset;break;}textOffset+=node.length;}}
    if(atEnd&&entry)textOffset=Math.max(0,entry.textContent.length-1);
    return id?{entryId:id,textOffset:textOffset,offsetWithinEntry:0,pageIndex:this.pageIndex,pageLayout:this.layoutKey}:null;
  };
  Pager.prototype.restore=function(position){
    if(!position){this.go(0);return;}
    if(position.pageLayout===this.layoutKey&&typeof position.pageIndex==='number'){this.go(position.pageIndex);return;}
    var element=this.content.querySelector('[data-entry="'+position.entryId+'"]');
    this.go(this.pageFor(element,position.textOffset||0));
  };
  Pager.clamp=clamp;Pager.swipe=swipe;global.LifePager=Pager;
})(window);
