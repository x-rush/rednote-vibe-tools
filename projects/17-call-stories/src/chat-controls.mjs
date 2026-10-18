import {escapeHtml as e} from './model.mjs';

export function voiceGesture(start,point,width){
  if(point.y>start.y-54)return 'send';
  return point.x<width*.48?'cancel':'text';
}

const keyboard='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h2m2 0h2m2 0h2m2 0h2M5 12h2m2 0h2m2 0h2m2 0h2M7 16h10"/></svg>';
export function createChatControls({host,config,icon,append,openMessage,changed,canSend,getMessage,setVoiceText,deleteMessage}){
  const state={mode:'text',panel:null,text:'',tab:'emoji',stickers:[],transcript:null};
  let active=null,limitTimer=null,suppressUntil=0,voicePress=null,voiceTimer=null,voiceSuppressUntil=0;
  const C=config;
  function toolbar(){
    const voice=state.mode==='voice';
    return `<div class="chat-controls"><div class="chat-fake-input chat-input-bar"><button type="button" class="chat-control-toggle ${voice?'keyboard-mode':''}" data-chat-control="mode" aria-label="${e(voice?C.keyboard:C.voice)}">${voice?keyboard:icon('voice')}</button>${voice?`<button type="button" class="chat-hold" data-chat-hold aria-label="${e(C.hold)}">${e(C.hold)}</button>`:`<div class="chat-compose-wrap"><textarea rows="1" data-chat-input maxlength="500" aria-label="${e(C.input)}">${e(state.text)}</textarea><button type="button" class="chat-compose-mic" data-chat-control="voice" aria-label="${e(C.voice)}">${icon('mic')}</button></div>`}<button type="button" class="chat-control-toggle" data-chat-control="emoji" aria-label="${e(state.panel==='emoji'?C.keyboard:C.emoji)}" aria-expanded="${state.panel==='emoji'}">${state.panel==='emoji'?keyboard:icon('smile')}</button><button type="button" class="chat-control-toggle chat-more ${state.text.trim()&&!voice?'chat-send-button':''}" data-chat-control="${state.text.trim()&&!voice?'send':'more'}" aria-label="${e(state.text.trim()&&!voice?C.send:C.more)}" aria-expanded="${state.panel==='more'}">${state.text.trim()&&!voice?e(C.send):icon('plus')}</button></div>${panel()}</div>`;
  }
  function panel(){
    if(state.panel==='more')return `<div class="chat-extra-panel chat-more-grid">${C.actions.map(a=>`<button type="button" data-chat-add-kind="${a.kind}"><span>${icon(a.icon)}</span><small>${e(a.label)}</small></button>`).join('')}</div>`;
    if(state.panel!=='emoji')return '';
    return `<div class="chat-extra-panel chat-emoji-panel"><div class="chat-emoji-tabs"><button data-chat-emoji-tab="emoji" aria-label="${e(C.emoji)}" aria-pressed="${state.tab==='emoji'}">${icon('smile')}</button><button data-chat-emoji-tab="stickers" aria-label="${e(C.stickers)}" aria-pressed="${state.tab==='stickers'}">${icon('heart')}</button><button data-chat-control="backspace" aria-label="${e(C.backspace)}">${keyboard}</button></div>${state.tab==='emoji'?`<div class="chat-emoji-grid">${C.emojis.map(t=>`<button data-chat-emoji="${e(t)}" aria-label="${e(t)}">${e(t)}</button>`).join('')}</div>`:`<p class="chat-sticker-heading">${e(C.stickers)}</p><div class="chat-sticker-grid"><label class="chat-sticker-upload" aria-label="${e(C.addSticker)}">${icon('plus')}<input type="file" accept="image/*" data-chat-sticker-upload></label>${state.stickers.map((s,i)=>`<button data-chat-sticker="${i}" aria-label="${e(C.sendSticker)}"><img src="${s.url}" alt=""></button>`).join('')}${state.stickers.length?'':`<p>${e(C.stickerEmpty)}</p>`}</div>`}</div>`;
  }
  function refresh(focus=false){changed();if(focus)host.querySelector('[data-chat-input]')?.focus();}
  function updateText(value){state.text=value.slice(0,500);const button=host.querySelector('.chat-more'),has=!!state.text.trim();if(!button)return;button.dataset.chatControl=has?'send':'more';button.classList.toggle('chat-send-button',has);button.setAttribute('aria-label',has?C.send:C.more);button.innerHTML=has?e(C.send):icon('plus');}
  function scrollEnd(){const body=host.querySelector('.chat-body');if(body)body.scrollTop=body.scrollHeight;}
  function sendText(){if(!state.text.trim()||!canSend())return;append('text',{text:state.text.trim()});state.text='';refresh(true);scrollEnd();}
  function handleClick(event){if(event.target.closest('[data-message-row]')&&Date.now()<voiceSuppressUntil){event.preventDefault();return true;}
    const control=event.target.closest('[data-chat-control]');
    if(control){const a=control.dataset.chatControl;if(a==='send'){sendText();return true;}if(a==='mode'||a==='voice'){state.mode=a==='voice'||state.mode==='text'?'voice':'text';state.panel=null;refresh(state.mode==='text');}else if(a==='emoji'){state.mode='text';state.panel=state.panel==='emoji'?null:'emoji';refresh();}else if(a==='more'){state.panel=state.panel==='more'?null:'more';refresh();}else if(a==='backspace'){state.text=Array.from(state.text).slice(0,-1).join('');refresh();}return true;}
    const emoji=event.target.closest('[data-chat-emoji]');if(emoji){state.text=Array.from(state.text+emoji.dataset.chatEmoji).join('').slice(0,500);refresh();return true;}
    const tab=event.target.closest('[data-chat-emoji-tab]');if(tab){state.tab=tab.dataset.chatEmojiTab;refresh();return true;}
    const add=event.target.closest('[data-chat-add-kind]');if(add){state.panel=null;openMessage(add.dataset.chatAddKind);return true;}
    const sticker=event.target.closest('[data-chat-sticker]');if(sticker){const resource=state.stickers[Number(sticker.dataset.chatSticker)];if(resource&&canSend())append('image',{resource,description:C.stickers});refresh();scrollEnd();return true;}
    if(event.target.closest('[data-chat-hold]')){if(Date.now()<suppressUntil)return true;return true;}
    return false;
  }
  async function uploadSticker(file){
    if(!file||!file.type.startsWith('image/'))return;
    const url=URL.createObjectURL(file),im=new Image();im.src=url;
    try{await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;});state.stickers.push({url,file,width:im.naturalWidth,height:im.naturalHeight});refresh();}catch{URL.revokeObjectURL(url);}
  }
  function overlay(){
    if(!active)return;
    let node=document.querySelector('.chat-record-overlay');if(!node){node=document.createElement('div');node.className='chat-record-overlay';node.setAttribute('role','status');node.setAttribute('aria-live','polite');document.body.append(node);}
    const mode=active.target,bars=Array.from({length:27},(_,i)=>`<i style="--bar:${8+((i*17+11)%30)}px;--delay:${(i%7)*-.11}s"></i>`).join('');
    node.dataset.recordState=mode;
    node.innerHTML=`<div class="record-bubble"><span class="record-caret"></span><div class="record-wave">${bars}</div></div><div class="record-slide-label">${e(mode==='cancel'?C.releaseCancel:mode==='text'?C.releaseEdit:'')}</div><div class="record-side-zones"><div class="record-cancel-zone">${e(C.cancel)}</div><div class="record-text-zone">${e(C.slideText)}</div></div><div class="record-send-zone"><span>${e(mode==='send'?C.releaseSend:C.voiceLabel)}</span></div>`;
  }
  function begin(event,button){
    if(active||!canSend())return;
    event.preventDefault();const r=button.getBoundingClientRect();active={start:{x:event.clientX??r.left+r.width/2,y:event.clientY??r.top+r.height/2},at:Date.now(),target:'send',button,pointerId:event.pointerId};
    if(event.pointerId!==undefined)try{button.setPointerCapture(event.pointerId);}catch{}
    overlay();limitTimer=setTimeout(()=>finish(false),60000);
  }
  function move(event){if(!active||event.pointerId!==active.pointerId)return;event.preventDefault();const next=voiceGesture(active.start,{x:event.clientX,y:event.clientY},window.innerWidth);if(next!==active.target){active.target=next;overlay();}}
  function cleanup(){clearTimeout(limitTimer);limitTimer=null;document.querySelector('.chat-record-overlay')?.remove();const old=active;active=null;suppressUntil=Date.now()+500;if(old?.pointerId!==undefined)try{old.button.releasePointerCapture(old.pointerId);}catch{}return old;}
  function finish(cancelled=false){const old=cleanup();if(!old||cancelled||old.target==='cancel')return;const elapsed=Date.now()-old.at;if(elapsed<350)return;const seconds=Math.max(1,Math.min(60,Math.round(elapsed/1000)));if(old.target==='text'){state.transcript='';showTranscript();}else{if(!canSend())return;append('voice',{seconds,transcript:'',showTranscript:false});refresh();scrollEnd();}}
  function showVoiceTranscript(index){const message=getMessage(index);if(message?.kind!=='voice')return;state.transcript=message.transcript||'';showTranscript({index});}
  function showTranscript(options={}){
    const editing=options.index!==undefined,title=editing?C.voiceTextTitle:C.editText;
    const node=document.createElement('div');node.className='chat-transcript-overlay';node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-label',title);
    node.innerHTML=`<section><h2>${e(title)}</h2><div class="record-transcript-bubble"><textarea maxlength="500" data-record-text aria-label="${e(title)}" placeholder="${e(C.textPlaceholder)}">${e(state.transcript||'')}</textarea></div><p>${e(editing?C.voiceTextNote:C.transcriptNote)}</p><div><button data-record-cancel>${e(C.cancel)}</button><button data-record-send ${state.transcript?.trim()?'':'disabled'}>${e(editing?C.saveVoiceText:C.send)}</button></div></section>`;
    const close=()=>{node.remove();state.transcript=null;(editing?host.querySelector('[data-voice-transcript="'+options.index+'"]'):host.querySelector('[data-chat-hold]'))?.focus();};node.querySelector('textarea').addEventListener('input',event=>{state.transcript=event.target.value;node.querySelector('[data-record-send]').disabled=!state.transcript.trim();});
    node.querySelector('[data-record-cancel]').addEventListener('click',close);node.querySelector('[data-record-send]').addEventListener('click',()=>{if(!state.transcript?.trim())return;if(editing){setVoiceText(options.index,state.transcript.trim());close();refresh();}else if(canSend()){append('text',{text:state.transcript.trim()});close();refresh();scrollEnd();}});
    node.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}if(event.key==='Tab'){const list=[...node.querySelectorAll('textarea,button:not(:disabled)')],first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});document.body.append(node);node.querySelector('textarea').focus();
  }
  function clearVoicePress(){clearTimeout(voiceTimer);voiceTimer=null;voicePress=null;}
  function closeVoiceMenu(){document.querySelector('.voice-message-menu')?.remove();}
  function messageMenu(anchor){closeVoiceMenu();const row=anchor.closest('[data-message-row]'),index=Number(row?.dataset.messageRow),m=getMessage(index);if(!m)return;voiceSuppressUntil=Date.now()+900;const node=document.createElement('div');node.className='voice-message-menu';node.setAttribute('role','menu');
    const addAction=(label,kind,run)=>{const action=document.createElement('button');action.type='button';action.dataset.messageMenuAction=kind;action.setAttribute('role','menuitem');action.textContent=label;action.addEventListener('click',()=>{closeVoiceMenu();run();});node.append(action);};
    if(m.kind==='voice')addAction(m.transcript?C.editVoiceText:C.convertVoice,'transcript',()=>showVoiceTranscript(index));
    addAction(C.deleteMessage,'delete',()=>{deleteMessage(index);refresh();});document.body.append(node);const r=anchor.getBoundingClientRect(),safe=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top'))||0;node.style.left=Math.max(12,Math.min(innerWidth-node.offsetWidth-12,r.left+r.width/2-node.offsetWidth/2))+'px';node.style.top=Math.max(safe+64,Math.min(innerHeight-node.offsetHeight-16,r.top-node.offsetHeight-12))+'px';node.addEventListener('keydown',event=>{if(event.key==='Escape'){closeVoiceMenu();row.focus();}if(event.key==='Tab'){const buttons=[...node.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});node.querySelector('button').focus();}
  host.addEventListener('pointerdown',event=>{const bubble=event.target.closest('.message-stack,[data-message-row].chat-narration');if(!bubble||!event.isPrimary||event.button!==0)return;clearVoicePress();voicePress={id:event.pointerId,x:event.clientX,y:event.clientY};voiceTimer=setTimeout(()=>{if(voicePress)messageMenu(bubble);},500);});
  host.addEventListener('pointermove',event=>{if(voicePress&&event.pointerId===voicePress.id&&Math.hypot(event.clientX-voicePress.x,event.clientY-voicePress.y)>9)clearVoicePress();});
  host.addEventListener('pointerup',clearVoicePress);host.addEventListener('pointercancel',clearVoicePress);
  host.addEventListener('contextmenu',event=>{const bubble=event.target.closest('.message-stack,[data-message-row].chat-narration');if(bubble){event.preventDefault();clearVoicePress();messageMenu(bubble);}});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.voice-message-menu'))closeVoiceMenu();});
  host.addEventListener('input',event=>{if(event.target.matches('[data-chat-input]')){updateText(event.target.value);event.target.style.height='auto';event.target.style.height=Math.min(100,event.target.scrollHeight)+'px';}});
  host.addEventListener('change',event=>{if(event.target.matches('[data-chat-sticker-upload]'))uploadSticker(event.target.files?.[0]);});
  host.addEventListener('pointerdown',event=>{const button=event.target.closest('[data-chat-hold]');if(button&&event.isPrimary&&event.button===0)begin(event,button);});
  host.addEventListener('pointermove',move);host.addEventListener('pointerup',event=>{if(active&&event.pointerId===active.pointerId)finish();});host.addEventListener('pointercancel',event=>{if(active&&event.pointerId===active.pointerId)finish(true);});host.addEventListener('lostpointercapture',event=>{if(active&&event.pointerId===active.pointerId)finish(true);});
  host.addEventListener('keydown',event=>{if(event.target.matches('[data-chat-input]')&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();sendText();}if(event.target.matches('[data-chat-hold]')&&(event.key===' '||event.key==='Enter')&&!event.repeat)begin(event,event.target);if(event.key==='Escape'&&active)finish(true);});
  host.addEventListener('keyup',event=>{if(event.target.matches('[data-chat-hold]')&&(event.key===' '||event.key==='Enter')){event.preventDefault();finish();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearVoicePress();closeVoiceMenu();finish(true);}});window.addEventListener('blur',()=>{clearVoicePress();closeVoiceMenu();finish(true);});
  function reset(){clearVoicePress();closeVoiceMenu();finish(true);state.panel=null;state.text='';state.transcript=null;document.querySelector('.chat-transcript-overlay')?.remove();}
  return {toolbar,handleClick,reset,showVoiceTranscript};
}
