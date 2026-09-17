// CSS-only landscape mode; no screen lock or fullscreen device APIs.
export function viewportRect(element){
  const r=element.getBoundingClientRect();if(!document.body.classList.contains('forced-landscape'))return r;
  const root=document.getElementById('app').getBoundingClientRect();
  return{left:r.top-root.top,top:root.right-r.right,width:element.clientWidth,height:element.clientHeight};
}
export function initializeOrientation(labels,beforeToggle){
  let requested=false,stableWidth=window.innerWidth,stableHeight=window.innerHeight;const activePointers=new Set(),root=document.getElementById('app');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='orientation-toggle';toggle.setAttribute('aria-pressed','false');root.querySelector('.workspace').appendChild(toggle);
  function update(){
    const width=window.innerWidth,height=window.visualViewport?window.visualViewport.height:window.innerHeight;
    const editing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
    const keyboard=editing&&width===stableWidth&&height<stableHeight-120;
    if(!keyboard){stableWidth=width;stableHeight=height;}
    const orientationHeight=keyboard?stableHeight:height;
    root.style.setProperty('--available-height',height+'px');
    const rotated=requested&&width<orientationHeight;
    root.style.setProperty('--rotation-width',(rotated?height:width)+'px');root.style.setProperty('--rotation-height',(rotated?width:height)+'px');root.style.setProperty('--physical-width',width+'px');
    document.body.classList.toggle('forced-landscape',rotated);
    const natural=!rotated&&width>orientationHeight&&width<=1100&&orientationHeight<=600;
    document.body.classList.toggle('natural-landscape',natural);
    document.body.classList.toggle('compact-mode',rotated||natural||width<=700);
    toggle.hidden=natural;
    toggle.textContent=requested?labels.portrait:labels.landscape;toggle.setAttribute('aria-label',requested?labels.portrait:labels.landscape);toggle.setAttribute('aria-pressed',String(requested));
  }
  toggle.addEventListener('click',()=>{if(beforeToggle&&beforeToggle()===false)return;activePointers.clear();requested=!requested;update();window.dispatchEvent(new Event('resize'));});
  function normalize(e){
    const viewport=document.getElementById('viewport'),inside=viewport&&viewport.contains(e.target),tracked=activePointers.has(e.pointerId);
    if(e.type==='pointerdown'&&inside)activePointers.add(e.pointerId);
    if(e.type==='pointerup'||e.type==='pointercancel')activePointers.delete(e.pointerId);
    if(!document.body.classList.contains('forced-landscape')||(!inside&&!tracked)||e.roomishCoordinates)return;
    const r=root.getBoundingClientRect(),x=e.clientY-r.top,y=r.right-e.clientX;
    Object.defineProperties(e,{clientX:{value:x,configurable:true},clientY:{value:y,configurable:true},pageX:{value:x,configurable:true},pageY:{value:y,configurable:true},roomishCoordinates:{value:true}});
  }
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','wheel','drop','dragover'])window.addEventListener(type,normalize,{capture:true,passive:true});
  window.addEventListener('resize',update);if(window.visualViewport)window.visualViewport.addEventListener('resize',update);update();
}
