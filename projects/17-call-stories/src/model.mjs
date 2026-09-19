export function cleanText(value,max=180){return String(value??'').trim().slice(0,max);}
export function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function elapsedLabel(seconds){const n=Math.max(0,Math.floor(seconds));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
export function makeStudio(data){return {version:2,chatArchives:{},people:data.people.map(p=>({...p})),call:{personId:'basketball',scriptId:'basketball',mode:'full',pause:0,delay:0,ringtone:true,subtitles:false},chat:{mode:'private',members:['self','basketball'],groupTitle:data.defaults.groupTitle,personId:'basketball',selfId:'self',title:'',time:data.defaults.chatTime,timeParts:{...data.timePicker.defaults},messages:data.defaults.messages.map(m=>({...m}))},moment:{authorId:'basketball',text:data.defaults.momentText,time:data.defaults.momentTime,timeParts:{...data.momentTimePicker.defaults},likes:['tea-lamp','river'],comments:[{personId:'tea-lamp',text:data.comments[2]}]}};}
export function normalizeStudio(raw,data){
  const s=makeStudio(data);if(!raw||typeof raw!=='object')return s;
  const avatars=new Set(data.avatars.map(a=>a.id));const ids=new Set();
  if(Array.isArray(raw.people)){const people=raw.people.slice(0,60).filter(p=>p&&typeof p.id==='string'&&/^[a-z0-9-]{1,64}$/i.test(p.id)&&!ids.has(p.id)&&ids.add(p.id)).map(p=>({id:p.id,name:cleanText(p.name,24)||data.defaults.newPerson,relation:cleanText(p.relation,40),avatar:avatars.has(p.avatar)?p.avatar:data.avatars[0].id}));if(people.length)s.people=people;}
  const ref=(id)=>s.people.some(p=>p.id===id)?id:s.people[0].id;
  const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Math.round(Number(v)))):fallback;
  const c=raw.call||{};s.call={personId:ref(c.personId||s.call.personId),scriptId:data.callScripts.some(x=>x.id===c.scriptId)?c.scriptId:s.call.scriptId,mode:c.mode==='intro'?'intro':'full',pause:number(c.pause??0,0,15,0),delay:number(c.delay??0,0,30,0),ringtone:c.ringtone!==false,subtitles:c.subtitles===true};
  const ch=raw.chat||{};s.chat={personId:ref(ch.personId||s.chat.personId),selfId:ref(ch.selfId||s.chat.selfId),title:cleanText(ch.title,32),timeParts:normalizeTimeParts(ch.timeParts,data),time:formatChatTime(normalizeTimeParts(ch.timeParts,data),data),messages:Array.isArray(ch.messages)?ch.messages.slice(0,60).filter(m=>m&&typeof m==='object').map(m=>({personId:ref(m.personId),text:cleanText(m.text,500),...(m.kind==='call'?{kind:'call'}:{})})):s.chat.messages};
  s.chat.mode=ch.mode==='group'?'group':'private';s.chat.groupTitle=cleanText(ch.groupTitle,32)||data.defaults.groupTitle;
  s.chat.members=[...new Set([s.chat.selfId,s.chat.personId,...(Array.isArray(ch.members)?ch.members.filter(id=>s.people.some(p=>p.id===id)):[]),...s.chat.messages.map(m=>m.personId)])];
  if(s.chat.mode==='private'){s.chat.members=[...new Set([s.chat.selfId,s.chat.personId])];s.chat.messages.forEach(m=>{if(!s.chat.members.includes(m.personId))m.personId=s.chat.personId;});}
  if(raw.groupDraft)s.groupDraft=normalizeStudio({people:s.people,chat:{...raw.groupDraft,mode:'group'}},data).chat;
  for(const [id,chat] of Object.entries(raw.chatArchives||{})){if(s.people.some(p=>p.id===id)&&chat&&typeof chat==='object')s.chatArchives[id]=normalizeStudio({people:s.people,chat:{...chat,personId:id}},data).chat;}
  const m=raw.moment||{};s.moment={authorId:ref(m.authorId||s.moment.authorId),text:cleanText(m.text??s.moment.text,1000),time:formatMomentTime(normalizeMomentTime(m.timeParts,m.time,data),data),timeParts:normalizeMomentTime(m.timeParts,m.time,data),likes:Array.isArray(m.likes)?[...new Set(m.likes.filter(id=>s.people.some(p=>p.id===id)))].slice(0,60):s.moment.likes,comments:Array.isArray(m.comments)?m.comments.slice(0,60).filter(c=>c&&typeof c==='object').map(c=>({personId:ref(c.personId),text:cleanText(c.text,300)})):s.moment.comments};
  return s;
}
export function personUsed(s,id){return [s.call.personId,s.chat.personId,s.chat.selfId,s.moment.authorId,...(s.chat.members||[]),...(s.groupDraft?[s.groupDraft.selfId,...s.groupDraft.members,...s.groupDraft.messages.map(m=>m.personId)]:[]),...s.chat.messages.map(m=>m.personId),...[].concat(...Object.values(s.chatArchives||{}).map(ch=>[ch.personId,ch.selfId,...ch.messages.map(m=>m.personId)])),...s.moment.likes,...s.moment.comments.map(c=>c.personId)].includes(id);}
export function randomReactionIds(people,author,count,random=Math.random){const ids=people.filter(p=>p.id!==author).map(p=>p.id);for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids.slice(0,count);}

