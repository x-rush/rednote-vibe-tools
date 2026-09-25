import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const c=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url),'utf8'));
const context={window:{}};vm.runInNewContext(readFileSync(new URL('../src/engine.js',import.meta.url),'utf8'),context);const engine=context.window.StoryEngine;
const all=[];
function walk(path,chapter){assert.ok(path.length<20,'Cycle or unbounded story');const s=engine.replay(c,path,chapter);if(c.endings[s.node])all.push({path,node:s.node,chapter});else for(const ch of c.nodes[s.node].choices.filter(ch=>engine.matches(s.flags,ch.when)))walk([...path,ch.id],chapter);}
for(const chapter of c.chapters)walk([],chapter.id);
test('Every narrative path terminates, every scene and ending is reachable',()=>{
  const seen=new Set();for(const r of all){for(let i=0;i<=r.path.length;i++)seen.add(engine.replay(c,r.path.slice(0,i),r.chapter).node);}
  for(const id of [...Object.keys(c.nodes),...Object.keys(c.endings)])assert.ok(seen.has(id),'Unreachable '+id);
  assert.ok(all.length>30);console.log('Verified complete paths:',all.length,'Endings:',new Set(all.map(x=>x.node)).size);
});
test('Prepaid work has a concrete consequence and cannot be erased by late choice',()=>{
  const prefix=['leave','honest'];
  assert.equal(engine.replay(c,[...prefix,'advance','return','move']).node,'end_slow');
  assert.equal(engine.replay(c,[...prefix,'piece','return','move']).node,'end_near');
});
test('Rewind recomputes facts and does not leak abandoned commitments',()=>{
  const old=['leave','promise','advance','return','move'];const previous=engine.replay(c,old);assert.equal(previous.flags.debt,true);
  const next=engine.replay(c,[...old.slice(0,2),'piece','return','move']);assert.equal(next.flags.debt,false);assert.equal(next.node,'end_near');
  const other=engine.replay(c,['stay','want']);assert.equal(other.flags.promise,undefined);assert.equal(other.flags.route,'stay');
});
test('Negotiated work terms alter the outcome, even when one asks for help later',()=>{
  assert.equal(engine.replay(c,['stay','want','verify','terms','boundary']).node,'end_steady');
  assert.equal(engine.replay(c,['stay','want','verify','please','boundary']).node,'end_window');
});
test('Stored input must be a valid continuous path; malformed and post-ending saves rejected',()=>{
  for(const path of [['bogus'],['leave','verify'],[...all[0].path,'extra']])assert.throws(()=>engine.cleanSave(c,{version:1,path}));
  assert.throws(()=>engine.cleanSave(c,{version:2,path:[]}));
  const s=engine.cleanSave(c,{version:1,path:[],unlocked:['end_own','fake','end_own'],seen:['needle','fake'],large:true,still:'true'});
  assert.deepEqual(Array.from(s.unlocked),['end_own']);assert.deepEqual(Array.from(s.seen),['needle']);assert.equal(s.still,false);
});
test('No unreachable references, empty dialogue or duplicate choices in finished content',()=>{
  for(const n of Object.values(c.nodes)){assert.ok(n.quote&&n.speaker&&n.paragraphs.every(Boolean));assert.equal(new Set(n.choices.map(x=>x.id)).size,n.choices.length);}
  for(const e of Object.values(c.endings)){assert.ok(e.letter&&e.gain&&e.cost&&e.paragraphs.length>=3);}
});

