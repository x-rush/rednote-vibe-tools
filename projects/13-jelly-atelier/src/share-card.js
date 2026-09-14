import {cardView} from './card-view.js';
import {attachCardDecor} from './card-decor.js';
import {paintCard} from './card-art.js';
import {saveCardToAlbum} from './album.js';
import {createAtelier} from './scene.js';
import {nextPhrase} from './decorations.js';
export function openShareCard(content,recipe,name,view){
  const s=content.share,dialog=document.createElement('dialog');dialog.className='share-dialog';
  const title=document.createElement('h2');title.textContent=s.title;
  const image=document.createElement('canvas');image.width=1080;image.height=1440;image.className='share-card stationery-preview';image.setAttribute('aria-label',s.title);
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent=s.working;
  const controls=document.createElement('div');controls.className='share-controls';
  function button(label,fn){const b=document.createElement('button');b.type='button';b.className='soft-button';b.textContent=label;b.onclick=fn;return b;}
  function input(label,value,max,multiline=false){const wrap=document.createElement('label');wrap.textContent=label;const box=document.createElement(multiline?'textarea':'input');if(multiline)box.rows=3;box.maxLength=max;box.value=value;wrap.append(box);controls.append(wrap);return box;}
  let phraseIndex=Math.floor(Math.random()*s.phrases.length),template=0,frame=null,studio=null,alive=true,busy=false,renderTicket=0,decor=null,currentView=null;
  const nameInput=input(s.name,name||'',content.ui.nameLimit),message=input(s.message,s.phrases[phraseIndex],48,true);
  const textLayout={size:40,offset:0,align:'left'};
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;const ctx=canvas.getContext('2d');
  function paint(){if(!alive||!frame)return;paintCard(ctx,frame,{template,name:nameInput.value,message:message.value,content,textLayout});decor?.draw(ctx);const preview=image.getContext('2d');preview.clearRect(0,0,1080,1440);preview.drawImage(canvas,0,0);decor?.outline(preview);}

  nameInput.oninput=paint;message.oninput=paint;
  controls.append(button(s.shuffle,()=>{phraseIndex=nextPhrase(phraseIndex,s.phrases.length);message.value=s.phrases[phraseIndex];paint();}));
  const styles=document.createElement('div');styles.className='card-style-choices';for(const [i,label] of s.templates.entries()){const choice=button(label,()=>{template=i;styles.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));paint();});choice.setAttribute('aria-pressed',String(i===0));styles.append(choice);}controls.prepend(styles);
  const host=document.createElement('div');host.className='share-render-host';document.body.append(host);
  async function renderFrame(useView){const ticket=++renderTicket;if(!studio||!alive)return;currentView=useView;if(document.fonts?.load){try{await document.fonts.load('34px JellyCard');}catch{}}if(!alive||ticket!==renderTicket)return;studio.setView(cardView(view,Boolean(useView)));for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);if(!alive||ticket!==renderTicket)return;frame=studio.snapshot();paint();status.textContent='';}
  controls.append(button(s.angle,()=>void renderFrame(null)),button(s.currentAngle,()=>void renderFrame(view)));
  decor=attachCardDecor({content,controls,image,button,paint,backgroundColor:view?.lightsOff?'#493d56':'#f5eee6',setBackground(value){studio?.setCardBackground(value);void renderFrame(currentView);}});
  const shimmerTimer=setInterval(()=>{if(!alive||!frame||document.hidden)return;const preview=image.getContext('2d');preview.clearRect(0,0,1080,1440);preview.drawImage(canvas,0,0);decor?.shimmer(preview,Date.now());decor?.outline(preview);},120);
  const save=button(s.save,async()=>{if(busy||!frame)return;const bridge=window.xhs?.miniTool;if(!bridge?.saveImageToPhotosAlbum){status.textContent=s.fallback;return;}busy=true;save.disabled=true;try{await saveCardToAlbum(bridge,canvas.toDataURL('image/png')); if(alive)status.textContent=s.success;}catch{if(alive)status.textContent=s.error;}finally{busy=false;save.disabled=false;}});save.className='primary';const actions=document.createElement('div');actions.className='share-actions';actions.append(save,button(s.close,()=>dialog.close()));
  dialog.append(title,image,status,controls,actions);document.body.append(dialog);dialog.addEventListener('close',()=>{alive=false;clearInterval(shimmerTimer);renderTicket++;decor?.dispose();studio?.dispose();host.remove();image.removeAttribute('src');canvas.width=canvas.height=0;dialog.remove();});dialog.showModal();
  try{studio=createAtelier(host,content,{preview:true,showcase:true,capture:true});studio.setRecipe(structuredClone(recipe),'ready',1);void renderFrame(null).catch(()=>{if(alive)status.textContent=s.renderError;});}catch{status.textContent=s.renderError;}
}