export function recordCall(studio,declined,seconds,data){
  const id=studio.call.personId;
  if(studio.chat.mode==='group'){studio.groupDraft=JSON.parse(JSON.stringify(studio.chat));studio.chat=studio.chatArchives[id]||{mode:'private',personId:id,selfId:studio.chat.selfId,title:'',time:data.defaults.chatTime,messages:[]};delete studio.chatArchives[id];}
  if(studio.chat.personId!==id){
    studio.chatArchives[studio.chat.personId]=JSON.parse(JSON.stringify(studio.chat));
    studio.chat=studio.chatArchives[id]||{personId:id,selfId:studio.chat.selfId,title:'',time:data.defaults.chatTime,messages:[]};
    delete studio.chatArchives[id];
  }
  studio.chat.messages.push({personId:id,kind:'call',text:declined?data.defaults.callDeclined:data.defaults.callDuration+' '+elapsedLabel(seconds)});
  studio.chat.messages=studio.chat.messages.slice(-60);
  return studio;
}

export function suggestNickname(people,names,current='',random=Math.random){
  const used=new Set(people.map(p=>p.name));used.add(current);
  const available=names.filter(name=>!used.has(name));
  if(available.length)return available[Math.floor(random()*available.length)];
  const base=names[Math.floor(random()*names.length)];let suffix=2;
  while(used.has(base+suffix))suffix++;
  return base+suffix;
}
export function suggestAvatar(people,avatars,random=Math.random){
  const used=new Set(people.map(p=>p.avatar)),unused=avatars.filter(a=>!used.has(a.id));
  const pool=unused.length?unused:avatars;
  return pool[Math.floor(random()*pool.length)].id;
}

export function switchChatMode(studio,mode,data){
  if(studio.chat.mode===mode)return;
  if(mode==='group'){studio.chatArchives[studio.chat.personId]=JSON.parse(JSON.stringify(studio.chat));studio.chat=studio.groupDraft||{...JSON.parse(JSON.stringify(studio.chat)),mode:'group',groupTitle:data.defaults.groupTitle,members:[...new Set([studio.chat.selfId,studio.chat.personId,...studio.people.slice(0,5).map(p=>p.id)])]};delete studio.groupDraft;}
  else{studio.groupDraft=JSON.parse(JSON.stringify(studio.chat));const id=studio.chat.personId;studio.chat=studio.chatArchives[id]||{mode:'private',personId:id,selfId:studio.chat.selfId,title:'',time:data.defaults.chatTime,messages:[]};delete studio.chatArchives[id];}
}

export function monthDays(month){return [31,29,31,30,31,30,31,31,30,31,30,31][month-1]||31;}
export function normalizeTimeParts(raw,data){const t={...data.timePicker.defaults,...(raw||{})},n=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Math.floor(Number(v)):min));const month=n(t.month,1,12);return {format:t.format==='date'?'date':'weekday',weekday:n(t.weekday,1,7),month,day:n(t.day,1,monthDays(month)),hour:n(t.hour,0,23),minute:n(t.minute,0,59)};}
export function formatChatTime(t,data){return (t.format==='date'?t.month+'月'+t.day+'日':data.timePicker.weekdays[t.weekday-1])+' '+String(t.hour).padStart(2,'0')+':'+String(t.minute).padStart(2,'0');}

export function normalizeMomentTime(raw,legacy,data){const t={...data.momentTimePicker.defaults,...(raw||{})};if(!raw&&legacy){const m=legacy.match(/^(\d+)(分钟|小时|天)前$/);if(m){t.format={分钟:'minutes',小时:'hours',天:'days'}[m[2]];t.amount=Number(m[1]);}else if(legacy==='刚刚')t.format='now';}if(!data.momentTimePicker.formats.some(f=>f.value===t.format))t.format='minutes';const bound=(v,a,b)=>Math.min(b,Math.max(a,Math.floor(Number(v)||a)));t.amount=bound(t.amount,1,t.format==='hours'?23:t.format==='days'?30:59);t.month=bound(t.month,1,12);t.day=bound(t.day,1,monthDays(t.month));t.weekday=bound(t.weekday,1,7);t.hour=bound(t.hour,0,23);t.minute=bound(t.minute,0,59);return t;}
export function formatMomentTime(t,data){const clock=String(t.hour).padStart(2,'0')+':'+String(t.minute).padStart(2,'0');if(t.format==='now')return '刚刚';if(['minutes','hours','days'].includes(t.format))return t.amount+{minutes:'分钟前',hours:'小时前',days:'天前'}[t.format];return (t.format==='yesterday'?'昨天':t.format==='weekday'?data.timePicker.weekdays[t.weekday-1]:t.month+'月'+t.day+'日')+' '+clock;}
