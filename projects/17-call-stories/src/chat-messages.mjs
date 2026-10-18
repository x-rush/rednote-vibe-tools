const text=(value,max=500)=>String(value??'').trim().slice(0,max);
const bound=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Math.round(Number(value)))):fallback;
export const messageKinds=['text','voice','image','video','location','transfer','redpacket','narration','contact','call'];

export function normalizeMessage(raw,ref,data){
  const kind=messageKinds.includes(raw.kind)?raw.kind:'text';
  const message={personId:ref(raw.personId),text:text(raw.text,kind==='narration'?1000:500)};
  if(kind!=='text')message.kind=kind;
  if(typeof raw.id==='string'&&/^[a-z0-9-]{1,80}$/i.test(raw.id))message.id=raw.id;
  if(['image','video','location'].includes(kind)&&!message.id)message.id='msg-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  if(kind==='voice')Object.assign(message,{seconds:bound(raw.seconds,1,60,2),transcript:text(raw.transcript),showTranscript:raw.showTranscript===true,unread:raw.unread===true});
  if(kind==='video'){message.duration=Number.isFinite(Number(raw.duration))?Math.min(86400,Math.max(0,Number(raw.duration))):0;message.description=text(raw.description,80);}
  if(kind==='image')message.description=text(raw.description,80);
  if(kind==='location')Object.assign(message,{title:text(raw.title,80)||data.chatMessages.defaults.locationTitle,address:text(raw.address,160)||data.chatMessages.defaults.locationAddress});
  if(kind==='transfer'){
    const amount=Number(raw.amount);
    Object.assign(message,{amount:(Number.isFinite(amount)?Math.min(999999.99,Math.max(.01,amount)):.01).toFixed(2),status:['pending','received','returned'].includes(raw.status)?raw.status:'pending'});
  }
  if(kind==='redpacket')Object.assign(message,{text:message.text||data.chatMessages.defaults.redpacketGreeting,status:raw.status==='received'?'received':'pending'});
  if(kind==='contact')Object.assign(message,{contactId:ref(raw.contactId),wechatId:text(raw.wechatId,40)});
  return message;
}

export function createMessage(kind,personId,data){
  return {id:'msg-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),personId,kind:messageKinds.includes(kind)?kind:'text',text:kind==='narration'?data.chatMessages.defaults.narration:kind==='redpacket'?data.chatMessages.defaults.redpacketGreeting:kind==='text'?data.defaults.newMessage:'',seconds:2,transcript:'',showTranscript:false,unread:false,amount:'0.01',status:'pending',contactId:personId};
}

export function voiceWidth(seconds){return Math.round(69+Math.min(50,Math.max(1,Number(seconds)||1))*2.2);}
export function transferStatus(message,mine,data){
  const labels=data.chatMessages.transferStates;
  return message.status==='received'?(mine?labels.receivedMine:labels.receivedOther):message.status==='returned'?(mine?labels.returnedMine:labels.returnedOther):(mine?labels.pendingMine:labels.pendingOther);
}
