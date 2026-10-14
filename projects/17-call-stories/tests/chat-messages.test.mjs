import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeStudio,makeStudio,switchChatMode,personUsed,recordCall} from '../src/model.mjs';
import {normalizeMessage,voiceWidth,transferStatus} from '../src/chat-messages.mjs';
const data=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url),'utf8'));
test('rich messages survive draft reload, private/group switches and calls',()=>{
  let s=makeStudio(data);s.chat.messages=[{kind:'voice',personId:'basketball',seconds:12,transcript:'到了叫我',showTranscript:true,unread:true},{kind:'image',id:'photo-1',personId:'self',description:'横图'},{kind:'location',personId:'basketball',title:'地铁站',address:'东门出口'},{kind:'transfer',personId:'self',amount:'0.01',status:'returned'},{kind:'redpacket',personId:'basketball',text:'生日快乐',status:'received'},{kind:'narration',personId:'self',text:'电话突然响了。'},{kind:'contact',personId:'self',contactId:'comet',wechatId:'hello'}];
  s=normalizeStudio(s,data);const expected=structuredClone(s.chat.messages);switchChatMode(s,'group',data);s=normalizeStudio(s,data);switchChatMode(s,'private',data);s=normalizeStudio(s,data);assert.deepEqual(s.chat.messages,expected);assert.ok(personUsed(s,'comet'));
  s.call.personId='miss-you';recordCall(s,false,5,data);s=normalizeStudio(s,data);assert.deepEqual(s.chatArchives.basketball.messages,expected);
});
test('rich normalization excludes runtime media and bounds malformed options',()=>{
  const ref=id=>['self','basketball'].includes(id)?id:'self';
  const voice=normalizeMessage({kind:'voice',personId:'self',seconds:999,transcript:'x'.repeat(900),showTranscript:true,audio:'data:audio/x'},ref,data);assert.equal(voice.seconds,60);assert.equal(voice.transcript.length,500);assert.equal(voice.audio,undefined);
  const image=normalizeMessage({kind:'image',id:'photo-1',src:'blob:private',base64:'private',personId:'self'},ref,data);assert.deepEqual(image,{kind:'image',id:'photo-1',personId:'self',text:'',description:''});
  for(const amount of ['oops','Infinity',-12])assert.equal(normalizeMessage({kind:'transfer',amount},ref,data).amount,'0.01');assert.equal(normalizeMessage({kind:'transfer',amount:2.345,status:'received'},ref,data).amount,'2.35');
  assert.equal(normalizeMessage({kind:'contact',contactId:'missing'},ref,data).contactId,'self');assert.ok(voiceWidth(2)<voiceWidth(20));assert.equal(voiceWidth(60),voiceWidth(50));
});
test('transfer status distinguishes sent and received states',()=>{
  assert.equal(transferStatus({status:'pending'},true,data),'你发起了一笔转账');assert.equal(transferStatus({status:'received'},false,data),'已收款');assert.equal(transferStatus({status:'returned'},true,data),'已被退还');
});
