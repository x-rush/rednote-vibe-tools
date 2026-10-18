import {escapeHtml as e} from './model.mjs';
import {videoTime} from './video-message.mjs';

export function renderMessageComposer({state,studio,data,avatar,person,icon,media,loading}){
  if(state.chatEdit===null&&!state.chatAdding)return '';
  const C=data.messageComposer,L=data.chatMessages.labels,m=state.chatChoosing?null:state.chatWorking;
  const typeIcon={text:'chat',voice:'mic',image:'camera',video:'video',location:'circle',transfer:'transfer',redpacket:'gift',contact:'people',narration:'edit'};
  const kinds=Object.keys(C.types),kind=m?.kind||'text';
  const input=(key,label,type='text',max=160)=>`<label class="composer-field"><span>${e(label)}</span><input data-composer-field="${key}" type="${type}" ${type==='number'?'min="0.01" max="999999.99" step="0.01"':''} maxlength="${max}" value="${e(m[key]||'')}"></label>`;
  const select=(key,label,values)=>`<label class="composer-field"><span>${e(label)}</span><select data-composer-field="${key}">${values.map(([value,text])=>`<option value="${value}" ${String(m[key])===String(value)?'selected':''}>${e(text)}</option>`).join('')}</select></label>`;
  const textArea=(key,label)=>`<label class="composer-field"><span>${e(label)}</span><textarea data-composer-field="${key}" maxlength="${kind==='narration'?1000:500}" placeholder="${e(C.placeholder)}">${e(m[key]||'')}</textarea></label>`;
  const upload=(map=false)=>{const photo=media.get(m.id)?.kind==='video'?null:media.get(m.id);return `<label class="composer-upload">${photo?`<img src="${photo.url}" alt="">`:icon(map?'circle':'camera')}<span>${e(photo?C.replace:map?C.uploadMap:C.uploadImage)}</span><input type="file" accept="image/*" data-composer-upload></label>${photo?`<button type="button" class="composer-type-back" data-action="composer-remove-media">${e(C.removeImage)}</button>`:''}`;};
  const role=(id,contact=false)=>`<button type="button" class="composer-person" data-action="${contact?'composer-contact':'chat-speaker-toggle'}">${avatar(id,'small')}<span><small>${e(contact?C.contact:C.speaker)}</small><strong>${e(person(id).name)}</strong></span><em>${e(C.change)} ${icon('back')}</em></button>`;
  let fields='';
  if(m){
    if(kind==='text'||kind==='narration'||kind==='call')fields=textArea('text',C.content);
    if(kind==='voice')fields=select('seconds',L.seconds,Array.from({length:60},(_,i)=>[i+1,`${i+1}″`]))+`<details class="composer-transcript" ${m.showTranscript||m.transcript?'open':''}><summary>${e(C.optionalTranscript)}</summary>${textArea('transcript',L.transcript)}<label class="composer-check"><input type="checkbox" data-composer-field="showTranscript" ${m.showTranscript?'checked':''}>${e(L.showTranscript)}</label></details><p class="composer-note">${e(C.voiceNote)}</p>`;
    if(kind==='image')fields=upload()+input('description',L.imageDescription);
    if(kind==='video'){
      const V=data.chatMessages.video,clip=media.get(m.id)?.kind==='video'?media.get(m.id):null,busy=loading?.has(m.id);
      fields=`<label class="composer-upload composer-video-upload" aria-busy="${!!busy}">${clip?.kind==='video'?`<span class="composer-video-cover"><img src="${e(clip.posterUrl)}" alt=""><small>${videoTime(clip.duration)}</small></span>`:icon('video')}<span>${e(busy?V.loading:clip?V.replace:V.choose)}</span><input type="file" accept="video/*,.mp4" data-composer-upload ${busy?'disabled':''}></label>${clip?`<button class="composer-type-back" data-action="composer-remove-media">${e(V.remove)}</button>`:''}<p class="composer-note" role="status">${e(V.note)}<br>${e(V.formatNote)}</p>`+input('description',V.description);
    }
    if(kind==='location')fields=input('title',L.locationTitle)+input('address',L.locationAddress)+upload(true);
    if(kind==='transfer')fields=input('amount',L.amount,'number')+select('status',L.state,[['pending',L.transferPending],['received',L.transferReceived],['returned',L.transferReturned]]);
    if(kind==='redpacket')fields=input('text',L.greeting)+select('status',L.state,[['pending',L.pending],['received',L.received]]);
    if(kind==='contact')fields=role(m.contactId,true)+input('wechatId',L.wechatId);
  }
  const choosing=state.chatPeople;
  const people=choosing?`<div class="composer-people">${studio.people.filter(p=>choosing==='contact'||studio.chat.members.includes(p.id)).map(p=>`<button type="button" data-composer-person="${p.id}">${avatar(p.id,'small')}<span>${e(p.name)}</span>${(choosing==='contact'?m.contactId:m.personId)===p.id?icon('check'):''}</button>`).join('')}</div>`:'';
  return `<div class="composer-overlay"><button class="composer-scrim" data-action="composer-cancel" aria-label="${e(C.close)}"></button><section class="message-composer" role="dialog" aria-modal="true" aria-label="${e(m?C.types[kind]||C.edit:C.choose)}"><div class="composer-handle" aria-hidden="true"></div><header class="composer-header"><div><h2>${e(m?C.types[kind]||C.edit:C.choose)}</h2>${m?`<button class="composer-type-back" data-action="composer-types">${e(C.back)}</button>`:''}</div><button class="composer-close" data-action="composer-cancel" aria-label="${e(C.close)}">${icon('close')}</button></header><div class="composer-body">${m?`${kind==='narration'?'':role(m.personId)}${people||`<div class="composer-fields">${fields}${state.chatEdit>=0?`<details class="composer-order"><summary>${e(C.order)}</summary><button data-composer-move="-1" ${state.chatEdit===0?'disabled':''}>${e(C.moveUp)}</button><button data-composer-move="1" ${state.chatEdit===studio.chat.messages.length-1?'disabled':''}>${e(C.moveDown)}</button></details>`:''}</div>`}`:`<div class="composer-type-grid">${kinds.map(k=>`<button type="button" data-composer-kind="${k}"><span>${icon(typeIcon[k])}</span><strong>${e(C.types[k])}</strong></button>`).join('')}</div>`}</div>${m?`<footer class="composer-footer">${state.chatEdit>=0?`<button class="composer-delete" data-action="chat-delete">${e(C.delete)}</button>`:`<button class="composer-cancel" data-action="composer-cancel">${e(C.cancel)}</button>`}<button class="primary composer-submit" data-action="chat-commit">${e(state.chatEdit>=0?C.save:C.add)}</button></footer>`:''}</section></div>`;
}
