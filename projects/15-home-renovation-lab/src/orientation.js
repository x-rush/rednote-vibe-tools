// Rotate the application in either direction without device orientation APIs.
export function viewportRect(element){
  const r=element.getBoundingClientRect(),landscape=document.body.classList.contains('forced-landscape'),portrait=document.body.classList.contains('forced-portrait');if(!landscape&&!portrait)return r;
  const root=document.getElementById('app').getBoundingClientRect();
  if(portrait)return{left:root.bottom-r.bottom,top:r.left-root.left,width:element.clientWidth,height:element.clientHeight};
  return{left:r.top-root.top,top:root.right-r.right,width:element.clientWidth,height:element.clientHeight};
}
export function initializeOrientation(labels,beforeToggle){
  let requested=null,isLandscape=false,stableWidth=window.innerWidth,stableHeight=window.innerHeight;const activePointers=new Set(),root=document.getElementById('app');
  // Reuse the existing phone rules at their original cascade positions when the
  // logical portrait viewport differs from the physical browser viewport.
  const phoneMedia=[];
  for(const sheet of document.styleSheets){
    try{for(const rule of sheet.cssRules){if(rule.media&&/^\(max-width:\s*(700|760)px\)$/.test(rule.media.mediaText))phoneMedia.push({media:rule.media,original:rule.media.mediaText});}}catch{/* Ignore inaccessible third-party stylesheets. */}
  }
  const workspace=root.querySelector('.workspace'),header=root.querySelector('.topbar'),badge=root.querySelector('.campaign-badge');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='orientation-toggle';toggle.setAttribute('aria-pressed','false');workspace.appendChild(toggle);
  function update(){
    const width=window.innerWidth,height=window.visualViewport?window.visualViewport.height:window.innerHeight;
    const editing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
    const keyboard=editing&&width===stableWidth&&height<stableHeight-120;
    if(!keyboard){stableWidth=width;stableHeight=height;}
    const orientationHeight=keyboard?stableHeight:height;
    const physicalLandscape=width>orientationHeight;
    isLandscape=requested===null?physicalLandscape:requested==='landscape';
    const rotated=isLandscape&&!physicalLandscape,portrait=!isLandscape&&physicalLandscape,swapped=rotated||portrait;
    root.style.setProperty('--available-height',(swapped?width:height)+'px');
    root.style.setProperty('--rotation-width',(swapped?height:width)+'px');root.style.setProperty('--rotation-height',(swapped?width:height)+'px');root.style.setProperty('--physical-width',width+'px');root.style.setProperty('--physical-height',height+'px');
    document.body.classList.toggle('forced-landscape',rotated);
    document.body.classList.toggle('forced-portrait',portrait);
    for(const entry of phoneMedia)entry.media.mediaText=portrait?'all':entry.original;
    const natural=isLandscape&&physicalLandscape&&width<=1100&&orientationHeight<=600;
    document.body.classList.toggle('natural-landscape',natural);
    document.body.classList.toggle('compact-mode',swapped||natural||width<=700);
    const badgeParent=rotated||natural?header:workspace;
    if(badge&&badgeParent&&badge.parentElement!==badgeParent)badgeParent.appendChild(badge);
    toggle.hidden=false;
    toggle.textContent=isLandscape?labels.portrait:labels.landscape;toggle.setAttribute('aria-label',isLandscape?labels.portrait:labels.landscape);toggle.setAttribute('aria-pressed',String(isLandscape));
  }
  toggle.addEventListener('click',()=>{if(beforeToggle&&beforeToggle()===false)return;activePointers.clear();requested=isLandscape?'portrait':'landscape';update();window.dispatchEvent(new Event('resize'));});
  function normalize(e){
    const viewport=document.getElementById('viewport'),inside=viewport&&viewport.contains(e.target),tracked=activePointers.has(e.pointerId);
    if(e.type==='pointerdown'&&inside)activePointers.add(e.pointerId);
    if(e.type==='pointerup'||e.type==='pointercancel')activePointers.delete(e.pointerId);
    const landscape=document.body.classList.contains('forced-landscape'),portrait=document.body.classList.contains('forced-portrait');
    if((!landscape&&!portrait)||(!inside&&!tracked)||e.roomishCoordinates)return;
    const r=root.getBoundingClientRect(),x=portrait?r.bottom-e.clientY:e.clientY-r.top,y=portrait?e.clientX-r.left:r.right-e.clientX;
    Object.defineProperties(e,{clientX:{value:x,configurable:true},clientY:{value:y,configurable:true},pageX:{value:x,configurable:true},pageY:{value:y,configurable:true},roomishCoordinates:{value:true}});
  }
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','wheel','drop','dragover'])window.addEventListener(type,normalize,{capture:true,passive:true});
  window.addEventListener('resize',update);if(window.visualViewport)window.visualViewport.addEventListener('resize',update);update();
}