test('Both names and a public destination earn the full rescue; a promise alone is insufficient',()=>{
  const prefix=['confide','negotiate','both','plan'];
  assert.equal(engine.replay(c,[...prefix,'public','signal','finish','distance'],'agency').node,'end_together');
  assert.equal(engine.replay(c,[...prefix,'nearby','signal','finish'],'agency').node,'end_waiting');
  assert.equal(engine.replay(c,['confide','negotiate','self','plan','public','signal','take'],'agency').node,'end_alone');
});
test('A late rescue has a different cost; earlier promises cannot retroactively authorize it',()=>{
  const prefix=['confide','obey','plan','public','return'];
  assert.equal(engine.replay(c,[...prefix,'truth'],'agency').node,'end_rescue');
  assert.equal(engine.replay(c,[...prefix,'lie'],'agency').node,'end_borrowed');
  assert.equal(engine.replay(c,['confide','obey','wait','return','truth'],'agency').node,'end_shelter');
});
test('Telling Zhao alters the banquet instead of silently reusing the original trap',()=>{
  const s=engine.replay(c,['conceal','obey','zhao','bargain'],'agency');
  assert.equal(s.node,'end_pact');assert.equal(s.flags.warned,true);
  assert.throws(()=>engine.replay(c,['conceal','obey','zhao','bargain','signal'],'agency'));
});
test('Verified warning changes the banquet even if the player refuses Zhao new errand',()=>{
  const prefix=['conceal','obey','zhao','verify'];
  const declined=engine.replay(c,[...prefix,'retreat'],'agency');
  assert.equal(declined.node,'end_caution');assert.equal(declined.flags.warned,true);
  assert.throws(()=>engine.replay(c,[...prefix,'retreat','signal'],'agency'));
  const limited=engine.replay(c,[...prefix,'limited'],'agency');
  assert.equal(limited.node,'end_pact');assert.equal(limited.flags.disclosed,false);
  const direct=engine.replay(c,['conceal','obey','zhao','bargain'],'agency');
  const visible=s=>c.endings[s.node].epilogue.filter(b=>engine.matches(s.flags,b.when));
  assert.ok(visible(limited).some(b=>b.when&&b.when.verified));
  assert.ok(!visible(limited).some(b=>b.when&&b.when.disclosed));
  assert.ok(visible(direct).some(b=>b.when&&b.when.disclosed));
  assert.ok(!visible(direct).some(b=>b.when&&b.when.verified));
});
test('Keeping the escort hidden trades the prepared public exit for confinement',()=>{
  const prefix=['confide','negotiate','both','plan','public','signal'];
  const hidden=engine.replay(c,[...prefix,'keep_hidden'],'agency');
  assert.equal(hidden.node,'end_waiting');assert.equal(hidden.flags.ready,true);
  assert.equal(hidden.flags.hiddenExit,true);
  const open=engine.replay(c,[...prefix,'finish','distance'],'agency');
  assert.equal(open.node,'end_together');assert.equal(open.flags.hiddenExit,undefined);
  assert.throws(()=>engine.replay(c,['confide','negotiate','both','wait','signal','keep_hidden'],'agency'));
});
test('Legacy saves stay in the family chapter and invalid chapter/beat values are contained',()=>{
  assert.equal(engine.cleanSave(c,{version:1,path:['leave']}).chapter,'freedom');
  assert.equal(engine.cleanSave(c,{version:1,path:[],chapter:'agency',beat:Infinity}).beat,0);
  assert.throws(()=>engine.cleanSave(c,{version:1,path:[],chapter:'missing'}));
  const s=engine.cleanSave(c,{version:1,path:['confide'],chapter:'agency',beat:3});
  assert.equal(s.beat,3);assert.equal(engine.replay(c,s.path,s.chapter).node,'a_study');
});
test('Visible dialogue variants and cast references are valid for every reachable state',()=>{
  for(const route of all)for(let i=0;i<route.path.length;i++){
    const s=engine.replay(c,route.path.slice(0,i),route.chapter),n=c.nodes[s.node];
    assert.ok(n.beats.filter(b=>engine.matches(s.flags,b.when)).length);
    for(const b of n.beats){assert.ok(b.text&&b.speaker);if(b.character)assert.ok(c.characters[b.character]);}
    for(const id of n.cast)assert.ok(c.characters[id]);
  }
});

