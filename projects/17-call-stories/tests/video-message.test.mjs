import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVideoSource,bytesBase64,videoTime,prepareVideo,videoLimitBytes} from '../src/video-message.mjs';
import {normalizeMessage} from '../src/chat-messages.mjs';
const data=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url),'utf8'));
test('video drafts keep identity and duration but never persist files, source or poster',()=>{
  const result=normalizeMessage({id:'video-1',kind:'video',personId:'self',duration:12.4,description:'测试',url:'blob:secret',posterUrl:'data:image/jpeg;secret',file:{bytes:'secret'}},id=>id,data);
  assert.deepEqual(result,{id:'video-1',kind:'video',personId:'self',text:'',duration:12.4,description:'测试'});
  assert.ok(normalizeMessage({kind:'video'},()=> 'self',data).id);
  assert.equal(normalizeMessage({kind:'video',duration:Infinity},()=> 'self',data).duration,0);
});
test('browser video owns one temporary URL and disposal is idempotent',async()=>{
  let created=0,revoked=0;const file={type:'video/mp4'};
  const result=await createVideoSource(file,{urls:{createObjectURL(value){assert.equal(value,file);created++;return 'blob:test';},revokeObjectURL(value){assert.equal(value,'blob:test');revoked++;}}});
  assert.equal(result.url,'blob:test');result.dispose();result.dispose();assert.equal(created,1);assert.equal(revoked,1);
});
test('native host uses the returned temporary file handle without rewriting or blob fallback',async()=>{
  let called=0;const handle='xhs-file://temporary/video-1';
  const result=await createVideoSource({type:'video/mp4',name:'clip.mp4'},{read:async()=>new Uint8Array([0,127,255]),bridge:{async writeTempFile(arg){called++;assert.deepEqual(arg,{data:'data:video/mp4;base64,AH//'});return {filePath:handle};}}});
  assert.equal(result.url,handle);assert.equal(called,1);result.dispose();
  await assert.rejects(createVideoSource({type:'video/mp4'},{bridge:{}}),/unsupported/);
  await assert.rejects(createVideoSource({type:'video/webm',name:'clip.webm'},{bridge:{writeTempFile(){throw Error('should not run');}}}),/format/);
  await assert.rejects(createVideoSource({type:'video/mp4'},{read:async()=>new Uint8Array(),bridge:{writeTempFile:async()=>{throw Error('bridge failure');}}}),/bridge failure/);
});
test('video time and base64 preserve long duration and byte boundaries',()=>{
  assert.equal(videoTime(5.9),'0:05');assert.equal(videoTime(65),'1:05');assert.equal(videoTime(NaN),'0:00');
  const bytes=Uint8Array.from({length:25000},(_,i)=>i%256);assert.deepEqual(Buffer.from(bytesBase64(bytes),'base64'),Buffer.from(bytes));
});
test('reject oversized and non-video selections before allocating a decoder',async()=>{
  await assert.rejects(prepareVideo({size:videoLimitBytes+1,type:'video/mp4',name:'large.mp4'},{}),/large/);
  await assert.rejects(prepareVideo({size:10,type:'text/plain',name:'bad.txt'},{}),/invalid/);
});
