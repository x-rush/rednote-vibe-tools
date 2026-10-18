import {escapeHtml as e} from './model.mjs';
import {voiceWidth,transferStatus} from './chat-messages.mjs';
import {videoTime} from './video-message.mjs';

function redpacketIcon(opened=false,small=false){
  if(small)return '<svg viewBox="0 0 18 20" aria-hidden="true"><rect x="1" y="1" width="16" height="18" rx="1.5" fill="#ff3144"/><path d="M1 2h16v6c-4 3-12 3-16 0Z" fill="#ff514d"/><circle cx="9" cy="9" r="3" fill="#ffd05b"/></svg>';
  return `<svg class="redpacket-icon ${opened?'opened':'closed'}" viewBox="0 0 44 44" aria-hidden="true"><rect x="5" y="1" width="34" height="42" rx="1.8" fill="${opened?'#ff8a79':'#ff3144'}"/>${opened?'<path d="M5 5C5-1 39-1 39 5v9c-8 4-26 4-34 0Z" fill="#fff2e6"/>':'<path d="M36 2h2v39h-2Z" fill="#f52740"/>'}<circle cx="22" cy="${opened?26:21}" r="5.4" fill="${opened?'#ffce77':'#ffd032'}"/><path d="m19.7 ${opened?23:18} 2.3 3 2.3-3M22 ${opened?26:21}v4m-3-3h6m-6-2h6" fill="none" stroke="${opened?'#ff9e58':'#ff9200'}" stroke-width="1.15" stroke-linecap="round"/></svg>`;
}

function richIcon(name,mirror=false){
  if(name==='pending')return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="2.8"/><g fill="currentColor"><path d="M12.6 19.8 20.2 12.6 22.1 14.6 17.1 19.3H36v3.4H13.8c-1.9 0-2.5-1.6-1.2-2.9Z"/><path d="M12.6 19.8 20.2 12.6 22.1 14.6 17.1 19.3H36v3.4H13.8c-1.9 0-2.5-1.6-1.2-2.9Z" transform="rotate(180 24 24)"/></g></svg>';
  if(name==='voice')return '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="'+(mirror?'rotate(180 12 12)':'rotate(0 12 12)')+'"><path d="m5 9 3 3-3 3Z" fill="currentColor"/><path d="M10 7a7 7 0 0 1 0 10M14 4a11 11 0 0 1 0 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></g></svg>';
  const path=name==='received'?'m11 23 8 8 15-17':name==='returned'?'M30 32h-8a8 8 0 0 1 0-16h7M23 10l-6 6 6 6': 'M13 18h22l-7-7M35 30H13l7 7';
  return `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="21"/><path d="${path}"/></svg>`;
}

function mapIllustration(label){return `<svg class="map-illustration" viewBox="0 0 500 210" preserveAspectRatio="xMidYMid slice" aria-label="${e(label)}"><rect width="500" height="210" fill="#edf0e9"/><path d="M22 14h90v49H22zM157 8h62v55h-62zM340 7h129v52H340zM13 106h87v71H13zM154 108h63v79h-63zM343 110h129v76H343z" fill="#e1e6e1" stroke="#d2dcd4" stroke-width="3"/><path d="M346 120h90v55h-90z" fill="#c8e7bc"/><path d="M125-10V220M240-10V220M327-10V220M-10 83H510M-10 196H510" fill="none" stroke="#fff" stroke-width="20"/><path d="M125-10V220M240-10V220M327-10V220M-10 83H510M-10 196H510" fill="none" stroke="#d4dbd5" stroke-width="2"/><path d="M290-10c-18 50-7 88 2 122s-1 65-11 108" fill="none" stroke="#a4daee" stroke-width="17"/><path d="M250 57c-24 0-41 18-41 40 0 27 41 65 41 65s41-38 41-65c0-22-17-40-41-40Z" fill="#07c160"/><circle cx="250" cy="97" r="15" fill="#fff"/></svg>`;}

