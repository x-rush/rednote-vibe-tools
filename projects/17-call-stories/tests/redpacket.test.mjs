import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChatUI} from '../src/chat-ui.mjs';
const data=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url),'utf8'));
const people={self:{name:'我'},friend:{name:'小林<script>'}};
const ui=createChatUI({data,person:id=>people[id],avatar:()=>'<span class="avatar"></span>',icon:()=>'',media:new Map()});
const chat={selfId:'self',personId:'friend',mode:'private'};

test('redpacket uses a filled closed packet until an incoming packet is claimed',()=>{
  const pending=ui.previewMessage({kind:'redpacket',personId:'friend',status:'pending',text:'恭喜发财，大吉大利'},0,chat);
  assert.match(pending,/redpacket-icon closed/);assert.doesNotMatch(pending,/redpacket-receipt|settled|已领取/);
  const incoming=ui.previewMessage({kind:'redpacket',personId:'friend',status:'received',text:'生日快乐'},0,chat);
  assert.match(incoming,/redpacket-card settled/);assert.match(incoming,/redpacket-icon opened/);assert.match(incoming,/已领取/);assert.match(incoming,/你领取了小林&lt;script&gt;的/);assert.doesNotMatch(incoming,/<script>/);
});

test('claiming an outgoing packet adds a receipt and preserves its closed appearance',()=>{
  const sent=ui.previewMessage({kind:'redpacket',personId:'self',status:'received',text:'恭喜发财'},0,chat);
  assert.match(sent,/redpacket-icon closed/);assert.match(sent,/redpacket-receipt/);assert.match(sent,/小林&lt;script&gt;领取了你的/);assert.doesNotMatch(sent,/redpacket-card settled|redpacket-icon opened|已领取/);
});
