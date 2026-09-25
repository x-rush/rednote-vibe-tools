(function(){
  'use strict';
  var c=window.GARDEN_CONTENT,u=c.ui,e=window.createGardenEngine(c),app=document.getElementById('app'),modal=document.getElementById('modal-root'),toastNode=document.getElementById('toast');
  var raw=null,storageError=false,corrupt=false,area=0,selected=null,mode=null,sheet=null,tier=1,journalTab='goals',toastTimer=null,timer=null,ticks=0,previousFocus=null;
  var blueprintMode=null,careSession=null,questReply=null,snapEnabled=true;
  var groundTool=null,stroke=null,drawerDrag=null,sheetScroll=null;
  var drawerExpanded=false,detailsOpen=false,repeatPlacement=false,undoStack=[],redoStack=[];
  var activePlan=null,camera={zoom:1,x:0,y:0},pointers={},gesture=null,suppressClick=0,lastViewport=null,atmosphere='clear',mountainChoice='',screenMode='auto',physicalOrientation=window.innerWidth>window.innerHeight?'landscape':'portrait',panelsCollapsed=false;try{atmosphere=localStorage.getItem(c.storageKey+'-atmosphere')||'clear';mountainChoice=localStorage.getItem(c.storageKey+'-mountain')||'';}catch(err){atmosphere='clear';}
  function worldPoint(p){return {x:(p.x+(p.area%2)*100)/2,y:c.layout.world.top+(p.y+Math.floor(p.area/2)*100)*c.layout.world.band/100};}
  function rotation(){var desired=layoutMode();return desired===physicalOrientation?'none':desired==='landscape'?'clockwise':'counterclockwise';}
  function virtualPoint(x,y){var turn=rotation();return turn==='clockwise'?{x:y,y:window.innerWidth-x}:turn==='counterclockwise'?{x:window.innerHeight-y,y:x}:{x:x,y:y};}
  function virtualRect(el){var r=el.getBoundingClientRect(),turn=rotation();if(turn==='clockwise')return {left:r.top,top:window.innerWidth-r.right,right:r.bottom,bottom:window.innerWidth-r.left,width:r.height,height:r.width};if(turn==='counterclockwise')return {left:window.innerHeight-r.bottom,top:r.left,right:window.innerHeight-r.top,bottom:r.right,width:r.height,height:r.width};return r;}
  function cameraApply(){var viewport=document.getElementById('garden-viewport'),world=document.getElementById('garden-scene');if(!viewport||!world)return;var w=viewport.clientWidth,h=viewport.clientHeight,size=w*camera.zoom;
    if(lastViewport&&(w!==lastViewport.w||h!==lastViewport.h)){camera.x=w/2-(lastViewport.w/2-camera.x)*w/lastViewport.w;camera.y=h/2-(lastViewport.h/2-camera.y)*w/lastViewport.w;}lastViewport={w:w,h:h};
    camera.x=Math.min(0,Math.max(w-size,camera.x));camera.y=size<h?(h-size)/2:Math.min(0,Math.max(h-size,camera.y));
    world.style.width=size+'px';world.style.height=size+'px';world.style.transform='translate('+camera.x+'px,'+camera.y+'px)';
    var rootStyle=getComputedStyle(document.documentElement),safe=parseFloat(rootStyle.getPropertyValue('--safe-area-inset-top'))||0,depth=parseFloat(rootStyle.getPropertyValue('--host-depth'))||54,side=parseFloat(rootStyle.getPropertyValue('--host-side'))||78;Array.prototype.forEach.call(world.querySelectorAll('.placed:not(.ghost),.find-spot,.keepsake,.harbor-landmark'),function(el){var r=el.getBoundingClientRect();el.disabled=r.top<safe+depth&&r.bottom>0&&(r.left<side||r.right>window.innerWidth-side);});var label=document.getElementById('zoom-label');if(label)label.textContent=Math.round(camera.zoom*100)+'%';
  }
  function zoomCamera(value,clientX,clientY){var v=document.getElementById('garden-viewport');if(!v)return;var r=virtualRect(v),p=clientX===undefined?null:virtualPoint(clientX,clientY),x=p?p.x-r.left:r.width/2,y=p?p.y-r.top:r.height/2,old=camera.zoom;camera.zoom=Math.max(1,Math.min(6,value));camera.x=x-(x-camera.x)*camera.zoom/old;camera.y=y-(y-camera.y)*camera.zoom/old;cameraApply();}
  function focusCourt(index){var v=document.getElementById('garden-viewport');if(!v)return;camera.zoom=2;camera.x=v.clientWidth/2-(index%2*.5+.25)*v.clientWidth*2;camera.y=v.clientHeight/2-((c.layout.world.top+c.layout.world.band*(Math.floor(index/2)+.5))/100)*v.clientWidth*2;cameraApply();}
  function focusPlacement(){if(!mode||!mode.point)return;var v=document.getElementById('garden-viewport'),p=worldPoint(mode.point),i=e.items[mode.item],variant=i.variants&&i.variants[mode.variant||0],height=i.visual.height/2*c.visualSizes[mode.size===undefined?1:mode.size].scale*(variant?variant.height:1);camera.zoom=Math.max(1,Math.min(2,v.clientHeight/(height*v.clientWidth/100)*.85));camera.x=v.clientWidth/2-p.x/100*v.clientWidth*camera.zoom;camera.y=v.clientHeight/2-(p.y-height*.4)/100*v.clientWidth*camera.zoom;cameraApply();}
  function pointAt(x,y){var r=virtualRect(document.getElementById('garden-scene')),p=virtualPoint(x,y),gx=(p.x-r.left)/r.width*200,gy=((p.y-r.top)/r.height*100-c.layout.world.top)/(c.layout.world.band/100),a=(gx>=100?1:0)+(gy>=100?2:0);return {x:Math.round((gx-a%2*100)*10)/10,y:Math.round((gy-Math.floor(a/2)*100)*10)/10,area:a};}
  try{raw=localStorage.getItem(c.storageKey);}catch(err){storageError=true;}
  var loaded=e.restore(raw,Date.now()),s=loaded.state;corrupt=!!loaded.error;
  var arrival=e.advance(s,Date.now());
  function text(v){return String(v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
  function n(v){return Math.floor(v).toLocaleString('en-US');}
  function decimal(v){return (Math.round(v*10)/10).toLocaleString('en-US');}
  var spriteSerial=0;
  function sprite(id,extra,variant){var i=e.items[id];if(i.extraSprite!==undefined)return '<span class="sprite extra-sprite '+(extra||'')+'" aria-hidden="true" style="background-position:'+(i.extraSprite%3*50)+'% '+(Math.floor(i.extraSprite/3)*50)+'%"></span>';if(i.plantRow!==undefined){var at=c.plantAtlas,col=variant||0,row=i.plantRow,left=at.columns[col],top=at.rows[row],w=at.columns[col+1]-left,h=at.rows[row+1]-top,clip='plant-clip-'+(++spriteSerial);return '<svg class="sprite plant-sprite '+(extra||'')+'" aria-hidden="true" viewBox="'+left+' '+top+' '+w+' '+h+'" preserveAspectRatio="xMidYMid meet"><defs><clipPath id="'+clip+'"><rect x="'+left+'" y="'+top+'" width="'+w+'" height="'+h+'" /></clipPath></defs><image href="./assets/plants.webp" xlink:href="./assets/plants.webp" x="0" y="0" width="'+at.width+'" height="'+at.height+'" clip-path="url(#'+clip+')" /></svg>';}return '<span class="sprite '+(extra||'')+'" aria-hidden="true" style="background-position:'+(i.sprite%4*100/3)+'% '+(Math.floor(i.sprite/4)*20)+'%"></span>';}
  function lookControls(item,look){var i=e.items[item];return '<div class="look-controls">'+(i.variants?'<p>'+u.variant+'</p><div class="look-options">'+i.variants.map(function(v,k){return button(sprite(item,'',k)+'<span>'+v.name+'</span>','variant',k===(look.variant||0)?'active':'secondary','data-variant="'+k+'"');}).join('')+'</div>':'')+'<p>'+u.visualSize+'</p><div class="size-options">'+c.visualSizes.map(function(v,k){return button(v.name,'visualSize',k===(look.size===undefined?1:look.size)?'active':'secondary','data-size="'+k+'"');}).join('')+'</div><p class="small">'+u.sizeNote+'</p></div>';}
  function button(label,action,cls,attrs,disabled){return '<button type="button" class="'+(cls||'secondary')+'" data-action="'+action+'" '+(attrs||'')+(disabled?' disabled':'')+'>'+label+'</button>';}
  function toast(message){toastNode.textContent=message;toastNode.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastNode.classList.remove('visible');},3600);}
  function readNew(){
    if(storageError||corrupt)return false;
    try{var current=localStorage.getItem(c.storageKey);if(current!==raw){var newer=e.restore(current,Date.now());if(newer.error){corrupt=true;return false;}raw=current;s=newer.state;undoStack=[];redoStack=[];e.advance(s,Date.now());mode=null;selected=null;area=Math.min(area,Math.floor((e.slots(s)-1)/12));render();if(sheet)drawSheet();toast(u.stale);return true;}}catch(err){storageError=true;}
    return false;
  }
  function save(){
    if(corrupt)return;if(readNew())return;
    try{var value=JSON.stringify(s);localStorage.setItem(c.storageKey,value);raw=value;storageError=false;}catch(err){storageError=true;}
  }
  function doAction(a){
    if(readNew())return false;
    var snapshot=JSON.stringify({objects:s.objects,ground:s.ground||[]}),before=s.combos.length,result=e.act(s,a,Date.now());if(result.ok){if(a.type==='move'||a.type==='store'||a.type==='ground'||a.type==='clearGround'){undoStack.push(snapshot);if(undoStack.length>30)undoStack.shift();redoStack=[];}else if(['buy','upgrade','expand','starter','blueprint','visitMap','lakeEdition','harborGift'].indexOf(a.type)>=0){undoStack=[];redoStack=[];}}save();
    if(!result.ok){toast(u[result.error]);renderStats();return false;}
    if(s.combos.length>before)toast(u.recentCombo);
    return true;
  }
  function notice(){return corrupt?u.corrupt:storageError?u.saveFailed:u.saved;}
  function selectedObject(){return s.objects.find(function(o){return o.uid===selected;});}
  function readyGoals(){return c.goals.filter(function(g){return s.goals.indexOf(g.id)<0&&e.goalValue(s,g)>=g.target;});}
  function currentGoal(){return readyGoals()[0]||c.goals.find(function(g){return s.goals.indexOf(g.id)<0;});}
  var viewing=false,storyReply=null,photoMode=false,photoData=null;
  function storyReadyCount(){return c.stories.filter(function(t){return e.storyReady(s,t);}).length;}
  function momentReadyCount(){return storyReadyCount()+c.quests.filter(function(q){return q.map===(s.map||0)&&!(s.quests||{})[q.id]&&e.questReady(s,q);}).length;}
  function ornament(t){var shapes={letter:'<path d="M9 10h28v28H9z" fill="#e7dac0"/><path d="M14 16h16m-16 6h12m-12 6h16" stroke="#8c846e"/>',bench:'<path d="M5 23h36v7H5z" fill="#a58a5f"/><path d="M10 30v10m26-10v10M9 23V12m28 11V12M9 15h28" stroke="#75694b" stroke-width="3"/>',ribbon:'<path d="M22 8v34" stroke="#7e6f56" stroke-width="4"/><path d="M12 18q11-8 22 0l-4 5H14zM21 22l-8 13m13-13 8 9" stroke="#ac8574" stroke-width="4" fill="#c8a492"/>',pattern:'<path d="M7 9h30v31H7z" fill="#dfd6be" stroke="#8c8068"/><path d="M12 15h20v17H12zM12 15l20 17m0-17L12 32" fill="none" stroke="#7b8271"/>'};return '<svg viewBox="0 0 46 46" aria-hidden="true">'+shapes[t.kind]+'</svg>';}
  function portrait(role,mood){return '<div class="event-portrait '+role+' mood-'+(mood||'calm')+'" aria-label="'+(role==='visitor'?'湖岸来客':role==='xiaolian'?'小莲':'山居客')+'"><span class="portrait-head"></span><span class="portrait-hair"></span><span class="portrait-body"></span><span class="portrait-expression"></span></div>';}
  function photoGround(ctx){
    (s.ground||[]).filter(function(g){return (g.map||0)===(s.map||0);}).forEach(function(g){
      var spec=c.groundTools.find(function(t){return t.id===g.kind;}),pts=g.points;if(!spec||!pts||pts.length<2)return;
      function trace(){ctx.beginPath();ctx.moveTo(pts[0][0]*12,pts[0][1]*12);for(var k=1;k<pts.length;k++){var a=pts[k-1],b=pts[k];ctx.quadraticCurveTo(a[0]*12,a[1]*12,(a[0]+b[0])*6,(a[1]+b[1])*6);}ctx.lineTo(pts[pts.length-1][0]*12,pts[pts.length-1][1]*12);}
      ctx.lineCap='round';ctx.lineJoin='round';trace();ctx.lineWidth=(spec.width+.45)*12;ctx.strokeStyle=spec.edge;ctx.stroke();trace();ctx.lineWidth=spec.width*12;ctx.strokeStyle=spec.color;ctx.stroke();
    });
  }
  function photoLayers(ctx,done){
    var objects=(s.objects||[]).filter(function(o){return o.pos>=0&&(o.map||0)===(s.map||0);}).sort(function(a,b){return worldPoint(e.location(a)).y-worldPoint(e.location(b)).y;});
    var urls=['./assets/scenery.webp','./assets/plants.webp','./assets/scenery-v6.webp','./assets/harbor-v7.webp'],images=[],left=urls.length;
    urls.forEach(function(url,k){var im=new Image();im.onload=function(){images[k]=im;finish();};im.onerror=function(){images[k]=null;finish();};im.src=url;});
    function finish(){if(--left)return;var count=0;objects.forEach(function(o){
      var i=e.items[o.item],p=worldPoint(e.location(o)),v=i.variants&&i.variants[o.variant||0],scale=c.visualSizes[o.size===undefined?1:o.size].scale;
      var w=i.visual.width*6*scale*(v?v.width:1),h=i.visual.height*6*scale*(v?v.height:1),src,rect;
      if(o.gift==='harbor'){src=images[3];if(src)rect=[src.width/2,src.height/2,src.width/2,src.height/2];}
      else if(i.extraSprite!==undefined){src=images[2];if(src)rect=[i.extraSprite%3*src.width/3,Math.floor(i.extraSprite/3)*src.height/3,src.width/3,src.height/3];}
      else if(i.plantRow!==undefined){src=images[1];if(src){var col=o.variant||0,row=i.plantRow,at=c.plantAtlas;rect=[at.columns[col],at.rows[row],at.columns[col+1]-at.columns[col],at.rows[row+1]-at.rows[row]];}}
      else{src=images[0];if(src){var index=i.sprite||0;rect=[index%4*src.width/4,Math.floor(index/4)*src.height/6,src.width/4,src.height/6];}}
      if(!src||!rect)return;ctx.save();ctx.globalCompositeOperation='multiply';var x=p.x*12,y=p.y*12-i.visual.anchor/100*h,drawW=w,drawH=h;if(i.plantRow!==undefined){var fit=Math.min(w/rect[2],h/rect[3]);drawW=rect[2]*fit;drawH=rect[3]*fit;}if(o.rotated){ctx.translate(x,0);ctx.scale(-1,1);x=0;}ctx.drawImage(src,rect[0],rect[1],rect[2],rect[3],x-drawW/2,y+h-drawH,drawW,drawH);ctx.restore();count++;
    });done(count);}
  }
  function photoCanvas(){
    var canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;var ctx=canvas.getContext('2d'),img=new Image();
    img.onload=function(){ctx.drawImage(img,0,0,1200,1200);photoGround(ctx);photoLayers(ctx,function(count){
      if(mountainChoice&&(s.map||0)===2){ctx.fillStyle='rgba(246,237,204,.86)';ctx.fillRect(760,42,390,44);ctx.fillStyle='#514c3e';ctx.font='16px sans-serif';ctx.fillText(mountainChoice==='lamp'?'山居事件：留灯山腰':'山居事件：灯回院中',780,70);}
      if(s.night){ctx.fillStyle='rgba(33,45,68,.24)';ctx.fillRect(0,0,1200,1200);}
      ctx.strokeStyle=s.night?'#d6c58e':'#8f8062';ctx.lineWidth=10;ctx.strokeRect(14,14,1172,1172);ctx.strokeStyle='rgba(255,250,226,.7)';ctx.lineWidth=2;ctx.strokeRect(30,30,1140,1140);
      ctx.fillStyle='rgba(255,252,238,.86)';ctx.fillRect(42,42,430,62);ctx.fillStyle='#514c3e';ctx.font='bold 26px sans-serif';ctx.fillText(c.title+' · '+c.maps[s.map||0].name,62,80);ctx.font='15px sans-serif';ctx.fillText(s.night?'暮色园景 · '+u.photoObjects:'一庭春慢 · '+u.photoObjects,62,98);
      var grad=ctx.createLinearGradient(0,1090,0,1200);grad.addColorStop(0,'rgba(39,45,34,0)');grad.addColorStop(1,'rgba(39,45,34,.54)');ctx.fillStyle=grad;ctx.fillRect(0,1060,1200,140);ctx.fillStyle='#fffdf3';ctx.font='18px sans-serif';ctx.fillText(count+' '+u.photoObjects+' · '+(s.night?'暮色留园':'春日留园'),52,1168);
      photoData=canvas.toDataURL('image/png');var bridge=window.xhs&&window.xhs.miniTool&&window.xhs.miniTool.saveImageToPhotosAlbum;
      if(bridge){Promise.resolve(bridge({filePath:photoData})).then(function(){toast(u.photoSaved);}).catch(function(){open('photo');toast(u.photoSaveFailed);});}else open('photo');
    });};img.onerror=function(){toast(u.photoSaveFailed);};img.src='./assets/'+lakeArt();
  }
  function sceneObject(o,ghost){var local=e.location(o),p=worldPoint(local),i=e.items[o.item],v=i.variants&&i.variants[o.variant||0],scale=c.visualSizes[o.size===undefined?1:o.size].scale,size=i.visual.width/2*scale*(v?v.width:1),height=i.visual.height/2*scale*(v?v.height:1);
    return '<button type="button" class="placed '+(ghost?'ghost ':'')+(o.uid===selected?'selected ':'')+(activePlan&&c.combos.find(function(g){return g.id===activePlan;}).items.indexOf(o.item)>=0?'plan-member ':'')+(o.rotated?'turned ':'')+(o.gift==='harbor'?'gift-lamp':'')+'" data-action="'+(ghost?'noop':'select')+'" data-uid="'+o.uid+'" style="left:'+p.x+'%;top:'+p.y+'%;width:'+size+'%;padding-top:'+height+'%;transform:translate(-50%,-'+i.visual.anchor+'%);z-index:'+Math.round(p.y)+'" aria-label="'+text((o.gift==='harbor'?c.harbor.gift:i.name)+' '+o.level+u.grade)+'">'+(o.gift==='harbor'?harborSprite(3):sprite(i.id,'',o.variant))+'<span class="object-name">'+(o.gift==='harbor'?c.harbor.gift:i.name)+' · '+o.level+u.grade+'</span></button>';
  }
  function groundPoint(x,y){var r=virtualRect(document.getElementById('garden-scene')),p=virtualPoint(x,y);return [Math.max(3,Math.min(97,(p.x-r.left)/r.width*100)),Math.max(22,Math.min(92,(p.y-r.top)/r.height*100))];}
  function groundSvg(){return '<svg class="ground-layer" viewBox="0 0 100 100" aria-hidden="true">'+(s.ground||[]).filter(function(g){return (g.map||0)===(s.map||0);}).concat(stroke?[stroke]:[]).map(function(g){var spec=c.groundTools.find(function(t){return t.id===g.kind;}),pts=g.points;if(!spec||!pts.length)return '';var d='M'+pts[0].join(' ');for(var k=1;k<pts.length;k++){var a=pts[k-1],b=pts[k];d+=' Q'+a.join(' ')+' '+[(a[0]+b[0])/2,(a[1]+b[1])/2].join(' ');}d+=' L'+pts[pts.length-1].join(' ');return '<path d="'+d+'" fill="none" stroke="'+spec.edge+'" stroke-width="'+(spec.width+.45)+'" stroke-linecap="round" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="'+spec.color+'" stroke-width="'+spec.width+'" stroke-linecap="round" stroke-linejoin="round"/>'+(g.kind==='path'?'<path d="'+d+'" fill="none" stroke="#eeebd9" stroke-width=".8" stroke-dasharray=".15 .9"/>':'');}).join('')+'</svg>';}
  function totalUsed(){return s.objects.reduce(function(n,o){return n+(o.pos>=0&&(o.map||0)===(s.map||0)?e.items[o.item].w*e.items[o.item].h:0);},0);}
  function placementReason(){return mode&&mode.point?u[e.landReason(s,mode.item,area,mode.point.x,mode.point.y,mode.rotated,mode.uid,mode)]||u.placementBad:u.placementBad;}
  function layoutHistory(action){if(readNew())return;var from=action==='undo'?undoStack:redoStack,to=action==='undo'?redoStack:undoStack;if(!from.length)return;e.advance(s,Date.now());to.push(JSON.stringify({objects:s.objects,ground:s.ground||[]}));var restored=JSON.parse(from.pop());s.objects=restored.objects;s.ground=restored.ground;s.revision++;mode=null;selected=null;save();render();toast(u.layoutUndoNote);}
  function ringStyle(){var f=e.footprint(mode.item,mode.rotated,mode);return 'width:'+f.rx+'%;height:'+(f.ry*c.layout.world.band/50)+'%;';}
  function layoutMode(){return screenMode==='auto'?(window.innerWidth>window.innerHeight?'landscape':'portrait'):screenMode;}
  function render(){
    var oldScroller=document.querySelector('.main-layout'),oldScroll=oldScroller?oldScroller.scrollTop:0,lv=e.level(s),o=selectedObject(),html='';
    html+='<div class="app-shell v2 '+(s.night?'night ':'')+'atmo-'+atmosphere+' screen-'+layoutMode()+' '+(panelsCollapsed?'panels-collapsed ':'')+(viewing?'viewing':'')+(mode?' editing':'')+(detailsOpen?' details-open':'')+(o&&!mode&&!activePlan&&!blueprintMode?' has-selection':'')+(activePlan?' has-plan':'')+(groundTool?' has-ground':'')+(blueprintMode?' has-blueprint':'')+'"><header class="masthead"><h1>'+c.title+'</h1><p>'+c.theme.label+'</p></header><main class="main-layout"><section class="garden-column">';
    html+='<div class="money-strip"><div class="wallet">'+u.coins+' <strong id="wallet">'+n(s.coins)+'</strong></div><div class="flow"><strong><span id="rate">'+decimal(e.rate(s))+'</span> '+u.minute+'</strong></div></div>';
    html+='<div class="areas" aria-label="'+u.area+'">'+c.areas.map(function(a,index){return button(a.name,'area',index===area?'active':(false?'area-locked':''),'data-area="'+index+'" aria-pressed="'+(index===area)+'"');}).join('')+'</div>';
    html+='<div class="scene-title"><span>'+c.areas[area].line+'</span>'+button(u.plans,'plans','quiet')+button(viewing?u.exitView:u.viewMode,'view','quiet')+'</div>';
    html+='<div class="garden-viewport" id="garden-viewport"><div class="garden-scene '+(mode?'scene-edit':'')+'" id="garden-scene" style="background-image:url(./assets/'+lakeArt()+')" role="group" tabindex="0" aria-label="'+text(mode?u.placementHint:u.worldName)+'">';
    html+=groundSvg()+harborScene()+mountainScene();
    c.areas.forEach(function(a,index){html+='<span class="district-label '+(false?'unopened':'')+'" style="left:'+(index%2*50+25)+'%;top:'+(c.layout.world.top+c.layout.world.band*(Math.floor(index/2)+.37))+'%">'+a.name+(false?' · '+u.unopened:'')+'</span>';});
    s.objects.filter(function(p){return p.pos>=0&&(p.map||0)===(s.map||0)&&(!mode||p.uid!==mode.uid);}).sort(function(a,b){return worldPoint(e.location(a)).y-worldPoint(e.location(b)).y;}).forEach(function(p){html+=sceneObject(p,false);});
    c.stories.forEach(function(t){if((s.map||0)===0&&e.storyState(s,t.id).length===t.episodes.length){var p=worldPoint({x:t.anchor[0],y:t.anchor[1],area:t.area});html+='<button class="keepsake" data-action="storyOpen" data-id="'+t.id+'" style="left:'+p.x+'%;top:'+p.y+'%" aria-label="'+t.keepsake+'">'+ornament(t)+'</button>';}});
    c.finds.filter(function(f){return f.map===(s.map||0)&&(s.found||[]).indexOf(f.id)<0;}).forEach(function(f){html+='<button class="find-spot" data-action="find" data-id="'+f.id+'" style="left:'+findPoint(f)[0]+'%;top:'+findPoint(f)[1]+'%" aria-label="'+f.name+'">✦</button>';});
    c.quests.filter(function(q){return q.map===(s.map||0)&&q.memorials&&(s.quests||{})[q.id];}).forEach(function(q){var pick=s.quests[q.id].choice==='a'?0:1,m=q.memorials[pick];html+='<button class="keepsake" data-action="questOpen" data-id="'+q.id+'" style="left:52%;top:76%" aria-label="'+m.name+'">'+ornament(m)+'</button>';});
    if(blueprintMode){var bp=c.blueprints.find(function(b){return b.id===blueprintMode.id;});bp.parts.forEach(function(part){var gx=blueprintMode.x+blueprintMode.area%2*100+part.x,gy=blueprintMode.y+Math.floor(blueprintMode.area/2)*100+part.y,a=(gx>=100?1:0)+(gy>=100?2:0);html+=sceneObject({uid:-2,item:part.item,level:1,pos:a*12,x:gx-a%2*100,y:gy-Math.floor(a/2)*100},true);});}
    if(mode&&mode.point){var valid=e.canLand(s,mode.item,area,mode.point.x,mode.point.y,mode.rotated,mode.uid,mode),wp=worldPoint(mode.point);html+='<div class="landing-ring '+(valid?'valid':'invalid')+'" style="'+ringStyle()+'left:'+wp.x+'%;top:'+wp.y+'%"></div>'+sceneObject({uid:-1,item:mode.item,gift:mode.gift,level:1,pos:area*12,x:mode.point.x,y:mode.point.y,rotated:mode.rotated,variant:mode.variant,size:mode.size},true);}
    html+='</div></div><div class="camera-bar">'+button('−','zoomOut','secondary','aria-label="'+u.zoomOut+'"')+'<span id="zoom-label">'+Math.round(camera.zoom*100)+'%</span>'+button('＋','zoomIn','secondary','aria-label="'+u.zoomIn+'"')+button(u.overview,'overview','quiet')+button(u.locate,'locate','quiet')+button(u.atmosphere,'atmosphere','quiet')+button(layoutMode()==='portrait'?u.landscape:u.portrait,'orientation','quiet','aria-label="'+(layoutMode()==='portrait'?u.landscape:u.portrait)+'"')+button(u.photo,'photo','quiet')+'</div><p class="camera-hint">'+u.cameraHint+'</p>';
    if(activePlan&&!mode){var plan=c.combos.find(function(g){return g.id===activePlan;}),complete=e.combinations(s).active.some(function(g){return g.id===activePlan;});html+='<div class="plan-panel"><b>'+plan.name+' · '+(complete?u.planComplete:u.planAdjust)+'</b><p>'+plan.line+'</p><div>'+plan.items.map(function(id){var own=s.objects.find(function(o){return o.item===id;});return button(e.items[id].name+' · '+(own?(own.pos>=0?u.planPlaced:u.planStored):u.planMissing),'planItem','secondary','data-item="'+id+'"');}).join('')+'</div>'+button(u.planStop,'planStop','quiet')+'</div>';}
    if(mode){var item=e.items[mode.item],valid=mode.point&&e.canLand(s,mode.item,area,mode.point.x,mode.point.y,mode.rotated,mode.uid,mode);html+='<div class="placement-bar">'+button(detailsOpen?u.drawerLess:u.appearance,'details','quiet')+'<b>'+item.name+' · '+u.selectFloor+'</b><p>'+u.placementHint+'</p>'+'<div class="placement-details">'+lookControls(mode.item,mode)+'<div class="nudge">'+button('←','nudge','secondary','data-dx="-2" data-dy="0" aria-label="left"')+button('↑','nudge','secondary','data-dx="0" data-dy="-2" aria-label="up"')+button('↓','nudge','secondary','data-dx="0" data-dy="2" aria-label="down"')+button('→','nudge','secondary','data-dx="2" data-dy="0" aria-label="right"')+button(u.rotate,'rotate','secondary','',false)+'</div></div><p class="landing-status">'+(valid?u.placementGood:placementReason())+'</p><div class="actions">'+button(u.recommend,'recommend','secondary')+button(u.repeat,'repeat',repeatPlacement?'active':'secondary')+button(u.cancelWord,'cancel','secondary')+button(u.confirmPlace,'confirmPlace','primary','',!valid)+'</div></div>';}
    html+='<div class="bank-box"><div><span class="small">'+u.bank+'</span><strong id="bank">'+n(s.bank)+'</strong><p id="bank-note">'+u.offlineLimit+' '+e.hours(s)+u.hour+'</p></div>'+button(u.collect,'collect','primary','id="collect"',s.bank<1)+'</div>';
    if(o&&!mode&&!activePlan&&!blueprintMode){var i=e.items[o.item],bonus=e.combinations(s).bonuses[o.uid]||0;html+='<div class="selection"><div class="selection-head">'+sprite(o.item)+'<div class="detail"><h3>'+(o.gift==='harbor'?c.harbor.gift:i.name)+' <span class="small">'+o.level+' / 10'+u.grade+'</span></h3><p>'+i.visual.role+' · '+i.visual.guide+'</p><b>'+decimal(e.baseRate(o)*(1+bonus))+' '+u.minute+'</b>'+(bonus?'<span class="small"> +'+Math.round(bonus*100)+'% '+u.bonus+'</span>':'')+'</div></div><div class="actions">'+button(o.level>=10?u.max:u.upgrade,'upgradeInfo','primary','',o.level>=10||i.income===0)+button(u.appearance,'move','secondary')+button(u.store,'store','secondary')+((i.plantRow!==undefined||['lotus','osmanthus'].indexOf(i.id)>=0)?button(u.care,'care','secondary'):'' )+'</div></div>';}
    if(!mode){html+='<div class="garden-toolbar"><span>'+u.level+' '+lv.value+' · '+u.capacity+' '+totalUsed()+' / '+(e.slots(s)*c.layout.capacityMultiplier)+'</span>'+button(u.expand,'expand','quiet')+'</div>';if(!s.objects.length)html+='<p class="hint">'+u.newGardenHint+'</p>';}
    html+='<div class="subbar">'+button(u.gardenList,'objects','quiet')+button(u.plans,'plans','quiet')+button(u.warehouse,'warehouse','quiet')+button(s.night?u.day:u.night,'night','quiet')+button(u.guide,'guide','quiet')+'</div><p class="storage-status '+(storageError||corrupt?'error':'')+'">'+notice()+'</p></section>';
    html+='<aside class="side-note"><h2>'+c.tagline+'</h2><p>'+c.theme.intro+'</p><p>'+c.areas[area].line+'</p>'+button(u.stories,'stories','quiet')+'<p class="theme-note">'+c.theme.note+'</p></aside></main>';
    html+='<nav class="dock" aria-label="'+u.garden+'">'+button('<span>庭</span>'+u.garden,'home','active')+button('<span>＋</span>'+u.shop,'shop','')+button('<span>理</span>'+u.gardenList,'objects','')+button('<span>芽</span>'+u.manage,'manage','')+'</nav>';
    html+=(groundTool&&!viewing?'<div class="ground-toolbar"><b>'+c.groundTools.find(function(g){return g.id===groundTool;}).name+'</b><span>'+u.groundHint+'</span>'+button(u.groundDone,'groundDone','primary')+'</div>':'');html+='<div class="journey-bar">'+button(c.maps[s.map||0].name+' ▾','maps','secondary')+button(u.momentHub+(momentReadyCount()?' · '+momentReadyCount():''),'moments','secondary')+(!s.starter?button(u.starter,'starter','secondary'):'')+'</div>';if(blueprintMode){var preview=e.blueprint(s,blueprintMode.id,blueprintMode.area,blueprintMode.x,blueprintMode.y,Date.now());html+='<div class="blueprint-bar"><b>'+u.blueprintHint+'</b><p>'+u.blueprintCost+' '+n(preview.cost||0)+' · '+(preview.ok?u.placementGood:u[preview.error])+'</p>'+button(u.cancelWord,'cancelBlueprint','secondary')+button(u.blueprintConfirm,'confirmBlueprint','primary','',!preview.ok)+'</div>';}html+='<div class="canvas-tools">'+button(panelsCollapsed?u.expandPanels:u.collapsePanels,'panelToggle','secondary','aria-label="'+(panelsCollapsed?u.expandPanels:u.collapsePanels)+'"')+button(viewing?u.exitView:u.viewMode,'view','secondary')+(!viewing?button(u.undo,'undo','secondary','',!undoStack.length)+button(u.redo,'redo','secondary','',!redoStack.length):'')+'</div></div>';document.body.classList.toggle('sim-landscape',rotation()==='clockwise');document.body.classList.toggle('sim-portrait',rotation()==='counterclockwise');app.innerHTML=html;document.querySelector('.main-layout').scrollTop=oldScroll;cameraApply();renderStats();
  }
  function renderStats(){
    var wallet=document.getElementById('wallet'),bank=document.getElementById('bank'),collect=document.getElementById('collect'),note=document.getElementById('bank-note');
    if(wallet)wallet.textContent=n(s.coins);if(bank)bank.textContent=n(s.bank);if(collect)collect.disabled=s.bank<1;
    if(note){var cap=e.rate(s)*e.hours(s)*60;note.textContent=s.last>Date.now()?u.clock:(cap>0&&s.bank>=cap-.01?u.capFull:u.offlineLimit+' '+e.hours(s)+u.hour);}
  }
  function open(name){if(!sheet)previousFocus=document.activeElement;clearTimeout(toastTimer);toastNode.classList.remove('visible');sheet=name;drawSheet();}
  function close(){if(sheet==='photo')photoData=null;sheet=null;modal.innerHTML='';document.body.style.overflow='';if(previousFocus&&document.body.contains(previousFocus))previousFocus.focus();}
  function growthBody(lv){
    var nextTier=c.tiers.find(function(t){return t.level>lv;}),nextMap=c.maps.find(function(m){return e.mapIds(s).indexOf(m.id)<0;}),tierIndex=nextTier?c.tiers.indexOf(nextTier)+1:0;
    var html='<div class="growth-lead"><p>'+u.growthIntro+'</p><div class="growth-metrics"><div><small>'+u.level+'</small><strong>'+lv+'</strong></div><div><small>'+u.growthIncome+'</small><strong>'+decimal(e.rate(s))+'</strong></div><div><small>'+u.growthBank+'</small><strong>'+n(s.bank)+'</strong></div></div><div class="growth-primary">'+(s.bank>=1?button(u.collect+' '+n(s.bank),'collect','primary'):button(u.shop,'shop','primary'))+button(u.growthStory,'moments','secondary')+'</div></div>';
    html+='<h3 class="growth-heading">'+u.growthUnlocks+'</h3><div class="growth-unlocks">';
    html+=nextTier?'<article><div><small>'+u.growthNewScenery+'</small><b>'+nextTier.name+'</b><p>'+u.needLevel+' '+nextTier.level+' · '+c.items.filter(function(i){return i.tier===tierIndex;}).slice(0,3).map(function(i){return i.name;}).join('、')+'</p></div>'+button(u.growthPlant,'shopTier','secondary','data-tier="'+tierIndex+'"')+'</article>':'<p class="growth-complete">'+u.growthAllScenery+'</p>';
    html+=nextMap?'<article><div><small>'+u.growthNewGarden+'</small><b>'+nextMap.name+'</b><p>'+u.needLevel+' '+nextMap.level+' · '+n(nextMap.price)+u.moneyUnit+'</p></div>'+button(u.growthMap,'maps','secondary')+'</article>':'<p class="growth-complete">'+u.growthAllGardens+'</p>';
    html+='</div>';var goal=currentGoal();if(goal){var ready=e.goalValue(s,goal)>=goal.target;html+='<article class="growth-goal"><div><small>'+u.growthGoal+'</small><b>'+goal.name+'</b><p>'+goal.line+'</p></div>'+button(ready?u.claim:u.goals,ready?'goal':'journal','secondary','data-id="'+goal.id+'"')+'</article>';}
    html+='<details class="growth-more"><summary>'+u.growthMore+'</summary><div class="management-grid">'+['objects','blueprints','ground','waypoints','plans','warehouse','expand','journal','album','night','guide'].map(function(a){return button(u[a],a,'secondary');}).join('')+'</div></details>';
    return html;
  }
  function momentBody(){
    var map=s.map||0,quest=c.quests.find(function(q){return q.map===map&&!(s.quests||{})[q.id]&&e.questReady(s,q);}),story=c.stories.find(function(t){return e.storyReady(s,t);}),care=s.objects.find(function(o){return o.pos>=0&&(o.map||0)===map&&e.careEligible(s,o,Date.now());}),find=c.finds.find(function(f){return f.map===map&&(s.found||[]).indexOf(f.id)<0;}),head='',line='',action='shop',attrs='',label=u.shop;
    if(quest){head=quest.title;line=quest.person+' · '+quest.arcTitle;action='questOpen';attrs='data-id="'+quest.id+'"';label=u.momentEnter;}
    else if(story){var done=e.storyState(s,story.id);head=story.episodes[done.length].title;line=story.person+' · '+story.title;action='storyOpen';attrs='data-id="'+story.id+'"';label=u.momentEnter;}
    else if(care){head=e.items[care.item].name;line=u.careDone;action='momentCare';attrs='data-uid="'+care.uid+'"';label=u.momentCare;}
    else if(find){head=find.name;line=u.finds;action='finds';label=u.momentEnter;}
    else if(!s.starter){head=u.starter;line=u.starterNote;action='starter';label=u.momentStarter;}
    else {head=u.momentBrowse;line=u.momentWait;}
    return '<article class="moment-feature"><small>'+u.momentNow+'</small><h3>'+head+'</h3><p>'+line+'</p>'+button(label,action,'primary',attrs)+'</article><div class="moment-paths">'+button(u.quests,'quests','secondary')+button(u.stories,'stories','secondary')+(map>0?button(u.finds,'finds','secondary'):'')+(map===1?button(u.harbor,'harbor','secondary'):'')+(map===2?button(u.mountainView,'mountainView','secondary'):'')+'</div>';
  }
  function drawSheet(){
    if(!sheet)return;var title='',subtitle='',body='',foot='',lv=e.level(s).value;
    var special=extraSheet(sheet);if(special){title=special.title;body=special.body;foot=special.foot||'';}else if(sheet==='manage'){title=u.manage;body=growthBody(lv);}else if(sheet==='moments'){title=u.momentHub;subtitle=u.momentIntro;body=momentBody();}else if(sheet==='waypoints'){title=u.waypoints;body=c.areas.map(function(a,k){return button(a.name,'area','secondary','data-area="'+k+'"');}).join('');}else if(sheet==='ground'){title=u.ground;body=button(u.snap+' · '+(snapEnabled?u.active:u.cancelWord),'snap','secondary')+'<p>'+u.groundHint+'</p><div class="management-grid">'+c.groundTools.map(function(g){return button(g.name,'groundTool','secondary','data-id="'+g.id+'"');}).join('')+'</div>'+button(u.clearGround,'clearGroundAsk','quiet');}else if(sheet==='clearGround'){title=u.clearGround;body='<p>'+u.clearGroundConfirm+'</p>';foot=button(u.clearGround,'clearGround','danger');}else if(sheet==='objects'){title=u.gardenList;body=s.objects.filter(function(o){return o.pos>=0&&(o.map||0)===(s.map||0);}).map(function(o){return '<div class="goal-row">'+sprite(o.item,'',o.variant)+'<div><h3>'+(o.gift==='harbor'?c.harbor.gift:e.items[o.item].name)+'</h3><p>'+c.areas[e.location(o).area].name+' · '+e.items[o.item].visual.role+'</p></div>'+button(u.appearance,'selectFromList','secondary','data-uid="'+o.uid+'"')+'</div>';}).join('')||'<p class="hint">'+u.newGardenHint+'</p>';
    }else if(sheet==='plans'){title=u.plans;subtitle=u.planGuide;body=c.combos.map(function(g){return '<article class="combo-row"><h3>'+g.name+' <span class="small">+'+Math.round(g.bonus*100)+'%</span></h3><div class="combo-icons">'+g.items.map(function(id){return '<div>'+sprite(id)+e.items[id].name+'</div>';}).join('')+'</div><p>'+g.line+'</p>'+button(u.planAdjust,'plan','primary','data-id="'+g.id+'"')+'</article>';}).join('');
    }else if(sheet==='stories'){
      title=u.stories;subtitle=c.theme.note;body='<p class="hint">'+c.theme.intro+'</p>';
      c.stories.forEach(function(t){var done=e.storyState(s,t.id),ready=e.storyReady(s,t),ep=t.episodes[done.length];body+='<article class="story-card"><div class="story-seal">'+ornament(t)+'</div><div><h3>'+t.title+'</h3><p>'+t.person+' · '+done.length+' / '+t.episodes.length+'</p><p>'+(!ep?u.storyFinished:ready?u.storyReady:ep.hint)+'</p></div>'+button(ready?u.storyOpen:done.length?u.storyRecord:u.storyWaiting,'storyOpen','quiet','data-id="'+t.id+'"',!ready&&!done.length)+'</article>';});
    } else if(sheet.indexOf('story:')===0){
      var t=c.stories.find(function(t){return t.id===sheet.split(':')[1];}),done=e.storyState(s,t.id),ep=t.episodes[done.length],ready=e.storyReady(s,t);title=t.title;subtitle=t.person+' · '+u.storyTab;
      if(storyReply&&storyReply.id===t.id){var finished=t.episodes[storyReply.stage],choice=finished.choices.find(function(ch){return ch.id===storyReply.choice;});body='<div class="prose story-page"><p class="story-chapter">'+finished.title+'</p><p class="chosen-line">'+u.storyChoice+'：'+choice.label+'</p><p>'+choice.reply+'</p>'+(done.length===t.episodes.length?'<div class="earned-keepsake">'+ornament(t)+'<b>'+u.storyReward+' · '+t.keepsake+'</b></div>':'')+'</div>';foot=button(u.storyContinue,'storyContinue','primary');}
      else if(ready){var echo=ep.echo&&done.length?ep.echo[done[done.length-1].choice]:'';body='<div class="prose story-page"><p class="story-chapter">'+ep.title+'</p>'+ep.body.split('\n').map(function(p){return '<p>'+p+'</p>';}).join('')+(echo?'<p>'+echo+'</p>':'')+'</div><div class="story-choices">'+ep.choices.map(function(ch){return button(ch.label,'storyChoose','secondary','data-id="'+t.id+'" data-stage="'+done.length+'" data-choice="'+ch.id+'"');}).join('')+'</div>';}
      else body='<p class="hint">'+(ep?ep.hint:u.storyFinished+' · '+t.keepsake)+'</p>';
      if(done.length&&!storyReply){body+='<h3 class="record-title">'+u.storyRecord+'</h3>';done.forEach(function(r,index){var old=t.episodes[index],ch=old.choices.find(function(ch){return ch.id===r.choice;});body+='<details class="story-record"><summary>'+old.title+' · '+ch.label+'</summary><div class="prose">'+old.body.split('\n').map(function(p){return '<p>'+p+'</p>';}).join('')+(old.echo&&index?'<p>'+old.echo[done[index-1].choice]+'</p>':'')+'<p>'+ch.reply+'</p></div></details>';});}
    } else if(sheet==='shop'){
      title=u.shop;subtitle=u.chooseSpot;
      body='<div class="tier-tabs">'+c.tiers.map(function(t,index){return button(t.name+(lv<t.level?' '+t.level+u.grade:''),'tier',tier===index+1?'active':'','data-tier="'+(index+1)+'"');}).join('')+'</div><div class="shop-list">';
      c.items.filter(function(i){return i.tier===tier&&i.id!=='manor';}).forEach(function(i){var t=c.tiers[i.tier-1];body+='<button class="shop-card" data-action="item" data-item="'+i.id+'">'+sprite(i.id)+(s.collection.indexOf(i.id)>=0?'<span class="badge">'+u.owned+'</span>':'')+'<h3>'+i.name+'</h3><p>'+decimal(e.baseRate({item:i.id,level:1}))+u.minute+' · '+i.w*i.h+u.grid+'</p><span class="price">'+(lv<t.level?u.needLevel+' '+t.level:n(e.price(i.id))+' '+u.moneyUnit+(e.itemUnlocked(s,i)?'':' · '+u.mapLocked))+'</span></button>';});body+='</div>';
    } else if(sheet.indexOf('item:')===0){
      var i=e.items[sheet.split(':')[1]],t=c.tiers[i.tier-1];title=i.name;subtitle=t.name+' · '+u.upgradeStep;
      body='<div class="item-preview">'+sprite(i.id)+'<div><h3>'+i.name+'</h3><p>'+i.line+'</p></div></div><div class="facts"><div>'+u.baseRate+'<strong>'+e.baseRate({item:i.id,level:1})+u.minute+'</strong></div><div>'+u.size+'<strong>'+i.w*i.h+u.grid+'</strong></div><div>'+u.price+'<strong>'+n(e.price(i.id))+'</strong></div></div>';
      var relevant=c.combos.filter(function(x){return x.items.indexOf(i.id)>=0;});if(relevant.length)body+='<p class="preview-line">'+u.combo+'：'+relevant.map(function(x){return x.name;}).join('、')+'</p>';
      if(!e.itemUnlocked(s,i))body+='<p class="hint">'+u.mapLocked+' · '+c.maps[i.unlockMap].name+'</p>';if(lv<t.level)body+='<p class="hint">'+u.needLevel+' '+t.level+'</p>';
      foot=button(u.buy+' · '+n(e.price(i.id)),'buyMode','primary','data-item="'+i.id+'"',lv<t.level||s.coins<e.price(i.id)||!e.itemUnlocked(s,i));
    } else if(sheet==='upgrade'){
      var o=selectedObject();if(!o){close();return;}var i=e.items[o.item],bonus=e.combinations(s).bonuses[o.uid]||0;title=u.upgrade;subtitle=i.name+' · '+o.level+' → '+(o.level+1)+u.grade;
      body='<div class="item-preview">'+sprite(i.id)+'<div><h3>'+i.name+'</h3><p>'+u.upgradeStep+'</p></div></div><div class="facts"><div>'+u.currentRate+'<strong>'+decimal(e.baseRate(o)*(1+bonus))+'</strong></div><div>'+u.afterUpgrade+'<strong>'+decimal((e.baseRate(o)+c.tiers[i.tier-1].income*c.economy.levelGain)*(1+bonus))+'</strong></div><div>'+u.upgradePrice+'<strong>'+n(e.upgradeCost(o))+'</strong></div></div>';
      foot=button(u.upgrade+' · '+n(e.upgradeCost(o)),'upgrade','primary','',s.coins<e.upgradeCost(o));
    } else if(sheet==='journal'){
      title=u.journal;subtitle=u.endNote;body='<div class="tier-tabs">'+button(u.goals,'journalGoals',journalTab==='goals'?'active':'')+button(u.combinations,'journalCombos',journalTab==='combos'?'active':'')+'</div>';
      if(journalTab==='goals')c.goals.forEach(function(g){var done=s.goals.indexOf(g.id)>=0,value=e.goalValue(s,g);body+='<div class="goal-row"><div><h3>'+g.name+'</h3><p>'+g.line+' · '+Math.min(Math.floor(value),g.target)+' / '+g.target+'</p><p>'+u.goalReward+' '+n(g.coins)+u.moneyUnit+' / '+g.xp+u.xp+'</p></div>'+button(done?u.claimed:u.claim,'goal',done?'quiet':'primary','data-id="'+g.id+'"',done||value<g.target)+'</div>';});
      else {body+='<p class="hint">'+u.comboRule+'</p>';var active=e.combinations(s).active; c.combos.forEach(function(g){var on=active.some(function(x){return x.id===g.id;}),known=s.combos.indexOf(g.id)>=0;body+='<div class="combo-row '+(on?'active':'')+'"><h3>'+g.name+' <span class="small">+'+Math.round(g.bonus*100)+'% · '+(on?u.active:known?u.discover:u.unknown)+'</span></h3><div class="combo-icons">'+g.items.map(function(id){return '<div>'+sprite(id)+e.items[id].name+'</div>';}).join('')+'</div><p>'+g.line+'</p></div>';});}
    } else if(sheet==='album'){
      title=u.album;subtitle=u.fullCollection+' '+s.collection.length+' / '+c.items.length;body='<p class="hint">'+u.collectionRule+'</p><div class="collection-grid">'+c.items.map(function(i){var known=s.collection.indexOf(i.id)>=0;return '<div class="collection-item '+(!known?'unknown':'')+'">'+sprite(i.id)+i.name+'<span>'+c.tiers[i.tier-1].name+' · '+(known?u.owned:u.unknown)+'</span></div>';}).join('')+'</div>';
    } else if(sheet==='warehouse'){
      title=u.warehouse;subtitle=u.moveHint;var stored=s.objects.filter(function(o){return o.pos<0;});
      body=stored.length?stored.map(function(o){return '<div class="goal-row">'+(o.gift==='harbor'?'<span class="sprite">'+harborSprite(3)+'</span>':sprite(o.item))+'<div><h3>'+(o.gift==='harbor'?c.harbor.gift:e.items[o.item].name)+'</h3><p>'+o.level+u.grade+' · '+decimal(e.baseRate(o))+u.minute+'</p></div>'+button(u.replace,'replace','primary','data-uid="'+o.uid+'"')+'</div>';}).join(''):'<p class="empty-note">'+u.noStored+'</p>';
    } else if(sheet==='expand'){
      var ex=c.expansions[s.expansion+1];title=u.expand;subtitle=u.allPlaced+' '+s.objects.filter(function(o){return o.pos>=0;}).length+u.piece+' / '+e.slots(s)*c.layout.capacityMultiplier+u.grid;
      body='<div class="expand-map">'+c.areas.map(function(a,idx){var count=e.capacity(s,idx);return '<div>'+a.name+'<small>'+u.openGround+'</small></div>';}).join('')+'</div>';
      if(ex){body+='<p>'+u.freeEstateNote+'</p><div class="facts"><div>'+u.nextArea+'<strong>'+e.slots(s)*c.layout.capacityMultiplier+' → '+ex.slots*c.layout.capacityMultiplier+u.grid+'</strong></div><div>'+u.needLevel+'<strong>'+ex.level+'</strong></div><div>'+u.price+'<strong>'+n(ex.price)+'</strong></div></div>';foot=button(u.confirmExpand+' · '+n(ex.price),'confirmExpand','primary','',lv<ex.level||s.coins<ex.price);}
      else body+='<p class="empty-note">'+u.full+'</p>';
    } else if(sheet==='offline'){
      title=u.offlineTitle;subtitle=u.offlineBody;body='<div class="offline-amount">+'+n(arrival.amount)+'</div><p class="offline-copy">'+u.coins+' · '+(arrival.capped?u.offlineCap+' '+e.hours(s)+u.hour:u.offlineDuration+' '+Math.floor(arrival.seconds/60)+' min')+'</p><p class="hint">'+u.bankLimit+' '+n(e.rate(s)*e.hours(s)*60)+' '+u.moneyUnit+'</p>';
      foot=button(u.collect,'collectOffline','primary','',s.bank<1);
    } else if(sheet==='guide'){
      title=u.guideTitle;body='<div class="prose">'+u.guideParagraphs.map(function(p){return '<p>'+p+'</p>';}).join('')+'</div><hr class="faint-divider">'+button(u.reset,'resetAsk','danger');
    } else if(sheet==='reset'){
      title=u.resetTitle;body='<p class="empty-note">'+u.resetBody+'</p>';foot=button(u.resetConfirm,'reset','danger');
    }
    modal.innerHTML='<div class="overlay garden-drawer '+(sheet==='manage'||sheet==='moments'?'hub-sheet ':'')+(drawerExpanded?'drawer-expanded':'')+'"><section class="sheet" role="dialog" aria-modal="false" aria-labelledby="sheet-title"><header class="sheet-header">'+button(drawerExpanded?u.drawerLess:u.drawerMore,'drawerSize','drawer-handle')+'<h2 id="sheet-title" tabindex="-1">'+title+'</h2>'+(subtitle?'<p>'+subtitle+'</p>':'')+'</header><div class="sheet-content">'+body+'</div><footer class="sheet-footer">'+button(sheet==='reset'?u.keep:u.close,'close','secondary')+foot+'</footer></section></div>';
    document.body.style.overflow='hidden';document.getElementById('sheet-title').focus();
  }
  function reveal(){}
  function startMode(item,uid){blueprintMode=null;var o=s.objects.find(function(x){return x.uid===uid;});viewing=false;groundTool=null;mode={item:item,uid:uid,gift:o&&o.gift,rotated:o?o.rotated:false,variant:o&&o.variant||0,size:o&&o.size!==undefined?o.size:1,skip:0};mode.point=o&&o.pos>=0?e.location(o):e.suggest(s,item,area,mode.rotated,uid,0,mode);selected=uid||null;close();render();document.querySelector('.main-layout').scrollTop=0;if(!mode.point)toast(u.noSpaceHint);}
  function snapPoint(p){if(!snapEnabled||!mode||['wall','moonwall','gate','gallery','corridor'].indexOf(mode.item)<0)return p;var gx=p.x+p.area%2*100,gy=p.y+Math.floor(p.area/2)*100;s.objects.filter(function(o){return o.pos>=0&&o.uid!==mode.uid&&(o.map||0)===(s.map||0)&&['wall','moonwall','gate','gallery','corridor'].indexOf(o.item)>=0;}).some(function(o){var at=e.location(o),ox=at.x+at.area%2*100,oy=at.y+Math.floor(at.area/2)*100,width=(e.items[o.item].visual.width+e.items[mode.item].visual.width)*.44;var target=gx<ox?ox-width:ox+width;if(Math.hypot(gx-target,gy-oy)<7){gx=target;gy=oy;return true;}return false;});var a=(gx>=100?1:0)+(gy>=100?2:0);return {area:a,x:gx-a%2*100,y:gy-Math.floor(a/2)*100};}

  function harborSprite(kind){return '<span class="harbor-sprite harbor-sprite-'+kind+'" aria-hidden="true"></span>';}
  function focusLake(){var v=document.getElementById('garden-viewport');if(!v)return;camera.zoom=Math.max(1,v.clientHeight/v.clientWidth);camera.x=v.clientWidth/2-v.clientWidth*camera.zoom*.52;camera.y=0;cameraApply();}
  function lakeArt(){return (s.map||0)===1&&s.lakeEdition===7?c.lakeScene.art:c.maps[s.map||0].art;}
  function findPoint(f){return e.lakeNew(s)&&c.lakeScene.finds[f.id]?c.lakeScene.finds[f.id]:[f.x,f.y];}
  function harborScene(){if(!e.lakeNew(s))return '';var h=e.harborState(s),p=e.lakeNew(s)?c.lakeScene.dock:[88,76];return '<button class="harbor-landmark '+(h.repaired?'repaired':'broken')+'" data-action="harbor" style="left:'+p[0]+'%;top:'+p[1]+'%" aria-label="'+u.harbor+'">'+harborSprite(h.repaired?1:0)+'<span class="landmark-label">'+(h.repaired?c.harbor.gift:u.harbor)+'</span></button>'+(h.repaired?'<div class="harbor-boat '+(h.guest==='shelter'?'sheltered':'')+'" style="left:'+(p[0]+8)+'%;top:'+(p[1]+4)+'%">'+harborSprite(2)+'</div>':'')+(h.guest==='shelter'?'<span class="harbor-egret" style="left:'+(p[0]-3)+'%;top:'+(p[1]-2)+'%" aria-hidden="true">'+'<svg viewBox="0 0 46 46"><path d="M11 30Q16 20 24 25Q30 28 27 18Q22 8 30 7L35 9L30 11Q28 13 32 20Q38 31 23 34L16 34Z" fill="#ede8d6" stroke="#8b7960" stroke-width="2"/><path d="M21 34v8m7-9v9" stroke="#8b7960" stroke-width="2"/></svg>'+'</span>':'');}
  function mountainScene(){if((s.map||0)!==2)return '';return '<button class="mountain-landmark" data-action="mountainView" style="left:23%;top:29%" aria-label="'+u.mountainView+'"><span class="mountain-summit" aria-hidden="true">△</span><span class="landmark-label">'+u.mountainView+'</span></button>';}
  function harborSheet(name){var h=e.harborState(s),v=c.harbor;
    if(name==='lakePreview'){var conflict=e.lakeConflicts(s);return {title:c.lakeScene.title,body:'<p>'+u.lakePreviewNote+'</p><img class="lake-preview-image" src="./assets/'+c.lakeScene.art+'" alt="'+c.lakeScene.line+'"><p>'+c.lakeScene.line+'</p>'+(conflict.objects.length?'<p>'+u.lakeConflicts+conflict.objects.map(function(uid){return e.items[s.objects.find(function(o){return o.uid===uid;}).item].name;}).join('、')+'</p>':'')+(conflict.ground?'<p>'+u.lakeGroundConflict+'</p>':'')+(!conflict.objects.length&&!conflict.ground?'<p>'+u.lakeClear+'</p>':''),foot:button(u.lakeKeep,'close','secondary')+button(u.lakeApply,'lakeApply','primary','',!!conflict.objects.length||conflict.ground)};}
    if(['harbor','harborWork','harborGuest','harborGuestWork'].indexOf(name)<0)return null;
    if((s.map||0)!==1)return {title:u.harbor,body:'<p>'+u.harborLocked+'</p>'};
    if(name==='harborGuestWork')return {title:v.guestTitle,body:'<p>'+v.guestStep+'</p>'+v.guestOptions.map(function(label,k){return button(label,'harborGuestAnswer','secondary','data-answer="'+k+'"');}).join('')};
    if(name==='harborGuest')return {title:v.guestTitle,body:'<div class="harbor-card-art">'+harborSprite(2)+'</div><p>'+v.guestIntro+'</p>'+(h.guest?'<p>'+(h.guest==='shelter'?v.guestShelterReply:v.guestFerryReply)+'</p>':button(v.guestShelter,'harborGuestShelter','primary','',s.coins<v.guestCost)+button(v.guestFerry,'harborGuestWork','secondary'))};
    if(name==='harborWork'&&!h.repaired){var step=v.steps[h.step];return {title:v.name+' · '+(h.step+1)+' / '+v.steps.length,body:'<p>'+v.bonusNote+'</p><h3>'+step.title+'</h3><p>'+step.body+'</p>'+step.options.map(function(label,k){return button(label,'harborStep','secondary','data-step="'+h.step+'" data-answer="'+k+'"');}).join('')};}
    return {title:v.name,body:'<div class="harbor-card-art">'+harborSprite(h.repaired?1:0)+'</div><div class="prose">'+(h.repaired?v.done:v.intro).split('\n').map(function(p){return '<p>'+p+'</p>';}).join('')+'</div>'+(h.repaired?(h.gift?'<p>'+v.giftNote+'</p>':button(u.harborGiftClaim,'harborGift','primary'))+(!h.bonus?button(v.check,'harborBonus','secondary'):'')+button(u.harborGuest,'harborGuest','secondary')+button(u.harborOverview,'harborOverview','quiet'):'<p>'+v.costNote+'</p><p>'+v.bonusNote+'</p>'+button(v.paid,'harborPay','primary','',s.coins<v.cost)+button(v.manual,'harborWork','secondary')+'<p>'+u.harborProgress+' '+h.step+' / '+v.steps.length+'</p>')};
  }
  function harborClick(a,b){
    if(a==='lakePreview'){open('lakePreview');return true;}
    if(a==='lakeApply'||a==='lakeOld'){if(doAction({type:'lakeEdition',edition:a==='lakeApply'?7:6})){close();render();if(e.lakeNew(s))focusLake();}return true;}
    if(['harbor','harborGuest','harborGuestWork'].indexOf(a)>=0){mode=null;blueprintMode=null;groundTool=null;open(a);return true;}
    if(a==='harborWork'){if((s.found||[]).indexOf('rope')<0){open('finds');toast(u.harborRope);}else open('harborWork');return true;}
    if(a==='harborOverview'){close();render();var p=e.lakeNew(s)?c.lakeScene.dock:[88,76],v=document.getElementById('garden-viewport');camera.zoom=2;camera.x=v.clientWidth/2-p[0]/100*v.clientWidth*2;camera.y=v.clientHeight/2-p[1]/100*v.clientWidth*2;cameraApply();return true;}
    if(a==='harborStep'){var k=Number(b.getAttribute('data-step')),answer=Number(b.getAttribute('data-answer')),miss=answer!==c.harbor.steps[k].answer;if(doAction({type:a,step:k,answer:answer})){if(e.harborState(s).repaired)sheet='harbor';render();drawSheet();if(miss)toast(c.harbor.steps[k].hint);}return true;}
    if(a==='harborGuestShelter'||a==='harborGuestAnswer'){var answer=Number(b.getAttribute('data-answer'));if(a==='harborGuestAnswer'&&answer!==c.harbor.guestAnswer){toast(c.harbor.guestHint);return true;}if(doAction({type:'harborGuest',choice:a==='harborGuestShelter'?'shelter':'ferry',answer:answer})){sheet='harborGuest';render();drawSheet();}return true;}
    if(['harborPay','harborGift','harborBonus'].indexOf(a)>=0){if(doAction({type:a})){render();drawSheet();if(a==='harborGift')toast(c.harbor.giftNote);if(a==='harborBonus')toast(c.harbor.checkBody);}return true;}
    return false;
  }
  function questRequirement(q){var r=q.require;return (r.kind==='special'?u.requireSpecial+' '+e.items[r.target].name:u[{placed:'requirePlaced',care:'requireCare',path:'requirePath',find:'requireFind'}[r.kind]])+' · '+e.questValue(s,q)+' / '+(r.kind==='special'?1:r.target);}
  function extraSheet(name){
    var harborPanel=harborSheet(name);if(harborPanel)return harborPanel;
    if(name==='atmosphere'){
      var atmospheres=[['clear',u.atmoClear,u.atmoClearHint,'sun'],['dusk',u.atmoDusk,u.atmoDuskHint,'dusk'],['rain',u.atmoRain,u.atmoRainHint,'rain']];
      return {title:u.atmosphereTitle,body:'<p class="drawer-intro">'+u.atmosphereHint+'</p><div class="atmosphere-options">'+atmospheres.map(function(a){return '<button type="button" class="atmosphere-card atmo-card-'+a[0]+' '+(atmosphere===a[0]?'active':'')+'" data-action="atmosphereChoice" data-atmosphere="'+a[0]+'"><span class="atmo-swatch atmo-swatch-'+a[3]+'" aria-hidden="true"></span><span class="atmo-copy"><b>'+a[1]+'</b><small>'+a[2]+'</small></span><span class="atmo-check">'+(atmosphere===a[0]?'✓':'')+'</span></button>';}).join('')+'</div>'};
    }
    if(name==='mountainView')return {title:u.mountainView,body:'<div class="mountain-card"><div class="portrait-row">'+portrait('visitor','calm')+portrait('xiaolian',mountainChoice==='home'?'relieved':'concerned')+'</div><div class="mountain-card-art">△</div><p>'+u.mountainViewBody+'</p><div class="mountain-choices">'+button('把灯留在山腰','mountainChoice','secondary','data-choice="lamp"')+button('带回院中','mountainChoice','secondary','data-choice="home"')+'</div><p class="hint" id="mountain-reply">'+u.mountainViewDone+'</p></div>',foot:button(u.close,'close','secondary')};
    if(name==='photo')return {title:u.photo,body:'<p>'+u.photoBody+'</p><div class="photo-preview"><img src="'+(photoData||'./assets/'+lakeArt())+'" alt="'+c.maps[s.map||0].name+'"><b>'+c.maps[s.map||0].name+' · '+(s.objects||[]).filter(function(o){return o.pos>=0&&(o.map||0)===(s.map||0);}).length+' '+u.photoObjects+'</b></div>',foot:button(u.photoAgain,'photo','primary')};
    if(name==='finds')return {title:u.finds,body:c.finds.filter(function(f){return f.map===(s.map||0);}).map(function(f){var done=(s.found||[]).indexOf(f.id)>=0;return '<article class="quest-card"><h3>'+f.name+'</h3><p>'+(done?f.reply:f.hint)+'</p>'+button(done?u.findDone:u.findLocate,'findLocate','secondary','data-id="'+f.id+'"',done)+'</article>';}).join('')};
    if(name==='maps')return {title:u.maps,body:c.maps.map(function(m){var owned=e.mapIds(s).indexOf(m.id)>=0;return '<article class="map-card"><img src="./assets/'+m.art+'" alt="'+m.name+'"><div><h3>'+m.name+'</h3><p>'+m.line+'</p><p>'+m.level+u.grade+' · '+n(m.price)+u.moneyUnit+'</p>'+button(owned?u.visit:u.unlockMap,owned?'visitMap':'unlockMap','primary','data-id="'+m.id+'"',!owned&&(e.level(s).value<m.level||s.coins<m.price))+(m.id===1&&owned?button(u.lakePreview,'lakePreview','secondary')+(s.lakeEdition===7?button(u.lakeOld,'lakeOld','quiet'):''):'')+'</div></article>';}).join('')};
    if(name==='quests')return {title:u.quests,body:((s.map||0)===1?'<article class="quest-card"><h3>'+c.harbor.name+'</h3><p>'+u.harborMapNote+'</p>'+button(u.harbor,'harbor','primary')+'</article>':'')+c.quests.filter(function(q){return q.map===(s.map||0);}).map(function(q){var done=(s.quests||{})[q.id];return '<article class="quest-card"><small>'+q.person+' · '+q.arcTitle+'</small><h3>'+q.title+'</h3><p>'+questRequirement(q)+'</p><p>'+u.questReward+' '+q.coins+u.moneyUnit+'</p>'+button(done?u.storyRecord:u.storyOpen,'questOpen','primary','data-id="'+q.id+'"',!done&&!e.questReady(s,q))+'</article>';}).join('')};
    if(name.indexOf('quest:')===0){var q=c.quests.find(function(q){return q.id===name.split(':')[1];}),done=(s.quests||{})[q.id],prev=q.stage?(s.quests||{})[q.arc+(q.stage-1)]:null;return {title:q.title,body:'<div class="prose">'+(prev?'<p>'+c.quests.find(function(x){return x.id===q.arc+(q.stage-1);}).options.find(function(o){return o.id===prev.choice;}).reply+'</p>':'')+'<p>'+q.body+'</p>'+(done?'<p>'+q.options.find(function(o){return o.id===done.choice;}).reply+'</p>'+(q.keepsakes?'<p>'+q.memorials[done.choice==='a'?0:1].name+' · '+q.options.find(function(o){return o.id===done.choice;}).label+'</p>':''):q.options.map(function(o){return button(o.label,'questChoice','secondary','data-id="'+q.id+'" data-choice="'+o.id+'"');}).join(''))+'</div>'};}
    if(name==='care'&&careSession){var step=c.care.steps[careSession.answers.length];return {title:u.care+' · '+(careSession.answers.length+1)+' / '+c.care.steps.length,body:'<div class="portrait-row single">'+portrait('xiaolian',careSession.answers.length?'relieved':'concerned')+'</div><div class="care-scene">'+sprite(careSession.item)+'</div><h3>'+step.title+'</h3><p>'+step.body+'</p><div class="care-choices">'+step.options.map(function(label,k){return button(label,'careAnswer','secondary','data-index="'+k+'"');}).join('')+'</div>'};}
    if(name==='blueprints')return {title:u.blueprints,body:c.blueprints.map(function(b){return '<article class="quest-card"><h3>'+b.name+'</h3><p>'+b.line+'</p><div class="combo-icons">'+b.parts.map(function(p){return '<div>'+sprite(p.item)+e.items[p.item].name+'</div>';}).join('')+'</div>'+button(u.blueprintPreview,'blueprintStart','primary','data-id="'+b.id+'"')+'</article>';}).join('')};
    return null;
  }
  function extraClick(a,b,id,item,uid){
    if(harborClick(a,b))return true;
    if(a==='atmosphereChoice'){atmosphere=b.getAttribute('data-atmosphere')||'clear';try{localStorage.setItem(c.storageKey+'-atmosphere',atmosphere);}catch(err){}close();render();toast((atmosphere==='clear'?u.atmoClear:atmosphere==='dusk'?u.atmoDusk:u.atmoRain)+' · '+u.atmosphere);return true;}
    if(a==='mountainView'){open('mountainView');return true;}
    if(a==='mountainChoice'){var choice=b.getAttribute('data-choice');mountainChoice=choice;try{localStorage.setItem(c.storageKey+'-mountain',choice);}catch(err){}var reply=choice==='lamp'?'灯留在山腰，替晚归的人照一段路。':'你把灯带回院中，窗下多了一点暖光。',node=document.getElementById('mountain-reply');if(node)node.textContent=reply;return true;}
    if(a==='photo'){photoCanvas();return true;}
    if(['maps','quests','blueprints','finds'].indexOf(a)>=0){open(a);return true;}
    if(a==='findLocate'){var f=c.finds.find(function(f){return f.id===id;});close();var v=document.getElementById('garden-viewport');camera.zoom=2;camera.x=v.clientWidth/2-findPoint(f)[0]/100*v.clientWidth*2;camera.y=v.clientHeight/2-findPoint(f)[1]/100*v.clientWidth*2;cameraApply();return true;}
    if(a==='find'){var f=c.finds.find(function(f){return f.id===id;});if(doAction({type:'find',id:id})){render();toast(f.reply+' +'+f.coins);}return true;}
    if(a==='snap'){snapEnabled=!snapEnabled;if(sheet)drawSheet();else render();return true;}
    if(a==='starter'){if(doAction({type:'starter'})){render();open('warehouse');toast(u.starterDone);}return true;}
    if(a==='unlockMap'){if(doAction({type:'unlockMap',id:Number(id)})){render();drawSheet();}return true;}
    if(a==='visitMap'){if(doAction({type:'visitMap',id:Number(id)})){selected=null;mode=null;blueprintMode=null;activePlan=null;groundTool=null;area=0;close();render();if(e.lakeNew(s))focusLake();else focusCourt(0);}return true;}
    if(a==='questOpen'){open('quest:'+id);return true;}
    if(a==='questChoice'){if(doAction({type:'quest',id:id,choice:b.getAttribute('data-choice')})){render();drawSheet();toast(u.questDone);}return true;}
    if(a==='care'){var o=selectedObject();if(!e.careEligible(s,o,Date.now())){toast(u.careWait);return true;}careSession={uid:o.uid,item:o.item,answers:[]};open('care');return true;}
    if(a==='careAnswer'){if(!careSession)return true;var k=careSession.answers.length,index=Number(b.getAttribute('data-index'));if(index!==c.care.steps[k].answer){toast(c.care.steps[k].hint);return true;}careSession.answers.push(index);if(careSession.answers.length===c.care.steps.length){var careAction={type:'care',uid:careSession.uid,answers:careSession.answers};careSession=null;close();var careCoins=s.coins;if(doAction(careAction)){render();toast(u.careDone+' +'+n(s.coins-careCoins));}}else drawSheet();return true;}
    if(a==='blueprintStart'){mode=null;selected=null;groundTool=null;activePlan=null;blueprintMode={id:id,area:area,x:50,y:55};var found=false;for(var yy=30;yy<=80&&!found;yy+=10)for(var xx=25;xx<=75&&!found;xx+=10){if(e.blueprint(s,id,area,xx,yy,Date.now()).ok){blueprintMode.x=xx;blueprintMode.y=yy;found=true;}}close();render();return true;}
    if(a==='cancelBlueprint'){blueprintMode=null;render();return true;}
    if(a==='confirmBlueprint'){if(blueprintMode&&doAction(Object.assign({type:'blueprint'},blueprintMode))){blueprintMode=null;render();}return true;}
    return false;
  }
  function onClick(ev){
    if(Date.now()<suppressClick&&ev.target.closest('#garden-viewport'))return;
    var b=ev.target.closest('button[data-action]');if(!b||b.disabled)return;var a=b.getAttribute('data-action'),id=b.getAttribute('data-id'),item=b.getAttribute('data-item'),uid=Number(b.getAttribute('data-uid'));
    if(extraClick(a,b,id,item,uid))return;
    if(a==='zoomIn'||a==='zoomOut'){zoomCamera(camera.zoom*(a==='zoomIn'?1.25:.8));return;}
    if(a==='photo'){photoCanvas();return;}
    if(a==='overview'){camera={zoom:1,x:0,y:0};cameraApply();return;}
    if(a==='atmosphere'){open('atmosphere');return;}
    if(a==='orientation'){screenMode=layoutMode()==='portrait'?'landscape':'portrait';try{localStorage.setItem(c.storageKey+'-orientation',screenMode);}catch(err){}camera={zoom:1,x:0,y:0};lastViewport=null;close();resize();render();if(e.lakeNew(s))focusLake();else focusCourt(area);return;}
    if(a==='panelToggle'){panelsCollapsed=!panelsCollapsed;return render();}
    if(a==='locate'){focusCourt(area);return;}
    if(a==='shopTier'){tier=Number(b.getAttribute('data-tier'));open('shop');return;}
    if(a==='momentCare'){var plant=s.objects.find(function(o){return o.uid===uid;});if(!plant||!e.careEligible(s,plant,Date.now())){toast(u.careWait);return;}selected=uid;careSession={uid:uid,item:plant.item,answers:[]};open('care');return;}
    if(a==='drawerSize'){if(Date.now()<suppressClick)return;drawerExpanded=!drawerExpanded;drawSheet();return;}
    if(a==='details'){detailsOpen=!detailsOpen;render();return;}
    if(a==='repeat'){repeatPlacement=!repeatPlacement;render();return;}
    if(a==='ground'||a==='waypoints'){open(a);return;}
    if(a==='groundTool'){groundTool=id;mode=null;selected=null;viewing=false;close();render();return;}
    if(a==='groundDone'){groundTool=null;render();return;}
    if(a==='clearGroundAsk'){open('clearGround');return;}
    if(a==='clearGround'){if(doAction({type:'clearGround'})){close();render();}return;}
    if(a==='manage'){open('manage');return;}
    if(a==='undo'||a==='redo'){layoutHistory(a);return;}
    if(a==='close'){close();return;}
    if(a==='view'){viewing=!viewing;close();render();if(viewing&&e.lakeNew(s))focusLake();document.querySelector('.main-layout').scrollTop=0;return;}
    if(a==='storyOpen'){storyReply=null;open('story:'+id);return;}
    if(a==='storyContinue'){storyReply=null;open('stories');return;}
    if(a==='storyChoose'){var stage=Number(b.getAttribute('data-stage')),choice=b.getAttribute('data-choice');if(doAction({type:'story',id:id,stage:stage,choice:choice})){storyReply={id:id,stage:stage,choice:choice};render();drawSheet();}return;}
    if(a==='variant'||a==='visualSize'){if(!mode)return;if(a==='variant')mode.variant=Number(b.getAttribute('data-variant'));else mode.size=Number(b.getAttribute('data-size'));render();return;}
    if(a==='selectFromList'){activePlan=null;selected=uid;var obj=selectedObject();if(obj)area=e.location(obj).area;close();render();focusCourt(area);reveal('.selection');return;}
    if(a==='planStop'){activePlan=null;render();return;}
    if(a==='plan'){activePlan=id;close();render();return;}
    if(a==='planItem'){var own=s.objects.find(function(o){return o.item===item;});if(own){if(own.pos>=0)area=e.location(own).area;startMode(item,own.uid);mode.point=e.suggest(s,item,area,mode.rotated,own.uid,0,mode);render();}else open('item:'+item);return;}
    if(a==='recommend'){mode.skip++;mode.point=e.suggest(s,mode.item,area,mode.rotated,mode.uid,mode.skip,mode);render();if(!mode.point)toast(u.noSpaceHint);return;}
    if(a==='nudge'){if(mode.point){var p=mode.point,gx=Math.max(0,Math.min(199.9,p.x+p.area%2*100+Number(b.getAttribute('data-dx')))),gy=Math.max(0,Math.min(199.9,p.y+Math.floor(p.area/2)*100+Number(b.getAttribute('data-dy'))));area=(gx>=100?1:0)+(gy>=100?2:0);mode.point={x:gx%100,y:gy%100,area:area};render();}return;}
    if(a==='confirmPlace'){if(!mode||!mode.point)return;var moved=!!mode.uid;if(doAction({type:moved?'move':'buy',item:mode.item,uid:mode.uid,area:area,x:mode.point.x,y:mode.point.y,rotated:mode.rotated,variant:mode.variant,size:mode.size})){selected=moved?mode.uid:s.nextId-1;var again=!moved&&repeatPlacement,againItem=mode.item;mode=null;if(again)startMode(againItem,null);else render();toast(moved?u.successMove:u.successBuy);}return;}
    if(a==='home'){blueprintMode=null;groundTool=null;viewing=false;mode=null;selected=null;close();render();document.querySelector('.main-layout').scrollTop=0;return;}
    if(a==='shop'||a==='album'||a==='warehouse'||a==='guide'||a==='expand'||a==='stories'||a==='plans'||a==='objects'||a==='moments'){open(a);return;}
    if(a==='journal'||a==='combos'){journalTab=a==='combos'?'combos':'goals';open('journal');return;}
    if(a==='journalGoals'||a==='journalCombos'){journalTab=a==='journalGoals'?'goals':'combos';drawSheet();return;}
    if(a==='tier'){tier=Number(b.getAttribute('data-tier'));drawSheet();return;}
    if(a==='item'){open('item:'+item);return;}
    if(a==='buyMode'){startMode(item,null);return;}
    if(a==='area'){var next=Number(b.getAttribute('data-area'));close();area=next;selected=null;if(mode){mode.point=e.suggest(s,mode.item,area,mode.rotated,mode.uid,0,mode);mode.skip=0;}render();focusCourt(area);return;}
    if(a==='plot'){
      var pos=Number(b.getAttribute('data-pos'));if(pos>=e.slots(s)){open('expand');return;}
      if(!mode){open('shop');return;}var moving=!!mode.uid;
      if(doAction({type:moving?'move':'buy',item:mode.item,uid:mode.uid,pos:pos,rotated:mode.rotated,variant:mode.variant,size:mode.size})){selected=moving?mode.uid:s.nextId-1;mode=null;render();toast(moving?u.successMove:u.successBuy);}return;
    }
    if(a==='cancel'){mode=null;render();return;}
    if(a==='rotate'){mode.rotated=!mode.rotated;render();toast(u.rotation);return;}
    if(a==='select'){if(groundTool||blueprintMode)return;activePlan=null;selected=uid;var picked=selectedObject();if(picked)area=e.location(picked).area;render();reveal('.selection');return;}
    if(a==='move'){var o=selectedObject();if(o)startMode(o.item,o.uid);return;}
    if(a==='replace'){var o=s.objects.find(function(x){return x.uid===uid;});if(o)startMode(o.item,o.uid);return;}
    if(a==='store'){if(doAction({type:'store',uid:selected})){selected=null;render();toast(u.successStore);}return;}
    if(a==='upgradeInfo'){open('upgrade');return;}
    if(a==='upgrade'){if(doAction({type:'upgrade',uid:selected})){close();render();toast(u.successUpgrade);}return;}
    if(a==='collect'||a==='collectOffline'){var amount=Math.floor(s.bank);if(doAction({type:'collect'})){if(a==='collectOffline')close();render();if(sheet)drawSheet();if(amount>0)toast('+'+n(amount)+' '+u.moneyUnit);}return;}
    if(a==='goal'){if(doAction({type:'goal',id:id})){render();if(sheet)drawSheet();toast(u.successGoal);}return;}
    if(a==='confirmExpand'){if(doAction({type:'expand'})){close();render();toast(u.successExpand);}return;}
    if(a==='night'){if(doAction({type:'night'}))render();return;}
    if(a==='resetAsk'){open('reset');return;}
    if(a==='reset'){s=e.fresh(Date.now());corrupt=false;storageError=false;try{raw=localStorage.getItem(c.storageKey);}catch(err){storageError=true;}mode=null;selected=null;area=0;camera={zoom:1,x:0,y:0};save();close();render();}
  }
  document.addEventListener('click',onClick);
  document.addEventListener('pointerdown',function(ev){var list=ev.target.closest('.sheet-content');if(!list||ev.pointerType!=='touch'||rotation()==='none')return;sheetScroll={id:ev.pointerId,list:list,y:virtualPoint(ev.clientX,ev.clientY).y,top:list.scrollTop};});
  document.addEventListener('pointermove',function(ev){if(!sheetScroll||sheetScroll.id!==ev.pointerId)return;var delta=virtualPoint(ev.clientX,ev.clientY).y-sheetScroll.y;if(Math.abs(delta)>3){ev.preventDefault();sheetScroll.list.scrollTop=sheetScroll.top-delta;}},{passive:false});
  ['pointerup','pointercancel'].forEach(function(name){document.addEventListener(name,function(ev){if(sheetScroll&&sheetScroll.id===ev.pointerId)sheetScroll=null;});});
  document.addEventListener('pointerdown',function(ev){if(ev.target.closest('.drawer-handle'))drawerDrag={y:virtualPoint(ev.clientX,ev.clientY).y};});
  document.addEventListener('pointerup',function(ev){if(!drawerDrag)return;var delta=virtualPoint(ev.clientX,ev.clientY).y-drawerDrag.y;drawerDrag=null;if(Math.abs(delta)>35){suppressClick=Date.now()+500;if(delta>100)close();else{drawerExpanded=delta<0;drawSheet();}}});

  document.addEventListener('click',function(ev){if(viewing||Date.now()<suppressClick||!ev.target.closest('#garden-scene')||ev.target.closest('.harbor-landmark,.find-spot,.keepsake'))return;if(blueprintMode){var at=pointAt(ev.clientX,ev.clientY);blueprintMode.area=at.area;blueprintMode.x=at.x;blueprintMode.y=at.y;render();return;}if(!mode)return;var p=pointAt(ev.clientX,ev.clientY);area=p.area;mode.point=snapPoint(p);render();});
  function dragPreview(p){
    if(!mode)return;p=snapPoint(p);area=p.area;mode.point=p;
    var wp=worldPoint(p),ghost=document.querySelector('.ghost'),ring=document.querySelector('.landing-ring'),valid=e.canLand(s,mode.item,area,p.x,p.y,mode.rotated,mode.uid,mode);
    if(ghost){ghost.style.left=wp.x+'%';ghost.style.top=wp.y+'%';ghost.style.zIndex=Math.round(wp.y);}
    if(ring){ring.style.left=wp.x+'%';ring.style.top=wp.y+'%';ring.className='landing-ring '+(valid?'valid':'invalid');}
    var status=document.querySelector('.landing-status'),confirm=document.querySelector('[data-action="confirmPlace"]');if(status)status.textContent=valid?u.placementGood:placementReason();if(confirm)confirm.disabled=!valid;
  }
  function down(ev){
    if(!ev.target.closest('#garden-viewport')||(ev.button!==undefined&&ev.button!==0))return;
    var start=virtualPoint(ev.clientX,ev.clientY);pointers[ev.pointerId]=start;var ids=Object.keys(pointers);
    if(ids.length===2){if(mode&&gesture&&gesture.original){mode.point=gesture.original;area=mode.point.area;render();}stroke=null;var oldGround=document.querySelector('.ground-layer');if(oldGround)oldGround.outerHTML=groundSvg();var a=pointers[ids[0]],b=pointers[ids[1]];gesture={kind:'pinch',distance:Math.hypot(a.x-b.x,a.y-b.y)};suppressClick=Date.now()+500;return;}
    if(groundTool&&!viewing){stroke={kind:groundTool,points:[groundPoint(ev.clientX,ev.clientY)]};gesture={kind:'ground'};return;}
    var object=ev.target.closest('.placed'),uid=object?Number(object.getAttribute('data-uid')):null;
    gesture={kind:mode&&!viewing&&uid===-1?'place':!mode&&object&&!viewing&&uid===selected?'object':'pan',uid:uid,x:start.x,y:start.y,startX:start.x,startY:start.y,original:mode&&mode.point?Object.assign({},mode.point):null,moved:false};
  }
  function movePointer(ev){
    if(!pointers[ev.pointerId]||!gesture)return;ev.preventDefault();var current=virtualPoint(ev.clientX,ev.clientY);pointers[ev.pointerId]=current;var ids=Object.keys(pointers);
    if(ids.length>=2){var a=pointers[ids[0]],b=pointers[ids[1]],distance=Math.hypot(a.x-b.x,a.y-b.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},physical=rotation()==='clockwise'?{x:window.innerWidth-center.y,y:center.x}:rotation()==='counterclockwise'?{x:center.y,y:window.innerHeight-center.x}:center;if(gesture.distance>0)zoomCamera(camera.zoom*distance/gesture.distance,physical.x,physical.y);gesture.distance=distance;gesture.kind='pinch';suppressClick=Date.now()+500;return;}
    if(gesture.kind==='pinch')return;
    if(gesture.kind==='ground'){var gp=groundPoint(ev.clientX,ev.clientY),prev=stroke.points[stroke.points.length-1];if(Math.hypot(gp[0]-prev[0],gp[1]-prev[1])>.35&&stroke.points.length<120){stroke.points.push(gp);var layer=document.querySelector('.ground-layer');if(layer)layer.outerHTML=groundSvg();}suppressClick=Date.now()+500;return;}
    if(!gesture.moved&&Math.hypot(current.x-gesture.startX,current.y-gesture.startY)<6)return;
    gesture.moved=true;suppressClick=Date.now()+500;
    if(gesture.kind==='object'){
      var o=s.objects.find(function(o){return o.uid===gesture.uid;});if(!o)return;selected=o.uid;area=e.location(o).area;mode={item:o.item,uid:o.uid,gift:o.gift,keepFrame:true,rotated:o.rotated,variant:o.variant||0,size:o.size===undefined?1:o.size,skip:0,point:e.location(o)};gesture.kind='place';gesture.original=Object.assign({},mode.point);render();
    }
    if(gesture.kind==='place'){var vr=virtualRect(document.getElementById('garden-viewport'));camera.x+=current.x<vr.left+25?6:current.x>vr.right-25?-6:0;camera.y+=current.y<vr.top+90?6:current.y>vr.bottom-170?-6:0;cameraApply();dragPreview(pointAt(ev.clientX,ev.clientY));}
    else {camera.x+=current.x-gesture.x;camera.y+=current.y-gesture.y;cameraApply();}
    gesture.x=current.x;gesture.y=current.y;
  }
  function up(ev){
    if(!pointers[ev.pointerId])return;delete pointers[ev.pointerId];
    if(Object.keys(pointers).length)return;
    if(gesture&&gesture.kind==='ground'){if(stroke&&snapEnabled){var pts=stroke.points;[0,pts.length-1].forEach(function(k){var p=pts[k];(s.ground||[]).filter(function(g){return (g.map||0)===(s.map||0)&&g.kind===stroke.kind;}).forEach(function(g){[g.points[0],g.points[g.points.length-1]].forEach(function(q){if(Math.hypot(p[0]-q[0],p[1]-q[1])<2)pts[k]=q.slice();});});});}if(ev.type!=='pointercancel'&&stroke&&stroke.points.length>1)doAction({type:'ground',kind:stroke.kind,points:stroke.points});stroke=null;suppressClick=Date.now()+500;render();}
    if(gesture&&(gesture.moved||gesture.kind==='pinch')){suppressClick=Date.now()+500;if(mode)render();}
    gesture=null;
  }
  if(window.PointerEvent){document.addEventListener('pointerdown',down);document.addEventListener('pointermove',movePointer,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);}
  else {
    document.addEventListener('mousedown',function(ev){down({target:ev.target,button:ev.button,pointerId:1,clientX:ev.clientX,clientY:ev.clientY});});
    document.addEventListener('mousemove',function(ev){movePointer({pointerId:1,clientX:ev.clientX,clientY:ev.clientY,preventDefault:function(){ev.preventDefault();}});});document.addEventListener('mouseup',function(){up({pointerId:1});});
    document.addEventListener('touchstart',function(ev){Array.prototype.forEach.call(ev.changedTouches,function(t){down({target:ev.target,pointerId:t.identifier,clientX:t.clientX,clientY:t.clientY});});},{passive:true});
    document.addEventListener('touchmove',function(ev){Array.prototype.forEach.call(ev.changedTouches,function(t){movePointer({pointerId:t.identifier,clientX:t.clientX,clientY:t.clientY,preventDefault:function(){ev.preventDefault();}});});},{passive:false});
    ['touchend','touchcancel'].forEach(function(name){document.addEventListener(name,function(ev){Array.prototype.forEach.call(ev.changedTouches,function(t){up({pointerId:t.identifier});});});});
  }
  window.addEventListener('blur',function(){pointers={};gesture=null;stroke=null;});
  document.addEventListener('wheel',function(ev){if(ev.target.closest('#garden-viewport')){ev.preventDefault();zoomCamera(camera.zoom*(ev.deltaY<0?1.12:1/1.12),ev.clientX,ev.clientY);}},{passive:false});
  document.addEventListener('keydown',function(ev){
    if(blueprintMode&&!sheet&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(ev.key)>=0){ev.preventDefault();blueprintMode.x+=ev.key==='ArrowLeft'?-2:ev.key==='ArrowRight'?2:0;blueprintMode.y+=ev.key==='ArrowUp'?-2:ev.key==='ArrowDown'?2:0;render();document.getElementById('garden-scene').focus();return;}
    if(!sheet&&!mode&&document.activeElement.id==='garden-scene'){if(ev.key==='+'||ev.key==='='){ev.preventDefault();zoomCamera(camera.zoom*1.25);}else if(ev.key==='-'){ev.preventDefault();zoomCamera(camera.zoom*.8);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(ev.key)>=0){ev.preventDefault();camera.x+=ev.key==='ArrowLeft'?35:ev.key==='ArrowRight'?-35:0;camera.y+=ev.key==='ArrowUp'?35:ev.key==='ArrowDown'?-35:0;cameraApply();}}
    if(mode&&!sheet&&document.activeElement.id==='garden-scene'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(ev.key)>=0){ev.preventDefault();if(mode.point){mode.point.x+=ev.key==='ArrowLeft'?-2:ev.key==='ArrowRight'?2:0;mode.point.y+=ev.key==='ArrowUp'?-2:ev.key==='ArrowDown'?2:0;render();document.getElementById('garden-scene').focus();}}
    if(ev.key==='Escape'){if(sheet)close();else if(mode){mode=null;render();}}
    if(ev.key==='Tab'&&sheet){var nodes=modal.querySelectorAll('button:not([disabled]),[tabindex="0"]'),first=nodes[0],last=nodes[nodes.length-1];if(ev.shiftKey&&(document.activeElement===first||document.activeElement.id==='sheet-title')){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}
  });
  function resize(){var turned=rotation()!=='none';document.documentElement.style.setProperty('--screen-height',(turned?window.innerWidth:window.innerHeight)+'px');document.documentElement.style.setProperty('--screen-width',(turned?window.innerHeight:window.innerWidth)+'px');document.documentElement.style.setProperty('--physical-width',window.innerWidth+'px');document.documentElement.style.setProperty('--physical-height',window.innerHeight+'px');}
  window.addEventListener('resize',function(){var now=window.innerWidth>window.innerHeight?'landscape':'portrait',changed=now!==physicalOrientation;physicalOrientation=now;if(changed)screenMode='auto';resize();render();if(changed){if(e.lakeNew(s))focusLake();else focusCourt(area);}if(sheet)drawSheet();});resize();
  window.addEventListener('storage',function(ev){if(ev.key===c.storageKey)readNew();});
  function tick(){e.advance(s,Date.now());renderStats();ticks++;if(ticks%10===0){save();var status=document.querySelector('.storage-status');if(status){status.textContent=notice();status.className='storage-status '+(storageError||corrupt?'error':'');}}}
  function startTimer(){if(timer)clearInterval(timer);timer=setInterval(tick,1000);}
  document.addEventListener('visibilitychange',function(){if(document.hidden){clearInterval(timer);timer=null;e.advance(s,Date.now());save();}else{readNew();arrival=e.advance(s,Date.now());save();render();if(arrival.seconds>=60&&arrival.amount>=1)open('offline');startTimer();}});
  window.addEventListener('pagehide',function(){e.advance(s,Date.now());save();});
  save();render();if(e.lakeNew(s))focusLake();else focusCourt(area);if(loaded.migrated)toast(u.migration);if(!corrupt&&arrival.seconds>=60&&arrival.amount>=1)open('offline');startTimer();
})();

