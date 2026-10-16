import test from 'node:test';
import assert from 'node:assert/strict';
import {createContainerStorage} from '../src/container-storage.js';

function environment(version=9462004){
  const browser=new Map(),native=new Map(),writes=[];
  const host={localStorage:{getItem:key=>browser.has(key)?browser.get(key):null,setItem:(key,value)=>browser.set(key,value)},xhs:{launchOptions:{miniToolEnv:{buildVersion:version}},miniTool:{getStorage:async({key})=>({data:native.has(key)?native.get(key):null}),setStorage:async({key,data})=>{writes.push({key,data});native.set(key,data);}}}};
  return{host,browser,native,writes};
}
test('eligible clients load native data before browser data',async()=>{
  const env=environment();env.native.set('plan',JSON.stringify('{"rooms":[]}'));env.browser.set('plan','old');
  const storage=await createContainerStorage(env.host,['plan']);
  assert.equal(storage.kind,'native');assert.equal(storage.getItem('plan'),'{"rooms":[]}');assert.equal(env.writes.length,0);
});
test('missing native keys migrate browser values without deleting the backup',async()=>{
  const env=environment();env.browser.set('plan','{"rooms":[]}');
  const storage=await createContainerStorage(env.host,['plan']);
  assert.equal(storage.getItem('plan'),'{"rooms":[]}');assert.equal(JSON.parse(env.native.get('plan')),'{"rooms":[]}');assert.ok(env.browser.has('plan'));
});
test('legacy and unknown client versions use guarded caller browser fallback',async()=>{
  for(const version of [0,9459004]){const env=environment(version);const storage=await createContainerStorage(env.host,['plan']);assert.equal(storage.kind,'browser');storage.setItem('plan','value');assert.equal(env.browser.get('plan'),'value');}
});
test('asynchronous launch options enable native storage',async()=>{
  const env=environment();env.host.xhs.launchOptions=null;env.host.xhs.miniTool.getLaunchOptions=async()=>({miniToolEnv:{buildVersion:9460000}});
  assert.equal((await createContainerStorage(env.host,['plan'])).kind,'native');
});
test('native read failures never overwrite unread plans with browser data',async()=>{
  const env=environment();env.browser.set('plan','old');env.host.xhs.miniTool.getStorage=async()=>{throw new Error('read denied');};
  const storage=await createContainerStorage(env.host,['plan']);assert.throws(()=>storage.getItem('plan'),/read denied/);assert.equal(env.writes.length,0);
});
test('writes report native failures and later writes can recover',async()=>{
  const env=environment();const storage=await createContainerStorage(env.host,['plan']);let reject=true;
  env.host.xhs.miniTool.setStorage=async({key,data})=>{if(reject)throw new Error('quota');env.native.set(key,data);};
  await assert.rejects(storage.setItem('plan','first'),/quota/);reject=false;await storage.setItem('plan','second');assert.equal(storage.getItem('plan'),'second');
});
test('oversized items fail before the native call',async()=>{
  const env=environment();const storage=await createContainerStorage(env.host,['plan']);await assert.rejects(storage.setItem('plan','a'.repeat(1024*1024)),/1 MiB/);assert.equal(env.writes.length,0);
});