export function createChatUI({data,person,avatar,icon,media}){
  const config=data.chatMessages,L=config.labels;
  function previewContent(m,i,mine){const kind=m.kind||'text',resource=media.get(m.id);
    if(kind==='video'){
      const V=data.chatMessages.video;
      if(!resource||resource.kind!=='video')return `<span class="message-image-missing message-video-missing">${icon('video')}<small>${e(V.missing)}</small><small>${videoTime(m.duration)}</small></span>`;
      const scale=Math.min(198/resource.width,198/resource.height,1),width=Math.max(1,Math.round(resource.width*scale)),height=Math.max(1,Math.round(resource.height*scale));
      return `<button class="message-video" data-view-message-video="${i}" aria-label="${e(V.play)} ${videoTime(resource.duration)}"><img src="${e(resource.posterUrl)}" width="${width}" height="${height}" alt="${e(m.description||V.play)}"><span class="message-video-play" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m12 8 13 8-13 8Z" fill="currentColor"/></svg></span><small>${videoTime(resource.duration)}</small></button>`;
    }
    if(kind==='voice'){const width=voiceWidth(m.seconds);return `<button class="bubble voice-bubble" style="width:${width}px" data-voice-transcript="${i}" aria-label="${e(m.showTranscript?L.collapseTranscript:L.expandTranscript)}" aria-expanded="${!!m.showTranscript}">${richIcon('voice',mine)}<span>${m.seconds}"</span>${m.unread&&!mine?'<i class="voice-unread" aria-hidden="true"></i>':''}</button>${m.showTranscript&&m.transcript?`<p class="voice-transcript">${e(m.transcript)}</p>`:''}`;}
    if(kind==='image'){
      if(!resource)return `<span class="message-image-missing">${icon('camera')}<small>${e(L.imageLost)}</small></span>`;
      const scale=Math.min(198/resource.width,198/resource.height,1),width=Math.round(resource.width*scale),height=Math.round(resource.height*scale);
      return `<button class="message-image" data-view-message-image="${i}" aria-label="${e(L.viewImage)}"><img src="${resource.url}" width="${width}" height="${height}" alt="${e(m.description||L.imageDescription)}"></button>`;
    }
    if(kind==='location')return `<div class="bubble message-card location-card"><div class="location-copy"><strong>${e(m.title)}</strong><span>${e(m.address)}</span></div><div class="location-map">${resource?`<img src="${resource.url}" alt="${e(L.mapPreview)}">`:mapIllustration(L.mapPreview)}</div></div>`;
    if(kind==='transfer')return `<div class="bubble message-card transfer-card ${m.status!=='pending'?'settled':''} ${m.status==='returned'?'returned':''}"><div class="payment-main">${richIcon(m.status)}<div><strong>¥${e(m.amount)}</strong><span>${e(transferStatus(m,mine,data))}</span></div></div><small class="payment-footer">${e(L.transfer)}</small></div>`;
    if(kind==='redpacket'){const opened=m.status==='received'&&!mine;return `<div class="bubble message-card redpacket-card ${opened?'settled':''}" data-redpacket-state="${m.status}"><div class="payment-main">${redpacketIcon(opened)}<div><strong>${e(m.text)}</strong>${opened?`<span>${e(L.received)}</span>`:''}</div></div><small class="payment-footer">${e(L.redpacket)}</small></div>`;}
    if(kind==='contact')return `<div class="bubble message-card contact-card"><div class="contact-main">${avatar(m.contactId,'small')}<div><strong>${e(person(m.contactId).name)}</strong>${m.wechatId?`<small>${e(m.wechatId)}</small>`:''}</div></div><small class="contact-footer">${e(L.contactCard)}</small></div>`;
    return `<p class="bubble ${kind==='call'?'call-record':''}">${kind==='call'?icon('phone'):''}${e(m.text)}</p>`;
  }
  function previewMessage(m,i,ch){
    if(m.kind==='narration')return `<div class="chat-narration" data-message-row="${i}">${e(m.text)}</div>`;
    const mine=m.personId===ch.selfId;
    const receipt=m.kind==='redpacket'&&m.status==='received'?`<div class="redpacket-receipt">${redpacketIcon(false,true)}<span>${mine?e(person(ch.personId).name)+e(config.receipt.mine):e(config.receipt.otherBefore)+e(person(m.personId).name)+e(config.receipt.otherAfter)}<em>${e(config.receipt.word)}</em></span></div>`:'';
    return `<div class="bubble-row ${mine?'me':'them'}" data-message-row="${i}">${mine?'':avatar(m.personId,'small')}<div class="message-stack">${ch.mode==='group'&&!mine?`<small class="bubble-name">${e(person(m.personId).name)}</small>`:''}${previewContent(m,i,mine)}</div>${mine?avatar(m.personId,'small'):''}</div>${receipt}`;
  }
  return {previewMessage};
}