test('Expression and entrances persist, and stepping backward reconstructs the earlier stage',()=>{
  const node=c.nodes.a_terms,frames=node.beats;
  const reaction=frames.findIndex(b=>b.reactions&&b.reactions.lin==='vulnerable');
  const during=engine.stage(node,frames,reaction+1);
  assert.equal(during.emotions.lin,'vulnerable');
  const before=engine.stage(node,frames,0);assert.equal(before.emotions.lin,'neutral');
  const last=engine.stage(node,frames,frames.length-1);
  assert.ok(last.cast.includes('jiugao'));assert.ok(!last.cast.includes('lin'));
});
test('Read status distinguishes revised and conditional dialogue; saves do not persist media',()=>{
  const a={id:'same',text:'旧句',when:{ally:true}},b={...a,text:'新句'},d={...a,when:{ally:false}};
  assert.notEqual(engine.readKey('a',a),engine.readKey('a',b));assert.notEqual(engine.readKey('a',a),engine.readKey('a',d));
  const clean=engine.cleanSave(c,{version:1,path:[],chapter:'agency',read:[engine.readKey('a',a),3],artwork:['supper','missing'],frameId:'a_door-v1-0',media:'forbidden'});
  assert.equal(clean.read.length,1);assert.equal(clean.artwork.length,1);assert.equal(clean.media,undefined);
});
test('All scene frames and epilogues have unique identities and existing visual assets',()=>{
  for(const [id,n] of Object.entries(c.nodes).concat(Object.entries(c.endings))){
    const frames=n.beats||n.epilogue;assert.ok(frames.length,id);
    assert.equal(new Set(frames.map(b=>b.id)).size,frames.length,id);
    for(const b of frames){
      for(const ch of b.cast||[])assert.ok(c.characters[ch],id+': '+ch);
      for(const ch of Object.keys(b.reactions||{}))assert.ok(c.characters[ch]);
      if(b.cg)assert.ok(c.art[b.cg]);
    }
  }
  assert.equal(Object.keys(c.characters).length,9);
});

test('Observed work unlocks a specific exit, and replay cannot carry that knowledge across paths',()=>{
 const prefix=['confide','negotiate','both','plan'];
 const work=engine.replay(c,[...prefix,'look_stove','return_duty','signal','work_entry'],'agency');
 assert.equal(work.node,'end_rescue');assert.equal(work.flags.workEntry,true);
 assert.throws(()=>engine.replay(c,[...prefix,'public','signal','work_entry'],'agency'));
 const witness=engine.replay(c,[...prefix,'look_steward','return_duty','signal','finish','distance'],'agency');
 assert.equal(witness.node,'end_together');assert.equal(witness.flags.teaWitness,true);
 assert.equal(witness.flags.teaSkill,undefined);
 const frames=c.endings[work.node].epilogue.filter(b=>engine.matches(work.flags,b.when));
 assert.ok(frames.some(b=>b.id.startsWith('end_rescue-work-v6-')));
 assert.ok(!frames.some(b=>b.when&&b.when.workEntry===false));
});
test('Tea-room stage and music reconstruct correctly when rewinding from the study',()=>{
 const state=engine.replay(c,['confide','negotiate','both','plan','look_steward','return_duty','signal','finish'],'agency');
 const node=c.nodes[state.node],frames=node.beats.filter(b=>engine.matches(state.flags,b.when));
 const study=frames.findIndex(b=>b.background==='study');assert.ok(study>0);
 assert.equal(engine.stage(node,frames,study).background,'study');
 assert.equal(engine.stage(node,frames,study).music,'eastern-thought');
 const first=engine.stage(node,frames,0);assert.equal(first.background,'room');assert.equal(first.music,null);
 for(const n of [...Object.values(c.nodes),...Object.values(c.endings)])for(const b of n.beats||n.epilogue){
  if(b.background)assert.ok(c.art[b.background]);
  if(b.music)assert.ok(c.audio.files[b.music]);
 }
});

test('Family homecoming only recalls a deadline the player actually promised',()=>{
 for(const choice of ['promise','honest']){
  const path=['leave',choice,'piece','askhelp','share'];
  const state=engine.replay(c,path,'freedom');assert.equal(state.node,'leave_home');
  const visible=c.nodes[state.node].beats.filter(b=>engine.matches(state.flags,b.when));
  assert.equal(visible.some(b=>b.when&&b.when.promise===true),choice==='promise');
  assert.equal(visible.some(b=>b.id==='leave_home-honest-v9'),choice==='honest');
  const restored=engine.cleanSave(c,{version:1,chapter:'freedom',path});
  assert.equal(engine.replay(c,restored.path,restored.chapter).flags.promise,choice==='promise');
 }
});
test('Paid introduction is remembered only on the paid path',()=>{
 for(const choice of ['pay','verify']){
  const state=engine.replay(c,['stay','want',choice],'freedom');
  assert.equal(c.nodes[state.node].beats.filter(b=>engine.matches(state.flags,b.when)).some(b=>b.id==='stay_terms-paid-v9'),choice==='pay');
 }
});
