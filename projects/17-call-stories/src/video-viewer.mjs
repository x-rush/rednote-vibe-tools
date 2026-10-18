import {videoTime} from './video-message.mjs';

const playIcon='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m11 6 17 10-17 10Z" fill="currentColor"/></svg>';
const pauseIcon='<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="5" width="6" height="22" rx="1.5" fill="currentColor"/><rect x="20" y="5" width="6" height="22" rx="1.5" fill="currentColor"/></svg>';

export function openVideoViewer({resource,labels:V,onClose}){
  const trigger=document.activeElement,dialog=document.createElement('div');
  dialog.className='chat-video-player';dialog.tabIndex=-1;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',V.play);
  // This chrome stays outside the chat surface and never appears in PNG exports.
  dialog.innerHTML='<video playsinline webkit-playsinline preload="metadata"></video><button class="video-player-close" data-video-close><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button><button class="video-player-center" data-video-toggle>'+playIcon+'</button><div class="video-player-controls"><button class="video-player-toggle" data-video-toggle></button><span class="video-player-time"></span><button class="video-player-speed" aria-expanded="false"></button><input class="video-player-seek" type="range" min="0" max="1" value="0" step="0.01"><div class="video-player-rates" role="group" hidden></div></div><p class="video-player-note" role="status"></p>';
  const video=dialog.querySelector('video'),close=dialog.querySelector('[data-video-close]'),center=dialog.querySelector('.video-player-center'),toggle=dialog.querySelector('.video-player-toggle'),time=dialog.querySelector('.video-player-time'),speed=dialog.querySelector('.video-player-speed'),seek=dialog.querySelector('.video-player-seek'),rates=dialog.querySelector('.video-player-rates'),note=dialog.querySelector('.video-player-note');
  video.poster=resource.posterUrl;video.playsInline=true;close.setAttribute('aria-label',V.close);seek.setAttribute('aria-label',V.seek);rates.setAttribute('aria-label',V.speed);
  let closed=false,timer=null,dragging=false;
  const duration=()=>Number.isFinite(video.duration)?video.duration:resource.duration;
  function reveal(){dialog.classList.remove('controls-hidden');clearTimeout(timer);if(!video.paused&&rates.hidden&&!dialog.classList.contains('is-keyboard'))timer=setTimeout(()=>dialog.classList.add('controls-hidden'),3000);}
  function update(){
    const paused=video.paused||video.ended;dialog.classList.toggle('is-paused',paused);center.hidden=!paused;
    toggle.innerHTML=paused?playIcon:pauseIcon;toggle.setAttribute('aria-label',paused?V.resume:V.pause);center.setAttribute('aria-label',V.resume);
    const total=duration()||0;seek.max=String(total||1);seek.disabled=!total;if(!dragging)seek.value=String(video.currentTime||0);
    seek.style.setProperty('--video-progress',total?(video.currentTime/total*100)+'%':'0%');seek.setAttribute('aria-valuetext',videoTime(video.currentTime)+' / '+videoTime(total));time.textContent=videoTime(video.currentTime)+' / '+videoTime(total);
    speed.textContent=video.playbackRate===1?V.speed:video.playbackRate+'×';speed.setAttribute('aria-label',V.speed+' '+video.playbackRate+'×');
    if(paused)reveal();
  }
  async function play(){note.textContent='';try{await video.play();if(!closed)reveal();}catch{if(!closed){note.textContent=video.error?V.playFailed:V.tapPlay;update();}}}
  function closeDialog(){if(closed)return;closed=true;clearTimeout(timer);video.pause();video.removeAttribute('src');video.load();dialog.remove();document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKey);for(const name of ['pointerup','mouseup','touchend','touchcancel'])window.removeEventListener(name,endSeek);onClose?.();if(document.contains(trigger))trigger.focus();}
  function onKey(event){
    if(event.key==='Escape'){event.preventDefault();if(!rates.hidden){rates.hidden=true;speed.setAttribute('aria-expanded','false');speed.focus();reveal();}else closeDialog();return;}
    dialog.classList.add('is-keyboard');reveal();
    if(event.key==='Tab'){const nodes=[...dialog.querySelectorAll('button,input')].filter(el=>!el.disabled&&el.getClientRects().length),first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    if(event.code==='Space'&&event.target===dialog){event.preventDefault();video.paused?play():video.pause();}
  }
  function endSeek(){dragging=false;update();reveal();}
  for(const name of ['pointerdown','mousedown','touchstart'])seek.addEventListener(name,()=>{dragging=true;clearTimeout(timer);},{passive:true});
  for(const name of ['pointerup','mouseup','touchend','touchcancel'])window.addEventListener(name,endSeek);
  seek.addEventListener('input',()=>{try{video.currentTime=Math.max(0,Math.min(duration(),Number(seek.value)));update();}catch{note.textContent=V.playFailed;}});
  seek.addEventListener('change',endSeek);
  speed.addEventListener('click',()=>{rates.hidden=!rates.hidden;speed.setAttribute('aria-expanded',String(!rates.hidden));reveal();});
  for(const rate of [.5,.75,1,1.25,1.5,2]){const button=document.createElement('button');button.type='button';button.textContent=rate+'×';button.dataset.videoRate=rate;button.setAttribute('aria-pressed',String(rate===1));button.addEventListener('click',()=>{try{video.playbackRate=rate;for(const item of rates.children)item.setAttribute('aria-pressed',String(item===button));rates.hidden=true;speed.setAttribute('aria-expanded','false');speed.focus();update();reveal();}catch{note.textContent=V.rateFailed;}});rates.append(button);}
  dialog.addEventListener('click',event=>{if(event.target.closest('[data-video-close]'))closeDialog();else if(event.target.closest('[data-video-toggle]')){video.paused||video.ended?play():video.pause();}else if(event.target===video||event.target===dialog){rates.hidden=true;speed.setAttribute('aria-expanded','false');if(dialog.classList.contains('controls-hidden')||video.paused)reveal();else{clearTimeout(timer);dialog.classList.add('controls-hidden');}}});
  dialog.addEventListener('pointerdown',()=>dialog.classList.remove('is-keyboard'));
  for(const event of ['timeupdate','loadedmetadata','play','pause','ended','ratechange'])video.addEventListener(event,update);
  video.addEventListener('error',()=>{note.textContent=V.playFailed;reveal();});
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';document.body.append(dialog);document.addEventListener('keydown',onKey);video.src=resource.url;update();dialog.focus();play();
  return closeDialog;
}
