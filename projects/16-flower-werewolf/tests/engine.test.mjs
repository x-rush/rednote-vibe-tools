import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGame, transition, observe, suspicion, chooseVote, winnerOf, evidenceFrom, tallyBallots, restoreGame, advanceSpectator} from '../src/engine.mjs';
import {publicContent} from '../tools.mjs';
const raw=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8'));
const ids=raw.characters.map(c=>c.id), roles=raw.rulesDraft.roles;
const make=seed=>createGame(seed,ids,roles);
function fixed(humanRole='villager') {
  const s=make(91);
  s.players.forEach((p,i)=>{p.role=roles[i];p.alive=true;p.checks=[];p.heal=1;p.poison=1;});
  s.human=s.players.find(p=>p.role===humanRole).id;
  return s;
}
function night(s) {return transition(s,{type:'begin'});}
function automatic(s) {
  if(s.phase==='deal')return transition(s,{type:'begin'});
  if(s.phase==='night'){
    const p=s.players[s.human], view=observe(s,p.id);
    const targets=s.players.filter(x=>x.alive&&x.id!==p.id&&!view.allies.includes(x.id));
    const command={type:'night'};
    if(p.alive&&(p.role==='wolf'||p.role==='seer'))command.target=targets[0]?.id??null;
    if(p.alive&&p.role==='witch')command.potion=p.heal&&view.victim!==null&&(view.victim!==p.id||s.day===1)?'heal':'skip';
    return transition(s,command);
  }
  if(s.phase==='day'){
    const p=s.players[s.human];
    if(!p.alive)return transition(s,{type:'speak',kind:'skip'});
    const target=s.players.find(x=>x.alive&&x.id!==p.id).id;
    const clue=evidenceFrom(s.events).find(x=>x.target===target);
    return transition(s,{type:'speak',kind:'accuse',target,evidence:clue?.id});
  }
  if(s.phase==='vote'){
    const me=s.players[s.human], candidates=s.runoff??s.players.filter(p=>p.alive).map(p=>p.id);
    return transition(s,{type:'vote',target:me.alive?chooseVote(observe(s,me.id),candidates,()=>0.4):null});
  }
  return transition(s,{type:'next'});
}
test('two independent decks preserve seats and role quota across seeds',()=>{
  const seen=Object.fromEntries(ids.map(id=>[id,new Set()]));
  const humanRoles=new Set(), humanCharacters=new Set();
  for(let seed=0;seed<1000;seed++){
    const s=make(seed);
    assert.equal(new Set(s.players.map(p=>p.character)).size,7);
    assert.deepEqual(s.players.map(p=>p.role).sort(),[...roles].sort());
    s.players.forEach(p=>seen[p.character].add(p.role));
    humanRoles.add(s.players[s.human].role);humanCharacters.add(s.players[s.human].character);
  }
  assert.equal(humanRoles.size,4);assert.equal(humanCharacters.size,7);
  Object.values(seen).forEach(set=>assert.equal(set.size,4));
});
test('same seed is reproducible, different seeds are not fixed scripts',()=>{
  assert.deepEqual(make(123),make(123));
  assert.notDeepEqual(make(123).players,make(124).players);
});
test('observation hides all foreign roles, potions, checks, audit and seed',()=>{
  const s=night(fixed());
  const v=observe(s,s.human);
  assert.equal('audit'in v,false);assert.equal('rng'in v,false);assert.equal('seed'in v,false);
  v.players.forEach(p=>assert.deepEqual(Object.keys(p).sort(),['alive','id']));
  assert.deepEqual(v.allies,[]);assert.equal(v.victim,null);
  v.events.push({kind:'injected'});assert.notEqual(s.events.at(-1).kind,'injected');
});
test('policy is invariant under unobserved identity changes',()=>{
  const s=night(fixed()), t=structuredClone(s);
  [t.players[0].role,t.players[2].role]=[t.players[2].role,t.players[0].role];
  assert.deepEqual(observe(s,s.human),observe(t,t.human));
  assert.equal(chooseVote(observe(s,s.human),[0,1,2,3],()=>0.3),chooseVote(observe(t,t.human),[0,1,2,3],()=>0.3));
});
test('wolves know exactly their team; only active-heal witch sees victim',()=>{
  const s=night(fixed('wolf'));
  assert.deepEqual(observe(s,0).allies,[0,1]);
  s.night.kill=4;
  assert.equal(observe(s,3).victim,4);
  s.players[3].heal=0;assert.equal(observe(s,3).victim,null);
});
test('night target validation is transactional, including teammate attack',()=>{
  const s=night(fixed('wolf')), before=structuredClone(s);
  assert.throws(()=>transition(s,{type:'night',target:1}));
  assert.throws(()=>transition(s,{type:'night',target:99}));
  assert.deepEqual(s,before);
});
test('seer cannot check self; valid result is private',()=>{
  let s=night(fixed('seer'));
  assert.throws(()=>transition(s,{type:'night',target:s.human}));
  s=transition(s,{type:'night',target:0});
  assert.equal(s.players[s.human].checks[0].wolf,true);
  assert.ok(!s.events.some(e=>e.kind==='check'));
  assert.equal(observe(s,4).checks.length,0);
});
test('first-night witch self heal is legal and spends one potion',()=>{
  let s=night(fixed('witch'));s.night.kill=s.human;
  s=transition(s,{type:'night',potion:'heal'});
  assert.equal(s.players[s.human].alive,true);assert.equal(s.players[s.human].heal,0);assert.equal(s.players[s.human].poison,1);
});
test('later self heal and exhausted potion are rejected without mutation',()=>{
  const s=night(fixed('witch'));s.day=2;s.night.kill=s.human;
  const before=structuredClone(s);assert.throws(()=>transition(s,{type:'night',potion:'heal'}));assert.deepEqual(s,before);
  s.players[s.human].poison=0;assert.throws(()=>transition(s,{type:'night',potion:'poison',target:0}));
});
test('witch dying that night still poisons; effects settle together',()=>{
  let s=night(fixed('witch'));s.night.kill=s.human;
  s=transition(s,{type:'night',potion:'poison',target:0});
  assert.equal(s.players[s.human].alive,false);assert.equal(s.players[0].alive,false);
  assert.equal(s.players[s.human].poison,0);assert.deepEqual(s.events.find(e=>e.kind==='dawn').targets,[3,0]);
});
test('seer attacked at night still completes that nights check',()=>{
  let s=night(fixed('seer'));s.players[3].heal=0;s.players[3].poison=0;s.night.kill=s.human;
  s=transition(s,{type:'night',target:0});
  assert.equal(s.players[s.human].alive,false);assert.equal(s.players[s.human].checks[0].wolf,true);
});
test('winner handles parity, no wolves and simultaneous extinction',()=>{
  const p=fixed().players;
  assert.equal(winnerOf(p),null);
  p[0].alive=p[1].alive=false;assert.equal(winnerOf(p),'good');
  p.forEach(x=>x.alive=false);assert.equal(winnerOf(p),'draw');
  p[0].alive=p[4].alive=true;assert.equal(winnerOf(p),'wolf');
});
test('evidence only comes from matching public events',()=>{
  const events=[{id:'e1',day:1,kind:'support',actor:0,target:4},{id:'e2',day:1,kind:'ballot',actor:0,target:4}];
  assert.equal(evidenceFrom(events)[0].kind,'flip');
  assert.equal(evidenceFrom([{...events[0]}, {...events[1],day:2}]).length,0);
  assert.equal(evidenceFrom([{...events[0]}, {...events[1],target:3}]).length,0);
  const claims=[{id:'e1',day:1,kind:'claim',actor:0,target:4,result:'wolf'},{id:'e2',day:2,kind:'claim',actor:0,target:4,result:'good'},{id:'e3',day:2,kind:'claim',actor:1,target:5,result:'good'}];
  assert.deepEqual(evidenceFrom(claims).map(e=>e.kind),['contradict','rival']);
});
test('a supported accusation changes permitted suspicion, fabricated evidence rejected',()=>{
  const s=fixed();s.day=2;s.phase='day';
  s.events=[{id:'e1',day:1,kind:'support',actor:0,target:4},{id:'e2',day:1,kind:'ballot',actor:0,target:4}];
  const before=suspicion(observe(s,5))[0];
  assert.throws(()=>transition(s,{type:'speak',kind:'accuse',target:0,evidence:'invented'}));
  const after=transition(s,{type:'speak',kind:'accuse',target:0,evidence:'flip-e2'});
  assert.ok(suspicion(observe(after,5))[0]>before);
  assert.ok(after.events.some(e=>e.kind==='response'&&e.actor===0));
  assert.ok(after.events.some(e=>e.kind==='reaction'));
  assert.throws(()=>transition(after,{type:'speak',kind:'accuse',target:0}));
});
test('claims are not validated against true role: villagers may bluff',()=>{
  const s=fixed();s.phase='day';s.day=1;
  const next=transition(s,{type:'speak',kind:'claim',target:0,result:'good'});
  assert.ok(next.events.some(e=>e.kind==='claim'&&e.actor===s.human&&e.result==='good'));
  assert.equal(next.players[s.human].role,'villager');
});
test('ballots count ties and abstentions without inventing votes',()=>{
  assert.deepEqual(tallyBallots([{target:null},{target:null}]),{counts:{},tied:[]});
  assert.deepEqual(tallyBallots([{target:1},{target:2},{target:1},{target:2}]),{counts:{1:2,2:2},tied:[1,2]});
});
test('self votes, dead targets, and duplicate phase commands are invalid',()=>{
  let s=fixed();s.phase='vote';s.day=1;
  assert.throws(()=>transition(s,{type:'vote',target:s.human}));
  s.players[6].alive=false;assert.throws(()=>transition(s,{type:'vote',target:6}));
  s.runoff=[0,1];assert.throws(()=>transition(s,{type:'vote',target:2}));
  const next=transition(s,{type:'vote',target:null});
  if(next.phase!=='vote')assert.throws(()=>transition(next,{type:'vote',target:0}));
});
test('eliminated player cannot speak, vote, or spend witch potions',()=>{
  const s=fixed();s.players[s.human].alive=false;s.phase='day';s.day=1;
  assert.throws(()=>transition(s,{type:'speak',kind:'support',target:0}));
  const next=transition(s,{type:'speak',kind:'skip'});
  assert.throws(()=>transition(next,{type:'vote',target:0}));
});
test('restore rejects old version, duplicate cards, malformed identities and JSON',()=>{
  assert.deepEqual(restoreGame(JSON.stringify(make(12)),ids),make(12));
  assert.equal(restoreGame('{bad',ids),null);
  const s=make(12);s.version=42;assert.equal(restoreGame(s,ids),null);
  s.version=1;s.players[0].character=s.players[1].character;assert.equal(restoreGame(s,ids),null);
  const p=make(12);p.players[0].role='admin';assert.equal(restoreGame(p,ids),null);
});
test('100 simulated whole games end, preserve saves, and cover human roles',()=>{
  const outcomes=new Set(), humanRoles=new Set();
  for(let seed=0;seed<100;seed++){
    let s=make(seed), steps=0;humanRoles.add(s.players[s.human].role);
    while(s.phase!=='over'&&steps++<150) {
      s=automatic(s);
      assert.ok(restoreGame(JSON.stringify(s),ids),'valid save at '+s.phase);
    }
    assert.equal(s.phase,'over','seed '+seed+' does not terminate');
    outcomes.add(s.winner);
    assert.equal(s.winner,winnerOf(s.players));
  }
  assert.equal(humanRoles.size,4);assert.ok(outcomes.has('wolf'));assert.ok(outcomes.has('good'));
});
test('spectator fast-forward terminates without human actions',()=>{
  let s=fixed();s.players[s.human].alive=false;s.phase='roundEnd';s.day=1;
  s=advanceSpectator(s);assert.equal(s.phase,'over');
  assert.ok(!s.events.some(e=>e.actor===s.human&&e.kind==='ballot'));
});
test('completed runoff clears transient candidates before storing',()=>{
  const s=fixed();s.phase='vote';s.day=1;s.runoff=[0,1];
  const next=transition(s,{type:'vote',target:0});
  assert.equal(next.runoff,null);
  assert.ok(restoreGame(next,ids));
});
test('corrupt tally payload is rejected instead of crashing the journal',()=>{
  const s=make(1);s.events=[{id:'e1',day:1,kind:'tally',counts:null}];
  assert.equal(restoreGame(s,ids),null);
});
test('168 original lines remain archived, public content has no archive or research names',async()=>{
  const c=await publicContent(), serialized=JSON.stringify(c);
  assert.equal(Object.values(raw.quoteSets).flatMap(p=>Object.values(p).flat()).length,168);
  assert.equal(c.quoteSets,undefined);
  assert.equal(Object.keys(c.verifiedQuotes).length,7);
  for(const person of raw.characters.map(c=>c.researchOnly.referencePerson))assert.equal(serialized.includes(person),false);
  assert.equal(serialized.includes('researchOnly'),false);
  assert.equal(serialized.includes('sourcePath'),false);
  assert.equal(c.characters.every(c=>c.portrait.endsWith('.webp')),true);
});
