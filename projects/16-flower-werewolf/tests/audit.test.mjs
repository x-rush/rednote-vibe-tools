import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, transition, restoreGame, observe, chooseVote} from '../src/engine.mjs';
import {publicContent} from '../tools.mjs';
const ids=Array.from({length:7},(_,i)=>'guest-'+(i+1));
const deck=['wolf','wolf','seer','witch','villager','villager','villager'];

test('each gallery excerpt has a dated and attributed public source',async()=>{
  const c=await publicContent();
  assert.equal(Object.keys(c.verifiedQuotes).length,7);
  for(const id of ids){
    const q=c.verifiedQuotes[id];
    assert.ok(q.text.length>0 && q.text.length<60);
    assert.match(q.url,/^https:\/\/(www\.)?sina\.cn\/news\/detail\/\d+\.html$/);
    assert.match(q.date,/^2026-09-\d{2}$/);
    assert.equal(q.verifiedAt,'2026-09-15');
    assert.ok(q.sourceType.includes('本人认证账号'));
  }
  assert.ok(c.ui.simulationNotice.includes('不是节目原话'));
  assert.ok(c.ui.original.includes('不冒充节目口播'));
});

test('challenged seer responds with own actual check, not a fabricated inspection',()=>{
  const s=createGame(41,ids,deck);
  s.human=s.players.find(p=>p.role==='villager').id;
  s.phase='day';s.day=1;
  const seer=s.players.find(p=>p.role==='seer');
  const wolf=s.players.find(p=>p.role==='wolf');
  seer.checks=[{day:1,target:wolf.id,wolf:true}];
  const next=transition(s,{type:'speak',kind:'accuse',target:seer.id});
  const claims=next.events.filter(e=>e.kind==='claim'&&e.actor===seer.id);
  assert.equal(claims.length,1);
  assert.equal(claims[0].target,wolf.id);
  assert.equal(claims[0].result,'wolf');
  assert.ok(restoreGame(next,ids));
  assert.deepEqual(observe(next,s.human).checks,[]);
});

test('a challenged uninspected seer does not invent a result',()=>{
  const s=createGame(41,ids,deck);
  s.human=s.players.find(p=>p.role==='villager').id;s.phase='day';s.day=1;
  const seer=s.players.find(p=>p.role==='seer');
  const next=transition(s,{type:'speak',kind:'accuse',target:seer.id});
  assert.equal(next.events.filter(e=>e.kind==='claim'&&e.actor===seer.id).length,0);
});

test('restricted runoff allows an NPC to abstain instead of voting a known ally or checked innocent',()=>{
  const s=createGame(41,ids,deck);
  const wolves=s.players.filter(p=>p.role==='wolf');
  assert.equal(chooseVote(observe(s,wolves[0].id),[wolves[0].id,wolves[1].id],()=>0,true),null);
  const seer=s.players.find(p=>p.role==='seer'),good=s.players.find(p=>p.role==='villager');
  seer.checks=[{day:1,target:good.id,wolf:false}];
  assert.equal(chooseVote(observe(s,seer.id),[seer.id,good.id],()=>0,true),null);
  assert.equal(chooseVote(observe(s,seer.id),[good.id,wolves[0].id],()=>0,true),wolves[0].id);
});
